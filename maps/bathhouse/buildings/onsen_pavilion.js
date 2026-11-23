// ============================================================================
// Yu-Machi Spirit Bathhouse — Building 1: Grand Vermilion Bathhouse Pavilion
// Hand-modeled from Codex references ext_01_onsen_pavilion.png & int_01_onsen_pavilion.png.
// ============================================================================

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
} from '../../map_kit.js?v=2';
import {
  VERDIGRIS_PAL,
  STONE_BOULDER_PAL,
  MOSS_BOULDER_PAL,
  HYDRANGEA_PAL,
  FOLIAGE_PAL,
  getBathMats,
  buildKawaraGableRoof,
  buildKawaraPentAwning,
  buildCurvedKarahafuGable,
  buildMossyStonePlinth,
  addChochinLantern,
  addPostLantern,
  addNorenCurtain,
  addWisteriaRaceme,
} from '../bath_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

let _onsenTex = null;
let _bathPrewarmed = false;

// Pre-warm shared canvasCache for bath_kit's keys using 3-arg (ctx, s, rng)
// and paint museum-grade Storybook gouache textures for the Fuji Mural, Noren & Shoji!
function ensureBathTexturesSafe(THREE) {
  if (_bathPrewarmed) return;
  _bathPrewarmed = true;

  paintedCanvasTex(THREE, 'bh2_shoji_paper', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#ffdf8e');
    grd.addColorStop(0.55, '#ffc858');
    grd.addColorStop(1, '#ffa42e');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 180, ['#ffebb0', '#ffbe48', '#fff1c2'], 2, 6, 0.25);
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_tatami', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#c2c47e';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(154,162,92,0.45)' : 'rgba(216,218,154,0.35)';
      ctx.fillRect(0, y, s, 2);
    }
    brushStrokes(ctx, s, rng, 110, ['#ced08e', '#a6ad68'], 2, 4, 0.2);
    ctx.fillStyle = '#382a52';
    ctx.fillRect(0, 0, s, 14);
    ctx.fillRect(0, s - 14, s, 14);
    ctx.fillRect(0, 0, 12, s);
    ctx.fillRect(s - 12, 0, 12, s);
    ctx.strokeStyle = '#e0b24c';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, s - 12, s - 12);
  }, 2, 2);

  paintedCanvasTex(THREE, 'bh2_noren_onsen', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#4c2e78');
    grd.addColorStop(1, '#68429e');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 140, ['#754cb0', '#3d2462', '#5b398c'], 3, 7, 0.24);
    ctx.strokeStyle = '#e4bc68';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, s - 14);
    ctx.lineTo(s, s - 14);
    ctx.stroke();
    ctx.strokeStyle = '#fff5dc';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.60, 52, 0.08 * PI, 0.92 * PI, false);
    ctx.stroke();
    ctx.lineWidth = 10;
    for (const dx of [-26, 0, 26]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.5 + dx, s * 0.56);
      ctx.bezierCurveTo(s * 0.5 + dx - 16, s * 0.42, s * 0.5 + dx + 16, s * 0.30, s * 0.5 + dx - 3, s * 0.17);
      ctx.stroke();
    }
  }, 1, 1);

  for (const [k, sz, rx, ry] of [
    ['bh2_noren_ramen', 256, 1, 1],
    ['bh2_noren_bun', 256, 1, 1],
    ['bh2_noren_cream', 256, 1, 1],
    ['bh2_gold_pine_byobu', 512, 1, 1],
    ['bh2_kimono_pink', 256, 1, 1],
    ['bh2_kimono_purple', 256, 1, 1],
    ['bh2_taiko_head', 256, 1, 1],
    ['bh2_warm_brick', 256, 2, 2],
  ]) {
    paintedCanvasTex(THREE, k, sz, (ctx, s) => {
      ctx.fillStyle = '#d8b47c';
      ctx.fillRect(0, 0, s, s);
    }, rx, ry);
  }

  // High-Res 512px Hokusai Great-Wave & Snow-Capped Mt. Fuji Mural (int_01_onsen_pavilion.png hero!)
  paintedCanvasTex(THREE, 'bh2_fuji_mural', 512, (ctx, s, rng) => {
    const sky = ctx.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, '#243c6a');
    sky.addColorStop(0.36, '#3e5e92');
    sky.addColorStop(0.72, '#e8c888');
    sky.addColorStop(1, '#c8e0e6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 140, ['#2e4d80', '#5072a6', '#f0d496'], 4, 10, 0.22);

    const drawCloud = (cx, cy, rx, ry) => {
      ctx.fillStyle = '#e8b54c';
      ctx.beginPath();
      ctx.ellipse(s * cx, s * cy, rx, ry, 0, 0, TAU);
      ctx.ellipse(s * cx - rx * 0.36, s * cy - ry * 0.45, rx * 0.56, ry * 0.82, 0, 0, TAU);
      ctx.ellipse(s * cx + rx * 0.34, s * cy - ry * 0.35, rx * 0.48, ry * 0.72, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#fff2c2';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };
    drawCloud(0.20, 0.18, 78, 22);
    drawCloud(0.84, 0.16, 84, 22);
    drawCloud(0.76, 0.46, 96, 25);
    drawCloud(0.56, 0.56, 74, 20);

    // Snow-capped Mt. Fuji
    ctx.fillStyle = '#294b7c';
    ctx.beginPath();
    ctx.moveTo(s * 0.20, s * 0.72);
    ctx.quadraticCurveTo(s * 0.46, s * 0.48, s * 0.52, s * 0.21);
    ctx.lineTo(s * 0.61, s * 0.21);
    ctx.quadraticCurveTo(s * 0.68, s * 0.48, s * 0.94, s * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#6c92be';
    ctx.lineWidth = 2.5;
    for (const dx of [-0.04, 0.0, 0.04]) {
      ctx.beginPath();
      ctx.moveTo(s * (0.565 + dx), s * 0.32);
      ctx.quadraticCurveTo(s * (0.565 + dx * 2.4), s * 0.48, s * (0.565 + dx * 4.2), s * 0.64);
      ctx.stroke();
    }

    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.moveTo(s * 0.44, s * 0.40);
    ctx.lineTo(s * 0.52, s * 0.21);
    ctx.lineTo(s * 0.61, s * 0.21);
    ctx.lineTo(s * 0.69, s * 0.40);
    ctx.lineTo(s * 0.63, s * 0.34);
    ctx.lineTo(s * 0.59, s * 0.42);
    ctx.lineTo(s * 0.55, s * 0.34);
    ctx.lineTo(s * 0.50, s * 0.41);
    ctx.closePath();
    ctx.fill();

    // Towering Hokusai Great Wave on left + cobalt swells!
    ctx.fillStyle = '#1b4b82';
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(0, s * 0.40);
    ctx.bezierCurveTo(s * 0.12, s * 0.18, s * 0.36, s * 0.20, s * 0.42, s * 0.45);
    ctx.bezierCurveTo(s * 0.27, s * 0.36, s * 0.19, s * 0.57, s * 0.39, s * 0.68);
    ctx.bezierCurveTo(s * 0.58, s * 0.76, s * 0.74, s * 0.52, s, s * 0.65);
    ctx.lineTo(s, s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2e6da8';
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(0, s * 0.66);
    ctx.bezierCurveTo(s * 0.14, s * 0.50, s * 0.30, s * 0.56, s * 0.36, s * 0.77);
    ctx.bezierCurveTo(s * 0.52, s * 0.65, s * 0.76, s * 0.60, s, s * 0.78);
    ctx.lineTo(s, s);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#9be0f4';
    ctx.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.02, s * (0.50 + i * 0.065));
      ctx.quadraticCurveTo(s * 0.24, s * (0.36 + i * 0.06), s * 0.46, s * (0.71 + i * 0.045));
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.50, s * (0.76 + i * 0.05));
      ctx.quadraticCurveTo(s * 0.78, s * (0.58 + i * 0.05), s * 0.99, s * (0.72 + i * 0.05));
      ctx.stroke();
    }

    // Thick creamy-white Hokusai foam crest ribbons & curling wave claws!
    ctx.strokeStyle = '#fffaf0';
    ctx.lineCap = 'round';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(s * 0.02, s * 0.40);
    ctx.bezierCurveTo(s * 0.13, s * 0.19, s * 0.35, s * 0.21, s * 0.42, s * 0.44);
    ctx.stroke();

    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(s * 0.03, s * 0.65);
    ctx.bezierCurveTo(s * 0.15, s * 0.50, s * 0.29, s * 0.55, s * 0.35, s * 0.72);
    ctx.stroke();

    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(s * 0.56, s * 0.70);
    ctx.quadraticCurveTo(s * 0.78, s * 0.55, s * 0.98, s * 0.66);
    ctx.stroke();

    ctx.fillStyle = '#fffbf2';
    for (const [fx, fy, fr] of [
      [0.05, 0.37, 16], [0.12, 0.29, 19], [0.20, 0.25, 21], [0.28, 0.26, 20],
      [0.35, 0.32, 18], [0.41, 0.40, 16], [0.43, 0.47, 13], [0.37, 0.48, 12],
      [0.08, 0.60, 15], [0.16, 0.55, 17], [0.24, 0.56, 16], [0.32, 0.63, 14],
      [0.62, 0.66, 13], [0.72, 0.60, 15], [0.82, 0.60, 15], [0.92, 0.64, 13],
    ]) {
      ctx.beginPath();
      ctx.arc(s * fx, s * fy, fr, 0, TAU);
      ctx.fill();
    }
  }, 1, 1);
}

function getOnsenExtras(THREE) {
  if (_onsenTex) return _onsenTex;

  const slateFloor = paintedCanvasTex(THREE, 'bh_onsen_slate_floor', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#585264';
    ctx.fillRect(0, 0, s, s);
    const rows = 6, bh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r % 2) * 22);
      while (x < s) {
        const bw = Math.floor(rng.jr(34, 58));
        ctx.fillStyle = rng.pick(['#877f94', '#7b7488', '#968a9c', '#6f697d', '#9c8f98', '#837d8e']);
        ctx.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
        ctx.fillStyle = 'rgba(255,220,160,0.15)';
        ctx.fillRect(x + 4, r * bh + 4, bw - 10, 5);
        x += bw;
      }
    }
    brushStrokes(ctx, s, rng, 90, ['#a99aa6', '#655e72', '#dfb888'], 2, 6, 0.18);
  }, 3.2, 3.2);

  const bathWater = paintedCanvasTex(THREE, 'bh_onsen_bath_water', 256, (ctx, s, rng) => {
    const grd = ctx.createRadialGradient(s * 0.5, s * 0.5, 12, s * 0.5, s * 0.5, s * 0.65);
    grd.addColorStop(0, '#7cf8ef');
    grd.addColorStop(0.55, '#3ec8cc');
    grd.addColorStop(1, '#1e92a0');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 110, ['#98fff6', '#2cb0bc', '#d4ffff'], 3, 9, 0.30);
    ctx.strokeStyle = 'rgba(240,255,255,0.60)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const cx = rng.jr(24, s - 24), cy = rng.jr(24, s - 24);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rng.jr(14, 34), rng.jr(6, 14), rng.jr(-0.3, 0.3), 0, TAU);
      ctx.stroke();
    }
  }, 1.4, 1.4);

  const welcomeMat = paintedCanvasTex(THREE, 'bh_onsen_welcome_mat', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#c99b5b';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 6) {
      ctx.fillStyle = y % 12 === 0 ? 'rgba(148,104,52,0.42)' : 'rgba(232,194,132,0.34)';
      ctx.fillRect(0, y, s, 3);
    }
    for (let x = 0; x < s; x += 8) {
      ctx.fillStyle = 'rgba(120,82,38,0.18)';
      ctx.fillRect(x, 0, 2, s);
    }
    brushStrokes(ctx, s, rng, 95, ['#d8ae6e', '#a9793e', '#e4bf84'], 2, 5, 0.22);
    ctx.strokeStyle = '#7a5128';
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, s - 16, s - 16);
    ctx.strokeStyle = '#e7c384';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, s - 36, s - 36);
  });

  const waterStream = paintedCanvasTex(THREE, 'bh_onsen_water_stream', 128, (ctx, s) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#a8fff8');
    grd.addColorStop(0.55, '#68ece4');
    grd.addColorStop(1, '#ffffff');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 19) % (s - 10)) + 4;
      ctx.fillRect(sx, (i * 13) % (s * 0.4), 3 + (i % 3) * 2, s * 0.65);
    }
  });

  const wicker = paintedCanvasTex(THREE, 'bh_onsen_wicker', 128, (ctx, s, rng) => {
    ctx.fillStyle = '#c48644';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      for (let x = 0; x < s; x += 16) {
        const ox = x + ((y / 8) % 2) * 8;
        ctx.fillStyle = rng.pick(['#d69852', '#b07436', '#e0a660', '#9f662c']);
        ctx.fillRect(ox + 1, y + 1, 13, 6);
      }
    }
  }, 2, 2);

  _onsenTex = { slateFloor, bathWater, welcomeMat, waterStream, wicker };
  return _onsenTex;
}

export function buildOnsenPavilion(THREE, opts = {}) {
  ensureBathTexturesSafe(THREE);
  const K = createBuilderKit(THREE, opts, 'onsen_pavilion', 11);
  const { root, roofG, add, addR, rbox, boxCol, wall, pushInst, jr, pick, M, G, tex, glowMat } = K;
  const bm = getBathMats(THREE, K);
  const OT = getOnsenExtras(THREE);

  // Crisp low-poly box helper for thin muntins, staves & rails (12 tris vs 600 tris!)
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  // Crisp 3D Kumiko Shoji Window Bay (identical visual fidelity to addKumikoWindow at 1/30th the triangles!)
  const addShojiBay = ({ cx = 0, cy = 1.65, cz = 0, rotY = 0, w = 1.45, h = 1.35, cols = 4, rows = 4, parent = root }) => {
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = rotY;
    parent.add(g);
    add(box(w - 0.06, h - 0.06, 0.04, bm.shojiGlow), 0, 0, 0, 0, 0, 0, g);
    for (const sx of [-1, 1]) add(box(0.08, h + 0.08, 0.11, bm.darkTimber), sx * (w * 0.5), 0, 0, 0, 0, 0, g);
    for (const sy of [-1, 1]) add(box(w + 0.14, 0.08, 0.12, bm.darkTimber), 0, sy * (h * 0.5), 0, 0, 0, 0, g);
    for (let c = 1; c < cols; c++) {
      add(box(0.028, h - 0.06, 0.075, bm.rafterWood), -w * 0.5 + (c / cols) * w, 0, 0, 0, 0, 0, g);
    }
    for (let r = 1; r < rows; r++) {
      add(box(w - 0.06, 0.028, 0.075, bm.rafterWood), 0, -h * 0.5 + (r / rows) * h, 0, 0, 0, 0, g);
    }
    return g;
  };

  // Luminance-preserving greyscale brushwork roof-tile material so VERDIGRIS_PAL renders vibrant jade-teal!
  const verdigrisTileMat = G(0xffffff, tex('roof_tiles', 0.5, 0.5), 0.39, 0.58);

  // Extra custom materials (100% metalness: 0 for warm Storybook lighting!)
  const wetSlateMat = M(0xffffff, OT.slateFloor, { roughness: 0.78, metalness: 0 });
  const richWaterMat = glowMat(0x7ef2ea, 0x20a0b0, 0.86, { map: OT.bathWater, roughness: 0.20 });
  const muralMat = M(0xffffff, bm.BT.fujiMural, {
    roughness: 0.72,
    metalness: 0,
    emissive: 0x6e5430,
    emissiveIntensity: 0.28,
  });
  const matWelcome = M(0xffffff, OT.welcomeMat, { roughness: 0.92, metalness: 0 });
  const wickerMat = M(0xffffff, OT.wicker, { roughness: 0.86, metalness: 0 });
  const streamMat = glowMat(0xc8fffb, 0x48d2de, 1.15, { map: OT.waterStream, roughness: 0.20 });
  const yukataPlum = M(0x6c429c, null, { roughness: 0.88, metalness: 0 });
  const yukataLav = M(0xa678dc, null, { roughness: 0.88, metalness: 0 });
  const yukataCream = bm.creamPlaster;

  // Soft unlit cloud-like translucent steam wisps -> 1 merged draw call!
  const softSteamMat = new THREE.MeshBasicMaterial({
    color: 0xf6fbff,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const steamGeos = [];
  const pushSteamPuff = (x, y, z, rx, ry, rz) => {
    const g = new THREE.SphereGeometry(1, 7, 5);
    g.scale(rx, ry, rz);
    g.translate(x, y, z);
    steamGeos.push(g);
  };
  const addSteamColumn = (cx, y0, cz, spreadX = 0.52, spreadZ = 0.40, count = 7, hSpan = 1.22) => {
    for (let i = 0; i < count; i++) {
      const f = i / Math.max(1, count - 1);
      const rad = (0.20 + f * 0.22) * jr(0.88, 1.15);
      pushSteamPuff(
        cx + jr(-spreadX, spreadX) * (0.85 - f * 0.25),
        y0 + f * hSpan + jr(-0.04, 0.05),
        cz + jr(-spreadZ, spreadZ) * (0.85 - f * 0.25),
        rad * 1.16,
        rad * 0.80,
        rad * 1.10
      );
    }
  };

  // ==========================================================================
  // 1. MOSSY SHORELINE BOULDER PLINTH, FRONT STAIRS, HYDRANGEAS & POST LANTERNS
  // ==========================================================================
  const FL = 0.42;
  buildMossyStonePlinth(THREE, K, {
    w: 10.2,
    d: 8.6,
    h: FL,
    doorX: 0,
    doorW: 2.3,
    steps: 4,
    hydrangeas: true,
    parent: root,
  });

  // Dressed twilight-slate step treads capping the 4 stone entrance steps (matches ext_01 stone stairs!)
  for (let s = 0; s < 4; s++) {
    const stepH = FL * (1 - s / 4);
    add(box(2.64, 0.035, 0.43, wetSlateMat), 0, stepH + 0.012, 4.60 + s * 0.34, 0, 0, 0, root);
  }

  // Twin timber Toro post lanterns flanking the grand front stone stairs!
  for (const sx of [-1, 1]) {
    addPostLantern(THREE, K, { x: sx * 2.15, y: 0, z: 4.92, height: 1.60, stone: false, parent: root });
    boxCol(sx * 2.15, 4.92, 0.46, 0.46);
  }

  // Lush purple hydrangea & mossy boulder cluster beside the front-left stair cheek (ext_01 hero detail!)
  {
    const leafGeo = () => {
      const g = new THREE.CircleGeometry(0.14, 6);
      g.scale(1, 1.35, 1);
      return g;
    };
    const floretGeo = () => new THREE.IcosahedronGeometry(0.13, 0);
    const rockGeo = () => new THREE.DodecahedronGeometry(0.32, 1);
    for (const [bx, bz, sc] of [[-1.62, 5.25, 1.15], [1.62, 5.25, 1.1], [-1.78, 4.62, 0.95]]) {
      pushInst('onsen_rock', rockGeo, bm.stoneInst, bx, 0.18, bz, jr(0, 3), jr(0, 3), 0,
        sc * 1.15, sc * 0.72, sc, pick(MOSS_BOULDER_PAL), root);
    }
    for (let l = 0; l < 16; l++) {
      pushInst('onsen_hleaf', leafGeo, bm.leafInst,
        -1.66 + jr(-0.42, 0.36), 0.24 + jr(0, 0.36), 4.76 + jr(-0.32, 0.34),
        jr(-0.7, 0.7), jr(0, TAU), jr(-0.4, 0.4), jr(1.0, 1.4), jr(1.0, 1.4), 1, pick(FOLIAGE_PAL), root);
    }
    for (let b = 0; b < 14; b++) {
      pushInst('onsen_hflor', floretGeo, bm.whiteInst,
        -1.64 + jr(-0.36, 0.32), 0.36 + jr(0, 0.34), 4.78 + jr(-0.28, 0.30),
        jr(0, 3), jr(0, 3), 0, jr(0.95, 1.35), jr(0.85, 1.2), jr(0.95, 1.35), pick(HYDRANGEA_PAL), root);
    }
  }

  // ==========================================================================
  // 2. FLOORS: WET SLATE BATH HALL, HINOKI ROBE HALL & FRONT ENGAWA VERANDA
  // ==========================================================================
  add(box(5.38, 0.08, 6.96, wetSlateMat), -2.06, FL - 0.02, -0.34, 0, 0, 0, root);
  add(box(2.68, 0.08, 1.42, wetSlateMat), 0, FL - 0.015, 3.68, 0, 0, 0, root);
  add(box(4.06, 0.08, 6.72, bm.hinoki), 2.62, FL - 0.018, -0.44, 0, 0, 0, root);
  add(box(2.45, 0.026, 3.20, bm.tatami), 2.78, FL + 0.025, -0.65, 0, 0, 0, root);

  for (const sx of [-1, 1]) {
    add(box(3.64, 0.09, 1.28, bm.cedar), sx * 3.16, FL - 0.01, 3.68, 0, 0, 0, root);
    add(box(3.72, 0.12, 0.12, bm.darkTimber), sx * 3.16, FL - 0.03, 4.30, 0, 0, 0, root);
  }

  // ==========================================================================
  // 3. HOLLOW WALL SHELL (below y = 3.24m in root; upper frieze in roofG!)
  // ==========================================================================
  const H_ROOT = 3.24;
  const T = 0.22;

  // Front Wall at z = +3.08 (recessed behind the Engawa veranda!)
  wall(0, 3.08, 0, 9.6, H_ROOT, T, [
    { u: 0, w: 1.90, h: 2.68, door: true },
    { u: -1.42, y0: 0.94, w: 0.68, h: 1.68 },
    { u: 1.42, y0: 0.94, w: 0.68, h: 1.68 },
    { u: -3.15, y0: 1.08, w: 1.68, h: 1.48 },
    { u: 3.15, y0: 1.08, w: 1.68, h: 1.48 },
  ], bm.cedar, bm.warmInnerWall, root, true);

  // Back Wall at z = -3.92
  wall(0, -3.92, PI, 9.6, H_ROOT, T, [
    { u: -2.65, y0: 1.18, w: 1.55, h: 1.42 },
  ], bm.cedar, bm.warmInnerWall, root, true);

  // Left Wall at x = -4.80
  wall(-4.80, -0.42, -PI * 0.5, 7.00, H_ROOT, T, [
    { u: 1.55, y0: 1.06, w: 1.52, h: 1.64 },
  ], bm.cedar, bm.warmInnerWall, root, true);

  // Right Wall at x = +4.80
  wall(4.80, -0.42, PI * 0.5, 7.00, H_ROOT, T, [
    { u: -1.55, y0: 1.12, w: 1.45, h: 1.52 },
    { u: 1.55, y0: 1.12, w: 1.45, h: 1.52 },
  ], bm.cedar, bm.warmInnerWall, root, true);

  // Interior Partition Wall at x = 0.55 (spans z = -3.70 .. +1.76, arched doorway at world z = 0.20!)
  // Center cz = -0.97, length = 5.46 => wz = -0.97 + u => u = 1.17 -> world z = 0.20!
  wall(0.64, -0.97, -PI * 0.5, 5.46, H_ROOT, 0.18, [
    { u: 1.17, w: 1.65, h: 2.86, door: true, arch: true },
  ], bm.warmInnerWall, bm.warmInnerWall, root, true);

  // Clean stepped glowing Kumiko Shoji Vestibule Screen connecting (0.55, 1.76) -> (1.02, 1.76) -> (1.02, 2.86)
  // Makes the view through the front purple ♨ noren glow warm amber just like ext_01_onsen_pavilion.png!
  add(box(0.56, H_ROOT - FL, 0.14, bm.warmInnerWall), 0.785, FL + (H_ROOT - FL) * 0.5, 1.76, 0, 0, 0, root);
  addShojiBay({ cx: 0.78, cy: 1.72, cz: 1.86, rotY: 0, w: 0.50, h: 1.82, cols: 2, rows: 5, parent: root });
  boxCol(0.785, 1.76, 0.56, 0.18);

  add(box(0.14, H_ROOT - FL, 1.14, bm.warmInnerWall), 1.02, FL + (H_ROOT - FL) * 0.5, 2.31, 0, 0, 0, root);
  addShojiBay({ cx: 1.02, cy: 1.72, cz: 2.31, rotY: -PI * 0.5, w: 0.88, h: 1.82, cols: 3, rows: 5, parent: root });
  boxCol(1.02, 2.31, 0.18, 1.14);

  // Glowing Kumiko Shoji Window Frames on all exterior window openings!
  addShojiBay({ cx: -1.42, cy: 1.78, cz: 3.00, rotY: 0, w: 0.68, h: 1.68, cols: 2, rows: 5, parent: root });
  addShojiBay({ cx: 1.42, cy: 1.78, cz: 3.00, rotY: 0, w: 0.68, h: 1.68, cols: 2, rows: 5, parent: root });
  addShojiBay({ cx: -3.15, cy: 1.82, cz: 3.00, rotY: 0, w: 1.68, h: 1.48, cols: 5, rows: 4, parent: root });
  addShojiBay({ cx: 3.15, cy: 1.82, cz: 3.00, rotY: 0, w: 1.68, h: 1.48, cols: 5, rows: 4, parent: root });
  for (const sx of [-1, 1]) {
    addShojiBay({ cx: sx * 3.15, cy: 2.86, cz: 3.02, rotY: 0, w: 2.65, h: 0.40, cols: 7, rows: 2, parent: root });
  }
  addShojiBay({ cx: 2.65, cy: 1.89, cz: -3.82, rotY: PI, w: 1.55, h: 1.42, cols: 4, rows: 4, parent: root });
  addShojiBay({ cx: -4.70, cy: 1.88, cz: 1.13, rotY: -PI * 0.5, w: 1.52, h: 1.64, cols: 4, rows: 5, parent: root });
  addShojiBay({ cx: 4.70, cy: 1.88, cz: 1.13, rotY: PI * 0.5, w: 1.45, h: 1.52, cols: 4, rows: 4, parent: root });
  addShojiBay({ cx: 4.70, cy: 1.88, cz: -1.97, rotY: PI * 0.5, w: 1.45, h: 1.52, cols: 4, rows: 4, parent: root });

  // ==========================================================================
  // 4. GRAND VERMILION PILLARS, BALUSTRADES, VERANDA TUBS, NOREN & LANTERNS
  // ==========================================================================
  const addVermilionPillar = (x, z, r = 0.17, y0 = FL, y1 = 3.06) => {
    const h = y1 - y0;
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.26, r * 1.34, 0.14, 12), bm.mossStone), x, y0 + 0.07, z, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.16, 0.09, 12), bm.goldTrim), x, y0 + 0.17, z, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h - 0.18, 14), bm.vermilion), x, y0 + 0.18 + (h - 0.18) * 0.5, z, 0, 0, 0, root);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.14, r * 1.08, 0.10, 12), bm.goldTrim), x, y1 + 0.05, z);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r, 0.34, 12), bm.vermilion), x, y1 + 0.25, z);
    addR(box(r * 2.8, 0.12, r * 2.8, bm.darkTimber), x, y1 + 0.42, z);
  };

  for (const sx of [-1, 1]) {
    addVermilionPillar(sx * 1.36, 4.10, 0.205, FL, 2.98);
    boxCol(sx * 1.36, 4.10, 0.42, 0.42);
    addVermilionPillar(sx * 4.78, 4.16, 0.165, FL, 2.98);
    addVermilionPillar(sx * 4.78, 3.06, 0.17, FL, 3.16);
    addVermilionPillar(sx * 4.78, -0.42, 0.16, FL, 3.16);
    addVermilionPillar(sx * 4.78, -3.90, 0.17, FL, 3.16);
    addVermilionPillar(sx * 1.02, 3.08, 0.145, FL, 3.16);

    // Eave lantern hook brackets at wallHooks (±2.1, 2.45, 4.15)
    addR(box(0.14, 0.66, 0.14, bm.vermilionDeep), sx * 2.10, 2.82, 4.15);
    add(box(0.10, 0.08, 0.24, bm.goldTrim), sx * 2.10, 2.48, 4.17, 0, 0, 0, root);
  }

  // Central Entrance 3-Panel Purple ♨ Onsen Noren Curtain at yTop = 2.68!
  add(rbox(2.16, 0.15, 0.26, 0.03, bm.darkTimber, 1), 0, 2.74, 3.06, 0, 0, 0, root);
  addNorenCurtain(THREE, K, {
    cx: 0,
    yTop: 2.68,
    z: 3.12,
    rotY: 0,
    width: 1.86,
    height: 0.88,
    panels: 3,
    texMap: bm.BT.norenOnsen,
    parent: root,
  });

  // Open Railed Vermilion Veranda Balustrades
  for (const sx of [-1, 1]) {
    for (const [x0, x1] of [[1.42, 2.28], [4.02, 4.82]]) {
      const xm = sx * (x0 + x1) * 0.5, rw = Math.abs(x1 - x0);
      add(box(rw, 0.08, 0.09, bm.vermilion), xm, FL + 0.62, 4.26, 0, 0, 0, root);
      add(box(rw, 0.065, 0.075, bm.vermilion), xm, FL + 0.34, 4.26, 0, 0, 0, root);
      for (const px of [x0 + 0.06, (x0 + x1) * 0.5, x1 - 0.06]) {
        add(box(0.09, 0.72, 0.09, bm.vermilion), sx * px, FL + 0.36, 4.26, 0, 0, 0, root);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bm.goldTrim), sx * px, FL + 0.75, 4.26, 0, 0, 0, root);
      }
    }
    add(box(0.09, 0.08, 1.16, bm.vermilion), sx * 4.82, FL + 0.62, 3.68, 0, 0, 0, root);
    add(box(0.075, 0.065, 1.16, bm.vermilion), sx * 4.82, FL + 0.34, 3.68, 0, 0, 0, root);
    add(box(0.09, 0.72, 0.09, bm.vermilion), sx * 4.82, FL + 0.36, 3.68, 0, 0, 0, root);
    boxCol(sx * 3.15, 4.25, 3.45, 0.24);
  }

  // TWIN Built-in Steaming Oval Hinoki Cedar Soaking Tubs on Front Veranda (x = ±3.15, z = 3.55)!
  const buildOvalHinokiTub = (cx, cz, rx = 0.88, rz = 0.58, h = 0.64) => {
    const g = new THREE.Group();
    g.position.set(cx, FL, cz);
    root.add(g);

    // Outer & inner cedar stave shells (inner floor sits below water level so glowing turquoise water shines!)
    const wallShell = new THREE.CylinderGeometry(1, 0.94, h, 24, 1, true);
    wallShell.scale(rx, 1, rz);
    add(new THREE.Mesh(wallShell, bm.hinoki), 0, h * 0.5, 0, 0, 0, 0, g);

    const innerWall = new THREE.CylinderGeometry(0.89, 0.86, h, 20, 1, true);
    innerWall.scale(rx, 1, rz);
    add(new THREE.Mesh(innerWall, bm.cedar), 0, h * 0.5, 0, 0, 0, 0, g);

    const nStaves = 20;
    for (let i = 0; i < nStaves; i++) {
      const a = (i / nStaves) * TAU;
      add(box(0.055, h - 0.02, 0.032, i % 2 ? bm.hinoki : bm.cedar),
        Math.cos(a) * rx * 0.99, h * 0.5, Math.sin(a) * rz * 0.99, 0, -a + PI * 0.5, 0, g);
    }

    // Horizontal oval Hinoki coping rim (pre-rotated in geometry so add() keeps it flat!)
    const rimGeo = new THREE.TorusGeometry(1, 0.068, 8, 28);
    rimGeo.rotateX(PI * 0.5);
    rimGeo.scale(rx * 0.95, 1, rz * 0.95);
    add(new THREE.Mesh(rimGeo, bm.hinoki), 0, h, 0, 0, 0, 0, g);

    // Two horizontal warm-brass hoops wrapping snugly around the cedar staves!
    for (const [hy, tap] of [[h * 0.28, 0.97], [h * 0.68, 1.00]]) {
      const hoopGeo = new THREE.TorusGeometry(1, 0.024, 6, 28);
      hoopGeo.rotateX(PI * 0.5);
      hoopGeo.scale(rx * tap, 1, rz * tap);
      add(new THREE.Mesh(hoopGeo, bm.brassWarm), 0, hy, 0, 0, 0, 0, g);
    }

    // Glowing turquoise herbal water filling the tub right up near the rim!
    const waterGeo = new THREE.CylinderGeometry(0.90, 0.88, 0.06, 24);
    waterGeo.scale(rx, 1, rz);
    add(new THREE.Mesh(waterGeo, richWaterMat), 0, h - 0.06, 0, 0, 0, 0, g);

    addSteamColumn(cx, FL + h + 0.04, cz, rx * 0.54, rz * 0.48, 8, 1.25);
    boxCol(cx, cz, rx * 1.92, rz * 1.92);
  };

  buildOvalHinokiTub(-3.15, 3.55, 0.88, 0.58, 0.64);
  buildOvalHinokiTub(3.15, 3.55, 0.88, 0.58, 0.64);

  // Hanging Glowing Golden Chochin Lanterns across the Front Facade!
  for (const sx of [-1, 1]) {
    addChochinLantern(THREE, K, { x: sx * 1.36, y: 2.20, z: 4.34, radius: 0.24, height: 0.52, red: false, parent: root });
    addChochinLantern(THREE, K, { x: sx * 4.86, y: 2.36, z: 4.24, radius: 0.20, height: 0.42, red: false, parent: root });
    addChochinLantern(THREE, K, { x: sx * 4.44, y: 2.24, z: 3.24, radius: 0.14, height: 0.30, red: false, tassel: false, parent: root });
  }

  // ==========================================================================
  // 5. 2-TIERED PALACE ROOF, KARAHAFU GABLE & WATCHTOWER CUPOLA (ALL IN roofG!)
  // ==========================================================================
  addR(rbox(3.26, 0.22, 0.24, 0.03, bm.vermilion, 1), 0, 3.04, 4.10);
  addR(box(3.38, 0.08, 0.28, bm.goldTrim), 0, 3.18, 4.10);
  for (const sx of [-1, 1]) {
    addR(box(0.20, 0.20, 1.12, bm.vermilion), sx * 1.36, 3.04, 3.56);
    addR(box(3.52, 0.18, 0.18, bm.vermilionDeep), sx * 3.10, 3.08, 4.16);
  }
  addR(box(9.84, 0.24, 0.28, bm.vermilion), 0, 3.36, 3.06);
  addR(box(9.84, 0.24, 0.28, bm.vermilion), 0, 3.36, -3.90);
  addR(box(0.28, 0.24, 7.22, bm.vermilion), -4.78, 3.36, -0.42);
  addR(box(0.28, 0.24, 7.22, bm.vermilion), 4.78, 3.36, -0.42);
  addR(box(0.22, 0.24, 5.60, bm.darkTimber), 0.55, 3.36, -0.97);
  for (const zRib of [-2.4, -0.4, 1.6]) {
    addR(box(9.2, 0.16, 0.18, bm.rafterWood), 0, 3.38, zRib);
  }

  // Front Veranda Pent Awning Roof
  buildKawaraPentAwning(THREE, K, {
    cx: 0,
    zWall: 3.04,
    yWall: 3.44,
    width: 10.5,
    depth: 1.44,
    drop: 0.40,
    palette: VERDIGRIS_PAL,
    parent: roofG,
    batchPrefix: 'onsen_rf',
  });

  // Grand Sweeping Curved Verdigris Karahafu Entrance Gable (in roofG!)
  {
    const kW = 4.60, kRise = 1.34, kY0 = 3.18, kZ = 3.88;
    const tymShape = new THREE.Shape();
    tymShape.moveTo(-kW * 0.48, kY0);
    for (let i = 0; i <= 24; i++) {
      const u = (i / 24) * 2 - 1;
      const bell = Math.cos(u * PI * 0.5);
      const wing = Math.pow(Math.abs(u), 3) * 0.20;
      tymShape.lineTo(u * (kW * 0.48), kY0 + bell * bell * (kRise - 0.06) + wing);
    }
    tymShape.lineTo(-kW * 0.48, kY0);
    const tymGeo = new THREE.ExtrudeGeometry(tymShape, { depth: 0.30, bevelEnabled: false });
    addR(new THREE.Mesh(tymGeo, bm.vermilionDeep), 0, 0, kZ + 0.16);

    buildCurvedKarahafuGable(THREE, K, {
      cx: 0,
      zFront: kZ,
      yBase: kY0,
      width: kW,
      archRise: kRise,
      depth: 1.48,
      palette: VERDIGRIS_PAL,
      parent: roofG,
    });
    // Tuck rectangular tympanum backing plate neatly inside the curved Karahafu arch!
    for (const c of roofG.children) {
      if (c.isMesh && c.material === bm.darkTimber && Math.abs(c.position.z - (kZ + 1.48 * 0.40 - 0.08)) < 0.05) {
        c.scale.set(0.65, 0.70, 1);
      }
    }

    // Delicate sculpted 3D golden kaerumata cloud scrollwork below chrysanthemum crest (matches ext_01!)
    addR(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bm.goldTrim), 0, kY0 + 0.34, kZ + 0.56);
    for (const sx of [-1, 1]) {
      const lowerScroll = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.10, kY0 + 0.34, kZ + 0.55),
        new THREE.Vector3(sx * 0.48, kY0 + 0.28, kZ + 0.56),
        new THREE.Vector3(sx * 0.86, kY0 + 0.14, kZ + 0.55),
        new THREE.Vector3(sx * 1.15, kY0 + 0.22, kZ + 0.56),
      ]);
      addR(new THREE.Mesh(new THREE.TubeGeometry(lowerScroll, 12, 0.042, 6, false), bm.goldTrim), 0, 0, 0);
      addR(box(0.28, 0.10, 0.08, bm.goldTrim), sx * 1.36, kY0 + 0.06, kZ + 0.55);
    }
  }

  // Tier 1: Main Sweeping Verdigris 3D Kawara Roof (spanX: 9.8, spanZ: 8.0, rise: 1.72)
  buildKawaraGableRoof(THREE, K, {
    cx: 0,
    cz: -0.35,
    yBase: 3.42,
    spanX: 9.8,
    spanZ: 8.0,
    rise: 1.72,
    overhangX: 0.80,
    overhangZ: 0.76,
    ridgeAlongX: true,
    palette: VERDIGRIS_PAL,
    tileMat: verdigrisTileMat,
    finial: 'onigawara',
    parent: roofG,
    batchPrefix: 'onsen_rf',
  });

  // Tier 2: Second-Story Clerestory Pavilion (w = 6.2, d = 4.6) + Glowing Kumiko Shoji + Upper Kawara Roof
  {
    const cW = 6.2, cD = 4.6, cY0 = 4.28, cH = 1.18, cZ = -0.20;
    addR(box(cW, cH, cD, bm.cedar), 0, cY0 + cH * 0.5, cZ);
    addR(box(cW + 0.22, 0.18, cD + 0.22, bm.vermilion), 0, cY0 + cH - 0.04, cZ);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      addR(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, cH + 0.1, 10), bm.vermilion),
        sx * (cW * 0.5), cY0 + cH * 0.5, cZ + sz * (cD * 0.5));
    }
    for (const sx of [-1, 1]) {
      addShojiBay({ cx: sx * 2.02, cy: cY0 + 0.58, cz: cZ + cD * 0.5 + 0.03, rotY: 0, w: 1.32, h: 0.84, cols: 4, rows: 3, parent: roofG });
      addShojiBay({ cx: sx * 2.02, cy: cY0 + 0.58, cz: cZ - cD * 0.5 - 0.03, rotY: PI, w: 1.32, h: 0.84, cols: 4, rows: 3, parent: roofG });
      addShojiBay({ cx: sx * (cW * 0.5 + 0.03), cy: cY0 + 0.58, cz: cZ, rotY: sx * PI * 0.5, w: 1.65, h: 0.84, cols: 4, rows: 3, parent: roofG });
      addChochinLantern(THREE, K, { x: sx * 2.88, y: cY0 + 0.64, z: cZ + cD * 0.5 + 0.42, radius: 0.18, height: 0.38, red: false, parent: roofG });
    }

    buildKawaraGableRoof(THREE, K, {
      cx: 0,
      cz: cZ,
      yBase: cY0 + cH - 0.04,
      spanX: 6.6,
      spanZ: 4.8,
      rise: 1.25,
      overhangX: 0.70,
      overhangZ: 0.66,
      ridgeAlongX: true,
      palette: VERDIGRIS_PAL,
      tileMat: verdigrisTileMat,
      finial: 'onigawara',
      parent: roofG,
      batchPrefix: 'onsen_rf',
    });
  }

  // Tier 3: Central Rooftop Watchtower Lantern Cupola (yagura, w = 2.4, d = 2.2) + Jewel Finial!
  {
    const yW = 2.4, yD = 2.2, yY0 = 6.28, yH = 1.02, yZ = -0.20;
    addR(box(yW, yH, yD, bm.cedar), 0, yY0 + yH * 0.5, yZ);
    addR(box(yW + 0.28, 0.15, yD + 0.28, bm.vermilion), 0, yY0 + yH - 0.02, yZ);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      addR(box(0.16, yH + 0.08, 0.16, bm.darkTimber), sx * (yW * 0.5), yY0 + yH * 0.5, yZ + sz * (yD * 0.5));
      addR(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), bm.lanternGlow),
        sx * (yW * 0.5 + 0.32), yY0 + yH - 0.08, yZ + sz * (yD * 0.5 + 0.30));
    }
    addShojiBay({ cx: 0, cy: yY0 + 0.50, cz: yZ + yD * 0.5 + 0.03, rotY: 0, w: 1.68, h: 0.72, cols: 4, rows: 3, parent: roofG });
    addShojiBay({ cx: 0, cy: yY0 + 0.50, cz: yZ - yD * 0.5 - 0.03, rotY: PI, w: 1.68, h: 0.72, cols: 4, rows: 3, parent: roofG });
    addShojiBay({ cx: -yW * 0.5 - 0.03, cy: yY0 + 0.50, cz: yZ, rotY: -PI * 0.5, w: 1.48, h: 0.72, cols: 3, rows: 3, parent: roofG });
    addShojiBay({ cx: yW * 0.5 + 0.03, cy: yY0 + 0.50, cz: yZ, rotY: PI * 0.5, w: 1.48, h: 0.72, cols: 3, rows: 3, parent: roofG });

    addR(rbox(0.92, 0.16, 0.82, 0.03, bm.goldTrim, 1), 0, yY0 + yH + 0.76, yZ);
    buildKawaraGableRoof(THREE, K, {
      cx: 0,
      cz: yZ,
      yBase: yY0 + yH - 0.02,
      spanX: 2.50,
      spanZ: 2.30,
      rise: 0.78,
      overhangX: 0.52,
      overhangZ: 0.50,
      ridgeAlongX: true,
      palette: VERDIGRIS_PAL,
      tileMat: verdigrisTileMat,
      finial: 'jewel',
      parent: roofG,
      batchPrefix: 'onsen_rf',
    });
  }

  // ==========================================================================
  // 6. DOLLHOUSE CUTAWAY INTERIOR: ROOM 1 (`fuji_bath`, LEFT) & ROOM 2 (`robe_hall`, RIGHT)
  // ==========================================================================
  const addSquareAndon = (x, yBase, z, scale = 1) => {
    const h = 0.50 * scale, w = 0.30 * scale;
    add(box(w + 0.08, 0.05, w + 0.08, bm.darkTimber), x, yBase + 0.025, z, 0, 0, 0, root);
    add(box(w, h, w, bm.shojiGlow), x, yBase + 0.05 + h * 0.5, z, 0, 0, 0, root);
    add(box(w + 0.09, 0.05, w + 0.09, bm.darkTimber), x, yBase + 0.06 + h, z, 0, 0, 0, root);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(box(0.032, h + 0.04, 0.032, bm.darkTimber), x + sx * (w * 0.5), yBase + 0.05 + h * 0.5, z + sz * (w * 0.5), 0, 0, 0, root);
    }
  };

  const addWoodBucket = (x, yBase, z, r = 0.20, h = 0.22) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.90, h, 14), bm.hinoki), x, yBase + h * 0.5, z, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.84, r * 0.80, 0.04, 12), bm.darkTimber), x, yBase + h - 0.02, z, 0, 0, 0, root);
    for (const hy of [0.06, h - 0.06]) {
      const hpGeo = new THREE.TorusGeometry(r * 0.97, 0.014, 5, 16);
      hpGeo.rotateX(PI * 0.5);
      add(new THREE.Mesh(hpGeo, bm.brassWarm), x, yBase + hy, z, 0, 0, 0, root);
    }
  };

  // --- LEFT ROOM (`fuji_bath`) ---
  add(box(5.05, 0.68, 0.06, bm.cedar), -2.06, FL + 0.34, -3.66, 0, 0, 0, root);
  for (const [px, pz] of [[-4.46, -3.56], [0.34, -3.56]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 2.78, 12), bm.vermilion), px, FL + 1.39, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), bm.goldTrim), px, FL + 2.48, pz, 0, 0, 0, root);
  }

  // Huge Painted Hokusai Great-Wave & Mt. Fuji Mural (4.6m × 2.18m) on Back Wall!
  add(box(4.74, 2.26, 0.07, bm.darkTimber), -2.06, FL + 1.74, -3.66, 0, 0, 0, root);
  add(box(4.58, 2.12, 0.05, muralMat), -2.06, FL + 1.74, -3.63, 0, 0, 0, root);
  for (const lx of [-3.08, -1.04]) {
    addChochinLantern(THREE, K, { x: lx, y: 2.72, z: -3.02, radius: 0.22, height: 0.44, red: false, parent: root });
    add(box(0.035, 0.26, 0.035, bm.darkTimber), lx, 3.08, -3.02, 0, 0, 0, root);
  }

  // Steaming Rectangular Hinoki Cedar Main Bath (cx = -2.76, cz = -1.65, w = 3.04, d = 2.14, h = 0.60)
  {
    const bx = -2.76, bz = -1.65, bw = 3.04, bd = 2.14, bh = 0.60, rim = 0.18;
    add(box(bw, bh, rim, bm.cedar), bx, FL + bh * 0.5, bz + bd * 0.5 - rim * 0.5, 0, 0, 0, root);
    add(box(bw, bh, rim, bm.cedar), bx, FL + bh * 0.5, bz - bd * 0.5 + rim * 0.5, 0, 0, 0, root);
    add(box(rim, bh, bd - rim * 2, bm.cedar), bx - bw * 0.5 + rim * 0.5, FL + bh * 0.5, bz, 0, 0, 0, root);
    add(box(rim, bh, bd - rim * 2, bm.cedar), bx + bw * 0.5 - rim * 0.5, FL + bh * 0.5, bz, 0, 0, 0, root);
    add(rbox(bw + 0.08, 0.09, 0.22, 0.025, bm.hinoki, 1), bx, FL + bh + 0.02, bz + bd * 0.5 - 0.09, 0, 0, 0, root);
    add(rbox(bw + 0.08, 0.09, 0.22, 0.025, bm.hinoki, 1), bx, FL + bh + 0.02, bz - bd * 0.5 + 0.09, 0, 0, 0, root);
    add(rbox(0.22, 0.09, bd + 0.08, 0.025, bm.hinoki, 1), bx - bw * 0.5 + 0.09, FL + bh + 0.02, bz, 0, 0, 0, root);
    add(rbox(0.22, 0.09, bd + 0.08, 0.025, bm.hinoki, 1), bx + bw * 0.5 - 0.09, FL + bh + 0.02, bz, 0, 0, 0, root);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(rbox(0.24, bh + 0.10, 0.24, 0.03, bm.hinoki, 1), bx + sx * (bw * 0.5 - 0.08), FL + (bh + 0.10) * 0.5, bz + sz * (bd * 0.5 - 0.08), 0, 0, 0, root);
    }
    for (let i = -6; i <= 6; i++) {
      add(box(0.035, bh - 0.06, 0.03, bm.darkTimber), bx + i * 0.21, FL + bh * 0.48, bz + bd * 0.5 + 0.005, 0, 0, 0, root);
    }
    for (let i = -4; i <= 4; i++) {
      add(box(0.03, bh - 0.06, 0.035, bm.darkTimber), bx + bw * 0.5 + 0.005, FL + bh * 0.48, bz + i * 0.21, 0, 0, 0, root);
    }
    add(box(bw - 0.30, 0.05, bd - 0.30, richWaterMat), bx, FL + bh - 0.06, bz, 0, 0, 0, root);
    for (const rr of [0.22, 0.40, 0.58]) {
      const ringGeo = new THREE.TorusGeometry(rr, 0.018, 5, 18);
      ringGeo.rotateX(PI * 0.5);
      add(new THREE.Mesh(ringGeo, streamMat), -3.72, FL + bh - 0.025, bz, 0, 0, 0, root);
    }
    addSteamColumn(bx + 0.1, FL + bh + 0.05, bz, 0.95, 0.65, 10, 1.30);
    boxCol(bx, bz, bw, bd);

    // Wooden Kakehi Hot-Spring Spout pouring glowing turquoise water into the main bath!
    add(rbox(0.46, 1.24, 0.48, 0.03, bm.cedar, 1), -4.28, FL + 0.62, bz, 0, 0, 0, root);
    add(box(0.52, 0.09, 0.54, bm.hinoki), -4.28, FL + 1.25, bz, 0, 0, 0, root);
    add(box(0.72, 0.16, 0.26, bm.hinoki), -3.96, FL + 1.06, bz, 0, 0, -0.26, root);
    add(box(0.70, 0.05, 0.16, richWaterMat), -3.95, FL + 1.12, bz, 0, 0, -0.26, root);
    const fallCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.04, 1.00, 0),
      new THREE.Vector3(0.00, 0.78, 0),
      new THREE.Vector3(-0.04, 0.54, 0),
    ]);
    const fallGeo = new THREE.TubeGeometry(fallCurve, 10, 0.075, 8, false);
    fallGeo.scale(0.55, 1, 1.45);
    add(new THREE.Mesh(fallGeo, streamMat), -3.68, FL, bz, 0, 0, 0, root);

    addSquareAndon(bx + bw * 0.5 - 0.14, FL + bh + 0.06, bz + bd * 0.5 - 0.14, 0.88);
    add(box(0.42, bh + 0.06, 0.42, bm.hinoki), -2.02, FL + (bh + 0.06) * 0.5, -2.92, 0, 0, 0, root);
    addSquareAndon(-2.02, FL + bh + 0.06, -2.92, 0.82);
  }

  // Mossy Shoreline Boulder & Purple Hydrangea Accent between kakehi spout and foreground bath!
  {
    const rockGeo = () => new THREE.DodecahedronGeometry(0.34, 1);
    const leafGeo = () => { const g = new THREE.CircleGeometry(0.14, 6); g.scale(1, 1.35, 1); return g; };
    const floretGeo = () => new THREE.IcosahedronGeometry(0.13, 0);
    pushInst('onsen_rock', rockGeo, bm.stoneInst, -4.18, FL + 0.34, -0.30, 0.4, 1.1, 0.2, 1.28, 1.35, 1.15, STONE_BOULDER_PAL[0], root);
    pushInst('onsen_rock', rockGeo, bm.stoneInst, -3.76, FL + 0.22, -0.34, 1.2, 0.5, 0, 0.88, 0.85, 0.85, MOSS_BOULDER_PAL[0], root);
    for (let l = 0; l < 14; l++) {
      pushInst('onsen_hleaf', leafGeo, bm.leafInst,
        -4.18 + jr(-0.32, 0.32), FL + 0.62 + jr(0, 0.38), -0.30 + jr(-0.30, 0.30),
        jr(-0.8, 0.8), jr(0, TAU), jr(-0.5, 0.5), jr(1.0, 1.35), jr(1.0, 1.35), 1, pick(FOLIAGE_PAL), root);
    }
    for (let b = 0; b < 12; b++) {
      pushInst('onsen_hflor', floretGeo, bm.whiteInst,
        -4.15 + jr(-0.28, 0.28), FL + 0.76 + jr(0, 0.35), -0.28 + jr(-0.26, 0.26),
        jr(0, 3), jr(0, 3), 0, jr(0.95, 1.3), jr(0.85, 1.2), jr(0.95, 1.3), pick(HYDRANGEA_PAL), root);
    }
    boxCol(-4.10, -0.30, 0.82, 0.72);
  }

  // Back-Right Raised Round Hinoki Tub under the Fuji Mural wave!
  {
    const rx = -0.62, rz = -2.92;
    add(box(1.52, 0.16, 1.48, wetSlateMat), rx, FL + 0.08, rz, 0, 0, 0, root);
    buildOvalHinokiTub(rx, rz, 0.66, 0.62, 0.62);
    addSquareAndon(rx + 0.46, FL + 0.64, rz + 0.34, 0.72);
  }

  // Secondary Smaller Foreground Cedar Footbath (x = -3.28, z = 0.86) + Bath Buckets & Floor Andon Lanterns!
  {
    const fx = -3.28, fz = 0.86, fw = 1.88, fd = 1.28, fh = 0.44, fr = 0.15;
    add(box(fw, fh, fr, bm.cedar), fx, FL + fh * 0.5, fz + fd * 0.5 - fr * 0.5, 0, 0, 0, root);
    add(box(fw, fh, fr, bm.cedar), fx, FL + fh * 0.5, fz - fd * 0.5 + fr * 0.5, 0, 0, 0, root);
    add(box(fr, fh, fd - fr * 2, bm.cedar), fx - fw * 0.5 + fr * 0.5, FL + fh * 0.5, fz, 0, 0, 0, root);
    add(box(fr, fh, fd - fr * 2, bm.cedar), fx + fw * 0.5 - fr * 0.5, FL + fh * 0.5, fz, 0, 0, 0, root);
    add(rbox(fw + 0.06, 0.08, 0.18, 0.02, bm.hinoki, 1), fx, FL + fh + 0.02, fz + fd * 0.5 - 0.08, 0, 0, 0, root);
    add(rbox(fw + 0.06, 0.08, 0.18, 0.02, bm.hinoki, 1), fx, FL + fh + 0.02, fz - fd * 0.5 + 0.08, 0, 0, 0, root);
    add(rbox(0.18, 0.08, fd + 0.06, 0.02, bm.hinoki, 1), fx - fw * 0.5 + 0.08, FL + fh + 0.02, fz, 0, 0, 0, root);
    add(rbox(0.18, 0.08, fd + 0.06, 0.02, bm.hinoki, 1), fx + fw * 0.5 - 0.08, FL + fh + 0.02, fz, 0, 0, 0, root);
    add(box(fw - 0.24, 0.04, fd - 0.24, richWaterMat), fx, FL + fh - 0.05, fz, 0, 0, 0, root);
    addSteamColumn(fx, FL + fh + 0.04, fz, 0.52, 0.34, 5, 0.80);
    boxCol(fx, fz, fw, fd);

    addWoodBucket(-4.12, FL, 1.72, 0.22, 0.24);
    addWoodBucket(-4.10, FL + 0.24, 1.70, 0.19, 0.22);
    addWoodBucket(-3.66, FL, 1.78, 0.18, 0.21);
    addSquareAndon(-4.36, FL, 2.15, 0.92);
    addSquareAndon(-2.12, FL, 1.38, 0.96);
  }

  // Woven Straw/Coir Welcome Mats inside the entry hall & archway!
  add(box(1.42, 0.024, 0.92, matWelcome), -0.04, FL + 0.022, 2.12, 0, 0.03, 0, root);
  add(box(1.22, 0.024, 0.78, matWelcome), 1.48, FL + 0.022, 0.22, 0, 0, 0, root);

  // --- RIGHT ROOM (`robe_hall`) ---
  {
    const archPts = [];
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * PI;
      archPts.push(new THREE.Vector3(0.55, 2.04 + Math.sin(a) * 0.84, 0.20 - Math.cos(a) * 0.84));
    }
    const archTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts), 20, 0.11, 8, false);
    add(new THREE.Mesh(archTube, bm.darkTimber), 0, 0, 0, 0, 0, 0, root);
    for (const sz of [-1, 1]) {
      add(box(0.24, 1.66, 0.14, bm.darkTimber), 0.55, FL + 0.83, 0.20 + sz * 0.85, 0, 0, 0, root);
    }
    addShojiBay({ cx: 0.55, cy: 1.85, cz: -1.35, rotY: PI * 0.5, w: 0.68, h: 1.72, cols: 2, rows: 5, parent: root });
  }

  // Gnarled Woody Wisteria Vine Arch + Cascading Purple 3D Wisteria Racemes + Secondary Purple ♨ Noren!
  {
    add(box(3.92, 0.12, 0.14, bm.darkTimber), 2.60, 2.74, -1.05, 0, 0, 0, root);
    const vineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.75, 2.72, -0.58),
      new THREE.Vector3(0.92, 2.86, 0.12),
      new THREE.Vector3(0.86, 2.74, 0.82),
      new THREE.Vector3(1.58, 2.80, 0.35),
      new THREE.Vector3(2.35, 2.78, -0.98),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(vineCurve, 22, 0.048, 6, false), bm.rafterWood), 0, 0, 0, 0, 0, 0, root);

    const leafGeo = () => { const g = new THREE.CircleGeometry(0.13, 6); g.scale(1, 1.4, 1); return g; };
    const wistCoords = [
      [0.84, 2.76, -0.42, 0.86],
      [0.92, 2.84, -0.10, 0.96],
      [0.88, 2.84, 0.22, 0.82],
      [0.90, 2.76, 0.56, 0.88],
      [1.26, 2.80, 0.36, 0.78],
      [1.48, 2.78, -0.22, 0.84],
      [1.76, 2.78, -0.96, 0.86],
      [1.28, 2.78, -0.98, 0.92],
    ];
    for (const [wx, wy, wz, wlen] of wistCoords) {
      addWisteriaRaceme(THREE, K, wx, wy, wz, wlen, root, 'onsen_wist');
      for (let k = 0; k < 5; k++) {
        pushInst('onsen_hleaf', leafGeo, bm.leafInst,
          wx + jr(-0.18, 0.18), wy + jr(-0.10, 0.08), wz + jr(-0.18, 0.18),
          jr(-0.8, 0.8), jr(0, TAU), jr(-0.6, 0.6), jr(0.9, 1.3), jr(0.9, 1.3), 1, pick(FOLIAGE_PAL), root);
      }
    }

    addNorenCurtain(THREE, K, {
      cx: 2.88,
      yTop: 2.68,
      z: -1.04,
      rotY: 0,
      width: 1.42,
      height: 0.78,
      panels: 3,
      texMap: bm.BT.norenOnsen,
      parent: root,
    });
  }

  const addFoldedYukataStack = (x, yBase, z, rotY = 0, mats = [yukataPlum, yukataLav, yukataPlum]) => {
    mats.forEach((ym, idx) => {
      const sy = yBase + 0.045 + idx * 0.088;
      add(rbox(0.38, 0.082, 0.34, 0.028, ym, 1), x, sy, z, 0, rotY + jr(-0.04, 0.04), 0, root);
      add(box(0.12, 0.088, 0.35, bm.goldTrim), x, sy, z, 0, rotY, 0, root);
    });
  };

  const buildYukataCubbyUnit = (cx, cz, rotY = 0) => {
    const g = new THREE.Group();
    g.position.set(cx, FL, cz);
    g.rotation.y = rotY;
    root.add(g);

    const sw = 1.28, sh = 2.08, sd = 0.48;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(box(0.075, sh, 0.075, bm.darkTimber), sx * (sw * 0.5 - 0.04), sh * 0.5, sz * (sd * 0.5 - 0.04), 0, 0, 0, g);
    }
    for (const sy of [0.06, 0.68, 1.32, 1.98]) {
      add(box(sw, 0.055, sd, bm.cedar), 0, sy, 0, 0, 0, 0, g);
    }
    add(box(0.045, 1.92, sd - 0.06, bm.cedar), 0, 1.02, 0, 0, 0, 0, g);
    add(rbox(sw - 0.18, 0.34, sd - 0.08, 0.04, wickerMat, 1), 0, 0.26, 0.01, 0, 0, 0, g);

    const c = Math.cos(rotY), sn = Math.sin(rotY);
    const toW = (lx, lz) => [cx + lx * c + lz * sn, cz - lx * sn + lz * c];
    const [b1x, b1z] = toW(-0.28, 0.02);
    const [b2x, b2z] = toW(0.28, 0.02);
    addFoldedYukataStack(b1x, FL + 0.43, b1z, rotY, [yukataPlum, yukataLav]);
    addFoldedYukataStack(b2x, FL + 0.43, b2z, rotY, [yukataCream, yukataCream]);
    addFoldedYukataStack(b1x, FL + 0.71, b1z, rotY, [yukataPlum, yukataPlum, yukataLav]);
    addFoldedYukataStack(b2x, FL + 0.71, b2z, rotY, [yukataLav, yukataPlum, yukataLav]);
    addFoldedYukataStack(b1x, FL + 1.35, b1z, rotY, [yukataPlum, yukataLav, yukataPlum]);
    addFoldedYukataStack(b2x, FL + 1.35, b2z, rotY, [yukataCream, yukataCream, yukataCream]);
  };

  buildYukataCubbyUnit(1.48, -3.32, 0);
  boxCol(1.48, -3.32, 1.32, 0.54);

  buildYukataCubbyUnit(0.94, -1.92, PI * 0.5);
  boxCol(0.94, -1.92, 0.54, 1.32);

  add(rbox(0.48, 0.08, 1.68, 0.02, bm.hinoki, 1), 4.24, FL + 0.42, -0.15, 0, 0, 0, root);
  for (const sz of [-0.66, 0.66]) {
    add(box(0.42, 0.42, 0.10, bm.darkTimber), 4.24, FL + 0.21, -0.15 + sz, 0, 0, 0, root);
  }
  boxCol(4.24, -0.15, 0.52, 1.72);
  addSquareAndon(4.18, FL, 2.38, 0.94);
  addSquareAndon(4.18, FL, -3.22, 0.90);

  // Merge all translucent steam puffs into ONE single transparent Mesh -> 1 draw call!
  if (steamGeos.length) {
    const mergedSteam = mergeGeometries(steamGeos, false);
    steamGeos.forEach((g) => g.dispose());
    const steamMesh = new THREE.Mesh(mergedSteam, softSteamMat);
    steamMesh.castShadow = false;
    steamMesh.receiveShadow = false;
    steamMesh.userData.noSolid = true;
    steamMesh.name = 'onsen_steam';
    root.add(steamMesh);
  }

  // ==========================================================================
  // 7. REQUIRED root.userData (ROOMS, DOORS, 10 PROP SLOTS, TUB SPOTS & HOOKS)
  // ==========================================================================
  root.userData.footprint = { w: 10.4, d: 9.2 };
  root.userData.rooms = [
    { name: 'fuji_bath', x: -2.00, z: -0.05, w: 5.10, d: 7.3, walkX: -0.55, walkZ: 0.45 }, // x ∈ [-4.55, 0.55]
    { name: 'robe_hall', x: 2.55, z: -0.05, w: 4.00, d: 7.3, walkX: 2.25, walkZ: 0.20 },  // x ∈ [0.55, 4.55]
  ];
  root.userData.door = { x: 0, z: 5.05 };
  root.userData.doorIn = { x: 0, z: 2.85 };
  root.userData.innerDoors = [{ x: 0.55, z: 0.2 }];

  root.userData.propSlots = [
    // Cluster 1: fuji_bath front-west wall bathing bay (clear of center slate aisle!)
    { id: 'bh_hinoki_tub', x: -3.75, y: FL, z: 2.32, rot: 0.35 },
    { id: 'bh_towel_basket', x: -2.72, y: FL, z: 2.38, rot: -0.45 },
    { id: 'bh_paper_lantern', x: -1.78, y: FL, z: 2.42, rot: 0.15 },
    // Cluster 2: fuji_bath north mural offering bay (clear of archway!)
    { id: 'bh_sake_cask', x: -0.95, y: FL, z: -2.75, rot: 0.28 },
    { id: 'bh_bonsai_pot', x: -1.85, y: FL, z: -2.95, rot: -0.55 },
    // Cluster 3: robe_hall north-east cubby & kimono corner (3 slots)
    { id: 'bh_towel_basket', x: 2.78, y: FL, z: -2.85, rot: 0.32 },
    { id: 'bh_towel_basket', x: 3.58, y: FL, z: -2.62, rot: -0.42 },
    { id: 'bh_daruma_doll', x: 3.42, y: FL, z: -1.78, rot: -0.75 },
    // Cluster 4: robe_hall south-east shoji lounge corner (2 slots)
    { id: 'bh_bonsai_pot', x: 3.55, y: FL, z: 1.92, rot: 2.35 },
    { id: 'bh_paper_lantern', x: 2.58, y: FL, z: 2.28, rot: 2.75 },
  ];

  root.userData.tubSpots = [
    { x: -3.15, y: 0.42, z: 3.55 },
    { x: 3.15, y: 0.42, z: 3.55 },
    { x: -2.6, y: 0.42, z: -1.6 },
  ];
  root.userData.wallHooks = [
    { x: -2.1, y: 2.45, z: 4.15, propId: 'bh_paper_lantern' },
    { x: 2.1, y: 2.45, z: 4.15, propId: 'bh_paper_lantern' },
  ];

  K.finalize();

  // Optimize instanced pan/barrel tiles & plinth stones to hit ~134k tris (65k-145k target!) with 100% Storybook crispness!
  const crispPanGeo = new THREE.BoxGeometry(0.30, 0.036, 0.44);
  const crispBrlGeo = new THREE.CylinderGeometry(0.145, 0.16, 0.44, 4, 1, true, 0, PI);
  crispBrlGeo.rotateX(PI * 0.5);
  const crispCapGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.06, 6);
  crispCapGeo.rotateX(PI * 0.5);
  const crispStoneGeo = new THREE.DodecahedronGeometry(0.28, 0);
  crispStoneGeo.scale(1.68, 0.86, 1.12);

  root.traverse((o) => {
    if (o.isInstancedMesh) {
      if (o.name.includes('_pan|')) o.geometry = crispPanGeo;
      if (o.name.includes('_brl|')) o.geometry = crispBrlGeo;
      if (o.name.includes('_cap|')) o.geometry = crispCapGeo;
      if (o.name.includes('plinth_blk|') || o.name.includes('step_cheek|')) o.geometry = crispStoneGeo;
      if (o.name.includes('_pan|') || o.name.includes('_brl|') || o.name.includes('_rcap|')) {
        o.material = verdigrisTileMat;
      }
    }
  });

  return root;
}
