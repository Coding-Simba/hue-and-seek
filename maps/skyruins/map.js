/* Hue & Seek — Map 2: Celestia Sky-Ruins (`maps/skyruins/map.js`)
 * Handcrafted 5-Island Vertical Storybook Floating Sky-Sanctum of an original floating-ruins world
 * and built 1:1 from assets/maps/skyruins/{overview,buildings_sheet,interiors_sheet,props_sheet,characters_sheet,sky_panorama}.png.
 *
 * Unique Vertical Architecture & Bespoke Celestial Gravity/Shrine Mechanics:
 *   • 5 Separate Floating Sky Islands at Different Heights over Open Sky Chasms:
 *       1. Central Skyglass Fountain & Bazaar Hub Island (y = 2.00m)
 *       2. High North Crown: Ancient Tree-Crown Aether Observatory Island (y = 4.95m)
 *       3. Mid-High East Terrace: Botanical Sky-Orchid Conservatory Island (y = 3.55m)
 *       4. Lower South-East Harbour: Sky-Pirate Hangar & Ornithopter Sky-Pier Island (y = 0.95m)
 *       5. Stepped West Reliquary: Guardian Golem Ziggurat (y = 2.95m) & Wind-Chime Colonnade (y = 4.15m)
 *   • Giant Gnarled Tree-Root Bridges spanning the open cloud chasms between all 5 islands!
 *   • 5 Glowing Wind Updraft Geysers & 6 Orbiting Ancient Rune-Stone Platforms circling mid-air!
 *   • 5 Zelda TotK "Ascend" Vertical Ceiling-Phase Pillars: 1-way upward phase through rock arches &
 *     overhangs onto upper sanctuary decks (Seekers chasing below must climb the stone stairs around!).
 *   • 4 Mario Galaxy Spinning Golden Launch-Star Sling Rings + Shootable/Interactable Central Astrolabe
 *     Global Moon-Gravity Inversion (0.38x gravity, 1.30x leap, 1.12x speed for 14s)!
 *   • 2 Valorant "Bind" True 1-Way Chasm Teleporters (North Shrine -> Hub Overlook, SE Courtyard -> NW Sanctuary)
 *     firing loud map-wide crystal pings on arrival!
 *   • 3 Celestia Hiding Disguises: Cliff Sky-Roots, Orbiting Rune-Stones & Mobile Sanctum Stone Golems!
 */

import { Color, Vector3 } from 'three';
import * as SkyPropsMod from './props.js?v=v10';
import {
  createCreatureFleetController,
  createPortalNetwork,
  playWorldMechAudio,
} from '../world_interactives.js?v=v10';
import {
  makeRng,
  kitTex,
  mapTex,
  mergeStatic,
  RoundedBoxGeometry,
  createAnimatedWater,
  createSwayingBlades,
} from '../map_kit.js?v=2';
import { SEEKER_DEFS, HIDER_DEF, buildMapSeeker, buildMapHider } from './characters.js?v=2';
import { BUILDING_DEFS, buildBuildings } from './buildings.js?v=2';
import {
  TRAVERTINE_PAL,
  CLIFF_ROCK_PAL,
  MOSS_PAL,
  FOLIAGE_SUN_PAL,
  WISTERIA_PAL,
  WILDFLOWER_PAL,
  getSkyMats,
} from './sky_kit.js?v=2';

const { PROPS, PROP_ICONS, buildMapProps } = SkyPropsMod;

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ============================================================================
// 5 Separate Floating Sky-Island Elevations & Geometry Definitions
// ============================================================================
export const Y_VOID = -14.0;
export const Y_SE = 0.95;    // Island 4: Sky-Pirate Ornithopter Hangar & Wooden Sky-Pier
export const Y_HUB = 2.00;   // Island 1: Central Skyglass Fountain & Bazaar Hub
export const Y_SW = 2.95;    // Island 5A: Guardian Golem Ziggurat Terrace
export const Y_EAST = 3.55;  // Island 3: Botanical Sky-Orchid Conservatory Island
export const Y_NW = 4.15;    // Island 5B: Temple of the Four Winds Colonnade Terrace
export const Y_NORTH = 4.95; // Island 2: Ancient Tree-Crown Observatory Crown Island

const COL_GRASS = 0x7bc24d;
const COL_STONE = 0xeadcc2;
const COL_MOSAIC = 0x39a8c8;
const COL_ROOT = 0x8b623c;
const COL_PIER = 0xc68b4e;

// Elliptical Floating Islands (separated by real open sky chasms!)
const ISLANDS = [
  { id: 'hub',   cx: 0.0,   cz: 1.2,   rx: 11.4, rz: 12.2, y: Y_HUB,   bellyH: 5.4 },
  { id: 'north', cx: 0.0,   cz: -21.2, rx: 9.6,  rz: 7.5,  y: Y_NORTH, bellyH: 6.2 },
  { id: 'east',  cx: 19.6,  cz: -10.4, rx: 8.2,  rz: 7.6,  y: Y_EAST,  bellyH: 5.2 },
  { id: 'se',    cx: 18.8,  cz: 9.2,   rx: 8.8,  rz: 8.8,  y: Y_SE,    bellyH: 4.8 },
  { id: 'sw',    cx: -19.5, cz: 7.4,   rx: 8.3,  rz: 8.6,  y: Y_SW,    bellyH: 5.2 },
  { id: 'nw',    cx: -19.3, cz: -10.4, rx: 8.2,  rz: 8.5,  y: Y_NW,    bellyH: 5.6 },
];

// Wooden Ornithopter Sky-Pier jutting SE off Island 4 over the open sea of clouds!
const PIER_CFG = {
  cx: 15.2,
  cz: 20.0,
  rot: 0.44,
  halfW: 2.55,
  halfL: 4.55,
  y: Y_SE + 0.05,
};

// Giant Walkable Gnarled Tree-Root Bridges & Stepped Stone Connector linking the 5 Islands
const ROOT_BRIDGES = [
  // 1. Ceremonial Twin-Root Crown Bridge: Central Hub (2.00m) -> North Observatory Crown (4.95m)
  { id: 'br_north', x0: 0.0, z0: -10.2, y0: Y_HUB, x1: 0.0, z1: -14.4, y1: Y_NORTH, halfW: 2.05, arch: 0.36 },
  // 2. East Orchid Root Bridge: Central Hub (2.00m) -> East Conservatory Island (3.55m)
  { id: 'br_east', x0: 9.6, z0: -4.4, y0: Y_HUB, x1: 13.0, z1: -6.8, y1: Y_EAST, halfW: 1.75, arch: 0.34 },
  // 3. SE Pirate Root & Plank Bridge: Central Hub (2.00m) -> SE Hangar Island (0.95m)
  { id: 'br_se', x0: 9.4, z0: 6.4, y0: Y_HUB, x1: 12.2, z1: 7.8, y1: Y_SE, halfW: 1.75, arch: 0.28 },
  // 4. SW Golem Root Bridge: Central Hub (2.00m) -> SW Golem Ziggurat Island (2.95m)
  { id: 'br_sw', x0: -9.4, z0: 5.8, y0: Y_HUB, x1: -12.2, z1: 6.8, y1: Y_SW, halfW: 1.75, arch: 0.30 },
  // 5. NW Wind-Temple Root Bridge: Central Hub (2.00m) -> NW Wind-Chime Colonnade (4.15m)
  { id: 'br_nw', x0: -9.6, z0: -4.4, y0: Y_HUB, x1: -12.6, z1: -6.8, y1: Y_NW, halfW: 1.75, arch: 0.36 },
  // 6. West Reliquary Stepped Stone Bridge: SW Golem (2.95m) <-> NW Colonnade (4.15m)
  { id: 'br_west_step', x0: -18.2, z0: 0.4, y0: Y_SW, x1: -18.2, z1: -3.4, y1: Y_NW, halfW: 1.95, arch: 0.14 },
];

// Central Astrolabe Moon-Gravity Mechanism Anchor
const ASTROLABE_POS = { x: 0.0, y: Y_HUB - 0.14, z: -4.8 };

// 5 Zelda: Tears of the Kingdom "Ascend" Vertical Ceiling-Phase Arches + Seeker Stairs Around!
const ASCEND_ARCHES = [
  {
    id: 'ascend_hub_nw',
    label: 'Ascend → Hub NW Overlook',
    x: -7.2,
    z: -4.2,
    fromY: Y_HUB,
    toY: 5.00,
    deckHx: 2.1,
    deckHz: 1.9,
    pillars: [[-8.9, -4.2], [-5.5, -4.2]],
    stair: { x0: -5.0, y0: Y_HUB, z0: -8.8, x1: -6.8, y1: 5.00, z1: -6.1, halfW: 0.82 },
  },
  {
    id: 'ascend_hub_east',
    label: 'Ascend → Hub East Balcony',
    x: 7.2,
    z: -4.4,
    fromY: Y_HUB,
    toY: 5.00,
    deckHx: 1.7,
    deckHz: 1.7,
    pillars: [[5.7, -4.4], [8.7, -4.4]],
    stair: { x0: 5.2, y0: Y_HUB, z0: -8.8, x1: 6.8, y1: 5.00, z1: -6.1, halfW: 0.80 },
  },
  {
    id: 'ascend_north_sanctuary',
    label: 'Ascend → Observatory Cliff Deck',
    x: 6.2,
    z: -18.2,
    fromY: Y_NORTH,
    toY: 7.90,
    deckHx: 1.5,
    deckHz: 1.6,
    pillars: [[5.1, -19.5], [7.3, -19.5], [7.3, -16.9]],
    stair: { x0: 2.3, y0: Y_NORTH, z0: -15.4, x1: 4.7, y1: 7.90, z1: -17.4, halfW: 0.78 },
  },
  {
    id: 'ascend_east_conservatory',
    label: 'Ascend → Conservatory Overhang',
    x: 23.6,
    z: -5.8,
    fromY: Y_EAST,
    toY: 6.50,
    deckHx: 1.5,
    deckHz: 1.5,
    pillars: [[24.8, -7.0], [24.8, -4.6]],
    stair: { x0: 19.0, y0: Y_EAST, z0: -4.4, x1: 22.1, y1: 6.50, z1: -5.4, halfW: 0.78 },
  },
  {
    id: 'ascend_sw_ziggurat',
    label: 'Ascend → Ziggurat Cliff Balcony',
    x: -24.8,
    z: 4.0,
    fromY: Y_SW,
    toY: 5.90,
    deckHx: 1.5,
    deckHz: 1.5,
    pillars: [[-26.0, 2.8], [-26.0, 5.2]],
    stair: { x0: -20.4, y0: Y_SW, z0: 1.2, x1: -23.6, y1: 5.90, z1: 2.5, halfW: 0.78 },
  },
];

// 4 Mario Galaxy Spinning 5-Point Golden Launch-Star Sling Rings (Outer Islands <-> Hub Balconies!)
const LAUNCH_STAR_SPECS = [
  {
    id: 'ls_se_to_hub',
    label: 'Launch-Star → Hub East Balcony',
    fromX: 13.8,
    fromY: Y_SE,
    fromZ: 13.8,
    toX: 7.2,
    toY: 5.00,
    toZ: -4.4,
    arcY: 5.6,
    dur: 1.45,
    enterHint: '⭐ Launch-Star Sling! Soaring across the sky chasm onto Hub East Balcony!',
  },
  {
    id: 'ls_hub_to_east',
    label: 'Launch-Star → East Conservatory',
    fromX: 8.6,
    fromY: Y_HUB,
    fromZ: 4.4,
    toX: 15.4,
    toY: Y_EAST,
    toZ: -7.2,
    arcY: 4.8,
    dur: 1.35,
    enterHint: '⭐ Launch-Star Sling! Arcing high over the clouds to East Conservatory!',
  },
  {
    id: 'ls_nw_to_hub',
    label: 'Launch-Star → Hub NW Overlook',
    fromX: -24.4,
    fromY: Y_NW,
    fromZ: -12.6,
    toX: -7.2,
    toY: 5.00,
    toZ: -4.2,
    arcY: 5.2,
    dur: 1.40,
    enterHint: '⭐ Launch-Star Sling! Catapulting onto the Hub NW Overlook!',
  },
  {
    id: 'ls_hub_to_sw',
    label: 'Launch-Star → SW Ziggurat',
    fromX: -9.2,
    fromY: Y_HUB,
    fromZ: 4.2,
    toX: -14.6,
    toY: Y_SW,
    toZ: 11.2,
    arcY: 4.6,
    dur: 1.30,
    enterHint: '⭐ Launch-Star Sling! Launching cleanly across to SW Golem Ziggurat!',
  },
];

// 2 Valorant "Bind" True 1-Way Chasm Teleporters (North Shrine -> Hub Overlook, SE Courtyard -> NW Sanctuary)
const BIND_PORTALS = [
  {
    id: 'portal_north_shrine',
    x: -6.2,
    y: Y_NORTH,
    z: -16.4,
    targetId: 'portal_hub_overlook',
    triggerR: 1.45,
    label: 'North Shrine Rift',
    color: 0x3ef0ff,
    isExit: false,
  },
  {
    id: 'portal_hub_overlook',
    x: -7.8,
    y: 5.00,
    z: -3.5,
    targetId: 'portal_hub_overlook',
    triggerR: -1,
    label: 'Hub Overlook',
    color: 0x3ef0ff,
    isExit: true,
  },
  {
    id: 'portal_se_courtyard',
    x: 13.4,
    y: Y_SE,
    z: 10.2,
    targetId: 'portal_nw_sanctuary',
    triggerR: 1.45,
    label: 'SE Courtyard Rift',
    color: 0xffc658,
    isExit: false,
  },
  {
    id: 'portal_nw_sanctuary',
    x: -15.4,
    y: Y_NW,
    z: -4.6,
    targetId: 'portal_nw_sanctuary',
    triggerR: -1,
    label: 'NW Sanctuary',
    color: 0xffc658,
    isExit: true,
  },
];

// Live Runtime State for Orbiting Rune-Stone Platforms, Wind Updrafts, Ascend Shrines, Launch-Stars & Moon Gravity
const WORLD_STATE = {
  orbitElapsed: 0,
  orbitPlatforms: [], // { angle, speed, orbitR, cx, cz, baseY, ampY, phase, x, y, z, prevX, prevZ, radius, mesh }
  orbitRubble: [],    // { angle, speed, orbitR, baseY, phase, x, y, z, rot }
  updrafts: [],       // { x, y, z, r, vy }
  ascendSpots: [],    // Zelda TotK 1-way ceiling-phase Ascend spots (`ride_path`)
  ascendVis: [],      // Animated glowing emerald-gold upward rune rings
  ascendTrack: new WeakMap(),
  launchStars: [],    // Mario Galaxy Launch-Star sling spots (`ride_path` / `sampleLauncherAt`)
  launchStarVis: [],  // Spinning 5-point star + sling ring meshes + burst state
  turret: null,
  creatures: null,    // fleet controller for Sky-Mantas & Sky-Ruin Gliders
  interactSpots: [],
  mechSpots: [],
  portals: null,
  portalCdSnap: new WeakMap(),
  portalVis: [],
  moonGravUntil: -1,
  moonRingMesh: null,
  moonAuraMesh: null,
  astroOrbMesh: null,
  notify: null,
  emitSoundCue: null,
  splash: null,
  spawnPuff: null,
  getActors: null,
  audio: null,
};

function playAscendPhaseAudio(audio) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    const freqs = [392.0, 523.25, 659.25, 987.77];
    freqs.forEach((f, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = idx % 2 === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(f, now + idx * 0.04);
      o.frequency.exponentialRampToValueAtTime(f * 1.45, now + idx * 0.04 + 0.28);
      g.gain.setValueAtTime(0.001, now + idx * 0.04);
      g.gain.linearRampToValueAtTime(0.11, now + idx * 0.04 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.34);
      o.connect(g);
      g.connect(dest);
      o.start(now + idx * 0.04);
      o.stop(now + idx * 0.04 + 0.36);
    });
  } catch { /* AudioContext guard */ }
}

function playLaunchStarAudio(audio) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    [523.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + idx * 0.035);
      o.frequency.exponentialRampToValueAtTime(f * 1.32, now + idx * 0.035 + 0.24);
      g.gain.setValueAtTime(0.001, now + idx * 0.035);
      g.gain.linearRampToValueAtTime(0.13, now + idx * 0.035 + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.28);
      o.connect(g);
      g.connect(dest);
      o.start(now + idx * 0.035);
      o.stop(now + idx * 0.035 + 0.30);
    });
  } catch { /* AudioContext guard */ }
}

function playBindPortalChord(audio) {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    [293.66, 440.0, 587.33, 880.0, 1174.66].forEach((f, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = idx < 2 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(f, now);
      o.frequency.exponentialRampToValueAtTime(f * 0.985, now + 0.72);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11 / (1 + idx * 0.25), now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      o.connect(g);
      g.connect(dest);
      o.start(now);
      o.stop(now + 0.80);
    });
  } catch { /* AudioContext guard */ }
}

// ============================================================================
// Pure Analytic Multi-Island + Root-Bridge + Ascend-Deck Height Sampler
// ============================================================================
function evalRootBridgeY(b, x, z) {
  const vx = b.x1 - b.x0, vz = b.z1 - b.z0;
  const len2 = vx * vx + vz * vz;
  if (len2 < 1e-4) return null;
  const len = Math.sqrt(len2);
  const ux = vx / len, uz = vz / len;
  const dx = x - b.x0, dz = z - b.z0;
  const along = dx * ux + dz * uz;
  if (along < -0.55 || along > len + 0.55) return null;
  const perp = Math.abs(-dx * uz + dz * ux);
  if (perp > b.halfW) return null;
  const t = clamp(along / len, 0, 1);
  const s = t * t * (3 - 2 * t);
  return b.y0 + (b.y1 - b.y0) * s + Math.sin(t * PI) * b.arch;
}

function evalAscendStairY(st, x, z) {
  const vx = st.x1 - st.x0, vz = st.z1 - st.z0;
  const len2 = vx * vx + vz * vz;
  if (len2 < 1e-4) return null;
  const len = Math.sqrt(len2);
  const ux = vx / len, uz = vz / len;
  const dx = x - st.x0, dz = z - st.z0;
  const along = dx * ux + dz * uz;
  if (along < -0.35 || along > len + 0.45) return null;
  const perp = Math.abs(-dx * uz + dz * ux);
  if (perp > st.halfW) return null;
  const t = clamp(along / len, 0, 1);
  return st.y0 + (st.y1 - st.y0) * t;
}

function isOnAscendDeck(a, x, z) {
  return Math.abs(x - a.x) <= a.deckHx && Math.abs(z - a.z) <= a.deckHz;
}

function isOnSkyPier(x, z) {
  const dx = x - PIER_CFG.cx, dz = z - PIER_CFG.cz;
  const c = Math.cos(PIER_CFG.rot), s = Math.sin(PIER_CFG.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= PIER_CFG.halfW && lz >= -5.35 && lz <= PIER_CFG.halfL;
}

function evalIslandY(x, z) {
  let bestY = null;
  for (const isl of ISLANDS) {
    const nx = (x - isl.cx) / isl.rx;
    const nz = (z - isl.cz) / isl.rz;
    const d2 = nx * nx + nz * nz;
    // Slight organic 5-lobed Celestian cliff contour
    const ang = Math.atan2(z - isl.cz, x - isl.cx);
    const rimWave = 1.0 + 0.045 * Math.sin(ang * 5 + isl.y) + 0.03 * Math.cos(ang * 3);
    if (d2 <= rimWave * rimWave) {
      let y = isl.y;
      // Gentle sunken mosaic pool depression on Central Hub around (0, -2.0)
      if (isl.id === 'hub') {
        const dp = Math.hypot(x, z + 2.0);
        if (dp < 5.6) y = isl.y - 0.14;
      }
      if (bestY === null || y > bestY) bestY = y;
    }
  }
  return bestY;
}

export function sampleSkyRuinsHeight(x, z, refY) {
  const candidates = [];

  // 1. Orbiting Ancient Rune-Stone Platforms (separate aerial tier above islands/chasms!)
  for (const pl of WORLD_STATE.orbitPlatforms) {
    if (Math.hypot(x - pl.x, z - pl.z) <= pl.radius) {
      candidates.push(pl.y);
    }
  }

  // 1B. Ascend Upper Sanctuary Decks (walkable roofs directly above ground archways!)
  for (const a of ASCEND_ARCHES) {
    if (isOnAscendDeck(a, x, z)) {
      candidates.push(a.toY);
    }
  }

  // 2. Unified Static Terrain Surface (Root Bridges + Ascend Seeker Stairs + SE Sky-Pier + 5 Floating Sky Islands)
  let staticMax = -Infinity;
  for (const b of ROOT_BRIDGES) {
    const by = evalRootBridgeY(b, x, z);
    if (by !== null && by > staticMax) staticMax = by;
  }
  for (const a of ASCEND_ARCHES) {
    const sy = evalAscendStairY(a.stair, x, z);
    if (sy !== null && sy > staticMax) staticMax = sy;
  }
  if (isOnSkyPier(x, z) && PIER_CFG.y > staticMax) {
    staticMax = PIER_CFG.y;
  }
  const iy = evalIslandY(x, z);
  if (iy !== null && iy > staticMax) {
    staticMax = iy;
  }
  if (Number.isFinite(staticMax)) {
    candidates.push(staticMax);
  }

  if (candidates.length === 0) return Y_VOID;
  if (typeof refY === 'number' && Number.isFinite(refY)) {
    let best = candidates[0];
    let bestDiff = Math.abs(best - refY);
    for (let i = 1; i < candidates.length; i++) {
      const diff = Math.abs(candidates[i] - refY);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidates[i];
      }
    }
    return best;
  }
  return Math.max(...candidates);
}

function whichBridge(x, z) {
  for (const b of ROOT_BRIDGES) {
    if (evalRootBridgeY(b, x, z) !== null) return b;
  }
  return null;
}

function whichIslandRegion(x, z) {
  if (whichBridge(x, z)) return 'bridge';
  if (isOnSkyPier(x, z)) return 'se';
  for (const isl of ISLANDS) {
    const nx = (x - isl.cx) / (isl.rx * 1.06);
    const nz = (z - isl.cz) / (isl.rz * 1.06);
    if (nx * nx + nz * nz <= 1.0) return isl.id;
  }
  return 'void';
}

function findNearestIslandRim(x, z) {
  let best = { x: 0, y: Y_HUB, z: 6.5, d: Infinity };
  for (const isl of ISLANDS) {
    const vx = x - isl.cx, vz = z - isl.cz;
    const ang = Math.atan2(vz, vx);
    const rx = isl.cx + Math.cos(ang) * (isl.rx * 0.72);
    const rz = isl.cz + Math.sin(ang) * (isl.rz * 0.72);
    const d = Math.hypot(x - rx, z - rz);
    if (d < best.d) best = { x: rx, y: isl.y, z: rz, d };
  }
  return best;
}

// Fallback custom disguise builders in case props.js is hot-reloading
function fallbackCustomDisguise(THREE, kind) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xdfd2b8, roughness: 0.86, metalness: 0 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x7ab84a, roughness: 0.84, metalness: 0 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x3ae6ff, emissive: 0x0cb4ec, emissiveIntensity: 0.9, roughness: 0.22, metalness: 0 });
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), kind === 'root' ? mossMat : stoneMat);
  body.position.y = 0.42;
  g.add(body);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), cyanMat);
  gem.position.set(0, 0.46, 0.34);
  g.add(gem);
  return g;
}

// ============================================================================
// MAP_DEF Export
// ============================================================================
export const MAP_DEF = {
  id: 'skyruins',
  title: 'Celestia Sky-Ruins',
  subtitle: '5 floating Celestia sky-islands, giant root bridges, wind updrafts & orbiting rune-stones',
  badge: 'Floating Isles',
  preview: 'assets/maps/skyruins/overview.webp',
  skyPanorama: 'assets/maps/skyruins/sky_panorama.webp',
  skyCylY: 36,
  skyRepeat: 3,
  mapRadius: 33,

  // Hero overview.png framing: high sunlit angle looking N across the 5 floating islands, Crystal Fountain & Great Tree Observatory!
  camMenu: { r: 35.4, y: 21.8, lookX: 0, lookY: 2.35, lookZ: -1.4, baseAngle: 0, sway: 0.14 },
  playerSpawn: [0.0, 6.2],
  seekerSpawns: [[-3.8, 3.6], [3.8, 3.6]],
  seekSpawn: [0.0, 6.8],
  hideIntroHint: '5 Floating Sky-Islands! Step into Launch-Stars ⭐ & Wind Updrafts 🌪️, Ascend 🟢 through arches, or invert Moon Gravity at the Astrolabe 🌙!',

  sky: {
    top: 0x2584e4,
    mid: 0x7fd0fa,
    bot: 0xfff0cc,
    sunDisc: 0xfff8dc,
    sunDir: [-0.42, 0.58, -0.70],
  },
  fog: { color: 0xbbe6fc, near: 68, far: 215 },
  lights: {
    hemiSky: 0xaad8ff,
    hemiGround: 0x6c9250,
    hemiInt: 1.06,
    sunColor: 0xffd996,
    sunInt: 2.18,
    sunPos: [-22, 38, 22],
    exposure: 0.95,
  },

  props: PROPS,
  propIcons: PROP_ICONS,
  buildings: BUILDING_DEFS,
  seekerKinds: SEEKER_DEFS.map((s) => s.id),
  seekerLabels: Object.fromEntries(SEEKER_DEFS.map((s) => [s.id, s.label])),
  hiderSkin: HIDER_DEF,

  buildProps: buildMapProps,
  buildBuildings,
  buildSeeker: buildMapSeeker,
  buildHider: buildMapHider,

  groundHeightAt(x, z, refY) {
    return sampleSkyRuinsHeight(x, z, refY);
  },

  // Open sky chasms are crossable by jumping/gliding for the player, while AI uses root bridges!
  isDeepWater() {
    return false;
  },

  isSkyGap(x, z) {
    return sampleSkyRuinsHeight(x, z) < -5.0;
  },

  groundColorAt(x, z, outColor) {
    const out = outColor || new Color();
    if (isOnSkyPier(x, z)) return out.setHex(COL_PIER);
    for (const a of ASCEND_ARCHES) {
      if (isOnAscendDeck(a, x, z) || evalAscendStairY(a.stair, x, z) !== null) {
        return out.setHex(COL_STONE);
      }
    }
    for (const b of ROOT_BRIDGES) {
      if (evalRootBridgeY(b, x, z) !== null) return out.setHex((b.id === 'br_west_step' || b.id === 'br_west') ? COL_STONE : COL_ROOT);
    }
    if (Math.hypot(x, z + 2.0) < 6.2) return out.setHex(COL_MOSAIC);
    if (Math.hypot(x, z - 1.2) < 9.2) return out.setHex(COL_STONE);
    return out.setHex(COL_GRASS);
  },

  surfaceAt(x, z) {
    if (isOnSkyPier(x, z)) return 'wood';
    for (const a of ASCEND_ARCHES) {
      if (isOnAscendDeck(a, x, z) || evalAscendStairY(a.stair, x, z) !== null) return 'stone';
    }
    for (const b of ROOT_BRIDGES) if (evalRootBridgeY(b, x, z) !== null) return 'wood';
    if (Math.hypot(x, z - 1.2) < 9.2) return 'stone';
    return 'grass';
  },

  // Multi-island AI router: guides seekers & fleeing hiders cleanly across the 6 Root Bridges & island aprons!
  routeTierWaypoint(from, goal) {
    const rFrom = whichIslandRegion(from.x, from.z);
    const rGoal = whichIslandRegion(goal.x, goal.z);
    if (rGoal === 'void') return null;

    const bridgeEntry = {
      north: { hubSide: { x: 0.0, y: Y_HUB, z: -9.4 }, islSide: { x: 0.0, y: Y_NORTH, z: -15.0 } },
      east:  { hubSide: { x: 8.8, y: Y_HUB, z: -4.0 }, islSide: { x: 13.8, y: Y_EAST, z: -7.2 } },
      se:    { hubSide: { x: 8.6, y: Y_HUB, z: 6.0 },  islSide: { x: 13.0, y: Y_SE, z: 8.2 } },
      sw:    { hubSide: { x: -8.6, y: Y_HUB, z: 5.4 }, islSide: { x: -13.0, y: Y_SW, z: 7.0 } },
      nw:    { hubSide: { x: -8.8, y: Y_HUB, z: -4.0 }, islSide: { x: -13.4, y: Y_NW, z: -7.2 } },
    };

    // Same-island porch/building-corner guidance (strictly monotonic so it never oscillates!)
    if (rFrom === rGoal) {
      if (rFrom === 'north') {
        if (from.z > -17.6 && Math.abs(from.x) < 4.8 && goal.z < -17.1 && Math.abs(goal.x) > 5.2) {
          const wx = goal.x < 0 ? -6.2 : 6.2;
          if (Math.abs(from.x - wx) > 0.9) return { x: wx, y: Y_NORTH, z: -16.1 };
        }
      } else if (rFrom === 'se') {
        if (goal.z > 14.2 && from.z < 11.6) {
          return { x: 12.2, y: Y_SE, z: 12.2 };
        }
        if (from.z > 12.8 && goal.z < 10.2 && goal.x > 13.5) {
          return { x: 12.2, y: Y_SE, z: 12.2 };
        }
      } else if (rFrom === 'sw') {
        if (goal.z < 1.6 && goal.x < -17.0 && from.x > -15.9) {
          return { x: -16.1, y: Y_SW, z: 1.0 };
        }
        if (from.z < 1.6 && from.x < -16.5 && goal.z > 4.5 && goal.x > -15.8) {
          return { x: -16.1, y: Y_SW, z: 1.0 };
        }
      } else if (rFrom === 'nw') {
        if (from.x < -16.0 && goal.z < -6.5 && goal.x > -15.8) {
          return { x: -15.8, y: Y_NW, z: -4.4 };
        }
        if (goal.x < -17.2 && goal.z > -4.6 && from.x > -15.6 && from.z < -6.2) {
          return { x: -15.8, y: Y_NW, z: -4.4 };
        }
      }
      return null;
    }

    // Goal itself lies on a Root Bridge -> route onto that bridge cleanly!
    if (rGoal === 'bridge' && rFrom !== 'bridge') {
      const gb = whichBridge(goal.x, goal.z);
      if (!gb) return null;
      if (gb.id === 'br_west_step' || gb.id === 'br_west') {
        if (rFrom === 'sw') {
          if (from.x > -15.9) return { x: -16.1, y: Y_SW, z: 1.0 };
          return null;
        }
        if (rFrom === 'nw') return null;
      } else {
        const key = gb.id.replace('br_', '');
        if (rFrom === key || rFrom === 'hub') return null;
      }
    }

    // Currently traversing a Root Bridge -> walk smoothly off the target end of this bridge!
    if (rFrom === 'bridge') {
      if (rGoal === 'bridge') return null;
      const b = whichBridge(from.x, from.z);
      if (!b) return null;
      if (b.id === 'br_west_step' || b.id === 'br_west') {
        const wp = rGoal === 'nw' ? { x: -18.2, y: Y_NW, z: -3.8 } : { x: -18.2, y: Y_SW, z: 0.8 };
        return Math.hypot(from.x - wp.x, from.z - wp.z) > 0.85 ? wp : null;
      }
      const key = b.id.replace('br_', '');
      const be = bridgeEntry[key];
      if (!be) return null;
      const wp = rGoal === key ? be.islSide : be.hubSide;
      return Math.hypot(from.x - wp.x, from.z - wp.z) > 0.85 ? wp : null;
    }

    // Direct SW <-> NW western stone bridge shortcut!
    if ((rFrom === 'sw' && rGoal === 'nw') || (rFrom === 'nw' && rGoal === 'sw')) {
      if (rFrom === 'sw') {
        if (from.x > -15.9) return { x: -16.1, y: Y_SW, z: 1.0 };
        return { x: -18.2, y: Y_NW, z: -3.8 };
      }
      return { x: -18.2, y: Y_SW, z: 0.8 };
    }

    // Leaving outer island -> head across its root bridge to Central Hub first!
    if (rFrom !== 'hub' && bridgeEntry[rFrom]) {
      const be = bridgeEntry[rFrom];
      if (Math.hypot(from.x - be.islSide.x, from.z - be.islSide.z) > 2.2) return be.islSide;
      return be.hubSide;
    }

    // On Central Hub -> head to target outer island's root bridge!
    if (rFrom === 'hub' && bridgeEntry[rGoal]) {
      const be = bridgeEntry[rGoal];
      if (Math.hypot(from.x - be.hubSide.x, from.z - be.hubSide.z) > 2.2) return be.hubSide;
      return be.islSide;
    }

    return null;
  },

  wildFlyerHint: '🐋 That was a wild Celestia Sky-Manta! Keep scanning mossy ruins, roots & floating stones!',

  // Wind Updraft Geysers & Mario Galaxy Launch-Star Sling Rings: launch across open sky gaps!
  sampleLauncherAt(ch) {
    const px = ch.position.x, pz = ch.position.z;
    const footY = (ch.userData.groundY || 0) + (ch.userData.jy || 0);
    for (const up of WORLD_STATE.updrafts) {
      if (Math.hypot(px - up.x, pz - up.z) <= up.r && footY >= up.y - 0.8 && footY <= up.y + 1.35) {
        return {
          vy: up.vy,
          glide: true,
          hintMsg: '🌪️ Wind Updraft! Soar & steer with WASD across the sky-islands!',
        };
      }
    }
    if (!ch.userData.ridePath && !(WORLD_STATE.orbitElapsed < (ch.userData._launchStarCdUntil || 0))) {
      for (let i = 0; i < WORLD_STATE.launchStars.length; i++) {
        const ls = WORLD_STATE.launchStars[i];
        if (Math.abs(footY - ls.fromY) <= 1.25 && Math.hypot(px - ls.fromX, pz - ls.fromZ) <= 1.25) {
          ch.userData._launchStarCdUntil = WORLD_STATE.orbitElapsed + 2.4;
          const vis = WORLD_STATE.launchStarVis[i];
          if (vis) vis.burst = 1.0;
          playLaunchStarAudio(WORLD_STATE.audio);
          if (WORLD_STATE.splash) {
            WORLD_STATE.splash(new Vector3(ls.fromX, ls.fromY + 0.9, ls.fromZ), 22, 2.8);
          }
          return {
            rideSpot: ls,
            hintMsg: ls.enterHint,
          };
        }
      }
    }
    return null;
  },

  // Cloud Updraft Safety Cushion if anyone slips into a sky chasm!
  checkSkyVoidRescue(ch) {
    const u = ch.userData;
    const footY = (u.groundY || 0) + (u.jy || 0);
    if ((u.groundY || 0) < -5.0 && footY < -2.2) {
      const rim = findNearestIslandRim(ch.position.x, ch.position.z);
      // Nudge gently toward nearest island rim and launch on a cloud updraft!
      ch.position.x += (rim.x - ch.position.x) * 0.42;
      ch.position.z += (rim.z - ch.position.z) * 0.42;
      const ng = sampleSkyRuinsHeight(ch.position.x, ch.position.z, rim.y + 1.5);
      u.groundY = ng;
      u.jy = Math.max(0.6, (rim.y + 2.2) - ng);
      u.vy = 11.8;
      u.gliding = true;
      return '☁️ A buoyant Celestia cloud-updraft caught you! Glide back onto the island!';
    }
    return null;
  },

  // Carry players/seekers/hiders standing on Orbiting Ancient Rune-Stone Platforms!
  applyPlatformMotion(ch) {
    const px = ch.position.x, pz = ch.position.z;
    const py = ch.userData.groundY ?? 0;
    for (const pl of WORLD_STATE.orbitPlatforms) {
      const onCur = Math.hypot(px - pl.x, pz - pl.z) <= pl.radius + 0.18;
      const onPrev = Math.hypot(px - pl.prevX, pz - pl.prevZ) <= pl.radius + 0.18;
      if ((onCur || onPrev) && Math.abs(py - pl.y) < 0.52) {
        ch.position.x += (pl.x - pl.prevX);
        ch.position.z += (pl.z - pl.prevZ);
        return;
      }
    }
  },

  getInteractHint(mode) {
    if (mode === 'seek') {
      return '⭐ Ride Launch-Stars, shoot or trigger the Moon-Gravity Astrolabe 🌙, and listen for 1-Way Rift pings 🔔!';
    }
    return '🟢 Ascend [G] through arches, Launch-Star ⭐ across islands, invert Moon Gravity 🌙, or roam as a Golem 🤖!';
  },

  breaksLineOfSight() {
    return false;
  },

  onShotWorldImpact(info) {
    if (!info) return null;
    const hitAstro = Boolean(info.hitObject?.userData?._skyAstrolabe) || Boolean(
      info.point &&
      Math.hypot(info.point.x - ASTROLABE_POS.x, info.point.z - ASTROLABE_POS.z) <= 1.28 &&
      Math.abs((info.point.y ?? ASTROLABE_POS.y) - (ASTROLABE_POS.y + 1.25)) <= 1.75
    );
    if (!hitAstro) return null;

    const nowSec = performance.now() * 0.001;
    const ms = WORLD_STATE.mechSpots.find((m) => m.id === 'mech_astrolabe_moon');
    if (ms && ms.cdUntil && nowSec < ms.cdUntil) {
      return { consumed: true };
    }
    WORLD_STATE.moonGravUntil = nowSec + 14.0;
    if (ms) ms.cdUntil = nowSec + 22.0;
    playWorldMechAudio(WORLD_STATE.audio, 'warp');
    if (WORLD_STATE.splash) {
      WORLD_STATE.splash(new Vector3(ASTROLABE_POS.x, ASTROLABE_POS.y + 1.35, ASTROLABE_POS.z), 28, 3.0);
    }
    if (WORLD_STATE.emitSoundCue) {
      WORLD_STATE.emitSoundCue({ x: ASTROLABE_POS.x, y: ASTROLABE_POS.y + 0.8, z: ASTROLABE_POS.z }, 18.0, 'chime', null);
    }
    if (WORLD_STATE.notify) {
      WORLD_STATE.notify('🌙 Astrolabe Struck! Moon Gravity across Celestia Sky-Ruins for 14s!', 2400);
    }
    return { consumed: true };
  },

  getSurfaceModifier(_ch, _G) {
    const nowSec = performance.now() * 0.001;
    if (nowSec < WORLD_STATE.moonGravUntil) {
      return {
        gravMul: 0.38,
        jumpMul: 1.30,
        speedMul: 1.12,
      };
    }
    return null;
  },

  onResetRound() {
    WORLD_STATE.moonGravUntil = -1;
    if (WORLD_STATE.portals) WORLD_STATE.portals.resetAll();
    WORLD_STATE.portalCdSnap = new WeakMap();
    WORLD_STATE.ascendTrack = new WeakMap();
    const actors = WORLD_STATE.getActors ? WORLD_STATE.getActors() : [];
    for (const ch of actors) {
      if (ch && ch.userData) {
        ch.userData._portalCdUntil = 0;
        ch.userData._launchStarCdUntil = 0;
      }
    }
    for (const sp of WORLD_STATE.mechSpots) sp.cdUntil = 0;
    for (const vis of WORLD_STATE.launchStarVis) vis.burst = 0;
  },

  triggerMechanism(_actor, inter) {
    if (!inter) return null;
    const nowSec = performance.now() * 0.001;
    if (inter.cdUntil && nowSec < inter.cdUntil) {
      return `⏳ Astrolabe recharging (${Math.ceil(inter.cdUntil - nowSec)}s)!`;
    }
    const ms = WORLD_STATE.mechSpots.find((m) => m.id === inter.id);
    if (inter.id === 'mech_astrolabe_moon') {
      WORLD_STATE.moonGravUntil = Math.max(WORLD_STATE.moonGravUntil, nowSec + 14.0);
      if (ms) ms.cdUntil = nowSec + 22.0;
      playWorldMechAudio(WORLD_STATE.audio, 'warp');
      if (WORLD_STATE.splash) {
        WORLD_STATE.splash(new Vector3(ASTROLABE_POS.x, ASTROLABE_POS.y + 1.35, ASTROLABE_POS.z), 28, 3.0);
      }
      if (WORLD_STATE.emitSoundCue) {
        WORLD_STATE.emitSoundCue({ x: inter.x, y: inter.y + 0.8, z: inter.z }, 18.0, 'chime', null);
      }
      return '🌙 Astrolabe Inverted! Moon Gravity (0.38x G, 1.30x Leap) for 14s!';
    }
    return null;
  },

  getTurret() {
    return null;
  },

  // Context-sensitive KeyG / #btnInteract for Astrolabe, Launch-Stars, Ascend Pillars, Root-Cling, Orbiting Rune-Stone & Mobile Sanctum Golem!
  getNearbyInteraction(player, G) {
    if (!player) return null;
    const u = player.userData;
    if (u.specialMode === 'custom_spot' && u.specialSpot) {
      return {
        kind: 'custom_spot',
        icon: u.specialSpot.icon || '✨',
        label: u.specialSpot.leaveLabel || 'Leave Hiding Spot',
      };
    }

    const px = player.position.x, pz = player.position.z;
    const py = (u.groundY || 0) + (u.jy || 0);

    // 1. Central Moon-Gravity Astrolabe Mechanism (Hide & Seek!)
    const nowSec = performance.now() * 0.001;
    for (const ms of WORLD_STATE.mechSpots) {
      if (Math.abs(py - ms.y) <= 1.45 && Math.hypot(px - ms.x, pz - ms.z) <= (ms.trigR || 2.45)) {
        const rem = Math.ceil((ms.cdUntil || 0) - nowSec);
        return {
          ...ms,
          label: rem > 0 ? `${ms.baseLabel} (${rem}s)` : ms.baseLabel,
        };
      }
    }

    // 2. Mario Galaxy Launch-Star Sling Rings (also auto-launch via sampleLauncherAt!)
    if (!u.ridePath && !u.rideRail) {
      let bestLs = null, bestLsD = 2.25;
      for (const ls of WORLD_STATE.launchStars) {
        if (Math.abs(py - ls.fromY) > 1.45) continue;
        const d = Math.hypot(px - ls.fromX, pz - ls.fromZ);
        if (d < bestLsD) {
          bestLsD = d;
          bestLs = ls;
        }
      }
      if (bestLs) return bestLs;
    }

    // Hider-exclusive vertical escapes & disguises (Seekers chasing below must take stairs around!)
    if (G && G.mode !== 'hide') return null;

    // 3. Zelda TotK "Ascend" Vertical Ceiling-Phase Pillars (1-way upward phase through ceiling!)
    if (!u.ridePath && !u.rideRail) {
      let bestAsc = null, bestAscD = 2.15;
      for (const asc of WORLD_STATE.ascendSpots) {
        if (Math.abs(py - asc.fromY) > 1.25) continue;
        const d = Math.hypot(px - asc.fromX, pz - asc.fromZ);
        if (d < bestAscD) {
          bestAscD = d;
          bestAsc = asc;
        }
      }
      if (bestAsc) return bestAsc;
    }

    // 4. Root-Cling, Orbiting Rune-Stones & Mobile Sanctum Golem Shells (Hiders)
    let best = null, bestD = 2.65;
    for (const sp of WORLD_STATE.interactSpots) {
      if (sp.kind === 'turret' || sp.kind === 'ride_path') continue;
      if (sp.occupiedBy && sp.occupiedBy !== player && !sp.occupiedBy.userData?.actor?.eliminated) continue;
      const refY = sp.triggerY ?? sp.groundY ?? Y_HUB;
      if (Math.abs(py - refY) > 1.65) continue;
      const tx = sp.triggerX ?? sp.x;
      const tz = sp.triggerZ ?? sp.z;
      const d = Math.hypot(px - tx, pz - tz);
      if (d < bestD) {
        bestD = d;
        best = sp;
      }
    }
    return best;
  },

  getInteractSpots() {
    return [
      ...(WORLD_STATE.interactSpots || []),
      ...(WORLD_STATE.ascendSpots || []),
      ...(WORLD_STATE.launchStars || []),
      ...(WORLD_STATE.mechSpots || []),
    ];
  },

  getUpdrafts() {
    return WORLD_STATE.updrafts || [];
  },

  buildCustomSpotDisguise(THREE, spot) {
    if (spot.spotType === 'root_cling') {
      return SkyPropsMod.buildRootClingPod ? SkyPropsMod.buildRootClingPod(THREE) : fallbackCustomDisguise(THREE, 'root');
    }
    if (spot.spotType === 'orbit_rune') {
      return SkyPropsMod.buildHoveringRuneStone ? SkyPropsMod.buildHoveringRuneStone(THREE) : fallbackCustomDisguise(THREE, 'rune');
    }
    return SkyPropsMod.buildDormantGolemCore ? SkyPropsMod.buildDormantGolemCore(THREE) : fallbackCustomDisguise(THREE, 'golem');
  },

  // ==========================================================================
  // buildWorld(ctx) — Assembles all 5 Floating Sky-Islands, Bridges & Mechanics!
  // ==========================================================================
  buildWorld(ctx) {
    const { THREE, root } = ctx;
    const { rr, jr, pick } = makeRng(7072);
    const B = buildBuildings(THREE);

    WORLD_STATE.orbitElapsed = 0;
    WORLD_STATE.orbitPlatforms = [];
    WORLD_STATE.orbitRubble = [];
    WORLD_STATE.updrafts = [];
    WORLD_STATE.ascendSpots = [];
    WORLD_STATE.ascendVis = [];
    WORLD_STATE.ascendTrack = new WeakMap();
    WORLD_STATE.launchStars = [];
    WORLD_STATE.launchStarVis = [];
    WORLD_STATE.turret = null;
    if (WORLD_STATE.creatures) {
      WORLD_STATE.creatures.dispose();
      WORLD_STATE.creatures = null;
    }
    WORLD_STATE.interactSpots = [];
    WORLD_STATE.mechSpots = [];
    WORLD_STATE.portalCdSnap = new WeakMap();
    WORLD_STATE.portalVis = [];
    WORLD_STATE.moonGravUntil = -1;
    WORLD_STATE.moonRingMesh = null;
    WORLD_STATE.moonAuraMesh = null;
    WORLD_STATE.astroOrbMesh = null;
    WORLD_STATE.notify = ctx.notify || ctx.pushFeed || null;
    WORLD_STATE.emitSoundCue = ctx.emitSoundCue || null;
    WORLD_STATE.splash = ctx.splash || null;
    WORLD_STATE.spawnPuff = ctx.spawnPuff || null;
    WORLD_STATE.getActors = ctx.getActors || null;
    WORLD_STATE.audio = ctx.audio || null;

    WORLD_STATE.portals = createPortalNetwork(THREE, {
      parent: root,
      splash: ctx.splash,
      puff: ctx.spawnPuff,
      emitSoundCue: ctx.emitSoundCue,
      audio: ctx.audio,
      notify: WORLD_STATE.notify,
      getActors: ctx.getActors,
    });

    const addSpotSafe = (x, z, hex, kind = 'stone', yOverride) => {
      const y = typeof yOverride === 'number' ? yOverride : sampleSkyRuinsHeight(x, z);
      if (ctx.spot) ctx.spot(x, z, hex, kind, y);
    };

    // Shared Celestian World Materials (100% metalness: 0!)
    const dummyKit = {
      M: (col, map, extra = {}) => new THREE.MeshStandardMaterial({ color: col, map: map || null, ...extra }),
      glowMat: (col, em, ei, extra = {}) => new THREE.MeshStandardMaterial({
        color: col, emissive: new THREE.Color(em), emissiveIntensity: ei, roughness: 0.26, metalness: 0, ...extra,
      }),
      tex: (name, rx = 1, ry = 1) => kitTex(THREE, name, rx, ry),
    };
    const sm = getSkyMats(THREE, dummyKit);

    const grassTopMat = new THREE.MeshStandardMaterial({
      color: 0xf6ffe6,
      map: mapTex(THREE, 'skyruins', 'ground', 3.5, 3.5),
      roughness: 0.88,
      metalness: 0,
    });
    const plazaUnderMat = new THREE.MeshStandardMaterial({
      color: 0xfff8ea,
      map: mapTex(THREE, 'skyruins', 'plaza', 3.6, 3.6),
      roughness: 0.86,
      metalness: 0,
    });
    const stoneInstMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: kitTex(THREE, 'plaster', 0.55, 0.55),
      roughness: 0.87,
      metalness: 0,
    });
    const foliageInstMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: kitTex(THREE, 'plaster', 0.45, 0.45),
      roughness: 0.80,
      metalness: 0,
    });

    // ========================================================================
    // 1. SCULPT ALL 5 FLOATING SKY ISLANDS (TAPERED CRAGGY CLIFFS + COBBLE PATHS!)
    // ========================================================================
    const cliffMatrices = [];
    const cliffColors = [];
    const cobbleMatrices = [];
    const cobbleColors = [];
    const floraMatrices = [];
    const floraColors = [];
    const oTmp = new THREE.Object3D();

    const pushCliff = (x, y, z, sx, sy, sz, hex) => {
      oTmp.position.set(x, y, z);
      oTmp.rotation.set(jr(-0.32, 0.32), jr(0, TAU), jr(-0.32, 0.32));
      oTmp.scale.set(sx, sy, sz);
      oTmp.updateMatrix();
      cliffMatrices.push(oTmp.matrix.clone());
      cliffColors.push(new THREE.Color(hex).offsetHSL(jr(-0.02, 0.02), jr(-0.04, 0.04), jr(-0.06, 0.06)));
    };
    const pushCobble = (x, y, z, rot, sx, sy, sz, hex) => {
      oTmp.position.set(x, y, z);
      oTmp.rotation.set(0, rot, 0);
      oTmp.scale.set(sx, sy, sz);
      oTmp.updateMatrix();
      cobbleMatrices.push(oTmp.matrix.clone());
      cobbleColors.push(new THREE.Color(hex).offsetHSL(jr(-0.015, 0.015), jr(-0.03, 0.03), jr(-0.04, 0.04)));
    };
    const pushFlora = (x, y, z, sx, sy, sz, hex) => {
      oTmp.position.set(x, y, z);
      oTmp.rotation.set(jr(-0.2, 0.2), jr(0, TAU), jr(-0.2, 0.2));
      oTmp.scale.set(sx, sy, sz);
      oTmp.updateMatrix();
      floraMatrices.push(oTmp.matrix.clone());
      floraColors.push(new THREE.Color(hex));
    };

    for (const isl of ISLANDS) {
      // Top sculpted clover-turf cap
      const capGeo = new THREE.CylinderGeometry(1, 0.96, 0.42, 36);
      capGeo.scale(isl.rx, 1, isl.rz);
      const capMesh = new THREE.Mesh(capGeo, grassTopMat);
      capMesh.position.set(isl.cx, isl.y - 0.21, isl.cz);
      capMesh.receiveShadow = true;
      capMesh.userData.ground = true;
      capMesh.userData.paint = new THREE.Color(COL_GRASS);
      root.add(capMesh);

      // Tapered floating Celestian rock belly cone underneath each island!
      const coreGeo = new THREE.CylinderGeometry(0.92, 0.16, isl.bellyH, 18);
      coreGeo.scale(isl.rx, 1, isl.rz);
      const coreMesh = new THREE.Mesh(coreGeo, sm.travertineDark);
      coreMesh.position.set(isl.cx, isl.y - 0.35 - isl.bellyH * 0.5, isl.cz);
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;
      root.add(coreMesh);

      // 4 Rings of 3D Craggy Cliff Boulders, Carved Ruin Blocks & Trailing Rim Moss/Wisteria!
      for (let ring = 0; ring < 4; ring++) {
        const f = 1.0 - ring * 0.21;
        const yRing = isl.y - (ring === 0 ? 0.62 : 0.42) - ring * (isl.bellyH * 0.21);
        const cnt = Math.max(12, Math.round((28 - ring * 5) * (isl.rx / 9.0)));
        for (let i = 0; i < cnt; i++) {
          const a = (i / cnt) * TAU + ring * 0.25 + jr(-0.04, 0.04);
          const bx = isl.cx + Math.cos(a) * isl.rx * f;
          const bz = isl.cz + Math.sin(a) * isl.rz * f;
          const onBridgeOrPier = ring === 0 && (
            isOnSkyPier(bx, bz) ||
            ROOT_BRIDGES.some((rb) => evalRootBridgeY(rb, bx, bz) !== null)
          );
          if (!onBridgeOrPier) {
            pushCliff(
              bx, yRing + jr(-0.12, 0.10), bz,
              jr(1.22, 1.95) * f, ring === 0 ? jr(0.66, 0.94) : jr(0.95, 1.52), jr(1.22, 1.95) * f,
              ring === 0 && jr(0, 1) < 0.35 ? pick(TRAVERTINE_PAL) : pick(CLIFF_ROCK_PAL)
            );
          }
          if (ring === 0 && !onBridgeOrPier && jr(0, 1) < 0.68) {
            // Rim moss cushions + wildflowers + hanging wisteria strands!
            pushFlora(
              bx, isl.y - 0.06, bz,
              jr(0.75, 1.22), jr(0.28, 0.46), jr(0.75, 1.22),
              pick(MOSS_PAL)
            );
            if (jr(0, 1) < 0.52) {
              pushFlora(bx, isl.y + 0.10, bz, 0.18, 0.14, 0.18, pick(WILDFLOWER_PAL));
            }
            if (jr(0, 1) < 0.28) {
              for (let w = 0; w < 5; w++) {
                pushFlora(
                  bx + Math.cos(a) * 0.25, isl.y - 0.18 - w * 0.22, bz + Math.sin(a) * 0.25,
                  (0.22 - w * 0.03), 0.24, (0.22 - w * 0.03),
                  WISTERIA_PAL[w % WISTERIA_PAL.length]
                );
              }
            }
          }
        }
      }
      // Bottom stalactite tip boulder
      pushCliff(isl.cx, isl.y - isl.bellyH - 0.25, isl.cz, 1.6, 2.2, 1.6, CLIFF_ROCK_PAL[1]);
    }

    // Sunlit Celestian Carved Stone Plaza Underlay on Central Hub (ring around Compass Basin + Southern Bazaar Forecourt)
    {
      const hubRingGeo = new THREE.RingGeometry(5.55, 10.25, 44);
      hubRingGeo.rotateX(-PI * 0.5);
      const hubRingMesh = new THREE.Mesh(hubRingGeo, plazaUnderMat);
      hubRingMesh.position.set(0.0, Y_HUB + 0.006, -1.6);
      hubRingMesh.receiveShadow = true;
      hubRingMesh.userData.ground = true;
      root.add(hubRingMesh);

      const bazGeo = new THREE.CircleGeometry(1.0, 32);
      bazGeo.rotateX(-PI * 0.5);
      bazGeo.scale(7.9, 1, 3.6);
      const bazMesh = new THREE.Mesh(bazGeo, plazaUnderMat);
      bazMesh.position.set(0.0, Y_HUB + 0.005, 8.7);
      bazMesh.receiveShadow = true;
      bazMesh.userData.ground = true;
      root.add(bazMesh);
    }

    // Concentric Hand-Laid 3D Travertine & Golden-Trim Cobbles on Central Hub + Island Forecourts!
    {
      let rad = 6.2;
      while (rad < 10.4) {
        const isGoldBand = Math.abs(rad - 6.45) < 0.28 || Math.abs(rad - 9.85) < 0.28;
        const n = Math.max(18, Math.round((TAU * rad) / 0.62));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + jr(-0.015, 0.015);
          const cx = Math.cos(a) * rad;
          const cz = -1.6 + Math.sin(a) * rad;
          if (evalIslandY(cx, cz) === null) continue;
          pushCobble(
            cx, Y_HUB + 0.012, cz, -a,
            0.52, isGoldBand ? 0.045 : 0.034, 0.56,
            isGoldBand ? 0xe5b34c : pick(TRAVERTINE_PAL)
          );
        }
        rad += 0.56;
      }
      // Southern Bazaar Forecourt cobbles
      for (let x = -7.6; x <= 7.6; x += 0.64) {
        for (let z = 6.2; z <= 11.8; z += 0.64) {
          if (Math.hypot(x / 8.2, (z - 8.8) / 3.6) <= 1.0 && evalIslandY(x, z) !== null) {
            pushCobble(x + jr(-0.04, 0.04), Y_HUB + 0.012, z + jr(-0.04, 0.04), jr(0, PI), 0.54, 0.032, 0.54, pick(TRAVERTINE_PAL));
          }
        }
      }
    }

    // Flush Cliff Rocks, Travertine Cobbles & Rim Flora into 3 ultra-fast InstancedMeshes!
    {
      const cliffInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.65, 1), stoneInstMat, cliffMatrices.length);
      cliffMatrices.forEach((m, i) => { cliffInst.setMatrixAt(i, m); cliffInst.setColorAt(i, cliffColors[i]); });
      cliffInst.castShadow = true;
      cliffInst.receiveShadow = true;
      root.add(cliffInst);

      const cobInst = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 0.14, 1), stoneInstMat, cobbleMatrices.length);
      cobbleMatrices.forEach((m, i) => { cobInst.setMatrixAt(i, m); cobInst.setColorAt(i, cobbleColors[i]); });
      cobInst.receiveShadow = true;
      cobInst.userData.ground = true;
      root.add(cobInst);

      const floraInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.55, 0), foliageInstMat, floraMatrices.length);
      floraMatrices.forEach((m, i) => { floraInst.setMatrixAt(i, m); floraInst.setColorAt(i, floraColors[i]); });
      floraInst.castShadow = true;
      root.add(floraInst);
    }

    // ========================================================================
    // 2. GIANT WALKABLE GNARLED TREE-ROOT BRIDGES LINKING ALL 5 SKY-ISLANDS!
    // ========================================================================
    for (const b of ROOT_BRIDGES) {
      const dx = b.x1 - b.x0, dz = b.z1 - b.z0, dy = b.y1 - b.y0;
      const horizLen = Math.hypot(dx, dz);
      const midX = (b.x0 + b.x1) * 0.5;
      const midZ = (b.z0 + b.z1) * 0.5;
      const midY = (b.y0 + b.y1) * 0.5;
      const yaw = Math.atan2(dx, dz);

      const brMesh = B.rootBridge
        ? B.rootBridge({ length: horizLen + 1.1, width: b.halfW * 2.0, rise: dy, arch: b.arch, garden: false })
        : null;
      if (brMesh && brMesh.children && brMesh.children.length > 0) {
        brMesh.position.set(midX, midY, midZ);
        brMesh.rotation.y = yaw;
        root.add(brMesh);
      }
      // Ensure a rock-solid sculpted root-and-stone walkable deck along the exact analytic curve!
      const steps = Math.max(8, Math.ceil(horizLen / 0.55));
      const deckGrp = new THREE.Group();
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const smT = t * t * (3 - 2 * t);
        const px = b.x0 + dx * t;
        const pz = b.z0 + dz * t;
        const py = b.y0 + dy * smT + Math.sin(t * PI) * b.arch;
        const slab = new THREE.Mesh(
          new RoundedBoxGeometry(b.halfW * 1.92, 0.22, (horizLen / steps) * 1.25, 0.05, 1),
          (b.id === 'br_west_step' || b.id === 'br_west') ? sm.travertinePlain : sm.barkAncient
        );
        slab.position.set(px, py - 0.10, pz);
        slab.rotation.y = yaw;
        slab.castShadow = true;
        slab.receiveShadow = true;
        slab.userData.ground = true;
        deckGrp.add(slab);
      }
      // Intertwined side root rails & dangling vertical roots underneath!
      for (const side of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const t = k / 6;
          const smT = t * t * (3 - 2 * t);
          const rx = b.x0 + dx * t + Math.cos(yaw) * side * (b.halfW * 0.94);
          const rz = b.z0 + dz * t - Math.sin(yaw) * side * (b.halfW * 0.94);
          const ry = b.y0 + dy * smT + Math.sin(t * PI) * b.arch + 0.18 + Math.sin(t * TAU * 1.5 + side) * 0.12;
          pts.push(new THREE.Vector3(rx, ry, rz));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.19, 7, false), sm.barkAncient);
        rail.castShadow = true;
        deckGrp.add(rail);
      }
      mergeStatic(THREE, deckGrp);
      root.add(deckGrp);
    }

    // ========================================================================
    // 3. CENTRAL SKYGLASS FOUNTAIN, SKY-PIER + ORNITHOPTER & 2 BAZAAR STALLS!
    // ========================================================================
    const fountain = ctx.placeKit(B.crystalFountain({ garden: false, seed: 11 }), 0.0, -2.0, 0.0, Y_HUB);
    const crystalGrp = fountain ? (fountain.userData?.crystalGrp || fountain.getObjectByName('crystalGrp')) : null;
    const ring1Grp = fountain ? (fountain.userData?.ring1Grp || fountain.getObjectByName('ring1Grp')) : null;
    const ring2Grp = fountain ? (fountain.userData?.ring2Grp || fountain.getObjectByName('ring2Grp')) : null;
    const ring3Grp = fountain ? (fountain.userData?.ring3Grp || fountain.getObjectByName('ring3Grp')) : null;

    // Animated glowing lotus water disk inside the Central Compass Basin
    const poolWater = createAnimatedWater(THREE, {
      width: 10.6,
      depth: 10.6,
      segments: 24,
      shallow: 0x4be2f6,
      deep: 0x1b8cb4,
      foam: 0xd8ffff,
      opacity: 0.72,
      amp: 0.025,
    });
    poolWater.mesh.geometry = new THREE.CircleGeometry(5.1, 36);
    poolWater.mesh.geometry.rotateX(-PI * 0.5);
    poolWater.mesh.rotation.set(0, 0, 0);
    poolWater.mesh.position.set(0.0, Y_HUB - 0.05, -2.0);
    root.add(poolWater.mesh);

    // SE Wooden Ornithopter Sky-Pier + Moored Dragonfly Ornithopter!
    const pier = ctx.placeKit(B.ornithopterPier({ garden: false, seed: 21 }), PIER_CFG.cx, PIER_CFG.cz, PIER_CFG.rot, Y_SE);
    const mooredOrnithopter = pier ? (pier.userData?.mooredOrnithopter || pier.getObjectByName('mooredOrnithopter')) : null;
    const ornithopterWingL = pier ? (pier.userData?.ornithopterWingL || pier.getObjectByName('ornithopterWingL')) : null;
    const ornithopterWingR = pier ? (pier.userData?.ornithopterWingR || pier.getObjectByName('ornithopterWingR')) : null;

    // 2 Foreground Sky-Bazaar Stalls (Cream West & Terracotta-Striped East matching overview.png!)
    ctx.placeKit(B.skyStall({ striped: false, garden: false, seed: 31 }), -4.8, 8.8, 0.34, Y_HUB);
    ctx.placeKit(B.skyStall({ striped: true, garden: false, seed: 37 }), 4.8, 8.8, -0.34, Y_HUB);

    // 2 Celestian Carved Travertine & Mossy Garden Benches flanking the North Crown Promenade (standable 3D parkour props!)
    for (const [bx, bz, brot] of [[-3.4, -8.8, 0.0], [3.4, -9.2, 0.0]]) {
      const bench = new THREE.Group();
      bench.name = 'sr_promenade_bench';
      const legL = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.38, 0.22, 0.04, 1), sm.travertinePlain);
      legL.position.set(0, 0.19, -0.46);
      const legR = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.38, 0.22, 0.04, 1), sm.travertinePlain);
      legR.position.set(0, 0.19, 0.46);
      const seat = new THREE.Mesh(new RoundedBoxGeometry(0.50, 0.10, 1.28, 0.04, 1), sm.travertinePlain);
      seat.position.set(0, 0.43, 0);
      const moss = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.04, 0.52, 0.02, 1), sm.mossGreen);
      moss.position.set(-0.06, 0.485, -0.26);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), sm.cyanCrystal);
      gem.position.set(0.24, 0.24, 0);
      bench.add(legL, legR, seat, moss, gem);
      bench.userData.colliders = [{ x: 0, z: 0, w: 0.50, d: 1.28, y0: -0.05, y1: 0.48 }];
      ctx.placeKit(bench, bx, bz, brot, Y_HUB);
    }

    // ========================================================================
    // 4. ALL 5 ENTERABLE CELESTIAN BUILDINGS ACROSS THE 5 FLOATING SKY ISLANDS!
    // ========================================================================
    // 1. NORTH CROWN ISLAND (y = 4.95m): Ancient Tree-Crown Aether Observatory
    ctx.placeKit(B.crystal_sanctuary({ garden: false, seed: 101 }), 0.0, -21.6, 0.0, Y_NORTH);

    // 2. EAST TERRACE ISLAND (y = 3.55m): Botanical Sky-Orchid Conservatory
    ctx.placeKit(B.root_conservatory({ garden: false, seed: 102 }), 20.0, -10.8, -1.05, Y_EAST);

    // 3. SE HARBOUR ISLAND (y = 0.95m): Sky-Pirate Ornithopter Hangar & Canvas Canopy
    const hangarBld = ctx.placeKit(B.airship_hangar({ garden: false, seed: 103 }), 19.4, 8.6, -1.92, Y_SE);
    const hangarWindvane = hangarBld ? (hangarBld.userData?.windvane || hangarBld.getObjectByName('hangarWindvane')) : null;

    // 4. SW RELIQUARY TERRACE (y = 2.95m): Mossy Guardian Golem Ziggurat Shrine
    ctx.placeKit(B.golem_workshop({ garden: false, seed: 104 }), -19.2, 8.0, 1.92, Y_SW);

    // 5. NW WIND TERRACE (y = 4.15m): Temple of the Four Winds Colonnade
    ctx.placeKit(B.wind_belltower({ garden: false, seed: 105 }), -19.0, -10.8, 1.05, Y_NW);

    // ========================================================================
    // 5. 5 GLOWING WIND UPDRAFT GEYSERS & 6 ORBITING RUNE-STONE PLATFORMS!
    // ========================================================================
    const updraftSpecs = [
      { x: 7.4,  y: Y_HUB,  z: 2.2,   r: 1.55, vy: 12.2 }, // Hub East -> soar to Conservatory or Hangar!
      { x: -7.4, y: Y_HUB,  z: 1.8,   r: 1.55, vy: 12.2 }, // Hub West -> soar to Golem or Colonnade!
      { x: 13.8, y: Y_SE,   z: 2.8,   r: 1.55, vy: 13.4 }, // SE Hangar -> launch high up to East Conservatory!
      { x: 14.2, y: Y_EAST, z: -14.8, r: 1.55, vy: 12.0 }, // East Conservatory -> glide across to North Observatory Crown!
      { x: -13.8, y: Y_NW,  z: -14.6, r: 1.55, vy: 11.8 }, // NW Colonnade -> glide across to North Observatory Crown!
    ];
    const updraftSwirls = [];
    for (const spec of updraftSpecs) {
      WORLD_STATE.updrafts.push(spec);
      const geyserMesh = B.updraftGeyser
        ? B.updraftGeyser({ garden: false })
        : new THREE.Group();
      if (!geyserMesh.children || geyserMesh.children.length === 0) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.18, 8), sm.runeFrieze);
        ring.position.y = 0.09;
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.22, 16), sm.cyanCrystal);
        core.position.y = 0.10;
        const swirl = new THREE.Group();
        swirl.name = 'windSwirl';
        for (let k = 0; k < 3; k++) {
          const pts = [];
          for (let j = 0; j <= 16; j++) {
            const t = j / 16;
            const a = (k / 3) * TAU + t * TAU * 1.4;
            pts.push(new THREE.Vector3(Math.cos(a) * (0.72 + t * 0.45), 0.2 + t * 3.1, Math.sin(a) * (0.72 + t * 0.45)));
          }
          const tube = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.045 * (1 - k * 0.12), 5, false),
            sm.conservatoryGlass
          );
          swirl.add(tube);
        }
        geyserMesh.add(ring, core, swirl);
      }
      geyserMesh.position.set(spec.x, spec.y, spec.z);
      root.add(geyserMesh);
      const sw = geyserMesh.getObjectByName('windSwirl') || geyserMesh;
      updraftSwirls.push(sw);
    }

    // 6 Orbiting Ancient Celestian Rune-Stone Platforms circling high above the Central Hub & Root Bridges!
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU;
      const orbitR = 13.6;
      const baseY = 6.15 + (i % 2) * 0.35;
      const platMesh = B.orbitingRunePlatform
        ? B.orbitingRunePlatform({ radius: 1.85, seed: 80 + i })
        : new THREE.Group();
      if (!platMesh.children || platMesh.children.length === 0) {
        const topSlab = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.65, 0.34, 8), sm.travertine);
        topSlab.position.y = -0.17;
        topSlab.userData.ground = true;
        const runeBand = new THREE.Mesh(new THREE.CylinderGeometry(1.74, 1.58, 0.22, 8, 1, true), sm.runeFrieze);
        runeBand.position.y = -0.34;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.42, 1.55, 7), sm.travertineDark);
        cone.rotation.x = PI;
        cone.position.y = -1.12;
        platMesh.add(topSlab, runeBand, cone);
      }
      const x0 = Math.cos(a0) * orbitR;
      const z0 = 0.4 + Math.sin(a0) * orbitR;
      platMesh.position.set(x0, baseY, z0);
      root.add(platMesh);
      WORLD_STATE.orbitPlatforms.push({
        angle: a0,
        speed: 0.165,
        orbitR,
        cx: 0.0,
        cz: 0.4,
        baseY,
        ampY: 0.28,
        phase: i * 1.1,
        x: x0,
        y: baseY,
        z: z0,
        prevX: x0,
        prevZ: z0,
        radius: 1.85,
        mesh: platMesh,
      });
    }

    // Ambient Floating Rubble Ring (including 2 Hovering Rune-Stone Disguise Anchors!)
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * TAU + 0.35;
      const orbitR = 11.9;
      const baseY = 2.95 + (i % 3) * 0.38;
      const x0 = Math.cos(a0) * orbitR;
      const z0 = -1.2 + Math.sin(a0) * orbitR;
      const rubMesh = new THREE.Group();
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), sm.travertine);
      const rn = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 5, 14), sm.cyanCrystal);
      rn.rotation.x = 1.1;
      rubMesh.add(rk, rn);
      rubMesh.position.set(x0, baseY, z0);
      root.add(rubMesh);
      WORLD_STATE.orbitRubble.push({
        angle: a0,
        speed: -0.22,
        orbitR,
        cx: 0.0,
        cz: -1.2,
        baseY,
        phase: i * 0.9,
        x: x0,
        y: baseY,
        z: z0,
        rot: a0,
        mesh: rubMesh,
      });
    }

    // ========================================================================
    // 6. SKY-RUINS INTERACTIVE HIDING SPOTS (ROOT-CLING, ORBIT RUNE, MOBILE SANCTUM GOLEM!)
    // ========================================================================
    // Build 2 outdoor Mossy Dormant Guardian Golem Shells on North & East Island cliffs!
    const buildOutdoorGolemShell = (gx, gy, gz, rotY) => {
      const gg = new THREE.Group();
      gg.position.set(gx, gy, gz);
      gg.rotation.y = rotY;
      const torso = new THREE.Mesh(new RoundedBoxGeometry(1.45, 1.35, 1.15, 0.18, 2), sm.golemStone);
      torso.position.y = 0.68;
      const head = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.66, 0.72, 0.14, 2), sm.golemStone);
      head.position.set(0, 1.56, 0.05);
      head.rotation.z = 0.12;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), sm.cyanSoft);
      eyeL.position.set(-0.17, 1.58, 0.40);
      const eyeR = eyeL.clone();
      eyeR.position.set(0.17, 1.55, 0.40);
      const mossCap = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 8), sm.mossGreen);
      mossCap.scale.set(1.15, 0.45, 0.95);
      mossCap.position.set(0, 1.32, -0.05);
      gg.add(torso, head, eyeL, eyeR, mossCap);
      gg.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      root.add(gg);
    };
    buildOutdoorGolemShell(-7.8, Y_NORTH, -18.2, 0.55);
    buildOutdoorGolemShell(24.2, Y_EAST, -14.6, -0.65);

    // Build visible dangling vertical Cliff Root Clusters at the 4 Root-Cling Hiding Spots!
    const rootClingConfigs = [
      {
        label: 'Cling to Crown Sky-Root',
        x: -2.25, y: Y_NORTH - 0.92, z: -13.6,
        triggerX: -1.65, triggerY: Y_NORTH - 0.4, triggerZ: -13.8,
        exitX: -1.1, exitY: Y_NORTH, exitZ: -14.8, rot: 0.2,
      },
      {
        label: 'Cling to Conservatory Root',
        x: 11.8, y: Y_EAST - 0.88, z: -8.2,
        triggerX: 12.4, triggerY: Y_EAST - 0.3, triggerZ: -7.4,
        exitX: 13.8, exitY: Y_EAST, exitZ: -7.8, rot: -0.9,
      },
      {
        label: 'Cling to Bazaar Cliff Root',
        x: -0.4, y: Y_HUB - 0.92, z: 13.1,
        triggerX: -0.4, triggerY: Y_HUB, triggerZ: 11.8,
        exitX: -0.4, exitY: Y_HUB, exitZ: 10.6, rot: 0.0,
      },
      {
        label: 'Cling to Wind-Temple Root',
        x: -11.4, y: Y_NW - 0.88, z: -8.0,
        triggerX: -12.0, triggerY: Y_NW - 0.3, triggerZ: -7.2,
        exitX: -13.6, exitY: Y_NW, exitZ: -7.6, rot: 0.9,
      },
    ];
    for (const rc of rootClingConfigs) {
      const pts = [
        new THREE.Vector3(rc.triggerX, rc.triggerY + 0.15, rc.triggerZ),
        new THREE.Vector3(rc.x, rc.y + 0.55, rc.z),
        new THREE.Vector3(rc.x + 0.12, rc.y - 1.35, rc.z - 0.08),
      ];
      const vineMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.22, 7, false), sm.barkAncient);
      vineMesh.castShadow = true;
      root.add(vineMesh);

      WORLD_STATE.interactSpots.push({
        kind: 'custom_spot',
        spotType: 'root_cling',
        icon: '🌿',
        label: rc.label,
        leaveLabel: 'Climb Up From Sky-Root',
        disguiseLabel: 'Root-Cling Vine Pod 🌿',
        enterHint: '🌿 Clinging to a giant vertical tree-root over the open clouds! (WASD or G to climb back up)',
        x: rc.x,
        groundY: rc.y,
        z: rc.z,
        offsetY: 0,
        rot: rc.rot,
        triggerX: rc.triggerX,
        triggerY: rc.triggerY,
        triggerZ: rc.triggerZ,
        exitX: rc.exitX,
        exitY: rc.exitY,
        exitZ: rc.exitZ,
        hp: 70,
      });
    }

    // 2 Mid-Air Orbiting Celestia Rune-Stone Disguise Spots!
    const orbitSpotAnchors = [
      { idx: 0, tx: 9.2, ty: Y_HUB, tz: -1.2, ex: 8.2, ey: Y_HUB, ez: -1.2, label: 'Hover as Orbiting Rune-Stone' },
      { idx: 4, tx: -9.2, ty: Y_HUB, tz: -1.2, ex: -8.2, ey: Y_HUB, ez: -1.2, label: 'Hover as Orbiting Rune-Stone' },
    ];
    for (const oa of orbitSpotAnchors) {
      // Small glowing cyan rune beacon post at the rim so players spot the interaction!
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), sm.cyanCrystal);
      beacon.position.set(oa.tx, oa.ty + 0.65, oa.tz);
      root.add(beacon);

      const rubRef = WORLD_STATE.orbitRubble[oa.idx];
      WORLD_STATE.interactSpots.push({
        kind: 'custom_spot',
        spotType: 'orbit_rune',
        icon: '🪨',
        label: oa.label,
        leaveLabel: 'Float Back to Island Rim',
        disguiseLabel: 'Orbiting Celestia Rune-Stone 🪨',
        enterHint: '🪨 Hovering mid-air inside the orbiting Celestia rune-stones! (WASD or G to return to rim)',
        x: rubRef.x,
        groundY: rubRef.y,
        z: rubRef.z,
        offsetY: 0,
        triggerX: oa.tx,
        triggerY: oa.ty,
        triggerZ: oa.tz,
        exitX: oa.ex,
        exitY: oa.ey,
        exitZ: oa.ez,
        hp: 85,
        getWorldPos: () => ({ x: rubRef.x, y: rubRef.y - 0.35, z: rubRef.z, rot: rubRef.rot }),
      });
    }

    // 3 Mobile Sanctum Stone Golem Disguise Spots (walk slowly with WASD as a Celestia Guardian Golem!)
    for (const gs of [
      { id: 'golem_sanctum_sw', x: -18.2, y: Y_SW + 0.34, z: 7.4, label: 'Pilot Mobile Sanctum Golem' },
      { id: 'golem_north_outer', x: -7.8, y: Y_NORTH, z: -18.2, label: 'Pilot Mobile Stone Golem' },
      { id: 'golem_east_outer', x: 24.2, y: Y_EAST, z: -14.6, label: 'Pilot Mobile Stone Golem' },
    ]) {
      WORLD_STATE.interactSpots.push({
        id: gs.id,
        kind: 'custom_spot',
        spotType: 'golem_shell',
        icon: '🤖',
        label: gs.label,
        leaveLabel: 'Step Out of Stone Golem',
        disguiseLabel: 'Mobile Sanctum Golem 🤖',
        enterHint: '🤖 Piloting a Mobile Sanctum Stone Golem! Roam with WASD or press G/Jump to step out!',
        exitHint: 'Stepped out of the Sanctum Stone Golem! ✨',
        x: gs.x,
        groundY: gs.y,
        z: gs.z,
        offsetY: 0.05,
        mobile: true,
        speedMul: 0.72,
        radius: 0.44,
        height: 0.90,
        triggerX: gs.x,
        triggerY: gs.y,
        triggerZ: gs.z,
        hp: 105,
      });
    }

    // ========================================================================
    // 7. SATELLITE FLOATING ISLETS, SEA OF 3D CLOUDS & 8 CLIFF WATERFALLS!
    // ========================================================================
    const islets = [];
    const isletSpecs = [
      { x: -29.5, y: 5.6, z: -18.5, sc: 1.15 },
      { x: 29.8,  y: 4.8, z: -17.2, sc: 1.10 },
      { x: -29.0, y: 2.2, z: 16.8,  sc: 0.95 },
      { x: 28.5,  y: 1.8, z: 19.4,  sc: 0.92 },
      { x: 0.0,   y: 7.4, z: -33.5, sc: 1.30 },
    ];
    isletSpecs.forEach((sp, idx) => {
      const ig = B.floatingIslet ? B.floatingIslet({ scale: sp.sc, seed: 300 + idx }) : new THREE.Group();
      if (!ig.children || ig.children.length === 0) {
        const rock = new THREE.Mesh(new THREE.ConeGeometry(2.2 * sp.sc, 3.2 * sp.sc, 7), sm.travertineDark);
        rock.rotation.x = PI;
        rock.position.y = -1.6 * sp.sc;
        const turf = new THREE.Mesh(new THREE.CylinderGeometry(2.3 * sp.sc, 2.0 * sp.sc, 0.35, 12), grassTopMat);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 * sp.sc, 1), sm.mossGreen);
        crown.position.y = 1.6 * sp.sc;
        ig.add(rock, turf, crown);
      }
      ig.position.set(sp.x, sp.y, sp.z);
      root.add(ig);
      islets.push({ g: ig, baseY: sp.y, phase: idx * 1.3 });
    });

    // Billowing Sea of Sunlit Storybook 3D Cumulus Clouds beneath & around the 5 Sky-Islands!
    const CLOUD_N = 260;
    const cloudGeo = new THREE.IcosahedronGeometry(1.0, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xd8ecff,
      emissiveIntensity: 0.24,
      roughness: 0.92,
      metalness: 0,
    });
    const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUD_N);
    const cloudData = [];
    for (let i = 0; i < CLOUD_N; i++) {
      // Fill the deep sky chasms below the island bellies (y = -8.8 .. -5.2) AND the distant horizon ring!
      const inChasm = i < 105;
      const a = jr(0, TAU);
      const r = inChasm ? jr(10.5, 44.0) : jr(50.0, 102.0);
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const cy = inChasm ? jr(-8.8, -5.2) : jr(-7.6, -2.4);
      const sx = inChasm ? jr(2.8, 5.4) : jr(5.8, 11.8);
      const sy = sx * jr(0.40, 0.58);
      cloudData.push({ x: cx, y: cy, z: cz, sx, sy, sz: sx * jr(0.85, 1.15), spd: jr(0.18, 0.48), ph: jr(0, TAU) });
    }
    root.add(cloudInst);

    // 8 Sparkling Turquoise Cliff Waterfalls + Swirling Mist Cushions pouring into the Cloud Sea!
    const wfSpecs = [
      [-3.8, Y_HUB - 0.15, 13.0, 0.12, 6.2],
      [0.4,  Y_HUB - 0.15, 13.3, 0.0,  6.5],
      [4.4,  Y_HUB - 0.15, 12.8, -0.14, 6.2],
      [-8.4, Y_NORTH - 0.15, -18.5, 0.55, 8.5],
      [8.4,  Y_NORTH - 0.15, -18.5, -0.55, 8.5],
      [26.2, Y_EAST - 0.15, -8.5, -1.35, 7.2],
      [-25.8, Y_SW - 0.15, 9.2, 1.45, 6.8],
      [24.6, Y_SE - 0.15, 14.5, -0.85, 5.2],
    ];
    const wfMat = new THREE.MeshStandardMaterial({
      color: 0x6cecff,
      emissive: 0x1cb8e8,
      emissiveIntensity: 0.55,
      roughness: 0.20,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
    });
    const wfMeshes = [];
    for (const [wx, wy, wz, wrot, wh] of wfSpecs) {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      wg.rotation.y = wrot;
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.15, wh, 0.22), wfMat);
      sheet.position.set(0, -wh * 0.5, 0.15);
      const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.18, 10), cloudMat);
      crest.rotation.z = PI * 0.5;
      const mist = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), cloudMat);
      mist.scale.set(1.3, 0.65, 1.3);
      mist.position.set(0, -wh + 0.3, 0.25);
      wg.add(sheet, crest, mist);
      root.add(wg);
      wfMeshes.push({ mist, sheet, baseH: wh, ph: jr(0, TAU) });
    }

    // Swaying Sunlit Storybook Clover & Wildflower Blades across all 5 Islands!
    const grass = createSwayingBlades(THREE, {
      count: 3600,
      height: 0.46,
      width: 0.055,
      spread: 31.5,
      color: 0x82c850,
      seed: 91,
      filter: (x, z) => {
        const y = evalIslandY(x, z);
        if (y === null) return false;
        // Keep central mosaic & bazaar cobbles clean
        if (Math.hypot(x, z + 1.6) < 10.2) return false;
        if (Math.hypot(x, z - 8.8) < 6.8) return false;
        // Keep Ascend stone pads, Launch-Stars & Bind Portals free of protruding grass blades
        for (const a of ASCEND_ARCHES) {
          if (isOnAscendDeck(a, x, z) || evalAscendStairY(a.stair, x, z) !== null) return false;
        }
        for (const ls of LAUNCH_STAR_SPECS) {
          if (Math.hypot(x - ls.fromX, z - ls.fromZ) < 1.55) return false;
        }
        for (const bp of BIND_PORTALS) {
          if (!bp.isExit && Math.hypot(x - bp.x, z - bp.z) < 1.65) return false;
        }
        // Keep building footprints clean
        for (const [bx, bz, br] of [
          [0, -21.6, 6.2], [20.0, -10.8, 6.0], [19.4, 8.6, 6.2], [-19.2, 8.0, 6.0], [-19.0, -10.8, 6.0],
        ]) {
          if (Math.hypot(x - bx, z - bz) < br) return false;
        }
        return true;
      },
    });
    // Adjust each blade's Y to its floating island height!
    {
      const m4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      for (let i = 0; i < grass.inst.count; i++) {
        grass.inst.getMatrixAt(i, m4);
        m4.decompose(pos, quat, scl);
        const iy = evalIslandY(pos.x, pos.z);
        pos.y += (iy !== null ? iy : Y_HUB);
        m4.compose(pos, quat, scl);
        grass.inst.setMatrixAt(i, m4);
      }
      grass.inst.instanceMatrix.needsUpdate = true;
    }
    root.add(grass.inst);

    // Warm Golden & Luminous Cyan PointLights across all 5 Islands
    for (const [lx, ly, lz, hex, inten, dist] of [
      [0, Y_HUB + 3.2, -2.0, 0x4ce8ff, 2.5, 18],      // Central Skyglass Crystal glow
      [0, Y_NORTH + 3.6, -17.5, 0xffd27a, 2.2, 16],   // North Observatory Portal
      [16.2, Y_EAST + 3.2, -9.2, 0x9ab8ff, 2.0, 15],  // East Orchid Conservatory
      [15.8, Y_SE + 3.2, 7.8, 0xffbe64, 2.2, 15],     // SE Pirate Hangar
      [-15.6, Y_SW + 3.2, 6.8, 0x5ae8ff, 2.0, 15],    // SW Golem Reliquary
      [-15.6, Y_NW + 3.2, -9.2, 0xffd884, 2.0, 15],   // NW Wind-Chime Colonnade
    ]) {
      const pl = new THREE.PointLight(hex, inten, dist, 1.6);
      pl.position.set(lx, ly, lz);
      root.add(pl);
    }

    // Extra Camouflage Spots across all 5 Islands
    for (const [sx, sz, hex, sy] of [
      [-6.5, 4.5, COL_STONE, Y_HUB], [6.5, 4.5, COL_STONE, Y_HUB],
      [-5.8, -16.8, COL_GRASS, Y_NORTH], [5.8, -16.8, COL_GRASS, Y_NORTH],
      [15.2, -5.8, COL_GRASS, Y_EAST], [14.8, 13.5, COL_GRASS, Y_SE],
      [-14.8, 12.6, COL_GRASS, Y_SW], [-14.8, -5.8, COL_GRASS, Y_NW],
    ]) {
      addSpotSafe(sx, sz, hex, 'stone', sy);
    }

    // ========================================================================
    // 8. 14 MULTI-ISLAND OUTDOOR PROP VIGNETTES ACROSS ALL 5 ELEVATIONS!
    // ========================================================================
    if (ctx.addVig) {
      // Island 1 (Y_HUB = 2.00m): West & East Sky-Bazaar Stalls + Compass Basin Rim
      ctx.addVig(-4.8, 8.8, [
        ['sr_levitation_urn', -2.15, 0.25, 0.3],
        ['sr_levitation_urn', -2.15, -1.05, 0.8],
        ['sr_specimen_crate', 2.15, 0.3, -0.2],
        ['sr_crystal_lantern', -1.35, -1.45, 0.1],
        ['sr_sky_compass', 1.4, -1.45, -0.4],
      ], 1, Y_HUB);

      ctx.addVig(4.8, 8.8, [
        ['sr_pirate_chest', 2.15, 0.25, -0.3],
        ['sr_pirate_chest', 2.15, -1.05, 0.2],
        ['sr_propeller_barrel', -2.15, 0.3, 0.4],
        ['sr_crystal_lantern', 1.35, -1.45, 0.0],
        ['sr_telescope_tripod', -1.4, -1.45, 0.5],
      ], 1, Y_HUB);

      ctx.addVig(-7.6, 8.2, [
        ['sr_wind_chime_stand', -0.55, 0.45, 0.6],
        ['sr_cloud_planter', 0.6, -0.45, -0.3],
        ['sr_crystal_lantern', 0.6, 0.55, 0.2],
        ['sr_stone_stele', -0.6, -0.55, 0.5],
      ], 1, Y_HUB);

      ctx.addVig(7.4, 8.8, [
        ['sr_cloud_planter', -0.55, -0.45, 0.2],
        ['sr_cloud_planter', 0.55, 0.45, -0.4],
        ['sr_crystal_lantern', -0.55, 0.55, 0.0],
        ['sr_levitation_urn', 0.55, -0.55, 0.6],
      ], 1, Y_HUB);

      // Island 2 (Y_NORTH = 4.95m): Ancient Tree-Crown Observatory Gardens West & East (clear of front forecourt & Golem Shell!)
      ctx.addVig(-7.2, -23.2, [
        ['sr_telescope_tripod', -0.8, 0.65, 0.4],
        ['sr_sky_compass', 0.75, 0.7, -0.2],
        ['sr_stone_stele', -0.8, -0.7, 0.1],
        ['sr_crystal_lantern', 0.8, -0.7, -0.3],
      ], 1, Y_NORTH);

      ctx.addVig(6.8, -21.6, [
        ['sr_levitation_urn', -0.75, 0.6, 0.2],
        ['sr_levitation_urn', 0.75, 0.65, 0.9],
        ['sr_golem_head', 0.0, -0.8, -0.3],
        ['sr_cloud_planter', 1.35, -0.55, 0.4],
      ], 1, Y_NORTH);

      // Island 3 (Y_EAST = 3.55m): Botanical Sky-Orchid Conservatory Lawn
      ctx.addVig(15.6, -4.6, [
        ['sr_cloud_planter', -0.8, -0.65, 0.2],
        ['sr_cloud_planter', 0.8, -0.65, -0.5],
        ['sr_specimen_crate', -0.8, 0.8, 0.3],
        ['sr_specimen_crate', 0.8, 0.8, -0.1],
        ['sr_levitation_urn', 1.9, 0.1, 0.7],
      ], 2, Y_EAST);

      ctx.addVig(18.6, -15.6, [
        ['sr_specimen_crate', -0.75, 0.55, 0.2],
        ['sr_cloud_planter', 0.75, 0.55, -0.4],
        ['sr_crystal_lantern', 0.0, -0.75, 0.0],
      ], 1, Y_EAST);

      // Island 4 (Y_SE = 0.95m): Sky-Pirate Hangar Cargo Apron & Pier Lawn (clear of door & pier mouth!)
      ctx.addVig(16.2, 2.8, [
        ['sr_propeller_barrel', -0.8, -0.6, 0.4],
        ['sr_propeller_barrel', 0.8, -0.6, -0.3],
        ['sr_pirate_chest', -0.8, 0.8, 0.1],
        ['sr_ornithopter_seat', 0.8, 0.8, -1.6],
      ], 2, Y_SE);

      ctx.addVig(18.2, 14.6, [
        ['sr_pirate_chest', -0.8, -0.6, 0.2],
        ['sr_propeller_barrel', 0.8, -0.6, -0.4],
        ['sr_ornithopter_seat', -0.75, 0.8, 0.6],
        ['sr_telescope_tripod', 0.85, 0.75, 0.5],
      ], 1, Y_SE);

      // Island 5A (Y_SW = 2.95m): Guardian Golem Ziggurat Lawn (clear of door & br_west_step approach!)
      ctx.addVig(-16.2, 13.6, [
        ['sr_golem_head', -0.8, -0.6, 0.8],
        ['sr_golem_head', 0.8, -0.6, 1.2],
        ['sr_levitation_urn', -0.8, 0.8, 0.2],
        ['sr_stone_stele', 0.8, 0.8, -0.4],
      ], 1, Y_SW);

      ctx.addVig(-22.4, 12.6, [
        ['sr_stone_stele', -0.75, -0.55, 0.4],
        ['sr_golem_head', 0.75, -0.55, -0.2],
        ['sr_cloud_planter', 0.0, 0.8, 0.3],
      ], 1, Y_SW);

      // Island 5B (Y_NW = 4.15m): Temple of the Four Winds Colonnade Terrace (clear of br_west_step & door!)
      ctx.addVig(-23.2, -7.8, [
        ['sr_wind_chime_stand', -0.8, -0.6, 0.9],
        ['sr_wind_chime_stand', 0.8, -0.6, 0.6],
        ['sr_crystal_lantern', -0.8, 0.8, 0.0],
        ['sr_sky_compass', 0.8, 0.8, -0.3],
      ], 1, Y_NW);

      ctx.addVig(-18.2, -15.8, [
        ['sr_wind_chime_stand', -0.75, 0.55, 0.4],
        ['sr_cloud_planter', 0.75, 0.55, -0.3],
        ['sr_levitation_urn', 0.0, -0.75, 0.2],
      ], 1, Y_NW);
    }

    // ========================================================================
    // 8B. LIVING SKY CREATURES (4 SOARING SKY-MANTAS & 3 SKY-RUIN GLIDERS)
    // ========================================================================

    // Playable Disguise Prop Spawns for Sky-Mantas, Sky-Ruin Gliders & Crystal Lanterns
    if (ctx.addSlot) {
      ctx.addSlot('sr_fox_squirrel', -3.6, 5.4, 0.4, Y_HUB);
      ctx.addSlot('sr_sky_manta', 4.6, -15.8, -0.5, Y_NORTH);
      ctx.addSlot('sr_fox_squirrel', 15.2, -9.2, 1.2, Y_EAST);
      ctx.addSlot('sr_sky_manta', -15.4, 9.2, 0.8, Y_SW);
      ctx.addSlot('sr_fox_squirrel', -5.4, 5.2, 0.3, Y_HUB);
      ctx.addSlot('sr_crystal_lantern', 14.0, -9.2, -0.2, Y_EAST);
    }

    // Living Fleet: 4 Soaring Sky-Mantas & 3 Scampering Sky-Ruin Gliders!
    const { buildSkyMantaVariant, buildFoxSquirrel } = SkyPropsMod;
    WORLD_STATE.creatures = createCreatureFleetController(THREE, ctx, [
      {
        id: 'sr_sky_manta',
        builder: (T) => buildSkyMantaVariant(T, 'cyan'),
        kind: 'flyer',
        canFly: true,
        radius: 0.46,
        height: 0.86,
        scale: 1.05,
        speed: 5.4,
        orbitCx: 0.0,
        orbitCz: -11.5,
        orbitRx: 14.5,
        orbitRz: 9.2,
        orbitY: 10.6,
        bobY: 1.0,
        orbitSpeed: 0.34,
        callType: 'manta',
        perches: [
          { x: 4.8, y: Y_NORTH, z: -15.6, rotY: 0.3 },
          { x: -4.8, y: Y_HUB, z: 2.8, rotY: -0.6 },
        ],
      },
      {
        id: 'sr_sky_manta',
        builder: (T) => buildSkyMantaVariant(T, 'lavender'),
        kind: 'flyer',
        canFly: true,
        radius: 0.46,
        height: 0.86,
        scale: 1.0,
        speed: 5.0,
        figure8: true,
        orbitCx: 8.8,
        orbitCz: -4.2,
        orbitRx: 10.8,
        orbitRz: 7.4,
        orbitY: 8.8,
        bobY: 0.85,
        orbitSpeed: 0.36,
        phase: 1.8,
        callType: 'manta',
        perches: [
          { x: 14.2, y: Y_EAST, z: -8.8, rotY: 1.2 },
          { x: 5.6, y: Y_HUB, z: 3.6, rotY: 2.1 },
        ],
      },
      {
        id: 'sr_sky_manta',
        builder: (T) => buildSkyMantaVariant(T, 'gold'),
        kind: 'flyer',
        canFly: true,
        radius: 0.46,
        height: 0.86,
        scale: 1.02,
        speed: 5.1,
        orbitCx: -10.2,
        orbitCz: -1.6,
        orbitRx: 10.2,
        orbitRz: 10.2,
        orbitY: 9.2,
        bobY: 0.9,
        orbitSpeed: 0.35,
        phase: 3.4,
        callType: 'manta',
        perches: [
          { x: -14.6, y: Y_NW, z: -6.2, rotY: -0.8 },
          { x: -13.8, y: Y_SW, z: 7.6, rotY: 0.9 },
        ],
      },
      {
        id: 'sr_sky_manta',
        builder: (T) => buildSkyMantaVariant(T, 'cyan'),
        kind: 'flyer',
        canFly: true,
        radius: 0.46,
        height: 0.86,
        scale: 1.12,
        speed: 5.8,
        orbitCx: 0.0,
        orbitCz: -2.5,
        orbitRx: 18.0,
        orbitRz: 16.5,
        orbitY: 11.8,
        bobY: 1.15,
        orbitSpeed: 0.28,
        phase: 5.0,
        callType: 'manta',
        perches: [
          { x: 15.6, y: Y_SE, z: 11.8, rotY: 1.7 },
          { x: 0.0, y: Y_NORTH, z: -16.2, rotY: 0.0 },
        ],
      },
      {
        id: 'sr_fox_squirrel',
        builder: (T) => buildFoxSquirrel(T),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.68,
        speed: 2.35,
        pauseSec: 1.4,
        callType: 'critter',
        waypoints: [
          { x: -6.2, y: Y_HUB, z: 3.8 },
          { x: -7.8, y: Y_HUB, z: 0.2 },
          { x: -4.2, y: Y_HUB, z: -4.6 },
          { x: -1.4, y: Y_HUB, z: 4.4 },
        ],
      },
      {
        id: 'sr_fox_squirrel',
        builder: (T) => buildFoxSquirrel(T),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.68,
        speed: 2.45,
        pauseSec: 1.3,
        callType: 'critter',
        waypoints: [
          { x: -4.6, y: Y_NORTH, z: -16.2 },
          { x: 0.0,  y: Y_NORTH, z: -15.2 },
          { x: 4.6,  y: Y_NORTH, z: -16.2 },
          { x: 2.2,  y: Y_NORTH, z: -17.4 },
        ],
      },
      {
        id: 'sr_fox_squirrel',
        builder: (T) => buildFoxSquirrel(T),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.68,
        speed: 2.30,
        pauseSec: 1.5,
        callType: 'critter',
        waypoints: [
          { x: 14.2, y: Y_EAST, z: -7.8 },
          { x: 15.6, y: Y_EAST, z: -11.4 },
          { x: 17.2, y: Y_EAST, z: -7.2 },
          { x: 14.6, y: Y_EAST, z: -5.2 },
        ],
      },
    ]);

    // ========================================================================
    // 8C. CELESTIA BESPOKE MECHANICS:
    //     1) 5 Zelda TotK "Ascend" Vertical Ceiling-Phase Pillars + Seeker Stairs
    //     2) 4 Mario Galaxy Spinning 5-Point Golden Launch-Star Sling Rings
    //     3) Shootable/Interactable Central Astrolabe Moon-Gravity + Hub Aura Ring
    //     4) 2 Valorant "Bind" True 1-Way Chasm Teleporters (Map-Wide Ping!)
    // ========================================================================

    // 1. Zelda: Tears of the Kingdom "Ascend" Vertical Ceiling-Phase Pillars
    {
      const ascendEmMat = new THREE.MeshBasicMaterial({
        color: 0x2df5a8,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ascendGoldMat = new THREE.MeshBasicMaterial({
        color: 0xffd658,
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ascendPhaseMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({
        color: 0x3ef8b2,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }));
      const padGeo = new THREE.CylinderGeometry(1.12, 1.24, 0.08, 8);
      const innerSigilGeo = new THREE.RingGeometry(0.50, 0.72, 8);
      const outerSigilGeo = new THREE.RingGeometry(0.80, 0.98, 8);
      const riseRingGeo = new THREE.TorusGeometry(0.76, 0.032, 6, 8);

      for (const a of ASCEND_ARCHES) {
        const riseH = a.toY - a.fromY;

        // Ground shrine octagon pad
        const gPad = new THREE.Mesh(padGeo, sm.travertine);
        gPad.position.set(a.x, a.fromY + 0.02, a.z);
        gPad.receiveShadow = true;
        gPad.userData.ground = true;
        root.add(gPad);

        const gSigilIn = new THREE.Mesh(innerSigilGeo, ascendEmMat);
        gSigilIn.rotation.x = -PI * 0.5;
        gSigilIn.position.set(a.x, a.fromY + 0.068, a.z);
        const gSigilOut = new THREE.Mesh(outerSigilGeo, ascendGoldMat);
        gSigilOut.rotation.x = -PI * 0.5;
        gSigilOut.position.set(a.x, a.fromY + 0.070, a.z);
        root.add(gSigilIn, gSigilOut);

        // Supporting carved stone arch pillars + colliders
        const pilH = Math.max(1.2, riseH - 0.58);
        for (const [px, pz] of a.pillars) {
          const base = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.22, 0.64, 0.04, 1), sm.travertineDark);
          base.position.set(px, a.fromY + 0.11, pz);
          base.castShadow = true;
          base.receiveShadow = true;
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, pilH, 10), sm.travertine);
          col.position.set(px, a.fromY + 0.22 + pilH * 0.5, pz);
          col.castShadow = true;
          col.receiveShadow = true;
          const cap = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.18, 0.58, 0.04, 1), sm.travertineWarm);
          cap.position.set(px, a.toY - 0.48, pz);
          cap.castShadow = true;
          root.add(base, col, cap);
          if (ctx.addWorldObb) {
            ctx.addWorldObb(px, pz, 0.34, 0.34, 0, a.fromY - 0.2, a.toY);
          }
        }

        // Overhead Walkable Upper Sanctuary Deck (`userData.ground = true`)
        const deckSlab = new THREE.Mesh(
          new RoundedBoxGeometry(a.deckHx * 2.0, 0.44, a.deckHz * 2.0, 0.06, 1),
          sm.travertine
        );
        deckSlab.position.set(a.x, a.toY - 0.22, a.z);
        deckSlab.castShadow = true;
        deckSlab.receiveShadow = true;
        deckSlab.userData.ground = true;
        root.add(deckSlab);

        const deckRim = new THREE.Mesh(
          new RoundedBoxGeometry(a.deckHx * 2.08, 0.10, a.deckHz * 2.08, 0.03, 1),
          sm.travertineDark
        );
        deckRim.position.set(a.x, a.toY - 0.41, a.z);
        root.add(deckRim);

        // Glowing emerald-gold underside ceiling Ascend target medallion
        const ceilIn = new THREE.Mesh(innerSigilGeo, ascendEmMat);
        ceilIn.rotation.x = PI * 0.5;
        ceilIn.position.set(a.x, a.toY - 0.46, a.z);
        const ceilOut = new THREE.Mesh(outerSigilGeo, ascendGoldMat);
        ceilOut.rotation.x = PI * 0.5;
        ceilOut.position.set(a.x, a.toY - 0.465, a.z);
        root.add(ceilIn, ceilOut);

        // 3 animated upward-flowing glowing emerald-gold rune rings (MeshBasicMaterial, no PointLights)
        const rings = [];
        for (let r = 0; r < 3; r++) {
          const rm = new THREE.Mesh(riseRingGeo, ascendPhaseMats[r]);
          rm.rotation.x = PI * 0.5;
          rm.position.set(a.x, a.fromY + 0.35, a.z);
          rm.userData.keep = true;
          root.add(rm);
          rings.push(rm);
        }
        WORLD_STATE.ascendVis.push({
          x: a.x,
          z: a.z,
          y0: a.fromY + 0.16,
          y1: a.toY - 0.52,
          rings,
        });

        // Walkable Stone Staircase Around for Seekers
        const st = a.stair;
        const sdx = st.x1 - st.x0, sdz = st.z1 - st.z0, sdy = st.y1 - st.y0;
        const slen = Math.hypot(sdx, sdz);
        const syaw = Math.atan2(sdx, sdz);
        const nSteps = Math.max(9, Math.ceil(slen / 0.34));
        const stGrp = new THREE.Group();
        for (let k = 0; k <= nSteps; k++) {
          const t = k / nSteps;
          const sx = st.x0 + sdx * t;
          const sz = st.z0 + sdz * t;
          const sy = st.y0 + sdy * t;
          const hStep = Math.max(0.24, sy - st.y0 + 0.24);
          const riser = new THREE.Mesh(
            new RoundedBoxGeometry(st.halfW * 1.94, hStep, (slen / nSteps) * 1.28, 0.03, 1),
            k % 2 === 0 ? sm.travertine : sm.travertineWarm
          );
          riser.position.set(sx, sy - hStep * 0.5, sz);
          riser.rotation.y = syaw;
          riser.castShadow = true;
          riser.receiveShadow = true;
          riser.userData.ground = true;
          stGrp.add(riser);
        }
        mergeStatic(THREE, stGrp);
        root.add(stGrp);

        WORLD_STATE.ascendSpots.push({
          id: a.id,
          kind: 'ride_path',
          icon: '🟢',
          label: a.label,
          fromX: a.x,
          fromY: a.fromY,
          fromZ: a.z,
          toX: a.x,
          toY: a.toY,
          toZ: a.z,
          arcY: 0,
          dur: 0.65,
          enterHint: '🟢 Ascend! Phasing vertically up through the stone ceiling!',
        });
      }
    }

    // 2. Super Mario Galaxy Spinning 5-Point Golden "Launch-Star" Ring Slingers
    {
      const starShape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - PI * 0.5;
        const rad = i % 2 === 0 ? 0.56 : 0.24;
        const sx = Math.cos(a) * rad;
        const sy = Math.sin(a) * rad;
        if (i === 0) starShape.moveTo(sx, sy);
        else starShape.lineTo(sx, sy);
      }
      starShape.closePath();
      const starGeo = new THREE.ExtrudeGeometry(starShape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.035,
        bevelSegments: 2,
      });
      starGeo.center();

      const goldStarMat = new THREE.MeshStandardMaterial({
        color: 0xffd542,
        emissive: 0xd47e08,
        emissiveIntensity: 0.78,
        roughness: 0.24,
        metalness: 0,
      });
      const slingRingMat = new THREE.MeshBasicMaterial({
        color: 0xffe47a,
        transparent: true,
        opacity: 0.86,
      });
      const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xfff3a8 });
      const plinthGeo = new THREE.CylinderGeometry(1.06, 1.24, 0.14, 10);
      const floorRingGeo = new THREE.RingGeometry(0.72, 1.02, 20);
      const slingTorusGeo = new THREE.TorusGeometry(0.92, 0.052, 8, 24);
      const sparkleGeo = new THREE.OctahedronGeometry(0.085, 0);
      const burstRingGeo = new THREE.RingGeometry(0.45, 1.15, 22);

      for (let i = 0; i < LAUNCH_STAR_SPECS.length; i++) {
        const ls = LAUNCH_STAR_SPECS[i];
        const aimYaw = Math.atan2(ls.toX - ls.fromX, ls.toZ - ls.fromZ);

        const dais = new THREE.Mesh(plinthGeo, sm.travertine);
        dais.position.set(ls.fromX, ls.fromY + 0.05, ls.fromZ);
        dais.receiveShadow = true;
        dais.userData.ground = true;
        root.add(dais);

        const floorGlow = new THREE.Mesh(floorRingGeo, slingRingMat);
        floorGlow.rotation.x = -PI * 0.5;
        floorGlow.position.set(ls.fromX, ls.fromY + 0.13, ls.fromZ);
        root.add(floorGlow);

        const rig = new THREE.Group();
        rig.position.set(ls.fromX, ls.fromY + 1.28, ls.fromZ);
        rig.rotation.y = aimYaw;
        rig.userData.keep = true;

        const starMesh = new THREE.Mesh(starGeo, goldStarMat);
        starMesh.userData.keep = true;
        rig.add(starMesh);

        const slingRing = new THREE.Mesh(slingTorusGeo, slingRingMat);
        slingRing.rotation.x = 0.52;
        slingRing.userData.keep = true;
        rig.add(slingRing);

        const orbiterGrp = new THREE.Group();
        orbiterGrp.userData.keep = true;
        for (let k = 0; k < 5; k++) {
          const ka = (k / 5) * TAU;
          const sp = new THREE.Mesh(sparkleGeo, sparkleMat);
          sp.position.set(Math.cos(ka) * 1.04, Math.sin(ka * 2) * 0.16, Math.sin(ka) * 1.04);
          orbiterGrp.add(sp);
        }
        rig.add(orbiterGrp);
        root.add(rig);

        const burstMat = new THREE.MeshBasicMaterial({
          color: 0xffe478,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const burstMesh = new THREE.Mesh(burstRingGeo, burstMat);
        burstMesh.rotation.x = -PI * 0.5;
        burstMesh.position.set(ls.fromX, ls.fromY + 0.45, ls.fromZ);
        burstMesh.visible = false;
        burstMesh.userData.keep = true;
        root.add(burstMesh);

        WORLD_STATE.launchStars.push({
          ...ls,
          kind: 'ride_path',
          icon: '⭐',
        });
        WORLD_STATE.launchStarVis.push({
          rig,
          starMesh,
          slingRing,
          orbiterGrp,
          burstMesh,
          burstMat,
          baseY: ls.fromY + 1.28,
          phase: i * 1.4,
          burst: 0,
        });
      }
    }

    // 3. Upgraded Shootable + Interactable Central Astrolabe Moon-Gravity Console + Hub Sky Aura Ring
    {
      const astroGrp = new THREE.Group();
      astroGrp.position.set(ASTROLABE_POS.x, ASTROLABE_POS.y, ASTROLABE_POS.z);
      astroGrp.userData.keep = true;

      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 1.08, 12), sm.travertine);
      ped.position.y = 0.54;
      ped.castShadow = true;
      ped.receiveShadow = true;

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.10, 12), sm.travertineDark);
      collar.position.y = 1.08;

      const outerRingMat = new THREE.MeshStandardMaterial({
        color: 0xf4c652,
        emissive: 0x6b4208,
        emissiveIntensity: 0.35,
        roughness: 0.35,
        metalness: 0,
      });
      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.048, 8, 24), outerRingMat);
      outerRing.position.set(0, 1.56, 0);
      outerRing.userData.keep = true;

      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.042, 8, 20), sm.cyanCrystal);
      innerRing.position.set(0, 1.56, 0);
      innerRing.userData.keep = true;

      const moonOrbMat = new THREE.MeshBasicMaterial({ color: 0x9ef6ff });
      const astroOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), moonOrbMat);
      astroOrb.position.set(0, 1.56, 0);
      astroOrb.userData.keep = true;

      const hitShellMat = new THREE.MeshBasicMaterial({
        color: 0x9ef6ff,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      const hitShell = new THREE.Mesh(new THREE.SphereGeometry(0.64, 12, 10), hitShellMat);
      hitShell.position.set(0, 1.56, 0);
      hitShell.userData.keep = true;

      astroGrp.add(ped, collar, outerRing, innerRing, astroOrb, hitShell);
      astroGrp.traverse((m) => {
        if (m.isMesh) {
          m.userData._skyAstrolabe = true;
          m.userData.keep = true;
          if (ctx.solids && !ctx.solids.includes(m)) ctx.solids.push(m);
        }
      });
      root.add(astroGrp);
      if (ctx.addWorldObb) {
        ctx.addWorldObb(ASTROLABE_POS.x, ASTROLABE_POS.z, 0.44, 0.44, 0, ASTROLABE_POS.y, ASTROLABE_POS.y + 2.1);
      }

      WORLD_STATE.moonRingMesh = outerRing;
      WORLD_STATE.astroOrbMesh = innerRing;

      // Pulsing pale-aqua Moon-Gravity Sky Aura Ring surrounding Central Hub!
      const auraGrp = new THREE.Group();
      auraGrp.position.set(0.0, Y_HUB + 0.48, 1.2);
      auraGrp.visible = false;
      auraGrp.userData.keep = true;
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0x9ef6ff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const auraTorus = new THREE.Mesh(new THREE.TorusGeometry(11.6, 0.13, 6, 48), auraMat);
      auraTorus.rotation.x = PI * 0.5;
      const auraDiscRing = new THREE.Mesh(new THREE.RingGeometry(10.7, 12.1, 48), auraMat);
      auraDiscRing.rotation.x = -PI * 0.5;
      auraGrp.add(auraTorus, auraDiscRing);
      root.add(auraGrp);
      WORLD_STATE.moonAuraMesh = { grp: auraGrp, mat: auraMat };

      WORLD_STATE.mechSpots.push({
        id: 'mech_astrolabe_moon',
        kind: 'mechanism',
        icon: '🌙',
        baseLabel: 'Invert Moon-Gravity Astrolabe',
        label: 'Invert Moon-Gravity Astrolabe',
        x: ASTROLABE_POS.x,
        y: ASTROLABE_POS.y,
        z: ASTROLABE_POS.z,
        trigR: 2.45,
        cdUntil: 0,
      });
    }

    // 4. 2 Valorant "Bind" True 1-Way Chasm Teleporters (`North Shrine -> Hub Overlook`, `SE Courtyard -> NW Sanctuary`)
    {
      const entryFrameMat = (hex) => new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      for (const pc of BIND_PORTALS) {
        const pg = new THREE.Group();
        pg.position.set(pc.x, pc.y, pc.z);
        pg.userData.keep = true;

        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.26, 0.10, 14), sm.travertine);
        plinth.position.y = 0.05;
        plinth.receiveShadow = true;
        plinth.userData.ground = true;
        pg.add(plinth);

        const padMat = entryFrameMat(pc.color);
        const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.96, 20), padMat);
        floorRing.rotation.x = -PI * 0.5;
        floorRing.position.y = 0.11;
        floorRing.userData.keep = true;
        pg.add(floorRing);

        let spinRing = null;
        if (!pc.isExit) {
          // Active 1-Way Entry Gate Archway
          for (const sx of [-1, 1]) {
            const pil = new THREE.Mesh(new RoundedBoxGeometry(0.24, 1.95, 0.24, 0.04, 1), sm.travertineDark);
            pil.position.set(sx * 1.06, 0.98, 0);
            pil.castShadow = true;
            pg.add(pil);
          }
          const doorRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.085, 8, 22), padMat);
          doorRing.position.y = 1.35;
          doorRing.userData.keep = true;
          const innerSwirl = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.82, 18), padMat);
          innerSwirl.position.y = 1.35;
          innerSwirl.userData.keep = true;
          pg.add(doorRing, innerSwirl);
          spinRing = innerSwirl;
        }
        root.add(pg);
        WORLD_STATE.portals.registerPortal({ ...pc, group: pg });
        WORLD_STATE.portalVis.push({ pc, pg, floorRing, padMat, spinRing, pulse: 0 });
      }
    }

    // ========================================================================
    // 9. AMBIENT STORYBOOK ANIMATIONS & LIVE ORBITING PLATFORM UPDATES!
    // ========================================================================
    let elapsed = 0;
    const _m4 = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3();

    return {
      turret: null,
      dispose() {
        if (WORLD_STATE.creatures) {
          WORLD_STATE.creatures.dispose();
          WORLD_STATE.creatures = null;
        }
        WORLD_STATE.turret = null;
        WORLD_STATE.ascendSpots = [];
        WORLD_STATE.ascendVis = [];
        WORLD_STATE.ascendTrack = new WeakMap();
        WORLD_STATE.launchStars = [];
        WORLD_STATE.launchStarVis = [];
        WORLD_STATE.interactSpots = [];
        WORLD_STATE.mechSpots = [];
        WORLD_STATE.portalCdSnap = new WeakMap();
        WORLD_STATE.portalVis = [];
        WORLD_STATE.portals = null;
        WORLD_STATE.moonRingMesh = null;
        WORLD_STATE.moonAuraMesh = null;
        WORLD_STATE.astroOrbMesh = null;
      },
      update(dt = 0.016, _now, G) {
        const step = clamp(dt || 0.016, 0, 0.08);
        elapsed += step;
        WORLD_STATE.orbitElapsed = elapsed;
        const nowSec = performance.now() * 0.001;

        if (WORLD_STATE.creatures && dt > 0) {
          WORLD_STATE.creatures.update(step, elapsed);
        }

        // Bind 1-Way Chasm Teleporters: detect newly teleported actors & fire map-wide crystal ping!
        const actors = ctx.getActors ? ctx.getActors() : [];
        if (WORLD_STATE.portals) {
          for (let i = 0; i < actors.length; i++) {
            const ch = actors[i];
            if (ch && ch.userData) {
              WORLD_STATE.portalCdSnap.set(ch, ch.userData._portalCdUntil || 0);
            }
          }
          WORLD_STATE.portals.update(step, elapsed, G);
          for (let i = 0; i < actors.length; i++) {
            const ch = actors[i];
            if (!ch || !ch.userData) continue;
            const prevCd = WORLD_STATE.portalCdSnap.get(ch) || 0;
            const curCd = ch.userData._portalCdUntil || 0;
            if (curCd > prevCd) {
              WORLD_STATE.portalCdSnap.set(ch, curCd);
              let dst = null;
              let bestD = Infinity;
              for (const pv of WORLD_STATE.portalVis) {
                if (!pv.pc.isExit) continue;
                const d = Math.hypot(ch.position.x - (pv.pc.x + 0.65), ch.position.z - (pv.pc.z + 0.65));
                if (d < bestD) {
                  bestD = d;
                  dst = pv;
                }
              }
              if (dst) {
                dst.pulse = 1.0;
                if (WORLD_STATE.emitSoundCue) {
                  WORLD_STATE.emitSoundCue({ x: dst.pc.x, y: dst.pc.y + 0.6, z: dst.pc.z }, 26, 'taunt', ch);
                }
                playBindPortalChord(WORLD_STATE.audio);
                if (WORLD_STATE.notify) {
                  WORLD_STATE.notify(`🔔 Arcane Rift Pinged at ${dst.pc.label}!`, 1900);
                }
              }
            }
          }
        }

        // Animate 2 Bind Portal rings & arrival pulses
        for (let i = 0; i < WORLD_STATE.portalVis.length; i++) {
          const pv = WORLD_STATE.portalVis[i];
          if (pv.spinRing) pv.spinRing.rotation.z = elapsed * 1.8;
          if (pv.pulse > 0) {
            pv.pulse = Math.max(0, pv.pulse - step * 1.8);
            const sc = 1.0 + (1.0 - pv.pulse) * 0.65;
            pv.floorRing.scale.setScalar(sc);
            pv.padMat.opacity = 0.52 + pv.pulse * 0.48;
          } else {
            pv.floorRing.scale.setScalar(1.0);
            pv.padMat.opacity = pv.pc.isExit ? 0.45 : 0.84;
          }
        }

        // Track Ascend Phase-Up takeoffs & roof emergences for emerald-gold bursts + audio
        for (let i = 0; i < actors.length; i++) {
          const ch = actors[i];
          if (!ch || !ch.userData) continue;
          const prevAsc = WORLD_STATE.ascendTrack.get(ch) || null;
          const rp = ch.userData.ridePath;
          const isAsc = Boolean(
            rp &&
            rp.arcY === 0 &&
            Math.abs((rp.dur || 0) - 0.65) < 0.03 &&
            Math.hypot((rp.x1 || 0) - (rp.x0 || 0), (rp.z1 || 0) - (rp.z0 || 0)) < 0.05
          );
          if (!prevAsc && isAsc) {
            playAscendPhaseAudio(WORLD_STATE.audio);
            if (WORLD_STATE.splash) {
              WORLD_STATE.splash(new Vector3(rp.x0, rp.y0 + 0.85, rp.z0), 22, 2.6);
            }
          } else if (prevAsc && !isAsc) {
            if (WORLD_STATE.splash) {
              WORLD_STATE.splash(new Vector3(prevAsc.x1, prevAsc.y1 + 0.55, prevAsc.z1), 24, 2.8);
            }
          }
          WORLD_STATE.ascendTrack.set(ch, isAsc ? { x1: rp.x1, y1: rp.y1, z1: rp.z1 } : null);
        }

        // Animate Ascend Shrine emerald-gold upward rune rings
        for (let i = 0; i < WORLD_STATE.ascendVis.length; i++) {
          const av = WORLD_STATE.ascendVis[i];
          for (let r = 0; r < av.rings.length; r++) {
            const prog = (elapsed * 0.85 + r / 3) % 1;
            const ring = av.rings[r];
            ring.position.y = av.y0 + (av.y1 - av.y0) * prog;
            const sc = 0.88 + Math.sin(prog * PI) * 0.24;
            ring.scale.setScalar(sc);
            ring.rotation.z = elapsed * (r % 2 === 0 ? 1.4 : -1.1);
            if (i === 0) {
              ring.material.opacity = Math.sin(prog * PI) * 0.85;
            }
          }
        }

        // Animate 4 Mario Galaxy Launch-Star Sling Rings & Golden Burst Rings
        for (let i = 0; i < WORLD_STATE.launchStarVis.length; i++) {
          const vis = WORLD_STATE.launchStarVis[i];
          vis.rig.position.y = vis.baseY + Math.sin(elapsed * 2.2 + vis.phase) * 0.14;
          vis.starMesh.rotation.y = elapsed * 1.9 + vis.phase;
          vis.slingRing.rotation.z = elapsed * 2.4;
          vis.orbiterGrp.rotation.y = -elapsed * 2.8;
          if (vis.burst > 0) {
            vis.burst = Math.max(0, vis.burst - step * 2.4);
            vis.burstMesh.visible = true;
            vis.burstMesh.scale.setScalar(1.0 + (1.0 - vis.burst) * 1.6);
            vis.burstMat.opacity = vis.burst * 0.90;
          } else {
            vis.burstMesh.visible = false;
          }
        }

        // Animate Moon-Gravity Central Astrolabe & Hub Pale-Aqua Sky Aura Ring
        const moonActive = nowSec < WORLD_STATE.moonGravUntil;
        if (WORLD_STATE.moonRingMesh) {
          WORLD_STATE.moonRingMesh.rotation.y += step * (moonActive ? 3.6 : 0.85);
          WORLD_STATE.moonRingMesh.rotation.x = Math.sin(elapsed * (moonActive ? 3.1 : 1.0)) * 0.55;
        }
        if (WORLD_STATE.astroOrbMesh) {
          WORLD_STATE.astroOrbMesh.rotation.y -= step * (moonActive ? 4.4 : 1.25);
          WORLD_STATE.astroOrbMesh.rotation.z = Math.cos(elapsed * (moonActive ? 3.5 : 1.2)) * 0.65;
        }
        if (WORLD_STATE.moonAuraMesh) {
          if (moonActive) {
            WORLD_STATE.moonAuraMesh.grp.visible = true;
            WORLD_STATE.moonAuraMesh.grp.rotation.y = elapsed * 0.55;
            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.4);
            WORLD_STATE.moonAuraMesh.mat.opacity = 0.28 + pulse * 0.30;
            WORLD_STATE.moonAuraMesh.grp.scale.setScalar(1.0 + pulse * 0.03);
          } else {
            WORLD_STATE.moonAuraMesh.grp.visible = false;
          }
        }

        // 1. Update 6 Orbiting Ancient Rune-Stone Platforms (with prevX/prevZ delta tracking!)
        for (const pl of WORLD_STATE.orbitPlatforms) {
          pl.prevX = pl.x;
          pl.prevZ = pl.z;
          pl.angle += pl.speed * step;
          pl.x = pl.cx + Math.cos(pl.angle) * pl.orbitR;
          pl.z = pl.cz + Math.sin(pl.angle) * pl.orbitR;
          pl.y = pl.baseY + Math.sin(elapsed * 1.15 + pl.phase) * pl.ampY;
          pl.mesh.position.set(pl.x, pl.y, pl.z);
          pl.mesh.rotation.y = -pl.angle;
        }

        // 2. Update 8 Counter-Orbiting Floating Celestia Rubble Stones
        for (const rb of WORLD_STATE.orbitRubble) {
          rb.angle += rb.speed * step;
          rb.x = rb.cx + Math.cos(rb.angle) * rb.orbitR;
          rb.z = rb.cz + Math.sin(rb.angle) * rb.orbitR;
          rb.y = rb.baseY + Math.sin(elapsed * 1.6 + rb.phase) * 0.22;
          rb.rot = -rb.angle + elapsed * 0.4;
          rb.mesh.position.set(rb.x, rb.y, rb.z);
          rb.mesh.rotation.set(Math.sin(elapsed + rb.phase) * 0.2, rb.rot, 0);
        }

        // 3. Central Skyglass Crystal + 3 Interlocking Rune Rings
        if (crystalGrp) {
          crystalGrp.position.y = (crystalGrp.userData?.baseY ?? 2.65) + Math.sin(elapsed * 1.7) * 0.22;
          crystalGrp.rotation.y = elapsed * 0.62;
        }
        if (ring1Grp) {
          ring1Grp.rotation.y = elapsed * 0.52;
          ring1Grp.rotation.x = 0.44 + Math.sin(elapsed * 0.7) * 0.12;
        }
        if (ring2Grp) {
          ring2Grp.rotation.y = -elapsed * 0.76;
          ring2Grp.rotation.z = -0.36 + Math.cos(elapsed * 0.85) * 0.14;
        }
        if (ring3Grp) {
          ring3Grp.rotation.y = elapsed * 0.38;
          ring3Grp.rotation.x = -0.52 + Math.cos(elapsed * 0.6) * 0.10;
        }

        // 4. Spinning Sky-Pirate Hangar Windvane & Bobbing Moored Dragonfly Ornithopter
        if (hangarWindvane) {
          hangarWindvane.rotation.z = elapsed * 2.4;
        }
        if (mooredOrnithopter) {
          mooredOrnithopter.position.y = (mooredOrnithopter.userData?.baseY ?? 0.95) + Math.sin(elapsed * 1.5) * 0.14;
          mooredOrnithopter.rotation.z = Math.sin(elapsed * 1.1) * 0.04;
        }
        if (ornithopterWingL) ornithopterWingL.rotation.z = -0.06 - Math.sin(elapsed * 2.3) * 0.11;
        if (ornithopterWingR) ornithopterWingR.rotation.z = 0.06 + Math.sin(elapsed * 2.3) * 0.11;

        // 5. Swirling Wind Updraft Plinth Ribbons
        for (let i = 0; i < updraftSwirls.length; i++) {
          updraftSwirls[i].rotation.y = elapsed * 2.8 + i;
        }

        // 6. Satellite Floating Islets, Billowing Cloud Sea, Waterfalls & Clover Grass
        for (const isl of islets) {
          isl.g.position.y = isl.baseY + Math.sin(elapsed * 0.9 + isl.phase) * 0.24;
        }
        for (let i = 0; i < CLOUD_N; i++) {
          const cd = cloudData[i];
          _p.set(
            cd.x + Math.sin(elapsed * 0.18 + cd.ph) * 1.8,
            cd.y + Math.sin(elapsed * 0.55 + cd.ph) * 0.25,
            cd.z + Math.cos(elapsed * 0.15 + cd.ph) * 1.4
          );
          _s.set(cd.sx, cd.sy, cd.sz);
          _m4.compose(_p, _q, _s);
          cloudInst.setMatrixAt(i, _m4);
        }
        cloudInst.instanceMatrix.needsUpdate = true;

        for (const wf of wfMeshes) {
          const pulse = 1.0 + Math.sin(elapsed * 3.8 + wf.ph) * 0.12;
          wf.mist.scale.set(1.3 * pulse, 0.65 * pulse, 1.3 * pulse);
        }

        poolWater.update(elapsed);
        grass.update(elapsed);
      },
    };
  },
};
