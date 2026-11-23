/* ==========================================================================
 * Hue & Seek — Seeker Hunting Gadgets Module (seeker_gadgets.js)
 *
 * Implements two tactile Storybook Seeker gadgets for 5v5 Prop Hunt:
 *   1. [Q] 🧭 Echo Pulse (18s CD) — Expanding 18m Watercolor Dowsing Wave
 *      with Cold / Warm / HOT! Spirit proximity readout (never reveals prop!)
 *   2. [E] 💣 Splash Bomb (14s CD) — Glossy Storybook Water Balloon ballistic lob
 *      with 3.5m AoE Water Burst Dome, decoy-clone popping & zero miss penalty!
 *   3. Tactical Seeker Squad gadget usage + procedural WebAudio SFX + HUD bar.
 * ========================================================================== */

const PULSE_CD_SEC = 18.0;
const PULSE_CD_MS = PULSE_CD_SEC * 1000;
const PULSE_RADIUS = 18.0;
const PULSE_HOT_RADIUS = 8.5;
const PULSE_WAVE_DUR = 1.15;
const BANNER_SHOW_SEC = 4.2;

const BOMB_CD_SEC = 14.0;
const BOMB_CD_MS = BOMB_CD_SEC * 1000;
const BOMB_SPEED = 16.5;
const BOMB_GRAVITY = 20.0;
const BOMB_MAX_LIFE = 3.2;
const BOMB_RADIUS = 3.5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 4);

// --------------------------------------------------------------------------
// Lazy Procedural WebAudio Synthesizer (Warm Storybook Water-Bell & Balloon Burst)
// --------------------------------------------------------------------------
function createGadgetAudio(env) {
  let ctx = null;
  let noiseBuffer = null;

  function isMuted() {
    return !!(env.audio && typeof env.audio.isMuted === 'function' && env.audio.isMuted());
  }

  function ensureContext() {
    if (isMuted()) return null;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch (_e) {
        try {
          ctx = new AC();
        } catch (_e2) {
          return null;
        }
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (!noiseBuffer && ctx) {
      const sr = ctx.sampleRate;
      noiseBuffer = ctx.createBuffer(1, sr * 1.5, sr);
      const data = noiseBuffer.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        prev = prev * 0.62 + w * 0.38;
        data[i] = prev * 1.35;
      }
    }
    return ctx;
  }

  function computeSpatial(worldPos, refDist = 9) {
    if (!worldPos || !env.camera) return { gain: 1, pan: 0 };
    const camPos = env.camera.position;
    const dx = worldPos.x - camPos.x;
    const dz = worldPos.z - camPos.z;
    const dy = (worldPos.y || 0) - (camPos.y || 0);
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.5) return { gain: 1, pan: 0 };
    if (d > 38) return { gain: 0, pan: 0 };
    const gain = 1 / (1 + Math.pow(d / refDist, 1.65));
    let pan = 0;
    if (env.G && typeof env.G.yaw === 'number') {
      const rx = Math.cos(env.G.yaw);
      const rz = -Math.sin(env.G.yaw);
      const hd = Math.hypot(dx, dz) || 1;
      pan = clamp((dx * rx + dz * rz) / hd, -1, 1) * Math.min(1, hd / 3) * 0.82;
    }
    return { gain, pan };
  }

  function connectSpatial(node, c, gainMul, pan) {
    const outG = c.createGain();
    outG.gain.value = clamp(gainMul, 0, 1.2);
    node.connect(outG);
    if (pan && typeof c.createStereoPanner === 'function') {
      const sp = c.createStereoPanner();
      sp.pan.value = clamp(pan, -1, 1);
      outG.connect(sp);
      sp.connect(c.destination);
    } else {
      outG.connect(c.destination);
    }
  }

  function playBellPartial(c, dest, t0, f0, f1, dur, vol, type = 'sine') {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur * 0.85);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  function playNoiseSweep(c, dest, t0, f0, f1, q, dur, vol, filterType = 'bandpass') {
    if (!noiseBuffer) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer;
    const flt = c.createBiquadFilter();
    flt.type = filterType;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(Math.max(40, f0), t0);
    if (f1 && f1 !== f0) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.min(0.04, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(dest);
    const maxOffset = Math.max(0, noiseBuffer.duration - dur - 0.05);
    src.start(t0, Math.random() * maxOffset);
    src.stop(t0 + dur + 0.04);
  }

  return {
    // Warm resonant Storybook water-bell sonar ripple
    playEchoPulse(worldPos, isLocal = true, tier = 'cold') {
      if (isMuted()) return;
      const c = ensureContext();
      if (!c) return;
      const sp = isLocal ? { gain: 0.95, pan: 0 } : computeSpatial(worldPos, 11);
      if (sp.gain < 0.03) return;

      const bus = c.createGain();
      bus.gain.value = 1;
      connectSpatial(bus, c, sp.gain, sp.pan);

      const t = c.currentTime + 0.01;
      // Deep resonant water bowl fundamental + shimmering fifth & octave harmonics
      playBellPartial(c, bus, t, 349.23, 356.0, 0.95, 0.19, 'sine');       // F4 warm bowl
      playBellPartial(c, bus, t + 0.015, 523.25, 532.0, 0.85, 0.14, 'triangle'); // C5 harmonic
      playBellPartial(c, bus, t + 0.045, 783.99, 796.0, 0.78, 0.10, 'sine');     // G5 water bell
      playBellPartial(c, bus, t + 0.085, 1046.5, 1068.0, 0.68, 0.075, 'sine');   // C6 shimmer
      // Sub-sonar ripple bloom
      playBellPartial(c, bus, t, 174.61, 130.81, 0.55, 0.15, 'sine');
      // Expanding watery shimmer sweep
      playNoiseSweep(c, bus, t + 0.01, 380, 1720, 2.6, 0.72, 0.12, 'bandpass');

      // Subtle temperature answer chime for local Seeker
      if (isLocal) {
        if (tier === 'hot') {
          playBellPartial(c, bus, t + 0.19, 880.0, 1174.66, 0.42, 0.13, 'triangle');
          playBellPartial(c, bus, t + 0.28, 1318.5, 1567.98, 0.48, 0.11, 'sine');
        } else if (tier === 'warm') {
          playBellPartial(c, bus, t + 0.21, 659.25, 880.0, 0.46, 0.11, 'sine');
        } else {
          playBellPartial(c, bus, t + 0.22, 587.33, 440.0, 0.38, 0.07, 'sine');
        }
      }
    },

    // Tactile elastic water-balloon slosh & arc lob whoosh
    playBombThrow(worldPos, isLocal = true) {
      if (isMuted()) return;
      const c = ensureContext();
      if (!c) return;
      const sp = isLocal ? { gain: 0.9, pan: 0 } : computeSpatial(worldPos, 9);
      if (sp.gain < 0.03) return;

      const bus = c.createGain();
      bus.gain.value = 1;
      connectSpatial(bus, c, sp.gain, sp.pan);

      const t = c.currentTime + 0.008;
      // Elastic balloon slosh pitch-up
      playBellPartial(c, bus, t, 195, 470, 0.19, 0.17, 'triangle');
      playBellPartial(c, bus, t + 0.03, 310, 620, 0.14, 0.09, 'sine');
      // Airy lob whoosh
      playNoiseSweep(c, bus, t, 460, 1950, 1.4, 0.21, 0.15, 'bandpass');
    },

    // Big water-balloon burst + cascading hydro splash + sparkling droplets
    playBombBurst(worldPos, hitConfirm = false) {
      if (isMuted()) return;
      const c = ensureContext();
      if (!c) return;
      const sp = computeSpatial(worldPos, 13);
      if (sp.gain < 0.025) return;

      const bus = c.createGain();
      bus.gain.value = 1;
      connectSpatial(bus, c, Math.min(1.05, sp.gain * 1.12), sp.pan);

      const t = c.currentTime + 0.006;
      // 1. Snappy rubber membrane pop transient
      playNoiseSweep(c, bus, t, 2400, 950, 1.8, 0.055, 0.26, 'bandpass');
      playBellPartial(c, bus, t, 540, 145, 0.075, 0.20, 'triangle');
      // 2. Deep hydro-dome boom
      playBellPartial(c, bus, t + 0.005, 142, 42, 0.34, 0.30, 'sine');
      // 3. Lush cascading water splash wash
      playNoiseSweep(c, bus, t + 0.015, 2200, 480, 0.85, 0.52, 0.24, 'bandpass');
      playNoiseSweep(c, bus, t + 0.04, 3600, 1100, 1.2, 0.36, 0.13, 'highpass');
      // 4. Sparkling Storybook water droplet plinks
      const plinkNotes = [920, 1240, 1060, 1480, 1180];
      for (let i = 0; i < plinkNotes.length; i++) {
        const dtPlink = 0.055 + i * 0.042 + Math.random() * 0.018;
        const f = plinkNotes[i] * rand(0.94, 1.06);
        playBellPartial(c, bus, t + dtPlink, f, f * 1.28, 0.11, 0.055, 'sine');
      }
      // 5. Crisp hit-confirm chime when soaking Spirits / popping decoys
      if (hitConfirm) {
        playBellPartial(c, bus, t + 0.05, 783.99, 1046.5, 0.24, 0.16, 'triangle');
        playBellPartial(c, bus, t + 0.11, 1174.66, 1567.98, 0.28, 0.14, 'sine');
      }
    },
  };
}

// --------------------------------------------------------------------------
// Soft Feathered Watercolor Curtain Texture (Gracefully Skipped in Headless Node)
// --------------------------------------------------------------------------
function createShimmerCurtainTexture(THREE) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 128;
  const g = cv.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0.0, 'rgba(255, 252, 238, 0.95)');
  grad.addColorStop(0.18, 'rgba(138, 224, 255, 0.72)');
  grad.addColorStop(0.55, 'rgba(102, 198, 245, 0.28)');
  grad.addColorStop(1.0, 'rgba(102, 198, 245, 0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 128);
  const tex = new THREE.CanvasTexture(cv);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// --------------------------------------------------------------------------
// Analytical Ballistic Lob Solver (Speed = 16.5 m/s, Gravity = 20 m/s²)
// --------------------------------------------------------------------------
function solveBallisticLob(THREE, startPos, targetPos, speed, gravity) {
  const dx = targetPos.x - startPos.x;
  const dz = targetPos.z - startPos.z;
  const dy = targetPos.y - startPos.y;
  const dxz = Math.hypot(dx, dz);
  if (dxz < 0.25) {
    return new THREE.Vector3(dx, Math.max(0.4, dy), dz).normalize();
  }
  const v2 = speed * speed;
  const v4 = v2 * v2;
  const disc = v4 - gravity * (gravity * dxz * dxz + 2 * dy * v2);
  let tanTheta;
  if (disc >= 0) {
    // Low/direct lob trajectory for snappy Storybook water-balloon arc
    tanTheta = (v2 - Math.sqrt(disc)) / (gravity * dxz);
  } else {
    // Max-range 45-deg fallback when target is right at the edge of range
    tanTheta = 0.85;
  }
  tanTheta = clamp(tanTheta, -0.35, 1.45);
  const cosTheta = 1 / Math.sqrt(1 + tanTheta * tanTheta);
  const sinTheta = tanTheta * cosTheta;
  const ux = dx / dxz;
  const uz = dz / dxz;
  return new THREE.Vector3(ux * cosTheta, sinTheta, uz * cosTheta).normalize();
}

// ==========================================================================
// Main Factory: createSeekerGadgetsManager(env)
// ==========================================================================
export function createSeekerGadgetsManager(env = {}) {
  const { THREE } = env;
  const getNow = () => (typeof env.now === 'function' ? env.now() : performance.now());
  const gadgetSfx = createGadgetAudio(env);

  // Shared Geometries & Reusable Scratch Objects
  const raycaster = THREE ? new THREE.Raycaster() : null;
  const _prevPos = THREE ? new THREE.Vector3() : null;
  const _nextPos = THREE ? new THREE.Vector3() : null;
  const _segVec = THREE ? new THREE.Vector3() : null;
  const _segDir = THREE ? new THREE.Vector3() : null;
  const _upVec = THREE ? new THREE.Vector3(0, 1, 0) : null;
  const _tmpVec = THREE ? new THREE.Vector3() : null;

  let sharedGeos = null;
  function getSharedGeos() {
    if (!THREE) return null;
    if (sharedGeos) return sharedGeos;
    const outerRing = new THREE.RingGeometry(0.88, 1.0, 64);
    outerRing.rotateX(-Math.PI / 2);
    const innerRing = new THREE.RingGeometry(0.76, 0.84, 56);
    innerRing.rotateX(-Math.PI / 2);
    const shimmerCyl = new THREE.CylinderGeometry(1.0, 1.0, 1.15, 56, 1, true);
    shimmerCyl.translate(0, 0.575, 0); // bottom anchored cleanly at ground level y=0
    const moteSphere = new THREE.SphereGeometry(0.075, 8, 6);

    const balloonSphere = new THREE.SphereGeometry(0.21, 18, 14);
    const balloonCore = new THREE.SphereGeometry(0.115, 12, 10);
    const balloonKnot = new THREE.ConeGeometry(0.055, 0.09, 8);
    const balloonLip = new THREE.TorusGeometry(0.033, 0.011, 6, 12);
    const trailDrop = new THREE.SphereGeometry(0.052, 8, 6);

    const burstDome = new THREE.SphereGeometry(1.0, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const foamRing = new THREE.RingGeometry(0.83, 1.0, 52);
    foamRing.rotateX(-Math.PI / 2);
    const arcDrop = new THREE.SphereGeometry(0.075, 8, 6);

    const curtainTex = createShimmerCurtainTexture(THREE);

    sharedGeos = {
      outerRing,
      innerRing,
      shimmerCyl,
      moteSphere,
      balloonSphere,
      balloonCore,
      balloonKnot,
      balloonLip,
      trailDrop,
      burstDome,
      foamRing,
      arcDrop,
      curtainTex,
    };
    return sharedGeos;
  }

  // Active 3D Effect & Projectile Lists
  const seekerState = new Map(); // seekerChar -> { pulseReadyAt, bombReadyAt, nextBotPulseAt, nextBotBombCheckAt }
  const activeWaves = [];        // Echo Pulse expanding 3D waves
  const bombs = [];              // Active Splash Bomb projectiles (exposed via getActiveBombs)
  const trailDrops = [];         // Trailing water droplets behind flying bombs
  const activeBursts = [];       // 3.5m Water Burst Domes + 28 Droplet Arcs

  // DOM Elements & Banner State
  let uiMounted = false;
  let barEl = null;
  let btnPulseEl = null;
  let btnBombEl = null;
  let pulseSubEl = null;
  let bombSubEl = null;
  let pulseCdFillEl = null;
  let bombCdFillEl = null;
  let bannerEl = null;
  let bannerTxtEl = null;
  let bannerFillEl = null;

  let bannerTimer = 0;
  let bannerFadeOutTimer = 0;
  let prevPulseReady = true;
  let prevBombReady = true;

  // ------------------------------------------------------------------------
  // State & Position Helpers
  // ------------------------------------------------------------------------
  function isHuntActive() {
    const G = env.G;
    if (!G || G.over) return false;
    return (G.mode === 'seek' && G.phase === 'seek') || (G.mode === 'hide' && G.phase === 'survive');
  }

  function isValidSeeker(seeker) {
    if (!seeker) return false;
    if (seeker.userData?.actor?.eliminated) return false;
    if (seeker.userData?.actor?.team === 'hiders') return false;
    return true;
  }

  function getSeekerState(seeker, now) {
    let st = seekerState.get(seeker);
    if (!st) {
      const slotIdx = seeker?.userData?.actor?.slotIdx ?? seekerState.size;
      st = {
        pulseReadyAt: 0,
        bombReadyAt: 0,
        nextBotPulseAt: now + 3800 + (slotIdx % 5) * 3700 + rand(0, 1900),
        nextBotBombCheckAt: now + 1100 + (slotIdx % 5) * 480,
      };
      seekerState.set(seeker, st);
    }
    return st;
  }

  function getGroundY(x, z, refY) {
    if (typeof env.groundHeightAt === 'function') {
      return env.groundHeightAt(x, z, refY);
    }
    return typeof refY === 'number' ? refY : 0;
  }

  function getCharCenter(ch) {
    if (typeof env.centerOf === 'function') {
      return env.centerOf(ch);
    }
    const u = ch.userData || {};
    const gy = (u.groundY ?? ch.position?.y ?? 0) + (u.specialY || 0) + (u.jy || 0);
    return new THREE.Vector3(ch.position.x, gy + (u.height || 1.1) * 0.5, ch.position.z);
  }

  function getCharFootPos(ch) {
    const u = ch.userData || {};
    const gy = (u.groundY ?? ch.position?.y ?? 0) + (u.specialY || 0) + (u.jy || 0);
    return new THREE.Vector3(ch.position.x, gy, ch.position.z);
  }

  // ------------------------------------------------------------------------
  // DOM HUD Mounting & Updates
  // ------------------------------------------------------------------------
  function ensureStylesheetLinked() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.querySelector('link[href*="seeker_gadgets.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'seeker_gadgets.css';
    document.head.appendChild(link);
  }

  function triggerCardAnim(el, cls) {
    if (!el) return;
    el.classList.remove('sg-fired', 'sg-deny', 'sg-just-ready');
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function showDowsingBanner(text, tier) {
    if (!bannerEl || !bannerTxtEl) return;
    bannerTxtEl.textContent = text;
    bannerEl.classList.remove('hidden', 'is-fading', 'is-popping', 'is-cold', 'is-warm', 'is-hot');
    bannerEl.classList.add(`is-${tier}`);
    void bannerEl.offsetWidth;
    bannerEl.classList.add('is-popping');
    if (bannerFillEl) bannerFillEl.style.width = '100%';
    bannerTimer = BANNER_SHOW_SEC;
    bannerFadeOutTimer = 0.36;
  }

  function hideDowsingBannerImmediate() {
    bannerTimer = 0;
    bannerFadeOutTimer = 0;
    if (bannerEl) {
      bannerEl.classList.add('hidden');
      bannerEl.classList.remove('is-fading', 'is-popping', 'is-cold', 'is-warm', 'is-hot');
    }
  }

  function notifyLocalCooldown(kind) {
    const G = env.G;
    if (!G || !G.player) return;
    const now = getNow();
    const st = getSeekerState(G.player, now);
    if (kind === 'pulse') {
      const rem = Math.max(0, (st.pulseReadyAt - now) / 1000);
      triggerCardAnim(btnPulseEl, 'sg-deny');
      if (rem > 0.25 && typeof env.hint === 'function') {
        env.hint(`🧭 Echo Pulse recharging (${rem.toFixed(1)}s)`, 950);
      }
    } else if (kind === 'bomb') {
      const rem = Math.max(0, (st.bombReadyAt - now) / 1000);
      triggerCardAnim(btnBombEl, 'sg-deny');
      if (rem > 0.25 && typeof env.hint === 'function') {
        env.hint(`💣 Splash Bomb refilling (${rem.toFixed(1)}s)`, 950);
      }
    }
  }

  function mountUI() {
    if (typeof document === 'undefined') return;
    ensureStylesheetLinked();
    const hud = document.getElementById('hud');
    if (!hud) return;

    barEl = document.getElementById('seekerGadgetsBar');
    if (!barEl) {
      barEl = document.createElement('div');
      barEl.id = 'seekerGadgetsBar';
      barEl.className = 'hidden';
      barEl.setAttribute('aria-label', 'Seeker Gadgets');
      barEl.innerHTML =
        `<button id="btnGadgetPulse" class="sg-card is-ready" type="button" data-gadget="pulse" aria-label="Echo Pulse (Q)">` +
          `<span class="sg-key">Q</span>` +
          `<span class="sg-icon-wrap"><span class="sg-icon">🧭</span></span>` +
          `<span class="sg-meta">` +
            `<span class="sg-title">Echo Pulse</span>` +
            `<span id="sgPulseStatus" class="sg-sub">18m Sense</span>` +
          `</span>` +
          `<span class="sg-cd-track"><i id="sgPulseCdFill" class="sg-cd-fill"></i></span>` +
        `</button>` +
        `<button id="btnGadgetBomb" class="sg-card is-ready" type="button" data-gadget="bomb" aria-label="Splash Bomb (E)">` +
          `<span class="sg-key">E</span>` +
          `<span class="sg-icon-wrap"><span class="sg-icon">💣</span></span>` +
          `<span class="sg-meta">` +
            `<span class="sg-title">Splash Bomb</span>` +
            `<span id="sgBombStatus" class="sg-sub">3.5m Lob</span>` +
          `</span>` +
          `<span class="sg-cd-track"><i id="sgBombCdFill" class="sg-cd-fill"></i></span>` +
        `</button>`;
      hud.appendChild(barEl);
    }

    bannerEl = document.getElementById('dowsingBanner');
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'dowsingBanner';
      bannerEl.className = 'hidden';
      bannerEl.setAttribute('role', 'status');
      bannerEl.setAttribute('aria-live', 'polite');
      bannerEl.innerHTML =
        `<span id="dowsingBannerTxt" class="sg-dowsing-txt"></span>` +
        `<span class="sg-dowsing-timer"><i id="dowsingBannerFill"></i></span>`;
      hud.appendChild(bannerEl);
    }

    btnPulseEl = document.getElementById('btnGadgetPulse');
    btnBombEl = document.getElementById('btnGadgetBomb');
    pulseSubEl = document.getElementById('sgPulseStatus');
    bombSubEl = document.getElementById('sgBombStatus');
    pulseCdFillEl = document.getElementById('sgPulseCdFill');
    bombCdFillEl = document.getElementById('sgBombCdFill');
    bannerTxtEl = document.getElementById('dowsingBannerTxt');
    bannerFillEl = document.getElementById('dowsingBannerFill');

    if (btnPulseEl && !btnPulseEl.dataset.wired) {
      btnPulseEl.dataset.wired = '1';
      btnPulseEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        const res = useEchoPulse(env.G?.player);
        if (!res.ok) notifyLocalCooldown('pulse');
      });
    }

    if (btnBombEl && !btnBombEl.dataset.wired) {
      btnBombEl.dataset.wired = '1';
      btnBombEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        const ok = useSplashBomb(env.G?.player);
        if (!ok) notifyLocalCooldown('bomb');
      });
    }

    uiMounted = true;
  }

  const _sgHudCache = {};
  function updateHUD(dt, now) {
    if (!uiMounted && typeof document !== 'undefined' && document.getElementById('hud')) {
      mountUI();
    }
    const G = env.G;
    const showBar = !!(G && G.mode === 'seek' && G.phase === 'seek' && !G.over);
    if (barEl && _sgHudCache.showBar !== showBar) {
      _sgHudCache.showBar = showBar;
      barEl.classList.toggle('hidden', !showBar);
    }

    if (showBar && G.player) {
      const st = getSeekerState(G.player, now);
      const sPerk = typeof env.getSeekerPerk === 'function' ? (env.getSeekerPerk(G.player) || 'none') : 'none';
      const pCdSec = sPerk === 'keen_echo' ? 14.0 : PULSE_CD_SEC;
      const pRadM = sPerk === 'keen_echo' ? 21.5 : PULSE_RADIUS;
      const bCdSec = sPerk === 'cluster_bomb' ? 11.2 : BOMB_CD_SEC;
      const bRadM = sPerk === 'cluster_bomb' ? 4.4 : BOMB_RADIUS;
      const pulseRem = Math.max(0, (st.pulseReadyAt - now) / 1000);
      const bombRem = Math.max(0, (st.bombReadyAt - now) / 1000);

      const pulseReady = pulseRem <= 0.01;
      const bombReady = bombRem <= 0.01;

      if (btnPulseEl && _sgHudCache.pulseReady !== pulseReady) {
        _sgHudCache.pulseReady = pulseReady;
        btnPulseEl.classList.toggle('is-ready', pulseReady);
        btnPulseEl.classList.toggle('is-cooling', !pulseReady);
        if (pulseReady && !prevPulseReady) triggerCardAnim(btnPulseEl, 'sg-just-ready');
      }
      const pSubStr = pulseReady ? `${pRadM}m Sense` : `${pulseRem.toFixed(1)}s`;
      if (pulseSubEl && _sgHudCache.pSub !== pSubStr) {
        _sgHudCache.pSub = pSubStr;
        pulseSubEl.textContent = pSubStr;
      }
      if (pulseCdFillEl) {
        const pct = pulseReady ? 100 : clamp((1 - pulseRem / pCdSec) * 100, 0, 100);
        const wStr = `${pct.toFixed(0)}%`;
        if (_sgHudCache.pW !== wStr) {
          _sgHudCache.pW = wStr;
          pulseCdFillEl.style.width = wStr;
        }
      }

      if (btnBombEl && _sgHudCache.bombReady !== bombReady) {
        _sgHudCache.bombReady = bombReady;
        btnBombEl.classList.toggle('is-ready', bombReady);
        btnBombEl.classList.toggle('is-cooling', !bombReady);
        if (bombReady && !prevBombReady) triggerCardAnim(btnBombEl, 'sg-just-ready');
      }
      const bSubStr = bombReady ? `${bRadM}m Lob` : `${bombRem.toFixed(1)}s`;
      if (bombSubEl && _sgHudCache.bSub !== bSubStr) {
        _sgHudCache.bSub = bSubStr;
        bombSubEl.textContent = bSubStr;
      }
      if (bombCdFillEl) {
        const pct = bombReady ? 100 : clamp((1 - bombRem / bCdSec) * 100, 0, 100);
        const wStr = `${pct.toFixed(0)}%`;
        if (_sgHudCache.bW !== wStr) {
          _sgHudCache.bW = wStr;
          bombCdFillEl.style.width = wStr;
        }
      }

      prevPulseReady = pulseReady;
      prevBombReady = bombReady;
    }

    // Dowsing Readout Banner countdown & clean 4.2s fade
    if (bannerEl && !bannerEl.classList.contains('hidden')) {
      if (!G || G.mode !== 'seek' || G.over) {
        hideDowsingBannerImmediate();
      } else if (bannerTimer > 0) {
        bannerTimer = Math.max(0, bannerTimer - dt);
        if (bannerFillEl) {
          const bw = `${clamp((bannerTimer / BANNER_SHOW_SEC) * 100, 0, 100).toFixed(0)}%`;
          if (_sgHudCache.banW !== bw) {
            _sgHudCache.banW = bw;
            bannerFillEl.style.width = bw;
          }
        }
        if (bannerTimer <= 0) {
          bannerEl.classList.add('is-fading');
        }
      } else if (bannerFadeOutTimer > 0) {
        bannerFadeOutTimer -= dt;
        if (bannerFadeOutTimer <= 0) {
          hideDowsingBannerImmediate();
        }
      }
    }
  }

  // ------------------------------------------------------------------------
  // 1. Dowsing Compass / Echo Pulse (Q — 18s Cooldown)
  // ------------------------------------------------------------------------
  function spawnEchoWave3D(originX, originZ, baseGroundY, tier, isLocalSeeker) {
    if (!THREE || !env.scene) return;
    const geos = getSharedGeos();
    if (!geos) return;

    // Local Seeker sees subtle watercolor temperature tint; in Hide mode enemy waves stay spirit-water aqua
    const ringHex = !isLocalSeeker
      ? 0x5cc4f2
      : tier === 'hot'
        ? 0xff825c
        : tier === 'warm'
          ? 0xffcf68
          : 0x62c8f5;
    const innerHex = !isLocalSeeker
      ? 0xd6f5ff
      : tier === 'hot'
        ? 0xffe0b5
        : tier === 'warm'
          ? 0xfff7cf
          : 0xdff6ff;

    const group = new THREE.Group();
    group.position.set(originX, baseGroundY + 0.05, originZ);

    const outerMat = new THREE.MeshBasicMaterial({
      color: ringHex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const outerMesh = new THREE.Mesh(geos.outerRing, outerMat);
    outerMesh.renderOrder = 4;
    group.add(outerMesh);

    const innerMat = new THREE.MeshBasicMaterial({
      color: innerHex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerMesh = new THREE.Mesh(geos.innerRing, innerMat);
    innerMesh.position.y = 0.012;
    innerMesh.renderOrder = 4;
    group.add(innerMesh);

    const cylMat = new THREE.MeshBasicMaterial({
      color: ringHex,
      map: geos.curtainTex || null,
      transparent: true,
      opacity: geos.curtainTex ? 0.56 : 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cylMesh = new THREE.Mesh(geos.shimmerCyl, cylMat);
    cylMesh.renderOrder = 4;
    group.add(cylMesh);

    // Rising Storybook water-spirit dewdrop motes along the expanding ring
    const motes = [];
    const moteMat = new THREE.MeshBasicMaterial({
      color: innerHex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const moteCount = 12;
    for (let i = 0; i < moteCount; i++) {
      const m = new THREE.Mesh(geos.moteSphere, moteMat);
      m.renderOrder = 5;
      group.add(m);
      motes.push({
        mesh: m,
        ang: (i / moteCount) * Math.PI * 2 + rand(-0.14, 0.14),
        riseSpeed: rand(0.55, 1.25),
        yOffset: rand(0.08, 0.32),
      });
    }

    group.scale.set(0.5, 1, 0.5);
    env.scene.add(group);

    activeWaves.push({
      group,
      outerMesh,
      innerMesh,
      cylMesh,
      outerMat,
      innerMat,
      cylMat,
      moteMat,
      motes,
      originX,
      originZ,
      baseGroundY,
      age: 0,
      dur: PULSE_WAVE_DUR,
    });
  }

  function disposeWave(w) {
    if (env.scene && w.group) env.scene.remove(w.group);
    w.outerMat?.dispose();
    w.innerMat?.dispose();
    w.cylMat?.dispose();
    w.moteMat?.dispose();
  }

  function updateWaves(dt) {
    for (let i = activeWaves.length - 1; i >= 0; i--) {
      const w = activeWaves[i];
      w.age += dt;
      const p = clamp(w.age / w.dur, 0, 1);
      if (p >= 1) {
        disposeWave(w);
        activeWaves.splice(i, 1);
        continue;
      }

      const radius = lerp(0.5, PULSE_RADIUS, easeOutCubic(p));
      const fade = Math.pow(1 - p, 1.35);
      const gy = getGroundY(w.originX, w.originZ, w.baseGroundY);
      w.group.position.set(w.originX, gy + 0.05, w.originZ);

      w.outerMesh.scale.setScalar(radius);
      w.innerMesh.scale.setScalar(Math.max(0.35, radius * 0.86));
      w.cylMesh.scale.set(radius, lerp(1.15, 0.45, p), radius);

      w.outerMat.opacity = 0.86 * fade;
      w.innerMat.opacity = 0.62 * fade;
      w.cylMat.opacity = (w.cylMat.map ? 0.54 : 0.26) * fade;
      w.moteMat.opacity = 0.88 * fade;

      for (let k = 0; k < w.motes.length; k++) {
        const mt = w.motes[k];
        const a = mt.ang + w.age * 0.45;
        mt.mesh.position.set(
          Math.cos(a) * radius,
          mt.yOffset + w.age * mt.riseSpeed,
          Math.sin(a) * radius
        );
        const sc = Math.max(0.2, 1.15 - p * 0.75);
        mt.mesh.scale.setScalar(sc);
      }
    }
  }

  function makeFuzzySearchPos(hiderChar, seekerChar) {
    if (!THREE || !hiderChar) return null;
    const ang = rand(0, Math.PI * 2);
    const r = rand(2.2, 5.0); // ±5m fuzzy hot/cold search offset (never wallhack!)
    let fx = hiderChar.position.x + Math.cos(ang) * r;
    let fz = hiderChar.position.z + Math.sin(ang) * r;
    const radFromOrigin = Math.hypot(fx, fz);
    if (radFromOrigin > 27.5) {
      fx *= 27.5 / radFromOrigin;
      fz *= 27.5 / radFromOrigin;
    }
    const refY = hiderChar.userData?.groundY ?? seekerChar?.userData?.groundY ?? 0;
    const fy = getGroundY(fx, fz, refY);
    return new THREE.Vector3(fx, fy, fz);
  }

  function executeEchoPulse(seeker = env.G?.player, opts = null) {
    const G = env.G;
    const fromNet = !!(opts && opts.fromNet);
    if (!G || (!fromNet && !isHuntActive()) || !isValidSeeker(seeker)) {
      return { ok: false, count18: 0, countHot: 0, fuzzyPos: null };
    }

    const now = getNow();
    const st = getSeekerState(seeker, now);
    if (!fromNet && now < st.pulseReadyAt) {
      return { ok: false, count18: 0, countHot: 0, fuzzyPos: null };
    }

    const sPerk = typeof env.getSeekerPerk === 'function' ? (env.getSeekerPerk(seeker) || 'none') : 'none';
    const effPulseCdMs = sPerk === 'keen_echo' ? 14000 : PULSE_CD_MS;
    const effPulseRad = sPerk === 'keen_echo' ? 21.5 : PULSE_RADIUS;

    st.pulseReadyAt = now + effPulseCdMs;
    if (!fromNet) {
      env.onLocalGadget?.({
        k: 'pulse',
        t: 1,
        s: seeker.userData?.actor?.slotIdx ?? 0,
      }, seeker);
    }

    const sx = seeker.position?.x || 0;
    const sz = seeker.position?.z || 0;
    const sRefY = (seeker.userData?.groundY ?? seeker.position?.y ?? 0) + (seeker.userData?.jy || 0);
    const groundY = getGroundY(sx, sz, sRefY);
    const seekerCenter = getCharCenter(seeker);

    // Count living Hiders within effPulseRad (18m or 21.5m with Keen Echo) and 8.5m ("HOT!")
    const livingHiders = (G.allHiders || []).filter((h) => h && !h.userData?.actor?.eliminated);
    let count18 = 0;
    let countHot = 0;
    let closestHider = null;
    let closestDist = Infinity;

    for (let i = 0; i < livingHiders.length; i++) {
      const h = livingHiders[i];
      const hCenter = getCharCenter(h);
      const d = seekerCenter.distanceTo(hCenter);
      if (d <= effPulseRad) {
        count18++;
        if (d <= PULSE_HOT_RADIUS) countHot++;
        if (d < closestDist) {
          closestDist = d;
          closestHider = h;
        }
      }
    }

    const tier = count18 === 0 ? 'cold' : countHot > 0 ? 'hot' : 'warm';
    const isLocalPlayer = seeker === G.player;

    spawnEchoWave3D(sx, sz, groundY, tier, isLocalPlayer);
    env.ripple?.({ x: sx, y: groundY, z: sz }, 2.1);
    gadgetSfx.playEchoPulse({ x: sx, y: groundY + 0.8, z: sz }, isLocalPlayer, tier);

    env.recordStat?.(seeker, 'pulsesUsed', 1);
    if (count18 > 0) {
      env.recordStat?.(seeker, 'pulseDetections', count18);
    }

    const fuzzyPos = closestHider ? makeFuzzySearchPos(closestHider, seeker) : null;
    if (typeof env.onBotPulseResult === 'function') {
      env.onBotPulseResult(seeker, count18, fuzzyPos ? fuzzyPos.clone() : null);
    }

    // Local Seeker UI Readout & Token Reward
    if (isLocalPlayer && G.mode === 'seek') {
      triggerCardAnim(btnPulseEl, 'sg-fired');
      let msg;
      if (count18 === 0) {
        msg = '❄️ Cold — 0 Spirits within 18m';
      } else if (countHot > 0) {
        msg = `🔥 HOT! ${count18} Spirit${count18 > 1 ? 's' : ''} within 18m (${countHot} right nearby!)`;
      } else {
        msg = `🌊 Warm — ${count18} Spirit${count18 > 1 ? 's' : ''} hiding within 18m!`;
      }
      showDowsingBanner(msg, tier);
      env.hint?.(msg, 2800);

      if (count18 > 0) {
        env.awardTokens?.(
          'pulse_ping',
          10,
          '🧭 Echo Pulse sensed ' + count18 + ' Spirit' + (count18 > 1 ? 's' : '') + '! +10 🪙'
        );
      }
    }

    // Counterplay warning for local Hider when a Seeker's Echo Pulse sweeps past them!
    if (G.mode === 'hide' && G.player && !G.player.userData?.actor?.eliminated) {
      const playerCenter = getCharCenter(G.player);
      if (seekerCenter.distanceTo(playerCenter) <= PULSE_RADIUS) {
        env.hint?.('🌊 A Seeker’s Echo Pulse swept past you — stay sharp!', 2000);
      }
    }

    return { ok: true, count18, countHot, fuzzyPos };
  }

  function useEchoPulse(seeker = env.G?.player, opts = null) {
    const res = executeEchoPulse(seeker, opts);
    return { ok: res.ok, count18: res.count18, countHot: res.countHot };
  }

  // ------------------------------------------------------------------------
  // 2. Splash Bomb (E — 14s Cooldown · 16.5 m/s · 3.5m Water Burst AoE)
  // ------------------------------------------------------------------------
  function buildWaterBalloonMesh() {
    const geos = getSharedGeos();
    const root = new THREE.Group();
    const visual = new THREE.Group();
    root.add(visual);

    const outerMat = new THREE.MeshPhongMaterial({
      color: 0x4cc3f7,
      emissive: 0x1968a2,
      emissiveIntensity: 0.42,
      specular: 0xffffff,
      shininess: 135,
      transparent: true,
      opacity: 0.88,
    });
    const outer = new THREE.Mesh(geos.balloonSphere, outerMat);
    outer.castShadow = true;
    outer.renderOrder = 4;
    visual.add(outer);

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xe6fbff,
      transparent: true,
      opacity: 0.72,
    });
    const core = new THREE.Mesh(geos.balloonCore, coreMat);
    core.position.set(0.035, 0.045, 0.025);
    visual.add(core);

    const knotMat = new THREE.MeshLambertMaterial({ color: 0x267cb5 });
    const knot = new THREE.Mesh(geos.balloonKnot, knotMat);
    knot.position.set(0, -0.235, 0);
    knot.rotation.x = Math.PI;
    visual.add(knot);

    const lip = new THREE.Mesh(geos.balloonLip, knotMat);
    lip.position.set(0, -0.195, 0);
    lip.rotation.x = Math.PI / 2;
    visual.add(lip);

    return { root, visual, mats: [outerMat, coreMat, knotMat] };
  }

  function spawnTrailDroplet(pos, bombVel) {
    if (!THREE || !env.scene || trailDrops.length > 90) return;
    const geos = getSharedGeos();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbaf0ff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geos.trailDrop, mat);
    mesh.position.set(
      pos.x + rand(-0.07, 0.07),
      pos.y + rand(-0.07, 0.07),
      pos.z + rand(-0.07, 0.07)
    );
    mesh.renderOrder = 4;
    env.scene.add(mesh);
    trailDrops.push({
      mesh,
      mat,
      vel: new THREE.Vector3(
        bombVel.x * 0.12 + rand(-0.65, 0.65),
        rand(0.15, 1.05),
        bombVel.z * 0.12 + rand(-0.65, 0.65)
      ),
      age: 0,
      maxLife: rand(0.24, 0.38),
    });
  }

  function updateTrailDroplets(dt) {
    for (let i = trailDrops.length - 1; i >= 0; i--) {
      const d = trailDrops[i];
      d.age += dt;
      if (d.age >= d.maxLife) {
        if (env.scene) env.scene.remove(d.mesh);
        d.mat.dispose();
        trailDrops.splice(i, 1);
        continue;
      }
      d.vel.y -= 12.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      const k = 1 - d.age / d.maxLife;
      d.mesh.scale.setScalar(Math.max(0.15, k));
      d.mat.opacity = 0.8 * k;
    }
  }

  function spawnWaterBurst3D(hitPos) {
    if (!THREE || !env.scene) return;
    const geos = getSharedGeos();
    if (!geos) return;

    const gy = getGroundY(hitPos.x, hitPos.z, hitPos.y);
    const ringY = Math.abs(hitPos.y - gy) < 0.75 ? gy + 0.045 : hitPos.y + 0.02;

    const group = new THREE.Group();
    env.scene.add(group);

    // 1. Outer 3.5m Translucent Aqua Burst Dome
    const domeMat = new THREE.MeshPhongMaterial({
      color: 0x6dd0ff,
      emissive: 0x2278b5,
      emissiveIntensity: 0.45,
      specular: 0xffffff,
      shininess: 110,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const domeMesh = new THREE.Mesh(geos.burstDome, domeMat);
    domeMesh.position.set(hitPos.x, ringY - 0.03, hitPos.z);
    domeMesh.scale.setScalar(0.35);
    domeMesh.renderOrder = 4;
    group.add(domeMesh);

    // 2. Inner Frothy Cream-White Water Core Dome
    const innerDomeMat = new THREE.MeshBasicMaterial({
      color: 0xeefbff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerDomeMesh = new THREE.Mesh(geos.burstDome, innerDomeMat);
    innerDomeMesh.position.set(hitPos.x, ringY - 0.02, hitPos.z);
    innerDomeMesh.scale.setScalar(0.22);
    innerDomeMesh.renderOrder = 5;
    group.add(innerDomeMesh);

    // 3. Expanding 3.5m Ground Foam Ring
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xfffdf2,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const foamMesh = new THREE.Mesh(geos.foamRing, foamMat);
    foamMesh.position.set(hitPos.x, ringY, hitPos.z);
    foamMesh.scale.setScalar(0.4);
    foamMesh.renderOrder = 5;
    group.add(foamMesh);

    // 4. 28 Splashing Droplet Arcs fanning across the 3.5m splash zone
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xbff2ff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const droplets = [];
    const dropCount = 28;
    for (let i = 0; i < dropCount; i++) {
      const dm = new THREE.Mesh(geos.arcDrop, dropMat);
      dm.position.set(hitPos.x, hitPos.y + 0.14, hitPos.z);
      dm.renderOrder = 5;
      group.add(dm);
      const ang = (i / dropCount) * Math.PI * 2 + rand(-0.12, 0.12);
      const hSpd = rand(2.6, 6.8);
      const vSpd = rand(3.2, 7.6);
      droplets.push({
        mesh: dm,
        vel: new THREE.Vector3(Math.cos(ang) * hSpd, vSpd, Math.sin(ang) * hSpd),
        baseScale: rand(0.75, 1.45),
      });
    }

    activeBursts.push({
      group,
      domeMesh,
      innerDomeMesh,
      foamMesh,
      domeMat,
      innerDomeMat,
      foamMat,
      dropMat,
      droplets,
      age: 0,
      dur: 0.56,
    });
  }

  function disposeBurst(b) {
    if (env.scene && b.group) env.scene.remove(b.group);
    b.domeMat?.dispose();
    b.innerDomeMat?.dispose();
    b.foamMat?.dispose();
    b.dropMat?.dispose();
  }

  function updateBursts(dt) {
    for (let i = activeBursts.length - 1; i >= 0; i--) {
      const b = activeBursts[i];
      b.age += dt;
      const p = clamp(b.age / b.dur, 0, 1);
      if (p >= 1) {
        disposeBurst(b);
        activeBursts.splice(i, 1);
        continue;
      }

      const domeP = clamp(b.age / 0.42, 0, 1);
      const domeRadius = lerp(0.38, BOMB_RADIUS, easeOutQuart(domeP));
      b.domeMesh.scale.set(domeRadius, domeRadius * lerp(0.95, 0.58, domeP), domeRadius);
      b.domeMat.opacity = 0.72 * Math.pow(1 - domeP, 1.45);

      const innerR = domeRadius * 0.66;
      b.innerDomeMesh.scale.set(innerR, innerR * 0.78, innerR);
      b.innerDomeMat.opacity = 0.78 * Math.pow(1 - domeP, 1.8);

      const foamR = lerp(0.45, BOMB_RADIUS * 1.02, easeOutCubic(p));
      b.foamMesh.scale.setScalar(foamR);
      b.foamMat.opacity = 0.9 * Math.pow(1 - p, 1.3);

      b.dropMat.opacity = 0.92 * (1 - p * p);
      for (let k = 0; k < b.droplets.length; k++) {
        const dr = b.droplets[k];
        dr.vel.y -= 18.5 * dt;
        dr.mesh.position.addScaledVector(dr.vel, dt);
        const spd = dr.vel.length();
        if (spd > 0.05 && _upVec) {
          _tmpVec.copy(dr.vel).divideScalar(spd);
          dr.mesh.quaternion.setFromUnitVectors(_upVec, _tmpVec);
        }
        const s = dr.baseScale * Math.max(0.2, 1 - p * 0.65);
        dr.mesh.scale.set(s, s * 1.85, s);
      }
    }
  }

  function disposeBomb(b) {
    if (env.scene && b.mesh) env.scene.remove(b.mesh);
    if (b._mats) {
      for (let i = 0; i < b._mats.length; i++) b._mats[i].dispose();
    }
  }

  function detonateSplashBomb(bomb, hitPos) {
    const G = env.G;
    const seeker = bomb.seeker;
    const elemId = bomb.elemId || seeker?.userData?.elemId || seeker?.userData?.elemGun || 'water';

    spawnWaterBurst3D(hitPos);
    env.splash?.(hitPos, 32, 3.6);
    env.ripple?.(hitPos, 2.6);
    env.puddle?.(hitPos);
    env.audio?.splash?.(hitPos.x, hitPos.z);
    env.onBombDetonated?.(elemId, hitPos, seeker, !!bomb.remoteVisual);

    if (bomb.remoteVisual) {
      gadgetSfx.playBombBurst(hitPos, false);
      return;
    }

    const effBombRadius = bomb.radius || BOMB_RADIUS;

    // Pop any Hider Decoy Clones within effBombRadius!
    const decoysPopped = typeof env.onSplashExplosion === 'function'
      ? (env.onSplashExplosion(hitPos, effBombRadius, seeker) || 0)
      : 0;

    // AoE soak damage to every living Hider within effBombRadius (zero wrong-prop time penalty on misses!)
    let hits = 0;
    if (G && !G.over) {
      const livingHiders = (G.allHiders || []).filter((h) => h && !h.userData?.actor?.eliminated);
      const damagedSet = new Set();
      for (let i = 0; i < livingHiders.length; i++) {
        const h = livingHiders[i];
        if (damagedSet.has(h)) continue;
        const hCenter = getCharCenter(h);
        const hFoot = getCharFootPos(h);
        const dist = Math.min(hitPos.distanceTo(hCenter), hitPos.distanceTo(hFoot));
        if (dist <= effBombRadius) {
          damagedSet.add(h);
          const falloffT = clamp((dist - 0.55) / Math.max(0.5, effBombRadius - 0.55), 0, 1);
          const dmg = Math.round(lerp(38, 25, falloffT));
          if (h.userData && typeof h.userData.lastHitTick === 'number') {
            h.userData.lastHitTick = -1e9;
          }
          env.onBombCharacterHit?.(h, seeker, elemId, hitPos);
          env.damageHider?.(h, seeker, dmg);
          env.recordStat?.(seeker, 'bombHits', 1);
          hits++;
        }
      }
    }

    const isLocalSeeker = !!(G && seeker === G.player);
    gadgetSfx.playBombBurst(hitPos, isLocalSeeker && (hits > 0 || decoysPopped > 0));

    if (isLocalSeeker) {
      if (hits > 0) {
        env.awardTokens?.(
          'bomb_hit',
          20 * hits,
          '💣 Splash Bomb hit ' + hits + ' Spirit' + (hits > 1 ? 's' : '') + '! +' + (20 * hits) + ' 🪙'
        );
        env.hint?.('💦 Direct Splash Bomb! Hit ' + hits + ' Spirit' + (hits > 1 ? 's' : '') + '!', 1600);
      } else if (decoysPopped > 0) {
        env.hint?.('💥 Splash Bomb popped ' + decoysPopped + ' Decoy' + (decoysPopped > 1 ? 's' : '') + '!', 1500);
      }
    }
  }

  function safeLaunchOrigin(anchorPos, desiredOffset) {
    const out = anchorPos.clone().add(desiredOffset);
    if (!raycaster || !env.solids || !env.solids.length) return out;
    const len = desiredOffset.length();
    if (len < 1e-4) return out;
    _segDir.copy(desiredOffset).divideScalar(len);
    raycaster.set(anchorPos, _segDir);
    raycaster.far = len + 0.08;
    raycaster.firstHitOnly = true;
    const hit = raycaster.intersectObjects(env.solids, false)[0];
    raycaster.firstHitOnly = false;
    if (hit && hit.distance < len + 0.05) {
      return anchorPos.clone().addScaledVector(_segDir, Math.max(0.05, hit.distance - 0.12));
    }
    return out;
  }

  function useSplashBomb(seeker = env.G?.player, aimDirOverride = null, opts = null) {
    const G = env.G;
    const fromNet = !!(opts && opts.fromNet);
    if (!THREE || !G || (!fromNet && !isHuntActive()) || !isValidSeeker(seeker)) {
      return false;
    }

    const now = getNow();
    const st = getSeekerState(seeker, now);
    if (!fromNet && now < st.bombReadyAt) {
      return false;
    }

    const sPerk = typeof env.getSeekerPerk === 'function' ? (env.getSeekerPerk(seeker) || 'none') : 'none';
    const effBombCdMs = sPerk === 'cluster_bomb' ? 11200 : BOMB_CD_MS;
    const effBombRadius = sPerk === 'cluster_bomb' ? 4.4 : BOMB_RADIUS;

    st.bombReadyAt = now + effBombCdMs;
    env.recordStat?.(seeker, 'bombsThrown', 1);

    const isLocalPlayer = seeker === G.player;
    let dir;
    let launchPos;

    if (fromNet && Array.isArray(opts?.origin) && opts.origin.length >= 3 && aimDirOverride) {
      dir = new THREE.Vector3(aimDirOverride.x, aimDirOverride.y, aimDirOverride.z).normalize();
      launchPos = new THREE.Vector3(opts.origin[0], opts.origin[1], opts.origin[2]);
      if (seeker.userData) {
        seeker.userData.aim = true;
        seeker.userData.aimUntil = now + 420;
      }
    } else if (isLocalPlayer && !aimDirOverride && env.camera) {
      // Camera forward vector tilted slightly upward (+0.12 pitch lift) for a satisfying lob!
      dir = new THREE.Vector3(0, 0, -1).applyQuaternion(env.camera.quaternion);
      dir.y += 0.12;
      dir.normalize();

      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(env.camera.quaternion);
      const offset = dir.clone().multiplyScalar(0.38).addScaledVector(camRight, 0.16);
      offset.y -= 0.12;
      launchPos = safeLaunchOrigin(env.camera.position, offset);
    } else {
      const sx = seeker.position?.x || 0;
      const sz = seeker.position?.z || 0;
      const footY = (seeker.userData?.groundY ?? getGroundY(sx, sz)) + (seeker.userData?.jy || 0);
      const chestPos = new THREE.Vector3(sx, footY + 1.22, sz);

      if (aimDirOverride) {
        dir = new THREE.Vector3(aimDirOverride.x, aimDirOverride.y, aimDirOverride.z).normalize();
      } else {
        const yaw = seeker.rotation?.y || 0;
        dir = new THREE.Vector3(-Math.sin(yaw), 0.22, -Math.cos(yaw)).normalize();
      }

      launchPos = safeLaunchOrigin(chestPos, dir.clone().multiplyScalar(0.34));
      if (seeker.userData) {
        seeker.userData.aim = true;
        seeker.userData.aimUntil = now + 420;
      }
    }

    const elemId = (opts && opts.elemId) || seeker?.userData?.elemId || seeker?.userData?.elemGun || 'water';
    if (!fromNet) {
      env.onLocalGadget?.({
        k: 'bomb',
        t: 1,
        s: seeker.userData?.actor?.slotIdx ?? 0,
        o: [+launchPos.x.toFixed(2), +launchPos.y.toFixed(2), +launchPos.z.toFixed(2)],
        d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)],
        eg: elemId,
      }, seeker);
    }

    const built = buildWaterBalloonMesh();
    built.root.position.copy(launchPos);
    if (env.scene) env.scene.add(built.root);

    const vel = dir.clone().multiplyScalar(BOMB_SPEED);
    bombs.push({
      mesh: built.root,
      visual: built.visual,
      _mats: built.mats,
      pos: built.root.position,
      vel,
      seeker,
      elemId,
      remoteVisual: fromNet,
      radius: effBombRadius,
      age: 0,
      maxLife: BOMB_MAX_LIFE,
      trailAcc: 0,
      spinPhase: rand(0, Math.PI * 2),
    });

    if (isLocalPlayer) {
      triggerCardAnim(btnBombEl, 'sg-fired');
    }
    gadgetSfx.playBombThrow(launchPos, isLocalPlayer);
    return true;
  }

  function updateBombs(dt) {
    if (!THREE || !bombs.length) return;
    const G = env.G;
    const livingHiders = (G?.allHiders || []).filter((h) => h && !h.userData?.actor?.eliminated);

    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.age += dt;
      _prevPos.copy(b.pos);

      b.vel.y -= BOMB_GRAVITY * dt;
      _nextPos.copy(_prevPos).addScaledVector(b.vel, dt);
      _segVec.subVectors(_nextPos, _prevPos);
      const segLen = _segVec.length();

      let hitPos = null;
      let hitDist = Infinity;

      if (segLen > 1e-5) {
        _segDir.copy(_segVec).divideScalar(segLen);

        // 1. Direct mid-air contact check against living Hiders
        for (let k = 0; k < livingHiders.length; k++) {
          const h = livingHiders[k];
          const hc = getCharCenter(h);
          const hitR = Math.max(0.48, (h.userData?.radius || 0.45) + 0.22);
          const projT = clamp(_tmpVec.copy(hc).sub(_prevPos).dot(_segVec) / (segLen * segLen), 0, 1);
          const closestPt = _prevPos.clone().addScaledVector(_segVec, projT);
          if (closestPt.distanceTo(hc) <= hitR) {
            const dAlong = projT * segLen;
            if (dAlong < hitDist) {
              hitDist = dAlong;
              hitPos = closestPt;
            }
          }
        }

        // 2. Raycast against static world solids
        if (raycaster && env.solids && env.solids.length) {
          raycaster.set(_prevPos, _segDir);
          raycaster.far = segLen;
          raycaster.firstHitOnly = true;
          const solidHit = raycaster.intersectObjects(env.solids, false)[0];
          raycaster.firstHitOnly = false;
          if (solidHit && solidHit.distance < hitDist) {
            hitDist = solidHit.distance;
            hitPos = solidHit.point.clone().addScaledVector(_segDir, -0.05);
          }
        }
      }

      // 3. Terrain / floor height check
      if (!hitPos) {
        const gy = getGroundY(_nextPos.x, _nextPos.z, _prevPos.y);
        if (_nextPos.y <= gy + 0.12) {
          const denom = Math.max(1e-4, _prevPos.y - _nextPos.y);
          const frac = clamp((_prevPos.y - (gy + 0.12)) / denom, 0, 1);
          hitPos = _prevPos.clone().addScaledVector(_segVec, frac);
          hitPos.y = gy + 0.05;
        }
      }

      // 4. Max flight lifetime safety detonation
      if (!hitPos && (b.age >= b.maxLife || _nextPos.y < -15)) {
        hitPos = _nextPos.clone();
      }

      if (hitPos) {
        disposeBomb(b);
        bombs.splice(i, 1);
        detonateSplashBomb(b, hitPos);
        continue;
      }

      // Advance in-flight Water Balloon + squash wobble + trailing droplets
      b.pos.copy(_nextPos);
      const spd = b.vel.length();
      if (spd > 0.05 && b.visual) {
        _tmpVec.copy(b.vel).divideScalar(spd);
        b.visual.quaternion.setFromUnitVectors(_upVec, _tmpVec);
        const wob = Math.sin(b.age * 20 + b.spinPhase) * 0.11;
        b.visual.scale.set(1 - wob * 0.55, 1 + wob, 1 - wob * 0.55);
      }

      b.trailAcc += dt;
      if (b.trailAcc >= 0.026) {
        b.trailAcc = 0;
        spawnTrailDroplet(b.pos, b.vel);
      }
    }
  }

  // ------------------------------------------------------------------------
  // 3. Smart Non-Remote Bot Seeker Gadget Usage
  // ------------------------------------------------------------------------
  function hasClearLobStart(origin, dir) {
    if (!raycaster || !env.solids || !env.solids.length) return true;
    raycaster.set(origin, dir);
    raycaster.far = 2.35;
    raycaster.firstHitOnly = true;
    const hit = raycaster.intersectObjects(env.solids, false)[0];
    raycaster.firstHitOnly = false;
    return !hit;
  }

  function updateBotSeekers(now) {
    const G = env.G;
    if (!G || !isHuntActive()) return;

    const rawList = G.allSeekers && G.allSeekers.length ? G.allSeekers : (G.seekers || []);
    for (let i = 0; i < rawList.length; i++) {
      const s = rawList[i];
      if (!s || s === G.player) continue;
      const act = s.userData?.actor;
      if (!act || act.eliminated || !act.isBot || act.isRemote) continue;

      // Skip if blinded by a Hider Decoy!
      if ((s.userData?.blindUntil || 0) > now) continue;

      const ai = s.userData?.ai;
      if (ai && (ai.releaseDelay || 0) > 0) continue;

      const st = getSeekerState(s, now);
      const aiState = ai?.state || 'patrol';

      // A) Tactical Echo Pulse every 19-26s (staggered per slot) when patrolling or searching
      if ((aiState === 'patrol' || aiState === 'search') && now >= st.nextBotPulseAt && now >= st.pulseReadyAt) {
        const res = executeEchoPulse(s);
        st.nextBotPulseAt = now + rand(19000, 26000);
        if (res.ok && ai) {
          if (res.count18 > 0 && res.fuzzyPos) {
            // Fair hot/cold search nudge around a ±5m fuzzy zone (never wallhack!)
            ai.state = 'search';
            ai.sc = res.fuzzyPos.clone();
            ai.sr = Math.max(ai.sr || 0, 7.2);
            ai.searchT = Math.max(ai.searchT || 0, 7.8);
            if (!ai.checked) ai.checked = new Set();
            ai.candLeft = Math.max(ai.candLeft || 0, 3);
            ai.cand = null;
            ai.sprayT = 0;
            ai.goal = res.fuzzyPos.clone();
            if (typeof ai.setMark === 'function') ai.setMark(s, '?');
          } else if (res.count18 === 0) {
            // Area is cold — wrap up dead-end search & rotate to a fresh patrol zone!
            if (ai.state === 'search') {
              ai.searchT = Math.min(ai.searchT || 0, 0.25);
              ai.cand = null;
            } else if (ai.state === 'patrol' && ai.goal) {
              const dg = Math.hypot(ai.goal.x - s.position.x, ai.goal.z - s.position.z);
              if (dg < 11.0) ai.goal = null;
            }
          }
        }
        continue;
      }

      // B) Tactical Ballistic Splash Bomb when chasing or investigating (4.5m..14.5m or elevated perch!)
      if (
        THREE &&
        ai &&
        (aiState === 'chase' || aiState === 'investigate') &&
        now >= st.bombReadyAt &&
        now >= st.nextBotBombCheckAt
      ) {
        st.nextBotBombCheckAt = now + 450;

        let targetPt = null;
        if (aiState === 'chase' && ai.target && !ai.target.userData?.actor?.eliminated) {
          targetPt = getCharCenter(ai.target).clone();
          const tVel = ai.velMap && typeof ai.velMap.get === 'function' ? ai.velMap.get(ai.target) : null;
          if (tVel) {
            targetPt.x += clamp(tVel.x, -6, 6) * 0.36;
            targetPt.z += clamp(tVel.z, -6, 6) * 0.36;
          }
        } else if (aiState === 'investigate' && ai.goal) {
          const gy = getGroundY(ai.goal.x, ai.goal.z, s.userData?.groundY);
          targetPt = new THREE.Vector3(ai.goal.x, gy + 0.25, ai.goal.z);
        }

        if (targetPt) {
          const sFootY = (s.userData?.groundY ?? 0) + (s.userData?.jy || 0);
          const launchOrigin = new THREE.Vector3(s.position.x, sFootY + 1.22, s.position.z);
          const horizDist = Math.hypot(targetPt.x - launchOrigin.x, targetPt.z - launchOrigin.z);
          const elevDelta = targetPt.y - sFootY;
          const isElevatedPerch = elevDelta > 0.6 && horizDist >= 2.8 && horizDist <= 14.8;
          const inStandardWindow = horizDist >= 4.5 && horizDist <= 14.5;

          if (inStandardWindow || isElevatedPerch) {
            const lobDir = solveBallisticLob(THREE, launchOrigin, targetPt, BOMB_SPEED, BOMB_GRAVITY);
            lobDir.x += rand(-0.028, 0.028);
            lobDir.y += rand(-0.018, 0.022);
            lobDir.z += rand(-0.028, 0.028);
            lobDir.normalize();

            if (hasClearLobStart(launchOrigin, lobDir)) {
              if (ai) ai.lookAt = Math.atan2(lobDir.x, lobDir.z);
              useSplashBomb(s, lobDir);
            }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------------
  // Input, Lifecycle & Frame Step
  // ------------------------------------------------------------------------
  function handleKeyDown(e) {
    if (!e || e.repeat) return false;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return false;

    const G = env.G;
    if (!G || G.mode !== 'seek' || G.over) return false;

    if (e.code === 'KeyQ') {
      if (G.phase !== 'seek') {
        env.hint?.('🧭 Echo Pulse unlocks once the hunt begins!', 1100);
        return true;
      }
      const res = useEchoPulse(G.player);
      if (!res.ok) notifyLocalCooldown('pulse');
      return true;
    }

    if (e.code === 'KeyE') {
      if (G.phase !== 'seek') {
        env.hint?.('💣 Splash Bomb unlocks once the hunt begins!', 1100);
        return true;
      }
      const ok = useSplashBomb(G.player);
      if (!ok) notifyLocalCooldown('bomb');
      return true;
    }

    return false;
  }

  function clearTransient3D() {
    for (let i = activeWaves.length - 1; i >= 0; i--) {
      disposeWave(activeWaves[i]);
    }
    activeWaves.length = 0;

    for (let i = bombs.length - 1; i >= 0; i--) {
      disposeBomb(bombs[i]);
    }
    bombs.length = 0;

    for (let i = trailDrops.length - 1; i >= 0; i--) {
      const d = trailDrops[i];
      if (env.scene) env.scene.remove(d.mesh);
      d.mat?.dispose();
    }
    trailDrops.length = 0;

    for (let i = activeBursts.length - 1; i >= 0; i--) {
      disposeBurst(activeBursts[i]);
    }
    activeBursts.length = 0;
  }

  function resetRound() {
    clearTransient3D();
    seekerState.clear();
    prevPulseReady = true;
    prevBombReady = true;
    hideDowsingBannerImmediate();
    if (barEl) barEl.classList.add('hidden');
  }

  function clearAll() {
    resetRound();
    if (barEl) barEl.classList.add('hidden');
  }

  function resetCharCooldowns(seeker = env?.G?.player) {
    if (!seeker) return;
    const now = getNow();
    const st = getSeekerState(seeker, now);
    st.pulseReadyAt = 0;
    st.bombReadyAt = 0;
    prevPulseReady = true;
    prevBombReady = true;
    updateHUD(0.016, now);
  }

  function refundCooldownsFraction(seeker = env?.G?.player, fraction = 0.5) {
    if (!seeker) return;
    const now = getNow();
    const st = getSeekerState(seeker, now);
    if (st.pulseReadyAt > now) {
      st.pulseReadyAt = now + (st.pulseReadyAt - now) * (1 - clamp(fraction, 0, 1));
    }
    if (st.bombReadyAt > now) {
      st.bombReadyAt = now + (st.bombReadyAt - now) * (1 - clamp(fraction, 0, 1));
    }
    updateHUD(0.016, now);
  }

  function update(dt) {
    if (!(dt > 0)) dt = 0.016;
    const clampedDt = Math.min(dt, 0.1);
    const now = getNow();

    updateWaves(clampedDt);
    updateBombs(clampedDt);
    updateTrailDroplets(clampedDt);
    updateBursts(clampedDt);
    updateBotSeekers(now);
    updateHUD(clampedDt, now);
  }

  return {
    mountUI,
    resetRound,
    clearAll,
    resetCharCooldowns,
    refundCooldownsFraction,
    update,
    handleKeyDown,
    useEchoPulse,
    useSplashBomb,
    getActiveBombs: () => bombs,
    getActiveWaves: () => activeWaves,
    getActiveBursts: () => activeBursts,
  };
}
