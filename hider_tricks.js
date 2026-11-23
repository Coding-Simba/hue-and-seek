/* ============================================================================
 * Hue & Seek — Active Hider Tricks Manager (hider_tricks.js)
 *
 * Implements active Storybook Spirit tricks for all 5v5 Hiders:
 *   1. [C] Decoy Clone (16s CD, max 2 active per Hider, 1.5s Bubble & Puffball Blind)
 *   2. [X / 2×Shift] Sakura Petal & Cream Steam Dash (12s CD, 1.58× speed, LOS break)
 *   3. [T] Voluntary Whistle / Taunt (7s CD, 5 Storybook synths, 3× Daredevil Bonus)
 *      + 35s Auto-Giggle Check with 5s local warning & golden firefly wisps
 *   4. Smart autonomous Spirit usage during evade & hidden states
 *   5. Warm Storybook Cream HUD Bar (#hiderTricksBar) + #hsBubbleBlind overlay
 * ============================================================================ */

const DECOY_CD_MS = 16000;
const SMOKE_CD_MS = 12000;
const TAUNT_CD_MS = 7000;
const DASH_DURATION_MS = 2000;
const DASH_SPEED_MULT = 1.58;
const SMOKE_DURATION_SEC = 2.5;
const SMOKE_CLOUD_RADIUS = 2.7;
const SMOKE_LOS_RADIUS = 2.45;
const MAX_DECOYS_PER_HIDER = 2;
const GIGGLE_INTERVAL_SEC = 35.0;
const GIGGLE_WARN_SEC = 5.0;
const DOUBLE_SHIFT_WINDOW_MS = 280;

const TAUNT_IDS = ['chirp', 'duck', 'emberwick', 'windchime', 'ocarina'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ============================================================================
// Lightweight Lazy Procedural WebAudio Synthesizer (Storybook Tricks & Taunts)
// ============================================================================
let sharedAC = null;
let sharedComp = null;
let sharedNoiseBuf = null;
let latestEnvRef = null;

function isMutedGlobal() {
  if (latestEnvRef?.audio?.isMuted?.()) return true;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('hueseek.muted') === '1') {
      return true;
    }
  } catch (_) { /* storage unavailable */ }
  return false;
}

function ensureTrickAudio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedAC) {
    try {
      sharedAC = new AC({ latencyHint: 'interactive' });
    } catch (_) {
      try { sharedAC = new AC(); } catch (_2) { return null; }
    }
    sharedComp = sharedAC.createDynamicsCompressor();
    sharedComp.threshold.value = -14;
    sharedComp.knee.value = 10;
    sharedComp.ratio.value = 3.2;
    sharedComp.attack.value = 0.004;
    sharedComp.release.value = 0.18;
    const master = sharedAC.createGain();
    master.gain.value = 0.82;
    sharedComp.connect(master);
    master.connect(sharedAC.destination);

    const sr = sharedAC.sampleRate;
    sharedNoiseBuf = sharedAC.createBuffer(1, sr * 1.5, sr);
    const data = sharedNoiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (sharedAC.state === 'suspended') {
    sharedAC.resume().catch(() => {});
  }
  return sharedAC;
}

function computeSpatialMix(worldPos, refDist = 8.5) {
  if (!worldPos || !latestEnvRef) return { vol: 1, pan: 0 };
  const cam = latestEnvRef.camera;
  const G = latestEnvRef.G;
  const ear = (G?.spectating && G?.specTarget) ? G.specTarget.position : (cam?.position || G?.player?.position);
  if (!ear) return { vol: 1, pan: 0 };
  const dx = worldPos.x - ear.x;
  const dy = (worldPos.y || 0) - (ear.y || 0);
  const dz = worldPos.z - ear.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.25) return { vol: 1, pan: 0 };
  const vol = 1 / (1 + Math.pow(dist / refDist, 1.55));
  const yaw = G?.yaw || 0;
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const pan = clamp(((dx * rx + dz * rz) / Math.max(0.001, Math.hypot(dx, dz))) * Math.min(1, dist / 2.5) * 0.85, -1, 1);
  return { vol, pan };
}

function connectSpatial(ac, node, pan = 0) {
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    node.connect(p);
    p.connect(sharedComp);
  } else {
    node.connect(sharedComp);
  }
}

function playEnvTone(ac, t, freq0, dur, opts = {}) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type || 'sine';
  osc.frequency.setValueAtTime(Math.max(20, freq0), t);
  if (opts.freqMid && opts.tMid) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqMid), t + opts.tMid);
  }
  if (opts.freq1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freq1), t + (opts.glide ?? dur));
  }
  if (opts.vibRate && opts.vibDepth) {
    const lfo = ac.createOscillator();
    const lg = ac.createGain();
    lfo.frequency.value = opts.vibRate;
    lg.gain.value = opts.vibDepth;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.04);
  }

  const vol = Math.max(0.0002, opts.vol ?? 0.16);
  const atk = opts.atk ?? 0.008;
  const hold = opts.hold ?? 0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + atk);
  if (hold > 0) g.gain.setValueAtTime(vol, t + atk + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, atk + hold + 0.015));

  if (opts.filterType) {
    const flt = ac.createBiquadFilter();
    flt.type = opts.filterType;
    flt.frequency.setValueAtTime(opts.filterFreq || 1400, t);
    if (opts.filterFreq1) {
      flt.frequency.exponentialRampToValueAtTime(opts.filterFreq1, t + dur);
    }
    flt.Q.value = opts.filterQ ?? 1.8;
    osc.connect(flt);
    flt.connect(g);
  } else {
    osc.connect(g);
  }

  connectSpatial(ac, g, opts.pan || 0);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function playNoiseBurst(ac, t, dur, opts = {}) {
  if (!sharedNoiseBuf) return;
  const src = ac.createBufferSource();
  src.buffer = sharedNoiseBuf;
  const flt = ac.createBiquadFilter();
  flt.type = opts.type || 'bandpass';
  flt.frequency.setValueAtTime(opts.freq0 || 1000, t);
  if (opts.freqPeak) {
    flt.frequency.exponentialRampToValueAtTime(opts.freqPeak, t + dur * 0.35);
  }
  if (opts.freq1) {
    flt.frequency.exponentialRampToValueAtTime(opts.freq1, t + dur);
  }
  flt.Q.value = opts.q ?? 1.0;

  const g = ac.createGain();
  const vol = Math.max(0.0002, opts.vol ?? 0.14);
  const atk = opts.atk ?? 0.01;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, atk + 0.02));

  src.connect(flt);
  flt.connect(g);
  connectSpatial(ac, g, opts.pan || 0);
  const maxOff = Math.max(0, sharedNoiseBuf.duration - dur - 0.05);
  src.start(t, Math.random() * maxOff);
  src.stop(t + dur + 0.04);
}

function synthDecoyPlace(worldPos = null) {
  if (isMutedGlobal()) return;
  const ac = ensureTrickAudio();
  if (!ac) return;
  const { vol, pan } = computeSpatialMix(worldPos, 9.5);
  if (vol < 0.025) return;
  const t = ac.currentTime + 0.01;
  // Cozy Storybook wooden/bamboo "pon!" pop + leafy sparkle
  playEnvTone(ac, t, 240, 0.14, { freq1: 540, glide: 0.09, type: 'triangle', vol: 0.24 * vol, atk: 0.004, pan });
  playEnvTone(ac, t + 0.05, 780, 0.16, { freq1: 1180, type: 'sine', vol: 0.11 * vol, atk: 0.005, pan });
  playNoiseBurst(ac, t, 0.11, { type: 'bandpass', freq0: 900, freq1: 2400, q: 1.4, vol: 0.08 * vol, atk: 0.005, pan });
}

function synthDecoyPop(worldPos = null) {
  if (isMutedGlobal()) return;
  const ac = ensureTrickAudio();
  if (!ac) return;
  const { vol, pan } = computeSpatialMix(worldPos, 12.5);
  if (vol < 0.02) return;
  const t = ac.currentTime + 0.01;
  // Cascading glossy soap-bubble pops + mischievous 2-note spirit giggle!
  const popBase = [420, 560, 490, 680, 820];
  popBase.forEach((f, idx) => {
    const st = t + idx * 0.052;
    playEnvTone(ac, st, f, 0.085, { freq1: f * 2.15, glide: 0.07, type: 'sine', vol: 0.19 * vol, atk: 0.003, pan: clamp(pan + (idx - 2) * 0.12, -1, 1) });
  });
  // Cheeky spirit "tee-hee!" chime
  playEnvTone(ac, t + 0.11, 740, 0.16, { freqMid: 980, tMid: 0.07, freq1: 860, type: 'triangle', vol: 0.16 * vol, atk: 0.012, vibRate: 7, vibDepth: 14, pan });
  playEnvTone(ac, t + 0.26, 880, 0.22, { freqMid: 1175, tMid: 0.08, freq1: 1046, type: 'triangle', vol: 0.18 * vol, atk: 0.012, vibRate: 7.5, vibDepth: 16, pan });
  playNoiseBurst(ac, t, 0.22, { type: 'highpass', freq0: 2600, freq1: 5200, q: 0.8, vol: 0.09 * vol, atk: 0.008, pan });
}

function synthSmokeDash(worldPos = null) {
  if (isMutedGlobal()) return;
  const ac = ensureTrickAudio();
  if (!ac) return;
  const { vol, pan } = computeSpatialMix(worldPos, 11.0);
  if (vol < 0.02) return;
  const t = ac.currentTime + 0.01;
  // Lush sakura breeze whoosh + ascending pentatonic harp shimmer
  playNoiseBurst(ac, t, 0.48, { type: 'bandpass', freq0: 360, freqPeak: 1950, freq1: 520, q: 1.15, vol: 0.24 * vol, atk: 0.025, pan });
  playNoiseBurst(ac, t + 0.04, 0.36, { type: 'highpass', freq0: 3200, freq1: 6400, q: 0.7, vol: 0.07 * vol, atk: 0.02, pan });
  const notes = [77, 79, 81, 84, 86]; // F5 G5 A5 C6 D6
  notes.forEach((m, i) => {
    const f = mtof(m);
    playEnvTone(ac, t + 0.03 + i * 0.045, f, 0.32, { type: 'triangle', vol: 0.085 * vol, atk: 0.005, pan: clamp(pan + (i - 2) * 0.08, -1, 1) });
  });
}

function synthSpiritGiggle(worldPos = null) {
  if (isMutedGlobal()) return;
  const ac = ensureTrickAudio();
  if (!ac) return;
  const { vol, pan } = computeSpatialMix(worldPos, 16.0);
  if (vol < 0.015) return;
  const t = ac.currentTime + 0.01;
  // Soft directional firefly bell + delicate flutter
  const bellNotes = [86, 91, 93]; // D6, G6, A6
  bellNotes.forEach((m, i) => {
    const f = mtof(m);
    const st = t + i * 0.085;
    playEnvTone(ac, st, f, 0.42, { type: 'sine', vol: 0.10 * vol, atk: 0.006, vibRate: 6.2, vibDepth: 8, pan });
    playEnvTone(ac, st, f * 2.756, 0.18, { type: 'sine', vol: 0.028 * vol, atk: 0.003, pan });
  });
}

function synthGiggleWarn() {
  if (isMutedGlobal()) return;
  const ac = ensureTrickAudio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  playEnvTone(ac, t, mtof(76), 0.14, { type: 'triangle', vol: 0.08, atk: 0.004 });
  playEnvTone(ac, t + 0.11, mtof(81), 0.18, { type: 'triangle', vol: 0.09, atk: 0.004 });
}

function synthTauntById(tauntId = 'chirp', worldPos = null) {
  if (isMutedGlobal()) return;
  const ac = ensureTrickAudio();
  if (!ac) return;
  const { vol, pan } = computeSpatialMix(worldPos, 21.5);
  if (vol < 0.012) return;
  const t = ac.currentTime + 0.01;
  const id = TAUNT_IDS.includes(tauntId) ? tauntId : 'chirp';

  if (id === 'chirp') {
    // Woodland Bird Trill + wood rattle
    playEnvTone(ac, t, 1420, 0.13, { freqMid: 2420, tMid: 0.055, freq1: 1860, type: 'sine', vol: 0.20 * vol, atk: 0.006, vibRate: 24, vibDepth: 65, pan });
    playEnvTone(ac, t + 0.15, 1680, 0.18, { freqMid: 2790, tMid: 0.065, freq1: 2180, type: 'sine', vol: 0.22 * vol, atk: 0.006, vibRate: 26, vibDepth: 75, pan });
    // Subtle wooden click-rattle tail
    [0.34, 0.39, 0.435].forEach((dtOff, i) => {
      playEnvTone(ac, t + dtOff, 1480 + i * 190, 0.038, { type: 'triangle', vol: 0.09 * vol, atk: 0.002, pan });
    });
    return;
  }

  if (id === 'duck') {
    // Bathhouse Cedar Duck Double-Squeak (Otori-sama!)
    playEnvTone(ac, t, 510, 0.16, {
      freqMid: 760, tMid: 0.05, freq1: 460, type: 'sawtooth',
      filterType: 'bandpass', filterFreq: 1250, filterFreq1: 980, filterQ: 3.4,
      vol: 0.26 * vol, atk: 0.008, hold: 0.03, pan,
    });
    playEnvTone(ac, t + 0.19, 560, 0.21, {
      freqMid: 850, tMid: 0.06, freq1: 495, type: 'sawtooth',
      filterType: 'bandpass', filterFreq: 1380, filterFreq1: 1020, filterQ: 3.6,
      vol: 0.28 * vol, atk: 0.008, hold: 0.04, pan,
    });
    return;
  }

  if (id === 'emberwick') {
    // Hearth Fire Spirit Crackling Sizzle & Bright Spark Pops
    playNoiseBurst(ac, t, 0.42, { type: 'bandpass', freq0: 680, freqPeak: 2400, freq1: 1100, q: 0.9, vol: 0.22 * vol, atk: 0.015, pan });
    playEnvTone(ac, t + 0.02, 185, 0.26, { freqMid: 430, tMid: 0.11, freq1: 260, type: 'triangle', vol: 0.18 * vol, atk: 0.015, pan });
    // Crisp ember crackle snaps
    [0.06, 0.13, 0.21, 0.27, 0.34].forEach((off, idx) => {
      playNoiseBurst(ac, t + off, 0.035, { type: 'highpass', freq0: 3600 + idx * 350, q: 1.6, vol: 0.16 * vol, atk: 0.002, pan });
      playEnvTone(ac, t + off, 1650 + (idx % 3) * 480, 0.045, { freq1: 920, type: 'sine', vol: 0.10 * vol, atk: 0.002, pan });
    });
    return;
  }

  if (id === 'windchime') {
    // Japanese Summer Engawa Glass Furin Windchime
    const chimeMidi = [88, 95, 90, 97, 92]; // E6, B6, F#6, C#7, G#6
    chimeMidi.forEach((m, i) => {
      const f = mtof(m);
      const st = t + i * 0.072 + (i > 2 ? 0.015 : 0);
      const p = clamp(pan + (i % 2 === 0 ? -0.14 : 0.14), -1, 1);
      playEnvTone(ac, st, f, 0.72, { type: 'sine', vol: 0.13 * vol, atk: 0.002, pan: p });
      playEnvTone(ac, st, f * 2.756, 0.32, { type: 'sine', vol: 0.045 * vol, atk: 0.001, pan: p });
      playEnvTone(ac, st, f * 5.404, 0.14, { type: 'sine', vol: 0.018 * vol, atk: 0.001, pan: p });
    });
    return;
  }

  if (id === 'ocarina') {
    // Night-Tree Clay Ocarina 4-Note Motif (A5 -> C6 -> E6 -> D6)
    const phrase = [
      { m: 81, off: 0.00, dur: 0.14 },
      { m: 84, off: 0.14, dur: 0.14 },
      { m: 88, off: 0.28, dur: 0.20 },
      { m: 86, off: 0.49, dur: 0.32 },
    ];
    phrase.forEach((n) => {
      const f = mtof(n.m);
      const st = t + n.off;
      playEnvTone(ac, st, f, n.dur + 0.08, {
        type: 'sine', vol: 0.19 * vol, atk: 0.022, hold: Math.max(0, n.dur - 0.05),
        vibRate: 5.4, vibDepth: f * 0.009, pan,
      });
      playEnvTone(ac, st, f * 2, n.dur + 0.04, { type: 'triangle', vol: 0.026 * vol, atk: 0.02, pan });
      playNoiseBurst(ac, st, 0.045, { type: 'bandpass', freq0: f * 1.5, q: 2.2, vol: 0.032 * vol, atk: 0.006, pan });
    });
  }
}

export function playTauntPreview(tauntId = 'chirp') {
  synthTauntById(tauntId, null);
}

// ============================================================================
// Main Manager Factory
// ============================================================================
export function createHiderTricksManager(env) {
  latestEnvRef = env;
  const { THREE } = env;
  const getNow = () => (env?.now ? env.now() : (typeof performance !== 'undefined' ? performance.now() : Date.now()));

  // Live collections exposed via getActiveDecoys() / getActiveSmokes()
  const decoys = [];
  const smokes = [];
  const fxBursts = [];
  const charStates = new Map();

  let uidSeq = 0;
  let lastShiftDownAt = 0;
  let lastSeekWhistleHintAt = -1e9;
  let bubbleBlindTimer = 0;

  // Cached DOM references
  let barEl = null;
  let btnDecoyEl = null;
  let btnSmokeEl = null;
  let btnTauntEl = null;
  let decoyMetaEl = null;
  let decoySweepEl = null;
  let decoyCdEl = null;
  let smokeMetaEl = null;
  let smokeSweepEl = null;
  let smokeCdEl = null;
  let tauntMetaEl = null;
  let tauntSweepEl = null;
  let tauntCdEl = null;
  let giggleArcEl = null;
  let bubbleBlindEl = null;

  // Shared 3D Geometries, Dummy Mats & Textures (created lazily once)
  let geoCache = null;
  let noteTextures = null;
  let dummyMatCache = null;
  const _htHudCache = {};

  function getGeoCache() {
    if (geoCache || !THREE) return geoCache;
    const petalShape = new THREE.BufferGeometry();
    // Soft diamond-curved petal quad (2 triangles)
    const verts = new Float32Array([
      0, 0, -0.09,
      0.065, 0.014, 0,
      0, 0.005, 0.095,
      0, 0, -0.09,
      0, 0.005, 0.095,
      -0.065, 0.014, 0,
    ]);
    petalShape.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    petalShape.computeVertexNormals();

    geoCache = {
      sphereLo: new THREE.SphereGeometry(1, 12, 10),
      sphereMid: new THREE.SphereGeometry(1, 16, 14),
      star: new THREE.OctahedronGeometry(1, 0),
      petal: petalShape,
      ring: new THREE.RingGeometry(0.42, 0.56, 28),
      capsuleArm: new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.065, 0.15, 4, 8) : new THREE.SphereGeometry(0.08, 8, 8),
      kerchief: new THREE.TorusGeometry(0.23, 0.038, 8, 20),
    };
    return geoCache;
  }

  function getNoteTextures() {
    if (noteTextures) return noteTextures;
    if (!THREE || typeof document === 'undefined' || !document.createElement) return null;
    const makeGlyphTex = (glyph, fillHex, strokeHex) => {
      const cv = document.createElement('canvas');
      if (!cv || typeof cv.getContext !== 'function') return null;
      cv.width = 96;
      cv.height = 96;
      const ctx = cv.getContext('2d');
      if (!ctx) return null;
      ctx.clearRect(0, 0, 96, 96);
      ctx.font = '900 62px Fredoka, Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = strokeHex;
      ctx.strokeText(glyph, 48, 52);
      ctx.fillStyle = fillHex;
      ctx.fillText(glyph, 48, 52);
      const tex = new THREE.CanvasTexture(cv);
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const t1 = makeGlyphTex('♪', '#ffd859', '#4a3208');
    const t2 = makeGlyphTex('♫', '#ff9ebb', '#4f2233');
    const t3 = makeGlyphTex('✦', '#fff3a8', '#5c420b');
    if (!t1) return null;
    noteTextures = [t1, t2, t3];
    return noteTextures;
  }

  // Build a cute cream Storybook spirit dummy sphere-bean with eyes, rosy cheeks & leaf sprout!
  function buildSpiritDummy() {
    const gc = getGeoCache();
    const g = new THREE.Group();
    if (!dummyMatCache) {
      dummyMatCache = {
        creamMat: new THREE.MeshLambertMaterial({ color: 0xfff3dc }),
        cheekMat: new THREE.MeshBasicMaterial({ color: 0xffb3a7 }),
        eyeDarkMat: new THREE.MeshBasicMaterial({ color: 0x262428 }),
        eyeShineMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        collarMat: new THREE.MeshLambertMaterial({ color: 0x8fb57a }),
        leafMat: new THREE.MeshLambertMaterial({ color: 0x7aab34 }),
        leafTipMat: new THREE.MeshLambertMaterial({ color: 0xc5e063 }),
      };
    }
    const { creamMat, cheekMat, eyeDarkMat, eyeShineMat, collarMat, leafMat, leafTipMat } = dummyMatCache;
    const ownedMats = [];

    // Plump lower bean belly + upper round head
    const belly = new THREE.Mesh(gc.sphereMid, creamMat);
    belly.scale.set(0.33, 0.30, 0.31);
    belly.position.set(0, 0.31, 0);
    belly.castShadow = true;
    belly.receiveShadow = true;
    g.add(belly);

    const head = new THREE.Mesh(gc.sphereMid, creamMat);
    head.scale.set(0.28, 0.27, 0.265);
    head.position.set(0, 0.68, 0.01);
    head.castShadow = true;
    head.receiveShadow = true;
    g.add(head);

    // Cozy kerchief collar
    const collar = new THREE.Mesh(gc.kerchief, collarMat);
    collar.rotation.x = Math.PI / 2 + 0.08;
    collar.position.set(0, 0.50, 0.01);
    g.add(collar);

    // Stubby little feet & arms
    for (const sx of [-1, 1]) {
      const foot = new THREE.Mesh(gc.sphereLo, creamMat);
      foot.scale.set(0.10, 0.06, 0.135);
      foot.position.set(sx * 0.13, 0.055, 0.04);
      foot.castShadow = true;
      g.add(foot);

      const arm = new THREE.Mesh(gc.capsuleArm, creamMat);
      arm.position.set(sx * 0.31, 0.42, 0.02);
      arm.rotation.z = sx * 0.48;
      arm.castShadow = true;
      g.add(arm);

      // Expressive glossy Storybook eyes + white catchlight + rosy blush
      const eye = new THREE.Mesh(gc.sphereLo, eyeDarkMat);
      eye.scale.set(0.036, 0.044, 0.025);
      eye.position.set(sx * 0.095, 0.71, 0.255);
      g.add(eye);

      const shine = new THREE.Mesh(gc.sphereLo, eyeShineMat);
      shine.scale.set(0.013, 0.013, 0.012);
      shine.position.set(sx * 0.095 + 0.012, 0.725, 0.276);
      g.add(shine);

      const cheek = new THREE.Mesh(gc.sphereLo, cheekMat);
      cheek.scale.set(0.042, 0.024, 0.015);
      cheek.position.set(sx * 0.155, 0.655, 0.238);
      g.add(cheek);
    }

    // Two-leaf head sprout
    const sprout = new THREE.Group();
    sprout.position.set(0, 0.94, 0.01);
    const stem = new THREE.Mesh(gc.sphereLo, leafMat);
    stem.scale.set(0.018, 0.065, 0.018);
    stem.position.set(0, 0.04, 0);
    sprout.add(stem);

    for (const sx of [-1, 1]) {
      const leaf = new THREE.Mesh(gc.sphereLo, sx < 0 ? leafMat : leafTipMat);
      leaf.scale.set(0.085, 0.024, 0.045);
      leaf.position.set(sx * 0.07, 0.085, 0);
      leaf.rotation.z = -sx * 0.38;
      leaf.castShadow = true;
      sprout.add(leaf);
    }
    g.add(sprout);

    g.userData.ownedMaterials = ownedMats;
    g.userData.sprout = sprout;
    return g;
  }

  function disposeOwnedMaterials(obj) {
    if (!obj) return;
    const mats = obj.userData?.ownedMaterials;
    if (Array.isArray(mats)) {
      for (const m of mats) {
        if (m && typeof m.dispose === 'function') m.dispose();
      }
      obj.userData.ownedMaterials = null;
    }
  }

  // --------------------------------------------------------------------------
  // Character Trick State Management
  // --------------------------------------------------------------------------
  function getCharState(ch) {
    let st = charStates.get(ch);
    if (!st) {
      const slotIdx = ch?.userData?.actor?.slotIdx ?? Math.floor(Math.random() * 5);
      st = {
        slotIdx: slotIdx % 5,
        decoyReadyAt: -1e9,
        smokeReadyAt: -1e9,
        tauntReadyAt: -1e9,
        dashUntil: -1e9,
        trailEmitT: 0,
        giggleTimer: GIGGLE_INTERVAL_SEC,
        giggleWarned: false,
        botTauntId: TAUNT_IDS[slotIdx % TAUNT_IDS.length],
        hiddenDuration: 0,
        evadeDuration: 0,
        emergencyMirageReadyAt: -1e9,
        nextBotTauntT: rand(24, 46) + (slotIdx % 5) * 2.4 + rand(-1.2, 1.2),
        nextBotDecoyT: rand(14, 28) + (slotIdx % 5) * 3.1,
      };
      charStates.set(ch, st);
    }
    return st;
  }

  function getHiderPerk(ch) {
    return typeof env.getHiderPerk === 'function' ? (env.getHiderPerk(ch) || 'none') : 'none';
  }

  function getMaxDecoysFor(ch) {
    return getHiderPerk(ch) === 'phantom_mirage' ? 3 : MAX_DECOYS_PER_HIDER;
  }

  function getDecoyCdMsFor(ch) {
    return getHiderPerk(ch) === 'phantom_mirage' ? 12000 : DECOY_CD_MS;
  }

  function getSmokeCdMsFor(ch) {
    return getHiderPerk(ch) === 'twin_dash' ? 8400 : SMOKE_CD_MS;
  }

  function isLivingHider(ch) {
    if (!ch || !env?.G || env.G.over) return false;
    if (ch.userData?.actor?.eliminated) return false;
    const team = ch.userData?.actor?.team;
    if (team === 'seekers') return false;
    if (team === 'hiders') return true;
    if (Array.isArray(env.G.allHiders) && env.G.allHiders.includes(ch)) return true;
    if (Array.isArray(env.G.hiders) && env.G.hiders.includes(ch)) return true;
    if (ch === env.G.player && env.G.mode === 'hide') return true;
    return false;
  }

  function isValidTrickPhase(ch) {
    if (!env?.G || env.G.over) return false;
    const { mode, phase, spectating, player } = env.G;
    if (ch === player && spectating) return false;
    if (mode === 'hide') {
      return phase === 'hide' || phase === 'survive';
    }
    if (mode === 'seek') {
      if (ch === player) return false;
      return phase === 'ready' || phase === 'seek';
    }
    return false;
  }

  function getAllLivingHiders() {
    if (!env?.G) return [];
    const set = new Set();
    if (Array.isArray(env.G.allHiders)) {
      for (const h of env.G.allHiders) if (h && isLivingHider(h)) set.add(h);
    }
    if (Array.isArray(env.G.hiders)) {
      for (const h of env.G.hiders) if (h && isLivingHider(h)) set.add(h);
    }
    if (env.G.mode === 'hide' && env.G.player && isLivingHider(env.G.player)) {
      set.add(env.G.player);
    }
    return [...set];
  }

  function getSeekersList() {
    if (!env?.G) return [];
    if (Array.isArray(env.G.allSeekers) && env.G.allSeekers.length) return env.G.allSeekers;
    if (Array.isArray(env.G.seekers) && env.G.seekers.length) return env.G.seekers;
    if (env.G.mode === 'seek' && env.G.player) return [env.G.player];
    return [];
  }

  function nearestSeekerDistance(pos) {
    if (!pos) return Infinity;
    const list = getSeekersList();
    let minD = Infinity;
    for (const s of list) {
      if (!s || !s.position || s.userData?.actor?.eliminated) continue;
      const dx = s.position.x - pos.x;
      const dy = (s.position.y || 0) - (pos.y || 0);
      const dz = s.position.z - pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < minD) minD = d;
    }
    return minD;
  }

  // --------------------------------------------------------------------------
  // 3D Particle Bursts (Decoy Puffball+Petals+Stars, Dash Trail, Whistle Notes, Wisps)
  // --------------------------------------------------------------------------
  function spawnBurstGroup(origin, particles, duration) {
    if (!THREE || !env?.scene) return;
    const grp = new THREE.Group();
    grp.position.set(origin.x, origin.y, origin.z);
    const mats = [];
    for (const p of particles) {
      grp.add(p.mesh);
      if (p.mat) mats.push(p.mat);
    }
    grp.userData.ownedMaterials = mats;
    env.scene.add(grp);
    fxBursts.push({ grp, particles, age: 0, duration });
  }

  function emitDecoyPopVFX(pos, height = 0.9) {
    if (!THREE || !env?.scene) return;
    const gc = getGeoCache();
    const parts = [];
    const baseOrigin = { x: pos.x, y: (pos.y || 0) + height * 0.42, z: pos.z };

    // 1. Dandelion puffs (soft cream seed-heads drifting out)
    for (let i = 0; i < 7; i++) {
      const puffballGrp = new THREE.Group();
      const sMat = new THREE.MeshBasicMaterial({ color: [0xfff5e4, 0xf7ecd2, 0xfffdf6][i % 3], transparent: true, opacity: 0.92 });
      const body = new THREE.Mesh(gc.sphereLo, sMat);
      const r = rand(0.075, 0.115);
      body.scale.setScalar(r);
      puffballGrp.add(body);

      const eMat = new THREE.MeshBasicMaterial({ color: 0xfffdf8, transparent: true, opacity: 0.96 });
      // a few fine seed-tufts around each puff
      for (let k = 0; k < 4; k++) {
        const tuft = new THREE.Mesh(gc.sphereLo, eMat);
        const ta = (k / 4) * Math.PI * 2 + i;
        tuft.scale.setScalar(r * 0.34);
        tuft.position.set(Math.cos(ta) * r * 0.95, Math.sin(ta * 1.3) * r * 0.5, Math.sin(ta) * r * 0.95);
        puffballGrp.add(tuft);
      }
      const ang = (i / 7) * Math.PI * 2 + rand(-0.3, 0.3);
      const spd = rand(1.8, 3.6);
      parts.push({
        mesh: puffballGrp,
        mat: sMat,
        extraMat: eMat,
        vx: Math.cos(ang) * spd,
        vy: rand(2.4, 4.6),
        vz: Math.sin(ang) * spd,
        grav: 9.2,
        rotSpd: rand(-6, 6),
        baseScale: 1,
      });
    }

    // 2. Pastel Sakura Petals
    const petalPalette = [0xffb7c5, 0xffd4df, 0xff9bb3, 0xffeef3];
    for (let i = 0; i < 14; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: pick(petalPalette),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      });
      const pm = new THREE.Mesh(gc.petal, pMat);
      const sc = rand(0.95, 1.55);
      pm.scale.setScalar(sc);
      pm.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
      const ang = rand(0, Math.PI * 2);
      const spd = rand(1.2, 3.4);
      parts.push({
        mesh: pm,
        mat: pMat,
        vx: Math.cos(ang) * spd,
        vy: rand(1.5, 3.8),
        vz: Math.sin(ang) * spd,
        grav: 3.1,
        flutter: rand(5, 10),
        rotSpd: rand(-8, 8),
        baseScale: sc,
      });
    }

    // 3. Golden Stars
    const starPalette = [0xffd54f, 0xffe97d, 0xffb833];
    for (let i = 0; i < 8; i++) {
      const stMat = new THREE.MeshBasicMaterial({ color: pick(starPalette), transparent: true, opacity: 0.98 });
      const sm = new THREE.Mesh(gc.star, stMat);
      const sc = rand(0.065, 0.11);
      sm.scale.setScalar(sc);
      const ang = (i / 8) * Math.PI * 2 + rand(-0.25, 0.25);
      const spd = rand(1.4, 2.9);
      parts.push({
        mesh: sm,
        mat: stMat,
        vx: Math.cos(ang) * spd,
        vy: rand(2.6, 4.9),
        vz: Math.sin(ang) * spd,
        grav: 4.5,
        rotSpd: rand(6, 12),
        baseScale: sc,
      });
    }

    const extraMats = [];
    for (const p of parts) if (p.extraMat) extraMats.push(p.extraMat);
    spawnBurstGroup(baseOrigin, parts, 1.15);
    if (fxBursts.length && extraMats.length) {
      const last = fxBursts[fxBursts.length - 1];
      last.grp.userData.ownedMaterials.push(...extraMats);
    }
  }

  function emitTrailPetal(ch) {
    if (!THREE || !env?.scene || !ch?.position) return;
    const gc = getGeoCache();
    const poofStyle = ch === env.G?.player ? (env.getEquippedPoof?.() || 'sakura') : 'sakura';
    const palettes = {
      classic: [0xfff8ea, 0xffdf9e, 0xffb7c5],
      sakura: [0xffb7c5, 0xffd6e0, 0xff9eb5, 0xfff3f6],
      starlight: [0xffe066, 0xfff4b8, 0xa8e6ff],
      puffball: [0xfff5e4, 0xf3e6c4, 0xdfeecd],
    };
    const cols = palettes[poofStyle] || palettes.sakura;
    const parts = [];
    const baseOrigin = {
      x: ch.position.x + rand(-0.22, 0.22),
      y: (ch.userData?.groundY ?? ch.position.y ?? 0) + (ch.userData?.jy || 0) + rand(0.18, 0.65),
      z: ch.position.z + rand(-0.22, 0.22),
    };
    for (let i = 0; i < 2; i++) {
      const isStar = poofStyle === 'starlight' && i === 0;
      const mat = new THREE.MeshBasicMaterial({
        color: pick(cols),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const m = new THREE.Mesh(isStar ? gc.star : gc.petal, mat);
      const sc = isStar ? rand(0.055, 0.08) : rand(0.85, 1.3);
      m.scale.setScalar(sc);
      m.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
      parts.push({
        mesh: m,
        mat,
        vx: rand(-0.7, 0.7),
        vy: rand(0.55, 1.4),
        vz: rand(-0.7, 0.7),
        grav: 1.4,
        flutter: rand(6, 11),
        rotSpd: rand(-7, 7),
        baseScale: sc,
      });
    }
    spawnBurstGroup(baseOrigin, parts, 0.72);
  }

  function emitTauntNotesVFX(ch) {
    if (!THREE || !env?.scene || !ch?.position) return;
    const gc = getGeoCache();
    const texList = getNoteTextures();
    const parts = [];
    const baseY = (ch.userData?.groundY ?? ch.position.y ?? 0) + (ch.userData?.jy || 0) + (ch.userData?.height || 1.0) * 0.65;
    const origin = { x: ch.position.x, y: baseY, z: ch.position.z };

    // Expanding golden star halo ring rising from the Spirit
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(gc.ring, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    parts.push({
      mesh: ringMesh,
      mat: ringMat,
      vx: 0,
      vy: 0.95,
      vz: 0,
      grav: 0,
      rotSpd: 0,
      baseScale: 0.75,
      expandRate: 2.35,
    });

    // Floating 3D musical notes & golden stars
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      const rad = rand(0.22, 0.48);
      let mesh;
      let mat;
      if (texList && texList.length && i < 4) {
        mat = new THREE.SpriteMaterial({
          map: texList[i % texList.length],
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
        });
        mesh = new THREE.Sprite(mat);
        mesh.scale.setScalar(0.38);
      } else {
        mat = new THREE.MeshBasicMaterial({ color: 0xffdf6b, transparent: true, opacity: 0.95 });
        mesh = new THREE.Mesh(gc.star, mat);
        mesh.scale.setScalar(0.09);
      }
      mesh.position.set(Math.cos(ang) * rad, i * 0.08, Math.sin(ang) * rad);
      parts.push({
        mesh,
        mat,
        vx: Math.cos(ang) * 0.42,
        vy: rand(1.15, 1.75),
        vz: Math.sin(ang) * 0.42,
        grav: -0.15,
        swirlAng: ang,
        swirlSpd: 3.4,
        rotSpd: mesh.isSprite ? 0 : 5.5,
        baseScale: mesh.scale.x,
      });
    }

    spawnBurstGroup(origin, parts, 1.35);
  }

  function emitFireflyWispVFX(ch) {
    if (!THREE || !env?.scene || !ch?.position) return;
    const gc = getGeoCache();
    const parts = [];
    const baseY = (ch.userData?.groundY ?? ch.position.y ?? 0) + 0.45;
    const origin = { x: ch.position.x, y: baseY, z: ch.position.z };

    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + rand(0, 0.5);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffe47a : 0xfff6c4,
        transparent: true,
        opacity: 0.92,
      });
      const orb = new THREE.Mesh(gc.sphereLo, mat);
      const sc = rand(0.048, 0.072);
      orb.scale.setScalar(sc);
      orb.position.set(Math.cos(ang) * 0.28, rand(0, 0.25), Math.sin(ang) * 0.28);
      parts.push({
        mesh: orb,
        mat,
        vx: Math.cos(ang) * 0.25,
        vy: rand(0.75, 1.25),
        vz: Math.sin(ang) * 0.25,
        grav: 0,
        swirlAng: ang,
        swirlSpd: 4.2,
        rotSpd: 0,
        baseScale: sc,
      });
    }
    spawnBurstGroup(origin, parts, 1.55);
  }

  // --------------------------------------------------------------------------
  // 1. Decoy Clone ([C] — 16s Cooldown, Max 2 Active per Hider)
  // --------------------------------------------------------------------------
  function disposeDecoyEntry(decoy, withSmallPuff = false) {
    if (!decoy) return;
    if (withSmallPuff && env?.splash && decoy.root) {
      env.splash(decoy.root.position, 8, 1.5);
    }
    if (decoy.root && env?.scene) {
      env.scene.remove(decoy.root);
    }
    if (!decoy.isClonedProp && decoy.visual) {
      disposeOwnedMaterials(decoy.visual);
    }
  }

  function useDecoy(ch = env.G?.player, opts = null) {
    if (!ch) ch = env.G?.player;
    const fromNet = !!(opts && opts.fromNet);
    const freeEmergency = !!(opts && opts.freeEmergency);
    if (!isLivingHider(ch) || (!fromNet && !freeEmergency && !isValidTrickPhase(ch))) return false;

    const now = getNow();
    const st = getCharState(ch);
    if (!fromNet && !freeEmergency && now < st.decoyReadyAt) {
      if (ch === env.G?.player) {
        const rem = Math.max(1, Math.ceil((st.decoyReadyAt - now) / 1000));
        env.hint?.(`🎭 Decoy recharging (${rem}s)…`, 950);
      }
      return false;
    }

    // Enforce max active decoys per owner (2 base, 3 with Phantom Mirage perk)
    const maxDecoys = getMaxDecoysFor(ch);
    const owned = decoys.filter((d) => d.owner === ch);
    while (owned.length >= maxDecoys) {
      const oldest = owned.shift();
      const idx = decoys.indexOf(oldest);
      if (idx >= 0) decoys.splice(idx, 1);
      disposeDecoyEntry(oldest, true);
    }

    const px = typeof opts?.x === 'number' ? opts.x : ch.position.x;
    const pz = typeof opts?.z === 'number' ? opts.z : ch.position.z;
    const refY = ch.userData?.groundY ?? ch.position.y ?? 0;
    const py = env.groundHeightAt ? env.groundHeightAt(px, pz, refY) : refY;
    const rotY = typeof opts?.rotY === 'number' ? opts.rotY : (ch.rotation?.y || 0);

    const propId = (fromNet && opts && typeof opts.propId === 'string')
      ? (opts.propId || null)
      : (ch.userData?.propId || null);
    const kitProps = env.getKit?.()?.props || {};
    const propDef = propId ? kitProps[propId] : null;

    let visual = null;
    let isClonedProp = false;
    let radius = 0.45;
    let height = 1.1;

    if (propId && typeof env.buildProp === 'function') {
      try {
        visual = env.buildProp(propId);
        isClonedProp = !!visual;
      } catch (_) {
        visual = null;
      }
      radius = propDef?.radius || ch.userData?.radius || 0.48;
      height = propDef?.height || ch.userData?.height || 0.95;
    }

    if (!visual && THREE) {
      visual = buildSpiritDummy();
      isClonedProp = false;
      radius = 0.45;
      height = 1.1;
    }

    const root = THREE ? new THREE.Group() : { position: { x: px, y: py, z: pz }, rotation: { y: rotY }, scale: { setScalar() {} } };
    if (THREE) {
      root.position.set(px, py, pz);
      root.rotation.y = rotY;
      root.scale.setScalar(0.6); // Pop-in spring 0.6 -> 1.0
      if (visual) root.add(visual);
      env.scene?.add(root);
    }

    const idNum = ++uidSeq;
    const slotIdx = ch.userData?.actor?.slotIdx ?? 0;
    const netKey = (opts && opts.netKey) ? String(opts.netKey) : `${slotIdx}_${idNum}`;

    const entry = {
      id: idNum,
      netKey,
      owner: ch,
      propId,
      isClonedProp,
      root,
      visual,
      position: root.position,
      radius,
      height,
      createdAt: now,
      age: 0,
      scale: 0.6,
      scaleVel: 4.2,
    };
    decoys.push(entry);

    if (!freeEmergency) {
      st.decoyReadyAt = now + getDecoyCdMsFor(ch);
    }
    const seekerSkyScouting = env.G?.mode === 'seek' && env.G?.phase === 'ready';
    if (!seekerSkyScouting) {
      synthDecoyPlace(ch === env.G?.player ? null : root.position);
      env.splash?.(root.position, 10, 1.7);
    }

    if (!fromNet) {
      env.onLocalGadget?.({
        k: 'decoy',
        t: 0,
        s: slotIdx,
        nk: netKey,
        x: +px.toFixed(2),
        z: +pz.toFixed(2),
        ry: +rotY.toFixed(3),
        pid: propId || '',
      }, ch);
    }

    if (ch === env.G?.player && !freeEmergency) {
      const label = propDef?.label ? `${propDef.label} Decoy` : 'Spirit Decoy';
      const myCount = decoys.filter((d) => d.owner === ch).length;
      env.hint?.(`🎭 Placed ${label} (${myCount}/${maxDecoys} active)!`, 1350);
    }
    return true;
  }

  function popDecoy(decoy, shooterChar, hitPoint = null, fromNet = false) {
    const idx = decoys.indexOf(decoy);
    if (idx < 0) return false;
    decoys.splice(idx, 1);

    const now = getNow();
    const pos = decoy.root?.position || decoy.position || { x: 0, y: 0, z: 0 };
    const burstPt = hitPoint || (THREE ? new THREE.Vector3(pos.x, pos.y + (decoy.height || 0.9) * 0.5, pos.z) : pos);

    disposeDecoyEntry(decoy, false);
    emitDecoyPopVFX(pos, decoy.height || 0.9);
    env.splash?.(burstPt, 20, 2.7);
    env.ripple?.(pos, 1.35);
    synthDecoyPop(shooterChar === env.G?.player ? null : pos);

    const ownerPerk = getHiderPerk(decoy.owner);
    const shooterPerk = typeof env.getSeekerPerk === 'function' ? (env.getSeekerPerk(shooterChar) || 'none') : 'none';
    const isSoapTrap = ownerPerk === 'soap_decoy';
    if (isSoapTrap) {
      env.onSoapDecoyPopped?.(pos, decoy.owner, shooterChar);
    }

    if (!fromNet && decoy.netKey) {
      const sAct = shooterChar?.userData?.actor;
      env.onLocalGadget?.({
        k: 'decoy_pop',
        nk: decoy.netKey,
        st: sAct?.team === 'seekers' ? 1 : 0,
        ss: sAct?.slotIdx ?? 0,
      }, shooterChar);
    }

    const rawBlindMs = isSoapTrap ? 2100 : 1500;
    const blindMs = (shooterPerk === 'clear_goggles' || shooterPerk === 'grand_inquisitor')
      ? Math.round(rawBlindMs * 0.4)
      : rawBlindMs;

    if (shooterChar?.userData) {
      shooterChar.userData.blindUntil = now + blindMs;
    }

    const ownerName = decoy.owner?.userData?.actor?.name || 'Spirit';
    const shooterName = shooterChar?.userData?.actor?.name || 'Seeker';

    if (shooterChar && shooterChar === env.G?.player) {
      triggerBubbleBlind(blindMs, ownerName);
      env.hint?.(isSoapTrap ? `🫧 Soap-Suds Decoy! Slippery ground!` : `🫧 Bamboozled! That was ${ownerName}'s Decoy!`, 1700);
      env.pushFeed?.('🫧', `Bamboozled by <b>${escHtml(ownerName)}</b>'s <b>Decoy Clone</b>!`, 'warn');
    }

    if (decoy.owner) {
      env.recordStat?.(decoy.owner, 'decoyTricks', 1);
      if (decoy.owner === env.G?.player) {
        env.awardTokens?.('decoy_hit', 25, `🎭 Decoy tricked ${shooterName}! +25 🪙`);
        env.pushFeed?.('🫧', `<b>${escHtml(shooterName)}</b> fell for your <b>Decoy Clone</b>!`, 'ally');
      }
    }
    return true;
  }

  function popDecoyByNetKey(netKey, shooterChar = null) {
    if (!netKey) return false;
    const found = decoys.find((d) => d.netKey === netKey);
    if (!found) return false;
    return popDecoy(found, shooterChar, null, true);
  }

  // Segment-to-vertical-capsule hit check against all active decoys (radius + 0.18)
  function testWaterSegmentHit(prevPos, segVec, segLen, shooterChar) {
    if (!decoys.length || !prevPos || !segVec || !(segLen > 1e-6)) return null;
    if (shooterChar && shooterChar.userData?.actor?.team === 'hiders') return null;

    let bestDecoy = null;
    let bestT = 2;
    let bestHitX = 0, bestHitY = 0, bestHitZ = 0;
    const lenSq = segLen * segLen;

    for (let i = 0; i < decoys.length; i++) {
      const d = decoys[i];
      const dp = d.root?.position || d.position;
      if (!dp) continue;
      const rr = (d.radius || 0.45) + 0.18;
      const h = d.height || 0.95;
      const yMin = dp.y + Math.min(0.28, h * 0.28);
      const yMax = dp.y + Math.max(0.42, h - 0.18);

      // Test closest approach along the segment to the decoy's vertical spine [yMin, yMax]
      const midY = (yMin + yMax) * 0.5;
      const tApprox = clamp(((dp.x - prevPos.x) * segVec.x + (midY - prevPos.y) * segVec.y + (dp.z - prevPos.z) * segVec.z) / lenSq, 0, 1);
      const qx = prevPos.x + segVec.x * tApprox;
      const qy = prevPos.y + segVec.y * tApprox;
      const qz = prevPos.z + segVec.z * tApprox;
      const spineY = clamp(qy, yMin, yMax);

      // Refine projection against clamped spine point for tall props
      const tRef = clamp(((dp.x - prevPos.x) * segVec.x + (spineY - prevPos.y) * segVec.y + (dp.z - prevPos.z) * segVec.z) / lenSq, 0, 1);
      const hx = prevPos.x + segVec.x * tRef;
      const hy = prevPos.y + segVec.y * tRef;
      const hz = prevPos.z + segVec.z * tRef;
      const cy = clamp(hy, yMin, yMax);

      const distSq = (hx - dp.x) * (hx - dp.x) + (hy - cy) * (hy - cy) + (hz - dp.z) * (hz - dp.z);
      if (distSq <= rr * rr && tRef < bestT) {
        bestT = tRef;
        bestDecoy = d;
        bestHitX = hx;
        bestHitY = hy;
        bestHitZ = hz;
      }
    }

    if (!bestDecoy) return null;
    const hitPoint = THREE
      ? new THREE.Vector3(bestHitX, bestHitY, bestHitZ)
      : { x: bestHitX, y: bestHitY, z: bestHitZ };
    popDecoy(bestDecoy, shooterChar, hitPoint);
    return { hitPoint, decoy: bestDecoy, along: bestT * segLen };
  }

  function triggerSplashArea(centerPos, radius, shooterChar) {
    if (!decoys.length || !centerPos || !(radius > 0)) return 0;
    let poppedCount = 0;
    for (let i = decoys.length - 1; i >= 0; i--) {
      const d = decoys[i];
      const dp = d.root?.position || d.position;
      if (!dp) continue;
      const cy = dp.y + (d.height || 0.95) * 0.45;
      const dist = Math.hypot(dp.x - centerPos.x, cy - (centerPos.y ?? cy), dp.z - centerPos.z);
      if (dist <= radius + (d.radius || 0.45)) {
        if (popDecoy(d, shooterChar, null)) poppedCount++;
      }
    }
    return poppedCount;
  }

  // --------------------------------------------------------------------------
  // 2. Smoke / Petal Dash ([X] or Double-Tap Shift — 12s CD, 1.58× Speed)
  // --------------------------------------------------------------------------
  function buildSmokeCloudVisual(basePos, poofTheme = 'sakura') {
    if (!THREE) return { group: null, puffs: [], petals: [], mats: [], puffMats: [], petalMats: [] };
    const gc = getGeoCache();
    const group = new THREE.Group();
    group.position.set(basePos.x, basePos.y, basePos.z);

    const puffColors = poofTheme === 'puffball'
      ? [0xfff5e4, 0xe8dfd0, 0xf3ead6, 0xffdf9a]
      : poofTheme === 'starlight'
        ? [0xfff9eb, 0xfff0c2, 0xe6f6ff, 0xffe49c]
        : [0xfff8ea, 0xffeef2, 0xfaf0dc, 0xffdce6];

    const petalColors = poofTheme === 'starlight'
      ? [0xffe066, 0xfff3b0, 0xb8ecff]
      : [0xffb7c5, 0xffd4df, 0xff9cb4, 0xfff0f4];

    const puffs = [];
    const petals = [];
    const puffMats = puffColors.map((color) => new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    }));
    const petalMats = petalColors.map((color) => new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    }));
    const mats = [...puffMats, ...petalMats];

    // 14 billowing cream & blush steam puff spheres sharing 4 pooled color materials
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + rand(-0.22, 0.22);
      const ringDist = i < 4 ? rand(0.15, 0.75) : rand(0.85, 1.88);
      const targetR = i < 4 ? rand(0.78, 1.08) : rand(0.58, 0.92);
      const mat = puffMats[i % puffMats.length];
      const m = new THREE.Mesh(gc.sphereMid, mat);
      const baseY = rand(0.45, 1.55);
      m.position.set(Math.cos(ang) * ringDist * 0.45, baseY, Math.sin(ang) * ringDist * 0.45);
      m.scale.setScalar(targetR * 0.42);
      m.renderOrder = 3;
      group.add(m);
      puffs.push({
        mesh: m,
        mat,
        ang,
        ringDist,
        baseY,
        driftY: rand(0.18, 0.52),
        targetR,
        swirlSpd: rand(0.45, 1.05) * (i % 2 === 0 ? 1 : -1),
        baseOp: rand(0.62, 0.82),
      });
    }

    // 26 swirling 3D sakura petals sharing 3-4 pooled color materials
    for (let i = 0; i < 26; i++) {
      const isStar = poofTheme === 'starlight' && i % 3 === 0;
      const mat = petalMats[i % petalMats.length];
      const m = new THREE.Mesh(isStar ? gc.star : gc.petal, mat);
      const sc = isStar ? rand(0.06, 0.095) : rand(1.05, 1.65);
      m.scale.setScalar(sc);
      m.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
      const ang = (i / 26) * Math.PI * 2 + rand(-0.2, 0.2);
      const orbitR = rand(0.45, SMOKE_CLOUD_RADIUS * 0.96);
      const y0 = rand(0.18, 1.85);
      m.position.set(Math.cos(ang) * orbitR * 0.5, y0, Math.sin(ang) * orbitR * 0.5);
      group.add(m);
      petals.push({
        mesh: m,
        mat,
        ang,
        orbitR,
        y0,
        vy: rand(0.22, 0.68),
        omega: rand(1.8, 3.4),
        spinX: rand(-6, 6),
        spinZ: rand(-6, 6),
      });
    }

    group.userData.ownedMaterials = mats;
    return { group, puffs, petals, mats, puffMats, petalMats };
  }

  function useSmokeDash(ch = env.G?.player, opts = null) {
    if (!ch) ch = env.G?.player;
    const fromNet = !!(opts && opts.fromNet);
    if (!isLivingHider(ch) || (!fromNet && !isValidTrickPhase(ch))) return false;

    const now = getNow();
    const st = getCharState(ch);
    if (!fromNet && now < st.smokeReadyAt) {
      if (ch === env.G?.player) {
        const rem = Math.max(1, Math.ceil((st.smokeReadyAt - now) / 1000));
        env.hint?.(`🌸 Petal Dash recharging (${rem}s)…`, 950);
      }
      return false;
    }

    const px = ch.position.x;
    const pz = ch.position.z;
    const baseY = env.groundHeightAt
      ? env.groundHeightAt(px, pz, ch.userData?.groundY ?? ch.position.y ?? 0)
      : (ch.userData?.groundY ?? ch.position.y ?? 0);

    const poofTheme = (fromNet && opts && opts.poofTheme)
      ? opts.poofTheme
      : (ch === env.G?.player ? (env.getEquippedPoof?.() || 'sakura') : 'sakura');
    const vis = buildSmokeCloudVisual({ x: px, y: baseY, z: pz }, poofTheme);
    if (vis.group && env.scene) {
      env.scene.add(vis.group);
    }

    const center = THREE
      ? new THREE.Vector3(px, baseY + 0.95, pz)
      : { x: px, y: baseY + 0.95, z: pz };

    smokes.push({
      id: ++uidSeq,
      owner: ch,
      root: vis.group,
      puffs: vis.puffs,
      petals: vis.petals,
      puffMats: vis.puffMats,
      petalMats: vis.petalMats,
      position: vis.group ? vis.group.position : { x: px, y: baseY, z: pz },
      center,
      radius: SMOKE_CLOUD_RADIUS,
      losRadius: SMOKE_LOS_RADIUS,
      createdAt: now,
      age: 0,
      duration: SMOKE_DURATION_SEC,
    });

    st.smokeReadyAt = now + getSmokeCdMsFor(ch);
    st.dashUntil = now + DASH_DURATION_MS;
    st.trailEmitT = 0;
    if (ch.userData) ch.userData.dashUntil = st.dashUntil;
    env.onDashCleanse?.(ch, getHiderPerk(ch) === 'twin_dash');

    if (!fromNet) {
      env.onLocalGadget?.({
        k: 'smoke',
        t: 0,
        s: ch.userData?.actor?.slotIdx ?? 0,
        pf: poofTheme,
      }, ch);
    }

    synthSmokeDash(ch === env.G?.player ? null : center);
    env.ripple?.(ch.position, 1.45);
    const splashCenter = env.centerOf ? env.centerOf(ch) : center;
    env.splash?.(splashCenter, 16, 2.2);
    if (env.G?.phase === 'survive' || env.G?.phase === 'seek') {
      env.emitSoundCue?.(ch.position, 12.5, 'dash', ch);
    }

    const minDist = nearestSeekerDistance(ch.position);
    if (minDist <= 15) {
      env.recordStat?.(ch, 'smokeEscapes', 1);
      if (ch === env.G?.player) {
        env.awardTokens?.('smoke_juke', 15, '🌸 Petal Dash Escape! +15 🪙');
        env.hint?.('🌸 Petal Dash Escape! +15 Spirit Tokens', 1500);
      }
    } else if (ch === env.G?.player) {
      env.hint?.('🌸 Petal Dash! Smoke screen & speed boost!', 1250);
    }

    return true;
  }

  function getSpeedMultiplier(ch) {
    if (!ch || ch.userData?.actor?.eliminated) return 1.0;
    const st = charStates.get(ch);
    const until = st ? st.dashUntil : (ch.userData?.dashUntil || -1e9);
    return getNow() < until ? DASH_SPEED_MULT : 1.0;
  }

  function breaksLineOfSight(fromPos, toPos) {
    if (!smokes.length || !fromPos || !toPos) return false;
    const dx = toPos.x - fromPos.x;
    const dy = (toPos.y ?? 0) - (fromPos.y ?? 0);
    const dz = toPos.z - fromPos.z;
    const lenSq = dx * dx + dy * dy + dz * dz;
    const rSq = SMOKE_LOS_RADIUS * SMOKE_LOS_RADIUS;

    for (let i = 0; i < smokes.length; i++) {
      const c = smokes[i].center;
      if (!c) continue;
      if (lenSq < 1e-8) {
        const px = c.x - fromPos.x, py = c.y - (fromPos.y ?? 0), pz = c.z - fromPos.z;
        if (px * px + py * py + pz * pz <= rSq) return true;
        continue;
      }
      const t = clamp(((c.x - fromPos.x) * dx + (c.y - (fromPos.y ?? 0)) * dy + (c.z - fromPos.z) * dz) / lenSq, 0, 1);
      const qx = fromPos.x + dx * t - c.x;
      const qy = (fromPos.y ?? 0) + dy * t - c.y;
      const qz = fromPos.z + dz * t - c.z;
      if (qx * qx + qy * qy + qz * qz <= rSq) return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 3. Voluntary Whistle / Taunt ([T] — 7s CD) + 35s Auto-Giggle
  // --------------------------------------------------------------------------
  function useTaunt(ch = env.G?.player, tauntIdOverride = null, opts = null) {
    if (!ch) ch = env.G?.player;
    const fromNet = !!(opts && opts.fromNet);
    if (!isLivingHider(ch) || (!fromNet && !isValidTrickPhase(ch))) return false;

    const now = getNow();
    const st = getCharState(ch);
    if (!fromNet && now < st.tauntReadyAt) {
      if (ch === env.G?.player) {
        const rem = Math.max(1, Math.ceil((st.tauntReadyAt - now) / 1000));
        env.hint?.(`🔔 Whistle recharging (${rem}s)…`, 950);
      }
      return false;
    }

    const tauntId = tauntIdOverride
      || (ch === env.G?.player ? env.getEquippedTaunt?.() : st.botTauntId)
      || 'chirp';

    st.tauntReadyAt = now + TAUNT_CD_MS;
    // Reward active voluntary play by resetting own 35s auto-giggle timer!
    st.giggleTimer = GIGGLE_INTERVAL_SEC;
    st.giggleWarned = false;

    if (!fromNet) {
      env.onLocalGadget?.({
        k: 'taunt',
        t: 0,
        s: ch.userData?.actor?.slotIdx ?? 0,
        id: tauntId,
      }, ch);
    }

    synthTauntById(tauntId, ch === env.G?.player ? null : ch.position);
    emitTauntNotesVFX(ch);
    env.ripple?.(ch.position, 1.35);
    env.emitSoundCue?.(ch.position, 42, 'taunt', ch);

    const minDist = nearestSeekerDistance(ch.position);
    env.recordStat?.(ch, 'taunts', 1);

    if (minDist <= 16) {
      env.recordStat?.(ch, 'closeTaunts', 1);
      if (ch === env.G?.player) {
        const dRound = Math.max(1, Math.round(minDist));
        env.awardTokens?.('close_taunt', 30, `🔔 Daredevil Whistle (${dRound}m from Seeker)! 3× Bonus +30 🪙`);
        env.hint?.('🔔 Daredevil Whistle! +30 Spirit Tokens (Seeker nearby!)', 1900);
      }
    } else if (ch === env.G?.player) {
      env.awardTokens?.('taunt', 10, '🎵 Playful Whistle! +10 🪙');
      env.hint?.('🎵 Whistle! +10 Spirit Tokens', 1400);
    }

    // Subtle atmospheric feedback for local Seeker when a Hider whistles nearby
    if (env.G?.mode === 'seek' && env.G?.player && ch !== env.G.player && now - lastSeekWhistleHintAt > 8500) {
      const distToMe = Math.hypot(ch.position.x - env.G.player.position.x, ch.position.z - env.G.player.position.z);
      if (distToMe < 38) {
        lastSeekWhistleHintAt = now;
        env.hint?.('🎵 A playful Spirit whistle echoed nearby…!', 1600);
      }
    }

    return true;
  }

  function triggerAutoGiggle(h, st) {
    st.giggleTimer = GIGGLE_INTERVAL_SEC;
    st.giggleWarned = false;
    synthSpiritGiggle(h === env.G?.player ? null : h.position);
    emitFireflyWispVFX(h);
    env.emitSoundCue?.(h.position, 28, 'giggle', h);
    env.ripple?.(h.position, 1.15);

    if (h === env.G?.player && !env.G?.spectating) {
      env.hint?.('✨ Spirit giggle! Nearby seekers heard a soft chime…', 1750);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Smart Autonomous Hider Usage (Non-Remote Hiders inside update(dt))
  // --------------------------------------------------------------------------
  function updateAutonomousHiderTricks(h, st, dt, now, huntActive) {
    const u = h.userData;
    const ai = u?.ai;
    if (!ai || !u?.actor?.isBot || u?.actor?.isRemote || u?.actor?.eliminated) return;

    if (ai.state === 'evade') {
      st.evadeDuration += dt;
      st.hiddenDuration = 0;

      // Pop Smoke / Petal Dash promptly when chased to break seeker LOS & sprint away!
      if (st.evadeDuration >= 0.14 && now >= st.smokeReadyAt) {
        useSmokeDash(h);
      }

      // Drop a Decoy Clone behind while fleeing!
      if (st.evadeDuration >= 0.38 && now >= st.decoyReadyAt) {
        useDecoy(h);
      }
      return;
    }

    st.evadeDuration = 0;

    if (ai.state === 'hidden') {
      st.hiddenDuration += dt;

      if (st.hiddenDuration > 10.0) {
        // Occasional twin Decoy placement offset 1.8m..3.2m away from hiding spot
        // so Seeker spy-checks or Splash-Bombs on the Decoy don't clip the real Hider!
        st.nextBotDecoyT -= dt;
        if (st.nextBotDecoyT <= 0) {
          const myDecoys = decoys.filter((d) => d.owner === h);
          const minSeekD = nearestSeekerDistance(h.position);
          if (myDecoys.length < MAX_DECOYS_PER_HIDER && now >= st.decoyReadyAt && minSeekD > 9.5) {
            const curY = u.groundY ?? h.position.y ?? 0;
            const baseAng = rand(0, Math.PI * 2);
            let placedDecoy = false;
            for (let attempt = 0; attempt < 6; attempt++) {
              const ang = baseAng + (attempt / 6) * Math.PI * 2 + rand(-0.18, 0.18);
              const dist = rand(1.8, 3.2);
              const ox = h.position.x + Math.cos(ang) * dist;
              const oz = h.position.z + Math.sin(ang) * dist;
              const oy = env.groundHeightAt ? env.groundHeightAt(ox, oz, curY) : curY;
              const clearOfOwnDecoys = myDecoys.every(
                (d) => Math.hypot(ox - d.position.x, oz - d.position.z) > 1.4
              );
              if (Math.abs(oy - curY) < 0.36 && clearOfOwnDecoys) {
                placedDecoy = useDecoy(h, {
                  x: ox,
                  z: oz,
                  rotY: (h.rotation?.y || 0) + rand(-0.32, 0.32),
                });
                if (placedDecoy) break;
              }
            }
            st.nextBotDecoyT = placedDecoy ? rand(22, 38) : rand(6, 11);
          } else {
            st.nextBotDecoyT = rand(6, 12);
          }
        }
      }

      // Cheeky staggered voluntary Whistle (~24-46s + per-slot jitter) during active hunt
      // Only when nearest Seeker is 7.5m..34m away so whistles feel daring & alive rather than silent or suicidal!
      if (huntActive) {
        st.nextBotTauntT -= dt;
        if (st.nextBotTauntT <= 0 && st.hiddenDuration > 4.5) {
          const slotIdx = u?.actor?.slotIdx ?? st.slotIdx ?? 0;
          const slotJitter = (slotIdx % 5) * 2.4 + rand(-1.2, 1.2);
          const minSeekD = nearestSeekerDistance(h.position);
          if (minSeekD > 7.5 && minSeekD < 34 && now >= st.tauntReadyAt) {
            st.nextBotTauntT = rand(24, 46) + slotJitter;
            useTaunt(h);
          } else {
            st.nextBotTauntT = rand(3.5, 7.0) + (slotIdx % 5) * 0.6;
          }
        }
      }
    } else {
      st.hiddenDuration = 0;
    }
  }

  // --------------------------------------------------------------------------
  // 5. DOM HUD Bar (#hiderTricksBar) & Soap-Bubble Blind (#hsBubbleBlind)
  // --------------------------------------------------------------------------
  function ensureStylesheetLinked() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.querySelector('link[href*="hider_tricks.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'hider_tricks.css?v=1';
    document.head.appendChild(link);
  }

  function triggerBubbleBlind(durationMs = 1500, ownerName = 'Spirit') {
    if (typeof document === 'undefined') return;
    if (!bubbleBlindEl) mountUI();
    if (!bubbleBlindEl) return;

    clearTimeout(bubbleBlindTimer);
    bubbleBlindEl.innerHTML = '';

    // Glossy pastel soap bubbles drifting across the screen
    for (let i = 0; i < 18; i++) {
      const b = document.createElement('div');
      b.className = 'hs-bub';
      const sz = Math.round(rand(42, 136));
      b.style.width = `${sz}px`;
      b.style.height = `${sz}px`;
      b.style.left = `${Math.round(rand(-4, 96))}%`;
      b.style.top = `${Math.round(rand(8, 92))}%`;
      b.style.setProperty('--sway', `${Math.round(rand(-34, 34))}px`);
      b.style.setProperty('--dur', `${rand(1.25, 1.65).toFixed(2)}s`);
      b.style.animationDelay = `${rand(0, 0.22).toFixed(2)}s`;
      bubbleBlindEl.appendChild(b);
    }

    // Soft dandelion puffs drifting across the screen
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('div');
      s.className = 'hs-puffball';
      const sz = Math.round(rand(36, 56));
      s.style.setProperty('--sz', `${sz}px`);
      s.style.left = `${Math.round(rand(14, 84))}%`;
      s.style.top = `${Math.round(rand(22, 78))}%`;
      s.style.setProperty('--dx', `${Math.round(rand(-55, 55))}px`);
      s.style.setProperty('--dur', `${rand(1.2, 1.55).toFixed(2)}s`);
      bubbleBlindEl.appendChild(s);
    }

    const banner = document.createElement('div');
    banner.className = 'hs-blind-banner';
    banner.textContent = `🫧 Bamboozled! ${ownerName}'s Decoy! 🎭`;
    bubbleBlindEl.appendChild(banner);

    bubbleBlindEl.classList.add('on');
    bubbleBlindTimer = setTimeout(() => {
      if (bubbleBlindEl) bubbleBlindEl.classList.remove('on');
    }, durationMs);
  }

  function mountUI() {
    if (typeof document === 'undefined') return;
    ensureStylesheetLinked();

    const hud = document.getElementById('hud');
    if (hud && !document.getElementById('hiderTricksBar')) {
      const bar = document.createElement('div');
      bar.id = 'hiderTricksBar';
      bar.className = 'hidden';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Spirit Tricks');
      bar.innerHTML =
        `<button type="button" id="btnTrickDecoy" class="ht-pill" title="Spawn Decoy Clone [C]">` +
          `<i class="ht-sweep" id="htDecoySweep"></i>` +
          `<kbd class="ht-key">C</kbd>` +
          `<span class="ht-ic">🎭</span>` +
          `<span class="ht-txt"><b>Decoy</b><small id="htDecoyMeta">0/${MAX_DECOYS_PER_HIDER} active</small></span>` +
          `<em class="ht-cd" id="htDecoyCd"></em>` +
        `</button>` +
        `<button type="button" id="btnTrickSmoke" class="ht-pill" title="Sakura Petal Dash [X or 2× Shift]">` +
          `<i class="ht-sweep" id="htSmokeSweep"></i>` +
          `<kbd class="ht-key">X</kbd>` +
          `<span class="ht-ic">🌸</span>` +
          `<span class="ht-txt"><b>Petal Dash</b><small id="htSmokeMeta">2× Shift</small></span>` +
          `<em class="ht-cd" id="htSmokeCd"></em>` +
        `</button>` +
        `<button type="button" id="btnTrickTaunt" class="ht-pill" title="Playful Whistle [T] — 3× Bonus near Seekers!">` +
          `<i class="ht-sweep" id="htTauntSweep"></i>` +
          `<kbd class="ht-key">T</kbd>` +
          `<span class="ht-ring-wrap">` +
            `<svg class="ht-giggle-svg" viewBox="0 0 32 32" aria-hidden="true">` +
              `<circle class="ht-giggle-track" cx="16" cy="16" r="13.5"></circle>` +
              `<circle class="ht-giggle-arc" id="htGiggleArc" cx="16" cy="16" r="13.5"></circle>` +
            `</svg>` +
            `<span class="ht-ic">🔔</span>` +
          `</span>` +
          `<span class="ht-txt"><b>Whistle <span class="ht-3x">3×</span></b><small id="htTauntMeta">+10🪙 · 3× near</small></span>` +
          `<em class="ht-cd" id="htTauntCd"></em>` +
        `</button>`;
      hud.appendChild(bar);

      const bindPill = (id, fn) => {
        const el = document.getElementById(id);
        if (!el) return null;
        el.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          ensureTrickAudio();
          env.audio?.tap?.();
          fn();
        });
        return el;
      };

      btnDecoyEl = bindPill('btnTrickDecoy', () => useDecoy(env.G?.player));
      btnSmokeEl = bindPill('btnTrickSmoke', () => useSmokeDash(env.G?.player));
      btnTauntEl = bindPill('btnTrickTaunt', () => useTaunt(env.G?.player));
    }

    barEl = document.getElementById('hiderTricksBar');
    btnDecoyEl = document.getElementById('btnTrickDecoy');
    btnSmokeEl = document.getElementById('btnTrickSmoke');
    btnTauntEl = document.getElementById('btnTrickTaunt');
    decoyMetaEl = document.getElementById('htDecoyMeta');
    decoySweepEl = document.getElementById('htDecoySweep');
    decoyCdEl = document.getElementById('htDecoyCd');
    smokeMetaEl = document.getElementById('htSmokeMeta');
    smokeSweepEl = document.getElementById('htSmokeSweep');
    smokeCdEl = document.getElementById('htSmokeCd');
    tauntMetaEl = document.getElementById('htTauntMeta');
    tauntSweepEl = document.getElementById('htTauntSweep');
    tauntCdEl = document.getElementById('htTauntCd');
    giggleArcEl = document.getElementById('htGiggleArc');

    const app = document.getElementById('app');
    if (app && !document.getElementById('hsBubbleBlind')) {
      const blind = document.createElement('div');
      blind.id = 'hsBubbleBlind';
      blind.setAttribute('aria-hidden', 'true');
      app.appendChild(blind);
    }
    bubbleBlindEl = document.getElementById('hsBubbleBlind');
  }

  function updateHUD(now) {
    if (!barEl && typeof document !== 'undefined' && document.getElementById('hud')) {
      mountUI();
    }
    if (!barEl) return;

    const G = env?.G;
    const showBar = !!(
      G &&
      G.mode === 'hide' &&
      !G.spectating &&
      !G.over &&
      (G.phase === 'hide' || G.phase === 'survive') &&
      G.player &&
      !G.player.userData?.actor?.eliminated
    );

    barEl.classList.toggle('hidden', !showBar);
    if (!showBar) return;

    const st = getCharState(G.player);
    const setText = (el, key, val) => {
      if (el && _htHudCache[key] !== val) {
        _htHudCache[key] = val;
        el.textContent = val;
      }
    };

    // 1. Decoy Pill
    const myMaxDecoys = getMaxDecoysFor(G.player);
    const myDecoyCdMs = getDecoyCdMsFor(G.player);
    const myDecoyCount = decoys.reduce((acc, d) => acc + (d.owner === G.player ? 1 : 0), 0);
    const decoyRem = Math.max(0, st.decoyReadyAt - now);
    const decoyFrac = clamp(decoyRem / myDecoyCdMs, 0, 1);
    const dCooling = decoyRem > 40;
    const dHas = myDecoyCount > 0;
    if (btnDecoyEl) {
      if (_htHudCache.dCool !== dCooling) { _htHudCache.dCool = dCooling; btnDecoyEl.classList.toggle('is-cooling', dCooling); }
      if (_htHudCache.dHas !== dHas) { _htHudCache.dHas = dHas; btnDecoyEl.classList.toggle('has-active', dHas); }
    }
    const dSweepVal = `scaleY(${decoyFrac.toFixed(2)})`;
    if (decoySweepEl && _htHudCache.dSweep !== dSweepVal) {
      _htHudCache.dSweep = dSweepVal;
      decoySweepEl.style.transform = dSweepVal;
    }
    setText(decoyCdEl, 'dCd', dCooling ? `${Math.ceil(decoyRem / 1000)}s` : '');
    setText(decoyMetaEl, 'dMeta', `${myDecoyCount}/${myMaxDecoys} active`);

    // 2. Petal Dash Pill
    const mySmokeCdMs = getSmokeCdMsFor(G.player);
    const smokeRem = Math.max(0, st.smokeReadyAt - now);
    const smokeFrac = clamp(smokeRem / mySmokeCdMs, 0, 1);
    const isDashing = now < st.dashUntil;
    const sCooling = smokeRem > 40 && !isDashing;
    if (btnSmokeEl) {
      if (_htHudCache.sCool !== sCooling) { _htHudCache.sCool = sCooling; btnSmokeEl.classList.toggle('is-cooling', sCooling); }
      if (_htHudCache.sDash !== isDashing) { _htHudCache.sDash = isDashing; btnSmokeEl.classList.toggle('is-dashing', isDashing); }
    }
    const sSweepVal = `scaleY(${(isDashing ? 0 : smokeFrac).toFixed(2)})`;
    if (smokeSweepEl && _htHudCache.sSweep !== sSweepVal) {
      _htHudCache.sSweep = sSweepVal;
      smokeSweepEl.style.transform = sSweepVal;
    }
    setText(smokeCdEl, 'sCd', (!isDashing && smokeRem > 40) ? `${Math.ceil(smokeRem / 1000)}s` : '');
    setText(smokeMetaEl, 'sMeta', isDashing ? '1.58× Sprint!' : '2× Shift');

    // 3. Whistle / Auto-Giggle Pill
    const tauntRem = Math.max(0, st.tauntReadyAt - now);
    const tauntFrac = clamp(tauntRem / TAUNT_CD_MS, 0, 1);
    if (!_htHudCache.lastSeekAt || now - _htHudCache.lastSeekAt > 180) {
      _htHudCache.lastSeekAt = now;
      _htHudCache.minSeekDist = nearestSeekerDistance(G.player.position);
    }
    const minSeekDist = _htHudCache.minSeekDist ?? 99;
    const daredevil = minSeekDist <= 16;
    const giggleFrac = G.phase === 'survive' ? clamp(st.giggleTimer / GIGGLE_INTERVAL_SEC, 0, 1) : 1;
    const giggleSoon = G.phase === 'survive' && st.giggleTimer <= 6.5;

    const tCool = tauntRem > 40;
    const tDare = daredevil && !tCool;
    if (btnTauntEl) {
      if (_htHudCache.tCool !== tCool) { _htHudCache.tCool = tCool; btnTauntEl.classList.toggle('is-cooling', tCool); }
      if (_htHudCache.tDare !== tDare) { _htHudCache.tDare = tDare; btnTauntEl.classList.toggle('is-daredevil', tDare); }
      if (_htHudCache.gSoon !== giggleSoon) { _htHudCache.gSoon = giggleSoon; btnTauntEl.classList.toggle('giggle-soon', giggleSoon); }
    }
    const tSweepVal = `scaleY(${tauntFrac.toFixed(2)})`;
    if (tauntSweepEl && _htHudCache.tSweep !== tSweepVal) {
      _htHudCache.tSweep = tSweepVal;
      tauntSweepEl.style.transform = tSweepVal;
    }
    setText(tauntCdEl, 'tCd', tCool ? `${Math.ceil(tauntRem / 1000)}s` : '');
    if (giggleArcEl) {
      const circ = 84.82;
      const gVal = (circ * (1 - giggleFrac)).toFixed(1);
      if (_htHudCache.gArc !== gVal) {
        _htHudCache.gArc = gVal;
        giggleArcEl.style.strokeDashoffset = gVal;
      }
    }
    if (tauntMetaEl) {
      const tMetaStr = daredevil
        ? `3× ${Math.max(1, Math.round(minSeekDist))}m! +30🪙`
        : (G.phase === 'survive' ? `Chime ${Math.max(1, Math.ceil(st.giggleTimer))}s` : '+10🪙 · 3× near');
      setText(tauntMetaEl, 'tMeta', tMetaStr);
    }
  }

  // --------------------------------------------------------------------------
  // Keyboard Input Handler
  // --------------------------------------------------------------------------
  function handleKeyDown(e) {
    if (!e || e.repeat) return false;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return false;

    const G = env?.G;
    if (!G || G.mode !== 'hide' || G.over || G.spectating) return false;
    if (G.phase !== 'hide' && G.phase !== 'survive') return false;
    if (!G.player || G.player.userData?.actor?.eliminated) return false;

    ensureTrickAudio();

    if (e.code === 'KeyC') {
      return useDecoy(G.player);
    }
    if (e.code === 'KeyX') {
      return useSmokeDash(G.player);
    }
    if (e.code === 'KeyT') {
      return useTaunt(G.player);
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      const tapNow = getNow();
      if (tapNow - lastShiftDownAt <= DOUBLE_SHIFT_WINDOW_MS) {
        lastShiftDownAt = 0;
        return useSmokeDash(G.player);
      }
      lastShiftDownAt = tapNow;
      return false;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Frame Update Loop & Round Cleanup
  // --------------------------------------------------------------------------
  function update(dt) {
    if (!(dt >= 0)) return;
    latestEnvRef = env;
    const now = getNow();
    const G = env?.G;

    // 1. Animate active Decoy Clones (pop-in spring + gentle spirit leaf sway)
    for (let i = decoys.length - 1; i >= 0; i--) {
      const d = decoys[i];
      d.age += dt;
      if (d.scale !== 1 || Math.abs(d.scaleVel) > 0.002) {
        const force = (1.0 - d.scale) * 68 - d.scaleVel * 11.5;
        d.scaleVel += force * dt;
        d.scale = clamp(d.scale + d.scaleVel * dt, 0.4, 1.24);
        if (Math.abs(1.0 - d.scale) < 0.003 && Math.abs(d.scaleVel) < 0.015) {
          d.scale = 1.0;
          d.scaleVel = 0;
        }
        d.root?.scale?.setScalar?.(d.scale);
      }
      if (!d.isClonedProp && d.visual?.userData?.sprout) {
        d.visual.userData.sprout.rotation.z = Math.sin(d.age * 3.1 + d.id) * 0.09;
      }
    }

    // 2. Animate active Sakura Petal & Cream Steam Clouds
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.age += dt;
      if (s.age >= s.duration) {
        if (s.root && env?.scene) env.scene.remove(s.root);
        disposeOwnedMaterials(s.root);
        smokes.splice(i, 1);
        continue;
      }
      const k = clamp(s.age / s.duration, 0, 1);
      const expand = Math.min(1, s.age / 0.34);
      const easeOut = 1 - Math.pow(1 - expand, 3);
      const fade = k > 0.66 ? clamp(1 - (k - 0.66) / 0.34, 0, 1) : 1;

      if (s.puffMats) {
        const op = 0.74 * fade;
        for (let pi = 0; pi < s.puffMats.length; pi++) s.puffMats[pi].opacity = op;
      }
      if (s.petalMats) {
        const op = 0.94 * fade;
        for (let pi = 0; pi < s.petalMats.length; pi++) s.petalMats[pi].opacity = op;
      }

      for (const pf of s.puffs) {
        const curAng = pf.ang + s.age * pf.swirlSpd;
        const r = pf.ringDist * (0.38 + 0.68 * easeOut);
        pf.mesh.position.set(
          Math.cos(curAng) * r,
          pf.baseY + s.age * pf.driftY,
          Math.sin(curAng) * r,
        );
        pf.mesh.scale.setScalar(pf.targetR * (0.45 + 0.68 * easeOut + k * 0.16));
      }
      for (const pt of s.petals) {
        const curAng = pt.ang + s.age * pt.omega;
        const r = pt.orbitR * (0.42 + 0.58 * easeOut);
        pt.mesh.position.set(
          Math.cos(curAng) * r,
          ((pt.y0 + s.age * pt.vy) % 2.15),
          Math.sin(curAng) * r,
        );
        pt.mesh.rotation.x += pt.spinX * dt;
        pt.mesh.rotation.z += pt.spinZ * dt;
      }
    }

    // 3. Animate transient 3D VFX bursts (puffball sprites, petals, stars, notes, wisps)
    for (let i = fxBursts.length - 1; i >= 0; i--) {
      const b = fxBursts[i];
      b.age += dt;
      if (b.age >= b.duration) {
        if (b.grp && env?.scene) env.scene.remove(b.grp);
        disposeOwnedMaterials(b.grp);
        fxBursts.splice(i, 1);
        continue;
      }
      const k = clamp(b.age / b.duration, 0, 1);
      const alpha = k > 0.55 ? clamp(1 - (k - 0.55) / 0.45, 0, 1) : 1;
      for (const p of b.particles) {
        if (p.grav) p.vy -= p.grav * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (p.flutter) {
          p.mesh.position.x += Math.sin(b.age * p.flutter) * 0.42 * dt;
        }
        if (p.swirlSpd) {
          p.swirlAng += p.swirlSpd * dt;
          p.mesh.position.x += Math.cos(p.swirlAng) * 0.35 * dt;
          p.mesh.position.z += Math.sin(p.swirlAng) * 0.35 * dt;
        }
        if (p.expandRate) {
          p.mesh.scale.setScalar(p.baseScale + b.age * p.expandRate);
        }
        if (p.rotSpd) {
          p.mesh.rotation.x += p.rotSpd * 0.7 * dt;
          p.mesh.rotation.y += p.rotSpd * dt;
        }
        if (p.mat) p.mat.opacity = alpha * 0.95;
        if (p.extraMat) p.extraMat.opacity = alpha * 0.95;
      }
    }

    // 4. Per-Hider Dash Trails, 35s Auto-Giggle Check & Smart Autonomous Tricks
    if (G && !G.over && G.phase !== 'menu' && G.phase !== 'vs') {
      const huntActive = (G.mode === 'hide' && G.phase === 'survive') || (G.mode === 'seek' && G.phase === 'seek');
      const livingHiders = getAllLivingHiders();

      for (const h of livingHiders) {
        const st = getCharState(h);

        // Trailing sakura petals while dashing!
        if (now < st.dashUntil) {
          st.trailEmitT -= dt;
          const spd = h.userData?.spd ?? 2.5;
          if (st.trailEmitT <= 0 && (spd > 0.25 || h === G.player)) {
            st.trailEmitT = 0.055;
            emitTrailPetal(h);
          }
        }

        // Dynamic Auto-Giggle Check during active hunt (tightens to 16s when only 1 Hider remains!)
        if (huntActive) {
          const aliveCount = (G.allHiders || []).reduce((acc, c) => acc + (c && !c.userData?.actor?.eliminated ? 1 : 0), 0);
          if (aliveCount <= 1 && st.giggleTimer > 16) st.giggleTimer = 16;
          st.giggleTimer -= dt;
          if (h === G.player && !G.spectating && st.giggleTimer <= GIGGLE_WARN_SEC && !st.giggleWarned) {
            st.giggleWarned = true;
            synthGiggleWarn();
            env.hint?.('🔔 Auto-giggle in 5s — press [T] to whistle for 3× bonus or reposition!', 2600);
          }
          if (st.giggleTimer <= 0) {
            triggerAutoGiggle(h, st);
            if (aliveCount <= 1) st.giggleTimer = 16;
          }
        }

        // Autonomous non-remote Hider trick intelligence
        updateAutonomousHiderTricks(h, st, dt, now, huntActive);
      }
    }

    // 5. Auto-update HUD bar
    updateHUD(now);
  }

  function clearAll() {
    for (let i = decoys.length - 1; i >= 0; i--) {
      disposeDecoyEntry(decoys[i], false);
    }
    decoys.length = 0;

    for (let i = smokes.length - 1; i >= 0; i--) {
      if (smokes[i].root && env?.scene) env.scene.remove(smokes[i].root);
      disposeOwnedMaterials(smokes[i].root);
    }
    smokes.length = 0;

    for (let i = fxBursts.length - 1; i >= 0; i--) {
      if (fxBursts[i].grp && env?.scene) env.scene.remove(fxBursts[i].grp);
      disposeOwnedMaterials(fxBursts[i].grp);
    }
    fxBursts.length = 0;

    charStates.clear();
    lastShiftDownAt = 0;
    lastSeekWhistleHintAt = -1e9;
    clearTimeout(bubbleBlindTimer);
    if (bubbleBlindEl) bubbleBlindEl.classList.remove('on');
    if (barEl) barEl.classList.add('hidden');
  }

  function resetRound() {
    clearAll();
    const hiders = getAllLivingHiders();
    for (const h of hiders) getCharState(h);
    updateHUD(getNow());
  }

  function resetCharCooldowns(ch = env?.G?.player) {
    if (!ch) return;
    const st = getCharState(ch);
    st.decoyReadyAt = -1e9;
    st.smokeReadyAt = -1e9;
    st.tauntReadyAt = -1e9;
    updateHUD(getNow());
  }

  function triggerEmergencyMirage(ch = env?.G?.player) {
    if (!ch || !isLivingHider(ch) || getHiderPerk(ch) !== 'phantom_mirage') return false;
    const now = getNow();
    const st = getCharState(ch);
    if (now < st.emergencyMirageReadyAt) return false;
    st.emergencyMirageReadyAt = now + 25000;
    useDecoy(ch, { freeEmergency: true });
    const px = ch.position.x;
    const pz = ch.position.z;
    const baseY = env.groundHeightAt
      ? env.groundHeightAt(px, pz, ch.userData?.groundY ?? ch.position.y ?? 0)
      : (ch.userData?.groundY ?? ch.position.y ?? 0);
    const vis = buildSmokeCloudVisual({ x: px, y: baseY, z: pz }, 'starlight');
    if (vis.group && env.scene) env.scene.add(vis.group);
    const center = THREE ? new THREE.Vector3(px, baseY + 0.95, pz) : { x: px, y: baseY + 0.95, z: pz };
    smokes.push({
      id: ++uidSeq,
      owner: ch,
      root: vis.group,
      puffs: vis.puffs,
      petals: vis.petals,
      puffMats: vis.puffMats,
      petalMats: vis.petalMats,
      position: vis.group ? vis.group.position : { x: px, y: baseY, z: pz },
      center,
      radius: SMOKE_CLOUD_RADIUS,
      losRadius: SMOKE_LOS_RADIUS,
      createdAt: now,
      age: 0,
      duration: 2.2,
    });
    st.dashUntil = Math.max(st.dashUntil, now + 950);
    if (ch.userData) ch.userData.dashUntil = st.dashUntil;
    env.onDashCleanse?.(ch, true);
    synthSmokeDash(ch === env.G?.player ? null : center);
    if (ch === env.G?.player) {
      env.hint?.('👻 Phantom Mirage triggered! Emergency smoke veil!', 1500);
    }
    return true;
  }

  function hasUsedTauntSince(ch = env?.G?.player, sinceNow = 0) {
    if (!ch) return false;
    const st = charStates.get(ch);
    return !!(st && st.tauntReadyAt > sinceNow);
  }

  return {
    mountUI,
    resetRound,
    clearAll,
    update,
    handleKeyDown,
    useDecoy,
    popDecoyByNetKey,
    useSmokeDash,
    triggerEmergencyMirage,
    useTaunt,
    playTauntPreview,
    getSpeedMultiplier,
    breaksLineOfSight,
    testWaterSegmentHit,
    triggerSplashArea,
    resetCharCooldowns,
    hasUsedTauntSince,
    getActiveDecoys: () => decoys,
    getActiveSmokes: () => smokes,
  };
}
