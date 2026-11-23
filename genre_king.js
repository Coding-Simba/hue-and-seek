/* ==========================================================================
 * Hue & Seek — Genre-King v4.0 Gameplay Systems (`genre_king.js`)
 *
 * Implements the 5 core interactive pillars that elevate Hue & Seek:
 *   1. Tactile Prop Physics (real props physically rock & clunk; fake player
 *      props squeak, flinch & leak vivid paint splatter decals).
 *   2. Detective Tracking (4.2s glowing wet footprints from running/jumping
 *      disguised Hiders + Seeker Crosshair Proximity Heat-Arc).
 *   3. Active Hider Counterplay & Clutches (12s Water Bubble-Cage Teammate
 *      Rescue + 2-in-1 Prop-Slam Stun Boop w/ spinning dizzy stars OR Rolling
 *      Bait Prop toss).
 *   4. Hue Overdrive Final-25s Climax multipliers & golden aura.
 *   5. Funny Post-Match Superlative Awards + Live 3-Map Rematch Voting.
 * ========================================================================== */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const CERAMIC_IDS = new Set([
  'flower_pot', 'milk_can', 'watering_can', 'bh_sake_cask', 'bh_tea_table',
  'sr_levitation_urn', 'sp_olive_amphora', 'sp_lemon_planter', 'cw_steam_samovar',
  'bw_inkwell_pot', 'mb_glow_shroom_pot',
]);

const SPLAT_PALETTE = [0xff5d73, 0xffb833, 0x38d9a9, 0x4dabf7, 0xcc5de8, 0xff8787];

export const BUBBLE_CAGE_SEC = 12.0;
export const BOOP_COOLDOWN_SEC = 11.0;
export const BOOP_STUN_SEC = 1.15;
export const BOOP_RANGE = 4.1;
export const WANTED_MULTIPLIERS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

/**
 * Pure function: generates a GTA-style "Village Breaking News" viral headline for the Result card.
 */
export function buildBreakingNewsHeadline({
  playerName = 'Spirit',
  mode = 'hide',
  won = false,
  wantedStars = 0,
  boopsLanded = 0,
  heroRescues = 0,
  wrongSprays = 0,
  eliminations = 0,
  mapTitle = 'Meadowbrook',
} = {}) {
  const who = String(playerName || 'Spirit').slice(0, 16);
  if (wantedStars >= 4) {
    return `📰 BREAKING: ${wantedStars}★ Most Wanted "${who}" turned ${mapTitle} into pure chaos!`;
  }
  if (heroRescues >= 1) {
    return `📰 HERO ALERT: "${who}" popped ${heroRescues} Bubble Cage${heroRescues === 1 ? '' : 's'} to save the squad!`;
  }
  if (boopsLanded >= 2) {
    return `📰 WATCH OUT: Rogue prop "${who}" boop-stunned ${boopsLanded} Hunters in ${mapTitle}!`;
  }
  if (mode === 'seek' && eliminations >= 4) {
    return `📰 CLEAN SWEEP: Detective "${who}" busted ${eliminations} disguised Spirits!`;
  }
  if (mode === 'seek' && wrongSprays >= 7) {
    return `📰 LOCAL NEWS: "${who}" declared war on ${wrongSprays} innocent barrels in ${mapTitle}!`;
  }
  if (mode === 'hide' && won) {
    return `📰 UNSEEN GHOST: Hunters still searching ${mapTitle} after "${who}" vanished in plain sight!`;
  }
  return `📰 LIVE FROM ${mapTitle.toUpperCase()}: Wild 5v5 showdown wraps up with "${who}" in the spotlight!`;
}

/**
 * Pure function: computes 2–3 funny, share-worthy post-match award superlatives.
 */
export function computeMatchAwards({
  mode = 'hide',
  won = false,
  wrongSprays = 0,
  eliminations = 0,
  heroRescues = 0,
  boopsLanded = 0,
  damageTaken = 0,
  overdriveClutch = false,
  propsMorphed = 0,
} = {}) {
  const out = [];
  if (heroRescues >= 1) {
    out.push({
      id: 'hero_rescuer',
      icon: '🦸',
      title: 'Hero Rescuer',
      detail: `Popped ${heroRescues} teammate bubble${heroRescues === 1 ? '' : 's'}!`,
      tone: 'gold',
    });
  }
  if (boopsLanded >= 1) {
    out.push({
      id: 'boop_master',
      icon: '💫',
      title: 'Boop Master',
      detail: `Dizzy-stunned ${boopsLanded} Seeker${boopsLanded === 1 ? '' : 's'}!`,
      tone: 'violet',
    });
  }
  if (mode === 'seek' && wrongSprays >= 5) {
    out.push({
      id: 'barrel_bully',
      icon: '🤡',
      title: 'Barrel Bully',
      detail: `Sprayed ${wrongSprays} innocent real props!`,
      tone: 'coral',
    });
  }
  if (mode === 'seek' && eliminations >= 3 && wrongSprays <= 2) {
    out.push({
      id: 'sniper_soaker',
      icon: '💦',
      title: 'Sniper Soaker',
      detail: `${eliminations} soaks with laser precision!`,
      tone: 'sky',
    });
  }
  if (mode === 'hide' && won && damageTaken <= 0) {
    out.push({
      id: 'master_disguise',
      icon: '👻',
      title: 'Master of Disguise',
      detail: 'Untouched ghost — 0 damage taken!',
      tone: 'emerald',
    });
  }
  if (overdriveClutch) {
    out.push({
      id: 'overdrive_legend',
      icon: '⚡',
      title: 'Overdrive Legend',
      detail: 'Clutched during final 25s Hue Overdrive!',
      tone: 'gold',
    });
  }
  if (propsMorphed >= 4) {
    out.push({
      id: 'chameleon',
      icon: '🎭',
      title: 'Shapeshifter',
      detail: `Morphed into ${propsMorphed} disguises!`,
      tone: 'sky',
    });
  }
  if (out.length === 0) {
    out.push(
      mode === 'seek'
        ? { id: 'keen_hunter', icon: '🔎', title: 'Prop Detective', detail: 'Kept the Spirits on their toes!', tone: 'sky' }
        : { id: 'sneaky_spirit', icon: '🌿', title: 'Sneaky Spirit', detail: 'Blended right into the village!', tone: 'emerald' }
    );
  }
  return out.slice(0, 3);
}

export function createGenreKingManager(env = {}) {
  const { THREE, scene, G } = env;

  // --- Pillar 1: Wobbling real props + neon paint splatters
  const wobblingProps = new Map(); // propRec -> { t, dur, dx, dz, origRx, origRz, origPy }
  const paintSplats = [];
  const splatGeo = THREE ? new THREE.CircleGeometry(0.42, 12) : null;
  if (splatGeo) splatGeo.rotateX(-Math.PI / 2);

  // --- Pillar 2: Fading wet / glowing footprints + Crosshair Heat-Arc
  const footprints = [];
  const MAX_FOOTPRINTS = 48;
  const footGeo = THREE ? new THREE.RingGeometry(0.11, 0.24, 14) : null;
  if (footGeo) footGeo.rotateX(-Math.PI / 2);
  let lastHeatTickAt = 0;

  // --- Pillar 3: Water Bubble-Cages, Dizzy Stun Stars, Boop Shockwaves, Rolling Bait Props
  const bubbleCages = []; // { ch, mesh, ring, labelSp, labelCtx, labelTex, timeLeft, origY }
  const dizzyStars = new Map(); // seekerChar -> { grp, until }
  const boopRings = [];
  const baitProps = [];
  let boopCdLeft = 0;

  // --- GTA 6 v5.0: Wanted Stars (0..5), Chain Prop Rattle, & 3D Squad Pings
  const wantedByChar = new WeakMap();
  let lastLocalWantedStars = 0;
  let lastHeatCoolAt = -1e9;
  const squadPings = []; // { mesh, ring, team, kind, pos, t, dur, senderName }
  let lastPingAt = -1e9;
  let overdriveStarGranted = false;

  // --- Pillar 5: 3-Map Rematch Vote state
  let mapVoteState = null; // { candidates: [id,id,id], votes: Map<voterKey, mapId>, myVote: null }

  function isOverdriveActive() {
    if (!G || G.over || G.isTutorial) return false;
    const active = G.phase === 'survive' || G.phase === 'seek';
    return Boolean(active && G.t > 0 && G.t <= 25);
  }

  function getOverdriveHiderSpeedMul() {
    return isOverdriveActive() ? 1.16 : 1.0;
  }

  function getOverdriveCdRate() {
    return isOverdriveActive() ? 2.0 : 1.0;
  }

  function getOverdriveSeekerFireMul() {
    return isOverdriveActive() ? 0.68 : 1.0;
  }

  // ------------------------------------------------------------------ Pillar 1
  function onRealPropHit(propRec, hitPoint, hitDir) {
    if (!propRec || !propRec.g) return;
    const g = propRec.g;
    const existing = wobblingProps.get(propRec);
    const origRx = existing ? existing.origRx : g.rotation.x;
    const origRz = existing ? existing.origRz : g.rotation.z;
    const origPy = existing ? existing.origPy : g.position.y;
    const dx = hitDir ? hitDir.x : (Math.random() - 0.5);
    const dz = hitDir ? hitDir.z : (Math.random() - 0.5);
    const len = Math.hypot(dx, dz) || 1;
    wobblingProps.set(propRec, {
      t: 0,
      dur: 0.52,
      dx: dx / len,
      dz: dz / len,
      origRx,
      origRz,
      origPy,
    });
    const isCeramic = CERAMIC_IDS.has(propRec.id);
    env.audio?.propClunk?.(isCeramic);
    if (hitPoint && env.spawnDustPuff) {
      env.spawnDustPuff(hitPoint, 3, isCeramic ? 0xe8f4ff : 0xe8d6b3);
    }
  }

  function spawnPaintSplatter(pos, colorHex = null) {
    if (!THREE || !scene || !splatGeo || !pos) return;
    const col = colorHex || SPLAT_PALETTE[Math.floor(Math.random() * SPLAT_PALETTE.length)];
    if (env.spawnDustPuff) env.spawnDustPuff(pos, 5, col);
    if (paintSplats.length >= 28) {
      const old = paintSplats.shift();
      if (old) { scene.remove(old.m); old.m.material.dispose(); }
    }
    const gy = env.groundHeightAt ? env.groundHeightAt(pos.x, pos.z, pos.y) : (pos.y || 0);
    const mat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const m = new THREE.Mesh(splatGeo, mat);
    m.position.set(pos.x + (Math.random() - 0.5) * 0.35, gy + 0.04, pos.z + (Math.random() - 0.5) * 0.35);
    const sc = 0.75 + Math.random() * 0.7;
    m.scale.set(sc, 1, sc * (0.8 + Math.random() * 0.4));
    m.rotation.y = Math.random() * Math.PI * 2;
    m.renderOrder = 2;
    scene.add(m);
    paintSplats.push({ m, t: 0, dur: 9.0 });
  }

  function onFakePlayerHit(victim, hitPoint) {
    env.audio?.propSqueak?.();
    const pos = hitPoint || (victim && env.centerOf ? env.centerOf(victim) : victim?.position);
    if (pos) spawnPaintSplatter(pos);
  }

  // ------------------------------------------------------------------ Pillar 2
  function spawnFootprint(x, groundY, z, yaw = 0, isJump = false) {
    if (!THREE || !scene || !footGeo) return;
    if (footprints.length >= MAX_FOOTPRINTS) {
      const old = footprints.shift();
      if (old) { scene.remove(old.m); old.m.material.dispose(); }
    }
    const isSeekViewer = G?.mode === 'seek';
    const mat = new THREE.MeshBasicMaterial({
      color: isJump ? 0xffd166 : 0x56e0ff,
      transparent: true,
      opacity: isSeekViewer ? 0.72 : 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(footGeo, mat);
    m.position.set(x, (groundY || 0) + 0.045, z);
    m.rotation.z = yaw;
    const sc = isJump ? 1.55 : 0.92;
    m.scale.setScalar(sc);
    m.renderOrder = 2;
    scene.add(m);
    footprints.push({ m, t: 0, dur: 4.2, baseOp: mat.opacity });
  }

  function updateCrosshairHeat(now) {
    if (typeof document === 'undefined') return;
    const arcWrap = document.getElementById('crossHeatArc');
    if (!arcWrap) return;
    const activeSeek = Boolean(G && G.mode === 'seek' && G.phase === 'seek' && !G.over && !G.isTutorial && G.player);
    if (!activeSeek) {
      arcWrap.classList.add('hidden');
      arcWrap.dataset.temp = 'none';
      return;
    }
    const p = G.player.position;
    const maxRange = isOverdriveActive() ? 14.0 : 9.5;
    let bestD = Infinity;
    for (const h of (G.allHiders || [])) {
      if (!h || h.userData?.actor?.eliminated || h.userData?.inBubbleCage) continue;
      const d = Math.hypot(h.position.x - p.x, h.position.z - p.z);
      if (d < bestD) bestD = d;
    }
    if (bestD > maxRange) {
      arcWrap.classList.add('hidden');
      arcWrap.dataset.temp = 'none';
      return;
    }
    arcWrap.classList.remove('hidden');
    const heat01 = clamp(1 - (bestD - 2.0) / (maxRange - 2.0), 0.08, 1);
    const temp = bestD < 3.8 ? 'hot' : (bestD < 6.5 ? 'warm' : 'cold');
    arcWrap.dataset.temp = temp;
    arcWrap.style.opacity = String(clamp(0.32 + heat01 * 0.68, 0.32, 1).toFixed(2));
    const ringEl = arcWrap.querySelector('circle');
    if (ringEl) {
      const circ = 125.6;
      ringEl.style.strokeDashoffset = String((circ * (1 - heat01)).toFixed(1));
    }
    // Gentle Geiger tick when WARM or HOT
    const tickInterval = temp === 'hot' ? 320 : (temp === 'warm' ? 680 : 99999);
    if (now - lastHeatTickAt >= tickInterval) {
      lastHeatTickAt = now;
      env.audio?.heatTick?.(heat01);
    }
  }

  // ------------------------------------------------------------------ Pillar 3
  function makeBubbleCountdownSprite(secText) {
    if (typeof document === 'undefined' || !THREE) return null;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 96;
    const ctx = cv.getContext('2d');
    const draw = (txt) => {
      ctx.clearRect(0, 0, 256, 96);
      ctx.fillStyle = 'rgba(20, 46, 72, 0.86)';
      ctx.strokeStyle = '#7ce8ff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(12, 12, 232, 72, 36);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fffef4';
      ctx.font = '900 34px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 128, 49);
    };
    draw(secText);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(2.2, 0.82, 1);
    sp.renderOrder = 26;
    return { sp, ctx, tex, draw };
  }

  function trapInBubbleCage(ch) {
    if (!ch || !THREE || !scene) return null;
    const existing = bubbleCages.find((c) => c.ch === ch);
    if (existing) return existing;
    const u = ch.userData;
    u.inBubbleCage = true;
    const bubbleGeo = new THREE.SphereGeometry(1.18, 22, 16);
    const bubbleMat = new THREE.MeshPhysicalMaterial
      ? new THREE.MeshPhongMaterial({
          color: 0x7ce8ff,
          emissive: 0x1a78a8,
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.44,
          shininess: 110,
          depthWrite: false,
        })
      : new THREE.MeshBasicMaterial({ color: 0x7ce8ff, transparent: true, opacity: 0.42, depthWrite: false });
    const mesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    const ringGeo = new THREE.RingGeometry(1.05, 1.35, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7ce8ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    const gy = u.groundY || 0;
    mesh.position.set(ch.position.x, gy + 1.25, ch.position.z);
    ring.position.set(ch.position.x, gy + 0.05, ch.position.z);
    scene.add(mesh);
    scene.add(ring);

    const lbl = makeBubbleCountdownSprite(`🫧 RESCUE ${Math.ceil(BUBBLE_CAGE_SEC)}s`);
    if (lbl) {
      lbl.sp.position.set(ch.position.x, gy + 2.7, ch.position.z);
      scene.add(lbl.sp);
    }

    const cage = {
      ch,
      mesh,
      ring,
      lbl,
      timeLeft: BUBBLE_CAGE_SEC,
      lastShownSec: Math.ceil(BUBBLE_CAGE_SEC),
      baseY: gy,
    };
    bubbleCages.push(cage);
    return cage;
  }

  function removeBubbleCage(cage) {
    if (!cage) return;
    const idx = bubbleCages.indexOf(cage);
    if (idx >= 0) bubbleCages.splice(idx, 1);
    if (cage.mesh) { scene?.remove(cage.mesh); cage.mesh.geometry?.dispose?.(); cage.mesh.material?.dispose?.(); }
    if (cage.ring) { scene?.remove(cage.ring); cage.ring.geometry?.dispose?.(); cage.ring.material?.dispose?.(); }
    if (cage.lbl) { scene?.remove(cage.lbl.sp); cage.lbl.tex?.dispose?.(); cage.lbl.sp.material?.dispose?.(); }
    if (cage.ch?.userData) cage.ch.userData.inBubbleCage = false;
  }

  function rescueFromBubble(cage, rescuer, fromNet = false) {
    if (!cage || !cage.ch) return false;
    const ch = cage.ch;
    const u = ch.userData;
    removeBubbleCage(cage);
    if (u.actor) u.actor.eliminated = false;
    if (u.ai) {
      const mx = u.ai.maxHp || 140;
      u.ai.hp = Math.round(mx * 0.75);
      u.ai.state = 'flee';
    }
    if (ch === G?.player) {
      G.hp = Math.round((G.maxHp || 140) * 0.75);
      G.spectating = false;
    }
    if (u.nameplate) u.nameplate.visible = true;
    u.adrenalineUntil = performance.now() + 2600;
    env.splash?.(ch.position, 34, 3.4);
    env.audio?.rescueFanfare?.();

    const rName = rescuer?.userData?.actor?.name || 'Ally';
    const vName = u.actor?.name || 'Spirit';
    env.pushFeed?.('🫧', `<b>${rName}</b> popped <b>${vName}</b>'s Bubble Cage! HERO RESCUE!`, 'ally');

    if (rescuer === G?.player) {
      G._heroRescues = (G._heroRescues || 0) + 1;
      addWantedStar(rescuer, 'Hero Rescue');
      env.progression?.recordPersonaStat?.('rescues', 1);
      env.progression?.awardTokens?.('hero_rescue', 50, `🦸 HERO RESCUE! Freed ${vName}! +50 🪙`, 55);
      env.hint?.(`🦸 HERO RESCUE! You freed ${vName}! (+50 🪙)`, 2200);
      env.addCamTrauma?.(0.32);
    } else if (ch === G?.player) {
      env.hint?.(`🫧 ${rName} popped your Bubble! RUN!`, 2200);
    }
    if (!fromNet && env.MP && env.MP.isLiveSession()) {
      env.MP.broadcastGadget({
        k: 'bubble_rescue',
        vs: u.actor?.slotIdx ?? 0,
        rs: rescuer?.userData?.actor?.slotIdx ?? 0,
      });
    }
    return true;
  }

  function getActiveBubbleCages() {
    return bubbleCages;
  }

  function attachDizzyStars(seeker, untilMs) {
    if (!THREE || !scene || !seeker) return;
    let rec = dizzyStars.get(seeker);
    if (!rec) {
      const grp = new THREE.Group();
      const starGeo = new THREE.OctahedronGeometry(0.11, 0);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffe042 });
      for (let i = 0; i < 4; i++) {
        const st = new THREE.Mesh(starGeo, starMat);
        const a = (Math.PI * 2 * i) / 4;
        st.position.set(Math.cos(a) * 0.44, 0, Math.sin(a) * 0.44);
        grp.add(st);
      }
      scene.add(grp);
      rec = { grp, starGeo, starMat, until: untilMs };
      dizzyStars.set(seeker, rec);
    }
    rec.until = Math.max(rec.until, untilMs);
  }

  function spawnBoopShockwave(pos) {
    if (!THREE || !scene || !pos) return;
    const geo = new THREE.RingGeometry(0.3, 0.55, 28);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x, (pos.y || 0) + 0.15, pos.z);
    scene.add(m);
    boopRings.push({ m, t: 0, dur: 0.36 });
  }

  function spawnBaitProp(ch) {
    if (!THREE || !scene || !ch || !env.buildProp) return false;
    const propId = ch.userData?.propId || 'barrel';
    const mesh = env.buildProp(propId);
    if (!mesh) return false;
    const yaw = ch === G?.player ? (G.yaw + Math.PI) : ch.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const gy = ch.userData?.groundY || 0;
    mesh.position.set(ch.position.x + fx * 0.85, gy + 0.35, ch.position.z + fz * 0.85);
    scene.add(mesh);
    baitProps.push({
      m: mesh,
      vx: fx * 7.6,
      vy: 3.8,
      vz: fz * 7.6,
      t: 0,
      dur: 3.4,
      stepT: 0,
    });
    return true;
  }

  function triggerBoopOrBait(ch) {
    if (!ch || !G || G.over || G.spectating || G.ghost || G.mode !== 'hide') return false;
    if (ch === G.player && boopCdLeft > 0) {
      env.hint?.(`💫 Boop recharging (${Math.ceil(boopCdLeft)}s)…`, 900);
      return false;
    }
    const now = performance.now();
    const hitSeekers = [];
    for (const s of (G.allSeekers || [])) {
      if (!s || s.userData?.actor?.eliminated) continue;
      const d = Math.hypot(s.position.x - ch.position.x, s.position.z - ch.position.z);
      if (d <= BOOP_RANGE) hitSeekers.push({ s, d });
    }

    if (ch === G.player) {
      boopCdLeft = BOOP_COOLDOWN_SEC;
    }
    spawnBoopShockwave(ch.position);
    // GTA 6 Chain-Reaction Physics: rattle ALL real props within 5.5m so Seekers lose track!
    triggerChainPropRattle(ch.position, 5.5);

    if (hitSeekers.length > 0) {
      env.audio?.boopStun?.();
      for (const { s } of hitSeekers) {
        const dx = s.position.x - ch.position.x;
        const dz = s.position.z - ch.position.z;
        const len = Math.hypot(dx, dz) || 1;
        s.userData._stunUntil = now + BOOP_STUN_SEC * 1000;
        s.userData._kvx = (dx / len) * 6.8;
        s.userData._kvz = (dz / len) * 6.8;
        attachDizzyStars(s, s.userData._stunUntil);
      }
      if (ch === G.player) {
        G._boopsLanded = (G._boopsLanded || 0) + hitSeekers.length;
        addWantedStar(ch, 'Seeker Boop');
        env.progression?.recordPersonaStat?.('boops', hitSeekers.length);
        env.addCamTrauma?.(0.35);
        env.hint?.(`💫 BONK! Dizzy-stunned ${hitSeekers.length} Seeker${hitSeekers.length === 1 ? '' : 's'}!`, 1800);
        env.pushFeed?.('💫', `<b>${ch.userData?.actor?.name || 'You'}</b> boop-stunned a Seeker!`, 'ally');
      }
      if (env.MP && env.MP.isLiveSession()) {
        env.MP.broadcastGadget({
          k: 'boop_stun',
          s: ch.userData?.actor?.slotIdx ?? 0,
          x: +ch.position.x.toFixed(1),
          z: +ch.position.z.toFixed(1),
        });
      }
      return true;
    }

    // No seeker within close boop range -> launch a rolling fake Bait Prop!
    spawnBaitProp(ch);
    env.audio?.poof?.(false);
    if (ch === G.player) {
      env.hint?.('🎳 Tossed a Rolling Bait Prop to fool the Seekers!', 1700);
    }
    return true;
  }

  function isSeekerStunned(ch, now = performance.now()) {
    return Boolean(ch && ch.userData && (ch.userData._stunUntil || 0) > now);
  }

  // ------------------------------------------------------------------ Pillar 5: 3-Map Vote
  function initMapVote(unlockedMaps = ['meadow'], currentMapId = 'meadow', mapTitles = {}) {
    const pool = unlockedMaps.filter((m) => m && m !== 'tutorial');
    const unique = [...new Set(pool.length ? pool : ['meadow'])];
    // Pick up to 3 distinct maps (preferring variety)
    const picks = [];
    const shuffled = [...unique].sort((a, b) => (a === currentMapId ? 1 : b === currentMapId ? -1 : Math.random() - 0.5));
    for (const id of shuffled) {
      if (picks.length < 3) picks.push(id);
    }
    const votes = new Map();
    // Seed 2 friendly lobby bot votes so the voting bar immediately feels alive!
    if (picks.length > 0) {
      votes.set('bot_v1', picks[0]);
      if (picks.length > 1) votes.set('bot_v2', picks[Math.floor(Math.random() * Math.min(2, picks.length))]);
    }
    mapVoteState = { candidates: picks, votes, myVote: null, mapTitles };
    renderMapVote();
    return mapVoteState;
  }

  function castMapVote(voterKey, mapId, broadcast = false) {
    if (!mapVoteState || !mapVoteState.candidates.includes(mapId)) return;
    mapVoteState.votes.set(String(voterKey), mapId);
    if (voterKey === 'local') {
      mapVoteState.myVote = mapId;
      env.audio?.tap?.();
      if (broadcast && env.MP && env.MP.isLiveSession()) {
        env.MP.broadcastGadget({ k: 'map_vote', m: mapId, v: env.MP.getPlayerName?.() || 'Player' });
      }
    }
    renderMapVote();
  }

  function getWinningVotedMap(fallback = 'meadow') {
    if (!mapVoteState || !mapVoteState.candidates.length) return fallback;
    const counts = new Map(mapVoteState.candidates.map((id) => [id, 0]));
    for (const [, mId] of mapVoteState.votes) {
      if (counts.has(mId)) counts.set(mId, counts.get(mId) + 1);
    }
    let best = mapVoteState.myVote || mapVoteState.candidates[0];
    let bestC = -1;
    for (const [mId, c] of counts) {
      if (c > bestC || (c === bestC && mId === mapVoteState.myVote)) {
        best = mId;
        bestC = c;
      }
    }
    return best || fallback;
  }

  function renderMapVote() {
    if (typeof document === 'undefined' || !mapVoteState) return;
    const slot = document.getElementById('resultMapVote');
    if (!slot) return;
    if (mapVoteState.candidates.length < 2) {
      slot.classList.add('hidden');
      return;
    }
    slot.classList.remove('hidden');
    const counts = new Map(mapVoteState.candidates.map((id) => [id, 0]));
    for (const [, mId] of mapVoteState.votes) {
      if (counts.has(mId)) counts.set(mId, counts.get(mId) + 1);
    }
    slot.innerHTML = `
      <div class="mv-hdr">🗺️ Vote Next World for Rematch</div>
      <div class="mv-row">
        ${mapVoteState.candidates.map((id) => {
          const title = mapVoteState.mapTitles[id] || id;
          const c = counts.get(id) || 0;
          const active = mapVoteState.myVote === id;
          return `<button type="button" class="mv-btn${active ? ' active' : ''}" data-vote-map="${id}">
            <span class="mv-name">${title}</span>
            <b class="mv-cnt">${c} 🗳️</b>
          </button>`;
        }).join('')}
      </div>
    `;
    slot.querySelectorAll('[data-vote-map]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        castMapVote('local', btn.dataset.voteMap, true);
      });
    });
  }

  function renderMatchAwards(stats) {
    if (typeof document === 'undefined') return [];
    const awards = computeMatchAwards(stats);
    const slot = document.getElementById('resultAwardsSlot');
    if (slot) {
      slot.classList.remove('hidden');
      slot.innerHTML = awards.map((a) => `
        <div class="gk-award gk-tone-${a.tone}">
          <span class="gk-aw-ic">${a.icon}</span>
          <div class="gk-aw-meta">
            <b>${a.title}</b>
            <small>${a.detail}</small>
          </div>
        </div>
      `).join('');
    }
    return awards;
  }

  // ------------------------------------------------------------------ Per-Frame Update
  function update(dt, now) {
    const cdRate = getOverdriveCdRate();
    if (boopCdLeft > 0) {
      boopCdLeft = Math.max(0, boopCdLeft - dt * cdRate);
    }
    // Sync Boop HUD button
    if (typeof document !== 'undefined') {
      const btn = document.getElementById('btnBoop');
      if (btn && G) {
        const show = G.mode === 'hide' && !G.over && !G.spectating && !G.ghost && (G.phase === 'survive' || G.phase === 'hide');
        btn.classList.toggle('hidden', !show);
        if (show) {
          const ready = boopCdLeft <= 0.05;
          btn.classList.toggle('is-cd', !ready);
          btn.classList.toggle('is-overdrive', isOverdriveActive());
          const lbl = btn.querySelector('.boop-lbl');
          if (lbl) lbl.textContent = ready ? 'Boop' : `${Math.ceil(boopCdLeft)}s`;
        }
      }
    }

    // 1. Update wobbling real props
    for (const [rec, w] of wobblingProps) {
      w.t += dt;
      if (w.t >= w.dur || !rec.g) {
        if (rec.g) {
          rec.g.rotation.x = w.origRx;
          rec.g.rotation.z = w.origRz;
          rec.g.position.y = w.origPy;
        }
        wobblingProps.delete(rec);
        continue;
      }
      const p = w.t / w.dur;
      const damp = Math.exp(-p * 5.2);
      const osc = Math.sin(p * Math.PI * 4.5) * damp;
      rec.g.rotation.x = w.origRx + w.dz * osc * 0.28;
      rec.g.rotation.z = w.origRz - w.dx * osc * 0.28;
      rec.g.position.y = w.origPy + Math.max(0, Math.sin(p * Math.PI * 2) * damp * 0.14);
    }

    // 2. Fade neon paint splatters
    for (let i = paintSplats.length - 1; i >= 0; i--) {
      const s = paintSplats[i];
      s.t += dt;
      if (s.t >= s.dur) {
        scene?.remove(s.m);
        s.m.material.dispose();
        paintSplats.splice(i, 1);
      } else if (s.t > s.dur * 0.65) {
        s.m.material.opacity = 0.78 * (1 - (s.t - s.dur * 0.65) / (s.dur * 0.35));
      }
    }

    // 3. Fade wet / glowing footprints + emit footprints for sprinting disguised Hiders
    for (let i = footprints.length - 1; i >= 0; i--) {
      const f = footprints[i];
      f.t += dt;
      if (f.t >= f.dur) {
        scene?.remove(f.m);
        f.m.material.dispose();
        footprints.splice(i, 1);
      } else {
        const p = f.t / f.dur;
        f.m.material.opacity = f.baseOp * (1 - p);
      }
    }
    if (G && !G.over && (G.phase === 'survive' || G.phase === 'seek')) {
      for (const h of (G.allHiders || [])) {
        const u = h?.userData;
        if (!u || u.actor?.eliminated || u.inBubbleCage || !u.propId || (u.jy || 0) > 0.14) continue;
        if ((u.spd || 0) > 3.1) {
          u._fpAcc = (u._fpAcc || 0) + dt;
          if (u._fpAcc >= 0.34) {
            u._fpAcc = 0;
            spawnFootprint(h.position.x, u.groundY || 0, h.position.z, h.rotation.y, false);
          }
        }
      }
    }

    // 4. Update Seeker Crosshair Proximity Heat-Arc
    updateCrosshairHeat(now);

    // 5. Update Water Bubble Cages & check teammate rescue proximity!
    for (let i = bubbleCages.length - 1; i >= 0; i--) {
      const c = bubbleCages[i];
      c.timeLeft -= dt;
      const bob = Math.sin(now * 0.004) * 0.18;
      if (c.mesh) {
        c.mesh.position.y = c.baseY + 1.25 + bob;
        c.mesh.rotation.y += dt * 0.8;
      }
      if (c.ch) c.ch.position.y = c.baseY + 0.35 + bob;
      if (c.ring) c.ring.scale.setScalar(1 + Math.sin(now * 0.006) * 0.08);
      const secNow = Math.max(0, Math.ceil(c.timeLeft));
      if (c.lbl && secNow !== c.lastShownSec) {
        c.lastShownSec = secNow;
        c.lbl.draw(`🫧 RESCUE ${secNow}s`);
        c.lbl.tex.needsUpdate = true;
      }
      // Check if any living, uncaged Hider teammate touches the bubble!
      let rescued = false;
      for (const ally of (G?.allHiders || [])) {
        if (!ally || ally === c.ch || ally.userData?.actor?.eliminated || ally.userData?.inBubbleCage) continue;
        const d = Math.hypot(ally.position.x - c.ch.position.x, ally.position.z - c.ch.position.z);
        if (d <= 2.45) {
          rescueFromBubble(c, ally, false);
          rescued = true;
          break;
        }
      }
      if (rescued) continue;
      if (c.timeLeft <= 0) {
        const ch = c.ch;
        removeBubbleCage(c);
        env.onBubbleExpired?.(ch);
      }
    }

    // 6. Animate spinning Dizzy Stars above stunned Seekers
    for (const [s, rec] of dizzyStars) {
      if (now >= rec.until || !s || !s.parent) {
        scene?.remove(rec.grp);
        rec.starGeo.dispose();
        rec.starMat.dispose();
        dizzyStars.delete(s);
        continue;
      }
      const gy = (s.userData?.groundY || 0) + (s.userData?.jy || 0);
      rec.grp.position.set(s.position.x, gy + 2.02, s.position.z);
      rec.grp.rotation.y += dt * 7.5;
    }

    // 7. Animate Boop Shockwave rings
    for (let i = boopRings.length - 1; i >= 0; i--) {
      const r = boopRings[i];
      r.t += dt;
      const p = r.t / r.dur;
      if (p >= 1) {
        scene?.remove(r.m);
        r.m.geometry.dispose();
        r.m.material.dispose();
        boopRings.splice(i, 1);
      } else {
        r.m.scale.setScalar(1 + p * 6.8);
        r.m.material.opacity = 0.9 * (1 - p);
      }
    }

    // 8. Animate Rolling Bait Props
    for (let i = baitProps.length - 1; i >= 0; i--) {
      const b = baitProps[i];
      b.t += dt;
      if (b.t >= b.dur) {
        env.splash?.(b.m.position, 14, 1.8);
        scene?.remove(b.m);
        baitProps.splice(i, 1);
        continue;
      }
      b.vy -= 14.5 * dt;
      b.m.position.x += b.vx * dt;
      b.m.position.z += b.vz * dt;
      b.m.position.y += b.vy * dt;
      const gy = env.groundHeightAt ? env.groundHeightAt(b.m.position.x, b.m.position.z, b.m.position.y) : 0;
      if (b.m.position.y <= gy + 0.12) {
        b.m.position.y = gy + 0.12;
        b.vy = Math.abs(b.vy) * 0.52;
        b.vx *= 0.86;
        b.vz *= 0.86;
      }
      b.m.rotation.x += dt * 6.5;
      b.m.rotation.z += dt * 4.2;
      b.stepT += dt;
      if (b.stepT >= 0.36) {
        b.stepT = 0;
        spawnFootprint(b.m.position.x, gy, b.m.position.z, 0, false);
      }
    }

    // 9. GTA 6 Overdrive Star grant + Animate 3D Squad Pings
    if (!overdriveStarGranted && isOverdriveActive() && G?.mode === 'hide' && G.player && !G.player.userData?.actor?.eliminated) {
      overdriveStarGranted = true;
      addWantedStar(G.player, 'Hue Overdrive');
    }
    for (let i = squadPings.length - 1; i >= 0; i--) {
      const sp = squadPings[i];
      sp.t += dt;
      if (sp.t >= sp.dur) {
        scene?.remove(sp.mesh); sp.mesh.geometry?.dispose?.(); sp.mesh.material?.dispose?.();
        scene?.remove(sp.ring); sp.ring.geometry?.dispose?.(); sp.ring.material?.dispose?.();
        squadPings.splice(i, 1);
        continue;
      }
      sp.mesh.position.y = sp.baseY + 1.55 + Math.sin(now * 0.006 + i) * 0.24;
      sp.mesh.rotation.y += dt * 3.2;
      const pulse = 1 + ((sp.t * 1.4) % 1) * 1.5;
      sp.ring.scale.setScalar(pulse);
      sp.ring.material.opacity = 0.85 * (1 - ((sp.t * 1.4) % 1));
    }
  }

  // ------------------------------------------------------------------ GTA 6 v5.0 Systems
  function triggerChainPropRattle(centerPos, radius = 5.5) {
    if (!centerPos || !env.getRealProps) return 0;
    const props = env.getRealProps() || [];
    let rattled = 0;
    for (const r of props) {
      if (!r || !r.pos || !r.g || r.isAnimal) continue;
      const dx = r.pos.x - centerPos.x;
      const dz = r.pos.z - centerPos.z;
      const d = Math.hypot(dx, dz);
      if (d <= radius && d > 0.1) {
        onRealPropHit(r, r.pos, { x: dx / d, z: dz / d });
        rattled++;
        if (rattled >= 10) break;
      }
    }
    return rattled;
  }

  function getWantedStars(ch) {
    if (!ch) return 0;
    return wantedByChar.get(ch) || 0;
  }

  function syncWantedHud() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('wantedStarsHud');
    if (!el) return;
    const stars = G?.player && G.mode === 'hide' && !G.over && !G.spectating ? getWantedStars(G.player) : 0;
    if (stars <= 0) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const filled = '★'.repeat(stars);
    const empty = '☆'.repeat(5 - stars);
    const mul = WANTED_MULTIPLIERS[stars] || 1;
    el.innerHTML = `<span class="ws-stars">${filled}<em>${empty}</em></span><b class="ws-mul">${mul.toFixed(2).replace(/\.00$/, '')}× 🪙</b>`;
    el.dataset.stars = String(stars);
  }

  function addWantedStar(ch, reason = 'Mischief') {
    if (!ch || G?.over || G?.isTutorial) return 0;
    const prev = getWantedStars(ch);
    const next = clamp(prev + 1, 1, 5);
    wantedByChar.set(ch, next);
    if (ch === G?.player) {
      lastLocalWantedStars = Math.max(lastLocalWantedStars, next);
      G._wantedStars = next;
      syncWantedHud();
      if (next > prev) {
        env.audio?.wantedStarUp?.(next);
        env.progression?.recordPersonaStat?.('maxWantedStars', next, true);
        const mul = WANTED_MULTIPLIERS[next] || 1;
        env.hint?.(`⭐ WANTED ${next}★ (${reason}) · ${mul}× Coin Multiplier!`, 2100);
        if (next >= 3) {
          env.pushFeed?.('⭐', `<b>${ch.userData?.actor?.name || 'You'}</b> hit <b>${next}★ MOST WANTED!</b>`, 'warn');
        }
      }
    }
    return next;
  }

  function onCleanDisguiseSwap(ch, newPropId, prevPropId) {
    if (!ch || !newPropId || newPropId === prevPropId || G?.phase !== 'survive') return false;
    const stars = getWantedStars(ch);
    const now = performance.now();
    if (stars >= 1 && now - lastHeatCoolAt > 9000) {
      lastHeatCoolAt = now;
      if (ch === G?.player) {
        env.audio?.heatCooled?.();
        env.progression?.awardTokens?.('heat_cooled', 25, '🕵️ HEAT COOLED! Clean Disguise Swap +25 🪙', 30);
        env.hint?.('🕵️ HEAT COOLED! Clean swap threw off the Hunters (+25 🪙)', 2200);
      }
      return true;
    }
    return false;
  }

  function claimWantedBounty(victim, killer) {
    const stars = getWantedStars(victim);
    if (stars < 2 || !killer) return 0;
    const bounty = 20 + stars * 10;
    if (killer === G?.player) {
      env.progression?.recordPersonaStat?.('bounties', 1);
      env.progression?.awardTokens?.('wanted_bounty', bounty, `💰 ${stars}★ MOST WANTED BOUNTY! +${bounty} 🪙`, 45);
      env.pushFeed?.('💰', `<b>${killer.userData?.actor?.name || 'You'}</b> claimed a <b>${stars}★ Bounty (+${bounty} 🪙)!</b>`, 'soak');
    }
    return bounty;
  }

  function dropSquadPing(sender, worldPos, kind = null, fromNet = false) {
    if (!sender || !worldPos || !THREE || !scene || G?.over) return null;
    const now = performance.now();
    if (!fromNet && sender === G?.player && now - lastPingAt < 2500) return null;
    if (!fromNet && sender === G?.player) lastPingAt = now;

    const team = sender.userData?.actor?.team || (G?.mode === 'seek' ? 'seekers' : 'hiders');
    const resolvedKind = kind || (team === 'seekers' ? 'check' : (sender.userData?.inBubbleCage ? 'rescue' : 'danger'));
    const color = resolvedKind === 'danger' ? 0xff5a5f : (resolvedKind === 'rescue' ? 0x56e0ff : 0xffcc33);
    const gy = env.groundHeightAt ? env.groundHeightAt(worldPos.x, worldPos.z, worldPos.y) : (worldPos.y || 0);

    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.set(worldPos.x, gy + 1.55, worldPos.z);
    scene.add(mesh);

    const ringGeo = new THREE.RingGeometry(0.55, 0.85, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.position.set(worldPos.x, gy + 0.06, worldPos.z);
    scene.add(ring);

    const ping = {
      mesh,
      ring,
      team,
      kind: resolvedKind,
      pos: { x: worldPos.x, y: gy, z: worldPos.z },
      baseY: gy,
      t: 0,
      dur: 7.5,
      senderName: sender.userData?.actor?.name || 'Ally',
    };
    squadPings.push(ping);
    if (squadPings.length > 6) {
      const old = squadPings.shift();
      scene?.remove(old.mesh); old.mesh.geometry?.dispose?.(); old.mesh.material?.dispose?.();
      scene?.remove(old.ring); old.ring.geometry?.dispose?.(); old.ring.material?.dispose?.();
    }

    const myTeam = G?.mode === 'seek' ? 'seekers' : 'hiders';
    if (team === myTeam) {
      env.audio?.squadPing?.(resolvedKind);
      const label = resolvedKind === 'check' ? '🎯 Check Here!' : (resolvedKind === 'rescue' ? '🫧 Rescue Me!' : '⚠️ Seeker Spotted!');
      env.pushFeed?.('📍', `<b>${ping.senderName}</b> pinged: <b>${label}</b>`, 'ally');
      if (sender === G?.player) {
        env.hint?.(`📍 Squad Ping sent: ${label} (Allies responding!)`, 1700);
      }
    }
    if (!fromNet && env.MP && env.MP.isLiveSession()) {
      env.MP.broadcastGadget({
        k: 'squad_ping',
        t: team === 'seekers' ? 1 : 0,
        s: sender.userData?.actor?.slotIdx ?? 0,
        pk: resolvedKind,
        x: +worldPos.x.toFixed(1),
        z: +worldPos.z.toFixed(1),
      });
    }
    return ping;
  }

  function getActiveSquadPingForTeam(team) {
    for (let i = squadPings.length - 1; i >= 0; i--) {
      if (squadPings[i].team === team) return squadPings[i];
    }
    return null;
  }

  function renderBreakingNews(opts = {}) {
    const headline = buildBreakingNewsHeadline({ ...opts, wantedStars: opts.wantedStars ?? lastLocalWantedStars });
    if (typeof document !== 'undefined') {
      const el = document.getElementById('resultNewsTicker');
      if (el) {
        el.textContent = headline;
        el.classList.remove('hidden');
      }
    }
    return headline;
  }

  function clearAll() {
    for (const [rec, w] of wobblingProps) {
      if (rec?.g) {
        rec.g.rotation.x = w.origRx;
        rec.g.rotation.z = w.origRz;
        rec.g.position.y = w.origPy;
      }
    }
    wobblingProps.clear();
    for (const s of paintSplats) { scene?.remove(s.m); s.m.material.dispose(); }
    paintSplats.length = 0;
    for (const f of footprints) { scene?.remove(f.m); f.m.material.dispose(); }
    footprints.length = 0;
    while (bubbleCages.length) removeBubbleCage(bubbleCages[0]);
    for (const [, rec] of dizzyStars) { scene?.remove(rec.grp); rec.starGeo.dispose(); rec.starMat.dispose(); }
    dizzyStars.clear();
    for (const r of boopRings) { scene?.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); }
    boopRings.length = 0;
    for (const b of baitProps) scene?.remove(b.m);
    baitProps.length = 0;
    for (const sp of squadPings) {
      scene?.remove(sp.mesh); sp.mesh.geometry?.dispose?.(); sp.mesh.material?.dispose?.();
      scene?.remove(sp.ring); sp.ring.geometry?.dispose?.(); sp.ring.material?.dispose?.();
    }
    squadPings.length = 0;
    boopCdLeft = 0;
    lastLocalWantedStars = 0;
    overdriveStarGranted = false;
    if (G) G._wantedStars = 0;
    if (typeof document !== 'undefined') {
      const arcWrap = document.getElementById('crossHeatArc');
      if (arcWrap) arcWrap.classList.add('hidden');
      const btn = document.getElementById('btnBoop');
      if (btn) btn.classList.add('hidden');
      const ws = document.getElementById('wantedStarsHud');
      if (ws) ws.classList.add('hidden');
      const nt = document.getElementById('resultNewsTicker');
      if (nt) nt.classList.add('hidden');
    }
  }

  function onRemoteGadget(pkt) {
    if (!pkt) return false;
    if (pkt.k === 'map_vote' && pkt.m) {
      castMapVote(pkt.v || 'peer', pkt.m, false);
      return true;
    }
    if (pkt.k === 'squad_ping') {
      const sender = (pkt.t === 1 ? G?.allSeekers?.[pkt.s] : G?.allHiders?.[pkt.s]) || null;
      if (sender && sender !== G?.player && typeof pkt.x === 'number' && typeof pkt.z === 'number') {
        dropSquadPing(sender, { x: pkt.x, y: 0, z: pkt.z }, pkt.pk || 'check', true);
      }
      return true;
    }
    if (pkt.k === 'bubble_rescue') {
      const victim = G?.allHiders?.[pkt.vs];
      const rescuer = G?.allHiders?.[pkt.rs];
      const cage = bubbleCages.find((c) => c.ch === victim);
      if (cage) rescueFromBubble(cage, rescuer, true);
      return true;
    }
    if (pkt.k === 'boop_stun') {
      const h = G?.allHiders?.[pkt.s];
      if (h && h !== G?.player) {
        spawnBoopShockwave(h.position);
        triggerChainPropRattle(h.position, 5.5);
        env.audio?.boopStun?.();
      }
      return true;
    }
    return false;
  }

  function getNearestFootprint(pos, maxDist = 11) {
    if (!pos || !footprints.length) return null;
    let best = null, bestD = maxDist;
    for (let i = footprints.length - 1; i >= 0; i--) {
      const f = footprints[i];
      if (!f || !f.m || f.t > f.dur * 0.75) continue;
      const d = Math.hypot(f.m.position.x - pos.x, f.m.position.z - pos.z);
      if (d < bestD && d > 1.2) {
        bestD = d;
        best = { x: f.m.position.x, y: f.m.position.y, z: f.m.position.z, d };
      }
    }
    return best;
  }

  return {
    isOverdriveActive,
    getOverdriveHiderSpeedMul,
    getOverdriveCdRate,
    getOverdriveSeekerFireMul,
    onRealPropHit,
    onFakePlayerHit,
    triggerChainPropRattle,
    spawnFootprint,
    getNearestFootprint,
    trapInBubbleCage,
    rescueFromBubble,
    getActiveBubbleCages,
    triggerBoopOrBait,
    isSeekerStunned,
    addWantedStar,
    getWantedStars,
    onCleanDisguiseSwap,
    claimWantedBounty,
    dropSquadPing,
    getActiveSquadPingForTeam,
    initMapVote,
    castMapVote,
    getWinningVotedMap,
    renderMatchAwards,
    renderBreakingNews,
    onRemoteGadget,
    update,
    clearAll,
    getBoopCooldown: () => boopCdLeft,
  };
}
