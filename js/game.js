'use strict';
// =====================================================================
// GAME — state machine, input, physics, spawning, collisions, the
// combo / judgement system, leaderboard network calls and the loop.
// =====================================================================

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
let state = 'START_MENU'; // 'START_MENU' | 'playing' | 'GAME_OVER' | 'LEADERBOARD_SCREEN'
let highScore = 0;
try { highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0; } catch (e) { highScore = 0; }

let player, obstacles = [], score, scoreTimer, spawnTimer, beatHighScoreThisRun, recordFlashT, ripPhrase;
let blinkTimer, blinkOn, stepPhase;
let runTime = 0, lastActionT = -99, combo = 0;
let gameOverT = 0, lastDrawnState = null;

let leaderboardData = [];
let leaderboardStatus = 'idle'; // 'idle' | 'loading' | 'loaded'
let leaderboardT = 0;
let playerRank = null;
let nicknameInput = '';
let nicknameSubmitted = false;
let isHighScoreEntry = false; // true only when the run cracked the Top 10
let rankCheckDone = false;

function resetPlayer() {
  player = { y: 0, vy: 0, onGround: true, ducking: false, duckTimer: 0, squish: 0 };
}

function resetGame() {
  resetPlayer();
  obstacles = [];
  score = 0;
  scoreTimer = 0;
  spawnTimer = 0.9;
  beatHighScoreThisRun = false;
  recordFlashT = 0;
  blinkTimer = 2 + Math.random() * 2;
  blinkOn = false;
  stepPhase = 0;
  runTime = 0; lastActionT = -99; combo = 0;
  resetFx();
}
resetGame();

// ---------------------------------------------------------------------
// SUPABASE LEADERBOARD (fetch/submit + fail-safe mock fallback)
// ---------------------------------------------------------------------
const MOCK_LEADERBOARD = [
  { name: 'ACE', score: 128 }, { name: 'RUX', score: 97 }, { name: 'ZED', score: 84 },
  { name: 'FOX', score: 61 }, { name: 'PIP', score: 45 },
];

async function fetchLeaderboard() {
  leaderboardStatus = 'loading';
  try {
    const res = await fetch(`${SUPABASE_URL}leaderboard?select=name,score&order=score.desc&limit=10`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    leaderboardData = Array.isArray(data) && data.length ? data : MOCK_LEADERBOARD.slice();
  } catch (e) {
    // FAIL-SAFE: network/DB unreachable — fall back to local mock data so the state machine never freezes.
    leaderboardData = MOCK_LEADERBOARD.slice();
  }
  leaderboardStatus = 'loaded';
}

function computePlayerRank(sc) {
  let rank = 1;
  for (const row of leaderboardData) { if (row.score > sc) rank++; }
  return rank;
}

async function submitHighScore(name, sc) {
  try {
    const res = await fetch(`${SUPABASE_URL}leaderboard`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ name, score: sc }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (e) {
    // FAIL-SAFE: POST failed — splice locally so the board still reflects the run.
    leaderboardData.push({ name, score: sc });
    leaderboardData.sort((a, b) => b.score - a.score);
    leaderboardData = leaderboardData.slice(0, 10);
  }
  await fetchLeaderboard();
  goToLeaderboard();
}

function goToLeaderboard() { state = 'LEADERBOARD_SCREEN'; leaderboardT = 0; }

// ---------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------
// Invisible input overlay — focusing this real <input> lets mobile browsers open the soft keyboard reliably.
const hiddenInput = document.createElement('input');
hiddenInput.type = 'text';
hiddenInput.maxLength = 10;
hiddenInput.className = 'hidden-input';
hiddenInput.setAttribute('autocapitalize', 'characters');
hiddenInput.setAttribute('autocomplete', 'off');
document.body.appendChild(hiddenInput);

hiddenInput.addEventListener('input', (e) => {
  if (state === 'GAME_OVER' && isHighScoreEntry) {
    nicknameInput = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 10);
  }
});

function submitNicknameIfReady() {
  if (state !== 'GAME_OVER' || !isHighScoreEntry || nicknameSubmitted) return;
  nicknameSubmitted = true;
  hiddenInput.blur();
  hiddenInput.value = '';
  const finalName = (nicknameInput.trim() || 'ANON').slice(0, 10).toUpperCase();
  sfxUiBlip();
  submitHighScore(finalName, score);
}

function skipToMenu() {
  if (state !== 'GAME_OVER') return;
  hiddenInput.blur();
  hiddenInput.value = '';
  nicknameInput = '';
  nicknameSubmitted = false;
  isHighScoreEntry = false;
  state = 'START_MENU';
}

function doJump() {
  if (state !== 'playing') return;
  if (player.onGround && !player.ducking) {
    player.onGround = false;
    player.vy = JUMP_VELOCITY * SCALE;
    lastActionT = runTime;
    spawnDust(6);
    sfxJump();
  }
}

function doDownAction() {
  if (state !== 'playing') return;
  if (!player.onGround) {
    // fast-fall
    player.y = 0; player.vy = 0; player.onGround = true; player.squish = 1;
    lastActionT = runTime;
    spawnDust(10);
    addShake(2 * SCALE, 0.1);
    sfxFastFall();
  } else if (!player.ducking) {
    player.ducking = true;
    player.duckTimer = DUCK_DURATION;
    lastActionT = runTime;
    sfxDuck();
  }
}

function handleStartTap() {
  ensureAudio();
  if (titleIntroActive()) { skipTitleIntro(); return; } // first tap during the intro just skips it
  state = 'playing';
  resetGame();
  sfxStart();
  musicStart();
}

let pointerActive = false, pointerStartY = 0, pointerStartX = 0;

canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  if (state !== 'GAME_OVER' && !musicPlaying()) musicStart();
  pointerActive = true;
  const rect = canvas.getBoundingClientRect();
  pointerStartX = e.clientX - rect.left;
  pointerStartY = e.clientY - rect.top;
  // Tapping the nickname box focuses the hidden input on the same gesture so mobile keyboards open reliably.
  if (state === 'GAME_OVER' && isHighScoreEntry && pointInRect(pointerStartX, pointerStartY, nicknameBoxRect)) {
    hiddenInput.value = nicknameInput;
    hiddenInput.focus();
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (!pointerActive) return;
  pointerActive = false;
  const rect = canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left, endY = e.clientY - rect.top;
  const dy = endY - pointerStartY, dx = endX - pointerStartX;
  const isTap = Math.hypot(dx, dy) < SWIPE_THRESHOLD * SCALE;

  if (isTap && pointInRect(endX, endY, muteBtnRect) && state !== 'GAME_OVER') { toggleMute(); return; }

  if (state === 'START_MENU') {
    if (pointInRect(endX, endY, leaderboardBtnRect)) {
      sfxUiBlip();
      goToLeaderboard();
      fetchLeaderboard();
      return;
    }
    handleStartTap();
    return;
  }
  if (state === 'LEADERBOARD_SCREEN') {
    if (pointInRect(endX, endY, backToMenuRect)) { sfxUiBlip(); state = 'START_MENU'; }
    return;
  }
  if (state === 'GAME_OVER') {
    if (pointInRect(endX, endY, submitBtnRect)) { submitNicknameIfReady(); return; }
    if (pointInRect(endX, endY, skipBtnRect)) { sfxUiBlip(); skipToMenu(); return; }
    return;
  }
  if (state === 'playing') {
    const threshold = SWIPE_THRESHOLD * SCALE;
    if (Math.abs(dy) > threshold && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) doJump(); else doDownAction();
    }
  }
});

window.addEventListener('keydown', (e) => {
  // GAME_OVER: free-text nickname entry (up to 10 chars), gated by isHighScoreEntry.
  if (state === 'GAME_OVER' && isHighScoreEntry) {
    if (e.key === 'Enter') { e.preventDefault(); submitNicknameIfReady(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); nicknameInput = nicknameInput.slice(0, -1); return; }
    if (e.key === 'Escape') { e.preventDefault(); skipToMenu(); return; }
    if (e.key.length === 1 && /[a-zA-Z0-9 ]/.test(e.key) && nicknameInput.length < 10) {
      e.preventDefault();
      nicknameInput += e.key.toUpperCase();
    }
    return;
  }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }

  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    ensureAudio();
    if (state === 'START_MENU') { handleStartTap(); return; }
    doJump();
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    ensureAudio();
    doDownAction();
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    ensureAudio();
    if (state === 'START_MENU') handleStartTap();
    else if (state === 'LEADERBOARD_SCREEN') state = 'START_MENU';
  }
});

// ---------------------------------------------------------------------
// OBSTACLES
// ---------------------------------------------------------------------
function spawnObstacle() {
  const roll = Math.random(), s = SCALE;
  const seed = (Math.random() * 1000) | 0;
  if (roll < 0.30) {
    const w = SPIKE_W_BASE * s, h = SPIKE_H_BASE * s;
    obstacles.push({ type: 'spike', x: W + w, w, top: GROUND - h, h, seed });
  } else if (roll < 0.55) {
    const w = HAZARD_DOUBLE_W_BASE * s, h = PUDDLE_H_BASE * s;
    obstacles.push({ type: 'lava', x: W + w, w, top: GROUND - h, h, seed });
  } else if (roll < 0.80) {
    const w = HAZARD_DOUBLE_W_BASE * s, h = BIRD_VIS_H_BASE * s;
    obstacles.push({ type: 'bird', x: W + w, w, top: GROUND - BIRD_BOTTOM_OFFSET_BASE * s - h, h, seed });
  } else {
    const w = HAZARD_DOUBLE_W_BASE * s, totalH = LONG_WALL_TOTAL_H_BASE * s;
    obstacles.push({ type: 'long_wall', x: W + w, w, top: GROUND - LONG_WALL_BOTTOM_OFFSET_BASE * s - totalH, h: totalH, seed });
  }
}

function spawnIntervalForScore(sc) {
  return Math.max(SPAWN_MIN_INTERVAL, SPAWN_BASE_INTERVAL - sc * SPAWN_RAMP_RATE);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function addScore(n) {
  score += n;
  if (!beatHighScoreThisRun && highScore > 0 && score > highScore) {
    beatHighScoreThisRun = true;
    recordFlashT = 1.4;
    sfxHighScore();
    const art = cached('kana|newrecord', () => bakeKanaText('新記録!!', Math.round(26 * SCALE * DPR), ['#ffffff', PAL.gold, '#ff7a2f'], PAL.coral));
    showBanner(art, 'NEW RECORD', W * 0.5, PLAY_H * 0.24, 1.6);
  }
}

// An obstacle fully behind the runner counts as a HIT; a late, tight dodge earns a judgement + bonus.
function clearObstacle(o) {
  o.cleared = true;
  combo += 1;
  bumpCombo(combo);
  sfxClear(combo);
  if (combo % 5 === 0) sfxComboMilestone(combo);
  const d = o.arriveDelta;
  if (d !== undefined && d >= 0) {
    const j = JUDGE_WINDOWS.find((w) => d <= w.max);
    if (j) {
      showJudgement(j.key, j.bonus);
      addScore(j.bonus);
      if (combo % 5 !== 0) sfxJudge(j.key);
    }
  }
}

function killPlayer() {
  state = 'GAME_OVER';
  gameOverT = 0;
  ripPhrase = pick(RIP_PHRASES);
  const cx = W * PLAYER_X_FRAC;
  spawnDeathDebris(cx, GROUND + player.y - 15 * SCALE);
  const crash = cached('kana|crash', () => bakeKanaText('ガシャーン!!', Math.round(24 * SCALE * DPR), ['#ffffff', PAL.gold, PAL.coral], PAL.tomato));
  showBanner(crash, null, Math.min(W * 0.62, cx + 90 * SCALE), GROUND + player.y - 70 * SCALE, 1.1);
  addShake(10 * SCALE, 0.45);
  screenFlash('255,90,79', 0.3);
  musicStop();
  sfxDeath();
  if (score > highScore) {
    highScore = score;
    try { localStorage.setItem(HIGH_SCORE_KEY, String(highScore)); } catch (e) {}
  }
  nicknameInput = '';
  nicknameSubmitted = false;
  isHighScoreEntry = false;
  playerRank = null;
  rankCheckDone = false;
  fetchLeaderboard().then(() => {
    playerRank = computePlayerRank(score);
    const top10 = leaderboardData.slice(0, 10);
    isHighScoreEntry = top10.length < 10 || score > top10[9].score;
    if (!isHighScoreEntry) nicknameSubmitted = true;
    rankCheckDone = true;
  });
}

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------
function update(dt) {
  updateWorld(dt, state !== 'GAME_OVER');
  updateFx(dt);

  blinkTimer -= dt;
  if (blinkTimer <= 0) {
    blinkOn = !blinkOn;
    blinkTimer = blinkOn ? 0.12 : (1.5 + Math.random() * 2.2);
  }

  if (state === 'GAME_OVER') {
    gameOverT += dt;
    // Not in the Top 10: show the results for a moment, then slide to the ranking.
    if (rankCheckDone && !isHighScoreEntry && gameOverT > 2.6) goToLeaderboard();
    return;
  }
  if (state === 'LEADERBOARD_SCREEN') { leaderboardT += dt; return; }
  if (state !== 'playing') return;

  runTime += dt;
  stepPhase += dt * 10;
  if (recordFlashT > 0) recordFlashT -= dt;

  // score: one point per second survived (+ judgement bonuses)
  scoreTimer += dt;
  while (scoreTimer >= 1) { scoreTimer -= 1; addScore(1); }

  // player physics
  if (!player.onGround) {
    player.vy += GRAVITY * SCALE * dt;
    player.y += player.vy * dt;
    if (player.y >= 0) {
      player.y = 0; player.vy = 0; player.onGround = true; player.squish = 1;
      spawnDust(4);
    }
  }
  if (player.squish > 0) player.squish -= dt * 4;
  if (player.ducking) {
    player.duckTimer -= dt;
    if (player.duckTimer <= 0) player.ducking = false;
  }

  // spawn obstacles
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = spawnIntervalForScore(score);
  }

  // move + collide obstacles
  const speed = SCROLL_SPEED_BASE * SCALE;
  const pBox = playerHitbox();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed * dt;
    if (o.arriveDelta === undefined && o.x <= pBox.x + pBox.w) o.arriveDelta = runTime - lastActionT;
    if (!o.cleared && o.x + o.w < pBox.x) clearObstacle(o);
    if (o.x + o.w < -10) { obstacles.splice(i, 1); continue; }
    if (rectsOverlap(pBox, obstacleHitbox(o))) { killPlayer(); break; }
  }
}

// ---------------------------------------------------------------------
// DRAW
// ---------------------------------------------------------------------
function draw() {
  const t = performance.now() / 1000;
  // Replay the title intro whenever we arrive at the menu (but not when backing out of the leaderboard).
  if (state === 'START_MENU' && lastDrawnState !== 'START_MENU' && lastDrawnState !== 'LEADERBOARD_SCREEN') startTitleIntro();
  lastDrawnState = state;

  if (state === 'START_MENU') {
    drawStartMenu();
    drawAdBanner();
    return;
  }

  const [sx, sy] = shakeOffset();
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, PLAY_H); ctx.clip();
  ctx.translate(sx, sy);
  drawWorld(t);
  if (state === 'playing' || state === 'GAME_OVER') {
    drawObstacles(t);
    if (state === 'playing') drawPlayer(t);
    drawDebugHitboxes();
  }
  drawParticles();
  ctx.restore();

  drawCrtOverlay(PLAY_H);
  if (state === 'playing' || state === 'GAME_OVER') {
    drawCallouts();
    drawHud(t);
  }
  drawFlash(PLAY_H);
  if (state === 'GAME_OVER') drawGameOverScreen(gameOverT);
  if (state === 'LEADERBOARD_SCREEN') drawLeaderboardScreen(leaderboardT);
  drawAdBanner();
}

// ---------------------------------------------------------------------
// LOOP
// ---------------------------------------------------------------------
let lastT = performance.now();
function loop(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05; // clamp on tab-switch/lag
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);
