/* ============================================================================
 * Hue & Seek — Cloud Save
 *
 * Keeps a copy of the player's progress in the cloud (Firebase: anonymous sign-in + Firestore),
 * talking to the plain REST endpoints so no SDK has to be bundled.
 *
 *  - The device save (localStorage) stays the source the game reads and writes. The cloud copy is
 *    pushed in the background; when the network is down the game simply keeps saving locally and
 *    catches up later.
 *  - Every device gets a random 20-character recovery code. The save is stored under that code, so
 *    typing the code on another phone (or after a reinstall) brings the progress back.
 * ========================================================================== */

export const SAVE_CODE_LEN = 20;
// No I, L, O, U, 0 or 1: nothing that is easy to misread when copying a code by hand.
export const SAVE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const CLOUD_SCHEMA = 1;
export const MAX_SAVE_CHARS = 280000;

const DEFAULTS = {
  profileKey: 'hueseek_progression_v1',
  gamertagKey: 'hs_gamertag',
  metaKey: 'hs_cloud_v1',
  authKey: 'hs_cloud_auth_v1',
  debounceMs: 10000,
  minPushIntervalMs: 60000,
  requestTimeoutMs: 12000,
};

/* ---------------------------------------------------------------- pure helpers */

export function generateSaveCode(randomBytes) {
  const rb = randomBytes || ((n) => {
    const out = new Uint8Array(n);
    globalThis.crypto.getRandomValues(out);
    return out;
  });
  const n = SAVE_CODE_ALPHABET.length;
  const limit = 256 - (256 % n); // rejection sampling keeps every character equally likely
  let code = '';
  let guard = 0;
  while (code.length < SAVE_CODE_LEN && guard++ < 64) {
    const bytes = rb(SAVE_CODE_LEN * 2);
    for (let i = 0; i < bytes.length && code.length < SAVE_CODE_LEN; i++) {
      if (bytes[i] < limit) code += SAVE_CODE_ALPHABET[bytes[i] % n];
    }
  }
  if (code.length < SAVE_CODE_LEN) throw new Error('could not generate a save code');
  return code;
}

export function normalizeSaveCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidSaveCode(code) {
  if (typeof code !== 'string' || code.length !== SAVE_CODE_LEN) return false;
  for (const ch of code) if (!SAVE_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

export function formatSaveCode(code) {
  return String(code || '').replace(/(.{4})(?=.)/g, '$1-');
}

/** Bundle what gets stored: the progression profile and the gamertag, as one JSON string. */
export function buildSavePayload(profileJson, gamertag) {
  let profile = null;
  try { profile = profileJson ? JSON.parse(profileJson) : null; } catch (_) { profile = null; }
  if (!profile || typeof profile !== 'object') return null;
  return JSON.stringify({ profile, gamertag: String(gamertag || '').slice(0, 16) });
}

export function parseSavePayload(saveString) {
  try {
    const obj = JSON.parse(saveString);
    if (!obj || typeof obj !== 'object' || !obj.profile || typeof obj.profile !== 'object') return null;
    return { profile: obj.profile, gamertag: typeof obj.gamertag === 'string' ? obj.gamertag.slice(0, 16) : '' };
  } catch (_) {
    return null;
  }
}

/** How far along a profile is, as a comparable tuple (level, xp, matches played). */
export function progressOf(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return [num(p.level), num(p.xp), num(p.achStats && p.achStats.matchesCompleted)];
}

export function compareProgress(a, b) {
  const pa = progressOf(a);
  const pb = progressOf(b);
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  return 0;
}

/**
 * Decide what a sync should do.
 *   cloud        — null when there is no cloud copy, else { rev, profile }
 *   localRev     — the cloud revision this device last synced with
 *   localDirty   — the device has changes that were never pushed
 * Returns 'push' | 'pull' | 'none'.
 */
export function decideSync({ cloud, localRev = 0, localDirty = false, localProfile = null }) {
  if (!cloud) return localDirty ? 'push' : 'none';
  if (cloud.rev > localRev) {
    // Someone else (another device with the same code) saved since we last looked.
    if (!localDirty) return 'pull';
    return compareProgress(localProfile, cloud.profile) >= 0 ? 'push' : 'pull';
  }
  return localDirty ? 'push' : 'none';
}

export function toFirestoreFields({ rev, updatedAt, save }) {
  return {
    v: { integerValue: String(CLOUD_SCHEMA) },
    rev: { integerValue: String(Math.max(1, Math.floor(rev))) },
    updatedAt: { integerValue: String(Math.floor(updatedAt)) },
    save: { stringValue: String(save) },
  };
}

export function fromFirestoreDoc(doc) {
  const f = doc && doc.fields;
  if (!f || !f.save || typeof f.save.stringValue !== 'string') return null;
  const int = (x) => (x && x.integerValue != null ? Number(x.integerValue) : 0);
  return { v: int(f.v), rev: int(f.rev), updatedAt: int(f.updatedAt), save: f.save.stringValue };
}

/* ---------------------------------------------------------------- manager */

export function createCloudSave(env = {}) {
  const cfg = env.config || {};
  const opt = { ...DEFAULTS, ...(env.options || {}) };
  const doFetch = env.fetch || ((...a) => globalThis.fetch(...a));
  const now = env.now || (() => Date.now());
  const storage = env.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const setT = env.setTimeout || ((fn, ms) => globalThis.setTimeout(fn, ms));
  const clearT = env.clearTimeout || ((id) => globalThis.clearTimeout(id));
  const canReload = env.canReload || (() => true);
  const reload = env.reload || (() => { try { globalThis.location.reload(); } catch (_) { /* ignore */ } });
  const enabled = !!(cfg.enabled !== false && cfg.apiKey && cfg.projectId && storage);

  const listeners = new Set();
  let status = { state: enabled ? 'idle' : 'off', lastSyncAt: 0, message: '' };
  let idToken = '';
  let idTokenExp = 0;
  let pushTimer = null;
  let lastPushAt = 0;
  let busy = null;
  let lastPayload = null;
  let dom = null;

  /* ---- storage */
  const read = (key) => { try { return storage ? storage.getItem(key) : null; } catch (_) { return null; } };
  const write = (key, val) => { try { if (storage) storage.setItem(key, val); } catch (_) { /* ignore */ } };
  const readJson = (key) => { try { const raw = read(key); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } };

  function loadMeta() {
    const m = readJson(opt.metaKey);
    if (m && isValidSaveCode(m.code)) {
      return { code: m.code, rev: Math.max(0, Math.floor(Number(m.rev) || 0)), dirty: !!m.dirty, lastSyncAt: Number(m.lastSyncAt) || 0 };
    }
    // First run with cloud save: a profile that already exists on the device still has to be uploaded.
    const fresh = { code: generateSaveCode(env.randomBytes), rev: 0, dirty: read(opt.profileKey) != null, lastSyncAt: 0 };
    write(opt.metaKey, JSON.stringify(fresh));
    return fresh;
  }
  let meta = enabled ? loadMeta() : { code: '', rev: 0, dirty: false, lastSyncAt: 0 };
  const saveMeta = () => write(opt.metaKey, JSON.stringify(meta));
  const currentPayload = () => buildSavePayload(read(opt.profileKey), read(opt.gamertagKey));
  if (enabled) { lastPayload = currentPayload(); status.lastSyncAt = meta.lastSyncAt; }

  function setStatus(state, message = '') {
    status = { state, lastSyncAt: meta.lastSyncAt, message };
    for (const cb of listeners) { try { cb(getStatus()); } catch (_) { /* ignore */ } }
    renderUI();
  }
  function getStatus() { return { ...status, code: meta.code, enabled }; }

  /* ---- network */
  async function request(url, init = {}) {
    let timer = null;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctrl) timer = setT(() => ctrl.abort(), opt.requestTimeoutMs);
    try {
      const res = await doFetch(url, { ...init, signal: ctrl ? ctrl.signal : undefined });
      let body = null;
      try { body = await res.json(); } catch (_) { body = null; }
      return { ok: res.ok, status: res.status, body };
    } finally {
      if (timer != null) clearT(timer);
    }
  }

  async function signUpAnonymous() {
    const r = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!r.ok || !r.body || !r.body.idToken) throw new Error(`sign-in failed (${r.status})`);
    idToken = r.body.idToken;
    idTokenExp = now() + (Number(r.body.expiresIn) || 3600) * 1000;
    write(opt.authKey, JSON.stringify({ refreshToken: r.body.refreshToken || '' }));
    return idToken;
  }

  async function refreshIdToken(refreshToken) {
    const r = await request(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    if (!r.ok || !r.body || !r.body.id_token) {
      // A rejected token (deleted / disabled guest account) is replaced with a new guest; a 5xx is a real failure.
      if (r.status >= 400 && r.status < 500) return '';
      throw new Error(`token refresh failed (${r.status})`);
    }
    idToken = r.body.id_token;
    idTokenExp = now() + (Number(r.body.expires_in) || 3600) * 1000;
    write(opt.authKey, JSON.stringify({ refreshToken: r.body.refresh_token || refreshToken }));
    return idToken;
  }

  async function getToken(forceNew = false) {
    if (!forceNew && idToken && now() < idTokenExp - 60000) return idToken;
    const saved = readJson(opt.authKey);
    if (saved && saved.refreshToken) {
      const t = await refreshIdToken(saved.refreshToken);
      if (t) return t;
    }
    return signUpAnonymous();
  }

  const docUrl = (code) => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}`
    + `/databases/(default)/documents/${encodeURIComponent(cfg.collection || 'saves')}/${encodeURIComponent(code)}`;

  async function authed(url, init, retry = true) {
    const token = await getToken();
    const r = await request(url, { ...init, headers: { ...(init && init.headers), Authorization: `Bearer ${token}` } });
    if (r.status === 401 && retry) { idToken = ''; idTokenExp = 0; return authed(url, init, false); }
    return r;
  }

  /** null when no save exists under that code. */
  async function fetchCloud(code) {
    const r = await authed(docUrl(code), { method: 'GET' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`cloud read failed (${r.status})`);
    const doc = fromFirestoreDoc(r.body);
    if (!doc) return null;
    const parsed = parseSavePayload(doc.save);
    return parsed ? { ...doc, ...parsed } : null;
  }

  async function pushCloud(code, rev, save, keepalive = false) {
    const body = JSON.stringify({ fields: toFirestoreFields({ rev, updatedAt: now(), save }) });
    return authed(docUrl(code), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: keepalive && body.length < 60000,
    });
  }

  async function deleteAllData() {
    let cloudDeleted = false;
    if (enabled && meta.code && isValidSaveCode(meta.code)) {
      try {
        const r = await authed(docUrl(meta.code), { method: 'DELETE' });
        cloudDeleted = r.ok || r.status === 404;
      } catch (_) {
        cloudDeleted = false;
      }
    }
    try {
      if (storage && typeof storage.removeItem === 'function') {
        const keys = [];
        for (let i = 0; i < (storage.length || 0); i++) {
          const k = storage.key(i);
          if (k && k.startsWith('hs_')) keys.push(k);
        }
        for (const k of keys) storage.removeItem(k);
        storage.removeItem(opt.profileKey);
        storage.removeItem(opt.gamertagKey);
        storage.removeItem(opt.metaKey);
        storage.removeItem(opt.authKey);
      }
    } catch (_) { /* ignore */ }
    meta = { code: '', rev: 0, lastSyncAt: 0 };
    reload();
    return { ok: true, cloudDeleted };
  }

  /* ---- sync */
  function applyCloudToDevice(cloud, code) {
    write(opt.profileKey, JSON.stringify(cloud.profile));
    if (cloud.gamertag) write(opt.gamertagKey, cloud.gamertag);
    meta = { code, rev: cloud.rev, dirty: false, lastSyncAt: now() };
    saveMeta();
    lastPayload = currentPayload();
  }

  async function syncOnce({ keepalive = false, allowPull = true } = {}) {
    const payload = currentPayload();
    if (payload && payload !== lastPayload) { meta.dirty = true; saveMeta(); }
    if (payload && payload.length > MAX_SAVE_CHARS) throw new Error('save too large');
    let localProfile = null;
    try { localProfile = payload ? JSON.parse(payload).profile : null; } catch (_) { localProfile = null; }

    for (let attempt = 0; attempt < 2; attempt++) {
      const cloud = await fetchCloud(meta.code);
      const action = decideSync({ cloud, localRev: meta.rev, localDirty: meta.dirty && !!payload, localProfile });
      if (action === 'none') {
        // Only claim "saved" when a cloud copy really exists (a brand-new player has none yet).
        if (cloud) { meta.rev = Math.max(meta.rev, cloud.rev); meta.lastSyncAt = now(); }
        saveMeta();
        return 'none';
      }
      if (action === 'pull') {
        if (!allowPull) return 'none';
        applyCloudToDevice(cloud, meta.code);
        return 'pull';
      }
      const rev = Math.max(meta.rev, cloud ? cloud.rev : 0) + 1;
      const r = await pushCloud(meta.code, rev, payload, keepalive);
      if (r.ok) {
        meta.rev = rev;
        meta.dirty = false;
        meta.lastSyncAt = now();
        saveMeta();
        lastPayload = payload;
        lastPushAt = now();
        return 'push';
      }
      // 403 = another device saved a newer revision in between: look again once.
      if (r.status !== 403 && r.status !== 409) throw new Error(`cloud write failed (${r.status})`);
    }
    throw new Error('cloud write kept being rejected');
  }

  function run(task) {
    if (!enabled) return Promise.resolve('off');
    if (busy) return busy;
    setStatus('syncing');
    busy = (async () => {
      try {
        const result = await task();
        setStatus('synced');
        return result;
      } catch (err) {
        const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false;
        setStatus(offline ? 'offline' : 'error', String((err && err.message) || err));
        return 'error';
      } finally {
        busy = null;
      }
    })();
    return busy;
  }

  /** Call once at startup: pulls a newer cloud copy (other device) or uploads pending changes. */
  async function start() {
    if (!enabled) return 'off';
    const result = await run(() => syncOnce({ allowPull: canReload() }));
    if (result === 'pull') reload();
    return result;
  }

  /** The game saved something on the device: upload it soon (coalesced, rate limited). */
  function notifyLocalChange() {
    if (!enabled || pushTimer != null) return;
    const wait = Math.max(opt.debounceMs, lastPushAt ? opt.minPushIntervalMs - (now() - lastPushAt) : 0);
    pushTimer = setT(() => { pushTimer = null; flush(); }, wait);
  }

  /** Upload now if anything changed (used when the app goes to the background). */
  function flush({ keepalive = false } = {}) {
    if (!enabled) return Promise.resolve('off');
    if (pushTimer != null) { clearT(pushTimer); pushTimer = null; }
    const payload = currentPayload();
    if (!meta.dirty && (!payload || payload === lastPayload)) return Promise.resolve('none');
    // Count the attempt from its start, so a save that lands while this upload is still in flight
    // (or after a failed one) waits out the full interval instead of firing again in a few seconds.
    lastPushAt = now();
    return run(() => syncOnce({ keepalive, allowPull: false }));
  }

  /** Replace this device's progress with the save stored under another recovery code. */
  async function restoreFromCode(input) {
    if (!enabled) return { ok: false, reason: 'off' };
    const code = normalizeSaveCode(input);
    if (!isValidSaveCode(code)) return { ok: false, reason: 'invalid' };
    if (code === meta.code) return { ok: false, reason: 'same' };
    if (busy) await busy;
    let outcome = { ok: false, reason: 'error' };
    await run(async () => {
      const cloud = await fetchCloud(code);
      if (!cloud) { outcome = { ok: false, reason: 'notfound' }; return 'none'; }
      applyCloudToDevice(cloud, code);
      outcome = { ok: true, level: progressOf(cloud.profile)[0] };
      return 'pull';
    });
    if (outcome.ok) reload();
    return outcome;
  }

  /* ---- UI: a small "Cloud Save" card */
  function statusLine() {
    const s = status.state;
    if (s === 'off') return 'Cloud save is off. Progress is kept on this device.';
    if (s === 'syncing') return '⏳ Syncing…';
    if (s === 'offline') return '📴 Offline. Progress is safe on this device and uploads when you are back online.';
    if (s === 'error') return '⚠️ Could not reach the cloud. Progress is safe on this device; trying again later.';
    if (meta.lastSyncAt) {
      const mins = Math.max(0, Math.round((now() - meta.lastSyncAt) / 60000));
      return `✅ Saved to the cloud ${mins < 1 ? 'just now' : mins === 1 ? '1 minute ago' : mins < 90 ? `${mins} minutes ago` : 'earlier'}`;
    }
    return '☁️ Your progress uploads after your first match.';
  }

  function renderUI() {
    if (!dom) return;
    dom.status.textContent = statusLine();
    dom.code.textContent = meta.code ? formatSaveCode(meta.code) : '—';
    dom.trigger.dataset.state = status.state;
  }

  function mountUI(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc || dom || !enabled) return;
    const trigger = doc.getElementById('btnCloudSave');
    const host = doc.body;
    if (!trigger || !host) return;
    const modal = doc.createElement('div');
    modal.id = 'cloudSaveModal';
    modal.className = 'cloud-modal hidden';
    modal.innerHTML = `
      <div class="cloud-card" role="dialog" aria-modal="true" aria-labelledby="cloudSaveTitle">
        <button type="button" class="cloud-x" id="cloudSaveClose" aria-label="Close">✕</button>
        <h3 id="cloudSaveTitle">☁️ Cloud Save</h3>
        <p class="cloud-status" id="cloudSaveStatus"></p>
        <div class="cloud-block">
          <small>Your recovery code</small>
          <div class="cloud-code-row">
            <code id="cloudSaveCode"></code>
            <button type="button" class="cloud-btn" id="cloudSaveCopy">Copy</button>
          </div>
          <p class="cloud-note">Write it down and keep it private. On a new phone, or after reinstalling, enter it below to get your level, tokens and unlocks back.</p>
        </div>
        <div class="cloud-block">
          <small>Restore progress from a code</small>
          <div class="cloud-code-row">
            <input id="cloudSaveInput" type="text" maxlength="29" spellcheck="false" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="Recovery code">
            <button type="button" class="cloud-btn warn" id="cloudSaveRestore">Restore</button>
          </div>
          <p class="cloud-note" id="cloudSaveMsg"></p>
        </div>
        <div class="cloud-block cloud-privacy-row">
          <a class="cloud-privacy-link" href="./privacy.html" target="_blank" rel="noopener">🔒 Privacy Policy</a>
          <button type="button" class="cloud-btn danger" id="cloudSaveDelete">🗑️ Delete Save Data</button>
        </div>
      </div>`;
    host.appendChild(modal);
    const $ = (id) => doc.getElementById(id);
    dom = { trigger, modal, status: $('cloudSaveStatus'), code: $('cloudSaveCode'), copy: $('cloudSaveCopy'), input: $('cloudSaveInput'), restore: $('cloudSaveRestore'), msg: $('cloudSaveMsg'), del: $('cloudSaveDelete') };
    let armed = false;
    let deleteArmed = false;
    const disarm = () => {
      armed = false; dom.restore.textContent = 'Restore';
      deleteArmed = false; if (dom.del) dom.del.textContent = '🗑️ Delete Save Data';
    };
    const open = () => { disarm(); dom.msg.textContent = ''; dom.input.value = ''; modal.classList.remove('hidden'); renderUI(); };
    const close = () => modal.classList.add('hidden');
    trigger.addEventListener('click', open);
    $('cloudSaveClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    // Keep typing inside the code box away from the game's keyboard shortcuts.
    for (const type of ['keydown', 'keyup', 'keypress']) dom.input.addEventListener(type, (e) => e.stopPropagation());
    dom.input.addEventListener('input', () => {
      disarm();
      // group as XXXX-XXXX-… while typing so the code is easy to check against the written one
      const tidy = formatSaveCode(normalizeSaveCode(dom.input.value).slice(0, SAVE_CODE_LEN));
      if (tidy !== dom.input.value) dom.input.value = tidy;
    });
    dom.copy.addEventListener('click', async () => {
      const text = formatSaveCode(meta.code);
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (_) { ok = false; }
      dom.copy.textContent = ok ? 'Copied ✓' : 'Select it';
      if (!ok) { try { const r = doc.createRange(); r.selectNodeContents(dom.code); const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (_) { /* ignore */ } }
      setT(() => { dom.copy.textContent = 'Copy'; }, 1800);
    });
    dom.restore.addEventListener('click', async () => {
      const code = normalizeSaveCode(dom.input.value);
      if (!isValidSaveCode(code)) { disarm(); dom.msg.textContent = 'That code is not complete. It has 20 letters and numbers.'; return; }
      if (code === meta.code) { disarm(); dom.msg.textContent = 'That is this device\'s own code. Nothing to restore.'; return; }
      if (!armed) {
        armed = true;
        dom.restore.textContent = 'Yes, replace';
        dom.msg.textContent = 'This replaces the progress on this device with the save from that code. Tap again to confirm.';
        return;
      }
      disarm();
      dom.msg.textContent = 'Looking for your save…';
      const res = await restoreFromCode(code);
      if (res.ok) dom.msg.textContent = `Found it (level ${res.level}). Loading…`;
      else if (res.reason === 'notfound') dom.msg.textContent = 'No save found for that code. Check it and try again.';
      else dom.msg.textContent = 'Could not reach the cloud. Check your connection and try again.';
    });
    if (dom.del) {
      dom.del.addEventListener('click', async () => {
        if (!deleteArmed) {
          deleteArmed = true;
          armed = false;
          dom.restore.textContent = 'Restore';
          dom.del.textContent = 'Confirm Delete';
          dom.msg.textContent = 'Permanently deletes your cloud backup and resets local progress. Tap again to confirm.';
          return;
        }
        dom.del.textContent = 'Deleting…';
        dom.msg.textContent = 'Removing cloud & device save data…';
        await deleteAllData();
      });
    }
    if (typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') flush({ keepalive: true }); });
    }
    renderUI();
  }

  return {
    enabled,
    start,
    notifyLocalChange,
    flush,
    restoreFromCode,
    deleteAllData,
    getStatus,
    getCode: () => meta.code,
    /** Anonymous guest token, shared with analytics so one guest account is used per install. */
    getAuthToken: () => getToken(),
    onStatus: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    mountUI,
  };
}
