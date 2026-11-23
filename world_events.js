/* ==========================================================================
 * Hue & Seek — Mid-Round World Events & 0:30 Overtime Frenzy Manager
 * Storybook 3D Prop-Hunt Dynamic Twist & Final-Stretch Adrenaline System
 *
 * Events (1 per round at 1:15 remaining, deterministic with seed):
 *   1. 'spirit_wind'  (26s) — Swirling Storybook wind ribbons + 40 drifting leaves,
 *                             8–12 prop pair swaps, 2.0× speed + 30 🪙 relocate bonus
 *   2. 'lantern_dusk' (25s) — Smooth 2.2s lantern twilight crossfade & restore,
 *                             3D Seeker golden lantern cones + floating prop fireflies
 *   3. 'prop_bounty'  (35s) — Highlights 2 big map props that pay +15 🪙 every 5s while you wear them
 *                             with golden star sparkles & occasional spirit morphs
 *
 * Overtime Frenzy (final 0:30):
 *   • Overcharged Seeker nozzles (0.055s cd, 38 shot speed, +20% seeker speed, 0s penalty)
 *   • High-tempo procedural music threat floor (0.88)
 *   • Spirits earn +15 🪙 every 10s survived; seeker water costs half
 * ========================================================================== */

const EVENT_TYPES = ['spirit_wind', 'lantern_dusk', 'prop_bounty'];

const EVENT_META = {
  spirit_wind: {
    type: 'spirit_wind',
    icon: '🍃',
    title: 'Spirit Wind',
    duration: 26,
  },
  lantern_dusk: {
    type: 'lantern_dusk',
    icon: '🏮',
    title: 'Lantern Dusk',
    duration: 25,
  },
  prop_bounty: {
    type: 'prop_bounty',
    icon: '🏆',
    title: 'Big Prop Bounty',
    duration: 35,
  },
};

const MID_ROUND_TRIGGER_SEC = 75;
const OVERTIME_TRIGGER_SEC = 30;
const COMPACT_BANNER_SEC = 3.2;
const DUSK_FADE_SEC = 2.2;
const WIND_SWAP_DUR_SEC = 1.3;
const WIND_BOOST_SEC = 6.0;
const WIND_BOOST_MUL = 2.0;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function hashSeed(seedInput) {
  if (typeof seedInput === 'number' && Number.isFinite(seedInput)) {
    let x = (seedInput >>> 0) || 0x9e3779b9;
    x ^= x >>> 16;
    x = Math.imul(x, 0x85ebca6b) >>> 0;
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) || 1;
  }
  const str = String(seedInput ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) || 0x6d2b79f5;
}

function createMulberry32(seedUint) {
  let a = (seedUint >>> 0) || 0x6d2b79f5;
  return function nextRand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mtof(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ============================================================================
// Procedural WebAudio Stinger Synthesizer (Storybook Chimes, Temple Bell & Taiko)
// ============================================================================
function createEventStingerSynth(env) {
  let ac = null;
  let noiseBuf = null;
  let listenersBound = false;

  function isMuted() {
    return !!(env.audio && typeof env.audio.isMuted === 'function' && env.audio.isMuted());
  }

  function ensureContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ac) {
      try {
        ac = new AudioCtx({ latencyHint: 'interactive' });
      } catch (_e) {
        try { ac = new AudioCtx(); } catch (_e2) { return null; }
      }
      if (ac) {
        const sr = ac.sampleRate;
        noiseBuf = ac.createBuffer(1, sr * 2, sr);
        const data = noiseBuf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < data.length; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + w * 0.099046;
          b1 = 0.96300 * b1 + w * 0.2965164;
          b2 = 0.57000 * b2 + w * 1.0526913;
          data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
        }
      }
    }
    if (!listenersBound && typeof window.addEventListener === 'function') {
      listenersBound = true;
      const tryResume = () => {
        if (ac && ac.state === 'suspended' && !isMuted()) {
          ac.resume().catch(() => {});
        }
      };
      for (const ev of ['pointerdown', 'keydown', 'touchstart', 'click']) {
        window.addEventListener(ev, tryResume, { capture: true, passive: true });
      }
    }
    if (ac && ac.state === 'suspended' && !isMuted()) {
      ac.resume().catch(() => {});
    }
    return ac;
  }

  function connectOut(node, pan = 0) {
    if (!ac) return;
    if (pan && typeof ac.createStereoPanner === 'function') {
      const p = ac.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node.connect(p);
      p.connect(ac.destination);
    } else {
      node.connect(ac.destination);
    }
  }

  function playTone(t, freq, dur, opts = {}) {
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t + (opts.glide || dur));
    }
    if (opts.detune) osc.detune.value = opts.detune;
    const vol = Math.max(0.0002, opts.vol ?? 0.12);
    const atk = opts.attack ?? 0.008;
    const hold = opts.hold ?? 0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    if (hold > 0) g.gain.setValueAtTime(vol, t + atk + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, atk + hold + 0.02));

    if (opts.lowpass) {
      const fl = ac.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.setValueAtTime(opts.lowpass, t);
      osc.connect(fl);
      fl.connect(g);
    } else {
      osc.connect(g);
    }
    connectOut(g, opts.pan || 0);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function playTaiko(t, vol = 0.24, pitch = 128, pan = 0) {
    if (!ac) return;
    playTone(t, pitch, 0.34, { type: 'sine', freqEnd: 46, glide: 0.24, vol, attack: 0.003, pan });
    playTone(t, pitch * 1.85, 0.11, { type: 'triangle', freqEnd: 68, glide: 0.09, vol: vol * 0.42, attack: 0.002, pan });
    if (noiseBuf) {
      const src = ac.createBufferSource();
      const bp = ac.createBiquadFilter();
      const g = ac.createGain();
      src.buffer = noiseBuf;
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650, t);
      bp.Q.value = 2.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * 0.26, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      src.connect(bp);
      bp.connect(g);
      connectOut(g, pan);
      src.start(t, Math.random() * 0.8);
      src.stop(t + 0.07);
    }
  }

  function playMarimba(t, midi, vol = 0.13, pan = 0) {
    const f = mtof(midi);
    playTone(t, f, 0.38, { type: 'sine', vol, attack: 0.003, pan });
    playTone(t, f * 3.98, 0.09, { type: 'sine', vol: vol * 0.32, attack: 0.0015, pan });
    playTone(t, f * 2, 0.22, { type: 'triangle', vol: vol * 0.18, attack: 0.003, pan });
  }

  return {
    spiritWind() {
      if (isMuted()) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime + 0.015;

      // Airy Storybook breeze gust
      if (noiseBuf) {
        const src = ctx.createBufferSource();
        const bp = ctx.createBiquadFilter();
        const g = ctx.createGain();
        src.buffer = noiseBuf;
        src.loop = true;
        bp.type = 'bandpass';
        bp.Q.value = 1.35;
        bp.frequency.setValueAtTime(420, t0);
        bp.frequency.exponentialRampToValueAtTime(1420, t0 + 0.72);
        bp.frequency.exponentialRampToValueAtTime(560, t0 + 1.85);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.22, t0 + 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
        src.connect(bp);
        bp.connect(g);
        connectOut(g, 0);
        src.start(t0, Math.random() * 0.5);
        src.stop(t0 + 1.95);
      }

      // Cascading pentatonic crystal wind-chimes (Fmaj9 breeze)
      const notes = [77, 81, 84, 88, 91, 93, 96];
      notes.forEach((m, idx) => {
        const nt = t0 + 0.08 + idx * 0.085;
        const f = mtof(m);
        const pan = ((idx % 2 === 0 ? -1 : 1) * (0.2 + idx * 0.08));
        playTone(nt, f, 1.25, { type: 'sine', vol: 0.075, attack: 0.004, pan });
        playTone(nt, f * 2.756, 0.55, { type: 'sine', vol: 0.022, attack: 0.002, pan: -pan * 0.6 });
      });
    },

    lanternDusk() {
      if (isMuted()) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime + 0.015;

      // Deep resonant temple bonshō bell strike
      const f0 = mtof(48); // C3
      const bellPartials = [
        [1.0, 0.16, 2.8],
        [1.504, 0.075, 2.2],
        [2.0, 0.065, 1.9],
        [2.414, 0.038, 1.4],
        [2.92, 0.024, 1.0],
      ];
      for (const [ratio, vol, dur] of bellPartials) {
        playTone(t0, f0 * ratio, dur, { type: 'sine', vol, attack: 0.006, detune: -3 });
        playTone(t0 + 0.004, f0 * ratio * 1.0018, dur * 0.92, { type: 'sine', vol: vol * 0.6, attack: 0.01, detune: 4 });
      }

      // Warm lantern twilight pad chord (Fmaj7#11 / Dm9 glow)
      const duskChord = [53, 60, 64, 67, 71];
      duskChord.forEach((m, i) => {
        const f = mtof(m);
        playTone(t0 + 0.12 + i * 0.04, f, 2.45, {
          type: 'triangle',
          vol: 0.052,
          attack: 0.42,
          hold: 0.45,
          lowpass: 1350,
          pan: (i - 2) * 0.22,
        });
      });
    },

    propBounty() {
      if (isMuted()) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime + 0.015;

      // Upbeat festival taiko + bouncy wooden marimba fanfare
      playTaiko(t0, 0.22, 132, -0.18);
      playTaiko(t0 + 0.14, 0.18, 148, 0.18);
      playTaiko(t0 + 0.44, 0.24, 124, 0);

      const fanfare = [
        [0.02, 65, -0.3],
        [0.11, 69, 0.25],
        [0.20, 72, -0.2],
        [0.29, 76, 0.2],
        [0.39, 79, -0.1],
        [0.48, 84, 0.0],
      ];
      for (const [dt, m, pan] of fanfare) {
        playMarimba(t0 + dt, m, 0.12, pan);
      }
    },

    overtimeFrenzy() {
      if (isMuted()) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime + 0.015;

      // Urgent festival taiko roll + rising G-major adrenaline fanfare
      playTaiko(t0, 0.24, 136, -0.25);
      playTaiko(t0 + 0.11, 0.20, 146, 0.25);
      playTaiko(t0 + 0.22, 0.22, 156, -0.15);
      playTaiko(t0 + 0.36, 0.28, 126, 0);

      const notes = [67, 71, 74, 79, 83, 86];
      notes.forEach((m, i) => {
        const nt = t0 + i * 0.072;
        const f = mtof(m);
        playMarimba(nt, m, 0.115, (i % 2 ? 0.25 : -0.25));
        playTone(nt, f, 0.52, {
          type: 'sawtooth',
          vol: 0.045,
          attack: 0.012,
          lowpass: 2200,
          pan: (i - 2.5) * 0.14,
        });
      });
    },

    windBoost() {
      if (isMuted()) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime + 0.01;
      [79, 84, 88, 91].forEach((m, i) => {
        playTone(t0 + i * 0.055, mtof(m), 0.55, { type: 'sine', vol: 0.085, attack: 0.004, pan: (i - 1.5) * 0.22 });
      });
    },

    rewardCoin() {
      if (isMuted()) return;
      const ctx = ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime + 0.01;
      playMarimba(t0, 81, 0.095, -0.12);
      playMarimba(t0 + 0.075, 88, 0.11, 0.12);
    },
  };
}

// ============================================================================
// Main World Events & Overtime Frenzy Manager
// ============================================================================
export function createWorldEventsManager(env = {}) {
  const { THREE } = env;
  const stingers = createEventStingerSynth(env);

  const getNowMs = () => {
    if (env && typeof env.now === 'function') return env.now();
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  };

  let rng = createMulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
  let scheduledEventType = EVENT_TYPES[0];
  let midRoundTriggered = false;
  let activeEvent = null;
  let bannerCompact = false;
  let compactBannerTimer = null;
  let overtimeActive = false;
  let visualClock = 0;

  function clearCompactTimer() {
    if (compactBannerTimer !== null) {
      clearTimeout(compactBannerTimer);
      compactBannerTimer = null;
    }
  }

  // Spirit Wind state
  const windBaselinePropByChar = new Map();
  const windBoostClaimedSet = new Set();
  const windBoostMap = new Map(); // ch -> { untilMs, remSec, lastNowMs }
  const lastKnownPropByChar = new Map();
  let propSwaps = []; // active 1.3s prop shuffle entries
  let swapElapsed = 0;
  let spiritWindRelocateTimer = 0;

  // Lantern Dusk state
  let baselineLighting = null;
  const duskState = {
    blend: 0,
    target: 0,
  };
  const duskPalette = THREE
    ? {
        skyTop: new THREE.Color(0x1c274c),
        skyMid: new THREE.Color(0x523b5e),
        skyLow: new THREE.Color(0xd97c54),
        fog: new THREE.Color(0x3a2e4f),
        hemiSky: new THREE.Color(0x8874b5),
        hemiGround: new THREE.Color(0x4d382c),
        sun: new THREE.Color(0xff9f59),
        panoTint: new THREE.Color(0x63507d),
      }
    : null;

  // Prop Bounty state
  const bountyAccumByChar = new Map();
  let bountyMorphCheckT = 0;
  let bountySpiritMorphCount = 0;

  // Overtime Frenzy state
  let localFrenzySurvivedSec = 0;

  // 3D Scene Groups & Handles
  let eventsRoot = null;
  let windVisuals = null;
  let duskVisuals = null;
  let bountyVisuals = null;
  let boostTrailVisuals = null;

  // UI DOM References
  const ui = {
    mounted: false,
    stack: null,
    eventBanner: null,
    eventIcon: null,
    eventTitle: null,
    eventTimer: null,
    eventSub: null,
    eventBonusPill: null,
    eventBarFill: null,
    overtimeBanner: null,
    frenzyEdgeGlow: null,
  };

  // --------------------------------------------------------------------------
  // UI Mounting & Live Updates
  // --------------------------------------------------------------------------
  function mountUI() {
    if (typeof document === 'undefined') return;

    // Defensive stylesheet check in case world_events.css wasn't linked yet
    if (document.head && !document.querySelector('link[href*="world_events.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'world_events.css';
      document.head.appendChild(link);
    }

    const appEl = document.getElementById('app') || document.body;
    const hudEl = document.getElementById('hud') || appEl;
    if (!appEl || !hudEl) return;

    // 1. Edge Glow inside #app
    let edgeGlow = document.getElementById('frenzyEdgeGlow');
    if (!edgeGlow) {
      edgeGlow = document.createElement('div');
      edgeGlow.id = 'frenzyEdgeGlow';
      edgeGlow.className = 'hidden';
      edgeGlow.setAttribute('aria-hidden', 'true');
      const vig = appEl.querySelector('.vignette');
      if (vig && vig.nextSibling) appEl.insertBefore(edgeGlow, vig.nextSibling);
      else appEl.appendChild(edgeGlow);
    }

    // 2. Stack container inside #hud
    let stack = hudEl.querySelector('.we-banner-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'we-banner-stack';
      hudEl.appendChild(stack);
    }

    // 3. Storybook Mid-Round Event Banner (#worldEventBanner)
    let eventBanner = document.getElementById('worldEventBanner');
    if (!eventBanner) {
      eventBanner = document.createElement('div');
      eventBanner.id = 'worldEventBanner';
      eventBanner.className = 'hidden';
      eventBanner.setAttribute('role', 'status');
      eventBanner.setAttribute('aria-live', 'polite');
      eventBanner.innerHTML =
        `<div class="we-row">` +
          `<div class="we-icon-wrap"><span id="worldEventIcon">🍃</span></div>` +
          `<div class="we-body">` +
            `<div class="we-hdr">` +
              `<div class="we-title-group">` +
                `<span class="we-kicker">World Twist</span>` +
                `<b id="worldEventTitle">Spirit Wind</b>` +
              `</div>` +
              `<span id="worldEventTimer">26s</span>` +
            `</div>` +
            `<p id="worldEventSub" class="we-desc"></p>` +
            `<div id="worldEventBonusPill" class="we-bonus-pill hidden"></div>` +
          `</div>` +
        `</div>` +
        `<div class="we-progress-track"><i id="worldEventBarFill"></i></div>`;
      stack.appendChild(eventBanner);
    }

    // 4. 0:30 Overtime Frenzy Pill (#overtimeBanner)
    let overtimeBanner = document.getElementById('overtimeBanner');
    if (!overtimeBanner) {
      overtimeBanner = document.createElement('div');
      overtimeBanner.id = 'overtimeBanner';
      overtimeBanner.className = 'hidden';
      overtimeBanner.setAttribute('role', 'status');
      overtimeBanner.innerHTML =
        `<span class="we-ot-desktop">⚡ FINAL 30s FRENZY · Faster nozzles, half-price water!</span>` +
        `<span class="we-ot-mobile" aria-hidden="true">🔥 FRENZY!</span>`;
      stack.appendChild(overtimeBanner);
    }

    ui.mounted = true;
    ui.stack = stack;
    ui.eventBanner = eventBanner;
    ui.eventIcon = document.getElementById('worldEventIcon');
    ui.eventTitle = document.getElementById('worldEventTitle');
    ui.eventTimer = document.getElementById('worldEventTimer');
    ui.eventSub = document.getElementById('worldEventSub');
    ui.eventBonusPill = document.getElementById('worldEventBonusPill');
    ui.eventBarFill = document.getElementById('worldEventBarFill');
    ui.overtimeBanner = overtimeBanner;
    ui.frenzyEdgeGlow = edgeGlow;
  }

  function syncUI() {
    if (!ui.mounted && typeof document !== 'undefined') mountUI();
    if (!ui.mounted) return;

    const G = env.G || {};
    const matchBox = typeof document !== 'undefined' ? document.getElementById('matchBox') : null;
    if (ui.stack && matchBox) {
      ui.stack.classList.toggle('below-match', !matchBox.classList.contains('hidden'));
    }

    const inPlayableHud = !G.over && G.phase !== 'menu' && G.phase !== 'vs';

    // Update #worldEventBanner
    if (ui.eventBanner) {
      if (activeEvent && inPlayableHud) {
        ui.eventBanner.classList.remove('hidden', 'is-spirit_wind', 'is-lantern_dusk', 'is-prop_bounty');
        ui.eventBanner.classList.add(`is-${activeEvent.type}`);
        ui.eventBanner.classList.toggle('is-compact', !!bannerCompact);
        if (ui.eventIcon && ui.eventIcon.textContent !== activeEvent.icon) {
          ui.eventIcon.textContent = activeEvent.icon;
        }
        const displayTitle = bannerCompact && activeEvent.compactTitle
          ? activeEvent.compactTitle
          : activeEvent.title;
        if (ui.eventTitle && ui.eventTitle.textContent !== displayTitle) {
          ui.eventTitle.textContent = displayTitle;
        }
        const subText = getEventBannerSubtitle(activeEvent);
        if (ui.eventSub && ui.eventSub.textContent !== subText) {
          ui.eventSub.textContent = subText;
        }
        if (ui.eventTimer) {
          const secTxt = `${Math.max(1, Math.ceil(activeEvent.remaining))}s`;
          if (ui.eventTimer.textContent !== secTxt) ui.eventTimer.textContent = secTxt;
        }
        if (ui.eventBarFill) {
          const pct = clamp((activeEvent.remaining / Math.max(1, activeEvent.duration)) * 100, 0, 100);
          ui.eventBarFill.style.width = `${pct.toFixed(1)}%`;
        }
        if (ui.eventBonusPill) {
          const pillTxt = bannerCompact ? '' : getLocalPlayerBonusPillText();
          ui.eventBonusPill.classList.toggle('hidden', !pillTxt);
          if (pillTxt && ui.eventBonusPill.textContent !== pillTxt) {
            ui.eventBonusPill.textContent = pillTxt;
          }
        }
      } else {
        ui.eventBanner.classList.add('hidden');
        ui.eventBanner.classList.remove('is-compact');
      }
    }

    // Update #overtimeBanner & #frenzyEdgeGlow
    const showOvertime = overtimeActive && inPlayableHud;
    if (ui.overtimeBanner) {
      ui.overtimeBanner.classList.toggle('hidden', !showOvertime);
      if (showOvertime) {
        ui.overtimeBanner.classList.toggle('is-final10', (G.t || 0) <= 10);
      }
    }
    if (ui.frenzyEdgeGlow) {
      ui.frenzyEdgeGlow.classList.toggle('hidden', !showOvertime);
    }
  }

  function getEventBannerSubtitle(ev) {
    const isSeek = env.G?.mode === 'seek';
    if (ev.type === 'spirit_wind') {
      return isSeek
        ? 'Props shuffled! Watch for 2× Breeze Spirits'
        : 'Props swapped! New morph = 2× Speed +30 🪙';
    }
    if (ev.type === 'lantern_dusk') {
      return isSeek
        ? 'Twilight falls! Sweep shadows with your lantern'
        : 'Twilight falls! Slip past golden Seeker lanterns';
    }
    if (ev.type === 'prop_bounty') {
      const [lA, lB] = ev.bountyLabels || ['Barrel', 'Crate'];
      return isSeek
        ? `Bounty: ${lA} & ${lB} — check big props!`
        : `Morph as ${lA} or ${lB} for +15 🪙 / 5s!`;
    }
    return '';
  }

  function getLocalPlayerBonusPillText() {
    const p = env.G?.player;
    if (!p || env.G?.mode !== 'hide' || env.G?.spectating || p.userData?.actor?.eliminated) return '';
    if (activeEvent?.type === 'spirit_wind') {
      const entry = windBoostMap.get(p);
      if (entry && entry.remSec > 0) {
        return `🍃 2× Spirit Wind Speed · ${entry.remSec.toFixed(1)}s`;
      }
      if (windBoostClaimedSet.has(p)) {
        return '✨ Wind Relocate Bonus Claimed (+30 🪙)';
      }
    }
    if (activeEvent?.type === 'prop_bounty' && Array.isArray(activeEvent.bountyProps)) {
      const pid = p.userData?.propId;
      if (pid && activeEvent.bountyProps.includes(pid)) {
        const kit = env.getKit?.();
        const lbl = kit?.props?.[pid]?.label || pid;
        const acc = bountyAccumByChar.get(p) || 0;
        const rem = Math.max(0.1, 5 - (acc % 5));
        return `⭐ Bounty Disguise (${lbl}) · Next +15 🪙 in ${rem.toFixed(1)}s`;
      }
    }
    return '';
  }

  // --------------------------------------------------------------------------
  // Baseline Atmosphere Capture & Guaranteed Restoration (Lantern Dusk)
  // --------------------------------------------------------------------------
  function findPanoramaSkyMesh() {
    const sc = env.scene;
    if (!sc || !Array.isArray(sc.children)) return null;
    for (const ch of sc.children) {
      if (ch && ch.isMesh && ch !== env.sky && ch.renderOrder === -1 && ch.material?.color) {
        return ch;
      }
    }
    return null;
  }

  function captureBaselineLightingIfNeeded() {
    if (baselineLighting || !THREE) return;
    const skyU = env.sky?.material?.uniforms;
    const fog = env.scene?.fog;
    const hemi = env.hemiLight;
    const sun = env.sun;
    const pano = findPanoramaSkyMesh();

    baselineLighting = {
      skyTop: skyU?.top?.value?.clone ? skyU.top.value.clone() : null,
      skyMid: skyU?.mid?.value?.clone ? skyU.mid.value.clone() : null,
      skyLow: skyU?.low?.value?.clone ? skyU.low.value.clone() : null,
      fogColor: fog?.color?.clone ? fog.color.clone() : null,
      fogNear: typeof fog?.near === 'number' ? fog.near : null,
      fogFar: typeof fog?.far === 'number' ? fog.far : null,
      hemiSky: hemi?.color?.clone ? hemi.color.clone() : null,
      hemiGround: hemi?.groundColor?.clone ? hemi.groundColor.clone() : null,
      hemiInt: typeof hemi?.intensity === 'number' ? hemi.intensity : null,
      sunColor: sun?.color?.clone ? sun.color.clone() : null,
      sunInt: typeof sun?.intensity === 'number' ? sun.intensity : null,
      panoMesh: pano,
      panoColor: pano?.material?.color?.clone ? pano.material.color.clone() : null,
    };
  }

  function applyDuskBlend(rawT) {
    if (!baselineLighting || !duskPalette) return;
    const b = smooth01(rawT);
    const skyU = env.sky?.material?.uniforms;
    const fog = env.scene?.fog;
    const hemi = env.hemiLight;
    const sun = env.sun;

    if (skyU?.top?.value && baselineLighting.skyTop) {
      skyU.top.value.copy(baselineLighting.skyTop).lerp(duskPalette.skyTop, b);
    }
    if (skyU?.mid?.value && baselineLighting.skyMid) {
      skyU.mid.value.copy(baselineLighting.skyMid).lerp(duskPalette.skyMid, b);
    }
    if (skyU?.low?.value && baselineLighting.skyLow) {
      skyU.low.value.copy(baselineLighting.skyLow).lerp(duskPalette.skyLow, b);
    }
    if (fog?.color && baselineLighting.fogColor) {
      fog.color.copy(baselineLighting.fogColor).lerp(duskPalette.fog, b);
      if (baselineLighting.fogNear != null) {
        fog.near = lerp(baselineLighting.fogNear, Math.min(baselineLighting.fogNear, 24), b * 0.65);
      }
      if (baselineLighting.fogFar != null) {
        fog.far = lerp(baselineLighting.fogFar, Math.min(baselineLighting.fogFar, 94), b * 0.45);
      }
    }
    if (hemi) {
      if (hemi.color && baselineLighting.hemiSky) {
        hemi.color.copy(baselineLighting.hemiSky).lerp(duskPalette.hemiSky, b);
      }
      if (hemi.groundColor && baselineLighting.hemiGround) {
        hemi.groundColor.copy(baselineLighting.hemiGround).lerp(duskPalette.hemiGround, b);
      }
      if (baselineLighting.hemiInt != null) {
        hemi.intensity = lerp(baselineLighting.hemiInt, 0.55, b);
      }
    }
    if (sun) {
      if (sun.color && baselineLighting.sunColor) {
        sun.color.copy(baselineLighting.sunColor).lerp(duskPalette.sun, b);
      }
      if (baselineLighting.sunInt != null) {
        sun.intensity = lerp(baselineLighting.sunInt, 0.55, b);
      }
    }
    const pano = baselineLighting.panoMesh || findPanoramaSkyMesh();
    if (pano?.material?.color && baselineLighting.panoColor) {
      pano.material.color.copy(baselineLighting.panoColor).lerp(duskPalette.panoTint, b * 0.85);
    }
  }

  function restoreBaselineLightingImmediate() {
    duskState.blend = 0;
    duskState.target = 0;
    if (!baselineLighting) return;

    const skyU = env.sky?.material?.uniforms;
    const fog = env.scene?.fog;
    const hemi = env.hemiLight;
    const sun = env.sun;

    if (skyU?.top?.value && baselineLighting.skyTop) skyU.top.value.copy(baselineLighting.skyTop);
    if (skyU?.mid?.value && baselineLighting.skyMid) skyU.mid.value.copy(baselineLighting.skyMid);
    if (skyU?.low?.value && baselineLighting.skyLow) skyU.low.value.copy(baselineLighting.skyLow);

    if (fog) {
      if (fog.color && baselineLighting.fogColor) fog.color.copy(baselineLighting.fogColor);
      if (baselineLighting.fogNear != null) fog.near = baselineLighting.fogNear;
      if (baselineLighting.fogFar != null) fog.far = baselineLighting.fogFar;
    }
    if (hemi) {
      if (hemi.color && baselineLighting.hemiSky) hemi.color.copy(baselineLighting.hemiSky);
      if (hemi.groundColor && baselineLighting.hemiGround) hemi.groundColor.copy(baselineLighting.hemiGround);
      if (baselineLighting.hemiInt != null) hemi.intensity = baselineLighting.hemiInt;
    }
    if (sun) {
      if (sun.color && baselineLighting.sunColor) sun.color.copy(baselineLighting.sunColor);
      if (baselineLighting.sunInt != null) sun.intensity = baselineLighting.sunInt;
    }
    if (baselineLighting.panoMesh?.material?.color && baselineLighting.panoColor) {
      baselineLighting.panoMesh.material.color.copy(baselineLighting.panoColor);
    }

    baselineLighting = null;
  }

  // --------------------------------------------------------------------------
  // 3D Scene Helpers & Clean Disposal
  // --------------------------------------------------------------------------
  function ensureEventsRoot() {
    if (!THREE || !env.scene || typeof THREE.Group !== 'function') return null;
    if (!eventsRoot) {
      eventsRoot = new THREE.Group();
      eventsRoot.name = 'worldEventsRoot';
    }
    if (!eventsRoot.parent) {
      env.scene.add(eventsRoot);
    }
    return eventsRoot;
  }

  function disposeGroupChildren(grp) {
    if (!grp) return;
    if (typeof grp.traverse === 'function') {
      const geos = new Set();
      const mats = new Set();
      grp.traverse((obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') geos.add(obj.geometry);
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => { if (m && typeof m.dispose === 'function') mats.add(m); });
          } else if (typeof obj.material.dispose === 'function') {
            mats.add(obj.material);
          }
        }
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    }
    if (grp.parent) grp.parent.remove(grp);
  }

  function clearWindVisuals() {
    if (windVisuals?.group) disposeGroupChildren(windVisuals.group);
    windVisuals = null;
  }

  function clearDuskVisuals() {
    if (duskVisuals?.group) disposeGroupChildren(duskVisuals.group);
    duskVisuals = null;
  }

  function clearBountyVisuals() {
    if (bountyVisuals?.group) disposeGroupChildren(bountyVisuals.group);
    bountyVisuals = null;
  }

  function clearBoostTrailVisuals() {
    if (boostTrailVisuals?.group) disposeGroupChildren(boostTrailVisuals.group);
    boostTrailVisuals = null;
  }

  // --------------------------------------------------------------------------
  // Event A: SPIRIT WIND (3D Wind Ribbons, 40 Leaves, 8–12 Prop Swaps & 2× Boost)
  // --------------------------------------------------------------------------
  function buildRibbonGeometry(segCount = 26, length = 7.8, maxWidth = 0.24) {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array((segCount + 1) * 2 * 3);
    const cols = new Float32Array((segCount + 1) * 2 * 3);
    for (let i = 0; i <= segCount; i++) {
      const u = i / segCount;
      const taper = Math.sin(u * Math.PI);
      const w = maxWidth * taper;
      const z = (u - 0.5) * length;
      const x = Math.sin(u * Math.PI * 2.2) * 0.55;
      const y = Math.cos(u * Math.PI * 1.6) * 0.22;

      const idx = i * 6;
      verts[idx] = x;
      verts[idx + 1] = y - w;
      verts[idx + 2] = z;
      verts[idx + 3] = x;
      verts[idx + 4] = y + w;
      verts[idx + 5] = z;

      const glow = 0.55 + 0.45 * taper;
      cols[idx] = 0.84 * glow;
      cols[idx + 1] = 0.99 * glow;
      cols[idx + 2] = 0.89 * glow;
      cols[idx + 3] = 0.96 * glow;
      cols[idx + 4] = 1.0 * glow;
      cols[idx + 5] = 0.88 * glow;
    }
    const indices = [];
    for (let i = 0; i < segCount; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setIndex(indices);
    return geo;
  }

  function spawnSpiritWindVisuals() {
    clearWindVisuals();
    const root = ensureEventsRoot();
    if (!root || !THREE?.BufferGeometry || !THREE?.InstancedMesh) return;

    const group = new THREE.Group();
    group.name = 'spiritWindGroup';
    root.add(group);

    const mapR = Math.max(14, env.getMapRadius?.() || 28);

    // 1. 7 Swirling Storybook Wind Ribbons
    const ribbonGeo = buildRibbonGeometry(26, 8.2, 0.22);
    const ribbonMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ribbons = [];
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(ribbonGeo, ribbonMat);
      const orbitR = mapR * (0.2 + (i / 7) * 0.58);
      const phase = (i / 7) * Math.PI * 2 + rng() * 0.6;
      const baseY = 1.15 + (i % 3) * 0.95 + rng() * 0.45;
      const speed = (0.38 + rng() * 0.24) * (i % 2 === 0 ? 1 : -1);
      group.add(mesh);
      ribbons.push({ mesh, orbitR, phase, baseY, speed, tilt: (rng() - 0.5) * 0.28 });
    }

    // 2. 40 Drifting Storybook Leaves & Blossom Petals (single InstancedMesh)
    const leafCount = 40;
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, -0.14,
      0.085, 0.015, 0,
      0, 0, 0.14,
      -0.085, -0.015, 0,
    ], 3));
    leafGeo.setIndex([0, 1, 2, 0, 2, 3]);
    leafGeo.computeVertexNormals();

    const leafMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    leafInst.frustumCulled = false;
    const palette = [0x89d973, 0xb8ee99, 0xffe094, 0xffbfd1, 0x7bc98d, 0xfff0b8];
    const tmpCol = new THREE.Color();
    const leaves = [];
    for (let i = 0; i < leafCount; i++) {
      const ang = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * mapR * 0.85;
      leaves.push({
        x: Math.cos(ang) * dist,
        y: 0.55 + rng() * 4.8,
        z: Math.sin(ang) * dist,
        vx: 2.3 + rng() * 1.9,
        vz: 1.1 + (rng() - 0.5) * 1.6,
        swirl: rng() * Math.PI * 2,
        spinX: rng() * 6.28,
        spinY: rng() * 6.28,
        spinZ: rng() * 6.28,
        scale: 0.75 + rng() * 0.75,
      });
      if (typeof leafInst.setColorAt === 'function') {
        leafInst.setColorAt(i, tmpCol.setHex(palette[i % palette.length]));
      }
    }
    if (leafInst.instanceColor) leafInst.instanceColor.needsUpdate = true;
    group.add(leafInst);

    windVisuals = {
      group,
      ribbonMat,
      ribbons,
      leafInst,
      leafMat,
      leaves,
      mapR,
      tmpMat: new THREE.Matrix4(),
      tmpPos: new THREE.Vector3(),
      tmpQuat: new THREE.Quaternion(),
      tmpEuler: new THREE.Euler(),
      tmpScale: new THREE.Vector3(),
    };
  }

  function findMatchingPropBlocker(rec, usedBlockers) {
    const list = env.blockers;
    if (!Array.isArray(list) || !rec?.pos) return null;
    let best = null;
    let bestD = 0.48;
    const ry = rec.pos.y || 0;
    for (const b of list) {
      if (!b || !b.isProp || usedBlockers.has(b)) continue;
      const cx = (b.x0 + b.x1) * 0.5;
      const cz = (b.z0 + b.z1) * 0.5;
      const by = typeof b.y === 'number' ? b.y : ((b.y0 ?? -0.25) + 0.25);
      if (Math.abs(by - ry) > 0.75) continue;
      const d = Math.hypot(cx - rec.pos.x, cz - rec.pos.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) usedBlockers.add(best);
    return best;
  }

  function startSpiritWindPropSwaps() {
    finishActivePropSwapsImmediate();
    const props = env.realProps;
    if (!Array.isArray(props) || props.length < 2) return;

    const kit = env.getKit?.();
    const allChars = [
      env.G?.player,
      ...(env.G?.allHiders || env.G?.hiders || []),
      ...(env.G?.allSeekers || env.G?.seekers || []),
    ].filter(Boolean);

    // Filter small/medium realProps not currently perched on by any character
    let eligible = props.filter((rec) => {
      if (!rec || !rec.g || !rec.pos) return false;
      const def = kit?.props?.[rec.id];
      const rad = rec.radius || def?.radius || 0.45;
      const ht = def?.height || 0.95;
      if (rad > 0.74 || ht > 1.72) return false;
      const someonePerched = allChars.some((c) => {
        if (!c?.position) return false;
        const hd = Math.hypot(c.position.x - rec.pos.x, c.position.z - rec.pos.z);
        return hd < rad + 0.35 && ((c.userData?.groundY || 0) > (rec.pos.y || 0) + 0.25);
      });
      return !someonePerched;
    });

    if (eligible.length < 16) {
      eligible = props.filter((rec) => rec && rec.g && rec.pos);
    }
    if (eligible.length < 2) return;

    // Deterministic Fisher-Yates shuffle, then pair props of compatible footprint radius
    const pool = eligible.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    pool.sort((a, b) => (a.radius || 0.45) - (b.radius || 0.45));

    const maxPairs = Math.floor(pool.length / 2);
    const wantPairs = clamp(8 + Math.floor(rng() * 5), 1, Math.min(12, maxPairs)); // 8–12 pairs when map has >=16 props

    // Pick evenly spaced adjacent-radius pairs, shuffled deterministically
    const candidatePairs = [];
    for (let i = 0; i + 1 < pool.length; i += 2) {
      candidatePairs.push([pool[i], pool[i + 1]]);
    }
    for (let i = candidatePairs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = candidatePairs[i];
      candidatePairs[i] = candidatePairs[j];
      candidatePairs[j] = tmp;
    }

    const chosenPairs = candidatePairs.slice(0, wantPairs);
    const usedBlockers = new Set();
    const entries = [];

    for (const [recA, recB] of chosenPairs) {
      const blkA = findMatchingPropBlocker(recA, usedBlockers);
      const blkB = findMatchingPropBlocker(recB, usedBlockers);

      const ax = recA.pos.x, ay = recA.pos.y || 0, az = recA.pos.z, aRot = recA.g.rotation?.y || 0;
      const bx = recB.pos.x, by = recB.pos.y || 0, bz = recB.pos.z, bRot = recB.g.rotation?.y || 0;

      entries.push(makeSwapEntry(recA, blkA, ax, ay, az, aRot, bx, by, bz, bRot));
      entries.push(makeSwapEntry(recB, blkB, bx, by, bz, bRot, ax, ay, az, aRot));
    }

    propSwaps = entries;
    swapElapsed = 0;
  }

  function makeSwapEntry(rec, blk, x0, y0, z0, rot0, x1, y1, z1, rot1) {
    const r = (rec.radius || 0.45) * 0.78;
    const bHalfX = blk ? (blk.x1 - blk.x0) * 0.5 : r;
    const bHalfZ = blk ? (blk.z1 - blk.z0) * 0.5 : r;
    const baseY = blk ? (typeof blk.y === 'number' ? blk.y : (blk.y0 ?? -0.25) + 0.25) : y0;
    const bHeight = blk && blk.y1 != null ? Math.max(0.25, blk.y1 - baseY) : 1.0;
    return { rec, blk, bHalfX, bHalfZ, bHeight, x0, y0, z0, rot0, x1, y1, z1, rot1 };
  }

  function applySwapPosition(entry, tNorm) {
    const s = smooth01(tNorm);
    const hopArc = tNorm >= 1 ? 0 : Math.sin(tNorm * Math.PI) * 0.42;
    const nx = lerp(entry.x0, entry.x1, s);
    const baseY = lerp(entry.y0, entry.y1, s);
    const ny = baseY + hopArc;
    const nz = lerp(entry.z0, entry.z1, s);

    if (entry.rec.g?.position) {
      entry.rec.g.position.set(nx, ny, nz);
    }
    if (entry.rec.pos && entry.rec.pos !== entry.rec.g?.position && typeof entry.rec.pos.set === 'function') {
      entry.rec.pos.set(nx, ny, nz);
    } else if (entry.rec.pos && entry.rec.pos !== entry.rec.g?.position) {
      entry.rec.pos.x = nx;
      entry.rec.pos.y = ny;
      entry.rec.pos.z = nz;
    }
    if (entry.rec.g?.rotation) {
      entry.rec.g.rotation.y = tNorm >= 1
        ? entry.rot1
        : entry.rot0 + s * (entry.rot1 - entry.rot0 + Math.PI * 2);
    }
    if (typeof entry.rec.g?.updateMatrixWorld === 'function') {
      entry.rec.g.updateMatrixWorld(true);
    }
    if (entry.blk) {
      env.blockers?.markMoved?.(entry.blk);
      entry.blk.x0 = nx - entry.bHalfX;
      entry.blk.x1 = nx + entry.bHalfX;
      entry.blk.z0 = nz - entry.bHalfZ;
      entry.blk.z1 = nz + entry.bHalfZ;
      entry.blk.y = baseY;
      entry.blk.y0 = baseY - 0.25;
      entry.blk.y1 = baseY + entry.bHeight;
    }
  }

  function finishActivePropSwapsImmediate() {
    if (!propSwaps.length) return;
    for (const entry of propSwaps) {
      applySwapPosition(entry, 1);
    }
    propSwaps = [];
    swapElapsed = 0;
  }

  function updateSpiritWind(dt) {
    // 1. Step 1.3s prop position swap lerp
    if (propSwaps.length > 0) {
      swapElapsed += dt;
      const tNorm = clamp(swapElapsed / WIND_SWAP_DUR_SEC, 0, 1);
      for (const entry of propSwaps) {
        applySwapPosition(entry, tNorm);
      }
      if (tNorm >= 1) {
        propSwaps = [];
      }
    }

    // 2. Animate 3D swirling Storybook wind ribbons & 40 drifting leaves
    if (windVisuals && activeEvent?.type === 'spirit_wind') {
      const elapsed = activeEvent.duration - activeEvent.remaining;
      const fadeIn = smooth01(elapsed / 1.1);
      const fadeOut = smooth01(activeEvent.remaining / 1.8);
      const vis = fadeIn * fadeOut;

      windVisuals.ribbonMat.opacity = 0.42 * vis;
      windVisuals.leafMat.opacity = 0.92 * vis;

      for (const r of windVisuals.ribbons) {
        const ang = r.phase + visualClock * r.speed;
        const x = Math.cos(ang) * r.orbitR;
        const z = Math.sin(ang) * r.orbitR;
        const y = r.baseY + Math.sin(visualClock * 1.7 + r.phase) * 0.45;
        r.mesh.position.set(x, y, z);
        r.mesh.rotation.set(
          r.tilt + Math.sin(visualClock * 1.3 + r.phase) * 0.14,
          -ang + (r.speed > 0 ? 0 : Math.PI),
          Math.cos(visualClock * 1.9 + r.phase) * 0.18
        );
      }

      const maxBound = windVisuals.mapR * 0.92;
      const { tmpMat, tmpPos, tmpQuat, tmpEuler, tmpScale } = windVisuals;
      for (let i = 0; i < windVisuals.leaves.length; i++) {
        const lf = windVisuals.leaves[i];
        lf.swirl += dt * 2.1;
        lf.x += (lf.vx + Math.cos(lf.swirl) * 1.15) * dt;
        lf.z += (lf.vz + Math.sin(lf.swirl * 0.85) * 1.15) * dt;
        lf.y += Math.sin(lf.swirl * 1.3 + i) * 0.55 * dt;
        if (lf.y < 0.35) lf.y = 4.6;
        if (lf.y > 5.4) lf.y = 0.65;
        if (lf.x > maxBound) lf.x = -maxBound;
        if (lf.x < -maxBound) lf.x = maxBound;
        if (lf.z > maxBound) lf.z = -maxBound;
        if (lf.z < -maxBound) lf.z = maxBound;

        lf.spinX += dt * 2.6;
        lf.spinY += dt * 3.1;
        lf.spinZ += dt * 1.9;
        tmpPos.set(lf.x, lf.y, lf.z);
        tmpEuler.set(lf.spinX, lf.spinY, lf.spinZ);
        tmpQuat.setFromEuler(tmpEuler);
        tmpScale.setScalar(lf.scale);
        tmpMat.compose(tmpPos, tmpQuat, tmpScale);
        windVisuals.leafInst.setMatrixAt(i, tmpMat);
      }
      windVisuals.leafInst.instanceMatrix.needsUpdate = true;
    }

    // 3. Occasional non-player Spirit morph to ride the wind when safe
    if (activeEvent?.type === 'spirit_wind') {
      spiritWindRelocateTimer += dt;
      if (spiritWindRelocateTimer >= 4.2) {
        spiritWindRelocateTimer = 0;
        maybeTriggerNonPlayerWindMorph();
      }
    }
  }

  function maybeTriggerNonPlayerWindMorph() {
    const hiders = getLivingHiders();
    const seekers = getLivingSeekers();
    const props = env.realProps || [];
    if (!props.length) return;

    for (const h of hiders) {
      if (h === env.G?.player || windBoostClaimedSet.has(h)) continue;
      if (!h.userData?.actor?.isBot || h.userData?.actor?.isRemote || h.userData?.specialMode) continue;
      const nearSeeker = seekers.some((s) => (
        s?.position && h?.position && Math.hypot(s.position.x - h.position.x, s.position.z - h.position.z) < 12
      ));
      if (nearSeeker || rng() > 0.35) continue;

      const curProp = h.userData?.propId;
      const nearbyAlt = props.find((r) => (
        r && r.id && r.id !== curProp && r.pos &&
        Math.hypot(r.pos.x - h.position.x, r.pos.z - h.position.z) < 5.5
      ));
      if (nearbyAlt && applySafeNonPlayerMorph(h, nearbyAlt)) {
        onHiderTransformed(h, nearbyAlt.id);
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Event B: LANTERN DUSK (3D Seeker Lantern Cones & Floating Golden Fireflies)
  // --------------------------------------------------------------------------
  function buildSoftLanternConeGeometry(radius = 1.75, length = 8.4, radialSegs = 22) {
    const geo = new THREE.ConeGeometry(radius, length, radialSegs, 1, true);
    // Shift cone so apex is at origin (0,0,0) and beam extends along +Z!
    geo.translate(0, -length * 0.5, 0);
    geo.rotateX(-Math.PI * 0.5);

    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i); // 0 at lantern tip -> +length at far open end
      const u = clamp(z / length, 0, 1);
      const fade = Math.pow(1 - u, 1.65);
      cols[i * 3] = 1.0 * fade;
      cols[i * 3 + 1] = (0.78 - 0.16 * u) * fade;
      cols[i * 3 + 2] = (0.38 - 0.22 * u) * fade;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return geo;
  }

  function spawnLanternDuskVisuals() {
    clearDuskVisuals();
    const root = ensureEventsRoot();
    if (!root || !THREE?.Group) return;

    const group = new THREE.Group();
    group.name = 'lanternDuskGroup';
    root.add(group);

    // 1. Seeker Lantern Cones + Warm SpotLights ahead of each Seeker in G.allSeekers
    const coneGeo = buildSoftLanternConeGeometry(1.85, 8.6, 22);
    const coneMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const orbGeo = new THREE.SphereGeometry(0.125, 10, 8);
    const orbMat = new THREE.MeshBasicMaterial({
      color: 0xffe8a6,
      transparent: true,
      opacity: 0,
    });

    const seekers = getAllSeekers();
    const rigs = seekers.map((seeker) => {
      const rigGroup = new THREE.Group();
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      const orbMesh = new THREE.Mesh(orbGeo, orbMat);
      rigGroup.add(coneMesh);
      rigGroup.add(orbMesh);

      let light = null;
      let target = null;
      if (env.duskRealLights?.() === false) {
        // Lite quality: no real light, the cone and orb carry the look
      } else if (typeof THREE.SpotLight === 'function') {
        const isLocalFP = seeker === env.G?.player && env.G?.mode === 'seek';
        light = new THREE.SpotLight(0xffb457, 0, isLocalFP ? 18 : 14.5, Math.PI * 0.27, 0.68, 1.15);
        light.castShadow = false;
        target = new THREE.Object3D();
        target.position.set(0, -0.35, 8.0);
        rigGroup.add(light);
        rigGroup.add(target);
        light.target = target;
      } else if (typeof THREE.PointLight === 'function') {
        light = new THREE.PointLight(0xffb457, 0, 12, 1.3);
        light.position.set(0, 0, 2.2);
        rigGroup.add(light);
      }

      group.add(rigGroup);
      return { seeker, rigGroup, coneMesh, orbMesh, light, target };
    });

    // 2. Floating Golden Lantern Fireflies around Map Props
    const props = Array.isArray(env.realProps) ? env.realProps : [];
    const lanternKeywords = /lantern|lamp|candle|crystal|stove|orrery|samovar/i;
    const glowingAnchors = props.filter((p) => p?.pos && lanternKeywords.test(p.id || ''));
    const otherAnchors = props.filter((p) => p?.pos && !lanternKeywords.test(p.id || ''));
    const anchors = [...glowingAnchors, ...otherAnchors.slice(0, 18)];
    const mapR = Math.max(12, env.getMapRadius?.() || 26);

    const fireflyCount = 46;
    const flyGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const flyMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const flyInst = new THREE.InstancedMesh(flyGeo, flyMat, fireflyCount);
    flyInst.frustumCulled = false;

    const flyColors = [0xffe484, 0xffae47, 0xfff4bd, 0xffc861];
    const tmpCol = new THREE.Color();
    const fireflies = [];
    for (let i = 0; i < fireflyCount; i++) {
      let ax = 0, ay = 0.6, az = 0;
      if (anchors.length > 0) {
        const pickRec = anchors[i % anchors.length];
        ax = pickRec.pos.x;
        ay = (pickRec.pos.y || 0) + 0.65;
        az = pickRec.pos.z;
      } else {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * mapR * 0.7;
        ax = Math.cos(a) * d;
        az = Math.sin(a) * d;
      }
      fireflies.push({
        ax,
        ay,
        az,
        orbitR: 0.45 + rng() * 1.45,
        heightOff: rng() * 1.45,
        speed: (0.75 + rng() * 1.15) * (i % 2 === 0 ? 1 : -1),
        phase: rng() * Math.PI * 2,
        pulseSpeed: 2.2 + rng() * 2.6,
      });
      if (typeof flyInst.setColorAt === 'function') {
        flyInst.setColorAt(i, tmpCol.setHex(flyColors[i % flyColors.length]));
      }
    }
    if (flyInst.instanceColor) flyInst.instanceColor.needsUpdate = true;
    group.add(flyInst);

    // Subtle warm point lights on up to 3 lantern props so dusk plazas glow warmly
    const propLights = [];
    if (typeof THREE.PointLight === 'function' && anchors.length > 0 && env.duskRealLights?.() !== false) {
      const step = Math.max(1, Math.floor(anchors.length / 3));
      for (let k = 0; k < 3 && k * step < anchors.length; k++) {
        const a = anchors[k * step];
        const pl = new THREE.PointLight(0xffad52, 0, 9.5, 1.6);
        pl.position.set(a.pos.x, (a.pos.y || 0) + 1.35, a.pos.z);
        group.add(pl);
        propLights.push(pl);
      }
    }

    duskVisuals = {
      group,
      coneMat,
      orbMat,
      rigs,
      flyInst,
      flyMat,
      fireflies,
      propLights,
      tmpMat: new THREE.Matrix4(),
      tmpPos: new THREE.Vector3(),
      tmpQuat: new THREE.Quaternion(),
      tmpScale: new THREE.Vector3(),
    };
  }

  function updateDuskLightingAndVisuals(dt) {
    if (!baselineLighting && duskState.target === 0) return;

    // Crossfade dusk blend smoothly over 2.2s in both directions
    const step = dt / DUSK_FADE_SEC;
    if (duskState.blend < duskState.target) {
      duskState.blend = Math.min(duskState.target, duskState.blend + step);
    } else if (duskState.blend > duskState.target) {
      duskState.blend = Math.max(duskState.target, duskState.blend - step);
    }

    if (duskState.target === 0 && duskState.blend <= 0.0005) {
      restoreBaselineLightingImmediate();
      clearDuskVisuals();
      return;
    }

    applyDuskBlend(duskState.blend);

    if (duskVisuals && duskVisuals.rigs.length === 0 && duskState.target > 0 && getAllSeekers().length > 0) {
      spawnLanternDuskVisuals();
    }
    if (!duskVisuals) return;
    const b = smooth01(duskState.blend);
    duskVisuals.coneMat.opacity = 0.23 * b;
    duskVisuals.orbMat.opacity = 0.92 * b;
    duskVisuals.flyMat.opacity = 0.9 * b;

    for (const pl of duskVisuals.propLights) {
      pl.intensity = 1.45 * b;
    }

    // Sync Seeker Lantern Rigs
    const G = env.G || {};
    for (const rig of duskVisuals.rigs) {
      const s = rig.seeker;
      if (!s || !s.position) {
        rig.rigGroup.visible = false;
        continue;
      }
      rig.rigGroup.visible = true;
      const isLocalFirstPerson = s === G.player && G.mode === 'seek' && !G.spectating;

      if (isLocalFirstPerson) {
        // First-person Seeker: cast golden lantern beam from just below camera along G.yaw / G.pitch
        const yaw = G.yaw || 0;
        const pitch = clamp((G.pitch || 0) * 0.72, -0.75, 0.55);
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        const py = (s.userData?.groundY ?? s.position.y ?? 0) + (s.userData?.jy || 0) + 1.18;

        rig.rigGroup.position.set(
          s.position.x + rx * 0.22 + fx * 0.35,
          py,
          s.position.z + rz * 0.22 + fz * 0.35
        );
        // Align +Z of rigGroup along (fx, sin(pitch), fz)
        rig.rigGroup.rotation.set(-pitch, Math.atan2(fx, fz), 0, 'YXZ');
        rig.orbMesh.visible = false;
        if (rig.light) rig.light.intensity = 3.6 * b;
      } else {
        // Third-person Seeker: handheld golden lantern ahead of chest along s.rotation.y
        const faceYaw = s.rotation?.y || 0;
        const fx = Math.sin(faceYaw);
        const fz = Math.cos(faceYaw);
        const rx = Math.cos(faceYaw);
        const rz = -Math.sin(faceYaw);
        const bob = Math.sin(visualClock * 5.2 + (s.userData?.actor?.slotIdx || 0)) * 0.03;
        const py = (s.position.y || 0) + 1.05 + bob;

        rig.rigGroup.position.set(
          s.position.x + fx * 0.42 + rx * 0.2,
          py,
          s.position.z + fz * 0.42 + rz * 0.2
        );
        rig.rigGroup.rotation.set(0.08, faceYaw, 0, 'YXZ');
        rig.orbMesh.visible = true;
        if (rig.light) rig.light.intensity = 2.85 * b;
      }
    }

    // Animate Floating Golden Lantern Fireflies
    const { tmpMat, tmpPos, tmpQuat, tmpScale } = duskVisuals;
    tmpQuat.identity();
    for (let i = 0; i < duskVisuals.fireflies.length; i++) {
      const f = duskVisuals.fireflies[i];
      const ang = f.phase + visualClock * f.speed;
      const x = f.ax + Math.cos(ang) * f.orbitR;
      const z = f.az + Math.sin(ang * 0.9) * f.orbitR;
      const y = f.ay + f.heightOff + Math.sin(visualClock * 1.8 + f.phase) * 0.28;
      const twinkle = 0.55 + 0.65 * (0.5 + 0.5 * Math.sin(visualClock * f.pulseSpeed + f.phase));
      tmpPos.set(x, y, z);
      tmpScale.setScalar(twinkle * b);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      duskVisuals.flyInst.setMatrixAt(i, tmpMat);
    }
    duskVisuals.flyInst.instanceMatrix.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Event C: BIG PROP BOUNTY (2 Larger Map Props, +15 🪙 / 5s & Star Sparkles)
  // --------------------------------------------------------------------------
  function pickBountyPropsForMap() {
    const kit = env.getKit?.() || { props: {} };
    const realProps = Array.isArray(env.realProps) ? env.realProps : [];

    // Unique prop IDs currently placed on the active map
    const mapPropIds = [];
    const seen = new Set();
    for (const r of realProps) {
      if (r?.id && !seen.has(r.id) && kit.props?.[r.id]) {
        seen.add(r.id);
        mapPropIds.push(r.id);
      }
    }
    if (mapPropIds.length < 2) {
      for (const id of Object.keys(kit.props || {})) {
        if (!seen.has(id)) {
          seen.add(id);
          mapPropIds.push(id);
        }
      }
    }

    const shuffleDet = (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    };

    const bigPool = shuffleDet(
      mapPropIds.filter((id) => {
        const def = kit.props?.[id] || {};
        return (def.radius || 0.45) >= 0.47 || (def.height || 0.9) >= 0.95;
      })
    );
    const fallbackPool = shuffleDet(mapPropIds.filter((id) => !bigPool.includes(id)));

    const chosen = [...bigPool, ...fallbackPool].slice(0, 2);
    if (chosen.length === 0) chosen.push('barrel', 'crate');
    else if (chosen.length === 1) chosen.push(chosen[0] === 'barrel' ? 'crate' : 'barrel');

    const labels = chosen.map((id) => kit.props?.[id]?.label || id);
    return { ids: chosen, labels };
  }

  function buildStarSparkleGeometry(outerR = 0.085, innerR = 0.032) {
    const geo = new THREE.BufferGeometry();
    const pts = [0, 0, 0.018]; // center front
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? outerR : innerR;
      pts.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    }
    pts.push(0, 0, -0.018); // center back
    const indices = [];
    for (let i = 1; i <= 8; i++) {
      const next = i === 8 ? 1 : i + 1;
      indices.push(0, i, next);
      indices.push(9, next, i);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function spawnPropBountyVisuals(bountyIds) {
    clearBountyVisuals();
    const root = ensureEventsRoot();
    if (!root || !THREE?.Group || !THREE?.InstancedMesh) return;

    const group = new THREE.Group();
    group.name = 'propBountyGroup';
    root.add(group);

    // 1. Subtle golden ground halos under up to 10 real map instances of the 2 bounty props
    const halos = [];
    if (typeof THREE.RingGeometry === 'function') {
      const ringGeo = new THREE.RingGeometry(0.76, 0.92, 28);
      ringGeo.rotateX(-Math.PI * 0.5);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffcf5c,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const matches = (env.realProps || []).filter((r) => r?.pos && bountyIds.includes(r.id)).slice(0, 10);
      for (const rec of matches) {
        const m = new THREE.Mesh(ringGeo, ringMat);
        const rad = (rec.radius || 0.52) + 0.18;
        m.position.set(rec.pos.x, (rec.pos.y || 0) + 0.035, rec.pos.z);
        m.scale.setScalar(rad);
        group.add(m);
        halos.push({ mesh: m, baseScale: rad, phase: rng() * Math.PI * 2 });
      }
    }

    // 2. Celebratory Golden Star Sparkles pool (up to 5 living hiders × 6 stars = 30 instances)
    const maxStars = 30;
    const starGeo = buildStarSparkleGeometry(0.085, 0.034);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xffdf72,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const starInst = new THREE.InstancedMesh(starGeo, starMat, maxStars);
    starInst.count = 0;
    starInst.frustumCulled = false;
    group.add(starInst);

    bountyVisuals = {
      group,
      halos,
      starInst,
      maxStars,
      tmpMat: new THREE.Matrix4(),
      tmpPos: new THREE.Vector3(),
      tmpQuat: new THREE.Quaternion(),
      tmpEuler: new THREE.Euler(),
      tmpScale: new THREE.Vector3(),
    };
  }

  function updatePropBounty(dt) {
    if (!activeEvent || activeEvent.type !== 'prop_bounty') return;
    const bountyIds = activeEvent.bountyProps || [];
    const kit = env.getKit?.();
    const hiders = getLivingHiders();

    const qualifiedHiders = [];
    for (const ch of hiders) {
      const pid = ch.userData?.propId;
      if (pid && bountyIds.includes(pid)) {
        qualifiedHiders.push(ch);
        env.recordStat?.(ch, 'bigPropSec', dt);
        const nextAcc = (bountyAccumByChar.get(ch) || 0) + dt;
        let remAcc = nextAcc;
        while (remAcc >= 5.0) {
          remAcc -= 5.0;
          env.recordStat?.(ch, 'eventBonuses', 1);
          if (ch === env.G?.player && !env.G?.spectating) {
            const lbl = kit?.props?.[pid]?.label || 'Bounty Prop';
            env.awardTokens?.('prop_bounty', 15, `🏆 Big Prop Bounty (${lbl})! +15 🪙`);
            stingers.rewardCoin();
          }
        }
        bountyAccumByChar.set(ch, remAcc);
      }
    }

    // Occasional non-player Spirit morph into a nearby bounty prop
    bountyMorphCheckT += dt;
    if (bountyMorphCheckT >= 3.6 && bountySpiritMorphCount < 2) {
      bountyMorphCheckT = 0;
      const seekers = getLivingSeekers();
      const props = env.realProps || [];
      for (const h of hiders) {
        if (h === env.G?.player || bountyIds.includes(h.userData?.propId)) continue;
        if (!h.userData?.actor?.isBot || h.userData?.actor?.isRemote || h.userData?.specialMode) continue;
        const unsafe = seekers.some((s) => (
          s?.position && h?.position && Math.hypot(s.position.x - h.position.x, s.position.z - h.position.z) < 11.5
        ));
        if (unsafe || rng() > 0.45) continue;

        const nearBountyRec = props.find((r) => (
          r && bountyIds.includes(r.id) && r.pos &&
          Math.hypot(r.pos.x - h.position.x, r.pos.z - h.position.z) < 6.5
        ));
        if (nearBountyRec && applySafeNonPlayerMorph(h, nearBountyRec)) {
          bountySpiritMorphCount++;
          onHiderTransformed(h, nearBountyRec.id);
          break;
        }
      }
    }

    // Animate golden halos & celebratory star sparkles around disguised bounty hiders
    if (bountyVisuals) {
      for (const h of bountyVisuals.halos) {
        const pulse = 1 + Math.sin(visualClock * 3.1 + h.phase) * 0.08;
        h.mesh.scale.setScalar(h.baseScale * pulse);
      }

      const { starInst, maxStars, tmpMat, tmpPos, tmpQuat, tmpEuler, tmpScale } = bountyVisuals;
      let count = 0;
      for (let hi = 0; hi < qualifiedHiders.length; hi++) {
        const ch = qualifiedHiders[hi];
        if (!ch?.position || ch.visible === false) continue;
        const propH = ch.userData?.height || 1.05;
        const propR = (ch.userData?.radius || 0.5) + 0.18;
        for (let s = 0; s < 5 && count < maxStars; s++) {
          const seedPhase = hi * 1.9 + s * ((Math.PI * 2) / 5);
          const ang = seedPhase + visualClock * 1.85;
          const lift = ((visualClock * 0.55 + s * 0.2) % 1);
          const x = ch.position.x + Math.cos(ang) * (propR * (0.75 + 0.25 * Math.sin(lift * Math.PI)));
          const z = ch.position.z + Math.sin(ang) * (propR * (0.75 + 0.25 * Math.sin(lift * Math.PI)));
          const y = (ch.position.y || 0) + propH * 0.35 + lift * (propH * 0.85 + 0.45);
          const sc = Math.sin(lift * Math.PI) * 1.1;

          tmpPos.set(x, y, z);
          tmpEuler.set(0, visualClock * 2.4 + s, visualClock * 1.8);
          tmpQuat.setFromEuler(tmpEuler);
          tmpScale.setScalar(sc);
          tmpMat.compose(tmpPos, tmpQuat, tmpScale);
          starInst.setMatrixAt(count++, tmpMat);
        }
      }
      starInst.count = count;
      starInst.instanceMatrix.needsUpdate = true;
    }
  }

  function applySafeNonPlayerMorph(h, rec) {
    if (!h || !rec?.id) return false;
    if (typeof env.disguise === 'function') {
      const ok = env.disguise(h, rec.id);
      if (ok && h.rotation && rec.g?.rotation) h.rotation.y = rec.g.rotation.y;
      return !!ok;
    }
    const kit = env.getKit?.();
    const def = kit?.props?.[rec.id];
    if (!def || !rec.g?.clone || !h.userData) return false;

    const u = h.userData;
    if (u.disguise && typeof h.remove === 'function') h.remove(u.disguise);
    const clone = rec.g.clone();
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    if (typeof clone.traverse === 'function') {
      clone.traverse((m) => {
        if (m.isMesh && m.userData) {
          m.userData = { ...m.userData, propRoot: null };
        }
      });
    }
    if (typeof h.add === 'function') h.add(clone);
    u.disguise = clone;
    u.propId = rec.id;
    u.radius = def.radius || 0.5;
    u.height = def.height || 1.0;
    u.speedMul = def.speed || 1.0;
    if (Array.isArray(u.parts)) {
      u.parts.forEach((m) => { if (m) m.visible = false; });
    }
    if (u.ai) {
      const prevMax = u.ai.maxHp || 180;
      const frac = clamp((u.ai.hp ?? prevMax) / prevMax, 0.2, 1);
      u.ai.maxHp = def.hp || 180;
      u.ai.hp = frac * u.ai.maxHp;
      u.ai.transformCd = 2.5;
    }
    if (h.rotation && rec.g?.rotation) h.rotation.y = rec.g.rotation.y;
    return true;
  }

  // --------------------------------------------------------------------------
  // Spirit Wind Speed-Boost Foot Breeze Rings
  // --------------------------------------------------------------------------
  function ensureBoostTrailVisuals() {
    if (boostTrailVisuals) return boostTrailVisuals;
    const root = ensureEventsRoot();
    if (!root || !THREE?.RingGeometry || !THREE?.InstancedMesh) return null;

    const group = new THREE.Group();
    group.name = 'windBoostTrails';
    root.add(group);

    const ringGeo = new THREE.RingGeometry(0.42, 0.58, 24);
    ringGeo.rotateX(-Math.PI * 0.5);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9ef5b5,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const inst = new THREE.InstancedMesh(ringGeo, ringMat, 12);
    inst.count = 0;
    inst.frustumCulled = false;
    group.add(inst);

    boostTrailVisuals = {
      group,
      inst,
      tmpMat: new THREE.Matrix4(),
      tmpPos: new THREE.Vector3(),
      tmpQuat: new THREE.Quaternion(),
      tmpEuler: new THREE.Euler(),
      tmpScale: new THREE.Vector3(),
    };
    return boostTrailVisuals;
  }

  function updateWindBoostTimersAndTrails(dt) {
    const nowMs = getNowMs();
    const activeChars = [];

    for (const [ch, entry] of windBoostMap.entries()) {
      if (!ch || ch.userData?.actor?.eliminated) {
        windBoostMap.delete(ch);
        continue;
      }
      if (nowMs > entry.lastNowMs + 0.5) {
        entry.remSec = Math.max(0, (entry.untilMs - nowMs) / 1000);
        entry.lastNowMs = nowMs;
      } else {
        entry.remSec = Math.max(0, entry.remSec - dt);
        entry.untilMs = nowMs + entry.remSec * 1000;
        entry.lastNowMs = nowMs;
      }
      if (entry.remSec <= 0) {
        windBoostMap.delete(ch);
      } else {
        activeChars.push(ch);
      }
    }

    if (activeChars.length === 0) {
      if (boostTrailVisuals) boostTrailVisuals.inst.count = 0;
      return;
    }

    const tv = ensureBoostTrailVisuals();
    if (!tv) return;
    let count = 0;
    for (const ch of activeChars) {
      if (!ch?.position || ch.visible === false || count + 2 > 12) continue;
      for (let k = 0; k < 2; k++) {
        const phase = (visualClock * 2.2 + k * 0.5) % 1;
        const y = (ch.position.y || 0) + 0.08 + phase * 0.55;
        const sc = (0.75 + phase * 0.85) * ((ch.userData?.radius || 0.48) / 0.48);
        tv.tmpPos.set(ch.position.x, y, ch.position.z);
        tv.tmpEuler.set(0, visualClock * 4 + k * Math.PI, 0);
        tv.tmpQuat.setFromEuler(tv.tmpEuler);
        tv.tmpScale.setScalar(sc * (1 - phase * 0.55));
        tv.tmpMat.compose(tv.tmpPos, tv.tmpQuat, tv.tmpScale);
        tv.inst.setMatrixAt(count++, tv.tmpMat);
      }
    }
    tv.inst.count = count;
    tv.inst.instanceMatrix.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Roster Helpers
  // --------------------------------------------------------------------------
  function getAllSeekers() {
    const G = env.G || {};
    if (Array.isArray(G.allSeekers) && G.allSeekers.length) return G.allSeekers.filter(Boolean);
    const list = [];
    if (G.mode === 'seek' && G.player) list.push(G.player);
    if (Array.isArray(G.seekers)) {
      for (const s of G.seekers) {
        if (s && !list.includes(s)) list.push(s);
      }
    }
    return list;
  }

  function getLivingSeekers() {
    return getAllSeekers().filter((s) => !s.userData?.actor?.eliminated);
  }

  function getLivingHiders() {
    const G = env.G || {};
    const raw = Array.isArray(G.allHiders) && G.allHiders.length
      ? G.allHiders
      : [G.mode === 'hide' ? G.player : null, ...(G.hiders || [])];
    const out = [];
    for (const h of raw) {
      if (!h || out.includes(h)) continue;
      if (h.userData?.actor?.team === 'seekers') continue;
      if (h.userData?.actor?.eliminated) continue;
      out.push(h);
    }
    return out;
  }

  // --------------------------------------------------------------------------
  // Mid-Round Event Triggering & Lifecycle
  // --------------------------------------------------------------------------
  function endActiveEvent({ immediateLighting = false } = {}) {
    clearCompactTimer();
    bannerCompact = false;
    if (!activeEvent) {
      if (immediateLighting) {
        restoreBaselineLightingImmediate();
        clearDuskVisuals();
      }
      if (ui.eventBanner) ui.eventBanner.classList.remove('is-compact');
      return;
    }

    const prevType = activeEvent.type;
    activeEvent = null;

    if (prevType === 'spirit_wind') {
      finishActivePropSwapsImmediate();
      clearWindVisuals();
    } else if (prevType === 'lantern_dusk') {
      if (immediateLighting) {
        restoreBaselineLightingImmediate();
        clearDuskVisuals();
      } else {
        // Smooth 2.2s twilight restoration back to baseline
        duskState.target = 0;
      }
    } else if (prevType === 'prop_bounty') {
      clearBountyVisuals();
      bountyAccumByChar.clear();
    }
    syncUI();
  }

  function triggerMidRoundEvent(forcedType = null) {
    if (!ui.mounted && typeof document !== 'undefined') mountUI();

    // Cleanly stop any prior event first (immediately restoring lights if switching mid-test)
    if (activeEvent || baselineLighting) {
      endActiveEvent({ immediateLighting: true });
    }
    clearCompactTimer();
    bannerCompact = false;
    if (ui.eventBanner) ui.eventBanner.classList.remove('is-compact');

    const type = (forcedType && EVENT_META[forcedType])
      ? forcedType
      : (EVENT_META[scheduledEventType] ? scheduledEventType : EVENT_TYPES[Math.floor(rng() * EVENT_TYPES.length)]);

    midRoundTriggered = true;
    const meta = EVENT_META[type];
    const G = env.G || {};

    if (type === 'spirit_wind') {
      windBaselinePropByChar.clear();
      windBoostClaimedSet.clear();
      for (const h of getLivingHiders()) {
        windBaselinePropByChar.set(h, h.userData?.propId ?? null);
        lastKnownPropByChar.set(h, h.userData?.propId ?? null);
      }
      spiritWindRelocateTimer = 0;

      activeEvent = {
        type: 'spirit_wind',
        icon: meta.icon,
        title: meta.title,
        duration: meta.duration,
        remaining: meta.duration,
        elapsed: 0,
        startedAtMs: getNowMs(),
      };

      spawnSpiritWindVisuals();
      startSpiritWindPropSwaps();
      stingers.spiritWind();

      env.pushFeed?.(
        '🍃',
        '<b>Spirit Wind!</b> New morph = <b>2× Speed</b>!',
        'ally'
      );
      if (!ui.mounted) {
        env.hint?.(
          G.mode === 'seek'
            ? '🍃 Spirit Wind! Props shuffled — watch for 2× Breeze Spirits!'
            : '🍃 Spirit Wind! Props swapped — new morph gives 2× Speed +30 🪙!',
          3200
        );
      }
    } else if (type === 'lantern_dusk') {
      captureBaselineLightingIfNeeded();
      duskState.target = 1;

      activeEvent = {
        type: 'lantern_dusk',
        icon: meta.icon,
        title: meta.title,
        duration: meta.duration,
        remaining: meta.duration,
        elapsed: 0,
        startedAtMs: getNowMs(),
      };

      if (duskVisuals && duskVisuals.prewarmed) setDuskMeshesVisible(true);
      else spawnLanternDuskVisuals();
      stingers.lanternDusk();

      env.pushFeed?.(
        '🏮',
        '<b>Lantern Dusk!</b> Golden twilight lanterns lit',
        'info'
      );
      if (!ui.mounted) {
        env.hint?.(
          G.mode === 'seek'
            ? '🏮 Lantern Dusk! Sweep shadows with your golden lantern!'
            : '🏮 Lantern Dusk! Slip around golden Seeker lanterns!',
          3200
        );
      }
    } else if (type === 'prop_bounty') {
      bountyAccumByChar.clear();
      bountyMorphCheckT = 0;
      bountySpiritMorphCount = 0;

      const picked = pickBountyPropsForMap();
      const [labelA, labelB] = picked.labels;

      activeEvent = {
        type: 'prop_bounty',
        icon: meta.icon,
        title: meta.title,
        compactTitle: `Bounty: ${labelA} / ${labelB}`,
        duration: meta.duration,
        remaining: meta.duration,
        elapsed: 0,
        startedAtMs: getNowMs(),
        bountyProps: picked.ids,
        bountyLabels: picked.labels,
      };

      spawnPropBountyVisuals(picked.ids);
      stingers.propBounty();

      env.pushFeed?.(
        '🏆',
        `<b>Bounty:</b> ${escHtml(labelA)} / ${escHtml(labelB)} (+15 🪙 / 5s)`,
        'ally'
      );
      if (!ui.mounted) {
        env.hint?.(`🏆 Bounty: be a ${labelA} or ${labelB} for +15 🪙 every 5s!`, 3200);
      }
    }

    if (activeEvent && typeof setTimeout === 'function') {
      compactBannerTimer = setTimeout(() => {
        compactBannerTimer = null;
        if (activeEvent) {
          bannerCompact = true;
          syncUI();
        }
      }, Math.round(COMPACT_BANNER_SEC * 1000));
    }

    syncUI();
    return type;
  }

  // --------------------------------------------------------------------------
  // Hider Transform Hook (Relocate Bonus during Spirit Wind)
  // --------------------------------------------------------------------------
  function onHiderTransformed(ch, propId) {
    if (!ch || !propId) return;

    const prevKnown = windBaselinePropByChar.has(ch)
      ? windBaselinePropByChar.get(ch)
      : lastKnownPropByChar.get(ch);

    lastKnownPropByChar.set(ch, propId);

    if (activeEvent?.type !== 'spirit_wind') return;
    if (windBoostClaimedSet.has(ch)) return;

    // Must transform into a different prop than what they wore when Spirit Wind began
    if (prevKnown !== undefined && prevKnown !== null && prevKnown === propId) {
      return;
    }

    windBoostClaimedSet.add(ch);
    const nowMs = getNowMs();
    const untilMs = nowMs + WIND_BOOST_SEC * 1000;
    windBoostMap.set(ch, {
      untilMs,
      remSec: WIND_BOOST_SEC,
      lastNowMs: nowMs,
    });
    if (!ch.userData) ch.userData = {};
    ch.userData.windBoostUntil = untilMs;

    env.recordStat?.(ch, 'eventBonuses', 1);

    if (ch === env.G?.player) {
      env.awardTokens?.(
        'spirit_wind_relocate',
        30,
        '🍃 Rode the Spirit Wind to a new disguise! 2× Speed +30 🪙'
      );
      stingers.windBoost();
    }
    syncUI();
  }

  // --------------------------------------------------------------------------
  // 0:30 Overtime Frenzy Lifecycle
  // --------------------------------------------------------------------------
  function activateOvertimeFrenzy() {
    if (overtimeActive) return;
    overtimeActive = true;
    localFrenzySurvivedSec = 0;

    stingers.overtimeFrenzy();
    env.pushFeed?.(
      '⚡',
      '<b>FRENZY!</b> Final 30s — faster nozzles, half-price water!',
      'warn'
    );
    if (!ui.mounted) {
      const isSeek = env.G?.mode === 'seek';
      env.hint?.(
        isSeek
          ? '⚡ FINAL 30s FRENZY! Faster nozzles, +20% speed & half-price water!'
          : '⚡ FINAL 30s FRENZY! Hold on — +15 🪙 for every 10s you survive!',
        3200
      );
    }
    syncUI();
  }

  function creditOvertimeFrenzyStep(dt) {
    const hiders = getLivingHiders();
    for (const h of hiders) {
      env.recordStat?.(h, 'frenzySurvivedSec', dt);
    }

    const G = env.G || {};
    const p = G.player;
    const localHiderAlive =
      p &&
      (G.mode === 'hide' || p.userData?.actor?.team === 'hiders') &&
      !G.spectating &&
      !p.userData?.actor?.eliminated;

    if (localHiderAlive) {
      localFrenzySurvivedSec += dt;
      while (localFrenzySurvivedSec >= 10.0 - 1e-5) {
        localFrenzySurvivedSec -= 10.0;
        env.awardTokens?.('frenzy_survival', 15, '⚡ Frenzy Survival Bonus! +15 🪙');
        env.recordStat?.(p, 'eventBonuses', 1);
        stingers.rewardCoin();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Frame Update, Round Reset & Full Teardown
  // --------------------------------------------------------------------------
  function update(dt) {
    if (!(dt > 0)) {
      syncUI();
      return;
    }
    const safeDt = Math.min(dt, 0.25);
    visualClock += safeDt;

    const G = env.G || {};
    const inHuntPhase = !G.over && (G.phase === 'survive' || G.phase === 'seek');

    // Keep track of baseline disguises prior to Spirit Wind so we always know if a prop changed
    if (!activeEvent && inHuntPhase) {
      for (const h of getLivingHiders()) {
        if (h.userData?.propId) lastKnownPropByChar.set(h, h.userData.propId);
      }
    }

    // 1. Mid-Round Twist auto-trigger at 1:15 remaining
    if (inHuntPhase && !midRoundTriggered && G.t <= MID_ROUND_TRIGGER_SEC && G.t > 0) {
      triggerMidRoundEvent();
    }

    // 2. Tick active Mid-Round Event
    if (activeEvent) {
      if (G.over || G.phase === 'menu' || G.phase === 'vs') {
        endActiveEvent({ immediateLighting: true });
      } else {
        activeEvent.elapsed = (activeEvent.elapsed || 0) + safeDt;
        activeEvent.remaining = Math.max(0, activeEvent.remaining - safeDt);
        const wallElapsedSec = activeEvent.startedAtMs != null
          ? (getNowMs() - activeEvent.startedAtMs) / 1000
          : 0;
        if (!bannerCompact && (activeEvent.elapsed >= COMPACT_BANNER_SEC || wallElapsedSec >= COMPACT_BANNER_SEC)) {
          bannerCompact = true;
          clearCompactTimer();
        }
        if (activeEvent.type === 'spirit_wind') {
          updateSpiritWind(safeDt);
        } else if (activeEvent.type === 'prop_bounty') {
          updatePropBounty(safeDt);
        }
        if (activeEvent.remaining <= 0) {
          endActiveEvent({ immediateLighting: false });
        }
      }
    }

    // 3. Tick Lantern Dusk crossfade & 3D seeker lanterns/fireflies (including 2.2s post-event restore)
    if (baselineLighting || duskState.target > 0 || duskState.blend > 0) {
      updateDuskLightingAndVisuals(safeDt);
    }

    // 4. Tick Spirit Wind 2.0× boost timers & breeze trails
    if (windBoostMap.size > 0 || (boostTrailVisuals && boostTrailVisuals.inst.count > 0)) {
      updateWindBoostTimersAndTrails(safeDt);
    }

    // 5. 0:30 Overtime Frenzy trigger & survival ticks
    const shouldBeOvertime = inHuntPhase && G.t <= OVERTIME_TRIGGER_SEC && G.t > 0;
    if (shouldBeOvertime) {
      if (!overtimeActive) activateOvertimeFrenzy();
      creditOvertimeFrenzyStep(safeDt);
    } else if (overtimeActive) {
      // Credit final frame slice if timer just crossed 0:00 cleanly at round end
      if ((G.phase === 'survive' || G.phase === 'seek' || G.phase === 'end') && (G.t ?? 0) <= 0 && (G.t ?? 0) > -0.5) {
        creditOvertimeFrenzyStep(safeDt);
      }
      overtimeActive = false;
    }

    syncUI();
  }

  function clearAll() {
    clearCompactTimer();
    bannerCompact = false;
    finishActivePropSwapsImmediate();
    restoreBaselineLightingImmediate();

    activeEvent = null;
    overtimeActive = false;
    midRoundTriggered = false;
    localFrenzySurvivedSec = 0;

    windBaselinePropByChar.clear();
    windBoostClaimedSet.clear();
    windBoostMap.clear();
    lastKnownPropByChar.clear();
    bountyAccumByChar.clear();
    bountyMorphCheckT = 0;
    bountySpiritMorphCount = 0;

    clearWindVisuals();
    clearDuskVisuals();
    clearBountyVisuals();
    clearBoostTrailVisuals();

    if (eventsRoot && eventsRoot.parent) {
      eventsRoot.parent.remove(eventsRoot);
    }
    if (ui.eventBanner) {
      ui.eventBanner.classList.remove('is-compact');
    }
    syncUI();
  }

  function resetRound(opts = {}) {
    clearAll();
    const seedVal = opts && opts.seed != null
      ? hashSeed(opts.seed)
      : hashSeed((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    rng = createMulberry32(seedVal);
    scheduledEventType = EVENT_TYPES[Math.floor(rng() * EVENT_TYPES.length)];
    if (scheduledEventType === 'lantern_dusk') prewarmLanternDusk();
    syncUI();
  }

  // Lantern Dusk adds 5 seeker spotlights + 3 prop lights. Adding lights mid-round changes the scene's
  // light count, which makes three.js recompile every lit material: a freeze of 0.3 s on a laptop and
  // seconds on a phone, right in the middle of a chase. On rounds where the dusk is scheduled, the rigs
  // are built at round start instead (lights at intensity 0, meshes hidden), so the recompile happens
  // behind the round intro and the event itself only fades values. Phones in a Lite quality step skip
  // the real lights entirely (env.duskRealLights() === false); the cones, orbs and fireflies remain.
  function prewarmLanternDusk() {
    try {
      if (getAllSeekers().length === 0) return;
      spawnLanternDuskVisuals();
      if (!duskVisuals) return;
      duskVisuals.prewarmed = true;
      setDuskMeshesVisible(false);
    } catch (_) { clearDuskVisuals(); }
  }

  function setDuskMeshesVisible(on) {
    if (!duskVisuals) return;
    for (const rig of duskVisuals.rigs) { rig.coneMesh.visible = on; rig.orbMesh.visible = on; }
    if (duskVisuals.flyInst) duskVisuals.flyInst.visible = on;
  }

  // --------------------------------------------------------------------------
  // Gameplay Modifier Getters
  // --------------------------------------------------------------------------
  function getHiderSpeedMul(ch) {
    const target = ch || env.G?.player;
    if (!target) return 1.0;
    const nowMs = getNowMs();
    const entry = windBoostMap.get(target);
    if (entry && entry.remSec > 0 && nowMs < entry.untilMs + 16) {
      return WIND_BOOST_MUL;
    }
    if (target.userData?.windBoostUntil && nowMs < target.userData.windBoostUntil) {
      return WIND_BOOST_MUL;
    }
    return 1.0;
  }

  function getSeekerSpeedMul(_ch) {
    return overtimeActive ? 1.20 : 1.0;
  }

  function getSeekerFireCooldown() {
    return overtimeActive ? 0.055 : 0.085;
  }

  function getShotSpeed() {
    return overtimeActive ? 38 : 30;
  }

  function getWrongPropPenaltySec() {
    return overtimeActive ? 0 : 2;
  }

  function getMinThreat() {
    return overtimeActive ? 0.88 : 0;
  }

  // Initialize default round seed on construction
  resetRound();

  return {
    mountUI,
    resetRound,
    clearAll,
    update,
    triggerMidRoundEvent,
    onHiderTransformed,
    isOvertime: () => overtimeActive,
    getActiveEvent: () => activeEvent,
    getHiderSpeedMul,
    getSeekerSpeedMul,
    getSeekerFireCooldown,
    getShotSpeed,
    getWrongPropPenaltySec,
    getMinThreat,
  };
}
