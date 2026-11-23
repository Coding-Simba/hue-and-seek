/* ============================================================================
 * Hue & Seek — Elemental Guns, 4-Second Persistent World Effects &
 *              Real Rigid-Body Prop Physics Engine (elemental_guns.js)
 *
 * Five Storybook Elemental Blasters for Seeker 5v5 Prop Hunt:
 *   1. 💦 Hydro Splasher (Water)        — 4s Fresnel sky-reflective puddles & dripping wet walls
 *   2. 🔥 Emberwick Hearth Igniter (Fire) — 4s upward-licking building/roof/ground flames, smoke, embers & firelight
 *   3. ❄️ Boreal Frostweaver (Snow)     — 4s sparkling 3D snowdrifts, wall icicles & prop-riding snow caps
 *   4. 🪨 Terra Boulderforge (Earth)    — 4s seismic rock clusters + 48 rigid-body bouncing/rolling boulders
 *   5. 🌪️ Gale Windcaller (Air)         — Real rigid-body prop physics on realProps (permanent in-round position + live ownBox sync)
 *                                         + Hider gust knockback + 4s swirling leaf whirlwinds
 * ============================================================================ */

export const ELEMENTAL_GUN_IDS = ['water', 'fire', 'snow', 'earth', 'air'];

export const PERSIST_DURATION = 4.0;
/** How long a full Frost Snare holds a hider (seconds, before perk multipliers). */
export const FREEZE_SEC = 1.0;
export const PERSIST_FADE_START = 2.4;

export const ELEMENTAL_GUN_SPECS = {
  water: {
    id: 'water',
    name: 'Hydro Splasher',
    shortName: 'Water',
    icon: '💦',
    actionLabel: 'Splash',
    verb: 'soaked',
    hitDamage: 7.0,
    shotSpeed: 30,
    gravityMul: 1.0,
    spread: 0.012,
    accentHex: 0x3fb8d8,
    hudBg: '#2b8fb8',
    gunColors: null, // Restores world / wardrobe blaster colors
    toastTag: 'Slippery Ground Puddles (Low Traction Skid)',
  },
  fire: {
    id: 'fire',
    name: 'Emberwick Hearth Igniter',
    shortName: 'Fire',
    icon: '🔥',
    actionLabel: 'Ignite',
    verb: 'scorched',
    hitDamage: 5.0,
    shotSpeed: 29,
    gravityMul: 0.65,
    spread: 0.015,
    accentHex: 0xff6b24,
    hudBg: '#d94e1f',
    gunColors: { tank: 0x2a1f1d, barrel: 0xb85228, grip: 0x3d2318 },
    toastTag: 'Ignite Burn DoT (4 dmg / 0.5s for 3s)',
  },
  snow: {
    id: 'snow',
    name: 'Boreal Frostweaver',
    shortName: 'Snow',
    icon: '❄️',
    actionLabel: 'Freeze',
    verb: 'frosted',
    hitDamage: 6.0,
    shotSpeed: 28,
    gravityMul: 0.82,
    spread: 0.014,
    accentHex: 0x7fd8ff,
    hudBg: '#3b8ec9',
    gunColors: { tank: 0xb8e8ff, barrel: 0xdcebf7, grip: 0x315475 },
    toastTag: `Chill Stacks → ${FREEZE_SEC}s Crystal Freeze!`,
  },
  earth: {
    id: 'earth',
    name: 'Terra Boulderforge',
    shortName: 'Earth',
    icon: '🪨',
    actionLabel: 'Quake',
    verb: 'boulder-tagged',
    hitDamage: 6.5,
    shotSpeed: 25,
    gravityMul: 1.38,
    spread: 0.011,
    accentHex: 0xb87a3d,
    hudBg: '#8c5a2b',
    gunColors: { tank: 0x7d6854, barrel: 0x5c4e41, grip: 0x47331f },
    toastTag: 'Heavy Slow (-35% Speed & -22% Jump)',
  },
  air: {
    id: 'air',
    name: 'Gale Windcaller',
    shortName: 'Air',
    icon: '🌪️',
    actionLabel: 'Gust',
    verb: 'gust-swept',
    hitDamage: 5.5,
    shotSpeed: 35,
    gravityMul: 0.18,
    spread: 0.010,
    accentHex: 0x9ef0dc,
    hudBg: '#2f9e88',
    gunColors: { tank: 0xeae0c6, barrel: 0xc99c49, grip: 0x295952 },
    toastTag: 'Lose Control Turbulence + Blasts Props',
  },
};

export function getElementSpec(elemId) {
  return ELEMENTAL_GUN_SPECS[elemId] || ELEMENTAL_GUN_SPECS.water;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / Math.max(1e-5, b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOutBack = (x) => {
  const t = clamp(x, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ============================================================================
// Prop Mass Archetypes for Air Rigid-Body Physics
// ============================================================================
const LIGHT_PROP_IDS = new Set([
  'bucket', 'stool', 'veg_basket', 'bread_basket', 'laundry_basket',
  'watering_can', 'pumpkin', 'flower_pot', 'potted_fern', 'milk_can',
  'book_stack', 'cushion_pile', 'lantern_stool', 'cart_wheel',
  'bw_thimble_stool', 'bw_button_stack', 'bw_inkwell_pot',
  'bh_daruma_doll', 'bh_coal_scuttle', 'cw_hatbox_stack', 'cw_pastry_tier',
  'sp_rope_coil', 'sp_lemon_planter',
]);

const HEAVY_PROP_IDS = new Set([
  'barrel', 'peel_barrel', 'hay_bale', 'hay_round', 'log_pile',
  'chest', 'grandfather_clock', 'stove', 'feed_trough', 'lantern_post',
  'tool_rack', 'bh_hinoki_tub', 'bh_sake_cask', 'sr_levitation_urn',
  'sr_propeller_barrel', 'sp_anchor_bollard', 'sp_wine_cask', 'cw_steam_samovar',
]);

function computePropMass(propRec, kitProps) {
  const id = propRec?.id || '';
  const r = clamp(propRec?.radius || 0.45, 0.22, 1.2);
  const h = clamp((kitProps && kitProps[id] && kitProps[id].height) || 0.9, 0.3, 2.4);
  const geomWeight = (0.55 + r * 1.35) * (0.65 + h * 0.42);
  if (LIGHT_PROP_IDS.has(id)) return clamp(geomWeight * 0.62, 0.58, 1.12);
  if (HEAVY_PROP_IDS.has(id)) return clamp(geomWeight * 1.85, 2.55, 4.65);
  return clamp(geomWeight * 1.08, 1.25, 2.35);
}

// ============================================================================
// Procedural Web Audio Synthesizer for Elemental Shots, Loops, Impacts & UI
// Shares audio.js's unlocked AudioContext & sfxBus so all 5 guns play reliably!
// ============================================================================
function createElementalAudio(env) {
  let ctx = null;
  let outDest = null;
  let verbDest = null;
  let whiteBuf = null;
  let pinkBuf = null;
  let holdNodes = null;
  let activeHoldElem = null;
  const lastShotAt = { water: 0, fire: 0, snow: 0, earth: 0, air: 0 };
  const lastImpactAt = { water: 0, fire: 0, snow: 0, earth: 0, air: 0 };
  const shotCounts = { water: 0, fire: 0, snow: 0, earth: 0, air: 0 };
  const impactCounts = { water: 0, fire: 0, snow: 0, earth: 0, air: 0 };
  let lastBumpAt = 0;

  function isMuted() {
    if (env?.audio && typeof env.audio.isMuted === 'function' && env.audio.isMuted()) {
      return true;
    }
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('hueseek.muted') === '1') {
        return true;
      }
    } catch (_e) { /* ignore */ }
    return false;
  }

  function buildNoiseBuffers(c) {
    if (whiteBuf && pinkBuf) return;
    if (env?.audio && typeof env.audio.getBuffers === 'function') {
      const shared = env.audio.getBuffers();
      if (shared?.white && shared?.pink) {
        whiteBuf = shared.white;
        pinkBuf = shared.pink;
        return;
      }
    }
    const sr = c.sampleRate;
    whiteBuf = c.createBuffer(1, Math.floor(sr * 1.4), sr);
    {
      const d = whiteBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    pinkBuf = c.createBuffer(1, Math.floor(sr * 1.6), sr);
    {
      const d = pinkBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.099;
        b1 = 0.963 * b1 + w * 0.296;
        b2 = 0.570 * b2 + w * 1.052;
        d[i] = (b0 + b1 + b2 + w * 0.18) * 0.22;
      }
    }
  }

  function ensureCtx() {
    if (isMuted() || typeof window === 'undefined') return null;

    // 1. Prefer sharing audio.js's already-unlocked master AudioContext & sfxBus!
    if (env?.audio && typeof env.audio.getContext === 'function') {
      const sharedCtx = env.audio.getContext();
      if (sharedCtx) {
        ctx = sharedCtx;
        outDest = (typeof env.audio.getSfxBus === 'function' && env.audio.getSfxBus()) || sharedCtx.destination;
        verbDest = typeof env.audio.getVerbIn === 'function' ? env.audio.getVerbIn() : null;
        buildNoiseBuffers(ctx);
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
      }
    }

    // 2. Standalone fallback AudioContext
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch (_e) {
        try { ctx = new AC(); } catch (_e2) { return null; }
      }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -15;
      comp.knee.value = 12;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      const master = ctx.createGain();
      master.gain.value = 0.85;
      comp.connect(master);
      master.connect(ctx.destination);
      outDest = comp;
      buildNoiseBuffers(ctx);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function buildHoldLoops(c) {
    if (holdNodes || !outDest || !whiteBuf || !pinkBuf) return holdNodes;
    const mkLoop = (buf) => {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, Math.random() * Math.max(0.1, buf.duration - 0.1));
      return s;
    };
    const mkLfo = (rate, depth, param) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = rate;
      g.gain.value = depth;
      o.connect(g);
      g.connect(param);
      o.start();
      return o;
    };

    // 🔥 Fire continuous hearth-bellows flamethrower roar
    const fireGain = c.createGain();
    fireGain.gain.value = 0;
    fireGain.connect(outDest);
    const fireLP = c.createBiquadFilter();
    fireLP.type = 'lowpass';
    fireLP.frequency.value = 410;
    fireLP.Q.value = 0.9;
    fireLP.connect(fireGain);
    mkLfo(8.5, 115, fireLP.frequency);
    mkLoop(pinkBuf).connect(fireLP);
    const fireCrackleBP = c.createBiquadFilter();
    fireCrackleBP.type = 'bandpass';
    fireCrackleBP.frequency.value = 1550;
    fireCrackleBP.Q.value = 1.4;
    const fireCrackleG = c.createGain();
    fireCrackleG.gain.value = 0.35;
    fireCrackleBP.connect(fireCrackleG);
    fireCrackleG.connect(fireGain);
    mkLoop(whiteBuf).connect(fireCrackleBP);

    // ❄️ Snow continuous sub-zero blizzard hiss + crystal shimmer
    const snowGain = c.createGain();
    snowGain.gain.value = 0;
    snowGain.connect(outDest);
    const snowBP = c.createBiquadFilter();
    snowBP.type = 'bandpass';
    snowBP.frequency.value = 3100;
    snowBP.Q.value = 1.1;
    snowBP.connect(snowGain);
    mkLfo(5.2, 650, snowBP.frequency);
    mkLoop(whiteBuf).connect(snowBP);
    const snowOsc = c.createOscillator();
    snowOsc.type = 'sine';
    snowOsc.frequency.value = 1318.5;
    const snowShimG = c.createGain();
    snowShimG.gain.value = 0.08;
    mkLfo(6.8, 0.05, snowShimG.gain);
    snowOsc.connect(snowShimG);
    snowShimG.connect(snowGain);
    snowOsc.start();

    // 🪨 Earth continuous tectonic rumble + stone-chamber grind
    const earthGain = c.createGain();
    earthGain.gain.value = 0;
    earthGain.connect(outDest);
    const earthLP = c.createBiquadFilter();
    earthLP.type = 'lowpass';
    earthLP.frequency.value = 195;
    earthLP.Q.value = 1.6;
    earthLP.connect(earthGain);
    mkLfo(11.5, 45, earthLP.frequency);
    mkLoop(pinkBuf).connect(earthLP);
    const earthDrone = c.createOscillator();
    earthDrone.type = 'triangle';
    earthDrone.frequency.value = 68;
    const earthDroneG = c.createGain();
    earthDroneG.gain.value = 0.22;
    earthDrone.connect(earthDroneG);
    earthDroneG.connect(earthGain);
    earthDrone.start();

    // 🌪️ Air continuous brass-turbine whir + howling wind-jet stream
    const airGain = c.createGain();
    airGain.gain.value = 0;
    airGain.connect(outDest);
    const airBP = c.createBiquadFilter();
    airBP.type = 'bandpass';
    airBP.frequency.value = 980;
    airBP.Q.value = 1.8;
    airBP.connect(airGain);
    mkLfo(4.6, 360, airBP.frequency);
    mkLoop(pinkBuf).connect(airBP);
    const airTurbine = c.createOscillator();
    airTurbine.type = 'sine';
    airTurbine.frequency.value = 460;
    mkLfo(14.0, 22, airTurbine.frequency);
    const airTurbineG = c.createGain();
    airTurbineG.gain.value = 0.12;
    airTurbine.connect(airTurbineG);
    airTurbineG.connect(airGain);
    airTurbine.start();

    holdNodes = {
      fire: { g: fireGain, lvl: 0.26 },
      snow: { g: snowGain, lvl: 0.20 },
      earth: { g: earthGain, lvl: 0.27 },
      air: { g: airGain, lvl: 0.24 },
    };
    return holdNodes;
  }

  function spatialize(worldPos, refDist = 10) {
    if (!worldPos || !env?.camera) return { gain: 1, pan: 0 };
    const cp = env.camera.position;
    const dx = worldPos.x - cp.x;
    const dy = (worldPos.y || 0) - (cp.y || 0);
    const dz = worldPos.z - cp.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.4) return { gain: 1, pan: 0 };
    if (dist > 40) return { gain: 0, pan: 0 };
    const gain = 1 / (1 + Math.pow(dist / refDist, 1.55));
    let pan = 0;
    const yaw = env.G?.yaw;
    if (typeof yaw === 'number') {
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const hd = Math.hypot(dx, dz) || 1;
      pan = clamp((dx * rx + dz * rz) / hd, -1, 1) * Math.min(1, hd / 3) * 0.82;
    }
    return { gain, pan };
  }

  function makeBus(c, gainVal, panVal, reverbAmt = 0) {
    const g = c.createGain();
    g.gain.value = clamp(gainVal, 0, 1.25);
    let tail = g;
    if (panVal && typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = clamp(panVal, -1, 1);
      g.connect(p);
      tail = p;
    }
    tail.connect(outDest || c.destination);
    if (reverbAmt > 0 && verbDest) {
      const vg = c.createGain();
      vg.gain.value = reverbAmt;
      tail.connect(vg);
      vg.connect(verbDest);
    }
    return g;
  }

  function tone(c, dest, t0, f0, f1, dur, vol, type = 'sine') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(24, f0), t0);
    if (f1 && f1 !== f0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(24, f1), t0 + dur * 0.9);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noise(c, dest, t0, f0, f1, q, dur, vol, fType = 'bandpass', usePink = false) {
    const buf = usePink ? pinkBuf : whiteBuf;
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const flt = c.createBiquadFilter();
    flt.type = fType;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(Math.max(35, f0), t0);
    if (f1 && f1 !== f0) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(35, f1), t0 + dur);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.02, dur * 0.22));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(dest);
    const maxOff = Math.max(0, buf.duration - dur - 0.04);
    src.start(t0, Math.random() * maxOff);
    src.stop(t0 + dur + 0.03);
  }

  function playTriggerEdge(c, elemId, isStart) {
    const bus = makeBus(c, 0.85, 0.06, 0.08);
    const t = c.currentTime + 0.003;
    if (elemId === 'fire') {
      if (isStart) {
        // Flint-spark click + pilot whoosh ignition
        noise(c, bus, t, 4200, 2100, 3.5, 0.035, 0.24, 'bandpass', false);
        noise(c, bus, t + 0.015, 680, 240, 0.8, 0.16, 0.30, 'lowpass', true);
        tone(c, bus, t + 0.01, 210, 95, 0.14, 0.18, 'triangle');
      } else {
        noise(c, bus, t, 420, 140, 0.9, 0.11, 0.16, 'lowpass', true);
      }
    } else if (elemId === 'snow') {
      if (isStart) {
        // Cryo-valve hiss + frost chime
        noise(c, bus, t, 2600, 5600, 1.3, 0.11, 0.20, 'highpass', false);
        tone(c, bus, t + 0.01, 1568, 2093, 0.12, 0.12, 'sine');
      } else {
        tone(c, bus, t, 1760, 1174.7, 0.09, 0.08, 'sine');
      }
    } else if (elemId === 'earth') {
      if (isStart) {
        // Heavy stone chamber lock clunk
        tone(c, bus, t, 130, 52, 0.12, 0.28, 'triangle');
        noise(c, bus, t, 900, 380, 1.8, 0.06, 0.18, 'bandpass', true);
      } else {
        tone(c, bus, t, 115, 62, 0.09, 0.16, 'triangle');
      }
    } else if (elemId === 'air') {
      if (isStart) {
        // Brass turbine spin-up whine
        tone(c, bus, t, 260, 680, 0.15, 0.15, 'sine');
        noise(c, bus, t, 480, 1950, 1.7, 0.14, 0.22, 'bandpass', true);
      } else {
        tone(c, bus, t, 640, 240, 0.14, 0.11, 'sine');
      }
    }
  }

  return {
    setFiring(isFiring, elemId) {
      const targetElem = (isFiring && !isMuted() && elemId && elemId !== 'water') ? elemId : null;
      if (targetElem === activeHoldElem) return;
      const c = targetElem ? ensureCtx() : ctx;
      if (!c) {
        activeHoldElem = null;
        return;
      }
      const loops = buildHoldLoops(c);
      const t = c.currentTime;
      if (loops) {
        for (const [k, node] of Object.entries(loops)) {
          const want = k === targetElem ? node.lvl : 0;
          node.g.gain.cancelScheduledValues(t);
          node.g.gain.setTargetAtTime(want, t, k === targetElem ? 0.025 : 0.055);
        }
      }
      if (targetElem && targetElem !== activeHoldElem) {
        playTriggerEdge(c, targetElem, true);
      } else if (!targetElem && activeHoldElem) {
        playTriggerEdge(c, activeHoldElem, false);
      }
      activeHoldElem = targetElem;
    },

    playShot(elemId, worldPos, isLocal = false) {
      if (!elemId || isMuted()) return;
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (nowMs - (lastShotAt[elemId] || 0) < 68) return;
      lastShotAt[elemId] = nowMs;

      const c = ensureCtx();
      if (!c) return;
      const sp = isLocal ? { gain: 0.92, pan: 0.07 } : spatialize(worldPos, 12.0);
      if (sp.gain < 0.03) return;
      shotCounts[elemId] = (shotCounts[elemId] || 0) + 1;
      const bus = makeBus(c, sp.gain, sp.pan, elemId === 'earth' || elemId === 'snow' ? 0.14 : 0.08);
      const t = c.currentTime + 0.004;

      if (elemId === 'water') {
        // Crisp pressurized hydro-blaster squirt + bubbly nozzle chirp
        noise(c, bus, t, 2100, 3500, 1.3, 0.095, 0.20, 'bandpass', false);
        const bf = rand(560, 720);
        tone(c, bus, t + 0.006, bf, bf * 1.65, 0.075, 0.12, 'sine');
      } else if (elemId === 'fire') {
        // Punchy Emberwick hearth fireball whoosh + snapping wood-ember crackles
        noise(c, bus, t, 540, 175, 0.85, 0.17, 0.34, 'lowpass', true);
        noise(c, bus, t, 1550, 620, 1.4, 0.12, 0.22, 'bandpass', false);
        tone(c, bus, t, 185 * rand(0.94, 1.06), 68, 0.13, 0.22, 'triangle');
        const ct = t + rand(0.018, 0.055);
        noise(c, bus, ct, rand(3200, 4600), 1700, 3.2, 0.032, 0.20, 'bandpass', false);
      } else if (elemId === 'snow') {
        // Crisp Boreal frost cannon pffft + glinting crystal bell harmonics
        noise(c, bus, t, 2400, 5400, 1.35, 0.13, 0.24, 'highpass', false);
        tone(c, bus, t, 380, 190, 0.085, 0.14, 'triangle');
        const f = 1480 * rand(0.95, 1.08);
        tone(c, bus, t + 0.008, f, f * 1.18, 0.12, 0.13, 'sine');
        tone(c, bus, t + 0.032, f * 1.5, f * 1.56, 0.095, 0.075, 'sine');
      } else if (elemId === 'earth') {
        // Chesty pneumatic stone-mortar THOOMP + rattling pebble launch
        tone(c, bus, t, 152 * rand(0.95, 1.05), 42, 0.15, 0.38, 'sine');
        tone(c, bus, t, 265, 98, 0.09, 0.24, 'triangle');
        noise(c, bus, t, 680, 240, 1.15, 0.12, 0.26, 'bandpass', true);
        noise(c, bus, t + 0.018, 1950, 880, 2.3, 0.06, 0.16, 'bandpass', false);
      } else if (elemId === 'air') {
        // Compressed-air vortex cannon SHHH-WHIP + brass turbine harmonic
        noise(c, bus, t, 460, 2150, 1.75, 0.15, 0.30, 'bandpass', true);
        noise(c, bus, t + 0.02, 2400, 780, 1.3, 0.11, 0.16, 'bandpass', false);
        tone(c, bus, t, 290, 650, 0.12, 0.14, 'sine');
        tone(c, bus, t + 0.015, 580, 960, 0.09, 0.085, 'triangle');
      }
    },

    playImpact(elemId, worldPos, isBomb = false) {
      if (isMuted()) return;
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const minGap = isBomb ? 0 : 72;
      if (!isBomb && nowMs - (lastImpactAt[elemId] || 0) < minGap) return;
      lastImpactAt[elemId] = nowMs;

      const c = ensureCtx();
      if (!c) return;
      const sp = spatialize(worldPos, isBomb ? 15 : 11);
      if (sp.gain < 0.025) return;
      impactCounts[elemId] = (impactCounts[elemId] || 0) + 1;
      const bus = makeBus(c, sp.gain * (isBomb ? 1.1 : 0.88), sp.pan, 0.12);
      const t = c.currentTime + 0.005;

      if (elemId === 'fire') {
        noise(c, bus, t, isBomb ? 780 : 580, 140, 0.8, isBomb ? 0.45 : 0.20, isBomb ? 0.34 : 0.22, 'lowpass', true);
        tone(c, bus, t, isBomb ? 130 : 190, 46, isBomb ? 0.32 : 0.14, isBomb ? 0.30 : 0.16, 'sine');
        const pops = isBomb ? 4 : 2;
        for (let i = 0; i < pops; i++) {
          const pt = t + 0.025 + i * rand(0.03, 0.065);
          noise(c, bus, pt, rand(2400, 4400), 1200, 3.4, 0.03, 0.16, 'bandpass', false);
        }
      } else if (elemId === 'snow') {
        noise(c, bus, t, 1800, 750, 1.1, isBomb ? 0.34 : 0.15, isBomb ? 0.24 : 0.16, 'bandpass', false);
        const notes = isBomb ? [1046.5, 1318.5, 1568.0, 2093.0] : [1318.5, 1760.0];
        for (let i = 0; i < notes.length; i++) {
          const f = notes[i] * rand(0.97, 1.03);
          tone(c, bus, t + i * 0.038, f, f * 1.04, isBomb ? 0.24 : 0.14, isBomb ? 0.11 : 0.08, 'sine');
        }
      } else if (elemId === 'earth') {
        tone(c, bus, t, isBomb ? 108 : 148, 38, isBomb ? 0.34 : 0.16, isBomb ? 0.34 : 0.24, 'sine');
        noise(c, bus, t, 540, 180, 0.9, isBomb ? 0.36 : 0.17, isBomb ? 0.26 : 0.18, 'lowpass', true);
        const clicks = isBomb ? 5 : 2;
        for (let i = 0; i < clicks; i++) {
          const ct = t + 0.02 + i * 0.04 + Math.random() * 0.015;
          tone(c, bus, ct, rand(380, 760), rand(190, 340), 0.04, 0.11, 'triangle');
        }
      } else if (elemId === 'air') {
        noise(c, bus, t, 420, isBomb ? 2400 : 1700, 1.5, isBomb ? 0.44 : 0.21, isBomb ? 0.30 : 0.20, 'bandpass', true);
        noise(c, bus, t + 0.025, 1900, 620, 1.2, isBomb ? 0.36 : 0.17, isBomb ? 0.18 : 0.11, 'bandpass', false);
        if (isBomb) {
          tone(c, bus, t, 220, 540, 0.28, 0.16, 'triangle');
          tone(c, bus, t + 0.05, 440, 880, 0.24, 0.11, 'sine');
        }
      } else if (elemId === 'water') {
        if (isBomb) {
          noise(c, bus, t, 1900, 480, 0.9, 0.38, 0.22, 'bandpass', false);
        }
      }
    },

    playPropBump(worldPos, strength = 0.5, isHeavy = false) {
      if (isMuted()) return;
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (nowMs - lastBumpAt < 58) return;
      lastBumpAt = nowMs;

      const c = ensureCtx();
      if (!c) return;
      const sp = spatialize(worldPos, 10.0);
      if (sp.gain < 0.03) return;
      const k = clamp(strength, 0.15, 1.0);
      const bus = makeBus(c, sp.gain * k * 0.82, sp.pan, 0.08);
      const t = c.currentTime + 0.004;
      const baseF = isHeavy ? rand(115, 165) : rand(220, 340);
      tone(c, bus, t, baseF, baseF * 0.48, isHeavy ? 0.13 : 0.085, 0.22, 'triangle');
      noise(c, bus, t, baseF * 3.2, baseF * 1.4, 2.2, 0.065, 0.14, 'bandpass', true);
    },

    playSwitch(elemId) {
      if (isMuted()) return;
      const c = ensureCtx();
      if (!c) return;
      const bus = makeBus(c, 0.85, 0, 0.1);
      const t = c.currentTime + 0.005;
      if (elemId === 'fire') {
        tone(c, bus, t, 392.0, 587.3, 0.13, 0.16, 'triangle');
        noise(c, bus, t, 900, 420, 1.4, 0.12, 0.14, 'bandpass', true);
      } else if (elemId === 'snow') {
        tone(c, bus, t, 1046.5, 1568.0, 0.16, 0.13, 'sine');
        tone(c, bus, t + 0.045, 1568.0, 2093.0, 0.16, 0.10, 'sine');
      } else if (elemId === 'earth') {
        tone(c, bus, t, 220.0, 146.8, 0.14, 0.20, 'triangle');
        tone(c, bus, t + 0.04, 329.6, 293.7, 0.12, 0.14, 'sine');
      } else if (elemId === 'air') {
        noise(c, bus, t, 520, 1760, 2.0, 0.15, 0.15, 'bandpass', true);
        tone(c, bus, t + 0.02, 523.25, 783.99, 0.15, 0.13, 'sine');
      } else {
        tone(c, bus, t, 523.25, 659.25, 0.13, 0.14, 'sine');
        tone(c, bus, t + 0.04, 659.25, 783.99, 0.14, 0.11, 'sine');
      }
    },

    stopAll() {
      this.setFiring(false, null);
    },

    getState() {
      return {
        ctxState: ctx ? ctx.state : 'none',
        sharedWithMainAudio: !!(env?.audio && ctx && typeof env.audio.getContext === 'function' && ctx === env.audio.getContext()),
        activeHoldElem,
        shotCounts: { ...shotCounts },
        impactCounts: { ...impactCounts },
      };
    },
  };
}

// ============================================================================
// Bespoke 3D Elemental Gun Attachments (1st-Person & 3rd-Person)
// ============================================================================
function buildHelixCoilMesh(THREE, mat) {
  if (THREE.Curve && THREE.TubeGeometry) {
    class CryoHelixCurve extends THREE.Curve {
      getPoint(t, optionalTarget = new THREE.Vector3()) {
        const turns = 3.5;
        const ang = t * Math.PI * 2 * turns;
        const r = 0.043;
        const z = lerp(-0.025, -0.335, t);
        return optionalTarget.set(Math.cos(ang) * r, Math.sin(ang) * r, z);
      }
    }
    const geo = new THREE.TubeGeometry(new CryoHelixCurve(), 44, 0.0068, 7, false);
    return new THREE.Mesh(geo, mat);
  }
  const fallback = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0065, 6, 16), mat);
    ring.position.set(0, 0, -0.05 - i * 0.085);
    fallback.add(ring);
  }
  return fallback;
}

export function buildFirstPersonAttachment(THREE, elemId) {
  const g = new THREE.Group();
  g.name = `elem_fp_${elemId}`;
  const anim = { elemId };
  g.userData.anim = anim;

  const std = (hex, opts = {}) => (THREE.MeshStandardMaterial
    ? new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.48, metalness: 0.22 }, opts))
    : new THREE.MeshLambertMaterial({ color: hex }));
  const basic = (hex, opts = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: hex }, opts));

  if (elemId === 'water') {
    // Sight-glass hydro gauge ring + aqua level bead + polished brass nozzle collar
    const brassMat = std(0xd8a648, { roughness: 0.34, metalness: 0.62 });
    const glassMat = basic(0x7be6ff, { transparent: true, opacity: 0.68 });
    const bubbleMat = basic(0xffffff);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.043, 0.055, 14), brassMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0, -0.358);
    g.add(collar);

    const muzzleLip = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0075, 8, 18), brassMat);
    muzzleLip.position.set(0, 0, -0.382);
    g.add(muzzleLip);

    // Side-top sight-glass hydro pressure gauge
    const gaugeGroup = new THREE.Group();
    gaugeGroup.position.set(-0.088, 0.052, 0.03);
    gaugeGroup.rotation.y = 0.32;
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.006, 8, 20), brassMat);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.031, 18), glassMat);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), bubbleMat);
    bubble.position.set(0.006, 0.006, 0.004);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.04, 8), brassMat);
    stem.rotation.z = -0.9;
    stem.position.set(0.028, -0.022, 0);
    gaugeGroup.add(bezel, dial, bubble, stem);
    g.add(gaugeGroup);

    const sightFin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.022, 0.05), brassMat);
    sightFin.position.set(0, 0.038, -0.33);
    g.add(sightFin);

    anim.hydroBubble = bubble;
  } else if (elemId === 'fire') {
    // Forged dark-iron hearth cage around tank + glowing Emberwick molten core +
    // twin angled copper exhaust stacks + flickering 3D pilot flame tongue at muzzle (z = -0.39)
    const ironMat = std(0x231b19, { roughness: 0.62, metalness: 0.68 });
    const copperMat = std(0xc96934, { roughness: 0.36, metalness: 0.64 });
    const coreOuterMat = basic(0xff6b1a, { transparent: true, opacity: 0.88 });
    const coreInnerMat = basic(0xfff1a8);
    const eyeWhiteMat = basic(0xfffbe8);
    const pupilMat = basic(0x241008);
    const flameOuterMat = basic(0xff5e14, { transparent: true, opacity: 0.9 });
    const flameInnerMat = basic(0xffe98a);

    // Hearth iron cage bands wrapping tank (0, -0.02, 0.08)
    const cageGrp = new THREE.Group();
    cageGrp.position.set(0, -0.02, 0.08);
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.117, 0.0095, 7, 22), ironMat);
      if (i === 0) band.rotation.y = 0;
      if (i === 1) band.rotation.y = Math.PI / 2;
      if (i === 2) band.rotation.x = Math.PI / 2;
      cageGrp.add(band);
    }

    // Glowing Emberwick molten core visible above/front-left of hearth grate
    const emberwickGrp = new THREE.Group();
    emberwickGrp.position.set(-0.045, 0.082, -0.01);
    const cOuter = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), coreOuterMat);
    const cInner = new THREE.Mesh(new THREE.SphereGeometry(0.031, 10, 8), coreInnerMat);
    // A plain glowing ember with a small licking flame tip — no face.
    const flameTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 7), flameInnerMat);
    flameTip.position.set(0, 0.046, 0);
    emberwickGrp.add(cOuter, cInner, flameTip);
    cageGrp.add(emberwickGrp);
    g.add(cageGrp);

    // Twin angled copper exhaust stacks
    for (const sx of [-1, 1]) {
      const stackGrp = new THREE.Group();
      stackGrp.position.set(sx * 0.044, 0.025, -0.09);
      stackGrp.rotation.z = -sx * 0.48;
      stackGrp.rotation.x = -0.16;
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.105, 10), copperMat);
      pipe.position.y = 0.05;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0165, 0.004, 6, 12), ironMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.102;
      const emberMouth = new THREE.Mesh(new THREE.CircleGeometry(0.013, 10), coreOuterMat);
      emberMouth.rotation.x = -Math.PI / 2;
      emberMouth.position.y = 0.101;
      stackGrp.add(pipe, rim, emberMouth);
      g.add(stackGrp);
    }

    // Cast-iron muzzle grate + flickering 3D pilot flame tongue at z = -0.39
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.037, 0.075, 8), ironMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0, -0.352);
    g.add(shroud);

    const pilotGrp = new THREE.Group();
    pilotGrp.position.set(0, 0.006, -0.39);
    const fOut = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.078, 8), flameOuterMat);
    fOut.rotation.x = -Math.PI / 2 + 0.35;
    fOut.position.set(0, 0.012, -0.026);
    const fIn = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.052, 7), flameInnerMat);
    fIn.rotation.x = -Math.PI / 2 + 0.35;
    fIn.position.set(0, 0.01, -0.02);
    pilotGrp.add(fOut, fIn);
    g.add(pilotGrp);

    anim.emberwickGrp = emberwickGrp;
    anim.pilotGrp = pilotGrp;
  } else if (elemId === 'snow') {
    // Frosted silver cryo-coils spiraling around barrel + translucent pale-cyan
    // hexagonal ice-crystal prism core + 6-point snowflake frost guard at muzzle
    const silverMat = std(0xe5f0fa, { roughness: 0.26, metalness: 0.72 });
    const crystalMat = std(0x8be4ff, {
      roughness: 0.14,
      metalness: 0.1,
      transparent: true,
      opacity: 0.84,
      emissive: 0x2ca8e0,
      emissiveIntensity: 0.45,
    });
    const innerIceMat = basic(0xe8fbff);

    const coil = buildHelixCoilMesh(THREE, silverMat);
    g.add(coil);

    // Double-terminated hexagonal ice-crystal prism core above chamber
    const prismGrp = new THREE.Group();
    prismGrp.position.set(0, 0.078, -0.03);
    prismGrp.rotation.x = Math.PI / 2 - 0.22;
    const hexBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.11, 6), crystalMat);
    const hexTipF = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.046, 6), crystalMat);
    hexTipF.position.y = 0.078;
    const hexTipB = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.046, 6), crystalMat);
    hexTipB.rotation.x = Math.PI;
    hexTipB.position.y = -0.078;
    const coreGlow = new THREE.Mesh(new THREE.OctahedronGeometry(0.021, 0), innerIceMat);
    prismGrp.add(hexBody, hexTipF, hexTipB, coreGlow);
    g.add(prismGrp);

    // 6-spoke 3D snowflake frost guard at muzzle
    const flakeGrp = new THREE.Group();
    flakeGrp.position.set(0, 0, -0.374);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.018, 6), silverMat);
    hub.rotation.x = Math.PI / 2;
    flakeGrp.add(hub);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.132, 0.012), crystalMat);
      spoke.rotation.z = (i * Math.PI) / 3;
      flakeGrp.add(spoke);
    }
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), innerIceMat);
      tip.position.set(Math.cos(ang) * 0.058, Math.sin(ang) * 0.058, -0.004);
      flakeGrp.add(tip);
    }
    g.add(flakeGrp);

    anim.prismGrp = prismGrp;
    anim.flakeGrp = flakeGrp;
  } else if (elemId === 'earth') {
    // Moss-wrapped ancient stone mortar sleeve + hovering/rotating glowing amber
    // geode crystal above chamber + chiseled basalt crown muzzle
    const stoneMat = std(0x6d5f52, { roughness: 0.88, metalness: 0.06, flatShading: true });
    const basaltMat = std(0x473e37, { roughness: 0.84, metalness: 0.12, flatShading: true });
    const mossMat = std(0x5b9c43, { roughness: 0.9, metalness: 0.0, flatShading: true });
    const amberMat = std(0xffb133, {
      roughness: 0.22,
      metalness: 0.15,
      emissive: 0xe87c10,
      emissiveIntensity: 0.65,
      flatShading: true,
    });
    const amberCoreMat = basic(0xffe89c);

    // Chiseled 7-sided stone mortar barrel sleeve
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.051, 0.29, 7), stoneMat);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, 0, -0.19);
    g.add(sleeve);

    // Lush 3D woodland moss tufts & vine band wrapping the stone sleeve
    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.009, 6, 14), mossMat);
    vine.position.set(0, 0.002, -0.15);
    vine.rotation.y = 0.28;
    g.add(vine);
    const mossOffsets = [
      [-0.036, 0.032, -0.11, 0.022],
      [0.034, 0.028, -0.21, 0.02],
      [-0.028, -0.032, -0.25, 0.018],
      [0.015, 0.042, -0.28, 0.017],
    ];
    for (const [mx, my, mz, mr] of mossOffsets) {
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(mr, 0), mossMat);
      tuft.position.set(mx, my, mz);
      tuft.scale.set(1.2, 0.75, 1.1);
      g.add(tuft);
    }

    // Hovering / rotating glowing amber geode crystal + satellite pebble
    const geodeGrp = new THREE.Group();
    geodeGrp.position.set(0, 0.095, -0.03);
    const geode = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), amberMat);
    geode.scale.set(0.86, 1.32, 0.86);
    const geodeInner = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0), amberCoreMat);
    const satRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.013, 0), basaltMat);
    satRock.position.set(0.054, 0, 0);
    geodeGrp.add(geode, geodeInner, satRock);
    g.add(geodeGrp);

    // Chiseled basalt crown muzzle
    const crownGrp = new THREE.Group();
    crownGrp.position.set(0, 0, -0.365);
    const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.044, 0.042, 6), basaltMat);
    crownRing.rotation.x = Math.PI / 2;
    crownGrp.add(crownRing);
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3 + 0.25;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.038, 4), basaltMat);
      tooth.rotation.x = -Math.PI / 2;
      tooth.rotation.z = ang;
      tooth.position.set(Math.cos(ang) * 0.043, Math.sin(ang) * 0.043, -0.024);
      crownGrp.add(tooth);
    }
    g.add(crownGrp);

    anim.geodeGrp = geodeGrp;
    anim.geodeBaseY = 0.095;
  } else if (elemId === 'air') {
    // Brass sky-pirate wind cowling + continuously spinning 6-blade 3D turbine rotor +
    // twin translucent cyan-mint aero rings around barrel
    const brassMat = std(0xd8a94e, {
      roughness: 0.3,
      metalness: 0.68,
      side: THREE.DoubleSide,
    });
    const ivoryMat = std(0xf5eedb, { roughness: 0.42, metalness: 0.18 });
    const aeroMat = basic(0x9ef0dc, {
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });

    // Open flared sky-pirate wind intake cowling
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.064, 0.105, 18, 1, true), brassMat);
    cowl.rotation.x = Math.PI / 2;
    cowl.position.set(0, 0, -0.145);
    g.add(cowl);

    const cowlRimF = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.0055, 7, 20), brassMat);
    cowlRimF.position.set(0, 0, -0.197);
    g.add(cowlRimF);
    const cowlRimB = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.005, 7, 20), brassMat);
    cowlRimB.position.set(0, 0, -0.093);
    g.add(cowlRimB);

    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.036, 0.014), brassMat);
      strut.position.set(Math.cos(ang) * 0.048, Math.sin(ang) * 0.048, -0.145);
      strut.rotation.z = ang - Math.PI / 2;
      g.add(strut);
    }

    // Continuously spinning 6-blade 3D turbine rotor
    const rotorGrp = new THREE.Group();
    rotorGrp.position.set(0, 0, -0.162);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.042, 12), brassMat);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.z = -0.015;
    rotorGrp.add(spinner);

    for (let i = 0; i < 6; i++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = (i * Math.PI) / 3;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.046, 0.0045), ivoryMat);
      blade.position.y = 0.046;
      blade.rotation.y = 0.56; // 32-deg aero pitch
      bladePivot.add(blade);
      rotorGrp.add(bladePivot);
    }
    g.add(rotorGrp);

    // Twin translucent cyan-mint aero rings around forward barrel
    const aeroRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0055, 8, 22), aeroMat);
    aeroRing1.position.set(0, 0, -0.255);
    const aeroRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.005, 8, 22), aeroMat);
    aeroRing2.position.set(0, 0, -0.342);
    g.add(aeroRing1, aeroRing2);

    anim.rotorGrp = rotorGrp;
    anim.aeroRing1 = aeroRing1;
    anim.aeroRing2 = aeroRing2;
  }

  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.userData.noSolid = true;
    }
  });
  return g;
}

export function buildThirdPersonAttachment(THREE, elemId) {
  const g = new THREE.Group();
  g.name = `elem_3p_${elemId}`;
  const anim = { elemId };
  g.userData.anim = anim;

  const std = (hex, opts = {}) => (THREE.MeshStandardMaterial
    ? new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.45, metalness: 0.25 }, opts))
    : new THREE.MeshLambertMaterial({ color: hex }));
  const basic = (hex, opts = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: hex }, opts));

  // Note: 3rd-person Seeker nozzle points +Z in local space!
  if (elemId === 'water') {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 7, 14), std(0xd8a648, { metalness: 0.6 }));
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), basic(0x55d6ff));
    gem.position.set(0, 0.038, -0.03);
    g.add(collar, gem);
  } else if (elemId === 'fire') {
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.065, 8), std(0x281d1a, { metalness: 0.65 }));
    shroud.rotation.x = Math.PI / 2;
    shroud.position.z = -0.02;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 7), basic(0xff7722));
    core.position.set(0, 0.048, -0.06);
    const pilot = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.07, 7), basic(0xffd25a));
    pilot.rotation.x = Math.PI / 2;
    pilot.position.set(0, 0.01, 0.038);
    g.add(shroud, core, pilot);
    anim.pilotGrp = pilot;
    anim.emberwickGrp = core;
  } else if (elemId === 'snow') {
    const flakeGrp = new THREE.Group();
    const crystalMat = basic(0x8be4ff);
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.11, 0.01), crystalMat);
      bar.rotation.z = (i * Math.PI) / 3;
      flakeGrp.add(bar);
    }
    const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), basic(0xdff8ff));
    prism.position.set(0, 0.052, -0.055);
    g.add(flakeGrp, prism);
    anim.flakeGrp = flakeGrp;
    anim.prismGrp = prism;
  } else if (elemId === 'earth') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.05, 6), std(0x5b4d41, { flatShading: true }));
    crown.rotation.x = Math.PI / 2;
    const geode = new THREE.Mesh(new THREE.OctahedronGeometry(0.034, 0), basic(0xffb83d));
    geode.position.set(0, 0.062, -0.045);
    g.add(crown, geode);
    anim.geodeGrp = geode;
    anim.geodeBaseY = 0.062;
  } else if (elemId === 'air') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.006, 6, 16), basic(0x9ef0dc, { transparent: true, opacity: 0.82 }));
    const rotorGrp = new THREE.Group();
    rotorGrp.position.z = -0.025;
    const bladeMat = std(0xf2ead6);
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.048, 0.004), bladeMat);
      const piv = new THREE.Group();
      piv.rotation.z = (i * Math.PI) / 3;
      b.position.y = 0.034;
      b.rotation.y = 0.5;
      piv.add(b);
      rotorGrp.add(piv);
    }
    g.add(ring, rotorGrp);
    anim.rotorGrp = rotorGrp;
    anim.aeroRing1 = ring;
  }

  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.userData.noSolid = true;
    }
  });
  return g;
}

// ============================================================================
// Custom GLSL Shader Sources (Shared Programs for Low Draw Calls & 60 FPS)
// ============================================================================
const FIRE_FLAME_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  uniform float uSmolder;
  varying vec2 vUv;
  varying float vHeight;
  void main() {
    vUv = uv;
    vHeight = uv.y;
    vec3 p = position;
    float h2 = uv.y * uv.y;
    float gust = sin(uTime * 6.8 + uSeed * 4.3 + uv.y * 5.2) * 0.11
               + cos(uTime * 11.3 + uSeed * 2.1 + p.x * 4.0) * 0.05;
    float pinch = mix(1.0, 0.36, uv.y * (0.55 + 0.35 * uSmolder));
    p.x = p.x * pinch + gust * h2 * (0.65 + 0.35 * uIntensity);
    p.z = p.z * pinch + cos(uTime * 5.9 + uSeed + uv.y * 4.7) * 0.08 * h2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FIRE_FLAME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uSmolder;
  varying vec2 vUv;
  varying float vHeight;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    v += 0.55 * vnoise(p);
    v += 0.30 * vnoise(p * 2.13 + vec2(3.1, 1.7));
    v += 0.15 * vnoise(p * 4.27 + vec2(7.4, 5.2));
    return v;
  }

  void main() {
    float x = (vUv.x - 0.5) * 2.0;
    float y = clamp(vHeight, 0.0, 1.0);
    vec2 q = vec2(x * 2.1 + uSeed, y * 3.2 - uTime * 3.6);
    float n = fbm(q);
    float n2 = vnoise(vec2(x * 4.5 - uSeed, y * 6.0 - uTime * 5.8));
    float turb = n * 0.72 + n2 * 0.28;

    float widthEnv = mix(0.92, 0.08, pow(y, 0.85));
    float body = 1.0 - abs(x) / max(0.08, widthEnv);
    float flame = body + (turb - 0.46) * (0.45 + 0.85 * y) - y * (0.28 + 0.42 * uSmolder);
    float baseSoft = smoothstep(0.0, 0.12, y);
    float alpha = smoothstep(0.02, 0.34, flame) * baseSoft * uOpacity;
    if (alpha < 0.015) discard;

    // Realistic blackbody temperature ramp (HDR core -> Emberwick orange -> crimson tip)
    float coreMask = smoothstep(0.36, 0.78, flame) * (1.0 - y * 0.65) * (1.0 - uSmolder * 0.75);
    float midMask = smoothstep(0.14, 0.52, flame);
    vec3 crimson = vec3(0.84, 0.13, 0.02);
    vec3 orange = vec3(1.18, 0.52, 0.07);
    vec3 whiteGold = vec3(1.52, 1.34, 0.78);
    vec3 col = mix(crimson, orange, midMask);
    col = mix(col, whiteGold, coreMask);
    col = mix(col, vec3(0.95, 0.22, 0.03), uSmolder * 0.65);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.96));
  }
`;

const FIRE_SCORCH_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FIRE_SCORCH_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uEmberGlow;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.17, 512.83));
    p += dot(p, p + 33.7);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float n = vnoise(p * 3.6 + uSeed) * 0.65 + vnoise(p * 7.8 - uSeed) * 0.35;
    float edge = 1.0 - smoothstep(0.45, 0.96, r + (n - 0.5) * 0.36);
    if (edge * uOpacity < 0.015) discard;

    // Ridge-noise glowing molten ember cracks inside charred soot
    float c1 = abs(vnoise(p * 6.4 + vec2(uSeed, -uSeed)) - 0.5);
    float c2 = abs(vnoise(p * 11.5 - vec2(uSeed * 1.7, uSeed)) - 0.5);
    float crack = smoothstep(0.095, 0.012, c1 * 0.72 + c2 * 0.38);
    float pulse = 0.72 + 0.28 * sin(uTime * 5.2 + n * 6.28 + uSeed);
    float hotCenter = (1.0 - smoothstep(0.0, 0.72, r)) * uEmberGlow * pulse;

    vec3 charCol = mix(vec3(0.06, 0.045, 0.04), vec3(0.16, 0.095, 0.06), smoothstep(0.3, 0.85, r));
    vec3 emberCol = mix(vec3(1.05, 0.32, 0.05), vec3(1.42, 0.92, 0.32), crack * 0.65);
    vec3 col = mix(charCol, emberCol, clamp(crack * hotCenter * 1.25 + hotCenter * 0.22, 0.0, 1.0));
    float alpha = edge * mix(0.88, 0.96, crack * hotCenter) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

const WATER_PUDDLE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WATER_PUDDLE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uEvap;
  uniform float uRippleBoost;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float ang = atan(p.y, p.x);
    float lobe = sin(ang * 3.0 + uSeed) * 0.075
               + cos(ang * 5.0 - uSeed * 1.7) * 0.048
               + sin(ang * 2.0 + uSeed * 0.6) * 0.055;
    float dist = length(p) - lobe;
    float maxR = mix(0.90, 0.34, uEvap);
    if (dist > maxR + 0.06) discard;

    // Darkened wet-cobble / wet-earth border ring around puddle perimeter
    float wetRim = smoothstep(maxR + 0.055, maxR - 0.045, dist) * smoothstep(maxR - 0.16, maxR - 0.03, dist);
    float waterBody = smoothstep(maxR - 0.01, maxR - 0.10, dist);

    // Dual-sine ripple shimmer + reinforcement concentric wave
    float w1 = sin(vWorldPos.x * 9.5 + uTime * 2.9 + sin(vWorldPos.z * 7.2) * 0.8);
    float w2 = cos(vWorldPos.z * 11.2 - uTime * 2.3 + vWorldPos.x * 4.5);
    float ringWave = sin(dist * 24.0 - uTime * 7.5) * uRippleBoost * (1.0 - dist);
    vec3 rippleN = normalize(vWorldNormal + vec3((w1 + ringWave) * 0.065, 0.0, (w2 + ringWave) * 0.065));

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - clamp(dot(rippleN, viewDir), 0.0, 1.0), 2.8);
    vec3 sunDir = normalize(vec3(0.55, 0.82, 0.38));
    vec3 halfV = normalize(sunDir + viewDir);
    float spec = pow(clamp(dot(rippleN, halfV), 0.0, 1.0), 42.0);

    vec3 deepTint = vec3(0.14, 0.44, 0.62);
    vec3 skyReflect = vec3(0.72, 0.91, 1.02);
    vec3 waterCol = mix(deepTint, skyReflect, clamp(0.28 + fresnel * 0.82, 0.0, 1.0));
    waterCol += vec3(1.22, 1.20, 1.12) * spec * 0.72;
    waterCol += vec3(0.22, 0.40, 0.50) * (w1 * w2 * 0.08);

    vec3 rimCol = vec3(0.09, 0.13, 0.15);
    vec3 finalCol = mix(rimCol, waterCol, waterBody);
    float alpha = clamp(wetRim * 0.46 + waterBody * mix(0.62, 0.86, fresnel + spec * 0.5), 0.0, 0.92) * uOpacity;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(finalCol, alpha);
  }
`;

const WATER_STREAK_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vec2 p = vUv - 0.5;
    // Elongated vertical trickle streaks running down local -Y
    float stream1 = exp(-pow((p.x + sin(vUv.y * 9.0 + uSeed) * 0.06) * 6.5, 2.0));
    float stream2 = exp(-pow((p.x - 0.16 + cos(vUv.y * 11.0 - uSeed) * 0.04) * 9.5, 2.0)) * step(0.18, 1.0 - vUv.y);
    float stream3 = exp(-pow((p.x + 0.15 + sin(vUv.y * 8.0 + uSeed * 2.0) * 0.04) * 9.5, 2.0)) * step(0.25, 1.0 - vUv.y);
    float vMask = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
    float mask = clamp((stream1 + stream2 * 0.75 + stream3 * 0.7) * vMask, 0.0, 1.0);
    if (mask * uOpacity < 0.015) discard;

    float bead = pow(0.5 + 0.5 * sin(vUv.y * 22.0 + uTime * 5.2 + uSeed * 4.0), 6.0);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - clamp(dot(normalize(vWorldNormal), viewDir), 0.0, 1.0), 2.4);
    vec3 wetWall = vec3(0.12, 0.22, 0.29);
    vec3 glint = vec3(0.76, 0.93, 1.05);
    vec3 col = mix(wetWall, glint, clamp(fres * 0.55 + bead * 0.45, 0.0, 1.0));
    gl_FragColor = vec4(col, mask * 0.68 * uOpacity);
  }
`;

const SNOW_SPARKLE_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPos;
  void main() {
    vLocalPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SNOW_SPARKLE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uMelt;
  uniform float uOpacity;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalPos;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 sunDir = normalize(vec3(0.52, 0.84, 0.36));
    float ndl = clamp(dot(N, sunDir) * 0.5 + 0.5, 0.0, 1.0);

    // Warm sunlit winter-cream top -> cool Storybook glacier-blue crevices
    vec3 shadowCol = mix(vec3(0.54, 0.75, 0.92), vec3(0.45, 0.68, 0.86), uMelt);
    vec3 litCol = mix(vec3(0.95, 0.98, 1.0), vec3(0.84, 0.92, 0.97), uMelt * 0.55);
    vec3 col = mix(shadowCol, litCol, smoothstep(0.22, 0.85, ndl));

    // Camera-view-dependent diamond micro-sparkles
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 cell = floor(vWorldPos * 36.0);
    vec3 sparkleDir = normalize(vec3(
      hash31(cell) * 2.0 - 1.0,
      hash31(cell + 17.3) * 2.0 - 1.0,
      hash31(cell + 41.7) * 2.0 - 1.0
    ));
    float glint = max(0.0, dot(sparkleDir, normalize(viewDir + sunDir * 0.55)));
    float twinkle = smoothstep(0.968, 0.999, glint) * (0.65 + 0.35 * sin(uTime * 4.5 + hash31(cell) * 20.0));
    col += vec3(0.65, 0.82, 1.05) * twinkle * (1.0 - uMelt * 0.5);

    // Wet-melt specular sheen during 22s -> 30s
    float wetSpec = pow(max(0.0, dot(N, normalize(sunDir + viewDir))), 26.0) * uMelt * 0.35;
    col += vec3(wetSpec);

    gl_FragColor = vec4(col, uOpacity);
  }
`;

const EARTH_CRACK_FRAG = /* glsl */ `
  uniform float uSeed;
  uniform float uOpacity;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(171.3, 391.7));
    p += dot(p, p + 29.4);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 0.98) discard;
    float ang = atan(p.y, p.x);
    float n = vnoise(p * 4.5 + uSeed);
    float soilMask = (1.0 - smoothstep(0.52, 0.96, r + (n - 0.5) * 0.22));
    float fissure = smoothstep(0.085, 0.015, abs(sin(ang * 4.5 + n * 2.6 + uSeed))) * smoothstep(0.92, 0.2, r);
    vec3 soil = mix(vec3(0.32, 0.22, 0.13), vec3(0.45, 0.33, 0.20), n);
    vec3 crackCol = vec3(0.11, 0.075, 0.045);
    vec3 col = mix(soil, crackCol, fissure * 0.85);
    float alpha = clamp(soilMask * 0.84 + fissure * 0.55, 0.0, 0.92) * uOpacity;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const AIR_VORTEX_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float swayX = sin(uTime * 3.8 + uSeed + uv.y * 4.2) * 0.09 * uv.y;
    float swayZ = cos(uTime * 3.3 + uSeed * 1.4 + uv.y * 4.2) * 0.09 * uv.y;
    p.x += swayX;
    p.z += swayZ;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const AIR_VORTEX_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float spiral1 = sin(vUv.x * 12.56637 + vUv.y * 10.5 - uTime * 8.5 + uSeed);
    float spiral2 = sin(vUv.x * 6.28318 - vUv.y * 7.5 - uTime * 5.8 - uSeed);
    float band1 = smoothstep(0.52, 0.96, spiral1);
    float band2 = smoothstep(0.65, 0.98, spiral2) * 0.65;
    float vFade = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
    float alpha = (band1 * 0.52 + band2 * 0.38) * vFade * uOpacity;
    if (alpha < 0.012) discard;
    vec3 col = mix(vec3(0.64, 0.96, 0.88), vec3(0.96, 1.0, 0.99), band1);
    gl_FragColor = vec4(col, alpha);
  }
`;

const PARTICLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aKind;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vKind;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(0.25, -mv.z), 1.0, 96.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vKind;
  void main() {
    if (vAlpha < 0.01) discard;
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;

    float a = 0.0;
    vec3 col = vColor;
    if (vKind < 0.5) {
      // Soft smoke / dust / mist puff
      a = pow(1.0 - r, 1.75) * vAlpha;
    } else if (vKind < 1.5) {
      // Glowing HDR fire ember
      float core = smoothstep(0.65, 0.0, r);
      a = smoothstep(1.0, 0.15, r) * vAlpha;
      col = mix(vColor, vec3(1.5, 1.35, 0.75), core * 0.7);
    } else if (vKind < 2.5) {
      // Crisp 6-spoke winter snowflake crystal
      float ang = atan(p.y, p.x);
      float spoke = smoothstep(0.35, 0.95, cos(ang * 6.0));
      float shape = max(smoothstep(0.55, 0.0, r), spoke * smoothstep(1.0, 0.25, r));
      a = shape * vAlpha;
    } else {
      // Glossy falling water droplet bead
      float drop = smoothstep(0.95, 0.2, r);
      float hi = smoothstep(0.38, 0.05, length(p - vec2(-0.22, -0.24)));
      a = drop * vAlpha;
      col = mix(vColor, vec3(1.1, 1.15, 1.2), hi * 0.75);
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`;

// ============================================================================
// Main Factory: createElementalGunsManager(env)
// ============================================================================
export function createElementalGunsManager(env = {}) {
  const THREE = env.THREE;
  const scene = env.scene;
  const elemAudio = createElementalAudio(env);

  // Reusable scratch math objects (ZERO per-frame allocations!)
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _zAxis = new THREE.Vector3(0, 0, 1);
  const _q1 = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _m4 = new THREE.Matrix4();
  const _sc = new THREE.Vector3();
  const _euler = new THREE.Euler();

  // State: Selected, Unlocked & Trial Elements
  let selectedElement = 'water';
  let customUnlockedList = null; // null => auto-resolve from env/progression or all 5
  let customTrialElement = null;
  const thirdPersonSeekers = new Set();

  // HUD DOM elements
  let uiMounted = false;
  let pillEl = null;
  let pillIconEl = null;
  let pillNameEl = null;
  let pillTrialEl = null;
  let pillPopTO = 0;
  let keyListenerBound = false;

  // --------------------------------------------------------------------------
  // Quality Tier Helper
  // --------------------------------------------------------------------------
  function getQualityTier() {
    if (typeof env.getQualityTier === 'function') {
      return env.getQualityTier() || 'high';
    }
    if (env.mobilePerf && typeof env.mobilePerf.getTier === 'function') {
      return env.mobilePerf.getTier() || 'high';
    }
    return 'high';
  }

  function getMaxPatches() {
    const tier = getQualityTier();
    if (tier === 'low') return 52;
    if (tier === 'medium') return 68;
    return 85;
  }

  // --------------------------------------------------------------------------
  // Element Availability & Progression / Trial Integration
  // --------------------------------------------------------------------------
  function resolveTrialElement() {
    if (customTrialElement && ELEMENTAL_GUN_SPECS[customTrialElement]) return customTrialElement;
    if (typeof env.getTrialElement === 'function') {
      const t = env.getTrialElement();
      if (t && ELEMENTAL_GUN_SPECS[t]) return t;
    }
    const prog = env.progression || (typeof env.getProgression === 'function' ? env.getProgression() : null);
    if (prog) {
      for (const fn of ['getTrialElement', 'getTrialElementalGun', 'getActiveTrial']) {
        if (typeof prog[fn] === 'function') {
          const res = prog[fn]();
          const id = typeof res === 'string' ? res : res?.elemId || res?.id;
          if (id && ELEMENTAL_GUN_SPECS[id]) return id;
        }
      }
      const prof = typeof prog.getProfile === 'function' ? prog.getProfile() : null;
      const pTrial = prof?.trialElement || prof?.trial?.elemId || prof?.trial?.elemental;
      if (pTrial && ELEMENTAL_GUN_SPECS[pTrial]) return pTrial;
    }
    return null;
  }

  function getAvailableElements() {
    let rawList = null;
    if (typeof env.getAvailableElements === 'function') {
      rawList = env.getAvailableElements();
    } else if (typeof env.getUnlockedElements === 'function') {
      rawList = env.getUnlockedElements();
    } else if (Array.isArray(customUnlockedList)) {
      rawList = customUnlockedList;
    } else {
      const prog = env.progression || (typeof env.getProgression === 'function' ? env.getProgression() : null);
      if (prog) {
        if (typeof prog.getUnlockedElemGuns === 'function') rawList = prog.getUnlockedElemGuns();
        else if (typeof prog.getAvailableElementalGuns === 'function') rawList = prog.getAvailableElementalGuns();
        else if (typeof prog.getAvailableElements === 'function') rawList = prog.getAvailableElements();
        else if (typeof prog.getUnlockedElementalGuns === 'function') rawList = prog.getUnlockedElementalGuns();
        else if (typeof prog.getUnlockedElements === 'function') rawList = prog.getUnlockedElements();
        else if (typeof prog.isElementUnlocked === 'function') {
          rawList = ELEMENTAL_GUN_IDS.filter((id) => id === 'water' || prog.isElementUnlocked(id));
        } else if (typeof prog.getProfile === 'function') {
          const prof = prog.getProfile();
          const u = prof?.unlocked;
          const arr = u?.elemGun || u?.elemental || u?.elementalGun || u?.elemental_gun || u?.elements || u?.guns;
          if (Array.isArray(arr)) rawList = arr;
        }
      }
    }

    const base = Array.isArray(rawList) ? rawList : ELEMENTAL_GUN_IDS;
    const set = new Set(['water']);
    for (const id of base) {
      if (ELEMENTAL_GUN_SPECS[id]) set.add(id);
    }
    const trial = resolveTrialElement();
    if (trial && ELEMENTAL_GUN_SPECS[trial]) set.add(trial);
    return ELEMENTAL_GUN_IDS.filter((id) => set.has(id));
  }

  function setUnlockedElements(list) {
    if (!Array.isArray(list)) {
      customUnlockedList = null;
      return getAvailableElements();
    }
    customUnlockedList = ['water', ...list.filter((id) => ELEMENTAL_GUN_SPECS[id] && id !== 'water')];
    const avail = getAvailableElements();
    if (!avail.includes(selectedElement)) {
      selectElement('water', { silent: true });
    } else {
      syncHudPill();
    }
    return avail;
  }

  function unlockElement(elemId) {
    if (!ELEMENTAL_GUN_SPECS[elemId]) return false;
    if (!Array.isArray(customUnlockedList)) {
      customUnlockedList = getAvailableElements().slice();
    }
    if (!customUnlockedList.includes(elemId)) customUnlockedList.push(elemId);
    syncHudPill();
    return true;
  }

  function setTrialElement(elemId) {
    customTrialElement = elemId && ELEMENTAL_GUN_SPECS[elemId] ? elemId : null;
    syncHudPill();
    return customTrialElement;
  }

  function isElementTrialOnly(elemId) {
    if (!elemId || elemId === 'water') return false;
    const trial = resolveTrialElement();
    if (!trial || trial !== elemId) return false;
    if (Array.isArray(customUnlockedList)) return !customUnlockedList.includes(elemId);
    if (typeof env.getUnlockedElements === 'function') {
      const u = env.getUnlockedElements();
      if (Array.isArray(u)) return !u.includes(elemId);
    }
    const prog = env.progression || (typeof env.getProgression === 'function' ? env.getProgression() : null);
    if (prog) {
      if (typeof prog.isElementUnlocked === 'function') return !prog.isElementUnlocked(elemId);
      if (typeof prog.getUnlockedElementalGuns === 'function') {
        const u = prog.getUnlockedElementalGuns();
        if (Array.isArray(u)) return !u.includes(elemId);
      }
      if (typeof prog.getUnlockedElements === 'function') {
        const u = prog.getUnlockedElements();
        if (Array.isArray(u)) return !u.includes(elemId);
      }
      const prof = typeof prog.getProfile === 'function' ? prog.getProfile() : null;
      const arr = prof?.unlocked?.elemental || prof?.unlocked?.elementalGun || prof?.unlocked?.elements;
      if (Array.isArray(arr)) return !arr.includes(elemId);
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 1st-Person & 3rd-Person Elemental Gun Attachment Switching
  // --------------------------------------------------------------------------
  function disposeTreeGeosAndMats(rootObj) {
    if (!rootObj) return;
    rootObj.traverse((m) => {
      if (m.isMesh) {
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
          else m.material.dispose();
        }
      }
    });
  }

  function setFirstPersonElement(elemId) {
    const validId = ELEMENTAL_GUN_SPECS[elemId] ? elemId : 'water';
    const spec = ELEMENTAL_GUN_SPECS[validId];
    const gun = env.gun;
    const gunMats = env.gunMats;

    if (gun) {
      if (!gun.userData) gun.userData = {};
      if (gun.userData._elemRig) {
        const prev = gun.userData._elemRig;
        gun.remove(prev);
        disposeTreeGeosAndMats(prev);
        gun.userData._elemRig = null;
      }
      const rig = buildFirstPersonAttachment(THREE, validId);
      gun.add(rig);
      gun.userData._elemRig = rig;
      gun.userData.elemId = validId;
    }

    if (gunMats && gunMats.tank && gunMats.barrel && gunMats.grip) {
      if (validId === 'water') {
        if (typeof env.onRestoreWaterBlasterColors === 'function') {
          env.onRestoreWaterBlasterColors();
        } else if (env.progression && typeof env.progression.applyBlasterSkin === 'function') {
          env.progression.applyBlasterSkin(gunMats);
        }
      } else if (spec.gunColors) {
        gunMats.tank.color.setHex(spec.gunColors.tank);
        gunMats.barrel.color.setHex(spec.gunColors.barrel);
        gunMats.grip.color.setHex(spec.gunColors.grip);
      }
    }
    return spec;
  }

  function attachThirdPersonElement(seekerChar, elemId) {
    if (!seekerChar) return null;
    const validId = ELEMENTAL_GUN_SPECS[elemId] ? elemId : 'water';
    if (!seekerChar.userData) seekerChar.userData = {};
    const u = seekerChar.userData;

    if (u._elem3pRig) {
      if (u._elem3pRig.parent) u._elem3pRig.parent.remove(u._elem3pRig);
      disposeTreeGeosAndMats(u._elem3pRig);
      u._elem3pRig = null;
    }

    u.elemId = validId;
    const rig = buildThirdPersonAttachment(THREE, validId);
    const mountTarget = u.nozzle || u.rig?.weapon || seekerChar;
    if (mountTarget === u.nozzle) {
      rig.position.set(0, 0, 0);
    } else if (mountTarget === u.rig?.weapon) {
      rig.position.set(0, 0.072, 0.45);
    } else {
      rig.position.set(0.21, 0.92, 0.38);
    }
    mountTarget.add(rig);
    u._elem3pRig = rig;
    thirdPersonSeekers.add(seekerChar);
    return rig;
  }

  function getSeekerElement(seekerChar) {
    if (!seekerChar) return selectedElement;
    if (env.G && seekerChar === env.G.player) return selectedElement;
    const id = seekerChar.userData?.elemId;
    return ELEMENTAL_GUN_SPECS[id] ? id : 'water';
  }

  function setSeekerElement(seekerChar, elemId) {
    const validId = ELEMENTAL_GUN_SPECS[elemId] ? elemId : 'water';
    if (!seekerChar) return validId;
    if (!seekerChar.userData) seekerChar.userData = {};
    seekerChar.userData.elemId = validId;
    seekerChar.userData.elemGun = validId;
    attachThirdPersonElement(seekerChar, validId);
    if (env.G && seekerChar === env.G.player) {
      selectElement(validId, { silent: true });
    }
    return validId;
  }

  function selectElement(elemId, opts = {}) {
    const validId = ELEMENTAL_GUN_SPECS[elemId] ? elemId : 'water';
    const avail = getAvailableElements();
    const targetId = (!opts.force && !avail.includes(validId)) ? 'water' : validId;
    const changed = targetId !== selectedElement;
    selectedElement = targetId;

    const spec = setFirstPersonElement(targetId);
    if (env.G?.player && env.G.mode === 'seek') {
      env.G.player.userData.elemId = targetId;
      env.G.player.userData.elemGun = targetId;
      attachThirdPersonElement(env.G.player, targetId);
    }

    syncHudPill(changed && !opts.silent);

    if (changed || opts.notify) {
      const prog = env.progression || (typeof env.getProgression === 'function' ? env.getProgression() : null);
      if (prog && typeof prog.setEquippedElemGun === 'function') {
        prog.setEquippedElemGun(targetId);
      } else if (prog && typeof prog.setEquippedElement === 'function') {
        prog.setEquippedElement(targetId);
      }
      if (typeof env.onElementChanged === 'function') {
        env.onElementChanged(targetId, spec);
      }
      if (typeof env.onSelectElement === 'function') {
        env.onSelectElement(targetId, spec);
      }
    }

    if (!opts.silent) {
      elemAudio.playSwitch(targetId);
      const isTrial = isElementTrialOnly(targetId);
      const msg = `${spec.icon} ${spec.name}${isTrial ? ' · Trial' : ''}`;
      if (typeof env.hint === 'function') env.hint(msg, 1150);
    }
    return spec;
  }

  function cycleElement(step = 1, opts = {}) {
    const avail = getAvailableElements();
    if (avail.length <= 1) {
      const spec = getElementSpec(selectedElement);
      elemAudio.playSwitch(selectedElement);
      syncHudPill(true);
      if (!opts.silent && typeof env.hint === 'function') {
        env.hint(`${spec.icon} Unlock 🪨🔥❄️🌪️ Guns at Lv. 6, 14, 22 & 32!`, 1450);
      }
      return spec;
    }
    const curIdx = Math.max(0, avail.indexOf(selectedElement));
    const nextIdx = (curIdx + step + avail.length) % avail.length;
    return selectElement(avail[nextIdx], opts);
  }

  function getShotParams(elemOrSeeker) {
    const isChar = elemOrSeeker && typeof elemOrSeeker === 'object';
    const elemId = typeof elemOrSeeker === 'string'
      ? (ELEMENTAL_GUN_SPECS[elemOrSeeker] ? elemOrSeeker : 'water')
      : getSeekerElement(elemOrSeeker);
    const spec = ELEMENTAL_GUN_SPECS[elemId];
    const seekerPerk = isChar && typeof env.getSeekerPerk === 'function' ? env.getSeekerPerk(elemOrSeeker) : 'none';
    const speedMul = seekerPerk === 'elem_overdrive' ? 1.12 : 1.0;
    return {
      elemId,
      shotSpeed: spec.shotSpeed * speedMul,
      gravityMul: spec.gravityMul,
      spread: spec.spread,
      hitDamage: spec.hitDamage || 6.5,
      spec,
    };
  }

  function getHitDamage(elemId) {
    const spec = ELEMENTAL_GUN_SPECS[elemId] || ELEMENTAL_GUN_SPECS.water;
    return spec.hitDamage || 6.5;
  }

  // --------------------------------------------------------------------------
  // Pooled InstancedMesh Elemental Projectiles (Zero Per-Frame Allocations!)
  // --------------------------------------------------------------------------
  const MAX_SHOT_INST = 420;
  const waterShotsOut = [];
  let lastProjCheckTime = -1;

  const projPools = (() => {
    if (!scene) return null;
    const mkInst = (geo, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, MAX_SHOT_INST);
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = false;
      im.renderOrder = 3;
      scene.add(im);
      return im;
    };

    // Fire: white-gold/orange core bolts + trailing crimson-amber ember sparks
    const fireCoreGeo = new THREE.SphereGeometry(1, 8, 6);
    const fireSparkGeo = new THREE.OctahedronGeometry(1, 0);
    // Snow: lumpy winter snowballs + glinting cyan crystal octahedrons
    const snowBallGeo = new THREE.IcosahedronGeometry(1, 1);
    const snowCrysGeo = new THREE.OctahedronGeometry(1, 0);
    // Earth: asymmetric chiseled boulders + spinning dark soil clods
    const earthRockGeo = new THREE.DodecahedronGeometry(1, 0);
    earthRockGeo.scale(1.18, 0.84, 1.05);
    const earthClodGeo = new THREE.IcosahedronGeometry(1, 0);
    earthClodGeo.scale(0.95, 1.12, 0.88);
    // Air: Mach-vortex torus rings (aligned to +Y velocity axis) + wind wisp ribbons
    const airRingGeo = new THREE.TorusGeometry(1, 0.17, 6, 18);
    airRingGeo.rotateX(Math.PI / 2);
    const airWispGeo = new THREE.ConeGeometry(0.45, 2.2, 5);

    return {
      fireCore: mkInst(fireCoreGeo, new THREE.MeshBasicMaterial({ color: 0xffb838, transparent: true, opacity: 0.88 })),
      fireSpark: mkInst(fireSparkGeo, new THREE.MeshBasicMaterial({ color: 0xff5114, transparent: true, opacity: 0.85 })),
      snowBall: mkInst(snowBallGeo, new THREE.MeshLambertMaterial({ color: 0xf4fbff, emissive: 0x3b7aa8, emissiveIntensity: 0.22 })),
      snowCrys: mkInst(snowCrysGeo, new THREE.MeshBasicMaterial({ color: 0x93e8ff, transparent: true, opacity: 0.72 })),
      earthRock: mkInst(earthRockGeo, new THREE.MeshLambertMaterial({ color: 0x8f6d4a, flatShading: true })),
      earthClod: mkInst(earthClodGeo, new THREE.MeshLambertMaterial({ color: 0x593e25, flatShading: true })),
      airRing: mkInst(airRingGeo, new THREE.MeshBasicMaterial({ color: 0xaef8e6, transparent: true, opacity: 0.34, depthWrite: false })),
      airWisp: mkInst(airWispGeo, new THREE.MeshBasicMaterial({ color: 0xeafffa, transparent: true, opacity: 0.26, depthWrite: false })),
    };
  })();

  function onShotSpawned(shotObj, elemId) {
    if (!shotObj) return shotObj;
    const resolved = elemId && ELEMENTAL_GUN_SPECS[elemId]
      ? elemId
      : getSeekerElement(shotObj.shooter);
    shotObj.elem = resolved;
    shotObj._eSeed = Math.random() * 62.83;
    if (shotObj.col) {
      const isLocal = !!(env.G && shotObj.shooter === env.G.player);
      elemAudio.playShot(resolved, shotObj.p, isLocal);
    }
    return shotObj;
  }

  function stepAirFlybyPhysics(shots) {
    const realProps = env.realProps;
    if (!shots || !shots.length) return;
    for (let i = 0; i < shots.length; i++) {
      const d = shots[i];
      if (!d || !d.col || d.delay > 0) continue;
      const elem = d.elem || (d.shooter ? getSeekerElement(d.shooter) : 'water');
      if (elem !== 'air') continue;

      const grp = d.lead || d;
      if (!grp._pushedSet) grp._pushedSet = new Set();

      // Push realProps within 1.35m of the flying air gust segment (prevP -> p)!
      const p0 = d._prevP || d.p;
      const sx = d.p.x - p0.x, sy = d.p.y - p0.y, sz = d.p.z - p0.z;
      const segLenSq = sx * sx + sy * sy + sz * sz;
      if (realProps && realProps.length) {
        for (let k = 0; k < realProps.length; k++) {
          const r = realProps[k];
          if (!r || !r.g || grp._pushedSet.has(r)) continue;
          const cy = r.g.position.y + 0.45;
          const tSeg = segLenSq > 1e-6
            ? clamp(((r.g.position.x - p0.x) * sx + (cy - p0.y) * sy + (r.g.position.z - p0.z) * sz) / segLenSq, 0, 1)
            : 1;
          const qx = p0.x + sx * tSeg;
          const qy = p0.y + sy * tSeg;
          const qz = p0.z + sz * tSeg;
          const dx = r.g.position.x - qx;
          const dz = r.g.position.z - qz;
          const dy = cy - qy;
          const reach = 1.35 + (r.radius || 0.45) * 0.4;
          if (dx * dx + dz * dz <= reach * reach && Math.abs(dy) < 1.45) {
            grp._pushedSet.add(r);
            const sp = d.v.length() || 1;
            _v1.set(d.v.x / sp + dx * 0.25, 0, d.v.z / sp + dz * 0.25);
            if (_v1.lengthSq() < 1e-4) _v1.set(0, 0, 1);
            _v1.normalize();
            impulseProp(r, _v1.x, _v1.z, 6.2, 2.45);
          }
        }
      }

      // Also tumble any nearby settled loose Earth physics rocks!
      impulseLooseRocksNear(d.p.x, d.p.y, d.p.z, 1.35, d.v.x * 0.16, d.v.z * 0.16, 2.4);

      if (!d.remoteVisual) {
        // Pop Hider Decoy Clones caught within 1.05m of the flying air vortex
        const ht = env.hiderTricks || (typeof env.getHiderTricks === 'function' ? env.getHiderTricks() : null);
        if (ht && typeof ht.triggerSplashArea === 'function') {
          ht.triggerSplashArea(d.p, 1.05, d.shooter);
        }
        // Apply near-miss wind gust nudge on Hiders within 1.15m
        const allHiders = env.G?.allHiders;
        if (allHiders && allHiders.length) {
          for (let hIdx = 0; hIdx < allHiders.length; hIdx++) {
            const h = allHiders[hIdx];
            if (!h || h.userData?.actor?.eliminated || grp._pushedSet.has(h)) continue;
            const hx = h.position.x - d.p.x;
            const hz = h.position.z - d.p.z;
            const hy = ((h.position.y || 0) + 0.55) - d.p.y;
            if (hx * hx + hz * hz <= 1.32 && Math.abs(hy) < 1.25) {
              grp._pushedSet.add(h);
              const sp = d.v.length() || 1;
              triggerHiderGustKnockback(h, { x: d.v.x / sp + hx * 0.25, z: d.v.z / sp + hz * 0.25 }, 1.9);
            }
          }
        }
      }
    }
  }

  function updateProjectiles(shots, dt) {
    if (!shots) return;
    lastProjCheckTime = typeof performance !== 'undefined' ? performance.now() : 0;
    for (let i = 0; i < shots.length; i++) {
      const d = shots[i];
      if (!d || d.delay > 0) continue;
      d._eAge = (d._eAge || 0) + dt;
    }
    stepAirFlybyPhysics(shots);
  }

  function renderElementalShots(shots, dt = 0.016) {
    waterShotsOut.length = 0;
    if (!shots) return waterShotsOut;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : 0;
    if (Math.abs(nowMs - lastProjCheckTime) > 4) {
      updateProjectiles(shots, dt);
    }

    let nFireCore = 0, nFireSpark = 0;
    let nSnowBall = 0, nSnowCrys = 0;
    let nEarthRock = 0, nEarthClod = 0;
    let nAirRing = 0, nAirWisp = 0;
    let nWater = 0;
    const dropI = env.dropI;
    const dropCap = dropI ? (dropI.instanceMatrix?.count || 900) : 900;

    for (let i = 0; i < shots.length; i++) {
      const d = shots[i];
      if (!d || d.delay > 0) continue;
      const elem = d.elem || 'water';

      if (elem === 'water') {
        waterShotsOut.push(d);
        if (dropI && nWater < dropCap) {
          const sp = d.v.length();
          _v1.copy(d.v).divideScalar(sp || 1);
          _q1.setFromUnitVectors(_up, _v1);
          const nearMul = (env.G && d.shooter === env.G.player) ? (0.35 + 0.65 * smoothstep(0.0, 1.15, d.trav)) : 1.0;
          const r = (d.grow ? Math.min(d.r, 0.018 + d.trav * 0.018) : d.r * 0.72) * Math.min(1, d.life * 5) * nearMul;
          _sc.set(r, r * (1 + Math.min(sp * (d.stretch || 0.075), 3.1)), r);
          _m4.compose(d.p, _q1, _sc);
          dropI.setMatrixAt(nWater++, _m4);
        }
        continue;
      }

      if (!projPools) continue;
      const sp = d.v.length() || 1;
      _v1.copy(d.v).divideScalar(sp);
      const seed = d._eSeed || (i * 1.7);
      const age = d._eAge || (d.trav / sp);
      const fade = Math.min(1, d.life * 5);
      // Keep projectiles slim right out of the 1st-person barrel so they NEVER block the crosshair!
      const nearMul = (env.G && d.shooter === env.G.player) ? (0.28 + 0.72 * smoothstep(0.0, 1.35, d.trav)) : 1.0;
      const baseR = (d.grow ? Math.min(d.r * 0.82, 0.016 + d.trav * 0.013) : d.r * 0.68) * fade * nearMul;

      if (elem === 'fire') {
        _q1.setFromUnitVectors(_up, _v1);
        if (d.col) {
          if (nFireCore < MAX_SHOT_INST) {
            const flicker = 0.9 + 0.16 * Math.sin(age * 38 + seed);
            _sc.set(baseR * 0.82 * flicker, baseR * (1.65 + Math.min(sp * 0.04, 1.25)), baseR * 0.82 * flicker);
            _m4.compose(d.p, _q1, _sc);
            projPools.fireCore.setMatrixAt(nFireCore++, _m4);
          }
        } else if (nFireSpark < MAX_SHOT_INST) {
          const jx = Math.sin(age * 28 + seed) * 0.022;
          const jy = Math.cos(age * 24 + seed * 1.3) * 0.022;
          _v2.set(d.p.x + jx, d.p.y + jy, d.p.z - jx * 0.6);
          _euler.set(age * 14 + seed, age * 19, seed);
          _q2.setFromEuler(_euler);
          _sc.setScalar(baseR * 0.56);
          _m4.compose(_v2, _q2, _sc);
          projPools.fireSpark.setMatrixAt(nFireSpark++, _m4);
        }
      } else if (elem === 'snow') {
        _euler.set(age * 9 + seed, age * 12 + seed, age * 7);
        _q2.setFromEuler(_euler);
        if (d.col) {
          if (nSnowBall < MAX_SHOT_INST) {
            _sc.setScalar(baseR * 0.92);
            _m4.compose(d.p, _q2, _sc);
            projPools.snowBall.setMatrixAt(nSnowBall++, _m4);
          }
        } else if (nSnowCrys < MAX_SHOT_INST) {
          const orb = 0.022;
          _v2.set(
            d.p.x + Math.cos(age * 18 + seed) * orb,
            d.p.y + Math.sin(age * 16 + seed) * orb,
            d.p.z + Math.sin(age * 14 - seed) * orb
          );
          _sc.set(baseR * 0.52, baseR * 0.82, baseR * 0.52);
          _m4.compose(_v2, _q2, _sc);
          projPools.snowCrys.setMatrixAt(nSnowCrys++, _m4);
        }
      } else if (elem === 'earth') {
        _euler.set(age * 11 + seed, age * 8.5 + seed * 0.7, age * 13.2);
        _q2.setFromEuler(_euler);
        if (d.col) {
          if (nEarthRock < MAX_SHOT_INST) {
            _sc.setScalar(baseR * 0.96);
            _m4.compose(d.p, _q2, _sc);
            projPools.earthRock.setMatrixAt(nEarthRock++, _m4);
          }
        } else if (nEarthClod < MAX_SHOT_INST) {
          _v2.set(
            d.p.x + Math.sin(seed * 3.1) * 0.02,
            d.p.y - 0.012,
            d.p.z + Math.cos(seed * 2.7) * 0.02
          );
          _sc.setScalar(baseR * 0.55);
          _m4.compose(_v2, _q2, _sc);
          projPools.earthClod.setMatrixAt(nEarthClod++, _m4);
        }
      } else if (elem === 'air') {
        _q1.setFromUnitVectors(_up, _v1);
        if (d.col) {
          if (nAirRing < MAX_SHOT_INST) {
            // Compact sheer Mach-vortex ring oriented along velocity
            const machR = (0.036 + Math.min(d.trav * 0.0075, 0.082)) * fade * nearMul;
            _sc.set(machR, machR * 0.55, machR);
            _m4.compose(d.p, _q1, _sc);
            projPools.airRing.setMatrixAt(nAirRing++, _m4);
          }
        } else if (nAirWisp < MAX_SHOT_INST) {
          const swirlA = age * 22 + seed;
          const swirlR = (0.028 + Math.min(d.trav * 0.006, 0.065)) * nearMul;
          _v2.set(-_v1.z, 0, _v1.x);
          if (_v2.lengthSq() < 1e-4) _v2.set(1, 0, 0);
          _v2.normalize();
          _v3.crossVectors(_v1, _v2).normalize();
          const px = d.p.x + (_v2.x * Math.cos(swirlA) + _v3.x * Math.sin(swirlA)) * swirlR;
          const py = d.p.y + (_v2.y * Math.cos(swirlA) + _v3.y * Math.sin(swirlA)) * swirlR;
          const pz = d.p.z + (_v2.z * Math.cos(swirlA) + _v3.z * Math.sin(swirlA)) * swirlR;
          _v2.set(px, py, pz);
          _sc.set(baseR * 0.42, baseR * 1.45, baseR * 0.42);
          _m4.compose(_v2, _q1, _sc);
          projPools.airWisp.setMatrixAt(nAirWisp++, _m4);
        }
      }
    }

    if (dropI) {
      dropI.count = nWater;
      dropI.instanceMatrix.needsUpdate = true;
    }
    if (projPools) {
      const sync = (im, cnt) => {
        if (im.count !== cnt || cnt > 0) {
          im.count = cnt;
          im.instanceMatrix.needsUpdate = true;
        }
      };
      sync(projPools.fireCore, nFireCore);
      sync(projPools.fireSpark, nFireSpark);
      sync(projPools.snowBall, nSnowBall);
      sync(projPools.snowCrys, nSnowCrys);
      sync(projPools.earthRock, nEarthRock);
      sync(projPools.earthClod, nEarthClod);
      sync(projPools.airRing, nAirRing);
      sync(projPools.airWisp, nAirWisp);
    }

    return waterShotsOut;
  }

  // --------------------------------------------------------------------------
  // Single-Draw-Call Pooled Ambient Particle System (Smoke, Embers, Snow, Drips)
  // --------------------------------------------------------------------------
  const MAX_PARTICLES = 360;
  const partPos = new Float32Array(MAX_PARTICLES * 3);
  const partVel = new Float32Array(MAX_PARTICLES * 3);
  const partCol = new Float32Array(MAX_PARTICLES * 3);
  const partSize = new Float32Array(MAX_PARTICLES);
  const partBaseSize = new Float32Array(MAX_PARTICLES);
  const partAlpha = new Float32Array(MAX_PARTICLES);
  const partKind = new Float32Array(MAX_PARTICLES);
  const partLife = new Float32Array(MAX_PARTICLES);
  const partMaxLife = new Float32Array(MAX_PARTICLES);
  const partGrav = new Float32Array(MAX_PARTICLES);
  let partHead = 0;

  for (let i = 0; i < MAX_PARTICLES; i++) partPos[i * 3 + 1] = -80;

  const particleSystem = (() => {
    if (!scene) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(partSize, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(partAlpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(partCol, 3));
    geo.setAttribute('aKind', new THREE.BufferAttribute(partKind, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 520 } },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    scene.add(pts);
    return { geo, mat, pts };
  })();

  function emitParticle(x, y, z, vx, vy, vz, r, g, b, size, life, kind = 0, grav = 0) {
    const k = partHead++ % MAX_PARTICLES;
    const i3 = k * 3;
    partPos[i3] = x;
    partPos[i3 + 1] = y;
    partPos[i3 + 2] = z;
    partVel[i3] = vx;
    partVel[i3 + 1] = vy;
    partVel[i3 + 2] = vz;
    partCol[i3] = r;
    partCol[i3 + 1] = g;
    partCol[i3 + 2] = b;
    partBaseSize[k] = size;
    partSize[k] = size;
    partAlpha[k] = 0.01;
    partKind[k] = kind;
    partLife[k] = life;
    partMaxLife[k] = Math.max(0.05, life);
    partGrav[k] = grav;
  }

  function updateParticles(dt, nowSec) {
    if (!particleSystem) return;
    if (env.renderer?.domElement && env.camera) {
      const fovRad = ((env.camera.fov || 62) * Math.PI) / 360;
      particleSystem.mat.uniforms.uScale.value = env.renderer.domElement.height / (2 * Math.tan(fovRad));
    }

    let anyAlive = false;
    for (let k = 0; k < MAX_PARTICLES; k++) {
      if (partLife[k] <= 0) {
        if (partAlpha[k] !== 0) {
          partAlpha[k] = 0;
          partPos[k * 3 + 1] = -80;
          anyAlive = true;
        }
        continue;
      }
      anyAlive = true;
      partLife[k] -= dt;
      const i3 = k * 3;
      const kind = partKind[k];
      partVel[i3 + 1] += partGrav[k] * dt;

      if (kind < 0.5) {
        // Smoke / dust gentle horizontal wind drift & expansion
        const drag = Math.max(0, 1 - 1.4 * dt);
        partVel[i3] = partVel[i3] * drag + Math.sin(nowSec * 2.1 + k) * 0.28 * dt;
        partVel[i3 + 2] = partVel[i3 + 2] * drag + Math.cos(nowSec * 1.8 + k * 0.7) * 0.28 * dt;
      } else if (kind < 1.5) {
        // Floating fire ember turbulence
        partVel[i3] += Math.sin(nowSec * 8.5 + k * 1.9) * 1.8 * dt;
        partVel[i3 + 2] += Math.cos(nowSec * 7.8 + k * 2.3) * 1.8 * dt;
      } else if (kind < 2.5) {
        // Fluttering snowflake
        partVel[i3] = Math.sin(nowSec * 3.2 + k * 1.3) * 0.35;
        partVel[i3 + 2] = Math.cos(nowSec * 2.7 + k * 1.7) * 0.35;
      }

      partPos[i3] += partVel[i3] * dt;
      partPos[i3 + 1] += partVel[i3 + 1] * dt;
      partPos[i3 + 2] += partVel[i3 + 2] * dt;

      // Stop falling water drips when hitting ground
      if (kind > 2.5 && typeof env.groundHeightAt === 'function') {
        const gy = env.groundHeightAt(partPos[i3], partPos[i3 + 2], partPos[i3 + 1] + 0.2);
        if (partPos[i3 + 1] <= gy + 0.03) {
          partLife[k] = 0;
          partAlpha[k] = 0;
          partPos[i3 + 1] = -80;
          continue;
        }
      }

      const frac = 1 - Math.max(0, partLife[k]) / partMaxLife[k];
      const fadeIn = Math.min(1, frac * 6.5);
      const fadeOut = 1 - frac * frac;
      if (kind < 0.5) {
        partSize[k] = partBaseSize[k] * (0.65 + frac * 1.25);
        partAlpha[k] = 0.22 * fadeIn * (1 - frac);
      } else if (kind < 1.5) {
        partSize[k] = partBaseSize[k] * (0.95 - frac * 0.55);
        partAlpha[k] = 0.82 * fadeIn * fadeOut;
      } else if (kind < 2.5) {
        partSize[k] = partBaseSize[k] * (0.9 - frac * 0.25);
        partAlpha[k] = 0.72 * fadeIn * (1 - frac);
      } else {
        partSize[k] = partBaseSize[k];
        partAlpha[k] = 0.72 * fadeIn * (1 - frac * 0.6);
      }
    }

    if (anyAlive) {
      particleSystem.geo.attributes.position.needsUpdate = true;
      particleSystem.geo.attributes.aSize.needsUpdate = true;
      particleSystem.geo.attributes.aAlpha.needsUpdate = true;
      particleSystem.geo.attributes.aColor.needsUpdate = true;
      particleSystem.geo.attributes.aKind.needsUpdate = true;
    }
  }

  // --------------------------------------------------------------------------
  // Compact Low-Profile Geometries & Materials for 4s World Patches & Physics
  // --------------------------------------------------------------------------
  const sharedGeos = (() => {
    const planeXY = new THREE.PlaneGeometry(1, 1);
    const flameCard = new THREE.PlaneGeometry(1, 1, 3, 6);
    flameCard.translate(0, 0.5, 0); // Pivot at flame base y = 0, licking upward +Y!

    const snowDome = new THREE.SphereGeometry(0.5, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const icicleCone = new THREE.ConeGeometry(0.028, 0.18, 6);
    icicleCone.translate(0, -0.09, 0); // Petite 18cm icicles pointing strictly -Y!

    const rockSpire = new THREE.ConeGeometry(0.09, 0.26, 5);
    rockSpire.translate(0, 0.115, 0);
    const boulderChunk = new THREE.DodecahedronGeometry(1, 0);
    const soilBerm = new THREE.TorusGeometry(0.16, 0.042, 5, 10);
    soilBerm.rotateX(Math.PI / 2);

    const vortexFunnel = new THREE.CylinderGeometry(0.22, 0.065, 0.46, 16, 4, true);
    vortexFunnel.translate(0, 0.23, 0);
    const leafQuad = new THREE.PlaneGeometry(0.068, 0.04);

    return {
      planeXY,
      flameCard,
      snowDome,
      icicleCone,
      rockSpire,
      boulderChunk,
      soilBerm,
      vortexFunnel,
      leafQuad,
    };
  })();

  const sharedMats = (() => {
    const rockA = new THREE.MeshLambertMaterial({ color: 0x7d6a56, flatShading: true });
    const rockB = new THREE.MeshLambertMaterial({ color: 0x987a58, flatShading: true });
    const rockDark = new THREE.MeshLambertMaterial({ color: 0x594d42, flatShading: true });
    const soilMat = new THREE.MeshLambertMaterial({ color: 0x6b4c30, flatShading: true });
    const icicleMat = THREE.MeshStandardMaterial
      ? new THREE.MeshStandardMaterial({
          color: 0xc8f2ff,
          roughness: 0.14,
          metalness: 0.08,
          transparent: true,
          opacity: 0.82,
          emissive: 0x2b8ac4,
          emissiveIntensity: 0.25,
        })
      : new THREE.MeshBasicMaterial({ color: 0xc8f2ff, transparent: true, opacity: 0.82 });
    const leafGreen = new THREE.MeshBasicMaterial({ color: 0x82c95e, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const leafSakura = new THREE.MeshBasicMaterial({ color: 0xffa6c4, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const leafGold = new THREE.MeshBasicMaterial({ color: 0xffcf66, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });

    return { rockA, rockB, rockDark, soilMat, icicleMat, leafGreen, leafSakura, leafGold };
  })();

  // --------------------------------------------------------------------------
  // Pool of 3 Warm Flickering Additive Halo Glows for Burning Clusters (Zero PointLights / Zero Shader Recompiles!)
  // --------------------------------------------------------------------------
  const FIRE_LIGHT_POOL_SIZE = 3;
  const fireLights = [];
  if (scene && THREE.Sprite && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255, 200, 110, 0.95)');
      g.addColorStop(0.38, 'rgba(255, 128, 42, 0.52)');
      g.addColorStop(0.75, 'rgba(255, 78, 18, 0.16)');
      g.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    const fireGlowTex = new THREE.CanvasTexture(c);
    for (let i = 0; i < FIRE_LIGHT_POOL_SIZE; i++) {
      const spMat = new THREE.SpriteMaterial({
        map: fireGlowTex,
        color: 0xff9244,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(spMat);
      sp.visible = false;
      sp.renderOrder = 2;
      sp.userData.noSolid = true;
      sp.intensity = 0;
      sp.distance = 4.6;
      scene.add(sp);
      fireLights.push(sp);
    }
  }

  // --------------------------------------------------------------------------
  // Pool of 48 Rigid-Body Tumbling Earth Boulders / Pebbles (30s Persistence!)
  // --------------------------------------------------------------------------
  const MAX_PHYSICS_ROCKS = 48;
  const physicsRocks = [];
  if (scene) {
    const rockMats = [sharedMats.rockA, sharedMats.rockB, sharedMats.rockDark];
    for (let i = 0; i < MAX_PHYSICS_ROCKS; i++) {
      const m = new THREE.Mesh(sharedGeos.boulderChunk, rockMats[i % rockMats.length]);
      m.visible = false;
      m.castShadow = false;
      m.receiveShadow = true;
      m.userData.noSolid = true;
      scene.add(m);
      physicsRocks.push({
        mesh: m,
        active: false,
        age: 0,
        radius: 0.12,
        sx: 1, sy: 1, sz: 1,
        x: 0, y: -50, z: 0,
        vx: 0, vy: 0, vz: 0,
        avx: 0, avy: 0, avz: 0,
        settled: false,
        dustTimer: 0,
      });
    }
  }
  let rockPoolCursor = 0;
  let lastRockBurstMs = 0;

  function spawnPhysicsRocks(origin, normal, count = 2, isBomb = false) {
    if (!physicsRocks.length) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!isBomb && nowMs - lastRockBurstMs < 95) return;
    lastRockBurstMs = nowMs;

    const tier = getQualityTier();
    const adjCount = tier === 'low' ? Math.max(1, Math.ceil(count * 0.5)) : count;

    for (let k = 0; k < adjCount; k++) {
      let slot = null;
      for (let s = 0; s < MAX_PHYSICS_ROCKS; s++) {
        const cand = physicsRocks[(rockPoolCursor + s) % MAX_PHYSICS_ROCKS];
        if (!cand.active) { slot = cand; break; }
      }
      if (!slot) {
        slot = physicsRocks[0];
        for (let s = 1; s < MAX_PHYSICS_ROCKS; s++) {
          if (physicsRocks[s].age > slot.age) slot = physicsRocks[s];
        }
      }
      rockPoolCursor = (rockPoolCursor + 1) % MAX_PHYSICS_ROCKS;

      const ang = (k / Math.max(1, adjCount)) * Math.PI * 2 + rand(-0.45, 0.45);
      // Small skittering ground pebbles — never bounce high into the camera!
      const outSpd = isBomb ? rand(2.1, 4.4) : rand(0.95, 2.25);
      const upSpd = isBomb ? rand(2.0, 3.6) : rand(0.95, 1.85);
      const r = isBomb ? rand(0.055, 0.095) : rand(0.032, 0.058);

      slot.active = true;
      slot.age = 0;
      slot.settled = false;
      slot.dustTimer = 0.25;
      slot.radius = r;
      slot.sx = r * rand(0.85, 1.28);
      slot.sy = r * rand(0.68, 1.02);
      slot.sz = r * rand(0.85, 1.24);

      slot.x = origin.x + (normal?.x || 0) * 0.1 + Math.cos(ang) * 0.08;
      slot.y = origin.y + Math.max(0.05, (normal?.y || 0) * 0.09) + 0.04;
      slot.z = origin.z + (normal?.z || 0) * 0.1 + Math.sin(ang) * 0.08;

      slot.vx = Math.cos(ang) * outSpd + (normal?.x || 0) * 0.9;
      slot.vy = upSpd + Math.max(0, (normal?.y || 0) * 0.5);
      slot.vz = Math.sin(ang) * outSpd + (normal?.z || 0) * 0.9;
      slot.avx = rand(-9, 9);
      slot.avy = rand(-9, 9);
      slot.avz = rand(-9, 9);

      slot.mesh.visible = true;
      slot.mesh.position.set(slot.x, slot.y, slot.z);
      slot.mesh.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
      slot.mesh.scale.set(slot.sx, slot.sy, slot.sz);
    }
  }

  function impulseLooseRocksNear(x, y, z, radius, ivx, ivz, ivy = 2.0) {
    const r2 = radius * radius;
    for (let i = 0; i < physicsRocks.length; i++) {
      const rk = physicsRocks[i];
      if (!rk.active || rk.age > 28.5) continue;
      const dx = rk.x - x;
      const dy = rk.y - y;
      const dz = rk.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= r2 && Math.abs(dy) < 1.6) {
        const d = Math.sqrt(d2) || 0.2;
        const falloff = clamp(1 - d / (radius + 0.2), 0.25, 1);
        rk.vx += (ivx + (dx / d) * 3.2) * falloff;
        rk.vz += (ivz + (dz / d) * 3.2) * falloff;
        rk.vy = Math.max(rk.vy, ivy * falloff);
        rk.avx = rand(-10, 10);
        rk.avz = rand(-10, 10);
        rk.settled = false;
      }
    }
  }

  function bounceCircleOffBlockers(x, z, y, r, vx, vz, ignoreBox = null) {
    const blockers = env.blockers;
    let bounced = false;
    if (blockers && blockers.length) {
      for (let i = 0; i < blockers.length; i++) {
        const b = blockers[i];
        if (!b || b === ignoreBox) continue;
        if (b.y0 != null && b.y1 != null && (y + r * 1.5 < b.y0 || y >= b.y1 - 0.05)) continue;
        if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue;

        if (b.obb) {
          const o = b.obb;
          const dx = x - o.cx, dz = z - o.cz;
          let lx = dx * o.c - dz * o.s;
          let lz = dx * o.s + dz * o.c;
          const qx = clamp(lx, -o.hx, o.hx);
          const qz = clamp(lz, -o.hz, o.hz);
          const ex = lx - qx, ez = lz - qz;
          const d2 = ex * ex + ez * ez;
          if (d2 >= r * r) continue;
          let nxLocal = 0, nzLocal = 0;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            nxLocal = ex / d;
            nzLocal = ez / d;
            lx = qx + nxLocal * r;
            lz = qz + nzLocal * r;
          } else {
            const dl = lx + o.hx, dr = o.hx - lx, df = lz + o.hz, db = o.hz - lz;
            const m = Math.min(dl, dr, df, db);
            if (m === dl) { lx = -o.hx - r; nxLocal = -1; }
            else if (m === dr) { lx = o.hx + r; nxLocal = 1; }
            else if (m === df) { lz = -o.hz - r; nzLocal = -1; }
            else { lz = o.hz + r; nzLocal = 1; }
          }
          x = o.cx + lx * o.c + lz * o.s;
          z = o.cz - lx * o.s + lz * o.c;
          const nwx = nxLocal * o.c + nzLocal * o.s;
          const nwz = -nxLocal * o.s + nzLocal * o.c;
          const vn = vx * nwx + vz * nwz;
          if (vn < 0) {
            vx -= 1.42 * vn * nwx;
            vz -= 1.42 * vn * nwz;
            bounced = true;
          }
          continue;
        }

        const cx = clamp(x, b.x0, b.x1);
        const cz = clamp(z, b.z0, b.z1);
        const ex = x - cx, ez = z - cz;
        const d2 = ex * ex + ez * ez;
        if (d2 < r * r) {
          let nx = 0, nz = 0;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            nx = ex / d;
            nz = ez / d;
            x = cx + nx * r;
            z = cz + nz * r;
          } else {
            const dl = x - b.x0, dr = b.x1 - x, df = z - b.z0, db = b.z1 - z;
            const m = Math.min(dl, dr, df, db);
            if (m === dl) { x = b.x0 - r; nx = -1; }
            else if (m === dr) { x = b.x1 + r; nx = 1; }
            else if (m === df) { z = b.z0 - r; nz = -1; }
            else { z = b.z1 + r; nz = 1; }
          }
          const vn = vx * nx + vz * nz;
          if (vn < 0) {
            vx -= 1.42 * vn * nx;
            vz -= 1.42 * vn * nz;
            bounced = true;
          }
        }
      }
    }

    const mapR = (typeof env.getMapRadius === 'function' ? env.getMapRadius() : 30) - 0.55;
    const radial = Math.hypot(x, z);
    if (radial > mapR && radial > 1e-4) {
      const nx = -x / radial, nz = -z / radial;
      x = (x / radial) * mapR;
      z = (z / radial) * mapR;
      const vn = vx * nx + vz * nz;
      if (vn < 0) {
        vx -= 1.42 * vn * nx;
        vz -= 1.42 * vn * nz;
        bounced = true;
      }
    }
    return { x, z, vx, vz, bounced };
  }

  function updatePhysicsRocks(dt) {
    const gFn = env.groundHeightAt;
    for (let i = 0; i < physicsRocks.length; i++) {
      const rk = physicsRocks[i];
      if (!rk.active) continue;
      rk.age += dt;
      if (rk.age >= PERSIST_DURATION) {
        rk.active = false;
        rk.mesh.visible = false;
        continue;
      }

      const fadeFrac = rk.age > PERSIST_FADE_START
        ? clamp((rk.age - PERSIST_FADE_START) / (PERSIST_DURATION - PERSIST_FADE_START), 0, 1)
        : 0;

      if (!rk.settled) {
        const prevY = rk.y;
        rk.vy -= 18.0 * dt; // Realistic gravity = -18
        rk.x += rk.vx * dt;
        rk.y += rk.vy * dt;
        rk.z += rk.vz * dt;

        // Bounce off walls & blockers
        const col = bounceCircleOffBlockers(rk.x, rk.z, rk.y, rk.radius, rk.vx, rk.vz, null);
        rk.x = col.x;
        rk.z = col.z;
        rk.vx = col.vx;
        rk.vz = col.vz;

        const gy = typeof gFn === 'function' ? gFn(rk.x, rk.z, prevY + 0.15) : 0;
        const floorY = gy + rk.sy * 0.72;
        if (rk.y <= floorY) {
          rk.y = floorY;
          if (rk.vy < -1.15) {
            rk.vy = -rk.vy * 0.42; // Restitution 0.42
            rk.vx *= 0.78;
            rk.vz *= 0.78;
          } else {
            rk.vy = 0;
            // Slope rolling along terrain gradient
            if (typeof gFn === 'function') {
              const gx1 = gFn(rk.x + 0.25, rk.z, gy + 0.2);
              const gx0 = gFn(rk.x - 0.25, rk.z, gy + 0.2);
              const gz1 = gFn(rk.x, rk.z + 0.25, gy + 0.2);
              const gz0 = gFn(rk.x, rk.z - 0.25, gy + 0.2);
              const sxGrad = clamp((gx1 - gx0) * 2.0, -0.8, 0.8);
              const szGrad = clamp((gz1 - gz0) * 2.0, -0.8, 0.8);
              rk.vx -= sxGrad * 5.2 * dt;
              rk.vz -= szGrad * 5.2 * dt;
            }
            const fric = Math.exp(-4.2 * dt);
            rk.vx *= fric;
            rk.vz *= fric;
            rk.avx = -rk.vz / Math.max(0.06, rk.radius);
            rk.avz = rk.vx / Math.max(0.06, rk.radius);
            rk.avy *= fric;
            if (rk.vx * rk.vx + rk.vz * rk.vz < 0.012 && rk.age > 0.35) {
              rk.vx = 0;
              rk.vz = 0;
              rk.settled = true;
            }
          }
        }

        rk.mesh.rotation.x += rk.avx * dt;
        rk.mesh.rotation.y += rk.avy * dt;
        rk.mesh.rotation.z += rk.avz * dt;
      }

      // From 22s -> 30s: rocks sink smoothly downward into the earth with subtle dust motes!
      const sinkY = fadeFrac * fadeFrac * (rk.sy * 2.1 + 0.08);
      const shrink = 1 - fadeFrac * 0.45;
      rk.mesh.position.set(rk.x, rk.y - sinkY, rk.z);
      rk.mesh.scale.set(rk.sx * shrink, rk.sy * shrink, rk.sz * shrink);

      if (fadeFrac > 0.05 && fadeFrac < 0.92) {
        rk.dustTimer -= dt;
        if (rk.dustTimer <= 0) {
          rk.dustTimer = rand(0.45, 0.95);
          emitParticle(
            rk.x + rand(-0.08, 0.08),
            rk.y - rk.sy * 0.3,
            rk.z + rand(-0.08, 0.08),
            rand(-0.18, 0.18),
            rand(0.18, 0.45),
            rand(-0.18, 0.18),
            0.64, 0.52, 0.38,
            0.13,
            0.75,
            0,
            -0.1
          );
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // REAL PROP PHYSICS ENGINE on env.realProps (Air Gusts & Cyclone Shockwaves)
  // Live r.pos + r.ownBox (AABB & OBB) sync + 30s persistent displacement + 2.5s home glide!
  // --------------------------------------------------------------------------
  const displacedProps = new Map(); // propRec -> physics state
  const activeCharKnockbacks = new Map(); // victimChar -> { vx, vz, life }

  function resolvePropOwnBox(r, homeX, homeZ) {
    if (r.ownBox) return r.ownBox;
    const blockers = env.blockers;
    if (!blockers || !blockers.length) return null;
    let best = null;
    let bestD = 0.42;
    for (let i = 0; i < blockers.length; i++) {
      const b = blockers[i];
      if (!b || !b.isProp || (b._linkedProp && b._linkedProp !== r)) continue;
      const cx = (b.x0 + b.x1) * 0.5;
      const cz = (b.z0 + b.z1) * 0.5;
      const d = Math.hypot(cx - homeX, cz - homeZ);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) {
      best._linkedProp = r;
      r.ownBox = best;
    }
    return r.ownBox || null;
  }

  function ensurePropState(r) {
    let st = displacedProps.get(r);
    if (st) {
      if (r?.g && st.vx * st.vx + st.vz * st.vz < 1e-4 && Math.hypot(st.x - r.g.position.x, st.z - r.g.position.z) > 0.05) {
        st.x = r.g.position.x;
        st.z = r.g.position.z;
        st.gy = r.pos ? r.pos.y : r.g.position.y;
        st.hopY = 0;
      }
      return st;
    }
    if (!r || !r.g) return null;

    const kitProps = typeof env.getKit === 'function' ? env.getKit()?.props : null;
    const homeX = r.g.position.x;
    const homeY = r.g.position.y;
    const homeZ = r.g.position.z;
    const box = resolvePropOwnBox(r, homeX, homeZ);

    const hx = box ? (box.x1 - box.x0) * 0.5 : (r.radius || 0.45) * 0.78;
    const hz = box ? (box.z1 - box.z0) * 0.5 : (r.radius || 0.45) * 0.78;
    const propH = box && box.y1 != null
      ? Math.max(0.25, box.y1 - (box.y ?? homeY))
      : clamp((kitProps && kitProps[r.id]?.height) || 1.0, 0.25, 2.5);

    st = {
      rec: r,
      mass: computePropMass(r, kitProps),
      homeX,
      homeY,
      homeZ,
      homeRotX: r.g.rotation.x,
      homeRotY: r.g.rotation.y,
      homeRotZ: r.g.rotation.z,
      ownBox: box,
      homeBox: box ? {
        x0: box.x0, x1: box.x1,
        z0: box.z0, z1: box.z1,
        y: box.y, y0: box.y0, y1: box.y1,
        standable: box.standable,
        obbCx: box.obb ? box.obb.cx : 0,
        obbCz: box.obb ? box.obb.cz : 0,
      } : null,
      hx,
      hz,
      propH,
      x: homeX,
      gy: homeY,
      z: homeZ,
      hopY: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      tiltX: 0,
      tiltZ: 0,
      tiltVelX: 0,
      tiltVelZ: 0,
      yawOff: 0,
      yawVel: 0,
      timeSincePush: 0,
      returnStartX: homeX,
      returnStartY: homeY,
      returnStartZ: homeZ,
      returnStartYaw: 0,
      returning: false,
    };
    displacedProps.set(r, st);
    return st;
  }

  function applyPropTransformAndCollider(st, visualY) {
    const r = st.rec;
    if (!r || !r.g) return;
    r.g.position.set(st.x, visualY, st.z);
    if (r.pos && r.pos !== r.g.position) {
      r.pos.set(st.x, st.gy, st.z);
    }
    r.g.rotation.set(
      st.homeRotX + st.tiltX,
      st.homeRotY + st.yawOff,
      st.homeRotZ + st.tiltZ
    );
    r.g.updateMatrixWorld(true);

    const b = st.ownBox || r.ownBox;
    if (b) {
      env.blockers?.markMoved?.(b);
      b.x0 = st.x - st.hx;
      b.x1 = st.x + st.hx;
      b.z0 = st.z - st.hz;
      b.z1 = st.z + st.hz;
      b.y = st.gy;
      b.y0 = st.gy - 0.25;
      b.y1 = st.gy + st.propH;
      if (b.obb) {
        b.obb.cx = st.x;
        b.obb.cz = st.z;
      }
    }
  }

  function restorePropHomeImmediate(st) {
    const r = st.rec;
    if (r && r.g) {
      r.g.position.set(st.homeX, st.homeY, st.homeZ);
      if (r.pos && r.pos !== r.g.position) {
        r.pos.set(st.homeX, st.homeY, st.homeZ);
      }
      r.g.rotation.set(st.homeRotX, st.homeRotY, st.homeRotZ);
      r.g.updateMatrixWorld(true);
    }
    const b = st.ownBox || r?.ownBox;
    if (b && st.homeBox) {
      b.x0 = st.homeBox.x0;
      b.x1 = st.homeBox.x1;
      b.z0 = st.homeBox.z0;
      b.z1 = st.homeBox.z1;
      b.y = st.homeBox.y;
      b.y0 = st.homeBox.y0;
      b.y1 = st.homeBox.y1;
      b.standable = st.homeBox.standable;
      if (b.obb) {
        b.obb.cx = st.homeBox.obbCx;
        b.obb.cz = st.homeBox.obbCz;
      }
    }
  }

  function queryGroundSafeForProp(st, x, z, refY) {
    if (typeof env.groundHeightAt !== 'function') return st.homeY;
    const b = st.ownBox || st.rec?.ownBox;
    const prevStand = b ? b.standable : false;
    if (b) b.standable = false; // Never let a prop climb onto its own collider!
    const gy = env.groundHeightAt(x, z, refY);
    if (b) b.standable = prevStand;
    return gy;
  }

  function impulseProp(r, dirX, dirZ, impulseMag = 5.5, liftMag = 2.2) {
    if (r && r.isAnimal) {
      if (typeof r.onStartled === 'function') r.onStartled(dirX, dirZ, impulseMag);
      return true;
    }
    const st = ensurePropState(r);
    if (!st) return false;
    const invMass = 1 / st.mass;
    const maxHorizSpd = 11.2;

    st.vx += dirX * impulseMag * invMass;
    st.vz += dirZ * impulseMag * invMass;
    const hSpd = Math.hypot(st.vx, st.vz);
    if (hSpd > maxHorizSpd) {
      st.vx = (st.vx / hSpd) * maxHorizSpd;
      st.vz = (st.vz / hSpd) * maxHorizSpd;
    }

    st.vy = Math.min(4.8, Math.max(st.vy, 0) + liftMag * Math.pow(invMass, 0.85));
    st.tiltVelX += dirZ * impulseMag * invMass * 2.1;
    st.tiltVelZ += -dirX * impulseMag * invMass * 2.1;
    st.yawVel += rand(-4.5, 4.5) * invMass * clamp(impulseMag * 0.2, 0.4, 1.8);
    st.timeSincePush = 0;
    st.returning = false;

    elemAudio.playPropBump(r.g.position, clamp(impulseMag * invMass * 0.18, 0.2, 0.9), st.mass > 2.3);
    return true;
  }

  function pushPropsInRadius(origin, radius, baseImpulse = 7.5, dirHint = null, isRadial = false) {
    const realProps = env.realProps;
    if (!realProps || !realProps.length) return 0;
    let pushed = 0;
    for (let i = 0; i < realProps.length; i++) {
      const r = realProps[i];
      if (!r || !r.g) continue;
      const dx = r.g.position.x - origin.x;
      const dz = r.g.position.z - origin.z;
      const dy = (r.g.position.y + 0.4) - origin.y;
      const d = Math.hypot(dx, dz);
      const effR = radius + (r.radius || 0.45) * 0.45;
      if (d > effR || Math.abs(dy) > Math.max(1.8, radius * 0.7)) continue;

      const falloff = clamp(1 - d / (effR + 0.35), 0.28, 1.0);
      let px = 0, pz = 0;
      if (isRadial || !dirHint) {
        if (d > 1e-3) { px = dx / d; pz = dz / d; }
        else { const a = rand(0, 6.28); px = Math.cos(a); pz = Math.sin(a); }
      } else {
        px = dirHint.x + (d > 1e-3 ? (dx / d) * 0.38 : 0);
        pz = dirHint.z + (d > 1e-3 ? (dz / d) * 0.38 : 0);
        const plen = Math.hypot(px, pz) || 1;
        px /= plen;
        pz /= plen;
      }
      impulseProp(r, px, pz, baseImpulse * falloff, (isRadial ? 3.8 : 2.3) * falloff);
      pushed++;
    }
    return pushed;
  }

  function updatePropPhysics(dt, nowSec) {
    if (displacedProps.size === 0) return;
    const realProps = env.realProps || [];
    const activeMap = typeof env.getActiveMap === 'function' ? env.getActiveMap() : null;

    for (const [r, st] of displacedProps.entries()) {
      if (!r || !r.g || !r.g.parent) {
        displacedProps.delete(r);
        continue;
      }

      st.timeSincePush += dt;
      // Props moved by wind stay permanently at their new settled spot for the rest of the round!

      // Gentle rustle torque if sitting near an active 4s Air Whirlwind Eddy (within 2.2m)
      let eddyWobbleX = 0, eddyWobbleZ = 0;
      for (let i = 0; i < patches.length; i++) {
        const pt = patches[i];
        if (pt.elemId !== 'air') continue;
        const dx = st.x - pt.x, dz = st.z - pt.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 4.84 && Math.abs(st.gy - pt.y) < 1.8) {
          const fadeK = pt.age > PERSIST_FADE_START
            ? 1 - (pt.age - PERSIST_FADE_START) / (PERSIST_DURATION - PERSIST_FADE_START)
            : 1;
          const strength = (1 - Math.sqrt(d2) / 2.2) * fadeK * (1.2 / st.mass);
          eddyWobbleX += Math.sin(nowSec * 9.5 + st.homeX * 3.1) * 0.065 * strength;
          eddyWobbleZ += Math.cos(nowSec * 8.7 + st.homeZ * 2.7) * 0.065 * strength;
        }
      }

      const speedSq = st.vx * st.vx + st.vz * st.vz;
      const movingOrTilted =
        speedSq > 1e-4 ||
        Math.abs(st.vy) > 1e-3 ||
        st.hopY > 1e-3 ||
        Math.abs(st.tiltX) > 1e-3 ||
        Math.abs(st.tiltZ) > 1e-3 ||
        Math.abs(st.tiltVelX) > 1e-3 ||
        Math.abs(st.tiltVelZ) > 1e-3 ||
        Math.abs(st.yawVel) > 1e-3 ||
        eddyWobbleX !== 0 ||
        eddyWobbleZ !== 0;

      if (!movingOrTilted) continue;

      // Vertical gravity (-16) & hop integration
      if (st.hopY > 0 || st.vy !== 0) {
        st.vy -= 16.0 * dt;
        st.hopY += st.vy * dt;
      }

      let nextX = st.x + st.vx * dt;
      let nextZ = st.z + st.vz * dt;

      // Prevent props from sliding into deep water
      if (activeMap && typeof activeMap.isDeepWater === 'function' && activeMap.isDeepWater(nextX, nextZ)) {
        nextX = st.x;
        nextZ = st.z;
        st.vx = -st.vx * 0.45;
        st.vz = -st.vz * 0.45;
      }

      // Bounce off static walls & non-prop blockers (ignoring r.ownBox & other props handled below)
      const blockers = env.blockers;
      const pr = Math.max(0.24, (r.radius || 0.45) * 0.76);
      const footY = st.gy + st.hopY;
      if (blockers && blockers.length) {
        for (let i = 0; i < blockers.length; i++) {
          const b = blockers[i];
          if (!b || b === st.ownBox || b.isProp) continue;
          if (b.y0 != null && b.y1 != null && (footY + st.propH < b.y0 + 0.06 || footY >= b.y1 - 0.08)) continue;
          if (nextX < b.x0 - pr || nextX > b.x1 + pr || nextZ < b.z0 - pr || nextZ > b.z1 + pr) continue;

          if (b.obb) {
            const o = b.obb;
            const dx = nextX - o.cx, dz = nextZ - o.cz;
            let lx = dx * o.c - dz * o.s;
            let lz = dx * o.s + dz * o.c;
            const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz);
            const ex = lx - qx, ez = lz - qz;
            const d2 = ex * ex + ez * ez;
            if (d2 >= pr * pr) continue;
            let nxl = 0, nzl = 0;
            if (d2 > 1e-6) {
              const d = Math.sqrt(d2);
              nxl = ex / d; nzl = ez / d;
              lx = qx + nxl * pr; lz = qz + nzl * pr;
            } else {
              const dl = lx + o.hx, dr = o.hx - lx, df = lz + o.hz, db = o.hz - lz;
              const m = Math.min(dl, dr, df, db);
              if (m === dl) { lx = -o.hx - pr; nxl = -1; }
              else if (m === dr) { lx = o.hx + pr; nxl = 1; }
              else if (m === df) { lz = -o.hz - pr; nzl = -1; }
              else { lz = o.hz + pr; nzl = 1; }
            }
            nextX = o.cx + lx * o.c + lz * o.s;
            nextZ = o.cz - lx * o.s + lz * o.c;
            const nwx = nxl * o.c + nzl * o.s;
            const nwz = -nxl * o.s + nzl * o.c;
            const vn = st.vx * nwx + st.vz * nwz;
            if (vn < 0) {
              st.vx -= 1.44 * vn * nwx;
              st.vz -= 1.44 * vn * nwz;
              st.tiltVelX += nwz * vn * 0.35;
              st.tiltVelZ -= nwx * vn * 0.35;
              elemAudio.playPropBump(r.g.position, clamp(-vn * 0.14, 0.15, 0.8), st.mass > 2.3);
            }
            continue;
          }

          const cx = clamp(nextX, b.x0, b.x1), cz = clamp(nextZ, b.z0, b.z1);
          const ex = nextX - cx, ez = nextZ - cz;
          const d2 = ex * ex + ez * ez;
          if (d2 < pr * pr) {
            let nx = 0, nz = 0;
            if (d2 > 1e-6) {
              const d = Math.sqrt(d2);
              nx = ex / d; nz = ez / d;
              nextX = cx + nx * pr; nextZ = cz + nz * pr;
            } else {
              const dl = nextX - b.x0, dr = b.x1 - nextX, df = nextZ - b.z0, db = b.z1 - nextZ;
              const m = Math.min(dl, dr, df, db);
              if (m === dl) { nextX = b.x0 - pr; nx = -1; }
              else if (m === dr) { nextX = b.x1 + pr; nx = 1; }
              else if (m === df) { nextZ = b.z0 - pr; nz = -1; }
              else { nextZ = b.z1 + pr; nz = 1; }
            }
            const vn = st.vx * nx + st.vz * nz;
            if (vn < 0) {
              st.vx -= 1.44 * vn * nx;
              st.vz -= 1.44 * vn * nz;
              st.tiltVelX += nz * vn * 0.35;
              st.tiltVelZ -= nx * vn * 0.35;
              elemAudio.playPropBump(r.g.position, clamp(-vn * 0.14, 0.15, 0.8), st.mass > 2.3);
            }
          }
        }
      }

      // Map boundary clamp & bounce
      const mapR = (typeof env.getMapRadius === 'function' ? env.getMapRadius() : 30) - 0.75;
      const radD = Math.hypot(nextX, nextZ);
      if (radD > mapR && radD > 1e-4) {
        const nx = -nextX / radD, nz = -nextZ / radD;
        nextX = (nextX / radD) * mapR;
        nextZ = (nextZ / radD) * mapR;
        const vn = st.vx * nx + st.vz * nz;
        if (vn < 0) {
          st.vx -= 1.42 * vn * nx;
          st.vz -= 1.42 * vn * nz;
        }
      }

      // Prop-to-prop rigid bump & momentum transfer!
      if (speedSq > 0.02) {
        for (let j = 0; j < realProps.length; j++) {
          const other = realProps[j];
          if (!other || other === r || !other.g || other.isAnimal) continue;
          if (Math.abs((other.g.position.y || 0) - st.gy) > 1.15) continue;
          const minSep = ((r.radius || 0.45) + (other.radius || 0.45)) * 0.82;
          const dx = other.g.position.x - nextX;
          const dz = other.g.position.z - nextZ;
          const d2 = dx * dx + dz * dz;
          if (d2 < minSep * minSep && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const nx = dx / d, nz = dz / d;
            const overlap = minSep - d;
            const ost = ensurePropState(other);
            const m1 = st.mass, m2 = ost ? ost.mass : 1.5;
            const totalM = m1 + m2;
            nextX -= nx * overlap * (m2 / totalM);
            nextZ -= nz * overlap * (m2 / totalM);

            const relVn = (st.vx - (ost ? ost.vx : 0)) * nx + (st.vz - (ost ? ost.vz : 0)) * nz;
            if (relVn > 0.05) {
              const jImp = (1.38 * relVn) / (1 / m1 + 1 / m2);
              st.vx -= (jImp / m1) * nx;
              st.vz -= (jImp / m1) * nz;
              if (ost) {
                ost.vx += (jImp / m2) * nx;
                ost.vz += (jImp / m2) * nz;
                ost.vy = Math.max(ost.vy, Math.min(2.2, (jImp / m2) * 0.35));
                ost.tiltVelX += nz * (jImp / m2) * 1.6;
                ost.tiltVelZ -= nx * (jImp / m2) * 1.6;
                ost.timeSincePush = 0;
                ost.returning = false;
                ost.x += nx * overlap * (m1 / totalM);
                ost.z += nz * overlap * (m1 / totalM);
              }
              elemAudio.playPropBump(other.g.position, clamp(relVn * 0.16, 0.18, 0.85), m2 > 2.3);
            }
          }
        }
      }

      st.x = nextX;
      st.z = nextZ;

      // Ground height & vertical bounce
      const nextGy = queryGroundSafeForProp(st, st.x, st.z, st.gy + Math.max(0, st.hopY) + 0.25);
      const worldFootY = st.gy + st.hopY;
      if (worldFootY > nextGy + 0.03) {
        st.hopY = worldFootY - nextGy;
        st.gy = nextGy;
      } else {
        st.gy = nextGy;
        if (st.vy < -1.2) {
          st.vy = -st.vy * clamp(0.32 / Math.sqrt(st.mass), 0.14, 0.34);
          st.hopY = 0.01;
          elemAudio.playPropBump(r.g.position, clamp(-st.vy * 0.18, 0.15, 0.7), st.mass > 2.3);
        } else {
          st.vy = 0;
          st.hopY = 0;
        }
      }

      // Air drag vs surface friction (~3.6)
      const damp = st.hopY > 0.03 ? Math.exp(-1.15 * dt) : Math.exp(-3.6 * dt);
      st.vx *= damp;
      st.vz *= damp;
      if (Math.abs(st.vx) < 0.015) st.vx = 0;
      if (Math.abs(st.vz) < 0.015) st.vz = 0;

      // Velocity tilt & spring-damper rocking wobble
      const targetTiltX = clamp(st.vz * 0.045, -0.36, 0.36) + eddyWobbleX;
      const targetTiltZ = clamp(-st.vx * 0.045, -0.36, 0.36) + eddyWobbleZ;
      st.tiltVelX += ((targetTiltX - st.tiltX) * 42 - st.tiltVelX * 7.2) * dt;
      st.tiltVelZ += ((targetTiltZ - st.tiltZ) * 42 - st.tiltVelZ * 7.2) * dt;
      st.tiltX = clamp(st.tiltX + st.tiltVelX * dt, -0.52, 0.52);
      st.tiltZ = clamp(st.tiltZ + st.tiltVelZ * dt, -0.52, 0.52);

      st.yawOff += st.yawVel * dt;
      st.yawVel *= Math.exp(-4.5 * dt);
      if (Math.abs(st.yawVel) < 0.01) st.yawVel = 0;
      if (st.hopY === 0 && Math.abs(st.tiltX) < 0.002 && Math.abs(st.tiltVelX) < 0.008 && eddyWobbleX === 0) {
        st.tiltX = 0;
        st.tiltVelX = 0;
      }
      if (st.hopY === 0 && Math.abs(st.tiltZ) < 0.002 && Math.abs(st.tiltVelZ) < 0.008 && eddyWobbleZ === 0) {
        st.tiltZ = 0;
        st.tiltVelZ = 0;
      }

      applyPropTransformAndCollider(st, st.gy + st.hopY);
    }
  }

  function updateFallbackCharKnockbacks(dt) {
    if (activeCharKnockbacks.size === 0) return;
    for (const [ch, kb] of activeCharKnockbacks.entries()) {
      kb.life -= dt;
      if (!ch || kb.life <= 0 || ch.userData?.actor?.eliminated) {
        activeCharKnockbacks.delete(ch);
        continue;
      }
      if (typeof env.moveChar === 'function') {
        env.moveChar(ch, kb.vx * dt, kb.vz * dt);
      }
      const damp = Math.exp(-7.5 * dt);
      kb.vx *= damp;
      kb.vz *= damp;
    }
  }

  function triggerHiderGustKnockback(victim, dir, force = 3.6) {
    if (!victim || victim.userData?.actor?.eliminated) return;
    const dx = dir?.x || 0;
    const dz = dir?.z || 0;
    const len = Math.hypot(dx, dz) || 1;
    _v1.set(dx / len, 0, dz / len);

    if (typeof env.applyAirKnockback === 'function') {
      env.applyAirKnockback(victim, _v1.clone(), force);
      return;
    }
    // Built-in smooth knockback fallback if main.js didn't supply applyAirKnockback
    const prev = activeCharKnockbacks.get(victim) || { vx: 0, vz: 0, life: 0 };
    prev.vx = clamp(prev.vx + _v1.x * force * 2.1, -11, 11);
    prev.vz = clamp(prev.vz + _v1.z * force * 2.1, -11, 11);
    prev.life = 0.34;
    activeCharKnockbacks.set(victim, prev);
    if (victim.userData && (victim.userData.jy || 0) < 0.05) {
      victim.userData.vy = Math.max(victim.userData.vy || 0, Math.min(3.2, force * 0.45));
      victim.userData.jy = Math.max(victim.userData.jy || 0, 0.04);
    }
  }

  // --------------------------------------------------------------------------
  // 3D Prop Snow Caps (Tracked for 30s Melt, Moves WITH Props When Pushed!)
  // --------------------------------------------------------------------------
  const propSnowCaps = new Map(); // propRec -> { rec, grp, mat, age, amount }

  function attachOrGrowPropSnowCap(propRec, addAmount = 0.22) {
    if (!propRec || !propRec.g) return;
    let entry = propSnowCaps.get(propRec);
    if (entry) {
      entry.amount = Math.min(1.2, entry.amount + addAmount);
      entry.age = Math.max(0, Math.min(entry.age, entry.age * 0.35 - 0.25));
      return entry;
    }

    const kitProps = typeof env.getKit === 'function' ? env.getKit()?.props : null;
    const propH = clamp((kitProps && kitProps[propRec.id]?.height) || 0.9, 0.32, 2.1);
    const propR = clamp(propRec.radius || 0.42, 0.18, 0.56);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMelt: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: SNOW_SPARKLE_VERT,
      fragmentShader: SNOW_SPARKLE_FRAG,
      transparent: true,
    });

    const grp = new THREE.Group();
    grp.name = 'prop_snow_cap';
    grp.position.set(0, propH * 0.92, 0);

    const mainCap = new THREE.Mesh(sharedGeos.snowDome, mat);
    mainCap.scale.set(propR * 0.62, propR * 0.20, propR * 0.62);
    grp.add(mainCap);

    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 + rand(-0.3, 0.3);
      const lobe = new THREE.Mesh(sharedGeos.snowDome, mat);
      const lr = propR * rand(0.28, 0.40);
      lobe.position.set(Math.cos(ang) * propR * 0.16, -propR * 0.015, Math.sin(ang) * propR * 0.16);
      lobe.scale.set(lr, lr * 0.26, lr);
      grp.add(lobe);
    }

    grp.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = true;
        m.userData.noSolid = true;
      }
    });

    propRec.g.add(grp);
    entry = { rec: propRec, grp, mat, age: 0, amount: clamp(0.45 + addAmount, 0.45, 1.2) };
    propSnowCaps.set(propRec, entry);
    return entry;
  }

  function updatePropSnowCaps(dt, nowSec) {
    if (propSnowCaps.size === 0) return;
    for (const [rec, cap] of propSnowCaps.entries()) {
      cap.age += dt;
      if (!rec?.g || cap.age >= PERSIST_DURATION) {
        if (cap.grp.parent) cap.grp.parent.remove(cap.grp);
        cap.mat.dispose();
        propSnowCaps.delete(rec);
        continue;
      }
      const fadeFrac = cap.age > PERSIST_FADE_START
        ? clamp((cap.age - PERSIST_FADE_START) / (PERSIST_DURATION - PERSIST_FADE_START), 0, 1)
        : 0;
      const popIn = smoothstep(0, 0.16, cap.age);
      const xzSc = popIn * (0.62 + cap.amount * 0.16) * (1 - fadeFrac * 0.62);
      const ySc = popIn * (0.52 + cap.amount * 0.22) * Math.pow(1 - fadeFrac, 1.65);
      cap.grp.scale.set(xzSc, Math.max(0.01, ySc), xzSc);
      cap.mat.uniforms.uTime.value = nowSec;
      cap.mat.uniforms.uMelt.value = fadeFrac;
      cap.mat.uniforms.uOpacity.value = 1 - Math.pow(fadeFrac, 2.2);
    }
  }

  // --------------------------------------------------------------------------
  // 30-Second Persistent World Patches (Fire, Water, Snow, Earth, Air)
  // --------------------------------------------------------------------------
  const patches = [];
  let patchSeq = 0;

  function computeSurfaceQuaternion(normal, randomSpin = true) {
    const q = new THREE.Quaternion();
    if (Math.abs(normal.y) < 0.85) {
      // Align local +Z to surface normal N, local +Y pointing uphill/vertical UP!
      const right = new THREE.Vector3().crossVectors(_up, normal);
      if (right.lengthSq() < 1e-5) right.set(1, 0, 0);
      else right.normalize();
      const surfUp = new THREE.Vector3().crossVectors(normal, right).normalize();
      _m4.makeBasis(right, surfUp, normal);
      q.setFromRotationMatrix(_m4);
    } else {
      q.setFromUnitVectors(_zAxis, normal);
      if (randomSpin) {
        _q2.setFromAxisAngle(normal, rand(0, Math.PI * 2));
        q.premultiply(_q2);
      }
    }
    return q;
  }

  function disposePatch(pt) {
    if (pt.root && scene) scene.remove(pt.root);
    for (const m of pt.ownedMats) {
      if (m && typeof m.dispose === 'function') m.dispose();
    }
  }

  function ensurePatchBudget() {
    const cap = getMaxPatches();
    while (patches.length >= cap) {
      // Prefer recycling oldest patch in 22..30s fade, otherwise oldest overall
      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < patches.length; i++) {
        const sc = patches[i].age + (patches[i].age >= PERSIST_FADE_START ? 50 : 0);
        if (sc > bestScore) {
          bestScore = sc;
          bestIdx = i;
        }
      }
      const old = patches.splice(bestIdx, 1)[0];
      disposePatch(old);
    }
  }

  function addSecondaryFireTongues(pt) {
    if (pt.hasSecondary || !pt.flameGrp || !pt.flameMat) return;
    pt.hasSecondary = true;
    const isWall = Math.abs(pt.normal.y) < 0.55;
    // Compute horizontal tangent along wall/ground
    const tang = new THREE.Vector3().crossVectors(_up, pt.normal);
    if (tang.lengthSq() < 1e-4) tang.set(1, 0, 0);
    else tang.normalize();

    for (const side of [-1, 1]) {
      const sub = new THREE.Group();
      const spread = side * rand(0.28, 0.48);
      const liftY = isWall ? rand(0.16, 0.44) : rand(0.0, 0.06);
      sub.position.set(
        tang.x * spread + (isWall ? pt.normal.x * 0.04 : rand(-0.14, 0.14)),
        liftY,
        tang.z * spread + (isWall ? pt.normal.z * 0.04 : rand(-0.14, 0.14))
      );
      for (let p = 0; p < 2; p++) {
        const card = new THREE.Mesh(sharedGeos.flameCard, pt.flameMat);
        card.rotation.y = p * (Math.PI * 0.5) + rand(-0.25, 0.25);
        card.scale.set(0.75, rand(0.72, 0.95), 0.75);
        card.renderOrder = 4;
        card.userData.noSolid = true;
        sub.add(card);
      }
      pt.flameGrp.add(sub);
    }
  }

  function spawnPatch(elemId, point, normal, isBomb = false) {
    if (!scene) return null;
    ensurePatchBudget();

    const seq = ++patchSeq;
    const seed = rand(0.5, 50.0);
    const isVertical = Math.abs(normal.y) < 0.48;
    const root = new THREE.Group();
    root.name = `elem_patch_${elemId}_${seq}`;
    const ownedMats = [];

    const surfOffset = 0.025 + (seq % 13) * 0.0011;
    const surfPos = new THREE.Vector3(
      point.x + normal.x * surfOffset,
      point.y + normal.y * surfOffset,
      point.z + normal.z * surfOffset
    );
    const surfQuat = computeSurfaceQuaternion(normal, !isVertical);

    const pt = {
      id: seq,
      elemId,
      x: point.x,
      y: point.y,
      z: point.z,
      normal: normal.clone(),
      isVertical,
      age: 0,
      seed,
      intensity: isBomb ? 1.45 : 0.85,
      maxIntensity: isBomb ? 1.75 : 1.32,
      radius: 0.08,
      targetRadius: isBomb ? 0.85 : (elemId === 'water' ? rand(0.48, 0.64) : rand(0.21, 0.29)),
      maxRadius: isBomb ? 1.05 : (elemId === 'water' ? 0.92 : 0.45),
      fromHiderSoap: false,
      rippleBoost: 1.0,
      emitTimer: rand(0.02, 0.14),
      dripFeedTimer: 0.35,
      hasSecondary: false,
      root,
      ownedMats,
    };

    if (elemId === 'fire') {
      // 1. Flush Charred Scorch & Glowing Ember-Crack Patch on wall/roof/ground
      const scorchMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uOpacity: { value: 1 },
          uEmberGlow: { value: 1 },
        },
        vertexShader: FIRE_SCORCH_VERT,
        fragmentShader: FIRE_SCORCH_FRAG,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      ownedMats.push(scorchMat);

      const scorchMesh = new THREE.Mesh(sharedGeos.planeXY, scorchMat);
      scorchMesh.position.copy(surfPos);
      scorchMesh.quaternion.copy(surfQuat);
      scorchMesh.renderOrder = 2;
      scorchMesh.userData.noSolid = true;
      root.add(scorchMesh);

      // 2. World-space Multi-Plane Volumetric-Look Flames ALWAYS licking upward in +Y!
      const flameMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uIntensity: { value: pt.intensity },
          uOpacity: { value: 1 },
          uSmolder: { value: 0 },
        },
        vertexShader: FIRE_FLAME_VERT,
        fragmentShader: FIRE_FLAME_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      ownedMats.push(flameMat);

      const flameGrp = new THREE.Group();
      flameGrp.position.set(
        point.x + normal.x * (isVertical ? 0.15 : 0.02),
        point.y + (isVertical ? -0.08 : 0.01),
        point.z + normal.z * (isVertical ? 0.15 : 0.02)
      );
      for (let k = 0; k < 3; k++) {
        const card = new THREE.Mesh(sharedGeos.flameCard, flameMat);
        card.rotation.y = (k * Math.PI) / 3 + rand(-0.12, 0.12);
        if (isVertical) {
          // Slight outward + upward facade lick when burning a vertical building wall
          card.rotation.z = rand(-0.08, 0.08);
        }
        card.renderOrder = 4;
        card.userData.noSolid = true;
        flameGrp.add(card);
      }
      root.add(flameGrp);

      pt.scorchMesh = scorchMesh;
      pt.scorchMat = scorchMat;
      pt.flameGrp = flameGrp;
      pt.flameMat = flameMat;
      if (pt.intensity >= 1.8) addSecondaryFireTongues(pt);
    } else if (elemId === 'water') {
      const isWallWater = Math.abs(normal.y) < 0.45;
      pt.isWallWater = isWallWater;

      if (isWallWater) {
        const streakMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uSeed: { value: seed },
            uOpacity: { value: 1 },
          },
          vertexShader: WATER_PUDDLE_VERT,
          fragmentShader: WATER_STREAK_FRAG,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        ownedMats.push(streakMat);
        const streakMesh = new THREE.Mesh(sharedGeos.planeXY, streakMat);
        streakMesh.position.set(surfPos.x, surfPos.y - 0.18, surfPos.z);
        streakMesh.quaternion.copy(surfQuat);
        streakMesh.renderOrder = 2;
        streakMesh.userData.noSolid = true;
        root.add(streakMesh);
        pt.decalMesh = streakMesh;
        pt.puddleMat = streakMat;
      } else {
        const puddleMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uSeed: { value: seed },
            uOpacity: { value: 1 },
            uEvap: { value: 0 },
            uRippleBoost: { value: 1 },
          },
          vertexShader: WATER_PUDDLE_VERT,
          fragmentShader: WATER_PUDDLE_FRAG,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        ownedMats.push(puddleMat);
        const puddleMesh = new THREE.Mesh(sharedGeos.planeXY, puddleMat);
        puddleMesh.position.copy(surfPos);
        puddleMesh.quaternion.copy(surfQuat);
        puddleMesh.renderOrder = 2;
        puddleMesh.userData.noSolid = true;
        root.add(puddleMesh);
        pt.decalMesh = puddleMesh;
        pt.puddleMat = puddleMat;
      }
    } else if (elemId === 'snow') {
      const snowMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uMelt: { value: 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: SNOW_SPARKLE_VERT,
        fragmentShader: SNOW_SPARKLE_FRAG,
        transparent: true,
      });
      ownedMats.push(snowMat);
      pt.snowMat = snowMat;

      if (isVertical) {
        // Crystalline wall frost rime patch + 2-4 downward-pointing 3D translucent icicles!
        const frostGrp = new THREE.Group();
        frostGrp.position.copy(surfPos);
        frostGrp.quaternion.copy(surfQuat);
        const rimeCenter = new THREE.Mesh(sharedGeos.snowDome, snowMat);
        rimeCenter.rotation.x = Math.PI / 2;
        rimeCenter.scale.set(0.85, 0.24, 0.72);
        frostGrp.add(rimeCenter);
        for (let i = 0; i < 3; i++) {
          const ang = (i * Math.PI * 2) / 3 + rand(-0.4, 0.4);
          const puff = new THREE.Mesh(sharedGeos.snowDome, snowMat);
          puff.rotation.x = Math.PI / 2;
          puff.position.set(Math.cos(ang) * 0.26, Math.sin(ang) * 0.2, 0);
          puff.scale.set(0.52, 0.18, 0.48);
          frostGrp.add(puff);
        }
        root.add(frostGrp);

        // Downward-pointing 3D icicles in world space (-Y)
        const icicleGrp = new THREE.Group();
        icicleGrp.position.set(
          point.x + normal.x * 0.08,
          point.y - 0.06,
          point.z + normal.z * 0.08
        );
        const tang = new THREE.Vector3().crossVectors(_up, normal);
        if (tang.lengthSq() < 1e-4) tang.set(1, 0, 0);
        else tang.normalize();
        const icicleCount = isBomb ? 4 : Math.floor(rand(2, 4.9));
        for (let i = 0; i < icicleCount; i++) {
          const ic = new THREE.Mesh(sharedGeos.icicleCone, sharedMats.icicleMat);
          const off = (i - (icicleCount - 1) * 0.5) * 0.16 + rand(-0.03, 0.03);
          ic.position.set(tang.x * off, rand(-0.04, 0.06), tang.z * off);
          const lenSc = rand(0.65, 1.28) * (isBomb ? 1.35 : 1.0);
          ic.scale.set(rand(0.75, 1.15), lenSc, rand(0.75, 1.15));
          icicleGrp.add(ic);
        }
        root.add(icicleGrp);
        pt.moundGrp = frostGrp;
        pt.icicleGrp = icicleGrp;
      } else {
        // 3D Sculpted Lumpy Snowdrift on ground / roofs / stairs / ledges!
        const moundGrp = new THREE.Group();
        moundGrp.position.set(point.x, point.y - 0.015, point.z);
        // Align slightly with roof slope if pitched roof, else world up
        _q1.setFromUnitVectors(_up, normal);
        moundGrp.quaternion.copy(_q1);
        moundGrp.rotateY(rand(0, Math.PI * 2));

        const mainDome = new THREE.Mesh(sharedGeos.snowDome, snowMat);
        mainDome.scale.set(1.35, 0.42, 1.28);
        moundGrp.add(mainDome);

        const subCount = isBomb ? 6 : 4;
        for (let i = 0; i < subCount; i++) {
          const ang = (i / subCount) * Math.PI * 2 + rand(-0.3, 0.3);
          const dist = rand(0.28, 0.52);
          const sub = new THREE.Mesh(sharedGeos.snowDome, snowMat);
          const sr = rand(0.65, 1.05);
          sub.position.set(Math.cos(ang) * dist, -0.01, Math.sin(ang) * dist);
          sub.scale.set(sr, sr * rand(0.28, 0.44), sr * rand(0.85, 1.15));
          moundGrp.add(sub);
        }

        if (isBomb) {
          // Radial Boreal ice-crystal spikes for Snow Bomb!
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + 0.2;
            const spike = new THREE.Mesh(sharedGeos.icicleCone, sharedMats.icicleMat);
            spike.rotation.z = Math.PI + Math.cos(ang) * 0.42;
            spike.rotation.x = Math.sin(ang) * 0.42;
            spike.position.set(Math.cos(ang) * 0.42, 0.02, Math.sin(ang) * 0.42);
            spike.scale.set(1.25, 1.15, 1.25);
            moundGrp.add(spike);
          }
        }
        root.add(moundGrp);
        pt.moundGrp = moundGrp;
      }
    } else if (elemId === 'earth') {
      // 1. Cracked-Earth Fissure Ring flush to surface
      const crackMat = new THREE.ShaderMaterial({
        uniforms: {
          uSeed: { value: seed },
          uOpacity: { value: 1 },
        },
        vertexShader: FIRE_SCORCH_VERT,
        fragmentShader: EARTH_CRACK_FRAG,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      ownedMats.push(crackMat);

      const crackMesh = new THREE.Mesh(sharedGeos.planeXY, crackMat);
      crackMesh.position.copy(surfPos);
      crackMesh.quaternion.copy(surfQuat);
      crackMesh.renderOrder = 2;
      crackMesh.userData.noSolid = true;
      root.add(crackMesh);

      // 2. 3D Earthen Dirt Berm + Jagged Basalt/Granite Rock Spires
      const rockGrp = new THREE.Group();
      rockGrp.position.copy(point);
      _q1.setFromUnitVectors(_up, normal);
      rockGrp.quaternion.copy(_q1);
      rockGrp.rotateY(rand(0, Math.PI * 2));

      const berm = new THREE.Mesh(sharedGeos.soilBerm, sharedMats.soilMat);
      berm.scale.set(1.15, 1.15, 0.65);
      berm.position.y = 0.03;
      rockGrp.add(berm);

      const spireCount = isBomb ? 5 : 3;
      const rockMats = [sharedMats.rockA, sharedMats.rockB, sharedMats.rockDark];
      for (let i = 0; i < spireCount; i++) {
        const isCenter = i === 0 && !isBomb;
        const ang = (i / Math.max(1, spireCount)) * Math.PI * 2 + rand(-0.28, 0.28);
        const rad = isCenter ? rand(0, 0.04) : (isBomb ? rand(0.14, 0.28) : rand(0.07, 0.15));
        const spire = new THREE.Mesh(
          i % 2 === 0 ? sharedGeos.rockSpire : sharedGeos.boulderChunk,
          rockMats[i % rockMats.length]
        );
        if (i % 2 === 0) {
          const hSc = (isCenter ? rand(0.75, 1.0) : rand(0.5, 0.82)) * (isBomb ? 1.15 : 1.0);
          const wSc = rand(0.65, 0.95);
          spire.position.set(Math.cos(ang) * rad, -0.02, Math.sin(ang) * rad);
          spire.scale.set(wSc, hSc, wSc * rand(0.8, 1.15));
          spire.rotation.set(Math.sin(ang) * 0.24, rand(0, 6.28), -Math.cos(ang) * 0.24);
        } else {
          const cr = rand(0.055, 0.095) * (isBomb ? 1.2 : 1.0);
          spire.position.set(Math.cos(ang) * (rad + 0.04), cr * 0.42, Math.sin(ang) * (rad + 0.04));
          spire.scale.set(cr * 1.18, cr * 0.82, cr);
          spire.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
        }
        rockGrp.add(spire);
      }
      root.add(rockGrp);

      pt.crackMesh = crackMesh;
      pt.crackMat = crackMat;
      pt.rockGrp = rockGrp;
    } else if (elemId === 'air') {
      // Compact 4-Second Swirling Ground Breeze Ribbons + Petite Orbiting Leaves
      const vortexMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uOpacity: { value: 1 },
        },
        vertexShader: AIR_VORTEX_VERT,
        fragmentShader: AIR_VORTEX_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      ownedMats.push(vortexMat);

      const eddyGrp = new THREE.Group();
      const gy = typeof env.groundHeightAt === 'function'
        ? env.groundHeightAt(point.x, point.z, point.y + 0.35)
        : point.y;
      eddyGrp.position.set(point.x, isVertical ? point.y - 0.16 : gy + 0.015, point.z);

      const outerFunnel = new THREE.Mesh(sharedGeos.vortexFunnel, vortexMat);
      outerFunnel.renderOrder = 4;
      const innerFunnel = new THREE.Mesh(sharedGeos.vortexFunnel, vortexMat);
      innerFunnel.scale.set(0.58, 0.84, 0.58);
      innerFunnel.rotation.y = 2.1;
      innerFunnel.renderOrder = 4;
      eddyGrp.add(outerFunnel, innerFunnel);

      const leafCount = isBomb ? 5 : 3;
      const leafMats = [sharedMats.leafGreen, sharedMats.leafSakura, sharedMats.leafGold];
      const leaves = [];
      for (let i = 0; i < leafCount; i++) {
        const lf = new THREE.Mesh(sharedGeos.leafQuad, leafMats[i % leafMats.length]);
        lf.renderOrder = 4;
        eddyGrp.add(lf);
        leaves.push({
          mesh: lf,
          baseAng: (i / leafCount) * Math.PI * 2,
          omega: rand(5.2, 8.4),
          baseR: rand(0.09, 0.22),
          yPhase: rand(0, 1),
          ySpd: rand(0.45, 0.82),
          spinX: rand(4, 9),
          spinZ: rand(4, 9),
        });
      }
      root.add(eddyGrp);

      pt.eddyGrp = eddyGrp;
      pt.vortexMat = vortexMat;
      pt.leaves = leaves;
    }

    root.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = false;
        m.userData.noSolid = true;
      }
    });
    scene.add(root);
    patches.push(pt);
    return pt;
  }

  function findCoalescentPatch(elemId, point, normal, radiusOverride = 0.95) {
    let best = null;
    let bestDist = radiusOverride;
    for (let i = 0; i < patches.length; i++) {
      const pt = patches[i];
      if (pt.elemId !== elemId || pt.age >= 24.0) continue;
      if (pt.normal.dot(normal) <= 0.65) continue;
      const reach = Math.max(bestDist, pt.targetRadius * 0.62);
      const d = Math.hypot(pt.x - point.x, pt.y - point.y, pt.z - point.z);
      if (d < reach && d < bestDist + 0.45) {
        best = pt;
        bestDist = d;
      }
    }
    return best;
  }

  function reinforcePatch(pt, isBomb = false) {
    const boostInt = isBomb ? 0.55 : 0.07;
    const boostRad = isBomb ? 0.18 : (pt.elemId === 'water' ? 0.032 : 0.024);
    pt.intensity = Math.min(pt.maxIntensity, pt.intensity + boostInt);
    pt.targetRadius = Math.min(pt.maxRadius, pt.targetRadius + boostRad);
    // Smoothly refresh age without ever exceeding 4.0s from last reinforcement!
    pt.age = Math.max(0, Math.min(pt.age, pt.age * 0.35 - 0.35));
    pt.rippleBoost = 1.0;
  }

  // --------------------------------------------------------------------------
  // World Impacts, Character Impacts & Splash Bomb Detonation
  // --------------------------------------------------------------------------
  function findNearestPropAt(point, hitObject, extraReach = 0.25) {
    if (hitObject?.userData?.propRoot) return hitObject.userData.propRoot;
    const realProps = env.realProps;
    if (!realProps || !realProps.length) return null;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < realProps.length; i++) {
      const r = realProps[i];
      if (!r || !r.g) continue;
      const dx = r.g.position.x - point.x;
      const dz = r.g.position.z - point.z;
      const dy = (r.g.position.y + 0.45) - point.y;
      const d = Math.hypot(dx, dz);
      if (d <= (r.radius || 0.45) + extraReach && Math.abs(dy) < 1.15 && d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  function resolveWorldNormal(opts) {
    const out = new THREE.Vector3(0, 1, 0);
    if (opts?.normal) {
      out.set(opts.normal.x ?? 0, opts.normal.y ?? 1, opts.normal.z ?? 0);
      if (out.lengthSq() > 1e-6) out.normalize();
      else out.set(0, 1, 0);
    } else if (opts?.face?.normal && opts?.hitObject?.matrixWorld) {
      out.copy(opts.face.normal).transformDirection(opts.hitObject.matrixWorld).normalize();
    }
    if (opts?.dir) {
      const dd = out.x * opts.dir.x + out.y * opts.dir.y + out.z * opts.dir.z;
      if (dd > 0.35) out.negate();
    }
    return out;
  }

  function onWorldImpact(opts = {}) {
    const point = opts.point;
    if (!point) return null;
    const elemId = opts.elemId && ELEMENTAL_GUN_SPECS[opts.elemId]
      ? opts.elemId
      : getSeekerElement(opts.shooter);
    const isBomb = !!opts.isBomb;
    const normal = resolveWorldNormal(opts);
    const hitProp = findNearestPropAt(point, opts.hitObject, 0.24);

    elemAudio.playImpact(elemId, point, isBomb);

    // 1. Element-specific immediate physical interactions & compact burst particles
    if (elemId === 'snow' && hitProp) {
      attachOrGrowPropSnowCap(hitProp, isBomb ? 0.55 : 0.20);
    }

    if (elemId === 'earth') {
      spawnPhysicsRocks(point, normal, isBomb ? 5 : 2, isBomb);
      for (let i = 0; i < (isBomb ? 4 : 1); i++) {
        emitParticle(
          point.x + rand(-0.09, 0.09),
          point.y + 0.05,
          point.z + rand(-0.09, 0.09),
          rand(-0.65, 0.65),
          rand(0.35, 0.95),
          rand(-0.65, 0.65),
          0.62, 0.50, 0.36,
          isBomb ? 0.14 : 0.085,
          0.55,
          0,
          -1.2
        );
      }
    } else if (elemId === 'fire') {
      for (let i = 0; i < (isBomb ? 5 : 2); i++) {
        emitParticle(
          point.x + normal.x * 0.06 + rand(-0.07, 0.07),
          point.y + 0.07,
          point.z + normal.z * 0.06 + rand(-0.07, 0.07),
          rand(-0.95, 0.95),
          rand(0.85, 2.0),
          rand(-0.95, 0.95),
          1.0, rand(0.45, 0.78), 0.12,
          rand(0.04, 0.075),
          rand(0.38, 0.72),
          1,
          -1.8
        );
      }
    } else if (elemId === 'snow') {
      for (let i = 0; i < (isBomb ? 5 : 2); i++) {
        emitParticle(
          point.x + rand(-0.11, 0.11),
          point.y + 0.08,
          point.z + rand(-0.11, 0.11),
          rand(-0.55, 0.55),
          rand(0.3, 0.95),
          rand(-0.55, 0.55),
          0.86, 0.96, 1.0,
          rand(0.055, 0.095),
          rand(0.48, 0.88),
          2,
          -1.1
        );
      }
    } else if (elemId === 'air') {
      // Real Prop Physics on realProps + loose Earth pebbles + Decoys + close Hider gust!
      const dirVec = opts.dir
        ? _v2.set(opts.dir.x, 0, opts.dir.z).normalize()
        : null;
      if (hitProp) {
        const px = dirVec ? dirVec.x : (hitProp.g.position.x - point.x);
        const pz = dirVec ? dirVec.z : (hitProp.g.position.z - point.z);
        const plen = Math.hypot(px, pz) || 1;
        impulseProp(hitProp, px / plen, pz / plen, isBomb ? 11.5 : 6.8, isBomb ? 4.1 : 2.65);
      }
      pushPropsInRadius(point, isBomb ? 4.8 : 2.25, isBomb ? 11.2 : 6.2, dirVec, isBomb);
      impulseLooseRocksNear(
        point.x, point.y, point.z,
        isBomb ? 4.8 : 1.75,
        (dirVec?.x || 0) * 4.5,
        (dirVec?.z || 0) * 4.5,
        isBomb ? 3.2 : 1.8
      );

      // Pop or jostle Hider Decoy Clones caught in the wind gust
      const ht = env.hiderTricks || (typeof env.getHiderTricks === 'function' ? env.getHiderTricks() : null);
      if (ht && typeof ht.triggerSplashArea === 'function') {
        ht.triggerSplashArea(point, isBomb ? 4.2 : 1.35, opts.shooter);
      }

      // Gentle gust knockback on Hiders standing right next to an Air impact
      const allHiders = env.G?.allHiders || [];
      const gustRad = isBomb ? 4.4 : 1.45;
      for (let i = 0; i < allHiders.length; i++) {
        const h = allHiders[i];
        if (!h || h.userData?.actor?.eliminated) continue;
        const dx = h.position.x - point.x;
        const dz = h.position.z - point.z;
        const dy = (h.position.y || 0) - point.y;
        const d = Math.hypot(dx, dz);
        if (d < gustRad && Math.abs(dy) < 1.8) {
          const kDir = d > 0.15 ? { x: dx / d, z: dz / d } : (dirVec || { x: 0, z: 1 });
          const fall = clamp(1 - d / (gustRad + 0.4), 0.35, 1.0);
          triggerHiderGustKnockback(h, kDir, (isBomb ? 8.2 : 2.8) * fall);
        }
      }
    }

    // 2. Spawn or Coalesce Compact 4-Second World Patch
    if (hitProp && elemId !== 'water' && elemId !== 'air') {
      if (elemId === 'snow') return null; // Already grew 3D snow cap directly on hitProp.g!
      const gy = typeof env.groundHeightAt === 'function'
        ? env.groundHeightAt(point.x, point.z, point.y + 0.3)
        : 0;
      _v3.set(point.x, gy, point.z);
      const nearGround = findCoalescentPatch(elemId, _v3, _up, 0.85);
      if (nearGround) {
        reinforcePatch(nearGround, isBomb);
        return nearGround;
      }
      return spawnPatch(elemId, _v3, _up, isBomb);
    }

    const coalesceR = isBomb ? 1.25 : (elemId === 'air' ? 1.55 : 0.82);
    const existing = findCoalescentPatch(elemId, point, normal, coalesceR);
    if (existing) {
      reinforcePatch(existing, isBomb);
      return existing;
    }
    return spawnPatch(elemId, point, normal, isBomb);
  }

  // --------------------------------------------------------------------------
  // Elemental Combat Status Engine (Water Skid, Rock Slow, Fire Burn DoT,
  // Snow Chill -> 3D Crystal Freeze, Air Lose-Control Wind Turbulence)
  // --------------------------------------------------------------------------
  const statusMap = new Map();
  let statusHudEl = null;
  let lastStatusHudSig = '';
  let sharedFreezeShellGeo = null;
  let sharedFreezeShellMat = null;

  function ensureStatus(ch) {
    let st = statusMap.get(ch);
    if (!st) {
      st = {
        rockSlowTimer: 0,
        burnTimer: 0,
        burnTickAcc: 0,
        burnAttacker: null,
        chillStacks: 0,
        chillTimer: 0,
        freezeTimer: 0,
        freezeImmuneUntil: 0,
        freezeShell: null,
        airChaosTimer: 0,
        airPhase: 0,
        airSeed: rand(0, 6.28),
        airCrossX: 0,
        airCrossZ: 0,
        slipTimer: 0,
        slipVx: 0,
        slipVz: 0,
        lastX: ch?.position?.x || 0,
        lastZ: ch?.position?.z || 0,
        hasLastPos: false,
        vfxTimer: 0,
      };
      statusMap.set(ch, st);
    }
    return st;
  }

  function attachFreezeCrystalShell(ch, st) {
    if (env.externalStatusFx) return;   // status_fx.js draws the ice block (sized to the target, pop-in, tremble, shatter)
    if (!ch || !THREE || st.freezeShell) return;
    if (!sharedFreezeShellGeo) {
      sharedFreezeShellGeo = new THREE.OctahedronGeometry(0.62, 0);
    }
    if (!sharedFreezeShellMat) {
      sharedFreezeShellMat = new THREE.MeshStandardMaterial({
        color: 0xa8ecff,
        emissive: 0x3b8ec9,
        emissiveIntensity: 0.25,
        roughness: 0.28,
        metalness: 0,
        transparent: true,
        opacity: 0.56,
        flatShading: true,
      });
    }
    const shell = new THREE.Mesh(sharedFreezeShellGeo, sharedFreezeShellMat);
    shell.position.set(0, 0.62, 0);
    shell.scale.set(0.92, 1.28, 0.92);
    shell.userData.noSolid = true;
    ch.add(shell);
    st.freezeShell = shell;
  }

  function removeFreezeCrystalShell(ch, st, shatterVfx = false) {
    if (!st || !st.freezeShell) return;
    if (st.freezeShell.parent) st.freezeShell.parent.remove(st.freezeShell);
    st.freezeShell = null;
    if (shatterVfx && ch) {
      const px = ch.position.x;
      const py = (ch.position.y || 0) + 0.65;
      const pz = ch.position.z;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        emitParticle(
          px + Math.cos(a) * 0.22, py + rand(-0.15, 0.25), pz + Math.sin(a) * 0.22,
          Math.cos(a) * 1.9, rand(0.6, 1.8), Math.sin(a) * 1.9,
          0.78, 0.95, 1.0, rand(0.065, 0.11), 0.55, 2, -2.5
        );
      }
    }
  }

  function cleanseCharacterDebuffs(ch, onlyBurn = false) {
    if (!ch) return false;
    const st = statusMap.get(ch);
    if (!st) return false;
    let cleansed = false;
    if (st.burnTimer > 0) {
      st.burnTimer = 0;
      st.burnTickAcc = 0;
      cleansed = true;
      const px = ch.position.x, py = (ch.position.y || 0) + 0.65, pz = ch.position.z;
      for (let i = 0; i < 4; i++) {
        emitParticle(
          px + rand(-0.16, 0.16), py + rand(-0.1, 0.18), pz + rand(-0.16, 0.16),
          rand(-0.35, 0.35), rand(0.65, 1.3), rand(-0.35, 0.35),
          0.92, 0.95, 0.98, 0.12, 0.55, 0, 0.15
        );
      }
    }
    if (!onlyBurn) {
      if (st.rockSlowTimer > 0 || st.chillStacks > 0 || st.freezeTimer > 0 || st.airChaosTimer > 0 || st.slipTimer > 0) {
        cleansed = true;
      }
      st.rockSlowTimer = 0;
      st.chillStacks = 0;
      st.chillTimer = 0;
      st.freezeTimer = 0;
      removeFreezeCrystalShell(ch, st, false);
      st.airChaosTimer = 0;
      st.slipTimer = 0;
      st.slipVx = 0;
      st.slipVz = 0;
    }
    return cleansed;
  }

  function spawnSlipperyPuddleAt(point, customRadius = 0.92, fromHiderSoap = false) {
    if (!point) return null;
    const gy = typeof env.groundHeightAt === 'function'
      ? env.groundHeightAt(point.x, point.z, (point.y ?? 0) + 0.6)
      : (point.y || 0);
    const p = spawnPatch('water', new THREE.Vector3(point.x, gy, point.z), _up, true);
    if (p) {
      p.targetRadius = customRadius;
      p.maxRadius = Math.max(1.15, customRadius + 0.15);
      p.radius = customRadius * 0.65;
      p.fromHiderSoap = !!fromHiderSoap;
    }
    return p;
  }

  function isCharacterStandingInWaterPuddle(ch, forSeeker = false) {
    if (!ch || !ch.position) return { inWater: false, puddle: null };
    const u = ch.userData || {};
    const x = ch.position.x;
    const y = (u.groundY ?? ch.position.y ?? 0) + (u.jy || 0);
    const z = ch.position.z;
    for (let i = 0; i < patches.length; i++) {
      const pt = patches[i];
      if (pt.elemId !== 'water' || pt.isWallWater || pt.age >= PERSIST_DURATION - 0.15) continue;
      if (forSeeker && !pt.fromHiderSoap) continue;
      if (!forSeeker && pt.fromHiderSoap) continue;
      const effR = Math.max(0.58, pt.radius * 1.48);
      if (Math.abs(y - pt.y) < 0.65 && Math.hypot(x - pt.x, z - pt.z) <= effR) {
        return { inWater: true, puddle: pt };
      }
    }
    if (!forSeeker && Array.isArray(env.puddles)) {
      for (let i = 0; i < env.puddles.length; i++) {
        const pd = env.puddles[i];
        if (!pd || pd.life <= 0.15 || !pd.m?.position) continue;
        const pr = Math.max(0.58, (pd.s || 0.65) * 0.95);
        if (Math.abs(y - pd.m.position.y) < 0.65 && Math.hypot(x - pd.m.position.x, z - pd.m.position.z) <= pr) {
          return { inWater: true, puddle: pd };
        }
      }
    }
    return { inWater: false, puddle: null };
  }

  function isAnyWaterExtinguishing(ch) {
    if (!ch) return false;
    const u = ch.userData || {};
    if (u.swimming || u.specialMode === 'tub') return true;
    const x = ch.position.x;
    const y = (u.groundY ?? ch.position.y ?? 0) + (u.jy || 0);
    const z = ch.position.z;
    for (let i = 0; i < patches.length; i++) {
      const pt = patches[i];
      if (pt.elemId !== 'water' || pt.isWallWater) continue;
      if (Math.abs(y - pt.y) < 0.7 && Math.hypot(x - pt.x, z - pt.z) <= Math.max(0.6, pt.radius * 1.5)) {
        return true;
      }
    }
    return false;
  }

  function getCharacterSpeedMultiplier(ch) {
    if (!ch) return 1.0;
    const st = statusMap.get(ch);
    if (!st) return 1.0;
    if (st.freezeTimer > 0) return 0.0;
    let mul = 1.0;
    if (st.rockSlowTimer > 0) mul *= 0.65; // -35% Heavy Rock Slow
    if (st.chillStacks > 0) mul *= Math.max(0.62, 1.0 - 0.10 * st.chillStacks); // -10% per Snow Chill stack
    return mul;
  }

  function getHiderJumpMultiplier(ch) {
    if (!ch) return 1.0;
    const st = statusMap.get(ch);
    if (!st) return 1.0;
    if (st.freezeTimer > 0) return 0.0;
    if (st.rockSlowTimer > 0) return 0.78; // -22% jump power while boulder-weighed
    return 1.0;
  }

  function getSteeringWobbleRad(ch) {
    if (!ch) return 0.0;
    const st = statusMap.get(ch);
    if (!st || st.airChaosTimer <= 0) return 0.0;
    const fade = Math.min(1.0, st.airChaosTimer / 0.35);
    return (Math.sin(st.airPhase * 11.2 + st.airSeed) * 1.05 + Math.cos(st.airPhase * 6.4) * 0.42) * fade;
  }

  function getCharacterStatusSummary(ch) {
    const st = ch ? statusMap.get(ch) : null;
    if (!st) {
      return {
        slipping: false,
        slipTimer: 0,
        slowed: false,
        rockSlowTimer: 0,
        burning: false,
        burnTimer: 0,
        burnSec: 0,
        frozen: false,
        freezeTimer: 0,
        chillStacks: 0,
        airChaos: false,
        airChaosTimer: 0,
        speedMul: 1.0,
        jumpMul: 1.0,
        wobbleRad: 0.0,
      };
    }
    return {
      slipping: st.slipTimer > 0.06,
      slipTimer: st.slipTimer,
      slowed: st.rockSlowTimer > 0,
      rockSlowTimer: st.rockSlowTimer,
      burning: st.burnTimer > 0,
      burnTimer: st.burnTimer,
      burnSec: st.burnTimer,
      frozen: st.freezeTimer > 0,
      freezeTimer: st.freezeTimer,
      chillStacks: st.chillStacks,
      airChaos: st.airChaosTimer > 0,
      airChaosTimer: st.airChaosTimer,
      speedMul: getCharacterSpeedMultiplier(ch),
      jumpMul: getHiderJumpMultiplier(ch),
      wobbleRad: getSteeringWobbleRad(ch),
    };
  }

  function onCharacterImpact(opts = {}) {
    const victim = opts.victim;
    if (!victim) return;
    const elemId = opts.elemId && ELEMENTAL_GUN_SPECS[opts.elemId]
      ? opts.elemId
      : getSeekerElement(opts.shooter);
    const isBomb = !!opts.isBomb;
    const pt = opts.point || (typeof env.centerOf === 'function'
      ? env.centerOf(victim)
      : new THREE.Vector3(victim.position.x, (victim.position.y || 0) + 0.75, victim.position.z));

    elemAudio.playImpact(elemId, pt, isBomb);

    const shooterPerk = opts.shooter && typeof env.getSeekerPerk === 'function'
      ? env.getSeekerPerk(opts.shooter)
      : 'none';
    const durMul = shooterPerk === 'elem_overdrive' ? 1.30 : 1.0;
    const st = ensureStatus(victim);
    const nowMs = typeof env.now === 'function' ? env.now() : (typeof performance !== 'undefined' ? performance.now() : 0);
    const isLocalShooter = !!(env.G && opts.shooter && opts.shooter === env.G.player);

    if (elemId === 'water') {
      // Spawn a slick ground puddle directly beneath the splashed Hider + kick off hydroplane slide!
      const gy = typeof env.groundHeightAt === 'function'
        ? env.groundHeightAt(victim.position.x, victim.position.z, (victim.position.y || 0) + 0.5)
        : (victim.position.y || 0);
      const footPt = new THREE.Vector3(victim.position.x, gy, victim.position.z);
      const nearPuddle = findCoalescentPatch('water', footPt, _up, 0.85);
      if (nearPuddle) reinforcePatch(nearPuddle, isBomb);
      else spawnPatch('water', footPt, _up, isBomb);

      const hiderPerk = typeof env.getHiderPerk === 'function' ? env.getHiderPerk(victim) : 'none';
      if (hiderPerk !== 'grove_sovereign') {
        st.slipTimer = Math.max(st.slipTimer, 0.95 * durMul);
        const sDir = opts.dir
          ? { x: opts.dir.x, z: opts.dir.z }
          : (opts.shooter
              ? { x: victim.position.x - opts.shooter.position.x, z: victim.position.z - opts.shooter.position.z }
              : { x: 0, z: 1 });
        const slen = Math.hypot(sDir.x, sDir.z) || 1;
        st.slipVx = st.slipVx * 0.55 + (sDir.x / slen) * (isBomb ? 3.2 : 1.85);
        st.slipVz = st.slipVz * 0.55 + (sDir.z / slen) * (isBomb ? 3.2 : 1.85);
      }
    } else if (elemId === 'fire') {
      if (!isAnyWaterExtinguishing(victim)) {
        const wasBurning = st.burnTimer > 0.2;
        st.burnTimer = Math.max(st.burnTimer, (isBomb ? 3.8 : 3.0) * durMul);
        st.burnAttacker = opts.shooter || st.burnAttacker;
        if (!wasBurning && isLocalShooter && typeof env.hint === 'function') {
          env.hint('🔥 Ignited! Burning over time!', 950);
        }
      }
      for (let i = 0; i < 4; i++) {
        emitParticle(
          pt.x + rand(-0.12, 0.12), pt.y + rand(-0.08, 0.14), pt.z + rand(-0.12, 0.12),
          rand(-1.2, 1.2), rand(0.9, 2.2), rand(-1.2, 1.2),
          1.0, rand(0.42, 0.82), 0.12, rand(0.045, 0.085), rand(0.35, 0.65), 1, -2.0
        );
      }
      emitParticle(pt.x, pt.y + 0.12, pt.z, 0, 0.8, 0, 0.24, 0.21, 0.20, 0.14, 0.55, 0, 0.2);
    } else if (elemId === 'snow') {
      if (st.freezeTimer <= 0) {
        st.chillStacks = Math.min(4, st.chillStacks + (isBomb ? 3 : 1));
        st.chillTimer = 2.4 * durMul;
        if (st.chillStacks >= 4 && nowMs >= st.freezeImmuneUntil) {
          st.chillStacks = 0;
          st.chillTimer = 0;
          st.freezeTimer = FREEZE_SEC * durMul;
          st.freezeImmuneUntil = nowMs + 4200;
          attachFreezeCrystalShell(victim, st);
          if (isLocalShooter && typeof env.hint === 'function') {
            env.hint(`❄️ FROST SNARE! Target Frozen (${(FREEZE_SEC * durMul).toFixed(1)}s)!`, 1150);
          }
        }
      }
      for (let i = 0; i < 4; i++) {
        emitParticle(
          pt.x + rand(-0.14, 0.14), pt.y + rand(-0.08, 0.14), pt.z + rand(-0.14, 0.14),
          rand(-0.95, 0.95), rand(0.4, 1.4), rand(-0.95, 0.95),
          0.84, 0.96, 1.0, rand(0.06, 0.10), rand(0.42, 0.78), 2, -1.3
        );
      }
    } else if (elemId === 'earth') {
      const wasSlowed = st.rockSlowTimer > 0.3;
      st.rockSlowTimer = Math.max(st.rockSlowTimer, (isBomb ? 3.1 : 2.4) * durMul);
      if (!wasSlowed && isLocalShooter && typeof env.hint === 'function') {
        env.hint('🪨 Heavy Quake! Target Slowed (-35%)!', 950);
      }
      spawnPhysicsRocks(pt, _up, 2, false);
      for (let i = 0; i < 2; i++) {
        emitParticle(
          pt.x + rand(-0.12, 0.12), pt.y, pt.z + rand(-0.12, 0.12),
          rand(-0.8, 0.8), rand(0.4, 1.1), rand(-0.8, 0.8),
          0.62, 0.50, 0.36, 0.11, 0.50, 0, -1.0
        );
      }
    } else if (elemId === 'air') {
      const kDir = opts.dir
        ? { x: opts.dir.x, z: opts.dir.z }
        : (opts.shooter
            ? { x: victim.position.x - opts.shooter.position.x, z: victim.position.z - opts.shooter.position.z }
            : { x: 0, z: 1 });
      const kLen = Math.hypot(kDir.x, kDir.z) || 1;
      const nx = kDir.x / kLen, nz = kDir.z / kLen;
      const wasChaos = st.airChaosTimer > 0.25;
      st.airChaosTimer = Math.max(st.airChaosTimer, (isBomb ? 2.0 : 1.45) * durMul);
      // Perpendicular crosswind vector for chaotic lateral turbulence!
      st.airCrossX = -nz;
      st.airCrossZ = nx;
      if (!wasChaos) {
        st.airPhase = 0;
        st.airSign = Math.random() < 0.5 ? 1 : -1;
      }
      if (!wasChaos && isLocalShooter && typeof env.hint === 'function') {
        env.hint('🌪️ Wind Turbulence! Target Losing Control!', 950);
      }
      triggerHiderGustKnockback(victim, kDir, isBomb ? 8.5 : 3.6);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        emitParticle(
          pt.x + Math.cos(a) * 0.16, pt.y, pt.z + Math.sin(a) * 0.16,
          Math.cos(a) * 1.4, rand(0.25, 0.9), Math.sin(a) * 1.4,
          0.76, 0.98, 0.92, 0.10, 0.40, 0, 0.15
        );
      }
    }
  }

  function updateCharacterStatuses(dt, nowSec) {
    const G = env.G;
    if (!G || G.phase === 'menu' || G.phase === 'vs') return;

    // 1. Check all living Hiders & Seekers for ground water puddle slipping!
    const allChars = [];
    const seenChars = new Set();
    const rawPool = [
      G.player,
      ...(Array.isArray(G.hiders) ? G.hiders : []),
      ...(Array.isArray(G.seekers) ? G.seekers : []),
      ...(Array.isArray(G.allHiders) ? G.allHiders : []),
      ...(Array.isArray(G.allSeekers) ? G.allSeekers : []),
    ];
    for (let i = 0; i < rawPool.length; i++) {
      const ch = rawPool[i];
      if (!ch || seenChars.has(ch) || ch.userData?.actor?.eliminated) continue;
      seenChars.add(ch);
      const isSeeker = ch.userData?.actor
        ? ch.userData.actor.team === 'seekers'
        : (ch === G.player ? G.mode === 'seek' : false);
      allChars.push({ ch, isSeeker });
    }

    for (let i = 0; i < allChars.length; i++) {
      const { ch, isSeeker } = allChars[i];
      if (!ch || !ch.position) continue;
      const u = ch.userData || {};
      const grounded = ((u.jy || 0) <= 0.14) && !u._localSkyDrop && !u.swimming;
      if (grounded) {
        const hPerk = !isSeeker && typeof env.getHiderPerk === 'function' ? env.getHiderPerk(ch) : 'none';
        if (hPerk !== 'grove_sovereign') {
          const hit = isCharacterStandingInWaterPuddle(ch, isSeeker);
          if (hit.inWater) {
            const st = ensureStatus(ch);
            st.slipTimer = Math.max(st.slipTimer, 0.72);
            if (hit.puddle && typeof hit.puddle.rippleBoost === 'number') {
              hit.puddle.rippleBoost = 1.0;
            }
          }
        }
      }
    }

    if (statusMap.size === 0) return;

    for (const [ch, st] of statusMap.entries()) {
      if (!ch || !ch.parent || ch.userData?.actor?.eliminated) {
        removeFreezeCrystalShell(ch, st, false);
        statusMap.delete(ch);
        continue;
      }

      const px = ch.position.x;
      const py = (ch.userData?.groundY ?? ch.position.y ?? 0) + (ch.userData?.jy || 0);
      const pz = ch.position.z;

      // Measure frame velocity for slippery hydroplane momentum!
      if (!st.hasLastPos && typeof ch.userData?.lastX === 'number' && typeof ch.userData?.lastZ === 'number') {
        st.lastX = ch.userData.lastX;
        st.lastZ = ch.userData.lastZ;
        st.hasLastPos = true;
      }
      let frameVx = 0, frameVz = 0;
      if (st.hasLastPos && dt > 1e-4) {
        frameVx = clamp((px - st.lastX) / dt, -9.5, 9.5);
        frameVz = clamp((pz - st.lastZ) / dt, -9.5, 9.5);
      }
      st.hasLastPos = true;

      st.vfxTimer -= dt;
      const doVfx = st.vfxTimer <= 0;
      if (doVfx) st.vfxTimer = 0.22;

      // A. Snow Crystal Freeze & Chill Stacks
      if (st.freezeTimer > 0) {
        st.freezeTimer -= dt;
        if (st.freezeShell) {
          st.freezeShell.rotation.y = nowSec * 1.8;
        }
        if (st.freezeTimer <= 0) {
          st.freezeTimer = 0;
          removeFreezeCrystalShell(ch, st, true);
        }
      } else if (st.chillStacks > 0) {
        st.chillTimer -= dt;
        if (st.chillTimer <= 0) {
          st.chillStacks = Math.max(0, st.chillStacks - 1);
          st.chillTimer = st.chillStacks > 0 ? 1.5 : 0;
        } else if (doVfx) {
          emitParticle(
            px + rand(-0.22, 0.22), py + rand(0.35, 0.85), pz + rand(-0.22, 0.22),
            rand(-0.2, 0.2), -0.35, rand(-0.2, 0.2),
            0.85, 0.96, 1.0, 0.055, 0.5, 2, 0
          );
        }
      }

      // B. Rock Heavy Slow
      if (st.rockSlowTimer > 0) {
        st.rockSlowTimer = Math.max(0, st.rockSlowTimer - dt);
        if (doVfx) {
          emitParticle(
            px + rand(-0.24, 0.24), py + 0.18, pz + rand(-0.24, 0.24),
            rand(-0.25, 0.25), rand(0.15, 0.45), rand(-0.25, 0.25),
            0.60, 0.48, 0.35, 0.095, 0.48, 0, -1.5
          );
        }
      }

      // C. Fire Ignite Burn DoT (4 dmg every 0.5s, cleansed by water/tub/swim!)
      if (st.burnTimer > 0) {
        if (isAnyWaterExtinguishing(ch)) {
          cleanseCharacterDebuffs(ch, true);
          if (ch === G.player && typeof env.hint === 'function') {
            env.hint('💨 Water extinguished the flames!', 1050);
          }
        } else {
          st.burnTimer = Math.max(0, st.burnTimer - dt);
          st.burnTickAcc += dt;
          if (doVfx) {
            emitParticle(
              px + rand(-0.18, 0.18), py + rand(0.35, 0.78), pz + rand(-0.18, 0.18),
              rand(-0.3, 0.3), rand(0.85, 1.5), rand(-0.3, 0.3),
              1.0, rand(0.45, 0.80), 0.12, 0.052, 0.45, 1, 0.2
            );
            emitParticle(
              px + rand(-0.12, 0.12), py + 0.82, pz + rand(-0.12, 0.12),
              rand(-0.15, 0.15), rand(0.65, 1.05), rand(-0.15, 0.15),
              0.26, 0.24, 0.22, 0.09, 0.52, 0, 0.15
            );
          }
          while (st.burnTickAcc >= 0.5) {
            st.burnTickAcc -= 0.5;
            if (typeof env.onBurnTick === 'function') {
              env.onBurnTick(ch, st.burnAttacker, 4);
            }
            if (ch.userData?.actor?.eliminated) break;
          }
        }
      }

      // D. Air Lose Control / Wind Turbulence (swirling crosswind drift!)
      if (st.airChaosTimer > 0 && st.freezeTimer <= 0) {
        st.airChaosTimer = Math.max(0, st.airChaosTimer - dt);
        st.airPhase += dt;
        const sway = (st.airSign || 1) * (1.45 + Math.sin(st.airPhase * 9.2) * 1.85);
        if (typeof env.moveChar === 'function') {
          env.moveChar(ch, st.airCrossX * sway * dt, st.airCrossZ * sway * dt);
        }
        if (doVfx) {
          const a = nowSec * 8.0 + st.airSeed;
          emitParticle(
            px + Math.cos(a) * 0.38, py + 0.55, pz + Math.sin(a) * 0.38,
            -Math.sin(a) * 1.1, 0.35, Math.cos(a) * 1.1,
            0.72, 0.98, 0.90, 0.085, 0.38, 0, 0.1
          );
        }
      }

      // E. Water Slippery Ground Momentum Skid!
      if (st.slipTimer > 0 && st.freezeTimer <= 0) {
        st.slipTimer = Math.max(0, st.slipTimer - dt);
        if (Math.hypot(frameVx, frameVz) > 0.45) {
          // Low traction: blend character velocity into slick hydroplane momentum so turning/stopping skids!
          st.slipVx = lerp(st.slipVx, frameVx * 0.82, Math.min(1, dt * 7.5));
          st.slipVz = lerp(st.slipVz, frameVz * 0.82, Math.min(1, dt * 7.5));
        } else {
          const iceDamp = Math.exp(-1.85 * dt);
          st.slipVx *= iceDamp;
          st.slipVz *= iceDamp;
        }
        if (Math.hypot(st.slipVx, st.slipVz) > 0.08 && typeof env.moveChar === 'function') {
          env.moveChar(ch, st.slipVx * dt, st.slipVz * dt);
          if (doVfx) {
            emitParticle(
              px + rand(-0.18, 0.18), py + 0.08, pz + rand(-0.18, 0.18),
              -st.slipVx * 0.25 + rand(-0.4, 0.4), rand(0.45, 0.95), -st.slipVz * 0.25 + rand(-0.4, 0.4),
              0.55, 0.88, 1.0, 0.052, 0.35, 3, -8.5
            );
          }
        }
      } else {
        st.slipVx = 0;
        st.slipVz = 0;
      }

      st.lastX = ch.position.x;
      st.lastZ = ch.position.z;

      if (
        st.rockSlowTimer <= 0 &&
        st.burnTimer <= 0 &&
        st.chillStacks <= 0 &&
        st.freezeTimer <= 0 &&
        st.airChaosTimer <= 0 &&
        st.slipTimer <= 0 &&
        (typeof env.now === 'function' ? env.now() : 0) > st.freezeImmuneUntil
      ) {
        statusMap.delete(ch);
      }
    }
  }

  function onBombDetonated(elemId, hitPos, seeker) {
    if (!hitPos) return null;
    const resolved = elemId && ELEMENTAL_GUN_SPECS[elemId]
      ? elemId
      : getSeekerElement(seeker);
    const gy = typeof env.groundHeightAt === 'function'
      ? env.groundHeightAt(hitPos.x, hitPos.z, (hitPos.y ?? 0) + 0.6)
      : (hitPos.y || 0);
    const groundPt = new THREE.Vector3(hitPos.x, gy, hitPos.z);

    // Spawn compact ~0.72m 4-second elemental zone!
    const mainPatch = onWorldImpact({
      elemId: resolved,
      point: groundPt,
      normal: _up,
      shooter: seeker,
      isBomb: true,
    });
    if (mainPatch) {
      mainPatch.targetRadius = 0.72;
      mainPatch.maxRadius = 0.84;
      mainPatch.intensity = Math.min(1.65, Math.max(mainPatch.intensity, 1.4));
    }

    if (resolved === 'snow') {
      const realProps = env.realProps || [];
      for (let i = 0; i < realProps.length; i++) {
        const r = realProps[i];
        if (!r?.g) continue;
        const d = Math.hypot(r.g.position.x - groundPt.x, r.g.position.z - groundPt.z);
        if (d <= 3.6 && Math.abs(r.g.position.y - groundPt.y) < 2.0) {
          attachOrGrowPropSnowCap(r, 0.65);
        }
      }
    } else if (resolved === 'fire') {
      for (let i = 0; i < 2; i++) {
        const a = rand(0, Math.PI * 2);
        const rr = rand(0.55, 0.95);
        const sx = groundPt.x + Math.cos(a) * rr;
        const sz = groundPt.z + Math.sin(a) * rr;
        const sy = typeof env.groundHeightAt === 'function' ? env.groundHeightAt(sx, sz, gy + 0.6) : gy;
        const sub = spawnPatch('fire', new THREE.Vector3(sx, sy, sz), _up, false);
        if (sub) {
          sub.intensity = 1.15;
          sub.targetRadius = 0.34;
        }
      }
    } else if (resolved === 'air') {
      // Cyclone Shockwave: radial outward blast on all props within 4.8m!
      pushPropsInRadius(groundPt, 4.8, 12.2, null, true);
    }

    return mainPatch;
  }

  // --------------------------------------------------------------------------
  // Update Compact 4-Second Patches & Dynamic Fire PointLights
  // --------------------------------------------------------------------------
  function updatePatchesAndLights(dt, nowSec) {
    for (let i = patches.length - 1; i >= 0; i--) {
      const pt = patches[i];
      pt.age += dt;
      if (pt.age >= PERSIST_DURATION) {
        disposePatch(pt);
        patches.splice(i, 1);
        continue;
      }

      const fadeFrac = pt.age > PERSIST_FADE_START
        ? clamp((pt.age - PERSIST_FADE_START) / (PERSIST_DURATION - PERSIST_FADE_START), 0, 1)
        : 0;
      const aliveMul = 1 - fadeFrac;
      pt.radius = lerp(pt.radius, pt.targetRadius, Math.min(1, dt * 6.5));
      pt.rippleBoost = Math.max(0, pt.rippleBoost - dt * 1.35);

      if (pt.elemId === 'fire') {
        const popIn = smoothstep(0, 0.14, pt.age);
        const smolder = smoothstep(0.0, 0.72, fadeFrac);
        const flameShrink = fadeFrac > 0 ? Math.pow(Math.max(0, 1 - fadeFrac * 1.12), 1.45) : 1;
        // Low, crisp shin-height Storybook flames (0.22m..0.44m) — never blocks sightlines!
        const hTarget = clamp((0.24 + (pt.intensity - 0.85) * 0.22), 0.20, 0.46) * popIn * Math.max(0.05, flameShrink);
        const wTarget = pt.radius * (0.72 + pt.intensity * 0.08) * popIn * (1 - fadeFrac * 0.55);

        pt.scorchMesh.scale.setScalar(pt.radius * 1.45 * popIn * (1 - fadeFrac * 0.22));
        pt.scorchMat.uniforms.uTime.value = nowSec;
        pt.scorchMat.uniforms.uEmberGlow.value = clamp(1.1 - fadeFrac * 0.85, 0.1, 1.2);
        pt.scorchMat.uniforms.uOpacity.value = (1 - Math.pow(fadeFrac, 2.4)) * 0.88;

        pt.flameGrp.scale.set(wTarget, hTarget, wTarget);
        pt.flameMat.uniforms.uTime.value = nowSec;
        pt.flameMat.uniforms.uIntensity.value = pt.intensity;
        pt.flameMat.uniforms.uSmolder.value = smolder;
        pt.flameMat.uniforms.uOpacity.value = clamp(aliveMul * 0.82, 0, 0.82);

        // Subtle tiny wisps of smoke & delicate floating embers (capped so all clear at 4.0s)
        const remLife = Math.max(0.18, PERSIST_DURATION - pt.age);
        pt.emitTimer -= dt;
        const emitGap = getQualityTier() === 'low' ? 0.45 : (fadeFrac > 0.25 ? 0.36 : 0.26);
        if (pt.emitTimer <= 0 && fadeFrac < 0.55) {
          pt.emitTimer = emitGap * rand(0.85, 1.25);
          const ox = pt.flameGrp.position.x + rand(-0.14, 0.14) * pt.radius;
          const oy = pt.flameGrp.position.y + hTarget * 0.72;
          const oz = pt.flameGrp.position.z + rand(-0.14, 0.14) * pt.radius;
          const grey = lerp(0.22, 0.36, Math.random());
          emitParticle(
            ox, oy, oz,
            rand(-0.12, 0.12), rand(0.65, 1.15) * (1 - fadeFrac * 0.35), rand(-0.12, 0.12),
            grey, grey * 0.96, grey * 0.93,
            (0.075 + pt.intensity * 0.025) * (1 - fadeFrac * 0.35),
            Math.min(rand(0.55, 0.95), remLife),
            0,
            0.12
          );
          if (Math.random() < 0.55) {
            emitParticle(
              ox, pt.flameGrp.position.y + hTarget * 0.35, oz,
              rand(-0.32, 0.32), rand(0.85, 1.65), rand(-0.32, 0.32),
              1.0, rand(0.45, 0.78), 0.12,
              rand(0.032, 0.058),
              Math.min(rand(0.42, 0.78), remLife),
              1,
              0.18
            );
          }
        }
      } else if (pt.elemId === 'water') {
        const popIn = smoothstep(0, 0.18, pt.age);
        if (pt.isWallWater) {
          const w = pt.radius * 1.05 * popIn * (1 - fadeFrac * 0.35);
          const h = pt.radius * 1.45 * popIn * (1 - fadeFrac * 0.25);
          pt.decalMesh.scale.set(w, h, 1);
          pt.puddleMat.uniforms.uTime.value = nowSec;
          pt.puddleMat.uniforms.uOpacity.value = (1 - fadeFrac * fadeFrac) * 0.85;

          if (fadeFrac < 0.5) {
            const remLife = Math.max(0.18, PERSIST_DURATION - pt.age);
            pt.emitTimer -= dt;
            if (pt.emitTimer <= 0) {
              pt.emitTimer = rand(0.24, 0.45);
              emitParticle(
                pt.x + pt.normal.x * 0.04 + rand(-0.09, 0.09),
                pt.y - rand(0.04, 0.16),
                pt.z + pt.normal.z * 0.04 + rand(-0.09, 0.09),
                pt.normal.x * 0.08,
                -0.5,
                pt.normal.z * 0.08,
                0.55, 0.86, 1.0,
                0.048,
                Math.min(0.7, remLife),
                3,
                -9.8
              );
            }
            pt.dripFeedTimer -= dt;
            if (pt.dripFeedTimer <= 0 && pt.age < 1.6) {
              pt.dripFeedTimer = 0.85;
              const bx = pt.x + pt.normal.x * 0.22;
              const bz = pt.z + pt.normal.z * 0.22;
              const by = typeof env.groundHeightAt === 'function' ? env.groundHeightAt(bx, bz, pt.y) : 0;
              if (pt.y - by > 0.18 && pt.y - by < 5.5) {
                const basePt = new THREE.Vector3(bx, by, bz);
                const nearPuddle = findCoalescentPatch('water', basePt, _up, 0.85);
                if (nearPuddle) {
                  nearPuddle.targetRadius = Math.min(0.56, nearPuddle.targetRadius + 0.03);
                } else {
                  const fed = spawnPatch('water', basePt, _up, false);
                  if (fed) {
                    fed.targetRadius = 0.26;
                    fed.age = pt.age * 0.85;
                  }
                }
              }
            }
          }
        } else {
          // Compact 4s Glossy Fresnel Puddle
          const sc = pt.radius * 1.45 * popIn * (1 - fadeFrac * 0.35);
          pt.decalMesh.scale.setScalar(Math.max(0.04, sc));
          pt.puddleMat.uniforms.uTime.value = nowSec;
          pt.puddleMat.uniforms.uEvap.value = fadeFrac;
          pt.puddleMat.uniforms.uRippleBoost.value = pt.rippleBoost;
          pt.puddleMat.uniforms.uOpacity.value = (1 - Math.pow(fadeFrac, 1.85)) * 0.9;
        }
      } else if (pt.elemId === 'snow') {
        const popIn = smoothstep(0, 0.16, pt.age);
        const thickness = (0.34 + (pt.intensity - 0.85) * 0.16) * Math.pow(1 - fadeFrac, 1.6);
        const spread = pt.radius * 0.92 * popIn * (1 - fadeFrac * 0.48);

        pt.snowMat.uniforms.uTime.value = nowSec;
        pt.snowMat.uniforms.uMelt.value = fadeFrac;
        pt.snowMat.uniforms.uOpacity.value = 1 - Math.pow(fadeFrac, 2.3);

        if (pt.isVertical) {
          pt.moundGrp.scale.set(spread, spread, Math.max(0.03, thickness));
          if (pt.icicleGrp) {
            const icLen = (0.65 + (pt.intensity - 0.85) * 0.22) * popIn * Math.pow(1 - fadeFrac, 1.5);
            pt.icicleGrp.scale.set(1 - fadeFrac * 0.4, Math.max(0.02, icLen), 1 - fadeFrac * 0.4);
          }
        } else {
          pt.moundGrp.scale.set(spread, Math.max(0.015, thickness * popIn), spread);
        }

        // Sparse tiny snowflakes above snowed patch
        pt.emitTimer -= dt;
        if (pt.emitTimer <= 0 && fadeFrac < 0.5) {
          const remLife = Math.max(0.2, PERSIST_DURATION - pt.age);
          pt.emitTimer = getQualityTier() === 'low' ? 0.75 : rand(0.42, 0.72);
          emitParticle(
            pt.x + rand(-0.45, 0.45) * pt.radius,
            pt.y + rand(0.22, 0.62),
            pt.z + rand(-0.45, 0.45) * pt.radius,
            0, rand(-0.28, -0.14), 0,
            0.90, 0.97, 1.0,
            rand(0.042, 0.068),
            Math.min(rand(0.65, 1.05), remLife),
            2,
            0
          );
        }
      } else if (pt.elemId === 'earth') {
        // Compact ankle-height pebble & rock outcrop -> 2.4s..4.0s smooth sinking into earth!
        const popT = clamp(pt.age / 0.15, 0, 1);
        const eruptY = popT < 1 ? easeOutBack(popT) : 1.0;
        const radSc = pt.radius * (0.82 + (pt.intensity - 0.85) * 0.14);
        const hSc = (0.48 + (pt.intensity - 0.85) * 0.18) * eruptY * (1 - fadeFrac * 0.35);
        const sinkDist = fadeFrac * fadeFrac * (0.42 * hSc + 0.08);

        pt.crackMesh.scale.setScalar(radSc * 1.65 * Math.min(1, pt.age * 8));
        pt.crackMat.uniforms.uOpacity.value = (1 - Math.pow(fadeFrac, 1.7)) * 0.88;

        pt.rockGrp.position.set(
          pt.x - pt.normal.x * sinkDist,
          pt.y - pt.normal.y * sinkDist,
          pt.z - pt.normal.z * sinkDist
        );
        pt.rockGrp.scale.set(radSc * (1 - fadeFrac * 0.2), Math.max(0.015, hSc), radSc * (1 - fadeFrac * 0.2));

        if (fadeFrac > 0.05 && fadeFrac < 0.65) {
          const remLife = Math.max(0.18, PERSIST_DURATION - pt.age);
          pt.emitTimer -= dt;
          if (pt.emitTimer <= 0) {
            pt.emitTimer = rand(0.4, 0.72);
            emitParticle(
              pt.x + rand(-0.25, 0.25) * pt.radius,
              pt.y + 0.04,
              pt.z + rand(-0.25, 0.25) * pt.radius,
              rand(-0.14, 0.14), rand(0.14, 0.35), rand(-0.14, 0.14),
              0.63, 0.51, 0.37,
              0.085,
              Math.min(0.55, remLife),
              0,
              -0.08
            );
          }
        }
      } else if (pt.elemId === 'air') {
        const popIn = smoothstep(0, 0.18, pt.age);
        const unwind = 1 - fadeFrac;
        const rSc = pt.radius * (0.85 + fadeFrac * 0.25) * popIn;
        const hSc = (0.62 + (pt.intensity - 0.85) * 0.18) * popIn * Math.pow(unwind, 0.85);

        pt.eddyGrp.scale.set(rSc, Math.max(0.04, hSc), rSc);
        pt.eddyGrp.rotation.y += dt * (6.2 * unwind + 0.8);
        pt.vortexMat.uniforms.uTime.value = nowSec;
        pt.vortexMat.uniforms.uOpacity.value = 0.34 * Math.pow(unwind, 1.35);

        if (pt.leaves) {
          for (let l = 0; l < pt.leaves.length; l++) {
            const lf = pt.leaves[l];
            const a = lf.baseAng + pt.age * lf.omega * (0.45 + 0.55 * unwind);
            const yProg = (lf.yPhase + pt.age * lf.ySpd) % 1;
            const funnelR = lf.baseR * (0.35 + yProg * 0.85);
            lf.mesh.position.set(
              Math.cos(a) * funnelR,
              0.03 + yProg * 0.38,
              Math.sin(a) * funnelR
            );
            lf.mesh.rotation.x += lf.spinX * dt;
            lf.mesh.rotation.z += lf.spinZ * dt;
            lf.mesh.scale.setScalar(unwind);
          }
        }
      }
    }

    // Assign up to 3 warm flickering additive halos to top active fire clusters (zero PointLight shader recompiles!)
    if (fireLights.length) {
      if (getQualityTier() === 'low') {
        for (let i = 0; i < fireLights.length; i++) {
          if (fireLights[i].visible) {
            fireLights[i].intensity = 0;
            if (fireLights[i].material) fireLights[i].material.opacity = 0;
            fireLights[i].visible = false;
          }
        }
      } else {
        const camP = env.camera?.position;
        const chosen = [];
        for (let i = 0; i < patches.length; i++) {
          const pt = patches[i];
          if (pt.elemId !== 'fire') continue;
          const fadeK = pt.age > PERSIST_FADE_START
            ? 1 - (pt.age - PERSIST_FADE_START) / (PERSIST_DURATION - PERSIST_FADE_START)
            : 1;
          if (fadeK <= 0.05) continue;
          const camD = camP ? Math.hypot(pt.x - camP.x, pt.y - camP.y, pt.z - camP.z) : 8;
          const score = (pt.intensity * fadeK) / (1 + camD * 0.09);
          if (chosen.some((c) => Math.hypot(c.pt.x - pt.x, c.pt.z - pt.z) < 2.6)) continue;
          chosen.push({ pt, score, fadeK });
          chosen.sort((a, b) => b.score - a.score);
          if (chosen.length > FIRE_LIGHT_POOL_SIZE) chosen.pop();
        }

        for (let i = 0; i < fireLights.length; i++) {
          const pl = fireLights[i];
          const item = chosen[i];
          if (!item) {
            pl.intensity = 0;
            if (pl.material) pl.material.opacity = 0;
            pl.visible = false;
            continue;
          }
          const { pt, fadeK } = item;
          const flicker = 0.86 + 0.14 * Math.sin(nowSec * 17.3 + pt.seed) + 0.08 * Math.cos(nowSec * 31.7 + i * 2.1);
          pl.visible = true;
          pl.position.set(
            pt.x + pt.normal.x * 0.28,
            pt.y + 0.42 + Math.max(0, pt.normal.y) * 0.1,
            pt.z + pt.normal.z * 0.28
          );
          const haloInt = (0.78 + pt.intensity * 0.42) * fadeK * flicker;
          pl.intensity = haloInt;
          pl.distance = 4.6 + pt.intensity * 1.1;
          const haloSz = (2.1 + pt.intensity * 0.65) * (0.94 + flicker * 0.08);
          pl.scale?.set?.(haloSz, haloSz, 1);
          if (pl.material) pl.material.opacity = Math.min(0.42, 0.26 * haloInt);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Gun Attachment Animations (1st-Person & 3rd-Person)
  // --------------------------------------------------------------------------
  function animateGunRig(anim, dt, nowSec, isFiring) {
    if (!anim) return;
    if (anim.elemId === 'air' && anim.rotorGrp) {
      const spinSpd = isFiring ? 28.0 : 8.5;
      anim.rotorGrp.rotation.z += spinSpd * dt;
      if (anim.aeroRing1) {
        const s1 = 1 + 0.06 * Math.sin(nowSec * 7.5);
        anim.aeroRing1.scale.setScalar(s1);
      }
      if (anim.aeroRing2) {
        const s2 = 1 + 0.06 * Math.cos(nowSec * 7.5 + 1.2);
        anim.aeroRing2.scale.setScalar(s2);
      }
    } else if (anim.elemId === 'fire') {
      if (anim.emberwickGrp) {
        const p = 0.94 + 0.10 * Math.sin(nowSec * 9.2) + (isFiring ? 0.12 : 0);
        anim.emberwickGrp.scale.set(p, p * (1 + 0.08 * Math.cos(nowSec * 13.4)), p);
      }
      if (anim.pilotGrp) {
        const surge = isFiring ? 1.55 : 1.0;
        const fx = 0.88 + 0.22 * Math.sin(nowSec * 23.0);
        const fy = (0.85 + 0.28 * Math.cos(nowSec * 29.0)) * surge;
        anim.pilotGrp.scale.set(fx, fx, fy);
      }
    } else if (anim.elemId === 'snow') {
      if (anim.prismGrp) {
        anim.prismGrp.rotation.z = Math.sin(nowSec * 2.4) * 0.14;
        const s = 0.96 + 0.06 * Math.sin(nowSec * 4.8);
        anim.prismGrp.scale.setScalar(s);
      }
      if (anim.flakeGrp) {
        anim.flakeGrp.rotation.z += (isFiring ? 5.5 : 0.85) * dt;
      }
    } else if (anim.elemId === 'earth') {
      if (anim.geodeGrp) {
        anim.geodeGrp.rotation.y += (isFiring ? 4.8 : 1.65) * dt;
        anim.geodeGrp.position.y = (anim.geodeBaseY || 0.095) + Math.sin(nowSec * 3.4) * 0.009;
      }
    } else if (anim.elemId === 'water' && anim.hydroBubble) {
      anim.hydroBubble.position.y = 0.005 + Math.sin(nowSec * 3.8) * 0.008;
    }
  }

  // --------------------------------------------------------------------------
  // Seek HUD Elemental Pill (#elemGunHudPill) & #btnFire Sync
  // --------------------------------------------------------------------------
  function ensureStylesheetLinked() {
    if (typeof document === 'undefined' || !document.head) return;
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some((lnk) => (lnk.getAttribute('href') || '').includes('elemental_guns.css'));
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'elemental_guns.css?v=2';
    document.head.appendChild(link);
  }

  function syncHudPill(triggerPop = false) {
    if (typeof document === 'undefined') return;
    const spec = getElementSpec(selectedElement);

    if (pillEl) {
      pillEl.dataset.elem = spec.id;
      pillEl.style.setProperty('--eg-accent', spec.hudBg);
      pillEl.setAttribute('aria-label', `Elemental Blaster: ${spec.name}. Tap or press G to switch.`);
      if (pillIconEl) pillIconEl.textContent = spec.icon;
      if (pillNameEl) pillNameEl.textContent = spec.shortName;
      if (pillTrialEl) {
        pillTrialEl.classList.toggle('hidden', !isElementTrialOnly(spec.id));
      }
      if (triggerPop) {
        pillEl.classList.remove('eg-pop');
        void pillEl.offsetWidth;
        pillEl.classList.add('eg-pop');
        clearTimeout(pillPopTO);
        pillPopTO = setTimeout(() => pillEl && pillEl.classList.remove('eg-pop'), 320);
      }
    }

    // Sync #btnFire icon + label (💦 Splash, 🔥 Ignite, ❄️ Freeze, 🪨 Quake, 🌪️ Gust)
    const btnFire = document.getElementById('btnFire');
    if (btnFire) {
      btnFire.dataset.elem = spec.id;
      btnFire.dataset.elemAction = spec.actionLabel;
      btnFire.dataset.desktopLbl = spec.actionLabel;
      const icEl = btnFire.querySelector('.ic');
      const lblEl = btnFire.querySelector('span:not(.ic)');
      if (icEl && icEl.textContent !== spec.icon) icEl.textContent = spec.icon;
      if (lblEl && lblEl.textContent !== spec.actionLabel) lblEl.textContent = spec.actionLabel;
    }
  }

  function updateHUD() {
    if (!uiMounted && typeof document !== 'undefined' && document.getElementById('hud')) {
      mountUI();
    }
    const G = env.G;
    if (pillEl) {
      const visible = Boolean(G && G.mode === 'seek' && G.phase !== 'menu' && G.phase !== 'vs');
      pillEl.classList.toggle('hidden', !visible);
      if (visible && pillEl.dataset.elem !== selectedElement) {
        syncHudPill(false);
      }
    }

    if (statusHudEl) {
      const inPlay = Boolean(G && G.player && G.phase !== 'menu' && G.phase !== 'vs' && !G.over);
      if (!inPlay) {
        if (lastStatusHudSig !== '') {
          statusHudEl.innerHTML = '';
          statusHudEl.classList.add('hidden');
          lastStatusHudSig = '';
        }
        return;
      }
      const st = statusMap.get(G.player);
      if (!st) {
        if (lastStatusHudSig !== '') {
          statusHudEl.innerHTML = '';
          statusHudEl.classList.add('hidden');
          lastStatusHudSig = '';
        }
        return;
      }
      const chips = [];
      if (st.freezeTimer > 0) {
        chips.push(`<span class="es-pill freeze">❄️ FROZEN! <b>${st.freezeTimer.toFixed(1)}s</b></span>`);
      } else if (st.chillStacks > 0) {
        chips.push(`<span class="es-pill snow">❄️ CHILLED ×${st.chillStacks}</span>`);
      }
      if (st.burnTimer > 0) {
        chips.push(`<span class="es-pill fire">🔥 BURNING <b>${st.burnTimer.toFixed(1)}s</b></span>`);
      }
      if (st.rockSlowTimer > 0) {
        chips.push(`<span class="es-pill earth">🪨 SLOWED <b>${st.rockSlowTimer.toFixed(1)}s</b></span>`);
      }
      if (st.airChaosTimer > 0) {
        chips.push(`<span class="es-pill air">🌪️ LOSING CONTROL! <b>${st.airChaosTimer.toFixed(1)}s</b></span>`);
      }
      if (st.slipTimer > 0.08) {
        chips.push(`<span class="es-pill water">💦 SLIPPERY!</span>`);
      }
      const sig = chips.join('');
      if (sig !== lastStatusHudSig) {
        lastStatusHudSig = sig;
        statusHudEl.innerHTML = sig;
        statusHudEl.classList.toggle('hidden', chips.length === 0);
      }
    }
  }

  function handleKeyDown(e) {
    if (!e || e.repeat || e._elemGunHandled) return false;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return false;

    const G = env.G;
    if (!G || G.mode !== 'seek' || G.phase === 'menu' || G.phase === 'vs') return false;

    if (e.code === 'KeyG' && !G.nearInteract && !G.player?.userData?.inTurret) {
      e._elemGunHandled = true;
      cycleElement(1);
      return true;
    }
    return false;
  }

  function mountUI() {
    if (typeof document === 'undefined') return;
    ensureStylesheetLinked();
    const hud = document.getElementById('hud');
    if (!hud) return;

    pillEl = document.getElementById('elemGunHudPill');
    if (!pillEl) {
      pillEl = document.createElement('button');
      pillEl.id = 'elemGunHudPill';
      pillEl.type = 'button';
      pillEl.className = 'hidden';
      pillEl.innerHTML =
        `<span class="eg-icon-badge" id="egPillIcon">💦</span>` +
        `<span class="eg-label-wrap">` +
          `<span class="eg-name" id="egPillName">Water</span>` +
          `<span class="eg-trial-tag hidden" id="egPillTrial">TRIAL</span>` +
          `<span class="eg-caret" aria-hidden="true">▾</span>` +
        `</span>` +
        `<kbd class="eg-key">G</kbd>`;
      hud.appendChild(pillEl);
    }

    statusHudEl = document.getElementById('elemStatusHud');
    if (!statusHudEl) {
      statusHudEl = document.createElement('div');
      statusHudEl.id = 'elemStatusHud';
      statusHudEl.className = 'elem-status-hud hidden';
      statusHudEl.setAttribute('aria-live', 'polite');
      hud.appendChild(statusHudEl);
    }

    pillIconEl = document.getElementById('egPillIcon');
    pillNameEl = document.getElementById('egPillName');
    pillTrialEl = document.getElementById('egPillTrial');

    if (pillEl && !pillEl.dataset.wired) {
      pillEl.dataset.wired = '1';
      pillEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cycleElement(1);
      });
    }

    if (!keyListenerBound && typeof window !== 'undefined') {
      keyListenerBound = true;
      window.addEventListener('keydown', (e) => {
        handleKeyDown(e);
      });
    }

    uiMounted = true;
    setFirstPersonElement(selectedElement);
    syncHudPill(false);
    updateHUD();
  }

  // --------------------------------------------------------------------------
  // Frame Update & Clean Round / World Reset
  // --------------------------------------------------------------------------
  function update(dt, rawNow) {
    if (!(dt >= 0)) return;
    const clampedDt = Math.min(dt, 0.1);
    const nowMs = typeof rawNow === 'number'
      ? rawNow
      : (typeof env.now === 'function' ? env.now() : (typeof performance !== 'undefined' ? performance.now() : 0));
    const nowSec = nowMs * 0.001;

    // 1. Animate 1st-person & 3rd-person Elemental Gun rigs
    const G = env.G;
    const localFiring = !!(G && G.firing && G.mode === 'seek' && G.phase === 'seek' && !G.over);
    elemAudio.setFiring(localFiring, selectedElement);
    if (env.gun?.userData?._elemRig?.userData?.anim) {
      animateGunRig(env.gun.userData._elemRig.userData.anim, clampedDt, nowSec, localFiring);
    }
    if (thirdPersonSeekers.size > 0) {
      for (const s of thirdPersonSeekers) {
        if (!s || !s.parent) {
          thirdPersonSeekers.delete(s);
          continue;
        }
        const rig = s.userData?._elem3pRig;
        if (rig?.userData?.anim) {
          animateGunRig(rig.userData.anim, clampedDt, nowSec, !!s.userData?.aim);
        }
      }
    }

    // 2. Update 4-second persistent world patches & dynamic fire PointLights
    updatePatchesAndLights(clampedDt, nowSec);

    // 3. Update 4-second prop snow caps
    updatePropSnowCaps(clampedDt, nowSec);

    // 4. Step 48 pooled Earth rigid-body boulders
    updatePhysicsRocks(clampedDt);

    // 5. Step Air rigid-body prop physics on env.realProps (props stay at new spot!)
    updatePropPhysics(clampedDt, nowSec);
    updateFallbackCharKnockbacks(clampedDt);

    // 6. Step Elemental Combat Status Effects (Water Skid, Rock Slow, Fire Burn DoT, Snow Freeze, Air Turbulence)
    updateCharacterStatuses(clampedDt, nowSec);

    // 7. Step pooled single-draw-call ambient particles
    updateParticles(clampedDt, nowSec);

    // 8. Sync HUD visibility & state
    updateHUD();
  }

  function clearAll() {
    elemAudio.stopAll();
    // 1. Dispose all active 4s patches
    for (let i = patches.length - 1; i >= 0; i--) {
      disposePatch(patches[i]);
    }
    patches.length = 0;

    // 2. Remove all prop snow caps
    for (const [, cap] of propSnowCaps.entries()) {
      if (cap.grp.parent) cap.grp.parent.remove(cap.grp);
      cap.mat.dispose();
    }
    propSnowCaps.clear();

    // 3. Reset dynamic fire halos
    for (let i = 0; i < fireLights.length; i++) {
      fireLights[i].intensity = 0;
      if (fireLights[i].material) fireLights[i].material.opacity = 0;
      fireLights[i].visible = false;
    }

    // 4. Hide all pooled physics rocks
    for (let i = 0; i < physicsRocks.length; i++) {
      physicsRocks[i].active = false;
      physicsRocks[i].mesh.visible = false;
    }

    // 5. Clear pooled particles
    if (particleSystem) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        partLife[i] = 0;
        partAlpha[i] = 0;
        partPos[i * 3 + 1] = -80;
      }
      particleSystem.geo.attributes.position.needsUpdate = true;
      particleSystem.geo.attributes.aAlpha.needsUpdate = true;
    }

    // 6. Reset elemental projectile InstancedMeshes
    if (projPools) {
      for (const im of Object.values(projPools)) {
        im.count = 0;
        im.instanceMatrix.needsUpdate = true;
      }
    }

    // 7. Restore ALL displaced realProps immediately to their exact original positions & ownBox bounds!
    for (const [, st] of displacedProps.entries()) {
      restorePropHomeImmediate(st);
    }
    displacedProps.clear();
    activeCharKnockbacks.clear();
    for (const [ch, st] of statusMap.entries()) {
      removeFreezeCrystalShell(ch, st, false);
    }
    statusMap.clear();
    if (statusHudEl) {
      statusHudEl.innerHTML = '';
      statusHudEl.classList.add('hidden');
      lastStatusHudSig = '';
    }
    thirdPersonSeekers.clear();
  }

  function resetRound() {
    clearAll();
    const avail = getAvailableElements();
    if (!avail.includes(selectedElement)) {
      selectedElement = 'water';
    }
    setFirstPersonElement(selectedElement);
    if (env.G?.player && env.G.mode === 'seek') {
      env.G.player.userData.elemId = selectedElement;
      attachThirdPersonElement(env.G.player, selectedElement);
    }
    syncHudPill(false);
    updateHUD();
  }

  return {
    ELEMENTAL_GUN_IDS,
    ELEMENTAL_GUN_SPECS,
    PERSIST_DURATION,
    mountUI,
    updateHUD,
    handleKeyDown,
    getSpec: getElementSpec,
    getCurrentElement: () => selectedElement,
    getSelectedElement: () => selectedElement,
    getCurrentSpec: () => getElementSpec(selectedElement),
    getAvailableElements,
    setUnlockedElements,
    unlockElement,
    setTrialElement,
    getTrialElement: resolveTrialElement,
    selectElement,
    setSelectedElement: selectElement,
    cycleElement,
    setFirstPersonElement,
    attachThirdPersonElement,
    getSeekerElement,
    setSeekerElement,
    getShotParams,
    getHitDamage,
    onShotSpawned,
    updateProjectiles,
    renderElementalShots,
    onWorldImpact,
    onCharacterImpact,
    onBombDetonated,
    spawnSlipperyPuddleAt,
    getCharacterSpeedMultiplier,
    getHiderSpeedMultiplier: getCharacterSpeedMultiplier,
    getHiderJumpMultiplier,
    getSteeringWobbleRad,
    cleanseCharacterDebuffs,
    getCharacterStatusSummary,
    pushProp: (propRec, dir, impulse = 5.8, lift = 2.2) =>
      impulseProp(propRec, dir?.x || 0, dir?.z || 1, impulse, lift),
    pushPropsInRadius,
    getActivePatches: () => patches,
    getDisplacedProps: () => displacedProps,
    getPropSnowCaps: () => propSnowCaps,
    getActivePhysicsRocks: () => physicsRocks.filter((r) => r.active),
    getAudioState: () => elemAudio.getState(),
    playGunShotSound: (elemId, worldPos, isLocal = true) => elemAudio.playShot(elemId, worldPos, isLocal),
    update,
    resetRound,
    clearAll,
  };
}
