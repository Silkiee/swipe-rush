'use strict';
// =====================================================================
// SWIPE RUSH — core: canvas, view metrics, tuning constants, helpers.
// All game scripts are classic <script> files that share one global
// scope (no modules), so the game still runs when opened from disk.
// =====================================================================

// ---------------------------------------------------------------------
// SUPABASE BACKEND (global leaderboard)
// The publishable key below is the *public* client key: it is designed to ship in
// browser code and is safe to commit. Access is enforced by the table's Row Level
// Security policies (read + insert only). Never put a secret / service_role key here.
// ---------------------------------------------------------------------
const SUPABASE_URL = "https://twtxaaejhvkcyaamctjj.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_dMSyw2pTB4Kl-phtVdmrXQ_0od7Z-A-";

// ---------------------------------------------------------------------
// CANVAS / VIEW
// ---------------------------------------------------------------------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('gameContainer');

const REF_WIDTH = 400; // reference design width, everything scales off this
let W = 400, H = 700, SCALE = 1, DPR = 1;
let BANNER_H = 70, PLAY_H = 630;
let GROUND = 630;      // feet line of the runner (top edge of the ad banner)

function resize() {
  const oldW = W, oldGround = GROUND, oldScale = SCALE;
  DPR = window.devicePixelRatio || 1;
  // Reserve a portrait-ish playing field, capped so it stays sane on wide desktop windows
  let w = container.clientWidth;
  let h = container.clientHeight;
  const maxAspect = 0.72; // width/height
  if (w / h > maxAspect) w = h * maxAspect;
  w = Math.max(280, Math.min(w, 480));
  h = Math.max(500, h);

  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  W = w; H = h;
  SCALE = W / REF_WIDTH;
  BANNER_H = H * 0.10;
  PLAY_H = H - BANNER_H;
  GROUND = PLAY_H;
  // let the game re-fit anything already in the world (e.g. hazards on screen when the phone rotates)
  if (typeof onViewResize === 'function') onViewResize(oldW, oldGround, oldScale);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------
// GAME CONSTANTS (scaled by SCALE at use-time) — gameplay tuning is unchanged
// ---------------------------------------------------------------------
const SCROLL_SPEED_BASE = 260;      // px/s at SCALE=1 — level 1 speed

// SPEED LEVELS — every LEVEL_SECONDS the street speeds up and survival pays more per second.
const LEVEL_SECONDS = 15;
const LEVEL_SPEEDS = [260, 283, 307, 330];  // px/s at SCALE=1 for levels 1..4 (top speed at ~1 min)
const LEVEL_POINTS = [1, 2, 3, 4];          // survival points per second at each level
const SPEED_EASE = 45;                      // px/s per second — how quickly a new level's speed is reached
const GRAVITY = 2100;
const JUMP_VELOCITY = -760;
const DUCK_DURATION = 0.6;          // seconds — minimum duck for a quick flick; holding keeps you down

const PLAYER_X_FRAC = 0.22;         // fixed horizontal position, fraction of W
const PLAYER_STAND_W = 40, PLAYER_STAND_H = 42;
const PLAYER_DUCK_W = 50, PLAYER_DUCK_H = 24;
const DEBUG_HITBOXES = false;

const SPAWN_BASE_INTERVAL = 1.65;
const SPAWN_MIN_INTERVAL = 0.68;
const SPAWN_RAMP_SECONDS = 60;      // interval shrinks with time survived, reaching the floor at ~1 min
const FAIR_WINDOW = 0.15;           // s — every obstacle gap leaves at least this much timing window

const SWIPE_THRESHOLD = 28;         // px at SCALE=1 — max travel that still counts as a tap
const SWIPE_FIRE_DIST = 22;         // px at SCALE=1 — vertical travel that fires a swipe mid-gesture
const SWIPE_ANGLE_RATIO = 0.6;      // |dy| must be >= 0.6*|dx| (~59deg off vertical) so thumb arcs count

// Obstacle footprints (CSS px at SCALE=1). Hitboxes match the old pixel-scan results exactly.
const SPIKE_W_BASE = 40, SPIKE_H_BASE = 30;
const HAZARD_DOUBLE_W_BASE = 80;
const PUDDLE_H_BASE = 24;
const BIRD_VIS_H_BASE = 40;
const BIRD_HITBOX_FRAC = 7 / 8;     // bottom row of the old bird sprite was empty
const BIRD_BOTTOM_OFFSET_BASE = 30; // head/torso line — walk in = death, duck or jump clears it
const LONG_WALL_TOTAL_H_BASE = 200; // tall hitbox: duck is the only valid response
const LONG_WALL_BOTTOM_OFFSET_BASE = 33;

// Combo judgement windows: seconds between the player's last action and the obstacle reaching them.
const JUDGE_WINDOWS = [
  { max: 0.12, key: 'PERFECT', bonus: 3 },
  { max: 0.22, key: 'GREAT',   bonus: 2 },
  { max: 0.35, key: 'NICE',    bonus: 1 },
];

const GAME_OVER_INPUT_DELAY = 0.8;
const NET_TIMEOUT_MS = 4000;        // leaderboard requests give up after this and fall back // s — game over buttons ignore taps until the panel has settled
const BIRD_JUMP_BONUS = 8;          // jumping clean over a crow drone (replaces NICE/GREAT/PERFECT)

const HIGH_SCORE_KEY = 'swipeRushHighScore';
const HOWTO_SEEN_KEY = 'swipeRushHowToSeen';
const MUTE_KEY = 'swipeRushMuted';

const RIP_PHRASES = [
  "You almost got it by 0.01 seconds! Try again!",
  "Your reflexes are warming up! One more try!",
  "So close! Your muscles are learning the rhythm!",
  "You've got the hang of it now, launch again!"
];

// ---------------------------------------------------------------------
// PALETTE — 80s city-pop dusk
// ---------------------------------------------------------------------
const PAL = {
  navy: '#0a1530', ink: '#050b1e', deep: '#081433', blue: '#123f73', cobalt: '#1466c8',
  aqua: '#7ff0ff', aquaPale: '#bffcff', teal: '#35d6e8',
  coral: '#ff5a4f', tomato: '#e8283c', peach: '#ffd59a', sunset: '#e8796a',
  gold: '#ffe14d', amber: '#ffd23a', cream: '#fff3d6', creamPale: '#ffe9a8',
  dusk: '#8fb3d9', white: '#ffffff',
};

// ---------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Seeded RNG so baked scenery looks the same every resize.
function seededRandom(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function pointInRect(px, py, r) {
  return r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function roundRectPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// A key that changes whenever baked art must be rebuilt (size or pixel density).
function viewKey() { return W + 'x' + H + '@' + DPR; }
