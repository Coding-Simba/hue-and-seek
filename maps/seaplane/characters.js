/* Hue & Seek — Map 3: Porto Sereno Seaplane Cove (maps/seaplane/characters.js)
 * 3 rigged Storybook Seekers + 1 rigged Hider Spirit for an original seaside harbour town,
 * sculpted faithfully from assets/maps/seaplane/characters_sheet.png (<= 16 draw calls each).
 */
import {
  buildRiggedSeeker,
  buildRiggedHiderSpirit,
  mergeGeometries,
} from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

export const SEEKER_DEFS = [
  { id: 'ace_pilot', label: 'Seaplane Ace Mechanic' },
  { id: 'harbor_sailor', label: 'Adriatic Sailor' },
  { id: 'trattoria_chef', label: 'Gelato Nonna Chef' },
];

export const HIDER_DEF = {
  id: 'seafoam_sailor',
  label: 'Seafoam Sailor Spirit',
  color: 0x7bc6b8,
};

const SEEKER_DIMS = {
  ace_pilot: {
    main: 0xb8763e,
    hipY: 0.60,
    legX: 0.095,
    neckY: 1.13,
    sh: [0.195, 1.06],
    a: 0.24,
    b: 0.23,
    tw: -0.28,
    twAim: -0.44,
    head: { c: [0, 1.34, 0.015], r: 0.20, s: [1.0, 0.96, 0.95] },
    rest: { p: [-0.04, 0.85, 0.20], r: [0.04, 0, 0] },
    aim: { p: [-0.06, 1.00, 0.25], r: [0, 0, 0] },
    gripF: [0, 0.01, 0.20],
    nozzle: [0, 0.075, 0.47],
    pole: [0.55, -0.6, -0.55],
  },
  harbor_sailor: {
    main: 0x385e96,
    hipY: 0.57,
    legX: 0.115,
    neckY: 1.11,
    sh: [0.255, 1.05],
    a: 0.255,
    b: 0.245,
    tw: -0.22,
    twAim: -0.36,
    head: { c: [0, 1.31, 0.02], r: 0.208, s: [1.07, 0.95, 0.96] },
    rest: { p: [-0.05, 0.78, 0.24], r: [0.04, 0.30, -0.04] },
    aim: { p: [-0.04, 0.92, 0.27], r: [-0.04, 0, 0] },
    gripF: [0, 0.165, 0.16],
    nozzle: [0, 0.045, 0.48],
    pole: [0.6, -0.55, -0.5],
  },
  trattoria_chef: {
    main: 0xf4eee4,
    hipY: 0.52,
    legX: 0.105,
    neckY: 1.02,
    sh: [0.235, 0.98],
    a: 0.25,
    b: 0.24,
    tw: -0.24,
    twAim: -0.38,
    eyeEl: -0.055,
    head: { c: [0, 1.21, 0.025], r: 0.202, s: [1.06, 0.95, 0.97] },
    rest: { p: [-0.06, 0.79, 0.24], r: [0, 0, 0] },
    aim: { p: [-0.06, 0.90, 0.27], r: [0, 0, 0] },
    gripF: [0.09, 0.185, 0.08],
    nozzle: [0, 0.155, 0.35],
    pole: [0.6, -0.55, -0.5],
  },
};

// Surface point helper along a lathe profile [[r, y], ...]
function rAt(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) {
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return profile[profile.length - 1][0];
}

function onTorso(THREE, profile, sz, az, y, out = 0) {
  const r = rAt(profile, y) + out;
  return new THREE.Vector3(r * Math.sin(az), y, r * sz * Math.cos(az));
}

export function buildMapSeeker(THREE, kind = 'ace_pilot') {
  const validKind = SEEKER_DIMS[kind] ? kind : 'ace_pilot';
  const D = SEEKER_DIMS[validKind];

  return buildRiggedSeeker(THREE, validKind, D, (kit) => {
    const {
      SKIN,
      v,
      xf,
      sph,
      lathe,
      tor,
      rbox,
      tube,
      seg,
      cylz,
      add,
      surf,
      dec,
      lock,
      buildFace,
      buildArm,
      buildBoot,
    } = kit;

    // ========================================================================
    // 1. ACE_PILOT — Seaplane Ace Mechanic (original design)
    // ========================================================================
    if (validKind === 'ace_pilot') {
      const CRIMSON = 0xb8302a;
      const SHEARLING = 0xf4ead2;
      const SCARF = 0xfaf5ea;
      const PANTS = 0x7e5536;
      const LEATHER = 0x693f25;
      const BOOT = 0x9c6232;
      const BRASS = 0xe2ac42;
      const HAIR = 0x5c351e;

      // Baggy brown flight trousers + cargo pockets + shearling cuff rolls + laced tan boots
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR';
        const x = s * D.legX;
        add(
          gk,
          'cloth',
          lathe(
            [
              [0.068, 0.23],
              [0.105, 0.28],
              [0.112, 0.42],
              [0.104, 0.62],
              [0, 0.64],
            ],
            [x, 0, 0],
            [1, 1, 0.96],
            null,
            16
          ),
          PANTS
        );
        // Cargo pocket on outer thigh
        add(gk, 'cloth', rbox(0.032, 0.11, 0.095, 0.01, [x + s * 0.102, 0.44, 0.01], [0, 0, -s * 0.06]), 0x6d472c);
        // Fluffy cream shearling boot-top roll
        add(gk, 'cloth', tor(0.076, 0.028, [x, 0.24, 0], [PI / 2, 0, 0], 1, TAU, 8, 16), SHEARLING);
        buildBoot(gk, x, BOOT, 0x452b19, null, 0.23);
        // Boot laces
        for (const ly of [0.11, 0.15, 0.19]) {
          add(gk, 'cloth', rbox(0.055, 0.012, 0.02, 0.004, [x, ly, 0.068]), 0x4d301b);
        }
      }

      // Torso: Tan leather flight jacket ('paint') over crimson shirt + shearling lapels
      const side = [
        [0.185, 0.56],
        [0.198, 0.63],
        [0.192, 0.76],
        [0.196, 0.92],
        [0.188, 1.04],
        [0.135, 1.11],
        [0.075, 1.14],
      ];
      const sz = 0.86;
      add('torso', 'paint', lathe([[0, 0.56], ...side, [0, 1.14]], [0, 0, 0], [1, 1, sz], null, 24), 0xffffff);
      // Crimson inner shirt front panel
      add(
        'torso',
        'cloth',
        lathe(
          [
            [0.19, 0.63],
            [0.195, 0.78],
            [0.198, 0.94],
            [0.16, 1.08],
          ],
          [0, 0, 0.008],
          [0.52, 1, sz],
          null,
          14,
          -0.55,
          1.1
        ),
        CRIMSON
      );
      // Fluffy cream shearling lapels + wide shearling flight collar + bottom hem trim
      for (const s of [-1, 1]) {
        const lapelPts = [0.62, 0.76, 0.90, 1.03].map((y) => onTorso(THREE, side, sz, s * 0.28, y, 0.016));
        add('torso', 'cloth', tube(lapelPts, 0.024, 14, 7), SHEARLING);
      }
      add('torso', 'cloth', tor(0.118, 0.036, [0, 1.09, -0.01], [PI / 2 - 0.22, 0, 0], [1.05, 0.92, 1], TAU, 8, 20), SHEARLING);
      add('torso', 'cloth', tor(0.188, 0.022, [0, 0.61, 0], [PI / 2, 0, 0], [1, sz, 1], TAU, 7, 20), 0x996030);

      // White silk aviator scarf at neck + two fluttering tails over left-back shoulder
      add('torso', 'cloth', tor(0.082, 0.026, [0, 1.135, 0.01], [PI / 2 - 0.15, 0, 0], 1, TAU, 7, 18), SCARF);
      add(
        'torso',
        'cloth',
        tube(
          [
            [0.06, 1.13, -0.06],
            [0.18, 1.12, -0.18],
            [0.30, 1.07, -0.27],
            [0.40, 1.03, -0.32],
          ],
          0.026,
          14,
          6
        ),
        SCARF
      );
      add(
        'torso',
        'cloth',
        tube(
          [
            [0.04, 1.11, -0.07],
            [0.15, 1.06, -0.20],
            [0.25, 0.98, -0.28],
          ],
          0.021,
          12,
          6
        ),
        0xeee6d6
      );

      // Leather utility belt + brass buckle + hip tool pouch + silver mechanic wrench
      add('torso', 'cloth', lathe([[0.196, 0.61], [0.202, 0.665], [0.196, 0.67]], [0, 0, 0], [1.02, 1, sz * 1.02], null, 22), LEATHER);
      add('torso', 'cloth', rbox(0.065, 0.062, 0.024, 0.008, [0, 0.64, 0.175]), BRASS);
      add('torso', 'cloth', rbox(0.04, 0.038, 0.028, 0.006, [0, 0.64, 0.176]), LEATHER);
      // Left-hip buttoned leather pouch + gleaming wrench
      add('torso', 'cloth', rbox(0.065, 0.12, 0.11, 0.018, [-0.195, 0.56, 0.03], [0, 0, 0.12]), LEATHER);
      add('torso', 'cloth', rbox(0.07, 0.045, 0.114, 0.014, [-0.198, 0.60, 0.03], [0, 0, 0.12]), 0x82502e);
      add('torso', 'cloth', rbox(0.016, 0.12, 0.026, 0.005, [-0.18, 0.62, 0.10], [0.15, 0, 0.1]), 0xc8d2dc);
      add('torso', 'cloth', tor(0.02, 0.007, [-0.175, 0.68, 0.11], [0, PI / 2, 0], 1, PI * 1.4, 5, 10), 0xc8d2dc);

      // Backpack: Clear glass Gabbiano water tank w/ crimson end-caps, water level & ribbed red hose
      const tx = 0.02;
      const tz = -0.245;
      // Crimson top & bottom tank caps + brass rings
      add('torso', 'cloth', lathe([[0, 0.70], [0.102, 0.705], [0.106, 0.755], [0, 0.76]], [tx, 0, tz], 1, null, 18), CRIMSON);
      add('torso', 'cloth', lathe([[0, 1.01], [0.104, 1.015], [0.098, 1.055], [0.052, 1.07], [0.052, 1.095], [0, 1.098]], [tx, 0, tz], 1, null, 18), CRIMSON);
      add('torso', 'cloth', tor(0.104, 0.011, [tx, 0.755, tz], [PI / 2, 0, 0], 1, TAU, 6, 18), BRASS);
      add('torso', 'cloth', tor(0.102, 0.011, [tx, 1.015, tz], [PI / 2, 0, 0], 1, TAU, 6, 18), BRASS);
      // Inner blue water column + outer clear glass cylinder
      add('torso', 'cloth', lathe([[0, 0.76], [0.084, 0.76], [0.084, 0.93], [0, 0.935]], [tx, 0, tz], 1, null, 16), 0x4ca8e0);
      add('torso', 'glass', xf(new THREE.CylinderGeometry(0.098, 0.098, 0.265, 18, 1, true), [tx, 0.885, tz]));
      // Shoulder straps & curved crimson feeder hose
      for (const s of [-1, 1]) {
        const sp = [
          [s * 0.12, 0.76, 0.15],
          [s * 0.14, 1.08, 0.05],
          [s * 0.12, 1.06, -0.14],
          [s * 0.09, 0.80, -0.17],
        ];
        add('torso', 'cloth', tube(sp, 0.016, 16, 6), LEATHER);
      }
      add(
        'torso',
        'cloth',
        tube(
          [
            [tx, 0.69, tz],
            [-0.10, 0.59, -0.18],
            [-0.20, 0.62, -0.02],
            [-0.16, 0.74, 0.12],
          ],
          0.024,
          18,
          7
        ),
        CRIMSON
      );

      // Neck, expressive face, cheek band-aid, chestnut bob hair, leather aviator helmet & goggles
      add('torso', 'cloth', seg([0, 1.08, 0], [0, 1.21, 0.01], 0.05, 0.05), SKIN);
      buildFace({
        iris: 0x5c341c,
        iris2: 0xc98242,
        brow: 0x4a2916,
        browRoll: 0.24,
        browEl: 0.36,
        mouth: 'grin',
      });
      // Cute cream band-aid on right cheek
      dec('head', 'cloth', -0.58, -0.20, 0.005, [0.032, 0.017, 0.006], 0xf5dcb4, 0.32);

      // Chestnut-brown chin-length bob + outward flicked side locks + bangs
      add('head', 'cloth', sph(1, [0, 1.36, -0.03], [0.214, 0.202, 0.202], null, 20, 14), HAIR);
      for (const s of [-1, 1]) {
        lock(s * 0.94, 0.06, 0.014, [0.068, 0.095, 0.042], HAIR, -s * 0.15, -0.18);
        add('head', 'cloth', sph(1, [s * 0.195, 1.19, 0.01], [0.058, 0.048, 0.095], [0, 0, -s * 0.48], 12, 8), HAIR);
      }
      for (const [az, l] of [[-0.48, 0.045], [-0.22, 0.052], [0.05, 0.054], [0.30, 0.048], [0.52, 0.042]]) {
        lock(az, 0.44, 0.012, [0.056, l, 0.028], HAIR, -az * 0.25, -0.12);
      }

      // Brown leather flight helmet w/ ear-flaps + brass aviator goggles on brow
      add('head', 'cloth', sph(1, [0, 1.385, -0.018], [0.222, 0.195, 0.215], [-0.14, 0, 0], 22, 16), LEATHER);
      add('head', 'cloth', tor(0.202, 0.018, [0, 1.43, 0.035], [PI / 2 - 0.52, 0, 0], 1, PI * 1.15, 6, 18), 0x805030);
      for (const s of [-1, 1]) {
        add('head', 'cloth', sph(1, [s * 0.208, 1.31, -0.01], [0.038, 0.075, 0.068], [0, 0, -s * 0.12], 12, 10), LEATHER);
        add('head', 'cloth', sph(1, [s * 0.225, 1.31, -0.01], [0.022, 0.042, 0.042], null, 10, 8), 0x4e2e1a);
        // Hanging chin strap & brass buckle on right ear-flap
        add('head', 'cloth', rbox(0.014, 0.07, 0.022, 0.004, [s * 0.198, 1.22, 0.02], [0, 0, s * 0.1]), LEATHER);
        add('head', 'cloth', rbox(0.018, 0.024, 0.028, 0.005, [s * 0.195, 1.19, 0.02]), BRASS);

        // Brass aviator goggle frames + glass lenses on forehead
        const { p, q } = surf(s * 0.34, 0.64, 0.028);
        add('head', 'cloth', xf(new THREE.TorusGeometry(0.048, 0.013, 8, 18), p, q, [1.12, 0.92, 1.2]), BRASS);
        add('head', 'glass', sph(1, p, [0.046, 0.038, 0.016], q, 12, 8));
      }
      // Goggle nose bridge & head strap
      {
        const { p, q } = surf(0, 0.66, 0.028);
        add('head', 'cloth', rbox(0.055, 0.016, 0.018, 0.005, p, q), BRASS);
      }

      // Arms: Tan jacket sleeves ('paint'), cream shearling cuffs, brown mechanic gloves
      for (const s of [-1, 1]) {
        buildArm(s, {
          upper: 0xffffff,
          upperMat: 'paint',
          r1: 0.068,
          puff: 0.078,
          foreSleeve: 0.72,
          hand: 0.052,
          glove: 0x5c3a25,
        });
        const f = s > 0 ? 'foreL' : 'foreR';
        add(f, 'cloth', tor(0.068, 0.022, [0, -D.b * 0.70, 0], [PI / 2, 0, 0], 1, TAU, 7, 16), SHEARLING);
      }

      // Weapon: Crimson-and-brass Gabbiano Hydro-Blaster (nozzle at [0, 0.075, 0.47])
      add('weapon', 'cloth', rbox(0.042, 0.125, 0.058, 0.015, [0, 0.01, 0.0], [0.22, 0, 0]), 0x8a5029); // rear wood grip
      add('weapon', 'cloth', rbox(0.044, 0.08, 0.05, 0.012, [0, 0.025, 0.20], [-0.15, 0, 0]), 0x8a5029); // foregrip
      add('weapon', 'cloth', tor(0.032, 0.007, [0, 0.025, 0.048], [0, PI / 2, 0], 1, PI, 5, 12), BRASS); // trigger guard
      // Main crimson fuselage barrel + rear dome + pale-blue water drop emblem
      add('weapon', 'cloth', cylz(0.055, 0.052, -0.08, 0.37, 0, 0.075, 18), CRIMSON);
      add('weapon', 'cloth', sph(0.055, [0, 0.075, -0.08], [1, 1, 0.7], null, 14, 10), BRASS);
      for (const bz of [-0.02, 0.12, 0.28]) {
        add('weapon', 'cloth', cylz(0.058, 0.058, bz, bz + 0.024, 0, 0.075, 18), BRASS);
      }
      for (const s of [-1, 1]) {
        add('weapon', 'cloth', sph(1, [s * 0.053, 0.075, 0.19], [0.008, 0.024, 0.018], null, 10, 8), 0x8cd8ff);
      }
      // Heavy perforated brass shower-nozzle cap at tip
      add('weapon', 'cloth', cylz(0.056, 0.068, 0.37, 0.455, 0, 0.075, 18), BRASS);
      add('weapon', 'cloth', cylz(0.062, 0.062, 0.452, 0.465, 0, 0.075, 16), 0xc9922c);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        add('weapon', 'cloth', sph(0.008, [Math.cos(a) * 0.032, 0.075 + Math.sin(a) * 0.032, 0.465], 1, null, 6, 5), 0x3b2614);
      }
      add('weapon', 'cloth', sph(0.009, [0, 0.075, 0.466], 1, null, 6, 5), 0x3b2614);
    }

    // ========================================================================
    // 2. HARBOR_SAILOR — Stocky Adriatic Sailor w/ Bilge-Pump Water Cannon
    // ========================================================================
    if (validKind === 'harbor_sailor') {
      const NAVY = 0x243d6b;
      const CREAM = 0xf5ede0;
      const PANTS = 0xefe6d4;
      const ROPE = 0xd8b270;
      const BRASS = 0xe2ac40;
      const HAIR = 0x2f2018;

      // Wide-legged cream canvas sailor trousers + rolled cuffs + navy/white deck sneakers
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR';
        const x = s * D.legX;
        add(
          gk,
          'cloth',
          lathe(
            [
              [0.095, 0.13],
              [0.122, 0.18],
              [0.128, 0.38],
              [0.12, 0.59],
              [0, 0.61],
            ],
            [x, 0, 0],
            [1, 1, 0.96],
            null,
            18
          ),
          PANTS
        );
        // Thick rolled canvas cuff
        add(gk, 'cloth', tor(0.098, 0.025, [x, 0.145, 0], [PI / 2, 0, 0], [1, 0.96, 1], TAU, 7, 18), 0xe6dac4);
        // Navy deck sneaker + chunky white sole & laces
        buildBoot(gk, x, 0x314d7d, 0xf7f2e8, null, 0.13);
        add(gk, 'cloth', sph(1, [x, 0.048, 0.105], [0.062, 0.036, 0.048], null, 12, 8), 0xf7f2e8);
        for (const lz of [0.04, 0.068]) {
          add(gk, 'cloth', rbox(0.056, 0.012, 0.016, 0.004, [x, 0.088, lz]), 0xf7f2e8);
        }
      }

      // Broad Breton striped sailor shirt ('paint' base + cream horizontal stripes)
      const side = [
        [0.228, 0.55],
        [0.242, 0.64],
        [0.248, 0.78],
        [0.252, 0.92],
        [0.232, 1.03],
        [0.165, 1.09],
        [0.085, 1.12],
      ];
      const sz = 0.88;
      add('torso', 'paint', lathe([[0, 0.55], ...side, [0, 1.125]], [0, 0, 0], [1, 1, sz], null, 24), 0xffffff);
      for (const sy of [0.66, 0.75, 0.84, 0.93, 1.01]) {
        const r0 = rAt(side, sy - 0.022) + 0.004;
        const r1 = rAt(side, sy + 0.022) + 0.004;
        add('torso', 'cloth', lathe([[r0, sy - 0.022], [r1, sy + 0.022]], [0, 0, 0], [1, 1, sz], null, 24), CREAM);
      }

      // Classic navy-blue square sailor collar + white trim + front neckerchief knot & tails
      add(
        'torso',
        'cloth',
        lathe(
          [
            [0.238, 0.99],
            [0.21, 1.06],
            [0.115, 1.115],
          ],
          [0, 0, -0.01],
          [1.06, 1, sz * 1.05],
          null,
          22
        ),
        NAVY
      );
      add('torso', 'cloth', rbox(0.32, 0.16, 0.03, 0.01, [0, 0.98, -0.215], [0.22, 0, 0]), NAVY);
      add('torso', 'cloth', tor(0.225, 0.008, [0, 1.02, -0.01], [PI / 2 - 0.12, 0, 0], [1.06, sz * 1.05, 1], TAU, 5, 22), CREAM);
      // Front sailor tie knot + two tails
      add('torso', 'cloth', sph(0.038, [0, 0.94, 0.22], [1.1, 0.9, 0.8], null, 12, 10), NAVY);
      for (const s of [-1, 1]) {
        add('torso', 'cloth', rbox(0.048, 0.12, 0.022, 0.008, [s * 0.042, 0.87, 0.225], [-0.1, 0, -s * 0.34]), NAVY);
      }

      // Leather belt + hip pouch + striped deckhand towel tucked on right side
      add('torso', 'cloth', lathe([[0.238, 0.58], [0.244, 0.635]], [0, 0, 0], [1.02, 1, sz * 1.02], null, 24), 0x6b4429);
      add('torso', 'cloth', rbox(0.068, 0.062, 0.024, 0.008, [0, 0.608, 0.22]), BRASS);
      add('torso', 'cloth', rbox(0.07, 0.13, 0.11, 0.018, [0.235, 0.55, -0.03], [0, 0, -0.14]), 0x73482b);
      // Striped deckhand towel hanging at right hip
      add('torso', 'cloth', rbox(0.045, 0.22, 0.12, 0.014, [0.225, 0.50, 0.09], [0.08, 0.22, -0.16]), CREAM);
      for (const ty of [0.43, 0.47]) {
        add('torso', 'cloth', rbox(0.049, 0.016, 0.122, 0.005, [0.232, ty, 0.095], [0.08, 0.22, -0.16]), 0x3b63a0);
      }

      // Neck, cheeky smirking face w/ straw stem, tousled hair & white blue-pom sailor cap
      add('torso', 'cloth', seg([0, 1.06, 0], [0, 1.19, 0.015], 0.062, 0.06), SKIN);
      buildFace({
        iris: 0x3f291c,
        iris2: 0x9e6a3c,
        brow: 0x2a1b14,
        browSc: [0.052, 0.013, 0.012],
        browRoll: 0.18,
        browEl: 0.35,
        mouth: 'smirk',
      });
      // Golden straw/wheat stem at left corner of smirk
      {
        const { p } = surf(0.24, -0.35, 0.008);
        add('head', 'cloth', seg(p, [p.x + 0.095, p.y - 0.018, p.z + 0.065], 0.005, 0.003, 6), 0xe8c362);
      }

      // Tousled spiky dark hair filling upper forehead & temples cleanly up into the sailor cap
      add('head', 'cloth', sph(1, [0, 1.355, -0.012], [0.224, 0.192, 0.208], null, 20, 14), HAIR);
      add('head', 'cloth', sph(1, [0, 1.425, 0.065], [0.185, 0.075, 0.135], [-0.25, 0, 0], 16, 10), HAIR);
      for (const [az, el, roll] of [
        [-0.62, 0.36, 0.32],
        [-0.32, 0.44, 0.22],
        [-0.04, 0.48, 0.12],
        [0.24, 0.46, -0.25],
        [0.54, 0.38, -0.35],
        [-0.95, 0.18, 0.22],
        [0.95, 0.18, -0.22],
      ]) {
        lock(az, el, 0.018, [0.066, 0.062, 0.038], HAIR, roll, -0.28);
      }

      // Jaunty white sailor cap w/ navy band & big fluffy navy pom-pom on top
      const capPos = [0, 1.395, -0.02];
      const capRot = [-0.22, 0, 0.10];
      add(
        'head',
        'cloth',
        lathe(
          [
            [0.198, 0],
            [0.208, 0.046],
            [0.255, 0.078],
            [0.252, 0.118],
            [0.175, 0.148],
            [0, 0.155],
          ],
          capPos,
          1,
          capRot,
          24
        ),
        CREAM
      );
      add('head', 'cloth', lathe([[0.201, 0.004], [0.212, 0.047]], capPos, 1, capRot, 24), NAVY);
      add('head', 'cloth', sph(0.056, [-0.035, 1.545, -0.045], [1.12, 0.98, 1.12], null, 14, 12), 0x294980);

      // Stocky short-sleeved Breton striped arms + muscular forearms
      for (const s of [-1, 1]) {
        buildArm(s, {
          upper: 0xffffff,
          upperMat: 'paint',
          r1: 0.078,
          puff: 0.088,
          sleeve: 0.62,
          rs: 0.058,
          cuffU: CREAM,
          hand: 0.058,
        });
        const u = s > 0 ? 'upperL' : 'upperR';
        add(u, 'cloth', tor(0.078, 0.014, [0, -D.a * 0.34, 0], [PI / 2, 0, 0], 1, TAU, 6, 16), CREAM);
      }

      // Weapon: Rope-wrapped glass-and-brass Bilge-Pump Water Cannon (nozzle at [0, 0.045, 0.48])
      // Rear brass grip at (0,0,0) + top brass T-handle at gripF [0, 0.165, 0.16]
      add('weapon', 'cloth', seg([0, -0.03, -0.02], [0, 0.05, 0.01], 0.022, 0.022, 10), BRASS);
      add('weapon', 'cloth', cylz(0.076, 0.076, -0.03, 0.03, 0, 0.045, 18), BRASS);
      add('weapon', 'cloth', sph(0.074, [0, 0.045, -0.03], [1, 1, 0.65], null, 14, 10), BRASS);
      // Top T-bar carry handle for left hand
      add('weapon', 'cloth', seg([0, 0.10, 0.16], [0, 0.165, 0.16], 0.016, 0.016, 8), BRASS);
      add('weapon', 'cloth', seg([-0.055, 0.165, 0.16], [0.055, 0.165, 0.16], 0.018, 0.018, 8), 0x8a522a);

      // Clear glass cylindrical chamber + blue water & foam bubbles inside
      add('weapon', 'cloth', cylz(0.056, 0.056, 0.03, 0.29, 0, 0.038, 16), 0x389ee0);
      for (const [bx, by, bz] of [[-0.02, 0.06, 0.11], [0.025, 0.055, 0.18], [-0.01, 0.065, 0.24]]) {
        add('weapon', 'cloth', sph(0.012, [bx, by, bz], 1, null, 8, 6), 0xe8f8ff);
      }
      add('weapon', 'glass', cylz(0.070, 0.070, 0.025, 0.295, 0, 0.045, 18, true));

      // Heavy hemp rope coils wrapped around rear & front of glass barrel + hanging loop
      for (const rz of [0.045, 0.072, 0.245, 0.272]) {
        add('weapon', 'cloth', tor(0.076, 0.018, [0, 0.045, rz], [0, 0, 0.12], 1, TAU, 7, 18), ROPE);
      }
      add(
        'weapon',
        'cloth',
        tube(
          [
            [-0.07, 0.01, 0.05],
            [-0.08, -0.055, 0.14],
            [-0.065, 0.01, 0.25],
          ],
          0.017,
          14,
          6
        ),
        ROPE
      );

      // Stepped brass bilge-pump collar & flared perforated bell nozzle
      add('weapon', 'cloth', cylz(0.076, 0.068, 0.29, 0.35, 0, 0.045, 18), BRASS);
      add('weapon', 'cloth', cylz(0.048, 0.074, 0.35, 0.465, 0, 0.045, 18), BRASS);
      add('weapon', 'cloth', tor(0.072, 0.01, [0, 0.045, 0.465], [0, 0, 0], 1, TAU, 6, 18), 0xc9922b);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        add('weapon', 'cloth', sph(0.008, [Math.cos(a) * 0.034, 0.045 + Math.sin(a) * 0.034, 0.47], 1, null, 6, 5), 0x3b2614);
      }
    }

    // ========================================================================
    // 3. TRATTORIA_CHEF — Joyful Silver-Haired Gelato Nonna Chef
    // ========================================================================
    if (validKind === 'trattoria_chef') {
      const RED = 0xc8362e;
      const APRON = 0xf0e6d4;
      const SLATE = 0x4d4d57;
      const COPPER = 0xc86d35;
      const BRASS = 0xe0aa3e;
      const SILVER = 0xc4c9d1;

      // Cropped charcoal-slate baggy trousers + rolled cuffs + warm brown clogs
      for (const s of [-1, 1]) {
        const gk = s > 0 ? 'legL' : 'legR';
        const x = s * D.legX;
        add(gk, 'cloth', seg([x, 0.18, 0], [x, 0.09, 0], 0.048, 0.044), SKIN);
        add(
          gk,
          'cloth',
          lathe(
            [
              [0.088, 0.17],
              [0.118, 0.24],
              [0.122, 0.40],
              [0, 0.44],
            ],
            [x, 0, 0],
            [1, 1, 0.96],
            null,
            16
          ),
          SLATE
        );
        add(gk, 'cloth', tor(0.09, 0.022, [x, 0.18, 0], [PI / 2, 0, 0], 1, TAU, 7, 16), 0x62626e);
        buildBoot(gk, x, 0x6e482c, 0x3d2616, null, 0.10);
      }

      // Plump double-breasted white chef jacket ('paint') + wide cream apron
      const side = [
        [0.275, 0.38],
        [0.268, 0.50],
        [0.248, 0.66],
        [0.245, 0.82],
        [0.222, 0.95],
        [0.155, 1.01],
        [0.082, 1.04],
      ];
      const sz = 0.90;
      add('torso', 'paint', lathe([[0, 0.40], ...side, [0, 1.045]], [0, 0, 0], [1, 1, sz], null, 24), 0xffffff);
      // Cream waist apron flaring gently from waist down to knees
      add(
        'torso',
        'cloth',
        lathe(
          [
            [0.286, 0.37],
            [0.275, 0.50],
            [0.254, 0.66],
            [0.248, 0.70],
          ],
          [0, 0, 0.006],
          [1.01, 1, sz * 1.01],
          null,
          24
        ),
        APRON
      );
      add('torso', 'cloth', tor(0.246, 0.016, [0, 0.70, 0], [PI / 2, 0, 0], [1.01, sz * 1.01, 1], TAU, 6, 22), 0xe6dac4);

      // Double-breasted brass buttons on white chef jacket chest
      for (const s of [-1, 1]) {
        for (const by of [0.76, 0.84, 0.91]) {
          const p = onTorso(THREE, side, sz, s * 0.22, by, 0.012);
          add('torso', 'cloth', sph(0.015, p, [1, 1, 0.6], null, 8, 6), BRASS);
        }
      }

      // Cheerful crimson neckerchief + connected front knot & perky tails at collar
      add('torso', 'cloth', tor(0.115, 0.026, [0, 1.015, 0.015], [PI / 2 - 0.22, 0, 0], [1.08, 1.05, 1], TAU, 7, 18), RED);
      add('torso', 'cloth', tube([[-0.08, 1.01, 0.11], [0, 0.985, 0.185], [0.08, 1.01, 0.11]], 0.024, 12, 6), RED);
      add('torso', 'cloth', sph(0.034, [0.01, 0.98, 0.192], [1.1, 0.95, 0.85], null, 10, 8), RED);
      add('torso', 'cloth', tube([[0.01, 0.98, 0.192], [-0.055, 0.935, 0.205]], 0.020, 8, 6), RED);
      add('torso', 'cloth', tube([[0.01, 0.98, 0.192], [0.075, 0.94, 0.202]], 0.020, 8, 6), RED);

      // Apron right-hip pocket w/ wooden gelato spoon & silver whisk + red gingham towel
      add('torso', 'cloth', rbox(0.11, 0.13, 0.03, 0.012, [0.16, 0.56, 0.20], [-0.08, 0.55, 0]), 0xe8dcc6);
      // Wooden spoon sticking out of pocket
      add('torso', 'cloth', seg([0.16, 0.61, 0.21], [0.19, 0.71, 0.20], 0.008, 0.008, 6), 0xa86830);
      add('torso', 'cloth', sph(1, [0.195, 0.73, 0.20], [0.024, 0.035, 0.01], [0, 0.5, -0.2], 10, 8), 0xa86830);
      // Wire whisk beside spoon
      add('torso', 'cloth', seg([0.13, 0.61, 0.22], [0.13, 0.69, 0.22], 0.007, 0.007, 6), 0xb8c2cc);
      add('torso', 'cloth', tor(0.018, 0.004, [0.13, 0.715, 0.22], [0, 0.3, 0], [0.8, 1.3, 1], TAU, 5, 12), 0xcad4de);

      // Red-and-white checkered gingham towel tucked at front of apron
      const towelQ = [0.04, -0.14, 0.05];
      add('torso', 'cloth', rbox(0.13, 0.24, 0.024, 0.01, [-0.03, 0.54, 0.252], towelQ), 0xfbf3e4);
      for (const dy of [-0.08, -0.025, 0.03, 0.085]) {
        add('torso', 'cloth', rbox(0.134, 0.022, 0.027, 0.005, [-0.03, 0.54 + dy, 0.253], towelQ), RED);
      }
      for (const dx of [-0.04, 0.04]) {
        add('torso', 'cloth', rbox(0.022, 0.242, 0.028, 0.005, [-0.03 + dx, 0.54, 0.253], towelQ), 0xe27972);
      }

      // Neck, beaming laughing Nonna face, round gold spectacles, silver bun & tall chef toque
      add('torso', 'cloth', seg([0, 0.98, 0], [0, 1.11, 0.02], 0.058, 0.056), SKIN);
      buildFace({
        iris: 0x5c3c24,
        iris2: 0xb8844c,
        brow: 0x9aa0aa,
        browEl: 0.38,
        browRoll: -0.12,
        happyClosed: true,
        mouth: 'laugh',
      });

      // Round thin gold-wire spectacles on nose
      for (const s of [-1, 1]) {
        const { p, q } = surf(s * 0.35, -0.055, 0.025);
        add('head', 'cloth', xf(new THREE.TorusGeometry(0.052, 0.0038, 6, 20), p, q), 0xd8a648);
      }
      {
        const { p, q } = surf(0, -0.045, 0.026);
        add('head', 'cloth', rbox(0.038, 0.005, 0.008, 0.002, p, q), 0xd8a648);
      }

      // Soft wavy silver-grey hair framing upper forehead & temples + plump Nonna bun at back
      add('head', 'cloth', sph(1, [0, 1.25, -0.03], [0.232, 0.195, 0.208], null, 20, 14), SILVER);
      add('head', 'cloth', sph(0.10, [0, 1.19, -0.22], [1.08, 0.95, 0.95], null, 14, 12), 0xb4bac4);
      for (const s of [-1, 1]) {
        add('head', 'cloth', sph(1, [s * 0.085, 1.325, 0.135], [0.085, 0.048, 0.068], [-0.2, s * 0.2, -s * 0.28], 14, 10), 0xd8dde5);
        add('head', 'cloth', sph(1, [s * 0.168, 1.285, 0.075], [0.088, 0.068, 0.095], [0, 0, -s * 0.35], 14, 10), 0xd2d7df);
        add('head', 'cloth', sph(1, [s * 0.208, 1.195, 0.01], [0.064, 0.070, 0.088], null, 12, 10), SILVER);
      }

      // Tall puffy white chef's toque w/ red gingham ribbon headband & front bow
      const tPos = [0, 1.318, -0.028];
      const tRot = [-0.22, 0, 0];
      add('head', 'cloth', lathe([[0.180, 0], [0.188, 0.085], [0.202, 0.145]], tPos, 1, tRot, 24), 0xfaf5ec);
      // Red gingham headband around toque base + front gingham bow
      add('head', 'cloth', lathe([[0.184, 0.005], [0.193, 0.064]], tPos, 1, tRot, 24), RED);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        add('head', 'cloth', sph(0.022, [Math.sin(a) * 0.188, 1.355 - Math.cos(a) * 0.035, -0.028 + Math.cos(a) * 0.184], [0.9, 1.1, 0.5], null, 8, 6), 0xfbf3e4);
      }
      // Perky front gingham bow above silver hair part
      add('head', 'cloth', sph(0.028, [0, 1.368, 0.165], 1, null, 10, 8), RED);
      for (const s of [-1, 1]) {
        add('head', 'cloth', sph(1, [s * 0.064, 1.388, 0.156], [0.056, 0.032, 0.020], [0, -s * 0.2, s * 0.34], 10, 8), RED);
      }
      // Puffy pleated toque crown lobes (reaches ~1.64m)
      add('head', 'cloth', sph(0.168, [0, 1.495, -0.072], [1.24, 0.94, 1.14], null, 18, 14), 0xfaf5ec);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        add(
          'head',
          'cloth',
          sph(0.105, [Math.cos(a) * 0.128, 1.51, -0.072 + Math.sin(a) * 0.115], [0.98, 1.18, 0.98], null, 12, 10),
          0xfaf5ec
        );
      }

      // Rolled 3/4 white chef sleeves + warm plump forearms
      for (const s of [-1, 1]) {
        buildArm(s, {
          upper: 0xffffff,
          upperMat: 'paint',
          r1: 0.074,
          puff: 0.085,
          foreSleeve: 0.45,
          hand: 0.055,
        });
        const f = s > 0 ? 'foreL' : 'foreR';
        add(f, 'cloth', tor(0.074, 0.018, [0, -D.b * 0.45, 0], [PI / 2, 0, 0], 1, TAU, 6, 16), 0xfaf5ec);
      }

      // Weapon: Hammered copper Espresso-Seltzer Sprayer (nozzle at [0, 0.155, 0.35])
      // Right hand grips rear curved black handle near (0,0,0); left hand grips top T-pump [0.09, 0.185, 0.08]
      const cx = 0.09;
      const cz = 0.08;
      // Curved black rear handle at (0,0,0)
      add(
        'weapon',
        'cloth',
        tube(
          [
            [cx - 0.05, 0.09, cz - 0.03],
            [0.0, 0.05, 0.0],
            [0.0, -0.04, 0.01],
            [cx - 0.05, -0.06, cz - 0.02],
          ],
          0.017,
          14,
          6
        ),
        0x2b2928
      );

      // Plump bellied hammered copper tank w/ blue-and-cream Adriatic wave frieze
      add(
        'weapon',
        'cloth',
        lathe(
          [
            [0, -0.10],
            [0.102, -0.10],
            [0.106, -0.07],
            [0.102, 0.03],
            [0.082, 0.095],
            [0.048, 0.12],
          ],
          [cx, 0, cz],
          1,
          null,
          14 // 14-sided gives subtle hammered copper facets!
        ),
        COPPER
      );
      add('weapon', 'cloth', tor(0.104, 0.011, [cx, -0.09, cz], [PI / 2, 0, 0], 1, TAU, 6, 18), 0x5c3620);
      // Blue-and-cream painted wave band around lower copper belly
      add('weapon', 'cloth', lathe([[0.105, -0.065], [0.105, -0.015]], [cx, 0, cz], 1, null, 20), 0xf6eedc);
      add('weapon', 'cloth', lathe([[0.107, -0.062], [0.107, -0.035]], [cx, 0, cz], 1, null, 20), 0x3b6ca8);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        add(
          'weapon',
          'cloth',
          sph(0.018, [cx + Math.cos(a) * 0.105, -0.028, cz + Math.sin(a) * 0.105], [1, 0.7, 0.4], [0, -a + PI / 2, 0], 8, 6),
          0x3b6ca8
        );
      }

      // Brass dome valve + vertical pump rod + wooden T-handle (at gripF = [0.09, 0.185, 0.08])
      add('weapon', 'cloth', lathe([[0.052, 0.115], [0.048, 0.145], [0.024, 0.155], [0, 0.158]], [cx, 0, cz], 1, null, 16), BRASS);
      add('weapon', 'cloth', seg([cx, 0.15, cz], [cx, 0.19, cz], 0.009, 0.009, 8), 0x383432);
      add('weapon', 'cloth', seg([cx - 0.048, 0.19, cz], [cx + 0.048, 0.19, cz], 0.015, 0.015, 8), 0x5c3822);

      // Angled brass espresso-seltzer spray wand reaching forward to nozzle [0, 0.155, 0.35]
      add(
        'weapon',
        'cloth',
        tube(
          [
            [cx, 0.135, cz + 0.03],
            [cx * 0.55, 0.148, cz + 0.14],
            [0, 0.155, 0.31],
          ],
          0.014,
          12,
          7
        ),
        BRASS
      );
      add('weapon', 'cloth', cylz(0.018, 0.026, 0.30, 0.348, 0, 0.155, 14), BRASS);
    }
  });
}

// ============================================================================
// 4. SEAFOAM_SAILOR — Seafoam Sailor Spirit Hider
// ============================================================================
export function buildMapHider(THREE) {
  return buildRiggedHiderSpirit(
    THREE,
    HIDER_DEF.id,
    HIDER_DEF.color,
    ({ torso, crest, paint, std, mk, paintGeo, place, surf, normal, ell, V3 }) => {
      const prep = (geo, hexOrFn) => {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        for (const k of Object.keys(g.attributes)) {
          if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        return paintGeo(g, hexOrFn);
      };
      const xf = (geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) =>
        geo.applyMatrix4(
          new THREE.Matrix4().compose(
            V3(...pos),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
            V3(...scl)
          )
        );

      // Cute seafoam side ear-tufts & neck collar leaves using `paint` so they tint with Hider camouflage!
      const paintExtras = [];
      for (const sx of [-1, 1]) {
        paintExtras.push(
          place(
            prep(ell(0.055, 0.032, 0.026), () => new THREE.Color(0.92, 0.94, 0.90)),
            0.76,
            sx * 1.08,
            0.01,
            new THREE.Matrix4().makeRotationZ(-sx * 0.45)
          )
        );
      }
      mk(mergeGeometries(paintExtras, false), paint, torso, 'tufts');

      // 1) Torso costume mesh (1 draw call): Smooth cream belly patch + Golden Anchor + Red/White Lifebuoy collar!
      const torsoParts = [];

      // Smooth conformed front cream belly dome (buttery oval silhouette!)
      const bellyPatch = new THREE.SphereGeometry(1, 22, 16, 0, PI * 2, 0, PI * 0.5);
      bellyPatch.rotateX(PI * 0.5); // dome points along +Z, unit circle in XY
      {
        const pos = bellyPatch.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const ux = pos.getX(i);
          const uy = pos.getY(i);
          const uz = pos.getZ(i);
          const y = 0.255 + uy * 0.165;
          const th = ux * 0.68;
          const sp = surf(y, th).addScaledVector(normal(y, th), 0.002 + uz * 0.012);
          pos.setXYZ(i, sp.x, sp.y, sp.z);
        }
        bellyPatch.computeVertexNormals();
      }
      torsoParts.push(prep(bellyPatch, 0xfbf1da));

      // Golden mariner's anchor emblem on the plump front belly (y ~ 0.27)
      const GOLD = 0xe2a830;
      const anchorLocal = [
        // Top shackle ring
        xf(new THREE.TorusGeometry(0.026, 0.008, 6, 14), [0, 0.078, 0.012]),
        // Vertical shank
        xf(new THREE.CylinderGeometry(0.010, 0.011, 0.132, 8), [0, 0.0, 0.012]),
        // Horizontal cross-stock bar + ball tips
        xf(new THREE.CylinderGeometry(0.008, 0.008, 0.088, 8), [0, 0.044, 0.012], [0, 0, PI / 2]),
        xf(ell(0.012, 0.012, 0.010, 8, 6), [-0.048, 0.044, 0.012]),
        xf(ell(0.012, 0.012, 0.010, 8, 6), [0.048, 0.044, 0.012]),
        // Curved bottom fluke arch
        xf(new THREE.TorusGeometry(0.066, 0.010, 6, 16, PI * 0.88), [0, -0.008, 0.012], [0, 0, -PI * 0.94]),
        // Twin fluke arrowheads
        xf(new THREE.ConeGeometry(0.022, 0.038, 4), [-0.064, -0.016, 0.012], [0, 0, 0.35]),
        xf(new THREE.ConeGeometry(0.022, 0.038, 4), [0.064, -0.016, 0.012], [0, 0, -0.35]),
      ];
      for (const ag of anchorLocal) {
        torsoParts.push(place(prep(ag, GOLD), 0.272, 0, 0.012));
      }

      // Chubby red-and-white segmented lifebuoy collar around neck (y = 0.495) w/ 4 hemp rope wraps
      const ringR = 0.258;
      const tubeR = 0.052;
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * TAU;
        const arc = TAU / segs + 0.02;
        const tg = new THREE.TorusGeometry(ringR, tubeR, 10, 8, arc);
        tg.rotateX(PI / 2);
        tg.rotateY(a0);
        tg.translate(0, 0.495, -0.008);
        torsoParts.push(prep(tg, i % 2 === 0 ? 0xf8f0e2 : 0xd94838));
      }
      for (let r = 0; r < 4; r++) {
        const a = (r / 4) * TAU + PI / 4;
        const rg = new THREE.TorusGeometry(tubeR + 0.006, 0.011, 6, 14);
        rg.rotateY(a + PI / 2);
        rg.translate(Math.sin(a) * ringR, 0.495, -0.008 + Math.cos(a) * ringR);
        torsoParts.push(prep(rg, 0xd8b26e));
      }

      mk(mergeGeometries(torsoParts, false), std({ roughness: 0.78 }), torso, 'sailor_collar_emblem');

      // 2) Crest sailor cap + navy band + cheerful crimson-red ribbon bow (1 draw call!)
      const capParts = [];
      const capTilt = new THREE.Matrix4().compose(
        V3(-0.015, -0.035, -0.01),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.20, 0, 0.14)),
        V3(1, 1, 1)
      );
      const capCrown = new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.184, -0.02),
          new THREE.Vector2(0.198, 0.026),
          new THREE.Vector2(0.246, 0.068),
          new THREE.Vector2(0.242, 0.108),
          new THREE.Vector2(0.168, 0.138),
          new THREE.Vector2(0, 0.145),
        ],
        24
      );
      capCrown.applyMatrix4(capTilt);
      capParts.push(prep(capCrown, 0xf8f2e6));

      const capBand = new THREE.LatheGeometry(
        [new THREE.Vector2(0.188, -0.016), new THREE.Vector2(0.202, 0.030)],
        24
      );
      capBand.applyMatrix4(capTilt);
      capParts.push(prep(capBand, 0x253e6e));

      // Big crimson-red ribbon bow on +X side (viewer's right, matching characters_sheet.png!)
      const RED_BOW = 0xd93c32;
      capParts.push(prep(xf(ell(0.034, 0.034, 0.028, 10, 8), [0.165, -0.015, 0.095]), RED_BOW));
      // Two big perky ribbon bow loops
      capParts.push(
        prep(xf(ell(0.072, 0.042, 0.024, 12, 8), [0.125, 0.042, 0.122], [-0.2, -0.35, -0.58]), RED_BOW),
        prep(xf(ell(0.072, 0.042, 0.024, 12, 8), [0.215, 0.032, 0.072], [0.2, -0.45, 0.52]), RED_BOW)
      );
      // Two fluttering forked ribbon tails
      capParts.push(
        prep(xf(ell(0.065, 0.024, 0.016, 10, 8), [0.228, -0.042, 0.082], [0, -0.3, -0.48]), RED_BOW),
        prep(xf(ell(0.060, 0.022, 0.016, 10, 8), [0.188, -0.068, 0.115], [0, -0.2, -0.98]), RED_BOW)
      );

      mk(mergeGeometries(capParts, false), std({ roughness: 0.84 }), crest, 'sailor_cap');
    }
  );
}
