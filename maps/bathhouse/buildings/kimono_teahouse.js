// ============================================================================
// Yu-Machi Spirit Bathhouse — Building 4: Wisteria & Silk Kimono Teahouse
// Hand-modelled in Three.js from ext_04_kimono_teahouse.png & int_04_kimono_teahouse.png.
// Origin (0, 0, 0) at ground center; main entrance faces +Z.
// All materials strictly use metalness: 0 for warm Storybook gouache lighting.
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
} from '../../map_kit.js?v=2';
import {
  INDIGO_SLATE_PAL,
  SAKURA_PAL,
  FOLIAGE_PAL,
  HYDRANGEA_PAL,
  STONE_BOULDER_PAL,
  MOSS_BOULDER_PAL,
  getBathMats,
  buildKawaraGableRoof,
  buildKawaraPentAwning,
  buildMossyStonePlinth,
  addKumikoWindow,
  addMarumadoWindow,
  addChochinLantern,
  addPostLantern,
  addWisteriaRaceme,
} from '../bath_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

// Rich twilight indigo-cobalt roof palette matching ext_04_kimono_teahouse.png
const TEAHOUSE_INDIGO_PAL = [
  INDIGO_SLATE_PAL[1],
  INDIGO_SLATE_PAL[3],
  0x586bb0,
  0x687cc2,
  0x495a96,
  0x768ad0,
];

let _localTexCache = null;
function ensureSharedBathCanvases(THREE) {
  // Pre-seed bath_kit's paintedCanvasTex keys with 3-arg (ctx, s, rng) safety
  paintedCanvasTex(THREE, 'bh2_shoji_paper', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#ffe49c'); grd.addColorStop(0.55, '#ffd066'); grd.addColorStop(1, '#ffad38');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 160, ['#ffefb8', '#ffc454', '#fff4cc'], 2, 6, 0.25);
  }, 1, 1);
  paintedCanvasTex(THREE, 'bh2_tatami', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#bcc27a'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(150,160,88,0.45)' : 'rgba(212,216,148,0.35)';
      ctx.fillRect(0, y, s, 2);
    }
    brushStrokes(ctx, s, rng, 90, ['#cace8a', '#a4ac66'], 2, 4, 0.2);
    ctx.fillStyle = '#28364e';
    ctx.fillRect(0, 0, s, 12); ctx.fillRect(0, s - 12, s, 12);
    ctx.fillRect(0, 0, 10, s); ctx.fillRect(s - 10, 0, 10, s);
    ctx.strokeStyle = '#d8aa48'; ctx.lineWidth = 2; ctx.strokeRect(5, 5, s - 10, s - 10);
  }, 2, 2);
  for (const k of ['bh2_noren_onsen', 'bh2_noren_ramen', 'bh2_noren_bun', 'bh2_noren_cream', 'bh2_taiko_head']) {
    paintedCanvasTex(THREE, k, 256, (ctx, s) => { ctx.fillStyle = '#442b68'; ctx.fillRect(0, 0, s, s); }, 1, 1);
  }
  paintedCanvasTex(THREE, 'bh2_fuji_mural', 512, (ctx, s) => { ctx.fillStyle = '#f4d998'; ctx.fillRect(0, 0, s, s); }, 1, 1);
  paintedCanvasTex(THREE, 'bh2_warm_brick', 256, (ctx, s) => { ctx.fillStyle = '#a84334'; ctx.fillRect(0, 0, s, s); }, 2, 2);
  paintedCanvasTex(THREE, 'bh2_gold_pine_byobu', 512, (ctx, s, rng) => {
    ctx.fillStyle = '#ebb94c'; ctx.fillRect(0, 0, s, s);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = rng.pick(['#f3c966', '#e0af45', '#f7d57a', '#d7a43c']);
      ctx.fillRect((c * s) / 6, (r * s) / 6, s / 6 + 1, s / 6 + 1);
    }
    brushStrokes(ctx, s, rng, 140, ['#fae298', '#cfa03c'], 3, 7, 0.24);
    ctx.fillStyle = 'rgba(255,245,198,0.72)';
    for (const [cx, cy, rx, ry] of [[0.24, 0.22, 96, 18], [0.76, 0.28, 108, 19], [0.80, 0.52, 92, 17], [0.54, 0.80, 124, 20]]) {
      ctx.beginPath(); ctx.ellipse(s * cx, s * cy, rx, ry, 0, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#58341e'; ctx.lineWidth = 20; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.14, s * 0.95); ctx.bezierCurveTo(s * 0.26, s * 0.66, s * 0.46, s * 0.54, s * 0.86, s * 0.42); ctx.stroke();
    ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(s * 0.34, s * 0.64); ctx.quadraticCurveTo(s * 0.20, s * 0.46, s * 0.10, s * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.58, s * 0.53); ctx.quadraticCurveTo(s * 0.68, s * 0.66, s * 0.84, s * 0.66); ctx.stroke();
    for (const [px, py, rx, ry] of [
      [0.15, 0.36, 70, 23], [0.36, 0.44, 86, 26], [0.62, 0.38, 92, 27],
      [0.84, 0.40, 74, 23], [0.46, 0.62, 76, 23], [0.76, 0.62, 74, 22],
    ]) {
      ctx.fillStyle = '#294f2c'; ctx.beginPath(); ctx.ellipse(s * px, s * py + 4, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#528840'; ctx.beginPath(); ctx.ellipse(s * px, s * py - 3, rx * 0.88, ry * 0.8, 0, 0, TAU); ctx.fill();
    }
  }, 1, 1);
  const preKimono = (key, base, hi, fl1, fl2) => paintedCanvasTex(THREE, key, 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, base); grd.addColorStop(1, hi);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 110, [base, hi], 3, 6, 0.3);
    ctx.strokeStyle = '#f4cc68'; ctx.lineWidth = 3;
    for (let x = 0; x < s; x += 36) { ctx.beginPath(); ctx.arc(x, s * 0.86, 22, PI, TAU); ctx.stroke(); }
    for (let i = 0; i < 28; i++) {
      const fx = rng.jr(14, s - 14), fy = rng.jr(14, s - 22), fr = rng.jr(8, 17);
      ctx.fillStyle = i % 2 === 0 ? fl1 : fl2;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * fr * 0.55, fy + Math.sin(a) * fr * 0.55, fr * 0.45, fr * 0.3, a, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe884'; ctx.beginPath(); ctx.arc(fx, fy, fr * 0.22, 0, TAU); ctx.fill();
    }
  }, 1, 1);
  preKimono('bh2_kimono_pink', '#ea5884', '#c23464', '#ffe0ee', '#ffe27a');
  preKimono('bh2_kimono_purple', '#724cb4', '#4a2e88', '#eed0ff', '#ffd872');
}

function getTeahouseTextures(THREE) {
  ensureSharedBathCanvases(THREE);
  if (_localTexCache) return _localTexCache;

  const purpleTapestry = paintedCanvasTex(THREE, 'bh_kimono_tapestry_v2', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#49307a');
    grd.addColorStop(0.55, '#6242a0');
    grd.addColorStop(1, '#3d266a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 100, ['#704eb0', '#4e3384', '#825ec4'], 3, 7, 0.25);

    ctx.fillStyle = 'rgba(248, 210, 108, 0.42)';
    for (const [cx, cy, rx, ry] of [[0.28, 0.22, 44, 12], [0.74, 0.38, 48, 13], [0.32, 0.72, 50, 14]]) {
      ctx.beginPath(); ctx.ellipse(s * cx, s * cy, rx, ry, 0, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 20; i++) {
      const fx = rng.jr(18, s - 18), fy = rng.jr(20, s - 24), fr = rng.jr(10, 18);
      ctx.fillStyle = i % 3 === 0 ? '#ffdc74' : (i % 3 === 1 ? '#f6beff' : '#ffedb4');
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * fr * 0.52, fy + Math.sin(a) * fr * 0.52, fr * 0.44, fr * 0.28, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fff5c8';
      ctx.beginPath(); ctx.arc(fx, fy, fr * 0.22, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#f4c85a';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, s - 12, s - 12);
  });

  const zabutonPurple = paintedCanvasTex(THREE, 'bh_zabuton_purple_v2', 128, (ctx, s, rng) => {
    ctx.fillStyle = '#6e3b80';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 65, ['#824a96', '#582e68', '#9156a6'], 2, 5, 0.28);
    ctx.strokeStyle = '#ecc05c';
    ctx.lineWidth = 3;
    ctx.strokeRect(7, 7, s - 14, s - 14);
    for (const [ox, oy, r] of [[0.5, 0.5, 17], [0.34, 0.38, 11], [0.66, 0.62, 11]]) {
      ctx.fillStyle = '#f6ce6c';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(s * ox + Math.cos(a) * r * 0.55, s * oy + Math.sin(a) * r * 0.55, r * 0.42, r * 0.26, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fff3c8';
      ctx.beginPath(); ctx.arc(s * ox, s * oy, r * 0.2, 0, TAU); ctx.fill();
    }
  });

  _localTexCache = { purpleTapestry, zabutonPurple };
  return _localTexCache;
}

export function buildKimonoTeahouse(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'kimono_teahouse', 4);
  const {
    root, roofG, add, addR, rbox, boxCol, wall,
    pushInst, jr, pick, M, tex,
  } = K;
  const LT = getTeahouseTextures(THREE);
  const bm = getBathMats(THREE, K);

  // Clean BoxGeometry helper for crisp Japanese joinery/slats/tatami (12 tris, zero NaN normals!)
  // + 2-seg RoundedBoxGeometry for plush cushions & draped silk kimono folds!
  const sbox = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const softBox = (w, h, d, r, mat) => rbox(w, h, d, r, mat, 2);

  // Crisp low-tri Kumiko Shoji window helper (identical look to addKumikoWindow at 1/18th the triangle cost!)
  function addCrispKumiko({ cx = 0, cy = 1.6, cz = 0, rotY = 0, w = 1.4, h = 1.3, cols = 4, rows = 4, parent = root }) {
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = rotY;
    parent.add(g);
    add(sbox(w - 0.06, h - 0.06, 0.036, bm.shojiGlow), 0, 0, 0, 0, 0, 0, g);
    for (const sx of [-1, 1]) add(sbox(0.075, h + 0.07, 0.10, bm.darkTimber), sx * (w * 0.5), 0, 0, 0, 0, 0, g);
    for (const sy of [-1, 1]) add(sbox(w + 0.13, 0.075, 0.11, bm.darkTimber), 0, sy * (h * 0.5), 0, 0, 0, 0, g);
    for (let c = 1; c < cols; c++) {
      add(sbox(0.026, h - 0.06, 0.068, bm.rafterWood), -w * 0.5 + (c / cols) * w, 0, 0, 0, 0, 0, g);
    }
    for (let r = 1; r < rows; r++) {
      add(sbox(w - 0.06, 0.026, 0.068, bm.rafterWood), 0, -h * 0.5 + (r / rows) * h, 0, 0, 0, 0, g);
    }
    return g;
  }

  // Core dimensions
  const FL = 0.36;           // Raised plinth / tatami floor elevation
  const H_SIDE = 3.28;       // Side & back wall height in K.root (strictly <= 3.3m!)
  const H_FRONT = 2.74;      // Front enclosed wall height in K.root under pent awning
  const TH = 0.20;           // Wall thickness
  const doorX = 0.75;        // Clear entrance step & doorway X

  // Consolidated zero-metalness materials (keeps merged draw calls <= 45!)
  const kimonoPinkMat = M(0xffffff, bm.BT.kimonoPink, { roughness: 0.76, metalness: 0, side: THREE.DoubleSide });
  const kimonoPurpleMat = M(0xffffff, bm.BT.kimonoPurple, { roughness: 0.76, metalness: 0, side: THREE.DoubleSide });
  const byobuMat = M(0xffffff, bm.BT.goldPineScreen, { roughness: 0.54, metalness: 0, emissive: 0x68460a, emissiveIntensity: 0.18 });
  const tapestryMat = M(0xffffff, LT.purpleTapestry, { roughness: 0.80, metalness: 0, side: THREE.DoubleSide });
  const zabutonPurpleMat = M(0xffffff, LT.zabutonPurple, { roughness: 0.84, metalness: 0 });
  const silkPinkMat = M(0xe66898, null, { roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const barkMat = M(0x5e412c, tex('bark', 1.2, 2.0), { roughness: 0.92, metalness: 0 });
  const lacquerDark = M(0x281816, null, { roughness: 0.46, metalness: 0 });
  const maskIvory = M(0xfdf3e4, null, { roughness: 0.48, metalness: 0 });
  const matchaGreen = M(0x78b854, null, { roughness: 0.65, metalness: 0 });
  const indigoTileMat = M(0xffffff, null, { roughness: 0.62, metalness: 0 });

  const leafGeo = new THREE.CircleGeometry(0.095, 6);
  leafGeo.scale(1, 1.38, 1);
  const hydFloretGeo = new THREE.IcosahedronGeometry(0.135, 0);
  const extraRockGeo = new THREE.DodecahedronGeometry(0.36, 1);

  // ==========================================================================
  // 1. MOSSY SHORELINE STONE FOUNDATION, STEPS & LUSH HYDRANGEAS
  // ==========================================================================
  buildMossyStonePlinth(THREE, K, {
    w: 9.0,
    d: 7.6,
    h: FL + 0.04,
    doorX,
    doorW: 2.1,
    steps: 4,
    hydrangeas: true,
    parent: root,
  });

  // Extra shoreline boulders & lush front-left purple hydrangea mound (matches ext_04!)
  for (const [rx, rz, sc] of [
    [-4.65, 3.95, 1.35], [-3.95, 4.35, 1.22], [-3.05, 4.42, 1.18],
    [-2.05, 4.38, 1.12], [-1.15, 4.32, 1.05], [2.45, 4.35, 1.15], [3.65, 4.25, 1.18],
  ]) {
    pushInst('plinth_rock', () => extraRockGeo, bm.stoneInst,
      rx, 0.18, rz, jr(0, 3), jr(0, 3), 0, sc, sc * 0.72, sc * 0.95,
      rx < 0 ? pick(STONE_BOULDER_PAL) : pick(MOSS_BOULDER_PAL), root);
  }
  for (let i = 0; i < 32; i++) {
    const a = jr(0, TAU), r = jr(0.08, 0.95);
    const hx = -3.95 + Math.cos(a) * r * 1.15;
    const hz = 3.88 + Math.sin(a) * r * 0.85;
    pushInst('hyd_leaf', () => leafGeo, bm.leafInst,
      hx, 0.26 + jr(0, 0.56), hz,
      jr(-0.7, 0.7), jr(0, TAU), jr(-0.5, 0.5), jr(1.15, 1.65), jr(1.15, 1.65), 1, pick(FOLIAGE_PAL), root);
  }
  for (let i = 0; i < 28; i++) {
    const a = jr(0, TAU), r = jr(0.05, 0.88);
    const hx = -3.92 + Math.cos(a) * r * 1.08;
    const hz = 3.90 + Math.sin(a) * r * 0.82;
    pushInst('hyd_floret', () => hydFloretGeo, bm.whiteInst,
      hx, 0.40 + jr(0, 0.58), hz,
      jr(0, 3), jr(0, 3), 0, jr(1.0, 1.42), jr(0.88, 1.22), jr(1.0, 1.42), pick(HYDRANGEA_PAL), root);
  }

  // ==========================================================================
  // 2. WOVEN TATAMI INTERIOR FLOOR & RAISED FRONT ENGAWA TIMBER DECK
  // ==========================================================================
  add(sbox(9.04, 0.14, 1.12, bm.cedar), 0, FL - 0.05, 3.42, 0, 0, 0, root);
  for (const px of [-4.22, -3.20, -2.20, -1.20, -0.42, 1.85, 3.05, 4.22]) {
    add(sbox(0.15, FL, 0.15, bm.darkTimber), px, FL * 0.5 - 0.02, 3.84, 0, 0, 0, root);
  }

  // Woven green Igusa Tatami mats across both rooms
  const tatamiY = FL + 0.015;
  for (let r = 0; r < 4; r++) {
    const mz = -2.62 + r * 1.54;
    for (let c = 0; c < 5; c++) {
      const mx = -3.40 + c * 1.70;
      if (Math.abs(mx - (-2.05)) < 0.55 && Math.abs(mz - (-0.22)) < 0.55) continue;
      add(sbox(1.66, 0.038, 1.50, bm.tatami), mx, tatamiY, mz, 0, (r + c) % 2 ? PI * 0.5 : 0, 0, root);
    }
  }
  add(sbox(3.75, 0.042, 0.98, bm.cedar), -2.38, tatamiY, 3.38, 0, 0, 0, root);
  for (let i = 0; i < 4; i++) {
    add(sbox(1.14, 0.042, 0.94, bm.tatami), -0.02 + i * 1.18, tatamiY, 3.36, 0, 0, 0, root);
  }
  add(sbox(9.06, 0.08, 0.14, bm.hinoki), 0, tatamiY - 0.01, 3.88, 0, 0, 0, root);

  // ==========================================================================
  // 3. HOLLOW WALLS, PARTITION DOORWAY, SHOJI WINDOWS & CLERESTORY FRIEZE
  // ==========================================================================
  wall(0, -3.55, PI, 8.90, H_SIDE, TH, [], bm.creamPlaster, bm.warmInnerWall, root, true);

  wall(-4.45, -0.30, -PI * 0.5, 6.50, H_SIDE, TH, [
    { u: 0.85, y0: FL + 0.50, w: 1.85, h: 1.60 },
  ], bm.creamPlaster, bm.warmInnerWall, root, true);
  addCrispKumiko({ cx: -4.35, cy: FL + 1.30, cz: 0.55, rotY: PI * 0.5, w: 1.88, h: 1.62, cols: 4, rows: 5, parent: root });

  wall(4.45, -0.30, PI * 0.5, 6.50, H_SIDE, TH, [
    { u: -1.45, y0: FL + 0.70, w: 1.35, h: 1.35 },
  ], bm.creamPlaster, bm.warmInnerWall, root, true);
  addCrispKumiko({ cx: 4.35, cy: FL + 1.38, cz: 1.15, rotY: PI * 0.5, w: 1.38, h: 1.38, cols: 3, rows: 4, parent: root });

  // Front wall (+Z): wide open entrance doorway at x = 0.75, Round Marumado Window at x = 2.48
  wall(0, 2.95, 0, 8.90, H_FRONT, TH, [
    { u: -3.45, y0: FL + 0.36, w: 1.28, h: 1.84 },
    { u: 0.75, w: 1.72, h: 2.38, door: true },
    { u: 2.48, y0: FL + 0.54, w: 1.48, h: 1.48, round: true },
  ], bm.cedar, bm.warmInnerWall, root, true);

  addCrispKumiko({ cx: -3.45, cy: FL + 1.28, cz: 2.86, rotY: 0, w: 1.32, h: 1.86, cols: 3, rows: 5, parent: root });
  addCrispKumiko({ cx: -1.96, cy: FL + 1.28, cz: 2.98, rotY: 0, w: 1.54, h: 1.80, cols: 4, rows: 5, parent: root });
  addMarumadoWindow(THREE, K, { cx: 2.48, cy: FL + 1.28, cz: 2.86, rotY: 0, radius: 0.78, parent: root });

  for (const [px, pz, ph] of [
    [-4.40, -3.50, H_SIDE], [4.40, -3.50, H_SIDE], [-4.40, 2.90, H_FRONT], [4.40, 2.90, H_FRONT],
    [-0.14, 2.90, H_FRONT], [1.64, 2.90, H_FRONT], [0.35, -3.42, H_SIDE], [0.35, 1.98, H_SIDE - 0.12],
  ]) {
    add(sbox(0.18, ph - 0.04, 0.18, bm.darkTimber), px, (ph - 0.04) * 0.5, pz, 0, 0, 0, root);
  }
  add(sbox(8.56, 0.62, 0.06, bm.cedar), 0, FL + 0.31, -3.33, 0, 0, 0, root);
  add(sbox(0.06, 0.62, 6.10, bm.cedar), -4.23, FL + 0.31, -0.30, 0, 0, 0, root);
  add(sbox(0.06, 0.62, 6.10, bm.cedar), 4.23, FL + 0.31, -0.30, 0, 0, 0, root);

  // Partition wall at x = 0.35 with open doorway centered at z = 0.2 (w = 1.6, h = 2.4, door: true)
  wall(0.44, -0.68, PI * 0.5, 5.36, H_SIDE - 0.10, 0.18, [
    { u: -0.88, w: 1.60, h: 2.40, door: true },
  ], bm.warmInnerWall, bm.warmInnerWall, root, true);
  for (const dz of [-0.60, 1.00]) {
    add(sbox(0.22, 2.46, 0.14, bm.darkTimber), 0.35, 1.23, dz, 0, 0, 0, root);
  }
  add(sbox(0.24, 0.14, 1.78, bm.darkTimber), 0.35, 2.44, 0.20, 0, 0, 0, root);
  addCrispKumiko({ cx: 0.35, cy: 2.82, cz: 0.20, rotY: PI * 0.5, w: 1.56, h: 0.60, cols: 5, rows: 2, parent: root });

  // Glowing Kumiko Clerestory Frieze Windows along Back & Left Walls (y = 2.86, < 3.3m!)
  for (const bx of [-3.10, -1.45, 0.15]) {
    addCrispKumiko({ cx: bx, cy: 2.86, cz: -3.32, rotY: 0, w: 1.48, h: 0.56, cols: 4, rows: 2, parent: root });
  }
  for (const lz of [-2.35, -0.85, 1.95]) {
    addCrispKumiko({ cx: -4.22, cy: 2.86, cz: lz, rotY: PI * 0.5, w: 1.32, h: 0.56, cols: 4, rows: 2, parent: root });
  }

  // Curved Timber Arch Braces along back frieze (with slight Z offset so Frenet normals never degenerate!)
  const addCurvedBrace = (x0, y0, z0, x1, y1, z1, xm, ym, zm, par = root) => {
    const crv = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(xm, ym, zm),
      new THREE.Vector3(x1, y1, z1),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(crv, 8, 0.07, 6, false), bm.rafterWood), 0, 0, 0, 0, 0, 0, par);
  };
  addCurvedBrace(-4.20, 2.30, -3.22, -2.05, 3.22, -3.22, -3.35, 3.00, -3.16, root);
  addCurvedBrace(0.30, 2.30, -3.22, -1.95, 3.22, -3.22, -0.75, 3.00, -3.16, root);
  addCurvedBrace(0.42, 2.30, -3.22, 2.35, 3.22, -3.22, 1.25, 3.00, -3.16, root);
  addCurvedBrace(4.20, 2.30, -3.22, 2.35, 3.22, -3.22, 3.45, 3.00, -3.16, root);

  for (const [lx, lz] of [[-4.02, -3.05], [4.02, -3.05]]) {
    add(sbox(0.28, 0.36, 0.28, bm.shojiGlow), lx, 2.68, lz, 0, 0, 0, root);
    add(sbox(0.34, 0.05, 0.34, bm.darkTimber), lx, 2.88, lz, 0, 0, 0, root);
    add(sbox(0.34, 0.05, 0.34, bm.darkTimber), lx, 2.48, lz, 0, 0, 0, root);
  }

  // ==========================================================================
  // 4. REUSABLE HERO SCULPTURE HELPERS: SILK KIMONOS & PAINTED MASKS
  // ==========================================================================
  function addSculptedKimono({
    x = 0, y = FL, z = 0, rotY = 0,
    mat = kimonoPinkMat, obiMat = bm.goldTrim,
    scale = 1.0, withRack = true, drawerBase = false,
    parent = root,
  }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    parent.add(g);

    const barY = drawerBase ? 2.02 : 1.78;
    const hemY = drawerBase ? 0.44 : 0.16;
    const robeH = barY - hemY - 0.08;
    const midY = hemY + robeH * 0.5;

    if (drawerBase) {
      add(sbox(1.36, 0.40, 0.44, bm.cedar), 0, 0.20, 0, 0, 0, 0, g);
      add(sbox(1.42, 0.05, 0.48, lacquerDark), 0, 0.41, 0, 0, 0, 0, g);
      for (const dx of [-0.42, 0, 0.42]) {
        add(sbox(0.38, 0.14, 0.03, bm.rafterWood), dx, 0.28, 0.22, 0, 0, 0, g);
        add(sbox(0.38, 0.14, 0.03, bm.rafterWood), dx, 0.12, 0.22, 0, 0, 0, g);
        add(sbox(0.08, 0.025, 0.03, bm.brassWarm), dx, 0.28, 0.24, 0, 0, 0, g);
        add(sbox(0.08, 0.025, 0.03, bm.brassWarm), dx, 0.12, 0.24, 0, 0, 0, g);
      }
    }

    if (withRack) {
      for (const sx of [-0.66, 0.66]) {
        add(sbox(0.065, barY + 0.06, 0.065, lacquerDark), sx, (barY + 0.06) * 0.5, 0, 0, 0, 0, g);
        if (!drawerBase) add(sbox(0.14, 0.06, 0.36, lacquerDark), sx, 0.03, 0, 0, 0, 0, g);
        add(sbox(0.08, 0.09, 0.08, bm.goldTrim), sx, barY + 0.08, 0, 0, 0, 0, g);
      }
      add(sbox(1.58, 0.06, 0.06, lacquerDark), 0, barY, 0, 0, 0, 0, g);
      for (const sx of [-0.81, 0.81]) {
        add(sbox(0.07, 0.07, 0.07, bm.goldTrim), sx, barY, 0, 0, 0, 0, g);
      }
    }

    // Draped silk kimono body + okumi overlap + flared lower skirt
    add(softBox(0.56, robeH, 0.13, 0.035, mat), 0, midY, 0.02, 0, 0, 0, g);
    add(softBox(0.62, robeH * 0.42, 0.14, 0.035, mat), 0, hemY + robeH * 0.21, 0.025, 0.03, 0, 0, g);
    add(sbox(0.24, robeH * 0.88, 0.04, mat), 0.06, midY - 0.03, 0.09, 0, 0.06, 0.03, g);

    // Layered white & vermilion juban V-collar
    for (const sx of [-1, 1]) {
      add(sbox(0.065, 0.34, 0.05, maskIvory), sx * 0.08, barY - 0.18, 0.085, 0, 0, sx * 0.36, g);
      add(sbox(0.05, 0.32, 0.05, bm.vermilion), sx * 0.105, barY - 0.19, 0.092, 0, 0, sx * 0.36, g);
    }

    // Wide sculpted Furisode hanging T-sleeves
    const slvW = 0.38, slvH = 0.78;
    for (const sx of [-1, 1]) {
      add(softBox(slvW, 0.24, 0.12, 0.03, mat), sx * 0.44, barY - 0.13, 0.02, 0, 0, -sx * 0.04, g);
      add(softBox(slvW * 0.92, slvH, 0.10, 0.035, mat), sx * 0.46, barY - 0.10 - slvH * 0.5, 0.025, 0.02, sx * 0.06, -sx * 0.05, g);
    }

    // Golden brocade Obi sash + vermilion cord + jewel clasp
    const obiY = midY + robeH * 0.10;
    add(softBox(0.60, 0.24, 0.165, 0.025, obiMat), 0, obiY, 0.025, 0, 0, 0, g);
    add(sbox(0.615, 0.038, 0.175, bm.vermilion), 0, obiY, 0.028, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), bm.goldTrim), 0, obiY, 0.12, 0, 0, 0, g);

    return g;
  }

  function addSculptedMask(x, y, z, rotY, rotX, kind = 'kitsune_white', scale = 1.0, parent = root) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(rotX, rotY, 0);
    g.scale.setScalar(scale);
    parent.add(g);

    if (kind === 'okame') {
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), maskIvory);
      face.scale.set(0.92, 1.08, 0.48);
      add(face, 0, 0, 0, 0, 0, 0, g);
      for (const sx of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), silkPinkMat);
        cheek.scale.set(1.0, 0.85, 0.45);
        add(cheek, sx * 0.085, -0.04, 0.065, 0, 0, 0, g);
        add(sbox(0.068, 0.018, 0.02, lacquerDark), sx * 0.072, 0.03, 0.092, 0, 0, -sx * 0.18, g);
        add(sbox(0.038, 0.026, 0.02, lacquerDark), sx * 0.048, 0.12, 0.085, 0, 0, 0, g);
      }
      add(sbox(0.055, 0.026, 0.025, bm.vermilion), 0, -0.10, 0.092, 0, 0, 0, g);
      return g;
    }

    const baseMat = kind === 'kitsune_gold' ? bm.goldTrim : maskIvory;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), baseMat);
    head.scale.set(0.88, 1.12, 0.52);
    add(head, 0, 0.02, 0, 0, 0, 0, g);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 8), baseMat);
    add(snout, 0, -0.07, 0.11, PI * 0.42, 0, 0, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), lacquerDark), 0, -0.10, 0.21, 0, 0, 0, g);

    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.ConeGeometry(0.078, 0.24, 6), baseMat),
        sx * 0.125, 0.25, 0.01, 0.08, 0, -sx * 0.18, g);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 5), bm.vermilion),
        sx * 0.125, 0.24, 0.035, 0.08, 0, -sx * 0.18, g);
      add(sbox(0.088, 0.022, 0.025, lacquerDark), sx * 0.085, 0.04, 0.098, 0, sx * 0.15, sx * 0.34, g);
      add(sbox(0.095, 0.018, 0.022, bm.vermilion), sx * 0.088, 0.082, 0.094, 0, sx * 0.15, sx * 0.38, g);
      add(sbox(0.075, 0.016, 0.022, bm.vermilion), sx * 0.095, -0.035, 0.088, 0, sx * 0.2, -sx * 0.25, g);
    }
    return g;
  }

  // ==========================================================================
  // 5. OPEN-FRONT RAILED TIMBER ENGAWA SHOWCASE (ext_04_kimono_teahouse.png)
  // ==========================================================================
  for (const px of [-4.22, -2.72, -0.42, 1.72, 4.22]) {
    add(sbox(0.16, 2.46, 0.16, bm.darkTimber), px, FL + 1.23, 3.82, 0, 0, 0, root);
  }
  add(sbox(8.76, 0.15, 0.16, bm.darkTimber), 0, 2.78, 3.82, 0, 0, 0, root);
  for (const px of [-4.22, -2.72, 1.72, 4.22]) {
    add(sbox(0.12, 0.12, 0.96, bm.rafterWood), px, 2.74, 3.36, 0, 0, 0, root);
  }

  // Vermilion-cedar Balustrade Railings (kōran) with Golden Giboshi Finials
  const addVerandaRailing = (x0, x1, zPos) => {
    const len = x1 - x0, cx = (x0 + x1) * 0.5;
    add(sbox(len, 0.075, 0.09, bm.vermilion), cx, FL + 0.66, zPos, 0, 0, 0, root);
    add(sbox(len, 0.058, 0.075, bm.vermilion), cx, FL + 0.37, zPos, 0, 0, 0, root);
    add(sbox(len, 0.05, 0.07, bm.vermilion), cx, FL + 0.14, zPos, 0, 0, 0, root);
    const nPosts = Math.max(2, Math.round(len / 0.85));
    for (let i = 0; i <= nPosts; i++) {
      const px = x0 + (i / nPosts) * len;
      add(sbox(0.11, 0.72, 0.11, bm.vermilion), px, FL + 0.36, zPos, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bm.goldTrim), px, FL + 0.77, zPos, 0, 0, 0, root);
    }
    boxCol(cx, zPos, len, 0.18);
  };
  addVerandaRailing(-4.22, -0.42, 3.82);
  addVerandaRailing(3.08, 4.22, 3.82);
  for (const sx of [-1, 1]) {
    add(sbox(0.09, 0.075, 0.92, bm.vermilion), sx * 4.22, FL + 0.66, 3.36, 0, 0, 0, root);
    add(sbox(0.075, 0.058, 0.92, bm.vermilion), sx * 4.22, FL + 0.37, 3.36, 0, 0, 0, root);
  }

  // Left Veranda Showcase (x ≈ -2.0, z ≈ 3.34): 2 Rich Floral Silk Kimonos on Lacquered T-Stands
  add(sbox(2.15, 0.055, 0.055, lacquerDark), -1.94, FL + 1.90, 3.34, 0, 0, 0, root);
  addSculptedKimono({
    x: -1.98, y: FL, z: 3.36, rotY: 0.05,
    mat: kimonoPinkMat, obiMat: bm.goldTrim, scale: 1.02, withRack: true, parent: root,
  });
  addSculptedKimono({
    x: -1.14, y: FL + 0.10, z: 3.28, rotY: -0.08,
    mat: kimonoPurpleMat, obiMat: bm.brassWarm, scale: 0.92, withRack: true, parent: root,
  });
  add(softBox(0.46, 1.24, 0.09, 0.03, kimonoPurpleMat), -2.74, FL + 1.22, 3.32, 0.02, 0.08, 0.03, root);
  add(softBox(0.32, 0.72, 0.09, 0.03, kimonoPinkMat), -2.94, FL + 1.44, 3.34, 0, 0.08, 0.06, root);
  boxCol(-1.96, 3.34, 1.95, 0.42);

  // Center-Right Open Tatami Engawa Showcase:
  // 1) Festive draped pink-magenta silk valance (maku) with gold cord & tassels
  add(sbox(3.10, 0.048, 0.048, bm.goldTrim), 1.48, 2.64, 3.68, 0, 0, 0, root);
  for (let sw = 0; sw < 3; sw++) {
    const sx = 0.46 + sw * 1.02;
    const swag = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.98, 10, 1, false, 0, PI), silkPinkMat);
    swag.scale.set(0.35, 1.0, 1.0);
    add(swag, sx, 2.60, 3.66, 0, 0, PI * 0.5, root);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), bm.goldTrim), sx + 0.48, 2.45, 3.70, 0, 0, 0, root);
  }

  // 2) 2 Sculpted Kitsune Fox Masks hanging unobstructed under the front eaves beam!
  addSculptedMask(2.18, 2.38, 3.86, -0.08, 0.08, 'kitsune_white', 1.08, root);
  addSculptedMask(2.90, 2.38, 3.86, -0.12, 0.08, 'kitsune_gold', 1.08, root);

  // 3) Purple & Gold Floral Silk Tapestry / Split Noren on the right veranda wall (cx = 3.68)
  add(sbox(1.04, 0.06, 0.06, bm.darkTimber), 3.68, FL + 1.96, 2.98, 0, 0, 0, root);
  for (let p = 0; p < 2; p++) {
    const geo = new THREE.BoxGeometry(0.43, 1.32, 0.028);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (p + uv.getX(k)) * 0.5);
    add(new THREE.Mesh(geo, tapestryMat), 3.44 + p * 0.48, FL + 1.26, 2.98, 0.03 * (p ? 1 : -1), 0, 0, root);
  }

  // 4) Low Wooden Engawa Tea Table + White Porcelain Teapot + 4 Pink Zabuton Cushions
  {
    const tx = 2.32, tz = 3.34;
    add(sbox(0.72, 0.055, 0.48, bm.cedar), tx, FL + 0.27, tz, 0, 0, 0, root);
    for (const [lx, lz] of [[-0.30, -0.18], [0.30, -0.18], [-0.30, 0.18], [0.30, 0.18]]) {
      add(sbox(0.055, 0.25, 0.055, bm.darkTimber), tx + lx, FL + 0.13, tz + lz, 0, 0, 0, root);
    }
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.098, 10, 8), maskIvory);
    pot.scale.set(1, 0.86, 1);
    add(pot, tx - 0.03, FL + 0.37, tz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), bm.goldTrim), tx - 0.03, FL + 0.46, tz, 0, 0, 0, root);
    for (const [cx, cz] of [[0.15, 0.05], [-0.19, 0.07]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.068, 8), maskIvory), tx + cx, FL + 0.33, tz + cz, 0, 0, 0, root);
    }
    for (const [zx, zz, zr] of [
      [-0.22, 3.38, 0.08], [1.66, 3.48, 0.10], [2.32, 3.72, -0.04], [2.96, 3.48, -0.12],
    ]) {
      add(softBox(0.48, 0.075, 0.48, 0.03, silkPinkMat), zx, FL + 0.055, zz, 0, zr, 0, root);
    }
  }

  // 5) Warm Glowing Yellow Chochin Lantern framed prominently on the right corner post!
  add(sbox(0.34, 0.06, 0.34, bm.darkTimber), 4.10, 2.58, 3.94, 0, 0, 0, root);
  addChochinLantern(THREE, K, { x: 4.00, y: 2.12, z: 4.04, radius: 0.25, height: 0.52, red: false, tassel: true, parent: root });

  // ==========================================================================
  // 6. SIGNATURE CASCADING PURPLE WISTERIA PERGOLA & ROOF DRAPE (88 Racemes, 260 Leaves!)
  // ==========================================================================
  for (let i = 0; i < 6; i++) {
    const jx = -4.45 + i * 0.78;
    add(sbox(0.085, 0.10, 1.50, bm.rafterWood), jx, 2.86, 3.44, 0, 0, 0, root);
  }
  for (let s = 0; s < 4; s++) {
    add(sbox(4.25, 0.05, 0.06, bm.cedar), -2.45, 2.94, 2.92 + s * 0.36, 0, 0, 0, root);
  }

  const addVineTube = (pts, rad, parent) => {
    const crv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    add(new THREE.Mesh(new THREE.TubeGeometry(crv, 16, rad, 6, false), barkMat), 0, 0, 0, 0, 0, 0, parent);
    return crv;
  };

  const trunk1 = addVineTube([
    [-4.34, 0.32, 3.92], [-4.10, 0.95, 3.96], [-4.32, 1.62, 3.74],
    [-4.12, 2.30, 3.94], [-4.24, 2.90, 3.84], [-3.25, 2.98, 3.94],
    [-1.85, 2.95, 3.98], [-0.25, 2.90, 3.94],
  ], 0.072, root);

  const trunk2 = addVineTube([
    [-4.46, 0.35, 3.68], [-4.52, 1.18, 3.15], [-4.44, 2.10, 2.65],
    [-4.48, 2.88, 2.35], [-4.38, 2.95, 3.55], [-2.68, 2.96, 3.78],
  ], 0.055, root);

  const trunk3 = addVineTube([
    [-2.78, 0.40, 3.90], [-2.62, 1.28, 3.94], [-2.80, 2.15, 3.76],
    [-2.68, 2.88, 3.88], [-1.25, 2.94, 3.92], [0.28, 2.88, 3.88],
  ], 0.050, root);

  const roofVine1 = addVineTube([
    [-4.25, 3.45, 3.65], [-3.65, 4.08, 2.45], [-2.85, 4.72, 1.15],
    [-1.95, 5.25, 0.15], [-1.05, 4.75, 1.35], [-0.25, 4.05, 2.65],
  ], 0.062, roofG);

  const roofVine2 = addVineTube([
    [-4.45, 3.48, 2.25], [-3.85, 4.25, 1.05], [-2.95, 4.92, -0.15],
    [-1.95, 4.42, 1.85], [-0.95, 3.72, 3.45], [0.35, 3.45, 4.02],
  ], 0.052, roofG);

  // 40 Eaves-hanging 3D Wisteria Racemes in K.root (yTop in [2.70, 2.98], lengths 0.68m–1.35m)
  for (let i = 0; i < 16; i++) {
    const wx = -4.45 + (i % 4) * 0.42 + jr(-0.08, 0.08);
    const wy = 2.78 + jr(-0.06, 0.18);
    const wz = 2.35 + Math.floor(i / 4) * 0.52 + jr(-0.10, 0.10);
    addWisteriaRaceme(THREE, K, wx, wy, wz, jr(0.82, 1.32), root, 'wisteria');
  }
  for (let i = 0; i < 24; i++) {
    const f = i / 23;
    const wx = -3.45 + f * 3.80 + jr(-0.06, 0.06);
    const wy = 2.82 + jr(-0.05, 0.16);
    const wz = 3.92 + jr(-0.08, 0.32);
    const wlen = f > 0.82 ? jr(0.65, 0.85) : jr(0.75, 1.28);
    addWisteriaRaceme(THREE, K, wx, wy, wz, wlen, root, 'wisteria');
  }

  // 38 Roof-draped 3D Wisteria Racemes in K.roofG (yTop > 3.38m, lengths 0.65m–1.18m; 78 racemes total!)
  for (let i = 0; i < 20; i++) {
    const f = i / 19;
    const rx = -4.35 + jr(0, 3.65);
    const rz = 0.25 + f * 2.95 + jr(-0.15, 0.15);
    const slopeFrac = Math.min(1, Math.max(0, (rz + 0.50) / 3.45));
    const ry = 5.65 - slopeFrac * 1.85 + jr(0.06, 0.22);
    addWisteriaRaceme(THREE, K, rx, Math.max(3.48, ry), rz, jr(0.68, 1.15), roofG, 'wisteria');
  }
  for (let i = 0; i < 18; i++) {
    const rx = -4.35 + (i / 17) * 4.75 + jr(-0.08, 0.08);
    const rz = 3.18 + jr(0, 1.08);
    const ry = 3.44 + jr(0, 0.36);
    addWisteriaRaceme(THREE, K, rx, ry, rz, jr(0.65, 1.08), roofG, 'wisteria');
  }

  // 260 Dainty Emerald Compound Leaf Clusters
  for (let i = 0; i < 115; i++) {
    const crv = i % 3 === 0 ? trunk1 : (i % 3 === 1 ? trunk2 : trunk3);
    const p = crv.getPoint(jr(0.14, 1.0));
    pushInst('hyd_leaf', () => leafGeo, bm.leafInst,
      p.x + jr(-0.26, 0.26), Math.min(3.12, p.y + jr(-0.10, 0.18)), p.z + jr(-0.24, 0.24),
      jr(-0.8, 0.8), jr(0, TAU), jr(-0.6, 0.6), jr(0.75, 1.15), jr(0.75, 1.15), 1, pick(FOLIAGE_PAL), root);
  }
  for (let i = 0; i < 155; i++) {
    const crv = i % 2 === 0 ? roofVine1 : roofVine2;
    const p = crv.getPoint(jr(0, 1.0));
    pushInst('wist_leaf_roof', () => leafGeo, bm.leafInst,
      p.x + jr(-0.52, 0.52), Math.max(3.40, p.y + jr(-0.10, 0.24)), p.z + jr(-0.46, 0.46),
      jr(-0.8, 0.8), jr(0, TAU), jr(-0.6, 0.6), jr(0.80, 1.22), jr(0.80, 1.22), 1, pick(FOLIAGE_PAL), roofG);
  }

  // ==========================================================================
  // 7. 2-TIER INDIGO-SLATE 3D KAWARA ROOF + FRONT DORMER GABLE (in K.roofG!)
  // ==========================================================================
  addR(sbox(8.92, 0.72, 6.20, bm.darkTimber), 0, 3.56, -0.45);
  addR(sbox(8.92, 0.72, 0.22, bm.darkTimber), 0, 3.12, 2.86);

  for (const sx of [-1, 1]) {
    const gs = new THREE.Shape();
    gs.moveTo(-3.15, 0);
    gs.lineTo(3.15, 0);
    gs.lineTo(0, 2.12);
    gs.closePath();
    const gGeo = new THREE.ExtrudeGeometry(gs, { depth: 0.14, bevelEnabled: false });
    addR(new THREE.Mesh(gGeo, bm.creamPlaster), sx * 4.38 - 0.07, 3.88, -0.42, 0, PI * 0.5, 0);
  }

  // Main Upper Indigo-Slate 3D Kawara Gable Roof (ridgeAlongX: true, ridgeY = 6.04)
  buildKawaraGableRoof(THREE, K, {
    cx: 0,
    cz: -0.42,
    yBase: 3.90,
    spanX: 8.85,
    spanZ: 5.30,
    rise: 2.14,
    overhangX: 0.80,
    overhangZ: 0.58,
    ridgeAlongX: true,
    palette: TEAHOUSE_INDIGO_PAL,
    tileMat: indigoTileMat,
    finial: 'onigawara',
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // Prominent Front-Facing Triangular Dormer Gable (rear ridge tucks cleanly inside main roof!)
  const dormX = 0.42;
  {
    const ds = new THREE.Shape();
    ds.moveTo(-1.92, 0);
    ds.lineTo(1.92, 0);
    ds.lineTo(0, 1.48);
    ds.closePath();
    const dGeo = new THREE.ExtrudeGeometry(ds, { depth: 0.38, bevelEnabled: false });
    addR(new THREE.Mesh(dGeo, bm.creamPlaster), dormX, 3.60, 2.72);
    addR(sbox(3.50, 0.10, 0.16, bm.darkTimber), dormX, 3.64, 3.10);
    addR(sbox(2.30, 0.09, 0.16, bm.darkTimber), dormX, 4.36, 3.10);
    addR(sbox(0.11, 0.72, 0.16, bm.darkTimber), dormX, 4.70, 3.10);
      // Twin glowing golden Kumiko Clerestory Windows (matches ext_04!)
    addCrispKumiko({ cx: dormX - 0.54, cy: 4.00, cz: 3.12, rotY: 0, w: 0.96, h: 0.60, cols: 3, rows: 2, parent: roofG });
    addCrispKumiko({ cx: dormX + 0.54, cy: 4.00, cz: 3.12, rotY: 0, w: 0.96, h: 0.60, cols: 3, rows: 2, parent: roofG });
  }
  buildKawaraGableRoof(THREE, K, {
    cx: dormX,
    cz: 1.62,
    yBase: 3.74,
    spanX: 3.45,
    spanZ: 2.52,
    rise: 1.40,
    overhangX: 0.46,
    overhangZ: 0.44,
    ridgeAlongX: false,
    palette: TEAHOUSE_INDIGO_PAL,
    tileMat: indigoTileMat,
    finial: 'onigawara',
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // Lower Sweeping Indigo-Slate 3D Kawara Front Pent Awning
  buildKawaraPentAwning(THREE, K, {
    cx: 0,
    zWall: 2.82,
    yWall: 3.52,
    width: 9.52,
    depth: 1.48,
    drop: 0.52,
    palette: TEAHOUSE_INDIGO_PAL,
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // ==========================================================================
  // 8. DOLLHOUSE INTERIOR ROOM 1: IRORI SALON (x in [-4.2, 0.2], z in [-3.4, 3.1])
  // ==========================================================================
  add(sbox(3.45, 0.22, 1.08, bm.cedar), -2.42, FL + 0.11, -2.76, 0, 0, 0, root);
  add(sbox(3.50, 0.045, 1.12, bm.hinoki), -2.42, FL + 0.23, -2.76, 0, 0, 0, root);
  add(sbox(0.86, 0.22, 1.95, bm.cedar), -3.76, FL + 0.11, -1.32, 0, 0, 0, root);
  add(sbox(0.90, 0.045, 2.00, bm.hinoki), -3.76, FL + 0.23, -1.32, 0, 0, 0, root);

  // 4-Panel Gold-Leaf Pine Tree Folding Byobu Screen (zig-zag hinged panels + gold corner hardware!)
  {
    const baseY = FL + 0.25;
    const panW = 0.68, panH = 1.84;
    const centers = [
      [-3.38, -2.56, 0.28],
      [-2.74, -2.68, -0.22],
      [-2.08, -2.68, 0.22],
      [-1.44, -2.56, -0.26],
    ];
    centers.forEach(([bx, bz, ry], idx) => {
      const pg = new THREE.Group();
      pg.position.set(bx, baseY + panH * 0.5, bz);
      pg.rotation.y = ry;
      root.add(pg);

      const canvasGeo = new THREE.BoxGeometry(panW - 0.06, panH - 0.08, 0.032);
      const uv = canvasGeo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, (idx + uv.getX(k)) * 0.25);
      add(new THREE.Mesh(canvasGeo, byobuMat), 0, 0, 0, 0, 0, 0, pg);
      for (const sx of [-1, 1]) add(sbox(0.045, panH, 0.05, lacquerDark), sx * (panW * 0.5 - 0.015), 0, 0, 0, 0, 0, pg);
      for (const sy of [-1, 1]) add(sbox(panW, 0.045, 0.05, lacquerDark), 0, sy * (panH * 0.5 - 0.015), 0, 0, 0, 0, pg);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        add(sbox(0.085, 0.085, 0.058, bm.goldTrim), sx * (panW * 0.5 - 0.03), sy * (panH * 0.5 - 0.03), 0, 0, 0, 0, pg);
      }
    });
    boxCol(-2.40, -2.72, 2.75, 0.88);
  }

  // Porcelain Vase with Lush Blooming Pink Sakura Branch (x = -3.68, z = -1.52)
  {
    const vx = -3.68, vz = -1.52, vy = FL + 0.25;
    add(sbox(0.46, 0.14, 0.38, zabutonPurpleMat), vx, vy + 0.07, vz, 0, 0.12, 0, root);
    const vasePts = [
      [0, 0], [0.13, 0], [0.22, 0.16], [0.24, 0.34], [0.15, 0.48], [0.10, 0.56], [0.14, 0.62], [0.11, 0.62],
    ].map(([a, b]) => new THREE.Vector2(a, b));
    add(new THREE.Mesh(new THREE.LatheGeometry(vasePts, 14), tapestryMat), vx, vy + 0.14, vz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 6, 14), bm.goldTrim), vx, vy + 0.75, vz, PI * 0.5, 0, 0, root);

    const sakuraBranches = [
      [[vx, vy + 0.70, vz], [vx + 0.18, vy + 1.16, vz + 0.10], [vx + 0.52, vy + 1.60, vz + 0.22], [vx + 0.76, vy + 1.88, vz + 0.18]],
      [[vx, vy + 0.72, vz], [vx - 0.12, vy + 1.18, vz + 0.20], [vx - 0.22, vy + 1.64, vz + 0.46]],
      [[vx + 0.10, vy + 1.05, vz + 0.08], [vx + 0.36, vy + 1.28, vz - 0.18], [vx + 0.64, vy + 1.50, vz - 0.28]],
    ];
    for (const bPts of sakuraBranches) {
      const crv = addVineTube(bPts, 0.024, root);
      // Shares 'hyd_floret' instanced batch at half scale for zero extra draw call!
      for (let s = 0; s < 18; s++) {
        const p = crv.getPoint(jr(0.15, 1.0));
        const sc = jr(0.46, 0.72);
        pushInst('hyd_floret', () => hydFloretGeo, bm.whiteInst,
          p.x + jr(-0.14, 0.14), p.y + jr(-0.10, 0.14), p.z + jr(-0.14, 0.14),
          jr(0, 3), jr(0, 3), 0, sc, sc * 0.85, sc, pick(SAKURA_PAL), root);
      }
    }
    const jarPts = [[0, 0], [0.12, 0], [0.19, 0.18], [0.18, 0.34], [0.10, 0.42], [0, 0.42]].map(([a, b]) => new THREE.Vector2(a, b));
    add(new THREE.Mesh(new THREE.LatheGeometry(jarPts, 12), zabutonPurpleMat), -3.78, FL + 0.25, -0.52, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.05, 10), maskIvory), -3.78, FL + 0.68, -0.52, 0, 0, 0, root);
    boxCol(-3.76, -1.25, 0.82, 1.85);
  }

  // Sunken Square Wooden Irori Charcoal Hearth (compact 1.25m x 1.25m collider!)
  {
    const ix = -2.05, iz = -0.22;
    for (const sz of [-0.54, 0.54]) add(sbox(1.28, 0.16, 0.20, bm.rafterWood), ix, FL + 0.08, iz + sz, 0, 0, 0, root);
    for (const sx of [-0.54, 0.54]) add(sbox(0.20, 0.16, 0.88, bm.rafterWood), ix + sx, FL + 0.08, iz, 0, 0, 0, root);
    add(sbox(0.88, 0.05, 0.88, bm.ironWarm), ix, FL + 0.03, iz, 0, 0, 0, root);
    for (const [lx, lz, lr] of [[-0.08, 0.04, 0.4], [0.09, -0.04, -0.5], [0, 0.02, 1.3]]) {
      add(sbox(0.44, 0.08, 0.09, lacquerDark), ix + lx, FL + 0.09, iz + lz, 0.12, lr, 0, root);
    }
    const emberMound = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), bm.fireGlow);
    emberMound.scale.set(1.25, 0.48, 1.25);
    add(emberMound, ix, FL + 0.10, iz, 0, 0.4, 0, root);
    for (const [fx, fz, fh] of [[0, 0, 0.26], [-0.09, 0.06, 0.19], [0.08, -0.05, 0.20], [0.03, 0.08, 0.16]]) {
      add(new THREE.Mesh(new THREE.ConeGeometry(0.068, fh, 6), bm.fireGlow), ix + fx, FL + 0.16 + fh * 0.4, iz + fz, jr(-0.1, 0.1), 0, jr(-0.1, 0.1), root);
    }
    boxCol(ix, iz, 1.25, 1.25);

    // Overhead Honey-Gold Glowing Kumiko Box-Lantern (y = 2.50..3.12 in K.root, < 3.3m!)
    add(sbox(0.60, 0.54, 0.60, bm.shojiGlow), ix, 2.80, iz, 0, 0, 0, root);
    add(sbox(0.72, 0.07, 0.72, bm.darkTimber), ix, 3.10, iz, 0, 0, 0, root);
    add(sbox(0.68, 0.06, 0.68, bm.darkTimber), ix, 2.50, iz, 0, 0, 0, root);
    for (const sx of [-0.30, 0.30]) for (const sz of [-0.30, 0.30]) {
      add(sbox(0.042, 0.58, 0.042, bm.darkTimber), ix + sx, 2.80, iz + sz, 0, 0, 0, root);
    }
    for (const ry of [2.68, 2.92]) {
      add(sbox(0.63, 0.026, 0.63, bm.rafterWood), ix, ry, iz, 0, 0, 0, root);
    }

    // Iron & Bamboo Jizaikagi Pothook + Cast-Iron Tetsubin Kettle + Single Sculpted Steam Plume
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.16, 8), bm.rafterWood), ix, 1.90, iz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), bm.ironWarm), ix, 1.28, iz, 0, 0, 0, root);
    add(sbox(0.24, 0.075, 0.05, bm.cedar), ix + 0.05, 1.56, iz, 0, 0, -0.22, root);
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), bm.ironWarm);
    kettle.scale.set(1.14, 0.82, 1.14);
    add(kettle, ix, FL + 0.62, iz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.04, 10), bm.brassWarm), ix, FL + 0.78, iz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), bm.goldTrim), ix, FL + 0.82, iz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.042, 0.16, 8), bm.ironWarm), ix - 0.22, FL + 0.67, iz, 0, 0, 0.78, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 14, PI), bm.ironWarm), ix, FL + 0.76, iz, 0, 0, 0, root);
    // Single sculpted rising steam wisp tube (1 draw call instead of 3!)
    const steamCrv = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ix - 0.18, FL + 0.82, iz + 0.02),
      new THREE.Vector3(ix - 0.08, FL + 1.06, iz + 0.06),
      new THREE.Vector3(ix - 0.14, FL + 1.32, iz - 0.02),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(steamCrv, 10, 0.065, 6, false), bm.steamWisps), 0, 0, 0, 0, 0, 0, root);

    // 4 Purple Floral Zabuton Cushions around the Irori Hearth
    for (const [zx, zz, zr] of [
      [ix - 0.96, iz - 0.22, 0.08],
      [ix - 0.92, iz + 0.78, 0.18],
      [ix + 0.96, iz - 0.24, -0.10],
      [ix + 0.92, iz + 0.78, -0.16],
    ]) {
      add(softBox(0.56, 0.085, 0.56, 0.035, zabutonPurpleMat), zx, FL + 0.06, zz, 0, zr, 0, root);
    }

    // Lacquered Tea Tray with Matcha Chawan, Golden Bamboo Whisk & Tri-Color Hanami Dango Skewers!
    const trayX = ix, trayZ = iz + 0.84;
    add(sbox(0.68, 0.045, 0.44, lacquerDark), trayX, FL + 0.045, trayZ, 0, 0.04, 0, root);
    add(sbox(0.70, 0.075, 0.03, lacquerDark), trayX, FL + 0.06, trayZ + 0.21, 0, 0.04, 0, root);
    add(sbox(0.70, 0.075, 0.03, lacquerDark), trayX, FL + 0.06, trayZ - 0.21, 0, 0.04, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.058, 0.088, 10), matchaGreen), trayX + 0.08, FL + 0.11, trayZ + 0.04, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.035, 0.135, 10), bm.goldTrim), trayX + 0.21, FL + 0.13, trayZ - 0.04, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.098, 10), bm.vermilion), trayX - 0.19, FL + 0.11, trayZ - 0.05, 0, 0, 0, root);
    const dangoCols = [silkPinkMat, maskIvory, matchaGreen];
    for (let sk = 0; sk < 2; sk++) {
      const szOff = trayZ + 0.08 + sk * 0.075;
      for (let d = 0; d < 3; d++) {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), dangoCols[d]),
          trayX - 0.16 + d * 0.068, FL + 0.098, szOff, 0, 0, 0, root);
      }
    }
  }

  // ==========================================================================
  // 9. DOLLHOUSE INTERIOR ROOM 2: KIMONO GALLERY (x in [0.5, 4.2], z in [-3.4, 3.1])
  // ==========================================================================
  addSculptedKimono({
    x: 2.08, y: FL, z: -2.86, rotY: 0.05,
    mat: kimonoPinkMat, obiMat: bm.goldTrim, scale: 1.0, withRack: true, drawerBase: true, parent: root,
  });
  boxCol(2.08, -2.86, 1.50, 0.62);

  addSculptedKimono({
    x: 3.58, y: FL, z: -1.35, rotY: -PI * 0.36,
    mat: kimonoPurpleMat, obiMat: bm.goldTrim, scale: 1.0, withRack: true, drawerBase: true, parent: root,
  });

  // Stepped Wooden Kaidan-Dansu / Tansu Chests with Warm Brass Fittings along Right Wall
  {
    const tx = 3.76, tz = 0.25;
    add(sbox(0.68, 0.42, 1.32, bm.cedar), tx, FL + 0.21, tz, 0, 0, 0, root);
    add(sbox(0.64, 0.38, 0.88, bm.cedar), tx + 0.02, FL + 0.61, tz - 0.22, 0, 0, 0, root);
    add(sbox(0.60, 0.34, 0.46, bm.cedar), tx + 0.04, FL + 0.97, tz - 0.43, 0, 0, 0, root);
    add(sbox(0.72, 0.04, 1.36, bm.rafterWood), tx, FL + 0.43, tz, 0, 0, 0, root);
    add(sbox(0.68, 0.04, 0.92, bm.rafterWood), tx + 0.02, FL + 0.81, tz - 0.22, 0, 0, 0, root);
    for (const [dy, dz] of [[0.22, -0.35], [0.22, 0.10], [0.22, 0.48], [0.60, -0.42], [0.60, -0.02], [0.96, -0.43]]) {
      add(sbox(0.03, 0.14, 0.34, bm.rafterWood), tx - 0.34, FL + dy, tz + dz, 0, 0, 0, root);
      add(sbox(0.04, 0.035, 0.09, bm.brassWarm), tx - 0.36, FL + dy, tz + dz, 0, 0, 0, root);
    }
    add(sbox(0.32, 0.16, 0.26, bm.hinoki), tx - 0.04, FL + 0.52, tz + 0.36, 0, 0.15, 0, root);
    add(sbox(0.26, 0.12, 0.22, bm.vermilion), tx - 0.04, FL + 0.66, tz + 0.36, 0, -0.1, 0, root);
    boxCol(3.68, -0.50, 0.84, 2.95);
  }

  // 3 Sculpted Painted Fox & Okame Masks Mounted on Upper Timber Frieze (y = 2.58m!)
  add(sbox(2.15, 0.08, 0.08, bm.darkTimber), 2.38, 2.58, -3.24, 0, 0, 0, root);
  addSculptedMask(1.68, 2.58, -3.16, 0.08, 0.08, 'kitsune_white', 1.0, root);
  addSculptedMask(2.38, 2.58, -3.16, 0.0, 0.06, 'okame', 1.0, root);
  addSculptedMask(3.08, 2.58, -3.16, -0.12, 0.08, 'kitsune_white', 1.0, root);

  // 2 Tall Glowing Wooden Floor Andon Lamps
  addPostLantern(THREE, K, { x: 0.96, y: FL, z: -2.88, height: 1.52, stone: false, parent: root });
  addPostLantern(THREE, K, { x: 3.76, y: FL, z: 1.52, height: 1.58, stone: false, parent: root });
  boxCol(0.96, -2.88, 0.44, 0.44);
  boxCol(3.76, 1.52, 0.44, 0.44);

  // Warm Golden Interior & Veranda Candlelight (zero shadow maps = fast mobile FPS!)
  if (opts.light !== false) {
    const l1 = new THREE.PointLight(0xffa444, 1.55, 8.5, 1.8);
    l1.position.set(-2.05, 1.95, -0.20);
    root.add(l1);
    const l2 = new THREE.PointLight(0xffb858, 1.35, 8.5, 1.8);
    l2.position.set(2.35, 2.15, -1.15);
    root.add(l2);
  }

  // ==========================================================================
  // 10. REQUIRED GAMEPLAY METADATA (rooms, doors, 10 propSlots, wallHooks)
  // ==========================================================================
  root.userData.footprint = { w: 9.0, d: 7.4 };
  root.userData.rooms = [
    { name: 'irori_salon', x: -1.925, z: -0.15, w: 4.55, d: 6.5, walkX: -0.85, walkZ: 0.95 },
    { name: 'kimono_gallery', x: 2.275, z: -0.15, w: 3.85, d: 6.5, walkX: 1.85, walkZ: 0.25 },
  ];
  root.userData.door = { x: 0.75, z: 4.75 };
  root.userData.doorIn = { x: 0.75, z: 2.45 };
  root.userData.innerDoors = [{ x: 0.35, z: 0.2 }];
  root.userData.wallHooks = [
    { x: -2.1, y: 2.2, z: 3.45, propId: 'bh_towel_basket' },
    { x: 3.3, y: 2.35, z: 3.75, propId: 'bh_paper_lantern' },
  ];

  // 10 indoor hiding propSlots using strictly valid Bathhouse prop IDs (tucked clear of center aisles!)
  root.userData.propSlots = [
    // Left Room: irori_salon (5 slots)
    { id: 'bh_tea_table', x: -3.25, y: FL, z: 2.15, rot: 0.08 },
    { id: 'bh_bonsai_pot', x: -3.48, y: FL, z: 0.55, rot: 0.52 },
    { id: 'bh_daruma_doll', x: -3.48, y: FL, z: -0.85, rot: 0.75 },
    { id: 'bh_paper_lantern', x: -0.58, y: FL, z: -2.15, rot: 0.0 },
    { id: 'bh_towel_basket', x: -1.85, y: FL, z: 2.25, rot: -0.35 },
    // Right Room: kimono_gallery (5 slots)
    { id: 'bh_folding_screen', x: 1.55, y: FL, z: -2.05, rot: 0.38 },
    { id: 'bh_tea_table', x: 2.88, y: FL, z: 2.18, rot: -0.15 },
    { id: 'bh_towel_basket', x: 2.85, y: FL, z: -2.05, rot: -0.45 },
    { id: 'bh_bonsai_pot', x: 3.12, y: FL, z: 1.25, rot: 2.40 },
    { id: 'bh_daruma_doll', x: 1.92, y: FL, z: 2.25, rot: 2.80 },
  ];

  return K.finalize();
}
