/* Hue & Seek — Shared World Interactives (Turrets, Creatures, Flyers, & Audio Synths)
 * Used across the 5 Storybook worlds so living creatures, playable animal/flyer disguises,
 * mounted turrets, and contraptions follow one cohesive, mobile-fast engine pattern.
 */

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

function normAng(a) {
  let x = a;
  while (x > PI) x -= TAU;
  while (x < -PI) x += TAU;
  return x;
}

function lerpAng(a, b, t) {
  return a + normAng(b - a) * clamp(t, 0, 1);
}

export function createMatCache(THREE) {
  const map = new Map();
  return function mat(hex, opts = {}) {
    const m = opts.metalness ?? 0;
    const r = opts.roughness ?? 0.85;
    const em = opts.emissive ?? 0;
    const ei = opts.emissiveIntensity ?? 0;
    const tr = !!opts.transparent;
    const op = opts.opacity ?? 1;
    const fs = opts.flatShading !== false;
    const ds = !!opts.doubleSided;
    const key = `${hex}|${m}|${r}|${em}|${ei}|${tr ? 1 : 0}|${op}|${fs ? 1 : 0}|${ds ? 1 : 0}`;
    let out = map.get(key);
    if (!out) {
      out = new THREE.MeshStandardMaterial({
        color: hex,
        metalness: m,
        roughness: r,
        emissive: em,
        emissiveIntensity: ei,
        transparent: tr,
        opacity: op,
        flatShading: fs,
        side: ds ? THREE.DoubleSide : THREE.FrontSide,
      });
      map.set(key, out);
    }
    return out;
  };
}

// ============================================================================
// Procedural WebAudio Synths (Turrets, Bell, Creatures)
// ============================================================================
export function playTurretFireAudio(audio, style = 'cannon') {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;

  try {
    if (style === 'prism') {
      // Resonant crystalline harmonic bolt
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(1180, now);
      osc1.frequency.exponentialRampToValueAtTime(340, now + 0.24);
      osc2.frequency.setValueAtTime(1770, now);
      osc2.frequency.exponentialRampToValueAtTime(510, now + 0.22);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(g);
      osc2.connect(g);
      g.connect(dest);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.30);
      osc2.stop(now + 0.30);
      return;
    }

    if (style === 'acorn') {
      // Elastic braided rubber twang + woody thock
      const osc = ctx.createOscillator();
      const thud = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.linearRampToValueAtTime(420, now + 0.045);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.20);
      thud.type = 'sine';
      thud.frequency.setValueAtTime(240, now);
      thud.frequency.exponentialRampToValueAtTime(85, now + 0.08);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g);
      thud.connect(g);
      g.connect(dest);
      osc.start(now);
      thud.start(now);
      osc.stop(now + 0.24);
      thud.stop(now + 0.10);
      return;
    }

    if (style === 'waterwheel') {
      // Pressurized steam-water thump + swoosh
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.16);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.014);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(g);
      g.connect(dest);
      osc.start(now);
      osc.stop(now + 0.21);
      const bufs = audio.getBuffers?.();
      if (bufs?.pink) {
        const src = ctx.createBufferSource();
        src.buffer = bufs.pink;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(980, now);
        bp.frequency.exponentialRampToValueAtTime(340, now + 0.22);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.18, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(dest);
        src.start(now, Math.random() * 0.4, 0.26);
      }
      return;
    }

    if (style === 'bell') {
      // Deep resonant bronze bell toll
      const freqs = [246.94, 370.0, 493.88, 659.25];
      const masterG = ctx.createGain();
      masterG.gain.setValueAtTime(0.001, now);
      masterG.gain.linearRampToValueAtTime(0.28, now + 0.015);
      masterG.gain.exponentialRampToValueAtTime(0.001, now + 1.85);
      masterG.connect(dest);
      freqs.forEach((f, idx) => {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = idx % 2 ? 'triangle' : 'sine';
        o.frequency.setValueAtTime(f, now);
        og.gain.value = 0.45 / (idx + 1);
        o.connect(og);
        og.connect(masterG);
        o.start(now);
        o.stop(now + 1.9);
      });
      return;
    }

    // Default coastal/village cannon thump
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(740, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.26, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + 0.19);
  } catch (_) {
    // AudioContext can reject when backgrounded
  }
}

export function playCreatureCallAudio(audio, callType = 'chirp', vol = 0.14) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted()) || vol <= 0.01) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  const v = clamp(vol, 0.02, 0.25);

  try {
    if (callType === 'critter') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(760 + Math.random() * 280, now);
      o.frequency.exponentialRampToValueAtTime(1240, now + 0.06);
      o.frequency.exponentialRampToValueAtTime(620, now + 0.12);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(v, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      o.connect(g); g.connect(dest); o.start(now); o.stop(now + 0.15);
    } else if (callType === 'crane') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(640, now);
      o.frequency.linearRampToValueAtTime(860, now + 0.08);
      o.frequency.exponentialRampToValueAtTime(490, now + 0.26);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(v * 0.9, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      o.connect(g); g.connect(dest); o.start(now); o.stop(now + 0.30);
    } else if (callType === 'gull' || callType === 'pelican') {
      const base = callType === 'pelican' ? 390 : 720;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(base * 1.9, now);
      o.frequency.setValueAtTime(base, now);
      o.frequency.linearRampToValueAtTime(base * 1.32, now + 0.07);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, now + 0.24);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(v * 0.72, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      o.connect(lp); lp.connect(g); g.connect(dest); o.start(now); o.stop(now + 0.27);
    } else if (callType === 'manta') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(290 + Math.random() * 80, now);
      o.frequency.linearRampToValueAtTime(440, now + 0.16);
      o.frequency.exponentialRampToValueAtTime(220, now + 0.42);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(v * 0.85, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
      o.connect(g); g.connect(dest); o.start(now); o.stop(now + 0.46);
    } else if (callType === 'clockwork' || callType === 'owl') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(callType === 'owl' ? 1100 : 1850, now);
      o.frequency.setValueAtTime(callType === 'owl' ? 480 : 620, now);
      o.frequency.setValueAtTime(callType === 'owl' ? 370 : 880, now + 0.08);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(v * 0.55, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      o.connect(lp); lp.connect(g); g.connect(dest); o.start(now); o.stop(now + 0.20);
    } else {
      // Bee / Dragonfly / Ladybug garden buzz
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(920, now);
      o.frequency.setValueAtTime(callType === 'dragonfly' ? 310 : 215, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(v * 0.5, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      o.connect(lp); lp.connect(g); g.connect(dest); o.start(now); o.stop(now + 0.18);
    }
  } catch (_) {
    // Ignore synth failure
  }
}

// ============================================================================
// Mounted Anti-Air / Signature Turret Builder (`kind: 'turret'`)
// ============================================================================
export function buildTurretMount(THREE, opts = {}) {
  const mat = createMatCache(THREE);
  const style = opts.style || 'harbor';
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const z = opts.z ?? 0;
  const seatOffset = opts.seatOffset ?? 0.20;
  const seatY = y + seatOffset;
  const exitX = opts.exitX ?? x;
  const exitZ = opts.exitZ ?? (z - 1.45);
  const defaultYaw = opts.defaultYaw ?? 0;
  const minPitch = opts.minPitch ?? -0.32;
  const maxPitch = opts.maxPitch ?? 1.48;

  const group = new THREE.Group();
  group.name = opts.id || 'world_turret';
  group.userData.keep = true;
  group.position.set(x, y, z);

  // Palette per world style
  const palettes = {
    waterwheel: { base: 0x825532, trim: 0xd49a3a, metal: 0x3b4846, metalness: 0.25, barrel: 0x2c6e6a, accent: 0x62d2b8 },
    harbor:     { base: 0x5d5750, trim: 0xd64837, metal: 0x434d59, metalness: 0.35, barrel: 0xc2934b, accent: 0xf4ecd8 },
    prism:      { base: 0x9aa6b4, trim: 0x58e0ff, metal: 0x6b7c8e, metalness: 0.2,  barrel: 0x34b8e6, accent: 0xa4f4ff },
    acorn:      { base: 0x7e4f28, trim: 0xd8a84e, metal: 0x5a3b20, metalness: 0.0,  barrel: 0x8d5b30, accent: 0xe6cb94 },
  };
  const pal = palettes[style] || palettes.harbor;

  // 1. Stationary Pedestal Plinth
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.12, 0.28, 12),
    mat(pal.base, { roughness: 0.85, metalness: 0 })
  );
  plinth.position.y = 0.14;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.92, 0.06, 8, 24),
    mat(pal.trim, { roughness: 0.45, metalness: pal.metalness })
  );
  ring.rotation.x = PI / 2;
  ring.position.y = 0.29;
  group.add(ring);

  // 2. Yaw Turntable
  const yawPivot = new THREE.Group();
  yawPivot.position.y = 0.28;
  yawPivot.userData.keep = true;
  yawPivot.rotation.y = defaultYaw;
  group.add(yawPivot);

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.80, 0.14, 12),
    mat(pal.metal, { roughness: 0.55, metalness: pal.metalness })
  );
  deck.position.y = 0.07;
  deck.castShadow = true;
  yawPivot.add(deck);

  // Gunner seat + cheek pillars
  const seatBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.44, 0.10),
    mat(pal.base, { roughness: 0.82 })
  );
  seatBack.position.set(0, 0.46, 0.50);
  seatBack.rotation.x = 0.14;
  yawPivot.add(seatBack);

  const yokeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, 0.26), mat(pal.metal, { metalness: pal.metalness }));
  yokeL.position.set(-0.50, 0.56, -0.06);
  yokeL.castShadow = true;
  yawPivot.add(yokeL);

  const yokeR = yokeL.clone();
  yokeR.position.x = 0.50;
  yawPivot.add(yokeR);

  // 3. Pitch Pivot + Barrels / Style Decoration
  const pitchPivot = new THREE.Group();
  pitchPivot.position.set(0, 0.96, -0.06);
  pitchPivot.userData.keep = true;
  yawPivot.add(pitchPivot);

  const breech = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.36, 0.52),
    mat(pal.metal, { roughness: 0.45, metalness: pal.metalness })
  );
  breech.castShadow = true;
  pitchPivot.add(breech);

  const barrelL = new THREE.Group();
  barrelL.position.set(-0.22, 0.02, -0.22);
  barrelL.userData.keep = true;
  pitchPivot.add(barrelL);

  const barrelR = new THREE.Group();
  barrelR.position.set(0.22, 0.02, -0.22);
  barrelR.userData.keep = true;
  pitchPivot.add(barrelR);

  let waterWheelMesh = null;
  let prismCrystalMesh = null;
  let loadedAcorn = null;

  if (style === 'waterwheel') {
    // Copper herbal boiler barrel + side waterwheel rotor
    for (const bg of [barrelL, barrelR]) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 1.38, 10),
        mat(pal.barrel, { roughness: 0.38, metalness: 0.35 })
      );
      tube.rotation.x = PI / 2;
      tube.position.z = -0.68;
      tube.castShadow = true;
      bg.add(tube);
      const flare = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.11, 0.18, 10),
        mat(pal.trim, { roughness: 0.35, metalness: 0.35 })
      );
      flare.rotation.x = PI / 2;
      flare.position.z = -1.36;
      bg.add(flare);
    }
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.62, 12),
      mat(0x5da98e, { roughness: 0.45 })
    );
    tank.rotation.z = PI / 2;
    tank.position.set(0, 0.28, 0.04);
    pitchPivot.add(tank);

    waterWheelMesh = new THREE.Group();
    waterWheelMesh.position.set(-0.62, 0.68, 0.10);
    waterWheelMesh.userData.keep = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 14), mat(0x9a6434));
    rim.rotation.y = PI / 2;
    waterWheelMesh.add(rim);
    for (let i = 0; i < 6; i++) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.05), mat(0x6b4322));
      pad.rotation.x = (i / 6) * PI;
      waterWheelMesh.add(pad);
    }
    yawPivot.add(waterWheelMesh);
  } else if (style === 'prism') {
    // Glowing Celestia crystal emitters inside runic rings
    for (const bg of [barrelL, barrelR]) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        mat(pal.accent, { emissive: 0x3ce0ff, emissiveIntensity: 0.9, roughness: 0.2 })
      );
      crystal.scale.set(0.78, 0.78, 3.8);
      crystal.position.z = -0.68;
      bg.add(crystal);
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.03, 6, 12),
        mat(0xb8c0cc, { metalness: 0.25, roughness: 0.4 })
      );
      collar.position.z = -1.16;
      bg.add(collar);
    }
    prismCrystalMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      mat(0x88f4ff, { emissive: 0x38d8ff, emissiveIntensity: 1.1, roughness: 0.18 })
    );
    prismCrystalMesh.position.set(0, 0.36, -0.04);
    pitchPivot.add(prismCrystalMesh);
  } else if (style === 'acorn') {
    // Tinyfolk Y-fork oak slingshot + braided bands + giant loaded acorn!
    barrelL.position.set(0, 0.06, -0.18);
    barrelR.visible = false;
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.10, 0.92, 8), mat(0x7c4b23));
      arm.position.set(side * 0.32, 0.36, -0.35);
      arm.rotation.z = -side * 0.36;
      arm.rotation.x = -0.32;
      arm.castShadow = true;
      pitchPivot.add(arm);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 6), mat(0xc84b36));
      band.position.set(side * 0.24, 0.44, -0.22);
      band.rotation.x = PI / 2;
      band.rotation.y = side * 0.42;
      barrelL.add(band);
    }
    loadedAcorn = new THREE.Group();
    loadedAcorn.position.set(0, 0.40, 0.04);
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat(0x9b6634));
    nut.scale.set(0.95, 0.95, 1.28);
    loadedAcorn.add(nut);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 6, 0, TAU, 0, PI * 0.52), mat(0x52341b));
    cap.rotation.x = -PI / 2;
    cap.position.z = 0.06;
    loadedAcorn.add(cap);
    barrelL.add(loadedAcorn);
  } else {
    // Harbor Pier AA Cannon (Adriatic crimson stripes + twin brass barrels)
    for (const bg of [barrelL, barrelR]) {
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 0.45, 10),
        mat(pal.trim, { roughness: 0.45 })
      );
      sleeve.rotation.x = PI / 2;
      sleeve.position.z = -0.30;
      bg.add(sleeve);
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.088, 1.15, 10),
        mat(pal.barrel, { roughness: 0.34, metalness: 0.4 })
      );
      pipe.rotation.x = PI / 2;
      pipe.position.z = -0.96;
      pipe.castShadow = true;
      bg.add(pipe);
    }
    const sightRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 6, 14), mat(0xf6ecd6));
    sightRing.position.set(0, 0.34, -0.45);
    pitchPivot.add(sightRing);
  }

  // Ring sight / muzzle reference point
  const muzzleRef = new THREE.Object3D();
  muzzleRef.position.set(0, 0.06, -1.55);
  pitchPivot.add(muzzleRef);

  const camRef = new THREE.Object3D();
  camRef.position.set(0, 0.62, -0.22);
  pitchPivot.add(camRef);

  const spot = {
    id: opts.id || 'world_turret',
    kind: 'turret',
    icon: opts.icon || '🎯',
    label: opts.label || 'Mount Turret (Anti-Air)',
    leaveLabel: opts.leaveLabel || 'Hop Off Turret',
    mountHint: opts.mountHint || '🎯 Seated in the Turret! Aim high & fire to knock down soaring creatures! (G / Jump to hop off)',
    x,
    y,
    groundY: y,
    seatY,
    exitX,
    exitZ,
    z,
    triggerX: x,
    triggerY: y,
    triggerZ: z,
    interactRadius: opts.interactRadius || 2.85,
    occupiedBy: null,
  };

  let occupant = null;
  let aimYaw = defaultYaw;
  let aimPitch = 0.25;
  let recoilL = 0;
  let recoilR = 0;
  let alternate = false;
  let audioRef = null;
  const tmpV = new THREE.Vector3();

  const api = {
    spot,
    x,
    y,
    seatY,
    exitX,
    exitZ,
    z,
    mountHint: spot.mountHint,
    fireOpts: opts.fireOpts || { shotSpeed: 64, gravMulOverride: 0.09, scaleOverride: 1.45, lifeOverride: 2.6 },
    setAudio(a) {
      audioRef = a;
    },
    getOccupant() {
      return occupant;
    },
    mount(ch) {
      occupant = ch;
      spot.occupiedBy = ch;
    },
    dismount(ch) {
      if (!ch || occupant === ch) {
        occupant = null;
        spot.occupiedBy = null;
      }
    },
    setAim(yaw, pitch) {
      aimYaw = yaw;
      aimPitch = clamp(pitch, minPitch, maxPitch);
      yawPivot.rotation.y = aimYaw;
      pitchPivot.rotation.x = aimPitch;
    },
    getFirstPersonCameraPos() {
      group.updateMatrixWorld(true);
      camRef.getWorldPosition(tmpV);
      return tmpV.clone();
    },
    getMuzzleWorld() {
      group.updateMatrixWorld(true);
      muzzleRef.getWorldPosition(tmpV);
      return tmpV.clone();
    },
    triggerRecoil() {
      alternate = !alternate;
      if (style === 'acorn' || alternate) recoilL = 1.0;
      else recoilR = 1.0;
    },
    playShotSound() {
      api.triggerRecoil();
      playTurretFireAudio(audioRef, opts.audioStyle || style);
    },
    getFireOpts(shotCfg) {
      return {
        shotSpeed: api.fireOpts.shotSpeed || 64,
        gravMulOverride: api.fireOpts.gravMulOverride ?? 0.09,
        scaleOverride: api.fireOpts.scaleOverride ?? 1.45,
        lifeOverride: api.fireOpts.lifeOverride ?? 2.6,
        elemId: api.fireOpts.elemId || shotCfg?.elemId || 'water',
        spread: api.fireOpts.spread ?? 0.0045,
      };
    },
  };

  function update(dt, t) {
    const safeDt = Math.min(dt || 0.016, 0.05);
    recoilL = Math.max(0, recoilL - safeDt * 6.5);
    recoilR = Math.max(0, recoilR - safeDt * 6.5);
    barrelL.position.z = -0.22 + Math.sin(recoilL * PI * 0.5) * 0.24 + Math.sin(t * 1.1) * 0.001;
    barrelR.position.z = -0.22 + Math.sin(recoilR * PI * 0.5) * 0.24 + Math.cos(t * 1.1) * 0.001;
    if (waterWheelMesh) waterWheelMesh.rotation.x += safeDt * (occupant ? 3.2 : 1.1);
    if (prismCrystalMesh) prismCrystalMesh.rotation.y += safeDt * 1.4;
    if (loadedAcorn) loadedAcorn.visible = recoilL < 0.25;
    if (!occupant) {
      yawPivot.rotation.y = aimYaw + Math.sin(t * 0.45) * 0.016;
      pitchPivot.rotation.x = aimPitch + Math.sin(t * 0.72) * 0.012;
    }
  }

  return { group, spot, api, update };
}

// ============================================================================
// Unified Playable + NPC Creature Kinematics (`attachCreatureKinematics`)
// ============================================================================
export function attachCreatureKinematics(root, cfg = {}) {
  const mode = cfg.mode || 'bird_flapper';
  const canFly = !!cfg.canFly;
  root.userData.isAnimal = true;
  root.userData.canFly = canFly;

  const part = (name) => root.getObjectByName(name) || null;
  const bodyGrp = part('bodyGrp');
  const headGrp = part('headGrp');
  const tailGrp = part('tailGrp');
  const legsA = part('legsA');
  const legsB = part('legsB');
  const wingL = part('wingL');
  const wingR = part('wingR');
  const tipL = part('tipL');
  const tipR = part('tipR');
  const wing2L = part('wing2L');
  const wing2R = part('wing2R');
  const elytraL = part('elytraL');
  const elytraR = part('elytraR');
  const windKey = part('windKey');
  const starGrp = part('starGrp');

  const baseBodyY = bodyGrp ? bodyGrp.position.y : 0;
  let phase = Math.random() * TAU;

  root.userData.animateAnimal = (dt, moving, speed, timeSec, startled = false, airborne = false, vy = 0, bankRoll = 0) => {
    const d = Math.min(dt || 0.016, 0.05);
    const spdFactor = moving ? clamp(speed / 3.2, 0.5, 2.2) : 0.4;
    phase += d * (airborne ? 13.5 : moving ? 8.5 * spdFactor : 2.1);

    if (mode === 'suds_sprite') {
      const hop = moving ? Math.abs(Math.sin(phase * 1.4)) * (startled ? 0.14 : 0.09) : Math.sin(timeSec * 2.8) * 0.02;
      const sq = moving ? Math.sin(phase * 2.8) * 0.08 : Math.sin(timeSec * 2.6) * 0.03;
      if (bodyGrp) {
        bodyGrp.position.y = baseBodyY + hop;
        bodyGrp.scale.set(1 - sq * 0.45, 1 + sq, 1 - sq * 0.45);
        bodyGrp.rotation.z = startled ? Math.sin(timeSec * 22) * 0.14 : Math.sin(phase) * (moving ? 0.07 : 0.02);
      }
      if (starGrp) {
        starGrp.rotation.y += d * (moving ? 2.4 : 0.9);
        starGrp.rotation.z = Math.sin(timeSec * 3.4) * 0.12;
      }
      if (legsA) legsA.rotation.x = moving ? Math.sin(phase * 1.5) * 0.55 : 0;
      if (legsB) legsB.rotation.x = moving ? -Math.sin(phase * 1.5) * 0.55 : 0;
      return;
    }

    if (mode === 'bird_flapper') {
      const flapFreq = startled ? 14.0 : vy > 0.6 ? 10.2 : 6.4;
      const flapAmp = airborne ? (vy > 0.4 || startled ? 0.64 : 0.24) : 0.05;
      const flap = airborne
        ? Math.sin(timeSec * flapFreq + phase * 0.15) * flapAmp + (vy < -0.5 ? 0.12 : -0.04)
        : Math.sin(timeSec * 1.8) * 0.035;
      if (wingL) wingL.rotation.z = flap;
      if (wingR) wingR.rotation.z = -flap;
      if (tipL) tipL.rotation.z = airborne ? Math.sin(timeSec * flapFreq - 0.7) * flapAmp * 0.52 : -0.45;
      if (tipR) tipR.rotation.z = airborne ? -Math.sin(timeSec * flapFreq - 0.7) * flapAmp * 0.52 : 0.45;
      if (bodyGrp) {
        bodyGrp.position.y = baseBodyY + (airborne ? Math.sin(timeSec * flapFreq) * 0.05 : moving ? Math.abs(Math.sin(phase)) * 0.035 : 0);
        bodyGrp.rotation.z = lerp(bodyGrp.rotation.z, bankRoll, clamp(d * 8, 0, 1));
        bodyGrp.rotation.x = lerp(bodyGrp.rotation.x, airborne ? clamp(-vy * 0.055, -0.35, 0.32) : 0, clamp(d * 8, 0, 1));
      }
      if (headGrp) {
        headGrp.rotation.x = airborne ? -0.10 : (moving ? Math.sin(phase * 1.5) * 0.08 : Math.sin(timeSec * 1.9) * 0.09);
        headGrp.rotation.y = moving || airborne ? 0 : Math.sin(timeSec * 1.2) * 0.24;
      }
      if (legsA) legsA.rotation.x = airborne ? 0.78 : (moving ? Math.sin(phase * 1.2) * 0.55 : 0);
      if (legsB) legsB.rotation.x = airborne ? 0.78 : (moving ? -Math.sin(phase * 1.2) * 0.55 : 0);
      if (windKey) windKey.rotation.z += d * (startled ? 11.0 : moving || airborne ? 5.2 : 1.4);
      if (tailGrp) tailGrp.rotation.x = airborne ? 0.18 : Math.sin(timeSec * 2.1) * 0.06;
      return;
    }

    if (mode === 'sky_manta') {
      const beat = timeSec * (startled ? 7.4 : airborne || vy > 0.3 ? 4.8 : 2.6);
      const waveA = Math.sin(beat) * 0.42;
      const waveB = Math.sin(beat - 0.78) * 0.34;
      if (wingL) wingL.rotation.z = waveA;
      if (wingR) wingR.rotation.z = -waveA;
      if (tipL) tipL.rotation.z = waveB;
      if (tipR) tipR.rotation.z = -waveB;
      if (bodyGrp) {
        bodyGrp.position.y = baseBodyY + Math.sin(beat - 0.35) * 0.09;
        bodyGrp.rotation.z = lerp(bodyGrp.rotation.z, bankRoll, clamp(d * 6, 0, 1));
        bodyGrp.rotation.x = clamp(-vy * 0.05, -0.32, 0.32);
      }
      if (tailGrp) {
        tailGrp.rotation.x = Math.sin(beat - 1.1) * 0.18;
        tailGrp.rotation.y = Math.cos(beat * 0.7) * 0.22;
      }
      return;
    }

    if (mode === 'clockwork_pet') {
      const gait = moving ? Math.sin(phase * 1.5) * (startled ? 0.72 : 0.48) : 0;
      if (legsA) legsA.rotation.x = gait;
      if (legsB) legsB.rotation.x = -gait;
      if (bodyGrp) {
        bodyGrp.position.y = baseBodyY + (moving ? Math.abs(Math.sin(phase * 1.5)) * 0.045 : 0);
        bodyGrp.rotation.z = moving ? Math.sin(phase * 1.5) * 0.045 : 0;
      }
      if (headGrp) headGrp.rotation.z = Math.sin(timeSec * 2.2) * 0.06;
      if (tailGrp) tailGrp.rotation.y = Math.sin(timeSec * (startled ? 12 : 4.2)) * 0.35;
      if (windKey) windKey.rotation.z += d * (startled ? 12.0 : moving ? 5.6 : 1.5);
      return;
    }

    if (mode === 'insect_hover') {
      const hz = airborne || moving ? 38.0 : 12.0;
      const amp = airborne ? 0.52 : moving ? 0.28 : 0.08;
      const fl = Math.sin(timeSec * hz) * amp + 0.18;
      const fl2 = Math.cos(timeSec * hz) * amp * 0.85 + 0.16;
      if (wingL) wingL.rotation.z = fl;
      if (wingR) wingR.rotation.z = -fl;
      if (wing2L) wing2L.rotation.z = fl2;
      if (wing2R) wing2R.rotation.z = -fl2;
      if (bodyGrp) {
        bodyGrp.position.y = baseBodyY + (airborne ? Math.sin(timeSec * 7.5) * 0.05 : 0);
        bodyGrp.rotation.z = lerp(bodyGrp.rotation.z, bankRoll, clamp(d * 10, 0, 1));
        bodyGrp.rotation.x = airborne ? clamp(-vy * 0.04, -0.25, 0.25) : 0;
      }
      if (legsA) legsA.rotation.x = airborne ? 0.42 : Math.sin(phase * 2.2) * (moving ? 0.45 : 0);
      if (legsB) legsB.rotation.x = airborne ? 0.42 : -Math.sin(phase * 2.2) * (moving ? 0.45 : 0);
      return;
    }

    if (mode === 'scuttle_beetle') {
      const sc = moving ? Math.sin(phase * 2.2) * 0.55 : 0;
      if (legsA) legsA.rotation.x = sc;
      if (legsB) legsB.rotation.x = -sc;
      const flutter = airborne || startled;
      if (elytraL) {
        elytraL.rotation.y = lerp(elytraL.rotation.y, flutter ? 0.65 : 0, clamp(d * 12, 0, 1));
        elytraL.rotation.z = lerp(elytraL.rotation.z, flutter ? 0.35 : 0, clamp(d * 12, 0, 1));
      }
      if (elytraR) {
        elytraR.rotation.y = lerp(elytraR.rotation.y, flutter ? -0.65 : 0, clamp(d * 12, 0, 1));
        elytraR.rotation.z = lerp(elytraR.rotation.z, flutter ? -0.35 : 0, clamp(d * 12, 0, 1));
      }
      const wFlap = flutter ? Math.sin(timeSec * 36) * 0.55 + 0.15 : 0;
      if (wingL) { wingL.visible = flutter; wingL.rotation.z = wFlap; }
      if (wingR) { wingR.visible = flutter; wingR.rotation.z = -wFlap; }
      if (bodyGrp) bodyGrp.position.y = baseBodyY + (moving ? Math.abs(Math.sin(phase * 2.2)) * 0.035 : 0);
    }
  };
}

// ============================================================================
// Autonomous Fleet Controller (Walkers, Swim Critters & Perch-to-Sky Flyers)
// ============================================================================
export function createCreatureFleetController(THREE, ctx, specs = []) {
  const agents = [];
  const sampleH = ctx.groundHeightAt || (() => 0);
  let lastElapsed = 0;

  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    const g = sp.builder(THREE);
    g.userData.keep = true;
    const sc = sp.scale || 1;
    g.scale.setScalar(sc);

    const startPt = (sp.waypoints && sp.waypoints[0]) || { x: sp.x || 0, y: sp.y ?? 0, z: sp.z || 0 };
    const startY = sp.kind === 'flyer' ? (startPt.y ?? sp.orbitY ?? 8) : sampleH(startPt.x, startPt.z, startPt.y ?? 20);
    g.position.set(startPt.x, startY, startPt.z);
    ctx.root.add(g);

    const rec = {
      g,
      id: sp.id,
      pos: g.position,
      radius: (sp.radius || 0.42) * sc,
      height: (sp.height || 0.85) * sc,
      homeX: startPt.x,
      homeY: startY,
      homeZ: startPt.z,
      homeRotY: sp.rotY || 0,
      isAnimal: true,
      isFlyingBird: !!sp.canFly,
      isWildFlyingBird: !!sp.canFly,
      onStartled: null,
      onTurretHit: null,
    };

    g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = true;
        m.userData.propRoot = rec;
        if (ctx.solids) ctx.solids.push(m);
      }
    });
    if (ctx.realProps) ctx.realProps.push(rec);

    const agent = {
      sp,
      rec,
      g,
      kind: sp.kind || (sp.canFly ? 'flyer' : 'ground'),
      waypoints: sp.waypoints || [startPt],
      wpIdx: 0,
      pauseT: sp.kind === 'flyer' && sp.perches?.length ? 2.5 + (i % 4) * 1.4 : 0,
      orbitT: (i / Math.max(1, specs.length)) * TAU + (sp.phase || 0),
      mode: sp.kind === 'flyer' ? (sp.perches?.length ? 'perch' : 'soar') : 'walk',
      perchIdx: i % Math.max(1, sp.perches?.length || 1),
      flightTimer: 5.5 + (i % 3) * 2.4,
      startledUntil: -99,
      shotDownUntil: -99,
      vy: 0,
      nextSoundAt: 2.5 + i * 1.7,
      prevYaw: g.rotation.y,
    };

    rec.onStartled = (arg0, arg1) => {
      // Support both `(simSec, listenerPos)` and `impulseProp(dirX, dirZ, impulseMag)` signatures
      const isImpulseSig = typeof arg1 === 'number';
      const simSec = isImpulseSig ? lastElapsed : (typeof arg0 === 'number' ? arg0 : lastElapsed);
      const listenerPos = isImpulseSig
        ? (ctx.getActors?.()?.[0]?.position || null)
        : (arg1 && typeof arg1.distanceTo === 'function' ? arg1 : null);
      agent.startledUntil = Math.max(agent.startledUntil, simSec + 3.2);
      if (agent.kind === 'flyer' && agent.mode === 'perch') {
        agent.mode = 'soar';
        agent.flightTimer = 6.5;
        agent.pauseT = 0;
      }
      if (ctx.audio && (!listenerPos || listenerPos.distanceTo(g.position) < 18)) {
        playCreatureCallAudio(ctx.audio, sp.callType || 'chirp', 0.16);
      }
    };

    rec.onTurretHit = (arg0, arg1) => {
      const isImpulseSig = typeof arg1 === 'number';
      const simSec = isImpulseSig ? lastElapsed : (typeof arg0 === 'number' ? arg0 : lastElapsed);
      const listenerPos = isImpulseSig
        ? (ctx.getActors?.()?.[0]?.position || null)
        : (arg1 && typeof arg1.distanceTo === 'function' ? arg1 : null);
      agent.shotDownUntil = Math.max(agent.shotDownUntil, simSec + 4.0);
      agent.startledUntil = Math.max(agent.startledUntil, simSec + 4.2);
      agent.vy = -5.5;
      if (ctx.audio && (!listenerPos || listenerPos.distanceTo(g.position) < 38)) {
        playCreatureCallAudio(ctx.audio, sp.callType || 'gull', 0.18);
      }
    };

    agents.push(agent);
  }

  function update(dt, elapsed) {
    if (!dt && !elapsed) return;
    lastElapsed = typeof elapsed === 'number' ? elapsed : lastElapsed;
    const safeDt = Math.min(dt || 0.016, 0.05);
    const actors = ctx.getActors?.() || [];
    const listenerPos = actors[0]?.position || null;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const { sp, g } = a;
      const startled = elapsed < a.startledUntil;
      const shotDown = elapsed < a.shotDownUntil;

      // Ambient sound trigger when near player
      if (ctx.audio && elapsed >= a.nextSoundAt) {
        a.nextSoundAt = elapsed + (sp.soundInterval || 7.5) + ((i * 1.37) % 4.5);
        if (listenerPos && listenerPos.distanceTo(g.position) < 20) {
          const distK = clamp(1 - listenerPos.distanceTo(g.position) / 22, 0.15, 1);
          playCreatureCallAudio(ctx.audio, sp.callType || 'chirp', 0.11 * distK);
        }
      }

      let moving = false;
      let speed = sp.speed || 2.2;
      let airborne = false;
      let vyAnim = 0;

      if (a.kind === 'flyer') {
        const perches = sp.perches || [];
        const targetPerch = perches.length ? perches[a.perchIdx % perches.length] : null;

        if (shotDown) {
          const floorY = sampleH(g.position.x, g.position.z, g.position.y);
          a.vy = Math.max(-9.0, a.vy - 12 * safeDt);
          g.position.y = Math.max(floorY, g.position.y + a.vy * safeDt);
          airborne = g.position.y > floorY + 0.12;
          moving = true;
          vyAnim = a.vy;
        } else if (a.mode === 'perch' && targetPerch) {
          const kP = clamp(safeDt * 4.5, 0, 1);
          g.position.x += (targetPerch.x - g.position.x) * kP;
          g.position.y += (targetPerch.y - g.position.y) * kP;
          g.position.z += (targetPerch.z - g.position.z) * kP;
          a.pauseT -= safeDt;
          if (a.pauseT <= 0) {
            a.mode = 'soar';
            a.flightTimer = 6.5 + (i % 3) * 2.5;
            a.perchIdx = (a.perchIdx + 1) % perches.length;
          }
        } else {
          // Smooth scenic flight orbit or figure-8 between island/landmark coordinates
          airborne = true;
          moving = true;
          const orbSpd = (sp.orbitSpeed || 0.42) * (startled ? 1.55 : 1.0);
          a.orbitT += safeDt * orbSpd;
          const cx = sp.orbitCx ?? 0;
          const cz = sp.orbitCz ?? 0;
          const rx = sp.orbitRx ?? 13.5;
          const rz = sp.orbitRz ?? 11.5;
          const fig8 = sp.figure8 ? Math.sin(a.orbitT * 2.0) * 0.42 : 0;
          const tx = cx + Math.cos(a.orbitT) * rx + fig8 * 3.0;
          const tz = cz + Math.sin(a.orbitT) * rz;
          const ty = (sp.orbitY ?? 8.5) + Math.sin(a.orbitT * 2.3 + i) * (sp.bobY ?? 1.45);
          const dx = tx - g.position.x;
          const dy = ty - g.position.y;
          const dz = tz - g.position.z;
          const stepRate = clamp(safeDt * (startled ? 4.2 : 2.3), 0, 1);
          g.position.x += dx * stepRate;
          g.position.y += dy * stepRate;
          g.position.z += dz * stepRate;
          speed = Math.hypot(dx, dz) * 2.2;
          vyAnim = dy * 2.0;
          if (Math.hypot(dx, dz) > 0.05) {
            g.rotation.y = lerpAng(g.rotation.y, Math.atan2(dx, dz), clamp(safeDt * 4.5, 0, 1));
          }
          if (perches.length > 0) {
            a.flightTimer -= safeDt;
            if (a.flightTimer <= 0 && !startled) {
              a.mode = 'landing';
            }
          }
        }

        if (a.mode === 'landing' && targetPerch) {
          airborne = g.position.y > targetPerch.y + 0.22;
          moving = true;
          const dx = targetPerch.x - g.position.x;
          const dy = targetPerch.y - g.position.y;
          const dz = targetPerch.z - g.position.z;
          const dist = Math.hypot(dx, dy, dz);
          const spd = Math.min(dist, safeDt * 6.2);
          if (dist > 0.16) {
            g.position.x += (dx / dist) * spd;
            g.position.y += (dy / dist) * spd;
            g.position.z += (dz / dist) * spd;
            if (Math.hypot(dx, dz) > 0.04) g.rotation.y = lerpAng(g.rotation.y, Math.atan2(dx, dz), clamp(safeDt * 5, 0, 1));
            vyAnim = (dy / Math.max(dist, 0.1)) * 4.2;
          } else {
            g.position.set(targetPerch.x, targetPerch.y, targetPerch.z);
            a.mode = 'perch';
            a.pauseT = 3.2 + ((i * 1.9) % 2.8);
          }
        }
      } else {
        // Ground or surface-water patrol creature
        if (a.pauseT > 0 && !startled) {
          a.pauseT -= safeDt;
        } else {
          const wp = a.waypoints[a.wpIdx];
          const dx = wp.x - g.position.x;
          const dz = wp.z - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.32) {
            a.wpIdx = (a.wpIdx + 1) % a.waypoints.length;
            a.pauseT = startled ? 0.15 : (sp.pauseSec ?? 0.65 + (i % 3) * 0.45);
          } else {
            moving = true;
            const moveSpd = (sp.speed || 2.1) * (startled ? 1.85 : 1.0);
            speed = moveSpd;
            const step = Math.min(dist, moveSpd * safeDt);
            g.position.x += (dx / dist) * step;
            g.position.z += (dz / dist) * step;
            g.rotation.y = lerpAng(g.rotation.y, Math.atan2(dx, dz), clamp(safeDt * 7.5, 0, 1));
          }
        }
        const groundRefY = typeof wpOrHomeY(a) === 'number' ? wpOrHomeY(a) : g.position.y;
        const gy = typeof sp.fixedY === 'number' ? sp.fixedY : sampleH(g.position.x, g.position.z, groundRefY + 0.5);
        g.position.y = lerp(g.position.y, gy, clamp(safeDt * 12, 0, 1));
      }

      const yawDelta = normAng(g.rotation.y - a.prevYaw);
      a.prevYaw = g.rotation.y;
      const bankRoll = airborne ? clamp((-yawDelta / Math.max(safeDt, 0.01)) * 0.16, -0.46, 0.46) : 0;

      if (g.userData.animateAnimal) {
        g.userData.animateAnimal(safeDt, moving, speed, elapsed, startled, airborne, vyAnim, bankRoll);
      }
    }
  }

  function wpOrHomeY(a) {
    const wp = a.waypoints[a.wpIdx];
    return typeof wp?.y === 'number' ? wp.y : a.rec.homeY;
  }

  function dispose() {
    for (const a of agents) {
      if (a.g.parent) a.g.parent.remove(a.g);
    }
    agents.length = 0;
  }

  return { update, dispose, agents };
}

// ============================================================================
// Overhaul Gameplay Primitives (Breakables, Chase Traps, Steam/Soap/Jam, Warps, Rails & Tracks)
// ============================================================================
export function playWorldMechAudio(audio, kind = 'valve') {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;

  try {
    if (kind === 'steam' || kind === 'valve') {
      const len = Math.floor(ctx.sampleRate * 0.48);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.28));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650, now);
      bp.Q.value = 1.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(now);

      const clank = ctx.createOscillator();
      const cg = ctx.createGain();
      clank.type = 'triangle';
      clank.frequency.setValueAtTime(240, now);
      clank.frequency.exponentialRampToValueAtTime(95, now + 0.14);
      cg.gain.setValueAtTime(0.001, now);
      cg.gain.linearRampToValueAtTime(0.16, now + 0.01);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      clank.connect(cg);
      cg.connect(dest);
      clank.start(now);
      clank.stop(now + 0.17);
      return;
    }

    if (kind === 'shatter') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(88, now + 0.18);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.17, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(g);
      g.connect(dest);
      osc.start(now);
      osc.stop(now + 0.20);
      return;
    }

    if (kind === 'warp') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.03);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.18, now + idx * 0.03 + 0.22);
        g.gain.setValueAtTime(0.001, now + idx * 0.03);
        g.gain.linearRampToValueAtTime(0.09, now + idx * 0.03 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.25);
        osc.connect(g);
        g.connect(dest);
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.26);
      });
      return;
    }

    if (kind === 'flood') {
      const len = Math.floor(ctx.sampleRate * 0.6);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.42));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(780, now);
      lp.frequency.linearRampToValueAtTime(340, now + 0.55);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.20, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      src.connect(lp);
      lp.connect(g);
      g.connect(dest);
      src.start(now);
      return;
    }

    if (kind === 'spring' || kind === 'domino') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = kind === 'spring' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(kind === 'spring' ? 185 : 320, now);
      osc.frequency.exponentialRampToValueAtTime(kind === 'spring' ? 560 : 120, now + 0.22);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(g);
      g.connect(dest);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (kind === 'alarm') {
      [740, 932].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.001, now + idx * 0.08);
        g.gain.linearRampToValueAtTime(0.14, now + idx * 0.08 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
        osc.connect(g);
        g.connect(dest);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.24);
      });
    }
  } catch { /* WebAudio guard */ }
}

export function createBreakableRegistry(THREE, ctx = {}) {
  const records = new Map();
  const bridges = [];

  function markKeep(obj) {
    if (!obj) return;
    obj.traverse((m) => { m.userData.keep = true; });
  }

  function register(spec) {
    const {
      id,
      group,
      hitMeshes = null,
      hp = 2,
      x = 0,
      z = 0,
      y = 0,
      hx = 0.65,
      hz = 0.65,
      rot = 0,
      y0,
      y1,
      standable = false,
      maxR = null,
      kind = 'wood',
      dropBridge = null,
      onBreak = null,
      label = 'cover',
    } = spec;

    markKeep(group);
    const meshes = hitMeshes || [];
    if (!hitMeshes && group) {
      group.traverse((m) => { if (m.isMesh) meshes.push(m); });
    }
    for (const m of meshes) {
      m.userData._breakableId = id;
      m.userData.keep = true;
      if (ctx.solids && !ctx.solids.includes(m)) ctx.solids.push(m);
    }

    let blocker = null;
    if (ctx.addWorldObb && hx > 0 && hz > 0) {
      const by0 = typeof y0 === 'number' ? y0 : y - 0.35;
      const by1 = typeof y1 === 'number' ? y1 : y + 2.8;
      blocker = ctx.addWorldObb(x, z, hx, hz, rot, by0, by1, standable);
      if (blocker && typeof maxR === 'number') blocker.maxR = maxR;
    }

    let bridgeState = null;
    if (dropBridge && dropBridge.mesh) {
      markKeep(dropBridge.mesh);
      bridgeState = {
        ...dropBridge,
        progress: 0,
        active: false,
      };
      if (dropBridge.blocker) dropBridge.blocker.disabled = true;
      bridges.push(bridgeState);
    }

    const rec = {
      id,
      group,
      meshes,
      hp,
      maxHp: hp,
      broken: false,
      hitFlash: 0,
      x,
      y,
      z,
      kind,
      label,
      baseRotZ: group ? group.rotation.z : 0,
      blocker,
      bridgeState,
      onBreak,
    };
    records.set(id, rec);
    return rec;
  }

  function breakRecord(rec, hitPos, shooter, fromNet = false) {
    if (!rec || rec.broken) return;
    rec.broken = true;
    rec.hp = 0;
    if (rec.group && !rec.bridgeState) rec.group.visible = false;
    if (rec.blocker) rec.blocker.disabled = true;
    if (rec.bridgeState) {
      rec.bridgeState.active = true;
      if (rec.bridgeState.blocker) rec.bridgeState.blocker.disabled = false;
    }
    const burstPos = hitPos && typeof hitPos.clone === 'function'
      ? hitPos
      : new THREE.Vector3(hitPos?.x ?? rec.x, hitPos?.y ?? rec.y + 0.8, hitPos?.z ?? rec.z);
    if (ctx.splash) ctx.splash(burstPos, rec.kind === 'domino' ? 18 : 22, 2.4);
    if (ctx.spawnPuff) ctx.spawnPuff(burstPos, 10, 1.4, 0.52, 0.55, 0.7);
    if (ctx.audio) playWorldMechAudio(ctx.audio, rec.kind === 'domino' ? 'domino' : 'shatter');
    if (ctx.emitSoundCue && !fromNet) {
      ctx.emitSoundCue(burstPos, 12.5, 'chime', null);
    }
    if (typeof rec.onBreak === 'function') rec.onBreak(rec, shooter);
  }

  function handleShotImpact({ hitObject, elemId = 'water', point, shooter, isRemote = false } = {}) {
    const id = hitObject?.userData?._breakableId;
    if (!id) return null;
    const rec = records.get(id);
    if (!rec) return null;
    if (rec.broken) return { consumed: true, broken: true, id };

    const dmg = elemId === 'fire' || elemId === 'rock' || shooter?.userData?.inTurret ? 2 : 1;
    rec.hp = Math.max(0, rec.hp - dmg);
    rec.hitFlash = 0.28;
    if (rec.hp <= 0) {
      breakRecord(rec, point, shooter, isRemote);
      if (shooter?.userData && shooter.userData === ctx.getG?.()?.player && ctx.notify) {
        ctx.notify(rec.bridgeState ? `💥 Toppled ${rec.label} into a new bridge!` : `💥 Smashed ${rec.label}!`, 1500);
      }
      return { consumed: true, broken: true, id };
    }
    if (ctx.audio) playWorldMechAudio(ctx.audio, 'domino');
    if (ctx.spawnPuff && point) ctx.spawnPuff(point, 5, 0.8, 0.34, 0.35, 0.4);
    return { consumed: true, broken: false, id };
  }

  function triggerById(id, point, shooter) {
    const rec = records.get(id);
    if (rec && !rec.broken) breakRecord(rec, point, shooter, false);
  }

  function resetAll() {
    for (const rec of records.values()) {
      rec.hp = rec.maxHp;
      rec.broken = false;
      rec.hitFlash = 0;
      if (rec.group) {
        rec.group.visible = true;
        rec.group.rotation.z = rec.baseRotZ;
      }
      if (rec.blocker) rec.blocker.disabled = false;
      if (rec.bridgeState) {
        rec.bridgeState.active = false;
        rec.bridgeState.progress = 0;
        if (rec.bridgeState.blocker) rec.bridgeState.blocker.disabled = true;
        if (typeof rec.bridgeState.applyPose === 'function') rec.bridgeState.applyPose(rec.bridgeState.mesh, 0);
      }
    }
  }

  function update(dt) {
    const safeDt = Math.min(dt || 0.016, 0.05);
    for (const rec of records.values()) {
      if (rec.hitFlash > 0 && rec.group && !rec.broken) {
        rec.hitFlash = Math.max(0, rec.hitFlash - safeDt);
        rec.group.rotation.z = rec.baseRotZ + Math.sin(rec.hitFlash * 48) * 0.09;
        if (rec.hitFlash === 0) rec.group.rotation.z = rec.baseRotZ;
      }
      if (rec.bridgeState && rec.bridgeState.active && rec.bridgeState.progress < 1) {
        rec.bridgeState.progress = Math.min(1, rec.bridgeState.progress + safeDt * 2.6);
        if (typeof rec.bridgeState.applyPose === 'function') {
          rec.bridgeState.applyPose(rec.bridgeState.mesh, rec.bridgeState.progress);
        }
      }
    }
  }

  function getDynamicBridgeGround(x, z, refY) {
    let bestY = null;
    for (const br of bridges) {
      if (!br.active || br.progress < 0.45) continue;
      if (typeof refY === 'number' && refY < br.surfaceY - 1.35) continue;
      const dx = x - br.cx, dz = z - br.cz;
      const c = Math.cos(-(br.rot || 0)), s = Math.sin(-(br.rot || 0));
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= br.hx + 0.12 && Math.abs(lz) <= br.hz + 0.12) {
        if (bestY === null || br.surfaceY > bestY) bestY = br.surfaceY;
      }
    }
    return bestY;
  }

  return { register, handleShotImpact, triggerById, resetAll, update, getDynamicBridgeGround, records };
}

export function createHazardZoneRegistry(THREE, ctx = {}) {
  const clouds = [];
  const slipZones = [];
  const gates = [];
  const cloudGeo = new THREE.SphereGeometry(1, 16, 12);
  const matCache = createMatCache(THREE);

  function addSteamCloud({ id = '', x, y, z, radius = 3.8, duration = 5.5, color = 0xeef7ff, opacity = 0.56 }) {
    const grp = new THREE.Group();
    grp.userData.keep = true;
    grp.position.set(x, y, z);
    const mat = matCache(color, { roughness: 0.96, transparent: true, opacity, flatShading: false });
    const puffs = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(cloudGeo, mat);
      m.userData.keep = true;
      const a = (i / 6) * TAU;
      const rOff = radius * (i === 0 ? 0.08 : 0.42);
      m.position.set(Math.cos(a) * rOff, 0.7 + (i % 3) * 0.65, Math.sin(a) * rOff);
      m.scale.setScalar(radius * (0.48 + (i % 2) * 0.14));
      grp.add(m);
      puffs.push({ m, baseY: m.position.y, phase: i * 1.1 });
    }
    if (ctx.parent) ctx.parent.add(grp);
    clouds.push({ id, grp, puffs, x, y, z, radius, remaining: duration, duration });
    if (ctx.audio) playWorldMechAudio(ctx.audio, 'steam');
  }

  function clearSteamNearShot(point, elemId) {
    if (!point || elemId !== 'fire') return false;
    let cleared = false;
    for (const c of clouds) {
      const dist = Math.hypot(point.x - c.x, point.z - c.z);
      if (dist <= c.radius + 1.8 && c.remaining > 0.35) {
        c.remaining = 0.32;
        cleared = true;
      }
    }
    return cleared;
  }

  function breaksLineOfSight(from, to) {
    if (!clouds.length || !from || !to) return false;
    const vx = to.x - from.x, vy = to.y - from.y, vz = to.z - from.z;
    const lenSq = vx * vx + vy * vy + vz * vz;
    if (lenSq < 1e-4) return false;
    for (const c of clouds) {
      if (c.remaining <= 0.18) continue;
      const cx = c.x - from.x, cy = (c.y + 1.1) - from.y, cz = c.z - from.z;
      const t = clamp((cx * vx + cy * vy + cz * vz) / lenSq, 0, 1);
      const px = from.x + vx * t - c.x;
      const py = from.y + vy * t - (c.y + 1.1);
      const pz = from.z + vz * t - c.z;
      const r = c.radius * 0.92;
      if (px * px + py * py + pz * pz <= r * r) return true;
    }
    return false;
  }

  function addSlipZone({ id, x, y = 0, z, radius = 3.2, hx = null, hz = null, rot = 0, speedMul = 1.38, slipDrift = 0.88, sticky = false, isActive = null }) {
    slipZones.push({ id, x, y, z, radius, hx, hz, rot, speedMul, slipDrift, sticky, isActive });
  }

  function addTimedGate({ id, mesh, blocker, openY = -2.2, closedY = 0, duration = 6.5, startClosed = false }) {
    if (mesh) mesh.traverse((m) => { m.userData.keep = true; });
    const g = { id, mesh, blocker, openY, closedY, duration, closed: !!startClosed, timer: 0 };
    if (mesh) mesh.position.y = g.closed ? closedY : openY;
    if (blocker) blocker.disabled = !g.closed;
    gates.push(g);
    return g;
  }

  function triggerGate(id, dur = null) {
    const g = gates.find((it) => it.id === id);
    if (!g) return false;
    g.closed = true;
    g.timer = dur ?? g.duration;
    if (g.blocker) g.blocker.disabled = false;
    if (ctx.audio) playWorldMechAudio(ctx.audio, 'valve');
    return true;
  }

  function getSurfaceModifier(ch) {
    if (!ch || !slipZones.length) return null;
    const px = ch.position.x, pz = ch.position.z;
    const py = (ch.userData?.groundY || 0) + (ch.userData?.jy || 0);
    if ((ch.userData?.jy || 0) > 0.35) return null;
    let speedMul = 1;
    let slipDrift = 0;
    for (const s of slipZones) {
      if (s.isActive && !s.isActive()) continue;
      if (Math.abs(py - s.y) > 1.35) continue;
      let inside = false;
      if (s.hx && s.hz) {
        const dx = px - s.x, dz = pz - s.z;
        const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
        const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
        inside = Math.abs(lx) <= s.hx && Math.abs(lz) <= s.hz;
      } else {
        inside = Math.hypot(px - s.x, pz - s.z) <= s.radius;
      }
      if (inside) {
        speedMul *= s.speedMul;
        slipDrift = Math.max(slipDrift, s.slipDrift || 0);
      }
    }
    if (speedMul === 1 && slipDrift === 0) return null;
    return { speedMul, slipDrift };
  }

  function update(dt, elapsed = 0) {
    const safeDt = Math.min(dt || 0.016, 0.05);
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.remaining -= safeDt;
      if (c.remaining <= 0) {
        if (c.grp.parent) c.grp.parent.remove(c.grp);
        clouds.splice(i, 1);
        continue;
      }
      const lifeK = clamp(c.remaining / Math.min(1.2, c.duration), 0, 1);
      c.grp.scale.setScalar(0.85 + 0.18 * Math.sin(elapsed * 2.2) + (1 - lifeK) * 0.25);
      for (const p of c.puffs) {
        p.m.position.y = p.baseY + Math.sin(elapsed * 2.4 + p.phase) * 0.22;
      }
    }
    for (const g of gates) {
      if (g.closed && g.timer > 0) {
        g.timer -= safeDt;
        if (g.timer <= 0) {
          g.closed = false;
          if (g.blocker) g.blocker.disabled = true;
        }
      }
      if (g.mesh) {
        const ty = g.closed ? g.closedY : g.openY;
        g.mesh.position.y = lerp(g.mesh.position.y, ty, clamp(safeDt * 9, 0, 1));
      }
    }
  }

  function resetAll() {
    for (const c of clouds) {
      if (c.grp.parent) c.grp.parent.remove(c.grp);
    }
    clouds.length = 0;
    for (const g of gates) {
      g.closed = false;
      g.timer = 0;
      if (g.blocker) g.blocker.disabled = true;
      if (g.mesh) g.mesh.position.y = g.openY;
    }
  }

  return { addSteamCloud, clearSteamNearShot, breaksLineOfSight, addSlipZone, addTimedGate, triggerGate, getSurfaceModifier, update, resetAll, clouds, gates };
}

export function createPortalNetwork(THREE, ctx = {}) {
  const portals = [];
  let scrambleUntil = -1;

  function registerPortal({ id, x, y = 0, z, targetId, altTargetId = null, triggerR = 1.4, label = 'Warp Gate', color = 0x7ae0ff, group = null }) {
    if (group) group.traverse((m) => { m.userData.keep = true; });
    portals.push({ id, x, y, z, targetId, altTargetId, triggerR, label, color, group });
  }

  function triggerScramble(durationSec = 14) {
    scrambleUntil = performance.now() * 0.001 + durationSec;
    if (ctx.audio) playWorldMechAudio(ctx.audio, 'warp');
  }

  function isScrambled() {
    return performance.now() * 0.001 < scrambleUntil;
  }

  function tryTeleportChar(ch, portalId, G) {
    if (!ch || !ch.userData) return false;
    const now = performance.now() * 0.001;
    if (now < (ch.userData._portalCdUntil || 0)) return false;
    const src = portals.find((p) => p.id === portalId);
    if (!src) return false;
    const useAlt = isScrambled() && ch.userData.actor?.team === 'seekers' && src.altTargetId;
    const dstId = useAlt ? src.altTargetId : src.targetId;
    const dst = portals.find((p) => p.id === dstId) || portals[0];
    if (!dst || dst === src) return false;

    const u = ch.userData;
    if (ctx.splash) ctx.splash(ch.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 16, 2.2);
    ch.position.x = dst.x + 0.65;
    ch.position.z = dst.z + 0.65;
    u.groundY = dst.y;
    u.jy = 0.14;
    u.vy = 1.6;
    u._portalCdUntil = now + 2.6;
    if (ctx.splash) ctx.splash(new THREE.Vector3(dst.x, dst.y + 0.9, dst.z), 18, 2.5);
    if (ctx.audio) playWorldMechAudio(ctx.audio, 'warp');
    if (ch === G?.player && ctx.notify) {
      ctx.notify(useAlt ? `🌀 Scrambled Portal! Warped to ${dst.label}!` : `🌀 Warped through ${src.label} → ${dst.label}!`, 1700);
    }
    return true;
  }

  function update(dt, elapsed, G) {
    for (const p of portals) {
      if (p.group) p.group.rotation.y += (isScrambled() ? -2.2 : 0.9) * Math.min(dt || 0.016, 0.05);
    }
    const actors = ctx.getActors?.() || [];
    const now = performance.now() * 0.001;
    for (const ch of actors) {
      if (!ch || ch.userData?.actor?.eliminated || ch.userData?.specialMode || ch.userData?.rideRail || ch.userData?.ridePath) continue;
      if (now < (ch.userData._portalCdUntil || 0)) continue;
      const py = (ch.userData.groundY || 0) + (ch.userData.jy || 0);
      for (const p of portals) {
        if (Math.abs(py - p.y) > 1.35) continue;
        if (Math.hypot(ch.position.x - p.x, ch.position.z - p.z) <= p.triggerR) {
          tryTeleportChar(ch, p.id, G);
          break;
        }
      }
    }
  }

  function resetAll() {
    scrambleUntil = -1;
  }

  return { registerPortal, triggerScramble, isScrambled, tryTeleportChar, update, resetAll, portals };
}

export function createMovingTrackSystem(THREE) {
  const conveyors = [];
  const carriers = [];
  const deckPlatforms = [];

  function addConveyorSegment({ x0, z0, x1, z1, y = 0, width = 1.7, speed = 2.8, getDirSign = null }) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 1;
    conveyors.push({ x0, z0, x1, z1, ux: dx / len, uz: dz / len, len, y, halfW: width * 0.5, speed, getDirSign });
  }

  function addDeckPlatform({ posFn, hx = 1.8, hz = 3.2, heightY = 0.55, yawFn = null }) {
    deckPlatforms.push({ posFn, hx, hz, heightY, yawFn, cur: { x: 0, y: 0, z: 0, prevX: 0, prevZ: 0, yaw: 0 } });
  }

  function addCarrierProp(mesh, routeFn, elapsedOffset = 0) {
    if (mesh) mesh.traverse((m) => { m.userData.keep = true; });
    carriers.push({ mesh, routeFn, elapsedOffset });
  }

  function update(dt, elapsed) {
    const safeDt = Math.min(dt || 0.016, 0.05);
    for (const d of deckPlatforms) {
      const nxt = d.posFn(elapsed);
      d.cur.prevX = d.cur.x || nxt.x;
      d.cur.prevZ = d.cur.z || nxt.z;
      d.cur.x = nxt.x;
      d.cur.y = nxt.y;
      d.cur.z = nxt.z;
      d.cur.yaw = d.yawFn ? d.yawFn(elapsed) : (nxt.yaw || 0);
    }
    for (const c of carriers) {
      const p = c.routeFn(elapsed + c.elapsedOffset, safeDt);
      if (p && c.mesh) {
        c.mesh.position.set(p.x, p.y, p.z);
        if (typeof p.yaw === 'number') c.mesh.rotation.y = p.yaw;
      }
    }
  }

  function getPlatformGroundY(x, z, refY) {
    let bestY = null;
    for (const d of deckPlatforms) {
      const surfaceY = d.cur.y + d.heightY;
      if (typeof refY === 'number' && refY < surfaceY - 1.35) continue;
      const dx = x - d.cur.x, dz = z - d.cur.z;
      const c = Math.cos(-d.cur.yaw), s = Math.sin(-d.cur.yaw);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= d.hx + 0.15 && Math.abs(lz) <= d.hz + 0.15) {
        if (bestY === null || surfaceY > bestY) bestY = surfaceY;
      }
    }
    return bestY;
  }

  function applyMotion(ch, dt) {
    if (!ch || !ch.userData) return;
    const safeDt = Math.min(dt || 0.016, 0.05);
    const px = ch.position.x, pz = ch.position.z;
    const footY = (ch.userData.groundY || 0) + (ch.userData.jy || 0);

    for (const d of deckPlatforms) {
      const surfaceY = d.cur.y + d.heightY;
      if (Math.abs(footY - surfaceY) > 0.72) continue;
      const dx = px - d.cur.x, dz = pz - d.cur.z;
      const c = Math.cos(-d.cur.yaw), s = Math.sin(-d.cur.yaw);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= d.hx + 0.18 && Math.abs(lz) <= d.hz + 0.18) {
        ch.position.x += d.cur.x - d.cur.prevX;
        ch.position.z += d.cur.z - d.cur.prevZ;
        return;
      }
    }

    for (const cv of conveyors) {
      if (Math.abs(footY - cv.y) > 0.75) continue;
      const rx = px - cv.x0, rz = pz - cv.z0;
      const along = rx * cv.ux + rz * cv.uz;
      if (along < -0.2 || along > cv.len + 0.2) continue;
      const perp = Math.abs(-rx * cv.uz + rz * cv.ux);
      if (perp <= cv.halfW) {
        const dirSign = cv.getDirSign ? cv.getDirSign() : 1;
        ch.position.x += cv.ux * cv.speed * dirSign * safeDt;
        ch.position.z += cv.uz * cv.speed * dirSign * safeDt;
        return;
      }
    }
  }

  return { addConveyorSegment, addDeckPlatform, addCarrierProp, update, getPlatformGroundY, applyMotion, deckPlatforms, conveyors };
}

