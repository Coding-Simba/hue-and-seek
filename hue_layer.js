/* ============================================================================
 * Hue & Seek — The Hue Layer (hue_layer.js)
 *
 * The systems that make the "Hue" in the name matter and keep both teams busy:
 *
 *   1. PAINT — a disguise is shape + paint. Paint fades during the hunt and is
 *      washed off by every hit. A faded prop turns pale and seekers (human and
 *      bot) notice it. Hiders repaint with [V] (stand still for a moment — it
 *      is audible and visible) or by grabbing a Paint Pot.
 *   2. PAINT POTS — glowing pots appear around the map. Grabbing one gives a
 *      fresh coat that does not fade for a while, squad points and tokens, but
 *      the hider has to leave cover to reach it and the grab can be heard.
 *   3. GHOSTS — a soaked hider is not out of the game: they roam as a ghost and
 *      haunt real props to pull seekers away from living teammates.
 *   4. WATER TANK & WELLS — seekers no longer have infinite water. The tank
 *      drains per shot, trickles back slowly, and refills quickly at a well.
 *
 * Everything gameplay-relevant is a constant in HUE_RULES, and the maths lives
 * in small pure functions (exported for tests).
 * ========================================================================== */

export const HUE_RULES = Object.freeze({
  // --- paint
  PAINT_DRAIN_SEC: 75,          // full coat -> bare, while disguised during the hunt
  FADE_START: 0.85,             // the disguise starts to look washed-out as soon as paint drops below this…
  FADE_FULL: 0.15,              // …and is ghost-pale at this level: the fade is visible the whole way down
  TELL_START: 0.55,             // bot seekers only start reading the fade as a tell below this (keeps hiding fair)
  HIT_WASH: 0.015,              // paint lost per hit (any element) — a splash, not a death spiral
  HIT_WASH_WATER: 0.025,        // paint lost per water hit
  REPAINT_CHANNEL_SEC: 0.8,     // must hold still this long
  REPAINT_CD_SEC: 4,
  REPAINT_GRACE_SEC: 4,         // fresh paint does not fade for this long
  REPAINT_HEAR_RADIUS: 8.5,
  // --- paint pots
  POT_COUNT: 3,
  POT_RADIUS: 1.3,
  POT_RESPAWN_SEC: 9,
  POT_FRESH_SEC: 15,
  POT_POINTS: 25,
  POT_POINTS_CAP: 150,
  POT_TOKENS: 8,
  POT_XP: 12,
  POT_HEAR_RADIUS: 12,
  // --- ghosts
  HAUNT_RANGE: 4.5,
  HAUNT_CD_SEC: 6,
  HAUNT_HEAR_RADIUS: 15,
  HAUNT_POINTS: 12,
  HAUNT_POINTS_CAP: 96,
  HAUNT_TOKENS: 4,
  HAUNT_XP: 6,
  GHOST_SPEED_MUL: 1.4,
  // --- seeker water
  TANK_MAX: 320,                // ~27s of non-stop spraying: enough for several full chases before a top-up
  BOT_TANK_MAX: 200,            // bot seekers carry less, so they still leave to refill and give hiders a breather
  SHOT_COST: 1,
  FRENZY_COST_MUL: 0.5,
  TRICKLE_PER_SEC: 8,
  TRICKLE_DELAY_SEC: 1.0,
  // An empty tank never stops you shooting — the blaster just sputters (slower, shorter stream) until you top up.
  DRY_FIRE_INTERVAL_MUL: 2.6,
  DRY_SHOT_SPEED_MUL: 0.72,
  // Topping up at a well is a reward, not a chore: a full tank comes with a few seconds of extra soaking power.
  WELL_BOOST_SEC: 8,
  WELL_BOOST_DAMAGE_MUL: 1.3,
  WELL_REFILL_PER_SEC: 170,     // a full recharge takes under 2 seconds
  WELL_RADIUS: 2.4,
  WELL_COUNT: 4,
  // --- round outcome
  ROUND_WIN_BONUS: 150,
});

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

// ----------------------------------------------------------------------------
// Pure rules (unit-tested in tests/)
// ----------------------------------------------------------------------------

/** 0 = fully painted look, 1 = completely washed out. */
export function paintFadeAmount(paint) {
  const p = clamp(Number.isFinite(paint) ? paint : 1, 0, 1);
  // eased: a light dusting at first (you can still pass a glance), unmistakably pale by ~40%, ghost-white near empty
  return Math.pow(clamp((HUE_RULES.FADE_START - p) / (HUE_RULES.FADE_START - HUE_RULES.FADE_FULL), 0, 1), 1.5);
}

export function drainPaint(paint, dt, drainSec = HUE_RULES.PAINT_DRAIN_SEC) {
  return clamp((Number.isFinite(paint) ? paint : 1) - Math.max(0, dt) / drainSec, 0, 1);
}

export function washPaint(paint, elemId = 'water') {
  const loss = elemId === 'water' ? HUE_RULES.HIT_WASH_WATER : HUE_RULES.HIT_WASH;
  return clamp((Number.isFinite(paint) ? paint : 1) - loss, 0, 1);
}

/** How much extra attention a stationary disguised hider draws because of faded paint (added to the bot suspicion rate). */
export function paintSuspicionBoost(paint) {
  const p = clamp(Number.isFinite(paint) ? paint : 1, 0, 1);
  const t = clamp((HUE_RULES.TELL_START - p) / HUE_RULES.TELL_START, 0, 1);
  return t * t * (3 - 2 * t) * 0.9;
}

/** Returns { ok, tank } — ok=false means the shot must not be fired. */
export function spendTank(tank, cost = HUE_RULES.SHOT_COST) {
  const t = Number.isFinite(tank) ? tank : HUE_RULES.TANK_MAX;
  if (t < cost) return { ok: false, tank: Math.max(0, t) };
  return { ok: true, tank: t - cost };
}

export function refillTank(tank, dt, { atWell = false, idleSec = 0 } = {}) {
  let t = Number.isFinite(tank) ? tank : HUE_RULES.TANK_MAX;
  if (atWell) t += HUE_RULES.WELL_REFILL_PER_SEC * dt;
  else if (idleSec >= HUE_RULES.TRICKLE_DELAY_SEC) t += HUE_RULES.TRICKLE_PER_SEC * dt;
  return clamp(t, 0, HUE_RULES.TANK_MAX);
}

/**
 * Bot skill 0.18 (gentle) .. 1 (sharp), from how the player has been doing.
 * New players get slow, forgiving bots; levels and win streaks sharpen them; losing streaks ease them off.
 */
export function computeBotDifficulty({ level = 1, winStreak = 0, lossStreak = 0 } = {}) {
  const lv = clamp(Math.floor(Number(level) || 1), 1, 99);
  const d = 0.28 + Math.min(lv - 1, 30) * 0.014 + clamp(winStreak, 0, 6) * 0.07 - clamp(lossStreak, 0, 5) * 0.08;
  return clamp(d, 0.18, 1);
}

/** Greedy farthest-point pick: `count` points from `candidates` that keep at least `minSep` apart where possible. */
export function pickSpreadPoints(candidates, count, minSep = 10, seed = null) {
  const pool = (candidates || []).filter((c) => c && Number.isFinite(c.x) && Number.isFinite(c.z));
  const out = [];
  if (!pool.length || count <= 0) return out;
  let first = pool[0];
  if (seed) {
    let best = Infinity;
    for (const c of pool) { const d = Math.hypot(c.x - seed.x, c.z - seed.z); if (d < best) { best = d; first = c; } }
  }
  out.push(first);
  while (out.length < count) {
    let pick = null, pickD = -1;
    for (const c of pool) {
      if (out.includes(c)) continue;
      let dMin = Infinity;
      for (const o of out) dMin = Math.min(dMin, Math.hypot(c.x - o.x, c.z - o.z));
      if (dMin > pickD) { pickD = dMin; pick = c; }
    }
    if (!pick || pickD < Math.min(minSep, 3)) break;
    out.push(pick);
  }
  return out;
}

/** Squad points earned through the Hue layer this round (capped). */
export function hueRoundPoints({ paintPots = 0, haunts = 0 } = {}) {
  return (
    Math.min(HUE_RULES.POT_POINTS_CAP, Math.max(0, paintPots) * HUE_RULES.POT_POINTS) +
    Math.min(HUE_RULES.HAUNT_POINTS_CAP, Math.max(0, haunts) * HUE_RULES.HAUNT_POINTS)
  );
}

// ----------------------------------------------------------------------------
// Manager
// ----------------------------------------------------------------------------
const FORM_KEY = 'hs_form_v1';
const POT_COLORS = [0xff5d8f, 0x3fb8d8, 0xffc23d, 0x6fd06a, 0xb07cff, 0xff8a3d];

export function createHueLayerManager(env) {
  const { THREE, scene, G } = env;
  const now = () => env.simNow();
  const WASH = new THREE.Color(0xf6f4ee);
  const WASH_GLOW = new THREE.Color(0x8a93a1);

  let wells = [];
  let pots = [];
  let potSeq = 0;
  let potRespawns = [];       // { at }
  let wobbles = [];           // haunted real props
  let fx = [];                // tiny particle meshes
  let ghostMats = [];
  let huntStarted = false;
  let fadeHintShown = false;
  let tankHintAt = -1e9;
  let lastFireAt = -1e9;
  let botGhostT = rand(6, 10);
  let ui = null;
  const _hud = {};

  const isLive = () => !!(env.getMP && env.getMP() && env.getMP().isLiveSession());
  const isAuth = () => !isLive() || env.getMP().isMaster();
  const huntActive = () => (G.phase === 'survive' || G.phase === 'seek') && !G.over && !G.isTutorial;
  const kit = () => (env.getKit ? env.getKit() : null);
  const livingHiders = () => (G.allHiders || []).filter((h) => h && !h.userData?.actor?.eliminated);
  const livingSeekers = () => (G.allSeekers || []).filter((s) => s && !s.userData?.actor?.eliminated);
  const net = (payload) => { if (isLive()) { try { env.getMP().broadcastGadget(payload); } catch (_) { /* offline */ } } };

  // ------------------------------------------------------------------ tiny fx
  const fxGeo = new THREE.SphereGeometry(0.07, 8, 6);
  function burst(pos, colors, n = 10, opts = {}) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.95, depthWrite: false });
      const m = new THREE.Mesh(fxGeo, mat);
      const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = opts.radius ?? 0.55;
      m.position.set(pos.x + Math.cos(a) * r, pos.y + rand(0.05, 0.35), pos.z + Math.sin(a) * r);
      m.scale.setScalar(rand(0.8, 1.6) * (opts.scale ?? 1));
      scene.add(m);
      fx.push({ m, a, r, cx: pos.x, cz: pos.z, vy: rand(0.9, 1.9) * (opts.rise ?? 1), spin: rand(2.4, 4.2) * (i % 2 ? 1 : -1), t: 0, life: opts.life ?? 0.95, out: opts.out ?? 0.5 });
    }
  }
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      const u = f.t / f.life;
      if (f.stream) {
        // arc from the well up into the seeker's blaster
        const to = f.stream.to();
        const k = Math.min(1, u);
        f.m.position.set(
          f.stream.from.x + (to.x - f.stream.from.x) * k,
          f.stream.from.y + (to.y - f.stream.from.y) * k + Math.sin(k * Math.PI) * 0.55,
          f.stream.from.z + (to.z - f.stream.from.z) * k
        );
        f.m.material.opacity = 0.95;
        f.m.scale.setScalar(f.s0 * (1 - k * 0.78));   // droplets shrink as they reach the blaster
        if (u >= 1) { scene.remove(f.m); f.m.material.dispose(); fx.splice(i, 1); }
        continue;
      }
      f.a += f.spin * dt; f.r += f.out * dt;
      f.m.position.x = f.cx + Math.cos(f.a) * f.r;
      f.m.position.z = f.cz + Math.sin(f.a) * f.r;
      f.m.position.y += f.vy * dt;
      f.m.material.opacity = Math.max(0, 0.95 * (1 - u * u));
      if (u >= 1) { scene.remove(f.m); f.m.material.dispose(); fx.splice(i, 1); }
    }
  }

  function streamBit(from, toFn, colorHex) {
    const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95, depthWrite: false }));
    const s0 = rand(0.7, 1.15);
    m.scale.setScalar(s0);
    m.position.set(from.x, from.y, from.z);
    scene.add(m);
    fx.push({ m, s0, t: 0, life: rand(0.28, 0.4), stream: { from, to: toFn } });
  }

  const _emojiTex = new Map();
  function emojiTexture(emoji) {
    let tex = _emojiTex.get(emoji);
    if (!tex) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fillStyle = 'rgba(255,250,236,0.94)'; g.fill();
      g.lineWidth = 6; g.strokeStyle = 'rgba(60,70,50,0.35)'; g.stroke();
      g.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 70);
      tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      _emojiTex.set(emoji, tex);
    }
    return tex;
  }
  function emojiSprite(emoji, size = 0.9) {
    const tex = emojiTexture(emoji);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(size, size, 1); sp.renderOrder = 6;
    return sp;
  }

  // ------------------------------------------------------------------ 1. paint
  function disposePaint(u) {
    if (u && u.huePaint) { for (const p of u.huePaint) p.mat.dispose(); u.huePaint = null; }
  }

  /** Give this hider's disguise its own materials so its paint can fade without touching the real props. */
  function onDisguise(ch) {
    const u = ch?.userData; if (!u) return;
    disposePaint(u);
    u.hueChannelUntil = 0;
    if (!u.disguise) return;
    const seen = new Map(); const list = [];
    const swap = (mat) => {
      if (!mat || !mat.color || !mat.isMaterial || mat.isShaderMaterial) return mat;
      let c = seen.get(mat);
      if (!c) {
        c = mat.clone();
        if (mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) c.onBeforeCompile = mat.onBeforeCompile;
        if (typeof mat.customProgramCacheKey === 'function') c.customProgramCacheKey = mat.customProgramCacheKey;
        seen.set(mat, c);
        list.push({ mat: c, base: mat.color.clone(), em: mat.emissive ? mat.emissive.clone() : null });
      }
      return c;
    };
    u.disguise.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
    u.huePaint = list;
    u.hueApplied = -1;
    if (u.hue == null || !huntActive()) u.hue = 1;
  }

  function onUndisguise(ch) {
    const u = ch?.userData; if (!u) return;
    disposePaint(u);
    u.hueChannelUntil = 0;
  }

  function applyPaint(u) {
    if (!u.huePaint) return;
    const fade = paintFadeAmount(u.hue);
    for (const p of u.huePaint) {
      p.mat.color.copy(p.base).lerp(WASH, fade * 0.9);
      if (p.em) p.mat.emissive.copy(p.em).lerp(WASH_GLOW, fade);
    }
    u.hueApplied = u.hue;
  }

  function onHiderHit(ch, elemId = 'water') {
    const u = ch?.userData; if (!u || G.isTutorial) return;
    if (u.propId && !u.specialMode) u.hue = washPaint(u.hue, elemId);
    u.hueChannelUntil = 0; // a hit interrupts repainting
  }

  function paintColorsFor(ch) {
    const u = ch.userData;
    const cols = (u.huePaint || []).slice(0, 4).map((p) => p.base.getHex());
    return cols.length ? cols : POT_COLORS;
  }

  function startRepaint(ch, { silent = false } = {}) {
    const u = ch.userData;
    const t = now();
    u.hueChannelUntil = t + HUE_RULES.REPAINT_CHANNEL_SEC * 1000;
    u.hueChannelFrom = u.hue ?? 1;
    u.hueCdUntil = t + HUE_RULES.REPAINT_CD_SEC * 1000;
    u.hueBusyUntil = u.hueChannelUntil;
    const c = env.centerOf(ch);
    burst({ x: c.x, y: (u.groundY || 0) + (u.specialY || 0), z: c.z }, paintColorsFor(ch), 12, { radius: (u.radius || 0.5) + 0.2, life: HUE_RULES.REPAINT_CHANNEL_SEC, out: 0.15, rise: 0.9 });
    if (!silent) {
      const ai = env.getAI && env.getAI();
      if (ai) ai.emitSoundCue(ch.position, HUE_RULES.REPAINT_HEAR_RADIUS, 'poof', ch);
    }
  }

  function finishRepaint(ch) {
    const u = ch.userData;
    u.hueChannelUntil = 0;
    u.hue = 1;
    u.hueFreshUntil = now() + HUE_RULES.REPAINT_GRACE_SEC * 1000;
    if (env.getMatchFlow && env.getMatchFlow()) env.getMatchFlow().recordStat(ch, 'repaints', 1);
    if (ch === G.player) {
      env.audio?.poof?.(true);
      env.haptics?.morph?.();
      env.hint('🎨 Fresh coat! You blend in perfectly again.', 1500);
    }
  }

  /** Local hider presses [V] / the Repaint pill. */
  function tryRepaint() {
    const p = G.player; const u = p?.userData;
    if (!p || G.mode !== 'hide' || G.over || G.spectating || G.ghost || u.actor?.eliminated) return false;
    if (G.isTutorial) { env.hint('🎨 Repainting matters in real matches — your paint fades during the hunt!', 1800); return false; }
    if (!u.propId || u.specialMode) { env.hint('🎨 Morph into a prop first — paint only matters on a disguise.', 1500); return false; }
    const t = now();
    if ((u.hueChannelUntil || 0) > t) return false;
    if ((u.hueCdUntil || 0) > t) { env.hint(`🎨 Brush is drying… ${Math.ceil((u.hueCdUntil - t) / 1000)}s`, 900); return false; }
    if ((u.hue ?? 1) > 0.97) { env.hint('🎨 Your paint is already fresh.', 900); return false; }
    if (G.moving) { env.hint('🎨 Stand still to repaint!', 1000); return false; }
    startRepaint(p);
    env.audio?.tap?.();
    env.hint('🎨 Repainting… hold still! Seekers nearby can hear the brush.', 1300);
    return true;
  }

  function updatePaint(dt) {
    const t = now();
    const hunt = huntActive();
    const hiders = G.allHiders || [];
    for (const h of hiders) {
      if (!h) continue;
      const u = h.userData;
      if (u.actor?.eliminated) continue;
      const isLocal = h === G.player;
      const isRemote = !!u.actor?.isRemote;
      if (!u.propId || u.specialMode || !u.huePaint) continue;
      if (u.hue == null) u.hue = 1;

      if (!isRemote) {
        // a repaint in progress
        if ((u.hueChannelUntil || 0) > 0) {
          const moved = isLocal ? G.moving : (u.spd || 0) > 0.6;
          if (moved) {
            u.hueChannelUntil = 0;
            if (isLocal) env.hint('🎨 Repaint interrupted — you moved!', 1100);
          } else if (t >= u.hueChannelUntil) {
            finishRepaint(h);
          } else {
            // paint flows back in over the brush stroke (an interrupted repaint keeps what it got)
            const k = 1 - (u.hueChannelUntil - t) / (HUE_RULES.REPAINT_CHANNEL_SEC * 1000);
            u.hue = Math.max(u.hue, lerp(u.hueChannelFrom ?? u.hue, 1, clamp(k, 0, 1)));
          }
        }
        if (hunt && t > (u.hueFreshUntil || 0) && !(u.hueChannelUntil > 0)) u.hue = drainPaint(u.hue, dt);

        // bot hiders touch up when nobody is looking
        if (hunt && u.actor?.isBot && u.ai && !(u.hueChannelUntil > 0) && t > (u.hueCdUntil || 0)) {
          if (u.ai.paintNerve == null) u.ai.paintNerve = rand(0.22, 0.42);
          if (u.hue < u.ai.paintNerve && u.ai.state === 'hidden' && (u.spd || 0) < 0.3) {
            let nearest = 99;
            for (const s of livingSeekers()) nearest = Math.min(nearest, Math.hypot(s.position.x - h.position.x, s.position.z - h.position.z));
            const watched = !!u.ai._cachedAnySeekerLOS;
            if ((!watched && nearest > 8) || u.hue < 0.1) startRepaint(h);
          }
        }

        // a badly faded disguise drips now and then
        if (hunt && u.hue < 0.45) {
          u.hueDripT = (u.hueDripT || 0) - dt;
          if (u.hueDripT <= 0) {
            u.hueDripT = rand(1.1, 1.9);
            const c = env.centerOf(h);
            burst({ x: c.x, y: (u.groundY || 0), z: c.z }, [0xf6f4ee, 0xdfe8f2], 3, { radius: (u.radius || 0.5) * 0.7, life: 0.7, rise: 0.25, out: 0.2, scale: 0.7 });
          }
        }
      }
      if (Math.abs((u.hueApplied ?? -1) - u.hue) > 0.012) applyPaint(u);
    }

    // one-time nudge for the local hider
    const p = G.player;
    if (hunt && G.mode === 'hide' && p && !G.ghost && !G.spectating && p.userData.propId && !fadeHintShown && (p.userData.hue ?? 1) < 0.62) {
      fadeHintShown = true;
      env.hint(`🎨 Look — your disguise is going pale! Seekers spot pale props. ${env.isTouch ? 'Tap Repaint' : 'Press V'} (hold still) or grab a Paint Pot.`, 3800);
      env.pushFeed('🎨', '<b>Paint fading!</b> Repaint or grab a Paint Pot.', 'warn');
    }
  }

  // ------------------------------------------------------------------ candidates on the map
  function slotCandidates() {
    const out = []; const seen = new Set();
    const R = (env.getMapRadius ? env.getMapRadius() : 40) - 3;
    for (const q of env.SLOTS || []) {
      if (!q || Math.hypot(q.x, q.z) > R) continue;
      const key = `${Math.round(q.x / 5)},${Math.round((q.y || 0) / 2.5)},${Math.round(q.z / 5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x: q.x, y: q.y || 0, z: q.z });
    }
    return out;
  }

  function safeGroundNear(c, r, avoid, minSep) {
    try {
      const v = env.findSafeSpawn(c.x, c.z, r, avoid, minSep, c.y || 0);
      return v ? { x: v.x, y: v.y, z: v.z } : null;
    } catch (_) { return null; }
  }

  // ------------------------------------------------------------------ 4. wells + tank
  function buildWellMesh() {
    const g = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0xa9b0b3 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a33 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.96, 0.26, 18), stone); basin.position.y = 0.13; g.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.07, 8, 22), stone); rim.rotation.x = Math.PI / 2; rim.position.y = 0.27; g.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.76, 22), new THREE.MeshBasicMaterial({ color: 0x66d4f7, transparent: true, opacity: 0.88 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.25; g.add(water);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.35, 8), wood); post.position.set(0.72, 0.68, 0); g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.07), wood); arm.position.set(0.45, 1.3, 0); g.add(arm);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6), new THREE.MeshBasicMaterial({ color: 0x9be4ff, transparent: true, opacity: 0.7 }));
    spout.position.set(0.16, 0.8, 0); g.add(spout);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.2, 28), new THREE.MeshBasicMaterial({ color: 0x66d4f7, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03; g.add(glow);
    const tag = emojiSprite('💧', 0.95); tag.position.y = 2.25; tag.material.depthTest = false; g.add(tag);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = m !== water && m !== glow && m !== spout; } });
    g.userData = { water, spout, glow, tag };
    return g;
  }

  function buildWells() {
    clearWells();
    if (G.isTutorial) return;
    const act = env.getActiveMap ? env.getActiveMap() : null;
    // never drop a well on a spawn point (nobody wants to start a round standing inside a basin)
    const spawns = [];
    const addSpawn = (v) => { if (Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1])) spawns.push({ x: v[0], z: v[1] }); };
    if (act) { addSpawn(act.seekSpawn); addSpawn(act.playerSpawn); for (const sp of (act.seekerSpawns || [])) addSpawn(sp); }
    if (!spawns.length) { addSpawn([-2, -4]); addSpawn([-3, 6]); }
    for (const c of [G.player, ...(G.allSeekers || [])]) { if (c) spawns.push({ x: c.position.x, z: c.position.z }); }
    const clearOfSpawns = (p, r) => spawns.every((sp) => Math.hypot(sp.x - p.x, sp.z - p.z) >= r);

    const seed = spawns[0];
    const cands = slotCandidates().filter((c) => clearOfSpawns(c, 7));
    // one well a short walk from where the seekers land, the rest spread over the map
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      cands.push({ x: seed.x + Math.cos(a) * 8.5, y: 0, z: seed.z + Math.sin(a) * 8.5 });
    }
    const picks = pickSpreadPoints(cands, HUE_RULES.WELL_COUNT, 12, seed);
    const placed = [];
    for (const c of picks) {
      const p = safeGroundNear(c, 1.05, [...placed, ...spawns.map((sp) => ({ x: sp.x, y: 0, z: sp.z }))], 6);
      if (!p || !clearOfSpawns(p, 5)) continue;
      placed.push(p);
      const m = buildWellMesh();
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = rand(0, Math.PI * 2);
      scene.add(m);
      wells.push({ x: p.x, y: p.y, z: p.z, m });
    }
  }

  function clearWells() {
    for (const w of wells) scene.remove(w.m);
    wells = [];
  }

  function nearestWell(pos, maxDy = 2.6) {
    let best = null, bd = Infinity;
    for (const w of wells) {
      const d = Math.hypot(w.x - pos.x, w.z - pos.z) + Math.abs((w.y || 0) - (pos.y || 0)) * 2;
      if (d < bd) { bd = d; best = w; }
    }
    if (!best) return null;
    return { well: best, dist: Math.hypot(best.x - pos.x, best.z - pos.z), sameLevel: Math.abs((best.y || 0) - (pos.y || 0)) < maxDy };
  }

  const shotCost = () => HUE_RULES.SHOT_COST * (env.isOvertime && env.isOvertime() ? HUE_RULES.FRENZY_COST_MUL : 1);

  /**
   * Called for every shot the local seeker fires. It always fires: with water in the tank at full pressure,
   * with an empty tank as a weak sputter (see isSputtering) until the seeker tops up or the trickle catches up.
   */
  function spendWater() {
    if (G.isTutorial || G.player?.userData?.inTurret) return true;
    const res = spendTank(G.tank, shotCost());
    G.tank = res.tank;
    lastFireAt = now();
    if (res.ok) return true;
    const t = now();
    if (t - tankHintAt > 6000) {
      tankHintAt = t;
      const nw = G.player ? nearestWell({ x: G.player.position.x, y: G.player.userData.groundY || 0, z: G.player.position.z }) : null;
      const el = currentElement();
      env.hint(nw ? `${el.icon} Running low! Recharge at the well ${Math.round(nw.dist)}m away (any blaster) for full power + a boost.` : `${el.icon} Running low! Ease off for a second and it comes back.`, 2400);
    }
    return true;
  }
  /** true while the local seeker's tank is dry: the blaster still works, just slower and with a shorter stream. */
  const isSputtering = () => !G.isTutorial && G.mode === 'seek' && (G.tank ?? HUE_RULES.TANK_MAX) < shotCost();
  const getFireIntervalMul = () => (isSputtering() ? HUE_RULES.DRY_FIRE_INTERVAL_MUL : 1);
  const getShotSpeedMul = () => (isSputtering() ? HUE_RULES.DRY_SHOT_SPEED_MUL : 1);
  /** Damage multiplier for the local seeker's hits (the "fresh pressure" boost after topping up at a well). */
  const getDamageMul = () => (now() < (G.wellBoostUntil || 0) ? HUE_RULES.WELL_BOOST_DAMAGE_MUL : 1);

  /** The element the local seeker is carrying: wells recharge any of them, and take on its colour while they do. */
  function currentElement() {
    const sp = (env.getElementSpec && env.getElementSpec()) || null;
    return {
      id: sp?.id || 'water',
      icon: sp?.icon || '💧',
      name: sp?.shortName || 'Water',
      hex: Number.isFinite(sp?.accentHex) ? sp.accentHex : 0x3fb8d8,
      css: sp?.hudBg || '#2b8fb8',
    };
  }
  let wellElemId = '';
  const _gunFwd = new THREE.Vector3();
  const _gunRight = new THREE.Vector3();
  function tintWellsFor(el) {
    if (wellElemId === el.id) return;
    wellElemId = el.id;
    const tex = emojiTexture(el.id === 'water' ? '💧' : el.icon);
    for (const w of wells) {
      const ud = w.m.userData;
      ud.tag.material.map = tex; ud.tag.material.needsUpdate = true;
      ud.water.material.color.setHex(el.id === 'water' ? 0x66d4f7 : el.hex);
      ud.spout.material.color.setHex(el.id === 'water' ? 0x9be4ff : el.hex);
      ud.glow.material.color.setHex(el.id === 'water' ? 0x66d4f7 : el.hex);
    }
  }

  function updateTank(dt) {
    const p = G.player;
    if (!p || G.mode !== 'seek' || G.isTutorial) return;
    if (G.tank == null) G.tank = HUE_RULES.TANK_MAX;
    const t = now();
    const el = currentElement();
    tintWellsFor(el);
    const here = { x: p.position.x, y: p.userData.groundY || 0, z: p.position.z };
    const nw = nearestWell(here);
    // refilling needs both hands: it only runs while you are not spraying
    const atWell = !!(nw && nw.sameLevel && nw.dist <= HUE_RULES.WELL_RADIUS) && G.phase === 'seek' && !G.over && (t - lastFireAt) > 350;
    const before = G.tank;
    G.tank = refillTank(G.tank, dt, { atWell, idleSec: (t - lastFireAt) / 1000 });
    G.tankRefilling = atWell && G.tank < HUE_RULES.TANK_MAX;
    if (atWell && before < HUE_RULES.TANK_MAX) {
      // a stream of the element you carry arcs out of the well into your blaster
      G._wellStreamT = (G._wellStreamT || 0) - dt;
      if (G._wellStreamT <= 0) {
        G._wellStreamT = 0.045;
        const from = { x: nw.well.x + rand(-0.25, 0.25), y: nw.well.y + 0.35, z: nw.well.z + rand(-0.25, 0.25) };
        const cam = env.camera;
        // aim at the blaster (low and to the right of the view), not at the player's eyes
        streamBit(from, () => {
          _gunFwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
          _gunRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
          return {
            x: cam.position.x + _gunFwd.x * 0.75 + _gunRight.x * 0.3,
            y: cam.position.y + _gunFwd.y * 0.75 - 0.36,
            z: cam.position.z + _gunFwd.z * 0.75 + _gunRight.z * 0.3,
          };
        }, el.hex);
      }
      G._wellSplashT = (G._wellSplashT || 0) - dt;
      if (G._wellSplashT <= 0) { G._wellSplashT = 0.22; env.ripple?.(new THREE.Vector3(nw.well.x, nw.well.y, nw.well.z), 0.9); env.audio?.tap?.(); }
      if (G.tank >= HUE_RULES.TANK_MAX) {
        G.wellBoostUntil = t + HUE_RULES.WELL_BOOST_SEC * 1000;
        burst({ x: nw.well.x, y: nw.well.y + 0.3, z: nw.well.z }, [el.hex, 0xffffff], 14, { radius: 0.5, life: 0.8, out: 1.4, rise: 1.5 });
        env.hint(`${el.icon} ${el.name} blaster fully recharged! +${Math.round((HUE_RULES.WELL_BOOST_DAMAGE_MUL - 1) * 100)}% power for ${HUE_RULES.WELL_BOOST_SEC}s`, 2000);
        env.haptics?.morph?.();
        env.audio?.found?.(false);
      }
    }
    G.tankWell = nw;
  }

  // ------------------------------------------------------------------ 2. paint pots
  function buildPotMesh(colorHex) {
    const g = new THREE.Group();
    const clay = new THREE.MeshLambertMaterial({ color: 0xf1e3c8 });
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.17, 0.32, 14), clay); jar.position.y = 0.16; g.add(jar);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), clay); rim.rotation.x = Math.PI / 2; rim.position.y = 0.32; g.add(rim);
    const paint = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.55 }));
    paint.position.y = 0.3; paint.scale.y = 0.55; g.add(paint);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 3.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 1.9; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 24), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    const tag = emojiSprite('🎨', 0.8); tag.position.y = 1.45; g.add(tag);
    jar.castShadow = true;
    g.userData = { beam, ring, tag, paint };
    return g;
  }

  function addPot(id, x, y, z, colorHex) {
    if (pots.some((q) => q.id === id)) return;
    const m = buildPotMesh(colorHex);
    m.position.set(x, y, z);
    // hiders can find pots through walls; seekers have to actually see them
    m.userData.tag.material.depthTest = G.mode !== 'hide';
    scene.add(m);
    pots.push({ id, x, y, z, color: colorHex, m, born: now() });
  }

  function removePot(id) {
    const i = pots.findIndex((q) => q.id === id);
    if (i < 0) return null;
    const pot = pots[i];
    scene.remove(pot.m);
    pots.splice(i, 1);
    return pot;
  }

  function spawnPot() {
    if (!isAuth()) return;
    const cands = slotCandidates();
    if (!cands.length) return;
    const seekers = livingSeekers();
    let best = null, bestScore = -Infinity;
    for (let tries = 0; tries < 14; tries++) {
      const c = cands[(Math.random() * cands.length) | 0];
      let dPot = 99, dSeek = 99;
      for (const q of pots) dPot = Math.min(dPot, Math.hypot(q.x - c.x, q.z - c.z));
      for (const s of seekers) dSeek = Math.min(dSeek, Math.hypot(s.position.x - c.x, s.position.z - c.z));
      const score = Math.min(dPot, 22) + Math.min(dSeek, 14) * 0.6 + Math.random() * 3;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) return;
    const p = safeGroundNear({ x: best.x + rand(-1.4, 1.4), y: best.y, z: best.z + rand(-1.4, 1.4) }, 0.45, pots, 6);
    if (!p) return;
    const id = ++potSeq;
    const color = POT_COLORS[id % POT_COLORS.length];
    addPot(id, p.x, p.y, p.z, color);
    net({ k: 'pot_set', i: id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), c: color });
  }

  function applyPotCollected(pot, ch) {
    const pos = new THREE.Vector3(pot.x, pot.y, pot.z);
    burst({ x: pot.x, y: pot.y + 0.2, z: pot.z }, [pot.color, 0xfff3dc], 16, { radius: 0.35, life: 0.9, out: 1.6, rise: 1.4 });
    env.ripple?.(pos, 1.1);
    if (!ch) return;
    const u = ch.userData;
    u.hue = 1;
    u.hueChannelUntil = 0;
    u.hueFreshUntil = now() + HUE_RULES.POT_FRESH_SEC * 1000;
    const mf = env.getMatchFlow && env.getMatchFlow();
    if (mf) mf.recordStat(ch, 'paintPots', 1);
    const name = u.actor?.name || 'A spirit';
    if (ch === G.player) {
      env.audio?.found?.(false);
      env.haptics?.victory?.();
      const prog = env.getProgression && env.getProgression();
      if (prog) prog.awardTokens('paint_pot', HUE_RULES.POT_TOKENS, `🎨 Paint Pot! +${HUE_RULES.POT_TOKENS} 🪙`, HUE_RULES.POT_XP);
      env.hint(`🎨 Paint Pot! Fresh coat for ${HUE_RULES.POT_FRESH_SEC}s · +${HUE_RULES.POT_POINTS} squad points`, 2200);
    } else if (G.mode === 'hide') {
      env.pushFeed('🎨', `<b>${escapeHtml(name)}</b> grabbed a Paint Pot · +${HUE_RULES.POT_POINTS} pts`, 'ally');
    } else {
      env.pushFeed('🎨', `A spirit grabbed a <b>Paint Pot</b> — +${HUE_RULES.POT_POINTS} to the hiders!`, 'warn');
    }
  }

  function updatePots(dt) {
    const t = now();
    for (const pot of pots) {
      const ud = pot.m.userData;
      const k = (t - pot.born) / 1000;
      ud.ring.scale.setScalar(1 + Math.sin(k * 3.2) * 0.12);
      ud.beam.material.opacity = 0.16 + Math.sin(k * 2.1) * 0.06;
      ud.paint.rotation.y = k * 0.8;
      ud.tag.position.y = 1.45 + Math.sin(k * 2.4) * 0.08;
    }
    if (!huntActive() || !isAuth()) return;

    // collection — any living hider that reaches a pot
    for (let i = pots.length - 1; i >= 0; i--) {
      const pot = pots[i];
      for (const h of livingHiders()) {
        const u = h.userData;
        const footY = (u.groundY || 0) + (u.jy || 0);
        if (Math.abs(footY - pot.y) > 1.7) continue;
        if (Math.hypot(h.position.x - pot.x, h.position.z - pot.z) > HUE_RULES.POT_RADIUS + (u.radius || 0.45) * 0.4) continue;
        removePot(pot.id);
        applyPotCollected(pot, h);
        net({ k: 'pot_take', i: pot.id, s: u.actor?.slotIdx ?? 0 });
        const ai = env.getAI && env.getAI();
        if (ai) ai.emitSoundCue(new THREE.Vector3(pot.x, pot.y, pot.z), HUE_RULES.POT_HEAR_RADIUS, 'chime', h);
        potRespawns.push({ at: t + HUE_RULES.POT_RESPAWN_SEC * 1000 });
        break;
      }
    }
    for (let i = potRespawns.length - 1; i >= 0; i--) {
      if (t >= potRespawns[i].at) { potRespawns.splice(i, 1); spawnPot(); }
    }
  }

  function getNearestPot(pos, maxDist = 16) {
    let best = null, bd = maxDist;
    for (const pot of pots) {
      if (Math.abs((pot.y || 0) - (pos.y || 0)) > 2.2) continue;
      const d = Math.hypot(pot.x - pos.x, pot.z - pos.z);
      if (d < bd) { bd = d; best = pot; }
    }
    return best;
  }
  const isPotActive = (id) => pots.some((q) => q.id === id);

  // ------------------------------------------------------------------ 3. ghosts
  function becomeGhost(ch) {
    const u = ch.userData;
    u.ghost = true;
    u.shrink = 0.92;
    u.speedMul = HUE_RULES.GHOST_SPEED_MUL;
    ch.visible = true;
    ch.traverse((m) => {
      if (!m.isMesh || !m.material || m.userData._ghostMat) return;
      const mk = (mat) => {
        const c = mat.clone();
        c.transparent = true; c.opacity = 0.42; c.depthWrite = false;
        if (c.color) c.color.lerp(new THREE.Color(0xbfe9ff), 0.55);
        if (c.emissive) { c.emissive.set(0x4f86a8); c.emissiveIntensity = 0.6; }
        ghostMats.push(c);
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(mk) : mk(m.material);
      m.userData._ghostMat = true;
      m.castShadow = false;
    });
    G.ghost = true;
    G.ghostHauntReadyAt = now() + 1200;
    G.ghostHaunts = 0;
  }

  function findHauntTarget(pos, range = HUE_RULES.HAUNT_RANGE) {
    let best = null, bd = range;
    for (const r of env.realProps || []) {
      if (Math.abs((r.pos.y || 0) - (pos.y || 0)) > 2.4) continue;
      const d = Math.hypot(r.pos.x - pos.x, r.pos.z - pos.z);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  function doHauntEffect(rec, { byName = null, quiet = false } = {}) {
    if (!rec || !rec.g) return 0;
    if (!wobbles.some((w) => w.rec === rec)) wobbles.push({ rec, t: 0, dur: 1.5, rz: rec.g.rotation.z, sx: rec.g.scale.x, sy: rec.g.scale.y, sz: rec.g.scale.z });
    const top = new THREE.Vector3(rec.pos.x, (rec.pos.y || 0) + (rec.height || 1) + 0.35, rec.pos.z);
    const sp = emojiSprite('👻', 0.75); sp.position.copy(top); scene.add(sp);
    wobbles.push({ sprite: sp, t: 0, dur: 1.5 });
    burst({ x: rec.pos.x, y: rec.pos.y || 0, z: rec.pos.z }, [0xbfe9ff, 0xffffff], 8, { radius: (rec.radius || 0.5) + 0.15, life: 0.9, out: 0.5 });
    env.ripple?.(new THREE.Vector3(rec.pos.x, rec.pos.y || 0, rec.pos.z), 1.25);
    let heard = 0;
    for (const s of livingSeekers()) {
      if (Math.hypot(s.position.x - rec.pos.x, s.position.z - rec.pos.z) <= HUE_RULES.HAUNT_HEAR_RADIUS) heard++;
    }
    if (!quiet) {
      const ai = env.getAI && env.getAI();
      if (ai) ai.emitSoundCue(new THREE.Vector3(rec.pos.x, rec.pos.y || 0, rec.pos.z), HUE_RULES.HAUNT_HEAR_RADIUS, 'chime', null);
    }
    const pl = G.player;
    if (pl && Math.hypot(pl.position.x - rec.pos.x, pl.position.z - rec.pos.z) < 18) {
      env.audio?.creak?.();
      if (G.mode === 'seek' && G.phase === 'seek') env.hint('👻 Something rattled nearby… a hiding spirit, or a ghost playing tricks?', 1900);
    }
    return heard;
  }

  /** Local ghost presses [F] / the Haunt pill. */
  function tryHaunt() {
    const p = G.player;
    if (!p || !G.ghost || G.over || G.spectating) return false;
    const t = now();
    if (t < (G.ghostHauntReadyAt || 0)) { env.hint(`👻 Gathering spooky energy… ${Math.max(1, Math.ceil((G.ghostHauntReadyAt - t) / 1000))}s`, 800); return false; }
    const rec = findHauntTarget({ x: p.position.x, y: p.userData.groundY || 0, z: p.position.z });
    if (!rec) { env.hint('👻 Float up to a real prop to haunt it.', 1200); return false; }
    G.ghostHauntReadyAt = t + HUE_RULES.HAUNT_CD_SEC * 1000;
    const heard = doHauntEffect(rec);
    net({ k: 'haunt', x: +rec.pos.x.toFixed(2), y: +(rec.pos.y || 0).toFixed(2), z: +rec.pos.z.toFixed(2) });
    env.haptics?.morph?.();
    if (heard > 0) {
      G.ghostHaunts = (G.ghostHaunts || 0) + 1;
      const mf = env.getMatchFlow && env.getMatchFlow();
      if (mf) mf.recordStat(p, 'haunts', 1);
      const capped = G.ghostHaunts * HUE_RULES.HAUNT_POINTS > HUE_RULES.HAUNT_POINTS_CAP;
      const prog = env.getProgression && env.getProgression();
      if (prog && !capped) prog.awardTokens('ghost_haunt', HUE_RULES.HAUNT_TOKENS, `👻 Haunt heard by ${heard} seeker${heard === 1 ? '' : 's'}! +${HUE_RULES.HAUNT_TOKENS} 🪙`, HUE_RULES.HAUNT_XP);
      env.hint(capped
        ? `👻 ${heard} seeker${heard === 1 ? '' : 's'} heard it! (haunt points maxed for this round)`
        : `👻 ${heard} seeker${heard === 1 ? '' : 's'} heard it! +${HUE_RULES.HAUNT_POINTS} squad points`, 1700);
    } else {
      env.hint('👻 Rattle! …but no seeker was close enough to hear. Haunt nearer to them.', 1700);
    }
    return true;
  }

  function updateGhosts(dt) {
    // animate haunted props
    for (let i = wobbles.length - 1; i >= 0; i--) {
      const w = wobbles[i];
      w.t += dt;
      const u = clamp(w.t / w.dur, 0, 1);
      if (w.sprite) {
        w.sprite.position.y += dt * 0.7;
        w.sprite.material.opacity = 1 - u;
        if (u >= 1) { scene.remove(w.sprite); w.sprite.material.dispose(); wobbles.splice(i, 1); }
        continue;
      }
      const amp = (1 - u) * (1 - u);
      w.rec.g.rotation.z = w.rz + Math.sin(w.t * 34) * 0.17 * amp;
      const sq = 1 + Math.sin(w.t * 26) * 0.06 * amp;
      w.rec.g.scale.set(w.sx * (2 - sq), w.sy * sq, w.sz * (2 - sq));
      if (u >= 1) { w.rec.g.rotation.z = w.rz; w.rec.g.scale.set(w.sx, w.sy, w.sz); wobbles.splice(i, 1); }
    }

    // the local ghost bobs and drifts
    const p = G.player;
    if (G.ghost && p && !G.over) {
      p.userData.shrink = 0.92 + Math.sin(now() * 0.004) * 0.03;
    }

    // soaked bot hiders keep helping: every so often one rattles a prop near a seeker
    if (!huntActive() || !isAuth()) return;
    botGhostT -= dt;
    if (botGhostT > 0) return;
    botGhostT = rand(8, 14);
    const ghosts = (G.allHiders || []).filter((h) => h && h !== G.player && h.userData?.actor?.eliminated && h.userData?.actor?.isBot);
    const seekers = livingSeekers();
    const alive = livingHiders();
    if (!ghosts.length || !seekers.length || !alive.length) return;
    const s = seekers[(Math.random() * seekers.length) | 0];
    let pick = null, pickD = 11;
    for (const r of env.realProps || []) {
      const d = Math.hypot(r.pos.x - s.position.x, r.pos.z - s.position.z);
      if (d < 3 || d > pickD) continue;
      if (Math.abs((r.pos.y || 0) - (s.userData.groundY || 0)) > 2.4) continue;
      let nearAlly = false;
      for (const h of alive) { if (Math.hypot(h.position.x - r.pos.x, h.position.z - r.pos.z) < 7) { nearAlly = true; break; } }
      if (nearAlly) continue;
      pick = r; pickD = d;
    }
    if (!pick) return;
    const ghost = ghosts[(Math.random() * ghosts.length) | 0];
    const heard = doHauntEffect(pick);
    net({ k: 'haunt', x: +pick.pos.x.toFixed(2), y: +(pick.pos.y || 0).toFixed(2), z: +pick.pos.z.toFixed(2) });
    if (heard > 0) {
      const mf = env.getMatchFlow && env.getMatchFlow();
      if (mf) mf.recordStat(ghost, 'haunts', 1);
    }
  }

  // ------------------------------------------------------------------ network
  function onRemoteGadget(pkt) {
    if (!pkt) return false;
    if (pkt.k === 'pot_set') {
      addPot(pkt.i, +pkt.x || 0, +pkt.y || 0, +pkt.z || 0, Number(pkt.c) || POT_COLORS[0]);
      return true;
    }
    if (pkt.k === 'pot_take') {
      const pot = removePot(pkt.i);
      if (pot) applyPotCollected(pot, (G.allHiders || [])[pkt.s] || null);
      return true;
    }
    if (pkt.k === 'haunt') {
      const rec = findHauntTarget({ x: +pkt.x || 0, y: +pkt.y || 0, z: +pkt.z || 0 }, 1.6);
      if (rec) doHauntEffect(rec, { quiet: !isAuth() });
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ player form (for bot difficulty)
  function readForm() {
    try {
      const raw = JSON.parse(localStorage.getItem(FORM_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((r) => r === 'W' || r === 'L' || r === 'D').slice(-6) : [];
    } catch (_) { return []; }
  }
  function recordSeriesResult({ won = false, draw = false } = {}) {
    const form = readForm();
    form.push(draw ? 'D' : (won ? 'W' : 'L'));
    try { localStorage.setItem(FORM_KEY, JSON.stringify(form.slice(-6))); } catch (_) { /* storage unavailable */ }
  }
  function streaks() {
    const form = readForm();
    let w = 0, l = 0;
    for (let i = form.length - 1; i >= 0 && form[i] === 'W'; i--) w++;
    for (let i = form.length - 1; i >= 0 && form[i] === 'L'; i--) l++;
    return { winStreak: w, lossStreak: l };
  }
  function currentBotDifficulty() {
    if (isLive() && (env.getMP().getHumanCount ? env.getMP().getHumanCount() > 1 : true)) return 0.6;
    const prog = env.getProgression && env.getProgression();
    let level = 1;
    try { level = prog && prog.getLevel ? prog.getLevel() : (prog && prog.getState ? prog.getState().level : 1); } catch (_) { level = 1; }
    return computeBotDifficulty({ level, ...streaks() });
  }

  // ------------------------------------------------------------------ HUD
  function mountUI() {
    if (typeof document === 'undefined') return;
    const hud = document.getElementById('hud');
    if (!hud) return;
    if (!document.getElementById('hueTank')) {
      const el = document.createElement('div');
      el.id = 'hueTank'; el.className = 'hidden';
      el.innerHTML =
        '<span class="hue-tank-ic" id="hueTankIc">💧</span>' +
        '<div class="hue-tank-bar"><i id="hueTankFill"></i></div>' +
        '<b id="hueTankTxt">100</b>' +
        '<em id="hueWellDir" class="hidden"><i id="hueWellArrow">➤</i><span id="hueWellDist">0m</span></em>';
      hud.appendChild(el);
    }
    if (!document.getElementById('hueGhostBar')) {
      const el = document.createElement('div');
      el.id = 'hueGhostBar'; el.className = 'hidden';
      el.innerHTML =
        '<button type="button" id="btnHueHaunt" class="ht-pill hue-haunt-pill" title="Haunt the nearest real prop [F]">' +
          '<i class="ht-sweep" id="hueHauntSweep"></i>' +
          '<kbd class="ht-key">F</kbd>' +
          '<span class="ht-ic">👻</span>' +
          '<span class="ht-txt"><b>Haunt</b><small id="hueHauntMeta">rattle a prop</small></span>' +
        '</button>' +
        '<span class="hue-ghost-tip" id="hueGhostTip">You\'re a ghost! Rattle props near seekers to pull them off your allies.</span>';
      hud.appendChild(el);
      const b = el.querySelector('#btnHueHaunt');
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); tryHaunt(); });
    }
    const bar = document.getElementById('hiderTricksBar');
    if (bar && !document.getElementById('btnHueRepaint')) {
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'btnHueRepaint'; b.className = 'ht-pill hue-repaint-pill';
      b.title = 'Repaint your disguise [V] — hold still';
      b.innerHTML =
        '<i class="ht-sweep" id="hueRepaintSweep"></i>' +
        '<kbd class="ht-key">V</kbd>' +
        '<span class="ht-ic">🎨</span>' +
        '<span class="ht-txt"><b>Repaint</b><small id="hueRepaintMeta">100% paint</small></span>';
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); tryRepaint(); });
      bar.appendChild(b);
    }
    ui = {
      tank: document.getElementById('hueTank'),
      tankFill: document.getElementById('hueTankFill'),
      tankIc: document.getElementById('hueTankIc'),
      tankTxt: document.getElementById('hueTankTxt'),
      wellDir: document.getElementById('hueWellDir'),
      wellArrow: document.getElementById('hueWellArrow'),
      wellDist: document.getElementById('hueWellDist'),
      ghostBar: document.getElementById('hueGhostBar'),
      hauntBtn: document.getElementById('btnHueHaunt'),
      hauntSweep: document.getElementById('hueHauntSweep'),
      hauntMeta: document.getElementById('hueHauntMeta'),
      repaintBtn: document.getElementById('btnHueRepaint'),
      repaintSweep: document.getElementById('hueRepaintSweep'),
      repaintMeta: document.getElementById('hueRepaintMeta'),
    };
  }

  function setCls(key, el, cls, on) { if (el && _hud[key] !== on) { _hud[key] = on; el.classList.toggle(cls, on); } }
  function setTxt(key, el, v) { if (el && _hud[key] !== v) { _hud[key] = v; el.textContent = v; } }
  function setStyle(key, el, prop, v) { if (el && _hud[key] !== v) { _hud[key] = v; el.style[prop] = v; } }

  function updateHUD() {
    if (!ui || !ui.tank || !ui.repaintBtn) mountUI();
    if (!ui) return;
    const t = now();
    const p = G.player;
    const inRound = !!p && !G.over && G.phase !== 'menu' && G.phase !== 'vs' && G.phase !== 'end';

    // --- seeker tank
    const showTank = inRound && G.mode === 'seek' && G.phase === 'seek' && !G.isTutorial && !p.userData.inTurret;
    setCls('tankHid', ui.tank, 'hidden', !showTank);
    if (showTank) {
      const frac = clamp((G.tank ?? HUE_RULES.TANK_MAX) / HUE_RULES.TANK_MAX, 0, 1);
      const el = currentElement();
      setTxt('tankIc', ui.tankIc, el.icon);
      setStyle('tankCol', ui.tankFill, 'background', frac < 0.25 ? '' : `linear-gradient(90deg, ${el.css}, #ffffff66)`);
      setStyle('tankW', ui.tankFill, 'width', `${Math.round(frac * 100)}%`);
      setTxt('tankTxt', ui.tankTxt, String(Math.round(frac * 100)));
      setCls('tankLow', ui.tank, 'is-low', frac < 0.25);
      setCls('tankEmpty', ui.tank, 'is-empty', frac <= 0.01);
      setCls('tankFilling', ui.tank, 'is-filling', !!G.tankRefilling);
      setCls('tankBoost', ui.tank, 'is-boosted', t < (G.wellBoostUntil || 0));
      const nw = G.tankWell;
      const showDir = !!nw && frac < 0.4 && !G.tankRefilling;
      setCls('wellDirHid', ui.wellDir, 'hidden', !showDir);
      if (showDir) {
        // arrow relative to where the seeker is looking
        const ang = Math.atan2(nw.well.x - p.position.x, nw.well.z - p.position.z);
        const rel = ang - (G.yaw + Math.PI);
        setStyle('wellRot', ui.wellArrow, 'transform', `rotate(${Math.round((-rel * 180) / Math.PI - 90)}deg)`);
        setTxt('wellDist', ui.wellDist, `${Math.round(nw.dist)}m`);
      }
    }

    // --- hider paint
    const pu = p ? p.userData : null;
    const hideAlive = inRound && G.mode === 'hide' && !G.ghost && !G.spectating && !pu.actor?.eliminated;
    const fill = document.getElementById('hueFill');
    if (fill && hideAlive) {
      const painted = !!(pu.propId && !pu.specialMode);
      const hue = painted ? clamp(pu.hue ?? 1, 0, 1) : 1;
      setStyle('hueW', fill, 'width', `${Math.round(hue * 100)}%`);
      setStyle('hueBg', fill, 'background', hue > 0.62 ? '#6bbf59' : hue > 0.35 ? '#e8a33d' : '#d9534f');
    }
    if (ui.repaintBtn) {
      const painted = hideAlive && !!(pu.propId && !pu.specialMode);
      const hue = painted ? clamp(pu.hue ?? 1, 0, 1) : 1;
      const channel = painted && (pu.hueChannelUntil || 0) > t;
      const cdRem = painted ? Math.max(0, (pu.hueCdUntil || 0) - t) : 0;
      setCls('rpCool', ui.repaintBtn, 'is-cooling', cdRem > 40 && !channel);
      setCls('rpUrg', ui.repaintBtn, 'is-urgent', painted && hue < 0.5 && cdRem <= 40 && !channel && huntActive());
      setCls('rpBusy', ui.repaintBtn, 'is-busy', channel);
      setStyle('rpSweep', ui.repaintSweep, 'transform', `scaleX(${clamp(cdRem / (HUE_RULES.REPAINT_CD_SEC * 1000), 0, 1).toFixed(2)})`);
      const fresh = painted && (pu.hueFreshUntil || 0) > t;
      setTxt('rpMeta', ui.repaintMeta, !painted ? 'morph first' : channel ? 'hold still…' : fresh ? 'fresh coat ✨' : `${Math.round(hue * 100)}% paint`);
    }

    // --- ghost
    const showGhost = inRound && !!G.ghost && !G.spectating;
    setCls('ghostHid', ui.ghostBar, 'hidden', !showGhost);
    if (showGhost) {
      const rem = Math.max(0, (G.ghostHauntReadyAt || 0) - t);
      setCls('hauntCool', ui.hauntBtn, 'is-cooling', rem > 40);
      setStyle('hauntSweep', ui.hauntSweep, 'transform', `scaleX(${clamp(rem / (HUE_RULES.HAUNT_CD_SEC * 1000), 0, 1).toFixed(2)})`);
      setTxt('hauntMeta', ui.hauntMeta, rem > 40 ? `${Math.ceil(rem / 1000)}s` : 'rattle a prop');
    }

    // --- well / pot markers scale with distance so they stay readable
    const cam = env.camera;
    for (const w of wells) {
      const d = cam.position.distanceTo(w.m.position);
      const sc = clamp(d * 0.05, 0.7, 2.6);
      w.m.userData.tag.scale.set(sc, sc, 1);
      w.m.userData.tag.visible = G.mode === 'seek' || d < 26;
      w.m.userData.glow.scale.setScalar(1 + Math.sin(t * 0.004) * 0.06);
    }
    for (const pot of pots) {
      const d = cam.position.distanceTo(pot.m.position);
      const sc = clamp(d * 0.045, 0.6, 2.2);
      pot.m.userData.tag.scale.set(sc, sc, 1);
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ------------------------------------------------------------------ lifecycle
  function clearAll() {
    clearWells();
    for (const pot of pots) scene.remove(pot.m);
    pots = []; potRespawns = [];
    for (const w of wobbles) {
      if (w.sprite) { scene.remove(w.sprite); w.sprite.material.dispose(); }
      else if (w.rec && w.rec.g) { w.rec.g.rotation.z = w.rz; w.rec.g.scale.set(w.sx, w.sy, w.sz); }
    }
    wobbles = [];
    for (const f of fx) { scene.remove(f.m); f.m.material.dispose(); }
    fx = [];
    for (const m of ghostMats) m.dispose();
    ghostMats = [];
    for (const c of [G.player, ...(G.hiders || [])]) { if (c && c.userData) disposePaint(c.userData); }
    huntStarted = false;
    wellElemId = '';
    G.ghost = false;
    G.tankRefilling = false;
    G.tankWell = null;
  }

  /** Call at the start of every round (after the characters exist). */
  function resetRound() {
    clearAll();
    fadeHintShown = false;
    tankHintAt = -1e9;
    lastFireAt = -1e9;
    botGhostT = rand(7, 11);
    potSeq = 0;
    G.tank = HUE_RULES.TANK_MAX;
    G.wellBoostUntil = 0;
    G.ghost = false;
    G.ghostHaunts = 0;
    for (const h of (G.allHiders || [])) { if (h && h.userData) { h.userData.hue = 1; h.userData.hueFreshUntil = 0; h.userData.hueCdUntil = 0; h.userData.hueChannelUntil = 0; h.userData.ghost = false; } }
    if (!G.isTutorial) buildWells();
    mountUI();
  }

  function onHuntStart() {
    if (huntStarted || G.isTutorial) return;
    huntStarted = true;
    for (const h of livingHiders()) { h.userData.hue = 1; h.userData.hueFreshUntil = now() + 3000; }
    if (isAuth()) { for (let i = 0; i < HUE_RULES.POT_COUNT; i++) spawnPot(); }
    if (G.mode === 'seek') {
      env.pushFeed(currentElement().icon, '<b>Tip:</b> pale, washed-out props are fakes. Wells recharge any blaster and give a power boost!', 'soak');
    } else {
      env.pushFeed('🎨', '<b>Paint fades!</b> Repaint or grab Paint Pots for squad points.', 'ally');
    }
  }

  function update(dt) {
    if (!G.player || G.phase === 'menu' || G.phase === 'vs') return;
    if (!huntStarted && huntActive()) onHuntStart();
    updatePaint(dt);
    updatePots(dt);
    updateGhosts(dt);
    updateTank(dt);
    updateFx(dt);
    updateHUD();
  }

  function handleKeyDown(e) {
    if (!e || e.repeat) return false;
    if (e.code === 'KeyV' && G.mode === 'hide') { tryRepaint(); return true; }
    if (e.code === 'KeyF' && G.ghost) { tryHaunt(); return true; }
    return false;
  }

  return {
    mountUI, resetRound, clearAll, update, handleKeyDown,
    onDisguise, onUndisguise, onHiderHit, tryRepaint,
    spendWater, isSputtering, getFireIntervalMul, getShotSpeedMul, getDamageMul, getWells: () => wells, nearestWell,
    getPots: () => pots, getNearestPot, isPotActive,
    becomeGhost, tryHaunt, onRemoteGadget,
    recordSeriesResult, currentBotDifficulty, streaks,
  };
}
