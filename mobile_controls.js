/* ==========================================================================
 * Hue & Seek — Native Phone Touch Controls, Fair Aim Magnetism, Gyroscope
 * Tilt-Aim, Quick-Settings Popover & Haptics Ergonomics (mobile_controls.js)
 * Storybook 3D Prop-Hunt Mobile Port (iOS & Android Landscape Twin-Thumb)
 * ========================================================================== */

import { haptics as sharedHaptics } from './haptics.js?v=1';

export const GYRO_STORAGE_KEY = 'hs_gyro_aim_v1';
export const SENS_STORAGE_KEY = 'hs_touch_sens_v1';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const DEG2RAD = Math.PI / 180;

const ACTION_LOOK_DEADZONE_PX = 8;
const TOUCH_YAW_SENS = 0.0052;
const TOUCH_PITCH_SENS = 0.0038;

function readStoredTouchSens(defaultVal = 1.0) {
  try {
    if (typeof localStorage !== 'undefined') {
      const n = parseFloat(localStorage.getItem(SENS_STORAGE_KEY) || '');
      if (Number.isFinite(n) && n >= 0.45 && n <= 2.0) return n;
    }
  } catch (_) { /* ignore */ }
  return defaultVal;
}

function writeStoredTouchSens(val) {
  const clean = clamp(Number(val) || 1.0, 0.5, 1.8);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SENS_STORAGE_KEY, clean.toFixed(2));
    }
  } catch (_) { /* ignore */ }
  return clean;
}

// Gentle, Fair Seeker Aim Magnetism Constants
const AIM_ASSIST_MAX_DIST = 26.0;                 // 26m maximum range
const AIM_ASSIST_CONE_RAD = 0.1134464;            // 6.5 deg (0.113 rad) half-angle cone
const AIM_ASSIST_CONE_MIN_DOT = Math.cos(AIM_ASSIST_CONE_RAD); // ~0.99357
const AIM_ASSIST_MIN_MOVE_SPD = 0.55;             // ONLY moving > 0.55 m/s
const AIM_ASSIST_MIN_AIRBORNE_Y = 0.5;            // OR airborne > 0.5m
const AIM_ASSIST_FRICTION_MUL = 0.72;             // 0.72x gentle reticle drag damping
const AIM_ASSIST_MAX_PULL_RAD_S = 2.4;            // Soft rotational pull up to 2.4 rad/s

// Gyroscope Fine-Aim Constants
const GYRO_DEADZONE_DEG = 0.08;                   // 0.08 deg micro-tremor deadzone
const GYRO_MAX_SAMPLE_STEP_DEG = 4.5;             // Smooth per-event clamp
const GYRO_SPIKE_REJECT_DEG = 14.0;               // Gimbal-wrap spike guard
const GYRO_YAW_SENS = 1.35;                       // Responsive fine-aim yaw multiplier
const GYRO_PITCH_SENS = 1.15;                     // Responsive fine-aim pitch multiplier

function shortestAngleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function wrapDegDelta(deg) {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function readStoredGyroEnabled(defaultVal = false) {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(GYRO_STORAGE_KEY);
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
    }
  } catch (_) {
    // Ignore private-mode storage errors
  }
  return Boolean(defaultVal);
}

function writeStoredGyroEnabled(val) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GYRO_STORAGE_KEY, val ? '1' : '0');
    }
  } catch (_) {
    // Ignore storage quota / sandboxed errors
  }
}

function getScreenOrientationAngle() {
  try {
    if (
      typeof screen !== 'undefined' &&
      screen.orientation &&
      typeof screen.orientation.angle === 'number'
    ) {
      return ((Math.round(screen.orientation.angle) % 360) + 360) % 360;
    }
    if (typeof window !== 'undefined' && typeof window.orientation === 'number') {
      return ((Math.round(window.orientation) % 360) + 360) % 360;
    }
  } catch (_) {
    // Ignore orientation read errors
  }
  if (typeof window !== 'undefined' && (window.innerWidth || 0) >= (window.innerHeight || 0)) {
    return 90;
  }
  return 0;
}

export function createMobileControlsManager(env = {}) {
  let uiMounted = false;
  let globalListenersBound = false;
  let sawTouchInput = false;

  let hudEl = null;
  let movePadEl = null;
  let btnJumpEl = null;
  let btnUndisguiseEl = null;
  let btnFireEl = null;
  let btnSampleEl = null;
  let btnFreezeEl = null;
  let btnInteractEl = null;
  let joyBaseEl = null;

  let quickSettingsEl = null;
  let quickSettingsOpen = false;
  let quickSettingsAnchorEl = null;
  let qsToastTimer = 0;

  let fireAimPtr = null;
  let actionLookPtr = null;
  let canvasLookPtr = null;

  // Fair Aim Magnetism runtime state
  let aimAssistEngaged = false;
  let aimAssistFrictionScale = 1.0;
  const velTracker = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  let simClockSec = 0;

  // Gyroscope Tilt-Aim runtime state
  let gyroEnabled = readStoredGyroEnabled(false);
  let gyroListenerBound = false;
  let gyroPermissionGranted = false;
  let prevGyroSample = null;
  let pendingGyroYawRad = 0;
  let pendingGyroPitchRad = 0;
  let smoothGyroYawVel = 0;
  let smoothGyroPitchVel = 0;
  const gyroListeners = new Set();

  const processedFireMoves = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  const processedActionMoves = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function resolveHaptics() {
    return env.haptics || (typeof globalThis !== 'undefined' && globalThis.__hsHaptics) || sharedHaptics;
  }

  function resolveMobilePerf() {
    return (
      env.mobilePerf ||
      (typeof globalThis !== 'undefined' &&
        (globalThis.__hsMobilePerf || globalThis.__hs?.mobilePerf)) ||
      null
    );
  }

  function isMobileActive() {
    try {
      if (typeof window !== 'undefined' && window.__FORCE_MOBILE_HUD === true) {
        return true;
      }
      if (env.isMobileOverride?.() === true) {
        return true;
      }
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches
      ) {
        return true;
      }
      if (typeof window !== 'undefined') {
        const minSide = Math.min(
          Number(window.innerWidth) || 9999,
          Number(window.innerHeight) || 9999
        );
        const touchPts =
          typeof navigator !== 'undefined' ? Number(navigator.maxTouchPoints) || 0 : 0;
        if ((touchPts > 0 || sawTouchInput) && minSide <= 920) {
          return true;
        }
      }
    } catch (_) {
      // Safe fallback in headless or non-browser environments
    }
    return false;
  }

  function syncHtmlMobileClass() {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    const active = isMobileActive();
    document.documentElement.classList.toggle('is-mobile-touch', active);
    return active;
  }

  function haptic(kind = 'light') {
    try {
      const h = resolveHaptics();
      if (h) {
        if (kind === 'tap' && typeof h.tap === 'function') return h.tap();
        if (typeof h.impact === 'function') return h.impact(kind);
      }
    } catch (_) {
      // Zero-throw haptics guarantee
    }
    return false;
  }

  function showQuickToast(msg) {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('gfxToast');
      if (el) {
        el.textContent = msg;
        el.classList.add('on');
        if (qsToastTimer) clearTimeout(qsToastTimer);
        qsToastTimer = setTimeout(() => el.classList.remove('on'), 1800);
        return;
      }
    }
    try {
      env.hint?.(msg, 1600);
    } catch (_) {
      // Ignore hint errors
    }
  }

  function ensureStylesheetLinked() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.querySelector?.('link[href*="mobile_ui.css"]')) return;
    if (typeof document.createElement !== 'function' || typeof document.head.appendChild !== 'function') return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'mobile_ui.css?v=9';
    document.head.appendChild(link);
  }

  function clearActionLookCapture() {
    if (actionLookPtr && actionLookPtr.btn) {
      try {
        actionLookPtr.btn.releasePointerCapture?.(actionLookPtr.id);
      } catch (_) {
        // Ignore release errors
      }
    }
    actionLookPtr = null;
  }

  function stopActiveSpray() {
    const G = env.G;
    if (G) {
      G.firing = false;
      G.jumpHeld = false;
    }
    if (fireAimPtr && btnFireEl) {
      try {
        btnFireEl.releasePointerCapture?.(fireAimPtr.id);
      } catch (_) {
        // Ignore release errors
      }
    }
    fireAimPtr = null;
    canvasLookPtr = null;
    prevGyroSample = null;
    pendingGyroYawRad = 0;
    pendingGyroPitchRad = 0;
    clearActionLookCapture();
    if (btnFireEl) btnFireEl.classList.remove('is-firing');
    try {
      env.audio?.spray?.(false);
    } catch (_) {
      // Ignore audio state errors
    }
  }

  let touchSensitivity = readStoredTouchSens(1.0);
  function getTouchSensitivity() { return touchSensitivity; }
  function setTouchSensitivity(v) {
    touchSensitivity = writeStoredTouchSens(v);
    syncQuickSettingsUI();
    return touchSensitivity;
  }

  function applyLookDelta(dx, dy) {
    const G = env.G;
    if (!G || G.over || G.phase === 'menu' || G.phase === 'vs') return;
    const damp = (G.mode === 'seek' ? aimAssistFrictionScale : 1.0) * touchSensitivity;
    if (typeof G.yaw === 'number') {
      G.yaw -= dx * TOUCH_YAW_SENS * damp;
    }
    if (typeof G.pitch === 'number') {
      const maxPitch = G.player?.userData?.inTurret ? 1.48 : (G.mode === 'seek' ? 1.22 : 1.05);
      G.pitch = clamp(G.pitch - dy * TOUCH_PITCH_SENS * damp, -1.22, maxPitch);
    }
  }

  // ==========================================================================
  // Optional Gyroscope Tilt-Aim (Landscape-Corrected + iOS 13+ Permission)
  // ==========================================================================
  function resetGyroTracking() {
    prevGyroSample = null;
    pendingGyroYawRad = 0;
    pendingGyroPitchRad = 0;
    smoothGyroYawVel = 0;
    smoothGyroPitchVel = 0;
  }

  function applyDeadzoneDeg(deg) {
    const abs = Math.abs(deg);
    if (abs <= GYRO_DEADZONE_DEG) return 0;
    const sign = deg < 0 ? -1 : 1;
    return clamp(sign * (abs - GYRO_DEADZONE_DEG), -GYRO_MAX_SAMPLE_STEP_DEG, GYRO_MAX_SAMPLE_STEP_DEG);
  }

  function handleDeviceOrientation(e) {
    if (!gyroEnabled || !e) return;
    const G = env.G;
    if (
      !G ||
      G.over ||
      G.spectating ||
      G.phase === 'menu' ||
      G.phase === 'vs' ||
      !(G.mode === 'seek' || G.mode === 'hide')
    ) {
      prevGyroSample = null;
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) {
      prevGyroSample = null;
      return;
    }

    const alpha = typeof e.alpha === 'number' && Number.isFinite(e.alpha) ? e.alpha : null;
    const beta = typeof e.beta === 'number' && Number.isFinite(e.beta) ? e.beta : null;
    const gamma = typeof e.gamma === 'number' && Number.isFinite(e.gamma) ? e.gamma : null;
    if (beta === null && gamma === null) return;

    const orientAngle = getScreenOrientationAngle();
    if (!prevGyroSample || prevGyroSample.orientAngle !== orientAngle) {
      prevGyroSample = {
        alpha: alpha ?? 0,
        beta: beta ?? 0,
        gamma: gamma ?? 0,
        orientAngle,
      };
      return;
    }

    const dAlpha = alpha !== null ? wrapDegDelta(alpha - prevGyroSample.alpha) : 0;
    const dBeta = beta !== null ? wrapDegDelta(beta - prevGyroSample.beta) : 0;
    const dGamma = gamma !== null ? wrapDegDelta(gamma - prevGyroSample.gamma) : 0;

    prevGyroSample.alpha = alpha ?? prevGyroSample.alpha;
    prevGyroSample.beta = beta ?? prevGyroSample.beta;
    prevGyroSample.gamma = gamma ?? prevGyroSample.gamma;

    // Landscape-orientation-corrected angular deltas:
    // +yawRightDeg turns camera right (decreases G.yaw), +pitchUpDeg tilts camera up (increases G.pitch)
    let yawRightDeg = 0;
    let pitchUpDeg = 0;
    if (orientAngle === 90) {
      yawRightDeg = dBeta - dAlpha * 0.22;
      pitchUpDeg = dGamma;
    } else if (orientAngle === 270) {
      yawRightDeg = -(dBeta - dAlpha * 0.22);
      pitchUpDeg = -dGamma;
    } else if (orientAngle === 180) {
      yawRightDeg = -(dGamma - dAlpha * 0.22);
      pitchUpDeg = dBeta;
    } else {
      yawRightDeg = dGamma - dAlpha * 0.22;
      pitchUpDeg = -dBeta;
    }

    // Ignore sudden Euler gimbal-wrap jumps near +/-90 deg gamma
    if (
      Math.abs(yawRightDeg) > GYRO_SPIKE_REJECT_DEG ||
      Math.abs(pitchUpDeg) > GYRO_SPIKE_REJECT_DEG
    ) {
      return;
    }

    const filteredYawDeg = applyDeadzoneDeg(yawRightDeg);
    const filteredPitchDeg = applyDeadzoneDeg(pitchUpDeg);
    if (filteredYawDeg === 0 && filteredPitchDeg === 0) return;

    pendingGyroYawRad -= filteredYawDeg * DEG2RAD * GYRO_YAW_SENS;
    pendingGyroPitchRad += filteredPitchDeg * DEG2RAD * GYRO_PITCH_SENS;
  }

  function ensureGyroListenerBound() {
    if (gyroListenerBound || typeof window === 'undefined') return;
    gyroListenerBound = true;
    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
  }

  function emitGyroChange() {
    syncQuickSettingsUI();
    gyroListeners.forEach((fn) => {
      try {
        fn(gyroEnabled);
      } catch (_) {
        // Ignore listener errors
      }
    });
  }

  function isGyroEnabled() {
    return gyroEnabled;
  }

  function setGyroEnabled(nextBool) {
    const want = Boolean(nextBool);
    if (!want) {
      gyroEnabled = false;
      resetGyroTracking();
      writeStoredGyroEnabled(false);
      emitGyroChange();
      return false;
    }

    // Handle iOS 13+ DeviceOrientationEvent.requestPermission() cleanly on user tap
    try {
      if (
        !gyroPermissionGranted &&
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        gyroEnabled = true;
        emitGyroChange();
        const permPromise = DeviceOrientationEvent.requestPermission();
        if (permPromise && typeof permPromise.then === 'function') {
          return permPromise
            .then((state) => {
              if (state === 'granted') {
                gyroPermissionGranted = true;
                gyroEnabled = true;
                resetGyroTracking();
                ensureGyroListenerBound();
                writeStoredGyroEnabled(true);
                emitGyroChange();
                showQuickToast('🎯 Gyro Tilt-Aim Enabled');
                return true;
              }
              gyroEnabled = false;
              resetGyroTracking();
              writeStoredGyroEnabled(false);
              emitGyroChange();
              showQuickToast('🧭 Allow Motion Access in Settings for Gyro Aim');
              return false;
            })
            .catch(() => {
              gyroEnabled = false;
              resetGyroTracking();
              writeStoredGyroEnabled(false);
              emitGyroChange();
              showQuickToast('🧭 Tap Gyro Aim directly on phone to grant Motion permission');
              return false;
            });
        }
      }
    } catch (_) {
      // Fallback for non-iOS or restricted contexts
    }

    gyroPermissionGranted = true;
    gyroEnabled = true;
    resetGyroTracking();
    ensureGyroListenerBound();
    writeStoredGyroEnabled(true);
    emitGyroChange();
    return true;
  }

  function toggleGyro() {
    const next = !gyroEnabled;
    const res = setGyroEnabled(next);
    if (typeof res === 'boolean') {
      showQuickToast(res ? '🎯 Gyro Tilt-Aim: ON' : '🎯 Gyro Tilt-Aim: OFF');
    }
    return res;
  }

  function onGyroChange(fn) {
    if (typeof fn === 'function') {
      gyroListeners.add(fn);
    }
    return () => gyroListeners.delete(fn);
  }

  function stepGyroAim(dt) {
    if (!gyroEnabled) return;
    const G = env.G;
    if (
      !G ||
      G.over ||
      G.spectating ||
      G.phase === 'menu' ||
      G.phase === 'vs' ||
      !(G.mode === 'seek' || G.mode === 'hide')
    ) {
      resetGyroTracking();
      return;
    }

    const cdt = clamp(Number.isFinite(dt) ? dt : 0.016, 0.001, 0.08);
    // Smooth exponential filter prevents 60Hz sensor quantization jitter while staying crisp
    const alpha = Math.min(1, cdt * 28);
    const stepYaw = pendingGyroYawRad * alpha;
    const stepPitch = pendingGyroPitchRad * alpha;
    pendingGyroYawRad -= stepYaw;
    pendingGyroPitchRad -= stepPitch;

    smoothGyroYawVel = stepYaw / cdt;
    smoothGyroPitchVel = stepPitch / cdt;

    if (Math.abs(stepYaw) < 1e-6 && Math.abs(stepPitch) < 1e-6) return;

    const damp = G.mode === 'seek' && aimAssistEngaged ? 0.82 : 1.0;
    if (typeof G.yaw === 'number') {
      G.yaw += stepYaw * damp;
    }
    if (typeof G.pitch === 'number') {
      const maxPitch = G.player?.userData?.inTurret ? 1.48 : (G.mode === 'seek' ? 1.22 : 1.05);
      G.pitch = clamp(G.pitch + stepPitch * damp, -1.22, maxPitch);
    }
  }

  // Bind gyro listener on first user gesture if persisted enabled from previous session
  if (gyroEnabled && typeof window !== 'undefined') {
    const hasIosPermGate =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';
    if (!hasIosPermGate) {
      ensureGyroListenerBound();
    }
  }

  // ==========================================================================
  // Gentle, Fair Mobile Seeker Aim Magnetism (`applyAimAssist(dt)`)
  // ==========================================================================
  function measureObjectSpeed(keyObj, pos, dt) {
    if (!velTracker || !keyObj || !pos) return 0;
    const x = Number(pos.x) || 0;
    const y = Number(pos.y) || 0;
    const z = Number(pos.z) || 0;
    const prev = velTracker.get(keyObj);
    if (!prev || simClockSec - prev.t > 0.35) {
      velTracker.set(keyObj, { x, y, z, spd: 0, t: simClockSec });
      return 0;
    }
    const elapsed = Math.max(dt, simClockSec - prev.t);
    if (elapsed <= 1e-5) return prev.spd || 0;
    const instSpd = Math.hypot(x - prev.x, y - prev.y, z - prev.z) / elapsed;
    const smoothed = prev.spd + (instSpd - prev.spd) * Math.min(1, elapsed * 12);
    prev.x = x;
    prev.y = y;
    prev.z = z;
    prev.spd = smoothed;
    prev.t = simClockSec;
    return smoothed;
  }

  let _aimCenterTmp = null;
  let _aimBestStore = null;

  function applyAimAssist(dt = 0.016) {
    const cdt = clamp(Number.isFinite(dt) ? dt : 0.016, 0, 0.08);
    simClockSec += cdt;

    const G = env.G;
    const cam = env.camera;
    const touchOrMobile = Boolean(sawTouchInput || isMobileActive() || env.touchActive);

    if (
      !touchOrMobile ||
      !G ||
      G.mode !== 'seek' ||
      G.phase !== 'seek' ||
      G.over ||
      G.spectating ||
      !G.player ||
      !cam ||
      !cam.position ||
      (G.player.userData?.inTurret && env.turretHandlesOwnAim === true)
    ) {
      aimAssistEngaged = false;
      aimAssistFrictionScale = 1.0;
      return false;
    }

    const camPos = cam.position;
    if (!_aimCenterTmp) {
      const Vec = env.THREE?.Vector3 || (typeof camPos.constructor === 'function' ? camPos.constructor : null);
      _aimCenterTmp = Vec ? new Vec() : { x: 0, y: 0, z: 0 };
      _aimBestStore = Vec ? new Vec() : { x: 0, y: 0, z: 0 };
    }
    const cosPitch = Math.cos(G.pitch || 0);
    const lookX = -Math.sin(G.yaw || 0) * cosPitch;
    const lookY = Math.sin(G.pitch || 0);
    const lookZ = -Math.cos(G.yaw || 0) * cosPitch;

    const inTurret = Boolean(G.player?.userData?.inTurret);
    const maxPitch = inTurret ? 1.48 : 1.22;

    let hasBest = false;
    let bestDot = AIM_ASSIST_CONE_MIN_DOT;

    const evaluateCandidate = (center, isEligible) => {
      if (!isEligible || !center) return;
      const dx = center.x - camPos.x;
      const dy = center.y - camPos.y;
      const dz = center.z - camPos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 0.25 || dist > AIM_ASSIST_MAX_DIST) return;

      const dot = (dx * lookX + dy * lookY + dz * lookZ) / dist;
      if (dot <= bestDot) return;

      // Ensure a Vector3-compatible target with .clone() for env.lineOfSight
      _aimCenterTmp.x = center.x;
      _aimCenterTmp.y = center.y;
      _aimCenterTmp.z = center.z;
      if (env.lineOfSight && !env.lineOfSight(camPos, _aimCenterTmp)) return;

      bestDot = dot;
      hasBest = true;
      _aimBestStore.x = center.x;
      _aimBestStore.y = center.y;
      _aimBestStore.z = center.z;
    };

    const customTargets =
      typeof env.getAimAssistTargets === 'function' ? env.getAimAssistTargets() : null;

    if (Array.isArray(customTargets)) {
      for (let i = 0; i < customTargets.length; i++) {
        const item = customTargets[i];
        if (!item) continue;
        const obj = item.object || item.ch || item;
        if (obj === G.player || obj.userData?.actor?.eliminated) continue;
        const rawPos =
          item.center ||
          item.pos ||
          item.position ||
          (env.centerOf && obj.position ? env.centerOf(obj) : obj.position);
        if (!rawPos) continue;
        const trackedSpd = measureObjectSpeed(obj, obj.position || rawPos, cdt);
        const u = obj.userData || {};
        const spd =
          typeof item.spd === 'number'
            ? item.spd
            : typeof u.spd === 'number'
              ? Math.max(u.spd, trackedSpd)
              : trackedSpd;
        const airborne =
          typeof item.airborne === 'boolean'
            ? item.airborne
            : typeof item.jy === 'number'
              ? item.jy > AIM_ASSIST_MIN_AIRBORNE_Y
              : typeof u.jy === 'number' || typeof u.groundY === 'number'
                ? (u.jy || 0) > AIM_ASSIST_MIN_AIRBORNE_Y
                : (rawPos.y || 0) > AIM_ASSIST_MIN_AIRBORNE_Y;
        evaluateCandidate(rawPos, spd > AIM_ASSIST_MIN_MOVE_SPD || airborne);
      }
    } else {
      // 1. Scan Hiders — ONLY visibly moving (spd > 0.55) OR airborne (jy > 0.5)!
      // Stationary disguised Hiders are 100% untouched & un-betrayed!
      const hiders = Array.isArray(G.allHiders) && G.allHiders.length ? G.allHiders : G.hiders;
      if (Array.isArray(hiders)) {
        for (let i = 0; i < hiders.length; i++) {
          const h = hiders[i];
          if (!h || h === G.player || h.userData?.actor?.eliminated) continue;
          const u = h.userData || {};
          const trackedSpd = measureObjectSpeed(h, h.position, cdt);
          const spd = Math.max(Number(u.spd) || 0, trackedSpd);
          const airborne =
            typeof u.jy === 'number' || typeof u.groundY === 'number'
              ? (u.jy || 0) > AIM_ASSIST_MIN_AIRBORNE_Y
              : (h.position?.y || 0) > AIM_ASSIST_MIN_AIRBORNE_Y;
          if (!(spd > AIM_ASSIST_MIN_MOVE_SPD || airborne)) continue;

          const hc = env.centerOf ? env.centerOf(h) : h.position;
          evaluateCandidate(hc, true);
        }
      }

      // 2. Scan wild moving / soaring realProps (running chickens, startled pigs, soaring sky-birds)
      // Stationary barrels, crates, & perched props are 100% ignored!
      const propsList =
        env.realProps ||
        (typeof globalThis !== 'undefined' && globalThis.__hs?.realProps) ||
        null;
      if (Array.isArray(propsList)) {
        for (let i = 0; i < propsList.length; i++) {
          const rec = propsList[i];
          if (!rec || !rec.pos || (rec.g && rec.g.visible === false)) continue;
          if (!rec.isAnimal && rec.spd == null && rec.jy == null) continue;

          const trackedSpd = measureObjectSpeed(rec, rec.pos, cdt);
          const spd = typeof rec.spd === 'number' ? Math.max(rec.spd, trackedSpd) : trackedSpd;
          const airborne =
            typeof rec.jy === 'number'
              ? rec.jy > AIM_ASSIST_MIN_AIRBORNE_Y
              : typeof rec.homeY === 'number'
                ? rec.pos.y - rec.homeY > AIM_ASSIST_MIN_AIRBORNE_Y && spd > 0.15
                : Boolean(rec.isFlyingBird && (rec.pos.y || 0) > AIM_ASSIST_MIN_AIRBORNE_Y);

          if (!(spd > AIM_ASSIST_MIN_MOVE_SPD || airborne)) continue;

          _aimCenterTmp.x = rec.pos.x;
          _aimCenterTmp.y = (rec.pos.y || 0) + (rec.height || 0.7) * 0.5;
          _aimCenterTmp.z = rec.pos.z;
          evaluateCandidate(_aimCenterTmp, true);
        }
      }
    }

    if (!hasBest) {
      aimAssistEngaged = false;
      aimAssistFrictionScale = 1.0;
      return false;
    }
    const bestCenter = _aimBestStore;

    // Target is inside < 6.5 deg cone with clear LOS -> engage 0.72x gentle reticle friction!
    aimAssistEngaged = true;
    aimAssistFrictionScale = AIM_ASSIST_FRICTION_MUL;

    // Apply soft rotational pull (up to 2.4 rad/s) when firing or actively dragging/tilting!
    const gyroActivelyTilting =
      gyroEnabled && Math.hypot(smoothGyroYawVel, smoothGyroPitchVel) > 0.04;
    const activelyAimingOrFiring = Boolean(
      G.firing ||
        fireAimPtr ||
        actionLookPtr?.dragging ||
        canvasLookPtr?.dragging ||
        gyroActivelyTilting
    );

    if (!activelyAimingOrFiring || !(cdt > 0)) {
      return true;
    }

    const dx = bestCenter.x - camPos.x;
    const dy = bestCenter.y - camPos.y;
    const dz = bestCenter.z - camPos.z;
    const horiz = Math.max(1e-4, Math.hypot(dx, dz));

    const targetYaw = Math.atan2(-dx, -dz);
    const targetPitch = clamp(Math.atan2(dy, horiz), -1.15, maxPitch);

    const dYaw = shortestAngleDelta(G.yaw || 0, targetYaw);
    const dPitch = targetPitch - (G.pitch || 0);
    const angErr = Math.hypot(dYaw, dPitch);
    if (angErr < 1e-5) return true;

    const coneWeight = clamp(1 - angErr / AIM_ASSIST_CONE_RAD, 0.3, 1.0);
    const turretScale = inTurret ? 0.78 : 1.0;
    const maxPullStep = AIM_ASSIST_MAX_PULL_RAD_S * coneWeight * turretScale * cdt;
    const smoothStep = Math.min(angErr * Math.min(1, cdt * 11.5), maxPullStep);
    const ratio = smoothStep / angErr;

    G.yaw = (G.yaw || 0) + dYaw * ratio;
    G.pitch = clamp((G.pitch || 0) + dPitch * ratio, -1.22, maxPitch);

    if (cam.rotation && typeof cam.rotation.set === 'function') {
      cam.rotation.set(G.pitch, G.yaw, 0, 'YXZ');
    }
    return true;
  }

  function getAimAssistTouchScale() {
    return aimAssistEngaged ? AIM_ASSIST_FRICTION_MUL : 1.0;
  }

  function isAimAssistEngaged() {
    return aimAssistEngaged;
  }

  // ==========================================================================
  // Compact Quick-Settings Popover (#mobQuickSettings) — Works in Lobby & HUD!
  // ==========================================================================
  function getCurrentFpsCap() {
    const perf = resolveMobilePerf();
    if (perf && typeof perf.getFpsCap === 'function') {
      return perf.getFpsCap();
    }
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('hs_fps_cap_v1') === '30') {
        return 30;
      }
    } catch (_) {
      // Ignore storage errors
    }
    return 60;
  }

  function toggleCurrentFpsCap() {
    const perf = resolveMobilePerf();
    if (perf && typeof perf.toggleFpsCap === 'function') {
      return perf.toggleFpsCap();
    }
    if (perf && typeof perf.setFpsCap === 'function') {
      const next = perf.getFpsCap() === 30 ? 60 : 30;
      return perf.setFpsCap(next);
    }
    const next = getCurrentFpsCap() === 30 ? 60 : 30;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('hs_fps_cap_v1', String(next));
      }
    } catch (_) {
      // Ignore storage errors
    }
    return next;
  }

  function syncQuickSettingsUI() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

    const fps = getCurrentFpsCap();
    const hapticsOn = Boolean(resolveHaptics()?.isEnabled?.() ?? true);
    const gyroOn = Boolean(gyroEnabled);

    const perf = resolveMobilePerf();
    if (perf && typeof perf.syncFpsPillDOM === 'function') {
      perf.syncFpsPillDOM();
    }

    // Update popover rows if mounted
    const fpsBtn = document.getElementById('qsBtnFps');
    if (fpsBtn) {
      fpsBtn.dataset.active = fps === 60 ? '1' : '0';
      fpsBtn.dataset.fps = String(fps);
      fpsBtn.setAttribute('aria-pressed', fps === 30 ? 'true' : 'false');
      const valEl = fpsBtn.querySelector('.qs-pill-state');
      const icEl = fpsBtn.querySelector('.qs-pill-ic');
      if (icEl) icEl.textContent = fps === 30 ? '🔋' : '⚡';
      if (valEl) valEl.textContent = fps === 30 ? '30 FPS' : '60 FPS';
    }

    const gyroBtn = document.getElementById('qsBtnGyro');
    if (gyroBtn) {
      gyroBtn.dataset.active = gyroOn ? '1' : '0';
      gyroBtn.setAttribute('aria-pressed', gyroOn ? 'true' : 'false');
      const valEl = gyroBtn.querySelector('.qs-pill-state');
      if (valEl) valEl.textContent = gyroOn ? 'ON' : 'OFF';
    }

    const hapBtn = document.getElementById('qsBtnHaptics');
    if (hapBtn) {
      hapBtn.dataset.active = hapticsOn ? '1' : '0';
      hapBtn.setAttribute('aria-pressed', hapticsOn ? 'true' : 'false');
      const valEl = hapBtn.querySelector('.qs-pill-state');
      if (valEl) valEl.textContent = hapticsOn ? 'ON' : 'OFF';
    }

    // Sync active badge state on all Quick-Settings trigger pills
    for (const trigId of [
      'btnHudQuickSettings',
      'btnTitleQuickSettings',
      'mobLobbyQuickSettingsBtn',
    ]) {
      const trig = document.getElementById(trigId);
      if (trig) {
        trig.classList.toggle('is-open', quickSettingsOpen && quickSettingsAnchorEl === trig);
        trig.setAttribute(
          'aria-expanded',
          quickSettingsOpen && quickSettingsAnchorEl === trig ? 'true' : 'false'
        );
      }
    }
  }

  function positionQuickSettingsPopover(anchorEl) {
    if (!quickSettingsEl || !anchorEl || typeof anchorEl.getBoundingClientRect !== 'function') {
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 800;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 450;
    const cardW = 224;
    const left = clamp(
      rect.right > vw * 0.55 ? rect.right - cardW : rect.left,
      10,
      Math.max(10, vw - cardW - 10)
    );
    const top = clamp(rect.bottom + 7, 8, Math.max(8, vh - 178));
    quickSettingsEl.style.left = `${Math.round(left)}px`;
    quickSettingsEl.style.top = `${Math.round(top)}px`;
  }

  function closeQuickSettings() {
    if (!quickSettingsOpen) return;
    quickSettingsOpen = false;
    quickSettingsAnchorEl = null;
    if (quickSettingsEl) {
      quickSettingsEl.classList.remove('is-open');
      quickSettingsEl.setAttribute('aria-hidden', 'true');
    }
    syncQuickSettingsUI();
  }

  function toggleQuickSettings(anchorEl) {
    if (!quickSettingsEl) mountQuickSettingsDOM();
    if (!quickSettingsEl) return;
    if (quickSettingsOpen && quickSettingsAnchorEl === anchorEl) {
      closeQuickSettings();
      return;
    }
    quickSettingsAnchorEl = anchorEl || null;
    quickSettingsOpen = true;
    syncQuickSettingsUI();
    positionQuickSettingsPopover(anchorEl);
    quickSettingsEl.classList.add('is-open');
    quickSettingsEl.setAttribute('aria-hidden', 'false');
  }

  function wireQuickSettingsTrigger(btn) {
    if (!btn || btn.dataset?.qsWired === '1') return;
    if (btn.dataset) btn.dataset.qsWired = '1';
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      env.audio?.unlock?.();
      haptic('tap');
      toggleQuickSettings(btn);
    });
  }

  function ensureLobbyQuickSettingsTrigger() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    if (typeof document.createElement !== 'function') return;

    // Mobile Landscape Lobby (#mobTopBar .mob-top-cluster right beside #mobLobbyQualityBtn)
    const mobQualBtn = document.getElementById('mobLobbyQualityBtn');
    const mobCluster = mobQualBtn?.parentNode;
    if (mobQualBtn && mobCluster && !document.getElementById('mobLobbyQuickSettingsBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'mobLobbyQuickSettingsBtn';
      btn.className = 'qs-trigger-btn mob-lobby-qs-btn';
      btn.setAttribute('aria-label', 'Quick Settings: FPS, Gyro Aim & Haptics');
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '🎛️';
      if (mobQualBtn.nextSibling) {
        mobCluster.insertBefore(btn, mobQualBtn.nextSibling);
      } else {
        mobCluster.appendChild(btn);
      }
      wireQuickSettingsTrigger(btn);
    }
  }

  function mountQuickSettingsDOM() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    if (typeof document.createElement !== 'function') return;

    const appEl = document.getElementById('app') || document.body;
    if (!appEl) return;

    // 1. HUD Trigger Pill right beside #btnQuality / #btnFpsCap
    const hud = document.getElementById('hud');
    const hudQual = document.getElementById('btnQuality');
    if (hud && hudQual && !document.getElementById('btnHudQuickSettings')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnHudQuickSettings';
      btn.className = 'gfx-pill qs-trigger-btn hud-qs-btn';
      btn.setAttribute('aria-label', 'Quick Settings: FPS, Gyro Aim & Haptics');
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '🎛️';
      const fpsRef = document.getElementById('btnFpsCap') || hudQual;
      if (fpsRef.nextSibling) {
        hud.insertBefore(btn, fpsRef.nextSibling);
      } else {
        hud.appendChild(btn);
      }
      wireQuickSettingsTrigger(btn);
    }

    // 2. Desktop Lobby Trigger Pill right beside #btnTitleQuality
    const titleEl = document.getElementById('title');
    const titleQual = document.getElementById('btnTitleQuality');
    if (titleEl && titleQual && !document.getElementById('btnTitleQuickSettings')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnTitleQuickSettings';
      btn.className = 'gfx-pill qs-trigger-btn title-qs-btn';
      btn.setAttribute('aria-label', 'Quick Settings: FPS, Gyro Aim & Haptics');
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '🎛️ Controls';
      if (titleQual.nextSibling) {
        titleEl.insertBefore(btn, titleQual.nextSibling);
      } else {
        titleEl.appendChild(btn);
      }
      wireQuickSettingsTrigger(btn);
    }

    // 3. Mobile Landscape Lobby Trigger Pill right beside #mobLobbyQualityBtn
    ensureLobbyQuickSettingsTrigger();

    // 4. Shared Floating Popover Drawer (#mobQuickSettings)
    quickSettingsEl = document.getElementById('mobQuickSettings');
    if (!quickSettingsEl) {
      quickSettingsEl = document.createElement('div');
      quickSettingsEl.id = 'mobQuickSettings';
      quickSettingsEl.className = 'mob-quick-settings';
      quickSettingsEl.setAttribute('role', 'dialog');
      quickSettingsEl.setAttribute('aria-label', 'Quick Settings');
      quickSettingsEl.setAttribute('aria-hidden', 'true');
      quickSettingsEl.innerHTML =
        `<div class="qs-hdr">` +
          `<span class="qs-hdr-title">🎛️ Quick Settings</span>` +
          `<button type="button" class="qs-close-btn" id="qsBtnClose" aria-label="Close Quick Settings">✕</button>` +
        `</div>` +
        `<div class="qs-list">` +
          `<button type="button" class="qs-pill-row" id="qsBtnFps" data-active="1">` +
            `<span class="qs-pill-left"><span class="qs-pill-ic">⚡</span><span class="qs-pill-lbl">Frame Rate</span></span>` +
            `<b class="qs-pill-state">60 FPS</b>` +
          `</button>` +
          `<button type="button" class="qs-pill-row" id="qsBtnGyro" data-active="0">` +
            `<span class="qs-pill-left"><span class="qs-pill-ic">🎯</span><span class="qs-pill-lbl">Gyro Aim</span></span>` +
            `<b class="qs-pill-state">OFF</b>` +
          `</button>` +
          `<button type="button" class="qs-pill-row" id="qsBtnHaptics" data-active="1">` +
            `<span class="qs-pill-left"><span class="qs-pill-ic">📳</span><span class="qs-pill-lbl">Haptics</span></span>` +
            `<b class="qs-pill-state">ON</b>` +
          `</button>` +
          `<div class="qs-pill-row qs-sens-row" id="qsSensRow">` +
            `<span class="qs-pill-left"><span class="qs-pill-ic">🎚️</span><span class="qs-pill-lbl">Look Speed</span></span>` +
            `<input type="range" id="qsSensSlider" min="0.5" max="1.8" step="0.1" value="${touchSensitivity.toFixed(1)}" aria-label="Look sensitivity" style="width:88px;accent-color:#f09522;">` +
            `<b class="qs-pill-state" id="qsSensVal">${touchSensitivity.toFixed(1)}×</b>` +
          `</div>` +
        `</div>`;
      appEl.appendChild(quickSettingsEl);

      quickSettingsEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });

      const closeBtn = quickSettingsEl.querySelector('#qsBtnClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          haptic('tap');
          closeQuickSettings();
        });
      }

      const fpsRow = quickSettingsEl.querySelector('#qsBtnFps');
      if (fpsRow) {
        fpsRow.addEventListener('click', (e) => {
          e.stopPropagation();
          const next = toggleCurrentFpsCap();
          haptic('tap');
          syncQuickSettingsUI();
          showQuickToast(
            next === 30
              ? '🔋 30 FPS Battery Saver (Cool & Steady)'
              : '⚡ 60 FPS Smooth Gameplay'
          );
        });
      }

      const gyroRow = quickSettingsEl.querySelector('#qsBtnGyro');
      if (gyroRow) {
        // Bound on `click` so iOS 13+ Safari / WKWebView grants DeviceOrientationEvent permission!
        gyroRow.addEventListener('click', (e) => {
          e.stopPropagation();
          haptic('tap');
          toggleGyro();
        });
      }

      const hapRow = quickSettingsEl.querySelector('#qsBtnHaptics');
      if (hapRow) {
        hapRow.addEventListener('click', (e) => {
          e.stopPropagation();
          const h = resolveHaptics();
          const on = h && typeof h.toggle === 'function' ? h.toggle() : true;
          syncQuickSettingsUI();
          showQuickToast(on ? '📳 Haptics: ON' : '📳 Haptics: OFF');
        });
      }

      const sensSlider = quickSettingsEl.querySelector('#qsSensSlider');
      if (sensSlider) {
        sensSlider.addEventListener('input', (e) => {
          e.stopPropagation();
          const nextVal = writeStoredTouchSens(e.target.value);
          touchSensitivity = nextVal;
          const lbl = quickSettingsEl.querySelector('#qsSensVal');
          if (lbl) lbl.textContent = `${nextVal.toFixed(1)}×`;
        });
      }
    }

    // Subscribe to external FPS / Haptics changes so UI stays 100% synced
    const perf = resolveMobilePerf();
    if (perf && typeof perf.onFpsCapChange === 'function' && !quickSettingsEl.dataset.perfSub) {
      quickSettingsEl.dataset.perfSub = '1';
      perf.onFpsCapChange(() => syncQuickSettingsUI());
    }
    const hap = resolveHaptics();
    if (hap && typeof hap.onChange === 'function' && !quickSettingsEl.dataset.hapSub) {
      quickSettingsEl.dataset.hapSub = '1';
      hap.onChange(() => syncQuickSettingsUI());
    }

    syncQuickSettingsUI();
  }

  function bindGlobalMobileListeners() {
    if (globalListenersBound || typeof window === 'undefined') return;
    globalListenersBound = true;

    const unlockAudio = () => {
      try {
        env.audio?.unlock?.();
      } catch (_) {
        // Ignore unlock errors
      }
    };

    const onFirstOrAnyTouch = () => {
      sawTouchInput = true;
      unlockAudio();
      refreshModeUI();
    };

    window.addEventListener('touchstart', onFirstOrAnyTouch, { passive: true });
    window.addEventListener('touchend', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });

    const onViewportChange = () => {
      resetGyroTracking();
      if (quickSettingsOpen && quickSettingsAnchorEl) {
        positionQuickSettingsPopover(quickSettingsAnchorEl);
      }
      refreshModeUI();
    };
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, { passive: true });

    window.addEventListener('pagehide', stopActiveSpray, { passive: true });
    window.addEventListener('blur', stopActiveSpray, { passive: true });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          stopActiveSpray();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && quickSettingsOpen) {
          closeQuickSettings();
        }
      });
    }

    // Window-level move/up handlers keep hold-and-drag aiming rock-solid on
    // #btnFire, #btnJump, #btnSample, right-thumb buttons, and canvas swipe-look!
    window.addEventListener(
      'pointermove',
      (e) => {
        handleFireAimMove(e);
        handleActionLookMove(e);
        if (canvasLookPtr && e.pointerId === canvasLookPtr.id) {
          const dx = (e.clientX || 0) - canvasLookPtr.startX;
          const dy = (e.clientY || 0) - canvasLookPtr.startY;
          if (Math.hypot(dx, dy) > 4) {
            canvasLookPtr.dragging = true;
          }
        }
      },
      { passive: true }
    );
    window.addEventListener(
      'pointerup',
      (e) => {
        handleFireAimEnd(e);
        handleActionLookEnd(e);
        if (canvasLookPtr && e.pointerId === canvasLookPtr.id) {
          canvasLookPtr = null;
        }
        syncMovePadDragState();
      },
      { passive: true }
    );
    window.addEventListener(
      'pointercancel',
      (e) => {
        handleFireAimEnd(e);
        handleActionLookEnd(e);
        if (canvasLookPtr && e.pointerId === canvasLookPtr.id) {
          canvasLookPtr = null;
        }
        syncMovePadDragState();
      },
      { passive: true }
    );
    window.addEventListener(
      'pointerdown',
      (e) => {
        // Close Quick-Settings popover when tapping outside it
        if (quickSettingsOpen && quickSettingsEl && e.target) {
          const insideCard =
            typeof e.target.closest === 'function' &&
            e.target.closest('#mobQuickSettings, .qs-trigger-btn');
          if (!insideCard) {
            closeQuickSettings();
          }
        }
        // Track right-half canvas touch-look drags so Fair Aim Magnetism knows when thumb is tracking
        if (
          e.pointerType !== 'mouse' &&
          e.target &&
          e.target.tagName === 'CANVAS' &&
          (e.clientX || 0) >= ((window.innerWidth || 800) * 0.42)
        ) {
          canvasLookPtr = {
            id: e.pointerId,
            startX: e.clientX || 0,
            startY: e.clientY || 0,
            dragging: false,
          };
        }
        syncMovePadDragState();
      },
      { passive: true }
    );
  }

  function handleFireAimMove(e) {
    if (!fireAimPtr || !e || e.pointerId !== fireAimPtr.id) return;
    if (processedFireMoves) {
      if (processedFireMoves.has(e)) return;
      processedFireMoves.add(e);
    }
    const G = env.G;
    if (!G || G.over || G.phase === 'menu') return;

    const cx = typeof e.clientX === 'number' ? e.clientX : fireAimPtr.x;
    const cy = typeof e.clientY === 'number' ? e.clientY : fireAimPtr.y;
    const dx = cx - fireAimPtr.x;
    const dy = cy - fireAimPtr.y;
    fireAimPtr.x = cx;
    fireAimPtr.y = cy;

    applyLookDelta(dx, dy);
    if (G.mode === 'seek' && !G.over) {
      G.firing = true;
    }
  }

  function handleFireAimEnd(e) {
    if (!fireAimPtr || !e || e.pointerId !== fireAimPtr.id) return;
    if (btnFireEl) {
      try {
        btnFireEl.releasePointerCapture?.(e.pointerId);
      } catch (_) {
        // Ignore release errors
      }
      btnFireEl.classList.remove('is-firing');
    }
    fireAimPtr = null;
    if (env.G) {
      env.G.firing = false;
    }
  }

  function startActionLookTracking(e, btn) {
    if (!e || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (fireAimPtr && e.pointerId === fireAimPtr.id) return;
    const cx = typeof e.clientX === 'number' ? e.clientX : 0;
    const cy = typeof e.clientY === 'number' ? e.clientY : 0;
    actionLookPtr = {
      id: e.pointerId,
      startX: cx,
      startY: cy,
      lastX: cx,
      lastY: cy,
      dragging: false,
      btn: btn || null,
    };
    if (btn) {
      try {
        btn.setPointerCapture?.(e.pointerId);
      } catch (_) {
        // Ignore capture errors on synthetic events
      }
    }
  }

  function handleActionLookMove(e) {
    if (!actionLookPtr || !e || e.pointerId !== actionLookPtr.id) return;
    if (processedActionMoves) {
      if (processedActionMoves.has(e)) return;
      processedActionMoves.add(e);
    }
    const G = env.G;
    if (!G || G.over || G.phase === 'menu' || G.phase === 'vs') return;

    const cx = typeof e.clientX === 'number' ? e.clientX : actionLookPtr.lastX;
    const cy = typeof e.clientY === 'number' ? e.clientY : actionLookPtr.lastY;

    let dx = 0;
    let dy = 0;
    if (!actionLookPtr.dragging) {
      const totX = cx - actionLookPtr.startX;
      const totY = cy - actionLookPtr.startY;
      const tot = Math.hypot(totX, totY);
      if (tot <= ACTION_LOOK_DEADZONE_PX) {
        return;
      }
      actionLookPtr.dragging = true;
      const keep = (tot - ACTION_LOOK_DEADZONE_PX) / tot;
      dx = totX * keep;
      dy = totY * keep;
      actionLookPtr.lastX = cx;
      actionLookPtr.lastY = cy;
    } else {
      dx = cx - actionLookPtr.lastX;
      dy = cy - actionLookPtr.lastY;
      actionLookPtr.lastX = cx;
      actionLookPtr.lastY = cy;
    }

    applyLookDelta(dx, dy);
  }

  function handleActionLookEnd(e) {
    if (!actionLookPtr || !e || e.pointerId !== actionLookPtr.id) return;
    clearActionLookCapture();
  }

  function wireHoldDragLook(btn) {
    if (!btn || btn.dataset?.mobileLookWired === '1') return;
    if (btn.dataset) btn.dataset.mobileLookWired = '1';

    btn.addEventListener('pointerdown', (e) => {
      startActionLookTracking(e, btn);
    });
    btn.addEventListener('pointermove', (e) => {
      handleActionLookMove(e);
    });
    btn.addEventListener('pointerup', (e) => {
      handleActionLookEnd(e);
    });
    btn.addEventListener('pointercancel', (e) => {
      handleActionLookEnd(e);
    });
  }

  function wireFireButtonErgonomics(btn) {
    if (!btn || btn.dataset.mobileFireWired === '1') return;
    btn.dataset.mobileFireWired = '1';

    // Suppress accidental pointerleave shutoff while thumb drags outside button bounds
    btn.addEventListener(
      'pointerleave',
      (e) => {
        if (fireAimPtr && e.pointerId === fireAimPtr.id) {
          e.stopImmediatePropagation();
          if (env.G && env.G.mode === 'seek' && !env.G.over) {
            env.G.firing = true;
          }
        }
      },
      true
    );

    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();
      env.audio?.unlock?.();
      const inTurret = Boolean(env.G?.player?.userData?.inTurret);
      const elemAttr =
        (btn.dataset && btn.dataset.elemId) || env.G?.player?.userData?.elemGun || 'water';
      try {
        resolveHaptics()?.fireGun?.(inTurret ? 'turret' : elemAttr);
      } catch (_) {
        haptic('light');
      }
      if (env.G) {
        env.G.firing = true;
      }
      fireAimPtr = {
        id: e.pointerId,
        x: typeof e.clientX === 'number' ? e.clientX : 0,
        y: typeof e.clientY === 'number' ? e.clientY : 0,
      };
      btn.classList.add('is-firing');
      try {
        btn.setPointerCapture?.(e.pointerId);
      } catch (_) {
        // Ignore capture errors on synthetic events
      }
    });

    btn.addEventListener('pointermove', (e) => {
      handleFireAimMove(e);
    });

    btn.addEventListener('pointerup', (e) => {
      handleFireAimEnd(e);
    });

    btn.addEventListener('pointercancel', (e) => {
      handleFireAimEnd(e);
    });
  }

  function syncMovePadDragState() {
    if (!movePadEl) return;
    const joyActive = Boolean(joyBaseEl && !joyBaseEl.classList?.contains?.('hidden'));
    movePadEl.classList.toggle('is-dragging', joyActive);
  }

  function syncActionButtonSpan(btn, active, mobileLbl, desktopLbl, mobileIcon = null) {
    if (!btn || typeof btn.querySelectorAll !== 'function') return;
    const spans = btn.querySelectorAll('span');
    if (!spans || !spans.length) return;
    let icSpan = null;
    let txtSpan = null;
    for (let i = 0; i < spans.length; i++) {
      if (spans[i].classList?.contains('ic')) {
        icSpan = spans[i];
      } else {
        txtSpan = spans[i];
      }
    }
    if (active && mobileIcon && icSpan && icSpan.textContent !== mobileIcon) {
      icSpan.textContent = mobileIcon;
    }
    if (!txtSpan) return;
    if (active) {
      if (
        btn.dataset &&
        !btn.dataset.desktopLbl &&
        txtSpan.textContent &&
        txtSpan.textContent !== mobileLbl
      ) {
        btn.dataset.desktopLbl = txtSpan.textContent;
      }
      if (txtSpan.textContent !== mobileLbl) {
        txtSpan.textContent = mobileLbl;
      }
    } else {
      const restore = (btn.dataset && btn.dataset.desktopLbl) || desktopLbl;
      if (restore && txtSpan.textContent !== restore) {
        txtSpan.textContent = restore;
      }
    }
  }

  function syncMobileLabels(active) {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

    if (!btnSampleEl) btnSampleEl = document.getElementById('btnSample');
    if (!btnFreezeEl) btnFreezeEl = document.getElementById('btnFreeze');
    if (!btnFireEl) btnFireEl = document.getElementById('btnFire');
    if (!btnInteractEl) btnInteractEl = document.getElementById('btnInteract');

    // Shorten action labels on mobile so ZERO text ever overflows a circle
    syncActionButtonSpan(btnSampleEl, active, 'Morph', 'Transform', '🎭');
    syncActionButtonSpan(btnFreezeEl, active, 'Rotate', 'Rotate', '🔄');
    const pPropId = env.G?.player?.userData?.propId || '';
    const isFlyingBird =
      !env.G?.player?.userData?.specialMode &&
      (pPropId === 'mb_stork' ||
        pPropId === 'mb_heron' ||
        pPropId === 'mb_roc' ||
        Boolean(env.KIT?.props?.[pPropId]?.canFly));
    syncActionButtonSpan(
      btnJumpEl,
      active,
      isFlyingBird ? 'Fly' : 'Jump',
      isFlyingBird ? 'Fly' : 'Jump',
      isFlyingBird ? '🪽' : '🦘'
    );
    syncActionButtonSpan(btnUndisguiseEl, active, 'Spirit', 'Spirit');
    const elemFireLbl =
      (btnFireEl && btnFireEl.dataset && btnFireEl.dataset.elemAction) || 'Splash';
    syncActionButtonSpan(btnFireEl, active, elemFireLbl, elemFireLbl);

    // Shorten Seeker Gadget card titles for 64x64 right-thumb squircles
    const pulseBtn = document.getElementById('btnGadgetPulse');
    const pulseTitle = pulseBtn?.querySelector?.('.sg-title');
    if (pulseTitle) {
      const want = active ? 'Pulse' : 'Echo Pulse';
      if (pulseTitle.textContent !== want) pulseTitle.textContent = want;
    }

    const bombBtn = document.getElementById('btnGadgetBomb');
    const bombTitle = bombBtn?.querySelector?.('.sg-title');
    if (bombTitle) {
      const want = active ? 'Bomb' : 'Splash Bomb';
      if (bombTitle.textContent !== want) bombTitle.textContent = want;
    }

    // Shorten Hider Smoke/Dash pill title for 58x58 right-thumb squircle
    const smokeBtn = document.getElementById('btnTrickSmoke');
    const smokeTitle = smokeBtn?.querySelector?.('.ht-txt b');
    if (smokeTitle) {
      const want = active ? 'Dash' : 'Petal Dash';
      if (smokeTitle.textContent !== want) smokeTitle.textContent = want;
    }

    // Keep #btnInteract label concise via CSS data-mobile-lbl attribute
    const intLbl = document.getElementById('intLbl');
    if (intLbl && intLbl.dataset) {
      const raw = String(env.G?.nearInteract?.label || intLbl.textContent || '').trim();
      const kind = String(env.G?.nearInteract?.kind || '');
      let shortLbl = 'Spot';
      if (kind === 'turret') shortLbl = /hop|off|exit/i.test(raw) ? 'Exit' : 'Turret';
      else if (kind === 'lift' || /lift|floor|ride/i.test(raw)) shortLbl = 'Lift';
      else if (/door|portal/i.test(raw)) shortLbl = 'Door';
      else if (/hop|drop|step|leave|exit|out/i.test(raw)) shortLbl = 'Exit';
      else if (raw && raw.length <= 5) shortLbl = raw;
      if (intLbl.dataset.mobileLbl !== shortLbl) {
        intLbl.dataset.mobileLbl = shortLbl;
      }
    }
  }

  function mountUI() {
    bindGlobalMobileListeners();
    syncHtmlMobileClass();

    if (typeof document === 'undefined') return;
    ensureStylesheetLinked();

    const hud = document.getElementById('hud');
    if (!hud) return;
    hudEl = hud;

    joyBaseEl = document.getElementById('joyBase');

    // 1. Cozy Resting Left Thumbpad (#mobileMovePad inside #hud)
    movePadEl = document.getElementById('mobileMovePad');
    if (!movePadEl) {
      movePadEl = document.createElement('div');
      movePadEl.id = 'mobileMovePad';
      movePadEl.className = 'mobile-move-pad hidden';
      movePadEl.setAttribute('aria-hidden', 'true');
      movePadEl.innerHTML =
        `<span class="mmp-ring">` +
          `<i class="mmp-nub up">▲</i>` +
          `<i class="mmp-nub right">▶</i>` +
          `<i class="mmp-nub down">▼</i>` +
          `<i class="mmp-nub left">◀</i>` +
          `<span class="mmp-knob"><span class="mmp-lbl">MOVE</span></span>` +
        `</span>`;
      const joyRef = document.getElementById('joyBase');
      if (joyRef && joyRef.parentNode === hud) {
        hud.insertBefore(movePadEl, joyRef);
      } else {
        hud.appendChild(movePadEl);
      }
    }

    // Observe #joyBase class changes so #mobileMovePad hides to opacity 0 instantly on touch
    if (
      joyBaseEl &&
      joyBaseEl.dataset?.mobileObserved !== '1' &&
      typeof MutationObserver === 'function'
    ) {
      if (joyBaseEl.dataset) joyBaseEl.dataset.mobileObserved = '1';
      try {
        const obs = new MutationObserver(() => {
          syncMovePadDragState();
        });
        obs.observe(joyBaseEl, { attributes: true, attributeFilter: ['class'] });
      } catch (_) {
        // Ignore observer errors in headless mocks
      }
    }

    // 2. Phone Gameplay Buttons inside .actions (#btnUndisguise & #btnJump)
    const actionsEl = hud.querySelector('.actions');
    if (actionsEl) {
      btnUndisguiseEl = document.getElementById('btnUndisguise');
      if (!btnUndisguiseEl) {
        btnUndisguiseEl = document.createElement('button');
        btnUndisguiseEl.id = 'btnUndisguise';
        btnUndisguiseEl.type = 'button';
        btnUndisguiseEl.className = 'act mobile-only-act small-act hidden';
        btnUndisguiseEl.setAttribute('aria-label', 'Return to Spirit form');
        btnUndisguiseEl.innerHTML = `<span class="ic">✨</span><span>Spirit</span>`;

        const sampleBtn = document.getElementById('btnSample');
        if (sampleBtn && sampleBtn.parentNode === actionsEl) {
          actionsEl.insertBefore(btnUndisguiseEl, sampleBtn);
        } else {
          actionsEl.appendChild(btnUndisguiseEl);
        }
      }

      if (!btnUndisguiseEl.dataset.mobileWired) {
        btnUndisguiseEl.dataset.mobileWired = '1';
        btnUndisguiseEl.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          env.audio?.unlock?.();
          try {
            resolveHaptics()?.morph?.();
          } catch (_) {
            haptic('light');
          }
          const G = env.G;
          if (!G || G.mode !== 'hide' || G.spectating || G.over || !G.player) return;
          if (!(G.player.userData?.propId || G.player.userData?.specialMode)) return;
          env.undisguise?.(G.player);
          if (G.player && env.centerOf) {
            env.spawnPoofVfx?.(env.centerOf(G.player));
          }
          env.audio?.poof?.(true);
          env.hint?.('Back to agile Spirit form! ✨', 1000);
          refreshModeUI();
        });
        wireHoldDragLook(btnUndisguiseEl);
      }

      btnJumpEl = document.getElementById('btnJump');
      if (!btnJumpEl) {
        btnJumpEl = document.createElement('button');
        btnJumpEl.id = 'btnJump';
        btnJumpEl.type = 'button';
        btnJumpEl.className = 'act mobile-only-act hidden';
        btnJumpEl.setAttribute('aria-label', 'Jump');
        btnJumpEl.innerHTML = `<span class="ic">🦘</span><span>Jump</span>`;

        const fireRef = document.getElementById('btnFire');
        if (fireRef && fireRef.parentNode === actionsEl) {
          actionsEl.insertBefore(btnJumpEl, fireRef);
        } else {
          actionsEl.appendChild(btnJumpEl);
        }
      }

      if (!btnJumpEl.dataset.mobileWired) {
        btnJumpEl.dataset.mobileWired = '1';
        let jumpPtrId = null;
        btnJumpEl.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          env.audio?.unlock?.();
          const pPropId = env.G?.player?.userData?.propId || '';
          if (pPropId === 'mb_roc') resolveHaptics()?.wingFlap?.('huge');
          else if (pPropId === 'mb_stork') resolveHaptics()?.wingFlap?.('larger');
          else if (pPropId === 'mb_heron') resolveHaptics()?.wingFlap?.('large');
          else haptic('tap');
          jumpPtrId = e.pointerId;
          if (env.G) env.G.jumpHeld = true;
          env.jump?.();
        });
        const releaseJumpHold = (e) => {
          if (jumpPtrId === null || !e || e.pointerId === jumpPtrId) {
            jumpPtrId = null;
            if (env.G) env.G.jumpHeld = false;
          }
        };
        btnJumpEl.addEventListener('pointerup', releaseJumpHold);
        btnJumpEl.addEventListener('pointercancel', releaseJumpHold);
        window.addEventListener('pointerup', releaseJumpHold, { passive: true });
        window.addEventListener('pointercancel', releaseJumpHold, { passive: true });
        wireHoldDragLook(btnJumpEl);
      }
    }

    // 3. Hold-and-drag camera look on #btnSample, #btnFreeze, #btnInteract & #btnFire
    btnSampleEl = document.getElementById('btnSample');
    if (btnSampleEl) wireHoldDragLook(btnSampleEl);

    btnFreezeEl = document.getElementById('btnFreeze');
    if (btnFreezeEl) wireHoldDragLook(btnFreezeEl);

    btnInteractEl = document.getElementById('btnInteract');
    if (btnInteractEl) wireHoldDragLook(btnInteractEl);

    btnFireEl = document.getElementById('btnFire');
    if (btnFireEl) {
      wireFireButtonErgonomics(btnFireEl);
    }

    // 4. Subtle tactile haptics + swipe-to-look support on right-thumb trick/gadget taps
    if (!hud.dataset.mobileHapticWired) {
      hud.dataset.mobileHapticWired = '1';
      hud.addEventListener(
        'pointerdown',
        (e) => {
          if (!isMobileActive()) return;
          const t =
            e.target && typeof e.target.closest === 'function'
              ? e.target.closest('#btnSample, #btnFreeze, #btnInteract, .chip, .ht-pill, .sg-card')
              : null;
          if (t) {
            if (t.id === 'btnSample' || t.classList?.contains('chip')) {
              resolveHaptics()?.morph?.();
            } else {
              haptic('tap');
            }
            const lookTarget = e.target.closest('.ht-pill, .sg-card');
            if (lookTarget) {
              startActionLookTracking(e, null);
            }
          }
        },
        true
      );
    }

    // 5. Mount Quick-Settings Popover & Trigger Buttons (HUD + Lobby)
    mountQuickSettingsDOM();
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => ensureLobbyQuickSettingsTrigger());
    }

    uiMounted = true;
    refreshModeUI();
  }

  function refreshModeUI() {
    const active = syncHtmlMobileClass();
    const G = env.G;

    if (typeof document !== 'undefined') {
      if (!hudEl) hudEl = document.getElementById('hud');
      if (!movePadEl) movePadEl = document.getElementById('mobileMovePad');
      if (!btnJumpEl) btnJumpEl = document.getElementById('btnJump');
      if (!btnUndisguiseEl) btnUndisguiseEl = document.getElementById('btnUndisguise');
      if (!joyBaseEl) joyBaseEl = document.getElementById('joyBase');
      ensureLobbyQuickSettingsTrigger();
    }

    if (hudEl && hudEl.dataset) {
      const modeVal = G && (G.mode === 'seek' || G.mode === 'hide') ? G.mode : '';
      if (hudEl.dataset.mobileMode !== modeVal) {
        hudEl.dataset.mobileMode = modeVal;
      }
    }

    syncMobileLabels(active);

    const inGameplayHud = Boolean(
      active &&
        G &&
        !G.over &&
        !G.spectating &&
        G.phase !== 'menu' &&
        G.phase !== 'vs' &&
        (G.mode === 'hide' || G.mode === 'seek' || G.phase)
    );

    if (movePadEl) {
      movePadEl.classList.toggle('hidden', !inGameplayHud);
      syncMovePadDragState();
    }

    const showJump = Boolean(
      active &&
        G &&
        !G.over &&
        !G.spectating &&
        (G.mode === 'hide' || G.mode === 'seek')
    );
    if (btnJumpEl) {
      btnJumpEl.classList.toggle('hidden', !showJump);
    }

    const showUndisguise = Boolean(
      active &&
        G &&
        !G.over &&
        G.mode === 'hide' &&
        !G.spectating &&
        G.player &&
        (G.player.userData?.propId || G.player.userData?.specialMode)
    );
    if (btnUndisguiseEl) {
      btnUndisguiseEl.classList.toggle('hidden', !showUndisguise);
    }
  }

  function update(dt = 0.016) {
    if (!uiMounted && typeof document !== 'undefined' && document.getElementById('hud')) {
      mountUI();
    }

    const G = env.G;
    if (fireAimPtr && (!G || G.over || G.mode !== 'seek' || G.spectating || G.phase === 'menu')) {
      if (btnFireEl) btnFireEl.classList.remove('is-firing');
      fireAimPtr = null;
    }
    if (actionLookPtr && (!G || G.over || G.spectating || G.phase === 'menu' || G.phase === 'vs')) {
      clearActionLookCapture();
    }

    refreshModeUI();

    // 1. Apply Gyroscope Tilt-Aim if enabled
    stepGyroAim(dt);

    // 2. Apply Fair Mobile Seeker Aim Magnetism (moving / airborne targets only!)
    applyAimAssist(dt);
  }

  return {
    mountUI,
    update,
    isMobileActive,
    haptic,
    stopActiveSpray,
    refreshModeUI,
    applyAimAssist,
    applyGentleAimMagnetism: applyAimAssist,
    getAimAssistTouchScale,
    getTouchSensitivity,
    setTouchSensitivity,
    isAimAssistEngaged,
    isGyroEnabled,
    setGyroEnabled,
    toggleGyro,
    onGyroChange,
    syncQuickSettingsUI,
    closeQuickSettings,
  };
}
