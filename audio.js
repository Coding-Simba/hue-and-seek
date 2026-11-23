/* Hue & Seek — procedural sound. Everything is synthesised with the Web Audio API (no sample files).
 *
 * Adaptive music, driven by one 0–1 threat value the game sets every frame:
 *   calm layer   — pastoral storybook loop (warm pad, harp arpeggios, ocarina folk tune) on the "royal road"
 *                  progression IV–V–iii–vi in C; it darkens (lowpass) and fades as threat rises
 *   tension      — low pulse (~0.1) → heartbeat (~0.35) → tremolo strings + clock ticks (~0.6), crossfaded by threat
 *   hide phase   — a sneaky pizzicato tiptoe cue that speeds up as the hiding time runs out
 *   last 10 s    — countdown ticks that accelerate; win / lose stingers; "FOUND!" sting
 * SFX: poof, creak, footsteps (grass / cobble / prop hop), jump, land, spray loop, splash, wrong-prop penalty,
 *      seeker steps + sniffing (positional), alert, UI tap.  Ambience: wind, leaves, birds, distant windmill creak.
 * Mobile: AudioContext is created + unlocked on the first gesture (iOS-safe silent buffer), suspended when the
 * tab is hidden or muted, voices are capped, long-lived nodes (pad, strings, wind, spray) are reused.
 */

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
const MUTE_KEY = 'hueseek.muted';
const LOOK = 0.16;          // scheduler lookahead (s)
const MAXV = 56;            // cap on transient voices
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wallSec = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()) / 1000;

let muted = false;
try { muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage blocked */ }

let ac = null, unlocked = false, voices = 0;
let master, comp, musicBus, sfxBus, ambBus, verbIn, meterNode = null, mediaStreamDest = null;
let calmLP, calmBus, melBus, hideBus, pulseBus, heartBus, strBus, tickBus;
let proxHeartBus = null, proxHeartLP = null;
let padLP, padV = [], strOsc = [], strLP, sprayG, noiseBuf, pinkBuf;

const heartbeatListeners = new Set();
let directHeartbeatCb = null;

const S = {
  mode: 'menu', threat: 0, threatS: 0, timeLeft: -1, lx: 0, lz: 0, yaw: 0,
  step: 0, next: 0, hb: 0, cd: 0, cdN: 0, bird: 0, mill: 0, last: 0,
  spraying: false, lastSplash: 0, lastSniff: 0, lastShot: 0, lastStep: 0,
  proxDanger: 0, proxHbAudio: 0, proxHbWall: 0, proxPulsePending: false,
  feverTriggered: false, lastFeverStingWall: -99, prevSeekTimeLeft: -1,
  lv: { calm: 0, mel: 1, hide: 0, pulse: 0, heart: 0, str: 0, tick: 0, amb: 1 }, set: new Map(),
};

// ------------------------------------------------------------------ music data
// royal-road progression: Fmaj7 – G6 – Em7 – Am7 (one chord per bar, 8 eighth-note steps per bar)
const CALM = [
  { root: 41, pad: [53, 57, 60, 64], arp: [53, 60, 64, 69, 72, 76] },
  { root: 43, pad: [55, 59, 62, 64], arp: [55, 62, 67, 71, 74, 79] },
  { root: 40, pad: [52, 55, 59, 62], arp: [52, 59, 62, 67, 71, 74] },
  { root: 45, pad: [57, 60, 64, 67], arp: [57, 64, 67, 72, 76, 79] },
];
const ARP_A = [0, 1, 2, 3, 4, 3, 2, 1], ARP_B = [0, 2, 1, 3, 2, 4, 3, 5];
// ocarina folk tune — { step: [midi, length in eighths] } over a 4-bar phrase
const MEL_A = { 0: [69, 2], 2: [72, 2], 4: [76, 3], 7: [74, 1], 8: [74, 3], 11: [72, 1], 12: [71, 2], 14: [67, 2], 16: [67, 2], 18: [71, 2], 20: [76, 2], 22: [74, 2], 24: [72, 3], 27: [71, 1], 28: [69, 4] };
const MEL_B = { 0: [81, 3], 3: [79, 1], 4: [76, 2], 6: [72, 2], 8: [74, 3], 11: [76, 1], 12: [79, 2], 14: [74, 2], 16: [76, 3], 19: [74, 1], 20: [71, 2], 22: [67, 2], 24: [69, 2], 26: [72, 1], 27: [71, 1], 28: [69, 4] };
// hide-phase tiptoe cue in A minor: pizz bass on quarters, offbeat stabs, chromatic sneak motif
const HBASS = [[45, 40, 45, 48], [40, 44, 47, 44], [45, 48, 52, 48], [50, 45, 40, 44]];
const HSTAB = [[57, 60, 64], [56, 59, 62], [57, 60, 64], [57, 62, 65]];
const HMOT = { 0: 76, 1: 77, 2: 76, 3: 75, 4: 76, 6: 72, 7: 69, 8: 71, 9: 72, 10: 71, 11: 70, 12: 71, 14: 68, 15: 64, 16: 76, 17: 77, 18: 76, 19: 75, 20: 76, 22: 81, 23: 79, 24: 77, 25: 76, 26: 74, 27: 72, 28: 71, 30: 68, 31: 69 };

// ------------------------------------------------------------------ graph
function gain(v, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function filt(type, f, q = 0.7, to) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }
function lfo(rate, depth, param, type = 'sine') { const o = ac.createOscillator(); o.type = type; o.frequency.value = rate; o.connect(gain(depth, param)); o.start(); return o; }
function loopSrc(buf, to) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(to); s.start(0, Math.random() * buf.duration); return s; }

function makeIR(sec) {
  const n = (ac.sampleRate * sec) | 0, b = ac.createBuffer(2, n, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) { const k = i / n; lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.45 * k); d[i] = lp * Math.pow(1 - k, 2.4) * (i < 90 ? i / 90 : 1); }
  }
  return b;
}

function build() {
  const sr = ac.sampleRate;
  comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
  master = gain(muted ? 0 : 0.9); comp.connect(master); master.connect(ac.destination);
  musicBus = gain(0.5, comp); sfxBus = gain(0.85, comp); ambBus = gain(0.55, comp);
  // short generated-impulse reverb (one shared convolver)
  const conv = ac.createConvolver(); conv.buffer = makeIR(1.4); conv.connect(comp);
  verbIn = gain(0.55, conv);
  sfxBus.connect(gain(0.1, verbIn));
  // calm layer → lowpass that closes under tension → music bus
  calmLP = filt('lowpass', 11000, 0.5, musicBus);
  calmBus = gain(0, calmLP); calmBus.connect(gain(0.38, verbIn));
  melBus = gain(1, calmBus);
  hideBus = gain(0, musicBus); hideBus.connect(gain(0.14, verbIn));
  pulseBus = gain(0, musicBus); heartBus = gain(0, musicBus); tickBus = gain(0, musicBus);
  strBus = gain(0, musicBus); strBus.connect(gain(0.3, verbIn));
  // warm muffled chest-heartbeat bus (150 Hz low-pass, dry — never muddies spatial SFX)
  proxHeartBus = gain(0.95, comp);
  proxHeartLP = filt('lowpass', 150, 0.85, proxHeartBus);
  // noise buffers: 2 s white, 4 s pink (Kellet), both reused everywhere
  noiseBuf = ac.createBuffer(1, sr * 2, sr); { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  pinkBuf = ac.createBuffer(1, sr * 4, sr);
  { const d = pinkBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } }
  // warm pad: 4 voices × 2 detuned saws → breathing lowpass (persistent; chords glide)
  padLP = filt('lowpass', 1000, 0.8, gain(0.32, calmBus));
  lfo(0.11, 380, padLP.frequency);
  CALM[0].pad.forEach((m) => {
    const pair = [-7, 7].map((dc) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dc; o.connect(gain(0.05, padLP)); o.start(); return o; });
    padV.push(pair);
  });
  // tremolo strings: a dissonant 3-note cluster, amplitude-tremoloed (persistent, follows the chord root)
  strLP = filt('lowpass', 1200, 1.5);
  const trem = gain(0.5, strBus); strLP.connect(trem); lfo(11, 0.48, trem.gain);
  [0, 1, 6].forEach((iv) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(CALM[0].root + 24 + iv); o.connect(gain(0.06, strLP)); o.start(); strOsc.push({ o, iv }); });
  // ambience: wind (pink → wandering lowpass → gusting gain) + leaf rustle
  const windLP = filt('lowpass', 480, 0.6); const windG = gain(0.5, ambBus); windLP.connect(windG);
  loopSrc(pinkBuf, windLP); lfo(0.067, 260, windLP.frequency); lfo(0.113, 0.26, windG.gain);
  const leafBP = filt('bandpass', 4200, 0.7); const leafG = gain(0.035, ambBus); leafBP.connect(leafG);
  loopSrc(noiseBuf, leafBP); lfo(0.17, 0.03, leafG.gain);
  // water-spray loop: white noise → band → pump tremolo at the 0.085 s fire cadence → gate
  sprayG = gain(0, sfxBus);
  const pump = gain(0.8, sprayG); lfo(1 / 0.085, 0.22, pump.gain);
  const sprBP = filt('bandpass', 3300, 0.6, pump); const sprHP = filt('highpass', 1100, 0.7, sprBP);
  loopSrc(noiseBuf, sprHP);
  setInterval(sched, 30);
}

// ------------------------------------------------------------------ unlock / mute / visibility
function unlock() {
  if (!AC) return;
  if (!ac) {
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ac = new AC(); } catch (e2) { return; } }
    build();
  }
  if (!unlocked) {   // iOS: a silent buffer started inside the gesture unlocks output
    const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0);
    unlocked = true;
  }
  if (!muted && ac.state !== 'running' && !document.hidden) ac.resume().catch(() => {});
}
if (typeof addEventListener === 'function') {
  for (const ev of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click']) addEventListener(ev, unlock, { capture: true, passive: true });
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend().catch(() => {});
    else if (!muted && unlocked) ac.resume().catch(() => {});
  });
}
function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
  if (!ac) return muted;
  const now = ac.currentTime;
  master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(muted ? 0 : 0.9, now, 0.04);
  if (muted) setTimeout(() => { if (muted) ac.suspend().catch(() => {}); }, 160);
  else ac.resume().catch(() => {});
  return muted;
}

// ------------------------------------------------------------------ voices
const release = () => { voices--; };
function live(essential) {
  if (!ac || ac.state !== 'running') return false;   // never queue sounds into a suspended context
  if (!essential && voices >= MAXV) return false;
  voices++; return true;
}
function route(n, dest, pan, verb) {
  let o = n;
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); o = p; }
  o.connect(dest);
  if (verb) o.connect(gain(verb, verbIn));
}
function envelope(g, t, vol, a, dur, hold = 0) {
  vol = Math.max(vol, 0.0002);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a);
  if (hold) g.gain.setValueAtTime(vol, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + hold + 0.01));
}
function vibrato(o, t, dur, vib) {
  const l = ac.createOscillator(); l.frequency.value = vib[0];
  const lg = ac.createGain(); lg.gain.setValueAtTime(vib[2] ? 0 : vib[1], t); if (vib[2]) lg.gain.linearRampToValueAtTime(vib[1], t + vib[2]);
  l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
}
// enveloped oscillator
function tone(t, f, dur, o = {}) {
  if (!live(o.essential)) return;
  const os = ac.createOscillator(), g = ac.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
  if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || dur));
  if (o.vib) vibrato(os, t, dur, o.vib);
  envelope(g, t, o.vol ?? 0.2, o.a ?? 0.005, dur, o.hold);
  os.connect(g); route(g, o.dest || sfxBus, o.pan, o.verb);
  os.start(t); os.stop(t + dur + 0.05); os.onended = release;
}
// enveloped oscillator through a sweeping resonant lowpass (stabs, pulse, brass)
function synth(t, f, dur, o = {}) {
  if (!live(o.essential)) return;
  const os = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
  os.type = o.type || 'sawtooth'; os.frequency.setValueAtTime(f, t);
  if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
  if (o.vib) vibrato(os, t, dur, o.vib);
  fl.type = 'lowpass'; fl.Q.value = o.q ?? 1; fl.frequency.setValueAtTime(o.cut0 || 2000, t);
  if (o.cutPeak) fl.frequency.exponentialRampToValueAtTime(o.cutPeak, t + dur * 0.25);
  fl.frequency.exponentialRampToValueAtTime(o.cut1 || 400, t + dur);
  envelope(g, t, o.vol ?? 0.1, o.a ?? 0.008, dur, o.hold);
  os.connect(fl); fl.connect(g); route(g, o.dest || sfxBus, o.pan, o.verb);
  os.start(t); os.stop(t + dur + 0.05); os.onended = release;
}
// filtered noise burst (random offset into the shared buffer)
function noise(t, dur, o = {}) {
  if (!live(o.essential)) return;
  const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; fl.type = o.type || 'bandpass'; fl.Q.value = o.q ?? 0.8;
  fl.frequency.setValueAtTime(o.f || 1000, t); if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
  envelope(g, t, o.vol ?? 0.2, o.a ?? 0.003, dur, o.hold);
  src.connect(fl); fl.connect(g); route(g, o.dest || sfxBus, o.pan, o.verb);
  src.start(t, Math.random() * Math.max(0, 1.95 - dur)); src.stop(t + dur + 0.03); src.onended = release;
}
// wooden creak: a slow, jittery sawtooth (stick-slip pulses) through a resonant body
function creakAt(t, dur, o = {}) {
  if (!live(o.essential)) return;
  const os = ac.createOscillator(), b1 = ac.createBiquadFilter(), b2 = ac.createBiquadFilter(), g = ac.createGain();
  const f0 = o.f0 || 40, f1 = o.f1 || 60, bp = o.bp || 900;
  os.type = 'sawtooth'; os.frequency.setValueAtTime(f0, t);
  for (let i = 1; i <= 9; i++) os.frequency.linearRampToValueAtTime(lerp(f0, f1, i / 9) * rnd(0.75, 1.3), t + (dur * i) / 9);
  b1.type = 'bandpass'; b1.frequency.value = bp; b1.Q.value = 4;
  b2.type = 'peaking'; b2.frequency.value = bp * 2.4; b2.Q.value = 5; b2.gain.value = 10;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.5, t + dur * 0.2);
  g.gain.setValueAtTime(o.vol ?? 0.5, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
  os.connect(b1); b1.connect(b2); b2.connect(g); route(g, o.dest || sfxBus, o.pan, o.verb);
  os.start(t); os.stop(t + dur + 0.05); os.onended = release;
}
const now = () => ac.currentTime + 0.01;

// positional helper: distance gain + stereo pan relative to the listener (player position, camera yaw)
function spatial(x, z, ref = 5) {
  if (x == null) return { g: 1, pan: 0, d: 0 };
  const dx = x - S.lx, dz = z - S.lz, d = Math.hypot(dx, dz) || 0.001;
  const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw), rx = -fz, rz = fx;
  const pan = clamp((dx * rx + dz * rz) / d, -1, 1) * Math.min(1, d / 2) * 0.85;
  return { g: 1 / (1 + Math.pow(d / ref, 1.7)), pan, d };
}

// ------------------------------------------------------------------ instruments
function harp(t, m, vel = 1, dest = calmBus) {
  const f = mtof(m);
  tone(t, f, 1.5, { type: 'triangle', vol: 0.085 * vel, a: 0.004, dest });
  tone(t, f * 2, 0.45, { vol: 0.028 * vel, a: 0.002, dest });
}
function ocarina(t, m, dur) {
  const f = mtof(m);
  tone(t, f, dur + 0.3, { vol: 0.12, a: 0.07, hold: Math.max(0, dur - 0.12), vib: [5.3, f * 0.008, 0.25], dest: melBus });
  tone(t, f * 2, dur + 0.2, { type: 'triangle', vol: 0.014, a: 0.05, hold: Math.max(0, dur - 0.12), dest: melBus });
}
function bassNote(t, m, dur, vol = 0.16, dest = calmBus) {
  const f = mtof(m);
  tone(t, f, dur, { vol, a: 0.02, dest });
  tone(t, f * 2, dur * 0.6, { type: 'triangle', vol: vol * 0.3, a: 0.02, dest });
}
function pizz(t, m, vol = 0.2, dest = hideBus) {
  const f = mtof(m);
  tone(t, f, 0.24, { type: 'triangle', vol, a: 0.003, dest });
  tone(t, f * 2, 0.08, { vol: vol * 0.4, a: 0.002, dest });
}
function woodblock(t, hi, vol = 0.12, dest = hideBus) {
  const f = hi ? 1750 : 1250;
  tone(t, f, 0.05, { vol, a: 0.001, dest });
  tone(t, f * 2.6, 0.025, { vol: vol * 0.35, a: 0.001, dest });
}
function shaker(t, vol = 0.045, dest = hideBus) { noise(t, 0.05, { type: 'highpass', f: 6500, q: 0.7, vol, a: 0.012, dest }); }
function bell(t, m, vol = 0.07, dest = sfxBus) {
  const f = mtof(m);
  tone(t, f, 1.3, { vol, a: 0.002, dest, verb: 0.4 });
  tone(t, f * 2.76, 0.5, { vol: vol * 0.3, a: 0.001, dest, verb: 0.4 });
}
function marimba(t, m, vel = 1, dest = calmBus) {
  const f = mtof(m);
  tone(t, f, 0.34, { type: 'triangle', vol: 0.105 * vel, a: 0.002, dest, verb: 0.18 });
  tone(t, f * 4, 0.065, { type: 'sine', vol: 0.036 * vel, a: 0.001, dest });
  noise(t, 0.016, { type: 'bandpass', f: Math.min(7200, f * 3.2), q: 1.8, vol: 0.025 * vel, a: 0.001, dest });
}
function brushedSnare(t, accent = 1, dest = calmBus) {
  noise(t, 0.085, { type: 'bandpass', f: 4300, f1: 2900, q: 0.85, vol: 0.072 * accent, a: 0.003, dest });
  noise(t, 0.045, { type: 'highpass', f: 6800, q: 0.7, vol: 0.042 * accent, a: 0.002, dest });
  tone(t, 235, 0.04, { f1: 145, type: 'triangle', vol: 0.048 * accent, a: 0.001, dest });
}
function heartbeat(t) {
  tone(t, 64, 0.2, { f1: 40, vol: 0.9, a: 0.004, dest: heartBus, essential: true });
  tone(t, 150, 0.07, { f1: 70, type: 'triangle', vol: 0.45, a: 0.002, dest: heartBus });
  tone(t + 0.17, 56, 0.22, { f1: 36, vol: 0.6, a: 0.004, dest: heartBus });
  tone(t + 0.17, 130, 0.06, { f1: 62, type: 'triangle', vol: 0.3, a: 0.002, dest: heartBus });
}
/**
 * Warm muffled chest `lub-dub` heartbeat through a dedicated 150Hz low-pass filter:
 * - Primary thump ("lub"): 56Hz -> 36Hz
 * - Valve beat ("dub") 115ms later: 68Hz -> 42Hz
 */
function heartbeatLubDub(intensity01 = 0.7, atTime = null) {
  if (!ac || ac.state !== 'running' || !proxHeartLP) return false;
  const v = clamp(Number.isFinite(+intensity01) ? +intensity01 : 0.7, 0.05, 1);
  const t = typeof atTime === 'number' ? Math.max(ac.currentTime + 0.004, atTime) : now();
  const lubVol = lerp(0.30, 0.88, v);
  const dubVol = lerp(0.24, 0.72, v);
  // Primary "lub" thump (56Hz -> 36Hz)
  tone(t, 56, 0.145, { f1: 36, type: 'sine', vol: lubVol, a: 0.006, dest: proxHeartLP, essential: true });
  tone(t, 84, 0.09, { f1: 44, type: 'triangle', vol: lubVol * 0.32, a: 0.004, dest: proxHeartLP });
  // Secondary "dub" valve beat 115ms later (68Hz -> 42Hz)
  tone(t + 0.115, 68, 0.125, { f1: 42, type: 'sine', vol: dubVol, a: 0.005, dest: proxHeartLP, essential: true });
  tone(t + 0.115, 96, 0.075, { f1: 50, type: 'triangle', vol: dubVol * 0.28, a: 0.004, dest: proxHeartLP });
  return true;
}

function proxDangerBpm(v) {
  const t01 = clamp((v - 0.05) / 0.95, 0, 1);
  return lerp(68, 138, t01);
}

function emitHeartbeatPulse(intensity01, bpm, inlineCb = null) {
  S.proxPulsePending = true;
  if (typeof inlineCb === 'function') {
    try { inlineCb(intensity01, bpm); } catch (_) { /* ignore cb error */ }
  }
  if (typeof directHeartbeatCb === 'function' && directHeartbeatCb !== inlineCb) {
    try { directHeartbeatCb(intensity01, bpm); } catch (_) { /* ignore cb error */ }
  }
  heartbeatListeners.forEach((fn) => {
    if (fn !== inlineCb && fn !== directHeartbeatCb) {
      try { fn(intensity01, bpm); } catch (_) { /* ignore cb error */ }
    }
  });
}

// ------------------------------------------------------------------ scheduler
function isFeverTime() {
  return Boolean((S.mode === 'seek' || S.mode === 'survive') && S.timeLeft > 0 && S.timeLeft <= 25);
}
function stepDur() {
  const m = S.mode, T = S.threatS;
  if (m === 'seek' || (m === 'survive' && isFeverTime())) {
    if (isFeverTime()) return 0.158;   // ~1.45x mischievous Storybook chase tempo (~190 eighth-note cadence)
    return 0.23 / (1 + 0.05 * T);      // calm/normal seek cadence (~0.23s/eighth)
  }
  const tl = S.timeLeft > 0 ? S.timeLeft : 25;
  const bpm = m === 'hide' ? 132 + 36 * clamp(1 - tl / 25, 0, 1) : m === 'survive' ? 80 + 18 * T : 76;
  return 30 / bpm;   // one eighth note
}
function setP(key, param, v, t, tau) {
  const old = S.set.get(key);
  if (old !== undefined && Math.abs(old - v) < 0.002) return;
  S.set.set(key, v); param.setTargetAtTime(v, t, tau);
}
function mix(t) {
  const m = S.mode, T = S.threatS, fever = isFeverTime();
  const ten = m === 'survive' || m === 'seek', Tm = ten ? T : 0, lv = S.lv;
  if (fever) {
    // Fever Time keeps the Storybook marimba/brass chase bright, open, and celebratory!
    lv.calm = 0.94;
    lv.mel = 0.96;
  } else {
    lv.calm = ({ menu: 0.7, survive: 1, seek: 0.85 }[m] || 0) * (1 - 0.82 * sm(0.2, 0.85, Tm));
    lv.mel = 1 - sm(0.22, 0.5, Tm);
  }
  lv.hide = m === 'hide' ? 1 : 0;
  lv.pulse = ten ? (fever ? 0.35 : sm(0.06, 0.38, T)) : 0;
  // Suppress legacy oscillator heartbeat when realistic proximity chest lub-dub is active
  lv.heart = (ten && S.proxDanger <= 0.05 && !fever) ? sm(0.3, 0.6, T) : 0;
  lv.str = (ten && !fever) ? sm(0.55, 0.9, T) : 0;
  lv.tick = ten ? (fever ? 0.28 : sm(0.6, 0.92, T)) : 0;
  lv.amb = (m === 'end' ? 0.8 : 1) * (fever ? 0.55 : (1 - 0.78 * sm(0.25, 0.9, Tm)));
  const tau = m === 'end' ? 0.12 : fever ? 0.16 : 0.3;
  setP('calm', calmBus.gain, lv.calm, t, tau); setP('mel', melBus.gain, lv.mel, t, 0.35);
  setP('hide', hideBus.gain, lv.hide * 0.9, t, 0.12);
  setP('pulse', pulseBus.gain, lv.pulse * 1.15, t, tau); setP('heart', heartBus.gain, lv.heart * 1.5, t, tau);
  setP('str', strBus.gain, lv.str * 1.25, t, tau); setP('tick', tickBus.gain, lv.tick * 0.65, t, tau);
  setP('amb', ambBus.gain, lv.amb * 0.55, t, 0.6);
  const targetLP = fever ? 10200 : (11000 * (1 - 0.93 * sm(0.3, 0.95, Tm)) + 300);
  setP('lp', calmLP.frequency, targetLP, t, fever ? 0.18 : 0.4);
  setP('strlp', strLP.frequency, 900 + 2400 * T, t, 0.3);
}
function sched() {
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime, dt = Math.min(0.5, Math.max(0, t - (S.last || t))); S.last = t;
  // fast attack, slow release: the dread lingers after a seeker walks past
  S.threatS += (S.threat - S.threatS) * (1 - Math.exp(-dt / (S.threat > S.threatS ? 0.35 : 1.8)));
  mix(t);
  if (S.next < t) S.next = t + 0.05;
  while (S.next < t + LOOK) { const d = stepDur(); musicStep(S.step, S.next, d); S.next += d; S.step++; }
  // Proximity danger realistic chest lub-dub (68 -> 138 BPM when S.proxDanger > 0.05)
  if (S.proxDanger > 0.05) {
    if (!S.proxHbAudio || S.proxHbAudio < t) S.proxHbAudio = t + 0.025;
    while (S.proxHbAudio < t + LOOK) {
      const intensitySnap = S.proxDanger;
      const bpmSnap = proxDangerBpm(intensitySnap);
      const beatAt = S.proxHbAudio;
      heartbeatLubDub(intensitySnap, beatAt);
      const delayMs = Math.max(0, (beatAt - ac.currentTime) * 1000);
      if (delayMs <= 14 || typeof setTimeout !== 'function') {
        emitHeartbeatPulse(intensitySnap, bpmSnap);
      } else {
        setTimeout(() => {
          if (S.proxDanger > 0.05) emitHeartbeatPulse(S.proxDanger, proxDangerBpm(S.proxDanger));
        }, delayMs);
      }
      const period = 60 / bpmSnap;
      S.proxHbAudio += period;
      S.proxHbWall = wallSec() + period;
    }
  } else {
    S.proxHbAudio = 0;
  }
  // legacy background tension heartbeat when proximity danger isn't active
  if (S.lv.heart < 0.02) S.hb = t + 0.1;
  else while (S.hb < t + LOOK) { if (S.hb < t) S.hb = t + 0.02; heartbeat(S.hb); S.hb += 60 / (64 + 86 * S.threatS); }
  countdown(t);
  ambience(t);
}
const tick = sched;
function musicStep(i, t, d) {
  const m = S.mode;
  if (m === 'hide') return hideStep(i, t, d);
  if (m !== 'menu' && m !== 'survive' && m !== 'seek') return;
  const bar = (i >> 3) % 4, s = i & 7, ch = CALM[bar], seek = m === 'seek', fever = isFeverTime(), lv = S.lv;
  if (s === 0) {
    padV.forEach((pair, k) => pair.forEach((o) => o.frequency.setTargetAtTime(mtof(ch.pad[k]), t, fever ? 0.05 : 0.09)));
    strOsc.forEach(({ o, iv }) => o.frequency.setTargetAtTime(mtof(ch.root + 24 + iv), t, 0.05));
  }
  if (fever) {
    // 🔥 FEVER TIME (Final 25s in Seek): Lively octave pizzicato bass + bright marimba sparkles + crisp brushed-snare offbeats!
    const pat = (i >> 3) & 1 ? ARP_B : ARP_A;
    const arpMidi = ch.arp[pat[s]] + 12;
    marimba(t + rnd(0, 0.006), arpMidi, s % 2 === 0 ? 1.0 : 0.84, calmBus);
    if (s === 2 || s === 6) {
      const graceMidi = ch.arp[(pat[s] + 1) % ch.arp.length] + 12;
      marimba(t + d * 0.5, graceMidi, 0.62, calmBus);
    }
    // Lively octave-bouncing pizzicato bass
    if (s % 2 === 0) {
      const bRoot = ch.root + (s === 4 ? 7 : 0);
      pizz(t, bRoot, 0.25, calmBus);
      bassNote(t, bRoot, d * 1.35, 0.17, calmBus);
    } else {
      const octNote = ch.root + 12 + (s === 5 ? 7 : 0);
      pizz(t, octNote, 0.20, calmBus);
      brushedSnare(t, (s === 3 || s === 7) ? 1.15 : 0.88, calmBus);
    }
    if (s === 6) brushedSnare(t + d * 0.5, 0.52, calmBus);
    // Playful Storybook brass stabs on bar downbeats & syncopations
    if (s === 0 || (s === 3 && bar % 2 === 0)) {
      ch.pad.slice(1, 4).forEach((pm) => synth(t, mtof(pm + 12), d * 0.72, {
        type: 'sawtooth', vol: 0.042, cut0: 1400, cutPeak: 3400, cut1: 900, q: 1.4, a: 0.005, dest: calmBus,
      }));
    }
    // Jaunty melody continuously dancing (no 4-bar rest during Fever Time!)
    const mel = ((i >> 5) & 1) ? MEL_B : MEL_A;
    const n = mel[i & 31];
    if (n) {
      ocarina(t, n[0], Math.min(n[1] * d * 0.88, 0.48));
      if (n[1] >= 2) bell(t, n[0] + 12, 0.032, calmBus);
    }
    return;
  }
  if (lv.calm > 0.02) {
    const pat = (i >> 3) & 1 ? ARP_B : ARP_A;
    if (!(s === 7 && Math.random() < 0.35)) harp(t + rnd(0, 0.012), ch.arp[pat[s]], (s % 2 ? 0.75 : 1) * rnd(0.85, 1.05));
    if (seek) {
      if (s % 2 === 0) bassNote(t, ch.root + (s === 4 ? 7 : 0), d * 1.6, 0.17);
      else shaker(t, 0.05, calmBus);
    } else if (s === 0) bassNote(t, ch.root, d * 7.5);
    else if (s === 4 && bar % 2) bassNote(t, ch.root + 7, d * 3.5, 0.1);
    // melody: A · B · A · (rest) — 16-bar cycle
    const cyc = (i >> 5) % 4;
    const mel = cyc === 3 ? null : cyc === 1 ? MEL_B : MEL_A;
    const n = mel && mel[i & 31];
    if (n && lv.mel > 0.02) ocarina(t, n[0], n[1] * d * 0.95);
    if (cyc === 3 && s === 0 && Math.random() < 0.6) bell(t + d * 2, pick(ch.arp) + 12, 0.03, calmBus);
  }
  // tension layers
  if (lv.pulse > 0.02) synth(t, mtof(ch.root), d * 0.9, { type: 'sawtooth', vol: s % 2 ? 0.16 : 0.24, cut0: 260 + 700 * S.threatS, cut1: 110, q: 4, a: 0.004, dest: pulseBus });
  if (lv.tick > 0.02) { woodblock(t, s % 2 === 0, 0.1, tickBus); if (S.threatS > 0.85) woodblock(t + d / 2, false, 0.06, tickBus); }
}
function hideStep(i, t, d) {
  const s = i & 31, bar = s >> 3, b = s & 7;
  const urg = S.timeLeft > 0 ? clamp(1 - S.timeLeft / 25, 0, 1) : 0;
  if (b % 2 === 0) pizz(t, HBASS[bar][b >> 1], 0.22);
  else (bar === 3 && b > 3 ? HSTAB[1] : HSTAB[bar]).forEach((m) => tone(t, mtof(m), 0.1, { type: 'triangle', vol: 0.032, a: 0.003, dest: hideBus }));
  // the tiptoe motif plays every other pass, then every pass once time gets short
  const n = HMOT[s];
  if (n && ((i >> 5) % 2 === 0 || urg > 0.45)) {
    synth(t, mtof(n), d * 0.6, { type: 'square', vol: 0.05, cut0: 2600, cut1: 900, q: 0.8, a: 0.004, dest: hideBus });
    if (b % 4 === 0) tone(t, mtof(n + 12), 0.3, { vol: 0.03, a: 0.002, dest: hideBus });
  }
  if (b === 0 || b === 4) woodblock(t, b === 0, 0.1);
  if (urg > 0.55) { shaker(t); shaker(t + d / 2, 0.03); }
}
// last 10 seconds: ticks that accelerate from 1/s to 4/s, rising in pitch, with a thump in the last 3
function countdown(t) {
  const tl = S.timeLeft, m = S.mode;
  if (!(tl > 0 && tl <= 10 && (m === 'hide' || m === 'survive' || m === 'seek'))) { S.cd = 0; return; }
  if (!S.cd || S.cd < t) S.cd = t + 0.02;
  while (S.cd < t + LOOK) {
    const left = tl - (S.cd - t); if (left <= 0) { S.cd = t + 10; break; }
    const urg = 1 - left / 10, hi = S.cdN++ % 2 === 0, f = (hi ? 1650 : 1250) * (1 + urg * 0.4);
    tone(S.cd, f, 0.045, { vol: 0.2 + urg * 0.16, a: 0.001, essential: true });
    tone(S.cd, f * 2.6, 0.02, { vol: 0.05 + urg * 0.05, a: 0.001 });
    if (left < 3) tone(S.cd, 95, 0.14, { f1: 50, vol: 0.5, a: 0.003 });
    S.cd += lerp(1, 0.25, Math.pow(urg, 1.2));
  }
}
function bird(t) {
  const p = rnd(-0.8, 0.8), v = rnd(0.5, 1), kind = (Math.random() * 3) | 0, o = { dest: ambBus, pan: p, verb: 0.25 };
  if (kind === 0) {   // two-note "fee-bee"
    tone(t, 3150, 0.14, { ...o, f1: 2950, vol: 0.05 * v, a: 0.02 });
    tone(t + 0.2, 2500, 0.2, { ...o, f1: 2450, vol: 0.045 * v, a: 0.02 });
  } else if (kind === 1) {   // trill
    const n = 5 + ((Math.random() * 5) | 0), f = rnd(3600, 4400);
    for (let k = 0; k < n; k++) tone(t + k * 0.05, f, 0.035, { ...o, f1: f * 0.82, vol: 0.035 * v, a: 0.004 });
  } else {   // warble
    tone(t, rnd(2200, 2700), 0.4, { ...o, vol: 0.04 * v, a: 0.05, vib: [24, 260] });
  }
}
function ambience(t) {
  if (S.bird < t) { S.bird = t + rnd(2.5, 7); if (S.threatS < 0.45) bird(t + 0.05); }   // birds go quiet when danger is near
  if (S.mill < t) { S.mill = t + rnd(8, 15); creakAt(t + 0.05, rnd(1.1, 1.7), { f0: 20, f1: 28, bp: 430, vol: 0.18, dest: ambBus, pan: -0.45, verb: 0.3 }); }
}

// ------------------------------------------------------------------ SFX (public)
function tap() { if (!ac) return; const t = now(); tone(t, 520, 0.07, { f1: 1040, vol: 0.12, a: 0.002 }); tone(t, 1560, 0.03, { vol: 0.03, a: 0.001 }); }
// Juicy rising-pitch squishy-pop hit confirm on disguised hiders (+ splash burst on elimination)
function hitConfirm(streak = 0, isElim = false) {
  if (!ac) return;
  const t = now();
  const s = clamp(Number(streak) || 0, 0, 10);
  const semi = Math.pow(2, (s * 0.85) / 12);
  tone(t, 340 * semi, 0.075, { f1: 680 * semi, type: 'triangle', vol: 0.24, a: 0.002, essential: true });
  tone(t + 0.012, 920 * semi, 0.055, { f1: 1240 * semi, type: 'sine', vol: 0.14, a: 0.002 });
  noise(t, 0.04, { type: 'bandpass', f: 1900 * semi, q: 1.4, vol: 0.16, a: 0.001 });
  if (isElim) {
    [76, 80, 83, 88].forEach((m, i) => tone(t + 0.02 + i * 0.032, mtof(m), 0.26, { type: 'triangle', vol: 0.14, a: 0.003, verb: 0.35, essential: true }));
    noise(t + 0.01, 0.18, { type: 'bandpass', f: 2400, f1: 720, q: 0.9, vol: 0.28, a: 0.004 });
  }
}
// AAA killstreak brassy chime fanfare (2x Double, 3x Triple, 4x Mega, 5x Ace!)
function streakFanfare(streakCount = 2) {
  if (!ac) return;
  const t = now();
  const c = clamp(Number(streakCount) || 2, 2, 5);
  const chords = {
    2: [72, 76, 79, 84],
    3: [74, 78, 81, 86, 90],
    4: [76, 80, 83, 88, 92],
    5: [72, 76, 79, 83, 86, 91, 96],
  };
  const notes = chords[c] || chords[2];
  notes.forEach((m, i) => {
    tone(t + i * 0.045, mtof(m), 0.34, { type: 'triangle', vol: 0.13, a: 0.004, verb: 0.42, essential: true });
    tone(t + i * 0.045 + 0.01, mtof(m + 12), 0.22, { type: 'sine', vol: 0.055, a: 0.004, verb: 0.48 });
  });
}
// Playful bubbly pop when firing an emote
function emotePop() {
  if (!ac) return;
  const t = now();
  tone(t, 420, 0.08, { f1: 780, type: 'sine', vol: 0.18, a: 0.003, verb: 0.25, essential: true });
  tone(t + 0.045, 760, 0.11, { f1: 1080, type: 'triangle', vol: 0.11, a: 0.003, verb: 0.3 });
}
// Tactile impact-scaled landing thud
function landThud(strength = 0.6) {
  if (!ac) return;
  const t = now();
  const k = clamp(Number(strength) || 0.5, 0.2, 1.4);
  tone(t, 118 - k * 18, 0.11, { f1: 48, type: 'triangle', vol: 0.18 * k, a: 0.002 });
  noise(t, 0.06, { type: 'lowpass', f: 680 + k * 300, vol: 0.11 * k, a: 0.002 });
}
// Hollow wooden / ceramic clunk when spraying a real world prop
function propClunk(ceramic = false) {
  if (!ac) return;
  const t = now();
  if (ceramic) {
    tone(t, rnd(620, 760), 0.085, { f1: rnd(480, 560), type: 'triangle', vol: 0.17, a: 0.001, verb: 0.22 });
    tone(t + 0.01, rnd(1320, 1540), 0.055, { type: 'sine', vol: 0.09, a: 0.001 });
  } else {
    tone(t, rnd(165, 225), 0.11, { f1: rnd(95, 130), type: 'triangle', vol: 0.22, a: 0.002, verb: 0.18 });
    noise(t, 0.045, { type: 'bandpass', f: rnd(850, 1150), q: 2.2, vol: 0.14, a: 0.001 });
  }
}
// Playful rubbery squeak layered on disguised player hits
function propSqueak() {
  if (!ac) return;
  const t = now();
  tone(t, rnd(740, 880), 0.085, { f1: rnd(1260, 1480), type: 'sine', vol: 0.13, a: 0.003, verb: 0.2 });
}
// Subtle proximity Geiger tick for Seeker crosshair heat-arc
function heatTick(intensity = 0.5) {
  if (!ac) return;
  const t = now();
  const k = clamp(Number(intensity) || 0.4, 0.1, 1);
  tone(t, 920 + k * 540, 0.032, { f1: 720 + k * 420, type: 'sine', vol: 0.055 + k * 0.06, a: 0.001 });
}
// Comic spring boing-bonk when Hider stun-boops a Seeker
function boopStun() {
  if (!ac) return;
  const t = now();
  tone(t, 260, 0.14, { f1: 690, type: 'triangle', vol: 0.26, a: 0.002, verb: 0.3, essential: true });
  tone(t + 0.06, 860, 0.22, { f1: 360, type: 'sine', vol: 0.16, a: 0.004, vib: [14, 48, 0.02], verb: 0.36 });
  noise(t, 0.08, { type: 'bandpass', f: 1400, q: 1.2, vol: 0.18, a: 0.002 });
}
// Heroic bubble-pop & ascending chord when rescuing a trapped teammate
function rescueFanfare() {
  if (!ac) return;
  const t = now();
  tone(t, 380, 0.06, { f1: 980, type: 'sine', vol: 0.24, a: 0.002, essential: true });
  [72, 76, 79, 84, 88].forEach((m, i) => {
    tone(t + 0.035 + i * 0.045, mtof(m), 0.32, { type: 'triangle', vol: 0.14, a: 0.003, verb: 0.42, essential: true });
  });
}
// GTA-style escalating Wanted / Mischief Star pulse chime (1..5 stars)
function wantedStarUp(stars = 1) {
  if (!ac) return;
  const t = now();
  const s = clamp(Number(stars) || 1, 1, 5);
  const root = 67 + s * 2;
  tone(t, mtof(root), 0.14, { type: 'triangle', vol: 0.19, a: 0.003, verb: 0.32, essential: true });
  tone(t + 0.065, mtof(root + 7), 0.22, { type: 'sine', vol: 0.15, a: 0.003, verb: 0.38 });
}
// Sleek swoosh chord when losing Wanted Heat via clean disguise swap
function heatCooled() {
  if (!ac) return;
  const t = now();
  [79, 83, 86, 91].forEach((m, i) => {
    tone(t + i * 0.038, mtof(m), 0.28, { type: 'sine', vol: 0.12, a: 0.004, verb: 0.45, essential: true });
  });
}
// Crisp tactical 3D Squad Ping chirp
function squadPing(kind = 'check') {
  if (!ac) return;
  const t = now();
  const f0 = kind === 'danger' ? 680 : (kind === 'rescue' ? 880 : 780);
  const f1 = kind === 'danger' ? 520 : (kind === 'rescue' ? 1280 : 1120);
  tone(t, f0, 0.09, { f1, type: 'sine', vol: 0.18, a: 0.002, verb: 0.28, essential: true });
  tone(t + 0.075, f1, 0.11, { type: 'triangle', vol: 0.10, a: 0.002, verb: 0.35 });
}
function poof(back = false) {
  if (!ac) return; const t = now();
  noise(t, 0.42, { type: 'bandpass', f: back ? 500 : 3200, f1: back ? 3200 : 420, q: 0.9, vol: 0.38, a: 0.006, verb: 0.3, essential: true });
  tone(t, back ? 90 : 210, 0.3, { f1: back ? 220 : 55, vol: 0.32, a: 0.004 });
  const notes = [84, 86, 88, 91, 93, 96]; if (back) notes.reverse();
  notes.forEach((m, i) => tone(t + 0.05 + i * 0.035, mtof(m), 0.38, { vol: 0.05, a: 0.002, verb: 0.5, pan: rnd(-0.4, 0.4) }));
}
function creak() {
  if (!ac) return; const t = now();
  creakAt(t, 0.3, { f0: rnd(36, 48), f1: rnd(55, 78), bp: rnd(800, 1150), vol: 0.6, essential: true });
  tone(t + 0.28, 150, 0.07, { f1: 105, type: 'triangle', vol: 0.13, a: 0.002 });
}
// surface: 'grass' | 'cobble' | 'hop' (a disguised prop hopping along)
function stepAt(t, surface, vol, pan, low = 1) {
  if (surface === 'cobble') {
    noise(t, 0.03, { type: 'highpass', f: 2600, vol: 0.1 * vol, pan, a: 0.001 });
    tone(t, rnd(180, 235) * low, 0.045, { f1: 130 * low, type: 'triangle', vol: 0.09 * vol, pan, a: 0.001 });
  } else if (surface === 'hop') {
    tone(t, rnd(150, 185) * low, 0.09, { f1: 95 * low, type: 'triangle', vol: 0.17 * vol, pan, a: 0.002 });
    noise(t, 0.035, { type: 'lowpass', f: 1300, vol: 0.12 * vol, pan, a: 0.001 });
  } else {
    noise(t, 0.085, { type: 'bandpass', f: rnd(1800, 2900) * low, q: 0.7, vol: 0.13 * vol, pan, a: 0.006 });
    tone(t, 95 * low, 0.05, { f1: 60, vol: 0.08 * vol, pan, a: 0.003 });
  }
}
function step(surface = 'grass') { if (!ac) return; const t = now(); if (t - S.lastStep < 0.09) return; S.lastStep = t; stepAt(t, surface, 0.55, 0); }
function jump() {
  if (!ac) return; const t = now();
  tone(t, 210, 0.22, { f1: 560, vol: 0.13, a: 0.004, vib: [18, 22] });
  noise(t, 0.16, { type: 'bandpass', f: 1200, f1: 2700, q: 0.8, vol: 0.08, a: 0.01 });
}
function land() { if (!ac) return; const t = now(); tone(t, 120, 0.1, { f1: 58, vol: 0.26, a: 0.002 }); noise(t, 0.05, { type: 'lowpass', f: 900, vol: 0.13, a: 0.001 }); }
// player's water sprayer: call every frame with the firing state; a looped hiss with pump pulses
function spray(on) {
  if (!ac || on === S.spraying) return;
  S.spraying = on; const t = now();
  sprayG.gain.cancelScheduledValues(t); sprayG.gain.setTargetAtTime(on ? 0.26 : 0, t, on ? 0.02 : 0.06);
  if (on) noise(t, 0.09, { type: 'highpass', f: 2000, vol: 0.18, a: 0.002 });
  else tone(t + 0.08, rnd(900, 1200), 0.05, { f1: 1900, vol: 0.05, a: 0.002 });
}
function shot(x, z) {   // a seeker's spray burst (positional)
  if (!ac) return; const t = now(); if (t - S.lastShot < 0.05) return; S.lastShot = t;
  const sp = spatial(x, z, 6); if (sp.g < 0.03) return;
  noise(t, 0.17, { type: 'bandpass', f: 2700, f1: 1700, q: 0.8, vol: 0.28 * sp.g, pan: sp.pan, a: 0.004 });
}
function splash(x, z) {
  if (!ac) return; const t = now(); if (t - S.lastSplash < 0.07) return; S.lastSplash = t;
  const sp = spatial(x, z, 7); if (sp.g < 0.03) return;
  noise(t, 0.34, { type: 'lowpass', f: 3600, f1: 450, q: 0.6, vol: 0.32 * sp.g, pan: sp.pan, a: 0.003, verb: 0.15 });
  for (let k = 0; k < 3; k++) { const f = rnd(650, 1300); tone(t + rnd(0.03, 0.2), f, 0.05, { f1: f * 2, vol: 0.06 * sp.g, pan: sp.pan, a: 0.002 }); }
}
// "wrong — that was a real prop": a dull wooden bonk then a low two-note buzzer
function wrong() {
  if (!ac) return; const t = now();
  tone(t, 250, 0.15, { f1: 150, type: 'triangle', vol: 0.32, a: 0.002, essential: true });
  noise(t, 0.05, { type: 'bandpass', f: 900, vol: 0.28, a: 0.001 });
  synth(t + 0.13, 156, 0.13, { type: 'square', vol: 0.13, cut0: 1500, cut1: 900, a: 0.004, hold: 0.08 });
  synth(t + 0.3, 117, 0.32, { type: 'square', vol: 0.15, cut0: 1300, cut1: 500, a: 0.004, hold: 0.18 });
}
// big comedic-but-tense sting. caught=true: the player was found (ends with an "uh-oh" slide down)
function found(caught = false) {
  if (!ac) return; const t = now(), e = { essential: true };
  tone(t, 115, 0.75, { f1: 36, vol: 0.9, a: 0.003, ...e });
  noise(t, 0.25, { type: 'lowpass', f: 500, vol: 0.5, a: 0.002 });
  [50, 53, 56, 59, 62].forEach((m) => synth(t, mtof(m), 0.34, { type: 'sawtooth', vol: 0.075, cut0: 4500, cut1: 450, q: 1.5, a: 0.003, verb: 0.2 }));   // dim7 orchestra hit
  noise(t, 1.5, { type: 'highpass', f: 5200, vol: 0.16, a: 0.002, verb: 0.3 });   // cymbal
  if (!caught) {
    tone(t + 0.18, 650, 0.28, { f1: 1900, vol: 0.13, a: 0.02, vib: [9, 30] });   // slide whistle up
    [60, 64, 67, 72, 76].forEach((m) => synth(t + 0.46, mtof(m), 0.75, { type: 'sawtooth', vol: 0.055, cut0: 5200, cut1: 1400, q: 1, a: 0.006, hold: 0.1, verb: 0.35 }));   // "ta-da!"
    [84, 88, 91, 96].forEach((m, i) => tone(t + 0.46 + i * 0.04, mtof(m), 0.4, { vol: 0.045, a: 0.002, verb: 0.5 }));
  } else {
    tone(t + 0.22, 1500, 0.6, { f1: 280, vol: 0.13, a: 0.02, vib: [7, 25] });   // slide whistle down
  }
}
// a seeker's suspicion just crossed the line: low "dun-DUN" + a little "?!" ping
function alert(x, z) {
  if (!ac) return; const t = now(), sp = spatial(x, z, 20);
  synth(t, mtof(40), 0.22, { type: 'sawtooth', vol: 0.15, cut0: 900, cut1: 200, q: 3, a: 0.005, essential: true });
  synth(t + 0.24, mtof(41), 0.55, { type: 'sawtooth', vol: 0.2, cut0: 1100, cut1: 180, q: 3, a: 0.005, verb: 0.2 });
  tone(t + 0.24, 1100, 0.13, { f1: 1550, type: 'triangle', vol: 0.06, a: 0.003, pan: sp.pan });
}
function sniffAt(t, g, pan) { for (let k = 0; k < 3; k++) noise(t + k * 0.13, 0.085, { type: 'bandpass', f: 1400, f1: 2600, q: 1.3, vol: 0.24 * g, pan, a: 0.03 }); }
function sniff(x, z) { if (!ac) return; const sp = spatial(x, z, 5); if (sp.g > 0.03) sniffAt(now(), sp.g, sp.pan); }
// a seeker's footstep (call once per stride). They get louder as they close in; suspicious ones sniff.
function seekerStep(x, z, sus = 0) {
  if (!ac) return; const t = now(), sp = spatial(x, z, 5);
  if (sp.d > 26 || sp.g < 0.02) return;
  stepAt(t, Math.hypot(x, z) < 9 ? 'cobble' : 'grass', Math.min(1.4, sp.g * 1.7), sp.pan, 0.8);
  if (sus > 0.3 && sp.d < 11 && t - S.lastSniff > 1.6 && Math.random() < 0.25) { S.lastSniff = t; sniffAt(t + 0.15, sp.g, sp.pan); }
}
// a disguised hider skitters away
function scurry(x, z) {
  if (!ac) return; const t = now(), sp = spatial(x, z, 6);
  for (let k = 0; k < 7; k++) tone(t + k * 0.055, rnd(480, 820), 0.035, { type: 'triangle', vol: 0.11 * sp.g + 0.03, pan: sp.pan, a: 0.001 });
}
// 'release' — seekers open their eyes (drum + hunting horn) · 'go' — referee whistle
function cue(name) {
  if (!ac) return; const t = now();
  if (name === 'release') {
    tone(t, 95, 0.65, { f1: 46, vol: 0.9, a: 0.003, essential: true }); noise(t, 0.16, { type: 'lowpass', f: 900, vol: 0.4 });
    [52, 59].forEach((m) => synth(t + 0.1, mtof(m), 0.42, { vol: 0.08, cut0: 600, cutPeak: 1800, cut1: 700, q: 2, a: 0.03, verb: 0.4 }));
    [57, 64].forEach((m) => synth(t + 0.55, mtof(m), 1.0, { vol: 0.09, cut0: 600, cutPeak: 2000, cut1: 500, q: 2, a: 0.03, hold: 0.3, verb: 0.45 }));
  } else if (name === 'go') {
    tone(t, 2650, 0.38, { vol: 0.12, a: 0.005, hold: 0.25, vib: [32, 140], essential: true });
    tone(t + 0.45, 2650, 0.14, { vol: 0.1, a: 0.005, vib: [32, 140] });
  }
}
function win() {
  if (!ac) return; const t = now();
  [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88].forEach((m, i) => tone(t + i * 0.035, mtof(m), 0.9, { type: 'triangle', vol: 0.06, a: 0.003, verb: 0.4, essential: i === 0 }));
  [48, 55, 60, 64, 67, 71, 74].forEach((m) => tone(t + 0.45, mtof(m), 2.8, { vol: 0.045, a: 0.15, verb: 0.4 }));
  [79, 84, 88, 91].forEach((m, i) => bell(t + 0.55 + i * 0.17, m, 0.06));
}
function lose() {
  if (!ac) return; const t = now();
  // a tired "wah wah wah wahhh" muted horn, then a soft drum
  [[55, 0.3], [54, 0.3], [53, 0.3], [52, 1.1]].forEach(([m, d], i) => synth(t + i * 0.34, mtof(m), d, { type: 'sawtooth', vol: 0.12, cut0: 380, cutPeak: 1300, cut1: 420, q: 5, a: 0.02, hold: d * 0.4, vib: i === 3 ? [5, 3, 0.35] : null, essential: i === 0, verb: 0.25 }));
  tone(t + 1.4, 80, 0.5, { f1: 45, vol: 0.5, a: 0.003 });
}

/**
 * End-of-match cinematic stingers, timed so the main hit lands `slamDelay` seconds from now (the title slam).
 *   victory — snare roll swell -> timpani + cymbal + bright brass C-major stack, a rising fanfare, bell sparkle
 *   defeat  — low air drone -> deep boom + muted A-minor brass, a slow falling bell line
 *   draw    — soft roll -> suspended chord (Csus2) that never resolves, two answering bells
 */
function endSting(kind = 'victory', slamDelay = 0.78) {
  if (!ac) return; const t0 = now(), t = t0 + slamDelay;
  if (kind === 'victory') {
    for (let i = 0; i < 14; i++) brushedSnare(t0 + i * (slamDelay / 14), 0.35 + 0.65 * (i / 13), sfxBus);
    noise(t0, slamDelay, { type: 'bandpass', f: 800, f1: 5200, q: 0.9, vol: 0.09, a: slamDelay * 0.9, essential: true });
    tone(t, 92, 1.1, { f1: 44, vol: 0.95, a: 0.002, essential: true });
    tone(t, 184, 0.35, { f1: 90, type: 'triangle', vol: 0.35, a: 0.002 });
    noise(t, 2.6, { type: 'highpass', f: 5200, q: 0.6, vol: 0.16, a: 0.004, verb: 0.5 });
    [48, 55, 60, 64, 67, 72].forEach((m) => synth(t, mtof(m), 1.7, { vol: 0.07, cut0: 900, cutPeak: 4200, cut1: 1300, q: 1.6, a: 0.01, hold: 0.7, verb: 0.45 }));
    [[67, 0.28], [72, 0.28], [76, 0.28], [79, 1.4]].forEach(([m, d], i) => {
      synth(t + 0.42 + i * 0.2, mtof(m), d, { vol: 0.085, cut0: 1100, cutPeak: 3800, cut1: 1500, q: 1.8, a: 0.012, hold: d * 0.6, vib: i === 3 ? [5.2, 4, 0.3] : null, verb: 0.45 });
      tone(t + 0.42 + i * 0.2, mtof(m + 12), d * 0.8, { type: 'triangle', vol: 0.03, a: 0.01, verb: 0.4 });
    });
    [48, 55, 60].forEach((m) => tone(t + 1.22, mtof(m), 2.4, { vol: 0.05, a: 0.05, verb: 0.4 }));
    [84, 88, 91, 96, 100].forEach((m, i) => bell(t + 0.15 + i * 0.09, m, 0.045));
  } else if (kind === 'defeat') {
    noise(t0, slamDelay + 0.4, { type: 'lowpass', f: 420, f1: 220, q: 0.7, vol: 0.12, a: slamDelay * 0.8, essential: true });
    tone(t, 70, 1.6, { f1: 33, vol: 1.0, a: 0.003, essential: true });
    noise(t, 0.5, { type: 'lowpass', f: 600, f1: 160, vol: 0.45, a: 0.002 });
    [45, 52, 57, 60, 64].forEach((m) => synth(t + 0.05, mtof(m), 2.4, { vol: 0.06, cut0: 300, cutPeak: 900, cut1: 260, q: 2.2, a: 0.08, hold: 1.2, verb: 0.55 }));
    [[76, 0.9], [72, 0.9], [69, 0.9], [64, 2.0]].forEach(([m, d], i) => bell(t + 0.55 + i * 0.5, m, 0.05 - i * 0.006));
  } else {
    for (let i = 0; i < 8; i++) brushedSnare(t0 + i * (slamDelay / 8), 0.3 + 0.4 * (i / 7), sfxBus);
    tone(t, 82, 0.8, { f1: 50, vol: 0.7, a: 0.002, essential: true });
    noise(t, 1.6, { type: 'highpass', f: 6000, q: 0.6, vol: 0.09, a: 0.004, verb: 0.5 });
    [48, 55, 60, 62, 67].forEach((m) => synth(t, mtof(m), 2.0, { vol: 0.06, cut0: 700, cutPeak: 2600, cut1: 900, q: 1.4, a: 0.02, hold: 0.9, verb: 0.5 }));
    bell(t + 0.6, 79, 0.05); bell(t + 1.0, 74, 0.05);
  }
}

/**
 * Joyful, mischievous 1-time Storybook brass/marimba pickup stinger when Fever Time (<=25s in Seek) begins!
 */
function feverSting() {
  const wNow = wallSec();
  if (wNow - S.lastFeverStingWall < 1.8) return false;
  S.lastFeverStingWall = wNow;
  if (!ac || ac.state !== 'running') return false;
  const t = now();
  // Crisp brushed snare ruff pickup
  brushedSnare(t, 0.9, sfxBus);
  brushedSnare(t + 0.06, 1.15, sfxBus);
  // Rapid ascending rosewood marimba run (G5 -> B5 -> D6 -> G6 -> C7)
  [67, 71, 74, 79, 84].forEach((m, i) => {
    marimba(t + 0.03 + i * 0.042, m, 1.15, sfxBus);
  });
  // Cheerful mischievous Storybook brass fifths/triad pickup -> punchy tonic!
  [60, 64, 67, 72].forEach((m, idx) => synth(t + 0.14, mtof(m), 0.16, {
    type: 'sawtooth', vol: 0.075, cut0: 950, cutPeak: 3500, cut1: 1200, q: 1.6, a: 0.006, verb: 0.25, essential: idx === 0,
  }));
  [65, 69, 72, 77].forEach((m, idx) => synth(t + 0.31, mtof(m), 0.42, {
    type: 'sawtooth', vol: 0.085, cut0: 1100, cutPeak: 3800, cut1: 1450, q: 1.5, a: 0.008, hold: 0.12, verb: 0.35, essential: idx === 0,
  }));
  [84, 89, 93].forEach((m, i) => bell(t + 0.31 + i * 0.045, m, 0.055, sfxBus));
  return true;
}

/**
 * Playful directional Storybook ocarina/bird-whistle double-chirp for periodic Fever Time Hider reveal rings!
 * Accepts `(dist = 8)` OR `(dist = 8, pan)` OR `(dist = 8, worldX, worldZ)`.
 */
function feverWhistleRing(dist = 8, panOrX = null, worldZ = null) {
  if (!ac || ac.state !== 'running') return false;
  let g = 1;
  let pan = 0;
  if (typeof panOrX === 'number' && typeof worldZ === 'number') {
    const sp = spatial(panOrX, worldZ, 14);
    const effDist = Number.isFinite(+dist) && +dist > 0 ? +dist : sp.d;
    g = clamp(1 / (1 + Math.pow(effDist / 14, 1.35)), 0.14, 1);
    pan = sp.pan;
  } else {
    const d = Math.max(0, Number.isFinite(+dist) ? +dist : 8);
    g = clamp(1 / (1 + Math.pow(d / 14, 1.35)), 0.14, 1);
    pan = typeof panOrX === 'number' ? clamp(panOrX, -1, 1) : rnd(-0.22, 0.22);
  }
  const t = now();
  // Chirp 1: playful breathy ocarina grace slide (G5 -> C6)
  noise(t, 0.028, { type: 'bandpass', f: 2800, q: 2.2, vol: 0.05 * g, pan, a: 0.003 });
  tone(t, 784, 0.135, {
    f1: 1046.5, glide: 0.055, type: 'sine', vol: 0.17 * g, a: 0.008, hold: 0.05,
    vib: [6.2, 11, 0.04], pan, verb: 0.32, essential: true,
  });
  tone(t, 1568, 0.11, { f1: 2093, glide: 0.055, type: 'triangle', vol: 0.032 * g, a: 0.006, pan, verb: 0.28 });
  // Chirp 2: bright woodland answer chirp 150ms later (B5 -> E6 + gentle sparkle)
  const t2 = t + 0.15;
  noise(t2, 0.024, { type: 'bandpass', f: 3300, q: 2.2, vol: 0.045 * g, pan, a: 0.003 });
  tone(t2, 987.77, 0.19, {
    f1: 1318.5, glide: 0.06, type: 'sine', vol: 0.19 * g, a: 0.008, hold: 0.075,
    vib: [6.5, 14, 0.05], pan, verb: 0.38, essential: true,
  });
  tone(t2 + 0.02, 2637, 0.22, { type: 'sine', vol: 0.036 * g, a: 0.003, pan, verb: 0.42 });
  return true;
}

function registerHeartbeatPulse(fn) {
  if (typeof fn === 'function') {
    heartbeatListeners.add(fn);
  }
  return () => heartbeatListeners.delete(fn);
}

/**
 * Sets Seeker proximity danger (`0..1`, e.g. as a Seeker enters `4.5m -> 1.2m` of a disguised Hider).
 * When `S.proxDanger > 0.05`, schedules rhythmic `lub-dub` chest beats accelerating from `68 BPM` (`v = 0.05`)
 * to `138 BPM` (`v = 1.0`), invokes optional `onHeartbeatPulse`, and returns `true` when a beat fires!
 */
function setProximityDanger(intensity01, onHeartbeatPulseCb = null) {
  const v = clamp(Number.isFinite(+intensity01) ? +intensity01 : 0, 0, 1);
  const wasActive = S.proxDanger > 0.05;
  S.proxDanger = v;

  if (v <= 0.05) {
    S.proxHbAudio = 0;
    S.proxHbWall = 0;
    S.proxPulsePending = false;
    return false;
  }

  // Fallback wall-clock beat driver when Web Audio is muted, locked, or suspended
  // so CSS #dangerVignette & native haptics ALWAYS pulse in sync at 68 -> 138 BPM!
  if (!ac || ac.state !== 'running') {
    const wNow = wallSec();
    if (!wasActive || !S.proxHbWall || wNow >= S.proxHbWall) {
      const bpm = proxDangerBpm(v);
      S.proxHbWall = wNow + 60 / bpm;
      emitHeartbeatPulse(v, bpm, onHeartbeatPulseCb);
    }
  } else if (!wasActive) {
    // Trigger immediate first lub-dub as soon as Seeker crosses into the danger zone
    S.proxHbAudio = Math.min(S.proxHbAudio || Infinity, ac.currentTime + 0.02);
    sched();
  }

  if (S.proxPulsePending) {
    S.proxPulsePending = false;
    if (typeof onHeartbeatPulseCb === 'function') {
      try { onHeartbeatPulseCb(v, proxDangerBpm(v)); } catch (_) { /* ignore cb error */ }
    }
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ game state (public)
// mode: 'menu' | 'hide' (hiding countdown) | 'survive' (seekers hunting you) | 'seek' (you hunt) | 'end' | 'off'
function music(m) {
  if (S.mode === m) return;
  S.mode = m; S.step = 0;
  S.feverTriggered = false;
  S.prevSeekTimeLeft = -1;
  if (m !== 'survive' && m !== 'seek') {
    S.threat = 0; S.threatS = 0;
    S.proxDanger = 0; S.proxHbAudio = 0; S.proxHbWall = 0; S.proxPulsePending = false;
  }
  if (m === 'menu' || m === 'end' || m === 'off') { S.timeLeft = -1; spray(false); }
}
function setThreat(v) { S.threat = clamp(+v || 0, 0, 1); }
function setTimeLeft(s) {
  const prev = S.timeLeft;
  const numS = Number.isFinite(+s) ? +s : -1;
  S.timeLeft = numS;

  if (S.mode === 'seek' || S.mode === 'survive') {
    if (numS > 25.5) {
      S.feverTriggered = false;
    } else if (numS > 0 && numS <= 25 && !S.feverTriggered) {
      // Crossed into Final 25s Fever Time!
      if (prev > 25 || S.prevSeekTimeLeft > 25 || prev < 0) {
        S.feverTriggered = true;
        feverSting();
        if (ac && ac.state === 'running' && S.next > ac.currentTime + 0.16) {
          S.next = ac.currentTime + 0.06;
        }
      }
    }
    if (numS > 0) S.prevSeekTimeLeft = numS;
  } else if (numS <= 0) {
    S.feverTriggered = false;
  }
}
function setListener(x, z, yaw) { S.lx = x; S.lz = z; S.yaw = yaw; }
function toggleMute() { return setMuted(!muted); }
// level meter for the test page: returns () => RMS of the master output
function meter() {
  if (!ac) return () => 0;
  if (!meterNode) { meterNode = ac.createAnalyser(); meterNode.fftSize = 1024; master.connect(meterNode); }
  const buf = new Float32Array(meterNode.fftSize);
  return () => { meterNode.getFloatTimeDomainData(buf); let s = 0, pk = 0; for (const v of buf) { s += v * v; pk = Math.max(pk, Math.abs(v)); } return { rms: Math.sqrt(s / buf.length), peak: pk }; };
}

function getMediaStream() {
  if (!ac) {
    try { unlock(); } catch (_) { /* ignore */ }
  }
  if (!ac || !master || typeof ac.createMediaStreamDestination !== 'function') return null;
  if (!mediaStreamDest) {
    try {
      mediaStreamDest = ac.createMediaStreamDestination();
      master.connect(mediaStreamDest);
    } catch (_) {
      mediaStreamDest = null;
    }
  }
  if (!muted && ac.state === 'suspended' && typeof document !== 'undefined' && !document.hidden) {
    ac.resume?.().catch(() => {});
  }
  return mediaStreamDest ? mediaStreamDest.stream : null;
}

export const audio = {
  unlock, music, setThreat, setTimeLeft, setListener, toggleMute, setMuted, isMuted: () => muted, meter,
  getMediaStream,
  setProximityDanger, heartbeatLubDub, setHeartbeatCallback: (fn) => { directHeartbeatCb = typeof fn === 'function' ? fn : null; },
  isFeverTime, feverSting, feverWhistleRing, tick,
  get onHeartbeatPulse() { return registerHeartbeatPulse; },
  set onHeartbeatPulse(fn) { directHeartbeatCb = typeof fn === 'function' ? fn : null; },
  getContext: () => { if (!ac) unlock(); else if (!muted && ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {}); return ac; },
  getSfxBus: () => { if (!ac) unlock(); return sfxBus; },
  getVerbIn: () => verbIn,
  getBuffers: () => { if (!ac) unlock(); return { white: noiseBuf, pink: pinkBuf }; },
  tap, hitConfirm, streakFanfare, emotePop, landThud, propClunk, propSqueak, heatTick, boopStun, rescueFanfare, wantedStarUp, heatCooled, squadPing, poof, creak, step, jump, land, spray, shot, splash, wrong, found, alert, sniff, seekerStep, scurry, cue, win, lose, endSting,
  get state() {
    return {
      ctx: ac ? ac.state : 'none',
      mode: S.mode,
      threat: S.threat,
      threatS: +S.threatS.toFixed(3),
      proxDanger: +S.proxDanger.toFixed(3),
      feverTime: isFeverTime(),
      timeLeft: S.timeLeft,
      voices,
      muted,
      levels: { ...S.lv },
    };
  },
};
