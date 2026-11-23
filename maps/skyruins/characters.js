/* Hue & Seek — Map 2: Celestia Sky-Ruins (`maps/skyruins/characters.js`)
 * 3 rigged Storybook Sky-Seekers + 1 rigged Cloud-Crystal Spirit Hider
 * sculpted 1:1 from `assets/maps/skyruins/characters_sheet.png`:
 *   - `sky_pirate`:    Rust-rose belted tunic, patched beige balloon trousers, laced boots,
 *                      crimson bandana + brass goggles over auburn twin-tails, hip wrench & pouches,
 *                      wielding the Brass Propeller Cloud-Cannon Blaster!
 *   - `airship_cadet`: Navy double-breasted flight jacket w/ gold wing badge, billowing cream scarf,
 *                      brown leather aviator helmet + goggles, copper pressure-tank backpack w/ gauge & hose,
 *                      wielding the Brass Cyan-Aether Stream Blaster!
 *   - `ruin_scholar`:  Olive-sage coat w/ golden Celestian square-spiral trim, round glasses, braided hair w/ red ribbon,
 *                      flower-sprouting pith sunhat, glowing cyan-crystal leather satchel + glass specimen vials,
 *                      wielding the Carved Celestian Rune-Brass Botanical Sprayer!
 *   - `cloud_crystal`: Chubby sky-blue & cream fluffy spirit w/ floppy feathered wing-ears, rosy cheeks,
 *                      winged-cloud belly emblem, bronze Celestian rune collar w/ cyan gem,
 *                      glowing cyan crystal head-sprout & floating mossy carved Celestian stone halo ring!
 *
 * STRICT STORYBOOK SHADING: `metalness: 0` enforced on EVERY SINGLE MATERIAL so brass, copper & gold gleam warmly!
 */
import { buildRiggedSeeker, buildRiggedHiderSpirit, mergeGeometries } from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

export const SEEKER_DEFS = [
  { id: 'sky_pirate',    label: 'Sky-Pirate Mechanic' },
  { id: 'airship_cadet', label: 'Airship Cadet' },
  { id: 'ruin_scholar',  label: 'Celestian Botanist' },
];

export const HIDER_DEF = {
  id: 'cloud_crystal',
  label: 'Cloud-Crystal Spirit',
  color: 0x88bce2,
};

// Proportions & 2-bone IK weapon poses for the 3 Celestia Chasers
const DIMS = {
  sky_pirate: {
    main: 0xc95e5a,
    hipY: 0.60, legX: 0.096, neckY: 1.12, sh: [0.190, 1.05], a: 0.255, b: 0.245,
    tw: 0.24, twAim: -0.34,
    head: { c: [0, 1.33, 0.015], r: 0.198, s: [1.0, 0.96, 0.95] },
    rest: { p: [-0.065, 0.93, 0.185], r: [-0.16, -0.46, -0.04] },
    aim:  { p: [-0.055, 0.99, 0.25],  r: [0.02, 0.04, 0] },
    gripF: [0, -0.02, 0.165],
    nozzle: [0, 0.072, 0.47],
    pole: [0.55, -0.6, -0.55],
  },
  airship_cadet: {
    main: 0x2e4670,
    hipY: 0.61, legX: 0.098, neckY: 1.14, sh: [0.205, 1.07], a: 0.250, b: 0.240,
    tw: -0.24, twAim: -0.38,
    head: { c: [0, 1.35, 0.015], r: 0.198, s: [1.0, 0.97, 0.96] },
    rest: { p: [-0.035, 0.85, 0.205], r: [0.04, 0.48, -0.04] },
    aim:  { p: [-0.055, 0.99, 0.26],  r: [0, 0.04, 0] },
    gripF: [0, -0.025, 0.185],
    nozzle: [0, 0.068, 0.46],
    pole: [0.58, -0.58, -0.52],
  },
  ruin_scholar: {
    main: 0x6d7f52,
    hipY: 0.60, legX: 0.092, neckY: 1.12, sh: [0.192, 1.05], a: 0.240, b: 0.230,
    tw: -0.24, twAim: -0.38,
    head: { c: [0, 1.33, 0.014], r: 0.196, s: [0.99, 0.96, 0.95] },
    rest: { p: [-0.025, 0.89, 0.200], r: [-0.10, 0.46, 0.03] },
    aim:  { p: [-0.055, 0.99, 0.25],  r: [0, 0.04, 0] },
    gripF: [0, -0.025, 0.175],
    nozzle: [0, 0.072, 0.45],
    pole: [0.55, -0.6, -0.55],
  },
};

let CYAN_GLOW_MAT = null;
function getCyanGlowMat(THREE) {
  if (!CYAN_GLOW_MAT || CYAN_GLOW_MAT.userData.T !== THREE) {
    CYAN_GLOW_MAT = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x0cb8f6,
      emissiveIntensity: 0.98,
      roughness: 0.20,
      metalness: 0,
    });
    CYAN_GLOW_MAT.userData.T = THREE;
  }
  return CYAN_GLOW_MAT;
}

// Colorize non-indexed BufferGeometry for CYAN_GLOW_MAT (bright cyan facets + luminous white-cyan tips)
function prepCyanGeo(THREE, geo, baseHex = 0x2ad8ff, tipHex = 0xd8fcff) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position;
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(P.count * 2), 2));
  }
  const cArr = new Float32Array(P.count * 3);
  const c0 = new THREE.Color(baseHex), c1 = new THREE.Color(tipHex), cTmp = new THREE.Color();
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1e-4, maxY - minY);
  for (let i = 0; i < P.count; i++) {
    const t = Math.abs(((P.getY(i) - minY) / span) - 0.5) * 1.7;
    cTmp.copy(c0).lerp(c1, Math.min(1, Math.max(0, t)));
    cArr[i * 3] = cTmp.r;
    cArr[i * 3 + 1] = cTmp.g;
    cArr[i * 3 + 2] = cTmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
  return g;
}

function makeCrystalGeo(THREE, r = 0.032, hTop = 0.072, hBot = 0.035, baseHex = 0x2ad8ff, tipHex = 0xdffcff) {
  const waist = r * 0.35;
  const top = new THREE.ConeGeometry(r, hTop, 6, 1, true);
  top.translate(0, waist + hTop * 0.5, 0);
  const belt = new THREE.CylinderGeometry(r, r * 0.94, waist * 2, 6, 1, true);
  const bot = new THREE.ConeGeometry(r * 0.94, hBot, 6, 1, true);
  bot.rotateX(PI);
  bot.translate(0, -waist - hBot * 0.5, 0);
  const merged = mergeGeometries([
    top.toNonIndexed(),
    belt.toNonIndexed(),
    bot.toNonIndexed(),
  ], false);
  top.dispose();
  belt.dispose();
  bot.dispose();
  merged.computeVertexNormals();
  return prepCyanGeo(THREE, merged, baseHex, tipHex);
}

// ============================================================================
// 1. SEEKERS (`sky_pirate`, `airship_cadet`, `ruin_scholar`)
// ============================================================================
export function buildMapSeeker(THREE, kindOrOpts = 'sky_pirate') {
  const req = typeof kindOrOpts === 'string' ? kindOrOpts : (kindOrOpts?.kind || 'sky_pirate');
  const kind = DIMS[req] ? req : 'sky_pirate';
  const D = DIMS[kind];
  const V = THREE.Vector3;

  const extraGlowTorso = [];
  const extraGlowWeapon = [];

  const root = buildRiggedSeeker(THREE, kind, D, (K) => {
    const {
      SKIN, xf, sph, lathe, tor, rbox, tube, seg, cylz,
      add, lock, buildFace, buildArm,
    } = K;

    const rAt = (P, y) => {
      for (let i = 0; i < P.length - 1; i++) {
        const [r0, y0] = P[i], [r1, y1] = P[i + 1];
        if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      }
      return P[P.length - 1][0];
    };
    const onT = (P, sz, az, y, out = 0) => {
      const r = rAt(P, y) + out;
      return new V(r * Math.sin(az), y, r * sz * Math.cos(az));
    };
    const addForeCuff = (cuffHex, mainSleeveHex, gloveHex, trimHex = null) => {
      for (const s of [1, -1]) {
        const f = s > 0 ? 'foreL' : 'foreR';
        add(f, 'cloth', seg([0, 0, 0], [0, -D.b * 0.36, 0], 0.064, 0.068, 12), mainSleeveHex);
        add(f, 'cloth', tor(0.066, 0.018, [0, -D.b * 0.37, 0], [PI / 2, 0, 0], 1, TAU, 6, 16), cuffHex);
        if (trimHex) {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            add(f, 'cloth', rbox(0.022, 0.022, 0.008, 0.002,
              [Math.sin(a) * 0.072, -D.b * 0.25, Math.cos(a) * 0.072], [0, a, 0]), trimHex);
          }
        }
        if (gloveHex) {
          add(f, 'cloth', tor(0.046, 0.012, [0, -D.b * 0.80, 0], [PI / 2, 0, 0], 1, TAU, 5, 14), gloveHex);
        }
      }
    };

    const addCelestianMeander = (gk, pos, rot, size, colOuter, colInner) => {
      add(gk, 'cloth', xf(new THREE.BoxGeometry(size, size, 0.014), pos, rot), colOuter);
      add(gk, 'cloth', xf(new THREE.BoxGeometry(size * 0.66, size * 0.66, 0.017), pos, rot), colInner);
      add(gk, 'cloth', xf(new THREE.BoxGeometry(size * 0.34, size * 0.34, 0.020), pos, rot), colOuter);
    };

    // ------------------------------------------------------------------------
    // A. SKY-PIRATE MECHANIC (`sky_pirate`)
    // ------------------------------------------------------------------------
    if (kind === 'sky_pirate') {
      const PANTS = 0xd2b896, PATCH = 0xba5e5a, BOOT = 0x764c2e, SOLE = 0x3b2416;
      const LEATHER = 0x744528, BRASS = 0xf4c254, BRASS_DK = 0xc68a2c;
      const HAIR = 0x7e3824, BANDANA = 0xc93a36, CUFF = 0xeec4bc, GLOVE = 0x4c3a2e, STEEL = 0xd8e3ec;

      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        const pantProf = [
          [0.058, 0.27], [0.124, 0.31], [0.150, 0.40], [0.145, 0.52], [0.118, 0.62], [0, 0.63],
        ];
        add(gk, 'cloth', lathe(pantProf, [x, 0, 0.005], [1, 1, 0.96], null, 18), PANTS);
        add(gk, 'cloth', tor(0.068, 0.016, [x, 0.275, 0.005], [PI / 2, 0, 0], 1, TAU, 6, 14), 0xb89c78);
        if (s < 0) {
          add(gk, 'cloth', rbox(0.086, 0.110, 0.024, 0.008, [x - 0.085, 0.42, 0.102], [0.08, -0.48, 0.08]), PATCH);
          for (const dy of [-0.04, 0.0, 0.04]) {
            add(gk, 'cloth', rbox(0.012, 0.005, 0.026, 0.002, [x - 0.050, 0.42 + dy, 0.120], [0.08, -0.48, 0.08]), 0xf5e2d0);
          }
        }
        add(gk, 'cloth', seg([x, 0.28, 0], [x, 0.21, 0], 0.046, 0.044, 10), SKIN);
        add(gk, 'cloth', lathe([[0.064, 0.03], [0.076, 0.07], [0.070, 0.215], [0.079, 0.232], [0, 0.234]], [x, 0, 0], 1, null, 16), BOOT);
        add(gk, 'cloth', sph(1, [x, 0.058, 0.056], [0.076, 0.058, 0.118], null, 14, 10), BOOT);
        add(gk, 'cloth', rbox(0.144, 0.030, 0.228, 0.010, [x, 0.015, 0.036]), SOLE);
        for (const [ly, rz] of [[0.105, 0.22], [0.138, -0.22], [0.172, 0.22], [0.202, -0.18]]) {
          add(gk, 'cloth', rbox(0.070, 0.010, 0.020, 0.004, [x, ly, 0.070], [0, 0, rz]), 0xe8c482);
        }
      }

      const side = [
        [0.268, 0.50], [0.278, 0.53], [0.244, 0.65], [0.204, 0.78],
        [0.198, 0.92], [0.194, 1.03], [0.146, 1.09], [0.076, 1.12],
      ];
      const sz = 0.86;
      add('torso', 'paint', lathe([[0, 0.54], [0.21, 0.50], ...side, [0, 1.13]], [0, 0, 0], [1, 1, sz], null, 24), 0xffffff);
      add('torso', 'paint', tor(0.110, 0.040, [0, 1.115, -0.025], [PI / 2 - 0.35, 0, 0], [1.06, 1, 0.94], TAU, 7, 18), 0xf6dedb);
      add('torso', 'cloth', rbox(0.068, 0.14, 0.025, 0.008, [0, 1.03, 0.155], [-0.12, 0, 0]), 0xf8efe2);
      add('torso', 'cloth', seg([0, 1.06, 0], [0, 1.20, 0.01], 0.048, 0.048, 10), SKIN);
      add('torso', 'cloth', rbox(0.022, 0.25, 0.022, 0.005, onT(side, sz, 0, 0.62, 0.004)), 0x883c3a);

      // Double crossed leather belts + golden-brass buckles + pouches + SILVER MECHANIC WRENCH!
      add('torso', 'cloth', lathe([[0.205, 0.77], [0.214, 0.79], [0.214, 0.825], [0.205, 0.835]], [0, 0, 0], [1, 1, sz + 0.02], null, 22), LEATHER);
      add('torso', 'cloth', tor(0.222, 0.018, [0, 0.725, 0], [PI / 2 + 0.10, 0, -0.16], [1.02, sz + 0.03, 1], TAU, 6, 22), LEATHER);
      add('torso', 'cloth', rbox(0.064, 0.050, 0.024, 0.008, onT(side, sz, 0.02, 0.802, 0.015)), BRASS);
      add('torso', 'cloth', rbox(0.032, 0.028, 0.028, 0.004, onT(side, sz, 0.02, 0.802, 0.016)), LEATHER);
      add('torso', 'cloth', rbox(0.054, 0.042, 0.022, 0.007, onT(side, sz, -0.18, 0.728, 0.018), [0, -0.18, -0.15]), BRASS);

      add('torso', 'cloth', tube([
        onT(side, sz, -0.55, 0.74, 0.016),
        onT(side, sz, 0.0, 0.91, 0.018),
        new V(0.14, 1.09, 0.02),
        new V(0.12, 0.92, -0.17),
        onT(side, sz, 2.5, 0.75, 0.016),
      ], 0.015, 20, 6), LEATHER);

      // Left hip leather tool pouch (+X, viewer's right) + Open-End Mechanic Wrench!
      add('torso', 'cloth', rbox(0.082, 0.13, 0.118, 0.022, [0.238, 0.66, -0.02], [0, 0, -0.18]), LEATHER);
      add('torso', 'cloth', sph(0.012, [0.278, 0.67, -0.02], 1, null, 7, 5), BRASS);
      add('torso', 'cloth', rbox(0.022, 0.195, 0.038, 0.006, [0.232, 0.625, 0.095], [0.16, 0.38, -0.22]), STEEL);
      add('torso', 'cloth', tor(0.034, 0.012, [0.208, 0.722, 0.078], [0.2, 1.15, 0.85], 1, PI * 1.48, 6, 12), STEEL);
      add('torso', 'cloth', tor(0.030, 0.011, [0.256, 0.530, 0.112], [0.2, 1.15, -2.2], 1, PI * 1.48, 6, 12), STEEL);

      // Right hip leather pouch & brass canisters (-X, viewer's left)
      add('torso', 'cloth', rbox(0.072, 0.11, 0.10, 0.018, [-0.228, 0.65, -0.03], [0, 0, 0.18]), LEATHER);
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.026, 0.026, 0.105, 10), [-0.228, 0.68, 0.065], [0.22, 0, 0.25]), BRASS);
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.020, 0.020, 0.085, 10), [-0.205, 0.64, 0.11], [0.28, 0, 0.20]), BRASS_DK);

      buildFace({ iris: 0x6b3a20, iris2: 0xdc8e44, brow: 0x562618, browRoll: 0.20, mouth: 'laugh' });
      add('head', 'cloth', sph(1, [0, 1.35, -0.035], [0.216, 0.206, 0.206], null, 20, 14), HAIR);
      for (const [az, l] of [[-0.50, 0.048], [-0.20, 0.055], [0.12, 0.052], [0.44, 0.046]]) {
        lock(az, 0.44, 0.012, [0.058, l, 0.028], HAIR, -az * 0.3, -0.14);
      }
      for (const s of [-1, 1]) {
        lock(s * 0.90, 0.06, 0.014, [0.066, 0.088, 0.038], HAIR, -s * 0.18, -0.18);
        add('head', 'cloth', sph(1, [s * 0.185, 1.31, -0.11], [0.076, 0.070, 0.095], [-0.2, s * 0.55, -s * 0.35], 12, 9), HAIR);
        add('head', 'cloth', sph(1, [s * 0.258, 1.27, -0.14], [0.068, 0.056, 0.108], [-0.35, s * 0.72, -s * 0.48], 10, 8), HAIR);
        add('head', 'cloth', sph(1, [s * 0.232, 1.20, -0.13], [0.050, 0.070, 0.080], [-0.25, s * 0.45, -s * 0.55], 10, 8), HAIR);
      }

      add('head', 'cloth', tor(0.204, 0.036, [0, 1.41, -0.01], [PI / 2 - 0.24, 0, 0], [1.03, 1.0, 0.99], TAU, 7, 22), BANDANA);
      add('head', 'cloth', sph(1, [0.195, 1.385, -0.09], [0.042, 0.040, 0.042], null, 9, 7), BANDANA);
      add('head', 'cloth', sph(1, [0.292, 1.398, -0.11], [0.090, 0.032, 0.034], [0.08, -0.30, -0.20], 10, 7), BANDANA);
      add('head', 'cloth', sph(1, [0.278, 1.338, -0.13], [0.082, 0.028, 0.032], [-0.10, -0.40, 0.24], 10, 7), BANDANA);

      add('head', 'cloth', tor(0.208, 0.013, [0, 1.435, -0.008], [PI / 2 - 0.28, 0, 0], [1.03, 1.0, 0.99], TAU, 5, 20), LEATHER);
      for (const s of [-1, 1]) {
        const gx = s * 0.078, gy = 1.468, gz = 0.172;
        add('head', 'cloth', xf(new THREE.CylinderGeometry(0.054, 0.058, 0.038, 16), [gx, gy, gz], [PI / 2 - 0.32, s * 0.22, 0]), BRASS);
        add('head', 'cloth', tor(0.050, 0.008, [gx, gy + 0.005, gz + 0.016], [-0.32, s * 0.22, 0], 1, TAU, 5, 16), BRASS_DK);
        add('head', 'glass', xf(new THREE.CylinderGeometry(0.043, 0.043, 0.012, 14), [gx, gy + 0.004, gz + 0.015], [PI / 2 - 0.32, s * 0.22, 0]));
      }
      add('head', 'cloth', rbox(0.044, 0.016, 0.018, 0.005, [0, 1.472, 0.188], [-0.32, 0, 0]), BRASS);

      buildArm(1,  { upper: 0xffffff, upperMat: 'paint', r1: 0.066, puff: 0.076, sleeve: 1, rs: 0.044, hand: 0.050, glove: GLOVE });
      buildArm(-1, { upper: 0xffffff, upperMat: 'paint', r1: 0.066, puff: 0.076, sleeve: 1, rs: 0.044, hand: 0.050, glove: GLOVE });
      addForeCuff(CUFF, D.main, BRASS);

      // WEAPON: Brass Propeller Cloud-Cannon Blaster (clear cloud chamber + 4-blade front brass prop + side gauge)
      const cy = 0.072;
      add('weapon', 'cloth', cylz(0.064, 0.070, -0.11, 0.06, 0, cy, 18), BRASS);
      add('weapon', 'cloth', sph(1, [0, cy, -0.11], [0.064, 0.064, 0.036], null, 12, 8), BRASS_DK);
      add('weapon', 'cloth', rbox(0.046, 0.118, 0.054, 0.016, [0, -0.018, -0.005], [0.28, 0, 0]), LEATHER);
      add('weapon', 'cloth', rbox(0.044, 0.098, 0.050, 0.014, [0, -0.018, 0.185], [-0.14, 0, 0]), LEATHER);

      // Round cream-faced side pressure gauge on receiver (+X & -X so visible whether aiming left or right!)
      for (const sx of [1, -1]) {
        add('weapon', 'cloth', xf(new THREE.CylinderGeometry(0.044, 0.044, 0.026, 14), [sx * 0.074, cy, -0.015], [0, 0, PI / 2]), BRASS);
        add('weapon', 'cloth', xf(new THREE.CylinderGeometry(0.034, 0.034, 0.030, 12), [sx * 0.077, cy, -0.015], [0, 0, PI / 2]), 0xfffaf0);
        add('weapon', 'cloth', rbox(0.004, 0.024, 0.006, 0.001, [sx * 0.094, cy + 0.006, -0.010], [0.5, 0, 0]), 0x382820);
      }

      // Clear glass cloud chamber + swirling white cumulus cloud puffs + 3 brass tie-rods
      add('weapon', 'glass', cylz(0.070, 0.070, 0.06, 0.29, 0, cy, 18));
      for (const [cx, dy, cz, r] of [
        [ 0.0,   0.004, 0.105, 0.046],
        [ 0.018, 0.014, 0.148, 0.042],
        [-0.018,-0.010, 0.178, 0.044],
        [ 0.012,-0.008, 0.215, 0.041],
        [-0.010, 0.012, 0.248, 0.040],
      ]) {
        add('weapon', 'cloth', sph(r, [cx, cy + dy, cz], 1, null, 10, 8), 0xfafeff);
      }
      for (const a of [0.55, 2.62, 4.71]) {
        add('weapon', 'cloth', cylz(0.008, 0.008, 0.055, 0.295, Math.cos(a) * 0.074, cy + Math.sin(a) * 0.074, 6), BRASS);
      }

      add('weapon', 'cloth', cylz(0.074, 0.066, 0.29, 0.365, 0, cy, 18), BRASS);
      add('weapon', 'cloth', cylz(0.046, 0.016, 0.365, 0.465, 0, cy, 14), BRASS);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + PI / 4;
        add('weapon', 'cloth', sph(1, [Math.cos(a) * 0.106, cy + Math.sin(a) * 0.106, 0.410],
          [0.098, 0.038, 0.010], [0.30 * Math.sin(a), -0.30 * Math.cos(a), a], 10, 7), BRASS);
      }
    }

    // ------------------------------------------------------------------------
    // B. AIRSHIP CADET (`airship_cadet`)
    // ------------------------------------------------------------------------
    if (kind === 'airship_cadet') {
      const PANTS = 0x645e5a, PATCH = 0x9c7e5c, BOOT = 0x724a2c, SOLE = 0x3a2416;
      const LEATHER = 0x784828, CAP = 0x623f28, BRASS = 0xf4c254, COPPER = 0xd87a40;
      const SCARF = 0xf7efe0, SCARF_SH = 0xeadec6, HAIR = 0x2a1f18, CUFF = 0xd4dce4, GLOVE = 0x5c3d2c, HOSE = 0x88383c;

      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        const pantProf = [
          [0.068, 0.23], [0.118, 0.27], [0.138, 0.39], [0.134, 0.52], [0.115, 0.62], [0, 0.63],
        ];
        add(gk, 'cloth', lathe(pantProf, [x, 0, 0.006], [1, 1, 0.95], null, 18), PANTS);
        add(gk, 'cloth', tor(0.074, 0.016, [x, 0.235, 0.006], [PI / 2, 0, 0], 1, TAU, 6, 14), 0x524d4a);
        const py = s < 0 ? 0.40 : 0.35;
        add(gk, 'cloth', rbox(0.078, 0.104, 0.022, 0.008, [x + s * 0.055, py, 0.100], [0.06, s * 0.38, 0]), PATCH);

        add(gk, 'cloth', lathe([[0.068, 0.03], [0.080, 0.07], [0.075, 0.22], [0.082, 0.238], [0, 0.240]], [x, 0, 0], 1, null, 16), BOOT);
        add(gk, 'cloth', sph(1, [x, 0.058, 0.058], [0.080, 0.058, 0.122], null, 14, 10), BOOT);
        add(gk, 'cloth', rbox(0.150, 0.030, 0.238, 0.010, [x, 0.015, 0.038]), SOLE);
        for (const y of [0.11, 0.175]) {
          add(gk, 'cloth', tor(0.078, 0.010, [x, y, 0.005], [PI / 2, 0, 0], 1, TAU, 5, 14), LEATHER);
          add(gk, 'cloth', rbox(0.030, 0.026, 0.015, 0.004, [x + s * 0.068, y, 0.042], [0, s * 0.9, 0]), BRASS);
        }
      }

      const side = [
        [0.248, 0.54], [0.255, 0.57], [0.234, 0.68], [0.216, 0.80],
        [0.220, 0.94], [0.206, 1.05], [0.156, 1.10], [0.085, 1.13],
      ];
      const sz = 0.86;
      add('torso', 'paint', lathe([[0, 0.56], [0.20, 0.54], ...side, [0, 1.14]], [0, 0, 0], [1, 1, sz], null, 24), 0xffffff);
      add('torso', 'cloth', seg([0, 1.08, 0], [0, 1.21, 0.01], 0.050, 0.050, 10), SKIN);

      for (const y of [0.99, 0.90, 0.81]) {
        for (const az of [-0.22, 0.22]) {
          add('torso', 'cloth', sph(0.015, onT(side, sz, az, y, 0.009), [1, 1, 0.6], null, 8, 6), BRASS);
        }
      }
      // Sculpted Golden Winged Cadet Badge on left chest (+X)
      const badgeP = onT(side, sz, 0.42, 0.985, 0.012);
      add('torso', 'cloth', sph(0.015, badgeP, [1, 1.1, 0.55], [0, 0.38, 0], 8, 6), BRASS);
      for (const ws of [-1, 1]) {
        add('torso', 'cloth', sph(1, [badgeP.x + ws * 0.028, badgeP.y + 0.005, badgeP.z - ws * 0.008],
          [0.026, 0.010, 0.006], [0, 0.38, -ws * 0.25], 8, 5), BRASS);
        add('torso', 'cloth', sph(1, [badgeP.x + ws * 0.021, badgeP.y - 0.005, badgeP.z - ws * 0.006],
          [0.019, 0.008, 0.005], [0, 0.38, -ws * 0.10], 7, 5), BRASS);
      }

      add('torso', 'cloth', lathe([[0.222, 0.72], [0.232, 0.74], [0.230, 0.78]], [0, 0, 0], [1, 1, sz + 0.02], null, 22), LEATHER);
      add('torso', 'cloth', rbox(0.058, 0.048, 0.022, 0.006, onT(side, sz, 0, 0.755, 0.015)), BRASS);
      add('torso', 'cloth', rbox(0.088, 0.12, 0.12, 0.022, [-0.235, 0.665, 0.035], [0, 0, 0.16]), LEATHER);
      add('torso', 'cloth', sph(0.012, [-0.278, 0.675, 0.035], 1, null, 7, 5), BRASS);
      for (const s of [-1, 1]) {
        add('torso', 'cloth', tube([
          new V(s * 0.11, 0.76, 0.18), new V(s * 0.13, 0.96, 0.186),
          new V(s * 0.135, 1.11, 0.02), new V(s * 0.12, 0.96, -0.19), new V(s * 0.10, 0.76, -0.19),
        ], 0.016, 18, 6), LEATHER);
        add('torso', 'cloth', rbox(0.038, 0.034, 0.016, 0.004, [s * 0.128, 0.96, 0.194]), BRASS);
      }

      // Billowing Cream Flight Scarf + Twin Wind-Sculpted Streaming Scarf Tails (+X)
      add('torso', 'cloth', tor(0.118, 0.040, [0, 1.132, 0.012], [PI / 2 - 0.18, 0, 0.06], [1.06, 1.0, 0.96], TAU, 8, 20), SCARF);
      add('torso', 'cloth', tor(0.128, 0.034, [0.01, 1.095, 0.016], [PI / 2 - 0.14, 0, -0.05], [1.08, 1.0, 0.96], TAU, 7, 20), SCARF_SH);
      add('torso', 'cloth', tube([
        [0.10, 1.135, -0.05], [0.26, 1.17, -0.09], [0.44, 1.24, -0.11], [0.60, 1.19, -0.13],
      ], 0.036, 18, 7), SCARF);
      add('torso', 'cloth', sph(1, [0.58, 1.20, -0.13], [0.085, 0.042, 0.016], [0.1, 0.15, -0.22], 10, 7), SCARF);
      add('torso', 'cloth', tube([
        [0.09, 1.09, -0.07], [0.24, 1.08, -0.12], [0.41, 1.10, -0.15], [0.54, 1.03, -0.17],
      ], 0.030, 16, 6), SCARF_SH);
      add('torso', 'cloth', sph(1, [0.53, 1.04, -0.17], [0.075, 0.036, 0.015], [0.1, 0.2, -0.30], 10, 7), SCARF_SH);

      // Burnished Copper Pressure-Tank Backpack + Prominent Right-Shoulder Gauge & Maroon Hose (-X, viewer's left!)
      const tx = -0.135, ty = 0.91, tz = -0.225;
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.124, 0.124, 0.36, 18), [tx, ty, tz]), COPPER);
      add('torso', 'cloth', sph(0.124, [tx, ty + 0.18, tz], [1, 0.72, 1], null, 16, 10), COPPER);
      add('torso', 'cloth', sph(0.124, [tx, ty - 0.18, tz], [1, 0.65, 1], null, 16, 10), COPPER);
      for (const by of [ty - 0.11, ty + 0.09]) {
        add('torso', 'cloth', tor(0.126, 0.014, [tx, by, tz], [PI / 2, 0, 0], 1, TAU, 6, 18), BRASS);
      }
      // Tall round cream-faced pressure gauge peeking clearly outside right shoulder silhouette (-X, viewer's left!)
      const gx = -0.275, gy = 1.245, gz = -0.105;
      add('torso', 'cloth', seg([tx - 0.05, ty + 0.21, tz + 0.03], [gx, gy - 0.02, gz], 0.015, 0.015, 8), BRASS);
      add('torso', 'cloth', cylz(0.055, 0.055, gz - 0.020, gz + 0.024, gx, gy, 16), BRASS);
      add('torso', 'cloth', cylz(0.044, 0.044, gz - 0.012, gz + 0.028, gx, gy, 14), 0xfffaf0);
      add('torso', 'cloth', rbox(0.005, 0.028, 0.006, 0.001, [gx + 0.007, gy + 0.007, gz + 0.030], [0, 0, -0.6]), 0x382820);
      // Ribbed maroon pressure hose looping visibly out around right flank into blaster!
      add('torso', 'cloth', tube([
        [tx - 0.06, ty - 0.21, tz], [-0.31, 0.75, -0.12], [-0.32, 0.77, 0.04], [-0.18, 0.81, 0.15],
      ], 0.023, 20, 7), HOSE);

      buildFace({ iris: 0x3b2316, iris2: 0xa66e3c, brow: 0x241812, browRoll: 0.12, mouth: 'smile' });
      for (const [az, l, rl] of [[-0.46, 0.054, 0.3], [-0.16, 0.064, 0.15], [0.12, 0.060, -0.2], [0.40, 0.050, -0.3]]) {
        lock(az, 0.42, 0.012, [0.056, l, 0.028], HAIR, rl, -0.22);
      }
      add('head', 'cloth', sph(1, [0, 1.38, -0.025], [0.218, 0.206, 0.214], null, 20, 14), CAP);
      add('head', 'cloth', tor(0.200, 0.021, [0, 1.44, 0.02], [PI / 2 - 0.38, 0, 0], [1.02, 1, 0.96], PI, 6, 16), LEATHER);
      for (const s of [-1, 1]) {
        add('head', 'cloth', sph(1, [s * 0.20, 1.30, -0.005], [0.044, 0.098, 0.074], [0, 0, -s * 0.15], 12, 9), CAP);
        add('head', 'cloth', xf(new THREE.CylinderGeometry(0.048, 0.052, 0.030, 14), [s * 0.218, 1.32, -0.005], [0, 0, PI / 2]), LEATHER);
        const ggx = s * 0.076, ggy = 1.488, ggz = 0.168;
        add('head', 'cloth', xf(new THREE.CylinderGeometry(0.052, 0.056, 0.038, 16), [ggx, ggy, ggz], [PI / 2 - 0.36, s * 0.2, 0]), BRASS);
        add('head', 'glass', xf(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 14), [ggx, ggy + 0.004, ggz + 0.015], [PI / 2 - 0.36, s * 0.2, 0]));
      }
      add('head', 'cloth', rbox(0.042, 0.015, 0.018, 0.005, [0, 1.490, 0.182], [-0.36, 0, 0]), BRASS);
      add('head', 'cloth', tor(0.212, 0.013, [0, 1.452, -0.01], [PI / 2 - 0.32, 0, 0], 1, TAU, 5, 20), LEATHER);

      buildArm(1,  { upper: 0xffffff, upperMat: 'paint', r1: 0.068, puff: 0.078, sleeve: 1, rs: 0.045, hand: 0.052, glove: GLOVE });
      buildArm(-1, { upper: 0xffffff, upperMat: 'paint', r1: 0.068, puff: 0.078, sleeve: 1, rs: 0.045, hand: 0.052, glove: GLOVE });
      addForeCuff(CUFF, D.main, LEATHER);

      // WEAPON: Brass Cyan-Aether Stream Blaster (glowing cyan chamber + top rail + brass muzzle)
      const cy = 0.068;
      add('weapon', 'cloth', cylz(0.062, 0.068, -0.10, 0.05, 0, cy, 18), BRASS);
      add('weapon', 'cloth', sph(1, [0, cy, -0.10], [0.060, 0.060, 0.034], null, 12, 8), COPPER);
      add('weapon', 'cloth', rbox(0.044, 0.118, 0.052, 0.015, [0, -0.018, 0.0], [0.28, 0, 0]), LEATHER);
      add('weapon', 'cloth', rbox(0.042, 0.098, 0.048, 0.014, [0, -0.018, 0.185], [-0.12, 0, 0]), LEATHER);
      add('weapon', 'cloth', tube([
        [0, cy + 0.062, 0.025], [0, cy + 0.106, 0.085], [0, cy + 0.106, 0.215], [0, cy + 0.062, 0.275],
      ], 0.014, 14, 6), BRASS);
      for (const a of [-0.8, 0.8, PI]) {
        add('weapon', 'cloth', cylz(0.007, 0.007, 0.05, 0.275, Math.cos(a) * 0.066, cy + Math.sin(a) * 0.066, 6), BRASS);
      }

      add('weapon', 'glass', cylz(0.064, 0.064, 0.05, 0.275, 0, cy, 18));
      extraGlowWeapon.push(
        prepCyanGeo(THREE, cylz(0.048, 0.048, 0.062, 0.262, 0, cy, 16), 0x1ec8ff, 0xb8f8ff),
        prepCyanGeo(THREE, sph(0.020, [0.016, cy + 0.016, 0.135], 1, null, 8, 6), 0xd8fcff, 0xffffff),
        prepCyanGeo(THREE, sph(0.016, [-0.015, cy - 0.012, 0.205], 1, null, 8, 6), 0xd8fcff, 0xffffff)
      );

      add('weapon', 'cloth', cylz(0.068, 0.058, 0.275, 0.345, 0, cy, 18), BRASS);
      add('weapon', 'cloth', cylz(0.044, 0.036, 0.345, 0.415, 0, cy, 14), COPPER);
      add('weapon', 'cloth', cylz(0.030, 0.036, 0.415, 0.460, 0, cy, 14), BRASS);
    }

    // ------------------------------------------------------------------------
    // C. CELESTIAN BOTANIST (`ruin_scholar`)
    // ------------------------------------------------------------------------
    if (kind === 'ruin_scholar') {
      const PANTS = 0x563c2a, CUFF = 0xe4d8c0, BOOT = 0x6b492e, SOLE = 0x3a2516;
      const SHIRT = 0xf7efe0, LEATHER = 0x74492b, BRONZE = 0xdca648, GOLD = 0xf8dc82;
      const TRIM = 0xd6cf80, TRIM_DK = 0x45542e, HAIR = 0x281e19, HAT = 0xdecba2, RIBBON = 0xcf463e;

      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        const pantProf = [
          [0.068, 0.22], [0.110, 0.27], [0.120, 0.38], [0.114, 0.54], [0.10, 0.62], [0, 0.63],
        ];
        add(gk, 'cloth', lathe(pantProf, [x, 0, 0.004], [1, 1, 0.94], null, 16), PANTS);
        add(gk, 'cloth', lathe([[0.074, 0.195], [0.084, 0.205], [0.084, 0.248], [0.074, 0.255]], [x, 0, 0.004], 1, null, 16), CUFF);
        add(gk, 'cloth', lathe([[0.062, 0.03], [0.072, 0.065], [0.066, 0.20], [0, 0.205]], [x, 0, 0], 1, null, 16), BOOT);
        add(gk, 'cloth', sph(1, [x, 0.054, 0.052], [0.072, 0.054, 0.112], null, 14, 10), BOOT);
        add(gk, 'cloth', rbox(0.138, 0.028, 0.218, 0.010, [x, 0.014, 0.032]), SOLE);
        for (const ly of [0.10, 0.135, 0.17]) {
          add(gk, 'cloth', rbox(0.062, 0.009, 0.018, 0.003, [x, ly, 0.064]), 0xdab678);
        }
      }

      const side = [
        [0.308, 0.37], [0.316, 0.39], [0.280, 0.52], [0.236, 0.68],
        [0.206, 0.82], [0.200, 0.95], [0.186, 1.05], [0.136, 1.10], [0.076, 1.12],
      ];
      const sz = 0.86;
      add('torso', 'paint', lathe([[0, 0.42], [0.26, 0.375], ...side, [0, 1.13]], [0, 0, 0], [1, 1, sz], null, 26), 0xffffff);
      add('torso', 'cloth', rbox(0.088, 0.35, 0.032, 0.010, [0, 0.94, 0.162], [-0.06, 0, 0]), SHIRT);
      add('torso', 'cloth', tor(0.078, 0.022, [0, 1.115, 0.02], [PI / 2 - 0.22, 0, 0], 1, TAU, 6, 16), SHIRT);
      add('torso', 'cloth', seg([0, 1.06, 0], [0, 1.20, 0.01], 0.046, 0.046, 10), SKIN);

      // Golden Celestian square-spiral meander border along coat hem AND vertical front coat edges!
      for (let i = 0; i < 16; i++) {
        const az = ((i / 16) - 0.5) * TAU;
        if (Math.abs(az) < 0.22) continue;
        const p = onT(side, sz, az, 0.418, 0.006);
        addCelestianMeander('torso', p, [0.18, az, 0], 0.056, TRIM, TRIM_DK);
      }
      for (const s of [-1, 1]) {
        for (const y of [0.49, 0.57, 0.65, 0.73]) {
          const p = onT(side, sz, s * 0.24, y, 0.006);
          addCelestianMeander('torso', p, [0.12, s * 0.24, 0], 0.046, TRIM, TRIM_DK);
        }
      }
      add('torso', 'cloth', rbox(0.078, 0.38, 0.024, 0.006, [0, 0.56, 0.196]), PANTS);

      // Waist belt + 2 corked glass specimen vials (+X front-left hip!)
      add('torso', 'cloth', lathe([[0.208, 0.78], [0.216, 0.80], [0.214, 0.83]], [0, 0, 0], [1, 1, sz + 0.02], null, 22), LEATHER);
      add('torso', 'cloth', rbox(0.054, 0.046, 0.020, 0.006, onT(side, sz, 0, 0.805, 0.013)), BRONZE);
      for (const [dx, dz] of [[0.185, 0.115], [0.208, 0.080]]) {
        add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.015, 0.015, 0.098, 10), [dx, 0.735, dz], [0.05, 0, -0.15]), 0x7ef2ff);
        add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.017, 0.016, 0.022, 10), [dx - 0.007, 0.788, dz], [0.05, 0, -0.15]), 0xd4a062);
      }

      // Cross-body strap + Front-Hip Leather Satchel (-X/+Z) overflowing w/ Glowing Cyan Crystals & Wildflowers!
      add('torso', 'cloth', tube([
        [-0.19, 0.69, 0.12], [-0.03, 0.90, 0.188], [0.13, 1.10, 0.02], [0.06, 0.92, -0.19], [-0.20, 0.68, -0.05],
      ], 0.016, 20, 6), LEATHER);
      const sx = -0.195, sy = 0.625, szSat = 0.115;
      const satRot = [0.06, 0.48, 0.14];
      add('torso', 'cloth', rbox(0.118, 0.165, 0.205, 0.022, [sx, sy, szSat], satRot), LEATHER);
      add('torso', 'cloth', rbox(0.126, 0.034, 0.210, 0.008, [sx - 0.006, sy + 0.068, szSat], satRot), BRONZE);
      add('torso', 'cloth', sph(0.022, [sx - 0.048, sy - 0.008, szSat + 0.035], [0.55, 1, 1], satRot, 8, 6), GOLD);
      // Leafy botanical sprigs & white daisies tucked into satchel!
      add('torso', 'cloth', sph(1, [sx - 0.055, sy + 0.10, szSat - 0.055], [0.024, 0.058, 0.014], [0.2, 0.4, 0.55], 7, 5), 0x76b844);
      add('torso', 'cloth', sph(1, [sx - 0.035, sy + 0.105, szSat + 0.065], [0.022, 0.052, 0.014], [0.3, 0.2, 0.45], 7, 5), 0x86c852);
      add('torso', 'cloth', sph(0.024, [sx - 0.025, sy + 0.122, szSat + 0.062], [0.65, 1, 1], null, 8, 6), 0xfffaf0);
      add('torso', 'cloth', sph(0.011, [sx - 0.034, sy + 0.122, szSat + 0.068], 1, null, 6, 5), GOLD);

      extraGlowTorso.push(
        xf(makeCrystalGeo(THREE, 0.030, 0.105, 0.036), [sx + 0.004, sy + 0.122, szSat + 0.004], [0.10, 0.48, 0.22]),
        xf(makeCrystalGeo(THREE, 0.024, 0.082, 0.030), [sx + 0.024, sy + 0.106, szSat + 0.048], [0.32, 0.48, 0.28]),
        xf(makeCrystalGeo(THREE, 0.024, 0.080, 0.030), [sx - 0.018, sy + 0.105, szSat - 0.042], [-0.26, 0.48, 0.28]),
        xf(makeCrystalGeo(THREE, 0.020, 0.066, 0.024), [sx - 0.022, sy + 0.100, szSat + 0.026], [0.22, 0.20, 0.42])
      );

      buildFace({ iris: 0x3b2618, iris2: 0x9c6b42, brow: 0x261c17, browRoll: 0.08, mouth: 'smile', eyeK: 0.94 });
      for (const s of [-1, 1]) {
        const gx = s * 0.068, gy = 1.322, gz = 0.196;
        add('head', 'cloth', tor(0.045, 0.006, [gx, gy, gz], [0, s * 0.18, 0], 1, TAU, 6, 20), BRONZE);
        add('head', 'glass', xf(new THREE.CylinderGeometry(0.041, 0.041, 0.006, 14), [gx, gy, gz], [PI / 2, 0, -s * 0.18]));
      }
      add('head', 'cloth', rbox(0.040, 0.006, 0.008, 0.003, [0, 1.328, 0.203]), BRONZE);

      add('head', 'cloth', sph(1, [0, 1.35, -0.035], [0.208, 0.198, 0.20], null, 18, 12), HAIR);
      for (const [az, l] of [[-0.46, 0.044], [-0.18, 0.050], [0.16, 0.048], [0.44, 0.044]]) {
        lock(az, 0.44, 0.012, [0.054, l, 0.028], HAIR, -az * 0.28, -0.14);
      }
      for (const s of [-1, 1]) {
        lock(s * 0.88, 0.10, 0.012, [0.056, 0.090, 0.034], HAIR, -s * 0.15, -0.15);
      }
      const braidPts = [
        [-0.08, 1.24, -0.15], [-0.14, 1.18, -0.16], [-0.195, 1.11, -0.14],
        [-0.24, 1.04, -0.12], [-0.275, 0.97, -0.10], [-0.30, 0.90, -0.08],
      ];
      braidPts.forEach((bp, idx) => {
        const r = 0.046 - idx * 0.0035;
        add('head', 'cloth', sph(r, bp, [1.18, 0.92, 1.0], [0, 0, 0.34], 10, 8), HAIR);
      });
      add('head', 'cloth', sph(1, [-0.315, 0.855, -0.07], [0.022, 0.020, 0.022], null, 7, 6), RIBBON);
      add('head', 'cloth', sph(1, [-0.342, 0.868, -0.068], [0.034, 0.019, 0.016], [0, 0, 0.4], 8, 6), RIBBON);
      add('head', 'cloth', sph(1, [-0.288, 0.844, -0.068], [0.034, 0.019, 0.016], [0, 0, 0.4], 8, 6), RIBBON);
      add('head', 'cloth', sph(1, [-0.338, 0.795, -0.06], [0.032, 0.058, 0.028], [0, 0, 0.48], 9, 7), HAIR);

      // Wide-brimmed explorer pith sunhat + olive band + fresh leaves & white wildflowers on crown!
      const hatP = [0, 1.43, -0.015], hatR = [-0.24, 0, 0.08];
      const hatProf = [
        [0, 0.158], [0.098, 0.152], [0.168, 0.116], [0.200, 0.056], [0.210, 0.016],
        [0.338, -0.022], [0.362, -0.035], [0.352, -0.046], [0.212, -0.008], [0.19, 0.0],
      ];
      add('head', 'cloth', lathe(hatProf.slice().reverse(), hatP, 1, hatR, 26), HAT);
      add('head', 'cloth', lathe([[0.211, 0.016], [0.206, 0.056], [0.200, 0.062]], hatP, 1, hatR, 26), D.main);
      add('head', 'cloth', sph(1, [-0.095, 1.59, 0.06], [0.032, 0.074, 0.014], [0.2, 0.3, 0.62], 8, 6), 0x74b644);
      add('head', 'cloth', sph(1, [ 0.025, 1.608, 0.07], [0.028, 0.064, 0.014], [0.2, -0.2, -0.48], 8, 6), 0x86c652);
      const fc = new V(-0.025, 1.632, 0.095);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        add('head', 'cloth', sph(1, [fc.x + Math.cos(a) * 0.034, fc.y + Math.sin(a) * 0.030, fc.z + 0.008],
          [0.022, 0.032, 0.010], [0.25, 0, -a + PI / 2], 7, 5), 0xfffcf4);
      }
      add('head', 'cloth', sph(0.017, [fc.x, fc.y, fc.z + 0.016], 1, null, 7, 5), 0xf6c238);

      buildArm(1,  { upper: 0xffffff, upperMat: 'paint', r1: 0.068, puff: 0.078, sleeve: 1, rs: 0.042, hand: 0.048 });
      buildArm(-1, { upper: 0xffffff, upperMat: 'paint', r1: 0.068, puff: 0.078, sleeve: 1, rs: 0.042, hand: 0.048 });
      addForeCuff(TRIM, D.main, null, TRIM_DK);

      // WEAPON: Carved Celestian Rune-Brass Botanical Sprayer!
      const cy = 0.072;
      add('weapon', 'cloth', rbox(0.090, 0.106, 0.255, 0.018, [0, cy, 0.16]), BRONZE);
      for (const s of [-1, 1]) {
        for (const gz of [0.108, 0.208]) {
          addCelestianMeander('weapon', [s * 0.046, cy, gz], [0, s * PI / 2, 0], 0.068, GOLD, 0x684b1e);
        }
      }
      add('weapon', 'glass', sph(0.062, [0, cy + 0.028, -0.015], [1, 1.14, 1], null, 16, 12));
      add('weapon', 'cloth', cylz(0.038, 0.024, -0.019, 0.013, 0, cy + 0.100, 12), BRONZE);
      add('weapon', 'cloth', sph(0.019, [0, cy + 0.118, -0.015], 1, null, 8, 6), GOLD);
      add('weapon', 'cloth', sph(1, [-0.006, cy + 0.024, -0.015], [0.020, 0.048, 0.012], [0.2, 0.3, 0.35], 8, 6), 0x72ba44);
      add('weapon', 'cloth', sph(1, [ 0.014, cy + 0.018, -0.006], [0.018, 0.040, 0.012], [-0.2, 0, -0.45], 8, 6), 0x8cd256);

      add('weapon', 'cloth', rbox(0.042, 0.118, 0.048, 0.014, [0, -0.018, 0.0], [0.26, 0, 0]), LEATHER);
      add('weapon', 'cloth', rbox(0.040, 0.098, 0.046, 0.014, [0, -0.018, 0.18], [-0.14, 0, 0]), LEATHER);
      add('weapon', 'cloth', tube([[0, -0.065, 0.01], [0, -0.108, 0.09], [0, -0.062, 0.18]], 0.013, 12, 5), 0x86383c);
      add('weapon', 'cloth', cylz(0.050, 0.040, 0.285, 0.368, 0, cy, 16), BRONZE);
      add('weapon', 'cloth', cylz(0.038, 0.058, 0.368, 0.438, 0, cy, 16), GOLD);
      extraGlowWeapon.push(
        prepCyanGeo(THREE, tor(0.040, 0.012, [0, cy, 0.440], null, 1, TAU, 6, 18), 0x2ad8ff, 0xdffcff)
      );
    }
  });

  // Attach Celestian cyan emissive glow meshes & enforce metalness: 0 on ALL seeker meshes
  const glowMat = getCyanGlowMat(THREE);
  if (extraGlowTorso.length) {
    const g = mergeGeometries(extraGlowTorso, false);
    g.translate(0, -D.hipY, 0);
    const m = new THREE.Mesh(g, glowMat);
    m.name = 'torso_cyanGlow';
    root.userData.rig.torso.add(m);
    root.userData.parts.push(m);
  }
  if (extraGlowWeapon.length) {
    const g = mergeGeometries(extraGlowWeapon, false);
    const m = new THREE.Mesh(g, glowMat);
    m.name = 'weapon_cyanGlow';
    root.userData.rig.weapon.add(m);
    root.userData.parts.push(m);
  }

  root.traverse((m) => {
    if (m.isMesh && m.material) {
      m.material.metalness = 0;
    }
  });

  return root;
}

// ============================================================================
// 2. HIDER SPIRIT — `cloud_crystal` (`Cloud-Crystal Spirit`)
// ============================================================================
export function buildMapHider(THREE, _opts = {}) {
  const root = buildRiggedHiderSpirit(THREE, HIDER_DEF.id, HIDER_DEF.color, (H) => {
    const { torso, crest, paint, std, mk, paintGeo, surf, normal, ell, V3 } = H;
    const glowMat = getCyanGlowMat(THREE);

    const prep = (geo, colFn) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) {
        if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) {
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      }
      return paintGeo(g, colFn);
    };

    const xf = (geo, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
      geo.applyMatrix4(new THREE.Matrix4().compose(
        V3(px, py, pz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
        V3(sx, sy, sz)
      ));

    const conformBelly = (geo, y0, th0, off = 0.010) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const Y = Math.min(0.88, Math.max(0.06, y0 + p.getY(i)));
        const rApprox = Math.max(0.14, Math.hypot(surf(Y, 0).x, surf(Y, 0).z) || 0.30);
        const th = th0 + p.getX(i) / rApprox;
        const q = surf(Y, th).addScaledVector(normal(Y, th), off + p.getZ(i));
        p.setXYZ(i, q.x, q.y, q.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const SKY_FUR = 0x8cc0e6, SKY_TOP = 0x9cd0f2, CREAM = 0xfcf3e0, CREAM_SH = 0xf0e2c8;
    const BRONZE = 0xdea448, BRONZE_DK = 0x6e4a1c, GOLD_HI = 0xfce08c;
    const LEAF = 0x76bc46, SKY_LINE = 0x5282b0, SKY_FILL = 0xe4f3fd;

    // Seamlessly paint the chubby spirit body & arm paws with sky-blue back/head/flanks
    // blending softly into a plush warm-cream face mask & round cream tummy!
    torso.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name === 'body') {
        o.material = std({ roughness: 0.89 });
        const g = o.geometry;
        const P = g.attributes.position;
        const cSky = new THREE.Color(SKY_FUR);
        const cTop = new THREE.Color(SKY_TOP);
        const cCream = new THREE.Color(CREAM);
        const cCreamSh = new THREE.Color(CREAM_SH);
        const cOut = new THREE.Color();
        const cols = new Float32Array(P.count * 3);

        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
          cOut.copy(cSky).lerp(cTop, Math.min(1, Math.max(0, (y - 0.35) / 0.55)));
          if (z > 0.04) {
            // Lower cream belly oval (y ~ 0.05..0.48) + upper cream face oval (y ~ 0.52..0.78)
            const dBelly = Math.hypot(x / 0.255, (y - 0.255) / 0.225);
            const dFace  = Math.hypot(x / 0.195, (y - 0.645) / 0.145);
            const zFade  = Math.min(1, Math.max(0, (z - 0.06) / 0.12));
            const kBelly = Math.min(1, Math.max(0, (1.06 - dBelly) / 0.24)) * zFade;
            const kFace  = Math.min(1, Math.max(0, (1.06 - dFace) / 0.26)) * zFade;
            const k = Math.max(kBelly, kFace);
            if (k > 0) {
              const target = y < 0.18 ? cCreamSh : cCream;
              cOut.lerp(target, k);
            }
          }
          cols[i * 3] = cOut.r; cols[i * 3 + 1] = cOut.g; cols[i * 3 + 2] = cOut.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      } else if (o.name === 'armL' || o.name === 'armR') {
        o.material = std({ roughness: 0.89 });
        const g = o.geometry;
        const P = g.attributes.position;
        const cSky = new THREE.Color(SKY_FUR), cCream = new THREE.Color(CREAM), cT = new THREE.Color();
        const cols = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) {
          const y = P.getY(i);
          const t = Math.min(1, Math.max(0, (-y - 0.07) / 0.08));
          cT.copy(cSky).lerp(cCream, t);
          cols[i * 3] = cT.r; cols[i * 3 + 1] = cT.g; cols[i * 3 + 2] = cT.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      }
    });

    // 1. Cuddly Drooping Lop-Wing Ears + Fluffy Crown & Hip Fur Tufts
    const furParts = [];
    for (const sx of [-1, 1]) {
      // Smooth lop-wing upper ear (grading from sky-blue root to warm cream mid)
      const earRoot = prep(ell(0.066, 0.155, 0.044, 14, 10), (x, y) => {
        const t = Math.min(1, Math.max(0, (-y + 0.02) / 0.14));
        return new THREE.Color(SKY_FUR).lerp(new THREE.Color(CREAM), t);
      });
      furParts.push(xf(earRoot, sx * 0.245, 0.745, -0.005, 0.04, -sx * 0.10, sx * 0.64));

      // 3 Soft cream feathered wing-tips fanning gently at the bottom of each lop ear!
      for (let f = 0; f < 3; f++) {
        const len = 0.082 - f * 0.011;
        furParts.push(xf(
          prep(ell(0.030, len, 0.022, 10, 7), CREAM),
          sx * (0.335 - f * 0.024), 0.645 - f * 0.022, 0.004 - f * 0.010,
          0.04, -sx * 0.10, sx * (0.68 - f * 0.14)
        ));
      }

      // Soft sky-blue hip fur tufts for chubby storybook fluffiness
      furParts.push(xf(prep(ell(0.048, 0.028, 0.038, 9, 6), SKY_FUR), sx * 0.345, 0.24, 0.04, 0, 0, -sx * 0.45));
      furParts.push(xf(prep(ell(0.044, 0.025, 0.035, 9, 6), SKY_FUR), sx * 0.335, 0.18, 0.05, 0, 0, -sx * 0.38));
    }
    for (const [dx, dz, rz] of [[-0.058, 0.04, 0.35], [0.058, 0.04, -0.35], [0, -0.045, 0]]) {
      furParts.push(xf(prep(ell(0.048, 0.034, 0.042, 9, 6), SKY_TOP), dx, 0.905, dz, 0, 0, rz));
    }
    mk(mergeGeometries(furParts, false), std({ roughness: 0.89 }), torso, 'furAndEars');

    // 2. Bronze Celestian Rune Collar + Square-Spiral Meander Plaques + Side Sprout Leaves!
    const collarParts = [];
    const collarRing = prep(new THREE.TorusGeometry(0.262, 0.034, 9, 30), BRONZE);
    collarRing.rotateX(PI / 2 + 0.08);
    collarRing.scale(1.02, 1.0, 0.96);
    collarRing.translate(0, 0.492, 0.008);
    collarParts.push(collarRing);

    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      if (Math.cos(a) > 0.84) continue;
      const gx = Math.sin(a) * 0.286, gz = Math.cos(a) * 0.272 + 0.008, gy = 0.492 - Math.cos(a) * 0.022;
      collarParts.push(xf(prep(new THREE.BoxGeometry(0.044, 0.040, 0.016), BRONZE_DK), gx, gy, gz, 0, a, 0));
      collarParts.push(xf(prep(new THREE.BoxGeometry(0.028, 0.024, 0.020), GOLD_HI), gx, gy, gz, 0, a, 0));
      collarParts.push(xf(prep(new THREE.BoxGeometry(0.014, 0.012, 0.023), BRONZE_DK), gx, gy, gz, 0, a, 0));
    }

    const bezel = prep(new THREE.CylinderGeometry(0.064, 0.068, 0.030, 20), BRONZE);
    bezel.rotateX(PI / 2 + 0.10);
    bezel.translate(0, 0.476, 0.280);
    collarParts.push(bezel);
    const bezelRim = prep(new THREE.TorusGeometry(0.054, 0.009, 6, 18), GOLD_HI);
    bezelRim.rotateX(0.10);
    bezelRim.translate(0, 0.475, 0.294);
    collarParts.push(bezelRim);

    for (const sx of [-1, 1]) {
      collarParts.push(xf(prep(ell(0.042, 0.016, 0.012, 8, 6), LEAF), sx * 0.295, 0.472, 0.095, 0, sx * 0.45, -sx * 0.38));
    }
    mk(mergeGeometries(collarParts, false), std({ roughness: 0.72 }), torso, 'runeCollar');

    // 3. Winged-Cloud Belly Emblem conformed cleanly onto the plush cream tummy!
    const emblemParts = [];
    const addCloudPuff = (x, y, rx, ry) => {
      emblemParts.push(conformBelly(xf(prep(ell(rx + 0.009, ry + 0.009, 0.004, 14, 8), SKY_LINE), x, y, 0), 0.300, 0, 0.007));
      emblemParts.push(conformBelly(xf(prep(ell(rx, ry, 0.005, 14, 8), SKY_FILL), x, y, 0.002), 0.300, 0, 0.008));
    };
    addCloudPuff( 0.0,   0.008, 0.044, 0.038);
    addCloudPuff(-0.046, -0.006, 0.035, 0.029);
    addCloudPuff( 0.046, -0.006, 0.035, 0.029);
    addCloudPuff( 0.0,  -0.016, 0.054, 0.025);

    for (const sx of [-1, 1]) {
      for (let w = 0; w < 3; w++) {
        const wx = sx * (0.096 + w * 0.008), wy = 0.020 - w * 0.022;
        const rotZ = -sx * (0.28 + w * 0.24);
        const len = 0.048 - w * 0.007;
        emblemParts.push(conformBelly(
          xf(prep(ell(len + 0.007, 0.017, 0.004, 10, 6), SKY_LINE), wx, wy, 0, 0, 0, rotZ),
          0.300, 0, 0.007
        ));
        emblemParts.push(conformBelly(
          xf(prep(ell(len, 0.011, 0.005, 10, 6), SKY_FILL), wx, wy, 0.002, 0, 0, rotZ),
          0.300, 0, 0.008
        ));
      }
    }
    mk(mergeGeometries(emblemParts, false), std({ roughness: 0.82 }), torso, 'bellyEmblem');

    // 4. Collar Central Glowing Cyan Skyglass Gem
    const collarGem = prepCyanGeo(THREE, xf(new THREE.SphereGeometry(0.044, 14, 10), 0, 0.475, 0.292, 0.1, 0, 0, 1, 1, 0.58), 0x24d4ff, 0xe8feff);
    mk(collarGem, glowMat, torso, 'collarGem');

    // 5. Crest: Tall Radiant Cyan Crystal Sprout + Base Leaves + Tilted Mossy Celestian Stone Halo!
    const crystalCluster = mergeGeometries([
      xf(makeCrystalGeo(THREE, 0.056, 0.188, 0.050), 0, 0.052, 0),
      xf(makeCrystalGeo(THREE, 0.040, 0.125, 0.038), -0.064, 0.032, 0.008, 0.08, 0.2,  0.48),
      xf(makeCrystalGeo(THREE, 0.040, 0.125, 0.038),  0.064, 0.032, 0.008, 0.08,-0.2, -0.48),
      xf(makeCrystalGeo(THREE, 0.028, 0.082, 0.026),  0.0,   0.022, 0.052, 0.44, 0, 0),
      xf(makeCrystalGeo(THREE, 0.026, 0.076, 0.026),  0.0,   0.022,-0.048,-0.42, 0, 0),
    ], false);
    const crystalMesh = mk(crystalCluster, glowMat, crest, 'crystalCluster');

    const sproutLeaves = mergeGeometries([
      xf(prep(ell(0.016, 0.048, 0.011, 7, 5), LEAF), -0.052, 0.020, 0.038, 0.35, 0.3,  0.65),
      xf(prep(ell(0.016, 0.048, 0.011, 7, 5), LEAF),  0.052, 0.020, 0.038, 0.35,-0.3, -0.65),
      xf(prep(ell(0.014, 0.038, 0.010, 7, 5), 0x8ad056), 0.0, 0.018, 0.056, 0.55, 0, 0),
    ], false);
    mk(sproutLeaves, std({ roughness: 0.84 }), crest, 'crystalSproutLeaves');

    const haloGrp = new THREE.Group();
    haloGrp.name = 'haloRing';
    haloGrp.position.set(0, 0.238, 0);
    haloGrp.rotation.set(0.18, 0.25, -0.10);
    crest.add(haloGrp);

    const haloParts = [];
    const STONE = 0xeadcc0, STONE_DK = 0x7c6a50, MOSS = 0x82c848;
    const N_SEG = 20, R_HALO = 0.242;
    for (let i = 0; i < N_SEG; i++) {
      const a = (i / N_SEG) * TAU;
      const hx = Math.sin(a) * R_HALO, hz = Math.cos(a) * R_HALO;
      haloParts.push(xf(prep(new THREE.BoxGeometry(0.084, 0.054, 0.060), (x, y) =>
        new THREE.Color(STONE).multiplyScalar(0.92 + (y / 0.054 + 0.5) * 0.14)
      ), hx, 0, hz, 0, a, 0));
      const rx = Math.sin(a) * (R_HALO + 0.031), rz = Math.cos(a) * (R_HALO + 0.031);
      haloParts.push(xf(prep(new THREE.BoxGeometry(0.058, 0.038, 0.008), STONE_DK), rx, 0, rz, 0, a, 0));
      haloParts.push(xf(prep(new THREE.BoxGeometry(0.035, 0.021, 0.011), STONE), rx, 0, rz, 0, a, 0));
      haloParts.push(xf(prep(new THREE.BoxGeometry(0.017, 0.011, 0.014), STONE_DK), rx, 0, rz, 0, a, 0));
    }

    for (const [a, s, drops] of [[0.55, 1.15, 4], [2.15, 0.95, 3], [3.85, 1.10, 4], [5.25, 0.85, 3]]) {
      const mx = Math.sin(a) * R_HALO, mz = Math.cos(a) * R_HALO;
      haloParts.push(xf(prep(ell(0.054 * s, 0.025 * s, 0.042 * s, 9, 6), MOSS), mx, 0.029, mz, 0, a, 0));
      for (let d = 0; d < drops; d++) {
        haloParts.push(xf(
          prep(ell(0.013, 0.024, 0.008, 7, 5), d % 2 ? 0x8cd054 : MOSS),
          mx * 1.03, -0.029 - d * 0.030, mz * 1.03, 0, a + d * 0.55, 0.22
        ));
      }
    }
    mk(mergeGeometries(haloParts, false), std({ roughness: 0.88 }), haloGrp, 'haloStone');

    return (t, ph, k, idle) => {
      haloGrp.rotation.y = 0.25 + t * 0.52;
      haloGrp.rotation.z = Math.sin(t * 1.4) * 0.06 - 0.10;
      haloGrp.rotation.x = Math.cos(t * 1.1) * 0.05 + 0.16;
      haloGrp.position.y = 0.238 + Math.sin(t * 2.4) * 0.016 * (0.6 + 0.4 * idle);
      const pulse = 1 + Math.sin(t * 3.2) * 0.035;
      crystalMesh.scale.set(pulse, 1 + Math.sin(t * 3.2 + 0.6) * 0.045, pulse);
    };
  });

  // Recolor chubby feet to warm cream (`0xfaf0dc`) & enforce metalness: 0 on ALL hider meshes!
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (m.name === 'footL' || m.name === 'footR') {
      m.material = new THREE.MeshStandardMaterial({
        color: 0xfaf0dc,
        map: m.material.map || null,
        vertexColors: true,
        roughness: 0.89,
        metalness: 0,
      });
    }
    if (m.material) {
      m.material.metalness = 0;
    }
  });

  return root;
}
