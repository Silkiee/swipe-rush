'use strict';
// =====================================================================
// PIXEL TYPE — built-in 5x7 bitmap font, chunky logo words, katakana
// plates. Everything is baked once to offscreen canvases at device
// resolution and cached until the view size changes.
// =====================================================================

const PIXEL_FONT = {
  'A': ['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
  'B': ['####.','#...#','#...#','####.','#...#','#...#','####.'],
  'C': ['.###.','#...#','#....','#....','#....','#...#','.###.'],
  'D': ['####.','#...#','#...#','#...#','#...#','#...#','####.'],
  'E': ['#####','#....','#....','####.','#....','#....','#####'],
  'F': ['#####','#....','#....','####.','#....','#....','#....'],
  'G': ['.###.','#...#','#....','#.###','#...#','#...#','.###.'],
  'H': ['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
  'I': ['#####','..#..','..#..','..#..','..#..','..#..','#####'],
  'J': ['..###','...#.','...#.','...#.','#..#.','#..#.','.##..'],
  'K': ['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],
  'L': ['#....','#....','#....','#....','#....','#....','#####'],
  'M': ['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
  'N': ['#...#','#...#','##..#','#.#.#','#..##','#...#','#...#'],
  'O': ['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
  'P': ['####.','#...#','#...#','####.','#....','#....','#....'],
  'Q': ['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],
  'R': ['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
  'S': ['.####','#....','#....','.###.','....#','....#','####.'],
  'T': ['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
  'U': ['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
  'V': ['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
  'W': ['#...#','#...#','#...#','#.#.#','#.#.#','#.#.#','.#.#.'],
  'X': ['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
  'Y': ['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],
  'Z': ['#####','....#','...#.','..#..','.#...','#....','#####'],
  '0': ['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],
  '1': ['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
  '2': ['.###.','#...#','....#','...#.','..#..','.#...','#####'],
  '3': ['#####','...#.','..#..','...#.','....#','#...#','.###.'],
  '4': ['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],
  '5': ['#####','#....','####.','....#','....#','#...#','.###.'],
  '6': ['..##.','.#...','#....','####.','#...#','#...#','.###.'],
  '7': ['#####','....#','...#.','..#..','.#...','.#...','.#...'],
  '8': ['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],
  '9': ['.###.','#...#','#...#','.####','....#','...#.','.##..'],
  '!': ['##','##','##','##','##','..','##'],
  '?': ['.###.','#...#','....#','...#.','..#..','.....','..#..'],
  ':': ['.','#','.','.','.','#','.'],
  '.': ['.','.','.','.','.','.','#'],
  ',': ['..','..','..','..','..','.#','#.'],
  "'": ['#','#','.','.','.','.','.'],
  '-': ['...','...','...','###','...','...','...'],
  '_': ['.....','.....','.....','.....','.....','.....','#####'],
  '=': ['....','....','####','....','####','....','....'],
  '+': ['.....','..#..','..#..','#####','..#..','..#..','.....'],
  '#': ['.#.#.','#####','.#.#.','.#.#.','#####','.#.#.','.....'],
  '/': ['....#','....#','...#.','..#..','.#...','#....','#....'],
  '(': ['.#','#.','#.','#.','#.','#.','.#'],
  ')': ['#.','.#','.#','.#','.#','.#','#.'],
  '[': ['##','#.','#.','#.','#.','#.','##'],
  ']': ['##','.#','.#','.#','.#','.#','##'],
  ' ': ['...','...','...','...','...','...','...'],
};

function pixelGlyph(ch) { return PIXEL_FONT[ch] || PIXEL_FONT[' ']; }

function pixelTextWidth(text) {
  let w = 0;
  for (const ch of text) w += pixelGlyph(ch)[0].length + 1;
  return Math.max(0, w - 1);
}

// Calls cb(col, row) in font units for every lit pixel of the string.
function forEachGlyphPixel(text, cb) {
  let cx = 0;
  for (const ch of text) {
    const g = pixelGlyph(ch);
    const gw = g[0].length;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < gw; c++) if (g[r][c] === '#') cb(cx + c, r);
    }
    cx += gw + 1;
  }
}

// ---------------------------------------------------------------------
// BAKERS
// ---------------------------------------------------------------------
// Small UI text: pixel font with chunky outline + drop shadow.
function bakePixelText(text, u, fill, outline, shadow) {
  const o = outline ? Math.max(1, Math.round(u * 0.5)) : 0;
  const sd = shadow ? u : 0;
  const c = makeCanvas(pixelTextWidth(text) * u + o * 2 + sd, 7 * u + o * 2 + sd);
  const g = c.getContext('2d');
  const pass = (color, dx, dy, grow) => {
    g.fillStyle = color;
    forEachGlyphPixel(text, (px, py) => g.fillRect(o + dx + px * u - grow, o + dy + py * u - grow, u + grow * 2, u + grow * 2));
  };
  if (shadow) pass(shadow, sd, sd, o);
  if (outline) pass(outline, 0, 0, o);
  pass(fill, 0, 0, 0);
  return c;
}

// Big logo word: italic skew, 3D extrusion, dark + white outlines,
// gradient fill with chrome banding. Returns the full word and a fill-only mask (for glints).
function bakeLogoWord(text, u, stops, extrude) {
  const ROWS = 7, SKEW = 0.24;
  const oDark = Math.round(u * 0.55), oWhite = Math.max(1, Math.round(u * 0.28));
  const depth = Math.max(2, Math.round(u * 0.9));
  const pad = oDark + 2;
  const h = ROWS * u + pad * 2 + depth;
  const lean = Math.ceil(SKEW * h);
  const w = pixelTextWidth(text) * u + lean + pad * 2 + depth;
  const c = makeCanvas(w, h), f = makeCanvas(w, h);
  const g = c.getContext('2d'), fg = f.getContext('2d');
  g.setTransform(1, 0, -SKEW, 1, lean, 0);
  fg.setTransform(1, 0, -SKEW, 1, lean, 0);
  const blocks = (ctx2, grow, dx, dy) => forEachGlyphPixel(text, (px, py) =>
    ctx2.fillRect(pad + dx + px * u - grow, pad + dy + py * u - grow, u + grow * 2, u + grow * 2));

  g.fillStyle = PAL.ink;                         // hard drop shadow
  blocks(g, oDark, Math.round(depth * 0.6), depth);
  g.fillStyle = extrude;                         // 3D extrusion
  const step = Math.max(1, Math.round(u * 0.15));
  for (let k = depth - 1; k > 0; k -= step) blocks(g, oDark, Math.round(k * 0.35), k);
  g.fillStyle = PAL.navy; blocks(g, oDark, 0, 0);    // outer dark outline
  g.fillStyle = '#ffffff'; blocks(g, oWhite, 0, 0);  // white keyline

  const grad = fg.createLinearGradient(0, pad, 0, pad + ROWS * u);
  stops.forEach((col, i) => grad.addColorStop(i / (stops.length - 1), col));
  fg.fillStyle = grad;
  blocks(fg, 0, 0, 0);
  fg.globalCompositeOperation = 'source-atop';
  const lw = Math.max(1, Math.round(u * 0.12));
  fg.fillStyle = 'rgba(10,20,60,0.22)';          // row banding
  for (let r = 1; r < ROWS; r++) fg.fillRect(-w, pad + r * u - lw / 2, w * 3, lw);
  fg.fillStyle = 'rgba(255,255,255,0.75)';       // chrome horizon line
  fg.fillRect(-w, pad + Math.round(ROWS * u * 0.48), w * 3, lw);
  fg.globalCompositeOperation = 'source-over';
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(f, 0, 0);
  return { canvas: c, fill: f, pad };
}

const JP_FONT_STACK = '"Hiragino Kaku Gothic StdN","Hiragino Sans","Noto Sans JP","Noto Sans CJK JP","Yu Gothic","Meiryo",sans-serif';

// Katakana on a skewed stamp plate (title banner, screen headers).
function bakeKanaPlate(text, fs, plate, border, ink) {
  const font = `900 ${fs}px ${JP_FONT_STACK}`;
  const probe = makeCanvas(1, 1).getContext('2d');
  probe.font = font;
  const tw = probe.measureText(text).width;
  const padX = Math.ceil(fs * 0.55), padY = Math.ceil(fs * 0.28), skew = 0.18;
  const plateW = tw + padX * 2, plateH = fs * 1.15 + padY * 2;
  const sd = Math.ceil(fs * 0.14), bw = Math.max(2, Math.round(fs * 0.1));
  const c = makeCanvas(plateW + plateH * skew + sd + 2, plateH + sd + 2);
  const g = c.getContext('2d');
  g.setTransform(1, 0, -skew, 1, plateH * skew + 1, 1);
  g.fillStyle = PAL.ink; g.fillRect(sd, sd, plateW, plateH);              // drop shadow
  g.fillStyle = border; g.fillRect(0, 0, plateW, plateH);                 // border
  g.fillStyle = plate; g.fillRect(bw, bw, plateW - bw * 2, plateH - bw * 2);
  g.fillStyle = 'rgba(255,255,255,0.18)';                                 // top sheen
  g.fillRect(bw, bw, plateW - bw * 2, (plateH - bw * 2) * 0.42);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const x = plateW / 2, y = plateH / 2 + fs * 0.04;
  g.strokeStyle = 'rgba(5,11,30,0.55)'; g.lineWidth = fs * 0.22; g.strokeText(text, x + fs * 0.05, y + fs * 0.06);
  g.fillStyle = ink; g.fillText(text, x, y);
  return c;
}

// Free-floating katakana callout text (italic, gradient, heavy keylines).
function bakeKanaText(text, fs, stops, keyline) {
  const font = `900 ${fs}px ${JP_FONT_STACK}`;
  const probe = makeCanvas(1, 1).getContext('2d');
  probe.font = font;
  const tw = probe.measureText(text).width;
  const pad = Math.ceil(fs * 0.4), skew = 0.18;
  const c = makeCanvas(tw + pad * 2 + fs * skew, fs * 1.3 + pad * 2);
  const g = c.getContext('2d');
  g.setTransform(1, 0, -skew, 1, fs * skew, 0);
  g.font = font; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const x = pad, y = c.height / 2;
  g.strokeStyle = PAL.ink; g.lineWidth = fs * 0.34; g.strokeText(text, x + fs * 0.07, y + fs * 0.08);
  g.strokeStyle = PAL.navy; g.lineWidth = fs * 0.34; g.strokeText(text, x, y);
  g.strokeStyle = keyline || '#ffffff'; g.lineWidth = fs * 0.16; g.strokeText(text, x, y);
  const grad = g.createLinearGradient(0, y - fs * 0.5, 0, y + fs * 0.5);
  stops.forEach((col, i) => grad.addColorStop(i / (stops.length - 1), col));
  g.fillStyle = grad; g.fillText(text, x, y);
  return c;
}

// ---------------------------------------------------------------------
// CACHED DRAWING
// ---------------------------------------------------------------------
const bakeCache = { key: '', map: new Map() };
function cached(id, build) {
  const k = viewKey();
  if (bakeCache.key !== k) { bakeCache.key = k; bakeCache.map.clear(); }
  let v = bakeCache.map.get(id);
  if (!v) { v = build(); bakeCache.map.set(id, v); }
  return v;
}

function snap(v) { return Math.round(v * DPR) / DPR; }

// Pixel-text line; align = 'center' | 'left' | 'right'. unitCss is one font pixel in CSS px.
function drawPixelLine(text, x, cy, unitCss, fill, outline, shadow, align) {
  text = String(text).toUpperCase();
  const u = Math.max(1, Math.round(unitCss * DPR));
  const c = cached('t|' + text + '|' + u + '|' + fill + '|' + outline + '|' + shadow,
    () => bakePixelText(text, u, fill, outline, shadow));
  const w = c.width / DPR, h = c.height / DPR;
  const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  ctx.drawImage(c, snap(left), snap(cy - h / 2), w, h);
  return { x: left, y: cy - h / 2, w, h };
}

function pixelLineWidth(text, unitCss, outline) {
  const u = Math.max(1, Math.round(unitCss * DPR));
  const o = outline ? Math.max(1, Math.round(u * 0.5)) : 0;
  return (pixelTextWidth(String(text).toUpperCase()) * u + o * 2) / DPR;
}

// Draws a baked canvas centred on cx (top-aligned), optionally scaled around its centre.
function drawBaked(c, cx, cy, scale, alignTop) {
  const s = scale || 1;
  const w = c.width / DPR * s, h = c.height / DPR * s;
  const top = alignTop ? cy : cy - h / 2;
  ctx.drawImage(c, snap(cx - w / 2), snap(top), w, h);
  return { w, h };
}

// Word-wrap for the pixel font; returns lines.
function wrapPixelText(text, unitCss, maxWidth) {
  const words = String(text).toUpperCase().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (line && pixelLineWidth(test, unitCss, true) > maxWidth) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
