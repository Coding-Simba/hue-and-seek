/* Hue & Seek — Map 5: Tinyfolk Secret Hollow (`tinyfolk`) — 3 Seekers & 1 Hider Spirit
 * Original tiny-folk garden designs (assets/maps/tinyfolk/characters_sheet.png).
 * <= 16 draw calls per character, rigged 2-bone IK arms, custom Tinyfolk blasters & Clover-Dew Spirit.
 */
import {
  buildRiggedSeeker,
  buildRiggedHiderSpirit,
  mergeGeometries,
} from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

export const SEEKER_DEFS = [
  { id: 'tinyfolk_scout', label: 'Tinyfolk Scout' },
  { id: 'beetle_ranger', label: 'Beetle-Shell Ranger' },
  { id: 'sewing_tinker', label: 'Pocket-Watch Tinker' },
];

export const HIDER_DEF = {
  id: 'clover_dew',
  label: 'Clover-Dew Spirit',
  color: 0xa8d080,
};

// Torso surface helper matching seekers.js convention
function rAtProfile(P, y) {
  for (let i = 0; i < P.length - 1; i++) {
    const [r0, y0] = P[i], [r1, y1] = P[i + 1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) {
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return P[P.length - 1][0];
}

function onTorso(THREE, P, sz, az, y, out = 0) {
  const r = rAtProfile(P, y) + out;
  return new THREE.Vector3(r * Math.sin(az), y, r * sz * Math.cos(az));
}

// Safe mergeGeometries wrapper that normalizes indexed & non-indexed geometries and attributes
function mergeSafe(geos) {
  const clean = geos.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  const out = mergeGeometries(clean, false);
  clean.forEach((g) => g.dispose());
  return out;
}

// Sculpted heart-notched clover or pointed botanical leaf geometry (with vertex colors when baseHex/tipHex passed)
function makeBotanicalLeaf(THREE, len, halfW, thick, { notch = 0, curl = 0.08, cup = 0.16, baseHex = null, tipHex = null } = {}) {
  const g = new THREE.SphereGeometry(1, 12, 10);
  const p = g.attributes.position;
  const cols = baseHex != null ? new Float32Array(p.count * 3) : null;
  const c0 = baseHex != null ? new THREE.Color(baseHex) : null;
  const c1 = tipHex != null ? new THREE.Color(tipHex) : null;
  const cTmp = new THREE.Color();

  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = Math.max(0, Math.min(1, (y + 1) * 0.5));
    const env = Math.sqrt(Math.max(0, 1 - y * y));
    const ux = env > 1e-5 ? x / env : 0;
    const uz = env > 1e-5 ? z / env : 0;
    let wProf = Math.pow(s, 0.55) * Math.pow(Math.max(0, 1 - s), notch > 0 ? 0.32 : 0.82) * 1.85;
    if (notch > 0) wProf = Math.sin(Math.min(1, s * 1.05) * PI * 0.86) * (0.44 + 0.66 * s);
    let zOut = s * len;
    if (notch > 0 && s > 0.62) {
      const dip = Math.max(0, 1 - Math.abs(ux) * 2.15);
      zOut -= dip * notch * len * Math.pow((s - 0.62) / 0.38, 1.3);
    }
    const wx = ux * wProf * halfW;
    const wy = uz * Math.sin(s * PI) * thick + cup * Math.abs(ux) * halfW * 0.45 - curl * s * s * len;
    p.setXYZ(i, wx, wy, zOut);

    if (cols) {
      cTmp.copy(c0).lerp(c1, s * 0.82 + Math.abs(ux) * 0.18);
      // Pale midrib & chevron highlight on clover leaves
      const chevron = notch > 0 && Math.abs(s - 0.45 - Math.abs(ux) * 0.16) < 0.055;
      if ((Math.abs(ux) < 0.11 && s > 0.08 && s < 0.88) || chevron) {
        cTmp.lerp(new THREE.Color(0xdcf59e), 0.42);
      }
      cols[i * 3] = cTmp.r;
      cols[i * 3 + 1] = cTmp.g;
      cols[i * 3 + 2] = cTmp.b;
    }
  }
  if (cols) g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

const SEEKER_DIMS = {
  tinyfolk_scout: {
    main: 0x5877c2,
    hipY: 0.60,
    legX: 0.09,
    neckY: 1.12,
    sh: [0.19, 1.05],
    a: 0.235,
    b: 0.225,
    tw: -0.28,
    twAim: -0.44,
    head: { c: [0, 1.34, 0.015], r: 0.20, s: [1.0, 0.95, 0.94] },
    rest: { p: [-0.035, 0.85, 0.19], r: [0.03, 0, 0] },
    aim: { p: [-0.055, 0.99, 0.24], r: [0, 0, 0] },
    gripF: [0, 0.01, 0.19],
    nozzle: [0, 0.085, 0.48],
    pole: [0.55, -0.6, -0.55],
  },
  beetle_ranger: {
    main: 0x3e6e42,
    hipY: 0.61,
    legX: 0.095,
    neckY: 1.14,
    sh: [0.20, 1.07],
    a: 0.245,
    b: 0.235,
    tw: -0.28,
    twAim: -0.44,
    head: { c: [0, 1.36, 0.015], r: 0.198, s: [0.99, 0.96, 0.95] },
    rest: { p: [-0.035, 0.85, 0.20], r: [0.02, 0, 0] },
    aim: { p: [-0.055, 1.00, 0.25], r: [0, 0, 0] },
    gripF: [0, 0.01, 0.20],
    nozzle: [0, 0.08, 0.49],
    pole: [0.55, -0.6, -0.55],
  },
  sewing_tinker: {
    main: 0xc49456,
    hipY: 0.56,
    legX: 0.112,
    neckY: 1.09,
    sh: [0.245, 1.03],
    a: 0.25,
    b: 0.24,
    tw: -0.24,
    twAim: -0.38,
    head: { c: [0, 1.30, 0.02], r: 0.21, s: [1.07, 0.95, 0.96] },
    rest: { p: [-0.03, 0.82, 0.24], r: [0.02, 0, 0] },
    aim: { p: [-0.045, 0.95, 0.27], r: [-0.02, 0, 0] },
    gripF: [0, 0.01, 0.19],
    nozzle: [0, 0.085, 0.47],
    pole: [0.6, -0.55, -0.5],
  },
};

function zeroMetalness(root) {
  root.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mt of mats) {
      if (mt && typeof mt.metalness === 'number' && mt.metalness !== 0) {
        mt.metalness = 0;
        mt.needsUpdate = true;
      }
    }
  });
  return root;
}

export function buildMapSeeker(THREE, kindOpt = 'tinyfolk_scout') {
  const req = typeof kindOpt === 'object' && kindOpt !== null ? kindOpt.kind : kindOpt;
  const kind = SEEKER_DIMS[req] ? req : 'tinyfolk_scout';
  const D = SEEKER_DIMS[kind];

  const seekerGroup = buildRiggedSeeker(THREE, kind, D, (K) => {
    const {
      SKIN, xf, sph, lathe, tor, rbox, tube, seg, cylz, qn,
      add, dec, lock, buildFace, buildArm, buildBoot,
    } = K;
    const V = THREE.Vector3;

    // ========================================================================
    // 1. TINYFOLK SCOUT ('tinyfolk_scout', main: 0x5877c2)
    //    Forget-me-not blue tunic, mustard yarn belt, walnut-brown twin braids & an acorn-cap beret
    // ========================================================================
    if (kind === 'tinyfolk_scout') {
      const WALNUT = 0x4e3626, WALNUT_HI = 0x6a4a32, CREAM = 0xf4e7ce, TUNIC = 0x5877c2, MUSTARD = 0xe0a83a;
      const LEATHER = 0x865430, LEATHER_DK = 0x623b20, BRASS = 0xe5b84b, ACORN = 0x8a5a30, ACORN_DK = 0x6b4424;

      // Legs: dark charcoal-brown shorts cuffs, bare shins, ribbed cream socks & mustard-laced leather boots
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.61, 0], [x, 0.47, 0.005], 0.078, 0.074), 0x4c3d38);
        add(gk, 'cloth', tor(0.075, 0.012, [x, 0.475, 0.005], [PI / 2, 0, 0], 1, TAU, 6, 14), 0x3b2f2b);
        add(gk, 'cloth', seg([x, 0.47, 0.005], [x, 0.25, 0.004], 0.054, 0.048), SKIN);
        // Thick folded cream ankle socks
        add(gk, 'cloth', lathe([[0.058, 0.20], [0.072, 0.23], [0.074, 0.285], [0.064, 0.295]], [x, 0, 0], 1, null, 16), CREAM);
        buildBoot(gk, x, 0x6e472b, 0x3b2416, 0x855838, 0.215);
        // Criss-cross mustard boot laces & bow
        for (const ly of [0.11, 0.145, 0.18]) {
          add(gk, 'cloth', rbox(0.068, 0.012, 0.016, 0.004, [x, ly, 0.066]), MUSTARD);
        }
        for (const lx of [-1, 1]) {
          add(gk, 'cloth', tor(0.018, 0.005, [x + lx * 0.02, 0.198, 0.068], [0.2, 0, lx * 0.4], 1, TAU, 5, 10), MUSTARD);
        }
      }

      // Forget-me-not blue A-line Tinyfolk tunic ('paint' so main = 0x5877c2 tints cleanly!)
      const side = [
        [0.268, 0.52], [0.278, 0.55], [0.246, 0.66], [0.202, 0.77],
        [0.214, 0.89], [0.205, 1.00], [0.182, 1.06], [0.125, 1.11], [0.075, 1.13],
      ];
      const sz = 0.86;
      add('torso', 'paint', lathe([[0, 0.56], [0.21, 0.515], ...side, [0, 1.135]], [0, 0, 0], [1, 1, sz], null, 26));
      add('torso', 'cloth', seg([0, 1.06, 0], [0, 1.20, 0.01], 0.048, 0.048), SKIN);
      add('torso', 'cloth', tor(0.088, 0.022, [0, 1.115, 0.015], [PI / 2 - 0.25, 0, 0], 1, TAU, 6, 18), CREAM);

      // Cream zig-zag embroidery along tunic hem
      for (let i = 0; i < 16; i++) {
        const az = (i / 16) * TAU;
        const p = onTorso(THREE, side, sz, az, 0.555, 0.005);
        add('torso', 'cloth', rbox(0.032, 0.014, 0.012, 0.004, p, [0, az, (i % 2 ? 0.45 : -0.45)]), CREAM);
      }

      // Braided mustard-and-cream twisted yarn belt with double tassels on front-left (+X)!
      for (let k = 0; k < 20; k++) {
        const az = (k / 20) * TAU;
        const p = onTorso(THREE, side, sz, az, 0.772 + (k % 2) * 0.008, 0.016);
        add('torso', 'cloth', sph(1, p, [0.028, 0.022, 0.022], [0, az, 0.5], 8, 6), k % 2 === 0 ? CREAM : MUSTARD);
      }
      // Yarn knot & 2 braided tassel tails hanging down at az = +0.36
      const knotP = onTorso(THREE, side, sz, 0.36, 0.768, 0.028);
      add('torso', 'cloth', sph(0.032, knotP, 1, null, 10, 8), CREAM);
      for (const [ tIdx, dx, dz, yEnd ] of [[0, -0.018, 0.018, 0.60], [1, 0.026, 0.008, 0.625]]) {
        for (let b = 0; b < 5; b++) {
          const f = (b + 0.5) / 5;
          const by = 0.75 - f * (0.75 - yEnd);
          add('torso', 'cloth', sph(0.016, [knotP.x + dx * (0.5 + f), by, knotP.z + dz + f * 0.02], 1, null, 7, 5), (b + tIdx) % 2 === 0 ? MUSTARD : CREAM);
        }
        // Fluffy cream yarn tassel skirt
        const tx = knotP.x + dx * 1.5, tz = knotP.z + dz + 0.022;
        add('torso', 'cloth', lathe([[0, 0], [0.030, 0.006], [0.022, 0.055], [0, 0.068]], [tx, yEnd - 0.058, tz], 1, null, 12), CREAM);
      }

      // Front-right (-X) patch pocket with golden leaf motif + mini cream thread spool peeking out!
      const pkP = onTorso(THREE, side, sz, -0.45, 0.64, 0.014);
      add('torso', 'cloth', rbox(0.095, 0.095, 0.024, 0.008, pkP, [0.12, -0.42, 0]), 0x4763a8);
      add('torso', 'cloth', sph(1, [pkP.x, pkP.y, pkP.z + 0.014], [0.012, 0.026, 0.006], [0, -0.42, 0], 8, 6), 0xe8b844);
      add('torso', 'cloth', sph(1, [pkP.x - 0.018, pkP.y - 0.006, pkP.z + 0.012], [0.010, 0.020, 0.006], [0, -0.42, 0.6], 8, 6), 0xe8b844);
      add('torso', 'cloth', sph(1, [pkP.x + 0.018, pkP.y - 0.006, pkP.z + 0.012], [0.010, 0.020, 0.006], [0, -0.42, -0.6], 8, 6), 0xe8b844);
      // Mini thread spool peeking out of pocket
      add('torso', 'cloth', seg([pkP.x, pkP.y + 0.045, pkP.z], [pkP.x - 0.006, pkP.y + 0.092, pkP.z + 0.004], 0.022, 0.022, 12), CREAM);
      add('torso', 'cloth', tor(0.023, 0.006, [pkP.x - 0.006, pkP.y + 0.092, pkP.z + 0.004], [PI / 2, 0, 0], 1, TAU, 5, 12), 0xc89356);

      // Crossbody leather strap + stitched leather satchel bag on right hip (-X)
      const strapPts = [
        new V(0.14, 1.09, 0.07),
        new V(0.03, 0.95, 0.19),
        new V(-0.14, 0.80, 0.16),
        new V(-0.24, 0.69, 0.02),
        new V(-0.16, 0.84, -0.17),
        new V(0.04, 1.00, -0.18),
        new V(0.14, 1.09, -0.05),
      ];
      add('torso', 'cloth', tube(strapPts, 0.014, 24, 6, true), LEATHER_DK);
      const bagP = [-0.255, 0.66, 0.0];
      add('torso', 'cloth', rbox(0.095, 0.165, 0.185, 0.026, bagP, [0.06, 0.15, 0.12]), LEATHER);
      add('torso', 'cloth', rbox(0.102, 0.085, 0.192, 0.024, [-0.26, 0.705, 0.0], [0.06, 0.15, 0.14]), LEATHER_DK);
      for (const bz of [-0.048, 0.048]) {
        add('torso', 'cloth', rbox(0.022, 0.032, 0.022, 0.005, [-0.305, 0.66, bz], [0, 0.15, 0]), BRASS);
      }

      // Arms with blue short sleeves & rolled cream blouse cuffs
      for (const s of [-1, 1]) {
        buildArm(s, { upper: TUNIC, r1: 0.062, puff: 0.074, sleeve: 0.76, cuffU: CREAM, rs: 0.044, hand: 0.048 });
      }

      // Expressive freckled face + walnut-brown hair, twin bead-tied braids & a tilted acorn-cap beret!
      buildFace({ iris: 0x3e5a34, iris2: 0x9cc46a, brow: 0x3c2a1c, browRoll: 0.24, mouth: 'laugh' });
      for (const [fx, fy] of [[-0.50, -0.20], [-0.62, -0.14], [0.50, -0.20], [0.62, -0.14]]) {
        dec('head', 'cloth', fx, fy, 0.004, [0.008, 0.007, 0.004], 0xd89a78, 0);
      }

      // Walnut hair dome, parted bangs & ear locks
      add('head', 'cloth', sph(1, [0, 1.37, -0.03], [0.214, 0.20, 0.20], null, 20, 14), WALNUT);
      for (const [az, el, l, roll] of [
        [-0.58, 0.44, 0.055, 0.28], [-0.30, 0.49, 0.062, 0.18], [-0.02, 0.51, 0.058, -0.12],
        [0.28, 0.48, 0.058, -0.22], [0.56, 0.42, 0.052, -0.30],
      ]) {
        lock(az, el, 0.012, [0.058, l, 0.030], WALNUT_HI, roll, -0.16);
      }
      for (const s of [-1, 1]) {
        lock(s * 1.05, 0.10, 0.014, [0.062, 0.088, 0.036], WALNUT, -s * 0.15, -0.22);
        // Short plump braid hanging in front of each shoulder, tied with a mustard yarn bead
        for (let b = 0; b < 4; b++) {
          add('head', 'cloth', sph(1, [s * (0.196 + b * 0.006), 1.262 - b * 0.046, 0.030 + b * 0.008], [0.036 - b * 0.003, 0.032, 0.034 - b * 0.003], null, 9, 7), b % 2 ? WALNUT_HI : WALNUT);
        }
        add('head', 'cloth', sph(0.022, [s * 0.218, 1.086, 0.060], 1, null, 8, 6), MUSTARD);
        add('head', 'cloth', sph(1, [s * 0.220, 1.050, 0.064], [0.020, 0.030, 0.020], null, 8, 6), WALNUT_HI);
      }

      // Acorn-cap beret: scaly brown cup sitting on the crown with a curled stem
      add('head', 'cloth', lathe([[0.150, 1.455], [0.214, 1.470], [0.226, 1.500], [0.196, 1.552], [0.126, 1.590], [0.040, 1.606], [0, 1.608]], [0, 0, -0.035], [1, 1, 0.95], null, 22), ACORN);
      add('head', 'cloth', tor(0.218, 0.014, [0, 1.478, -0.035], [PI / 2, 0, 0], [1, 0.95, 1], TAU, 6, 22), ACORN_DK);
      for (let ring = 0; ring < 2; ring++) {
        const n = ring === 0 ? 12 : 8, rr = ring === 0 ? 0.196 : 0.128, ry = ring === 0 ? 1.538 : 1.580;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + ring * 0.26;
          add('head', 'cloth', sph(1, [Math.sin(a) * rr, ry, -0.035 + Math.cos(a) * rr * 0.95], [0.030, 0.014, 0.030], null, 7, 5), ACORN_DK);
        }
      }
      add('head', 'cloth', tube([[0, 1.600, -0.035], [0.012, 1.640, -0.040], [0.040, 1.662, -0.048]], 0.013, 8, 6), ACORN_DK);

      // Weapon: Glass-Pipette & Acorn-Tipped Dewdrop Blaster (`nozzle` at [0, 0.085, 0.48])
      add('weapon', 'cloth', rbox(0.046, 0.12, 0.058, 0.018, [0, -0.025, -0.01], [0.36, 0, 0]), LEATHER);
      add('weapon', 'cloth', cylz(0.038, 0.044, -0.09, 0.03, 0, 0.075, 14), BRASS);
      add('weapon', 'cloth', sph(0.040, [0, 0.075, -0.095], 1, null, 12, 8), LEATHER_DK);
      // Fore-grip brass brace at D.gripF [0, 0.01, 0.19]
      add('weapon', 'cloth', rbox(0.042, 0.068, 0.14, 0.014, [0, 0.028, 0.17]), BRASS);
      add('weapon', 'cloth', tor(0.052, 0.009, [0, 0.085, 0.03], null, 1, TAU, 6, 16), BRASS);
      add('weapon', 'cloth', tor(0.048, 0.009, [0, 0.085, 0.27], null, 1, TAU, 6, 16), BRASS);

      // Clear glass pipette chamber + sloshing sky-blue dew + glowing sparkle bubbles!
      add('weapon', 'glass', cylz(0.050, 0.044, 0.03, 0.28, 0, 0.085, 16));
      add('weapon', 'cloth', cylz(0.038, 0.032, 0.045, 0.265, 0, 0.076, 14), 0x5cb8e6);
      for (const [bx, by, bz, br] of [[0.012, 0.092, 0.11, 0.012], [-0.014, 0.086, 0.17, 0.015], [0.008, 0.094, 0.22, 0.010]]) {
        add('weapon', 'glow', sph(br, [bx, by, bz], 1, null, 8, 6), 0xd8f8ff);
      }

      // Textured oak acorn cup muzzle + glistening crystal dewdrop at tip!
      add('weapon', 'cloth', cylz(0.058, 0.064, 0.275, 0.345, 0, 0.085, 16), 0x744a28);
      add('weapon', 'cloth', cylz(0.062, 0.042, 0.345, 0.395, 0, 0.085, 16), 0x8a5830);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        add('weapon', 'cloth', sph(0.014, [Math.cos(a) * 0.058, 0.085 + Math.sin(a) * 0.058, 0.315], 1, null, 6, 5), 0x5e3b1e);
      }
      add('weapon', 'glass', sph(1, [0, 0.085, 0.435], [0.038, 0.038, 0.052], null, 14, 10));
      add('weapon', 'glow', sph(0.020, [0, 0.085, 0.432], 1, null, 10, 8), 0xcff6ff);
    }

    // ========================================================================
    // 2. BEETLE-SHELL RANGER ('beetle_ranger', main: 0x3e6e42)
    // ========================================================================
    if (kind === 'beetle_ranger') {
      const CLOAK = 0x3e6e42, LEAF_LT = 0x82be44, TUNIC = 0xb5a37f, SHORTS = 0x6b5b47;
      const HAIR = 0x2c1f18, GLOVE = 0x3b3c42, LEATHER = 0x6b4526, GOLD = 0xe5b84b;

      // Legs: cargo shorts, cream socks & twine-laced ranger boots with tucked forest leaves!
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.62, 0], [x, 0.42, 0.008], 0.086, 0.082), SHORTS);
        add(gk, 'cloth', lathe([[0.084, 0.41], [0.090, 0.43], [0.088, 0.46]], [x, 0, 0.008], 1, null, 16), 0x827058);
        add(gk, 'cloth', seg([x, 0.42, 0.005], [x, 0.24, 0.004], 0.054, 0.048), SKIN);
        add(gk, 'cloth', lathe([[0.058, 0.20], [0.072, 0.24], [0.072, 0.285]], [x, 0, 0], 1, null, 14), 0xe8dac0);
        buildBoot(gk, x, 0x6e4a2c, 0x3d2716, 0x5c3c22, 0.225);
        // Criss-cross twine boot wraps + perky green leaf tucked into boot top
        for (const ly of [0.10, 0.145, 0.19]) {
          add(gk, 'cloth', rbox(0.072, 0.012, 0.016, 0.004, [x, ly, 0.068], [0, 0, (ly * 20) % 2 > 1 ? 0.25 : -0.25]), 0xd8b478);
        }
        add(gk, 'cloth', sph(1, [x + s * 0.052, 0.235, 0.045], [0.022, 0.045, 0.010], [-0.25, 0, -s * 0.55], 8, 6), LEAF_LT);
      }

      // Inner pleated khaki ranger tunic ('cloth') + flowing stitched leaf cloak ('paint', main = 0x3e6e42)!
      const tunicSide = [[0.22, 0.56], [0.235, 0.64], [0.21, 0.78], [0.215, 0.94], [0.195, 1.05], [0.12, 1.12]];
      add('torso', 'cloth', lathe([[0, 0.57], ...tunicSide, [0, 1.13]], [0, 0, 0], [1, 1, 0.84], null, 22), TUNIC);
      add('torso', 'cloth', seg([0, 1.07, 0], [0, 1.21, 0.01], 0.05, 0.05), SKIN);

      // Flowing green leaf ranger cape around back & sides ('paint' bucket sets userData.body!)
      const capePts = [
        [0.31, 0.44], [0.33, 0.52], [0.305, 0.70], [0.275, 0.88], [0.245, 1.03], [0.175, 1.12], [0.11, 1.15],
      ];
      add('torso', 'paint', lathe(capePts, [0, 0, -0.02], [1, 1, 0.92], null, 24, PI * 0.34, PI * 1.32));
      // Rolled green leaf-collar cowl + golden scarab-beetle clasp at throat
      add('torso', 'paint', tor(0.135, 0.042, [0, 1.105, 0.0], [PI / 2 - 0.22, 0, 0], [1.08, 0.95, 1], TAU, 8, 20));
      add('torso', 'cloth', sph(1, [0, 1.075, 0.168], [0.034, 0.038, 0.018], [-0.2, 0, 0], 10, 8), GOLD);
      for (const sx of [-1, 1]) {
        add('torso', 'cloth', rbox(0.018, 0.008, 0.008, 0.002, [sx * 0.036, 1.08, 0.168], [0, 0, sx * 0.3]), GOLD);
      }
      // Chartreuse leaf-vein trim along cloak hem
      for (let i = 0; i < 9; i++) {
        const az = PI * 0.42 + (i / 8) * (PI * 1.16);
        add('torso', 'cloth', sph(1, [Math.sin(az) * 0.32, 0.48, -0.02 + Math.cos(az) * 0.295], [0.018, 0.046, 0.010], [0, az, 0], 8, 6), LEAF_LT);
      }

      // IRIDESCENT BLUE-EMERALD BEETLE-SHELL RIGHT SHOULDER PAULDRON (-X, viewer's left!)
      const plates = [
        { y: 1.085, x: -0.205, r: 0.135, sy: 0.068, col: 0x24b46c, rz: 0.38 },
        { y: 1.035, x: -0.238, r: 0.145, sy: 0.072, col: 0x1d8ec8, rz: 0.52 },
        { y: 0.980, x: -0.258, r: 0.135, sy: 0.068, col: 0x3b4cb8, rz: 0.66 },
      ];
      for (const pl of plates) {
        add('torso', 'cloth', sph(1, [pl.x, pl.y, 0.01], [pl.r, pl.sy, 0.135], [0.06, 0.12, pl.rz], 16, 10), pl.col);
        add('torso', 'cloth', tor(pl.r * 0.88, 0.009, [pl.x - 0.01, pl.y - 0.018, 0.01], [PI / 2 + 0.1, 0, pl.rz], 1, PI * 1.15, 6, 14), GOLD);
      }

      // Utility belt + glowing golden-amber tree-sap vial on right hip (-X)
      add('torso', 'cloth', lathe([[0.216, 0.75], [0.226, 0.77], [0.224, 0.80], [0.214, 0.81]], [0, 0, 0], [1, 1, 0.86], null, 20), LEATHER);
      add('torso', 'cloth', rbox(0.056, 0.048, 0.02, 0.008, [0, 0.78, 0.195]), GOLD);
      // Leather vial holster & glowing amber sap bottle
      const vx = -0.215, vy = 0.68, vz = 0.095;
      add('torso', 'cloth', rbox(0.088, 0.11, 0.088, 0.02, [vx, vy - 0.02, vz], [0.1, 0.2, 0.18]), LEATHER);
      add('torso', 'glow', xf(new THREE.CylinderGeometry(0.032, 0.032, 0.095, 12), [vx - 0.01, vy + 0.025, vz + 0.01], [0.1, 0.2, 0.18]), 0xf5b82e);
      add('torso', 'cloth', sph(0.022, [vx - 0.015, vy + 0.082, vz + 0.015], [1, 1.2, 1], null, 10, 8), 0xc49a62);

      // Arms with tan rolled sleeves & dark fingerless ranger gloves
      for (const s of [-1, 1]) {
        buildArm(s, { upper: 0xd8ccb2, r1: 0.060, puff: 0.070, sleeve: 0.68, cuffU: 0xc2b294, rs: 0.045, hand: 0.050, glove: GLOVE });
      }

      // Face, spiky espresso hair & oversized stitched green leaf hood w/ sprout tip!
      buildFace({ iris: 0x3b2618, iris2: 0x9c6c3b, brow: 0x241812, browRoll: 0.22, mouth: 'smirk' });
      for (const s of [-1, 1]) {
        for (const [da, de] of [[0, 0], [0.07, 0.02], [0.05, -0.025]]) {
          dec('head', 'cloth', s * (0.48 + da), -0.19 + de, 0.002, [0.005, 0.005, 0.004], 0xd48d6f, 0, 6, 4);
        }
      }
      // Spiky dark bangs peeking out from under the leaf hood
      for (const [az, el, l, r] of [
        [-0.55, 0.42, 0.062, 0.35], [-0.25, 0.48, 0.068, 0.20], [0.05, 0.50, 0.072, -0.22],
        [0.34, 0.46, 0.064, -0.32], [0.62, 0.38, 0.058, -0.35],
      ]) {
        lock(az, el, 0.014, [0.056, l, 0.032], HAIR, r, -0.26);
      }

      // Sculpted green leaf hood helmet wrapping back, sides & pointed brow peak
      add('head', 'cloth', sph(1, [0, 1.38, -0.035], [0.238, 0.232, 0.235], null, 22, 16), CLOAK);
      add('head', 'cloth', tor(0.215, 0.024, [0, 1.36, 0.065], [0.16, 0, -PI * 0.18], [1.02, 1.08, 0.85], PI * 1.35, 8, 22), 0x4f8648);
      // Pointed hood crown + whip-stitched central seam + perky 2-leaf sprout at tip!
      add('head', 'cloth', tube([[0, 1.56, 0.10], [-0.04, 1.61, 0.02], [-0.10, 1.63, -0.02]], 0.038, 10, 8), CLOAK);
      for (let k = 0; k < 5; k++) {
        add('head', 'cloth', rbox(0.028, 0.008, 0.012, 0.003, [0, 1.595 - k * 0.035, 0.04 - k * 0.055], [0.5, 0, 0.3]), 0xd8c896);
      }
      // Sprout stem & two vibrant leaves springing from hood tip
      add('head', 'cloth', tube([[-0.09, 1.62, -0.01], [-0.13, 1.67, 0.01]], 0.010, 8, 6), LEAF_LT);
      add('head', 'cloth', sph(1, [-0.185, 1.665, 0.02], [0.055, 0.024, 0.012], [0.2, 0.2, 0.45], 10, 7), LEAF_LT);
      add('head', 'cloth', sph(1, [-0.095, 1.695, 0.02], [0.036, 0.018, 0.010], [-0.2, 0, -0.45], 10, 7), 0x9cd852);

      // Weapon: Bamboo-Syringe Sap Sprayer (`nozzle` at [0, 0.08, 0.49])
      const BAMBOO = 0x8ea246, BAMBOO_LT = 0xb6a24c;
      add('weapon', 'cloth', rbox(0.046, 0.125, 0.058, 0.018, [0, -0.028, -0.01], [0.35, 0, 0]), LEATHER);
      // Curved brass trigger/pump under-guard loop
      add('weapon', 'cloth', tube([[0, -0.06, 0.01], [0, -0.065, 0.14], [0, 0.03, 0.22]], 0.012, 14, 6), GOLD);
      // Rear bamboo stock & plunger + front bamboo barrel + raised bamboo node rings
      add('weapon', 'cloth', cylz(0.044, 0.046, -0.10, 0.04, 0, 0.08, 14), BAMBOO);
      add('weapon', 'cloth', cylz(0.046, 0.042, 0.24, 0.38, 0, 0.08, 14), BAMBOO);
      for (const nz of [-0.08, 0.035, 0.245, 0.34]) {
        add('weapon', 'cloth', tor(0.048, 0.010, [0, 0.08, nz], null, 1, TAU, 6, 16), BAMBOO_LT);
      }
      // Twine wraps around front grip
      for (const tz of [0.16, 0.185, 0.21]) {
        add('weapon', 'cloth', tor(0.036, 0.008, [0, 0.025, tz], null, 1, TAU, 6, 14), 0xc8a468);
      }
      // Clear glass syringe sap chamber + glowing golden-chartreuse sap inside!
      add('weapon', 'glass', cylz(0.048, 0.048, 0.04, 0.24, 0, 0.08, 16));
      add('weapon', 'glow', cylz(0.037, 0.037, 0.065, 0.23, 0, 0.078, 14), 0xd2d634);
      // Tapered bamboo syringe nozzle tip + tiny sprouting green leaf!
      add('weapon', 'cloth', cylz(0.030, 0.018, 0.38, 0.485, 0, 0.08, 12), BAMBOO_LT);
      add('weapon', 'cloth', tor(0.022, 0.006, [0, 0.08, 0.485], null, 1, TAU, 5, 12), BAMBOO);
      add('weapon', 'cloth', sph(1, [0.025, 0.135, 0.34], [0.018, 0.042, 0.008], [-0.3, 0, -0.6], 8, 6), LEAF_LT);
    }

    // ========================================================================
    // 3. POCKET-WATCH TINKER ('sewing_tinker', main: 0xc49456)
    // ========================================================================
    if (kind === 'sewing_tinker') {
      const TAN = 0xc49456, CREAM = 0xf2e5cc, PANTS = 0x6b5038, HAIR = 0x4c301e;
      const BRASS = 0xe5b84b, COPPER = 0xc97640, PATCH_BL = 0x425b7e, PATCH_RD = 0xb23a32;

      // Legs: baggy patched brown knickerbockers, rolled cuffs & round-toed cobbler boots
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.59, 0], [x, 0.24, 0.01], 0.108, 0.112, 14), PANTS);
        if (s > 0) {
          // Stitched tan knee patch on left leg (+X, viewer's right!)
          add(gk, 'cloth', rbox(0.095, 0.125, 0.028, 0.008, [x + 0.02, 0.37, 0.102], [0, 0.2, 0]), TAN);
        }
        add(gk, 'cloth', lathe([[0.108, 0.18], [0.118, 0.20], [0.118, 0.245], [0.106, 0.258]], [x, 0, 0.01], 1, null, 18), 0xc8b28e);
        buildBoot(gk, x, 0x68462c, 0x3b2616, 0x7d5638, 0.195);
      }

      // Cream craftsman shirt collar + patchwork tan vest/apron ('paint', main = 0xc49456)
      const side = [
        [0.295, 0.54], [0.312, 0.60], [0.305, 0.72], [0.292, 0.85], [0.268, 0.96], [0.225, 1.05], [0.14, 1.10],
      ];
      const sz = 0.86;
      add('torso', 'paint', lathe([[0, 0.56], [0.24, 0.53], ...side, [0, 1.11]], [0, 0, 0], [1, 1, sz], null, 26));
      add('torso', 'cloth', seg([0, 1.04, 0.01], [0, 1.17, 0.02], 0.062, 0.062), SKIN);
      add('torso', 'cloth', tor(0.088, 0.024, [0, 1.095, 0.02], [PI / 2 - 0.2, 0, 0], 1, TAU, 6, 18), CREAM);

      // Blue check & red tartan patchwork squares sewn onto the front of the vest!
      const pBlue = onTorso(THREE, side, sz, -0.34, 0.65, 0.012);
      add('torso', 'cloth', rbox(0.115, 0.125, 0.022, 0.006, pBlue, [0.06, -0.32, 0]), PATCH_BL);
      for (const d of [-0.03, 0.03]) {
        add('torso', 'cloth', rbox(0.118, 0.008, 0.025, 0.002, [pBlue.x, pBlue.y + d, pBlue.z + 0.002], [0.06, -0.32, 0]), CREAM);
      }
      const pRed = onTorso(THREE, side, sz, 0.42, 0.66, 0.012);
      add('torso', 'cloth', rbox(0.11, 0.12, 0.022, 0.006, pRed, [0.06, 0.38, 0]), PATCH_RD);
      for (const d of [-0.028, 0.028]) {
        add('torso', 'cloth', rbox(0.112, 0.008, 0.025, 0.002, [pRed.x, pRed.y + d, pRed.z + 0.002], [0.06, 0.38, 0]), CREAM);
      }

      // GIANT 4-hole golden coat button badge pinned on right chest (-X)!
      const btnP = onTorso(THREE, side, sz, -0.42, 0.96, 0.022);
      add('torso', 'cloth', cylz(0.056, 0.056, -0.012, 0.012, 0, 0, 20).applyMatrix4(
        new THREE.Matrix4().makeRotationY(-0.38).setPosition(btnP.x, btnP.y, btnP.z)
      ), BRASS);
      add('torso', 'cloth', tor(0.050, 0.008, [btnP.x, btnP.y, btnP.z + 0.008], [0, -0.38, 0], 1, TAU, 6, 18), 0xe8b84c);
      for (const [hx, hy] of [[-0.016, -0.016], [0.016, -0.016], [-0.016, 0.016], [0.016, 0.016]]) {
        add('torso', 'cloth', sph(0.007, [btnP.x + hx, btnP.y + hy, btnP.z + 0.015], 1, null, 6, 5), 0x2b1d12);
      }

      // Leather tool holster on right hip (-X) holding golden sewing scissors + red thread spool!
      const hx = -0.285, hy = 0.68, hz = 0.03;
      add('torso', 'cloth', rbox(0.088, 0.145, 0.135, 0.02, [hx, hy, hz], [0, 0.12, 0.08]), 0x764b28);
      // Red thread spool nestled in holster
      add('torso', 'cloth', seg([hx - 0.015, hy - 0.02, hz + 0.025], [hx - 0.02, hy + 0.065, hz + 0.025], 0.034, 0.034, 14), PATCH_RD);
      add('torso', 'cloth', tor(0.036, 0.008, [hx - 0.02, hy + 0.065, hz + 0.025], [PI / 2, 0, 0], 1, TAU, 5, 14), TAN);
      // Golden brass sewing scissors handles sticking proudly out of the pocket!
      for (const szOff of [-0.028, 0.032]) {
        add('torso', 'cloth', tor(0.026, 0.008, [hx - 0.015, hy + 0.125, hz + szOff], [0, PI / 2, 0.15], [1.25, 1, 1], TAU, 6, 14), BRASS);
        add('torso', 'cloth', seg([hx - 0.015, hy + 0.05, hz + szOff * 0.4], [hx - 0.015, hy + 0.105, hz + szOff * 0.8], 0.008, 0.008, 6), BRASS);
      }

      // Sturdy rolled-up cream shirt sleeves on arms
      for (const s of [-1, 1]) {
        buildArm(s, { upper: CREAM, r1: 0.072, puff: 0.084, sleeve: 0.72, cuffU: 0xe2d2b4, rs: 0.052, hand: 0.055 });
      }

      // Jovial smiling face, curly hair, patchwork baker-boy cap & brass watchmaker's loupe!
      buildFace({
        iris: 0x462b19, iris2: 0xb67842, brow: 0x3b2214,
        browSc: [0.052, 0.014, 0.014], browRoll: 0.20, mouth: 'laugh', eyeK: 0.94,
      });
      for (const s of [-1, 1]) {
        for (const [da, de] of [[0, 0], [0.06, 0.02], [0.07, -0.02]]) {
          dec('head', 'cloth', s * (0.56 + da), -0.20 + de, 0.002, [0.005, 0.005, 0.004], 0xd69072, 0, 6, 4);
        }
        // Curly chestnut temple curls
        add('head', 'cloth', sph(0.055, [s * 0.195, 1.33, 0.02], [0.9, 1.0, 1.0], null, 10, 8), HAIR);
        add('head', 'cloth', sph(0.048, [s * 0.18, 1.27, -0.03], 1, null, 10, 8), HAIR);
      }
      for (const [az, el] of [[-0.38, 0.44], [-0.10, 0.47], [0.18, 0.46], [0.42, 0.42]]) {
        lock(az, el, 0.014, [0.056, 0.048, 0.032], HAIR, -az * 0.3, -0.20);
      }
      add('head', 'cloth', sph(1, [0, 1.33, -0.045], [0.22, 0.19, 0.20], null, 16, 12), HAIR);

      // Plump patchwork newsboy cap + curved visor + leather strap + brass watchmaker loupe!
      add('head', 'cloth', sph(1, [-0.01, 1.468, -0.015], [0.255, 0.138, 0.245], [-0.16, 0, 0.12], 20, 14), TAN);
      // Coloured cloth patches & cream cross-stitches prominently visible on front-left of cap crown!
      add('head', 'cloth', sph(1, [-0.125, 1.508, 0.085], [0.108, 0.068, 0.105], [-0.25, 0.2, 0.38], 12, 8), PATCH_BL);
      add('head', 'cloth', sph(1, [-0.065, 1.552, 0.025], [0.105, 0.058, 0.102], [-0.15, 0.1, 0.22], 12, 8), PATCH_RD);
      add('head', 'cloth', rbox(0.095, 0.009, 0.012, 0.003, [-0.125, 1.515, 0.168], [0.2, -0.35, 0.28]), CREAM);
      // Cap visor brim
      add('head', 'cloth', sph(1, [0.02, 1.43, 0.165], [0.165, 0.026, 0.105], [0.18, -0.08, -0.05], 16, 8), 0x76502d);
      // Leather goggle/loupe band + stepped brass watchmaker's magnifying loupe on brow!
      add('head', 'cloth', tor(0.228, 0.016, [0, 1.455, -0.01], [PI / 2 - 0.18, 0, 0.08], [1.02, 0.98, 1], TAU, 6, 22), 0x5c3b20);
      const lx = 0.075, ly = 1.512, lz = 0.185;
      add('head', 'cloth', cylz(0.052, 0.062, lz - 0.055, lz + 0.036, lx, ly, 18), BRASS);
      add('head', 'cloth', tor(0.060, 0.011, [lx, ly, lz + 0.036], null, 1, TAU, 6, 18), 0xefc258);
      add('head', 'glass', cylz(0.050, 0.050, lz + 0.028, lz + 0.044, lx, ly, 16));

      // Weapon: Copper Thimble-Nozzle Mist Cannon (`nozzle` at [0, 0.085, 0.47])
      add('weapon', 'cloth', rbox(0.048, 0.125, 0.062, 0.018, [0, -0.028, -0.01], [0.34, 0, 0]), 0x6e4426);
      add('weapon', 'cloth', cylz(0.052, 0.056, -0.10, 0.03, 0, 0.085, 16), COPPER);
      add('weapon', 'cloth', sph(0.052, [0, 0.085, -0.10], 1, null, 12, 8), BRASS);
      // Curved top brass carry-pipe + underside pressure hose
      add('weapon', 'cloth', tube([[-0.0, 0.13, -0.06], [0, 0.195, -0.01], [0, 0.19, 0.08], [0, 0.13, 0.10]], 0.013, 14, 6), BRASS);
      add('weapon', 'cloth', tube([[0, 0.03, -0.02], [0, -0.045, 0.08], [0, 0.025, 0.22]], 0.015, 14, 6), 0x5a4030);
      add('weapon', 'cloth', tor(0.058, 0.011, [0, 0.085, 0.025], null, 1, TAU, 6, 18), BRASS);
      add('weapon', 'cloth', tor(0.062, 0.012, [0, 0.085, 0.265], null, 1, TAU, 6, 18), BRASS);

      // Clear glass mist chamber + glowing sky-mist core & miniature brass watch gears inside!
      add('weapon', 'glass', cylz(0.058, 0.058, 0.025, 0.265, 0, 0.085, 18));
      add('weapon', 'glow', cylz(0.042, 0.042, 0.045, 0.245, 0, 0.082, 14), 0x9ce2ff);
      add('weapon', 'cloth', tor(0.022, 0.006, [0.01, 0.09, 0.14], [0.4, 0.5, 0], 1, TAU, 5, 12), BRASS);

      // Giant dimpled & perforated copper-brass sewing thimble muzzle diffuser!
      add('weapon', 'cloth', cylz(0.072, 0.064, 0.27, 0.435, 0, 0.085, 20), COPPER);
      add('weapon', 'cloth', sph(1, [0, 0.085, 0.435], [0.064, 0.064, 0.032], null, 16, 10), BRASS);
      add('weapon', 'cloth', tor(0.074, 0.010, [0, 0.085, 0.285], null, 1, TAU, 6, 18), BRASS);
      // Dark perforated mist holes across the thimble front & dimple band
      for (let h = 0; h < 7; h++) {
        const r = h === 0 ? 0 : 0.032;
        const a = (h / 6) * TAU;
        add('weapon', 'cloth', sph(0.0085, [Math.cos(a) * r, 0.085 + Math.sin(a) * r, 0.463], 1, null, 6, 5), 0x261810);
      }
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU + r * 0.26;
          add('weapon', 'cloth', sph(0.008, [Math.cos(a) * 0.068, 0.085 + Math.sin(a) * 0.068, 0.34 + r * 0.05], 1, null, 6, 5), 0x5c2e16);
        }
      }
    }
  });
  return zeroMetalness(seekerGroup);
}

// ============================================================================
// HIDER SPIRIT: Clover-Dew Spirit (`clover_dew`, color: 0xa8d080)
// ============================================================================
export function buildMapHider(THREE) {
  const hiderGroup = buildRiggedHiderSpirit(THREE, HIDER_DEF.id, HIDER_DEF.color, (H) => {
    const { torso, crest, std, mk, paintGeo, place, surf, normal, ell, V3 } = H;

    const torsoParts = [];

    // 1. Soft mossy-green leafy hood/ear lobes framing the sides & back of the bean spirit
    const hoodLobes = [
      [0.98, 0.67, 0.11, -0.32],
      [-0.98, 0.67, 0.11, 0.32],
      [1.65, 0.60, 0.125, -0.25],
      [-1.65, 0.60, 0.125, 0.25],
      [2.45, 0.58, 0.13, 0],
      [-2.45, 0.58, 0.13, 0],
      [PI, 0.57, 0.135, 0],
    ];
    for (const [th, yMid, hw, rz] of hoodLobes) {
      const leafLobe = makeBotanicalLeaf(THREE, 0.24, hw, 0.022, {
        notch: 0, curl: -0.08, cup: 0.18, baseHex: 0x6ea644, tipHex: 0x9cd068,
      });
      leafLobe.rotateX(PI * 0.92);
      const ex = new THREE.Matrix4().makeRotationZ(rz).multiply(new THREE.Matrix4().makeRotationX(-0.22));
      torsoParts.push(place(leafLobe, yMid + 0.10, th, 0.012, ex));
    }

    // 2. Plump warm-cream round belly patch conformed smoothly onto the front belly!
    const bellyPatch = new THREE.SphereGeometry(1, 22, 18, 0, TAU, 0, PI * 0.5);
    bellyPatch.rotateX(PI / 2);
    const bp = bellyPatch.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const ux = bp.getX(i) * 0.215;
      const uy = bp.getY(i) * 0.165;
      const uz = bp.getZ(i) * 0.010;
      const Y = 0.265 + uy;
      const rBody = Math.max(0.08, Math.hypot(surf(Y, 0).x, surf(Y, 0).z));
      const th = ux / rBody;
      const pt = surf(Y, th).addScaledVector(normal(Y, th), 0.002 + uz);
      bp.setXYZ(i, pt.x, pt.y, pt.z);
    }
    bellyPatch.computeVertexNormals();
    torsoParts.push(paintGeo(bellyPatch, (x, y) => {
      const shade = 0.94 + Math.max(0, (y - 0.18) * 0.22);
      return new THREE.Color(0xf8f0d8).multiplyScalar(Math.min(1.03, shade));
    }));

    // 3. Red-berry & 3-leaf twig emblem on the cream belly!
    const stemCurve = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([V3(-0.018, -0.075, 0), V3(0.002, -0.015, 0.003), V3(0.012, 0.048, 0.002)]),
      10, 0.0055, 6, false
    );
    torsoParts.push(place(paintGeo(stemCurve, 0x627c34), 0.275, 0, 0.012));
    for (const [bx, by, sx, sy] of [[-0.022, 0.036, 0, 0.012], [0.012, 0.056, 0.008, 0.02], [0.036, 0.028, 0.006, 0.005]]) {
      const twig = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([V3(sx, sy, 0), V3(bx, by, 0.003)]),
        6, 0.004, 5, false
      );
      torsoParts.push(place(paintGeo(twig, 0x627c34), 0.275, 0, 0.012));
      const berry = paintGeo(ell(0.019, 0.019, 0.013, 10, 8).translate(bx, by, 0.006), (x, y) => (y > by ? 0xe64840 : 0xb82824));
      torsoParts.push(place(berry, 0.275, 0, 0.012));
    }
    for (const [lx, ly, rz, sc] of [[-0.042, -0.015, 1.15, 1], [0.044, -0.022, -1.15, 1], [-0.035, -0.052, 1.75, 0.82]]) {
      const lf = makeBotanicalLeaf(THREE, 0.068 * sc, 0.024 * sc, 0.006, {
        notch: 0, curl: 0.04, cup: 0.12, baseHex: 0x4f862c, tipHex: 0x7cb644,
      });
      lf.rotateX(-PI / 2);
      lf.rotateZ(rz);
      lf.translate(lx, ly, 0.004);
      torsoParts.push(place(lf, 0.275, 0, 0.012));
    }

    // 4. Green leaf collar + giant iridescent mother-of-pearl 4-hole button at throat!
    const collarRing = [];
    for (let k = 0; k < 16; k++) {
      const th = (k / 16) * TAU;
      const p = surf(0.50, th).addScaledVector(normal(0.50, th), 0.014);
      collarRing.push(p);
    }
    torsoParts.push(paintGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(collarRing, true), 32, 0.020, 7, true), 0x568e32));

    for (const sx of [-1, 1]) {
      const colLeaf = makeBotanicalLeaf(THREE, 0.185, 0.058, 0.015, {
        notch: 0, curl: 0.14, cup: 0.20, baseHex: 0x4d882b, tipHex: 0x90ca4a,
      });
      colLeaf.rotateY(sx * (PI * 0.42));
      colLeaf.rotateX(0.38);
      colLeaf.rotateZ(-sx * 0.22);
      torsoParts.push(place(colLeaf, 0.488, sx * 0.18, 0.016));
    }

    // Mother-of-pearl 4-hole coat button clasp at front center of collar (y = 0.488, th = 0)
    const btnGeo = new THREE.CylinderGeometry(0.064, 0.064, 0.022, 24);
    btnGeo.rotateX(PI / 2);
    paintGeo(btnGeo, (x, y) => {
      const r = Math.hypot(x, y);
      if (r > 0.052) return 0xf6efe6;
      // Subtle pearlescent pastel pink / aqua sheen across face
      return new THREE.Color(0xf7ecf0).lerp(new THREE.Color(0xdcf2f5), (x / 0.064 + 1) * 0.5);
    });
    torsoParts.push(place(btnGeo, 0.488, 0, 0.026));
    const btnRim = paintGeo(new THREE.TorusGeometry(0.058, 0.008, 6, 24), 0xfaf4ec);
    torsoParts.push(place(btnRim, 0.488, 0, 0.036));
    for (const [hx, hy] of [[-0.017, -0.017], [0.017, -0.017], [-0.017, 0.017], [0.017, 0.017]]) {
      torsoParts.push(place(paintGeo(ell(0.008, 0.008, 0.005, 8, 6).translate(hx, hy, 0.012), 0x4a382c), 0.488, 0, 0.028));
    }
    // Crossed sewing thread through the buttonholes
    for (const rz of [PI / 4, -PI / 4]) {
      const thd = paintGeo(ell(0.024, 0.0045, 0.004, 8, 6).rotateZ(rz).translate(0, 0, 0.014), 0xd89a6c);
      torsoParts.push(place(thd, 0.488, 0, 0.028));
    }

    mk(mergeSafe(torsoParts), std({ roughness: 0.78 }), torso, 'clover_collar_emblem');

    // 5. CREST: Giant 4-leaf clover umbrella + sparkling crystal dewdrop on top!
    const crestParts = [];
    const stem = paintGeo(new THREE.CylinderGeometry(0.022, 0.028, 0.085, 10).translate(0, 0.03, 0), 0x5c9630);
    crestParts.push(stem);

    for (let l = 0; l < 4; l++) {
      const a = (l / 4) * TAU + PI / 4;
      const leaflet = makeBotanicalLeaf(THREE, 0.285, 0.155, 0.026, {
        notch: 0.25, curl: 0.14, cup: 0.20, baseHex: 0x569e2a, tipHex: 0xa4de54,
      });
      leaflet.rotateX(0.32);
      leaflet.rotateY(a);
      leaflet.translate(0, 0.072, 0);
      crestParts.push(leaflet);
    }
    mk(mergeSafe(crestParts), std({ roughness: 0.72 }), crest, 'clover_umbrella');

    // Giant sparkling multifaceted crystal dewdrop perched in the center of the 4-leaf clover!
    const dewGroup = new THREE.Group();
    dewGroup.name = 'dew_gem';
    dewGroup.position.set(0, 0.135, 0.01);
    crest.add(dewGroup);

    const gemGeo = new THREE.IcosahedronGeometry(0.075, 1);
    gemGeo.scale(1.0, 1.15, 0.95);
    paintGeo(gemGeo, (x, y, z) => {
      const t = (y / 0.08 + 1) * 0.5;
      return new THREE.Color(0xcff0ff).lerp(new THREE.Color(0xffffff), Math.min(1, t * 0.85 + Math.max(0, x * 4) * 0.25));
    });
    const gemMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.14,
      metalness: 0,
      transparent: true,
      opacity: 0.80,
      emissive: 0x8ad8ff,
      emissiveIntensity: 0.38,
    });
    const gemMesh = mk(gemGeo, gemMat, dewGroup, 'dew_crystal');
    gemMesh.castShadow = false;

    // Inner bright star-core + tiny water droplets on the front clover leaves (merged into 1 sparkle mesh)
    const coreGeos = [
      paintGeo(new THREE.OctahedronGeometry(0.038, 0), 0xffffff),
      paintGeo(ell(0.019, 0.014, 0.019, 8, 6).translate(-0.125, -0.105, 0.135), 0xe8fbff),
      paintGeo(ell(0.017, 0.013, 0.017, 8, 6).translate(0.135, -0.102, 0.125), 0xe8fbff),
    ];
    const coreMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0xdff8ff,
      emissiveIntensity: 1.15,
      roughness: 0.22,
      metalness: 0,
    });
    const coreMesh = mk(mergeSafe(coreGeos), coreMat, dewGroup, 'dew_core');
    coreMesh.castShadow = false;

    return (t, ph, walkK) => {
      dewGroup.position.y = 0.125 + Math.sin(t * 3.1) * 0.008 + Math.abs(Math.sin(ph)) * 0.01 * walkK;
      gemMesh.rotation.y = Math.sin(t * 1.4) * 0.28;
    };
  });
  return zeroMetalness(hiderGroup);
}
