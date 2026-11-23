// ============================================================================
// Yu-Machi Spirit Bathhouse — Building 2: Spirit Ramen & Steamed-Bun Izakaya
// Handcrafted Storybook 3D architecture & 2-room dollhouse cutaway interior
// Built 1:1 from ext_02_ramen_izakaya.png & int_02_ramen_izakaya.png.
// Origin (0,0,0) at ground center, main entrance faces +Z.
// ALL materials enforce metalness: 0 for warm luminous Storybook gouache shading!
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  mergeGeometries,
} from '../../map_kit.js?v=2';
import {
  INDIGO_SLATE_PAL,
  SAKURA_PAL,
  HYDRANGEA_PAL,
  FOLIAGE_PAL,
  STONE_BOULDER_PAL,
  MOSS_BOULDER_PAL,
  getBathMats,
  buildKawaraGableRoof,
  buildKawaraPentAwning,
  buildMossyStonePlinth,
  addKumikoWindow,
  addMarumadoWindow,
  addChochinLantern,
  addNorenCurtain,
} from '../bath_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

// Luminous twilight indigo-slate roof palette matching ext_02_ramen_izakaya.png
const TWILIGHT_INDIGO_PAL = [
  ...INDIGO_SLATE_PAL,
  0x4c60a2,
  0x5a70b6,
  0x3f518c,
];

let _izTex = null;
function getIzakayaTextures(THREE) {
  if (_izTex) return _izTex;

  // 1. Warm lantern-kissed twilight slate flagstones (foreground of int_02 & porch of ext_02)
  const flagstone = paintedCanvasTex(THREE, 'bh2_izakaya_flagstone_v2', 512, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#685e6a';
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rng.jr(0, 28);
      while (x < w) {
        const sw = rng.jr(54, 96);
        ctx.fillStyle = rng.pick(['#8d808c', '#7f7482', '#9e8c90', '#756c7a', '#a8938c', '#867b87']);
        ctx.fillRect(x + 2, r * rh + 2, sw - 4, rh - 4);
        ctx.fillStyle = 'rgba(255, 212, 140, 0.16)';
        ctx.fillRect(x + 4, r * rh + 4, sw - 10, rh * 0.38);
        x += sw;
      }
    }
    brushStrokes(ctx, w, rng, 180, ['#b89f8c', '#625866', '#e6bd84'], 2, 7, 0.24);
  }, 3.2, 3.2);

  // 2. Hinoki wooden menu fuda board (品書き) with vertical sumi-ink brushwork & red seals
  const menuBoard = paintedCanvasTex(THREE, 'bh2_izakaya_menu_v2', 256, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#e7ba78';
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 90, ['#f2cc90', '#cfa05e', '#f7dba8'], 2, 6, 0.28, PI * 0.5, 0.2, 48);
    const cols = 6;
    const cw = w / cols;
    for (let c = 0; c < cols; c++) {
      const x0 = c * cw;
      ctx.strokeStyle = '#683f20';
      ctx.lineWidth = 3;
      ctx.strokeRect(x0 + 3, 6, cw - 6, h - 12);
      ctx.fillStyle = '#241812';
      const cx = x0 + cw * 0.5;
      for (let q = 0; q < 6; q++) {
        const sy = 24 + q * 32 + rng.jr(-3, 3);
        const sw = rng.jr(11, 22);
        ctx.fillRect(cx - sw * 0.5, sy, sw, rng.jr(4, 7));
        if (q % 2 === 0) ctx.fillRect(cx - 2.5, sy - 6, 5, rng.jr(15, 22));
      }
      ctx.fillStyle = '#c93428';
      ctx.fillRect(cx - 6, h - 28, 12, 12);
    }
  }, 1, 1);

  // 3. Tokonoma silk hanging scroll (kakejiku) with cherry branch & golden moon
  const scrollTex = paintedCanvasTex(THREE, 'bh2_izakaya_scroll_v2', 256, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#d8c39a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8c6b3a';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#f9efe0';
    ctx.fillRect(24, 34, w - 48, h - 68);
    brushStrokes(ctx, w, rng, 55, ['#fff6e4', '#ebdabc'], 3, 7, 0.24);
    ctx.fillStyle = '#f4c462';
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.36, 28, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3d2820';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(30, h * 0.68);
    ctx.quadraticCurveTo(w * 0.48, h * 0.52, w * 0.78, h * 0.42);
    ctx.stroke();
    for (const [bx, by] of [[0.42, 0.56], [0.54, 0.48], [0.66, 0.44], [0.50, 0.60], [0.72, 0.40]]) {
      ctx.fillStyle = '#f28eb0';
      ctx.beginPath();
      ctx.arc(w * bx, h * by, 8, 0, TAU);
      ctx.fill();
    }
  }, 1, 1);

  _izTex = { flagstone, menuBoard, scrollTex };
  return _izTex;
}

export function buildRamenIzakaya(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'ramen_izakaya', 22);
  const { root, roofG, garden, add, addR, rbox, boxCol, wall, beam, pushInst, jr, pick, M, G, glowMat } = K;
  const bm = getBathMats(THREE, K);
  const IT = getIzakayaTextures(THREE);

  // Geometry helpers: b1 for smooth bevelled timber/furniture, fbox for crisp flat slabs/slats (keeps tris ~115k!)
  const b1 = (w, h, d, r, mat) => rbox(w, h, d, r, mat, 1);
  const fbox = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  // Lightweight Kumiko lattice helper for shoji windows & clerestories (crisp 3D bars, 6x fewer tris!)
  function addKumikoLite(cx, cy, cz, rotY, w, h, cols = 3, rows = 2, parent = root) {
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = rotY;
    parent.add(g);
    add(fbox(w - 0.06, h - 0.06, 0.04, bm.shojiGlow), 0, 0, 0, 0, 0, 0, g);
    for (const sx of [-1, 1]) add(fbox(0.078, h + 0.06, 0.105, bm.darkTimber), sx * (w * 0.5), 0, 0, 0, 0, 0, g);
    for (const sy of [-1, 1]) add(fbox(w + 0.12, 0.078, 0.115, bm.darkTimber), 0, sy * (h * 0.5), 0, 0, 0, 0, g);
    for (let c = 1; c < cols; c++) {
      add(fbox(0.026, h - 0.05, 0.072, bm.rafterWood), -w * 0.5 + (c / cols) * w, 0, 0, 0, 0, 0, g);
    }
    for (let r = 1; r < rows; r++) {
      add(fbox(w - 0.05, 0.026, 0.072, bm.rafterWood), 0, -h * 0.5 + (r / rows) * h, 0, 0, 0, 0, g);
    }
    return g;
  }

  // Dimensions matching prompt & Codex references
  const W = 9.0;          // Main building width [-4.5, +4.5]
  const Y0 = 0.35;        // Floor top height atop mossy stone plinth (h=0.38 -> slab top 0.34)
  const H = 3.22;         // Ground-story cutaway wall height (< 3.3m so roofG lifts cleanly!)
  const TH = 0.24;        // Hollow wall thickness

  // Luminance-preserving greyscale roof-tile shader so INDIGO_SLATE_PAL stays rich twilight blue!
  const indigoTileMat = G(0xffffff, K.tex('roof_tiles', 0.5, 0.5), 0.44, 0.52, { roughness: 0.66, metalness: 0 });

  // Consolidated Storybook materials (100% metalness: 0, <= 45 draw calls!)
  const flagstoneMat = M(0xffffff, IT.flagstone, { roughness: 0.84, metalness: 0 });
  const menuMat = M(0xffffff, IT.menuBoard, { roughness: 0.80, metalness: 0 });
  const scrollMat = M(0xffffff, IT.scrollTex, { roughness: 0.86, metalness: 0 });
  const crimsonCushMat = M(0xb32840, null, { roughness: 0.80, metalness: 0 });
  const vaseBlueMat = M(0x586d92, null, { roughness: 0.46, metalness: 0 });
  const brothGlow = glowMat(0xf2a63b, 0xd87a1c, 0.48, { roughness: 0.36 });

  // Shared unit cylinder for instanced bowls, sake bottles, cups & ramen toppings (1 InstancedMesh total!)
  const cylClutterGeo = () => new THREE.CylinderGeometry(1, 0.84, 1, 9);

  // ==========================================================================
  // 1. MOSSY SHORELINE STONE FOUNDATION, STEPS & LUSH HYDRANGEAS
  // ==========================================================================
  buildMossyStonePlinth(THREE, K, {
    w: 9.6,
    d: 8.2,
    h: 0.38,
    doorX: 0.1,
    doorW: 2.0,
    steps: 3,
    hydrangeas: true,
  });

  // Extra lush front-left purple hydrangea mound & shoreline boulders reusing bath_kit's exact batch keys
  {
    const dummyGeo = () => new THREE.IcosahedronGeometry(0.13, 0);
    for (const [bx, bz, cnt] of [[-4.88, 3.25, 16], [-4.52, 4.18, 14], [4.78, 3.92, 10]]) {
      for (let i = 0; i < cnt; i++) {
        pushInst('hyd_leaf', dummyGeo, bm.leafInst,
          bx + jr(-0.48, 0.48), 0.24 + jr(0, 0.48), bz + jr(-0.44, 0.44),
          jr(-0.7, 0.7), jr(0, TAU), jr(-0.5, 0.5), jr(1.0, 1.5), jr(1.0, 1.5), 1, pick(FOLIAGE_PAL));
      }
      for (let i = 0; i < Math.round(cnt * 0.85); i++) {
        pushInst('hyd_floret', dummyGeo, bm.whiteInst,
          bx + jr(-0.40, 0.40), 0.36 + jr(0, 0.48), bz + jr(-0.38, 0.38),
          jr(0, 3), jr(0, 3), 0, jr(0.95, 1.4), jr(0.85, 1.25), jr(0.95, 1.4), pick(HYDRANGEA_PAL));
      }
    }
    for (const [rx, rz, sc] of [[-4.95, 3.72, 1.25], [-4.22, 4.34, 1.1], [4.85, 4.22, 1.15]]) {
      pushInst('plinth_rock', dummyGeo, bm.stoneInst,
        rx, 0.20, rz, jr(0, 2), jr(0, 3), 0, sc, sc * 0.78, sc,
        rx < 0 ? pick(STONE_BOULDER_PAL) : pick(MOSS_BOULDER_PAL));
    }
  }

  // Right-side canal terrace vermilion balustrade accent (seen on right edge of ext_02!)
  {
    const rx = 4.66;
    for (const pz of [1.85, 2.85, 3.85]) {
      add(b1(0.11, 0.68, 0.11, 0.02, bm.vermilion), rx, Y0 + 0.34, pz);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bm.goldTrim), rx, Y0 + 0.71, pz);
    }
    add(b1(0.09, 0.07, 2.12, 0.02, bm.vermilion), rx, Y0 + 0.58, 2.85);
    add(b1(0.07, 0.055, 2.12, 0.015, bm.vermilionDeep), rx, Y0 + 0.34, 2.85);
  }

  // ==========================================================================
  // 2. INTERIOR & PORCH FLOORS (Flagstones on Left + Porch, Raised Tatami on Right)
  // ==========================================================================
  const floorMesh = add(fbox(9.28, 0.04, 7.82, flagstoneMat), 0, Y0 - 0.005, 0.16);
  floorMesh.userData.ground = true;

  // Raised Woven Green Igusa Tatami Mat Floor in Right Room (tatami_hall)
  const YT = Y0 + 0.055;
  add(fbox(4.14, 0.055, 5.28, bm.tatami), 2.21, Y0 + 0.027, -0.82);
  add(fbox(3.04, 0.055, 1.08, bm.tatami), 2.76, Y0 + 0.027, 2.35);
  for (const tz of [-2.15, -0.82, 0.50]) {
    add(fbox(4.10, 0.012, 0.036, bm.darkTimber), 2.21, YT + 0.004, tz);
  }
  add(fbox(0.036, 0.012, 5.24, bm.darkTimber), 2.21, YT + 0.004, -0.82);
  add(b1(1.16, 0.068, 0.11, 0.02, bm.hinoki), 0.70, Y0 + 0.032, 1.82);
  add(b1(0.11, 0.068, 1.12, 0.02, bm.hinoki), 1.24, Y0 + 0.032, 2.36);
  add(b1(3.08, 0.068, 0.11, 0.02, bm.hinoki), 2.76, Y0 + 0.032, 2.89);

  // ==========================================================================
  // 3. HOLLOW WALL SHELL, WAINSCOTING, HALF-TIMBERING, KUMIKO & MARUMADO WINDOWS
  // ==========================================================================
  wall(0, -3.55, PI, W, H, TH, [
    { u: -2.62, y0: 1.08, w: 1.46, h: 1.46, round: true },
    { u: 1.52, y0: 1.16, w: 1.32, h: 1.24 },
  ], bm.creamPlaster, bm.warmInnerWall);

  // Hero Back-Right Glowing Circular Marumado Shoji Window
  addMarumadoWindow(THREE, K, { cx: 2.62, cy: 1.81, cz: -3.43, rotY: 0, radius: 0.73 });
  // Back-Left Kitchen Kumiko Shoji Window
  addKumikoLite(-1.52, 1.78, -3.43, 0, 1.36, 1.26, 3, 3);

  // Left wall (x = -4.50, rotY = -PI/2)
  wall(-4.50, -0.22, -PI * 0.5, 6.66, H, TH, [
    { u: 2.10, y0: 1.05, w: 1.58, h: 1.44 },
  ], bm.creamPlaster, bm.warmInnerWall);
  addKumikoLite(-4.38, 1.77, 1.88, PI * 0.5, 1.62, 1.46, 4, 3);

  // Right wall (x = +4.50, rotY = +PI/2)
  wall(4.50, -0.22, PI * 0.5, 6.66, H, TH, [
    { u: 1.65, y0: 1.04, w: 1.82, h: 1.44 },
    { u: -1.15, y0: 1.04, w: 1.82, h: 1.44 },
  ], bm.creamPlaster, bm.warmInnerWall);
  addKumikoLite(4.38, 1.76, -1.87, -PI * 0.5, 1.86, 1.46, 4, 3);
  addKumikoLite(4.38, 1.76, 0.93, -PI * 0.5, 1.86, 1.46, 4, 3);

  // Front-left Cross-Gable Shoji Screen Bay (x in [-4.50, -2.18], z = +3.02)
  wall(-3.34, 3.10, 0, 2.32, 2.66, 0.20, [
    { u: -0.54, y0: 0.96, w: 0.90, h: 1.42 },
    { u: 0.54, y0: 0.96, w: 0.90, h: 1.42 },
  ], bm.cedar, bm.warmInnerWall);
  addKumikoLite(-3.88, 1.67, 3.00, 0, 0.94, 1.44, 3, 4);
  addKumikoLite(-2.80, 1.67, 3.00, 0, 0.94, 1.44, 3, 4);

  // Front-right Izakaya Half-Wall & Glowing Shoji Bay (x in [+2.48, +4.50], z = +3.02)
  wall(3.49, 3.10, 0, 2.02, 2.58, 0.20, [
    { u: -0.08, y0: 0.98, w: 1.44, h: 1.36 },
  ], bm.cedar, bm.warmInnerWall);
  addKumikoLite(3.41, 1.66, 3.00, 0, 1.48, 1.38, 4, 3);

  // Interior Cedar Dado Wainscoting + Traditional Nageshi Tie-Beams
  add(fbox(8.56, 0.68, 0.05, bm.cedar), 0, Y0 + 0.34, -3.32);
  add(fbox(8.58, 0.08, 0.08, bm.darkTimber), 0, Y0 + 0.69, -3.31);
  add(fbox(8.58, 0.09, 0.09, bm.darkTimber), 0, 2.58, -3.31);
  add(fbox(0.05, 0.68, 6.24, bm.cedar), 4.26, YT + 0.34, -0.22);
  add(fbox(0.08, 0.08, 6.26, bm.darkTimber), 4.25, YT + 0.69, -0.22);
  for (const bx of [-2.42, -0.62, 0.92, 1.72, 3.56]) {
    add(fbox(0.10, H - Y0, 0.08, bm.darkTimber), bx, (H + Y0) * 0.5, -3.31);
  }

  // Corner structural pillars & warm vermilion-cedar dollhouse cutaway wall-cap rim
  for (const [px, pz] of [[-4.42, -3.48], [4.42, -3.48], [-4.42, 3.02], [4.42, 3.02], [0, -3.48]]) {
    add(fbox(0.24, H - Y0 + 0.08, 0.24, bm.darkTimber), px, (H + Y0) * 0.5, pz);
  }
  add(fbox(W + 0.16, 0.11, 0.30, bm.vermilionDeep), 0, H + 0.02, -3.43);
  add(fbox(0.30, 0.11, 6.72, bm.vermilionDeep), -4.38, H + 0.02, -0.18);
  add(fbox(0.30, 0.11, 6.72, bm.vermilionDeep), 4.38, H + 0.02, -0.18);

  // ==========================================================================
  // 4. OPEN-FRONT DINING PORCH: TIMBER POSTS, SAKE BARRELS & PATIO TABLES
  // ==========================================================================
  // Sturdy Porch Posts on Stone Tsuka-Ishi Bases (clear 1.84m doorway at doorX = 0.1: posts at -0.82 and +1.02!)
  const porchPosts = [
    [-4.34, 3.76],
    [-2.26, 3.80],
    [-0.82, 3.80],
    [1.02, 3.80],
    [4.30, 3.80],
  ];
  for (const [px, pz] of porchPosts) {
    add(fbox(0.30, 0.16, 0.30, bm.stoneFloor), px, Y0 + 0.08, pz);
    add(fbox(0.20, H - Y0 - 0.14, 0.20, bm.cedar), px, Y0 + 0.16 + (H - Y0 - 0.14) * 0.5, pz);
    boxCol(px, pz, 0.22, 0.22);
  }

  function addCooperedBarrel(x, y, z, rBot, rMid, hB, hoops = 3, lidded = true) {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(rBot, 0),
      new THREE.Vector2(rMid, hB * 0.48),
      new THREE.Vector2(rBot * 1.03, hB),
      new THREE.Vector2(lidded ? 0 : rBot * 0.88, hB),
    ];
    if (!lidded) {
      pts.push(new THREE.Vector2(rBot * 0.88, hB * 0.84), new THREE.Vector2(0, hB * 0.84));
    }
    add(new THREE.Mesh(new THREE.LatheGeometry(pts, 12), bm.cedar), x, y, z);
    for (let i = 0; i < hoops; i++) {
      const f = (i + 0.5) / hoops;
      const rr = rBot + Math.sin(f * PI) * (rMid - rBot) + 0.008;
      const hoop = new THREE.TorusGeometry(rr, 0.016, 5, 14);
      hoop.rotateX(PI * 0.5);
      add(new THREE.Mesh(hoop, bm.darkTimber), x, y + f * hB, z);
    }
    if (lidded) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(rBot * 0.96, rBot * 0.96, 0.035, 10), bm.hinoki), x, y + hB + 0.015, z);
    }
  }

  function addPatioTableSet(tx, tz, stoolOffsets) {
    const ty = Y0, th = 0.66;
    add(b1(1.10, 0.07, 0.66, 0.02, bm.hinoki), tx, ty + th, tz);
    add(fbox(0.98, 0.05, 0.54, bm.cedar), tx, ty + th - 0.06, tz);
    for (const sx of [-0.46, 0.46]) {
      for (const sz of [-0.24, 0.24]) {
        add(fbox(0.065, th - 0.04, 0.065, bm.cedar), tx + sx, ty + (th - 0.04) * 0.5, tz + sz);
      }
      add(fbox(0.045, 0.04, 0.48, bm.cedar), tx + sx, ty + 0.20, tz);
    }
    // Chopstick cylinder, ceramic soy bottle & bun bowl
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, tx - 0.22, ty + th + 0.10, tz - 0.08, 0, 0, 0, 0.05, 0.14, 0.05, 0x4a2c1c);
    for (let c = 0; c < 4; c++) {
      add(fbox(0.012, 0.20, 0.012, bm.hinoki), tx - 0.22 + (c - 1.5) * 0.016, ty + th + 0.16, tz - 0.08, 0.08 * (c - 1.5), 0, 0.06 * (c % 2 ? 1 : -1));
    }
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, tx + 0.02, ty + th + 0.09, tz + 0.06, 0, 0, 0, 0.048, 0.11, 0.048, 0xf6ebd6);
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, tx + 0.28, ty + th + 0.068, tz - 0.04, 0, 0, 0, 0.088, 0.065, 0.088, 0x351e18);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), bm.creamPlaster), tx + 0.28, ty + th + 0.095, tz - 0.04);

    for (const [dx, dz] of stoolOffsets) {
      const sx = tx + dx, sz = tz + dz, sh = 0.40;
      add(b1(0.34, 0.05, 0.34, 0.015, bm.hinoki), sx, ty + sh, sz);
      for (const lx of [-0.12, 0.12]) {
        for (const lz of [-0.12, 0.12]) {
          add(fbox(0.045, sh - 0.02, 0.045, bm.cedar), sx + lx, ty + (sh - 0.02) * 0.5, sz + lz);
        }
        add(fbox(0.035, 0.035, 0.24, bm.cedar), sx + lx, ty + 0.14, sz);
      }
    }
  }

  if (garden) {
    add(b1(1.78, 0.08, 0.64, 0.02, bm.darkTimber), -3.52, Y0 + 0.04, 3.46);
    addCooperedBarrel(-4.08, Y0 + 0.08, 3.34, 0.34, 0.41, 1.08, 4, true);
    addCooperedBarrel(-3.38, Y0 + 0.08, 3.52, 0.30, 0.33, 0.68, 3, false);
    addCooperedBarrel(-2.84, Y0 + 0.08, 3.56, 0.18, 0.21, 0.44, 2, true);

    addPatioTableSet(-1.54, 3.42, [[-0.58, 0.05], [-0.18, 0.46], [0.30, 0.46]]);
    addPatioTableSet(2.58, 3.42, [[-0.64, 0.04], [-0.15, 0.46], [0.34, 0.46]]);

    add(b1(0.68, 0.56, 0.42, 0.02, bm.cedar), 3.92, Y0 + 0.28, 3.45);
    addCooperedBarrel(3.92, Y0 + 0.56, 3.45, 0.16, 0.19, 0.38, 2, true);
  } else {
    add(b1(1.15, 0.12, 0.52, 0.02, bm.darkTimber), -3.82, Y0 + 0.06, 3.42);
    addCooperedBarrel(-3.98, Y0 + 0.12, 3.40, 0.28, 0.34, 0.88, 3, true);
    addCooperedBarrel(-3.42, Y0 + 0.12, 3.44, 0.20, 0.23, 0.50, 2, false);
    boxCol(-3.72, 3.42, 1.20, 0.58);
  }

  // ==========================================================================
  // 5. GRAND ROUNDED WOODEN MOON-ARCH PORTAL PARTITION WALL (x = 0)
  // Separates Left Noodle Kitchen (`noodle_bar`) & Right Tatami Room (`tatami_hall`)
  // ==========================================================================
  {
    // Partition runs z in [-3.45, +1.45] (L = 4.90, cz = -1.00), leaving z in [+1.45, +3.02]
    // as the welcoming open stone-flagged foyer around doorIn (0.1, 2.55)!
    // Grand Moon-Arch Portal sits at world z = +0.15 (w: 1.75, h: 2.50 above Y0 -> innerDoors: [{ x: 0.0, z: 0.15 }])!
    const L_PART = 4.90;
    const czPart = -1.00;
    const uPortal = 0.15 - czPart; // +1.15 -> world z = +0.15
    wall(-0.12, czPart, -PI * 0.5, L_PART, H - 0.04, 0.24, [
      { u: uPortal, w: 1.75, h: Y0 + 2.50, door: true, arch: true },
      { u: -1.12, y0: 1.04, w: 1.54, h: 1.46 },
    ], bm.warmInnerWall, bm.warmInnerWall, root, false);
    // Solid pier collider strictly on z in [-3.43, -0.80] so Moon-Arch & foyer stay 100% clear!
    boxCol(0.0, -2.12, 0.24, 2.62);

    // Glowing Kumiko shoji lattice partition window + overhead Moon-Arch transom spandrel
    addKumikoLite(0.0, 1.77, -2.12, PI * 0.5, 1.58, 1.48, 3, 3);
    addKumikoLite(0.0, 2.98, 0.15, PI * 0.5, 1.72, 0.34, 4, 1);

    // Rich lacquered double-sided curved Moon-Arch wooden portal trim & end pillars
    const archR = 0.90;
    const archSpringY = Y0 + 2.50 - 0.875;
    for (const sx of [-0.09, 0.09]) {
      const pArch = new THREE.TorusGeometry(archR, 0.062, 7, 20, PI * 1.16);
      add(new THREE.Mesh(pArch, bm.vermilionDeep), sx, archSpringY, 0.15, 0, PI * 0.5, -0.08 * PI);
    }
    for (const sz of [-0.90, 0.90]) {
      add(fbox(0.28, archSpringY - Y0 + 0.12, 0.14, bm.vermilionDeep), 0.0, (archSpringY + Y0) * 0.5, 0.15 + sz);
    }
    // Sturdy dark-timber terminal pillar at front end of partition + vermilion cutaway wall-cap rim!
    add(fbox(0.26, H - Y0 + 0.04, 0.26, bm.darkTimber), 0.0, (H + Y0) * 0.5, 1.44);
    add(b1(0.30, 0.11, L_PART + 0.12, 0.025, bm.vermilionDeep), 0.0, H + 0.02, czPart);
  }

  // ==========================================================================
  // 6. LEFT ROOM (`noodle_bar`): HINOKI RAMEN COUNTER, CAULDRONS, STEAMERS & LANTERNS
  // ==========================================================================
  boxCol(-3.16, 0.02, 2.24, 4.16);

  // A. L-Shaped Golden Hinoki Ramen Counter + 4 Red-Cushioned Wooden Stools
  {
    const cTopY = Y0 + 0.86;
    add(b1(0.58, 0.84, 3.92, 0.02, bm.cedar), -2.62, Y0 + 0.42, -0.06);
    add(b1(1.90, 0.84, 0.56, 0.02, bm.cedar), -3.28, Y0 + 0.42, 1.92);
    for (let z = -1.82; z <= 1.82; z += 0.38) {
      add(fbox(0.04, 0.78, 0.05, bm.darkTimber), -2.32, Y0 + 0.41, z);
    }
    add(b1(0.76, 0.085, 4.16, 0.025, bm.hinoki), -2.56, cTopY, -0.04);
    add(b1(1.98, 0.085, 0.68, 0.025, bm.hinoki), -3.28, cTopY, 1.94);
    add(fbox(0.22, 0.22, 4.08, bm.cedar), -2.92, cTopY + 0.13, -0.06);
    add(b1(0.26, 0.045, 4.12, 0.015, bm.hinoki), -2.92, cTopY + 0.25, -0.06);

    // 3 Ceramic Ramen Bowls (broth, noodles, pink swirl narutomaki, egg & scallions!)
    const bowlPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.09, 0),
      new THREE.Vector2(0.11, 0.03),
      new THREE.Vector2(0.20, 0.13),
      new THREE.Vector2(0.185, 0.135),
      new THREE.Vector2(0.14, 0.05),
      new THREE.Vector2(0, 0.05),
    ];
    const rBowlGeo = new THREE.LatheGeometry(bowlPts, 12);
    for (const bz of [-1.22, -0.18, 0.86]) {
      const bx = -2.50, by = cTopY + 0.042;
      add(new THREE.Mesh(rBowlGeo, bm.darkTimber), bx, by, bz);
      const rim = new THREE.TorusGeometry(0.195, 0.011, 5, 14);
      rim.rotateX(PI * 0.5);
      add(new THREE.Mesh(rim, bm.vermilion), bx, by + 0.126, bz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.16, 0.02, 12), brothGlow), bx, by + 0.098, bz);
      for (let n = 0; n < 3; n++) {
        const nt = new THREE.TorusGeometry(0.062 + n * 0.018, 0.014, 4, 9, PI * 1.35);
        nt.rotateX(PI * 0.5);
        add(new THREE.Mesh(nt, bm.hinoki), bx - 0.02, by + 0.112, bz + (n - 1) * 0.02, 0.1, n * 1.2, 0);
      }
      // Narutomaki pink swirl + halved Ajitama egg + green scallions via shared cylClutterGeo!
      pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, bx + 0.055, by + 0.118, bz - 0.045, 0.16, 0, -0.15, 0.042, 0.014, 0.042, 0xfff6ea);
      pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, bx + 0.055, by + 0.122, bz - 0.045, 0.16, 0, -0.15, 0.024, 0.016, 0.024, 0xf57da4);
      pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, bx - 0.056, by + 0.116, bz + 0.050, 0, 0.3, 0, 0.048, 0.016, 0.036, 0xfff8ee);
      pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, bx - 0.056, by + 0.123, bz + 0.050, 0, 0.3, 0, 0.025, 0.017, 0.025, 0xf5841a);
      for (let g = 0; g < 3; g++) {
        pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst,
          bx + (g - 1) * 0.032, by + 0.120, bz + (g % 2 ? -0.02 : 0.02), 0, 0, 0, 0.016, 0.013, 0.016, 0x5cb644);
      }
    }

    // Mini glowing wooden counter lantern + 2 bamboo chopstick holders + soy/chili jars
    const lx = -2.48, lz = 1.72, ly = cTopY + 0.04;
    add(b1(0.20, 0.04, 0.20, 0.01, bm.darkTimber), lx, ly + 0.02, lz);
    add(b1(0.15, 0.24, 0.15, 0.015, bm.lanternGlow), lx, ly + 0.16, lz);
    add(b1(0.22, 0.04, 0.22, 0.01, bm.darkTimber), lx, ly + 0.29, lz);
    for (const cz of [1.42, -1.68]) {
      pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, -2.48, ly + 0.09, cz, 0, 0, 0, 0.064, 0.18, 0.064, 0x4d2e1e);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        add(fbox(0.012, 0.26, 0.012, bm.hinoki),
          -2.48 + Math.cos(a) * 0.026, ly + 0.18, cz + Math.sin(a) * 0.026,
          Math.sin(a) * 0.11, 0, Math.cos(a) * 0.11);
      }
    }
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, -2.90, cTopY + 0.34, 1.15, 0, 0, 0, 0.05, 0.14, 0.05, 0x351e18);
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, -2.90, cTopY + 0.33, 0.96, 0, 0, 0, 0.04, 0.12, 0.04, 0xc9362c);

    // 4 Round Red-Cushioned Wooden Counter Stools along customer side (x = -2.04)
    for (const sz of [-1.45, -0.52, 0.42, 1.35]) {
      const sx = -2.04, sy = Y0;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.22, 0.045, 12), bm.cedar), sx, sy + 0.50, sz);
      const cush = new THREE.Mesh(new THREE.SphereGeometry(0.225, 12, 8), crimsonCushMat);
      cush.scale.set(1, 0.34, 1);
      add(cush, sx, sy + 0.545, sz);
      for (let l = 0; l < 4; l++) {
        const a = (l / 4) * TAU + PI * 0.25;
        beam(
          [sx + Math.cos(a) * 0.14, sy + 0.49, sz + Math.sin(a) * 0.14],
          [sx + Math.cos(a) * 0.19, sy + 0.01, sz + Math.sin(a) * 0.19],
          0.044, bm.cedar
        );
      }
      const rung = new THREE.TorusGeometry(0.165, 0.016, 5, 12);
      rung.rotateX(PI * 0.5);
      add(new THREE.Mesh(rung, bm.darkTimber), sx, sy + 0.18, sz);
    }
  }

  // B. Behind the Counter: Kamado Broth Range, 2 Steaming Cauldrons, Bamboo Seiro Steamers & Dish Shelves
  {
    add(b1(1.06, 0.70, 3.48, 0.03, bm.warmBrick), -3.72, Y0 + 0.35, -0.20);
    add(b1(1.12, 0.07, 3.54, 0.02, bm.ironWarm), -3.72, Y0 + 0.72, -0.20);
    for (const fz of [0.98, -0.06]) {
      add(b1(0.08, 0.18, 0.34, 0.02, bm.fireGlow), -3.17, Y0 + 0.22, fz);
    }

    // 2 Big Steaming Burnished-Iron & Copper Broth Cauldrons (z = +1.02 and z = -0.04)
    for (const [idx, cz] of [[0, 1.02], [1, -0.04]]) {
      const cx = -3.66, cy = Y0 + 0.75;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.39, 0.54, 14), bm.ironWarm), cx, cy + 0.27, cz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.445, 0.22, 14), bm.copperWarm), cx, cy + 0.30, cz);
      const potRim = new THREE.TorusGeometry(0.44, 0.028, 6, 16);
      potRim.rotateX(PI * 0.5);
      add(new THREE.Mesh(potRim, bm.brassWarm), cx, cy + 0.54, cz);
      for (const sz of [-1, 1]) {
        add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 5, 9, PI), bm.brassWarm), cx, cy + 0.44, cz + sz * 0.45, sz * 0.4, 0, 0);
      }
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.03, 12), brothGlow), cx, cy + 0.49, cz);
      if (idx === 0) {
        beam([cx - 0.05, cy + 0.50, cz - 0.05], [cx + 0.24, cy + 0.86, cz + 0.20], 0.032, bm.hinoki);
      } else {
        const halfLid = new THREE.CylinderGeometry(0.43, 0.43, 0.045, 12, 1, false, 0, PI * 1.15);
        add(new THREE.Mesh(halfLid, bm.cedar), cx - 0.04, cy + 0.565, cz, 0, 0.4, 0);
        add(b1(0.56, 0.055, 0.07, 0.015, bm.darkTimber), cx - 0.08, cy + 0.61, cz, 0, 0.4, 0);
      }
    }

    // Multi-Tier Golden Bamboo Seiro Bun Steamers (2 stacks at z = -0.96 and z = -1.62)
    const steamerStacks = [
      [-3.66, Y0 + 0.75, -0.96, 0.34, 4],
      [-3.50, Y0 + 0.75, -1.62, 0.26, 3],
    ];
    for (const [sx, sy, sz, sr, tiers] of steamerStacks) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.92, sr * 0.85, 0.14, 12), bm.ironWarm), sx, sy + 0.07, sz);
      for (let t = 0; t < tiers; t++) {
        const ty = sy + 0.14 + t * 0.165;
        add(new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, 0.155, 12), bm.hinoki), sx, ty + 0.078, sz);
        const band = new THREE.TorusGeometry(sr + 0.006, 0.013, 5, 14);
        band.rotateX(PI * 0.5);
        add(new THREE.Mesh(band, bm.cedar), sx, ty + 0.14, sz);
      }
      const topY = sy + 0.14 + tiers * 0.165;
      add(new THREE.Mesh(new THREE.ConeGeometry(sr * 1.02, 0.12, 12), bm.cedar), sx, topY + 0.06, sz);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 5, 9, PI), bm.darkTimber), sx, topY + 0.12, sz);
    }

    // Delicate Billowing Kitchen Steam Puffs (merged into 1 non-shadow-casting Mesh -> 1 draw call!)
    {
      const steamGeos = [];
      const puffSources = [
        [-3.66, Y0 + 1.36, 1.02, 6],
        [-3.64, Y0 + 1.36, -0.04, 5],
        [-3.64, Y0 + 1.58, -0.96, 4],
      ];
      for (const [px, py, pz, nPuffs] of puffSources) {
        for (let i = 0; i < nPuffs; i++) {
          const f = i / Math.max(1, nPuffs - 1);
          const rad = 0.10 + f * 0.17;
          const g = new THREE.IcosahedronGeometry(rad, 1);
          g.scale(1.15, 0.78, 1.10);
          g.translate(
            px - f * 0.10 + Math.sin(i * 1.9 + pz) * (0.06 + f * 0.14),
            py + f * 0.98,
            pz + Math.cos(i * 1.4) * (0.06 + f * 0.12)
          );
          steamGeos.push(g);
        }
      }
      const steamMesh = new THREE.Mesh(mergeGeometries(steamGeos, false), bm.steamWisps);
      steamMesh.castShadow = false;
      steamMesh.receiveShadow = false;
      steamMesh.name = 'kitchen_steam';
      root.add(steamMesh);
      steamGeos.forEach((g) => g.dispose());
    }

    // 3 Wooden Kitchen Wall Shelves along Left Wall packed with ceramic bowls & sake bottles
    const dishCols = [0xf6ebd6, 0xe4dcc8, 0x8ea89c, 0x5d7294, 0xd99b66];
    for (const sy of [Y0 + 1.38, Y0 + 1.84, Y0 + 2.28]) {
      add(b1(0.36, 0.05, 3.85, 0.015, bm.cedar), -4.18, sy, -1.15);
      for (const bz of [-2.85, -1.72, -0.58, 0.52]) {
        add(fbox(0.28, 0.16, 0.06, bm.darkTimber), -4.22, sy - 0.09, bz);
      }
      for (let z = -2.92; z <= 0.62; z += 0.36) {
        if (Math.abs(Math.sin(z * 3.7 + sy * 5.1)) > 0.35) {
          const stH = 1 + Math.floor(jr(0, 2.8));
          const col = pick(dishCols);
          for (let s = 0; s < stH; s++) {
            pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst,
              -4.15 + jr(-0.03, 0.03), sy + 0.065 + s * 0.068, z + jr(-0.02, 0.02),
              0, jr(0, TAU), 0, 0.105, 0.088, 0.105, col);
          }
        } else {
          pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst,
            -4.16, sy + 0.135, z, 0, jr(0, TAU), 0, 0.068, 0.22 * jr(0.9, 1.2), 0.068, pick([0xf4ead4, 0x4d6082, 0x9c6844]));
        }
      }
    }

    // Wooden Menu Plaques (品書き) + Copper Kettle Shelf on Back Kitchen Wall
    add(b1(1.34, 0.52, 0.05, 0.015, menuMat), -3.22, Y0 + 1.98, -3.34);
    add(b1(0.05, 0.52, 1.42, 0.015, menuMat), -4.32, Y0 + 2.38, 1.80);
    add(b1(0.96, 0.05, 0.28, 0.015, bm.cedar), -0.52, Y0 + 1.75, -3.22);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bm.copperWarm), -0.68, Y0 + 1.90, -3.22);
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, -0.34, Y0 + 1.89, -3.22, 0, 0, 0, 0.095, 0.24, 0.095, 0xf6ebd6);
  }

  // C. Overhead Row of 5 Glowing Red-Orange Chochin Lanterns above the Ramen Counter (y = 2.50m < 3.1m!)
  add(b1(0.14, 0.12, 4.45, 0.025, bm.vermilionDeep), -2.52, 2.94, -0.02);
  for (const lz of [1.72, 0.85, -0.02, -0.89, -1.76]) {
    addChochinLantern(THREE, K, {
      x: -2.52,
      y: 2.50,
      z: lz,
      radius: 0.23,
      height: 0.42,
      red: true,
      tassel: true,
      parent: root,
    });
  }

  // ==========================================================================
  // 7. RIGHT ROOM (`tatami_hall`): SAKURA VASE, SCROLL, LANTERNS & 3 LOW TABLES
  // ==========================================================================
  // A. Back-Wall Blue Porcelain Vase Bursting with 3D Pink Sakura Branches (beside Marumado window!)
  {
    const vx = 1.26, vz = -3.02, vy = YT;
    add(b1(0.56, 0.08, 0.56, 0.025, bm.darkTimber), vx, vy + 0.04, vz);
    const vasePts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.16, 0),
      new THREE.Vector2(0.27, 0.24),
      new THREE.Vector2(0.25, 0.45),
      new THREE.Vector2(0.11, 0.58),
      new THREE.Vector2(0.16, 0.66),
      new THREE.Vector2(0.12, 0.66),
      new THREE.Vector2(0.09, 0.56),
    ];
    add(new THREE.Mesh(new THREE.LatheGeometry(vasePts, 14), vaseBlueMat), vx, vy + 0.08, vz);
    boxCol(vx, vz, 0.54, 0.54);

    // 5 Spreading Gnarled Cherry Branches + 85 Instanced 3D Pink Sakura Blossoms!
    const branchSpecs = [
      [[0, 0.62, 0], [-0.30, 1.14, 0.08], [-0.66, 1.58, 0.14], [-0.94, 1.84, 0.18]],
      [[0, 0.62, 0], [-0.14, 1.26, 0.06], [-0.30, 1.82, 0.12], [-0.46, 2.12, 0.16]],
      [[0, 0.62, 0], [0.10, 1.28, 0.06], [0.20, 1.88, 0.10], [0.10, 2.18, 0.14]],
      [[0, 0.62, 0], [0.30, 1.20, 0.08], [0.62, 1.64, 0.15], [0.88, 1.90, 0.20]],
      [[0, 0.62, 0], [0.18, 1.02, 0.14], [0.48, 1.32, 0.26], [0.72, 1.46, 0.30]],
    ];
    const sakuraGeo = () => {
      const g = new THREE.IcosahedronGeometry(0.076, 0);
      g.scale(1.18, 0.65, 1.18);
      return g;
    };
    for (const pts of branchSpecs) {
      const curve = new THREE.CatmullRomCurve3(pts.map(([dx, dy, dz]) => new THREE.Vector3(vx + dx, vy + dy, vz + dz)));
      add(new THREE.Mesh(new THREE.TubeGeometry(curve, 9, 0.024, 5, false), bm.darkTimber), 0, 0, 0);
      for (let b = 2; b <= 18; b++) {
        const p = curve.getPoint(b / 18);
        const sc = jr(0.90, 1.50);
        pushInst('iz_sakura_petal', sakuraGeo, bm.whiteInst,
          p.x + jr(-0.13, 0.13), p.y + jr(-0.08, 0.13), p.z + jr(-0.10, 0.13),
          jr(0, TAU), jr(0, TAU), 0, sc, sc, sc, pick(SAKURA_PAL));
      }
    }
  }

  // Tokonoma Hanging Scroll (kakejiku) on back-left wall of Tatami Hall
  add(fbox(0.58, 1.16, 0.03, scrollMat), 0.50, YT + 1.54, -3.32);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.66, 8), bm.darkTimber), 0.50, YT + 0.95, -3.31, 0, 0, PI * 0.5);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.66, 8), bm.darkTimber), 0.50, YT + 2.13, -3.31, 0, 0, PI * 0.5);

  // 2 Warm Glowing Wood-Framed Ceiling Box Lanterns positioned so tables, sakura vase & Marumado stay 100% unobstructed!
  for (const [lx, lz] of [[0.76, 1.68], [3.88, -0.75]]) {
    add(fbox(0.032, 0.28, 0.032, bm.darkTimber), lx, 3.02, lz);
    add(fbox(0.34, 0.40, 0.34, bm.chochinGoldGlow), lx, 2.72, lz);
    for (const sx of [-0.17, 0.17]) {
      for (const sz of [-0.17, 0.17]) {
        add(fbox(0.026, 0.42, 0.026, bm.darkTimber), lx + sx, 2.72, lz + sz);
      }
    }
    add(fbox(0.40, 0.04, 0.40, bm.darkTimber), lx, 2.93, lz);
    add(fbox(0.40, 0.04, 0.40, bm.darkTimber), lx, 2.51, lz);
  }

  // B. 3 Low Dark-Wood Lacquered Dining Tables + Crimson/Plum Zabuton Cushions + Tabletop Lanterns
  function addTatamiDiningTable(tx, tz, wT = 1.04, dT = 0.70, cushionDirs = [[0, -1], [0, 1], [-1, 0]]) {
    const ty = YT, hT = 0.33;
    add(b1(wT, 0.06, dT, 0.02, bm.darkTimber), tx, ty + hT, tz);
    add(fbox(wT - 0.08, 0.045, dT - 0.08, bm.vermilionDeep), tx, ty + hT - 0.04, tz);
    for (const sx of [-(wT * 0.5 - 0.10), wT * 0.5 - 0.10]) {
      for (const sz of [-(dT * 0.5 - 0.10), dT * 0.5 - 0.10]) {
        add(fbox(0.07, hT - 0.02, 0.07, bm.darkTimber), tx + sx, ty + (hT - 0.02) * 0.5, tz + sz);
      }
    }
    boxCol(tx, tz, wT, dT);

    // Warm glowing mini square Andon tabletop lantern + ceramic tea/sake set!
    add(fbox(0.16, 0.03, 0.16, bm.darkTimber), tx, ty + hT + 0.042, tz);
    add(fbox(0.125, 0.21, 0.125, bm.lanternGlow), tx, ty + hT + 0.155, tz);
    add(fbox(0.17, 0.03, 0.17, bm.darkTimber), tx, ty + hT + 0.27, tz);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), bm.ironWarm), tx - 0.24, ty + hT + 0.068, tz + 0.08);
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, tx + 0.24, ty + hT + 0.058, tz - 0.06, 0, 0, 0, 0.033, 0.055, 0.033, 0xf6ebd6);
    pushInst('iz_cyl_clutter', cylClutterGeo, bm.whiteInst, tx + 0.18, ty + hT + 0.058, tz + 0.12, 0, 0, 0, 0.033, 0.055, 0.033, 0xf6ebd6);

    cushionDirs.forEach(([dx, dz]) => {
      const cx = tx + dx * (wT * 0.5 + 0.30);
      const cz = tz + dz * (dT * 0.5 + 0.30);
      add(b1(0.44, 0.075, 0.44, 0.032, crimsonCushMat), cx, ty + 0.038, cz, 0, jr(-0.06, 0.06), 0);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), bm.goldTrim), cx, ty + 0.078, cz);
    });
  }

  addTatamiDiningTable(3.32, -2.12, 1.02, 0.68, [[0, -1], [0, 1], [-1, 0]]);
  addTatamiDiningTable(0.88, -1.96, 0.96, 0.66, [[0, -1], [0, 1], [1, 0]]);
  addTatamiDiningTable(3.30, 0.12, 1.04, 0.70, [[0, -1], [0, 1], [-1, 0]]);

  // ==========================================================================
  // 8. 2-TIER TWILIGHT INDIGO-SLATE 3D KAWARA ROOFS & EAVE LANTERNS (`K.roofG`)
  // All Kawara roofs share `batchPrefix: 'kawara'` & `indigoTileMat` -> only 4 instanced draw calls!
  // ==========================================================================
  buildKawaraGableRoof(THREE, K, {
    cx: 0.22,
    cz: -0.28,
    yBase: 4.66,
    spanX: 8.0,
    spanZ: 5.8,
    rise: 1.75,
    overhangX: 0.54,
    overhangZ: 0.52,
    ridgeAlongX: true,
    palette: TWILIGHT_INDIGO_PAL,
    tileMat: indigoTileMat,
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // Upper 2nd-story timber-framed plaster clerestory structure (in roofG)
  {
    const uY0 = 3.22, uH = 1.48, uTop = uY0 + uH;
    addR(fbox(7.36, uH, 5.36, bm.creamPlaster), 0.22, uY0 + uH * 0.5, -0.22);
    for (const ux of [-3.46, -1.85, -0.25, 3.90]) {
      for (const uz of [-2.90, 2.46]) {
        addR(fbox(0.18, uH + 0.06, 0.18, bm.darkTimber), ux, uY0 + uH * 0.5, uz);
      }
    }
    addR(fbox(7.52, 0.14, 5.52, bm.darkTimber), 0.22, uTop - 0.04, -0.22);
    addR(fbox(7.48, 0.12, 5.48, bm.cedar), 0.22, uY0 + 0.08, -0.22);

    // Upper-left glowing rectangular Kumiko clerestory windows
    addKumikoLite(-1.04, 4.14, 2.48, 0, 1.42, 0.78, 4, 2, roofG);
    addKumikoLite(-2.62, 4.18, 2.48, 0, 0.92, 0.68, 3, 2, roofG);
    addKumikoLite(0.22, 4.06, -2.92, PI, 1.82, 0.82, 4, 2, roofG);

    // Side gable plaster triangles & vermilion bargeboards on ±X ends of main upper roof
    for (const sx of [-1, 1]) {
      const gShape = new THREE.Shape();
      gShape.moveTo(-3.04, 0);
      gShape.lineTo(3.04, 0);
      gShape.lineTo(0, 1.72);
      gShape.closePath();
      addR(new THREE.Mesh(new THREE.ExtrudeGeometry(gShape, { depth: 0.12, bevelEnabled: false }), bm.creamPlaster),
        0.22 + sx * 3.82, 4.66, -0.28, 0, PI * 0.5, 0);
      addR(fbox(0.16, 0.24, 3.62, bm.vermilion), 0.22 + sx * 4.54, 5.50, -1.84, -0.47, 0, 0);
      addR(fbox(0.16, 0.24, 3.62, bm.vermilion), 0.22 + sx * 4.54, 5.50, 1.28, 0.47, 0, 0);
    }

    // HERO FRONT-RIGHT CROSS-GABLE DORMER housing the Glowing Circular Kumiko Marumado Window (radius: 0.68)!
    const dx = 1.62, dzFront = 2.94;
    addR(fbox(3.48, 1.46, 0.96, bm.creamPlaster), dx, 3.98, 2.48);
    for (const postX of [dx - 1.70, dx - 0.88, dx + 0.88, dx + 1.70]) {
      addR(fbox(0.15, 1.50, 0.16, bm.darkTimber), postX, 3.98, dzFront + 0.02);
    }
    const dGable = new THREE.Shape();
    dGable.moveTo(-1.78, 0);
    dGable.lineTo(1.78, 0);
    dGable.lineTo(0, 1.34);
    dGable.closePath();
    addR(new THREE.Mesh(new THREE.ExtrudeGeometry(dGable, { depth: 0.14, bevelEnabled: false }), bm.creamPlaster), dx, 4.66, dzFront - 0.06);
    addR(fbox(0.15, 1.26, 0.15, bm.darkTimber), dx, 5.26, dzFront + 0.06);
    addR(fbox(3.60, 0.14, 0.18, bm.darkTimber), dx, 4.68, dzFront + 0.06);

    addMarumadoWindow(THREE, K, {
      cx: dx,
      cy: 4.16,
      cz: dzFront + 0.06,
      rotY: 0,
      radius: 0.68,
      parent: roofG,
    });
    for (const sx of [-1, 1]) {
      addKumikoLite(dx + sx * 1.26, 4.08, dzFront + 0.05, 0, 0.60, 0.92, 2, 3, roofG);
    }

    // Crisp dormer cross-gable (tight spanZ = 0.88 so valley meets main slope cleanly with zero low-eave overlap!)
    buildKawaraGableRoof(THREE, K, {
      cx: dx,
      cz: 2.44,
      yBase: 4.68,
      spanX: 3.44,
      spanZ: 0.88,
      rise: 1.36,
      overhangX: 0.42,
      overhangZ: 0.40,
      ridgeAlongX: false,
      palette: TWILIGHT_INDIGO_PAL,
      tileMat: indigoTileMat,
      parent: roofG,
      batchPrefix: 'kawara',
    });
  }

  // Lower Wrap-Around Indigo-Slate Pent Awning across Front (+Z) AND Left Side (-X) + Left Cross-Gable Hood!
  addR(fbox(8.86, 0.18, 0.22, bm.darkTimber), 0, 3.06, 3.80);
  addR(fbox(8.92, 0.14, 0.20, bm.vermilion), 0, 3.20, 3.84);
  addR(fbox(2.36, 0.54, 0.18, bm.creamPlaster), -3.32, 2.95, 3.02);
  addR(fbox(2.04, 0.64, 0.18, bm.creamPlaster), 3.48, 2.90, 3.02);

  // Front lower pent awning across center & right bays (+Z, trimmed cleanly to meet left cross-gable valley!)
  buildKawaraPentAwning(THREE, K, {
    cx: 1.46,
    zWall: 2.96,
    yWall: 3.50,
    width: 6.24,
    depth: 1.36,
    drop: 0.46,
    palette: TWILIGHT_INDIGO_PAL,
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // Left-side (-X) & Right-side (+X) wrap-around lower Kawara pent awnings (trimmed to zEnd=1.66 on -X!)
  {
    const dummyGeo = () => new THREE.BoxGeometry(0.1, 0.1, 0.1);
    for (const [side, zStart, zEnd] of [[-1, -3.55, 1.66], [1, -3.55, 2.95]]) {
      const lenZ = zEnd - zStart;
      const czSide = (zStart + zEnd) * 0.5;
      const xWall = side * 4.44;
      const depthX = 0.88, dropY = 0.34;
      const thetaS = Math.atan2(dropY, depthX);
      addR(fbox(Math.hypot(depthX, dropY), 0.09, lenZ, bm.darkTimber),
        xWall + side * depthX * 0.5, 3.42 - dropY * 0.5, czSide, 0, 0, -side * thetaS);
      addR(fbox(0.08, 0.11, lenZ + 0.12, bm.rafterWood),
        xWall + side * depthX, 3.42 - dropY + 0.02, czSide);
      const rows = 2;
      const cols = Math.floor(lenZ / 0.35);
      for (let r = 0; r < rows; r++) {
        const f = (r + 0.5) / rows;
        const tx = xWall + side * f * depthX;
        const ty = 3.44 - f * dropY + f * f * 0.04;
        for (let c = 0; c < cols; c++) {
          const tz = zStart + 0.20 + c * 0.35;
          const col = pick(TWILIGHT_INDIGO_PAL);
          pushInst('kawara_pan', dummyGeo, indigoTileMat, tx, ty - 0.02, tz, 0, PI * 0.5, -side * thetaS * 0.88, 1, 1, 1, col, roofG);
          pushInst('kawara_brl', dummyGeo, indigoTileMat, tx, ty + 0.02, tz + 0.17, 0, PI * 0.5, -side * thetaS * 0.88, 0.70, 0.82, 0.96, col, roofG);
          if (r === rows - 1) {
            pushInst('kawara_cap', dummyGeo, bm.goldTrim, xWall + side * (depthX + 0.02), ty + 0.02, tz + 0.17, 0, PI * 0.5, 0, 0.72, 0.72, 1, 0xf6c854, roofG);
          }
        }
      }
    }
  }

  // Crisp Left Cross-Gable Hood over the Left Porch Bay (ridgeAlongX: false)
  buildKawaraGableRoof(THREE, K, {
    cx: -3.28,
    cz: 3.04,
    yBase: 3.02,
    spanX: 2.40,
    spanZ: 1.66,
    rise: 1.00,
    overhangX: 0.42,
    overhangZ: 0.42,
    ridgeAlongX: false,
    palette: TWILIGHT_INDIGO_PAL,
    tileMat: indigoTileMat,
    parent: roofG,
    batchPrefix: 'kawara',
  });
  {
    const gx = -3.28, gz = 3.84, gy0 = 3.02, gRise = 0.98, gHalfW = 1.40;
    const tShape = new THREE.Shape();
    tShape.moveTo(-gHalfW, 0);
    tShape.lineTo(gHalfW, 0);
    tShape.lineTo(0, gRise);
    tShape.closePath();
    addR(new THREE.Mesh(new THREE.ExtrudeGeometry(tShape, { depth: 0.10, bevelEnabled: false }), bm.creamPlaster), gx, gy0, gz);
    addR(fbox(0.14, gRise - 0.06, 0.15, bm.darkTimber), gx, gy0 + gRise * 0.48, gz + 0.06);
    addR(fbox(gHalfW * 1.9, 0.13, 0.16, bm.darkTimber), gx, gy0 + 0.04, gz + 0.06);
  }

  // Red Pleated Festoon Valance Banner under Left Cross-Gable Eave (ext_02!)
  addR(fbox(2.40, 0.24, 0.10, bm.vermilion), -3.32, 2.86, 3.92);
  for (const tx of [-4.28, -3.64, -3.00, -2.38]) {
    addR(fbox(0.06, 0.12, 0.12, bm.creamPlaster), tx, 2.74, 3.94);
  }

  // TWO Distinct Indigo Noren Banners across Open Front Bays (100% unobstructed & 1.84m clear entry at doorX=0.1!)
  addNorenCurtain(THREE, K, {
    cx: -1.58,
    yTop: 2.94,
    z: 3.86,
    width: 1.16,
    height: 0.88,
    panels: 3,
    texMap: bm.BT.norenRamen,
    parent: roofG,
  });
  addNorenCurtain(THREE, K, {
    cx: 2.38,
    yTop: 2.94,
    z: 3.86,
    width: 1.62,
    height: 0.88,
    panels: 3,
    texMap: bm.BT.norenBun,
    parent: roofG,
  });

  // 8 Warm Glowing Golden-Orange Chochin Lanterns along Front & Left Eaves
  const extLanternCoords = [
    [-4.96, 2.52, 2.25],   // 1. Left wrap-around eave
    [-4.38, 2.48, 4.06],   // 2. Left cross-gable far-left
    [-3.64, 2.48, 4.06],   // 3. Left cross-gable mid-left
    [-2.92, 2.48, 4.06],   // 4. Left cross-gable mid-right
    [-2.28, 2.50, 4.06],   // 5. Cross-gable right post (left of Ramen Noren)
    [-0.76, 2.52, 4.04],   // 6. Left entry post (clear of Ramen Noren & framing open entry!)
    [1.02, 2.52, 4.04],    // 7. Right entry post (framing open entry!)
    [3.96, 2.50, 4.04],    // 8. Right porch post (framing Bun Noren!)
  ];
  for (const [lx, ly, lz] of extLanternCoords) {
    addChochinLantern(THREE, K, {
      x: lx,
      y: ly,
      z: lz,
      radius: 0.24,
      height: 0.44,
      red: false,
      tassel: true,
      parent: roofG,
    });
  }

  // Warm golden eave-stud lights along the front fascia
  for (let ex = -4.1; ex <= 4.1; ex += 0.68) {
    addR(fbox(0.055, 0.045, 0.055, bm.lanternGlow), ex, 3.08, 4.18);
  }

  // ==========================================================================
  // 9. REQUIRED `root.userData` (Rooms, Doors, 10 PropSlots & WallHooks)
  // ==========================================================================
  root.userData.footprintBox = { x: 0, z: 0, w: 9.8, d: 8.6 };
  root.userData.door = { x: 0.1, z: 4.65 };
  root.userData.doorIn = { x: 0.1, z: 2.55 };
  root.userData.innerDoors = [{ x: 0.0, z: 0.15 }];
  root.userData.rooms = [
    { name: 'noodle_bar', x: -2.1, z: -0.05, w: 4.2, d: 6.7, walkX: -1.05, walkZ: 0.25 },
    { name: 'tatami_hall', x: 2.1, z: -0.05, w: 4.2, d: 6.7, walkX: 1.85, walkZ: 0.25 },
  ];
  root.userData.wallHooks = [
    { x: -2.2, y: 2.35, z: 3.75, propId: 'bh_paper_lantern' },
    { x: 2.4, y: 2.35, z: 3.75, propId: 'bh_paper_lantern' },
  ];
  root.userData.propSlots = [
    // 5 Indoor Hiding Slots in Left Noodle Kitchen (`noodle_bar` — tucked along walls so customer aisle stays wide open!)
    { id: 'bh_steamer_stack', x: -3.45, y: Y0, z: -2.78, rot: 0.35 },
    { id: 'bh_sake_cask', x: -2.35, y: Y0, z: -2.82, rot: -0.25 },
    { id: 'bh_paper_lantern', x: -0.92, y: Y0, z: -2.80, rot: 0.15 },
    { id: 'bh_towel_basket', x: -1.62, y: Y0, z: -2.82, rot: 1.45 },
    { id: 'bh_sake_cask', x: -3.48, y: Y0, z: 2.52, rot: 0.85 },
    // 5 Indoor Hiding Slots in Right Tatami Room (`tatami_hall` — tucked along walls so tatami center stays wide open!)
    { id: 'bh_daruma_doll', x: 2.15, y: YT, z: -2.75, rot: -0.20 },
    { id: 'bh_tea_table', x: 3.32, y: YT, z: -1.15, rot: 0.10 },
    { id: 'bh_daruma_doll', x: 1.45, y: YT, z: 2.32, rot: -0.75 },
    { id: 'bh_paper_lantern', x: 3.52, y: YT, z: 1.25, rot: -1.35 },
    { id: 'bh_towel_basket', x: 2.65, y: YT, z: 2.32, rot: -2.65 },
  ];

  return K.finalize();
}
