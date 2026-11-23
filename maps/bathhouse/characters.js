/* Hue & Seek — Map 1 (bathhouse: Yu-Machi Spirit Bathhouse Quarter) Characters.
 * 3 rigged Storybook Chasers + 1 Suds-Star Hider Spirit (pearly bath-foam bubble spirit) built from
 * assets/maps/bathhouse/characters_sheet.png.
 * ALL materials strictly enforce metalness: 0 so gold, brass & copper gleam warmly!
 * Origin at ground between feet (y = 0), facing +Z, <= 18 draw calls per character.
 */
import {
  buildRiggedSeeker,
  buildRiggedHiderSpirit,
  RoundedBoxGeometry,
  mergeGeometries,
} from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

export const SEEKER_DEFS = [
  { id: 'bath_attendant', label: 'Bathhouse Attendant' },
  { id: 'boiler_apprentice', label: 'Boiler Apprentice' },
  { id: 'masked_warden', label: 'Masked Shrine Warden' },
];

export const HIDER_DEF = {
  id: 'suds_star',
  label: 'Suds-Star Spirit',
  color: 0xd2c4f2,
};

const SEEKER_DIMS = {
  bath_attendant: {
    main: 0xe05844,
    hipY: 0.62,
    legX: 0.102,
    neckY: 1.13,
    sh: [0.185, 1.06],
    a: 0.235,
    b: 0.225,
    tw: 0.18,
    twAim: 0.22,
    head: { c: [0, 1.34, 0.015], r: 0.198, s: [1.0, 0.96, 0.95] },
    rest: { p: [-0.08, 0.85, 0.19], r: [-0.24, 0.74, 0] },
    aim: { p: [-0.08, 0.91, 0.19], r: [-0.26, 0.74, 0] },
    gripF: [0, 0.015, 0.17],
    nozzle: [0, 0.078, 0.50],
    pole: [0.55, -0.6, -0.55],
  },
  boiler_apprentice: {
    main: 0x3b527a,
    hipY: 0.57,
    legX: 0.114,
    neckY: 1.10,
    sh: [0.225, 1.04],
    a: 0.245,
    b: 0.235,
    tw: 0.20,
    twAim: 0.12,
    head: { c: [0, 1.30, 0.02], r: 0.208, s: [1.05, 0.95, 0.96] },
    rest: { p: [-0.08, 0.82, 0.20], r: [-0.10, 0.74, 0] },
    aim: { p: [-0.06, 0.92, 0.22], r: [-0.14, 0.42, 0] },
    gripF: [0, 0.01, 0.17],
    nozzle: [0, 0.075, 0.49],
    pole: [0.58, -0.55, -0.52],
  },
  masked_warden: {
    main: 0x2b6e76,
    hipY: 0.64,
    legX: 0.102,
    neckY: 1.18,
    sh: [0.20, 1.11],
    a: 0.255,
    b: 0.245,
    tw: 0.16,
    twAim: 0.12,
    head: { c: [0, 1.38, 0.015], r: 0.194, s: [0.98, 0.98, 0.95] },
    rest: { p: [-0.08, 0.90, 0.19], r: [-0.20, 0.72, 0] },
    aim: { p: [-0.06, 1.00, 0.22], r: [-0.14, 0.42, 0] },
    gripF: [0, 0.01, 0.18],
    nozzle: [0, 0.082, 0.52],
    pole: [0.55, -0.6, -0.55],
  },
};

function rAtProfile(P, y) {
  for (let i = 0; i < P.length - 1; i++) {
    const [r0, y0] = P[i], [r1, y1] = P[i + 1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return P[P.length - 1][0];
}

// ============================================================================
// 1. Bathhouse Seekers (Chasers)
// ============================================================================
export function buildMapSeeker(THREE, kind = 'bath_attendant') {
  const id = typeof kind === 'string' ? kind : (kind && kind.kind) || 'bath_attendant';
  const k = SEEKER_DIMS[id] ? id : 'bath_attendant';
  const D = SEEKER_DIMS[k];

  const root = buildRiggedSeeker(THREE, k, D, (kit) => {
    const {
      SKIN, xf, sph, lathe, tor, rbox, tube, seg, cylz, qn,
      add, dec, lock, buildFace, buildArm,
    } = kit;

    const onT = (P, sz, az, y, out = 0) => {
      const r = rAtProfile(P, y) + out;
      return new THREE.Vector3(r * Math.sin(az), y, r * sz * Math.cos(az));
    };

    // Helper: add 3D hot-spring ♨ emblem onto any local frame
    const addOnsenSymbol = (gk, mk, pos, rot, scale, hex) => {
      add(gk, mk, xf(tor(0.022 * scale, 0.0045 * scale, [0, -0.010 * scale, 0], [0, 0, PI * 0.92], 1, PI * 1.16, 5, 12), pos, rot), hex);
      for (const ox of [-0.013, 0, 0.013]) {
        add(gk, mk, xf(tube([
          [ox * scale, -0.008 * scale, 0.001],
          [(ox - 0.004) * scale, 0.008 * scale, 0.002],
          [(ox + 0.004) * scale, 0.024 * scale, 0.001],
        ], 0.0036 * scale, 7, 5), pos, rot), hex);
      }
    };

    // ------------------------------------------------------------------------
    // A. bath_attendant — Coral-vermilion short yukata with white ♨ & sakura motifs,
    //    thick white obi bow, woven bamboo hip holster + white ♨ towel, geta sandals,
    //    high bun with white sakura kanzashi & red tassel + cheek band-aid,
    //    and green jointed-bamboo water cannon with golden ♨ pressure chamber!
    // ------------------------------------------------------------------------
    if (k === 'bath_attendant') {
      const WHITE = 0xfcf7ee, HAIR = 0x523223, WOOD = 0xe4b274, WOOD_D = 0xa9743c;
      const CORAL_D = 0xc64435, SAKURA_P = 0xffe2dc;
      const RED = 0xd4382c, GOLD = 0xf4c44e, GOLD_HI = 0xffe688;
      const BAMBOO = 0x7c983e, BAMBOO_L = 0xbad068, NAVY = 0x2c3452, BLUE_WAVE = 0x3b649e;

      // Matching coral-terracotta knee culottes + bare calves + two-tooth wooden Geta sandals
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.64, 0], [x, 0.44, 0.005], 0.082, 0.078, 12), CORAL_D);
        add(gk, 'cloth', tor(0.078, 0.008, [x, 0.445, 0.005], [PI / 2, 0, 0], 1, TAU, 5, 14), WHITE);
        add(gk, 'cloth', seg([x, 0.44, 0.005], [x, 0.09, 0.005], 0.052, 0.042, 12), SKIN);
        add(gk, 'cloth', sph(1, [x, 0.082, 0.045], [0.056, 0.036, 0.095], null, 12, 8), SKIN);
        // Wooden two-tooth Geta sandal platform (dai) + two distinct wooden teeth (ha) + red hanao straps
        add(gk, 'cloth', rbox(0.128, 0.030, 0.228, 0.008, [x, 0.056, 0.035]), WOOD);
        add(gk, 'cloth', rbox(0.122, 0.044, 0.032, 0.005, [x, 0.022, -0.026]), WOOD_D);
        add(gk, 'cloth', rbox(0.122, 0.044, 0.032, 0.005, [x, 0.022, 0.096]), WOOD_D);
        add(gk, 'cloth', tube([
          [x - 0.044, 0.070, 0.018], [x, 0.108, 0.088], [x + 0.044, 0.070, 0.018],
        ], 0.012, 12, 6), RED);
        add(gk, 'cloth', seg([x, 0.068, 0.108], [x, 0.100, 0.090], 0.010, 0.010, 8), RED);
      }

      // Coral-vermilion short work yukata (paint material so main colour tints cleanly)
      const side = [
        [0.258, 0.49], [0.266, 0.53], [0.240, 0.65], [0.194, 0.77],
        [0.190, 0.84], [0.206, 0.96], [0.194, 1.05], [0.146, 1.10], [0.086, 1.135],
      ];
      const sz = 0.86;
      add('torso', 'paint', lathe([[0, 0.50], ...side, [0, 1.14]], [0, 0, 0], [1, 1, sz], null, 24));

      // Neck + crisp white inner juban V-collar + white hem trim + 3 diagonal stripes on right hem + ♨ motif on left hem!
      add('torso', 'cloth', seg([0, 1.08, 0], [0, 1.21, 0.01], 0.048, 0.046), SKIN);
      for (const s of [-1, 1]) {
        add('torso', 'cloth', tube([
          onT(side, sz, s * 0.42, 1.12, 0.010),
          onT(side, sz, s * 0.18, 0.98, 0.014),
          onT(side, sz, -s * 0.06, 0.84, 0.014),
        ], 0.019, 12, 6), WHITE);
      }
      // 3 crisp white diagonal hem stripes on right skirt (-X, viewer's left)
      for (const az of [-0.24, -0.36, -0.48]) {
        add('torso', 'cloth', tube([
          onT(side, sz, az, 0.515, 0.009),
          onT(side, sz, az - 0.05, 0.595, 0.009),
        ], 0.0075, 8, 5), WHITE);
      }
      // Crisp white ♨ hot-spring motif on left front yukata skirt (+X, viewer's right — matching characters_sheet!)
      {
        const hp = onT(side, sz, 0.36, 0.575, 0.011);
        addOnsenSymbol('torso', 'cloth', [hp.x, hp.y, hp.z], [-0.22, 0.34, 0], 1.35, WHITE);
      }
      // Delicate 5-petal sakura motifs on yukata
      for (const [az, sy] of [[-0.28, 0.94], [0.34, 0.66], [-0.52, 0.64]]) {
        const sp = onT(side, sz, az, sy, 0.009);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          add('torso', 'cloth', sph(1, [sp.x + Math.cos(a) * 0.014, sp.y + Math.sin(a) * 0.014, sp.z + 0.003], [0.008, 0.012, 0.005], [0, az, a], 6, 5), SAKURA_P);
        }
      }

      // Thick white pleated Obi sash + plump front tied bow & flared ribbon tails
      add('torso', 'cloth', lathe([
        [0.192, 0.73], [0.210, 0.752], [0.210, 0.84], [0.192, 0.856],
      ], [0, 0, 0], [1, 1, sz + 0.035], null, 24), WHITE);
      add('torso', 'cloth', sph(1, [0, 0.795, 0.196], [0.046, 0.042, 0.035], null, 10, 8), WHITE);
      for (const s of [-1, 1]) {
        add('torso', 'cloth', tube([
          [0, 0.795, 0.196], [s * 0.082, 0.832, 0.212], [s * 0.132, 0.798, 0.188],
          [s * 0.072, 0.765, 0.196], [0, 0.795, 0.196],
        ], 0.021, 14, 6, true), WHITE);
        add('torso', 'cloth', rbox(0.058, 0.185, 0.020, 0.009, [s * 0.060, 0.695, 0.212], [-0.14, 0, -s * 0.24]), WHITE);
      }

      // Crisp white Tasuki cords crossing on back
      for (const s of [-1, 1]) {
        add('torso', 'cloth', tube([
          [s * 0.18, 0.94, 0.10],
          [s * 0.19, 1.095, 0.04],
          [s * 0.14, 1.085, -0.10],
          [0, 0.96, -0.172],
          [-s * 0.15, 0.85, -0.145],
          [-s * 0.19, 0.90, 0.02],
        ], 0.014, 18, 6), WHITE);
      }

      // Woven bamboo bath-bucket hip holster on her right hip (-X, viewer's left) + draped white ♨ towel!
      const bx = -0.245, by = 0.615, bz = 0.055;
      const holRot = [0.08, 0.24, 0.20];
      // Tapered woven bamboo holster body + horizontal dark bamboo bands + shoulder/hip strap
      add('torso', 'cloth', xf(rbox(0.145, 0.165, 0.145, 0.028, [0, 0, 0]), [bx, by, bz], holRot), WOOD);
      for (const hy of [-0.048, 0.015, 0.072]) {
        add('torso', 'cloth', xf(rbox(0.154, 0.018, 0.154, 0.006, [0, hy, 0]), [bx, by, bz], holRot), WOOD_D);
      }
      add('torso', 'cloth', tube([
        [bx + 0.03, by + 0.08, bz - 0.04], [-0.18, 0.75, 0.02],
        [bx + 0.02, by + 0.08, bz + 0.05],
      ], 0.010, 10, 5), WOOD_D);
      // Draped white bath towel hanging over the front-outer face of the bamboo holster with blue ♨ & wave stripes!
      const twPos = [bx - 0.042, by - 0.008, bz + 0.068];
      const twRot = [0.06, -0.36, 0.18];
      add('torso', 'cloth', xf(rbox(0.105, 0.155, 0.024, 0.009, [0, 0, 0]), twPos, twRot), WHITE);
      add('torso', 'cloth', xf(rbox(0.107, 0.012, 0.026, 0.003, [0, -0.048, 0.002]), twPos, twRot), BLUE_WAVE);
      add('torso', 'cloth', xf(rbox(0.107, 0.008, 0.026, 0.002, [0, -0.064, 0.002]), twPos, twRot), BLUE_WAVE);
      addOnsenSymbol('torso', 'cloth', [twPos[0] - 0.006, twPos[1] + 0.006, twPos[2] + 0.014], twRot, 1.05, BLUE_WAVE);

      // Cheerful face + cute cheek band-aid on her right cheek (-X) + high hair bun & sakura kanzashi + red tassel!
      buildFace({ iris: 0x522f1e, iris2: 0xd08348, brow: 0x3b2218, browRoll: 0.24, mouth: 'laugh', eyeK: 1.05 });
      // Band-aid on her right cheek (-X, viewer's left, right below eye!)
      dec('head', 'cloth', -0.62, -0.22, 0.006, [0.034, 0.018, 0.007], 0xf6dfc2, 0.26);
      dec('head', 'cloth', -0.62, -0.22, 0.008, [0.014, 0.015, 0.005], 0xe8c8a2, 0.26);

      add('head', 'cloth', sph(1, [0, 1.365, -0.032], [0.214, 0.204, 0.20], null, 20, 14), HAIR);
      add('head', 'cloth', sph(1, [0, 1.255, -0.085], [0.188, 0.095, 0.14], null, 16, 10), HAIR);
      for (const [az, l] of [[-0.58, 0.048], [-0.32, 0.056], [-0.08, 0.058], [0.14, 0.056], [0.36, 0.052], [0.58, 0.046]]) {
        lock(az, 0.46, 0.012, [0.058, l, 0.028], HAIR, -az * 0.28, -0.10);
      }
      for (const s of [-1, 1]) {
        lock(s * 0.96, 0.08, 0.016, [0.070, 0.102, 0.044], HAIR, -s * 0.14, -0.20);
        lock(s * 1.28, 0.05, 0.026, [0.066, 0.090, 0.044], HAIR, -s * 0.18, -0.24);
      }

      // High fluffy chignon bun on upper-right crown (-X, viewer's left) + red braided cord + white sakura kanzashi + gold rod & red tassel!
      const bunC = [-0.112, 1.545, -0.020];
      add('head', 'cloth', sph(1, bunC, [0.124, 0.114, 0.114], [0.12, 0, 0.26], 16, 12), HAIR);
      add('head', 'cloth', tor(0.090, 0.018, [-0.086, 1.486, -0.008], [PI / 2 + 0.18, 0, 0.35], 1, TAU, 6, 16), RED);
      // Golden kanzashi hairpin rod + ball finial + dangling crimson silk tassel on -X
      add('head', 'cloth', seg([0.01, 1.490, -0.025], [-0.285, 1.590, -0.005], 0.010, 0.012, 8), GOLD);
      add('head', 'cloth', sph(0.024, [-0.292, 1.594, -0.005], 1, null, 8, 6), GOLD_HI);
      add('head', 'cloth', seg([-0.268, 1.580, -0.005], [-0.268, 1.484, -0.005], 0.005, 0.005, 6), GOLD);
      add('head', 'cloth', sph(0.014, [-0.268, 1.484, -0.005], 1, null, 7, 5), GOLD);
      add('head', 'cloth', lathe([[0, 1.395], [0.031, 1.395], [0.024, 1.438], [0.010, 1.484]], [-0.268, 0, -0.005], 1, null, 10), RED);
      // Crisp 5-petal white sakura kanzashi flower + golden center + tiny red buds
      {
        const fc = new THREE.Vector3(-0.108, 1.512, 0.084), fn = new THREE.Vector3(-0.22, 0.24, 0.94).normalize();
        const fq = qn(fn);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          const off = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(0.035).applyQuaternion(fq);
          add('head', 'cloth', sph(1, fc.clone().add(off), [0.023, 0.035, 0.011], qn(fn, a - PI / 2), 8, 6), WHITE);
        }
        add('head', 'cloth', sph(0.016, fc.clone().addScaledVector(fn, 0.009), 1, null, 8, 6), GOLD);
        add('head', 'cloth', sph(0.012, [-0.145, 1.474, 0.076], 1, null, 7, 5), RED);
        add('head', 'cloth', sph(0.011, [-0.078, 1.470, 0.080], 1, null, 7, 5), RED);
      }

      // Arms: flared coral yukata tamoto sleeves with white cuffs + white ♨ shoulder mark + navy wrist guards
      for (const s of [1, -1]) {
        buildArm(s, { upper: 0xffffff, upperMat: 'paint', r1: 0.076, puff: 0.082, sleeve: 0.78, cuffU: WHITE, rs: 0.044, hand: 0.050 });
        const ug = s > 0 ? 'upperL' : 'upperR', fg = s > 0 ? 'foreL' : 'foreR';
        // Draped kimono tamoto sleeve pouch hanging gracefully under upper arm
        add(ug, 'paint', rbox(0.115, 0.155, 0.145, 0.032, [s * 0.012, -0.115, -0.035], [0.18, 0, 0]), 0xffffff);
        add(ug, 'cloth', rbox(0.118, 0.150, 0.022, 0.007, [s * 0.012, -0.115, 0.038], [0.18, 0, 0]), WHITE);
        if (s < 0) {
          addOnsenSymbol(ug, 'cloth', [-0.074, -0.095, 0.01], [0, -PI * 0.45, 0], 0.96, WHITE);
        }
        add(fg, 'cloth', seg([0, -D.b * 0.54, 0], [0, -D.b * 0.88, 0], 0.047, 0.044, 10, false), NAVY);
      }

      // Green jointed-bamboo water cannon with golden ♨ pressure chamber (nozzle at [0, 0.078, 0.50])
      add('weapon', 'cloth', cylz(0.052, 0.055, 0.09, 0.485, 0, 0.078, 16), BAMBOO);
      for (const z of [0.165, 0.305, 0.435]) {
        add('weapon', 'cloth', tor(0.055, 0.010, [0, 0.078, z], null, 1, TAU, 6, 16), BAMBOO_L);
      }
      add('weapon', 'cloth', cylz(0.062, 0.058, 0.465, 0.50, 0, 0.078, 16), GOLD);
      add('weapon', 'cloth', sph(1, [0, 0.078, 0.501], [0.038, 0.038, 0.006], null, 10, 6), 0x24261c);
      // Golden ♨ pressure chamber drum with 3D hot-spring emblem on both sides!
      add('weapon', 'cloth', cylz(0.058, 0.060, -0.065, 0.105, 0, 0.076, 16), GOLD);
      for (const sx of [-1, 1]) {
        add('weapon', 'cloth', sph(1, [sx * 0.058, 0.080, 0.035], [0.014, 0.048, 0.048], null, 12, 8), GOLD_HI);
        add('weapon', 'cloth', sph(1, [sx * 0.066, 0.080, 0.035], [0.008, 0.036, 0.036], null, 10, 8), WHITE);
        addOnsenSymbol('weapon', 'cloth', [sx * 0.073, 0.080, 0.035], [0, sx * PI * 0.5, 0], 0.82, WOOD_D);
      }
      add('weapon', 'cloth', rbox(0.064, 0.086, 0.15, 0.02, [0, 0.052, -0.135], [0.12, 0, 0]), WOOD_D);
      add('weapon', 'cloth', rbox(0.046, 0.112, 0.054, 0.016, [0, -0.022, -0.005], [0.32, 0, 0]), WOOD_D);
      add('weapon', 'cloth', cylz(0.032, 0.032, 0.105, 0.275, 0, 0.016, 12), GOLD);
    }

    // ------------------------------------------------------------------------
    // B. boiler_apprentice — Tousled brown hair + brass steampunk goggles, soot smudges,
    //    white rolled-sleeve shirt + indigo denim bib overalls with golden gear emblem &
    //    front tool pocket, rolled cuffs & chunky laced boots, GIANT Riveted Copper
    //    Steam-Boiler Backpack (glowing furnace grate, top gauge, J-vent & curved hose),
    //    and riveted copper-brass pepperbox steam-water cannon!
    // ------------------------------------------------------------------------
    if (k === 'boiler_apprentice') {
      const CREAM = 0xf5ebd8, CUFF = 0xd6ccb8, INDIGO = 0x3b527a, INDIGO_D = 0x2e4266, HAIR = 0x4b2f20;
      const BOOT = 0x764c2e, SOLE = 0x322116, SOOT = 0x4e3f38;
      const COPPER = 0xd6743c, COPPER_HI = 0xee9458, BRASS = 0xf4c248, BRASS_HI = 0xffe486, HOSE = 0x3f3835;

      // Baggy indigo denim legs + thick rolled oatmeal cuffs + chunky laced brown boots with brass buckles
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.59, 0], [x, 0.25, 0.005], 0.100, 0.106, 14), INDIGO);
        add(gk, 'cloth', lathe([
          [0.088, 0.212], [0.118, 0.224], [0.120, 0.278], [0.098, 0.288],
        ], [x, 0, 0.005], 1, null, 16), CUFF);
        add(gk, 'cloth', lathe([
          [0.070, 0.03], [0.082, 0.06], [0.078, 0.215], [0, 0.22],
        ], [x, 0, 0], 1, null, 16), BOOT);
        add(gk, 'cloth', sph(1, [x, 0.064, 0.058], [0.084, 0.060, 0.120], null, 14, 10), BOOT);
        add(gk, 'cloth', rbox(0.160, 0.034, 0.242, 0.012, [x, 0.017, 0.036]), SOLE);
        // Boot strap + gleaming brass buckle + cross laces
        add(gk, 'cloth', rbox(0.150, 0.028, 0.095, 0.008, [x, 0.145, 0.035]), 0x5c3920);
        add(gk, 'cloth', rbox(0.058, 0.042, 0.020, 0.006, [x, 0.145, 0.082]), BRASS);
        for (const ly of [0.095, 0.118]) {
          add(gk, 'cloth', rbox(0.056, 0.010, 0.014, 0.003, [x, ly, 0.092]), 0x3b2415);
        }
      }

      // White work shirt + weathered Indigo Denim Bib Overalls
      const side = [
        [0.270, 0.48], [0.282, 0.52], [0.266, 0.64], [0.240, 0.77],
        [0.230, 0.88], [0.214, 0.98], [0.176, 1.04],
      ];
      const sz = 0.88;
      add('torso', 'paint', lathe([[0, 0.49], ...side, [0, 1.045]], [0, 0, 0], [1, 1, sz], null, 24));
      add('torso', 'cloth', lathe([
        [0.18, 0.95], [0.218, 1.005], [0.198, 1.07], [0.136, 1.108], [0, 1.112],
      ], [0, 0, 0], [1, 1, sz], null, 20), CREAM);
      // Square denim front bib panel rising cleanly over the white shirt
      add('torso', 'paint', rbox(0.24, 0.18, 0.04, 0.012, [0, 0.95, 0.172], [-0.14, 0, 0]), 0xffffff);
      add('torso', 'cloth', seg([0, 1.06, 0], [0, 1.19, 0.01], 0.055, 0.052), SKIN);
      add('torso', 'cloth', tor(0.076, 0.022, [0, 1.105, 0.02], [PI / 2 - 0.25, 0, 0], 1, TAU, 6, 16), CREAM);

      // Tied indigo waist sash + leather overall straps & brass buckles + bold 8-tooth Golden Gear Emblem + front tool pocket
      add('torso', 'paint', tor(0.226, 0.028, [0, 0.755, 0], [PI / 2, 0, 0], [1, 1, sz + 0.035], TAU, 7, 22), 0xffffff);
      add('torso', 'cloth', sph(1, [0.095, 0.752, 0.205], [0.036, 0.032, 0.028], null, 8, 6), INDIGO_D);
      add('torso', 'paint', rbox(0.062, 0.19, 0.024, 0.009, [0.115, 0.645, 0.215], [-0.12, 0.25, -0.14]), 0xffffff);
      add('torso', 'paint', rbox(0.056, 0.17, 0.022, 0.008, [0.068, 0.650, 0.222], [-0.10, 0.15, 0.06]), 0xffffff);

      for (const s of [-1, 1]) {
        add('torso', 'cloth', tube([
          [s * 0.115, 0.99, 0.175], [s * 0.152, 1.098, 0.04],
          [s * 0.155, 1.075, -0.10], [s * 0.135, 0.89, -0.198],
        ], 0.020, 16, 6), BOOT);
        add('torso', 'cloth', rbox(0.050, 0.042, 0.022, 0.006, [s * 0.118, 1.012, 0.178], [-0.22, 0, 0]), BRASS);
      }
      // Golden 8-tooth Gear Chest Emblem
      add('torso', 'cloth', tor(0.040, 0.013, [0, 0.945, 0.198], [-0.14, 0, 0], 1, TAU, 6, 18), BRASS);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        add('torso', 'cloth', rbox(0.016, 0.024, 0.014, 0.003,
          [Math.cos(a) * 0.052, 0.945 + Math.sin(a) * 0.052, 0.198 + Math.sin(a) * 0.007],
          [-0.14, 0, a]), BRASS_HI);
      }
      // Front utility pocket holding wrench & screwdriver
      add('torso', 'cloth', rbox(0.165, 0.135, 0.028, 0.009, [-0.015, 0.605, 0.232], [0.08, -0.04, 0]), INDIGO_D);
      add('torso', 'cloth', seg([0.025, 0.645, 0.238], [0.040, 0.728, 0.242], 0.010, 0.010, 8), 0xd8e0e8);
      add('torso', 'cloth', tor(0.020, 0.007, [0.043, 0.740, 0.243], [0, 0, 0.22], 1, PI * 1.45, 5, 10), 0xd8e0e8);
      add('torso', 'cloth', seg([-0.038, 0.645, 0.238], [-0.045, 0.718, 0.242], 0.012, 0.012, 8), BRASS);

      // GIANT Riveted Copper Steam-Boiler Backpack!
      // Positioned high & offset to -X (viewer's left) so tank, glowing furnace grate,
      // pressure gauge, J-vent & curved ribbed hose silhouette proudly just like characters_sheet.png!
      const bx = -0.205, bz = -0.155;
      add('torso', 'cloth', lathe([
        [0, 0.54], [0.125, 0.558], [0.174, 0.625], [0.176, 1.20], [0.126, 1.275], [0, 1.31],
      ], [bx, 0, bz], 1, null, 20), COPPER);
      // Riveted golden-brass boiler bands + round rivets
      for (const y of [0.63, 0.88, 1.17]) {
        add('torso', 'cloth', tor(0.179, 0.016, [bx, y, bz], [PI / 2, 0, 0], 1, TAU, 6, 20), BRASS);
        for (let r = 0; r < 10; r++) {
          const ra = (r / 10) * TAU;
          add('torso', 'cloth', sph(0.010, [bx + Math.sin(ra) * 0.192, y, bz + Math.cos(ra) * 0.192], 1, null, 6, 4), BRASS_HI);
        }
      }
      // Glowing fiery-orange vertical furnace grate window + copper grate bars!
      add('torso', 'glow', lathe([[0.180, 0.66], [0.180, 0.85]], [bx, 0, bz], 1, null, 18), 0xffc854);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        add('torso', 'cloth', seg(
          [bx + Math.sin(a) * 0.185, 0.65, bz + Math.cos(a) * 0.185],
          [bx + Math.sin(a) * 0.185, 0.86, bz + Math.cos(a) * 0.185],
          0.0085, 0.0085, 6, false
        ), COPPER_HI);
      }
      // Curved overhead copper J-vent steam pipe rising proudly above right shoulder
      add('torso', 'cloth', sph(0.036, [bx, 1.315, bz], 1, null, 8, 6), BRASS);
      add('torso', 'cloth', tube([
        [bx, 1.305, bz], [bx - 0.02, 1.435, bz + 0.02], [bx - 0.11, 1.425, bz + 0.05], [bx - 0.115, 1.34, bz + 0.06],
      ], 0.026, 14, 7), COPPER_HI);
      add('torso', 'cloth', tor(0.029, 0.007, [bx - 0.115, 1.34, bz + 0.06], [PI / 2, 0, 0], 1, TAU, 5, 10), BRASS);
      // Large round brass pressure gauge facing forward-left (+Z/-X) so dial & needle show clearly!
      const gx = bx - 0.105, gy = 1.03, gz = bz + 0.145;
      add('torso', 'cloth', xf(cylz(0.066, 0.066, -0.018, 0.020, 0, 0, 16), [gx, gy, gz], [0, -0.52, 0]), BRASS);
      add('torso', 'cloth', xf(sph(1, [0, 0, 0.021], [0.052, 0.052, 0.006], null, 12, 6), [gx, gy, gz], [0, -0.52, 0]), 0xfffaf0);
      add('torso', 'cloth', xf(rbox(0.007, 0.036, 0.006, 0.002, [0.008, 0.008, 0.026], [0, 0, -0.6]), [gx, gy, gz], [0, -0.52, 0]), 0xc83226);
      // Thick ribbed dark steam hose curving out around -X hip toward his cannon!
      const hosePts = [
        [bx - 0.02, 0.54, bz + 0.02],
        [-0.31, 0.48, -0.10],
        [-0.36, 0.55, 0.08],
        [-0.27, 0.67, 0.20],
        [-0.14, 0.76, 0.24],
      ];
      add('torso', 'cloth', tube(hosePts, 0.030, 20, 7), HOSE);
      for (const [hx, hy2, hz, ry2] of [
        [-0.34, 0.51, -0.01, 0.3], [-0.35, 0.58, 0.11, 0.1], [-0.27, 0.67, 0.20, -0.4],
      ]) {
        add('torso', 'cloth', tor(0.033, 0.0065, [hx, hy2, hz], [0.7, ry2, 0], 1, TAU, 5, 10), 0x26211f);
      }

      // Broad cheerful face + soot smudges on cheeks + spiky tousled chestnut hair + brass steampunk goggles!
      buildFace({
        iris: 0x4b2e1e, brow: 0x352015, browSc: [0.054, 0.016, 0.013],
        browRoll: 0.22, mouth: 'grin',
      });
      // Soot smudges on cheeks & nose bridge!
      dec('head', 'cloth', -0.64, -0.26, 0.004, [0.034, 0.018, 0.006], SOOT, -0.22);
      dec('head', 'cloth', 0.62, -0.28, 0.004, [0.030, 0.016, 0.006], SOOT, 0.25);
      dec('head', 'cloth', -0.18, -0.12, 0.003, [0.018, 0.010, 0.005], SOOT, 0.12);

      // Compact skull cap + tousled upward/outward Storybook hair spikes framing the goggles!
      add('head', 'cloth', sph(1, [0, 1.325, -0.035], [0.214, 0.188, 0.198], null, 20, 14), HAIR);
      for (const [az, el, out, l, bnd] of [
        [-0.44, 0.30, 0.012, 0.048, -0.22], [-0.14, 0.32, 0.012, 0.052, -0.24],
        [0.16, 0.32, 0.012, 0.052, -0.24], [0.44, 0.30, 0.012, 0.048, -0.22],
        [-0.86, 0.26, 0.024, 0.076, -0.45], [0.86, 0.26, 0.024, 0.076, -0.45],
        [-1.18, 0.10, 0.028, 0.078, -0.48], [1.18, 0.10, 0.028, 0.078, -0.48],
      ]) {
        lock(az, el, out, [0.066, l, 0.038], HAIR, -az * 0.22, bnd);
      }
      // Sculpted spiky crown & temple hair tufts sprouting above & behind the goggles!
      for (const [sx2, sy2, sz2, rx2, ry2, rz2, rB, hS] of [
        [0.00, 1.545, -0.02, -0.18, 0, -0.06, 0.068, 0.135],
        [-0.088, 1.530, -0.01, -0.15, 0.1, 0.42, 0.062, 0.125],
        [0.088, 1.530, -0.01, -0.15, -0.1, -0.42, 0.062, 0.125],
        [-0.165, 1.475, 0.02, -0.08, 0.2, 0.86, 0.056, 0.115],
        [0.165, 1.475, 0.02, -0.08, -0.2, -0.86, 0.056, 0.115],
        [-0.205, 1.385, 0.03, 0.05, 0.3, 1.25, 0.050, 0.100],
        [0.205, 1.385, 0.03, 0.05, -0.3, -1.25, 0.050, 0.100],
        [0.00, 1.505, -0.11, -0.58, 0, 0, 0.068, 0.125],
      ]) {
        add('head', 'cloth', lathe([[rB, 0], [rB * 0.55, hS * 0.55], [0, hS]], [sx2, sy2 - hS * 0.3, sz2], [1, 1, 0.78], [rx2, ry2, rz2], 10), HAIR);
      }

      // Chunky Brass-Rimmed Steampunk Goggles on forehead!
      add('head', 'cloth', tor(0.212, 0.020, [0, 1.388, -0.015], [PI / 2 - 0.34, 0, 0], [1.04, 0.98, 1], TAU, 6, 22), BOOT);
      add('head', 'cloth', rbox(0.058, 0.024, 0.024, 0.006, [0, 1.460, 0.194], [-0.35, 0, 0]), BRASS_HI);
      for (const s of [-1, 1]) {
        const gp = [s * 0.090, 1.454, 0.178], gr = [-0.38, s * 0.30, -s * 0.10];
        add('head', 'cloth', xf(cylz(0.062, 0.064, -0.024, 0.026, 0, 0, 16), gp, gr), BRASS);
        add('head', 'cloth', xf(tor(0.062, 0.012, [0, 0, 0.026], null, 1, TAU, 6, 16), gp, gr), BRASS_HI);
        add('head', 'cloth', xf(sph(1, [0, 0, 0.020], [0.052, 0.052, 0.010], null, 12, 8), gp, gr), 0xc89238);
        add('head', 'glass', xf(sph(1, [0, 0, 0.027], [0.054, 0.054, 0.014], null, 12, 8), gp, gr), 0xffffff);
      }

      // Rolled white shirt sleeves + sturdy bare forearms with soot smudge!
      for (const s of [1, -1]) {
        buildArm(s, { upper: CREAM, upperMat: 'cloth', r1: 0.082, puff: 0.076, sleeve: 0.78, cuffU: 0xe6d8bc, rs: 0.052, hand: 0.056 });
        const ug = s > 0 ? 'upperL' : 'upperR';
        add(ug, 'cloth', tor(0.082, 0.022, [0, -D.a * 0.76, 0], [PI / 2, 0, 0], 1, TAU, 6, 16), CREAM);
        if (s < 0) {
          add('foreR', 'cloth', sph(1, [-0.032, -0.09, 0.032], [0.018, 0.030, 0.010], [0, 0.5, 0], 7, 5), SOOT);
        }
      }

      // Riveted Copper-Brass Pepperbox Steam-Water Cannon (nozzle at [0, 0.075, 0.49])
      add('weapon', 'cloth', cylz(0.060, 0.064, -0.06, 0.405, 0, 0.075, 16), COPPER);
      for (const z of [-0.02, 0.145, 0.315]) {
        add('weapon', 'cloth', tor(0.064, 0.011, [0, 0.075, z], null, 1, TAU, 6, 16), BRASS);
      }
      // Glowing fiery-orange side furnace slots!
      add('weapon', 'glow', rbox(0.128, 0.036, 0.145, 0.008, [0, 0.072, 0.230]), 0xffc44d);
      for (const zBar of [0.195, 0.230, 0.265]) {
        add('weapon', 'cloth', rbox(0.132, 0.040, 0.012, 0.003, [0, 0.072, zBar]), COPPER_HI);
      }
      // Perforated golden-brass pepperbox muzzle drum with 7 dark jet holes!
      add('weapon', 'cloth', cylz(0.078, 0.074, 0.40, 0.49, 0, 0.075, 18), BRASS);
      add('weapon', 'cloth', tor(0.076, 0.009, [0, 0.075, 0.486], null, 1, TAU, 5, 18), BRASS_HI);
      add('weapon', 'cloth', sph(1, [0, 0.075, 0.492], [0.016, 0.016, 0.005], null, 8, 5), 0x241a14);
      for (let h = 0; h < 6; h++) {
        const ha = (h / 6) * TAU;
        add('weapon', 'cloth', sph(1, [Math.cos(ha) * 0.040, 0.075 + Math.sin(ha) * 0.040, 0.492], [0.013, 0.013, 0.005], null, 8, 5), 0x241a14);
      }
      // Top-mounted brass pressure gauge with white dial & needle!
      add('weapon', 'cloth', seg([0, 0.135, 0.125], [0, 0.175, 0.125], 0.011, 0.011, 8), BRASS);
      add('weapon', 'cloth', cylz(0.042, 0.042, 0.110, 0.140, 0, 0.200, 14), BRASS_HI);
      add('weapon', 'cloth', sph(1, [0, 0.200, 0.142], [0.032, 0.032, 0.005], null, 10, 6), 0xfffaf0);
      add('weapon', 'cloth', sph(1, [0, 0.200, 0.108], [0.032, 0.032, 0.005], null, 10, 6), 0xfffaf0);
      add('weapon', 'cloth', rbox(0.050, 0.118, 0.056, 0.016, [0, -0.022, -0.005], [0.30, 0, 0]), BOOT);
      add('weapon', 'cloth', cylz(0.034, 0.034, 0.08, 0.26, 0, 0.008, 12), BRASS);
    }

    // ------------------------------------------------------------------------
    // C. masked_warden — Spiky dark ponytail + tilted Kitsune Fox Mask, cream kimono
    //    sleeves under teal-jade sleeveless haori with golden seigaiha ocean-wave hems,
    //    pleated deep-indigo hakama with gold waves, white tabi & straw zori sandals,
    //    braided white waist cord with red tassels & wooden ♨ plaque, and ornate
    //    Red & Gold Dragon-Head Water Blaster with glowing sapphire-blue chamber!
    // ------------------------------------------------------------------------
    if (k === 'masked_warden') {
      const HAKAMA = 0x28324e, HAKAMA_HI = 0x354266, CREAM = 0xf6eedc, WHITE = 0xfcf8f0, HAIR = 0x261d1b;
      const GOLD = 0xf4c44e, GOLD_HI = 0xffe68a, RED = 0xd1362b, WOOD = 0xd69a5c;

      // Wide pleated deep-indigo Hakama trousers + golden seigaiha waves + white tabi socks & straw zori sandals!
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
        add(gk, 'cloth', lathe([
          [0.098, 0.19], [0.144, 0.205], [0.134, 0.42], [0.115, 0.64], [0, 0.65],
        ], [x, 0, 0], [0.96, 1, 1.08], null, 18), HAKAMA);
        // Sculpted vertical hakama pleat flutes on front
        for (const px of [-0.042, 0, 0.042]) {
          add(gk, 'cloth', seg([x + px, 0.60, 0.118], [x + px * 1.15, 0.22, 0.142], 0.011, 0.013, 8, false), HAKAMA_HI);
        }
        // Gold hem band + golden seigaiha wave arches (prominent on left leg s > 0!)
        add(gk, 'cloth', lathe([
          [0.145, 0.205], [0.143, 0.232],
        ], [x, 0, 0], [0.97, 1, 1.09], null, 18), GOLD);
        if (s > 0) {
          for (const wa of [-0.45, 0, 0.45]) {
            const wx = x + Math.sin(wa) * 0.138, wz = Math.cos(wa) * 0.154;
            add(gk, 'cloth', tor(0.032, 0.006, [wx, 0.235, wz], [0, wa, 0], 1, PI, 5, 10), GOLD_HI);
            add(gk, 'cloth', tor(0.019, 0.005, [wx, 0.232, wz + 0.002], [0, wa, 0], 1, PI, 5, 8), GOLD);
          }
        }
        // White tabi socks + red ankle cord + woven straw zori sandals
        add(gk, 'cloth', seg([x, 0.20, 0], [x, 0.05, 0.005], 0.052, 0.048, 12), WHITE);
        add(gk, 'cloth', tor(0.053, 0.011, [x, 0.152, 0.004], [PI / 2, 0, 0], 1, TAU, 5, 14), RED);
        add(gk, 'cloth', sph(1, [x, 0.055, 0.045], [0.060, 0.036, 0.102], null, 12, 8), WHITE);
        add(gk, 'cloth', rbox(0.132, 0.030, 0.230, 0.010, [x, 0.015, 0.035]), WOOD);
        add(gk, 'cloth', tube([
          [x - 0.048, 0.034, 0.02], [x, 0.082, 0.088], [x + 0.048, 0.034, 0.02],
        ], 0.011, 12, 6), HAKAMA);
        add(gk, 'cloth', seg([x, 0.034, 0.105], [x, 0.078, 0.088], 0.009, 0.009, 8), RED);
      }

      add('torso', 'cloth', lathe([
        [0, 0.56], [0.215, 0.58], [0.205, 0.78], [0.195, 1.02], [0.135, 1.16], [0, 1.18],
      ], [0, 0, 0], [1, 1, 0.84], null, 20), HAKAMA);
      add('torso', 'cloth', seg([0, 1.12, 0], [0, 1.25, 0.01], 0.048, 0.046), SKIN);

      // Flared Teal-Jade Sleeveless Haori Coat with Golden Seigaiha Ocean-Wave Hems!
      const haori = [
        [0.305, 0.49], [0.312, 0.53], [0.272, 0.68], [0.228, 0.82],
        [0.234, 0.98], [0.254, 1.12], [0.175, 1.18],
      ];
      add('torso', 'paint', lathe([[0.22, 0.49], ...haori, [0.12, 1.185]], [0, 0, 0], [1, 1, 0.88], [0, 0.28, 0], 24, 0, TAU - 0.56));
      for (const s of [-1, 1]) {
        // Samurai shoulder wing + golden brocade edge + golden chrysanthemum chest clasp
        add('torso', 'paint', rbox(0.125, 0.038, 0.235, 0.012, [s * 0.208, 1.155, -0.005], [0, 0, -s * 0.22]), 0xffffff);
        add('torso', 'cloth', rbox(0.024, 0.040, 0.240, 0.006, [s * 0.262, 1.142, -0.005], [0, 0, -s * 0.22]), GOLD);
        add('torso', 'cloth', tube([
          onT(haori, 0.88, s * 0.30, 0.50, 0.010),
          onT(haori, 0.88, s * 0.28, 0.82, 0.012),
          onT(haori, 0.88, s * 0.34, 1.16, 0.012),
        ], 0.017, 14, 6), GOLD);
        add('torso', 'cloth', sph(1, [s * 0.118, 1.055, 0.168], [0.026, 0.026, 0.012], [0, s * 0.25, 0], 10, 8), GOLD_HI);
        add('torso', 'cloth', tube([
          [s * 0.14, 1.16, 0.12], [s * 0.04, 0.96, 0.175],
        ], 0.015, 10, 6), WHITE);
      }
      // Golden lower haori hem + sculpted 3D golden Seigaiha ocean-wave arches all around flared haori skirt!
      add('torso', 'cloth', lathe([
        [0.314, 0.49], [0.308, 0.535],
      ], [0, 0, 0], [1, 1, 0.89], [0, 0.28, 0], 24, 0, TAU - 0.56), GOLD);
      for (const az of [-2.4, -1.9, -1.4, -0.95, -0.52, 0.52, 0.95, 1.4, 1.9, 2.4]) {
        const wp = onT(haori, 0.89, az, 0.535, 0.008);
        const wq = [0, az, 0];
        add('torso', 'cloth', tor(0.044, 0.0075, [wp.x, wp.y, wp.z], wq, 1, PI, 5, 12), GOLD_HI);
        add('torso', 'cloth', tor(0.026, 0.006, [wp.x, wp.y - 0.004, wp.z], wq, 1, PI, 5, 10), GOLD);
        const wp2 = onT(haori, 0.89, az * 0.96, 0.585, 0.008);
        add('torso', 'cloth', tor(0.036, 0.0065, [wp2.x, wp2.y, wp2.z], wq, 1, PI, 5, 10), GOLD);
      }

      // Braided white Shimenawa waist cord + double bow loops + white & red tassels + wooden ♨/sakura plaque!
      add('torso', 'cloth', tor(0.214, 0.024, [0, 0.805, 0], [PI / 2, 0, 0], [1, 1, 0.90], TAU, 7, 20), WHITE);
      for (const s of [-1, 1]) {
        add('torso', 'cloth', tor(0.040, 0.015, [s * 0.046, 0.802, 0.198], [0, s * 0.25, 0], 1, TAU, 6, 12), WHITE);
        add('torso', 'cloth', lathe([[0, 0.66], [0.025, 0.66], [0.018, 0.72], [0.009, 0.78]],
          [s * 0.040, 0, 0.205], 1, null, 10), s > 0 ? RED : WHITE);
      }
      // Hanging wooden ♨ plaque on red cord (-X front hip)
      add('torso', 'cloth', seg([-0.08, 0.79, 0.19], [-0.118, 0.72, 0.192], 0.006, 0.006, 6), RED);
      add('torso', 'cloth', rbox(0.078, 0.098, 0.020, 0.006, [-0.122, 0.672, 0.190], [-0.08, -0.32, 0.08]), WOOD);
      addOnsenSymbol('torso', 'cloth', [-0.126, 0.672, 0.203], [-0.08, -0.32, 0.08], 0.95, RED);

      // Confident face + spiky dark ponytail with fluttering crimson ribbons (-X) + tilted Kitsune Fox Mask (+X)!
      buildFace({
        iris: 0x4c2f20, brow: 0x241a18, browSc: [0.048, 0.012, 0.011],
        browRoll: 0.24, mouth: 'smirk',
      });
      add('head', 'cloth', sph(1, [0, 1.40, -0.035], [0.206, 0.20, 0.20], null, 20, 14), HAIR);
      for (const [az, l] of [[-0.64, 0.050], [-0.34, 0.058], [-0.04, 0.062], [0.28, 0.060], [0.60, 0.050]]) {
        lock(az, 0.42, 0.012, [0.058, l, 0.030], HAIR, -az * 0.25, -0.14);
      }
      for (const s of [-1, 1]) {
        lock(s * 0.98, 0.06, 0.014, [0.064, 0.092, 0.038], HAIR, -s * 0.16, -0.20);
      }
      // Red braided headband + high spiky ponytail & long fluttering red ribbons on -X (viewer's left!)
      add('head', 'cloth', tor(0.200, 0.015, [0, 1.448, -0.015], [PI / 2 - 0.32, 0, 0.18], 1, TAU, 6, 20), RED);
      add('head', 'cloth', tor(0.046, 0.016, [-0.125, 1.530, -0.125], [0.45, -0.45, 0.3], 1, TAU, 6, 14), GOLD);
      for (const [dx, dy, rz] of [[-0.06, 0.06, 0.48], [-0.11, 0.02, 0.88], [-0.02, 0.08, 0.18], [-0.08, -0.03, 1.15]]) {
        add('head', 'cloth', sph(1, [-0.14 + dx, 1.545 + dy, -0.175], [0.056, 0.105, 0.068], [-0.25, 0, rz], 12, 8), HAIR);
      }
      for (const [ox, oy, oz] of [[-0.29, 1.41, -0.14], [-0.25, 1.35, -0.19]]) {
        add('head', 'cloth', tube([
          [-0.13, 1.515, -0.12], [(ox - 0.13) * 0.55 - 0.13, (oy + 1.515) * 0.5 + 0.02, -0.15], [ox, oy, oz],
        ], 0.016, 12, 5), RED);
      }

      // Tilted White-and-Crimson Kitsune Fox Mask perched on +X side of head!
      {
        const mp = [0.102, 1.518, 0.120], mr = [-0.46, 0.44, -0.30];
        add('head', 'cloth', xf(sph(1, [0, 0, 0], [0.120, 0.116, 0.065], null, 16, 12), mp, mr), WHITE);
        add('head', 'cloth', xf(sph(1, [0, -0.046, 0.055], [0.055, 0.050, 0.058], null, 12, 8), mp, mr), WHITE);
        add('head', 'cloth', xf(sph(0.017, [0, -0.054, 0.106], 1, null, 8, 6), mp, mr), 0x241a18);
        for (const s of [-1, 1]) {
          add('head', 'cloth', xf(lathe([[0.045, 0], [0.024, 0.075], [0, 0.125]], [s * 0.070, 0.084, -0.005], [0.92, 1, 0.46], [0, 0, -s * 0.22], 10), mp, mr), WHITE);
          add('head', 'cloth', xf(lathe([[0.026, 0.015], [0.013, 0.070], [0, 0.105]], [s * 0.070, 0.084, 0.011], [0.82, 1, 0.32], [0, 0, -s * 0.22], 8), mp, mr), RED);
          add('head', 'cloth', xf(rbox(0.052, 0.013, 0.013, 0.004, [s * 0.054, 0.012, 0.060], [0, s * 0.25, s * 0.34]), mp, mr), RED);
          add('head', 'cloth', xf(rbox(0.044, 0.010, 0.010, 0.003, [s * 0.070, -0.032, 0.050], [0, s * 0.35, -s * 0.18]), mp, mr), RED);
        }
      }

      // Billowing cream kimono tamoto sleeves + golden kamon crest + dark kote bracers
      for (const s of [1, -1]) {
        buildArm(s, {
          upper: CREAM, upperMat: 'cloth', r1: 0.074, puff: 0.076,
          foreSleeve: 0.58, hand: 0.050, glove: HAKAMA,
        });
        const ug = s > 0 ? 'upperL' : 'upperR', fg = s > 0 ? 'foreL' : 'foreR';
        add(ug, 'cloth', rbox(0.118, 0.168, 0.155, 0.034, [s * 0.012, -0.125, -0.038], [0.16, 0, 0]), CREAM);
        add(ug, 'cloth', sph(1, [s * 0.072, -0.098, 0.01], [0.012, 0.038, 0.038], null, 10, 8), GOLD);
        add(fg, 'cloth', seg([0, -D.b * 0.56, 0], [0, -D.b * 0.92, 0], 0.047, 0.043, 10, false), HAKAMA);
        add(fg, 'cloth', tor(0.048, 0.009, [0, -D.b * 0.58, 0], [PI / 2, 0, 0], 1, TAU, 5, 14), GOLD);
      }

      // Ornate Red & Gold Dragon-Head Water Blaster with Glowing Sapphire-Blue Water Chamber!
      // Glowing sapphire-blue water chamber core + crystal glass sleeve + bubbles + golden frame rails!
      add('weapon', 'glow', cylz(0.052, 0.052, 0.005, 0.275, 0, 0.082, 16), 0x4ccbff);
      add('weapon', 'glass', cylz(0.056, 0.056, 0.002, 0.278, 0, 0.082, 16));
      for (const [bx2, by2, bz2, br] of [
        [-0.022, 0.096, 0.08, 0.011], [0.024, 0.074, 0.145, 0.013], [-0.016, 0.094, 0.215, 0.010],
      ]) {
        add('weapon', 'glow', sph(br, [bx2, by2, bz2], 1, null, 7, 5), 0xffffff);
      }
      add('weapon', 'cloth', rbox(0.028, 0.016, 0.28, 0.005, [0, 0.140, 0.14]), GOLD);
      add('weapon', 'cloth', rbox(0.032, 0.018, 0.28, 0.005, [0, 0.024, 0.14]), RED);
      for (const z of [0.00, 0.280]) {
        add('weapon', 'cloth', cylz(0.064, 0.064, z - 0.020, z + 0.020, 0, 0.082, 16), GOLD);
      }
      // Sculpted Crimson & Gold Dragon Head + Sweeping Golden Horns, Mane & Gleaming Muzzle!
      add('weapon', 'cloth', sph(1, [0, 0.098, 0.355], [0.072, 0.068, 0.095], null, 14, 10), RED);
      add('weapon', 'cloth', rbox(0.102, 0.048, 0.155, 0.018, [0, 0.116, 0.440], [-0.10, 0, 0]), RED);
      add('weapon', 'cloth', rbox(0.042, 0.022, 0.145, 0.008, [0, 0.142, 0.422], [-0.08, 0, 0]), GOLD_HI);
      add('weapon', 'cloth', rbox(0.090, 0.038, 0.135, 0.014, [0, 0.046, 0.432], [0.16, 0, 0]), RED);
      add('weapon', 'cloth', cylz(0.046, 0.052, 0.385, 0.52, 0, 0.082, 14), GOLD);
      add('weapon', 'cloth', tor(0.051, 0.008, [0, 0.082, 0.516], null, 1, TAU, 5, 14), GOLD_HI);
      add('weapon', 'cloth', sph(1, [0, 0.082, 0.522], [0.032, 0.032, 0.006], null, 10, 6), 0x1e2433);
      for (const sx of [-1, 1]) {
        add('weapon', 'cloth', sph(0.018, [sx * 0.058, 0.126, 0.385], 1, null, 8, 6), GOLD_HI);
        // Sweeping golden dragon horns
        add('weapon', 'cloth', tube([
          [sx * 0.040, 0.150, 0.37], [sx * 0.062, 0.198, 0.29], [sx * 0.052, 0.228, 0.20],
        ], 0.016, 10, 6), GOLD_HI);
        // Flowing golden dragon whiskers/mane tendrils
        add('weapon', 'cloth', tube([
          [sx * 0.062, 0.098, 0.40], [sx * 0.086, 0.104, 0.31], [sx * 0.074, 0.126, 0.23],
        ], 0.012, 10, 5), GOLD);
        add('weapon', 'cloth', lathe([[0.011, 0], [0, 0.028]], [sx * 0.036, 0.098, 0.485], 1, [PI, 0, 0], 6), WHITE);
      }
      add('weapon', 'cloth', rbox(0.066, 0.084, 0.135, 0.02, [0, 0.064, -0.082], [0.12, 0, 0]), RED);
      add('weapon', 'cloth', rbox(0.048, 0.118, 0.054, 0.016, [0, -0.022, -0.005], [0.30, 0, 0]), RED);
      add('weapon', 'cloth', rbox(0.054, 0.046, 0.125, 0.016, [0, 0.012, 0.185]), RED);
    }
  });

  // Customize glow materials per character (100% metalness: 0!) so:
  // - boiler_apprentice's boiler furnace grate & pepperbox slots blaze fiery orange
  // - masked_warden's dragon water chamber glows pure luminous sapphire-blue!
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (m.material) m.material.metalness = 0;
    if (k === 'boiler_apprentice' && (m.name === 'torso_glow' || m.name === 'weapon_glow')) {
      m.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: 0xffd278,
        emissive: 0xff7b18,
        emissiveIntensity: 1.55,
        roughness: 0.40,
        metalness: 0,
      });
    } else if (k === 'masked_warden' && m.name === 'weapon_glow') {
      m.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        color: 0x4cc4ff,
        emissive: 0x1078ff,
        emissiveIntensity: 1.75,
        roughness: 0.22,
        metalness: 0,
      });
    } else if (k === 'masked_warden' && m.name === 'weapon_glass') {
      m.material = new THREE.MeshStandardMaterial({
        color: 0xa6e8ff,
        transparent: true,
        opacity: 0.28,
        roughness: 0.18,
        metalness: 0,
      });
    }
  });

  return root;
}

// ============================================================================
// 2. Bathhouse Hider Spirit (suds_star — Suds-Star Spirit)
// ============================================================================
export function buildMapHider(THREE) {
  return buildRiggedHiderSpirit(THREE, HIDER_DEF.id, HIDER_DEF.color, (kit) => {
    const { torso, crest, paint, std, mk, paintGeo, place, surf, normal, ell, V3 } = kit;

    // Pearly bath-foam body: pale iridescent lavender soap-film tone with a glossier sheen
    if (paint && paint.color) paint.color.setHex(0xd2c4f2);
    if (paint) paint.roughness = 0.62;

    // Soft deep-violet eyes with bright white catchlights
    const oldEyes = torso.getObjectByName('eyes');
    if (oldEyes) {
      const darkEyes = [];
      for (const sx of [-1, 1]) {
        const iris = paintGeo(ell(0.045, 0.056, 0.019), (x, y) =>
          new THREE.Color(0x2a2048).lerp(new THREE.Color(0x5c4a94), Math.max(0, (-y / 0.056 + 0.6) * 0.65))
        );
        const hlBig = paintGeo(ell(0.017, 0.019, 0.007).translate(-0.013, 0.020, 0.016), 0xffffff);
        const hlSmall = paintGeo(ell(0.008, 0.008, 0.005).translate(0.014, -0.018, 0.014), 0xfff8ee);
        const tilt = new THREE.Matrix4().makeRotationY(-sx * 0.16);
        for (const g of [iris, hlBig, hlSmall]) darkEyes.push(place(g, 0.668, sx * 0.50, -0.003, tilt));
      }
      oldEyes.geometry.dispose();
      oldEyes.geometry = mergeGeometries(darkEyes, false);
      darkEyes.forEach((g) => g.dispose());
    }

    const prep = (geo, colFn) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      for (const k of Object.keys(g.attributes)) {
        if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) {
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      }
      return paintGeo(g, colFn);
    };

    const xform = (geo, pos, rot = [0, 0, 0], scl = [1, 1, 1]) => {
      const m = new THREE.Matrix4().compose(
        V3(...pos),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
        V3(...(typeof scl === 'number' ? [scl, scl, scl] : scl))
      );
      return geo.applyMatrix4(m);
    };

    // Smooth pastel soap bubble with a painted soap-film glint on its upper-left & a deeper rim underneath
    const makeBubble = (r, hex) => {
      const g = new THREE.SphereGeometry(r, 16, 12);
      const base = new THREE.Color(hex), hi = new THREE.Color(0xffffff), lo = base.clone().offsetHSL(0.03, 0.08, -0.10);
      return prep(g, (x, y, z) => {
        const nx = x / r, ny = y / r, nz = z / r;
        const glint = Math.max(0, -nx * 0.50 + ny * 0.62 + nz * 0.60);
        const c = base.clone().lerp(lo, Math.max(0, -ny) * 0.75);
        return c.lerp(hi, Math.pow(glint, 5) * 0.95);
      });
    };

    const makeLeaf = (len, hw, thick, cBase, cTip) => {
      const g = new THREE.SphereGeometry(1, 10, 8);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const s = (y + 1) * 0.5;
        const env = Math.sqrt(Math.max(0, 1 - y * y));
        const ux = env > 1e-5 ? x / env : 0, uz = env > 1e-5 ? z / env : 0;
        const f = Math.sin(PI * Math.pow(s, 0.72));
        p.setXYZ(i, ux * f * hw, s * len, uz * f * thick + s * s * len * 0.16);
      }
      g.computeVertexNormals();
      const b = new THREE.Color(cBase), e = new THREE.Color(cTip);
      return prep(g, (x, y) => b.clone().lerp(e, Math.min(1, Math.max(0, y / len))));
    };

    // 1. Crown on `crest` ([0, 0.91, 0]): frothy cluster of pearly lavender, mint, peach & pink soap bubbles
    //    with a pair of golden ginkgo-yellow bath leaves tucked in on the upper-right!
    const crestGeos = [];
    const bubbles = [
      [-0.012, -0.030, 0.150, 0.082, 0xf0e6ff, [0.2, 0.3, 0.1]],    // Big pearly front-center bubble
      [-0.118, -0.044, 0.130, 0.064, 0xc8f2e2, [0.5, 0.1, -0.3]],   // Mint left-front
      [0.092, -0.040, 0.134, 0.060, 0xffd6c6, [-0.2, 0.6, 0.2]],    // Peach right-front
      [-0.190, -0.092, 0.092, 0.050, 0xffc9de, [0.3, 0.8, 0.4]],    // Pink outer-left
      [-0.056, 0.048, 0.078, 0.068, 0xd6c8ff, [0.1, -0.4, 0.5]],    // Lavender upper-left crown
      [0.050, 0.044, 0.074, 0.054, 0xc8ecff, [0.6, 0.2, -0.2]],     // Sky-blue upper-right crown
      [0.152, -0.070, 0.096, 0.046, 0xd8f6e6, [-0.4, 0.3, 0.6]],    // Mint right brow
      [-0.130, 0.020, 0.060, 0.044, 0xffe0d0, [0.2, 0.4, -0.3]],    // Peach crown side
      [0.012, 0.118, 0.050, 0.036, 0xf6eeff, [0.2, 0.5, -0.4]],     // Tiny bubble popping up on top
    ];
    for (const [cx, cy, cz, cr, hex] of bubbles) {
      crestGeos.push(xform(makeBubble(cr, hex), [cx, cy, cz]));
    }
    // Golden ginkgo-yellow bath leaves on upper-right (+X) & a tiny leaf accent on left
    crestGeos.push(xform(makeLeaf(0.198, 0.072, 0.018, 0xd99a2a, 0xffe37a), [0.125, -0.026, 0.064], [-0.12, 0.22, -0.68]));
    crestGeos.push(xform(makeLeaf(0.178, 0.064, 0.016, 0xcf8e24, 0xffd866), [0.158, -0.060, 0.052], [0.12, 0.35, -1.20]));
    crestGeos.push(xform(makeLeaf(0.128, 0.046, 0.014, 0xd99a2a, 0xffe37a), [-0.175, -0.055, 0.065], [-0.1, -0.25, 0.85]));
    mk(mergeGeometries(crestGeos, false), std({ roughness: 0.34 }), crest, 'crest_candies');

    // 2. Thick braided red rope collar around neck (y = 0.488) + hanging wooden ♨ bath tag!
    const collarGeos = [];
    const N_BRAID = 28;
    for (let i = 0; i < N_BRAID; i++) {
      const th = (i / N_BRAID) * TAU;
      const p = surf(0.488, th).addScaledVector(normal(0.488, th), 0.016);
      const bead = prep(new THREE.SphereGeometry(1, 10, 8), i % 2 === 0 ? 0xe04e30 : 0xc43a20);
      const tang = V3(Math.cos(th), 0.40, -Math.sin(th)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), tang);
      bead.applyMatrix4(new THREE.Matrix4().compose(p, q, V3(0.025, 0.042, 0.027)));
      collarGeos.push(bead);
    }
    mk(mergeGeometries(collarGeos, false), std({ roughness: 0.86 }), torso, 'collar');

    const tagPivot = new THREE.Group();
    const neckFront = surf(0.478, 0).addScaledVector(normal(0.478, 0), 0.024);
    tagPivot.position.copy(neckFront);
    torso.add(tagPivot);

    const tagGeos = [];
    tagGeos.push(xform(prep(new THREE.TorusGeometry(0.022, 0.0065, 6, 14), 0xf4c44e), [0, -0.005, 0.006], [0, PI / 2, 0]));
    const plaque = new RoundedBoxGeometry(0.120, 0.140, 0.024, 2, 0.010);
    {
      const pp = plaque.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const py = pp.getY(i);
        pp.setX(i, pp.getX(i) * (1 - (py / 0.140) * 0.20));
      }
      plaque.computeVertexNormals();
    }
    tagGeos.push(xform(prep(plaque, 0xdc6d44), [0, -0.080, 0.008], [-0.14, 0, 0]));
    const embZ = 0.022;
    const bowlArc = prep(new THREE.TorusGeometry(0.030, 0.005, 5, 12, PI * 1.15), 0x381a12);
    tagGeos.push(xform(bowlArc, [0, -0.094, embZ - 0.003], [-0.14, 0, PI * 0.92]));
    for (const ox of [-0.019, 0, 0.019]) {
      const wave = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        V3(ox, -0.095, embZ),
        V3(ox - 0.005, -0.074, embZ + 0.003),
        V3(ox + 0.005, -0.055, embZ + 0.006),
      ]), 8, 0.0045, 5, false);
      tagGeos.push(prep(wave, 0x381a12));
    }
    mk(mergeGeometries(tagGeos, false), std({ roughness: 0.85 }), tagPivot, 'onsen_tag');

    // 3. Glowing golden 5-point star on its belly surrounded by 8 radiating golden light dashes!
    const starGeos = [];
    const conformBelly = (geo, y0, th0, off = 0.010) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const Y = y0 + p.getY(i);
        const rApprox = Math.max(0.12, Math.hypot(surf(Y, 0).x, surf(Y, 0).z) || 0.30);
        const th = th0 + p.getX(i) / rApprox;
        const q = surf(Y, th).addScaledVector(normal(Y, th), off + p.getZ(i));
        p.setXYZ(i, q.x, q.y, q.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    const starShape = new THREE.Shape();
    const R_OUT = 0.092, R_IN = 0.048;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + PI / 2;
      const r = i % 2 === 0 ? R_OUT : R_IN;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const starExt = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.009, bevelEnabled: true, bevelThickness: 0.010, bevelSize: 0.009, bevelSegments: 2, curveSegments: 6,
    });
    const cCenter = new THREE.Color(0xfff7ad), cEdge = new THREE.Color(0xf6bc38);
    prep(starExt, (x, y) => cCenter.clone().lerp(cEdge, Math.min(1, Math.hypot(x, y) / R_OUT)));
    starGeos.push(conformBelly(starExt, 0.246, 0, 0.007));

    // 8 radiating golden light dashes around the belly star!
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + PI / 8;
      const dist = 0.142;
      const dash = prep(new THREE.SphereGeometry(1, 8, 6), 0xffe46c);
      xform(dash, [Math.cos(a) * dist, Math.sin(a) * dist, 0], [0, 0, a - PI / 2], [0.011, 0.029, 0.008]);
      starGeos.push(conformBelly(dash, 0.246, 0, 0.009));
    }
    const starMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xffe680,
      emissive: 0xffb82c,
      emissiveIntensity: 1.15,
      roughness: 0.42,
      metalness: 0,
    });
    mk(mergeGeometries(starGeos, false), starMat, torso, 'belly_star');

    return (t, ph, k, idle) => {
      tagPivot.rotation.x = -0.08 - Math.abs(Math.sin(ph)) * 0.18 * k + Math.sin(t * 2.3) * 0.03 * idle;
      tagPivot.rotation.z = Math.sin(ph) * 0.14 * k;
      starMat.emissiveIntensity = 1.05 + 0.25 * Math.sin(t * 3.1);
    };
  });
}
