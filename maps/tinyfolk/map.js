/* Hue & Seek — Map 5: Tinyfolk Secret Hollow (`maps/tinyfolk/map.js`)
 * 10cm-Tinyfolk Storybook conservatory world (an original tiny-folk world under the floorboards):
 *  - Level 0 (`y = 0.25m`): Underground Root & Mousehole Burrow Tunnels (`1.95m` below garden lawn) + Secret Burrow Pocket
 *  - Level 1 (`y = 2.20m`): Mossy Clover Garden, Dewdrop Stream, Trowel & Twig Bridges, Willow-Plate Plaza & Dandelion Favor Orb
 *  - Level 2 (`y = 5.60m`): Giant Wooden Potting Bench Terrace (reached via 11m Tilting 30cm Seesaw Ruler & Bouncy Amanitas)
 *  - Level 3 (`y = 8.40m`): High Conservatory Brick & Jam-Jar Shelf (reached via Bouncy Amanita Cap & Spring Clothespin Catapults)
 */
import {
  makeRng,
  paintedCanvasTex,
  brushStrokes,
  mergeStatic,
  createAnimatedWater,
  createSwayingBlades,
} from '../map_kit.js?v=2';
import {
  PROPS,
  PROP_ICONS,
  buildMapProps,
  buildTeacupHiderDisguise,
  buildFlowerpotHiderDisguise,
  buildBurrowAcornDisguise,
  buildBumblebee,
  buildDragonflyVariant,
  buildLadybug,
} from './props.js?v=v10';
import {
  createCreatureFleetController,
  createMovingTrackSystem,
} from '../world_interactives.js?v=v10';
import { SEEKER_DEFS, HIDER_DEF, buildMapSeeker, buildMapHider } from './characters.js?v=2';
import { BUILDING_DEFS, buildBuildings } from './buildings.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;
const PLAZA_R = 10.5;

// 4-Tier Macro Elevations (shifted up so underground burrows sit at y = 0.25m >= -0.5m for 100% water-shot support!)
export const Y_BURROW = 0.25;
export const Y_GARDEN = 2.20;
export const Y_BENCH = 5.60;
export const Y_SHELF = 8.40;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Stream centerline across +Z garden meadow (between Plaza z=0..10.5 and Burrow z=21.4..26.6)
const streamZAt = (x) => 14.5 + Math.sin(x * 0.11) * 1.15;

// Underground Root & Mousehole Burrow geometry (`z` centered at 24.0, two 3.6m-wide earthen ramps + Secret Pocket!)
const BURROW_Z = 24.0;
const BURROW_CHAMBER = { x0: -4.6, x1: 4.6, z0: 21.4, z1: 26.6 };
const BURROW_POCKET = { x0: -4.2, x1: 4.4, z0: 26.6, z1: 29.2 };
const BURROW_RAMP_W = { x0: -11.6, x1: -4.6, z0: 22.2, z1: 25.8 }; // width = 3.6m >= 3.2m
const BURROW_RAMP_E = { x0: 4.6, x1: 11.6, z0: 22.2, z1: 25.8 };   // width = 3.6m >= 3.2m

// Giant Wooden Potting Bench (`16.0m x 12.0m` in NE) & 11m Tilting 30cm Seesaw Ruler over Thread Spool
const BENCH_BOX = { x0: 5.5, x1: 21.5, z0: -21.0, z1: -9.0 };
const SEESAW_SPEC = {
  cx: 0.32,
  cy: 3.98,
  cz: -14.9,
  length: 11.0,
  halfL: 5.5,
  width: 3.4,
  halfW: 1.7,
  thick: 0.24,
  maxTilt: 0.34,
  restTilt: 0.24,
};

// High Conservatory Brick & Jam-Jar Shelf (`14.0m x 6.0m` overlooking Potting Bench & Garden)
const SHELF_BOX = { x0: 1.5, x1: 15.5, z0: -27.5, z1: -21.5 };

// 5 Enterable 2-Room Tinyfolk Treasure Homes (4 on Garden Floor `2.20m` + 1 elevated on Potting Bench `5.60m`!)
const HOME_LAYOUT = [
  { id: 'biscuit_tin_house', x: -18.6, z: -7.6, y: Y_GARDEN, rotY: 1.18 },
  { id: 'teacup_conservatory', x: -11.4, z: -18.8, y: Y_GARDEN, rotY: 0.56 },
  { id: 'oak_mushroom_lodge', x: 19.2, z: 4.8, y: Y_GARDEN, rotY: -1.78 },
  { id: 'sewing_watch_workshop', x: -18.4, z: 5.8, y: Y_GARDEN, rotY: 1.82 },
  { id: 'flowerpot_greenhouse', x: 15.6, z: -16.4, y: Y_BENCH, rotY: 0.0 },
];

const SHRINK_SCALE = 0.45;
const SHRINK_DURATION = 11.5;
const HONEY_DURATION = 10.0;
const PICKUP_RESPAWN = 18.0;
const FAVOR_RESPAWN = 18.0;
const FAVOR_CLOAK_MS = 7500;
const FAVOR_BEACON_SEC = 3.8;

// Live per-world state for Amanitas, Seesaw Ruler, Clothespin Catapults, Size-Shift Pantry, Favor Orb & Faucet
const WORLD_STATE = {
  G: null,
  elapsed: 0,
  simNowMs: 0,
  amanitaPads: [],
  clothespinCatapults: [],
  antTunnels: [],
  mechanisms: [],
  sugarCubes: [],
  honeyDrops: [],
  shrinkTimers: new Map(),
  honeyTimers: new Map(),
  mouseholes: [],
  seesaw: null,
  rulerMesh: null,
  favorOrb: null,
  favorBeacons: [],
  turret: null,
  creatures: null,
  tracks: null,
  tunnelCooldowns: null,
  catapultCooldowns: null,
  interactSpots: [],
  faucetDrops: [],
  faucetSurgeTimer: 0,
  faucetWheel: null,
  faucetJet: null,
  sprinklerGroup: null,
  rollingMarble: null,
  marbleAngle: 0,
  marbleBoostCooldown: 0,
  midEventFired: false,
  splashAlerts: 0,
};

function enforceZeroMetalness(root) {
  root.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    if (Array.isArray(m.material)) {
      m.material.forEach((mat) => { if (mat && 'metalness' in mat) mat.metalness = 0; });
    } else if ('metalness' in m.material) {
      m.material.metalness = 0;
    }
  });
  return root;
}

// ============================================================================
// Multi-Tier Height Sampler (`refY`-aware — zero ceiling snap, zero invisible walls!)
// ============================================================================
function sampleTinyfolkHeight(x, z, refY) {
  // 1. High Conservatory Brick & Jam-Jar Shelf (`y = 8.40m`)
  if (x >= SHELF_BOX.x0 && x <= SHELF_BOX.x1 && z >= SHELF_BOX.z0 && z <= SHELF_BOX.z1) {
    if (typeof refY !== 'number' || refY >= 7.65) return Y_SHELF;
  }

  // 2. Giant Wooden Potting Bench Terrace (`y = 5.60m`)
  if (x >= BENCH_BOX.x0 && x <= BENCH_BOX.x1 && z >= BENCH_BOX.z0 && z <= BENCH_BOX.z1) {
    if (typeof refY !== 'number' || refY >= 4.85) return Y_BENCH;
  }

  // 3. Giant 11m Physical Tilting 30cm Seesaw Ruler (`Y_GARDEN <-> Y_BENCH`)
  const ss = WORLD_STATE.seesaw;
  if (ss) {
    const dx = x - ss.cx;
    const dz = z - ss.cz;
    const maxSpanX = ss.halfL * Math.cos(ss.tilt);
    if (Math.abs(dx) <= maxSpanX + 0.14 && Math.abs(dz) <= ss.halfW + 0.10) {
      const deckY = Math.max(Y_GARDEN + 0.04, ss.cy + dx * Math.tan(ss.tilt));
      if (typeof refY !== 'number' || refY >= deckY - 1.35) {
        return deckY;
      }
    }
  }

  // 4. Underground Root & Mousehole Burrow Central Chamber + Secret Pocket (`y = 0.25m` beneath `2.20m` lawn!)
  // Normal jump from 0.25m peaks at 0.25 + 1.644 = 1.894m < 2.02m -> NEVER snaps through ceiling!
  if (
    (x >= BURROW_CHAMBER.x0 && x <= BURROW_CHAMBER.x1 && z >= BURROW_CHAMBER.z0 && z <= BURROW_CHAMBER.z1) ||
    (x >= BURROW_POCKET.x0 && x <= BURROW_POCKET.x1 && z >= BURROW_POCKET.z0 && z <= BURROW_POCKET.z1)
  ) {
    if (typeof refY === 'number' && refY < 2.02) return Y_BURROW;
    return Y_GARDEN;
  }

  // 4B. Moving Walnut-Shell Stream Ferries (`createMovingTrackSystem`)
  const trackGroundY = WORLD_STATE.tracks?.getPlatformGroundY(x, z, refY);
  if (trackGroundY !== null && trackGroundY !== undefined) return trackGroundY;

  // 5. West Earthen Burrow Ramp (`x: -11.6 -> -4.6`, `y: 2.20 -> 0.25m`, width = 3.6m)
  if (x >= BURROW_RAMP_W.x0 && x <= BURROW_RAMP_W.x1 && z >= BURROW_RAMP_W.z0 && z <= BURROW_RAMP_W.z1) {
    const t = clamp((x - BURROW_RAMP_W.x0) / (BURROW_RAMP_W.x1 - BURROW_RAMP_W.x0), 0, 1);
    return Y_GARDEN + t * (Y_BURROW - Y_GARDEN);
  }

  // 6. East Earthen Burrow Ramp (`x: +4.6 -> +11.6`, `y: 0.25 -> 2.20m`, width = 3.6m)
  if (x >= BURROW_RAMP_E.x0 && x <= BURROW_RAMP_E.x1 && z >= BURROW_RAMP_E.z0 && z <= BURROW_RAMP_E.z1) {
    const t = clamp((x - BURROW_RAMP_E.x0) / (BURROW_RAMP_E.x1 - BURROW_RAMP_E.x0), 0, 1);
    return Y_BURROW + t * (Y_GARDEN - Y_BURROW);
  }

  // 7. Walkable Bridges across the Dewdrop Stream (`trowelBridge` & `mossyTwigBridge`)
  if (Math.abs(x - 3.2) < 1.55 && z >= 11.2 && z <= 17.8) return Y_GARDEN + 0.08;
  if (Math.abs(x + 7.2) < 1.45 && z >= 11.6 && z <= 17.0) return Y_GARDEN + 0.08;

  return Y_GARDEN;
}

// ============================================================================
// Procedural Painted Ground, Willow Porcelain Plate & Burrow Earth Textures
// ============================================================================
function buildMossGroundTex(THREE) {
  return paintedCanvasTex(THREE, 'bw_moss_clover_ground_v2', 1024, (g, s, rng) => {
    g.fillStyle = '#5f983f';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 1400, ['#4d8233', '#6da849', '#7bb653', '#84bf59', '#45762d'], 8, 28, 0.42, 0.4, 3.14, 74);
    for (let i = 0; i < 45; i++) {
      const x = rng.jr(0, s), y = rng.jr(0, s), r = rng.jr(34, 92);
      const gr = g.createRadialGradient(x, y, 4, x, y, r);
      gr.addColorStop(0, 'rgba(182, 222, 104, 0.28)');
      gr.addColorStop(1, 'rgba(182, 222, 104, 0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (let i = 0; i < 240; i++) {
      const cx = rng.jr(8, s - 8), cy = rng.jr(8, s - 8);
      g.fillStyle = rng.rr() > 0.5 ? '#487d2e' : '#85c058';
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + i;
        g.beginPath(); g.arc(cx + Math.cos(a) * 4.5, cy + Math.sin(a) * 4.5, 3.8, 0, TAU); g.fill();
      }
    }
    for (let i = 0; i < 95; i++) {
      const dx = rng.jr(10, s - 10), dy = rng.jr(10, s - 10);
      g.fillStyle = '#fff9ea';
      g.beginPath(); g.arc(dx, dy, rng.jr(3.0, 5.2), 0, TAU); g.fill();
      g.fillStyle = '#f2be42';
      g.beginPath(); g.arc(dx, dy, 1.8, 0, TAU); g.fill();
    }
  }, 1, 1);
}

function buildBurrowEarthTex(THREE) {
  return paintedCanvasTex(THREE, 'bw_burrow_earth_v1', 512, (g, s, rng) => {
    g.fillStyle = '#6d4b2f';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 900, ['#5a3c24', '#7e5838', '#8a6442', '#4f341e', '#658a3b'], 6, 22, 0.38, 0.2, 3.14, 33);
    for (let i = 0; i < 55; i++) {
      g.fillStyle = i % 3 === 0 ? '#6ea644' : '#a88962';
      g.beginPath();
      g.arc(rng.jr(8, s - 8), rng.jr(8, s - 8), rng.jr(3, 9), 0, TAU);
      g.fill();
    }
  }, 3, 3);
}

function buildWillowPlateTex(THREE) {
  return paintedCanvasTex(THREE, 'bw_willow_plate_plaza_v2', 1024, (g, s, rng) => {
    const c = s / 2, R = s * 0.49;
    g.fillStyle = '#f7f2e6';
    g.fillRect(0, 0, s, s);
    const rad = g.createRadialGradient(c, c, R * 0.12, c, c, R);
    rad.addColorStop(0, '#fcf8ee');
    rad.addColorStop(0.76, '#f4ede0');
    rad.addColorStop(0.92, '#e6eef7');
    rad.addColorStop(1, '#2b5ca4');
    g.fillStyle = rad;
    g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();

    const ring = (rr, lw, col) => {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath(); g.arc(c, c, rr, 0, TAU); g.stroke();
    };
    ring(R * 0.965, 14, '#28569c');
    ring(R * 0.925, 4.5, '#4b79bd');
    ring(R * 0.805, 5.5, '#2f5fa6');
    ring(R * 0.782, 2.5, '#6a93cc');
    ring(R * 0.34, 4.0, '#3a6ab0');

    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      const rx = c + Math.cos(a) * (R * 0.875), ry = c + Math.sin(a) * (R * 0.875);
      g.fillStyle = i % 2 === 0 ? '#2b5ca4' : '#658fcb';
      g.beginPath(); g.arc(rx, ry, 10, 0, TAU); g.fill();
      g.fillStyle = '#f8f3e8';
      g.beginPath(); g.arc(rx, ry, 4, 0, TAU); g.fill();
    }

    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + 0.18;
      const bx = c + Math.cos(a) * (R * 0.56), by = c + Math.sin(a) * (R * 0.56);
      g.strokeStyle = '#3566ad';
      g.lineWidth = 4.2;
      g.beginPath();
      g.moveTo(c + Math.cos(a - 0.18) * R * 0.42, c + Math.sin(a - 0.18) * R * 0.42);
      g.quadraticCurveTo(bx, by, c + Math.cos(a + 0.2) * R * 0.72, c + Math.sin(a + 0.2) * R * 0.72);
      g.stroke();
      g.fillStyle = '#4c7cc0';
      for (const da of [-0.14, -0.04, 0.08, 0.17]) {
        const lx = c + Math.cos(a + da) * (R * 0.62), ly = c + Math.sin(a + da) * (R * 0.62);
        g.beginPath(); g.ellipse(lx, ly, 18, 7.5, a + da + 0.6, 0, TAU); g.fill();
      }
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * TAU + a;
        g.fillStyle = '#2d5da3';
        g.beginPath(); g.ellipse(bx + Math.cos(pa) * 18, by + Math.sin(pa) * 18, 13, 8, pa, 0, TAU); g.fill();
      }
      g.fillStyle = '#dce8f8';
      g.beginPath(); g.arc(bx, by, 7, 0, TAU); g.fill();
    }

    const crackAngles = [0.42, 1.55, 2.38, 3.65, 4.92, 5.75];
    for (const ca of crackAngles) {
      let x = c + Math.cos(ca) * R * 0.98, y = c + Math.sin(ca) * R * 0.98;
      g.strokeStyle = '#6c5838';
      g.lineWidth = 5.5;
      g.beginPath(); g.moveTo(x, y);
      for (let st = 0; st < 6; st++) {
        const rIn = R * (0.92 - st * 0.12);
        const jit = rng.jr(-0.08, 0.08);
        x = c + Math.cos(ca + jit) * rIn;
        y = c + Math.sin(ca + jit) * rIn;
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#6ca044';
      g.beginPath(); g.arc(c + Math.cos(ca) * R * 0.84, c + Math.sin(ca) * R * 0.84, 7, 0, TAU); g.fill();
    }
  });
}

// ============================================================================
// Giant Tinyfolk-Scale Botanicals, Conservatory Backdrop & Underground Burrow
// ============================================================================
function buildGiantClover(THREE, seed = 1, height = 5.2, fourLeaf = false) {
  const { jr } = makeRng(seed);
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x569439, roughness: 0.82, metalness: 0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x6ab446, roughness: 0.76, metalness: 0, side: THREE.DoubleSide });
  const dewMat = new THREE.MeshStandardMaterial({ color: 0xe6f9ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.80 });

  const bendX = jr(-0.55, 0.55), bendZ = jr(-0.55, 0.55);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bendX * 0.45, height * 0.42, bendZ * 0.45),
    new THREE.Vector3(bendX, height * 0.82, bendZ),
    new THREE.Vector3(bendX * 1.12, height, bendZ * 1.12),
  ]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.13, 8, false), stemMat);
  stem.castShadow = true; stem.receiveShadow = true;
  g.add(stem);

  const crown = new THREE.Group();
  crown.position.set(bendX * 1.12, height, bendZ * 1.12);
  crown.userData.keep = true;
  g.add(crown);

  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(0.85, 0.42, 1.32, 1.38, 0.56, 1.78);
  sh.bezierCurveTo(0.16, 1.96, 0, 1.58, 0, 1.46);
  sh.bezierCurveTo(0, 1.58, -0.16, 1.96, -0.56, 1.78);
  sh.bezierCurveTo(-1.32, 1.38, -0.85, 0.42, 0, 0);
  const leafGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
  leafGeo.rotateX(PI / 2);

  const nLeaves = fourLeaf ? 4 : 3;
  for (let i = 0; i < nLeaves; i++) {
    const lm = new THREE.Mesh(leafGeo, leafMat);
    lm.rotation.set(0.18, (i / nLeaves) * TAU + jr(-0.08, 0.08), 0);
    lm.scale.setScalar(jr(1.15, 1.38));
    lm.castShadow = true; lm.receiveShadow = true;
    crown.add(lm);
  }
  const dew = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), dewMat);
  dew.position.set(0.55, 0.14, 0.88);
  dew.scale.set(1, 0.72, 1);
  crown.add(dew);

  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: 0.42, d: 0.42 }];
  g.traverse((m) => { if (m.isMesh) m.userData.paint = m.material.color.clone(); });
  return { group: enforceZeroMetalness(g), crown };
}

function buildGiantDaisy(THREE, seed = 1, height = 4.6, violet = false) {
  const { jr } = makeRng(seed + 101);
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x528e38, roughness: 0.84, metalness: 0 });
  const petalMat = new THREE.MeshStandardMaterial({ color: violet ? 0x9b72dc : 0xfffaf0, roughness: 0.72, metalness: 0 });
  const discMat = new THREE.MeshStandardMaterial({ color: 0xf4bd38, roughness: 0.8, metalness: 0 });

  const bx = jr(-0.45, 0.45), bz = jr(-0.45, 0.45);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bx * 0.5, height * 0.5, bz * 0.5),
    new THREE.Vector3(bx, height, bz),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.1, 7, false), stemMat));

  const head = new THREE.Group();
  head.position.set(bx, height, bz);
  head.rotation.set(0.38, jr(0, TAU), 0);
  head.userData.keep = true;
  g.add(head);

  const disc = new THREE.Mesh(new THREE.SphereGeometry(violet ? 0.30 : 0.56, 12, 8), discMat);
  disc.scale.set(1, 0.48, 1);
  head.add(disc);

  const nPetals = violet ? 5 : 14;
  const pLen = violet ? 0.74 : 1.18, pWid = violet ? 0.44 : 0.29;
  const pGeo = new THREE.SphereGeometry(1, 8, 6);
  pGeo.scale(pWid, 0.045, pLen);
  for (let i = 0; i < nPetals; i++) {
    const a = (i / nPetals) * TAU;
    const pm = new THREE.Mesh(pGeo, petalMat);
    pm.position.set(Math.sin(a) * (pLen * 0.92), -0.04, Math.cos(a) * (pLen * 0.92));
    pm.rotation.set(0.12, a, 0);
    head.add(pm);
  }

  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: 0.36, d: 0.36 }];
  g.traverse((m) => { if (m.isMesh) m.userData.paint = m.material.color.clone(); });
  return { group: enforceZeroMetalness(g), crown: head };
}

function buildGiantFernCluster(THREE, seed = 1) {
  const { jr } = makeRng(seed + 303);
  const g = new THREE.Group();
  const fernMat = new THREE.MeshStandardMaterial({ color: 0x62a43e, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4c8732, roughness: 0.85, metalness: 0 });

  const pinnaGeo = new THREE.SphereGeometry(1, 6, 5);
  pinnaGeo.scale(0.14, 0.03, 0.52);

  for (let f = 0; f < 4; f++) {
    const ang = (f / 4) * TAU + jr(-0.25, 0.25);
    const H = jr(3.4, 4.8), out = jr(1.4, 2.2);
    const fg = new THREE.Group();
    fg.rotation.y = ang;
    g.add(fg);
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, H * 0.48, out * 0.38),
      new THREE.Vector3(0, H * 0.88, out * 0.86),
      new THREE.Vector3(0, H * 0.78, out * 1.05),
      new THREE.Vector3(0, H * 0.68, out * 0.92),
    ];
    const rachis = new THREE.CatmullRomCurve3(pts);
    fg.add(new THREE.Mesh(new THREE.TubeGeometry(rachis, 16, 0.08, 6, false), stemMat));
    for (let k = 2; k <= 11; k++) {
      const t = k / 13;
      const p = rachis.getPoint(t);
      const sc = (1 - t * 0.55) * 0.95;
      for (const sx of [-1, 1]) {
        const lf = new THREE.Mesh(pinnaGeo, fernMat);
        lf.position.set(sx * 0.38 * sc, p.y, p.z);
        lf.rotation.set(0.15, sx * 1.18, -sx * 0.22);
        lf.scale.setScalar(sc);
        fg.add(lf);
      }
    }
  }
  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: 0.65, d: 0.65 }];
  g.traverse((m) => { if (m.isMesh) m.userData.paint = m.material.color.clone(); });
  return enforceZeroMetalness(g);
}

function buildConservatoryGlassBackdrop(THREE) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xeff3e6, roughness: 0.58, metalness: 0 });
  const brickBaseMat = new THREE.MeshStandardMaterial({ color: 0xb96c4c, roughness: 0.88, metalness: 0 });
  const sunGlass = new THREE.MeshStandardMaterial({
    color: 0xfefae0, emissive: 0xffe9a6, emissiveIntensity: 0.52,
    roughness: 0.22, metalness: 0, transparent: true, opacity: 0.52, side: THREE.DoubleSide,
  });
  const R = 36.8, H = 16.5, span = 1.65;
  const cols = 16;
  for (let i = 0; i <= cols; i++) {
    const a = -span * 0.5 + (i / cols) * span;
    const x = Math.sin(a) * R, z = -Math.cos(a) * R;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, H, 0.32), frameMat);
    post.position.set(x, Y_GARDEN + H / 2 - 0.4, z);
    post.rotation.y = -a;
    g.add(post);
    if (i < cols) {
      const am = a + (span / cols) * 0.5;
      const wSeg = 2 * R * Math.sin((span / cols) * 0.5);
      const wallPlinth = new THREE.Mesh(new THREE.BoxGeometry(wSeg + 0.08, 2.2, 0.45), brickBaseMat);
      wallPlinth.position.set(Math.sin(am) * R, Y_GARDEN + 0.7, -Math.cos(am) * R);
      wallPlinth.rotation.y = -am;
      g.add(wallPlinth);

      const pane = new THREE.Mesh(new THREE.PlaneGeometry(wSeg - 0.18, H - 2.2), sunGlass);
      pane.position.set(Math.sin(am) * (R + 0.05), Y_GARDEN + 1.8 + (H - 2.2) / 2, -Math.cos(am) * (R + 0.05));
      pane.rotation.y = -am;
      g.add(pane);
      for (let row = 1; row <= 4; row++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(wSeg, 0.18, 0.24), frameMat);
        bar.position.set(Math.sin(am) * R, Y_GARDEN + 1.8 + row * ((H - 2.2) / 5), -Math.cos(am) * R);
        bar.rotation.y = -am;
        g.add(bar);
      }
    }
  }
  mergeStatic(THREE, g);
  return enforceZeroMetalness(g);
}

function buildMatchstickBench(THREE) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xba8248, roughness: 0.86, metalness: 0 });
  const tip = new THREE.MeshStandardMaterial({ color: 0xc84538, roughness: 0.75, metalness: 0 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 0.56), wood);
  seat.position.y = 0.46;
  g.add(seat);
  for (const [lx, lz] of [[-0.72, -0.2], [0.72, -0.2], [-0.72, 0.2], [0.72, 0.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.46, 8), wood);
    leg.position.set(lx, 0.23, lz);
    g.add(leg);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), tip);
    head.position.set(lx, 0.07, lz);
    g.add(head);
  }
  mergeStatic(THREE, g);
  // Explicit `y1: 0.51 <= 1.68` -> `standable: true`!
  g.userData.colliders = [{ x: 0, z: 0, w: 1.82, d: 0.62, y0: 0, y1: 0.51 }];
  g.traverse((m) => { if (m.isMesh) m.userData.paint = m.material.color.clone(); });
  return enforceZeroMetalness(g);
}

function buildButtonSteppingPerch(THREE, r = 0.82, h = 0.62, hex = 0xf2dfc0) {
  const g = new THREE.Group();
  const btnMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.70, metalness: 0 });
  const threadMat = new THREE.MeshStandardMaterial({ color: 0xc84545, roughness: 0.82, metalness: 0 });
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x8b5d36, roughness: 0.88, metalness: 0 });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.68, h - 0.10, 14), stalkMat);
  stalk.position.y = (h - 0.10) * 0.5;
  g.add(stalk);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 22), btnMat);
  disc.position.y = h - 0.06;
  g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.90, 0.05, 8, 22), btnMat);
  rim.rotation.x = PI / 2;
  rim.position.y = h;
  g.add(rim);
  for (const [hx, hz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 8), stalkMat);
    hole.position.set(hx, h, hz);
    g.add(hole);
  }
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.07), threadMat);
  st.position.set(0, h + 0.01, 0);
  st.rotation.y = PI / 4;
  g.add(st);

  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: r * 1.88, d: r * 1.88, y0: 0, y1: h + 0.02 }];
  g.traverse((m) => { if (m.isMesh) m.userData.paint = m.material.color.clone(); });
  return enforceZeroMetalness(g);
}

// ============================================================================
// Underground Root & Mousehole Burrow Builder (`y = 0.25m` beneath `y = 2.20m`!)
// ============================================================================
function buildUndergroundRootBurrow(THREE, earthTex) {
  const g = new THREE.Group();
  const earthMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: earthTex, roughness: 0.94, metalness: 0 });
  const darkEarth = new THREE.MeshStandardMaterial({ color: 0x563921, roughness: 0.95, metalness: 0 });
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x8b5d36, roughness: 0.86, metalness: 0 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x68a440, roughness: 0.90, metalness: 0 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb7ab96, roughness: 0.90, metalness: 0 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffe69c, emissive: 0xffa42e, emissiveIntensity: 1.85, roughness: 0.35, metalness: 0 });

  // 1. Central Burrow Floor (`x ∈ [-4.8, 4.8], z ∈ [21.2, 26.8], top at y = 0.25m`)
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.16, 5.8), earthMat);
  floorMesh.position.set(0, Y_BURROW - 0.08, BURROW_Z);
  floorMesh.receiveShadow = true;
  floorMesh.userData.ground = true;
  floorMesh.userData.keep = true;
  floorMesh.userData.paint = new THREE.Color(0x6d4b2f);
  g.add(floorMesh);

  // 2. West & East Wide Sloped Earthen/Moss Ramps (`width = 3.6m >= 3.2m`, climbing 0.25m <-> 2.20m!)
  const run = 7.0, rise = Y_GARDEN - Y_BURROW;
  const rLen = Math.hypot(run, rise), rAng = Math.atan2(rise, run);
  for (const side of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(rLen + 0.35, 0.16, 3.68), earthMat);
    ramp.position.set(side * 8.1, (Y_BURROW + Y_GARDEN) * 0.5 - 0.06, BURROW_Z);
    ramp.rotation.z = side < 0 ? -rAng : rAng;
    ramp.receiveShadow = true;
    ramp.userData.ground = true;
    ramp.userData.keep = true;
    ramp.userData.paint = new THREE.Color(0x6d4b2f);
    g.add(ramp);

    // Earthen trench retaining walls + mossy stone curb parapets along north & south edges of each ramp
    for (const sz of [-1, 1]) {
      const wallZ = BURROW_Z + sz * 1.92;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.35, 0.28), darkEarth);
      wall.position.set(side * 8.0, 1.25, wallZ);
      g.add(wall);
      for (let k = 0; k < 7; k++) {
        const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), k % 2 ? mossMat : stoneMat);
        st.position.set(side * (4.9 + k * 0.95), Y_GARDEN + 0.16, wallZ);
        st.scale.set(1.3, 0.72, 0.85);
        g.add(st);
      }
    }
  }

  // 3. Central Underground Chamber North & South Earth Walls + Secret Burrow Pocket (`y <= 2.15m`)
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.05, 0.32), darkEarth);
  wallN.position.set(0, 1.12, BURROW_CHAMBER.z0 - 0.12);
  g.add(wallN);
  // South partition wall split into West flank, Central Root Divider & East flank
  // leaving Mousehole #3 at x ∈ [-3.10, -1.25] and Open Root Arch at x ∈ [2.05, 3.85]!
  const wallSWest = new THREE.Mesh(new THREE.BoxGeometry(1.58, 2.05, 0.32), darkEarth);
  wallSWest.position.set(-3.88, 1.12, BURROW_CHAMBER.z1 + 0.04);
  g.add(wallSWest);
  const wallSMid = new THREE.Mesh(new THREE.BoxGeometry(3.30, 2.05, 0.34), darkEarth);
  wallSMid.position.set(0.40, 1.12, BURROW_CHAMBER.z1 + 0.04);
  g.add(wallSMid);
  const wallSEast = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.05, 0.32), darkEarth);
  wallSEast.position.set(4.25, 1.12, BURROW_CHAMBER.z1 + 0.04);
  g.add(wallSEast);

  // Open East Root Arch framing full-sized Seeker detour around Secret Burrow Pocket (`x = 2.95, z = 26.6`)
  const eastArch = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.16, 8, 16, PI), rootMat);
  eastArch.position.set(2.95, Y_BURROW + 0.90, BURROW_CHAMBER.z1 + 0.04);
  g.add(eastArch);

  const ceilUnder = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.12, 5.5), darkEarth);
  ceilUnder.position.set(0, Y_GARDEN - 0.10, BURROW_Z);
  g.add(ceilUnder);

  // Secret Burrow Root Pocket floor, walls & ceiling (`x ∈ [-4.2, 4.4], z ∈ [26.6, 29.2], y = 0.25m`)
  const pocketFloor = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.16, 2.85), earthMat);
  pocketFloor.position.set(0.1, Y_BURROW - 0.08, 27.95);
  pocketFloor.receiveShadow = true;
  pocketFloor.userData.ground = true;
  pocketFloor.userData.keep = true;
  pocketFloor.userData.paint = new THREE.Color(0x6d4b2f);
  g.add(pocketFloor);
  const pocketCeil = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.12, 2.8), darkEarth);
  pocketCeil.position.set(0.1, Y_GARDEN - 0.10, 27.95);
  g.add(pocketCeil);
  const pocketWallS = new THREE.Mesh(new THREE.BoxGeometry(9.0, 2.05, 0.32), darkEarth);
  pocketWallS.position.set(0.1, 1.12, BURROW_POCKET.z1 + 0.12);
  g.add(pocketWallS);
  const pocketWallW = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.05, 2.85), darkEarth);
  pocketWallW.position.set(BURROW_POCKET.x0 - 0.12, 1.12, 27.95);
  g.add(pocketWallW);
  const pocketWallE = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.05, 2.85), darkEarth);
  pocketWallE.position.set(BURROW_POCKET.x1 + 0.12, 1.12, 27.95);
  g.add(pocketWallE);

  // Overhead Gnarled Oak Root Arch spanning West & East Portal Mouths + Garden Bridge Crest!
  for (const px of [-4.6, 0.0, 4.6]) {
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(px, Y_BURROW + 0.2, BURROW_CHAMBER.z0 + 0.1),
      new THREE.Vector3(px, Y_GARDEN - 0.12, BURROW_Z - 1.4),
      new THREE.Vector3(px, Y_GARDEN - 0.08, BURROW_Z + 1.4),
      new THREE.Vector3(px, Y_BURROW + 0.2, BURROW_CHAMBER.z1 - 0.1),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(archCurve, 18, 0.22, 8, false), rootMat));
  }
  // Decorative low mossy roots framing the overhead garden lawn arch (low profile `y <= 2.28` so overhead walk is smooth)
  for (const sz of [-1, 1]) {
    const surfRoot = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.8, Y_GARDEN + 0.06, BURROW_Z + sz * 2.1),
      new THREE.Vector3(0, Y_GARDEN + 0.12, BURROW_Z + sz * 2.25),
      new THREE.Vector3(4.8, Y_GARDEN + 0.06, BURROW_Z + sz * 2.1),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(surfRoot, 16, 0.14, 7, false), rootMat));
  }

  // 4. Sculpted Underground Mouse-Hole Alcove against Central Divider (`(0.0, 0.25, 26.25)`) for Special Hiding Spot #3!
  const mouseArch = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.16, 8, 18, PI), rootMat);
  mouseArch.position.set(0, Y_BURROW + 0.85, BURROW_CHAMBER.z1 - 0.18);
  g.add(mouseArch);
  const nookMoss = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.08, 18), mossMat);
  nookMoss.position.set(0, Y_BURROW + 0.04, 25.55);
  g.add(nookMoss);

  // 5. Cozy Firefly-Acorn Lanterns illuminating the Underground Burrow, Ramps & Secret Pocket!
  const lanternCoords = [
    [-3.2, 1.72, 21.8], [3.2, 1.72, 21.8], [-2.2, 1.72, 26.1], [2.2, 1.72, 26.1],
    [-7.8, 1.55, 22.5], [7.8, 1.55, 22.5], [0.0, 1.78, 25.6],
    [-2.0, 1.72, 28.0], [2.4, 1.72, 28.0],
  ];
  for (const [lx, ly, lz] of lanternCoords) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glowMat);
    orb.position.set(lx, ly, lz);
    g.add(orb);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 6, 0, TAU, 0, PI * 0.52), rootMat);
    cap.position.set(lx, ly + 0.07, lz);
    g.add(cap);
  }

  mergeStatic(THREE, g);
  g.traverse((m) => {
    if (m.isMesh && !m.userData.paint) m.userData.paint = m.material.color.clone();
  });
  return enforceZeroMetalness(g);
}

// ============================================================================
// Overhead Conservatory Brass Watering Spigots (`y = 10.6m`, zero sightline bar!)
// ============================================================================
function buildOverheadFaucetPipe(THREE, zones) {
  const g = new THREE.Group();
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xe5b84b, roughness: 0.48, metalness: 0 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc97640, roughness: 0.55, metalness: 0 });

  // Compact antique brass 3-arm watering chandelier manifold high at y = 12.8m above the Shell Pond
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.45, 16), copperMat);
  hub.position.set(0, 13.2, 1.15);
  g.add(hub);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 12), brassMat);
  riser.position.set(0, 15.1, 1.15);
  g.add(riser);

  for (const z of zones) {
    const branchPts = [
      new THREE.Vector3(0, 13.15, 1.15),
      new THREE.Vector3(z.x * 0.65, 12.85, 1.15 + (z.z - 1.15) * 0.65),
      new THREE.Vector3(z.x, z.startY + 0.55, z.z),
      new THREE.Vector3(z.x, z.startY + 0.18, z.z),
    ];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branchPts), 16, 0.12, 10, false), brassMat));

    const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 16), copperMat);
    valveWheel.position.set(z.x, z.startY + 0.48, z.z + 0.16);
    g.add(valveWheel);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.22, 14), copperMat);
    collar.position.set(z.x, z.startY + 0.18, z.z);
    g.add(collar);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.048, 8, 16), brassMat);
    lip.rotation.x = PI / 2;
    lip.position.set(z.x, z.startY + 0.04, z.z);
    g.add(lip);
  }
  mergeStatic(THREE, g);
  g.userData.noCollide = true;
  return enforceZeroMetalness(g);
}

// ============================================================================
// Bespoke Tinyfolk Builders: Seesaw 30cm Ruler, Clothespin Catapults,
// Sugar Cubes, Golden Honey Drops, Dandelion Favor Orb & Golden Beacon Shafts
// ============================================================================
function buildSeesawRulerTex(THREE) {
  return paintedCanvasTex(THREE, 'bw_seesaw_30cm_ruler_v1', 1024, (g, s, rng) => {
    g.fillStyle = '#ebbd52';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 380, ['#dfae40', '#f4ca68', '#d49d34', '#c98e2c'], 16, 54, 0.26, 0, 0.06, 23);
    // Brass inlaid longitudinal borders
    g.fillStyle = '#e5b84b';
    g.fillRect(0, 0, s, 28);
    g.fillRect(0, s - 28, s, 28);
    // Central wooden fulcrum stripe & directional balance arrows
    g.fillStyle = 'rgba(130, 68, 30, 0.34)';
    g.fillRect(s * 0.492, 28, s * 0.016, s - 56);

    // Painted 0..30 cm metric graduation marks & serif numbers
    g.strokeStyle = '#3b2411';
    g.fillStyle = '#3b2411';
    g.font = 'bold 34px Georgia, serif';
    g.textAlign = 'center';
    for (let mm = 0; mm <= 60; mm++) {
      const px = (mm / 60) * (s - 36) + 18;
      const isCm = mm % 2 === 0;
      const isFive = mm % 10 === 0;
      const tickH = isFive ? 86 : (isCm ? 56 : 32);
      g.lineWidth = isFive ? 6 : 3;
      g.beginPath(); g.moveTo(px, 28); g.lineTo(px, 28 + tickH); g.stroke();
      g.beginPath(); g.moveTo(px, s - 28); g.lineTo(px, s - 28 - tickH); g.stroke();
      if (isFive && mm > 0 && mm < 60) {
        g.fillText(`${mm / 2}`, px, 148);
        g.fillText(`${mm / 2} cm`, px, s - 122);
      }
    }
    g.font = 'bold 40px Georgia, serif';
    g.fillStyle = '#6c3c18';
    g.fillText('30 cm SEESAW', s * 0.5, s * 0.5 + 14);
  });
}

function buildSeesawRulerAssembly(THREE, spec) {
  // 1. Rolling Thread Spool Fulcrum & Mossy Wooden Cradle underneath `(spec.cx, Y_GARDEN, spec.cz)`
  const baseGroup = new THREE.Group();
  baseGroup.position.set(spec.cx, Y_GARDEN, spec.cz);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9b683b, roughness: 0.84, metalness: 0 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b4322, roughness: 0.88, metalness: 0 });
  const threadMat = new THREE.MeshStandardMaterial({ color: 0xc94240, roughness: 0.78, metalness: 0 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xe5b84b, roughness: 0.46, metalness: 0 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x6ea842, roughness: 0.90, metalness: 0 });

  // Grounded cradle blocks & mossy base
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.44, 3.45), darkWoodMat);
  plinth.position.set(0, 0.22, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  baseGroup.add(plinth);
  for (const sx of [-0.62, 0.62]) {
    const chock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 3.35), woodMat);
    chock.position.set(sx, 0.52, 0);
    baseGroup.add(chock);
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mossMat);
    tuft.position.set(sx * 1.45, 0.14, sx * 1.1);
    tuft.scale.set(1.2, 0.52, 1.3);
    baseGroup.add(tuft);
  }

  // Rolling cylindrical thread spool centered at y = 0.96m (top rim at y = 1.54m -> world 3.74m under ruler!)
  const spoolGroup = new THREE.Group();
  spoolGroup.position.set(0, 0.96, 0);
  spoolGroup.userData.keep = true;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.86, 20), threadMat);
  barrel.rotation.x = PI / 2;
  barrel.castShadow = true;
  spoolGroup.add(barrel);
  for (const sz of [-1.46, 1.46]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.16, 20), woodMat);
    flange.rotation.x = PI / 2;
    flange.position.z = sz;
    flange.castShadow = true;
    spoolGroup.add(flange);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 12), brassMat);
    hub.rotation.x = PI / 2;
    hub.position.z = sz;
    spoolGroup.add(hub);
  }
  baseGroup.add(spoolGroup);
  baseGroup.traverse((m) => { if (m.isMesh) m.userData.keep = true; });

  // 2. Giant 11m Tilting 30cm Seesaw Ruler (`rulerMesh.rotation.z` tilts in `update(dt)`)
  const rulerMesh = new THREE.Group();
  rulerMesh.name = 'seesawRuler';
  rulerMesh.position.set(spec.cx, spec.cy, spec.cz);
  rulerMesh.rotation.z = spec.restTilt;
  rulerMesh.userData.keep = true;

  const rulerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: buildSeesawRulerTex(THREE),
    roughness: 0.66,
    metalness: 0,
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(spec.length, spec.thick, spec.width), rulerMat);
  deck.position.set(0, -spec.thick * 0.5, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.userData.ground = true;
  deck.userData.keep = true;
  deck.userData.paint = new THREE.Color(0xebbd52);
  rulerMesh.add(deck);

  // Brass end ferrules & tiny non-blocking traction cleats along plank
  for (const sx of [-1, 1]) {
    const ferrule = new THREE.Mesh(new THREE.BoxGeometry(0.24, spec.thick + 0.03, spec.width + 0.06), brassMat);
    ferrule.position.set(sx * (spec.halfL - 0.10), -spec.thick * 0.5, 0);
    ferrule.userData.keep = true;
    rulerMesh.add(ferrule);
  }
  for (let cx = -4.2; cx <= 4.2; cx += 1.4) {
    const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, spec.width * 0.82), darkWoodMat);
    cleat.position.set(cx, 0.01, 0);
    cleat.userData.keep = true;
    rulerMesh.add(cleat);
  }

  return {
    baseGroup: enforceZeroMetalness(baseGroup),
    spoolGroup,
    rulerMesh: enforceZeroMetalness(rulerMesh),
  };
}

function buildClothespinCatapult(THREE, yaw = 0) {
  const g = new THREE.Group();
  g.rotation.y = yaw;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xdca86a, roughness: 0.78, metalness: 0 });
  const baseWood = new THREE.MeshStandardMaterial({ color: 0x8b5d36, roughness: 0.86, metalness: 0 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xc2d0de, roughness: 0.44, metalness: 0 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xd9483e, emissive: 0x5c1410, emissiveIntensity: 0.18, roughness: 0.65, metalness: 0 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x6ea844, roughness: 0.90, metalness: 0 });

  // Grounded mossy anchor ring & lower wooden jaw
  const mossPad = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.32, 0.10, 18), mossMat);
  mossPad.position.y = 0.05;
  mossPad.userData.keep = true;
  g.add(mossPad);

  const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.18, 0.82), baseWood);
  lowerJaw.position.set(0, 0.18, 0);
  lowerJaw.castShadow = true;
  lowerJaw.userData.keep = true;
  g.add(lowerJaw);

  // Coiled spring fulcrum axle at x = -0.35
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 8, 16), steelMat);
  coil.position.set(-0.35, 0.42, 0);
  coil.userData.keep = true;
  g.add(coil);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.98, 10), steelMat);
  axle.rotation.x = PI / 2;
  axle.position.set(-0.35, 0.42, 0);
  axle.userData.keep = true;
  g.add(axle);

  // Spring-loaded upper clothespin catapult lever arm
  const armPivot = new THREE.Group();
  armPivot.position.set(-0.35, 0.42, 0);
  armPivot.userData.keep = true;
  g.add(armPivot);

  const lever = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.14, 0.78), woodMat);
  lever.position.set(0.55, 0.08, 0);
  lever.rotation.z = -0.10;
  lever.castShadow = true;
  lever.userData.keep = true;
  armPivot.add(lever);

  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.12, 16), padMat);
  cushion.position.set(1.22, 0.11, 0);
  cushion.userData.keep = true;
  armPivot.add(cushion);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 18), steelMat);
  ring.rotation.x = PI / 2;
  ring.position.set(1.22, 0.18, 0);
  ring.userData.keep = true;
  armPivot.add(ring);

  return { group: enforceZeroMetalness(g), armPivot };
}

function buildSugarCubePickup(THREE) {
  const g = new THREE.Group();
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xcbeeff,
    emissiveIntensity: 0.42,
    roughness: 0.25,
    metalness: 0,
  });
  const sparkleMat = new THREE.MeshBasicMaterial({
    color: 0xdff7ff,
    transparent: true,
    opacity: 0.85,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x99e8ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const padRing = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.72, 24), haloMat.clone());
  padRing.rotation.x = -PI / 2;
  padRing.position.y = 0.035;
  padRing.userData.keep = true;
  g.add(padRing);

  const hover = new THREE.Group();
  hover.position.y = 0.68;
  hover.userData.keep = true;
  g.add(hover);

  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), cubeMat);
  cube.rotation.set(0.42, 0.55, 0.24);
  cube.castShadow = true;
  cube.userData.keep = true;
  hover.add(cube);

  const crystals = [];
  const cryGeo = new THREE.OctahedronGeometry(0.10, 0);
  for (let i = 0; i < 4; i++) {
    const cr = new THREE.Mesh(cryGeo, sparkleMat);
    const a = (i / 4) * TAU;
    cr.position.set(Math.cos(a) * 0.48, Math.sin(i * 1.4) * 0.18, Math.sin(a) * 0.48);
    cr.userData.keep = true;
    hover.add(cr);
    crystals.push(cr);
  }

  return { group: enforceZeroMetalness(g), hover, padRing, crystals };
}

function buildHoneyDropPickup(THREE) {
  const g = new THREE.Group();
  const honeyMat = new THREE.MeshStandardMaterial({
    color: 0xffc63b,
    emissive: 0xff8f12,
    emissiveIntensity: 0.52,
    roughness: 0.12,
    metalness: 0,
    transparent: true,
    opacity: 0.90,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffcb45,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const speckMat = new THREE.MeshBasicMaterial({ color: 0xfff2a6 });

  const padRing = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.74, 24), haloMat.clone());
  padRing.rotation.x = -PI / 2;
  padRing.position.y = 0.035;
  padRing.userData.keep = true;
  g.add(padRing);

  const hover = new THREE.Group();
  hover.position.y = 0.72;
  hover.userData.keep = true;
  g.add(hover);

  const prof = [
    [0.0, -0.30], [0.24, -0.24], [0.34, -0.06], [0.28, 0.16], [0.14, 0.34], [0.0, 0.46],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const drop = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), honeyMat);
  drop.castShadow = true;
  drop.userData.keep = true;
  hover.add(drop);

  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.04, 6, 18),
    new THREE.MeshBasicMaterial({ color: 0xffe47a, transparent: true, opacity: 0.65 })
  );
  aura.rotation.x = PI / 2;
  aura.userData.keep = true;
  hover.add(aura);

  const specks = [];
  const spGeo = new THREE.SphereGeometry(0.075, 6, 5);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(spGeo, speckMat);
    sp.userData.keep = true;
    hover.add(sp);
    specks.push(sp);
  }

  return { group: enforceZeroMetalness(g), hover, padRing, specks, aura };
}

function buildDandelionFavorOrb(THREE) {
  const g = new THREE.Group();
  g.userData.keep = true;
  g.userData.noCollide = true;

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff49e });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), coreMat);
  core.userData.keep = true;
  g.add(core);

  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xffcc42,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), auraMat);
  aura.userData.keep = true;
  g.add(aura);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x9cf7dc,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 24), ringMat);
  ringA.userData.keep = true;
  g.add(ringA);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.035, 8, 22), ringMat);
  ringB.rotation.x = PI / 2;
  ringB.userData.keep = true;
  g.add(ringB);

  const tuftGeo = new THREE.OctahedronGeometry(0.08, 0);
  const tuftMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tufts = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(tuftGeo, tuftMat);
    t.userData.keep = true;
    g.add(t);
    tufts.push(t);
  }

  // Faint golden landing indicator ring on Willow Plate while orb is gliding or recharging
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.85, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd65a,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  groundRing.rotation.x = -PI / 2;
  groundRing.userData.keep = true;

  return { group: g, aura, ringA, ringB, tufts, groundRing };
}

function buildGoldenBeaconShaft(THREE) {
  const grp = new THREE.Group();
  grp.userData.keep = true;
  grp.userData.noCollide = true;

  const innerGeo = new THREE.CylinderGeometry(0.16, 0.36, 14.0, 14, 1, true);
  innerGeo.translate(0, 7.0, 0);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffe885,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerBeam = new THREE.Mesh(innerGeo, innerMat);
  innerBeam.userData.keep = true;
  grp.add(innerBeam);

  const outerGeo = new THREE.CylinderGeometry(0.46, 0.94, 14.0, 14, 1, true);
  outerGeo.translate(0, 7.0, 0);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xffb32b,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outerBeam = new THREE.Mesh(outerGeo, outerMat);
  outerBeam.userData.keep = true;
  grp.add(outerBeam);

  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.96, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffd24c,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  baseRing.rotation.x = -PI / 2;
  baseRing.position.y = 0.06;
  baseRing.userData.keep = true;
  grp.add(baseRing);

  grp.visible = false;
  return { group: grp, innerMat, outerMat, baseRing };
}

// ============================================================================
// MAP_DEF Export
// ============================================================================
export const MAP_DEF = {
  id: 'tinyfolk',
  title: "Tinyfolk Secret Hollow",
  subtitle: 'Underground root burrows, willow-plate plaza, giant potting bench & bouncy Amanita caps',
  badge: 'Secret Hollow',
  preview: 'assets/maps/tinyfolk/overview.webp',
  skyPanorama: 'assets/maps/tinyfolk/sky_panorama.webp',
  mapRadius: 34,
  playerSpawn: [-3.0, 6.0],
  seekSpawn: [-2.0, -5.0],
  seekerSpawns: [[-2.2, -2.4], [2.2, -2.4]],
  hideIntroHint: '🍄 Tinyfolk Hollow! Eat Sugar Cubes 🧊 (`0.45×`) to slip through Mouseholes 🐭, tip the 30cm Seesaw Ruler 📏, launch off Clothespin Catapults 📎 & catch the Dandelion Favor Orb 🌼!',
  wildFlyerHint: '🐝 Wild miniature Bumblebee or Jewel Dragonfly! Watch carefully for hovering Tinyfolk disguised above the clover!',
  getInteractHint(mode) {
    if (mode === 'seek') {
      return '🌼 Catch the Dandelion Favor Orb to reveal Hiders with Golden Beacons, ride the Seesaw Ruler & Amanitas, or grab Sugar Cubes 🧊 to squeeze Mouseholes!';
    }
    return '🧊 Eat Sugar Cubes to shrink through Mouseholes 🐭, sip Golden Honey Drops 🍯, catch the Favor Orb 🌼 for Phantom Camo, or crank Faucet Surge 🚰!';
  },
  getTurret() {
    return null;
  },
  camMenu: { r: 24.2, y: 17.8, lookX: 0.5, lookY: 3.2, lookZ: -1.5, baseAngle: 0.10, sway: 0.24 },
  sky: {
    top: 0x3b92de,
    mid: 0x9be0f5,
    bot: 0xe9f7c8,
    sunDisc: 0xfff2ba,
    sunDir: [-0.32, 0.44, -0.84],
  },
  fog: { color: 0xd8f0ba, near: 46, far: 128 },
  lights: {
    hemiSky: 0xa4dcff,
    hemiGround: 0x4e7c38,
    hemiInt: 1.00,
    sunColor: 0xffdc96,
    sunInt: 2.05,
    sunPos: [-15, 28, -22],
    exposure: 0.92,
  },
  props: PROPS,
  propIcons: PROP_ICONS,
  buildings: BUILDING_DEFS,
  seekerKinds: SEEKER_DEFS.map((s) => s.id),
  seekerLabels: Object.fromEntries(SEEKER_DEFS.map((s) => [s.id, s.label])),
  hiderSkin: HIDER_DEF,
  buildProps: buildMapProps,
  buildSeeker: buildMapSeeker,
  buildHider: buildMapHider,

  groundHeightAt: sampleTinyfolkHeight,
  sampleHeight: sampleTinyfolkHeight,

  isDeepWater() {
    return false;
  },

  // Multi-Tier AI Waypoint Router across Underground Burrow (`0.25m`), Garden (`2.20m`), Bench (`5.60m`) & Shelf (`8.40m`)
  routeTierWaypoint(from, goal) {
    if (!from || !goal) return null;
    const fy = typeof from.y === 'number' ? from.y : sampleTinyfolkHeight(from.x, from.z);
    const gy = typeof goal.y === 'number' ? goal.y : sampleTinyfolkHeight(goal.x, goal.z);

    // Underground Burrow (`0.25m`) -> Garden / Upper Tiers (`>= 1.8m`)
    if (fy < 1.35 && gy >= 1.75) {
      const east = from.x > 0 || (Math.abs(from.x) < 1.5 && goal.x > 0);
      const exitX = east ? 12.4 : -12.4;
      if (Math.abs(from.x) < 4.4) {
        return { x: east ? 5.2 : -5.2, y: Y_BURROW + 0.15, z: BURROW_Z };
      }
      if (Math.hypot(from.x - exitX, from.z - BURROW_Z) > 1.2) {
        return { x: exitX, y: Y_GARDEN, z: BURROW_Z };
      }
    }

    // Garden / Upper Tiers (`>= 1.8m`) -> Underground Burrow (`0.25m`)
    if (fy >= 1.75 && gy < 1.35) {
      if (fy >= 4.5) {
        if (Math.hypot(from.x - 6.0, from.z + 14.9) > 1.3) return { x: 6.0, y: Y_BENCH, z: -14.9 };
        return { x: -5.4, y: Y_GARDEN, z: -14.9 };
      }
      const east = from.x > 0;
      const mouthX = east ? 12.2 : -12.2;
      if (Math.abs(from.z - BURROW_Z) > 1.6 || (east ? from.x < 11.4 : from.x > -11.4)) {
        return { x: mouthX, y: Y_GARDEN, z: BURROW_Z };
      }
      return { x: 0.0, y: Y_BURROW, z: BURROW_Z };
    }

    // High Shelf (`8.40m`) -> Lower Tiers via Bench drop
    if (fy >= 7.5 && gy < 7.5) {
      return { x: 8.5, y: Y_BENCH, z: -20.2 };
    }

    // Garden / Bench -> High Shelf (`8.40m`) via Clothespin Catapult or Bench Amanita
    if (fy < 7.5 && gy >= 7.5) {
      if (fy >= 4.5) return { x: 8.4, y: Y_BENCH, z: -18.8 };
      const useEast = from.x > 7.0;
      return useEast
        ? { x: 18.2, y: Y_GARDEN, z: -23.4 }
        : { x: -4.0, y: Y_GARDEN, z: -21.0 };
    }

    // Garden (`2.20m`) -> Giant Wooden Potting Bench (`5.60m`) via 11m Seesaw Ruler
    if (fy < 4.5 && gy >= 4.8 && gy < 7.5) {
      const inSeesaw = from.x >= -5.8 && from.x <= 5.9 && Math.abs(from.z + 14.9) <= 1.75;
      if (!inSeesaw) return { x: -5.4, y: Y_GARDEN, z: -14.9 };
      return { x: 6.4, y: Y_BENCH, z: -14.9 };
    }

    // Giant Wooden Potting Bench (`5.60m`) -> Garden (`2.20m`) via 11m Seesaw Ruler
    if (fy >= 4.8 && fy < 7.5 && gy < 4.5) {
      const inSeesaw = from.x <= 6.0 && Math.abs(from.z + 14.9) <= 1.75;
      if (!inSeesaw) return { x: 6.2, y: Y_BENCH, z: -14.9 };
      return { x: -5.6, y: Y_GARDEN, z: -14.9 };
    }

    return null;
  },

  // 5 Bouncy Red Amanita Mushroom Caps (`vy: 11.8`), 2 Clothespin Catapults (`rideSpot` -> Y_SHELF) & Ant-Tunnels
  sampleLauncherAt(player, G) {
    if (G) WORLD_STATE.G = G;
    if (!player || !player.userData) return null;
    const u = player.userData;
    if (u.specialMode || u.inTurret || u.ridePath || u.rideRail) return null;
    const footY = (u.groundY ?? player.position.y) + (u.jy || 0);
    if ((u.vy || 0) <= 2.5) {
      for (let i = 0; i < WORLD_STATE.amanitaPads.length; i++) {
        const pad = WORLD_STATE.amanitaPads[i];
        const d = Math.hypot(player.position.x - pad.x, player.position.z - pad.z);
        if (d <= pad.r && Math.abs(footY - pad.y) <= 1.08) {
          pad.squash = 1.0;
          return {
            vy: 11.8,
            glide: true,
            hintMsg: '🍄 Boing! Bounced off a giant Amanita cap — hold WASD to clover-glide!',
          };
        }
      }
    }
    const simT = WORLD_STATE.elapsed;
    const lastCat = WORLD_STATE.catapultCooldowns ? (WORLD_STATE.catapultCooldowns.get(player) ?? -99) : -99;
    if (simT - lastCat >= 2.2) {
      for (let i = 0; i < WORLD_STATE.clothespinCatapults.length; i++) {
        const cat = WORLD_STATE.clothespinCatapults[i];
        const d = Math.hypot(player.position.x - cat.x, player.position.z - cat.z);
        if (d <= 1.32 && Math.abs(footY - cat.y) <= 1.05) {
          WORLD_STATE.catapultCooldowns?.set(player, simT);
          cat.springAnim = 1.0;
          return {
            rideSpot: {
              fromX: cat.x,
              fromY: cat.y + 0.18,
              fromZ: cat.z,
              toX: cat.toX,
              toY: cat.toY,
              toZ: cat.toZ,
              dur: cat.dur,
              arcY: cat.arcY,
            },
            hintMsg: '📎 TWANG! Spring Clothespin Catapult launched you onto the High Conservatory Shelf!',
          };
        }
      }
    }
    const lastAnt = WORLD_STATE.tunnelCooldowns ? (WORLD_STATE.tunnelCooldowns.get(player) ?? -99) : -99;
    if (simT - lastAnt >= 2.2) {
      for (let i = 0; i < WORLD_STATE.antTunnels.length; i++) {
        const ant = WORLD_STATE.antTunnels[i];
        const d = Math.hypot(player.position.x - ant.fromX, player.position.z - ant.fromZ);
        if (d <= 1.15 && Math.abs(footY - ant.fromY) <= 0.95) {
          WORLD_STATE.tunnelCooldowns?.set(player, simT);
          return {
            rideSpot: {
              fromX: ant.fromX,
              fromY: ant.fromY,
              fromZ: ant.fromZ,
              toX: ant.toX,
              toY: ant.toY,
              toZ: ant.toZ,
              dur: ant.dur,
              arcY: ant.arcY,
            },
            hintMsg: ant.enterHint,
          };
        }
      }
    }
    return null;
  },

  getInteractSpots() {
    return WORLD_STATE.interactSpots;
  },

  getDebugState() {
    return WORLD_STATE;
  },

  breaksLineOfSight() {
    return false;
  },

  getSurfaceModifier(ch, G) {
    if (G) WORLD_STATE.G = G;
    if (!ch || !ch.userData) return null;
    let speedMul = 1;
    let jumpMul = 1;
    const honey = WORLD_STATE.honeyTimers?.get(ch);
    if (honey && honey.remaining > 0) {
      speedMul *= 1.32;
      jumpMul *= 1.30;
    }
    const nowMs = WORLD_STATE.simNowMs || performance.now();
    if (ch.userData._windCloakUntil && nowMs < ch.userData._windCloakUntil) {
      speedMul *= 1.22;
    }
    if (speedMul === 1 && jumpMul === 1) return null;
    return { speedMul, jumpMul, slipDrift: 0 };
  },

  applyPlatformMotion(c, dt) {
    if (WORLD_STATE.tracks) WORLD_STATE.tracks.applyMotion(c, dt);
    const ss = WORLD_STATE.seesaw;
    if (ss && c && c.userData && Math.abs(ss.tilt) > 0.16 && WORLD_STATE.moveChar) {
      const dx = c.position.x - ss.cx;
      const dz = c.position.z - ss.cz;
      const maxSpanX = ss.halfL * Math.cos(ss.tilt);
      if (Math.abs(dx) <= maxSpanX && Math.abs(dz) <= ss.halfW) {
        const deckY = Math.max(Y_GARDEN + 0.04, ss.cy + dx * Math.tan(ss.tilt));
        const footY = (c.userData.groundY ?? c.position.y) + (c.userData.jy || 0);
        if (Math.abs(footY - deckY) <= 0.48 && (c.userData.jy || 0) < 0.20) {
          const safeDt = Math.min(dt || 0.016, 0.05);
          WORLD_STATE.moveChar(c, -Math.sin(ss.tilt) * 1.55 * safeDt, 0);
        }
      }
    }
  },

  onShotWorldImpact() {
    return null;
  },

  onResetRound() {
    WORLD_STATE.faucetSurgeTimer = 0;
    WORLD_STATE.midEventFired = false;
    WORLD_STATE.marbleAngle = 0;
    WORLD_STATE.marbleBoostCooldown = 0;
    WORLD_STATE.splashAlerts = 0;

    // Restore shrink & cloak state across tracked and active actors
    if (WORLD_STATE.shrinkTimers) {
      for (const ch of WORLD_STATE.shrinkTimers.keys()) {
        if (ch?.userData) {
          ch.userData.shrink = 1;
          ch.userData.colliderScale = 1;
        }
      }
      WORLD_STATE.shrinkTimers.clear();
    }
    if (WORLD_STATE.honeyTimers) WORLD_STATE.honeyTimers.clear();
    const g = WORLD_STATE.G;
    if (g) {
      for (const ch of [g.player, ...(g.hiders || []), ...(g.seekers || []), ...(g.allHiders || []), ...(g.allSeekers || [])]) {
        if (ch?.userData) {
          ch.userData.shrink = 1;
          ch.userData.colliderScale = 1;
          ch.userData._windCloakUntil = 0;
        }
      }
    }

    for (const sc of WORLD_STATE.sugarCubes) {
      sc.cooldown = 0;
      if (sc.mesh) sc.mesh.visible = true;
      if (sc.padRing) sc.padRing.material.opacity = 0.55;
    }
    for (const hd of WORLD_STATE.honeyDrops) {
      hd.cooldown = 0;
      if (hd.mesh) hd.mesh.visible = true;
      if (hd.padRing) hd.padRing.material.opacity = 0.55;
    }

    if (WORLD_STATE.seesaw) {
      WORLD_STATE.seesaw.tilt = WORLD_STATE.seesaw.restTilt;
      WORLD_STATE.seesaw.vel = 0;
      if (WORLD_STATE.seesaw.mesh) WORLD_STATE.seesaw.mesh.rotation.z = WORLD_STATE.seesaw.tilt;
      if (WORLD_STATE.seesaw.spool) WORLD_STATE.seesaw.spool.rotation.z = 0;
    }

    for (const pad of WORLD_STATE.amanitaPads) {
      pad.squash = 0;
      if (pad.capGroup) {
        pad.capGroup.scale.set(1, 1, 1);
        pad.capGroup.position.y = 0.48;
      }
    }
    for (const cat of WORLD_STATE.clothespinCatapults) {
      cat.springAnim = 0;
      if (cat.armPivot) cat.armPivot.rotation.z = 0;
    }
    WORLD_STATE.tunnelCooldowns = new WeakMap();
    WORLD_STATE.catapultCooldowns = new WeakMap();

    if (WORLD_STATE.favorOrb) {
      WORLD_STATE.favorOrb.cooldown = 0;
      WORLD_STATE.favorOrb.active = true;
      WORLD_STATE.favorOrb.phase = 0;
      if (WORLD_STATE.favorOrb.group) WORLD_STATE.favorOrb.group.visible = true;
      if (WORLD_STATE.favorOrb.groundRing) WORLD_STATE.favorOrb.groundRing.visible = true;
    }
    for (const b of WORLD_STATE.favorBeacons) {
      b.remaining = 0;
      b.target = null;
      if (b.group) b.group.visible = false;
    }

    for (const m of WORLD_STATE.mechanisms) {
      m.lastTriggered = -99;
    }
    if (WORLD_STATE.faucetJet) WORLD_STATE.faucetJet.visible = false;
    if (WORLD_STATE.sprinklerGroup) WORLD_STATE.sprinklerGroup.visible = false;
    if (WORLD_STATE.rollingMarble) WORLD_STATE.rollingMarble.visible = false;
    if (WORLD_STATE._soapFoamDisc) WORLD_STATE._soapFoamDisc.visible = false;
  },

  triggerMechanism(ch, spot, G) {
    if (G) WORLD_STATE.G = G;
    if (!spot) return null;
    const nowT = WORLD_STATE.elapsed;
    if (spot.id === 'bw_faucet_valve') {
      if (nowT - (spot.lastTriggered ?? -99) < 8.0) {
        return '🚰 Faucet Surge already bubbling — hold on!';
      }
      spot.lastTriggered = nowT;
      WORLD_STATE.faucetSurgeTimer = 14.0;
      if (WORLD_STATE._triggerFaucetFx) WORLD_STATE._triggerFaucetFx();
      return '🚰 Faucet Surge! Dewdrop Stream current REVERSED & fountains surging for 14s!';
    }
    if (spot.mechType === 'sugar_cube' && WORLD_STATE._collectSugar) {
      return WORLD_STATE._collectSugar(ch, spot) || '🧊 Crystal Sugar Cube recharging...';
    }
    if (spot.mechType === 'honey_drop' && WORLD_STATE._collectHoney) {
      return WORLD_STATE._collectHoney(ch, spot) || '🍯 Golden Honey Drop refilling...';
    }
    return null;
  },

  getNearbyInteraction(player, G) {
    if (G) WORLD_STATE.G = G;
    if (!player || !player.userData) return null;
    const u = player.userData;
    if (u.specialMode && u.specialSpot) {
      return {
        ...u.specialSpot,
        kind: u.specialMode,
        icon: '↩️',
        label: 'Hop Out (G)',
      };
    }
    const footY = (u.groundY ?? player.position.y) + (u.jy || 0);
    // 1. Sugar Cubes & Golden Honey Drops (collectible via touch OR `[G]`)
    for (let i = 0; i < WORLD_STATE.sugarCubes.length; i++) {
      const sc = WORLD_STATE.sugarCubes[i];
      if (sc.cooldown > 0) continue;
      if (
        Math.abs(footY - sc.y) <= 1.45 &&
        Math.hypot(player.position.x - sc.x, player.position.z - sc.z) <= (sc.interactRadius || 2.25)
      ) {
        return sc;
      }
    }
    for (let i = 0; i < WORLD_STATE.honeyDrops.length; i++) {
      const hd = WORLD_STATE.honeyDrops[i];
      if (hd.cooldown > 0) continue;
      if (
        Math.abs(footY - hd.y) <= 1.45 &&
        Math.hypot(player.position.x - hd.x, player.position.z - hd.z) <= (hd.interactRadius || 2.25)
      ) {
        return hd;
      }
    }
    // 2. Interactive Brass Faucet Valve (`kind: 'mechanism'`)
    for (let i = 0; i < WORLD_STATE.mechanisms.length; i++) {
      const m = WORLD_STATE.mechanisms[i];
      if (
        Math.abs(footY - m.y) <= 1.45 &&
        Math.hypot(player.position.x - m.x, player.position.z - m.z) <= (m.interactRadius || 2.75)
      ) {
        return m;
      }
    }
    // 3. Sculpted Underground Ant-Tunnel Network (`kind: 'ride_path'` — Hide & Seek!)
    if (!u.ridePath) {
      for (let i = 0; i < WORLD_STATE.antTunnels.length; i++) {
        const ant = WORLD_STATE.antTunnels[i];
        if (
          Math.abs(footY - ant.fromY) <= 1.35 &&
          Math.hypot(player.position.x - ant.fromX, player.position.z - ant.fromZ) <= 2.35
        ) {
          return ant;
        }
      }
    }
    // 4. Giant Teacups, Flowerpots, Clothespins & Mousehole Nooks
    let best = null, bestD = Infinity;
    for (const sp of WORLD_STATE.interactSpots) {
      if (sp.occupiedBy && sp.occupiedBy !== player) continue;
      if (Math.abs(footY - sp.groundY) > 1.35) continue;
      const d = Math.hypot(player.position.x - sp.x, player.position.z - sp.z);
      const maxR = sp.interactRadius || 2.85;
      if (d <= maxR && d < bestD) {
        best = sp;
        bestD = d;
      }
    }
    return best;
  },

  buildCustomSpotDisguise(THREE, spot) {
    if (spot && spot.spotType === 'flowerpot') return buildFlowerpotHiderDisguise(THREE);
    if (spot && spot.spotType === 'burrow') return buildBurrowAcornDisguise(THREE);
    return buildTeacupHiderDisguise(THREE);
  },

  groundColorAt(x, z, outColor) {
    const setHex = (hex) => {
      if (outColor && outColor.setHex) return outColor.setHex(hex);
      const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
      return { r, g, b, isColor: true, getHex: () => hex };
    };
    if (x >= SHELF_BOX.x0 && x <= SHELF_BOX.x1 && z >= SHELF_BOX.z0 && z <= SHELF_BOX.z1) return setHex(0xc48e54);
    if (x >= BENCH_BOX.x0 && x <= BENCH_BOX.x1 && z >= BENCH_BOX.z0 && z <= BENCH_BOX.z1) return setHex(0xc9965c);
    if (Math.abs(x - SEESAW_SPEC.cx) <= SEESAW_SPEC.halfL && Math.abs(z - SEESAW_SPEC.cz) <= SEESAW_SPEC.halfW) return setHex(0xebbd52);
    if (Math.hypot(x - 3.2, z - 14.5) < 3.4) return setHex(0xb8c8d8);
    if (Math.hypot(x + 7.2, z - 14.3) < 3.0) return setHex(0xc49058);
    const r = Math.hypot(x, z);
    if (r <= PLAZA_R) return setHex(r > 8.6 ? 0x6e8fc2 : 0xf1ece0);
    if (Math.abs(z - streamZAt(x)) < 1.55) return setHex(0x49adc2);
    const dapple = Math.sin(x * 0.28) * Math.cos(z * 0.26);
    return setHex(dapple > 0.25 ? 0x79b350 : 0x619940);
  },

  surfaceAt(x, z) {
    if (x >= BENCH_BOX.x0 && x <= BENCH_BOX.x1 && z >= BENCH_BOX.z0 && z <= BENCH_BOX.z1) return 'wood';
    if (Math.abs(x - SEESAW_SPEC.cx) <= SEESAW_SPEC.halfL && Math.abs(z - SEESAW_SPEC.cz) <= SEESAW_SPEC.halfW) return 'wood';
    if (Math.hypot(x - 3.2, z - 14.5) < 3.4) return 'stone';
    if (Math.hypot(x, z) <= PLAZA_R) return 'stone';
    if (Math.abs(z - streamZAt(x)) < 1.85) return 'stone';
    return 'grass';
  },

  buildWorld(ctx) {
    const { THREE, root } = ctx;
    const rng = makeRng(505);
    const B = buildBuildings(THREE);

    WORLD_STATE.G = ctx.getG ? ctx.getG() : null;
    WORLD_STATE.amanitaPads = [];
    WORLD_STATE.clothespinCatapults = [];
    WORLD_STATE.antTunnels = [];
    WORLD_STATE.mechanisms = [];
    WORLD_STATE.sugarCubes = [];
    WORLD_STATE.honeyDrops = [];
    WORLD_STATE.shrinkTimers = new Map();
    WORLD_STATE.honeyTimers = new Map();
    WORLD_STATE.mouseholes = [];
    WORLD_STATE.seesaw = null;
    WORLD_STATE.rulerMesh = null;
    WORLD_STATE.favorOrb = null;
    WORLD_STATE.favorBeacons = [];
    WORLD_STATE.turret = null;
    if (WORLD_STATE.creatures && WORLD_STATE.creatures.dispose) {
      WORLD_STATE.creatures.dispose();
    }
    WORLD_STATE.creatures = null;
    WORLD_STATE.tracks = null;
    WORLD_STATE.tunnelCooldowns = new WeakMap();
    WORLD_STATE.catapultCooldowns = new WeakMap();
    WORLD_STATE.elapsed = 0;
    WORLD_STATE.simNowMs = performance.now();
    WORLD_STATE.interactSpots = [];
    WORLD_STATE.faucetDrops = [];
    WORLD_STATE.faucetSurgeTimer = 0;
    WORLD_STATE.faucetWheel = null;
    WORLD_STATE.faucetJet = null;
    WORLD_STATE.sprinklerGroup = null;
    WORLD_STATE.rollingMarble = null;
    WORLD_STATE.marbleAngle = 0;
    WORLD_STATE.marbleBoostCooldown = 0;
    WORLD_STATE.midEventFired = false;
    WORLD_STATE.splashAlerts = 0;
    WORLD_STATE.moveChar = ctx.moveChar || null;

    const tracks = createMovingTrackSystem(THREE);
    WORLD_STATE.tracks = tracks;
    WORLD_STATE.notify = ctx.notify || null;

    // ------------------------------------------------------------------------
    // 1. Garden Moss Ground (`y = 2.20m`) with Open Ramp Cutouts for Burrow!
    // ------------------------------------------------------------------------
    const mossTex = buildMossGroundTex(THREE);
    mossTex.wrapS = mossTex.wrapT = THREE.RepeatWrapping;
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: mossTex,
      roughness: 0.95,
      metalness: 0,
    });

    // Build wide horizon-filling lawn shape (`R = 115` so zero horizon seam at Y_GARDEN = 2.20m!)
    // Cut 2 rectangular holes ONLY over West & East Burrow Ramps (`[-11.6, -4.6]` & `[4.6, 11.6]`),
    // keeping `x ∈ [-4.6, +4.6]` solid as the overhead garden lawn & oak-root bridge!
    const lawnShape = new THREE.Shape();
    lawnShape.absarc(0, 0, 115, 0, TAU, false);
    for (const rBox of [BURROW_RAMP_W, BURROW_RAMP_E]) {
      const hole = new THREE.Path();
      hole.moveTo(rBox.x0, -rBox.z1);
      hole.lineTo(rBox.x1, -rBox.z1);
      hole.lineTo(rBox.x1, -rBox.z0);
      hole.lineTo(rBox.x0, -rBox.z0);
      hole.closePath();
      lawnShape.holes.push(hole);
    }
    const groundGeo = new THREE.ShapeGeometry(lawnShape, 72);
    const gUv = groundGeo.attributes.uv;
    for (let i = 0; i < gUv.count; i++) {
      gUv.setXY(i, gUv.getX(i) * 0.085, gUv.getY(i) * 0.085);
    }
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -PI / 2;
    groundMesh.position.y = Y_GARDEN;
    groundMesh.receiveShadow = true;
    groundMesh.userData.ground = true;
    groundMesh.userData.paint = new THREE.Color(0x68a244);
    root.add(groundMesh);

    root.add(buildConservatoryGlassBackdrop(THREE));

    // ------------------------------------------------------------------------
    // 2. Underground Root & Mousehole Burrow (`y = 0.25m`, 1.95m below lawn!)
    // ------------------------------------------------------------------------
    const burrowGroup = buildUndergroundRootBurrow(THREE, buildBurrowEarthTex(THREE));
    root.add(burrowGroup);

    // Register vertical-ranged tunnel & trench retaining blockers:
    //  - Ramp north/south curbs (`y0: 0, y1: 2.82`) guide garden walkers cleanly around open ramp trenches
    //  - Central chamber & Secret Pocket walls (`y0: 0, y1: 2.04 < Y_GARDEN = 2.20`!) block underground players
    //    while allowing overhead garden walkers at `y = 2.20m` to walk straight across with ZERO collision!
    const addSpanWall = (x0, x1, z0, z1, y0, y1) => {
      const holder = new THREE.Group();
      holder.userData.colliders = [{
        x: (x0 + x1) * 0.5,
        z: (z0 + z1) * 0.5,
        w: Math.max(0.1, x1 - x0),
        d: Math.max(0.1, z1 - z0),
        y0,
        y1,
        noJump: true,
      }];
      ctx.placeKit(holder, 0, 0, 0, 0.02, true, 0);
    };
    // West & East Ramp Trench retaining walls
    addSpanWall(-11.3, -4.55, 21.92, 22.20, 0.0, 2.82);
    addSpanWall(-11.3, -4.55, 25.80, 26.08, 0.0, 2.82);
    addSpanWall(4.55, 11.3, 21.92, 22.20, 0.0, 2.82);
    addSpanWall(4.55, 11.3, 25.80, 26.08, 0.0, 2.82);
    // Underground Central Chamber north wall & split south divider (`y1 = 2.04 < 2.20`!)
    addSpanWall(-4.65, 4.65, 21.10, 21.42, 0.0, 2.04);
    addSpanWall(-4.65, -3.10, 26.44, 26.82, 0.0, 2.04);
    addSpanWall(-1.25, 2.05, 26.44, 26.82, 0.0, 2.04);
    addSpanWall(3.85, 4.65, 26.44, 26.82, 0.0, 2.04);
    // Secret Burrow Pocket perimeter walls (`z ∈ [26.6, 29.2], y1 = 2.04 < 2.20`)
    addSpanWall(-4.45, -4.15, 26.55, 29.45, 0.0, 2.04);
    addSpanWall(4.35, 4.65, 26.55, 29.45, 0.0, 2.04);
    addSpanWall(-4.45, 4.65, 29.18, 29.48, 0.0, 2.04);

    // ------------------------------------------------------------------------
    // 3. Cracked Blue-and-White Willow Porcelain Plate Plaza (`r = 10.5m` at `2.22m`)
    // ------------------------------------------------------------------------
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: buildWillowPlateTex(THREE),
      roughness: 0.36,
      metalness: 0,
    });
    const plateDisc = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 72), plateMat);
    plateDisc.rotation.x = -PI / 2;
    plateDisc.position.y = Y_GARDEN + 0.022;
    plateDisc.receiveShadow = true;
    plateDisc.userData.ground = true;
    plateDisc.userData.paint = new THREE.Color(0xf1ece0);
    root.add(plateDisc);

    const rimMat = new THREE.MeshStandardMaterial({ color: 0x3b6cb2, roughness: 0.38, metalness: 0 });
    const plateRim = new THREE.Mesh(new THREE.TorusGeometry(PLAZA_R, 0.085, 8, 72), rimMat);
    plateRim.rotation.x = PI / 2;
    plateRim.position.y = Y_GARDEN + 0.02;
    plateRim.receiveShadow = true;
    plateRim.userData.ground = true;
    plateRim.userData.paint = new THREE.Color(0x4d7abf);
    root.add(plateRim);

    // Cobblestone stepping paths radiating from the Willow Plate to garden homes & seesaw foot
    const cobbleGroup = new THREE.Group();
    const cobbleMat = new THREE.MeshStandardMaterial({ color: 0xd4c5aa, roughness: 0.92, metalness: 0 });
    const cobbleGeo = new THREE.CylinderGeometry(0.46, 0.5, 0.05, 9);
    const pathTargets = [
      ...HOME_LAYOUT.filter((h) => h.y === Y_GARDEN),
      { x: -5.4, z: -14.9 },
      { x: 3.2, z: 13.8 },
    ];
    for (const h of pathTargets) {
      const dist = Math.hypot(h.x, h.z);
      const ux = h.x / dist, uz = h.z / dist;
      for (let d = PLAZA_R + 0.55; d < dist - 3.8; d += 0.95) {
        const wob = Math.sin(d * 1.4 + h.x) * 0.26;
        const st = new THREE.Mesh(cobbleGeo, cobbleMat);
        st.position.set(ux * d - uz * wob, Y_GARDEN + 0.02, uz * d + ux * wob);
        st.scale.set(1.15, 1, 0.88);
        st.rotation.y = d;
        cobbleGroup.add(st);
      }
    }
    mergeStatic(THREE, cobbleGroup);
    cobbleGroup.traverse((m) => {
      if (m.isMesh) {
        m.userData.ground = true;
        m.userData.paint = new THREE.Color(0xd4c5aa);
      }
    });
    root.add(cobbleGroup);

    // ------------------------------------------------------------------------
    // 4. Plaza Landmarks (`faucetShellPond`, 2 `buttonLeafStall`s, Matchstick Benches)
    // ------------------------------------------------------------------------
    const pondPos = { x: 0.0, z: 1.55 };
    const pondGroup = B.faucetShellPond({ seed: 11, marbleX: 3.45, marbleZ: 2.85 });
    ctx.placeKit(pondGroup, pondPos.x, pondPos.z, 0, 0.05, true, Y_GARDEN);

    ctx.placeKit(B.buttonLeafStall({ seed: 21, autumn: false }), -6.45, -0.75, 1.18, 0.05, true, Y_GARDEN);
    ctx.placeKit(B.buttonLeafStall({ seed: 29, autumn: true }), 6.45, -0.75, -1.18, 0.05, true, Y_GARDEN);

    ctx.placeKit(buildMatchstickBench(THREE), -5.35, 4.45, 0.62, 0.05, true, Y_GARDEN);
    ctx.placeKit(buildMatchstickBench(THREE), 5.45, 3.35, -0.68, 0.05, true, Y_GARDEN);

    // Standable Giant Button Perches tucked along clover glade edges (`h <= 0.74m` -> standable & never blocks lanes!)
    const buttonPerches = [
      [-7.6, -7.8, Y_GARDEN, 0.80, 0.56, 0xf2dfc0],
      [-8.9, -8.8, Y_GARDEN, 0.76, 0.74, 0xe8c99b],
      [15.4, -4.2, Y_GARDEN, 0.84, 0.58, 0xdbe7f4],
      [16.8, -3.2, Y_GARDEN, 0.78, 0.74, 0xf5e8d0],
    ];
    for (const [bx, bz, by, br, bh, bcol] of buttonPerches) {
      ctx.placeKit(buildButtonSteppingPerch(THREE, br, bh, bcol), bx, bz, 0.2, 0.04, true, by);
    }

    // ------------------------------------------------------------------------
    // 5. Dewdrop Garden Stream + `trowelBridge` + `mossyTwigBridge`
    // ------------------------------------------------------------------------
    const streamSegs = 64, halfW = 1.52;
    const sPos = [], sUv = [], sIdx = [];
    for (let i = 0; i <= streamSegs; i++) {
      const t = i / streamSegs;
      const x = -34 + t * 68;
      const cz = streamZAt(x);
      sPos.push(x, 0, cz - halfW, x, 0, cz + halfW);
      sUv.push(t * 14, 0, t * 14, 1);
      if (i < streamSegs) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        sIdx.push(a, b, c, b, d, c);
      }
    }
    const streamGeo = new THREE.BufferGeometry();
    streamGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    streamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2));
    streamGeo.setIndex(sIdx);
    streamGeo.computeVertexNormals();

    const streamWater = createAnimatedWater(THREE, {
      geometry: streamGeo,
      preRotated: true,
      y: Y_GARDEN + 0.026,
      walkable: true,
      deep: 0x1f6e8c,
      shallow: 0x54c4dc,
      foam: 0xf0fcff,
      opacity: 0.88,
      scale: 0.52,
    });
    root.add(streamWater.mesh);

    const bankStones = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8e9185, roughness: 0.92, metalness: 0 });
    const rockGeo = new THREE.DodecahedronGeometry(0.42, 0);
    for (let x = -30; x <= 30; x += 1.05) {
      if (Math.abs(x - 3.2) < 2.45 || Math.abs(x + 7.2) < 2.25 || Math.abs(x - 16.4) < 2.25) continue;
      const cz = streamZAt(x);
      for (const side of [-1, 1]) {
        const rk = new THREE.Mesh(rockGeo, rockMat);
        rk.position.set(x + rng.jr(-0.2, 0.2), Y_GARDEN + 0.14, cz + side * (halfW + 0.18));
        rk.scale.set(rng.jr(0.8, 1.3), rng.jr(0.45, 0.75), rng.jr(0.75, 1.15));
        rk.rotation.set(rng.jr(0, 2), rng.jr(0, 3), 0);
        bankStones.add(rk);
      }
    }
    mergeStatic(THREE, bankStones);
    bankStones.traverse((m) => { if (m.isMesh) m.userData.paint = new THREE.Color(0x8e9185); });
    root.add(bankStones);

    // Bridge 1: Walkable Steel Garden-Trowel Bridge (`(3.2, 14.5)`)
    ctx.placeKit(B.trowelBridge({ seed: 41 }), 3.2, 14.5, 0.18, 0.05, true, Y_GARDEN);
    // Bridge 2: Walkable Mossy Twig & Button Bridge (`(-7.2, 14.3)`)
    ctx.placeKit(B.mossyTwigBridge({ seed: 47 }), -7.2, 14.3, 0.06, 0.05, true, Y_GARDEN);

    // ------------------------------------------------------------------------
    // 6. Giant Wooden Potting Bench (`5.60m`), 11m Tilting 30cm Seesaw Ruler,
    //    2 Wooden Spring Clothespin Catapults & High Shelf (`8.40m`)!
    // ------------------------------------------------------------------------
    ctx.placeKit(B.pottingBenchTerrace({ seed: 131 }), 13.5, -15.0, 0, 0.05, true, Y_GARDEN);

    const seesawBuilt = buildSeesawRulerAssembly(THREE, SEESAW_SPEC);
    root.add(seesawBuilt.baseGroup);
    root.add(seesawBuilt.rulerMesh);
    if (ctx.addWorldObb) {
      const spoolBlk = ctx.addWorldObb(SEESAW_SPEC.cx, SEESAW_SPEC.cz, 0.65, 1.65, 0, Y_GARDEN, Y_GARDEN + 1.45, false);
      if (spoolBlk) spoolBlk.noJump = true;
    }
    WORLD_STATE.seesaw = {
      mesh: seesawBuilt.rulerMesh,
      spool: seesawBuilt.spoolGroup,
      tilt: SEESAW_SPEC.restTilt,
      vel: 0,
      restTilt: SEESAW_SPEC.restTilt,
      maxTilt: SEESAW_SPEC.maxTilt,
      cx: SEESAW_SPEC.cx,
      cy: SEESAW_SPEC.cy,
      cz: SEESAW_SPEC.cz,
      halfL: SEESAW_SPEC.halfL,
      halfW: SEESAW_SPEC.halfW,
    };
    WORLD_STATE.rulerMesh = seesawBuilt.rulerMesh;

    // 2 Wooden Spring Clothespin Catapults launching skyward (`rideSpot`) onto Y_SHELF (`8.40m`)
    const catapultSpecs = [
      { id: 'bw_catapult_west', x: -4.0, y: Y_GARDEN, z: -21.0, toX: 3.4, toY: Y_SHELF, toZ: -23.8, dur: 1.42, arcY: 3.6 },
      { id: 'bw_catapult_east', x: 18.2, y: Y_GARDEN, z: -23.4, toX: 13.2, toY: Y_SHELF, toZ: -23.8, dur: 1.38, arcY: 3.6 },
    ];
    for (const cs of catapultSpecs) {
      const yaw = Math.atan2(-(cs.toZ - cs.z), cs.toX - cs.x);
      const builtCat = buildClothespinCatapult(THREE, yaw);
      builtCat.group.position.set(cs.x, cs.y, cs.z);
      root.add(builtCat.group);
      WORLD_STATE.clothespinCatapults.push({
        id: cs.id,
        x: cs.x,
        y: cs.y,
        z: cs.z,
        toX: cs.toX,
        toY: cs.toY,
        toZ: cs.toZ,
        dur: cs.dur,
        arcY: cs.arcY,
        group: builtCat.group,
        armPivot: builtCat.armPivot,
        springAnim: 0,
      });
    }

    ctx.placeKit(B.highConservatoryShelf({ seed: 149 }), 8.5, -24.5, 0, 0.05, true, Y_SHELF);

    // ------------------------------------------------------------------------
    // 7. Place All 5 Enterable 2-Room Tinyfolk Treasure Homes!
    // ------------------------------------------------------------------------
    let workshopGroup = null;
    HOME_LAYOUT.forEach((h, idx) => {
      const g = B[h.id]({ seed: 10 + idx * 13, garden: false });
      ctx.placeKit(g, h.x, h.z, h.rotY, 0.05, true, h.y);
      if (h.id === 'sewing_watch_workshop') workshopGroup = g;
    });

    // Mossy Stone Toad-Lantern Guardian in NW clover glade
    ctx.placeKit(B.mossGuardianStatue({ seed: 61 }), -1.8, -24.2, 0.12, 0.05, true, Y_GARDEN);

    // Clothespin & Twine Fences framing stream banks (clear of bridges & burrow ramps!)
    const fencePlacements = [
      [-12.4, 11.8, 0.16, 4],
      [-2.2, 12.0, -0.06, 4],
      [11.4, 12.6, -0.20, 4],
      [-15.6, 18.8, 0.28, 4],
      [15.8, 19.0, -0.24, 4],
    ];
    fencePlacements.forEach(([fx, fz, frot, cnt], i) => {
      ctx.placeKit(B.clothespinFence({ seed: 70 + i * 5, count: cnt }), fx, fz, frot, 0.05, true, Y_GARDEN);
    });

    // ------------------------------------------------------------------------
    // 8. Place 5 Bouncy Red Amanita Mushroom Caps (`sampleLauncherAt`)!
    // ------------------------------------------------------------------------
    const amanitaSpecs = [
      { x: 4.2, z: -9.2, y: Y_GARDEN, r: 1.52 },     // #1 SW of Potting Bench -> launches onto Potting Bench (`5.60m`)
      { x: 22.6, z: -12.8, y: Y_GARDEN, r: 1.52 },   // #2 East of Potting Bench -> launches onto Potting Bench (`5.60m`)
      { x: -19.5, z: -16.8, y: Y_GARDEN, r: 1.52 },  // #3 NW Clover Glade -> clover-glide across Willow Plaza
      { x: 17.2, z: 22.4, y: Y_GARDEN, r: 1.52 },    // #4 SE Stream Meadow -> clover-glide over stream & root arch
      { x: 8.4, z: -18.8, y: Y_BENCH, r: 1.52 },     // #5 Elevated on Potting Bench -> launches onto High Shelf (`8.40m`)!
    ];
    amanitaSpecs.forEach((sp, idx) => {
      const padMesh = B.bouncyAmanitaPad({ seed: 180 + idx * 7, radius: sp.r });
      ctx.placeKit(padMesh, sp.x, sp.z, idx * 0.8, 0.02, true, sp.y);
      const capGroup = padMesh.getObjectByName('amanitaCap');
      WORLD_STATE.amanitaPads.push({
        x: sp.x,
        y: sp.y,
        z: sp.z,
        r: 1.48,
        capGroup,
        squash: 0,
      });
    });

    // ------------------------------------------------------------------------
    // 9. Place All 3 Brand-New Interactive Tiny-Folk Hiding Spots!
    // ------------------------------------------------------------------------
    // Spot Type 1A: Hollow Giant Porcelain Teacup on Garden Floor (with 8 standable rim colliders!)
    ctx.placeKit(B.hollowGiantTeacup({ seed: 163 }), -8.4, 7.6, 0.35, 0.03, true, Y_GARDEN);
    WORLD_STATE.interactSpots.push({
      id: 'tinyfolk_teacup_garden',
      kind: 'custom_spot',
      spotType: 'teacup',
      icon: '🍵',
      label: 'Hide Inside Giant Teacup (G)',
      disguiseLabel: 'Chamomile & Clover Tea Cup 🍵',
      enterHint: '🍵 Tucked inside the hollow porcelain teacup! Seekers must jump on the rim to peek in!',
      exitHint: 'Hopped out of the giant porcelain teacup!',
      x: -8.4,
      y: Y_GARDEN,
      groundY: Y_GARDEN,
      z: 7.6,
      offsetY: 0.24,
      interactRadius: 2.95,
      exitX: -6.35,
      exitZ: 7.6,
      exitY: Y_GARDEN,
      occupiedBy: null,
    });

    // Spot Type 1B: Hollow Giant Porcelain Teacup up on the Giant Potting Bench (`5.60m`)!
    ctx.placeKit(B.hollowGiantTeacup({ seed: 167 }), 8.4, -10.8, -0.55, 0.03, true, Y_BENCH);
    WORLD_STATE.interactSpots.push({
      id: 'tinyfolk_teacup_bench',
      kind: 'custom_spot',
      spotType: 'teacup',
      icon: '🍵',
      label: 'Hide Inside Potting-Bench Teacup (G)',
      disguiseLabel: 'Chamomile & Clover Tea Cup 🍵',
      enterHint: '🍵 Hidden inside the giant teacup high on the Potting Bench!',
      exitHint: 'Hopped out onto the Potting Bench!',
      x: 8.4,
      y: Y_BENCH,
      groundY: Y_BENCH,
      z: -10.8,
      offsetY: 0.24,
      interactRadius: 2.95,
      exitX: 10.45,
      exitZ: -10.8,
      exitY: Y_BENCH,
      occupiedBy: null,
    });

    // Spot Type 1C: Hollow Giant Cracked Terracotta Flowerpot on East Garden!
    ctx.placeKit(B.hollowTerracottaPot({ seed: 173 }), 12.2, -1.8, 0.22, 0.03, true, Y_GARDEN);
    WORLD_STATE.interactSpots.push({
      id: 'tinyfolk_flowerpot_garden',
      kind: 'custom_spot',
      spotType: 'flowerpot',
      icon: '🪴',
      label: 'Hide Inside Giant Flowerpot (G)',
      disguiseLabel: 'Flowerpot Clover Sprout 🪴',
      enterHint: '🪴 Nestled inside the hollow terracotta flowerpot as a clover & copper-trowel sprout!',
      exitHint: 'Hopped out of the giant terracotta pot!',
      x: 12.2,
      y: Y_GARDEN,
      groundY: Y_GARDEN,
      z: -1.8,
      offsetY: 0.24,
      interactRadius: 2.95,
      exitX: 10.15,
      exitZ: -1.8,
      exitY: Y_GARDEN,
      occupiedBy: null,
    });

    // Spot Type 2A & 2B: Vertical Hanging Wooden Clothespins (`kind: 'hook'`, `hangY: 1.75`!)
    ctx.placeKit(B.clothespinTwineLine({ seed: 191 }), -9.6, -2.6, 0.35, 0.04, true, Y_GARDEN);
    WORLD_STATE.interactSpots.push({
      id: 'tinyfolk_clothespin_west',
      kind: 'hook',
      propId: 'bw_button_stack',
      icon: '🧷',
      label: 'Clip Onto Hanging Clothespin (G)',
      disguiseLabel: 'Clothespin Button Charm 🧷',
      enterHint: '🧷 Clipped high onto the hanging wooden clothespin at +1.75m! (WASD or G to drop)',
      exitHint: 'Dropped down from the wooden clothespin!',
      x: -9.6,
      groundY: Y_GARDEN,
      z: -2.6,
      hangY: 1.75,
      interactRadius: 2.65,
      exitX: -9.1,
      exitZ: -1.4,
      exitY: Y_GARDEN,
      occupiedBy: null,
    });

    ctx.placeKit(B.clothespinTwineLine({ seed: 197 }), 9.6, 8.6, -0.32, 0.04, true, Y_GARDEN);
    WORLD_STATE.interactSpots.push({
      id: 'tinyfolk_clothespin_east',
      kind: 'hook',
      propId: 'bw_acorn_lantern',
      icon: '🧷',
      label: 'Clip Onto Hanging Clothespin (G)',
      disguiseLabel: 'Clothespin Acorn Charm 🧷',
      enterHint: '🧷 Clipped high onto the hanging wooden clothespin at +1.75m! (WASD or G to drop)',
      exitHint: 'Dropped down from the wooden clothespin!',
      x: 9.6,
      groundY: Y_GARDEN,
      z: 8.6,
      hangY: 1.75,
      interactRadius: 2.65,
      exitX: 9.1,
      exitZ: 7.4,
      exitY: Y_GARDEN,
      occupiedBy: null,
    });

    // Spot Type 3: Underground Mouse-Hole Root Burrow Nook (`y = 0.25m` underground!)
    WORLD_STATE.interactSpots.push({
      id: 'tinyfolk_mousehole_burrow',
      kind: 'custom_spot',
      spotType: 'burrow',
      icon: '🌰',
      label: 'Curl Into Mousehole Root Nook (G)',
      disguiseLabel: 'Burrow Acorn & Moss Bundle 🌰',
      enterHint: '🌰 Curled into the underground mousehole root nook as an acorn & glowing-fungi bundle!',
      exitHint: 'Slipped out of the mousehole root nook!',
      x: 0.0,
      y: Y_BURROW,
      groundY: Y_BURROW,
      z: 25.45,
      offsetY: 0.04,
      interactRadius: 2.65,
      exitX: 0.0,
      exitZ: 23.9,
      exitY: Y_BURROW,
      occupiedBy: null,
    });

    // ------------------------------------------------------------------------
    // 10. Towering 5m Giant Clovers, Daisies, Ferns & Swaying Lawn Blades
    // ------------------------------------------------------------------------
    const swayingCrowns = [];
    const cloverRing = [
      [-26.5, -3.5, 5.6, true], [-25.2, -15.2, 5.2, false], [-18.5, -24.2, 5.8, true],
      [25.2, -16.8, 5.6, true], [27.4, -1.8, 5.1, false], [26.2, 13.5, 5.4, true],
      [17.5, 25.2, 5.2, false], [-17.8, 25.4, 5.4, false], [-27.2, 12.2, 5.6, true],
      [-5.2, -26.5, 5.5, true], [18.5, -25.6, 5.2, false], [0.0, 29.5, 5.7, true],
      [-21.8, 18.8, 5.5, true], [21.8, 18.5, 5.4, false], [-28.5, -9.8, 5.7, true],
      [28.5, 6.2, 5.5, true], [-12.5, 28.5, 5.3, false], [12.5, 28.5, 5.6, true],
    ];
    cloverRing.forEach(([cx, cz, h, four], i) => {
      const { group, crown } = buildGiantClover(THREE, 200 + i * 17, h, four);
      ctx.placeSolid(group, cx, cz, i * 0.9, 1, 0.05, Y_GARDEN);
      swayingCrowns.push({ obj: crown, phase: i * 1.1, amp: 0.055 });
    });

    const daisyRing = [
      [-24.2, -9.2, 4.8, false], [-15.8, -22.8, 4.5, false], [25.4, -5.8, 4.9, false],
      [24.6, 10.2, 4.6, true], [14.8, 27.8, 4.8, false], [-14.5, 27.2, 4.5, true],
      [-25.4, 8.6, 4.9, false], [-23.5, 1.8, 4.4, true], [24.2, 0.8, 4.6, false],
    ];
    daisyRing.forEach(([dx, dz, h, vio], i) => {
      const { group, crown } = buildGiantDaisy(THREE, 400 + i * 19, h, vio);
      ctx.placeSolid(group, dx, dz, i * 0.7, 1, 0.05, Y_GARDEN);
      swayingCrowns.push({ obj: crown, phase: i * 0.85 + 0.5, amp: 0.07 });
    });

    const fernSpots = [
      [-16.8, -15.2], [-6.8, -23.2], [24.5, -11.2], [24.8, 2.8], [-24.6, -1.5], [-21.5, 16.8], [21.2, 17.6],
    ];
    fernSpots.forEach(([fx, fz], i) => {
      ctx.placeSolid(buildGiantFernCluster(THREE, 600 + i * 23), fx, fz, i * 1.2, 1, 0.05, Y_GARDEN);
    });

    const isClearGrass = (x, z) => {
      const r = Math.hypot(x, z);
      if (r < PLAZA_R + 0.5 || r > 32.5) return false;
      if (Math.abs(z - streamZAt(x)) < 2.25) return false;
      if (x >= SEESAW_SPEC.cx - SEESAW_SPEC.halfL - 1.2 && x <= BENCH_BOX.x1 + 1.0 && z >= SHELF_BOX.z0 - 1.0 && z <= BENCH_BOX.z1 + 1.0) return false;
      if (x >= BURROW_RAMP_W.x0 - 1.2 && x <= BURROW_RAMP_E.x1 + 1.2 && z >= BURROW_CHAMBER.z0 - 1.0 && z <= BURROW_CHAMBER.z1 + 1.0) return false;
      for (const h of HOME_LAYOUT) if (h.y === Y_GARDEN && Math.hypot(x - h.x, z - h.z) < 6.4) return false;
      return true;
    };
    const grassBlades = createSwayingBlades(THREE, {
      count: 3800,
      height: 0.66,
      width: 0.068,
      spread: 32,
      seed: 88,
      color: 0x76b24c,
      y: Y_GARDEN,
      filter: isClearGrass,
    });
    grassBlades.inst.position.y = Y_GARDEN;
    root.add(grassBlades.inst);

    // ------------------------------------------------------------------------
    // 11. Multi-Tier Outdoor & Underground Prop Vignettes (`ctx.addVig`)!
    // ------------------------------------------------------------------------
    const vignettes = [
      // Garden Willow-Plate Plaza & Market Stalls (`y = 2.20m`)
      [-6.1, -2.55, [['bw_strawberry_basket', 0, 0, 0.2], ['bw_strawberry_basket', 0.85, 0.15, -0.4], ['bw_sugar_crate', -0.85, 0.2, 0.1], ['bw_thimble_stool', 1.55, 0.45, 0.5], ['bw_acorn_lantern', -1.55, 0.35, -0.2], ['bw_button_stack', 0.35, -0.78, 0.3]], 1, Y_GARDEN],
      [6.1, -2.55, [['bw_sugar_crate', 0, 0, -0.2], ['bw_sugar_crate', -0.85, 0.15, 0.3], ['bw_button_stack', 0.85, 0.2, 0.4], ['bw_inkwell_pot', -1.55, 0.4, 0.1], ['bw_acorn_lantern', 1.55, 0.35, 0.6], ['bw_thimble_stool', -0.35, -0.78, -0.3]], 1, Y_GARDEN],
      [-2.45, 2.25, [['bw_teacup_planter', 0, 0, 0.4], ['bw_teacup_planter', -0.85, 0.35, -0.3], ['bw_button_stack', 0.45, 0.75, 0.2], ['bw_thimble_stool', -0.45, -0.75, 0.8], ['bw_inkwell_pot', -1.35, -0.25, 0.1]], 1, Y_GARDEN],
      [2.65, 6.45, [['bw_button_stack', 0, 0, 0.1], ['bw_button_stack', 0.82, -0.2, -0.5], ['bw_pocket_watch', -0.75, 0.25, 0.4], ['bw_thimble_stool', 1.45, 0.35, -0.2], ['bw_sugar_crate', -1.45, -0.15, 0.2]], 1, Y_GARDEN],
      // Home Gardens (`y = 2.20m` — spaced generously clear of building corner-wrap rings & doorways!)
      [-10.6, -4.4, [['bw_sugar_crate', 0, 0, 0.3], ['bw_sugar_crate', -0.85, -0.45, -0.2], ['bw_spool_table', 0.85, 0.35, 0.1], ['bw_thimble_stool', 1.55, 0.15, 0.6], ['bw_bottle_cap_chair', 0.35, 1.15, -0.8], ['bw_button_stack', -1.45, 0.35, 0.4]], 1, Y_GARDEN],
      [-6.8, -10.4, [['bw_teacup_planter', 0, 0, 0.2], ['bw_teacup_planter', 0.9, 0.15, -0.5], ['bw_inkwell_pot', -0.85, 0.3, 0.4], ['bw_spool_table', 1.75, 0.45, 0.1], ['bw_thimble_stool', 1.35, 1.15, 0.3]], 1, Y_GARDEN],
      [12.0, 5.8, [['bw_mushroom_cluster', 0, 0, 0.2], ['bw_mushroom_cluster', 0.92, -0.35, -0.6], ['bw_acorn_lantern', -0.85, 0.35, 0.4], ['bw_matchbox_bed', 0.45, 1.05, 0.9], ['bw_strawberry_basket', -0.45, -0.95, -0.3]], 1, Y_GARDEN],
      [-11.8, 1.8, [['bw_pocket_watch', 0, 0, 0.5], ['bw_button_stack', 0.88, 0.25, -0.3], ['bw_spool_table', -0.85, 0.55, 0.2], ['bw_thimble_stool', -1.5, 0.15, -0.5], ['bw_pocket_watch', -0.65, -0.75, -0.2]], 1, Y_GARDEN],
      // Shaded Under-Potting-Bench Grotto (`y = 2.20m` directly beneath the `5.60m` Potting Bench!)
      [13.5, -14.8, [['bw_mushroom_cluster', 0, 0, 0.3], ['bw_mushroom_cluster', 1.1, 0.4, -0.5], ['bw_acorn_lantern', -1.1, -0.3, 0.2], ['bw_sugar_crate', 0.4, -1.1, 0.4], ['bw_thimble_stool', -0.6, 0.9, -0.3]], 1, Y_GARDEN],
      // Stream Meadow Vignettes (`y = 2.20m`)
      [-0.4, 11.2, [['bw_acorn_lantern', 0, 0, 0.1], ['bw_mushroom_cluster', -0.85, 0.25, 0.5], ['bw_button_stack', 0.82, 0.3, -0.4], ['bw_thimble_stool', -0.2, -0.82, 0.2]], 1, Y_GARDEN],
      [6.8, 18.2, [['bw_strawberry_basket', 0, 0, 0.3], ['bw_strawberry_basket', 0.88, -0.2, -0.5], ['bw_mushroom_cluster', -0.85, 0.35, 0.2], ['bw_acorn_lantern', 1.55, 0.35, -0.3]], 1, Y_GARDEN],
      [-8.5, 18.6, [['bw_spool_table', 0, 0, 0.2], ['bw_bottle_cap_chair', -0.95, 0.15, 1.3], ['bw_bottle_cap_chair', 0.95, -0.15, -1.4], ['bw_sugar_crate', -1.35, -0.85, 0.4]], 1, Y_GARDEN],
      // Underground Root Burrow Vignette (`y = 0.25m` down in the lantern-lit tunnel!)
      [-2.2, 23.2, [['bw_acorn_lantern', 0, 0, 0.2], ['bw_mushroom_cluster', 0.95, -0.3, -0.4], ['bw_sugar_crate', 4.4, 0.2, 0.3], ['bw_thimble_stool', 3.6, -0.4, -0.2]], 1, Y_BURROW],
      // Elevated Giant Potting Bench Terrace Vignettes (`y = 5.60m`!)
      [19.8, -10.2, [['bw_teacup_planter', 0, 0, -0.4], ['bw_inkwell_pot', -0.85, 0.35, 0.3], ['bw_strawberry_basket', 0.85, 0.35, 0.7], ['bw_thimble_stool', -0.25, -0.85, 0.2]], 1, Y_BENCH],
      [11.2, -10.1, [['bw_spool_table', 0, 0, 0.1], ['bw_thimble_stool', -0.85, 0.2, 0.5], ['bw_button_stack', 0.85, -0.15, -0.4], ['bw_acorn_lantern', 0.1, 0.8, 0.3]], 1, Y_BENCH],
      // High Conservatory Brick & Jam-Jar Shelf Vignette (`y = 8.40m`!)
      [8.5, -23.6, [['bw_pocket_watch', -2.6, 0, 0.4], ['bw_sugar_crate', 2.6, 0.1, -0.3], ['bw_acorn_lantern', 0, 0.4, 0.1], ['bw_button_stack', -1.2, 0.5, -0.2]], 1, Y_SHELF],
    ];
    vignettes.forEach(([cx, cz, items, openCnt, cy]) => {
      ctx.addVig(cx, cz, items, openCnt, cy);
    });

    // ------------------------------------------------------------------------
    // 12. Overhead Conservatory Faucet Pipe (`y = 9.85m`) & Giant Falling Water Drops!
    // ------------------------------------------------------------------------
    const splashZones = [
      { x: 0.0, z: 1.80, startY: 11.35, impactY: Y_GARDEN + 0.58, phase: 0.0 },
      { x: -3.35, z: 3.65, startY: 11.35, impactY: Y_GARDEN + 0.03, phase: 0.333 },
      { x: 3.45, z: -1.95, startY: 11.35, impactY: Y_GARDEN + 0.03, phase: 0.666 },
    ];
    root.add(buildOverheadFaucetPipe(THREE, splashZones));

    const giantDropMat = new THREE.MeshStandardMaterial({
      color: 0xdff8ff,
      emissive: 0x6fd8f5,
      emissiveIntensity: 0.42,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.86,
    });
    const splashRingBase = new THREE.MeshBasicMaterial({
      color: 0xe6fbff,
      transparent: true,
      opacity: 0.80,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const hazardDrops = splashZones.map((zone) => {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), giantDropMat);
      sphere.position.set(zone.x, zone.startY, zone.z);
      root.add(sphere);

      const ringOuter = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.46, 32), splashRingBase.clone());
      ringOuter.rotation.x = -PI / 2;
      ringOuter.position.set(zone.x, zone.impactY + 0.02, zone.z);
      ringOuter.visible = false;
      root.add(ringOuter);

      const ringInner = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.24, 28), splashRingBase.clone());
      ringInner.rotation.x = -PI / 2;
      ringInner.position.set(zone.x, zone.impactY + 0.025, zone.z);
      ringInner.visible = false;
      root.add(ringInner);

      const crownGroup = new THREE.Group();
      crownGroup.position.set(zone.x, zone.impactY, zone.z);
      crownGroup.visible = false;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), giantDropMat);
        bead.userData.ang = a;
        crownGroup.add(bead);
      }
      root.add(crownGroup);

      return {
        zone,
        sphere,
        ringOuter,
        ringInner,
        crownGroup,
        lastU: -1,
        impactCount: 0,
      };
    });
    WORLD_STATE.faucetDrops = hazardDrops;

    // Gentle low drip from the plaza's antique Shell-Pond Tap (`y = 4.32 -> 2.81m`)
    const lowSpoutY = Y_GARDEN + (pondGroup.userData.spoutTip ? pondGroup.userData.spoutTip.y : 2.12);
    const lowPondY = Y_GARDEN + (pondGroup.userData.waterY ?? 0.61);
    const lowDrop = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), giantDropMat);
    root.add(lowDrop);

    // ------------------------------------------------------------------------
    // 13. Fluttering 3D Pastel Butterflies & Drifting Conservatory Pollen Spores
    // ------------------------------------------------------------------------
    const bflyColors = [0x6fc3f7, 0xfff5c0, 0xf7a4bc, 0xb89cf6, 0x9ef0b4];
    const wingGeo = new THREE.CircleGeometry(0.14, 8, 0, PI);
    wingGeo.translate(0, 0.06, 0);
    const butterflies = [];
    for (let i = 0; i < 10; i++) {
      const bg = new THREE.Group();
      const wm = new THREE.MeshStandardMaterial({
        color: bflyColors[i % bflyColors.length],
        emissive: bflyColors[i % bflyColors.length],
        emissiveIntensity: 0.22,
        roughness: 0.6,
        metalness: 0,
        side: THREE.DoubleSide,
      });
      const wL = new THREE.Mesh(wingGeo, wm);
      const wR = new THREE.Mesh(wingGeo, wm);
      wL.rotation.x = PI / 2;
      wR.rotation.x = PI / 2;
      wR.scale.x = -1;
      bg.add(wL, wR);
      const a = (i / 10) * TAU;
      const rad = 5.5 + (i % 4) * 4.8;
      root.add(bg);
      butterflies.push({
        grp: bg, wL, wR,
        cx: Math.cos(a) * rad,
        cz: Math.sin(a) * rad,
        r: 1.8 + (i % 3) * 1.1,
        y0: Y_GARDEN + 1.45 + (i % 3) * 0.85,
        spd: 0.48 + (i % 4) * 0.12,
        ph: i * 1.7,
      });
    }

    const sporeCount = 90;
    const sporeInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.048, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff09e, transparent: true, opacity: 0.85 }),
      sporeCount
    );
    const sporeData = [];
    const sm4 = new THREE.Matrix4(), spCol = new THREE.Color();
    for (let i = 0; i < sporeCount; i++) {
      // Include glowing spores both in the conservatory garden AND down inside the underground root burrow!
      const inBurrow = i < 16;
      const sx = inBurrow ? rng.jr(-8.5, 8.5) : rng.jr(-26, 26);
      const sy = inBurrow ? rng.jr(Y_BURROW + 0.35, Y_GARDEN - 0.35) : rng.jr(Y_GARDEN + 0.6, Y_SHELF + 1.4);
      const sz = inBurrow ? rng.jr(22.0, 26.0) : rng.jr(-26, 26);
      sporeData.push({ x: sx, y: sy, z: sz, ph: rng.jr(0, TAU), spd: rng.jr(0.35, 0.85) });
      sm4.makeTranslation(sx, sy, sz);
      sporeInst.setMatrixAt(i, sm4);
      sporeInst.setColorAt(i, spCol.setHex(i % 3 === 0 ? 0xcdf788 : 0xffe88a));
    }
    root.add(sporeInst);

    // ------------------------------------------------------------------------
    // 11. Sculpted Underground Ant-Tunnel Chutes, Acorn Slingshot & Miniature Creatures
    // ------------------------------------------------------------------------
    const antMoundMat = new THREE.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.94, metalness: 0 });
    const antArchMat = new THREE.MeshStandardMaterial({ color: 0x4b2f19, roughness: 0.92, metalness: 0 });
    const antVoidMat = new THREE.MeshBasicMaterial({ color: 0x160d07 });
    const antGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffe49e,
      emissive: new THREE.Color(0xffa93a),
      emissiveIntensity: 0.92,
      roughness: 0.45,
      metalness: 0,
    });
    const antPostMat = new THREE.MeshStandardMaterial({ color: 0xa47443, roughness: 0.88, metalness: 0 });
    const antArrowMat = new THREE.MeshStandardMaterial({ color: 0xf4cf72, roughness: 0.72, metalness: 0 });

    const buildAntPortal = (px, py, pz, dirX, dirZ) => {
      const yaw = Math.atan2(dirX, dirZ);
      const pg = new THREE.Group();
      pg.position.set(px, py, pz);
      pg.rotation.y = yaw;

      // Earthen dome mound opening onto tunnel maw
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.56, 0.92, 14), antMoundMat);
      mound.position.set(0, 0.44, -0.35);
      mound.castShadow = true;
      mound.receiveShadow = true;
      pg.add(mound);

      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.22, 8, 16, PI), antArchMat);
      arch.position.set(0, 0.42, 0.28);
      arch.castShadow = true;
      pg.add(arch);

      const maw = new THREE.Mesh(new THREE.CircleGeometry(0.60, 14), antVoidMat);
      maw.position.set(0, 0.48, 0.26);
      pg.add(maw);

      // Pair of warm-amber glowing burrow mushrooms framing the root portal
      for (const s of [-1, 1]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.28, 7), antPostMat);
        stem.position.set(s * 0.88, 0.14, 0.34);
        pg.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, TAU, 0, PI * 0.55), antGlowMat);
        cap.position.set(s * 0.88, 0.28, 0.34);
        pg.add(cap);
      }

      // Carved toothpick signpost showing bidirectional travel
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.15, 7), antPostMat);
      post.position.set(1.08, 0.57, 0.12);
      pg.add(post);
      const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), antArrowMat);
      chevron.rotation.x = PI / 2;
      chevron.position.set(1.08, 1.02, 0.24);
      pg.add(chevron);

      mergeStatic(THREE, pg);
      root.add(pg);
    };

    const addAntTunnelPair = (idPrefix, a, landA, b, landB, labelAB, labelBA, arcY = 0.65, dur = 1.35) => {
      const [ax, ay, az] = a;
      const [lax, laz] = landA;
      const [bx, by, bz] = b;
      const [lbx, lbz] = landB;
      const dAx = lax - ax, dAz = laz - az;
      const dBx = lbx - bx, dBz = lbz - bz;
      buildAntPortal(ax, ay, az, dAx, dAz);
      buildAntPortal(bx, by, bz, dBx, dBz);

      WORLD_STATE.antTunnels.push({
        id: `${idPrefix}_ab`,
        kind: 'ride_path',
        icon: '🐜',
        label: labelAB,
        fromX: ax,
        fromY: ay,
        fromZ: az,
        toX: lbx,
        toY: by,
        toZ: lbz,
        dur,
        arcY,
        enterHint: `🐜 Scurried through a secret Tinyfolk Ant-Tunnel!`,
      });
      WORLD_STATE.antTunnels.push({
        id: `${idPrefix}_ba`,
        kind: 'ride_path',
        icon: '🐜',
        label: labelBA,
        fromX: bx,
        fromY: by,
        fromZ: bz,
        toX: lax,
        toY: ay,
        toZ: laz,
        dur,
        arcY,
        enterHint: `🐜 Scurried through a secret Tinyfolk Ant-Tunnel!`,
      });
    };

    // 3 Bidirectional Ant-Tunnel Chutes connecting Burrow (0.25m) <-> Garden (2.20m) <-> Potting Bench (5.60m)
    addAntTunnelPair(
      'ant_nw_burrow',
      [-3.2, Y_BURROW, 23.0], [-1.3, 23.4],
      [-12.6, Y_GARDEN, -11.2], [-10.8, -10.0],
      'Ant-Tunnel → NW Moss Glade (G)',
      'Ant-Tunnel → Underground Burrow (G)',
      0.65, 1.35
    );
    addAntTunnelPair(
      'ant_east_burrow',
      [3.2, Y_BURROW, 23.0], [1.3, 23.4],
      [13.8, Y_GARDEN, 3.2], [11.8, 3.2],
      'Ant-Tunnel → East Moss Meadow (G)',
      'Ant-Tunnel → Underground Burrow (G)',
      0.65, 1.35
    );
    addAntTunnelPair(
      'ant_bench_chute',
      [-13.2, Y_GARDEN, 2.2], [-11.2, 2.2],
      [18.6, Y_BENCH, -10.6], [16.6, -11.4],
      'Ant-Tunnel → Giant Potting Bench (G)',
      'Ant-Tunnel → West Garden Root (G)',
      2.1, 1.45
    );

    // Playable Miniature Garden-Scale Insect & Tiny-Prop Spawns (`id` FIRST!)
    if (ctx.addSlot) {
      ctx.addSlot('bw_bumblebee', -3.4, 5.8, 0.5, Y_GARDEN);
      ctx.addSlot('bw_ladybug', 4.2, -5.2, -0.4, Y_GARDEN);
      ctx.addSlot('bw_ladybug', -1.2, 23.4, 0.2, Y_BURROW);
      ctx.addSlot('bw_dragonfly', 10.6, -13.2, -0.8, Y_BENCH);
      ctx.addSlot('bw_acorn_lantern', -13.1, -0.6, 1.57, Y_GARDEN);
      ctx.addSlot('bw_acorn_lantern', -2.4, 27.9, 0.3, Y_BURROW);
      ctx.addSlot('bw_thimble_stool', 13.6, -5.0, 0.0, Y_GARDEN);
    }

    // Autonomous Living Creature Fleet: 3 Bumblebees, 2 Dragonflies & 4 Ladybugs!
    WORLD_STATE.creatures = createCreatureFleetController(THREE, ctx, [
      // 3 Playable/Wild Hovering Bumblebees
      {
        id: 'bw_bumblebee',
        builder: buildBumblebee,
        kind: 'flyer',
        canFly: true,
        radius: 0.42,
        height: 0.72,
        scale: 1.02,
        speed: 4.8,
        orbitCx: 0.0,
        orbitCz: -1.2,
        orbitRx: 7.8,
        orbitRz: 6.4,
        orbitY: Y_GARDEN + 3.8,
        bobY: 0.65,
        orbitSpeed: 0.42,
        phase: 0.4,
        callType: 'bee',
        perches: [
          { x: -3.6, y: Y_GARDEN, z: -2.8, rotY: 0.4 },
          { x: 3.4, y: Y_GARDEN, z: 3.2, rotY: -0.9 },
        ],
      },
      {
        id: 'bw_bumblebee',
        builder: buildBumblebee,
        kind: 'flyer',
        canFly: true,
        radius: 0.42,
        height: 0.72,
        scale: 0.95,
        speed: 4.5,
        figure8: true,
        orbitCx: -13.5,
        orbitCz: -12.0,
        orbitRx: 6.8,
        orbitRz: 5.5,
        orbitY: Y_GARDEN + 4.4,
        bobY: 0.75,
        orbitSpeed: 0.46,
        phase: 2.1,
        callType: 'bee',
        perches: [
          { x: -16.8, y: Y_GARDEN, z: -15.2, rotY: 1.1 },
          { x: -11.0, y: Y_GARDEN, z: -8.6, rotY: -0.5 },
        ],
      },
      {
        id: 'bw_bumblebee',
        builder: buildBumblebee,
        kind: 'flyer',
        canFly: true,
        radius: 0.42,
        height: 0.72,
        scale: 1.04,
        speed: 4.9,
        orbitCx: 13.5,
        orbitCz: -14.8,
        orbitRx: 6.2,
        orbitRz: 4.4,
        orbitY: Y_BENCH + 3.2,
        bobY: 0.55,
        orbitSpeed: 0.44,
        phase: 4.0,
        callType: 'bee',
        perches: [
          { x: 11.4, y: Y_BENCH, z: -14.0, rotY: 0.6 },
          { x: 17.8, y: Y_BENCH, z: -12.4, rotY: -1.4 },
        ],
      },
      // 2 Jewel Dragonflies patrolling Dewdrop Stream & High Conservatory Shelf
      {
        id: 'bw_dragonfly',
        builder: (T) => buildDragonflyVariant(T, 'teal'),
        kind: 'flyer',
        canFly: true,
        radius: 0.44,
        height: 0.72,
        scale: 1.0,
        speed: 6.0,
        figure8: true,
        orbitCx: 2.0,
        orbitCz: 14.5,
        orbitRx: 12.2,
        orbitRz: 3.4,
        orbitY: Y_GARDEN + 3.4,
        bobY: 0.52,
        orbitSpeed: 0.52,
        phase: 0.9,
        callType: 'dragonfly',
        perches: [
          { x: 6.2, y: Y_GARDEN, z: 11.2, rotY: 2.2 },
          { x: -5.8, y: Y_GARDEN, z: 11.8, rotY: -1.3 },
        ],
      },
      {
        id: 'bw_dragonfly',
        builder: (T) => buildDragonflyVariant(T, 'sapphire'),
        kind: 'flyer',
        canFly: true,
        radius: 0.44,
        height: 0.72,
        scale: 0.96,
        speed: 5.8,
        orbitCx: 9.8,
        orbitCz: -21.2,
        orbitRx: 6.8,
        orbitRz: 5.2,
        orbitY: Y_SHELF + 1.8,
        bobY: 0.65,
        orbitSpeed: 0.48,
        phase: 3.1,
        callType: 'dragonfly',
        perches: [
          { x: 9.2, y: Y_SHELF, z: -24.2, rotY: 0.2 },
          { x: 13.8, y: Y_BENCH, z: -12.2, rotY: 1.8 },
        ],
      },
      // 4 Scurrying Spotted Ladybugs across Plaza, Underground Burrow, Bench & Moss Glade
      {
        id: 'bw_ladybug',
        builder: buildLadybug,
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.55,
        scale: 1.02,
        speed: 2.8,
        callType: 'critter',
        waypoints: [
          { x: -3.8, y: Y_GARDEN, z: -2.2 },
          { x: 3.8, y: Y_GARDEN, z: -2.6 },
          { x: 4.6, y: Y_GARDEN, z: 4.2 },
          { x: -3.4, y: Y_GARDEN, z: 4.6 },
        ],
      },
      {
        id: 'bw_ladybug',
        builder: buildLadybug,
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.55,
        scale: 0.94,
        speed: 2.4,
        callType: 'critter',
        waypoints: [
          { x: -2.6, y: Y_BURROW, z: 22.8 },
          { x: 2.6, y: Y_BURROW, z: 22.8 },
          { x: 2.4, y: Y_BURROW, z: 25.2 },
          { x: -2.4, y: Y_BURROW, z: 25.2 },
        ],
      },
      {
        id: 'bw_ladybug',
        builder: buildLadybug,
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.55,
        scale: 0.98,
        speed: 2.6,
        callType: 'critter',
        waypoints: [
          { x: 8.2, y: Y_BENCH, z: -14.2 },
          { x: 14.2, y: Y_BENCH, z: -13.6 },
          { x: 17.8, y: Y_BENCH, z: -11.4 },
          { x: 11.4, y: Y_BENCH, z: -10.8 },
        ],
      },
      {
        id: 'bw_ladybug',
        builder: buildLadybug,
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.55,
        scale: 0.96,
        speed: 2.7,
        callType: 'critter',
        waypoints: [
          { x: -11.4, y: Y_GARDEN, z: -9.6 },
          { x: -14.8, y: Y_GARDEN, z: -13.2 },
          { x: -9.8, y: Y_GARDEN, z: -14.8 },
          { x: -7.8, y: Y_GARDEN, z: -10.4 },
        ],
      },
    ]);

    // ------------------------------------------------------------------------
    // 14. Bespoke Tinyfolk Hollow Systems:
    //     A. 3 Recessed Mousehole Archways & Underneath-Board Squeeze Slits (`maxR: 0.30`)
    //        + 3 Shrink Sugar Cubes (`0.45×`, 11.5s) & 2 Golden Honey Drops (`1.32×` spd, `1.30×` jump, 10s)
    //     B. Drifting Dandelion Favor Orb + 14m Golden Beacon Light Shafts (zero PointLights!)
    //     C. Brass Faucet Surge Valve, Dewdrop Stream Ferries & Rolling Cat-Eye Marble
    // ------------------------------------------------------------------------
    const markKeep = (obj) => {
      obj.traverse((m) => { if (m.isMesh) m.userData.keep = true; });
      return obj;
    };

    const mhBrickMat = new THREE.MeshStandardMaterial({ color: 0xc97458, roughness: 0.88, metalness: 0 });
    const mhTrimMat = new THREE.MeshStandardMaterial({ color: 0xefe3cb, roughness: 0.78, metalness: 0 });
    const mhOakMat = new THREE.MeshStandardMaterial({ color: 0x7b4c2c, roughness: 0.85, metalness: 0 });
    const mhBrassMat = new THREE.MeshStandardMaterial({ color: 0xe6b84c, roughness: 0.48, metalness: 0 });
    const mhDarkMat = new THREE.MeshBasicMaterial({ color: 0x1b120c, transparent: true, opacity: 0.25, side: THREE.DoubleSide });

    const pushSolidMesh = (mesh) => {
      if (ctx.solids && mesh) ctx.solids.push(mesh);
    };

    const addBoxObb = (gx, gy, gz, rotY, lx, lz, hx, hz, y1, maxR = null) => {
      if (!ctx.addWorldObb) return null;
      const c = Math.cos(rotY), s = Math.sin(rotY);
      const wx = gx + lx * c + lz * s;
      const wz = gz - lx * s + lz * c;
      const b = ctx.addWorldObb(wx, wz, hx, hz, rotY, gy, gy + y1, false);
      if (b) {
        b.noJump = true;
        if (maxR !== null) b.maxR = maxR;
      }
      return b;
    };

    // Mousehole #1: West Biscuit/Sewing Alley Recessed Mousehole Archway (`(-14.6, Y_GARDEN, -0.6)`, `maxR: 0.30`)
    {
      const gx = -14.6, gy = Y_GARDEN, gz = -0.6, rotY = PI / 2;
      const grp = new THREE.Group();
      grp.position.set(gx, gy, gz);
      grp.rotation.y = rotY;
      for (const sx of [-2.45, 2.45]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(2.90, 2.45, 0.92), mhBrickMat);
        pier.position.set(sx, 1.225, 0);
        pier.castShadow = true;
        pier.receiveShadow = true;
        grp.add(pier);
        pushSolidMesh(pier);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.48, 0.78), mhTrimMat);
      lintel.position.set(0, 1.72, 0);
      lintel.castShadow = true;
      grp.add(lintel);
      pushSolidMesh(lintel);
      const archRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.16, 8, 16, PI), mhOakMat);
      archRing.position.set(0, 0.56, 0);
      grp.add(archRing);
      const veil = new THREE.Mesh(new THREE.CircleGeometry(0.60, 12, 0, PI), mhDarkMat);
      veil.position.set(0, 0.56, 0.02);
      grp.add(veil);
      for (const sx of [-0.88, 0.88]) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mhBrassMat);
        stud.position.set(sx, 1.38, 0.40);
        grp.add(stud);
      }
      root.add(markKeep(grp));
      addBoxObb(gx, gy, gz, rotY, -2.45, 0, 1.45, 0.48, 2.48, null);
      addBoxObb(gx, gy, gz, rotY, 2.45, 0, 1.45, 0.48, 2.48, null);
      const doorBlk = addBoxObb(gx, gy, gz, rotY, 0, 0, 1.00, 0.46, 2.25, 0.30);
      WORLD_STATE.mouseholes.push({ id: 'bw_mousehole_alley', x: gx, y: gy, z: gz, maxR: 0.30, blocker: doorBlk });
    }

    // Mousehole #2: Potting-Bench Underneath-Board Squeeze Slit (`(13.5, Y_GARDEN, -9.9)`, `maxR: 0.30`)
    // Spans between the Potting Bench front timber legs (`x: 6.95..20.05`, `y1 = Y_GARDEN + 2.65 < Y_BENCH`)!
    {
      const gx = 13.5, gy = Y_GARDEN, gz = -9.9, rotY = 0;
      const grp = new THREE.Group();
      grp.position.set(gx, gy, gz);
      for (const sx of [-4.02, 4.02]) {
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(5.45, 2.65, 0.68), mhTrimMat);
        skirt.position.set(sx, 1.325, 0);
        skirt.castShadow = true;
        skirt.receiveShadow = true;
        grp.add(skirt);
        pushSolidMesh(skirt);
        const kickBoard = new THREE.Mesh(new THREE.BoxGeometry(5.48, 0.24, 0.74), mhOakMat);
        kickBoard.position.set(sx, 0.12, 0);
        grp.add(kickBoard);
      }
      // Low underneath-board squeeze slit header (`y = 0.76..2.65` above ground!)
      const boardHeader = new THREE.Mesh(new THREE.BoxGeometry(2.65, 1.88, 0.68), mhTrimMat);
      boardHeader.position.set(0, 1.71, 0);
      boardHeader.castShadow = true;
      grp.add(boardHeader);
      pushSolidMesh(boardHeader);
      const slitTrim = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.12, 0.78), mhOakMat);
      slitTrim.position.set(0, 0.76, 0);
      grp.add(slitTrim);
      for (const sx of [-1.05, 0, 1.05]) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mhBrassMat);
        stud.position.set(sx, 0.92, 0.37);
        grp.add(stud);
      }
      const slitVeil = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.72), mhDarkMat);
      slitVeil.position.set(0, 0.36, 0);
      grp.add(slitVeil);
      root.add(markKeep(grp));
      addBoxObb(gx, gy, gz, rotY, -4.02, 0, 2.74, 0.40, 2.65, null);
      addBoxObb(gx, gy, gz, rotY, 4.02, 0, 2.74, 0.40, 2.65, null);
      const slitBlk = addBoxObb(gx, gy, gz, rotY, 0, 0, 1.28, 0.46, 2.65, 0.30);
      WORLD_STATE.mouseholes.push({ id: 'bw_mousehole_bench_slit', x: gx, y: gy, z: gz, maxR: 0.30, blocker: slitBlk });
    }

    // Mousehole #3: Underground Secret Burrow Root Pocket Archway (`(-2.18, Y_BURROW, 26.62)`, `maxR: 0.30`)
    // Connects West Burrow chamber straight into Secret Burrow Pocket (`y1 = 2.04 < Y_GARDEN` -> zero overhead collision!)
    {
      const gx = -2.18, gy = Y_BURROW, gz = 26.62, rotY = 0;
      const grp = new THREE.Group();
      grp.position.set(gx, gy, gz);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.86, 0.44), mhOakMat);
      lintel.position.set(0, 1.42, 0);
      grp.add(lintel);
      const archRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.15, 8, 16, PI), mhOakMat);
      archRing.position.set(0, 0.54, 0);
      grp.add(archRing);
      const veil = new THREE.Mesh(new THREE.CircleGeometry(0.60, 12, 0, PI), mhDarkMat);
      veil.position.set(0, 0.54, 0.02);
      grp.add(veil);
      for (const sx of [-0.76, 0.76]) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mhBrassMat);
        stud.position.set(sx, 1.06, 0.24);
        grp.add(stud);
      }
      root.add(markKeep(grp));
      // `gy = 0.25`, so height `1.79` puts top at `2.04 < Y_GARDEN (2.20)` -> zero overhead collision!
      const pocketBlk = addBoxObb(gx, gy, gz, rotY, 0, 0, 0.94, 0.42, 1.79, 0.30);
      WORLD_STATE.mouseholes.push({ id: 'bw_mousehole_burrow_pocket', x: gx, y: gy, z: gz, maxR: 0.30, blocker: pocketBlk });
    }

    // 14B. Super Mario / Tinyfolk Size-Shift Pantry: 3 Sugar Cubes & 2 Golden Honey Drops
    function collectSugarCube(ch, cube) {
      if (!ch || !ch.userData || !cube || cube.cooldown > 0) return null;
      cube.cooldown = PICKUP_RESPAWN;
      if (cube.mesh) cube.mesh.visible = false;
      if (cube.padRing) cube.padRing.material.opacity = 0.22;
      ch.userData.shrink = SHRINK_SCALE;
      ch.userData.colliderScale = SHRINK_SCALE;
      WORLD_STATE.shrinkTimers.set(ch, { remaining: SHRINK_DURATION, total: SHRINK_DURATION, expanding: false });
      if (ctx.spawnPuff) ctx.spawnPuff(new THREE.Vector3(cube.x, cube.y + 0.65, cube.z), 12, 1.4, 0.35, 0.55, 0.65);
      if (ctx.audio) ctx.audio.poof(true);
      const curG = WORLD_STATE.G || (typeof window !== 'undefined' && window.__hs?.G) || null;
      if (ch === curG?.player && ctx.notify) {
        ctx.notify('🧊 Sugar Cube! Shrunk to 0.45× Tinyfolk size for 11.5s — squeeze through Mouseholes!', 2800);
      }
      return '🧊 Shrunk to 0.45× Tinyfolk size for 11.5s — slip straight through Mouseholes!';
    }

    function collectHoneyDrop(ch, honey) {
      if (!ch || !ch.userData || !honey || honey.cooldown > 0) return null;
      honey.cooldown = PICKUP_RESPAWN;
      if (honey.mesh) honey.mesh.visible = false;
      if (honey.padRing) honey.padRing.material.opacity = 0.22;
      WORLD_STATE.honeyTimers.set(ch, { remaining: HONEY_DURATION, total: HONEY_DURATION });
      if (ctx.spawnPuff) ctx.spawnPuff(new THREE.Vector3(honey.x, honey.y + 0.65, honey.z), 12, 1.5, 0.40, 0.55, 0.70);
      if (ctx.audio) ctx.audio.poof(true);
      const curG = WORLD_STATE.G || (typeof window !== 'undefined' && window.__hs?.G) || null;
      if (ch === curG?.player && ctx.notify) {
        ctx.notify('🍯 Golden Honey Drop! 1.32× speed & 1.30× leap boost for 10s!', 2600);
      }
      return '🍯 Golden Honey Boost: 1.32× speed & 1.30× jump for 10s!';
    }

    WORLD_STATE._collectSugar = collectSugarCube;
    WORLD_STATE._collectHoney = collectHoneyDrop;

    const sugarSpecs = [
      { id: 'bw_sugar_willow', x: -4.8, y: Y_GARDEN, z: -5.8, label: 'Eat Willow-Plate Sugar Cube (G)' },
      { id: 'bw_sugar_burrow', x: -12.2, y: Y_GARDEN, z: 21.6, label: 'Eat Burrow-Rim Sugar Cube (G)' },
      { id: 'bw_sugar_teacup', x: 7.6, y: Y_BENCH, z: -12.8, label: 'Eat Teacup-Table Sugar Cube (G)' },
    ];
    for (const sp of sugarSpecs) {
      const built = buildSugarCubePickup(THREE);
      built.group.position.set(sp.x, sp.y, sp.z);
      root.add(built.group);
      WORLD_STATE.sugarCubes.push({
        id: sp.id,
        kind: 'mechanism',
        mechType: 'sugar_cube',
        icon: '🧊',
        label: sp.label,
        x: sp.x,
        y: sp.y,
        z: sp.z,
        interactRadius: 2.25,
        cooldown: 0,
        mesh: built.hover,
        padRing: built.padRing,
        crystals: built.crystals,
        group: built.group,
      });
    }

    const honeySpecs = [
      { id: 'bw_honey_garden', x: 6.2, y: Y_GARDEN, z: 8.2, label: 'Sip Garden Golden Honey Drop (G)' },
      { id: 'bw_honey_bench', x: 11.2, y: Y_BENCH, z: -16.4, label: 'Sip Bench Golden Honey Drop (G)' },
    ];
    for (const sp of honeySpecs) {
      const built = buildHoneyDropPickup(THREE);
      built.group.position.set(sp.x, sp.y, sp.z);
      root.add(built.group);
      WORLD_STATE.honeyDrops.push({
        id: sp.id,
        kind: 'mechanism',
        mechType: 'honey_drop',
        icon: '🍯',
        label: sp.label,
        x: sp.x,
        y: sp.y,
        z: sp.z,
        interactRadius: 2.25,
        cooldown: 0,
        mesh: built.hover,
        padRing: built.padRing,
        specks: built.specks,
        aura: built.aura,
        group: built.group,
      });
    }

    const trySafeNudgeForFullSize = (ch, fullR, footY) => {
      const ox = ch.position.x, oz = ch.position.z;
      if (!ctx.blockedAt || !ctx.blockedAt(ox, oz, fullR, footY)) return true;
      const radii = [0.38, 0.72, 1.08, 1.45];
      const dirs = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707],
      ];
      for (let ri = 0; ri < radii.length; ri++) {
        const dist = radii[ri];
        for (let di = 0; di < dirs.length; di++) {
          const nx = ox + dirs[di][0] * dist;
          const nz = oz + dirs[di][1] * dist;
          if (Math.hypot(nx, nz) > 33.4) continue;
          const ny = sampleTinyfolkHeight(nx, nz, footY);
          if (Math.abs(ny - footY) > 0.72) continue;
          if (!ctx.blockedAt(nx, nz, fullR, ny)) {
            ch.position.x = nx;
            ch.position.z = nz;
            ch.userData.groundY = ny;
            return true;
          }
        }
      }
      return false;
    };

    // 14C. Genshin Windtrace Drifting Dandelion Favor Orb & 14m Additive Beacon Light Shafts
    const builtOrb = buildDandelionFavorOrb(THREE);
    builtOrb.group.position.set(4.35, Y_GARDEN + 1.10, 0);
    builtOrb.groundRing.position.set(4.35, Y_GARDEN + 0.04, 0);
    root.add(builtOrb.group);
    root.add(builtOrb.groundRing);
    WORLD_STATE.favorOrb = {
      active: true,
      cooldown: 0,
      phase: 0,
      group: builtOrb.group,
      aura: builtOrb.aura,
      ringA: builtOrb.ringA,
      ringB: builtOrb.ringB,
      tufts: builtOrb.tufts,
      groundRing: builtOrb.groundRing,
    };

    // Pre-allocate 6 Golden Beacon Light Shafts (zero PointLights!)
    for (let i = 0; i < 6; i++) {
      const shaft = buildGoldenBeaconShaft(THREE);
      root.add(shaft.group);
      WORLD_STATE.favorBeacons.push({ ...shaft, target: null, remaining: 0 });
    }

    function captureFavorOrb(ch, activeG, simNowMs) {
      const fo = WORLD_STATE.favorOrb;
      if (!fo || !fo.active || !ch || !ch.userData) return;
      fo.active = false;
      fo.cooldown = FAVOR_RESPAWN;
      if (fo.group) fo.group.visible = false;
      if (fo.groundRing) fo.groundRing.visible = false;

      const orbPos = fo.group ? fo.group.position.clone() : new THREE.Vector3(0, Y_GARDEN + 1.1, 0);
      if (ctx.splash) ctx.splash(orbPos, 20, 2.2);
      if (ctx.spawnPuff) ctx.spawnPuff(orbPos, 14, 1.6, 0.42, 0.6, 0.7);
      if (ctx.audio) ctx.audio.poof(true);

      const u = ch.userData;
      const isSeeker = u.actor?.team === 'seekers' ||
        (activeG?.seekers || []).includes(ch) ||
        (activeG?.allSeekers || []).includes(ch) ||
        (ch === activeG?.player && activeG?.mode === 'seek');

      if (!isSeeker) {
        u._windCloakUntil = simNowMs + FAVOR_CLOAK_MS;
        if (ctx.notify) {
          if (ch === activeG?.player) {
            ctx.notify('🌼 Dandelion Favor! Phantom Camo (24% stealth) + 1.22× speed for 7.5s!', 3000);
          } else if (activeG?.mode === 'hide') {
            ctx.notify('🌼 Ally Hider claimed the Dandelion Favor Orb — Phantom Camo active!', 2200);
          }
        }
      } else {
        const hidersRaw = (activeG?.allHiders && activeG.allHiders.length)
          ? activeG.allHiders
          : [activeG?.mode === 'hide' ? activeG.player : null, ...(activeG?.hiders || [])].filter(Boolean);
        const livingHiders = hidersRaw.filter((h) => h && !h.userData?.actor?.eliminated && h.userData?.ai?.state !== 'eliminated');
        while (WORLD_STATE.favorBeacons.length < livingHiders.length) {
          const shaft = buildGoldenBeaconShaft(THREE);
          root.add(shaft.group);
          WORLD_STATE.favorBeacons.push({ ...shaft, target: null, remaining: 0 });
        }
        for (let i = 0; i < WORLD_STATE.favorBeacons.length; i++) {
          const b = WORLD_STATE.favorBeacons[i];
          if (i < livingHiders.length) {
            const targetH = livingHiders[i];
            b.target = targetH;
            b.remaining = FAVOR_BEACON_SEC;
            const ty = (targetH.userData?.groundY ?? targetH.position.y) + (targetH.userData?.jy || 0);
            b.group.position.set(targetH.position.x, ty, targetH.position.z);
            b.group.visible = true;
            b.innerMat.opacity = 0.72;
            b.outerMat.opacity = 0.34;
            b.baseRing.material.opacity = 0.75;
          } else {
            b.target = null;
            b.remaining = 0;
            b.group.visible = false;
          }
        }
        if (ctx.notify) {
          ctx.notify(
            ch === activeG?.player
              ? '🌟 Favor Orb Claimed! Golden Beacon Light Shafts reveal Hiders for 3.8s!'
              : '🌟 Seeker claimed the Dandelion Favor Orb — Golden Beacons reveal Hiders for 3.8s!',
            2900
          );
        }
      }
    }

    // 14D. Interactive Brass Garden Faucet Flood Valve
    const faucetValveGroup = new THREE.Group();
    faucetValveGroup.position.set(-2.4, Y_GARDEN, 1.8);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xb56d3d, roughness: 0.55, metalness: 0 });
    const faucetPed = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 0.92, 12), pipeMat);
    faucetPed.position.y = 0.46;
    faucetValveGroup.add(faucetPed);
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 1.02, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 8, 18), mhBrassMat);
    rim.rotation.x = PI / 2;
    wheelGroup.add(rim);
    for (let k = 0; k < 2; k++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.80, 6), mhBrassMat);
      spoke.rotation.z = PI / 2;
      spoke.rotation.y = (k * PI) / 2;
      wheelGroup.add(spoke);
    }
    faucetValveGroup.add(wheelGroup);
    root.add(markKeep(faucetValveGroup));
    if (ctx.block) ctx.block(-2.4, 1.8, 0.48);
    WORLD_STATE.faucetWheel = wheelGroup;

    const jetMat = new THREE.MeshStandardMaterial({
      color: 0x8ae8ff,
      emissive: 0x52c8ec,
      emissiveIntensity: 0.45,
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
    });
    const faucetJet = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.44, 1.65, 14, 1, true), jetMat);
    faucetJet.position.set(pondPos.x, Y_GARDEN + 1.38, pondPos.z + 0.18);
    faucetJet.visible = false;
    root.add(markKeep(faucetJet));
    WORLD_STATE.faucetJet = faucetJet;

    const sprinklerMat = new THREE.MeshStandardMaterial({
      color: 0xb0f2ff,
      emissive: 0x52c8ec,
      emissiveIntensity: 0.25,
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const sprGrp = new THREE.Group();
    for (const z of splashZones) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, 7.6, 14, 1, true), sprinklerMat);
      cone.position.set(z.x, Y_GARDEN + 4.2, z.z);
      sprGrp.add(cone);
    }
    sprGrp.visible = false;
    root.add(markKeep(sprGrp));
    WORLD_STATE.sprinklerGroup = sprGrp;

    const soapFoamMat = new THREE.MeshBasicMaterial({
      color: 0xf4fcff,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    });
    const soapFoamDisc = new THREE.Mesh(new THREE.RingGeometry(1.8, 4.75, 36), soapFoamMat);
    soapFoamDisc.rotation.x = -PI / 2;
    soapFoamDisc.position.set(0.0, Y_GARDEN + 0.032, 1.55);
    soapFoamDisc.visible = false;
    root.add(markKeep(soapFoamDisc));

    const faucetMechSpot = {
      id: 'bw_faucet_valve',
      kind: 'mechanism',
      icon: '🚰',
      label: 'Crank Brass Faucet Surge Wheel (G)',
      x: -2.4,
      y: Y_GARDEN,
      z: 1.8,
      interactRadius: 2.75,
      lastTriggered: -99,
    };
    WORLD_STATE.mechanisms.push(faucetMechSpot);

    WORLD_STATE._triggerFaucetFx = () => {
      if (ctx.splash) ctx.splash(new THREE.Vector3(pondPos.x, Y_GARDEN + 0.7, pondPos.z), 20, 2.2);
      if (ctx.audio) ctx.audio.splash();
      ctx.emitSoundCue({ x: pondPos.x, y: Y_GARDEN, z: pondPos.z }, 24, 'splashed', null);
    };

    // 14E. Dewdrop Stream Conveyor Current + 2 Walnut-Shell Boat Ferries & Carrier Spools (`tracks`)
    const spoolWoodMat = new THREE.MeshStandardMaterial({ color: 0xc28a52, roughness: 0.82, metalness: 0 });
    const threadRedMat = new THREE.MeshStandardMaterial({ color: 0xd94848, roughness: 0.72, metalness: 0 });
    tracks.addConveyorSegment({
      x0: -26,
      z0: 14.5,
      x1: 26,
      z1: 14.5,
      y: Y_GARDEN + 0.03,
      width: 3.4,
      speed: 2.25,
      getDirSign: () => (WORLD_STATE.faucetSurgeTimer > 0 ? -2.0 : 1.0),
    });

    const walnutMat = new THREE.MeshStandardMaterial({ color: 0x7d4c29, roughness: 0.84, metalness: 0 });
    const sailLeafMat = new THREE.MeshStandardMaterial({ color: 0x86c959, roughness: 0.72, metalness: 0, side: THREE.DoubleSide });
    const buildWalnutBoat = () => {
      const bg = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 8, 0, TAU, PI * 0.5, PI * 0.5), walnutMat);
      hull.scale.set(1.22, 0.52, 0.86);
      hull.position.y = 0.24;
      bg.add(hull);
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.08, 14), spoolWoodMat);
      deck.scale.set(1.16, 1, 0.82);
      deck.position.y = 0.22;
      deck.userData.ground = true;
      bg.add(deck);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.35, 6), spoolWoodMat);
      mast.position.set(0.18, 0.88, 0);
      bg.add(mast);
      const sail = new THREE.Mesh(new THREE.CircleGeometry(0.55, 8, 0, PI), sailLeafMat);
      sail.position.set(0.18, 1.02, 0.05);
      bg.add(sail);
      root.add(markKeep(bg));
      return bg;
    };
    const walnutBoats = [
      { mesh: buildWalnutBoat(), xMin: 5.0, xMax: 14.4, speed: 0.42, phase: 0.0 },
      { mesh: buildWalnutBoat(), xMin: -18.0, xMax: -9.2, speed: 0.48, phase: PI },
    ];
    WORLD_STATE.walnutBoats = walnutBoats;
    for (const wb of walnutBoats) {
      const posFn = (t) => {
        const s = 0.5 + 0.5 * Math.sin(t * wb.speed + wb.phase);
        const bx = wb.xMin + s * (wb.xMax - wb.xMin);
        return { x: bx, y: Y_GARDEN, z: streamZAt(bx) };
      };
      const yawFn = (t) => Math.cos(t * wb.speed + wb.phase) >= 0 ? 0 : PI;
      wb.posFn = posFn;
      wb.yawFn = yawFn;
      tracks.addDeckPlatform({
        posFn,
        hx: 1.06,
        hz: 0.84,
        heightY: 0.24,
        yawFn,
      });
    }

    const carrierSpool = new THREE.Group();
    const csBody = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.55, 12), threadRedMat);
    csBody.position.y = 0.34;
    carrierSpool.add(csBody);
    root.add(markKeep(carrierSpool));
    tracks.addCarrierProp(
      carrierSpool,
      (t) => ({ x: -16.8 + Math.cos(t * 0.4) * 2.2, y: Y_GARDEN, z: -18.5 + Math.sin(t * 0.4) * 2.0, yaw: t * 0.4 + PI / 2 }),
      0
    );

    const carrierButton = new THREE.Group();
    const cbDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 14), mhBrassMat);
    cbDisc.position.y = 0.24;
    carrierButton.add(cbDisc);
    root.add(markKeep(carrierButton));
    tracks.addCarrierProp(
      carrierButton,
      (t) => ({ x: 16.5 + Math.cos(t * 0.45) * 2.2, y: Y_GARDEN, z: 19.8 + Math.sin(t * 0.45) * 2.0, yaw: -t * 0.45 }),
      1.6
    );

    // 14F. Giant Rolling Cat-Eye Glass Marble (Activated on Mid-Round `G.t <= 72` Hazard Event!)
    const marbleGrp = new THREE.Group();
    const marbleOuterMat = new THREE.MeshStandardMaterial({
      color: 0xaaf5ec,
      emissive: 0x3eb8a8,
      emissiveIntensity: 0.22,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
    });
    const marbleCoreMat = new THREE.MeshStandardMaterial({
      color: 0x169c6d,
      emissive: 0x0b5238,
      emissiveIntensity: 0.35,
      roughness: 0.32,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const mSphere = new THREE.Mesh(new THREE.SphereGeometry(0.92, 20, 14), marbleOuterMat);
    marbleGrp.add(mSphere);
    for (let k = 0; k < 3; k++) {
      const vane = new THREE.Mesh(new THREE.CircleGeometry(0.76, 14), marbleCoreMat);
      vane.rotation.y = (k * PI) / 3;
      marbleGrp.add(vane);
    }
    marbleGrp.position.set(11.8, Y_GARDEN + 0.92, 0);
    marbleGrp.visible = false;
    root.add(markKeep(marbleGrp));
    WORLD_STATE.rollingMarble = marbleGrp;
    WORLD_STATE._soapFoamDisc = soapFoamDisc;

    // Final safety pass ensuring 100% zero metalness across the entire built Tinyfolk scene!
    enforceZeroMetalness(root);

    const watchGears = workshopGroup ? workshopGroup.getObjectByName('watchGears') : null;
    let elapsed = 0;

    return {
      turret: null,
      dispose() {
        if (WORLD_STATE.creatures && WORLD_STATE.creatures.dispose) {
          WORLD_STATE.creatures.dispose();
        }
        WORLD_STATE.creatures = null;
        WORLD_STATE.turret = null;
        WORLD_STATE.antTunnels = [];
        WORLD_STATE.amanitaPads = [];
        WORLD_STATE.clothespinCatapults = [];
        WORLD_STATE.mechanisms = [];
        WORLD_STATE.sugarCubes = [];
        WORLD_STATE.honeyDrops = [];
        WORLD_STATE.shrinkTimers.clear();
        WORLD_STATE.honeyTimers.clear();
        WORLD_STATE.mouseholes = [];
        WORLD_STATE.seesaw = null;
        WORLD_STATE.rulerMesh = null;
        WORLD_STATE.favorOrb = null;
        WORLD_STATE.favorBeacons = [];
        WORLD_STATE.tracks = null;
      },
      update(dt = 0.016, now, G) {
        if (G) WORLD_STATE.G = G;
        const safeDt = Math.min(dt || 0.016, 0.05);
        elapsed = typeof now === 'number' ? now : elapsed + dt;
        WORLD_STATE.elapsed = elapsed;
        WORLD_STATE.simNowMs = typeof now === 'number' ? now * 1000 : (WORLD_STATE.simNowMs + safeDt * 1000);
        if (WORLD_STATE.creatures && dt > 0) WORLD_STATE.creatures.update(dt, elapsed);

        // 1. Stream shader & swaying grass blades
        streamWater.update(elapsed);
        grassBlades.update(elapsed);

        // 2. Swaying 5m shamrock clovers & giant daisies
        for (let i = 0; i < swayingCrowns.length; i++) {
          const sc = swayingCrowns[i];
          sc.obj.rotation.z = Math.sin(elapsed * 1.25 + sc.phase) * sc.amp;
          sc.obj.rotation.x = Math.cos(elapsed * 0.95 + sc.phase) * sc.amp * 0.65;
        }

        // 3. Ticking open-gear brass pocket watch & workshop clockwork wall
        if (watchGears) {
          const tick = elapsed * 0.85 + Math.sin(elapsed * 5.2) * 0.09;
          for (let i = 0; i < watchGears.children.length; i++) {
            const gear = watchGears.children[i];
            const sp = gear.userData.speed || 1;
            if (Math.abs(gear.rotation.y) > 0.5) gear.rotation.x = tick * sp;
            else gear.rotation.z = tick * sp;
          }
        }

        // 4. Bouncy Red Amanita Mushroom Cap Squash & Elastic Spring Rebound!
        for (let i = 0; i < WORLD_STATE.amanitaPads.length; i++) {
          const pad = WORLD_STATE.amanitaPads[i];
          if (!pad.capGroup) continue;
          if (pad.squash > 0.002) {
            pad.squash = Math.max(0, pad.squash - safeDt * 1.65);
            const tNorm = 1 - pad.squash;
            let sy = 1;
            if (tNorm < 0.24) {
              // Fast compression squash on impact
              sy = 1 - 0.44 * Math.sin((tNorm / 0.24) * (PI / 2));
            } else {
              // Elastic stretch & damped spring rebound
              const rt = tNorm - 0.24;
              sy = 1 + 0.34 * Math.exp(-rt * 4.5) * Math.sin(rt * 18.0);
            }
            const sxz = 1 / Math.sqrt(Math.max(0.45, sy));
            pad.capGroup.scale.set(sxz, sy, sxz);
            pad.capGroup.position.y = 0.48 - (1 - sy) * 0.20;
          } else {
            const breath = Math.sin(elapsed * 2.2 + i) * 0.02;
            pad.capGroup.scale.set(1 + breath, 1 - breath, 1 + breath);
            pad.capGroup.position.y = 0.48;
          }
        }

        // 4B. Spring Clothespin Catapult recoil animation
        for (let i = 0; i < WORLD_STATE.clothespinCatapults.length; i++) {
          const cat = WORLD_STATE.clothespinCatapults[i];
          if (!cat.armPivot) continue;
          if (cat.springAnim > 0.002) {
            cat.springAnim = Math.max(0, cat.springAnim - safeDt * 1.9);
            const prog = 1 - cat.springAnim;
            cat.armPivot.rotation.z = Math.sin(prog * PI * 2.5) * cat.springAnim * 0.68;
          } else {
            cat.armPivot.rotation.z = 0;
          }
        }

        const activeG = WORLD_STATE.G || (typeof window !== 'undefined' && window.__hs && window.__hs.G) || null;
        const actorSet = new Set();
        if (activeG) {
          if (activeG.player) actorSet.add(activeG.player);
          for (const h of (activeG.hiders || [])) if (h) actorSet.add(h);
          for (const s of (activeG.seekers || [])) if (s) actorSet.add(s);
          for (const h of (activeG.allHiders || [])) if (h) actorSet.add(h);
          for (const s of (activeG.allSeekers || [])) if (s) actorSet.add(s);
        }
        if (ctx.getActors) {
          for (const a of (ctx.getActors() || [])) if (a) actorSet.add(a);
        }
        const actors = Array.from(actorSet);
        const livePlay = !!(activeG && activeG.phase !== 'menu' && activeG.phase !== 'vs' && !activeG.over);

        // 4C. Giant 11m Physical Tilting 30cm Seesaw Ruler (`rulerMesh.rotation.z` ∈ [-0.34, +0.34])
        const ss = WORLD_STATE.seesaw;
        if (ss && ss.mesh) {
          let torque = 0;
          let loadCount = 0;
          for (let i = 0; i < actors.length; i++) {
            const act = actors[i];
            const u = act?.userData;
            if (!u || u.actor?.eliminated || u.ai?.state === 'eliminated' || u.specialMode || u.ridePath || u.rideRail || u.inTurret) continue;
            const dx = act.position.x - ss.cx;
            const dz = act.position.z - ss.cz;
            const maxSpanX = ss.halfL * Math.cos(ss.tilt);
            if (Math.abs(dx) > maxSpanX + 0.18 || Math.abs(dz) > ss.halfW + 0.18) continue;
            const deckY = Math.max(Y_GARDEN + 0.04, ss.cy + dx * Math.tan(ss.tilt));
            const footY = (u.groundY ?? act.position.y) + (u.jy || 0);
            if (Math.abs(footY - deckY) > 0.65 || (u.jy || 0) > 0.35) continue;
            loadCount++;
            if (Math.abs(dx) > 0.22) {
              const lever = clamp(-dx / ss.halfL, -1, 1);
              const weight = (u.colliderScale && u.colliderScale < 0.8) ? 0.55 : 1.0;
              torque += lever * weight;
            }
          }
          const targetTilt = loadCount > 0 ? clamp(torque * 0.95, -0.34, 0.34) : ss.restTilt;
          const stiffness = loadCount > 0 ? 4.2 : 1.7;
          const damping = 3.4;
          const acc = (targetTilt - ss.tilt) * stiffness - ss.vel * damping;
          ss.vel += acc * safeDt;
          ss.tilt = clamp(ss.tilt + ss.vel * safeDt, -0.34, 0.34);
          if (ss.tilt === -0.34 || ss.tilt === 0.34) ss.vel *= 0.25;
          ss.mesh.rotation.z = ss.tilt;
          if (ss.spool) ss.spool.rotation.z = ss.tilt * 1.45;
        }

        // 4D. Size-Shift Pantry: Sugar Cubes, Golden Honey Drops, Shrink & Honey Timers!
        for (let i = 0; i < WORLD_STATE.sugarCubes.length; i++) {
          const sc = WORLD_STATE.sugarCubes[i];
          if (sc.cooldown > 0) {
            sc.cooldown = Math.max(0, sc.cooldown - safeDt);
            if (sc.cooldown === 0) {
              if (sc.mesh) sc.mesh.visible = true;
              if (sc.padRing) sc.padRing.material.opacity = 0.55;
            }
          }
          if (sc.mesh && sc.mesh.visible) {
            sc.mesh.position.y = 0.68 + Math.sin(elapsed * 2.6 + i * 1.3) * 0.12;
            sc.mesh.rotation.y = elapsed * 1.25 + i;
            if (sc.crystals) {
              for (let c = 0; c < sc.crystals.length; c++) {
                const cr = sc.crystals[c];
                const ca = (c / sc.crystals.length) * TAU + elapsed * 2.1;
                cr.position.set(Math.cos(ca) * 0.48, Math.sin(elapsed * 3.0 + c) * 0.16, Math.sin(ca) * 0.48);
                cr.rotation.y = elapsed * 2.5;
              }
            }
            if (livePlay) {
              for (let a = 0; a < actors.length; a++) {
                const ch = actors[a];
                const u = ch?.userData;
                if (!u || u.actor?.eliminated || u.ai?.state === 'eliminated' || u._localSkyDrop || u.specialMode || u.ridePath || u.rideRail || u.inTurret) continue;
                const footY = (u.groundY ?? ch.position.y) + (u.jy || 0);
                if (Math.abs(footY - sc.y) <= 1.35 && Math.hypot(ch.position.x - sc.x, ch.position.z - sc.z) <= 1.35) {
                  collectSugarCube(ch, sc);
                  break;
                }
              }
            }
          }
        }

        for (let i = 0; i < WORLD_STATE.honeyDrops.length; i++) {
          const hd = WORLD_STATE.honeyDrops[i];
          if (hd.cooldown > 0) {
            hd.cooldown = Math.max(0, hd.cooldown - safeDt);
            if (hd.cooldown === 0) {
              if (hd.mesh) hd.mesh.visible = true;
              if (hd.padRing) hd.padRing.material.opacity = 0.55;
            }
          }
          if (hd.mesh && hd.mesh.visible) {
            hd.mesh.position.y = 0.72 + Math.sin(elapsed * 2.4 + i * 1.9) * 0.12;
            hd.mesh.rotation.y = -elapsed * 1.1 + i;
            if (hd.aura) hd.aura.scale.setScalar(1 + Math.sin(elapsed * 3.8 + i) * 0.10);
            if (hd.specks) {
              for (let k = 0; k < hd.specks.length; k++) {
                const ka = (k / hd.specks.length) * TAU - elapsed * 2.2;
                hd.specks[k].position.set(Math.cos(ka) * 0.44, Math.sin(elapsed * 3.2 + k) * 0.14, Math.sin(ka) * 0.44);
              }
            }
            if (livePlay) {
              for (let a = 0; a < actors.length; a++) {
                const ch = actors[a];
                const u = ch?.userData;
                if (!u || u.actor?.eliminated || u.ai?.state === 'eliminated' || u._localSkyDrop || u.specialMode || u.ridePath || u.rideRail || u.inTurret) continue;
                const footY = (u.groundY ?? ch.position.y) + (u.jy || 0);
                if (Math.abs(footY - hd.y) <= 1.35 && Math.hypot(ch.position.x - hd.x, ch.position.z - hd.z) <= 1.35) {
                  collectHoneyDrop(ch, hd);
                  break;
                }
              }
            }
          }
        }

        for (const [ch, st] of WORLD_STATE.shrinkTimers.entries()) {
          const u = ch?.userData;
          if (!ch || !u || u.actor?.eliminated || u.ai?.state === 'eliminated') {
            if (u) u.colliderScale = 1;
            WORLD_STATE.shrinkTimers.delete(ch);
            continue;
          }
          if (!st.expanding) {
            st.remaining -= safeDt;
            u.shrink = SHRINK_SCALE;
            u.colliderScale = SHRINK_SCALE;
            if (st.remaining <= 0) {
              const footY = (u.groundY ?? ch.position.y) + (u.jy || 0);
              const fullR = u.radius || 0.45;
              if (trySafeNudgeForFullSize(ch, fullR, footY)) {
                st.expanding = true;
                u.colliderScale = 1;
                if (ch === activeG?.player && ctx.notify) {
                  ctx.notify('✨ Sugar Cube wore off — growing back to full size!', 1600);
                }
              } else {
                st.remaining = 0;
                u.shrink = SHRINK_SCALE;
                u.colliderScale = SHRINK_SCALE;
              }
            }
          } else {
            u.colliderScale = 1;
            u.shrink = Math.min(1, (u.shrink ?? SHRINK_SCALE) + safeDt * 2.8);
            if (u.shrink >= 0.995) {
              u.shrink = 1;
              WORLD_STATE.shrinkTimers.delete(ch);
            }
          }
        }

        for (const [ch, ht] of WORLD_STATE.honeyTimers.entries()) {
          const u = ch?.userData;
          if (!ch || !u || u.actor?.eliminated || u.ai?.state === 'eliminated') {
            WORLD_STATE.honeyTimers.delete(ch);
            continue;
          }
          ht.remaining -= safeDt;
          if (ht.remaining <= 0) {
            WORLD_STATE.honeyTimers.delete(ch);
            if (ch === activeG?.player && ctx.notify) {
              ctx.notify('🍯 Golden Honey boost wore off.', 1200);
            }
          }
        }

        // 4E. Genshin Windtrace Drifting Dandelion Favor Orb & Golden Beacon Shafts
        const fo = WORLD_STATE.favorOrb;
        if (fo) {
          if (!fo.active) {
            fo.cooldown = Math.max(0, fo.cooldown - safeDt);
            if (fo.cooldown === 0) {
              fo.active = true;
              if (fo.group) fo.group.visible = true;
              if (fo.groundRing) fo.groundRing.visible = true;
              if (livePlay && ctx.notify) {
                ctx.notify('🌼 A Dandelion Favor Orb appeared above Willow-Plate Plaza!', 2200);
              }
            }
          }
          if (fo.active && fo.group) {
            fo.phase += safeDt * 0.48;
            const rad = 4.35 + Math.sin(fo.phase * 1.1) * 0.65;
            const ox = Math.cos(fo.phase) * rad;
            const oz = Math.sin(fo.phase) * rad;
            const oy = Y_GARDEN + 1.10 + Math.sin(elapsed * 2.4) * 0.14;
            fo.group.position.set(ox, oy, oz);
            fo.ringA.rotation.y = elapsed * 1.4;
            fo.ringA.rotation.x = Math.sin(elapsed * 0.9) * 0.35;
            fo.ringB.rotation.z = -elapsed * 1.7;
            fo.aura.scale.setScalar(1 + Math.sin(elapsed * 4.2) * 0.12);
            for (let tIdx = 0; tIdx < fo.tufts.length; tIdx++) {
              const ta = (tIdx / fo.tufts.length) * TAU + elapsed * 1.9;
              fo.tufts[tIdx].position.set(Math.cos(ta) * 0.72, Math.sin(elapsed * 3.0 + tIdx) * 0.22, Math.sin(ta) * 0.72);
            }
            if (fo.groundRing) {
              fo.groundRing.position.set(ox, Y_GARDEN + 0.04, oz);
              fo.groundRing.scale.setScalar(1 + Math.sin(elapsed * 4.0) * 0.14);
            }

            if (livePlay) {
              for (let a = 0; a < actors.length; a++) {
                const ch = actors[a];
                const u = ch?.userData;
                if (!u || u.actor?.eliminated || u.ai?.state === 'eliminated' || u._localSkyDrop || u.specialMode || u.ridePath || u.rideRail || u.inTurret) continue;
                const footY = (u.groundY ?? ch.position.y) + (u.jy || 0);
                if (Math.abs(footY - Y_GARDEN) <= 1.65 && Math.hypot(ch.position.x - ox, ch.position.z - oz) <= 1.45) {
                  captureFavorOrb(ch, activeG, WORLD_STATE.simNowMs);
                  break;
                }
              }
            }
          }
        }

        for (let i = 0; i < WORLD_STATE.favorBeacons.length; i++) {
          const b = WORLD_STATE.favorBeacons[i];
          if (b.remaining > 0 && b.target && !b.target.userData?.actor?.eliminated && b.target.userData?.ai?.state !== 'eliminated') {
            b.remaining = Math.max(0, b.remaining - safeDt);
            if (b.remaining === 0) {
              b.target = null;
              b.group.visible = false;
            } else {
              const tu = b.target.userData;
              const ty = (tu.groundY ?? b.target.position.y) + (tu.jy || 0);
              b.group.position.set(b.target.position.x, ty, b.target.position.z);
              b.group.rotation.y += safeDt * 1.8;
              const fade = clamp(b.remaining / 0.65, 0, 1);
              b.innerMat.opacity = 0.72 * fade;
              b.outerMat.opacity = 0.34 * fade;
              b.baseRing.material.opacity = 0.75 * fade;
            }
          } else if (b.group && b.group.visible) {
            b.remaining = 0;
            b.target = null;
            b.group.visible = false;
          }
        }

        // 5. Giant Falling Conservatory Faucet Water Drops (`every 4.5s` + Splash-Reveal Hazard!)
        const hazardCycle = 4.5;
        const impactU = 0.56;

        for (let i = 0; i < hazardDrops.length; i++) {
          const hd = hazardDrops[i];
          const z = hd.zone;
          const u = (((elapsed / hazardCycle) + z.phase) % 1 + 1) % 1;

          // Detect impact crossing `impactU` cleanly
          const crossedImpact = hd.lastU >= 0 && (
            (hd.lastU < impactU && u >= impactU) ||
            (hd.lastU > u && (hd.lastU < impactU || u >= impactU))
          );
          hd.lastU = u;

          if (crossedImpact) {
            hd.impactCount++;
            if (activeG && activeG.player && activeG.phase !== 'menu' && !activeG.over) {
              const p = activeG.player;
              const pFootY = (p.userData.groundY ?? p.position.y) + (p.userData.jy || 0);
              const dist = Math.hypot(p.position.x - z.x, p.position.z - z.z);
              if (dist <= 2.1 && Math.abs(pFootY - z.impactY) <= 2.2) {
                WORLD_STATE.splashAlerts++;
                ctx.notify('💧 SPLASH! A giant faucet drop soaked your hiding spot — seekers alerted!', 2400);
                for (const s of (activeG.seekers || [])) {
                  if (!s) continue;
                  if (Math.hypot(s.position.x - z.x, s.position.z - z.z) <= 22.0) {
                    if (s.userData.ai) s.userData.ai.sus = Math.max(s.userData.ai.sus || 0, 0.85);
                    s.userData.sus = Math.max(s.userData.sus || 0, 0.85);
                  }
                }
              }
            }
          }

          if (u < 0.28) {
            const k = u / 0.28;
            const swell = 0.32 + k * 0.88;
            hd.sphere.visible = true;
            hd.sphere.position.set(z.x, z.startY - k * 0.18, z.z);
            hd.sphere.scale.set(swell * 0.92, swell * 1.18, swell * 0.92);
            hd.ringOuter.visible = true;
            hd.ringOuter.scale.setScalar(0.55 + Math.sin(k * PI) * 0.25);
            hd.ringOuter.material.opacity = 0.22 * k;
            hd.ringInner.visible = false;
            hd.crownGroup.visible = false;
          } else if (u < impactU) {
            const fk = (u - 0.28) / (impactU - 0.28);
            const fall = fk * fk;
            const curY = z.startY - 0.18 - fall * (z.startY - 0.18 - z.impactY);
            hd.sphere.visible = true;
            hd.sphere.position.set(z.x, curY, z.z);
            hd.sphere.scale.set(0.95, 1.35 + fk * 0.65, 0.95);
            hd.ringOuter.visible = true;
            hd.ringOuter.scale.setScalar(0.75 + fk * 0.55);
            hd.ringOuter.material.opacity = 0.28 + fk * 0.25;
            hd.ringInner.visible = false;
            hd.crownGroup.visible = false;
          } else {
            const rk = (u - impactU) / (1 - impactU);
            hd.sphere.visible = false;
            hd.ringOuter.visible = true;
            hd.ringInner.visible = true;
            const sOut = 0.8 + rk * 4.8;
            const sIn = 0.5 + rk * 3.1;
            hd.ringOuter.scale.set(sOut, sOut, 1);
            hd.ringInner.scale.set(sIn, sIn, 1);
            hd.ringOuter.material.opacity = (1 - rk) * 0.82;
            hd.ringInner.material.opacity = (1 - rk) * 0.68;

            hd.crownGroup.visible = rk < 0.65;
            if (hd.crownGroup.visible) {
              const ck = rk / 0.65;
              const rad = 0.25 + ck * 1.65;
              const arcY = Math.sin(ck * PI) * 0.95;
              for (let c = 0; c < hd.crownGroup.children.length; c++) {
                const bead = hd.crownGroup.children[c];
                const a = bead.userData.ang;
                bead.position.set(Math.cos(a) * rad, arcY, Math.sin(a) * rad);
                bead.scale.setScalar(1 - ck * 0.65);
              }
            }
          }
        }

        // Low Shell-Pond Tap gentle drip
        const lu = (elapsed / 2.1) % 1;
        if (lu < 0.45) {
          const lk = lu / 0.45;
          lowDrop.visible = true;
          lowDrop.position.set(pondPos.x, lowSpoutY - (lk * lk) * (lowSpoutY - lowPondY), pondPos.z + 0.18);
        } else {
          lowDrop.visible = false;
        }

        // 6. Fluttering 3D pastel butterflies
        for (let i = 0; i < butterflies.length; i++) {
          const b = butterflies[i];
          const a = elapsed * b.spd + b.ph;
          const nx = b.cx + Math.cos(a) * b.r;
          const nz = b.cz + Math.sin(a * 2) * (b.r * 0.62);
          const ny = b.y0 + Math.sin(elapsed * 2.4 + b.ph) * 0.28;
          const dx = nx - b.grp.position.x, dz = nz - b.grp.position.z;
          b.grp.position.set(nx, ny, nz);
          if (dx * dx + dz * dz > 1e-6) b.grp.rotation.y = Math.atan2(dx, dz);
          const flap = Math.sin(elapsed * 16 + b.ph) * 0.85;
          b.wL.rotation.z = flap;
          b.wR.rotation.z = -flap;
        }

        // 7. Drifting golden sunlit pollen & underground burrow firefly spores
        for (let i = 0; i < sporeCount; i++) {
          const s = sporeData[i];
          const px = s.x + Math.sin(elapsed * s.spd + s.ph) * 0.55;
          const py = s.y + Math.sin(elapsed * s.spd * 0.8 + s.ph * 1.7) * 0.36;
          const pz = s.z + Math.cos(elapsed * s.spd * 0.9 + s.ph) * 0.55;
          sm4.makeTranslation(px, py, pz);
          sporeInst.setMatrixAt(i, sm4);
        }
        sporeInst.instanceMatrix.needsUpdate = true;

        // 8. Walnut Stream Ferries, Faucet Torrent Surge & Cat-Eye Marble
        tracks.update(dt, elapsed);

        for (let i = 0; i < walnutBoats.length; i++) {
          const wb = walnutBoats[i];
          const pos = wb.posFn(elapsed);
          wb.mesh.position.set(pos.x, pos.y, pos.z);
          wb.mesh.rotation.y = wb.yawFn(elapsed);
        }

        if (WORLD_STATE.faucetSurgeTimer > 0) {
          WORLD_STATE.faucetSurgeTimer = Math.max(0, WORLD_STATE.faucetSurgeTimer - dt);
        }
        const surging = WORLD_STATE.faucetSurgeTimer > 0;
        if (WORLD_STATE.faucetWheel) {
          WORLD_STATE.faucetWheel.rotation.y += dt * (surging ? 9.5 : 0.45);
        }
        if (WORLD_STATE.faucetJet) {
          WORLD_STATE.faucetJet.visible = surging;
          if (surging) {
            WORLD_STATE.faucetJet.rotation.y += dt * 4.5;
            WORLD_STATE.faucetJet.scale.set(1 + Math.sin(elapsed * 14) * 0.12, 1, 1 + Math.cos(elapsed * 14) * 0.12);
          }
        }
        if (WORLD_STATE.sprinklerGroup) {
          WORLD_STATE.sprinklerGroup.visible = surging;
          if (surging) WORLD_STATE.sprinklerGroup.rotation.y = Math.sin(elapsed * 1.8) * 0.25;
        }
        if (WORLD_STATE._soapFoamDisc) {
          WORLD_STATE._soapFoamDisc.visible = surging;
          if (surging) {
            WORLD_STATE._soapFoamDisc.material.opacity = 0.46 + Math.sin(elapsed * 6) * 0.12;
          }
        }

        // Mid-round hazard event (`G.t <= 72`): Giant Cat-Eye Marble & Brass Faucet Deluge!
        if (activeG && (activeG.phase === 'seek' || activeG.phase === 'survive') && !activeG.over && activeG.t <= 72 && !WORLD_STATE.midEventFired) {
          WORLD_STATE.midEventFired = true;
          WORLD_STATE.faucetSurgeTimer = Math.max(WORLD_STATE.faucetSurgeTimer, 16.0);
          if (WORLD_STATE.rollingMarble) WORLD_STATE.rollingMarble.visible = true;
          ctx.notify('🔮 Mid-Round Surge: Giant Cat-Eye Marble Loose & Brass Faucet Deluge!', 3400);
          ctx.emitSoundCue({ x: 0, y: Y_GARDEN, z: 0 }, 30, 'bell', null);
        }

        if (WORLD_STATE.midEventFired && WORLD_STATE.rollingMarble && WORLD_STATE.rollingMarble.visible) {
          WORLD_STATE.marbleAngle += dt * 0.62;
          const ma = WORLD_STATE.marbleAngle;
          const mx = Math.cos(ma) * 11.8;
          const mz = Math.sin(ma) * 8.4;
          WORLD_STATE.rollingMarble.position.set(mx, Y_GARDEN + 0.92, mz);
          WORLD_STATE.rollingMarble.rotation.x += dt * 4.2;
          WORLD_STATE.rollingMarble.rotation.z -= dt * 3.1;
          WORLD_STATE.marbleBoostCooldown = Math.max(0, WORLD_STATE.marbleBoostCooldown - dt);
          if (activeG && !activeG.over && activeG.phase !== 'menu' && WORLD_STATE.marbleBoostCooldown <= 0) {
            for (const act of actors) {
              const u = act.userData;
              if (!u || u.caught || u.specialMode || u.rideRail || u.inTurret) continue;
              const fy = (u.groundY ?? act.position.y) + (u.jy || 0);
              if (Math.abs(fy - Y_GARDEN) > 1.35) continue;
              const dx = act.position.x - mx, dz = act.position.z - mz;
              const dist = Math.hypot(dx, dz);
              if (dist < 1.55) {
                WORLD_STATE.marbleBoostCooldown = 0.55;
                const inv = dist > 0.05 ? 1 / dist : 1;
                u.vx = (u.vx || 0) + (dx * inv) * 6.0;
                u.vz = (u.vz || 0) + (dz * inv) * 6.0;
                u.vy = Math.max(u.vy || 0, 4.4);
                if (act === activeG.player && ctx.notify) {
                  ctx.notify('🔮 Bumped by the Giant Cat-Eye Glass Marble!', 1400);
                }
              }
            }
          }
        }
      },
    };
  },
};

export { WORLD_STATE as TINYFOLK_DEBUG };
