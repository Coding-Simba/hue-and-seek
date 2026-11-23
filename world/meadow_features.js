/* ============================================================================
 * Hue & Seek — Meadowbrook Village Vertical Landmarks, Orchard, Hiding Spots &
 *              Interactive Contraptions (world/meadow_features.js)
 *
 * Adds rich multi-tier verticality, signature countryside disguises, and synced
 * PvP contraptions to Meadowbrook Village while keeping 100% spatial clearance
 * from all existing houses, farm pens, and underground cellar stairwells:
 *   1. Orchard Props: `mb_beehive` (🐝 Painted Beehive) & `mb_apple_basket` (🍎 Apple Basket)
 *   2. Ancient "Elder" Camphor/Oak Treehouse (-25.5, 16.5, Y = 3.80m) + Hollow Trunk Slide
 *   3. Barn Hayloft Lookout Platform (Y = 3.60m), Hay-Bale Steps, Pulley Zipline & Bouncy Hay-Wagon
 *   4. Windmill Sail Breeze Updraft Cone (-20.8, -9.0)
 *   5. South Apple Orchard & Apiary Nook (-3.5, 29.0)
 *   6. 8 Signature Meadowbrook Special Hiding Spots (3 Dive-In Haystacks w/ Fire-Pop,
 *      2 Scarecrow Cross-Posts + 2 Twin Static Scarecrows, Fluttering Clothesline Sheet,
 *      Plaza Well Bucket Hook & Bakery Eave Basket Hook)
 *   7. 3 Synced Village Contraptions: Farm Dinner-Bell Triangle & 2 Baker's Flour-Chute Pull-Cords
 *      with a zero-bloat 28-puff reusable MeshBasicMaterial cloud pool + LOS occlusion.
 *
 * Strict Storybook Art Rule: `metalness: 0` on every MeshStandardMaterial, merged static geometry.
 * ============================================================================ */

import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { kitTex, mergeStatic } from '../hero_cottage.js';

const PI = Math.PI;
const TAU = PI * 2;

export const Y_TREEHOUSE = 3.80;
export const Y_HAYLOFT = 3.60;

const FLOUR_CLOUD_DURATION = 3.8;
const FLOUR_CLOUD_RADIUS = 3.2;
const FLOUR_LOS_RADIUS = 2.6;
const FLOUR_PUFF_COUNT = 28;
const DINNER_BELL_COOLDOWN = 16.0;
const FLOUR_CHUTE_COOLDOWN = 14.0;

// ============================================================================
// 1. New Orchard Props (`FEATURE_PROP_ICONS`, `FEATURE_PROP_DEFS`, `buildFeaturePropBuilders`)
// ============================================================================

export const FEATURE_PROP_ICONS = {
  mb_beehive: '🐝',
  mb_apple_basket: '🍎',
};

export const FEATURE_PROP_DEFS = [
  {
    id: 'mb_beehive',
    label: 'Painted Beehive',
    icon: '🐝',
    radius: 0.42,
    height: 0.86,
    hp: 185,
    _hpScaled: true,
    speed: 1.00,
    zone: 'farm',
    round: false,
  },
  {
    id: 'mb_apple_basket',
    label: 'Apple Basket',
    icon: '🍎',
    radius: 0.38,
    height: 0.62,
    hp: 155,
    _hpScaled: true,
    speed: 1.06,
    zone: 'farm',
    round: true,
  },
];

Object.defineProperties(FEATURE_PROP_DEFS, {
  mb_beehive: { value: FEATURE_PROP_DEFS[0], enumerable: false },
  mb_apple_basket: { value: FEATURE_PROP_DEFS[1], enumerable: false },
});

// Shared cached Storybook materials (`metalness: 0` strictly enforced)
const sharedMatCache = new Map();

function getStdMat(THREE, hex, texName = null, rx = 1, ry = 1, extra = {}) {
  const map = texName ? kitTex(THREE, texName, rx, ry) : null;
  const key = `${hex}|${texName || 'none'}|${rx}|${ry}|${JSON.stringify(extra)}`;
  let m = sharedMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(
      Object.assign(
        {
          color: hex,
          map,
          roughness: 0.92,
          metalness: 0,
        },
        extra,
        { metalness: 0 }
      )
    );
    sharedMatCache.set(key, m);
  }
  return m;
}

function makeSeededRng(seed = 1337) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  const rr = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const jr = (a, b) => a + rr() * (b - a);
  return { rr, jr };
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function rboxMesh(THREE, w, h, d, r, mat, seg = 2) {
  const rad = Math.max(0.002, Math.min(r, w * 0.48, h * 0.48, d * 0.48));
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, rad), mat);
}

function placeMesh(parent, mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function finalizeMergedGroup(THREE, group, paintHex = 0xdcc48e) {
  try {
    mergeStatic(THREE, group);
  } catch (e) {
    console.warn('[meadow_features] mergeStatic warning:', e);
  }
  const fallbackColor = new THREE.Color(paintHex);
  group.traverse((m) => {
    if (m.isMesh) {
      if (m.material && typeof m.material.metalness === 'number') {
        m.material.metalness = 0;
      }
      if (!m.userData.noShadow) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      if (!m.userData.paint) {
        m.userData.paint = (m.material && m.material.color)
          ? m.material.color.clone()
          : fallbackColor.clone();
      }
    }
  });
  return group;
}

function buildPaintedBeehiveProp(THREE) {
  const g = new THREE.Group();
  g.name = 'mb_beehive';

  const creamWood = getStdMat(THREE, 0xfaf0d7, 'plaster', 0.65, 0.65, { roughness: 0.88 });
  const honeyWood = getStdMat(THREE, 0xf3c969, 'wood_light', 0.8, 0.8, { roughness: 0.86 });
  const butterWood = getStdMat(THREE, 0xfff5de, 'plaster', 0.7, 0.7, { roughness: 0.88 });
  const darkTimber = getStdMat(THREE, 0x7b5334, 'wood_planks_dark', 0.7, 0.7, { roughness: 0.92 });
  const warmTimber = getStdMat(THREE, 0xb8844c, 'wood_light', 0.7, 0.7, { roughness: 0.90 });
  const shingleRed = getStdMat(THREE, 0xc96b4b, 'roof_tiles', 0.85, 0.85, { roughness: 0.88 });
  const shingleTrim = getStdMat(THREE, 0xe8d9be, 'wood_light', 0.6, 0.6, { roughness: 0.90 });
  const slotDark = getStdMat(THREE, 0x2b2118, null, 1, 1, { roughness: 0.95 });
  const beeGold = getStdMat(THREE, 0xf4bd33, null, 1, 1, { roughness: 0.65 });
  const wingWhite = getStdMat(THREE, 0xfffdf8, null, 1, 1, { roughness: 0.55 });

  // 4 short sturdy legs + base stand (`y = 0..0.13`)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      placeMesh(g, rboxMesh(THREE, 0.08, 0.11, 0.08, 0.02, darkTimber, 1), sx * 0.21, 0.055, sz * 0.20);
    }
  }
  placeMesh(g, rboxMesh(THREE, 0.56, 0.05, 0.54, 0.018, warmTimber, 2), 0, 0.115, 0);

  // Sloped honey-wood bee landing board on +Z front + dark entrance slot
  placeMesh(g, rboxMesh(THREE, 0.44, 0.032, 0.16, 0.012, warmTimber, 1), 0, 0.12, 0.31, 0.16, 0, 0);
  placeMesh(g, rboxMesh(THREE, 0.15, 0.034, 0.04, 0.01, slotDark, 1), 0, 0.152, 0.255);

  // Tier 1: Bottom brood box (`y = 0.14..0.36`, pastel cream)
  placeMesh(g, rboxMesh(THREE, 0.52, 0.22, 0.50, 0.028, creamWood, 2), 0, 0.25, 0);
  for (const sx of [-1, 1]) {
    placeMesh(g, rboxMesh(THREE, 0.025, 0.045, 0.20, 0.01, warmTimber, 1), sx * 0.265, 0.27, 0);
  }

  // Moulding lip + Tier 2: Honey super (`y = 0.36..0.55`, warm golden honey-ochre)
  placeMesh(g, rboxMesh(THREE, 0.55, 0.028, 0.53, 0.012, warmTimber, 1), 0, 0.365, 0);
  placeMesh(g, rboxMesh(THREE, 0.49, 0.18, 0.47, 0.026, honeyWood, 2), 0, 0.46, 0);
  for (const sx of [-1, 1]) {
    placeMesh(g, rboxMesh(THREE, 0.024, 0.04, 0.18, 0.01, darkTimber, 1), sx * 0.25, 0.47, 0);
  }

  // Moulding lip + Tier 3: Comb super (`y = 0.55..0.69`, buttercream) + round ventilation hole
  placeMesh(g, rboxMesh(THREE, 0.52, 0.026, 0.50, 0.012, warmTimber, 1), 0, 0.555, 0);
  placeMesh(g, rboxMesh(THREE, 0.46, 0.14, 0.44, 0.024, butterWood, 2), 0, 0.63, 0);
  placeMesh(g, new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 12), beeGold), 0, 0.635, 0.22, PI * 0.5, 0, 0);
  placeMesh(g, new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.034, 10), slotDark), 0, 0.635, 0.222, PI * 0.5, 0, 0);

  // Tiny Gabled Shingle Roof (`y = 0.69..0.86`)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-0.26, 0);
  gableShape.lineTo(0.26, 0);
  gableShape.lineTo(0, 0.145);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.46, bevelEnabled: false });
  gableGeo.translate(0, 0, -0.23);
  placeMesh(g, new THREE.Mesh(gableGeo, creamWood), 0, 0.69, 0);

  const slopeLen = 0.345;
  const pitch = Math.atan2(0.155, 0.27);
  for (const sx of [-1, 1]) {
    placeMesh(
      g,
      rboxMesh(THREE, slopeLen, 0.042, 0.56, 0.014, shingleRed, 2),
      sx * 0.145,
      0.768,
      0,
      0,
      0,
      -sx * pitch
    );
    placeMesh(
      g,
      rboxMesh(THREE, slopeLen + 0.02, 0.024, 0.032, 0.008, shingleTrim, 1),
      sx * 0.145,
      0.758,
      0.275,
      0,
      0,
      -sx * pitch
    );
  }
  placeMesh(g, rboxMesh(THREE, 0.075, 0.045, 0.58, 0.018, darkTimber, 1), 0, 0.842, 0);

  // Two cute plump Storybook bees perched by the landing board & roof eave
  for (const [bx, by, bz, ry] of [[0.11, 0.152, 0.31, -0.4], [-0.16, 0.79, 0.20, 0.65]]) {
    const beeBody = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), beeGold);
    beeBody.scale.set(1.0, 0.85, 1.35);
    placeMesh(g, beeBody, bx, by, bz, 0, ry, 0);
    placeMesh(g, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.014, 8), slotDark), bx, by, bz, PI * 0.5, ry, 0);
    for (const wx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), wingWhite);
      wing.scale.set(1.2, 0.35, 0.8);
      placeMesh(g, wing, bx + wx * 0.02, by + 0.022, bz, 0, ry + wx * 0.3, wx * 0.25);
    }
  }

  return finalizeMergedGroup(THREE, g, 0xf3c969);
}

function buildAppleBasketProp(THREE) {
  const g = new THREE.Group();
  g.name = 'mb_apple_basket';

  const wicker = getStdMat(THREE, 0xc9924e, 'burlap', 1.8, 1.4, { roughness: 0.90 });
  const wickerDark = getStdMat(THREE, 0xa87135, 'wood_light', 1.2, 1.2, { roughness: 0.92 });
  const clothCream = getStdMat(THREE, 0xfbf0dc, 'plaster', 0.9, 0.9, { roughness: 0.88 });
  const appleRed = getStdMat(THREE, 0xd83830, null, 1, 1, { roughness: 0.34 });
  const appleBlush = getStdMat(THREE, 0xe85d44, null, 1, 1, { roughness: 0.36 });
  const appleGold = getStdMat(THREE, 0xf2bf48, null, 1, 1, { roughness: 0.38 });
  const leafGreen = getStdMat(THREE, 0x5aa042, 'leaves', 0.8, 0.8, { roughness: 0.80 });
  const stemBrown = getStdMat(THREE, 0x5d3d24, null, 1, 1, { roughness: 0.92 });

  // Sculpted flared wicker basket body (`y = 0..0.38`, `r = 0.23 -> 0.35`)
  const profile = [
    [0.0, 0.0],
    [0.23, 0.0],
    [0.26, 0.06],
    [0.30, 0.17],
    [0.335, 0.29],
    [0.35, 0.37],
    [0.31, 0.38],
    [0.27, 0.28],
    [0.0, 0.27],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  placeMesh(g, new THREE.Mesh(new THREE.LatheGeometry(profile, 18), wicker), 0, 0, 0);

  // Braided wicker horizontal bands + chunky top rim torus
  for (const [ry, rad, tube] of [[0.03, 0.24, 0.018], [0.15, 0.295, 0.016], [0.27, 0.33, 0.016], [0.372, 0.34, 0.028]]) {
    placeMesh(g, new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 7, 20), ry > 0.3 ? wickerDark : wicker), 0, ry, 0, PI * 0.5, 0, 0);
  }

  // Arched bentwood carrying handle (`y = 0.37..0.62`) + side ears
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.33, 0.36, 0),
    new THREE.Vector3(-0.29, 0.53, 0),
    new THREE.Vector3(0, 0.615, 0),
    new THREE.Vector3(0.29, 0.53, 0),
    new THREE.Vector3(0.33, 0.36, 0),
  ]);
  placeMesh(g, new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 18, 0.021, 7, false), wickerDark));
  for (const sx of [-1, 1]) {
    placeMesh(g, new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.012, 6, 10), wickerDark), sx * 0.335, 0.365, 0, 0, PI * 0.5, 0);
  }

  // Soft cream cloth napkin bedding mound inside rim
  const liner = new THREE.Mesh(new THREE.SphereGeometry(0.305, 14, 10), clothCream);
  liner.scale.set(1.0, 0.42, 1.0);
  placeMesh(g, liner, 0, 0.31, 0);

  // Brimming pile of glossy red & golden Storybook apples + crisp green leaf sprigs
  const apples = [
    [0.0, 0.43, 0.0, 0.088, appleRed],
    [-0.14, 0.385, 0.11, 0.082, appleRed],
    [0.15, 0.385, 0.10, 0.084, appleGold],
    [-0.15, 0.38, -0.11, 0.082, appleBlush],
    [0.14, 0.385, -0.12, 0.082, appleRed],
    [0.01, 0.38, 0.19, 0.080, appleBlush],
    [-0.01, 0.38, -0.19, 0.080, appleGold],
    [-0.21, 0.365, -0.01, 0.078, appleRed],
    [0.21, 0.365, 0.0, 0.078, appleBlush],
    [-0.08, 0.445, 0.07, 0.078, appleGold],
    [0.09, 0.445, -0.06, 0.080, appleRed],
    [0.07, 0.44, 0.09, 0.076, appleBlush],
    [-0.07, 0.44, -0.08, 0.076, appleRed],
  ];

  for (let i = 0; i < apples.length; i++) {
    const [ax, ay, az, ar, amat] = apples[i];
    const ap = new THREE.Mesh(new THREE.SphereGeometry(ar, 10, 8), amat);
    ap.scale.set(1.04, 0.92, 1.04);
    placeMesh(g, ap, ax, ay, az, (i % 3) * 0.12 - 0.1, i * 0.9, 0);
    placeMesh(
      g,
      new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.036, 5), stemBrown),
      ax,
      ay + ar * 0.88,
      az,
      0.15,
      i * 1.1,
      0.1
    );
  }

  // 5 fresh green orchard leaf sprigs tucked around the apples
  const leafSpots = [
    [-0.19, 0.41, 0.14, 0.4, 0.5],
    [0.19, 0.41, -0.13, -0.35, 2.2],
    [0.03, 0.495, 0.02, 0.25, 1.1],
    [-0.12, 0.45, -0.14, -0.4, 3.8],
    [0.16, 0.40, 0.16, 0.38, -0.9],
  ];
  for (const [lx, ly, lz, tilt, yaw] of leafSpots) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.048, 7, 5), leafGreen);
    lf.scale.set(1.55, 0.22, 0.72);
    placeMesh(g, lf, lx, ly, lz, tilt, yaw, 0.22);
  }

  return finalizeMergedGroup(THREE, g, 0xd83830);
}

export function buildFeaturePropBuilders(THREE) {
  let beehiveProto = null;
  let appleBasketProto = null;
  return {
    mb_beehive: () => {
      if (!beehiveProto) beehiveProto = buildPaintedBeehiveProp(THREE);
      return beehiveProto.clone();
    },
    mb_apple_basket: () => {
      if (!appleBasketProto) appleBasketProto = buildAppleBasketProp(THREE);
      return appleBasketProto.clone();
    },
  };
}

// ============================================================================
// Shared Scarecrow, Haystack-Crown & Linen-Sheet Disguise Builders
// ============================================================================

function buildScarecrowCrossPost(THREE) {
  const g = new THREE.Group();
  const stakeWood = getStdMat(THREE, 0x8f6239, 'wood_planks_dark', 0.6, 1.4, { roughness: 0.93 });
  const barWood = getStdMat(THREE, 0xa97848, 'wood_light', 1.2, 0.6, { roughness: 0.91 });
  const ropeMat = getStdMat(THREE, 0xdcc296, 'burlap', 1.6, 1.6, { roughness: 0.92 });
  const strawMat = getStdMat(THREE, 0xe8c45e, 'hay', 1.2, 1.2, { roughness: 0.92 });

  // Vertical post (`y = 0..1.68`) + horizontal crossbar (`y = 1.26, w = 1.28`) + diagonal brace
  placeMesh(g, new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.062, 1.68, 8), stakeWood), 0, 0.84, 0, 0.02, 0, -0.015);
  placeMesh(g, rboxMesh(THREE, 1.28, 0.085, 0.075, 0.022, barWood, 1), 0, 1.26, 0.02, 0, 0, 0.03);
  placeMesh(g, rboxMesh(THREE, 0.055, 0.36, 0.055, 0.015, barWood, 1), 0.14, 1.12, 0.01, 0, 0, -0.72);
  placeMesh(g, new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.018, 6, 12), ropeMat), 0, 1.26, 0.01, PI * 0.25, 0.3, 0);

  // Small tuft of straw around the base of the stake
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), strawMat);
    placeMesh(g, tuft, Math.cos(a) * 0.08, 0.10, Math.sin(a) * 0.08, Math.sin(a) * 0.28, a, -Math.cos(a) * 0.28);
  }
  return g;
}

function buildScarecrowCostumeOnly(THREE) {
  const g = new THREE.Group();
  const coatBlue = getStdMat(THREE, 0x4d739c, 'burlap', 1.2, 1.2, { roughness: 0.92 });
  const patchOchre = getStdMat(THREE, 0xd89b48, 'burlap', 1.4, 1.4, { roughness: 0.92 });
  const scarfRed = getStdMat(THREE, 0xc94d3f, 'plaster', 0.8, 0.8, { roughness: 0.88 });
  const burlapHead = getStdMat(THREE, 0xdfc496, 'burlap', 1.3, 1.3, { roughness: 0.92 });
  const strawHat = getStdMat(THREE, 0xe8c35a, 'thatch', 1.3, 1.3, { roughness: 0.90 });
  const strawTuft = getStdMat(THREE, 0xf0d06e, 'hay', 1.2, 1.2, { roughness: 0.90 });
  const buttonDark = getStdMat(THREE, 0x2e231c, null, 1, 1, { roughness: 0.85 });

  // Flared patched Storybook coat torso (`y = 0.58..1.34`)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.31, 0.74, 12), coatBlue);
  torso.scale.set(1.08, 1.0, 0.82);
  placeMesh(g, torso, 0, 0.95, 0.02);

  // Outstretched coat sleeves along the crossbar (`y = 1.25`) + straw cuffs
  for (const sx of [-1, 1]) {
    placeMesh(
      g,
      new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.52, 9), sx > 0 ? coatBlue : patchOchre),
      sx * 0.38,
      1.24,
      0.02,
      0,
      0,
      sx * (PI * 0.5 - 0.06)
    );
    for (let k = -1; k <= 1; k++) {
      placeMesh(
        g,
        new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 5), strawTuft),
        sx * 0.67,
        1.24 + k * 0.03,
        0.02 + k * 0.025,
        k * 0.18,
        0,
        -sx * (PI * 0.5 + k * 0.16)
      );
    }
  }

  // Sewn ochre patches, rope belt & straw skirt fringe
  placeMesh(g, rboxMesh(THREE, 0.14, 0.15, 0.04, 0.012, patchOchre, 1), -0.11, 0.86, 0.22, -0.12, -0.25, 0.14);
  placeMesh(g, rboxMesh(THREE, 0.13, 0.13, 0.04, 0.012, coatBlue, 1), 0.12, 1.02, -0.18, 0.1, 0.3, -0.1);
  placeMesh(g, new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.024, 6, 16), strawHat), 0, 0.92, 0.02, PI * 0.5, 0, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    placeMesh(
      g,
      new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 5), strawTuft),
      Math.cos(a) * 0.24,
      0.54,
      0.02 + Math.sin(a) * 0.19,
      Math.sin(a) * 0.25,
      0,
      -Math.cos(a) * 0.25
    );
  }

  // Cozy red bandana kerchief at neck
  const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.16, 10), scarfRed);
  placeMesh(g, scarf, 0, 1.31, 0.03, PI, 0, 0);

  // Burlap sack head (`y = 1.46`) + button eyes + stitched grin
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 10), burlapHead);
  head.scale.set(1.0, 1.06, 0.95);
  placeMesh(g, head, 0, 1.47, 0.03);
  for (const sx of [-1, 1]) {
    placeMesh(g, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 8), buttonDark), sx * 0.068, 1.49, 0.195, PI * 0.5, 0, 0);
  }
  placeMesh(g, new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.075, 6), patchOchre), 0, 1.45, 0.22, PI * 0.5, 0, 0);
  for (let k = -2; k <= 2; k++) {
    placeMesh(g, rboxMesh(THREE, 0.022, 0.012, 0.015, 0.004, buttonDark, 1), k * 0.032, 1.395 + Math.abs(k) * 0.008, 0.195);
  }

  // Floppy wide-brimmed Storybook straw hat (`y = 1.60..1.88`) with crimson ribbon
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.035, 16), strawHat);
  brim.scale.set(1.04, 1.0, 0.98);
  placeMesh(g, brim, 0, 1.61, 0.02, -0.08, 0, 0.06);
  placeMesh(g, new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.022, 6, 14), scarfRed), 0, 1.64, 0.02, PI * 0.5 - 0.08, 0, 0.06);
  placeMesh(g, new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.28, 12), strawHat), -0.01, 1.76, 0.01, -0.14, 0, 0.11);

  return g;
}

function buildHaystackCrownDisguise(THREE) {
  const root = new THREE.Group();
  root.name = 'disguise_haystack_tuft';

  const strawGold = getStdMat(THREE, 0xf0cc62, 'hay', 1.4, 1.4, { roughness: 0.90 });
  const strawWarm = getStdMat(THREE, 0xe2b649, 'thatch', 1.3, 1.3, { roughness: 0.92 });
  const woodHandle = getStdMat(THREE, 0x9b6b3e, 'wood_light', 0.6, 1.6, { roughness: 0.88 });
  const ropeTie = getStdMat(THREE, 0xc79d63, 'burlap', 1.5, 1.5, { roughness: 0.92 });

  // Crown group (`y ≈ 1.88..2.26`, sits right atop the 2.1m haystack dome; `offsetY = 0.05`)
  const crown = new THREE.Group();
  crown.name = 'straw_crown';
  crown.userData.keep = true;
  crown.position.set(0, 1.86, 0);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 9), strawGold);
  cap.scale.set(1.08, 0.62, 1.08);
  placeMesh(crown, cap, 0, 0.04, 0);
  placeMesh(crown, new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 6, 12), ropeTie), 0, 0.19, 0, PI * 0.5, 0, 0);

  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.28, 6), i % 2 ? strawGold : strawWarm);
    placeMesh(
      crown,
      cone,
      Math.cos(a) * 0.13,
      0.27,
      Math.sin(a) * 0.13,
      Math.sin(a) * 0.42,
      a,
      -Math.cos(a) * 0.42
    );
  }

  // Extra wooden pitchfork handle poking jauntily out of the straw crown
  const forkGrp = new THREE.Group();
  forkGrp.position.set(0.24, -0.14, 0.08);
  forkGrp.rotation.set(0.14, 0.25, -0.42);
  placeMesh(forkGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.030, 0.78, 8), woodHandle), 0, 0.32, 0);
  placeMesh(forkGrp, rboxMesh(THREE, 0.13, 0.032, 0.036, 0.01, woodHandle, 1), 0, 0.71, 0);
  crown.add(forkGrp);

  mergeStatic(THREE, crown);
  crown.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = new THREE.Color(0xebc458);
    }
  });
  root.add(crown);
  root.userData.crownPivot = crown;
  return root;
}

function buildLinenSheetDisguise(THREE) {
  const root = new THREE.Group();
  root.name = 'disguise_linen_sheet';

  const linenWhite = getStdMat(THREE, 0xfdfaf2, 'plaster', 0.9, 0.9, {
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const hemBlue = getStdMat(THREE, 0x9ec2ea, 'plaster', 0.9, 0.9, {
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const pegWood = getStdMat(THREE, 0xdfb982, 'wood_light', 0.6, 0.6, { roughness: 0.88 });

  // Pivot right on the overhead clothesline (`y = 1.82`) so `update()` gently sways it in the wind!
  const pivot = new THREE.Group();
  pivot.name = 'sheet_pivot';
  pivot.userData.keep = true;
  pivot.position.set(0, 1.82, 0);

  const w = 1.18;
  const h = 1.16;
  const sheetGeo = new THREE.PlaneGeometry(w, h, 8, 8);
  const pos = sheetGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const vy = pos.getY(i); // +h/2 at top -> -h/2 at bottom
    const dropFrac = clamp((h * 0.5 - vy) / h, 0, 1);
    const sagTop = -0.045 * (1 - (ux / (w * 0.5)) ** 2) * (1 - dropFrac * 0.65);
    const waveZ = (0.055 * Math.sin(ux * 5.4 + 0.9) + 0.03 * Math.cos(ux * 9.2)) * Math.pow(dropFrac, 0.85) + 0.04 * dropFrac;
    pos.setXYZ(i, ux, vy - h * 0.5 + sagTop, waveZ);
  }
  sheetGeo.computeVertexNormals();
  placeMesh(pivot, new THREE.Mesh(sheetGeo, linenWhite), 0, 0, 0);

  // Subtle woven sky-blue country border stripe near the bottom hem
  const stripeGeo = new THREE.PlaneGeometry(w * 0.98, 0.075, 8, 1);
  const sPos = stripeGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const ux = sPos.getX(i);
    const sy = sPos.getY(i);
    const waveZ = 0.055 * Math.sin(ux * 5.4 + 0.9) + 0.03 * Math.cos(ux * 9.2) + 0.042;
    sPos.setXYZ(i, ux, sy - h + 0.13, waveZ);
  }
  stripeGeo.computeVertexNormals();
  placeMesh(pivot, new THREE.Mesh(stripeGeo, hemBlue), 0, 0, 0.004);

  // Two chunky wooden clothespins gripping the clothesline at the top corners
  for (const sx of [-1, 1]) {
    placeMesh(pivot, rboxMesh(THREE, 0.042, 0.115, 0.048, 0.012, pegWood, 1), sx * 0.48, 0.01, 0, 0, 0, sx * 0.08);
  }

  mergeStatic(THREE, pivot);
  pivot.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = new THREE.Color(0xfdfaf2);
    }
  });
  root.add(pivot);
  root.userData.sheetPivot = pivot;
  return root;
}

export function buildCustomSpotDisguise(THREE, inter) {
  const dtype = inter?.disguiseType || inter?.spotType || '';
  if (dtype === 'haystack_tuft') {
    return buildHaystackCrownDisguise(THREE);
  }
  if (dtype === 'scarecrow') {
    const g = buildScarecrowCostumeOnly(THREE);
    return finalizeMergedGroup(THREE, g, 0xd89b48);
  }
  if (dtype === 'linen_sheet') {
    return buildLinenSheetDisguise(THREE);
  }
  return buildHaystackCrownDisguise(THREE);
}

// ============================================================================
// Module-Level Active State Hooks for `breaksLineOfSight` & `checkFirePopHaystacks`
// ============================================================================

let ACTIVE_HAYSTACK_SPOTS = [];
let ACTIVE_FLOUR_CLOUDS = [];

export function breaksLineOfSight(from, to) {
  if (!from || !to || !ACTIVE_FLOUR_CLOUDS.length) return false;
  const fx = from.x ?? 0;
  const fy = from.y ?? 1.0;
  const fz = from.z ?? 0;
  const dx = (to.x ?? 0) - fx;
  const dy = (to.y ?? 1.0) - fy;
  const dz = (to.z ?? 0) - fz;
  const lenSq = dx * dx + dy * dy + dz * dz;
  const rSq = FLOUR_LOS_RADIUS * FLOUR_LOS_RADIUS;

  for (let i = 0; i < ACTIVE_FLOUR_CLOUDS.length; i++) {
    const c = ACTIVE_FLOUR_CLOUDS[i];
    if (!c || c.age >= c.dur) continue;
    let t = 0;
    if (lenSq > 1e-8) {
      t = clamp(((c.x - fx) * dx + (c.y - fy) * dy + (c.z - fz) * dz) / lenSq, 0, 1);
    }
    const qx = fx + dx * t - c.x;
    const qy = fy + dy * t - c.y;
    const qz = fz + dz * t - c.z;
    if (qx * qx + qy * qy + qz * qz <= rSq) return true;
  }
  return false;
}

export function checkFirePopHaystacks(activePatches, exitSpecialSpotFn, hintFn) {
  if (!activePatches || !activePatches.length || !ACTIVE_HAYSTACK_SPOTS.length) return false;
  if (typeof exitSpecialSpotFn !== 'function') return false;

  let poppedAny = false;
  for (let s = 0; s < ACTIVE_HAYSTACK_SPOTS.length; s++) {
    const spot = ACTIVE_HAYSTACK_SPOTS[s];
    const occ = spot && spot.occupiedBy;
    if (!occ || occ.userData?.actor?.eliminated) continue;

    let caughtFire = false;
    for (let i = 0; i < activePatches.length; i++) {
      const pt = activePatches[i];
      if (!pt) continue;
      const elem = pt.elemId || pt.type || pt.kind;
      if (elem !== 'fire') continue;
      const px = pt.x ?? pt.pos?.x ?? 9999;
      const pz = pt.z ?? pt.pos?.z ?? 9999;
      if (Math.hypot(px - spot.x, pz - spot.z) <= 2.0) {
        caughtFire = true;
        break;
      }
    }

    if (caughtFire) {
      exitSpecialSpotFn(occ, false);
      if (occ.userData) {
        occ.userData.vy = Math.max(occ.userData.vy || 0, 5.8);
        occ.userData.jy = Math.max(occ.userData.jy || 0, 0.14);
      }
      if (typeof hintFn === 'function') {
        hintFn('🔥 Yikes! The haystack caught fire — hopped out!', 2600);
      }
      poppedAny = true;
    }
  }
  return poppedAny;
}

// ============================================================================
// Procedural Web Audio Synths (Dinner-Bell Triangle Chime & Flour-Chute WHOOSH)
// ============================================================================

function playDinnerBellChime(audioApi) {
  try {
    if (!audioApi || (typeof audioApi.isMuted === 'function' && audioApi.isMuted())) return;
    const ac = typeof audioApi.getContext === 'function' ? audioApi.getContext() : null;
    const out = typeof audioApi.getSfxBus === 'function' ? audioApi.getSfxBus() : ac?.destination;
    if (!ac || !out) return;

    const t0 = ac.currentTime + 0.01;
    // 4 crisp metallic farm triangle strikes: DING-DING-DING-DIIING!
    const strikes = [
      { dt: 0.00, dur: 0.52, gain: 0.16 },
      { dt: 0.15, dur: 0.52, gain: 0.14 },
      { dt: 0.30, dur: 0.55, gain: 0.15 },
      { dt: 0.47, dur: 1.05, gain: 0.18 },
    ];
    const partials = [2637, 3951, 5588, 7380];

    for (const st of strikes) {
      const start = t0 + st.dt;
      partials.forEach((freq, idx) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq * (idx === 2 ? 1.004 : 1.0), start);
        const amp = st.gain / (1 + idx * 0.85);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(amp, start + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, start + st.dur / (1 + idx * 0.28));
        osc.connect(g);
        g.connect(out);
        osc.start(start);
        osc.stop(start + st.dur + 0.03);
      });
    }
  } catch (_) {
    // Ignore Web Audio unlock edge cases
  }
}

function playFlourWhooshSynth(audioApi) {
  try {
    if (!audioApi || (typeof audioApi.isMuted === 'function' && audioApi.isMuted())) return;
    const ac = typeof audioApi.getContext === 'function' ? audioApi.getContext() : null;
    const out = typeof audioApi.getSfxBus === 'function' ? audioApi.getSfxBus() : ac?.destination;
    if (!ac || !out) return;

    const t0 = ac.currentTime + 0.01;
    const bufs = typeof audioApi.getBuffers === 'function' ? audioApi.getBuffers() : null;
    let nBuf = bufs?.pink || bufs?.white || null;
    if (!nBuf) {
      const len = Math.floor(ac.sampleRate * 0.65);
      nBuf = ac.createBuffer(1, len, ac.sampleRate);
      const ch = nBuf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    }

    // Soft billowing baker's flour WHOOSH
    const src = ac.createBufferSource();
    src.buffer = nBuf;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(0.95, t0);
    bp.frequency.setValueAtTime(340, t0);
    bp.frequency.exponentialRampToValueAtTime(1350, t0 + 0.14);
    bp.frequency.exponentialRampToValueAtTime(260, t0 + 0.58);

    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.linearRampToValueAtTime(0.24, t0 + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.60);

    src.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    src.start(t0, Math.random() * 0.4);
    src.stop(t0 + 0.64);

    // Wooden chute flapper thump
    const thump = ac.createOscillator();
    const tg = ac.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(155, t0);
    thump.frequency.exponentialRampToValueAtTime(62, t0 + 0.13);
    tg.gain.setValueAtTime(0.18, t0);
    tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    thump.connect(tg);
    tg.connect(out);
    thump.start(t0);
    thump.stop(t0 + 0.16);
  } catch (_) {
    // Ignore Web Audio unlock edge cases
  }
}

function playTurretShotSynth(audioApi) {
  try {
    if (!audioApi || (typeof audioApi.isMuted === 'function' && audioApi.isMuted())) return;
    const ac = typeof audioApi.getContext === 'function' ? audioApi.getContext() : null;
    const out = typeof audioApi.getSfxBus === 'function' ? audioApi.getSfxBus() : ac?.destination;
    if (!ac || !out) return;

    const t0 = ac.currentTime + 0.005;
    // 1. Punchy hydraulic twin-barrel anti-air bark ("THOOM!")
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(225, t0);
    osc.frequency.exponentialRampToValueAtTime(64, t0 + 0.11);
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.linearRampToValueAtTime(0.24, t0 + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.125);
    osc.connect(og);
    og.connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.14);

    // 2. Crisp brass check-valve ping
    const ping = ac.createOscillator();
    const pg = ac.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(1480, t0);
    ping.frequency.exponentialRampToValueAtTime(620, t0 + 0.055);
    pg.gain.setValueAtTime(0.08, t0);
    pg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    ping.connect(pg);
    pg.connect(out);
    ping.start(t0);
    ping.stop(t0 + 0.07);

    // 3. High-velocity pressurized water-jet snap ("PSSSH!")
    const bufs = typeof audioApi.getBuffers === 'function' ? audioApi.getBuffers() : null;
    let nBuf = bufs?.white || bufs?.pink || null;
    if (!nBuf) {
      const len = Math.floor(ac.sampleRate * 0.18);
      nBuf = ac.createBuffer(1, len, ac.sampleRate);
      const ch = nBuf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    }
    const ns = ac.createBufferSource();
    ns.buffer = nBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.4, t0);
    bp.frequency.setValueAtTime(1850, t0);
    bp.frequency.exponentialRampToValueAtTime(760, t0 + 0.11);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.linearRampToValueAtTime(0.16, t0 + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    ns.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    ns.start(t0);
    ns.stop(t0 + 0.135);
  } catch (_) {
    // Ignore Web Audio unlock edge cases
  }
}

// ============================================================================
// 6. Main Builder Export: `buildMeadowFeatures(THREE, env)`
// ============================================================================

// Spatial Layout Constants
const TREE_DECK_BOX = { x0: -28.2, x1: -22.8, z0: 14.2, z1: 19.2 };
const TREE_RAMP_BOX = { x0: -25.5, x1: -22.7, z0: 10.6, z1: 14.25 }; // 2.8m wide, rises +Z 0 -> 3.80m

const HAYLOFT_BOX = { x0: 15.8, x1: 19.6, z0: -14.8, z1: -11.2 };
const HAY_STEPS_BOX = { x0: 13.2, x1: 15.85, z0: -13.8, z1: -11.2 }; // 2.6m wide, rises +X 0 -> 3.60m
const HAY_WAGON = { x: 17.6, z: -9.6, r: 1.55, apronR: 2.02, topY: 1.05 };
const MILL_BREEZE = { x: -20.8, z: -9.0, r: 1.90 };

// Red Barn world transform (`(22, -14), rot = -0.6`) so the Hay-Hoist Platform hugs the exterior wall cleanly
const BARN_X = 22.0;
const BARN_Z = -14.0;
const BARN_ROT = -0.6;
const BARN_COS = Math.cos(BARN_ROT);
const BARN_SIN = Math.sin(BARN_ROT);

function worldToBarnLocal(wx, wz) {
  const dx = wx - BARN_X;
  const dz = wz - BARN_Z;
  return [
    dx * BARN_COS - dz * BARN_SIN,
    dx * BARN_SIN + dz * BARN_COS,
  ];
}

function isInsideBarnEnvelope(wx, wz) {
  const [lx, lz] = worldToBarnLocal(wx, wz);
  // Barn body local envelope is `lx in [-5.05, +2.95], lz in [-4.1, +4.1]`
  return lx > -5.04 && lx < 2.95 && lz > -4.12 && lz < 4.08;
}

export function buildMeadowFeatures(THREE, env = {}) {
  const {
    mapRoot,
    solids = [],
    blockers = [],
    addSpot,
    addVig,
    audio,
    onDinnerBell,
  } = env;

  const { jr } = makeSeededRng(2026);
  const root = new THREE.Group();
  root.name = 'meadow_features_root';
  if (mapRoot) mapRoot.add(root);

  const interactSpots = [];
  const haystackSpots = [];
  const activeClouds = [];
  ACTIVE_HAYSTACK_SPOTS = haystackSpots;
  ACTIVE_FLOUR_CLOUDS = activeClouds;

  let simClockSec = 0;
  let dinnerBellLastAt = -999;
  let bellSwingT = 0;
  let wagonSquash = 0;
  const chuteState = {
    mb_flour_mill: { lastAt: -999, tugT: 0, cordPivot: null },
    mb_flour_bakery: { lastAt: -999, tugT: 0, cordPivot: null },
  };
  const charLaunchCooldown = new WeakMap();

  const registerGroupSolids = (grp, fallbackHex = 0xb88652) => {
    const col = new THREE.Color(fallbackHex);
    grp.traverse((m) => {
      if (!m.isMesh) return;
      if (m.material && typeof m.material.metalness === 'number') m.material.metalness = 0;
      if (!m.userData.noShadow) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      if (!m.userData.paint) {
        m.userData.paint = (m.material && m.material.color) ? m.material.color.clone() : col.clone();
      }
      if (!m.userData.noSolid) {
        solids.push(m);
      }
    });
  };

  const addAabbBlocker = (x0, x1, z0, z1, y0 = -0.45, y1 = 3.4, standable = false) => {
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

  const addCamoSpot = (x, y, z, hex, kind = 'wood') => {
    if (typeof addSpot === 'function') {
      addSpot(new THREE.Vector3(x, y, z), hex, kind);
    }
  };

  // Shared materials for landmarks
  const barkMat = getStdMat(THREE, 0x745339, 'bark', 1.6, 2.2, { roughness: 0.94 });
  const barkDark = getStdMat(THREE, 0x5c3f2a, 'bark', 1.4, 1.8, { roughness: 0.95 });
  const mossMat = getStdMat(THREE, 0x629d44, 'leaves', 1.4, 1.4, { roughness: 0.90 });
  const plankWarm = getStdMat(THREE, 0xc7955c, 'wood_light', 1.4, 1.4, { roughness: 0.90 });
  const plankDark = getStdMat(THREE, 0x91643b, 'wood_planks_dark', 1.2, 1.2, { roughness: 0.92 });
  const railTimber = getStdMat(THREE, 0xa87646, 'wood_light', 0.8, 1.6, { roughness: 0.90 });
  const ropeMat = getStdMat(THREE, 0xe4cda4, 'burlap', 2.0, 2.0, { roughness: 0.92 });
  const ironMat = getStdMat(THREE, 0x3b3530, 'painted_metal', 0.8, 0.8, { roughness: 0.78 });
  const lanternGlow = getStdMat(THREE, 0xffe09c, null, 1, 1, {
    roughness: 0.45,
    emissive: 0xffa434,
    emissiveIntensity: 1.45,
  });
  const hayGold = getStdMat(THREE, 0xf2cf68, 'hay', 1.6, 1.6, { roughness: 0.90 });
  const hayAmber = getStdMat(THREE, 0xe3b84c, 'thatch', 1.5, 1.5, { roughness: 0.92 });
  const hayPale = getStdMat(THREE, 0xf7de8c, 'hay', 1.4, 1.4, { roughness: 0.90 });
  const wagonRed = getStdMat(THREE, 0xc44f42, 'terracotta', 0.9, 0.9, { roughness: 0.88 });
  const stoneLight = getStdMat(THREE, 0xded9ce, 'stone', 1.2, 1.2, { roughness: 0.94 });
  const stoneWarm = getStdMat(THREE, 0xc9c0b0, 'stone', 1.4, 1.4, { roughness: 0.94 });
  const blossomPink = getStdMat(THREE, 0xffbfd0, 'leaves', 1.1, 1.1, { roughness: 0.84 });
  const blossomWhite = getStdMat(THREE, 0xfff3f5, 'plaster', 1.0, 1.0, { roughness: 0.84 });
  const appleBright = getStdMat(THREE, 0xd83830, null, 1, 1, { roughness: 0.34 });
  const foliageMats = [
    getStdMat(THREE, 0x4f8e3b, 'leaves', 1.4, 1.4, { roughness: 0.88 }),
    getStdMat(THREE, 0x62a247, 'leaves', 1.4, 1.4, { roughness: 0.88 }),
    getStdMat(THREE, 0x73b353, 'leaves', 1.4, 1.4, { roughness: 0.88 }),
    getStdMat(THREE, 0x437c34, 'leaves', 1.4, 1.4, { roughness: 0.90 }),
  ];

  // ==========================================================================
  // 2A. Ancient "Elder" Camphor / Oak Treehouse at `(-25.5, 16.5)` (`Y = 3.80m`)
  // ==========================================================================
  {
    const treeGroup = new THREE.Group();
    treeGroup.name = 'elder_treehouse';
    const tx = -25.5;
    const tz = 16.5;

    // 1. Massive gnarled lower camphor trunk (`r ≈ 1.8m`, `y = 0..3.85`)
    const lowerTrunk = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.05, 3.86, 14), barkMat);
    placeMesh(treeGroup, lowerTrunk, tx, 1.93, tz);

    // Sculpted spreading buttress roots (`7` roots, leaving `(-28.8, 20.2)` slide exit wide open!)
    const rootAngles = [-2.65, -1.95, -1.15, -0.35, 0.45, 1.35, 2.92];
    for (let i = 0; i < rootAngles.length; i++) {
      const a = rootAngles[i];
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(tx + Math.cos(a) * 1.15, 1.75, tz + Math.sin(a) * 1.15),
        new THREE.Vector3(tx + Math.cos(a) * 2.15, 0.68, tz + Math.sin(a) * 2.15),
        new THREE.Vector3(tx + Math.cos(a) * 3.15, 0.08, tz + Math.sin(a) * 3.15),
      ]);
      placeMesh(treeGroup, new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.36 - (i % 2) * 0.05, 8, false), i % 2 ? barkMat : barkDark));
      const mossPatch = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mossMat);
      mossPatch.scale.set(1.3, 0.35, 0.9);
      placeMesh(treeGroup, mossPatch, tx + Math.cos(a) * 2.05, 0.82, tz + Math.sin(a) * 2.05, 0, -a, 0);
    }

    // Ground trunk collider (`y = -0.45..3.76` so deck at `y = 3.80` stays 100% open & walkable!)
    addAabbBlocker(tx - 1.72, tx + 1.72, tz - 1.72, tz + 1.72, -0.45, Y_TREEHOUSE - 0.04, false);

    // 2. Timber Treehouse Deck (`x: -28.2..-22.8, z: 14.2..19.2, y = 3.80`)
    const deckW = TREE_DECK_BOX.x1 - TREE_DECK_BOX.x0; // 5.4m
    const deckD = TREE_DECK_BOX.z1 - TREE_DECK_BOX.z0; // 5.0m
    const deckCX = (TREE_DECK_BOX.x0 + TREE_DECK_BOX.x1) * 0.5; // -25.5
    const deckCZ = (TREE_DECK_BOX.z0 + TREE_DECK_BOX.z1) * 0.5; // 16.7

    // Ground-tagged walkable deck slab (`keep: true` so water/fire raycasts preserve `userData.ground`)
    const deckSurface = rboxMesh(THREE, deckW, 0.16, deckD, 0.04, plankWarm, 2);
    deckSurface.userData.ground = true;
    deckSurface.userData.keep = true;
    deckSurface.userData.paint = new THREE.Color(0xc7955c);
    placeMesh(treeGroup, deckSurface, deckCX, Y_TREEHOUSE - 0.08, deckCZ);

    // Decorative plank seams, perimeter rim beams & diagonal knee-braces under deck
    placeMesh(treeGroup, rboxMesh(THREE, deckW + 0.14, 0.22, 0.16, 0.03, plankDark, 1), deckCX, Y_TREEHOUSE - 0.14, TREE_DECK_BOX.z0);
    placeMesh(treeGroup, rboxMesh(THREE, deckW + 0.14, 0.22, 0.16, 0.03, plankDark, 1), deckCX, Y_TREEHOUSE - 0.14, TREE_DECK_BOX.z1);
    placeMesh(treeGroup, rboxMesh(THREE, 0.16, 0.22, deckD + 0.14, 0.03, plankDark, 1), TREE_DECK_BOX.x0, Y_TREEHOUSE - 0.14, deckCZ);
    placeMesh(treeGroup, rboxMesh(THREE, 0.16, 0.22, deckD + 0.14, 0.03, plankDark, 1), TREE_DECK_BOX.x1, Y_TREEHOUSE - 0.14, deckCZ);

    for (const [bx, bz, rx, rz] of [
      [-27.5, 14.8, 0.35, -0.58],
      [-23.5, 14.8, 0.35, 0.58],
      [-27.5, 18.5, -0.35, -0.58],
      [-23.5, 18.5, -0.35, 0.58],
    ]) {
      placeMesh(treeGroup, rboxMesh(THREE, 0.18, 2.25, 0.18, 0.03, plankDark, 1), bx, 2.78, bz, rx, 0, rz);
    }

    // Wooden Railings around outer edges (`y = 3.80..4.82`, open across `x: -25.5..-22.8` at `z = 14.2` for ramp!)
    const addDeckRailing = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(x1 - x0, z1 - z0);
      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;
      placeMesh(treeGroup, rboxMesh(THREE, 0.11, 0.09, len + 0.1, 0.025, railTimber, 1), mx, Y_TREEHOUSE + 0.96, mz, 0, ang, 0);
      placeMesh(treeGroup, rboxMesh(THREE, 0.08, 0.07, len + 0.06, 0.02, plankWarm, 1), mx, Y_TREEHOUSE + 0.52, mz, 0, ang, 0);
      const posts = Math.max(2, Math.round(len / 1.25) + 1);
      for (let i = 0; i < posts; i++) {
        const t = i / (posts - 1);
        placeMesh(
          treeGroup,
          rboxMesh(THREE, 0.13, 1.04, 0.13, 0.03, plankDark, 1),
          x0 + (x1 - x0) * t,
          Y_TREEHOUSE + 0.52,
          z0 + (z1 - z0) * t
        );
      }
    };

    // West, East, NW-North, and South (flanking the hollow trunk slide mouth)
    addDeckRailing(TREE_DECK_BOX.x0, TREE_DECK_BOX.z0, TREE_DECK_BOX.x0, TREE_DECK_BOX.z1);
    addDeckRailing(TREE_DECK_BOX.x1, TREE_DECK_BOX.z0, TREE_DECK_BOX.x1, TREE_DECK_BOX.z1);
    addDeckRailing(TREE_DECK_BOX.x0, TREE_DECK_BOX.z0, -25.55, TREE_DECK_BOX.z0);
    addDeckRailing(TREE_DECK_BOX.x0, TREE_DECK_BOX.z1, -26.35, TREE_DECK_BOX.z1);
    addDeckRailing(-24.65, TREE_DECK_BOX.z1, TREE_DECK_BOX.x1, TREE_DECK_BOX.z1);

    // Upper railing blockers (`y0 = 3.82, y1 = 5.05`, never blocking ground movement below!)
    addAabbBlocker(TREE_DECK_BOX.x0 - 0.16, TREE_DECK_BOX.x0 + 0.14, TREE_DECK_BOX.z0, TREE_DECK_BOX.z1, Y_TREEHOUSE + 0.02, Y_TREEHOUSE + 1.28, false);
    addAabbBlocker(TREE_DECK_BOX.x1 - 0.14, TREE_DECK_BOX.x1 + 0.16, TREE_DECK_BOX.z0, TREE_DECK_BOX.z1, Y_TREEHOUSE + 0.02, Y_TREEHOUSE + 1.28, false);
    addAabbBlocker(TREE_DECK_BOX.x0, -25.52, TREE_DECK_BOX.z0 - 0.15, TREE_DECK_BOX.z0 + 0.15, Y_TREEHOUSE + 0.02, Y_TREEHOUSE + 1.28, false);
    addAabbBlocker(TREE_DECK_BOX.x0, TREE_DECK_BOX.x1, TREE_DECK_BOX.z1 - 0.15, TREE_DECK_BOX.z1 + 0.16, Y_TREEHOUSE + 0.02, Y_TREEHOUSE + 1.28, false);

    // 3. Walkable Wooden Ramp/Stairway (`x: -25.5..-22.7`, `z: 10.6..14.25`, `y: 0 -> 3.80`)
    const rampW = TREE_RAMP_BOX.x1 - TREE_RAMP_BOX.x0; // 2.8m
    const rampCX = (TREE_RAMP_BOX.x0 + TREE_RAMP_BOX.x1) * 0.5; // -24.1
    const rampDZ = TREE_RAMP_BOX.z1 - TREE_RAMP_BOX.z0; // 3.65m
    const rampLen = Math.hypot(rampDZ, Y_TREEHOUSE);
    const rampPitch = -Math.atan2(Y_TREEHOUSE, rampDZ);

    const rampSlopeGround = rboxMesh(THREE, rampW, 0.14, rampLen, 0.03, plankWarm, 1);
    rampSlopeGround.userData.ground = true;
    rampSlopeGround.userData.keep = true;
    rampSlopeGround.userData.paint = new THREE.Color(0xc7955c);
    placeMesh(treeGroup, rampSlopeGround, rampCX, Y_TREEHOUSE * 0.5 - 0.06, (TREE_RAMP_BOX.z0 + TREE_RAMP_BOX.z1) * 0.5, rampPitch, 0, 0);

    // Stringer beams, 14 rustic stepped treads & side handrails along the ramp
    for (const sx of [-1, 1]) {
      const rx = rampCX + sx * (rampW * 0.5 - 0.08);
      placeMesh(treeGroup, rboxMesh(THREE, 0.14, 0.22, rampLen + 0.2, 0.03, plankDark, 1), rx, Y_TREEHOUSE * 0.5 - 0.12, (TREE_RAMP_BOX.z0 + TREE_RAMP_BOX.z1) * 0.5, rampPitch, 0, 0);
      placeMesh(treeGroup, rboxMesh(THREE, 0.09, 0.08, rampLen, 0.02, railTimber, 1), rx, Y_TREEHOUSE * 0.5 + 0.92, (TREE_RAMP_BOX.z0 + TREE_RAMP_BOX.z1) * 0.5, rampPitch, 0, 0);
      for (const f of [0.15, 0.52, 0.88]) {
        const pz = TREE_RAMP_BOX.z0 + rampDZ * f;
        const py = Y_TREEHOUSE * f;
        placeMesh(treeGroup, rboxMesh(THREE, 0.13, py + 0.98, 0.13, 0.025, plankDark, 1), rx, (py + 0.98) * 0.5, pz);
      }
    }
    const treadCount = 14;
    for (let i = 0; i < treadCount; i++) {
      const f = (i + 0.5) / treadCount;
      placeMesh(
        treeGroup,
        rboxMesh(THREE, rampW - 0.16, 0.07, 0.27, 0.02, i % 2 ? plankWarm : railTimber, 1),
        rampCX,
        Y_TREEHOUSE * f,
        TREE_RAMP_BOX.z0 + rampDZ * f
      );
    }
    // Side-guardrail blockers on ramp (`z: 11.35..14.2`) so players don't walk sideways into the steep side or fall off!
    addAabbBlocker(TREE_RAMP_BOX.x0 - 0.16, TREE_RAMP_BOX.x0 + 0.08, 11.35, 14.2, -0.35, Y_TREEHOUSE + 1.05, false);
    addAabbBlocker(TREE_RAMP_BOX.x1 - 0.08, TREE_RAMP_BOX.x1 + 0.16, 11.35, 14.2, -0.35, Y_TREEHOUSE + 1.05, false);

    // 4. Four Mighty Upper Camphor Boughs (`y = 3.80..7.80`) + Layered Elder Canopy (`y = 6.9..12.6m`)
    const boughConfigs = [
      [[-27.8, 3.7, 14.6], [-28.8, 5.6, 13.8], [-27.6, 7.6, 14.8]],
      [[-23.2, 3.7, 14.7], [-22.1, 5.5, 14.1], [-23.4, 7.5, 15.2]],
      [[-27.8, 3.7, 18.8], [-28.9, 5.8, 19.6], [-27.2, 7.8, 18.4]],
      [[-23.2, 3.7, 18.8], [-22.0, 5.7, 19.4], [-23.8, 7.7, 18.2]],
    ];
    for (const pts of boughConfigs) {
      const bCurve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      placeMesh(treeGroup, new THREE.Mesh(new THREE.TubeGeometry(bCurve, 12, 0.36, 8, false), barkMat));
    }

    // Lush pillowy layered Storybook leaf clusters
    const canopyPuffs = [
      [-25.5, 8.9, 16.6, 3.4, 2.2, 3.3, 0],
      [-28.0, 7.8, 15.2, 2.6, 1.8, 2.5, 1],
      [-23.0, 7.7, 15.4, 2.6, 1.8, 2.5, 2],
      [-27.9, 8.0, 18.4, 2.7, 1.9, 2.6, 3],
      [-23.2, 7.9, 18.3, 2.6, 1.8, 2.5, 1],
      [-25.6, 7.6, 13.8, 2.4, 1.6, 2.2, 2],
      [-25.5, 8.1, 19.5, 2.6, 1.7, 2.3, 0],
      [-26.8, 9.8, 16.0, 2.7, 1.9, 2.6, 2],
      [-24.2, 9.7, 17.1, 2.7, 1.9, 2.6, 1],
      [-25.5, 10.9, 16.5, 2.5, 1.8, 2.5, 2],
    ];
    for (const [cx, cy, cz, sx, sy, sz, mi] of canopyPuffs) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 2), foliageMats[mi % foliageMats.length]);
      puff.scale.set(sx, sy, sz);
      placeMesh(treeGroup, puff, cx, cy, cz, jr(-0.15, 0.15), jr(0, 6.2), jr(-0.15, 0.15));
    }

    // Warm Glowing Storybook Treehouse Lantern hanging from NW bough
    const lx = -27.35;
    const ly = 5.45;
    const lz = 14.95;
    placeMesh(treeGroup, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), ropeMat), lx, ly + 0.36, lz);
    placeMesh(treeGroup, rboxMesh(THREE, 0.28, 0.36, 0.28, 0.04, lanternGlow, 1), lx, ly, lz);
    placeMesh(treeGroup, new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 6), ironMat), lx, ly + 0.24, lz);
    placeMesh(treeGroup, rboxMesh(THREE, 0.24, 0.05, 0.24, 0.015, ironMat, 1), lx, ly - 0.20, lz);

    // 5. Hollow Trunk Slide (`mb_tree_slide`: `(-25.5, 3.80, 17.8)` -> `(-28.8, 0.0, 20.2)`)
    // Carved hollow bark entrance portal on South deck edge + sweeping bark chute!
    placeMesh(treeGroup, new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.18, 8, 16, PI), barkDark), -25.5, Y_TREEHOUSE + 0.55, 18.65, 0, 0, 0);
    for (const sx of [-1, 1]) {
      placeMesh(treeGroup, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.62, 8), barkDark), -25.5 + sx * 0.68, Y_TREEHOUSE + 0.28, 18.65);
    }
    const slideCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-25.5, Y_TREEHOUSE + 0.15, 18.65),
      new THREE.Vector3(-26.4, 2.75, 19.65),
      new THREE.Vector3(-27.6, 1.45, 20.25),
      new THREE.Vector3(-28.65, 0.35, 20.20),
    ]);
    const slideTube = new THREE.Mesh(new THREE.TubeGeometry(slideCurve, 20, 0.52, 10, false), barkDark);
    placeMesh(treeGroup, slideTube);
    placeMesh(treeGroup, new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.12, 7, 14), barkMat), -28.68, 0.42, 20.2, 0.2, -1.25, 0);

    finalizeMergedGroup(THREE, treeGroup, 0x745339);
    registerGroupSolids(treeGroup, 0x745339);
    root.add(treeGroup);

    // Register Hollow Trunk Slide interaction (`kind: 'ride_path'`)
    interactSpots.push({
      id: 'mb_tree_slide',
      kind: 'ride_path',
      icon: '🛝',
      label: 'Whoosh Down Hollow Trunk Slide!',
      x: -25.5,
      groundY: Y_TREEHOUSE,
      y: Y_TREEHOUSE,
      z: 17.8,
      interactRadius: 2.35,
      fromX: -25.5,
      fromY: Y_TREEHOUSE,
      fromZ: 17.8,
      toX: -28.8,
      toY: 0.0,
      toZ: 20.2,
      dur: 1.35,
      arcY: -0.28,
      enterHint: '🛝 Wheee! Whooshing down the hollow Camphor trunk slide!',
    });

    // Camo spots + Prop vignette right on the Timber Treehouse Deck!
    addCamoSpot(-27.2, Y_TREEHOUSE, 16.5, 0xc7955c, 'wood');
    addCamoSpot(-24.8, Y_TREEHOUSE, 15.8, 0xc7955c, 'wood');
    addCamoSpot(-24.2, 0, 19.8, 0x745339, 'trunk');
    if (typeof addVig === 'function') {
      addVig(
        'treehouse_deck',
        { x: -26.8, y: Y_TREEHOUSE, z: 16.4, rot: 0.25, b: null },
        [
          ['mb_apple_basket', -0.55, -1.15, 0.2],
          ['stool', 0.45, -1.05, -0.3],
          ['crate', -0.65, 0.85, 0.15],
          ['bucket', 0.35, 0.95, 0.5],
        ],
        1
      );
    }
  }

  // ==========================================================================
  // 2B. Barn Hayloft Lookout Platform (`Y = 3.60m`), Hay-Bale Steps, Pulley Zipline & Bouncy Hay-Wagon
  // ==========================================================================
  let hayWagonMoundPivot = null;
  {
    const hayloftGroup = new THREE.Group();
    hayloftGroup.name = 'barn_hayloft_lookout';

    // 1. Rustic Timber Hay-Hoist Platform (`x: 15.8..19.6, z: -14.8..-11.2, y = 3.60`)
    // Clipped cleanly outside the Barn's rotated exterior walls so zero geometry enters the Barn interior!
    // Front lookout wing (`x: 15.8..19.4, z: -12.35..-11.2`) + NW corner wing (`x: 15.8..17.35, z: -14.8..-12.35`)
    const deckFront = rboxMesh(THREE, 3.6, 0.16, 1.25, 0.035, plankWarm, 1);
    deckFront.userData.ground = true;
    deckFront.userData.keep = true;
    deckFront.userData.paint = new THREE.Color(0xc7955c);
    placeMesh(hayloftGroup, deckFront, 17.6, Y_HAYLOFT - 0.08, -11.78);

    const deckSide = rboxMesh(THREE, 1.58, 0.16, 2.50, 0.035, plankWarm, 1);
    deckSide.userData.ground = true;
    deckSide.userData.keep = true;
    deckSide.userData.paint = new THREE.Color(0xc7955c);
    placeMesh(hayloftGroup, deckSide, 16.58, Y_HAYLOFT - 0.08, -13.55);

    // Rim beams & 3 exterior timber support posts (100% clear of Barn doorway `(18.39, -10.59)`!)
    placeMesh(hayloftGroup, rboxMesh(THREE, 3.68, 0.22, 0.15, 0.03, plankDark, 1), 17.6, Y_HAYLOFT - 0.14, -11.20);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.15, 0.22, 3.64, 0.03, plankDark, 1), 15.82, Y_HAYLOFT - 0.14, -13.0);
    placeMesh(hayloftGroup, rboxMesh(THREE, 1.62, 0.22, 0.15, 0.03, plankDark, 1), 16.58, Y_HAYLOFT - 0.14, -14.78);

    for (const [px, pz] of [[15.92, -14.65], [15.92, -11.32], [17.42, -11.32]]) {
      placeMesh(hayloftGroup, rboxMesh(THREE, 0.18, Y_HAYLOFT, 0.18, 0.03, plankDark, 1), px, Y_HAYLOFT * 0.5, pz);
      addAabbBlocker(px - 0.14, px + 0.14, pz - 0.14, pz + 0.14, -0.45, Y_HAYLOFT - 0.05, false);
    }
    // Cantilever knee-brace under SE balcony end (high above ground at `y = 2.45..3.52` so doorway stays wide open!)
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.15, 1.35, 0.15, 0.025, plankDark, 1), 19.15, 2.95, -11.55, -0.52, 0, -0.35);

    // Upper railings on North edge (`z = -14.8`), East Balcony tip (`x = 19.4`), and Barn-wall guard at `y = 3.62..4.75`
    placeMesh(hayloftGroup, rboxMesh(THREE, 1.62, 0.09, 0.10, 0.02, railTimber, 1), 16.58, Y_HAYLOFT + 0.92, -14.78);
    placeMesh(hayloftGroup, rboxMesh(THREE, 1.62, 0.07, 0.08, 0.02, plankWarm, 1), 16.58, Y_HAYLOFT + 0.48, -14.78);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.12, 1.0, 0.12, 0.02, plankDark, 1), 15.86, Y_HAYLOFT + 0.50, -14.76);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.12, 1.0, 0.12, 0.02, plankDark, 1), 17.32, Y_HAYLOFT + 0.50, -14.76);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.10, 0.09, 1.25, 0.02, railTimber, 1), 19.38, Y_HAYLOFT + 0.92, -11.78);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.12, 1.0, 0.12, 0.02, plankDark, 1), 19.38, Y_HAYLOFT + 0.50, -11.24);

    // Upper-only railing colliders (`y0 = 3.62`, leaving West `x = 15.8` open for Bale Steps & South `z = -11.2` open for Wagon/Zipline!)
    addAabbBlocker(15.75, 17.48, -14.92, -14.66, Y_HAYLOFT + 0.02, Y_HAYLOFT + 1.25, false);
    addAabbBlocker(19.32, 19.65, -12.48, -11.12, Y_HAYLOFT + 0.02, Y_HAYLOFT + 1.25, false);
    // Prevent walking from the `3.60m` platform straight into the solid upper Barn gable (`x: 17.45..19.6, z: -14.8..-12.45`)
    addAabbBlocker(17.42, 19.65, -14.85, -12.42, Y_HAYLOFT + 0.02, Y_HAYLOFT + 1.65, false);

    // 2. Walkable Stacked Hay-Bale Steps (`x: 13.2..15.85, z: -13.8..-11.2, y: 0 -> 3.60`)
    const stepsCount = 6;
    const stepsW = HAY_STEPS_BOX.z1 - HAY_STEPS_BOX.z0; // 2.6m
    const stepsCZ = (HAY_STEPS_BOX.z0 + HAY_STEPS_BOX.z1) * 0.5; // -12.5
    const stepsDX = HAY_STEPS_BOX.x1 - HAY_STEPS_BOX.x0; // 2.65m

    // Continuous sloped ground ramp core so water/fire splashes land cleanly on the hay-bale steps
    const baleRampLen = Math.hypot(stepsDX, Y_HAYLOFT);
    const baleRampAngle = Math.atan2(Y_HAYLOFT, stepsDX);
    const baleSlopeMesh = rboxMesh(THREE, baleRampLen, 0.14, stepsW - 0.08, 0.03, hayGold, 1);
    baleSlopeMesh.userData.ground = true;
    baleSlopeMesh.userData.keep = true;
    baleSlopeMesh.userData.paint = new THREE.Color(0xf2cf68);
    placeMesh(hayloftGroup, baleSlopeMesh, (HAY_STEPS_BOX.x0 + HAY_STEPS_BOX.x1) * 0.5, Y_HAYLOFT * 0.5 - 0.06, stepsCZ, 0, 0, baleRampAngle);

    for (let i = 0; i < stepsCount; i++) {
      const f1 = (i + 1) / stepsCount;
      const sx = HAY_STEPS_BOX.x0 + stepsDX * ((i + 0.5) / stepsCount);
      const topY = Y_HAYLOFT * f1;
      const stepD = stepsDX / stepsCount + 0.08;
      // Stacked golden hay-bale column + rustic wooden stepping board on top
      placeMesh(
        hayloftGroup,
        rboxMesh(THREE, stepD, topY, stepsW, 0.09, i % 2 ? hayGold : hayAmber, 2),
        sx,
        topY * 0.5,
        stepsCZ
      );
      placeMesh(
        hayloftGroup,
        rboxMesh(THREE, stepD * 0.86, 0.055, stepsW - 0.24, 0.018, plankWarm, 1),
        sx,
        topY + 0.01,
        stepsCZ
      );
      // Twine bindings on outer sides
      for (const sz of [-1, 1]) {
        placeMesh(hayloftGroup, rboxMesh(THREE, 0.03, topY + 0.02, 0.03, 0.008, plankDark, 1), sx, topY * 0.5, stepsCZ + sz * (stepsW * 0.5 - 0.01));
      }
    }
    // Side-wall blockers along `z = -13.85` & `z = -11.15` (`x: 13.75..15.8`) so ground walkers don't clip sideways into tall bales
    addAabbBlocker(13.75, 15.82, HAY_STEPS_BOX.z0 - 0.14, HAY_STEPS_BOX.z0 + 0.06, -0.35, Y_HAYLOFT + 0.85, false);
    addAabbBlocker(13.75, 15.82, HAY_STEPS_BOX.z1 - 0.06, HAY_STEPS_BOX.z1 + 0.14, -0.35, Y_HAYLOFT + 0.85, false);

    // 3. Pulley Rope Zipline (`mb_barn_zipline`: `(16.4, 3.60, -11.4)` -> `(7.8, 0.0, -5.8)`)
    // Upper pulley hoist gantry on Hay-Hoist Platform + lower plaza timber post + visible sagging hemp cable!
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.17, 2.05, 0.17, 0.03, plankDark, 1), 16.25, Y_HAYLOFT + 1.02, -11.32);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.14, 0.14, 0.92, 0.025, railTimber, 1), 16.36, Y_HAYLOFT + 1.96, -11.12, 0, -0.58, 0);
    placeMesh(hayloftGroup, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 14), ironMat), 16.42, Y_HAYLOFT + 1.82, -11.35, 0, 0, PI * 0.5);
    // Hanging wooden zipline handle bar at takeoff
    placeMesh(hayloftGroup, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 6), ropeMat), 16.22, Y_HAYLOFT + 1.56, -11.22);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.34, 0.055, 0.055, 0.018, plankWarm, 1), 16.22, Y_HAYLOFT + 1.38, -11.22, 0, -0.58, 0);

    // Lower anchor post just offset at `(8.32, 0, -5.22)` so `(7.8, 0, -5.8)` touchdown pad is 100% open!
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.17, 2.48, 0.17, 0.03, plankDark, 1), 8.32, 1.24, -5.22);
    placeMesh(hayloftGroup, rboxMesh(THREE, 0.12, 0.72, 0.12, 0.02, railTimber, 1), 8.58, 0.32, -5.38, 0, -0.58, 0.55);
    placeMesh(hayloftGroup, new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.024, 6, 12), ironMat), 8.26, 2.28, -5.28);

    const zipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(16.42, Y_HAYLOFT + 1.80, -11.35),
      new THREE.Vector3(12.35, 3.42, -8.35),
      new THREE.Vector3(8.26, 2.28, -5.28),
    ]);
    placeMesh(hayloftGroup, new THREE.Mesh(new THREE.TubeGeometry(zipCurve, 24, 0.022, 6, false), ropeMat));

    // 4. Bouncy Hay-Wagon parked at `(17.6, -9.6)` (`y = 0..1.05`)
    const wagonGrp = new THREE.Group();
    wagonGrp.position.set(HAY_WAGON.x, 0, HAY_WAGON.z);
    wagonGrp.rotation.y = -0.52;

    // 4 spoked wooden farm wheels + axles + red timber cart bed
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wx = sx * 0.92;
        const wz = sz * 0.78;
        const wy = sz > 0 ? 0.34 : 0.40;
        placeMesh(wagonGrp, new THREE.Mesh(new THREE.TorusGeometry(wy - 0.04, 0.045, 7, 16), plankDark), wx, wy, wz, 0, PI * 0.5, 0);
        placeMesh(wagonGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), ironMat), wx, wy, wz, 0, 0, PI * 0.5);
        for (let sp = 0; sp < 4; sp++) {
          placeMesh(wagonGrp, rboxMesh(THREE, 0.035, (wy - 0.05) * 1.9, 0.035, 0.008, railTimber, 1), wx, wy, wz, (sp * PI) / 4, 0, 0);
        }
      }
    }
    placeMesh(wagonGrp, rboxMesh(THREE, 1.82, 0.14, 2.28, 0.03, plankDark, 1), 0, 0.44, 0);
    for (const sx of [-1, 1]) {
      placeMesh(wagonGrp, rboxMesh(THREE, 0.09, 0.36, 2.26, 0.02, wagonRed, 1), sx * 0.86, 0.66, 0, 0, 0, -sx * 0.14);
    }
    for (const sz of [-1, 1]) {
      placeMesh(wagonGrp, rboxMesh(THREE, 1.72, 0.32, 0.09, 0.02, wagonRed, 1), 0, 0.64, sz * 1.10);
    }
    // Wagon drawbar tongue + spilled golden straw apron around wheels so walking right up feels natural
    placeMesh(wagonGrp, rboxMesh(THREE, 0.09, 0.08, 1.05, 0.02, plankDark, 1), 0, 0.30, 1.55, 0.24, 0, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const apron = new THREE.Mesh(new THREE.SphereGeometry(0.46, 9, 7), i % 2 ? hayGold : hayPale);
      apron.scale.set(1.25, 0.34, 1.05);
      placeMesh(wagonGrp, apron, Math.cos(a) * 1.12, 0.12, Math.sin(a) * 1.18, 0, a, 0);
    }
    hayloftGroup.add(wagonGrp);

    finalizeMergedGroup(THREE, hayloftGroup, 0xc7955c);
    registerGroupSolids(hayloftGroup, 0xc7955c);
    root.add(hayloftGroup);

    // Animated bouncy overflowing golden straw mound atop the Hay-Wagon (`y = 0.52..1.08`)
    hayWagonMoundPivot = new THREE.Group();
    hayWagonMoundPivot.name = 'hay_wagon_bounce_mound';
    hayWagonMoundPivot.userData.keep = true;
    hayWagonMoundPivot.position.set(HAY_WAGON.x, 0.52, HAY_WAGON.z);
    hayWagonMoundPivot.rotation.y = -0.52;

    const mainMound = new THREE.Mesh(new THREE.SphereGeometry(1.06, 14, 10), hayGold);
    mainMound.scale.set(0.95, 0.52, 1.14);
    placeMesh(hayWagonMoundPivot, mainMound, 0, 0.14, 0);
    for (const [mx, my, mz, sx, sy, sz, mat] of [
      [-0.36, 0.24, 0.28, 0.62, 0.36, 0.65, hayPale],
      [0.38, 0.22, -0.24, 0.64, 0.38, 0.68, hayAmber],
      [0.02, 0.34, -0.02, 0.68, 0.34, 0.78, hayGold],
    ]) {
      const sub = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 8), mat);
      sub.scale.set(sx, sy, sz);
      placeMesh(hayWagonMoundPivot, sub, mx, my, mz);
    }
    mergeStatic(THREE, hayWagonMoundPivot);
    registerGroupSolids(hayWagonMoundPivot, 0xf2cf68);
    root.add(hayWagonMoundPivot);

    // Register Pulley Rope Zipline (`kind: 'ride_path'`, `id: 'mb_barn_zipline'`)
    interactSpots.push({
      id: 'mb_barn_zipline',
      kind: 'ride_path',
      icon: '🪢',
      label: 'Ride Barn Pulley Zipline!',
      x: 16.4,
      groundY: Y_HAYLOFT,
      y: Y_HAYLOFT,
      z: -11.4,
      interactRadius: 2.35,
      fromX: 16.4,
      fromY: Y_HAYLOFT,
      fromZ: -11.4,
      toX: 7.8,
      toY: 0.0,
      toZ: -5.8,
      dur: 1.65,
      arcY: -0.35,
      enterHint: '🪢 Ziplining from the Barn Hay-Hoist down to the Plaza Market Stalls!',
    });

    addCamoSpot(15.85, Y_HAYLOFT, -12.15, 0xc7955c, 'wood');
    if (typeof addVig === 'function') {
      addVig(
        'hayloft_lookout',
        { x: 16.55, y: Y_HAYLOFT, z: -13.65, rot: BARN_ROT, b: null },
        [
          ['hay_bale', -0.25, -0.45, 0.1],
          ['bucket', 0.42, -0.35, 0.4],
          ['mb_apple_basket', 0.35, 0.45, -0.2],
        ],
        1
      );
    }
  }

  // ==========================================================================
  // 2C. Windmill Sail Breeze Visual Swirl at `(-20.8, -9.0)` (`r < 1.9m`)
  // ==========================================================================
  const breezeSwirlGrp = new THREE.Group();
  breezeSwirlGrp.name = 'windmill_breeze_swirl';
  breezeSwirlGrp.userData.keep = true;
  breezeSwirlGrp.position.set(MILL_BREEZE.x, 0.06, MILL_BREEZE.z);
  {
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0xf4fbff,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 3; i++) {
      const a0 = (i / 3) * TAU;
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const f = k / 12;
        const ang = a0 + f * 3.6;
        const rad = 1.45 - f * 0.45;
        pts.push(new THREE.Vector3(Math.cos(ang) * rad, 0.12 + f * 1.65, Math.sin(ang) * rad));
      }
      const rib = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.032 * (1 - i * 0.12), 5, false),
        ribbonMat
      );
      rib.castShadow = false;
      rib.receiveShadow = false;
      rib.userData.noSolid = true;
      rib.userData.noShadow = true;
      breezeSwirlGrp.add(rib);
    }
    root.add(breezeSwirlGrp);
  }

  // ==========================================================================
  // 3. South Apple Orchard & Apiary Nook (`center = (-3.5, 29.0)`)
  // ==========================================================================
  {
    const orchardGrp = new THREE.Group();
    orchardGrp.name = 'south_apple_orchard';

    const buildAppleTree = (ox, oz, sc = 1.0, seedOff = 0) => {
      const tg = new THREE.Group();
      tg.position.set(ox, 0, oz);
      tg.scale.setScalar(sc);

      // Gnarled warm orchard trunk + 3 spreading limbs
      placeMesh(tg, new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 2.25, 10), barkMat), 0, 1.12, 0, 0.04, seedOff, -0.03);
      for (let b = 0; b < 3; b++) {
        const a = seedOff + (b / 3) * TAU;
        const limb = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 1.85, 0),
          new THREE.Vector3(Math.cos(a) * 0.85, 2.55, Math.sin(a) * 0.85),
          new THREE.Vector3(Math.cos(a) * 1.45, 3.05, Math.sin(a) * 1.45),
        ]);
        placeMesh(tg, new THREE.Mesh(new THREE.TubeGeometry(limb, 8, 0.14, 6, false), barkDark));
      }

      // Layered Storybook canopy puffs
      const puffs = [
        [0, 3.55, 0, 1.65, 1.25, 1.65, 1],
        [-1.15, 3.05, 0.45, 1.22, 0.95, 1.18, 0],
        [1.18, 3.10, 0.35, 1.20, 0.94, 1.15, 2],
        [0.15, 3.12, -1.12, 1.22, 0.95, 1.18, 3],
        [-0.35, 3.18, 1.10, 1.15, 0.90, 1.12, 1],
        [0, 4.32, 0.05, 1.18, 0.92, 1.18, 2],
      ];
      for (const [px, py, pz, sx, sy, sz, mi] of puffs) {
        const pf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 2), foliageMats[mi]);
        pf.scale.set(sx, sy, sz);
        placeMesh(tg, pf, px, py, pz);
      }

      // Pink & white spring blossom clusters + hanging glossy red apples
      for (let k = 0; k < 14; k++) {
        const a = seedOff + (k / 14) * TAU;
        const rad = 1.35 + (k % 3) * 0.28;
        const by = 2.85 + (k % 4) * 0.34;
        const bl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), k % 2 ? blossomPink : blossomWhite);
        bl.scale.set(1.2, 0.78, 1.2);
        placeMesh(tg, bl, Math.cos(a) * rad, by, Math.sin(a) * rad, 0, a, 0);
      }
      for (let k = 0; k < 10; k++) {
        const a = seedOff + 0.32 + (k / 10) * TAU;
        const rad = 1.22 + (k % 2) * 0.35;
        const ay = 2.38 + (k % 3) * 0.28;
        placeMesh(tg, new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 7), appleBright), Math.cos(a) * rad, ay, Math.sin(a) * rad);
      }

      orchardGrp.add(tg);
      addAabbBlocker(ox - 0.42 * sc, ox + 0.42 * sc, oz - 0.42 * sc, oz + 0.42 * sc, -0.45, 3.2, false);
      addCamoSpot(ox + 0.85, 0, oz - 0.65, 0x745339, 'trunk');
    };

    buildAppleTree(-5.6, 30.8, 1.08, 0.4);
    buildAppleTree(-3.2, 31.7, 1.16, 1.9);
    buildAppleTree(-0.9, 30.5, 1.04, 3.5);

    // Low dry-stone orchard border curving behind the apiary nook (`y = 0..0.52`, `standable: true` so players can vault over!)
    for (let i = 0; i < 16; i++) {
      const f = i / 15;
      const ang = 0.35 + f * 1.15;
      const sx = -3.4 + Math.cos(ang) * 3.85 - 0.6;
      const sz = 29.5 + Math.sin(ang) * 3.05;
      const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), i % 2 ? stoneLight : stoneWarm);
      st.scale.set(1.25, 0.82 + (i % 3) * 0.12, 0.95);
      placeMesh(orchardGrp, st, sx, 0.22, sz, 0, ang, 0);
      if (i % 3 === 1) {
        const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), stoneLight);
        cap.scale.set(1.15, 0.65, 0.9);
        placeMesh(orchardGrp, cap, sx, 0.46, sz, 0.1, ang + 0.4, 0);
      }
    }
    addAabbBlocker(-4.8, -1.5, 32.1, 32.8, -0.25, 0.56, true);

    // Fallen pink blossom petals scattered softly under the orchard trees (`noSolid: true`)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const r = 0.8 + (i % 5) * 0.68;
      const petal = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 6), i % 2 ? blossomPink : blossomWhite);
      petal.userData.noSolid = true;
      petal.userData.noShadow = true;
      placeMesh(orchardGrp, petal, -3.4 + Math.cos(a) * r, 0.025, 29.8 + Math.sin(a) * r * 0.7, 0, a, 0);
      petal.castShadow = false;
    }

    finalizeMergedGroup(THREE, orchardGrp, 0x62a247);
    registerGroupSolids(orchardGrp, 0x62a247);
    root.add(orchardGrp);

    // Outdoor Prop Vignette `orchard_apiary` at `(-3.5, 29.0)` with `mb_beehive`, `mb_apple_basket`, `veg_basket`, `bucket`
    const orchRot = Math.atan2(3.5, -29.0);
    if (typeof addVig === 'function') {
      addVig(
        'orchard_apiary',
        { x: -3.5, y: 0, z: 29.0, rot: orchRot, b: null },
        [
          ['mb_beehive', -1.25, -0.35, 0.05],
          ['mb_beehive', 0.0, -0.42, 0.0],
          ['mb_beehive', 1.25, -0.35, -0.06],
          ['mb_apple_basket', -0.85, 0.85, 0.3],
          ['mb_apple_basket', 0.15, 0.92, -0.2],
          ['mb_apple_basket', 1.05, 0.82, 0.45],
          ['veg_basket', -1.65, 0.72, 0.25],
          ['bucket', 1.72, 0.55, -0.35],
        ],
        2
      );
    }
  }

  // ==========================================================================
  // 4. Signature Meadowbrook Hiding Spots (`8` Special Spots in `interactSpots`)
  // ==========================================================================
  {
    const spotsStaticGrp = new THREE.Group();
    spotsStaticGrp.name = 'meadow_special_spots_static';

    // 4A. 3 Giant Dive-In Golden Haystacks (`height = 2.1m` dome + leaning wooden pitchfork)
    const haystackDefs = [
      { id: 'mb_haystack_1', x: 24.5, z: -2.2, exitX: 24.5, exitZ: -0.55, rot: -0.4 },
      { id: 'mb_haystack_2', x: -6.2, z: 27.8, exitX: -6.2, exitZ: 26.15, rot: 0.35 },
      { id: 'mb_haystack_3', x: -26.2, z: -6.5, exitX: -24.55, exitZ: -6.5, rot: 1.15 },
    ];

    for (const hs of haystackDefs) {
      const hg = new THREE.Group();
      hg.position.set(hs.x, 0, hs.z);
      hg.rotation.y = hs.rot;

      // Tiered 2.1m-tall sculpted golden Storybook haystack dome
      const baseTier = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.08, 0.92, 16), hayGold);
      placeMesh(hg, baseTier, 0, 0.46, 0);

      const midBell = new THREE.Mesh(new THREE.SphereGeometry(1.02, 16, 12), hayAmber);
      midBell.scale.set(1.0, 0.92, 1.0);
      placeMesh(hg, midBell, 0, 1.04, 0);

      const topCone = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.78, 14), hayGold);
      placeMesh(hg, topCone, 0, 1.72, 0);

      // Spilled golden straw skirt tufts around the base
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const skirt = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), k % 2 ? hayPale : hayGold);
        skirt.scale.set(1.25, 0.42, 0.95);
        placeMesh(hg, skirt, Math.cos(a) * 0.95, 0.13, Math.sin(a) * 0.95, 0, a, 0);
      }

      // Leaning wooden 3-tine pitchfork resting against the haystack side
      const fork = new THREE.Group();
      fork.position.set(-0.92, 0, 0.24);
      fork.rotation.set(0.06, 0.2, -0.34);
      placeMesh(fork, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 1.78, 8), plankWarm), 0, 0.96, 0);
      placeMesh(fork, rboxMesh(THREE, 0.28, 0.038, 0.038, 0.01, ironMat, 1), 0, 0.24, 0);
      for (const tx of [-0.11, 0, 0.11]) {
        placeMesh(fork, new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.28, 6), ironMat), tx, 0.11, 0, PI, 0, 0);
      }
      hg.add(fork);
      spotsStaticGrp.add(hg);

      // Compact center blocker (`r = 0.72m` keeps Haystack #1 `z0 = -2.92` 100% clear of East Stairs `z = -3.0`!)
      addAabbBlocker(hs.x - 0.72, hs.x + 0.72, hs.z - 0.72, hs.z + 0.72, -0.35, 2.08, false);
      addCamoSpot(hs.exitX, 0, hs.exitZ, 0xf2cf68, 'straw');

      const spotObj = {
        id: hs.id,
        kind: 'custom_spot',
        disguiseType: 'haystack_tuft',
        spotType: 'haystack_tuft',
        icon: '🌾',
        label: 'Dive Into Golden Haystack',
        leaveLabel: 'Hop Out of Haystack',
        disguiseLabel: 'Rustling Haystack 🌾',
        enterHint: '🌾 Hidden inside the Golden Haystack! Watch out for Fire Blasters! (WASD or G to hop out)',
        exitHint: '🌾 Hopped out of the golden haystack!',
        x: hs.x,
        groundY: 0,
        y: 0,
        z: hs.z,
        offsetY: 0.05,
        rot: hs.rot,
        triggerX: hs.exitX,
        triggerY: 0,
        triggerZ: hs.exitZ,
        exitX: hs.exitX,
        exitY: 0,
        exitZ: hs.exitZ,
        interactRadius: 2.75,
        height: 1.35,
        radius: 0.55,
        hp: 105,
      };
      interactSpots.push(spotObj);
      haystackSpots.push(spotObj);
    }

    // 4B. 2 Real Static Storybook Scarecrows + 2 Nearby Empty Wooden Cross-Posts!
    const realScarecrows = [
      { x: -10.1, z: 5.2, rot: Math.atan2(10.1, -5.2) }, // Right beside Pumpkin Garden
      { x: -5.8, z: 29.4, rot: Math.atan2(5.8, -29.4) }, // Right across South Apple Orchard
    ];
    for (const sc of realScarecrows) {
      const fullSc = new THREE.Group();
      fullSc.position.set(sc.x, 0, sc.z);
      fullSc.rotation.y = sc.rot;
      fullSc.add(buildScarecrowCrossPost(THREE));
      fullSc.add(buildScarecrowCostumeOnly(THREE));
      spotsStaticGrp.add(fullSc);
      addAabbBlocker(sc.x - 0.28, sc.x + 0.28, sc.z - 0.28, sc.z + 0.28, -0.35, 1.88, false);
    }

    const emptyScarecrowPosts = [
      { id: 'mb_scarecrow_1', x: -11.2, z: 6.8, rot: Math.atan2(11.2, -6.8), label: 'Pose as Pumpkin-Patch Scarecrow' },
      { id: 'mb_scarecrow_2', x: -0.8, z: 28.2, rot: Math.atan2(0.8, -28.2), label: 'Pose as Orchard Scarecrow' },
    ];
    for (const ep of emptyScarecrowPosts) {
      const postGrp = buildScarecrowCrossPost(THREE);
      postGrp.position.set(ep.x, 0, ep.z);
      postGrp.rotation.y = ep.rot;
      spotsStaticGrp.add(postGrp);

      interactSpots.push({
        id: ep.id,
        kind: 'custom_spot',
        disguiseType: 'scarecrow',
        spotType: 'scarecrow',
        icon: '🎃',
        label: ep.label,
        leaveLabel: 'Step Off Scarecrow Post',
        disguiseLabel: 'Straw Scarecrow 🎃',
        enterHint: '🎃 Posing motionless on the wooden cross-post as a Straw Scarecrow! (WASD or G to hop off)',
        exitHint: '🎃 Stepped off the scarecrow cross-post!',
        x: ep.x,
        groundY: 0,
        y: 0,
        z: ep.z,
        offsetY: 0,
        rot: ep.rot,
        interactRadius: 2.55,
        height: 1.75,
        radius: 0.44,
        hp: 100,
      });
    }

    // 4C. Fluttering Clothesline Sheet Spot at `(-8.7, 22.1)` along Laundry Line `(-10.0, 22.5)`
    {
      const lineYaw = Math.atan2(10.0, -22.5); // Matches `facingCenter(-10, 22.5)` = 2.7234 rad
      const lineExt = new THREE.Group();
      lineExt.position.set(-8.7, 0, 22.1);
      lineExt.rotation.y = lineYaw;

      // Side timber laundry post + taut rope span + waiting wooden clothespins over `(-8.7, 1.82, 22.1)`
      placeMesh(lineExt, rboxMesh(THREE, 0.12, 2.08, 0.12, 0.035, plankWarm, 1), -0.88, 1.04, 0);
      placeMesh(lineExt, rboxMesh(THREE, 0.42, 0.08, 0.08, 0.02, plankWarm, 1), -0.88, 1.98, 0);
      const ropeSpan = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.88, 1.94, 0),
        new THREE.Vector3(0.0, 1.82, 0),
        new THREE.Vector3(0.95, 1.90, 0.12),
      ]);
      placeMesh(lineExt, new THREE.Mesh(new THREE.TubeGeometry(ropeSpan, 14, 0.014, 5, false), ropeMat));
      spotsStaticGrp.add(lineExt);

      interactSpots.push({
        id: 'mb_linen_sheet',
        kind: 'custom_spot',
        disguiseType: 'linen_sheet',
        spotType: 'linen_sheet',
        icon: '🧺',
        label: 'Clip Onto Laundry Line',
        leaveLabel: 'Unclip From Laundry Line',
        disguiseLabel: 'Laundry Sheet 🧺',
        enterHint: '🧺 Clipped onto the village clothesline as a fluttering white linen sheet! (WASD or G to drop)',
        exitHint: '🧺 Unclipped from the laundry line!',
        x: -8.7,
        groundY: 0,
        y: 0,
        z: 22.1,
        offsetY: 0,
        rot: lineYaw,
        interactRadius: 2.55,
        height: 1.55,
        radius: 0.40,
        hp: 95,
      });
    }

    // 4D. 2 Overhead Hang Hooks (`kind: 'hook'`)
    // Hook 1: Plaza Wishing-Well Beam Hook at `(0.45, 1.5, hangY: 1.45, propId: 'bucket')`
    {
      const wellBracket = new THREE.Group();
      wellBracket.position.set(0.45, 0, 1.5);
      placeMesh(wellBracket, rboxMesh(THREE, 0.65, 0.09, 0.09, 0.02, plankDark, 1), 0.28, 2.38, 0);
      placeMesh(wellBracket, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), ropeMat), 0, 2.28, 0);
      placeMesh(wellBracket, new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 6, 12, PI * 1.45), ironMat), 0, 2.15, 0, 0, PI * 0.5, 2.2);
      spotsStaticGrp.add(wellBracket);

      interactSpots.push({
        id: 'mb_well_hook',
        kind: 'hook',
        icon: '🪣',
        label: 'Hang on Well Beam Hook',
        leaveLabel: 'Drop From Well Hook',
        disguiseLabel: 'Hanging Well Bucket 🪣',
        enterHint: '🪣 Hanging off the ground from the Wishing-Well beam! (WASD or G to drop)',
        exitHint: '🪣 Dropped down from the Wishing-Well beam!',
        propId: 'bucket',
        x: 0.45,
        groundY: 0,
        y: 0,
        z: 1.5,
        hangY: 1.45,
        rot: 0.4,
        triggerX: -0.25,
        triggerY: 0,
        triggerZ: 1.5,
        exitX: -0.28,
        exitY: 0,
        exitZ: 1.5,
        interactRadius: 2.65,
      });
    }

    // Hook 2: Bakery Eave Sign Hook at `(15.4, -2.8, hangY: 1.65, propId: 'bread_basket')`
    {
      const bakeryBracket = new THREE.Group();
      bakeryBracket.position.set(15.4, 0, -2.8);
      bakeryBracket.rotation.y = Math.atan2(18.7, -3.4) + PI;
      placeMesh(bakeryBracket, rboxMesh(THREE, 0.07, 0.07, 0.72, 0.018, ironMat, 1), 0, 2.38, -0.25);
      placeMesh(bakeryBracket, new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 6, 14), plankWarm), 0, 2.52, -0.15, 0, PI * 0.5, 0);
      placeMesh(bakeryBracket, new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 6, 12, PI * 1.45), ironMat), 0, 2.26, 0, 0, 0, 2.2);
      spotsStaticGrp.add(bakeryBracket);

      interactSpots.push({
        id: 'mb_bakery_hook',
        kind: 'hook',
        icon: '🥖',
        label: 'Hang on Bakery Eave Hook',
        leaveLabel: 'Drop From Bakery Hook',
        disguiseLabel: 'Hanging Bakery Basket 🥖',
        enterHint: '🥖 Hanging from the Bakery porch sign hook as a Bread Basket! (WASD or G to drop)',
        exitHint: '🥖 Dropped down onto the Bakery porch!',
        propId: 'bread_basket',
        x: 15.4,
        groundY: 0,
        y: 0,
        z: -2.8,
        hangY: 1.65,
        rot: 1.4,
        triggerX: 14.35,
        triggerY: 0,
        triggerZ: -2.65,
        exitX: 14.25,
        exitY: 0,
        exitZ: -2.65,
        interactRadius: 2.75,
      });
    }

    finalizeMergedGroup(THREE, spotsStaticGrp, 0xe3b84c);
    registerGroupSolids(spotsStaticGrp, 0xe3b84c);
    root.add(spotsStaticGrp);
  }

  // ==========================================================================
  // 5. Interactive Village Contraptions (`kind: 'mechanism'`, Synced in PvP!)
  // ==========================================================================

  // 5A. 🔔 Farm Dinner-Bell Triangle (`id: 'mb_dinner_bell'` at `(18.2, -10.6)`)
  // Post placed slightly left at `(17.52, -10.98)` with gallows arm reaching `(18.16, 2.24, -10.62)` so Barn doorway stays 100% open!
  const dinnerBellPivot = new THREE.Group();
  dinnerBellPivot.name = 'dinner_bell_triangle_pivot';
  dinnerBellPivot.userData.keep = true;
  {
    const bellPostGrp = new THREE.Group();
    bellPostGrp.name = 'dinner_bell_post';
    placeMesh(bellPostGrp, rboxMesh(THREE, 0.14, 2.38, 0.14, 0.03, plankDark, 1), 17.52, 1.19, -10.98);
    placeMesh(bellPostGrp, rboxMesh(THREE, 0.88, 0.11, 0.11, 0.025, railTimber, 1), 17.86, 2.28, -10.79, 0, -0.52, 0);
    placeMesh(bellPostGrp, rboxMesh(THREE, 0.09, 0.46, 0.09, 0.02, plankWarm, 1), 17.68, 2.08, -10.89, 0, -0.52, -0.68);
    finalizeMergedGroup(THREE, bellPostGrp, 0x91643b);
    registerGroupSolids(bellPostGrp, 0x91643b);
    root.add(bellPostGrp);

    dinnerBellPivot.position.set(18.14, 2.24, -10.62);
    placeMesh(dinnerBellPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), ropeMat), 0, -0.09, 0);
    // Forged iron triangle (3 bars) + striker rod + pull cord
    placeMesh(dinnerBellPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.48, 8), ironMat), -0.12, -0.36, 0, 0, 0, -0.50);
    placeMesh(dinnerBellPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.48, 8), ironMat), 0.12, -0.36, 0, 0, 0, 0.50);
    placeMesh(dinnerBellPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.48, 8), ironMat), 0.02, -0.57, 0, 0, 0, PI * 0.5);
    placeMesh(dinnerBellPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 7), ironMat), 0.18, -0.40, 0.05, 0.15, 0, 0.28);
    placeMesh(dinnerBellPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.52, 5), ropeMat), -0.18, -0.72, 0);
    placeMesh(dinnerBellPivot, new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), wagonRed), -0.18, -0.98, 0);
    mergeStatic(THREE, dinnerBellPivot);
    registerGroupSolids(dinnerBellPivot, 0x3b3530);
    root.add(dinnerBellPivot);

    interactSpots.push({
      id: 'mb_dinner_bell',
      kind: 'mechanism',
      mechType: 'dinner_bell',
      icon: '🔔',
      label: 'Ring Farm Dinner Bell!',
      x: 18.2,
      groundY: 0,
      y: 0,
      z: -10.6,
      interactRadius: 2.65,
    });
  }

  // 5B. 💨 2 Flour-Chute Cloud Pull-Cords (`mb_flour_mill` at `(-20.6, -8.8)` & `mb_flour_bakery` at `(15.2, -4.1)`)
  {
    const chutesStaticGrp = new THREE.Group();
    chutesStaticGrp.name = 'flour_chutes_static';
    const sackWhite = getStdMat(THREE, 0xf7efe0, 'burlap', 1.2, 1.2, { roughness: 0.90 });

    const flourChuteConfigs = [
      {
        id: 'mb_flour_mill',
        label: 'Pull Windmill Flour Chute!',
        x: -20.6,
        z: -8.8,
        rot: Math.atan2(2.9, 1.7), // Faces outward from Windmill `(-23.5, -10.5)`
      },
      {
        id: 'mb_flour_bakery',
        label: 'Pull Bakery Flour Chute!',
        x: 15.2,
        z: -4.1,
        rot: Math.atan2(-3.5, -0.7), // Faces outward from Bakery `(18.7, -3.4)`
      },
    ];

    for (const fc of flourChuteConfigs) {
      // Overhead wooden flour hopper chute at `y = 2.32` (zero ground obstacle!)
      const cg = new THREE.Group();
      cg.position.set(fc.x, 2.28, fc.z);
      cg.rotation.y = fc.rot;
      placeMesh(cg, rboxMesh(THREE, 0.46, 0.36, 0.85, 0.03, plankWarm, 1), 0, 0.16, -0.32, 0.42, 0, 0);
      placeMesh(cg, rboxMesh(THREE, 0.52, 0.08, 0.52, 0.02, plankDark, 1), 0, 0.02, -0.05, 0.42, 0, 0);
      placeMesh(cg, new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 12), sackWhite), 0, -0.04, -0.02, PI * 0.5 + 0.42, 0, 0);
      chutesStaticGrp.add(cg);

      // Animated dangling pull-cord + painted red wooden toggle handle (`y = 1.32..2.22`)
      const cordPivot = new THREE.Group();
      cordPivot.name = `cord_${fc.id}`;
      cordPivot.userData.keep = true;
      cordPivot.position.set(fc.x, 2.22, fc.z);
      placeMesh(cordPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.78, 6), ropeMat), 0, -0.39, 0);
      placeMesh(cordPivot, rboxMesh(THREE, 0.14, 0.055, 0.055, 0.018, wagonRed, 1), 0, -0.80, 0);
      mergeStatic(THREE, cordPivot);
      registerGroupSolids(cordPivot, 0xc44f42);
      root.add(cordPivot);
      chuteState[fc.id].cordPivot = cordPivot;

      interactSpots.push({
        id: fc.id,
        kind: 'mechanism',
        mechType: 'flour_chute',
        icon: '💨',
        label: fc.label,
        x: fc.x,
        groundY: 0,
        y: 0,
        z: fc.z,
        interactRadius: 2.65,
      });
    }

    finalizeMergedGroup(THREE, chutesStaticGrp, 0xc7955c);
    registerGroupSolids(chutesStaticGrp, 0xc7955c);
    root.add(chutesStaticGrp);
  }

  // Reusable Pool of 28 Soft White `MeshBasicMaterial` Sphere Puffs (`depthWrite: false`, zero runtime allocations!)
  const flourCloudContainer = new THREE.Group();
  flourCloudContainer.name = 'bakers_flour_cloud_pool';
  flourCloudContainer.userData.keep = true;
  root.add(flourCloudContainer);

  const sharedPuffGeo = new THREE.SphereGeometry(0.62, 10, 8);
  const puffOpacityTiers = [0.68, 0.54, 0.40, 0.24].map(
    (op) =>
      new THREE.MeshBasicMaterial({
        color: 0xfffdf7,
        transparent: true,
        opacity: op,
        depthWrite: false,
      })
  );

  const flourPuffs = [];
  for (let i = 0; i < FLOUR_PUFF_COUNT; i++) {
    const mesh = new THREE.Mesh(sharedPuffGeo, puffOpacityTiers[0]);
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 5;
    mesh.userData.noSolid = true;
    mesh.userData.noShadow = true;
    mesh.userData.keep = true;
    flourCloudContainer.add(mesh);

    const ang = (i / FLOUR_PUFF_COUNT) * TAU + (i % 5) * 0.41;
    const distFrac = 0.18 + ((i * 7) % 13) / 13 * 0.80;
    flourPuffs.push({
      mesh,
      ang,
      distFrac,
      baseY: 0.42 + ((i * 5) % 9) / 9 * 1.65,
      wobbleSpd: 1.3 + (i % 6) * 0.32,
      phase: i * 0.77,
      scaleBase: 0.85 + (i % 4) * 0.24,
    });
  }

  // ==========================================================================
  // 8. Town Square Seated Anti-Air Sky-Turret (`mb_sky_turret`) at `(-0.6, -1.6)`
  // ==========================================================================
  const TURRET_X = -0.6;
  const TURRET_Z = -1.6;
  const turretTeal = getStdMat(THREE, 0x3b848c, 'painted_metal', 1.0, 1.0, { roughness: 0.66 });
  const turretCopper = getStdMat(THREE, 0xc87a43, 'painted_metal', 1.0, 1.0, { roughness: 0.58 });
  const turretBrass = getStdMat(THREE, 0xdeb24c, 'painted_metal', 0.8, 0.8, { roughness: 0.52 });
  const turretLeather = getStdMat(THREE, 0x7b4228, 'burlap', 1.2, 1.2, { roughness: 0.82 });
  const turretDial = getStdMat(THREE, 0xfaf5e6, 'plaster', 0.6, 0.6, { roughness: 0.50 });

  // 8A. Static Cobbled Plinth & Azimuth Gear Ring (`y = 0..0.16m`)
  {
    const plinthGrp = new THREE.Group();
    plinthGrp.name = 'sky_turret_plinth';
    plinthGrp.position.set(TURRET_X, 0, TURRET_Z);

    placeMesh(plinthGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 0.12, 16), stoneWarm), 0, 0.06, 0);
    placeMesh(plinthGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.84, 0.05, 16), plankDark), 0, 0.135, 0);
    placeMesh(plinthGrp, new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.032, 8, 20), ironMat), 0, 0.155, 0, PI * 0.5, 0, 0);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      placeMesh(
        plinthGrp,
        rboxMesh(THREE, 0.065, 0.038, 0.085, 0.01, turretBrass, 1),
        Math.sin(a) * 0.76,
        0.16,
        Math.cos(a) * 0.76,
        0,
        a,
        0
      );
    }

    finalizeMergedGroup(THREE, plinthGrp, 0xc9c0b0);
    registerGroupSolids(plinthGrp, 0xc9c0b0);
    root.add(plinthGrp);

    // Compact center collider so players walk cleanly up to the seat without clipping through the carriage
    addAabbBlocker(TURRET_X - 0.68, TURRET_X + 0.68, TURRET_Z - 0.68, TURRET_Z + 0.68, -0.25, 0.96, true);
  }

  // 8B. 360° Swiveling Gunner Carriage (`turretYawPivot`, local `-Z` = aim forward!)
  const turretYawPivot = new THREE.Group();
  turretYawPivot.name = 'sky_turret_yaw';
  turretYawPivot.userData.keep = true;
  turretYawPivot.position.set(TURRET_X, 0.16, TURRET_Z);
  root.add(turretYawPivot);

  {
    const carriageStatic = new THREE.Group();
    carriageStatic.name = 'sky_turret_carriage';

    // Turntable oak & copper deck
    placeMesh(carriageStatic, new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.75, 0.07, 16), plankWarm), 0, 0.035, 0);
    placeMesh(carriageStatic, new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 6, 18), turretCopper), 0, 0.055, 0, PI * 0.5, 0, 0);

    // Tufted chestnut-leather gunner bucket chair (`z = +0.24`, facing `-Z`)
    placeMesh(carriageStatic, rboxMesh(THREE, 0.48, 0.10, 0.44, 0.035, turretLeather, 2), 0, 0.22, 0.24);
    placeMesh(carriageStatic, rboxMesh(THREE, 0.46, 0.46, 0.10, 0.035, turretLeather, 2), 0, 0.47, 0.44, -0.14, 0, 0);
    placeMesh(carriageStatic, rboxMesh(THREE, 0.52, 0.14, 0.46, 0.02, plankDark, 1), 0, 0.13, 0.25);
    for (const sx of [-1, 1]) {
      // Armrests + footrest pedals
      placeMesh(carriageStatic, rboxMesh(THREE, 0.075, 0.065, 0.38, 0.02, plankDark, 1), sx * 0.26, 0.36, 0.22);
      placeMesh(carriageStatic, rboxMesh(THREE, 0.05, 0.16, 0.05, 0.012, ironMat, 1), sx * 0.26, 0.26, 0.08);
      placeMesh(carriageStatic, rboxMesh(THREE, 0.15, 0.035, 0.18, 0.01, ironMat, 1), sx * 0.20, 0.09, -0.24, 0.22, 0, 0);

      // Twin Pressurized Teal & Copper Water-Air Tanks on flanks (`x = ±0.48`)
      placeMesh(carriageStatic, new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.56, 12), turretTeal), sx * 0.48, 0.39, 0.12);
      placeMesh(carriageStatic, new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 8), turretCopper), sx * 0.48, 0.67, 0.12);
      placeMesh(carriageStatic, new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.020, 6, 12), turretBrass), sx * 0.48, 0.50, 0.12, PI * 0.5, 0, 0);
      placeMesh(carriageStatic, new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.020, 6, 12), turretBrass), sx * 0.48, 0.28, 0.12, PI * 0.5, 0, 0);
      // Copper feed pipe into trunnion manifold
      placeMesh(carriageStatic, new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.36, 8), turretCopper), sx * 0.38, 0.58, -0.02, 0.72, 0, sx * 0.35);

      // Sturdy oak & wrought-iron trunnion A-frame uprights (`x = ±0.30, z = -0.16, y -> 0.80`)
      placeMesh(carriageStatic, rboxMesh(THREE, 0.095, 0.76, 0.14, 0.02, plankDark, 1), sx * 0.30, 0.44, -0.16, 0.06, 0, 0);
      placeMesh(carriageStatic, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), turretBrass), sx * 0.30, 0.78, -0.16, 0, 0, PI * 0.5);
    }

    // Azimuth brass handwheel on left flank + pressure gauge dial on right
    placeMesh(carriageStatic, new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 14), turretBrass), -0.37, 0.46, -0.02, 0, PI * 0.5, 0);
    placeMesh(carriageStatic, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), turretDial), 0.37, 0.62, -0.04, 0.45, -0.3, 0);

    finalizeMergedGroup(THREE, carriageStatic, 0x3b848c);
    registerGroupSolids(carriageStatic, 0x3b848c);
    turretYawPivot.add(carriageStatic);
  }

  // 8C. Elevating Twin-Cannon Cradle (`turretPitchPivot` at `(0, 0.78, -0.16)`, tilts `-0.32 .. +1.48 rad` / `+85°`!)
  const turretPitchPivot = new THREE.Group();
  turretPitchPivot.name = 'sky_turret_pitch';
  turretPitchPivot.userData.keep = true;
  turretPitchPivot.position.set(0, 0.78, -0.16);
  turretYawPivot.add(turretPitchPivot);

  {
    const cradleStatic = new THREE.Group();
    cradleStatic.name = 'sky_turret_cradle';

    // Cross-trunnion axle + teal breech housing
    placeMesh(cradleStatic, new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.66, 10), ironMat), 0, 0, 0, 0, 0, PI * 0.5);
    placeMesh(cradleStatic, rboxMesh(THREE, 0.52, 0.18, 0.38, 0.035, turretTeal, 2), 0, 0.01, -0.06);
    placeMesh(cradleStatic, rboxMesh(THREE, 0.42, 0.08, 0.22, 0.02, turretCopper, 1), 0, 0.11, -0.08);

    // Brass Anti-Air Spider-Web Ring Sight (`(0, 0.23, -0.66)` — framed right in gunner's 1st-person view!)
    placeMesh(cradleStatic, rboxMesh(THREE, 0.035, 0.14, 0.035, 0.008, turretBrass, 1), 0, 0.14, -0.66);
    placeMesh(cradleStatic, new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.010, 6, 18), turretBrass), 0, 0.25, -0.66);
    placeMesh(cradleStatic, new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.007, 6, 14), turretBrass), 0, 0.25, -0.66);
    placeMesh(cradleStatic, rboxMesh(THREE, 0.20, 0.007, 0.007, 0.002, ironMat, 1), 0, 0.25, -0.66);
    placeMesh(cradleStatic, rboxMesh(THREE, 0.007, 0.20, 0.007, 0.002, ironMat, 1), 0, 0.25, -0.66);

    finalizeMergedGroup(THREE, cradleStatic, 0x3b848c);
    cradleStatic.traverse((m) => { if (m.isMesh) m.userData.noSolid = true; });
    registerGroupSolids(cradleStatic, 0x3b848c);
    turretPitchPivot.add(cradleStatic);
  }

  // Twin Alternating Recoiling Anti-Air Barrels (`barrelL` at `-0.20`, `barrelR` at `+0.20`, extending to `z = -1.58`)
  const buildTurretBarrel = (sideSign) => {
    const bg = new THREE.Group();
    bg.name = sideSign < 0 ? 'sky_turret_barrel_L' : 'sky_turret_barrel_R';
    bg.userData.keep = true;
    bg.position.set(sideSign * 0.20, 0.02, 0);

    // Teal water-jacket sleeve (`z = +0.08 .. -0.62`)
    placeMesh(bg, new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.70, 10), turretTeal), 0, 0, -0.27, PI * 0.5, 0, 0);
    // Brass recoil collar rings
    placeMesh(bg, new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.016, 6, 12), turretBrass), 0, 0, -0.56, 0, 0, 0);
    placeMesh(bg, new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.014, 6, 12), turretBrass), 0, 0, -0.12, 0, 0, 0);
    // Long polished copper anti-air tube (`z = -0.58 .. -1.50`)
    placeMesh(bg, new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.056, 0.96, 10), turretCopper), 0, 0, -1.04, PI * 0.5, 0, 0);
    // Flared brass bell-muzzle nozzle (`z = -1.54`)
    placeMesh(bg, new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.046, 0.13, 12), turretBrass), 0, 0, -1.53, -PI * 0.5, 0, 0);
    placeMesh(bg, new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.05, 10), ironMat), 0, 0, -1.58, PI * 0.5, 0, 0);

    finalizeMergedGroup(THREE, bg, 0xc87a43);
    bg.traverse((m) => { if (m.isMesh) m.userData.noSolid = true; });
    registerGroupSolids(bg, 0xc87a43);
    turretPitchPivot.add(bg);
    return bg;
  };
  const turretBarrelL = buildTurretBarrel(-1);
  const turretBarrelR = buildTurretBarrel(1);

  const turretSpot = {
    id: 'mb_sky_turret',
    kind: 'turret',
    icon: '🎯',
    label: 'Sit in Sky-Turret!',
    leaveLabel: 'Hop Off Turret',
    x: TURRET_X,
    groundY: 0,
    y: 0,
    z: TURRET_Z,
    interactRadius: 2.85,
    occupiedBy: null,
  };
  interactSpots.push(turretSpot);

  let turretOccupant = null;
  let turretYaw = 0.35;
  let turretPitch = 0.42; // Parked pointing jauntily skyward so players immediately read its anti-air purpose!
  let turretRecoilL = 0;
  let turretRecoilR = 0;
  let turretNextBarrel = 0;
  turretYawPivot.rotation.y = turretYaw;
  turretPitchPivot.rotation.x = turretPitch;

  const _turretTmpV = new THREE.Vector3();
  const turretApi = {
    spot: turretSpot,
    x: TURRET_X,
    z: TURRET_Z,
    mount(ch) {
      if (!ch) return false;
      turretOccupant = ch;
      turretSpot.occupiedBy = ch;
      return true;
    },
    dismount(ch) {
      if (!ch || turretOccupant === ch) {
        turretOccupant = null;
        turretSpot.occupiedBy = null;
      }
    },
    getOccupant() {
      if (turretOccupant && turretOccupant.userData?.actor?.eliminated) {
        turretOccupant = null;
        turretSpot.occupiedBy = null;
      }
      return turretOccupant;
    },
    setAim(yaw, pitch) {
      turretYaw = yaw || 0;
      turretPitch = clamp(pitch || 0, -0.32, 1.48);
      turretYawPivot.rotation.y = turretYaw;
      turretPitchPivot.rotation.x = turretPitch;
      turretYawPivot.updateMatrixWorld(true);
    },
    getFirstPersonCameraPos() {
      turretYawPivot.updateMatrixWorld(true);
      _turretTmpV.set(0, 0.29, 0.36);
      turretPitchPivot.localToWorld(_turretTmpV);
      if (_turretTmpV.y < 0.96) _turretTmpV.y = 0.96;
      return _turretTmpV.clone();
    },
    getMuzzleWorld() {
      turretYawPivot.updateMatrixWorld(true);
      const useRight = turretNextBarrel === 1;
      turretNextBarrel = useRight ? 0 : 1;
      if (useRight) turretRecoilR = 1.0;
      else turretRecoilL = 1.0;
      _turretTmpV.set(useRight ? 0.20 : -0.20, 0.02, -1.62);
      turretPitchPivot.localToWorld(_turretTmpV);
      return _turretTmpV.clone();
    },
    triggerRecoil() {
      if (turretNextBarrel === 0) turretRecoilR = 1.0;
      else turretRecoilL = 1.0;
    },
    playShotSound() {
      playTurretShotSynth(audio);
    },
  };

  // ==========================================================================
  // 9. Continuous 360° Physical Map Perimeter (`meadow_perimeter_ring`)
  //    Replaces open-grass invisible walls with tangible Storybook stone
  //    walls, mossy granite boulders, flowering hawthorn hedgerows, and dense
  //    woodland border trees right along `r = 38.05 .. 41.6m`!
  // ==========================================================================
  {
    const perimeterGrp = new THREE.Group();
    perimeterGrp.name = 'meadow_perimeter_ring';

    const boulderGrey = getStdMat(THREE, 0x939086, 'stone', 1.5, 1.5, { roughness: 0.95 });
    const boulderMoss = getStdMat(THREE, 0x6f8b52, 'leaves', 1.6, 1.6, { roughness: 0.92 });
    const hedgeDark = getStdMat(THREE, 0x3e7530, 'leaves', 1.8, 1.8, { roughness: 0.90 });
    const hedgeMid = getStdMat(THREE, 0x528f3d, 'leaves', 1.8, 1.8, { roughness: 0.88 });
    const blossomGold = getStdMat(THREE, 0xffe07d, 'plaster', 1.0, 1.0, { roughness: 0.84 });

    const SEGS = 72;
    const R_INNER = 38.32;
    const placePerim = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.userData.noShadow = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      perimeterGrp.add(mesh);
      return mesh;
    };

    // Shared geometries across the 72 perimeter segments (merged into 1 static batch per material!)
    const wallBodyGeo = new RoundedBoxGeometry(3.75, 1.32, 0.92, 2, 0.14);
    const wallCapGeo = new RoundedBoxGeometry(3.82, 0.24, 1.04, 2, 0.09);
    const wallPostGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.56, 7);
    const hedgeBodyGeo = new RoundedBoxGeometry(3.85, 1.52, 1.28, 2, 0.34);
    const hedgeCrownGeo = new THREE.SphereGeometry(0.88, 8, 6);
    const boulderGeoA = new THREE.DodecahedronGeometry(1.38, 1);
    const boulderGeoB = new THREE.DodecahedronGeometry(1.05, 0);
    const blossomGeo = new THREE.SphereGeometry(0.18, 6, 5);
    const trunkOakGeo = new THREE.CylinderGeometry(0.32, 0.48, 3.8, 7);
    const canopySphereGeo = new THREE.DodecahedronGeometry(2.15, 1);
    const pineConeLowGeo = new THREE.ConeGeometry(2.05, 3.4, 7);
    const pineConeMidGeo = new THREE.ConeGeometry(1.62, 2.9, 7);
    const pineConeTopGeo = new THREE.ConeGeometry(1.12, 2.3, 7);

    for (let i = 0; i < SEGS; i++) {
      const ang = (i / SEGS) * TAU;
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const rSeg = R_INNER + Math.sin(i * 1.7) * 0.16;
      const sx = sinA * rSeg;
      const sz = cosA * rSeg;
      const tangentYaw = ang; // local Z faces radially outward, local X runs tangentially along the perimeter!

      // Natural countryside rhythm around the valley:
      // - Mossy river-cliff boulder outcrops near the NE stream sector & rugged corners
      // - Dry-stone farm walls along the Barn / Windmill / Pasture arcs
      // - Flowering hawthorn hedgerows + stone boundary cairns along the Cottage / Orchard arcs
      const sectorWave = Math.sin(ang * 3.0 + 0.6);
      const isBoulderStretch = (ang > 0.36 && ang < 0.78) || (i % 6 === 0);
      const isStoneWall = !isBoulderStretch && sectorWave >= -0.12;

      if (isBoulderStretch) {
        const scX = 1.28 + (i % 3) * 0.18;
        const scY = 1.12 + ((i * 5) % 4) * 0.22;
        const scZ = 0.96 + (i % 2) * 0.18;
        const b1 = new THREE.Mesh(boulderGeoA, i % 2 === 0 ? boulderGrey : stoneWarm);
        b1.scale.set(scX, scY, scZ);
        placePerim(b1, sx, scY * 0.74, sz, (i % 5) * 0.12, tangentYaw + (i % 4) * 0.35, ((i * 3) % 5) * 0.08);

        // Mossy cap & shoulder boulder so adjacent segments interlock seamlessly
        const mossCap = new THREE.Mesh(boulderGeoB, boulderMoss);
        mossCap.scale.set(scX * 0.92, 0.42, scZ * 0.86);
        placePerim(mossCap, sx, scY * 1.32, sz, 0, tangentYaw, 0);

        const tanOff = 1.45;
        const shoulder = new THREE.Mesh(boulderGeoB, stoneLight);
        shoulder.scale.set(1.18, 0.95 + (i % 3) * 0.16, 0.92);
        placePerim(
          shoulder,
          sx + cosA * tanOff,
          0.78,
          sz - sinA * tanOff,
          0.15,
          tangentYaw + 0.5,
          -0.12
        );
      } else if (isStoneWall) {
        // Traditional Storybook dry-stone country wall (`h = 1.42m`) + mossy coping slab + stone pillar
        placePerim(new THREE.Mesh(wallBodyGeo, i % 2 === 0 ? stoneWarm : boulderGrey), sx, 0.64, sz, 0, tangentYaw, 0);
        placePerim(new THREE.Mesh(wallCapGeo, i % 3 === 0 ? boulderMoss : stoneLight), sx, 1.32, sz, 0, tangentYaw, 0);
        if (i % 2 === 0) {
          placePerim(
            new THREE.Mesh(wallPostGeo, boulderGrey),
            sx + cosA * 1.72,
            0.76,
            sz - sinA * 1.72,
            0,
            tangentYaw,
            0
          );
        }
      } else {
        // Thick flowering hawthorn hedgerow (`h = 1.56m`) anchored on a low fieldstone kerb
        const kerb = new THREE.Mesh(wallCapGeo, stoneWarm);
        kerb.scale.set(1.0, 1.45, 1.15);
        placePerim(kerb, sx, 0.16, sz, 0, tangentYaw, 0);

        placePerim(new THREE.Mesh(hedgeBodyGeo, i % 2 === 0 ? hedgeDark : hedgeMid), sx, 0.86, sz, 0, tangentYaw, 0);
        for (const side of [-1.05, 1.05]) {
          const puff = new THREE.Mesh(hedgeCrownGeo, foliageMats[(i + (side > 0 ? 1 : 0)) % foliageMats.length]);
          puff.scale.set(1.18, 0.86, 0.95);
          placePerim(puff, sx + cosA * side, 1.38, sz - sinA * side, 0, tangentYaw, 0);
        }
        // Wildflower clusters dotting the hedgerow face
        const blMat = i % 3 === 0 ? blossomPink : i % 3 === 1 ? blossomGold : blossomWhite;
        for (const bOff of [-0.95, 0.15, 1.10]) {
          placePerim(
            new THREE.Mesh(blossomGeo, blMat),
            sx + cosA * bOff - sinA * 0.58,
            0.95 + ((i + Math.round(bOff * 2)) % 3) * 0.22,
            sz - sinA * bOff - cosA * 0.58
          );
        }
      }

      // Woodland border trees right behind the wall/boulders (`r = 39.8 .. 41.6m`) every 1.5 sectors (`48` trees)
      if (i % 3 !== 2) {
        const rTree = 40.0 + (i % 4) * 0.48;
        const aTree = ang + ((i % 2) - 0.5) * 0.035;
        const tx = Math.sin(aTree) * rTree;
        const tz = Math.cos(aTree) * rTree;
        const tScale = 0.94 + (i % 5) * 0.11;

        const trunk = new THREE.Mesh(trunkOakGeo, i % 2 === 0 ? barkMat : barkDark);
        trunk.scale.set(tScale, tScale, tScale);
        placePerim(trunk, tx, 1.85 * tScale, tz, 0, aTree, 0);

        if (i % 4 === 0) {
          // Tall Storybook Alpine Pine
          const pMat1 = foliageMats[3];
          const pMat2 = foliageMats[0];
          const c1 = new THREE.Mesh(pineConeLowGeo, pMat1);
          c1.scale.setScalar(tScale);
          placePerim(c1, tx, 3.1 * tScale, tz, 0, aTree, 0);
          const c2 = new THREE.Mesh(pineConeMidGeo, pMat2);
          c2.scale.setScalar(tScale);
          placePerim(c2, tx, 4.7 * tScale, tz, 0, aTree + 0.4, 0);
          const c3 = new THREE.Mesh(pineConeTopGeo, foliageMats[1]);
          c3.scale.setScalar(tScale);
          placePerim(c3, tx, 6.1 * tScale, tz, 0, aTree + 0.8, 0);
        } else {
          // Lush Broadleaf Valley Oak
          const mainLeaf = new THREE.Mesh(canopySphereGeo, foliageMats[i % 3]);
          mainLeaf.scale.set(1.15 * tScale, 0.92 * tScale, 1.12 * tScale);
          placePerim(mainLeaf, tx, 4.35 * tScale, tz, 0, aTree, 0);

          const topLeaf = new THREE.Mesh(canopySphereGeo, foliageMats[(i + 1) % 3]);
          topLeaf.scale.set(0.82 * tScale, 0.74 * tScale, 0.82 * tScale);
          placePerim(topLeaf, tx - sinA * 0.55, 5.45 * tScale, tz - cosA * 0.55, 0, aTree + 0.6, 0);
        }
      }
    }

    finalizeMergedGroup(THREE, perimeterGrp, 0x6f8b52);
    registerGroupSolids(perimeterGrp, 0x6f8b52);
    root.add(perimeterGrp);
  }

  // ==========================================================================
  // Runtime Methods Returned by `buildMeadowFeatures`
  // ==========================================================================

  function sampleFeatureHeight(x, z, refY) {
    // 1. Timber Treehouse Deck (`x: -28.2..-22.8, z: 14.2..19.2, y = 3.80`)
    if (x >= TREE_DECK_BOX.x0 && x <= TREE_DECK_BOX.x1 && z >= TREE_DECK_BOX.z0 && z <= TREE_DECK_BOX.z1) {
      if (refY === undefined || refY >= Y_TREEHOUSE - 1.55) {
        return Y_TREEHOUSE;
      }
    }

    // 2. Treehouse Walkable Wooden Ramp (`x: -25.5..-22.7, z: 10.6..14.25, y: 0 -> 3.80`)
    if (x >= TREE_RAMP_BOX.x0 && x <= TREE_RAMP_BOX.x1 && z >= TREE_RAMP_BOX.z0 && z <= TREE_RAMP_BOX.z1) {
      const t = clamp((z - TREE_RAMP_BOX.z0) / (TREE_RAMP_BOX.z1 - TREE_RAMP_BOX.z0), 0, 1);
      const ry = t * Y_TREEHOUSE;
      if (refY === undefined || refY >= ry - 1.45) {
        return ry;
      }
    }

    // 3. Barn Hay-Hoist Platform (`x: 15.8..19.6, z: -14.8..-11.2, y = 3.60`)
    if (x >= HAYLOFT_BOX.x0 && x <= HAYLOFT_BOX.x1 && z >= HAYLOFT_BOX.z0 && z <= HAYLOFT_BOX.z1) {
      if (!isInsideBarnEnvelope(x, z)) {
        if (refY === undefined || refY >= Y_HAYLOFT - 1.45) {
          return Y_HAYLOFT;
        }
      }
    }

    // 4. Stacked Hay-Bale Steps (`x: 13.2..15.85, z: -13.8..-11.2, y: 0 -> 3.60`)
    if (x >= HAY_STEPS_BOX.x0 && x <= HAY_STEPS_BOX.x1 && z >= HAY_STEPS_BOX.z0 && z <= HAY_STEPS_BOX.z1) {
      const t = clamp((x - HAY_STEPS_BOX.x0) / (HAY_STEPS_BOX.x1 - HAY_STEPS_BOX.x0), 0, 1);
      const sy = t * Y_HAYLOFT;
      if (refY === undefined || refY >= sy - 1.45) {
        return sy;
      }
    }

    // 5. Bouncy Hay-Wagon (`(17.6, -9.6)`, smooth straw apron `r = 2.02 -> 1.55` up to `y = 1.05`)
    const dw = Math.hypot(x - HAY_WAGON.x, z - HAY_WAGON.z);
    if (dw <= HAY_WAGON.apronR && (refY === undefined || refY <= 2.35)) {
      if (dw <= HAY_WAGON.r) return HAY_WAGON.topY;
      const frac = clamp((HAY_WAGON.apronR - dw) / (HAY_WAGON.apronR - HAY_WAGON.r), 0, 1);
      return frac * HAY_WAGON.topY;
    }

    return null;
  }

  function sampleLauncherAt(ch, _G, _dt) {
    if (!ch || !ch.userData || ch.userData.specialMode) return null;
    const u = ch.userData;
    const px = ch.position.x;
    const pz = ch.position.z;
    const footY = (u.groundY ?? ch.position.y ?? 0) + (u.jy || 0);
    const lastAt = charLaunchCooldown.get(ch) || -999;
    if (simClockSec - lastAt < 0.72) return null;

    // 1. Bouncy Hay-Wagon at `(17.6, -9.6)` (`r < 1.55` -> `vy = 9.8` onto Hay-Hoist Platform!)
    if (Math.hypot(px - HAY_WAGON.x, pz - HAY_WAGON.z) < 1.55 && footY <= 1.85 && (u.vy || 0) < 6.0) {
      charLaunchCooldown.set(ch, simClockSec);
      wagonSquash = 1.0;
      u.groundY = Math.max(u.groundY || 0, HAY_WAGON.topY);
      return {
        vy: 9.8,
        glide: false,
        hintMsg: '🌾 Boing! Launched off the Hay-Wagon!',
      };
    }

    // 2. Windmill Sail Breeze Boost at `(-20.8, -9.0)` (`r < 1.9m` while jumping -> `vy = 8.8`!)
    const isJumping = (u.jy || 0) > 0.04 || (u.vy || 0) > 0.35;
    if (isJumping && Math.hypot(px - MILL_BREEZE.x, pz - MILL_BREEZE.z) < MILL_BREEZE.r && footY <= 2.35 && (u.vy || 0) < 8.6) {
      charLaunchCooldown.set(ch, simClockSec);
      return {
        vy: 8.8,
        glide: true,
        hintMsg: '🌬️ Caught the Windmill sail breeze!',
      };
    }

    return null;
  }

  function routeFeatureWaypoint(from, goal) {
    if (!from || !goal) return null;
    const fy = typeof from.y === 'number' ? from.y : (sampleFeatureHeight(from.x, from.z) ?? 0);
    const gy = typeof goal.y === 'number' ? goal.y : (sampleFeatureHeight(goal.x, goal.z) ?? 0);

    const onTreeDeck = (p, py) =>
      py >= 2.2 && p.x >= TREE_DECK_BOX.x0 - 0.6 && p.x <= TREE_DECK_BOX.x1 + 0.6 && p.z >= TREE_DECK_BOX.z0 - 0.6 && p.z <= TREE_DECK_BOX.z1 + 0.6;
    const onHayloft = (p, py) =>
      py >= 2.2 && p.x >= HAYLOFT_BOX.x0 - 0.6 && p.x <= HAYLOFT_BOX.x1 + 0.6 && p.z >= HAYLOFT_BOX.z0 - 0.6 && p.z <= HAYLOFT_BOX.z1 + 0.6;

    // Ground -> Treehouse Deck via Treehouse Ramp (`x = -24.1, z: 10.3 -> 14.8`)
    if (fy < 2.2 && onTreeDeck(goal, gy)) {
      const inRampCorridor = from.x >= -25.35 && from.x <= -22.85 && from.z >= 10.1 && from.z <= 14.6;
      if (!inRampCorridor) return { x: -24.1, y: 0.0, z: 10.25 };
      if (from.z < 14.35) return { x: -24.1, y: Y_TREEHOUSE, z: 14.75 };
      return null;
    }

    // Treehouse Deck -> Ground via Treehouse Ramp
    if (onTreeDeck(from, fy) && !onTreeDeck(goal, gy)) {
      if (from.z > 14.35 && Math.hypot(from.x - -24.1, from.z - 14.45) > 0.95) {
        return { x: -24.1, y: Y_TREEHOUSE, z: 14.45 };
      }
      return { x: -24.1, y: 0.0, z: 10.1 };
    }

    // Ground -> Barn Hay-Hoist Platform via Stacked Hay-Bale Steps (`z = -12.5, x: 12.8 -> 16.3`)
    if (fy < 2.2 && onHayloft(goal, gy)) {
      const inStepsCorridor = from.z >= -13.65 && from.z <= -11.35 && from.x >= 12.6 && from.x <= 16.2;
      if (!inStepsCorridor) return { x: 12.75, y: 0.0, z: -12.5 };
      if (from.x < 15.95) return { x: 16.25, y: Y_HAYLOFT, z: -12.5 };
      return null;
    }

    // Barn Hay-Hoist Platform -> Ground via Stacked Hay-Bale Steps
    if (onHayloft(from, fy) && !onHayloft(goal, gy)) {
      if (from.x > 15.95 && Math.hypot(from.x - 16.05, from.z - -12.5) > 0.95) {
        return { x: 16.05, y: Y_HAYLOFT, z: -12.5 };
      }
      return { x: 12.65, y: 0.0, z: -12.5 };
    }

    return null;
  }

  function triggerMechanism(ch, inter, G) {
    if (!inter) return null;
    const id = inter.id || '';

    // 1. 🔔 Farm Dinner-Bell Triangle (`16s` cooldown)
    if (id === 'mb_dinner_bell' || inter.mechType === 'dinner_bell') {
      const elapsed = simClockSec - dinnerBellLastAt;
      if (elapsed < DINNER_BELL_COOLDOWN) {
        const left = Math.max(1, Math.ceil(DINNER_BELL_COOLDOWN - elapsed));
        return `🔔 Dinner Bell is still ringing (${left}s)!`;
      }
      dinnerBellLastAt = simClockSec;
      bellSwingT = 3.4;
      playDinnerBellChime(audio);
      if (typeof onDinnerBell === 'function') {
        onDinnerBell(ch, inter, G);
      }
      return '🔔 Rang the Farm Dinner Bell — the animals are stampeding!';
    }

    // 2. 💨 Flour-Chute Cloud Pull-Cords (`14s` cooldown, `3.8s` billowing cloud, `r = 3.2m`)
    if (id === 'mb_flour_mill' || id === 'mb_flour_bakery' || inter.mechType === 'flour_chute') {
      const st = chuteState[id] || chuteState.mb_flour_mill;
      const elapsed = simClockSec - st.lastAt;
      if (elapsed < FLOUR_CHUTE_COOLDOWN) {
        const left = Math.max(1, Math.ceil(FLOUR_CHUTE_COOLDOWN - elapsed));
        return `💨 Flour chute is refilling (${left}s)!`;
      }
      st.lastAt = simClockSec;
      st.tugT = 0.72;
      playFlourWhooshSynth(audio);

      const existing = activeClouds.find((c) => c.id === id);
      if (existing) {
        existing.age = 0;
        existing.x = inter.x;
        existing.z = inter.z;
      } else {
        activeClouds.push({
          id,
          x: inter.x,
          y: 1.12,
          z: inter.z,
          age: 0,
          dur: FLOUR_CLOUD_DURATION,
          radius: FLOUR_CLOUD_RADIUS,
        });
      }

      const whereLabel = id === 'mb_flour_bakery' ? 'Bakery' : 'Windmill';
      return `💨 Pulled the ${whereLabel} flour chute — Baker's Flour Cloud billowing!`;
    }

    return null;
  }

  function update(dt = 0.016, timeSec = 0) {
    const safeDt = clamp(dt || 0, 0, 0.12);
    simClockSec = typeof timeSec === 'number' && timeSec > 0 ? timeSec : simClockSec + safeDt;

    // 1. Windmill Breeze Swirl gentle rotation & bob
    breezeSwirlGrp.rotation.y = simClockSec * 1.65;
    breezeSwirlGrp.position.y = 0.06 + Math.sin(simClockSec * 2.4) * 0.04;

    // 2. Bouncy Hay-Wagon straw mound squash-and-rebound + gentle breeze breathing
    if (wagonSquash > 0.001) {
      wagonSquash = Math.max(0, wagonSquash - safeDt * 2.6);
    }
    if (hayWagonMoundPivot) {
      const boing = wagonSquash > 0 ? Math.sin(wagonSquash * PI * 3.0) * wagonSquash * 0.24 : 0;
      const idleBreath = Math.sin(simClockSec * 1.7) * 0.006;
      hayWagonMoundPivot.scale.set(1 + boing * 0.55 - idleBreath, 1 - boing + idleBreath, 1 + boing * 0.55 - idleBreath);
    }

    // 3. Farm Dinner-Bell swing (damped ringing + subtle wind micro-sway so world_optimizer keeps it dynamic)
    if (bellSwingT > 0) bellSwingT = Math.max(0, bellSwingT - safeDt);
    const bellRing = bellSwingT > 0 ? Math.sin(simClockSec * 16.0) * (bellSwingT / 3.4) * 0.46 : 0;
    dinnerBellPivot.rotation.z = Math.sin(simClockSec * 1.45) * 0.022 + bellRing;
    dinnerBellPivot.rotation.x = Math.cos(simClockSec * 1.15) * 0.014 + bellRing * 0.25;

    // 4. Flour-Chute Pull-Cords gentle wind sway + downward tug bounce
    for (const key of ['mb_flour_mill', 'mb_flour_bakery']) {
      const st = chuteState[key];
      if (!st.cordPivot) continue;
      if (st.tugT > 0) st.tugT = Math.max(0, st.tugT - safeDt);
      const tugDrop = st.tugT > 0 ? Math.sin((st.tugT / 0.72) * PI) * 0.18 : 0;
      st.cordPivot.position.y = 2.22 - tugDrop;
      st.cordPivot.rotation.z = Math.sin(simClockSec * 1.9 + (key === 'mb_flour_mill' ? 0 : 1.7)) * 0.032;
    }

    // 5. Animate Hider Special Disguises (Fluttering Clothesline Sheet & Rustling Haystack Crown)
    for (let i = 0; i < interactSpots.length; i++) {
      const sp = interactSpots[i];
      const occ = sp.occupiedBy;
      const sm = occ?.userData?.specialMesh;
      if (!sm) continue;
      if (sp.disguiseType === 'linen_sheet' && sm.userData.sheetPivot) {
        sm.userData.sheetPivot.rotation.x = Math.sin(simClockSec * 1.6) * 0.13 + Math.sin(simClockSec * 4.1) * 0.045;
      } else if (sp.disguiseType === 'haystack_tuft' && sm.userData.crownPivot) {
        const rustle = Math.sin(simClockSec * 2.1 + i) > 0.72 ? Math.sin(simClockSec * 18.0) * 0.045 : Math.sin(simClockSec * 1.5) * 0.014;
        sm.userData.crownPivot.rotation.z = rustle;
      }
    }

    // 6. Update 28-Puff Reusable Baker's Flour Cloud Pool (`3.8s` lifetime, `3.2m` billow radius)
    flourCloudContainer.rotation.y = Math.sin(simClockSec * 0.25) * 0.002; // Keeps container marked dynamic by world_optimizer
    for (let c = activeClouds.length - 1; c >= 0; c--) {
      activeClouds[c].age += safeDt;
      if (activeClouds[c].age >= activeClouds[c].dur) {
        activeClouds.splice(c, 1);
      }
    }

    if (activeClouds.length === 0) {
      for (let i = 0; i < FLOUR_PUFF_COUNT; i++) {
        if (flourPuffs[i].mesh.visible) flourPuffs[i].mesh.visible = false;
      }
    } else {
      const cloudCount = activeClouds.length;
      for (let i = 0; i < FLOUR_PUFF_COUNT; i++) {
        const pf = flourPuffs[i];
        const cloud = activeClouds[i % cloudCount];
        const u = clamp(cloud.age / cloud.dur, 0, 1);
        const expand = u < 0.16 ? (u / 0.16) : 1.0;
        const fade = u > 0.68 ? clamp(1 - (u - 0.68) / 0.32, 0, 1) : 1.0;

        const swirlAng = pf.ang + cloud.age * 0.55 * (i % 2 ? 1 : -1);
        const r = FLOUR_CLOUD_RADIUS * pf.distFrac * (0.35 + 0.65 * expand) + Math.sin(simClockSec * pf.wobbleSpd + pf.phase) * 0.18;
        const py = pf.baseY * (0.45 + 0.55 * expand) + cloud.age * 0.22 + Math.cos(simClockSec * 1.4 + pf.phase) * 0.08;
        const sc = pf.scaleBase * (0.45 + 0.65 * expand) * (0.35 + 0.65 * fade);

        pf.mesh.visible = fade > 0.02;
        pf.mesh.position.set(cloud.x + Math.cos(swirlAng) * r, py, cloud.z + Math.sin(swirlAng) * r);
        pf.mesh.scale.set(sc * 1.12, sc * 0.88, sc * 1.12);
        const tierIdx = fade > 0.78 ? 0 : fade > 0.54 ? 1 : fade > 0.28 ? 2 : 3;
        if (pf.mesh.material !== puffOpacityTiers[tierIdx]) {
          pf.mesh.material = puffOpacityTiers[tierIdx];
        }
      }
    }

    // 7. Town Square Anti-Air Sky-Turret Recoil Springs & Dynamic Pivot Preservation
    if (turretRecoilL > 0.001) {
      turretRecoilL = Math.max(0, turretRecoilL - safeDt * 7.2);
    } else {
      turretRecoilL = 0;
    }
    if (turretRecoilR > 0.001) {
      turretRecoilR = Math.max(0, turretRecoilR - safeDt * 7.2);
    } else {
      turretRecoilR = 0;
    }
    turretBarrelL.position.z = Math.sin(turretRecoilL * PI * 0.5) * 0.22 + Math.sin(simClockSec * 1.1) * 0.001;
    turretBarrelR.position.z = Math.sin(turretRecoilR * PI * 0.5) * 0.22 + Math.cos(simClockSec * 1.1) * 0.001;
    if (!turretApi.getOccupant()) {
      turretYawPivot.rotation.y = turretYaw + Math.sin(simClockSec * 0.45) * 0.015;
      turretPitchPivot.rotation.x = turretPitch + Math.sin(simClockSec * 0.72) * 0.012;
    }
  }

  return {
    interactSpots,
    turret: turretApi,
    sampleFeatureHeight,
    sampleLauncherAt,
    routeFeatureWaypoint,
    buildCustomSpotDisguise,
    triggerMechanism,
    breaksLineOfSight,
    checkFirePopHaystacks,
    update,
  };
}
