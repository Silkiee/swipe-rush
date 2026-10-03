'use strict';
// =====================================================================
// SCREENS — title, in-game HUD + combo counter, game over, leaderboard,
// ad banner and the shared arcade button / mute toggle.
// =====================================================================

let leaderboardBtnRect = null, backToMenuRect = null;
let submitBtnRect = null, skipBtnRect = null, nicknameBoxRect = null;
let muteBtnRect = null;

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
// TITLE SCREEN — city-pop sunset over a rushing checkerboard
// =====================================================================
function getTitleCache() {
  return cached('title', () => {
    const uDev = Math.max(2, Math.round(Math.min(W * 0.84 / 31, PLAY_H * 0.30 / 16.5) * DPR));
    return {
      uDev, u: uDev / DPR,
      swipe: bakeLogoWord('SWIPE', uDev, ['#ffffff', '#bffcff', '#35d6e8', '#1466c8'], '#0b2a66'),
      rush: bakeLogoWord('RUSH!!', uDev, ['#fff8e6', '#ffe14d', '#ff7a2f', '#e8283c'], '#7a1420'),
      kata: bakeKanaPlate('スワイプ・ラッシュ', Math.round(17 * SCALE * DPR), PAL.tomato, PAL.cream, '#ffffff'),
      sun: bakeSun(Math.round(W * 0.30 * DPR)),
      stars: (() => { const r = seededRandom(7), a = []; for (let i = 0; i < 38; i++) a.push({ x: r(), y: r(), ph: r() * 6.28, big: r() < 0.25 }); return a; })(),
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

// Checkerboard floor rushing toward the viewer, fading into the horizon haze.
function drawTitleFloor(yH, PH, t) {
  const cx = W / 2, depthPx = PH - yH, tileW = W / 5;
  const travel = t * 3.2, frac = travel % 1, flip = Math.floor(travel) % 2;
  const yAt = (z) => yH + depthPx / z;
  ctx.fillStyle = '#0d2a5c';
  ctx.fillRect(0, yH, W, depthPx + 20);
  ctx.fillStyle = '#1d5fa8';
  ctx.beginPath();
  for (let k = 0; k < 18; k++) {
    const zA = 0.55 + k - frac, zB = zA + 1;
    if (zA <= 0.05) continue;
    const yA = yAt(zA), yB = yAt(zB);
    const span = Math.ceil((W / 2) * zB / tileW) + 1;
    for (let j = -span; j < span; j++) {
      if (((k + j + flip) & 1) !== 0) continue;
      ctx.moveTo(cx + j * tileW / zA, yA);
      ctx.lineTo(cx + (j + 1) * tileW / zA, yA);
      ctx.lineTo(cx + (j + 1) * tileW / zB, yB);
      ctx.lineTo(cx + j * tileW / zB, yB);
      ctx.closePath();
    }
  }
  ctx.fill();
  const haze = ctx.createLinearGradient(0, yH, 0, yH + depthPx * 0.45);
  haze.addColorStop(0, 'rgba(255,170,120,0.85)'); haze.addColorStop(1, 'rgba(255,170,120,0)');
  ctx.fillStyle = haze; ctx.fillRect(0, yH, W, depthPx * 0.45);
  ctx.fillStyle = PAL.cream;
  ctx.fillRect(0, yH - Math.max(1, SCALE), W, Math.max(2, 2 * SCALE));
}

// The runner sprinting in place, with motion streaks and kicked-up dust.
function drawTitleMascot(cx, groundY, t) {
  const s = SCALE;
  const run = t * 14;
  const bounce = Math.abs(Math.sin(run)) * 4 * s;
  const w = 34 * s, h = 38 * s;
  const top = groundY - h - 4 * s - bounce;
  const left = cx - w / 2;
  ctx.fillStyle = 'rgba(5,11,30,0.5)';
  ctx.beginPath(); ctx.ellipse(cx, groundY + 1 * s, (22 - bounce / s) * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PAL.aqua;
  for (let i = 0; i < 3; i++) {
    const len = (16 + 10 * i + Math.sin(run + i) * 6) * s;
    ctx.fillRect(left - 8 * s - len, top + (10 + i * 9) * s, len, Math.max(1, 3 * s));
  }
  ctx.fillStyle = 'rgba(255,243,214,0.85)';
  for (let i = 0; i < 3; i++) {
    const ph = ((t * 2.2 + i / 3) % 1), sz = (6 - ph * 5) * s;
    ctx.fillRect(left - 6 * s - ph * 40 * s, groundY - 4 * s - ph * 10 * s - sz, sz, sz);
  }
  ctx.save();
  ctx.translate(cx, groundY - 4 * s - bounce);
  ctx.rotate(0.12);
  // headband tails
  const flap = Math.sin(t * 22) * 3 * s;
  ctx.fillStyle = PAL.tomato; ctx.strokeStyle = PAL.navy; ctx.lineWidth = 2 * s; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-w / 2 + 2 * s, -h * 0.8); ctx.lineTo(-w / 2 - 16 * s, -h * 0.82 + flap); ctx.lineTo(-w / 2 - 14 * s, -h * 0.68 + flap); ctx.lineTo(-w / 2 + 2 * s, -h * 0.66); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb84d';
  roundRectPath(ctx, -w / 2, -h, w, h, 8 * s); ctx.fill();
  ctx.fillStyle = PAL.tomato; ctx.fillRect(-w / 2, -h * 0.82, w, 6 * s);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-3 * s, -h * 0.82 + 1 * s, 6 * s, 4 * s);
  ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 2 * s;
  ctx.strokeStyle = PAL.navy; roundRectPath(ctx, -w / 2, -h, w, h, 8 * s); ctx.stroke();
  const eye = Math.max(4, 6 * s);
  for (const ex of [-w * 0.08, w * 0.26]) {
    ctx.fillStyle = '#fff'; ctx.fillRect(ex - eye / 2, -h * 0.5 - eye / 2, eye, eye);
    ctx.fillStyle = '#111'; ctx.fillRect(ex, -h * 0.5 - eye * 0.25, eye * 0.5, eye * 0.5);
  }
  ctx.restore();
  const footW = 9 * s, footH = 6 * s, stride = 7 * s;
  ctx.fillStyle = PAL.navy;
  ctx.fillRect(cx - footW / 2 + Math.sin(run) * stride, groundY - footH - Math.max(0, Math.cos(run)) * 4 * s, footW, footH);
  ctx.fillRect(cx - footW / 2 - Math.sin(run) * stride, groundY - footH - Math.max(0, -Math.cos(run)) * 4 * s, footW, footH);
}

const TITLE_INTRO_DONE = 1.2; // seconds until the intro has fully settled
let titleT0 = performance.now();
let titleLastT = titleT0;
let titleSlamPlayed = false;
let titleSpeedLines = [];

function startTitleIntro() { titleT0 = performance.now(); titleSlamPlayed = false; }
function titleIntroActive() { return state === 'START_MENU' && (performance.now() - titleT0) / 1000 < TITLE_INTRO_DONE; }
function skipTitleIntro() { titleT0 = performance.now() - TITLE_INTRO_DONE * 1000; titleSlamPlayed = true; }

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
  const horizon = Math.max(subY + 40 * S, PH * 0.6);

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

  // sunset sky + stars
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#081433'); sky.addColorStop(0.45, '#123f73');
  sky.addColorStop(0.78, '#e8796a'); sky.addColorStop(1, '#ffd59a');
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, horizon + 20);
  for (const st of tc.stars) {
    const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + st.ph);
    ctx.fillStyle = `rgba(255,248,230,${0.25 + tw * 0.75})`;
    const sz = Math.max(1, Math.round((st.big ? 2 : 1) * S));
    ctx.fillRect(Math.round(st.x * W), Math.round(st.y * horizon * 0.5), sz, sz);
  }

  // setting sun behind Mt. Fuji
  const pulse = 1 + Math.sin(t * 2) * 0.015, sunR = W * 0.30;
  const sw = tc.sun.width / DPR * pulse, sh = tc.sun.height / DPR * pulse;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tc.sun, W / 2 - sw / 2, horizon - sunR * 0.55 - sh / 2, sw, sh);
  ctx.imageSmoothingEnabled = false;
  drawFuji(W / 2, horizon, W * 0.26, W * 0.62);
  drawTitleFloor(horizon, PH, t);

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

  const footY = PH - 12 * S;
  const btnH = 38 * S, btnW = W * 0.64;
  const btnX = W / 2 - btnW / 2, btnY = footY - 18 * S - btnH;
  const c3 = btnY - 18 * S, c2 = c3 - 17 * S, c1 = c2 - 17 * S;
  const gapTop = Math.max(subY + 34 * S, horizon + 8 * S), gap = c1 - 14 * S - gapTop;
  let tapY = gapTop + gap / 2;
  if (gap > 120 * S) {
    const mascotGround = gapTop + gap * 0.52;
    drawTitleMascot(W / 2, mascotGround, t);
    tapY = mascotGround + (gap * 0.48) / 2 + 2 * S;
  }
  if ((t % 1.0) < 0.68) {
    const hop = Math.abs(Math.sin(t * Math.PI * 2)) * -3 * S;
    drawPixelLine('TAP TO START', W / 2, tapY + hop, 3 * S, '#ffffff', NAVY, PAL.coral);
  }
  drawPixelLine('SWIPE UP = JUMP', W / 2, c1, small, PAL.cream, NAVY, null);
  drawPixelLine('SWIPE DOWN = DUCK / FAST-FALL', W / 2, c2, small, PAL.cream, NAVY, null);
  drawPixelLine('(DESKTOP: SPACE + ARROW KEYS)', W / 2, c3, small * 0.9, PAL.aqua, NAVY, null);

  leaderboardBtnRect = uiAlpha > 0.5 ? { x: btnX, y: btnY, w: btnW, h: btnH } : null;
  drawArcadeButton({ x: btnX, y: btnY, w: btnW, h: btnH }, '[ LEADERBOARD ]', { unit: mid });
  drawPixelLine('(C) 2026 SILKIEE', W / 2, footY, small * 0.85, PAL.dusk, null, null);
  drawMuteButton(W - 38 * S, 10 * S);
  ctx.globalAlpha = 1;

  if (flash > 0) { ctx.fillStyle = `rgba(255,248,230,${flash * 0.75})`; ctx.fillRect(-20, -20, W + 40, PH + 40); }
  ctx.restore();
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

  // HI-SCORE
  const hiX = W * 0.47;
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

  if (!isHighScoreEntry) {
    if (Math.floor(t * 3) % 2 === 0) drawPixelLine('LOADING RANKING...', W / 2, y + 6 * s, 1.6 * s, PAL.dusk, null, null);
    submitBtnRect = skipBtnRect = nicknameBoxRect = null;
    ctx.globalAlpha = 1;
    return;
  }

  // nickname entry
  drawPixelLine('TOP 10! ENTER NICKNAME:', W / 2, y, 1.7 * s, PAL.cream, null, null);
  y += 12 * s;
  const boxW = W * 0.6, boxH = 34 * s, boxX = W / 2 - boxW / 2;
  nicknameBoxRect = { x: boxX, y, w: boxW, h: boxH };
  ctx.fillStyle = PAL.ink; ctx.fillRect(boxX, y, boxW, boxH);
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2 * s; ctx.strokeRect(boxX, y, boxW, boxH);
  const caretOn = Math.floor(performance.now() / 400) % 2 === 0;
  const shown = (nicknameInput || '') + (caretOn && !nicknameSubmitted ? '_' : ' ');
  drawPixelLine(shown.replace(/[^A-Z0-9 _]/g, ''), W / 2, y + boxH / 2, 2.4 * s, '#ffffff', null, null);
  y += boxH + 12 * s;

  const gap = 10 * s, pairW = W * 0.72, bh = 36 * s;
  const sw = pairW * 0.44, kw = pairW - sw - gap, bx = W / 2 - pairW / 2;
  submitBtnRect = { x: bx, y, w: sw, h: bh };
  skipBtnRect = { x: bx + sw + gap, y, w: kw, h: bh };
  drawArcadeButton(submitBtnRect, 'SUBMIT', { disabled: nicknameSubmitted, frame: PAL.gold, unit: 1.8 * s });
  drawArcadeButton(skipBtnRect, 'SKIP TO MENU', { frame: PAL.coral, key: PAL.aqua, unit: 1.6 * s });
  y += bh + 14 * s;
  drawPixelLine(nicknameSubmitted ? 'SUBMITTING...' : 'TAP BUTTONS OR USE ENTER / ESC', W / 2, y, 1.3 * s, PAL.dusk, null, null);
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
