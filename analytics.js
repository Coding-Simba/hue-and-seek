/* Hue & Seek — anonymous gameplay analytics.
 *
 * What it answers: how many matches players play, where they stop (lobby, tutorial step, mid-match,
 * after a loss…), how long sessions last, which modes / worlds are played, and whether players come back.
 *
 * Privacy: no gamertag, no personal data, no advertising IDs. A random install id (`pid`) and a random
 * session id (`sid`) are generated on the device. Players can opt out (localStorage `hs_analytics_optout=1`
 * or `analytics.setOptOut(true)`), and "Delete all my data" wipes the local ids.
 *
 * Transport: batches of events are written as one Firestore document each to the `analytics` collection
 * (create-only — see tools/firestore.rules), using the same anonymous Firebase guest token as cloud save.
 * Unsent events are kept on the device and retried next time, so offline play is counted too.
 */

export const ANALYTICS_SCHEMA = 1;
const KEYS = {
  pid: 'hs_an_pid',
  meta: 'hs_an_meta',
  queue: 'hs_an_queue',
  optOut: 'hs_analytics_optout',
};
const DEFAULTS = {
  collection: 'analytics',
  flushEveryMs: 30000,
  maxQueue: 400,
  maxBatchChars: 18000,
  maxErrorsPerSession: 5,
  requestTimeoutMs: 10000,
};

/** Random url-safe id (no Math.random bias concerns matter here, ids are not secrets). */
export function randomId(len = 16, randomBytes) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let bytes;
  if (typeof randomBytes === 'function') bytes = randomBytes(len);
  else if (globalThis.crypto && globalThis.crypto.getRandomValues) bytes = globalThis.crypto.getRandomValues(new Uint8Array(len));
  else bytes = Array.from({ length: len }, () => Math.floor(Math.random() * 256));
  let out = '';
  for (let i = 0; i < len; i++) out += abc[bytes[i] % abc.length];
  return out;
}

/** Keeps only flat, JSON-safe, short values so a bug can never ship huge or personal blobs. */
export function sanitizeProps(props = {}) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  let n = 0;
  for (const [k, v] of Object.entries(props)) {
    if (n >= 16) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,23}$/.test(k)) continue;
    if (typeof v === 'number') { if (Number.isFinite(v)) { out[k] = Math.round(v * 100) / 100; n++; } }
    else if (typeof v === 'boolean') { out[k] = v; n++; }
    else if (typeof v === 'string') { out[k] = v.slice(0, 64); n++; }
  }
  return out;
}

/** Splits events into batches whose JSON stays under maxChars. */
export function chunkEvents(events, maxChars) {
  const batches = [];
  let cur = [];
  let size = 2;
  for (const e of events) {
    const s = JSON.stringify(e).length + 1;
    if (cur.length && size + s > maxChars) { batches.push(cur); cur = []; size = 2; }
    if (s > maxChars) continue; // a single oversize event is dropped
    cur.push(e);
    size += s;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export function toFirestoreBatch({ pid, sid, plat, ver, ts, events }) {
  return {
    fields: {
      v: { integerValue: String(ANALYTICS_SCHEMA) },
      pid: { stringValue: pid },
      sid: { stringValue: sid },
      plat: { stringValue: plat },
      ver: { stringValue: ver },
      ts: { integerValue: String(Math.floor(ts)) },
      ev: { stringValue: JSON.stringify(events) },
    },
  };
}

export function detectPlatform(win = globalThis) {
  try {
    if (win.Capacitor && typeof win.Capacitor.getPlatform === 'function') {
      const p = win.Capacitor.getPlatform();
      if (p === 'android' || p === 'ios') return p;
    }
    const ua = (win.navigator && win.navigator.userAgent) || '';
    if (/Android/i.test(ua)) return 'web_android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'web_ios';
    return 'web_desktop';
  } catch (_) { return 'unknown'; }
}

export function createAnalytics(env = {}) {
  const cfg = env.config || {};
  const opt = { ...DEFAULTS, ...(env.options || {}) };
  const doFetch = env.fetch || ((...a) => globalThis.fetch(...a));
  const now = env.now || (() => Date.now());
  const storage = env.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const setI = env.setInterval || ((fn, ms) => globalThis.setInterval(fn, ms));
  const getToken = env.getToken || null;
  const version = env.version || '0';
  const platform = env.platform || detectPlatform();

  const read = (k) => { try { return storage ? storage.getItem(k) : null; } catch (_) { return null; } };
  const write = (k, v) => { try { if (storage) storage.setItem(k, v); } catch (_) { /* ignore */ } };
  const remove = (k) => { try { if (storage) storage.removeItem(k); } catch (_) { /* ignore */ } };
  const readJson = (k, fb) => { try { const r = read(k); return r ? JSON.parse(r) : fb; } catch (_) { return fb; } };

  let optedOut = read(KEYS.optOut) === '1';
  const canSend = () => !!(cfg.enabled !== false && cfg.apiKey && cfg.projectId && getToken && storage);

  let pid = read(KEYS.pid);
  const isNewInstall = !pid;
  if (!pid) { pid = randomId(16, env.randomBytes); write(KEYS.pid, pid); }
  const sid = randomId(12, env.randomBytes);
  const sessionStart = now();

  // meta: lifetime counters + a rolling summary of the *previous* session (sent on next launch,
  // because "page closed" events are unreliable on phones).
  const meta = readJson(KEYS.meta, null) || { firstSeen: sessionStart, sessions: 0, matches: 0, lastDay: '', days: 0, last: null };
  const day = new Date(sessionStart).toISOString().slice(0, 10);
  const prevSession = meta.last;
  const daysSinceFirst = Math.floor((sessionStart - (meta.firstSeen || sessionStart)) / 86400000);
  const daysSinceLast = prevSession && prevSession.endAt ? Math.floor((sessionStart - prevSession.endAt) / 86400000) : null;
  meta.sessions = (meta.sessions || 0) + 1;
  if (meta.lastDay !== day) { meta.days = (meta.days || 0) + 1; meta.lastDay = day; }

  const session = { sid, startAt: sessionStart, endAt: sessionStart, matches: 0, rounds: 0, quits: 0, lastEvent: 'session_start', lastScreen: 'lobby' };
  meta.last = session;
  const saveMeta = () => { session.endAt = now(); write(KEYS.meta, JSON.stringify(meta)); };
  saveMeta();

  let queue = readJson(KEYS.queue, []);
  if (!Array.isArray(queue)) queue = [];
  let seq = 0;
  let errors = 0;
  let inFlight = null;
  let started = false;
  const ctx = { matchT0: 0, roundT0: 0, mode: '', map: '', online: false, inMatch: false };

  const persistQueue = () => write(KEYS.queue, JSON.stringify(queue.slice(-opt.maxQueue)));

  function track(name, props = {}) {
    if (optedOut || typeof name !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(name)) return;
    const t = now();
    const ev = { n: name, t, s: seq++, p: sanitizeProps(props) };
    queue.push(ev);
    if (queue.length > opt.maxQueue) queue.splice(0, queue.length - opt.maxQueue);
    session.lastEvent = name;
    saveMeta();
    persistQueue();
  }

  async function request(url, init) {
    let timer = null;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctrl) timer = setTimeout(() => ctrl.abort(), opt.requestTimeoutMs);
    try {
      const res = await doFetch(url, { ...init, signal: ctrl ? ctrl.signal : undefined });
      return { ok: res.ok, status: res.status };
    } finally { if (timer) clearTimeout(timer); }
  }

  const collUrl = () => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}`
    + `/databases/(default)/documents/${encodeURIComponent(opt.collection)}`;

  async function sendBatch(events, keepalive) {
    const token = await getToken();
    const body = JSON.stringify(toFirestoreBatch({ pid, sid, plat: platform, ver: version, ts: now(), events }));
    return request(collUrl(), {
      method: 'POST',
      keepalive: !!keepalive && body.length < 60000,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
    });
  }

  /** Sends everything queued. Events are only removed after Firestore accepted them. */
  function flush({ keepalive = false } = {}) {
    if (optedOut || !canSend() || !queue.length) return Promise.resolve(false);
    if (inFlight) return inFlight;
    const snapshot = queue.slice();
    inFlight = (async () => {
      try {
        const batches = chunkEvents(snapshot, opt.maxBatchChars);
        let sent = 0;
        for (const b of batches) {
          const r = await sendBatch(b, keepalive);
          if (!r.ok) {
            // Rejected by rules (4xx other than auth) — drop to avoid retrying garbage forever.
            if (r.status >= 400 && r.status < 500 && r.status !== 401 && r.status !== 429) sent += b.length;
            break;
          }
          sent += b.length;
        }
        if (sent) { queue.splice(0, sent); persistQueue(); }
        return sent === snapshot.length;
      } catch (_) {
        return false;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  /* ---------------- high-level game hooks ---------------- */
  const elapsed = (t0) => (t0 ? Math.round((now() - t0) / 100) / 10 : 0);

  function start(extra = {}) {
    if (started) return;
    started = true;
    if (prevSession && prevSession.sid) {
      track('prev_session', {
        durSec: Math.round(((prevSession.endAt || prevSession.startAt) - prevSession.startAt) / 1000),
        matches: prevSession.matches || 0,
        rounds: prevSession.rounds || 0,
        quits: prevSession.quits || 0,
        lastEvent: prevSession.lastEvent || '',
        lastScreen: prevSession.lastScreen || '',
      });
    }
    track('session_start', {
      newInstall: isNewInstall,
      sessionNo: meta.sessions,
      activeDays: meta.days,
      daysSinceFirst,
      daysSinceLast: daysSinceLast == null ? -1 : daysSinceLast,
      lifetimeMatches: meta.matches || 0,
      lang: (globalThis.navigator && globalThis.navigator.language) || '',
      scrW: (globalThis.screen && globalThis.screen.width) || 0,
      scrH: (globalThis.screen && globalThis.screen.height) || 0,
      ...extra,
    });
    flush();
    setI(() => { saveMeta(); flush(); }, opt.flushEveryMs);
    const doc = typeof document !== 'undefined' ? document : null;
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'hidden') {
          track('app_hidden', { inMatch: ctx.inMatch, screen: session.lastScreen, sessSec: elapsed(sessionStart) });
          flush({ keepalive: true });
        } else {
          track('app_visible', { screen: session.lastScreen });
        }
      });
    }
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('error', (e) => {
        if (errors++ >= opt.maxErrorsPerSession) return;
        track('js_error', { msg: String((e && e.message) || 'error'), src: String((e && e.filename) || '').split('/').pop(), line: (e && e.lineno) || 0 });
      });
      globalThis.addEventListener('unhandledrejection', (e) => {
        if (errors++ >= opt.maxErrorsPerSession) return;
        track('js_error', { msg: String((e && e.reason && (e.reason.message || e.reason)) || 'rejection'), src: 'promise' });
      });
    }
  }

  function screen(name, props = {}) {
    if (session.lastScreen === name) return;
    session.lastScreen = name;
    track('screen', { name, ...props });
  }

  function matchStart({ mode, map, online = false, humans = 1 } = {}) {
    ctx.matchT0 = now(); ctx.roundT0 = ctx.matchT0;
    ctx.mode = mode || ''; ctx.map = map || ''; ctx.online = !!online; ctx.inMatch = true;
    meta.matches = (meta.matches || 0) + 1;
    session.matches += 1;
    session.lastScreen = 'match';
    track('match_start', { mode: ctx.mode, map: ctx.map, online: ctx.online, humans, matchNo: meta.matches, sessMatchNo: session.matches });
    flush();
  }

  function roundStart({ round = 1, mode } = {}) {
    ctx.roundT0 = now();
    if (mode) ctx.mode = mode;
    track('round_start', { round, mode: ctx.mode, map: ctx.map });
  }

  function roundEnd({ round = 1, win = false, mode } = {}) {
    session.rounds += 1;
    track('round_end', { round, win: !!win, mode: mode || ctx.mode, map: ctx.map, durSec: elapsed(ctx.roundT0) });
  }

  function matchEnd({ win = false, draw = false, yourScore = 0, rivalScore = 0 } = {}) {
    if (!ctx.inMatch) return;
    ctx.inMatch = false;
    session.lastScreen = 'result';
    track('match_end', { mode: ctx.mode, map: ctx.map, online: ctx.online, win: !!win, draw: !!draw, yourScore, rivalScore, durSec: elapsed(ctx.matchT0), matchNo: meta.matches });
    flush();
  }

  /** Player left before the series finished (Quit button, cancel, back to menu mid-round). */
  function matchQuit({ phase = '', round = 1 } = {}) {
    if (!ctx.inMatch) return;
    ctx.inMatch = false;
    session.quits += 1;
    track('match_quit', { mode: ctx.mode, map: ctx.map, online: ctx.online, phase, round, durSec: elapsed(ctx.matchT0), roundSec: elapsed(ctx.roundT0) });
    flush();
  }

  function setOptOut(v) {
    optedOut = !!v;
    if (optedOut) { write(KEYS.optOut, '1'); queue = []; remove(KEYS.queue); }
    else remove(KEYS.optOut);
  }

  function wipeLocal() {
    for (const k of [KEYS.pid, KEYS.meta, KEYS.queue]) remove(k);
    queue = [];
  }

  return {
    track, flush, start, screen,
    matchStart, matchEnd, matchQuit, roundStart, roundEnd,
    setOptOut, isOptedOut: () => optedOut, wipeLocal,
    inMatch: () => ctx.inMatch,
    getIds: () => ({ pid, sid }),
    getQueue: () => queue.slice(),
    getSessionSummary: () => ({ ...session }),
  };
}
