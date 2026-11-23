/* ==========================================================================
 * Hue & Seek — Viral Highlights 2.0
 * • 24 Hz Full-Round 3D World-State Ring Buffer (3600 frames, ~150s)
 * • Crazy-Escape & High-Octane Drama Scorer (Matrix Dodge, Decoy Juke,
 *   Sakura Smoke, Phantom Mirage, Sky Takeoff, Low-HP Clutch, Turret Snipe)
 * • Honest Round Recap when nothing clip-worthy happened (real frames, nothing staged)
 * • True 3D In-Engine Action Replay (~12 s: real-time lead-in → 0.34× slow-mo beat on the
 *   peak → real-time aftermath) + replayFxGroup; only recorded frames, nothing staged
 * • Real 9:16 Vertical (720×1280) Social Video Recorder + #vhClipModal Preview
 * • Full-Bleed 9:16 (1080×1920) TikTok / Shorts / Reels Action Cover Builder
 * ========================================================================== */

// Length of the round highlight / shareable 9:16 clip in wall-clock seconds (?highlightSec= overrides).
// The clip is cut as: real-time lead-in -> slow-mo beat on the peak -> real-time aftermath, so at the
// default length it covers about [peak - 7 s, peak + 3.5 s] of the round. Rounds that recorded less
// than that simply get a shorter clip (never padded, never looped).
const DEFAULT_HIGHLIGHT_SEC = 12;
const MAX_HIGHLIGHT_SEC = 20;
const CLIP_LEAD_SHARE = 2 / 3; // share of the recorded window that comes before the peak
const RING_HZ = 24;
const RING_INTERVAL_SEC = 1 / RING_HZ;
const MAX_RING_FRAMES = 3600; // ~150s at 24 Hz
const MAX_SHOTS_PER_FRAME = 36;
const REPLAY_STREAK_POOL_SIZE = 44;
const REPLAY_RING_POOL_SIZE = 16;
const REPLAY_PUFF_POOL_SIZE = 18;

const SNAPSHOT_MAX_DIM = 1280;
const SOCIAL_W = 720;
const SOCIAL_H = 1280;
const POSTER_W = 1080;
const POSTER_H = 1920;

// Slow-mo beat: 0.85 recorded seconds around the peak played at 0.34x (= 2.5 s on screen).
// Everything else in the clip runs at 1x.
const TIMESCALE_SLOWMO = 0.34;
const SLOWMO_PRE_PEAK_SEC = 0.35;
const SLOWMO_POST_PEAK_SEC = 0.50;
const SLOWMO_MAX_CLIP_SHARE = 0.3; // short clips / short rounds: the beat never eats more than about this

// 720x1280 @ 30 fps. ~3.6 Mbit/s keeps a 12 s clip around 5 MB and a 20 s clip under 10 MB.
const CLIP_VIDEO_BITS_PER_SEC = 3_600_000;

const VIDEO_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm',
];

const ELEM_COLORS = {
  water: { hex: 0x4fc3ff, core: 0xdcf7ff, css: '#4fc3ff' },
  fire: { hex: 0xff6d2e, core: 0xffe484, css: '#ff6d2e' },
  ice: { hex: 0x9beeff, core: 0xffffff, css: '#9beeff' },
  lightning: { hex: 0xffe45e, core: 0xffffff, css: '#ffe45e' },
  wind: { hex: 0x98f5be, core: 0xeafff2, css: '#98f5be' },
  sakura: { hex: 0xff9ec7, core: 0xfff0f6, css: '#ff9ec7' },
};

const PROP_EMOJI_HINTS = [
  [/duck/i, '🦆'],
  [/chicken|hen|rooster/i, '🐔'],
  [/phoenix|stork/i, '🦚'],
  [/roc|eagle|hawk/i, '🦅'],
  [/heron|griffin|owl/i, '🦉'],
  [/pig|boar/i, '🐷'],
  [/sheep|lamb|fleece/i, '🐑'],
  [/cow|calf/i, '🐮'],
  [/fox|kitsune/i, '🦊'],
  [/cat|neko/i, '🐱'],
  [/frog|toad/i, '🐸'],
  [/pumpkin/i, '🎃'],
  [/mushroom/i, '🍄'],
  [/lantern|lamp/i, '🏮'],
  [/tea|samovar|kettle|cup/i, '🍵'],
  [/tub|bath|hinoki/i, '♨️'],
  [/flower|pot|fern|plant/i, '🪴'],
  [/barrel|cask|tun/i, '🛢️'],
  [/hay|wheat|straw/i, '🌾'],
  [/cart|wheelbarrow|minecart/i, '🛒'],
  [/clock/i, '🕰️'],
  [/bucket|watering/i, '🪣'],
  [/chair|stool|armchair/i, '🪑'],
  [/chest|crate|box|trunk/i, '🧰'],
  [/bread|flour|peel|cake/i, '🥐'],
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function escHtml(raw) {
  return String(raw ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function articleFor(noun) {
  const clean = String(noun || '').trim();
  if (!clean) return 'a';
  return /^[aeiou]/i.test(clean) ? 'an' : 'a';
}

function fmtDist(meters) {
  const d = clamp(Number(meters) || 1.4, 0.3, 99.9);
  return d.toFixed(1);
}

function inferPropEmoji(propId, label) {
  const hay = `${propId || ''} ${label || ''}`;
  for (const [rx, icon] of PROP_EMOJI_HINTS) {
    if (rx.test(hay)) return icon;
  }
  return '🎭';
}

/**
 * Clip timeline: maps replay progress u (0..1 of the clip's wall-clock length) to recorded round time.
 * wantSec = requested clip length, peakT = the moment (round seconds), [minT, maxT] = what the ring
 * buffer holds. With withSlowMo the window is ~[peak - 2/3, peak + 1/3] of the span and a short beat
 * around the peak plays at TIMESCALE_SLOWMO; without it (round recap) the clip is the last wantSec
 * seconds at 1x. A window that hits the start/end of the recording is shifted, not padded, so the
 * clip is as long as the data allows and never longer.
 */
function buildClipTimeline(wantSec, peakT, minT, maxT, withSlowMo) {
  const want = clamp(Number(wantSec) || DEFAULT_HIGHLIGHT_SEC, 0.25, MAX_HIGHLIGHT_SEC);
  const hi = Number.isFinite(maxT) ? maxT : 0;
  const lo = Math.min(Number.isFinite(minT) ? minT : hi, hi);
  const fullSlowSim = SLOWMO_PRE_PEAK_SEC + SLOWMO_POST_PEAK_SEC;
  const slowWall = withSlowMo
    ? Math.min(fullSlowSim / TIMESCALE_SLOWMO, Math.min(want, hi - lo) * SLOWMO_MAX_CLIP_SHARE)
    : 0;
  const slowSim = slowWall * TIMESCALE_SLOWMO;
  const span = want - slowWall + slowSim; // recorded seconds the clip covers
  const peak = clamp(Number.isFinite(peakT) ? peakT : hi, lo, hi);

  let t0 = peak - (withSlowMo ? span * CLIP_LEAD_SHARE : span);
  let t1 = t0 + span;
  if (t1 > hi) {
    t0 -= t1 - hi;
    t1 = hi;
  }
  if (t0 < lo) {
    t0 = lo;
    t1 = Math.min(hi, t0 + span);
  }

  let ts0 = t1;
  let ts1 = t1;
  if (withSlowMo) {
    ts0 = clamp(peak - slowSim * (SLOWMO_PRE_PEAK_SEC / fullSlowSim), t0, t1);
    ts1 = clamp(ts0 + slowSim, t0, t1);
  }
  const hasSlowMo = ts1 - ts0 > 0.02;
  if (!hasSlowMo) {
    ts0 = t1;
    ts1 = t1;
  }

  const wallSlow0 = ts0 - t0;
  const wallSlow1 = wallSlow0 + (ts1 - ts0) / TIMESCALE_SLOWMO;
  const durationSec = Math.max(0.25, wallSlow1 + (t1 - ts1));
  const peakWall = hasSlowMo
    ? wallSlow0 + (clamp(peak, ts0, ts1) - ts0) / TIMESCALE_SLOWMO
    : durationSec * 0.72; // recap: the close shot (also where the 9:16 cover frame is taken)
  return {
    t0,
    t1,
    ts0,
    ts1,
    peakT: peak,
    hasSlowMo,
    durationSec,
    wallSlow0,
    wallSlow1,
    slowU0: hasSlowMo ? wallSlow0 / durationSec : 2,
    slowU1: hasSlowMo ? wallSlow1 / durationSec : 2,
    peakU: clamp(peakWall / durationSec, 0, 1),
  };
}

function clipSimTimeAtU(tl, uNorm) {
  const wall = clamp(Number(uNorm) || 0, 0, 1) * tl.durationSec;
  if (wall <= tl.wallSlow0) return tl.t0 + wall;
  if (wall <= tl.wallSlow1) return tl.ts0 + (wall - tl.wallSlow0) * TIMESCALE_SLOWMO;
  return Math.min(tl.t1, tl.ts1 + (wall - tl.wallSlow1));
}

function clipInSlowMo(tl, uNorm) {
  return Boolean(tl && tl.hasSlowMo && uNorm >= tl.slowU0 && uNorm <= tl.slowU1);
}

export function resolveHighlightDurationSec() {
  try {
    if (typeof location !== 'undefined' && location.search) {
      const raw = new URLSearchParams(location.search).get('highlightSec');
      if (raw !== null && raw.trim() !== '') {
        const q = Number(raw);
        if (!Number.isNaN(q)) {
          if (q <= 0) return 0;
          return clamp(q, 0.1, MAX_HIGHLIGHT_SEC);
        }
      }
    }
  } catch (_) { /* ignore URL parse issues */ }
  return DEFAULT_HIGHLIGHT_SEC;
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rad);
  } else {
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}

function wrapCanvasText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines - 1) {
        for (let j = i + 1; j < words.length; j++) {
          const tailTry = `${current} ${words[j]}`;
          if (ctx.measureText(`${tailTry}…`).width <= maxWidth) {
            current = tailTry;
          } else {
            current = `${current}…`;
            return [...lines, current];
          }
        }
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createViralHighlightsManager(env = {}) {
  const hasDOM = typeof document !== 'undefined';
  const getNow = () => {
    if (typeof env.now === 'function') return env.now();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
  };
  const $ = (id) => (hasDOM ? document.getElementById(id) : null);

  // --------------------------------------------------------------------------
  // Procedural WebAudio Replay Stingers (Routed into audio.getSfxBus() so they
  // play aloud AND record directly into audio.getMediaStream()!)
  // --------------------------------------------------------------------------
  let fallbackAudioCtx = null;
  let noiseBufCache = null;
  let noiseBufCtxRef = null;

  function resolveReplayAudioTarget() {
    if (env.audio?.isMuted?.()) return null;
    try {
      const sharedCtx = env.audio?.getContext?.();
      const sharedBus = env.audio?.getSfxBus?.();
      if (sharedCtx && sharedBus) {
        if (sharedCtx.state === 'suspended') sharedCtx.resume?.().catch(() => {});
        return { ctx: sharedCtx, dest: sharedBus };
      }
      if (sharedCtx && sharedCtx.destination) {
        if (sharedCtx.state === 'suspended') sharedCtx.resume?.().catch(() => {});
        return { ctx: sharedCtx, dest: sharedCtx.destination };
      }
    } catch (_) { /* fall back to local AudioContext */ }

    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      if (!fallbackAudioCtx) fallbackAudioCtx = new AudioCtx();
      if (fallbackAudioCtx.state === 'suspended') fallbackAudioCtx.resume?.().catch(() => {});
      return { ctx: fallbackAudioCtx, dest: fallbackAudioCtx.destination };
    } catch (_) {
      return null;
    }
  }

  function ensureWhiteNoiseBuffer(ctx) {
    const existing = env.audio?.getBuffers?.()?.white;
    if (existing) return existing;
    if (noiseBufCache && noiseBufCtxRef === ctx) return noiseBufCache;
    try {
      const len = Math.max(2048, Math.floor(ctx.sampleRate * 0.9));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      noiseBufCache = buf;
      noiseBufCtxRef = ctx;
      return buf;
    } catch (_) {
      return null;
    }
  }

  function playReplaySfx(kind = 'start') {
    const target = resolveReplayAudioTarget();
    if (!target) return;
    const { ctx, dest } = target;
    try {
      const t0 = ctx.currentTime + 0.008;

      if (kind === 'slowmo_drop') {
        // 1. Sub-bass Bullet-Time Time-Warp Drop (155 Hz -> 34 Hz)
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(155, t0);
        sub.frequency.exponentialRampToValueAtTime(34, t0 + 0.68);
        subGain.gain.setValueAtTime(0.0001, t0);
        subGain.gain.linearRampToValueAtTime(0.36, t0 + 0.02);
        subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.78);
        sub.connect(subGain);
        subGain.connect(dest);
        sub.start(t0);
        sub.stop(t0 + 0.82);

        // 2. Gritty Mid-Punch Impact Harmonics
        const punch = ctx.createOscillator();
        const punchGain = ctx.createGain();
        punch.type = 'triangle';
        punch.frequency.setValueAtTime(240, t0);
        punch.frequency.exponentialRampToValueAtTime(52, t0 + 0.32);
        punchGain.gain.setValueAtTime(0.0001, t0);
        punchGain.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
        punchGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
        punch.connect(punchGain);
        punchGain.connect(dest);
        punch.start(t0);
        punch.stop(t0 + 0.39);

        // 3. Band-Passed Anime Air Whoosh + Splash Shimmer
        const nBuf = ensureWhiteNoiseBuffer(ctx);
        if (nBuf) {
          const src = ctx.createBufferSource();
          src.buffer = nBuf;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.Q.value = 1.6;
          bp.frequency.setValueAtTime(2400, t0);
          bp.frequency.exponentialRampToValueAtTime(360, t0 + 0.52);
          const wg = ctx.createGain();
          wg.gain.setValueAtTime(0.0001, t0);
          wg.gain.linearRampToValueAtTime(0.22, t0 + 0.035);
          wg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.56);
          src.connect(bp);
          bp.connect(wg);
          wg.connect(dest);
          src.start(t0);
          src.stop(t0 + 0.6);
        }

        // 4. Crystalline Slow-Mo Sparkle Bell
        [1046.5, 1318.5, 1567.98].forEach((freq, i) => {
          const bell = ctx.createOscillator();
          const bg = ctx.createGain();
          bell.type = 'sine';
          bell.frequency.setValueAtTime(freq, t0 + 0.05 + i * 0.045);
          bg.gain.setValueAtTime(0.0001, t0 + 0.05 + i * 0.045);
          bg.gain.linearRampToValueAtTime(0.065, t0 + 0.06 + i * 0.045);
          bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45 + i * 0.045);
          bell.connect(bg);
          bg.connect(dest);
          bell.start(t0 + 0.05 + i * 0.045);
          bell.stop(t0 + 0.48 + i * 0.045);
        });
        return;
      }

      if (kind === 'getaway') {
        // Triumphant Storybook Major-9th Getaway Fanfare
        const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx >= 3 ? 'sine' : 'triangle';
          const st = t0 + idx * 0.042;
          osc.frequency.setValueAtTime(freq, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.095, st + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.42);
          osc.connect(g);
          g.connect(dest);
          osc.start(st);
          osc.stop(st + 0.46);
        });
        return;
      }

      // 'start' or 'share'
      const notes = kind === 'share'
        ? [587.33, 880.0, 1174.66]
        : [392.0, 523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
        const st = t0 + idx * 0.038;
        osc.frequency.setValueAtTime(freq, st);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.linearRampToValueAtTime(0.085, st + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.3);
        osc.connect(g);
        g.connect(dest);
        osc.start(st);
        osc.stop(st + 0.34);
      });
    } catch (_) { /* ignore locked audio context */ }
  }

  // --------------------------------------------------------------------------
  // Round Highlight, 24 Hz Ring Buffer & Pursuit Drama State
  // --------------------------------------------------------------------------
  let roundMeta = {
    roundNumber: 1,
    mode: 'hide',
    mapId: 'meadow',
    mapTitle: 'Meadowbrook Village',
    startedAt: 0,
  };

  let roundElapsedSec = 0;
  let ringAccumSec = 0;
  let ringFrames = [];
  let pendingFxEvents = [];

  let candidates = [];
  let candidateSeq = 0;
  const stealthTrackByActor = new Map();
  const pursuitTrackByActor = new Map();

  let bestSnapshotCanvas = null;
  let climaxSnapshotCanvas = null;
  let climaxFrameCaptured = false;
  let lastSnapshotAtMs = -99999;
  let cachedHighlight = null;

  // --------------------------------------------------------------------------
  // 3D Action Replay, Camera & replayFxGroup State
  // --------------------------------------------------------------------------
  let playingHighlight = false;
  let replayHeldForModal = false; // 9:16 preview opened mid-replay: the results wait until it is closed
  let replaySilent = false; // replay renders behind the results screen (skipped / re-rendered) so the clip finishes
  let highlightElapsed = 0;
  let highlightDuration = DEFAULT_HIGHLIGHT_SEC;
  let currentReplayUNorm = 0;
  let highlightSubject = null;
  let highlightDoneCb = null;
  let highlightHeroCaptured = false;
  let highlightSlowMoFired = false;
  let highlightGetawayFired = false;
  let highlightLastExternalTickMs = 0;
  let highlightBackupInterval = null;

  let savedCameraState = null;
  let savedCharStates = [];
  let replaySession = null;
  let replayFxGroup = null;
  let replayFxPools = null;
  let currentHeroFocusWorld = { x: 0, y: 0.9, z: 0 };
  let smoothCropNdcX = 0;
  let compositedThisFrame = false;

  let cachedRaycaster = null;
  let cachedFocusVec = null;
  let cachedWantVec = null;
  let cachedDirVec = null;
  let cachedProjVec = null;
  let cachedUpVec = null;
  let cachedDirNorm = null;
  let cachedQuat = null;

  // --------------------------------------------------------------------------
  // 9:16 Social Video Recorder State (720×1280 Full-Bleed + Game Audio)
  // --------------------------------------------------------------------------
  let socialCanvas = null;
  let socialVideoTrack = null;
  let chosenVideoMime = '';
  let highlightRecorder = null;
  let highlightStreamTracks = [];
  let highlightChunks = [];
  let highlightRecMime = '';
  let highlightStopPromise = null;
  let latestVideoBlob = null;
  let latestVideoMime = '';
  let previewVideoObjectUrl = '';
  let clipComplete = false; // latestVideoBlob was recorded to the last frame of the replay (not a partial)
  let clipFinalizing = false; // recorder is flushing that last frame
  let replayRecFinalized = false;
  let recGeneration = 0; // bumped every round so a late recorder event cannot leak into the next one
  let clipWaiters = [];

  // --------------------------------------------------------------------------
  // Post-Elimination Active Spectator State
  // --------------------------------------------------------------------------
  let spectatingActive = false;
  let spectateTargets = [];
  let spectateTarget = null;

  let toastHideTimer = null;
  let keyListenerBound = false;

  // --------------------------------------------------------------------------
  // Helpers: Scene, Renderer, Kit, Gamertag, World Title, Room Code, Actors
  // --------------------------------------------------------------------------
  function getRenderer() {
    return env.getRenderer?.() || env.renderer || null;
  }

  function getScene() {
    return env.getScene?.() || env.scene || null;
  }

  function getCamera() {
    return env.getCamera?.() || env.camera || null;
  }

  function getSourceCanvas() {
    const r = getRenderer();
    if (r?.domElement) return r.domElement;
    if (hasDOM) return document.querySelector('#app canvas');
    return null;
  }

  function getWorldTitle() {
    return env.getWorldTitle?.() || roundMeta.mapTitle || 'Meadowbrook Village';
  }

  function getLocalPlayerName() {
    if (typeof env.getPlayerName === 'function') {
      const n = String(env.getPlayerName() || '').trim();
      if (n) return n;
    }
    if (hasDOM) {
      const inp = $('playerNameInput');
      if (inp && typeof inp.value === 'string' && inp.value.trim()) {
        return inp.value.trim();
      }
    }
    const gName = env.G?.player?.userData?.actor?.name;
    if (gName && String(gName).trim()) return String(gName).trim();
    return 'Spirit';
  }

  function resolveActiveRoomCode(explicitCode) {
    const raw = explicitCode
      || (typeof env.getRoomCode === 'function' ? env.getRoomCode() : '')
      || (typeof env.MP?.getRoomCode === 'function' ? env.MP.getRoomCode() : '')
      || (typeof env.MP?.getRoomId === 'function' ? env.MP.getRoomId() : '')
      || env.G?.roomCode
      || '';
    const str = String(raw || '').trim();
    if (!str) return '';
    const lower = str.toLowerCase();
    if (
      lower === 'local' ||
      lower === 'solo' ||
      lower === 'solo_room' ||
      lower === 'photon_room' ||
      lower === 'offline' ||
      lower === 'none'
    ) {
      return '';
    }
    const cleaned = str.replace(/^(hs_room_|hs_|room_|party_)/i, '').trim();
    if (!cleaned || cleaned.length > 14) return '';
    return cleaned.toUpperCase();
  }

  function findFallbackFunPropId(preferredId = '') {
    const kitProps = env.getKit?.()?.props || env.kit?.props || null;
    if (!kitProps) return preferredId || 'mb_duck';
    if (preferredId && kitProps[preferredId]) return preferredId;
    const keys = Object.keys(kitProps);
    if (!keys.length) return preferredId || 'mb_duck';
    const duckKey = keys.find((k) => /duck/i.test(k));
    if (duckKey) return duckKey;
    const animalKey = keys.find((k) => kitProps[k]?.isAnimal || /fox|cat|frog|chicken|stork|heron|roc|pig|sheep/i.test(k));
    if (animalKey) return animalKey;
    return keys[0];
  }

  function resolvePropInfo(propId, actorChar = null, fallbackLabel = 'Spirit') {
    const u = actorChar?.userData || {};
    const effPropId = propId || u.propId || actorChar?.propId || '';
    const kitProps = env.getKit?.()?.props || env.kit?.props || null;
    const def = (effPropId && kitProps && kitProps[effPropId]) ? kitProps[effPropId] : null;

    let label = '';
    if (def?.label) {
      label = String(def.label);
    } else if (u.specialLabel) {
      label = String(u.specialLabel);
    } else if (effPropId) {
      label = String(effPropId)
        .replace(/^(mb|bh|sr|sp|cw|bw)_/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
    } else {
      label = fallbackLabel;
    }

    const icon = def?.icon || def?.emoji || inferPropEmoji(effPropId, label);
    const canFly = Boolean(def?.canFly || u.disguise?.userData?.canFly || /roc|stork|heron|phoenix/i.test(`${effPropId} ${label}`));
    return {
      propId: effPropId || findFallbackFunPropId('mb_duck'),
      label,
      icon,
      canFly,
    };
  }

  function resolveActorIdentity(ch, defaultName = 'Spirit') {
    const G = env.G || {};
    if (!ch) {
      return {
        actorId: 'local',
        name: getLocalPlayerName() || defaultName,
        isLocal: true,
      };
    }
    const act = ch.userData?.actor || ch;
    const isLocal = Boolean(
      (G.player && ch === G.player) ||
      act?.isLocal ||
      act?.id === 'local'
    );
    const rawName = act?.name || (isLocal ? getLocalPlayerName() : defaultName);
    if (!ch.__vhFallbackId) {
      ch.__vhFallbackId = `actor_${++candidateSeq}`;
    }
    return {
      actorId: String(act?.id || act?.actorId || (isLocal ? 'local' : ch.__vhFallbackId)),
      name: String(rawName || defaultName),
      isLocal,
    };
  }

  function extractWorldPos(posOrChar, fallbackChar = null) {
    const src = posOrChar || fallbackChar?.position || null;
    const u = fallbackChar?.userData || posOrChar?.userData || {};
    if (src && typeof src.x === 'number' && typeof src.z === 'number') {
      const yVal = typeof src.y === 'number'
        ? src.y
        : ((u.groundY || 0) + (u.specialY || 0) + (u.jy || 0));
      return {
        x: Number.isFinite(src.x) ? src.x : 0,
        y: Number.isFinite(yVal) ? yVal : 0,
        z: Number.isFinite(src.z) ? src.z : 0,
      };
    }
    return { x: 0, y: 0.4, z: 0 };
  }

  function collectUniqueCharacters() {
    const G = env.G || {};
    const raw = [
      G.player,
      ...(Array.isArray(G.allHiders) ? G.allHiders : []),
      ...(Array.isArray(G.hiders) ? G.hiders : []),
      ...(Array.isArray(G.allSeekers) ? G.allSeekers : []),
      ...(Array.isArray(G.seekers) ? G.seekers : []),
    ];
    const seen = new Set();
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch && !seen.has(ch)) {
        seen.add(ch);
        out.push(ch);
      }
    }
    return out;
  }

  function getHidersList() {
    const G = env.G || {};
    if (Array.isArray(G.allHiders) && G.allHiders.length) return G.allHiders.filter(Boolean);
    return [G.mode === 'hide' ? G.player : null, ...(G.hiders || [])].filter(Boolean);
  }

  function getSeekersList() {
    const G = env.G || {};
    if (Array.isArray(G.allSeekers) && G.allSeekers.length) return G.allSeekers.filter(Boolean);
    return [G.mode === 'seek' ? G.player : null, ...(G.seekers || [])].filter(Boolean);
  }

  function resolveCharHp(ch, G) {
    if (!ch) return Number(G?.hp) || 100;
    if (ch === G?.player && typeof G?.hp === 'number') return Math.max(0, G.hp);
    const aiHp = ch.userData?.ai?.hp;
    if (typeof aiHp === 'number') return Math.max(0, aiHp);
    if (typeof ch.userData?.hp === 'number') return Math.max(0, ch.userData.hp);
    return 100;
  }

  function resolveCharMaxHp(ch, G) {
    if (!ch) return Number(G?.maxHp) || 100;
    if (ch === G?.player && typeof G?.maxHp === 'number') return Math.max(1, G.maxHp);
    const aiMax = ch.userData?.ai?.maxHp;
    if (typeof aiMax === 'number') return Math.max(1, aiMax);
    if (typeof ch.userData?.maxHp === 'number') return Math.max(1, ch.userData.maxHp);
    return 100;
  }

  function countSeekersNearPos(pos, radius = 16) {
    if (!pos) return 0;
    const seekers = getSeekersList();
    let count = 0;
    for (let i = 0; i < seekers.length; i++) {
      const s = seekers[i];
      if (!s || s.userData?.actor?.eliminated || !s.position) continue;
      const d = Math.hypot((pos.x || 0) - (s.position.x || 0), (pos.z || 0) - (s.position.z || 0));
      if (d <= radius) count += 1;
    }
    return count;
  }

  function formatSeekersCountPhrase(nSeekers, possessive = false) {
    const n = Math.max(1, Math.round(Number(nSeekers) || 1));
    if (n >= 2) {
      return possessive ? `${n} Seekers'` : `${n} Seekers`;
    }
    return possessive ? `Seekers'` : `hungry Seekers`;
  }

  function queueFxEvent(kind, pos, elem = 'water') {
    if (!pos || pendingFxEvents.length >= 24) return;
    pendingFxEvents.push({
      kind: String(kind || 'splash'),
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0.4,
      z: Number(pos.z) || 0,
      elem: String(elem || 'water'),
    });
  }

  // --------------------------------------------------------------------------
  // 24 Hz Full-Round 3D World-State Ring Buffer
  // --------------------------------------------------------------------------
  function recordWorldFrame() {
    const G = env.G || {};
    const allChars = collectUniqueCharacters();
    const seekerSet = new Set(getSeekersList());

    const charSnaps = new Array(allChars.length);
    for (let i = 0; i < allChars.length; i++) {
      const ch = allChars[i];
      const u = ch.userData || {};
      const ident = resolveActorIdentity(ch, seekerSet.has(ch) ? 'Seeker' : 'Spirit');
      const team = u.actor?.team || (seekerSet.has(ch) ? 'seekers' : 'hiders');
      charSnaps[i] = {
        ref: ch,
        id: ident.actorId,
        isPlayer: ch === G.player,
        team,
        name: ident.name,
        x: ch.position?.x || 0,
        y: ch.position?.y || 0,
        z: ch.position?.z || 0,
        groundY: u.groundY || 0,
        jy: u.jy || 0,
        vy: u.vy || 0,
        rotY: ch.rotation?.y || 0,
        spd: u.spd || 0,
        moving: ch === G.player ? Boolean(G.moving || (u.spd || 0) > 0.35) : (u.spd || 0) > 0.35,
        gliding: Boolean(u.gliding),
        birdClimbing: Boolean(u.birdClimbing),
        inTurret: Boolean(u.inTurret),
        swimming: Boolean(u.swimming),
        propId: u.propId || ch.propId || null,
        specialMode: u.specialMode || null,
        specialLabel: u.specialLabel || null,
        eliminated: Boolean(u.actor?.eliminated),
        hp: resolveCharHp(ch, G),
        maxHp: resolveCharMaxHp(ch, G),
        aim: Boolean(u.aim || (ch === G.player && G.firing)),
        elem: u.elemGun || env.elementalGuns?.getSeekerElement?.(ch) || 'water',
      };
    }

    const rawShots = Array.isArray(env.shots) ? env.shots : [];
    const shotSnaps = [];
    for (let i = 0; i < rawShots.length && shotSnaps.length < MAX_SHOTS_PER_FRAME; i++) {
      const d = rawShots[i];
      if (!d || !d.p || (typeof d.delay === 'number' && d.delay > 0)) continue;
      shotSnaps.push({
        x: Number(d.p.x) || 0,
        y: Number(d.p.y) || 0,
        z: Number(d.p.z) || 0,
        vx: Number(d.v?.x) || 0,
        vy: Number(d.v?.y) || 0,
        vz: Number(d.v?.z) || 0,
        elem: String(d.elem || 'water'),
        r: Number(d.r) || 0.09,
      });
    }

    const fxSnaps = pendingFxEvents.length ? pendingFxEvents.splice(0, pendingFxEvents.length) : [];
    ringFrames.push({
      t: roundElapsedSec,
      chars: charSnaps,
      shots: shotSnaps,
      fx: fxSnaps,
    });
    if (ringFrames.length > MAX_RING_FRAMES) {
      ringFrames.shift();
    }
  }

  // --------------------------------------------------------------------------
  // Crisp 2D Canvas Snapshot & Storybook Action Fallback Illustration
  // --------------------------------------------------------------------------
  function paintFallbackStorybookScene(ctx, w, h, hl = null) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#3a88d4');
    sky.addColorStop(0.46, '#9fdaf5');
    sky.addColorStop(0.52, '#6ebc5b');
    sky.addColorStop(1, '#366f2f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = ctx.createRadialGradient(w * 0.72, h * 0.24, 12, w * 0.72, h * 0.24, w * 0.42);
    sun.addColorStop(0, 'rgba(255, 248, 206, 0.95)');
    sun.addColorStop(0.45, 'rgba(255, 204, 102, 0.38)');
    sun.addColorStop(1, 'rgba(255, 204, 102, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#58a348';
    ctx.beginPath();
    ctx.ellipse(w * 0.28, h * 0.64, w * 0.58, h * 0.2, -0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#448637';
    ctx.beginPath();
    ctx.ellipse(w * 0.76, h * 0.70, w * 0.54, h * 0.22, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Dynamic blaster streaks in fallback illustration
    ctx.save();
    ctx.lineCap = 'round';
    const streaks = [
      [w * 0.12, h * 0.62, w * 0.44, h * 0.49, '#4fc3ff', 10],
      [w * 0.88, h * 0.64, w * 0.57, h * 0.50, '#ff6d2e', 9],
      [w * 0.18, h * 0.70, w * 0.47, h * 0.55, '#ffe45e', 7],
    ];
    for (const [x0, y0, x1, y1, col, lw] of streaks) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();

    const icon = hl?.propIcon || '✨';
    ctx.save();
    ctx.font = `${Math.round(Math.min(w, h) * 0.22)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, w * 0.5, h * 0.48);
    ctx.restore();
  }

  function triggerLiveSceneRender() {
    compositedThisFrame = false;
    try {
      if (typeof env.renderScene === 'function') {
        env.renderScene();
      } else if (env.composer && typeof env.composer.render === 'function') {
        env.composer.render();
      } else {
        const r = getRenderer();
        const sc = getScene();
        const cam = getCamera();
        if (r && sc && cam && typeof r.render === 'function') {
          r.render(sc, cam);
        }
      }
    } catch (_) { /* ignore render hook errors */ }
  }

  function computeFullBleedCropRect(srcW, srcH, dstW, dstH, ndcCenterX = 0) {
    const srcAspect = srcW / Math.max(1, srcH);
    const dstAspect = dstW / Math.max(1, dstH);
    if (srcAspect > dstAspect) {
      const sh = srcH;
      const sw = srcH * dstAspect;
      const heroPx = (0.5 + clamp(ndcCenterX, -0.85, 0.85) * 0.5) * srcW;
      const sx = clamp(heroPx - sw * 0.5, 0, Math.max(0, srcW - sw));
      return { sx, sy: 0, sw, sh };
    }
    const sw = srcW;
    const sh = srcW / dstAspect;
    const sy = Math.max(0, (srcH - sh) * 0.45);
    return { sx: 0, sy, sw, sh };
  }

  function projectWorldToNdcX(worldPt) {
    const cam = getCamera();
    const T = env.THREE;
    if (!cam || !worldPt || !T?.Vector3) return 0;
    try {
      if (!cachedProjVec) cachedProjVec = new T.Vector3();
      if (typeof cam.updateMatrixWorld === 'function') cam.updateMatrixWorld();
      cachedProjVec.set(worldPt.x || 0, worldPt.y || 0, worldPt.z || 0);
      if (typeof cachedProjVec.project === 'function') {
        cachedProjVec.project(cam);
        if (Number.isFinite(cachedProjVec.x)) {
          return clamp(cachedProjVec.x, -0.85, 0.85);
        }
      }
    } catch (_) { /* ignore mock camera projection */ }
    return 0;
  }

  function captureSnapshot(forceRender = false) {
    if (!hasDOM) return null;
    const srcCanvas = getSourceCanvas();

    if (forceRender) {
      triggerLiveSceneRender();
    }

    const rawW = srcCanvas ? (srcCanvas.width || srcCanvas.clientWidth || 960) : 960;
    const rawH = srcCanvas ? (srcCanvas.height || srcCanvas.clientHeight || 540) : 540;
    const scale = Math.min(1, SNAPSHOT_MAX_DIM / Math.max(1, rawW, rawH));
    const snapW = Math.max(320, Math.round(rawW * scale));
    const snapH = Math.max(320, Math.round(rawH * scale));

    const snap = bestSnapshotCanvas || document.createElement('canvas');
    snap.width = snapW;
    snap.height = snapH;
    const ctx = snap.getContext('2d');
    if (!ctx) return snap;

    const tryCopyWebglPixels = () => {
      if (!srcCanvas || !(srcCanvas.width > 0 || srcCanvas.height > 0)) return false;
      try {
        ctx.clearRect(0, 0, snapW, snapH);
        ctx.drawImage(srcCanvas, 0, 0, snapW, snapH);
        const mid = ctx.getImageData(snapW >> 1, snapH >> 1, 1, 1).data;
        const q1 = ctx.getImageData(snapW >> 2, snapH >> 2, 1, 1).data;
        const q2 = ctx.getImageData((snapW * 3) >> 2, (snapH * 3) >> 2, 1, 1).data;
        return Boolean(mid[3] > 0 || q1[3] > 0 || q2[3] > 0);
      } catch (_) {
        return false;
      }
    };

    let drewLivePixels = tryCopyWebglPixels();
    if (!drewLivePixels && !forceRender) {
      triggerLiveSceneRender();
      drewLivePixels = tryCopyWebglPixels();
    }

    if (!drewLivePixels) {
      paintFallbackStorybookScene(ctx, snapW, snapH, cachedHighlight);
    }

    bestSnapshotCanvas = snap;
    lastSnapshotAtMs = getNow();
    return snap;
  }

  function captureClimaxVerticalRawCanvas(ndcX = 0, allowForceRender = false) {
    if (!hasDOM) return null;
    const srcCanvas = getSourceCanvas();
    const cv = climaxSnapshotCanvas || document.createElement('canvas');
    cv.width = POSTER_W;
    cv.height = POSTER_H;
    const ctx = cv.getContext('2d');
    if (!ctx) return cv;

    const tryDrawWebgl = () => {
      if (!srcCanvas || !(srcCanvas.width > 0 || srcCanvas.height > 0)) return false;
      try {
        const sW = srcCanvas.width || srcCanvas.clientWidth || 1280;
        const sH = srcCanvas.height || srcCanvas.clientHeight || 720;
        const { sx, sy, sw, sh } = computeFullBleedCropRect(sW, sH, POSTER_W, POSTER_H, ndcX);
        ctx.clearRect(0, 0, POSTER_W, POSTER_H);
        ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, POSTER_W, POSTER_H);
        const mid = ctx.getImageData(POSTER_W >> 1, POSTER_H >> 1, 1, 1).data;
        const q1 = ctx.getImageData(POSTER_W >> 2, POSTER_H >> 2, 1, 1).data;
        return Boolean(mid[3] > 0 || q1[3] > 0);
      } catch (_) {
        return false;
      }
    };

    let drew = tryDrawWebgl();
    if (!drew && allowForceRender) {
      const prevPlaying = playingHighlight;
      playingHighlight = false; // avoid recursive composite inside renderScene
      triggerLiveSceneRender();
      playingHighlight = prevPlaying;
      drew = tryDrawWebgl();
    }
    if (!drew) {
      paintFallbackStorybookScene(ctx, POSTER_W, POSTER_H, highlightSubject || cachedHighlight);
    }
    climaxSnapshotCanvas = cv;
    climaxFrameCaptured = true;
    return cv;
  }

  // --------------------------------------------------------------------------
  // 9:16 Vertical Social Video Compositor (720×1280) & MediaRecorder
  // --------------------------------------------------------------------------
  function drawRadialSpeedLinesCanvas(ctx, w, h, alpha = 0.85, phase = 0) {
    if (alpha <= 0.01) return;
    ctx.save();
    const cx = w * 0.5;
    const cy = h * 0.47;
    const outerR = Math.hypot(w, h) * 0.66;
    const count = 38;
    for (let i = 0; i < count; i++) {
      const baseAng = (i / count) * Math.PI * 2 + phase * 0.35;
      const jitter = Math.sin(i * 12.7 + phase * 5.0) * 0.025;
      const ang = baseAng + jitter;
      const innerR = Math.min(w, h) * (0.34 + ((i * 7) % 5) * 0.032);
      const halfSpread = 0.012 + ((i % 3) * 0.005);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
      ctx.lineTo(cx + Math.cos(ang - halfSpread) * outerR, cy + Math.sin(ang - halfSpread) * outerR);
      ctx.lineTo(cx + Math.cos(ang + halfSpread) * outerR, cy + Math.sin(ang + halfSpread) * outerR);
      ctx.closePath();
      ctx.fillStyle = i % 3 === 0
        ? `rgba(255, 206, 92, ${(alpha * 0.42).toFixed(3)})`
        : `rgba(255, 250, 236, ${(alpha * 0.48).toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function paintVerticalSocialOverlays(ctx, w, h, hl, uNorm, { isStaticPoster = false, explicitRoomCode = '' } = {}) {
    const scale = w / 720;
    const tl = replaySession?.timeline || null;
    // A round recap has no peak and therefore no slow-mo beat (neither in the clip nor on its cover)
    const inSlowMo = isStaticPoster ? !hl?.isRecap : clipInSlowMo(tl, uNorm);
    const slowMoWindowT = isStaticPoster || !inSlowMo
      ? 0.5
      : clamp((uNorm - tl.slowU0) / Math.max(0.01, tl.slowU1 - tl.slowU0), 0, 1);
    const slowMoStrength = inSlowMo
      ? (isStaticPoster ? 0.72 : clamp(Math.sin(slowMoWindowT * Math.PI) * 1.35, 0.25, 1.0))
      : 0;

    // 1. Anime Speed-Lines during Slow-Mo Peak
    if (slowMoStrength > 0.02) {
      drawRadialSpeedLinesCanvas(ctx, w, h, slowMoStrength * (isStaticPoster ? 0.68 : 0.85), uNorm * 14);
    }

    // 2. Top & Bottom Cinematic Gradient Scrims (Keeps center 100% unobstructed!)
    const topScrimH = Math.round(330 * scale);
    const topGrad = ctx.createLinearGradient(0, 0, 0, topScrimH);
    topGrad.addColorStop(0, 'rgba(8, 14, 10, 0.84)');
    topGrad.addColorStop(0.58, 'rgba(10, 18, 13, 0.46)');
    topGrad.addColorStop(1, 'rgba(10, 18, 13, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, topScrimH);

    const botScrimY = Math.round(h - 330 * scale);
    const botGrad = ctx.createLinearGradient(0, botScrimY, 0, h);
    botGrad.addColorStop(0, 'rgba(8, 14, 10, 0)');
    botGrad.addColorStop(0.45, 'rgba(8, 14, 10, 0.52)');
    botGrad.addColorStop(1, 'rgba(8, 14, 10, 0.88)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, botScrimY, w, h - botScrimY);

    // 3. Top Viral Hook Badge Pill
    const badgeStr = String(hl?.badge || '🎬 ROUND RECAP').toUpperCase();
    ctx.save();
    const badgeFontPx = Math.round(21 * scale);
    ctx.font = `800 ${badgeFontPx}px "Fredoka", "Nunito", system-ui, sans-serif`;
    const pillPadX = Math.round(26 * scale);
    const pillW = Math.min(w - Math.round(48 * scale), Math.max(Math.round(250 * scale), ctx.measureText(badgeStr).width + pillPadX * 2));
    const pillH = Math.round(44 * scale);
    const pillX = (w - pillW) * 0.5;
    const pillY = Math.round(44 * scale);

    const pillGrad = ctx.createLinearGradient(0, pillY, 0, pillY + pillH);
    if (hl?.category === 'turret_snipe' || hl?.category === 'clutch_tag') {
      pillGrad.addColorStop(0, '#9bd6ff');
      pillGrad.addColorStop(1, '#2979c4');
    } else if (hl?.category === 'matrix_dodge' || hl?.category === 'sky_escape') {
      pillGrad.addColorStop(0, '#ffe985');
      pillGrad.addColorStop(1, '#f3901d');
    } else {
      pillGrad.addColorStop(0, '#ff9c73');
      pillGrad.addColorStop(1, '#e84838');
    }
    drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH * 0.5);
    ctx.fillStyle = pillGrad;
    ctx.fill();
    ctx.lineWidth = Math.max(2, Math.round(2.6 * scale));
    ctx.strokeStyle = '#fff8ea';
    ctx.stroke();

    ctx.fillStyle = (hl?.category === 'matrix_dodge' || hl?.category === 'sky_escape') ? '#381e02' : '#fffdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeStr, w * 0.5, pillY + pillH * 0.52);
    ctx.restore();

    // 4. Bold 2-3 Line Stroked TikTok / Shorts Hook Caption
    const headline = String(hl?.headline || 'Round recap');
    ctx.save();
    let capFontPx = Math.round((headline.length > 54 ? 34 : 38) * scale);
    ctx.font = `900 ${capFontPx}px "Fredoka", "Impact", "Nunito", system-ui, sans-serif`;
    const maxTextW = w - Math.round(64 * scale);
    let lines = wrapCanvasText(ctx, headline, maxTextW, 3);
    if (lines.length >= 3 && headline.length > 62) {
      capFontPx = Math.round(31 * scale);
      ctx.font = `900 ${capFontPx}px "Fredoka", "Impact", "Nunito", system-ui, sans-serif`;
      lines = wrapCanvasText(ctx, headline, maxTextW, 3);
    }

    const lineH = Math.round(capFontPx * 1.18);
    let textY = Math.round(126 * scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
      ctx.shadowBlur = Math.round(14 * scale);
      ctx.shadowOffsetY = Math.round(4 * scale);
      ctx.lineWidth = Math.round(8.5 * scale);
      ctx.strokeStyle = '#121b14';
      ctx.strokeText(ln, w * 0.5, textY);
      ctx.restore();

      ctx.fillStyle = i === 0 ? '#fffdf7' : '#ffe89e';
      ctx.fillText(ln, w * 0.5, textY);
      textY += lineH;
    }
    ctx.restore();

    // 5. Popped Slow-Mo Climax Sticker Pill (During Slow-Mo or on Static 9:16 Cover!)
    if (inSlowMo) {
      const climaxTxt = `⚡ 0.3× SLOW-MO · ${String(hl?.climaxTag || 'CLUTCH ESCAPE!').replace(/^⚡\s*/, '')}`;
      ctx.save();
      const stickerY = Math.round(h - 216 * scale);
      ctx.translate(w * 0.5, stickerY);
      ctx.rotate(-0.032);
      const stFontPx = Math.round(21 * scale);
      ctx.font = `800 ${stFontPx}px "Fredoka", "Nunito", system-ui, sans-serif`;
      const stW = Math.min(w - Math.round(52 * scale), Math.max(Math.round(310 * scale), ctx.measureText(climaxTxt).width + Math.round(46 * scale)));
      const stH = Math.round(46 * scale);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = Math.round(16 * scale);
      ctx.shadowOffsetY = Math.round(5 * scale);

      const stGrad = ctx.createLinearGradient(-stW * 0.5, -stH * 0.5, stW * 0.5, stH * 0.5);
      stGrad.addColorStop(0, '#ff5733');
      stGrad.addColorStop(0.52, '#ffae2b');
      stGrad.addColorStop(1, '#ffe77a');
      drawRoundedRectPath(ctx, -stW * 0.5, -stH * 0.5, stW, stH, stH * 0.5);
      ctx.fillStyle = stGrad;
      ctx.fill();
      ctx.lineWidth = Math.max(2, Math.round(2.8 * scale));
      ctx.strokeStyle = '#fffdf6';
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#2a1202';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(climaxTxt, 0, Math.round(1 * scale));
      ctx.restore();
    }

    // 6. Bottom Compact Watermark + Optional Active Party Room Code
    const gamertag = hl?.actorName || getLocalPlayerName();
    const activeRoom = resolveActiveRoomCode(explicitRoomCode || hl?.roomCode);
    const wmMain = activeRoom
      ? `🎭 Hue & Seek · @${gamertag} · 🔑 Join: ${activeRoom}`
      : `🎭 Hue & Seek · @${gamertag} · ${hl?.propIcon || '✨'} ${hl?.propLabel || 'Spirit'}`;
    const wmSub = `▶ Free · No Ads on Google Play · oxadow.com/hueseek`;

    ctx.save();
    const wmFontPx = Math.round(19 * scale);
    ctx.font = `800 ${wmFontPx}px "Nunito", system-ui, sans-serif`;
    const wmW = Math.min(w - Math.round(44 * scale), Math.max(Math.round(340 * scale), ctx.measureText(wmMain).width + Math.round(46 * scale)));
    const wmH = Math.round(46 * scale);
    const wmX = (w - wmW) * 0.5;
    const wmY = Math.round(h - 128 * scale);

    drawRoundedRectPath(ctx, wmX, wmY, wmW, wmH, wmH * 0.5);
    ctx.fillStyle = 'rgba(18, 28, 20, 0.86)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));
    ctx.strokeStyle = 'rgba(255, 194, 82, 0.78)';
    ctx.stroke();

    ctx.fillStyle = '#fff8ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wmMain, w * 0.5, wmY + wmH * 0.52);

    ctx.font = `800 ${Math.round(14.5 * scale)}px "Nunito", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 236, 184, 0.88)';
    ctx.fillText(wmSub, w * 0.5, wmY + wmH + Math.round(22 * scale));
    ctx.restore();
  }

  function ensureSocialCanvas() {
    if (!hasDOM) return null;
    if (!socialCanvas) {
      socialCanvas = document.createElement('canvas');
      socialCanvas.width = SOCIAL_W;
      socialCanvas.height = SOCIAL_H;
    }
    return socialCanvas;
  }

  function compositeSocialFrame(uNorm = currentReplayUNorm) {
    if (!hasDOM) return null;
    const cv = ensureSocialCanvas();
    if (!cv) return null;
    const ctx = cv.getContext('2d');
    if (!ctx) return cv;

    const hl = highlightSubject || cachedHighlight || computeBestHighlight();
    const targetNdcX = projectWorldToNdcX(currentHeroFocusWorld);
    smoothCropNdcX = lerp(smoothCropNdcX, targetNdcX, 0.24);

    const srcCanvas = getSourceCanvas();
    let drewWebgl = false;
    if (srcCanvas && (srcCanvas.width > 0 || srcCanvas.height > 0)) {
      try {
        const sW = srcCanvas.width || srcCanvas.clientWidth || 1280;
        const sH = srcCanvas.height || srcCanvas.clientHeight || 720;
        const { sx, sy, sw, sh } = computeFullBleedCropRect(sW, sH, SOCIAL_W, SOCIAL_H, smoothCropNdcX);
        ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, SOCIAL_W, SOCIAL_H);
        drewWebgl = true;
      } catch (_) {
        drewWebgl = false;
      }
    }
    if (!drewWebgl) {
      paintFallbackStorybookScene(ctx, SOCIAL_W, SOCIAL_H, hl);
    }

    // Capture raw 1080x1920 slow-mo peak frame for 9:16 Cover Poster BEFORE painting HUD text
    const coverU = replaySession?.timeline?.peakU;
    if (!climaxFrameCaptured && typeof coverU === 'number' && uNorm >= coverU && uNorm <= coverU + 0.08) {
      captureClimaxVerticalRawCanvas(smoothCropNdcX);
    }

    paintVerticalSocialOverlays(ctx, SOCIAL_W, SOCIAL_H, hl, uNorm);

    // No track.requestFrame() here: captureStream(30) already grabs every changed frame at <= 30 fps.
    // Forcing one per composite pushed 60+ fps into the encoder on fast displays, which blew the
    // bitrate up ~2.5x (a 12 s clip measured 13 MB instead of ~5.5 MB).
    compositedThisFrame = true;
    return cv;
  }

  function onAfterRenderFrame() {
    if (!playingHighlight) return;
    compositeSocialFrame(currentReplayUNorm);
  }

  function detectSupportedVideoMime() {
    if (chosenVideoMime) return chosenVideoMime;
    if (typeof MediaRecorder === 'undefined') return '';
    if (typeof MediaRecorder.isTypeSupported !== 'function') {
      chosenVideoMime = 'video/webm';
      return chosenVideoMime;
    }
    for (const mime of VIDEO_MIME_CANDIDATES) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) {
          chosenVideoMime = mime;
          return chosenVideoMime;
        }
      } catch (_) { /* continue probing */ }
    }
    return '';
  }

  function extForMime(mime) {
    return /mp4/i.test(String(mime || '')) ? 'mp4' : 'webm';
  }

  function startSocialHighlightRecorder() {
    stopRecording();
    if (!hasDOM || typeof MediaRecorder === 'undefined') return false;
    const cv = ensureSocialCanvas();
    const captureTarget = (cv && typeof cv.captureStream === 'function')
      ? cv
      : getSourceCanvas();
    if (!captureTarget || typeof captureTarget.captureStream !== 'function') return false;

    try {
      const vStream = captureTarget.captureStream(30);
      const vTracks = vStream?.getVideoTracks?.() || [];
      if (!vTracks.length) return false;
      socialVideoTrack = vTracks[0] || null;
      highlightStreamTracks = [...vTracks];

      let combinedStream = vStream;
      // A suspended AudioContext feeds the recorder no audio samples, and Chrome then truncates the
      // whole file (MP4: ~1 s kept of a 12 s take, WebM: empty) — record video-only in that case.
      const audioRunning = (env.audio?.getContext?.()?.state || 'running') === 'running';
      if (typeof MediaStream === 'function' && audioRunning && !env.audio?.isMuted?.()) {
        try {
          const aStream = env.audio?.getMediaStream?.();
          const aTracks = aStream?.getAudioTracks?.() || [];
          if (aTracks.length > 0) {
            combinedStream = new MediaStream([...vTracks, ...aTracks]);
          }
        } catch (_) {
          combinedStream = vStream;
        }
      }

      const preferredMime = detectSupportedVideoMime();
      const baseOpts = { videoBitsPerSecond: CLIP_VIDEO_BITS_PER_SEC };
      let rec = null;

      const tryCreate = (stream, withMime) => {
        try {
          const o = withMime && preferredMime ? { ...baseOpts, mimeType: preferredMime } : baseOpts;
          return new MediaRecorder(stream, o);
        } catch (_) {
          try {
            return new MediaRecorder(stream);
          } catch (_2) {
            return null;
          }
        }
      };

      rec = tryCreate(combinedStream, true) || tryCreate(combinedStream, false);
      if (!rec && combinedStream !== vStream) {
        rec = tryCreate(vStream, true) || tryCreate(vStream, false);
      }
      if (!rec) return false;

      const chunks = [];
      highlightChunks = chunks;
      highlightRecMime = rec.mimeType || preferredMime || 'video/webm';
      highlightRecorder = rec;
      highlightStopPromise = null;

      rec.ondataavailable = (ev) => {
        if (ev && ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
          if (highlightChunks !== chunks) return; // a newer recording / round owns the clip now
          const partial = new Blob(chunks, { type: highlightRecMime });
          if (partial.size > 0) {
            latestVideoBlob = partial;
            latestVideoMime = highlightRecMime;
          }
        }
      };
      rec.onerror = () => { /* swallow WebView MediaRecorder quirks */ };
      rec.start(120);
      return true;
    } catch (_) {
      highlightRecorder = null;
      return false;
    }
  }

  function flushActiveRecorderData() {
    try {
      if (highlightRecorder && highlightRecorder.state === 'recording') {
        highlightRecorder.requestData?.();
      }
    } catch (_) { /* ignore */ }
  }

  function stopRecording() {
    const rec = highlightRecorder;
    highlightRecorder = null;
    socialVideoTrack = null;

    if (rec) {
      try {
        if (rec.state && rec.state !== 'inactive') {
          const chunksRef = highlightChunks;
          const mimeRef = highlightRecMime || chosenVideoMime || 'video/webm';
          highlightStopPromise = new Promise((resolve) => {
            rec.onstop = () => {
              if (chunksRef === highlightChunks && chunksRef.length > 0) {
                const blob = new Blob(chunksRef, { type: mimeRef });
                if (blob.size > 0) {
                  latestVideoBlob = blob;
                  latestVideoMime = mimeRef;
                }
              }
              try {
                highlightStreamTracks.forEach((t) => t.stop?.());
              } catch (_) { /* ignore */ }
              highlightStreamTracks = [];
              resolve(latestVideoBlob);
            };
          });
          rec.stop();
          return highlightStopPromise;
        }
      } catch (_) { /* ignore stop errors */ }
    }

    if (highlightChunks.length > 0) {
      const mimeRef = highlightRecMime || chosenVideoMime || 'video/webm';
      const blob = new Blob(highlightChunks, { type: mimeRef });
      if (blob.size > 0) {
        latestVideoBlob = blob;
        latestVideoMime = mimeRef;
      }
    }
    try {
      highlightStreamTracks.forEach((t) => t.stop?.());
    } catch (_) { /* ignore */ }
    highlightStreamTracks = [];
    return Promise.resolve(latestVideoBlob);
  }

  function getLatestVideoInfo() {
    flushActiveRecorderData();
    if (highlightChunks.length > 0) {
      const mime = highlightRecMime || chosenVideoMime || 'video/webm';
      const liveBlob = new Blob(highlightChunks, { type: mime });
      if (liveBlob.size > (latestVideoBlob?.size || 0)) {
        latestVideoBlob = liveBlob;
        latestVideoMime = mime;
      }
    }
    if (latestVideoBlob && latestVideoBlob.size > 0) {
      const mime = latestVideoMime || chosenVideoMime || 'video/webm';
      return { blob: latestVideoBlob, mimeType: mime, ext: extForMime(mime) };
    }
    const fallbackMime = chosenVideoMime || 'video/webm';
    return { blob: null, mimeType: fallbackMime, ext: extForMime(fallbackMime) };
  }

  function getLatestVideoBlob() {
    return getLatestVideoInfo().blob;
  }

  // --------------------------------------------------------------------------
  // Candidate Scoring & High-Octane Drama Hooks
  // --------------------------------------------------------------------------
  function currentTopScore() {
    let best = -1;
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].score > best) best = candidates[i].score;
    }
    return best;
  }

  function applyLocalActionMultiplier(baseScore, isLocal) {
    if (baseScore >= 250 && isLocal) {
      return baseScore * 1.32;
    }
    return baseScore;
  }

  function upsertCandidate(entry, { immediateSnapshot = false } = {}) {
    cachedHighlight = null;
    const prevTop = currentTopScore();
    const enriched = {
      tPeak: roundElapsedSec,
      climaxTag: '⚡ BULLET-TIME ESCAPE!',
      ...entry,
    };

    const idx = enriched.dedupeKey
      ? candidates.findIndex((c) => c.dedupeKey === enriched.dedupeKey)
      : -1;

    if (idx >= 0) {
      if (enriched.score >= candidates[idx].score) {
        candidates[idx] = { ...candidates[idx], ...enriched };
      }
    } else {
      candidates.push(enriched);
    }

    const G = env.G;
    const isRoundEnded = !G || G.over || G.phase === 'menu' || G.phase === 'end';
    const nowMs = getNow();
    if (
      isRoundEnded &&
      enriched.score >= prevTop &&
      (immediateSnapshot || !bestSnapshotCanvas || (nowMs - lastSnapshotAtMs) >= 950)
    ) {
      captureSnapshot(false);
    }
  }

  function onRoundStart({ roundNumber = 1, mode, mapId, mapTitle } = {}) {
    mountUI();
    closeClipPreviewModal();
    stopHighlightCameraInternal(false);
    stopRecording();
    setSpectating(false, []);

    const G = env.G || {};
    roundMeta = {
      roundNumber: Number(roundNumber) || 1,
      mode: mode || G.mode || 'hide',
      mapId: mapId || 'meadow',
      mapTitle: mapTitle || env.getWorldTitle?.() || 'Meadowbrook Village',
      startedAt: getNow(),
    };

    roundElapsedSec = 0;
    ringAccumSec = 0;
    ringFrames = [];
    pendingFxEvents = [];

    candidates = [];
    stealthTrackByActor.clear();
    pursuitTrackByActor.clear();

    bestSnapshotCanvas = null;
    climaxSnapshotCanvas = null;
    climaxFrameCaptured = false;
    lastSnapshotAtMs = -99999;
    cachedHighlight = null;

    highlightChunks = [];
    latestVideoBlob = null;
    latestVideoMime = '';
    recGeneration += 1;
    clipComplete = false;
    clipFinalizing = false;
    resolveClipWaiters();
    smoothCropNdcX = 0;
  }

  function tick(dt) {
    const stepDt = clamp(Number(dt) || 0, 0, 10.0);
    if (stepDt <= 0) return;

    const G = env.G || {};
    if (G.phase === 'menu' || G.phase === 'vs' || G.phase === 'end') return;

    if (spectatingActive) {
      refreshSpectatorBarDOM();
    }

    const inRecordablePhase = !G.over && (G.phase === 'survive' || G.phase === 'seek' || G.phase === 'hide');
    if (inRecordablePhase) {
      roundElapsedSec += stepDt;
      ringAccumSec += stepDt;
      if (ringAccumSec >= RING_INTERVAL_SEC || ringFrames.length === 0) {
        ringAccumSec %= RING_INTERVAL_SEC;
        recordWorldFrame();
      }
    }

    if (G.over || G.phase === 'hide' || G.phase === 'ready') return;

    const rawHiders = getHidersList();
    const rawSeekers = getSeekersList();
    const livingHiders = rawHiders.filter((h) => h && !h.userData?.actor?.eliminated);
    const livingSeekers = rawSeekers.filter((s) => s && !s.userData?.actor?.eliminated);
    if (!livingHiders.length || !livingSeekers.length) return;

    const activeShots = Array.isArray(env.shots) ? env.shots : [];

    for (let i = 0; i < livingHiders.length; i++) {
      const h = livingHiders[i];
      const u = h.userData || {};
      const ident = resolveActorIdentity(h, 'Spirit');
      const propInfo = resolvePropInfo(u.propId || h.propId, h, 'Spirit');
      const hPos = extractWorldPos(h.position, h);

      let closestDist = Infinity;
      let pursuers12m = 0;
      let pursuers8m = 0;
      let pursuers6m = 0;

      for (let j = 0; j < livingSeekers.length; j++) {
        const s = livingSeekers[j];
        if (!s?.position) continue;
        const sPos = extractWorldPos(s.position, s);
        const d = Math.hypot(hPos.x - sPos.x, hPos.y - sPos.y, hPos.z - sPos.z);
        if (d < closestDist) closestDist = d;
        if (d <= 12.0) pursuers12m += 1;
        if (d <= 8.0) pursuers8m += 1;
        if (d <= 6.5) pursuers6m += 1;
      }

      // Live Pursuit, Projectile Near-Miss & Low-HP Miracle Escape Telemetry
      let pTrack = pursuitTrackByActor.get(ident.actorId);
      const curHp = resolveCharHp(h, G);
      const maxHp = resolveCharMaxHp(h, G);
      const hpRatio = clamp(curHp / Math.max(1, maxHp), 0.01, 1);

      if (!pTrack) {
        pTrack = {
          seenShots: typeof WeakSet === 'function' ? new WeakSet() : null,
          nearMissCount: 0,
          hitsTaken: 0,
          prevHp: curHp,
          minHpRatio: hpRatio,
          minHpVal: Math.max(1, Math.round(curHp)),
          maxPursuers12m: pursuers12m,
        };
        pursuitTrackByActor.set(ident.actorId, pTrack);
      }

      if (pursuers12m > pTrack.maxPursuers12m) {
        pTrack.maxPursuers12m = pursuers12m;
      }
      if (curHp < pTrack.prevHp - 0.5) {
        pTrack.hitsTaken += 1;
        pTrack.minHpRatio = Math.min(pTrack.minHpRatio, hpRatio);
        pTrack.minHpVal = Math.min(pTrack.minHpVal, Math.max(1, Math.round(curHp)));
        queueFxEvent('hit', { x: hPos.x, y: hPos.y + 0.55, z: hPos.z }, 'water');
      }
      pTrack.prevHp = curHp;
      if (pursuers12m >= 1 && hpRatio < pTrack.minHpRatio) {
        pTrack.minHpRatio = hpRatio;
        pTrack.minHpVal = Math.min(pTrack.minHpVal, Math.max(1, Math.round(curHp)));
      }

      // Projectile Near-Miss Counter (within 2.85m of Hider, counted once per projectile via WeakSet)
      if (activeShots.length > 0 && pTrack.seenShots) {
        const centerY = hPos.y + 0.5;
        for (let si = 0; si < activeShots.length; si++) {
          const shot = activeShots[si];
          if (!shot || typeof shot !== 'object' || !shot.p || (shot.delay && shot.delay > 0)) continue;
          if (pTrack.seenShots.has(shot)) continue;
          const sd = Math.hypot(shot.p.x - hPos.x, shot.p.y - centerY, shot.p.z - hPos.z);
          if (sd <= 2.85) {
            pTrack.seenShots.add(shot);
            pTrack.nearMissCount += 1;
            queueFxEvent('splash', { x: shot.p.x, y: shot.p.y, z: shot.p.z }, shot.elem || 'water');
          }
        }
      }

      const spd = Number(u.spd) || 0;
      const jy = Number(u.jy) || 0;

      // 1. Matrix Dodge Candidate (nearMissCount >= 3 while moving/jumping)
      const instantDrama = jy * 3.0 + spd * 0.35 + Math.min(activeShots.length, 10) * 0.25;
      if (instantDrama >= (pTrack.bestDodgeDrama || 0) && (pTrack.nearMissCount >= 1 || pursuers12m >= 1)) {
        pTrack.bestDodgeDrama = instantDrama;
        pTrack.bestDodgePeakT = roundElapsedSec;
        pTrack.bestDodgePos = { ...hPos };
      }
      if (pTrack.nearMissCount >= 3 && (spd > 1.8 || jy > 0.25)) {
        const effSeekers = Math.max(1, pursuers12m, pTrack.maxPursuers12m);
        const seekPhrase = formatSeekersCountPhrase(effSeekers, false);
        const baseScore = clamp(520 + Math.min(pTrack.nearMissCount, 10) * 19 + effSeekers * 26, 520, 785);
        const score = applyLocalActionMultiplier(baseScore, ident.isLocal);
        const bestPos = pTrack.bestDodgePos || hPos;
        upsertCandidate({
          id: `matrix_${ident.actorId}`,
          dedupeKey: `matrix_${ident.actorId}`,
          category: 'matrix_dodge',
          badge: '⚡ MATRIX DODGE',
          climaxTag: '⚡ MATRIX DODGE!',
          headline: `${propInfo.label} Matrix-dodged ${pTrack.nearMissCount} shots from ${seekPhrase}! ⚡${propInfo.icon}`,
          actorId: ident.actorId,
          actorName: ident.name,
          isLocal: ident.isLocal,
          propId: propInfo.propId,
          propLabel: propInfo.label,
          propIcon: propInfo.icon,
          pos: { ...bestPos },
          rot: h.rotation?.y || 0,
          charRef: h,
          score,
          tPeak: pTrack.bestDodgePeakT ?? roundElapsedSec,
        });
      }

      // 2. Miracle / Hot-Pursuit Escape Candidate
      if (
        pursuers12m >= 1 &&
        (hpRatio < 0.72 || pTrack.nearMissCount >= 2 || pTrack.hitsTaken >= 1) &&
        (spd > 3.5 || jy > 0.5)
      ) {
        const minR = clamp(Math.min(hpRatio, pTrack.minHpRatio), 0.01, 0.92);
        const hpDisp = Math.max(1, Math.min(pTrack.minHpVal, Math.round(curHp)));
        const effSeekers = Math.max(1, pursuers12m, pTrack.maxPursuers12m);
        const seekPoss = formatSeekersCountPhrase(effSeekers, true);
        const headline = (minR < 0.78 || pTrack.hitsTaken >= 1)
          ? `POV: ${hpDisp} HP ${propInfo.label} broke ${seekPoss} ankles & escaped! 💀🔥`
          : `POV: ${propInfo.label} juked ${formatSeekersCountPhrase(effSeekers, false)} at full sprint! 🔥💨`;
        const baseScore = 580 + (1 - minR) * 320 + effSeekers * 55;
        const score = applyLocalActionMultiplier(baseScore, ident.isLocal);
        upsertCandidate({
          id: `miracle_${ident.actorId}`,
          dedupeKey: `miracle_${ident.actorId}`,
          category: 'miracle_escape',
          badge: '🔥 MIRACLE ESCAPE',
          climaxTag: '🔥 LOW-HP CLUTCH!',
          headline,
          actorId: ident.actorId,
          actorName: ident.name,
          isLocal: ident.isLocal,
          propId: propInfo.propId,
          propLabel: propInfo.label,
          propIcon: propInfo.icon,
          pos: { ...hPos },
          rot: h.rotation?.y || 0,
          charRef: h,
          score,
          tPeak: roundElapsedSec,
        });
      }

      // 3. Passive Stealth Tracking (Strictly Capped at score <= 85 so it NEVER beats real action!)
      const isDisguised = Boolean(u.propId || u.specialMode || u.specialLabel || h.propId);
      if (!isDisguised || u.ai?.state === 'evade') continue;

      if (pursuers6m >= 1 && closestDist <= 6.5) {
        let rec = stealthTrackByActor.get(ident.actorId);
        if (!rec) {
          rec = {
            actorId: ident.actorId,
            actorName: ident.name,
            isLocal: ident.isLocal,
            minDist: closestDist,
            maxSeekersNear: Math.max(1, pursuers8m),
            stealthDuration: 0,
            propId: propInfo.propId,
            propLabel: propInfo.label,
            propIcon: propInfo.icon,
            pos: hPos,
            rot: h.rotation?.y || 0,
            charRef: h,
          };
          stealthTrackByActor.set(ident.actorId, rec);
        }

        rec.stealthDuration += stepDt;
        if (closestDist <= rec.minDist + 0.35) {
          rec.minDist = Math.min(rec.minDist, closestDist);
          rec.pos = hPos;
          rec.rot = h.rotation?.y || 0;
          rec.propId = propInfo.propId;
          rec.propLabel = propInfo.label;
          rec.propIcon = propInfo.icon;
        }
        if (pursuers8m > rec.maxSeekersNear) {
          rec.maxSeekersNear = pursuers8m;
          rec.pos = hPos;
          rec.rot = h.rotation?.y || 0;
        }
        rec.actorName = ident.name;
        rec.isLocal = ident.isLocal;
        rec.charRef = h;

        const closenessPts = (7.0 - clamp(rec.minDist, 0.35, 6.5)) * 7.5;
        const crowdPts = rec.maxSeekersNear * 9;
        const durationPts = Math.min(rec.stealthDuration, 20) * 1.4;
        const rawStealthScore = (closenessPts + crowdPts + durationPts) * (rec.isLocal ? 1.15 : 1.0);
        const cappedScore = Math.min(85, rawStealthScore);

        const dStr = fmtDist(rec.minDist);
        const art = articleFor(rec.propLabel);
        const seekCount = Math.max(2, rec.maxSeekersNear);
        const headline = `Hid ${dStr}m from ${seekCount} Seekers as ${art} ${rec.propLabel}!`;

        upsertCandidate({
          id: `stealth_${ident.actorId}`,
          dedupeKey: `stealth_${ident.actorId}`,
          category: 'best_hiding_spot',
          badge: '🎬 BEST HIDING SPOT',
          climaxTag: '⚡ CLOSE CALL!',
          headline,
          actorId: ident.actorId,
          actorName: ident.name,
          isLocal: ident.isLocal,
          propId: rec.propId,
          propLabel: rec.propLabel,
          propIcon: rec.propIcon,
          minDist: rec.minDist,
          seekersWithin8m: rec.maxSeekersNear,
          stealthDuration: rec.stealthDuration,
          pos: { ...rec.pos },
          rot: rec.rot,
          charRef: h,
          score: cappedScore,
          tPeak: roundElapsedSec,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Explicit High-Octane Drama Event Hooks for main.js
  // --------------------------------------------------------------------------
  function recordJuke({ actor, kind, propId, propLabel, nearSeekers, altitude, detail, pos } = {}) {
    const G = env.G || {};
    const subj = actor || G.player || null;
    const ident = resolveActorIdentity(subj, 'Spirit');
    const worldPos = extractWorldPos(pos, subj);
    const effPropId = propId || subj?.userData?.propId || '';
    const propInfo = resolvePropInfo(effPropId, subj, propLabel || 'Spirit');
    const finalLabel = String(propLabel || propInfo.label || 'Spirit');
    const art = articleFor(finalLabel);

    const nSeek = Math.max(1, Math.round(Number(nearSeekers) || countSeekersNearPos(worldPos, 18) || 1));
    const seekPhrase = formatSeekersCountPhrase(nSeek, false);
    const seekPoss = formatSeekersCountPhrase(nSeek, true);

    let category = 'ankle_breaker';
    let badge = '💨 ANKLE-BREAKER JUKE';
    let climaxTag = '💨 ANKLES BROKEN!';
    let baseScore = 700 + nSeek * 50;
    let headline = '';
    let fxKind = 'poof';
    let fxElem = 'wind';

    switch (String(kind || '').toLowerCase()) {
      case 'decoy_pop':
        category = 'ankle_breaker';
        badge = '🤯 1000 IQ DECOY JUKE';
        climaxTag = '💥 CLONE POPPED!';
        baseScore = clamp(830 + nSeek * 45, 830, 975);
        headline = `1000 IQ ${finalLabel} decoy-tricked ${seekPhrase} & vanished! 🤯💨`;
        fxKind = 'decoy_pop';
        fxElem = 'fire';
        break;

      case 'smoke_dash':
        category = 'ankle_breaker';
        badge = '💨 SAKURA SMOKE ESCAPE';
        climaxTag = '💨 ANKLES BROKEN!';
        baseScore = clamp(795 + nSeek * 42, 795, 945);
        headline = `Sakura Smoke! ${finalLabel} broke ${seekPoss} ankles & vanished! 💨🌸`;
        fxKind = 'poof';
        fxElem = 'sakura';
        break;

      case 'mirage':
        category = 'miracle_escape';
        badge = '🪞 PHANTOM MIRAGE CLUTCH';
        climaxTag = '🪞 MIRAGE ESCAPE!';
        baseScore = clamp(845 + nSeek * 45, 845, 985);
        headline = `Phantom Mirage! Critical-HP ${finalLabel} baited ${seekPhrase} & escaped! 🪞🔥`;
        fxKind = 'decoy_pop';
        fxElem = 'ice';
        break;

      case 'contraption_launch':
        category = 'sky_escape';
        badge = '🚀 VILLAGE LAUNCH ESCAPE';
        climaxTag = '🚀 LAUNCHED!';
        baseScore = clamp(790 + nSeek * 45, 790, 950);
        headline = `Launched off ${detail || 'a geyser'} as ${art} ${finalLabel} past ${seekPhrase}! 🚀💦`;
        fxKind = 'launch';
        fxElem = 'water';
        break;

      case 'sky_takeoff':
        category = 'sky_escape';
        badge = '🦅 LEGENDARY SKY ESCAPE';
        climaxTag = '🦅 AIRBORNE ESCAPE!';
        baseScore = clamp(805 + nSeek * 45 + Math.min(45, Math.max(0, Number(altitude) || 0) * 3), 805, 965);
        headline = `Soared into the clouds as ${art} ${finalLabel} over ${seekPhrase}! 🦅✨`;
        fxKind = 'launch';
        fxElem = 'wind';
        break;

      case 'daredevil_taunt':
      default:
        category = 'ankle_breaker';
        badge = '😈 DAREDEVIL TAUNT JUKE';
        climaxTag = '😈 TAUNTED & GONE!';
        baseScore = clamp(720 + nSeek * 40, 720, 890);
        headline = `Taunted right past ${seekPhrase} as ${art} ${finalLabel} & escaped! 😈💨`;
        fxKind = 'poof';
        fxElem = 'lightning';
        break;
    }

    queueFxEvent(fxKind, { x: worldPos.x, y: worldPos.y + 0.5, z: worldPos.z }, fxElem);
    const score = applyLocalActionMultiplier(baseScore, ident.isLocal);

    upsertCandidate({
      id: `juke_${++candidateSeq}`,
      dedupeKey: null,
      category,
      badge,
      climaxTag,
      headline,
      actorId: ident.actorId,
      actorName: ident.name,
      isLocal: ident.isLocal,
      propId: propInfo.propId,
      propLabel: finalLabel,
      propIcon: propInfo.icon,
      pos: worldPos,
      rot: subj?.rotation?.y || 0,
      charRef: subj,
      score,
      tPeak: roundElapsedSec,
    }, { immediateSnapshot: true });
  }

  function recordEscape({ actor, hpLeft, maxHp, methodLabel, propId, pos } = {}) {
    const G = env.G || {};
    const subj = actor || G.player || null;
    const ident = resolveActorIdentity(subj, 'Spirit');
    const effPropId = propId || subj?.userData?.propId || '';
    const propInfo = resolvePropInfo(effPropId, subj, 'Spirit');
    const hp = Math.max(1, Math.round(Number(hpLeft) || G.hp || 11));
    const mHp = Math.max(hp, Math.round(Number(maxHp) || G.maxHp || 100));
    const worldPos = extractWorldPos(pos, subj);
    const cleanMethod = String(methodLabel || '').trim();
    // Real head-count of seekers around the escape — never padded.
    const nSeekReal = Math.max(1, countSeekersNearPos(worldPos, 20) || 1);
    const nSeek = `${nSeekReal} Seeker${nSeekReal === 1 ? '' : 's'}`;
    const nSeekPoss = nSeekReal === 1 ? "1 Seeker's" : `${nSeekReal} Seekers'`;

    let headline = '';
    if (/soar|cloud|fly/i.test(cleanMethod) || (!cleanMethod && propInfo.canFly)) {
      headline = `POV: ${hp} HP ${propInfo.label} soared over ${nSeek} & escaped! 🦅🔥`;
    } else if (cleanMethod && !/slipping out/i.test(cleanMethod)) {
      headline = `POV: ${hp} HP ${propInfo.label} escaped ${nSeek} (${cleanMethod})! 💀🔥`;
    } else {
      headline = `POV: ${hp} HP ${propInfo.label} broke ${nSeekPoss} ankles & escaped! 💀🔥`;
    }

    const lowHpFrac = clamp(1 - hp / mHp, 0.05, 0.99);
    const baseScore = clamp(
      760 + lowHpFrac * 210 + (cleanMethod ? 35 : 0) + (propInfo.canFly ? 25 : 0),
      760,
      990
    );
    const score = applyLocalActionMultiplier(baseScore, ident.isLocal);
    queueFxEvent('poof', { x: worldPos.x, y: worldPos.y + 0.5, z: worldPos.z }, 'sakura');

    upsertCandidate({
      id: `escape_${++candidateSeq}`,
      dedupeKey: null,
      category: 'clutch_escape',
      badge: '🔥 CLUTCH ESCAPE',
      climaxTag: '🔥 LOW-HP CLUTCH!',
      headline,
      actorId: ident.actorId,
      actorName: ident.name,
      isLocal: ident.isLocal,
      propId: propInfo.propId,
      propLabel: propInfo.label,
      propIcon: propInfo.icon,
      pos: worldPos,
      rot: subj?.rotation?.y || 0,
      charRef: subj,
      score,
      tPeak: roundElapsedSec,
    }, { immediateSnapshot: true });
  }

  function recordTurretSnipe({ seeker, target, propLabel, altitude, pos } = {}) {
    const G = env.G || {};
    const shooter = seeker || (G.mode === 'seek' ? G.player : null);
    const shooterIdent = resolveActorIdentity(shooter, 'Seeker');
    const propInfo = resolvePropInfo(target?.userData?.propId, target, propLabel || 'Thunder Roc');
    const finalLabel = String(propLabel || propInfo.label || 'Thunder Roc');
    const worldPos = extractWorldPos(pos || target?.position, target || shooter);
    const alt = Math.max(2, Math.round(Number(altitude) || worldPos.y || 11));

    const headline = `SNIPED a soaring ${finalLabel} at ${alt}m from the Sky-Turret! 🎯💥`;
    const baseScore = clamp(660 + Math.min(alt * 14, 270), 660, 930);
    const score = applyLocalActionMultiplier(baseScore, shooterIdent.isLocal);
    queueFxEvent('hit', { x: worldPos.x, y: worldPos.y, z: worldPos.z }, 'lightning');

    upsertCandidate({
      id: `snipe_${++candidateSeq}`,
      dedupeKey: null,
      category: 'turret_snipe',
      badge: '🎯 SKY-TURRET SNIPE',
      climaxTag: '🎯 AIRBORNE SNIPE!',
      headline,
      actorId: shooterIdent.actorId,
      actorName: shooterIdent.name,
      isLocal: shooterIdent.isLocal,
      propId: propInfo.propId,
      propLabel: finalLabel,
      propIcon: '🎯',
      pos: worldPos,
      rot: (target?.rotation?.y ?? shooter?.rotation?.y) || 0,
      charRef: target || shooter,
      score,
      tPeak: roundElapsedSec,
    }, { immediateSnapshot: true });
  }

  function recordClutchTag({ seeker, target, propLabel, timeLeft, pos } = {}) {
    const G = env.G || {};
    const shooter = seeker || (G.mode === 'seek' ? G.player : null);
    const shooterIdent = resolveActorIdentity(shooter, 'Seeker');
    const propInfo = resolvePropInfo(target?.userData?.propId, target, propLabel || 'Spirit');
    const finalLabel = String(propLabel || propInfo.label || 'Spirit');
    const tLeft = Math.max(1, Math.round(Number(timeLeft ?? G.t ?? 6)));
    const worldPos = extractWorldPos(pos || target?.position, target || shooter);

    const isFinalClutch = tLeft <= 25;
    const headline = isFinalClutch
      ? `BUZZER BEATER! Seekers soaked the final ${finalLabel} with ${tLeft}s left! ⚡💦`
      : `GOTCHA! Seekers blasted a fleeing ${finalLabel} mid-sprint! 💦🔥`;

    const urgencyBonus = tLeft <= 25 ? (26 - Math.min(25, tLeft)) * 7.2 : 0;
    const baseScore = clamp((isFinalClutch ? 680 : 560) + urgencyBonus, 560, 860);
    const score = applyLocalActionMultiplier(baseScore, shooterIdent.isLocal);
    queueFxEvent('splash', { x: worldPos.x, y: worldPos.y + 0.45, z: worldPos.z }, 'water');

    upsertCandidate({
      id: `tag_${++candidateSeq}`,
      dedupeKey: null,
      category: 'clutch_tag',
      badge: isFinalClutch ? '⚡ BUZZER-BEATER TAG' : '💦 MASTER SPLASH',
      climaxTag: isFinalClutch ? '⚡ FINAL-SECOND TAG!' : '💦 DIRECT HIT!',
      headline,
      actorId: shooterIdent.actorId,
      actorName: shooterIdent.name,
      isLocal: shooterIdent.isLocal,
      propId: propInfo.propId,
      propLabel: finalLabel,
      propIcon: propInfo.icon || '💦',
      pos: worldPos,
      rot: (target?.rotation?.y ?? shooter?.rotation?.y) || 0,
      charRef: target || shooter,
      score,
      tPeak: roundElapsedSec,
    }, { immediateSnapshot: true });
  }

  // --------------------------------------------------------------------------
  // Honest round recap: when nothing clip-worthy happened we say what DID happen
  // (and replay the real last seconds) instead of inventing an escape.
  // --------------------------------------------------------------------------
  function buildRoundRecapHighlight(lowCandidate = null) {
    const G = env.G || {};
    const rawHiders = getHidersList();
    const livingHiders = rawHiders.filter((h) => h && !h.userData?.actor?.eliminated);
    const localChar = G.player || null;
    const localIsHider = G.mode === 'hide';
    const localEliminated = Boolean(localChar?.userData?.actor?.eliminated);

    // Star the local player when they are on screen; otherwise the spirit that lasted longest.
    const heroChar = lowCandidate?.charRef
      || (localIsHider && localChar ? localChar : null)
      || livingHiders[0]
      || rawHiders[0]
      || localChar
      || null;

    const ident = heroChar
      ? resolveActorIdentity(heroChar, getLocalPlayerName())
      : { actorId: 'local', name: getLocalPlayerName(), isLocal: true };

    const rawPropId = lowCandidate?.propId || heroChar?.userData?.propId || heroChar?.propId || null;
    const propInfo = resolvePropInfo(rawPropId || findFallbackFunPropId('mb_duck'), heroChar, lowCandidate?.propLabel || 'Spirit');
    const hasProp = Boolean(rawPropId);
    const basePos = lowCandidate?.pos ? { ...lowCandidate.pos } : extractWorldPos(heroChar?.position, heroChar);

    const aliveCount = livingHiders.length;
    const soakedCount = Math.max(0, rawHiders.length - aliveCount);
    const myKills = Number(localChar?.userData?.actor?.eliminations) || 0;
    const heroAlive = Boolean(heroChar && !heroChar.userData?.actor?.eliminated);

    let headline;
    if (localIsHider && ident.isLocal) {
      if (!localEliminated) headline = hasProp ? `Unseen all round as a ${propInfo.label} 🤫` : 'Unseen all round 🤫';
      else headline = `Soaked this round — ${aliveCount} of ${rawHiders.length || 5} spirits made it`;
    } else if (!localIsHider) {
      headline = myKills > 0
        ? `${myKills} spirit${myKills === 1 ? '' : 's'} soaked by ${getLocalPlayerName()} — squad total ${soakedCount} 💦`
        : `Squad soaked ${soakedCount} of ${rawHiders.length || 5} spirits 💦`;
    } else {
      headline = heroAlive
        ? (hasProp ? `${ident.name} stayed unseen as a ${propInfo.label}` : `${ident.name} stayed unseen`)
        : `${aliveCount} of ${rawHiders.length || 5} spirits made it`;
    }

    return {
      id: 'round_recap',
      category: 'recap',
      badge: '🎬 ROUND RECAP',
      climaxTag: 'ROUND RECAP',
      headline,
      actorId: ident.actorId,
      actorName: ident.name,
      isLocal: ident.isLocal,
      propId: propInfo.propId,
      propLabel: hasProp ? propInfo.label : 'Spirit',
      propIcon: propInfo.icon,
      pos: basePos,
      rot: heroChar?.rotation?.y || 0,
      charRef: heroChar,
      score: 0,
      tPeak: roundElapsedSec,
      isRecap: true,
      isStuntReplay: false,
    };
  }

  function computeBestHighlight() {
    const G = env.G || {};
    const sorted = candidates.length > 0 ? [...candidates].sort((a, b) => b.score - a.score) : [];
    const topLocalAction = sorted.find((c) => c.isLocal && (c.score || 0) >= 220) || null;
    const topLocalAny = sorted.find((c) => c.isLocal) || null;
    const localEliminated = Boolean(G.player?.userData?.actor?.eliminated);

    // Only things that really happened, in this order:
    // 1. the local player's own big moment (score >= 220);
    // 2. the best big moment by anyone else — credited to that player, never to "You";
    // 3. a smaller real moment of the local player's;
    // 4. otherwise an honest recap of the round.
    const topAny = sorted[0] || null;
    const pick = topLocalAction
      || (topAny && (topAny.score || 0) >= 220 ? topAny : null)
      || topLocalAny
      || buildRoundRecapHighlight(null);
    void localEliminated;

    const pos = {
      x: Number.isFinite(pick.pos?.x) ? pick.pos.x : 0,
      y: Number.isFinite(pick.pos?.y) ? pick.pos.y : 0,
      z: Number.isFinite(pick.pos?.z) ? pick.pos.z : 0,
    };

    if (!bestSnapshotCanvas && hasDOM) {
      captureSnapshot(true);
    }

    const worldTitle = getWorldTitle();
    const roomCode = resolveActiveRoomCode();
    const actorDisplay = pick.isLocal
      ? `${pick.actorName || getLocalPlayerName()} (You)`
      : (pick.actorName || 'Spirit');

    cachedHighlight = {
      ...pick,
      pos,
      quote: pick.headline,
      subline: `${actorDisplay} · ${worldTitle}`,
      worldTitle,
      roomCode,
      roundNumber: roundMeta.roundNumber || 1,
      snapshotCanvas: bestSnapshotCanvas,
    };
    return cachedHighlight;
  }

  function getBestHighlightSummary() {
    const hl = computeBestHighlight();
    return {
      id: hl.id,
      category: hl.category,
      badge: hl.badge,
      climaxTag: hl.climaxTag,
      headline: hl.headline,
      quote: hl.headline,
      subline: hl.subline,
      actorName: hl.actorName,
      isLocal: hl.isLocal,
      propId: hl.propId,
      propLabel: hl.propLabel,
      propIcon: hl.propIcon,
      roundNumber: hl.roundNumber,
      worldTitle: hl.worldTitle,
      roomCode: hl.roomCode,
      isStuntReplay: Boolean(hl.isStuntReplay),
      pos: { ...hl.pos },
    };
  }

  // --------------------------------------------------------------------------
  // Scene Character Snapshot / Restore & replayFxGroup Pool
  // --------------------------------------------------------------------------
  function snapshotCameraState(cam) {
    if (!cam) return null;
    const childVis = Array.isArray(cam.children)
      ? cam.children.map((child) => ({ child, visible: child.visible }))
      : [];
    return {
      camRef: cam,
      px: cam.position?.x ?? 0,
      py: cam.position?.y ?? 2,
      pz: cam.position?.z ?? 5,
      fov: typeof cam.fov === 'number' ? cam.fov : 60,
      hasQuat: Boolean(cam.quaternion && typeof cam.quaternion.set === 'function'),
      qx: cam.quaternion?.x ?? 0,
      qy: cam.quaternion?.y ?? 0,
      qz: cam.quaternion?.z ?? 0,
      qw: cam.quaternion?.w ?? 1,
      hasRot: Boolean(cam.rotation && typeof cam.rotation.set === 'function'),
      rx: cam.rotation?.x ?? 0,
      ry: cam.rotation?.y ?? 0,
      rz: cam.rotation?.z ?? 0,
      rOrder: cam.rotation?.order || 'YXZ',
      childVis,
    };
  }

  function hideFirstPersonCamChildren(cam) {
    if (!cam || !Array.isArray(cam.children)) return;
    for (let i = 0; i < cam.children.length; i++) {
      if (cam.children[i]) cam.children[i].visible = false;
    }
  }

  function restoreCameraState(state) {
    if (!state || !state.camRef) return;
    const cam = state.camRef;
    try {
      if (cam.position && typeof cam.position.set === 'function') {
        cam.position.set(state.px, state.py, state.pz);
      }
      if (state.hasQuat && cam.quaternion && typeof cam.quaternion.set === 'function') {
        cam.quaternion.set(state.qx, state.qy, state.qz, state.qw);
      } else if (state.hasRot && cam.rotation && typeof cam.rotation.set === 'function') {
        cam.rotation.set(state.rx, state.ry, state.rz, state.rOrder);
      }
      if (typeof cam.fov === 'number' && typeof state.fov === 'number' && cam.fov !== state.fov) {
        cam.fov = state.fov;
        cam.updateProjectionMatrix?.();
      }
      if (Array.isArray(state.childVis)) {
        for (let i = 0; i < state.childVis.length; i++) {
          const entry = state.childVis[i];
          if (entry.child) entry.child.visible = entry.visible;
        }
      }
    } catch (_) { /* ignore mock camera restore issues */ }
  }

  function snapshotAllCharacters(extraHero = null) {
    const chars = collectUniqueCharacters();
    if (extraHero && !chars.includes(extraHero)) chars.push(extraHero);
    const list = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      const u = ch.userData || {};
      list.push({
        ch,
        px: ch.position?.x ?? 0,
        py: ch.position?.y ?? 0,
        pz: ch.position?.z ?? 0,
        rx: ch.rotation?.x ?? 0,
        ry: ch.rotation?.y ?? 0,
        rz: ch.rotation?.z ?? 0,
        sx: ch.scale?.x ?? 1,
        sy: ch.scale?.y ?? 1,
        sz: ch.scale?.z ?? 1,
        visible: ch.visible !== false,
        groundY: u.groundY,
        jy: u.jy,
        vy: u.vy,
        spd: u.spd,
        gliding: u.gliding,
        birdClimbing: u.birdClimbing,
        origPropId: u.propId,
        specialMode: u.specialMode,
        specialLabel: u.specialLabel,
        eliminated: u.actor ? u.actor.eliminated : undefined,
        disguiseRef: u.disguise || null,
        disguiseVisible: u.disguise ? u.disguise.visible : false,
        partsVisible: Array.isArray(u.parts) ? u.parts.map((m) => m.visible) : null,
        nameplateVisible: u.nameplate ? u.nameplate.visible : undefined,
        tempPropId: null,
        tempPropMesh: null,
      });
    }
    return list;
  }

  function disposeTempObject3D(obj) {
    if (!obj) return;
    try {
      obj.traverse?.((node) => {
        if (node.isMesh) {
          // Do not dispose shared kit geometries/materials; only detach cleanly
        }
      });
    } catch (_) { /* ignore */ }
  }

  function restoreAllCharacters(savedList) {
    if (!Array.isArray(savedList)) return;
    for (let i = 0; i < savedList.length; i++) {
      const st = savedList[i];
      const ch = st?.ch;
      if (!ch) continue;
      const u = ch.userData || {};
      try {
        if (st.tempPropMesh) {
          ch.remove?.(st.tempPropMesh);
          disposeTempObject3D(st.tempPropMesh);
          st.tempPropMesh = null;
          st.tempPropId = null;
        }
        if (ch.position?.set) ch.position.set(st.px, st.py, st.pz);
        else if (ch.position) { ch.position.x = st.px; ch.position.y = st.py; ch.position.z = st.pz; }

        if (ch.rotation) {
          ch.rotation.x = st.rx;
          ch.rotation.y = st.ry;
          ch.rotation.z = st.rz;
        }
        if (ch.scale?.set) ch.scale.set(st.sx, st.sy, st.sz);
        ch.visible = st.visible;

        u.groundY = st.groundY;
        u.jy = st.jy;
        u.vy = st.vy;
        u.spd = st.spd;
        u.gliding = st.gliding;
        u.birdClimbing = st.birdClimbing;
        u.propId = st.origPropId;
        u.specialMode = st.specialMode;
        u.specialLabel = st.specialLabel;
        if (u.actor && st.eliminated !== undefined) {
          u.actor.eliminated = st.eliminated;
        }
        if (st.disguiseRef) {
          st.disguiseRef.visible = st.disguiseVisible;
        }
        if (Array.isArray(u.parts) && Array.isArray(st.partsVisible)) {
          for (let k = 0; k < u.parts.length; k++) {
            if (u.parts[k] && st.partsVisible[k] !== undefined) {
              u.parts[k].visible = st.partsVisible[k];
            }
          }
        }
        if (u.nameplate && st.nameplateVisible !== undefined) {
          u.nameplate.visible = st.nameplateVisible;
        }
      } catch (_) { /* ignore mock char restore */ }
    }
  }

  function buildVisualPropMesh(propId) {
    const kitProps = env.getKit?.()?.props || env.kit?.props || null;
    const validId = findFallbackFunPropId(propId);
    const def = kitProps?.[validId];
    if (!def || typeof def.build !== 'function') return null;
    try {
      const mesh = def.build();
      mesh?.traverse?.((m) => {
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return mesh;
    } catch (_) {
      return null;
    }
  }

  function applyReplayPoseToCharState(st, pose, animDt = 0.016, simSec = 0) {
    if (!st || !st.ch || !pose) return;
    const ch = st.ch;
    const u = ch.userData || {};
    try {
      ch.visible = pose.forceVisible ? true : !pose.eliminated;
      if (u.nameplate) u.nameplate.visible = false;

      if (ch.position?.set) ch.position.set(pose.x, pose.y, pose.z);
      else if (ch.position) {
        ch.position.x = pose.x;
        ch.position.y = pose.y;
        ch.position.z = pose.z;
      }

      if (ch.rotation) {
        ch.rotation.y = pose.rotY || 0;
        ch.rotation.z = pose.rollZ || 0;
        ch.rotation.x = pose.pitchX || 0;
      }

      u.groundY = pose.groundY ?? pose.y;
      u.jy = pose.jy ?? 0;
      u.vy = pose.vy ?? 0;
      u.spd = pose.spd ?? 0;
      u.gliding = Boolean(pose.gliding);
      u.birdClimbing = Boolean(pose.birdClimbing);

      const wantPropId = pose.propId || null;
      if (wantPropId) {
        if (Array.isArray(u.parts)) {
          for (let k = 0; k < u.parts.length; k++) {
            if (u.parts[k]) u.parts[k].visible = false;
          }
        }
        let activePropObj = null;
        if (st.disguiseRef && st.origPropId === wantPropId) {
          if (st.tempPropMesh) st.tempPropMesh.visible = false;
          st.disguiseRef.visible = true;
          activePropObj = st.disguiseRef;
        } else {
          if (st.disguiseRef) st.disguiseRef.visible = false;
          if (!st.tempPropMesh || st.tempPropId !== wantPropId) {
            if (st.tempPropMesh) ch.remove?.(st.tempPropMesh);
            st.tempPropMesh = buildVisualPropMesh(wantPropId);
            st.tempPropId = wantPropId;
            if (st.tempPropMesh) ch.add?.(st.tempPropMesh);
          }
          if (st.tempPropMesh) {
            st.tempPropMesh.visible = true;
            activePropObj = st.tempPropMesh;
          } else if (Array.isArray(u.parts)) {
            // If prop builder unavailable in mock test, keep humanoid visible
            for (let k = 0; k < u.parts.length; k++) {
              if (u.parts[k]) u.parts[k].visible = true;
            }
          }
        }

        const animAnimal = activePropObj?.userData?.animateAnimal;
        if (typeof animAnimal === 'function') {
          const airborne = (pose.jy || 0) > 0.16;
          animAnimal(
            Math.max(0.004, animDt),
            Boolean(pose.moving || (pose.spd || 0) > 0.4),
            pose.spd || 0,
            simSec,
            Boolean(airborne || (pose.spd || 0) > 4.2),
            airborne,
            pose.vy || (airborne ? 2.4 : 0),
            pose.rollZ || 0
          );
        }
      } else {
        if (st.disguiseRef) st.disguiseRef.visible = false;
        if (st.tempPropMesh) st.tempPropMesh.visible = false;
        if (Array.isArray(u.parts)) {
          for (let k = 0; k < u.parts.length; k++) {
            if (u.parts[k]) {
              u.parts[k].visible = Array.isArray(st.partsVisible)
                ? (st.partsVisible[k] ?? true)
                : true;
            }
          }
        }
        if (typeof u.animate === 'function') {
          u.animate(Math.max(0.004, animDt), Boolean(pose.moving || (pose.spd || 0) > 0.35), pose.spd || 0);
        }
      }
    } catch (_) { /* ignore mock character pose issues */ }
  }

  function createReplayFxGroup() {
    destroyReplayFxGroup();
    const T = env.THREE;
    const sc = getScene();
    if (!T || !sc || typeof sc.add !== 'function' || !T.Group || !T.Mesh || !T.MeshBasicMaterial) {
      return null;
    }

    try {
      const grp = new T.Group();
      grp.name = 'vhReplayFxGroup';

      const streakGeo = T.CylinderGeometry
        ? new T.CylinderGeometry(0.048, 0.105, 1.0, 8)
        : new T.BoxGeometry(0.11, 1.0, 0.11);
      const tipGeo = T.IcosahedronGeometry
        ? new T.IcosahedronGeometry(0.115, 0)
        : new T.BoxGeometry(0.16, 0.16, 0.16);
      const ringGeo = T.RingGeometry
        ? new T.RingGeometry(0.24, 0.44, 24)
        : new T.BoxGeometry(0.65, 0.04, 0.65);
      const puffGeo = T.IcosahedronGeometry
        ? new T.IcosahedronGeometry(0.22, 1)
        : new T.BoxGeometry(0.28, 0.28, 0.28);

      const streaks = [];
      for (let i = 0; i < REPLAY_STREAK_POOL_SIZE; i++) {
        const boltGroup = new T.Group();
        const shaftMat = new T.MeshBasicMaterial({
          color: 0x4fc3ff,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        });
        const tipMat = new T.MeshBasicMaterial({
          color: 0xdcf7ff,
          transparent: true,
          opacity: 0.98,
          depthWrite: false,
        });
        const shaft = new T.Mesh(streakGeo, shaftMat);
        const tip = new T.Mesh(tipGeo, tipMat);
        tip.position.y = 0.5;
        boltGroup.add(shaft);
        boltGroup.add(tip);
        boltGroup.visible = false;
        boltGroup.renderOrder = 8;
        grp.add(boltGroup);
        streaks.push({ root: boltGroup, shaft, tip, shaftMat, tipMat });
      }

      const rings = [];
      for (let i = 0; i < REPLAY_RING_POOL_SIZE; i++) {
        const mat = new T.MeshBasicMaterial({
          color: 0xffd56b,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: T.DoubleSide ?? 2,
        });
        const mesh = new T.Mesh(ringGeo, mat);
        mesh.rotation.x = -Math.PI * 0.5;
        mesh.visible = false;
        mesh.renderOrder = 7;
        grp.add(mesh);
        rings.push({ mesh, mat });
      }

      const puffs = [];
      for (let i = 0; i < REPLAY_PUFF_POOL_SIZE; i++) {
        const mat = new T.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xffb3d1 : 0xfff8ea,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const mesh = new T.Mesh(puffGeo, mat);
        mesh.visible = false;
        mesh.renderOrder = 7;
        grp.add(mesh);
        puffs.push({ mesh, mat });
      }

      sc.add(grp);
      replayFxGroup = grp;
      replayFxPools = { streaks, rings, puffs, geos: [streakGeo, tipGeo, ringGeo, puffGeo] };
      return grp;
    } catch (_) {
      replayFxGroup = null;
      replayFxPools = null;
      return null;
    }
  }

  function destroyReplayFxGroup() {
    const sc = getScene();
    if (replayFxGroup && sc && typeof sc.remove === 'function') {
      try { sc.remove(replayFxGroup); } catch (_) { /* ignore */ }
    }
    if (replayFxPools) {
      try {
        replayFxPools.streaks.forEach((s) => {
          s.shaftMat?.dispose?.();
          s.tipMat?.dispose?.();
        });
        replayFxPools.rings.forEach((r) => r.mat?.dispose?.());
        replayFxPools.puffs.forEach((p) => p.mat?.dispose?.());
        replayFxPools.geos.forEach((g) => g?.dispose?.());
      } catch (_) { /* ignore */ }
    }
    replayFxGroup = null;
    replayFxPools = null;
  }

  function orientStreakAlongVelocity(root, shaft, tip, vx, vy, vz, speedScale = 1.0) {
    const T = env.THREE;
    const len = Math.hypot(vx, vy, vz);
    const stretch = clamp((len > 0.01 ? len : 14) * 0.078 * speedScale, 0.52, 1.75);
    if (shaft?.scale) shaft.scale.set(1, stretch, 1);
    if (tip?.position) tip.position.y = stretch * 0.48;

    if (T?.Vector3 && T?.Quaternion && root?.quaternion) {
      if (!cachedUpVec) {
        cachedUpVec = new T.Vector3(0, 1, 0);
        cachedDirNorm = new T.Vector3();
        cachedQuat = new T.Quaternion();
      }
      if (len > 1e-4) {
        cachedDirNorm.set(vx / len, vy / len, vz / len);
      } else {
        cachedDirNorm.set(0, 0, 1);
      }
      cachedQuat.setFromUnitVectors(cachedUpVec, cachedDirNorm);
      root.quaternion.copy(cachedQuat);
    }
  }

  function setStreakElemColors(slot, elemKey) {
    const pal = ELEM_COLORS[elemKey] || ELEM_COLORS.water;
    slot.shaftMat?.color?.setHex?.(pal.hex);
    slot.tipMat?.color?.setHex?.(pal.core);
  }

  // --------------------------------------------------------------------------
  // Replay Session Builder (Recorded 24 Hz Window)
  // --------------------------------------------------------------------------
  function resolveClipLengthSec() {
    // ?highlightSec=0 only skips the between-round replay; a clip rendered on demand keeps the default length
    return resolveHighlightDurationSec() || DEFAULT_HIGHLIGHT_SEC;
  }

  function setupReplaySession(hl, charStates = savedCharStates) {
    const G = env.G || {};
    const heroChar = hl.charRef || G.player || getHidersList()[0] || null;
    const savedMap = new Map();
    for (let i = 0; i < charStates.length; i++) {
      savedMap.set(charStates[i].ch, charStates[i]);
    }
    const isHeroSnap = (c) => (heroChar && c.ref === heroChar) || c.id === hl.actorId;

    let peakT = Number.isFinite(hl.tPeak) ? hl.tPeak : roundElapsedSec;
    let minRecT = 0;
    let maxRecT = 0;
    if (ringFrames.length >= 2) {
      minRecT = ringFrames[0].t;
      maxRecT = ringFrames[ringFrames.length - 1].t;
      if (!hl.isRecap) {
        // Centre the slow-mo beat on the true physical action peak inside [tPeak - 2.1, tPeak + 1.2]
        let bestDramaVal = -1;
        let bestDramaT = peakT;
        for (let i = 0; i < ringFrames.length; i++) {
          const rf = ringFrames[i];
          if (rf.t < peakT - 2.1 || rf.t > peakT + 1.2) continue;
          const hs = rf.chars.find(isHeroSnap);
          const drama = (hs ? (hs.jy || 0) * 2.8 + (hs.spd || 0) * 0.35 : 0)
            + rf.fx.length * 2.2
            + Math.min(rf.shots.length, 8) * 0.25;
          if (drama > bestDramaVal + 0.05) {
            bestDramaVal = drama;
            bestDramaT = rf.t;
          }
        }
        peakT = bestDramaT;
      }
    }

    // Real moment: ~[peak - 7 s, peak + 3.5 s] with the slow-mo beat on the peak.
    // Round recap: the real last seconds of the round at 1x.
    const timeline = buildClipTimeline(resolveClipLengthSec(), peakT, minRecT, maxRecT, !hl.isRecap);
    const windowFrames = ringFrames.length >= 2
      ? ringFrames.filter((f) => f.t >= timeline.t0 - 0.05 && f.t <= timeline.t1 + 0.05)
      : [];

    // Recorded FX bursts inside the window + where the Seekers were while the moment built up
    // (the opening wide shot looks past the hero at them).
    const burstEvents = [];
    let threatX = 0;
    let threatZ = 0;
    let startHeading = hl.rot || 0;
    let gotStartHeading = false;
    const stride = Math.max(1, Math.floor(windowFrames.length / 16));
    for (let i = 0; i < windowFrames.length; i++) {
      const wf = windowFrames[i];
      for (let fi = 0; fi < wf.fx.length; fi++) {
        burstEvents.push({ t: wf.t, ...wf.fx[fi] });
      }
      if (i % stride !== 0) continue;
      const hs = wf.chars.find(isHeroSnap);
      if (!hs) continue;
      if (!gotStartHeading) {
        gotStartHeading = true;
        startHeading = hs.rotY || 0;
      }
      if (wf.t > timeline.peakT + 0.05) continue;
      let nearest = null;
      let nearestD = 30;
      for (let ci = 0; ci < wf.chars.length; ci++) {
        const c = wf.chars[ci];
        if (c === hs || c.team !== 'seekers' || c.eliminated) continue;
        const d = Math.hypot(c.x - hs.x, c.z - hs.z);
        if (d > 0.3 && d < nearestD) {
          nearestD = d;
          nearest = c;
        }
      }
      if (nearest) {
        threatX += (nearest.x - hs.x) / nearestD;
        threatZ += (nearest.z - hs.z) / nearestD;
      }
    }
    const hasThreatDir = Math.hypot(threatX, threatZ) > 0.35;

    const basePos = {
      x: Number.isFinite(hl.pos?.x) ? hl.pos.x : 0,
      y: Number.isFinite(hl.pos?.y) ? hl.pos.y : 0,
      z: Number.isFinite(hl.pos?.z) ? hl.pos.z : 0,
    };

    // The replay always plays back what was actually recorded; nothing is staged.
    replaySession = {
      hl,
      heroChar,
      savedMap,
      timeline,
      windowFrames,
      burstEvents,
      basePos,
      // Camera side for the world-fixed shots: opposite the Seekers when any were around
      wideAzimuth: hasThreatDir ? Math.atan2(threatX, threatZ) + Math.PI + 0.38 : startHeading + 0.75,
      camShot: '',
      camOffsetIdx: 0,
      camHeading: null,
    };
    return replaySession;
  }

  function applyReplayWorldAtU(uNorm, animDt = 0.016) {
    if (!replaySession) return { hx: 0, hy: 0, hz: 0, heading: 0, jy: 0 };
    const sess = replaySession;
    const targetT = clipSimTimeAtU(sess.timeline, uNorm);
    const simSec = targetT - sess.timeline.t0;

    // Reset pooled FX visibility each step before populating active bolts/bursts
    if (replayFxPools) {
      for (let i = 0; i < replayFxPools.streaks.length; i++) replayFxPools.streaks[i].root.visible = false;
      for (let i = 0; i < replayFxPools.rings.length; i++) replayFxPools.rings[i].mesh.visible = false;
      for (let i = 0; i < replayFxPools.puffs.length; i++) replayFxPools.puffs[i].mesh.visible = false;
    }

    let heroOut = {
      hx: sess.basePos.x,
      hy: sess.basePos.y,
      hz: sess.basePos.z,
      heading: sess.hl.rot || 0,
      jy: 0,
    };

    // ------------------------------------------------------------------------
    // TRUE 24 Hz Recorded World-State Replay Interpolation!
    // ------------------------------------------------------------------------
    const frames = sess.windowFrames;
    if (!frames.length) return heroOut;
    let idx0 = 0;
    while (idx0 < frames.length - 2 && frames[idx0 + 1].t <= targetT) {
      idx0 += 1;
    }
    const f0 = frames[idx0];
    const f1 = frames[Math.min(frames.length - 1, idx0 + 1)];
    const span = Math.max(1e-4, f1.t - f0.t);
    const alpha = clamp((targetT - f0.t) / span, 0, 1);

    const map1 = new Map();
    for (let i = 0; i < f1.chars.length; i++) {
      map1.set(f1.chars[i].id, f1.chars[i]);
    }

    for (let i = 0; i < f0.chars.length; i++) {
      const c0 = f0.chars[i];
      const c1 = map1.get(c0.id) || c0;
      const st = sess.savedMap.get(c0.ref);
      const ix = lerp(c0.x, c1.x, alpha);
      const iy = lerp(c0.y, c1.y, alpha);
      const iz = lerp(c0.z, c1.z, alpha);
      const igy = lerp(c0.groundY, c1.groundY, alpha);
      const ijy = lerp(c0.jy, c1.jy, alpha);
      const ivy = lerp(c0.vy, c1.vy, alpha);
      const irot = lerpAngle(c0.rotY, c1.rotY, alpha);
      const ispd = lerp(c0.spd, c1.spd, alpha);
      const isHero = (sess.heroChar && c0.ref === sess.heroChar) || c0.id === sess.hl.actorId;

      if (st) {
        applyReplayPoseToCharState(st, {
          x: ix,
          y: iy,
          z: iz,
          groundY: igy,
          jy: ijy,
          vy: ivy,
          rotY: irot,
          spd: ispd,
          moving: c0.moving || c1.moving,
          gliding: c0.gliding || c1.gliding,
          birdClimbing: c0.birdClimbing || c1.birdClimbing,
          propId: isHero ? (c0.propId || c1.propId || sess.hl.propId) : (c0.propId || c1.propId),
          eliminated: isHero ? false : (c0.eliminated && c1.eliminated),
          forceVisible: isHero,
        }, animDt, simSec);
      }

      if (isHero) {
        heroOut = { hx: ix, hy: iy, hz: iz, heading: irot, jy: ijy };
      }
    }

    // Recorded projectiles + recorded FX bursts only (no supplementary tracers: nothing is invented)
    if (replayFxPools) {
      let usedStreaks = 0;
      const recShots = f0.shots;
      for (let si = 0; si < recShots.length && usedStreaks < replayFxPools.streaks.length; si++) {
        const sh = recShots[si];
        const slot = replayFxPools.streaks[usedStreaks++];
        const advDt = alpha * span;
        const px = sh.x + sh.vx * advDt;
        const py = sh.y + sh.vy * advDt;
        const pz = sh.z + sh.vz * advDt;
        slot.root.visible = true;
        slot.root.position.set(px, py, pz);
        setStreakElemColors(slot, sh.elem);
        orientStreakAlongVelocity(slot.root, slot.shaft, slot.tip, sh.vx, sh.vy, sh.vz, 1.05);
      }

      // Render discrete recorded FX bursts (decoy pops, smoke dashes, splashes, launches)
      let usedRings = 0;
      let usedPuffs = 0;
      for (let bi = 0; bi < sess.burstEvents.length; bi++) {
        const ev = sess.burstEvents[bi];
        const age = targetT - ev.t;
        if (age < -0.04 || age > 0.75) continue;
        const p = clamp((age + 0.04) / 0.79, 0, 1);
        if (usedRings < replayFxPools.rings.length) {
          const rSlot = replayFxPools.rings[usedRings++];
          const pal = ELEM_COLORS[ev.elem] || ELEM_COLORS.water;
          rSlot.mesh.visible = true;
          rSlot.mesh.position.set(ev.x, ev.y + 0.06, ev.z);
          rSlot.mesh.scale.setScalar(0.6 + p * 4.4);
          rSlot.mat.color.setHex(pal.hex);
          rSlot.mat.opacity = 0.88 * (1 - p) * (1 - p);
        }
        for (let pk = 0; pk < 4 && usedPuffs < replayFxPools.puffs.length; pk++) {
          const pf = replayFxPools.puffs[usedPuffs++];
          const ang = (pk / 4) * Math.PI * 2 + bi * 1.1;
          const rad = 0.25 + p * 1.65;
          pf.mesh.visible = true;
          pf.mesh.position.set(
            ev.x + Math.cos(ang) * rad,
            ev.y + 0.2 + p * 0.95,
            ev.z + Math.sin(ang) * rad
          );
          pf.mesh.scale.setScalar(Math.max(0.1, (1 - p) * 1.35));
          pf.mat.opacity = 0.82 * (1 - p);
        }
      }
    }

    return heroOut;
  }

  // --------------------------------------------------------------------------
  // Replay Camera Choreography
  // --------------------------------------------------------------------------
  /**
   * One shot per story beat so a 12 s clip never sits on a single angle:
   *   real moment: establishing wide (Seekers in the background) -> follow -> slow-mo whip-orbit
   *                on the peak -> pull-out on the aftermath;
   *   round recap: wide -> push-in orbit -> close -> pull-out, on world-fixed angles.
   * roofsBlock: the wide / pull-out shots climb to roof height, so there a roof blocks the camera like
   * a wall (the low shots keep ignoring roofs, as before).
   */
  function planReplayShot(u, sess, heroOut, stepSec = 0) {
    let heading = heroOut.heading || 0;
    const tl = sess?.timeline || null;
    if (!tl) {
      return { id: 'chase', fov: 62, dist: 4.6, elevDeg: 18, azim: heading + 0.72 };
    }
    // Low-pass the hero heading so a prop turning on the spot does not whip the follow camera around
    if (sess.camHeading === null || !(stepSec > 0)) sess.camHeading = heading;
    else sess.camHeading = lerpAngle(sess.camHeading, heading, 1 - Math.exp(-stepSec * 5));
    heading = sess.camHeading;

    const wideAz = sess.wideAzimuth;
    const sec = u * tl.durationSec;

    if (tl.hasSlowMo) {
      if (u < tl.slowU0) {
        const leadSec = tl.wallSlow0;
        const wideSec = leadSec >= 3.2 ? clamp(leadSec * 0.42, 1.6, 3.0) : 0;
        if (sec < wideSec) {
          // Shot 1: establishing wide — where the hero is and who is closing in (FOV 58)
          const cu = sec / wideSec;
          return {
            id: 'wide',
            roofsBlock: true,
            fov: 58,
            dist: lerp(8.8, 7.4, smoothstep01(cu)),
            elevDeg: lerp(33, 27, cu),
            azim: wideAz + cu * 0.3,
          };
        }
        // Shot 2: Dynamic Pursuit Chase Cut framing fleeing prop + incoming shots (FOV 62)
        const cu = (sec - wideSec) / Math.max(0.01, leadSec - wideSec);
        return {
          id: 'follow',
          fov: 62,
          dist: lerp(5.6, 4.15, smoothstep01(cu)),
          elevDeg: lerp(21, 16, cu),
          azim: heading + 0.75 + cu * 0.52,
        };
      }
      if (u <= tl.slowU1) {
        // Shot 3: 0.34x BULLET-TIME SLOW-MO Hero Whip-Orbit Cut (3.45m-4.15m, FOV 49)
        const cu = (u - tl.slowU0) / Math.max(1e-4, tl.slowU1 - tl.slowU0);
        return {
          id: 'peak',
          fov: 49,
          dist: lerp(3.45, 4.15, smoothstep01(cu)),
          elevDeg: lerp(14, 18, cu),
          azim: heading + 1.35 + smoothstep01(cu) * 1.85,
        };
      }
      // Shot 4: aftermath pull-out (4.15m-7.4m, FOV 58)
      const cu = (u - tl.slowU1) / Math.max(1e-4, 1 - tl.slowU1);
      return {
        id: 'getaway',
        roofsBlock: true,
        fov: 58,
        dist: lerp(4.15, 7.4, smoothstep01(cu)),
        elevDeg: lerp(18, 29, cu),
        azim: heading + 3.25 + cu * 0.42,
      };
    }

    // Round recap
    if (tl.durationSec < 5) {
      return { id: 'close', fov: 54, dist: lerp(5.2, 4.2, u), elevDeg: 18, azim: wideAz + u * 0.9 };
    }
    if (u < 0.28) {
      const cu = u / 0.28;
      return {
        id: 'wide',
        roofsBlock: true,
        fov: 58,
        dist: lerp(8.8, 7.4, smoothstep01(cu)),
        elevDeg: lerp(33, 27, cu),
        azim: wideAz + cu * 0.3,
      };
    }
    if (u < 0.60) {
      const cu = (u - 0.28) / 0.32;
      return {
        id: 'approach',
        fov: 60,
        dist: lerp(6.4, 4.8, smoothstep01(cu)),
        elevDeg: lerp(23, 18, cu),
        azim: wideAz + 1.15 + cu * 0.55,
      };
    }
    const cu = (u - 0.60) / 0.40;
    const out = smoothstep01((cu - 0.6) / 0.4);
    return {
      id: 'close',
      roofsBlock: true,
      fov: lerp(50, 58, out),
      dist: cu < 0.6 ? lerp(3.7, 4.0, cu / 0.6) : lerp(4.0, 7.4, out),
      elevDeg: cu < 0.6 ? lerp(14, 17, cu / 0.6) : lerp(17, 29, out),
      azim: wideAz + 2.2 + cu * 1.3,
    };
  }

  function positionActionCameraAtU(uNorm, heroOut, cam, T, stepSec = 0) {
    if (!cam) return;
    const u = clamp(uNorm, 0, 1);
    const hx = Number(heroOut.hx) || 0;
    const hy = Number(heroOut.hy) || 0;
    const hz = Number(heroOut.hz) || 0;
    const heroRef = replaySession?.heroChar || highlightSubject?.charRef || null;
    const heroBodyH = clamp(Number(heroRef?.userData?.height) || 0.72, 0.45, 2.4);
    const focusY = hy + clamp(heroBodyH * 0.56, 0.30, 0.92);
    currentHeroFocusWorld = { x: hx, y: focusY, z: hz };

    const sess = replaySession;
    const tl = sess?.timeline || null;
    const shot = planReplayShot(u, sess, heroOut, stepSec);
    const fov = shot.fov;
    const elevDeg = shot.elevDeg;
    const azim = shot.azim;
    const dist = clamp(shot.dist, 2.8, 10);

    // Subtle impact micro-shake for the first 0.4 s after the slow-mo drops
    let shakeX = 0;
    let shakeY = 0;
    if (tl && tl.hasSlowMo) {
      const sinceSlow = (u - tl.slowU0) * tl.durationSec;
      if (sinceSlow >= 0 && sinceSlow <= 0.42) {
        const sk = (1 - sinceSlow / 0.42) * 0.085;
        shakeX = Math.sin(sinceSlow * 69) * sk;
        shakeY = Math.cos(sinceSlow * 81) * sk;
      }
    }
    const footFloorY = hy - (heroOut.jy || 0);
    const computeDesiredPos = (angleRad, radius, elDeg) => {
      const elRad = (elDeg * Math.PI) / 180;
      return {
        x: hx + Math.sin(angleRad) * Math.cos(elRad) * radius + shakeX,
        y: Math.max(footFloorY + 0.65, focusY + Math.sin(elRad) * radius + shakeY),
        z: hz + Math.cos(angleRad) * Math.cos(elRad) * radius,
      };
    };

    // Collect non-hero character positions so pursuing Seekers NEVER stand on top of the camera lens!
    const otherBodies = [];
    const allChars = collectUniqueCharacters();
    for (let ci = 0; ci < allChars.length; ci++) {
      const oc = allChars[ci];
      if (!oc || oc === heroRef || oc.visible === false || !oc.position) continue;
      otherBodies.push({
        x: oc.position.x || 0,
        y: (oc.position.y || 0) + 0.85,
        z: oc.position.z || 0,
      });
    }

    const computeCharacterPhotobombPenalty = (candPos) => {
      let penalty = 0;
      const sx = candPos.x - hx;
      const sy = candPos.y - focusY;
      const sz = candPos.z - hz;
      const segLenSq = Math.max(1e-4, sx * sx + sy * sy + sz * sz);
      for (let i = 0; i < otherBodies.length; i++) {
        const ob = otherBodies[i];
        // 1. Direct proximity to camera lens (prevents giant Seeker hat filling 80% of screen!)
        const dLens = Math.hypot(candPos.x - ob.x, (candPos.y - ob.y) * 0.75, candPos.z - ob.z);
        if (dLens < 1.95) {
          penalty += (1.95 - dLens) * 14.0;
        }
        // 2. Occluding the sightline segment between heroFocus (t=0) and camera (t=1)
        const tProj = clamp(((ob.x - hx) * sx + (ob.y - focusY) * sy + (ob.z - hz) * sz) / segLenSq, 0.08, 0.95);
        const qx = hx + sx * tProj;
        const qy = focusY + sy * tProj;
        const qz = hz + sz * tProj;
        const dRay = Math.hypot(ob.x - qx, (ob.y - qy) * 0.65, ob.z - qz);
        if (dRay < 0.92) {
          penalty += (0.92 - dRay) * 12.0;
        }
      }
      return penalty;
    };

    let finalPos = computeDesiredPos(azim, dist, elevDeg);

    // Wall, prop & character-photobomb avoidance across candidate azimuths!
    const solids = env.getSolids?.() || env.solids || null;
    const canRaycast = Boolean(T?.Raycaster && T?.Vector3 && Array.isArray(solids) && solids.length > 0);
    try {
      if (canRaycast && !cachedRaycaster) {
        cachedRaycaster = new T.Raycaster();
        cachedFocusVec = new T.Vector3();
        cachedWantVec = new T.Vector3();
        cachedDirVec = new T.Vector3();
      }

      const evalCandidate = (angleOffset, extraElevDeg = 0) => {
        const rawPos = computeDesiredPos(azim + angleOffset, dist, elevDeg + extraElevDeg);
        let adjPos = rawPos;
        let clearFrac = 1.0;

        if (canRaycast) {
          cachedFocusVec.set(hx, focusY, hz);
          cachedWantVec.set(rawPos.x, rawPos.y, rawPos.z);
          cachedDirVec.copy(cachedWantVec).sub(cachedFocusVec);
          const rayLen = cachedDirVec.length();
          if (rayLen > 1e-4) {
            cachedDirVec.divideScalar(rayLen);
            cachedRaycaster.set(cachedFocusVec, cachedDirVec);
            cachedRaycaster.far = rayLen + 0.25;
            cachedRaycaster.firstHitOnly = false;
            const hits = cachedRaycaster.intersectObjects(solids, false);
            const blocker = hits.find((hit) => (
              hit &&
              hit.object &&
              !hit.object.userData?.ground &&
              (shot.roofsBlock || !hit.object.userData?.isRoof) &&
              !isBelongingToChar(hit.object, heroRef)
            ));
            if (blocker && blocker.distance < rayLen) {
              const safeDist = clamp(blocker.distance - 0.42, 1.55, 5.8);
              clearFrac = clamp(safeDist / rayLen, 0.1, 1.0);
              adjPos = {
                x: hx + cachedDirVec.x * safeDist,
                y: Math.max(footFloorY + 0.65, focusY + cachedDirVec.y * safeDist),
                z: hz + cachedDirVec.z * safeDist,
              };
            }
          }
        }

        const charPen = computeCharacterPhotobombPenalty(adjPos);
        const wallPen = (1 - clearFrac) * 16.0;
        const devPen = Math.abs(angleOffset) * 0.55 + extraElevDeg * 0.04;
        return {
          pos: adjPos,
          score: 100 - charPen - wallPen - devPen,
          clean: clearFrac > 0.86 && charPen < 0.5,
        };
      };

      const offsets = [
        [0, 0],
        [0.58, 4],
        [-0.58, 4],
        [1.18, 6],
        [-1.18, 6],
        [1.82, 8],
        [-1.82, 8],
        [2.50, 10],
        [-2.50, 10],
        [Math.PI, 12],
      ];

      // Within one shot stay on the side picked earlier: flipping sides every few frames reads as a glitch
      const stickyIdx = sess && sess.camShot === shot.id ? sess.camOffsetIdx : 0;
      let bestCand = null;
      let bestScore = -Infinity;
      let bestIdx = 0;
      for (let k = 0; k < offsets.length; k++) {
        const oi = k === 0 ? stickyIdx : (k <= stickyIdx ? k - 1 : k);
        const cand = evalCandidate(offsets[oi][0], offsets[oi][1]);
        const score = cand.score + (k === 0 && stickyIdx !== 0 ? 3 : 0);
        if (!bestCand || score > bestScore) {
          bestCand = cand;
          bestScore = score;
          bestIdx = oi;
        }
        if (k === 0 && cand.clean) break;
      }
      if (bestCand) {
        finalPos = bestCand.pos;
      }
      if (sess) {
        sess.camShot = shot.id;
        sess.camOffsetIdx = bestIdx;
      }
    } catch (_) { /* ignore raycast issues on mock meshes */ }

    try {
      if (typeof cam.fov === 'number' && Math.abs(cam.fov - fov) > 0.05) {
        cam.fov = fov;
        cam.updateProjectionMatrix?.();
      }
      if (cam.position && typeof cam.position.set === 'function') {
        cam.position.set(finalPos.x, finalPos.y, finalPos.z);
      } else if (cam.position) {
        cam.position.x = finalPos.x;
        cam.position.y = finalPos.y;
        cam.position.z = finalPos.z;
      }
      if (typeof cam.lookAt === 'function') {
        cam.lookAt(hx, focusY, hz);
      }
    } catch (_) { /* ignore mock camera issues */ }
  }

  // --------------------------------------------------------------------------
  // DOM Mounting (#vhHighlightOverlay, #vhClipModal, #vhSpectatorBar, #vhShareToast)
  // --------------------------------------------------------------------------
  function showToast(message, durationMs = 3400) {
    if (typeof env.hint === 'function') {
      try { env.hint(message, durationMs); } catch (_) { /* ignore */ }
    }
    if (!hasDOM) return;
    mountUI();
    const toast = $('vhShareToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('on');
    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      toast.classList.remove('on');
    }, durationMs);
  }

  function mountUI() {
    if (!hasDOM) return;
    const host = $('app') || document.body;
    if (!host) return;

    // 1. End-of-Round 3D Bullet-Time Action Replay Overlay (#vhHighlightOverlay)
    if (!$('vhHighlightOverlay')) {
      const ov = document.createElement('div');
      ov.id = 'vhHighlightOverlay';
      ov.setAttribute('aria-live', 'polite');
      ov.innerHTML =
        `<div class="vh-vignette" aria-hidden="true"></div>` +
        `<div class="vh-speedlines" aria-hidden="true"></div>` +
        `<div class="vh-letterbox top">` +
          `<span class="vh-rec-pill"><i class="vh-rec-dot"></i><span id="vhRecPillTxt">ACTION REPLAY · 9:16 REC</span></span>` +
          `<button type="button" class="vh-skip-btn primary" id="btnVhSkip" aria-label="Skip replay">Skip ⏭</button>` +
        `</div>` +
        `<div class="vh-badge-wrap">` +
          `<div class="vh-highlight-badge" id="vhOverlayBadge" data-cat="recap">🎬 ROUND RECAP</div>` +
        `</div>` +
        `<div class="vh-climax-wrap">` +
          `<div class="vh-climax-chip" id="vhClimaxChip">⚡ 0.3× SLOW-MO · BULLET-TIME ESCAPE!</div>` +
        `</div>` +
        `<div class="vh-stage-bottom">` +
          `<div class="vh-lower-third">` +
            `<div class="vh-meta-row">` +
              `<span class="vh-meta-actor" id="vhOverlayMeta"><span id="vhOverlayActor">✨ You · Spirit</span></span>` +
              `<span class="vh-meta-world" id="vhOverlayWorld">Meadowbrook Village</span>` +
            `</div>` +
            `<p class="vh-quote" id="vhOverlayQuote">“Round recap”</p>` +
            `<div class="vh-controls-row">` +
              `<div class="vh-controls-left">` +
                `<button type="button" class="vh-share-quick-btn" id="btnVhQuickShare">📲 Share Clip</button>` +
                `<button type="button" class="vh-preview-quick-btn" id="vhOverlayShareBtn">🎬 Preview 9:16</button>` +
              `</div>` +
              `<div class="vh-controls-right">` +
                `<span class="vh-letterbox-hint" id="vhOverlayTimerTxt">${DEFAULT_HIGHLIGHT_SEC.toFixed(1)}s · Space to skip</span>` +
                `<button type="button" class="vh-skip-btn compact" id="vhOverlaySkipBtn">Skip</button>` +
              `</div>` +
            `</div>` +
            `<div class="vh-progress-track" id="vhOverlayProgress"><i class="vh-progress-fill" id="vhOverlayBarFill"></i></div>` +
          `</div>` +
        `</div>` +
        `<div class="vh-letterbox bottom" aria-hidden="true">` +
          `<span class="vh-letterbox-hint">⏭ Skip anytime — your full 9:16 clip still gets saved</span>` +
        `</div>`;
      host.appendChild(ov);

      const handleSkipClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        userSkipHighlight();
      };
      $('btnVhSkip')?.addEventListener('click', handleSkipClick);
      $('vhOverlaySkipBtn')?.addEventListener('click', handleSkipClick);

      $('btnVhQuickShare')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        // Shares the full clip: the share sheet opens once the replay has recorded its last frame
        shareHighlight({ preferVideo: true });
      });

      $('vhOverlayShareBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        if (playingHighlight && !replaySilent) {
          replayHeldForModal = true;
        }
        openClipPreviewModal();
      });
    }

    // 2. 9:16 Vertical Phone-Frame Video Preview Modal (#vhClipModal)
    if (!$('vhClipModal')) {
      const modal = document.createElement('div');
      modal.id = 'vhClipModal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', '9:16 Viral Highlight Clip Preview');
      modal.innerHTML =
        `<div class="vh-modal-card">` +
          `<div class="vh-modal-hdr">` +
            `<div class="vh-modal-title-group">` +
              `<span class="vh-modal-kicker" id="vhModalBadge">🔥 9:16 TIKTOK · REELS · SHORTS</span>` +
              `<h3 class="vh-modal-title">Viral Escape Clip</h3>` +
            `</div>` +
            `<button type="button" class="vh-modal-close-btn" id="vhModalCloseBtn" aria-label="Close preview">✕</button>` +
          `</div>` +
          `<div class="vh-phone-frame">` +
            `<video id="vhClipPreviewVideo" playsinline loop controls autoplay></video>` +
            `<div class="vh-clip-loading" id="vhClipLoadingState">` +
              `<div class="vh-spinner"></div>` +
              `<span id="vhClipLoadingTxt">🎬 Saving your full 9:16 clip…</span>` +
            `</div>` +
          `</div>` +
          `<p class="vh-modal-caption" id="vhModalQuote"></p>` +
          `<div class="vh-modal-actions">` +
            `<button type="button" class="vh-modal-primary-btn" id="vhModalShareVideoBtn">📲 Share Viral Video</button>` +
            `<div class="vh-modal-secondary-row">` +
              `<button type="button" class="vh-modal-sec-btn" id="vhModalDownloadBtn">⬇️ Save Video</button>` +
              `<button type="button" class="vh-modal-sec-btn" id="vhModalSaveCardBtn">🖼️ Save 9:16 Cover</button>` +
            `</div>` +
          `</div>` +
        `</div>`;
      host.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          env.audio?.tap?.();
          closeClipPreviewModal();
        }
      });

      $('vhModalCloseBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        closeClipPreviewModal();
      });

      $('vhModalShareVideoBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        await shareHighlight({ preferVideo: true, openPreview: false });
      });

      $('vhModalDownloadBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        const vInfo = await ensureVideoClipReady();
        if (vInfo.aborted) return; // the next round started while the clip was still rendering
        if (vInfo.blob && vInfo.blob.size > 0) {
          await saveHighlightMedia(
            vInfo.blob,
            `hue-and-seek-escape-9x16.${vInfo.ext}`,
            String(vInfo.mimeType || 'video/webm').split(';')[0].trim() || 'video/webm',
            'video'
          );
        } else {
          const cardBlob = await buildVerticalShareCardBlob();
          await saveHighlightMedia(cardBlob, 'hue-and-seek-highlight-9x16.png', 'image/png', 'card');
        }
      });

      $('vhModalSaveCardBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        const cardBlob = await buildVerticalShareCardBlob();
        await saveHighlightMedia(cardBlob, 'hue-and-seek-highlight-9x16.png', 'image/png', 'card');
      });
    }

    // 3. Post-Elimination Active Spectator Bar (#vhSpectatorBar)
    if (!$('vhSpectatorBar')) {
      const bar = document.createElement('div');
      bar.id = 'vhSpectatorBar';
      bar.className = 'hidden';
      bar.setAttribute('aria-live', 'polite');
      bar.innerHTML =
        `<span class="vh-spec-info" id="vhSpecLabel">👻 Spectating: <b>Ally</b> <em>(🦆 Spirit)</em></span>` +
        `<div class="vh-spec-actions">` +
          `<button type="button" class="vh-spec-btn" id="btnVhSpecPrev" aria-label="Previous teammate">◀ Prev</button>` +
          `<button type="button" class="vh-spec-btn" id="btnVhSpecNext" aria-label="Next teammate">Next ▶</button>` +
          `<button type="button" class="vh-spec-btn clip" id="btnVhSpecClip">📸 Save Clip</button>` +
        `</div>`;
      host.appendChild(bar);

      $('btnVhSpecPrev')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cycleSpectate(-1);
      });
      $('btnVhSpecNext')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cycleSpectate(1);
      });
      $('btnVhSpecClip')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        env.audio?.tap?.();
        shareHighlight({ preferVideo: true });
      });
    }

    // 4. Celebratory Share Toast (#vhShareToast)
    if (!$('vhShareToast')) {
      const toast = document.createElement('div');
      toast.id = 'vhShareToast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      host.appendChild(toast);
    }

    // 5. Global Space / Escape skip & Spectator Left/Right hotkeys
    if (!keyListenerBound && typeof window !== 'undefined') {
      keyListenerBound = true;
      window.addEventListener('keydown', (e) => {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        const clipModal = $('vhClipModal');
        if (clipModal?.classList.contains('on') && e.code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeClipPreviewModal();
          return;
        }

        if (playingHighlight && !replaySilent && (e.code === 'Space' || e.code === 'Escape')) {
          e.preventDefault();
          e.stopPropagation();
          userSkipHighlight();
          return;
        }

        if (spectatingActive && !playingHighlight && !env.G?.over) {
          if (e.code === 'BracketLeft' || e.code === 'ArrowLeft') {
            e.preventDefault();
            cycleSpectate(-1);
          } else if (e.code === 'BracketRight' || e.code === 'ArrowRight') {
            e.preventDefault();
            cycleSpectate(1);
          }
        }
      }, true);
    }
  }

  // --------------------------------------------------------------------------
  // Replay Playback Lifecycle (playRoundHighlight, updateHighlightCamera, skip)
  // --------------------------------------------------------------------------
  function isClipModalOpen() {
    return Boolean(hasDOM && $('vhClipModal')?.classList.contains('on'));
  }

  function hideReplayOverlayDOM() {
    if (!hasDOM) return;
    document.body?.classList.remove('vh-replay-active');
    const ov = $('vhHighlightOverlay');
    if (ov) {
      ov.classList.remove('on', 'slowmo-active');
    }
  }

  function resolveClipWaiters() {
    const list = clipWaiters;
    clipWaiters = [];
    for (let i = 0; i < list.length; i++) {
      try { list[i](); } catch (_) { /* ignore */ }
    }
  }

  // The replay reached its last frame: close the recording. Only this path yields a full-length clip.
  function finalizeReplayRecording() {
    if (replayRecFinalized) return;
    replayRecFinalized = true;
    if (!highlightRecorder) {
      resolveClipWaiters();
      return;
    }
    const gen = recGeneration;
    clipFinalizing = true;
    Promise.race([stopRecording(), sleepMs(1500)]).then(() => {
      if (gen === recGeneration) { // else the next round already started and reset the clip state itself
        clipFinalizing = false;
        if (latestVideoBlob && latestVideoBlob.size > 0) clipComplete = true;
      }
      resolveClipWaiters();
    });
  }

  function stopHighlightCameraInternal(fireCallback = true) {
    if (highlightBackupInterval) {
      clearInterval(highlightBackupInterval);
      highlightBackupInterval = null;
    }

    const wasPlaying = playingHighlight;
    const cb = highlightDoneCb;
    playingHighlight = false;
    replayHeldForModal = false;
    replaySilent = false;
    highlightDoneCb = null;

    destroyReplayFxGroup();

    if (savedCharStates.length > 0) {
      restoreAllCharacters(savedCharStates);
      savedCharStates = [];
    }
    replaySession = null;

    if (savedCameraState) {
      restoreCameraState(savedCameraState);
      savedCameraState = null;
    }

    hideReplayOverlayDOM();

    if (wasPlaying && !replayRecFinalized) {
      stopRecording();
    }
    if (!clipFinalizing) {
      // Cut short before the last frame: whoever waits for the clip must not wait for nothing
      resolveClipWaiters();
    }

    if (fireCallback && wasPlaying && typeof cb === 'function') {
      cb();
    }
  }

  // Hard stop (public API; main.js calls it before it tears a round down).
  function skipHighlight() {
    if (!playingHighlight) return;
    stopHighlightCameraInternal(true);
  }

  // Skip button / Space: straight on to the results. While the clip is still recording, the replay keeps
  // rendering behind the results screen (no overlay, no stingers) until its last frame, so skipping
  // never costs the player the full-length clip.
  function userSkipHighlight() {
    if (!playingHighlight || replaySilent) return;
    if (!highlightRecorder || replayRecFinalized) {
      stopHighlightCameraInternal(true);
      return;
    }
    replaySilent = true;
    replayHeldForModal = false;
    hideReplayOverlayDOM();
    const cb = highlightDoneCb;
    highlightDoneCb = null;
    if (typeof cb === 'function') cb();
  }

  let skipHintText = '';
  function resolveSkipHintText() {
    if (!skipHintText) {
      let coarse = false;
      try {
        coarse = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
      } catch (_) { /* ignore */ }
      skipHintText = coarse ? 'tap Skip ⏭' : 'Space to skip';
    }
    return skipHintText;
  }

  function syncOverlayProgressUI(uNorm = 0) {
    if (!hasDOM || !playingHighlight || replaySilent) return;
    const pct = clamp(uNorm * 100, 0, 100);
    const fill = $('vhOverlayBarFill');
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
    const prog = $('vhOverlayProgress');
    if (prog) prog.setAttribute('data-progress', pct.toFixed(1));

    const rem = Math.max(0, highlightDuration - highlightElapsed);
    const timerTxt = $('vhOverlayTimerTxt');
    const inSlowMo = clipInSlowMo(replaySession?.timeline, uNorm);
    if (timerTxt) {
      timerTxt.textContent = inSlowMo
        ? `⚡ 0.3× SLOW-MO · ${rem.toFixed(1)}s`
        : `${rem.toFixed(1)}s · ${resolveSkipHintText()}`;
    }

    const ov = $('vhHighlightOverlay');
    if (ov) {
      ov.classList.toggle('slowmo-active', inSlowMo);
    }
    const recTxt = $('vhRecPillTxt');
    if (recTxt) {
      recTxt.textContent = inSlowMo
        ? '⚡ 0.34× BULLET-TIME · 9:16 REC'
        : 'ACTION REPLAY · 9:16 REC';
    }
  }

  /**
   * Starts the in-engine replay of `hl` and records it into the 9:16 clip.
   * silent = no overlay / stingers / callback: the clip is (re)rendered behind the results screen.
   * Returns true when the MediaRecorder is running.
   */
  function beginReplay(hl, { silent = false, onDone = null } = {}) {
    mountUI();
    stopHighlightCameraInternal(false);

    if (hasDOM && !silent) {
      $('specBar')?.classList.add('hidden');
      $('vhSpectatorBar')?.classList.add('hidden');
      if (document.pointerLockElement && document.exitPointerLock) {
        try { document.exitPointerLock(); } catch (_) { /* ignore */ }
      }
    }

    highlightSubject = hl;
    highlightElapsed = 0;
    currentReplayUNorm = 0;
    highlightHeroCaptured = false;
    highlightSlowMoFired = false;
    highlightGetawayFired = false;
    climaxFrameCaptured = false;
    replayHeldForModal = false;
    replaySilent = Boolean(silent);
    replayRecFinalized = false;
    clipComplete = false;
    highlightDoneCb = typeof onDone === 'function' ? onDone : null;
    playingHighlight = true;
    highlightLastExternalTickMs = getNow();
    smoothCropNdcX = 0;

    const initCam = getCamera();
    if (initCam) {
      savedCameraState = snapshotCameraState(initCam);
      hideFirstPersonCamChildren(initCam);
    }

    savedCharStates = snapshotAllCharacters(hl.charRef);
    createReplayFxGroup();
    // The clip is as long as requested, or as long as the recorded frames allow if that is less
    highlightDuration = setupReplaySession(hl).timeline.durationSec;

    if (hasDOM && !silent) {
      const badgeEl = $('vhOverlayBadge');
      if (badgeEl) {
        badgeEl.textContent = hl.badge || '🎬 ROUND RECAP';
        badgeEl.setAttribute('data-cat', hl.category || 'clutch_escape');
      }
      const climaxEl = $('vhClimaxChip');
      if (climaxEl) {
        climaxEl.textContent = `⚡ 0.3× SLOW-MO · ${String(hl.climaxTag || 'ROUND RECAP').replace(/^⚡\s*/, '')}`;
      }
      const who = hl.isLocal ? `${hl.actorName} (You)` : hl.actorName;
      const actorStr = `${hl.propIcon || '✨'} ${who} · ${hl.propLabel || 'Spirit'}`;
      const actorEl = $('vhOverlayActor');
      if (actorEl) actorEl.textContent = actorStr;
      else if ($('vhOverlayMeta')) $('vhOverlayMeta').textContent = actorStr;

      const worldEl = $('vhOverlayWorld');
      if (worldEl) {
        worldEl.textContent = `${hl.worldTitle} · RD ${hl.roundNumber || 1}`;
      }
      const quoteEl = $('vhOverlayQuote');
      if (quoteEl) {
        quoteEl.textContent = `“${hl.headline}”`;
      }
      syncOverlayProgressUI(0);
      document.body?.classList.add('vh-replay-active');
      $('vhHighlightOverlay')?.classList.add('on');
    }

    if (!silent) playReplaySfx('start');

    // Pose frame 0, render & composite onto 720x1280 socialCanvas BEFORE starting MediaRecorder
    if (initCam) {
      updateHighlightCamera(0, initCam, env.THREE);
      triggerLiveSceneRender();
      if (!compositedThisFrame) compositeSocialFrame(0);
    } else {
      compositeSocialFrame(0);
    }

    const recording = startSocialHighlightRecorder();

    // Wall-clock backup ticker so replay advances smoothly even if caller loop pauses
    let prevWallMs = Date.now();
    highlightBackupInterval = setInterval(() => {
      if (!playingHighlight) {
        clearInterval(highlightBackupInterval);
        highlightBackupInterval = null;
        return;
      }
      const nowWall = Date.now();
      const wallDt = clamp((nowWall - prevWallMs) / 1000, 0.01, 0.25);
      prevWallMs = nowWall;

      const sinceExtMs = Math.abs(getNow() - highlightLastExternalTickMs);
      if (sinceExtMs > 95) {
        const cam = getCamera();
        const stillGoing = updateHighlightCamera(wallDt, cam, env.THREE, true);
        if (stillGoing) {
          triggerLiveSceneRender();
          if (!compositedThisFrame) compositeSocialFrame(currentReplayUNorm);
        }
      }
    }, 45);

    return recording;
  }

  function playRoundHighlight(onDone) {
    const done = typeof onDone === 'function' ? onDone : () => {};
    const dur = resolveHighlightDurationSec();
    const hl = computeBestHighlight();

    // If ?highlightSec=0, fire onDone() immediately for fast headless tests
    if (dur <= 0) {
      done();
      return;
    }
    // Nothing recorded to play back (e.g. the round ended within a second): skip straight to the results.
    if (ringFrames.length < 12) {
      done();
      return;
    }

    beginReplay(hl, { onDone: done });
  }

  // Results screen, no finished clip (replay never ran, or was cut short): render the whole clip again
  // behind the results. Never during a live round — the replay takes over the camera and every character.
  function startSilentClipRender() {
    if (playingHighlight || !hasDOM || typeof MediaRecorder === 'undefined') return false;
    if (!env.G?.over || ringFrames.length < 12) return false;
    const recording = beginReplay(computeBestHighlight(), { silent: true });
    if (!recording) {
      stopHighlightCameraInternal(false);
      return false;
    }
    return true;
  }

  function isBelongingToChar(obj, charRoot) {
    if (!obj || !charRoot) return false;
    let cur = obj;
    while (cur) {
      if (cur === charRoot) return true;
      cur = cur.parent;
    }
    return false;
  }

  function updateHighlightCamera(dt, cameraArg, THREEArg, _fromBackup = false) {
    if (!playingHighlight) return false;

    if (!_fromBackup) {
      highlightLastExternalTickMs = getNow();
    }

    // A replay that renders behind the results screen never outlives the round it belongs to
    if (replaySilent && env.G && !env.G.over) {
      stopHighlightCameraInternal(false);
      return false;
    }

    const cam = cameraArg || getCamera();
    const T = THREEArg || env.THREE || null;

    if (cam && !savedCameraState) {
      savedCameraState = snapshotCameraState(cam);
      hideFirstPersonCamChildren(cam);
    }

    const maxStep = _fromBackup ? 0.25 : 12.0;
    const rawStep = clamp(Number(dt) || 0, 0, maxStep);
    highlightElapsed = Math.min(highlightDuration, highlightElapsed + rawStep);

    const u = clamp(highlightElapsed / Math.max(0.05, highlightDuration), 0, 1);
    currentReplayUNorm = u;
    const tl = replaySession?.timeline || null;

    // Stingers follow the slow-mo beat. Behind the results screen they stay quiet unless the player
    // is watching the clip render in the 9:16 preview.
    if (tl && tl.hasSlowMo) {
      const audible = !replaySilent || isClipModalOpen();
      // Fire Bullet-Time Slow-Mo Bass Drop + Whoosh right as the slow-mo beat starts
      if (!highlightSlowMoFired && u >= tl.slowU0) {
        highlightSlowMoFired = true;
        if (audible) playReplaySfx('slowmo_drop');
      }
      // Fire Triumphant Getaway Chord right as it ends
      if (!highlightGetawayFired && u >= tl.slowU1) {
        highlightGetawayFired = true;
        if (audible) playReplaySfx('getaway');
      }
    }

    const timeScaledAnimDt = Math.max(0.004, rawStep * (clipInSlowMo(tl, u) ? TIMESCALE_SLOWMO : 1));
    const heroOut = applyReplayWorldAtU(u, timeScaledAnimDt);
    positionActionCameraAtU(u, heroOut, cam, T, rawStep);

    // Capture crisp hero snapshot right at the peak
    if (!highlightHeroCaptured && tl && u >= tl.peakU) {
      highlightHeroCaptured = true;
      captureSnapshot(true);
      if (!climaxFrameCaptured) {
        captureClimaxVerticalRawCanvas(projectWorldToNdcX(currentHeroFocusWorld));
      }
      if (cachedHighlight) cachedHighlight.snapshotCanvas = bestSnapshotCanvas;
    }

    syncOverlayProgressUI(u);

    if (highlightElapsed >= highlightDuration) {
      finalizeReplayRecording();
      if (!replayHeldForModal) {
        stopHighlightCameraInternal(true);
        return false;
      }
    }
    return true;
  }

  function isPlayingHighlight() {
    return playingHighlight;
  }

  // --------------------------------------------------------------------------
  // On-Demand Climax Frame Renderer & Full-Length 9:16 Clip Provider
  // --------------------------------------------------------------------------
  function renderClimaxFrameOnDemand(hl) {
    if (!hasDOM) return null;
    if (playingHighlight) {
      const cam = getCamera();
      const tl = replaySession?.timeline || null;
      if (tl && cam && currentReplayUNorm < tl.peakU) {
        // The cover is the peak frame and the replay has not reached it yet: pose it out of band and
        // render it without compositing into the clip; the next replay tick re-poses the current frame.
        const sess = replaySession;
        const camMemo = [sess.camShot, sess.camOffsetIdx, sess.camHeading];
        try {
          const heroOut = applyReplayWorldAtU(tl.peakU, 0.016);
          positionActionCameraAtU(tl.peakU, heroOut, cam, env.THREE || null);
          playingHighlight = false;
          triggerLiveSceneRender();
          playingHighlight = true;
          return captureClimaxVerticalRawCanvas(projectWorldToNdcX(currentHeroFocusWorld));
        } catch (_) { /* fall through to the current frame */ } finally {
          playingHighlight = true;
          [sess.camShot, sess.camOffsetIdx, sess.camHeading] = camMemo;
        }
      }
      return captureClimaxVerticalRawCanvas(smoothCropNdcX, true);
    }

    const cam = getCamera();
    const T = env.THREE || null;
    const tempCamSnap = cam ? snapshotCameraState(cam) : null;
    const tempCharSnap = snapshotAllCharacters(hl?.charRef);
    const prevSession = replaySession;

    try {
      if (cam) hideFirstPersonCamChildren(cam);
      createReplayFxGroup();
      const peakU = setupReplaySession(hl, tempCharSnap).timeline.peakU;
      const heroOut = applyReplayWorldAtU(peakU, 0.016);
      positionActionCameraAtU(peakU, heroOut, cam, T);
      triggerLiveSceneRender();
      const ndcX = projectWorldToNdcX(currentHeroFocusWorld);
      captureClimaxVerticalRawCanvas(ndcX);
      captureSnapshot(false);
    } catch (_) { /* ignore render issues in mock env */ } finally {
      destroyReplayFxGroup();
      restoreAllCharacters(tempCharSnap);
      if (tempCamSnap) restoreCameraState(tempCamSnap);
      replaySession = prevSession;
      if (!env.G?.over) {
        triggerLiveSceneRender();
      }
    }
    return climaxSnapshotCanvas;
  }

  // Resolves once the replay that is recording right now reached its last frame (or was cut short)
  function waitForRunningClip() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      clipWaiters.push(finish);
      // Safety net: a slow device replays below real time, a hidden tab barely ticks at all
      const remainSec = Math.max(0, highlightDuration - highlightElapsed);
      setTimeout(finish, Math.round((remainSec * 2.5 + 8) * 1000));
    });
  }

  /**
   * Resolves with the full-length 9:16 clip { blob, mimeType, ext }. A partial recording is never
   * handed out:
   *   • clip already recorded to the last frame -> returned at once;
   *   • replay still recording (on screen, or behind the results after Skip) -> waits for its last frame;
   *   • round over but no finished clip -> renders the whole clip again behind the results screen;
   *   • otherwise (live round, no MediaRecorder, nothing recorded) -> blob null, callers use the cover.
   * `aborted: true` = the round moved on while waiting; callers drop the request.
   */
  async function ensureVideoClipReady() {
    const noClip = () => {
      const mime = chosenVideoMime || 'video/webm';
      return { blob: null, mimeType: mime, ext: extForMime(mime) };
    };
    if (clipComplete) return getLatestVideoInfo();
    if (!hasDOM || typeof MediaRecorder === 'undefined') return noClip();

    let announced = false;
    if (!clipFinalizing) {
      if (!playingHighlight && !startSilentClipRender()) return noClip();
      const waitSec = highlightDuration - highlightElapsed;
      if (waitSec > 1.2 && !isClipModalOpen()) {
        announced = true;
        showToast(`🎬 Saving your full 9:16 clip… ${Math.ceil(waitSec)}s`, Math.round(Math.min(waitSec, 6) * 1000));
      }
    }

    const gen = recGeneration;
    await waitForRunningClip();
    if (gen === recGeneration && clipComplete) return getLatestVideoInfo();
    const aborted = gen !== recGeneration || !env.G?.over;
    if (aborted && announced) showToast('⏭ Next round started — the clip was not saved', 2400);
    return { ...noClip(), aborted };
  }

  // --------------------------------------------------------------------------
  // #vhClipModal Open / Close Controls
  // --------------------------------------------------------------------------
  // While the clip is still being recorded the phone frame shows the 9:16 canvas live, so the player
  // watches the replay instead of a spinner.
  function attachLiveClipPreview(videoEl) {
    if (!videoEl || !socialVideoTrack || typeof MediaStream !== 'function') return false;
    try {
      videoEl.removeAttribute('src');
      videoEl.srcObject = new MediaStream([socialVideoTrack]);
      videoEl.muted = true;
      videoEl.controls = false;
      const playAttempt = videoEl.play?.();
      if (playAttempt && typeof playAttempt.catch === 'function') playAttempt.catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function detachLiveClipPreview(videoEl) {
    if (!videoEl) return;
    try {
      if (videoEl.srcObject) videoEl.srcObject = null;
      videoEl.controls = true;
    } catch (_) { /* ignore */ }
  }

  async function openClipPreviewModal(opts = {}) {
    mountUI();
    const hl = computeBestHighlight();
    if (!hasDOM) {
      return { ok: true, method: 'preview-modal', hasVideo: false, headline: hl.headline };
    }

    const modal = $('vhClipModal');
    const loadingEl = $('vhClipLoadingState');
    const loadingTxt = $('vhClipLoadingTxt');
    const videoEl = $('vhClipPreviewVideo');
    const badgeEl = $('vhModalBadge');
    const quoteEl = $('vhModalQuote');

    if (badgeEl) badgeEl.textContent = `${hl.badge || '🎬 ROUND RECAP'} · 9:16`;
    if (quoteEl) quoteEl.textContent = `“${hl.headline}”`;

    if (videoEl && socialCanvas) {
      try {
        videoEl.poster = socialCanvas.toDataURL('image/jpeg', 0.84);
      } catch (_) { /* ignore */ }
    }

    modal?.classList.add('on');

    // Starts the re-render synchronously when one is needed, so the live preview can attach right away
    const clipPromise = ensureVideoClipReady();
    let liveTimer = null;
    if (!clipComplete && (playingHighlight || clipFinalizing)) {
      const live = attachLiveClipPreview(videoEl);
      loadingEl?.classList.toggle('live', live);
      loadingEl?.classList.add('on');
      const syncLoadingTxt = () => {
        const rem = Math.max(0, highlightDuration - highlightElapsed);
        if (loadingTxt) {
          const label = live ? 'Saving…' : '🎬 Saving your full 9:16 clip…';
          loadingTxt.textContent = rem > 0.3 ? `${label} ${Math.ceil(rem)}s` : label;
        }
      };
      syncLoadingTxt();
      liveTimer = setInterval(syncLoadingTxt, 250);
    }

    const vInfo = await clipPromise;
    if (liveTimer) clearInterval(liveTimer);
    loadingEl?.classList.remove('on', 'live');
    detachLiveClipPreview(videoEl);

    let hasVideo = false;
    if (!modal?.classList.contains('on')) {
      // Closed (or the next round started) while the clip was still rendering: nothing left to show
    } else if (videoEl && vInfo.blob && vInfo.blob.size > 0 && typeof URL?.createObjectURL === 'function') {
      if (previewVideoObjectUrl) {
        try { URL.revokeObjectURL(previewVideoObjectUrl); } catch (_) { /* ignore */ }
      }
      previewVideoObjectUrl = URL.createObjectURL(vInfo.blob);
      videoEl.src = previewVideoObjectUrl;
      videoEl.muted = false;
      hasVideo = true;
      const playAttempt = videoEl.play?.();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {
          videoEl.muted = true;
          videoEl.play?.().catch(() => {});
        });
      }
    } else if (videoEl) {
      if (!climaxFrameCaptured) renderClimaxFrameOnDemand(hl);
      if (climaxSnapshotCanvas) {
        try { videoEl.poster = climaxSnapshotCanvas.toDataURL('image/jpeg', 0.88); } catch (_) { /* ignore */ }
      }
    }

    return {
      ok: true,
      method: 'preview-modal',
      hasVideo,
      roomCode: resolveActiveRoomCode(opts.roomCode),
      headline: hl.headline,
    };
  }

  function closeClipPreviewModal() {
    if (!hasDOM) return;
    const modal = $('vhClipModal');
    const videoEl = $('vhClipPreviewVideo');
    if (videoEl) {
      try {
        videoEl.pause?.();
        detachLiveClipPreview(videoEl);
        videoEl.removeAttribute('src');
        videoEl.load?.();
      } catch (_) { /* ignore */ }
    }
    if (previewVideoObjectUrl && typeof URL?.revokeObjectURL === 'function') {
      try { URL.revokeObjectURL(previewVideoObjectUrl); } catch (_) { /* ignore */ }
      previewVideoObjectUrl = '';
    }
    modal?.classList.remove('on');
    $('vhClipLoadingState')?.classList.remove('on', 'live');

    // Preview was opened mid-replay: the replay kept playing underneath; if it already reached its
    // last frame, the next tick ends it and hands over to the results.
    replayHeldForModal = false;
  }

  // --------------------------------------------------------------------------
  // Full-Bleed 9:16 Vertical TikTok / Shorts / Reels Cover Builder (1080×1920)
  // --------------------------------------------------------------------------
  function canvasToBlobAsync(canvas, mimeType = 'image/png') {
    return new Promise((resolve) => {
      if (typeof canvas.toBlob === 'function') {
        try {
          canvas.toBlob((blob) => {
            if (blob && blob.size > 0) {
              resolve(blob);
              return;
            }
            resolve(dataUrlFallbackBlob(canvas, mimeType));
          }, mimeType, 0.95);
          return;
        } catch (_) { /* fall through */ }
      }
      resolve(dataUrlFallbackBlob(canvas, mimeType));
    });
  }

  function dataUrlFallbackBlob(canvas, mimeType = 'image/png') {
    try {
      const dataUrl = canvas.toDataURL(mimeType);
      const parts = dataUrl.split(',');
      const bin = atob(parts[1] || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mimeType });
    } catch (_) {
      return new Blob([''], { type: mimeType });
    }
  }

  async function buildVerticalShareCardBlob(opts = {}) {
    const hl = computeBestHighlight();
    if (!hasDOM) {
      return new Blob([''], { type: 'image/png' });
    }

    if (!climaxFrameCaptured || !climaxSnapshotCanvas) {
      renderClimaxFrameOnDemand(hl);
    }

    const poster = document.createElement('canvas');
    poster.width = POSTER_W;
    poster.height = POSTER_H;
    const ctx = poster.getContext('2d');
    if (!ctx) return new Blob([''], { type: 'image/png' });

    // 1. Full-Bleed 1080×1920 Climax 3D Action Frame (Zero tiny boxed window!)
    if (climaxSnapshotCanvas && climaxSnapshotCanvas.width > 0 && climaxSnapshotCanvas.height > 0) {
      ctx.drawImage(climaxSnapshotCanvas, 0, 0, POSTER_W, POSTER_H);
    } else if (bestSnapshotCanvas && bestSnapshotCanvas.width > 0 && bestSnapshotCanvas.height > 0) {
      const { sx, sy, sw, sh } = computeFullBleedCropRect(
        bestSnapshotCanvas.width,
        bestSnapshotCanvas.height,
        POSTER_W,
        POSTER_H,
        0
      );
      ctx.drawImage(bestSnapshotCanvas, sx, sy, sw, sh, 0, 0, POSTER_W, POSTER_H);
    } else {
      paintFallbackStorybookScene(ctx, POSTER_W, POSTER_H, hl);
    }

    // 2. Crisp TikTok / Reels / YouTube Shorts Viral Overlays + Climax Sticker + Footer
    paintVerticalSocialOverlays(ctx, POSTER_W, POSTER_H, hl, 0.50, {
      isStaticPoster: true,
      explicitRoomCode: opts.roomCode || '',
    });

    // Subtle crisp outer festival gold trim frame
    ctx.save();
    drawRoundedRectPath(ctx, 20, 20, POSTER_W - 40, POSTER_H - 40, 38);
    ctx.strokeStyle = 'rgba(255, 198, 86, 0.44)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    return canvasToBlobAsync(poster, 'image/png');
  }

  // --------------------------------------------------------------------------
  // Share Highlight (Preview Modal OR native Android bridge / Web Share API -> Download)
  // --------------------------------------------------------------------------
  // Android app: the System WebView has no navigator.share and ignores blob <a download>, so
  // MainActivity.java exposes window.HueSeekNativeShare. A Blob is streamed over in base64 chunks
  // and the native side answers through window.__hsNativeShareResult(id, ok, code, detail).
  const NATIVE_SHARE_CHUNK_BYTES = 288000; // multiple of 3 -> every chunk is standalone base64 (384k chars)
  const NATIVE_SHARE_RESULT_TIMEOUT_MS = 20000;
  const SHARE_VIDEO_BASENAME = 'hue-and-seek-escape-9x16';
  const SHARE_CARD_FILENAME = 'hue-and-seek-highlight-9x16.png';
  let nativeShareSeq = 0;
  let shareTransferBusy = false;

  function getNativeShareBridge() {
    if (typeof window === 'undefined') return null;
    const bridge = window.HueSeekNativeShare;
    if (!bridge) return null;
    try {
      return typeof bridge.beginFile === 'function' && typeof bridge.appendChunk === 'function' ? bridge : null;
    } catch (_) {
      return null;
    }
  }

  // Capacitor shells (Android WebView / iOS WKWebView) silently drop blob <a download> clicks
  function isNativeAppShell() {
    try {
      return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
    } catch (_) {
      return false;
    }
  }

  function nativeSharePendingMap() {
    let hook = window.__hsNativeShareResult;
    if (typeof hook !== 'function' || !(hook.pending instanceof Map)) {
      const pending = new Map();
      hook = (id, ok, code, detail) => {
        const entry = pending.get(String(id));
        if (!entry) return;
        pending.delete(String(id));
        clearTimeout(entry.timer);
        entry.resolve({ ok: ok === true, code: String(code || ''), detail: String(detail || '') });
      };
      hook.pending = pending;
      window.__hsNativeShareResult = hook;
    }
    return hook.pending;
  }

  function awaitNativeShareResult(id) {
    const pending = nativeSharePendingMap();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, code: 'error', detail: 'No answer from the app' });
      }, NATIVE_SHARE_RESULT_TIMEOUT_MS);
      pending.set(id, { resolve, timer });
    });
  }

  function blobSliceToBase64(slice) {
    return new Promise((resolve, reject) => {
      if (typeof FileReader !== 'function') {
        reject(new Error('FileReader unavailable'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Could not read clip data'));
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
      };
      reader.readAsDataURL(slice);
    });
  }

  // Streams the Blob to the native cache file; resolves with the transfer id or throws.
  async function pushBlobToNative(bridge, blob, filename, mimeType) {
    const id = `vh${Date.now().toString(36)}_${++nativeShareSeq}`;
    const mime = String(mimeType || blob.type || '').split(';')[0].trim();
    if (!bridge.beginFile(id, filename, mime)) {
      throw new Error('The app could not create the file');
    }
    try {
      let written = 0;
      for (let offset = 0; offset < blob.size; offset += NATIVE_SHARE_CHUNK_BYTES) {
        const slice = blob.slice(offset, offset + NATIVE_SHARE_CHUNK_BYTES, 'application/octet-stream');
        written = bridge.appendChunk(id, await blobSliceToBase64(slice));
        if (!(written > 0)) throw new Error('The app could not write the file');
      }
      if (written !== blob.size) throw new Error('File transfer was incomplete');
    } catch (err) {
      try { bridge.discardFile?.(id); } catch (_) { /* ignore */ }
      throw err;
    }
    return id;
  }

  /**
   * Hands a Blob to the Android app. action 'share' opens the system share sheet; 'save' writes to
   * the gallery (Movies|Pictures/HueAndSeek, Android 10+) or opens the share sheet on older Android.
   * Resolves { ok, code: 'chooser' | 'saved' | 'error', detail } once the native side has answered.
   */
  async function deliverBlobToNative(action, blob, filename, mimeType, text = '') {
    const bridge = getNativeShareBridge();
    if (!bridge) return { ok: false, code: 'error', detail: 'Native share bridge unavailable' };
    if (!blob || !(blob.size > 0)) return { ok: false, code: 'error', detail: 'Nothing to share yet' };
    try {
      const id = await pushBlobToNative(bridge, blob, filename, mimeType);
      const answered = awaitNativeShareResult(id);
      if (action === 'save') {
        bridge.saveFile(id);
        let res = await answered;
        if (!res.ok) {
          // Gallery write failed: the file is still on the native side, offer the share sheet instead
          const retried = awaitNativeShareResult(id);
          bridge.shareFile(id, String(text || ''));
          const viaSheet = await retried;
          res = viaSheet.ok ? viaSheet : res;
        }
        return res;
      }
      bridge.shareFile(id, String(text || ''));
      return await answered;
    } catch (err) {
      return { ok: false, code: 'error', detail: String(err?.message || err || 'Transfer failed') };
    }
  }

  function triggerBrowserDownload(blob, filename) {
    if (!hasDOM || !blob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return false;
    }
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { a.remove(); } catch (_) { /* ignore */ }
        try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
      }, 4000);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Web Share API Level 2 with one file. Resolves 'shared' | 'cancelled' | 'unsupported' | 'failed'.
  async function webShareFile(blob, filename, mimeType, title, text) {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof File !== 'function') {
      return 'unsupported';
    }
    const files = [new File([blob], filename, { type: mimeType })];
    let supported = false;
    try {
      supported = typeof navigator.canShare === 'function' ? navigator.canShare({ files }) : false;
    } catch (_) {
      supported = false;
    }
    if (!supported) return 'unsupported';
    try {
      const data = { files };
      if (title) data.title = title;
      if (text) data.text = text;
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      return err && err.name === 'AbortError' ? 'cancelled' : 'failed';
    }
  }

  /**
   * Saves one highlight file (kind 'video' | 'card') to the device and reports the real outcome in a
   * toast: Android app -> gallery via the native bridge, iOS app -> share sheet ("Save Video" /
   * "Save Image"), desktop browsers -> <a download>.
   */
  async function saveHighlightMedia(blob, filename, mimeType, kind = 'video') {
    const label = kind === 'video' ? '9:16 escape video' : '9:16 cover';
    const icon = kind === 'video' ? '🎬' : '🖼️';
    if (!blob || !(blob.size > 0)) {
      showToast(`⚠️ Couldn't build the ${label} — nothing was saved.`);
      return { ok: false, method: 'none' };
    }
    if (shareTransferBusy) return { ok: false, busy: true };
    shareTransferBusy = true;
    try {
      if (getNativeShareBridge()) {
        showToast(`${icon} Saving ${label}…`, 8000);
        const res = await deliverBlobToNative('save', blob, filename, mimeType);
        if (res.ok && res.code === 'saved') {
          showToast(`${icon} Saved to ${res.detail || 'your gallery'} — ready to post!`);
        } else if (res.ok) {
          showToast(`${icon} Share sheet opened — pick where to save your ${label}.`);
        } else {
          showToast(`⚠️ Couldn't save the ${label} (${res.detail || 'unknown error'}).`, 5200);
        }
        return { ok: res.ok, method: res.ok && res.code === 'saved' ? 'native-save' : 'native-share', detail: res.detail };
      }

      if (isNativeAppShell()) {
        const outcome = await webShareFile(blob, filename, mimeType, '', '');
        if (outcome === 'shared') {
          showToast(`${icon} Done — your ${label} went through the share sheet.`);
          return { ok: true, method: 'web-share' };
        }
        if (outcome === 'cancelled') return { ok: false, cancelled: true, method: 'web-share' };
        showToast(`⚠️ Couldn't open the share sheet to save the ${label} — tap again.`, 5200);
        return { ok: false, method: 'web-share' };
      }

      if (triggerBrowserDownload(blob, filename)) {
        showToast(`${icon} Download started: ${filename}`);
        return { ok: true, method: 'download' };
      }
      showToast(`⚠️ Couldn't save the ${label} in this browser.`, 5200);
      return { ok: false, method: 'download' };
    } finally {
      shareTransferBusy = false;
    }
  }

  async function shareHighlight(opts = {}) {
    const { preferVideo = true, openPreview = false, roomCode } = opts || {};
    mountUI();

    if (openPreview === true) {
      playReplaySfx('share');
      const modalRes = await openClipPreviewModal({ roomCode });
      return {
        ok: true,
        method: 'preview-modal',
        hasVideo: modalRes.hasVideo,
        headline: modalRes.headline,
      };
    }

    playReplaySfx('share');
    const hl = computeBestHighlight();
    if (shareTransferBusy) {
      showToast('⏳ Still getting your clip ready…', 2600);
      return { ok: false, busy: true, headline: hl.headline };
    }
    shareTransferBusy = true;
    try {
      // tell the player straight away that the tap registered: the full clip can take several seconds to finish
      if (preferVideo) showToast('🎬 Getting your clip ready — a few seconds…', 20000);
      const activeRoom = resolveActiveRoomCode(roomCode);
      const shareTitle = 'Hue & Seek · Crazy Prop Hunt Escape!';
      const shareUrl = activeRoom
        ? `https://oxadow.com/hueseek/?room=${encodeURIComponent(activeRoom)}`
        : 'https://oxadow.com/hueseek/';
      const shareText = `🔥 "${hl.headline}" — Hue & Seek: Prop Hunt Online (${hl.worldTitle})${activeRoom ? ` · Join Room: ${activeRoom}` : ''} · Free & No Ads: ${shareUrl}`;

      const videoInfo = preferVideo ? await ensureVideoClipReady() : { blob: null, mimeType: '', ext: 'webm' };
      if (videoInfo.aborted) {
        // The next round started while the clip was still rendering: no share sheet over live play
        showToast('🎬 The next round started before the clip was ready — share it from the results screen.', 3200);
        return { ok: false, aborted: true, headline: hl.headline };
      }
      const hasVideo = Boolean(preferVideo && videoInfo.blob && videoInfo.blob.size > 512);
      const cardBlob = await buildVerticalShareCardBlob({ roomCode: activeRoom });

      // Video first, 9:16 PNG cover as the fallback (also the only candidate without MediaRecorder)
      const candidates = [];
      if (hasVideo) {
        candidates.push({
          blob: videoInfo.blob,
          filename: `${SHARE_VIDEO_BASENAME}.${videoInfo.ext}`,
          mimeType: String(videoInfo.mimeType || 'video/webm').split(';')[0].trim() || 'video/webm',
          isVideo: true,
        });
      }
      if (cardBlob && cardBlob.size > 0) {
        candidates.push({ blob: cardBlob, filename: SHARE_CARD_FILENAME, mimeType: 'image/png', isVideo: false });
      }
      if (!candidates.length) {
        showToast('⚠️ Couldn\'t build a clip or cover to share — try again after the replay.', 5200);
        return { ok: false, method: 'none', headline: hl.headline };
      }

      // 1. Android app: native share sheet through window.HueSeekNativeShare
      if (getNativeShareBridge()) {
        showToast('📲 Preparing your highlight…', 8000);
        let lastDetail = '';
        for (const c of candidates) {
          const res = await deliverBlobToNative('share', c.blob, c.filename, c.mimeType, shareText);
          if (res.ok) {
            showToast(c.isVideo
              ? '📲 Share sheet opened — pick an app to post your escape clip!'
              : '📲 Share sheet opened — pick an app to post your 9:16 cover!');
            return { ok: true, method: 'native-share', sharedVideo: c.isVideo, headline: hl.headline };
          }
          lastDetail = res.detail;
        }
        showToast(`⚠️ Sharing failed (${lastDetail || 'unknown error'}) — try Save instead.`, 5200);
        return { ok: false, method: 'native-share', error: lastDetail, headline: hl.headline };
      }

      // 2. Web Share API Level 2 (native share sheet on iOS / supported desktop & mobile browsers)
      let webShareFailed = false;
      for (const c of candidates) {
        const outcome = await webShareFile(c.blob, c.filename, c.mimeType, shareTitle, shareText);
        if (outcome === 'shared') {
          showToast(c.isVideo
            ? '🎬 Escape clip shared — see you in the village!'
            : '🖼️ 9:16 cover shared — see you in the village!');
          return { ok: true, method: 'web-share', sharedVideo: c.isVideo, headline: hl.headline };
        }
        if (outcome === 'cancelled') {
          return { ok: false, cancelled: true, method: 'web-share', headline: hl.headline };
        }
        if (outcome === 'failed') webShareFailed = true;
      }

      // 3. App shells cannot download blobs: say so instead of pretending a file was saved
      if (isNativeAppShell()) {
        showToast(webShareFailed
          ? '⚠️ Couldn\'t open the share sheet — tap Share again.'
          : '⚠️ Sharing files isn\'t supported on this device.', 5200);
        return { ok: false, method: 'web-share', headline: hl.headline };
      }

      // 4. Desktop / browsers without file sharing: download + caption on the clipboard
      let downloadedVideo = false;
      let downloadedCard = false;
      for (const c of candidates) {
        const started = triggerBrowserDownload(c.blob, c.filename);
        if (c.isVideo) downloadedVideo = started;
        else downloadedCard = started;
      }

      if (!downloadedVideo && !downloadedCard) {
        showToast('⚠️ Couldn\'t share or download the clip in this browser.', 5200);
        return { ok: false, method: 'download', downloadedVideo, downloadedCard, headline: hl.headline };
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareText).catch(() => {});
      }

      showToast(downloadedVideo
        ? '🎬 Download started — your 9:16 escape clip is ready for TikTok, Shorts & friends!'
        : '🖼️ Download started — your 9:16 cover is ready to post!');

      return {
        ok: true,
        method: 'download',
        downloadedVideo,
        downloadedCard,
        headline: hl.headline,
      };
    } finally {
      shareTransferBusy = false;
    }
  }

  // --------------------------------------------------------------------------
  // Post-Elimination Active Spectator Bar (#vhSpectatorBar)
  // --------------------------------------------------------------------------
  function getLivingSpectatePool() {
    const explicitLiving = spectateTargets.filter((t) => t && !t.userData?.actor?.eliminated);
    if (explicitLiving.length > 0) return explicitLiving;

    const G = env.G || {};
    const rawHiders = Array.isArray(G.allHiders) ? G.allHiders : (G.hiders || []);
    return rawHiders.filter((h) => h && h !== G.player && !h.userData?.actor?.eliminated);
  }

  function refreshSpectatorBarDOM() {
    if (!hasDOM) return;
    mountUI();
    const bar = $('vhSpectatorBar');
    if (!bar) return;

    const G = env.G || {};
    if (!spectatingActive || playingHighlight || G.over || G.phase === 'menu' || G.phase === 'end') {
      bar.classList.add('hidden');
      document.body?.classList.remove('vh-spectating-active');
      return;
    }

    const pool = getLivingSpectatePool();
    if (!pool.length) {
      spectateTarget = null;
      bar.classList.add('hidden');
      document.body?.classList.remove('vh-spectating-active');
      return;
    }

    if (!spectateTarget || !pool.includes(spectateTarget)) {
      spectateTarget = (G.specTarget && pool.includes(G.specTarget)) ? G.specTarget : pool[0];
      if (env.G) env.G.specTarget = spectateTarget;
    }

    const ident = resolveActorIdentity(spectateTarget, 'Teammate');
    const propInfo = resolvePropInfo(spectateTarget?.userData?.propId, spectateTarget, 'Spirit');
    const lbl = $('vhSpecLabel');
    if (lbl) {
      lbl.innerHTML =
        `👻 Spectating: <b>${escHtml(ident.name)}</b> ` +
        `<em>(${escHtml(propInfo.icon)} ${escHtml(propInfo.label)})</em>`;
    }

    document.body?.classList.add('vh-spectating-active');
    bar.classList.remove('hidden');
  }

  function setSpectating(active, targets = []) {
    mountUI();
    spectatingActive = Boolean(active);
    spectateTargets = Array.isArray(targets) ? targets.filter(Boolean) : [];

    if (!spectatingActive) {
      spectateTarget = null;
      refreshSpectatorBarDOM();
      return null;
    }

    const pool = getLivingSpectatePool();
    if (!pool.length) {
      spectatingActive = false;
      spectateTarget = null;
      refreshSpectatorBarDOM();
      return null;
    }

    if (!spectateTarget || !pool.includes(spectateTarget)) {
      const G = env.G || {};
      spectateTarget = (G.specTarget && pool.includes(G.specTarget)) ? G.specTarget : pool[0];
    }

    if (env.G) env.G.specTarget = spectateTarget;
    env.onSpectateTargetChange?.(spectateTarget, 0);
    refreshSpectatorBarDOM();
    return spectateTarget;
  }

  function getSpectateTarget() {
    if (!spectatingActive) return null;
    const pool = getLivingSpectatePool();
    if (!pool.length) {
      spectateTarget = null;
      return null;
    }
    if (!spectateTarget || !pool.includes(spectateTarget)) {
      spectateTarget = pool[0];
      if (env.G) env.G.specTarget = spectateTarget;
    }
    return spectateTarget;
  }

  function cycleSpectate(dir = 1) {
    const step = Number(dir) < 0 ? -1 : 1;
    const pool = getLivingSpectatePool();
    if (!pool.length) {
      spectateTarget = null;
      refreshSpectatorBarDOM();
      return null;
    }
    if (!spectatingActive) spectatingActive = true;

    const curIdx = pool.indexOf(spectateTarget);
    const baseIdx = curIdx >= 0 ? curIdx : 0;
    const nextIdx = (baseIdx + step + pool.length) % pool.length;
    spectateTarget = pool[nextIdx];

    if (env.G) env.G.specTarget = spectateTarget;
    env.audio?.tap?.();
    env.onSpectateTargetChange?.(spectateTarget, step);
    refreshSpectatorBarDOM();
    return spectateTarget;
  }

  function dispose() {
    closeClipPreviewModal();
    stopHighlightCameraInternal(false);
    stopRecording();
    setSpectating(false, []);
    if (toastHideTimer) {
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
    }
  }

  return {
    mountUI,
    onRoundStart,
    tick,
    update: tick,
    onAfterRenderFrame,
    recordJuke,
    recordEscape,
    recordTurretSnipe,
    recordClutchTag,
    computeBestHighlight,
    getBestHighlightSummary,
    captureSnapshot,
    playRoundHighlight,
    isPlayingHighlight,
    skipHighlight,
    updateHighlightCamera,
    getLatestVideoBlob,
    getLatestVideoInfo,
    ensureVideoClipReady,
    openClipPreviewModal,
    closeClipPreviewModal,
    buildVerticalShareCardBlob,
    shareHighlight,
    setSpectating,
    getSpectateTarget,
    cycleSpectate,
    stopRecording,
    dispose,
  };
}
