/* Hue & Seek — Unified PC-Parity Graphics Quality, Retina Crispness & Frame-Pacing Manager
 * - Matches Mobile & Desktop visual fidelity 1:1 out of the box (`ultra` default):
 *   * Full 16-bit HalfFloat HDR `EffectComposer` + `UnrealBloomPass` + `OutputPass` on mobile & PC
 *   * Hardware WebGL2 `RGBA16F` 4x MSAA (`samples: 4`) when supported by GPU driver
 *   * Exact PC ACES Filmic exposure (`1.08` / per-world `lt.exposure`), sun intensity,
 *     full `-42..+42` `2048x2048` `PCFSoftShadowMap` frustum (zero clipped outer shadows),
 *     and full `8,000` wind-swaying 3D grass blades
 *   * Crisp Retina DPR up to `2.5x` on high-DPI OLED phones/tablets (`[2.5, 2.0, 1.75]` in Ultra)
 * - Live 3-tier Graphics Quality Switcher (`ultra` · `high` · `battery`) persisted in `localStorage`
 *   so older devices always have a 1-tap escape hatch without sacrificing flagship visual parity.
 * - Zero-allocation rolling trimmed-mean frame-time window with 3.5s warmup/map-load grace period
 *   and single-hitch (>100ms) shader-compile immunity.
 */

const QUALITY_STORAGE_KEY = 'hs_gfx_quality_v1';
export const FPS_CAP_STORAGE_KEY = 'hs_fps_cap_v1';
const FPS_CAP_MANUAL_KEY = 'hs_fps_cap_manual_v1';
export const QUALITY_ORDER = ['ultra', 'high', 'battery'];

export const QUALITY_PRESETS = {
  ultra: {
    id: 'ultra',
    icon: '✨',
    shortLabel: '✨ Ultra',
    toastLabel: '✨ Graphics: Ultra (PC Match · HDR Bloom)',
    postProcessing: true,
    postProcessingMobile: true,
    wantMsaaSamples: 4,
    mobileMsaaSamples: 0,
    mobileDprSteps: [1.75, 1.5, 1.35],
    bloomScaleMobile: 0.55,
    bloomScaleDesktop: 1.25,
    desktopMaxDpr: 2.0,
    shadowSize: 2048,
    shadowSizeMobile: 1536,
    shadowExtent: 42,
    shadowBias: -0.0006,
    shadowNormalBias: 0.03,
    grassCount: 8000,
    grassCountMobile: 5600,
  },
  high: {
    id: 'high',
    icon: '⚡',
    shortLabel: '⚡ High',
    toastLabel: '⚡ Graphics: High (60 FPS Crisp)',
    postProcessing: true,
    postProcessingMobile: false,
    wantMsaaSamples: 0,
    mobileMsaaSamples: 0,
    mobileDprSteps: [1.5, 1.35, 1.2],
    bloomScaleMobile: 0.5,
    bloomScaleDesktop: 1.0,
    desktopMaxDpr: 2.0,
    shadowSize: 2048,
    shadowSizeMobile: 1024,
    shadowExtent: 42,
    shadowBias: -0.0007,
    shadowNormalBias: 0.032,
    grassCount: 6000,
    grassCountMobile: 3800,
  },
  battery: {
    id: 'battery',
    icon: '🔋',
    shortLabel: '🔋 Battery',
    toastLabel: '🔋 Graphics: Battery Saver',
    postProcessing: false,
    postProcessingMobile: false,
    wantMsaaSamples: 0,
    mobileMsaaSamples: 0,
    mobileDprSteps: [1.25, 1.1],
    bloomScaleMobile: 0.45,
    bloomScaleDesktop: 0.75,
    desktopMaxDpr: 1.5,
    shadowSize: 1024,
    shadowSizeMobile: 1024,
    shadowExtent: 38,
    shadowBias: -0.0006,
    shadowNormalBias: 0.028,
    grassCount: 3200,
    grassCountMobile: 2000,
  },
};

const DEFAULT_WARMUP_GRACE_SEC = 3.5;
const STEP_DOWN_WINDOW_SEC = 3.0;        // sustained 3.0s rolling window for step-down
const STEP_UP_WINDOW_SEC = 3.5;          // sustained 3.5s rolling window for step-up
const STEP_DOWN_THRESHOLD_DT = 0.0222;   // < 45 FPS (~22.2ms/frame) triggers step-down in 60 FPS mode (was 28 FPS: phones at
                                         // 30-45 FPS never adapted and kept alternating 16/33 ms frames, which reads as lag)
const STEP_UP_THRESHOLD_DT = 0.0189;     // >= 53 FPS (~18.9ms/frame) triggers step-up recovery in 60 FPS mode
const STEP_DOWN_THRESHOLD_DT_30 = 0.0465;// < 21.5 FPS (~46.5ms/frame) step-down when intentionally capped at 30 FPS!
const STEP_UP_THRESHOLD_DT_30 = 0.0355;  // >= 28.2 FPS (~35.5ms/frame) step-up recovery in 30 FPS cap mode
const MIN_STEP_DOWN_FRAMES = 24;
const MIN_STEP_UP_FRAMES = 90;
const MIN_STEP_DOWN_FRAMES_30 = 18;
const MIN_STEP_UP_FRAMES_30 = 54;
const FPS_30_MIN_INTERVAL_MS = 31.5;     // rock-steady 30 FPS frame-skip gate (< 31.5ms elapsed -> skip)
const HITCH_FRAME_DT = 0.10;             // single shader-compile / GC hitches (>100ms) are ignored
const MAX_CONSECUTIVE_IGNORED_HITCHES = 2;
const MAX_TIMER_DT = 0.25;
const STEP_COOLDOWN_SEC = 6.0;
const TRIM_FRACTION = 0.15;
const WINDOW_EPS = 1e-6;

const ACES_FILMIC_TONE_MAPPING = 4;      // THREE.ACESFilmicToneMapping

const RING_CAPACITY = 512;
const RING_MASK = RING_CAPACITY - 1;
const SHELL_GAPS = [132, 57, 23, 10, 4, 1];

export function detectMobileDevice() {
  if (typeof window === 'undefined') return false;
  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints =
    typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0;
  const w = window.innerWidth || 9999;
  const h = window.innerHeight || 9999;
  const compactPhoneViewport = Math.min(w, h) <= 540 && Math.max(w, h) <= 1000;
  const isCapacitor = Boolean(window.Capacitor);
  return Boolean(coarsePointer || hasTouchPoints || compactPhoneViewport || isCapacitor);
}

export function probeHalfFloatSupport(renderer) {
  if (!renderer || typeof renderer.getContext !== 'function') {
    return { canHalfFloat: true, maxHalfFloatSamples: 0 };
  }
  try {
    const gl = renderer.getContext();
    if (!gl || typeof gl.getExtension !== 'function') {
      return { canHalfFloat: true, maxHalfFloatSamples: 0 };
    }
    const isWebGL2 =
      Boolean(renderer.capabilities && renderer.capabilities.isWebGL2) ||
      (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext);
    const hasFloatRender = Boolean(
      gl.getExtension('EXT_color_buffer_float') ||
      gl.getExtension('EXT_color_buffer_half_float') ||
      gl.getExtension('WEBGL_color_buffer_float')
    );
    if (!hasFloatRender && !isWebGL2) {
      return { canHalfFloat: false, maxHalfFloatSamples: 0 };
    }

    let maxHalfFloatSamples = 0;
    if (
      hasFloatRender &&
      isWebGL2 &&
      typeof gl.getInternalformatParameter === 'function' &&
      gl.RENDERBUFFER &&
      gl.RGBA16F &&
      gl.SAMPLES
    ) {
      const samplesArr = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
      if (samplesArr && samplesArr.length > 0) {
        for (let i = 0; i < samplesArr.length; i++) {
          if (samplesArr[i] > maxHalfFloatSamples) {
            maxHalfFloatSamples = samplesArr[i];
          }
        }
      }
    }
    return {
      canHalfFloat: hasFloatRender,
      maxHalfFloatSamples: Math.min(4, maxHalfFloatSamples),
    };
  } catch (_) {
    return { canHalfFloat: true, maxHalfFloatSamples: 0 };
  }
}

function readStoredQuality(defaultTier = 'ultra') {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(QUALITY_STORAGE_KEY);
      if (raw && QUALITY_PRESETS[raw]) return raw;
    }
  } catch (_) {
    // Ignore storage access errors in private/sandboxed contexts
  }
  return defaultTier;
}

function writeStoredQuality(tier) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(QUALITY_STORAGE_KEY, tier);
    }
  } catch (_) {
    // Ignore storage quota / privacy errors
  }
}

function readStoredFpsCap(defaultFps = 60) {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(FPS_CAP_STORAGE_KEY);
      if (raw === '30' || raw === '60') return Number(raw);
    }
  } catch (_) {
    // Ignore storage access errors
  }
  return defaultFps === 30 ? 30 : 60;
}

function writeStoredFpsCap(fps) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FPS_CAP_STORAGE_KEY, String(fps === 30 ? 30 : 60));
    }
  } catch (_) {
    // Ignore storage quota / privacy errors
  }
}

function readStoredManualFpsFlag() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(FPS_CAP_MANUAL_KEY) === '1';
    }
  } catch (_) {
    // Ignore storage access errors
  }
  return false;
}

function writeStoredManualFpsFlag(isManual) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FPS_CAP_MANUAL_KEY, isManual ? '1' : '0');
    }
  } catch (_) {
    // Ignore storage quota / privacy errors
  }
}

function resolveNativeDpr(env, mobileFallback) {
  if (env && Number.isFinite(Number(env.devicePixelRatio)) && Number(env.devicePixelRatio) > 0) {
    return Number(env.devicePixelRatio);
  }
  if (typeof window !== 'undefined') {
    const dpr = Number(window.devicePixelRatio);
    if (Number.isFinite(dpr) && dpr > 0) return dpr;
  }
  if (typeof globalThis !== 'undefined') {
    const dpr = Number(globalThis.devicePixelRatio);
    if (Number.isFinite(dpr) && dpr > 0) return dpr;
  }
  return mobileFallback ? 2.0 : 1;
}

function getViewportWidth() {
  return (typeof window !== 'undefined' && window.innerWidth) || 1;
}

function getViewportHeight() {
  return (typeof window !== 'undefined' && window.innerHeight) || 1;
}

function buildEffectiveMobileLadder(nativeDpr, steps) {
  const stepList = Array.isArray(steps) && steps.length > 0 ? steps : [2.5, 2.0, 1.75];
  const top = Math.min(nativeDpr, stepList[0]);
  const floor = Math.min(nativeDpr, stepList[stepList.length - 1]);
  const ladder = [top];
  for (let i = 0; i < stepList.length; i++) {
    const step = stepList[i];
    if (step < top - 0.01 && step > floor + 0.01) {
      ladder.push(step);
    }
  }
  if (floor < top - 0.01) {
    ladder.push(floor);
  }
  return ladder;
}

function clampShadowSizeForHardware(desiredSize, renderer, env) {
  let maxTexRaw =
    env && typeof env.maxTextureSize === 'number'
      ? env.maxTextureSize
      : renderer && renderer.capabilities
        ? Number(renderer.capabilities.maxTextureSize)
        : NaN;
  if (!(Number.isFinite(maxTexRaw) && maxTexRaw > 0) && renderer && typeof renderer.getContext === 'function') {
    try {
      const gl = renderer.getContext();
      if (gl && typeof gl.getParameter === 'function' && gl.MAX_TEXTURE_SIZE) {
        maxTexRaw = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
      }
    } catch (_) {
      // Ignore context query errors in headless/mocked environments
    }
  }
  if (Number.isFinite(maxTexRaw) && maxTexRaw > 0 && maxTexRaw < desiredSize) {
    return Math.max(1024, Math.min(desiredSize, maxTexRaw));
  }
  return desiredSize;
}

function sortFloat64Prefix(buf, n) {
  for (let g = 0; g < SHELL_GAPS.length; g++) {
    const gap = SHELL_GAPS[g];
    for (let i = gap; i < n; i++) {
      const temp = buf[i];
      let j = i;
      while (j >= gap && buf[j - gap] > temp) {
        buf[j] = buf[j - gap];
        j -= gap;
      }
      buf[j] = temp;
    }
  }
}

export function createMobilePerfManager(env = {}) {
  let isMobile = typeof env.isMobile === 'boolean' ? env.isMobile : detectMobileDevice();
  const gpuCaps = probeHalfFloatSupport(env.renderer);

  let qualityTier =
    env.initialQuality && QUALITY_PRESETS[env.initialQuality]
      ? env.initialQuality
      : readStoredQuality(isMobile ? 'high' : 'ultra');

  let manualFpsOverride = readStoredManualFpsFlag();
  let fpsCap =
    env.initialFpsCap === 30 || env.initialFpsCap === 60
      ? env.initialFpsCap
      : readStoredFpsCap(qualityTier === 'battery' ? 30 : 60);

  const qualityListeners = new Set();
  const fpsCapListeners = new Set();

  // Adaptive "Lite" steps, entered only when a phone keeps dropping frames after its pixel-ratio ladder is
  // used up (the look stays untouched on phones that run smoothly):
  //   1 = shadows refreshed every 3rd frame, no bloom, no real Lantern Dusk lights, grass ignores shadows
  //   2 = also an automatic (not saved) 30 FPS cap, so frames are evenly paced instead of 16/33 ms jitter
  // Level 1 is left again when the phone recovers; level 2 lasts until the next map load.
  let liteLevel = 0;
  let autoFpsCapped = false;
  const liteListeners = new Set();
  function setLiteLevel(level) {
    const next = Math.max(0, Math.min(2, level | 0));
    if (next === liteLevel) return;
    liteLevel = next;
    if (liteLevel >= 2 && fpsCap !== 30 && !manualFpsOverride) {
      autoFpsCapped = true;
      setFpsCap(30, { manual: false, persist: false });
    } else if (liteLevel < 2 && autoFpsCapped) {
      autoFpsCapped = false;
      setFpsCap(60, { manual: false, persist: false });
    }
    liteListeners.forEach((fn) => { try { fn(liteLevel); } catch (_) {} });
  }

  let nativeDpr = resolveNativeDpr(env, isMobile);
  let mobileLadder = buildEffectiveMobileLadder(nativeDpr, QUALITY_PRESETS[qualityTier].mobileDprSteps);
  let maxTargetDpr = isMobile
    ? mobileLadder[0]
    : Math.min(nativeDpr, QUALITY_PRESETS[qualityTier].desktopMaxDpr);
  let minTargetDpr = isMobile ? mobileLadder[mobileLadder.length - 1] : maxTargetDpr;

  let currentDpr =
    env.renderer && typeof env.renderer.getPixelRatio === 'function'
      ? env.renderer.getPixelRatio()
      : maxTargetDpr;

  // Pre-allocated buffers for zero-allocation rolling frame-time analysis
  const dtRing = new Float64Array(RING_CAPACITY);
  const scratchSort = new Float64Array(RING_CAPACITY);
  const windowStats = { accSec: 0, count: 0, trimmedAvgDt: 0 };

  let ringHead = 0;
  let ringTail = 0;
  let ringCount = 0;
  let windowDtSum = 0;
  let warmupGraceSec = 0;
  let cooldownSec = 0;
  let consecutiveHitches = 0;
  let avgFps = fpsCap === 30 ? 30 : 60;
  let lastPacedNow = NaN;
  let lastSkipFrameRenderedMs = NaN;
  let lastSkipProbeNow = NaN;
  let lastSkipProbeResult = false;
  let shadowFrameTick = 0;
  let shadowWarmupFrames = 4;
  let fpsToastTimer = 0;

  function getPreset() {
    return QUALITY_PRESETS[qualityTier] || QUALITY_PRESETS.ultra;
  }

  function isPostProcessingEnabled() {
    const preset = getPreset();
    const allowPost = (isMobile && typeof preset.postProcessingMobile === 'boolean')
      ? preset.postProcessingMobile
      : preset.postProcessing;
    return Boolean(allowPost && gpuCaps.canHalfFloat && env.composer && !(isMobile && liteLevel >= 1));
  }

  function getEffectiveMsaaSamples() {
    const preset = getPreset();
    if (!preset.postProcessing || !gpuCaps.canHalfFloat) return 0;
    const want = isMobile ? (preset.mobileMsaaSamples ?? 0) : (preset.wantMsaaSamples || 0);
    return Math.min(want, gpuCaps.maxHalfFloatSamples || 0);
  }

  function getTargetGrassCount() {
    const p = getPreset();
    return (isMobile && typeof p.grassCountMobile === 'number') ? p.grassCountMobile : p.grassCount;
  }

  function refreshDprBounds() {
    const preset = getPreset();
    nativeDpr = resolveNativeDpr(env, isMobile);
    mobileLadder = buildEffectiveMobileLadder(nativeDpr, preset.mobileDprSteps);
    maxTargetDpr = isMobile ? mobileLadder[0] : Math.min(nativeDpr, preset.desktopMaxDpr);
    minTargetDpr = isMobile ? mobileLadder[mobileLadder.length - 1] : maxTargetDpr;
  }

  function resetRollingWindow() {
    ringHead = 0;
    ringTail = 0;
    ringCount = 0;
    windowDtSum = 0;
    consecutiveHitches = 0;
  }

  function syncComposerSamples() {
    const composer = env.composer;
    if (!composer) return;
    const targetSamples = getEffectiveMsaaSamples();
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
      if (rt && typeof rt.samples === 'number' && rt.samples !== targetSamples) {
        rt.samples = targetSamples;
        if (typeof rt.dispose === 'function') {
          rt.dispose();
        }
      }
    }
  }

  function applyDprAndResize(nextDpr) {
    const clampedDpr = isMobile
      ? Math.max(minTargetDpr, Math.min(maxTargetDpr, nextDpr))
      : Math.min(maxTargetDpr, nextDpr);
    currentDpr = Math.round(clampedDpr * 1000) / 1000;

    const renderer = env.renderer;
    const composer = env.composer;
    const outlinePass = env.outlinePass;
    const w = getViewportWidth();
    const h = getViewportHeight();

    if (renderer) {
      if (typeof renderer.setPixelRatio === 'function') {
        renderer.setPixelRatio(currentDpr);
      }
      if (typeof renderer.setSize === 'function') {
        renderer.setSize(w, h);
      }
    }

    if (composer) {
      syncComposerSamples();
      if (typeof composer.setPixelRatio === 'function') {
        composer.setPixelRatio(currentDpr);
      }
      if (typeof composer.setSize === 'function') {
        composer.setSize(w, h);
      }
      // Keep UnrealBloomPass internal blur mips at tile-friendly resolution instead of 2.5x DPR supersampling
      if (env.bloomPass && typeof env.bloomPass.setSize === 'function') {
        const preset = getPreset();
        const bScale = isMobile ? (preset.bloomScaleMobile ?? 0.85) : (preset.bloomScaleDesktop ?? 1.25);
        env.bloomPass.setSize(
          Math.max(128, Math.round(w * bScale)),
          Math.max(128, Math.round(h * bScale))
        );
      }
    }

    if (
      outlinePass &&
      outlinePass.uniforms &&
      outlinePass.uniforms.res &&
      outlinePass.uniforms.res.value &&
      typeof outlinePass.uniforms.res.value.set === 'function'
    ) {
      outlinePass.uniforms.res.value.set(w * currentDpr, h * currentDpr);
    }
  }

  function applyShadowAndToneParity() {
    const preset = getPreset();
    const renderer = env.renderer;
    const sun = env.sun;

    if (renderer) {
      renderer.toneMapping = ACES_FILMIC_TONE_MAPPING;
    }

    if (sun && sun.shadow) {
      const targetShadow = (isMobile && preset.shadowSizeMobile) ? preset.shadowSizeMobile : preset.shadowSize;
      const shadowSize = clampShadowSizeForHardware(targetShadow, renderer, env);
      const currentW = sun.shadow.mapSize ? sun.shadow.mapSize.x || sun.shadow.mapSize.width : 0;
      const currentH = sun.shadow.mapSize ? sun.shadow.mapSize.y || sun.shadow.mapSize.height : 0;
      const sizeChanged = currentW !== shadowSize || currentH !== shadowSize;

      if (sun.shadow.mapSize && typeof sun.shadow.mapSize.set === 'function') {
        sun.shadow.mapSize.set(shadowSize, shadowSize);
      }

      if (sun.shadow.camera) {
        const ext = preset.shadowExtent;
        sun.shadow.camera.left = -ext;
        sun.shadow.camera.right = ext;
        sun.shadow.camera.top = ext;
        sun.shadow.camera.bottom = -ext;
        if (typeof sun.shadow.camera.updateProjectionMatrix === 'function') {
          sun.shadow.camera.updateProjectionMatrix();
        }
      }

      sun.shadow.bias = preset.shadowBias;
      sun.shadow.normalBias = preset.shadowNormalBias;

      if (sizeChanged && sun.shadow.map) {
        if (typeof sun.shadow.map.dispose === 'function') {
          sun.shadow.map.dispose();
        }
        sun.shadow.map = null;
        if (sun.shadow.mapPass && typeof sun.shadow.mapPass.dispose === 'function') {
          sun.shadow.mapPass.dispose();
          sun.shadow.mapPass = null;
        }
      }
      sun.shadow.needsUpdate = true;
      shadowWarmupFrames = Math.max(shadowWarmupFrames, 4);
    }

    if (typeof env.onGrassCount === 'function') {
      const targetGrass = (isMobile && preset.grassCountMobile) ? preset.grassCountMobile : preset.grassCount;
      env.onGrassCount(targetGrass);
    }
  }

  function showFpsToast(msg) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('gfxToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    if (fpsToastTimer) clearTimeout(fpsToastTimer);
    fpsToastTimer = setTimeout(() => el.classList.remove('on'), 1800);
  }

  function syncFpsPillDOM() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const shortLbl = fpsCap === 30 ? '🔋 30 FPS' : '⚡ 60 FPS';
    const compactLbl = fpsCap === 30 ? '🔋 30' : '⚡ 60';
    for (const id of ['btnFpsCap', 'btnTitleFpsCap']) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.dataset.fps = String(fpsCap);
      btn.dataset.compactLabel = compactLbl;
      btn.setAttribute(
        'aria-label',
        fpsCap === 30 ? 'Frame rate capped at 30 FPS (Battery Saver)' : 'Frame rate set to 60 FPS'
      );
      btn.setAttribute('aria-pressed', fpsCap === 30 ? 'true' : 'false');
      if (btn.textContent !== shortLbl) {
        btn.textContent = shortLbl;
      }
      if (btn.dataset.fpsWired !== '1') {
        btn.dataset.fpsWired = '1';
        btn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          const next = toggleFpsCap();
          try {
            globalThis.__hsHaptics?.tap?.();
          } catch (_) {
            // Ignore haptics errors
          }
          showFpsToast(
            next === 30
              ? '🔋 30 FPS Battery Saver (Cool & Steady)'
              : '⚡ 60 FPS Smooth Gameplay'
          );
        });
      }
    }
  }

  /**
   * Ensures an explicit `#btnFpsCap` pill exists right beside `#btnQuality` in `#hud`
   * (and `#btnTitleFpsCap` beside `#btnTitleQuality` on desktop Lobby) if not already in HTML.
   */
  function mountFpsPill() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    if (typeof document.createElement !== 'function') return;

    const hud = document.getElementById('hud');
    const btnQual = document.getElementById('btnQuality');
    if (hud && btnQual && !document.getElementById('btnFpsCap')) {
      const pill = document.createElement('button');
      pill.id = 'btnFpsCap';
      pill.type = 'button';
      pill.className = 'gfx-pill hud-fps-pill';
      if (btnQual.nextSibling) {
        hud.insertBefore(pill, btnQual.nextSibling);
      } else {
        hud.appendChild(pill);
      }
    }

    const title = document.getElementById('title');
    const btnTitleQual = document.getElementById('btnTitleQuality');
    if (title && btnTitleQual && !document.getElementById('btnTitleFpsCap')) {
      const pill = document.createElement('button');
      pill.id = 'btnTitleFpsCap';
      pill.type = 'button';
      pill.className = 'gfx-pill title-fps-pill';
      if (btnTitleQual.nextSibling) {
        title.insertBefore(pill, btnTitleQual.nextSibling);
      } else {
        title.appendChild(pill);
      }
    }

    syncFpsPillDOM();
  }

  function emitQualityChange() {
    syncFpsPillDOM();
    const meta = getQualityMeta();
    qualityListeners.forEach((fn) => {
      try {
        fn(meta);
      } catch (_) {
        // Ignore listener errors
      }
    });
  }

  function emitFpsCapChange() {
    syncFpsPillDOM();
    fpsCapListeners.forEach((fn) => {
      try {
        fn(fpsCap);
      } catch (_) {
        // Ignore listener errors
      }
    });
    emitQualityChange();
  }

  function getFpsCap() {
    return fpsCap;
  }

  function setFpsCap(fps, opts = {}) {
    const resolved = Number(fps) === 30 ? 30 : 60;
    const isManual = opts && typeof opts.manual === 'boolean' ? opts.manual : true;
    const persist = opts && typeof opts.persist === 'boolean' ? opts.persist : true;

    fpsCap = resolved;
    lastSkipFrameRenderedMs = NaN;
    lastSkipProbeNow = NaN;
    lastPacedNow = NaN;
    resetRollingWindow();
    warmupGraceSec = Math.max(warmupGraceSec, 1.5);

    if (isManual) {
      manualFpsOverride = true;
      if (persist) writeStoredManualFpsFlag(true);
    }
    if (persist) {
      writeStoredFpsCap(fpsCap);
    }
    emitFpsCapChange();
    return fpsCap;
  }

  function toggleFpsCap() {
    return setFpsCap(fpsCap === 30 ? 60 : 30, { manual: true, persist: true });
  }

  function onFpsCapChange(fn) {
    if (typeof fn === 'function') {
      fpsCapListeners.add(fn);
    }
    return () => fpsCapListeners.delete(fn);
  }

  function setQuality(nextTier, persist = true) {
    const resolved = QUALITY_PRESETS[nextTier] ? nextTier : 'ultra';
    qualityTier = resolved;
    if (persist) {
      writeStoredQuality(qualityTier);
    }
    // Automatically pair `battery` preset with 30 FPS unless user manually chose an FPS cap!
    if (!manualFpsOverride) {
      const autoFps = qualityTier === 'battery' ? 30 : 60;
      if (fpsCap !== autoFps) {
        fpsCap = autoFps;
        lastSkipFrameRenderedMs = NaN;
        lastSkipProbeNow = NaN;
        lastPacedNow = NaN;
        if (persist) writeStoredFpsCap(fpsCap);
        fpsCapListeners.forEach((fn) => {
          try { fn(fpsCap); } catch (_) { /* ignore */ }
        });
      }
    }
    refreshDprBounds();
    applyDprAndResize(maxTargetDpr);
    applyShadowAndToneParity();
    resetRollingWindow();
    warmupGraceSec = 2.0;
    cooldownSec = 0;
    emitQualityChange();
    return getQualityMeta();
  }

  function cycleQuality() {
    const idx = QUALITY_ORDER.indexOf(qualityTier);
    const nextTier = QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length];
    return setQuality(nextTier, true);
  }

  function getQuality() {
    return qualityTier;
  }

  function getQualityMeta() {
    const p = getPreset();
    return {
      id: p.id,
      icon: p.icon,
      shortLabel: p.shortLabel,
      toastLabel: p.toastLabel,
      postProcessing: isPostProcessingEnabled(),
      msaaSamples: getEffectiveMsaaSamples(),
      currentDpr,
      maxTargetDpr,
      grassCount: getTargetGrassCount(),
      shadowSize: p.shadowSize,
      fpsCap,
    };
  }

  function onQualityChange(fn) {
    if (typeof fn === 'function') {
      qualityListeners.add(fn);
    }
    return () => qualityListeners.delete(fn);
  }

  function handleResize() {
    refreshDprBounds();
    applyDprAndResize(Math.min(maxTargetDpr, Math.max(minTargetDpr, currentDpr || maxTargetDpr)));
  }

  function nextLowerMobileDpr(dpr) {
    for (let i = 0; i < mobileLadder.length; i++) {
      const candidate = mobileLadder[i];
      if (candidate < dpr - 0.01 && candidate >= minTargetDpr - 0.001) {
        return candidate;
      }
    }
    return null;
  }

  function nextHigherMobileDpr(dpr) {
    for (let i = mobileLadder.length - 1; i >= 0; i--) {
      const candidate = mobileLadder[i];
      if (candidate > dpr + 0.01 && candidate <= maxTargetDpr + 0.001) {
        return candidate;
      }
    }
    return null;
  }

  function computeRecentTrimmedStats(targetSec) {
    if (ringCount === 0) return null;
    let accSec = 0;
    let count = 0;
    let idx = (ringHead - 1) & RING_MASK;

    while (count < ringCount) {
      const d = dtRing[idx];
      scratchSort[count] = d;
      accSec += d;
      count++;
      if (accSec + WINDOW_EPS >= targetSec) break;
      idx = (idx - 1) & RING_MASK;
    }

    sortFloat64Prefix(scratchSort, count);
    const trim = count >= 7 ? Math.floor(count * TRIM_FRACTION) : 0;
    const start = trim;
    const end = count - trim;
    let trimmedSum = 0;
    for (let i = start; i < end; i++) {
      trimmedSum += scratchSort[i];
    }

    windowStats.accSec = accSec;
    windowStats.count = count;
    windowStats.trimmedAvgDt = trimmedSum / (end - start);
    return windowStats;
  }

  function applyInitialTuning() {
    if (typeof env.isMobile !== 'boolean') {
      isMobile = detectMobileDevice();
    }

    refreshDprBounds();
    applyDprAndResize(maxTargetDpr);
    applyShadowAndToneParity();
    mountFpsPill();

    resetRollingWindow();
    warmupGraceSec = DEFAULT_WARMUP_GRACE_SEC;
    cooldownSec = 0;
    avgFps = fpsCap === 30 ? 30 : 60;
    emitQualityChange();
    return getStats();
  }

  function notifyMapLoad(graceSec = DEFAULT_WARMUP_GRACE_SEC) {
    const parsed = Number(graceSec);
    warmupGraceSec = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_WARMUP_GRACE_SEC;
    shadowWarmupFrames = 6;
    if (liteLevel >= 2) setLiteLevel(1);   // a new map gets a fresh chance at 60 FPS
    resetRollingWindow();
    applyShadowAndToneParity();
    return getStats();
  }

  /**
   * 30 FPS Battery-Saver frame-skip gate:
   * Returns `true` when `fpsCap === 30` and `< 31.5ms` has elapsed since the last rendered frame.
   * Idempotent for identical `nowMs` so calling both `shouldSkipFrame(now)` and `shouldRenderFrame(now)`
   * in the same RAF callback is 100% safe!
   */
  function shouldSkipFrame(nowMs) {
    if (!Number.isFinite(nowMs)) return false;
    if (fpsCap !== 30) {
      lastSkipFrameRenderedMs = nowMs;
      lastSkipProbeNow = nowMs;
      lastSkipProbeResult = false;
      return false;
    }
    if (nowMs === lastSkipProbeNow) {
      return lastSkipProbeResult;
    }
    lastSkipProbeNow = nowMs;

    if (
      !Number.isFinite(lastSkipFrameRenderedMs) ||
      nowMs < lastSkipFrameRenderedMs ||
      nowMs - lastSkipFrameRenderedMs > 250
    ) {
      lastSkipFrameRenderedMs = nowMs;
      lastSkipProbeResult = false;
      return false;
    }

    const elapsed = nowMs - lastSkipFrameRenderedMs;
    if (elapsed < FPS_30_MIN_INTERVAL_MS) {
      lastSkipProbeResult = true;
      return true;
    }

    // Preserve steady 33.33ms cadence without phase drift on 60Hz / 120Hz panels
    const rem = elapsed - 33.333;
    lastSkipFrameRenderedMs = rem >= 0 && rem < 16.0 ? nowMs - Math.min(rem, 4.0) : nowMs;
    lastSkipProbeResult = false;
    return false;
  }

  /**
   * VSync-aligned frame pacer for 120Hz/90Hz LTPO mobile displays (e.g. Galaxy S23 Ultra):
   * - Explicit 30 FPS cap (`fpsCap === 30`): rock-steady 30 FPS on both mobile & desktop!
   * - Desktop (`fpsCap === 60`): uncapped native refresh rate.
   * - Mobile Gameplay (`fpsCap === 60`): locked 60 FPS (every 2nd VSync on 120Hz = 16.67ms).
   * - Mobile Idle Menu: cool 30 FPS so phone temperature drops between rounds.
   */
  function shouldRenderFrame(rawNow, isMenu = false) {
    if (!Number.isFinite(rawNow)) return true;
    if (fpsCap === 30) {
      return !shouldSkipFrame(rawNow);
    }
    if (!isMobile) return true;
    if (!Number.isFinite(lastPacedNow) || rawNow < lastPacedNow || rawNow - lastPacedNow > 250) {
      lastPacedNow = rawNow;
      return true;
    }
    const elapsed = rawNow - lastPacedNow;
    const targetMs = isMenu ? 33.333 : 16.667;
    const tolMs = isMenu ? 29.0 : 14.0;
    if (elapsed < tolMs) return false;
    const rem = elapsed - targetMs;
    lastPacedNow = (rem >= 0 && rem < targetMs) ? (rawNow - Math.min(rem, 4.5)) : rawNow;
    return true;
  }

  /**
   * Smart directional shadow-map refresh cadence:
   * - Immediate refresh during warmup frames right after map load / quality switch.
   * - Desktop: 60Hz in gameplay, 30Hz in idle menu.
   * - Mobile: 30Hz in gameplay (sun is static; soft PCFcharacter shadows look 100% identical), ~8Hz in menu.
   */
  function shouldUpdateShadow(isMenu = false) {
    if (shadowWarmupFrames > 0) {
      shadowWarmupFrames--;
      return true;
    }
    shadowFrameTick = (shadowFrameTick + 1) & 0x3fff;
    if (!isMobile) {
      return isMenu ? (shadowFrameTick % 2 === 0) : true;
    }
    if (fpsCap === 30) {
      return isMenu ? (shadowFrameTick % 4 === 0) : (liteLevel >= 1 ? shadowFrameTick % 2 === 0 : true);
    }
    return isMenu ? (shadowFrameTick % 4 === 0) : (shadowFrameTick % (liteLevel >= 1 ? 3 : 2) === 0);
  }

  function update(dt, isMenu = false) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    if (isMenu && isMobile) return;

    const timerDt = dt > MAX_TIMER_DT ? MAX_TIMER_DT : dt;

    if (cooldownSec > 0) {
      cooldownSec -= timerDt;
      if (cooldownSec < 0) cooldownSec = 0;
    }

    if (warmupGraceSec > 0) {
      warmupGraceSec -= timerDt;
      if (warmupGraceSec < 0) warmupGraceSec = 0;
      return;
    }

    let sampleDt = dt;
    if (dt > HITCH_FRAME_DT) {
      consecutiveHitches++;
      if (consecutiveHitches <= MAX_CONSECUTIVE_IGNORED_HITCHES) {
        return;
      }
      sampleDt = HITCH_FRAME_DT;
    } else {
      consecutiveHitches = 0;
    }

    if (ringCount === RING_CAPACITY) {
      windowDtSum -= dtRing[ringTail];
      ringTail = (ringTail + 1) & RING_MASK;
      ringCount--;
    }

    dtRing[ringHead] = sampleDt;
    ringHead = (ringHead + 1) & RING_MASK;
    windowDtSum += sampleDt;
    ringCount++;

    while (ringCount > 1 && windowDtSum - dtRing[ringTail] >= STEP_UP_WINDOW_SEC) {
      windowDtSum -= dtRing[ringTail];
      ringTail = (ringTail + 1) & RING_MASK;
      ringCount--;
    }

    const fullStats = computeRecentTrimmedStats(STEP_UP_WINDOW_SEC);
    if (fullStats && fullStats.trimmedAvgDt > 0) {
      avgFps = Math.round((1 / fullStats.trimmedAvgDt) * 10) / 10;
    }

    if (!isMobile || cooldownSec > 0) return;

    // Scale thresholds when intentionally capped at 30 FPS so 30 FPS (~33.3ms) NEVER triggers < 28 FPS step-down!
    const downThreshDt = fpsCap === 30 ? STEP_DOWN_THRESHOLD_DT_30 : STEP_DOWN_THRESHOLD_DT;
    const minDownFrames = fpsCap === 30 ? MIN_STEP_DOWN_FRAMES_30 : MIN_STEP_DOWN_FRAMES;
    const upThreshDt = fpsCap === 30 ? STEP_UP_THRESHOLD_DT_30 : STEP_UP_THRESHOLD_DT;
    const minUpFrames = fpsCap === 30 ? MIN_STEP_UP_FRAMES_30 : MIN_STEP_UP_FRAMES;

    // 1. Conservative Step-Down: sustained 3.0s trimmed-average below threshold (<28 FPS in 60-cap, <21.5 FPS in 30-cap)
    const downStats = computeRecentTrimmedStats(STEP_DOWN_WINDOW_SEC);
    if (
      downStats &&
      downStats.accSec + WINDOW_EPS >= STEP_DOWN_WINDOW_SEC &&
      downStats.count >= minDownFrames &&
      downStats.trimmedAvgDt > downThreshDt
    ) {
      const lowerDpr = nextLowerMobileDpr(currentDpr);
      if (lowerDpr !== null) {
        applyDprAndResize(lowerDpr);
        cooldownSec = STEP_COOLDOWN_SEC;
        resetRollingWindow();
      } else if (liteLevel < 2) {
        setLiteLevel(liteLevel + 1);
        cooldownSec = STEP_COOLDOWN_SEC;
        resetRollingWindow();
      }
      return;
    }

    // 1b. Leave Lite level 1 first when the phone has recovered (level 2's 30 FPS cap stays until map load)
    if (liteLevel === 1) {
      const upStats = computeRecentTrimmedStats(STEP_UP_WINDOW_SEC);
      if (upStats && upStats.accSec + WINDOW_EPS >= STEP_UP_WINDOW_SEC && upStats.count >= minUpFrames && upStats.trimmedAvgDt <= upThreshDt) {
        setLiteLevel(0);
        cooldownSec = STEP_COOLDOWN_SEC;
        resetRollingWindow();
        return;
      }
    }

    // 2. Automatic Step-Up Recovery: sustained 3.5s trimmed-average hitting target cap cleanly
    if (currentDpr < maxTargetDpr - 0.005) {
      const upStats = computeRecentTrimmedStats(STEP_UP_WINDOW_SEC);
      if (
        upStats &&
        upStats.accSec + WINDOW_EPS >= STEP_UP_WINDOW_SEC &&
        upStats.count >= minUpFrames &&
        upStats.trimmedAvgDt <= upThreshDt
      ) {
        const higherDpr = nextHigherMobileDpr(currentDpr);
        if (higherDpr !== null) {
          applyDprAndResize(higherDpr);
          cooldownSec = STEP_COOLDOWN_SEC;
          resetRollingWindow();
        }
      }
    }
  }

  function getStats() {
    return {
      isMobile,
      quality: qualityTier,
      fpsCap,
      postProcessing: isPostProcessingEnabled(),
      msaaSamples: getEffectiveMsaaSamples(),
      currentDpr,
      maxTargetDpr,
      grassCount: getTargetGrassCount(),
      avgFps,
      liteLevel,
    };
  }

  const api = {
    get isMobile() {
      return isMobile;
    },
    applyInitialTuning,
    notifyMapLoad,
    update,
    handleResize,
    getQuality,
    getTier: getQuality,
    getQualityMeta,
    setQuality,
    cycleQuality,
    getFpsCap,
    setFpsCap,
    toggleFpsCap,
    onFpsCapChange,
    mountFpsPill,
    syncFpsPillDOM,
    isPostProcessingEnabled,
    getTargetGrassCount,
    shouldSkipFrame,
    shouldRenderFrame,
    shouldUpdateShadow,
    onQualityChange,
    getStats,
    getLiteLevel: () => liteLevel,
    setLiteLevel,
    onLiteChange: (fn) => { liteListeners.add(fn); return () => liteListeners.delete(fn); },
  };

  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.__hsMobilePerf = api;
    }
  } catch (_) {
    // Ignore read-only globalThis
  }

  return api;
}
