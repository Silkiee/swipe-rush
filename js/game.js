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
let level = 1, speedNow = SCROLL_SPEED_BASE;   // speed level 1..4 and current scroll speed (px/s @ SCALE 1)
let downHeld = false;                          // finger / Down key still held after a swipe down (hold-to-duck)
let runId = 0, pendingType = null, pendingAutoSave = null;
let gameOverT = 0, lastDrawnState = null;
let countdownT = 0, countdownDur = 0, glideIn = false, goT = -1, titleExitAt = -1; // pre-run countdown

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
  level = 1; speedNow = LEVEL_SPEEDS[0]; downHeld = false; pendingType = null;
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

// fetch() with a hard timeout so a hanging network can never freeze the results screen.
async function fetchWithTimeout(url, opts) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), NET_TIMEOUT_MS) : null;
  try { return await fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {})); }
  finally { if (timer) clearTimeout(timer); }
}

async function fetchLeaderboard() {
  leaderboardStatus = 'loading';
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}leaderboard?select=name,score&order=score.desc&limit=10`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    leaderboardData = Array.isArray(data) && data.length ? data : MOCK_LEADERBOARD.slice();
  } catch (e) {
    // FAIL-SAFE: network/DB unreachable — keep what we already have (incl. locally saved scores),
    // and only fall back to mock data when there is nothing yet, so the state machine never freezes.
    if (!leaderboardData.length) leaderboardData = MOCK_LEADERBOARD.slice();
  }
  leaderboardStatus = 'loaded';
}

function computePlayerRank(sc) {
  let rank = 1;
  for (const row of leaderboardData) { if (row.score > sc) rank++; }
  return rank;
}

async function submitHighScore(name, sc, showRanking = true) {
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}leaderboard`, {
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
  // only jump to the ranking if the player is still on the results (not already on a new run)
  if (showRanking && state === 'GAME_OVER') goToLeaderboard();
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

// PLAY AGAIN: straight into a new run. An unsubmitted Top 10 score is saved in the background first.
function playAgain() {
  if (state !== 'GAME_OVER') return;
  if (isHighScoreEntry && !nicknameSubmitted) {
    const finalName = (nicknameInput.trim() || 'ANON').slice(0, 10).toUpperCase();
    submitHighScore(finalName, score, false);
  } else if (!rankCheckDone) {
    pendingAutoSave = { run: runId, score }; // rank not known yet: save as ANON later if it makes the Top 10
  }
  hiddenInput.blur();
  hiddenInput.value = '';
  nicknameInput = '';
  nicknameSubmitted = false;
  isHighScoreEntry = false;
  ensureAudio();
  startRun(true);
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
  if (player.onGround) {
    player.ducking = false; // swipe up cancels a duck straight into a jump
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
  } else {
    // A repeat swipe extends the duck, but only the FIRST swipe counts for NICE/GREAT/PERFECT timing.
    if (!player.ducking) { sfxDuck(); lastActionT = runTime; }
    player.ducking = true;
    player.duckTimer = DUCK_DURATION;
  }
}

// ---- HOW TO PLAY --------------------------------------------------
let howToSeen = false;
try { howToSeen = localStorage.getItem(HOWTO_SEEN_KEY) === '1'; } catch (e) { howToSeen = false; }

function openHowTo() {
  state = 'HOW_TO_PLAY';
  howToPage = 0; howToT = 0; howToDir = 1;
  howToSeen = true;
  try { localStorage.setItem(HOWTO_SEEN_KEY, '1'); } catch (e) {}
}

function howToGo(delta) {
  const next = howToPage + delta;
  if (next < 0) { state = 'START_MENU'; return; }
  if (next >= HOWTO_PAGES.length) { startRun(); return; }
  howToPage = next; howToT = 0; howToDir = delta;
}

function handleHowToTap(x, y, dx, dy) {
  // horizontal swipe flips pages; buttons do too
  if (Math.abs(dx) > SWIPE_THRESHOLD * SCALE * 1.5 && Math.abs(dx) > Math.abs(dy)) { sfxUiBlip(); howToGo(dx < 0 ? 1 : -1); return; }
  if (pointInRect(x, y, howToNextRect)) { sfxUiBlip(); howToGo(1); return; }
  if (pointInRect(x, y, howToBackRect)) { sfxUiBlip(); howToGo(-1); }
}

// Every run opens with a countdown: 3-2-1 from the title / How to Play (the runner glides from the
// title's centre spot to its run position), a quick READY on PLAY AGAIN. Warm-up jumps and ducks
// work; hazards, points and the run timer only start on GO!!.
function startRun(retry) {
  runId++;
  titleExitAt = state === 'START_MENU' ? performance.now() : -1;
  state = 'playing';
  resetGame();
  countdownDur = countdownT = retry ? COUNTDOWN_RETRY : COUNTDOWN_FULL;
  glideIn = !retry;
  runnerXOffset = glideIn ? W / 2 - W * PLAYER_X_FRAC : 0;
  goT = -1;
  sfxCountBeep();
  musicStart();
}

function updateCountdown(dt) {
  const before = countdownT;
  countdownT = Math.max(0, countdownT - dt);
  const g = clamp01((countdownDur - countdownT) / GLIDE_TIME), ease = g * g * (3 - 2 * g);
  runnerXOffset = glideIn ? (W / 2 - W * PLAYER_X_FRAC) * (1 - ease) : 0;
  if (countdownDur === COUNTDOWN_FULL && countdownT > 0 && Math.ceil(countdownT) < Math.ceil(before)) sfxCountBeep(); // 2, 1 (READY beeps once)
  if (countdownT === 0) {
    runnerXOffset = 0;
    lastActionT = -99;                // warm-up moves never count toward a timing bonus
    goT = 0;
    sfxStart();
  }
}

function handleStartTap() {
  ensureAudio();
  if (titleIntroActive()) { skipTitleIntro(); return; } // first tap during the intro just skips it
  if (!howToSeen) { sfxUiBlip(); openHowTo(); return; } // first ever start shows the instructions
  startRun();
}

// Swipes fire mid-gesture, the moment the finger travels past the threshold (no waiting for the
// lift). After firing, the anchor moves to the current point so a reversal (down -> up) without
// lifting fires again. Pointer capture + pointercancel keep browser gestures from eating swipes.
let pointerActive = false, pointerId = null, pointerStartY = 0, pointerStartX = 0;
let swipeAnchorX = 0, swipeAnchorY = 0, swipeFired = false, lastSwipeDir = 0;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

// Returns -1 (up), 1 (down) or 0. Accepts strokes up to ~60deg off vertical, so thumb arcs still count.
function swipeDirection(dx, dy) {
  if (Math.abs(dy) < SWIPE_FIRE_DIST * SCALE) return 0;
  if (Math.abs(dy) < Math.abs(dx) * SWIPE_ANGLE_RATIO) return 0;
  return dy < 0 ? -1 : 1;
}

function fireSwipe(dir) {
  downHeld = dir > 0;                 // swipe down + keep the finger down = stay ducked
  if (dir < 0) doJump(); else doDownAction();
  swipeFired = true;
  lastSwipeDir = dir;
}

canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  if (state !== 'GAME_OVER' && !musicPlaying()) musicStart();
  pointerActive = true;
  pointerId = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  [pointerStartX, pointerStartY] = canvasPoint(e);
  swipeAnchorX = pointerStartX; swipeAnchorY = pointerStartY;
  swipeFired = false; lastSwipeDir = 0;
  // Tapping the nickname box focuses the hidden input on the same gesture so mobile keyboards open reliably.
  if (state === 'GAME_OVER' && isHighScoreEntry && pointInRect(pointerStartX, pointerStartY, nicknameBoxRect)) {
    hiddenInput.value = nicknameInput;
    hiddenInput.focus();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerActive || e.pointerId !== pointerId || state !== 'playing') return;
  const [x, y] = canvasPoint(e);
  const dir = swipeDirection(x - swipeAnchorX, y - swipeAnchorY);
  if (dir === 0) return;
  if (dir !== lastSwipeDir) fireSwipe(dir);
  swipeAnchorX = x; swipeAnchorY = y; // re-arm from here; continuing the same way won't double-fire
});

canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerId === pointerId) { pointerActive = false; downHeld = false; }
});

canvas.addEventListener('pointerup', (e) => {
  if (!pointerActive || e.pointerId !== pointerId) return;
  pointerActive = false;
  downHeld = false;                   // lifting the finger ends a held duck
  const [endX, endY] = canvasPoint(e);
  const dy = endY - pointerStartY, dx = endX - pointerStartX;
  const isTap = !swipeFired && Math.hypot(dx, dy) < SWIPE_THRESHOLD * SCALE;

  if (isTap && pointInRect(endX, endY, muteBtnRect) && state !== 'GAME_OVER') { toggleMute(); return; }

  if (state === 'START_MENU') {
    if (pointInRect(endX, endY, leaderboardBtnRect)) {
      sfxUiBlip();
      goToLeaderboard();
      fetchLeaderboard();
      return;
    }
    if (pointInRect(endX, endY, howToBtnRect)) { sfxUiBlip(); openHowTo(); return; }
    handleStartTap();
    return;
  }
  if (state === 'HOW_TO_PLAY') { handleHowToTap(endX, endY, dx, dy); return; }
  if (state === 'LEADERBOARD_SCREEN') {
    if (pointInRect(endX, endY, backToMenuRect)) { sfxUiBlip(); state = 'START_MENU'; }
    return;
  }
  if (state === 'GAME_OVER') {
    if (pointInRect(endX, endY, submitBtnRect)) { submitNicknameIfReady(); return; }
    if (pointInRect(endX, endY, playAgainBtnRect)) { playAgain(); return; }
    if (pointInRect(endX, endY, rankingBtnRect)) { sfxUiBlip(); goToLeaderboard(); return; }
    if (pointInRect(endX, endY, skipBtnRect)) { sfxUiBlip(); skipToMenu(); return; }
    return;
  }
  if (state === 'playing' && !swipeFired) {
    // very fast flicks can lift before any pointermove arrives — judge them on release
    const dir = swipeDirection(endX - swipeAnchorX, endY - swipeAnchorY);
    if (dir !== 0) fireSwipe(dir);
  }
});

// iOS Safari can still start a page scroll / toolbar reveal on a downward drag; block it on the canvas.
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });

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
  // GAME_OVER outside the Top 10: Space / Enter = play again, Esc = back to menu.
  if (state === 'GAME_OVER' && gameOverT > GAME_OVER_INPUT_DELAY) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); playAgain(); return; }
    if (e.key === 'Escape') { e.preventDefault(); skipToMenu(); return; }
  }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }

  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    ensureAudio();
    if (state === 'START_MENU') { handleStartTap(); return; }
    doJump();
  } else if (state === 'HOW_TO_PLAY' && ['ArrowRight', 'ArrowLeft', 'Escape'].includes(e.key)) {
    e.preventDefault();
    if (e.key === 'Escape') state = 'START_MENU'; else howToGo(e.key === 'ArrowRight' ? 1 : -1);
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    if (e.repeat) return;             // auto-repeat while held is not a new swipe
    ensureAudio();
    downHeld = state === 'playing';
    doDownAction();
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    ensureAudio();
    if (state === 'START_MENU') handleStartTap();
    else if (state === 'HOW_TO_PLAY') howToGo(1);
    else if (state === 'LEADERBOARD_SCREEN') state = 'START_MENU';
    else if (state === 'playing' && e.key === ' ') doJump();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') downHeld = false;
});

// ---------------------------------------------------------------------
// OBSTACLES
// ---------------------------------------------------------------------
function pickObstacleType() {
  const roll = Math.random();
  return roll < 0.30 ? 'spike' : roll < 0.55 ? 'lava' : roll < 0.80 ? 'bird' : 'long_wall';
}

function obstacleSize(type) {
  const s = SCALE;
  if (type === 'spike') return { w: SPIKE_W_BASE * s, h: SPIKE_H_BASE * s };
  if (type === 'lava') return { w: HAZARD_DOUBLE_W_BASE * s, h: PUDDLE_H_BASE * s };
  if (type === 'bird') return { w: HAZARD_DOUBLE_W_BASE * s, h: BIRD_VIS_H_BASE * s };
  return { w: HAZARD_DOUBLE_W_BASE * s, h: LONG_WALL_TOTAL_H_BASE * s };
}

function spawnObstacle(type) {
  const s = SCALE, { w, h } = obstacleSize(type);
  const seed = (Math.random() * 1000) | 0;
  let top = GROUND - h;
  if (type === 'bird') top = GROUND - BIRD_BOTTOM_OFFSET_BASE * s - h;
  if (type === 'long_wall') top = GROUND - LONG_WALL_BOTTOM_OFFSET_BASE * s - h;
  obstacles.push({ type, x: W + 4 * s, w, top, h, seed }); // front edge just off-screen, whatever the width
}

function spawnIntervalForTime(t) {
  const k = clamp01(t / SPAWN_RAMP_SECONDS);
  return Math.max(SPAWN_MIN_INTERVAL, lerp(SPAWN_BASE_INTERVAL, SPAWN_MIN_INTERVAL, k));
}

// ---- FAIRNESS GUARD ------------------------------------------------
// Every new hazard must leave a dodge window of at least FAIR_WINDOW seconds for a player who
// cleared the previous one, at the fastest speed it can reach before arriving. Derived from the
// jump arc and hitboxes, so a crash is always timing, never an impossible pattern.
const isHighHazard = (type) => type === 'bird' || type === 'long_wall';

// Times (s) after take-off during which the runner's feet are at least h px above the street.
function jumpAboveWindow(h) {
  const v0 = -JUMP_VELOCITY * SCALE, g = GRAVITY * SCALE, disc = v0 * v0 - 2 * g * h;
  if (disc <= 0) return null;
  const r = Math.sqrt(disc);
  return [(v0 - r) / g, (v0 + r) / g];
}

// Minimum free street (px) needed between hazard A's back edge and hazard B's front edge.
function requiredGap(typeA, typeB, v) {
  const s = SCALE, fair = (FAIR_WINDOW + 0.01) * v;          // +10ms for frame-timing slack
  if (isHighHazard(typeB)) {
    if (isHighHazard(typeA)) return 0;                     // just stay ducked (hold-to-duck)
    return PLAYER_DUCK_W * s + fair;                       // land / fast-fall, then duck in time
  }
  const { w: wB, h: hB } = obstacleSize(typeB);
  const win = jumpAboveWindow(hB + 1);
  const dMin = v * win[0];                                 // jumping closer than this is too late
  return PLAYER_STAND_W * s + dMin + fair;                 // stand clear of A, then a full jump window
}

// Seconds to hold back the next spawn so the gap is fair (0 = spawn now).
function fairSpawnDelay(type) {
  if (!obstacles.length) return 0;
  const prev = obstacles.reduce((a, o) => (o.x > a.x ? o : a));
  const vMax = LEVEL_SPEEDS[Math.min(level, LEVEL_SPEEDS.length - 1)] * SCALE; // next level's speed, to be safe
  const gap = (W + 4 * SCALE) - (prev.x + prev.w);
  const need = requiredGap(prev.type, type, vMax);
  return gap >= need ? 0 : (need - gap) / currentScrollSpeed() + 0.01;
}

// Current scroll speed in CSS px/s (level speed during a run, base speed on menus).
function currentScrollSpeed() {
  return (state === 'playing' ? speedNow : SCROLL_SPEED_BASE) * SCALE;
}

function onLevelUp(lv) {
  const pts = LEVEL_POINTS[lv - 1];
  const art = cached('kana|speedup', () => bakeKanaText('加速!!', Math.round(28 * SCALE * DPR), ['#ffffff', '#7ff0ff', '#35d6e8'], PAL.cobalt));
  showBanner(art, 'SPEED UP!  +' + pts + ' / SEC', W * 0.5, PLAY_H * 0.3, 1.5);
  screenFlash('127,240,255', 0.16);
  addShake(3 * SCALE, 0.2);
  sfxSpeedUp();
}

// Re-fit the world after a resize / rotation so hazards stay on the street.
function onViewResize(oldW, oldGround, oldScale) {
  if (!player || !oldScale) return;
  const k = SCALE / oldScale;
  for (const o of obstacles) {
    o.x = o.x * (W / oldW);
    o.w *= k; o.h *= k;
    o.top = GROUND - (oldGround - o.top) * k;
  }
  player.y *= k; player.vy *= k;
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
  // Jumping OVER a crow drone (never under it) is a precision move: flat bonus, replaces the timing bonus.
  if (o.type === 'bird' && o.wentOver && !o.wentUnder) {
    showJudgement('OVER', BIRD_JUMP_BONUS);
    addScore(BIRD_JUMP_BONUS);
    if (combo % 5 !== 0) sfxJudge('PERFECT');
    return;
  }
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
  const cx = runnerX();
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
  const deadRun = runId, deadScore = score;
  fetchLeaderboard().then(() => {
    const top10 = leaderboardData.slice(0, 10);
    const qualifies = top10.length < 10 || deadScore > top10[9].score;
    if (pendingAutoSave && pendingAutoSave.run === deadRun) {
      // the player tapped PLAY AGAIN before the rank was known: keep a Top 10 score as ANON
      if (qualifies) submitHighScore('ANON', deadScore, false);
      pendingAutoSave = null;
      return;
    }
    if (runId !== deadRun || state !== 'GAME_OVER') return; // they already left this results screen
    playerRank = computePlayerRank(deadScore);
    isHighScoreEntry = qualifies;
    if (!isHighScoreEntry) nicknameSubmitted = true;
    rankCheckDone = true;
  });
}

// ---------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------
// Runner gravity, landing and hold-to-duck (shared by the countdown warm-up and the run).
function updatePlayerPhysics(dt) {
  if (!player.onGround) {
    player.vy += GRAVITY * SCALE * dt;
    player.y += player.vy * dt;
    if (player.y >= 0) {
      player.y = 0; player.vy = 0; player.onGround = true; player.squish = 1;
      spawnDust(4);
    }
  }
  if (player.squish > 0) player.squish -= dt * 4;
  // hold-to-duck: a flick ducks for DUCK_DURATION; keeping the finger / Down key held keeps you down
  if (downHeld && player.onGround && !player.ducking) { player.ducking = true; player.duckTimer = 0; } // e.g. after a fast-fall
  if (player.ducking) {
    player.duckTimer -= dt;
    if (player.duckTimer <= 0 && !downHeld) player.ducking = false;
  }
}

function update(dt) {
  updateWorld(dt, state !== 'GAME_OVER');
  updateFx(dt);

  blinkTimer -= dt;
  if (blinkTimer <= 0) {
    blinkOn = !blinkOn;
    blinkTimer = blinkOn ? 0.12 : (1.5 + Math.random() * 2.2);
  }

  if (state === 'GAME_OVER') {
    gameOverT += dt; // results stay up until the player picks PLAY AGAIN / RANKING / MENU
    return;
  }
  if (state === 'LEADERBOARD_SCREEN') { leaderboardT += dt; return; }
  if (state === 'HOW_TO_PLAY') { howToT += dt; return; }
  if (state !== 'playing') return;

  stepPhase += dt * 10;
  if (countdownT > 0) { updateCountdown(dt); updatePlayerPhysics(dt); return; }
  if (goT >= 0) { goT += dt; if (goT > GO_SHOW) goT = -1; }
  runTime += dt;
  if (recordFlashT > 0) recordFlashT -= dt;

  // speed level: steps up every LEVEL_SECONDS; the street eases up to the new speed
  const lv = Math.min(LEVEL_SPEEDS.length, 1 + Math.floor(runTime / LEVEL_SECONDS));
  if (lv > level) { level = lv; onLevelUp(level); }
  speedNow = Math.min(LEVEL_SPEEDS[level - 1], speedNow + SPEED_EASE * dt);

  // score: survival points per second grow with the level (+1 .. +4), plus judgement bonuses
  scoreTimer += dt;
  while (scoreTimer >= 1) { scoreTimer -= 1; addScore(LEVEL_POINTS[level - 1]); }

  updatePlayerPhysics(dt);

  // spawn obstacles
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (!pendingType) pendingType = pickObstacleType();
    const wait = fairSpawnDelay(pendingType);
    if (wait > 0) spawnTimer = wait;               // hold this hazard back until its gap is dodgeable
    else {
      spawnObstacle(pendingType);
      pendingType = null;
      spawnTimer = spawnIntervalForTime(runTime);
    }
  }

  // move + collide obstacles
  const speed = currentScrollSpeed();
  const pBox = playerHitbox();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed * dt;
    if (o.arriveDelta === undefined && o.x <= pBox.x + pBox.w) o.arriveDelta = runTime - lastActionT;
    if (o.type === 'bird' && o.x < pBox.x + pBox.w && o.x + o.w > pBox.x) {
      // while the drone passes the runner, note whether they're above it or below it
      if (pBox.y + pBox.h <= obstacleHitbox(o).y) o.wentOver = true; else o.wentUnder = true;
    }
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
  if (state === 'START_MENU' && lastDrawnState !== 'START_MENU' && lastDrawnState !== 'LEADERBOARD_SCREEN' && lastDrawnState !== 'HOW_TO_PLAY') startTitleIntro();
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
  if (state === 'playing' && titleExitAt >= 0) {
    const p = (performance.now() - titleExitAt) / 450;
    if (p < 1) drawTitleExit(p); else titleExitAt = -1;
  }
  if (state === 'playing' || state === 'GAME_OVER') {
    drawCallouts();
    drawHud(t);
  }
  if (state === 'playing') drawCountdown();
  drawFlash(PLAY_H);
  if (state === 'GAME_OVER') drawGameOverScreen(gameOverT);
  if (state === 'LEADERBOARD_SCREEN') drawLeaderboardScreen(leaderboardT);
  if (state === 'HOW_TO_PLAY') drawHowToScreen(performance.now() / 1000);
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
unlockAudio(); // plays at once where the browser allows it; otherwise the first tap / key unlocks it
requestAnimationFrame(loop);
