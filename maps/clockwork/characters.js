/* Hue & Seek — Map 4 (`clockwork`: Pendulum Square Wizard's Market) Rigged Characters.
 * 3 Storybook Chasers (Seekers) + 1 Ember-Star Hider Spirit (a walking brass lantern) for an original steam-and-magic market town,
 * matching assets/maps/clockwork/characters_sheet.png with <= 16 draw calls per character.
 */
import {
  buildRiggedSeeker,
  buildRiggedHiderSpirit,
  mergeGeometries,
} from '../map_kit.js?v=2';

const PI = Math.PI;

export const SEEKER_DEFS = [
  { id: 'clockwork_wizard', label: 'Clockwork Wizard' },
  { id: 'hatter_milliner', label: 'Milliner Girl' },
  { id: 'royal_cadet', label: 'Royal Clockwork Cadet' },
];

export const HIDER_DEF = {
  id: 'ember_wisp',
  label: 'Ember-Star Spirit',
  color: 0xe2b24e,
};

// ============================================================================
// Small Procedural Shape Helpers (Gears, Stars, Diamonds)
// ============================================================================
function gearShapeGeo(THREE, rOut, rRoot, rHole, teeth = 10, thick = 0.014) {
  const s = new THREE.Shape();
  const step = (PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.66;
    const a4 = a0 + step * 0.78;
    const x0 = Math.cos(a0) * rRoot, y0 = Math.sin(a0) * rRoot;
    if (i === 0) s.moveTo(x0, y0); else s.lineTo(x0, y0);
    s.lineTo(Math.cos(a1) * rRoot, Math.sin(a1) * rRoot);
    s.lineTo(Math.cos(a2) * rOut, Math.sin(a2) * rOut);
    s.lineTo(Math.cos(a3) * rOut, Math.sin(a3) * rOut);
    s.lineTo(Math.cos(a4) * rRoot, Math.sin(a4) * rRoot);
  }
  s.closePath();
  if (rHole > 0.003) {
    const h = new THREE.Path();
    h.absarc(0, 0, rHole, 0, PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: Math.min(0.003, thick * 0.22),
    bevelSize: Math.min(0.003, thick * 0.22),
    bevelSegments: 1,
    curveSegments: 5,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

function starShapeGeo(THREE, pts = 5, rOut = 0.028, rIn = 0.011, thick = 0.008) {
  const s = new THREE.Shape();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * PI * 2 + PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: Math.min(0.0025, thick * 0.25),
    bevelSize: Math.min(0.002, thick * 0.22),
    bevelSegments: 1,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

// ============================================================================
// Seeker Rig Proportions
// ============================================================================
const SEEKER_DIMS = {
  clockwork_wizard: {
    main: 0x3b4d8c,
    hipY: 0.58, legX: 0.095, neckY: 1.11, sh: [0.195, 1.04], a: 0.235, b: 0.225,
    tw: -0.26, twAim: -0.42,
    head: { c: [0, 1.32, 0.015], r: 0.198, s: [1.02, 0.96, 0.95] },
    rest: { p: [-0.04, 0.84, 0.20], r: [0.04, 0, 0] },
    aim: { p: [-0.06, 0.98, 0.25], r: [0, 0, 0] },
    gripF: [0, -0.02, 0.19],
    nozzle: [0, 0.075, 0.46],
    pole: [0.55, -0.6, -0.55],
  },
  hatter_milliner: {
    main: 0x567ab8,
    hipY: 0.57, legX: 0.092, neckY: 1.09, sh: [0.185, 1.02], a: 0.225, b: 0.22,
    tw: -0.22, twAim: -0.35,
    head: { c: [0, 1.30, 0.018], r: 0.196, s: [1.03, 0.95, 0.95] },
    rest: { p: [-0.03, 0.80, 0.23], r: [0, 0, 0] },
    aim: { p: [-0.04, 0.92, 0.26], r: [-0.04, 0, 0] },
    gripF: [0, 0.155, 0.16],
    nozzle: [0, 0.055, 0.46],
    pole: [0.58, -0.55, -0.50],
  },
  royal_cadet: {
    main: 0x9c2f38,
    hipY: 0.63, legX: 0.096, neckY: 1.18, sh: [0.205, 1.11], a: 0.25, b: 0.24,
    tw: -0.28, twAim: -0.44,
    head: { c: [0, 1.38, 0.014], r: 0.192, s: [0.98, 1.0, 0.96] },
    rest: { p: [-0.035, 0.89, 0.20], r: [0.04, 0, 0] },
    aim: { p: [-0.065, 1.06, 0.25], r: [0, 0, 0] },
    gripF: [0, -0.01, 0.22],
    nozzle: [0, 0.075, 0.50],
    pole: [0.55, -0.6, -0.55],
  },
};

// ============================================================================
// 1–3. Build Map Seeker
// ============================================================================
export function buildMapSeeker(THREE, kind = 'clockwork_wizard') {
  const safeKind = SEEKER_DIMS[kind] ? kind : 'clockwork_wizard';
  const D = SEEKER_DIMS[safeKind];

  return buildRiggedSeeker(THREE, safeKind, D, (K) => {
    const {
      SKIN, v, xf, sph, lathe, tor, rbox, tube, seg, cylz, qn,
      add, lock, dec, buildFace, buildArm, buildBoot,
    } = K;
    const V = THREE.Vector3;

    // ----------------------------------------------------------------------
    // SEEKER 1: clockwork_wizard ('Clockwork Wizard')
    // ----------------------------------------------------------------------
    if (safeKind === 'clockwork_wizard') {
      const HAIR = 0x472d22, ROSE = 0xc85568, GOLD = 0xf5cc5c, CREAM = 0xf7efe0;
      const BREECH = 0x453c38, BOOT = 0x6b472e, LEATHER = 0x5c3b23, EMERALD = 0x22b368;

      // Breeches, cream cuffs & buckled brown boots
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.60, 0], [x, 0.30, 0.008], 0.088, 0.082, 12), BREECH);
        add(gk, 'cloth', tor(0.082, 0.020, [x, 0.295, 0.008], [PI / 2, 0, 0], 1, 2 * PI, 6, 16), 0x564b46);
        add(gk, 'cloth', seg([x, 0.29, 0.005], [x, 0.20, 0], 0.052, 0.050, 10, false), CREAM);
        buildBoot(gk, x, BOOT, 0x382316, CREAM, 0.21);
        add(gk, 'cloth', rbox(0.138, 0.024, 0.03, 0.006, [x, 0.115, 0.068]), LEATHER);
        add(gk, 'cloth', rbox(0.046, 0.040, 0.016, 0.005, [x, 0.115, 0.085]), GOLD);
      }

      // Burgundy waistcoat + breeches waist + belt & hanging brass gear charm
      add('torso', 'cloth', lathe([
        [0, 0.54], [0.165, 0.55], [0.185, 0.68], [0.175, 0.86], [0.165, 1.04], [0.09, 1.11], [0, 1.12],
      ], [0, 0, 0], [1, 1, 0.84], null, 22), ROSE);
      add('torso', 'cloth', lathe([
        [0, 0.53], [0.172, 0.54], [0.186, 0.66], [0, 0.67],
      ], [0, 0, 0], [1, 1, 0.85], null, 20), BREECH);
      add('torso', 'cloth', lathe([
        [0.186, 0.72], [0.192, 0.74], [0.190, 0.775], [0.182, 0.785],
      ], [0, 0, 0], [1, 1, 0.86], null, 22), LEATHER);
      add('torso', 'cloth', rbox(0.062, 0.056, 0.020, 0.006, [0, 0.752, 0.168]), GOLD);
      add('torso', 'cloth', xf(gearShapeGeo(THREE, 0.040, 0.030, 0.011, 10, 0.012), [0, 0.675, 0.172]), GOLD);

      // Starry Indigo Harlequin Coat (open in front +Z: spans from az=+0.42 around back to 2*PI-0.42!)
      const coatProf = [
        [0.335, 0.42], [0.342, 0.45], [0.305, 0.58], [0.245, 0.76],
        [0.212, 0.92], [0.205, 1.03], [0.165, 1.09], [0.105, 1.12],
      ];
      add('torso', 'paint', lathe(coatProf, [0, 0, 0], [1, 1, 0.88], [0, 0.42, 0], 26, 0, 2 * PI - 0.84), 0xffffff);
      // Folded rose-and-gold coat lapels & wide collar
      add('torso', 'cloth', tor(0.118, 0.032, [0, 1.095, -0.01], [PI / 2 - 0.28, 0, 0], [1.1, 0.95, 1], PI * 1.55, 7, 20), ROSE);
      for (const s of [-1, 1]) {
        const lapPts = [
          [s * 0.078, 1.07, 0.145], [s * 0.118, 0.90, 0.172],
          [s * 0.142, 0.68, 0.205], [s * 0.165, 0.44, 0.268],
        ];
        add('torso', 'cloth', tube(lapPts, 0.015, 14, 6), GOLD);
        add('torso', 'cloth', tube([
          [s * 0.092, 1.06, 0.142], [s * 0.138, 0.92, 0.168], [s * 0.155, 0.76, 0.192],
        ], 0.022, 10, 6), ROSE);
      }
      // Harlequin rose & cream-gold diamond border along coat hem + golden stars on coat!
      const nDiamonds = 14;
      for (let i = 0; i < nDiamonds; i++) {
        const az = 0.48 + (i / (nDiamonds - 1)) * (2 * PI - 0.96);
        const rr = 0.326;
        const pos = [Math.sin(az) * rr, 0.485, Math.cos(az) * rr * 0.88];
        add('torso', 'cloth', xf(rbox(0.062, 0.062, 0.014, 0.004, [0, 0, 0], [0, 0, PI / 4]), pos, [0.22, az, 0]),
          i % 2 === 0 ? ROSE : GOLD);
      }
      for (const [az, sy, sr] of [
        [0.68, 0.63, 0.028], [-0.68, 0.63, 0.028], [1.12, 0.80, 0.025], [-1.12, 0.80, 0.025],
        [1.75, 0.62, 0.030], [-1.75, 0.62, 0.030], [PI, 0.74, 0.032], [2.45, 0.90, 0.024], [-2.45, 0.90, 0.024],
      ]) {
        const rC = sy < 0.70 ? 0.295 : sy < 0.85 ? 0.238 : 0.212;
        add('torso', 'cloth', xf(starShapeGeo(THREE, 5, sr, sr * 0.4, 0.008),
          [Math.sin(az) * rC, sy, Math.cos(az) * rC * 0.89], [0.15, az, 0]), GOLD);
      }

      // Ruffled white jabot collar & Emerald brooch at throat
      add('torso', 'cloth', seg([0, 1.06, 0], [0, 1.19, 0.01], 0.052, 0.052), SKIN);
      for (const [jy, jw, jz] of [[1.05, 0.075, 0.145], [0.99, 0.088, 0.155], [0.93, 0.068, 0.152]]) {
        add('torso', 'cloth', sph(1, [0, jy, jz], [jw, 0.034, 0.026], [-0.2, 0, 0], 12, 8), CREAM);
      }
      add('torso', 'cloth', sph(1, [0, 1.065, 0.162], [0.028, 0.034, 0.014], null, 12, 10), GOLD);
      add('torso', 'cloth', sph(1, [0, 1.065, 0.170], [0.019, 0.025, 0.012], null, 12, 10), EMERALD);

      // Hip leather pouch + glowing blue glass potion flask on right hip (-X)
      add('torso', 'cloth', rbox(0.085, 0.105, 0.11, 0.022, [-0.23, 0.69, -0.02], [0, 0, 0.18]), LEATHER);
      add('torso', 'cloth', rbox(0.022, 0.032, 0.02, 0.004, [-0.272, 0.70, -0.02]), GOLD);
      add('torso', 'glass', sph(0.052, [-0.225, 0.665, 0.085], 1, null, 14, 10));
      add('torso', 'cloth', sph(0.042, [-0.225, 0.658, 0.085], [1, 0.82, 1], null, 12, 8), 0x5ec2f2);
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.016, 0.018, 0.028, 10), [-0.225, 0.722, 0.085], [0, 0, 0.2]), GOLD);

      // Expressive Wizard Boy Face + Tousled Chestnut Hair
      buildFace({ iris: 0x4e2d1c, iris2: 0xc98245, brow: 0x3b2216, browRoll: 0.24, browEl: 0.36, mouth: 'laugh' });
      add('head', 'cloth', sph(1, [0, 1.355, -0.008], [0.214, 0.192, 0.204], null, 18, 14), HAIR);
      for (const [az, el, sc, roll, bend] of [
        [-0.54, 0.36, [0.068, 0.082, 0.036], 0.28, 0.08],
        [-0.18, 0.40, [0.068, 0.086, 0.036], 0.14, 0.10],
        [0.18, 0.40, [0.068, 0.084, 0.036], -0.18, 0.10],
        [0.54, 0.35, [0.066, 0.078, 0.036], -0.30, 0.08],
        [-1.02, 0.10, [0.065, 0.090, 0.042], 0.18, -0.18],
        [1.02, 0.10, [0.065, 0.090, 0.042], -0.18, -0.18],
        [1.65, 0.05, [0.075, 0.085, 0.048], -0.25, -0.25],
        [-1.65, 0.05, [0.075, 0.085, 0.048], 0.25, -0.25],
      ]) {
        lock(az, el, 0.012, sc, HAIR, roll, bend);
      }

      // Wide Starry Pointed Wizard Hat w/ Harlequin Brim Underside, Brass Gears & Goggles!
      const hPos = [0, 1.455, -0.03], hRot = [-0.40, 0, -0.09];
      const hQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...hRot));
      const inHat = (lx, ly, lz) => v(hPos).add(new V(lx, ly, lz).applyQuaternion(hQ));

      // Wide wizard brim (paint indigo top + bold rose/gold harlequin diamonds underneath)
      add('head', 'paint', lathe([
        [0.195, 0.01], [0.345, -0.022], [0.395, -0.014], [0.385, 0.004], [0.21, 0.038], [0.205, 0.09],
      ], hPos, 1, hRot, 30), 0xffffff);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * PI * 2;
        const pB = inHat(Math.sin(a) * 0.305, -0.020, Math.cos(a) * 0.305);
        add('head', 'cloth', sph(1, pB, [0.062, 0.010, 0.062], hQ, 8, 6), i % 2 === 0 ? ROSE : GOLD);
      }
      // Crooked curving wizard cone sweeping up & left-back + golden stars!
      const coneSteps = [
        [[0, 0.05, 0], 0.205],
        [[-0.01, 0.16, 0.01], 0.165],
        [[-0.05, 0.26, 0.02], 0.118],
        [[-0.12, 0.34, 0.02], 0.072],
        [[-0.21, 0.35, 0.01], 0.036],
        [[-0.27, 0.29, 0.0], 0.014],
      ];
      for (let i = 0; i < coneSteps.length - 1; i++) {
        const [p0, r0] = coneSteps[i], [p1, r1] = coneSteps[i + 1];
        add('head', 'paint', seg(inHat(...p0), inHat(...p1), r0, r1, 16), 0xffffff);
      }
      for (const [sx, sy, sz, sr] of [
        [0.08, 0.16, 0.145, 0.030], [-0.11, 0.19, 0.120, 0.028],
        [0.01, 0.26, 0.105, 0.026], [-0.14, 0.14, -0.12, 0.026], [0.14, 0.15, -0.09, 0.025],
      ]) {
        const sp = inHat(sx, sy, sz);
        add('head', 'cloth', xf(starShapeGeo(THREE, 5, sr, sr * 0.4, 0.008), sp, qn(new V(sx, 0.3, sz))), GOLD);
      }
      // Hatband + Steampunk Brass Goggles + Side Brass Gears
      add('head', 'cloth', tor(0.206, 0.020, inHat(0, 0.055, 0), [PI / 2 - 0.40, 0, -0.09], 1, 2 * PI, 7, 24), LEATHER);
      for (const gs of [-1, 1]) {
        const gp = inHat(gs * 0.070, 0.075, 0.205);
        add('head', 'cloth', xf(new THREE.CylinderGeometry(0.048, 0.048, 0.034, 16), gp, [PI / 2 - 0.35, gs * 0.22, 0]), GOLD);
        add('head', 'cloth', sph(1, inHat(gs * 0.070, 0.075, 0.224), [0.038, 0.038, 0.010], null, 12, 8), 0x72c8f4);
      }
      add('head', 'cloth', xf(gearShapeGeo(THREE, 0.050, 0.037, 0.012, 10, 0.014), inHat(-0.185, 0.078, 0.108), [0, -1.05, 0]), GOLD);
      add('head', 'cloth', xf(gearShapeGeo(THREE, 0.034, 0.024, 0.008, 8, 0.014), inHat(-0.205, 0.118, 0.048), [0, -1.35, 0]), GOLD);

      // Arms w/ flared rose-and-gold harlequin bell cuffs
      for (const s of [-1, 1]) {
        buildArm(s, { upper: 0xffffff, upperMat: 'paint', r1: 0.066, puff: 0.076, hand: 0.050 });
        const f = s > 0 ? 'foreL' : 'foreR';
        add(f, 'cloth', lathe([[0.062, -0.01], [0.074, -0.11], [0.102, -0.165], [0.052, -0.165]], [0, 0, 0], 1, null, 16), D.main);
        add(f, 'cloth', tor(0.095, 0.018, [0, -0.155, 0], [PI / 2, 0, 0], 1, 2 * PI, 6, 16), ROSE);
        add(f, 'cloth', tor(0.072, 0.014, [0, -0.175, 0], [PI / 2, 0, 0], 1, 2 * PI, 6, 14), CREAM);
      }

      // WEAPON: Ornate Brass Astrolabe Steam-Sprayer (nozzle at [0, 0.075, 0.46])
      add('weapon', 'cloth', rbox(0.046, 0.12, 0.058, 0.018, [0, -0.035, 0.0], [0.32, 0, 0]), LEATHER);
      add('weapon', 'cloth', rbox(0.042, 0.09, 0.052, 0.016, [0, -0.02, 0.19], [-0.15, 0, 0]), LEATHER);
      add('weapon', 'cloth', cylz(0.048, 0.042, -0.06, 0.08, 0, 0.075, 16), GOLD);
      add('weapon', 'cloth', sph(0.045, [0, 0.075, -0.065], [1, 1, 0.7], null, 12, 10), ROSE);

      // Central Astrolabe Glass Globe + Glowing Core + Crossed Brass Armillary Rings
      const gc = [0, 0.075, 0.175];
      add('weapon', 'glass', sph(0.088, gc, 1, null, 18, 14));
      add('weapon', 'glow', sph(0.068, gc, 1, null, 14, 10), 0x62c4ff);
      add('weapon', 'glow', xf(starShapeGeo(THREE, 8, 0.065, 0.020, 0.016), gc, [0, PI / 2, 0]), 0xffe478);
      add('weapon', 'cloth', tor(0.092, 0.010, gc, [0, PI / 2, 0], 1, 2 * PI, 6, 22), GOLD);
      add('weapon', 'cloth', tor(0.092, 0.009, gc, [PI / 2, 0.35, 0], 1, 2 * PI, 6, 22), GOLD);
      for (const s of [-1, 1]) {
        add('weapon', 'cloth', xf(starShapeGeo(THREE, 6, 0.048, 0.016, 0.010), [s * 0.092, 0.075, 0.175], [0, PI / 2, 0]), GOLD);
      }

      // Top Miniature Pressure Gauge & Steam Whistle Valves
      add('weapon', 'cloth', seg([0, 0.16, 0.15], [0, 0.22, 0.15], 0.012, 0.010, 8), GOLD);
      add('weapon', 'cloth', cylz(0.036, 0.036, 0.19, 0.215, 0, 0.205, 16), GOLD);
      add('weapon', 'cloth', cylz(0.028, 0.028, 0.212, 0.218, 0, 0.205, 14), CREAM);
      add('weapon', 'cloth', seg([-0.02, 0.16, 0.12], [-0.02, 0.24, 0.12], 0.010, 0.014, 8), GOLD);

      // Flared Brass Blunderbuss Barrel + Glowing Muzzle Aperture
      add('weapon', 'cloth', cylz(0.048, 0.044, 0.255, 0.35, 0, 0.075, 16), GOLD);
      add('weapon', 'cloth', tor(0.052, 0.009, [0, 0.075, 0.31], null, 1, 2 * PI, 6, 18), 0xc48a32);
      add('weapon', 'cloth', cylz(0.044, 0.072, 0.35, 0.445, 0, 0.075, 18), GOLD);
      add('weapon', 'cloth', tor(0.070, 0.011, [0, 0.075, 0.445], null, 1, 2 * PI, 7, 20), GOLD);
      add('weapon', 'glow', sph(1, [0, 0.075, 0.448], [0.048, 0.048, 0.010], null, 12, 8), 0xffe680);
    }

    // ----------------------------------------------------------------------
    // SEEKER 2: hatter_milliner ('Milliner Girl')
    // ----------------------------------------------------------------------
    if (safeKind === 'hatter_milliner') {
      const HAIR = 0x5c3724, APRON = 0xf8f0e0, WHITE = 0xfaf6ee, RIBBON = 0xb53548;
      const STRAW = 0xf4d278, COPPER = 0xc97842, GOLD = 0xf5cc5c, BOOT = 0x764c30;

      // Bare shins, ruffled cream socks & laced brown leather boots
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.56, 0], [x, 0.24, 0.005], 0.052, 0.046), SKIN);
        add(gk, 'cloth', seg([x, 0.25, 0], [x, 0.19, 0], 0.052, 0.054, 12, false), WHITE);
        add(gk, 'cloth', tor(0.054, 0.014, [x, 0.245, 0], [PI / 2, 0, 0], 1, 2 * PI, 6, 14), WHITE);
        buildBoot(gk, x, BOOT, 0x422a19, null, 0.20);
        for (const ly of [0.10, 0.135, 0.17]) {
          add(gk, 'cloth', rbox(0.068, 0.010, 0.014, 0.003, [x, ly, 0.076 - (ly - 0.10) * 0.18], [0.25, 0, 0]), 0xe8c98e);
        }
      }

      // White ruffled petticoat hem + Cornflower-Blue Pleated Dress (paint)
      add('torso', 'cloth', lathe([
        [0.345, 0.40], [0.365, 0.42], [0.34, 0.46], [0, 0.47],
      ], [0, 0, 0], [1, 1, 0.88], null, 28), WHITE);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * PI * 2;
        add('torso', 'cloth', sph(1, [Math.sin(a) * 0.352, 0.418, Math.cos(a) * 0.352 * 0.88], [0.042, 0.026, 0.042], null, 8, 6), WHITE);
      }
      const dressProf = [
        [0, 0.44], [0.34, 0.445], [0.31, 0.56], [0.25, 0.70], [0.19, 0.80],
        [0.195, 0.92], [0.19, 1.01], [0.145, 1.07], [0.08, 1.10], [0, 1.11],
      ];
      add('torso', 'paint', lathe(dressProf, [0, 0, 0], [1, 1, 0.86], null, 28), 0xffffff);
      // Sculpted vertical skirt pleats around dress
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * PI * 2;
        add('torso', 'paint', seg(
          [Math.sin(a) * 0.19, 0.77, Math.cos(a) * 0.19 * 0.86],
          [Math.sin(a) * 0.335, 0.455, Math.cos(a) * 0.335 * 0.86],
          0.018, 0.030, 8, false
        ), 0xf2f6ff);
      }

      // White Peter Pan collar + Crimson neck bow
      add('torso', 'cloth', seg([0, 1.04, 0], [0, 1.17, 0.01], 0.050, 0.050), SKIN);
      add('torso', 'cloth', tor(0.095, 0.024, [0, 1.075, 0.02], [PI / 2 - 0.25, 0, 0], [1.05, 0.92, 0.7], 2 * PI, 7, 20), WHITE);
      add('torso', 'cloth', sph(0.018, [0, 1.045, 0.142], 1, null, 8, 6), RIBBON);
      for (const s of [-1, 1]) {
        add('torso', 'cloth', sph(1, [s * 0.038, 1.048, 0.138], [0.036, 0.020, 0.014], [0, 0, -s * 0.32], 10, 8), RIBBON);
      }

      // Scalloped White Pinafore Apron + Back Waist Bow + Pocket w/ Scissors & Thread Spool!
      // Front apron skirt shell
      add('torso', 'cloth', lathe([
        [0.348, 0.49], [0.316, 0.58], [0.258, 0.70], [0.198, 0.79],
      ], [0, 0, 0.008], [1, 1, 0.87], [0, -0.95, 0], 18, 0, 1.90), APRON);
      // Scalloped apron hem lobes
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.25;
        add('torso', 'cloth', sph(1, [Math.sin(a) * 0.345, 0.495, Math.cos(a) * 0.345 * 0.87 + 0.008],
          [0.048, 0.032, 0.016], [0.22, a, 0], 10, 8), APRON);
      }
      // Apron bib, shoulder ruffles & brown waist belt + fluffy white hip/back bow
      add('torso', 'cloth', rbox(0.19, 0.19, 0.025, 0.012, [0, 0.91, 0.162], [-0.06, 0, 0]), APRON);
      for (const s of [-1, 1]) {
        add('torso', 'cloth', tube([
          [s * 0.085, 0.99, 0.155], [s * 0.125, 1.08, 0.05], [s * 0.115, 1.05, -0.10], [s * 0.08, 0.82, -0.165],
        ], 0.018, 16, 6), APRON);
      }
      add('torso', 'cloth', lathe([
        [0.195, 0.785], [0.202, 0.805], [0.196, 0.825],
      ], [0, 0, 0], [1, 1, 0.88], null, 24), BOOT);
      // Big fluffy white apron bow at right-back hip (-X / -Z)
      for (const bs of [-1, 1]) {
        add('torso', 'cloth', tor(0.065, 0.022, [-0.15 + bs * 0.04, 0.80, -0.15], [0.2, 0.65, bs * 0.4], [1.2, 0.8, 0.6], 2 * PI, 6, 14), APRON);
        add('torso', 'cloth', tube([
          [-0.16, 0.78, -0.15], [-0.21 + bs * 0.04, 0.65, -0.18], [-0.23 + bs * 0.05, 0.53, -0.17],
        ], 0.020, 10, 6), APRON);
      }

      // Apron Pocket + Golden Tailor's Scissors + Red Thread Spool!
      const pk = [-0.118, 0.608, 0.278];
      add('torso', 'cloth', rbox(0.098, 0.095, 0.024, 0.012, pk, [0.24, -0.34, 0]), WHITE);
      // Golden scissors handles peeking out of pocket
      add('torso', 'cloth', tor(0.022, 0.006, [-0.142, 0.678, 0.268], [0.22, -0.34, 0.22], [0.85, 1.15, 1], 2 * PI, 5, 12), GOLD);
      add('torso', 'cloth', tor(0.022, 0.006, [-0.105, 0.673, 0.278], [0.22, -0.34, -0.22], [0.85, 1.15, 1], 2 * PI, 5, 12), GOLD);
      add('torso', 'cloth', seg([-0.123, 0.642, 0.273], [-0.136, 0.664, 0.270], 0.0055, 0.0055, 6), GOLD);
      add('torso', 'cloth', seg([-0.123, 0.642, 0.273], [-0.109, 0.661, 0.277], 0.0055, 0.0055, 6), GOLD);
      // Red thread spool beside scissors
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.015, 0.015, 0.034, 10), [-0.084, 0.658, 0.284], [0.22, 0, -0.15]), RIBBON);
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.019, 0.019, 0.006, 10), [-0.087, 0.674, 0.282], [0.22, 0, -0.15]), 0xc88e52);

      // Cheerful Milliner Face + Cheek Band-Aid + Wavy Chestnut Bob
      buildFace({ iris: 0x4b2c1c, iris2: 0xc88248, brow: 0x422618, browRoll: 0.16, browEl: 0.35, mouth: 'laugh' });
      dec('head', 'cloth', -0.60, -0.20, 0.004, [0.030, 0.016, 0.006], 0xf5dcb4, 0.32); // cute cheek band-aid!
      add('head', 'cloth', sph(1, [0, 1.338, -0.008], [0.216, 0.190, 0.204], null, 20, 14), HAIR);
      add('head', 'cloth', sph(1, [0, 1.20, -0.06], [0.225, 0.105, 0.17], null, 18, 12), HAIR);
      for (const s of [-1, 1]) {
        lock(s * 0.96, 0.08, 0.014, [0.074, 0.098, 0.044], HAIR, -s * 0.12, -0.14);
        lock(s * 1.38, 0.08, 0.025, [0.078, 0.095, 0.048], HAIR, -s * 0.18, -0.22);
        add('head', 'cloth', sph(1, [s * 0.205, 1.155, 0.0], [0.065, 0.048, 0.095], [0, 0, -s * 0.48], 12, 8), HAIR);
      }
      for (const [az, el] of [[-0.54, 0.35], [-0.27, 0.38], [0, 0.39], [0.27, 0.38], [0.54, 0.35]]) {
        lock(az, el, 0.011, [0.064, 0.070, 0.034], HAIR, -az * 0.16, 0.10);
      }

      // Wide Woven Straw Sunhat w/ Crimson Ribbon, Bow Loops, Trailing Tails & Flowers!
      const sPos = [0, 1.395, -0.055], sRot = [-0.54, 0, 0.07];
      const sQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...sRot));
      const inSun = (lx, ly, lz) => v(sPos).add(new V(lx, ly, lz).applyQuaternion(sQ));
      add('head', 'cloth', lathe([
        [0, 0.155], [0.11, 0.150], [0.178, 0.118], [0.202, 0.045], [0.208, 0.015],
        [0.34, -0.008], [0.405, -0.016], [0.396, -0.032], [0.21, -0.005],
      ], sPos, 1, sRot, 30), STRAW);
      add('head', 'cloth', tor(0.395, 0.012, inSun(0, -0.022, 0), [PI / 2 - 0.54, 0, 0.07], 1, 2 * PI, 5, 28), 0xe6ba56);
      add('head', 'cloth', lathe([
        [0.204, 0.018], [0.200, 0.068], [0.194, 0.075],
      ], sPos, 1, sRot, 28), RIBBON);
      // Crimson ribbon bow loops + trailing tails on viewer's left (-X)
      for (const bs of [-1, 1]) {
        add('head', 'cloth', sph(1, inSun(-0.22, 0.06 + bs * 0.035, 0.06 - bs * 0.02), [0.026, 0.045, 0.022], [0.3, 0, bs * 0.45], 10, 8), RIBBON);
      }
      for (const [dz, dy] of [[0.03, -0.14], [-0.03, -0.18]]) {
        add('head', 'cloth', tube([
          inSun(-0.20, 0.045, 0.04),
          inSun(-0.31, 0.01, 0.05 + dz),
          inSun(-0.40, dy, 0.04 + dz),
        ], 0.018, 10, 6), RIBBON);
      }
      // Blossom cluster on hatband
      for (const [fx, fy, fz, col] of [
        [-0.175, 0.065, 0.125, WHITE],
        [-0.135, 0.082, 0.162, 0xf59eb0],
        [-0.195, 0.040, 0.150, WHITE],
      ]) {
        const fc = inSun(fx, fy, fz);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * PI * 2;
          add('head', 'cloth', sph(0.020, fc.clone().add(new V(Math.cos(a) * 0.018, Math.sin(a) * 0.018, 0.008)), 1, null, 8, 6), col);
        }
        add('head', 'cloth', sph(0.011, fc.clone().add(new V(0, 0, 0.014)), 1, null, 6, 5), GOLD);
      }
      for (const [lx, ly, lz] of [[-0.215, 0.085, 0.09], [-0.11, 0.065, 0.185]]) {
        add('head', 'cloth', sph(1, inSun(lx, ly, lz), [0.034, 0.018, 0.014], null, 8, 6), 0x629b46);
      }

      // Puffy Cornflower-Blue Short Sleeves w/ White Ruffled Cuffs
      for (const s of [-1, 1]) {
        buildArm(s, {
          upper: 0xffffff, upperMat: 'paint',
          r1: 0.082, puff: 0.098, sleeve: 0.48, rs: 0.044, cuffU: WHITE, hand: 0.048,
        });
      }

      // WEAPON: Copper Tea-Kettle Pressure Blaster (nozzle at [0, 0.055, 0.46])
      const kc = new V(0, -0.01, 0.16);
      add('weapon', 'cloth', lathe([
        [0, -0.11], [0.132, -0.11], [0.142, -0.085], [0.136, -0.01],
        [0.108, 0.065], [0.078, 0.088], [0, 0.095],
      ], kc, 1, null, 26), COPPER);
      add('weapon', 'cloth', tor(0.138, 0.012, kc.clone().add(new V(0, -0.095, 0)), [PI / 2, 0, 0], 1, 2 * PI, 6, 24), GOLD);
      add('weapon', 'cloth', tor(0.082, 0.010, kc.clone().add(new V(0, 0.085, 0)), [PI / 2, 0, 0], 1, 2 * PI, 6, 20), GOLD);
      add('weapon', 'cloth', sph(0.022, kc.clone().add(new V(0, 0.11, 0)), 1, null, 10, 8), GOLD);
      // Golden leaf emblem on both sides of kettle
      for (const s of [-1, 1]) {
        add('weapon', 'cloth', sph(1, [s * 0.136, -0.02, 0.16], [0.008, 0.032, 0.018], [0.4, 0, 0], 8, 6), GOLD);
        add('weapon', 'cloth', sph(1, [s * 0.134, -0.03, 0.185], [0.008, 0.024, 0.014], [-0.5, 0, 0], 8, 6), GOLD);
      }
      // Top Carry Handle (left hand at gripF=[0, 0.155, 0.16]) + Rear Handle (right hand at [0,0,0])
      add('weapon', 'cloth', tor(0.082, 0.015, [0, 0.085, 0.16], [0, PI / 2, 0], 1, PI, 6, 18), COPPER);
      add('weapon', 'cloth', cylz(0.022, 0.022, 0.125, 0.195, 0, 0.167, 12), RIBBON);
      add('weapon', 'cloth', tor(0.058, 0.015, [0, -0.005, 0.045], [0, -PI / 2, PI / 2], 1, PI, 6, 16), COPPER);
      // Braided dark hose underneath kettle
      add('weapon', 'cloth', tube([
        [0, -0.06, 0.03], [-0.04, -0.14, 0.09], [-0.02, -0.14, 0.20], [0, -0.09, 0.25],
      ], 0.013, 14, 6), 0x45352d);
      // Top Pressure Gauge + Pressurized Glass-and-Brass Watering Rose Spout
      add('weapon', 'cloth', seg([0, 0.04, 0.26], [0, 0.095, 0.28], 0.009, 0.009, 8), GOLD);
      add('weapon', 'cloth', cylz(0.030, 0.030, 0.27, 0.292, 0, 0.11, 14), GOLD);
      add('weapon', 'cloth', cylz(0.023, 0.023, 0.290, 0.295, 0, 0.11, 12), WHITE);
      // Angled spout w/ glass chamber & golden perforated rose sprinkler head
      add('weapon', 'cloth', seg([0, -0.02, 0.27], [0, 0.015, 0.34], 0.038, 0.034, 14), GOLD);
      add('weapon', 'glass', seg([0, 0.015, 0.34], [0, 0.042, 0.415], 0.032, 0.032, 14, false));
      add('weapon', 'glow', seg([0, 0.015, 0.34], [0, 0.042, 0.415], 0.024, 0.024, 12, false), 0x6ac8f5);
      const spDir = new V(0, 0.34, 1).normalize();
      add('weapon', 'cloth', xf(new THREE.CylinderGeometry(0.056, 0.034, 0.052, 18), [0, 0.050, 0.438],
        new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), spDir)), GOLD);
      add('weapon', 'cloth', sph(1, [0, 0.056, 0.460], [0.052, 0.052, 0.010], qn(spDir), 14, 8), 0xf4cf68);
    }

    // ----------------------------------------------------------------------
    // SEEKER 3: royal_cadet ('Royal Clockwork Cadet')
    // ----------------------------------------------------------------------
    if (safeKind === 'royal_cadet') {
      const HAIR = 0x2b201c, BREECH = 0xf0e4cc, GOLD = 0xf5cc5c, BOOT = 0x5c3d26;
      const LEATHER = 0x482f1d, GLOVE = 0x3b3536, PLUME = 0xf7f0e2, HOSE = 0x5d7098;

      // Cream cavalry breeches w/ burgundy stripe & tall cuffed gear-crested riding boots
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.65, 0], [x, 0.31, 0.008], 0.088, 0.078, 12), BREECH);
        add(gk, 'cloth', seg([x + s * 0.078, 0.63, 0], [x + s * 0.070, 0.33, 0.008], 0.015, 0.014, 6), D.main);
        buildBoot(gk, x, BOOT, 0x332014, null, 0.32);
        // Boot cuff w/ gold trim & brass gear badge
        add(gk, 'cloth', lathe([[0.072, 0.25], [0.082, 0.27], [0.084, 0.33], [0.074, 0.34]], [x, 0, 0.004], 1, null, 16), 0x6b472d);
        add(gk, 'cloth', tor(0.082, 0.008, [x, 0.332, 0.004], [PI / 2, 0, 0], 1, 2 * PI, 5, 16), GOLD);
        add(gk, 'cloth', xf(gearShapeGeo(THREE, 0.028, 0.020, 0.007, 9, 0.010), [x + s * 0.082, 0.295, 0.012], [0, PI / 2, 0]), GOLD);
        add(gk, 'cloth', rbox(0.138, 0.022, 0.03, 0.005, [x, 0.095, 0.06]), LEATHER);
        add(gk, 'cloth', rbox(0.042, 0.034, 0.014, 0.004, [x, 0.095, 0.078]), GOLD);
      }

      // Burgundy Hussar Jacket w/ Split Front Skirt, Gold Braid Frogging, Brass Epaulettes & Pocket Watch
      add('torso', 'cloth', lathe([
        [0, 0.56], [0.168, 0.57], [0.184, 0.74], [0, 0.75],
      ], [0, 0, 0], [1, 1, 0.84], null, 20), BREECH);
      // Upper Hussar bodice (closed) + lower split Hussar coat-tails (open in front +Z!)
      add('torso', 'paint', lathe([
        [0.194, 0.75], [0.205, 0.94], [0.21, 1.07], [0.155, 1.14], [0.088, 1.18], [0, 1.19],
      ], [0, 0, 0], [1, 1, 0.85], null, 24), 0xffffff);
      add('torso', 'paint', lathe([
        [0.248, 0.54], [0.232, 0.64], [0.196, 0.76],
      ], [0, 0, 0], [1, 1, 0.85], [0, 0.30, 0], 22, 0, 2 * PI - 0.60), 0xffffff);
      // Gold trim along split Hussar skirt hem
      for (const s of [-1, 1]) {
        add('torso', 'cloth', tube([
          [s * 0.058, 0.75, 0.162], [s * 0.095, 0.64, 0.192], [s * 0.145, 0.545, 0.198], [s * 0.235, 0.545, 0.06],
        ], 0.009, 12, 6), GOLD);
      }
      // High Mandarin collar w/ gold rim
      add('torso', 'cloth', seg([0, 1.13, 0], [0, 1.25, 0.01], 0.052, 0.052), SKIN);
      add('torso', 'paint', lathe([[0.078, 1.15], [0.082, 1.21], [0.075, 1.22]], [0, 0, 0.008], 1, null, 18), 0xffffff);
      add('torso', 'cloth', tor(0.080, 0.009, [0, 1.212, 0.008], [PI / 2, 0, 0], 1, 2 * PI, 5, 18), GOLD);

      // 5 Horizontal Gold Hussar Braid Bars + Twin Rows of Brass Buttons + Medal
      for (const by of [1.09, 1.02, 0.95, 0.88, 0.81]) {
        const rz = (by > 0.9 ? 0.206 : 0.198) * 0.85 + 0.005;
        add('torso', 'cloth', tube([
          [-0.095, by + 0.008, rz - 0.02], [0, by, rz + 0.006], [0.095, by + 0.008, rz - 0.02],
        ], 0.0085, 10, 6), GOLD);
        for (const bx of [-0.095, 0, 0.095]) {
          add('torso', 'cloth', sph(0.013, [bx, by + (bx ? 0.008 : 0), rz + (bx ? -0.015 : 0.010)], 1, null, 8, 6), GOLD);
        }
      }
      // Royal sapphire-star medal on left breast (+X)
      add('torso', 'cloth', xf(starShapeGeo(THREE, 8, 0.032, 0.014, 0.008), [0.115, 1.045, 0.158], [0, 0.45, 0]), GOLD);
      add('torso', 'cloth', sph(0.013, [0.118, 1.045, 0.164], 1, null, 8, 6), 0x3888e0);

      // Gold-fringed Brass Epaulettes on both shoulders
      for (const s of [-1, 1]) {
        const ep = [s * 0.20, 1.145, 0.0];
        add('torso', 'cloth', sph(1, ep, [0.075, 0.024, 0.068], [0, 0, -s * 0.18], 12, 8), GOLD);
        for (let k = -2; k <= 2; k++) {
          add('torso', 'cloth', seg(
            [s * 0.255, 1.135, k * 0.022],
            [s * 0.270, 1.075, k * 0.024],
            0.008, 0.007, 6
          ), GOLD);
        }
      }

      // Leather Belt, Brass Buckle & Hanging Pocket Watch at Right Hip (-X)
      add('torso', 'cloth', lathe([
        [0.194, 0.75], [0.200, 0.775], [0.196, 0.80],
      ], [0, 0, 0], [1, 1, 0.86], null, 22), LEATHER);
      add('torso', 'cloth', rbox(0.060, 0.052, 0.018, 0.006, [0, 0.775, 0.172]), GOLD);
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.042, 0.042, 0.018, 16), [-0.195, 0.68, 0.075], [0, -0.95, 0.15]), GOLD);
      add('torso', 'cloth', xf(new THREE.CylinderGeometry(0.032, 0.032, 0.020, 14), [-0.197, 0.68, 0.077], [0, -0.95, 0.15]), PLUME);

      // Glass-and-Brass Pressurized Backpack Tank + Ribbed Feed Hose!
      const tx = -0.02, tz = -0.255;
      add('torso', 'glass', seg([tx, 0.77, tz], [tx, 1.09, tz], 0.095, 0.095, 18, false));
      add('torso', 'cloth', seg([tx, 0.78, tz], [tx, 1.03, tz], 0.078, 0.078, 14), 0x72c6f2);
      add('torso', 'cloth', lathe([[0, 0.72], [0.098, 0.735], [0.102, 0.78]], [tx, 0, tz], 1, null, 18), GOLD);
      add('torso', 'cloth', lathe([[0.102, 1.08], [0.096, 1.135], [0.045, 1.17], [0, 1.175]], [tx, 0, tz], 1, null, 18), GOLD);
      add('torso', 'cloth', tor(0.048, 0.009, [tx, 1.205, tz], [PI / 2, 0, 0], 1, 2 * PI, 5, 14), GOLD);
      add('torso', 'cloth', seg([tx, 1.17, tz], [tx, 1.205, tz], 0.012, 0.012, 8), GOLD);
      for (const rs of [-1, 1]) {
        add('torso', 'cloth', seg([tx + rs * 0.096, 0.77, tz], [tx + rs * 0.096, 1.09, tz], 0.007, 0.007, 6), GOLD);
        // Leather backpack straps
        add('torso', 'cloth', tube([
          [rs * 0.135, 0.80, 0.15], [rs * 0.145, 1.14, 0.08], [rs * 0.125, 1.12, -0.14], [rs * 0.09, 0.82, -0.18],
        ], 0.015, 16, 6), LEATHER);
      }
      // Ribbed pressurized water hose curving from tank bottom under right arm!
      add('torso', 'cloth', tube([
        [tx - 0.04, 0.72, tz], [-0.18, 0.67, -0.16], [-0.23, 0.69, -0.02], [-0.16, 0.76, 0.12],
      ], 0.018, 16, 7), HOSE);

      // Confident Cadet Face + Cheek Band-Aid + Spiky Dark Hair
      buildFace({ iris: 0x3b2418, iris2: 0xb5743c, brow: 0x221814, browRoll: 0.30, browEl: 0.35, mouth: 'smirk' });
      dec('head', 'cloth', -0.62, -0.19, 0.004, [0.028, 0.015, 0.006], 0xf4dab2, 0.35);
      add('head', 'cloth', sph(1, [0, 1.41, -0.008], [0.206, 0.192, 0.202], null, 18, 14), HAIR);
      for (const [az, el, sc, roll, bend] of [
        [-0.52, 0.35, [0.064, 0.080, 0.034], 0.30, 0.08],
        [-0.14, 0.39, [0.066, 0.088, 0.034], 0.15, 0.10],
        [0.22, 0.38, [0.066, 0.084, 0.034], -0.20, 0.10],
        [0.56, 0.33, [0.062, 0.076, 0.032], -0.32, 0.08],
        [-1.06, 0.08, [0.064, 0.085, 0.040], 0.22, -0.22],
        [1.06, 0.08, [0.064, 0.085, 0.040], -0.22, -0.22],
        [2.2, 0.02, [0.070, 0.078, 0.042], -0.3, -0.32],
        [-2.2, 0.02, [0.070, 0.078, 0.042], 0.3, -0.32],
      ]) {
        lock(az, el, 0.012, sc, HAIR, roll, bend);
      }

      // Plumed Crimson Shako Cap w/ Brass Gear Crest!
      const cPos = [0, 1.48, -0.01], cRot = [-0.20, 0, -0.05];
      const cQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...cRot));
      const inCap = (lx, ly, lz) => v(cPos).add(new V(lx, ly, lz).applyQuaternion(cQ));
      add('head', 'paint', lathe([
        [0.192, 0.0], [0.205, 0.07], [0.218, 0.145], [0.205, 0.16], [0, 0.168],
      ], cPos, 1, cRot, 26), 0xffffff);
      // Dark glossy visor peak + gold braid bands
      add('head', 'cloth', lathe([
        [0.192, 0.008], [0.258, -0.028], [0.250, -0.038], [0.188, -0.004],
      ], cPos, 1, [-0.20, -1.05, -0.05], 16, 0, 2.1), 0x35221e);
      add('head', 'cloth', tor(0.196, 0.011, inCap(0, 0.014, 0), [PI / 2 - 0.20, 0, -0.05], 1, 2 * PI, 5, 22), GOLD);
      add('head', 'cloth', tor(0.214, 0.011, inCap(0, 0.148, 0), [PI / 2 - 0.20, 0, -0.05], 1, 2 * PI, 5, 22), GOLD);
      // Brass Gear Crest on front of shako!
      add('head', 'cloth', xf(gearShapeGeo(THREE, 0.054, 0.040, 0.014, 10, 0.014), inCap(0, 0.085, 0.210), [-0.15, 0, 0]), GOLD);
      // Tall sweeping cream-white feather plume on viewer's left (-X, matching characters_sheet.png!)
      const plumePts = [
        inCap(-0.12, 0.14, 0.08),
        inCap(-0.20, 0.26, 0.06),
        inCap(-0.29, 0.30, 0.02),
        inCap(-0.37, 0.23, -0.02),
      ];
      add('head', 'cloth', tube(plumePts, 0.042, 14, 8), PLUME);
      add('head', 'cloth', sph(1, inCap(-0.25, 0.28, 0.04), [0.105, 0.058, 0.048], [0, 0, 0.35], 12, 8), PLUME);

      // Burgundy Sleeves w/ Gold Cuffs & Dark Cadet Gloves (forearm sleeve in 'cloth' -> saves 2 draw calls!)
      for (const s of [-1, 1]) {
        buildArm(s, {
          upper: 0xffffff, upperMat: 'paint',
          r1: 0.068, puff: 0.076, hand: 0.052, glove: GLOVE,
        });
        const f = s > 0 ? 'foreL' : 'foreR';
        add(f, 'cloth', seg([0, 0, 0], [0, -D.b * 0.70, 0], 0.062, 0.068, 12), D.main);
        add(f, 'cloth', tor(0.068, 0.013, [0, -0.158, 0], [PI / 2, 0, 0], 1, 2 * PI, 5, 14), GOLD);
      }

      // WEAPON: Gear-Driven Water Carbine (nozzle at [0, 0.075, 0.50])
      // Walnut rifle stock & rear/front grips
      add('weapon', 'cloth', rbox(0.052, 0.105, 0.16, 0.020, [0, 0.03, -0.09], [0.18, 0, 0]), LEATHER);
      add('weapon', 'cloth', rbox(0.046, 0.11, 0.056, 0.016, [0, -0.035, 0.01], [0.34, 0, 0]), LEATHER);
      add('weapon', 'cloth', rbox(0.058, 0.048, 0.18, 0.016, [0, 0.015, 0.22]), LEATHER);

      // Brass Receiver w/ Interlocking Exposed Clockwork Gears on both sides!
      add('weapon', 'cloth', rbox(0.074, 0.095, 0.18, 0.020, [0, 0.068, 0.08]), GOLD);
      for (const s of [-1, 1]) {
        add('weapon', 'cloth', xf(gearShapeGeo(THREE, 0.044, 0.032, 0.011, 10, 0.012), [s * 0.040, 0.068, 0.06], [0, PI / 2, 0]), GOLD);
        add('weapon', 'cloth', xf(gearShapeGeo(THREE, 0.032, 0.023, 0.008, 8, 0.012), [s * 0.040, 0.058, 0.135], [0, PI / 2, 0.3]), 0xc89234);
      }

      // Pressurized Clear Glass Water Chamber + Glowing Sky-Blue Core + Brass Barrel Rails & Muzzle
      add('weapon', 'glass', cylz(0.048, 0.048, 0.17, 0.39, 0, 0.075, 16));
      add('weapon', 'glow', cylz(0.036, 0.036, 0.175, 0.385, 0, 0.072, 12), 0x62c6f5);
      add('weapon', 'cloth', rbox(0.030, 0.018, 0.24, 0.006, [0, 0.125, 0.28]), GOLD);
      for (const bz of [0.17, 0.28, 0.39]) {
        add('weapon', 'cloth', cylz(0.053, 0.053, bz - 0.014, bz + 0.014, 0, 0.075, 16), GOLD);
      }
      add('weapon', 'cloth', cylz(0.048, 0.070, 0.40, 0.485, 0, 0.075, 18), GOLD);
      add('weapon', 'cloth', tor(0.068, 0.011, [0, 0.075, 0.485], null, 1, 2 * PI, 6, 18), GOLD);
      add('weapon', 'glow', sph(1, [0, 0.075, 0.488], [0.045, 0.045, 0.010], null, 12, 8), 0x8ad8ff);
    }
  });
}

// ============================================================================
// 4. Build Map Hider Spirit (`ember_wisp`: Ember-Star Spirit)
//    A little walking brass lamplighter's lantern: the bean body is the lantern (face on the body),
//    with a riveted brass neck band, a glowing glass window in its belly, a brass lantern cap with
//    a wire bail handle on its head, and a small plain candle flame burning on top of the cap.
// ============================================================================
export function buildMapHider(THREE) {
  return buildRiggedHiderSpirit(THREE, HIDER_DEF.id, HIDER_DEF.color, (api) => {
    const { torso, crest, std, mk, paintGeo, place, ell, V3 } = api;

    // 1. Body vertex colours: polished brass dome -> lighter lamp-glass belly -> darker brass foot
    // (Keeps neutral-bright values so main.js Hue Camouflage tinting on `paint.color` works seamlessly!)
    const bodyMesh = torso.getObjectByName('body');
    if (bodyMesh && bodyMesh.geometry) {
      paintGeo(bodyMesh.geometry, (x, y, z) => {
        const r = Math.hypot(x, z) || 1, front = Math.max(0, z / r);
        const glass = Math.exp(-(((y - 0.28) / 0.17) ** 2));
        const foot = Math.max(0, (0.13 - y) / 0.10);
        const v = Math.min(1.04, 0.90 + glass * 0.12 + front * 0.03 - foot * 0.16);
        return new THREE.Color(v, v * (0.97 + glass * 0.02), v * (0.88 + glass * 0.08));
      });
    }

    const BRASS = 0xe8b84b, BRASS_DK = 0xb5832e, GOLD = 0xf5cc5c, AMBER = 0xff8a3c;

    // 2. Riveted brass neck band (y = 0.492) + single amber lens clasp at the front
    const brassParts = [];
    const band = new THREE.TorusGeometry(0.258, 0.021, 8, 30);
    band.rotateX(PI / 2);
    band.scale(1, 1.25, 0.94);
    band.translate(0, 0.492, 0);
    brassParts.push(paintGeo(band, BRASS));
    for (let i = 0; i < 12; i++) {
      const th = ((i + 0.5) / 12) * PI * 2;
      brassParts.push(place(paintGeo(ell(0.013, 0.013, 0.010, 7, 5), GOLD), 0.492, th, 0.026));
    }
    brassParts.push(place(paintGeo(new THREE.TorusGeometry(0.046, 0.011, 8, 20), BRASS_DK), 0.490, 0, 0.034));
    brassParts.push(place(paintGeo(ell(0.036, 0.036, 0.016, 12, 8), AMBER), 0.490, 0, 0.034));

    // 3. Belly lamp window (y = 0.275, th = 0): brass oval frame + cross mullions around a glowing pane
    const frame = new THREE.TorusGeometry(0.104, 0.013, 8, 26);
    frame.scale(1, 1.14, 1);
    brassParts.push(place(paintGeo(frame, BRASS), 0.275, 0, 0.012));
    brassParts.push(place(paintGeo(new THREE.BoxGeometry(0.014, 0.226, 0.012), BRASS_DK), 0.275, 0, 0.017));
    brassParts.push(place(paintGeo(new THREE.BoxGeometry(0.200, 0.014, 0.012), BRASS_DK), 0.275, 0, 0.017));
    mk(mergeGeometries(brassParts, false), std({ roughness: 0.52, metalness: 0 }), torso, 'collarMedallion');

    const paneMat = std({ emissive: 0xffa828, emissiveIntensity: 0.95, roughness: 0.42, metalness: 0 });
    mk(
      place(paintGeo(ell(0.100, 0.114, 0.010, 16, 10), (lx, ly) =>
        new THREE.Color(0xfff5a8).lerp(new THREE.Color(0xf69c54), Math.min(1, Math.hypot(lx / 0.100, ly / 0.114) ** 2))), 0.275, 0, 0.008),
      paneMat,
      torso,
      'bellyStar'
    );

    // 4. Brass lantern cap on `crest` ([0, 0.91, 0]): flared brim, domed roof, vented chimney & wire bail handle
    const capParts = [];
    const capProf = [[0.288, -0.108], [0.296, -0.092], [0.226, -0.040], [0.142, 0.008], [0.086, 0.034],
      [0.074, 0.040], [0.074, 0.084], [0.094, 0.090], [0.094, 0.104], [0.050, 0.112], [0, 0.114]];
    const capGeo = new THREE.LatheGeometry(capProf.map(([r, y]) => new THREE.Vector2(r, y)), 26);
    capGeo.scale(1, 1, 0.94);
    capParts.push(paintGeo(capGeo, (x, y) => new THREE.Color(BRASS_DK).lerp(new THREE.Color(GOLD), Math.max(0, Math.min(1, (y + 0.11) / 0.20)))));
    const brimRoll = new THREE.TorusGeometry(0.292, 0.013, 6, 28);
    brimRoll.rotateX(PI / 2);
    brimRoll.scale(1, 1, 0.94);
    brimRoll.translate(0, -0.100, 0);
    capParts.push(paintGeo(brimRoll, GOLD));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      const vent = ell(0.016, 0.020, 0.008, 7, 5);
      vent.rotateY(a);
      vent.translate(Math.sin(a) * 0.074, 0.062, Math.cos(a) * 0.070);
      capParts.push(paintGeo(vent, 0x4a3018));
    }
    // Wire bail handle arching over the back of the cap + two pivot lugs
    const bail = new THREE.TorusGeometry(0.205, 0.011, 6, 22, PI);
    bail.rotateX(-0.42);
    bail.translate(0, -0.030, -0.030);
    capParts.push(paintGeo(bail, BRASS_DK));
    for (const sx of [-1, 1]) {
      capParts.push(paintGeo(ell(0.024, 0.024, 0.024, 8, 6).translate(sx * 0.205, -0.030, -0.030), GOLD));
    }
    mk(mergeGeometries(capParts, false), std({ roughness: 0.50, metalness: 0 }), crest, 'lanternCap');

    // Small plain candle flame on top of the chimney (no face — the face lives on the lantern body)
    const flameGrp = new THREE.Group();
    flameGrp.name = 'flameGrp';
    flameGrp.position.set(0, 0.108, 0);
    crest.add(flameGrp);
    const makeFlameTongue = (pts, rBase, rTip) => {
      const c = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(c, 18, 1, 10, false);
      const p = g.attributes.position, uv = g.attributes.uv;
      const tmpP = V3(), cen = V3();
      for (let i = 0; i < p.count; i++) {
        const u = uv ? uv.getX(i) : (i / p.count);
        c.getPointAt(Math.min(1, Math.max(0, u)), cen);
        tmpP.fromBufferAttribute(p, i).sub(cen);
        const rad = rBase * Math.pow(1 - u * 0.92, 0.72) * Math.sin(Math.min(PI, u * PI * 0.88 + 0.34)) + rTip * u;
        tmpP.multiplyScalar(rad);
        p.setXYZ(i, cen.x + tmpP.x, cen.y + tmpP.y, cen.z + tmpP.z);
      }
      g.computeVertexNormals();
      return paintGeo(g, (x, y) => {
        const k = Math.max(0, Math.min(1, y / 0.20));
        return new THREE.Color(0xffe07a).lerp(new THREE.Color(0xff8a2c), Math.pow(k, 0.8));
      });
    };
    const flameParts = [
      makeFlameTongue([V3(0, -0.012, 0), V3(-0.012, 0.060, 0), V3(0.010, 0.130, 0), V3(-0.004, 0.200, 0)], 0.066, 0.004),
      paintGeo(ell(0.026, 0.044, 0.026, 10, 8).translate(0, 0.046, 0), 0xfffbe0),
    ];
    mk(
      mergeGeometries(flameParts, false),
      std({ emissive: 0xff7a1c, emissiveIntensity: 0.85, roughness: 0.6, metalness: 0 }),
      flameGrp,
      'flameCrest'
    );

    // Three tiny golden sparks drifting up beside the flame
    const sparkles = new THREE.Group();
    sparkles.name = 'sparkles';
    crest.add(sparkles);
    const sparkParts = [
      paintGeo(starShapeGeo(THREE, 4, 0.030, 0.010, 0.009).translate(0.105, 0.235, 0.03), 0xfff8b8),
      paintGeo(starShapeGeo(THREE, 4, 0.022, 0.008, 0.008).translate(-0.098, 0.300, 0.02), 0xffe888),
      paintGeo(starShapeGeo(THREE, 4, 0.018, 0.006, 0.008).translate(0.050, 0.360, 0.02), 0xffe888),
    ];
    mk(
      mergeGeometries(sparkParts, false),
      std({ emissive: 0xffc438, emissiveIntensity: 1.25, roughness: 0.35, metalness: 0 }),
      sparkles,
      'crestSparkles'
    );

    return (t) => {
      sparkles.position.y = Math.sin(t * 4.2) * 0.012;
      sparkles.scale.setScalar(1 + Math.sin(t * 6.5) * 0.06);
      flameGrp.scale.set(1 + Math.sin(t * 11.0) * 0.06, 1 + Math.sin(t * 8.3) * 0.10, 1 + Math.cos(t * 9.7) * 0.06);
      flameGrp.rotation.z = Math.sin(t * 5.1) * 0.08;
      paneMat.emissiveIntensity = 0.90 + 0.18 * Math.sin(t * 3.4);
    };
  });
}
