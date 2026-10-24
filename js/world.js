'use strict';
// =====================================================================
// WORLD — Neon Tokyo at dusk. Parallax layers, back to front:
//   sunset sky + stars, striped clouds (4%), sun + Mt. Fuji (static),
//   far skyline with a radio tower (12%), shop row with neon signs (45%),
//   utility poles + wires (80%), street (100%).
// Each scrolling layer is baked once as a seamless tile, then offset.
// =====================================================================

let worldScroll = 0; // CSS px travelled at full game speed
const LAYER = { clouds: 0.04, skyline: 0.12, shops: 0.45, poles: 0.8, road: 1.0 };

function roadHeight() { return Math.round(28 * SCALE); }
function horizonY() { return GROUND - roadHeight(); }

// Setting sun with horizon slats (shared with the title screen).
function bakeSun(R) {
  const size = R * 2.8, c = makeCanvas(size, size), g = c.getContext('2d');
  const cx = c.width / 2, cy = c.height / 2;
  const glow = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, size / 2);
  glow.addColorStop(0, 'rgba(255,190,120,0.55)'); glow.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = glow; g.fillRect(0, 0, c.width, c.height);
  const body = g.createLinearGradient(0, cy - R, 0, cy + R);
  body.addColorStop(0, '#fffbe8'); body.addColorStop(0.4, '#ffd9a0'); body.addColorStop(1, '#ff6b5a');
  g.fillStyle = body;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) {
    const y = cy + R * (0.1 + i * 0.15), th = R * (0.025 + i * 0.018);
    g.fillRect(cx - R, y, R * 2, th);
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

// Mt. Fuji silhouette with a snowcap (shared with the title screen).
function drawFuji(cx, yH, hF, base) {
  const top = hF * 0.27;
  const peakY = yH - hF;
  const grad = ctx.createLinearGradient(0, peakY, 0, yH);
  grad.addColorStop(0, '#2c4f8f'); grad.addColorStop(1, '#0f2350');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - base, yH);
  ctx.quadraticCurveTo(cx - top * 2.2, yH - hF * 0.55, cx - top, peakY);
  ctx.lineTo(cx + top, peakY);
  ctx.quadraticCurveTo(cx + top * 2.2, yH - hF * 0.55, cx + base, yH);
  ctx.closePath();
  ctx.fill();
  const capY = peakY + hF * 0.32;
  const capL = cx - top - top * 0.84, capR = cx + top + top * 0.84;
  ctx.fillStyle = '#f4f8ff';
  ctx.beginPath();
  ctx.moveTo(cx - top, peakY); ctx.lineTo(cx + top, peakY); ctx.lineTo(capR, capY);
  const teeth = 7;
  for (let i = 1; i <= teeth; i++) ctx.lineTo(capR - (capR - capL) * (i / teeth), capY + (i % 2 ? hF * 0.09 : 0));
  ctx.lineTo(capL, capY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(120,170,230,0.45)';
  ctx.beginPath();
  ctx.moveTo(cx + top * 0.2, peakY); ctx.lineTo(cx + top, peakY); ctx.lineTo(capR, capY);
  ctx.lineTo(capR - (capR - capL) / teeth, capY + hF * 0.09);
  ctx.closePath(); ctx.fill();
}

// Bakes a tile `tw` CSS px wide; draw(g, xOffset) is called twice (x and x - tw) so edges wrap seamlessly.
function bakeTile(tw, th, draw) {
  const c = makeCanvas(tw * DPR, th * DPR), g = c.getContext('2d');
  g.scale(DPR, DPR);
  draw(g, 0); draw(g, -tw); draw(g, tw);
  return { canvas: c, w: tw, h: th };
}

function bakeStripeClouds(tw, th) {
  const rnd = seededRandom(11);
  const clouds = [];
  for (let i = 0; i < 7; i++) clouds.push({ x: rnd() * tw, y: rnd() * th, w: (60 + rnd() * 140) * SCALE });
  return bakeTile(tw, th, (g, ox) => {
    for (const cl of clouds) {
      const bands = 3;
      for (let b = 0; b < bands; b++) {
        g.fillStyle = b === 0 ? 'rgba(255,200,170,0.55)' : 'rgba(255,150,130,0.45)';
        const inset = b * 10 * SCALE;
        g.fillRect(Math.round(cl.x + ox + inset), Math.round(cl.y + b * 5 * SCALE), Math.round(cl.w - inset * 2), Math.max(1, Math.round(2 * SCALE)));
      }
    }
  });
}

function bakeSkyline(tw, th) {
  const rnd = seededRandom(23), S = SCALE;
  const blds = [];
  let x = 0;
  while (x < tw) {
    const w = Math.round((16 + rnd() * 34) * S), h = Math.round(th * (0.25 + rnd() * 0.7));
    blds.push({ x, w, h, seed: rnd() });
    x += w + Math.round(rnd() * 6 * S);
  }
  const towerX = Math.round(tw * 0.62);
  return bakeTile(tw, th, (g, ox) => {
    // radio tower (red/white lattice) behind the blocks
    const tx = towerX + ox, tH = th * 1.0, tW = 26 * S;
    g.fillStyle = '#e8486a';
    g.beginPath(); g.moveTo(tx - tW / 2, th); g.lineTo(tx - 2 * S, th - tH); g.lineTo(tx + 2 * S, th - tH); g.lineTo(tx + tW / 2, th); g.closePath(); g.fill();
    g.fillStyle = '#f4f1ff';
    for (let k = 1; k < 5; k++) {
      const yy = th - tH * (k / 5.2), half = (tW / 2) * (1 - k / 5.2) + 2 * S;
      g.fillRect(tx - half, yy, half * 2, Math.max(2, 3 * S));
    }
    g.fillStyle = '#ff5a4f'; g.fillRect(tx - 1 * S, th - tH - 6 * S, 2 * S, 6 * S);
    for (const b of blds) {
      const bx = b.x + ox;
      g.fillStyle = b.seed > 0.5 ? '#1b3a6e' : '#173263';
      g.fillRect(bx, th - b.h, b.w, b.h);
      g.fillStyle = 'rgba(160,200,255,0.12)';               // rim light from the sunset
      g.fillRect(bx, th - b.h, b.w, Math.max(1, Math.round(2 * S)));
      const wr = seededRandom(Math.floor(b.seed * 1e6) + 1);
      const ws = Math.max(2, Math.round(2 * S));
      for (let yy = th - b.h + 5 * S; yy < th - 4 * S; yy += 6 * S) {
        for (let xx = bx + 3 * S; xx < bx + b.w - 3 * S; xx += 5 * S) {
          if (wr() < 0.32) { g.fillStyle = wr() < 0.8 ? 'rgba(255,213,154,0.75)' : 'rgba(127,240,255,0.7)'; g.fillRect(Math.round(xx), Math.round(yy), ws, ws); }
        }
      }
      if (b.seed > 0.82) { g.fillStyle = '#ff5a4f'; g.fillRect(bx + b.w / 2 - S, th - b.h - 4 * S, 2 * S, 4 * S); }
    }
  });
}

const SIGN_WORDS = ['ラーメン', 'カラオケ', 'ゲーム', 'すし', '喫茶', '居酒屋', 'ホテル', '本屋', '銭湯', 'ネオン'];
const NEON = ['#ff5a4f', '#7ff0ff', '#ffe14d', '#7dff8a', '#ff8ad0'];
const AWNINGS = [['#ff5a4f', '#fff3d6'], ['#35d6e8', '#ffffff'], ['#ffd23a', '#e8283c'], ['#7dff8a', '#0f2350']];

function bakeShopRow(tw, th) {
  const rnd = seededRandom(37), S = SCALE;
  const shops = [];
  let x = 0, i = 0;
  while (x < tw - 40 * S) {
    const w = Math.round((70 + rnd() * 50) * S), h = Math.round(Math.min(th, (70 + rnd() * 80) * S));
    const walls = ['#22406f', '#1f4f6e', '#2a3a66', '#4a3048'], tops = ['24H', 'OPEN', 'BAR', 'SALE', 'NEW'];
    shops.push({ x, w, h, wall: walls[(rnd() * walls.length) | 0], seed: rnd(),
      word: SIGN_WORDS[i % SIGN_WORDS.length], neon: NEON[i % NEON.length], awn: AWNINGS[i % AWNINGS.length],
      signSide: rnd() < 0.5 ? 'L' : 'R', top: rnd() < 0.5 ? tops[(rnd() * tops.length) | 0] : null });
    x += w + Math.round((6 + rnd() * 18) * S);
    i++;
  }
  const signs = [];
  const tile = bakeTile(tw, th, (g, ox) => {
    for (const s of shops) {
      const bx = s.x + ox, by = th - s.h;
      g.fillStyle = s.wall; g.fillRect(bx, by, s.w, s.h);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(bx, by, s.w, Math.max(2, 3 * S));      // parapet
      g.fillStyle = 'rgba(5,11,30,0.35)'; g.fillRect(bx + s.w - 4 * S, by, 4 * S, s.h);          // side shade
      // upper-floor windows
      const wr = seededRandom(Math.floor(s.seed * 1e6) + 3);
      for (let yy = by + 8 * S; yy < th - 40 * S; yy += 18 * S) {
        for (let xx = bx + 8 * S; xx < bx + s.w - 16 * S; xx += 20 * S) {
          const lit = wr() < 0.55;
          g.fillStyle = lit ? '#ffd59a' : '#0f2350';
          g.fillRect(xx, yy, 12 * S, 10 * S);
          if (lit) { g.fillStyle = 'rgba(255,140,90,0.55)'; g.fillRect(xx, yy + 7 * S, 12 * S, 3 * S); }
        }
      }
      // shop front: glowing window + striped awning
      const fy = th - 30 * S;
      g.fillStyle = '#ffe9a8'; g.fillRect(bx + 6 * S, fy + 8 * S, s.w - 12 * S, 22 * S);
      g.fillStyle = 'rgba(255,150,90,0.6)'; g.fillRect(bx + 6 * S, fy + 20 * S, s.w - 12 * S, 10 * S);
      g.fillStyle = '#0a1530';
      for (let mx = bx + 6 * S + 18 * S; mx < bx + s.w - 8 * S; mx += 20 * S) g.fillRect(mx, fy + 8 * S, 2 * S, 22 * S);
      const stripe = 8 * S;
      for (let ax = 0, k = 0; ax < s.w - 2 * S; ax += stripe, k++) {
        g.fillStyle = s.awn[k % 2];
        g.fillRect(bx + 2 * S + ax, fy, Math.min(stripe, s.w - 4 * S - ax), 7 * S);
      }
      g.fillStyle = 'rgba(5,11,30,0.35)'; g.fillRect(bx + 2 * S, fy + 6 * S, s.w - 4 * S, 2 * S);
      // vertical neon sign (tate-kanban)
      const chars = [...s.word];
      const sw = 16 * S, sh = chars.length * 14 * S + 8 * S;
      const sx = s.signSide === 'L' ? bx - 6 * S : bx + s.w - sw + 6 * S;
      const sy = Math.max(by + 6 * S, fy - sh - 10 * S);
      g.save();
      g.shadowColor = s.neon; g.shadowBlur = 10 * S;
      g.fillStyle = '#0a1530'; g.fillRect(sx, sy, sw, sh);
      g.strokeStyle = s.neon; g.lineWidth = 2 * S; g.strokeRect(sx + 1 * S, sy + 1 * S, sw - 2 * S, sh - 2 * S);
      g.fillStyle = s.neon;
      g.font = `900 ${Math.round(11 * S)}px ${JP_FONT_STACK}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      chars.forEach((ch, k) => g.fillText(ch, sx + sw / 2, sy + 4 * S + 7 * S + k * 14 * S));
      g.restore();
      if (ox === 0) signs.push({ x: sx, y: sy, w: sw, h: sh, color: s.neon, broken: s.seed < 0.2 });
      // little horizontal sign above the door
      if (s.top) {
        const tw2 = pixelTextWidth(s.top) * 1.5 * S + 8 * S;
        const tx = bx + s.w / 2 - tw2 / 2, ty = fy - 14 * S;
        g.save();
        g.shadowColor = '#ffe14d'; g.shadowBlur = 8 * S;
        g.fillStyle = '#0a1530'; g.fillRect(tx, ty, tw2, 11 * S);
        g.fillStyle = '#ffe14d';
        let cx = tx + 4 * S;
        forEachGlyphPixel(s.top, (px, py) => g.fillRect(cx + px * 1.5 * S, ty + 2 * S + py * 1 * S, 1.5 * S, 1 * S));
        g.restore();
      }
    }
  });
  tile.signs = signs;
  return tile;
}

function bakeRoad(tw, th) {
  const S = SCALE;
  return bakeTile(tw, th, (g, ox) => {
    if (ox !== 0) return;
    g.fillStyle = '#9fb8dc'; g.fillRect(0, 0, tw, Math.max(2, 3 * S));                    // curb top
    g.fillStyle = '#2b4374'; g.fillRect(0, 3 * S, tw, 8 * S);                             // sidewalk
    g.fillStyle = '#1d2f58';
    for (let x = 0; x < tw; x += 20 * S) g.fillRect(x, 3 * S, Math.max(1, S), 8 * S);    // paving seams
    g.fillStyle = '#5f7bab'; g.fillRect(0, 11 * S, tw, Math.max(1, 2 * S));               // kerb edge
    g.fillStyle = '#141c38'; g.fillRect(0, 13 * S, tw, th - 13 * S);                       // asphalt
    g.fillStyle = 'rgba(255,213,154,0.12)'; g.fillRect(0, 13 * S, tw, 3 * S);              // sunset sheen
    g.fillStyle = '#fff3d6'; g.fillRect(tw * 0.1, th - 8 * S, tw * 0.45, Math.max(2, 3 * S)); // lane dash
  });
}

function getWorldCache() {
  return cached('world', () => {
    const hz = horizonY();
    return {
      clouds: bakeStripeClouds(Math.round(W * 1.5), Math.round(PLAY_H * 0.3)),
      sun: bakeSun(Math.round(W * 0.22 * DPR)),
      skyline: bakeSkyline(Math.round(W * 1.4), Math.round(PLAY_H * 0.26)),
      shops: bakeShopRow(Math.round(W * 2.0), Math.round(Math.min(PLAY_H * 0.36, 175 * SCALE))),
      road: bakeRoad(Math.round(80 * SCALE), roadHeight()),
      stars: (() => { const r = seededRandom(5), a = []; for (let i = 0; i < 40; i++) a.push({ x: r(), y: r(), ph: r() * 6.28, big: r() < 0.2 }); return a; })(),
      hz,
    };
  });
}

function drawTile(tile, factor, y) {
  const off = ((worldScroll * factor) % tile.w + tile.w) % tile.w;
  for (let x = -off; x < W; x += tile.w) ctx.drawImage(tile.canvas, Math.round(x * DPR) / DPR, y, tile.w, tile.h);
  return off;
}

function updateWorld(dt, moving) {
  if (moving) worldScroll += currentScrollSpeed() * dt; // follows the run's speed level
}

function drawWorld(t) {
  const wc = getWorldCache();
  const hz = horizonY();
  ctx.imageSmoothingEnabled = false;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#081433'); sky.addColorStop(0.42, '#123f73');
  sky.addColorStop(0.78, '#e8796a'); sky.addColorStop(1, '#ffd59a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz);
  for (const st of wc.stars) {
    const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + st.ph);
    ctx.fillStyle = `rgba(255,248,230,${0.2 + tw * 0.7})`;
    const sz = Math.max(1, Math.round((st.big ? 2 : 1) * SCALE));
    ctx.fillRect(Math.round(st.x * W), Math.round(st.y * hz * 0.42), sz, sz);
  }
  drawTile(wc.clouds, LAYER.clouds, Math.round(hz * 0.18));

  // sun + Fuji (fixed in the distance)
  const sunR = W * 0.22, sunY = hz - PLAY_H * 0.3;
  const sw = wc.sun.width / DPR, sh = wc.sun.height / DPR;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(wc.sun, W * 0.62 - sw / 2, sunY - sh / 2, sw, sh);
  ctx.imageSmoothingEnabled = false;
  drawFuji(W * 0.58, hz - wc.skyline.h * 0.35, PLAY_H * 0.26, W * 0.75);

  // haze between the mountain and the city
  const haze = ctx.createLinearGradient(0, hz - wc.skyline.h, 0, hz);
  haze.addColorStop(0, 'rgba(255,170,130,0)'); haze.addColorStop(1, 'rgba(255,170,130,0.45)');
  ctx.fillStyle = haze; ctx.fillRect(0, hz - wc.skyline.h, W, wc.skyline.h);

  drawTile(wc.skyline, LAYER.skyline, hz - wc.skyline.h);

  // shop row + flickering neon
  const shopY = hz - wc.shops.h;
  const off = drawTile(wc.shops, LAYER.shops, shopY);
  ctx.globalCompositeOperation = 'lighter';
  for (let base = -off; base < W; base += wc.shops.w) {
    for (const sg of wc.shops.signs) {
      const sx = base + sg.x;
      if (sx > W || sx + sg.w < 0) continue;
      let a = 0.06 + 0.03 * Math.sin(t * 6 + sg.x); // softer glow so neon never competes with hazards
      if (sg.broken && Math.sin(t * 17 + sg.x) * Math.sin(t * 5.3) > 0.55) continue;
      ctx.fillStyle = sg.color;
      ctx.globalAlpha = a;
      ctx.fillRect(sx - 4 * SCALE, shopY + sg.y - 4 * SCALE, sg.w + 8 * SCALE, sg.h + 8 * SCALE);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (let base = -off; base < W; base += wc.shops.w) {        // broken sign dropouts
    for (const sg of wc.shops.signs) {
      if (!sg.broken || Math.sin(t * 17 + sg.x) * Math.sin(t * 5.3) <= 0.55) continue;
      ctx.fillStyle = 'rgba(5,11,30,0.7)';
      ctx.fillRect(base + sg.x, shopY + sg.y, sg.w, sg.h);
    }
  }

  drawPolesAndWires(hz);
  drawDepthDim(hz);
  drawTile(wc.road, LAYER.road, hz);
}

// Pushes the whole city back: a cool navy veil that deepens toward the street, so the warm,
// outlined hazards in the lane always read as foreground. The road itself is left untouched.
function drawDepthDim(hz) {
  const dim = ctx.createLinearGradient(0, 0, 0, hz);
  dim.addColorStop(0, 'rgba(8,20,51,0.18)');
  dim.addColorStop(0.5, 'rgba(8,20,51,0.36)');
  dim.addColorStop(1, 'rgba(8,20,51,0.6)');
  ctx.fillStyle = dim;
  ctx.fillRect(0, 0, W, hz);
}

function drawPolesAndWires(hz) {
  const S = SCALE, gapX = 230 * S, poleH = PLAY_H * 0.42;
  const off = ((worldScroll * LAYER.poles) % gapX + gapX) % gapX;
  const tops = [];
  for (let x = -off - gapX; x < W + gapX; x += gapX) tops.push(x);
  ctx.strokeStyle = 'rgba(5,11,30,0.85)';
  ctx.lineWidth = Math.max(1, 1.5 * S);
  for (let i = 0; i < tops.length - 1; i++) {
    for (const dy of [0, 7 * S]) {
      const y = hz - poleH + 8 * S + dy;
      ctx.beginPath();
      ctx.moveTo(tops[i] + 3 * S, y);
      ctx.quadraticCurveTo((tops[i] + tops[i + 1]) / 2, y + 22 * S, tops[i + 1] + 3 * S, y);
      ctx.stroke();
    }
  }
  for (const x of tops) {
    ctx.fillStyle = '#0a1530';
    ctx.fillRect(x, hz - poleH, 6 * S, poleH);
    ctx.fillRect(x - 10 * S, hz - poleH + 6 * S, 26 * S, 3 * S);       // crossbar
    ctx.fillStyle = '#16294f';
    ctx.fillRect(x + 6 * S, hz - poleH * 0.72, 9 * S, 12 * S);         // transformer
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(x - 1 * S, hz - poleH * 0.35, 8 * S, 3 * S);          // yellow pole guard
  }
}

// Full-screen CRT scanlines (device space so they stay crisp) + vignette.
function drawCrtOverlay(height) {
  const pat = cached('scan', () => {
    const t = Math.max(3, Math.round(3 * DPR)), c = makeCanvas(1, t), g = c.getContext('2d');
    g.fillStyle = 'rgba(2,6,20,0.24)';
    g.fillRect(0, t - Math.max(1, Math.round(DPR)), 1, Math.max(1, Math.round(DPR)));
    return ctx.createPattern(c, 'repeat');
  });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, canvas.width, height * DPR);
  ctx.restore();
  const vig = ctx.createRadialGradient(W / 2, height * 0.5, height * 0.3, W / 2, height * 0.5, height * 0.85);
  vig.addColorStop(0, 'rgba(5,11,30,0)'); vig.addColorStop(1, 'rgba(5,11,30,0.55)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, height);
}
