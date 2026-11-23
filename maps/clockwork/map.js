/* Hue & Seek — Map 4: Pendulum Square / Clockwork Market (`maps/clockwork/map.js`).
 * Multi-tier storybook steam-and-magic clockwork town built from `assets/maps/clockwork/*.png`:
 *   • Tier 1 (`y = 0.85m`, South Canal Quarter): Stone-walled turquoise brook, 2 walkable arched stone bridges,
 *     Stained-Glass Apothecary (`alchemist_shop`), canal-side cobble promenade, Canal Arcade Chrono Pocketwatch,
 *     and Green Dial Portal Door.
 *   • Tier 2 (`y = 2.00m`, Central Star-Compass Market Square & North Under-Viaduct Wizard Court):
 *     12-point golden star-compass plaza, spinning brass `orreryFountain`, 2 wrought-iron `marketKiosk`s,
 *     continuously looping rideable `clockworkTram` with Conductor Bell Pull surge (`1.85x` for 8s),
 *     Central Courtyard Archway Clock Pendulum, Wizard Court Chrono Pocketwatch,
 *     `hatter_boutique`, `royal_patisserie`, `wizard_parlor`, plus Blue & Crimson-Rose Dial Portal Doors.
 *   • Tier 3 (`y = 4.35m`, Elevated Wrought-Iron & Stone Rail Viaduct + NE Grand Clocktower Promenade):
 *     4.2m-wide arched viaduct walkway (`y0..y1` upper parapet colliders so Tier 2 walks cleanly underneath!),
 *     Upper Viaduct Walk Clock Pendulum, Great Bronze Belfry Bell (22m acoustic prop-rattle shockwave),
 *     Clockmaker Guildhall (`clockmaker_hall`) with Clocktower Escapement Lever (`Midnight Rush`),
 *     Brass Gear-Elevators (`1.8x` in Midnight Rush), and Orange-Gold Dial Portal Door.
 *   • Bespoke Clockwork Mechanics:
 *     - Midnight Ghost Hunt ("Clock Strikes Twelve!" at <= 45s or 18s via Clocktower Escapement Pull)
 *     - Giant Swinging Brass Clock Pendulums (`sampleLauncherAt` knockback, frozen by Time-Slow)
 *     - Golden Chrono Pocketwatches unleashing 5.0s Sepia Time-Slow Bubbles (`radius = 9.5m`)
 *     - Belfry Acoustic Prop-Rattle Bell (interact OR Seeker shot -> 22m golden ring + `_propJitterUntil`)
 *     - Rideable Brass Streetcar w/ Conductor Bell Pull (`1.85x` surge for 8s) & 4 Colour-Coded Astrolabe Portal Doors
 *   • Strict Storybook Material Rule: `metalness: 0` on EVERY `MeshStandardMaterial` across the entire map.
 */
import * as THREE_MOD from 'three';
import {
  makeRng,
  paintedCanvasTex,
  brushStrokes,
  kitTex,
  mergeStatic,
  RoundedBoxGeometry,
  createAnimatedWater,
  createSwayingBlades,
} from '../map_kit.js?v=2';
import {
  PROPS,
  PROP_ICONS,
  buildMapProps,
  buildWallCuckooClock,
  buildTramLuggageDisguise,
  buildClockworkOwl,
  buildClockworkPup,
} from './props.js?v=v10';
import {
  playTurretFireAudio,
  createCreatureFleetController,
  createMatCache,
  createMovingTrackSystem,
  playWorldMechAudio,
} from '../world_interactives.js?v=v10';
import { SEEKER_DEFS, HIDER_DEF, buildMapSeeker, buildMapHider } from './characters.js?v=2';
import { BUILDING_DEFS, buildBuildings, makeGearGeo, buildDialPortalDoor } from './buildings.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ============================================================================
// 3-Tier Vertical Elevations & Spatial Geometry Constants
// ============================================================================
export const Y_T1 = 0.85; // Tier 1: Lower Canal Walk & Apothecary Arcade (South)
export const Y_T2 = 2.00; // Tier 2: Central Star-Compass Market Square & Wizard Court
export const Y_T3 = 4.35; // Tier 3: Elevated Iron-Stone Rail Viaduct & Grand Clocktower Terrace

// Looping Streetcar Tram Geometry on Tier 2
const TRAM_CX = 0.0;
const TRAM_CZ = 0.8;
const R_TRAM = 9.8;
const TRAM_OMEGA = 0.18; // rad/s (~1.76 m/s smooth town streetcar pace)
const TRAM_STEP_Y = Y_T2 + 0.24; // 2.24m side running-board step
const TRAM_DECK_Y = Y_T2 + 0.48; // 2.48m polished walnut boarding deck

// Lower Stone-Walled Canal on Tier 1 (`y = 0.85m`)
const CANAL_X0 = -7.6;
const CANAL_X1 = 22.8;
const CANAL_Z0 = 19.9;
const CANAL_Z1 = 23.3;
const CANAL_ZC = 21.6;
const CANAL_BRIDGES = [
  { id: 'br_canal_w', cx: -1.8, cz: CANAL_ZC, halfW: 1.65, halfL: 2.9, arch: 0.30 },
  { id: 'br_canal_e', cx: 8.8, cz: CANAL_ZC, halfW: 1.65, halfL: 2.9, arch: 0.30 },
];

// Walkable Stone Staircases linking Tier 1 <-> Tier 2 and Tier 2 <-> Tier 3
const STAIRS = [
  // Tier 1 (0.85m, z = 17.0) -> Tier 2 (2.00m, z = 13.4)
  { id: 'st_t1_w', cx: -11.4, halfW: 1.85, z0: 17.0, y0: Y_T1, z1: 13.4, y1: Y_T2 },
  { id: 'st_t1_c', cx: -1.8,  halfW: 1.95, z0: 17.0, y0: Y_T1, z1: 13.4, y1: Y_T2 },
  { id: 'st_t1_e', cx: 8.8,   halfW: 1.95, z0: 17.0, y0: Y_T1, z1: 13.4, y1: Y_T2 },
  // Tier 2 (2.00m, z = -5.6) -> Tier 3 (4.35m, z = -11.6)
  { id: 'st_t2_nw', cx: -16.8, halfW: 1.95, z0: -5.6, y0: Y_T2, z1: -11.6, y1: Y_T3 },
  { id: 'st_t2_ne', cx: 15.2,  halfW: 2.15, z0: -5.6, y0: Y_T2, z1: -11.6, y1: Y_T3 },
];

// Elevated Viaduct (`z in [-15.8, -11.6]`, `width = 4.2m >= 3.8m`, `x in [-14.4, +4.0]`)
const VIADUCT = {
  x0: -14.4,
  x1: 4.0,
  z0: -15.8,
  z1: -11.6,
  zc: -13.7,
  width: 4.2,
  pierXs: [-13.6, -8.2, -2.8, 2.6], // 3 open 4.2m arch underpasses at x = -10.9, -5.5, -0.1!
  archXs: [-10.9, -5.5, -0.1],
};

// 4 Colour-Coded Astrolabe Portal Doors across all 3 tiers
const PORTAL_DEFS = [
  {
    id: 'blue',
    idx: 0,
    name: 'Harbourgate Blue Portal',
    shortLabel: 'Wizard Blue (2.0m)',
    colorName: 'Cobalt-Blue',
    colorHex: 0x3b82f6,
    glowHex: 0x8cc8ff,
    x: 1.3,
    y: Y_T2,
    z: -21.8,
    rot: -0.32,
  },
  {
    id: 'green',
    idx: 1,
    name: 'Apothecary Emerald Portal',
    shortLabel: 'Canal Green (0.85m)',
    colorName: 'Emerald-Green',
    colorHex: 0x34c77b,
    glowHex: 0x8ef5bc,
    x: -6.65,
    y: Y_T1,
    z: 14.35,
    rot: 0.0,
  },
  {
    id: 'orange',
    idx: 2,
    name: 'Clocktower Amber Portal',
    shortLabel: 'Viaduct Gold (4.35m)',
    colorName: 'Amber-Gold',
    colorHex: 0xf59e2b,
    glowHex: 0xffd878,
    x: 5.8,
    y: Y_T3,
    z: -19.2,
    rot: 0.25,
  },
  {
    id: 'crimson',
    idx: 3,
    name: 'Millinery Rose Portal',
    shortLabel: 'Millinery Rose (2.0m)',
    colorName: 'Crimson-Rose',
    colorHex: 0xe04868,
    glowHex: 0xff9cb4,
    x: -20.4,
    y: Y_T2,
    z: 9.6,
    rot: 0.45,
  },
].map((p) => ({
  ...p,
  padX: +(p.x + Math.sin(p.rot) * 1.45).toFixed(3),
  padZ: +(p.z + Math.cos(p.rot) * 1.45).toFixed(3),
  outYaw: p.rot,
}));

// Extend props registry for `cw_cuckoo_clock` wall hook disguise while keeping `disguisePool` at 12 core props
const MAP_PROPS = [
  ...PROPS,
  { id: 'cw_cuckoo_clock', label: 'Wall Cuckoo Clock', icon: '🕰️', radius: 0.32, height: 0.86, hp: 75 },
];
const MAP_PROP_ICONS = {
  ...PROP_ICONS,
  cw_cuckoo_clock: '🕰️',
};

// Live Runtime State for Tram, Gear-Elevators, Great Bell, Portals & Clockwork Creatures
const GEAR_ELEV_DEFS = [
  { id: 'gear_elev_canal',      name: 'Canal Brass Gear-Lift',     x: 20.4, z: 14.95, r: 1.48, yMin: Y_T1, yMax: Y_T2, dwell: 1.6, travel: 2.2, phase: 0.0 },
  { id: 'gear_elev_clocktower', name: 'Clocktower Brass Gear-Lift', x: 23.0, z: -10.1, r: 1.48, yMin: Y_T2, yMax: Y_T3, dwell: 1.6, travel: 2.4, phase: 2.0 },
];

const BELFRY_BELL_POS = { x: -4.1, y: Y_T3, z: -12.3, triggerRadius: 2.25 };
const BELFRY_BELL_CENTER = { x: -5.5, y: Y_T3 + 2.6, z: -13.7 };

function evalGearElevY(ge, simSec) {
  const cyc = 2 * (ge.dwell + ge.travel);
  const t = (((simSec + ge.phaseOffset) % cyc) + cyc) % cyc;
  if (t < ge.dwell) return ge.yMin;
  if (t < ge.dwell + ge.travel) {
    const u = (t - ge.dwell) / ge.travel;
    return ge.yMin + (ge.yMax - ge.yMin) * (0.5 - 0.5 * Math.cos(u * PI));
  }
  if (t < ge.dwell * 2 + ge.travel) return ge.yMax;
  const u = (t - ge.dwell * 2 - ge.travel) / ge.travel;
  return ge.yMin + (ge.yMax - ge.yMin) * (0.5 + 0.5 * Math.cos(u * PI));
}

const WORLD_STATE = {
  tramReady: false,
  elapsed: 0,
  tram: {
    angle: PI * 0.5,
    x: TRAM_CX,
    z: TRAM_CZ + R_TRAM,
    yaw: -PI * 0.5,
    prevX: TRAM_CX,
    prevZ: TRAM_CZ + R_TRAM,
    prevYaw: -PI * 0.5,
    mesh: null,
  },
  tramSurgeUntil: -1,
  tramBellMesh: null,
  tramBellSwingAmp: 0,
  tramBellSwingPhase: 0,
  tramBellSpot: null,
  gearElevators: [],
  bellPivot: null,
  bellPulseMesh: null,
  bellGroundPulseMesh: null,
  bellSwingAmp: 0,
  bellSwingPhase: 0,
  bellPulseUntil: -99,
  bellCdUntil: 0,
  bellStartledCount: 0,
  bellRattledCount: 0,
  creatures: null,
  portalDialIdx: 1, // Starts pointing at Green (Tier 1 Canal Arcade)
  wheelSpinBoost: 0,
  portals: [],
  interactSpots: [],
  tramLuggageSpot: null,
  turret: null,
  tracks: null,
  mechSpots: [],
  conveyorDirSign: 1,
  scrambleUntil: -1,
  midnightDone: false,
  midnightPermanent: false,
  midnightLeverUntil: -1,
  clockHandAngle: 0,
  clockGearAngle: 0,
  escapementLeverMesh: null,
  escapementPullT: 0,
  pendulums: [],
  pendulumHitCd: new Map(),
  pocketwatches: [],
  timeDomes: [],
  conveyorSlats: [],
  chaosDialMesh: null,
  getG: null,
  getActors: null,
  root: null,
  notify: null,
  emitSoundCue: null,
  audio: null,
};

// ============================================================================
// Pure Analytic 3-Tier + Bridge + Stair + Viaduct + Moving Tram Height Math
// ============================================================================
function worldToTramLocal(wx, wz, tx, tz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const dx = wx - tx, dz = wz - tz;
  return [dx * c - dz * s, dx * s + dz * c];
}

function tramLocalToWorld(lx, lz, tx, tz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [tx + lx * c + lz * s, tz - lx * s + lz * c];
}

function evalStairY(st, x, z) {
  if (Math.abs(x - st.cx) > st.halfW) return null;
  const zMin = Math.min(st.z0, st.z1), zMax = Math.max(st.z0, st.z1);
  if (z < zMin || z > zMax) return null;
  const t = clamp((z - st.z0) / (st.z1 - st.z0), 0, 1);
  return st.y0 + (st.y1 - st.y0) * t;
}

function evalCanalBridgeY(x, z) {
  for (const br of CANAL_BRIDGES) {
    if (Math.abs(x - br.cx) <= br.halfW && Math.abs(z - br.cz) <= br.halfL) {
      const u = clamp((z - br.cz) / br.halfL, -1, 1);
      return Y_T1 + br.arch * Math.cos(u * PI * 0.5);
    }
  }
  return null;
}

function inCanalWater(x, z) {
  if (x <= CANAL_X0 + 0.12 || x >= CANAL_X1 - 0.12) return false;
  if (z <= CANAL_Z0 + 0.08 || z >= CANAL_Z1 - 0.08) return false;
  if (evalCanalBridgeY(x, z) !== null) return false;
  return true;
}

function inWestViaductBastion(x, z) {
  return x >= -19.4 && x <= VIADUCT.x0 && z >= -16.0 && z <= VIADUCT.z1;
}

function inClocktowerPromenade(x, z) {
  return x >= VIADUCT.x1 && x <= 26.2 && z >= -26.8 && z <= VIADUCT.z1;
}

function inElevatedViaductSpan(x, z) {
  return x >= VIADUCT.x0 && x <= VIADUCT.x1 && z >= VIADUCT.z0 && z <= VIADUCT.z1;
}

export function sampleClockworkHeight(x, z, refY) {
  // 1. Dynamic Moving Streetcar Tram Deck & Boarding Running-Boards (only when `refY` is supplied!)
  if (WORLD_STATE.tramReady && typeof refY === 'number') {
    const tr = WORLD_STATE.tram;
    const [lx, lz] = worldToTramLocal(x, z, tr.x, tr.z, tr.yaw);
    if (Math.abs(lz) <= 3.08 && Math.abs(lx) <= 1.46 && refY >= Y_T2 - 0.25 && refY <= Y_T2 + 1.95) {
      return Math.abs(lx) <= 1.18 ? TRAM_DECK_Y : TRAM_STEP_Y;
    }
  }

  // 1B. Moving Brass Gear-Elevators (Tier 1 <-> Tier 2 & Tier 2 <-> Tier 3!)
  for (let i = 0; i < WORLD_STATE.gearElevators.length; i++) {
    const ge = WORLD_STATE.gearElevators[i];
    if (Math.hypot(x - ge.x, z - ge.z) <= ge.r) {
      if (typeof refY !== 'number' || Math.abs(refY - ge.y) <= 1.75) {
        return ge.y;
      }
    }
  }

  // 2. Walkable Stone Staircases (Tier 1 <-> Tier 2 & Tier 2 <-> Tier 3)
  for (const st of STAIRS) {
    const sy = evalStairY(st, x, z);
    if (sy !== null) return sy;
  }

  // 3. Elevated Rail Viaduct Span (`x in [-14.4, +4.0], z in [-15.8, -11.6]`):
  //    Upper deck (`4.35m`) when approaching from Tier 3 (`refY >= 3.18m`), else open Tier 2 underpass (`2.00m`)!
  if (inElevatedViaductSpan(x, z)) {
    if (typeof refY === 'number' && refY >= 3.18) return Y_T3;
    return Y_T2;
  }

  // 4. Solid Tier 3 Masonry Terraces (West Viaduct Bastion & NE Grand Clocktower Promenade)
  if (inWestViaductBastion(x, z) || inClocktowerPromenade(x, z)) {
    return Y_T3;
  }

  // 5. Tier 1 Lower Canal Quarter (`z >= 13.4`) + Arched Stone Bridges
  if (z >= 13.4) {
    const by = evalCanalBridgeY(x, z);
    if (by !== null) return by;
    if (inCanalWater(x, z)) return 0.26;
    return Y_T1;
  }

  // 6. Default: Tier 2 Central Star-Compass Market Square & North Wizard Court (`y = 2.00m`)
  return Y_T2;
}

function tierKeyOf(x, z, y) {
  const h = typeof y === 'number' ? y : sampleClockworkHeight(x, z);
  if (h > 3.25) return 't3';
  if (h < 1.42) return 't1';
  return 't2';
}

// ============================================================================
// Hand-Painted Storybook Cobble, Star Medallion & Foliage Brushwork Textures
// ============================================================================
function makeCobbleTex(THREE) {
  return paintedCanvasTex(THREE, 'cw_warm_cobble_v2', 512, (g, s, rng) => {
    g.fillStyle = '#ccb496';
    g.fillRect(0, 0, s, s);
    const cols = ['#dcc6aa', '#c7ad90', '#e6d0b4', '#ba9f82', '#d5bc9c', '#c1a88c'];
    for (let row = 0; row < 16; row++) {
      const y = (row / 16) * s;
      const h = s / 16 - 3;
      const off = (row % 2) * 16;
      for (let col = -1; col < 14; col++) {
        const w = 36 + ((row * 7 + col * 3) % 8);
        const x = col * 39 + off;
        g.fillStyle = cols[(row * 5 + col * 3 + 16) % cols.length];
        g.beginPath();
        g.roundRect(x + 1.5, y + 1.5, w - 3, h, 5);
        g.fill();
        g.strokeStyle = 'rgba(82,60,44,0.34)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    brushStrokes(g, s, rng, 180, ['#fff4dc', '#9c8168', '#f2c864'], 1.5, 4.5, 0.16, 0.3, PI, 28);
  }, 9, 9);
}

function makeStarMedallionTex(THREE) {
  return paintedCanvasTex(THREE, 'cw_star_medallion_v2', 1024, (g, s, rng) => {
    const cx = s / 2, cy = s / 2;
    g.fillStyle = '#cbb398';
    g.fillRect(0, 0, s, s);

    for (const [r, col] of [[0.49, '#bda388'], [0.46, '#e2c9a6'], [0.43, '#727a92'], [0.40, '#d8be9e']]) {
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx, cy, s * r, 0, TAU);
      g.fill();
    }

    const pts = 12;
    for (let i = 0; i < pts; i++) {
      const a0 = (i / pts) * TAU;
      const am = ((i + 0.5) / pts) * TAU;
      const a1 = ((i + 1) / pts) * TAU;
      g.fillStyle = '#6c7690';
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * s * 0.44, cy + Math.sin(a0) * s * 0.44);
      g.lineTo(cx + Math.cos(a1) * s * 0.44, cy + Math.sin(a1) * s * 0.44);
      g.closePath();
      g.fill();

      g.fillStyle = i % 2 === 0 ? '#f5ca69' : '#e8b756';
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0 + 0.06) * s * 0.24, cy + Math.sin(a0 + 0.06) * s * 0.24);
      g.lineTo(cx + Math.cos(am) * s * 0.47, cy + Math.sin(am) * s * 0.47);
      g.lineTo(cx + Math.cos(a1 - 0.06) * s * 0.24, cy + Math.sin(a1 - 0.06) * s * 0.24);
      g.closePath();
      g.fill();
      g.strokeStyle = '#6c533c';
      g.lineWidth = 4;
      g.stroke();
    }

    for (const [r, col] of [[0.23, '#f5deb0'], [0.20, '#c8ae90'], [0.16, '#767e96']]) {
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx, cy, s * r, 0, TAU);
      g.fill();
    }
    g.strokeStyle = 'rgba(75,55,38,0.26)';
    g.lineWidth = 3;
    for (let r = 0.18; r <= 0.47; r += 0.045) {
      g.beginPath();
      g.arc(cx, cy, s * r, 0, TAU);
      g.stroke();
    }
    brushStrokes(g, s, rng, 260, ['#ffcf48', '#fff4d4', '#8f755c'], 2, 5, 0.22, 0, PI, 18);
  });
}

function makeFoliageBrushTex(THREE) {
  return paintedCanvasTex(THREE, 'cw_autumn_foliage_v2', 256, (g, s, rng) => {
    g.fillStyle = '#f8f2e6';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 340, ['#ffffff', '#f5e8cc', '#e2d0b0', '#fffaf0'], 3, 9, 0.42, 0.4, PI, 28);
  }, 1.5, 1.5);
}

// ============================================================================
// Storybook Golden Ginkgo & Crimson Maple Trees + Standable Street Furniture
// (`metalness: 0` on EVERY material!)
// ============================================================================
function buildAutumnTree(THREE, kind = 'ginkgo', seed = 1) {
  const rng = makeRng(seed * 73 + (kind === 'ginkgo' ? 11 : 29));
  const g = new THREE.Group();
  g.name = `tree_${kind}`;
  const barkMat = new THREE.MeshStandardMaterial({
    color: kind === 'ginkgo' ? 0x8a6444 : 0x6e4b34,
    map: kitTex(THREE, 'bark', 1, 2),
    roughness: 0.92,
    metalness: 0,
  });
  const palette = kind === 'ginkgo' ? [0xffcb2e, 0xffe058] : [0xe64228, 0xf57828];

  const hTrunk = rng.jr(2.25, 2.8);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, hTrunk, 9), barkMat);
  trunk.position.y = hTrunk / 2;
  g.add(trunk);
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * TAU + rng.jr(-0.3, 0.3);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 1.45, 7), barkMat);
    limb.position.set(Math.cos(a) * 0.45, hTrunk + 0.35, Math.sin(a) * 0.45);
    limb.rotation.set(Math.sin(a) * 0.52, 0, -Math.cos(a) * 0.52);
    g.add(limb);
  }

  const folTex = makeFoliageBrushTex(THREE);
  const leafMats = [0, 1].map((i) => new THREE.MeshStandardMaterial({
    color: palette[i],
    map: folTex,
    roughness: 0.84,
    metalness: 0,
  }));
  const puffCount = 11;
  for (let i = 0; i < puffCount; i++) {
    const a = (i / puffCount) * TAU + rng.jr(-0.25, 0.25);
    const rad = i < 3 ? rng.jr(0.1, 0.55) : rng.jr(0.75, 1.55);
    const py = hTrunk + (i < 3 ? rng.jr(1.65, 2.25) : rng.jr(0.65, 1.55));
    const rPuff = i < 3 ? rng.jr(1.05, 1.38) : rng.jr(0.92, 1.32);
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rPuff, 2), leafMats[i % 2]);
    puff.scale.set(1.12, kind === 'ginkgo' ? 0.88 : 0.78, 1.12);
    puff.position.set(Math.cos(a) * rad, py, Math.sin(a) * rad);
    puff.rotation.set(rng.jr(-0.2, 0.2), rng.jr(0, TAU), rng.jr(-0.2, 0.2));
    g.add(puff);
  }

  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: 0.72, d: 0.72, y0: -0.2, y1: 3.4, noJump: true }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = m.material.color.clone();
    }
  });
  return g;
}

function buildPlazaBench(THREE) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({
    color: 0xb27842,
    map: kitTex(THREE, 'wood_light', 1.5, 1),
    roughness: 0.86,
    metalness: 0,
  });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4d5c, roughness: 0.62, metalness: 0 });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xe8b84b,
    roughness: 0.42,
    metalness: 0,
    emissive: 0x3b2406,
    emissiveIntensity: 0.14,
  });
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new RoundedBoxGeometry(1.78, 0.06, 0.14, 1, 0.02), wood);
    slat.position.set(0, 0.46, -0.14 + i * 0.15);
    g.add(slat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(1.78, 0.12, 0.05, 1, 0.02), wood);
    back.position.set(0, 0.66 + i * 0.14, -0.26);
    back.rotation.x = -0.14;
    g.add(back);
  }
  for (const sx of [-0.74, 0.74]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.46, 0.48, 1, 0.02), iron);
    leg.position.set(sx, 0.23, 0);
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 12, PI), iron);
    arm.position.set(sx, 0.50, 0);
    arm.rotation.y = PI / 2;
    g.add(arm);
    const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), brass);
    rosette.rotation.z = PI / 2;
    rosette.position.set(sx * 1.05, 0.50, 0.12);
    g.add(rosette);
  }
  mergeStatic(THREE, g);
  // Explicit standable bench collider (`y1 = 0.58 <= 1.68` -> `standable: true` for 3D jumping!)
  g.userData.colliders = [{ x: 0, z: 0, w: 1.82, d: 0.64, y0: -0.15, y1: 0.58 }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = m.material.color.clone();
    }
  });
  return g;
}

function buildBistroTable(THREE, seed = 1) {
  const g = new THREE.Group();
  const marble = new THREE.MeshStandardMaterial({
    color: 0xfff7e8,
    map: kitTex(THREE, 'stone', 1.4, 1.4),
    roughness: 0.55,
    metalness: 0,
  });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4d5c, roughness: 0.62, metalness: 0 });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xe8b84b,
    roughness: 0.42,
    metalness: 0,
    emissive: 0x3b2406,
    emissiveIntensity: 0.14,
  });
  const umbMat = new THREE.MeshStandardMaterial({
    color: seed % 2 === 0 ? 0xc84458 : 0x3f7fb6,
    roughness: 0.80,
    metalness: 0,
  });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff3dc, roughness: 0.82, metalness: 0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.08, 12), iron);
  base.position.y = 0.04;
  g.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.72, 10), iron);
  stem.position.y = 0.38;
  g.add(stem);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.62, 0.07, 18), marble);
  top.position.y = 0.74;
  g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.024, 6, 20), brass);
  rim.rotation.x = PI / 2;
  rim.position.y = 0.74;
  g.add(rim);
  // Teacup & berry tart on tabletop
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.09, 10), creamMat);
  cup.position.set(0.18, 0.82, 0.12);
  g.add(cup);
  // Striped café umbrella high overhead (`y = 2.45m` so players can jump right onto tabletop `y1 = 0.78m`!)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 1.75, 8), brass);
  pole.position.y = 1.64;
  g.add(pole);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.44, 12), umbMat);
  canopy.position.y = 2.52;
  g.add(canopy);

  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: 1.24, d: 1.24, y0: -0.15, y1: 0.78 }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = m.material.color.clone();
    }
  });
  return g;
}

function buildFlowerPlanter(THREE, seed = 1) {
  const rng = makeRng(seed * 41 + 7);
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({
    color: 0xd9c8b0,
    map: kitTex(THREE, 'stone', 1.6, 1.2),
    roughness: 0.90,
    metalness: 0,
  });
  const soil = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.95, metalness: 0 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x5d9844, roughness: 0.84, metalness: 0 });
  const bloomCols = [0xf26d8f, 0xffcb3d, 0xff8552, 0xe84a5f];

  const tub = new THREE.Mesh(new RoundedBoxGeometry(1.26, 0.54, 0.86, 2, 0.06), stone);
  tub.position.y = 0.27;
  g.add(tub);
  const earth = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.08, 0.68, 1, 0.02), soil);
  earth.position.y = 0.52;
  g.add(earth);
  for (let i = 0; i < 7; i++) {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), leaf);
    bush.position.set(rng.jr(-0.42, 0.42), 0.60 + rng.jr(0, 0.08), rng.jr(-0.22, 0.22));
    g.add(bush);
    const flMat = new THREE.MeshStandardMaterial({
      color: bloomCols[i % bloomCols.length],
      roughness: 0.72,
      metalness: 0,
    });
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), flMat);
    fl.position.set(bush.position.x + rng.jr(-0.08, 0.08), bush.position.y + 0.14, bush.position.z + rng.jr(-0.08, 0.08));
    g.add(fl);
  }
  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: 1.28, d: 0.88, y0: -0.15, y1: 0.66 }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = m.material.color.clone();
    }
  });
  return g;
}

function buildBannerLampStandard(THREE) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4d5c, roughness: 0.60, metalness: 0 });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xe8b84b,
    roughness: 0.38,
    metalness: 0,
    emissive: 0x3b2406,
    emissiveIntensity: 0.16,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xf5cc5c,
    roughness: 0.36,
    metalness: 0,
    emissive: 0x4a2e08,
    emissiveIntensity: 0.22,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffe8a6,
    emissive: 0xffac38,
    emissiveIntensity: 1.65,
    roughness: 0.38,
    metalness: 0,
  });
  const banner = new THREE.MeshStandardMaterial({ color: 0x5c3282, roughness: 0.85, metalness: 0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.58, 10), iron);
  base.position.y = 0.29;
  g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.1, 3.85, 10), iron);
  post.position.y = 2.2;
  g.add(post);
  const cross = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.05, 0.05, 1, 0.015), brass);
  cross.position.set(0, 3.35, 0);
  g.add(cross);
  const flag = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.92, 0.03, 1, 0.01), banner);
  flag.position.set(0, 2.84, 0);
  g.add(flag);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), gold);
  star.scale.set(1, 1.35, 0.35);
  star.position.set(0, 2.86, 0);
  g.add(star);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.13, 0.36, 6), glow);
  lantern.position.y = 4.25;
  g.add(lantern);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.22, 6), brass);
  cap.position.y = 4.52;
  g.add(cap);

  mergeStatic(THREE, g);
  g.userData.colliders = [{ x: 0, z: 0, w: 0.68, d: 0.68, y0: -0.2, y1: 4.5, noJump: true }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = m.material.color.clone();
    }
  });
  return g;
}

function buildWallClockBracket(THREE) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4d5c, roughness: 0.60, metalness: 0 });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xe8b84b,
    roughness: 0.40,
    metalness: 0,
    emissive: 0x3b2406,
    emissiveIntensity: 0.16,
  });
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.38, 0.05, 1, 0.012), iron);
  plate.position.set(0, 0.52, -0.11);
  g.add(plate);
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), brass);
  peg.rotation.x = PI / 2;
  peg.position.set(0, 0.56, -0.05);
  g.add(peg);
  const gear = new THREE.Mesh(makeGearGeo(THREE, 0.11, 0.03, 10, 4), brass);
  gear.position.set(0, 0.52, -0.08);
  g.add(gear);
  mergeStatic(THREE, g);
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.noSolid = true;
    }
  });
  return g;
}

// ============================================================================
// Multi-Tier Architecture Kit: Stone Retaining Walls, Stairs & Iron Viaduct
// ============================================================================
function buildMultiTierMasonryAndViaduct(THREE) {
  const g = new THREE.Group();
  g.name = 'clockwork_tiers_and_viaduct';
  const colliders = [];

  const cobbleTex = makeCobbleTex(THREE);
  const cobbleMat = new THREE.MeshStandardMaterial({ color: 0xfbf0e0, map: cobbleTex, roughness: 0.91, metalness: 0 });
  const dressedStone = new THREE.MeshStandardMaterial({
    color: 0xd6c4ac,
    map: kitTex(THREE, 'stone', 3.2, 1.8),
    roughness: 0.89,
    metalness: 0,
  });
  const darkMasonry = new THREE.MeshStandardMaterial({
    color: 0xb6a189,
    map: kitTex(THREE, 'stone', 4.0, 2.2),
    roughness: 0.92,
    metalness: 0,
  });
  const slateDeckMat = new THREE.MeshStandardMaterial({
    color: 0xc8b69e,
    map: kitTex(THREE, 'stone', 4.5, 2.0),
    roughness: 0.88,
    metalness: 0,
  });
  const wroughtIron = new THREE.MeshStandardMaterial({ color: 0x4a4d5c, roughness: 0.62, metalness: 0 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe8b84b,
    roughness: 0.40,
    metalness: 0,
    emissive: 0x3b2406,
    emissiveIntensity: 0.16,
  });
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xc97842,
    roughness: 0.46,
    metalness: 0,
    emissive: 0x2e1204,
    emissiveIntensity: 0.12,
  });
  const warmGlow = new THREE.MeshStandardMaterial({
    color: 0xffe7a8,
    emissive: 0xffad3b,
    emissiveIntensity: 1.55,
    roughness: 0.36,
    metalness: 0,
  });

  const addGroundSlab = (cx, yTop, cz, w, h, d, mat = cobbleMat, paintHex = 0xcbb396) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(cx, yTop - h * 0.5, cz);
    m.userData.ground = true;
    m.userData.paint = new THREE.Color(paintHex);
    g.add(m);
    return m;
  };

  const addRailBalustrade = (x0, z0, x1, z1, yBase, railH = 0.92, colY0 = yBase - 0.18, colY1 = yBase + railH + 0.12) => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.25) return;
    const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
    const rot = Math.atan2(dx, dz);

    // Low stone curb + wrought-iron balusters + gleaming brass top rail
    const curb = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.24, len, 1, 0.03), dressedStone);
    curb.position.set(cx, yBase + 0.12, cz);
    curb.rotation.y = rot;
    g.add(curb);

    const topRail = new THREE.Mesh(new RoundedBoxGeometry(0.10, 0.07, len, 1, 0.02), brassMat);
    topRail.position.set(cx, yBase + railH, cz);
    topRail.rotation.y = rot;
    g.add(topRail);

    const midRail = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.045, len, 1, 0.01), wroughtIron);
    midRail.position.set(cx, yBase + railH * 0.56, cz);
    midRail.rotation.y = rot;
    g.add(midRail);

    const posts = Math.max(2, Math.round(len / 1.45));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const px = x0 + dx * t, pz = z0 + dz * t;
      const isNewel = i === 0 || i === posts;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(isNewel ? 0.075 : 0.035, isNewel ? 0.095 : 0.042, railH - 0.16, 8),
        wroughtIron
      );
      post.position.set(px, yBase + 0.18 + (railH - 0.16) * 0.5, pz);
      g.add(post);
      if (isNewel) {
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), brassMat);
        finial.position.set(px, yBase + railH + 0.08, pz);
        g.add(finial);
      }
    }

    colliders.push({
      x: cx,
      z: cz,
      w: 0.34,
      d: len,
      rot,
      y0: colY0,
      y1: colY1,
      noJump: true,
    });
  };

  // --------------------------------------------------------------------------
  // 1. TIER 1 LOWER CANAL PROMENADE (`y = 0.85m`, `z >= 13.4`)
  // --------------------------------------------------------------------------
  // North bank cobble promenade (`z in [13.4, 19.9]`) + West Apothecary plaza (`x in [-27, -7.6], z in [19.9, 29.5]`)
  // + South Canal Towpath (`z in [23.3, 29.5]`) + East bank (`x in [22.8, 27], z in [19.9, 29.5]`)
  addGroundSlab(0.0, Y_T1, 16.65, 56.0, 0.90, 6.55, cobbleMat, 0xc8b094);
  addGroundSlab(-17.3, Y_T1, 24.7, 19.4, 0.90, 9.6, cobbleMat, 0xc8b094);
  addGroundSlab(7.6, Y_T1, 26.4, 30.4, 0.90, 6.2, cobbleMat, 0xc8b094);
  addGroundSlab(24.9, Y_T1, 21.6, 4.2, 0.90, 3.6, cobbleMat, 0xc8b094);

  // Stone-walled canal bed (`y = 0.04m`) & dressed masonry side walls (`z = 19.9` & `z = 23.3`)
  addGroundSlab((CANAL_X0 + CANAL_X1) * 0.5, 0.06, CANAL_ZC, CANAL_X1 - CANAL_X0 + 0.6, 0.25, CANAL_Z1 - CANAL_Z0 + 0.6, darkMasonry, 0x47a4be);
  for (const czWall of [CANAL_Z0 - 0.16, CANAL_Z1 + 0.16]) {
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(CANAL_X1 - CANAL_X0 + 0.4, 0.88, 0.34), darkMasonry);
    wallMesh.position.set((CANAL_X0 + CANAL_X1) * 0.5, 0.44, czWall);
    g.add(wallMesh);
  }
  // West arched stone culvert headwall at `x = CANAL_X0`
  const culvert = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.96, CANAL_Z1 - CANAL_Z0 + 0.6, 1, 0.05), dressedStone);
  culvert.position.set(CANAL_X0 - 0.12, 0.48, CANAL_ZC);
  g.add(culvert);
  const culvArch = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.16, 6, 16, PI), darkMasonry);
  culvArch.position.set(CANAL_X0 + 0.14, 0.28, CANAL_ZC);
  culvArch.rotation.y = PI / 2;
  g.add(culvArch);

  // Low standable canal-side coping stones & brass chain posts (open at the 2 stone bridges!)
  const canalSegs = [
    [CANAL_X0, -1.8 - 1.95],
    [-1.8 + 1.95, 8.8 - 1.95],
    [8.8 + 1.95, CANAL_X1],
  ];
  for (const [sx0, sx1] of canalSegs) {
    const segLen = sx1 - sx0, scx = (sx0 + sx1) * 0.5;
    for (const czCurb of [CANAL_Z0 - 0.18, CANAL_Z1 + 0.18]) {
      const coping = new THREE.Mesh(new RoundedBoxGeometry(segLen, 0.26, 0.38, 1, 0.04), dressedStone);
      coping.position.set(scx, Y_T1 + 0.13, czCurb);
      g.add(coping);
      const postsN = Math.max(2, Math.round(segLen / 2.2));
      for (let p = 0; p <= postsN; p++) {
        const px = sx0 + (p / postsN) * segLen;
        const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.46, 8), wroughtIron);
        bollard.position.set(px, Y_T1 + 0.34, czCurb);
        g.add(bollard);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), brassMat);
        cap.position.set(px, Y_T1 + 0.58, czCurb);
        g.add(cap);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. TIER 2 CENTRAL STAR-COMPASS MARKET SQUARE & NORTH WIZARD COURT (`y = 2.00m`)
  // --------------------------------------------------------------------------
  // Main Central Boulevard Slab (`z in [-11.6, +13.4]`, `x in [-29.0, +29.0]`)
  addGroundSlab(0.0, Y_T2, 0.9, 58.0, 1.25, 25.0, cobbleMat, 0xcbb396);
  // North Under-Viaduct & Wizard Court Slab (`x in [-24.0, +4.0], z in [-28.0, -11.6]`)
  addGroundSlab(-10.0, Y_T2, -19.8, 28.0, 1.25, 16.4, cobbleMat, 0xcbb396);

  // Retaining Masonry Wall along `z = 13.4` (Tier 2 `2.00m` -> Tier 1 `0.85m`)
  const retWallT12 = new THREE.Mesh(new THREE.BoxGeometry(56.0, 1.25, 0.44), darkMasonry);
  retWallT12.position.set(0, 1.40, 13.4);
  g.add(retWallT12);

  // Balustrade along `z = 13.4` leaving clear wide openings at `st_t1_w` (-11.4), `st_t1_c` (-1.8), `st_t1_e` (+8.8)
  addRailBalustrade(-27.5, 13.4, -11.4 - 1.92, 13.4, Y_T2, 0.92, Y_T1 - 0.15, Y_T2 + 1.02);
  addRailBalustrade(-11.4 + 1.92, 13.4, -1.8 - 2.02, 13.4, Y_T2, 0.92, Y_T1 - 0.15, Y_T2 + 1.02);
  addRailBalustrade(-1.8 + 2.02, 13.4, 8.8 - 2.02, 13.4, Y_T2, 0.92, Y_T1 - 0.15, Y_T2 + 1.02);
  addRailBalustrade(8.8 + 2.02, 13.4, 20.4 - 1.65, 13.4, Y_T2, 0.92, Y_T1 - 0.15, Y_T2 + 1.02);
  addRailBalustrade(20.4 + 1.65, 13.4, 27.5, 13.4, Y_T2, 0.92, Y_T1 - 0.15, Y_T2 + 1.02);

  // --------------------------------------------------------------------------
  // 3. ALL 5 WIDE WALKABLE DRESSED-STONE STAIRCASES + CHEEK BALUSTRADES
  // --------------------------------------------------------------------------
  for (const st of STAIRS) {
    const steps = st.y1 - st.y0 > 1.8 ? 16 : 10;
    const zSpan = st.z1 - st.z0;
    const stepD = Math.abs(zSpan) / steps;
    const dirZ = Math.sign(zSpan);
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const syTop = st.y0 + (st.y1 - st.y0) * ((i + 1) / steps);
      const sz = st.z0 + dirZ * (i + 0.5) * stepD;
      const hStep = syTop - (st.y0 - 0.15);
      const tread = new THREE.Mesh(
        new RoundedBoxGeometry(st.halfW * 2, hStep, stepD + 0.05, 1, 0.025),
        i % 2 === 0 ? dressedStone : slateDeckMat
      );
      tread.position.set(st.cx, (st.y0 - 0.15) + hStep * 0.5, sz);
      tread.userData.ground = true;
      tread.userData.paint = new THREE.Color(0xd6c4ac);
      g.add(tread);
      if (t > 0.48 && t < 0.56) {
        // Decorative brass stair nosing medallion mid-flight
        const strip = new THREE.Mesh(new THREE.BoxGeometry(st.halfW * 1.92, 0.025, 0.05), brassMat);
        strip.position.set(st.cx, syTop + 0.005, sz - dirZ * stepD * 0.42);
        g.add(strip);
      }
    }
    // Sloped stone stair-cheek parapets & brass handrails on left & right sides
    const czMid = (st.z0 + st.z1) * 0.5;
    const cyMid = (st.y0 + st.y1) * 0.5;
    const slopeAng = Math.atan2(st.y1 - st.y0, Math.abs(zSpan));
    const railLen = Math.hypot(zSpan, st.y1 - st.y0);
    for (const sx of [-1, 1]) {
      const wx = st.cx + sx * (st.halfW + 0.18);
      const cheek = new THREE.Mesh(
        new RoundedBoxGeometry(0.32, (st.y1 - st.y0) + 0.78, Math.abs(zSpan) - 0.12, 1, 0.03),
        dressedStone
      );
      cheek.position.set(wx, cyMid + 0.12, czMid);
      g.add(cheek);

      const handrail = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.06, railLen, 1, 0.02), brassMat);
      handrail.position.set(wx, cyMid + 0.78, czMid);
      handrail.rotation.x = dirZ < 0 ? slopeAng : -slopeAng;
      g.add(handrail);

      colliders.push({
        x: wx,
        z: czMid,
        w: 0.34,
        d: Math.abs(zSpan) - 0.24,
        y0: st.y0 - 0.15,
        y1: st.y1 + 0.92,
        noJump: true,
      });
    }
    // Twin glowing brass newel lanterns at foot of the grand Tier 3 staircases!
    if (st.y1 > 3.5) {
      for (const sx of [-1, 1]) {
        const lx = st.cx + sx * (st.halfW + 0.18), lz = st.z0 + 0.12;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.15, 8), wroughtIron);
        post.position.set(lx, st.y0 + 0.58, lz);
        g.add(post);
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), warmGlow);
        globe.position.set(lx, st.y0 + 1.24, lz);
        g.add(globe);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. TIER 3 ELEVATED WROUGHT-IRON & STONE RAIL VIADUCT + CLOCKTOWER TERRACE (`y = 4.35m`)
  // --------------------------------------------------------------------------
  // 4A. West Viaduct Bastion Terrace (`x in [-19.4, -14.4], z in [-16.0, -11.6], y = 4.35m`)
  addGroundSlab(-16.9, Y_T3, -13.8, 5.0, 2.40, 4.4, slateDeckMat, 0xc8b69e);
  addRailBalustrade(-19.4, -16.0, -19.4, -11.6, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.05);
  addRailBalustrade(-19.4, -16.0, -14.4, -16.0, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.05);

  // 4B. Elevated Arched Viaduct Deck (`x in [-14.4, +4.0], z in [-15.8, -11.6], width = 4.2m, y = 4.35m`)
  //     Deck slab spans `y = 4.08..4.35m` -> `2.08m` of open walkable headroom underneath at `y = 2.00m`!
  const viaLen = VIADUCT.x1 - VIADUCT.x0;
  const viaCx = (VIADUCT.x0 + VIADUCT.x1) * 0.5;
  addGroundSlab(viaCx, Y_T3, VIADUCT.zc, viaLen + 0.2, 0.27, VIADUCT.width, slateDeckMat, 0xc8b69e);

  // Riveted wrought-iron & brass girder fascias + inlaid elevated brass viaduct tracks!
  for (const sz of [-1, 1]) {
    const zFascia = VIADUCT.zc + sz * (VIADUCT.width * 0.5 + 0.03);
    const girder = new THREE.Mesh(new RoundedBoxGeometry(viaLen + 0.2, 0.32, 0.12, 1, 0.02), wroughtIron);
    girder.position.set(viaCx, Y_T3 - 0.15, zFascia);
    g.add(girder);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(viaLen + 0.2, 0.05, 0.15), brassMat);
    trim.position.set(viaCx, Y_T3 - 0.02, zFascia);
    g.add(trim);
  }
  for (const rOff of [-0.58, 0.58]) {
    const vRail = new THREE.Mesh(new THREE.BoxGeometry(viaLen + 6.5, 0.035, 0.08), brassMat);
    vRail.position.set(viaCx + 1.2, Y_T3 + 0.018, VIADUCT.zc + rOff);
    vRail.userData.ground = true;
    vRail.userData.paint = new THREE.Color(0xe8b84b);
    g.add(vRail);
  }

  // Viaduct Upper Safety Balustrades along `z = -15.8` & `z = -11.6`:
  // CRITICAL: `colY0 = 4.10, colY1 = 5.40` so Tier 3 (`4.35m`) is safely enclosed while Tier 2 (`2.00m`) walks underneath with ZERO invisible walls!
  addRailBalustrade(VIADUCT.x0, VIADUCT.z0 + 0.08, VIADUCT.x1, VIADUCT.z0 + 0.08, Y_T3, 0.94, 4.10, 5.42);
  addRailBalustrade(VIADUCT.x0, VIADUCT.z1 - 0.08, VIADUCT.x1, VIADUCT.z1 - 0.08, Y_T3, 0.94, 4.10, 5.42);

  // 4 Dressed-Stone & Riveted-Iron Viaduct Piers (`x = -13.6, -8.2, -2.8, +2.6`) + 3 Grand Open 4.2m Archways!
  for (const px of VIADUCT.pierXs) {
    const pier = new THREE.Mesh(new RoundedBoxGeometry(1.18, 2.18, VIADUCT.width - 0.16, 1, 0.05), dressedStone);
    pier.position.set(px, Y_T2 + 1.06, VIADUCT.zc);
    g.add(pier);
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.34, 0.28, VIADUCT.width + 0.04, 1, 0.04), darkMasonry);
    plinth.position.set(px, Y_T2 + 0.12, VIADUCT.zc);
    g.add(plinth);
    // Warm coach lanterns on south & north pier faces
    for (const sz of [-1, 1]) {
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.24, 6), warmGlow);
      lantern.position.set(px, Y_T2 + 1.78, VIADUCT.zc + sz * (VIADUCT.width * 0.5 + 0.12));
      g.add(lantern);
    }
    colliders.push({
      x: px,
      z: VIADUCT.zc,
      w: 1.20,
      d: VIADUCT.width - 0.12,
      y0: Y_T2 - 0.15,
      y1: Y_T3 + 0.05,
      noJump: true,
    });
  }

  // Sculpted Wrought-Iron Arch Ribs & Brass Clockwork Spandrel Gears spanning the 3 Open Underpasses (`y >= 3.55m`)!
  for (const ax of VIADUCT.archXs) {
    for (const sz of [-1, 1]) {
      const zArch = VIADUCT.zc + sz * (VIADUCT.width * 0.5 - 0.08);
      const archRib = new THREE.Mesh(new THREE.TorusGeometry(2.08, 0.11, 6, 20, PI), wroughtIron);
      archRib.scale.set(1.0, 0.42, 1.0);
      archRib.position.set(ax, Y_T2 + 1.24, zArch);
      g.add(archRib);
      // Decorative toothed brass spandrel cogwheels flanking the arch crown
      for (const gx of [-1.52, 1.52]) {
        const spGear = new THREE.Mesh(makeGearGeo(THREE, 0.28, 0.05, 12, 5), gx < 0 ? brassMat : copperMat);
        spGear.position.set(ax + gx, Y_T3 - 0.42, zArch + sz * 0.04);
        g.add(spGear);
      }
    }
  }

  // 4C. NE Grand Clocktower Terrace & Promenade (`x in [+4.0, +25.4], z in [-26.2, -11.6], y = 4.35m`)
  addGroundSlab(14.7, Y_T3, -18.9, 21.4, 2.45, 14.6, cobbleMat, 0xd4be9e);
  // Dressed-stone retaining cliff fascia walls along west (`x = 4.0`) & south (`z = -11.6`)
  const westCliff = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.45, 10.6), darkMasonry);
  westCliff.position.set(4.0, (Y_T2 + Y_T3) * 0.5, -21.0);
  g.add(westCliff);
  const southCliff = new THREE.Mesh(new THREE.BoxGeometry(21.4, 2.45, 0.46), darkMasonry);
  southCliff.position.set(14.7, (Y_T2 + Y_T3) * 0.5, -11.6);
  g.add(southCliff);

  // Clocktower Promenade Perimeter Balustrades (leaving clear `4.3m` opening at `st_t2_ne` `x in [13.05, 17.35]` & Viaduct `z in [-15.8, -11.6]`)
  addRailBalustrade(4.0, -26.2, 4.0, -15.85, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.08);
  addRailBalustrade(4.0, -11.6, 15.2 - 2.22, -11.6, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.08);
  addRailBalustrade(15.2 + 2.22, -11.6, 23.0 - 1.65, -11.6, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.08);
  addRailBalustrade(23.0 + 1.65, -11.6, 25.4, -11.6, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.08);
  addRailBalustrade(25.4, -11.6, 25.4, -26.2, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.08);
  addRailBalustrade(4.0, -26.2, 25.4, -26.2, Y_T3, 0.95, Y_T2 - 0.15, Y_T3 + 1.08);

  mergeStatic(THREE, g);
  g.userData.colliders = colliders;
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      if (!m.userData.paint) m.userData.paint = m.material.color.clone();
    }
  });
  return g;
}

// ============================================================================
// Bespoke Clockwork Mechanics Helpers & WebAudio Synthesizers
// ============================================================================
function isSeekerChar(ch, G) {
  if (!ch) return false;
  const team = ch.userData?.actor?.team;
  if (team === 'seekers') return true;
  if (team === 'hiders') return false;
  if (G && ch === G.player) return G.mode === 'seek';
  if (G && Array.isArray(G.seekers) && G.seekers.includes(ch)) return true;
  return false;
}

function isHiderChar(ch, G) {
  if (!ch) return false;
  const team = ch.userData?.actor?.team;
  if (team === 'hiders') return true;
  if (team === 'seekers') return false;
  if (G && ch === G.player) return G.mode === 'hide';
  if (G && Array.isArray(G.hiders) && G.hiders.includes(ch)) return true;
  return false;
}

function isMidnightRushActive(nowSec, G) {
  if (G?.over) return false;
  if (WORLD_STATE.midnightPermanent || nowSec < WORLD_STATE.midnightLeverUntil) return true;
  return !!(G && (G.phase === 'seek' || G.phase === 'survive') && typeof G.t === 'number' && G.t <= 45);
}

function playPendulumClangAudio(audio) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    [196.0, 311.13, 523.25].forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = idx === 0 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(freq * 0.86, now + 0.42);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.20 / (idx + 1), now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      o.connect(g);
      g.connect(dest);
      o.start(now);
      o.stop(now + 0.48);
    });
  } catch (_) { /* WebAudio guard */ }
}

function playChronoWarpAudio(audio) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    [880, 659.25, 440, 329.63].forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      const t0 = now + idx * 0.055;
      o.frequency.setValueAtTime(freq, t0);
      o.frequency.exponentialRampToValueAtTime(freq * 0.72, t0 + 0.34);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
      o.connect(g);
      g.connect(dest);
      o.start(t0);
      o.stop(t0 + 0.40);
    });
  } catch (_) { /* WebAudio guard */ }
}

function playTrolleyBellAudio(audio) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    [0, 0.14].forEach((off) => {
      const t0 = now + off;
      [1174.66, 1760.0].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = idx === 0 ? 'sine' : 'triangle';
        o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.16 / (idx + 1), t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
        o.connect(g);
        g.connect(dest);
        o.start(t0);
        o.stop(t0 + 0.30);
      });
    });
  } catch (_) { /* WebAudio guard */ }
}

function playMidnightChimesAudio(audio) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    [0, 0.32, 0.64].forEach((off, strike) => {
      const t0 = now + off;
      const rootF = strike === 2 ? 220.0 : 196.0;
      [rootF, rootF * 1.5, rootF * 2.0, rootF * 2.67].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = idx % 2 === 0 ? 'sine' : 'triangle';
        o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.22 / (idx + 1), t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.35);
        o.connect(g);
        g.connect(dest);
        o.start(t0);
        o.stop(t0 + 1.40);
      });
    });
  } catch (_) { /* WebAudio guard */ }
}

function clearTimeDomes() {
  for (const d of WORLD_STATE.timeDomes) {
    if (d.group && d.group.parent) d.group.parent.remove(d.group);
  }
  WORLD_STATE.timeDomes.length = 0;
}

function triggerMidnightRush(nowSec, source = 'timer') {
  if (source === 'lever') {
    WORLD_STATE.midnightLeverUntil = Math.max(WORLD_STATE.midnightLeverUntil, nowSec + 18.0);
    WORLD_STATE.escapementPullT = 1.0;
  } else {
    WORLD_STATE.midnightDone = true;
    WORLD_STATE.midnightPermanent = true;
  }
  WORLD_STATE.wheelSpinBoost = Math.max(WORLD_STATE.wheelSpinBoost, PI * 3.0);
  WORLD_STATE.bellSwingAmp = Math.max(WORLD_STATE.bellSwingAmp, 0.55);
  WORLD_STATE.bellSwingPhase = 0;
  playMidnightChimesAudio(WORLD_STATE.audio);
  if (WORLD_STATE.audio) playTurretFireAudio(WORLD_STATE.audio, 'bell');
  if (WORLD_STATE.emitSoundCue) {
    WORLD_STATE.emitSoundCue({ x: 13.6, y: Y_T3 + 2.5, z: -17.3 }, 22.0, 'bell', null);
  }
  if (source === 'timer' && WORLD_STATE.notify) {
    WORLD_STATE.notify('🕛 CLOCK STRIKES TWELVE! Midnight Rush — Gear-Lifts 1.8x & Hiders 1.26x speed!', 3200);
  }
}

function triggerBelfryBell(actor = null, fromShot = false) {
  const nowSec = performance.now() * 0.001;
  if (nowSec < WORLD_STATE.bellCdUntil) {
    const rem = Math.ceil(WORLD_STATE.bellCdUntil - nowSec);
    if (fromShot && actor && actor === WORLD_STATE.getG?.()?.player && WORLD_STATE.notify) {
      WORLD_STATE.notify(`🔔 Great Bronze Bell resonating (${rem}s)!`, 1200);
    }
    return `⏳ Great Bronze Bell recharging (${rem}s)!`;
  }

  WORLD_STATE.bellCdUntil = nowSec + 12.0;
  const bellMs = WORLD_STATE.mechSpots.find((m) => m.id === 'belfry_chime_bell');
  if (bellMs) bellMs.cdUntil = WORLD_STATE.bellCdUntil;

  if (WORLD_STATE.audio) {
    playTurretFireAudio(WORLD_STATE.audio, 'bell');
  }
  WORLD_STATE.bellSwingAmp = Math.max(WORLD_STATE.bellSwingAmp, 0.92);
  WORLD_STATE.bellSwingPhase = 0;
  WORLD_STATE.bellPulseUntil = WORLD_STATE.elapsed + 2.6;
  if (WORLD_STATE.bellPulseMesh) {
    WORLD_STATE.bellPulseMesh.visible = true;
    WORLD_STATE.bellPulseMesh.scale.setScalar(0.5);
  }
  if (WORLD_STATE.bellGroundPulseMesh) {
    WORLD_STATE.bellGroundPulseMesh.visible = true;
    WORLD_STATE.bellGroundPulseMesh.scale.setScalar(0.5);
  }

  // Acoustic Prop-Rattle: set `_propJitterUntil` on ALL disguised Hiders within 22m of the Belfry Bell!
  const liveG = WORLD_STATE.getG?.() || null;
  const candidates = new Set();
  if (WORLD_STATE.getActors) {
    for (const a of WORLD_STATE.getActors() || []) if (a) candidates.add(a);
  }
  if (liveG?.hiders) {
    for (const h of liveG.hiders) if (h) candidates.add(h);
  }
  if (liveG?.allHiders) {
    for (const h of liveG.allHiders) if (h) candidates.add(h);
  }
  if (liveG?.player && liveG.mode === 'hide') {
    candidates.add(liveG.player);
  }
  const jitterUntil = performance.now() + 2100;
  let rattled = 0;
  for (const h of candidates) {
    const u = h?.userData;
    if (!u || u.actor?.eliminated) continue;
    if (isSeekerChar(h, liveG)) continue;
    if (!(u.propId || u.specialMode)) continue;
    const dBell = Math.hypot(h.position.x - BELFRY_BELL_CENTER.x, h.position.z - BELFRY_BELL_CENTER.z);
    if (dBell <= 22.0) {
      u._propJitterUntil = jitterUntil;
      rattled++;
    }
  }
  WORLD_STATE.bellRattledCount = rattled;

  let flushed = 0;
  if (WORLD_STATE.creatures?.agents) {
    const origin = actor?.position || new THREE_MOD.Vector3(BELFRY_BELL_CENTER.x, Y_T3, BELFRY_BELL_CENTER.z);
    for (const a of WORLD_STATE.creatures.agents) {
      const d = Math.hypot(a.g.position.x - BELFRY_BELL_CENTER.x, a.g.position.z - BELFRY_BELL_CENTER.z);
      if (d <= 22.0) {
        a.rec?.onStartled?.(WORLD_STATE.elapsed, origin);
        flushed++;
      }
    }
  }
  WORLD_STATE.bellStartledCount = flushed;

  if (WORLD_STATE.emitSoundCue) {
    WORLD_STATE.emitSoundCue({ x: BELFRY_BELL_CENTER.x, y: Y_T3 + 1.0, z: BELFRY_BELL_CENTER.z }, 22.0, 'bell', actor);
  }

  const msg = rattled > 0
    ? `🔔 DONG!! Belfry Acoustic Shockwave rattled ${rattled} disguised prop${rattled === 1 ? '' : 's'} within 22m!`
    : '🔔 DONG!! Golden acoustic shockwave sweeps Pendulum Square (22m)!';
  if (fromShot && WORLD_STATE.notify) WORLD_STATE.notify(msg, 2400);
  return msg;
}

function activateChronoPocketwatch(pw, actor = null, nowSec = performance.now() * 0.001) {
  if (!pw) return null;
  if (nowSec < pw.cdUntil) {
    return `⏳ Chrono Pocketwatch recharging (${Math.ceil(pw.cdUntil - nowSec)}s)!`;
  }
  pw.cdUntil = nowSec + 16.0;
  const ms = WORLD_STATE.mechSpots.find((m) => m.id === pw.mechId);
  if (ms) ms.cdUntil = pw.cdUntil;
  if (pw.watchMesh) pw.watchMesh.visible = false;
  if (pw.ringMesh && pw.ringMesh.material) pw.ringMesh.material.opacity = 0.22;

  const radius = 9.5;
  const grp = new THREE_MOD.Group();
  grp.userData.keep = true;
  grp.position.set(pw.x, pw.y + 0.5, pw.z);

  const shellMat = new THREE_MOD.MeshStandardMaterial({
    color: 0xd9a85c,
    emissive: 0x6b4514,
    emissiveIntensity: 0.42,
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE_MOD.DoubleSide,
  });
  const shellMesh = new THREE_MOD.Mesh(new THREE_MOD.SphereGeometry(radius, 28, 18), shellMat);
  shellMesh.userData.keep = true;
  shellMesh.userData.noSolid = true;
  grp.add(shellMesh);

  const ringMat = new THREE_MOD.MeshBasicMaterial({
    color: 0xf4c468,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const ringMesh = new THREE_MOD.Mesh(new THREE_MOD.TorusGeometry(radius, 0.08, 6, 48), ringMat);
  ringMesh.rotation.x = PI / 2;
  ringMesh.position.y = -0.32;
  ringMesh.userData.keep = true;
  ringMesh.userData.noSolid = true;
  grp.add(ringMesh);

  const dialMat = new THREE_MOD.MeshBasicMaterial({
    color: 0xe6af52,
    transparent: true,
    opacity: 0.24,
    side: THREE_MOD.DoubleSide,
    depthWrite: false,
  });
  const dialMesh = new THREE_MOD.Mesh(new THREE_MOD.RingGeometry(radius - 0.85, radius - 0.08, 48), dialMat);
  dialMesh.rotation.x = -PI / 2;
  dialMesh.position.y = -0.30;
  dialMesh.userData.keep = true;
  dialMesh.userData.noSolid = true;
  grp.add(dialMesh);

  if (WORLD_STATE.root) WORLD_STATE.root.add(grp);
  WORLD_STATE.timeDomes.push({
    id: pw.id,
    x: pw.x,
    y: pw.y + 0.5,
    z: pw.z,
    radius,
    startAt: nowSec,
    until: nowSec + 5.0,
    group: grp,
    shellMesh,
    ringMesh,
    dialMesh,
  });

  playChronoWarpAudio(WORLD_STATE.audio);
  if (WORLD_STATE.emitSoundCue) {
    WORLD_STATE.emitSoundCue({ x: pw.x, y: pw.y + 0.6, z: pw.z }, 12.0, 'chime', actor);
  }
  const msg = `⏱️ ${pw.name}! 5.0s Sepia Time-Slow Dome (9.5m) — Pendulums FROZEN, Seekers 0.45x, Hiders 1.18x!`;
  if (WORLD_STATE.notify) WORLD_STATE.notify(msg, 2600);
  return msg;
}

// ============================================================================
// Exported Map Definition (`MAP_DEF`)
// ============================================================================
export const MAP_DEF = {
  id: 'clockwork',
  title: "Pendulum Square · Clockwork Market",
  subtitle: '3-tier Alsace cobble plaza, rideable brass streetcar, swinging clock pendulums & Chrono Time-Slow domes',
  badge: 'Clockwork Autumn',
  preview: 'assets/maps/clockwork/overview.webp',
  mapRadius: 34,

  camMenu: { r: 34.4, y: 21.0, lookX: 0.0, lookY: 2.05, lookZ: -1.4, baseAngle: 0.06, sway: 0.14 },
  playerSpawn: [-3.0, 4.8],
  seekerSpawns: [[-2.6, -3.2], [2.6, -3.2]],
  seekSpawn: [0.0, -3.6],
  hideIntroHint: '3-Tier Clockwork Market! Ride the Streetcar 🚋 (yank Conductor Bell!), dodge Swinging Pendulums 🕰️, grab Chrono Pocketwatches ⏱️, or warp via Dial Portals 🌀!',
  wildFlyerHint: '🦉 That was an autonomous Clockwork Owl patrolling the Belfry! Watch for wind-up Hiders gliding past!',
  getInteractHint(mode) {
    if (mode === 'seek') {
      return 'Ring or SHOOT the Belfry Bell 🔔 to rattle disguised props (22m!), ride Gear-Lifts ⚙️ & Streetcar 🚋, or pull the Clocktower Escapement!';
    }
    return 'Morph Clockwork Hound/Owl 🐕🦉 (`F`) for Gear Vents, grab Chrono Pocketwatches ⏱️ to freeze Pendulums & slow Seekers, pull Conductor Bell 🔔, or use Dial Portals 🌀!';
  },
  getTurret() {
    return null;
  },
  breaksLineOfSight() {
    return false;
  },
  onShotWorldImpact(info) {
    if (!info) return null;
    const hitObj = info.hitObject;
    const p = info.point;
    const nearBell = p && Math.hypot(p.x - BELFRY_BELL_CENTER.x, p.y - BELFRY_BELL_CENTER.y, p.z - BELFRY_BELL_CENTER.z) <= 1.55;
    if (hitObj?.userData?.isBelfryBell || nearBell) {
      triggerBelfryBell(info.shooter || null, true);
      return { consumed: true };
    }
    return null;
  },
  getSurfaceModifier(ch, G) {
    if (!ch || !ch.position) return null;
    const liveG = G || WORLD_STATE.getG?.() || null;
    const nowSec = performance.now() * 0.001;
    let speedMul = 1.0;

    if (isMidnightRushActive(nowSec, liveG) && isHiderChar(ch, liveG)) {
      speedMul *= 1.26;
    }

    const u = ch.userData || {};
    const cy = (u.groundY ?? ch.position.y ?? 0) + (u.jy || 0) + 0.5;
    for (let i = 0; i < WORLD_STATE.timeDomes.length; i++) {
      const dome = WORLD_STATE.timeDomes[i];
      if (nowSec >= dome.until) continue;
      if (Math.hypot(ch.position.x - dome.x, cy - dome.y, ch.position.z - dome.z) <= dome.radius) {
        if (isSeekerChar(ch, liveG)) {
          speedMul *= 0.45;
        } else if (isHiderChar(ch, liveG)) {
          speedMul *= 1.18;
        }
        break;
      }
    }

    if (Math.abs(speedMul - 1.0) < 1e-4) return null;
    return { speedMul, slipDrift: 0 };
  },
  sampleLauncherAt(ch, _G, _dt) {
    if (!ch || !ch.position || !ch.userData) return null;
    const u = ch.userData;
    if (u.specialMode || u.ridePath || u.rideRail) return null;
    const nowMs = performance.now();
    const lastHit = WORLD_STATE.pendulumHitCd.get(ch) || 0;
    if (nowMs - lastHit < 750) return null;

    const footY = (u.groundY ?? ch.position.y ?? 0) + (u.jy || 0);
    const charCenterY = footY + 0.65;
    for (let i = 0; i < WORLD_STATE.pendulums.length; i++) {
      const pend = WORLD_STATE.pendulums[i];
      if (pend.frozen) continue;
      if (Math.abs(footY - pend.groundY) > 1.35) continue;
      const dist = Math.hypot(ch.position.x - pend.bobX, charCenterY - pend.bobY, ch.position.z - pend.bobZ);
      if (dist <= 1.55) {
        WORLD_STATE.pendulumHitCd.set(ch, nowMs);
        playPendulumClangAudio(WORLD_STATE.audio);
        let knockVx = 0;
        let knockVz = 0;
        if (pend.axis === 'x') {
          const swingDir = Math.sign(pend.angVel) || Math.sign(ch.position.x - pend.bobX) || 1;
          knockVx = swingDir * 10.5;
          knockVz = clamp((ch.position.z - pend.bobZ) * 2.5, -3.5, 3.5);
        } else {
          const swingDir = -Math.sign(pend.angVel) || Math.sign(ch.position.z - pend.bobZ) || 1;
          knockVz = swingDir * 10.5;
          knockVx = clamp((ch.position.x - pend.bobX) * 2.5, -3.5, 3.5);
        }
        return {
          knockVx,
          knockVz,
          vy: 5.0,
          hintMsg: '🔔 CLANG! Bowled aside by the Giant Brass Clock Pendulum!',
        };
      }
    }
    return null;
  },
  onResetRound() {
    WORLD_STATE.conveyorDirSign = 1;
    WORLD_STATE.scrambleUntil = -1;
    WORLD_STATE.tramSurgeUntil = -1;
    WORLD_STATE.tramBellSwingAmp = 0;
    WORLD_STATE.midnightDone = false;
    WORLD_STATE.midnightPermanent = false;
    WORLD_STATE.midnightLeverUntil = -1;
    WORLD_STATE.escapementPullT = 0;
    WORLD_STATE.bellCdUntil = 0;
    WORLD_STATE.bellSwingAmp = 0;
    WORLD_STATE.bellPulseUntil = -99;
    WORLD_STATE.bellRattledCount = 0;
    WORLD_STATE.bellStartledCount = 0;
    if (WORLD_STATE.bellPulseMesh) WORLD_STATE.bellPulseMesh.visible = false;
    if (WORLD_STATE.bellGroundPulseMesh) WORLD_STATE.bellGroundPulseMesh.visible = false;
    clearTimeDomes();
    WORLD_STATE.pendulumHitCd.clear();
    for (const pend of WORLD_STATE.pendulums) {
      pend.frozen = false;
    }
    for (const pw of WORLD_STATE.pocketwatches) {
      pw.cdUntil = 0;
      if (pw.watchMesh) pw.watchMesh.visible = true;
      if (pw.ringMesh && pw.ringMesh.material) pw.ringMesh.material.opacity = 0.85;
    }
    for (const ge of WORLD_STATE.gearElevators) {
      ge.animClock = 0;
      ge.phaseOffset = ge.basePhase;
    }
    for (const sp of WORLD_STATE.mechSpots) sp.cdUntil = 0;
  },

  sky: {
    top: 0x3b6cb8,
    mid: 0xa6c8eb,
    bot: 0xffd296,
    sunDisc: 0xfff0be,
    sunDir: [-0.42, 0.36, -0.83],
  },
  fog: { color: 0xcbdcf0, near: 52, far: 138 },
  lights: {
    hemiSky: 0xdcedff,
    hemiGround: 0x946e48,
    hemiInt: 1.35,
    sunColor: 0xffd290,
    sunInt: 2.58,
    sunPos: [-18, 27, 18],
    exposure: 1.08,
  },

  props: MAP_PROPS,
  propIcons: MAP_PROP_ICONS,
  disguisePool: PROPS.map((p) => p.id),
  buildingDefs: BUILDING_DEFS,
  buildings: BUILDING_DEFS,
  seekerKinds: SEEKER_DEFS.map((s) => s.id),
  seekerLabels: Object.fromEntries(SEEKER_DEFS.map((s) => [s.id, s.label])),
  hiderSkin: HIDER_DEF,
  buildProps: buildMapProps,
  buildBuildings,
  buildSeeker: buildMapSeeker,
  buildHider: buildMapHider,

  groundHeightAt(x, z, refY) {
    return sampleClockworkHeight(x, z, refY);
  },

  sampleHeight(x, z, refY) {
    return sampleClockworkHeight(x, z, refY);
  },

  isDeepWater(x, z) {
    return inCanalWater(x, z);
  },

  groundColorAt(x, z, outColor) {
    const out = outColor || new THREE_MOD.Color();
    if (inCanalWater(x, z)) return out.setHex(0x47a4be);
    const dStar = Math.hypot(x - TRAM_CX, z - TRAM_CZ);
    if (dStar < 8.6) {
      const ang = Math.atan2(z - TRAM_CZ, x - TRAM_CX);
      const ray = Math.abs(Math.sin(ang * 6));
      return out.setHex(ray > 0.62 ? 0xe8c06c : 0x7e859c);
    }
    if (Math.hypot(x, z) < 28.5) return out.setHex(0xcbb396);
    return out.setHex(0xb89652);
  },

  surfaceAt(x, z) {
    if (Math.hypot(x, z) < 28.8) return 'stone';
    return 'grass';
  },

  // Carry players & AI standing on the Looping Streetcar Tram (`y = 2.48m` / `2.24m`) around the plaza!
  applyPlatformMotion(c, dt = 0.016) {
    if (!c) return;
    if (WORLD_STATE.tracks) WORLD_STATE.tracks.applyMotion(c, dt);
    const u = c.userData || {};
    const gy = u.groundY ?? 0;

    // Carry players & AI cleanly vertically on Moving Brass Gear-Elevators
    for (let i = 0; i < WORLD_STATE.gearElevators.length; i++) {
      const ge = WORLD_STATE.gearElevators[i];
      if (Math.hypot(c.position.x - ge.x, c.position.z - ge.z) <= ge.r + 0.12 && Math.abs(gy - ge.y) <= 0.65) {
        u.groundY = ge.y;
        return;
      }
    }

    if (!WORLD_STATE.tramReady) return;
    const tr = WORLD_STATE.tram;
    if (gy < Y_T2 + 0.16 || gy > Y_T2 + 0.88) return;
    const [lx, lz] = worldToTramLocal(c.position.x, c.position.z, tr.prevX, tr.prevZ, tr.prevYaw);
    if (Math.abs(lx) <= 1.46 && Math.abs(lz) <= 3.08) {
      const [nx, nz] = tramLocalToWorld(lx, lz, tr.x, tr.z, tr.yaw);
      c.position.x = nx;
      c.position.z = nz;
      let dYaw = tr.yaw - tr.prevYaw;
      while (dYaw > PI) dYaw -= TAU;
      while (dYaw < -PI) dYaw += TAU;
      c.rotation.y += dYaw;
    }
  },

  // Multi-tier AI router across Canal Bridges, 5 Stone Staircases & 3 Viaduct Underpass Arches!
  routeTierWaypoint(from, goal) {
    if (!from || !goal) return null;
    const tFrom = tierKeyOf(from.x, from.z, from.y);
    const tGoal = tierKeyOf(goal.x, goal.z, goal.y);

    const nearestCanalBridge = (refX) =>
      Math.abs(refX - (-1.8)) <= Math.abs(refX - 8.8) ? -1.8 : 8.8;

    const nearestT1Stair = (refX) => {
      const xs = [-11.4, -1.8, 8.8];
      return xs.reduce((best, cx) => (Math.abs(refX - cx) < Math.abs(refX - best) ? cx : best), xs[0]);
    };

    const nearestViaductArch = (refX) =>
      VIADUCT.archXs.reduce((best, ax) => (Math.abs(refX - ax) < Math.abs(refX - best) ? ax : best), -5.5);

    // 0. Active Staircase Corridor Lock: while mid-flight between stair cheek walls,
    //    finish walking cleanly out the top or bottom landing before turning sideways!
    for (const st of STAIRS) {
      if (st.y1 > 3.5) {
        // Tier 2 <-> Tier 3 grand staircases (`z0 = -5.6` at `2.00m`, `z1 = -11.6` at `4.35m`)
        if (Math.abs(from.x - st.cx) <= st.halfW + 0.28 && from.z >= -11.65 && from.z <= -5.82) {
          return tGoal === 't3'
            ? { x: st.cx, y: Y_T3, z: -12.65 }
            : { x: st.cx, y: Y_T2, z: -4.45 };
        }
      } else {
        // Tier 1 <-> Tier 2 canal staircases (`z0 = 17.0` at `0.85m`, `z1 = 13.4` at `2.00m`)
        if (Math.abs(from.x - st.cx) <= st.halfW + 0.28 && from.z >= 13.55 && from.z <= 16.85) {
          return tGoal === 't1'
            ? { x: st.cx, y: Y_T1, z: 17.85 }
            : { x: st.cx, y: Y_T2, z: 12.35 };
        }
      }
    }

    // 1. Within Tier 1: route across Arched Stone Bridges over the Lower Canal (`z in [19.9, 23.3]`)
    if (tFrom === 't1' && tGoal === 't1') {
      if (goal.z > 23.4 && from.z < 24.0 && (from.x > CANAL_X0 - 0.4 || goal.x > CANAL_X0 - 0.4)) {
        const bx = nearestCanalBridge(from.z >= 19.3 ? from.x : (from.x + goal.x) * 0.5);
        if (from.z < 19.3 && Math.abs(from.x - bx) > 1.15) return { x: bx, y: Y_T1, z: 18.5 };
        return { x: bx, y: Y_T1, z: 24.6 };
      }
      if (goal.z < 19.8 && from.z > 19.2 && (from.x > CANAL_X0 - 0.4 || goal.x > CANAL_X0 - 0.4)) {
        const bx = nearestCanalBridge(from.z <= 23.9 ? from.x : (from.x + goal.x) * 0.5);
        if (from.z > 23.9 && Math.abs(from.x - bx) > 1.15) return { x: bx, y: Y_T1, z: 24.6 };
        return { x: bx, y: Y_T1, z: 18.5 };
      }
      return null;
    }

    // 2. Tier 1 -> Tier 2 (or Tier 3 via Tier 2)
    if (tFrom === 't1' && (tGoal === 't2' || tGoal === 't3')) {
      if (from.z > 19.2 && from.x > CANAL_X0 - 0.4 && from.z > 23.3) {
        const bx = nearestCanalBridge(from.x);
        if (from.z > 23.9 && Math.abs(from.x - bx) > 1.15) return { x: bx, y: Y_T1, z: 24.6 };
        return { x: bx, y: Y_T1, z: 18.4 };
      }
      const sx = nearestT1Stair((from.x + goal.x) * 0.5);
      if (Math.abs(from.x - sx) > 1.25 || from.z > 18.5) return { x: sx, y: Y_T1, z: 17.75 };
      return { x: sx, y: Y_T2, z: 12.35 };
    }

    // 3. Tier 2 -> Tier 1
    if (tFrom === 't2' && tGoal === 't1') {
      if (from.z < -11.3) {
        const ax = nearestViaductArch(from.z >= -16.2 ? from.x : (from.x + goal.x) * 0.5);
        if (from.z < -16.2 && Math.abs(from.x - ax) > 1.15) return { x: ax, y: Y_T2, z: -16.8 };
        return { x: ax, y: Y_T2, z: -10.3 };
      }
      const sx = nearestT1Stair((from.x + goal.x) * 0.5);
      if (Math.abs(from.x - sx) > 1.25 || from.z < 11.6) return { x: sx, y: Y_T2, z: 12.45 };
      return { x: sx, y: Y_T1, z: 17.85 };
    }

    // 4. Within Tier 2: step around Tier 3 stair cheeks, Wizard corner, Viaduct arches & Orrery Fountain!
    if (tFrom === 't2' && tGoal === 't2') {
      if (from.x < -14.2 && from.z < -4.1 && goal.x > -14.2 && goal.z < -5.5) {
        return { x: -13.2, y: Y_T2, z: -3.9 };
      }
      if (from.x > 12.5 && from.z < -4.1 && goal.x < 12.5 && goal.z < -5.5) {
        return { x: 11.6, y: Y_T2, z: -3.9 };
      }
      if (from.z < -16.6 && from.x < -0.4 && goal.x > 0.0 && goal.z < -18.5) {
        return { x: 0.2, y: Y_T2, z: -17.2 };
      }
      if (goal.z < -15.8 && from.z > -16.2) {
        const ax = nearestViaductArch(from.z <= -11.2 ? from.x : (from.x + goal.x) * 0.5);
        if (from.z > -11.2 && Math.abs(from.x - ax) > 1.15) return { x: ax, y: Y_T2, z: -10.3 };
        return { x: ax, y: Y_T2, z: -16.8 };
      }
      if (goal.z > -11.6 && from.z < -11.2) {
        const ax = nearestViaductArch(from.z >= -16.2 ? from.x : (from.x + goal.x) * 0.5);
        if (from.z < -16.2 && Math.abs(from.x - ax) > 1.15) return { x: ax, y: Y_T2, z: -16.8 };
        return { x: ax, y: Y_T2, z: -10.3 };
      }
      // Smoothly curve around the centerpiece Orrery Fountain (`(0, 0.8)`, `r ~ 2.1m`)!
      const vx = goal.x - from.x, vz = goal.z - from.z, vv = vx * vx + vz * vz;
      if (vv > 0.6) {
        const u = clamp(((TRAM_CX - from.x) * vx + (TRAM_CZ - from.z) * vz) / vv, 0, 1);
        if (u > 0.05 && u < 0.95) {
          const px = from.x + vx * u, pz = from.z + vz * u;
          if (Math.hypot(px - TRAM_CX, pz - TRAM_CZ) < 2.48) {
            const side = (from.x + goal.x) >= 0 ? 1 : -1;
            return { x: TRAM_CX + side * 3.35, y: Y_T2, z: TRAM_CZ };
          }
        }
      }
      return null;
    }

    // 5. Tier 2 -> Tier 3
    if (tFrom === 't2' && tGoal === 't3') {
      if (from.z < -11.3) {
        const ax = nearestViaductArch(from.z >= -16.2 ? from.x : (from.x + goal.x) * 0.5);
        if (from.z < -16.2 && Math.abs(from.x - ax) > 1.15) return { x: ax, y: Y_T2, z: -16.8 };
        return { x: ax, y: Y_T2, z: -10.2 };
      }
      const useWest = goal.x < -2.0 || (goal.x < 4.5 && from.x < -6.0);
      const sx = useWest ? -16.8 : 15.2;
      if (Math.abs(from.x - sx) > 1.25 || from.z > -3.6 || from.z < -5.8) return { x: sx, y: Y_T2, z: -4.65 };
      return { x: sx, y: Y_T3, z: -12.65 };
    }

    // 6. Tier 3 -> Tier 2 (or Tier 1 via Tier 2)
    if (tFrom === 't3' && (tGoal === 't2' || tGoal === 't1')) {
      const useWest = from.x < -1.0 || (from.x < 4.5 && goal.x < -6.0);
      const sx = useWest ? -16.8 : 15.2;
      if (!useWest && from.x < 4.3) return { x: 5.4, y: Y_T3, z: -13.2 };
      if (useWest && from.x > -14.2) return { x: -15.4, y: Y_T3, z: -13.2 };
      if (Math.abs(from.x - sx) > 1.25 || from.z < -14.0) {
        return { x: sx, y: Y_T3, z: useWest ? -13.1 : -12.75 };
      }
      return { x: sx, y: Y_T2, z: -4.55 };
    }

    // 7. Within Tier 3: route around Clocktower Terrace west balustrade (`x = 4.0, z in [-26.2, -15.85]`)
    if (tFrom === 't3' && tGoal === 't3') {
      if (from.x < 4.0 && goal.x > 4.2 && goal.z < -15.6 && from.z < -15.2) {
        return { x: 4.8, y: Y_T3, z: -13.2 };
      }
      if (from.x > 4.2 && goal.x < 3.8 && from.z < -15.6) {
        return { x: 5.2, y: Y_T3, z: -13.2 };
      }
      return null;
    }

    return null;
  },

  // Context-sensitive KeyG / #btnInteract query for Clockwork Mechanisms, Portals, Gear-Lifts, Tram Rack & Wall Clocks!
  getNearbyInteraction(player, G) {
    if (!player) return null;
    const u = player.userData || {};

    // 1. If already inside a special spot, pressing G cleanly hops off / drops down!
    if (u.specialMode === 'custom_spot') {
      return {
        kind: 'custom_spot',
        icon: '🧳',
        label: 'Hop Off Tram Rack',
        exitHint: 'Hopped off the streetcar luggage rack onto the deck! 🚋',
      };
    }
    if (u.specialMode === 'hook') {
      const sp = u.specialSpot;
      return {
        kind: 'hook',
        icon: sp?.icon || '🕰️',
        label: sp?.leaveLabel || 'Drop From Wall Clock',
        exitHint: sp?.exitHint || 'Dropped down from the cuckoo clock bracket! 🕰️',
      };
    }

    const px = player.position.x, pz = player.position.z;
    const py = u.groundY ?? sampleClockworkHeight(px, pz);
    const nowSec = performance.now() * 0.001;

    let bestCand = null;
    let bestDist = Infinity;

    // 2. Mechanisms: Clocktower Escapement, Chrono Pocketwatches, Tram Conductor Bell, Chaos Dial, Belfry Bell
    for (const ms of WORLD_STATE.mechSpots) {
      const yTol = ms.yTol ?? 1.25;
      const trigR = ms.trigR ?? 2.35;
      if (Math.abs(py - ms.y) > yTol) continue;
      const d = Math.hypot(px - ms.x, pz - ms.z);
      if (d <= trigR && d < bestDist) {
        const rem = Math.ceil((ms.cdUntil || 0) - nowSec);
        bestDist = d;
        bestCand = {
          ...ms,
          label: rem > 0 ? `${ms.baseLabel} (${rem}s)` : ms.baseLabel,
        };
      }
    }

    // 3. Moving Brass Gear-Elevators (`kind: 'lift'` — Hide & Seek!)
    for (let i = 0; i < WORLD_STATE.gearElevators.length; i++) {
      const ge = WORLD_STATE.gearElevators[i];
      const d = Math.hypot(px - ge.x, pz - ge.z);
      if (d <= 3.1 && py >= ge.yMin - 0.6 && py <= ge.yMax + 0.9 && d < bestDist) {
        const atTop = ge.y > (ge.yMin + ge.yMax) * 0.5;
        const onPlat = d <= ge.r + 0.3 && Math.abs(py - ge.y) <= 0.85;
        bestDist = d;
        bestCand = {
          kind: 'lift',
          gearElevId: ge.id,
          id: ge.id,
          x: ge.x,
          y: py,
          z: ge.z,
          icon: '⚙️',
          label: onPlat
            ? (atTop ? `Lower ${ge.name}` : `Raise ${ge.name}`)
            : `Call ${ge.name}`,
        };
      }
    }

    // 4. 4 Colour-Coded Astrolabe Portal Doors (`kind: 'mechanism'` — works in Hide & Seek!)
    for (const p of WORLD_STATE.portals) {
      if (Math.abs(py - p.y) > 0.95) continue;
      const dPad = Math.hypot(px - p.padX, pz - p.padZ);
      const dDoor = Math.hypot(px - p.x, pz - p.z);
      const d = Math.min(dPad, dDoor);
      if (d < 2.75 && d < bestDist) {
        let destIdx = WORLD_STATE.portalDialIdx % PORTAL_DEFS.length;
        if (destIdx === p.idx) destIdx = (p.idx + 1) % PORTAL_DEFS.length;
        const dst = PORTAL_DEFS[destIdx];
        bestDist = d;
        bestCand = {
          kind: 'mechanism',
          portalId: p.id,
          srcIdx: p.idx,
          destIdx,
          icon: '🌀',
          label: `Portal → ${dst.shortLabel}`,
        };
      }
    }

    // 5. Moving Streetcar Tram Luggage Spot (`kind: 'custom_spot'`) & Wall/Belfry Hook Perches (`kind: 'hook'`)
    if (!G || G.mode === 'hide') {
      for (const sp of WORLD_STATE.interactSpots) {
        if (sp.occupiedBy && sp.occupiedBy !== player && !sp.occupiedBy.userData?.actor?.eliminated) continue;
        const maxYDiff = sp.kind === 'custom_spot' ? 0.95 : 1.05;
        if (Math.abs(py - sp.groundY) > maxYDiff) continue;
        const maxDist = sp.kind === 'custom_spot' ? 2.55 : 2.35;
        const d = Math.hypot(px - sp.x, pz - sp.z);
        if (d < maxDist && d < bestDist) {
          bestDist = d;
          bestCand = sp;
        }
      }
    }

    return bestCand;
  },

  getInteractSpots() {
    return [
      ...(WORLD_STATE.interactSpots || []),
      ...(WORLD_STATE.mechSpots || []),
    ];
  },

  buildCustomSpotDisguise(THREE, _spot) {
    return buildTramLuggageDisguise(THREE);
  },

  triggerPulleyLift(player, inter, _G) {
    if (!player || !inter) return null;
    const ge = WORLD_STATE.gearElevators.find((e) => e.id === inter.gearElevId) || WORLD_STATE.gearElevators[0];
    if (!ge) return null;
    const cyc = 2 * (ge.dwell + ge.travel);
    const py = player.userData?.groundY ?? player.position.y ?? ge.yMin;
    const d = Math.hypot(player.position.x - ge.x, player.position.z - ge.z);
    const wantBottom = py < (ge.yMin + ge.yMax) * 0.5;
    const nearElev = d <= ge.r + 0.35 && Math.abs(py - ge.y) <= 0.85;
    // Shift periodic phase cleanly so Gear-Lift either heads immediately to player's level OR departs with them aboard!
    const targetGoUp = nearElev ? wantBottom : !wantBottom;
    const desiredT = targetGoUp ? ge.dwell + 0.08 : ge.dwell * 2 + ge.travel + 0.08;
    const modElapsed = ((ge.animClock % cyc) + cyc) % cyc;
    ge.phaseOffset = (desiredT - modElapsed + cyc) % cyc;
    return nearElev
      ? `⚙️ Engaged ${ge.name}! Riding smoothly between tiers!`
      : `⚙️ Calling ${ge.name} to your level!`;
  },

  // Trigger Astrolabe Portal Door, Chaos Dial, Escapement Lever, Chrono Pocketwatch, Tram Bell OR Belfry Bell!
  triggerMechanism(player, inter, G) {
    if (!player || !inter) return null;
    const nowSec = performance.now() * 0.001;

    if (inter.id === 'mech_clocktower_escapement') {
      const ms = WORLD_STATE.mechSpots.find((m) => m.id === 'mech_clocktower_escapement');
      if (ms && ms.cdUntil && nowSec < ms.cdUntil) {
        return `⏳ Clocktower Escapement recharging (${Math.ceil(ms.cdUntil - nowSec)}s)!`;
      }
      if (ms) ms.cdUntil = nowSec + 32.0;
      triggerMidnightRush(nowSec, 'lever');
      return '🕛 Pulled Clocktower Escapement! Midnight Rush for 18s — Gear-Lifts 1.8x & Hiders 1.26x speed!';
    }

    if (inter.mechKind === 'chrono_watch') {
      const pw = WORLD_STATE.pocketwatches.find((p) => p.mechId === inter.id);
      return activateChronoPocketwatch(pw, player, nowSec);
    }

    if (inter.id === 'mech_tram_bell') {
      const ms = WORLD_STATE.mechSpots.find((m) => m.id === 'mech_tram_bell');
      if (ms && ms.cdUntil && nowSec < ms.cdUntil) {
        return `⏳ Conductor Bell recharging (${Math.ceil(ms.cdUntil - nowSec)}s)!`;
      }
      if (ms) ms.cdUntil = nowSec + 14.0;
      WORLD_STATE.tramSurgeUntil = nowSec + 8.0;
      WORLD_STATE.tramBellSwingAmp = 0.95;
      WORLD_STATE.tramBellSwingPhase = 0;
      playTrolleyBellAudio(WORLD_STATE.audio);
      if (WORLD_STATE.emitSoundCue) {
        WORLD_STATE.emitSoundCue({ x: WORLD_STATE.tram.x, y: Y_T2 + 1.2, z: WORLD_STATE.tram.z }, 15.0, 'bell', player);
      }
      return '🔔 DING-DING! Express Streetcar surging at 1.85x speed for 8s!';
    }

    if (inter.id === 'mech_scramble_dial') {
      const ms = WORLD_STATE.mechSpots.find((m) => m.id === 'mech_scramble_dial');
      if (ms && ms.cdUntil && nowSec < ms.cdUntil) {
        return `⏳ Chaos Dial recharging (${Math.ceil(ms.cdUntil - nowSec)}s)!`;
      }
      if (ms) ms.cdUntil = nowSec + 18.0;
      WORLD_STATE.scrambleUntil = nowSec + 14.0;
      WORLD_STATE.conveyorDirSign *= -1;
      WORLD_STATE.wheelSpinBoost = PI * 3.0;
      playWorldMechAudio(WORLD_STATE.audio, 'warp');
      if (WORLD_STATE.emitSoundCue) {
        WORLD_STATE.emitSoundCue({ x: inter.x, y: inter.y + 0.6, z: inter.z }, 16.0, 'chime', null);
      }
      return '⚙️ Twisted Chaos Dial! Reversed Tram & Conveyors and Scrambled Dial Portals for 14s!';
    }

    if (inter.mechanismType === 'bell' || inter.id === 'belfry_chime_bell') {
      return triggerBelfryBell(player, false);
    }

    const srcIdx = typeof inter.srcIdx === 'number' ? inter.srcIdx : 0;
    let destIdx = typeof inter.destIdx === 'number' ? inter.destIdx : (WORLD_STATE.portalDialIdx % PORTAL_DEFS.length);
    const isScrambled = nowSec < WORLD_STATE.scrambleUntil;
    const isSeekerTeam = (G && G.mode === 'seek' && player === G.player) || player.userData?.actor?.team === 'seekers';
    if (isScrambled && isSeekerTeam) {
      destIdx = (srcIdx + 2) % PORTAL_DEFS.length;
    } else if (destIdx === srcIdx) {
      destIdx = (srcIdx + 1) % PORTAL_DEFS.length;
    }

    const dst = PORTAL_DEFS[destIdx];
    player.position.set(dst.padX, dst.y, dst.padZ);
    player.userData.groundY = dst.y;
    player.userData.jy = 0;
    player.userData.vy = 0;
    player.rotation.y = dst.outYaw;

    // Advance astrolabe destination gem to the next stop & trigger brisk visual wheel spin across all 4 portals!
    WORLD_STATE.portalDialIdx = (destIdx + 1) % PORTAL_DEFS.length;
    WORLD_STATE.wheelSpinBoost = PI * 1.5;

    const nextPreview = PORTAL_DEFS[WORLD_STATE.portalDialIdx];
    for (const p of WORLD_STATE.portals) {
      if (p.destGem && p.destGem.material) {
        p.destGem.material.color.setHex(nextPreview.glowHex);
        p.destGem.material.emissive.setHex(nextPreview.colorHex);
      }
    }

    return `🌀 The Portal Dial turned to ${dst.colorName}! Stepped out at ${dst.name}! ✨`;
  },

  buildWorld(ctx) {
    const { THREE, root } = ctx;
    const rng = makeRng(404);
    const B = buildBuildings(THREE);

    WORLD_STATE.portals = [];
    WORLD_STATE.interactSpots = [];
    WORLD_STATE.gearElevators = [];
    WORLD_STATE.bellPivot = null;
    WORLD_STATE.bellPulseMesh = null;
    WORLD_STATE.bellGroundPulseMesh = null;
    WORLD_STATE.bellSwingAmp = 0;
    WORLD_STATE.bellSwingPhase = 0;
    WORLD_STATE.bellPulseUntil = -99;
    WORLD_STATE.bellCdUntil = 0;
    WORLD_STATE.bellRattledCount = 0;
    WORLD_STATE.bellStartledCount = 0;
    WORLD_STATE.elapsed = 0;
    if (WORLD_STATE.creatures) {
      WORLD_STATE.creatures.dispose();
      WORLD_STATE.creatures = null;
    }
    WORLD_STATE.portalDialIdx = 1;
    WORLD_STATE.wheelSpinBoost = 0;
    WORLD_STATE.turret = null;
    WORLD_STATE.mechSpots = [];
    WORLD_STATE.conveyorSlats = [];
    WORLD_STATE.conveyorDirSign = 1;
    WORLD_STATE.scrambleUntil = -1;
    WORLD_STATE.tramSurgeUntil = -1;
    WORLD_STATE.tramBellMesh = null;
    WORLD_STATE.tramBellSwingAmp = 0;
    WORLD_STATE.tramBellSwingPhase = 0;
    WORLD_STATE.tramBellSpot = null;
    WORLD_STATE.midnightDone = false;
    WORLD_STATE.midnightPermanent = false;
    WORLD_STATE.midnightLeverUntil = -1;
    WORLD_STATE.clockHandAngle = 0;
    WORLD_STATE.clockGearAngle = 0;
    WORLD_STATE.escapementLeverMesh = null;
    WORLD_STATE.escapementPullT = 0;
    WORLD_STATE.pendulums = [];
    WORLD_STATE.pendulumHitCd.clear();
    WORLD_STATE.pocketwatches = [];
    clearTimeDomes();
    WORLD_STATE.chaosDialMesh = null;
    WORLD_STATE.getG = ctx.getG || null;
    WORLD_STATE.getActors = ctx.getActors || null;
    WORLD_STATE.root = root;
    WORLD_STATE.notify = ctx.notify || ctx.pushFeed || null;
    WORLD_STATE.emitSoundCue = ctx.emitSoundCue || null;
    WORLD_STATE.audio = ctx.audio || null;

    WORLD_STATE.tracks = createMovingTrackSystem(THREE);

    // ------------------------------------------------------------------------
    // 1. Outskirts Autumn Hills Terrain (`metalness: 0`) + Distant Alpine Peaks
    // ------------------------------------------------------------------------
    const terrainGeo = new THREE.PlaneGeometry(240, 240, 88, 88);
    terrainGeo.rotateX(-PI / 2);
    const tPos = terrainGeo.attributes.position;
    const tCols = new Float32Array(tPos.count * 3);
    const tc = new THREE.Color();
    for (let i = 0; i < tPos.count; i++) {
      const x = tPos.getX(i), z = tPos.getZ(i);
      const d = Math.hypot(x, z);
      let y = -0.35;
      if (d > 29.0) {
        const baseOuter = z >= 12 ? Y_T1 : (z < -12 && x > 3 ? Y_T3 : Y_T2);
        const blend = clamp((d - 29.0) / 5.5, 0, 1);
        const rawHill = d > 37 ? Math.min(8.4, ((d - 37) / 48) * 7.8) * (0.68 + 0.32 * Math.sin(x * 0.08) * Math.cos(z * 0.075)) : 0;
        y = -0.35 * (1 - blend) + (baseOuter - 0.12 + rawHill) * blend;
      }
      tPos.setY(i, y);
      const wave = Math.sin(x * 0.07 + z * 0.05);
      if (d < 35) tc.setHex(0x9b9f4e).offsetHSL(rng.jr(-0.02, 0.03), rng.jr(-0.04, 0.05), rng.jr(-0.04, 0.04));
      else if (wave > 0.15) tc.setHex(0xc8933e).offsetHSL(rng.jr(-0.02, 0.03), 0, rng.jr(-0.04, 0.05));
      else tc.setHex(0x6e8b52).offsetHSL(rng.jr(-0.03, 0.03), 0, rng.jr(-0.05, 0.05));
      tCols[i * 3] = tc.r; tCols[i * 3 + 1] = tc.g; tCols[i * 3 + 2] = tc.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));
    terrainGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
    );
    terrain.receiveShadow = true;
    terrain.userData.ground = true;
    terrain.userData.paint = new THREE.Color(0x9b9f4e);
    root.add(terrain);

    // Distant Outskirts Autumn Copse (`metalness: 0`, framing the painted Storybook alpine skybox!)
    const mtGroup = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rng.jr(-0.08, 0.08);
      const dist = rng.jr(39, 52);
      const mx = Math.sin(a) * dist, mz = Math.cos(a) * dist;
      const dTree = buildAutumnTree(THREE, i % 2 === 0 ? 'ginkgo' : 'maple', 200 + i);
      dTree.scale.setScalar(rng.jr(1.18, 1.48));
      dTree.position.set(mx, 1.8, mz);
      mtGroup.add(dTree);
    }
    mergeStatic(THREE, mtGroup);
    root.add(mtGroup);

    // ------------------------------------------------------------------------
    // 2. 3-Tier Masonry Terraces, 5 Stone Staircases & Elevated Rail Viaduct
    // ------------------------------------------------------------------------
    const tierArch = buildMultiTierMasonryAndViaduct(THREE);
    ctx.placeKit(tierArch, 0, 0, 0, 0.02, true, 0);

    // 12-Point Golden Star-Compass Plaza Medallion (`y = 2.018m`) + Inlaid Brass Streetcar Rails!
    const starDisc = new THREE.Mesh(
      new THREE.CircleGeometry(8.95, 64),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeStarMedallionTex(THREE), roughness: 0.88, metalness: 0 })
    );
    starDisc.rotation.x = -PI / 2;
    starDisc.position.set(TRAM_CX, Y_T2 + 0.016, TRAM_CZ);
    starDisc.receiveShadow = true;
    starDisc.userData.ground = true;
    starDisc.userData.paint = new THREE.Color(0xe8c06c);
    root.add(starDisc);

    // Circular Streetcar Track Ballast Ring + Twin Gleaming Storybook Brass Rails + Oak Sleepers (`y = 2.02m`)
    const railBed = new THREE.Mesh(
      new THREE.RingGeometry(R_TRAM - 1.05, R_TRAM + 1.05, 84),
      new THREE.MeshStandardMaterial({
        color: 0xb59e84,
        map: kitTex(THREE, 'stone', 14, 2),
        roughness: 0.92,
        metalness: 0,
      })
    );
    railBed.rotation.x = -PI / 2;
    railBed.position.set(TRAM_CX, Y_T2 + 0.014, TRAM_CZ);
    railBed.receiveShadow = true;
    railBed.userData.ground = true;
    railBed.userData.paint = new THREE.Color(0xb59e84);
    root.add(railBed);

    // Instanced oak sleepers & 3D cobblestone accent rings across all 3 tiers!
    const sleeperGeo = new RoundedBoxGeometry(1.78, 0.035, 0.22, 1, 0.01);
    const sleeperMat = new THREE.MeshStandardMaterial({
      color: 0x7a5234,
      map: kitTex(THREE, 'wood_planks_dark', 1, 1),
      roughness: 0.90,
      metalness: 0,
    });
    const sleeperInst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, 72);
    const sObj = new THREE.Object3D();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      sObj.position.set(TRAM_CX + Math.cos(a) * R_TRAM, Y_T2 + 0.012, TRAM_CZ + Math.sin(a) * R_TRAM);
      sObj.rotation.set(0, -a, 0);
      sObj.updateMatrix();
      sleeperInst.setMatrixAt(i, sObj.matrix);
    }
    sleeperInst.receiveShadow = true;
    root.add(sleeperInst);

    const railBrassMat = new THREE.MeshStandardMaterial({
      color: 0xe8b84b,
      roughness: 0.36,
      metalness: 0,
      emissive: 0x3b2406,
      emissiveIntensity: 0.18,
    });
    for (const rTrack of [R_TRAM - 0.62, R_TRAM + 0.62]) {
      const railGeo = new THREE.RingGeometry(rTrack - 0.055, rTrack + 0.055, 88);
      railGeo.rotateX(-PI / 2);
      const rail = new THREE.Mesh(railGeo, railBrassMat);
      rail.position.set(TRAM_CX, Y_T2 + 0.028, TRAM_CZ);
      rail.receiveShadow = true;
      rail.userData.ground = true;
      rail.userData.paint = new THREE.Color(0xe8b84b);
      root.add(rail);
    }

    // 3D Instanced Raised Squircle Cobble Accent Stones across Tiers 1, 2 & 3
    const cobbleAccentGeo = new RoundedBoxGeometry(0.54, 0.04, 0.38, 1, 0.014);
    const cobbleAccentMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0,
    });
    const cobblePts = [];
    for (let ringR = 3.2; ringR <= 8.2; ringR += 1.65) {
      const cnt = Math.round(ringR * 7.5);
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU;
        cobblePts.push([TRAM_CX + Math.cos(a) * ringR, Y_T2 + 0.008, TRAM_CZ + Math.sin(a) * ringR, -a, i % 2 ? 0xe8c478 : 0xc4ae94]);
      }
    }
    for (let i = 0; i < 42; i++) {
      const px = -6.5 + (i % 14) * 1.4, pz = 15.0 + Math.floor(i / 14) * 1.5;
      cobblePts.push([px, Y_T1 + 0.008, pz, (i * 0.3) % PI, 0xd4bc9e]);
    }
    for (let i = 0; i < 36; i++) {
      const px = 6.5 + (i % 12) * 1.45, pz = -15.6 + Math.floor(i / 12) * 1.45;
      cobblePts.push([px, Y_T3 + 0.008, pz, (i * 0.4) % PI, 0xdcc6a8]);
    }
    const cobbleInst = new THREE.InstancedMesh(cobbleAccentGeo, cobbleAccentMat, cobblePts.length);
    cobblePts.forEach(([cx, cy, cz, ry, hex], idx) => {
      sObj.position.set(cx, cy, cz);
      sObj.rotation.set(0, ry, 0);
      sObj.updateMatrix();
      cobbleInst.setMatrixAt(idx, sObj.matrix);
      cobbleInst.setColorAt(idx, new THREE.Color(hex));
    });
    cobbleInst.receiveShadow = true;
    root.add(cobbleInst);

    // ------------------------------------------------------------------------
    // 3. Lower Stone-Walled Canal Water & 2 Walkable Arched Stone Bridges (`y = 0.85m`)
    // ------------------------------------------------------------------------
    const canalGeo = new THREE.PlaneGeometry(CANAL_X1 - CANAL_X0, CANAL_Z1 - CANAL_Z0, 28, 6);
    canalGeo.rotateX(-PI / 2);
    const brookWater = createAnimatedWater(THREE, {
      geometry: canalGeo,
      preRotated: true,
      y: 0.34,
      deep: 0x246b8a,
      shallow: 0x56c2dc,
      foam: 0xf0fbff,
      opacity: 0.94,
      scale: 0.65,
      walkable: false,
    });
    brookWater.mesh.position.set((CANAL_X0 + CANAL_X1) * 0.5, 0.34, CANAL_ZC);
    root.add(brookWater.mesh);

    for (const brCfg of CANAL_BRIDGES) {
      const bridge = B.stoneBridge({ seed: brCfg.cx < 0 ? 19 : 31, garden: false });
      ctx.placeKit(bridge, brCfg.cx, brCfg.cz, 0, 0.03, true, Y_T1);
    }

    // ------------------------------------------------------------------------
    // 4. Landmarks: Orrery Fountain, 2 Kiosks, Looping Rideable Tram & Walking Turret
    // ------------------------------------------------------------------------
    const fountain = B.orreryFountain({ seed: 7, garden: false });
    ctx.placeKit(fountain, TRAM_CX, TRAM_CZ, 0, 0.04, true, Y_T2);
    const orreryRings = fountain.getObjectByName('orreryRings');
    const orreryRingA = fountain.getObjectByName('orreryRingA');
    const orreryRingB = fountain.getObjectByName('orreryRingB');

    ctx.placeKit(B.marketKiosk({ seed: 13, garden: false }), -5.6, TRAM_CZ, PI / 2, 0.04, true, Y_T2);
    ctx.placeKit(B.marketKiosk({ seed: 29, garden: false }), 5.6, TRAM_CZ, -PI / 2, 0.04, true, Y_T2);

    // Rideable Looping Burgundy-and-Brass Streetcar (`solid = false` so no static blocker freezes on track!)
    const initAngle = PI * 0.5;
    const initTx = TRAM_CX + Math.cos(initAngle) * R_TRAM;
    const initTz = TRAM_CZ + Math.sin(initAngle) * R_TRAM;
    const initYaw = -initAngle;
    const tram = B.clockworkTram({ seed: 41, garden: false });

    // Static companion luggage bundle on left of rear luggage rack (`x = -0.44, y = 0.48, z = -2.26`)
    const companionLuggage = buildTramLuggageDisguise(THREE);
    companionLuggage.position.set(-0.44, 0.48, -2.26);
    companionLuggage.rotation.y = 0.35;
    tram.add(companionLuggage);

    // Interactive Conductor Bell & Crimson Pull-Cord mounted inside front vestibule (`local x = 0.28, z = 2.05`)
    const tramBellPivot = new THREE.Group();
    tramBellPivot.name = 'cw_tram_conductor_bell';
    tramBellPivot.userData.keep = true;
    tramBellPivot.position.set(0.28, 2.52, 2.05);
    const tbDomeMat = new THREE.MeshStandardMaterial({
      color: 0xf4c450,
      emissive: 0x4a2a04,
      emissiveIntensity: 0.22,
      roughness: 0.36,
      metalness: 0,
    });
    const tbCordMat = new THREE.MeshStandardMaterial({ color: 0xd03838, roughness: 0.78, metalness: 0 });
    const tbDome = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.19, 0.20, 12), tbDomeMat);
    tbDome.position.y = -0.10;
    tbDome.userData.keep = true;
    const tbCord = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.88, 6), tbCordMat);
    tbCord.position.y = -0.60;
    tbCord.userData.keep = true;
    const tbRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 6, 12), tbDomeMat);
    tbRing.position.y = -1.06;
    tbRing.userData.keep = true;
    tramBellPivot.add(tbDome, tbCord, tbRing);
    tram.add(tramBellPivot);
    WORLD_STATE.tramBellMesh = tramBellPivot;

    ctx.placeKit(tram, initTx, initTz, initYaw, 0, false, Y_T2);
    const tramGears = tram.getObjectByName('tramGears');

    WORLD_STATE.tram = {
      angle: initAngle,
      x: initTx,
      z: initTz,
      yaw: initYaw,
      prevX: initTx,
      prevZ: initTz,
      prevYaw: initYaw,
      mesh: tram,
    };
    WORLD_STATE.tramReady = true;

    const [initBellX, initBellZ] = tramLocalToWorld(0.28, 2.05, initTx, initTz, initYaw);
    const tramBellSpot = {
      id: 'mech_tram_bell',
      kind: 'mechanism',
      icon: '🔔',
      baseLabel: 'Pull Conductor Bell (1.85x Tram Surge)',
      label: 'Pull Conductor Bell (1.85x Tram Surge)',
      x: initBellX,
      y: Y_T2 + 0.25,
      z: initBellZ,
      yTol: 1.35,
      trigR: 2.85,
      cdUntil: 0,
      getWorldPos() {
        const tr = WORLD_STATE.tram;
        const [wx, wz] = tramLocalToWorld(0.28, 2.05, tr.x, tr.z, tr.yaw);
        return { x: wx, y: Y_T2 + 0.25, z: wz };
      },
    };
    WORLD_STATE.tramBellSpot = tramBellSpot;
    WORLD_STATE.mechSpots.push(tramBellSpot);

    // Register Interactive Tram-Luggage Custom Spot locked onto the moving tram's rear platform!
    const [initSpotX, initSpotZ] = tramLocalToWorld(0.38, -2.22, initTx, initTz, initYaw);
    const tramLuggageSpot = {
      kind: 'custom_spot',
      id: 'tram_luggage_rack',
      icon: '🧳',
      label: 'Hide as Tram Luggage',
      disguiseLabel: 'Streetcar Luggage & Milk Can 🧳',
      enterHint: 'Riding the looping streetcar disguised as vintage luggage & milk can! 🚋 (WASD or G to hop off)',
      exitHint: 'Hopped off the streetcar luggage rack! 🚋',
      x: initSpotX,
      y: TRAM_DECK_Y,
      z: initSpotZ,
      groundY: TRAM_DECK_Y,
      rot: initYaw,
      radius: 0.46,
      height: 0.68,
      hp: 85,
      occupiedBy: null,
      getWorldPos() {
        const tr = WORLD_STATE.tram;
        const [wx, wz] = tramLocalToWorld(0.38, -2.22, tr.x, tr.z, tr.yaw);
        return { x: wx, y: TRAM_DECK_Y, z: wz, rot: tr.yaw };
      },
    };
    WORLD_STATE.tramLuggageSpot = tramLuggageSpot;
    WORLD_STATE.interactSpots.push(tramLuggageSpot);

    // Steam-Whistling Wind-Up Clock-Tower Wagon (`walkingTurret`) on Tier 3 Grand Clocktower Terrace (`y = 4.35m`)
    const turX = 21.6, turZ = -16.8;
    const turPad = new THREE.Mesh(
      new THREE.CylinderGeometry(3.15, 3.35, 0.14, 14),
      new THREE.MeshStandardMaterial({
        color: 0xd4c2a8,
        map: kitTex(THREE, 'stone', 3, 3),
        roughness: 0.90,
        metalness: 0,
      })
    );
    turPad.position.set(turX, Y_T3 + 0.07, turZ);
    turPad.receiveShadow = true;
    turPad.userData.ground = true;
    turPad.userData.paint = new THREE.Color(0xd4c2a8);
    root.add(turPad);

    const turret = B.walkingTurret({ seed: 53, garden: false });
    ctx.placeKit(turret, turX, turZ, -0.95, 0.04, true, Y_T3);
    const turretBody = turret.getObjectByName('turretBody');

    // ------------------------------------------------------------------------
    // 5. All 5 Enterable 2-Room Buildings Across Tiers 1, 2 & 3!
    // ------------------------------------------------------------------------
    // 1) Tier 1 (`0.85m`): Stained-Glass Apothecary (`alchemist_shop`) in Lower Canal Quarter
    const alchemist = B.alchemist_shop({ seed: 53, garden: false });
    ctx.placeKit(alchemist, -17.2, 19.2, PI / 2, 0.04, true, Y_T1);

    // 2) Tier 2 (`2.00m`): Primrose Millinery (`hatter_boutique`) on West Plaza Boulevard
    const hatter = B.hatter_boutique({ seed: 11, garden: false });
    ctx.placeKit(hatter, -21.2, 2.2, PI / 2, 0.04, true, Y_T2);

    // 3) Tier 2 (`2.00m`): Royal Pâtisserie (`royal_patisserie`) on East Café Boulevard
    const patisserie = B.royal_patisserie({ seed: 67, garden: false });
    ctx.placeKit(patisserie, 21.2, 2.2, -PI / 2, 0.04, true, Y_T2);

    // 4) Tier 2 (`2.00m`): Wizard Portal Parlor (`wizard_parlor`) in North Under-Viaduct Court!
    const wizard = B.wizard_parlor({ seed: 23, garden: false });
    ctx.placeKit(wizard, -5.6, -22.6, 0.0, 0.04, true, Y_T2);
    const wizardPortalWheel = wizard.getObjectByName('portalWheel');

    // 5) Tier 3 (`4.35m`): Clockmaker Guildhall (`clockmaker_hall`) on NE Grand Clocktower Promenade!
    const clockHall = B.clockmaker_hall({ seed: 37, garden: false });
    ctx.placeKit(clockHall, 13.6, -21.2, 0.0, 0.04, true, Y_T3);
    const clockHands = clockHall.getObjectByName('clockHands');
    const gearA = clockHall.getObjectByName('gearA');
    const gearB = clockHall.getObjectByName('gearB');

    // ------------------------------------------------------------------------
    // 6. 4 Color-Coded Rotating Portal Doors Across All 3 Tiers!
    // ------------------------------------------------------------------------
    const initDest = PORTAL_DEFS[WORLD_STATE.portalDialIdx];
    for (const pDef of PORTAL_DEFS) {
      const doorGrp = buildDialPortalDoor(THREE, {
        seed: 10 + pDef.idx * 17,
        colorHex: pDef.colorHex,
        glowHex: pDef.glowHex,
      });
      ctx.placeKit(doorGrp, pDef.x, pDef.z, pDef.rot, 0.03, true, pDef.y);
      const wheel = doorGrp.getObjectByName('portalWheel');
      const destGem = doorGrp.getObjectByName('destGem');
      if (destGem && destGem.material) {
        destGem.material.color.setHex(initDest.glowHex);
        destGem.material.emissive.setHex(initDest.colorHex);
      }
      WORLD_STATE.portals.push({ ...pDef, group: doorGrp, wheel, destGem });
    }

    // ------------------------------------------------------------------------
    // 7. Wall-Mounted Cuckoo Clock Hooks (`kind: 'hook'`, `hangY: 1.65`)
    //    + Animated Companion Cuckoo Clocks with Swinging Brass Pendulums!
    // ------------------------------------------------------------------------
    const wallHookDefs = [
      { id: 'hook_hatter',     x: -17.34, z: -1.15, groundY: Y_T2, rot: PI / 2, placeName: 'Primrose Millinery Facade' },
      { id: 'hook_patisserie', x: 17.34,  z: -1.15, groundY: Y_T2, rot: -PI / 2, placeName: 'Royal Pâtisserie Facade' },
      { id: 'hook_viaduct',    x: -8.2,   z: -11.52, groundY: Y_T2, rot: 0,      placeName: 'Viaduct Stone Pier' },
      { id: 'hook_wizard',     x: -2.3,   z: -18.74, groundY: Y_T2, rot: 0,      placeName: 'Wizard Parlor Porch' },
      { id: 'hook_clockhall',  x: 10.2,   z: -17.34, groundY: Y_T3, rot: 0,      placeName: 'Clockmaker Guildhall Wall' },
      { id: 'hook_alchemist',  x: -13.44, z: 15.8,   groundY: Y_T1, rot: PI / 2, placeName: 'Apothecary Canal Arcade' },
    ];
    for (const hk of wallHookDefs) {
      const bracket = buildWallClockBracket(THREE);
      bracket.position.set(hk.x, hk.groundY + 1.65, hk.z);
      bracket.rotation.y = hk.rot;
      root.add(bracket);

      WORLD_STATE.interactSpots.push({
        kind: 'hook',
        id: hk.id,
        propId: 'cw_cuckoo_clock',
        icon: '🕰️',
        label: 'Hang as Cuckoo Clock',
        disguiseLabel: 'Wall Cuckoo Clock 🕰️',
        enterHint: `Mounted on ${hk.placeName} as a swinging Cuckoo Clock! 🕰️ (WASD or G to drop)`,
        exitHint: 'Dropped down from the wall cuckoo clock bracket! 🕰️',
        x: hk.x,
        z: hk.z,
        groundY: hk.groundY,
        hangY: 1.65,
        rot: hk.rot,
        occupiedBy: null,
      });
    }

    // Decorative Animated Cuckoo Clocks with Swinging Brass Pendulums mounted nearby!
    const animatedPendulums = [];
    const companionClocks = [
      [-22.2, Y_T2 + 1.65, 6.42, 0],
      [22.4,  Y_T2 + 1.65, 6.72, 0],
      [-2.8,  Y_T2 + 1.65, -11.56, 0],
      [16.8,  Y_T3 + 1.65, -17.38, 0],
      [-13.48, Y_T1 + 1.65, 22.1, PI / 2],
    ];
    companionClocks.forEach(([cx, cy, cz, croy], idx) => {
      const ck = buildWallCuckooClock(THREE, { animated: true });
      ck.group.position.set(cx, cy, cz);
      ck.group.rotation.y = croy;
      root.add(ck.group);
      if (ck.pendulum) animatedPendulums.push({ pivot: ck.pendulum, phase: idx * 1.15 });
    });

    // ------------------------------------------------------------------------
    // 8. Standable Plaza Benches, Café Bistro Tables, Planters, Lamps & Bunting
    // ------------------------------------------------------------------------
    const benchSpots = [
      [-3.9, 6.2, PI, Y_T2],
      [3.9, 6.2, PI, Y_T2],
      [-3.9, -4.6, 0, Y_T2],
      [3.9, -4.6, 0, Y_T2],
      [-13.8, -19.2, 0.3, Y_T2],
      [9.4, -13.6, 0, Y_T3],
      [19.2, -13.6, 0, Y_T3],
      [3.4, 17.6, 0, Y_T1],
    ];
    for (const [bx, bz, brot, by] of benchSpots) {
      ctx.placeKit(buildPlazaBench(THREE), bx, bz, brot, 0.04, true, by);
    }

    const bistroSpots = [
      [13.0, -0.4, 1, Y_T2],
      [12.5, 7.6, 2, Y_T2],
      [19.6, -21.8, 3, Y_T3],
      [-9.5, 25.2, 4, Y_T1],
    ];
    for (const [tx, tz, sd, ty] of bistroSpots) {
      ctx.placeKit(buildBistroTable(THREE, sd), tx, tz, 0, 0.04, true, ty);
    }

    const planterSpots = [
      [-6.8, 5.2, 1, Y_T2],
      [6.8, 5.2, 2, Y_T2],
      [-6.8, -3.6, 3, Y_T2],
      [6.8, -3.6, 4, Y_T2],
      [7.2, -13.2, 5, Y_T3],
      [3.5, 14.8, 6, Y_T1],
    ];
    for (const [px, pz, sd, py] of planterSpots) {
      ctx.placeKit(buildFlowerPlanter(THREE, sd), px, pz, 0, 0.04, true, py);
    }

    const lampPosts = [
      [-7.4, -6.2, Y_T2],
      [7.4, -6.2, Y_T2],
      [-12.2, 2.2, Y_T2],
      [12.2, 2.2, Y_T2],
      [-6.2, 11.8, Y_T2],
      [5.4, 11.8, Y_T2],
      [8.2, -14.8, Y_T3],
      [18.8, -14.8, Y_T3],
      [-8.8, 18.2, Y_T1],
      [13.4, 18.2, Y_T1],
    ];
    for (const [lx, lz, ly] of lampPosts) {
      ctx.placeKit(buildBannerLampStandard(THREE), lx, lz, Math.atan2(-lx, -lz), 0.04, true, ly);
    }

    // Festive Swaying Autumn Bunting Garlands (`metalness: 0`)
    const buntingSpans = [
      [[-7.4, Y_T2 + 4.25, -6.2], [-8.2, Y_T3 + 0.9, -11.6]],
      [[7.4, Y_T2 + 4.25, -6.2], [8.2, Y_T3 + 4.25, -14.8]],
      [[-7.4, Y_T2 + 4.25, -6.2], [-12.2, Y_T2 + 4.25, 2.2]],
      [[7.4, Y_T2 + 4.25, -6.2], [12.2, Y_T2 + 4.25, 2.2]],
      [[-12.2, Y_T2 + 4.25, 2.2], [-17.4, Y_T2 + 4.4, 2.2]],
      [[12.2, Y_T2 + 4.25, 2.2], [17.4, Y_T2 + 4.4, 2.2]],
      [[8.2, Y_T3 + 4.25, -14.8], [18.8, Y_T3 + 4.25, -14.8]],
    ];
    const ropeGroup = new THREE.Group();
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.90, metalness: 0 });
    const flagData = [];
    const flagCols = [0xd94448, 0xffc842, 0x3b7dd8, 0x8f4bc9, 0x48b27c, 0xf27d42];
    for (const [p0, p1] of buntingSpans) {
      const v0 = new THREE.Vector3(...p0), v1 = new THREE.Vector3(...p1);
      const mid = v0.clone().add(v1).multiplyScalar(0.5);
      mid.y -= 0.62;
      const curve = new THREE.QuadraticBezierCurve3(v0, mid, v1);
      ropeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.018, 5, false), ropeMat));
      const flagsN = 14;
      for (let k = 1; k < flagsN; k++) {
        const t = k / flagsN;
        const pt = curve.getPoint(t);
        const tan = curve.getTangent(t);
        flagData.push({
          pos: pt,
          yaw: Math.atan2(tan.x, tan.z) + PI / 2,
          phase: k * 0.65 + p0[0] * 0.2,
          col: flagCols[(k + Math.abs(p0[0] | 0)) % flagCols.length],
        });
      }
    }
    mergeStatic(THREE, ropeGroup);
    root.add(ropeGroup);

    const flagGeo = new THREE.ConeGeometry(0.16, 0.36, 3);
    flagGeo.rotateX(PI);
    flagGeo.translate(0, -0.18, 0);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 });
    const flagInst = new THREE.InstancedMesh(flagGeo, flagMat, flagData.length);
    const fObj = new THREE.Object3D();
    flagData.forEach((f, idx) => {
      fObj.position.copy(f.pos);
      fObj.rotation.set(0, f.yaw, 0);
      fObj.updateMatrix();
      flagInst.setMatrixAt(idx, fObj.matrix);
      flagInst.setColorAt(idx, new THREE.Color(f.col));
    });
    root.add(flagInst);

    // ------------------------------------------------------------------------
    // 9. Golden Ginkgo & Crimson Autumn Maple Outskirts Grove + Swaying Grass
    // ------------------------------------------------------------------------
    const treePlacements = [
      [-23.5, -18.5, 'ginkgo', 1.15, Y_T2],
      [-13.8, -24.2, 'maple', 1.12, Y_T2],
      [0.8, -26.8, 'ginkgo', 1.08, Y_T2],
      [6.4, -24.6, 'maple', 1.10, Y_T3],
      [23.8, -23.6, 'ginkgo', 1.14, Y_T3],
      [27.2, -7.8, 'ginkgo', 1.08, Y_T2],
      [27.4, 9.2, 'maple', 1.16, Y_T2],
      [20.5, 16.8, 'ginkgo', 1.15, Y_T1],
      [15.6, 26.4, 'maple', 1.18, Y_T1],
      [3.2, 27.6, 'ginkgo', 1.12, Y_T1],
      [-5.2, 27.4, 'maple', 1.10, Y_T1],
      [-23.6, 25.8, 'ginkgo', 1.16, Y_T1],
      [-26.8, 11.4, 'maple', 1.14, Y_T2],
      [-27.2, -5.2, 'ginkgo', 1.16, Y_T2],
    ];
    treePlacements.forEach(([tx, tz, kind, sc, ty], i) => {
      const tr = buildAutumnTree(THREE, kind, i + 1);
      tr.scale.setScalar(sc);
      ctx.placeKit(tr, tx, tz, rng.jr(0, TAU), 0.04, true, ty);
    });

    const autumnGrass = createSwayingBlades(THREE, {
      count: 1800,
      height: 0.44,
      width: 0.055,
      color: 0xd8a03c,
      spread: 34,
      seed: 88,
      filter: (x, z) => {
        const d = Math.hypot(x, z);
        return d > 28.4 && d < 32.8 && !inCanalWater(x, z);
      },
    });
    root.add(autumnGrass.inst);

    // ------------------------------------------------------------------------
    // 10. Drifting Golden Ginkgo Leaves & Walking Turret Steam Puffs
    // ------------------------------------------------------------------------
    const LEAF_COUNT = 140;
    const leafGeo = new THREE.CircleGeometry(0.11, 5);
    const leafMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, LEAF_COUNT);
    leafInst.frustumCulled = false;
    const leafStates = [];
    const leafPalette = [0xffcf38, 0xf5a623, 0xffe26a, 0xe8642c, 0xf28c28];
    for (let i = 0; i < LEAF_COUNT; i++) {
      leafInst.setColorAt(i, new THREE.Color(leafPalette[i % leafPalette.length]));
      leafStates.push({
        x: rng.jr(-25, 25),
        y: rng.jr(1.5, 11.5),
        z: rng.jr(-25, 25),
        vy: rng.jr(0.45, 0.88),
        ph: rng.jr(0, TAU),
        sp: rng.jr(0.9, 1.8),
      });
    }
    root.add(leafInst);

    const STEAM_COUNT = 12;
    const steamGeo = new THREE.IcosahedronGeometry(0.32, 1);
    const steamMat = new THREE.MeshStandardMaterial({
      color: 0xfffaf2,
      emissive: 0xdfd8cc,
      emissiveIntensity: 0.35,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
    });
    const steamInst = new THREE.InstancedMesh(steamGeo, steamMat, STEAM_COUNT);
    steamInst.frustumCulled = false;
    root.add(steamInst);

    // ------------------------------------------------------------------------
    // 11. 18 Hand-Authored Outdoor Prop Vignettes Across All 3 Tiers!
    // ------------------------------------------------------------------------
    // Tier 2: West & East Market Kiosks
    ctx.addVig('vig_kiosk_w', { x: -5.6, y: Y_T2, z: TRAM_CZ, rot: 0 }, [
      ['cw_potion_rack', 0.0, -1.55, 0.2],
      ['cw_brass_orrery', 0.0, 1.55, -0.3],
      ['cw_coal_hearth_pot', -1.45, -0.85, 0.4],
      ['cw_spellbook_lectern', -1.45, 0.85, -0.2],
    ], 1);
    ctx.addVig('vig_kiosk_e', { x: 5.6, y: Y_T2, z: TRAM_CZ, rot: 0 }, [
      ['cw_automaton_owl', 0.0, -1.55, 0.3],
      ['cw_gramophone', 0.0, 1.55, -0.4],
      ['cw_steam_samovar', 1.45, -0.85, -0.3],
      ['cw_potion_rack', 1.45, 0.85, 0.3],
    ], 1);

    // Tier 2: Primrose Millinery Courtyard & Rose Portal Nook
    ctx.addVig('vig_millinery_front', { x: -15.6, y: Y_T2, z: 3.8, rot: 0 }, [
      ['cw_hatbox_stack', -0.6, 0.0, 0.4],
      ['cw_hatbox_stack', 0.4, 0.8, -0.2],
      ['cw_dress_form', -0.8, 1.8, 1.2],
      ['cw_dress_form', 0.2, 2.4, 0.9],
      ['cw_street_lamp', 1.2, -1.2, 0.5],
    ], 1);
    ctx.addVig('vig_millinery_south', { x: -16.0, y: Y_T2, z: 10.6, rot: 0 }, [
      ['cw_hatbox_stack', -0.4, -0.5, 0.5],
      ['cw_gramophone', 0.8, 0.2, -0.4],
      ['cw_grandfather_clock', -0.8, 0.8, 0.6],
      ['cw_automaton_owl', 0.4, 1.0, 0.2],
    ], 1);

    // Tier 2: Royal Pâtisserie Café Boulevard (tucked by awning so `x = 15.2` stair lane is wide open!)
    ctx.addVig('vig_patisserie_n', { x: 16.7, y: Y_T2, z: -0.2, rot: 0 }, [
      ['cw_cake_stand', 0.3, -0.6, -1.5],
      ['cw_cake_stand', -0.2, 0.4, -1.7],
      ['cw_steam_samovar', 0.4, 1.0, -1.6],
      ['cw_gramophone', 0.3, -1.5, -1.4],
    ], 1);
    ctx.addVig('vig_patisserie_s', { x: 19.2, y: Y_T2, z: 8.6, rot: 0 }, [
      ['cw_cake_stand', -0.4, -0.3, -1.6],
      ['cw_steam_samovar', 0.4, 0.3, -1.8],
      ['cw_hatbox_stack', -0.5, 0.8, -2.0],
      ['cw_street_lamp', 0.8, 1.0, -1.6],
    ], 1);

    // Tier 2: North Under-Viaduct Wizard Court (clear of the 3 arch lanes!)
    ctx.addVig('vig_wizard_west', { x: -12.6, y: Y_T2, z: -19.8, rot: 0 }, [
      ['cw_spellbook_lectern', -0.6, -0.5, 0.3],
      ['cw_spellbook_lectern', 0.5, 0.4, -0.1],
      ['cw_coal_hearth_pot', -0.8, 1.2, 0.4],
      ['cw_brass_orrery', 0.6, -1.1, 0.2],
    ], 1);
    ctx.addVig('vig_wizard_east', { x: 2.5, y: Y_T2, z: -17.4, rot: 0 }, [
      ['cw_coal_hearth_pot', -0.4, 0.2, -0.3],
      ['cw_automaton_owl', 0.5, -0.3, -0.5],
      ['cw_brass_orrery', 0.6, 0.8, -0.2],
      ['cw_street_lamp', -0.8, 1.0, 0.0],
    ], 1);

    // Tier 2: South Tram Boarding Promenade (outside `R_TRAM = 9.8` hull!)
    ctx.addVig('vig_tram_stop_s', { x: 2.8, y: Y_T2, z: 12.2, rot: 0 }, [
      ['cw_hatbox_stack', -0.9, 0.0, 0.2],
      ['cw_hatbox_stack', 0.0, 0.2, -0.3],
      ['cw_gramophone', 1.1, -0.1, 0.4],
      ['cw_automaton_owl', 2.0, 0.1, -0.2],
    ], 1);

    // Tier 3 (`y = 4.35m`): Elevated Viaduct West Bastion, Clockmaker Promenade & Walking Turret Deck!
    ctx.addVig('vig_viaduct_bastion', { x: -18.3, y: Y_T3, z: -14.9, rot: 0 }, [
      ['cw_brass_orrery', -0.4, -0.3, 0.4],
      ['cw_coal_hearth_pot', 0.5, -0.4, -0.2],
      ['cw_hatbox_stack', -0.3, 0.5, 0.6],
    ], 1);
    ctx.addVig('vig_viaduct_lookout', { x: -5.5, y: Y_T3, z: -14.9, rot: 0 }, [
      ['cw_brass_orrery', -1.1, 0.0, 0.0],
      ['cw_automaton_owl', 1.1, 0.0, 0.1],
      ['cw_spellbook_lectern', 0.0, 0.0, 0.0],
    ], 1);
    ctx.addVig('vig_clockhall_west', { x: 7.4, y: Y_T3, z: -22.6, rot: 0 }, [
      ['cw_grandfather_clock', -0.4, -1.2, 0.6],
      ['cw_grandfather_clock', -0.2, 0.0, 0.5],
      ['cw_brass_orrery', 0.5, 1.2, 0.3],
      ['cw_automaton_owl', -0.5, 1.8, 0.7],
    ], 1);
    ctx.addVig('vig_clockhall_east', { x: 20.2, y: Y_T3, z: -23.2, rot: 0 }, [
      ['cw_grandfather_clock', -0.6, -0.6, -0.6],
      ['cw_coal_hearth_pot', 0.6, -0.4, -0.4],
      ['cw_brass_orrery', 0.4, 0.9, -0.5],
      ['cw_steam_samovar', -0.5, 1.1, -0.3],
    ], 1);
    ctx.addVig('vig_turret_terrace', { x: 22.4, y: Y_T3, z: -13.2, rot: 0 }, [
      ['cw_coal_hearth_pot', -0.8, 0.0, -1.2],
      ['cw_coal_hearth_pot', 0.6, 0.2, -1.5],
      ['cw_automaton_owl', 1.4, -0.4, -1.3],
      ['cw_street_lamp', -1.6, 0.3, -1.0],
    ], 1);

    // Tier 1 (`y = 0.85m`): Apothecary Arcade, North Canal Walk & South Canal Towpath!
    ctx.addVig('vig_apothecary_porch', { x: -10.2, y: Y_T1, z: 22.4, rot: 0 }, [
      ['cw_potion_rack', -1.2, -0.4, 1.5],
      ['cw_potion_rack', -1.0, 0.8, 1.6],
      ['cw_coal_hearth_pot', 0.2, 1.4, 1.2],
      ['cw_spellbook_lectern', 0.4, -1.1, 1.4],
    ], 1);
    ctx.addVig('vig_canal_arcade', { x: 3.4, y: Y_T1, z: 16.0, rot: 0 }, [
      ['cw_potion_rack', -1.4, -0.3, 0.1],
      ['cw_steam_samovar', 0.0, -0.4, -0.1],
      ['cw_cake_stand', 1.3, -0.2, 0.2],
      ['cw_automaton_owl', 2.2, 0.3, -0.3],
    ], 1);
    ctx.addVig('vig_canal_east', { x: 15.6, y: Y_T1, z: 16.8, rot: 0 }, [
      ['cw_hatbox_stack', -0.8, -0.4, 0.3],
      ['cw_gramophone', 0.5, -0.2, -0.4],
      ['cw_coal_hearth_pot', 1.6, 0.4, 0.2],
      ['cw_street_lamp', -1.8, 0.6, 0.0],
    ], 1);
    ctx.addVig('vig_south_towpath', { x: 3.6, y: Y_T1, z: 25.8, rot: 0 }, [
      ['cw_grandfather_clock', -1.4, 0.2, 3.0],
      ['cw_brass_orrery', 0.0, 0.4, 2.9],
      ['cw_potion_rack', 1.4, 0.2, -2.9],
      ['cw_street_lamp', 2.6, -0.3, 3.1],
    ], 1);

    // Camouflage crouch spots across all 3 tiers
    if (ctx.spot) {
      ctx.spot(0.0, 4.4, 0xe8c06c, 'stone');
      ctx.spot(-4.2, 1.2, 0x7e859c, 'stone');
      ctx.spot(4.2, 1.2, 0xe8c06c, 'stone');
      ctx.spot(-5.5, -16.8, 0xcbb396, 'stone');
      ctx.spot(12.5, -14.8, 0xd4be9e, 'stone');
      ctx.spot(-6.5, 16.8, 0xc8b094, 'stone');
      ctx.spot(3.5, 25.2, 0xc8b094, 'stone');
    }

    // ------------------------------------------------------------------------
    // 11B. MOVING BRASS GEAR-ELEVATORS, BELFRY PAVILION & GREAT BRONZE CHIME BELL
    // ------------------------------------------------------------------------
    const elevBrassMat = new THREE.MeshStandardMaterial({ color: 0xe8b84b, roughness: 0.42, metalness: 0.15, emissive: 0x3b2406, emissiveIntensity: 0.12 });
    const elevDarkMat = new THREE.MeshStandardMaterial({ color: 0x4b4f5e, roughness: 0.65, metalness: 0.1 });
    const elevWoodMat = new THREE.MeshStandardMaterial({ color: 0xb97c46, map: kitTex(THREE, 'wood_light', 1.4, 1.4), roughness: 0.78, metalness: 0 });
    const copperRoofMat = new THREE.MeshStandardMaterial({ color: 0x4c9a84, roughness: 0.58, metalness: 0 });
    const ropeRedMat = new THREE.MeshStandardMaterial({ color: 0xc83e3e, roughness: 0.78, metalness: 0 });
    const bronzeBellMat = new THREE.MeshStandardMaterial({ color: 0xd99b3a, roughness: 0.36, metalness: 0.25, emissive: 0x3a2004, emissiveIntensity: 0.14 });

    for (const def of GEAR_ELEV_DEFS) {
      const y0 = evalGearElevY({ ...def, phaseOffset: def.phase }, 0);
      // Twin stationary brass rack guide columns on East & West edges (North & South completely open for boarding!)
      for (const sx of [-1, 1]) {
        const colX = def.x + sx * 1.56;
        const hCol = (def.yMax - def.yMin) + 2.15;
        const midY = def.yMin - 0.15 + hCol * 0.5;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, hCol, 10), elevDarkMat);
        post.position.set(colX, midY, def.z);
        post.castShadow = true;
        post.receiveShadow = true;
        root.add(post);
        const rackStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, hCol - 0.2, 0.18), elevBrassMat);
        rackStrip.position.set(colX - sx * 0.08, midY, def.z);
        root.add(rackStrip);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), elevBrassMat);
        cap.position.set(colX, def.yMin - 0.15 + hCol + 0.08, def.z);
        root.add(cap);
        if (ctx.addWorldObb) {
          ctx.addWorldObb(colX, def.z, 0.30, 0.30, 0, def.yMin - 0.15, def.yMin + hCol);
        }
      }
      // Overhead cross-gantry arch linking rack columns
      const lintel = new THREE.Mesh(new RoundedBoxGeometry(3.38, 0.22, 0.26, 1, 0.03), elevDarkMat);
      lintel.position.set(def.x, def.yMax + 1.92, def.z);
      lintel.castShadow = true;
      root.add(lintel);

      // Moving Brass Gear-Cog Platform (`userData.keep = true`)
      const platGrp = new THREE.Group();
      platGrp.name = def.id;
      platGrp.userData.keep = true;
      platGrp.position.set(def.x, y0, def.z);
      root.add(platGrp);

      const deckDisc = new THREE.Mesh(new THREE.CylinderGeometry(def.r, def.r * 0.96, 0.16, 16), elevWoodMat);
      deckDisc.position.y = -0.08;
      deckDisc.receiveShadow = true;
      deckDisc.castShadow = true;
      deckDisc.userData.ground = true;
      deckDisc.userData.paint = new THREE.Color(0xc88c56);
      platGrp.add(deckDisc);

      const trimRing = new THREE.Mesh(new THREE.TorusGeometry(def.r, 0.05, 6, 24), elevBrassMat);
      trimRing.rotation.x = PI / 2;
      trimRing.position.y = -0.01;
      platGrp.add(trimRing);

      // Independently spinning outer Toothed Brass Gear Collar!
      const cogCollar = new THREE.Mesh(makeGearGeo(THREE, def.r + 0.18, def.r + 0.02, def.r - 0.10, 16, 0.10), elevBrassMat);
      cogCollar.rotation.x = PI / 2;
      cogCollar.position.y = -0.14;
      cogCollar.userData.keep = true;
      platGrp.add(cogCollar);

      WORLD_STATE.gearElevators.push({
        id: def.id,
        name: def.name,
        x: def.x,
        z: def.z,
        r: def.r,
        yMin: def.yMin,
        yMax: def.yMax,
        dwell: def.dwell,
        travel: def.travel,
        basePhase: def.phase,
        phaseOffset: def.phase,
        animClock: 0,
        y: y0,
        prevY: y0,
        mesh: platGrp,
        cogCollar,
      });
    }

    // Open-Air Viaduct Clockwork Belfry Pavilion & Great Bronze Chime Bell at `(-5.5, Y_T3, -13.7)`!
    const bfx = -5.5, bfy = Y_T3, bfz = -13.7;
    const belfryGrp = new THREE.Group();
    belfryGrp.name = 'cw_viaduct_belfry';
    root.add(belfryGrp);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = bfx + sx * 1.72, pz = bfz + sz * 1.78;
      const post = new THREE.Mesh(new RoundedBoxGeometry(0.24, 3.45, 0.24, 1, 0.03), elevDarkMat);
      post.position.set(px, bfy + 1.72, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      belfryGrp.add(post);
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.24, 8), elevBrassMat);
      collar.position.set(px, bfy + 0.12, pz);
      belfryGrp.add(collar);
      if (ctx.addWorldObb) {
        ctx.addWorldObb(px, pz, 0.28, 0.28, 0, bfy - 0.05, bfy + 3.55);
      }
    }
    // Overhead crossbeam frame + Copper Cupola Canopy + Brass Spire Crown
    for (const sz of [-1, 1]) {
      const bmX = new THREE.Mesh(new RoundedBoxGeometry(3.85, 0.22, 0.24, 1, 0.03), elevWoodMat);
      bmX.position.set(bfx, bfy + 3.38, bfz + sz * 1.78);
      bmX.castShadow = true;
      belfryGrp.add(bmX);
    }
    for (const sx of [-1, 1]) {
      const bmZ = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.22, 3.85, 1, 0.03), elevWoodMat);
      bmZ.position.set(bfx + sx * 1.72, bfy + 3.38, bfz);
      bmZ.castShadow = true;
      belfryGrp.add(bmZ);
    }
    const yokeBeam = new THREE.Mesh(new RoundedBoxGeometry(3.48, 0.24, 0.28, 1, 0.03), elevWoodMat);
    yokeBeam.position.set(bfx, bfy + 3.48, bfz);
    belfryGrp.add(yokeBeam);

    const cupolaBase = new THREE.Mesh(new THREE.ConeGeometry(2.75, 1.55, 8), copperRoofMat);
    cupolaBase.position.set(bfx, bfy + 4.28, bfz);
    cupolaBase.rotation.y = PI / 8;
    cupolaBase.castShadow = true;
    belfryGrp.add(cupolaBase);
    const finialShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.95, 8), elevBrassMat);
    finialShaft.position.set(bfx, bfy + 5.42, bfz);
    belfryGrp.add(finialShaft);
    const finialOrb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), elevBrassMat);
    finialOrb.position.set(bfx, bfy + 5.88, bfz);
    belfryGrp.add(finialOrb);

    // Suspended Animated Great Bronze Chime Bell (`userData.keep = true`, shootable via `ctx.solids`!)
    const bellPivot = new THREE.Group();
    bellPivot.name = 'cw_great_bell_pivot';
    bellPivot.userData.keep = true;
    bellPivot.position.set(bfx, bfy + 3.35, bfz);
    root.add(bellPivot);

    const bellDome = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.62, 0.88, 18, 1, false), bronzeBellMat);
    bellDome.position.y = -0.58;
    bellDome.castShadow = true;
    bellDome.userData.keep = true;
    bellDome.userData.isBelfryBell = true;
    bellPivot.add(bellDome);
    const bellLip = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 8, 22), bronzeBellMat);
    bellLip.rotation.x = PI / 2;
    bellLip.position.y = -1.00;
    bellLip.userData.keep = true;
    bellLip.userData.isBelfryBell = true;
    bellPivot.add(bellLip);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), ropeRedMat);
    clapper.position.y = -1.10;
    clapper.userData.keep = true;
    clapper.userData.isBelfryBell = true;
    bellPivot.add(clapper);
    if (ctx.solids) ctx.solids.push(bellDome, bellLip, clapper);
    WORLD_STATE.bellPivot = bellPivot;

    // Hanging Crimson Bell-Pull Rope at `(-4.1, Y_T3, -12.3)` + Golden Acoustic Shockwave Rings (22m)
    const ropePost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 2.75, 8), ropeRedMat);
    ropePost.position.set(BELFRY_BELL_POS.x, bfy + 1.98, BELFRY_BELL_POS.z);
    belfryGrp.add(ropePost);
    const ropeTassel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.24, 10), elevBrassMat);
    ropeTassel.position.set(BELFRY_BELL_POS.x, bfy + 0.62, BELFRY_BELL_POS.z);
    belfryGrp.add(ropeTassel);

    WORLD_STATE.mechSpots.push({
      id: 'belfry_chime_bell',
      kind: 'mechanism',
      mechanismType: 'bell',
      icon: '🔔',
      baseLabel: 'Ring Great Bronze Bell (Prop-Rattle)',
      label: 'Ring Great Bronze Bell (Prop-Rattle)',
      x: BELFRY_BELL_POS.x,
      y: BELFRY_BELL_POS.y,
      z: BELFRY_BELL_POS.z,
      trigR: BELFRY_BELL_POS.triggerRadius,
      cdUntil: 0,
    });

    const bellPulseMat = new THREE.MeshBasicMaterial({
      color: 0xffd86b,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const bellPulseMesh = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 44), bellPulseMat);
    bellPulseMesh.userData.keep = true;
    bellPulseMesh.userData.noSolid = true;
    bellPulseMesh.rotation.x = PI / 2;
    bellPulseMesh.position.set(bfx, bfy + 2.45, bfz);
    bellPulseMesh.visible = false;
    root.add(bellPulseMesh);
    WORLD_STATE.bellPulseMesh = bellPulseMesh;

    const bellGroundPulseMesh = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.055, 8, 48), bellPulseMat.clone());
    bellGroundPulseMesh.userData.keep = true;
    bellGroundPulseMesh.userData.noSolid = true;
    bellGroundPulseMesh.rotation.x = PI / 2;
    bellGroundPulseMesh.position.set(bfx, Y_T2 + 0.16, bfz);
    bellGroundPulseMesh.visible = false;
    root.add(bellGroundPulseMesh);
    WORLD_STATE.bellGroundPulseMesh = bellGroundPulseMesh;

    // 3 Elevated Bell-Tower Owl Perch Brackets (`kind: 'hook', propId: 'cw_automaton_owl'`)
    const belfryPerchDefs = [
      { id: 'belfry_perch_south', x: -5.5,  z: -11.92, groundY: Y_T3, hangY: 2.02, rot: 0,       placeName: 'South Belfry Rail' },
      { id: 'belfry_perch_west',  x: -7.22, z: -13.7,  groundY: Y_T3, hangY: 2.02, rot: -PI / 2, placeName: 'West Belfry Rail' },
      { id: 'belfry_perch_guild', x: 13.6,  z: -17.34, groundY: Y_T3, hangY: 2.05, rot: 0,       placeName: 'Clockmaker Guildhall Loft' },
    ];
    for (const bp of belfryPerchDefs) {
      const perchMesh = new THREE.Group();
      perchMesh.position.set(bp.x, bp.groundY + bp.hangY, bp.z);
      perchMesh.rotation.y = bp.rot;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), elevBrassMat);
      bar.rotation.z = PI / 2;
      bar.position.set(0, -0.02, 0.16);
      const armL = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.09, 0.34, 1, 0.02), elevWoodMat);
      armL.position.set(-0.24, -0.03, 0.04);
      const armR = armL.clone();
      armR.position.x = 0.24;
      perchMesh.add(bar, armL, armR);
      root.add(perchMesh);

      WORLD_STATE.interactSpots.push({
        kind: 'hook',
        id: bp.id,
        propId: 'cw_automaton_owl',
        icon: '🦉',
        label: `Perch on ${bp.placeName}`,
        leaveLabel: 'Drop From Belfry Perch',
        disguiseLabel: 'Perched Clockwork Owl 🦉',
        enterHint: `🦉 Perched high on the ${bp.placeName} overlooking Pendulum Square! (WASD or G to drop)`,
        exitHint: 'Hopped down from the Belfry Perch! 🦉',
        x: bp.x,
        z: bp.z,
        groundY: bp.groundY,
        hangY: bp.hangY,
        rot: bp.rot,
        occupiedBy: null,
      });
    }

    // Playable Disguise Prop Spawns across all 3 tiers (`cw_clockwork_pup` & `cw_automaton_owl`)
    if (ctx.addSlot) {
      ctx.addSlot(-3.8, 3.6, 'cw_clockwork_pup', 0.4, Y_T2);
      ctx.addSlot(4.4, -3.2, 'cw_automaton_owl', -0.5, Y_T2);
      ctx.addSlot(11.6, -15.4, 'cw_clockwork_pup', 1.1, Y_T3);
      ctx.addSlot(-10.2, 19.6, 'cw_automaton_owl', 0.2, Y_T1);
    }

    // Living Fleet: 4 Brass Wind-Up Mechanical Hounds & 3 Clockwork Owls using Belfry Perches!
    WORLD_STATE.creatures = createCreatureFleetController(THREE, ctx, [
      {
        id: 'cw_automaton_owl',
        builder: buildClockworkOwl,
        kind: 'flyer',
        canFly: true,
        radius: 0.42,
        height: 0.98,
        speed: 5.1,
        orbitCx: 0.0,
        orbitCz: -3.5,
        orbitRx: 14.5,
        orbitRz: 10.5,
        orbitY: 9.2,
        bobY: 0.85,
        orbitSpeed: 0.34,
        callType: 'owl',
        perches: [
          { x: -5.5, y: Y_T3 + 2.02, z: -11.92, rotY: 0 },
          { x: 13.6, y: Y_T3 + 2.05, z: -17.34, rotY: 0.3 },
        ],
      },
      {
        id: 'cw_automaton_owl',
        builder: buildClockworkOwl,
        kind: 'flyer',
        canFly: true,
        radius: 0.42,
        height: 0.98,
        speed: 5.0,
        figure8: true,
        orbitCx: -6.5,
        orbitCz: -8.5,
        orbitRx: 11.5,
        orbitRz: 9.5,
        orbitY: 8.6,
        bobY: 0.75,
        orbitSpeed: 0.36,
        phase: 2.1,
        callType: 'owl',
        perches: [
          { x: -7.22, y: Y_T3 + 2.02, z: -13.7, rotY: -PI / 2 },
          { x: -5.5,  y: Y_T3 + 2.02, z: -11.92, rotY: 0.2 },
        ],
      },
      {
        id: 'cw_automaton_owl',
        builder: buildClockworkOwl,
        kind: 'flyer',
        canFly: true,
        radius: 0.42,
        height: 0.98,
        speed: 5.2,
        orbitCx: 6.5,
        orbitCz: 4.5,
        orbitRx: 12.0,
        orbitRz: 12.0,
        orbitY: 8.2,
        bobY: 0.9,
        orbitSpeed: 0.32,
        phase: 4.2,
        callType: 'owl',
        perches: [
          { x: 13.6, y: Y_T3 + 2.05, z: -17.34, rotY: -0.4 },
          { x: -5.5, y: Y_T3 + 2.02, z: -11.92, rotY: 0 },
        ],
      },
      {
        id: 'cw_clockwork_pup',
        builder: buildClockworkPup,
        kind: 'ground',
        canFly: false,
        radius: 0.40,
        height: 0.66,
        speed: 2.4,
        pauseSec: 1.5,
        callType: 'clockwork',
        waypoints: [
          { x: -4.8, y: Y_T2, z: 3.4 },
          { x: 4.8,  y: Y_T2, z: 3.4 },
          { x: 4.8,  y: Y_T2, z: -2.2 },
          { x: -4.8, y: Y_T2, z: -2.2 },
        ],
      },
      {
        id: 'cw_clockwork_pup',
        builder: buildClockworkPup,
        kind: 'ground',
        canFly: false,
        radius: 0.40,
        height: 0.66,
        speed: 2.35,
        pauseSec: 1.4,
        callType: 'clockwork',
        waypoints: [
          { x: -13.2, y: Y_T2, z: 4.4 },
          { x: -12.8, y: Y_T2, z: -2.4 },
          { x: -15.4, y: Y_T2, z: 1.2 },
        ],
      },
      {
        id: 'cw_clockwork_pup',
        builder: buildClockworkPup,
        kind: 'ground',
        canFly: false,
        radius: 0.40,
        height: 0.66,
        speed: 2.3,
        pauseSec: 1.6,
        callType: 'clockwork',
        waypoints: [
          { x: 9.2,  y: Y_T3, z: -15.2 },
          { x: 15.8, y: Y_T3, z: -15.0 },
          { x: 15.8, y: Y_T3, z: -12.8 },
          { x: 9.2,  y: Y_T3, z: -12.8 },
        ],
      },
      {
        id: 'cw_clockwork_pup',
        builder: buildClockworkPup,
        kind: 'ground',
        canFly: false,
        radius: 0.40,
        height: 0.66,
        speed: 2.25,
        pauseSec: 1.5,
        callType: 'clockwork',
        waypoints: [
          { x: -10.8, y: Y_T1, z: 16.5 },
          { x: -3.5,  y: Y_T1, z: 16.5 },
          { x: -6.8,  y: Y_T1, z: 18.2 },
        ],
      },
    ]);

    // ------------------------------------------------------------------------
    // 11B. CLOCKWORK BESPOKE MECHANICS: Conveyors, Gear Squeeze Vents,
    //      Swinging Clock Pendulums, Chrono Pocketwatches, Escapement & Chaos Dial!
    // ------------------------------------------------------------------------
    const cwMc = createMatCache(THREE);
    const cwBrassMat = cwMc(0xd6a43e, { roughness: 0.44 });
    const cwIronMat = cwMc(0x464e5e, { roughness: 0.65 });
    const cwWoodMat = cwMc(0x9a6434, { roughness: 0.84 });
    const cwGlowMat = cwMc(0xffba42, { emissive: 0xff881c, emissiveIntensity: 1.05, roughness: 0.35 });
    const cwCopperMat = cwMc(0xc97842, { roughness: 0.46, emissive: 0x2e1204, emissiveIntensity: 0.14 });
    const cwCreamMat = cwMc(0xfff4d8, { roughness: 0.55, emissive: 0x3b2a10, emissiveIntensity: 0.25 });

    // 1. Moving Brass Conveyor Arcade & Viaduct Belts (`createMovingTrackSystem`) + Carrier Props
    const conveyorSpecs = [
      { id: 'conv_canal', x0: -6.2, z0: 15.6, x1: 6.2, z1: 15.6, y: Y_T1, width: 1.85, speed: 3.1 },
      { id: 'conv_viaduct', x0: -12.8, z0: -13.7, x1: 2.6, z1: -13.7, y: Y_T3, width: 1.85, speed: 3.4 },
    ];
    for (const cs of conveyorSpecs) {
      WORLD_STATE.tracks.addConveyorSegment({
        ...cs,
        getDirSign: () => WORLD_STATE.conveyorDirSign,
      });
      const cx = (cs.x0 + cs.x1) * 0.5;
      const len = Math.hypot(cs.x1 - cs.x0, cs.z1 - cs.z0);
      const trackBed = new THREE.Mesh(new RoundedBoxGeometry(len, 0.08, cs.width, 1, 0.02), cwIronMat);
      trackBed.position.set(cx, cs.y + 0.02, cs.z0);
      trackBed.receiveShadow = true;
      trackBed.userData.ground = true;
      root.add(trackBed);
      const slatCount = Math.floor(len / 1.35);
      for (let s = 0; s < slatCount; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, cs.width - 0.16), cwBrassMat);
        slat.userData.keep = true;
        slat.position.set(cs.x0, cs.y + 0.06, cs.z0);
        root.add(slat);
        WORLD_STATE.conveyorSlats.push({ mesh: slat, x0: cs.x0, x1: cs.x1, z: cs.z0, y: cs.y + 0.06, frac: s / slatCount, speed: cs.speed / len });
      }
    }
    const cwPropsKit = buildMapProps(THREE);
    const carrierOrrery = cwPropsKit.cw_brass_orrery();
    const carrierSamovar = cwPropsKit.cw_steam_samovar();
    root.add(carrierOrrery, carrierSamovar);
    WORLD_STATE.tracks.addCarrierProp(carrierOrrery, (u) => {
      const f = ((u * 0.25 * WORLD_STATE.conveyorDirSign) % 1 + 1) % 1;
      const tri = f < 0.5 ? f * 2 : 2 - f * 2;
      return { x: -6.0 + tri * 12.0, y: Y_T1 + 0.06, z: 15.6, yaw: u * 0.9 };
    });
    WORLD_STATE.tracks.addCarrierProp(carrierSamovar, (u) => {
      const f = ((u * 0.22 * WORLD_STATE.conveyorDirSign + 0.5) % 1 + 1) % 1;
      const tri = f < 0.5 ? f * 2 : 2 - f * 2;
      return { x: -12.6 + tri * 15.0, y: Y_T3 + 0.06, z: -13.7, yaw: -u * 0.8 };
    });

    // 2. Open Tiny Disguise Props beside Brass Gear Squeeze Vents (`maxR: 0.36`)
    if (ctx.addSlot) {
      ctx.addSlot(-12.4, -3.6, 'cw_clockwork_pup', 0.2, Y_T2);
      ctx.addSlot(11.4, 15.2, 'cw_automaton_owl', -0.3, Y_T1);
    }

    // 3. 2 Clockwork Brass Gear Squeeze Vents (`maxR: 0.36` allows Clockwork Pup, Cuckoo, Grandfather, Owl!)
    for (const [vx, vy, vz, rotY, bw] of [
      [-13.8, Y_T2, -4.2, 0, 2.2],
      [12.2, Y_T1, 16.2, PI * 0.5, 2.2],
    ]) {
      const vg = new THREE.Group();
      vg.position.set(vx, vy, vz);
      vg.rotation.y = rotY;
      const lintel = new THREE.Mesh(new RoundedBoxGeometry(0.40, 0.94, bw, 1, 0.03), cwIronMat);
      lintel.position.y = 1.44;
      lintel.castShadow = true;
      vg.add(lintel);
      for (const sz of [-bw * 0.44, bw * 0.44]) {
        const jamb = new THREE.Mesh(new RoundedBoxGeometry(0.34, 1.9, 0.24, 1, 0.02), cwBrassMat);
        jamb.position.set(0, 0.95, sz);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.16), cwGlowMat);
        lamp.position.set(0, 0.80, sz);
        vg.add(jamb, lamp);
      }
      root.add(vg);
      if (ctx.solids) ctx.solids.push(lintel);
      if (ctx.addWorldObb) {
        const b = ctx.addWorldObb(vx, vz, 0.24, bw * 0.46, rotY, vy - 0.25, vy + 2.6, false);
        if (b) b.maxR = 0.36;
      }
    }

    // 4. Chaos & Conveyor-Reverse Dial (`mech_scramble_dial`)
    {
      const dialGrp = new THREE.Group();
      dialGrp.position.set(2.4, Y_T2, -8.8);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.05, 10), cwIronMat);
      ped.position.y = 0.525;
      const cog = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.07, 6, 12), cwBrassMat);
      cog.position.set(0, 1.28, 0);
      cog.userData.keep = true;
      dialGrp.add(ped, cog);
      root.add(dialGrp);
      WORLD_STATE.chaosDialMesh = cog;
      WORLD_STATE.mechSpots.push({
        id: 'mech_scramble_dial',
        kind: 'mechanism',
        icon: '🌀',
        baseLabel: 'Twist Chaos & Reverse Dial',
        label: 'Twist Chaos & Reverse Dial',
        x: 2.4,
        y: Y_T2,
        z: -8.8,
        trigR: 2.35,
        cdUntil: 0,
      });
    }

    // 5. Clocktower Escapement Lever (`mech_clocktower_escapement` — early 18s Midnight Rush!)
    {
      const escX = 16.2, escY = Y_T3, escZ = -16.4;
      const escGrp = new THREE.Group();
      escGrp.position.set(escX, escY, escZ);
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.92, 12), cwIronMat);
      plinth.position.y = 0.46;
      plinth.castShadow = true;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 16), cwBrassMat);
      collar.rotation.x = PI / 2;
      collar.position.y = 0.92;
      const wheel = new THREE.Mesh(makeGearGeo(THREE, 0.38, 0.08, 12, 5), cwBrassMat);
      wheel.position.set(0, 1.24, -0.14);
      const leverPivot = new THREE.Group();
      leverPivot.position.set(0, 0.96, 0.04);
      leverPivot.rotation.z = -0.38;
      leverPivot.userData.keep = true;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 8), cwBrassMat);
      rod.position.y = 0.475;
      const knobMat = new THREE.MeshStandardMaterial({
        color: 0xd93c3c,
        emissive: 0x6b1414,
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0,
      });
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), knobMat);
      knob.position.y = 0.98;
      leverPivot.add(rod, knob);
      escGrp.add(plinth, collar, wheel, leverPivot);
      root.add(escGrp);
      WORLD_STATE.escapementLeverMesh = leverPivot;
      WORLD_STATE.mechSpots.push({
        id: 'mech_clocktower_escapement',
        kind: 'mechanism',
        icon: '🕛',
        baseLabel: 'Pull Clocktower Escapement (Midnight Rush)',
        label: 'Pull Clocktower Escapement (Midnight Rush)',
        x: escX,
        y: escY,
        z: escZ,
        trigR: 2.35,
        cdUntil: 0,
      });
    }

    // 6. 2 Giant Swinging Brass Clock Pendulums (Central Courtyard Archway & Upper Viaduct Walk)
    const pendulumSpecs = [
      {
        id: 'pend_courtyard',
        name: 'Central Courtyard Archway Pendulum',
        x: 0.0,
        groundY: Y_T2,
        z: 6.2,
        axis: 'x',
        halfSpan: 2.45,
        pivotHeight: 4.35,
        length: 3.55,
        bobR: 0.60,
        speed: 2.05,
        maxAng: 0.60,
      },
      {
        id: 'pend_viaduct',
        name: 'Upper Viaduct Walk Pendulum',
        x: -0.1,
        groundY: Y_T3,
        z: -13.7,
        axis: 'z',
        halfSpan: 1.85,
        pivotHeight: 4.10,
        length: 3.30,
        bobR: 0.56,
        speed: 2.25,
        maxAng: 0.50,
      },
    ];
    for (const ps of pendulumSpecs) {
      const gantryGrp = new THREE.Group();
      gantryGrp.position.set(ps.x, ps.groundY, ps.z);
      const beamH = ps.pivotHeight + 0.16;
      for (const side of [-1, 1]) {
        const px = ps.axis === 'x' ? side * ps.halfSpan : 0;
        const pz = ps.axis === 'z' ? side * ps.halfSpan : 0;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, beamH, 10), cwIronMat);
        col.position.set(px, beamH * 0.5, pz);
        col.castShadow = true;
        col.receiveShadow = true;
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.34, 10), cwBrassMat);
        plinth.position.set(px, 0.17, pz);
        const capGear = new THREE.Mesh(makeGearGeo(THREE, 0.32, 0.08, 12, 5), cwBrassMat);
        capGear.position.set(px, beamH - 0.14, pz);
        if (ps.axis === 'z') capGear.rotation.y = PI / 2;
        gantryGrp.add(col, plinth, capGear);

        if (ctx.addWorldObb) {
          ctx.addWorldObb(ps.x + px, ps.z + pz, 0.20, 0.20, 0, ps.groundY - 0.15, ps.groundY + beamH + 0.2, false);
        }
      }
      const spanLen = ps.halfSpan * 2 + 0.44;
      const topBeam = new THREE.Mesh(
        new RoundedBoxGeometry(ps.axis === 'x' ? spanLen : 0.34, 0.28, ps.axis === 'z' ? spanLen : 0.34, 1, 0.04),
        cwIronMat
      );
      topBeam.position.set(0, beamH, 0);
      topBeam.castShadow = true;
      const crownDial = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.24, 16), cwBrassMat);
      crownDial.rotation.set(ps.axis === 'x' ? PI / 2 : 0, 0, ps.axis === 'z' ? PI / 2 : 0);
      crownDial.position.set(0, ps.pivotHeight, 0);
      gantryGrp.add(topBeam, crownDial);
      root.add(gantryGrp);

      // Animated Pendulum Pivot (`userData.keep = true`)
      const pendPivot = new THREE.Group();
      pendPivot.name = ps.id;
      pendPivot.userData.keep = true;
      pendPivot.position.set(ps.x, ps.groundY + ps.pivotHeight, ps.z);

      for (const rOff of [-0.11, 0.11]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, ps.length, 8), cwBrassMat);
        rod.position.set(ps.axis === 'x' ? rOff : 0, -ps.length * 0.5, ps.axis === 'z' ? rOff : 0);
        rod.castShadow = true;
        rod.userData.keep = true;
        pendPivot.add(rod);
      }
      const brace = new THREE.Mesh(new RoundedBoxGeometry(ps.axis === 'x' ? 0.34 : 0.08, 0.10, ps.axis === 'z' ? 0.34 : 0.08, 1, 0.02), cwCopperMat);
      brace.position.set(0, -ps.length * 0.55, 0);
      brace.userData.keep = true;
      pendPivot.add(brace);

      const bobMat = new THREE.MeshStandardMaterial({
        color: 0xebb948,
        emissive: 0x3b2406,
        emissiveIntensity: 0.20,
        roughness: 0.34,
        metalness: 0,
      });
      const bobDisc = new THREE.Mesh(new THREE.SphereGeometry(ps.bobR, 20, 14), bobMat);
      bobDisc.scale.set(ps.axis === 'z' ? 0.44 : 1.0, 1.0, ps.axis === 'x' ? 0.44 : 1.0);
      bobDisc.position.set(0, -ps.length, 0);
      bobDisc.castShadow = true;
      bobDisc.userData.keep = true;
      pendPivot.add(bobDisc);

      const bobRim = new THREE.Mesh(new THREE.TorusGeometry(ps.bobR * 0.96, 0.06, 8, 22), cwCopperMat);
      if (ps.axis === 'z') bobRim.rotation.y = PI / 2;
      bobRim.position.set(0, -ps.length, 0);
      bobRim.userData.keep = true;
      pendPivot.add(bobRim);

      const gemMat = new THREE.MeshStandardMaterial({
        color: 0xffe49c,
        emissive: 0xffaa28,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0,
      });
      const gem = new THREE.Mesh(new THREE.SphereGeometry(ps.bobR * 0.32, 12, 10), gemMat);
      gem.scale.set(ps.axis === 'z' ? 0.65 : 1.0, 1.0, ps.axis === 'x' ? 0.65 : 1.0);
      gem.position.set(0, -ps.length, 0);
      gem.userData.keep = true;
      pendPivot.add(gem);

      root.add(pendPivot);
      WORLD_STATE.pendulums.push({
        id: ps.id,
        name: ps.name,
        x: ps.x,
        groundY: ps.groundY,
        pivotY: ps.groundY + ps.pivotHeight,
        z: ps.z,
        axis: ps.axis,
        length: ps.length,
        bobR: ps.bobR,
        speed: ps.speed,
        maxAng: ps.maxAng,
        animTime: 0,
        angle: 0,
        angVel: ps.speed * ps.maxAng,
        frozen: false,
        bobX: ps.x,
        bobY: ps.groundY + ps.pivotHeight - ps.length,
        bobZ: ps.z,
        pivot: pendPivot,
        gemMat,
      });
    }

    // 7. 2 Glowing Collectible/Recharging Golden Chrono Pocketwatch Pedestals (Wizard Court & Canal Arcade)
    const chronoSpecs = [
      {
        id: 'chrono_wizard',
        mechId: 'mech_chrono_wizard',
        name: 'Wizard Court Chrono Pocketwatch',
        x: -2.6,
        y: Y_T2,
        z: -17.2,
      },
      {
        id: 'chrono_canal',
        mechId: 'mech_chrono_canal',
        name: 'Canal Arcade Chrono Pocketwatch',
        x: 1.0,
        y: Y_T1,
        z: 14.6,
      },
    ];
    for (const cs of chronoSpecs) {
      const pedGrp = new THREE.Group();
      pedGrp.position.set(cs.x, cs.y, cs.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.78, 12), cwIronMat);
      base.position.y = 0.39;
      base.castShadow = true;
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 6, 18), cwBrassMat);
      trim.rotation.x = PI / 2;
      trim.position.y = 0.78;
      const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.32, 0.08, 12), cwMc(0x5c2e78, { roughness: 0.78 }));
      cushion.position.y = 0.82;
      pedGrp.add(base, trim, cushion);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf6c963,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.045, 6, 24), ringMat);
      ringMesh.rotation.x = PI / 2;
      ringMesh.position.y = 0.06;
      ringMesh.userData.keep = true;
      ringMesh.userData.noSolid = true;
      pedGrp.add(ringMesh);

      // Hovering Golden Chrono Pocketwatch (`userData.keep = true`, `metalness: 0`)
      const watchGrp = new THREE.Group();
      watchGrp.userData.keep = true;
      watchGrp.position.set(0, 1.30, 0);
      const caseMat = new THREE.MeshStandardMaterial({
        color: 0xf5c84c,
        emissive: 0x704808,
        emissiveIntensity: 0.38,
        roughness: 0.32,
        metalness: 0,
      });
      const caseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.12, 18), caseMat);
      caseBody.rotation.x = PI / 2;
      caseBody.userData.keep = true;
      const faceF = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), cwCreamMat);
      faceF.position.z = 0.064;
      faceF.userData.keep = true;
      const faceB = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), cwCreamMat);
      faceB.rotation.y = PI;
      faceB.position.z = -0.064;
      faceB.userData.keep = true;
      const handMin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), cwIronMat);
      handMin.position.set(0, 0.06, 0.072);
      handMin.userData.keep = true;
      const handHr = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.02), cwCopperMat);
      handHr.position.set(0.045, 0, 0.072);
      handHr.userData.keep = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.10, 8), caseMat);
      stem.position.y = 0.34;
      stem.userData.keep = true;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 14), caseMat);
      bow.position.y = 0.44;
      bow.userData.keep = true;
      watchGrp.add(caseBody, faceF, faceB, handMin, handHr, stem, bow);
      pedGrp.add(watchGrp);

      root.add(pedGrp);
      WORLD_STATE.pocketwatches.push({
        id: cs.id,
        mechId: cs.mechId,
        name: cs.name,
        x: cs.x,
        y: cs.y,
        z: cs.z,
        cdUntil: 0,
        watchMesh: watchGrp,
        ringMesh,
      });
      WORLD_STATE.mechSpots.push({
        id: cs.mechId,
        kind: 'mechanism',
        mechKind: 'chrono_watch',
        icon: '⏱️',
        baseLabel: `Activate ${cs.name} (5s Time-Slow)`,
        label: `Activate ${cs.name} (5s Time-Slow)`,
        x: cs.x,
        y: cs.y,
        z: cs.z,
        trigR: 2.35,
        cdUntil: 0,
      });
    }

    // ------------------------------------------------------------------------
    // 12. Storybook World Update Loop (`update(dt, now, G)`)
    // ------------------------------------------------------------------------
    const dummy = new THREE.Object3D();
    let elapsed = 0;
    let wheelAngle = 0;

    return {
      turret: null,
      dispose() {
        clearTimeDomes();
        if (WORLD_STATE.creatures) {
          WORLD_STATE.creatures.dispose();
          WORLD_STATE.creatures = null;
        }
        WORLD_STATE.gearElevators = [];
        WORLD_STATE.bellPivot = null;
        WORLD_STATE.bellPulseMesh = null;
        WORLD_STATE.bellGroundPulseMesh = null;
        WORLD_STATE.turret = null;
        WORLD_STATE.tracks = null;
        WORLD_STATE.mechSpots = [];
        WORLD_STATE.conveyorSlats = [];
        WORLD_STATE.pendulums = [];
        WORLD_STATE.pendulumHitCd.clear();
        WORLD_STATE.pocketwatches = [];
        WORLD_STATE.tramBellMesh = null;
        WORLD_STATE.tramBellSpot = null;
        WORLD_STATE.escapementLeverMesh = null;
        WORLD_STATE.chaosDialMesh = null;
        WORLD_STATE.getG = null;
        WORLD_STATE.getActors = null;
        WORLD_STATE.root = null;
        WORLD_STATE.audio = null;
      },
      update(dt = 0.016, now, G) {
        const safeDt = clamp(dt, 0, 0.08);
        elapsed = typeof now === 'number' ? now : elapsed + safeDt;
        WORLD_STATE.elapsed = elapsed;
        const nowSec = performance.now() * 0.001;
        const liveG = G || WORLD_STATE.getG?.() || null;

        if (WORLD_STATE.tracks) WORLD_STATE.tracks.update(safeDt, elapsed);

        // Animate brass conveyor slats along current direction sign
        for (let i = 0; i < WORLD_STATE.conveyorSlats.length; i++) {
          const sl = WORLD_STATE.conveyorSlats[i];
          sl.frac = ((sl.frac + safeDt * sl.speed * WORLD_STATE.conveyorDirSign) % 1 + 1) % 1;
          sl.mesh.position.x = sl.x0 + (sl.x1 - sl.x0) * sl.frac;
        }
        if (WORLD_STATE.chaosDialMesh) {
          WORLD_STATE.chaosDialMesh.rotation.z += safeDt * (nowSec < WORLD_STATE.scrambleUntil ? -5.0 : 0.9) * WORLD_STATE.conveyorDirSign;
        }

        // A. Midnight Ghost Hunt ("Clock Strikes Twelve!") Dynamic Escalation at G.t <= 45s
        if (liveG && !WORLD_STATE.midnightDone && (liveG.phase === 'seek' || liveG.phase === 'survive') && !liveG.over && typeof liveG.t === 'number' && liveG.t <= 45) {
          triggerMidnightRush(nowSec, 'timer');
        }
        const midnightActive = isMidnightRushActive(nowSec, liveG);

        if (WORLD_STATE.escapementLeverMesh) {
          WORLD_STATE.escapementPullT = Math.max(0, WORLD_STATE.escapementPullT - safeDt * 1.4);
          WORLD_STATE.escapementLeverMesh.rotation.z = -0.38 + Math.sin(WORLD_STATE.escapementPullT * PI) * 0.95;
        }

        // B1. Update Sepia Time-Slow Bubbles (`radius = 9.5m`, 5.0s duration)
        for (let i = WORLD_STATE.timeDomes.length - 1; i >= 0; i--) {
          const dome = WORLD_STATE.timeDomes[i];
          const rem = dome.until - nowSec;
          if (rem <= 0) {
            if (dome.group && dome.group.parent) dome.group.parent.remove(dome.group);
            WORLD_STATE.timeDomes.splice(i, 1);
            continue;
          }
          const fade = clamp(rem / 0.85, 0, 1);
          const pulse = 1 + Math.sin(elapsed * 3.8) * 0.014;
          if (dome.group) dome.group.scale.setScalar(pulse);
          if (dome.shellMesh?.material) dome.shellMesh.material.opacity = 0.16 * fade;
          if (dome.ringMesh?.material) dome.ringMesh.material.opacity = 0.72 * fade;
          if (dome.dialMesh) {
            dome.dialMesh.rotation.z = elapsed * 0.45;
            if (dome.dialMesh.material) dome.dialMesh.material.opacity = 0.24 * fade;
          }
        }

        // B2. Update Golden Chrono Pocketwatches (hover, recharge & walk-over pickup during active hunt!)
        const activeHunt = !!(liveG && (liveG.phase === 'seek' || liveG.phase === 'survive') && !liveG.over);
        const actors = activeHunt && WORLD_STATE.getActors ? (WORLD_STATE.getActors() || []) : null;
        for (let i = 0; i < WORLD_STATE.pocketwatches.length; i++) {
          const pw = WORLD_STATE.pocketwatches[i];
          const ready = nowSec >= pw.cdUntil;
          if (pw.watchMesh) {
            pw.watchMesh.visible = ready;
            if (ready) {
              pw.watchMesh.position.y = 1.30 + Math.sin(elapsed * 2.6 + i * 1.3) * 0.09;
              pw.watchMesh.rotation.y = elapsed * 1.45 + i;
            }
          }
          if (pw.ringMesh?.material) {
            pw.ringMesh.material.opacity = ready ? (0.65 + Math.sin(elapsed * 4.0) * 0.2) : 0.22;
          }
          if (ready && actors) {
            for (let a = 0; a < actors.length; a++) {
              const ch = actors[a];
              const cu = ch?.userData;
              if (!ch || !cu || cu.actor?.eliminated || cu.specialMode || cu.ridePath || cu.rideRail) continue;
              const py = (cu.groundY ?? ch.position.y ?? 0) + (cu.jy || 0);
              if (Math.abs(py - pw.y) <= 0.95 && Math.hypot(ch.position.x - pw.x, ch.position.z - pw.z) <= 1.25) {
                activateChronoPocketwatch(pw, ch, nowSec);
                break;
              }
            }
          }
        }

        // B3. Animate Swinging Brass Clock Pendulums (freeze mid-air when inside a Time-Slow Bubble!)
        for (let i = 0; i < WORLD_STATE.pendulums.length; i++) {
          const pend = WORLD_STATE.pendulums[i];
          let isFrozen = false;
          for (let dIdx = 0; dIdx < WORLD_STATE.timeDomes.length; dIdx++) {
            const dome = WORLD_STATE.timeDomes[dIdx];
            if (nowSec >= dome.until) continue;
            const dBob = Math.hypot(pend.bobX - dome.x, pend.bobY - dome.y, pend.bobZ - dome.z);
            const dCtr = Math.hypot(pend.x - dome.x, (pend.groundY + 0.8) - dome.y, pend.z - dome.z);
            if (dBob <= dome.radius || dCtr <= dome.radius) {
              isFrozen = true;
              break;
            }
          }
          pend.frozen = isFrozen;
          if (!isFrozen) {
            pend.animTime += safeDt;
          }
          pend.angle = Math.sin(pend.animTime * pend.speed) * pend.maxAng;
          pend.angVel = isFrozen ? 0 : Math.cos(pend.animTime * pend.speed) * pend.speed * pend.maxAng;
          if (pend.pivot) {
            if (pend.axis === 'x') {
              pend.pivot.rotation.z = pend.angle;
              pend.bobX = pend.x + Math.sin(pend.angle) * pend.length;
              pend.bobY = pend.pivotY - Math.cos(pend.angle) * pend.length;
              pend.bobZ = pend.z;
            } else {
              pend.pivot.rotation.x = pend.angle;
              pend.bobX = pend.x;
              pend.bobY = pend.pivotY - Math.cos(pend.angle) * pend.length;
              pend.bobZ = pend.z - Math.sin(pend.angle) * pend.length;
            }
          }
          if (pend.gemMat) {
            pend.gemMat.emissiveIntensity = isFrozen ? 1.85 : 0.45;
          }
        }

        // 0. Moving Brass Gear-Elevators (1.8x speed in Midnight Rush!) + Great Bronze Bell + Clockwork Fleet
        const liftSpeedMul = midnightActive ? 1.8 : 1.0;
        for (let i = 0; i < WORLD_STATE.gearElevators.length; i++) {
          const ge = WORLD_STATE.gearElevators[i];
          ge.prevY = ge.y;
          ge.animClock += safeDt * liftSpeedMul;
          ge.y = evalGearElevY(ge, ge.animClock);
          if (ge.mesh) {
            ge.mesh.position.y = ge.y;
          }
          if (ge.cogCollar) {
            const vDir = ge.y > ge.prevY + 0.001 ? 1.35 : ge.y < ge.prevY - 0.001 ? -1.35 : 0.25;
            ge.cogCollar.rotation.z += safeDt * vDir * liftSpeedMul;
          }
        }
        if (WORLD_STATE.bellPivot) {
          WORLD_STATE.bellSwingPhase += safeDt * 5.6;
          WORLD_STATE.bellSwingAmp *= Math.exp(-safeDt * 0.72);
          const idleSway = Math.sin(elapsed * 0.9) * 0.02;
          WORLD_STATE.bellPivot.rotation.z = idleSway + Math.sin(WORLD_STATE.bellSwingPhase) * WORLD_STATE.bellSwingAmp;
        }
        if (WORLD_STATE.bellPulseMesh && WORLD_STATE.bellPulseMesh.visible) {
          const rem = WORLD_STATE.bellPulseUntil - elapsed;
          if (rem <= 0) {
            WORLD_STATE.bellPulseMesh.visible = false;
            if (WORLD_STATE.bellGroundPulseMesh) WORLD_STATE.bellGroundPulseMesh.visible = false;
          } else {
            const uPulse = 1 - rem / 2.6;
            const ringScale = 0.5 + uPulse * 21.5; // expands out to 22.0m across Pendulum Square!
            const ringOpacity = (1 - uPulse) * 0.78;
            WORLD_STATE.bellPulseMesh.scale.setScalar(ringScale);
            WORLD_STATE.bellPulseMesh.material.opacity = ringOpacity;
            if (WORLD_STATE.bellGroundPulseMesh) {
              WORLD_STATE.bellGroundPulseMesh.scale.setScalar(ringScale);
              WORLD_STATE.bellGroundPulseMesh.material.opacity = ringOpacity * 0.85;
            }
          }
        }
        if (WORLD_STATE.creatures && dt > 0) {
          WORLD_STATE.creatures.update(safeDt, elapsed);
        }

        // 1. Advance the Rideable Looping Streetcar Tram (1.85x surge for 8s on Conductor Bell Pull!)
        const tr = WORLD_STATE.tram;
        tr.prevX = tr.x;
        tr.prevZ = tr.z;
        tr.prevYaw = tr.yaw;
        const tramSurgeActive = nowSec < WORLD_STATE.tramSurgeUntil;
        const tramSpeedMul = tramSurgeActive ? 1.85 : 1.0;
        tr.angle = ((tr.angle + safeDt * TRAM_OMEGA * tramSpeedMul * WORLD_STATE.conveyorDirSign) % TAU + TAU) % TAU;
        tr.x = TRAM_CX + Math.cos(tr.angle) * R_TRAM;
        tr.z = TRAM_CZ + Math.sin(tr.angle) * R_TRAM;
        tr.yaw = -tr.angle;
        if (tr.mesh) {
          tr.mesh.position.set(tr.x, Y_T2, tr.z);
          tr.mesh.rotation.y = tr.yaw;
        }
        if (tramGears) tramGears.rotation.z = Math.sin(elapsed * (tramSurgeActive ? 11.5 : 5.2)) * 0.22;
        if (WORLD_STATE.tramBellMesh) {
          WORLD_STATE.tramBellSwingPhase += safeDt * 11.0;
          WORLD_STATE.tramBellSwingAmp *= Math.exp(-safeDt * 1.4);
          WORLD_STATE.tramBellMesh.rotation.z = Math.sin(WORLD_STATE.tramBellSwingPhase) * WORLD_STATE.tramBellSwingAmp;
        }

        // Keep Tram-Luggage Custom Spot & Conductor Bell synchronized with the moving streetcar!
        if (WORLD_STATE.tramLuggageSpot) {
          const wp = WORLD_STATE.tramLuggageSpot.getWorldPos();
          WORLD_STATE.tramLuggageSpot.x = wp.x;
          WORLD_STATE.tramLuggageSpot.y = wp.y;
          WORLD_STATE.tramLuggageSpot.z = wp.z;
          WORLD_STATE.tramLuggageSpot.groundY = wp.y;
          WORLD_STATE.tramLuggageSpot.rot = wp.rot;
        }
        if (WORLD_STATE.tramBellSpot) {
          const bp = WORLD_STATE.tramBellSpot.getWorldPos();
          WORLD_STATE.tramBellSpot.x = bp.x;
          WORLD_STATE.tramBellSpot.y = bp.y;
          WORLD_STATE.tramBellSpot.z = bp.z;
        }

        // 2. Spin all 4 Portal Door astrolabe dials + Wizard Parlor facade dial!
        const boostStep = Math.min(WORLD_STATE.wheelSpinBoost, safeDt * 7.5);
        WORLD_STATE.wheelSpinBoost = Math.max(0, WORLD_STATE.wheelSpinBoost - boostStep);
        wheelAngle += safeDt * 0.65 + boostStep;
        if (wizardPortalWheel) wizardPortalWheel.rotation.z = wheelAngle;
        for (const p of WORLD_STATE.portals) {
          if (p.wheel) p.wheel.rotation.z = wheelAngle + p.idx * (PI * 0.5);
        }

        // 3. Centerpiece Orrery Fountain planetary rings
        if (orreryRings) orreryRings.rotation.y = elapsed * 0.45;
        if (orreryRingA) {
          orreryRingA.rotation.x = 0.58 + Math.sin(elapsed * 0.7) * 0.25;
          orreryRingA.rotation.z = elapsed * 0.72;
        }
        if (orreryRingB) {
          orreryRingB.rotation.y = -elapsed * 0.95;
          orreryRingB.rotation.z = 0.55 + Math.cos(elapsed * 0.85) * 0.2;
        }

        // 4. Clockmaker Guildhall Roman clockHands & interlocking gears (spin briskly in Midnight Rush!)
        WORLD_STATE.clockHandAngle -= safeDt * (midnightActive ? 3.8 : 0.32);
        WORLD_STATE.clockGearAngle += safeDt * (midnightActive ? 2.4 : 0.68);
        if (clockHands) clockHands.rotation.z = WORLD_STATE.clockHandAngle;
        if (gearA) gearA.rotation.z = WORLD_STATE.clockGearAngle;
        if (gearB) gearB.rotation.z = -WORLD_STATE.clockGearAngle * (16 / 12) + 0.14;

        // 5. Swinging Brass Pendulums on Wall-Mounted Chalet Cuckoo Clocks!
        for (const cp of animatedPendulums) {
          cp.pivot.rotation.z = Math.sin(elapsed * 3.4 + cp.phase) * 0.32;
        }

        // 6. Clock-Tower Wagon gentle wind-up sway + rising whistle steam puffs on Tier 3 (`y = 4.35m`)
        if (turretBody) {
          turretBody.position.y = 2.55 + Math.sin(elapsed * 2.1) * 0.065;
          turretBody.rotation.z = Math.sin(elapsed * 1.4) * 0.025;
          turretBody.rotation.x = Math.cos(elapsed * 1.7) * 0.02;
        }
        for (let i = 0; i < STEAM_COUNT; i++) {
          const cycle = ((elapsed * 0.52 + i / STEAM_COUNT) % 1);
          const sy = Y_T3 + 5.15 + cycle * 3.8;
          const drift = cycle * cycle * 1.35;
          dummy.position.set(
            turX - 0.1 + drift * 0.65 + Math.sin(elapsed * 1.8 + i) * 0.12,
            sy,
            turZ - drift * 0.45 + Math.cos(elapsed * 1.5 + i) * 0.12
          );
          const sc = (0.45 + cycle * 1.45) * (1 - cycle * 0.55);
          dummy.scale.setScalar(Math.max(0.02, sc));
          dummy.rotation.set(elapsed * 0.4 + i, elapsed * 0.5, 0);
          dummy.updateMatrix();
          steamInst.setMatrixAt(i, dummy.matrix);
        }
        steamInst.instanceMatrix.needsUpdate = true;

        // 7. Swaying festive bunting flags
        for (let i = 0; i < flagData.length; i++) {
          const f = flagData[i];
          dummy.position.copy(f.pos);
          const sway = Math.sin(elapsed * 2.6 + f.phase) * 0.22 + Math.sin(elapsed * 4.3 + f.phase * 0.7) * 0.08;
          dummy.rotation.set(sway, f.yaw, sway * 0.35);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          flagInst.setMatrixAt(i, dummy.matrix);
        }
        flagInst.instanceMatrix.needsUpdate = true;

        // 8. Drifting golden autumn ginkgo leaves across all 3 tiers
        for (let i = 0; i < LEAF_COUNT; i++) {
          const lf = leafStates[i];
          let y = lf.y - ((elapsed * lf.vy) % 10.2);
          if (y < 0.95) y += 10.2;
          const wx = lf.x + Math.sin(elapsed * lf.sp + lf.ph) * 0.85;
          const wz = lf.z + Math.cos(elapsed * lf.sp * 0.8 + lf.ph) * 0.85;
          dummy.position.set(wx, y, wz);
          dummy.rotation.set(
            elapsed * 1.9 + lf.ph,
            elapsed * 1.4 + lf.ph * 0.5,
            Math.sin(elapsed * 2.2 + lf.ph) * 0.8
          );
          dummy.scale.set(1.15, 0.85, 1);
          dummy.updateMatrix();
          leafInst.setMatrixAt(i, dummy.matrix);
        }
        leafInst.instanceMatrix.needsUpdate = true;

        // 9. Canal water shader & swaying autumn grass
        brookWater.update(elapsed);
        autumnGrass.update(elapsed);
      },
    };
  },
};
