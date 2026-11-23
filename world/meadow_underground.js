/* Meadowbrook Underground Root-Cellar & Wishing-Well Tunnel Network
 * Connected 4-entrance Storybook subterranean loop beneath Meadowbrook Village (Y_UNDER = -3.40m, ceiling = -0.78m):
 *   1. Central Mossy Wishing-Well Cistern (cx = 1.5, cz = 1.5) + Daylight Shaft + Interactive Rope-Bucket Ride
 *   2. East Tunnel + Barn Cheese & Cider Cellar + Open Slanted Timber Storm-Cellar Bulkhead Stairs
 *   3. West Tunnel + Windmill Root & Pumpkin Vault + Rustic Timber Pergola Stone Stairs
 *   4. North-East Tunnel + Mossy Culvert Chamber + Picturesque Mossy Brick Culvert Creek Ramp
 * Zero dead-ends, zero surface-house overlap, refY-aware height sampling, and auto-gated PointLights for 60 FPS mobile play.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { kitTex, mergeStatic } from '../hero_cottage.js';

export const Y_UNDER = -3.40;
const Y_CEIL = -0.78; // 2.62m comfortable headroom -> jumps from -3.40 peak at -1.75 and NEVER snap to y = 0!
const WELL_CX = 1.5;
const WELL_CZ = 1.5;
const WELL_CUTOUT_R = 0.85;

export const UNDERGROUND_PROP_ICONS = {
  mb_cheese_wheel: '🧀',
  mb_cider_cask: '🛢️',
  mb_glow_shroom_pot: '🍄',
  mb_crystal_crate: '💎',
};

export const UNDERGROUND_PROP_DEFS = [
  { id: 'mb_cheese_wheel', label: 'Aged Cheese Wheel', radius: 0.42, height: 0.56, hp: 165, speed: 1.04 },
  { id: 'mb_cider_cask', label: 'Oak Cider Cask', radius: 0.48, height: 0.92, hp: 205, speed: 0.98 },
  { id: 'mb_glow_shroom_pot', label: 'Glow-Shroom Pot', radius: 0.36, height: 0.68, hp: 155, speed: 1.06 },
  { id: 'mb_crystal_crate', label: 'Glow-Crystal Crate', radius: 0.44, height: 0.76, hp: 195, speed: 1.00 },
];

// ============================================================================
// Spatial Footprints (100% verified inside MAPR = 30 & clear of all 7 cottages,
// Bakery, Barn, Windmill, Woodshed, Veg Garden, Stream, and Arched Stone Bridge)
// ============================================================================
export const STAIR_EAST = {
  id: 'east',
  x0: 8.8, x1: 14.8,
  z0: -10.6, z1: -7.0, // 3.6m wide, 6.0m long in open meadow between Plaza, Bakery & Barn
  axis: 'x',
  // x = 14.8 (bottom, y = -3.40) -> x = 8.8 (top surface mouth, y = 0.00)
  bottomX: 14.8, topX: 8.8,
  topWp: { x: 7.4, y: 0, z: -8.8 },
  bottomWp: { x: 16.4, y: Y_UNDER, z: -8.8 },
};

export const STAIR_WEST = {
  id: 'west',
  x0: -25.8, x1: -19.8,
  z0: -0.2, z1: 3.4, // 3.6m wide, 6.0m long in open west meadow clear of Crooked Cottage, Woodshed & Windmill
  axis: 'x',
  // x = -19.8 (bottom, y = -3.40) -> x = -25.8 (top surface mouth, y = 0.00)
  bottomX: -19.8, topX: -25.8,
  topWp: { x: -27.2, y: 0, z: 1.6 },
  bottomWp: { x: -18.4, y: Y_UNDER, z: 1.6 },
};

export const STAIR_CULVERT = {
  id: 'culvert',
  x0: 6.2, x1: 9.8,
  z0: 14.0, z1: 20.0, // 3.6m wide, 6.0m long exiting beside the Stream & Arched Bridge (r = 21.5m < MAPR)
  axis: 'z',
  // z = 14.0 (bottom, y = -3.40) -> z = 20.0 (top surface mouth, y = 0.00)
  bottomZ: 14.0, topZ: 20.0,
  topWp: { x: 8.0, y: 0, z: 21.4 },
  bottomWp: { x: 8.0, y: Y_UNDER, z: 12.4 },
};

const STAIRS = [STAIR_EAST, STAIR_WEST, STAIR_CULVERT];

// Underground chambers & connecting corridors (floor y = -3.40, ceiling underside y = -0.78)
const CISTERN_BOX = { x0: -4.2, x1: 7.2, z0: -4.2, z1: 7.2 };
const TUNNEL_EAST = { x0: 7.2, x1: 14.8, z0: -3.8, z1: -0.2 };
const CELLAR_EAST = { x0: 14.8, x1: 21.6, z0: -11.2, z1: 0.4 };
const TUNNEL_WEST = { x0: -12.8, x1: -4.2, z0: -0.2, z1: 3.4 };
const VAULT_WEST = { x0: -19.8, x1: -12.8, z0: -2.4, z1: 5.2 };
const TUNNEL_NE = { x0: 2.2, x1: 6.0, z0: 7.2, z1: 14.0 };
const CHAMBER_CULVERT = { x0: 6.0, x1: 12.8, z0: 8.6, z1: 14.0 };

const UNDERGROUND_BOXES = [
  CISTERN_BOX,
  TUNNEL_EAST,
  CELLAR_EAST,
  TUNNEL_WEST,
  VAULT_WEST,
  TUNNEL_NE,
  CHAMBER_CULVERT,
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function enforceZeroMetalness(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if (Array.isArray(o.material)) {
      o.material.forEach((m) => { if (m && 'metalness' in m) m.metalness = 0; });
    } else if ('metalness' in o.material) {
      o.material.metalness = 0;
    }
  });
}

function makeRng(seed0 = 42) {
  let s = Math.abs(Math.floor(seed0)) % 2147483646 || 42;
  const rr = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 5; i++) rr();
  return {
    rr,
    jr: (a, b) => a + rr() * (b - a),
    pick: (arr) => arr[Math.floor(rr() * arr.length)],
  };
}

// ============================================================================
// Ground Cutout & Triangle Surgery Helpers
// ============================================================================
export function isMeadowGroundCutout(x, z) {
  if (Math.hypot(x - WELL_CX, z - WELL_CZ) < WELL_CUTOUT_R) return true;
  const margin = 0.3;
  for (let i = 0; i < STAIRS.length; i++) {
    const s = STAIRS[i];
    if (x > s.x0 + margin && x < s.x1 - margin && z > s.z0 + margin && z < s.z1 - margin) {
      return true;
    }
  }
  return false;
}

export function cutMeadowGroundMesh(groundGeometry) {
  if (!groundGeometry || !groundGeometry.attributes || !groundGeometry.attributes.position) {
    return groundGeometry;
  }
  const pos = groundGeometry.attributes.position;
  if (!groundGeometry.index) {
    const count = pos.count;
    const idx = [];
    for (let i = 0; i < count; i++) idx.push(i);
    groundGeometry.setIndex(idx);
  }
  const indexAttr = groundGeometry.index;
  const src = indexAttr.array;
  const kept = [];
  const innerPad = 0.10;

  for (let i = 0; i < src.length; i += 3) {
    const i0 = src[i], i1 = src[i + 1], i2 = src[i + 2];
    const x0 = pos.getX(i0), z0 = pos.getZ(i0);
    const x1 = pos.getX(i1), z1 = pos.getZ(i1);
    const x2 = pos.getX(i2), z2 = pos.getZ(i2);
    const cx = (x0 + x1 + x2) / 3;
    const cz = (z0 + z1 + z2) / 3;

    // 1. Drop triangles inside the Wishing Well shaft
    if (
      Math.hypot(cx - WELL_CX, cz - WELL_CZ) < WELL_CUTOUT_R ||
      (Math.hypot(x0 - WELL_CX, z0 - WELL_CZ) < WELL_CUTOUT_R &&
       Math.hypot(x1 - WELL_CX, z1 - WELL_CZ) < WELL_CUTOUT_R &&
       Math.hypot(x2 - WELL_CX, z2 - WELL_CZ) < WELL_CUTOUT_R)
    ) {
      continue;
    }

    // 2. Drop any triangle whose AABB or centroid overlaps any of the 3 open stairwells
    const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
    const minZ = Math.min(z0, z1, z2), maxZ = Math.max(z0, z1, z2);
    let hitStair = false;
    for (let k = 0; k < STAIRS.length; k++) {
      const s = STAIRS[k];
      if (
        maxX > s.x0 + innerPad && minX < s.x1 - innerPad &&
        maxZ > s.z0 + innerPad && minZ < s.z1 - innerPad
      ) {
        hitStair = true;
        break;
      }
    }
    if (!hitStair) {
      kept.push(i0, i1, i2);
    }
  }

  groundGeometry.setIndex(kept);
  groundGeometry.computeBoundingSphere();
  return groundGeometry;
}

// ============================================================================
// Multi-Tier refY-Aware Height Sampler
// ============================================================================
function evalStairRampY(s, x, z) {
  if (s.axis === 'x') {
    const t = clamp((x - s.bottomX) / (s.topX - s.bottomX), 0, 1);
    return Y_UNDER + t * (0 - Y_UNDER);
  }
  const t = clamp((z - s.bottomZ) / (s.topZ - s.bottomZ), 0, 1);
  return Y_UNDER + t * (0 - Y_UNDER);
}

export function sampleUndergroundHeight(x, z, refY) {
  // 1. Check the 3 walkable stairwell ramps first (active from underground up to refY < 0.85)
  if (typeof refY !== 'number' || refY < 0.85) {
    for (let i = 0; i < STAIRS.length; i++) {
      const s = STAIRS[i];
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) {
        return evalStairRampY(s, x, z);
      }
    }
  }

  // 2. Check underground chambers & connecting tunnels (active ONLY when already below -0.65)
  if (typeof refY === 'number' && refY < -0.65) {
    const pad = 0.08; // tiny seam pad at ramp-to-chamber thresholds
    for (let i = 0; i < UNDERGROUND_BOXES.length; i++) {
      const b = UNDERGROUND_BOXES[i];
      if (x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad) {
        return Y_UNDER;
      }
    }
  }

  return null;
}

// ============================================================================
// Custom Underground Prop Builders (Merged, metalness: 0, warm Storybook textures)
// ============================================================================
export function buildUndergroundPropBuilders(THREE) {
  const matCache = {};
  const M = (hex, texName, rx = 1, ry = 1, extra = {}) => {
    const key = `${hex}|${texName || ''}|${rx}|${ry}|${JSON.stringify(extra)}`;
    if (!matCache[key]) {
      const map = texName ? kitTex(THREE, texName, rx, ry) : null;
      matCache[key] = new THREE.MeshStandardMaterial({
        color: hex,
        map,
        roughness: 0.92,
        metalness: 0,
        ...extra,
      });
    }
    return matCache[key];
  };

  const rbox = (w, h, d, r, mat) => new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.98),
    mat
  );

  // 1. Aged Cheese Wheel (radius: 0.42, height: 0.56)
  function buildCheeseWheel() {
    const g = new THREE.Group();
    g.name = 'mb_cheese_wheel';
    const boardMat = M(0xb98552, 'wood_light', 0.8, 0.8);
    const rindMat = M(0xf0a830, 'plaster', 0.7, 0.7, { roughness: 0.85 });
    const pasteMat = M(0xffe484, 'plaster', 0.5, 0.5, { roughness: 0.88 });
    const waxSealMat = M(0xc84236, 'plaster', 0.5, 0.5, { roughness: 0.8 });
    const twineMat = M(0xe4cfa4, 'burlap', 1.4, 1.4);

    // Round oak aging platter
    const board = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.41, 0.05, 20), boardMat);
    board.position.y = 0.025;
    g.add(board);

    // Main aged golden wheel with a cut tasting wedge gap (thetaLength = 5.45 rad)
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.355, 0.365, 0.30, 22, 1, false, 0.42, Math.PI * 2 - 0.84),
      rindMat
    );
    wheel.position.y = 0.20;
    g.add(wheel);

    // Creamy interior cut faces on the wedge opening
    for (const ang of [0.42, -0.42]) {
      const cutFace = rbox(0.34, 0.285, 0.03, 0.01, pasteMat);
      cutFace.position.set(Math.sin(ang) * 0.17, 0.20, Math.cos(ang) * 0.17);
      cutFace.rotation.y = ang + Math.PI / 2;
      g.add(cutFace);
    }

    // Small sliced wedge resting beside the cut
    const wedge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.185, 0.12, 8, 1, false, -0.26, 0.52),
      pasteMat
    );
    wedge.position.set(0.06, 0.11, 0.22);
    wedge.rotation.y = 0.18;
    g.add(wedge);

    // Upper stacked wheel of cellar cheddar + red farm wax stamp + hemp twine
    const topWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.225, 0.19, 18), rindMat);
    topWheel.position.set(-0.04, 0.445, -0.03);
    topWheel.rotation.z = 0.03;
    g.add(topWheel);

    const twine = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.014, 6, 20), twineMat);
    twine.rotation.x = Math.PI / 2;
    twine.position.set(-0.04, 0.445, -0.03);
    g.add(twine);

    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.02, 12), waxSealMat);
    seal.position.set(0.02, 0.545, 0.02);
    g.add(seal);

    mergeStatic(THREE, g);
    enforceZeroMetalness(g);
    return g;
  }

  // 2. Oak Cider Cask (radius: 0.48, height: 0.92)
  function buildCiderCask() {
    const g = new THREE.Group();
    g.name = 'mb_cider_cask';
    const staveMat = M(0xb67a45, 'wood_planks_dark', 1.2, 1.2);
    const headMat = M(0xcf9960, 'wood_light', 0.9, 0.9);
    const chockMat = M(0x7c5130, 'wood_planks_dark', 0.8, 0.8);
    const hoopMat = M(0x463e38, 'painted_metal', 0.8, 0.8, { roughness: 0.84 });
    const tapMat = M(0xd8a448, 'wood_light', 0.6, 0.6, { roughness: 0.78 });
    const appleMat = M(0xd94d3d, 'terracotta', 0.5, 0.5, { roughness: 0.82 });
    const leafMat = M(0x5fa145, 'leaves', 0.6, 0.6);

    // Timber floor chocks so the cask sits firmly off damp cellar stone
    for (const sx of [-0.22, 0.22]) {
      const chock = rbox(0.11, 0.07, 0.66, 0.025, chockMat);
      chock.position.set(sx, 0.035, 0);
      g.add(chock);
    }

    // Swelling coopered oak barrel profile (exact 0.92m total prop height with apple emblem)
    const pts = [
      new THREE.Vector2(0.0, 0.06),
      new THREE.Vector2(0.35, 0.06),
      new THREE.Vector2(0.42, 0.22),
      new THREE.Vector2(0.455, 0.44),
      new THREE.Vector2(0.42, 0.66),
      new THREE.Vector2(0.35, 0.82),
      new THREE.Vector2(0.0, 0.82),
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), staveMat);
    g.add(body);

    // Recessed top head disc
    const topHead = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.024, 18), headMat);
    topHead.position.y = 0.822;
    g.add(topHead);

    // Four wrought-iron barrel hoops
    for (const [hy, hr] of [[0.13, 0.382], [0.30, 0.444], [0.58, 0.444], [0.75, 0.382]]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(hr, 0.018, 6, 22), hoopMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      g.add(hoop);
    }

    // Wooden cider tap spigot on front (+Z)
    const spigotStem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.15, 10), tapMat);
    spigotStem.rotation.x = Math.PI / 2;
    spigotStem.position.set(0, 0.25, 0.45);
    g.add(spigotStem);

    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.09, 8), tapMat);
    spout.position.set(0, 0.21, 0.50);
    g.add(spout);

    const handle = rbox(0.11, 0.026, 0.028, 0.01, chockMat);
    handle.position.set(0, 0.30, 0.48);
    g.add(handle);

    // Cork bung + charming painted orchard apple emblem on top
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), appleMat);
    apple.scale.set(1.05, 0.85, 1.05);
    apple.position.set(0.08, 0.865, -0.05);
    g.add(apple);

    const leaf = rbox(0.055, 0.014, 0.032, 0.006, leafMat);
    leaf.position.set(0.11, 0.908, -0.04);
    leaf.rotation.set(0.2, 0.4, 0.35);
    g.add(leaf);

    mergeStatic(THREE, g);
    enforceZeroMetalness(g);
    return g;
  }

  // 3. Glow-Shroom Pot (radius: 0.36, height: 0.68)
  function buildGlowShroomPot() {
    const g = new THREE.Group();
    g.name = 'mb_glow_shroom_pot';
    const potMat = M(0xd27d56, 'terracotta', 0.9, 0.9);
    const soilMat = M(0x523924, 'bark', 0.8, 0.8);
    const mossMat = M(0x5d9a42, 'leaves', 0.8, 0.8);
    const stemMat = M(0xf6ead2, 'plaster', 0.5, 0.5, { roughness: 0.85 });
    const amberCapMat = M(0xffbe55, 'plaster', 0.5, 0.5, {
      emissive: 0xff9b28,
      emissiveIntensity: 0.78,
      roughness: 0.72,
    });
    const tealCapMat = M(0x6af0d2, 'plaster', 0.5, 0.5, {
      emissive: 0x2cc9a8,
      emissiveIntensity: 0.72,
      roughness: 0.72,
    });
    const dotMat = M(0xfff8e6, null, { emissive: 0xffe4a8, emissiveIntensity: 0.45, roughness: 0.8 });

    // Squat terracotta garden pot
    const potPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.19, 0.0),
      new THREE.Vector2(0.26, 0.23),
      new THREE.Vector2(0.29, 0.25),
      new THREE.Vector2(0.29, 0.30),
      new THREE.Vector2(0.24, 0.30),
      new THREE.Vector2(0.23, 0.25),
      new THREE.Vector2(0.0, 0.25),
    ];
    g.add(new THREE.Mesh(new THREE.LatheGeometry(potPts, 18), potMat));

    const soil = new THREE.Mesh(new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), soilMat);
    soil.scale.set(1, 0.32, 1);
    soil.position.y = 0.24;
    g.add(soil);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065, 0), mossMat);
      tuft.scale.set(1.2, 0.55, 1.1);
      tuft.position.set(Math.cos(a) * 0.15, 0.28, Math.sin(a) * 0.15);
      g.add(tuft);
    }

    // Trio of glowing Storybook cave mushrooms (amber + soft-teal + baby amber)
    const shrooms = [
      { x: -0.03, z: -0.02, h: 0.31, r: 0.155, tiltX: 0.08, tiltZ: -0.07, mat: amberCapMat },
      { x: 0.10, z: 0.07, h: 0.21, r: 0.115, tiltX: -0.14, tiltZ: -0.16, mat: tealCapMat },
      { x: -0.11, z: 0.08, h: 0.14, r: 0.085, tiltX: 0.15, tiltZ: 0.14, mat: amberCapMat },
    ];
    for (const sh of shrooms) {
      const sg = new THREE.Group();
      sg.position.set(sh.x, 0.27, sh.z);
      sg.rotation.set(sh.tiltX, 0, sh.tiltZ);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(sh.r * 0.26, sh.r * 0.36, sh.h, 10), stemMat);
      stem.position.y = sh.h * 0.5;
      sg.add(stem);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(sh.r, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
        sh.mat
      );
      cap.scale.set(1, 0.82, 1);
      cap.position.y = sh.h * 0.92;
      sg.add(cap);

      for (let d = 0; d < 4; d++) {
        const da = (d / 4) * Math.PI * 2 + 0.5;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(sh.r * 0.14, 6, 6), dotMat);
        dot.position.set(Math.cos(da) * sh.r * 0.55, sh.h * 0.92 + sh.r * 0.46, Math.sin(da) * sh.r * 0.55);
        sg.add(dot);
      }
      g.add(sg);
    }

    mergeStatic(THREE, g);
    enforceZeroMetalness(g);
    return g;
  }

  // 4. Glow-Crystal Crate (radius: 0.44, height: 0.76) — Iron-strapped oak miner's crate brimming with Celestia crystals!
  function buildCrystalCrate() {
    const g = new THREE.Group();
    g.name = 'mb_crystal_crate';
    const plankMat = M(0xa97444, 'wood_light', 1.0, 1.0);
    const frameMat = M(0x784e2e, 'wood_planks_dark', 0.9, 0.9);
    const strapMat = M(0x413a35, 'painted_metal', 0.8, 0.8, { roughness: 0.82 });
    const strawMat = M(0xe8c565, 'hay', 1.1, 1.1);
    const skyCrystalMat = M(0x66e8ff, null, 1, 1, {
      emissive: 0x22b8e8,
      emissiveIntensity: 0.88,
      roughness: 0.35,
    });
    const amberCrystalMat = M(0xffca58, null, 1, 1, {
      emissive: 0xf08c1d,
      emissiveIntensity: 0.78,
      roughness: 0.40,
    });

    // Sturdy slatted oak miner's crate body (0.62 x 0.44 x 0.56)
    const box = rbox(0.60, 0.42, 0.54, 0.03, plankMat);
    box.position.y = 0.22;
    g.add(box);

    // Corner posts + top rim rails + iron corner straps
    for (const sx of [-0.29, 0.29]) {
      for (const sz of [-0.26, 0.26]) {
        const post = rbox(0.075, 0.45, 0.075, 0.015, frameMat);
        post.position.set(sx, 0.225, sz);
        g.add(post);
        const strap = rbox(0.09, 0.055, 0.09, 0.01, strapMat);
        strap.position.set(sx, 0.40, sz);
        g.add(strap);
      }
    }
    for (const sz of [-0.26, 0.26]) {
      const rail = rbox(0.64, 0.06, 0.06, 0.015, frameMat);
      rail.position.set(0, 0.42, sz);
      g.add(rail);
    }

    // Rope handles on left/right ends + golden packing straw mound inside
    for (const sx of [-0.31, 0.31]) {
      const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 5, 10, Math.PI), frameMat);
      hnd.rotation.set(Math.PI, Math.PI * 0.5, 0);
      hnd.position.set(sx, 0.31, 0);
      g.add(hnd);
    }
    const straw = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 7), strawMat);
    straw.scale.set(1.02, 0.38, 0.90);
    straw.position.y = 0.40;
    g.add(straw);

    // 5 faceted hexagonal Celestia crystal shards jutting warmly from the straw
    const shards = [
      { x: -0.02, z: 0.01, r: 0.095, h: 0.34, rx: 0.10, rz: -0.08, mat: skyCrystalMat },
      { x: 0.13, z: -0.06, r: 0.072, h: 0.26, rx: -0.18, rz: -0.22, mat: skyCrystalMat },
      { x: -0.14, z: -0.05, r: 0.068, h: 0.23, rx: -0.14, rz: 0.24, mat: amberCrystalMat },
      { x: 0.08, z: 0.11, r: 0.062, h: 0.20, rx: 0.24, rz: -0.14, mat: amberCrystalMat },
      { x: -0.10, z: 0.10, r: 0.058, h: 0.19, rx: 0.20, rz: 0.18, mat: skyCrystalMat },
    ];
    for (const sh of shards) {
      const prism = new THREE.Group();
      prism.position.set(sh.x, 0.41, sh.z);
      prism.rotation.set(sh.rx, sh.x * 3.0, sh.rz);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(sh.r * 0.86, sh.r, sh.h * 0.68, 6), sh.mat);
      shaft.position.y = sh.h * 0.34;
      prism.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(sh.r * 0.86, sh.h * 0.36, 6), sh.mat);
      tip.position.y = sh.h * 0.86;
      prism.add(tip);
      g.add(prism);
    }

    mergeStatic(THREE, g);
    enforceZeroMetalness(g);
    return g;
  }

  return {
    mb_cheese_wheel: buildCheeseWheel,
    mb_cider_cask: buildCiderCask,
    mb_glow_shroom_pot: buildGlowShroomPot,
    mb_crystal_crate: buildCrystalCrate,
  };
}

// Module-level active boiler steam clouds for Seeker & AI Line-of-Sight occlusion
let ACTIVE_UNDER_STEAM_CLOUDS = [];
const UNDER_STEAM_LOS_RADIUS = 2.65;

export function breaksUndergroundLOS(from, to) {
  if (!from || !to || !ACTIVE_UNDER_STEAM_CLOUDS.length) return false;
  const fx = from.x ?? 0, fy = from.y ?? Y_UNDER + 1.0, fz = from.z ?? 0;
  const dx = (to.x ?? 0) - fx, dy = (to.y ?? Y_UNDER + 1.0) - fy, dz = (to.z ?? 0) - fz;
  const lenSq = dx * dx + dy * dy + dz * dz;
  const rSq = UNDER_STEAM_LOS_RADIUS * UNDER_STEAM_LOS_RADIUS;
  for (let i = 0; i < ACTIVE_UNDER_STEAM_CLOUDS.length; i++) {
    const c = ACTIVE_UNDER_STEAM_CLOUDS[i];
    if (!c || c.age >= c.dur) continue;
    const t = lenSq > 1e-8 ? clamp(((c.x - fx) * dx + (c.y - fy) * dy + (c.z - fz) * dz) / lenSq, 0, 1) : 0;
    const qx = fx + dx * t - c.x, qy = fy + dy * t - c.y, qz = fz + dz * t - c.z;
    if (qx * qx + qy * qy + qz * qz <= rSq) return true;
  }
  return false;
}

// Custom Disguise Meshes for the 3 Underground Signature Hiding Spots
export function buildUndergroundSpotDisguise(THREE, inter) {
  const dtype = inter?.disguiseType || inter?.spotType || '';
  const root = new THREE.Group();
  const mkMat = (hex, texName = null, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      map: texName ? kitTex(THREE, texName, 1, 1) : null,
      roughness: 0.88,
      metalness: 0,
      ...extra,
    });

  if (dtype === 'cider_tun_lid') {
    // Foaming golden apple-cider fermentation cap + floating apples + wooden mash paddle atop the Giant Cider Tun!
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.18, 0);
    const lidWood = mkMat(0xb9824c, 'wood_light');
    const foamMat = mkMat(0xfff4d4, 'plaster', { emissive: 0xd99b38, emissiveIntensity: 0.18, roughness: 0.72 });
    const appleRed = mkMat(0xd93e32, null, { roughness: 0.36 });

    const halfLid = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 16, 1, false, 0, Math.PI), lidWood);
    halfLid.position.set(0, 0.04, 0);
    pivot.add(halfLid);
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 16), foamMat);
    foam.position.set(0, 0.01, 0);
    pivot.add(foam);
    for (const [ax, az] of [[-0.22, -0.18], [0.18, -0.24], [0.04, -0.34], [-0.14, 0.12]]) {
      const ap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), appleRed);
      ap.position.set(ax, 0.06, az);
      pivot.add(ap);
    }
    const paddle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.82, 7), lidWood);
    paddle.position.set(0.18, 0.28, -0.10);
    paddle.rotation.set(0.24, 0.2, -0.36);
    pivot.add(paddle);

    mergeStatic(THREE, pivot);
    enforceZeroMetalness(pivot);
    pivot.userData.keep = true;
    root.add(pivot);
    root.userData.tunPivot = pivot;
    return root;
  }

  if (dtype === 'minecart_pile') {
    // Heaped burlap, harvest pumpkins & glowing Celestia crystals crowning the Timber Harvest Minecart!
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.76, 0);
    const burlap = mkMat(0xdfc696, 'burlap');
    const pumpMat = mkMat(0xe87b28, 'terracotta', { roughness: 0.72 });
    const crystal = mkMat(0x66e8ff, null, { emissive: 0x22b8e8, emissiveIntensity: 0.85, roughness: 0.35 });

    const tarp = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 8), burlap);
    tarp.scale.set(1.22, 0.52, 0.88);
    pivot.add(tarp);
    for (const [px, py, pz, r] of [[-0.24, 0.16, 0.06, 0.16], [0.22, 0.15, -0.08, 0.15]]) {
      const pm = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), pumpMat);
      pm.scale.set(1.08, 0.82, 1.08);
      pm.position.set(px, py, pz);
      pivot.add(pm);
    }
    for (const [cx, cz, h, rz] of [[0.0, 0.05, 0.34, -0.14], [-0.08, -0.12, 0.26, 0.22], [0.12, 0.10, 0.24, -0.24]]) {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.085, h, 6), crystal);
      sh.position.set(cx, 0.22, cz);
      sh.rotation.z = rz;
      pivot.add(sh);
    }
    mergeStatic(THREE, pivot);
    enforceZeroMetalness(pivot);
    pivot.userData.keep = true;
    root.add(pivot);
    return root;
  }

  // Default: 'moss_curtain' — Cascading cave fern & mossy water curtain in the Culvert Grotto!
  const pivot = new THREE.Group();
  pivot.position.set(0, 1.85, 0);
  const moss = mkMat(0x52963d, 'leaves', { side: THREE.DoubleSide });
  const vine = mkMat(0x6cb34f, 'leaves', { side: THREE.DoubleSide });
  const spray = mkMat(0x7adcf0, null, { emissive: 0x278fa8, emissiveIntensity: 0.45, roughness: 0.30 });
  for (let i = -3; i <= 3; i++) {
    const h = 1.48 + (Math.abs(i) % 2) * 0.22;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.14, h, 5), i % 2 === 0 ? moss : vine);
    frond.rotation.x = Math.PI;
    frond.position.set(i * 0.15, -h * 0.5, (i % 2) * 0.04);
    pivot.add(frond);
  }
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.65, 8), spray);
  drop.scale.set(1.15, 1.0, 0.28);
  drop.position.set(0, -0.88, -0.05);
  pivot.add(drop);
  mergeStatic(THREE, pivot);
  enforceZeroMetalness(pivot);
  pivot.userData.keep = true;
  root.add(pivot);
  root.userData.curtainPivot = pivot;
  return root;
}

// ============================================================================
// World Builder: Surface Portals + Underground Network + Auto-Gated Lights + AI Router
// ============================================================================
export function buildUndergroundWorld(THREE, env = {}) {
  const { mapRoot, solids = [], blockers = [], addSpot, addVig } = env;
  const rng = makeRng(137);

  const surfacePortalsGroup = new THREE.Group();
  surfacePortalsGroup.name = 'meadow_underground_portals';
  const surfaceWalkable = new THREE.Group();
  const surfaceDecor = new THREE.Group();
  surfacePortalsGroup.add(surfaceWalkable, surfaceDecor);

  const undergroundGroup = new THREE.Group();
  undergroundGroup.name = 'meadow_underground_network';
  const underWalkable = new THREE.Group();
  const underArch = new THREE.Group();
  const underGlow = new THREE.Group();
  underGlow.userData.keep = true;
  undergroundGroup.add(underWalkable, underArch, underGlow);

  if (mapRoot) {
    mapRoot.add(surfacePortalsGroup);
    mapRoot.add(undergroundGroup);
  }

  // ---------------- Shared Hand-Painted Kit Materials (metalness: 0)
  const matCache = {};
  const M = (hex, texName, rx = 1, ry = 1, extra = {}) => {
    const key = `${hex}|${texName || ''}|${rx}|${ry}|${JSON.stringify(extra)}`;
    if (!matCache[key]) {
      const map = texName ? kitTex(THREE, texName, rx, ry) : null;
      matCache[key] = new THREE.MeshStandardMaterial({
        color: hex,
        map,
        roughness: 0.94,
        metalness: 0,
        ...extra,
      });
    }
    return matCache[key];
  };

  const grassSkirtMat = M(0x7fb35a, 'leaves', 3.2, 3.2, { roughness: 0.98 });
  const cobbleFloorMat = M(0xd8cfc0, 'stone', 2.6, 2.6, { roughness: 0.95 });
  const cellarFloorMat = M(0xcab99f, 'stone', 2.2, 2.2, { roughness: 0.95 });
  const stoneWallMat = M(0xd4cdc2, 'stone', 1.8, 1.2, { roughness: 0.95 });
  const mossyStoneMat = M(0xb8cbb0, 'stone', 1.6, 1.4, { roughness: 0.95 });
  const brickVaultMat = M(0xd89f84, 'terracotta', 2.0, 1.4, { roughness: 0.92 });
  const ceilingPlasterMat = M(0xe6dac6, 'plaster', 2.0, 2.0, { roughness: 0.96 });
  const timberMat = M(0xa97648, 'wood_light', 1.2, 1.2, { roughness: 0.92 });
  const darkTimberMat = M(0x7d5333, 'wood_planks_dark', 1.2, 1.2, { roughness: 0.92 });
  const barkRootMat = M(0x7c583a, 'bark', 1.4, 1.4, { roughness: 0.95 });
  const burlapMat = M(0xe2cca2, 'burlap', 1.2, 1.2, { roughness: 0.95 });
  const ironMat = M(0x3f3934, 'painted_metal', 0.8, 0.8, { roughness: 0.84 });
  const mossLeafMat = M(0x5b9b42, 'leaves', 1.0, 1.0, { roughness: 0.92 });
  const cheeseDecorMat = M(0xf0ad38, 'plaster', 0.6, 0.6, { roughness: 0.86 });
  const stemMat = M(0xf5ead2, 'plaster', 0.5, 0.5, { roughness: 0.88 });

  // Pulsing bioluminescent & lantern materials (updated cheaply in update())
  const amberShroomMat = new THREE.MeshStandardMaterial({
    color: 0xffc45c,
    emissive: 0xff9824,
    emissiveIntensity: 0.95,
    roughness: 0.72,
    metalness: 0,
  });
  const tealShroomMat = new THREE.MeshStandardMaterial({
    color: 0x72f3d6,
    emissive: 0x2cd4b2,
    emissiveIntensity: 0.88,
    roughness: 0.72,
    metalness: 0,
  });
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a8,
    emissive: 0xffad42,
    emissiveIntensity: 1.45,
    roughness: 0.55,
    metalness: 0,
  });
  const poolWaterMat = new THREE.MeshStandardMaterial({
    color: 0x56b9c8,
    emissive: 0x1b6878,
    emissiveIntensity: 0.42,
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.86,
  });
  const sunShaftMat = new THREE.MeshBasicMaterial({
    color: 0xdff6ff,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const addBox = (parent, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };

  const addRBox = (parent, w, h, d, r, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.98),
      mat
    );
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };

  const pushBlocker = (x0, x1, z0, z1, y0, y1, standable = false) => {
    blockers.push({
      x0: Math.min(x0, x1),
      x1: Math.max(x0, x1),
      z0: Math.min(z0, z1),
      z1: Math.max(z0, z1),
      y0,
      y1,
      standable,
    });
  };

  // Helper: Build an underground wall + matching vertical-ranged blocker (y0: -3.65, y1: -0.78)
  const WALL_H = Y_CEIL - Y_UNDER + 0.08;
  const WALL_CY = (Y_UNDER + Y_CEIL) * 0.5;
  const WALL_T = 0.34;
  function addUnderWallX(z, x0, x1, mat = stoneWallMat) {
    const len = x1 - x0;
    if (len <= 0.05) return;
    const cx = (x0 + x1) * 0.5;
    addBox(underArch, len + 0.16, WALL_H, WALL_T, mat, cx, WALL_CY, z);
    // Warm timber wainscot rail & cornice beam
    addBox(underArch, len + 0.12, 0.14, WALL_T + 0.06, darkTimberMat, cx, Y_UNDER + 0.10, z);
    addBox(underArch, len + 0.12, 0.16, WALL_T + 0.08, timberMat, cx, Y_CEIL - 0.09, z);
    pushBlocker(x0, x1, z - WALL_T * 0.5, z + WALL_T * 0.5, -3.65, Y_CEIL, false);
  }

  function addUnderWallZ(x, z0, z1, mat = stoneWallMat) {
    const len = z1 - z0;
    if (len <= 0.05) return;
    const cz = (z0 + z1) * 0.5;
    addBox(underArch, WALL_T, WALL_H, len + 0.16, mat, x, WALL_CY, cz);
    addBox(underArch, WALL_T + 0.06, 0.14, len + 0.12, darkTimberMat, x, Y_UNDER + 0.10, cz);
    addBox(underArch, WALL_T + 0.08, 0.16, len + 0.12, timberMat, x, Y_CEIL - 0.09, cz);
    pushBlocker(x - WALL_T * 0.5, x + WALL_T * 0.5, z0, z1, -3.65, Y_CEIL, false);
  }

  // Helper: Hanging warm wrought-iron lantern
  function addLantern(x, y, z, withChain = true) {
    if (withChain) {
      const chH = Math.max(0.12, Y_CEIL - y);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, chH, 6), ironMat);
      chain.position.set(x, y + chH * 0.5, z);
      underArch.add(chain);
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.11, 6), ironMat);
    cap.position.set(x, y + 0.13, z);
    underArch.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.04, 6), ironMat);
    base.position.set(x, y - 0.11, z);
    underArch.add(base);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.20, 8), lanternGlassMat);
    core.position.set(x, y, z);
    underGlow.add(core);
  }

  // Helper: Cluster of bioluminescent Storybook cave mushrooms
  function addGlowShroomCluster(cx, cz, count = 4, preferTeal = false) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.jr(-0.3, 0.3);
      const r = i === 0 ? 0 : rng.jr(0.12, 0.30);
      const sx = cx + Math.cos(a) * r;
      const sz = cz + Math.sin(a) * r;
      const h = rng.jr(0.16, 0.38);
      const cr = h * rng.jr(0.42, 0.55);
      const isTeal = preferTeal ? (i % 3 !== 0) : (i % 2 === 1);

      const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(cr * 0.75, 0), mossLeafMat);
      moss.scale.set(1.3, 0.45, 1.3);
      moss.position.set(sx, Y_UNDER + 0.03, sz);
      underArch.add(moss);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(cr * 0.24, cr * 0.34, h, 8), stemMat);
      stem.position.set(sx, Y_UNDER + h * 0.5, sz);
      underArch.add(stem);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(cr, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
        isTeal ? tealShroomMat : amberShroomMat
      );
      cap.scale.set(1, 0.82, 1);
      cap.position.set(sx, Y_UNDER + h * 0.92, sz);
      underGlow.add(cap);
    }
  }

  // Helper: Timber portal arch frame at corridor mouths (3.6m+ clear span)
  function addPortalFrameX(z, x0, x1) {
    const h = Y_CEIL - Y_UNDER;
    for (const px of [x0 + 0.12, x1 - 0.12]) {
      addRBox(underArch, 0.26, h, 0.36, 0.04, timberMat, px, Y_UNDER + h * 0.5, z);
    }
    addRBox(underArch, x1 - x0 + 0.2, 0.24, 0.40, 0.04, timberMat, (x0 + x1) * 0.5, Y_CEIL - 0.12, z);
  }

  function addPortalFrameZ(x, z0, z1) {
    const h = Y_CEIL - Y_UNDER;
    for (const pz of [z0 + 0.12, z1 - 0.12]) {
      addRBox(underArch, 0.36, h, 0.26, 0.04, timberMat, x, Y_UNDER + h * 0.5, pz);
    }
    addRBox(underArch, 0.40, 0.24, z1 - z0 + 0.2, 0.04, timberMat, x, Y_CEIL - 0.12, (z0 + z1) * 0.5);
  }

  // ==========================================================================
  // 1. Underground Floors & Vaulted Ceilings (with 1.6m x 1.6m Well Shaft!)
  // ==========================================================================
  const addFloorSlab = (b, mat) => {
    addBox(underWalkable, b.x1 - b.x0 + 0.25, 0.18, b.z1 - b.z0 + 0.25, mat,
      (b.x0 + b.x1) * 0.5, Y_UNDER - 0.09, (b.z0 + b.z1) * 0.5);
  };
  addFloorSlab(CISTERN_BOX, cobbleFloorMat);
  addFloorSlab(TUNNEL_EAST, cobbleFloorMat);
  addFloorSlab(CELLAR_EAST, cellarFloorMat);
  addFloorSlab(TUNNEL_WEST, cobbleFloorMat);
  addFloorSlab(VAULT_WEST, cellarFloorMat);
  addFloorSlab(TUNNEL_NE, cobbleFloorMat);
  addFloorSlab(CHAMBER_CULVERT, cobbleFloorMat);

  // Ceilings (underside at Y_CEIL = -0.78; Cistern ceiling leaves 1.6m x 1.6m shaft at [0.7, 2.3] x [0.7, 2.3])
  const addCeilRect = (x0, x1, z0, z1, mat = ceilingPlasterMat) => {
    addBox(underArch, x1 - x0 + 0.2, 0.22, z1 - z0 + 0.2, mat,
      (x0 + x1) * 0.5, Y_CEIL + 0.11, (z0 + z1) * 0.5);
  };
  // Cistern 4 ceiling panels framing the 1.6m x 1.6m vertical stone shaft [0.70..2.30, 0.70..2.30]
  addCeilRect(CISTERN_BOX.x0, CISTERN_BOX.x1, CISTERN_BOX.z0, 0.70);
  addCeilRect(CISTERN_BOX.x0, CISTERN_BOX.x1, 2.30, CISTERN_BOX.z1);
  addCeilRect(CISTERN_BOX.x0, 0.70, 0.70, 2.30);
  addCeilRect(2.30, CISTERN_BOX.x1, 0.70, 2.30);

  for (const b of [TUNNEL_EAST, CELLAR_EAST, TUNNEL_WEST, VAULT_WEST, TUNNEL_NE, CHAMBER_CULVERT]) {
    addCeilRect(b.x0, b.x1, b.z0, b.z1, b === CHAMBER_CULVERT ? brickVaultMat : ceilingPlasterMat);
  }

  // Overhead oak ceiling rafters across chambers & corridors
  for (const zx of [-2.4, 0.3, 2.7, 5.4]) {
    if (Math.abs(zx - 1.5) > 1.05) {
      addRBox(underArch, CISTERN_BOX.x1 - CISTERN_BOX.x0, 0.18, 0.22, 0.03, timberMat, 1.5, Y_CEIL - 0.07, zx);
    }
  }
  for (let x = 8.4; x <= 13.8; x += 1.8) addRBox(underArch, 0.20, 0.16, 3.6, 0.03, timberMat, x, Y_CEIL - 0.06, -2.0);
  for (let z = -9.6; z <= -1.2; z += 2.1) addRBox(underArch, 6.8, 0.18, 0.22, 0.03, timberMat, 18.2, Y_CEIL - 0.07, z);
  for (let x = -11.6; x <= -5.4; x += 2.0) addRBox(underArch, 0.20, 0.16, 3.6, 0.03, timberMat, x, Y_CEIL - 0.06, 1.6);
  for (let x = -18.4; x <= -14.0; x += 2.2) addRBox(underArch, 0.22, 0.18, 7.6, 0.03, timberMat, x, Y_CEIL - 0.07, 1.4);
  for (let z = 8.4; z <= 12.8; z += 2.2) addRBox(underArch, 3.8, 0.16, 0.20, 0.03, timberMat, 4.1, Y_CEIL - 0.06, z);
  for (let x = 7.4; x <= 11.6; x += 2.1) addRBox(underArch, 0.20, 0.18, 5.4, 0.03, brickVaultMat, x, Y_CEIL - 0.07, 11.3);

  // ==========================================================================
  // 2. Sealed Perimeter Underground Walls (y0: -3.65, y1: -0.78)
  // ==========================================================================
  // A. Central Cistern
  addUnderWallX(CISTERN_BOX.z0, CISTERN_BOX.x0, CISTERN_BOX.x1, mossyStoneMat);
  addUnderWallX(CISTERN_BOX.z1, CISTERN_BOX.x0, 2.2, mossyStoneMat);
  addUnderWallX(CISTERN_BOX.z1, 6.0, CISTERN_BOX.x1, mossyStoneMat);
  addUnderWallZ(CISTERN_BOX.x0, CISTERN_BOX.z0, -0.2, mossyStoneMat);
  addUnderWallZ(CISTERN_BOX.x0, 3.4, CISTERN_BOX.z1, mossyStoneMat);
  addUnderWallZ(CISTERN_BOX.x1, CISTERN_BOX.z0, -3.8, mossyStoneMat);
  addUnderWallZ(CISTERN_BOX.x1, -0.2, CISTERN_BOX.z1, mossyStoneMat);

  // B. East Corridor & Cheese Cellar
  addUnderWallX(TUNNEL_EAST.z0, TUNNEL_EAST.x0, TUNNEL_EAST.x1, stoneWallMat);
  addUnderWallX(TUNNEL_EAST.z1, TUNNEL_EAST.x0, TUNNEL_EAST.x1, stoneWallMat);
  addUnderWallX(CELLAR_EAST.z0, CELLAR_EAST.x0, CELLAR_EAST.x1, stoneWallMat);
  addUnderWallX(CELLAR_EAST.z1, CELLAR_EAST.x0, CELLAR_EAST.x1, stoneWallMat);
  addUnderWallZ(CELLAR_EAST.x1, CELLAR_EAST.z0, CELLAR_EAST.z1, stoneWallMat);
  addUnderWallZ(CELLAR_EAST.x0, -11.2, -10.6, stoneWallMat);
  addUnderWallZ(CELLAR_EAST.x0, -7.0, -3.8, stoneWallMat);
  addUnderWallZ(CELLAR_EAST.x0, -0.2, 0.4, stoneWallMat);

  // C. West Corridor & Root Vault
  addUnderWallX(TUNNEL_WEST.z0, TUNNEL_WEST.x0, TUNNEL_WEST.x1, stoneWallMat);
  addUnderWallX(TUNNEL_WEST.z1, TUNNEL_WEST.x0, TUNNEL_WEST.x1, stoneWallMat);
  addUnderWallX(VAULT_WEST.z0, VAULT_WEST.x0, VAULT_WEST.x1, mossyStoneMat);
  addUnderWallX(VAULT_WEST.z1, VAULT_WEST.x0, VAULT_WEST.x1, mossyStoneMat);
  addUnderWallZ(VAULT_WEST.x1, -2.4, -0.2, mossyStoneMat);
  addUnderWallZ(VAULT_WEST.x1, 3.4, 5.2, mossyStoneMat);
  addUnderWallZ(VAULT_WEST.x0, -2.4, -0.2, mossyStoneMat);
  addUnderWallZ(VAULT_WEST.x0, 3.4, 5.2, mossyStoneMat);

  // D. North-East Corridor & Mossy Culvert Chamber
  addUnderWallZ(TUNNEL_NE.x0, TUNNEL_NE.z0, TUNNEL_NE.z1, brickVaultMat);
  addUnderWallX(TUNNEL_NE.z1, TUNNEL_NE.x0, TUNNEL_NE.x1, brickVaultMat);
  addUnderWallZ(TUNNEL_NE.x1, 7.2, 8.6, brickVaultMat);
  addUnderWallX(CHAMBER_CULVERT.z0, CHAMBER_CULVERT.x0, CHAMBER_CULVERT.x1, brickVaultMat);
  addUnderWallZ(CHAMBER_CULVERT.x1, CHAMBER_CULVERT.z0, CHAMBER_CULVERT.z1, brickVaultMat);
  addUnderWallX(CHAMBER_CULVERT.z1, 6.0, 6.2, brickVaultMat);
  addUnderWallX(CHAMBER_CULVERT.z1, 9.8, 12.8, brickVaultMat);

  // Portal Timber Frames at all junctions
  addPortalFrameZ(7.2, -3.8, -0.2);
  addPortalFrameZ(14.8, -3.8, -0.2);
  addPortalFrameZ(14.8, -10.6, -7.0);
  addPortalFrameZ(-4.2, -0.2, 3.4);
  addPortalFrameZ(-12.8, -0.2, 3.4);
  addPortalFrameZ(-19.8, -0.2, 3.4);
  addPortalFrameX(7.2, 2.2, 6.0);
  addPortalFrameX(14.0, 6.2, 9.8);

  // ==========================================================================
  // 3. Bustling Subterranean Set-Pieces, Tunnels, Minecart Rails & Storybook Props
  // ==========================================================================
  ACTIVE_UNDER_STEAM_CLOUDS = [];
  const copperMat = M(0xc87347, 'painted_metal', 0.9, 0.9, { roughness: 0.72 });
  const brassMat = M(0xd8a848, 'painted_metal', 0.8, 0.8, { roughness: 0.68 });
  const valveRedMat = M(0xc94235, 'painted_metal', 0.6, 0.6, { roughness: 0.72 });
  const appleRedMat = M(0xd83d30, 'terracotta', 0.5, 0.5, { roughness: 0.42 });
  const skyCrystalMat = new THREE.MeshStandardMaterial({
    color: 0x6cecff,
    emissive: 0x1ebae8,
    emissiveIntensity: 0.95,
    roughness: 0.34,
    metalness: 0,
  });
  const amberCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xffcf64,
    emissive: 0xf08c1e,
    emissiveIntensity: 0.85,
    roughness: 0.38,
    metalness: 0,
  });
  const geyserWaterMat = new THREE.MeshStandardMaterial({
    color: 0x8ef0ff,
    emissive: 0x2cbbe0,
    emissiveIntensity: 0.85,
    roughness: 0.20,
    metalness: 0,
    transparent: true,
    opacity: 0.84,
  });

  // Helper: Vaulted dressed-stone arch rib + wall sconces inside corridors (keeps >= 2.7m clear walkway!)
  const addCorridorArchRibZ = (x, z0, z1, withSconce = false) => {
    const cz = (z0 + z1) * 0.5;
    const span = z1 - z0;
    for (const sz of [z0 + 0.14, z1 - 0.14]) {
      addRBox(underArch, 0.28, WALL_H - 0.12, 0.26, 0.04, stoneWallMat, x, WALL_CY, sz);
      addRBox(underArch, 0.30, 0.42, 0.38, 0.04, mossyStoneMat, x, Y_CEIL - 0.34, sz + (sz < cz ? 0.10 : -0.10), sz < cz ? 0.48 : -0.48, 0, 0);
    }
    addRBox(underArch, 0.30, 0.22, span - 0.12, 0.04, stoneWallMat, x, Y_CEIL - 0.10, cz);
    if (withSconce) {
      addRBox(underArch, 0.10, 0.08, 0.28, 0.02, ironMat, x, Y_UNDER + 1.82, z0 + 0.28);
      addLantern(x, Y_UNDER + 1.62, z0 + 0.36, false);
    }
  };

  const addCorridorArchRibX = (z, x0, x1, withSconce = false) => {
    const cx = (x0 + x1) * 0.5;
    const span = x1 - x0;
    for (const sx of [x0 + 0.14, x1 - 0.14]) {
      addRBox(underArch, 0.26, WALL_H - 0.12, 0.28, 0.04, brickVaultMat, sx, WALL_CY, z);
      addRBox(underArch, 0.38, 0.42, 0.30, 0.04, stoneWallMat, sx + (sx < cx ? 0.10 : -0.10), Y_CEIL - 0.34, z, 0, 0, sx < cx ? -0.48 : 0.48);
    }
    addRBox(underArch, span - 0.12, 0.22, 0.30, 0.04, brickVaultMat, cx, Y_CEIL - 0.10, z);
    if (withSconce) {
      addRBox(underArch, 0.28, 0.08, 0.10, 0.02, ironMat, x0 + 0.28, Y_UNDER + 1.82, z);
      addLantern(x0 + 0.36, Y_UNDER + 1.62, z, false);
    }
  };

  // Helper: Flush narrow-gauge iron minecart track segment (walkable ground, zero snag!)
  const addMinecartTrackRun = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) return;
    const mx = (x0 + x1) * 0.5, mz = (z0 + z1) * 0.5;
    const rot = Math.atan2(dx, dz);
    const nx = Math.cos(rot), nz = -Math.sin(rot);
    for (const side of [-0.28, 0.28]) {
      addBox(underWalkable, 0.055, 0.032, len + 0.04, ironMat, mx + nx * side, Y_UNDER + 0.016, mz + nz * side, 0, rot, 0);
    }
    const ties = Math.max(2, Math.floor(len / 0.58));
    for (let i = 0; i <= ties; i++) {
      const u = (i + 0.3) / (ties + 0.6);
      const tx = x0 + dx * u, tz = z0 + dz * u;
      addBox(underWalkable, 0.82, 0.022, 0.12, darkTimberMat, tx, Y_UNDER + 0.010, tz, 0, rot, 0);
    }
  };

  // Helper: Luminous Celestia crystal geode outcrop
  const addCrystalOutcrop = (cx, cz, scale = 1.0, preferAmber = false) => {
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 * scale, 0), mossyStoneMat);
    base.scale.set(1.25, 0.62, 1.15);
    base.position.set(cx, Y_UNDER + 0.16 * scale, cz);
    underArch.add(base);
    const spikes = [
      { ox: 0.0, oz: 0.0, r: 0.14, h: 0.92, rx: 0.08, rz: -0.10, amber: preferAmber },
      { ox: 0.18, oz: -0.10, r: 0.10, h: 0.68, rx: -0.22, rz: -0.26, amber: false },
      { ox: -0.19, oz: 0.11, r: 0.11, h: 0.72, rx: 0.24, rz: 0.22, amber: true },
      { ox: 0.10, oz: 0.18, r: 0.085, h: 0.52, rx: 0.28, rz: -0.18, amber: preferAmber },
      { ox: -0.12, oz: -0.16, r: 0.08, h: 0.48, rx: -0.26, rz: 0.20, amber: false },
    ];
    for (const sp of spikes) {
      const sg = new THREE.Group();
      sg.position.set(cx + sp.ox * scale, Y_UNDER + 0.18 * scale, cz + sp.oz * scale);
      sg.rotation.set(sp.rx, sp.ox * 4, sp.rz);
      const cmat = sp.amber ? amberCrystalMat : skyCrystalMat;
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(sp.r * 0.82 * scale, sp.r * scale, sp.h * 0.68 * scale, 6), cmat);
      sh.position.y = sp.h * 0.34 * scale;
      sg.add(sh);
      const tp = new THREE.Mesh(new THREE.ConeGeometry(sp.r * 0.82 * scale, sp.h * 0.36 * scale, 6), cmat);
      tp.position.y = sp.h * 0.86 * scale;
      sg.add(tp);
      underGlow.add(sg);
    }
  };

  // Continuous narrow-gauge minecart track from West Crystal Vault -> Cistern -> East Cheese Cellar!
  addMinecartTrackRun(-18.2, 3.6, -13.4, 1.8);
  addMinecartTrackRun(-13.4, 1.8, -3.2, 1.6);
  addMinecartTrackRun(-3.2, 1.6, -0.6, -1.8);
  addMinecartTrackRun(-0.6, -1.8, 6.2, -2.0);
  addMinecartTrackRun(6.2, -2.0, 17.6, -2.0);

  // --- Zone 1: Central Wishing-Well Cistern, Floating Lily-Lanterns, Periscope & Geyser Valve!
  const wellGeyserGroup = new THREE.Group();
  wellGeyserGroup.name = 'wellGeyserColumn';
  wellGeyserGroup.visible = false;
  wellGeyserGroup.userData.keep = true;
  const geyserValveWheelPivot = new THREE.Group();
  geyserValveWheelPivot.name = 'geyserValveWheel';
  geyserValveWheelPivot.userData.keep = true;
  {
    // Square 1.6m x 1.6m stone shaft collar rising into cylindrical well liner up to surface well
    for (const sz of [-0.82, 0.82]) {
      addBox(underArch, 1.84, 0.86, 0.20, mossyStoneMat, WELL_CX, Y_CEIL + 0.40, WELL_CZ + sz);
    }
    for (const sx of [-0.82, 0.82]) {
      addBox(underArch, 0.20, 0.86, 1.64, mossyStoneMat, WELL_CX + sx, Y_CEIL + 0.40, WELL_CZ);
    }
    const upperShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.78, 0.56, 18, 1, true),
      mossyStoneMat
    );
    upperShaft.material = mossyStoneMat.clone();
    upperShaft.material.side = THREE.DoubleSide;
    upperShaft.position.set(WELL_CX, -0.10, WELL_CZ);
    underArch.add(upperShaft);

    // Volumetric daylight shaft beam streaming down into the cistern pool
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 1.24, 3.38, 18, 1, true), sunShaftMat);
    beam.position.set(WELL_CX, (0.0 + Y_UNDER) * 0.5, WELL_CZ);
    underGlow.add(beam);

    // Shallow shimmering well-pool disc at y = -3.37 (walkable, zero snag!)
    const poolRim = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.09, 8, 24), mossyStoneMat);
    poolRim.rotation.x = Math.PI / 2;
    poolRim.position.set(WELL_CX, Y_UNDER + 0.04, WELL_CZ);
    underArch.add(poolRim);

    const poolDisc = new THREE.Mesh(new THREE.CircleGeometry(1.36, 24), poolWaterMat);
    poolDisc.rotation.x = -Math.PI / 2;
    poolDisc.position.set(WELL_CX, -3.368, WELL_CZ);
    underGlow.add(poolDisc);

    // Floating glowing Storybook lotus lily-lanterns + glinting golden wishing coins on the pool!
    for (const [lx, lz] of [[0.95, 1.10], [2.12, 1.88], [1.18, 2.25]]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.018, 10), mossLeafMat);
      pad.position.set(lx, -3.355, lz);
      underArch.add(pad);
      const glowBud = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), lanternGlassMat);
      glowBud.scale.set(1.0, 0.85, 1.0);
      glowBud.position.set(lx, -3.31, lz);
      underGlow.add(glowBud);
    }
    for (let c = 0; c < 11; c++) {
      const ca = (c / 11) * Math.PI * 2 + 0.4;
      const cr = 0.25 + (c % 4) * 0.24;
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.01, 8), amberShroomMat);
      coin.position.set(WELL_CX + Math.cos(ca) * cr, -3.362, WELL_CZ + Math.sin(ca) * cr);
      underGlow.add(coin);
    }

    // Erupting Wishing-Well Geyser Column (rises from pool y = -3.38 all the way to y = +2.8m above Plaza!)
    wellGeyserGroup.position.set(WELL_CX, Y_UNDER, WELL_CZ);
    const geyserCore = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.66, 6.2, 14, 1, true), geyserWaterMat);
    geyserCore.position.y = 3.10;
    wellGeyserGroup.add(geyserCore);
    const geyserCrown = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), geyserWaterMat);
    geyserCrown.scale.set(1.15, 0.65, 1.15);
    geyserCrown.position.y = 6.05;
    wellGeyserGroup.add(geyserCrown);
    for (let f = 0; f < 6; f++) {
      const fa = (f / 6) * Math.PI * 2;
      const foam = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 6), lanternGlassMat);
      foam.position.set(Math.cos(fa) * 0.68, 0.16, Math.sin(fa) * 0.68);
      wellGeyserGroup.add(foam);
    }
    underGlow.add(wellGeyserGroup);

    // Interactive Copper & Brass Geyser Valve Pedestal at (3.22, Y_UNDER, 1.5)
    addRBox(underArch, 0.42, 0.16, 0.42, 0.03, stoneWallMat, 3.22, Y_UNDER + 0.08, 1.50);
    const pipeStand = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.10, 1.05, 10), copperMat);
    pipeStand.position.set(3.22, Y_UNDER + 0.58, 1.50);
    underArch.add(pipeStand);
    const pipeFeed = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 8), copperMat);
    pipeFeed.rotation.z = Math.PI * 0.5;
    pipeFeed.position.set(2.86, Y_UNDER + 0.18, 1.50);
    underArch.add(pipeFeed);
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), brassMat);
    gauge.rotation.x = Math.PI * 0.5;
    gauge.position.set(3.22, Y_UNDER + 1.16, 1.50);
    underArch.add(gauge);
    geyserValveWheelPivot.position.set(3.08, Y_UNDER + 0.96, 1.50);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.026, 7, 16), valveRedMat);
    wheelRim.rotation.y = Math.PI * 0.5;
    geyserValveWheelPivot.add(wheelRim);
    addRBox(geyserValveWheelPivot, 0.03, 0.38, 0.03, 0.01, valveRedMat, 0, 0, 0);
    addRBox(geyserValveWheelPivot, 0.03, 0.03, 0.38, 0.01, valveRedMat, 0, 0, 0);
    mergeStatic(THREE, geyserValveWheelPivot);
    underGlow.add(geyserValveWheelPivot);
    pushBlocker(2.98, 3.46, 1.26, 1.74, -3.65, Y_UNDER + 1.22, true);

    // Subterranean Brass Plaza Spy-Periscope & Directional Wooden Signpost beside NW Pillar (-1.95, 4.85)
    const periX = -1.95, periZ = 4.85;
    const periTube = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.082, WALL_H - 0.1, 10), brassMat);
    periTube.position.set(periX, WALL_CY, periZ);
    underArch.add(periTube);
    const periEye = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.26, 9), copperMat);
    periEye.rotation.x = Math.PI * 0.5;
    periEye.position.set(periX, Y_UNDER + 1.38, periZ - 0.14);
    underArch.add(periEye);
    for (const hy of [-0.08, 0.08]) {
      addRBox(underArch, 0.28, 0.03, 0.03, 0.01, ironMat, periX, Y_UNDER + 1.30 + hy, periZ - 0.18);
    }
    // Directional wooden signpost near (-2.2, -1.6) pointing to all 3 wings
    addRBox(underArch, 0.14, 1.95, 0.14, 0.03, darkTimberMat, -2.15, Y_UNDER + 0.98, -1.55);
    addRBox(underArch, 0.78, 0.16, 0.06, 0.02, timberMat, -1.82, Y_UNDER + 1.76, -1.55, 0, 0.15, 0);
    addRBox(underArch, 0.78, 0.16, 0.06, 0.02, timberMat, -2.48, Y_UNDER + 1.54, -1.55, 0, -0.18, 0);
    addRBox(underArch, 0.06, 0.16, 0.76, 0.02, timberMat, -2.15, Y_UNDER + 1.32, -1.20, 0, 0.25, 0);

    // 2 Mossy Stone Wishing Benches tucked against N & S Cistern walls (standable!)
    addRBox(underArch, 1.85, 0.44, 0.52, 0.06, mossyStoneMat, 1.5, Y_UNDER + 0.22, -3.65);
    pushBlocker(0.58, 2.42, -3.92, -3.38, -3.65, Y_UNDER + 0.46, true);
    addRBox(underArch, 1.75, 0.44, 0.52, 0.06, mossyStoneMat, -0.9, Y_UNDER + 0.22, 6.62);
    pushBlocker(-1.78, -0.02, 6.36, 6.88, -3.65, Y_UNDER + 0.46, true);

    // Hanging Wishing-Well Rope & Wooden Bucket (gently sways in update())
    const ropeBucket = new THREE.Group();
    ropeBucket.position.set(WELL_CX, 0.35, WELL_CZ + 0.45);
    const ropeLen = 2.85;
    const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, ropeLen, 6), burlapMat);
    ropeMesh.position.y = -ropeLen * 0.5;
    ropeBucket.add(ropeMesh);
    const bkt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.34, 12), timberMat);
    bkt.position.y = -ropeLen - 0.14;
    ropeBucket.add(bkt);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.014, 6, 14), ironMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = -ropeLen - 0.06;
    ropeBucket.add(hoop);
    ropeBucket.name = 'wellRopeBucket';
    underGlow.add(ropeBucket);

    // 4 Mossy Stone Pillars near Cistern corners
    for (const [px, pz] of [[-2.6, -2.6], [5.6, -2.6], [-2.6, 5.6], [5.6, 5.6]]) {
      addRBox(underArch, 0.62, WALL_H, 0.62, 0.08, mossyStoneMat, px, WALL_CY, pz);
      addRBox(underArch, 0.78, 0.24, 0.78, 0.06, stoneWallMat, px, Y_UNDER + 0.12, pz);
      addRBox(underArch, 0.78, 0.22, 0.78, 0.06, stoneWallMat, px, Y_CEIL - 0.11, pz);
      pushBlocker(px - 0.34, px + 0.34, pz - 0.34, pz + 0.34, -3.65, Y_CEIL, false);
    }

    addLantern(-2.1, -1.32, -2.1);
    addLantern(5.1, -1.32, -2.1);
    addLantern(-2.1, -1.32, 5.1);
    addLantern(5.1, -1.32, 5.1);
    addGlowShroomCluster(-3.4, -3.4, 5, false);
    addGlowShroomCluster(6.3, 6.2, 5, true);
    addGlowShroomCluster(-3.4, 6.3, 4, true);
    addGlowShroomCluster(6.2, -3.4, 4, false);
    addCrystalOutcrop(-3.45, 4.6, 0.72, false);
  }

  // --- Zone 2: Bustling East Tunnel + Barn Cheese & Cider Cooperage Cellar!
  {
    // Vaulted stone arch ribs + overhead copper cider pipe along East Tunnel (x = 7.2..14.8, z = -3.8..-0.2)
    addCorridorArchRibZ(9.2, -3.8, -0.2, true);
    addCorridorArchRibZ(11.6, -3.8, -0.2, false);
    addCorridorArchRibZ(13.6, -3.8, -0.2, true);
    const ePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 7.8, 8), copperMat);
    ePipe.rotation.z = Math.PI * 0.5;
    ePipe.position.set(11.0, Y_CEIL - 0.26, -3.48);
    underArch.add(ePipe);
    // Wall-mounted barrel shelf along South wall of East Tunnel (z = -3.45, leaves 2.9m clear north walkway!)
    addRBox(underArch, 3.2, 0.08, 0.42, 0.02, darkTimberMat, 11.2, Y_UNDER + 1.28, -3.45);
    for (const bx of [10.0, 11.2, 12.4]) {
      const miniCask = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 10), timberMat);
      miniCask.rotation.x = Math.PI * 0.5;
      miniCask.position.set(bx, Y_UNDER + 1.48, -3.44);
      underArch.add(miniCask);
    }

    addLantern(11.0, -1.30, -2.0);
    addLantern(18.0, -1.28, -2.6);
    addLantern(18.0, -1.28, -8.2);
    addGlowShroomCluster(10.6, -3.3, 4, false);

    // Tall wooden cheese-aging rack along East wall (x = 20.92, z: -10.2 .. -0.8)
    const rackX = 20.92;
    for (const rz of [-10.2, -7.8, -5.4, -3.0, -0.8]) {
      addRBox(underArch, 0.14, 2.25, 0.14, 0.02, darkTimberMat, rackX - 0.36, Y_UNDER + 1.12, rz);
      addRBox(underArch, 0.14, 2.25, 0.14, 0.02, darkTimberMat, rackX + 0.32, Y_UNDER + 1.12, rz);
    }
    for (const sy of [0.52, 1.16, 1.80]) {
      addRBox(underArch, 0.78, 0.07, 9.6, 0.02, timberMat, rackX, Y_UNDER + sy, -5.5);
      for (let z = -9.6; z <= -1.2; z += 1.05) {
        if (rng.rr() < 0.18) continue;
        const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12), cheeseDecorMat);
        cw.position.set(rackX - 0.04, Y_UNDER + sy + 0.125, z + rng.jr(-0.1, 0.1));
        underArch.add(cw);
      }
    }
    pushBlocker(20.42, 21.6, -10.4, -0.6, -3.65, Y_CEIL, false);

    // Centerpiece: Giant Oak Screw Apple-Cider Press at (16.4, Y_UNDER, -5.2)
    const px = 16.4, pz = -5.2;
    addRBox(underArch, 1.48, 0.34, 1.48, 0.05, mossyStoneMat, px, Y_UNDER + 0.17, pz);
    const pressPan = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.66, 0.12, 16), darkTimberMat);
    pressPan.position.set(px, Y_UNDER + 0.38, pz);
    underArch.add(pressPan);
    // Slatted oak apple-mash basket + crimson orchard apples
    const mashBasket = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.68, 14), timberMat);
    mashBasket.position.set(px, Y_UNDER + 0.76, pz);
    underArch.add(mashBasket);
    for (const hy of [0.56, 0.94]) {
      const phoop = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.02, 6, 16), ironMat);
      phoop.rotation.x = Math.PI * 0.5;
      phoop.position.set(px, Y_UNDER + hy, pz);
      underArch.add(phoop);
    }
    // Heavy twin oak uprights + top crosshead beam + carved wooden screw spindle & turn-bar
    for (const sx of [-0.62, 0.62]) {
      addRBox(underArch, 0.16, 2.08, 0.18, 0.03, darkTimberMat, px + sx, Y_UNDER + 1.24, pz);
    }
    addRBox(underArch, 1.56, 0.24, 0.28, 0.04, darkTimberMat, px, Y_UNDER + 2.18, pz);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1.25, 10), timberMat);
    screw.position.set(px, Y_UNDER + 1.62, pz);
    underArch.add(screw);
    addRBox(underArch, 1.12, 0.065, 0.065, 0.02, brassMat, px, Y_UNDER + 1.32, pz, 0, 0.55, 0);
    // Copper juice spout + wooden catch tub with apples on +Z side
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8), copperMat);
    spout.rotation.x = Math.PI * 0.5;
    spout.position.set(px, Y_UNDER + 0.38, pz + 0.72);
    underArch.add(spout);
    const catchTub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.26, 12), timberMat);
    catchTub.position.set(px, Y_UNDER + 0.13, pz + 0.88);
    underArch.add(catchTub);
    for (const [ax, az] of [[-0.22, 0.12], [0.18, -0.16], [0.04, 0.24], [-0.14, -0.22]]) {
      const ap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), appleRedMat);
      ap.position.set(px + ax, Y_UNDER + 1.13, pz + az);
      underArch.add(ap);
    }
    pushBlocker(px - 0.76, px + 0.76, pz - 0.76, pz + 0.98, -3.65, Y_CEIL - 0.2, false);

    // Cooper's Tasting Table along North cellar wall (17.4, Y_UNDER, -0.35) with mugs & cheddar
    addRBox(underArch, 2.10, 0.08, 0.72, 0.03, timberMat, 17.4, Y_UNDER + 0.78, -0.35);
    for (const sx of [-0.88, 0.88]) {
      addRBox(underArch, 0.12, 0.76, 0.62, 0.02, darkTimberMat, 17.4 + sx, Y_UNDER + 0.38, -0.35);
    }
    for (const mx of [16.85, 17.25, 17.95]) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.15, 9), timberMat);
      mug.position.set(mx, Y_UNDER + 0.89, -0.32);
      underArch.add(mug);
    }
    const tableWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.12, 12), cheeseDecorMat);
    tableWheel.position.set(17.62, Y_UNDER + 0.88, -0.38);
    underArch.add(tableWheel);
    pushBlocker(16.32, 18.48, -0.74, 0.05, -3.65, Y_UNDER + 0.92, true);

    // Signature Hiding Spot 1 Vessel: Giant Open-Top Oak Fermentation Cider Tun at (19.35, Y_UNDER, -9.55)!
    const tunX = 19.35, tunZ = -9.55;
    const tunShell = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.62, 1.20, 18, 1, true), darkTimberMat);
    tunShell.material = darkTimberMat.clone();
    tunShell.material.side = THREE.DoubleSide;
    tunShell.position.set(tunX, Y_UNDER + 0.60, tunZ);
    underArch.add(tunShell);
    const tunFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.60, 0.60, 0.08, 16), timberMat);
    tunFloor.position.set(tunX, Y_UNDER + 0.04, tunZ);
    underArch.add(tunFloor);
    for (const hy of [0.22, 0.62, 1.02]) {
      const thoop = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.022, 6, 18), ironMat);
      thoop.rotation.x = Math.PI * 0.5;
      thoop.position.set(tunX, Y_UNDER + hy, tunZ);
      underArch.add(thoop);
    }
    pushBlocker(tunX - 0.64, tunX + 0.64, tunZ - 0.64, tunZ + 0.64, -3.65, Y_UNDER + 1.20, true);
  }

  // --- Zone 3: Bustling West Tunnel + Celestia Crystal & Root Vault + Harvest Minecart + Boiler Steam Valve!
  const steamLeverPivot = new THREE.Group();
  steamLeverPivot.name = 'boilerSteamLever';
  steamLeverPivot.userData.keep = true;
  {
    // Vaulted stone arch ribs + overhead copper steam pipe along West Tunnel (x = -12.8..-4.2, z = -0.2..3.4)
    addCorridorArchRibZ(-6.2, -0.2, 3.4, true);
    addCorridorArchRibZ(-8.6, -0.2, 3.4, false);
    addCorridorArchRibZ(-11.0, -0.2, 3.4, true);
    const wPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 9.2, 8), copperMat);
    wPipe.rotation.z = Math.PI * 0.5;
    wPipe.position.set(-8.5, Y_CEIL - 0.24, 0.12);
    underArch.add(wPipe);
    addCrystalOutcrop(-9.6, 3.05, 0.68, false);
    addCrystalOutcrop(-6.9, 0.22, 0.62, true);

    addLantern(-8.5, -1.30, 1.6);
    addLantern(-16.3, -1.28, 1.5);
    addGlowShroomCluster(-8.2, 0.25, 4, true);
    addGlowShroomCluster(-19.0, -1.8, 5, false);
    addGlowShroomCluster(-13.6, 4.5, 5, true);

    // Sweeping gnarled ancient tree roots curving through ceiling & corners
    const rootSpecs = [
      { x: -18.8, z: 4.5, rx: 0.28, rz: -0.22, r: 0.22 },
      { x: -14.0, z: -1.8, rx: -0.25, rz: 0.24, r: 0.20 },
      { x: -16.4, z: 4.7, rx: 0.34, rz: 0.10, r: 0.18 },
      { x: -18.9, z: -1.7, rx: -0.30, rz: -0.18, r: 0.19 },
      { x: -13.6, z: 4.6, rx: 0.22, rz: 0.26, r: 0.17 },
    ];
    for (const rt of rootSpecs) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(rt.r * 1.35, rt.r * 0.55, 2.85, 8), barkRootMat);
      trunk.position.set(rt.x, WALL_CY + 0.05, rt.z);
      trunk.rotation.set(rt.rx, 0, rt.rz);
      underArch.add(trunk);
      const tendril = new THREE.Mesh(new THREE.CylinderGeometry(rt.r * 0.55, 0.04, 1.5, 6), barkRootMat);
      tendril.position.set(rt.x + rt.rz * 1.1, Y_CEIL - 0.55, rt.z - rt.rx * 1.1);
      tendril.rotation.set(rt.rx * 1.8, 0.4, rt.rz * 1.8);
      underArch.add(tendril);
    }

    // Giant Luminous Celestia Crystal Geode Spires in Vault Corners!
    addCrystalOutcrop(-18.65, 4.25, 1.32, false);
    addCrystalOutcrop(-18.75, -1.55, 1.12, true);
    addCrystalOutcrop(-13.75, 4.35, 1.05, false);

    // Underground Apothecary Root-Workbench along South Vault wall (-16.4, Y_UNDER, -1.75)
    addRBox(underArch, 2.55, 0.09, 0.74, 0.03, darkTimberMat, -16.4, Y_UNDER + 0.80, -1.75);
    for (const sx of [-1.08, 1.08]) {
      addRBox(underArch, 0.14, 0.78, 0.64, 0.02, timberMat, -16.4 + sx, Y_UNDER + 0.39, -1.75);
    }
    // Glowing crystal mortar & potion flasks on the workbench
    for (const [fx, fmat] of [[-17.1, skyCrystalMat], [-16.65, amberCrystalMat], [-15.75, tealShroomMat]]) {
      const flask = new THREE.Mesh(new THREE.SphereGeometry(0.095, 9, 7), fmat);
      flask.position.set(fx, Y_UNDER + 0.94, -1.72);
      underGlow.add(flask);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.09, 7), brassMat);
      neck.position.set(fx, Y_UNDER + 1.04, -1.72);
      underArch.add(neck);
    }
    pushBlocker(-17.72, -15.08, -2.18, -1.36, -3.65, Y_UNDER + 0.92, true);

    // Signature Hiding Spot 2 Vessel: Timber Harvest Minecart on the iron rails at (-16.2, Y_UNDER, 3.6)!
    const mcX = -16.2, mcZ = 3.6, mcRot = -0.36;
    const mcGrp = new THREE.Group();
    mcGrp.position.set(mcX, Y_UNDER, mcZ);
    mcGrp.rotation.y = mcRot;
    // Flanged iron wheels + axles
    for (const wx of [-0.42, 0.42]) {
      for (const wz of [-0.30, 0.30]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), ironMat);
        wh.rotation.x = Math.PI * 0.5;
        wh.position.set(wx, 0.16, wz);
        mcGrp.add(wh);
      }
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.68, 6), ironMat);
      axle.rotation.x = Math.PI * 0.5;
      axle.position.set(wx, 0.16, 0);
      mcGrp.add(axle);
    }
    // Slatted flared timber minecart body (hollow top so Hider ducks right inside!)
    addRBox(mcGrp, 1.24, 0.08, 0.78, 0.02, darkTimberMat, 0, 0.28, 0);
    for (const sz of [-0.37, 0.37]) {
      addRBox(mcGrp, 1.26, 0.52, 0.07, 0.02, timberMat, 0, 0.56, sz);
      addRBox(mcGrp, 1.28, 0.06, 0.09, 0.015, ironMat, 0, 0.81, sz);
    }
    for (const sx of [-0.60, 0.60]) {
      addRBox(mcGrp, 0.07, 0.52, 0.76, 0.02, timberMat, sx, 0.56, 0);
    }
    underArch.add(mcGrp);
    pushBlocker(mcX - 0.66, mcX + 0.66, mcZ - 0.48, mcZ + 0.48, -3.65, Y_UNDER + 0.86, true);

    // Interactive Copper Root-Boiler & Steam-Curtain Whistle Valve at (-13.35, Y_UNDER, -0.95)!
    const bx = -13.35, bz = -0.95;
    addRBox(underArch, 0.92, 0.22, 0.92, 0.04, stoneWallMat, bx, Y_UNDER + 0.11, bz);
    const boilerDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.40, 1.28, 14), copperMat);
    boilerDrum.position.set(bx, Y_UNDER + 0.84, bz);
    underArch.add(boilerDrum);
    const boilerDome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), brassMat);
    boilerDome.position.set(bx, Y_UNDER + 1.48, bz);
    underArch.add(boilerDome);
    const ventPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 8), copperMat);
    ventPipe.position.set(bx, Y_UNDER + 2.02, bz);
    underArch.add(ventPipe);
    const fireboxGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10), lanternGlassMat);
    fireboxGlow.rotation.x = Math.PI * 0.5;
    fireboxGlow.position.set(bx, Y_UNDER + 0.52, bz + 0.39);
    underGlow.add(fireboxGlow);
    steamLeverPivot.position.set(bx + 0.36, Y_UNDER + 1.18, bz + 0.22);
    addRBox(steamLeverPivot, 0.04, 0.44, 0.04, 0.01, ironMat, 0, 0.18, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), valveRedMat);
    knob.position.set(0, 0.42, 0);
    steamLeverPivot.add(knob);
    mergeStatic(THREE, steamLeverPivot);
    underGlow.add(steamLeverPivot);
    pushBlocker(bx - 0.46, bx + 0.46, bz - 0.46, bz + 0.46, -3.65, Y_CEIL - 0.2, false);
  }

  // --- Zone 4: North-East Boardwalk Tunnel + Turning Culvert Waterwheel & Moss Waterfall Grotto!
  const culvertWheelPivot = new THREE.Group();
  culvertWheelPivot.name = 'culvertWaterwheel';
  culvertWheelPivot.userData.keep = true;
  {
    // Vaulted brick arch ribs + walkable wooden creek duckboards along NE Tunnel (x = 2.2..6.0, z = 7.2..14.0)
    addCorridorArchRibX(9.2, 2.2, 6.0, true);
    addCorridorArchRibX(11.8, 2.2, 6.0, false);
    for (let z = 7.6; z <= 13.4; z += 0.62) {
      addRBox(underWalkable, 1.65, 0.035, 0.42, 0.015, timberMat, 4.1, Y_UNDER + 0.018, z);
    }

    addLantern(4.1, -1.30, 10.6);
    addLantern(9.4, -1.28, 11.3);
    addGlowShroomCluster(2.7, 13.3, 4, true);
    addGlowShroomCluster(12.1, 13.2, 5, true);
    addGlowShroomCluster(6.6, 9.2, 4, false);

    // Decorative shallow mossy stone water rill + walkable wooden creek footbridge in Culvert floor
    const rill = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 5.1), poolWaterMat);
    rill.rotation.x = -Math.PI / 2;
    rill.position.set(8.2, -3.382, 11.3);
    underGlow.add(rill);
    for (let k = -2; k <= 2; k++) {
      addRBox(underWalkable, 1.38, 0.045, 0.28, 0.015, darkTimberMat, 8.2, Y_UNDER + 0.022, 11.3 + k * 0.34);
    }

    // Animated Turning Underground Wooden Waterwheel along East Brick Wall (x = 12.22, z = 11.65)!
    const wx = 12.22, wy = Y_UNDER + 1.36, wz = 11.65;
    // Brick aqueduct feed spout pouring shimmering water onto the paddles
    addRBox(underArch, 0.62, 0.28, 0.48, 0.03, brickVaultMat, 12.42, Y_UNDER + 2.32, wz - 0.35);
    const spoutJet = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.92, 8), poolWaterMat);
    spoutJet.position.set(12.18, Y_UNDER + 1.88, wz - 0.42);
    spoutJet.rotation.x = 0.22;
    underGlow.add(spoutJet);
    addRBox(underArch, 0.56, 0.24, 2.25, 0.04, mossyStoneMat, 12.28, Y_UNDER + 0.12, wz);

    culvertWheelPivot.position.set(wx, wy, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 10), darkTimberMat);
    hub.rotation.z = Math.PI * 0.5;
    culvertWheelPivot.add(hub);
    for (const sx of [-0.16, 0.16]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.055, 7, 20), timberMat);
      rim.rotation.y = Math.PI * 0.5;
      rim.position.x = sx;
      culvertWheelPivot.add(rim);
    }
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2;
      addRBox(culvertWheelPivot, 0.34, 0.05, 1.88, 0.015, darkTimberMat, 0, 0, 0, a, 0, 0);
      addRBox(culvertWheelPivot, 0.38, 0.22, 0.05, 0.015, timberMat, 0, Math.sin(a) * 0.96, Math.cos(a) * 0.96, -a, 0, 0);
    }
    mergeStatic(THREE, culvertWheelPivot);
    underGlow.add(culvertWheelPivot);
    pushBlocker(11.85, 12.8, 10.45, 12.85, -3.65, Y_CEIL, false);

    // Signature Hiding Spot 3 Frame: Mossy Waterfall Grotto Alcove in SE Culvert Corner (11.15, Y_UNDER, 9.25)!
    addRBox(underArch, 1.48, 0.24, 0.58, 0.04, mossyStoneMat, 11.15, Y_CEIL - 0.18, 9.25);
    for (let f = -2; f <= 2; f++) {
      const hangFern = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.72, 5), mossLeafMat);
      hangFern.rotation.x = Math.PI;
      hangFern.position.set(11.15 + f * 0.26, Y_CEIL - 0.52, 9.52);
      underArch.add(hangFern);
    }
    const grottoFall = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.35), poolWaterMat);
    grottoFall.position.set(11.15, WALL_CY - 0.08, 9.54);
    underGlow.add(grottoFall);
  }

  // ==========================================================================
  // 4. Three Open Walkable Stone Stairwells + Seamless Surface Portals
  // ==========================================================================
  function buildStairwell(s) {
    const skirtW = 2.15; // seals any dropped 2.0m meadow ground triangles around the cutout!
    const apronW = 0.62;
    const steps = 14;

    // 4a. Seamless Meadow Grass Skirt Collar (y = 0.005) + Cobble Threshold Apron (y = 0.02)
    addBox(surfaceWalkable, (s.x1 - s.x0) + skirtW * 2, 0.02, skirtW, grassSkirtMat,
      (s.x0 + s.x1) * 0.5, -0.004, s.z0 - skirtW * 0.5);
    addBox(surfaceWalkable, (s.x1 - s.x0) + skirtW * 2, 0.02, skirtW, grassSkirtMat,
      (s.x0 + s.x1) * 0.5, -0.004, s.z1 + skirtW * 0.5);
    addBox(surfaceWalkable, skirtW, 0.02, s.z1 - s.z0, grassSkirtMat,
      s.x0 - skirtW * 0.5, -0.004, (s.z0 + s.z1) * 0.5);
    addBox(surfaceWalkable, skirtW, 0.02, s.z1 - s.z0, grassSkirtMat,
      s.x1 + skirtW * 0.5, -0.004, (s.z0 + s.z1) * 0.5);

    addRBox(surfaceWalkable, (s.x1 - s.x0) + apronW * 2, 0.045, apronW, 0.02, cobbleFloorMat,
      (s.x0 + s.x1) * 0.5, 0.002, s.z0 - apronW * 0.5);
    addRBox(surfaceWalkable, (s.x1 - s.x0) + apronW * 2, 0.045, apronW, 0.02, cobbleFloorMat,
      (s.x0 + s.x1) * 0.5, 0.002, s.z1 + apronW * 0.5);
    addRBox(surfaceWalkable, apronW, 0.045, s.z1 - s.z0, 0.02, cobbleFloorMat,
      s.x0 - apronW * 0.5, 0.002, (s.z0 + s.z1) * 0.5);
    addRBox(surfaceWalkable, apronW, 0.045, s.z1 - s.z0, 0.02, cobbleFloorMat,
      s.x1 + apronW * 0.5, 0.002, (s.z0 + s.z1) * 0.5);

    // 4b. Walkable Sloped Ramp Core + Dressed Stone Steps (userData.ground = true)
    if (s.axis === 'x') {
      const len = s.x1 - s.x0;
      const wid = s.z1 - s.z0;
      const cz = (s.z0 + s.z1) * 0.5;
      const slopeLen = Math.hypot(len, -Y_UNDER);
      const angZ = Math.atan2(evalStairRampY(s, s.x1, cz) - evalStairRampY(s, s.x0, cz), len);
      addBox(surfaceWalkable, slopeLen, 0.22, wid + 0.1, cobbleFloorMat,
        (s.x0 + s.x1) * 0.5, Y_UNDER * 0.5 - 0.13, cz, 0, 0, angZ);

      const dx = len / steps;
      for (let i = 0; i < steps; i++) {
        const u0 = i / steps, u1 = (i + 1) / steps;
        const sx = s.bottomX + (s.topX - s.bottomX) * ((u0 + u1) * 0.5);
        const topY = Y_UNDER + ((u0 + u1) * 0.5) * (0 - Y_UNDER);
        addRBox(surfaceWalkable, dx * 1.05, 0.26, wid + 0.04, 0.025, cobbleFloorMat, sx, topY - 0.13, cz);
      }

      // Retaining pit walls + Surface Parapet Walls (y = 0 .. 0.94)
      const wallMat = s.id === 'west' ? mossyStoneMat : stoneWallMat;
      const pitH = 0.94 - Y_UNDER;
      const pitCY = (0.94 + Y_UNDER) * 0.5;
      for (const wz of [s.z0 - 0.16, s.z1 + 0.16]) {
        addRBox(surfaceDecor, len + 0.44, pitH, 0.34, 0.04, wallMat, (s.x0 + s.x1) * 0.5, pitCY, wz);
        // Underground stairwell side blocker + surface parapet blocker (y0: -0.4, y1: 1.15)
        pushBlocker(s.x0, s.x1 + 0.15, wz - 0.17, wz + 0.17, -3.65, -0.35, false);
        pushBlocker(s.x0, s.x1 + 0.15, wz - 0.17, wz + 0.17, -0.40, 1.15, false);
      }
      // Back headwall above the underground portal (blocks surface walkers, leaves y < -0.78 wide open!)
      const backX = s.bottomX + (s.bottomX > s.topX ? 0.16 : -0.16);
      const headH = 0.94 - Y_CEIL;
      addRBox(surfaceDecor, 0.36, headH, wid + 0.66, 0.04, wallMat, backX, (0.94 + Y_CEIL) * 0.5, cz);
      pushBlocker(backX - 0.18, backX + 0.18, s.z0 - 0.32, s.z1 + 0.32, -0.40, 1.15, false);
    } else {
      const len = s.z1 - s.z0;
      const wid = s.x1 - s.x0;
      const cx = (s.x0 + s.x1) * 0.5;
      const slopeLen = Math.hypot(len, -Y_UNDER);
      const angX = -Math.atan2(evalStairRampY(s, cx, s.z1) - evalStairRampY(s, cx, s.z0), len);
      addBox(surfaceWalkable, wid + 0.1, 0.22, slopeLen, cobbleFloorMat,
        cx, Y_UNDER * 0.5 - 0.13, (s.z0 + s.z1) * 0.5, angX, 0, 0);

      const dz = len / steps;
      for (let i = 0; i < steps; i++) {
        const u0 = i / steps, u1 = (i + 1) / steps;
        const sz = s.bottomZ + (s.topZ - s.bottomZ) * ((u0 + u1) * 0.5);
        const topY = Y_UNDER + ((u0 + u1) * 0.5) * (0 - Y_UNDER);
        addRBox(surfaceWalkable, wid + 0.04, 0.26, dz * 1.05, 0.025, cobbleFloorMat, cx, topY - 0.13, sz);
      }

      const pitH = 0.94 - Y_UNDER;
      const pitCY = (0.94 + Y_UNDER) * 0.5;
      for (const wx of [s.x0 - 0.16, s.x1 + 0.16]) {
        addRBox(surfaceDecor, 0.34, pitH, len + 0.44, 0.04, brickVaultMat, wx, pitCY, (s.z0 + s.z1) * 0.5);
        pushBlocker(wx - 0.17, wx + 0.17, s.z0 - 0.15, s.z1, -3.65, -0.35, false);
        pushBlocker(wx - 0.17, wx + 0.17, s.z0 - 0.15, s.z1, -0.40, 1.15, false);
      }
      const backZ = s.bottomZ - 0.16;
      const headH = 0.94 - Y_CEIL;
      addRBox(surfaceDecor, wid + 0.66, headH, 0.36, 0.04, brickVaultMat, cx, (0.94 + Y_CEIL) * 0.5, backZ);
      pushBlocker(s.x0 - 0.32, s.x1 + 0.32, backZ - 0.18, backZ + 0.18, -0.40, 1.15, false);
    }
  }

  for (const s of STAIRS) buildStairwell(s);

  // --- Portal Dressing 1: East Open Slanted Timber Storm-Cellar Bulkhead Doors
  {
    const cx = (STAIR_EAST.x0 + STAIR_EAST.x1) * 0.5 + 0.85;
    for (const side of [-1, 1]) {
      const hingeZ = side < 0 ? STAIR_EAST.z0 - 0.14 : STAIR_EAST.z1 + 0.14;
      const leaf = new THREE.Group();
      leaf.position.set(cx, 0.94, hingeZ);
      leaf.rotation.x = side * 0.92; // propped open outward at charming bulkhead angle!
      addRBox(leaf, 3.8, 0.09, 1.55, 0.02, darkTimberMat, 0, 0, side * 0.78);
      for (const hx of [-1.35, 0, 1.35]) {
        addRBox(leaf, 0.10, 0.12, 1.42, 0.015, ironMat, hx, 0.02, side * 0.76);
      }
      surfaceDecor.add(leaf);
    }
    // Warm timber lantern post beside the open West mouth (x = 8.8)
    addRBox(surfaceDecor, 0.18, 2.35, 0.18, 0.03, timberMat, STAIR_EAST.x0 - 0.25, 1.17, STAIR_EAST.z1 + 0.22);
    addRBox(surfaceDecor, 0.55, 0.12, 0.14, 0.02, timberMat, STAIR_EAST.x0 - 0.05, 2.22, STAIR_EAST.z1 + 0.22);
    const eLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.22, 8), lanternGlassMat);
    eLamp.position.set(STAIR_EAST.x0 + 0.12, 1.98, STAIR_EAST.z1 + 0.22);
    underGlow.add(eLamp);
  }

  // --- Portal Dressing 2: West Rustic Timber Pergola Arch & Hanging Lantern
  {
    const px = STAIR_WEST.topX - 0.05;
    const cz = (STAIR_WEST.z0 + STAIR_WEST.z1) * 0.5;
    for (const pz of [STAIR_WEST.z0 - 0.18, STAIR_WEST.z1 + 0.18]) {
      addRBox(surfaceDecor, 0.24, 2.90, 0.24, 0.04, timberMat, px, 1.45, pz);
      addRBox(surfaceDecor, 0.22, 2.90, 0.22, 0.04, timberMat, px + 1.15, 1.45, pz);
      addRBox(surfaceDecor, 1.65, 0.16, 0.18, 0.03, darkTimberMat, px + 0.58, 2.86, pz);
    }
    for (const bx of [px - 0.1, px + 0.58, px + 1.25]) {
      addRBox(surfaceDecor, 0.18, 0.20, 4.45, 0.03, timberMat, bx, 3.02, cz);
    }
    // Climbing ivy tufts across the pergola crown
    for (let i = 0; i < 9; i++) {
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), mossLeafMat);
      tuft.scale.set(1.2, 0.7, 1.3);
      tuft.position.set(px + rng.jr(-0.1, 1.25), 3.12 + rng.jr(-0.08, 0.08), cz + rng.jr(-1.85, 1.85));
      surfaceDecor.add(tuft);
    }
    const wLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.24, 8), lanternGlassMat);
    wLamp.position.set(px + 0.15, 2.58, cz);
    underGlow.add(wLamp);
  }

  // --- Portal Dressing 3: Picturesque Mossy Brick Culvert Archway beside Stream & Bridge
  {
    const az = STAIR_CULVERT.topZ - 0.45;
    const cx = (STAIR_CULVERT.x0 + STAIR_CULVERT.x1) * 0.5;
    // Left & right brick piers + curved Romanesque brick arch ring (clear crown height = 2.95m!)
    for (const sx of [-1, 1]) {
      addRBox(surfaceDecor, 0.52, 2.15, 0.95, 0.05, brickVaultMat, cx + sx * 1.98, 1.07, az);
    }
    const archSegs = 11;
    const archR = 1.98;
    for (let i = 0; i <= archSegs; i++) {
      const a = (i / archSegs) * Math.PI;
      const vx = cx - Math.cos(a) * archR;
      const vy = 1.95 + Math.sin(a) * 1.12;
      const mat = i === Math.floor(archSegs / 2) ? stoneWallMat : brickVaultMat;
      addRBox(surfaceDecor, 0.52, 0.36, 0.98, 0.04, mat, vx, vy, az, 0, 0, a - Math.PI * 0.5);
    }
    // Moss & fern cap along top of the culvert headwall
    for (let i = 0; i < 8; i++) {
      const a = (i / 7) * Math.PI;
      const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), mossLeafMat);
      moss.scale.set(1.3, 0.6, 1.2);
      moss.position.set(cx - Math.cos(a) * 1.9, 2.18 + Math.sin(a) * 1.08, az);
      surfaceDecor.add(moss);
    }
    const cLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.22, 8), lanternGlassMat);
    cLamp.position.set(cx, 2.68, az + 0.35);
    underGlow.add(cLamp);
  }

  // ==========================================================================
  // 5. Merge Static Meshes & Register Solids Cleanly (Phone-Friendly Draw Calls)
  // ==========================================================================
  mergeStatic(THREE, surfaceWalkable);
  mergeStatic(THREE, surfaceDecor);
  mergeStatic(THREE, underWalkable);
  mergeStatic(THREE, underArch);

  surfaceWalkable.traverse((m) => {
    if (m.isMesh) {
      m.receiveShadow = true;
      m.castShadow = false;
      m.userData.ground = true;
      solids.push(m);
    }
  });
  surfaceDecor.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      solids.push(m);
    }
  });
  underWalkable.traverse((m) => {
    if (m.isMesh) {
      m.receiveShadow = true;
      m.castShadow = false;
      m.userData.ground = true;
      solids.push(m);
    }
  });
  underArch.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = true;
      solids.push(m);
    }
  });

  enforceZeroMetalness(surfacePortalsGroup);
  enforceZeroMetalness(undergroundGroup);

  // ==========================================================================
  // 6. Emissive Warm & Crystal Cavern Light Halos (Zero PointLight / Zero Shader Recompiles!)
  // ==========================================================================
  const WING_LIGHT_ANCHORS = [
    { x: WELL_CX, y: -1.32, z: WELL_CZ, hex: 0xffbe6b },
    { x: 17.8, y: -1.32, z: -5.4, hex: 0xffb866 },  // Cheese & Cider Cellar
    { x: -16.2, y: -1.32, z: 1.5, hex: 0xffc478 },  // Crystal & Root Vault
    { x: 9.2, y: -1.32, z: 11.3, hex: 0xffb866 },   // Mossy Culvert Chamber
  ];
  const TUNNEL_LIGHT_ANCHORS = [
    { x: -17.8, y: -1.65, z: 3.4, hex: 0x6ae8ff },  // West Celestia Crystal Geode Glow
    { x: -8.6, y: -1.45, z: 1.6, hex: 0x8beaff },   // West Corridor Crystals
    { x: 11.2, y: -1.45, z: -2.0, hex: 0xffbe68 },  // East Cooperage Corridor
    { x: 4.1, y: -1.45, z: 10.6, hex: 0x7ef0d4 },   // NE Boardwalk Corridor
  ];
  if (typeof document !== 'undefined' && THREE.Sprite) {
    const gc = document.createElement('canvas');
    gc.width = gc.height = 64;
    const gctx = gc.getContext('2d');
    if (gctx) {
      const gr = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.42, 'rgba(255,255,255,0.34)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      gctx.fillStyle = gr;
      gctx.fillRect(0, 0, 64, 64);
    }
    const underHaloTex = new THREE.CanvasTexture(gc);
    for (const a of [...WING_LIGHT_ANCHORS, ...TUNNEL_LIGHT_ANCHORS]) {
      const spMat = new THREE.SpriteMaterial({
        map: underHaloTex,
        color: a.hex,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(spMat);
      sp.position.set(a.x, a.y, a.z);
      sp.scale.set(4.8, 3.8, 1);
      underGlow.add(sp);
    }
  }

  // ==========================================================================
  // 7. Queue 9 Bustling Underground Prop Vignettes & 10 Camouflage Spots
  // ==========================================================================
  if (typeof addSpot === 'function') {
    addSpot(new THREE.Vector3(1.5, Y_UNDER, -2.5), 0xb8cbb0, 'stone');
    addSpot(new THREE.Vector3(-2.6, Y_UNDER, 2.8), 0xb8cbb0, 'stone');
    addSpot(new THREE.Vector3(5.2, Y_UNDER, 2.9), 0xd8cfc0, 'stone');
    addSpot(new THREE.Vector3(11.0, Y_UNDER, -1.2), 0xd4cdc2, 'stone');
    addSpot(new THREE.Vector3(18.4, Y_UNDER, -3.2), 0xcab99f, 'wall');
    addSpot(new THREE.Vector3(16.6, Y_UNDER, -8.8), 0xcab99f, 'wall');
    addSpot(new THREE.Vector3(-8.5, Y_UNDER, 2.2), 0xd4cdc2, 'stone');
    addSpot(new THREE.Vector3(-16.2, Y_UNDER, 0.8), 0x7c583a, 'stone');
    addSpot(new THREE.Vector3(4.1, Y_UNDER, 10.4), 0xd89f84, 'stone');
    addSpot(new THREE.Vector3(9.4, Y_UNDER, 12.2), 0xd89f84, 'stone');
  }

  if (typeof addVig === 'function') {
    // 1. Central Cistern North & South Nooks
    addVig('cistern_south_props', { x: 1.5, y: Y_UNDER, z: 1.5, rot: 0, b: null }, [
      ['mb_glow_shroom_pot', -4.2, -4.6, 0.2],
      ['mb_crystal_crate', -2.8, -4.5, 0.35],
      ['barrel', 2.2, -4.5, 0.2],
      ['mb_cider_cask', 3.5, -4.4, -0.25],
      ['lantern_stool', -4.4, -1.8, 0.4],
    ], 2);

    addVig('cistern_north_props', { x: 1.5, y: Y_UNDER, z: 1.5, rot: 0, b: null }, [
      ['mb_glow_shroom_pot', -4.2, 4.4, -0.5],
      ['mb_crystal_crate', 3.4, 4.5, 0.5],
      ['mb_cider_cask', 4.6, 2.8, 0.6],
      ['crate', 4.7, 1.4, 0.1],
      ['mb_cheese_wheel', -3.9, 1.8, 0.8],
    ], 2);

    // 2. East Corridor Wall Alcove (keeps >= 2.5m clear walkway!)
    addVig('tunnel_east_alcove', { x: 11.0, y: Y_UNDER, z: -2.0, rot: 0, b: null }, [
      ['mb_cider_cask', -2.1, 1.25, 0.15],
      ['mb_cheese_wheel', 0.4, 1.30, 0.6],
      ['mb_glow_shroom_pot', 2.2, 1.28, -0.3],
    ], 1);

    // 3. East Cheese & Cider Cooperage (North & South Bays)
    addVig('cheese_cellar_north', { x: 18.0, y: Y_UNDER, z: -3.2, rot: 0, b: null }, [
      ['mb_cider_cask', 1.4, 2.1, 0.1],
      ['mb_cheese_wheel', 1.3, 0.8, 0.4],
      ['mb_cheese_wheel', 0.3, 1.8, 1.2],
      ['barrel', -2.2, 2.6, 0.2],
      ['lantern_stool', -0.4, 2.2, 0.3],
    ], 2);

    addVig('cheese_cellar_south', { x: 18.0, y: Y_UNDER, z: -8.2, rot: 0, b: null }, [
      ['mb_cider_cask', 1.5, 1.6, 0.0],
      ['mb_cider_cask', 0.1, -2.2, 0.25],
      ['mb_cheese_wheel', -1.2, -2.3, -0.5],
      ['crate', -2.3, -2.2, -0.2],
      ['flour_sack', 1.4, 0.3, 0.4],
    ], 2);

    // 4. West Corridor Crystal Alcove (keeps >= 2.5m clear central rail!)
    addVig('tunnel_west_alcove', { x: -8.6, y: Y_UNDER, z: 1.6, rot: 0, b: null }, [
      ['mb_crystal_crate', -2.0, -1.28, 0.2],
      ['mb_glow_shroom_pot', 0.3, 1.28, 0.5],
      ['pumpkin', 2.1, -1.28, -0.4],
    ], 1);

    // 5. West Crystal & Root Vault (North Rail Side & South Apothecary Side)
    addVig('root_vault_north', { x: -16.3, y: Y_UNDER, z: 3.2, rot: 0, b: null }, [
      ['mb_crystal_crate', -2.3, -0.4, 0.3],
      ['mb_crystal_crate', 1.9, 1.1, -0.25],
      ['mb_glow_shroom_pot', -1.4, 1.2, 0.5],
      ['lantern_stool', 2.2, -0.2, 0.0],
    ], 2);

    addVig('root_vault_south', { x: -16.3, y: Y_UNDER, z: -0.4, rot: 0, b: null }, [
      ['pumpkin', -2.2, -1.2, 0.3],
      ['pumpkin', 1.4, -1.3, -0.6],
      ['flour_sack', 2.3, -1.1, 0.2],
      ['crate', -2.4, 0.2, 0.15],
      ['mb_crystal_crate', 0.2, -0.2, 0.55],
    ], 2);

    // 6. North-East Boardwalk & Culvert Smuggler's Dock
    addVig('culvert_dock_props', { x: 9.4, y: Y_UNDER, z: 11.4, rot: 0, b: null }, [
      ['mb_glow_shroom_pot', 1.6, 1.8, 0.3],
      ['mb_crystal_crate', -2.4, -2.0, -0.2],
      ['mb_cider_cask', -1.1, -2.1, 0.2],
      ['barrel', 0.2, -2.1, 0.4],
      ['mb_cheese_wheel', -2.6, 1.8, 0.8],
      ['lantern_stool', 0.4, 1.9, -0.2],
    ], 1);

    // 7. Extra Underground Vignettes (Central Cistern West Arch, NE Boardwalk Nook, Cooperage Center)
    addVig('cistern_west_arch', { x: -2.2, y: Y_UNDER, z: -1.6, rot: 0, b: null }, [
      ['mb_crystal_crate', -0.6, -1.1, 0.2],
      ['mb_glow_shroom_pot', 0.5, -1.2, -0.4],
      ['mb_cheese_wheel', 1.4, -1.0, 0.6],
      ['bucket', -1.3, -0.9, 0.1],
    ], 1);

    addVig('boardwalk_nook', { x: 3.1, y: Y_UNDER, z: 9.4, rot: 0, b: null }, [
      ['mb_glow_shroom_pot', -0.4, -1.2, 0.3],
      ['mb_crystal_crate', -0.4, 0.6, -0.2],
      ['lantern_stool', -0.35, 1.8, 0.1],
    ], 1);

    addVig('cooperage_press_side', { x: 16.0, y: Y_UNDER, z: -5.6, rot: 0, b: null }, [
      ['mb_cider_cask', -0.5, -0.9, 0.2],
      ['mb_cheese_wheel', -0.4, 0.4, 0.7],
      ['mb_apple_basket', -0.45, 1.5, -0.3],
      ['veg_basket', 0.5, 1.6, 0.4],
    ], 1);
  }

  // ==========================================================================
  // 8. Underground Rides, 3 Signature Hiding Spots & 2 Synced Contraptions!
  // ==========================================================================
  const wellBucketDownSpot = {
    id: 'mb_well_down',
    name: 'well_bucket_down',
    kind: 'ride_path',
    icon: '🪣',
    label: 'Drop down Wishing-Well Bucket',
    prompt: '🪣 Drop down Wishing-Well Bucket',
    x: 1.5,
    y: 0,
    z: 2.95,
    groundY: 0,
    radius: 2.35,
    interactRadius: 2.35,
    fromX: 1.5,
    fromY: 0,
    fromZ: 2.95,
    toX: 1.5,
    toY: Y_UNDER,
    toZ: 3.1,
    dur: 1.25,
    arcY: 0.85,
    enterHint: '🪣 Dropped down the wishing-well rope bucket into the mossy cistern!',
  };

  const wellBucketUpSpot = {
    id: 'mb_well_up',
    name: 'well_bucket_up',
    kind: 'ride_path',
    icon: '🪣',
    label: 'Ride Wishing-Well Bucket Up',
    prompt: '🪣 Ride Wishing-Well Bucket Up',
    x: 1.5,
    y: Y_UNDER,
    z: 3.1,
    groundY: Y_UNDER,
    radius: 2.35,
    interactRadius: 2.35,
    fromX: 1.5,
    fromY: Y_UNDER,
    fromZ: 3.1,
    toX: 1.5,
    toY: 0,
    toZ: 2.95,
    dur: 1.25,
    arcY: 0.85,
    enterHint: '🪣 Rode the wishing-well rope bucket right back up to the Village Plaza!',
  };

  const wellGeyserSpot = {
    id: 'mb_well_geyser',
    kind: 'mechanism',
    mechType: 'well_geyser',
    icon: '💦',
    label: 'Open Wishing-Well Geyser Valve!',
    x: 3.08,
    y: Y_UNDER,
    groundY: Y_UNDER,
    z: 1.50,
    interactRadius: 2.55,
  };

  const boilerSteamSpot = {
    id: 'mb_cellar_steam',
    kind: 'mechanism',
    mechType: 'boiler_steam',
    icon: '💨',
    label: 'Vent Boiler Steam Curtain!',
    x: -13.15,
    y: Y_UNDER,
    groundY: Y_UNDER,
    z: -0.55,
    interactRadius: 2.65,
  };

  const ciderTunSpot = {
    id: 'mb_cider_tun_spot',
    kind: 'custom_spot',
    disguiseType: 'cider_tun_lid',
    spotType: 'cider_tun_lid',
    icon: '🛢️',
    label: 'Hide in Giant Cider Tun',
    leaveLabel: 'Hop Out of Cider Tun',
    disguiseLabel: 'Giant Cider Tun 🛢️',
    enterHint: '🛢️ Ducked inside the Giant Oak Cider Tun under foaming orchard apples! (WASD or G to hop out)',
    exitHint: '🛢️ Hopped out of the Giant Cider Tun!',
    x: 19.35,
    y: Y_UNDER,
    groundY: Y_UNDER,
    z: -9.55,
    offsetY: 0,
    rot: 0.4,
    exitX: 18.25,
    exitY: Y_UNDER,
    exitZ: -8.95,
    interactRadius: 2.45,
    height: 1.32,
    radius: 0.56,
    hp: 115,
  };

  const minecartSpot = {
    id: 'mb_minecart_spot',
    kind: 'custom_spot',
    disguiseType: 'minecart_pile',
    spotType: 'minecart_pile',
    icon: '🛒',
    label: 'Duck in Harvest Minecart',
    leaveLabel: 'Hop Out of Minecart',
    disguiseLabel: 'Crystal Minecart 🛒',
    enterHint: '🛒 Ducked inside the Timber Minecart beneath glowing Celestia crystals! (WASD or G to hop out)',
    exitHint: '🛒 Hopped out of the Harvest Minecart!',
    x: -16.2,
    y: Y_UNDER,
    groundY: Y_UNDER,
    z: 3.6,
    offsetY: 0,
    rot: -0.36,
    exitX: -16.2,
    exitY: Y_UNDER,
    exitZ: 2.45,
    interactRadius: 2.45,
    height: 1.15,
    radius: 0.52,
    hp: 110,
  };

  const culvertCurtainSpot = {
    id: 'mb_culvert_curtain',
    kind: 'custom_spot',
    disguiseType: 'moss_curtain',
    spotType: 'moss_curtain',
    icon: '🌿',
    label: 'Hide Behind Moss Waterfall',
    leaveLabel: 'Step Out of Waterfall',
    disguiseLabel: 'Moss Waterfall 🌿',
    enterHint: '🌿 Slipped behind the mossy culvert waterfall curtain! (WASD or G to step out)',
    exitHint: '🌿 Stepped out from behind the moss waterfall!',
    x: 11.15,
    y: Y_UNDER,
    groundY: Y_UNDER,
    z: 9.28,
    offsetY: 0,
    rot: 0,
    exitX: 10.35,
    exitY: Y_UNDER,
    exitZ: 10.25,
    interactRadius: 2.45,
    height: 1.65,
    radius: 0.46,
    hp: 105,
  };

  const interactSpots = [
    wellBucketDownSpot,
    wellBucketUpSpot,
    wellGeyserSpot,
    boilerSteamSpot,
    ciderTunSpot,
    minecartSpot,
    culvertCurtainSpot,
  ];

  // ==========================================================================
  // 9. Multi-Tier & Wing-to-Wing AI Waypoint Router
  // ==========================================================================
  function classifyUndergroundWing(x, z) {
    if (x >= CISTERN_BOX.x0 - 0.3 && x <= CISTERN_BOX.x1 + 0.3 &&
        z >= CISTERN_BOX.z0 - 0.3 && z <= CISTERN_BOX.z1 + 0.3) {
      return 'cistern';
    }
    if (z > 7.0) return 'culvert';
    if (x < -4.2) return 'west';
    return 'east';
  }

  function findStairContaining(x, z) {
    const pad = 0.65;
    for (let i = 0; i < STAIRS.length; i++) {
      const s = STAIRS[i];
      if (x >= s.x0 - pad && x <= s.x1 + pad && z >= s.z0 - pad && z <= s.z1 + pad) {
        return s;
      }
    }
    return null;
  }

  function stepTowardUndergroundHub(from, targetWing) {
    const curWing = classifyUndergroundWing(from.x, from.z);
    if (curWing === targetWing) return null;

    // Leave current wing toward Central Cistern (1.5, -3.4, 1.5)
    if (curWing === 'east') {
      if (from.x > 14.2 && Math.abs(from.z - (-2.0)) > 1.15) return { x: 16.4, y: Y_UNDER, z: -2.0 };
      return { x: 5.8, y: Y_UNDER, z: -2.0 };
    }
    if (curWing === 'west') {
      if (from.x < -12.4 && Math.abs(from.z - 1.6) > 1.15) return { x: -14.2, y: Y_UNDER, z: 1.6 };
      return { x: -2.8, y: Y_UNDER, z: 1.6 };
    }
    if (curWing === 'culvert') {
      if (from.x > 5.4 && Math.abs(from.z - 11.2) > 1.15) return { x: 8.0, y: Y_UNDER, z: 11.2 };
      if (from.x > 5.4) return { x: 4.1, y: Y_UNDER, z: 11.2 };
      return { x: 4.1, y: Y_UNDER, z: 5.6 };
    }

    // Currently inside Central Cistern -> enter targetWing corridor cleanly!
    if (targetWing === 'east') {
      if (Math.hypot(from.x - 5.8, from.z - (-2.0)) > 1.8) return { x: 5.8, y: Y_UNDER, z: -2.0 };
      return { x: 16.4, y: Y_UNDER, z: -2.0 };
    }
    if (targetWing === 'west') {
      if (Math.hypot(from.x - (-2.8), from.z - 1.6) > 1.8) return { x: -2.8, y: Y_UNDER, z: 1.6 };
      return { x: -14.2, y: Y_UNDER, z: 1.6 };
    }
    if (targetWing === 'culvert') {
      if (Math.hypot(from.x - 4.1, from.z - 5.6) > 1.8) return { x: 4.1, y: Y_UNDER, z: 5.6 };
      return { x: 4.1, y: Y_UNDER, z: 11.2 };
    }
    return { x: WELL_CX, y: Y_UNDER, z: WELL_CZ };
  }

  function routeAroundStairOnSurface(from, target) {
    for (let i = 0; i < STAIRS.length; i++) {
      const s = STAIRS[i];
      if (s.axis === 'x') {
        // Open mouth is on West side (x = s.x0). Avoid walking East back into mouth or clipping side parapets!
        const inFrontOfMouth = from.x <= s.x0 + 0.3 && from.x >= s.x0 - 2.8 &&
                               from.z >= s.z0 - 0.85 && from.z <= s.z1 + 0.85;
        if (inFrontOfMouth && target.x > s.x0 - 0.4) {
          const flankZ = target.z >= (s.z0 + s.z1) * 0.5 ? s.z1 + 1.15 : s.z0 - 1.15;
          return { x: s.x0 - 1.15, y: 0, z: flankZ };
        }
      } else {
        // STAIR_CULVERT: open mouth is on North side (z = s.z1). Avoid walking South back into mouth!
        const inFrontOfMouth = from.z >= s.z1 - 0.3 && from.z <= s.z1 + 2.8 &&
                               from.x >= s.x0 - 0.85 && from.x <= s.x1 + 0.85;
        if (inFrontOfMouth && target.z < s.z1 + 0.4) {
          const flankX = target.x >= (s.x0 + s.x1) * 0.5 ? s.x1 + 1.15 : s.x0 - 1.15;
          return { x: flankX, y: 0, z: s.z1 + 1.15 };
        }
      }
    }
    return null;
  }

  function approachStairTopOnSurface(from, s) {
    if (s.axis === 'x') {
      // Already aligned in front of the open West mouth -> head straight down the stairs!
      if (from.z >= s.z0 + 0.65 && from.z <= s.z1 - 0.65 && from.x <= s.x0 + 0.15) {
        return s.bottomWp;
      }
      // East of mouth -> round the nearer N/S parapet corner cleanly first
      if (from.x > s.x0 - 0.65) {
        const flankZ = from.z >= (s.z0 + s.z1) * 0.5 ? s.z1 + 1.2 : s.z0 - 1.2;
        if (Math.abs(from.z - flankZ) > 0.7 && from.z > s.z0 - 0.7 && from.z < s.z1 + 0.7) {
          return { x: from.x, y: 0, z: flankZ };
        }
        return { x: s.x0 - 1.35, y: 0, z: flankZ };
      }
      return s.topWp;
    }
    // STAIR_CULVERT: already aligned in front of the open North culvert arch -> head straight down!
    if (from.x >= s.x0 + 0.65 && from.x <= s.x1 - 0.65 && from.z >= s.z1 - 0.15) {
      return s.bottomWp;
    }
    if (from.z < s.z1 + 0.65) {
      const flankX = from.x >= (s.x0 + s.x1) * 0.5 ? s.x1 + 1.2 : s.x0 - 1.2;
      if (Math.abs(from.x - flankX) > 0.7 && from.x > s.x0 - 0.7 && from.x < s.x1 + 0.7) {
        return { x: flankX, y: 0, z: from.z };
      }
      return { x: flankX, y: 0, z: s.z1 + 1.35 };
    }
    return s.topWp;
  }

  function routeWaypoint(from, goal) {
    if (!from || !goal) return null;
    const fy = typeof from.y === 'number' ? from.y : 0;
    const gy = typeof goal.y === 'number' ? goal.y : 0;
    const activeStair = fy < 0.35 ? findStairContaining(from.x, from.z) : null;

    // If inside a stairwell channel, walk cleanly past the side parapets first!
    if (activeStair && fy < -0.04) {
      if (gy > -0.5) {
        return activeStair.topWp;
      }
      if (gy < -1.2) {
        const clearedBottom =
          activeStair.id === 'east' ? from.x >= activeStair.x1 + 0.65 :
          activeStair.id === 'west' ? from.x >= activeStair.x1 + 0.65 :
          from.z <= activeStair.z0 - 0.65;
        if (!clearedBottom) return activeStair.bottomWp;
      }
    }

    // Surface -> Surface: if standing right outside an open stairwell mouth, sidestep so AI never falls back down!
    if (fy >= -0.04 && gy > -0.5) {
      const sidestep = routeAroundStairOnSurface(from, goal);
      if (sidestep) return sidestep;
    }

    // Case 1: Underground (fy < -1.2) -> Surface (gy > -0.5)
    if (fy < -1.2 && gy > -0.5) {
      let best = STAIRS[0], bestCost = Infinity;
      for (let i = 0; i < STAIRS.length; i++) {
        const s = STAIRS[i];
        const cost = Math.hypot(from.x - s.bottomWp.x, from.z - s.bottomWp.z) +
                     0.45 * Math.hypot(goal.x - s.topWp.x, goal.z - s.topWp.z);
        if (cost < bestCost) { bestCost = cost; best = s; }
      }
      const hubStep = stepTowardUndergroundHub(from, best.id);
      if (hubStep) return hubStep;
      if (Math.hypot(from.x - best.bottomWp.x, from.z - best.bottomWp.z) > 1.35) {
        return best.bottomWp;
      }
      return best.topWp;
    }

    // Case 2: Surface (fy >= -0.5) -> Underground (gy < -1.2)
    if (fy >= -0.5 && gy < -1.2) {
      let best = STAIRS[0], bestCost = Infinity;
      for (let i = 0; i < STAIRS.length; i++) {
        const s = STAIRS[i];
        const cost = Math.hypot(from.x - s.topWp.x, from.z - s.topWp.z) +
                     0.35 * Math.hypot(goal.x - s.bottomWp.x, goal.z - s.bottomWp.z);
        if (cost < bestCost) { bestCost = cost; best = s; }
      }
      return approachStairTopOnSurface(from, best);
    }

    // Case 3: Both Underground in different wings -> route cleanly through Central Cistern!
    if (fy < -1.2 && gy < -1.2) {
      const fWing = classifyUndergroundWing(from.x, from.z);
      const gWing = classifyUndergroundWing(goal.x, goal.z);
      if (fWing !== gWing) {
        if (fWing !== 'cistern' && gWing !== 'cistern') {
          if (Math.hypot(from.x - WELL_CX, from.z - WELL_CZ) > 3.6) {
            return stepTowardUndergroundHub(from, 'cistern') || { x: WELL_CX, y: Y_UNDER, z: WELL_CZ };
          }
        }
        return stepTowardUndergroundHub(from, gWing);
      }
      // Handle L-bend inside North-East Culvert wing
      if (fWing === 'culvert') {
        if (from.x < 5.8 && goal.x > 6.4 && from.z < 9.2) return { x: 4.1, y: Y_UNDER, z: 11.2 };
        if (from.x > 6.4 && goal.x < 5.8 && goal.z < 9.2) return { x: 4.1, y: Y_UNDER, z: 11.2 };
      }
    }

    return null;
  }

  // ==========================================================================
  // 10. Underground Contraption Synths, Steam Pool, Geyser Launcher & Update
  // ==========================================================================
  const ropeBucketObj = underGlow.getObjectByName('wellRopeBucket');
  let localTime = 0;
  let geyserLastAt = -999;
  let geyserRemain = 0;
  let steamLastAt = -999;
  let steamLeverPull = 0;
  const geyserLaunchCooldown = new WeakMap();

  const geyserRideOutSpot = {
    id: 'mb_well_geyser_ride',
    kind: 'ride_path',
    fromX: WELL_CX,
    fromY: Y_UNDER,
    fromZ: WELL_CZ,
    toX: 1.5,
    toY: 0,
    toZ: 2.95,
    dur: 0.90,
    arcY: 2.25,
    enterHint: '💦 WHOOSH! Rode the Wishing-Well Geyser straight out onto the Village Plaza!',
  };

  // Reusable 18-puff boiler steam curtain pool (zero runtime allocations!)
  const STEAM_PUFF_COUNT = 18;
  const steamContainer = new THREE.Group();
  steamContainer.name = 'boilerSteamCurtainPool';
  steamContainer.userData.keep = true;
  underGlow.add(steamContainer);

  const steamGeo = new THREE.SphereGeometry(0.58, 9, 7);
  const steamMats = [0.64, 0.48, 0.32, 0.18].map(
    (op) =>
      new THREE.MeshBasicMaterial({
        color: 0xf4fbff,
        transparent: true,
        opacity: op,
        depthWrite: false,
      })
  );
  const steamPuffs = [];
  for (let i = 0; i < STEAM_PUFF_COUNT; i++) {
    const m = new THREE.Mesh(steamGeo, steamMats[0]);
    m.visible = false;
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = 5;
    m.userData.noSolid = true;
    m.userData.keep = true;
    steamContainer.add(m);
    steamPuffs.push({
      mesh: m,
      ang: (i / STEAM_PUFF_COUNT) * Math.PI * 2 + (i % 4) * 0.37,
      distFrac: 0.15 + ((i * 5) % 11) / 11 * 0.82,
      baseY: Y_UNDER + 0.42 + ((i * 3) % 7) / 7 * 1.65,
      phase: i * 0.83,
      scaleBase: 0.82 + (i % 3) * 0.24,
    });
  }

  function playUndergroundMechAudio(kind) {
    try {
      const audioApi = env.audio;
      if (!audioApi || audioApi.isMuted?.()) return;
      const ac = audioApi.getContext?.();
      const out = audioApi.getSfxBus?.() || ac?.destination;
      if (!ac || !out || ac.state !== 'running') return;
      const t0 = ac.currentTime + 0.01;
      const dur = kind === 'geyser' ? 0.85 : 0.72;
      const len = Math.max(512, Math.floor(ac.sampleRate * dur));
      const nBuf = ac.createBuffer(1, len, ac.sampleRate);
      const ch = nBuf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = nBuf;
      const flt = ac.createBiquadFilter();
      flt.type = 'bandpass';
      if (kind === 'geyser') {
        flt.frequency.setValueAtTime(240, t0);
        flt.frequency.exponentialRampToValueAtTime(1180, t0 + 0.25);
        flt.frequency.exponentialRampToValueAtTime(420, t0 + dur);
        flt.Q.value = 1.2;
      } else {
        flt.frequency.setValueAtTime(900, t0);
        flt.frequency.exponentialRampToValueAtTime(2400, t0 + 0.15);
        flt.frequency.exponentialRampToValueAtTime(620, t0 + dur);
        flt.Q.value = 1.6;
        // Cheerful brass steam whistle!
        const osc = ac.createOscillator();
        const og = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1180, t0);
        osc.frequency.exponentialRampToValueAtTime(1560, t0 + 0.22);
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.linearRampToValueAtTime(0.09, t0 + 0.03);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
        osc.connect(og);
        og.connect(out);
        osc.start(t0);
        osc.stop(t0 + 0.30);
      }
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.linearRampToValueAtTime(0.22, t0 + 0.06);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt);
      flt.connect(ng);
      ng.connect(out);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    } catch (_) {
      /* ignore audio unlock edge cases */
    }
  }

  function triggerMechanism(ch, inter) {
    if (!inter) return null;
    const id = inter.id || '';
    if (id === 'mb_well_geyser' || inter.mechType === 'well_geyser') {
      const elapsed = localTime - geyserLastAt;
      if (elapsed < 11.0 && geyserRemain <= 0) {
        return `💦 Well geyser pressure is building (${Math.max(1, Math.ceil(11.0 - elapsed))}s)!`;
      }
      geyserLastAt = localTime;
      geyserRemain = 4.2;
      wellGeyserGroup.visible = true;
      playUndergroundMechAudio('geyser');
      return '💦 Wishing-Well Geyser ERUPTING! Step into the pool to rocket up to the Town Square!';
    }
    if (id === 'mb_cellar_steam' || inter.mechType === 'boiler_steam') {
      const elapsed = localTime - steamLastAt;
      if (elapsed < 12.0) {
        return `💨 Copper boiler is building steam (${Math.max(1, Math.ceil(12.0 - elapsed))}s)!`;
      }
      steamLastAt = localTime;
      steamLeverPull = 0.85;
      playUndergroundMechAudio('steam');
      ACTIVE_UNDER_STEAM_CLOUDS.length = 0;
      ACTIVE_UNDER_STEAM_CLOUDS.push({
        id: 'mb_cellar_steam',
        x: -12.3,
        y: Y_UNDER + 1.15,
        z: 1.5,
        age: 0,
        dur: 4.0,
        radius: 2.85,
      });
      return '💨 Vented the Copper Root-Boiler — thick steam curtain blocking tunnel sightlines!';
    }
    return null;
  }

  function sampleLauncherAt(ch) {
    if (geyserRemain <= 0 || !ch || !ch.userData || ch.userData.specialMode) return null;
    const u = ch.userData;
    const footY = (u.groundY ?? ch.position.y ?? 0) + (u.jy || 0);
    if (footY > -1.6) return null;
    if (Math.hypot(ch.position.x - WELL_CX, ch.position.z - WELL_CZ) > 1.85) return null;
    const lastAt = geyserLaunchCooldown.get(ch) || -999;
    if (localTime - lastAt < 1.6) return null;
    geyserLaunchCooldown.set(ch, localTime);
    return {
      rideSpot: Object.assign({}, geyserRideOutSpot, {
        fromX: ch.position.x,
        fromY: footY,
        fromZ: ch.position.z,
      }),
      hintMsg: geyserRideOutSpot.enterHint,
    };
  }

  function update(dt = 0.016, timeSec, camera, playerFootY) {
    const safeDt = clamp(dt || 0.016, 0, 0.12);
    localTime = typeof timeSec === 'number' ? timeSec : localTime + safeDt;

    const camY = camera && camera.position ? camera.position.y : 10;
    const pY = typeof playerFootY === 'number' ? playerFootY : 10;
    const isNearOrUnder = pY < -0.2 || camY < 0.8;
    if (underGlow.visible !== isNearOrUnder) underGlow.visible = isNearOrUnder;

    // Update Wishing-Well Geyser column (visible on surface too when erupting out of the Plaza well!)
    if (geyserRemain > 0) {
      geyserRemain = Math.max(0, geyserRemain - safeDt);
      const envScale = geyserRemain > 3.7 ? (4.2 - geyserRemain) / 0.5 : geyserRemain < 0.6 ? geyserRemain / 0.6 : 1.0;
      wellGeyserGroup.visible = envScale > 0.02;
      wellGeyserGroup.scale.set(0.88 + 0.18 * Math.sin(localTime * 16), clamp(envScale, 0.05, 1.05), 0.88 + 0.18 * Math.cos(localTime * 16));
      wellGeyserGroup.rotation.y = localTime * 4.5;
      geyserValveWheelPivot.rotation.x += safeDt * 6.5;
    } else if (wellGeyserGroup.visible) {
      wellGeyserGroup.visible = false;
    }

    // Update Boiler Steam Curtain Puffs (4.0s duration)
    if (steamLeverPull > 0) {
      steamLeverPull = Math.max(0, steamLeverPull - safeDt);
      steamLeverPivot.rotation.z = -Math.sin((steamLeverPull / 0.85) * Math.PI) * 0.72;
    }
    for (let c = ACTIVE_UNDER_STEAM_CLOUDS.length - 1; c >= 0; c--) {
      ACTIVE_UNDER_STEAM_CLOUDS[c].age += safeDt;
      if (ACTIVE_UNDER_STEAM_CLOUDS[c].age >= ACTIVE_UNDER_STEAM_CLOUDS[c].dur) {
        ACTIVE_UNDER_STEAM_CLOUDS.splice(c, 1);
      }
    }
    if (ACTIVE_UNDER_STEAM_CLOUDS.length === 0) {
      for (let i = 0; i < STEAM_PUFF_COUNT; i++) {
        if (steamPuffs[i].mesh.visible) steamPuffs[i].mesh.visible = false;
      }
    } else {
      const cl = ACTIVE_UNDER_STEAM_CLOUDS[0];
      const u = clamp(cl.age / cl.dur, 0, 1);
      const expand = u < 0.15 ? u / 0.15 : 1.0;
      const fade = u > 0.68 ? clamp(1 - (u - 0.68) / 0.32, 0, 1) : 1.0;
      for (let i = 0; i < STEAM_PUFF_COUNT; i++) {
        const pf = steamPuffs[i];
        const ang = pf.ang + cl.age * 0.7 * (i % 2 ? 1 : -1);
        const r = cl.radius * pf.distFrac * (0.35 + 0.65 * expand);
        const sc = pf.scaleBase * (0.45 + 0.65 * expand) * (0.35 + 0.65 * fade);
        pf.mesh.visible = fade > 0.02;
        pf.mesh.position.set(cl.x + Math.cos(ang) * r, pf.baseY + cl.age * 0.12, cl.z + Math.sin(ang) * r * 0.72);
        pf.mesh.scale.set(sc * 1.1, sc * 0.88, sc * 1.1);
        const tier = fade > 0.75 ? 0 : fade > 0.50 ? 1 : fade > 0.25 ? 2 : 3;
        if (pf.mesh.material !== steamMats[tier]) pf.mesh.material = steamMats[tier];
      }
    }

    if (isNearOrUnder) {
      // Gentle breathing glow on cave mushrooms, Celestia crystals, lanterns & turning Culvert Waterwheel!
      const pulseA = 0.88 + 0.18 * Math.sin(localTime * 2.1);
      const pulseB = 0.82 + 0.18 * Math.cos(localTime * 1.7 + 1.1);
      amberShroomMat.emissiveIntensity = pulseA;
      tealShroomMat.emissiveIntensity = pulseB;
      skyCrystalMat.emissiveIntensity = 0.90 + 0.22 * Math.sin(localTime * 2.5 + 0.4);
      amberCrystalMat.emissiveIntensity = 0.82 + 0.20 * Math.cos(localTime * 2.0 + 0.9);
      lanternGlassMat.emissiveIntensity = 1.38 + 0.12 * Math.sin(localTime * 5.3);

      culvertWheelPivot.rotation.x = localTime * 0.95;

      if (ropeBucketObj) {
        ropeBucketObj.rotation.z = Math.sin(localTime * 1.35) * 0.035;
        ropeBucketObj.rotation.x = Math.cos(localTime * 1.05) * 0.025;
      }

      // Subtle idle sway on occupied underground hiding spots
      for (const sp of [ciderTunSpot, culvertCurtainSpot]) {
        const sm = sp.occupiedBy?.userData?.specialMesh;
        if (!sm) continue;
        if (sm.userData.tunPivot) sm.userData.tunPivot.rotation.y = Math.sin(localTime * 1.8) * 0.04;
        if (sm.userData.curtainPivot) sm.userData.curtainPivot.rotation.x = Math.sin(localTime * 2.2) * 0.055;
      }
    }
  }

  return {
    interactSpots,
    triggerMechanism,
    sampleLauncherAt,
    buildCustomSpotDisguise: (inter) => buildUndergroundSpotDisguise(THREE, inter),
    breaksLineOfSight: breaksUndergroundLOS,
    update,
    routeWaypoint,
    surfacePortalsGroup,
    undergroundGroup,
  };
}
