'use strict';
// =====================================================================
// AUDIO — everything is synthesised with Web Audio (no asset files).
// SFX bus + music bus -> master (mute) -> compressor -> speakers.
// Music: a looping chiptune city-pop track on the "royal road"
// progression (IVmaj7 - V7 - iii7 - vi7) at 132 BPM.
// =====================================================================

let actx = null, masterGain = null, sfxBus = null, musicBus = null, noiseBuf = null;
let pulse25 = null, pulse12 = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

function makePulseWave(duty) {
  const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    real[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
    imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
  }
  return actx.createPeriodicWave(real, imag);
}

function ensureAudio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { actx = null; return; }
    const comp = actx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(actx.destination);
    masterGain = actx.createGain();
    masterGain.gain.value = muted ? 0 : 0.9;
    masterGain.connect(comp);
    sfxBus = actx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(masterGain);
    musicBus = actx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(masterGain);
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pulse25 = makePulseWave(0.25);
    pulse12 = makePulseWave(0.125);
  } else if (actx.state === 'suspended') {
    actx.resume();
  }
}

function audioReady() { return actx && actx.state === 'running'; }

function setMuted(m) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {}
  if (masterGain) masterGain.gain.setTargetAtTime(m ? 0 : 0.9, actx.currentTime, 0.02);
}
function toggleMute() { ensureAudio(); setMuted(!muted); if (!muted) sfxUiBlip(); }

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// One oscillator voice with an exponential pitch sweep and a fast-attack decay.
function tone(f0, f1, dur, type, vol, when, dest) {
  if (!actx) return;
  const t0 = actx.currentTime + (when || 0);
  const osc = actx.createOscillator(), g = actx.createGain();
  if (type === 'pulse25') osc.setPeriodicWave(pulse25);
  else if (type === 'pulse12') osc.setPeriodicWave(pulse12);
  else osc.type = type || 'square';
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(dest || sfxBus);
  osc.start(t0); osc.stop(t0 + dur + 0.03);
}

// Filtered noise burst (hats, snares, whooshes, crashes).
function noise(dur, vol, ftype, freq, when, dest, freqEnd) {
  if (!actx) return;
  const t0 = actx.currentTime + (when || 0);
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = ftype || 'highpass';
  f.frequency.setValueAtTime(freq || 1000, t0);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest || sfxBus);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.03);
}

// ---------------------------------------------------------------------
// SFX
// ---------------------------------------------------------------------
function sfxJump()     { tone(392, 784, 0.10, 'pulse25', 0.16); tone(784, 1175, 0.08, 'square', 0.05, 0.03); }
function sfxDuck()     { noise(0.12, 0.22, 'bandpass', 1400, 0, null, 500); tone(300, 150, 0.09, 'square', 0.09); }
function sfxFastFall() { noise(0.14, 0.25, 'bandpass', 3000, 0, null, 300); tone(520, 90, 0.12, 'sawtooth', 0.12); tone(70, 40, 0.12, 'sine', 0.35, 0.1); }
function sfxStart()    { tone(988, 988, 0.07, 'square', 0.12); tone(1319, 1319, 0.22, 'square', 0.12, 0.07); }
function sfxUiBlip()   { tone(880, 1320, 0.05, 'pulse25', 0.1); }
function sfxTitleSlam() { tone(200, 50, 0.3, 'square', 0.16); tone(900, 1500, 0.14, 'triangle', 0.08); noise(0.35, 0.2, 'lowpass', 3000, 0, null, 200); }

// Each cleared obstacle ticks up a pentatonic ladder so long combos "climb".
const COMBO_LADDER = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
function sfxClear(combo) {
  const m = COMBO_LADDER[Math.min(COMBO_LADDER.length - 1, (combo - 1) % 10 + Math.floor((combo - 1) / 10))];
  tone(midiHz(m), midiHz(m), 0.07, 'pulse25', 0.1);
}

function sfxJudge(key) {
  if (key === 'NICE') { tone(midiHz(84), 0, 0.08, 'square', 0.09); tone(midiHz(88), 0, 0.12, 'square', 0.09, 0.06); }
  else if (key === 'GREAT') { [84, 88, 91].forEach((m, i) => tone(midiHz(m), 0, 0.1, 'square', 0.09, i * 0.05)); }
  else {
    [84, 88, 91, 96].forEach((m, i) => tone(midiHz(m), 0, 0.12, 'pulse25', 0.11, i * 0.045));
    noise(0.25, 0.08, 'highpass', 8000, 0.15);
  }
}

// Every 5th hit: fanfare + crash.
function sfxComboMilestone(n) {
  const base = n % 10 === 0 ? 77 : 72;
  [0, 4, 7, 12, 16].forEach((d, i) => tone(midiHz(base + d), 0, 0.14, 'square', 0.1, i * 0.04));
  tone(midiHz(base + 24), 0, 0.35, 'triangle', 0.1, 0.2);
  noise(0.45, 0.16, 'highpass', 5000, 0);
}

// Speed level up: quick rising sweep + sparkle.
function sfxSpeedUp() { [72, 79, 84, 91].forEach((m, i) => tone(midiHz(m), midiHz(m + 5), 0.1, 'square', 0.09, i * 0.05)); noise(0.2, 0.06, 'highpass', 6000, 0.18); }
function sfxHighScore() { [79, 84, 88, 91, 96].forEach((m, i) => tone(midiHz(m), 0, 0.16, 'pulse25', 0.12, i * 0.08)); }

function sfxDeath() {
  tone(420, 50, 0.5, 'sawtooth', 0.2);
  tone(110, 35, 0.4, 'square', 0.18, 0.05);
  noise(0.5, 0.35, 'lowpass', 4000, 0, null, 120);
  // sad little "game over" sting
  [67, 63, 60, 55].forEach((m, i) => tone(midiHz(m), 0, 0.22, 'pulse25', 0.1, 0.5 + i * 0.18));
}

// ---------------------------------------------------------------------
// MUSIC SEQUENCER
// ---------------------------------------------------------------------
const MUSIC = {
  bpm: 132,
  // IVmaj7 - V7 - iii7 - vi7 (in C): chord tones for the arpeggio, plus bass roots
  chords: [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]],
  roots: [41, 43, 40, 45],
  bassPattern: [0, 12, 0, 12, 7, 12, 10, 12],
  // 8 bars of lead, eighth notes; null = hold previous note
  lead: [
    [76, null, 74, 72, 74, null, 72, 69],
    [71, null, 74, 79, 77, null, 74, 71],
    [72, null, 71, 67, 71, null, 74, 76],
    [76, null, null, 72, 69, null, null, 0],
    [76, 77, 79, 77, 76, null, 72, 74],
    [74, null, 79, null, 77, 76, 74, 71],
    [79, null, 76, 74, 71, null, 72, 74],
    [76, null, null, null, 81, null, 79, null],
  ],
};
let musicTimer = null, musicStep = 0, musicNextT = 0;

function musicPlaying() { return musicTimer !== null; }

function musicStart() {
  if (!actx || musicTimer !== null) return;
  musicStep = 0;
  musicNextT = actx.currentTime + 0.08;
  musicBus.gain.cancelScheduledValues(actx.currentTime);
  musicBus.gain.setTargetAtTime(0.42, actx.currentTime, 0.05);
  musicTimer = setInterval(musicSchedule, 25);
}

function musicStop() {
  if (musicTimer === null) return;
  clearInterval(musicTimer);
  musicTimer = null;
  if (actx) musicBus.gain.setTargetAtTime(0.0001, actx.currentTime, 0.03);
}

function musicSchedule() {
  const sixteenth = 60 / MUSIC.bpm / 4;
  while (musicNextT < actx.currentTime + 0.12) {
    playMusicStep(musicStep, musicNextT - actx.currentTime, sixteenth);
    musicNextT += sixteenth;
    musicStep = (musicStep + 1) % (16 * 8);
  }
}

function playMusicStep(step, when, s16) {
  const bar = Math.floor(step / 16), inBar = step % 16, ci = bar % 4;
  const chord = MUSIC.chords[ci], root = MUSIC.roots[ci];
  const B = musicBus;
  if (when < 0) when = 0;
  // drums
  if (inBar === 0 || inBar === 8 || (bar % 2 === 1 && inBar === 6)) tone(150, 40, 0.14, 'sine', 0.55, when, B);
  if (inBar === 4 || inBar === 12) { noise(0.12, 0.28, 'bandpass', 1800, when, B); tone(190, 120, 0.08, 'triangle', 0.12, when, B); }
  if (inBar % 2 === 0) noise(0.035, inBar % 4 === 2 ? 0.13 : 0.07, 'highpass', 7000, when, B);
  // bass (eighths)
  if (inBar % 2 === 0) {
    const m = root + MUSIC.bassPattern[inBar / 2];
    tone(midiHz(m), 0, s16 * 1.8, 'square', 0.085, when, B);
  }
  // arpeggio (sixteenths)
  tone(midiHz(chord[inBar % 4] + 12), 0, s16 * 0.9, 'pulse12', 0.035, when, B);
  // lead (eighths with holds)
  if (inBar % 2 === 0) {
    const row = MUSIC.lead[bar], i = inBar / 2, note = row[i];
    if (note) {
      let len = 1;
      while (i + len < row.length && row[i + len] === null) len++;
      tone(midiHz(note), 0, s16 * 2 * len * 0.95, 'pulse25', 0.075, when, B);
    }
  }
}
