/* Hue & Seek — 5v5 Independent Multi-Archetype AI Brains & Bot-Filled Match Roster (ai_brains.js)
 *
 * Powers 5 Seekers vs 5 Hiders matches (1 local player + up to 9 independent AI bots, structured
 * cleanly around private per-actor brains so real multiplayer players can drop into any slot).
 *
 * Key AI Capabilities:
 *  • Zero wallhack cheating: Seekers perceive ALL living hiders (human + AI) and Decoy Clones
 *    through the exact same 3D FOV + BVH line-of-sight + private spatial memory + 3D hearing pipeline.
 *  • 5 Distinct Independent Seeker Archetypes (shuffled every match, zero hive-mind):
 *      - 'backyard_hound': Hunts behind houses, rear eaves, narrow side alleys, sheds & perimeters.
 *      - 'detective': Deep-sweeps multi-room interiors, back corners & furniture perches; keen memory.
 *      - 'tracker': Acoustic specialist (1.28x earshot, fastest reaction to whistles/giggles/poofs).
 *      - 'parkour_scout': Vaults onto upper terraces, bridges, perches & map special spots.
 *      - 'roamer': Fast wide-arc outer/mid-ring sweeper orbiting CW/CCW with crisp 2-squirt checks.
 *  • Full 3D Map Exploration Graph: Automatically discovers behind-house backyards, side alleys,
 *    occluded structure alcoves, individual interior rooms + deep room corners, outer perimeters,
 *    perches, and interactive spots across every map.
 *  • Keen Whistle & Sound Investigation: Monotonic sound ring buffer, independent staggered human
 *    reactions, 2-seeker pincer flanking around opposite sides of buildings, high-alert sound sweeps,
 *    and full Decoy Clone inspection (triggering soap-bubble blind when tricked!).
 *  • Zero Standing Around: Bulletproof walkable goal snapping, 360° steering whiskers, 0.36s anti-stuck
 *    recovery, and real-movement progress watchdogs on every state.
 */

import { HUE_RULES, paintSuspicionBoost } from './hue_layer.js?v=4';

export const TEAM_SIZE = 5;

const PLAYER_HANDLES = [
  // Authentic lowercase & cozy handles
  'kuro_tea', 'velvetmoss', 'sootlatte', 'cloudyjun', 'mika_jp', 'sleepytanuki',
  'toastyy', 'zephyr7', 'lunabloom', 'oatmilk_', 'chailatte', 'fernweh',
  'matchacat', 'peach_tea', 'ramenboy', 'puddlejump', 'breezy_kai', 'honeydew',
  'cloverleaf', 'softcloud', 'mintyfresh', 'starlight_', 'cinnamonroll', 'sundaymorning',
  'rainydayz', 'warmcocoa', 'maple_syrup', 'cherryblossom', 'paperplane', 'autumnwind',
  // Classic everyday gamer tags with numbers / underscores / regions
  'Kai_98', 'NoahPlays', 'Vex_21', 'Mochi_x', 'TaroKun', 'Sora_04',
  'RenjiTV', 'PixelKoi', 'NoriRoll', 'DuskFox88', 'Haru_GG', 'MapleLeaf7',
  'BobaBandit', 'Cinder_9', 'KitsuneGG', 'YuzuSoda', 'Finn_UK', 'Leo_FR',
  'Hana_KR', 'Pebblez', 'ShadowMoth', 'CrispyGyoza', 'Nimbus_11', 'SunnySide',
  'AcornKnight', 'KazeRunner', 'MossyFrog', 'Stardust_7', 'WaffleIron', 'Lucas_03',
  'Emma Rose', 'Mia_Plays', 'LiamGG', 'Ethan_99', 'Chloe_x', 'ZoeStar',
  'MaxPower7', 'Sammy_B', 'Alex_NL', 'TobyWan', 'Niko_DE', 'Mateo_ES',
  'Yuki_Snow', 'Kenji_87', 'RikuWave', 'AoiSky', 'Daiki_JP', 'MeiLin_8',
  // Playful prop-hunt / indie Steam-style tags
  'SneakyBarrel', 'NotALamp', 'ChairEnjoyer', 'JustABucket', 'TeacupMain', 'SoggySocks',
  'WaterHosePro', 'BushWookie', 'attic_ghost', 'TinyStool', 'CozyBadger', 'FoxInSocks',
  'TurnipBoy', 'BreadLoaf', 'SoupSpoon', 'LanternBug', 'RiverOtter', 'Pinecone_',
  'SleepyOwl', 'BumbleBee7', 'WalnutShell', 'Copper Kettle', ' GingerSnap', 'MisoSoup_',
  'TofuCube', 'Onigiri_22', 'TakoyakiX', 'TempuraShrimp', 'PockyStick', 'MelonPan',
  // Competitive / clean modern handles
  'Kova_', 'Zeph', 'Nyx_07', 'ValkyrieX', 'Orion_42', 'Solstice',
  'DriftKing', 'Echo_9', 'lynx_gg', 'FrostByte', 'Hyperion7', 'Strider_',
  'NovaSpark', 'AeroDynamic', 'Pulse_14', 'VortexGG', 'Cipher_x', 'Mirage99',
  'Kestrel', 'Sparrow_8', 'Falconer', 'RowanTree', 'CedarWood', 'BirchBark',
  ' Thistle_', 'BrambleFox', 'HazelNut', 'JuniperBerry', 'WillowWisp', 'MeadowLark',
  'SkyTinker', 'DustWalker', 'Ember99', 'AcornFan', 'RiverKoi', 'Midnight_Cat',
  'BroomCourier', 'CrimsonAce', 'ThimbleRun', 'Grove7', 'Wolfsong_', 'ValleyWind',
].map((s) => s.trim().replace(/\s+/g, '_'));

const HIDER_STYLES = ['backyard', 'indoor', 'parkour', 'special', 'vignette'];
const SEEKER_ARCHETYPES = ['backyard_hound', 'detective', 'tracker', 'parkour_scout', 'roamer'];

const ARCHETYPE_CONFIG = {
  backyard_hound: {
    patrolSpeed: 4.75,
    searchSpeed: 4.15,
    earshotMul: 1.06,
    reactionRange: [0.19, 0.36],
    sweepChance: 0.72,
    sweepDur: 5.0,
    sweepRadius: 6.2,
    candCount: 3,
    shotsPerCand: 3,
    eagerJump: false,
    nodeBias: {
      backyard: -3.25,
      perimeter: -2.05,
      indoor: -0.45,
      special: -0.55,
      perch: -0.25,
      vignette: 0.65,
    },
  },
  detective: {
    patrolSpeed: 4.45,
    searchSpeed: 3.95,
    earshotMul: 1.05,
    reactionRange: [0.21, 0.40],
    sweepChance: 0.88,
    sweepDur: 5.8,
    sweepRadius: 6.4,
    candCount: 4,
    shotsPerCand: 3,
    eagerJump: false,
    nodeBias: {
      indoor: -3.45,
      perch: -1.85,
      backyard: -0.95,
      special: -0.85,
      perimeter: -0.30,
      vignette: 0.45,
    },
  },
  tracker: {
    patrolSpeed: 4.65,
    searchSpeed: 4.10,
    earshotMul: 1.28,
    reactionRange: [0.15, 0.28],
    sweepChance: 0.70,
    sweepDur: 5.4,
    sweepRadius: 6.4,
    candCount: 4,
    shotsPerCand: 3,
    eagerJump: false,
    nodeBias: {
      backyard: -1.85,
      perimeter: -1.65,
      indoor: -1.40,
      special: -1.05,
      perch: -0.80,
      vignette: 0.10,
    },
  },
  parkour_scout: {
    patrolSpeed: 4.72,
    searchSpeed: 4.15,
    earshotMul: 1.04,
    reactionRange: [0.18, 0.35],
    sweepChance: 0.74,
    sweepDur: 4.8,
    sweepRadius: 6.2,
    candCount: 3,
    shotsPerCand: 3,
    eagerJump: true,
    nodeBias: {
      perch: -3.15,
      special: -3.05,
      backyard: -1.10,
      perimeter: -1.05,
      indoor: -0.75,
      vignette: 0.35,
    },
  },
  roamer: {
    patrolSpeed: 4.95,
    searchSpeed: 4.35,
    earshotMul: 1.08,
    reactionRange: [0.17, 0.34],
    sweepChance: 0.56,
    sweepDur: 3.9,
    sweepRadius: 5.8,
    candCount: 2,
    shotsPerCand: 2,
    eagerJump: true,
    nodeBias: {
      perimeter: -2.85,
      backyard: -2.15,
      special: -1.00,
      perch: -0.60,
      indoor: -0.50,
      vignette: -0.15,
    },
  },
};

// Small/medium props that look natural when perched on tables, benches, counters, or stacked crates
const PERCHABLE_PROPS = new Set([
  'bucket', 'flower_pot', 'watering_can', 'pumpkin', 'milk_can', 'veg_basket', 'flour_sack',
  'lamp_table', 'book_stack', 'potted_fern', 'cushion_pile', 'bread_basket', 'lantern_stool',
  'bh_wooden_bucket', 'bh_steamer_stack', 'bh_daruma_doll', 'bh_sake_bottle_tray', 'bh_paper_lantern', 'bh_tea_table',
  'sr_crystal_lantern', 'sr_levitation_urn', 'sr_cloud_planter',
  'sp_lemon_planter', 'sp_rope_coil', 'sp_olive_amphora',
  'cw_hatbox_stack', 'cw_pastry_tier', 'cw_steam_samovar', 'cw_brass_orrery',
  'bw_thimble_stool', 'bw_button_stack', 'bw_inkwell_pot',
]);

// 18-angle full-circle 360° whisker fan so bots never lock straight into a dead-end wall
const WHISKER_OFFSETS_360 = [
  0,
  0.26, -0.26,
  0.54, -0.54,
  0.86, -0.86,
  1.20, -1.20,
  1.58, -1.58,
  1.98, -1.98,
  2.42, -2.42,
  2.85, -2.85,
  Math.PI,
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function shuffleCopy(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function pickWeightedTopK(sortedItems, k, scoreFn) {
  if (!sortedItems.length) return null;
  const n = Math.min(k, sortedItems.length);
  if (n === 1) return sortedItems[0];
  const topScore = scoreFn(sortedItems[0]);
  const rankDecay = [1.0, 0.78, 0.60, 0.45, 0.34];
  let totalW = 0;
  const weights = new Array(n);
  for (let i = 0; i < n; i++) {
    const delta = scoreFn(sortedItems[i]) - topScore; // <= 0 for descending score
    const w = Math.exp(clamp(delta, -8, 0) * 0.55) * (rankDecay[i] ?? 0.3);
    weights[i] = w;
    totalW += w;
  }
  if (!(totalW > 0)) return sortedItems[0];
  let r = Math.random() * totalW;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r <= 0) return sortedItems[i];
  }
  return sortedItems[n - 1];
}

function normAng(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function lerpAngle(a, b, t) {
  return a + normAng(b - a) * Math.min(1, t);
}

export function pickBotHandles(count = 9, exclude = []) {
  const ex = new Set((exclude || []).map((s) => String(s || '').toLowerCase()));
  const pool = PLAYER_HANDLES.filter((h) => !ex.has(h.toLowerCase()));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, count);
}

export function randomPlayerHandle() {
  return pickBotHandles(1)[0] || `Spirit_${10 + ((Math.random() * 89) | 0)}`;
}

export function makeNameplateSprite(THREE, name, team) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 26px Nunito, Fredoka, sans-serif';
  const tw = Math.min(220, Math.ceil(g.measureText(name).width) + 38);
  const x0 = (256 - tw) * 0.5, y0 = 12, h = 40, r = 20;

  g.fillStyle = team === 'seekers' ? 'rgba(235, 248, 255, 0.90)' : 'rgba(244, 252, 236, 0.90)';
  g.strokeStyle = team === 'seekers' ? '#4a90c8' : '#6ca356';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(x0, y0, tw, h, r);
  g.fill();
  g.stroke();

  g.fillStyle = team === 'seekers' ? '#3a86c8' : '#5b9c45';
  g.beginPath();
  g.arc(x0 + 16, y0 + h * 0.5, 6, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#2c3a29';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(name, x0 + 28, y0 + h * 0.5 + 1);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    opacity: 0.88,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.65, 0.42, 1);
  sp.position.set(0, 1.92, 0);
  sp.renderOrder = 5;
  sp.name = 'teammateTag';
  return sp;
}

export function createAIManager(env) {
  const { THREE } = env;
  const getNow = () => (env.now ? env.now() : performance.now());
  const _tmpV1 = new THREE.Vector3();
  const _tmpV2 = new THREE.Vector3();
  const _tmpV3 = new THREE.Vector3();
  const _tmpV4 = new THREE.Vector3();

  let soundCueSeq = 0;

  // Bot skill for this match: 0 = gentle (slow to notice, shaky aim, jumpy hiders) .. 1 = sharp.
  // Set by the game at every round start from the player's level and recent results.
  let DIFF = 0.5;
  const dLerp = (easy, hard) => easy + (hard - easy) * DIFF;
  function setDifficulty(d) { DIFF = clamp(Number.isFinite(Number(d)) ? Number(d) : 0.5, 0, 1); }
  function getDifficulty() { return DIFF; }

  /**
   * Round pacing: how many spirits "should" be soaked by now for this skill level (about 2.5 of 5 by the end for gentle
   * bots, about 4.5 for sharp ones). When the hiders are falling faster than that, bot seekers ease off (0.35) so a round
   * is decided in its final stretch, not wiped in the first minute — on every map, big or small.
   */
  function paceGovernor() {
    const G = env.G;
    const hunt = Math.max(1, Number(G.huntDuration) || 110);
    const elapsed = clamp(hunt - (Number(G.t) || 0), 0, hunt);
    const all = G.allHiders || [];
    let soaked = 0;
    for (const h of all) if (h && h.userData?.actor?.eliminated) soaked++;
    const expected = dLerp(2.5, 4.6) * (elapsed / hunt);
    return soaked > expected + 0.35 ? 0.25 : 1;
  }

  function nearestWellFor(ch) {
    const wells = env.getWells ? env.getWells() : [];
    let best = null, bd = Infinity;
    const gy = ch.userData.groundY || 0;
    for (const w of wells) {
      const d = Math.hypot(w.x - ch.position.x, w.z - ch.position.z) + Math.abs((w.y || 0) - gy) * 3;
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  // Match-level Intel & Cached Exploration Geometry (personal bot memories live on each bot!)
  const TEAM_INTEL = {
    sightings: new Map(),     // hiderChar -> { pos, vel, propId, t, spotter, chasers: Set }
    visitedZones: new Map(),  // retained for external compatibility only (seekers use personalVisited!)
    claimedZones: new Map(),  // seekerChar -> zoneId
    soundEvents: [],          // ring buffer (max 64): { id, pos, radius, kind, priority, ttlMs, t, sourceHider, responders }
    perchCacheMapId: null,
    perchCache: [],
    navGraphMapId: null,
    navGraphSig: '',
    navGraphNodes: [],
    backyardHideMapId: null,
    backyardHideSpots: [],
    seekerDeck: shuffleCopy(SEEKER_ARCHETYPES),
    hiderDeck: shuffleCopy(HIDER_STYLES),
    lastPlayerStepCueAt: -1e9,
  };

  function resetMatchIntel(clearWorldCaches = false) {
    TEAM_INTEL.sightings.clear();
    TEAM_INTEL.visitedZones.clear();
    TEAM_INTEL.claimedZones.clear();
    TEAM_INTEL.soundEvents.length = 0;
    if (clearWorldCaches) {
      TEAM_INTEL.perchCacheMapId = null;
      TEAM_INTEL.perchCache = [];
      TEAM_INTEL.navGraphMapId = null;
      TEAM_INTEL.navGraphSig = '';
      TEAM_INTEL.navGraphNodes = [];
      TEAM_INTEL.backyardHideMapId = null;
      TEAM_INTEL.backyardHideSpots = [];
    }
    TEAM_INTEL.seekerDeck = shuffleCopy(SEEKER_ARCHETYPES);
    TEAM_INTEL.hiderDeck = shuffleCopy(HIDER_STYLES);
    TEAM_INTEL.lastPlayerStepCueAt = -1e9;
  }

  function soundPriorityForKind(kind) {
    if (kind === 'taunt' || kind === 'whistle') return 4;
    if (kind === 'giggle' || kind === 'chime') return 3;
    if (kind === 'poof' || kind === 'decoy') return 2;
    if (kind === 'dash' || kind === 'sprint' || kind === 'jump' || kind === 'pulse') return 1;
    return 0;
  }

  function soundTtlForKind(kind) {
    if (kind === 'taunt' || kind === 'whistle') return 2600;
    if (kind === 'giggle' || kind === 'chime') return 2200;
    return 1200;
  }

  function emitSoundCue(pos, radius, kind = 'noise', sourceHider = null) {
    if (!pos) return;
    const now = getNow();
    const priority = soundPriorityForKind(kind);
    const ttlMs = soundTtlForKind(kind);
    TEAM_INTEL.soundEvents.push({
      id: ++soundCueSeq,
      pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x || 0, pos.y || 0, pos.z || 0),
      radius: radius || 8,
      kind,
      priority,
      ttlMs,
      t: now,
      sourceHider,
      responders: new Set(),
    });
    if (TEAM_INTEL.soundEvents.length > 64) TEAM_INTEL.soundEvents.shift();
  }

  // --------------------------------------------------------------------------
  // Terrain, Walkability Snapping, 360° Whiskers & Parkour Helpers
  // --------------------------------------------------------------------------
  function isWalkableSafe(x, z, refY, r = 0.36, allowGlide = false) {
    const MAPR = env.getMapRadius();
    if (Math.hypot(x, z) > MAPR - 1.0) return false;
    const activeMap = env.getActiveMap();
    const inRoom = env.ENTER.length ? env.whereIs(x, z, refY) : null;
    if (!inRoom) {
      if (activeMap && activeMap.isDeepWater && activeMap.isDeepWater(x, z)) return false;
      if (!allowGlide && activeMap && activeMap.isSkyGap && activeMap.isSkyGap(x, z)) return false;
    }
    const gy = env.groundHeightAt(x, z, refY);
    if (gy < -1.5 && !allowGlide) return false;
    if (typeof refY === 'number' && !allowGlide && gy - refY > 0.88) return false;
    return !env.blockedAt(x, z, r, typeof refY === 'number' ? refY : gy) && !blockedByTallWall(x, z, typeof refY === 'number' ? refY : gy, r * 0.92);
  }

  // Swept multi-sample segment check so bots NEVER think thin walls/fences (<0.5m thick) are open!
  function isSegmentWalkable(x0, z0, x1, z1, refY, r = 0.34, allowGlide = false, steps = 4) {
    let curY = refY;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const sx = x0 + (x1 - x0) * f;
      const sz = z0 + (z1 - z0) * f;
      if (!isWalkableSafe(sx, sz, curY, r, allowGlide)) return false;
      curY = env.groundHeightAt(sx, sz, curY);
    }
    return true;
  }

  function blockedByTallWall(x, z, footY, R = 0.34) {
    if (Math.hypot(x, z) > env.getMapRadius() - 0.6) return true;
    for (const b of env.blockers) {
      if (b.disabled) continue;
      if (typeof b.maxR === 'number' && R <= b.maxR) continue;
      if (b.standable && b.y1 != null && b.y1 - footY <= 1.32) continue;
      if (b.y0 != null && b.y1 != null && (footY + 1.22 < b.y0 || footY >= b.y1 - 0.08)) continue;
      if (!(x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R)) continue;
      if (!b.obb) return true;
      const dx = x - b.obb.cx, dz = z - b.obb.cz;
      const lx = dx * b.obb.c - dz * b.obb.s;
      const lz = dx * b.obb.s + dz * b.obb.c;
      if (Math.abs(lx) < b.obb.hx + R && Math.abs(lz) < b.obb.hz + R) return true;
    }
    return false;
  }

  // Evaluates whether a destination floor point (x, z) is genuinely standable & open
  function evaluateGoalPoint(x, z, refY, r = 0.38, constraints = null) {
    const MAPR = env.getMapRadius();
    if (Math.hypot(x, z) > MAPR - 1.15) return null;
    const activeMap = env.getActiveMap();
    const roomHit = env.ENTER.length ? env.whereIs(x, z, refY) : null;
    if (constraints) {
      if (constraints.mustBeOutdoor && roomHit) return null;
      if (constraints.mustBeBuilding && (!roomHit || roomHit.b !== constraints.mustBeBuilding)) return null;
      if (typeof constraints.mustBeRoomIdx === 'number' && (!roomHit || roomHit.room !== constraints.mustBeRoomIdx)) return null;
    }
    if (!roomHit) {
      if (activeMap && activeMap.isDeepWater && activeMap.isDeepWater(x, z)) return null;
      if (activeMap && activeMap.isSkyGap && activeMap.isSkyGap(x, z)) return null;
    }
    const gy = env.groundHeightAt(x, z, refY);
    if (gy < -1.5) return null;
    if (typeof refY === 'number' && Math.abs(gy - refY) > 2.45) return null;
    if (env.blockedAt(x, z, r, gy) || blockedByTallWall(x, z, gy, r)) return null;

    // Require at least 2 of 4 cardinal micro-steps to be unblocked so bots never snap into sealed 10cm pockets
    let openDirs = 0;
    const probeD = 0.52;
    const dirs = [[probeD, 0], [-probeD, 0], [0, probeD], [0, -probeD]];
    for (let i = 0; i < 4; i++) {
      const nx = x + dirs[i][0], nz = z + dirs[i][1];
      if (Math.hypot(nx, nz) > MAPR - 0.9) continue;
      if (!roomHit && activeMap?.isDeepWater?.(nx, nz)) continue;
      if (!roomHit && activeMap?.isSkyGap?.(nx, nz)) continue;
      const ngy = env.groundHeightAt(nx, nz, gy);
      if (Math.abs(ngy - gy) <= 0.72 && !env.blockedAt(nx, nz, 0.30, ngy)) {
        openDirs++;
        if (openDirs >= 2) break;
      }
    }
    if (openDirs < 2) return null;
    return gy;
  }

  // Guarantees a valid walkable THREE.Vector3 ground goal (or null when constraints.strict === true and none exists)
  function markSnapped(v) {
    if (v) v._snapped = true;
    return v;
  }

  function snapToWalkableGoal(x, z, refY, maxR = 3.8, targetLookPos = null, constraints = null) {
    const MAPR = env.getMapRadius();
    let cx = x, cz = z;
    const rad = Math.hypot(cx, cz);
    if (rad > MAPR - 1.25 && rad > 0.001) {
      const s = (MAPR - 1.25) / rad;
      cx *= s;
      cz *= s;
    }

    const lookVec = targetLookPos
      ? (targetLookPos.isVector3 ? targetLookPos : new THREE.Vector3(targetLookPos.x, targetLookPos.y ?? (refY || 0) + 0.6, targetLookPos.z))
      : null;

    const directGy = evaluateGoalPoint(cx, cz, refY, 0.38, constraints);
    if (directGy != null) {
      if (!lookVec) return markSnapped(new THREE.Vector3(cx, directGy, cz));
      const eye = new THREE.Vector3(cx, directGy + 1.25, cz);
      if (env.lineOfSight(eye, lookVec)) {
        return markSnapped(new THREE.Vector3(cx, directGy, cz));
      }
    }

    const baseAng = lookVec ? Math.atan2(cx - lookVec.x, cz - lookVec.z) : rand(0, Math.PI * 2);
    let bestPt = directGy != null ? new THREE.Vector3(cx, directGy, cz) : null;
    let bestScore = directGy != null ? 0.5 : -1e9;

    const stepR = 0.65;
    for (let r = 0.65; r <= maxR + 0.01; r += stepR) {
      for (let k = 0; k < 12; k++) {
        const ang = baseAng + (k / 12) * Math.PI * 2;
        const tx = cx + Math.sin(ang) * r;
        const tz = cz + Math.cos(ang) * r;
        const tgy = evaluateGoalPoint(tx, tz, refY, 0.38, constraints);
        if (tgy == null) continue;

        let sc = 10.0 - r * 1.35;
        if (typeof refY === 'number') sc -= Math.abs(tgy - refY) * 1.1;
        if (lookVec) {
          const eye = new THREE.Vector3(tx, tgy + 1.25, tz);
          const hasLos = env.lineOfSight(eye, lookVec);
          if (hasLos) sc += 8.0;
          const dLook = Math.hypot(tx - lookVec.x, tz - lookVec.z);
          if (dLook < 1.3) sc -= (1.3 - dLook) * 2.5;
        }
        if (sc > bestScore) {
          bestScore = sc;
          bestPt = new THREE.Vector3(tx, tgy, tz);
          if (!lookVec || sc > 14.5) return markSnapped(bestPt);
        }
      }
      if (bestPt && (!lookVec || bestScore > 8.0)) return markSnapped(bestPt);
    }

    if (bestPt) return markSnapped(bestPt);
    if (constraints && constraints.strict) return null;

    // Wide emergency ring fallback for live runtime goals so no bot ever receives an unwalkable target
    for (let r = maxR + 0.9; r <= Math.max(maxR + 3.6, 6.8); r += 0.95) {
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        const tx = cx + Math.sin(ang) * r;
        const tz = cz + Math.cos(ang) * r;
        const tgy = evaluateGoalPoint(tx, tz, undefined, 0.38, null);
        if (tgy != null) return markSnapped(new THREE.Vector3(tx, tgy, tz));
      }
    }
    const fgy = env.groundHeightAt(0, 0);
    return markSnapped(new THREE.Vector3(0, fgy, 0));
  }

  function findLowJumpableBlockerAhead(ch, ux, uz) {
    const curY = ch.userData.groundY ?? 0;
    const footY = curY + (ch.userData.jy || 0);
    const R = Math.min(0.42, ch.userData.radius || 0.42);
    for (const dist of [0.58, 0.96]) {
      const px = ch.position.x + ux * dist;
      const pz = ch.position.z + uz * dist;
      for (const b of env.blockers) {
        if (!b.standable || b.y1 == null) continue;
        const hOverGround = b.y1 - curY;
        if (hOverGround < 0.20 || hOverGround > 1.34) continue;
        if (footY >= b.y1 - 0.06) continue;
        if (!(px > b.x0 - R && px < b.x1 + R && pz > b.z0 - R && pz < b.z1 + R)) continue;
        if (b.obb) {
          const dx = px - b.obb.cx, dz = pz - b.obb.cz;
          const lx = dx * b.obb.c - dz * b.obb.s;
          const lz = dx * b.obb.s + dz * b.obb.c;
          if (Math.abs(lx) >= b.obb.hx + R || Math.abs(lz) >= b.obb.hz + R) continue;
        }
        const farX = ch.position.x + ux * 1.68;
        const farZ = ch.position.z + uz * 1.68;
        const activeMap = env.getActiveMap();
        const waterBeyond = activeMap && activeMap.isDeepWater && activeMap.isDeepWater(farX, farZ);
        const skyBeyond = activeMap && activeMap.isSkyGap && activeMap.isSkyGap(farX, farZ);
        if (waterBeyond || skyBeyond) continue;
        const canClearBeyond = !blockedByTallWall(farX, farZ, curY + 0.15, 0.34);
        const canLandOnTop = !blockedByTallWall(px, pz, b.y1 + 0.06, 0.30);
        if (canClearBeyond || canLandOnTop) return b;
      }
    }
    return null;
  }

  // Real-movement progress watchdog helper shared across Seeker & Hider moving states
  function checkProgressStalled(ch, ai, dt, windowSec, minNetMove) {
    if (!ai.progressRefPos) {
      ai.progressRefPos = ch.position.clone();
      ai.progressTimer = 0;
      return false;
    }
    ai.progressTimer = (ai.progressTimer || 0) + dt;
    const netMoved = Math.hypot(ch.position.x - ai.progressRefPos.x, ch.position.z - ai.progressRefPos.z);
    if (netMoved >= minNetMove) {
      ai.progressRefPos.copy(ch.position);
      ai.progressTimer = 0;
      return false;
    }
    if (ai.progressTimer >= windowSec) {
      ai.progressRefPos.copy(ch.position);
      ai.progressTimer = 0;
      return true;
    }
    return false;
  }

  function resetBotProgress(ch, ai) {
    ai.stateTimer = 0;
    ai.progressTimer = 0;
    if (!ai.progressRefPos) ai.progressRefPos = ch.position.clone();
    else ai.progressRefPos.copy(ch.position);
    ai.goalDistRef = null;
    ai.goalDistTimer = 0;
  }

  // Smart real-player steering with full 360° whisker fan, parkour jumping,
  // Sky-Ruins updraft routing, doorway smoothness, and fast 0.36s anti-stuck recovery.
  function steerSmart(ch, rawGoal, speed, dt, opts = {}) {
    if (!rawGoal) return false;
    const u = ch.userData;
    const nav = u.nav || (u.nav = {
      side: Math.random() < 0.5 ? 1 : -1,
      stuckT: 0,
      stuckCount: 0,
      goalBlocked: false,
      anchorX: ch.position.x,
      anchorZ: ch.position.z,
      anchorT: 0,
      detour: null,
      detourT: 0,
      jumpCd: 0,
      vaultAng: null,
      vaultT: 0,
      prevAng: ch.rotation.y || 0,
      face: ch.rotation.y || 0,
    });
    nav.jumpCd = Math.max(0, nav.jumpCd - dt);
    nav.goalBlocked = false;

    const curY = u.groundY ?? env.groundHeightAt(ch.position.x, ch.position.z);
    const curFootY = curY + (u.jy || 0);

    // Check if an updraft geyser on Sky-Ruins can launch us up to a higher island!
    const activeMap = env.getActiveMap();
    let targetGoal = rawGoal;
    if (activeMap && activeMap.getUpdrafts && typeof rawGoal.y === 'number' && rawGoal.y > curY + 1.3 && !u.gliding && (u.jy || 0) < 0.2) {
      const updrafts = activeMap.getUpdrafts();
      let bestUp = null, bestD = 9.5;
      for (const up of updrafts) {
        if (Math.abs(up.y - curY) > 1.1) continue;
        const dMe = Math.hypot(up.x - ch.position.x, up.z - ch.position.z);
        const dGoalAfter = Math.hypot(rawGoal.x - up.x, rawGoal.z - up.z);
        const dGoalNow = Math.hypot(rawGoal.x - ch.position.x, rawGoal.z - ch.position.z);
        if (dMe < bestD && dGoalAfter < dGoalNow + 4.0) {
          bestD = dMe;
          bestUp = up;
        }
      }
      if (bestUp) targetGoal = { x: bestUp.x, y: bestUp.y, z: bestUp.z };
    }

    const fromPt = { x: ch.position.x, y: curY, z: ch.position.z };
    const goalY = (targetGoal && typeof targetGoal.y === 'number')
      ? targetGoal.y
      : env.groundHeightAt(targetGoal.x, targetGoal.z, curY);
    const goalPt = { x: targetGoal.x, y: goalY, z: targetGoal.z };

    if (nav.detourT > 0 && nav.detour) {
      nav.detourT -= dt;
      if (Math.hypot(nav.detour.x - ch.position.x, nav.detour.z - ch.position.z) < 0.65) {
        nav.detour = null;
        nav.detourT = 0;
      }
    }
    const wp = (nav.detourT > 0 && nav.detour) ? nav.detour : env.routeVia(fromPt, goalPt);

    const dx = wp.x - ch.position.x;
    const dz = wp.z - ch.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return false;

    const baseAng = Math.atan2(dx, dz);
    let chosenAng = baseAng;

    // If mid-vault over a chair/crate/table, keep committed forward arc!
    if (nav.vaultT > 0 && nav.vaultAng != null) {
      nav.vaultT -= dt;
      chosenAng = nav.vaultAng;
    } else {
      const ux = Math.sin(baseAng), uz = Math.cos(baseAng);
      const canJump = opts.allowJump !== false && nav.jumpCd <= 0 && (u.jy || 0) <= 0.06 && !u.specialMode;
      if (canJump) {
        const lowBlk = findLowJumpableBlockerAhead(ch, ux, uz);
        if (lowBlk && (opts.eagerJump || dist > 0.85)) {
          env.doCharJump(ch, 7.75);
          nav.jumpCd = 0.85;
          nav.vaultAng = baseAng;
          nav.vaultT = 0.38;
          chosenAng = baseAng;
          emitSoundCue(ch.position, 5.5, 'jump', u.actor?.team === 'hiders' ? ch : null);
        }
      }

      // Full 360° 18-whisker steering fan with terrain + cliff + water safety
      if (nav.vaultT <= 0) {
        const allowGlide = !!u.gliding;
        let bestScore = -1e9;
        const nearDoor = env.ENTER.some((b) =>
          Math.abs(curY - b.g.position.y) < 1.6 &&
          ((b.door && Math.hypot(ch.position.x - b.door.x, ch.position.z - b.door.z) < 2.0) ||
           (b.doorIn && Math.hypot(ch.position.x - b.doorIn.x, ch.position.z - b.doorIn.z) < 2.0))
        );
        const allChars = opts.allChars || [];

        // Fast-path straight ahead ONLY when swept segment has zero thin walls/fences!
        let fastTaken = false;
        if (!nearDoor && nav.stuckT <= 0.12) {
          const sx0 = Math.sin(baseAng), sz0 = Math.cos(baseAng);
          const f1x = ch.position.x + sx0 * 0.55, f1z = ch.position.z + sz0 * 0.55;
          const f2x = ch.position.x + sx0 * 1.15, f2z = ch.position.z + sz0 * 1.15;
          if (isSegmentWalkable(ch.position.x, ch.position.z, f2x, f2z, curFootY, 0.34, allowGlide, 4)) {
            let crowded = false;
            for (let ci = 0; ci < allChars.length; ci++) {
              const other = allChars[ci];
              if (!other || other === ch || !other.visible || other.userData?.actor?.eliminated) continue;
              if (Math.hypot(f1x - other.position.x, f1z - other.position.z) < 0.72) {
                crowded = true;
                break;
              }
            }
            if (!crowded) {
              chosenAng = baseAng;
              bestScore = 10.0;
              fastTaken = true;
            }
          }
        }

        if (!fastTaken) {
          for (let i = 0; i < WHISKER_OFFSETS_360.length; i++) {
            const rawOff = WHISKER_OFFSETS_360[i];
            const a = rawOff === Math.PI ? normAng(baseAng + Math.PI) : baseAng + rawOff * nav.side;
            const sx = Math.sin(a), sz = Math.cos(a);
            const p1x = ch.position.x + sx * 0.55, p1z = ch.position.z + sz * 0.55;
            const p2x = ch.position.x + sx * 1.15, p2z = ch.position.z + sz * 1.15;
            const ok1 = isSegmentWalkable(ch.position.x, ch.position.z, p1x, p1z, curFootY, 0.34, allowGlide, 2);
            if (!ok1) continue;
            const ok2 = isSegmentWalkable(p1x, p1z, p2x, p2z, curFootY, 0.34, allowGlide, 2);

            let sc = 10.0 - Math.abs(rawOff) * 2.35;
            if (!ok2) sc -= 3.2;
            sc -= Math.abs(normAng(a - nav.prevAng)) * 0.80;

            if (!nearDoor && allChars.length) {
              for (const other of allChars) {
                if (!other || other === ch || !other.visible || other.userData?.actor?.eliminated) continue;
                const od = Math.hypot(p1x - other.position.x, p1z - other.position.z);
                if (od < 0.95) sc -= (0.95 - od) * 2.9;
              }
            }

            if (sc > bestScore) {
              bestScore = sc;
              chosenAng = a;
              if (rawOff === 0 && ok2 && sc > 7.4) break;
            }
          }
        }

        // Never default chosenAng = baseAng straight into a blocked wall when all 0.55m whiskers fail!
        if (bestScore < -1e8) {
          let foundShort = false;
          for (let k = 0; k < 12; k++) {
            const a = nav.prevAng + nav.side * ((k + 1) * (Math.PI / 6));
            const tx = ch.position.x + Math.sin(a) * 0.32;
            const tz = ch.position.z + Math.cos(a) * 0.32;
            if (isWalkableSafe(tx, tz, curFootY, 0.28, allowGlide)) {
              chosenAng = a;
              foundShort = true;
              break;
            }
          }
          if (!foundShort) {
            chosenAng = normAng(nav.prevAng + nav.side * 1.65);
          }
        }
      }
    }

    // Optional lateral juke weave when a hider is sprinting away under active fire!
    if (opts.weaveAmp && (u.jy || 0) < 0.1) {
      const weave = Math.sin(getNow() * 0.0068 + (u.actor?.slotIdx || 0) * 1.7) * opts.weaveAmp;
      const wx = ch.position.x + Math.sin(chosenAng + weave) * 0.75;
      const wz = ch.position.z + Math.cos(chosenAng + weave) * 0.75;
      if (isWalkableSafe(wx, wz, curFootY, 0.34, !!u.gliding)) {
        chosenAng += weave;
      }
    }

    const step = Math.min(dist, speed * dt);
    const ox = ch.position.x, oz = ch.position.z;
    env.moveChar(ch, Math.sin(chosenAng) * step, Math.cos(chosenAng) * step);
    const moved = Math.hypot(ch.position.x - ox, ch.position.z - oz);

    nav.prevAng = chosenAng;
    nav.face = chosenAng;

    // Rolling 0.75s net-displacement wall-rubbing detector + 0.30s head-on stuck detector!
    nav.anchorT = (nav.anchorT || 0) + dt;
    let wallRubbing = false;
    if (nav.anchorT >= 0.75) {
      const netMoved = Math.hypot(ch.position.x - (nav.anchorX ?? ch.position.x), ch.position.z - (nav.anchorZ ?? ch.position.z));
      if (step > 0.005 && netMoved < 0.55 && (u.jy || 0) < 0.08) {
        wallRubbing = true;
      } else {
        nav.stuckCount = Math.max(0, (nav.stuckCount || 0) - 1);
      }
      nav.anchorX = ch.position.x;
      nav.anchorZ = ch.position.z;
      nav.anchorT = 0;
    }

    if ((step > 0.005 && moved < step * 0.34 && (u.jy || 0) < 0.08) || wallRubbing) {
      nav.stuckT += wallRubbing ? 0.42 : dt;
      if (nav.stuckT > 0.30) {
        nav.stuckT = 0;
        nav.stuckCount = (nav.stuckCount || 0) + 1;
        nav.side = -nav.side;
        if (nav.stuckCount >= 2) {
          nav.goalBlocked = true;
          nav.stuckCount = 0;
        }
        if (opts.allowJump !== false && nav.jumpCd <= 0 && !u.specialMode) {
          env.doCharJump(ch, 7.6);
          nav.jumpCd = 0.85;
        }
        let pickedDetour = null;
        let bestDetourScore = -1e9;
        for (let k = 0; k < 16; k++) {
          const ang = baseAng + (k % 2 === 0 ? 1 : -1) * (0.72 + Math.floor(k / 2) * 0.36) * nav.side;
          for (const r of [2.4, 4.0, 5.6]) {
            const tx = ch.position.x + Math.sin(ang) * r;
            const tz = ch.position.z + Math.cos(ang) * r;
            if (!isSegmentWalkable(ch.position.x, ch.position.z, tx, tz, curY, 0.34, false, 4)) continue;
            const tgy = evaluateGoalPoint(tx, tz, curY, 0.36, null);
            if (tgy == null) continue;
            const dAfter = Math.hypot(goalPt.x - tx, goalPt.z - tz);
            const sc = -dAfter * 0.35 - Math.abs(normAng(ang - baseAng)) * 0.9 + r * 0.45;
            if (sc > bestDetourScore) {
              bestDetourScore = sc;
              pickedDetour = new THREE.Vector3(tx, tgy, tz);
            }
            break;
          }
        }
        if (pickedDetour) {
          nav.detour = pickedDetour;
          nav.detourT = 1.6;
        }
      }
    } else {
      nav.stuckT = Math.max(0, nav.stuckT - dt * 0.85);
    }

    const isDisguised = !!(u.propId || u.specialMode);
    u.bob = (u.bob || 0) + dt * (isDisguised ? 15 : speed > 4.8 ? 14 : 10);
    return moved > 0.001;
  }

  // --------------------------------------------------------------------------
  // Discover Elevated Parkour Perches & Full 3D Map Exploration Graph
  // --------------------------------------------------------------------------
  function getParkourPerches() {
    const mapId = env.getActiveMapId();
    if (TEAM_INTEL.perchCacheMapId === mapId && TEAM_INTEL.perchCache.length) {
      return TEAM_INTEL.perchCache;
    }
    TEAM_INTEL.perchCacheMapId = mapId;
    const perches = [];
    const KIT = env.getKit();
    const availPerchProps = Object.keys(KIT.props || {}).filter((id) => {
      const d = KIT.props[id];
      return d && (PERCHABLE_PROPS.has(id) || ((d.height || 1) <= 0.88 && (d.radius || 0.5) <= 0.48));
    });

    for (const b of env.blockers) {
      if (!b.standable || b.y1 == null) continue;
      const cx = b.obb ? b.obb.cx : (b.x0 + b.x1) * 0.5;
      const cz = b.obb ? b.obb.cz : (b.z0 + b.z1) * 0.5;
      const w = b.obb ? b.obb.hx * 2 : (b.x1 - b.x0);
      const d = b.obb ? b.obb.hz * 2 : (b.z1 - b.z0);
      if (w < 0.68 || d < 0.68 || w > 5.5 || d > 5.5) continue;
      if (Math.hypot(cx, cz) > env.getMapRadius() - 2.2) continue;

      const baseGroundY = env.groundHeightAt(cx, cz, (b.y0 ?? 0) + 0.25);
      const perchH = b.y1 - baseGroundY;
      if (perchH < 0.40 || perchH > 1.22) continue;
      if (blockedByTallWall(cx, cz, b.y1 + 0.08, 0.28)) continue;

      let approach = null;
      const reach = Math.max(w, d) * 0.5 + 0.64;
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const ax = cx + Math.cos(ang) * reach;
        const az = cz + Math.sin(ang) * reach;
        const agy = evaluateGoalPoint(ax, az, baseGroundY, 0.38, null);
        if (agy != null && Math.abs(agy - baseGroundY) < 0.42) {
          approach = { x: ax, y: agy, z: az };
          break;
        }
      }
      if (!approach) continue;

      let bestPropId = null, bestPropD = 9.0;
      for (const rp of env.realProps) {
        const pd = KIT.props[rp.id];
        if (!pd || (pd.height || 1) > 0.95) continue;
        const dist = Math.hypot(rp.pos.x - cx, rp.pos.z - cz);
        if (dist < bestPropD) {
          bestPropD = dist;
          bestPropId = rp.id;
        }
      }
      if (!bestPropId && availPerchProps.length) bestPropId = pick(availPerchProps);
      if (!bestPropId) continue;

      perches.push({
        x: cx,
        y: b.y1,
        z: cz,
        approach,
        propId: bestPropId,
        rot: rand(0, Math.PI * 2),
      });
    }
    TEAM_INTEL.perchCache = perches;
    return perches;
  }

  // Builds and caches a rich per-map 3D exploration node graph covering:
  //  - 'backyard': behind ENTER houses, side alleys, rear corners + occluded non-enterable structures/stalls/sheds
  //  - 'indoor': EVERY individual room in eb.rooms + deep interior back-corner waypoints in large rooms
  //  - 'perimeter': 24 radial sectors × 2 outer rings (0.50*MAPR & 0.78*MAPR) + secluded outer prop clusters
  //  - 'perch' & 'special': walkable vantage points next to furniture perches and map special spots
  //  - 'vignette': standard LIVE clusters (lower base priority than unvisited hidden areas)
  function getMapExplorationNodes() {
    const mapId = env.getActiveMapId();
    const sig = `${mapId}:${env.ENTER.length}:${env.blockers.length}:${env.LIVE.length}`;
    if (TEAM_INTEL.navGraphMapId === mapId && TEAM_INTEL.navGraphSig === sig && TEAM_INTEL.navGraphNodes.length > 0) {
      return TEAM_INTEL.navGraphNodes;
    }

    const nodes = [];
    const MAPR = env.getMapRadius();
    const activeMap = env.getActiveMap();
    const plazaY = env.groundHeightAt(0, 0);
    const plazaEye = new THREE.Vector3(0, plazaY + 1.5, 0);

    const hasNearbyOfKind = (kind, x, y, z, minDist) => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (kind && n.kind !== kind) continue;
        if (Math.abs(n.pos.y - y) < 1.8 && Math.hypot(n.pos.x - x, n.pos.z - z) < minDist) return true;
      }
      return false;
    };

    // 1A. 'backyard' nodes around EVERY enterable building (rear walls, both side alleys, rear corners)
    for (let bi = 0; bi < env.ENTER.length; bi++) {
      const eb = env.ENTER[bi];
      const u = eb.g.userData || {};
      const fw = (u.footprint && u.footprint.w) || (u.footprintBox && u.footprintBox.w) || 9.0;
      const fd = (u.footprint && u.footprint.d) || (u.footprintBox && u.footprintBox.d) || 8.0;
      const by = eb.g.position.y || 0;

      const localProbes = [];
      for (const dOff of [1.45, 2.35]) {
        const rz = -(fd * 0.5 + dOff);
        localProbes.push([-fw * 0.34, rz], [0, rz], [fw * 0.34, rz]);
      }
      // Side alleys (left & right at mid and rear-quarter z)
      for (const sx of [-(fw * 0.5 + 1.55), fw * 0.5 + 1.55]) {
        localProbes.push([sx, 0], [sx, -fd * 0.28]);
      }
      // Rear corners
      localProbes.push(
        [-(fw * 0.5 + 1.48), -(fd * 0.5 + 1.48)],
        [fw * 0.5 + 1.48, -(fd * 0.5 + 1.48)]
      );

      let k = 0;
      for (let pi = 0; pi < localProbes.length; pi++) {
        const [lx, lz] = localProbes[pi];
        const wp = eb.g.localToWorld(_tmpV1.set(lx, 0, lz));
        const snapped = snapToWalkableGoal(wp.x, wp.z, by, 1.85, null, { strict: true, mustBeOutdoor: true });
        if (!snapped) continue;
        if (hasNearbyOfKind('backyard', snapped.x, snapped.y, snapped.z, 2.5)) continue;
        const occluded = !env.lineOfSight(plazaEye, _tmpV2.set(snapped.x, snapped.y + 1.05, snapped.z));
        nodes.push({
          id: `eb_back_${bi}_${k++}`,
          kind: 'backyard',
          pos: snapped,
          occluded,
        });
      }
    }

    // 1B. 'backyard' nodes behind non-enterable houses, market stalls, sheds, towers, cabinets & hangars
    let blkSeq = 0;
    const seenBlkCells = new Set();
    for (let bj = 0; bj < env.blockers.length; bj++) {
      const b = env.blockers[bj];
      const bh = (b.y1 ?? 3.0) - (b.y0 ?? 0);
      if (b.standable && bh <= 1.85) continue;

      const cx = b.obb ? b.obb.cx : (b.x0 + b.x1) * 0.5;
      const cz = b.obb ? b.obb.cz : (b.z0 + b.z1) * 0.5;
      const hx = b.obb ? b.obb.hx : (b.x1 - b.x0) * 0.5;
      const hz = b.obb ? b.obb.hz : (b.z1 - b.z0) * 0.5;
      const w = hx * 2, d = hz * 2;
      if (w < 2.2 && d < 2.2) continue;
      if (w > 28 || d > 28) continue;
      if (Math.hypot(cx, cz) > MAPR - 1.5) continue;

      const cCos = b.obb ? b.obb.c : 1;
      const sSin = b.obb ? b.obb.s : 0;
      const refY = env.groundHeightAt(cx, cz, b.y0 ?? 0);
      const cRadSq = cx * cx + cz * cz;

      const sideSamples = [
        [0, -(hz + 1.65)],
        [0, hz + 1.65],
        [-(hx + 1.65), 0],
        [hx + 1.65, 0],
        [-hx * 0.6, -(hz + 1.9)],
        [hx * 0.6, -(hz + 1.9)],
      ];

      for (let si = 0; si < sideSamples.length; si++) {
        const [lx, lz] = sideSamples[si];
        const wx = cx + lx * cCos + lz * sSin;
        const wz = cz - lx * sSin + lz * cCos;
        const cellKey = `${Math.round(wx * 0.45)}:${Math.round(wz * 0.45)}`;
        if (seenBlkCells.has(cellKey)) continue;
        seenBlkCells.add(cellKey);
        const gy = evaluateGoalPoint(wx, wz, refY, 0.38, { mustBeOutdoor: true });
        if (gy == null) continue;
        if (hasNearbyOfKind('backyard', wx, gy, wz, 3.4)) continue;

        const occluded = !env.lineOfSight(plazaEye, _tmpV2.set(wx, gy + 1.05, wz));
        const radiallyBehind = (wx * cx + wz * cz) > cRadSq + 1.0;
        if (!occluded && !radiallyBehind) continue;

        nodes.push({
          id: `blk_back_${bj}_${blkSeq++}`,
          kind: 'backyard',
          pos: new THREE.Vector3(wx, gy, wz),
          occluded,
        });
      }
    }

    // 2. 'indoor' nodes: EVERY room gets its own unique ID + deep corner waypoint for larger rooms
    for (let bi = 0; bi < env.ENTER.length; bi++) {
      const eb = env.ENTER[bi];
      const by = eb.g.position.y || 0;
      const doorRef = eb.doorIn || eb.door;
      const doorLocal = doorRef ? eb.g.worldToLocal(_tmpV1.set(doorRef.x, by, doorRef.z)) : { x: 0, z: 3 };
      const doorLocalX = doorLocal.x, doorLocalZ = doorLocal.z;

      for (let ri = 0; ri < eb.rooms.length; ri++) {
        const r = eb.rooms[ri];
        const wp = eb.g.localToWorld(_tmpV1.set(r.x, 0, r.z));
        const snapped = snapToWalkableGoal(wp.x, wp.z, by, 2.4, null, {
          strict: true,
          mustBeBuilding: eb,
          mustBeRoomIdx: ri,
        }) || snapToWalkableGoal(wp.x, wp.z, by, 2.6, null, {
          strict: true,
          mustBeBuilding: eb,
        });
        if (snapped) {
          nodes.push({
            id: `eb_room_${bi}_${ri}`,
            kind: 'indoor',
            pos: snapped,
            deep: false,
          });
        }

        // Deep room / back-corner / behind-stairs waypoint for larger rooms so bots walk all the way in!
        if ((r.w || 0) > 4.5 || (r.d || 0) > 4.5) {
          const sx = r.x >= doorLocalX ? 1 : -1;
          const sz = r.z <= doorLocalZ ? -1 : 1;
          const deepOffsets = [
            [r.x + sx * Math.max(0.8, (r.w || 4) * 0.30), r.z + sz * Math.max(0.8, (r.d || 4) * 0.30)],
            [r.x - sx * Math.max(0.8, (r.w || 4) * 0.28), r.z + sz * Math.max(0.8, (r.d || 4) * 0.30)],
            [r.x, r.z + sz * Math.max(1.0, (r.d || 4) * 0.33)],
          ];
          for (let di = 0; di < deepOffsets.length; di++) {
            const dwp = eb.g.localToWorld(_tmpV1.set(deepOffsets[di][0], 0, deepOffsets[di][1]));
            const dSnap = snapToWalkableGoal(dwp.x, dwp.z, by, 1.5, null, {
              strict: true,
              mustBeBuilding: eb,
              mustBeRoomIdx: ri,
            });
            if (dSnap && (!snapped || dSnap.distanceTo(snapped) >= 1.65)) {
              nodes.push({
                id: `eb_room_deep_${bi}_${ri}`,
                kind: 'indoor',
                pos: dSnap,
                deep: true,
              });
              break;
            }
          }
        }
      }
    }

    // 3. 'perimeter' nodes: 24 radial sectors × 2 outer rings (0.50*MAPR & 0.78*MAPR) + secluded prop clusters
    let perimSeq = 0;
    const rings = [0.50, 0.78];
    for (let ri = 0; ri < rings.length; ri++) {
      const rad = MAPR * rings[ri];
      for (let sec = 0; sec < 24; sec++) {
        const ang = (sec / 24) * Math.PI * 2 + ri * (Math.PI / 24);
        const rx = Math.cos(ang) * rad;
        const rz = Math.sin(ang) * rad;
        const snapped = snapToWalkableGoal(rx, rz, undefined, 3.6, null, { strict: true, mustBeOutdoor: true });
        if (!snapped) continue;
        if (hasNearbyOfKind('perimeter', snapped.x, snapped.y, snapped.z, 5.5)) continue;
        nodes.push({
          id: `perim_ring_${perimSeq++}`,
          kind: 'perimeter',
          pos: snapped,
        });
      }
    }

    // Secluded realProps clusters > 8m away from any LIVE vignette center
    for (let pi = 0; pi < env.realProps.length; pi++) {
      const rp = env.realProps[pi];
      if (env.ENTER.length && env.whereIs(rp.pos.x, rp.pos.z, rp.pos.y)) continue;
      let nearVig = false;
      for (let vi = 0; vi < env.LIVE.length; vi++) {
        const vc = env.LIVE[vi].c;
        if (Math.hypot(rp.pos.x - vc.x, rp.pos.z - vc.z) <= 8.0) {
          nearVig = true;
          break;
        }
      }
      if (nearVig) continue;
      const snapped = snapToWalkableGoal(rp.pos.x, rp.pos.z, rp.pos.y, 2.8, null, { strict: true, mustBeOutdoor: true });
      if (!snapped) continue;
      if (hasNearbyOfKind('perimeter', snapped.x, snapped.y, snapped.z, 5.5)) continue;
      if (hasNearbyOfKind('backyard', snapped.x, snapped.y, snapped.z, 4.0)) continue;
      nodes.push({
        id: `perim_prop_${perimSeq++}`,
        kind: 'perimeter',
        pos: snapped,
      });
    }

    // 4. 'perch' & 'special' vantage nodes
    const perches = getParkourPerches();
    for (let k = 0; k < perches.length; k++) {
      const pc = perches[k];
      const snapped = snapToWalkableGoal(pc.approach.x, pc.approach.z, pc.approach.y, 2.2, pc, { strict: true });
      if (!snapped) continue;
      if (hasNearbyOfKind('perch', snapped.x, snapped.y, snapped.z, 4.2)) continue;
      nodes.push({
        id: `perch_${k}`,
        kind: 'perch',
        pos: snapped,
      });
    }

    if (activeMap && activeMap.getInteractSpots) {
      const spots = activeMap.getInteractSpots() || [];
      for (let k = 0; k < spots.length; k++) {
        const sp = spots[k];
        if (sp.kind === 'lift' || sp.kind === 'mechanism' || sp.kind === 'ride_path' || sp.kind === 'turret') continue;
        const tx = sp.triggerX ?? sp.x;
        const tz = sp.triggerZ ?? sp.z;
        const ty = sp.triggerY ?? sp.groundY ?? sp.y;
        const snapped = snapToWalkableGoal(tx, tz, ty, 3.2, sp, { strict: true });
        if (!snapped) continue;
        if (hasNearbyOfKind('special', snapped.x, snapped.y, snapped.z, 3.6)) continue;
        nodes.push({
          id: `spec_${k}`,
          kind: 'special',
          pos: snapped,
        });
      }
    }

    // 5. 'vignette' nodes (lower base priority than unvisited backyards/indoors/perimeters)
    for (let vi = 0; vi < env.LIVE.length; vi++) {
      const v = env.LIVE[vi];
      const snapped = snapToWalkableGoal(v.c.x, v.c.z, v.c.y, 3.4, null, { strict: true });
      if (!snapped) continue;
      nodes.push({
        id: `vig_${vi}`,
        kind: 'vignette',
        pos: snapped,
      });
    }

    TEAM_INTEL.navGraphMapId = mapId;
    TEAM_INTEL.navGraphSig = sig;
    TEAM_INTEL.navGraphNodes = nodes;
    return nodes;
  }

  // Discovers snug behind-house / rear-eave / side-alley hiding tucks (0.9m..1.6m from walls, occluded from plaza)
  function getBackyardHideSpots() {
    const mapId = env.getActiveMapId();
    if (TEAM_INTEL.backyardHideMapId === mapId && TEAM_INTEL.backyardHideSpots.length > 0) {
      return TEAM_INTEL.backyardHideSpots;
    }
    const KIT = env.getKit();
    const MAPR = env.getMapRadius();
    const plazaY = env.groundHeightAt(0, 0);
    const plazaEye = new THREE.Vector3(0, plazaY + 1.5, 0);
    const spots = [];

    const outdoorPropIds = Object.keys(KIT.props || {}).filter((id) => {
      const d = KIT.props[id];
      return d && !d.canFly && (d.radius || 0.5) <= 0.68 && (d.height || 1) <= 1.65;
    });

    const pickMatchingWallProp = (x, z) => {
      let bestId = null, bestD = 15.5;
      for (let i = 0; i < env.realProps.length; i++) {
        const rp = env.realProps[i];
        const pd = KIT.props[rp.id];
        if (!pd || pd.canFly || (pd.radius || 0.5) > 0.68 || (pd.height || 1) > 1.75) continue;
        if (env.ENTER.length && env.whereIs(rp.pos.x, rp.pos.z, rp.pos.y)) continue;
        const d = Math.hypot(rp.pos.x - x, rp.pos.z - z);
        if (d < bestD) {
          bestD = d;
          bestId = rp.id;
        }
      }
      if (!bestId && outdoorPropIds.length) bestId = pick(outdoorPropIds);
      return bestId;
    };

    const tooClose = (x, y, z) => {
      for (let i = 0; i < spots.length; i++) {
        if (Math.abs(spots[i].y - y) < 1.6 && Math.hypot(spots[i].x - x, spots[i].z - z) < 2.8) return true;
      }
      return false;
    };

    const seenSpotCells = new Set();

    // A) Snug rear-wall & side-alley tucks beside ENTER buildings
    for (let bi = 0; bi < env.ENTER.length; bi++) {
      const eb = env.ENTER[bi];
      const u = eb.g.userData || {};
      const fw = (u.footprint && u.footprint.w) || (u.footprintBox && u.footprintBox.w) || 9.0;
      const fd = (u.footprint && u.footprint.d) || (u.footprintBox && u.footprintBox.d) || 8.0;
      const by = eb.g.position.y || 0;
      const bRot = eb.g.rotation.y || 0;

      const tucks = [
        [-fw * 0.30, -(fd * 0.5 + 1.08), bRot + Math.PI],
        [0, -(fd * 0.5 + 1.05), bRot + Math.PI],
        [fw * 0.30, -(fd * 0.5 + 1.08), bRot + Math.PI],
        [-fw * 0.36, -(fd * 0.5 + 1.42), bRot + Math.PI],
        [fw * 0.36, -(fd * 0.5 + 1.42), bRot + Math.PI],
        [-(fw * 0.5 + 1.08), -fd * 0.22, bRot - Math.PI * 0.5],
        [fw * 0.5 + 1.08, -fd * 0.22, bRot + Math.PI * 0.5],
        [-(fw * 0.5 + 1.15), fd * 0.12, bRot - Math.PI * 0.5],
        [fw * 0.5 + 1.15, fd * 0.12, bRot + Math.PI * 0.5],
      ];

      for (let ti = 0; ti < tucks.length; ti++) {
        const [lx, lz, alignRot] = tucks[ti];
        const wp = eb.g.localToWorld(_tmpV1.set(lx, 0, lz));
        const gy = evaluateGoalPoint(wp.x, wp.z, by, 0.44, { mustBeOutdoor: true });
        if (gy == null || tooClose(wp.x, gy, wp.z)) continue;
        seenSpotCells.add(`${Math.round(wp.x * 0.4)}:${Math.round(wp.z * 0.4)}`);
        const occluded = !env.lineOfSight(plazaEye, _tmpV2.set(wp.x, gy + 0.85, wp.z));
        if (!occluded && lz > -fd * 0.35) continue;
        const propId = pickMatchingWallProp(wp.x, wp.z);
        if (!propId) continue;
        spots.push({
          x: wp.x,
          y: gy,
          z: wp.z,
          propId,
          rot: alignRot + rand(-0.08, 0.08),
          occluded,
        });
      }
    }

    // B) Snug rear/side tucks behind sheds, market stalls, towers & structures in blockers
    for (let bj = 0; bj < env.blockers.length; bj++) {
      const b = env.blockers[bj];
      const bh = (b.y1 ?? 3.0) - (b.y0 ?? 0);
      if (b.standable && bh <= 1.85) continue;
      const cx = b.obb ? b.obb.cx : (b.x0 + b.x1) * 0.5;
      const cz = b.obb ? b.obb.cz : (b.z0 + b.z1) * 0.5;
      const hx = b.obb ? b.obb.hx : (b.x1 - b.x0) * 0.5;
      const hz = b.obb ? b.obb.hz : (b.z1 - b.z0) * 0.5;
      const w = hx * 2, d = hz * 2;
      if ((w < 2.4 && d < 2.4) || w > 26 || d > 26) continue;
      if (Math.hypot(cx, cz) > MAPR - 1.8) continue;

      const cCos = b.obb ? b.obb.c : 1;
      const sSin = b.obb ? b.obb.s : 0;
      const wallYaw = Math.atan2(-sSin, cCos);
      const refY = env.groundHeightAt(cx, cz, b.y0 ?? 0);

      const offsets = [
        [0, -(hz + 1.12), wallYaw + Math.PI],
        [0, hz + 1.12, wallYaw],
        [-(hx + 1.12), 0, wallYaw - Math.PI * 0.5],
        [hx + 1.12, 0, wallYaw + Math.PI * 0.5],
      ];
      for (let oi = 0; oi < offsets.length; oi++) {
        const [lx, lz, alignRot] = offsets[oi];
        const wx = cx + lx * cCos + lz * sSin;
        const wz = cz - lx * sSin + lz * cCos;
        const cellKey = `${Math.round(wx * 0.4)}:${Math.round(wz * 0.4)}`;
        if (seenSpotCells.has(cellKey)) continue;
        seenSpotCells.add(cellKey);
        const gy = evaluateGoalPoint(wx, wz, refY, 0.44, { mustBeOutdoor: true });
        if (gy == null || tooClose(wx, gy, wz)) continue;
        const occluded = !env.lineOfSight(plazaEye, _tmpV2.set(wx, gy + 0.85, wz));
        if (!occluded) continue;
        const propId = pickMatchingWallProp(wx, wz);
        if (!propId) continue;
        spots.push({
          x: wx,
          y: gy,
          z: wz,
          propId,
          rot: alignRot + rand(-0.08, 0.08),
          occluded: true,
        });
      }
    }

    TEAM_INTEL.backyardHideMapId = mapId;
    TEAM_INTEL.backyardHideSpots = spots;
    return spots;
  }

  // --------------------------------------------------------------------------
  // Smart Hiding Spot Planner (Spreads all 5 Hiders across 5 Distinct Playstyles!)
  // --------------------------------------------------------------------------
  function pickSmartHidingPlan(h, opts = {}) {
    const ai = h.userData.ai;
    const KIT = env.getKit();
    const activeMap = env.getActiveMap();
    const allHiders = env.G.allHiders || [];
    const allSeekers = env.G.allSeekers || [];
    const avoidPropId = opts.avoidPropId || null;
    const avoidPos = opts.avoidPos || null;
    const emergency = !!opts.emergency;
    const now = getNow();
    const plazaEye = new THREE.Vector3(0, env.groundHeightAt(0, 0) + 1.5, 0);

    const hiderPeers = [];
    for (const oh of allHiders) {
      if (!oh || oh === h || oh.userData?.actor?.eliminated) continue;
      const goal = oh.userData?.ai?.plan;
      hiderPeers.push(goal ? { x: goal.x, z: goal.z } : { x: oh.position.x, z: oh.position.z });
    }

    const isBlacklistedSpot = (x, z) => {
      if (avoidPos && Math.hypot(x - avoidPos.x, z - avoidPos.z) < 3.4) return true;
      if (ai.failedSpots && ai.failedSpots.length) {
        for (let i = ai.failedSpots.length - 1; i >= 0; i--) {
          const fs = ai.failedSpots[i];
          if (now > fs.exp) {
            ai.failedSpots.splice(i, 1);
            continue;
          }
          if (Math.hypot(x - fs.x, z - fs.z) < 3.4) return true;
        }
      }
      return false;
    };

    const peerPenalty = (x, z) => {
      let pen = 0;
      for (const p of hiderPeers) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < 9.5) pen += (9.5 - d) * 1.45;
      }
      return pen;
    };

    const approxSeekerSafety = (x, z) => {
      let minD = 99;
      for (const s of allSeekers) {
        if (!s) continue;
        const d = Math.hypot(x - s.position.x, z - s.position.z);
        if (d < minD) minD = d;
      }
      let s = clamp(minD, 0, 26) * 0.32;
      if (env.G.phase !== 'hide' && env.G.phase !== 'ready' && minD < 8) s -= (8 - minD) * 0.85;
      return s;
    };

    const seekerHasLOS = (x, y, z) => {
      if (env.G.phase === 'hide' || env.G.phase === 'ready') return false;
      _tmpV1.set(x, y + 0.65, z);
      for (const s of allSeekers) {
        if (!s) continue;
        if (Math.hypot(x - s.position.x, z - s.position.z) < 22) {
          _tmpV2.set(s.position.x, (s.userData.groundY || 0) + 1.35, s.position.z);
          if (env.lineOfSight(_tmpV2, _tmpV1)) return true;
        }
      }
      return false;
    };

    const candidates = [];

    // 1. Secluded Backyard / Behind-House / Side-Alley Wall Tucks!
    const backyardSpots = getBackyardHideSpots();
    for (let i = 0; i < backyardSpots.length; i++) {
      const bs = backyardSpots[i];
      if (avoidPropId && bs.propId === avoidPropId) continue;
      if (isBlacklistedSpot(bs.x, bs.z)) continue;
      const safety = approxSeekerSafety(bs.x, bs.z);
      const dMe = Math.hypot(bs.x - h.position.x, bs.z - h.position.z);
      let score = 6.9 + safety - peerPenalty(bs.x, bs.z) - (emergency ? dMe * 0.34 : dMe * 0.04) + rand(0, 1.5);
      if (bs.occluded) score += 1.05;
      if (ai.style === 'backyard') score += 4.3;
      candidates.push({
        kind: 'backyard',
        x: bs.x,
        y: bs.y,
        z: bs.z,
        propId: bs.propId,
        rot: bs.rot,
        score,
      });
    }

    // 2. Map Special Interactive Spots (Steaming Cedar Tubs, Wall-Hung Eave Hooks, Sky-Roots, Golem Shells!)
    if (!emergency && activeMap && activeMap.getInteractSpots) {
      const spots = activeMap.getInteractSpots();
      for (const sp of spots) {
        if (sp.kind === 'lift' || sp.kind === 'mechanism' || sp.kind === 'ride_path' || sp.kind === 'turret') continue;
        if (sp.occupiedBy && sp.occupiedBy !== h && !sp.occupiedBy.userData?.actor?.eliminated) continue;
        if (allHiders.some((oh) => oh !== h && oh.userData?.ai?.plan?.specialSpot === sp)) continue;
        const tx = sp.triggerX ?? sp.x;
        const tz = sp.triggerZ ?? sp.z;
        if (isBlacklistedSpot(tx, tz)) continue;
        const ty = sp.triggerY ?? sp.groundY ?? sp.y ?? env.groundHeightAt(tx, tz);
        const safety = approxSeekerSafety(tx, tz);
        let score = 7.2 + safety - peerPenalty(tx, tz) + rand(0, 1.8);
        if (ai.style === 'special') score += 4.5;
        candidates.push({
          kind: 'special',
          specialSpot: sp,
          x: tx,
          y: ty,
          z: tz,
          propId: sp.propId || null,
          rot: sp.rot || 0,
          score,
        });
      }
    }

    // 3. Elevated Parkour Perches (Tables, Benches, Counters, Stacked Crates!)
    if (!emergency) {
      const perches = getParkourPerches();
      for (const pc of perches) {
        if (avoidPropId && pc.propId === avoidPropId) continue;
        if (isBlacklistedSpot(pc.x, pc.z)) continue;
        const safety = approxSeekerSafety(pc.x, pc.z);
        const dMe = Math.hypot(pc.x - h.position.x, pc.z - h.position.z);
        let score = 6.3 + safety - peerPenalty(pc.x, pc.z) - dMe * 0.04 + rand(0, 1.8);
        if (ai.style === 'parkour') score += 4.2;
        if (pc.y > 2.2) score += 0.9;
        candidates.push({
          kind: 'perch',
          x: pc.x,
          y: pc.y,
          z: pc.z,
          approach: pc.approach,
          propId: pc.propId,
          rot: pc.rot,
          score,
        });
      }
    }

    // 4. Open Vignette Slots & Indoor Prop Slots (Natural Cluster Camouflage!)
    for (const sl of env.SLOTS) {
      if (sl.real || sl.blocked || (sl.taken && sl.taken !== h)) continue;
      if (avoidPropId && sl.id === avoidPropId) continue;
      if (!KIT.props[sl.id]) continue;
      if (isBlacklistedSpot(sl.x, sl.z)) continue;
      const sy = typeof sl.y === 'number' ? sl.y : env.groundHeightAt(sl.x, sl.z);
      const safety = approxSeekerSafety(sl.x, sy);
      const inRoom = env.ENTER.length ? env.whereIs(sl.x, sl.z, sy) : null;
      const dMe = Math.hypot(sl.x - h.position.x, sl.z - h.position.z);
      let score = 6.5 + safety - peerPenalty(sl.x, sl.z) - (emergency ? dMe * 0.35 : dMe * 0.045) + rand(0, 1.6);
      if (inRoom) {
        score += 1.4;
        if (ai.style === 'indoor') score += 3.7;
      } else if (ai.style === 'vignette') {
        score += 2.4;
      }
      if (sy > 2.4) score += 1.0;
      if (sy < -1.2) score += 1.35;
      candidates.push({
        kind: 'slot',
        slot: sl,
        x: sl.x,
        y: sy,
        z: sl.z,
        propId: sl.id,
        rot: sl.rot + rand(-0.04, 0.04),
        _plazaOcclBonus: !inRoom ? (ai.style === 'backyard' ? 2.6 : 0) : 0,
        score,
      });
    }

    // 5. Snug Cluster Beside Real Props (secluded props or emergency quick-hide!)
    // Keep Legendary Flying Birds rare: 0 AI bird clones in Hider mode; at most 1 AI flyer in Seeker mode!
    const otherFlyingHiders = allHiders.filter((oh) => {
      if (!oh || oh === h || oh.userData?.actor?.eliminated) return false;
      const pid = oh.userData?.propId || oh.userData?.ai?.plan?.propId;
      return !!(pid && KIT.props[pid]?.canFly);
    }).length;
    const allowBotFlyer = env.G.mode === 'seek' && otherFlyingHiders < 1;

    const sampleProps = env.realProps.length > 32
      ? env.realProps.filter((_, idx) => idx % 2 === 0)
      : env.realProps;
    for (const rp of sampleProps) {
      if (avoidPropId && rp.id === avoidPropId) continue;
      const pd = KIT.props[rp.id];
      if (!pd) continue;
      if (pd.canFly && !allowBotFlyer) continue;
      const rOff = (pd.radius || 0.48) * 2.15 + 0.18;
      const ang = rand(0, Math.PI * 2);
      const tx = rp.pos.x + Math.cos(ang) * rOff;
      const tz = rp.pos.z + Math.sin(ang) * rOff;
      if (isBlacklistedSpot(tx, tz)) continue;
      const refY = rp.pos.y || 0;
      if (!isWalkableSafe(tx, tz, refY, (pd.radius || 0.45) * 0.85)) continue;
      const ty = env.groundHeightAt(tx, tz, refY);
      if (Math.abs(ty - refY) > 0.45) continue;
      const safety = approxSeekerSafety(tx, tz);
      const dMe = Math.hypot(tx - h.position.x, tz - h.position.z);
      let score = 5.4 + safety - peerPenalty(tx, tz) - (emergency ? dMe * 0.4 : dMe * 0.05) + rand(0, 1.4);
      if (pd.isAnimal) score += 1.25;
      if (ty < -1.2) score += 1.15;
      candidates.push({
        kind: 'cluster',
        x: tx,
        y: ty,
        z: tz,
        propId: rp.id,
        rot: rp.g.rotation.y + (env.ROUND_PROPS.has(rp.id) ? rand(-0.25, 0.25) : 0),
        _plazaOcclBonus: ai.style === 'backyard' ? 2.4 : 0.7,
        score,
      });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);

    // Stage 2: run exact raycast LOS verification ONLY on top 12 heuristic finalists!
    const finalists = [];
    const maxCheck = Math.min(candidates.length, 16);
    for (let i = 0; i < maxCheck && finalists.length < 8; i++) {
      const c = candidates[i];
      if (seekerHasLOS(c.x, c.y, c.z)) continue;
      if (c._plazaOcclBonus) {
        const occluded = !env.lineOfSight(plazaEye, _tmpV1.set(c.x, c.y + 0.8, c.z));
        if (occluded) c.score += c._plazaOcclBonus;
      }
      finalists.push(c);
    }
    const pool = finalists.length ? finalists : candidates.slice(0, 6);
    pool.sort((a, b) => b.score - a.score);

    // Weighted Top-4 randomized choice so every round feels fresh, organic & non-deterministic!
    const chosen = pickWeightedTopK(pool, 4, (c) => c.score);
    if (ai.slot && ai.slot !== chosen.slot) {
      ai.slot.taken = null;
      ai.slot = null;
    }
    if (chosen.slot) {
      chosen.slot.taken = h;
      ai.slot = chosen.slot;
    }
    return chosen;
  }

  // Pick a smart snapped escape refuge when spotted/sprayed (breaks LOS via backyards, rooms, steam, updrafts!)
  function pickEscapePlan(h, threatSeeker) {
    const allSeekers = env.G.allSeekers || [];
    const activeMap = env.getActiveMap();
    const curY = h.userData.groundY ?? 0;

    const awayX = threatSeeker ? h.position.x - threatSeeker.position.x : rand(-1, 1);
    const awayZ = threatSeeker ? h.position.z - threatSeeker.position.z : rand(-1, 1);
    const awayLen = Math.hypot(awayX, awayZ) || 1;
    const ax = awayX / awayLen, az = awayZ / awayLen;

    const candidates = [];

    // 1. Exploration graph indoor rooms & occluded backyard alleys (breaks LOS immediately!)
    const navNodes = getMapExplorationNodes();
    for (let i = 0; i < navNodes.length; i++) {
      const n = navNodes[i];
      if (n.kind === 'indoor') {
        candidates.push({ x: n.pos.x, y: n.pos.y, z: n.pos.z, bonus: 3.4 });
      } else if (n.kind === 'backyard') {
        candidates.push({ x: n.pos.x, y: n.pos.y, z: n.pos.z, bonus: 3.1 });
      } else if (n.kind === 'perimeter' || n.kind === 'vignette') {
        candidates.push({ x: n.pos.x, y: n.pos.y, z: n.pos.z, bonus: 1.5 });
      }
    }

    // 2. Active Bathhouse Herbal Steam Vents
    if (activeMap && activeMap.getSteamState) {
      const st = activeMap.getSteamState();
      if (st.strength > 0.25) {
        for (const v of st.vents) {
          candidates.push({ x: v.x, y: v.y, z: v.z, bonus: 4.5 * st.strength });
        }
      }
    }
    // 3. Sky-Ruins Wind Updraft Geysers
    if (activeMap && activeMap.getUpdrafts) {
      for (const up of activeMap.getUpdrafts()) {
        if (Math.abs(up.y - curY) < 1.3) {
          candidates.push({ x: up.x, y: up.y, z: up.z, bonus: 3.8 });
        }
      }
    }

    const scored = [];
    for (const c of candidates) {
      const dMe = Math.hypot(c.x - h.position.x, c.z - h.position.z);
      if (dMe < 7.2 || dMe > 34) continue;

      const ux = (c.x - h.position.x) / dMe, uz = (c.z - h.position.z) / dMe;
      const alignAway = ux * ax + uz * az;

      let minSeekerD = 99;
      for (const s of allSeekers) {
        if (!s) continue;
        const sd = Math.hypot(c.x - s.position.x, c.z - s.position.z);
        if (sd < minSeekerD) minSeekerD = sd;
      }
      if (minSeekerD < 5.5) continue;

      const score = c.bonus + alignAway * 4.5 + Math.min(minSeekerD, 24) * 0.35 + (Math.abs(c.y - curY) > 1.0 ? 1.6 : 0) + rand(0, 1.2);
      scored.push({ c, score });
    }

    if (scored.length) {
      scored.sort((a, b) => b.score - a.score);
      const picked = pickWeightedTopK(scored, 3, (it) => it.score);
      if (picked) {
        return snapToWalkableGoal(picked.c.x, picked.c.z, picked.c.y, 3.2);
      }
    }

    // Fallback radial escape point validated via snapToWalkableGoal
    for (let k = 0; k < 10; k++) {
      const ang = Math.atan2(ax, az) + rand(-1.1, 1.1);
      const dist = rand(10, 18);
      const tx = h.position.x + Math.sin(ang) * dist;
      const tz = h.position.z + Math.cos(ang) * dist;
      const snapped = snapToWalkableGoal(tx, tz, curY, 3.5, null, { strict: true });
      if (snapped) return snapped;
    }
    return snapToWalkableGoal(h.position.x + ax * 8, h.position.z + az * 8, curY, 4.5);
  }

  function applyAIDisguise(h, propId, matchRot) {
    const KIT = env.getKit();
    if (!propId || !KIT.props[propId]) return false;
    const ai = h.userData.ai;
    if ((ai.transformCd || 0) > 0) return false;
    // Cap Legendary Flying Bird disguises on AI bots (0 in Hider mode, max 1 in Seeker mode)
    if (KIT.props[propId]?.canFly) {
      const allHiders = env.G.allHiders || [];
      const otherFlyers = allHiders.filter((oh) => (
        oh && oh !== h && !oh.userData?.actor?.eliminated &&
        oh.userData?.propId && KIT.props[oh.userData.propId]?.canFly
      )).length;
      if (env.G.mode !== 'seek' || otherFlyers >= 1) {
        const alt = env.realProps.find((r) => r.id && KIT.props[r.id] && !KIT.props[r.id].canFly);
        if (!alt) return false;
        propId = alt.id;
      }
    }
    const prevMax = ai.maxHp || 180;
    const curHp = ai.hp ?? prevMax;
    const frac = clamp(curHp / prevMax, 0.15, 1);
    if (!env.disguise(h, propId)) return false;
    const def = KIT.props[propId];
    ai.maxHp = def.hp || 180;
    ai.hp = frac * ai.maxHp;
    ai.transformCd = (env.G.phase === 'hide' || env.G.phase === 'ready') ? 0.25 : 2.5;
    ai.poofAt = getNow();
    if (typeof matchRot === 'number') h.rotation.y = matchRot;
    env.splash(env.centerOf(h), 20, 2.1);
    if (env.G.phase !== 'ready') {
      emitSoundCue(h.position, 9.5, 'poof', h);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // AI Hider Lifecycle & Frame Update
  // --------------------------------------------------------------------------
  function initHiderBot(h, idx = 0) {
    const deck = TEAM_INTEL.hiderDeck && TEAM_INTEL.hiderDeck.length ? TEAM_INTEL.hiderDeck : HIDER_STYLES;
    const style = deck[idx % deck.length];
    h.userData.ai = {
      style,
      state: 'scramble',      // 'scramble' | 'hidden' | 'evade' | 'eliminated'
      prevState: 'scramble',
      plan: null,
      slot: null,
      failedSpots: [],
      scrambleRetries: 0,
      perchStage: 0,
      spawnDelay: rand(0.02, 0.20),
      didStartHop: Math.random() >= 0.34,
      escapeGoal: null,
      escapeReplanT: 0,
      compromisedPropId: null,
      unseenT: 0,
      hp: 180,
      maxHp: 180,
      lastHitAt: -1e9,
      transformCd: 0,
      stillT: rand(0, 5),
      shimmyT: 0,
      anim: 0,
      poofAt: -1e9,
      lastAttacker: null,
      hitBurst: 0,
      // how many hits in quick succession it takes before this bot gives up its spot and runs
      nerveHits: (DIFF < 0.35 ? 1 : DIFF < 0.7 ? 2 : 3) + (Math.random() < 0.3 ? 1 : 0),
      giggleT: rand(14, 34),
      potGoal: null,
      stateTimer: 0,
      progressTimer: 0,
      progressRefPos: h.position.clone(),
    };
  }

  function onHiderDamaged(h, shooter) {
    const u = h.userData;
    const ai = u.ai;
    const now = getNow();
    if (shooter) {
      recordSighting(shooter, h, new THREE.Vector3(), now);
      // A bot seeker whose own spray just made a "prop" flinch does not shrug and walk on: it commits.
      // Whether it notices is rolled once per spray-check (gentle bots miss the tell about two times in three,
      // sharp bots never do), so a still hider can get lucky but can no longer count on it.
      const sai = shooter.userData?.ai;
      if (sai && sai.susMap && shooter.userData?.actor?.team === 'seekers') {
        if (!sai.hitMemo) sai.hitMemo = new Map();
        let memo = sai.hitMemo.get(h);
        if (!memo || now > memo.until) {
          memo = { until: now + 4000, commit: Math.random() < dLerp(0.45, 1.0) * paceGovernor() };
          sai.hitMemo.set(h, memo);
        }
        if (memo.commit) sai.susMap.set(h, Math.max(sai.susMap.get(h) || 0, 1.08));
      }
    }
    if (!ai || !u.actor?.isBot || u.actor?.eliminated) return;

    ai.hitBurst = (now - ai.lastHitAt < 1300) ? (ai.hitBurst || 0) + 1 : 1;
    ai.lastHitAt = now;
    ai.lastAttacker = shooter || null;
    ai.unseenT = 0;

    // Hold your nerve: one stray splash from a sweeping seeker is not a reason to bolt and give the game away.
    // Run only when it is clearly being focused, is hurt, the seeker is on top of it, or it was already moving.
    const hpRatio = (ai.hp ?? 180) / (ai.maxHp || 180);
    const shooterDist = shooter ? Math.hypot(shooter.position.x - h.position.x, shooter.position.z - h.position.z) : 99;
    const alreadyRunning = ai.state === 'evade' || ai.state === 'scramble' || ai.state === 'potrun';
    const mustRun = alreadyRunning || !u.propId || (u.spd || 0) > 0.6 ||
      ai.hitBurst >= (ai.nerveHits || 2) || hpRatio < 0.62 || shooterDist < 2.6;
    if (!mustRun) return;

    ai.compromisedPropId = u.propId || null;
    ai.potGoal = null;

    if (u.specialMode) {
      env.exitSpecialSpot(h, false);
    }
    if (ai.slot) {
      ai.slot.taken = null;
      ai.slot = null;
    }

    if (u.propId && (u.speedMul || 1) < 0.88 && ai.transformCd <= 0) {
      env.undisguise(h);
      ai.transformCd = 1.4;
    }

    if (ai.state !== 'evade' || ai.escapeReplanT <= 0) {
      ai.state = 'evade';
      ai.escapeGoal = pickEscapePlan(h, shooter);
      ai.escapeReplanT = 1.6;
      resetBotProgress(h, ai);
      env.audio.scurry(h.position.x, h.position.z);
    }
  }

  function updateHiderBot(h, dt, allChars) {
    const u = h.userData;
    const ai = u.ai;
    if (!ai) return;

    if (u.actor?.eliminated || ai.state === 'eliminated') {
      ai.anim += dt;
      h.position.y = (u.groundY || 0) + Math.sin(Math.min(1, ai.anim * 2) * Math.PI) * 0.85 + ai.anim * 0.42;
      u.shrink = Math.max(0.01, 1 - Math.max(0, ai.anim - 0.8) * 1.5);
      if (ai.anim > 1.65) h.visible = false;
      return;
    }

    if (env.G.over || u.actor?.isRemote) return;

    if (ai.spawnDelay > 0) {
      ai.spawnDelay -= dt;
      return;
    }
    if (!ai.didStartHop) {
      ai.didStartHop = true;
      if ((u.jy || 0) <= 0.05) env.doCharJump(h, 6.9);
    }

    if (ai.prevState !== ai.state) {
      ai.prevState = ai.state;
      resetBotProgress(h, ai);
    }
    ai.stateTimer = (ai.stateTimer || 0) + dt;

    const now = getNow();
    ai.transformCd = Math.max(0, (ai.transformCd || 0) - dt);

    // Fair HP regeneration when out of the line of fire for 3.0s (identical to human player!)
    if (ai.hp < ai.maxHp && now - ai.lastHitAt > 3000) {
      ai.hp = Math.min(ai.maxHp, ai.hp + 18 * dt);
    }

    const hc = env.centerOf(h);
    let nearestSeeker = null, nearestSeekerDist = 999, anySeekerLOS = false, chaserSeeker = null;
    const huntActive = env.G.phase === 'survive' || env.G.phase === 'seek';

    if (huntActive) {
      ai._losTick = ((ai._losTick ?? (u.actor?.slotIdx || 0)) + 1) | 0;
      const doFreshLos = (ai._losTick % 3 === 0) || ai._cachedAnySeekerLOS === undefined;
      for (const s of (env.G.allSeekers || [])) {
        if (!s) continue;
        const d = Math.hypot(s.position.x - h.position.x, s.position.z - h.position.z);
        if (d < nearestSeekerDist) {
          nearestSeekerDist = d;
          nearestSeeker = s;
        }
        if (s.userData?.ai?.target === h && s.userData?.ai?.state === 'chase') {
          chaserSeeker = s;
        }
        if (!anySeekerLOS && d < 23 && (doFreshLos || d < 4.5)) {
          const sEye = s === env.G.player && env.G.mode === 'seek'
            ? env.camera.position
            : _tmpV1.set(s.position.x, (s.userData.groundY || 0) + 1.32, s.position.z);
          let inFov = true;
          if (s === env.G.player && env.G.mode === 'seek') {
            _tmpV2.set(0, 0, -1).applyQuaternion(env.camera.quaternion);
            inFov = _tmpV2.dot(_tmpV3.copy(hc).sub(sEye).normalize()) > 0.45;
          } else {
            const head = s.rotation.y;
            const ang = Math.atan2(hc.x - sEye.x, hc.z - sEye.z);
            inFov = Math.abs(normAng(ang - head)) < 1.15 || d < 2.5;
          }
          if (inFov && env.lineOfSight(sEye, hc)) {
            anySeekerLOS = true;
          }
        }
      }
      if (doFreshLos || nearestSeekerDist < 4.5) {
        ai._cachedAnySeekerLOS = anySeekerLOS;
      } else {
        anySeekerLOS = !!ai._cachedAnySeekerLOS;
      }
    }

    if (huntActive && chaserSeeker && (ai.state === 'hidden' || ai.state === 'potrun') && nearestSeekerDist < 8.5 && anySeekerLOS) {
      ai.potGoal = null;
      if (u.specialMode) env.exitSpecialSpot(h, false);
      ai.state = 'evade';
      ai.compromisedPropId = u.propId || null;
      ai.escapeGoal = pickEscapePlan(h, chaserSeeker);
      ai.escapeReplanT = 1.5;
      resetBotProgress(h, ai);
    }

    // Active Counterplay: if a Seeker gets within 3.6m while chasing/near a Hider bot, pop a Boop-Stun!
    if (huntActive && nearestSeeker && nearestSeekerDist < 3.6 && (ai.state === 'evade' || !u.propId) && now > (ai._boopBotCdUntil || 0)) {
      ai._boopBotCdUntil = now + 13500;
      if (env.triggerBoopOrBait) env.triggerBoopOrBait(h);
    }

    // Hero Rescue Instinct: if an ally is trapped in a Bubble Cage within 22m and no Seeker is camping right on top, sprint to rescue!
    if (huntActive && (ai.state === 'hidden' || ai.state === 'scramble') && env.getActiveBubbleCages) {
      const cages = env.getActiveBubbleCages() || [];
      let bestCage = null, bestCageD = 22.0;
      for (const cg of cages) {
        if (!cg || !cg.ch || cg.ch === h || cg.timeLeft < 1.2) continue;
        const dAlly = Math.hypot(cg.ch.position.x - h.position.x, cg.ch.position.z - h.position.z);
        if (dAlly >= bestCageD) continue;
        const seekerNearBubble = (env.G.allSeekers || []).some((sk) =>
          sk && !sk.userData?.actor?.eliminated && Math.hypot(sk.position.x - cg.ch.position.x, sk.position.z - cg.ch.position.z) < 4.5
        );
        if (!seekerNearBubble) {
          bestCage = cg;
          bestCageD = dAlly;
        }
      }
      if (bestCage) {
        if (u.specialMode) env.exitSpecialSpot(h, false);
        const rescueGoal = { x: bestCage.ch.position.x, y: bestCage.baseY ?? 0, z: bestCage.ch.position.z };
        steerSmart(h, rescueGoal, 5.4, dt, { allChars, allowJump: true, eagerJump: true });
        return;
      }
    }

    // GTA 6 Partner Prompt Obedience: respond to living teammates' 3D Squad Pings!
    if (huntActive && env.getActiveSquadPingForTeam) {
      const hPing = env.getActiveSquadPingForTeam('hiders');
      if (hPing && hPing.pos && hPing.t < 6.5) {
        const dPing = Math.hypot(hPing.pos.x - h.position.x, hPing.pos.z - h.position.z);
        if (hPing.kind === 'rescue' && dPing > 2.0 && dPing < 26.0 && (ai.state === 'hidden' || ai.state === 'scramble')) {
          if (u.specialMode) env.exitSpecialSpot(h, false);
          steerSmart(h, hPing.pos, 5.4, dt, { allChars, allowJump: true, eagerJump: true });
          return;
        }
        if (hPing.kind === 'danger' && dPing < 9.5 && ai.state === 'scramble' && ai._handledDangerPing !== hPing) {
          ai._handledDangerPing = hPing;
          ai.plan = null; // replan away from pinged Seeker threat
        }
      }
    }

    // ------------------------------------------------------------------------
    // STATE 1: SCRAMBLE (Run to smart hiding spot, with 2.2s progress watchdog!)
    // ------------------------------------------------------------------------
    if (ai.state === 'scramble') {
      if (!ai.plan) {
        ai.plan = pickSmartHidingPlan(h);
        ai.perchStage = 0;
        ai.scrambleT = 0;
        resetBotProgress(h, ai);
      }
      ai.scrambleT = (ai.scrambleT || 0) + dt;

      // Progress watchdog: if stalled for 1.8s, wall-blocked, or > 8.5s total -> replan immediately!
      const stalledScramble = checkProgressStalled(h, ai, dt, 1.8, 0.70) || Boolean(u.nav?.goalBlocked);
      if ((stalledScramble || ai.scrambleT > 8.5) && ai.plan && Math.hypot(ai.plan.x - h.position.x, ai.plan.z - h.position.z) > 1.35) {
        const prevSpot = { x: ai.plan.x, z: ai.plan.z };
        if (!ai.failedSpots) ai.failedSpots = [];
        ai.failedSpots.push({ x: prevSpot.x, z: prevSpot.z, exp: now + 25000 });
        if (ai.slot) {
          ai.slot.taken = null;
          ai.slot = null;
        }
        ai.scrambleRetries = (ai.scrambleRetries || 0) + 1;
        ai.plan = pickSmartHidingPlan(h, { emergency: ai.scrambleRetries >= 2, avoidPos: prevSpot });
        ai.perchStage = 0;
        ai.scrambleT = 0;
        resetBotProgress(h, ai);
      }

      const urgent = (env.G.mode === 'hide' && env.G.phase === 'hide' && env.G.t < 3.2) ||
        (huntActive && nearestSeekerDist < 15.5);
      if (urgent && !u.propId && !u.specialMode && ai.transformCd <= 0) {
        const nearProp = env.realProps.reduce((best, r) => {
          const d = Math.hypot(r.pos.x - h.position.x, r.pos.z - h.position.z);
          return (!best || d < best.d) ? { r, d } : best;
        }, null);
        const fallbackId = (nearProp && nearProp.d < 8 && nearProp.r.id) || ai.plan?.propId || (env.realProps[0] && env.realProps[0].id);
        if (fallbackId) applyAIDisguise(h, fallbackId, nearProp ? nearProp.r.g.rotation.y : h.rotation.y);
        if (huntActive && anySeekerLOS) {
          ai.state = 'hidden';
          return;
        }
      }

      if (!ai.plan) {
        ai.state = 'hidden';
        return;
      }

      const plan = ai.plan;
      const distToSpot = Math.hypot(plan.x - h.position.x, plan.z - h.position.z);
      if (plan.propId && u.propId !== plan.propId && plan.kind !== 'special' && distToSpot < 5.2 && !anySeekerLOS && ai.transformCd <= 0) {
        applyAIDisguise(h, plan.propId, plan.rot);
      }

      // Parkour Perch 2-stage approach -> jump onto table/crate!
      if (plan.kind === 'perch') {
        if (ai.perchStage === 0) {
          const dApp = Math.hypot(plan.approach.x - h.position.x, plan.approach.z - h.position.z);
          if (dApp > 0.48) {
            const sp = (u.propId ? 4.2 : 4.8) * (u.speedMul || 1) * 1.38;
            steerSmart(h, plan.approach, sp, dt, { allChars, allowJump: true });
            if (!u.propId) h.rotation.y = lerpAngle(h.rotation.y, u.nav?.face ?? h.rotation.y, dt * 10);
            return;
          }
          if (plan.propId && u.propId !== plan.propId) applyAIDisguise(h, plan.propId, plan.rot);
          ai.perchStage = 1;
          ai.perchTimer = 1.5;
          env.doCharJump(h, 7.85);
        }
        ai.perchTimer = (ai.perchTimer || 1.5) - dt;
        const dx = plan.x - h.position.x, dz = plan.z - h.position.z, dTop = Math.hypot(dx, dz);
        if (dTop > 0.24 && ai.perchTimer > 0) {
          const ang = Math.atan2(dx, dz);
          const step = Math.min(dTop, 4.4 * dt);
          env.moveChar(h, Math.sin(ang) * step, Math.cos(ang) * step);
          return;
        }
        if (!u.propId && plan.propId) applyAIDisguise(h, plan.propId, plan.rot);
        h.rotation.y = plan.rot;
        ai.state = 'hidden';
        ai.scrambleRetries = 0;
        ai.stillT = 0;
        return;
      }

      // Navigate to backyard wall tuck / slot / indoor nook / special spot trigger
      const arriveRadius = plan.kind === 'special' ? 1.15 : (plan.kind === 'backyard' ? 0.48 : 0.38);
      if (distToSpot > arriveRadius) {
        const kitRef = env.getKit ? env.getKit() : null;
        const canFlyBird = !!(u.propId && kitRef?.props?.[u.propId]?.canFly);
        u.aiBirdClimb = canFlyBird && distToSpot > 5.5 && (u.groundY || 0) >= -0.4 && (u.jy || 0) < 6.5 && (u.birdStamina ?? 1) > 0.28;
        const sprintMul = (env.G.phase === 'ready') ? 1.92 : 1.40;
        const trickMul = env.getHiderSpeedMul ? env.getHiderSpeedMul(h) : 1;
        const sp = (u.propId ? 4.2 : 4.8) * (u.speedMul || 1) * sprintMul * trickMul;
        steerSmart(h, plan, sp, dt, { allChars, allowJump: !canFlyBird });
        if (!u.propId && !u.specialMode) {
          h.rotation.y = lerpAngle(h.rotation.y, u.nav?.face ?? h.rotation.y, dt * 10);
        }
        return;
      }
      u.aiBirdClimb = false;

      if (plan.kind === 'special' && plan.specialSpot) {
        const sp = plan.specialSpot;
        if (!sp.occupiedBy || sp.occupiedBy === h || sp.occupiedBy.userData?.actor?.eliminated) {
          env.enterSpecialSpot(h, sp, env.G.phase === 'ready');
          ai.state = 'hidden';
          ai.scrambleRetries = 0;
          ai.stillT = 0;
          return;
        }
        ai.plan = pickSmartHidingPlan(h, { emergency: true });
        resetBotProgress(h, ai);
        return;
      }

      if (plan.propId && u.propId !== plan.propId) {
        applyAIDisguise(h, plan.propId, plan.rot);
      }
      if (!env.blockedAt(plan.x, plan.z, 0.30, plan.y)) {
        h.position.x = plan.x;
        h.position.z = plan.z;
        u.groundY = env.groundHeightAt(plan.x, plan.z, plan.y);
      }
      if (typeof plan.rot === 'number') h.rotation.y = plan.rot;
      ai.state = 'hidden';
      ai.scrambleRetries = 0;
      ai.stillT = rand(0, 3);
      return;
    }

    // ------------------------------------------------------------------------
    // STATE 2: HIDDEN (Hold iron nerve, manage 27s Spirit Chime, sneak-relocate)
    // ------------------------------------------------------------------------
    if (ai.state === 'hidden') {
      u.aiBirdClimb = false;
      if (!u.propId && !u.specialMode && ai.transformCd <= 0) {
        const nearP = env.realProps[0];
        if (nearP) applyAIDisguise(h, nearP.id, nearP.g.rotation.y);
      }

      if (!huntActive) return;

      if (ai.shimmyT > 0) {
        ai.shimmyT -= dt;
        const a = getNow() * 0.018;
        const sx = Math.cos(a) * 1.4 * dt, sz = Math.sin(a) * 1.4 * dt;
        if (!u.specialMode) env.moveChar(h, sx, sz);
        ai.stillT = 0;
        return;
      }

      ai.stillT = (ai.stillT || 0) + dt;

      // The same forced "spirit giggle" rhythm human hiders live with (every 35s), wherever the seekers are.
      ai.giggleT = (ai.giggleT ?? rand(14, 34)) - dt;
      if (ai.giggleT <= 0) {
        ai.giggleT = 35.0;
        env.ripple(h.position, 1.3);
        emitSoundCue(h.position, 17.5, 'chime', h);
        if (env.G.player && h.position.distanceTo(env.G.player.position) < 17) {
          env.audio.tap();
          if (env.G.mode === 'seek') {
            env.hint('🔔 Faint spirit chime echoed nearby…!', 1700);
          }
        }
      }

      if (ai.stillT > 15.0 && !anySeekerLOS && nearestSeekerDist > 10.5) {
        // Coast is clear: risk a dash for a Paint Pot (fresh coat + squad points)?
        const pot = (!u.specialMode && env.getNearestPot)
          ? env.getNearestPot({ x: h.position.x, y: u.groundY || 0, z: h.position.z }, 15)
          : null;
        if (pot && Math.random() < dLerp(0.35, 0.7)) {
          ai.state = 'potrun';
          ai.potGoal = { x: pot.x, y: pot.y, z: pot.z, id: pot.id };
          if (ai.slot) { ai.slot.taken = null; ai.slot = null; }
          ai.stillT = 0;
          resetBotProgress(h, ai);
          return;
        }
        if (!u.specialMode && Math.random() < 0.28) {
          ai.plan = pickSmartHidingPlan(h);
          if (ai.plan) {
            ai.state = 'scramble';
            ai.stillT = 0;
            resetBotProgress(h, ai);
            return;
          }
        }
        ai.shimmyT = 0.36;
        ai.stillT = 0;
        return;
      }

      return;
    }

    // ------------------------------------------------------------------------
    // STATE 2b: POT RUN (leave cover for a Paint Pot, then find a new hiding spot)
    // ------------------------------------------------------------------------
    if (ai.state === 'potrun') {
      const g = ai.potGoal;
      const gone = !g || (env.isPotActive && !env.isPotActive(g.id));
      const stalledPot = checkProgressStalled(h, ai, dt, 1.8, 0.7);
      if (gone || stalledPot || ai.stateTimer > 8.0 || (anySeekerLOS && nearestSeekerDist < 9.0)) {
        ai.potGoal = null;
        ai.plan = pickSmartHidingPlan(h, { emergency: anySeekerLOS });
        ai.perchStage = 0;
        ai.scrambleT = 0;
        ai.state = 'scramble';
        resetBotProgress(h, ai);
        return;
      }
      const trickMulPot = env.getHiderSpeedMul ? env.getHiderSpeedMul(h) : 1;
      const spPot = (u.propId ? 4.2 : 4.8) * (u.speedMul || 1) * 1.3 * trickMulPot;
      steerSmart(h, g, spPot, dt, { allChars, allowJump: true });
      if (!u.propId && !u.specialMode) {
        h.rotation.y = lerpAngle(h.rotation.y, u.nav?.face ?? h.rotation.y, dt * 10);
      }
      return;
    }

    // ------------------------------------------------------------------------
    // STATE 3: EVADE (Sprint, juke weave, parkour jump over chairs, break LOS -> morph!)
    // ------------------------------------------------------------------------
    if (ai.state === 'evade') {
      ai.escapeReplanT -= dt;
      if (!anySeekerLOS) ai.unseenT += dt;
      else ai.unseenT = 0;

      if (ai.unseenT >= 1.15 && nearestSeekerDist > 6.5 && ai.transformCd <= 0) {
        const nextPlan = pickSmartHidingPlan(h, { avoidPropId: ai.compromisedPropId, emergency: nearestSeekerDist < 13 });
        let freshProp = null, bestD = 12.5;
        for (const rp of env.realProps) {
          if (rp.id === ai.compromisedPropId) continue;
          const d = Math.hypot(rp.pos.x - h.position.x, rp.pos.z - h.position.z);
          if (d < bestD) { bestD = d; freshProp = rp; }
        }
        if (freshProp) {
          applyAIDisguise(h, freshProp.id, freshProp.g.rotation.y);
        } else if (nextPlan && nextPlan.propId && nextPlan.propId !== ai.compromisedPropId) {
          applyAIDisguise(h, nextPlan.propId, nextPlan.rot);
        }
        ai.plan = nextPlan;
        ai.state = 'scramble';
        ai.compromisedPropId = null;
        ai.unseenT = 0;
        resetBotProgress(h, ai);
        return;
      }

      const evadeStalled = checkProgressStalled(h, ai, dt, 1.6, 0.80);
      if (evadeStalled || !ai.escapeGoal || ai.escapeReplanT <= 0 || Math.hypot(ai.escapeGoal.x - h.position.x, ai.escapeGoal.z - h.position.z) < 1.6) {
        ai.escapeGoal = pickEscapePlan(h, chaserSeeker || nearestSeeker);
        ai.escapeReplanT = 1.8;
      }

      const underFire = now - ai.lastHitAt < 650 && anySeekerLOS;
      if (underFire && (u.jy || 0) <= 0.05 && (!u.nav || u.nav.jumpCd <= 0) && Math.random() < dt * 2.2) {
        env.doCharJump(h, 7.6);
        if (u.nav) u.nav.jumpCd = 1.15;
      }

      if (ai.escapeGoal) {
        const disguised = !!(u.propId || u.specialMode);
        const kitRef = env.getKit ? env.getKit() : null;
        const canFlyBird = !!(u.propId && kitRef?.props?.[u.propId]?.canFly);
        u.aiBirdClimb = canFlyBird && (u.groundY || 0) >= -0.4 && (u.jy || 0) < 7.2 && (u.birdStamina ?? 1) > 0.20;
        const airBoost = u.gliding && (u.jy || 0) > 0.1 ? 1.26 : ((u.jy || 0) > 0.08 ? 1.08 : 1);
        const trickMul = env.getHiderSpeedMul ? env.getHiderSpeedMul(h) : 1;
        // gentle-skill bot hiders run a little slower, so a new player's chase actually ends in a soak
        const sp = (disguised ? 4.2 : 4.8) * (u.speedMul || 1) * airBoost * dLerp(1.15, 1.38) * trickMul;
        steerSmart(h, ai.escapeGoal, sp, dt, {
          allChars,
          allowJump: !canFlyBird,
          eagerJump: !canFlyBird,
          weaveAmp: (anySeekerLOS && nearestSeekerDist < 13) ? 0.34 : 0,
        });
        if (!disguised) {
          h.rotation.y = lerpAngle(h.rotation.y, u.nav?.face ?? h.rotation.y, dt * 11);
        }
        if (Math.random() < dt * 2.8) {
          emitSoundCue(h.position, disguised ? 5.2 : 9.5, 'sprint', h);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // AI Seeker Independent Brains, Sound Hearing, Exploration & Pursuit
  // --------------------------------------------------------------------------
  function propSignature(id, x, y, z) {
    const qx = Math.round(x * 1.25), qy = Math.round((y || 0) * 1.5), qz = Math.round(z * 1.25);
    return `${id}@${qx},${qy},${qz}`;
  }
  function cellSignature(x, y, z) {
    return `${Math.round(x / 6)},${Math.round((y || 0) / 2.2)},${Math.round(z / 6)}`;
  }

  // Records sighting on active pursuit tracker AND stores fugitive propId ONLY in spotter's own memory!
  function recordSighting(spotter, hider, vel, now = getNow()) {
    let rec = TEAM_INTEL.sightings.get(hider);
    if (!rec) {
      rec = { pos: hider.position.clone(), vel: new THREE.Vector3(), propId: null, t: now, spotter, chasers: new Set() };
      TEAM_INTEL.sightings.set(hider, rec);
    }
    rec.pos.copy(hider.position);
    rec.pos.y = hider.userData.groundY ?? 0;
    if (vel) rec.vel.copy(vel);
    rec.propId = hider.userData.propId || null;
    rec.t = now;
    rec.spotter = spotter;

    // Private fugitive disguise memory ONLY for the spotter personally (no map-wide telepathy!)
    const sai = spotter && spotter.userData && spotter.userData.ai;
    if (sai && sai.knownFugitiveProps && hider.userData.propId) {
      sai.knownFugitiveProps.set(hider, { propId: hider.userData.propId, t: now });
    }
  }

  function initSeekerBot(s, idx = 0, setMarkFn) {
    const prevMark = s.userData?.ai?.mark || null;
    const deck = TEAM_INTEL.seekerDeck && TEAM_INTEL.seekerDeck.length ? TEAM_INTEL.seekerDeck : SEEKER_ARCHETYPES;
    const archetype = deck[idx % deck.length];
    const cfg = ARCHETYPE_CONFIG[archetype] || ARCHETYPE_CONFIG.backyard_hound;

    s.userData.ai = {
      archetype,
      style: archetype,
      slotIdx: idx,
      state: 'patrol',        // 'patrol' | 'investigate' | 'search' | 'chase' | 'flank'
      prevState: 'patrol',
      // Private per-bot memory & personality (zero shared hive-mind!)
      personalVisited: new Map(),     // nodeId -> timestamp
      blacklistedNodes: new Map(),    // nodeId -> expireTimestamp
      heardSoundIds: new Set(),       // monotonic sound event IDs
      pendingSound: null,             // { ev, reactT, flankSign, goal, isHighAlert }
      knownFugitiveProps: new Map(),  // hider -> { propId, t } (personal or <=18m vocal callout only!)
      orbitDir: idx % 2 === 0 ? 1 : -1,
      homeAngle: (idx / TEAM_SIZE) * Math.PI * 2 + rand(-0.3, 0.3),
      sectorBiasAngle: null,
      sectorBiasUntil: 0,
      paceMul: rand(0.95, 1.09),
      earshotMul: cfg.earshotMul,
      reactionDelay: rand(cfg.reactionRange[0], cfg.reactionRange[1]) * dLerp(1.7, 0.8),
      tank: HUE_RULES.BOT_TANK_MAX,
      lastShotAt: -1e9,
      refillWell: null,
      hitMemo: new Map(),
      shotsPerCand: cfg.shotsPerCand,
      // Visual perception & spatial memory
      susMap: new Map(),
      velMap: new Map(),
      lastPosMap: new Map(),
      knownProps: new Set(),
      memorizedCells: new Set(),
      snapshotTimer: rand(0.15, 0.65),
      // Active state & pursuit tracking
      target: null,
      goal: null,
      zoneKey: null,
      scan: rand(0, 6.28),
      shootCd: 0,
      firingT: 0,
      burstN: 0,
      react: 0,
      seenT: 0,
      lostT: 0,
      sc: null,
      sr: 7,
      sp: null,
      searchReason: 'patrol',
      searchT: 0,
      checked: new Set(),
      cand: null,
      candLeft: 4,
      sprayT: 0,
      wanderChecks: 0,
      investigateHighAlert: false,
      investigatePriority: 0,
      investigateOrigin: null,
      glanceYaw: null,
      glanceT: 0,
      lookAt: null,
      calloutCd: 0,
      huntElapsed: 0,
      // a breath after touchdown before the hunt really starts (longer for gentle bots) — nobody gets soaked in second one
      releaseDelay: rand(0.9, 2.1) * dLerp(1.5, 0.7),
      didReleaseHop: Math.random() >= 0.30,
      stateTimer: 0,
      progressTimer: 0,
      progressRefPos: s.position.clone(),
      goalDistRef: null,
      goalDistTimer: 0,
      mark: prevMark,
      setMark: setMarkFn,
    };
    if (setMarkFn) setMarkFn(s, null);
  }

  // Independent Patrol Node Selector using private personalVisited, archetype affinities,
  // live 13m peer separation (both position & goal!), and weighted Top-4 choice.
  function pickSmartPatrolZone(s) {
    const ai = s.userData.ai;
    const cfg = ARCHETYPE_CONFIG[ai.archetype] || ARCHETYPE_CONFIG.backyard_hound;
    const now = getNow();
    const MAPR = env.getMapRadius();
    const nodes = getMapExplorationNodes();

    if (!nodes.length) {
      return snapToWalkableGoal(rand(-10, 10), rand(-10, 10), s.userData.groundY);
    }

    const curAng = Math.atan2(s.position.z, s.position.x);
    const allSeekers = env.G.allSeekers || env.G.seekers || [];
    const localPlayer = env.G.mode === 'seek' ? env.G.player : null;

    const scored = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      // Skip temporarily blacklisted stalled/unreachable nodes for this bot
      const blkExp = ai.blacklistedNodes.get(n.id);
      if (blkExp != null) {
        if (now < blkExp) continue;
        ai.blacklistedNodes.delete(n.id);
      }

      const distMe = Math.hypot(n.pos.x - s.position.x, n.pos.z - s.position.z);
      let cost = distMe * 0.052 + rand(0, 1.05);
      if (distMe < 3.4) cost += 6.5;

      // 1. Personal memory freshness + strong priority for unvisited backyards, rooms & perimeters!
      const lastVis = ai.personalVisited.get(n.id);
      if (lastVis == null) {
        if (n.kind === 'backyard') cost -= (n.occluded ? 3.2 : 2.65);
        else if (n.kind === 'indoor') cost -= (n.deep ? 2.85 : 2.45);
        else if (n.kind === 'perimeter') cost -= 2.15;
        else if (n.kind === 'special') cost -= 1.95;
        else if (n.kind === 'perch') cost -= 1.75;
        else cost -= 0.40; // obvious central vignettes have lowest unvisited priority!
      } else {
        const ageSec = clamp((now - lastVis) / 1000, 0, 85);
        if (ageSec < 32) cost += (32 - ageSec) * 0.36;
        else cost -= (ageSec - 32) * 0.065;
      }

      // 2. Archetype personality preference
      cost += (cfg.nodeBias[n.kind] ?? 0);
      if (ai.archetype === 'parkour_scout' && n.pos.y > 1.65) {
        cost -= 1.45;
      }
      if (ai.archetype === 'roamer') {
        const nodeAng = Math.atan2(n.pos.z, n.pos.x);
        const dAng = normAng((nodeAng - curAng) * ai.orbitDir);
        const rad = Math.hypot(n.pos.x, n.pos.z);
        if (dAng > 0.15 && dAng < 1.90 && rad > 0.36 * MAPR) {
          cost -= 2.05;
        }
      }

      // 3. Home sector spread at match start + distant whistle directional bias for 3rd+ seekers
      const nodeAng = Math.atan2(n.pos.z, n.pos.x);
      if (now < ai.sectorBiasUntil && ai.sectorBiasAngle != null) {
        cost -= 2.35 * Math.max(0, Math.cos(nodeAng - ai.sectorBiasAngle));
      } else if ((ai.huntElapsed || 0) < 20) {
        cost -= 1.55 * Math.max(0, Math.cos(nodeAng - ai.homeAngle));
      }

      // 4. Dynamic live peer separation: strongly penalize within 13m of any other seeker's pos OR goal!
      for (let j = 0; j < allSeekers.length; j++) {
        const other = allSeekers[j];
        if (!other || other === s) continue;
        const dPos = Math.hypot(n.pos.x - other.position.x, n.pos.z - other.position.z);
        if (dPos < 13.0) cost += (13.0 - dPos) * 1.15;

        const oGoal = other.userData?.ai?.goal;
        if (oGoal) {
          const dGoal = Math.hypot(n.pos.x - oGoal.x, n.pos.z - oGoal.z);
          if (dGoal < 13.0) cost += (13.0 - dGoal) * 1.15;
        }
      }

      // Lightly bias AI teammates away from standing on top of the human seeker within 9m
      if (localPlayer && localPlayer !== s) {
        const dp = Math.hypot(n.pos.x - localPlayer.position.x, n.pos.z - localPlayer.position.z);
        if (dp < 9.0) cost += (9.0 - dp) * 1.10;
      }

      scored.push({ node: n, cost });
    }

    if (!scored.length) {
      ai.blacklistedNodes.clear();
      const fb = pick(nodes);
      ai.zoneKey = fb.id;
      return snapToWalkableGoal(fb.pos.x, fb.pos.z, fb.pos.y, 2.2);
    }

    scored.sort((a, b) => a.cost - b.cost);
    const chosenEntry = pickWeightedTopK(scored, 4, (it) => -it.cost);
    const chosen = chosenEntry.node;

    TEAM_INTEL.claimedZones.set(s, chosen.id);
    ai.zoneKey = chosen.id;

    return snapToWalkableGoal(
      chosen.pos.x + rand(-0.65, 0.65),
      chosen.pos.z + rand(-0.65, 0.65),
      chosen.pos.y,
      2.2
    );
  }

  // Fair visual-deduction candidate picker during search sweeps (inspects realProps, Decoy Clones & Hiders!)
  function pickNextSpyCandidate(s) {
    const ai = s.userData.ai;
    if (ai.candLeft <= 0 || !ai.sc) return null;
    const KIT = env.getKit();
    const sEye = new THREE.Vector3(s.position.x, (s.userData.groundY || 0) + 1.28, s.position.z);
    const isSoundSweep = ai.searchReason === 'sound';
    const memBonus = ai.archetype === 'detective' ? 3.0 : 2.4;

    const candidates = [];

    const evaluateVisualProp = (key, getPosFn, posNow, propId, rotY, height, isSpecialSpot = false, isAliveFn = null) => {
      if (!posNow || ai.checked.has(key)) return;
      const d = Math.hypot(posNow.x - ai.sc.x, posNow.z - ai.sc.z);
      if (d > ai.sr) return;
      const dy = Math.abs((posNow.y || 0) - (ai.sc.y || s.userData.groundY || 0));
      if (dy > 2.8) return;

      const proxFrac = Math.max(0, 1 - d / Math.max(1, ai.sr));
      let sc = proxFrac * 0.65 + rand(0, 0.72);

      // Sound Sweep Boost: whistling/giggling hiders WILL have nearby aligned, tucked & perched props checked!
      if (isSoundSweep) {
        sc += 1.65 * proxFrac;
      }

      // 1. Matches the prop type of a fugitive hider who vanished nearby!
      if (ai.sp && propId === ai.sp) sc += 2.6;

      const isAnimalProp = !!(propId && KIT?.props?.[propId]?.isAnimal);

      // 2. Private Spatial Memory: "Wait — I walked through this exact cell earlier and that prop wasn't here!"
      // (Living farm animals naturally wander across grass cells, so don't flag them on static cell memory!)
      const cell = cellSignature(posNow.x, posNow.y, posNow.z);
      if (propId && !isAnimalProp && ai.memorizedCells.has(cell)) {
        const sig = propSignature(propId, posNow.x, posNow.y, posNow.z);
        if (!ai.knownProps.has(sig)) sc += memBonus;
      }

      // 3. Pure Visual Context Heuristics (identical for real props, Decoy Clones & disguised hiders!)
      if (isSpecialSpot) {
        sc += ai.sp ? 0.65 : (ai.archetype === 'parkour_scout' ? 0.85 : 0.42);
      } else if (isAnimalProp) {
        const inBuilding = !!(env.ENTER.length && env.whereIs(posNow.x, posNow.z, posNow.y || 0));
        const hasHerdMate = env.realProps.some((r) => r.pos !== posNow && r.id === propId && Math.hypot(r.pos.x - posNow.x, r.pos.z - posNow.z) < 9.5);
        if (inBuilding) sc += 1.55; // "Wait — why is there a farm animal inside the cottage?!"
        else if (!hasHerdMate && isSoundSweep) sc += 0.45;
        else if (!isSoundSweep && !ai.sp) sc -= 0.38; // Grazing peacefully with the herd
      } else if (propId) {
        const matchSlot = env.SLOTS.find((q) => q.id === propId && Math.hypot(q.x - posNow.x, q.z - posNow.z) < 0.72);
        if (!matchSlot) {
          const floorY = env.groundHeightAt(posNow.x, posNow.z, (posNow.y || 0) - 0.5);
          if ((posNow.y || 0) - floorY > 0.36) sc += (ai.archetype === 'parkour_scout' || ai.archetype === 'detective' ? 1.15 : 0.9);
          const hasTwinNearby = env.realProps.some((r) => r.pos !== posNow && r.id === propId && Math.hypot(r.pos.x - posNow.x, r.pos.z - posNow.z) < 4.2);
          sc += hasTwinNearby ? 0.28 : 0.98;
        } else if (!env.ROUND_PROPS.has(propId) && Math.abs(normAng(matchSlot.rot - (rotY || 0))) > 0.42) {
          sc += 0.95;
        }
      }

      const tgtCenter = new THREE.Vector3(posNow.x, (posNow.y || 0) + height * 0.5, posNow.z);
      if (env.lineOfSight(sEye, tgtCenter)) sc += 0.35;

      if (sc > 0.52) {
        candidates.push({ key, pos: getPosFn, h: height, score: sc, isAlive: isAliveFn });
      }
    };

    // A) Inspect real static props in search radius
    for (const r of env.realProps) {
      const pd = KIT.props[r.id];
      evaluateVisualProp(r, () => r.pos, r.pos, r.id, r.g.rotation.y, (pd && pd.height) || 0.95, false, null);
    }

    // B) Inspect active Hider Decoy Clones using the EXACT SAME anonymous visual rules!
    const activeDecoys = env.getActiveDecoys ? (env.getActiveDecoys() || []) : [];
    for (let i = 0; i < activeDecoys.length; i++) {
      const dec = activeDecoys[i];
      if (!dec) continue;
      const dp = dec.pos || dec.position || dec.root?.position || dec.mesh?.position;
      if (!dp) continue;
      const dRot = dec.rotY ?? dec.rot ?? dec.root?.rotation?.y ?? dec.mesh?.rotation?.y ?? 0;
      const pd = dec.propId ? KIT.props[dec.propId] : null;
      const dHeight = dec.height || (pd && pd.height) || 0.95;
      evaluateVisualProp(
        dec,
        () => dec.pos || dec.position || dec.root?.position || dec.mesh?.position || dp,
        dp,
        dec.propId || null,
        dRot,
        dHeight,
        false,
        () => {
          const curList = env.getActiveDecoys ? (env.getActiveDecoys() || []) : [];
          return curList.indexOf(dec) >= 0;
        }
      );
    }

    // C) Inspect disguised living hiders using the EXACT SAME anonymous visual rules!
    for (const h of (env.G.allHiders || [])) {
      if (!h || h.userData?.actor?.eliminated) continue;
      const hu = h.userData;
      if (!hu.propId && !hu.specialMode) continue;
      const effY = (hu.groundY || 0) + (hu.specialY || 0);
      const posNow = { x: h.position.x, y: effY, z: h.position.z };
      evaluateVisualProp(
        h,
        () => ({ x: h.position.x, y: (hu.groundY || 0) + (hu.specialY || 0), z: h.position.z }),
        posNow,
        hu.propId,
        h.rotation.y,
        hu.height || 0.85,
        !!hu.specialMode,
        () => !h.userData?.actor?.eliminated
      );
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    const picked = pickWeightedTopK(candidates, 3, (c) => c.score);
    if (!picked) return null;
    ai.checked.add(picked.key);
    ai.candLeft--;
    return picked;
  }

  function seekerShootWater(s, tgtPoint, tgtVel, err) {
    const sai = s.userData.ai;
    if (sai && !env.G.isTutorial) {
      const cost = HUE_RULES.SHOT_COST * (env.isOvertime && env.isOvertime() ? HUE_RULES.FRENZY_COST_MUL : 1);
      const tank = sai.tank ?? HUE_RULES.BOT_TANK_MAX;
      if (tank < cost) { sai.tank = 0; return false; }
      sai.tank = tank - cost;
      sai.lastShotAt = getNow();
    }
    const eye = new THREE.Vector3(s.position.x, (s.userData.groundY || 0) + 1.18 + (s.userData.jy || 0), s.position.z);
    const SPD = 26.5;
    const GRAV = 9;
    const u = s.userData;
    u.aim = true;
    u.aimUntil = getNow() + 460;

    let launchFrom = eye.clone();
    if (u.nozzle) {
      s.updateWorldMatrix(true, true);
      launchFrom = u.nozzle.getWorldPosition(new THREE.Vector3());
    }

    const dist = tgtPoint.distanceTo(launchFrom);
    const flightT = dist / SPD;
    const aim = tgtPoint.clone();
    if (tgtVel) {
      aim.x += clamp(tgtVel.x, -7, 7) * flightT * 0.88;
      aim.z += clamp(tgtVel.z, -7, 7) * flightT * 0.88;
      aim.y += clamp(tgtVel.y || 0, -4, 5) * flightT * 0.55;
    }
    aim.y += 0.5 * GRAV * flightT * flightT;

    const dir = aim.sub(launchFrom).normalize();
    dir.x += rand(-err, err);
    dir.y += rand(-err, err) * 0.55;
    dir.z += rand(-err, err);
    dir.normalize();

    s.userData.ai.lookAt = Math.atan2(dir.x, dir.z);
    if (!u.nozzle) launchFrom.addScaledVector(dir, 0.52);
    env.fire(launchFrom, dir, s, SPD);
    return true;
  }

  // Vocal callout: ONLY shares fugitive propId with teammates within 18m vocal earshot, and recruits at most 1 nearby flanker!
  function broadcastTeamFlank(spotter, hider) {
    const rec = TEAM_INTEL.sightings.get(hider);
    if (!rec) return;
    const KIT = env.getKit();
    const now = getNow();

    if (now - (spotter.userData.ai.calloutCd || 0) > 6500) {
      spotter.userData.ai.calloutCd = now;
      const pLabel = hider.userData.specialLabel ||
        (hider.userData.propId && KIT.props[hider.userData.propId] ? KIT.props[hider.userData.propId].label : 'Spirit');
      if (env.G.mode === 'seek') {
        env.pushFeed('👀', `<b>${spotter.userData.actor?.name || 'Ally'}</b> spotted a disguised <b>${pLabel}</b>!`, 'info');
      } else if (hider === env.G.player) {
        env.hint(`👀 ${spotter.userData.actor?.name || 'Seeker'} spotted you (${pLabel}) — break line of sight!`, 2000);
      }
    }

    // Share fugitive propId ONLY with teammates within 18m vocal earshot (no map-wide telepathy!)
    if (hider.userData.propId) {
      for (const o of (env.G.seekers || [])) {
        if (!o || o === spotter || !o.userData?.ai?.knownFugitiveProps) continue;
        const dVoice = Math.hypot(o.position.x - spotter.position.x, o.position.z - spotter.position.z);
        if (dVoice <= 18.0) {
          o.userData.ai.knownFugitiveProps.set(hider, { propId: hider.userData.propId, t: now });
        }
      }
    }

    const activeChasers = (env.G.seekers || []).filter((o) =>
      o !== spotter && (o.userData?.ai?.state === 'chase' || o.userData?.ai?.state === 'flank') && o.userData?.ai?.target === hider
    );
    if (activeChasers.length >= 1) return;

    // Only recruit 1 nearby teammate within 20m vocal range to pincer-flank so the other 3 keep hunting independently!
    let bestAlly = null, bestD = 20.0;
    for (const o of (env.G.seekers || [])) {
      if (!o || o === spotter) continue;
      const oai = o.userData.ai;
      if (!oai || oai.state === 'chase') continue;
      const d = Math.hypot(o.position.x - spotter.position.x, o.position.z - spotter.position.z);
      if (d < bestD) { bestD = d; bestAlly = o; }
    }
    if (bestAlly) {
      const oai = bestAlly.userData.ai;
      oai.state = 'flank';
      oai.target = hider;
      oai.flankT = 6.8;
      resetBotProgress(bestAlly, oai);
      if (oai.setMark) oai.setMark(bestAlly, '?');
    }
  }

  function startZoneSearch(s, center, propHint, radius = 6.8, dur = 7.5, quiet = false, opts = {}) {
    const ai = s.userData.ai;
    const cfg = ARCHETYPE_CONFIG[ai.archetype] || ARCHETYPE_CONFIG.backyard_hound;
    const snappedCenter = snapToWalkableGoal(center.x, center.z, center.y ?? s.userData.groundY, 3.6);
    ai.state = 'search';
    ai.sc = snappedCenter.clone();
    ai.sr = radius;
    ai.sp = propHint || null;
    ai.searchReason = opts.reason || (propHint ? 'chase' : 'patrol');
    ai.searchT = dur;
    ai.checked = new Set();
    ai.cand = null;
    ai.candLeft = typeof opts.candCount === 'number'
      ? opts.candCount
      : (quiet ? Math.min(2, cfg.candCount) : cfg.candCount);
    ai.sprayT = 0;
    ai.wanderChecks = 0;
    ai.goal = null;
    resetBotProgress(s, ai);
    if (ai.setMark) ai.setMark(s, quiet ? null : '?');
  }

  // Computes flanking approach point (±4.8m perpendicular / opposite side of nearby building) for Responder #2
  function computeSoundFlankGoal(s, ev, firstResponder) {
    const refPos = firstResponder ? firstResponder.position : s.position;
    let dx = ev.pos.x - refPos.x;
    let dz = ev.pos.z - refPos.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;

    const perpX = -dz, perpZ = dx;
    const sSide = ((s.position.x - ev.pos.x) * perpX + (s.position.z - ev.pos.z) * perpZ) >= 0 ? 1 : -1;
    const firstGoal = firstResponder?.userData?.ai?.pendingSound?.goal || firstResponder?.userData?.ai?.goal || ev.pos;

    const offsets = [
      { ox: perpX * sSide * 4.8, oz: perpZ * sSide * 4.8, sign: sSide },
      { ox: -perpX * sSide * 4.8, oz: -perpZ * sSide * 4.8, sign: -sSide },
      { ox: dx * 4.6, oz: dz * 4.6, sign: sSide }, // opposite side of building past sound origin!
    ];

    for (let i = 0; i < offsets.length; i++) {
      const cand = snapToWalkableGoal(ev.pos.x + offsets[i].ox, ev.pos.z + offsets[i].oz, ev.pos.y, 3.6, ev.pos);
      if (cand && Math.hypot(cand.x - firstGoal.x, cand.z - firstGoal.z) >= 3.2) {
        return { goal: cand, flankSign: offsets[i].sign };
      }
    }
    return {
      goal: snapToWalkableGoal(ev.pos.x + perpX * sSide * 4.2, ev.pos.z + perpZ * sSide * 4.2, ev.pos.y, 4.0, ev.pos),
      flankSign: sSide,
    };
  }

  // Ranks how many non-chasing AI seekers are strictly closer (earshot-adjusted) to ev.pos so the 2 closest ALWAYS respond!
  function countCloserEarshotSeekers(s, ev, myEffDist, steamMul) {
    let closer = 0;
    for (const o of (env.G.seekers || [])) {
      if (!o || o === s) continue;
      const oai = o.userData?.ai;
      if (!oai || oai.state === 'chase') continue;
      const od = o.position.distanceTo(ev.pos);
      const oMaxR = ev.radius * (oai.earshotMul || 1) * steamMul;
      if (od > oMaxR) continue;
      const oEffDist = od / (oai.earshotMul || 1);
      if (oEffDist < myEffDist - 0.05 || (Math.abs(oEffDist - myEffDist) <= 0.05 && (oai.slotIdx || 0) < (s.userData.ai.slotIdx || 0))) {
        closer++;
      }
    }
    return closer;
  }

  function updateSeekerBot(s, dt, allChars) {
    const ai = s.userData.ai;
    if (!ai || s.userData?.actor?.isRemote) return;
    const cfg = ARCHETYPE_CONFIG[ai.archetype] || ARCHETYPE_CONFIG.backyard_hound;

    // Wait blindfolded during Hide / Ready countdown
    if (env.G.phase === 'hide' || env.G.phase === 'ready' || env.G.over) {
      if (ai.setMark) ai.setMark(s, null);
      s.userData.sus = 0;
      return;
    }
    if (ai.releaseDelay > 0) {
      ai.releaseDelay -= dt;
      return;
    }
    if (!ai.didReleaseHop) {
      ai.didReleaseHop = true;
      if ((s.userData.jy || 0) <= 0.05) env.doCharJump(s, 7.1);
    }

    ai.huntElapsed = (ai.huntElapsed || 0) + dt;
    if (ai.prevState !== ai.state) {
      ai.prevState = ai.state;
      resetBotProgress(s, ai);
    }
    ai.stateTimer = (ai.stateTimer || 0) + dt;

    const now = getNow();
    if ((s.userData.blindUntil || 0) > now) {
      if (ai.setMark) ai.setMark(s, '?');
      s.rotation.y += Math.sin(now * 0.018 + (ai.slotIdx || 0)) * 3.1 * dt;
      s.userData.sus = 0;
      return;
    }

    // Water tank: slow trickle when not spraying; an empty tank means a walk to the nearest well.
    if (ai.tank == null) ai.tank = HUE_RULES.BOT_TANK_MAX;
    if (now - (ai.lastShotAt || -1e9) > HUE_RULES.TRICKLE_DELAY_SEC * 1000) {
      ai.tank = Math.min(HUE_RULES.BOT_TANK_MAX, ai.tank + HUE_RULES.TRICKLE_PER_SEC * dt);
    }
    if (ai.tank < HUE_RULES.SHOT_COST && ai.state !== 'refill' && !env.G.isTutorial) {
      const w = nearestWellFor(s);
      ai.state = 'refill';
      ai.target = null;
      ai.pendingSound = null;
      ai.refillWell = w;
      ai.goal = w ? snapToWalkableGoal(w.x, w.z, w.y, 2.2) : null;
      resetBotProgress(s, ai);
      if (ai.setMark) ai.setMark(s, null);
    }

    const activeMap = env.getActiveMap();
    const sGroundY = s.userData.groundY || 0;
    const eye = _tmpV1.set(s.position.x, sGroundY + 1.25 + (s.userData.jy || 0), s.position.z);
    ai._losTick = ((ai._losTick ?? (ai.slotIdx || 0)) + 1) | 0;
    if (!ai.lastLosMap) ai.lastLosMap = new Map();

    // 1. Snapshot visible static props periodically to build private per-bot spatial memory
    ai.snapshotTimer -= dt;
    if (ai.snapshotTimer <= 0 && ai.state === 'patrol') {
      ai.snapshotTimer = ai.archetype === 'detective' ? 0.65 : 0.85;
      const myCell = cellSignature(s.position.x, sGroundY, s.position.z);
      ai.memorizedCells.add(myCell);
      for (const r of env.realProps) {
        if (Math.hypot(r.pos.x - s.position.x, r.pos.z - s.position.z) < 12.5 && Math.abs((r.pos.y || 0) - sGroundY) < 2.2) {
          ai.memorizedCells.add(cellSignature(r.pos.x, r.pos.y, r.pos.z));
          ai.knownProps.add(propSignature(r.id, r.pos.x, r.pos.y, r.pos.z));
        }
      }
      // Include already-stationary disguised hiders & decoys on very first visit to a cell (zero unfair cheat!)
      for (const h of (env.G.allHiders || [])) {
        if (!h || h.userData?.actor?.eliminated || !h.userData.propId) continue;
        const hSpd = h.userData.spd || 0;
        if (hSpd < 0.25 && Math.hypot(h.position.x - s.position.x, h.position.z - s.position.z) < 12.5) {
          const hy = (h.userData.groundY || 0) + (h.userData.specialY || 0);
          const hc = cellSignature(h.position.x, hy, h.position.z);
          if (!ai.memorizedCells.has(hc)) {
            ai.knownProps.add(propSignature(h.userData.propId, h.position.x, hy, h.position.z));
          }
        }
      }
    }

    // 2. Scan Cone & Unified Visual Perception across ALL Living Hiders
    ai.scan += dt * (ai.state === 'patrol' ? 1.45 : 2.25);
    const headYaw = (ai.state === 'chase' && ai.target)
      ? Math.atan2(ai.target.position.x - s.position.x, ai.target.position.z - s.position.z)
      : s.rotation.y + Math.sin(ai.scan) * (ai.state === 'search' ? 1.18 : 0.86);

    let maxPlayerSus = 0;
    let highestTarget = null, highestSus = 0, canSeeTarget = false;
    const paceGov = paceGovernor();

    const allHList = env.G.allHiders || [];
    for (let hIdx = 0; hIdx < allHList.length; hIdx++) {
      const h = allHList[hIdx];
      if (!h || h.userData?.actor?.eliminated) {
        ai.susMap.delete(h);
        ai.knownFugitiveProps.delete(h);
        ai.lastLosMap.delete(h);
        continue;
      }
      const hu = h.userData;
      let prevP = ai.lastPosMap.get(h);
      let vel = ai.velMap.get(h);
      const curFullP = _tmpV2.set(h.position.x, (hu.groundY || 0) + (hu.jy || 0), h.position.z);
      if (!prevP) {
        prevP = curFullP.clone();
        vel = new THREE.Vector3();
        ai.lastPosMap.set(h, prevP);
        ai.velMap.set(h, vel);
      } else {
        const instV = _tmpV4.copy(curFullP).sub(prevP).divideScalar(Math.max(dt, 1e-3));
        vel.lerp(instV, 0.28);
        prevP.copy(curFullP);
      }

      const hc = env.centerOf(h);
      const toH = _tmpV3.copy(hc).sub(eye);
      const dist = toH.length();
      const steam = activeMap && activeMap.steamFactorAt
        ? clamp(Math.max(activeMap.steamFactorAt(eye), activeMap.steamFactorAt(hc)), 0, 1)
        : 0;

      const sightRange = (ai.state === 'chase' && ai.target === h ? 19.5 : 22.5) * (1 - steam * 0.72);
      const horizAng = Math.abs(normAng(Math.atan2(toH.x, toH.z) - headYaw));
      const inCone = (dist < sightRange && horizAng < 1.04) || dist < (2.4 * (1 - steam * 0.55));
      let canSee = false;
      if (inCone) {
        if (ai.target === h || dist < 4.5 || ((ai._losTick + hIdx) % 3 === 0) || !ai.lastLosMap.has(h)) {
          canSee = env.lineOfSight(eye, hc);
          ai.lastLosMap.set(h, canSee);
        } else {
          canSee = !!ai.lastLosMap.get(h);
        }
      } else {
        ai.lastLosMap.set(h, false);
      }

      if (canSee && h === env.G.player && ai.state !== 'chase' && env.G.mode === 'hide' && env.G.phase === 'survive') {
        env.G.boldSec = (env.G.boldSec || 0) + dt * 0.4;
      }

      const isMoving = h === env.G.player ? !!env.G.moving : (hu.spd || 0) > 0.45;
      const isJumping = (hu.jy || 0) > 0.14;
      const justPoofed = (h === env.G.player ? (now - (env.G.poofAt || -1e9) < 480) : (now - (hu.ai?.poofAt || -1e9) < 480));
      const justRotated = h === env.G.player && (env.G.rotatedT || 0) > 0;

      let rate = 0;
      const kitRef = env.getKit ? env.getKit() : null;
      const isAnimalDisguise = !!(hu.propId && kitRef?.props?.[hu.propId]?.isAnimal);
      if (canSee) {
        const close = clamp(1 - dist / 25, 0, 1);
        const focus = dist < 9.5 ? 1.55 : 1.0;
        if (!hu.propId && !hu.specialMode) {
          rate = 4.2 * (0.4 + close);
        } else if (justPoofed) {
          rate = 99;
        } else if (isAnimalDisguise && (isMoving || isJumping)) {
          const canFlyBird = !!kitRef?.props?.[hu.propId]?.canFly;
          const animalSprinting = (hu.spd || 0) > 4.65;
          const animalIndoors = !!(env.ENTER.length && env.whereIs(h.position.x, h.position.z, hu.groundY || 0));
          const hasHerdNearby = env.realProps.some((r) => r.id === hu.propId && r.pos.distanceTo(h.position) < 9.5);
          if (isJumping && canFlyBird) rate = 0.58 * (0.35 + close) * focus;
          else if (isJumping) rate = 3.2 * (0.35 + close) * focus;
          else if (animalSprinting || animalIndoors) rate = 1.65 * (0.35 + close) * focus;
          else rate = (hasHerdNearby ? 0.075 : 0.21) * (0.35 + close) * focus;
        } else if (isMoving || isJumping) {
          rate = (isJumping ? 3.8 : 2.35) * (0.35 + close) * focus;
        } else if (hu.specialMode === 'tub' || hu.specialMode === 'hook' || hu.specialMode === 'custom_spot') {
          rate = (justRotated ? 0.65 : 0.015) * close * focus;
        } else {
          const natural = env.SLOTS.some((q) =>
            q.id === hu.propId &&
            Math.hypot(q.x - h.position.x, q.z - h.position.z) < 0.82 &&
            (env.ROUND_PROPS.has(hu.propId) || Math.abs(normAng(q.rot - h.rotation.y)) < 0.52)
          );
          const hasTwin = env.realProps.some((r) => r.id === hu.propId && r.pos.distanceTo(h.position) < (isAnimalDisguise ? 9.5 : 4.2));
          let odd = natural ? 0.018 : hasTwin ? (isAnimalDisguise ? 0.035 : 0.13) : (isAnimalDisguise ? 0.18 : 0.38);

          const hy = (hu.groundY || 0) + (hu.specialY || 0);
          const cell = cellSignature(h.position.x, hy, h.position.z);
          if (!isAnimalDisguise && ai.memorizedCells.has(cell) && !ai.knownProps.has(propSignature(hu.propId, h.position.x, hy, h.position.z))) {
            odd += ai.archetype === 'detective' ? 0.56 : 0.45;
          }

          // Private fugitive prop knowledge ONLY (personally spotted or <=18m vocal callout — NO global telepathy!)
          const myKnown = ai.knownFugitiveProps.get(h);
          if (myKnown && myKnown.propId === hu.propId && now - myKnown.t < 24000) {
            odd *= 2.05;
          }
          // Faded paint gives a disguise away: the paler the prop, the faster it draws the eye.
          odd += paintSuspicionBoost(hu.hue);
          rate = (justRotated ? 0.9 : odd) * close * focus;
        }
        // Repainting in plain view is as obvious as moving.
        if (hu.propId && (hu.hueBusyUntil || 0) > now) rate = Math.max(rate, 1.7 * (0.35 + close) * focus);
        // Bot skill: gentle bots are slower to work out a disguise.
        if ((hu.propId || hu.specialMode) && !justPoofed) rate *= dLerp(0.55, 1.15);
        // Seekers need a little while to get their eye in: disguises are harder to read in the opening seconds of a hunt,
        // so no squad gets wiped before the round has properly begun (matters most on the small maps).
        if ((hu.propId || hu.specialMode) && !justPoofed && !isMoving) rate *= clamp(0.3 + 0.7 * ((ai.huntElapsed || 0) / 25), 0.3, 1) * paceGov;
        rate *= (1 - steam * 0.78);
        if (hu._windCloakUntil && now < hu._windCloakUntil) rate *= 0.15;
      }

      const prevSus = ai.susMap.get(h) || 0;
      const nextSus = clamp(prevSus + (rate > 0.014 ? rate * dt : -0.12 * dt), 0, 1.25);
      ai.susMap.set(h, nextSus);

      if (h === env.G.player) maxPlayerSus = nextSus;

      if (canSee && nextSus > highestSus) {
        highestSus = nextSus;
        highestTarget = h;
        canSeeTarget = true;
      }
    }

    // 3. Keen 3D Sound Hearing (Whistles, Giggles, Chimes, Poofs, Sprints, Steps) with Human Reaction Stagger!
    if (ai.state !== 'chase' && ai.state !== 'refill') {
      // Throttled local player footstep cue emission in Hide mode (never masks whistles!)
      if (env.G.mode === 'hide' && env.G.player && !env.G.player.userData?.actor?.eliminated && env.G.moving) {
        if (now - TEAM_INTEL.lastPlayerStepCueAt > 380) {
          const p = env.G.player, pu = p.userData;
          const baseStepR = pu.propId ? 5.0 : 8.6;
          TEAM_INTEL.lastPlayerStepCueAt = now;
          emitSoundCue(p.position, baseStepR, 'step', p);
        }
      }

      // Scan ring buffer for highest-priority unheard sound within earshot
      let bestEv = null;
      let bestEvDist = 999;
      let bestEvSteamMul = 1;

      for (let i = TEAM_INTEL.soundEvents.length - 1; i >= 0; i--) {
        const ev = TEAM_INTEL.soundEvents[i];
        if (now - ev.t > (ev.ttlMs || 1200)) continue;
        if (ai.heardSoundIds.has(ev.id)) continue;

        const steam = activeMap && activeMap.steamFactorAt ? activeMap.steamFactorAt(ev.pos) : 0;
        const steamMul = ev.kind === 'taunt' || ev.kind === 'whistle'
          ? (1 - steam * 0.25)
          : (ev.priority >= 3 ? (1 - steam * 0.35) : (1 - steam * 0.60));
        const maxEarshot = ev.radius * (ai.earshotMul || 1) * steamMul;
        const d = s.position.distanceTo(ev.pos);
        if (d > maxEarshot) continue;

        if (!bestEv || ev.priority > bestEv.priority || (ev.priority === bestEv.priority && d < bestEvDist)) {
          bestEv = ev;
          bestEvDist = d;
          bestEvSteamMul = steamMul;
        }
      }

      if (bestEv) {
        ai.heardSoundIds.add(bestEv.id);
        if (ai.heardSoundIds.size > 160) {
          const oldestId = ai.heardSoundIds.values().next().value;
          ai.heardSoundIds.delete(oldestId);
        }

        const isHighAlert = bestEv.priority >= 3; // taunt (4), giggle/chime (3)
        const curActivePri = ai.pendingSound
          ? ai.pendingSound.ev.priority
          : (ai.state === 'investigate' ? (ai.investigatePriority || 1) : (ai.state === 'flank' ? 2 : 0));

        // High-priority whistles & giggles interrupt patrol, search, flank, AND lower/older investigate!
        const canInterrupt = isHighAlert
          ? (!ai.pendingSound || bestEv.priority > ai.pendingSound.ev.priority || bestEv.id !== ai.pendingSound.ev.id) &&
            (bestEv.priority >= curActivePri)
          : (!ai.pendingSound && ai.state !== 'flank' && (ai.state === 'patrol' || (ai.state === 'search' && ai.searchReason !== 'sound') || (ai.state === 'investigate' && bestEv.priority > curActivePri)));

        if (canInterrupt) {
          // Prune any stale responders
          for (const r of bestEv.responders) {
            if (!r || r.userData?.ai?.state === 'chase') bestEv.responders.delete(r);
          }

          if (isHighAlert) {
            const myEffDist = bestEvDist / (ai.earshotMul || 1);
            const closerCount = countCloserEarshotSeekers(s, bestEv, myEffDist, bestEvSteamMul);

            if (closerCount === 0 && bestEv.responders.size < 2) {
              // Responder #1: Direct approach with realistic distance-scaled uncertainty (±0.9m..<14m up to ±3.6m@40m)
              bestEv.responders.add(s);
              const errR = bestEvDist < 14
                ? 0.9
                : clamp(0.9 + ((bestEvDist - 14) / 26) * 2.7, 0.9, 3.6);
              const uAng = rand(0, Math.PI * 2);
              const uDist = rand(0.15, errR);
              const goal = snapToWalkableGoal(
                bestEv.pos.x + Math.cos(uAng) * uDist,
                bestEv.pos.z + Math.sin(uAng) * uDist,
                bestEv.pos.y,
                4.0,
                bestEv.pos
              );
              ai.pendingSound = {
                ev: bestEv,
                reactT: ai.reactionDelay + rand(0, 0.14),
                flankSign: 0,
                goal,
                isHighAlert: true,
              };
            } else if ((closerCount === 1 && bestEv.responders.size < 2) || (bestEvDist < 9.5 && bestEv.responders.size < 3)) {
              // Responder #2: Pinch around the opposite side / ±4.8m flanking offset!
              const firstResp = [...bestEv.responders][0] || null;
              bestEv.responders.add(s);
              const { goal, flankSign } = computeSoundFlankGoal(s, bestEv, firstResp);
              ai.pendingSound = {
                ev: bestEv,
                reactT: ai.reactionDelay + rand(0.04, 0.16),
                flankSign,
                goal,
                isHighAlert: true,
              };
            } else if (bestEvDist < 22.0) {
              // 3rd+ earshot seeker: brief realistic head glance + next-patrol directional bias (no 5-bot pileup!)
              ai.glanceYaw = Math.atan2(bestEv.pos.x - s.position.x, bestEv.pos.z - s.position.z);
              ai.glanceT = rand(0.65, 1.15);
              ai.sectorBiasAngle = Math.atan2(bestEv.pos.z, bestEv.pos.x) + rand(-0.42, 0.42);
              ai.sectorBiasUntil = now + 14000;
            }
          } else {
            // Subtle sound (poof, decoy, sprint, jump, step): 1 nearest seeker investigates
            const maxSubtleResp = bestEv.priority === 2 ? 2 : 1;
            const myEffDist = bestEvDist / (ai.earshotMul || 1);
            const closerCount = countCloserEarshotSeekers(s, bestEv, myEffDist, bestEvSteamMul);
            if (closerCount < maxSubtleResp && bestEv.responders.size < maxSubtleResp) {
              bestEv.responders.add(s);
              const errR = clamp(0.85 + (bestEvDist / 18) * 1.75, 0.85, 2.6);
              const uAng = rand(0, Math.PI * 2);
              const goal = snapToWalkableGoal(
                bestEv.pos.x + Math.cos(uAng) * rand(0.2, errR),
                bestEv.pos.z + Math.sin(uAng) * rand(0.2, errR),
                bestEv.pos.y,
                3.8,
                bestEv.pos
              );
              ai.pendingSound = {
                ev: bestEv,
                reactT: ai.reactionDelay + rand(0.02, 0.16),
                flankSign: 0,
                goal,
                isHighAlert: false,
              };
            }
          }
        }
      }

      // Tick independent staggered reaction delay before snapping head & sprinting!
      if (ai.pendingSound) {
        ai.pendingSound.reactT -= dt;
        if (ai.pendingSound.reactT <= 0) {
          const ps = ai.pendingSound;
          ai.pendingSound = null;
          ai.state = 'investigate';
          ai.target = null;
          ai.goal = ps.goal;
          ai.investigateHighAlert = ps.isHighAlert;
          ai.investigatePriority = ps.ev.priority;
          ai.investigateOrigin = snapToWalkableGoal(ps.ev.pos.x, ps.ev.pos.z, ps.ev.pos.y, 3.8, ps.ev.pos);
          resetBotProgress(s, ai);

          const dOrigin = s.position.distanceTo(ps.ev.pos);
          ai.glanceYaw = Math.atan2(ps.ev.pos.x - s.position.x, ps.ev.pos.z - s.position.z);
          ai.glanceT = 0.45;

          if ((ps.ev.kind === 'taunt' || ps.ev.kind === 'whistle') && dOrigin < 16.0) {
            if (ai.setMark) ai.setMark(s, '!');
            if (env.audio.alert) env.audio.alert(s.position.x, s.position.z);
          } else {
            if (ai.setMark) ai.setMark(s, '?');
            if (env.audio.sniff) env.audio.sniff(s.position.x, s.position.z);
          }
        }
      }
    } else {
      ai.pendingSound = null;
    }

    // 4. Transition to CHASE or INVESTIGATE based on sight suspicion!
    const dryTank = ai.state === 'refill';
    if (dryTank) {
      if (canSeeTarget && highestTarget && highestSus >= 1.0) {
        recordSighting(s, highestTarget, ai.velMap.get(highestTarget), now);
        broadcastTeamFlank(s, highestTarget);
      }
    } else if (canSeeTarget && highestTarget && highestSus >= 1.0) {
      const switchedTarget = ai.state !== 'chase' || ai.target !== highestTarget;
      ai.target = highestTarget;
      ai.pendingSound = null;
      if (switchedTarget) {
        ai.state = 'chase';
        ai.react = 0.34 * dLerp(2.2, 0.85);
        ai.burstN = 0;
        ai.seenT = 0;
        resetBotProgress(s, ai);
        if (ai.setMark) ai.setMark(s, '!');
        env.audio.alert(s.position.x, s.position.z);
      }
      ai.lostT = 0;
      ai.seenT += dt;
      recordSighting(s, highestTarget, ai.velMap.get(highestTarget), now);
      if (switchedTarget || ai.seenT < dt * 2) {
        broadcastTeamFlank(s, highestTarget);
      }
    } else if (canSeeTarget && highestTarget && highestSus > 0.42 && (ai.state === 'patrol' || ai.state === 'search')) {
      ai.state = 'investigate';
      ai.investigateHighAlert = false;
      ai.investigatePriority = 2;
      ai.goal = snapToWalkableGoal(highestTarget.position.x, highestTarget.position.z, highestTarget.userData.groundY, 3.6, highestTarget.position);
      ai.investigateOrigin = ai.goal.clone();
      resetBotProgress(s, ai);
      if (ai.setMark) ai.setMark(s, '?');
    }

    if (ai.target && ai.target.userData?.actor?.eliminated) {
      ai.target = null;
      ai.state = 'patrol';
      ai.goal = null;
      resetBotProgress(s, ai);
      if (ai.setMark) ai.setMark(s, null);
    }

    ai.lookAt = null;
    if (ai.glanceT > 0) {
      ai.glanceT -= dt;
      if (ai.glanceYaw != null) ai.lookAt = ai.glanceYaw;
    }

    let moveGoal = null;
    let speed = cfg.patrolSpeed * ai.paceMul;
    let eagerJump = !!cfg.eagerJump;

    // ------------------------------------------------------------------------
    // Seeker State Execution (with State Timeouts & Real-Movement Watchdogs!)
    // ------------------------------------------------------------------------
    if (ai.state === 'refill') {
      const w = ai.refillWell;
      const dW = w ? Math.hypot(s.position.x - w.x, s.position.z - w.z) : 0;
      speed = 5.6 * clamp(ai.paceMul, 0.96, 1.06);
      eagerJump = true;
      if (!w || dW < HUE_RULES.WELL_RADIUS) {
        // At the well (or no well on this map: wait it out at a third of the speed)
        ai.tank = Math.min(HUE_RULES.BOT_TANK_MAX, ai.tank + HUE_RULES.WELL_REFILL_PER_SEC * (w ? 1 : 0.33) * dt);
        if (w) ai.lookAt = Math.atan2(w.x - s.position.x, w.z - s.position.z);
      } else {
        moveGoal = ai.goal || w;
        // Never get stuck thirsty: if the well cannot be reached, top up enough to keep hunting.
        if (checkProgressStalled(s, ai, dt, 2.4, 0.7) || ai.stateTimer > 16.0) ai.tank = Math.max(ai.tank, HUE_RULES.BOT_TANK_MAX * 0.6);
      }
      if (ai.tank >= HUE_RULES.BOT_TANK_MAX * 0.98 || (moveGoal && ai.tank >= HUE_RULES.BOT_TANK_MAX * 0.6)) {
        ai.state = 'patrol';
        ai.goal = null;
        ai.refillWell = null;
        resetBotProgress(s, ai);
      }
    } else if (ai.state === 'chase' && ai.target) {
      const tgt = ai.target;
      const tc = env.centerOf(tgt);
      const toT = _tmpV3.copy(tc).sub(eye);
      const dist = toT.length();
      const steam = activeMap && activeMap.steamFactorAt
        ? clamp(Math.max(activeMap.steamFactorAt(eye), activeMap.steamFactorAt(tc)), 0, 1)
        : 0;
      const hasLOS = dist < 21.5 * (1 - steam * 0.65) && env.lineOfSight(eye, tc);

      ai.firingT = Math.max(0, (ai.firingT || 0) - dt);
      speed = (ai.firingT > 0 ? 4.70 : 6.25) * clamp(ai.paceMul, 0.97, 1.06);
      eagerJump = true;

      if (hasLOS) {
        ai.lostT = 0;
        ai.seenT += dt;
        const tVel = ai.velMap.get(tgt) || new THREE.Vector3();
        recordSighting(s, tgt, tVel, now);

        if (dist > 3.1) {
          moveGoal = { x: tgt.position.x, y: tgt.userData.groundY ?? 0, z: tgt.position.z };
        } else {
          // Gentle combat strafe at close range so seeker never stands like a statue while hosing
          const strafeAng = Math.atan2(s.position.x - tgt.position.x, s.position.z - tgt.position.z) + ai.orbitDir * 0.65;
          const sx = tgt.position.x + Math.sin(strafeAng) * 3.1;
          const sz = tgt.position.z + Math.cos(strafeAng) * 3.1;
          if (isWalkableSafe(sx, sz, sGroundY, 0.35)) {
            moveGoal = { x: sx, y: sGroundY, z: sz };
            speed = 2.6;
          }
        }

        ai.react -= dt;
        ai.shootCd -= dt;
        if (ai.react <= 0 && ai.shootCd <= 0 && dist < 14.8) {
          ai.shootCd = env.isOvertime && env.isOvertime() ? 0.095 : 0.145;
          ai.firingT = 0.26;
          const moveErr = Math.min(0.065, tVel.length() * 0.011);
          // when the round is running ahead of pace, chases get sloppier (wider aim, longer breaths) so more of them end in an escape
          const easeOff = paceGov < 1;
          const aimErr = (clamp(0.10 - ai.seenT * 0.025, 0.03, 0.10) + dist * 0.0025 + moveErr) * dLerp(1.9, 0.9) * (easeOff ? 2.4 : 1);
          seekerShootWater(s, tc, tVel, aimErr);
          if (++ai.burstN >= 7) {
            ai.burstN = 0;
            ai.shootCd = 0.80 * dLerp(1.6, 1.0) * (easeOff ? 1.9 : 1);   // gentle bots take longer breaths between bursts
          }
        }
        ai.lookAt = Math.atan2(toT.x, toT.z);
      } else {
        ai.lostT += dt;
        const rec = TEAM_INTEL.sightings.get(tgt);
        if (rec) {
          const rawProj = rec.pos.clone().addScaledVector(rec.vel, clamp(ai.lostT, 0.25, 1.15) * 0.85);
          const proj = snapToWalkableGoal(rawProj.x, rawProj.z, rec.pos.y, 3.8);
          moveGoal = proj;
          const stalledChase = checkProgressStalled(s, ai, dt, 1.6, 0.70);
          if (ai.lostT > 2.2 || stalledChase || Math.hypot(s.position.x - proj.x, s.position.z - proj.z) < 1.55) {
            const knownProp = ai.knownFugitiveProps.get(tgt)?.propId || rec.propId;
            startZoneSearch(s, proj, knownProp, 8.2, 9.5, false, { reason: 'chase', candCount: 5 });
            if (tgt === env.G.player && env.G.mode === 'hide') {
              const KIT = env.getKit();
              const lbl = knownProp && KIT.props[knownProp] ? KIT.props[knownProp].label.toLowerCase() : null;
              env.hint(lbl ? `🔎 Lost line of sight! They're checking every ${lbl} nearby — morph if safe!` : '🔎 You broke line of sight!', 2100);
            }
            ai.target = null;
          }
        } else {
          ai.state = 'patrol';
          ai.target = null;
        }
      }
    } else if (ai.state === 'flank' && ai.target) {
      ai.flankT = (ai.flankT || 6.5) - dt;
      const rec = TEAM_INTEL.sightings.get(ai.target);
      const stalledFlank = checkProgressStalled(s, ai, dt, 2.0, 0.80);
      if (!rec || ai.flankT <= 0 || ai.stateTimer > 7.5 || now - rec.t > 5500) {
        ai.state = 'patrol';
        ai.target = null;
        ai.goal = null;
        if (ai.setMark) ai.setMark(s, null);
      } else {
        speed = 5.95 * clamp(ai.paceMul, 0.96, 1.06);
        eagerJump = true;
        const rawIntercept = rec.pos.clone().addScaledVector(rec.vel, 1.35);
        const intercept = snapToWalkableGoal(rawIntercept.x, rawIntercept.z, rec.pos.y, 3.8);
        ai.goal = intercept;
        moveGoal = intercept;
        if (stalledFlank || Math.hypot(s.position.x - intercept.x, s.position.z - intercept.z) < 2.25) {
          const knownProp = ai.knownFugitiveProps.get(ai.target)?.propId || null;
          startZoneSearch(s, stalledFlank ? s.position : intercept, knownProp, 7.4, 7.5, false, { reason: 'chase', candCount: 4 });
          ai.target = null;
        }
      }
    } else if (ai.state === 'investigate') {
      speed = (ai.investigateHighAlert ? 5.45 : 5.15) * clamp(ai.paceMul, 0.96, 1.07);
      eagerJump = true;
      if (!ai.goal) {
        ai.state = 'patrol';
      } else {
        if (!ai.goal._snapped) {
          ai.goal = snapToWalkableGoal(ai.goal.x, ai.goal.z, ai.goal.y ?? sGroundY, 3.6);
        }
        moveGoal = ai.goal;
        const curGoalD = Math.hypot(s.position.x - ai.goal.x, s.position.z - ai.goal.z);

        // Net goal-distance + movement watchdog: max 9.0s, or < 0.75m progress over 2.0s
        if (ai.goalDistRef == null) {
          ai.goalDistRef = curGoalD;
          ai.goalDistTimer = 0;
        } else {
          ai.goalDistTimer += dt;
          if (ai.goalDistRef - curGoalD >= 0.75) {
            ai.goalDistRef = curGoalD;
            ai.goalDistTimer = 0;
          }
        }
        const stalledMove = checkProgressStalled(s, ai, dt, 2.0, 0.75);
        const stalledGoal = ai.goalDistTimer >= 2.0;

        if (curGoalD < 2.1 || stalledMove || stalledGoal || ai.stateTimer > 9.0) {
          const searchCenter = curGoalD < 5.5
            ? (ai.investigateOrigin || ai.goal)
            : s.position.clone();
          if (ai.investigateHighAlert) {
            const soundCands = ai.archetype === 'tracker' ? 6 : 5;
            const soundSr = ai.archetype === 'tracker' ? 8.2 : 7.6;
            startZoneSearch(s, searchCenter, null, soundSr, 8.5, false, { reason: 'sound', candCount: soundCands });
          } else {
            startZoneSearch(s, searchCenter, null, 6.8, 7.2, false, { reason: 'sound', candCount: 4 });
          }
        }
      }
    } else if (ai.state === 'search') {
      speed = cfg.searchSpeed * ai.paceMul;
      ai.searchT -= dt;
      if (ai.sc && !ai.sc._snapped) {
        ai.sc = snapToWalkableGoal(ai.sc.x, ai.sc.z, ai.sc.y ?? sGroundY, 3.6);
      }
      if (ai.goal && !ai.goal._snapped) {
        ai.goal = snapToWalkableGoal(ai.goal.x, ai.goal.z, ai.goal.y ?? (ai.sc ? ai.sc.y : sGroundY), 3.4);
      }

      if (ai.searchT <= 0 || ai.stateTimer > 10.5) {
        ai.state = 'patrol';
        ai.goal = null;
        if (ai.setMark) ai.setMark(s, null);
      } else {
        if (ai.cand && ai.cand.isAlive && !ai.cand.isAlive()) {
          ai.cand.done = true;
        }
        if (!ai.cand || ai.cand.done) {
          ai.cand = pickNextSpyCandidate(s);
          ai.sprayT = 0;
          if (ai.cand) {
            ai.cand.shots = 0;
            ai.cand.vantage = null;
          }
        }

        if (ai.cand) {
          const cp = ai.cand.pos();
          const cpY = cp.y ?? env.groundHeightAt(cp.x, cp.z, sGroundY);
          const d = Math.hypot(cp.x - s.position.x, cp.z - s.position.z);
          const cpCenter = new THREE.Vector3(cp.x, cpY + ai.cand.h * 0.5, cp.z);
          const hasClearShot = d <= 4.35 && env.lineOfSight(eye, cpCenter);

          if (!hasClearShot) {
            // Approach within 2.5m..4.0m using a snapped walkable vantage point with clear LOS!
            if (!ai.cand.vantage) {
              ai.cand.vantage = snapToWalkableGoal(cp.x, cp.z, cpY, 3.6, cpCenter);
            }
            moveGoal = ai.cand.vantage;
            ai.sprayT += dt;
            const approachStalled = checkProgressStalled(s, ai, dt, 1.5, 0.60);
            if (ai.sprayT > 2.5 || approachStalled) {
              if (d < 6.2) seekerShootWater(s, cpCenter, null, 0.035);
              ai.cand.done = true;
            }
          } else {
            // Active spy-check: NEVER stand motionless! Gently strafe/orbit at 1.6 m/s while firing quick 2..3 squirts!
            ai.lookAt = Math.atan2(cp.x - s.position.x, cp.z - s.position.z);
            const orbitR = clamp(d, 2.55, 3.85);
            const angAround = Math.atan2(s.position.x - cp.x, s.position.z - cp.z) + ai.orbitDir * 0.62;
            const sx = cp.x + Math.sin(angAround) * orbitR;
            const sz = cp.z + Math.cos(angAround) * orbitR;
            if (isWalkableSafe(sx, sz, sGroundY, 0.35)) {
              moveGoal = { x: sx, y: sGroundY, z: sz };
              speed = 1.65;
            } else {
              ai.orbitDir = -ai.orbitDir;
              const altAng = Math.atan2(s.position.x - cp.x, s.position.z - cp.z) + ai.orbitDir * 0.62;
              const ax = cp.x + Math.sin(altAng) * orbitR;
              const az = cp.z + Math.cos(altAng) * orbitR;
              if (isWalkableSafe(ax, az, sGroundY, 0.35)) {
                moveGoal = { x: ax, y: sGroundY, z: az };
                speed = 1.65;
              }
            }

            ai.sprayT += dt;
            if (ai.sprayT > 0.16) {
              ai.shootCd -= dt;
              if (ai.shootCd <= 0) {
                ai.shootCd = 0.12;
                seekerShootWater(s, cpCenter, null, 0.026);
                const wantShots = ai.shotsPerCand || 3;
                if (++ai.cand.shots >= wantShots) ai.cand.done = true;
              }
            }
          }
        } else if (ai.candLeft <= 0 || (ai.wanderChecks || 0) >= 2) {
          // Wrap up immediately when candidates in this zone are exhausted — never linger idle!
          ai.searchT = 0;
        } else {
          // Validate search peek point through snapToWalkableGoal so bots never walk into walls!
          if (!ai.goal || Math.hypot(s.position.x - ai.goal.x, s.position.z - ai.goal.z) < 1.35 || checkProgressStalled(s, ai, dt, 1.5, 0.65)) {
            ai.wanderChecks = (ai.wanderChecks || 0) + 1;
            const wAng = rand(0, Math.PI * 2);
            const wDist = rand(2.2, Math.max(3.0, ai.sr * 0.68));
            ai.goal = snapToWalkableGoal(
              ai.sc.x + Math.cos(wAng) * wDist,
              ai.sc.z + Math.sin(wAng) * wDist,
              ai.sc.y,
              3.2
            );
          }
          moveGoal = ai.goal;
        }
      }
    } else {
      // PATROL: Independent multi-archetype exploration of backyards, alleys, deep rooms & perimeters!
      speed = cfg.patrolSpeed * ai.paceMul;
      if (!ai.goal) {
        ai.goal = pickSmartPatrolZone(s);
        resetBotProgress(s, ai);
      }

      // GTA 6 Partner Prompt Obedience: Seeker bots respond to a player's 🎯 Squad Ping!
      if (env.getActiveSquadPingForTeam) {
        const sPing = env.getActiveSquadPingForTeam('seekers');
        if (sPing && sPing.pos && sPing.t < 6.5 && ai._handledSquadPing !== sPing) {
          const dPing = Math.hypot(sPing.pos.x - s.position.x, sPing.pos.z - s.position.z);
          if (dPing < 28.0 && dPing > 1.8) {
            let closer = 0;
            for (const o of (env.G.seekers || [])) {
              if (!o || o === s || o.userData?.ai?.state === 'chase') continue;
              if (Math.hypot(sPing.pos.x - o.position.x, sPing.pos.z - o.position.z) < dPing - 0.3) closer++;
            }
            if (closer < 2) {
              ai._handledSquadPing = sPing;
              ai.state = 'investigate';
              ai.stateTimer = 0;
              ai.investigateHighAlert = true;
              ai.investigateOrigin = new THREE.Vector3(sPing.pos.x, sPing.pos.y || sGroundY, sPing.pos.z);
              ai.goal = snapToWalkableGoal(sPing.pos.x, sPing.pos.z, sPing.pos.y ?? sGroundY, 2.8);
              ai.goalDistRef = null;
              ai.goalDistTimer = 0;
              if (ai.setMark) ai.setMark(s, '!');
              resetBotProgress(s, ai);
            }
          }
        }
      }

      // Detective Footprint Tracking: follow fresh wet/glowing footprints left by running Hiders!
      if (env.getNearestFootprint && now > (ai._fpTrackCdUntil || 0)) {
        const fp = env.getNearestFootprint(s.position, 10.5);
        if (fp) {
          ai._fpTrackCdUntil = now + 4500;
          ai.state = 'investigate';
          ai.stateTimer = 0;
          ai.investigateHighAlert = true;
          ai.investigateOrigin = new THREE.Vector3(fp.x, fp.y, fp.z);
          ai.goal = snapToWalkableGoal(fp.x, fp.z, fp.y ?? sGroundY, 2.6);
          ai.goalDistRef = null;
          ai.goalDistTimer = 0;
          if (ai.setMark) ai.setMark(s, '?');
          resetBotProgress(s, ai);
        }
      }

      // Patrol watchdog: max 10s per goal; if wall-blocked or net movement < 0.80m over 1.6s -> blacklist 25s & pick fresh goal!
      const patrolStalled = checkProgressStalled(s, ai, dt, 1.6, 0.80) || Boolean(s.userData.nav?.goalBlocked);
      if (patrolStalled || ai.stateTimer > 10.0) {
        if (ai.zoneKey) {
          ai.blacklistedNodes.set(ai.zoneKey, now + 25000);
        }
        if (s.userData.nav) {
          s.userData.nav.detour = null;
          s.userData.nav.detourT = 0;
        }
        ai.goal = pickSmartPatrolZone(s);
        resetBotProgress(s, ai);
      }

      moveGoal = ai.goal;
      if (ai.goal && Math.hypot(s.position.x - ai.goal.x, s.position.z - ai.goal.z) < 2.35) {
        if (ai.zoneKey) {
          ai.personalVisited.set(ai.zoneKey, now);
          TEAM_INTEL.visitedZones.set(ai.zoneKey, now);
        }
        const doSweep = Math.random() < cfg.sweepChance;
        const g = ai.goal.clone();
        ai.goal = null;
        if (doSweep) {
          startZoneSearch(s, g, null, cfg.sweepRadius, cfg.sweepDur, true, {
            reason: 'patrol',
            candCount: cfg.candCount,
          });
        } else {
          resetBotProgress(s, ai);
        }
      }
    }

    if (moveGoal && Math.hypot(moveGoal.x - s.position.x, moveGoal.z - s.position.z) > 0.25) {
      const skMul = env.getSeekerSpeedMul ? env.getSeekerSpeedMul(s) : 1;
      steerSmart(s, moveGoal, speed * skMul, dt, { allChars, allowJump: true, eagerJump });
    }

    const wantFace = ai.lookAt != null ? ai.lookAt : (s.userData.nav?.face ?? s.rotation.y);
    s.rotation.y = lerpAngle(s.rotation.y, wantFace, dt * 9.0);

    // Suspicion meter exported for player HUD in Hide mode
    s.userData.sus = (ai.state === 'chase' && ai.target === env.G.player)
      ? 1.15
      : Math.max(maxPlayerSus, (ai.state === 'investigate' && s.position.distanceTo(env.G.player?.position || s.position) < 10) ? 0.48 : 0);
  }

  function warmupMapCaches() {
    try { getParkourPerches(); } catch (_) {}
    try { getBackyardHideSpots(); } catch (_) {}
    try { getMapExplorationNodes(); } catch (_) {}
  }

  // Same work as warmupMapCaches, one cache per call, so the caller can spread it over several frames.
  function warmupMapCacheSteps() {
    return [
      () => { try { getParkourPerches(); } catch (_) {} },
      () => { try { getBackyardHideSpots(); } catch (_) {} },
      () => { try { getMapExplorationNodes(); } catch (_) {} },
    ];
  }

  return {
    TEAM_INTEL,
    resetMatchIntel,
    warmupMapCaches,
    warmupMapCacheSteps,
    emitSoundCue,
    initHiderBot,
    updateHiderBot,
    onHiderDamaged,
    initSeekerBot,
    updateSeekerBot,
    setDifficulty,
    getDifficulty,
  };
}
