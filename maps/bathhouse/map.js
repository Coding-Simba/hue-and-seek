/* Hue & Seek — Map 1: Yu-Machi Spirit Bathhouse Quarter (maps/bathhouse/map.js)
 * Handcrafted 3-Tier Vertical Storybook Hot-Spring Cliff Town of lantern-lit bath streets
 * and built 1:1 from assets/maps/bathhouse/{overview,buildings_sheet,interiors_sheet,props_sheet,characters_sheet,sky_panorama}.png.
 *
 * Unique Vertical Architecture & Bespoke Gameplay Mechanics:
 *   • 3-Tier Cliffside Vertical Layout:
 *       - Undercroft & Floor 1 (y = 0.50m / 1.05m): Boiler Undercroft, South Canal Arrival Islands,
 *         Hero Arched Vermilion Bridge & Tidal Bath Canal Lock!
 *       - Floor 2 (y = 2.85m): Central Cobbled Dragon Fountain & Bonsho Bell Courtyard, 2 Crimson Spirit Stalls,
 *         West Ramen Izakaya Wing & East Boiler + Spinning Waterwheel Wing linked by Arched Red Bridges!
 *       - Floor 3 (y = 5.15m): Upper Cliffside Bathhouse Crown with the Grand Vermilion Bathhouse Pavilion!
 *   • Valorant "Lotus" Rotating Stone/Shoji Divider Doors: 3 revolving cedar-and-stone dividers at Courtyard West,
 *     Courtyard East & Upper Gallery with bronze wall-wheels and shootable brass gongs!
 *   • "Flood-or-Drain" Bath Canal Tide Cycle: 24s cycle (plus manual Boiler Floodwheel) alternating between Dry
 *     Stepped Under-Bridge Riverbed (0.15m) and High Tide Swimmable Current (1.48m), preceded by a 2.5s Bronze Gong!
 *   • Autonomous Suds-Sprite Swarm: 3 Foam Buckets release scurrying soap-bubble suds-sprites
 *     emitting decoy running cues across stairs and bridges to pull Seekers away!
 *   • 3-Stop Timber Dumbwaiter & Wooden Pulley Bath-Lift + Herbal Steam Geysers, Tubs & Eave Hooks!
 */
import { Color } from 'three';
import {
  makeRng,
  paintedCanvasTex,
  brushStrokes,
  kitTex,
  mergeStatic,
  RoundedBoxGeometry,
  createAnimatedWater,
} from '../map_kit.js?v=2';
import {
  PROPS,
  PROP_ICONS,
  buildMapProps,
  buildFloatingBathDuck,
  buildCedarTubLid,
  buildSudsSpriteVariant,
  buildOrigamiCraneVariant,
} from './props.js?v=v10';
import {
  createCreatureFleetController,
  createMatCache,
  playWorldMechAudio,
} from '../world_interactives.js?v=v10';
import { SEEKER_DEFS, HIDER_DEF, buildMapSeeker, buildMapHider } from './characters.js?v=54';
import { BUILDING_DEFS, buildBuildings } from './buildings.js?v=54';
import {
  STONE_BOULDER_PAL,
  MOSS_BOULDER_PAL,
  HYDRANGEA_PAL,
  WISTERIA_PAL,
  SAKURA_PAL,
  FOLIAGE_PAL,
} from './bath_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// ============================================================================
// 3-Tier Vertical Elevation Constants & Structural Geometry Bounds
// ============================================================================
export const Y_WATER = 0.0;
export const Y_UND = 0.50;  // Sub-Courtyard Boiler Undercroft Chamber
export const Y_T1 = 1.05;   // Floor 1: South Canal Arrival Islands & Under-Bridge Lift Walk
export const Y_T2 = 2.85;   // Floor 2: Central Dragon Courtyard, Ramen Wing & Boiler Wing
export const Y_T3 = 5.15;   // Floor 3: Upper Cliffside Grand Bathhouse Crown

const COL_PLAZA = 0x9c8e98;
const COL_BORDER = 0xc44035;
const COL_TERRACE = 0x8f8a96;
const COL_WOOD = 0xc68850;
const COL_WATER = 0x34a8be;

// Pulley Bath-Lift (East: Floor 1 <-> Floor 3) & Upgraded 3-Stop Timber Dumbwaiter (West: Undercroft <-> Floor 2 <-> Floor 3)
const LIFT_X = 11.8;
const LIFT_Z = -11.4;
const LIFT_HALF = 1.12;
const DUMB_X = -12.6;
const DUMB_Z = -11.4;
const DUMB_HALF = 1.08;
const DUMB_STOPS = [Y_UND, Y_T2, Y_T3];

// Central Bath Canal Tide Cycle Constants
const CANAL_X_MIN = -3.58;
const CANAL_X_MAX = 3.58;
const CANAL_Z_MIN = 10.35;
const CANAL_Z_MAX = 25.15;
const TIDE_CYCLE = 24.0;
const TIDE_DRY_Y = 0.15;
const TIDE_HIGH_Y = 1.48;
const TIDE_WARN_LEAD = 2.5;
const TIDE_SWITCH_T = TIDE_CYCLE * 0.5;

// Live mutable state shared between buildWorld closure and MAP_DEF query hooks
const WORLD_STATE = {
  liftY: Y_T1,
  liftTargetY: Y_T3,
  liftHoldT: 3.5,
  liftMoving: false,
  liftCar: null,
  dumbStopIdx: 1,
  dumbDir: 1,
  dumbY: Y_T2,
  dumbTargetY: Y_T3,
  dumbHoldT: 4.5,
  dumbMoving: false,
  dumbCar: null,
  steamStrength: 0, // 0..1 global eruption envelope
  steamVents: [],
  interactSpots: [],
  liftSpots: [],
  steamChutes: [],
  mechSpots: [],
  rotatingDoors: [],
  decoySudsSprites: [],
  tideTimer: 0,
  tideY: TIDE_DRY_Y,
  tideTargetY: TIDE_DRY_Y,
  tideWarnedPhase: -1,
  prevFloodPhase: false,
  canalWater: null,
  chuteCooldowns: new WeakMap(),
  canalCurrentCooldowns: new WeakMap(),
  creatures: null,
  audio: null,
  notify: null,
  spawnPuff: null,
  splash: null,
  emitSoundCue: null,
  spawnDecoySwarm: null,
  triggerTideShift: null,
};

function playBathhouseAudio(audio, kind = 'gong') {
  if (!audio || (typeof audio.isMuted === 'function' && audio.isMuted())) return;
  const ctx = audio.getContext?.();
  if (!ctx || ctx.state !== 'running') return;
  const dest = audio.getSfxBus?.() || ctx.destination;
  const now = ctx.currentTime;
  try {
    if (kind === 'gong') {
      const freqs = [196.0, 293.66, 415.3, 587.33];
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.001, now);
      master.gain.linearRampToValueAtTime(0.26, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
      master.connect(dest);
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.985, now + 1.55);
        og.gain.value = 0.48 / (idx + 1);
        osc.connect(og);
        og.connect(master);
        osc.start(now);
        osc.stop(now + 1.7);
      });
      return;
    }
    if (kind === 'door_turn') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(102, now);
      osc.frequency.exponentialRampToValueAtTime(64, now + 0.72);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.20, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      osc.connect(g);
      g.connect(dest);
      osc.start(now);
      osc.stop(now + 0.80);
      return;
    }
    if (kind === 'suds_squeak') {
      for (let i = 0; i < 2; i++) {
        const t0 = now + i * 0.075;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        const base = 780 + Math.random() * 240;
        osc.frequency.setValueAtTime(base, t0);
        osc.frequency.exponentialRampToValueAtTime(base * 1.48, t0 + 0.05);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.10, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(t0 + 0.10);
      }
    }
  } catch (_) {
    // AudioContext guard
  }
}

// Staircase definitions (all rise along local -Z from z = +run/2 to z = -run/2)
const STAIRS = [
  // Floor 1 -> Floor 2 twin south courtyard staircases
  { id: 's1w', cx: -5.2, cz: 8.8, width: 3.2, run: 3.8, y0: Y_T1, y1: Y_T2 },
  { id: 's1e', cx: 5.2, cz: 8.8, width: 3.2, run: 3.8, y0: Y_T1, y1: Y_T2 },
  // Floor 2 -> Floor 3 central ceremonial & west mezzanine staircases
  { id: 's2c', cx: 0.0, cz: -11.4, width: 4.0, run: 4.4, y0: Y_T2, y1: Y_T3 },
  { id: 's2w', cx: -9.0, cz: -11.4, width: 3.0, run: 4.4, y0: Y_T2, y1: Y_T3 },
];

// Arched Vermilion Bridge definitions
const BRIDGES = [
  // Foreground Hero E-W Bridge across South Lantern Canal (Floor 1 <-> Floor 1)
  { id: 'b_south', cx: 0.0, cz: 16.0, rot: 0, len: 8.2, w: 3.3, y0: Y_T1, y1: Y_T1, arch: 0.72 },
  // Floor 2 West & East Inner Canal Bridges (Courtyard <-> Ramen / Boiler Wings)
  { id: 'b_west', cx: -12.3, cz: -3.8, rot: 0, len: 5.5, w: 3.3, y0: Y_T2, y1: Y_T2, arch: 0.42 },
  { id: 'b_east', cx: 12.3, cz: -3.8, rot: 0, len: 5.5, w: 3.3, y0: Y_T2, y1: Y_T2, arch: 0.42 },
  // Outer West & East Sloped Canal Bridges (Floor 1 z=+7.5 -> Floor 2 z=+1.3)
  { id: 'b_side_w', cx: -19.6, cz: 4.4, rot: PI * 0.5, len: 6.6, w: 3.1, y0: Y_T1, y1: Y_T2, arch: 0.44 },
  { id: 'b_side_e', cx: 19.6, cz: 4.4, rot: PI * 0.5, len: 6.6, w: 3.1, y0: Y_T1, y1: Y_T2, arch: 0.44 },
];

// ============================================================================
// Pure Analytical Terrain & Walkability Queries (Zero Raycast Overhead!)
// ============================================================================
function evalBridgeY(b, x, z) {
  const dx = x - b.cx, dz = z - b.cz;
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
  const lx = dx * c + dz * s;
  const lz = -dx * s + dz * c;
  const halfL = b.len * 0.5 + 0.35;
  const halfW = b.w * 0.47;
  if (Math.abs(lx) > halfL || Math.abs(lz) > halfW) return null;
  const u = clamp((lx + b.len * 0.5) / b.len, 0, 1); // 0 at -X end, 1 at +X end
  // Note: for rot = PI/2, local +X points toward world -Z (so u=0 is z=+7.5, u=1 is z=+1.3!)
  const base = b.y0 + (b.y1 - b.y0) * u;
  const archAdd = Math.cos(clamp(Math.abs(lx) / (b.len * 0.5), 0, 1) * PI * 0.5) * b.arch;
  return base + archAdd + 0.06;
}

function evalStairY(st, x, z) {
  if (Math.abs(x - st.cx) > st.width * 0.48) return null;
  const halfR = st.run * 0.5 + 0.32;
  if (z < st.cz - halfR || z > st.cz + halfR) return null;
  const u = clamp((st.cz + st.run * 0.5 - z) / st.run, 0, 1);
  return st.y0 + (st.y1 - st.y0) * u;
}

function inTier3LiftBalcony(x, z) {
  if (x >= 9.4 && x <= 13.2 && z >= -14.5 && z <= -12.3) return true;
  if (x >= -14.2 && x <= -11.0 && z >= -14.5 && z <= -12.3) return true;
  return false;
}

function inTier3Crown(x, z) {
  if (inTier3LiftBalcony(x, z)) return true;
  // Upper Cliff Bathhouse Crown: z in [-28.6, -13.0], x in [-14.5, +14.5] with rounded back corners
  if (z < -28.6 || z > -13.0 || Math.abs(x) > 14.5) return false;
  if (z < -26.2 && Math.hypot(Math.abs(x) - 11.5, z + 26.2) > 3.2 && Math.abs(x) > 11.5) return false;
  return true;
}

function inTier2Courtyard(x, z) {
  // West Staircase s2w Mezzanine Landing Apron & Ramen Catwalk Bypass (clear of Dumbwaiter shaft north of z = -10.25!)
  if (x >= -10.6 && x <= -5.5 && z >= -10.2 && z <= -5.6) return true;
  if (x >= -14.2 && x <= -10.2 && z >= -10.25 && z <= -5.8) return true;
  // Central circular Dragon Fountain Courtyard centered at (0, -1.15), r = 10.75m
  if (z < -9.65 || z > 7.35 || x > 10.35) return false;
  return Math.hypot(x, z + 1.15) <= 10.75;
}

function inTier2WestWing(x, z) {
  // West Ramen Izakaya Wing: x in [-26.6, -13.85], z in [-14.5, +1.85]
  if (x < -26.6 || x > -13.85 || z < -14.5 || z > 1.85) return false;
  return Math.hypot(x, z) <= 29.6;
}

function inTier2EastWing(x, z) {
  // East Boiler Wing: x in [13.85, 26.6], z in [-14.5, +1.85]
  if (x < 13.85 || x > 26.6 || z < -14.5 || z > 1.85) return false;
  return Math.hypot(x, z) <= 29.6;
}

function inTier1WestIsland(x, z) {
  // SW Wisteria Kimono Teahouse Island: x in [-26.0, -3.58], z in [6.8, 24.0]
  if (x < -26.0 || x > -3.58 || z < 6.8 || z > 24.0) return false;
  if (x > -3.65 && z < 10.4) return false;
  return Math.hypot(x, z) <= 29.2;
}

function inTier1EastIsland(x, z) {
  // SE Moonlit Taiko Shrine & Rotenburo Island: x in [3.58, 26.0], z in [6.8, 25.6]
  if (x < 3.58 || x > 26.0 || z < 6.8 || z > 25.6) return false;
  if (x < 3.65 && z < 10.4) return false;
  return Math.hypot(x, z) <= 29.6;
}

function inTier1LiftBoardwalk(x, z) {
  // Scenic Floor 1 canal-level cedar boardwalk running from SE Island (z = +8.8) under b_east to Pulley Lift (z = -11.4)!
  if (z >= 6.8 && z <= 9.5 && x >= 8.5 && x <= 13.15) return true;
  if (x >= 7.2 && x <= 10.8 && z >= -7.8 && z <= -5.0) return true; // North Soot Vent Apron
  return x >= 10.50 && x <= 13.15 && z >= -10.35 && z <= 8.8;
}

function inWestCanalPier(x, z) {
  // Symmetrical Floor 1 West Secret Canal Pier beneath b_west linking SW Island to Undercroft!
  if (x >= -13.15 && x <= -10.45 && z >= -5.9 && z <= 9.2) return true;
  return false;
}

function inWestBoilerDock(x, z) {
  // Sub-catwalk Boiler Service Dock & Ramp connecting Dumbwaiter bottom (Y_UND) to West Canal Pier (Y_T1)!
  return x >= -13.68 && x <= -11.30 && z >= -10.35 && z <= -5.88;
}

function evalWestBoilerDockY(z) {
  if (z <= -8.2) return Y_UND;
  const u = clamp((z + 8.2) / 2.3, 0, 1);
  return Y_UND + (Y_T1 - Y_UND) * u;
}

function inBathCanal(x, z) {
  return x >= CANAL_X_MIN && x <= CANAL_X_MAX && z >= CANAL_Z_MIN && z <= CANAL_Z_MAX;
}

function evalCanalBedY(x, z) {
  let y = 0.18;
  // North Arch Canal Steps (z in [10.35, 12.15], |x| <= 2.15) descending from southArch (Y_T1) to riverbed (0.18)
  if (Math.abs(x) <= 2.15 && z >= CANAL_Z_MIN && z <= 12.15) {
    const u = clamp((12.15 - z) / 1.80, 0, 1);
    y = Math.max(y, 0.18 + (Y_T1 - 0.18) * u);
  }
  // SW & SE Island Canal Steps (z in [18.8, 21.4], |x| in [2.05, 3.58]) descending from Y_T1 to riverbed (0.18)
  if (z >= 18.8 && z <= 21.4 && Math.abs(x) >= 2.05) {
    const u = clamp((Math.abs(x) - 2.05) / 1.53, 0, 1);
    y = Math.max(y, 0.18 + (Y_T1 - 0.18) * u);
  }
  return y;
}

function isCanalFlooded() {
  return WORLD_STATE.tideY >= 0.72;
}

function inSouthTwinArch(x, z) {
  // Walkable South Canal Twin-Arch Pier bridging SW Teahouse <-> Undercroft <-> SE Shrine (between s1w & s1e!)
  return Math.abs(x) <= 4.1 && z >= 6.5 && z <= 10.4;
}

function inUndercroft(x, z) {
  // T-shaped Boiler Undercroft Chamber directly beneath Tier 2 Central Courtyard!
  if (Math.abs(z + 3.9) <= 1.85 && x >= -10.65 && x <= 10.65) return true; // East-West Tunnel
  if (Math.abs(x) <= 2.05 && z >= -7.6 && z <= 7.0) return true;           // North-South Arch Tunnel
  if (Math.hypot(x, z + 3.9) <= 4.25) return true;                         // Central Boiler Rotunda
  if (x >= 2.2 && x <= 10.6 && z >= -7.6 && z <= -5.0) return true;        // NE Soot-Vent Boiler Passage
  return false;
}

function evalUndercroftY(x, z) {
  // Gently slopes up from glowing Boiler Floor (Y_UND = 0.50) to Floor 1 Canal Piers (Y_T1 = 1.05)!
  const tE = clamp((x - 7.8) / 2.6, 0, 1);
  const tW = clamp((-7.8 - x) / 2.6, 0, 1);
  const tS = clamp((z - 3.6) / 3.0, 0, 1);
  const tNE = (x >= 7.2 && z <= -5.0) ? clamp((x - 7.0) / 2.4, 0, 1) : 0;
  return Y_UND + (Y_T1 - Y_UND) * Math.max(tE, tW, tS, tNE);
}

function inLiftShaft(x, z) {
  return Math.abs(x - LIFT_X) <= LIFT_HALF && Math.abs(z - LIFT_Z) <= LIFT_HALF;
}

function inDumbwaiterShaft(x, z) {
  return Math.abs(x - DUMB_X) <= DUMB_HALF && Math.abs(z - DUMB_Z) <= DUMB_HALF;
}

function sampleBathhouseHeight(x, z, refY) {
  // 1. Inside the Working East Wooden Pulley Bath-Lift shaft (Floor 1 <-> Floor 3)
  if (inLiftShaft(x, z)) {
    if (typeof refY === 'number' && Math.abs(refY - WORLD_STATE.liftY) > 1.55) {
      return refY + 2.2;
    }
    return WORLD_STATE.liftY;
  }

  // 1B. Inside the Working West Timber Dumbwaiter shaft (Undercroft Y_UND <-> Floor 2 Y_T2 <-> Floor 3 Y_T3)
  if (inDumbwaiterShaft(x, z)) {
    if (typeof refY === 'number' && Math.abs(refY - WORLD_STATE.dumbY) > 1.45) {
      return refY + 2.2;
    }
    return WORLD_STATE.dumbY;
  }

  // 2. Check Under-Bridge overlap at East & West Canal Bridges (b_east & b_west cross over Canal Piers!)
  const byEast = evalBridgeY(BRIDGES[2], x, z);
  if (byEast !== null && inTier1LiftBoardwalk(x, z)) {
    if (typeof refY === 'number' && refY < 2.10) return Y_T1;
    return byEast;
  }
  const byWest = evalBridgeY(BRIDGES[1], x, z);
  if (byWest !== null && inWestCanalPier(x, z)) {
    if (typeof refY === 'number' && refY < 2.10) return Y_T1;
    return byWest;
  }

  // 2A. Under Ramen Catwalk West Boiler Service Dock & Ramp (Y_UND -> Y_T1)
  if (typeof refY === 'number' && refY < 2.15 && inWestBoilerDock(x, z)) {
    return evalWestBoilerDockY(z);
  }

  // 2B. Sub-Courtyard Boiler Undercroft (when walking on Floor 1 / Undercroft level!)
  if (typeof refY === 'number' && refY < 2.15 && inUndercroft(x, z)) {
    return evalUndercroftY(x, z);
  }

  // 2C. Central Tidal Bath Canal (under Hero Red Bridge b_south: Dry Stepped Riverbed vs High Tide Water!)
  if (inBathCanal(x, z)) {
    const bySouth = evalBridgeY(BRIDGES[0], x, z);
    if (bySouth !== null && (typeof refY !== 'number' || refY >= 1.00)) {
      return bySouth;
    }
    const bedY = evalCanalBedY(x, z);
    if (WORLD_STATE.tideY <= 0.42) return bedY;
    return Math.max(bedY, WORLD_STATE.tideY - 0.62);
  }

  // 3. All Arched Vermilion Bridges
  for (const b of BRIDGES) {
    const by = evalBridgeY(b, x, z);
    if (by !== null) return by;
  }

  // 4. Stepped Stone Staircases
  for (const st of STAIRS) {
    const sy = evalStairY(st, x, z);
    if (sy !== null) return sy;
  }

  // 5. Tier 3 Crown, Tier 2 Courtyard/Wings, Tier 1 Arrival Islands, Canal Piers & Lift Walk
  // A walker already on the lower level keeps the lower walkway where its footprint overlaps an upper
  // floor's edge (South Twin-Arch Pier under the courtyard's south rim at z 7.0-7.35, West Canal Pier
  // under the west stair landing at z -5.9 to -5.8). Before, the upper floor won there and those strips
  // became invisible 1.8 m walls, blocking the main ways into the Boiler Undercroft.
  if (typeof refY === 'number' && refY < 2.15 &&
      (inSouthTwinArch(x, z) || inWestCanalPier(x, z) || inTier1LiftBoardwalk(x, z) || inTier1WestIsland(x, z) || inTier1EastIsland(x, z))) {
    return Y_T1;
  }
  if (inTier3Crown(x, z)) return Y_T3;
  if (inTier2Courtyard(x, z) || inTier2WestWing(x, z) || inTier2EastWing(x, z)) return Y_T2;
  if (inTier1WestIsland(x, z) || inTier1EastIsland(x, z) || inTier1LiftBoardwalk(x, z) || inWestCanalPier(x, z) || inSouthTwinArch(x, z)) return Y_T1;

  return -0.25; // Deep turquoise lagoon / canal water
}

function isWalkableLand(x, z) {
  if (inLiftShaft(x, z) || inDumbwaiterShaft(x, z)) return true;
  for (const b of BRIDGES) if (evalBridgeY(b, x, z) !== null) return true;
  for (const st of STAIRS) if (evalStairY(st, x, z) !== null) return true;
  if (inTier3Crown(x, z)) return true;
  if (inTier2Courtyard(x, z) || inTier2WestWing(x, z) || inTier2EastWing(x, z)) return true;
  if (inTier1WestIsland(x, z) || inTier1EastIsland(x, z) || inTier1LiftBoardwalk(x, z) || inWestCanalPier(x, z) || inWestBoilerDock(x, z) || inSouthTwinArch(x, z) || inUndercroft(x, z)) return true;
  if (inBathCanal(x, z)) return !isCanalFlooded();
  return false;
}

// ============================================================================
// Handcrafted 3D Instanced Squircle Cobblestones & Mossy Cliff Masonry
// (Same 2-draw-call Storybook tactile stone technique as Meadowbrook's plaza.js!)
// ============================================================================
let _cobbleGeo = null;
function getCobbleGeo(THREE) {
  if (_cobbleGeo) return _cobbleGeo;
  const pos = [], uv = [], idx = [], N = 8;
  const rings = [[0.5, 0], [0.42, 0.72]];
  for (const [r, y] of rings) {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + PI / N, c = Math.cos(a), s = Math.sin(a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 0.42) * r;
      const z = Math.sign(s) * Math.pow(Math.abs(s), 0.42) * r;
      pos.push(x, y, z);
      uv.push(x + 0.5, z + 0.5);
    }
  }
  pos.push(0, 1, 0);
  uv.push(0.5, 0.5);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    idx.push(i, N + j, j, i, N + i, N + j);
    idx.push(N + i, 2 * N, N + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  _cobbleGeo = g;
  return g;
}

function buildPlazaTexture(THREE) {
  return paintedCanvasTex(THREE, 'bh3_plaza_grout', 512, (g, s, rng) => {
    g.fillStyle = '#6c6272';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 220, ['#7d7284', '#5c5464', '#8e7d7c', '#687664'], 3, 9, 0.32);
  }, 6, 6);
}

function buildTerraceFlagstoneTex(THREE) {
  return paintedCanvasTex(THREE, 'bh3_terrace_flags', 512, (g, s, rng) => {
    g.fillStyle = '#6e6875';
    g.fillRect(0, 0, s, s);
    const rows = 8;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -(r % 2) * 34;
      while (x < s) {
        const w = rng.jr(52, 86);
        g.fillStyle = rng.pick(['#9d93a0', '#8f8796', '#ab9ca0', '#84808e', '#a39490', '#928c98']);
        g.beginPath();
        g.roundRect(x + 3, r * rh + 3, w - 6, rh - 6, 8);
        g.fill();
        g.fillStyle = 'rgba(255, 224, 180, 0.14)';
        g.beginPath();
        g.roundRect(x + 6, r * rh + 5, w - 14, (rh - 10) * 0.45, 5);
        g.fill();
        x += w;
      }
    }
    brushStrokes(g, s, rng, 150, ['#baa69c', '#746d7d', '#6e8468'], 2, 6, 0.2);
  }, 5, 5);
}

// ============================================================================
// Decorative Set-Piece Builders (Bamboo Groves, Storybook Trees, Waterfalls, Vents)
// ============================================================================
function buildPedestalLantern(THREE, stoneMat, woodMat, capMat, glowMat) {
  const g = new THREE.Group();
  const addM = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  addM(new RoundedBoxGeometry(0.60, 0.34, 0.60, 2, 0.05), stoneMat, 0.17);
  addM(new THREE.CylinderGeometry(0.105, 0.135, 1.78, 10), woodMat, 1.18);
  addM(new RoundedBoxGeometry(0.54, 0.09, 0.54, 1, 0.02), woodMat, 2.10);
  addM(new RoundedBoxGeometry(0.40, 0.46, 0.40, 1, 0.02), glowMat, 2.38);
  const cap = addM(new THREE.ConeGeometry(0.48, 0.32, 4), capMat, 2.76);
  cap.rotation.y = PI * 0.25;
  addM(new THREE.SphereGeometry(0.075, 8, 6), capMat, 2.95);
  g.userData.colliders = [{ x: 0, z: 0, w: 0.55, d: 0.55 }];
  return g;
}

function buildPlazaBench(THREE, woodMat, vermilionMat) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new RoundedBoxGeometry(1.88, 0.09, 0.54, 2, 0.03), woodMat);
  seat.position.y = 0.46;
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(1.84, 0.24, 0.07, 2, 0.02), vermilionMat);
  back.position.set(0, 0.76, -0.21);
  back.castShadow = true;
  g.add(back);
  for (const sx of [-0.75, 0.75]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.46, 0.48, 1, 0.02), vermilionMat);
    leg.position.set(sx, 0.23, 0);
    leg.castShadow = true;
    g.add(leg);
    const post = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.42, 0.09, 1, 0.02), vermilionMat);
    post.position.set(sx, 0.66, -0.21);
    g.add(post);
  }
  g.userData.colliders = [{ x: 0, z: 0, w: 1.86, d: 0.56 }];
  return g;
}

function buildSpiritTree(THREE, seed, blossomCols, isWeepingWisteria = false) {
  const { jr, pick } = makeRng(seed);
  const g = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x694635,
    map: kitTex(THREE, 'bark', 1, 2),
    roughness: 0.92,
    metalness: 0,
  });
  const trunkPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(jr(-0.22, 0.22), 1.25, jr(-0.18, 0.18)),
    new THREE.Vector3(jr(-0.36, 0.36), 2.55, jr(-0.25, 0.25)),
    new THREE.Vector3(jr(-0.18, 0.18), 3.65, jr(-0.20, 0.20)),
  ];
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 12, 0.26, 8, false), barkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  for (let b = 0; b < 4; b++) {
    const ba = (b / 4) * TAU + jr(-0.25, 0.25);
    const limb = new THREE.CatmullRomCurve3([
      trunkPts[2].clone(),
      new THREE.Vector3(Math.cos(ba) * 1.15, 3.35, Math.sin(ba) * 1.15),
      new THREE.Vector3(Math.cos(ba) * 1.95, 3.72, Math.sin(ba) * 1.95),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(limb, 8, 0.11, 6, false), barkMat));
  }

  for (const hex of blossomCols) {
    const folMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, metalness: 0 });
    for (let k = 0; k < 6; k++) {
      const a = jr(0, TAU), rad = jr(0.25, 2.05);
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(jr(0.72, 1.15), 1), folMat);
      puff.position.set(Math.cos(a) * rad, jr(3.2, 4.5), Math.sin(a) * rad);
      puff.scale.set(1.26, 0.72, 1.26);
      g.add(puff);
    }
  }

  if (isWeepingWisteria) {
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU + jr(-0.14, 0.14), rad = jr(0.75, 2.15);
      const col = pick(blossomCols);
      const racMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.82, metalness: 0 });
      const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad, by = jr(2.95, 3.45);
      for (let d = 0; d < 4; d++) {
        const bl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 - d * 0.028, 0), racMat);
        bl.position.set(bx + jr(-0.04, 0.04), by - d * 0.22, bz + jr(-0.04, 0.04));
        g.add(bl);
      }
    }
  }
  mergeStatic(THREE, g);
  g.userData.merged = true;
  g.userData.colliders = [{ x: 0, z: 0, w: 0.68, d: 0.68 }];
  return g;
}

function buildHerbalSteamVent(THREE, stoneMat, bronzeMat, waterGlowMat) {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), stoneMat);
    rk.position.set(Math.cos(a) * 0.44, 0.11, Math.sin(a) * 0.44);
    rk.scale.set(1.2, 0.65, 1.1);
    rk.rotation.set(a, i, 0);
    g.add(rk);
  }
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.20, 12), bronzeMat);
  rim.position.y = 0.10;
  g.add(rim);
  const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), waterGlowMat);
  grate.position.y = 0.19;
  g.add(grate);
  for (let b = -1; b <= 1; b++) {
    const bar = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.035, 0.045, 1, 0.01), bronzeMat);
    bar.position.set(0, 0.21, b * 0.12);
    g.add(bar);
  }
  mergeStatic(THREE, g);
  g.userData.merged = true;
  return g;
}

function buildEaveHookMarker(THREE, woodMat, goldMat) {
  const g = new THREE.Group();
  const bracket = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.12, 0.44, 1, 0.02), woodMat);
  bracket.position.set(0, 0.24, -0.14);
  g.add(bracket);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 14), goldMat);
  ring.position.set(0, 0.11, 0.02);
  g.add(ring);
  mergeStatic(THREE, g);
  g.userData.merged = true;
  return g;
}

function nearestDumbStopIdx(y) {
  let best = 1, bestD = Infinity;
  for (let i = 0; i < DUMB_STOPS.length; i++) {
    const d = Math.abs(y - DUMB_STOPS[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function toggleRotatingDoor(door, byShot = false) {
  if (!door) return null;
  const nowSec = performance.now() * 0.001;
  if (nowSec < (door.cdUntil || 0)) {
    return '☸️ Lotus divider wall is turning…';
  }
  door.isOpen = !door.isOpen;
  door.startAngle = door.curAngle;
  door.targetAngle = door.isOpen ? PI * 0.5 : 0;
  door.animT = 0;
  door.cdUntil = nowSec + 1.05;
  if (door.closedObb) door.closedObb.disabled = door.isOpen;
  if (door.openObb) door.openObb.disabled = !door.isOpen;
  if (byShot) playBathhouseAudio(WORLD_STATE.audio, 'gong');
  playBathhouseAudio(WORLD_STATE.audio, 'door_turn');
  if (WORLD_STATE.spawnPuff) {
    WORLD_STATE.spawnPuff({ x: door.x, y: door.y + 0.9, z: door.z }, 8, 1.2, 0.44, 0.65, 0.55);
  }
  if (WORLD_STATE.emitSoundCue) {
    WORLD_STATE.emitSoundCue({ x: door.x, y: door.y + 0.9, z: door.z }, 15.5, 'chime', null);
  }
  return byShot
    ? `🔔 Brass Gong struck — ${door.title} rotated 90°!`
    : (door.isOpen
      ? `☸️ ${door.title} swung OPEN (90°) — alternate lane sealed!`
      : `☸️ ${door.title} swung CLOSED — chokepoint sealed!`);
}

// ============================================================================
// MAP_DEF Export
// ============================================================================
export const MAP_DEF = {
  id: 'bathhouse',
  title: 'Yu-Machi Spirit Bathhouse',
  subtitle: '3-tier cliffside baths, rotating Lotus doors, tidal canal & scurrying suds-sprites',
  badge: 'Lantern Twilight',
  preview: 'assets/maps/bathhouse/overview.webp',
  skyPanorama: 'assets/maps/bathhouse/sky_panorama.webp',
  skyCylY: 36,
  skyRepeat: 3,
  mapRadius: 32,

  camMenu: { r: 34.2, y: 19.6, lookX: 0, lookY: 1.55, lookZ: -0.6, baseAngle: 0, sway: 0.14 },
  playerSpawn: [0, 3.8],
  seekerSpawns: [[-3.4, -5.2], [3.4, -5.2]],
  // Spawns are placed on the top surface (refY = null). The default reference height 0 is below the
  // courtyard and picked the Boiler Undercroft beneath it, so half the players started in the cellar.
  spawnRefY: null,
  seekSpawn: [0, 4.6],
  hideIntroHint: 'Explore 3 cliff tiers! Spin Lotus Doors ☸️, ride Flood Tides 🌊, release Suds-Sprites ✨, or hide in tubs 🦆 (G)',
  wildFlyerHint: '🪶 Wild Origami Spirit Crane! Watch for Hiders flapping aloft across the bathhouse tiers!',
  getInteractHint(mode) {
    return mode === 'seek'
      ? 'Shoot brass gongs on Rotating Doors ☸️, crank Floodwheel 🌊, ride Steam Chutes 💨 & Dumbwaiter 🧺!'
      : 'Spin Lotus Doors ☸️, flood/drain Bath Canal 🌊, release Suds-Sprites ✨, or hide in Tubs 🦆!';
  },
  getTurret() {
    return null;
  },
  breaksLineOfSight() {
    return false;
  },
  onShotWorldImpact(info) {
    if (!info || !info.hitObject) return null;
    const ud = info.hitObject.userData || {};
    const gongDoorId = ud._bathDoorGongId;
    if (gongDoorId) {
      const door = WORLD_STATE.rotatingDoors.find((d) => d.id === gongDoorId);
      if (door) {
        const msg = toggleRotatingDoor(door, true);
        if (!info.isRemote && info.shooter === info.G?.player && msg && WORLD_STATE.notify) {
          WORLD_STATE.notify(msg, 1650);
        }
        return { consumed: true, doorId: gongDoorId };
      }
    }
    const panelDoorId = ud._bathDoorPanelId;
    if (panelDoorId) {
      const door = WORLD_STATE.rotatingDoors.find((d) => d.id === panelDoorId);
      if (door && info.point) {
        const dCenter = Math.hypot(info.point.x - door.x, info.point.z - door.z);
        if (dCenter <= 0.78 && Math.abs(info.point.y - (door.y + 1.32)) <= 0.72) {
          const msg = toggleRotatingDoor(door, true);
          if (!info.isRemote && info.shooter === info.G?.player && msg && WORLD_STATE.notify) {
            WORLD_STATE.notify(msg, 1650);
          }
        }
        return { consumed: true, doorId: panelDoorId };
      }
    }
    if (ud._bathMechProp) {
      return { consumed: true };
    }
    return null;
  },
  getSurfaceModifier() {
    return null;
  },
  applyPlatformMotion(c) {
    if (!c || !c.position || !c.userData) return;
    const gy = c.userData.groundY ?? 0;
    if (inLiftShaft(c.position.x, c.position.z) && Math.abs(gy - WORLD_STATE.liftY) <= 0.78) {
      c.userData.groundY = WORLD_STATE.liftY;
      return;
    }
    if (inDumbwaiterShaft(c.position.x, c.position.z) && Math.abs(gy - WORLD_STATE.dumbY) <= 0.78) {
      c.userData.groundY = WORLD_STATE.dumbY;
    }
  },
  onResetRound() {
    WORLD_STATE.liftY = Y_T1;
    WORLD_STATE.liftTargetY = Y_T3;
    WORLD_STATE.liftMoving = false;
    WORLD_STATE.liftHoldT = 3.5;
    if (WORLD_STATE.liftCar) WORLD_STATE.liftCar.position.y = 0;

    WORLD_STATE.dumbStopIdx = 1;
    WORLD_STATE.dumbDir = 1;
    WORLD_STATE.dumbY = Y_T2;
    WORLD_STATE.dumbTargetY = Y_T3;
    WORLD_STATE.dumbMoving = false;
    WORLD_STATE.dumbHoldT = 4.5;
    if (WORLD_STATE.dumbCar) WORLD_STATE.dumbCar.position.y = WORLD_STATE.dumbY - Y_UND;

    WORLD_STATE.tideTimer = 0;
    WORLD_STATE.tideY = TIDE_DRY_Y;
    WORLD_STATE.tideTargetY = TIDE_DRY_Y;
    WORLD_STATE.tideWarnedPhase = -1;
    WORLD_STATE.prevFloodPhase = false;
    if (WORLD_STATE.canalWater) WORLD_STATE.canalWater.mesh.position.y = TIDE_DRY_Y;
    WORLD_STATE.canalCurrentCooldowns = new WeakMap();
    WORLD_STATE.chuteCooldowns = new WeakMap();

    for (const door of WORLD_STATE.rotatingDoors) {
      door.isOpen = false;
      door.curAngle = 0;
      door.startAngle = 0;
      door.targetAngle = 0;
      door.animT = 1;
      door.cdUntil = 0;
      if (door.pivotG) door.pivotG.rotation.y = 0;
      if (door.closedObb) door.closedObb.disabled = false;
      if (door.openObb) door.openObb.disabled = true;
    }
    for (const sp of WORLD_STATE.decoySudsSprites) {
      if (sp.group && sp.group.parent) sp.group.parent.remove(sp.group);
    }
    WORLD_STATE.decoySudsSprites.length = 0;
    for (const sp of WORLD_STATE.mechSpots) sp.cdUntil = 0;
  },

  sky: {
    top: 0x1b2254,
    mid: 0x4b3b78,
    bot: 0xe68b6c,
    sunDisc: 0xfff0c2,
    sunDir: [-0.38, 0.32, -0.86],
  },
  fog: { color: 0x493d6e, near: 62, far: 195 },
  lights: {
    hemiSky: 0xa6bcff,
    hemiGround: 0x69453c,
    hemiInt: 1.34,
    sunColor: 0xffc082,
    sunInt: 2.45,
    sunPos: [-18, 25, 20],
    exposure: 1.10,
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
    return sampleBathhouseHeight(x, z, refY);
  },

  isDeepWater(x, z) {
    if (inBathCanal(x, z)) return false;
    return !isWalkableLand(x, z);
  },

  isSwimmableWater(x, z) {
    return inBathCanal(x, z) && isCanalFlooded() && Math.abs(z - 16.0) > 1.70;
  },

  groundColorAt(x, z, outColor) {
    const out = outColor || new Color();
    for (const b of BRIDGES) {
      if (evalBridgeY(b, x, z) !== null) return out.setHex(COL_WOOD);
    }
    if (inBathCanal(x, z)) {
      return out.setHex(isCanalFlooded() ? COL_WATER : 0x7b8984);
    }
    if (inTier2Courtyard(x, z)) {
      const r = Math.hypot(x, z + 1.15);
      if ((r > 4.6 && r < 5.05) || (r > 8.6 && r < 9.05) || r > 10.1) return out.setHex(COL_BORDER);
      return out.setHex(COL_PLAZA);
    }
    if (isWalkableLand(x, z)) return out.setHex(COL_TERRACE);
    return out.setHex(COL_WATER);
  },

  surfaceAt(x, z) {
    if (inLiftShaft(x, z) || inDumbwaiterShaft(x, z) || inTier1LiftBoardwalk(x, z) || inWestBoilerDock(x, z)) return 'wood';
    for (const b of BRIDGES) if (evalBridgeY(b, x, z) !== null) return 'wood';
    return 'stone';
  },

  // Multi-tier AI waypoint router so seekers & fleeing hiders climb stairs & cross bridges naturally!
  routeTierWaypoint(from, goal) {
    const fy = sampleBathhouseHeight(from.x, from.z, from.y);
    const gy = sampleBathhouseHeight(goal.x, goal.z, goal.y);
    // Floor 1 same-tier routing: South Hero Bridge (b_south) & Under-Bridge Lift Boardwalk mouth!
    if (fy < 1.9 && gy < 1.9) {
      if (from.x < -3.4 && goal.x > 3.4) {
        if (Math.abs(from.z - 16.0) > 0.55) return { x: -5.2, y: Y_T1, z: 16.0 };
        return { x: 5.2, y: Y_T1, z: 16.0 };
      }
      if (from.x > 3.4 && goal.x < -3.4) {
        if (Math.abs(from.z - 16.0) > 0.55) return { x: 5.2, y: Y_T1, z: 16.0 };
        return { x: -5.2, y: Y_T1, z: 16.0 };
      }
      // Entering Lift Boardwalk from SE Island (stay south of s1e staircase cheek wall at z <= 10.9, x <= 6.9!)
      if (goal.x > 9.8 && goal.z < 9.2 && from.x < 9.8) {
        if (from.z < 11.1 && from.x < 7.8) return { x: 8.2, y: Y_T1, z: 11.4 };
        return { x: 11.6, y: Y_T1, z: 11.2 };
      }
      // Leaving Lift Boardwalk onto SE Island
      if (from.x > 9.8 && from.z < 9.2 && (goal.x < 9.8 || goal.z > 10.6)) {
        return { x: 11.6, y: Y_T1, z: 11.2 };
      }
    }
    // Floor 1 -> Floor 2 (b_side_w at -19.6, b_side_e at +19.6, or s1w at -5.2, s1e at +5.2)
    if (fy < 1.9 && gy >= 1.9) {
      if (from.x < -14.0 && goal.x < -13.5) {
        if (from.z > 7.8 && Math.abs(from.x + 19.6) > 1.05) return { x: -19.6, y: Y_T1, z: 8.2 };
        return { x: -19.6, y: Y_T2, z: 0.6 };
      }
      if (from.x > 14.0 && goal.x > 13.5) {
        if (from.z > 7.8 && Math.abs(from.x - 19.6) > 1.05) return { x: 19.6, y: Y_T1, z: 8.2 };
        return { x: 19.6, y: Y_T2, z: 0.6 };
      }
      if (from.z < 6.8 && inTier1LiftBoardwalk(from.x, from.z)) {
        return { x: 11.8, y: Y_T1, z: 8.6 };
      }
      const wpX = from.x < 0 ? -5.2 : 5.2;
      if (from.z > 10.8 && Math.abs(from.x - wpX) > 1.05) {
        return { x: wpX, y: Y_T1, z: 11.4 };
      }
      return { x: wpX, y: Y_T2, z: 6.1 };
    }
    // Floor 2/3 -> Floor 1
    if (fy >= 1.9 && gy < 1.9) {
      if (fy > 4.0) {
        if (from.z < -13.7 && Math.abs(from.x) > 1.2) return { x: 0, y: Y_T3, z: -14.2 };
        return { x: 0, y: Y_T2, z: -8.3 };
      }
      // Direct outer sloped canal bridges when heading between Wing & matching Arrival Island!
      if (from.x < -13.8 && goal.x < -12.0) {
        if (from.z < 1.0 && Math.abs(from.x + 19.6) > 1.05) return { x: -19.6, y: Y_T2, z: 0.8 };
        return { x: -19.6, y: Y_T1, z: 8.3 };
      }
      if (from.x > 13.8 && goal.x > 12.0) {
        if (from.z < 1.0 && Math.abs(from.x - 19.6) > 1.05) return { x: 19.6, y: Y_T2, z: 0.8 };
        return { x: 19.6, y: Y_T1, z: 8.3 };
      }
      // Otherwise first cross b_west / b_east back to Courtyard!
      if (from.x < -11.5) {
        if (Math.abs(from.z - (-3.8)) > 1.05 && from.x < -14.8) return { x: -15.6, y: Y_T2, z: -3.8 };
        return { x: -8.8, y: Y_T2, z: -3.8 };
      }
      if (from.x > 11.5) {
        if (Math.abs(from.z - (-3.8)) > 1.05 && from.x > 14.8) return { x: 15.6, y: Y_T2, z: -3.8 };
        return { x: 8.8, y: Y_T2, z: -3.8 };
      }
      const wpX = goal.x < 0 ? -5.2 : 5.2;
      if (from.z < 6.8 && Math.abs(from.x - wpX) > 1.05) {
        return { x: wpX, y: Y_T2, z: 6.2 };
      }
      return { x: wpX, y: Y_T1, z: 11.6 };
    }
    // Floor 2 -> Floor 3 (s2c at 0.0, s2w at -9.0, z = -9.2 -> -13.6)
    if (fy < 4.0 && gy >= 4.0) {
      if (from.x < -11.5) {
        if (Math.abs(from.z - (-3.8)) > 1.05 && from.x < -14.8) return { x: -15.6, y: Y_T2, z: -3.8 };
        return { x: -8.8, y: Y_T2, z: -3.8 };
      }
      if (from.x > 11.5) {
        if (Math.abs(from.z - (-3.8)) > 1.05 && from.x > 14.8) return { x: 15.6, y: Y_T2, z: -3.8 };
        return { x: 8.8, y: Y_T2, z: -3.8 };
      }
      const useWest = from.x < -6.8 && goal.x < -5.0;
      const sx = useWest ? -9.0 : 0.0;
      if (from.z > -9.1 && Math.abs(from.x - sx) > 1.15) {
        return { x: sx, y: Y_T2, z: -8.4 };
      }
      return { x: sx, y: Y_T3, z: -14.3 };
    }
    // Floor 3 -> Floor 2
    if (fy >= 4.0 && gy < 4.0) {
      const useWest = goal.x < -7.5 || (from.x < -6.5 && goal.x < -4.0);
      const sx = useWest ? -9.0 : 0.0;
      if (from.z < -13.7 && Math.abs(from.x - sx) > 1.15) {
        return { x: sx, y: Y_T3, z: -14.2 };
      }
      return { x: sx, y: Y_T2, z: -8.3 };
    }
    // Floor 2 Courtyard <-> West Ramen / East Boiler Wings across inner canal bridges (b_west / b_east at z = -3.8)
    if (Math.abs(fy - Y_T2) < 0.85 && Math.abs(gy - Y_T2) < 0.85) {
      if (from.x > -9.6 && goal.x < -13.6) {
        if (Math.abs(from.z - (-3.8)) > 1.05) return { x: -9.0, y: Y_T2, z: -3.8 };
        return { x: -15.6, y: Y_T2, z: -3.8 };
      }
      if (from.x < -14.8 && goal.x > -10.2) {
        if (Math.abs(from.z - (-3.8)) > 1.05) return { x: -15.6, y: Y_T2, z: -3.8 };
        return { x: -9.0, y: Y_T2, z: -3.8 };
      }
      if (from.x < 9.6 && goal.x > 13.6) {
        if (Math.abs(from.z - (-3.8)) > 1.05) return { x: 9.0, y: Y_T2, z: -3.8 };
        return { x: 15.6, y: Y_T2, z: -3.8 };
      }
      if (from.x > 14.8 && goal.x < 10.2) {
        if (Math.abs(from.z - (-3.8)) > 1.05) return { x: 15.6, y: Y_T2, z: -3.8 };
        return { x: 9.0, y: Y_T2, z: -3.8 };
      }
    }
    // Floor 1 West <-> East across South Hero Bridge (b_south at z = 16.0) + West Garden Promenade around Kimono Teahouse
    if (Math.abs(fy - Y_T1) < 0.85 && Math.abs(gy - Y_T1) < 0.85) {
      if (from.x < -14.8 && from.z < 19.0 && goal.x < -8.0 && goal.z > 14.0) {
        if (from.z < 11.8) return { x: -23.3, y: Y_T1, z: 12.2 };
        return { x: -13.6, y: Y_T1, z: 19.8 };
      }
      if (from.x < -3.8 && goal.x > 3.4) {
        if (Math.abs(from.z - 16.0) > 0.55) return { x: -5.2, y: Y_T1, z: 16.0 };
        return { x: 5.2, y: Y_T1, z: 16.0 };
      }
      if (from.x > 3.8 && goal.x < -3.4) {
        if (Math.abs(from.z - 16.0) > 0.55) return { x: 5.2, y: Y_T1, z: 16.0 };
        return { x: -5.2, y: Y_T1, z: 16.0 };
      }
    }
    return null;
  },

  // Herbal Steam Eruption visibility/hearing muffling factor (0..1)
  steamFactorAt(pos) {
    if (WORLD_STATE.steamStrength <= 0.02) return 0;
    let best = 0;
    for (const v of WORLD_STATE.steamVents) {
      const dx = pos.x - v.x, dz = pos.z - v.z, dy = (pos.y || 0) - v.y;
      if (dy < -1.0 || dy > 4.8) continue;
      const d = Math.hypot(dx, dz);
      if (d < v.r) {
        best = Math.max(best, (1 - d / v.r) * WORLD_STATE.steamStrength);
      }
    }
    return clamp(best, 0, 1);
  },

  // Context-sensitive G / #btnInteract query for Tubs, Eave Hooks, Lifts, Rotating Doors, Floodwheel & Foam Buckets!
  getNearbyInteraction(player, G) {
    if (!player) return null;
    const u = player.userData;
    if (u.specialMode === 'tub') {
      return { kind: 'tub', icon: '🦆', label: 'Hop Out of Tub' };
    }
    if (u.specialMode === 'hook') {
      return { kind: 'hook', icon: '🏮', label: 'Drop From Eave' };
    }
    const px = player.position.x, pz = player.position.z;
    const py = (u.groundY ?? sampleBathhouseHeight(px, pz)) + (u.jy || 0);

    // 1. Working East Wooden Pulley Bath-Lift (Floor 1 <-> Floor 3)
    const dLift = Math.hypot(px - LIFT_X, pz - LIFT_Z);
    if (dLift < 2.9 && (Math.abs(py - Y_T1) < 0.9 || Math.abs(py - Y_T3) < 0.9 || inLiftShaft(px, pz))) {
      const atTop = WORLD_STATE.liftY > (Y_T1 + Y_T3) * 0.5;
      const riding = inLiftShaft(px, pz);
      return {
        id: 'bh_pulley_lift',
        kind: 'lift',
        icon: '🛗',
        x: LIFT_X,
        y: py,
        z: LIFT_Z,
        label: riding
          ? (atTop ? 'Ride Down to Floor 1' : 'Ride Up to Floor 3')
          : (Math.abs(py - WORLD_STATE.liftY) < 0.6 ? 'Ride Bath-Lift' : 'Call Bath-Lift'),
      };
    }

    // 1B. Upgraded 3-Stop West Timber Dumbwaiter Lift (Undercroft Boiler <-> Floor 2 Courtyard <-> Floor 3 Crown)
    const dDumb = Math.hypot(px - DUMB_X, pz - DUMB_Z);
    if (dDumb < 2.95 && (Math.abs(py - Y_UND) < 0.98 || Math.abs(py - Y_T2) < 0.98 || Math.abs(py - Y_T3) < 0.98 || inDumbwaiterShaft(px, pz))) {
      const riding = inDumbwaiterShaft(px, pz);
      const curIdx = nearestDumbStopIdx(WORLD_STATE.dumbY);
      const atFloor = Math.abs(py - WORLD_STATE.dumbY) < 0.65;
      let nextLabel = 'Call Timber Dumbwaiter';
      if (riding || atFloor) {
        if (curIdx === 0) nextLabel = 'Ride Dumbwaiter ↑ Courtyard';
        else if (curIdx === 2) nextLabel = 'Ride Dumbwaiter ↓ Courtyard';
        else nextLabel = WORLD_STATE.dumbDir >= 0 ? 'Ride Dumbwaiter ↑ Bathhouse Crown' : 'Ride Dumbwaiter ↓ Boiler';
      }
      return {
        id: 'bh_dumbwaiter_lift',
        kind: 'lift',
        icon: '🧺',
        x: DUMB_X,
        y: py,
        z: DUMB_Z,
        label: nextLabel,
      };
    }

    // 1C. Rotating Lotus Doors, Boiler Reservoir Floodwheel & Foam Buckets (`kind: 'mechanism'`)
    const nowSec = performance.now() * 0.001;
    for (const ms of WORLD_STATE.mechSpots) {
      if (Math.abs(py - ms.y) > 1.35) continue;
      const dWheel = Math.hypot(px - ms.x, pz - ms.z);
      const dDoor = ms.doorCx != null ? Math.hypot(px - ms.doorCx, pz - ms.doorCz) : Infinity;
      if (dWheel <= (ms.interactRadius || 2.35) || dDoor <= 2.35) {
        const rem = Math.ceil((ms.cdUntil || 0) - nowSec);
        if (ms.mechType === 'floodwheel') {
          return {
            ...ms,
            label: rem > 0
              ? `Floodwheel Recharging (${rem}s)`
              : (isCanalFlooded() ? 'Drain Bath Canal to Dry Bed' : 'Flood Bath Canal to High Tide'),
          };
        }
        return {
          ...ms,
          label: rem > 0 ? `${ms.baseLabel} (${rem}s)` : ms.baseLabel,
        };
      }
    }

    // 2. Pressurized Steam-Pipe Chutes (`kind: 'ride_path'` — available in both Hide & Seek!)
    if (!u.ridePath) {
      for (let i = 0; i < WORLD_STATE.steamChutes.length; i++) {
        const sc = WORLD_STATE.steamChutes[i];
        if (Math.abs(py - sc.fromY) <= 1.25 && Math.hypot(px - sc.fromX, pz - sc.fromZ) <= 2.25) {
          return sc;
        }
      }
    }

    if (G && G.mode !== 'hide') return null;

    // 3. Check Steaming Cedar Tubs & Wall-Hung Eave Hooks
    let best = null, bestD = 2.35;
    for (const sp of WORLD_STATE.interactSpots) {
      if (sp.kind === 'ride_path' || sp.kind === 'mechanism' || sp.kind === 'lift') continue;
      if (sp.occupiedBy && sp.occupiedBy !== player && !sp.occupiedBy.userData?.actor?.eliminated) continue;
      if (Math.abs(py - sp.groundY) > 1.1) continue;
      const d = Math.hypot(px - sp.x, pz - sp.z);
      if (d < bestD) {
        bestD = d;
        best = sp;
      }
    }
    return best;
  },

  sampleLauncherAt(ch, _G, _dt) {
    if (!ch || !ch.position || !ch.userData || ch.userData.specialMode || ch.userData.ridePath || ch.userData.rideRail) return null;
    const now = performance.now();
    const px = ch.position.x, pz = ch.position.z;
    const py = (ch.userData.groundY ?? ch.position.y) + (ch.userData.jy || 0);

    // 1. Copper Steam-Pipe Chutes
    const last = WORLD_STATE.chuteCooldowns.get(ch) || 0;
    if (now - last >= 2200) {
      for (let i = 0; i < WORLD_STATE.steamChutes.length; i++) {
        const sc = WORLD_STATE.steamChutes[i];
        if (Math.abs(py - sc.fromY) <= 0.85 && Math.hypot(px - sc.fromX, pz - sc.fromZ) <= 1.05) {
          WORLD_STATE.chuteCooldowns.set(ch, now);
          return {
            rideSpot: {
              fromX: sc.fromX,
              fromY: sc.fromY,
              fromZ: sc.fromZ,
              toX: sc.toX,
              toY: sc.toY,
              toZ: sc.toZ,
              dur: sc.dur,
              arcY: sc.arcY,
            },
            hintMsg: sc.enterHint,
          };
        }
      }
    }

    // 2. Flooded Bath Canal Downstream Current Impulse (when High Tide covers canal!)
    if (inBathCanal(px, pz) && isCanalFlooded() && py < 1.15 && (ch.userData.jy || 0) < 0.45) {
      const lastCur = WORLD_STATE.canalCurrentCooldowns.get(ch) || 0;
      if (now - lastCur >= 520) {
        WORLD_STATE.canalCurrentCooldowns.set(ch, now);
        const isDuck = ch.userData.propId === 'bh_bath_duck';
        const nearExit = pz >= 22.8;
        return {
          knockVx: nearExit ? (px >= 0 ? 3.8 : -3.8) : -px * 0.42,
          knockVz: nearExit ? -1.4 : 5.6,
          vy: isDuck ? 2.75 : 2.15,
          hintMsg: isDuck
            ? '🦆 Quack! Bath Canal current rockets your bath duck downstream!'
            : '🌊 High Tide Canal current sweeps you downstream!',
        };
      }
    }
    return null;
  },

  getInteractSpots() {
    return [
      ...(WORLD_STATE.interactSpots || []),
      ...(WORLD_STATE.mechSpots || []),
      ...(WORLD_STATE.liftSpots || []),
    ];
  },

  triggerMechanism(actor, inter) {
    if (!inter) return null;
    const ms = WORLD_STATE.mechSpots.find((m) => m.id === inter.id);
    if (!ms) return null;
    const nowSec = performance.now() * 0.001;

    if (ms.mechType === 'rotating_door') {
      const door = WORLD_STATE.rotatingDoors.find((d) => d.id === ms.doorId);
      const msg = toggleRotatingDoor(door, false);
      if (door && nowSec >= (ms.cdUntil || 0)) ms.cdUntil = nowSec + 1.05;
      return msg;
    }

    if (nowSec < (ms.cdUntil || 0)) {
      const rem = Math.ceil(ms.cdUntil - nowSec);
      return `${ms.icon || '⚙️'} Mechanism resetting… ${rem}s`;
    }

    if (ms.mechType === 'floodwheel') {
      ms.cdUntil = nowSec + 6.0;
      if (WORLD_STATE.triggerTideShift) {
        return WORLD_STATE.triggerTideShift();
      }
      return '🌊 Boiler Reservoir Floodwheel cranked!';
    }

    if (ms.mechType === 'coal_chute') {
      ms.cdUntil = nowSec + 9.5;
      if (WORLD_STATE.spawnDecoySwarm) {
        WORLD_STATE.spawnDecoySwarm(ms.chuteCfg);
      }
      return ms.triggerHint || '✨ Released Suds-Sprites! Decoy footsteps lure AI Seekers away!';
    }

    return null;
  },

  getSteamState() {
    return { strength: WORLD_STATE.steamStrength || 0, vents: WORLD_STATE.steamVents || [] };
  },

  buildTubDisguise(THREE, spot) {
    return spot && spot.lid ? buildCedarTubLid(THREE) : buildFloatingBathDuck(THREE);
  },

  triggerPulleyLift(player, inter) {
    const px = player?.position?.x ?? LIFT_X;
    const pz = player?.position?.z ?? LIFT_Z;
    const py = player?.userData?.groundY ?? sampleBathhouseHeight(px, pz);

    const isDumb = inter?.id === 'bh_dumbwaiter_lift' || (!inter?.id && Math.hypot(px - DUMB_X, pz - DUMB_Z) < Math.hypot(px - LIFT_X, pz - LIFT_Z));
    if (isDumb) {
      const riding = player && inDumbwaiterShaft(px, pz);
      const playerFloorIdx = py < 1.75 ? 0 : (py < 4.0 ? 1 : 2);
      const carFloorIdx = nearestDumbStopIdx(WORLD_STATE.dumbY);
      const atPlayerFloor = Math.abs(WORLD_STATE.dumbY - DUMB_STOPS[playerFloorIdx]) <= 0.45;
      if (!riding && !atPlayerFloor) {
        WORLD_STATE.dumbTargetY = DUMB_STOPS[playerFloorIdx];
        WORLD_STATE.dumbMoving = true;
        WORLD_STATE.dumbHoldT = 8.0;
        return '🧺 Summoning Timber Dumbwaiter to your floor…';
      }
      let nextIdx;
      if (WORLD_STATE.dumbMoving) {
        WORLD_STATE.dumbDir = -WORLD_STATE.dumbDir;
        nextIdx = clamp(carFloorIdx + WORLD_STATE.dumbDir, 0, 2);
      } else {
        if (carFloorIdx === 0) WORLD_STATE.dumbDir = 1;
        else if (carFloorIdx === 2) WORLD_STATE.dumbDir = -1;
        nextIdx = clamp(carFloorIdx + WORLD_STATE.dumbDir, 0, 2);
      }
      WORLD_STATE.dumbTargetY = DUMB_STOPS[nextIdx];
      WORLD_STATE.dumbMoving = true;
      WORLD_STATE.dumbHoldT = 8.0;
      const stopNames = ['Boiler Undercroft', 'Courtyard (Floor 2)', 'Bathhouse Crown (Floor 3)'];
      return `🧺 Timber Dumbwaiter riding to ${stopNames[nextIdx]}!`;
    }

    const riding = player && inLiftShaft(px, pz);
    if (riding) {
      const goUp = WORLD_STATE.liftY < (Y_T1 + Y_T3) * 0.5;
      WORLD_STATE.liftTargetY = goUp ? Y_T3 : Y_T1;
      WORLD_STATE.liftMoving = true;
      WORLD_STATE.liftHoldT = 8.0;
      return goUp ? '🛗 Hoisting wooden bath-lift up to Floor 3 (Upper Bathhouse)!' : '🛗 Lowering wooden bath-lift down to Floor 1 (Canal Grotto)!';
    }
    const wantY = py > 3.0 ? Y_T3 : Y_T1;
    if (Math.abs(WORLD_STATE.liftY - wantY) > 0.35) {
      WORLD_STATE.liftTargetY = wantY;
      WORLD_STATE.liftMoving = true;
      WORLD_STATE.liftHoldT = 8.0;
      return '🛗 Summoning the wooden pulley bath-lift to your floor…';
    }
    WORLD_STATE.liftTargetY = wantY === Y_T1 ? Y_T3 : Y_T1;
    WORLD_STATE.liftMoving = true;
    WORLD_STATE.liftHoldT = 8.0;
    return '🛗 Step aboard quickly — the wooden bath-lift is departing!';
  },

  buildWorld(ctx) {
    const { THREE, root } = ctx;
    const { rr, jr, pick } = makeRng(2026);
    const B = buildBuildings(THREE);
    WORLD_STATE.audio = ctx.audio || null;
    WORLD_STATE.notify = ctx.notify || null;
    WORLD_STATE.spawnPuff = ctx.spawnPuff || null;
    WORLD_STATE.splash = ctx.splash || null;
    WORLD_STATE.emitSoundCue = ctx.emitSoundCue || null;
    WORLD_STATE.liftY = Y_T1;
    WORLD_STATE.liftTargetY = Y_T3;
    WORLD_STATE.liftHoldT = 4.0;
    WORLD_STATE.liftMoving = false;
    WORLD_STATE.liftCar = null;
    WORLD_STATE.dumbStopIdx = 1;
    WORLD_STATE.dumbDir = 1;
    WORLD_STATE.dumbY = Y_T2;
    WORLD_STATE.dumbTargetY = Y_T3;
    WORLD_STATE.dumbHoldT = 4.5;
    WORLD_STATE.dumbMoving = false;
    WORLD_STATE.dumbCar = null;
    WORLD_STATE.steamStrength = 0;
    WORLD_STATE.steamChutes = [];
    WORLD_STATE.mechSpots = [];
    WORLD_STATE.liftSpots = [];
    WORLD_STATE.interactSpots = [];
    WORLD_STATE.rotatingDoors = [];
    WORLD_STATE.decoySudsSprites = [];
    WORLD_STATE.tideTimer = 0;
    WORLD_STATE.tideY = TIDE_DRY_Y;
    WORLD_STATE.tideTargetY = TIDE_DRY_Y;
    WORLD_STATE.tideWarnedPhase = -1;
    WORLD_STATE.prevFloodPhase = false;
    WORLD_STATE.canalWater = null;
    WORLD_STATE.canalCurrentCooldowns = new WeakMap();
    WORLD_STATE.chuteCooldowns = new WeakMap();
    if (WORLD_STATE.creatures) {
      WORLD_STATE.creatures.dispose();
      WORLD_STATE.creatures = null;
    }

    const addSpotSafe = (x, z, hex, kind = 'stone', yOverride) => {
      const y = typeof yOverride === 'number' ? yOverride : sampleBathhouseHeight(x, z);
      if (ctx.spot) ctx.spot(x, z, hex, kind, y);
    };
    const addGroundMesh = (mesh, paintHex) => {
      mesh.receiveShadow = true;
      mesh.userData.ground = true;
      mesh.userData.paint = new THREE.Color(paintHex);
      root.add(mesh);
      return mesh;
    };

    // Shared warm Storybook architectural materials (100% metalness: 0!)
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x9b94a2,
      map: kitTex(THREE, 'stone', 3, 3),
      roughness: 0.88,
      metalness: 0,
    });
    const mossStoneMat = new THREE.MeshStandardMaterial({
      color: 0x708b66,
      map: kitTex(THREE, 'stone', 2, 2),
      roughness: 0.90,
      metalness: 0,
    });
    const vermilionMat = new THREE.MeshStandardMaterial({
      color: 0xd13d30,
      map: kitTex(THREE, 'painted_metal', 2, 2),
      roughness: 0.62,
      metalness: 0,
    });
    const cedarMat = new THREE.MeshStandardMaterial({
      color: 0xc6864e,
      map: kitTex(THREE, 'wood_light', 2, 2),
      roughness: 0.78,
      metalness: 0,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x563421,
      map: kitTex(THREE, 'wood_planks_dark', 1.5, 1.5),
      roughness: 0.85,
      metalness: 0,
    });
    const copperCapMat = new THREE.MeshStandardMaterial({
      color: 0x469f90,
      roughness: 0.70,
      metalness: 0,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf4c44e,
      roughness: 0.42,
      metalness: 0,
      emissive: 0x8a5a10,
      emissiveIntensity: 0.22,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x786e4c,
      roughness: 0.52,
      metalness: 0,
      emissive: 0x2c2410,
      emissiveIntensity: 0.14,
    });
    const lanternGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffea9f,
      emissive: 0xffa430,
      emissiveIntensity: 1.95,
      roughness: 0.40,
      metalness: 0,
    });
    const waterGlowMat = new THREE.MeshStandardMaterial({
      color: 0x6be8e0,
      emissive: 0x24a8b8,
      emissiveIntensity: 0.95,
      roughness: 0.24,
      metalness: 0,
    });
    const terraceFlagMat = new THREE.MeshStandardMaterial({
      color: 0xebe3ec,
      map: buildTerraceFlagstoneTex(THREE),
      roughness: 0.88,
      metalness: 0,
    });

    // ========================================================================
    // 1. TWILIGHT FULL MOON & DISTANT LIT MOUNTAIN TEMPLES (NO UGLY CONES!)
    //    Lets sky_panorama.png shine cleanly across the entire 360° horizon!
    // ========================================================================
    {
      const skyG = new THREE.Group();
      skyG.name = 'twilight_moon_backdrop';
      root.add(skyG);

      // Luminous full moon disc + soft warm glow halo in the upper-right northern sky (matching overview.png!)
      const moonPos = new THREE.Vector3(36, 42, -138);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(6.8, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xfff6d2, fog: false })
      );
      moon.position.copy(moonPos);
      skyG.add(moon);

      const haloTex = paintedCanvasTex(THREE, 'bh3_moon_halo', 128, (g, s) => {
        const gr = g.createRadialGradient(s * 0.5, s * 0.5, 6, s * 0.5, s * 0.5, s * 0.5);
        gr.addColorStop(0, 'rgba(255,245,205,0.92)');
        gr.addColorStop(0.35, 'rgba(255,208,150,0.38)');
        gr.addColorStop(1, 'rgba(255,180,140,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, s, s);
      });
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloTex,
        transparent: true,
        depthWrite: false,
        fog: false,
      }));
      halo.position.copy(moonPos);
      halo.scale.set(36, 36, 1);
      skyG.add(halo);
    }

    // ========================================================================
    // 2. SHIMMERING SPIRIT LAGOON & DISTANT HORIZON SEA MIRROR
    // ========================================================================
    const outerSea = new THREE.Mesh(
      new THREE.CircleGeometry(194, 64),
      new THREE.MeshBasicMaterial({ color: 0x266580, fog: true })
    );
    outerSea.rotation.x = -PI * 0.5;
    outerSea.position.y = -0.22;
    root.add(outerSea);

    const water = createAnimatedWater(THREE, {
      radius: 192,
      y: -0.04,
      deep: 0x1d5f80,
      shallow: 0x3ec2d0,
      foam: 0xeaffff,
      opacity: 0.90,
      scale: 0.34,
      walkable: false,
    });
    root.add(water.mesh);

    // ========================================================================
    // 3. 3-TIER VERTICAL CLIFFSIDE TERRACE DECKS, 3D COBBLES & MOSSY CLIFF WALLS
    // ========================================================================
    const boulderGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const cliffStones = [];
    const pushCliffBoulder = (x, y, z, sx, sy, sz, col) => {
      cliffStones.push({ x, y, z, rx: jr(0, 3), ry: jr(0, 3), rz: jr(0, 2), sx, sy, sz, col });
    };

    // Helper: extruded rounded rectangular terrace island + mossy 3D cliff boulder skirt down to water!
    const buildTerraceMass = (cx, cz, w, d, topY, skirtStep = 1.05, skipSideFn = null) => {
      const sh = new THREE.Shape();
      const hw = w * 0.5, hd = d * 0.5, r = Math.min(2.4, hw * 0.25, hd * 0.25);
      sh.moveTo(-hw + r, -hd);
      sh.lineTo(hw - r, -hd);
      sh.quadraticCurveTo(hw, -hd, hw, -hd + r);
      sh.lineTo(hw, hd - r);
      sh.quadraticCurveTo(hw, hd, hw - r, hd);
      sh.lineTo(-hw + r, hd);
      sh.quadraticCurveTo(-hw, hd, -hw, hd - r);
      sh.lineTo(-hw, -hd + r);
      sh.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

      const depth = topY + 0.35;
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 8 });
      geo.rotateX(PI * 0.5);
      const m = new THREE.Mesh(geo, terraceFlagMat);
      m.position.set(cx, topY - 0.08, cz);
      m.castShadow = true;
      addGroundMesh(m, COL_TERRACE);

      // Vermilion/stone coping rim + multi-course 3D mossy cliff boulders down the vertical retaining wall!
      const courses = Math.max(1, Math.round(topY / 0.95));
      const perim = [];
      for (let x = -hw + 0.6; x <= hw - 0.6; x += skirtStep) {
        perim.push([cx + x, cz - hd], [cx + x, cz + hd]);
      }
      for (let z = -hd + 0.6; z <= hd - 0.6; z += skirtStep) {
        perim.push([cx - hw, cz + z], [cx + hw, cz + z]);
      }
      for (const [px, pz] of perim) {
        if (skipSideFn && skipSideFn(px, pz)) continue;
        for (let c = 0; c <= courses; c++) {
          const fy = (c / courses) * (topY - 0.22);
          const jit = jr(-0.18, 0.18);
          const isMoss = c === 0 || (c + Math.floor(px + pz)) % 3 === 0;
          pushCliffBoulder(
            px + jit, fy + 0.15, pz + jr(-0.18, 0.18),
            jr(0.95, 1.48), jr(0.72, 1.15), jr(0.95, 1.45),
            isMoss ? pick(MOSS_BOULDER_PAL) : pick(STONE_BOULDER_PAL)
          );
        }
      }
    };

    // ---- TIER 1 (y = 1.05m): SW Kimono Teahouse Island, SE Shrine & Rotenburo Island, Tidal Canal & East Lift Walk!
    buildTerraceMass(-14.6, 15.2, 22.0, 15.4, Y_T1, 1.15, (px, pz) => px > -4.1 && pz >= 10.2 && pz <= 24.8);
    buildTerraceMass(14.6, 16.0, 22.0, 17.0, Y_T1, 1.15, (px, pz) => px < 4.1 && pz >= 10.2 && pz <= 25.4);

    // Central Tidal Bath Canal: Stepped Stone Under-Bridge Riverbed, Sluice Lock Coping, South Weir & Animated Tide Water!
    {
      const bedSlab = new THREE.Mesh(new RoundedBoxGeometry(7.16, 0.24, 14.8, 2, 0.04), mossStoneMat);
      bedSlab.position.set(0, 0.06, 17.75);
      addGroundMesh(bedSlab, 0x7b8984);

      // Stepping flagstones along the dry riverbed walkway beneath b_south
      for (let z = 12.6; z <= 24.0; z += 1.45) {
        const pad = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.06, 1.05, 1, 0.02), stoneMat);
        pad.position.set(((Math.round(z) % 2) - 0.5) * 0.25, 0.185, z);
        addGroundMesh(pad, COL_TERRACE);
      }

      // North Arch Canal Steps (z in [10.35, 12.15])
      for (let i = 0; i < 4; i++) {
        const h = 0.88 - i * 0.22;
        const step = new THREE.Mesh(new RoundedBoxGeometry(4.2, h, 0.48, 1, 0.02), stoneMat);
        step.position.set(0, h * 0.5, 10.58 + i * 0.45);
        addGroundMesh(step, COL_TERRACE);
      }

      // SW & SE Island Canal Steps (z in [18.8, 21.4])
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const h = 0.88 - i * 0.22;
          const step = new THREE.Mesh(new RoundedBoxGeometry(0.42, h, 2.55, 1, 0.02), stoneMat);
          step.position.set(sx * (3.38 - i * 0.38), h * 0.5, 20.1);
          addGroundMesh(step, COL_TERRACE);
        }
      }

      // Stone Lock Coping Walls (leave b_south at z in [14.2, 17.8] and steps at z in [18.7, 21.5] open!)
      for (const sx of [-1, 1]) {
        for (const [z0, z1] of [[10.45, 14.05], [21.55, 25.15]]) {
          const segLen = z1 - z0;
          const zMid = (z0 + z1) * 0.5;
          const curb = new THREE.Mesh(new RoundedBoxGeometry(0.32, 1.60, segLen, 1, 0.03), stoneMat);
          curb.position.set(sx * 3.62, 0.80, zMid);
          curb.castShadow = true;
          curb.receiveShadow = true;
          root.add(curb);
          if (ctx.solids) ctx.solids.push(curb);
          if (ctx.addWorldObb) ctx.addWorldObb(sx * 3.62, zMid, 0.17, segLen * 0.5, 0, 0.0, 1.56, true);
        }
        // Bronze sluice beacon pillar beside North canal entry (emissive glow only, zero PointLights!)
        const post = new THREE.Mesh(new RoundedBoxGeometry(0.28, 1.35, 0.28, 1, 0.03), bronzeMat);
        post.position.set(sx * 3.62, Y_T1 + 0.67, 13.75);
        root.add(post);
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), waterGlowMat);
        beacon.position.set(sx * 3.62, Y_T1 + 1.50, 13.75);
        root.add(beacon);
      }

      // South Canal Overflow Weir Dam at z = 25.22
      const weir = new THREE.Mesh(new RoundedBoxGeometry(7.5, 1.52, 0.42, 1, 0.04), mossStoneMat);
      weir.position.set(0, 0.76, 25.22);
      weir.castShadow = true;
      weir.receiveShadow = true;
      root.add(weir);
      if (ctx.solids) ctx.solids.push(weir);
      if (ctx.addWorldObb) ctx.addWorldObb(0, 25.22, 3.72, 0.22, 0, 0.0, 1.54, false);

      // Animated Turquoise Canal Bathwater Mesh (rises/drains between y=0.15 Dry Bed & y=1.48 High Tide)
      const canalGeo = new THREE.PlaneGeometry(7.16, 14.82, 14, 28);
      const canalWater = createAnimatedWater(THREE, {
        geometry: canalGeo,
        y: TIDE_DRY_Y,
        deep: 0x158ca6,
        shallow: 0x4ae8e2,
        foam: 0xf2ffff,
        opacity: 0.85,
        scale: 0.62,
        texScale: 0.16,
        walkable: false,
      });
      canalWater.mesh.position.set(0, TIDE_DRY_Y, 17.75);
      canalWater.mesh.userData.keep = true;
      root.add(canalWater.mesh);
      WORLD_STATE.canalWater = canalWater;
    }

    // Floor 1 East Canal Grotto Cedar Boardwalk leading under b_east straight to the Pulley Bath-Lift (openings for Undercroft & NE Soot Vent!)
    {
      const bwLen = 19.4, bwZ = -0.9;
      const deck = new THREE.Mesh(new RoundedBoxGeometry(2.55, 0.16, bwLen, 2, 0.04), cedarMat);
      deck.position.set(LIFT_X, Y_T1 - 0.08, bwZ);
      deck.castShadow = true;
      addGroundMesh(deck, COL_WOOD);
      // Submerged mossy pilings & outer canal guardrail along x = LIFT_X - 1.22 (leave Undercroft portal z in [-7.6,-2.0] open!)
      for (let z = -9.6; z <= 7.8; z += 2.4) {
        for (const sx of [-1.05, 1.05]) {
          const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, Y_T1 + 0.35, 8), darkWoodMat);
          pil.position.set(LIFT_X + sx, (Y_T1 - 0.35) * 0.5, z);
          root.add(pil);
        }
        if (z > -7.8 && z < -1.8) continue;
        const post = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.72, 0.11, 1, 0.02), vermilionMat);
        post.position.set(LIFT_X - 1.18, Y_T1 + 0.36, z);
        root.add(post);
      }
      const railSouth = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.08, 9.6, 1, 0.02), vermilionMat);
      railSouth.position.set(LIFT_X - 1.18, Y_T1 + 0.68, 3.2);
      root.add(railSouth);
    }

    // Floor 1 Symmetrical West Secret Canal Pier (under b_west), West Boiler Service Dock (Y_UND -> Y_T1) & South Twin-Arch Undercroft Link Pier!
    {
      const wDeck = new THREE.Mesh(new RoundedBoxGeometry(2.55, 0.16, 15.2, 2, 0.04), cedarMat);
      wDeck.position.set(-11.8, Y_T1 - 0.08, 1.6);
      wDeck.castShadow = true;
      addGroundMesh(wDeck, COL_WOOD);
      for (let z = -5.0; z <= 8.2; z += 2.6) {
        for (const sx of [-0.95, 0.95]) {
          const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, Y_T1 + 0.35, 8), darkWoodMat);
          pil.position.set(-11.8 + sx, (Y_T1 - 0.35) * 0.5, z);
          root.add(pil);
        }
      }
      // West Boiler Service Dock connecting Dumbwaiter bottom (Y_UND = 0.50m) smoothly to West Canal Pier (Y_T1 = 1.05m)!
      const bDock = new THREE.Mesh(new RoundedBoxGeometry(2.35, 0.16, 2.35, 2, 0.03), cedarMat);
      bDock.position.set(-12.5, Y_UND - 0.08, -9.3);
      addGroundMesh(bDock, COL_WOOD);
      const bRampLen = Math.hypot(2.3, Y_T1 - Y_UND);
      const bRamp = new THREE.Mesh(new RoundedBoxGeometry(2.35, 0.16, bRampLen + 0.25, 2, 0.03), cedarMat);
      bRamp.position.set(-12.5, (Y_UND + Y_T1) * 0.5 - 0.08, -7.05);
      bRamp.rotation.x = -Math.atan2(Y_T1 - Y_UND, 2.3);
      addGroundMesh(bRamp, COL_WOOD);
      const southArch = new THREE.Mesh(new RoundedBoxGeometry(7.8, 0.24, 3.9, 2, 0.05), stoneMat);
      southArch.position.set(0.0, Y_T1 - 0.12, 8.5);
      southArch.castShadow = true;
      addGroundMesh(southArch, COL_TERRACE);
    }

    // ---- TIER 2 (y = 2.85m): Hollowed Central Dragon Courtyard Deck + Sub-Courtyard Boiler Undercroft!
    {
      const CY_Z = -1.15, CY_R = 10.65;
      // Structural Courtyard Top Slab (ceiling underside at y = 2.29m so players walk cleanly inside the Undercroft below!)
      const groutCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(CY_R, CY_R + 0.22, 0.56, 64),
        new THREE.MeshStandardMaterial({ color: 0xd8cfd8, map: buildPlazaTexture(THREE), roughness: 0.90, metalness: 0 })
      );
      groutCyl.position.set(0, Y_T2 - 0.28, CY_Z);
      groutCyl.castShadow = true;
      addGroundMesh(groutCyl, COL_PLAZA);

      // Boiler Undercroft Brick Floor, Entry Ramps & Warm Glowing Boiler Grates (y = 0.50m!)
      const undFloor = new THREE.Mesh(new RoundedBoxGeometry(17.8, 0.24, 13.8, 2, 0.04), darkWoodMat);
      undFloor.position.set(0, Y_UND - 0.12, -2.1);
      addGroundMesh(undFloor, COL_WOOD);
      const undRampE = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.16, 3.6, 2, 0.03), cedarMat);
      undRampE.position.set(9.1, (Y_UND + Y_T1) * 0.5 - 0.08, -3.9);
      undRampE.rotation.z = Math.atan2(Y_T1 - Y_UND, 2.8);
      addGroundMesh(undRampE, COL_WOOD);
      const undRampW = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.16, 3.6, 2, 0.03), cedarMat);
      undRampW.position.set(-9.1, (Y_UND + Y_T1) * 0.5 - 0.08, -3.9);
      undRampW.rotation.z = -Math.atan2(Y_T1 - Y_UND, 2.8);
      addGroundMesh(undRampW, COL_WOOD);
      const undRampS = new THREE.Mesh(new RoundedBoxGeometry(4.0, 0.16, 3.6, 2, 0.03), cedarMat);
      undRampS.position.set(0, (Y_UND + Y_T1) * 0.5 - 0.08, 5.2);
      undRampS.rotation.x = -Math.atan2(Y_T1 - Y_UND, 3.2);
      addGroundMesh(undRampS, COL_WOOD);
      const undRampNE = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.16, 2.6, 2, 0.03), cedarMat);
      undRampNE.position.set(8.6, (Y_UND + Y_T1) * 0.5 - 0.08, -6.4);
      undRampNE.rotation.z = Math.atan2(Y_T1 - Y_UND, 2.8);
      addGroundMesh(undRampNE, COL_WOOD);

      // Vaulted Interior Chamber Walls (leaving T-gallery & NE Soot Vent wide open!) with OBBs keeping inside unobstructed
      const furnaceMat = new THREE.MeshStandardMaterial({ color: 0xff8438, emissive: 0xff5a18, emissiveIntensity: 1.85, roughness: 0.45, metalness: 0 });
      const boilerDrum = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 1.85, 14), copperCapMat);
      boilerDrum.position.set(-2.9, Y_UND + 0.92, -6.5);
      root.add(boilerDrum);
      if (ctx.solids) ctx.solids.push(boilerDrum);
      if (ctx.addWorldObb) ctx.addWorldObb(-2.9, -6.5, 1.0, 1.0, 0, Y_UND - 0.2, Y_UND + 2.0, false);
      const emberCore = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.72, 0.25, 1, 0.04), furnaceMat);
      emberCore.position.set(-2.9, Y_UND + 0.48, -5.42);
      root.add(emberCore);
      // Corner masonry foundation piers supporting the Tier 2 drum
      for (const [px, pz, hx, hz] of [[-6.8, 2.2, 2.8, 2.8], [6.8, 2.2, 2.8, 2.8], [-6.8, -7.4, 2.5, 1.6]]) {
        const pier = new THREE.Mesh(new RoundedBoxGeometry(hx * 2, Y_T2 - Y_UND + 0.2, hz * 2, 2, 0.06), mossStoneMat);
        pier.position.set(px, (Y_UND + Y_T2) * 0.5 - 0.1, pz);
        pier.castShadow = true;
        pier.receiveShadow = true;
        root.add(pier);
        if (ctx.solids) ctx.solids.push(pier);
        if (ctx.addWorldObb) ctx.addWorldObb(px, pz, hx, hz, 0, Y_UND - 0.25, Y_T2 - 0.4, false);
      }

      // Concentric Crimson Courtyard Rings matching overview.png!
      for (const [rIn, rOut] of [[4.62, 5.02], [8.58, 9.02], [10.12, 10.62]]) {
        const rg = new THREE.RingGeometry(rIn, rOut, 64);
        rg.rotateX(-PI * 0.5);
        const rm = new THREE.Mesh(rg, vermilionMat);
        rm.position.set(0, Y_T2 + 0.014, CY_Z);
        addGroundMesh(rm, COL_BORDER);
      }

      // 1,100+ Real 3D Instanced Squircle Twilight Cobblestones across the Courtyard (1 draw call!)
      const cobMats = [], cobCols = [];
      const oTmp = new THREE.Object3D();
      const COB_PAL = [0xb2a6be, 0xa49cb8, 0xc2aeb8, 0x9c9ab4, 0xbcb0c4, 0xa89eae, 0xc8b6b4];
      let rad = 0.7;
      while (rad < CY_R - 0.55) {
        const onCrimson = (rad > 4.45 && rad < 5.15) || (rad > 8.45 && rad < 9.15);
        const cw = 0.48;
        const rc = rad + cw * 0.5;
        const n = Math.max(8, Math.round((TAU * rc) / 0.56));
        const off = jr(0, TAU);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU + jr(-0.02, 0.02);
          const sx = Math.cos(a) * rc, sz = CY_Z + Math.sin(a) * rc;
          if (sz < -9.5 || sz > 7.2) continue;
          oTmp.position.set(sx, Y_T2 + 0.004, sz);
          oTmp.rotation.set(0, -a + jr(-0.05, 0.05), 0);
          oTmp.scale.set(cw * jr(0.84, 0.94), onCrimson ? 0.036 : jr(0.028, 0.040), ((TAU * rc) / n) * jr(0.86, 0.94));
          oTmp.updateMatrix();
          cobMats.push(oTmp.matrix.clone());
          const col = onCrimson
            ? new THREE.Color(0xc94136).offsetHSL(0, 0, jr(-0.04, 0.04))
            : new THREE.Color(pick(COB_PAL)).offsetHSL(0, jr(-0.02, 0.02), jr(-0.05, 0.05));
          cobCols.push(col);
        }
        rad += cw;
      }
      const cobInst = new THREE.InstancedMesh(
        getCobbleGeo(THREE),
        new THREE.MeshStandardMaterial({ color: 0xffffff, map: kitTex(THREE, 'plaster', 0.5, 0.5), roughness: 0.86, metalness: 0 }),
        cobMats.length
      );
      cobMats.forEach((m, i) => { cobInst.setMatrixAt(i, m); cobInst.setColorAt(i, cobCols[i]); });
      cobInst.receiveShadow = true;
      cobInst.userData.ground = true;
      root.add(cobInst);

      // Sculpted 3D Mossy Cliff Retaining Wall around the Central Courtyard Island (keeping ALL Undercroft Portals open!)
      for (let i = 0; i < 56; i++) {
        const a = (i / 56) * TAU;
        const bx = Math.sin(a) * (CY_R + 0.15), bz = CY_Z + Math.cos(a) * (CY_R + 0.15);
        // Leave stair, bridge & Undercroft tunnel portal openings clean
        if (bz > 6.0 && (Math.abs(bx + 5.2) < 1.9 || Math.abs(bx - 5.2) < 1.9 || Math.abs(bx) < 2.5)) continue;
        if (bz < -8.8 && (Math.abs(bx) < 2.4 || Math.abs(bx + 9.0) < 1.8)) continue;
        if (Math.abs(bz + 3.9) < 2.4 && Math.abs(bx) > 8.6) continue;
        if (bz < -4.4 && bz > -8.2 && bx > 8.2) continue;
        for (let c = 0; c < 3; c++) {
          pushCliffBoulder(
            bx + jr(-0.15, 0.15), 0.25 + c * 0.88, bz + jr(-0.15, 0.15),
            jr(1.0, 1.45), jr(0.75, 1.15), jr(1.0, 1.45),
            c === 0 ? pick(MOSS_BOULDER_PAL) : pick(STONE_BOULDER_PAL)
          );
        }
      }
    }

    // ---- TIER 2 West Ramen Wing, East Boiler Wing, Ramen Catwalk & West Stair Mezzanine Apron (y = 2.85m)
    buildTerraceMass(-20.1, -6.2, 12.6, 15.8, Y_T2, 1.15, (px, pz) => px > -14.4 && (Math.abs(pz + 3.8) < 2.1 || (pz < -5.8 && pz > -13.0)));
    buildTerraceMass(20.1, -6.2, 12.6, 15.8, Y_T2, 1.15, (px, pz) => px < 14.4 && Math.abs(pz + 3.8) < 2.1);
    buildTerraceMass(-8.6, -7.4, 5.4, 5.2, Y_T2, 1.15, (px, pz) => pz > -5.5 || px > -6.5 || (px < -10.5 && pz < -5.5));
    {
      // Tier 2 West Ramen Catwalk Apron connecting Ramen Wing (-14.2) & Mezzanine (-10.2) cleanly to Dumbwaiter (+Z shaft open!)
      const cwDeck = new THREE.Mesh(new RoundedBoxGeometry(4.0, 0.22, 4.45, 2, 0.04), cedarMat);
      cwDeck.position.set(-12.2, Y_T2 - 0.11, -8.02);
      cwDeck.castShadow = true;
      addGroundMesh(cwDeck, COL_WOOD);
    }

    // ---- TIER 3 (y = 5.15m): Upper Cliffside Grand Bathhouse Crown + East Lift & West Dumbwaiter Balconies!
    buildTerraceMass(0.0, -20.8, 28.8, 15.2, Y_T3, 1.10, (px, pz) => {
      if (pz > -13.6 && (Math.abs(px) < 2.4 || Math.abs(px + 9.0) < 1.9 || Math.abs(px - LIFT_X) < 1.7 || Math.abs(px - DUMB_X) < 1.8)) return true;
      return false;
    });
    for (const bx of [LIFT_X, DUMB_X]) {
      // Floor 3 Wooden Lift & Dumbwaiter Boarding Balconies linking Crown (-13.4) cleanly to Lift/Dumbwaiter Cars!
      const balDeck = new THREE.Mesh(new RoundedBoxGeometry(2.65, 0.16, 1.65, 2, 0.03), cedarMat);
      balDeck.position.set(bx, Y_T3 - 0.07, -13.12);
      balDeck.castShadow = true;
      addGroundMesh(balDeck, COL_WOOD);
      for (const sx of [-1.22, 1.22]) {
        const post = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.78, 0.11, 1, 0.02), vermilionMat);
        post.position.set(bx + sx, Y_T3 + 0.39, -12.65);
        root.add(post);
        const rail = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.08, 1.45, 1, 0.02), vermilionMat);
        rail.position.set(bx + sx, Y_T3 + 0.72, -13.10);
        root.add(rail);
      }
    }

    // Flush all 3D Mossy Cliff Retaining Wall Boulders into ONE fast InstancedMesh (1 draw call!)
    {
      const cliffInst = new THREE.InstancedMesh(
        boulderGeo,
        new THREE.MeshStandardMaterial({ color: 0xffffff, map: kitTex(THREE, 'plaster', 0.6, 0.6), roughness: 0.88, metalness: 0 }),
        cliffStones.length
      );
      const o = new THREE.Object3D(), col = new THREE.Color();
      cliffStones.forEach((s, i) => {
        o.position.set(s.x, s.y, s.z);
        o.rotation.set(s.rx, s.ry, s.rz);
        o.scale.set(s.sx, s.sy, s.sz);
        o.updateMatrix();
        cliffInst.setMatrixAt(i, o.matrix);
        cliffInst.setColorAt(i, col.setHex(s.col));
      });
      cliffInst.castShadow = true;
      cliffInst.receiveShadow = true;
      root.add(cliffInst);
    }

    // Silky Translucent Hot-Spring Cliff Cascades flanking Tier 3 & feeding the Waterwheel!
    const cascadeMat = new THREE.MeshStandardMaterial({
      color: 0x8ef5f2,
      emissive: 0x2cb4c4,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.72,
      roughness: 0.22,
      metalness: 0,
    });
    for (const [wx, yTop, yBot, wz] of [[-4.8, Y_T3 - 0.14, Y_T2 + 0.04, -13.25], [4.8, Y_T3 - 0.14, Y_T2 + 0.04, -13.25], [25.6, Y_T2 - 0.14, 0.0, -6.2]]) {
      const wfCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(wx, yTop, wz),
        new THREE.Vector3(wx, (yTop + yBot) * 0.56, wz + 0.36),
        new THREE.Vector3(wx, yBot, wz + 0.68),
      ]);
      const wfMesh = new THREE.Mesh(new THREE.TubeGeometry(wfCurve, 16, 0.22, 8, false), cascadeMat);
      wfMesh.scale.set(1.35, 1, 0.42);
      root.add(wfMesh);
      for (const r of [0.36, 0.58]) {
        const foamRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.042, 6, 20), cascadeMat);
        foamRing.rotation.x = PI * 0.5;
        foamRing.position.set(wx, yBot + 0.04, wz + 0.68);
        root.add(foamRing);
      }
    }

    // ========================================================================
    // 4. STEPPED STONE STAIRCASES, ARCHED VERMILION BRIDGES & WORKING PULLEY LIFT
    // ========================================================================
    for (const st of STAIRS) {
      ctx.placeKit(
        B.stoneStaircase({ width: st.width, rise: st.y1 - st.y0, run: st.run, steps: Math.round((st.y1 - st.y0) / 0.21), garden: false }),
        st.cx, st.cz, 0, 0.03, true, st.y0
      );
    }

    // Foreground Hero Bridge + Floor 2 West/East Canal Bridges + Outer Sloped Side Bridges
    ctx.placeKit(B.redBridge({ length: 8.2, width: 3.3, arch: 0.72, garden: false }), 0.0, 16.0, 0, 0.03, true, Y_T1);
    ctx.placeKit(B.redBridge({ length: 5.5, width: 3.3, arch: 0.42, garden: false }), -12.3, -3.8, 0, 0.03, true, Y_T2);
    ctx.placeKit(B.redBridge({ length: 5.5, width: 3.3, arch: 0.42, garden: false }), 12.3, -3.8, 0, 0.03, true, Y_T2);

    for (const sx of [-1, 1]) {
      const sideBridge = B.redBridge({ length: 6.6, width: 3.1, arch: 0.44, garden: false });
      const placed = ctx.placeKit(sideBridge, sx * 19.6, 4.4, PI * 0.5, 0.03, true, (Y_T1 + Y_T2) * 0.5);
      if (placed) placed.rotation.z = Math.atan2(Y_T2 - Y_T1, 6.6); // Gentle ramp from Floor 1 (+Z) up to Floor 2 (-Z)!
    }

    // Working 3-Tier Wooden Pulley Bath-Lift Tower at (LIFT_X = 11.8, y = Y_T1, LIFT_Z = -11.4)!
    const liftTower = B.pulleyLift({ height: (Y_T3 - Y_T1) + 0.65, garden: false });
    ctx.placeKit(liftTower, LIFT_X, LIFT_Z, 0, 0.03, true, Y_T1);
    const liftCar = liftTower ? (liftTower.userData.liftCar || liftTower.getObjectByName('liftCar')) : null;
    const pulleyWheel = liftTower ? (liftTower.userData.pulleyWheel || liftTower.getObjectByName('pulleyWheel')) : null;

    // ========================================================================
    // 5. COURTYARD LANDMARKS (DRAGON FOUNTAIN, BELL PAVILION, 2 SPIRIT STALLS)
    // ========================================================================
    ctx.placeKit(B.dragonFountain({ garden: false, seed: 11 }), -2.75, -1.55, 0.25, 0.04, true, Y_T2);
    ctx.placeKit(B.bellPavilion({ garden: false, seed: 17 }), 3.05, -2.05, -0.22, 0.04, true, Y_T2);
    ctx.placeKit(B.spiritStall({ garden: false, seed: 23 }), -7.15, -0.55, 1.15, 0.04, true, Y_T2);
    ctx.placeKit(B.spiritStall({ garden: false, seed: 29 }), 7.15, -0.55, -1.15, 0.04, true, Y_T2);

    // Courtyard benches & standing pedestal lanterns (clear of s1w / s1e stair mouths at ±5.2, 6.2!)
    for (const [bx, bz, brot] of [[-2.3, 5.4, 2.95], [2.3, 5.4, -2.95]]) {
      ctx.placeKit(buildPlazaBench(THREE, darkWoodMat, vermilionMat), bx, bz, brot, 0.04, true, Y_T2);
    }
    for (const [lx, lz, ly] of [
      [-3.2, 6.6, Y_T2], [3.2, 6.6, Y_T2],
      [-2.8, -8.8, Y_T2], [2.8, -8.8, Y_T2],
      [-9.6, -1.6, Y_T2], [9.6, -1.6, Y_T2],
      [-2.8, -14.2, Y_T3], [2.8, -14.2, Y_T3],
    ]) {
      ctx.placeKit(buildPedestalLantern(THREE, stoneMat, darkWoodMat, copperCapMat, lanternGlowMat), lx, lz, 0, 0.04, true, ly);
    }

    // ========================================================================
    // 6. ALL 5 HERO ENTERABLE BUILDINGS ACROSS ALL 3 VERTICAL TIERS!
    //    (Framed 1:1 with overview.png: angled inward-south toward the Hero Bridge & Courtyard!)
    // ========================================================================
    // 1. FLOOR 3 CROWN (y = 5.15m): Grand Vermilion Bathhouse Pavilion (dead-center facing south!)
    ctx.placeKit(B.onsen_pavilion({ garden: false, seed: 101 }), 0, -21.2, 0, 0.04, true, Y_T3);

    // 2. FLOOR 2 WEST WING (y = 2.85m): Spirit Ramen & Steamed-Bun Izakaya
    ctx.placeKit(B.ramen_izakaya({ garden: false, seed: 102 }), -19.8, -7.8, 0.52, 0.04, true, Y_T2);

    // 3. FLOOR 2 EAST WING (y = 2.85m): the Herbal Boiler & Waterwheel Mill
    const boilerBld = ctx.placeKit(B.boiler_tower({ garden: false, seed: 103 }), 19.6, -7.8, -0.46, 0.04, true, Y_T2);
    const waterwheel = boilerBld ? boilerBld.getObjectByName('waterwheel') : null;

    // 4. FLOOR 1 SW ISLAND (y = 1.05m): Wisteria & Silk Kimono Teahouse (cascading wisteria & fox masks facing south-east!)
    ctx.placeKit(B.kimono_teahouse({ garden: false, seed: 104 }), -15.6, 12.8, 0.58, 0.04, true, Y_T1);

    // 5. FLOOR 1 SE ISLAND (y = 1.05m): Moonlit Taiko Shrine Gatehouse (crescent moon & Taiko drum facing south-west, clear of Lift Boardwalk!)
    ctx.placeKit(B.shrine_gatehouse({ garden: false, seed: 105 }), 17.6, 13.4, -0.56, 0.04, true, Y_T1);

    // Steaming Outdoor Mossy-Rock Rotenburo in the SE Foreground Cove (open stepping stones facing NW plaza!)
    const rotenX = 11.4, rotenZ = 21.6;
    ctx.placeKit(B.rotenburo({ garden: false, seed: 215 }), rotenX, rotenZ, 2.58, 0.04, true, Y_T1);

    // ========================================================================
    // 7. RECEDING VERMILION WATER TORII CHANNEL, TREES & TALL BAMBOO GROVES
    // ========================================================================
    ctx.placeKit(B.toriiGate({ span: 5.2, height: 6.2, garden: false, seed: 201 }), -15.8, -24.5, 0.28, 0.04, true, 0.0);
    ctx.placeKit(B.toriiGate({ span: 4.2, height: 5.0, garden: false, seed: 202 }), -19.2, -31.5, 0.24, 0.04, true, 0.0);
    ctx.placeKit(B.toriiGate({ span: 5.0, height: 5.9, garden: false, seed: 203 }), 16.2, -24.8, -0.28, 0.04, true, 0.0);
    ctx.placeKit(B.toriiGate({ span: 4.0, height: 4.8, garden: false, seed: 204 }), 19.6, -31.6, -0.24, 0.04, true, 0.0);

    // Sculptural weeping wisteria & sakura trees across all 3 tiers
    const treeSpecs = [
      [-12.2, -19.5, Y_T3, SAKURA_PAL, false],
      [12.2, -19.5, Y_T3, WISTERIA_PAL, true],
      [-23.8, -0.4, Y_T2, WISTERIA_PAL, true],
      [23.8, -0.4, Y_T2, [0x5ea24e, 0x72b65c, 0x4d8c42], false],
      [-22.6, 19.6, Y_T1, WISTERIA_PAL, true],
      [-24.3, 8.8, Y_T1, SAKURA_PAL, false],
      [22.8, 19.8, Y_T1, SAKURA_PAL, false],
    ];
    treeSpecs.forEach(([tx, tz, ty, cols, weep], idx) => {
      ctx.placeKit(buildSpiritTree(THREE, 300 + idx * 17, cols, weep), tx, tz, jr(0, TAU), 0.04, true, ty);
    });

    // Tall Jointed Emerald Bamboo Groves framing the Left & Right Edges (matching overview.png!)
    {
      const stalkGeo = new THREE.CylinderGeometry(0.085, 0.115, 8.8, 8);
      stalkGeo.translate(0, 4.4, 0);
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.68, metalness: 0 });
      const leafSprigGeo = new THREE.CircleGeometry(0.24, 5);
      leafSprigGeo.scale(0.36, 1.85, 1);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });

      const stalkMatrices = [], stalkColors = [];
      const leafMatrices = [], leafColors = [];
      const o = new THREE.Object3D(), col = new THREE.Color();

      const bambooZones = [
        // Left foreground & mid-cliff bamboo curtain (framing Ramen & Kimono Teahouse!)
        ...Array.from({ length: 48 }, () => [jr(-29.5, -24.2), jr(-12.5, 22.5)]),
        // Right foreground & mid-cliff bamboo curtain (framing Boiler & Shrine!)
        ...Array.from({ length: 48 }, () => [jr(24.2, 29.5), jr(-12.5, 22.5)]),
        // Upper-back cliff bamboo tufts behind Onsen Pavilion
        ...Array.from({ length: 28 }, () => [jr(-13.8, 13.8), jr(-28.4, -26.2)]),
      ];

      for (const [bx, bz] of bambooZones) {
        const by = Math.max(0.0, sampleBathhouseHeight(bx, bz));
        const scY = jr(0.85, 1.38);
        const tiltX = jr(-0.08, 0.08), tiltZ = bx < 0 ? jr(-0.12, -0.02) : jr(0.02, 0.12);
        o.position.set(bx, by - 0.1, bz);
        o.rotation.set(tiltX, jr(0, TAU), tiltZ);
        o.scale.set(jr(0.9, 1.28), scY, jr(0.9, 1.28));
        o.updateMatrix();
        stalkMatrices.push(o.matrix.clone());
        stalkColors.push(col.setHex(0x5da64e).offsetHSL(jr(-0.03, 0.03), 0, jr(-0.08, 0.08)).clone());

        for (let l = 0; l < 6; l++) {
          const ly = by + 8.8 * scY * jr(0.48, 0.98);
          o.position.set(bx + jr(-0.65, 0.65), ly, bz + jr(-0.65, 0.65));
          o.rotation.set(jr(-1.0, 1.0), jr(0, TAU), jr(-0.9, 0.9));
          o.scale.set(jr(1.0, 1.6), jr(1.0, 1.6), 1);
          o.updateMatrix();
          leafMatrices.push(o.matrix.clone());
          leafColors.push(new THREE.Color(pick(FOLIAGE_PAL)));
        }
      }

      const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, stalkMatrices.length);
      stalkMatrices.forEach((m, i) => { stalks.setMatrixAt(i, m); stalks.setColorAt(i, stalkColors[i]); });
      stalks.castShadow = true;
      stalks.receiveShadow = true;
      root.add(stalks);

      const leaves = new THREE.InstancedMesh(leafSprigGeo, leafMat, leafMatrices.length);
      leafMatrices.forEach((m, i) => { leaves.setMatrixAt(i, m); leaves.setColorAt(i, leafColors[i]); });
      root.add(leaves);
    }

    // Foreground Purple Hydrangea Clusters & Low Lagoon Lanterns (matching overview.png bottom edge!)
    {
      const flGeo = new THREE.IcosahedronGeometry(0.16, 0);
      const hydMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0 });
      const hMats = [], hCols = [];
      const o = new THREE.Object3D();
      const hydSpots = [
        [-19.5, Y_T1, 21.8], [-6.2, Y_T1, 18.2], [-4.2, Y_T1, 13.8],
        [4.4, Y_T1, 13.8], [6.4, Y_T1, 19.6], [19.8, Y_T1, 21.4],
        [-10.4, Y_T2, 3.8], [10.4, Y_T2, 3.8], [-5.8, Y_T3, -14.2], [5.8, Y_T3, -14.2],
      ];
      for (const [hx, hy, hz] of hydSpots) {
        for (let b = 0; b < 14; b++) {
          o.position.set(hx + jr(-0.65, 0.65), hy + jr(0.12, 0.52), hz + jr(-0.65, 0.65));
          o.rotation.set(jr(0, 3), jr(0, 3), 0);
          o.scale.setScalar(jr(0.85, 1.35));
          o.updateMatrix();
          hMats.push(o.matrix.clone());
          hCols.push(new THREE.Color(pick(HYDRANGEA_PAL)));
        }
      }
      const hydInst = new THREE.InstancedMesh(flGeo, hydMat, hMats.length);
      hMats.forEach((m, i) => { hydInst.setMatrixAt(i, m); hydInst.setColorAt(i, hCols[i]); });
      root.add(hydInst);
    }

    // ========================================================================
    // 8. UNIQUE MECHANIC SET-PIECES: 6 HERBAL STEAM GEYSERS + TUB & EAVE SPOTS!
    // ========================================================================
    WORLD_STATE.steamVents = [
      { x: -0.2, y: Y_T2, z: 2.2, r: 6.2 },        // Central Courtyard front vent
      { x: -9.8, y: Y_T2, z: -4.2, r: 5.6 },       // West Ramen bridgehead vent
      { x: 9.8, y: Y_T2, z: -4.2, r: 5.6 },        // East Boiler bridgehead vent
      { x: -4.4, y: Y_T3, z: -15.4, r: 5.8 },      // Tier 3 Onsen West forecourt vent
      { x: 4.4, y: Y_T3, z: -15.4, r: 5.8 },       // Tier 3 Onsen East forecourt vent
      { x: 5.8, y: Y_T1, z: 18.2, r: 5.6 },        // Tier 1 Rotenburo arrival vent
    ];
    for (const v of WORLD_STATE.steamVents) {
      const ventMesh = buildHerbalSteamVent(THREE, mossStoneMat, bronzeMat, waterGlowMat);
      ventMesh.position.set(v.x, v.y, v.z);
      root.add(ventMesh);
    }

    // Interactive Steaming Tub Spots ('tub') & Wall-Hung Eave Hooks ('hook') across all 3 tiers!
    WORLD_STATE.interactSpots = [
      // Steaming Tubs (submerge as Floating Bath Duck or Cedar Lid!)
      {
        kind: 'tub', icon: '🦆', label: 'Submerge in Onsen Tub',
        disguiseLabel: 'Onsen Bath Duck 🦆',
        x: -3.15, y: Y_T3, groundY: Y_T3, z: -17.65, offsetY: 0.86, exitX: -2.2, exitZ: -15.8, lid: false,
      },
      {
        kind: 'tub', icon: '🪵', label: 'Hide Under Cedar Lid',
        disguiseLabel: 'Cedar Bath Lid 🪵',
        x: 3.15, y: Y_T3, groundY: Y_T3, z: -17.65, offsetY: 0.90, exitX: 2.2, exitZ: -15.8, lid: true,
      },
      {
        kind: 'tub', icon: '🦆', label: 'Submerge in Rotenburo',
        disguiseLabel: 'Onsen Bath Duck 🦆',
        x: rotenX - 0.15, y: Y_T1, groundY: Y_T1, z: rotenZ - 0.15, offsetY: 0.34, exitX: rotenX - 1.35, exitZ: rotenZ - 1.75, lid: false,
      },
      {
        kind: 'tub', icon: '🦆', label: 'Submerge in Footbath Tub',
        disguiseLabel: 'Onsen Bath Duck 🦆',
        x: -5.4, y: Y_T2, groundY: Y_T2, z: 3.4, offsetY: 0.62, exitX: -4.2, exitZ: 3.4, lid: false,
      },
      // Wall-Hung Eave Hooks (hang 1.50m above ground as an eave lantern or daruma talisman!)
      {
        kind: 'hook', icon: '🏮', label: 'Hang on Bathhouse Eave',
        disguiseLabel: 'Wall-Hung Lantern 🏮', propId: 'bh_paper_lantern',
        x: -4.95, groundY: Y_T3, z: -16.85, hangY: 1.48, rot: 0, exitX: -4.95, exitZ: -15.6,
      },
      {
        kind: 'hook', icon: '🏮', label: 'Hang on Izakaya Eave',
        disguiseLabel: 'Wall-Hung Lantern 🏮', propId: 'bh_paper_lantern',
        x: -16.6, groundY: Y_T2, z: -4.4, hangY: 1.45, rot: 0.52, exitX: -15.8, exitZ: -3.6,
      },
      {
        kind: 'hook', icon: '🎎', label: 'Hang on Boiler Beam',
        disguiseLabel: 'Hanging Daruma 🎎', propId: 'bh_daruma_doll',
        x: 16.6, groundY: Y_T2, z: -4.4, hangY: 1.52, rot: -0.46, exitX: 15.8, exitZ: -3.6,
      },
      {
        kind: 'hook', icon: '🏮', label: 'Hang on Teahouse Eave',
        disguiseLabel: 'Wall-Hung Lantern 🏮', propId: 'bh_paper_lantern',
        x: -11.8, groundY: Y_T1, z: 16.4, hangY: 1.45, rot: 0.58, exitX: -11.0, exitZ: 17.3,
      },
      {
        kind: 'hook', icon: '🏮', label: 'Hang on Shrine Eave',
        disguiseLabel: 'Wall-Hung Lantern 🏮', propId: 'bh_paper_lantern',
        x: 14.2, groundY: Y_T1, z: 17.2, hangY: 1.45, rot: -0.56, exitX: 13.3, exitZ: 18.1,
      },
    ];

    // Add visible gleaming golden eave-hook brackets at every 'hook' spot!
    for (const sp of WORLD_STATE.interactSpots) {
      if (sp.kind !== 'hook') continue;
      const hm = buildEaveHookMarker(THREE, darkWoodMat, goldMat);
      hm.position.set(sp.x, sp.groundY + sp.hangY + 1.15, sp.z);
      hm.rotation.y = sp.rot || 0;
      root.add(hm);
    }

    // Warm Golden PointLights bathing all 3 vertical tiers in Storybook lantern glow!
    const warmLights = [
      [0, Y_T2 + 3.4, -1.2, 0xffaa48, 2.4, 16],       // Tier 2 Dragon Fountain & Bell Courtyard
      [0, Y_T3 + 3.8, -16.4, 0xffa844, 2.4, 16],      // Tier 3 Onsen Pavilion Karahafu entrance
      [-16.4, Y_T2 + 3.2, -5.6, 0xffb24c, 2.0, 14],   // Tier 2 Ramen Izakaya yellow chochin glow
      [16.4, Y_T2 + 3.2, -5.6, 0xff983c, 2.0, 14],    // Tier 2 Boiler herbal porch
      [-12.2, Y_T1 + 3.2, 13.2, 0xffa65c, 2.0, 14],   // Tier 1 Wisteria Kimono Teahouse
      [12.4, Y_T1 + 3.2, 12.6, 0xffaa48, 2.0, 14],    // Tier 1 Moonlit Taiko Shrine
      [0, Y_T1 + 2.8, 16.0, 0xffb252, 1.8, 13],       // Foreground Hero Vermilion Bridge
    ];
    for (const [lx, ly, lz, hex, intensity, dist] of warmLights) {
      const pl = new THREE.PointLight(hex, intensity, dist, 1.6);
      pl.position.set(lx, ly, lz);
      root.add(pl);
    }

    // Extra camouflage hiding spots across all 3 tiers
    for (const [sx, sz, hex, sy] of [
      [-4.2, -5.8, COL_PLAZA, Y_T2], [4.2, -5.8, COL_PLAZA, Y_T2],
      [-7.8, 3.2, COL_PLAZA, Y_T2], [7.8, 3.2, COL_PLAZA, Y_T2],
      [-8.2, -16.2, COL_TERRACE, Y_T3], [10.4, -16.2, COL_TERRACE, Y_T3],
      [-8.8, 15.8, COL_TERRACE, Y_T1], [8.8, 15.8, COL_TERRACE, Y_T1],
    ]) {
      addSpotSafe(sx, sz, hex, 'stone', sy);
    }

    // ========================================================================
    // 9. 16 RICH PROP VIGNETTES ACROSS ALL 3 VERTICAL TIERS!
    // ========================================================================
    if (ctx.addVig) {
      // Tier 2: Central Courtyard Stalls & Fountain Overlooks (tucked beside stalls so mid-plaza avenues stay wide open!)
      ctx.addVig(-7.4, 2.2, [
        ['bh_steamer_stack', -0.55, 0.55, 0.2],
        ['bh_steamer_stack', 0.58, 0.60, -0.3],
        ['bh_sake_cask', -0.75, -0.45, 0.4],
        ['bh_tea_table', 0.15, 1.55, 0.1],
        ['bh_paper_lantern', -1.15, 1.35, 0.0],
      ], 1, Y_T2);

      ctx.addVig(7.4, 2.2, [
        ['bh_daruma_doll', -0.58, 0.60, -0.3],
        ['bh_daruma_doll', 0.55, 0.55, 0.4],
        ['bh_steamer_stack', 0.75, -0.45, -0.2],
        ['bh_towel_basket', -0.10, 1.55, 0.5],
        ['bh_paper_lantern', 1.15, 1.35, 0.0],
      ], 1, Y_T2);

      ctx.addVig(-5.4, 3.4, [
        ['bh_hinoki_tub', 0.0, 0.0, 0.25],
        ['bh_towel_basket', 0.95, -0.25, -0.4],
        ['bh_bonsai_pot', -0.85, 0.95, 0.2],
        ['bh_paper_lantern', 0.95, 0.95, 0.0],
      ], 1, Y_T2);

      ctx.addVig(5.4, 3.4, [
        ['bh_stone_fox', -0.65, -0.25, -0.5],
        ['bh_taiko_drum', 0.72, -0.20, -0.3],
        ['bh_bonsai_pot', 0.58, 0.95, 0.4],
        ['bh_paper_lantern', -0.72, 0.95, 0.0],
      ], 1, Y_T2);

      // Tier 3: Grand Vermilion Bathhouse Side Gardens (clear of front mezzanine & s2w/lift lanes!)
      ctx.addVig(-8.2, -19.6, [
        ['bh_hinoki_tub', 0.4, 0.0, 0.2],
        ['bh_hinoki_tub', -0.95, -0.25, -0.3],
        ['bh_towel_basket', -0.68, 1.05, 0.5],
        ['bh_towel_basket', 0.65, 1.05, -0.2],
        ['bh_paper_lantern', 1.65, 0.35, 0.0],
      ], 1, Y_T3);

      ctx.addVig(8.2, -19.6, [
        ['bh_hinoki_tub', -0.4, 0.0, -0.2],
        ['bh_hinoki_tub', 0.95, -0.25, 0.4],
        ['bh_towel_basket', -0.62, 1.05, 0.2],
        ['bh_bonsai_pot', 0.72, 1.05, -0.5],
        ['bh_paper_lantern', -1.65, 0.35, 0.0],
      ], 1, Y_T3);

      // Tier 3: Pulley Lift East Terrace Corner (clear of Lift Balcony promenade!)
      ctx.addVig(12.2, -17.2, [
        ['bh_sake_cask', -0.55, 0.0, 0.1],
        ['bh_towel_basket', 0.65, 0.05, 0.5],
        ['bh_coal_scuttle', 0.10, 1.05, -0.3],
      ], 1, Y_T3);

      // Tier 2 West: Ramen Izakaya Canal-Side Dining Deck
      ctx.addVig(-16.0, -0.4, [
        ['bh_tea_table', -0.75, -0.35, 0.1],
        ['bh_tea_table', 0.75, -0.30, -0.3],
        ['bh_steamer_stack', -0.70, 0.95, 0.4],
        ['bh_steamer_stack', 0.68, 0.95, -0.2],
        ['bh_sake_cask', 1.45, 0.20, 0.5],
      ], 1, Y_T2);

      ctx.addVig(-23.2, -1.6, [
        ['bh_sake_cask', -0.60, -0.25, 0.2],
        ['bh_sake_cask', 0.65, -0.20, -0.4],
        ['bh_daruma_doll', -0.45, 0.95, 0.3],
        ['bh_paper_lantern', 0.75, 0.95, 0.0],
      ], 1, Y_T2);

      // Tier 2 East: Boiler Coal & Herbal Yard
      ctx.addVig(16.0, -0.4, [
        ['bh_coal_scuttle', -0.75, -0.35, 0.3],
        ['bh_coal_scuttle', 0.55, -0.40, -0.5],
        ['bh_coal_scuttle', -0.15, 0.85, 0.8],
        ['bh_sake_cask', 1.45, 0.25, 0.2],
        ['bh_daruma_doll', -1.25, 0.75, -0.3],
      ], 1, Y_T2);

      ctx.addVig(23.2, -1.6, [
        ['bh_coal_scuttle', -0.60, -0.35, 0.2],
        ['bh_towel_basket', 0.65, -0.30, -0.4],
        ['bh_bonsai_pot', 0.55, 0.85, -0.6],
        ['bh_paper_lantern', -0.68, 0.85, 0.0],
      ], 1, Y_T2);

      // Tier 1 SW: Wisteria & Silk Kimono Teahouse Garden (clear of teahouse east wrap corridor!)
      ctx.addVig(-6.8, 11.8, [
        ['bh_folding_screen', -0.85, -0.45, 0.6],
        ['bh_tea_table', 0.68, -0.35, 0.2],
        ['bh_tea_table', 0.55, 1.05, -0.3],
        ['bh_bonsai_pot', -0.78, 0.95, 0.4],
        ['bh_paper_lantern', 1.75, 0.35, 0.0],
      ], 1, Y_T1);

      ctx.addVig(-11.4, 20.2, [
        ['bh_towel_basket', -0.65, 0.0, 0.2],
        ['bh_bonsai_pot', 0.65, 0.05, -0.4],
        ['bh_tea_table', 0.0, 1.15, 0.1],
      ], 1, Y_T1);

      // Tier 1 SE: Moonlit Taiko Shrine Fox Steps & Rotenburo Cove
      ctx.addVig(7.6, 13.6, [
        ['bh_stone_fox', -0.78, -0.35, 2.4],
        ['bh_stone_fox', 0.78, -0.35, -2.4],
        ['bh_taiko_drum', 0.0, 0.95, 2.6],
        ['bh_sake_cask', 1.65, 0.45, 0.3],
        ['bh_paper_lantern', -1.45, 0.85, 0.0],
      ], 1, Y_T1);

      ctx.addVig(6.2, 20.6, [
        ['bh_hinoki_tub', -0.72, -0.45, 0.4],
        ['bh_hinoki_tub', 0.72, -0.40, -0.3],
        ['bh_towel_basket', -0.68, 0.85, 0.2],
        ['bh_towel_basket', 0.68, 0.85, -0.5],
        ['bh_bonsai_pot', -1.80, 0.20, 0.6],
        ['bh_paper_lantern', 1.80, 0.25, 0.0],
      ], 2, Y_T1);
    }

    // Playable open prop slots for Suds-Sprite & Origami Spirit Crane so AI & HUD chips can disguise too!
    if (ctx.addSlot) {
      ctx.addSlot('bh_suds_sprite', 15.8, -4.6, 0.4, Y_T2);
      ctx.addSlot('bh_suds_sprite', -4.4, -3.2, -0.5, Y_T2);
      ctx.addSlot('bh_spirit_crane', 2.8, -6.2, 0.2, Y_T2);
    }

    // ========================================================================
    // 9B. WORKING LIFTS REGISTRY (East Bath-Lift & 3-Stop Timber Dumbwaiter)
    // ========================================================================
    WORLD_STATE.liftCar = liftCar;
    WORLD_STATE.liftSpots.push(
      { id: 'bh_pulley_lift', kind: 'lift', icon: '🛗', x: LIFT_X, y: Y_T1, z: LIFT_Z, label: 'Ride Bath-Lift' },
      { id: 'bh_dumbwaiter_lift', kind: 'lift', icon: '🧺', x: DUMB_X, y: Y_T2, z: DUMB_Z, label: 'Ride Timber Dumbwaiter' }
    );

    // ========================================================================
    // 9C. COPPER STEAM-PIPE CHUTES (3 Elevated Cross-Tier Pipe Lines!)
    // ========================================================================
    const pipeMc = createMatCache(THREE);
    const pipeCopper = pipeMc(0xb8643a, { roughness: 0.42, metalness: 0.35 });
    const pipeBrass = pipeMc(0xdfb052, { roughness: 0.36, metalness: 0.42 });
    const pipeGlow = pipeMc(0x7ee8f2, { emissive: 0x3ed5ec, emissiveIntensity: 0.65, roughness: 0.25 });
    const pipeWheelRotors = [];

    const addSteamChutePair = (idPrefix, ax, ay, az, bx, by, bz, labelAB, labelBA, arcY) => {
      const makeNozzle = (x, y, z, targetX, targetZ) => {
        const ng = new THREE.Group();
        ng.position.set(x, y, z);
        ng.rotation.y = Math.atan2(targetX - x, targetZ - z);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.78, 0.28, 12), pipeCopper);
        collar.position.y = 0.14;
        collar.castShadow = true;
        collar.receiveShadow = true;
        ng.add(collar);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.075, 8, 16), pipeBrass);
        rim.rotation.x = PI / 2;
        rim.position.y = 0.29;
        ng.add(rim);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.06, 12), pipeGlow);
        core.position.y = 0.26;
        ng.add(core);
        // Side brass gauge wheel (kept dynamic so rotor spins cleanly!)
        const valve = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 6, 12), pipeBrass);
        valve.userData.keep = true;
        valve.position.set(0.68, 0.42, 0);
        valve.rotation.y = PI / 2;
        ng.add(valve);
        pipeWheelRotors.push(valve);
        root.add(ng);
        if (ctx.solids) ctx.solids.push(collar);
      };

      makeNozzle(ax, ay, az, bx, bz);
      makeNozzle(bx, by, bz, ax, az);

      // Arched overhead copper conduit curve between stations
      const midX = (ax + bx) * 0.5;
      const midZ = (az + bz) * 0.5;
      const midY = (ay + by) * 0.5 + arcY + 1.25;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(ax, ay + 0.35, az),
        new THREE.Vector3(midX, midY, midZ),
        new THREE.Vector3(bx, by + 0.35, bz)
      );
      const conduitGeo = new THREE.TubeGeometry(curve, 18, 0.22, 8, false);
      const conduitMesh = new THREE.Mesh(conduitGeo, pipeCopper);
      conduitMesh.castShadow = true;
      root.add(conduitMesh);

      const dirABx = bx - ax, dirABz = bz - az;
      const lenAB = Math.max(0.01, Math.hypot(dirABx, dirABz));
      const off = 1.65; // Exit 1.65m inward clear of opposite nozzle trigger radius!
      WORLD_STATE.steamChutes.push({
        id: `${idPrefix}_ab`,
        kind: 'ride_path',
        icon: '💨',
        label: labelAB,
        fromX: ax,
        fromY: ay,
        fromZ: az,
        toX: bx - (dirABx / lenAB) * off,
        toY: by,
        toZ: bz - (dirABz / lenAB) * off,
        dur: 1.45,
        arcY,
        enterHint: `💨 Woosh! Blasted through the Steam-Pipe Chute!`,
      });
      WORLD_STATE.steamChutes.push({
        id: `${idPrefix}_ba`,
        kind: 'ride_path',
        icon: '💨',
        label: labelBA,
        fromX: bx,
        fromY: by,
        fromZ: bz,
        toX: ax + (dirABx / lenAB) * off,
        toY: ay,
        toZ: az + (dirABz / lenAB) * off,
        dur: 1.45,
        arcY,
        enterHint: `💨 Woosh! Blasted through the Steam-Pipe Chute!`,
      });
    };

    // 3 Bidrectional Steam-Pipe Chutes spanning Floor 1 <-> Floor 2 <-> Floor 3!
    addSteamChutePair('pipe_boiler_crown', 14.5, Y_T2, -0.1, 7.8, Y_T3, -15.4, 'Steam Chute → Floor 3 Crown', 'Steam Chute → Boiler Wing', 2.4);
    addSteamChutePair('pipe_ramen_quay', -14.5, Y_T2, 0.1, -12.8, Y_T1, 9.6, 'Steam Chute → Teahouse Quay', 'Steam Chute → Ramen Wing', 2.1);
    addSteamChutePair('pipe_shrine_boiler', 13.8, Y_T1, 9.6, 15.8, Y_T2, -2.0, 'Steam Chute → Boiler Deck', 'Steam Chute → Shrine Cove', 2.1);

    // ========================================================================
    // 9D. LIVING CREATURES: SCURRYING SUDS-SPRITES & 3 ORIGAMI SPIRIT CRANES
    // ========================================================================
    WORLD_STATE.creatures = createCreatureFleetController(THREE, ctx, [
      // 5 Scurrying Suds-Sprites across Boiler Yard, Courtyard & Teahouse
      {
        id: 'bh_suds_sprite',
        builder: (T) => buildSudsSpriteVariant(T, 0xff84c0),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.62,
        speed: 2.35,
        pauseSec: 0.5,
        callType: 'critter',
        soundInterval: 6.5,
        waypoints: [
          { x: 15.2, y: Y_T2, z: -2.6 },
          { x: 16.8, y: Y_T2, z: -5.2 },
          { x: 15.6, y: Y_T2, z: -9.8 },
          { x: 14.4, y: Y_T2, z: -4.2 },
        ],
      },
      {
        id: 'bh_suds_sprite',
        builder: (T) => buildSudsSpriteVariant(T, 0xffe46b),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.62,
        speed: 2.6,
        pauseSec: 0.4,
        callType: 'critter',
        soundInterval: 7.2,
        waypoints: [
          { x: 22.8, y: Y_T2, z: -3.2 },
          { x: 24.4, y: Y_T2, z: -8.0 },
          { x: 21.8, y: Y_T2, z: -12.0 },
          { x: 19.0, y: Y_T2, z: -3.5 },
        ],
      },
      {
        id: 'bh_suds_sprite',
        builder: (T) => buildSudsSpriteVariant(T, 0x8ef5cb),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.62,
        speed: 2.45,
        pauseSec: 0.65,
        callType: 'critter',
        soundInterval: 8.1,
        waypoints: [
          { x: -4.2, y: Y_T2, z: -5.8 },
          { x: 3.4, y: Y_T2, z: -6.4 },
          { x: 4.4, y: Y_T2, z: 1.2 },
          { x: -3.8, y: Y_T2, z: 1.6 },
        ],
      },
      {
        id: 'bh_suds_sprite',
        builder: (T) => buildSudsSpriteVariant(T, 0xa8d4ff),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.62,
        speed: 2.2,
        pauseSec: 0.55,
        callType: 'critter',
        soundInterval: 7.8,
        waypoints: [
          { x: -16.2, y: Y_T2, z: -2.2 },
          { x: -14.8, y: Y_T2, z: -5.8 },
          { x: -16.0, y: Y_T2, z: -9.5 },
          { x: -15.4, y: Y_T2, z: -3.8 },
        ],
      },
      {
        id: 'bh_suds_sprite',
        builder: (T) => buildSudsSpriteVariant(T, 0xffaa68),
        kind: 'ground',
        canFly: false,
        radius: 0.36,
        height: 0.62,
        speed: 2.3,
        pauseSec: 0.5,
        callType: 'critter',
        soundInterval: 8.8,
        waypoints: [
          { x: -10.4, y: Y_T1, z: 10.6 },
          { x: -9.2, y: Y_T1, z: 16.4 },
          { x: -14.2, y: Y_T1, z: 18.6 },
          { x: -11.8, y: Y_T1, z: 12.8 },
        ],
      },

      // 3 Flying Origami / Spirit Cranes soaring between Tier 3 Crown, Bridges & Torii!
      {
        id: 'bh_spirit_crane',
        builder: (T) => buildOrigamiCraneVariant(T, 'vermilion'),
        kind: 'flyer',
        canFly: true,
        radius: 0.44,
        height: 0.96,
        scale: 1.12,
        orbitCx: 0.0,
        orbitCz: -4.0,
        orbitRx: 14.5,
        orbitRz: 12.5,
        orbitY: 9.6,
        bobY: 1.6,
        orbitSpeed: 0.36,
        figure8: true,
        callType: 'crane',
        soundInterval: 8.5,
        perches: [
          { x: -6.2, y: Y_T3 + 0.05, z: -16.8 },
          { x: 4.8, y: Y_T2 + 0.05, z: -1.8 },
          { x: 9.2, y: Y_T1 + 0.05, z: 11.4 },
        ],
      },
      {
        id: 'bh_spirit_crane',
        builder: (T) => buildOrigamiCraneVariant(T, 'gold'),
        kind: 'flyer',
        canFly: true,
        radius: 0.44,
        height: 0.96,
        scale: 1.08,
        orbitCx: 2.0,
        orbitCz: -6.5,
        orbitRx: 16.5,
        orbitRz: 13.0,
        orbitY: 11.2,
        bobY: 1.8,
        orbitSpeed: 0.31,
        figure8: false,
        callType: 'crane',
        soundInterval: 9.4,
        perches: [
          { x: 10.6, y: Y_T3 + 0.05, z: -17.6 },
          { x: -4.8, y: Y_T2 + 0.05, z: -2.6 },
          { x: -9.2, y: Y_T1 + 0.05, z: 11.4 },
        ],
      },
      {
        id: 'bh_spirit_crane',
        builder: (T) => buildOrigamiCraneVariant(T, 'azure'),
        kind: 'flyer',
        canFly: true,
        radius: 0.44,
        height: 0.96,
        scale: 1.05,
        orbitCx: -1.5,
        orbitCz: 2.0,
        orbitRx: 15.5,
        orbitRz: 14.0,
        orbitY: 8.8,
        bobY: 1.5,
        orbitSpeed: 0.40,
        figure8: true,
        callType: 'crane',
        soundInterval: 10.2,
        perches: [
          { x: 0.0, y: Y_T3 + 0.05, z: -14.8 },
          { x: 16.0, y: Y_T2 + 0.05, z: -2.2 },
          { x: -11.2, y: Y_T1 + 0.05, z: 15.6 },
        ],
      },
    ]);

    // ========================================================================
    // 10. STORYBOOK AMBIENT & INTERACTIVE ANIMATIONS
    //     (Ambient Steam + Periodic Herbal Steam Eruptions + Pulley Lift + 38 Floating Lanterns!)
    // ========================================================================
    if (boilerBld) boilerBld.updateMatrixWorld(true);
    const chimneyTop = boilerBld
      ? boilerBld.localToWorld(new THREE.Vector3(2.55, 8.45, -1.85))
      : new THREE.Vector3(22.2, Y_T2 + 8.4, -8.2);

    const steamEmitters = [
      { x: -1.6, y: Y_T2 + 0.55, z: -1.0, r: 1.05, hMax: 3.4, scale: 0.44 },             // Dragon Fountain basin
      { x: -4.2, y: Y_T3 + 0.85, z: -16.8, r: 1.15, hMax: 3.8, scale: 0.48 },            // Onsen West tub steam
      { x: 4.2, y: Y_T3 + 0.85, z: -16.8, r: 1.15, hMax: 3.8, scale: 0.48 },             // Onsen East tub steam
      { x: chimneyTop.x, y: chimneyTop.y, z: chimneyTop.z, r: 0.42, hMax: 6.2, scale: 0.62 }, // Brick Chimney!
      { x: rotenX, y: Y_T1 + 0.42, z: rotenZ, r: 1.35, hMax: 3.6, scale: 0.48 },         // SE Rotenburo steam
    ];

    const STEAM_N = 90;
    const GEYSER_N = 108;
    const steamGeo = new THREE.IcosahedronGeometry(1, 1);
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xf6fbff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const steamInst = new THREE.InstancedMesh(steamGeo, steamMat, STEAM_N);
    steamInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(steamInst);

    const geyserMat = new THREE.MeshBasicMaterial({
      color: 0xeefcf8,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });
    const geyserInst = new THREE.InstancedMesh(steamGeo, geyserMat, GEYSER_N);
    geyserInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(geyserInst);

    const steamState = Array.from({ length: STEAM_N }, (_, i) => {
      const em = steamEmitters[i % steamEmitters.length];
      return { em, phase: (i / STEAM_N) + rr() * 0.2, speed: jr(0.18, 0.30), ox: jr(-em.r, em.r), oz: jr(-em.r, em.r), sway: jr(0, TAU) };
    });
    const geyserState = Array.from({ length: GEYSER_N }, (_, i) => {
      const v = WORLD_STATE.steamVents[i % WORLD_STATE.steamVents.length];
      return { v, phase: rr(), speed: jr(0.42, 0.68), ox: jr(-0.9, 0.9), oz: jr(-0.9, 0.9), sway: jr(0, TAU) };
    });

    // 38 Glowing Floating Square Canal Lanterns (Toro Nagashi) + Rising Twilight Sky Lanterns!
    const floatG = new THREE.Group();
    floatG.name = 'floating_canal_lanterns';
    root.add(floatG);

    const fGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfff0b2,
      emissive: 0xffa830,
      emissiveIntensity: 2.25,
      roughness: 0.35,
      metalness: 0,
    });
    const waterLanterns = [];
    // Foreground South Canal & Lagoon floating square lanterns (prominently visible like overview.png!)
    const lanternPaths = [
      // Central foreground canal (between SW & SE arrival islands!)
      [-1.5, 22.8], [1.4, 24.5], [-0.8, 19.6], [1.2, 21.8], [-2.1, 26.2], [0.5, 27.6],
      [-1.8, 12.6], [1.9, 13.2], [-0.5, 13.4],
      // Left & Right side canals
      [-12.8, 3.8], [-15.2, 5.4], [-23.8, 5.2], [13.2, 3.6], [15.8, 5.2], [23.8, 5.0],
      // Northern Torii lagoon
      [-14.5, -20.5], [-17.2, -26.8], [-12.2, -28.2], [14.8, -20.8], [17.4, -27.2], [12.6, -28.4],
      [-26.2, -16.8], [26.4, -16.4], [-27.5, 11.2], [27.5, 11.6],
    ];
    for (const [lx, lz] of lanternPaths) {
      const lg = new THREE.Group();
      const base = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.06, 0.48, 1, 0.01), darkWoodMat);
      const shade = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.38, 0.32, 1, 0.02), fGlowMat);
      shade.position.y = 0.21;
      lg.add(base, shade);
      floatG.add(lg);
      waterLanterns.push({
        g: lg,
        bx: lx,
        bz: lz,
        inCanal: inBathCanal(lx, lz),
        bob: jr(0, TAU),
        driftR: inBathCanal(lx, lz) ? jr(0.14, 0.32) : jr(0.35, 0.95),
        spd: jr(0.35, 0.65),
      });
    }

    const skyLanterns = [];
    for (let i = 0; i < 16; i++) {
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.46, 8), fGlowMat);
      floatG.add(sl);
      const ang = (i / 16) * TAU + jr(-0.2, 0.2);
      const rad = jr(28, 46);
      skyLanterns.push({
        m: sl,
        bx: Math.sin(ang) * rad,
        bz: Math.cos(ang) * rad,
        y0: 5.5,
        ySpan: jr(18, 28),
        phase: rr(),
        spd: jr(0.022, 0.044),
        sway: jr(0, TAU),
      });
    }

    // ========================================================================
    // 10B. BESPOKE YU-MACHI BATHHOUSE MECHANICS:
    //      1. Upgraded 3-Stop Timber Dumbwaiter (Y_UND <-> Y_T2 <-> Y_T3)
    //      2. Suds-Sprite Squeeze Vents & Undercroft Vignettes
    //      3. Valorant "Lotus" Rotating Stone/Shoji Divider Doors (3 Doors + Dual OBBs)
    //      4. Boiler Reservoir Floodwheel & Canal Tide Warning Mist
    //      5. Autonomous Suds-Sprite Swarm (3 Foam Buckets)
    // ========================================================================
    // 1. Upgraded 3-Stop West Timber Dumbwaiter (Boiler Y_UND <-> Courtyard Y_T2 <-> Crown Y_T3)
    const dumbTower = B.pulleyLift({ height: (Y_T3 - Y_UND) + 0.65, garden: false });
    ctx.placeKit(dumbTower, DUMB_X, DUMB_Z, 0, 0.03, true, Y_UND);
    const dumbCar = dumbTower ? (dumbTower.userData.liftCar || dumbTower.getObjectByName('liftCar')) : null;
    const dumbWheel = dumbTower ? (dumbTower.userData.pulleyWheel || dumbTower.getObjectByName('pulleyWheel')) : null;
    WORLD_STATE.dumbCar = dumbCar;
    if (dumbCar) dumbCar.position.y = WORLD_STATE.dumbY - Y_UND;

    // 2. Undercroft Cozy Hiding Prop Vignettes + Tiny Vent Disguise Props
    if (ctx.addVig) {
      ctx.addVig(0.0, -3.9, [
        ['bh_coal_scuttle', -1.4, -0.8, 0.3],
        ['bh_sake_cask', 1.5, 0.6, -0.4],
        ['bh_suds_sprite', -0.7, 1.0, 0.5],
        ['bh_paper_lantern', 1.6, -1.2, 0.1],
      ], 2, Y_UND);
      ctx.addVig(9.2, -6.2, [
        ['bh_suds_sprite', -0.35, -0.35, 0.2],
        ['bh_daruma_doll', 0.45, 0.35, -0.3],
      ], 1, Y_T1);
      ctx.addVig(-14.6, -7.2, [
        ['bh_suds_sprite', -0.45, 0.35, 0.4],
        ['bh_paper_lantern', 0.35, -0.45, 0.0],
      ], 1, Y_T2);
    }

    // 2B. 2 Tiny-Prop Suds-Sprite Squeeze Vents (maxR: 0.36 allows suds/daruma/lantern to slip through!)
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x3b353c, roughness: 0.72, metalness: 0 });
    const ventEmberMat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff7020, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0 });
    for (const [vx, vy, vz, rotY, bw] of [[8.0, Y_T1, -6.3, 0, 2.4], [-13.8, Y_T2, -7.2, 0, 2.2]]) {
      const vg = new THREE.Group();
      vg.position.set(vx, vy, vz);
      vg.rotation.y = rotY;
      const lintel = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.92, bw, 1, 0.03), ventMat);
      lintel.position.y = 1.45;
      lintel.castShadow = true;
      vg.add(lintel);
      for (const sz of [-bw * 0.44, bw * 0.44]) {
        const jamb = new THREE.Mesh(new RoundedBoxGeometry(0.32, 1.9, 0.22, 1, 0.02), ventMat);
        jamb.position.set(0, 0.95, sz);
        vg.add(jamb);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.16), ventEmberMat);
        lamp.position.set(0, 0.78, sz);
        vg.add(lamp);
      }
      root.add(vg);
      if (ctx.solids) ctx.solids.push(lintel);
      if (ctx.addWorldObb) {
        const b = ctx.addWorldObb(vx, vz, 0.22, bw * 0.46, rotY, vy - 0.25, vy + 2.6, false);
        if (b) b.maxR = 0.36;
      }
    }

    // 3. Valorant "Lotus" Rotating Stone/Shoji Divider Doors (3 Chokepoint Doors + Dual Static OBBs!)
    const shojiPanelMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d4,
      emissive: 0xffb34e,
      emissiveIntensity: 0.62,
      roughness: 0.58,
      metalness: 0,
    });
    const gongRimMat = new THREE.MeshStandardMaterial({
      color: 0xf4c44e,
      emissive: 0xc27b14,
      emissiveIntensity: 0.45,
      roughness: 0.36,
      metalness: 0,
    });
    const gongBossMat = new THREE.MeshStandardMaterial({
      color: 0xd13d30,
      emissive: 0x621610,
      emissiveIntensity: 0.25,
      roughness: 0.48,
      metalness: 0,
    });

    const doorConfigs = [
      {
        id: 'bh_door_west',
        mechId: 'bh_door_west_mech',
        title: 'Courtyard West Lotus Door',
        x: -7.8,
        y: Y_T2,
        z: -5.5,
        hx: 1.72,
        hz: 0.24,
        wheelX: -6.28,
        wheelZ: -3.98,
      },
      {
        id: 'bh_door_east',
        mechId: 'bh_door_east_mech',
        title: 'Courtyard East Lotus Door',
        x: 6.5,
        y: Y_T2,
        z: -4.9,
        hx: 1.72,
        hz: 0.24,
        wheelX: 7.98,
        wheelZ: -3.42,
      },
      {
        id: 'bh_door_gallery',
        mechId: 'bh_door_gallery_mech',
        title: 'Upper Gallery Lotus Door',
        x: 7.5,
        y: Y_T3,
        z: -16.4,
        hx: 1.72,
        hz: 0.24,
        wheelX: 9.02,
        wheelZ: -14.88,
      },
    ];

    for (const dc of doorConfigs) {
      // Turntable Stone Dais embedded into floor
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(dc.hx + 0.16, dc.hx + 0.24, 0.05, 28), stoneMat);
      dais.position.set(dc.x, dc.y + 0.02, dc.z);
      dais.userData.keep = true;
      addGroundMesh(dais, COL_TERRACE);
      const inlay = new THREE.Mesh(new THREE.TorusGeometry(dc.hx + 0.10, 0.035, 6, 32), goldMat);
      inlay.rotation.x = PI * 0.5;
      inlay.position.set(dc.x, dc.y + 0.048, dc.z);
      inlay.userData.keep = true;
      root.add(inlay);

      // Rotating Curved/Panelled Cedar-and-Stone Divider Wall
      const pivotG = new THREE.Group();
      pivotG.position.set(dc.x, dc.y, dc.z);
      pivotG.userData.keep = true;
      root.add(pivotG);

      const wallLen = dc.hx * 2;
      const wallH = 2.42;
      const wallThick = dc.hz * 2;

      // Central octagonal stone pivot drum & finial cap
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.37, wallH + 0.24, 10), stoneMat);
      drum.position.y = (wallH + 0.24) * 0.5;
      drum.castShadow = true;
      drum.receiveShadow = true;
      drum.userData._bathDoorPanelId = dc.id;
      drum.userData.keep = true;
      pivotG.add(drum);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.34, 8), copperCapMat);
      spire.position.y = wallH + 0.40;
      spire.userData.keep = true;
      pivotG.add(spire);

      // Heavy chamfered stone plinth base + vermilion arch lintel beam
      const plinth = new THREE.Mesh(new RoundedBoxGeometry(wallLen, 0.56, wallThick + 0.06, 2, 0.05), mossStoneMat);
      plinth.position.y = 0.28;
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      plinth.userData._bathDoorPanelId = dc.id;
      plinth.userData.keep = true;
      pivotG.add(plinth);

      const topLintel = new THREE.Mesh(new RoundedBoxGeometry(wallLen + 0.08, 0.24, wallThick + 0.08, 2, 0.04), vermilionMat);
      topLintel.position.y = wallH - 0.08;
      topLintel.castShadow = true;
      topLintel.userData._bathDoorPanelId = dc.id;
      topLintel.userData.keep = true;
      pivotG.add(topLintel);

      const curveCrest = new THREE.Mesh(new RoundedBoxGeometry(wallLen * 0.62, 0.16, wallThick * 0.72, 2, 0.04), darkWoodMat);
      curveCrest.position.y = wallH + 0.09;
      curveCrest.userData.keep = true;
      pivotG.add(curveCrest);

      const doorSolids = [drum, plinth, topLintel];

      // Left & Right Cedar-Framed Glowing Shoji Lattice Bays + Outer Stone Pillars
      for (const sx of [-1, 1]) {
        const endPost = new THREE.Mesh(new RoundedBoxGeometry(0.24, wallH, wallThick + 0.02, 1, 0.03), darkWoodMat);
        endPost.position.set(sx * (dc.hx - 0.12), wallH * 0.5, 0);
        endPost.castShadow = true;
        endPost.userData._bathDoorPanelId = dc.id;
        endPost.userData.keep = true;
        pivotG.add(endPost);
        doorSolids.push(endPost);

        const bayW = dc.hx - 0.54;
        const bayX = sx * (0.32 + bayW * 0.5);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(bayW, 1.56, 0.14), shojiPanelMat);
        panel.position.set(bayX, 1.38, 0);
        panel.userData._bathDoorPanelId = dc.id;
        panel.userData.keep = true;
        pivotG.add(panel);
        doorSolids.push(panel);

        // Kumiko cedar lattice bars
        for (const barY of [0.95, 1.38, 1.82]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.04, 0.055, wallThick * 0.68), cedarMat);
          bar.position.set(bayX, barY, 0);
          bar.userData.keep = true;
          pivotG.add(bar);
        }
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.56, wallThick * 0.68), cedarMat);
        vBar.position.set(bayX, 1.38, 0);
        vBar.userData.keep = true;
        pivotG.add(vBar);
      }

      // Twin Prominent Shootable Brass Gongs on BOTH faces (+Z and -Z) of the central drum!
      for (const sz of [-1, 1]) {
        const gongDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18), gongRimMat);
        gongDisc.rotation.x = PI * 0.5;
        gongDisc.position.set(0, 1.32, sz * (dc.hz + 0.14));
        gongDisc.userData._bathDoorGongId = dc.id;
        gongDisc.userData.keep = true;
        pivotG.add(gongDisc);
        doorSolids.push(gongDisc);

        const boss = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), gongBossMat);
        boss.position.set(0, 1.32, sz * (dc.hz + 0.19));
        boss.userData._bathDoorGongId = dc.id;
        boss.userData.keep = true;
        pivotG.add(boss);
        doorSolids.push(boss);
      }

      if (ctx.solids) {
        for (const m of doorSolids) ctx.solids.push(m);
      }

      // Register TWO static OBBs (0-deg closed vs 90-deg open) and toggle .disabled cleanly!
      const closedObb = ctx.addWorldObb ? ctx.addWorldObb(dc.x, dc.z, dc.hx, dc.hz, 0, dc.y - 0.25, dc.y + 2.65, false) : null;
      const openObb = ctx.addWorldObb ? ctx.addWorldObb(dc.x, dc.z, dc.hx, dc.hz, PI * 0.5, dc.y - 0.25, dc.y + 2.65, false) : null;
      if (closedObb) closedObb.disabled = false;
      if (openObb) openObb.disabled = true;

      // Interactive Bronze Wall-Wheel Pedestal beside turntable ring (outside swing radius!)
      const wheelG = new THREE.Group();
      wheelG.position.set(dc.wheelX, dc.y, dc.wheelZ);
      wheelG.rotation.y = Math.atan2(dc.x - dc.wheelX, dc.z - dc.wheelZ) + PI;
      wheelG.userData.keep = true;
      const ped = new THREE.Mesh(new RoundedBoxGeometry(0.44, 1.05, 0.44, 1, 0.04), stoneMat);
      ped.position.y = 0.52;
      ped.castShadow = true;
      ped.userData._bathMechProp = true;
      ped.userData.keep = true;
      const wheelMesh = new THREE.Group();
      wheelMesh.position.set(0, 1.12, 0.18);
      wheelMesh.userData.keep = true;
      const wRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 8, 18), bronzeMat);
      wRim.userData._bathMechProp = true;
      wRim.userData.keep = true;
      wheelMesh.add(wRim);
      for (let s = 0; s < 3; s++) {
        const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.62, 6), goldMat);
        spk.rotation.z = (s / 3) * PI;
        spk.userData.keep = true;
        wheelMesh.add(spk);
      }
      const wHub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), goldMat);
      wHub.rotation.x = PI * 0.5;
      wHub.userData.keep = true;
      wheelMesh.add(wHub);
      wheelG.add(ped, wheelMesh);
      root.add(wheelG);
      if (ctx.solids) ctx.solids.push(ped, wRim);
      if (ctx.addWorldObb) ctx.addWorldObb(dc.wheelX, dc.wheelZ, 0.28, 0.28, 0, dc.y - 0.2, dc.y + 1.45, false);

      WORLD_STATE.rotatingDoors.push({
        ...dc,
        pivotG,
        wheelMesh,
        closedObb,
        openObb,
        isOpen: false,
        curAngle: 0,
        startAngle: 0,
        targetAngle: 0,
        animT: 1,
        cdUntil: 0,
      });

      WORLD_STATE.mechSpots.push({
        id: dc.mechId,
        mechType: 'rotating_door',
        doorId: dc.id,
        doorCx: dc.x,
        doorCz: dc.z,
        kind: 'mechanism',
        icon: '☸️',
        x: dc.wheelX,
        y: dc.y,
        z: dc.wheelZ,
        interactRadius: 2.65,
        baseLabel: `Turn ${dc.title}`,
        cdUntil: 0,
      });
    }

    // 4. Boiler Reservoir Floodwheel inside the Undercroft (`bh_floodwheel`) + Mist Helper!
    const emitCanalMistPuffs = () => {
      if (!WORLD_STATE.spawnPuff) return;
      const py = Math.max(0.25, WORLD_STATE.tideY + 0.18);
      for (const [mx, mz] of [[0, 12.2], [-1.8, 15.6], [1.8, 18.8], [0, 22.8]]) {
        WORLD_STATE.spawnPuff({ x: mx, y: py, z: mz }, 7, 1.35, 0.56, 1.25, 0.95);
      }
    };

    WORLD_STATE.triggerTideShift = () => {
      const toFlood = !isCanalFlooded();
      WORLD_STATE.tideTimer = toFlood ? TIDE_SWITCH_T : 0.0;
      WORLD_STATE.tideTargetY = toFlood ? TIDE_HIGH_Y : TIDE_DRY_Y;
      WORLD_STATE.tideWarnedPhase = -1;
      WORLD_STATE.prevFloodPhase = toFlood;
      playBathhouseAudio(WORLD_STATE.audio, 'gong');
      if (ctx.audio) playWorldMechAudio(ctx.audio, 'flood');
      emitCanalMistPuffs();
      if (WORLD_STATE.emitSoundCue) {
        WORLD_STATE.emitSoundCue({ x: -1.3, y: Y_UND + 0.6, z: -6.5 }, 16.5, 'chime', null);
      }
      return toFlood
        ? '🌊 Floodwheel cranked! Bath Canal surging to High Tide!'
        : '🪨 Floodwheel drained! Under-Bridge Stone Riverbed opened!';
    };

    {
      const fwX = -1.3, fwY = Y_UND, fwZ = -6.5;
      const fwG = new THREE.Group();
      fwG.position.set(fwX, fwY, fwZ);
      fwG.userData.keep = true;
      const fwStand = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.02, 10), bronzeMat);
      fwStand.position.y = 0.51;
      fwStand.userData._bathMechProp = true;
      const fwWheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.065, 8, 18), waterGlowMat);
      fwWheel.position.set(0, 1.08, 0.16);
      fwWheel.userData._bathMechProp = true;
      const fwRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 6, 18), goldMat);
      fwRim.position.set(0, 1.08, 0.19);
      fwG.add(fwStand, fwWheel, fwRim);
      root.add(fwG);
      if (ctx.solids) ctx.solids.push(fwStand, fwWheel);
      if (ctx.addWorldObb) ctx.addWorldObb(fwX, fwZ, 0.32, 0.32, 0, fwY - 0.2, fwY + 1.45, false);
      WORLD_STATE.mechSpots.push({
        id: 'bh_floodwheel',
        mechType: 'floodwheel',
        kind: 'mechanism',
        icon: '🌊',
        x: fwX,
        y: fwY,
        z: fwZ,
        interactRadius: 2.55,
        baseLabel: 'Crank Boiler Floodwheel',
        cdUntil: 0,
      });
    }

    // 5. Autonomous Scurrying Suds-Sprite Swarm (`3` Foam Buckets)
    //    Pearly soap-bubble sprites: shared low-tri SphereGeometry, ZERO PointLights!
    const sudsSharedGeos = {
      body: new THREE.SphereGeometry(0.21, 12, 9),
      eye: new THREE.SphereGeometry(0.022, 6, 5),
      foot: new THREE.SphereGeometry(0.05, 6, 5),
      candy: new THREE.SphereGeometry(0.07, 8, 6),
    };
    const sudsBodyMat = new THREE.MeshStandardMaterial({ color: 0xdccff8, emissive: 0x8f7ad0, emissiveIntensity: 0.22, roughness: 0.16, metalness: 0 });
    const sudsBackMat = new THREE.MeshStandardMaterial({ color: 0xc9f2e2, emissive: 0x58b89a, emissiveIntensity: 0.22, roughness: 0.16, metalness: 0 });
    const sudsEyeMat = new THREE.MeshBasicMaterial({ color: 0x4a3a66 });
    // Tinted float-bubble colours (pink / butter / mint)
    const sparkleMats = [
      new THREE.MeshBasicMaterial({ color: 0xffa9d0 }),
      new THREE.MeshBasicMaterial({ color: 0xffeb9a }),
      new THREE.MeshBasicMaterial({ color: 0x9df5df }),
    ];
    const sudsSwarmGroup = new THREE.Group();
    sudsSwarmGroup.name = 'sparkle_suds_swarm';
    sudsSwarmGroup.userData.keep = true;
    root.add(sudsSwarmGroup);

    // Low-tri decoy sprite: lavender bubble + mint back-bubble, dot eyes, droplet feet & a tinted float-bubble (`candy`)
    const buildLowTriCandySuds = (candyMat) => {
      const sg = new THREE.Group();
      sg.userData.keep = true;
      const body = new THREE.Mesh(sudsSharedGeos.body, sudsBodyMat);
      body.position.y = 0.25;
      body.castShadow = true;
      sg.add(body);
      const back = new THREE.Mesh(sudsSharedGeos.body, sudsBackMat);
      back.scale.setScalar(0.56);
      back.position.set(-0.12, 0.41, -0.08);
      sg.add(back);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(sudsSharedGeos.eye, sudsEyeMat);
        eye.position.set(sx * 0.068, 0.262, 0.198);
        const foot = new THREE.Mesh(sudsSharedGeos.foot, sudsBodyMat);
        foot.scale.set(1, 0.62, 1.2);
        foot.position.set(sx * 0.085, 0.032, 0.045);
        sg.add(eye, foot);
      }
      const candy = new THREE.Mesh(sudsSharedGeos.candy, candyMat);
      candy.position.set(0, 0.57, 0.02);
      sg.add(candy);
      return { sg, body, candy };
    };

    const coalChuteSpecs = [
      {
        id: 'chute_boiler_undercroft',
        x: 2.8,
        y: Y_UND,
        z: -4.2,
        baseLabel: 'Release Boiler Suds-Sprites',
        triggerHint: '🫧 Boiler Foam Bucket rattled! 3 Suds-Sprites scurry up the stairs!',
        waypoints: [
          { x: 7.2, y: Y_UND, z: -3.9 },
          { x: 11.4, y: Y_T1, z: -3.9 },
          { x: 11.4, y: Y_T1, z: 7.8 },
          { x: 5.2, y: Y_T1, z: 11.2 },
          { x: 5.2, y: Y_T2, z: 6.4 },
          { x: 9.2, y: Y_T2, z: -3.8 },
          { x: 15.8, y: Y_T2, z: -3.8 },
        ],
      },
      {
        id: 'chute_courtyard_west',
        x: -6.0,
        y: Y_T2,
        z: -2.6,
        baseLabel: 'Release Courtyard Suds-Sprites',
        triggerHint: '🫧 Foam Bucket tipped! 3 Suds-Sprites hop across Hero Bridge!',
        waypoints: [
          { x: -4.4, y: Y_T2, z: 3.6 },
          { x: -5.2, y: Y_T2, z: 6.6 },
          { x: -5.2, y: Y_T1, z: 11.4 },
          { x: -4.8, y: Y_T1, z: 16.0 },
          { x: 4.8, y: Y_T1, z: 16.0 },
          { x: 8.6, y: Y_T1, z: 15.6 },
          { x: 5.2, y: Y_T1, z: 11.4 },
          { x: 5.2, y: Y_T2, z: 6.4 },
        ],
      },
      {
        id: 'chute_courtyard_north',
        x: 3.8,
        y: Y_T2,
        z: -6.8,
        baseLabel: 'Release Stairway Suds-Sprites',
        triggerHint: '🫧 Stairway Foam Bucket spilled! 3 Suds-Sprites sprint up to Bathhouse Crown!',
        waypoints: [
          { x: 0.0, y: Y_T2, z: -8.6 },
          { x: 0.0, y: Y_T3, z: -14.2 },
          { x: -4.6, y: Y_T3, z: -15.4 },
          { x: -9.0, y: Y_T3, z: -14.0 },
          { x: -9.0, y: Y_T2, z: -8.6 },
          { x: -11.4, y: Y_T2, z: -3.8 },
          { x: -16.2, y: Y_T2, z: -3.8 },
        ],
      },
    ];

    for (const cs of coalChuteSpecs) {
      const bg = new THREE.Group();
      bg.position.set(cs.x, cs.y, cs.z);
      bg.userData.keep = true;
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.48, 10), darkWoodMat);
      basket.position.y = 0.24;
      basket.castShadow = true;
      basket.userData._bathMechProp = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.045, 6, 12), cedarMat);
      rim.rotation.x = PI * 0.5;
      rim.position.y = 0.48;
      bg.add(basket, rim);
      // Heap of pearly foam bubbles + three tinted float-bubbles brimming over the bucket
      for (let k = 0; k < 4; k++) {
        const foam = new THREE.Mesh(sudsSharedGeos.body, k % 2 ? sudsBackMat : sudsBodyMat);
        foam.scale.setScalar(0.62 + (k % 3) * 0.08);
        foam.position.set(((k % 2) - 0.5) * 0.26, 0.50 + (k % 2) * 0.03, (Math.floor(k / 2) - 0.5) * 0.26);
        bg.add(foam);
      }
      for (let k = 0; k < 3; k++) {
        const bub = new THREE.Mesh(sudsSharedGeos.candy, sparkleMats[k]);
        bub.scale.setScalar(0.9 - k * 0.12);
        bub.position.set((k - 1) * 0.17, 0.68 + (k % 2) * 0.07, ((k % 2) - 0.5) * 0.14);
        bg.add(bub);
      }
      root.add(bg);
      if (ctx.solids) ctx.solids.push(basket);
      if (ctx.addWorldObb) ctx.addWorldObb(cs.x, cs.z, 0.36, 0.36, 0, cs.y - 0.2, cs.y + 0.9, false);

      WORLD_STATE.mechSpots.push({
        id: cs.id,
        mechType: 'coal_chute',
        chuteCfg: cs,
        kind: 'mechanism',
        icon: '✨',
        x: cs.x,
        y: cs.y,
        z: cs.z,
        interactRadius: 2.35,
        baseLabel: cs.baseLabel,
        triggerHint: cs.triggerHint,
        cdUntil: 0,
      });
    }

    WORLD_STATE.spawnDecoySwarm = (chuteCfg) => {
      if (!chuteCfg) return;
      // Cap active temporary sprites cleanly at 6 by recycling oldest
      while (WORLD_STATE.decoySudsSprites.length > 3) {
        const old = WORLD_STATE.decoySudsSprites.shift();
        if (old?.group?.parent) old.group.parent.remove(old.group);
      }
      playBathhouseAudio(WORLD_STATE.audio, 'suds_squeak');
      if (WORLD_STATE.spawnPuff) {
        WORLD_STATE.spawnPuff({ x: chuteCfg.x, y: chuteCfg.y + 0.55, z: chuteCfg.z }, 8, 1.4, 0.35, 0.55, 0.7);
      }
      const laneOffsets = [-0.48, 0.0, 0.48];
      for (let i = 0; i < 3; i++) {
        const { sg, body, candy } = buildLowTriCandySuds(sparkleMats[i % sparkleMats.length]);
        const sx = chuteCfg.x + laneOffsets[i] * 0.7;
        const sz = chuteCfg.z + (i - 1) * 0.28;
        const sy = sampleBathhouseHeight(sx, sz, chuteCfg.y + 0.4);
        sg.position.set(sx, sy, sz);
        sudsSwarmGroup.add(sg);
        WORLD_STATE.decoySudsSprites.push({
          group: sg,
          body,
          candy,
          x: sx,
          y: sy,
          z: sz,
          waypoints: chuteCfg.waypoints,
          wpIdx: 0,
          laneOff: laneOffsets[i],
          speed: 5.2 + i * 0.48,
          life: 6.5,
          hopPhase: i * 2.1,
          nextCueAt: 0.08 + i * 0.14,
        });
      }
    };

    let elapsed = 4.0; // Start right before first gentle steam wisp cycle
    let prevErupting = false;
    const _m4 = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3();

    return {
      dispose() {
        if (WORLD_STATE.creatures) {
          WORLD_STATE.creatures.dispose();
          WORLD_STATE.creatures = null;
        }
        for (const sp of WORLD_STATE.decoySudsSprites) {
          if (sp.group && sp.group.parent) sp.group.parent.remove(sp.group);
        }
        WORLD_STATE.decoySudsSprites.length = 0;
        for (const g of Object.values(sudsSharedGeos)) g.dispose();
        WORLD_STATE.rotatingDoors = [];
        WORLD_STATE.canalWater = null;
      },
      update(dt, _absTime, G) {
        const dtSafe = clamp(dt || 0.016, 0, 0.08);
        elapsed += dtSafe;

        if (WORLD_STATE.creatures && dt > 0) WORLD_STATE.creatures.update(dtSafe, elapsed);

        for (let i = 0; i < pipeWheelRotors.length; i++) {
          pipeWheelRotors[i].rotation.x += dtSafe * (1.8 + (i % 2) * 0.5);
        }

        // 1. Animated Turquoise-Sapphire Hot-Spring Lagoon & Bath Canal Water
        water.update(elapsed);
        if (WORLD_STATE.canalWater) {
          WORLD_STATE.canalWater.update(elapsed);
        }

        // 2. Spinning Wooden Waterwheel on the Boiler Mill
        if (waterwheel) {
          waterwheel.rotation.x += dtSafe * 0.92;
        }

        // 3. Valorant "Lotus" Rotating Stone/Shoji Divider Doors (~1.0s smooth pivot!)
        for (let i = 0; i < WORLD_STATE.rotatingDoors.length; i++) {
          const door = WORLD_STATE.rotatingDoors[i];
          if (door.animT < 1) {
            door.animT = Math.min(1, door.animT + dtSafe * 1.0);
            const ease = door.animT * door.animT * (3 - 2 * door.animT);
            door.curAngle = lerp(door.startAngle, door.targetAngle, ease);
            if (door.pivotG) door.pivotG.rotation.y = door.curAngle;
            if (door.wheelMesh) door.wheelMesh.rotation.z += dtSafe * (door.isOpen ? 7.5 : -7.5);
          }
        }

        // 4. Super Mario Sunshine "Flood-or-Drain" Bath Canal Tide Cycle (~24s cycle + 2.5s warning gong!)
        WORLD_STATE.tideTimer += dtSafe;
        if (WORLD_STATE.tideTimer >= TIDE_CYCLE) {
          WORLD_STATE.tideTimer -= TIDE_CYCLE;
          WORLD_STATE.tideWarnedPhase = -1;
        }
        const inPlay = !!(G && G.phase !== 'menu' && !G.over);
        const floodActive = WORLD_STATE.tideTimer >= TIDE_SWITCH_T;
        WORLD_STATE.tideTargetY = floodActive ? TIDE_HIGH_Y : TIDE_DRY_Y;

        if (!floodActive && WORLD_STATE.tideTimer >= TIDE_SWITCH_T - TIDE_WARN_LEAD && WORLD_STATE.tideWarnedPhase !== 0) {
          WORLD_STATE.tideWarnedPhase = 0;
          if (inPlay) {
            playBathhouseAudio(WORLD_STATE.audio, 'gong');
            emitCanalMistPuffs();
            if (WORLD_STATE.notify) WORLD_STATE.notify('🔔 Sluice Gong! Bath Canal flooding to High Tide in 2.5s!', 2300);
          }
        } else if (floodActive && WORLD_STATE.tideTimer >= TIDE_CYCLE - TIDE_WARN_LEAD && WORLD_STATE.tideWarnedPhase !== 1) {
          WORLD_STATE.tideWarnedPhase = 1;
          if (inPlay) {
            playBathhouseAudio(WORLD_STATE.audio, 'gong');
            emitCanalMistPuffs();
            if (WORLD_STATE.notify) WORLD_STATE.notify('🔔 Sluice Gong! Bath Canal draining to Dry Riverbed in 2.5s!', 2300);
          }
        }

        if (floodActive !== WORLD_STATE.prevFloodPhase) {
          WORLD_STATE.prevFloodPhase = floodActive;
          if (inPlay) {
            if (ctx.audio) playWorldMechAudio(ctx.audio, 'flood');
            emitCanalMistPuffs();
            if (WORLD_STATE.notify) {
              WORLD_STATE.notify(
                floodActive
                  ? '🌊 High Tide! Canal flooded — swim or ride the downstream current!'
                  : '🪨 Dry Bed! Under-Bridge Stone Riverbed walkways opened!',
                2400
              );
            }
          }
        }

        const tideDiff = WORLD_STATE.tideTargetY - WORLD_STATE.tideY;
        const tideStep = 0.85 * dtSafe;
        if (Math.abs(tideDiff) <= tideStep) WORLD_STATE.tideY = WORLD_STATE.tideTargetY;
        else WORLD_STATE.tideY += Math.sign(tideDiff) * tideStep;
        if (WORLD_STATE.canalWater) {
          WORLD_STATE.canalWater.mesh.position.y = WORLD_STATE.tideY;
        }

        // 5. Autonomous Decoy Suds-Sprite Swarm (~6.5s fast hopping up stairs & across bridges!)
        for (let i = WORLD_STATE.decoySudsSprites.length - 1; i >= 0; i--) {
          const sp = WORLD_STATE.decoySudsSprites[i];
          sp.life -= dtSafe;
          if (sp.life <= 0) {
            if (WORLD_STATE.spawnPuff) {
              WORLD_STATE.spawnPuff({ x: sp.x, y: sp.y + 0.25, z: sp.z }, 5, 0.9, 0.26, 0.42, 0.4);
            }
            if (sp.group.parent) sp.group.parent.remove(sp.group);
            WORLD_STATE.decoySudsSprites.splice(i, 1);
            continue;
          }
          const wp = sp.waypoints[sp.wpIdx % sp.waypoints.length];
          const tx = wp.x + sp.laneOff;
          const tz = wp.z;
          const dx = tx - sp.x, dz = tz - sp.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.45) {
            sp.wpIdx = (sp.wpIdx + 1) % sp.waypoints.length;
          } else {
            const step = Math.min(dist, sp.speed * dtSafe);
            sp.x += (dx / dist) * step;
            sp.z += (dz / dist) * step;
            sp.group.rotation.y = Math.atan2(dx, dz);
          }
          const targetFloorY = sampleBathhouseHeight(sp.x, sp.z, Math.max(sp.y, wp.y) + 0.75);
          sp.y = lerp(sp.y, targetFloorY, clamp(dtSafe * 14, 0, 1));
          sp.hopPhase += dtSafe * 16.0;
          const hop = Math.abs(Math.sin(sp.hopPhase)) * 0.25;
          sp.group.position.set(sp.x, sp.y + hop, sp.z);
          const fadeScale = sp.life < 0.45 ? clamp(sp.life / 0.45, 0.02, 1) : 1;
          sp.group.scale.setScalar(fadeScale);
          sp.candy.rotation.y += dtSafe * 4.2;
          sp.body.scale.set(1 - hop * 0.35, 1 + hop * 0.65, 1 - hop * 0.35);

          sp.nextCueAt -= dtSafe;
          if (sp.nextCueAt <= 0) {
            sp.nextCueAt = 0.42;
            if (inPlay && WORLD_STATE.emitSoundCue) {
              WORLD_STATE.emitSoundCue({ x: sp.x, y: sp.y + 0.3, z: sp.z }, 13.5, 'step', null);
            }
            if (inPlay && Math.random() < 0.35) {
              const actors = ctx.getActors?.() || [];
              const ear = actors[0]?.position;
              if (!ear || ear.distanceTo(sp.group.position) < 16) {
                playBathhouseAudio(WORLD_STATE.audio, 'suds_squeak');
              }
            }
          }
        }

        // 6. Working Floor 1 <-> Floor 3 East Bath-Lift & 3-Stop West Timber Dumbwaiter (Y_UND <-> Y_T2 <-> Y_T3)!
        if (!WORLD_STATE.liftMoving) {
          WORLD_STATE.liftHoldT -= dtSafe;
          if (WORLD_STATE.liftHoldT <= 0) {
            WORLD_STATE.liftTargetY = WORLD_STATE.liftY < (Y_T1 + Y_T3) * 0.5 ? Y_T3 : Y_T1;
            WORLD_STATE.liftMoving = true;
          }
        } else {
          const diff = WORLD_STATE.liftTargetY - WORLD_STATE.liftY;
          const step = 2.35 * dtSafe;
          if (Math.abs(diff) <= step) {
            WORLD_STATE.liftY = WORLD_STATE.liftTargetY;
            WORLD_STATE.liftMoving = false;
            WORLD_STATE.liftHoldT = 5.0;
          } else {
            WORLD_STATE.liftY += Math.sign(diff) * step;
          }
          if (pulleyWheel) {
            pulleyWheel.rotation.x += Math.sign(diff) * dtSafe * 2.2;
          }
        }
        if (liftCar) {
          liftCar.position.y = WORLD_STATE.liftY - Y_T1;
        }

        if (!WORLD_STATE.dumbMoving) {
          WORLD_STATE.dumbHoldT -= dtSafe;
          if (WORLD_STATE.dumbHoldT <= 0) {
            const curIdx = nearestDumbStopIdx(WORLD_STATE.dumbY);
            if (curIdx <= 0) WORLD_STATE.dumbDir = 1;
            else if (curIdx >= DUMB_STOPS.length - 1) WORLD_STATE.dumbDir = -1;
            const nextIdx = clamp(curIdx + WORLD_STATE.dumbDir, 0, DUMB_STOPS.length - 1);
            WORLD_STATE.dumbStopIdx = nextIdx;
            WORLD_STATE.dumbTargetY = DUMB_STOPS[nextIdx];
            WORLD_STATE.dumbMoving = true;
          }
        } else {
          const dDiff = WORLD_STATE.dumbTargetY - WORLD_STATE.dumbY;
          const dStep = 2.25 * dtSafe;
          if (Math.abs(dDiff) <= dStep) {
            WORLD_STATE.dumbY = WORLD_STATE.dumbTargetY;
            WORLD_STATE.dumbMoving = false;
            WORLD_STATE.dumbHoldT = 5.2;
            WORLD_STATE.dumbStopIdx = nearestDumbStopIdx(WORLD_STATE.dumbY);
            if (WORLD_STATE.dumbStopIdx === 0) WORLD_STATE.dumbDir = 1;
            else if (WORLD_STATE.dumbStopIdx === DUMB_STOPS.length - 1) WORLD_STATE.dumbDir = -1;
          } else {
            WORLD_STATE.dumbY += Math.sign(dDiff) * dStep;
          }
          if (dumbWheel) {
            dumbWheel.rotation.x += Math.sign(dDiff) * dtSafe * 2.2;
          }
        }
        if (dumbCar) {
          dumbCar.position.y = WORLD_STATE.dumbY - Y_UND;
        }

        // 7. Periodic Herbal Steam Eruptions (8s active every 18s cycle!)
        const cyc = elapsed % 18.0;
        const erupting = cyc >= 10.0;
        if (erupting && !prevErupting && WORLD_STATE.notify) {
          WORLD_STATE.notify('♨️ Herbal steam vents erupted! Seeker vision & footsteps muffled for 8s!', 2600);
        }
        prevErupting = erupting;
        const targetSteam = erupting ? Math.min(1, (cyc - 10.0) * 1.2, (18.0 - cyc) * 1.2) : 0;
        WORLD_STATE.steamStrength += (targetSteam - WORLD_STATE.steamStrength) * Math.min(1, dtSafe * 4.5);

        // Ambient Steam Puffs
        for (let i = 0; i < STEAM_N; i++) {
          const st = steamState[i];
          st.phase = (st.phase + dtSafe * st.speed) % 1;
          const u = st.phase;
          const fade = Math.sin(u * PI);
          const rScale = st.em.scale * (0.45 + u * 1.45) * Math.max(0.02, fade);
          _p.set(
            st.em.x + st.ox + Math.sin(elapsed * 0.9 + st.sway) * 0.28 * u,
            st.em.y + u * st.em.hMax,
            st.em.z + st.oz + Math.cos(elapsed * 0.75 + st.sway) * 0.24 * u
          );
          _s.set(rScale * 1.15, rScale * 0.85, rScale * 1.15);
          _m4.compose(_p, _q, _s);
          steamInst.setMatrixAt(i, _m4);
        }
        steamInst.instanceMatrix.needsUpdate = true;

        // Herbal Steam Geyser Plumes (billow high when erupting, gentle wisps when dormant!)
        const eStr = WORLD_STATE.steamStrength;
        for (let i = 0; i < GEYSER_N; i++) {
          const gs = geyserState[i];
          gs.phase = (gs.phase + dtSafe * gs.speed * (0.35 + eStr * 0.95)) % 1;
          const u = gs.phase;
          const fade = Math.sin(u * PI);
          const baseScale = (0.14 + eStr * 0.92) * (0.45 + u * 1.65) * fade;
          const hMax = 0.9 + eStr * 3.8;
          _p.set(
            gs.v.x + gs.ox * (0.3 + u * (0.6 + eStr * 1.8)) + Math.sin(elapsed * 1.5 + gs.sway) * 0.35 * u,
            gs.v.y + 0.22 + u * hMax,
            gs.v.z + gs.oz * (0.3 + u * (0.6 + eStr * 1.8)) + Math.cos(elapsed * 1.3 + gs.sway) * 0.35 * u
          );
          _s.set(Math.max(0.005, baseScale * 1.25), Math.max(0.005, baseScale * 0.9), Math.max(0.005, baseScale * 1.25));
          _m4.compose(_p, _q, _s);
          geyserInst.setMatrixAt(i, _m4);
        }
        geyserInst.instanceMatrix.needsUpdate = true;

        // 8. Bobbing & Drifting Golden Canal Lanterns (riding tidal water inside Canal!) + Rising Sky Lanterns
        for (let i = 0; i < waterLanterns.length; i++) {
          const wl = waterLanterns[i];
          const t = elapsed * wl.spd + wl.bob;
          const baseY = wl.inCanal ? Math.max(0.17, WORLD_STATE.tideY - 0.01) : -0.02;
          wl.g.position.set(
            wl.bx + Math.sin(t * 0.55) * wl.driftR,
            baseY + Math.sin(elapsed * 2.1 + wl.bob) * 0.030,
            wl.bz + Math.cos(t * 0.45) * wl.driftR
          );
          wl.g.rotation.y = Math.sin(t * 0.4) * 0.35;
          wl.g.rotation.z = Math.sin(elapsed * 1.7 + wl.bob) * 0.05;
        }
        for (let i = 0; i < skyLanterns.length; i++) {
          const sl = skyLanterns[i];
          sl.phase = (sl.phase + dtSafe * sl.spd) % 1;
          const u = sl.phase;
          const sc = Math.min(1, u * 5) * Math.min(1, (1 - u) * 5);
          sl.m.position.set(
            sl.bx + Math.sin(elapsed * 0.55 + sl.sway) * 1.4,
            sl.y0 + u * sl.ySpan,
            sl.bz + Math.cos(elapsed * 0.45 + sl.sway) * 1.2
          );
          sl.m.scale.setScalar(Math.max(0.01, sc));
          sl.m.rotation.z = Math.sin(elapsed * 1.2 + sl.sway) * 0.09;
        }
      },
    };
  },
};
