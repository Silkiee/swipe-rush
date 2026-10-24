'use strict';
// =====================================================================
// SCREENS — title, in-game HUD + combo counter, game over, leaderboard,
// ad banner and the shared arcade button / mute toggle.
// =====================================================================

let leaderboardBtnRect = null, backToMenuRect = null;
let submitBtnRect = null, skipBtnRect = null, nicknameBoxRect = null;
let playAgainBtnRect = null, rankingBtnRect = null;
let muteBtnRect = null;
let howToBtnRect = null, howToBackRect = null, howToNextRect = null;

// ---------------------------------------------------------------------
// SHARED UI PIECES
// ---------------------------------------------------------------------
function drawArcadeButton(r, label, opts) {
  const o = opts || {};
  const bd = Math.max(2, Math.round(3 * SCALE));
  const frame = o.disabled ? '#3b4f7a' : (o.frame || PAL.amber);
  ctx.fillStyle = PAL.ink; ctx.fillRect(r.x + bd, r.y + bd, r.w, r.h);
  ctx.fillStyle = frame; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = PAL.navy; ctx.fillRect(r.x + bd, r.y + bd, r.w - bd * 2, r.h - bd * 2);
  ctx.fillStyle = o.disabled ? '#2b4374' : (o.key || PAL.coral);
  ctx.fillRect(r.x + bd * 2, r.y + bd * 2, r.w - bd * 4, Math.max(1, bd / 2));
  ctx.fillRect(r.x + bd * 2, r.y + r.h - bd * 2.5, r.w - bd * 4, Math.max(1, bd / 2));
  drawPixelLine(label, r.x + r.w / 2, r.y + r.h / 2, o.unit || 1.9 * SCALE, o.disabled ? '#5f7bab' : (o.text || PAL.creamPale), null, null);
}

function drawMuteButton(x, y) {
  const s = SCALE, size = 28 * s;
  muteBtnRect = { x: x - 6 * s, y: y - 6 * s, w: size + 12 * s, h: size + 12 * s }; // generous tap zone
  ctx.fillStyle = 'rgba(5,11,30,0.75)'; ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = muted ? PAL.coral : PAL.aqua; ctx.lineWidth = 2 * s; ctx.strokeRect(x + 1 * s, y + 1 * s, size - 2 * s, size - 2 * s);
  const c = muted ? PAL.coral : PAL.aqua, p = 2 * s;
  ctx.fillStyle = c;
  ctx.fillRect(x + 6 * s, y + 11 * s, 4 * s, 6 * s);               // speaker box
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 10 * s + i * p, y + (11 - i * 1.5) * s, p, (6 + i * 3) * s);
  if (muted) {
    for (let i = 0; i < 5; i++) { ctx.fillRect(x + 18 * s + i * p, y + 10 * s + i * p, p, p); ctx.fillRect(x + 18 * s + i * p, y + 18 * s - i * p, p, p); }
  } else {
    ctx.fillRect(x + 19 * s, y + 11 * s, p, 6 * s);
    ctx.fillRect(x + 22 * s, y + 9 * s, p, 10 * s);
  }
}

function drawAdBanner() {
  const y = H - BANNER_H;
  ctx.fillStyle = PAL.ink; ctx.fillRect(0, y, W, BANNER_H);
  ctx.strokeStyle = '#1d3a6b'; ctx.lineWidth = 2 * SCALE;
  ctx.strokeRect(2 * SCALE, y + 2 * SCALE, W - 4 * SCALE, BANNER_H - 4 * SCALE);
  drawPixelLine('[ ADVERTISING BANNER SPACE ]', W / 2, y + BANNER_H / 2, 1.4 * SCALE, '#3b5a8f', null, null);
}

function drawSparkle(x, y, size, color) {
  const px = Math.max(1, Math.round(2 * SCALE));
  ctx.fillStyle = color;
  ctx.fillRect(x - px, y - px, px * 2, px * 2);
  const arm = px * (1 + 3 * size);
  ctx.fillRect(x - px / 2, y - arm, px, arm * 2);
  ctx.fillRect(x - arm, y - px / 2, arm * 2, px);
}

// =====================================================================
// TITLE SCREEN — the logo over the same Neon Tokyo street the run takes place on
// =====================================================================
function getTitleCache() {
  return cached('title', () => {
    const uDev = Math.max(2, Math.round(Math.min(W * 0.84 / 31, PLAY_H * 0.30 / 16.5) * DPR));
    return {
      uDev, u: uDev / DPR,
      swipe: bakeLogoWord('SWIPE', uDev, ['#ffffff', '#bffcff', '#35d6e8', '#1466c8'], '#0b2a66'),
      rush: bakeLogoWord('RUSH!!', uDev, ['#fff8e6', '#ffe14d', '#ff7a2f', '#e8283c'], '#7a1420'),
      kata: bakeKanaPlate('スワイプ・ラッシュ', Math.round(17 * SCALE * DPR), PAL.tomato, PAL.cream, '#ffffff'),
      scratch: makeCanvas(1, 1),
    };
  });
}

function drawLogoGlint(tc, word, cx, top, p) {
  const sc = tc.scratch, f = word.fill;
  if (sc.width !== f.width || sc.height !== f.height) { sc.width = f.width; sc.height = f.height; }
  const g = sc.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, sc.width, sc.height);
  g.drawImage(f, 0, 0);
  g.globalCompositeOperation = 'source-in';
  const bx = (-0.25 + p * 1.5) * sc.width, bw = sc.width * 0.09, lean = sc.height * 0.5;
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.moveTo(bx, 0); g.lineTo(bx + bw, 0); g.lineTo(bx + bw - lean, sc.height); g.lineTo(bx - lean, sc.height);
  g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  drawBaked(sc, cx, top, 1, true);
}

// The runner sprinting in place, exactly as it runs in-game.
// t is absolute time so the stride carries on unbroken into the countdown glide.
function drawTitleMascot(cx, groundY, t) {
  drawMascot(cx, groundY, 0, t, { onGround: true, ducking: false, squish: 0 });
}

const TITLE_INTRO_DONE = 1.2; // seconds until the intro has fully settled
let titleT0 = performance.now();
let titleLastT = titleT0;
let titleSlamPlayed = false;
let titleSpeedLines = [];

function startTitleIntro() { titleT0 = performance.now(); titleSlamPlayed = false; }
function titleIntroActive() { return state === 'START_MENU' && (performance.now() - titleT0) / 1000 < TITLE_INTRO_DONE; }
function skipTitleIntro() { titleT0 = performance.now() - TITLE_INTRO_DONE * 1000; titleSlamPlayed = true; }

// Soft navy veil so the title text and buttons stay readable over the busy city: light behind
// the subtitle and TAP TO START, deeper behind the controls text and buttons. The road stays clear.
function drawTitleVeil(subY, tapY, c1, roadTop) {
  const S = SCALE, top = subY - 26 * S;
  const v = ctx.createLinearGradient(0, top, 0, roadTop);
  const at = (y) => clamp01((y - top) / (roadTop - top));
  v.addColorStop(0, 'rgba(8,20,51,0)');
  v.addColorStop(at(subY - 8 * S), 'rgba(8,20,51,0.26)');
  v.addColorStop(at(tapY + 24 * S), 'rgba(8,20,51,0.16)');
  v.addColorStop(at(c1 - 18 * S), 'rgba(8,20,51,0.46)');
  v.addColorStop(1, 'rgba(8,20,51,0.4)');
  ctx.fillStyle = v;
  ctx.fillRect(0, top, W, roadTop - top);
}

function drawStartMenu() {
  const tc = getTitleCache();
  const now = performance.now();
  const t = (now - titleT0) / 1000;
  const dt = Math.min(0.05, (now - titleLastT) / 1000);
  titleLastT = now;
  const PH = PLAY_H, S = SCALE, u = tc.u;

  // layout
  const logoTop = PH * 0.17;
  const kataH = tc.kata.height / DPR;
  const swipeTop = logoTop - tc.swipe.pad / DPR;
  const rushTop = logoTop + 8.3 * u - tc.rush.pad / DPR;
  const logoBottom = logoTop + 16.3 * u;
  const subY = logoBottom + 16 * S;
  // lower stack sits above the road so the mascot can run on it, exactly like a run
  const roadTop = horizonY();
  const footY = roadTop - 34 * S;
  const btnH = 38 * S, btnY = footY - 16 * S - btnH;
  const c3 = btnY - 18 * S, c2 = c3 - 17 * S, c1 = c2 - 17 * S;
  const gapTop = subY + 34 * S, tapY = gapTop + (c1 - 14 * S - gapTop) / 2;

  // intro timeline
  const pKata = clamp01(t / 0.35);
  const pSwipe = clamp01((t - 0.12) / 0.4);
  const pRush = clamp01((t - 0.32) / 0.4);
  const SLAM = 0.72;
  if (t >= SLAM && !titleSlamPlayed) { titleSlamPlayed = true; if (audioReady()) sfxTitleSlam(); }
  const flash = t >= SLAM ? Math.max(0, 1 - (t - SLAM) / 0.35) : 0;
  const shakeAmt = (t >= SLAM && t < SLAM + 0.26) ? 6 * S * (1 - (t - SLAM) / 0.26) : 0;
  const uiAlpha = clamp01((t - 0.85) / 0.35);
  const idle = clamp01((t - 0.9) / 0.5);
  const bob = Math.sin(t * 2.2) * 3 * S * idle;

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, PH); ctx.clip();
  if (shakeAmt) ctx.translate((Math.random() - 0.5) * 2 * shakeAmt, (Math.random() - 0.5) * 2 * shakeAmt);
  ctx.imageSmoothingEnabled = false;

  // the same Neon Tokyo street as the run (scrolls at Level 1 speed via updateWorld)
  ctx.fillStyle = PAL.ink; ctx.fillRect(-20, -20, W + 40, PH + 40); // covers edges during the slam shake
  drawWorld(now / 1000);
  drawTitleVeil(subY, tapY, c1, roadTop);
  drawTitleMascot(W / 2, GROUND, now / 1000);

  // speed lines (the "rush")
  if (Math.random() < dt * 12) {
    titleSpeedLines.push({ x: W + 10, y: Math.random() * PH, len: (40 + Math.random() * 120) * S,
      spd: (700 + Math.random() * 700) * S, col: pick([PAL.cream, PAL.aqua, '#ff8a6b', PAL.gold]) });
  }
  ctx.globalAlpha = 0.5;
  for (const l of titleSpeedLines) { l.x -= l.spd * dt; ctx.fillStyle = l.col; ctx.fillRect(l.x, l.y, l.len, Math.max(1, 2 * S)); }
  ctx.globalAlpha = 1;
  titleSpeedLines = titleSpeedLines.filter((l) => l.x + l.len > -10);

  drawCrtOverlay(PH);

  // katakana plate drops in
  if (pKata > 0) drawBaked(tc.kata, W / 2, logoTop - kataH * 0.92 - (1 - easeOutBack(pKata)) * PH * 0.3 + bob * 0.6, 1, true);

  // logo slides in from both sides, then bobs + glints
  const swipeCx = W / 2 - W * 0.035 - (1 - easeOutBack(pSwipe)) * W * 1.1;
  const rushCx = W / 2 + W * 0.04 + (1 - easeOutBack(pRush)) * W * 1.1;
  if (pSwipe > 0) drawBaked(tc.swipe.canvas, swipeCx, swipeTop + bob, 1, true);
  if (pRush > 0) drawBaked(tc.rush.canvas, rushCx, rushTop + bob, 1, true);
  if (t > TITLE_INTRO_DONE) {
    const gp = ((t - TITLE_INTRO_DONE) % 3.4) / 0.6;
    if (gp < 1) {
      drawLogoGlint(tc, tc.swipe, swipeCx, swipeTop + bob, gp);
      drawLogoGlint(tc, tc.rush, rushCx, rushTop + bob, clamp01(gp - 0.15));
    }
  }

  // twinkling sparkles around the logo
  if (idle > 0) {
    const spark = [[-0.44, 0.02, '#ffffff'], [0.46, -0.04, PAL.gold], [0.49, 0.6, PAL.aqua],
                   [-0.47, 0.82, '#ff8a6b'], [0.05, -0.12, PAL.aqua], [0.3, 1.04, '#ffffff']];
    const lw = W * 0.84, lh = logoBottom - logoTop;
    spark.forEach(([fx, fy, col], i) => {
      const s = Math.sin(t * 3.1 + i * 1.9);
      if (s > 0) drawSparkle(Math.round(W / 2 + fx * lw), Math.round(logoTop + fy * lh + bob), s * idle, col);
    });
  }

  // UI text (fades in after the slam)
  ctx.globalAlpha = uiAlpha;
  const small = 1.8 * S, mid = 2.0 * S, NAVY = PAL.navy;
  drawPixelLine('- HOW FAR CAN YOU RUN? -', W / 2, subY, small, PAL.aquaPale, NAVY, null);
  drawPixelLine('BEST SCORE ' + highScore, W / 2, subY + 22 * S, mid, PAL.gold, NAVY, '#c21f33');

  if ((t % 1.0) < 0.68) {
    const hop = Math.abs(Math.sin(t * Math.PI * 2)) * -3 * S;
    drawPixelLine('TAP TO START', W / 2, tapY + hop, 3 * S, '#ffffff', NAVY, PAL.coral);
  }
  drawPixelLine('SWIPE UP = JUMP', W / 2, c1, small, PAL.cream, NAVY, null);
  drawPixelLine('SWIPE DOWN = DUCK / FAST-FALL', W / 2, c2, small, PAL.cream, NAVY, null);
  drawPixelLine('(DESKTOP: SPACE + ARROW KEYS)', W / 2, c3, small * 0.9, PAL.aqua, NAVY, null);

  // two buttons side by side: HOW TO PLAY (aqua) + RANKING (amber)
  const pairW = W * 0.84, gapB = 10 * S, halfW = (pairW - gapB) / 2, pairX = W / 2 - pairW / 2;
  const howR = { x: pairX, y: btnY, w: halfW, h: btnH }, rankR = { x: pairX + halfW + gapB, y: btnY, w: halfW, h: btnH };
  howToBtnRect = uiAlpha > 0.5 ? howR : null;
  leaderboardBtnRect = uiAlpha > 0.5 ? rankR : null;
  drawArcadeButton(howR, 'HOW TO PLAY', { unit: 1.8 * S, frame: PAL.aqua, key: PAL.coral });
  drawArcadeButton(rankR, 'RANKING', { unit: 1.8 * S });
  drawPixelLine('(C) 2026 SILKIEE', W / 2, footY, small * 0.85, PAL.dusk, NAVY, null);
  drawMuteButton(W - 38 * S, 10 * S);
  ctx.globalAlpha = 1;

  if (flash > 0) { ctx.fillStyle = `rgba(255,248,230,${flash * 0.75})`; ctx.fillRect(-20, -20, W + 40, PH + 40); }
  ctx.restore();
}

// The title logo lifting away as a run starts from the menu (p: 0 -> 1 over ~0.45s).
function drawTitleExit(p) {
  const tc = getTitleCache(), PH = PLAY_H, u = tc.u, e = p * p;
  const logoTop = PH * 0.17 - e * PH * 0.25;
  ctx.globalAlpha = 1 - p;
  drawBaked(tc.kata, W / 2, logoTop - tc.kata.height / DPR * 0.92, 1, true);
  drawBaked(tc.swipe.canvas, W / 2 - W * 0.035, logoTop - tc.swipe.pad / DPR, 1, true);
  drawBaked(tc.rush.canvas, W / 2 + W * 0.04, logoTop + 8.3 * u - tc.rush.pad / DPR, 1, true);
  ctx.globalAlpha = 1;
}

// Big chrome 3-2-1 (or READY on a retry) that pops in, then GO!! with スタート!! once the run is live.
function countdownArt(label, warm) {
  return cached('cd|' + label, () => {
    const uDev = Math.max(2, Math.round(Math.min(W * 0.62 / pixelTextWidth(label), 15 * SCALE) * DPR));
    return warm ? bakeLogoWord(label, uDev, ['#fff8e6', '#ffe14d', '#ff7a2f', '#e8283c'], '#7a1420')
                : bakeLogoWord(label, uDev, ['#ffffff', '#bffcff', '#35d6e8', '#1466c8'], '#0b2a66');
  });
}

function drawCountdown() {
  const cy = PLAY_H * 0.4;
  if (countdownT > 0) {
    const retry = countdownDur === COUNTDOWN_RETRY;
    const label = retry ? 'READY' : String(Math.ceil(countdownT));
    const f = retry ? (countdownDur - countdownT) / countdownDur : Math.ceil(countdownT) - countdownT; // 0 -> 1 per beat
    const pop = 0.45 + 0.55 * easeOutBack(clamp01(f / 0.22));
    ctx.globalAlpha = retry ? 1 : (f > 0.78 ? clamp01((1 - f) / 0.22) : 1);
    drawBaked(countdownArt(label, false).canvas, W / 2, cy, pop, false);
    ctx.globalAlpha = 1;
    return;
  }
  if (goT < 0) return;
  const f = goT / GO_SHOW, pop = 0.5 + 0.5 * easeOutBack(clamp01(f / 0.25));
  ctx.globalAlpha = f > 0.6 ? clamp01((1 - f) / 0.4) : 1;
  const go = countdownArt('GO!!', true).canvas;
  const rise = -f * 14 * SCALE;
  drawBaked(go, W / 2, cy + rise, pop, false);
  const kana = cached('kana|start', () => bakeKanaText('スタート!!', Math.round(22 * SCALE * DPR), ['#ffffff', '#7ff0ff', '#35d6e8'], PAL.cobalt));
  drawBaked(kana, W / 2, cy + rise + go.height / DPR * pop * 0.5 + 4 * SCALE, pop, true);
  ctx.globalAlpha = 1;
}

// =====================================================================
// HUD + COMBO COUNTER
// =====================================================================
function hudHeight() { return 46 * SCALE; }

function drawHud(t) {
  const s = SCALE, hh = hudHeight();
  ctx.fillStyle = 'rgba(5,11,30,0.82)'; ctx.fillRect(0, 0, W, hh);
  ctx.fillStyle = PAL.coral; ctx.fillRect(0, hh - 3 * s, W, 1.5 * s);
  ctx.fillStyle = PAL.aqua; ctx.fillRect(0, hh - 1.5 * s, W, 1.5 * s);

  // SCORE — zero-padded arcade counter with dim leading zeros
  drawPixelLine('SCORE', 10 * s, 11 * s, 1.4 * s, PAL.aqua, null, null, 'left');
  const digits = String(score), padded = digits.padStart(6, '0');
  const u = 2.5 * s, y = 29 * s;
  const recordFlash = recordFlashT > 0 && Math.floor(recordFlashT * 10) % 2 === 0;
  drawPixelLine(padded, 10 * s, y, u, '#2b4374', PAL.ink, null, 'left');
  const uDev = Math.max(1, Math.round(u * DPR));
  const lead = padded.length - digits.length;
  drawPixelLine(digits, 10 * s + (lead * 6 * uDev) / DPR, y, u, recordFlash ? PAL.gold : '#ffffff', PAL.ink, null, 'left');

  // SPEED level + survival points per second
  const lvCol = [PAL.aqua, PAL.gold, '#ff8a6b', '#7dff8a'][level - 1] || PAL.aqua;
  const lvX = 10 * s + 98 * s;
  drawPixelLine('SPEED LV' + level, lvX, 11 * s, 1.4 * s, lvCol, null, null, 'left');
  drawPixelLine('+' + LEVEL_POINTS[level - 1] + '/S', lvX, y, 2.0 * s, lvCol, PAL.ink, null, 'left');

  // HI-SCORE
  const hiX = W * 0.6;
  drawPixelLine('HI-SCORE', hiX, 11 * s, 1.4 * s, PAL.coral, null, null, 'left');
  drawPixelLine(String(Math.max(highScore, score)), hiX, y, 2.0 * s, PAL.gold, PAL.ink, null, 'left');

  drawMuteButton(W - 38 * s, 8 * s);
  drawComboCounter(t);
}

function drawComboCounter() {
  if (comboFx.count <= 0) return;
  const s = SCALE, n = comboFx.count, p = comboFx.popT;
  const cx = W - 62 * s, top = hudHeight() + 8 * s;
  // label
  const label = cached('kana|combo', () => bakeKanaText('コンボ', Math.round(11 * SCALE * DPR), ['#ffffff', PAL.aquaPale], PAL.cobalt));
  drawBaked(label, cx - 6 * s, top, 1, true);
  const numY = top + label.height / DPR + 22 * s;

  // milestone burst behind the number
  if (comboFx.milestone && p < 0.6) {
    for (const b of comboFx.burst) {
      ctx.globalAlpha = 1 - p / 0.6;
      ctx.fillStyle = b.col;
      const bx = cx + Math.cos(b.a) * b.d, by = numY + Math.sin(b.a) * b.d;
      ctx.fillRect(bx - 2 * s, by - 2 * s, 4 * s, 4 * s);
    }
    ctx.globalAlpha = 1;
  }

  // the number: normal hits pop slightly, every 5th SLAMS in huge
  let scale = 1;
  if (comboFx.milestone) scale = p < 0.35 ? lerp(3.0, 1, easeOutBack(clamp01(p / 0.35))) : 1;
  else scale = p < 0.18 ? lerp(1.45, 1, easeOutCubic(clamp01(p / 0.18))) : 1;
  const rainbow = comboFx.milestone && p < 0.9 && Math.floor(p * 14) % 2 === 0;
  const art = rainbow ? comboRainbowArt(n) : comboNumberArt(n);
  const { h } = drawBaked(art, cx, numY, scale);
  drawPixelLine(n === 1 ? 'HIT' : 'HITS!!', cx + 4 * s, numY + h / 2 + 8 * s, 2.0 * s, '#ff8ad0', PAL.navy, PAL.ink);
}

// =====================================================================
// GAME OVER
// =====================================================================
function drawGameOverScreen(t) {
  const s = SCALE, PH = PLAY_H;
  const k = clamp01((t - 0.45) / 0.3);                // overlay fades in after the impact
  if (k <= 0) return;
  ctx.fillStyle = `rgba(5,11,30,${0.8 * k})`; ctx.fillRect(0, 0, W, PH);
  ctx.globalAlpha = k;

  let y = PH * 0.07;
  const plate = cached('kana|gameover', () => bakeKanaPlate('ゲームオーバー', Math.round(14 * SCALE * DPR), PAL.tomato, PAL.cream, '#ffffff'));
  const pIn = clamp01((t - 0.45) / 0.35);
  drawBaked(plate, W / 2, y - (1 - easeOutBack(pIn)) * 40 * s, 1, true);
  y += plate.height / DPR + 4 * s;
  const go = cached('logo|gameover', () => {
    const uDev = Math.max(2, Math.round(Math.min(W * 0.84 / 56, 7.5 * SCALE) * DPR));
    return bakeLogoWord('GAME OVER', uDev, ['#fff8e6', '#ffb07a', '#ff5a4f', '#c21f33'], '#5a0c18').canvas;
  });
  const goScale = t < 0.95 ? lerp(1.8, 1, easeOutBack(clamp01((t - 0.5) / 0.45))) : 1;
  const goH = go.height / DPR;
  drawBaked(go, W / 2, y + goH / 2, goScale);
  y += goH + 10 * s;

  // RIP phrase
  const ripU = 1.6 * s;
  for (const line of wrapPixelText(ripPhrase, ripU, W * 0.84)) {
    drawPixelLine(line, W / 2, y, ripU, PAL.cream, PAL.navy, null);
    y += 14 * s;
  }
  y += 8 * s;

  // stats panel
  const pw = W * 0.74, px = W / 2 - pw / 2, rowH = 20 * s, ph = rowH * 3 + 12 * s;
  ctx.fillStyle = 'rgba(10,21,48,0.9)'; ctx.fillRect(px, y, pw, ph);
  ctx.strokeStyle = PAL.aqua; ctx.lineWidth = 2 * s; ctx.strokeRect(px, y, pw, ph);
  const rows = [['SCORE', String(score), '#ffffff'], ['MAX COMBO', comboFx.max + ' HITS', '#ff8ad0'], ['BEST', String(highScore), PAL.gold]];
  rows.forEach(([lab, val, col], i) => {
    const ry = y + 6 * s + rowH * i + rowH / 2;
    drawPixelLine(lab, px + 10 * s, ry, 1.7 * s, PAL.aqua, null, null, 'left');
    drawPixelLine(val, px + pw - 10 * s, ry, 2.0 * s, col, PAL.ink, null, 'right');
  });
  if (beatHighScoreThisRun && Math.floor(t * 4) % 2 === 0) {
    const nr = cached('kana|newrec', () => bakeKanaText('新記録!!', Math.round(12 * SCALE * DPR), ['#ffffff', PAL.gold], PAL.coral));
    drawBaked(nr, px + pw - 6 * s, y - 4 * s);
  }
  y += ph + 14 * s;

  const placement = playerRank ? 'YOU PLACED #' + playerRank + ' GLOBAL!' : 'CALCULATING RANK...';
  drawPixelLine(placement, W / 2, y, 1.9 * s, PAL.gold, PAL.navy, null);
  y += 22 * s;

  submitBtnRect = skipBtnRect = nicknameBoxRect = playAgainBtnRect = rankingBtnRect = null;
  const live = t > GAME_OVER_INPUT_DELAY;                 // ignore taps from the swipe that caused the crash
  const colW = W * 0.84, colX = W / 2 - colW / 2, bh = 36 * s, gap = 10 * s;
  const frameBd = Math.max(2, Math.round(3 * s));
  const hugW = (label, unit) => Math.min(colW, pixelLineWidth(label, unit, false) + 2 * (10 * s + frameBd));

  // Rank slot — always the same height, so PLAY AGAIN / BACK TO MENU never move under the finger:
  // loading -> "CHECKING RANK", Top 10 -> nickname + SUBMIT, otherwise -> VIEW RANKING.
  const slotTop = y, slotH = 12 * s + bh;
  if (!rankCheckDone) {
    // slot stays empty while "CALCULATING RANK..." shows above
  } else if (isHighScoreEntry) {
    // nickname box with SUBMIT on its right
    drawPixelLine('TOP 10! ENTER NICKNAME:', W / 2, y, 1.7 * s, PAL.cream, null, null);
    y += 12 * s;
    const boxH = bh, subW = colW * 0.32, boxW = colW - subW - gap;
    nicknameBoxRect = { x: colX, y, w: boxW, h: boxH };
    ctx.fillStyle = PAL.ink; ctx.fillRect(colX, y, boxW, boxH);
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2 * s; ctx.strokeRect(colX, y, boxW, boxH);
    const caretOn = Math.floor(performance.now() / 400) % 2 === 0;
    const shown = (nicknameInput || '') + (caretOn && !nicknameSubmitted ? '_' : ' ');
    drawPixelLine(shown.replace(/[^A-Z0-9 _]/g, ''), colX + boxW / 2, y + boxH / 2, 2.4 * s, '#ffffff', null, null);
    const subR = { x: colX + boxW + gap, y, w: subW, h: boxH };
    if (live) submitBtnRect = subR;
    drawArcadeButton(subR, 'SUBMIT', { disabled: nicknameSubmitted, frame: PAL.gold, unit: 1.7 * s });
  } else {
    const rw = hugW('VIEW RANKING', 1.8 * s);
    const rr = { x: W / 2 - rw / 2, y: slotTop + slotH - bh, w: rw, h: bh };
    if (live) rankingBtnRect = rr;
    drawArcadeButton(rr, 'VIEW RANKING', { unit: 1.8 * s });
  }
  y = slotTop + slotH + 14 * s;

  // stacked actions: PLAY AGAIN above BACK TO MENU
  const stack = [['play', 'PLAY AGAIN', { frame: '#7dff8a', key: PAL.gold, text: '#ffffff', unit: 2.1 * s }],
                 ['menu', 'BACK TO MENU', { frame: PAL.coral, key: PAL.aqua, unit: 1.8 * s }]];
  for (const [id, label, opts] of stack) {
    // hug the label: text width + 10px padding each side inside the frame, centred
    const bw = hugW(label, opts.unit);
    const r = { x: W / 2 - bw / 2, y, w: bw, h: id === 'play' ? bh + 4 * s : bh };
    if (live) { if (id === 'play') playAgainBtnRect = r; else skipBtnRect = r; }
    drawArcadeButton(r, label, opts);
    y += r.h + gap;
  }
  y += 4 * s;
  const hint = nicknameSubmitted && isHighScoreEntry ? 'SUBMITTING...'
    : rankCheckDone && isHighScoreEntry ? 'ENTER = SUBMIT  /  ESC = MENU' : 'SPACE = PLAY AGAIN  /  ESC = MENU';
  drawPixelLine(hint, W / 2, y, 1.3 * s, PAL.dusk, null, null);
  ctx.globalAlpha = 1;
}

// =====================================================================
// LEADERBOARD
// =====================================================================
function drawLeaderboardScreen(t) {
  const s = SCALE, PH = PLAY_H;
  ctx.fillStyle = 'rgba(5,11,30,0.82)'; ctx.fillRect(0, 0, W, PH);

  let y = PH * 0.06;
  const plate = cached('kana|ranking', () => bakeKanaPlate('ランキング', Math.round(14 * SCALE * DPR), PAL.cobalt, PAL.cream, '#ffffff'));
  drawBaked(plate, W / 2, y, 1, true);
  y += plate.height / DPR + 2 * s;
  const title = cached('logo|ranking', () => {
    const uDev = Math.max(2, Math.round(Math.min(W * 0.8 / 45, 7 * SCALE) * DPR));
    return bakeLogoWord('RANKING', uDev, ['#ffffff', '#bffcff', '#35d6e8', '#1466c8'], '#0b2a66').canvas;
  });
  const th = title.height / DPR;
  drawBaked(title, W / 2, y + th / 2, 1);
  y += th + 10 * s;

  const tableX = W * 0.08, tableW = W * 0.84, rowH = Math.min(28 * s, (PH * 0.62) / 11);
  ctx.fillStyle = 'rgba(10,21,48,0.95)'; ctx.fillRect(tableX, y, tableW, rowH * 11);
  ctx.strokeStyle = PAL.amber; ctx.lineWidth = 2.5 * s; ctx.strokeRect(tableX, y, tableW, rowH * 11);
  ctx.fillStyle = PAL.coral; ctx.fillRect(tableX + 3 * s, y + rowH - 1 * s, tableW - 6 * s, Math.max(1, 1.5 * s));
  const colRank = tableX + 14 * s, colName = tableX + tableW * 0.3, colScore = tableX + tableW - 14 * s;
  drawPixelLine('RANK', colRank, y + rowH / 2, 1.6 * s, PAL.coral, null, null, 'left');
  drawPixelLine('NAME', colName, y + rowH / 2, 1.6 * s, PAL.coral, null, null, 'left');
  drawPixelLine('SCORE', colScore, y + rowH / 2, 1.6 * s, PAL.coral, null, null, 'right');

  if (leaderboardStatus !== 'loaded') {
    if (Math.floor(t * 3) % 2 === 0) drawPixelLine('LOADING...', W / 2, y + rowH * 3, 2 * s, PAL.cream, null, null);
  } else {
    const rows = leaderboardData.slice(0, 10);
    if (!rows.length) drawPixelLine('NO SCORES YET', W / 2, y + rowH * 3, 1.8 * s, PAL.dusk, null, null);
    const ord = ['1ST', '2ND', '3RD'];
    rows.forEach((row, i) => {
      const ry = y + rowH * (i + 1) + rowH / 2;
      const col = i === 0 ? PAL.gold : i === 1 ? '#d8e6ff' : i === 2 ? '#ff9a5c' : PAL.cream;
      const slide = clamp01((t - i * 0.04) / 0.25);
      const dx = (1 - easeOutCubic(slide)) * W * 0.3;
      if (i % 2 === 1) { ctx.fillStyle = 'rgba(127,240,255,0.05)'; ctx.fillRect(tableX + 3 * s, ry - rowH / 2, tableW - 6 * s, rowH); }
      ctx.globalAlpha = slide;
      drawPixelLine(ord[i] || (i + 1) + 'TH', colRank + dx, ry, 1.8 * s, col, PAL.ink, null, 'left');
      drawPixelLine(String(row.name).toUpperCase().slice(0, 10), colName + dx, ry, 1.8 * s, col, PAL.ink, null, 'left');
      drawPixelLine(String(row.score), colScore + dx, ry, 1.8 * s, col, PAL.ink, null, 'right');
      ctx.globalAlpha = 1;
    });
  }
  y += rowH * 11 + 18 * s;

  const bw = W * 0.62, bh = 38 * s;
  backToMenuRect = { x: W / 2 - bw / 2, y, w: bw, h: bh };
  drawArcadeButton(backToMenuRect, '[ BACK TO MENU ]', { frame: PAL.aqua, key: PAL.coral });
}

// =====================================================================
// HOW TO PLAY — three pages: controls, obstacles, points. Opens from the
// title button, and by itself the first time a player taps to start.
// =====================================================================
let howToPage = 0, howToT = 0, howToDir = 1;
const HOWTO_PAGES = ['CONTROLS', 'OBSTACLES', 'SPEED + POINTS', 'RULES'];

// Draws the real runner sprite at any spot/scale by borrowing drawPlayer() with a stand-in state.
function drawRunnerAt(cx, ground, k, pose, lift, t) {
  const saved = player;
  player = { y: -(lift || 0), vy: 0, onGround: pose !== 'jump', ducking: pose === 'duck', duckTimer: 0, squish: 0 };
  ctx.save();
  ctx.translate(cx, ground); ctx.scale(k, k); ctx.translate(-W * PLAYER_X_FRAC, -GROUND);
  drawPlayer(t);
  ctx.restore();
  player = saved;
}

// Draws one hazard exactly as in-game, fitted into a box whose floor is `ground`.
function drawHazardIcon(type, cx, ground, boxW, boxH, t) {
  const s = SCALE, w = (type === 'spike' ? SPIKE_W_BASE : HAZARD_DOUBLE_W_BASE) * s;
  let h, top;
  if (type === 'spike') { h = SPIKE_H_BASE * s; top = GROUND - h; }
  else if (type === 'lava') { h = PUDDLE_H_BASE * s; top = GROUND - h; }
  else if (type === 'bird') { h = BIRD_VIS_H_BASE * s; top = GROUND - BIRD_BOTTOM_OFFSET_BASE * s - h; }
  else { h = LONG_WALL_TOTAL_H_BASE * s; top = GROUND - LONG_WALL_BOTTOM_OFFSET_BASE * s - h; }
  const o = { type, x: 0, w, top, h, seed: 7 };
  const k = Math.min(boxW / (w + 14 * s), boxH / (GROUND - top + 8 * s), 1.5);
  ctx.fillStyle = '#141c38'; ctx.fillRect(cx - boxW / 2, ground, boxW, 5 * s);     // little strip of street
  ctx.fillStyle = '#9fb8dc'; ctx.fillRect(cx - boxW / 2, ground, boxW, Math.max(1, 1.5 * s));
  ctx.save();
  ctx.translate(cx, ground); ctx.scale(k, k); ctx.translate(-w / 2, -GROUND);
  if (type === 'spike') drawRoadSpikes(o, s);
  else if (type === 'lava') drawLivePuddle(o, s, t);
  else if (type === 'bird') drawCrowDrone(o, s, t);
  else drawShopShutter(o, s);
  ctx.restore();
}

// Chunky swipe arrow with a fingertip sliding along it.
function drawSwipeArrow(cx, y0, y1, col, t) {
  const s = SCALE, dir = Math.sign(y1 - y0), head = 12 * s, shaft = 7 * s;
  const tipY = y1, baseY = y1 - dir * head;
  ctx.fillStyle = PAL.navy;
  ctx.fillRect(cx - shaft / 2 - 2 * s, Math.min(y0, baseY) - 2 * s, shaft + 4 * s, Math.abs(baseY - y0) + 4 * s);
  ctx.beginPath(); ctx.moveTo(cx - head - 2 * s, baseY - dir * 2 * s); ctx.lineTo(cx + head + 2 * s, baseY - dir * 2 * s); ctx.lineTo(cx, tipY + dir * 3 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col;
  ctx.fillRect(cx - shaft / 2, Math.min(y0, baseY), shaft, Math.abs(baseY - y0));
  ctx.beginPath(); ctx.moveTo(cx - head, baseY); ctx.lineTo(cx + head, baseY); ctx.lineTo(cx, tipY); ctx.closePath(); ctx.fill();
  const p = (t * 1.1) % 1, fy = lerp(y0, baseY, easeOutCubic(p));
  ctx.globalAlpha = 1 - p * 0.6;
  ctx.fillStyle = PAL.cream; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.arc(cx, fy, 7 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWrapped(text, x, y, unit, maxW, fill, lineGap) {
  const lines = wrapPixelText(text, unit, maxW);
  lines.forEach((ln, i) => drawPixelLine(ln, x, y + i * (lineGap || unit * 10), unit, fill, PAL.ink, null, 'left'));
  return lines.length * (lineGap || unit * 10);
}

function drawHowToControls(px, py, pw, ph, t) {
  const s = SCALE, cardW = (pw - 30 * s) / 2, cardH = Math.min(ph * 0.5, 270 * s);
  const cards = [
    { x: px + 10 * s, head: 'SWIPE UP', col: PAL.aqua, act: 'JUMP', pose: 'jump' },
    { x: px + 20 * s + cardW, head: 'SWIPE DOWN', col: PAL.coral, act: 'DUCK', pose: 'duck' },
  ];
  for (const c of cards) {
    const cy = py + 10 * s, mid = c.x + cardW / 2;
    ctx.fillStyle = 'rgba(18,63,115,0.55)'; ctx.fillRect(c.x, cy, cardW, cardH);
    ctx.strokeStyle = c.col; ctx.lineWidth = 2 * s; ctx.strokeRect(c.x, cy, cardW, cardH);
    drawPixelLine(c.head, mid, cy + 16 * s, 1.7 * s, c.col, PAL.ink, null);
    const aTop = cy + 34 * s, aBot = cy + cardH * 0.52;
    if (c.pose === 'jump') drawSwipeArrow(mid, aBot, aTop, c.col, t);
    else drawSwipeArrow(mid, aTop, aBot, c.col, t);
    const ground = cy + cardH - 40 * s;
    ctx.fillStyle = '#141c38'; ctx.fillRect(c.x + 8 * s, ground, cardW - 16 * s, 5 * s);
    ctx.fillStyle = '#9fb8dc'; ctx.fillRect(c.x + 8 * s, ground, cardW - 16 * s, Math.max(1, 1.5 * s));
    const lift = c.pose === 'jump' ? (0.5 + 0.5 * Math.sin(t * 5)) * 22 * s : 0;
    drawRunnerAt(mid + 8 * s, ground, 1.1, c.pose, lift, t);
    drawPixelLine('= ' + c.act, mid, cy + cardH - 18 * s, 2.4 * s, PAL.gold, PAL.ink, PAL.tomato);
  }
  const u = 1.6 * s, tw = pw - 24 * s;
  const lines = [
    ['SWIPE ANYWHERE. THE MOVE FIRES AS SOON AS YOUR FINGER MOVES.', PAL.cream],
    ['HOLD YOUR FINGER DOWN AFTER SWIPING DOWN TO STAY DUCKED. LIFT IT TO STAND UP.', PAL.gold],
    ['IN THE AIR, SWIPE DOWN TO FAST-FALL BACK TO THE STREET.', PAL.aquaPale],
    ['DESKTOP: SPACE OR UP = JUMP. HOLD DOWN = DUCK.', PAL.dusk],
  ];
  const h = lines.reduce((a, [txt]) => a + wrapPixelText(txt, u, tw).length * u * 10 + 8 * s, 0);
  let y = py + cardH + 10 * s + Math.max(14 * s, (ph - cardH - 10 * s - h) / 2);
  for (const [txt, col] of lines) y += drawWrapped(txt, px + 12 * s, y, u, tw, col) + 8 * s;
}

function drawHowToObstacles(px, py, pw, ph, t) {
  const s = SCALE;
  const rows = [
    { type: 'spike', name: 'ROAD SPIKES', act: 'JUMP', col: PAL.aqua },
    { type: 'lava', name: 'LIVE PUDDLE', act: 'JUMP', col: PAL.aqua },
    { type: 'bird', name: 'CROW DRONE', act: 'DUCK OR JUMP', col: PAL.gold, extra: 'JUMP OVER IT = +8 PTS!' },
    { type: 'long_wall', name: 'SHOP SHUTTER', act: 'DUCK ONLY', col: PAL.coral },
  ];
  const rowH = Math.min((ph - 16 * s) / rows.length, 140 * s), iconW = pw * 0.34;
  rows.forEach((r, i) => {
    const ry = py + 8 * s + i * rowH;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(127,240,255,0.05)'; ctx.fillRect(px + 4 * s, ry, pw - 8 * s, rowH); }
    drawHazardIcon(r.type, px + 8 * s + iconW / 2, ry + rowH - 12 * s, iconW - 8 * s, rowH - 20 * s, t);
    const tx = px + iconW + 18 * s, mid = ry + rowH / 2 - (r.extra ? 12 * s : 6 * s);
    drawPixelLine(r.name, tx, mid, 2 * s, PAL.cream, PAL.ink, null, 'left');
    // action tag
    const tagU = 1.8 * s, tagW = pixelLineWidth(r.act, tagU, false) + 12 * s, tagH = 19 * s, tagY = mid + 14 * s;
    ctx.fillStyle = r.col; ctx.fillRect(tx, tagY, tagW, tagH);
    ctx.fillStyle = PAL.navy; ctx.fillRect(tx + 2 * s, tagY + 2 * s, tagW - 4 * s, tagH - 4 * s);
    drawPixelLine(r.act, tx + 6 * s, tagY + tagH / 2, tagU, r.col, null, null, 'left');
    if (r.extra) drawPixelLine(r.extra, tx, tagY + tagH + 13 * s, 1.5 * s, '#7dff8a', PAL.ink, null, 'left');
  });
}

// Lays blocks ({h, draw(y)}) evenly down a panel.
function spreadBlocks(blocks, py, ph) {
  const s = SCALE, total = blocks.reduce((a, b) => a + b.h, 0);
  const gap = Math.max(8 * s, Math.min(40 * s, (ph - total) / (blocks.length + 1)));
  let y = py + gap;
  for (const b of blocks) { b.draw(y); y += b.h + gap; }
}

function drawHowToPoints(px, py, pw, ph, t) {
  const s = SCALE, tx = px + 78 * s, tw = pw - 90 * s, u = 1.6 * s, lh = u * 10, fullW = pw - 24 * s;
  const textH = (text, w) => wrapPixelText(text, u, w).length * lh;
  const row = (badgeTxt, badgeCol, text, col) => ({
    h: Math.max(textH(text, tw), 28 * s),
    draw: (y) => { drawPixelLine(badgeTxt, px + 42 * s, y + 6 * s, 3 * s, badgeCol, PAL.ink, PAL.tomato); drawWrapped(text, tx, y, u, tw, col); },
  });
  const speedIntro = 'EVERY 15 SECONDS THE STREET SPEEDS UP AND EACH SECOND YOU SURVIVE IS WORTH MORE:';
  const ladderH = 62 * s;
  const judgeIntro = 'DODGE AT THE LAST MOMENT FOR A BONUS:';
  spreadBlocks([
    { h: textH(speedIntro, fullW) + 8 * s + ladderH, draw: (y) => {
      const ih = drawWrapped(speedIntro, px + 12 * s, y, u, fullW, PAL.cream);
      const cols = [PAL.aqua, PAL.gold, '#ff8a6b', '#7dff8a'], colW = (pw - 40 * s) / 4, base = y + ih + 8 * s + ladderH;
      for (let i = 0; i < 4; i++) {
        const bx = px + 20 * s + i * colW, bh2 = (18 + i * 10) * s, active = Math.floor(t * 1.2) % 4 === i;
        ctx.fillStyle = cols[i];
        ctx.fillRect(bx + 6 * s, base - bh2 - 14 * s, colW - 12 * s, bh2);
        if (active) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * s; ctx.strokeRect(bx + 5 * s, base - bh2 - 15 * s, colW - 10 * s, bh2 + 2 * s); }
        drawPixelLine('+' + LEVEL_POINTS[i] + '/S', bx + colW / 2, base - bh2 - 24 * s, 1.6 * s, '#ffffff', PAL.ink, null);
        drawPixelLine('LV' + (i + 1), bx + colW / 2, base - 5 * s, 1.4 * s, cols[i], null, null);
      }
    } },
    row('HIT', PAL.aqua, 'EVERY OBSTACLE YOU CLEAR ADDS 1 TO YOUR COMBO. EVERY 5TH HIT GETS A FANFARE!', PAL.cream),
    { h: textH(judgeIntro, fullW) + 70 * s, draw: (y) => {
      const ih = drawWrapped(judgeIntro, px + 12 * s, y, u, fullW, PAL.aquaPale);
      const keys = ['NICE', 'GREAT', 'PERFECT'], colW = (pw - 16 * s) / 3, jy = y + ih + 20 * s;
      keys.forEach((k, i) => {
        const cx = px + 8 * s + colW * (i + 0.5), art = judgeArt(k).word;
        const sc = Math.min(0.9, (colW - 8 * s) / (art.width / DPR));
        const { h } = drawBaked(art, cx, jy, sc * (1 + 0.04 * Math.sin(t * 5 + i)));
        drawPixelLine('+' + (i + 1), cx, jy + h / 2 + 12 * s, 2.2 * s, PAL.gold, PAL.navy, PAL.tomato);
      });
    } },
    row('+8', '#7dff8a', 'JUMP CLEAN OVER A CROW DRONE. IT TAKES PERFECT TIMING!', PAL.cream),
  ], py, ph);
}

function drawHowToRules(px, py, pw, ph, t) {
  const s = SCALE, tx = px + 56 * s, tw = pw - 68 * s, u = 1.7 * s, lh = u * 10;
  const rules = [
    ['ONE HIT ENDS THE RUN.', PAL.coral],
    ['THE STREET SPEEDS UP EVERY 15 SECONDS. 4 SPEED LEVELS, TOP SPEED AT 1 MINUTE.', PAL.aqua],
    ['EVERY OBSTACLE CAN BE CLEARED AT ANY SPEED. IF YOU CRASH, IT WAS THE TIMING!', '#7dff8a'],
    ['SCORE IN THE GLOBAL TOP 10 TO PUT YOUR NAME ON THE RANKING.', PAL.gold],
    ['YOUR BEST SCORE IS SAVED ON THIS DEVICE.', PAL.cream],
  ];
  spreadBlocks(rules.map(([txt, col], i) => ({
    h: Math.max(wrapPixelText(txt, u, tw).length * lh, 26 * s),
    draw: (y) => {
      const bx = px + 16 * s, bs = 24 * s;
      ctx.fillStyle = col; ctx.fillRect(bx, y - 4 * s, bs, bs);
      ctx.fillStyle = PAL.navy; ctx.fillRect(bx + 2 * s, y - 2 * s, bs - 4 * s, bs - 4 * s);
      drawPixelLine(String(i + 1), bx + bs / 2, y - 4 * s + bs / 2, 2 * s, col, null, null);
      drawWrapped(txt, tx, y, u, tw, PAL.cream);
    },
  })), py, ph);
}

function drawHowToScreen(t) {
  const s = SCALE, PH = PLAY_H;
  muteBtnRect = null; // no mute toggle here, so a tap on the header never mutes by accident
  ctx.fillStyle = 'rgba(5,11,30,0.86)'; ctx.fillRect(0, 0, W, PH);

  // header
  let y = PH * 0.04;
  const plate = cached('kana|howto', () => bakeKanaPlate('あそびかた', Math.round(13 * SCALE * DPR), PAL.tomato, PAL.cream, PAL.cream));
  drawBaked(plate, W / 2, y, 1, true);
  y += plate.height / DPR;
  const title = cached('logo|howto', () => {
    const uDev = Math.max(2, Math.round(Math.min(W * 0.82 / 68, 5.5 * SCALE) * DPR));
    return bakeLogoWord('HOW TO PLAY', uDev, ['#ffffff', '#bffcff', '#35d6e8', '#1466c8'], '#0b2a66').canvas;
  });
  const th = title.height / DPR;
  drawBaked(title, W / 2, y + th / 2, 1);
  y += th + 4 * s;

  // page name + dots
  drawPixelLine(HOWTO_PAGES[howToPage], W / 2, y + 8 * s, 2 * s, PAL.gold, PAL.ink, PAL.tomato);
  for (let i = 0; i < HOWTO_PAGES.length; i++) {
    const dx = W / 2 + (i - (HOWTO_PAGES.length - 1) / 2) * 16 * s;
    ctx.fillStyle = i === howToPage ? PAL.gold : '#2b4374';
    ctx.fillRect(dx - 4 * s, y + 22 * s, 8 * s, 8 * s);
  }
  y += 38 * s;

  // footer buttons
  const bh = 38 * s, by = PH - 14 * s - bh, bw = (W * 0.84 - 10 * s) / 2, bx = W * 0.08;
  howToBackRect = { x: bx, y: by, w: bw, h: bh };
  howToNextRect = { x: bx + bw + 10 * s, y: by, w: bw, h: bh };
  drawArcadeButton(howToBackRect, howToPage === 0 ? 'MENU' : 'BACK', { frame: PAL.aqua, key: PAL.coral, unit: 2 * s });
  drawArcadeButton(howToNextRect, howToPage === HOWTO_PAGES.length - 1 ? 'PLAY!' : 'NEXT', { unit: 2 * s });

  // panel + sliding page content
  const px = W * 0.05, pw = W * 0.9, py = y, ph = by - 12 * s - y;
  ctx.fillStyle = 'rgba(10,21,48,0.95)'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = PAL.amber; ctx.lineWidth = 2.5 * s; ctx.strokeRect(px, py, pw, ph);
  const slide = easeOutCubic(clamp01(howToT / 0.22));
  ctx.save();
  ctx.beginPath(); ctx.rect(px + 2 * s, py + 2 * s, pw - 4 * s, ph - 4 * s); ctx.clip();
  ctx.globalAlpha = slide;
  ctx.translate((1 - slide) * W * 0.2 * howToDir, 0);
  if (howToPage === 0) drawHowToControls(px, py, pw, ph, t);
  else if (howToPage === 1) drawHowToObstacles(px, py, pw, ph, t);
  else if (howToPage === 2) drawHowToPoints(px, py, pw, ph, t);
  else drawHowToRules(px, py, pw, ph, t);
  ctx.restore();
  ctx.globalAlpha = 1;
}
