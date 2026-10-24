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

// Covers the runner's body plus its feet (drawMascot); the run bounce and landing squish are
// cosmetic and excluded so the hitbox never wobbles.
function playerHitbox() {
  const cx = runnerX();
  const w = (player.ducking ? PLAYER_DUCK_W : PLAYER_STAND_W) * SCALE;
  const h = (player.ducking ? PLAYER_DUCK_H : PLAYER_STAND_H) * SCALE;
  const bottom = GROUND + player.y; // player.y is <=0 when airborne
  return { x: cx - w / 2, y: bottom - h, w, h };
}

// ---------------------------------------------------------------------
// RUNNER — the orange blob with a red hachimaki headband. One drawing for
// the title, the countdown glide, the run and the How to Play cards.
// ---------------------------------------------------------------------
const RUN_CADENCE = 14;  // stride speed (radians per second of the run cycle)
const MASCOT_LEAN = 0.12; // forward lean while standing / running / jumping
const FOOT_GAP = 4;      // the body floats this far above the feet line; the feet fill the gap

// cx: centre x; ground: street line; y: height offset (<=0 airborne); t: seconds (absolute time,
// so the run cycle carries on unbroken from the title into the run).
// o: { onGround, ducking, squish }
function drawMascot(cx, ground, y, t, o) {
  const s = SCALE, run = t * RUN_CADENCE, bottom = ground + y;
  const running = o.onGround && !o.ducking;
  const bounce = running ? Math.abs(Math.sin(run)) * 4 * s : 0;
  const squish = Math.max(0, o.squish || 0);
  const air = clamp01(-y / (120 * s));
  const standW = PLAYER_STAND_W * s;

  // ground shadow (shrinks while airborne and at the top of each bounce)
  ctx.fillStyle = `rgba(5,11,30,${0.5 * (1 - air * 0.6)})`;
  ctx.beginPath();
  ctx.ellipse(cx, ground + 1 * s, Math.max(4 * s, (standW / 2 + 5 * s - bounce) * (1 - air * 0.5)), 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // kicked-up dust behind the feet while running
  if (running) {
    ctx.fillStyle = 'rgba(255,243,214,0.85)';
    for (let i = 0; i < 3; i++) {
      const ph = ((t * 2.2 + i / 3) % 1), sz = (6 - ph * 5) * s;
      ctx.fillRect(cx - standW / 2 - 6 * s - ph * 40 * s, bottom - 4 * s - ph * 10 * s - sz, sz, sz);
    }
  }

  if (o.ducking) { drawMascotDuck(cx, bottom, t); return; }

  // body (leaning forward, pivoting on the feet line)
  const w = standW * (1 - squish * 0.15);
  const h = (PLAYER_STAND_H - FOOT_GAP) * s * (1 + squish * 0.12) - squish * 4 * s;
  ctx.save();
  ctx.translate(cx, bottom - FOOT_GAP * s - bounce);
  ctx.rotate(MASCOT_LEAN);
  drawMascotBody(w, h, t, o.onGround ? 0 : -6 * s, 0.5);
  ctx.restore();

  // feet: wide stride on the street, tucked together in the air
  const footW = 9 * s, footH = 6 * s;
  ctx.fillStyle = OUTLINE;
  if (o.onGround) {
    const stride = 7 * s;
    ctx.fillRect(cx - footW / 2 + Math.sin(run) * stride, bottom - footH - Math.max(0, Math.cos(run)) * 4 * s, footW, footH);
    ctx.fillRect(cx - footW / 2 - Math.sin(run) * stride, bottom - footH - Math.max(0, -Math.cos(run)) * 4 * s, footW, footH);
  } else {
    ctx.fillRect(cx - footW / 2 - 5 * s, bottom - footH - 1 * s, footW, footH);
    ctx.fillRect(cx - footW / 2 + 4 * s, bottom - footH - 2 * s, footW, footH);
  }
}

// Body, headband, tail and eyes, drawn with its base centred on the current origin.
// tailLift raises the tail (airborne); eyeY is the eye line as a fraction of the height.
function drawMascotBody(w, h, t, tailLift, eyeY) {
  const s = SCALE;
  const flap = Math.sin(t * 22) * 3 * s + tailLift;
  ctx.fillStyle = PAL.tomato; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2 * s, -h * 0.8);
  ctx.lineTo(-w / 2 - 16 * s, -h * 0.82 + flap);
  ctx.lineTo(-w / 2 - 14 * s, -h * 0.68 + flap);
  ctx.lineTo(-w / 2 + 2 * s, -h * 0.66);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb84d';
  roundRectPath(ctx, -w / 2, -h, w, h, 8 * s); ctx.fill();
  const bandY = -h * 0.82;
  ctx.fillStyle = PAL.tomato; ctx.fillRect(-w / 2, bandY, w, 6 * s);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-3 * s, bandY + 1 * s, 6 * s, 4 * s);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s;
  roundRectPath(ctx, -w / 2, -h, w, h, 8 * s); ctx.stroke();
  const eye = Math.max(4, 6 * s), ey = -h * eyeY;
  for (const ex of [-w * 0.08, w * 0.26]) {
    ctx.fillStyle = '#fff'; ctx.fillRect(ex - eye / 2, ey - eye / 2, eye, eye);
    ctx.fillStyle = '#111'; ctx.fillRect(ex, ey - eye * 0.25, eye * 0.5, eye * 0.5);
  }
}

// Duck / fast-fall: the same body squashed flat into a slide, with streaks trailing behind.
function drawMascotDuck(cx, bottom, t) {
  const s = SCALE, w = PLAYER_DUCK_W * s, h = PLAYER_DUCK_H * s;
  ctx.fillStyle = 'rgba(127,240,255,0.8)';
  for (let i = 0; i < 3; i++) ctx.fillRect(cx - w / 2 - (10 + i * 7) * s, bottom - h + (6 + i * 6) * s, (8 + i * 4) * s, 2 * s);
  ctx.save();
  ctx.translate(cx, bottom);
  drawMascotBody(w, h, t, 2 * s, 0.38);
  ctx.restore();
}

function drawPlayer(t) {
  drawMascot(runnerX(), GROUND, player.y, t, player);
}

// ---------------------------------------------------------------------
// HAZARDS — foreground styling: warm reds/golds against the cool, dimmed city, a cream rim
// light around every silhouette and a contact shadow on the street, so they never read as
// scenery. Footprints and hitboxes are unchanged.
// ---------------------------------------------------------------------
const HAZ = {
  rim: PAL.cream, hot: '#ff8a6b', red: PAL.coral, deep: PAL.tomato, dark: '#8e1424',
  gold: PAL.gold, amber: PAL.amber,
};

// Contact shadow on the street — ties a hazard to the runner's lane.
function hazardShadow(cx, halfW, s) {
  ctx.fillStyle = 'rgba(5,11,30,0.6)';
  ctx.beginPath();
  ctx.ellipse(cx, GROUND - 2 * s, halfW, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Cream rim: a wide stroke drawn BEFORE the fill, so only the outer half shows as a halo.
function rimStroke(pathFn, s, width) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = HAZ.rim; ctx.lineWidth = (width || 6) * s;
  pathFn(); ctx.stroke();
  ctx.restore();
}

function hazardStripes(x, y, w, h, s) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = PAL.gold; ctx.fillRect(x, y, w, h);
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
  const cone = (i) => {
    const x0 = o.x + i * sw;
    ctx.beginPath();
    ctx.moveTo(x0 + 1 * s, bottom - baseH);
    ctx.lineTo(x0 + sw / 2, o.top + 1 * s);
    ctx.lineTo(x0 + sw - 1 * s, bottom - baseH);
    ctx.closePath();
  };
  hazardShadow(o.x + o.w / 2, o.w * 0.6, s);
  rimStroke(() => { for (let i = 0; i < n; i++) { cone(i); ctx.stroke(); } ctx.beginPath(); ctx.rect(o.x, bottom - baseH, o.w, baseH); }, s);
  const red = ctx.createLinearGradient(0, o.top, 0, bottom - baseH);
  red.addColorStop(0, '#ffd2c4'); red.addColorStop(0.3, HAZ.red); red.addColorStop(1, HAZ.dark);
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    cone(i);
    ctx.fillStyle = red; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';                     // glint edge
    ctx.fillRect(o.x + i * sw + sw / 2 - 1 * s, o.top + 5 * s, 1.5 * s, (o.h - baseH) * 0.5);
  }
  hazardStripes(o.x, bottom - baseH, o.w, baseH, s);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s;
  ctx.strokeRect(o.x, bottom - baseH, o.w, baseH);
}

function drawLivePuddle(o, s, t) {
  const bottom = o.top + o.h, poolH = 8 * s;
  const pool = () => roundRectPath(ctx, o.x, bottom - poolH, o.w, poolH, 4 * s);
  // warm electric glow
  const gcx = o.x + o.w / 2, gcy = bottom - poolH;
  const glow = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, o.w * 0.7);
  glow.addColorStop(0, 'rgba(255,210,90,0.24)'); glow.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(gcx, gcy, o.w * 0.7, o.h * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // puddle
  rimStroke(pool, s);
  ctx.fillStyle = PAL.teal; pool(); ctx.fill();
  ctx.fillStyle = PAL.aquaPale; ctx.fillRect(o.x + 4 * s, bottom - poolH + 2 * s, o.w - 8 * s, 2 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(o.x + 10 * s + Math.sin(t * 3) * 4 * s, bottom - poolH + 2 * s, 8 * s, 1.5 * s);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2 * s; pool(); ctx.stroke();
  // downed cable snaking into the water (cream under-stroke so it shows on the asphalt)
  const cable = () => { ctx.beginPath(); ctx.moveTo(o.x + o.w - 6 * s, o.top); ctx.quadraticCurveTo(o.x + o.w + 4 * s, o.top + o.h * 0.6, o.x + o.w * 0.7, bottom - poolH / 2); };
  rimStroke(cable, s, 6);
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3 * s; ctx.lineCap = 'round'; cable(); ctx.stroke();
  ctx.lineCap = 'butt';
  // warning triangle at the near edge
  const tx = o.x + 9 * s, tb = bottom - poolH - 1 * s, th = 13 * s;
  const tri = () => { ctx.beginPath(); ctx.moveTo(tx, tb - th); ctx.lineTo(tx + 8 * s, tb); ctx.lineTo(tx - 8 * s, tb); ctx.closePath(); };
  rimStroke(tri, s, 5);
  ctx.fillStyle = PAL.gold; tri(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * s; tri(); ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(tx - 1 * s, tb - th + 4 * s, 2 * s, 5 * s); ctx.fillRect(tx - 1 * s, tb - 3 * s, 2 * s, 2 * s);
  // crackling arcs — re-rolled every few frames, hot gold/white
  const frame = Math.floor(t * 16) + (o.seed || 0);
  const rnd = seededRandom(frame * 7919 + 1);
  for (let b = 0; b < 3; b++) {
    const x = o.x + o.w * (0.3 + b * 0.25) + (rnd() - 0.5) * 8 * s;
    const pts = [[x, bottom - poolH]];
    const segs = 4;
    for (let k = 1; k <= segs; k++) pts.push([x + (rnd() - 0.5) * 14 * s, bottom - poolH - (o.h - poolH) * (k / segs)]);
    for (const [col, lw] of [[PAL.gold, 4 * s], ['#ffffff', 1.5 * s]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
  }
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 4; k++) ctx.fillRect(o.x + rnd() * o.w, o.top + rnd() * (o.h - poolH), 2 * s, 2 * s);
}

function drawCrowDrone(o, s, t) {
  const cx = o.x + o.w / 2, visH = o.h * BIRD_HITBOX_FRAC;
  const cy = o.top + visH * 0.58;
  const flap = Math.sin(t * 14 + (o.seed || 0));
  hazardShadow(cx, o.w * 0.32, s);
  ctx.lineJoin = 'round';
  const wing = (dir) => {
    const tipX = cx + dir * (o.w / 2 - 1 * s);
    const tipY = cy - flap * visH * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 6 * s, cy - 4 * s);
    ctx.lineTo(cx + dir * o.w * 0.28, cy - 6 * s - flap * visH * 0.2);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(cx + dir * o.w * 0.3, cy + 4 * s - flap * visH * 0.1);
    ctx.lineTo(cx + dir * 6 * s, cy + 5 * s);
    ctx.closePath();
    return [tipX, tipY];
  };
  const body = () => { ctx.beginPath(); ctx.ellipse(cx, cy, 13 * s, 9 * s, 0, 0, Math.PI * 2); };
  const head = () => { ctx.beginPath(); ctx.arc(cx - 11 * s, cy - 4 * s, 7 * s, 0, Math.PI * 2); };
  // one rim pass for the whole silhouette
  rimStroke(() => { wing(-1); ctx.stroke(); wing(1); ctx.stroke(); body(); ctx.stroke(); head(); }, s);
  for (const dir of [-1, 1]) {
    const [tipX, tipY] = wing(dir);
    ctx.fillStyle = HAZ.red; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * s; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,243,214,0.75)'; ctx.lineWidth = 1 * s;     // feather sheen
    ctx.beginPath(); ctx.moveTo(cx + dir * 10 * s, cy - 2 * s); ctx.lineTo(tipX - dir * 6 * s, tipY + 3 * s); ctx.stroke();
  }
  ctx.fillStyle = HAZ.deep; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * s;
  body(); ctx.fill(); ctx.stroke();
  head(); ctx.fill(); ctx.stroke();
  // beak facing the runner (left)
  ctx.fillStyle = PAL.gold;
  ctx.beginPath(); ctx.moveTo(cx - 16 * s, cy - 6 * s); ctx.lineTo(cx - 26 * s, cy - 2 * s); ctx.lineTo(cx - 16 * s, cy); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5 * s; ctx.stroke();
  // glowing visor eye
  ctx.fillStyle = PAL.gold; ctx.fillRect(cx - 15 * s, cy - 8 * s, 6 * s, 3 * s);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 14 * s, cy - 7.5 * s, 2 * s, 1.5 * s);
  // rotor
  const blade = Math.abs(Math.cos(t * 40)) * 14 * s + 3 * s;
  ctx.fillStyle = OUTLINE; ctx.fillRect(cx - 1 * s, cy - 15 * s, 2 * s, 6 * s);
  ctx.fillStyle = PAL.cream; ctx.fillRect(cx - blade, cy - 16 * s, blade * 2, 2 * s);
  // blinking tail LED
  if (Math.sin(t * 8) > 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + 12 * s, cy - 1 * s, 3 * s, 3 * s); }
}

function drawShopShutter(o, s) {
  const bottom = o.top + o.h, rail = 5 * s;
  hazardShadow(o.x + o.w / 2, o.w * 0.55, s);
  rimStroke(() => { ctx.beginPath(); ctx.rect(o.x, o.top, o.w, o.h); }, s);
  // red corrugated steel
  ctx.fillStyle = HAZ.deep; ctx.fillRect(o.x, o.top, o.w, o.h);
  const rib = 6 * s;
  for (let y = o.top + 6 * s; y < bottom - 16 * s; y += rib) {
    ctx.fillStyle = HAZ.hot; ctx.fillRect(o.x, y, o.w, Math.max(1, 1.5 * s));
    ctx.fillStyle = HAZ.dark; ctx.fillRect(o.x, y + rib - 2 * s, o.w, Math.max(1, 1.5 * s));
  }
  hazardStripes(o.x, o.top, o.w, 6 * s, s);                       // top warning band
  // spray-paint tag
  const tagY = bottom - 70 * s;
  ctx.fillStyle = 'rgba(255,243,214,0.85)';
  forEachGlyphPixel('SR', (px, py) => ctx.fillRect(o.x + 16 * s + px * 3 * s + py * 0.6 * s, tagY + py * 3 * s, 3 * s, 3 * s));
  // closed-today notice
  const note = cached('kana|teikyu', () => bakeKanaPlate('定休日', Math.round(9 * SCALE * DPR), PAL.cream, PAL.tomato, PAL.tomato));
  drawBaked(note, o.x + o.w / 2, bottom - 38 * s);
  // bottom bar + handle + chunky hazard edge (the line you duck under)
  ctx.fillStyle = HAZ.dark; ctx.fillRect(o.x, bottom - 16 * s, o.w, 8 * s);
  ctx.fillStyle = PAL.cream; ctx.fillRect(o.x + o.w / 2 - 8 * s, bottom - 13 * s, 16 * s, 3 * s);
  hazardStripes(o.x, bottom - 8 * s, o.w, 8 * s, s);
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
