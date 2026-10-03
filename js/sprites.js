'use strict';
// =====================================================================
// SPRITES — the runner and the four street hazards. Every hazard keeps
// the exact footprint + hitbox of the original game:
//   spike     -> ROAD SPIKES   (jump)
//   lava      -> LIVE PUDDLE   (jump)          downed power line in a puddle
//   bird      -> CROW DRONE    (duck or jump)
//   long_wall -> SHOP SHUTTER  (duck only)
// =====================================================================

const OUTLINE = PAL.navy;

// ---------------------------------------------------------------------
// HITBOXES (single source of truth for collision + debug drawing)
// ---------------------------------------------------------------------
function obstacleHitbox(o) {
  if (o.type === 'bird') return { x: o.x, y: o.top, w: o.w, h: o.h * BIRD_HITBOX_FRAC };
  return { x: o.x, y: o.top, w: o.w, h: o.h };
}

// Matches the body drawn in drawPlayer(); landing squish is cosmetic and excluded so the hitbox never wobbles.
function playerHitbox() {
  const cx = W * PLAYER_X_FRAC;
  const w = (player.ducking ? PLAYER_DUCK_W : PLAYER_STAND_W) * SCALE;
  const h = (player.ducking ? PLAYER_DUCK_H : PLAYER_STAND_H) * SCALE;
  const bottom = GROUND + player.y; // player.y is <=0 when airborne
  return { x: cx - w / 2, y: bottom - h, w, h };
}

// ---------------------------------------------------------------------
// RUNNER — the orange blob, now with a red hachimaki headband
// ---------------------------------------------------------------------
function drawPlayer(t) {
  const s = SCALE;
  const cx = W * PLAYER_X_FRAC;
  const squish = Math.max(0, player.squish);
  let w, h;
  if (player.ducking) { w = PLAYER_DUCK_W * s; h = PLAYER_DUCK_H * s; }
  else { w = PLAYER_STAND_W * s * (1 - squish * 0.15); h = PLAYER_STAND_H * s * (1 + squish * 0.12) - squish * 4 * s; }
  const bottom = GROUND + player.y;
  const top = bottom - h;
  const left = cx - w / 2;

  // ground shadow (shrinks while airborne)
  const air = clamp01(-player.y / (120 * s));
  ctx.fillStyle = `rgba(5,11,30,${0.45 * (1 - air * 0.6)})`;
  ctx.beginPath();
  ctx.ellipse(cx, GROUND - 1 * s, (w / 2 + 2 * s) * (1 - air * 0.5), 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // headband tails flutter behind (drawn first so the body overlaps the knot)
  const bandY = top + h * (player.ducking ? 0.22 : 0.2);
  const flap = Math.sin(t * 22) * 3 * s;
  const lift = player.onGround ? 0 : -6 * s;
  ctx.fillStyle = PAL.tomato;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s; ctx.lineJoin = 'round';
  for (const k of [0, 1]) {
    ctx.beginPath();
    ctx.moveTo(left + 2 * s, bandY + k * 3 * s);
    ctx.lineTo(left - (14 + k * 6) * s, bandY + flap * (k ? -1 : 1) + lift + (k ? 5 : -1) * s);
    ctx.lineTo(left - (12 + k * 6) * s, bandY + flap * (k ? -1 : 1) + lift + (k ? 10 : 4) * s);
    ctx.lineTo(left + 2 * s, bandY + 5 * s + k * 2 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // body
  ctx.fillStyle = '#ffb84d';
  roundRectPath(ctx, left, top, w, h, 8 * s); ctx.fill();
  ctx.save();
  roundRectPath(ctx, left, top, w, h, 8 * s); ctx.clip();
  ctx.fillStyle = '#e8902e'; ctx.fillRect(left, top + h * 0.72, w, h * 0.3);            // belly shade
  ctx.fillStyle = '#ffd89a'; ctx.fillRect(left + 4 * s, top + 3 * s, w * 0.35, 3 * s);   // shine
  // headband
  ctx.fillStyle = PAL.tomato; ctx.fillRect(left, bandY, w, 6 * s);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 3 * s, bandY + 1 * s, 6 * s, 4 * s);      // white disc
  ctx.fillStyle = PAL.tomato; ctx.fillRect(cx - 1.5 * s, bandY + 2 * s, 3 * s, 2 * s);
  ctx.restore();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5 * s;
  roundRectPath(ctx, left, top, w, h, 8 * s); ctx.stroke();

  // eyes looking ahead (to the right)
  const eyeY = bandY + 6 * s + (player.ducking ? 3 * s : 6 * s);
  const eye = Math.max(4, 6 * s);
  for (const ex of [cx + w * 0.02, cx + w * 0.3]) {
    if (blinkOn && !player.ducking) {
      ctx.fillStyle = OUTLINE; ctx.fillRect(ex - eye / 2, eyeY, eye, 2 * s);
    } else {
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - eye / 2, eyeY - eye / 2, eye, eye);
      ctx.fillStyle = '#111'; ctx.fillRect(ex, eyeY - eye * 0.25, eye * 0.5, eye * 0.5);
    }
  }
  ctx.fillStyle = 'rgba(255,90,79,0.55)';                                             // blush
  ctx.fillRect(cx + w * 0.12, eyeY + eye * 0.9, 5 * s, 2.5 * s);

  // feet
  if (!player.ducking) {
    const footW = 9 * s, footH = 6 * s;
    let liftL = 0, liftR = 0;
    if (!player.onGround) { liftL = 4 * s; liftR = 4 * s; }
    else { liftL = Math.max(0, Math.sin(stepPhase) * 3 * s); liftR = Math.max(0, Math.sin(stepPhase + Math.PI) * 3 * s); }
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(cx - w * 0.3, bottom - footH - liftL, footW, footH);
    ctx.fillRect(cx + w * 0.3 - footW, bottom - footH - liftR, footW, footH);
  } else {
    // slide streaks
    ctx.fillStyle = 'rgba(127,240,255,0.8)';
    for (let i = 0; i < 3; i++) ctx.fillRect(left - (10 + i * 7) * s, top + (6 + i * 6) * s, (8 + i * 4) * s, 2 * s);
  }
}

// ---------------------------------------------------------------------
// HAZARDS
// ---------------------------------------------------------------------
function hazardStripes(x, y, w, h, s) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = PAL.amber; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.ink;
  const step = 8 * s;
  for (let k = -h; k < w + h; k += step * 2) {
    ctx.beginPath();
    ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + step, y + h); ctx.lineTo(x + k + step + h, y); ctx.lineTo(x + k + h, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawRoadSpikes(o, s) {
  const baseH = 8 * s, n = 3, sw = o.w / n;
  const bottom = o.top + o.h;
  ctx.lineJoin = 'miter';
  const chrome = ctx.createLinearGradient(0, o.top, 0, bottom - baseH);
  chrome.addColorStop(0, '#ffffff'); chrome.addColorStop(0.5, '#c4d4f0'); chrome.addColorStop(1, '#5f7bab');
  for (let i = 0; i < n; i++) {
    const x0 = o.x + i * sw;
    ctx.beginPath();
    ctx.moveTo(x0 + 1 * s, bottom - baseH);
    ctx.lineTo(x0 + sw / 2, o.top + 1 * s);
    ctx.lineTo(x0 + sw - 1 * s, bottom - baseH);
    ctx.closePath();
    ctx.fillStyle = chrome; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';                     // glint edge
    ctx.fillRect(x0 + sw / 2 - 1 * s, o.top + 5 * s, 1.5 * s, (o.h - baseH) * 0.5);
  }
  hazardStripes(o.x, bottom - baseH, o.w, baseH, s);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s;
  ctx.strokeRect(o.x, bottom - baseH, o.w, baseH);
}

function drawLivePuddle(o, s, t) {
  const bottom = o.top + o.h, poolH = 8 * s;
  // glow
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(127,240,255,0.18)';
  ctx.fillRect(o.x - 4 * s, o.top - 4 * s, o.w + 8 * s, o.h + 6 * s);
  ctx.globalCompositeOperation = 'source-over';
  // puddle
  ctx.fillStyle = '#1466c8';
  roundRectPath(ctx, o.x, bottom - poolH, o.w, poolH, 4 * s); ctx.fill();
  ctx.fillStyle = PAL.teal; ctx.fillRect(o.x + 4 * s, bottom - poolH + 2 * s, o.w - 8 * s, 2 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(o.x + 10 * s + Math.sin(t * 3) * 4 * s, bottom - poolH + 2 * s, 8 * s, 1.5 * s);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s;
  roundRectPath(ctx, o.x, bottom - poolH, o.w, poolH, 4 * s); ctx.stroke();
  // downed cable snaking into the water
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(o.x + o.w - 6 * s, o.top); ctx.quadraticCurveTo(o.x + o.w + 4 * s, o.top + o.h * 0.6, o.x + o.w * 0.7, bottom - poolH / 2); ctx.stroke();
  ctx.lineCap = 'butt';
  // crackling arcs — re-rolled every few frames
  const frame = Math.floor(t * 16) + (o.seed || 0);
  const rnd = seededRandom(frame * 7919 + 1);
  for (let b = 0; b < 3; b++) {
    const x = o.x + o.w * (0.18 + b * 0.32) + (rnd() - 0.5) * 8 * s;
    const pts = [[x, bottom - poolH]];
    const segs = 4;
    for (let k = 1; k <= segs; k++) pts.push([x + (rnd() - 0.5) * 14 * s, bottom - poolH - (o.h - poolH) * (k / segs)]);
    for (const [col, lw] of [[PAL.aqua, 4 * s], ['#ffffff', 1.5 * s]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
  }
  ctx.fillStyle = PAL.gold;
  for (let k = 0; k < 4; k++) ctx.fillRect(o.x + rnd() * o.w, o.top + rnd() * (o.h - poolH), 2 * s, 2 * s);
}

function drawCrowDrone(o, s, t) {
  const cx = o.x + o.w / 2, visH = o.h * BIRD_HITBOX_FRAC;
  const cy = o.top + visH * 0.58;
  const flap = Math.sin(t * 14 + (o.seed || 0));
  ctx.lineJoin = 'round';
  // wings
  for (const dir of [-1, 1]) {
    const tipX = cx + dir * (o.w / 2 - 1 * s);
    const tipY = cy - flap * visH * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 6 * s, cy - 4 * s);
    ctx.lineTo(cx + dir * o.w * 0.28, cy - 6 * s - flap * visH * 0.2);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(cx + dir * o.w * 0.3, cy + 4 * s - flap * visH * 0.1);
    ctx.lineTo(cx + dir * 6 * s, cy + 5 * s);
    ctx.closePath();
    ctx.fillStyle = '#1c2442'; ctx.fill();
    ctx.strokeStyle = PAL.aqua; ctx.lineWidth = 4 * s; ctx.stroke();        // neon rim so it reads against the city
    ctx.fillStyle = '#1c2442'; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * s; ctx.stroke();
    ctx.strokeStyle = 'rgba(127,240,255,0.55)'; ctx.lineWidth = 1 * s;     // feather sheen
    ctx.beginPath(); ctx.moveTo(cx + dir * 10 * s, cy - 2 * s); ctx.lineTo(tipX - dir * 6 * s, tipY + 3 * s); ctx.stroke();
  }
  // body
  ctx.strokeStyle = PAL.aqua; ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.ellipse(cx, cy, 13 * s, 9 * s, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - 11 * s, cy - 4 * s, 7 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#141a2e'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * s;
  ctx.beginPath(); ctx.ellipse(cx, cy, 13 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // head + beak facing the runner (left)
  ctx.beginPath(); ctx.arc(cx - 11 * s, cy - 4 * s, 7 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.amber;
  ctx.beginPath(); ctx.moveTo(cx - 16 * s, cy - 6 * s); ctx.lineTo(cx - 26 * s, cy - 2 * s); ctx.lineTo(cx - 16 * s, cy); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * s; ctx.stroke();
  // glowing visor eye
  ctx.fillStyle = PAL.coral; ctx.fillRect(cx - 15 * s, cy - 8 * s, 6 * s, 3 * s);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 14 * s, cy - 7.5 * s, 2 * s, 1.5 * s);
  // rotor
  const blade = Math.abs(Math.cos(t * 40)) * 14 * s + 3 * s;
  ctx.fillStyle = '#5f7bab'; ctx.fillRect(cx - 1 * s, cy - 15 * s, 2 * s, 6 * s);
  ctx.fillStyle = '#c4d4f0'; ctx.fillRect(cx - blade, cy - 16 * s, blade * 2, 2 * s);
  // blinking tail LED
  if (Math.sin(t * 8) > 0) { ctx.fillStyle = PAL.gold; ctx.fillRect(cx + 12 * s, cy - 1 * s, 3 * s, 3 * s); }
}

function drawShopShutter(o, s) {
  const bottom = o.top + o.h, rail = 5 * s;
  // corrugated steel
  ctx.fillStyle = '#8fa3c4'; ctx.fillRect(o.x, o.top, o.w, o.h);
  const rib = 6 * s;
  for (let y = o.top; y < bottom - 12 * s; y += rib) {
    ctx.fillStyle = '#c8d6ee'; ctx.fillRect(o.x, y, o.w, Math.max(1, 1.5 * s));
    ctx.fillStyle = '#5f7bab'; ctx.fillRect(o.x, y + rib - 2 * s, o.w, Math.max(1, 1.5 * s));
  }
  // spray-paint tag
  const tagY = bottom - 70 * s;
  ctx.fillStyle = 'rgba(255,90,79,0.85)';
  forEachGlyphPixel('SR', (px, py) => ctx.fillRect(o.x + 16 * s + px * 3 * s + py * 0.6 * s, tagY + py * 3 * s, 3 * s, 3 * s));
  // closed-today notice
  const note = cached('kana|teikyu', () => bakeKanaPlate('定休日', Math.round(9 * SCALE * DPR), PAL.cream, PAL.tomato, PAL.tomato));
  drawBaked(note, o.x + o.w / 2, bottom - 38 * s);
  // bottom bar + handle + hazard edge
  ctx.fillStyle = '#3b4f7a'; ctx.fillRect(o.x, bottom - 14 * s, o.w, 9 * s);
  ctx.fillStyle = '#c8d6ee'; ctx.fillRect(o.x + o.w / 2 - 8 * s, bottom - 11 * s, 16 * s, 3 * s);
  hazardStripes(o.x, bottom - 5 * s, o.w, 5 * s, s);
  // rails + outline
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(o.x, o.top, rail, o.h); ctx.fillRect(o.x + o.w - rail, o.top, rail, o.h);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s; ctx.strokeRect(o.x, o.top, o.w, o.h);
}

function drawObstacles(t) {
  const s = SCALE;
  for (const o of obstacles) {
    if (o.type === 'spike') drawRoadSpikes(o, s);
    else if (o.type === 'lava') drawLivePuddle(o, s, t);
    else if (o.type === 'bird') drawCrowDrone(o, s, t);
    else drawShopShutter(o, s);
  }
}

function drawDebugHitboxes() {
  if (!DEBUG_HITBOXES) return;
  ctx.save();
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = Math.max(1, SCALE);
  const p = playerHitbox();
  ctx.strokeRect(p.x, p.y, p.w, p.h);
  for (const o of obstacles) { const b = obstacleHitbox(o); ctx.strokeRect(b.x, b.y, b.w, b.h); }
  ctx.restore();
}
