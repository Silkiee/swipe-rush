'use strict';
// =====================================================================
// FX — particles, judgement callouts (NICE / GREAT / PERFECT!!),
// combo counter animation, screen shake and flashes.
// =====================================================================

let particles = [];
let callouts = [];          // floating baked words
let shakeT = 0, shakeDur = 0, shakeAmp = 0;
let flashT = 0, flashDur = 0, flashColor = '255,248,230';

// combo display state
const comboFx = { count: 0, max: 0, popT: 99, milestone: false, burst: [] };

function resetFx() {
  particles = []; callouts = [];
  shakeT = 0; flashT = 0;
  comboFx.count = 0; comboFx.max = 0; comboFx.popT = 99; comboFx.milestone = false; comboFx.burst = [];
}

function addShake(amp, dur) {
  if (amp >= shakeAmp * (shakeT / Math.max(0.001, shakeDur))) { shakeAmp = amp; shakeDur = dur; shakeT = dur; }
}
function shakeOffset() {
  if (shakeT <= 0) return [0, 0];
  const a = shakeAmp * (shakeT / shakeDur);
  return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a];
}
function screenFlash(rgb, dur) { flashColor = rgb; flashDur = dur; flashT = dur; }

// ---------------------------------------------------------------------
// PARTICLES
// ---------------------------------------------------------------------
function spawnDust(n) {
  const px = runnerX();
  for (let i = 0; i < n; i++) {
    particles.push({
      x: px - 6 * SCALE + (Math.random() - 0.5) * 10 * SCALE, y: GROUND - 4 * SCALE,
      vx: -60 * SCALE - Math.random() * 60 * SCALE, vy: -Math.random() * 40 * SCALE,
      life: 0.35 + Math.random() * 0.2, maxLife: 0.5,
      size: (2 + Math.random() * 2) * SCALE, color: PAL.cream,
    });
  }
}

function spawnBurst(x, y, n, colors, speed, grav) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (speed * 0.35 + Math.random() * speed) * SCALE;
    particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - (grav ? 60 * SCALE : 0),
      life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
      size: (2 + Math.random() * 3) * SCALE, color: pick(colors), grav,
    });
  }
}

function spawnDeathDebris(x, y) {
  spawnBurst(x, y, 40, ['#ffb84d', PAL.tomato, PAL.gold, PAL.cream, PAL.aqua], 260, true);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.grav) p.vy += 900 * SCALE * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------
// BAKED CALLOUT ART
// ---------------------------------------------------------------------
const JUDGE_STYLE = {
  NICE:    { word: 'NICE!',     kana: 'ナイス!',       stops: ['#ffffff', '#bffcff', '#35d6e8', '#1466c8'], extrude: '#0b2a66', kanaStops: ['#ffffff', '#bffcff'] },
  GREAT:   { word: 'GREAT!!',   kana: 'グレート!!',    stops: ['#fff8e6', '#ffe14d', '#ffb02e', '#ff7a2f'], extrude: '#7a3a0c', kanaStops: ['#ffffff', '#ffe14d'] },
  PERFECT: { word: 'PERFECT!!', kana: 'パーフェクト!!', stops: ['#ffffff', '#7ff0ff', '#7dff8a', '#ffe14d', '#ff5a4f'], extrude: '#7a1420', kanaStops: ['#ffffff', '#ffe14d', '#ff8a6b'] },
  OVER:    { word: 'JUMP OVER!!', kana: '飛び越え!!', stops: ['#ffffff', '#ffe14d', '#7dff8a', '#7ff0ff', '#35d6e8'], extrude: '#0b2a66', kanaStops: ['#ffffff', '#7dff8a', '#ffe14d'] },
};

function judgeArt(key) {
  const st = JUDGE_STYLE[key];
  return cached('judge|' + key, () => {
    const uDev = Math.max(2, Math.round(Math.min(5.2 * SCALE, W * 0.62 / (pixelTextWidth(st.word) + 4)) * DPR));
    return {
      word: bakeLogoWord(st.word, uDev, st.stops, st.extrude).canvas,
      kana: bakeKanaText(st.kana, Math.round(15 * SCALE * DPR), st.kanaStops, PAL.coral),
    };
  });
}

// Big combo numbers; cached per string so each number is only baked once per size.
function comboNumberArt(n) {
  return cached('combo|' + n, () => {
    const uDev = Math.max(2, Math.round(5.5 * SCALE * DPR));
    return bakeLogoWord(String(n), uDev, ['#fff8e6', '#ffe14d', '#ff7a2f', '#e8283c'], '#7a1420').canvas;
  });
}
function comboRainbowArt(n) {
  return cached('comboR|' + n, () => {
    const uDev = Math.max(2, Math.round(5.5 * SCALE * DPR));
    return bakeLogoWord(String(n), uDev, ['#ffffff', '#7ff0ff', '#7dff8a', '#ffe14d', '#ff5a4f'], '#0b2a66').canvas;
  });
}

// ---------------------------------------------------------------------
// CALLOUTS
// ---------------------------------------------------------------------
// kind 'judge': NICE/GREAT/PERFECT with katakana + bonus; kind 'banner': free kana/word art.
function showJudgement(key, bonus) {
  callouts = callouts.filter((c) => c.kind !== 'judge');
  callouts.push({ kind: 'judge', key, bonus, t: 0, life: 0.95, x: W * 0.55, y: PLAY_H * 0.36 });
  if (key === 'PERFECT') spawnBurst(W * 0.55, PLAY_H * 0.36, 18, [PAL.white, PAL.aqua, PAL.gold, PAL.coral], 220, false);
  if (key === 'OVER') { spawnBurst(W * 0.55, PLAY_H * 0.36, 26, [PAL.white, PAL.gold, '#7dff8a', PAL.aqua], 260, false); screenFlash('255,225,77', 0.14); }
}

function showBanner(art, sub, x, y, life) {
  callouts.push({ kind: 'banner', art, sub, t: 0, life: life || 1.3, x, y });
}

function bumpCombo(n) {
  comboFx.count = n;
  comboFx.max = Math.max(comboFx.max, n);
  comboFx.popT = 0;
  comboFx.milestone = n % 5 === 0;
  if (comboFx.milestone) {
    addShake(5 * SCALE, 0.25);
    screenFlash('255,225,77', 0.18);
    comboFx.burst = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      comboFx.burst.push({ a, d: 0, spd: (140 + Math.random() * 80) * SCALE, col: pick([PAL.gold, PAL.aqua, PAL.coral, PAL.white]) });
    }
    if (n % 10 === 0) {
      const word = n % 50 === 0 ? '伝説!!' : n % 30 === 0 ? '最高!!' : n % 20 === 0 ? 'すごい!!' : 'いいね!!';
      const art = cached('mile|' + word, () => bakeKanaText(word, Math.round(30 * SCALE * DPR), ['#ffffff', '#ffe14d', '#ff7a2f'], PAL.coral));
      showBanner(art, n + ' COMBO', W * 0.5, PLAY_H * 0.55, 1.4);
    }
  }
}

function updateFx(dt) {
  updateParticles(dt);
  if (shakeT > 0) shakeT -= dt;
  if (flashT > 0) flashT -= dt;
  comboFx.popT += dt;
  for (const b of comboFx.burst) b.d += b.spd * dt;
  for (let i = callouts.length - 1; i >= 0; i--) {
    callouts[i].t += dt;
    if (callouts[i].t >= callouts[i].life) callouts.splice(i, 1);
  }
}

function calloutTransform(c) {
  const pIn = clamp01(c.t / 0.16);
  const out = clamp01((c.t - c.life * 0.65) / (c.life * 0.35));
  const scale = c.t < 0.16 ? lerp(1.9, 1, easeOutBack(pIn)) : 1;
  return { scale, alpha: 1 - out, rise: -out * 22 * SCALE - c.t * 8 * SCALE };
}

function drawCallouts() {
  for (const c of callouts) {
    const { scale, alpha, rise } = calloutTransform(c);
    ctx.globalAlpha = alpha;
    if (c.kind === 'judge') {
      const art = judgeArt(c.key);
      const wob = (c.key === 'PERFECT' || c.key === 'OVER') ?Math.sin(c.t * 40) * 1.5 * SCALE * (1 - clamp01(c.t / 0.4)) : 0;
      const { h } = drawBaked(art.word, c.x + wob, c.y + rise, scale);
      const kn = drawBaked(art.kana, c.x - 8 * SCALE, c.y + rise + h * 0.5 + 6 * SCALE, scale * 0.9, true);
      if (c.bonus) drawPixelLine('+' + c.bonus, c.x + kn.w * 0.5 + 6 * SCALE, c.y + rise + h * 0.5 + 6 * SCALE + kn.h * 0.5, 2.4 * SCALE, PAL.gold, PAL.navy, PAL.tomato, 'left');
    } else {
      const { h } = drawBaked(c.art, c.x, c.y + rise, scale);
      if (c.sub) drawPixelLine(c.sub, c.x, c.y + rise + h * 0.55 + 6 * SCALE, 2.2 * SCALE, PAL.cream, PAL.navy, PAL.tomato);
    }
  }
  ctx.globalAlpha = 1;
}

function drawFlash(height) {
  if (flashT <= 0) return;
  ctx.fillStyle = `rgba(${flashColor},${0.55 * (flashT / flashDur)})`;
  ctx.fillRect(0, 0, W, height);
}
