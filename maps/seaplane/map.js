/* Hue & Seek — Map 3: Porto Sereno Seaplane Cove (`maps/seaplane/map.js`).
 * 3-Tier storybook Mediterranean cliffside harbor stepping down into an
 * open swimmable turquoise Adriatic bay:
 *   - Tier 3 (`y = 4.20m`, north cliff `z in [-26.2, -12.0]`): Harbor Lighthouse with sweeping
 *     "Gamer" Searchlight beam, Coastal Gelateria, belvedere balustrades & cliff flower-ledges.
 *   - Tier 2 (`y = 2.10m`, central piazzetta `z in [-12.0, +4.5]`): Compass-rose mosaic square,
 *     spouting Seahorse Fountain, Trattoria Bella Vista (w/ Sparking Clifftop Power Breaker), & staircases.
 *   - Tier 1 (`y = 0.75m`, harbor quay & piers `z in [4.5, 19.5]`): Gabbiano Seaplane Hangar,
 *     Fisherman Boathouse, West/East wooden piers w/ seaward step-ramps, & East Pier Crimson Harbor Cannon.
 *   - Swimmable Turquoise Bay (`y = -0.32m`): Moored Cream-and-Teal Gabbiano Twin-Prop Mail Floatplane (slipstream
 *     wind corridor!), 2 Steerable Pilotable Wooden Rowboats, Sea-Caves, & mobile Sea-Float Disguises.
 */
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
import { PROPS, PROP_ICONS, buildMapProps, buildCustomDisguiseMesh } from './props.js?v=v10';
import { SEEKER_DEFS, HIDER_DEF, buildMapSeeker, buildMapHider } from './characters.js?v=2';
import { BUILDING_DEFS, buildBuildings } from './buildings.js?v=2';
import {
  createCreatureFleetController,
  createMatCache,
  createMovingTrackSystem,
  playTurretFireAudio,
  playWorldMechAudio,
} from '../world_interactives.js?v=v10';

const PI = Math.PI;
const TAU = PI * 2;
let _THREE = null;
const SEA_WORLD_STATE = {
  creatures: null,
  tracks: null,
  skiffs: [],
  mechSpots: [],
  geysers: [],
  geyserCooldowns: new WeakMap(),
  slipstreamCooldowns: new WeakMap(),
  pendingCannonLaunches: new WeakMap(),
  cannonCooldowns: new WeakMap(),
  spotlightCueMap: new WeakMap(),
  boatObstacles: [],
  beaconBlindedUntil: -1,
  lighthouseTheta: 0,
  propBlastUntil: -1,
  cannonRecoil: 0,
  beaconBeam: null,
  beaconSubCones: [],
  slipstreamGroup: null,
  breakerVisual: null,
  cannonPivot: null,
  cannonBarrel: null,
  whereIs: null,
  splash: null,
  spawnPuff: null,
  notify: null,
  emitSoundCue: null,
  audio: null,
};

// ============================================================================
// Elevation Constants & Analytical 3-Tier + Pier + Ramp + Rowboat Geometry
// ============================================================================
export const Y_SEA = -0.32;
export const Y_T1 = 0.75;
export const Y_T2 = 2.10;
export const Y_T3 = 4.20;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Staircases & Water Ramps (`z0 -> z1` interpolates `y0 -> y1`)
const STAIRS_T3_T2 = [
  { id: 's2w', x0: -6.8, x1: -3.0, z0: -12.0, z1: -7.8, y0: Y_T3, y1: Y_T2 }, // width 3.8m
  { id: 's2e', x0: 3.0, x1: 6.8, z0: -12.0, z1: -7.8, y0: Y_T3, y1: Y_T2 },   // width 3.8m
];

const STAIRS_T2_T1 = [
  { id: 's1w', x0: -10.8, x1: -7.0, z0: 2.3, z1: 5.5, y0: Y_T2, y1: Y_T1 },   // width 3.8m
  { id: 's1e', x0: 7.0, x1: 10.8, z0: 2.3, z1: 5.5, y0: Y_T2, y1: Y_T1 },     // width 3.8m
];

// Pier footprints (`y = 0.75m`) & attached wooden water step-ramps (`0.75m -> -0.32m`)
const PIER_WEST = { x: -6.2, z: 13.8, w: 4.2, len: 10.8, x0: -8.3, x1: -4.1, z0: 8.4, z1: 19.2 };
const PIER_EAST = { x: 6.4, z: 13.6, w: 4.2, len: 10.4, x0: 4.3, x1: 8.5, z0: 8.4, z1: 18.8 };

const WATER_RAMPS = [
  // Central harbor stone steps right between the two piers (`width = 4.4m`)
  { id: 'ramp_center', x0: -2.2, x1: 2.2, z0: 6.2, z1: 9.4, y0: Y_T1, y1: Y_SEA, surface: 'stone' },
  // West seaplane stone slipway leading out to the Gabbiano Mail Floatplane (`width = 3.1m`)
  { id: 'ramp_west_slip', x0: -11.6, x1: -8.5, z0: 8.2, z1: 11.5, y0: Y_T1, y1: Y_SEA, surface: 'stone' },
  // East fisherman boat slipway (`width = 3.0m`)
  { id: 'ramp_east_beach', x0: 8.6, x1: 11.6, z0: 8.2, z1: 11.5, y0: Y_T1, y1: Y_SEA, surface: 'stone' },
  // West Wooden Pier seaward step-ramp (`width = 2.65m`)
  { id: 'ramp_west_pier', x0: -7.52, x1: -4.88, z0: 19.15, z1: 22.15, y0: Y_T1, y1: Y_SEA, surface: 'wood' },
  // East Wooden Pier seaward step-ramp (`width = 2.65m`)
  { id: 'ramp_east_pier', x0: 5.08, x1: 7.72, z0: 18.75, z1: 21.75, y0: Y_T1, y1: Y_SEA, surface: 'wood' },
];

// Live Steerable Harbor Rowboats state (populated in `buildWorld`, updated in `handleCustomMotion` & `update`)
let DRIFT_ROWBOATS = [];

// Porto Sereno Iconic Coastal/Naval Mechanic Constants
const BREAKER_POS = { x: -13.2, y: Y_T2, z: 0.56, trigZ: 1.05, trigR: 2.65 };
const CANNON_POS = { x: 7.35, y: Y_T1, z: 14.4, trigR: 2.75 };
const CANNON_TARGETS = {
  cliff_terrace: {
    id: 'cliff_terrace',
    x: 1.4,
    y: Y_T3,
    z: -15.0,
    label: 'Blast Cannon → Cliffside Terrace! (G)',
    hintMsg: '💣 BOOM! Hurled sky-high across Porto Sereno onto the Cliffside Villa Terrace!',
  },
  savoia_pier: {
    id: 'savoia_pier',
    x: -6.0,
    y: Y_T1,
    z: 14.5,
    label: 'Blast Cannon → Gabbiano Pier! (G)',
    hintMsg: '💣 BOOM! Hurled across the cove straight onto Gabbiano Pier!',
  },
};
const SEAPLANE_POS = { x: -12.6, y: -0.26, z: 16.4, rot: 0.78 };
const SLIPSTREAM_START = { x: -12.2, z: 16.0 };
const SLIPSTREAM_DIR = { x: 0.914, z: 0.406 };
const SLIPSTREAM_LEN = 18.5;
const SLIPSTREAM_HALF_W = 3.4;
const SEA_CAVES = [
  { cx: -17.0, cz: 19.8, r: 3.65 },
  { cx: 17.0, cz: 19.8, r: 3.65 },
];

const normAngle = (a) => {
  let x = a;
  while (x > PI) x -= TAU;
  while (x < -PI) x += TAU;
  return x;
};
const lerpAngle = (a, b, t) => a + normAngle(b - a) * clamp(t, 0, 1);

function isInsideSeaCave(x, z, y = Y_SEA) {
  if (y > 3.25) return false;
  for (let i = 0; i < SEA_CAVES.length; i++) {
    const c = SEA_CAVES[i];
    if (Math.hypot(x - c.cx, z - c.cz) <= c.r) return true;
  }
  return false;
}

// West Pier <-> Trattoria Overlook Cargo Crane Boomsling (`ride_path`)
const CRANE_SLINGS = [
  {
    id: 'sp_crane_up',
    icon: '🏗️',
    label: 'Ride Crane Sling → Piazza',
    fromX: -7.8,
    fromY: Y_T1,
    fromZ: 10.6,
    trigX: -7.8,
    trigZ: 10.6,
    toX: -12.6,
    toY: Y_T2,
    toZ: 1.8,
    dur: 1.25,
    arcY: 2.35,
    enterHint: '🏗️ Hoisted up the Harbor Cargo Crane onto Trattoria Tier 2!',
  },
  {
    id: 'sp_crane_down',
    icon: '🏗️',
    label: 'Ride Crane Sling → West Pier',
    fromX: -12.6,
    fromY: Y_T2,
    fromZ: 1.8,
    trigX: -12.6,
    trigZ: 1.8,
    toX: -7.8,
    toY: Y_T1,
    toZ: 10.6,
    dur: 1.15,
    arcY: 1.95,
    enterHint: '🏗️ Swung down the Cargo Crane directly onto the West Seaplane Pier!',
  },
];

// Static Custom Hiding Spots (Sea-Float Disguises + High Cliffside Balcony Flower Ledges)
const STATIC_CUSTOM_SPOTS = [
  // 1. Floating Sea Disguises (`mobile: true, speedMul: 0.68`)
  {
    id: 'sea_buoy_west',
    kind: 'custom_spot',
    spotType: 'sea_float',
    variant: 'buoy',
    icon: '🚨',
    label: 'Hide as Harbor Bell Buoy',
    leaveLabel: 'Pop Out of Buoy Disguise',
    disguiseLabel: 'Harbor Bell Buoy 🚨',
    x: -3.0,
    y: Y_SEA,
    z: 10.6,
    trigX: -3.0,
    trigZ: 10.6,
    trigY: Y_SEA,
    trigR: 2.25,
    groundY: Y_SEA,
    offsetY: 0.0,
    mobile: true,
    speedMul: 0.68,
    radius: 0.42,
    height: 0.92,
    hp: 80,
    enterHint: '🚨 Bobbing as a Harbor Bell Buoy! Drift/swim slowly with WASD or press G to pop out!',
    exitHint: 'Popped out of the Harbor Bell Buoy! 💦',
  },
  {
    id: 'sea_float_center',
    kind: 'custom_spot',
    spotType: 'sea_float',
    variant: 'glass_float',
    icon: '🫧',
    label: 'Hide as Glass Fishing Float',
    leaveLabel: 'Pop Out of Glass Float',
    disguiseLabel: 'Glass Fishing Float 🫧',
    x: -2.9,
    y: Y_SEA,
    z: 16.8,
    trigX: -2.9,
    trigZ: 16.8,
    trigY: Y_SEA,
    trigR: 2.25,
    groundY: Y_SEA,
    offsetY: 0.0,
    mobile: true,
    speedMul: 0.68,
    radius: 0.40,
    height: 0.68,
    hp: 75,
    enterHint: '🫧 Floating as a Turquoise Glass Fishing Float! Swim slowly with WASD or press G to leave!',
    exitHint: 'Popped out of the Glass Fishing Float! 💦',
  },
  {
    id: 'sea_crate_east',
    kind: 'custom_spot',
    spotType: 'sea_float',
    variant: 'crate',
    icon: '📦',
    label: 'Hide as Floating Gabbiano Crate',
    leaveLabel: 'Pop Out of Supply Crate',
    disguiseLabel: 'Floating Gabbiano Crate 📦',
    x: 3.1,
    y: Y_SEA,
    z: 11.2,
    trigX: 3.1,
    trigZ: 11.2,
    trigY: Y_SEA,
    trigR: 2.25,
    groundY: Y_SEA,
    offsetY: 0.0,
    mobile: true,
    speedMul: 0.68,
    radius: 0.44,
    height: 0.68,
    hp: 85,
    enterHint: '📦 Bobbing as a Gabbiano Supply Crate! Drift slowly with WASD or press G to pop out!',
    exitHint: 'Popped out of the Floating Gabbiano Crate! 💦',
  },
  // 3. High Cliffside Balcony Terracotta Flower Ledges (perched outside Tier 3 cliff balconies!)
  {
    id: 'cliff_ledge_center',
    kind: 'custom_spot',
    spotType: 'balcony_ledge',
    variant: 'bougainvillea',
    icon: '🌺',
    label: 'Perch on Cliff Flower Ledge',
    leaveLabel: 'Step Back onto Cliff Terrace',
    disguiseLabel: 'Balcony Bougainvillea Planter 🌺',
    x: 0.0,
    y: Y_T3,
    z: -11.45,
    trigX: 0.0,
    trigZ: -12.45,
    trigY: Y_T3,
    trigR: 2.15,
    groundY: Y_T3,
    offsetY: -0.28,
    rot: 0,
    exitX: 0.0,
    exitZ: -12.75,
    exitY: Y_T3,
    radius: 0.44,
    height: 0.78,
    hp: 80,
    enterHint: '🌺 Perched outside the upper cliff balcony as a terracotta bougainvillea planter! (WASD or G to step back)',
    exitHint: 'Stepped safely back onto the Upper Cliff Terrace! 🌺',
  },
  {
    id: 'cliff_ledge_east',
    kind: 'custom_spot',
    spotType: 'balcony_ledge',
    variant: 'lemon_bougainvillea',
    icon: '🍋',
    label: 'Perch on Balcony Lemon Ledge',
    leaveLabel: 'Step Back onto Cliff Terrace',
    disguiseLabel: 'Cliff Balcony Lemon Planter 🍋',
    x: 13.2,
    y: Y_T3,
    z: -11.45,
    trigX: 13.2,
    trigZ: -12.45,
    trigY: Y_T3,
    trigR: 2.15,
    groundY: Y_T3,
    offsetY: -0.28,
    rot: 0,
    exitX: 13.2,
    exitZ: -12.75,
    exitY: Y_T3,
    radius: 0.44,
    height: 0.78,
    hp: 80,
    enterHint: '🍋 Perched outside the cliff balcony as a lemon & bougainvillea planter! (WASD or G to step back)',
    exitHint: 'Stepped safely back onto the Gelateria Cliff Terrace! 🍋',
  },
  // 4. Bioluminescent Swimmable Sea-Cave Floats inside West & East Blue Grottos
  {
    id: 'sea_grotto_west',
    kind: 'custom_spot',
    spotType: 'sea_float',
    variant: 'glass_float',
    icon: '🌊',
    label: 'Hide in Sea-Cave Grotto',
    leaveLabel: 'Exit Grotto Disguise',
    disguiseLabel: 'Sea-Cave Glass Float 🫧',
    x: -17.0,
    y: Y_SEA,
    z: 19.8,
    trigX: -17.0,
    trigZ: 19.8,
    trigY: Y_SEA,
    trigR: 2.5,
    groundY: Y_SEA,
    offsetY: 0.0,
    mobile: true,
    speedMul: 0.72,
    radius: 0.40,
    height: 0.68,
    hp: 80,
    enterHint: '🌊 Glowing softly inside the West Adriatic Sea-Cave! Swim silently or press G to pop out!',
    exitHint: 'Emerged inside the West Sea-Cave! 🫧',
  },
  {
    id: 'sea_grotto_east',
    kind: 'custom_spot',
    spotType: 'sea_float',
    variant: 'buoy',
    icon: '🌊',
    label: 'Hide in Blue Grotto Cave',
    leaveLabel: 'Exit Grotto Disguise',
    disguiseLabel: 'Grotto Bell Buoy 🚨',
    x: 17.0,
    y: Y_SEA,
    z: 19.8,
    trigX: 17.0,
    trigZ: 19.8,
    trigY: Y_SEA,
    trigR: 2.5,
    groundY: Y_SEA,
    offsetY: 0.0,
    mobile: true,
    speedMul: 0.72,
    radius: 0.42,
    height: 0.88,
    hp: 85,
    enterHint: '🌊 Tucked inside the East Blue Grotto Sea-Cave! Swim silently or press G to pop out!',
    exitHint: 'Emerged inside the East Sea-Cave! 💦',
  },
];

function isOnPierDeck(x, z) {
  return (
    (x >= PIER_WEST.x0 && x <= PIER_WEST.x1 && z >= PIER_WEST.z0 && z <= PIER_WEST.z1) ||
    (x >= PIER_EAST.x0 && x <= PIER_EAST.x1 && z >= PIER_EAST.z0 && z <= PIER_EAST.z1)
  );
}

function pointInRowboat(x, z, boat, pad = 1.0) {
  const dx = x - boat.x;
  const dz = z - boat.z;
  const c = Math.cos(-boat.rot);
  const s = Math.sin(-boat.rot);
  const lx = dx * c + dz * s;
  const lz = -dx * s + dz * c;
  const rx = 0.74 * pad;
  const rz = 1.76 * pad;
  return (lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) <= 1.0;
}

function sampleRowboatDeck(x, z, refY) {
  for (let i = 0; i < DRIFT_ROWBOATS.length; i++) {
    const b = DRIFT_ROWBOATS[i];
    if (pointInRowboat(x, z, b, 1.0)) {
      if (refY === undefined || (refY >= Y_SEA - 0.35 && refY <= b.deckY + 1.45)) {
        return b;
      }
    }
  }
  return null;
}

// Pure terrain height without dynamic rowboats
function sampleStaticTerrainHeight(x, z) {
  // 1. Tier 3 <-> Tier 2 staircases (`z in [-12.0, -7.8]`)
  for (let i = 0; i < STAIRS_T3_T2.length; i++) {
    const st = STAIRS_T3_T2[i];
    if (x >= st.x0 && x <= st.x1 && z >= st.z0 && z <= st.z1) {
      const t = clamp((z - st.z0) / (st.z1 - st.z0), 0, 1);
      return st.y0 + (st.y1 - st.y0) * t;
    }
  }

  // 2. Tier 3 Upper Limestone Cliff Terrace (`z <= -12.0`, plus flower corbel ledges)
  const inLedgeCorbel =
    (Math.abs(x - 0.0) <= 0.75 || Math.abs(x - 13.2) <= 0.75) && z >= -12.1 && z <= -11.15;
  if (inLedgeCorbel) return Y_T3;
  if (z <= -12.0 && x >= -23.5 && x <= 23.5 && z >= -28.5) {
    return Y_T3;
  }

  // 3. Tier 2 <-> Tier 1 staircases (`z in [2.3, 5.5]`)
  for (let i = 0; i < STAIRS_T2_T1.length; i++) {
    const st = STAIRS_T2_T1[i];
    if (x >= st.x0 && x <= st.x1 && z >= st.z0 && z <= st.z1) {
      const t = clamp((z - st.z0) / (st.z1 - st.z0), 0, 1);
      return st.y0 + (st.y1 - st.y0) * t;
    }
  }

  // 4. Tier 2 Mid Compass-Rose Piazzetta & Trattoria Terrace
  const t2SouthZ = Math.abs(x) <= 11.8 ? 4.5 : 2.8;
  if (z > -12.0 && z <= t2SouthZ && x >= -25.0 && x <= 25.0) {
    return Y_T2;
  }

  // 5. Water Ramps (`0.75m -> -0.32m`) — checked BEFORE flat Tier 1 so recessed slipways slope cleanly!
  for (let i = 0; i < WATER_RAMPS.length; i++) {
    const r = WATER_RAMPS[i];
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      const t = clamp((z - r.z0) / (r.z1 - r.z0), 0, 1);
      return r.y0 + (r.y1 - r.y0) * t;
    }
  }

  // 6. Walkable Wooden Harbor Piers (`y = 0.75m`)
  if (isOnPierDeck(x, z)) return Y_T1;

  // 7. Tier 1 Lower Harbor Quay (central promenade + West Hangar & East Boathouse wings)
  if (Math.abs(x) > 11.8 && Math.abs(x) <= 26.2 && z > 2.8 && z <= 15.0) {
    return Y_T1;
  }
  if (Math.abs(x) <= 11.8 && z > 4.5 && z <= 8.45) {
    // Central cove water indentation south of `ramp_center` (`z > 6.2` handled above for `|x| <= 2.2`)
    return Y_T1;
  }

  // 8. Open Swimmable Turquoise Adriatic Sea (`y = -0.32m`)
  return Y_SEA;
}

function canBoatOccupy(nx, nz, rot, selfBoat) {
  if (Math.hypot(nx, nz) > 28.4) return false;
  if (nz < 8.4) return false;
  const hullR = 0.90;
  // Sample center, 8 hull ring points, plus bow/stern extensions so the boat stays strictly in deep bay & sea-cave water!
  const sinR = Math.sin(rot);
  const cosR = Math.cos(rot);
  const checkPt = (px, pz) => {
    if (Math.hypot(px, pz) > 29.0) return false;
    if (sampleStaticTerrainHeight(px, pz) > Y_SEA + 0.06) return false;
    return true;
  };
  if (!checkPt(nx, nz)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    if (!checkPt(nx + Math.cos(a) * hullR, nz + Math.sin(a) * hullR)) return false;
  }
  for (const s of [-1.28, 1.28]) {
    if (!checkPt(nx + sinR * s, nz + cosR * s)) return false;
  }
  // Collide cleanly with rock shores, sea-cave back pillars, moored Gabbiano Mail Plane & scenic skiff
  const obs = SEA_WORLD_STATE.boatObstacles || [];
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    const minD = o.r + 0.88;
    if (Math.hypot(nx - o.x, nz - o.z) < minD) return false;
    for (const s of [-0.95, 0.95]) {
      if (Math.hypot(nx + sinR * s - o.x, nz + cosR * s - o.z) < o.r + 0.56) return false;
    }
  }
  // Collide cleanly with the other pilotable rowboat
  for (let i = 0; i < DRIFT_ROWBOATS.length; i++) {
    const other = DRIFT_ROWBOATS[i];
    if (other === selfBoat) continue;
    if (Math.hypot(nx - other.x, nz - other.z) < 1.85) return false;
  }
  return true;
}

export function sampleSeaplaneHeight(x, z, refY) {
  const trackY = SEA_WORLD_STATE.tracks
    ? SEA_WORLD_STATE.tracks.getPlatformGroundY(x, z, refY)
    : null;
  if (trackY !== null) return trackY;
  const boat = sampleRowboatDeck(x, z, refY);
  if (boat) return boat.deckY;
  return sampleStaticTerrainHeight(x, z);
}

function computeGroundHex(x, z) {
  const boat = sampleRowboatDeck(x, z);
  if (boat) return 0xb8844c;
  if (isOnPierDeck(x, z)) return 0xba8d5c;
  for (const r of WATER_RAMPS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      return r.surface === 'wood' ? 0xba8d5c : 0xd4c6aa;
    }
  }
  const h = sampleStaticTerrainHeight(x, z);
  if (h <= Y_SEA + 0.08) return 0x32c4dc;
  // Compass-rose mosaic square on Tier 2 centered at `(0, -3.2)`
  const dc = Math.hypot(x, z - (-3.2));
  if (Math.abs(h - Y_T2) < 0.1 && dc < 6.5) {
    if (dc > 5.7) return 0x2b6fb3;
    const ang = Math.atan2(z + 3.2, x);
    const star = Math.abs(Math.sin(ang * 4));
    if (dc > 1.6 && dc < 5.5 && star > 0.92) return 0xdba044;
    return 0xe9dab8;
  }
  if (Math.hypot(x, z) > 22.0 && z < 2.0) return 0x87a460;
  return h >= Y_T3 - 0.1 ? 0xebe0c8 : 0xe2d3b5;
}

// ============================================================================
// Procedural Sunlit Dalmatian Limestone Paving, Terracotta & Mosaic Textures
// ============================================================================
function harborCobbleTex(THREE) {
  return paintedCanvasTex(THREE, 'sp_harbor_cobble_v2', 512, (g, s, rng) => {
    g.fillStyle = '#e6d8bc';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 420, ['#f2e7d0', '#d8c6a4', '#ceb995', '#f7efe0'], 3, 9, 0.34, 0.2, 3.14, 42);
    const rows = 10, cols = 8;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (s / cols) * 0.5;
      for (let c = -1; c <= cols; c++) {
        const x = c * (s / cols) + off + rng.jr(-3, 3);
        const y = r * rh + rng.jr(-2, 2);
        const w = s / cols - 5, h = rh - 5;
        g.fillStyle = rng.pick(['#ecdec4', '#e0d1b4', '#e9d9ba', '#dac8a6', '#f3e7cf']);
        g.beginPath();
        g.roundRect(x + 2, y + 2, w, h, 7);
        g.fill();
        g.strokeStyle = 'rgba(122,102,76,0.26)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
  }, 10, 10);
}

function cliffMasonryTex(THREE) {
  return paintedCanvasTex(THREE, 'sp_dalmatian_limestone', 512, (g, s, rng) => {
    g.fillStyle = '#ece2cc';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 460, ['#f6eee0', '#dfd2b8', '#d5c6a8', '#faf3e6'], 3, 10, 0.36, 0, 3.14, 36);
    const courses = 8;
    const ch = s / courses;
    for (let r = 0; r < courses; r++) {
      const blocks = 5 + (r % 2);
      const bw = s / blocks;
      const off = (r % 2) * bw * 0.45;
      for (let b = -1; b <= blocks; b++) {
        const bx = b * bw + off + rng.jr(-4, 4);
        const by = r * ch + rng.jr(-2, 2);
        g.fillStyle = rng.pick(['#efe5d0', '#e4d8be', '#f5ecda', '#dcd0b4']);
        g.beginPath();
        g.roundRect(bx + 3, by + 3, bw - 6, ch - 6, 8);
        g.fill();
        g.strokeStyle = 'rgba(116,98,74,0.28)';
        g.lineWidth = 2.4;
        g.stroke();
      }
    }
  }, 4, 2);
}

function compassMosaicTex(THREE) {
  return paintedCanvasTex(THREE, 'sp_compass_plaza_v2', 512, (g, s, rng) => {
    const c = s / 2;
    g.fillStyle = '#eadbc0';
    g.fillRect(0, 0, s, s);

    const ring = (r, col) => {
      g.fillStyle = col;
      g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
    };
    ring(248, '#c96f3b');
    ring(238, '#1f64ab');
    ring(218, '#f4e7cb');
    ring(210, '#d9a03c');
    ring(202, '#efe2c6');

    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      g.fillStyle = i % 2 === 0 ? '#7be3ed' : '#fff6de';
      g.beginPath();
      g.arc(c + Math.cos(a) * 228, c + Math.sin(a) * 228, 5.5, 0, TAU);
      g.fill();
    }

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      g.fillStyle = '#89bfd9';
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a - 0.065) * 165, c + Math.sin(a - 0.065) * 165);
      g.lineTo(c + Math.cos(a) * 192, c + Math.sin(a) * 192);
      g.lineTo(c + Math.cos(a + 0.065) * 165, c + Math.sin(a + 0.065) * 165);
      g.closePath();
      g.fill();
    }

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const isCard = i % 2 === 0;
      const tipR = isCard ? 202 : 178;
      const halfA = isCard ? 0.19 : 0.14;
      g.fillStyle = isCard ? '#e8a838' : '#2567ad';
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a - halfA) * 76, c + Math.sin(a - halfA) * 76);
      g.lineTo(c + Math.cos(a) * tipR, c + Math.sin(a) * tipR);
      g.closePath();
      g.fill();
      g.fillStyle = isCard ? '#c86432' : '#57a8cf';
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a) * tipR, c + Math.sin(a) * tipR);
      g.lineTo(c + Math.cos(a + halfA) * 76, c + Math.sin(a + halfA) * 76);
      g.closePath();
      g.fill();
    }

    ring(66, '#1f64ab');
    ring(58, '#f5ebd2');
    brushStrokes(g, s, rng, 200, ['#fff8e6', '#d8c59e', '#589cc4'], 1.2, 3, 0.14, 0, 3.14, 18);
  }, 1, 1);
}

// ============================================================================
// 3-Tier Mediterranean Cliff Terraces, Staircases, Slipways & Balustrades
// ============================================================================
function buildThreeTierHarbor(THREE) {
  const grp = new THREE.Group();
  grp.name = 'three_tier_harbor';
  const colliders = [];
  const rng = makeRng(404);

  const cobbleMat = new THREE.MeshStandardMaterial({
    color: 0xfff9ee,
    map: harborCobbleTex(THREE),
    roughness: 0.9,
    metalness: 0,
  });
  const upperCobbleMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e4,
    map: harborCobbleTex(THREE),
    roughness: 0.9,
    metalness: 0,
  });
  const masonryMat = new THREE.MeshStandardMaterial({
    color: 0xf6efe0,
    map: cliffMasonryTex(THREE),
    roughness: 0.9,
    metalness: 0,
  });
  const copingMat = new THREE.MeshStandardMaterial({
    color: 0xede2ca,
    map: kitTex(THREE, 'stone', 4, 2),
    roughness: 0.88,
    metalness: 0,
  });
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xf2e7d0,
    map: kitTex(THREE, 'stone', 2, 2),
    roughness: 0.86,
    metalness: 0,
  });
  const wetStoneMat = new THREE.MeshStandardMaterial({
    color: 0x9aa884,
    map: kitTex(THREE, 'stone', 2, 2),
    roughness: 0.85,
    metalness: 0,
  });
  const archRecessMat = new THREE.MeshStandardMaterial({
    color: 0xb8aa92,
    map: kitTex(THREE, 'stone', 2, 2),
    roughness: 0.94,
    metalness: 0,
  });
  const terraMat = new THREE.MeshStandardMaterial({
    color: 0xd66d3e,
    map: kitTex(THREE, 'terracotta', 1, 1),
    roughness: 0.85,
    metalness: 0,
  });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8836, roughness: 0.86, metalness: 0 });
  const bougMat = new THREE.MeshStandardMaterial({ color: 0xe62e84, roughness: 0.8, metalness: 0 });
  const bougLightMat = new THREE.MeshStandardMaterial({ color: 0xff66b2, roughness: 0.8, metalness: 0 });
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x78522e,
    map: kitTex(THREE, 'bark', 1, 2),
    roughness: 0.9,
    metalness: 0,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xdcbe84,
    map: kitTex(THREE, 'burlap', 2, 2),
    roughness: 0.88,
    metalness: 0,
  });

  const groundGroup = new THREE.Group();
  const decorGroup = new THREE.Group();

  // Helper to build an extruded polygon terrace slab from `yBot` up to `yTop`
  const addPolySlab = (pts, yBot, yTop, topMat) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], -pts[i][1]);
    sh.closePath();
    const h = yTop - yBot;
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth: h,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 1,
    });
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + 28) / 56, (pos.getY(i) + 28) / 56);
    }
    geo.rotateX(-PI / 2);
    geo.translate(0, yBot - 0.035, 0);
    const m = new THREE.Mesh(geo, [topMat, masonryMat]);
    m.receiveShadow = true;
    m.castShadow = true;
    m.userData.ground = true;
    m.userData.paint = new THREE.Color(0xe6d8bc);
    groundGroup.add(m);
  };

  // ---- 1. TIER 1: Lower Harbor Quay (`y = -1.25 .. 0.75m`, horseshoe w/ central slipway notch!) ----
  addPolySlab(
    [
      [-26.2, 2.6],
      [26.2, 2.6],
      [26.2, 15.0],
      [11.8, 15.0],
      [11.8, 8.2],
      [8.6, 8.2],
      [8.6, 8.45],
      [2.25, 8.45],
      [2.25, 6.2],
      [-2.25, 6.2],
      [-2.25, 8.45],
      [-8.5, 8.45],
      [-8.5, 8.2],
      [-11.8, 8.2],
      [-11.8, 15.0],
      [-26.2, 15.0],
    ],
    -1.25,
    Y_T1,
    cobbleMat
  );

  // ---- 2. TIER 2: Mid Compass-Rose Piazzetta & Trattoria Terrace (`y = 0.65 .. 2.10m`) ----
  addPolySlab(
    [
      [-25.0, -12.1],
      [25.0, -12.1],
      [25.0, 2.8],
      [11.8, 2.8],
      [11.8, 4.5],
      [10.8, 4.5],
      [10.8, 2.3],
      [7.0, 2.3],
      [7.0, 4.5],
      [-7.0, 4.5],
      [-7.0, 2.3],
      [-10.8, 2.3],
      [-10.8, 4.5],
      [-11.8, 4.5],
      [-11.8, 2.8],
      [-25.0, 2.8],
    ],
    Y_T1 - 0.1,
    Y_T2,
    cobbleMat
  );

  // Compass-rose mosaic plaza disc at `(0, Y_T2 + 0.022, -3.2)` on Tier 2!
  const mosaicGeo = new THREE.CircleGeometry(6.4, 64);
  mosaicGeo.rotateX(-PI / 2);
  const mosaicMesh = new THREE.Mesh(
    mosaicGeo,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: compassMosaicTex(THREE),
      roughness: 0.86,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  mosaicMesh.position.set(0, Y_T2 + 0.022, -3.2);
  mosaicMesh.receiveShadow = true;
  mosaicMesh.userData.ground = true;
  mosaicMesh.userData.paint = new THREE.Color(0xe6d6b5);
  grp.add(mosaicMesh);

  // ---- 3. TIER 3: Upper Limestone Cliff Villa Terrace (`y = 2.00 .. 4.20m`) ----
  addPolySlab(
    [
      [-23.2, -28.0],
      [23.2, -28.0],
      [23.2, -12.0],
      [-23.2, -12.0],
    ],
    Y_T2 - 0.1,
    Y_T3,
    upperCobbleMat
  );

  // Carved stone corbel ledges outside Tier 3 balustrade for the 2 Balcony Flower-Ledge Hiding Spots!
  for (const lx of [0.0, 13.2]) {
    const corbel = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.26, 0.86, 1, 0.04), copingMat);
    corbel.position.set(lx, Y_T3 - 0.28, -11.55);
    decorGroup.add(corbel);
    for (const sx of [-0.52, 0.52]) {
      const brk = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.48, 0.56, 1, 0.04), copingMat);
      brk.position.set(lx + sx, Y_T3 - 0.58, -11.72);
      decorGroup.add(brk);
    }
  }

  // ---- 4. Walkable Stone Staircases (`s2w`, `s2e`, `s1w`, `s1e`) & Stone Water Slipways ----
  const addStoneStair = (st, stepCount, withUrns = true) => {
    const w = st.x1 - st.x0;
    const cx = (st.x0 + st.x1) * 0.5;
    const run = st.z1 - st.z0;
    const drop = st.y0 - st.y1;
    for (let i = 0; i < stepCount; i++) {
      const t0 = i / stepCount;
      const t1 = (i + 1) / stepCount;
      const zMid = st.z0 + ((t0 + t1) * 0.5) * run;
      const yTop = st.y0 - (i + 0.35) * (drop / stepCount);
      const h = Math.max(0.24, yTop - (st.y1 - 0.15));
      const tread = new THREE.Mesh(
        new RoundedBoxGeometry(w, h, (run / stepCount) * 1.08, 1, 0.03),
        i >= stepCount - 2 && st.y1 < 0 ? wetStoneMat : stepMat
      );
      tread.position.set(cx, yTop - h * 0.5, zMid);
      tread.castShadow = true;
      tread.receiveShadow = true;
      tread.userData.ground = true;
      tread.userData.paint = new THREE.Color(0xeadbc0);
      groundGroup.add(tread);
    }

    // Stepped stone cheek walls OUTSIDE the walkable stair width so zero rail clipping occurs!
    if (st.y1 > 0) {
      const slopeAng = Math.atan2(drop, run);
      const slopeLen = Math.hypot(drop, run);
      for (const side of [-1, 1]) {
        const rx = side < 0 ? st.x0 - 0.22 : st.x1 + 0.22;
        const rail = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.62, slopeLen + 0.25, 1, 0.04), copingMat);
        rail.position.set(rx, (st.y0 + st.y1) * 0.5 + 0.24, (st.z0 + st.z1) * 0.5);
        rail.rotation.x = slopeAng;
        decorGroup.add(rail);
        // Top & bottom newel posts + terracotta bougainvillea urns
        for (const [nz, ny] of [[st.z0 + 0.12, st.y0], [st.z1 - 0.12, st.y1]]) {
          const pier = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.82, 0.46, 1, 0.04), copingMat);
          pier.position.set(rx, ny + 0.41, nz);
          decorGroup.add(pier);
          if (withUrns && nz < st.z0 + 0.5) {
            const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.14, 0.26, 10), terraMat);
            pot.position.set(rx, ny + 0.94, nz);
            decorGroup.add(pot);
            const bush = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), leafMat);
            bush.position.set(rx, ny + 1.14, nz);
            decorGroup.add(bush);
            const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), bougMat);
            fl.position.set(rx, ny + 1.26, nz + 0.04);
            decorGroup.add(fl);
          }
        }
        colliders.push({
          x: +rx.toFixed(2),
          z: +((st.z0 + st.z1) * 0.5).toFixed(2),
          w: 0.38,
          d: +(run - 0.1).toFixed(2),
        });
      }
    }
  };

  for (const st of STAIRS_T3_T2) addStoneStair(st, 12, true);
  for (const st of STAIRS_T2_T1) addStoneStair(st, 9, true);
  // Stone water slipways on Tier 1 (`ramp_center`, `ramp_west_slip`, `ramp_east_beach`)
  for (const wr of WATER_RAMPS) {
    if (wr.surface === 'stone') addStoneStair(wr, 9, false);
  }

  // ---- 5. Decorative Blind Limestone Arches, Coping Stones & Cascading Bougainvillea on Cliff Walls ----
  const addWallArcade = (x0, x1, zFace, yBot, yTop, archCount) => {
    const span = (x1 - x0) / archCount;
    const h = yTop - yBot;
    // Top cornice moulding
    const cornice = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0, 0.20, 0.34, 1, 0.04), copingMat);
    cornice.position.set((x0 + x1) * 0.5, yTop - 0.08, zFace + 0.08);
    decorGroup.add(cornice);
    for (let i = 0; i < archCount; i++) {
      const ax = x0 + (i + 0.5) * span;
      const pilaster = new THREE.Mesh(new RoundedBoxGeometry(0.34, h - 0.15, 0.26, 1, 0.03), copingMat);
      pilaster.position.set(x0 + i * span + 0.17, yBot + h * 0.48, zFace + 0.06);
      decorGroup.add(pilaster);
      const recess = new THREE.Mesh(new RoundedBoxGeometry(span * 0.64, h * 0.68, 0.12, 2, 0.08), archRecessMat);
      recess.position.set(ax, yBot + h * 0.42, zFace + 0.03);
      decorGroup.add(recess);
    }
  };

  // Tier 3 -> Tier 2 cliff wall arcades (`z = -12.0`)
  addWallArcade(-20.5, -10.0, -12.0, Y_T2, Y_T3, 4);
  addWallArcade(-2.6, 2.6, -12.0, Y_T2, Y_T3, 2);
  addWallArcade(10.0, 20.5, -12.0, Y_T2, Y_T3, 4);
  // Tier 2 -> Tier 1 retaining wall arcades (`z = 4.5` center & `z = 2.8` wings)
  addWallArcade(-6.6, 6.6, 4.5, Y_T1, Y_T2, 5);
  addWallArcade(-22.0, -12.0, 2.8, Y_T1, Y_T2, 4);
  addWallArcade(12.0, 22.0, 2.8, Y_T1, Y_T2, 4);

  // Lush magenta bougainvillea cascades spilling over the limestone cliff retaining walls!
  const bougCascades = [
    [-12.2, Y_T3, -11.9], [-2.1, Y_T3, -11.9], [2.1, Y_T3, -11.9], [11.4, Y_T3, -11.9], [16.8, Y_T3, -11.9],
    [-4.8, Y_T2, 4.55], [4.8, Y_T2, 4.55], [-14.5, Y_T2, 2.88], [14.5, Y_T2, 2.88],
  ];
  for (const [bx, by, bz] of bougCascades) {
    for (let k = 0; k < 11; k++) {
      const ox = rng.jr(-0.75, 0.75);
      const oy = -k * 0.14 + rng.jr(-0.08, 0.12);
      const oz = 0.12 + rng.jr(0, 0.18);
      const lf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), leafMat);
      lf.position.set(bx + ox, by + oy, bz + oz);
      decorGroup.add(lf);
      const bl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.20, 0), k % 2 ? bougMat : bougLightMat);
      bl.position.set(bx + ox * 0.9, by + oy + 0.06, bz + oz + 0.06);
      decorGroup.add(bl);
    }
  }

  // ---- 6. Scenic Stone Balustrades on Tier 3 & Tier 2 (leaving clean wide openings at stairs & ziplines!) ----
  const addStoneBalustrade = (x0, z0, x1, z1, yBase, addCol = true, flowerEvery = 0) => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.25) return;
    const ang = Math.atan2(dx, dz);
    const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
    // Plinth & top rail
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.14, len, 1, 0.03), copingMat);
    plinth.position.set(cx, yBase + 0.07, cz);
    plinth.rotation.y = ang;
    decorGroup.add(plinth);
    const topRail = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.13, len + 0.08, 1, 0.03), copingMat);
    topRail.position.set(cx, yBase + 0.82, cz);
    topRail.rotation.y = ang;
    decorGroup.add(topRail);
    // Turned limestone balusters
    const count = Math.max(2, Math.round(len / 0.46));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const px = x0 + dx * t, pz = z0 + dz * t;
      const isPier = i === 0 || i === count || (flowerEvery > 0 && i % flowerEvery === 0);
      const bMesh = isPier
        ? new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.88, 0.34, 1, 0.03), copingMat)
        : new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.64, 8), stepMat);
      bMesh.position.set(px, yBase + (isPier ? 0.44 : 0.45), pz);
      decorGroup.add(bMesh);
      if (flowerEvery > 0 && i > 0 && i < count && i % flowerEvery === 0) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.13, 0.24, 9), terraMat);
        pot.position.set(px, yBase + 1.0, pz);
        decorGroup.add(pot);
        const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), bougMat);
        fl.position.set(px, yBase + 1.18, pz);
        decorGroup.add(fl);
      }
    }
    if (addCol) {
      if (Math.abs(dz) < 0.06) colliders.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), w: +len.toFixed(2), d: 0.34, y: yBase });
      else if (Math.abs(dx) < 0.06) colliders.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), w: 0.34, d: +len.toFixed(2), y: yBase });
      else colliders.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), w: 0.34, d: +len.toFixed(2), rot: +ang.toFixed(4), y: yBase });
    }
  };

  // Tier 3 Balustrades (`y = 4.20m`) — wide openings at `s2w [-7.0, -2.8]` & `s2e [2.8, 7.0]`!
  addStoneBalustrade(-20.8, -12.05, -7.05, -12.05, Y_T3, true, 6);
  addStoneBalustrade(-2.72, -12.05, 2.72, -12.05, Y_T3, true, 6); // Central belvedere balustrade!
  addStoneBalustrade(7.05, -12.05, 20.8, -12.05, Y_T3, true, 6);

  // Tier 2 Balustrades (`y = 2.10m`) — wide openings at `s1w [-11.0, -6.8]` & `s1e [6.8, 11.0]`!
  addStoneBalustrade(-22.5, 2.75, -11.8, 2.75, Y_T2, true, 6);
  addStoneBalustrade(-11.8, 2.75, -11.8, 4.45, Y_T2, true, 0);
  addStoneBalustrade(-11.8, 4.45, -11.05, 4.45, Y_T2, true, 0);
  addStoneBalustrade(-6.75, 4.45, 6.75, 4.45, Y_T2, true, 5);   // Hero Compass-Rose Piazzetta overlook!
  addStoneBalustrade(11.05, 4.45, 11.8, 4.45, Y_T2, true, 0);
  addStoneBalustrade(11.8, 2.75, 11.8, 4.45, Y_T2, true, 0);
  addStoneBalustrade(11.8, 2.75, 22.5, 2.75, Y_T2, true, 6);

  // ---- 7. Tier 1 Harbor Rope-&-Bollard Seawall (`y = 0.75m`, clean openings at piers & all 3 slipways!) ----
  const addBollardRun = (x0, z0, x1, z1, withPots = false) => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const posts = Math.max(2, Math.round(len / 2.2) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      const px = x0 + dx * t, pz = z0 + dz * t;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.82, 10), postMat);
      post.position.set(px, Y_T1 + 0.4, pz);
      decorGroup.add(post);
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 6, 12), ropeMat);
      wrap.position.set(px, Y_T1 + 0.62, pz);
      wrap.rotation.x = PI / 2;
      decorGroup.add(wrap);
      if (i < posts - 1) {
        const nt = (i + 1) / (posts - 1);
        const nx = x0 + dx * nt, nz = z0 + dz * nt;
        const mx = (px + nx) * 0.5, mz = (pz + nz) * 0.5;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(px, Y_T1 + 0.64, pz),
          new THREE.Vector3(mx, Y_T1 + 0.44, mz),
          new THREE.Vector3(nx, Y_T1 + 0.64, nz),
        ]);
        decorGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.03, 6, false), ropeMat));
        if (withPots && i % 2 === 0) {
          const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.14, 0.26, 10), terraMat);
          pot.position.set(mx, Y_T1 + 0.13, mz);
          decorGroup.add(pot);
          const bush = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), leafMat);
          bush.position.set(mx, Y_T1 + 0.34, mz);
          decorGroup.add(bush);
          const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), bougMat);
          fl.position.set(mx, Y_T1 + 0.46, mz + 0.03);
          decorGroup.add(fl);
        }
      }
    }
    const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
    if (Math.abs(dz) < 0.05) colliders.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), w: +(len + 0.16).toFixed(2), d: 0.34 });
    else if (Math.abs(dx) < 0.05) colliders.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), w: 0.34, d: +(len + 0.16).toFixed(2) });
  };

  addBollardRun(-23.8, 14.85, -11.9, 14.85, true);
  addBollardRun(-11.9, 14.85, -11.9, 8.95, false);
  // Open at `ramp_west_slip` [-11.6, -8.5] & `pierWest` [-8.3, -4.1]!
  addBollardRun(-4.0, 8.35, -2.35, 8.35, true);
  // Open at `ramp_center` [-2.2, +2.2]!
  addBollardRun(2.35, 8.35, 4.2, 8.35, true);
  // Open at `pierEast` [4.3, 8.5] & `ramp_east_beach` [8.6, 11.6]!
  addBollardRun(11.9, 8.95, 11.9, 14.85, false);
  addBollardRun(11.9, 14.85, 23.8, 14.85, true);

  mergeStatic(THREE, groundGroup);
  groundGroup.traverse((m) => {
    if (m.isMesh) {
      m.userData.ground = true;
      m.userData.paint = new THREE.Color(0xe5d7ba);
    }
  });
  mergeStatic(THREE, decorGroup);
  decorGroup.traverse((m) => {
    if (m.isMesh && !m.userData.paint) m.userData.paint = new THREE.Color(0xeadcc0);
  });

  grp.add(groundGroup);
  grp.add(decorGroup);
  grp.userData.colliders = colliders;
  grp.userData.merged = true;
  return grp;
}

// ============================================================================
// Standable Sunlit Limestone & Oak Harbor Benches (Jump-Over / Jump-Onto Props!)
// ============================================================================
function buildStandableHarborBenches(THREE, ctx) {
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xefe4cc,
    map: kitTex(THREE, 'stone', 1.5, 1.5),
    roughness: 0.88,
    metalness: 0,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xc98f54,
    map: kitTex(THREE, 'wood_light', 1.5, 1.5),
    roughness: 0.86,
    metalness: 0,
  });

  // [x, y, z, rot] — each bench has `h = 0.52m` so `placeKit` registers `standable: true`!
  const specs = [
    [3.2, Y_T2, -5.4, 0],        // Hero Tier 2 Piazzetta bench (wide open north & south for jump tests!)
    [-3.2, Y_T2, -5.4, 0],       // Companion West Piazzetta bench
    [0.0, Y_T2, 2.8, 0],         // Tier 2 harbor overlook bench
    [-1.4, Y_T3, -15.2, 0],      // Tier 3 Upper Cliff Belvedere bench
    [4.2, Y_T3, -15.2, 0],       // Tier 3 East Belvedere bench
    [-3.2, Y_T1, 6.6, 0],        // Tier 1 Lower Harbor Quay bench
  ];

  for (const [bx, by, bz, rot] of specs) {
    const g = new THREE.Group();
    g.name = 'harbor_bench';
    const seat = new THREE.Mesh(new RoundedBoxGeometry(1.64, 0.11, 0.58, 2, 0.03), woodMat);
    seat.position.set(0, 0.46, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    seat.userData.paint = new THREE.Color(0xc98f54);
    g.add(seat);
    for (const sx of [-0.62, 0.62]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.42, 0.52, 1, 0.03), stoneMat);
      leg.position.set(sx, 0.21, 0);
      leg.castShadow = true;
      leg.receiveShadow = true;
      leg.userData.paint = new THREE.Color(0xefe4cc);
      g.add(leg);
    }
    g.userData.colliders = [{ x: 0, z: 0, w: 1.66, d: 0.62, h: 0.52 }];
    ctx.placeKit(g, bx, bz, rot, by);
  }
}

// ============================================================================
// White Dalmatian Sea Cliffs, Natural Sea-Arch Bridges, Viaduct & Olive/Cypress Groves
// ============================================================================
function buildCoastalBackdrop(THREE) {
  const grp = new THREE.Group();
  grp.name = 'coastal_backdrop';
  const rng = makeRng(314);
  const colliders = [];

  const cliffIvoryTex = paintedCanvasTex(THREE, 'sp_cliff_crag_ivory', 256, (g, s, rng2) => {
    g.fillStyle = '#f3ecda';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng2, 260, ['#faf5e8', '#e5dac2', '#dcd0b4', '#fffbf0'], 4, 14, 0.35, -0.35, 0.35, 19);
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = 'rgba(138,122,96,0.20)';
      g.lineWidth = rng2.jr(1.2, 2.8);
      g.beginPath();
      const y = rng2.jr(8, s - 8);
      g.moveTo(0, y);
      g.lineTo(s, y + rng2.jr(-18, 18));
      g.stroke();
    }
  }, 2, 2);

  const cliffMat = new THREE.MeshStandardMaterial({ color: 0xf6efe0, map: cliffIvoryTex, roughness: 0.90, metalness: 0, flatShading: true });
  const cliffShadeMat = new THREE.MeshStandardMaterial({ color: 0xe3d8c0, map: cliffIvoryTex, roughness: 0.92, metalness: 0, flatShading: true });
  const scrubMat = new THREE.MeshStandardMaterial({ color: 0x5c8f42, roughness: 0.88, metalness: 0 });
  const maquisMat = new THREE.MeshStandardMaterial({ color: 0x457534, roughness: 0.90, metalness: 0 });
  const cypressMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2e, roughness: 0.90, metalness: 0 });
  const oliveFoliageMat = new THREE.MeshStandardMaterial({ color: 0x789862, roughness: 0.88, metalness: 0 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6c4c30, map: kitTex(THREE, 'bark', 1, 2), roughness: 0.92, metalness: 0 });
  const bougMat = new THREE.MeshStandardMaterial({ color: 0xe22b7e, roughness: 0.82, metalness: 0 });
  const bougCoralMat = new THREE.MeshStandardMaterial({ color: 0xf04e84, roughness: 0.82, metalness: 0 });
  const reefMat = new THREE.MeshStandardMaterial({ color: 0x3b8c7c, roughness: 0.92, metalness: 0 });

  // Multi-faceted craggy Dalmatian limestone massif + clustered Mediterranean maquis/olive foliage (NO flat caps!)
  const addCliffMass = (x, y, z, sx, sy, sz, ry = 0, topGreen = true, addCol = false, withBoug = false) => {
    const subCrags = [
      [0, 0, 0, 1.0, 1.0, 1.0, 0],
      [-0.44, -0.18, 0.24, 0.72, 0.78, 0.74, 0.7],
      [0.46, -0.14, 0.20, 0.68, 0.82, 0.72, -0.6],
      [0.08, -0.32, 0.48, 0.62, 0.56, 0.58, 1.1],
    ];
    for (let k = 0; k < subCrags.length; k++) {
      const [ox, oy, oz, kx, ky, kz, dr] = subCrags[k];
      const geo = k % 2 === 0 ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0);
      const m = new THREE.Mesh(geo, (k + Math.abs(Math.round(x))) % 2 === 0 ? cliffMat : cliffShadeMat);
      m.position.set(x + ox * sx, y + oy * sy, z + oz * sz);
      m.rotation.set(rng.jr(-0.18, 0.18), ry + dr, rng.jr(-0.18, 0.18));
      m.scale.set(sx * kx, sy * ky, sz * kz);
      grp.add(m);
    }
    if (topGreen) {
      const puffs = [
        [0, 0.84, 0.05, 0.56, scrubMat],
        [-0.38, 0.74, 0.18, 0.44, maquisMat],
        [0.40, 0.76, -0.10, 0.46, oliveFoliageMat],
        [-0.14, 0.88, -0.24, 0.40, scrubMat],
        [0.22, 0.68, 0.30, 0.36, maquisMat],
      ];
      for (const [px, py, pz, pr, pm] of puffs) {
        const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), pm);
        bush.position.set(x + px * sx, y + py * sy, z + pz * sz);
        bush.scale.set(sx * pr, Math.max(0.85, sy * 0.24), sz * pr);
        grp.add(bush);
      }
    }
    if (withBoug) {
      for (let b = 0; b < 7; b++) {
        const bm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 0), b % 2 === 0 ? bougMat : bougCoralMat);
        bm.position.set(
          x + rng.jr(-0.45, 0.45) * sx,
          y + (0.42 - b * 0.10) * sy,
          z + (0.68 + rng.jr(-0.08, 0.12)) * sz
        );
        bm.scale.set(1.25, 0.95, 0.9);
        grp.add(bm);
      }
    }
    if (addCol) colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: +(sx * 1.65).toFixed(2), d: +(sz * 1.65).toFixed(2) });
  };

  // Framing Dalmatian limestone bluffs rising behind Tier 3 (`z ~ -27`) & flanking the cove wings
  // Leaving NE bay (`x > 16, z < -20`) open to frame the iconic Dalmatian Sea-Arch Rock Bridge!
  const bluffSpecs = [
    [-26.5, 5.8, -9.2, 3.8, 5.8, 3.9, 0.4, true, true],
    [-25.2, 7.4, -18.5, 4.4, 7.6, 4.2, 0.9, true, false],
    [-18.5, 8.8, -28.0, 5.4, 8.6, 4.2, 0.2, true, true],
    [-8.8, 8.4, -28.6, 5.2, 8.0, 4.0, -0.3, true, false],
    [1.8, 7.6, -28.6, 4.8, 7.2, 3.9, 0.5, true, true],
    [11.6, 6.8, -28.2, 4.4, 6.5, 3.8, -0.2, true, false],
    [25.6, 5.2, -7.8, 3.6, 5.0, 3.8, -0.5, true, true],
    [26.2, 3.8, 3.8, 3.4, 4.2, 3.8, 0.3, true, false],
    // Foreground coastal limestone outcrops framing the turquoise harbor bay (`overview.png` corners!)
    [-24.8, 2.0, 16.2, 3.0, 2.6, 2.6, 0.6, true, true],
    [-19.8, 1.1, 16.4, 1.9, 1.5, 1.8, 1.1, false, false],
    [19.8, 1.2, 16.4, 2.0, 1.6, 1.9, -0.4, false, false],
    [24.8, 2.3, 16.4, 3.3, 3.0, 2.8, 0.2, true, true],
  ];
  for (const [x, y, z, sx, sy, sz, ry, col, wb] of bluffSpecs) {
    addCliffMass(x, y, z, sx, sy, sz, ry, y > 1.8, col, wb);
  }

  // Cascading magenta bougainvillea drapes along Tier 3 & Tier 2 limestone retaining walls!
  for (const [vx, vy, vz, count] of [
    [-13.5, Y_T3, -11.82, 8], [-1.6, Y_T3, -11.82, 7], [1.6, Y_T3, -11.82, 7], [14.8, Y_T3, -11.82, 8],
    [-4.8, Y_T2, 4.62, 7], [4.8, Y_T2, 4.62, 7], [-15.5, Y_T2, 2.92, 6], [15.5, Y_T2, 2.92, 6],
  ]) {
    for (let k = 0; k < count; k++) {
      const bm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), k % 2 === 0 ? bougMat : bougCoralMat);
      bm.position.set(vx + (k - count * 0.5) * 0.34, vy - 0.15 - (k % 3) * 0.28, vz);
      bm.scale.set(1.2, 0.95, 0.75);
      grp.add(bm);
    }
  }

  // Underwater turquoise reef & seagrass boulders visible beneath the crystal bay water!
  for (const [rx, rz, rs] of [[-12.5, 21.5, 1.8], [-2.5, 21.8, 1.6], [4.2, 23.0, 2.1], [12.8, 20.2, 1.7], [0.8, 17.5, 1.3]]) {
    const rf = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), reefMat);
    rf.position.set(rx, -1.08, rz);
    rf.scale.set(1.4, 0.35, 1.2);
    grp.add(rf);
  }

  // Bougainvillea splashes on foreground coastal rocks
  for (const [bx, by, bz] of [[23.2, 2.4, 15.6], [-23.2, 2.3, 15.6]]) {
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 0), bougMat);
      b.position.set(bx + rng.jr(-0.8, 0.8), by + rng.jr(-0.3, 0.6), bz + rng.jr(-0.6, 0.6));
      grp.add(b);
    }
  }

  // Iconic Natural Limestone Sea-Arch Rock Bridges clearly visible in the NE ocean vista (`overview.png` top-right!)
  const addSeaArch = (cx, cz, rotY, span, height, thick) => {
    const ag = new THREE.Group();
    ag.position.set(cx, -0.3, cz);
    ag.rotation.y = rotY;
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * PI;
      const lx = Math.cos(a) * span;
      const ly = Math.sin(a) * height;
      const r = thick * (1.32 - 0.42 * Math.sin(a));
      const blk = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? cliffMat : cliffShadeMat);
      blk.position.set(lx, ly, rng.jr(-0.18, 0.18));
      blk.rotation.set(rng.jr(-0.2, 0.2), rng.jr(-0.3, 0.3), rng.jr(-0.2, 0.2));
      blk.scale.set(1.18, 1.25, 1.05);
      ag.add(blk);
      if (a > 0.65 && a < 2.5) {
        const gr = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.68, 1), i % 2 ? scrubMat : maquisMat);
        gr.position.set(lx, ly + r * 0.92, 0);
        gr.scale.set(1.15, 0.52, 0.95);
        ag.add(gr);
      }
    }
    grp.add(ag);
  };
  addSeaArch(23.5, -25.5, -0.38, 6.2, 9.0, 1.95);
  addSeaArch(34.5, -18.5, -0.68, 4.4, 5.8, 1.45);

  // Hillside Roman Limestone 3-Arch Viaduct on NW Bluff (`overview.png` top-left!)
  const viaG = new THREE.Group();
  viaG.position.set(-17.5, 10.2, -26.5);
  viaG.rotation.y = 0.32;
  const deck = new THREE.Mesh(new RoundedBoxGeometry(7.8, 0.45, 1.8, 1, 0.06), cliffMat);
  deck.position.set(0, 1.65, 0);
  viaG.add(deck);
  for (let p = 0; p < 4; p++) {
    const pier = new THREE.Mesh(new RoundedBoxGeometry(0.72, 3.2, 1.65, 1, 0.05), cliffShadeMat);
    pier.position.set(-3.15 + p * 2.1, 0, 0);
    viaG.add(pier);
  }
  grp.add(viaG);

  // Slender Italian Cypress Trees & Gnarled Mediterranean Olive Trees across all 3 tiers
  const addCypress = (x, y, z, h = 6.2, addCol = false) => {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h * 0.28, 7), trunkMat);
    tr.position.set(x, y + h * 0.14, z);
    grp.add(tr);
    for (let k = 0; k < 4; k++) {
      const r = (0.68 - k * 0.12) * (h / 6.2);
      const ch = h * (0.42 - k * 0.05);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 9), cypressMat);
      cone.position.set(x, y + h * (0.34 + k * 0.17), z);
      grp.add(cone);
    }
    if (addCol) colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: 0.72, d: 0.72 });
  };

  const addOliveTree = (x, y, z, sc = 1.0, addCol = false) => {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * sc, 0.3 * sc, 1.85 * sc, 8), trunkMat);
    tr.position.set(x, y + 0.9 * sc, z);
    tr.rotation.z = rng.jr(-0.14, 0.14);
    grp.add(tr);
    const puffs = [
      [0, 2.35, 0, 1.35], [-0.75, 2.05, 0.35, 0.98], [0.78, 2.1, -0.25, 1.02],
      [0.15, 2.55, 0.65, 0.88], [-0.25, 2.48, -0.62, 0.9],
    ];
    for (const [ox, oy, oz, r] of puffs) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r * sc, 1), oliveFoliageMat);
      f.position.set(x + ox * sc, y + oy * sc, z + oz * sc);
      f.scale.set(1.15, 0.72, 1.1);
      grp.add(f);
    }
    if (addCol) colliders.push({ x: +x.toFixed(2), z: +z.toFixed(2), w: 0.82, d: 0.82 });
  };

  const cypressPts = [
    [-22.2, Y_T2, -10.2, 6.8, true], [-22.4, Y_T2, 1.2, 6.4, true],
    [-19.5, Y_T3, -24.8, 6.8, true], [-1.2, Y_T3, -25.2, 6.5, true], [3.6, Y_T3, -25.2, 6.2, true],
    [19.5, Y_T3, -24.5, 6.6, true], [22.2, Y_T2, -9.8, 6.4, true], [22.4, Y_T2, 0.8, 6.2, true],
    [-21.5, 10.5, -26.5, 7.0, false], [-11.5, 11.2, -28.0, 7.2, false],
  ];
  for (const [x, y, z, h, c] of cypressPts) addCypress(x, y, z, h, c);

  const olivePts = [
    [-21.6, Y_T2, -4.5, 1.08, true], [-16.8, Y_T3, -16.8, 1.12, true],
    [18.2, Y_T3, -16.8, 1.10, true], [19.8, Y_T2, -4.8, 1.12, true],
    [-24.0, Y_T1, 4.8, 1.05, true], [24.0, Y_T1, 4.8, 1.05, true],
  ];
  for (const [x, y, z, sc, c] of olivePts) addOliveTree(x, y, z, sc, c);

  mergeStatic(THREE, grp);
  grp.traverse((m) => {
    if (m.isMesh) {
      if (m.material && m.material.isMeshStandardMaterial) m.material.metalness = 0;
      if (!m.userData.paint) m.userData.paint = new THREE.Color(0xeae0cc);
    }
  });
  grp.userData.colliders = colliders;
  grp.userData.merged = true;
  return grp;
}

// Ambient floating markers at the 3 Sea-Float Custom Spots so swimmers immediately spot them!
function buildSeaSpotMarkers(THREE) {
  const grp = new THREE.Group();
  grp.name = 'sea_spot_markers';
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xf4fcff,
    emissive: 0x5be2f5,
    emissiveIntensity: 0.45,
    roughness: 0.4,
    metalness: 0,
  });
  const corkMat = new THREE.MeshStandardMaterial({ color: 0xd94534, roughness: 0.8, metalness: 0 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe0be82, roughness: 0.9, metalness: 0 });

  const markers = [];
  for (const sp of STATIC_CUSTOM_SPOTS) {
    if (sp.spotType !== 'sea_float') continue;
    const mg = new THREE.Group();
    mg.position.set(sp.x, Y_SEA + 0.03, sp.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 6, 20), ropeMat);
    ring.rotation.x = PI / 2;
    mg.add(ring);
    const foam = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.022, 6, 22), ringMat);
    foam.rotation.x = PI / 2;
    mg.add(foam);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), corkMat);
      bob.position.set(Math.cos(a) * 0.58, 0.02, Math.sin(a) * 0.58);
      mg.add(bob);
    }
    grp.add(mg);
    markers.push(mg);
  }
  return { group: grp, markers };
}

function buildSeagull(THREE) {
  const g = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfbfaf5, roughness: 0.75, metalness: 0 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x3b4856, roughness: 0.8, metalness: 0 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf2a92c, roughness: 0.6, metalness: 0 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), whiteMat);
  body.scale.set(0.75, 0.72, 1.85);
  g.add(body);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 6), beakMat);
  beak.rotation.x = PI / 2;
  beak.position.set(0, 0.02, 0.28);
  g.add(beak);
  const tail = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.025, 0.18, 1, 0.01), whiteMat);
  tail.position.set(0, 0.02, -0.26);
  g.add(tail);

  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.07, 0.03, 0.02);
    const inner = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.026, 0.16, 1, 0.01), whiteMat);
    inner.position.set(s * 0.18, 0, 0);
    pivot.add(inner);
    const outer = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.022, 0.12, 1, 0.01), tipMat);
    outer.position.set(s * 0.44, -0.01, -0.03);
    outer.rotation.y = -s * 0.22;
    pivot.add(outer);
    g.add(pivot);
    wings.push(pivot);
  }
  g.userData.wings = wings;
  return g;
}

// ============================================================================
// Multi-Tier AI Waypoint Router (`routeTierWaypoint`)
// ============================================================================
function tierOf(pt) {
  const y = typeof pt.y === 'number' ? pt.y : sampleSeaplaneHeight(pt.x, pt.z);
  if (y >= 3.25) return 3;
  if (y >= 1.45) return 2;
  if (y >= 0.25) return 1;
  return 0; // Swimmable Sea (`-0.32m`) or Rowboat (`~0.15m`)
}

function routeSeaplaneWaypoint(from, goal) {
  if (!from || !goal) return null;
  const fTier = tierOf(from);
  const gTier = tierOf(goal);

  // 1. Climb out of Swimmable Sea (`fTier === 0`) onto Land (`gTier >= 1`)
  if (fTier === 0 && gTier >= 1) {
    // Pick nearest water ramp foot -> head
    const ramps = [
      { foot: { x: 0.0, y: Y_SEA, z: 9.7 }, head: { x: 0.0, y: Y_T1, z: 5.9 } },
      { foot: { x: -10.0, y: Y_SEA, z: 11.9 }, head: { x: -10.0, y: Y_T1, z: 7.7 } },
      { foot: { x: 10.1, y: Y_SEA, z: 11.9 }, head: { x: 10.1, y: Y_T1, z: 7.7 } },
      { foot: { x: -6.2, y: Y_SEA, z: 22.4 }, head: { x: -6.2, y: Y_T1, z: 18.6 } },
      { foot: { x: 6.4, y: Y_SEA, z: 22.0 }, head: { x: 6.4, y: Y_T1, z: 18.2 } },
    ];
    let best = ramps[0], bestD = Infinity;
    for (const r of ramps) {
      const d = Math.hypot(from.x - r.foot.x, from.z - r.foot.z) + 0.35 * Math.hypot(goal.x - r.head.x, goal.z - r.head.z);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (Math.hypot(from.x - best.foot.x, from.z - best.foot.z) > 1.3 && from.z > best.foot.z - 0.5) {
      return best.foot;
    }
    return best.head;
  }

  // 2. Enter Swimmable Sea (`gTier === 0`) from Land (`fTier >= 1`)
  if (fTier >= 1 && gTier === 0) {
    if (fTier >= 2) {
      return routeSeaplaneWaypoint(from, { x: goal.x < 0 ? -8.9 : 8.9, y: Y_T1, z: 6.0 });
    }
    // If already out on West or East Pier, walk straight down that pier's seaward step-ramp!
    if (isOnPierDeck(from.x, from.z) && from.z > 9.5) {
      const wPier = from.x < 0;
      const head = wPier ? { x: -6.2, y: Y_T1, z: 18.6 } : { x: 6.4, y: Y_T1, z: 18.2 };
      const foot = wPier ? { x: -6.2, y: Y_SEA, z: 22.4 } : { x: 6.4, y: Y_SEA, z: 22.0 };
      if (Math.hypot(from.x - head.x, from.z - head.z) > 1.25 && from.z < head.z + 0.4) return head;
      return foot;
    }
    const ramps = [
      { head: { x: 0.0, y: Y_T1, z: 5.9 }, foot: { x: 0.0, y: Y_SEA, z: 9.8 } },
      { head: { x: -10.0, y: Y_T1, z: 7.7 }, foot: { x: -10.0, y: Y_SEA, z: 11.9 } },
      { head: { x: 10.1, y: Y_T1, z: 7.7 }, foot: { x: 10.1, y: Y_SEA, z: 11.9 } },
      { head: { x: -6.2, y: Y_T1, z: 18.6 }, foot: { x: -6.2, y: Y_SEA, z: 22.4 } },
      { head: { x: 6.4, y: Y_T1, z: 18.2 }, foot: { x: 6.4, y: Y_SEA, z: 22.0 } },
    ];
    let best = ramps[0], bestD = Infinity;
    for (const r of ramps) {
      const d = Math.hypot(from.x - r.head.x, from.z - r.head.z) + 0.45 * Math.hypot(goal.x - r.foot.x, goal.z - r.foot.z);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (Math.hypot(from.x - best.head.x, from.z - best.head.z) > 1.25 && from.z < best.head.z + 0.6) return best.head;
    return best.foot;
  }

  // 3. Tier 3 <-> Tier 2 via `s2w` (`x = -4.9`) or `s2e` (`x = +4.9`)
  if (fTier === 3 && gTier <= 2) {
    const sx = from.x + goal.x < 0 ? -4.9 : 4.9;
    if (Math.hypot(from.x - sx, from.z - (-12.5)) > 1.25 && from.z < -11.9) {
      return { x: sx, y: Y_T3, z: -12.5 };
    }
    return { x: sx, y: Y_T2, z: -7.3 };
  }
  if (fTier <= 2 && gTier === 3) {
    if (fTier === 1) {
      const s1x = from.x < 0 ? -8.9 : 8.9;
      if (Math.hypot(from.x - s1x, from.z - 5.9) > 1.25 && from.z > 5.3) return { x: s1x, y: Y_T1, z: 5.9 };
      return { x: s1x, y: Y_T2, z: 1.8 };
    }
    const sx = from.x + goal.x < 0 ? -4.9 : 4.9;
    if (Math.hypot(from.x - sx, from.z - (-7.3)) > 1.25 && from.z > -7.9) {
      return { x: sx, y: Y_T2, z: -7.3 };
    }
    return { x: sx, y: Y_T3, z: -12.6 };
  }

  // 4. Tier 2 <-> Tier 1 via `s1w` (`x = -8.9`) or `s1e` (`x = +8.9`)
  if (fTier === 2 && gTier === 1) {
    const sx = from.x + goal.x < 0 ? -8.9 : 8.9;
    if (Math.hypot(from.x - sx, from.z - 1.8) > 1.25 && from.z < 2.4) {
      return { x: sx, y: Y_T2, z: 1.8 };
    }
    return { x: sx, y: Y_T1, z: 6.0 };
  }
  if (fTier === 1 && gTier === 2) {
    // First exit pier mouth (`z > 7.75`) or side quay wing if needed
    if (from.z > 7.75 && Math.abs(from.x - PIER_WEST.x) <= PIER_WEST.w * 0.5 + 0.35) {
      return { x: PIER_WEST.x, y: Y_T1, z: 7.0 };
    }
    if (from.z > 7.75 && Math.abs(from.x - PIER_EAST.x) <= PIER_EAST.w * 0.5 + 0.35) {
      return { x: PIER_EAST.x, y: Y_T1, z: 7.0 };
    }
    if (Math.abs(from.x) > 12.0 && from.z > 8.0) {
      const wx = from.x < 0 ? -12.85 : 12.85;
      if (from.z > 9.6 && Math.abs(from.x) > 13.35 && Math.hypot(from.x - wx, from.z - 10.8) > 0.75) {
        return { x: wx, y: Y_T1, z: 10.8 };
      }
      return { x: wx, y: Y_T1, z: 6.8 };
    }
    const sx = from.x + goal.x < 0 ? -8.9 : 8.9;
    if (Math.hypot(from.x - sx, from.z - 6.0) > 1.25 && from.z > 5.4) {
      return { x: sx, y: Y_T1, z: 6.0 };
    }
    return { x: sx, y: Y_T2, z: 1.8 };
  }

  // 5. Same-tier routing around piers & side harbor wings on Tier 1
  if (fTier === 1 && gTier === 1) {
    const nearWestPier = from.z > 7.75 && Math.abs(from.x - PIER_WEST.x) <= PIER_WEST.w * 0.5 + 0.35;
    const goalWestPier = goal.z > 8.3 && Math.abs(goal.x - PIER_WEST.x) <= PIER_WEST.w * 0.5 + 0.35;
    const nearEastPier = from.z > 7.75 && Math.abs(from.x - PIER_EAST.x) <= PIER_EAST.w * 0.5 + 0.35;
    const goalEastPier = goal.z > 8.3 && Math.abs(goal.x - PIER_EAST.x) <= PIER_EAST.w * 0.5 + 0.35;
    if (nearWestPier && !goalWestPier) return { x: PIER_WEST.x, y: Y_T1, z: 7.0 };
    if (nearEastPier && !goalEastPier) return { x: PIER_EAST.x, y: Y_T1, z: 7.0 };
    if (!nearWestPier && goalWestPier && Math.hypot(from.x - PIER_WEST.x, from.z - 7.0) > 0.9) {
      return { x: PIER_WEST.x, y: Y_T1, z: 7.0 };
    }
    if (!nearEastPier && goalEastPier && Math.hypot(from.x - PIER_EAST.x, from.z - 7.0) > 0.9) {
      return { x: PIER_EAST.x, y: Y_T1, z: 7.0 };
    }
    // Entering/exiting West Hangar wing (`x < -11.9, z > 8.2`) or East Boathouse wing (`x > 11.9, z > 8.2`) via clear `x = ±12.85` alley!
    if (goal.x < -12.0 && goal.z > 8.0 && from.x > -12.1) {
      if (Math.hypot(from.x - (-12.85), from.z - 6.8) > 0.75) return { x: -12.85, y: Y_T1, z: 6.8 };
      return { x: -12.85, y: Y_T1, z: 10.8 };
    }
    if (from.x < -12.0 && from.z > 8.0 && goal.x > -11.8) {
      if (from.z > 9.6 && from.x < -13.35 && Math.hypot(from.x - (-12.85), from.z - 10.8) > 0.75) {
        return { x: -12.85, y: Y_T1, z: 10.8 };
      }
      if (Math.hypot(from.x - (-12.85), from.z - 6.8) > 0.75) return { x: -12.85, y: Y_T1, z: 6.8 };
    }
    if (goal.x > 12.0 && goal.z > 8.0 && from.x < 12.1) {
      if (Math.hypot(from.x - 12.85, from.z - 6.8) > 0.75) return { x: 12.85, y: Y_T1, z: 6.8 };
      return { x: 12.85, y: Y_T1, z: 10.8 };
    }
    if (from.x > 12.0 && from.z > 8.0 && goal.x < 11.8) {
      if (from.z > 9.6 && from.x > 13.35 && Math.hypot(from.x - 12.85, from.z - 10.8) > 0.75) {
        return { x: 12.85, y: Y_T1, z: 10.8 };
      }
      if (Math.hypot(from.x - 12.85, from.z - 6.8) > 0.75) return { x: 12.85, y: Y_T1, z: 6.8 };
    }
  }

  return null;
}

function tripLighthouseBreaker(fromShot = false) {
  const nowSec = performance.now() * 0.001;
  if (nowSec < SEA_WORLD_STATE.beaconBlindedUntil) {
    return `⚡ Searchlight already blacked out (${Math.ceil(SEA_WORLD_STATE.beaconBlindedUntil - nowSec)}s)!`;
  }
  SEA_WORLD_STATE.beaconBlindedUntil = nowSec + 12.0;
  const ms = SEA_WORLD_STATE.mechSpots.find((m) => m.id === 'mech_lighthouse_breaker');
  if (ms) ms.cdUntil = nowSec + 12.0;
  if (SEA_WORLD_STATE.beaconBeam) SEA_WORLD_STATE.beaconBeam.visible = false;
  for (const sc of SEA_WORLD_STATE.beaconSubCones) sc.visible = false;
  if (SEA_WORLD_STATE.breakerVisual) SEA_WORLD_STATE.breakerVisual.setTripped(true);
  playWorldMechAudio(SEA_WORLD_STATE.audio, 'shatter');
  playWorldMechAudio(SEA_WORLD_STATE.audio, 'valve');
  if (SEA_WORLD_STATE.spawnPuff) {
    SEA_WORLD_STATE.spawnPuff({ x: BREAKER_POS.x, y: BREAKER_POS.y + 1.15, z: BREAKER_POS.z + 0.18 }, 10, 1.4, 0.35, 0.45, 0.4);
  }
  if (SEA_WORLD_STATE.emitSoundCue) {
    SEA_WORLD_STATE.emitSoundCue({ x: BREAKER_POS.x, y: BREAKER_POS.y + 1.0, z: BREAKER_POS.z }, 14.0, 'chime', null);
  }
  if (fromShot && SEA_WORLD_STATE.notify) {
    SEA_WORLD_STATE.notify('⚡ Clifftop Breaker tripped! Lighthouse Searchlight blacked out for 12s!', 2400);
  }
  return '⚡ Flipped Clifftop Breaker! Lighthouse Searchlight blacked out for 12s!';
}

function activateSavoiaPropellers(fromShot = false) {
  const nowSec = performance.now() * 0.001;
  if (nowSec < SEA_WORLD_STATE.propBlastUntil) {
    return `🛩️ Gabbiano twin propellers already roaring (${Math.ceil(SEA_WORLD_STATE.propBlastUntil - nowSec)}s)!`;
  }
  SEA_WORLD_STATE.propBlastUntil = nowSec + 11.0;
  const ms = SEA_WORLD_STATE.mechSpots.find((m) => m.id === 'mech_savoia_prop');
  if (ms) ms.cdUntil = nowSec + 11.0;
  if (SEA_WORLD_STATE.slipstreamGroup) SEA_WORLD_STATE.slipstreamGroup.visible = true;
  playWorldMechAudio(SEA_WORLD_STATE.audio, 'flood');
  playWorldMechAudio(SEA_WORLD_STATE.audio, 'steam');
  if (SEA_WORLD_STATE.splash) {
    SEA_WORLD_STATE.splash({ x: SEAPLANE_POS.x + 1.2, y: 0.45, z: SEAPLANE_POS.z + 1.2 }, 22, 2.4);
  }
  if (SEA_WORLD_STATE.emitSoundCue) {
    SEA_WORLD_STATE.emitSoundCue({ x: SEAPLANE_POS.x, y: 1.2, z: SEAPLANE_POS.z }, 18.0, 'chime', null);
  }
  if (fromShot && SEA_WORLD_STATE.notify) {
    SEA_WORLD_STATE.notify('🛩️ Gabbiano Mail Plane Twin Propellers roaring! Slipstream blasts the bay for 11s!', 2500);
  }
  return '🛩️ Fired up Gabbiano Twin Propellers! Slipstream wind blasts the bay for 11s!';
}

// ============================================================================
// MAP_DEF Export
// ============================================================================
export const MAP_DEF = {
  id: 'seaplane',
  title: 'Porto Sereno Seaplane Cove',
  subtitle: '3-tier Adriatic cliff villas, sweeping lighthouse searchlight, pilotable rowboats, harbor cannon & Gabbiano Mail Plane',
  badge: 'Riviera Cove',
  preview: 'assets/maps/seaplane/overview.webp',
  skyPanorama: 'assets/maps/seaplane/sky_panorama.webp',
  skyCylY: 36,
  skyRepeat: 3,
  mapRadius: 32,

  // Hero framing matching `assets/maps/seaplane/overview.webp`!
  camMenu: { r: 34.6, y: 19.8, lookX: 0, lookY: 1.85, lookZ: -1.6, baseAngle: -0.05, sway: 0.14 },
  playerSpawn: [0.0, 0.8],
  seekerSpawns: [[-3.6, -6.2], [3.6, -6.2]],
  seekSpawn: [0.0, 1.4],
  hideIntroHint: '3 Cliff Tiers, Sweeping Searchlight 🔦 (stand still!), Steerable Rowboats 🚣, Harbor Cannon 💣 & Gabbiano Slipstream 🛩️!',
  wildFlyerHint: '🕊️ Wild coastal Seagull or Pelican! Watch for Hiders flapping out over the harbor bay!',
  getInteractHint(mode) {
    return mode === 'seek'
      ? 'Steer Harbor Rowboats 🚣, launch from East Pier Cannon 💣, flip the Breaker ⚡, or spin Gabbiano Props 🛩️!'
      : 'Stand STILL in Searchlight 🔦, flip/shoot Trattoria Breaker ⚡, steer Rowboats 🚣 into Sea-Caves, blast Cannon 💣 & ride Gabbiano Slipstream 🛩️!';
  },
  getInteractSpots() {
    return [
      ...STATIC_CUSTOM_SPOTS,
      ...(SEA_WORLD_STATE.mechSpots || []),
    ];
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
    const pt = info.point;
    if (
      hitObj?.userData?._seaplaneBreaker ||
      (pt && Math.hypot(pt.x - BREAKER_POS.x, pt.z - BREAKER_POS.z) <= 1.4 && Math.abs(pt.y - (BREAKER_POS.y + 1.15)) <= 1.4)
    ) {
      tripLighthouseBreaker(true);
      return { consumed: true, id: 'mech_lighthouse_breaker' };
    }
    if (
      hitObj?.userData?._savoiaSeaplane ||
      (pt && Math.hypot(pt.x - SEAPLANE_POS.x, pt.z - SEAPLANE_POS.z) <= 4.1 && pt.y <= 3.6)
    ) {
      activateSavoiaPropellers(true);
      return { consumed: true, id: 'mech_savoia_prop' };
    }
    return null;
  },
  getSurfaceModifier() {
    return null;
  },
  onResetRound(G) {
    SEA_WORLD_STATE.beaconBlindedUntil = -1;
    SEA_WORLD_STATE.lighthouseTheta = 0;
    SEA_WORLD_STATE.propBlastUntil = -1;
    SEA_WORLD_STATE.cannonRecoil = 0;
    SEA_WORLD_STATE.spotlightCueMap = new WeakMap();
    SEA_WORLD_STATE.slipstreamCooldowns = new WeakMap();
    SEA_WORLD_STATE.pendingCannonLaunches = new WeakMap();
    SEA_WORLD_STATE.cannonCooldowns = new WeakMap();
    SEA_WORLD_STATE.geyserCooldowns = new WeakMap();
    if (SEA_WORLD_STATE.beaconBeam) SEA_WORLD_STATE.beaconBeam.visible = true;
    for (const sc of SEA_WORLD_STATE.beaconSubCones) {
      sc.visible = sc.userData._isForwardCone !== false;
    }
    if (SEA_WORLD_STATE.breakerVisual) SEA_WORLD_STATE.breakerVisual.setTripped(false);
    if (SEA_WORLD_STATE.slipstreamGroup) SEA_WORLD_STATE.slipstreamGroup.visible = false;
    for (const b of DRIFT_ROWBOATS) {
      b.x = b.prevX = b.homeX;
      b.z = b.prevZ = b.homeZ;
      b.rot = b.prevRot = b.homeRot;
      b.dRot = 0;
      b.pilot = null;
      b.moving = false;
      b.movedThisFrame = false;
      b.deckY = 0.15;
      if (b.g) {
        b.g.position.set(b.x, -0.27, b.z);
        b.g.rotation.set(0, b.rot, 0);
      }
    }
    const chars = [
      G?.player,
      ...(G?.seekers || []),
      ...(G?.hiders || []),
      ...(G?.allSeekers || []),
      ...(G?.allHiders || []),
    ];
    for (let i = 0; i < chars.length; i++) {
      if (chars[i]?.userData) chars[i].userData.customPilot = null;
    }
    for (const sp of SEA_WORLD_STATE.mechSpots) sp.cdUntil = 0;
  },
  triggerMechanism(actor, inter, G) {
    if (!inter) return null;
    const nowSec = performance.now() * 0.001;

    if (inter.id === 'mech_lighthouse_breaker') {
      if (inter.cdUntil && nowSec < inter.cdUntil) {
        return `⚡ Searchlight already blacked out (${Math.ceil(inter.cdUntil - nowSec)}s)!`;
      }
      return tripLighthouseBreaker(false);
    }

    if (inter.id === 'mech_savoia_prop') {
      if (inter.cdUntil && nowSec < inter.cdUntil) {
        return `🛩️ Gabbiano twin propellers already roaring (${Math.ceil(inter.cdUntil - nowSec)}s)!`;
      }
      return activateSavoiaPropellers(false);
    }

    if (inter.boatId || String(inter.id || '').startsWith('rowboat_pilot_')) {
      const boatId = inter.boatId || String(inter.id).replace('rowboat_pilot_', '');
      const boat = DRIFT_ROWBOATS.find((b) => b.id === boatId);
      if (!boat || !actor || !actor.userData) return null;
      const u = actor.userData;
      if (u.customPilot === boat.id) {
        u.customPilot = null;
        if (boat.pilot === actor) boat.pilot = null;
        u.vy = 2.4;
        u.jy = Math.max(0.12, u.jy || 0);
        playWorldMechAudio(SEA_WORLD_STATE.audio, 'valve');
        return '🚣 Hopped out of the Harbor Rowboat!';
      }
      if (boat.pilot && boat.pilot !== actor && !boat.pilot.userData?.actor?.eliminated) {
        return '🚣 Someone else is already steering this rowboat!';
      }
      if (u.customPilot) {
        const oldBoat = DRIFT_ROWBOATS.find((b) => b.id === u.customPilot);
        if (oldBoat && oldBoat.pilot === actor) oldBoat.pilot = null;
      }
      boat.pilot = actor;
      u.customPilot = boat.id;
      u.vy = 0;
      u.jy = 0;
      u.gliding = false;
      actor.position.x = boat.x;
      actor.position.z = boat.z;
      u.groundY = boat.deckY;
      actor.rotation.y = boat.rot;
      playWorldMechAudio(SEA_WORLD_STATE.audio, 'valve');
      return '🚣 Piloting Harbor Rowboat! Steer with WASD into sea-caves or press G to hop out!';
    }

    if (inter.id === 'mech_harbor_cannon') {
      if (!actor || !actor.userData) return null;
      const lastBlast = SEA_WORLD_STATE.cannonCooldowns.get(actor) || 0;
      if (nowSec - lastBlast < 1.8) {
        return '💣 Cannon reloading...';
      }
      let targetKey = inter.targetId;
      if (!targetKey) {
        const fz = -Math.cos(G?.yaw || 0);
        targetKey = fz < -0.22 ? 'cliff_terrace' : 'savoia_pier';
      }
      const target = CANNON_TARGETS[targetKey] || CANNON_TARGETS.cliff_terrace;
      if (actor.userData.customPilot) {
        const oldBoat = DRIFT_ROWBOATS.find((b) => b.id === actor.userData.customPilot);
        if (oldBoat && oldBoat.pilot === actor) oldBoat.pilot = null;
        actor.userData.customPilot = null;
      }
      actor.position.set(CANNON_POS.x, CANNON_POS.y + 0.55, CANNON_POS.z);
      actor.userData.groundY = CANNON_POS.y + 0.55;
      actor.userData.jy = 0;
      actor.userData.vy = 0;
      SEA_WORLD_STATE.cannonCooldowns.set(actor, nowSec);
      SEA_WORLD_STATE.pendingCannonLaunches.set(actor, target);
      return '💣 Climbed inside the Crimson Harbor Cannon — FIRE!';
    }

    return null;
  },
  handleCustomMotion(ch, mx, mz, G, dt) {
    if (!ch || !ch.userData) return;
    const boat = DRIFT_ROWBOATS.find((b) => b.id === ch.userData.customPilot);
    if (!boat) return;
    if (!G || G.over || G.spectating || G.phase === 'ready' || ch.userData.ridePath || ch.userData.rideRail || ch.userData.actor?.eliminated) {
      if (G?.over || ch.userData.actor?.eliminated) {
        if (boat.pilot === ch) boat.pilot = null;
        ch.userData.customPilot = null;
      }
      return;
    }
    // Jumping off the boat dismounts cleanly onto piers/ramps/water!
    if ((ch.userData.vy || 0) > 3.5) {
      if (boat.pilot === ch) boat.pilot = null;
      ch.userData.customPilot = null;
      return;
    }

    const safeDt = Math.min(dt || 0.016, 0.05);
    ch.userData.jy = 0;
    ch.userData.vy = 0;
    ch.userData.gliding = false;

    boat.prevX = boat.x;
    boat.prevZ = boat.z;
    boat.prevRot = boat.rot;
    boat.movedThisFrame = true;

    const yaw = G.yaw || 0;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const wx = rx * mx - fx * mz;
    const wz = rz * mx - fz * mz;
    const mag = Math.hypot(wx, wz);

    if (mag > 0.05) {
      const k = clamp(mag, 0, 1);
      const ux = wx / mag;
      const uz = wz / mag;
      const targetYaw = Math.atan2(ux, uz);
      boat.rot = lerpAngle(boat.rot, targetYaw, clamp(safeDt * 6.8, 0, 1));
      boat.dRot = normAngle(boat.rot - boat.prevRot);

      const speed = 7.2 * k;
      const stepX = ux * speed * safeDt;
      const stepZ = uz * speed * safeDt;
      if (canBoatOccupy(boat.x + stepX, boat.z + stepZ, boat.rot, boat)) {
        boat.x += stepX;
        boat.z += stepZ;
      } else if (canBoatOccupy(boat.x + stepX, boat.z, boat.rot, boat)) {
        boat.x += stepX;
      } else if (canBoatOccupy(boat.x, boat.z + stepZ, boat.rot, boat)) {
        boat.z += stepZ;
      }
      boat.moving = true;
      boat.wakeAt = (boat.wakeAt || 0) + safeDt;
      if (boat.wakeAt > 0.22 && SEA_WORLD_STATE.splash) {
        boat.wakeAt = 0;
        SEA_WORLD_STATE.splash({ x: boat.x - Math.sin(boat.rot) * 1.4, y: Y_SEA + 0.08, z: boat.z - Math.cos(boat.rot) * 1.4 }, 4, 1.1);
      }
    } else {
      boat.dRot = 0;
      boat.moving = false;
    }

    boat.g.position.set(boat.x, -0.27 + (boat.bob || 0), boat.z);
    boat.g.rotation.y = boat.rot;

    ch.position.x = boat.x;
    ch.position.z = boat.z;
    ch.userData.groundY = boat.deckY;
    ch.rotation.y = boat.rot;
  },
  sampleLauncherAt(ch, G, _dt) {
    if (!ch || !ch.position || !ch.userData || ch.userData.specialMode || ch.userData.ridePath || ch.userData.rideRail) return null;

    // 1. East Pier Crimson Harbor Cannon pending launch (`rideSpot`, works for Hide AND Seek!)
    const cannonTarget = SEA_WORLD_STATE.pendingCannonLaunches.get(ch);
    if (cannonTarget) {
      SEA_WORLD_STATE.pendingCannonLaunches.delete(ch);
      SEA_WORLD_STATE.cannonRecoil = 1.0;
      if (SEA_WORLD_STATE.cannonPivot) {
        SEA_WORLD_STATE.cannonPivot.rotation.y = Math.atan2(cannonTarget.x - CANNON_POS.x, cannonTarget.z - CANNON_POS.z);
      }
      if (SEA_WORLD_STATE.spawnPuff) {
        SEA_WORLD_STATE.spawnPuff({ x: CANNON_POS.x, y: CANNON_POS.y + 0.9, z: CANNON_POS.z }, 16, 2.2, 0.55, 0.65, 0.8);
      }
      if (SEA_WORLD_STATE.audio) {
        playTurretFireAudio(SEA_WORLD_STATE.audio, 'cannon');
      }
      if (SEA_WORLD_STATE.emitSoundCue) {
        SEA_WORLD_STATE.emitSoundCue({ x: CANNON_POS.x, y: CANNON_POS.y + 1.0, z: CANNON_POS.z }, 18.0, 'chime', null);
      }
      return {
        rideSpot: {
          fromX: CANNON_POS.x,
          fromY: CANNON_POS.y + 0.65,
          fromZ: CANNON_POS.z,
          toX: cannonTarget.x,
          toY: cannonTarget.y,
          toZ: cannonTarget.z,
          dur: 1.55,
          arcY: 7.5,
        },
        hintMsg: cannonTarget.hintMsg,
      };
    }

    if (ch.userData.customPilot) return null;

    const now = performance.now();
    const nowSec = now * 0.001;
    const px = ch.position.x;
    const pz = ch.position.z;
    const py = (ch.userData.groundY ?? ch.position.y) + (ch.userData.jy || 0);

    // 2. Gabbiano Mail Plane Propeller Slipstream Wind Corridor (`knockVx, knockVz` for 11s!)
    if (nowSec < SEA_WORLD_STATE.propBlastUntil && py >= Y_SEA - 0.65 && py <= Y_T1 + 1.25) {
      const rx = px - SLIPSTREAM_START.x;
      const rz = pz - SLIPSTREAM_START.z;
      const along = rx * SLIPSTREAM_DIR.x + rz * SLIPSTREAM_DIR.z;
      const perp = Math.abs(-rx * SLIPSTREAM_DIR.z + rz * SLIPSTREAM_DIR.x);
      if (along >= -0.6 && along <= SLIPSTREAM_LEN && perp <= SLIPSTREAM_HALF_W) {
        const lastPulse = SEA_WORLD_STATE.slipstreamCooldowns.get(ch) || 0;
        if (now - lastPulse >= 240) {
          SEA_WORLD_STATE.slipstreamCooldowns.set(ch, now);
          const isSeeker = ch.userData?.actor?.team === 'seekers' || (ch === G?.player && G?.mode === 'seek');
          if (isSeeker) {
            // Blow Seekers backwards away from Gabbiano/West Pier and clear of fleeing Hiders!
            const nearWestPier = px < -3.8 && pz < 19.6;
            return {
              knockVx: nearWestPier ? 7.8 : -4.2,
              knockVz: nearWestPier ? 7.6 : 9.8,
              vy: nearWestPier ? 2.8 : 1.8,
              hintMsg: '🛩️ Blown back by the Gabbiano Mail Plane Propeller Slipstream!',
            };
          }
          return {
            knockVx: SLIPSTREAM_DIR.x * 13.8,
            knockVz: SLIPSTREAM_DIR.z * 13.8,
            hintMsg: '🛩️ Gabbiano Propeller Slipstream! Turbo-boosting across the bay!',
          };
        }
      }
    }

    // 3. Sea-Cave Thermal Bubble Geysers (`rideSpot` vertical escapes onto Quays)
    const last = SEA_WORLD_STATE.geyserCooldowns.get(ch) || 0;
    if (now - last < 2400) return null;
    for (let i = 0; i < SEA_WORLD_STATE.geysers.length; i++) {
      const g = SEA_WORLD_STATE.geysers[i];
      if (Math.abs(py - g.fromY) <= 0.95 && Math.hypot(px - g.fromX, pz - g.fromZ) <= g.r) {
        SEA_WORLD_STATE.geyserCooldowns.set(ch, now);
        playWorldMechAudio(SEA_WORLD_STATE.audio, 'spring');
        return {
          rideSpot: {
            fromX: g.fromX,
            fromY: g.fromY,
            fromZ: g.fromZ,
            toX: g.toX,
            toY: g.toY,
            toZ: g.toZ,
            dur: g.dur,
            arcY: g.arcY,
          },
          hintMsg: g.hintMsg,
        };
      }
    }
    return null;
  },

  sky: {
    top: 0x2482e0,
    mid: 0x7ec9f8,
    bot: 0xfff3d8,
    sunDisc: 0xfff4c6,
    sunDir: [-0.42, 0.54, 0.73],
  },
  fog: { color: 0x7cc4f0, near: 62, far: 165 },
  lights: {
    hemiSky: 0x8fd2ff,
    hemiGround: 0x7c5d42,
    hemiInt: 1.02,
    sunColor: 0xffe2ad,
    sunInt: 2.12,
    sunPos: [-18, 28, 22],
    exposure: 0.94,
  },

  props: PROPS,
  propIcons: PROP_ICONS,
  buildingDefs: BUILDING_DEFS,
  seekerKinds: SEEKER_DEFS.map((s) => s.id),
  seekerLabels: Object.fromEntries(SEEKER_DEFS.map((s) => [s.id, s.label])),
  hiderSkin: HIDER_DEF,
  buildProps: buildMapProps,
  buildBuildings,
  buildSeeker: buildMapSeeker,
  buildHider: buildMapHider,

  // Both `groundHeightAt` (used by `main.js`) and `sampleHeight` alias!
  groundHeightAt(x, z, refY) {
    return sampleSeaplaneHeight(x, z, refY);
  },
  sampleHeight(x, z, refY) {
    return sampleSeaplaneHeight(x, z, refY);
  },

  isSwimmableWater(x, z) {
    if (Math.hypot(x, z) > 29.5) return false;
    if (SEA_WORLD_STATE.tracks && SEA_WORLD_STATE.tracks.getPlatformGroundY(x, z, Y_T1) !== null) return false;
    if (sampleRowboatDeck(x, z)) return false;
    return sampleStaticTerrainHeight(x, z) <= -0.20;
  },

  isDeepWater(x, z) {
    // Open turquoise bay inside r <= 29.5 is 100% SWIMMABLE (`false`); deep ocean boundary outside `r > 29.5`!
    return Math.hypot(x, z) > 29.5;
  },

  routeTierWaypoint(from, goal) {
    return routeSeaplaneWaypoint(from, goal);
  },

  getRowboats() {
    return DRIFT_ROWBOATS;
  },

  applyPlatformMotion(c, dt = 0.016) {
    if (!c || !c.position) return;
    if (c.userData?.customPilot) return;
    if (SEA_WORLD_STATE.tracks) SEA_WORLD_STATE.tracks.applyMotion(c, dt);
    const footY = c.userData?.groundY ?? c.position.y;
    for (let i = 0; i < DRIFT_ROWBOATS.length; i++) {
      const b = DRIFT_ROWBOATS[i];
      if (Math.abs(footY - b.deckY) > 0.65) continue;
      // Carry standing non-pilot passengers cleanly on the rowboat deck
      const prevBoat = { x: b.prevX, z: b.prevZ, rot: b.prevRot };
      if (pointInRowboat(c.position.x, c.position.z, prevBoat, 1.06) || pointInRowboat(c.position.x, c.position.z, b, 1.06)) {
        const relX = c.position.x - b.prevX;
        const relZ = c.position.z - b.prevZ;
        const dAng = b.dRot || 0;
        const cs = Math.cos(dAng), sn = Math.sin(dAng);
        c.position.x = b.x + (relX * cs + relZ * sn);
        c.position.z = b.z + (-relX * sn + relZ * cs);
        c.rotation.y += dAng;
        return;
      }
    }
  },

  getNearbyInteraction(player, G) {
    if (!player || !player.position) return null;
    const px = player.position.x;
    const pz = player.position.z;
    const py = (player.userData?.groundY ?? player.position.y) + (player.userData?.jy || 0);
    const u = player.userData || {};

    // If already disguised in a Sea Float or Cliff Balcony Ledge, allow toggling cleanly out!
    if (u.specialMode === 'custom_spot' && u.specialSpot) {
      return Object.assign({}, u.specialSpot, {
        label: u.specialSpot.leaveLabel || 'Step Out of Disguise',
      });
    }

    // If piloting a Steerable Harbor Rowboat, always allow hopping out with Interact!
    if (u.customPilot) {
      const pilotedBoat = DRIFT_ROWBOATS.find((b) => b.id === u.customPilot);
      if (pilotedBoat) {
        return {
          id: `rowboat_pilot_${pilotedBoat.id}`,
          kind: 'mechanism',
          boatId: pilotedBoat.id,
          icon: '🚣',
          label: 'Hop Out of Rowboat (G)',
          x: pilotedBoat.x,
          y: pilotedBoat.deckY,
          z: pilotedBoat.z,
        };
      }
    }

    if (u.ridePath || u.rideRail) return null;

    // 1. West Pier <-> Trattoria Cargo Crane Boomsling (`kind: 'ride_path'`)
    for (let i = 0; i < CRANE_SLINGS.length; i++) {
      const cs = CRANE_SLINGS[i];
      if (Math.hypot(px - cs.trigX, pz - cs.trigZ) <= 2.35 && Math.abs(py - cs.fromY) <= 1.25) {
        return { ...cs, kind: 'ride_path' };
      }
    }

    // 2. East Pier Crimson Harbor Cannon (Human-Launcher — Hide OR Seek!)
    const nowSec = performance.now() * 0.001;
    if (Math.abs(py - CANNON_POS.y) <= 1.35 && Math.hypot(px - CANNON_POS.x, pz - CANNON_POS.z) <= CANNON_POS.trigR) {
      const fz = -Math.cos(G?.yaw || 0);
      const target = fz < -0.22 ? CANNON_TARGETS.cliff_terrace : CANNON_TARGETS.savoia_pier;
      return {
        id: 'mech_harbor_cannon',
        kind: 'mechanism',
        icon: '💣',
        label: target.label,
        targetId: target.id,
        x: CANNON_POS.x,
        y: CANNON_POS.y,
        z: CANNON_POS.z,
      };
    }

    // 3. Clifftop Power Breaker & Gabbiano Mail Plane Twin Propellers (`kind: 'mechanism'`)
    for (let i = 0; i < SEA_WORLD_STATE.mechSpots.length; i++) {
      const ms = SEA_WORLD_STATE.mechSpots[i];
      if (ms.boatId || ms.id === 'mech_harbor_cannon') continue;
      const yTol = ms.yTol || 1.35;
      if (Math.abs(py - ms.y) <= yTol && Math.hypot(px - ms.x, pz - ms.z) <= (ms.trigR || 2.5)) {
        const rem = Math.ceil((ms.cdUntil || 0) - nowSec);
        return {
          ...ms,
          label: rem > 0 ? `${ms.baseLabel} (${rem}s)` : ms.baseLabel,
        };
      }
    }

    // 4. Steerable Pilotable Wooden Harbor Rowboats (`kind: 'mechanism'`, Hide OR Seek!)
    let bestBoat = null;
    let bestBoatD = Infinity;
    for (let i = 0; i < DRIFT_ROWBOATS.length; i++) {
      const boat = DRIFT_ROWBOATS[i];
      if (boat.pilot && boat.pilot !== player && !boat.pilot.userData?.actor?.eliminated) continue;
      const d = Math.hypot(px - boat.x, pz - boat.z);
      if (d <= 3.25 && Math.abs(py - boat.deckY) <= 1.35 && d < bestBoatD) {
        bestBoat = boat;
        bestBoatD = d;
      }
    }

    // 5. Static Custom Spots: Floating Sea Disguises (`mobile: true`) & Cliffside Balcony Flower Ledges (Hide only!)
    let bestSpot = null;
    let bestSpotD = Infinity;
    if (!G || G.mode === 'hide') {
      for (let i = 0; i < STATIC_CUSTOM_SPOTS.length; i++) {
        const sp = STATIC_CUSTOM_SPOTS[i];
        const d = Math.hypot(px - sp.trigX, pz - sp.trigZ);
        if (d <= sp.trigR && Math.abs(py - sp.trigY) <= 1.25 && d < bestSpotD) {
          bestSpot = sp;
          bestSpotD = d;
        }
      }
    }

    if (bestBoat && (!bestSpot || bestBoatD <= bestSpotD)) {
      return {
        id: `rowboat_pilot_${bestBoat.id}`,
        kind: 'mechanism',
        boatId: bestBoat.id,
        icon: '🚣',
        label: 'Pilot Harbor Rowboat (G)',
        x: bestBoat.x,
        y: bestBoat.deckY,
        z: bestBoat.z,
      };
    }
    return bestSpot;
  },

  buildCustomSpotDisguise(THREE, spot) {
    return buildCustomDisguiseMesh(THREE, spot);
  },

  groundColorAt(x, z, outColor) {
    const hex = computeGroundHex(x, z);
    if (outColor && typeof outColor.setHex === 'function') return outColor.setHex(hex);
    return _THREE ? new _THREE.Color(hex) : hex;
  },

  surfaceAt(x, z) {
    if (
      (SEA_WORLD_STATE.tracks && SEA_WORLD_STATE.tracks.getPlatformGroundY(x, z, Y_T1) !== null) ||
      sampleRowboatDeck(x, z) ||
      isOnPierDeck(x, z)
    ) {
      return 'wood';
    }
    if (this.isSwimmableWater(x, z)) return 'water';
    if (Math.hypot(x, z) > 22.0 && z < 2.0) return 'grass';
    return 'stone';
  },

  buildWorld(ctx) {
    if (SEA_WORLD_STATE.creatures) {
      SEA_WORLD_STATE.creatures.dispose();
      SEA_WORLD_STATE.creatures = null;
    }
    SEA_WORLD_STATE.mechSpots = [];
    SEA_WORLD_STATE.geysers = [];
    SEA_WORLD_STATE.skiffs = [];
    SEA_WORLD_STATE.boatObstacles = [];
    SEA_WORLD_STATE.beaconBlindedUntil = -1;
    SEA_WORLD_STATE.lighthouseTheta = 0;
    SEA_WORLD_STATE.propBlastUntil = -1;
    SEA_WORLD_STATE.cannonRecoil = 0;
    SEA_WORLD_STATE.beaconBeam = null;
    SEA_WORLD_STATE.beaconSubCones = [];
    SEA_WORLD_STATE.slipstreamGroup = null;
    SEA_WORLD_STATE.breakerVisual = null;
    SEA_WORLD_STATE.cannonPivot = null;
    SEA_WORLD_STATE.cannonBarrel = null;
    SEA_WORLD_STATE.geyserCooldowns = new WeakMap();
    SEA_WORLD_STATE.slipstreamCooldowns = new WeakMap();
    SEA_WORLD_STATE.pendingCannonLaunches = new WeakMap();
    SEA_WORLD_STATE.cannonCooldowns = new WeakMap();
    SEA_WORLD_STATE.spotlightCueMap = new WeakMap();
    SEA_WORLD_STATE.whereIs = ctx.whereIs || null;
    SEA_WORLD_STATE.splash = ctx.splash || null;
    SEA_WORLD_STATE.spawnPuff = ctx.spawnPuff || null;
    SEA_WORLD_STATE.notify = ctx.notify || ctx.pushFeed || null;
    SEA_WORLD_STATE.emitSoundCue = ctx.emitSoundCue || null;
    SEA_WORLD_STATE.audio = ctx.audio || null;

    SEA_WORLD_STATE.tracks = createMovingTrackSystem(ctx.THREE);
    const { THREE, root } = ctx;
    _THREE = THREE;
    const B = buildBuildings(THREE);
    const putKit = (g, x, z, rot = 0, y = 0) =>
      ctx.placeKit ? ctx.placeKit(g, x, z, rot, y) : (g.position.set(x, y, z), (g.rotation.y = rot), root.add(g), g);
    const putVisual = (g, x, y, z, rot = 0) => {
      g.position.set(x, y, z);
      g.rotation.y = rot;
      root.add(g);
      return g;
    };

    // 1. Luminous shallow-to-deep Mediterranean seabed + sparkling animated swimmable turquoise bay (`y = -0.32m`)
    const seabedGeo = new THREE.CircleGeometry(98, 48);
    seabedGeo.rotateX(-PI / 2);
    const seabed = new THREE.Mesh(
      seabedGeo,
      new THREE.MeshStandardMaterial({
        color: 0x52c8d4,
        roughness: 0.94,
        metalness: 0,
      })
    );
    seabed.position.y = -1.35;
    root.add(seabed);

    const water = createAnimatedWater(THREE, {
      radius: 96,
      y: Y_SEA + 0.02,
      walkable: false,
      deep: 0x1568a8,
      shallow: 0x32c6de,
      foam: 0xf4fdff,
      opacity: 0.85,
      scale: 0.38,
    });
    root.add(water.mesh);

    // 2. Three-Tier Dalmatian Limestone Terraces, Wide Stone Staircases, Slipways & Balustrades
    putKit(buildThreeTierHarbor(THREE), 0, 0, 0, 0);

    // 3. Two Wide Walkable Wooden Piers on Tier 1 (`y = 0.75m`) w/ Seaward Wooden Water Step-Ramps!
    putKit(
      B.woodenPier({ length: PIER_WEST.len, width: PIER_WEST.w, hasCrane: true, waterRamp: true, seed: 11 }),
      PIER_WEST.x,
      PIER_WEST.z,
      0,
      Y_T1
    );
    putKit(
      B.woodenPier({ length: PIER_EAST.len, width: PIER_EAST.w, hasCrane: false, waterRamp: true, seed: 22 }),
      PIER_EAST.x,
      PIER_EAST.z,
      0,
      Y_T1
    );

    // 4. Sea-Spot Markers
    const seaSpotVis = buildSeaSpotMarkers(THREE);
    root.add(seaSpotVis.group);

    // 5.Standable Harbor Benches across Tier 1, Tier 2 & Tier 3
    if (ctx.placeKit) buildStandableHarborBenches(THREE, ctx);

    // 6. White Dalmatian Sea Cliffs, Sea-Arch Bridges, Roman Viaduct & Cypress/Olive Groves
    putKit(buildCoastalBackdrop(THREE), 0, 0, 0, 0);
    const swayingHerbs = createSwayingBlades(THREE, {
      count: 1100,
      height: 0.45,
      width: 0.05,
      spread: 28,
      color: 0x6ea34c,
      seed: 73,
      filter: (x, z) => {
        const r = Math.hypot(x, z);
        return z < -13.5 && r > 21.5 && r < 26.5;
      },
    });
    swayingHerbs.inst.position.y = Y_T3;
    root.add(swayingHerbs.inst);

    // 7. Tier 2 Centerpiece Seahorse Fountain (`(0, -3.2)`) + 2 Octagonal Harbor Kiosks flanking the mosaic (`y = 2.10m`)
    const fountainPos = { x: 0.0, y: Y_T2, z: -3.2 };
    putKit(B.seahorseFountain({ seed: 3 }), fountainPos.x, fountainPos.z, 0, Y_T2);
    putKit(B.harborKiosk({ stripeHex: 0xe26b89, baseHex: 0x9cc09a, theme: 'gelato', seed: 5 }), -6.2, -1.4, 0.35, Y_T2);
    putKit(B.harborKiosk({ stripeHex: 0x2b6cb5, baseHex: 0xc89a62, theme: 'seafood', seed: 9 }), 6.2, -1.4, -0.35, Y_T2);

    // 8. Five Enterable 2-Room Buildings across all 3 Mediterranean Elevations!
    //   - Tier 1 (`y = 0.75m`): Gabbiano Seaplane Hangar (West Quay) & Fisherman Boathouse (East Quay)
    //   - Tier 2 (`y = 2.10m`): Trattoria Bella Vista (West Piazzetta Terrace)
    //   - Tier 3 (`y = 4.20m`): Harbor Lighthouse (NW Cliff Crown) & Coastal Gelateria (NE Cliff Terrace)
    const hangar = putKit(B.sereno_hangar({ seed: 101, garden: false }), -18.8, 9.2, 1.35, Y_T1);
    putKit(B.boathouse_loft({ seed: 105, garden: false }), 18.8, 9.2, -1.35, Y_T1);
    putKit(B.adriano_trattoria({ seed: 102, garden: false }), -15.6, -4.2, PI / 2, Y_T2);
    const lighthouse = putKit(B.harbor_lighthouse({ seed: 103, garden: false }), -8.2, -20.2, 0, Y_T3);
    putKit(B.coastal_gelateria({ seed: 104, garden: false }), 9.8, -20.0, 0, Y_T3);

    const windsock = hangar.getObjectByName('windsock');
    const beacon = lighthouse.getObjectByName('beacon');

    // 9. Moored Cream-and-Teal Gabbiano Twin-Prop Mail Floatplane + 2 Steerable Pilotable Harbor Rowboats + 1 Scenic Skiff!
    const seaplane = putVisual(B.crimsonSeaplane({ seed: 7 }), SEAPLANE_POS.x, SEAPLANE_POS.y, SEAPLANE_POS.z, SEAPLANE_POS.rot);
    const propeller = seaplane.getObjectByName('propeller');
    const spMc = createMatCache(THREE);
    // Add the matching STARBOARD engine propeller (mirrored mount) so the mail biplane spins TWIN propellers!
    const propellerRear = new THREE.Group();
    propellerRear.name = 'propeller_rear';
    propellerRear.position.fromArray(seaplane.userData.propMounts?.starboard || [1.6, 2.05, 1.94]);
    {
      const brassM = spMc(0xe6b448, { roughness: 0.38 });
      const propWoodM = spMc(0x9e5324, { roughness: 0.44 });
      const tipWhiteM = spMc(0xfbf8ef, { roughness: 0.42 });
      const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 14), brassM);
      spinner.rotation.x = PI / 2;
      spinner.position.z = 0.10;
      propellerRear.add(spinner);
      for (const s of [-1, 1]) {
        const blade = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.84, 0.045, 2, 0.02), propWoodM);
        blade.position.set(0, s * 0.45, 0);
        blade.rotation.y = -s * 0.22;
        propellerRear.add(blade);
        const tip = new THREE.Mesh(new RoundedBoxGeometry(0.175, 0.14, 0.048, 1, 0.014), tipWhiteM);
        tip.position.set(0, s * 0.80, 0);
        tip.rotation.y = -s * 0.22;
        propellerRear.add(tip);
      }
      seaplane.add(propellerRear);
    }
    seaplane.traverse((m) => {
      if (m.isMesh) {
        m.userData._savoiaSeaplane = true;
        m.userData.keep = true;
        if (ctx.solids) ctx.solids.push(m);
      }
    });

    DRIFT_ROWBOATS = [
      {
        id: 'cobalt',
        g: putVisual(B.rowboat({ trimHex: 0x2b6cb5, seed: 31 }), -2.85, -0.27, 12.8, 0),
        homeX: -2.85,
        homeZ: 12.8,
        homeRot: 0,
        phase: 0.0,
        x: -2.85,
        z: 12.8,
        prevX: -2.85,
        prevZ: 12.8,
        rot: 0,
        prevRot: 0,
        dRot: 0,
        deckY: 0.15,
        bob: 0,
        pilot: null,
        moving: false,
        movedThisFrame: false,
      },
      {
        id: 'coral',
        g: putVisual(B.rowboat({ trimHex: 0xc93b2f, seed: 32 }), 3.0, -0.27, 14.8, 0),
        homeX: 3.0,
        homeZ: 14.8,
        homeRot: 0,
        phase: 2.2,
        x: 3.0,
        z: 14.8,
        prevX: 3.0,
        prevZ: 14.8,
        rot: 0,
        prevRot: 0,
        dRot: 0,
        deckY: 0.15,
        bob: 0,
        pilot: null,
        moving: false,
        movedThisFrame: false,
      },
    ];
    for (const b of DRIFT_ROWBOATS) {
      b.g.position.set(b.x, -0.27, b.z);
      b.g.rotation.y = b.rot;
    }
    const mooredSkiff = putVisual(B.rowboat({ trimHex: 0x2b6cb5, seed: 33 }), 11.2, -0.27, 17.6, 1.18);

    // 10. 16 Outdoor Prop Vignettes distributed cleanly across Tier 3, Tier 2, Tier 1 & Both Piers!
    if (ctx.addVig) {
      const vignettes = [
        // Tier 3 Upper Cliff Villa Terrace (`Y_T3 = 4.20m`)
        [-15.2, -14.8, [['sp_olive_amphora', 0, 0, 0.4], ['sp_lemon_planter', 1.0, 0.5, -0.3], ['sp_bistro_set', -1.2, 0.8, 0.6], ['sp_sea_chest', 0.9, -0.9, 1.2]], 1, Y_T3],
        [-0.4, -18.5, [['sp_anchor_bollard', 0, 0, -0.2], ['sp_pelican_post', 1.1, 0.4, -0.4], ['sp_sea_chest', -1.0, 0.3, 0.3], ['sp_buoy_float', -0.6, -0.9, 0.8], ['sp_lemon_planter', 1.2, -0.8, -1.1]], 1, Y_T3],
        [3.2, -18.2, [['sp_bistro_set', 0, 0, -0.3], ['sp_lemon_planter', -1.1, 0.6, 0.2], ['sp_olive_amphora', 1.0, -0.7, 1.1], ['sp_wine_rack', 1.1, 0.8, -0.6]], 1, Y_T3],
        [16.6, -15.2, [['sp_gelato_cart', 0, 0, -0.6], ['sp_bistro_set', -1.3, 0.9, -0.2], ['sp_lemon_planter', 1.0, 0.8, 0.4], ['sp_olive_amphora', 0.8, -1.0, 1.3]], 1, Y_T3],

        // Tier 2 Mid Compass-Rose Piazzetta & Trattoria Patio (`Y_T2 = 2.10m`)
        [-9.2, -8.8, [['sp_bistro_set', 0, 0, 0.3], ['sp_bistro_set', 1.8, 0.4, -0.2], ['sp_wine_rack', -1.3, -0.7, 0.5], ['sp_lemon_planter', -1.2, 0.9, 0.1], ['sp_olive_amphora', 1.1, -1.0, 1.8]], 2, Y_T2],
        [-9.4, -1.2, [['sp_bistro_set', 0, 0, 0.5], ['sp_lemon_planter', -1.0, 0.8, -0.3], ['sp_wine_rack', -1.1, -0.8, 0.9], ['sp_olive_amphora', 0.9, 0.9, -1.1]], 1, Y_T2],
        [-6.6, -4.1, [['sp_gelato_cart', 0, 0, 0.5], ['sp_lemon_planter', -0.9, -0.6, 0.2], ['sp_olive_amphora', 0.8, 0.9, 1.1]], 1, Y_T2],
        [6.8, -4.1, [['sp_lobster_trap', 0, 0, -0.4], ['sp_buoy_float', 0.9, -0.6, 0.3], ['sp_olive_amphora', -0.8, 0.9, -1.2], ['sp_sea_chest', 1.0, 0.8, -0.8]], 1, Y_T2],
        [11.8, -5.2, [['sp_bistro_set', 0, 0, -0.9], ['sp_lemon_planter', 0.9, 1.0, 0.2], ['sp_lemon_planter', 0.8, -1.0, -0.6], ['sp_olive_amphora', -0.9, -0.9, 1.5], ['sp_wine_rack', 1.3, 0.1, -1.0]], 1, Y_T2],
        [15.4, -1.8, [['sp_bistro_set', 0, 0, -1.2], ['sp_olive_amphora', 0.9, -0.9, 0.4], ['sp_lemon_planter', 0.95, 0.95, -0.7], ['sp_sea_chest', -0.9, 1.0, -1.4]], 1, Y_T2],

        // Tier 1 Lower Harbor Quay & Both Walkable Wooden Piers (`Y_T1 = 0.75m`)
        [-14.2, 13.4, [['sp_fuel_drum', 0, 0, 0.4], ['sp_fuel_drum', 0.75, -0.45, -0.6], ['sp_propeller_stand', -1.1, 0.6, 0.9], ['sp_sea_chest', 0.9, 0.6, 1.2], ['sp_anchor_bollard', 1.3, -0.3, -0.3]], 1, Y_T1],
        [14.4, 13.4, [['sp_lobster_trap', 0, 0, -1.6], ['sp_lobster_trap', 0.85, -0.5, -1.3], ['sp_buoy_float', -0.9, 0.6, 0.5], ['sp_anchor_bollard', -0.95, -0.6, 2.4], ['sp_pelican_post', 0.9, 0.6, -2.1]], 1, Y_T1],
        // West Seaplane Pier edge vignettes (keeping center `x = -6.2` wide open for zipline & water ramp!)
        [-5.05, 11.4, [['sp_fuel_drum', 0, -0.8, 0.3], ['sp_propeller_stand', -0.05, 0.35, -1.57], ['sp_anchor_bollard', -2.25, -0.9, 1.57], ['sp_buoy_float', -2.2, 0.9, 1.4]], 1, Y_T1],
        [-5.05, 17.2, [['sp_pelican_post', 0, 0.35, -1.57], ['sp_anchor_bollard', -2.25, 0.4, 1.57], ['sp_sea_chest', 0, -0.75, -1.57], ['sp_lobster_trap', -2.2, -0.7, 1.57]], 1, Y_T1],
        // East Fisherman Pier edge vignettes (keeping center `x = +6.4` wide open for zipline & water ramp!)
        [7.55, 11.3, [['sp_lobster_trap', 0, -0.8, -1.57], ['sp_buoy_float', -0.05, 0.35, -1.4], ['sp_pelican_post', -2.25, -0.6, 1.57], ['sp_anchor_bollard', -2.25, 0.85, 1.57]], 1, Y_T1],
        [7.55, 16.8, [['sp_lobster_trap', 0, 0.35, -1.57], ['sp_lobster_trap', -2.25, 0.35, 1.57], ['sp_buoy_float', -2.25, -0.75, 1.2], ['sp_olive_amphora', 0, -0.7, -1.1]], 1, Y_T1],
      ];
      for (const [cx, cz, items, openCount, cy] of vignettes) {
        ctx.addVig(cx, cz, items, openCount, cy);
      }
    }

    // 11. Spouting Seahorse Fountain Droplets on Tier 2 (`48` instanced crystal droplets)
    const dropCount = 48;
    const dropInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.048, 7, 6),
      new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.85 }),
      dropCount
    );
    dropInst.frustumCulled = false;
    root.add(dropInst);
    const jetArcs = [
      [[0, 2.90, 0.55], [0, 3.06, 0.92], [0, 1.88, 1.14], [0, 0.62, 1.18]],
      [[-0.18, 1.75, 0.1], [-0.62, 1.92, 0.38], [-0.98, 1.22, 0.54], [-1.08, 0.62, 0.58]],
      [[0.18, 1.75, 0.1], [0.62, 1.92, 0.38], [0.98, 1.22, 0.54], [1.08, 0.62, 0.58]],
      [[0, 1.68, -0.15], [0, 1.88, -0.62], [0, 1.18, -0.98], [0, 0.62, -1.08]],
    ].map(
      (pts) =>
        new THREE.CatmullRomCurve3(
          pts.map(([x, y, z]) => new THREE.Vector3(fountainPos.x + x, fountainPos.y + y, fountainPos.z + z))
        )
    );
    const dDummy = new THREE.Object3D();
    const dPt = new THREE.Vector3();

    // 11B. East Pier's Crimson Harbor Cannon (Sea of Thieves Human-Launcher -> Cliffside Terrace / Gabbiano Pier!)
    {
      const cannonGrp = new THREE.Group();
      cannonGrp.name = 'crimson_harbor_cannon';
      cannonGrp.position.set(CANNON_POS.x, CANNON_POS.y, CANNON_POS.z);
      cannonGrp.userData.keep = true;

      const oakMat = spMc(0x7c4f28, { roughness: 0.85 });
      const oakDarkMat = spMc(0x4e3018, { roughness: 0.88 });
      const crimsonMat = spMc(0xc92a2a, { roughness: 0.46 });
      const brassMat = spMc(0xe6b448, { roughness: 0.42 });
      const ironMat = spMc(0x3b4048, { roughness: 0.65 });

      const baseRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.88, 0.055, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffcf56, transparent: true, opacity: 0.82 })
      );
      baseRing.rotation.x = PI / 2;
      baseRing.position.y = 0.04;
      baseRing.userData.noSolid = true;
      cannonGrp.add(baseRing);

      const cannonPivot = new THREE.Group();
      cannonPivot.position.y = 0.24;
      cannonPivot.rotation.y = Math.atan2(CANNON_TARGETS.cliff_terrace.x - CANNON_POS.x, CANNON_TARGETS.cliff_terrace.z - CANNON_POS.z);
      cannonGrp.add(cannonPivot);

      const carriage = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.26, 0.96, 1, 0.04), oakMat);
      carriage.position.y = 0.14;
      carriage.castShadow = true;
      cannonPivot.add(carriage);
      for (const sx of [-0.38, 0.38]) {
        for (const sz of [-0.30, 0.30]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), oakDarkMat);
          wheel.rotation.z = PI / 2;
          wheel.position.set(sx, 0.02, sz);
          wheel.castShadow = true;
          cannonPivot.add(wheel);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.10, 8), ironMat);
          hub.rotation.z = PI / 2;
          hub.position.set(sx, 0.02, sz);
          cannonPivot.add(hub);
        }
      }

      const barrelGrp = new THREE.Group();
      barrelGrp.position.set(0, 0.46, 0.05);
      barrelGrp.rotation.x = -0.54; // Tilted heroically skyward for cove-spanning human launches!
      cannonPivot.add(barrelGrp);

      const breech = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), crimsonMat);
      breech.position.set(0, 0, -0.34);
      breech.castShadow = true;
      barrelGrp.add(breech);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), brassMat);
      knob.position.set(0, 0, -0.62);
      barrelGrp.add(knob);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.34, 16), crimsonMat);
      tube.rotation.x = PI / 2;
      tube.position.set(0, 0, 0.28);
      tube.castShadow = true;
      barrelGrp.add(tube);
      const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.055, 8, 18), brassMat);
      muzzleRing.position.set(0, 0, 0.94);
      barrelGrp.add(muzzleRing);
      const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), ironMat);
      bore.rotation.x = PI / 2;
      bore.position.set(0, 0, 0.93);
      barrelGrp.add(bore);

      root.add(cannonGrp);
      if (ctx.addWorldObb) {
        ctx.addWorldObb(CANNON_POS.x, CANNON_POS.z, 0.46, 0.56, 0, CANNON_POS.y - 0.1, CANNON_POS.y + 1.1, false);
      }
      SEA_WORLD_STATE.cannonPivot = cannonPivot;
      SEA_WORLD_STATE.cannonBarrel = barrelGrp;
    }

    // 11C. Two Swimmable Dalmatian Limestone Sea-Caves (West Sea Grotto & East Blue Grotto!)
    const caveStoneMat = spMc(0xe6dcc6, { roughness: 0.92 });
    const caveShadeMat = spMc(0xc2b69e, { roughness: 0.94 });
    const caveGlowMat = spMc(0x4beeff, { emissive: 0x26d4f2, emissiveIntensity: 0.85, roughness: 0.25 });
    const caveMossMat = spMc(0x529448, { roughness: 0.88 });
    const caveGrp = new THREE.Group();
    caveGrp.name = 'swimmable_sea_caves';

    const buildSeaCave = (cx, cz, innerToCenterDirX) => {
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      // Vaulted stone grotto ring pillars framing TWO wide open swim mouths:
      // 1) Harbor-facing mouth toward center bay (-innerToCenterDirX * (-1) -> inward toward center bay!)
      // 2) Southern seaward opening toward z > cz
      // Keep north-outer rock arc closed as a walkable/swimmable grotto back wall!
      const wallAngles = [];
      // Cover only outer coastal quadrant away from harbor + south channel
      const baseBackAng = innerToCenterDirX < 0 ? PI : 0; // west cave outer is -X (PI), east cave outer is +X (0)
      for (let k = -2; k <= 2; k++) {
        wallAngles.push(baseBackAng - k * 0.44);
      }
      wallAngles.forEach((a, idx) => {
        const px = Math.cos(a) * 3.1;
        const pz = Math.sin(a) * 3.1;
        const pillar = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 0), idx % 2 ? caveStoneMat : caveShadeMat);
        pillar.scale.set(1.15, 2.35, 1.15);
        pillar.position.set(px, 0.95, pz);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        g.add(pillar);
        if (ctx.solids) ctx.solids.push(pillar);
        if (ctx.addWorldObb) {
          ctx.addWorldObb(cx + px, cz + pz, 1.05, 1.05, a, Y_SEA - 0.4, Y_SEA + 3.4, false);
        }
        SEA_WORLD_STATE.boatObstacles.push({ x: cx + px, z: cz + pz, r: 1.22 });
      });

      // Overhead dome limestone vault arch (`y = 2.65..3.9m`, clearing swimmers completely!)
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU;
        const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(1.85, 0), k % 2 ? caveStoneMat : caveShadeMat);
        cap.scale.set(1.35, 0.68, 1.35);
        cap.position.set(Math.cos(ang) * 1.45, 2.88 + (k % 2) * 0.22, Math.sin(ang) * 1.45);
        cap.castShadow = true;
        cap.receiveShadow = true;
        g.add(cap);
        if (ctx.solids) ctx.solids.push(cap);
      }
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.15, 0), caveStoneMat);
      crown.scale.set(1.25, 0.52, 1.25);
      crown.position.set(0, 3.45, 0);
      crown.castShadow = true;
      g.add(crown);

      // Cliff-top moss & Mediterranean grass cap
      const capMoss = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), caveMossMat);
      capMoss.scale.set(1.3, 0.4, 1.2);
      capMoss.position.set(innerToCenterDirX < 0 ? -0.6 : 0.6, 3.82, -0.4);
      g.add(capMoss);

      // Bioluminescent azure sea-crystal clusters shimmering over the grotto water
      for (let c = 0; c < 4; c++) {
        const ang = baseBackAng + (c - 1.5) * 0.62;
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), caveGlowMat);
        cr.scale.set(0.7, 1.8, 0.7);
        cr.position.set(Math.cos(ang) * 2.15, 0.42 + (c % 2) * 0.45, Math.sin(ang) * 2.15);
        cr.rotation.set(0.25, ang, 0.3);
        g.add(cr);
      }
      caveGrp.add(g);
    };
    buildSeaCave(-17.0, 19.8, -1); // West Sea-Cave Grotto
    buildSeaCave(17.0, 19.8, 1);   // East Blue Grotto Cave
    root.add(caveGrp);

    // Record coastal rock shores, Gabbiano Mail Plane & moored scenic skiff for steerable rowboat collision!
    SEA_WORLD_STATE.boatObstacles.push(
      { x: -24.8, z: 16.2, r: 3.1 },
      { x: -19.8, z: 16.4, r: 2.05 },
      { x: 19.8, z: 16.4, r: 2.15 },
      { x: 24.8, z: 16.4, r: 3.4 },
      { x: 11.2, z: 17.6, r: 1.5 },
      { x: -12.6, z: 16.4, r: 1.75 },
      { x: -11.3, z: 17.7, r: 1.2 },
      { x: -13.9, z: 15.1, r: 1.2 },
      { x: -10.3, z: 14.1, r: 0.9 },
      { x: -14.9, z: 18.7, r: 0.9 }
    );

    // 11D. Open Seagull & Pelican Prop Slots (`ctx.addSlot`) for chip & AI disguises
    if (ctx.addSlot) {
      ctx.addSlot('sp_seagull', -6.2, 10.6, 0.2, Y_T1);
      ctx.addSlot('sp_pelican', 6.4, 10.6, -0.3, Y_T1);
      ctx.addSlot('sp_seagull', -1.8, -4.4, 0.6, Y_T2);
    }

    // 12. Living Coastal Flock: Interactive Seagulls & Pelicans (perching + soaring over bay!)
    SEA_WORLD_STATE.creatures = createCreatureFleetController(THREE, ctx, [
      {
        id: 'sp_seagull',
        builder: (T) => buildMapProps(T).sp_seagull(),
        kind: 'flyer',
        canFly: true,
        radius: 0.36,
        height: 0.62,
        scale: 1.05,
        orbitCx: -1.5,
        orbitCz: 6.5,
        orbitRx: 15.0,
        orbitRz: 12.0,
        orbitY: 9.8,
        bobY: 1.7,
        orbitSpeed: 0.38,
        figure8: true,
        callType: 'gull',
        soundInterval: 7.2,
        perches: [
          { x: -6.2, y: Y_T1 + 0.05, z: 12.2 },
          { x: 0.0, y: Y_T3 + 0.05, z: -13.2 },
          { x: -12.6, y: Y_T2 + 0.05, z: 0.2 },
        ],
      },
      {
        id: 'sp_seagull',
        builder: (T) => buildMapProps(T).sp_seagull(),
        kind: 'flyer',
        canFly: true,
        radius: 0.36,
        height: 0.62,
        scale: 0.98,
        orbitCx: 2.5,
        orbitCz: 4.0,
        orbitRx: 16.5,
        orbitRz: 13.5,
        orbitY: 11.4,
        bobY: 1.8,
        orbitSpeed: 0.33,
        figure8: false,
        callType: 'gull',
        soundInterval: 8.6,
        perches: [
          { x: 6.4, y: Y_T1 + 0.05, z: 12.4 },
          { x: 4.5, y: Y_T2 + 0.05, z: -2.0 },
          { x: 11.2, y: Y_T3 + 0.05, z: -14.0 },
        ],
      },
      {
        id: 'sp_seagull',
        builder: (T) => buildMapProps(T).sp_seagull(),
        kind: 'flyer',
        canFly: true,
        radius: 0.36,
        height: 0.62,
        scale: 1.08,
        orbitCx: 0.0,
        orbitCz: 11.0,
        orbitRx: 18.0,
        orbitRz: 10.5,
        orbitY: 8.6,
        bobY: 1.4,
        orbitSpeed: 0.42,
        figure8: true,
        callType: 'gull',
        soundInterval: 9.2,
        perches: [
          { x: -6.2, y: Y_T1 + 0.05, z: 17.5 },
          { x: 13.8, y: Y_T1 + 0.05, z: 10.8 },
          { x: -5.4, y: Y_T2 + 0.05, z: 1.6 },
        ],
      },
      {
        id: 'sp_seagull',
        builder: (T) => buildMapProps(T).sp_seagull(),
        kind: 'flyer',
        canFly: true,
        radius: 0.36,
        height: 0.62,
        scale: 1.0,
        orbitCx: -4.0,
        orbitCz: -1.5,
        orbitRx: 14.5,
        orbitRz: 12.5,
        orbitY: 12.4,
        bobY: 1.6,
        orbitSpeed: 0.31,
        figure8: false,
        callType: 'gull',
        soundInterval: 9.8,
        perches: [
          { x: -11.4, y: Y_T3 + 0.05, z: -14.4 },
          { x: -13.6, y: Y_T1 + 0.05, z: 10.6 },
          { x: 0.0, y: Y_T1 + 0.05, z: 5.8 },
        ],
      },
      {
        id: 'sp_pelican',
        builder: (T) => buildMapProps(T).sp_pelican(),
        kind: 'flyer',
        canFly: true,
        radius: 0.46,
        height: 0.86,
        scale: 1.04,
        orbitCx: 1.0,
        orbitCz: 9.5,
        orbitRx: 14.0,
        orbitRz: 10.0,
        orbitY: 9.2,
        bobY: 1.5,
        orbitSpeed: 0.29,
        figure8: true,
        callType: 'pelican',
        soundInterval: 8.8,
        perches: [
          { x: 6.4, y: Y_T1 + 0.05, z: 17.2 },
          { x: 12.8, y: Y_T1 + 0.05, z: 9.8 },
          { x: 2.2, y: Y_T2 + 0.05, z: -0.6 },
        ],
      },
      {
        id: 'sp_pelican',
        builder: (T) => buildMapProps(T).sp_pelican(),
        kind: 'flyer',
        canFly: true,
        radius: 0.46,
        height: 0.86,
        scale: 1.08,
        orbitCx: -3.5,
        orbitCz: 8.0,
        orbitRx: 16.0,
        orbitRz: 11.5,
        orbitY: 10.8,
        bobY: 1.6,
        orbitSpeed: 0.26,
        figure8: false,
        callType: 'pelican',
        soundInterval: 10.4,
        perches: [
          { x: -6.2, y: Y_T1 + 0.05, z: 14.0 },
          { x: -12.8, y: Y_T1 + 0.05, z: 9.8 },
          { x: -2.2, y: Y_T2 + 0.05, z: -0.6 },
        ],
      },
      {
        id: 'sp_pelican',
        builder: (T) => buildMapProps(T).sp_pelican(),
        kind: 'flyer',
        canFly: true,
        radius: 0.46,
        height: 0.86,
        scale: 1.0,
        orbitCx: 0.0,
        orbitCz: 14.5,
        orbitRx: 15.5,
        orbitRz: 8.5,
        orbitY: 7.8,
        bobY: 1.2,
        orbitSpeed: 0.34,
        figure8: true,
        callType: 'pelican',
        soundInterval: 11.0,
        perches: [
          { x: 6.4, y: Y_T1 + 0.05, z: 10.6 },
          { x: -6.2, y: Y_T1 + 0.05, z: 11.0 },
          { x: 0.0, y: Y_T2 + 0.05, z: 2.4 },
        ],
      },
    ]);

    // 13. Porto Sereno Bespoke Mechanics: Squeeze Vents, Cargo Crane, Sea-Cave Thermal Geysers,
    //     Sweeping Lighthouse Searchlight + Clifftop Breaker, Steerable Rowboats, Cannon & Gabbiano Slipstream!

    // 13A. Open tiny disguises right beside our Smuggler Squeeze Vents
    if (ctx.addSlot) {
      ctx.addSlot('sp_olive_amphora', -10.3, -3.1, 0.2, Y_T2);
      ctx.addSlot('sp_olive_amphora', 12.6, 7.6, -0.4, Y_T1);
      ctx.addSlot('sp_fuel_drum', -13.2, 11.2, 0.3, Y_T1);
    }

    // 13B. 2 Dalmatian Limestone Smuggler Squeeze Vents (maxR: 0.36 allows seagulls, amphorae, fuel drums)
    const spVentStoneMat = spMc(0xdfd1b4, { roughness: 0.9 });
    const spVentTrimMat = spMc(0xc96f3b, { roughness: 0.85 });
    const spVentGlowMat = spMc(0x52ecff, { emissive: 0x22cce8, emissiveIntensity: 1.15, roughness: 0.35 });
    for (const [vx, vy, vz, rotY, bw] of [
      [-11.4, Y_T2, -2.2, 0, 2.3],
      [13.4, Y_T1, 6.2, PI * 0.5, 2.2],
    ]) {
      const vg = new THREE.Group();
      vg.position.set(vx, vy, vz);
      vg.rotation.y = rotY;
      const lintel = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.95, bw, 1, 0.04), spVentStoneMat);
      lintel.position.y = 1.44;
      lintel.castShadow = true;
      vg.add(lintel);
      const tileCap = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.14, bw + 0.18, 1, 0.03), spVentTrimMat);
      tileCap.position.y = 1.96;
      vg.add(tileCap);
      for (const sz of [-bw * 0.44, bw * 0.44]) {
        const jamb = new THREE.Mesh(new RoundedBoxGeometry(0.36, 1.9, 0.24, 1, 0.03), spVentStoneMat);
        jamb.position.set(0, 0.95, sz);
        vg.add(jamb);
        const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.16), spVentGlowMat);
        lantern.position.set(0, 0.78, sz);
        vg.add(lantern);
      }
      root.add(vg);
      if (ctx.solids) ctx.solids.push(lintel, tileCap);
      if (ctx.addWorldObb) {
        const b = ctx.addWorldObb(vx, vz, 0.24, bw * 0.46, rotY, vy - 0.25, vy + 2.6, false);
        if (b) b.maxR = 0.36;
      }
    }

    // 13C. Cargo Crane Boomsling Markers (`CRANE_SLINGS`)
    const slingMat = spMc(0xf5b342, { emissive: 0xd98418, emissiveIntensity: 0.45, roughness: 0.55 });
    for (const cs of CRANE_SLINGS) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.075, 8, 20), slingMat);
      ring.rotation.x = PI / 2;
      ring.position.set(cs.fromX, cs.fromY + 0.06, cs.fromZ);
      root.add(ring);
    }

    // 13D. 2 Swimmable Sea-Cave Thermal Bubble Geysers (`sampleLauncherAt`)
    const geyserMat = new THREE.MeshBasicMaterial({
      color: 0x52f2ff,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const geyserSpecs = [
      { fromX: -15.6, fromY: Y_SEA, fromZ: 15.8, r: 1.65, toX: -15.2, toY: Y_T1 + 0.1, toZ: 13.4, dur: 1.05, arcY: 4.8, hintMsg: '🫧 Sea-Cave Thermal Geyser jetted you onto the West Harbor Quay!' },
      { fromX: 15.6, fromY: Y_SEA, fromZ: 15.8, r: 1.65, toX: 15.2, toY: Y_T1 + 0.1, toZ: 13.4, dur: 1.05, arcY: 4.8, hintMsg: '🫧 Blue Grotto Thermal Geyser jetted you onto the East Quay!' },
    ];
    const geyserRings = [];
    for (const gs of geyserSpecs) {
      SEA_WORLD_STATE.geysers.push(gs);
      const rg = new THREE.Mesh(new THREE.RingGeometry(0.60, 1.25, 22), geyserMat);
      rg.rotation.x = -PI / 2;
      rg.position.set(gs.fromX, Y_SEA + 0.06, gs.fromZ);
      rg.userData.keep = true;
      root.add(rg);
      geyserRings.push(rg);
    }

    // 13E. Sparking Clifftop Power Breaker on Trattoria Bella Vista South Wall (`kind: 'mechanism'` + shootable)
    {
      const breakerGrp = new THREE.Group();
      breakerGrp.position.set(BREAKER_POS.x, BREAKER_POS.y, BREAKER_POS.z);
      breakerGrp.userData.keep = true;

      const ironBoxMat = spMc(0x3a434d, { roughness: 0.56 });
      const hazardYellowMat = spMc(0xf2b529, { roughness: 0.45 });
      const brassThrowMat = spMc(0xe6b64c, { roughness: 0.40 });
      const handleRedMat = spMc(0xd93829, { roughness: 0.42 });
      const statusMat = new THREE.MeshStandardMaterial({
        color: 0xffe46b,
        emissive: 0xffaa18,
        emissiveIntensity: 1.5,
        roughness: 0.35,
      });

      const conduitV = new THREE.Mesh(new RoundedBoxGeometry(0.11, 1.32, 0.09, 1, 0.02), ironBoxMat);
      conduitV.position.set(0, 0.66, -0.05);
      conduitV.castShadow = true;

      const conduitWall = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.16, 0.38, 1, 0.02), ironBoxMat);
      conduitWall.position.set(0, 1.18, -0.17);

      const cabinet = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.72, 0.24, 1, 0.03), ironBoxMat);
      cabinet.position.set(0, 1.18, 0.05);
      cabinet.castShadow = true;
      cabinet.receiveShadow = true;

      const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.14, 0.04, 1, 0.015), hazardYellowMat);
      bezel.position.set(0, 1.40, 0.17);

      const statusLamp = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), statusMat);
      statusLamp.position.set(-0.15, 1.21, 0.18);

      const leverPivot = new THREE.Group();
      leverPivot.position.set(0.30, 1.20, 0.07);
      leverPivot.rotation.x = -0.52;
      const leverArm = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.30, 0.06, 1, 0.015), brassThrowMat);
      leverArm.position.set(0, 0.14, 0);
      const leverHandle = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.08, 0.08, 1, 0.02), handleRedMat);
      leverHandle.position.set(0.03, 0.28, 0);
      leverPivot.add(leverArm, leverHandle);

      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0x7ef7ff,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const sparks = [];
      for (let si = 0; si < 4; si++) {
        const spMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.045), sparkMat);
        spMesh.position.set((si - 1.5) * 0.09, 1.06 + (si % 2) * 0.16, 0.19);
        spMesh.rotation.z = (si * 0.78) + 0.35;
        spMesh.userData.baseX = spMesh.position.x;
        spMesh.userData.baseY = spMesh.position.y;
        spMesh.userData.phase = si * 1.7;
        spMesh.userData.keep = true;
        breakerGrp.add(spMesh);
        sparks.push(spMesh);
      }

      breakerGrp.add(conduitV, conduitWall, cabinet, bezel, statusLamp, leverPivot);
      for (const hm of [conduitV, conduitWall, cabinet, bezel, statusLamp, leverArm, leverHandle]) {
        hm.userData.keep = true;
        hm.userData._seaplaneBreaker = true;
        if (ctx.solids) ctx.solids.push(hm);
      }
      root.add(breakerGrp);
      if (ctx.addWorldObb) {
        ctx.addWorldObb(BREAKER_POS.x, BREAKER_POS.z, 0.34, 0.22, 0, BREAKER_POS.y, BREAKER_POS.y + 1.65, false);
      }

      SEA_WORLD_STATE.breakerVisual = {
        group: breakerGrp,
        leverPivot,
        statusMat,
        sparks,
        tripped: false,
        setTripped(tripped) {
          this.tripped = !!tripped;
          leverPivot.rotation.x = this.tripped ? 0.95 : -0.52;
          statusMat.color.setHex(this.tripped ? 0x552222 : 0xffe46b);
          statusMat.emissive.setHex(this.tripped ? 0x330808 : 0xffaa18);
          statusMat.emissiveIntensity = this.tripped ? 0.35 : 1.5;
          for (const sp of sparks) sp.visible = !this.tripped;
        },
      };

      SEA_WORLD_STATE.mechSpots.push({
        id: 'mech_lighthouse_breaker',
        kind: 'mechanism',
        icon: '⚡',
        baseLabel: 'Flip Clifftop Power Breaker',
        label: 'Flip Clifftop Power Breaker',
        x: BREAKER_POS.x,
        y: BREAKER_POS.y,
        z: BREAKER_POS.trigZ,
        trigR: BREAKER_POS.trigR,
        cdUntil: 0,
      });
    }

    // 13F. Gabbiano Mail Plane Propeller Slipstream Wind Corridor Visual + Coastal Mechanism Registry
    {
      const slipGrp = new THREE.Group();
      slipGrp.position.set(SLIPSTREAM_START.x, Y_SEA + 0.14, SLIPSTREAM_START.z);
      slipGrp.rotation.y = Math.atan2(SLIPSTREAM_DIR.x, SLIPSTREAM_DIR.z);
      slipGrp.visible = false;
      slipGrp.userData.keep = true;

      const ribbonMat = new THREE.MeshBasicMaterial({
        color: 0x6ef6ff,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const foamArcMat = new THREE.MeshBasicMaterial({
        color: 0xd4fdff,
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const ribbons = [];
      for (let ri = 0; ri < 12; ri++) {
        const len = 3.2 + (ri % 3) * 1.1;
        const rMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, len), ribbonMat);
        rMesh.rotation.x = -PI / 2;
        const rx = ((ri * 1.37) % 5.2) - 2.6;
        const ry = 0.08 + (ri % 4) * 0.38;
        const rz = (ri / 12) * SLIPSTREAM_LEN;
        rMesh.position.set(rx, ry, rz);
        rMesh.userData.z0 = rz;
        rMesh.userData.keep = true;
        slipGrp.add(rMesh);
        ribbons.push(rMesh);
      }

      const chevrons = [];
      for (let ci = 0; ci < 5; ci++) {
        const cRing = new THREE.Mesh(
          new THREE.RingGeometry(1.75, 2.55, 20, 1, -0.25, PI + 0.5),
          foamArcMat
        );
        cRing.position.set(0, 0.95, (ci / 5) * SLIPSTREAM_LEN);
        cRing.userData.z0 = (ci / 5) * SLIPSTREAM_LEN;
        cRing.userData.keep = true;
        slipGrp.add(cRing);
        chevrons.push(cRing);
      }

      slipGrp.userData.ribbons = ribbons;
      slipGrp.userData.chevrons = chevrons;
      root.add(slipGrp);
      SEA_WORLD_STATE.slipstreamGroup = slipGrp;

      SEA_WORLD_STATE.mechSpots.push(
        {
          id: 'mech_savoia_prop',
          kind: 'mechanism',
          icon: '🛩️',
          baseLabel: 'Blast Gabbiano Mail Plane Propellers!',
          label: 'Blast Gabbiano Mail Plane Propellers!',
          x: -11.8,
          y: 0.25,
          z: 14.4,
          yTol: 1.85,
          trigR: 4.85,
          cdUntil: 0,
        },
        {
          id: 'mech_harbor_cannon',
          kind: 'mechanism',
          icon: '💣',
          baseLabel: 'Blast From Harbor Cannon!',
          label: 'Blast From Harbor Cannon!',
          x: CANNON_POS.x,
          y: CANNON_POS.y,
          z: CANNON_POS.z,
          trigR: CANNON_POS.trigR,
          cdUntil: 0,
        }
      );
    }

    // 13I. 2 Continuous Outer-Bay Harbor Patrol Skiffs (`createMovingTrackSystem`) + Carrier Props
    let skiffPhase = 0;
    const skiffOrbitPos = (phaseOffset) => (u) => {
      const a = u + phaseOffset;
      return {
        x: Math.cos(a) * 11.2,
        y: Y_SEA + 0.04,
        z: 24.4 + Math.sin(a) * 1.65,
      };
    };
    const skiffOrbitYaw = (phaseOffset) => (u) => {
      const a = u + phaseOffset;
      const vx = -Math.sin(a) * 11.2;
      const vz = Math.cos(a) * 1.65;
      return Math.atan2(vx, vz);
    };
    const propsKit = buildMapProps(THREE);
    for (let si = 0; si < 2; si++) {
      const phaseOffset = si * PI;
      const skiffMesh = B.rowboat({ trimHex: si === 0 ? 0xd98a2b : 0x2b857e, seed: 80 + si });
      skiffMesh.scale.set(1.25, 1.0, 1.22);
      skiffMesh.traverse((m) => { m.userData.keep = true; });
      root.add(skiffMesh);
      SEA_WORLD_STATE.tracks.addDeckPlatform({
        posFn: skiffOrbitPos(phaseOffset),
        hx: 0.96,
        hz: 2.15,
        heightY: 0.44,
        yawFn: skiffOrbitYaw(phaseOffset),
      });
      // Carry an authentic disguised prop on each patrol skiff!
      const cargoMesh = si === 0 ? propsKit.sp_lobster_trap() : propsKit.sp_buoy_float();
      cargoMesh.traverse((m) => { m.userData.keep = true; });
      root.add(cargoMesh);
      SEA_WORLD_STATE.tracks.addCarrierProp(
        cargoMesh,
        (u) => {
          const p = skiffOrbitPos(phaseOffset)(u);
          const yaw = skiffOrbitYaw(phaseOffset)(u);
          return {
            x: p.x + Math.sin(yaw) * 0.65,
            y: p.y + 0.42,
            z: p.z + Math.cos(yaw) * 0.65,
            yaw,
          };
        },
        0
      );
      SEA_WORLD_STATE.skiffs.push({ mesh: skiffMesh, phaseOffset });
    }
    SEA_WORLD_STATE.tracks.update(0.016, 0);
    for (let i = 0; i < SEA_WORLD_STATE.skiffs.length; i++) {
      const sk = SEA_WORLD_STATE.skiffs[i];
      const p = skiffOrbitPos(sk.phaseOffset)(0);
      const yaw = skiffOrbitYaw(sk.phaseOffset)(0);
      sk.mesh.position.set(p.x, p.y - 0.30, p.z);
      sk.mesh.rotation.y = yaw;
    }

    // 13H. Sweeping Harbor Lighthouse "Gamer" Searchlight Cone + Foot Catch-Ring Pool (Zero PointLights!)
    if (beacon) {
      beacon.traverse((child) => {
        if (child.isMesh && child.geometry?.type === 'ConeGeometry') {
          child.userData.keep = true;
          if (child.position.z >= 0) {
            child.visible = true;
            SEA_WORLD_STATE.beaconSubCones.push(child);
          } else {
            child.visible = false;
          }
        }
      });

      const beamGrp = new THREE.Group();
      beamGrp.userData.keep = true;
      const outerBeamMat = new THREE.MeshBasicMaterial({
        color: 0xffdc72,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const innerBeamMat = new THREE.MeshBasicMaterial({
        color: 0xfff3b5,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const outerConeGeo = new THREE.ConeGeometry(6.4, 34.5, 24, 1, true);
      outerConeGeo.translate(0, -17.25, 0);
      outerConeGeo.rotateX(-PI / 2 + 0.42);
      const outerCone = new THREE.Mesh(outerConeGeo, outerBeamMat);
      outerCone.position.set(0, 0.04, 0.35);
      outerCone.castShadow = false;
      outerCone.receiveShadow = false;
      outerCone.userData.keep = true;

      const innerConeGeo = new THREE.ConeGeometry(3.2, 33.5, 20, 1, true);
      innerConeGeo.translate(0, -16.75, 0);
      innerConeGeo.rotateX(-PI / 2 + 0.42);
      const innerCone = new THREE.Mesh(innerConeGeo, innerBeamMat);
      innerCone.position.set(0, 0.04, 0.35);
      innerCone.castShadow = false;
      innerCone.receiveShadow = false;
      innerCone.userData.keep = true;

      beamGrp.add(outerCone, innerCone);
      beacon.add(beamGrp);
      SEA_WORLD_STATE.beaconBeam = beamGrp;
    }

    const catchRings = [];
    for (let ci = 0; ci < 6; ci++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffe46b,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const colMat = new THREE.MeshBasicMaterial({
        color: 0xfff2a6,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const cg = new THREE.Group();
      cg.visible = false;
      cg.userData.keep = true;

      const innerR = new THREE.Mesh(new THREE.RingGeometry(0.42, 1.18, 24), ringMat);
      innerR.rotation.x = -PI / 2;
      const outerR = new THREE.Mesh(new THREE.RingGeometry(1.22, 1.85, 24), ringMat);
      outerR.rotation.x = -PI / 2;
      const colM = new THREE.Mesh(new THREE.CylinderGeometry(0.70, 1.12, 3.6, 16, 1, true), colMat);
      colM.position.y = 1.8;

      cg.add(innerR, outerR, colM);
      root.add(cg);
      catchRings.push({ grp: cg, ringMat, colMat, tLeft: 0 });
    }

    const spawnSearchlightCatchRing = (x, y, z) => {
      let slot = catchRings.find((r) => r.tLeft <= 0);
      if (!slot) slot = catchRings[0];
      slot.tLeft = 0.68;
      slot.grp.position.set(x, y + 0.07, z);
      slot.grp.scale.setScalar(0.88);
      slot.grp.visible = true;
      slot.ringMat.opacity = 0.92;
      slot.colMat.opacity = 0.46;
    };

    const _bOrig = new THREE.Vector3();
    const _bQuat = new THREE.Quaternion();
    const _bFwd = new THREE.Vector3();

    let elapsed = 0;
    return {
      turret: null,
      dispose() {
        if (SEA_WORLD_STATE.creatures) {
          SEA_WORLD_STATE.creatures.dispose();
          SEA_WORLD_STATE.creatures = null;
        }
        SEA_WORLD_STATE.tracks = null;
        SEA_WORLD_STATE.skiffs = [];
        SEA_WORLD_STATE.mechSpots = [];
        SEA_WORLD_STATE.geysers = [];
        SEA_WORLD_STATE.boatObstacles = [];
        SEA_WORLD_STATE.beaconBeam = null;
        SEA_WORLD_STATE.beaconSubCones = [];
        SEA_WORLD_STATE.slipstreamGroup = null;
        SEA_WORLD_STATE.breakerVisual = null;
        SEA_WORLD_STATE.cannonPivot = null;
        SEA_WORLD_STATE.cannonBarrel = null;
        DRIFT_ROWBOATS = [];
      },
      update(dt = 0.016, now, G) {
        elapsed = typeof now === 'number' ? now : elapsed + dt;
        const t = elapsed;
        const safeDt = Math.min(Math.max(dt || 0.016, 0), 0.05);
        const nowSec = performance.now() * 0.001;

        if (SEA_WORLD_STATE.creatures && dt > 0) SEA_WORLD_STATE.creatures.update(safeDt, t);

        // Advance Outer-Bay Patrol Skiffs (`skiffPhase`) & keep skiff visual hulls synced
        skiffPhase += safeDt * 0.26;
        if (SEA_WORLD_STATE.tracks) SEA_WORLD_STATE.tracks.update(safeDt, skiffPhase);
        for (let i = 0; i < SEA_WORLD_STATE.skiffs.length; i++) {
          const sk = SEA_WORLD_STATE.skiffs[i];
          const p = skiffOrbitPos(sk.phaseOffset)(skiffPhase);
          const yaw = skiffOrbitYaw(sk.phaseOffset)(skiffPhase);
          sk.mesh.position.set(p.x, p.y - 0.30 + Math.sin(t * 1.9 + i * 2.1) * 0.03, p.z);
          sk.mesh.rotation.y = yaw;
        }

        // Pulse Thermal Sea-Cave Bubble Geyser rings
        for (let i = 0; i < geyserRings.length; i++) {
          const rg = geyserRings[i];
          const pulse = 1 + Math.sin(t * 3.4 + i * 1.9) * 0.14;
          rg.scale.set(pulse, pulse, 1);
          rg.rotation.z = t * (i % 2 ? 0.8 : -0.8);
        }

        water.update(t);
        swayingHerbs.update(t);

        // East Pier Crimson Harbor Cannon recoil & live player aim preview
        if (SEA_WORLD_STATE.cannonRecoil > 0) {
          SEA_WORLD_STATE.cannonRecoil = Math.max(0, SEA_WORLD_STATE.cannonRecoil - safeDt * 3.6);
        }
        if (SEA_WORLD_STATE.cannonBarrel) {
          SEA_WORLD_STATE.cannonBarrel.position.z = -0.26 * SEA_WORLD_STATE.cannonRecoil;
        }
        if (SEA_WORLD_STATE.cannonPivot && G?.player?.position && SEA_WORLD_STATE.cannonRecoil <= 0.02) {
          const pp = G.player.position;
          if (Math.hypot(pp.x - CANNON_POS.x, pp.z - CANNON_POS.z) <= CANNON_POS.trigR + 1.4 && Math.abs(pp.y - CANNON_POS.y) <= 1.5) {
            const fz = -Math.cos(G.yaw || 0);
            const aimTgt = fz < 0 ? CANNON_TARGETS.cliff_terrace : CANNON_TARGETS.savoia_pier;
            const wantYaw = Math.atan2(aimTgt.x - CANNON_POS.x, aimTgt.z - CANNON_POS.z);
            SEA_WORLD_STATE.cannonPivot.rotation.y = lerpAngle(SEA_WORLD_STATE.cannonPivot.rotation.y, wantYaw, safeDt * 7.5);
          }
        }

        // Gabbiano Mail Floatplane bobbing + Twin Propellers + Turquoise-Foam Slipstream Corridor
        const propActive = nowSec < SEA_WORLD_STATE.propBlastUntil;
        seaplane.position.y = SEAPLANE_POS.y + Math.sin(t * (propActive ? 4.4 : 1.55)) * (propActive ? 0.08 : 0.055);
        seaplane.rotation.z = Math.sin(t * 1.15) * (propActive ? 0.045 : 0.03);
        seaplane.rotation.x = Math.cos(t * 1.35) * 0.02;
        const propSpeed = propActive ? 58.0 : 5.5;
        if (propeller) propeller.rotation.z += safeDt * propSpeed;
        if (propellerRear) propellerRear.rotation.z -= safeDt * (propSpeed * 1.06);

        const slipGrp = SEA_WORLD_STATE.slipstreamGroup;
        if (slipGrp) {
          slipGrp.visible = propActive;
          if (propActive) {
            const ribbons = slipGrp.userData.ribbons || [];
            const chevrons = slipGrp.userData.chevrons || [];
            for (let i = 0; i < ribbons.length; i++) {
              const rb = ribbons[i];
              rb.position.z = ((rb.userData.z0 + t * 17.5) % SLIPSTREAM_LEN);
            }
            for (let i = 0; i < chevrons.length; i++) {
              const cv = chevrons[i];
              cv.position.z = ((cv.userData.z0 + t * 14.0) % SLIPSTREAM_LEN);
              const u = cv.position.z / SLIPSTREAM_LEN;
              cv.scale.setScalar(0.82 + u * 0.42);
            }
          }
        }

        // Clifftop Power Breaker spark jitter & blackout auto-recovery visual sync
        const bv = SEA_WORLD_STATE.breakerVisual;
        if (bv) {
          if (bv.tripped && nowSec >= SEA_WORLD_STATE.beaconBlindedUntil) {
            bv.setTripped(false);
          }
          if (!bv.tripped) {
            for (let i = 0; i < bv.sparks.length; i++) {
              const sp = bv.sparks[i];
              const fl = Math.sin(t * 28.0 + sp.userData.phase);
              sp.visible = fl > -0.35;
              sp.position.x = sp.userData.baseX + Math.sin(t * 37.0 + i) * 0.035;
              sp.position.y = sp.userData.baseY + Math.cos(t * 31.0 + i * 2) * 0.035;
              sp.rotation.z += safeDt * (i % 2 ? 11.0 : -13.0);
              sp.scale.setScalar(0.75 + Math.abs(fl) * 0.55);
            }
          }
        }

        // 2 Steerable Wooden Harbor Rowboats (`movedThisFrame` preserves handleCustomMotion passenger delta)
        for (let i = 0; i < DRIFT_ROWBOATS.length; i++) {
          const b = DRIFT_ROWBOATS[i];
          if (b.pilot && (b.pilot.userData?.customPilot !== b.id || b.pilot.userData?.alive === false || b.pilot.userData?.actor?.eliminated)) {
            b.pilot = null;
          }
          if (!b.movedThisFrame) {
            b.prevX = b.x;
            b.prevZ = b.z;
            b.prevRot = b.rot;
            b.dRot = 0;
          }
          b.movedThisFrame = false;

          const bob = Math.sin(t * 1.65 + b.phase) * 0.036;
          b.deckY = 0.15 + bob;
          b.g.position.set(b.x, -0.27 + bob, b.z);
          b.g.rotation.y = b.rot;
          b.g.rotation.z = Math.sin(t * 1.3 + b.phase) * 0.028;
          b.g.rotation.x = Math.cos(t * 1.5 + b.phase) * 0.018;
        }

        // Moored scenic skiff & sea-spot cork rings bobbing gently
        mooredSkiff.position.y = -0.27 + Math.sin(t * 1.65 + 4.2) * 0.045;
        mooredSkiff.rotation.z = Math.sin(t * 1.2 + 4.2) * 0.038;
        for (let i = 0; i < seaSpotVis.markers.length; i++) {
          const mk = seaSpotVis.markers[i];
          mk.position.y = Y_SEA + 0.03 + Math.sin(t * 2.1 + i * 1.7) * 0.035;
          mk.rotation.y = Math.sin(t * 0.5 + i) * 0.18;
        }

        // Fluttering Hangar Windsock
        if (windsock) {
          windsock.rotation.y = 0.25 + Math.sin(t * 1.9) * 0.24 + Math.sin(t * 4.3) * 0.07;
          windsock.rotation.z = Math.sin(t * 5.4) * 0.085;
        }

        // Sweeping Harbor Lighthouse Searchlight (`theta += dt * 0.42`) & Gamer Hider Catch Detection
        if (beacon) {
          SEA_WORLD_STATE.lighthouseTheta += safeDt * 0.42;
          beacon.rotation.y = SEA_WORLD_STATE.lighthouseTheta;

          const beamActive = nowSec >= SEA_WORLD_STATE.beaconBlindedUntil;
          if (SEA_WORLD_STATE.beaconBeam) SEA_WORLD_STATE.beaconBeam.visible = beamActive;
          for (let si = 0; si < SEA_WORLD_STATE.beaconSubCones.length; si++) {
            SEA_WORLD_STATE.beaconSubCones[si].visible = beamActive;
          }

          if (beamActive && G && (G.phase === 'seek' || G.phase === 'survive')) {
            beacon.getWorldPosition(_bOrig);
            beacon.getWorldQuaternion(_bQuat);
            _bFwd.set(0, 0, 1).applyQuaternion(_bQuat);
            _bFwd.y = 0;
            if (_bFwd.lengthSq() > 1e-4) _bFwd.normalize();

            const rawHiders = (G.allHiders && G.allHiders.length) ? G.allHiders : (G.hiders || []);
            const hList = (G.mode === 'hide' && G.player && !rawHiders.includes(G.player))
              ? [G.player, ...rawHiders]
              : rawHiders;

            for (let i = 0; i < hList.length; i++) {
              const h = hList[i];
              if (!h || !h.position) continue;
              const hu = h.userData || {};
              if (hu.alive === false || hu.actor?.eliminated || hu.eliminated) continue;

              const dx = h.position.x - _bOrig.x;
              const dz = h.position.z - _bOrig.z;
              const dist = Math.hypot(dx, dz);
              if (dist < 4.5 || dist > 29.0) continue;

              const dot = (dx * _bFwd.x + dz * _bFwd.z) / dist;
              if (dot < 0.976) continue;

              if (SEA_WORLD_STATE.whereIs && SEA_WORLD_STATE.whereIs(h.position.x, h.position.z, h.position.y)) continue;
              if (isInsideSeaCave(h.position.x, h.position.z, h.position.y)) continue;

              // Stand stone-still to dodge the sweeping searchlight!
              if ((hu.spd || 0) < 0.42 && (hu.jy || 0) < 0.1) continue;

              const nextCueAt = SEA_WORLD_STATE.spotlightCueMap.get(h) || 0;
              if (nowSec < nextCueAt) continue;
              SEA_WORLD_STATE.spotlightCueMap.set(h, nowSec + 2.6);

              const footY = hu.groundY ?? h.position.y;
              spawnSearchlightCatchRing(h.position.x, footY, h.position.z);
              playWorldMechAudio(SEA_WORLD_STATE.audio, 'alarm');
              if (SEA_WORLD_STATE.emitSoundCue) {
                SEA_WORLD_STATE.emitSoundCue(h.position, 24, 'taunt', h);
              }
              if (h === G.player && SEA_WORLD_STATE.notify) {
                SEA_WORLD_STATE.notify('🔦 CAUGHT IN SEARCHLIGHT! Stand still in beams!', 2500);
              }
            }
          }
        }

        // Animate active Golden Searchlight Catch Rings
        for (let ci = 0; ci < catchRings.length; ci++) {
          const cr = catchRings[ci];
          if (cr.tLeft <= 0) continue;
          cr.tLeft = Math.max(0, cr.tLeft - safeDt);
          const u = cr.tLeft / 0.68;
          if (u <= 0) {
            cr.grp.visible = false;
            cr.ringMat.opacity = 0;
            cr.colMat.opacity = 0;
          } else {
            cr.grp.scale.setScalar(0.88 + (1 - u) * 0.65);
            cr.ringMat.opacity = u * 0.92;
            cr.colMat.opacity = u * 0.46;
          }
        }

        // Spouting Seahorse Fountain water droplets
        for (let i = 0; i < dropCount; i++) {
          const arc = jetArcs[i % 4];
          const u = (((t * 1.15 + (i / dropCount) * 4) % 1) + 1) % 1;
          arc.getPoint(u, dPt);
          dDummy.position.copy(dPt);
          const sc = Math.sin(u * PI) * 0.95 + 0.35;
          dDummy.scale.set(sc * 0.85, sc * 1.25, sc * 0.85);
          dDummy.updateMatrix();
          dropInst.setMatrixAt(i, dDummy.matrix);
        }
        dropInst.instanceMatrix.needsUpdate = true;
      },
    };
  },
};
