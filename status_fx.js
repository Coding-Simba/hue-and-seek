/* ============================================================================
 * Hue & Seek — Status FX (status_fx.js)
 *
 * Makes every elemental status readable at a glance, on the character and — for
 * the affected player — on their own screen:
 *
 *   ❄️ Chilled ×1..3  frost shards grow in a ring around the target + icy film
 *   ❄️ Frozen         a faceted ice block snaps shut, trembles, then shatters
 *   🔥 Burning        flickering flames on the target, rising embers, ground glow
 *   🪨 Slowed         boulders cling to the base, dust rings pulse on the ground
 *   🌪️ Turbulence     wind ribbons whirl around the target
 *   💦 Soaked         water drips off the target
 *
 * Purely visual: it reads elementalGuns.getCharacterStatusSummary(ch) every frame
 * and never changes gameplay state.
 * ========================================================================== */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const easeOutBack = (t) => { const c = 1.70158, x = clamp(t, 0, 1) - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

export function createStatusFxManager(env) {
  const { THREE, scene, G } = env;
  const fxByChar = new Map();
  const loose = [];        // free-flying bits (ice shards, embers, drips) with a lifetime
  let overlayEl = null, frozenLabelEl = null;
  const _ovState = {};

  // ---- shared geometry / materials (one set for the whole match)
  const geo = {
    shard: new THREE.ConeGeometry(0.075, 0.34, 5),
    ice: new THREE.IcosahedronGeometry(1, 0),
    film: new THREE.IcosahedronGeometry(1, 1),
    flame: new THREE.ConeGeometry(0.15, 0.52, 7),
    flameCore: new THREE.ConeGeometry(0.08, 0.32, 6),
    rock: new THREE.DodecahedronGeometry(0.14, 0),
    ring: new THREE.RingGeometry(0.82, 1.0, 28),
    swirl: new THREE.TorusGeometry(1, 0.028, 6, 26, Math.PI * 1.25),
    bit: new THREE.TetrahedronGeometry(0.11, 0),
    dot: new THREE.SphereGeometry(0.05, 8, 6),
  };
  const mat = {
    shard: new THREE.MeshLambertMaterial({ color: 0xd9f6ff, emissive: 0x6fc4ee, emissiveIntensity: 0.55, flatShading: true }),
    flame: new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending }),
    flameCore: new THREE.MeshBasicMaterial({ color: 0xffe38a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
    rock: new THREE.MeshLambertMaterial({ color: 0x8a6a48, flatShading: true }),
    swirl: new THREE.MeshBasicMaterial({ color: 0xc9fbec, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
    drip: new THREE.MeshBasicMaterial({ color: 0x7fd4f7, transparent: true, opacity: 0.9, depthWrite: false }),
  };

  function dimsOf(ch) {
    const u = ch.userData || {};
    const disguised = !!(u.propId || u.specialMode);
    const isSeeker = u.actor?.team === 'seekers';
    return {
      r: clamp(disguised ? (u.radius || 0.5) : 0.42, 0.28, 1.4),
      h: clamp(disguised ? (u.height || 1) : (isSeeker ? 1.65 : 1.2), 0.45, 2.6),
    };
  }

  function makeFx(ch) {
    const grp = new THREE.Group();
    grp.name = 'status_fx';
    scene.add(grp);
    const fx = { ch, grp, chill: 0, frozen: false, frozenT: 0, burning: false, slowed: false, chaos: false, slip: false, t: rand(0, 10), idle: 0, dustT: 0, emberT: 0, dripT: 0 };
    fxByChar.set(ch, fx);
    return fx;
  }

  function disposeFx(fx) {
    scene.remove(fx.grp);
    for (const k of ['iceMat', 'filmMat', 'glowMat', 'dustMat']) { if (fx[k]) fx[k].dispose(); }
    fxByChar.delete(fx.ch);
  }

  // ---- loose bits
  function spawnBit(g, material, pos, vel, life, grav = 9, spin = 6, scale = 1, ownMat = false) {
    const m = new THREE.Mesh(g, ownMat ? material.clone() : material);
    m.position.copy(pos); m.scale.setScalar(scale);
    m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    scene.add(m);
    loose.push({ m, vx: vel.x, vy: vel.y, vz: vel.z, life, age: 0, grav, spin, ownMat, s0: scale });
  }
  function updateLoose(dt) {
    for (let i = loose.length - 1; i >= 0; i--) {
      const b = loose[i];
      b.age += dt;
      b.vy -= b.grav * dt;
      b.m.position.x += b.vx * dt; b.m.position.y += b.vy * dt; b.m.position.z += b.vz * dt;
      b.m.rotation.x += b.spin * dt; b.m.rotation.z += b.spin * 0.7 * dt;
      const u = b.age / b.life;
      b.m.scale.setScalar(b.s0 * Math.max(0.05, 1 - u * u));
      if (b.ownMat) b.m.material.opacity = Math.max(0, 1 - u);
      if (u >= 1) { scene.remove(b.m); if (b.ownMat) b.m.material.dispose(); loose.splice(i, 1); }
    }
  }

  // ---- ❄️ chill + freeze
  function ensureFrost(fx, d) {
    if (fx.shards) return;
    fx.shards = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(geo.shard, mat.shard);
      s.userData.a = (i / 9) * Math.PI * 2 + rand(-0.15, 0.15);
      s.userData.len = rand(0.8, 1.45);
      s.userData.grow = 0;
      s.visible = false;
      fx.grp.add(s);
      fx.shards.push(s);
    }
    fx.filmMat = new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0, depthWrite: false });
    fx.film = new THREE.Mesh(geo.film, fx.filmMat);
    fx.grp.add(fx.film);
  }
  function ensureIce(fx) {
    if (fx.ice) return;
    fx.iceMat = new THREE.MeshStandardMaterial({ color: 0xa8ecff, emissive: 0x3b8ec9, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.62, flatShading: true });
    fx.ice = new THREE.Mesh(geo.ice, fx.iceMat);
    fx.ice.rotation.y = rand(0, Math.PI);
    fx.ice.visible = false;
    fx.grp.add(fx.ice);
  }
  function shatterIce(fx, d) {
    const base = fx.grp.position;
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(1.8, 4.2);
      spawnBit(geo.bit, fx.iceMat, new THREE.Vector3(base.x + Math.cos(a) * d.r * 0.6, base.y + rand(0.2, d.h), base.z + Math.sin(a) * d.r * 0.6),
        { x: Math.cos(a) * sp, y: rand(1.6, 4.4), z: Math.sin(a) * sp }, rand(0.55, 0.9), 9.5, rand(6, 12), rand(0.8, 1.7), true);
    }
    env.ripple?.(new THREE.Vector3(base.x, base.y, base.z), 1.1);
  }

  // ---- 🔥 burning
  function ensureFlames(fx) {
    if (fx.flames) return;
    fx.flames = [];
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Group();
      f.add(new THREE.Mesh(geo.flame, mat.flame));
      const core = new THREE.Mesh(geo.flameCore, mat.flameCore); core.position.y = -0.06; f.add(core);
      f.userData.a = i === 0 ? 0 : ((i - 1) / 5) * Math.PI * 2;
      f.userData.center = i === 0;
      f.userData.ph = rand(0, 6);
      f.userData.s = 0;
      fx.grp.add(f);
      fx.flames.push(f);
    }
    fx.glowMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    fx.glow = new THREE.Mesh(geo.ring, fx.glowMat);
    fx.glow.rotation.x = -Math.PI / 2; fx.glow.position.y = 0.04;
    fx.grp.add(fx.glow);
  }

  // ---- 🪨 slowed
  function ensureRocks(fx) {
    if (fx.rocks) return;
    fx.rocks = [];
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(geo.rock, mat.rock);
      r.userData.a = (i / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      r.userData.sc = rand(1.0, 1.7);
      r.userData.s = 0;
      r.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      fx.grp.add(r);
      fx.rocks.push(r);
    }
    fx.dustMat = new THREE.MeshBasicMaterial({ color: 0xc9a77a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    fx.dust = new THREE.Mesh(geo.ring, fx.dustMat);
    fx.dust.rotation.x = -Math.PI / 2; fx.dust.position.y = 0.05;
    fx.grp.add(fx.dust);
  }

  // ---- 🌪️ turbulence
  function ensureSwirls(fx) {
    if (fx.swirls) return;
    fx.swirls = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(geo.swirl, mat.swirl);
      s.rotation.x = Math.PI / 2 + (i - 1) * 0.22;
      s.userData.dir = i % 2 ? -1 : 1;
      s.userData.s = 0;
      fx.grp.add(s);
      fx.swirls.push(s);
    }
  }

  function updateOne(fx, st, dt) {
    const ch = fx.ch, u = ch.userData || {};
    const d = dimsOf(ch);
    fx.t += dt;
    fx.grp.position.set(ch.position.x, (u.groundY || 0) + (u.specialY || 0) + (u.jy || 0), ch.position.z);

    // ❄️ chill shards + film
    const stacks = st.frozen ? 3 : clamp(st.chillStacks || 0, 0, 3);
    if (stacks > 0 || fx.shards) {
      ensureFrost(fx, d);
      const want = stacks * 3;
      for (let i = 0; i < fx.shards.length; i++) {
        const s = fx.shards[i];
        const target = i < want ? 1 : 0;
        s.userData.grow += clamp(target - s.userData.grow, -dt * 3.2, dt * 5.5);
        const gk = s.userData.grow;
        s.visible = gk > 0.02;
        if (s.visible) {
          const a = s.userData.a, rr = d.r + 0.1;
          const k = easeOutBack(gk);
          s.position.set(Math.cos(a) * rr, 0.16 * s.userData.len * k, Math.sin(a) * rr);
          s.scale.set(k, s.userData.len * k, k);
          s.rotation.set(0, -a, 0);
          s.rotateZ(-0.55);   // lean outward
        }
      }
      fx.film.position.y = d.h * 0.5;
      fx.film.scale.set(d.r * 1.22, d.h * 0.6, d.r * 1.22);
      fx.filmMat.opacity += clamp((st.frozen ? 0 : stacks * 0.045) - fx.filmMat.opacity, -dt, dt * 1.5);
      fx.film.visible = fx.filmMat.opacity > 0.01;
    }

    // ❄️ frozen: ice block snaps shut, trembles near the end, shatters
    if (st.frozen) {
      ensureIce(fx);
      if (!fx.frozen) {
        fx.frozen = true; fx.frozenT = 0; fx.iceDur = Math.max(0.3, st.freezeTimer || 0.85);
        fx.ice.visible = true;
        for (let i = 0; i < 8; i++) {
          const a = rand(0, Math.PI * 2);
          spawnBit(geo.dot, mat.shard, new THREE.Vector3(fx.grp.position.x + Math.cos(a) * d.r, fx.grp.position.y + rand(0.1, d.h), fx.grp.position.z + Math.sin(a) * d.r),
            { x: Math.cos(a) * 1.4, y: rand(0.6, 1.8), z: Math.sin(a) * 1.4 }, 0.5, 2.5, 3, 1.1);
        }
        if (ch === G.player) env.haptics?.takeHit?.(true);
      }
      fx.frozenT += dt;
      const pop = easeOutBack(fx.frozenT / 0.2);
      const left = st.freezeTimer || 0;
      const tremble = left < 0.32 ? (0.32 - left) / 0.32 : 0;
      fx.ice.position.set(Math.sin(fx.t * 70) * 0.035 * tremble, d.h * 0.52, Math.cos(fx.t * 63) * 0.035 * tremble);
      fx.ice.scale.set(d.r * 1.5 * pop, d.h * 0.74 * pop, d.r * 1.5 * pop);
      fx.iceMat.emissiveIntensity = 0.3 + Math.sin(fx.t * 9) * 0.12 + tremble * 0.5;
      fx.iceMat.opacity = 0.62 - tremble * 0.12;
    } else if (fx.frozen) {
      fx.frozen = false;
      if (fx.ice) fx.ice.visible = false;
      shatterIce(fx, d);
    }

    // 🔥 burning
    if (st.burning || fx.flames) {
      ensureFlames(fx);
      let anyOn = false;
      for (const f of fx.flames) {
        f.userData.s += clamp((st.burning ? 1 : 0) - f.userData.s, -dt * 4, dt * 6);
        const k = f.userData.s;
        f.visible = k > 0.02;
        if (!f.visible) continue;
        anyOn = true;
        const fl = 0.85 + Math.sin(fx.t * 15 + f.userData.ph) * 0.22 + Math.sin(fx.t * 23 + f.userData.ph * 2) * 0.1;
        const rr = f.userData.center ? 0 : d.r * 0.62;
        const a = f.userData.a + Math.sin(fx.t * 2 + f.userData.ph) * 0.15;
        const sc = (f.userData.center ? 1.9 : 1.45) * k * clamp(0.75 + d.r * 0.6, 0.8, 1.7);
        f.position.set(Math.cos(a) * rr, (f.userData.center ? d.h : d.h * 0.62) + 0.22 * sc * fl, Math.sin(a) * rr);
        f.scale.set(sc * (1.05 - (fl - 0.85) * 0.5), sc * fl, sc * (1.05 - (fl - 0.85) * 0.5));
        f.rotation.z = Math.sin(fx.t * 6 + f.userData.ph) * 0.12;
      }
      fx.glow.scale.setScalar(d.r + 0.55 + Math.sin(fx.t * 8) * 0.06);
      fx.glowMat.opacity += clamp((st.burning ? 0.42 + Math.sin(fx.t * 11) * 0.1 : 0) - fx.glowMat.opacity, -dt * 2, dt * 3);
      fx.glow.visible = fx.glowMat.opacity > 0.01;
      if (st.burning) {
        fx.emberT -= dt;
        if (fx.emberT <= 0) {
          fx.emberT = 0.09;
          const a = rand(0, Math.PI * 2);
          spawnBit(geo.dot, mat.flameCore, new THREE.Vector3(fx.grp.position.x + Math.cos(a) * d.r * 0.5, fx.grp.position.y + d.h * rand(0.6, 1.05), fx.grp.position.z + Math.sin(a) * d.r * 0.5),
            { x: rand(-0.4, 0.4), y: rand(1.2, 2.4), z: rand(-0.4, 0.4) }, rand(0.45, 0.8), -1.2, 4, rand(0.5, 0.9));
        }
      }
      if (!anyOn && !fx.glow.visible && !st.burning) { /* fully out */ }
    }

    // 🪨 slowed
    if (st.slowed || fx.rocks) {
      ensureRocks(fx);
      for (const r of fx.rocks) {
        r.userData.s += clamp((st.slowed ? 1 : 0) - r.userData.s, -dt * 3, dt * 7);
        const k = easeOutBack(r.userData.s);
        r.visible = r.userData.s > 0.02;
        if (!r.visible) continue;
        const a = r.userData.a, rr = d.r + 0.04;
        r.position.set(Math.cos(a) * rr, 0.13 * r.userData.sc + Math.abs(Math.sin(fx.t * 5 + a)) * 0.02, Math.sin(a) * rr);
        r.scale.setScalar(r.userData.sc * k);
      }
      if (st.slowed) {
        fx.dustT += dt;
        const u2 = (fx.dustT % 0.7) / 0.7;
        fx.dust.scale.setScalar((d.r + 0.25) * (0.7 + u2 * 0.9));
        fx.dustMat.opacity = 0.5 * (1 - u2);
        fx.dust.visible = true;
      } else if (fx.dust) {
        fx.dust.visible = false;
      }
    }

    // 🌪️ turbulence
    if (st.airChaos || fx.swirls) {
      ensureSwirls(fx);
      fx.swirls.forEach((s, i) => {
        s.userData.s += clamp((st.airChaos ? 1 : 0) - s.userData.s, -dt * 3, dt * 6);
        s.visible = s.userData.s > 0.02;
        if (!s.visible) return;
        const k = s.userData.s;
        s.position.y = d.h * (0.25 + i * 0.32) + Math.sin(fx.t * 3 + i) * 0.06;
        s.scale.setScalar((d.r + 0.3 + i * 0.08) * k);
        s.rotation.z = fx.t * 7.5 * s.userData.dir + i * 2;
      });
    }

    // 💦 soaked
    if (st.slipping) {
      fx.dripT -= dt;
      if (fx.dripT <= 0) {
        fx.dripT = 0.12;
        const a = rand(0, Math.PI * 2);
        spawnBit(geo.dot, mat.drip, new THREE.Vector3(fx.grp.position.x + Math.cos(a) * d.r * 0.8, fx.grp.position.y + d.h * rand(0.5, 1), fx.grp.position.z + Math.sin(a) * d.r * 0.8),
          { x: Math.cos(a) * 0.5, y: 0.6, z: Math.sin(a) * 0.5 }, 0.55, 9, 0, rand(0.7, 1.1));
      }
    }

    const active = stacks > 0 || st.frozen || st.burning || st.slowed || st.airChaos || st.slipping;
    fx.idle = active ? 0 : fx.idle + dt;
    return fx.idle < 1.2;
  }

  // ---- the affected player's own screen
  function mountUI() {
    if (typeof document === 'undefined' || overlayEl) return;
    const app = document.getElementById('app');
    if (!app) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'statusFxOverlay';
    overlayEl.setAttribute('aria-hidden', 'true');
    overlayEl.innerHTML = '<i class="sfx-frost"></i><i class="sfx-burn"></i><i class="sfx-heavy"></i><i class="sfx-wind"></i><b class="sfx-frozen-label" id="sfxFrozenLabel">❄️ FROZEN!</b>';
    // sit just above the 3D view but underneath the HUD, so buttons and timers stay crisp
    const hud = document.getElementById('hud');
    if (hud && hud.parentNode === app) app.insertBefore(overlayEl, hud); else app.appendChild(overlayEl);
    frozenLabelEl = overlayEl.querySelector('#sfxFrozenLabel');
  }
  function setOv(cls, on) { if (_ovState[cls] !== on) { _ovState[cls] = on; overlayEl.classList.toggle(cls, on); } }
  function updateOverlay(st) {
    if (!overlayEl) mountUI();
    if (!overlayEl) return;
    const live = !!st && !G.over && G.phase !== 'menu' && G.phase !== 'vs' && G.phase !== 'end';
    setOv('is-frozen', live && !!st.frozen);
    const stacks = live && !st.frozen ? clamp(st.chillStacks || 0, 0, 3) : 0;
    setOv('is-chill-1', stacks === 1); setOv('is-chill-2', stacks === 2); setOv('is-chill-3', stacks >= 3);
    setOv('is-burning', live && !!st.burning);
    setOv('is-heavy', live && !!st.slowed);
    setOv('is-wind', live && !!st.airChaos);
  }

  const EMPTY = { chillStacks: 0, frozen: false, burning: false, slowed: false, airChaos: false, slipping: false, freezeTimer: 0 };

  function update(dt) {
    if (!G.player || G.phase === 'menu' || G.phase === 'vs') { if (overlayEl) updateOverlay(null); return; }
    const getSt = env.getStatus;
    const chars = [...(G.allHiders || []), ...(G.allSeekers || [])];
    for (const ch of chars) {
      if (!ch) continue;
      const gone = ch.userData?.actor?.eliminated || ch.visible === false;
      const st = gone ? EMPTY : (getSt(ch) || EMPTY);
      let fx = fxByChar.get(ch);
      const active = (st.chillStacks > 0) || st.frozen || st.burning || st.slowed || st.airChaos || st.slipping;
      if (!fx && !active) continue;
      if (!fx) fx = makeFx(ch);
      fx.grp.visible = !gone || fx.frozen;
      if (!updateOne(fx, st, dt)) disposeFx(fx);
    }
    updateLoose(dt);
    const me = G.player;
    updateOverlay(me && !me.userData?.actor?.eliminated ? (getSt(me) || EMPTY) : null);
  }

  function clearAll() {
    for (const fx of [...fxByChar.values()]) disposeFx(fx);
    for (const b of loose) { scene.remove(b.m); if (b.ownMat) b.m.material.dispose(); }
    loose.length = 0;
    if (overlayEl) updateOverlay(null);
  }

  return { mountUI, update, clearAll, getActiveCount: () => fxByChar.size };
}
