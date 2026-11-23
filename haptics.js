/* ==========================================================================
 * Hue & Seek — Native Phone & Web Haptics Layer (haptics.js)
 * Zero-throw, cooldown-throttled tactile feedback persisted in localStorage.
 * Priority order:
 *   1. @capacitor/haptics (window.Capacitor?.Plugins?.Haptics)
 *   2. Native Android @JavascriptInterface (window.HueSeekNativeHaptics)
 *   3. Native iOS WKScriptMessageHandler (window.webkit?.messageHandlers?.hueseekHaptics)
 *   4. Standard Web Vibration API (navigator.vibrate)
 * ========================================================================== */

export const HAPTICS_STORAGE_KEY = 'hs_haptics_v1';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function readStoredEnabled(defaultEnabled = true) {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(HAPTICS_STORAGE_KEY);
      if (raw === '0' || raw === 'false') return false;
      if (raw === '1' || raw === 'true') return true;
    }
  } catch (_) {
    // Ignore private-mode / sandboxed storage errors
  }
  return Boolean(defaultEnabled);
}

function writeStoredEnabled(enabled) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? '1' : '0');
    }
  } catch (_) {
    // Ignore quota / sandboxed storage errors
  }
}

function safePromise(maybePromise) {
  try {
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {});
    }
  } catch (_) {
    // Never throw from async bridge rejections
  }
}

export function createHapticsManager(options = {}) {
  let enabled =
    typeof options.initialEnabled === 'boolean'
      ? options.initialEnabled
      : readStoredEnabled(true);

  const listeners = new Set();
  const lastFiredAt = Object.create(null);
  const scheduledTimers = new Set();

  function clearScheduledPulses() {
    scheduledTimers.forEach((id) => {
      try {
        clearTimeout(id);
      } catch (_) {
        // Ignore timer cleanup errors
      }
    });
    scheduledTimers.clear();
  }

  function schedulePulse(delayMs, fn) {
    if (typeof setTimeout !== 'function' || !(delayMs > 0)) {
      try {
        if (enabled) fn();
      } catch (_) {
        // Zero-throw guarantee
      }
      return;
    }
    const timerId = setTimeout(() => {
      scheduledTimers.delete(timerId);
      if (!enabled) return;
      try {
        fn();
      } catch (_) {
        // Zero-throw guarantee
      }
    }, delayMs);
    scheduledTimers.add(timerId);
  }

  function canFire(channel, cooldownMs) {
    if (!enabled) return false;
    const now = nowMs();
    const prev = lastFiredAt[channel] || -1e9;
    if (now - prev < cooldownMs) return false;
    lastFiredAt[channel] = now;
    return true;
  }

  function getCapacitorHaptics() {
    try {
      return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Haptics || null : null;
    } catch (_) {
      return null;
    }
  }

  function getAndroidBridge() {
    try {
      return typeof window !== 'undefined' ? window.HueSeekNativeHaptics || null : null;
    } catch (_) {
      return null;
    }
  }

  function getIosHandler() {
    try {
      return typeof window !== 'undefined'
        ? window.webkit?.messageHandlers?.hueseekHaptics || null
        : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Dispatches a single transient haptic impact across the 4-tier native/web priority stack.
   * @param {'light'|'medium'|'heavy'} style
   * @param {number} durationMs
   */
  function dispatchImpact(style = 'light', durationMs = 12) {
    if (!enabled) return false;
    const normStyle = style === 'heavy' ? 'heavy' : style === 'medium' ? 'medium' : 'light';
    const capStyle = normStyle.toUpperCase();

    try {
      // 1. @capacitor/haptics
      const cap = getCapacitorHaptics();
      if (cap && typeof cap.impact === 'function') {
        safePromise(cap.impact({ style: capStyle }));
        return true;
      }

      // 2. Native Android @JavascriptInterface
      const android = getAndroidBridge();
      if (android && typeof android.impact === 'function') {
        android.impact(normStyle);
        return true;
      }

      // 3. Native iOS WKScriptMessageHandler
      const ios = getIosHandler();
      if (ios && typeof ios.postMessage === 'function') {
        ios.postMessage({ type: 'impact', style: normStyle });
        return true;
      }

      // 4. Standard Web Vibration API
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(Math.max(4, Math.round(durationMs)));
        return true;
      }
    } catch (_) {
      // Never throw on restricted WebViews or unsupported devices
    }
    return false;
  }

  /**
   * Dispatches a multi-pulse pattern `[onMs, offMs, onMs, ...]` across the 4-tier priority stack.
   * For transient-only Taptic engines (Capacitor / iOS WKWebView), schedules timed impacts
   * matching each active pulse window so `lub-dub` and celebration rhythms feel authentic!
   * @param {number[]} patternArr
   * @param {Array<'light'|'medium'|'heavy'>} pulseStyles
   * @param {'SUCCESS'|'WARNING'|'ERROR'|null} notificationType
   */
  function dispatchPattern(patternArr, pulseStyles = [], notificationType = null) {
    if (!enabled || !Array.isArray(patternArr) || patternArr.length === 0) return false;

    try {
      // 1. @capacitor/haptics
      const cap = getCapacitorHaptics();
      if (cap) {
        if (
          notificationType &&
          patternArr.length >= 5 &&
          typeof cap.notification === 'function'
        ) {
          safePromise(cap.notification({ type: notificationType }));
          return true;
        }
        if (typeof cap.impact === 'function') {
          let elapsedMs = 0;
          let pulseIdx = 0;
          for (let i = 0; i < patternArr.length; i++) {
            const seg = Math.max(0, Math.round(Number(patternArr[i]) || 0));
            if (i % 2 === 0 && seg > 0) {
              const st =
                pulseStyles[pulseIdx] ||
                (seg >= 24 ? 'heavy' : seg >= 15 ? 'medium' : 'light');
              const capSt = st === 'heavy' ? 'HEAVY' : st === 'medium' ? 'MEDIUM' : 'LIGHT';
              if (elapsedMs === 0) {
                safePromise(cap.impact({ style: capSt }));
              } else {
                const d = elapsedMs;
                schedulePulse(d, () => {
                  const liveCap = getCapacitorHaptics();
                  if (liveCap && typeof liveCap.impact === 'function') {
                    safePromise(liveCap.impact({ style: capSt }));
                  }
                });
              }
              pulseIdx++;
            }
            elapsedMs += seg;
          }
          return true;
        }
        if (typeof cap.vibrate === 'function') {
          const total = patternArr.reduce((acc, n) => acc + (Number(n) || 0), 0);
          safePromise(cap.vibrate({ duration: Math.max(10, Math.round(total * 0.5)) }));
          return true;
        }
      }

      // 2. Native Android @JavascriptInterface
      const android = getAndroidBridge();
      if (android) {
        if (typeof android.vibratePattern === 'function') {
          const csv = patternArr.map((n) => Math.max(0, Math.round(Number(n) || 0))).join(',');
          android.vibratePattern(csv);
          return true;
        }
        if (typeof android.impact === 'function') {
          android.impact(pulseStyles[0] || 'medium');
          return true;
        }
      }

      // 3. Native iOS WKScriptMessageHandler
      const ios = getIosHandler();
      if (ios && typeof ios.postMessage === 'function') {
        if (notificationType) {
          ios.postMessage({
            type: 'notification',
            style: notificationType.toLowerCase(),
          });
          return true;
        }
        let elapsedMs = 0;
        let pulseIdx = 0;
        for (let i = 0; i < patternArr.length; i++) {
          const seg = Math.max(0, Math.round(Number(patternArr[i]) || 0));
          if (i % 2 === 0 && seg > 0) {
            const st =
              pulseStyles[pulseIdx] ||
              (seg >= 24 ? 'heavy' : seg >= 15 ? 'medium' : 'light');
            if (elapsedMs === 0) {
              ios.postMessage({ type: 'impact', style: st });
            } else {
              const d = elapsedMs;
              schedulePulse(d, () => {
                const liveIos = getIosHandler();
                if (liveIos && typeof liveIos.postMessage === 'function') {
                  liveIos.postMessage({ type: 'impact', style: st });
                }
              });
            }
            pulseIdx++;
          }
          elapsedMs += seg;
        }
        return true;
      }

      // 4. Standard Web Vibration API
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(patternArr.map((n) => Math.max(0, Math.round(Number(n) || 0))));
        return true;
      }
    } catch (_) {
      // Zero-throw guarantee
    }
    return false;
  }

  function emitChange() {
    listeners.forEach((fn) => {
      try {
        fn(enabled);
      } catch (_) {
        // Ignore listener errors
      }
    });
  }

  function isEnabled() {
    return enabled;
  }

  function setEnabled(nextBool) {
    const resolved = Boolean(nextBool);
    const changed = resolved !== enabled;
    enabled = resolved;
    writeStoredEnabled(enabled);

    if (!enabled) {
      clearScheduledPulses();
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(0);
        }
      } catch (_) {
        // Ignore stop-vibration errors
      }
    }

    if (changed) {
      emitChange();
    }
    return enabled;
  }

  function toggle() {
    const next = setEnabled(!enabled);
    if (next) {
      // Immediate crisp confirmation tick so the player feels haptics turn ON
      lastFiredAt.tap = -1e9;
      tap();
    }
    return next;
  }

  function onChange(fn) {
    if (typeof fn === 'function') {
      listeners.add(fn);
    }
    return () => listeners.delete(fn);
  }

  /** Crisp 8ms UI tick */
  function tap() {
    if (!canFire('tap', 28)) return false;
    return dispatchImpact('light', 8);
  }

  /** Prop transform pop `[12, 24, 18]` */
  function morph() {
    if (!canFire('morph', 90)) return false;
    return dispatchPattern([12, 24, 18], ['light', 'medium']);
  }

  /** Bird wing flap scaled by bird sizeTier (`'large'` 10ms, `'larger'` 14ms, `'huge'` 22ms) */
  function wingFlap(sizeTier = 'larger') {
    if (!canFire('wingFlap', 105)) return false;
    const tier = String(sizeTier || 'larger').toLowerCase();
    if (tier === 'huge') return dispatchImpact('heavy', 22);
    if (tier === 'large') return dispatchImpact('light', 10);
    return dispatchImpact('medium', 14);
  }

  /**
   * Tailored elemental sprayer & Sky-Turret recoil feel:
   * `water`, `fire`, `ice`, `earth`, `air`, plus `turret` heavy double-kick!
   */
  function fireGun(element = 'water') {
    const elem = String(element || 'water').toLowerCase();
    if (elem === 'turret') {
      if (!canFire('fireGun', 82)) return false;
      return dispatchPattern([26, 32, 22], ['heavy', 'heavy']);
    }
    if (elem === 'earth') {
      if (!canFire('fireGun', 115)) return false;
      return dispatchImpact('heavy', 24);
    }
    if (elem === 'fire') {
      if (!canFire('fireGun', 78)) return false;
      return dispatchPattern([14, 18, 10], ['medium', 'light']);
    }
    if (elem === 'ice') {
      if (!canFire('fireGun', 84)) return false;
      return dispatchPattern([12, 14, 8], ['light', 'light']);
    }
    if (elem === 'air') {
      if (!canFire('fireGun', 88)) return false;
      return dispatchPattern([9, 20, 14], ['light', 'medium']);
    }
    // Default: 'water' continuous stream micro-pulse
    if (!canFire('fireGun', 72)) return false;
    return dispatchImpact('light', 10);
  }

  /** Impact rumble `[28, 30, 38]` (or heavier `[38, 28, 48]` when `heavy === true`) */
  function takeHit(heavy = false) {
    if (!canFire('takeHit', 120)) return false;
    if (heavy) {
      return dispatchPattern([38, 28, 48], ['heavy', 'heavy']);
    }
    return dispatchPattern([28, 30, 38], ['medium', 'heavy']);
  }

  /** Realistic chest `lub-dub` micro-pulse `[14, 75, 22]` */
  function heartbeat(intensity01 = 0.6) {
    if (!canFire('heartbeat', 280)) return false;
    const v = clamp(Number.isFinite(+intensity01) ? +intensity01 : 0.6, 0, 1);
    const lubMs = Math.round(11 + v * 6);   // ~14ms at 0.5–0.6, up to 17ms at 1.0
    const dubMs = Math.round(18 + v * 8);   // ~22ms at 0.5–0.6, up to 26ms at 1.0
    const styles = v >= 0.78 ? ['medium', 'heavy'] : ['light', 'medium'];
    return dispatchPattern([lubMs, 75, dubMs], styles);
  }

  /** Golden "Nerves of Steel" survival bonus celebration `[18, 45, 24, 45, 36]` */
  function nervesBonus() {
    if (!canFire('celebrate', 320)) return false;
    return dispatchPattern([18, 45, 24, 45, 36], ['light', 'medium', 'heavy'], 'SUCCESS');
  }

  /** Round / Match victory celebration `[18, 45, 24, 45, 36]` */
  function victory() {
    if (!canFire('celebrate', 320)) return false;
    return dispatchPattern([18, 45, 24, 45, 36], ['light', 'medium', 'heavy'], 'SUCCESS');
  }

  /** General-purpose impact helper (`'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'`) */
  function impact(kind = 'light') {
    const k = String(kind || 'light').toLowerCase();
    if (k === 'success') return victory();
    if (k === 'warning' || k === 'error') {
      if (!canFire('impactWarn', 150)) return false;
      return dispatchPattern([22, 35, 28], ['medium', 'heavy'], k.toUpperCase());
    }
    if (!canFire('impact', 28)) return false;
    if (k === 'heavy') return dispatchImpact('heavy', 26);
    if (k === 'medium') return dispatchImpact('medium', 15);
    return dispatchImpact('light', 10);
  }

  const api = {
    isEnabled,
    setEnabled,
    toggle,
    onChange,
    tap,
    morph,
    wingFlap,
    fireGun,
    takeHit,
    heartbeat,
    nervesBonus,
    victory,
    impact,
  };

  try {
    if (typeof globalThis !== 'undefined' && !globalThis.__hsHaptics) {
      globalThis.__hsHaptics = api;
    }
  } catch (_) {
    // Ignore read-only globalThis in strict sandboxes
  }

  return api;
}

export const haptics =
  (typeof globalThis !== 'undefined' && globalThis.__hsHaptics) || createHapticsManager();
try {
  if (typeof globalThis !== 'undefined') {
    globalThis.__hsHaptics = haptics;
  }
} catch (_) {
  // Ignore read-only globalThis
}
