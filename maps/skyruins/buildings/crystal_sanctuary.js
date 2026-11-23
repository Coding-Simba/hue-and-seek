// ============================================================================
// Celestia Sky-Ruins (Celestia) — Building 1: Crystal Sanctuary (Aether Observatory)
// Hand-sculpted 1:1 from Codex references ext_01.png & int_01.png.
// Features floating mossy island plinth (when garden !== false), twin cyan crystal
// obelisk lanterns, cream-travertine ashlar rotunda & vaulted apse side-wings,
// giant gnarled Celestian tree roots & towering sunlit green-gold Storybook canopy,
// turquoise-and-gold square-spiral rune frieze drum, cobalt/cyan stained-glass
// star-chart dome, giant golden-brass refractor telescope (metalness: 0!), and
// full 2-room cutaway interior (crystal_rotunda + stele_sanctum).
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  applyPlanarUVs,
  RoundedBoxGeometry,
} from '../../map_kit.js?v=2';
import {
  TRAVERTINE_PAL,
  CLIFF_ROCK_PAL,
  MOSS_PAL,
  WILDFLOWER_PAL,
  GOLD_TILE_PAL,
  sharedSkyGeo,
  getSkyMats,
  buildMossyIslandPlinth,
  buildCrystalObeliskLantern,
  buildFlutedColumn,
  buildGnarledRootTube,
  buildWisteriaRacemes,
  buildSkyglassCrystal,
} from '../sky_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

const CANOPY_SHADOW_PAL = [0x2e6123, 0x3b762b, 0x488932];
const CANOPY_MID_PAL = [0x589f36, 0x6db640, 0x82c848];
const CANOPY_SUN_PAL = [0xa4de4e, 0xc2ec5c, 0xdef56a, 0xf0fa80];
const BLOSSOM_BUSH_PAL = [0xdca2ff, 0xf5bde8, 0xc688f6, 0xfff0fb, 0xb274ea];
const BOOK_SPINE_PAL = [0xb84038, 0x2f5fa4, 0x3b8456, 0xd49638, 0x7a448c, 0x9e5634, 0x2c7d8c];

let _sanctuaryTexCache = null;

function getSanctuaryTextures(THREE) {
  if (_sanctuaryTexCache && _sanctuaryTexCache._T === THREE) return _sanctuaryTexCache;

  // 1. Sunlit Storybook Ancient Celestian Tree Bark (warm golden-cinnamon longitudinal bark ridges!)
  const gnarledBark = paintedCanvasTex(THREE, 'sr_sanc_gnarled_bark_v3', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#a4794e';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 280, ['#be9264', '#865e38', '#d2a676', '#704c2c'], 3, 9, 0.42, PI * 0.5, 0.32, 54);
    ctx.strokeStyle = 'rgba(68,42,20,0.46)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 22; i++) {
      const x = (i / 22) * s + rng.jr(-4, 4);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + rng.jr(-9, 9), s * 0.35, x + rng.jr(-9, 9), s * 0.70, x, s);
      ctx.stroke();
    }
    brushStrokes(ctx, s, rng, 50, ['#84b44e', '#9cc964'], 2, 5, 0.16);
  }, 2, 3);

  // 2. Crisp Turquoise & Gold Celestian Spiral-Glyph Frieze Band (matches ext_01.png drum!)
  const spiralFrieze = paintedCanvasTex(THREE, 'sr_sanc_spiral_frieze_v4', 512, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#167092');
    grd.addColorStop(0.5, '#26a8cc');
    grd.addColorStop(1, '#146282');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 180, ['#3bc4e4', '#1a7596', '#6ee8ff'], 4, 11, 0.32);

    ctx.fillStyle = '#eab84e';
    ctx.fillRect(0, 0, s, 50);
    ctx.fillRect(0, s - 50, s, 50);
    ctx.fillStyle = '#fde598';
    ctx.fillRect(0, 36, s, 10);
    ctx.fillRect(0, s - 46, s, 10);

    // Glowing cyan double-spiral & concentric Celestian rune medallions (4 per tile * rx=14 = 56 round glyphs!)
    const cells = 4, cw = s / cells, cy = s * 0.5;
    for (let i = 0; i < cells; i++) {
      const cx = (i + 0.5) * cw;
      ctx.strokeStyle = '#a6feff';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, cw * 0.34, 0, TAU); ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let t = 0; t <= 28; t++) {
        const f = t / 28;
        const a = f * TAU * 1.75;
        const r = f * cw * 0.26;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 1.45;
        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = '#e8ffff';
      ctx.beginPath(); ctx.arc(cx, cy, cw * 0.08, 0, TAU); ctx.fill();
    }
  }, 14, 1);

  // 3. Equirectangular Celestial Star-Chart Stained Glass for Hemisphere Dome (glowing cyan base -> royal cobalt zenith!)
  const domeEquirect = paintedCanvasTex(THREE, 'sr_sanc_dome_equirect_v3', 512, (ctx, s, rng) => {
    // Note: on SphereGeometry(phiLength=PI*0.49), v=1 is zenith (top) and v=0 is equator (horizon base)!
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0.0, '#12387e');
    grd.addColorStop(0.45, '#1e62be');
    grd.addColorStop(0.80, '#2ea4e6');
    grd.addColorStop(1.0, '#7ef6ff');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 220, ['#2978d4', '#184a98', '#52cef8', '#8cfaff'], 5, 16, 0.28);

    // Golden celestial latitude & ecliptic arcs
    ctx.strokeStyle = 'rgba(255,224,124,0.82)';
    ctx.lineWidth = 3.2;
    for (const yf of [0.24, 0.50, 0.74]) {
      ctx.beginPath(); ctx.moveTo(0, s * yf); ctx.lineTo(s, s * yf); ctx.stroke();
    }
    // Sinusoidal zodiac ecliptic wave & constellation lines
    ctx.beginPath();
    for (let x = 0; x <= s; x += 8) {
      const y = s * 0.55 + Math.sin((x / s) * TAU * 2) * (s * 0.16);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glowing cyan crystal silhouettes & twinkling stars along the lower stained-glass panes (matches ext_01!)
    for (let i = 0; i < 16; i++) {
      const bx = (i + 0.5) * (s / 16);
      const bh = rng.jr(42, 95);
      ctx.fillStyle = 'rgba(148,252,255,0.48)';
      ctx.beginPath();
      ctx.moveTo(bx - 12, s);
      ctx.lineTo(bx, s - bh);
      ctx.lineTo(bx + 12, s);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 95; i++) {
      const x = rng.jr(8, s - 8), y = rng.jr(14, s - 12), sr = rng.jr(1.8, 4.8);
      ctx.fillStyle = i % 3 === 0 ? '#fff6be' : '#bdfaff';
      ctx.beginPath(); ctx.arc(x, y, sr, 0, TAU); ctx.fill();
    }
  }, 1, 1);

  // 4. High-detail carved Celestian golden-sandstone stele relief (matches int_01.png!)
  const heroStele = paintedCanvasTex(THREE, 'sr_sanc_hero_stele_v3', 512, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#f5e2ae');
    grd.addColorStop(0.45, '#e6cc95');
    grd.addColorStop(1, '#cfb07a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 220, ['#fae9bc', '#d8bc86', '#caa970', '#f7e5b4'], 4, 12, 0.34);

    ctx.strokeStyle = '#8f6b38';
    ctx.lineWidth = 10;
    ctx.strokeRect(22, 22, s - 44, s - 44);
    ctx.strokeStyle = '#fae6b2';
    ctx.lineWidth = 4;
    ctx.strokeRect(32, 32, s - 64, s - 64);

    const cx = s * 0.5, topY = s * 0.25;
    ctx.strokeStyle = '#8c6732';
    ctx.lineWidth = 7;
    for (const r of [32, 62, 92]) {
      ctx.beginPath(); ctx.arc(cx, topY, r, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#fce89c';
    ctx.beginPath(); ctx.arc(cx, topY, 20, 0, TAU); ctx.fill();

    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * 42, topY);
      ctx.quadraticCurveTo(cx + sx * 125, topY - 46, cx + sx * 178, topY - 16);
      ctx.quadraticCurveTo(cx + sx * 135, topY + 28, cx + sx * 42, topY + 18);
      ctx.stroke();
    }

    for (let row = 0; row < 4; row++) {
      const y = s * (0.48 + row * 0.115);
      for (let col = 0; col < 4; col++) {
        const x = s * (0.20 + col * 0.20);
        ctx.strokeStyle = '#8a6530';
        ctx.lineWidth = 5;
        ctx.strokeRect(x - 28, y - 20, 56, 40);
        ctx.strokeRect(x - 14, y - 9, 28, 18);
        ctx.fillStyle = '#faebb8';
        ctx.fillRect(x - 5, y - 4, 10, 8);
      }
    }
  }, 1, 1);

  // 5. Warm radial travertine flagstone paving for interior sanctum & rotunda surround
  const warmFlagstone = paintedCanvasTex(THREE, 'sr_sanc_flagstone_v3', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#eadac0';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 200, ['#f5e8d0', '#d8c5a6', '#e4d3b6', '#fbf1de'], 5, 14, 0.34);
    const rows = 5, rh = s / rows;
    ctx.strokeStyle = 'rgba(116,92,62,0.34)';
    ctx.lineWidth = 2.2;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      const cols = 4, cw = s / cols, off = (r % 2) * cw * 0.5;
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + off;
        ctx.fillStyle = rng.pick(['rgba(255,248,232,0.20)', 'rgba(198,176,144,0.18)']);
        ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rh); ctx.stroke();
      }
    }
  }, 3, 3);

  _sanctuaryTexCache = { _T: THREE, gnarledBark, spiralFrieze, domeEquirect, heroStele, warmFlagstone };
  return _sanctuaryTexCache;
}

export function buildCrystalSanctuary(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'crystal_sanctuary', 11);
  // Provide K.box so sky_kit helpers (buildMossyIslandPlinth) work seamlessly
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const {
    root, roofG, add, rbox, wall, boxCol, pushInst, pushInstMatrix, jr, pick, M, G, tex,
  } = K;

  const sm = getSkyMats(THREE, K);
  const stx = getSanctuaryTextures(THREE);
  const showGarden = opts.garden !== false;
  const isLit = opts.lit !== false;

  // Consolidated Storybook materials (100% metalness: 0, minimal material count so draw calls stay <= 52!)
  const sunlitBarkMat = M(0xffffff, stx.gnarledBark, { roughness: 0.88, metalness: 0 });
  const spiralDrumMat = M(0xffffff, stx.spiralFrieze, {
    roughness: 0.50,
    metalness: 0,
    emissive: new THREE.Color(0x0f5d7a),
    emissiveIntensity: 0.40,
    side: THREE.DoubleSide,
  });
  const domeGlassMat = M(0xffffff, stx.domeEquirect, {
    roughness: 0.28,
    metalness: 0,
    emissive: new THREE.Color(0x1d68bc),
    emissiveIntensity: 0.46,
    side: THREE.DoubleSide,
  });
  // Luminance-preserving sunlit golden-brass (never multiplies dark with painted_metal; metalness: 0!)
  const brightBrassMat = G(0xffcb52, tex('painted_metal', 1.2, 1.2), 0.44, 0.42, {
    roughness: 0.40,
    metalness: 0,
    emissive: new THREE.Color(0x684008),
    emissiveIntensity: 0.30,
  });
  const warmBronzeMat = G(0xd49234, tex('painted_metal', 1.2, 1.2), 0.44, 0.46, {
    roughness: 0.46,
    metalness: 0,
    emissive: new THREE.Color(0x4a2804),
    emissiveIntensity: 0.28,
  });
  const heroSteleMat = M(0xffffff, stx.heroStele, { roughness: 0.80, metalness: 0 });
  const flagstoneMat = M(0xffffff, stx.warmFlagstone, { roughness: 0.86, metalness: 0 });
  const darkSlotMat = M(0x182640, tex('painted_metal', 1.2, 1.2), { roughness: 0.72, metalness: 0, side: THREE.DoubleSide });

  const styleBark = (m) => { if (m && m.isMesh) m.material = sunlitBarkMat; return m; };

  // World-space radial stone arch voussoir helper (1 single InstancedMesh batch, zero local-parent offset bugs!)
  const vGeoFn = () => sharedSkyGeo(THREE, 'sr_voussoir', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
  const _archGrpM = new THREE.Matrix4();
  const _archLocM = new THREE.Matrix4();
  const _archQ = new THREE.Quaternion();
  const _archE = new THREE.Euler();
  const _archP = new THREE.Vector3();
  const _archS = new THREE.Vector3();

  const addWorldStoneArch = ({
    cx, cy, cz, rotY = 0, radius = 0.96, thickness = 0.18, depth = 0.32,
    segments = 9, cutY = 2.68,
  }) => {
    _archGrpM.makeRotationY(rotY).setPosition(cx, cy, cz);
    for (let i = 0; i < segments; i++) {
      const isKey = i === Math.floor(segments * 0.5);
      const a = -PI * 0.5 + ((i + 0.5) / segments) * PI;
      const vx = Math.sin(a) * radius;
      const vy = Math.cos(a) * radius;
      _archP.set(vx, vy, 0);
      _archE.set(0, 0, -a);
      _archQ.setFromEuler(_archE);
      const outerArcW = (PI * (radius + thickness * 0.5)) / segments;
      _archS.set(
        outerArcW * 1.12,
        thickness * (isKey ? 1.26 : 1.0),
        depth * (isKey ? 1.12 : 1.0)
      );
      _archLocM.compose(_archP, _archQ, _archS).premultiply(_archGrpM);
      const worldY = cy + vy;
      pushInstMatrix(
        'sanc_vs_world',
        vGeoFn,
        sm.stoneInst,
        _archLocM,
        isKey ? 0xf8edd6 : pick(TRAVERTINE_PAL),
        worldY > cutY ? roofG : root
      );
    }
  };

  // ==========================================================================
  // 1. FLOATING ISLAND FOUNDATION PLINTH + STEPS + TWIN CYAN OBELISK LANTERNS
  // ==========================================================================
  const plinthInfo = buildMossyIslandPlinth(THREE, K, {
    w: 10.4,
    d: 8.4,
    h: 0.32,
    doorX: 0,
    doorZ: 3.76,
    doorW: 2.28,
    steps: 3,
    garden: showGarden,
    obelisks: true,
    parent: root,
    batchPrefix: 'sanc',
  });
  const FL = plinthInfo.floorY; // 0.34m

  // Circular golden relief medallions on the twin front obelisk stone pedestals (`ext_01.png`!)
  for (const sx of [-1, 1]) {
    const ox = sx * (2.28 * 0.5 + 0.42);
    const oz = 3.76 + 0.38;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 16), brightBrassMat), ox, 0.42, oz + 0.24, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 14), sm.brassDeep), ox, 0.42, oz + 0.23, PI * 0.5, 0, 0, root);
  }

  // Third smaller cyan crystal obelisk lantern on the left curved terrace rim (`int_01.png`!)
  buildCrystalObeliskLantern(THREE, K, {
    x: -4.32, y: FL - 0.02, z: 2.15, scale: 0.72, parent: root,
  });

  // Craggy faceted limestone cliff rim, lush moss & flower drifts, wisteria & spring pools in standalone gallery mode!
  if (showGarden) {
    buildWisteriaRacemes(THREE, K, {
      cx: -0.68, yTop: FL + 0.04, cz: 4.35,
      spanX: 1.08, strands: 7, maxLen: 0.95, parent: root, batchPrefix: 'sanc',
    });
    buildWisteriaRacemes(THREE, K, {
      cx: -4.25, yTop: FL + 0.06, cz: 2.95,
      spanX: 1.12, strands: 6, maxLen: 0.92, rotY: 0.52, parent: root, batchPrefix: 'sanc',
    });

    const flwGeo = () => sharedSkyGeo(THREE, 'sr_wildflower', () => new THREE.DodecahedronGeometry(0.085, 0));
    const cragGeo = () => sharedSkyGeo(THREE, 'sr_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    // Sculpted angular travertine cliff-edge blocks & mossy cushions masking the gallery ground plane seam!
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * PI * 1.18 - PI * 0.09; // wrap around front, left, and right rim
      const rx = 5.48 + jr(-0.18, 0.22), rz = 4.42 + jr(-0.18, 0.22);
      const bx = Math.cos(a) * rx, bz = Math.sin(a) * rz;
      if (bz > 3.2 && Math.abs(bx) < 1.85) continue; // keep staircase clear!
      pushInst('sanc_ash', cragGeo, sm.stoneInst,
        bx, 0.18 + jr(-0.04, 0.06), bz,
        jr(-0.12, 0.12), -a + jr(-0.2, 0.2), jr(-0.12, 0.12),
        jr(0.55, 0.92), jr(0.32, 0.48), jr(0.48, 0.78), pick(CLIFF_ROCK_PAL), root);
      pushInst('sanc_flw', flwGeo, sm.foliageInst,
        bx * 0.96, FL + 0.08, bz * 0.96,
        0, jr(0, TAU), 0, jr(2.4, 3.8), jr(1.2, 1.8), jr(2.4, 3.8), pick(MOSS_PAL), root);
      if (i % 2 === 0) {
        for (let k = 0; k < 3; k++) {
          pushInst('sanc_flw', flwGeo, sm.foliageInst,
            bx * 0.95 + jr(-0.26, 0.26), FL + 0.22 + jr(0, 0.08), bz * 0.95 + jr(-0.26, 0.26),
            jr(0, TAU), jr(0, TAU), 0, jr(1.0, 1.45), jr(0.8, 1.15), jr(1.0, 1.45),
            pick(WILDFLOWER_PAL), root);
        }
      }
    }
    // Organic curving turquoise spring streams & frothy foam pebbles at the twin front-side waterfalls!
    for (const sx of [-1, 1]) {
      const fx = sx * (10.4 * 0.37);
      const fallCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(fx, FL + 0.02, 3.88),
        new THREE.Vector3(fx + sx * 0.05, FL - 0.02, 4.28),
        new THREE.Vector3(fx + sx * 0.08, 0.10, 4.54),
        new THREE.Vector3(fx + sx * 0.08, -0.35, 4.62),
      ]);
      const streamGeo = new THREE.TubeGeometry(fallCurve, 12, 0.16, 8, false);
      streamGeo.scale(1.35, 0.52, 1.0);
      add(new THREE.Mesh(streamGeo, sm.waterGlow), 0, 0, 0, 0, 0, 0, root);
      for (let m = 0; m < 7; m++) {
        pushInst('sanc_flw', flwGeo, sm.foliageInst,
          fx + jr(-0.22, 0.22), 0.10 + jr(0, 0.16), 4.46 + jr(-0.14, 0.14),
          jr(0, TAU), jr(0, TAU), 0, jr(1.2, 1.9), jr(0.8, 1.2), jr(1.2, 1.9), 0xdffcff, root);
      }
    }
  }

  // Curved cream-travertine terrace aprons under the left & right rounded apse wings
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(
      new THREE.CylinderGeometry(2.22, 2.36, 0.33, 18),
      sm.travertine
    ), sx * 2.95, 0.175, -0.10, 0, 0, 0, root);
  }

  // Interior Floor: Warm flagstone across whole interior + 16-point Compass-Rose Mosaic in crystal_rotunda!
  const mainFloor = add(rbox(9.25, 0.05, 6.88, 0.02, flagstoneMat, 1), 0.0, FL + 0.005, -0.12, 0, 0, 0, root);
  mainFloor.userData.ground = true;

  add(rbox(2.58, 0.052, 1.36, 0.02, sm.travertinePlain, 1), 0, FL + 0.008, 3.38, 0, 0, 0, root);

  // Grand Circular 16-Point Compass-Rose Mosaic Floor in crystal_rotunda (cx = -1.55, cz = -0.15)
  const ROT_CX = -1.55;
  const ROT_CZ = -0.15;
  {
    const mosaicDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.26, 2.26, 0.034, 40), sm.compassMosaic);
    add(mosaicDisc, ROT_CX, FL + 0.018, ROT_CZ, 0, 0, 0, root);

    const outerGoldRing = new THREE.TorusGeometry(2.28, 0.038, 6, 40);
    outerGoldRing.rotateX(PI * 0.5);
    add(new THREE.Mesh(outerGoldRing, brightBrassMat), ROT_CX, FL + 0.030, ROT_CZ, 0, 0, 0, root);

    const stoneRimGeo = () => sharedSkyGeo(THREE, 'sr_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    const nKerb = 34;
    for (let i = 0; i < nKerb; i++) {
      const a = (i / nKerb) * TAU;
      pushInst('sanc_ash', stoneRimGeo, sm.stoneInst,
        ROT_CX + Math.cos(a) * 2.41, FL + 0.020, ROT_CZ + Math.sin(a) * 2.41,
        0, -a + PI * 0.5, 0, 0.40, 0.036, 0.22,
        i % 2 === 0 ? TRAVERTINE_PAL[0] : GOLD_TILE_PAL[0], root);
    }
  }

  // ==========================================================================
  // 2. REUSABLE LANCET STAINED-GLASS WINDOW & ASHLAR WALL HELPERS
  // ==========================================================================
  const addArchedLancetWindow = ({
    cx, y0 = FL + 0.44, cz, rotY = 0, w = 0.78, h = 1.36, depth = 0.28,
    doubleSided = true, parent = root,
  }) => {
    const wg = new THREE.Group();
    wg.position.set(cx, y0, cz);
    wg.rotation.y = rotY;
    parent.add(wg);

    const rArch = w * 0.5;
    const rectH = Math.max(0.30, h - rArch);

    const paneShape = new THREE.Shape();
    paneShape.moveTo(-rArch, 0);
    paneShape.lineTo(rArch, 0);
    paneShape.lineTo(rArch, rectH);
    paneShape.absarc(0, rectH, rArch, 0, PI, false);
    paneShape.lineTo(-rArch, 0);

    const paneGeo = new THREE.ShapeGeometry(paneShape, 14);
    const pAttr = paneGeo.attributes.position;
    const uvs = new Float32Array(pAttr.count * 2);
    for (let i = 0; i < pAttr.count; i++) {
      uvs[i * 2] = (pAttr.getX(i) + rArch) / Math.max(0.01, w);
      uvs[i * 2 + 1] = pAttr.getY(i) / Math.max(0.01, h);
    }
    paneGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    add(new THREE.Mesh(paneGeo, sm.starDome), 0, 0, 0.015, 0, 0, 0, wg);
    if (doubleSided) {
      add(new THREE.Mesh(paneGeo, sm.cyanSoft), 0, 0, -0.02, 0, 0, 0, wg);
    }

    add(rbox(w + 0.24, 0.11, depth + 0.12, 0.025, sm.travertineDark, 1), 0, -0.05, 0, 0, 0, 0, wg);
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.076, rectH, 10), sm.travertinePlain),
        sx * (rArch + 0.062), rectH * 0.5, depth * 0.30, 0, 0, 0, wg);
      if (doubleSided) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, rectH, 8), sm.travertinePlain),
          sx * (rArch + 0.056), rectH * 0.5, -depth * 0.30, 0, 0, 0, wg);
      }
    }

    // Golden-brass mullion crossbars + circular astrolabe ring inside the lancet!
    add(rbox(0.028, h - 0.05, 0.06, 0.008, brightBrassMat, 1), 0, h * 0.48, 0.01, 0, 0, 0, wg);
    add(rbox(w - 0.04, 0.028, 0.06, 0.008, brightBrassMat, 1), 0, rectH * 0.52, 0.01, 0, 0, 0, wg);
    add(rbox(w - 0.04, 0.028, 0.06, 0.008, brightBrassMat, 1), 0, rectH, 0.01, 0, 0, 0, wg);
    add(new THREE.Mesh(new THREE.TorusGeometry(rArch * 0.60, 0.018, 6, 18), brightBrassMat), 0, rectH, 0.02, 0, 0, 0, wg);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), sm.cyanCrystal), 0, rectH, 0.02, 0, 0, 0, wg);

    // World-space radial stone arch voussoir ring (zero stray local group instances!)
    addWorldStoneArch({
      cx, cy: y0 + rectH, cz, rotY,
      radius: rArch + 0.085, thickness: 0.15, depth: depth + 0.06,
      segments: 9, cutY: 2.75,
    });
    return wg;
  };

  const addFacetedWallBay = ({
    cx, cz, rotY, len, y0 = FL, y1 = 2.62, th = 0.28,
    hasWindow = false, winW = 0.78, winH = 1.36, winY0 = FL + 0.42,
    ashlarOut = true, recordCol = true,
  }) => {
    const H = y1 - y0;
    const opens = hasWindow
      ? [{ u: 0, y0: winY0 - y0, w: winW, h: winH - winW * 0.40 }]
      : [];
    const wg = wall(cx, cz, rotY, len, H, th, opens, sm.travertine, sm.travertine, root, false);
    wg.position.y = y0;

    if (recordCol) {
      const c = Math.cos(rotY), sn = Math.sin(rotY);
      boxCol(cx - (th * 0.5) * sn, cz - (th * 0.5) * c, len, th, rotY);
    }

    if (hasWindow) {
      const c = Math.cos(rotY), sn = Math.sin(rotY);
      addArchedLancetWindow({
        cx: cx - (th * 0.45) * sn, y0: winY0, cz: cz - (th * 0.45) * c,
        rotY, w: winW, h: winH, depth: th, doubleSided: true, parent: root,
      });
    }

    if (ashlarOut) {
      const stoneGeo = () => sharedSkyGeo(THREE, 'sr_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
      const rows = 5;
      const c = Math.cos(rotY), sn = Math.sin(rotY);
      for (let r = 0; r < rows; r++) {
        const y = y0 + (r + 0.5) * (H / rows);
        const cols = Math.max(2, Math.round(len / 0.60));
        for (let col = 0; col < cols; col++) {
          const u = -len * 0.5 + (col + 0.5) * (len / cols);
          if (hasWindow && Math.abs(u) < winW * 0.62 && y > winY0 - 0.10 && y < winY0 + winH + 0.14) continue;
          const lz = 0.025 + jr(-0.01, 0.01);
          const wx = cx + u * c + lz * sn;
          const wz = cz - u * sn + lz * c;
          const hex = jr(0, 1) < 0.14 ? pick(MOSS_PAL) : pick(TRAVERTINE_PAL);
          pushInst('sanc_ash', stoneGeo, sm.stoneInst,
            wx, y, wz, 0, rotY, 0, (len / cols) - 0.035, (H / rows) - 0.028, 0.08, hex, root);
        }
      }
    }
  };

  // ==========================================================================
  // 3. LOWER EXTERIOR SHELL: ROTUNDA, LEFT & RIGHT VAULTED WINGS & FRONT PORTAL
  //    Side-wings sit at y = 2.60m so their stone apse roofs tuck CLEANLY UNDER
  //    the unbroken Turquoise & Gold Rune Frieze Drum (y = 2.92..3.54m)!
  // ==========================================================================
  const ROT_WALL_TOP = 2.86;
  const WING_WALL_TOP = 2.58;
  const CZ_ROT = -0.15;

  // --- A. Back Curved Rotunda Arc strictly inside `crystal_rotunda` (x <= 1.05!) ---
  const backRotBays = [
    { cx: -2.42, cz: -3.02, rotY: -PI * 0.80, len: 1.72, win: true, w: 0.92, h: 1.68 },
    { cx: -0.92, cz: -3.48, rotY: -PI * 0.94, len: 1.66, win: true, w: 1.04, h: 1.78 },
    { cx: 0.48, cz: -3.48, rotY: PI * 0.96, len: 1.36, win: true, w: 0.86, h: 1.64 },
  ];
  backRotBays.forEach((b) => {
    addFacetedWallBay({
      cx: b.cx, cz: b.cz, rotY: b.rotY, len: b.len, y0: FL, y1: ROT_WALL_TOP, th: 0.28,
      hasWindow: b.win, winW: b.w, winH: b.h, winY0: FL + 0.34,
      ashlarOut: true, recordCol: true,
    });
  });

  for (const [px, pz] of [[-3.02, -2.35], [-1.68, -3.12], [-0.18, -3.18]]) {
    buildFlutedColumn(THREE, K, {
      x: px, y0: FL, z: pz, height: 2.46, radius: 0.18, goldRings: true, parent: root,
    });
  }

  // --- B. Left Vaulted Stone Apse Wing (-X side, eave at y = 2.58m!) ---
  const leftApseBays = [
    { cx: -3.15, cz: 2.32, rotY: -0.38, len: 1.82, win: true },
    { cx: -4.24, cz: 1.22, rotY: -1.12, len: 1.66, win: true },
    { cx: -4.48, cz: -0.24, rotY: -PI * 0.5, len: 1.60, win: false },
    { cx: -3.88, cz: -1.78, rotY: -2.14, len: 1.86, win: true },
  ];
  leftApseBays.forEach((b) => {
    addFacetedWallBay({
      cx: b.cx, cz: b.cz, rotY: b.rotY, len: b.len, y0: FL, y1: WING_WALL_TOP, th: 0.28,
      hasWindow: b.win, winW: 0.78, winH: 1.36, winY0: FL + 0.40,
      ashlarOut: true, recordCol: true,
    });
  });
  for (const [px, pz] of [[-2.40, 2.68], [-3.82, 1.94], [-4.52, 0.52]]) {
    buildFlutedColumn(THREE, K, {
      x: px, y0: FL, z: pz, height: 2.22, radius: 0.16, goldRings: true, parent: root,
    });
  }

  // --- C. Right Vaulted Stone Wing (`stele_sanctum`, eave at y = 2.58m!) ---
  addFacetedWallBay({
    cx: 2.86, cz: -3.38, rotY: PI, len: 3.68, y0: FL, y1: WING_WALL_TOP + 0.12, th: 0.28,
    hasWindow: false, ashlarOut: true, recordCol: true,
  });
  const rightApseBays = [
    { cx: 4.52, cz: -2.28, rotY: PI * 0.52, len: 2.15, win: false },
    { cx: 4.56, cz: -0.32, rotY: PI * 0.5, len: 1.82, win: true },
    { cx: 4.22, cz: 1.24, rotY: 1.06, len: 1.78, win: true },
    { cx: 2.98, cz: 2.38, rotY: 0.36, len: 1.92, win: true },
    { cx: 1.60, cz: 2.92, rotY: 0.08, len: 1.24, win: false },
  ];
  rightApseBays.forEach((b) => {
    addFacetedWallBay({
      cx: b.cx, cz: b.cz, rotY: b.rotY, len: b.len, y0: FL, y1: WING_WALL_TOP, th: 0.28,
      hasWindow: b.win, winW: 0.78, winH: 1.36, winY0: FL + 0.40,
      ashlarOut: true, recordCol: true,
    });
  });
  for (const [px, pz] of [[2.20, 2.74], [3.76, 1.92], [4.56, 0.48], [4.56, -3.22]]) {
    buildFlutedColumn(THREE, K, {
      x: px, y0: FL, z: pz, height: 2.22, radius: 0.16, goldRings: true, parent: root,
    });
  }

  // Moulded stone cornice collars along both side-wing eaves (y = 2.56m)
  add(rbox(2.15, 0.10, 0.34, 0.02, sm.travertineWarm, 1), -3.15, WING_WALL_TOP - 0.02, 2.32, 0, -0.38, 0, root);
  add(rbox(2.25, 0.10, 0.34, 0.02, sm.travertineWarm, 1), 2.98, WING_WALL_TOP - 0.02, 2.38, 0, 0.36, 0, root);

  // --- D. Interior Arched Stone Partition Wall (`x = 1.05`, clear doorway w = 1.82m at z = 0.10!) ---
  {
    const partLen = 6.52;
    const partG = wall(
      1.05 + 0.13, 0.10, PI * 0.5, partLen, WING_WALL_TOP - FL + 0.08, 0.26,
      [{ door: true, arch: true, u: 0, w: 1.82, h: 2.24 }],
      sm.travertine, sm.travertine, root, true
    );
    partG.position.y = FL;

    addWorldStoneArch({
      cx: 1.05, cy: FL + 1.32, cz: 0.10, rotY: PI * 0.5,
      radius: 0.96, thickness: 0.18, depth: 0.32, segments: 11, cutY: 2.70,
    });
    add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), sm.cyanCrystal),
      0.86, FL + 2.28, 0.10, 0, 0, 0, root);

    buildFlutedColumn(THREE, K, {
      x: 1.05, y0: FL, z: 3.04, height: 2.36, radius: 0.21, goldRings: true, parent: root,
    });
    buildFlutedColumn(THREE, K, {
      x: 1.05, y0: FL, z: -3.08, height: 2.36, radius: 0.20, goldRings: true, parent: root,
    });
  }

  // --- E. Grand Front Arched Portal (`x = 0, z = 3.56`, clear doorway width = 1.92m >= 1.8m!) ---
  {
    const cheekL = wall(-1.84, 3.08, -0.22, 1.32, ROT_WALL_TOP - FL, 0.28, [], sm.travertine, sm.travertine, root, true);
    cheekL.position.y = FL;
    const cheekR = wall(1.56, 3.10, 0.18, 0.92, ROT_WALL_TOP - FL, 0.28, [], sm.travertine, sm.travertine, root, true);
    cheekR.position.y = FL;

    const portalW = 3.16;
    const doorW = 1.92;
    const portalG = wall(
      0, 3.58, 0, portalW, ROT_WALL_TOP - FL, 0.42,
      [{ door: true, arch: true, u: 0, w: doorW, h: 2.36 }],
      sm.travertine, sm.travertine, root, true
    );
    portalG.position.y = FL;

    for (const sx of [-1, 1]) {
      const px = sx * 1.25;
      add(rbox(0.60, 0.20, 0.54, 0.03, sm.travertineDark, 1), px, FL + 0.10, 3.52, 0, 0, 0, root);
      add(rbox(0.46, 1.66, 0.44, 0.03, sm.travertinePlain, 1), px, FL + 1.03, 3.52, 0, 0, 0, root);
      for (const fx of [-0.13, 0, 0.13]) {
        add(rbox(0.042, 1.48, 0.05, 0.01, sm.travertineDark, 1), px + fx, FL + 1.03, 3.73, 0, 0, 0, root);
      }
      add(rbox(0.58, 0.12, 0.52, 0.025, brightBrassMat, 1), px, FL + 1.92, 3.52, 0, 0, 0, root);
      add(rbox(0.64, 0.16, 0.58, 0.03, sm.travertineWarm, 1), px, FL + 2.06, 3.54, 0, 0, 0, root);
    }

    // Multi-ring Portal Arch: Turquoise Rune Tympanum + Golden Archivolts + Full Radial Stone Voussoir Arch!
    const archSpringY = FL + 1.42; // 1.76m
    add(new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.13, 8, 28, PI), spiralDrumMat),
      0, archSpringY, 3.48, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.038, 6, 26, PI), brightBrassMat),
      0, archSpringY, 3.54, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.034, 6, 28, PI), brightBrassMat),
      0, archSpringY, 3.54, 0, 0, 0, root);

    // Complete 15-wedge interlocking travertine stone portal arch (in world space!)
    addWorldStoneArch({
      cx: 0, cy: archSpringY, cz: 3.50, rotY: 0,
      radius: 1.30, thickness: 0.26, depth: 0.50,
      segments: 15, cutY: 2.88,
    });

    // Glowing cyan Aether orb in the turquoise arch tympanum (`ext_01.png`!)
    add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 16), brightBrassMat), 0, archSpringY + 1.05, 3.60, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), sm.cyanCrystal), 0, archSpringY + 1.05, 3.62, 0, 0, 0, root);

    // Ornate Golden-Brass Astrolabe Lattice Filigree in the Upper Portal Transom (y > 2.02m -> full headroom!)
    add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.024, 6, 20), brightBrassMat), 0, FL + 2.02, 3.36, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 6, 16), brightBrassMat), 0, FL + 2.02, 3.36, 0, 0, 0, root);
    add(rbox(1.76, 0.030, 0.032, 0.008, brightBrassMat, 1), 0, FL + 1.98, 3.36, 0, 0, 0, root);
    for (const sx of [-1, 1]) {
      add(rbox(0.044, 1.96, 0.044, 0.01, brightBrassMat, 1), sx * 0.91, FL + 1.00, 3.38, 0, 0, 0, root);
    }
  }

  // ==========================================================================
  // 4. LOWER GNARLED CELESTIAN TREE ROOTS HUGGING STONE FLANKS (<= 2.65m in `root`)
  //    Tapered root tendrils & seamless overlap joints with upper boughs in `roofG`!
  // ==========================================================================
  {
    // Joint 1: [-3.12, 2.62, 1.82] (r = 0.29) — meets upper sweeping main S-trunk seamlessly!
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-2.24, 0.18, 3.92],
        [-1.96, 0.86, 3.58],
        [-2.06, 1.62, 3.18],
        [-2.58, 2.22, 2.58],
        [-3.12, 2.62, 1.82],
      ],
      rStart: 0.40, rEnd: 0.29, mossy: true, parent: root, batchPrefix: 'sanc',
    }));
    // Secondary root flare branching off the main left trunk down to the front-left mossy rim!
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-3.45, 0.16, 3.72],
        [-2.82, 0.72, 3.38],
        [-2.35, 1.38, 3.05],
        [-2.52, 2.02, 2.62],
      ],
      rStart: 0.28, rEnd: 0.16, mossy: true, parent: root, batchPrefix: 'sanc',
    }));
    // Joint 2: [-3.88, 2.62, 1.35] (r = 0.24)
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-4.92, 0.18, 1.85],
        [-4.76, 0.96, 1.15],
        [-4.52, 1.82, 1.18],
        [-3.88, 2.62, 1.35],
      ],
      rStart: 0.34, rEnd: 0.24, mossy: true, parent: root, batchPrefix: 'sanc',
    }));
    // Joint 3: [-3.68, 2.62, -2.02] (r = 0.34)
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-4.52, 0.18, -2.35],
        [-4.24, 1.08, -2.72],
        [-3.96, 1.92, -2.45],
        [-3.68, 2.62, -2.02],
      ],
      rStart: 0.42, rEnd: 0.34, mossy: true, parent: root, batchPrefix: 'sanc',
    }));

    // Right flank gnarled roots: Joint 4 at [2.98, 2.60, 1.92] (r = 0.24) & tapered rootlets!
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [2.32, 0.18, 3.82],
        [2.00, 0.88, 3.42],
        [2.06, 1.65, 2.98],
        [2.48, 2.22, 2.48],
        [2.98, 2.60, 1.92],
      ],
      rStart: 0.35, rEnd: 0.24, mossy: true, parent: root, batchPrefix: 'sanc',
    }));
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [3.62, 0.16, 3.38],
        [3.42, 0.82, 2.82],
        [3.78, 1.56, 2.25],
        [4.28, 2.18, 1.62],
        [4.38, 2.58, 0.78],
      ],
      rStart: 0.28, rEnd: 0.18, mossy: true, parent: root, batchPrefix: 'sanc',
    }));
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [4.88, 0.18, 1.52],
        [4.82, 1.02, 0.45],
        [4.76, 1.88, -0.75],
        [4.48, 2.56, -1.78],
      ],
      rStart: 0.30, rEnd: 0.18, mossy: true, parent: root, batchPrefix: 'sanc',
    }));

    // Lush mossy ivy clusters hugging portal pilasters & root joints (uses existing sanc_flw batch -> 0 extra draw calls!)
    const ivyGeo = () => sharedSkyGeo(THREE, 'sr_wildflower', () => new THREE.DodecahedronGeometry(0.085, 0));
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 14; k++) {
        const t = k / 13;
        pushInst('sanc_flw', ivyGeo, sm.foliageInst,
          sx * (1.55 + jr(-0.10, 0.12)), 1.35 + t * 1.35, 3.55 + jr(-0.12, 0.12),
          jr(0, TAU), jr(0, TAU), 0, jr(1.4, 2.2), jr(1.1, 1.7), jr(1.2, 1.8), pick(MOSS_PAL), root);
      }
    }
  }

  // ==========================================================================
  // 5. UPPER ROOF GROUP (`K.roofG`): LOW APSE VAULT CAPS, UNBROKEN RUNE FRIEZE DRUM,
  //    STAR-CHART DOME, GIANT BRASS TELESCOPE & MULTI-TIERED SUNLIT TREE CROWN!
  //    (Everything above y = 2.62m goes in `roofG` so `mode=interiors` is 100% clear!)
  // ==========================================================================
  {
    // --- A. Low Ribbed Stone-Shingled Apse Roofs on Left & Right Wings (tucking cleanly under y = 2.94m Drum!) ---
    const roofSlabGeo = () => sharedSkyGeo(THREE, 'sr_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    const apseShinglePal = [0x9aa8b4, 0xaab6bf, 0x8b99a6, 0xb8c2c8];
    for (const sx of [-1, 1]) {
      const apseGeo = new THREE.SphereGeometry(2.08, 20, 10, 0, TAU, 0, PI * 0.44);
      apseGeo.scale(0.98, 0.24, 1.38);
      applyPlanarUVs(apseGeo, 0.48);
      add(new THREE.Mesh(apseGeo, sm.travertine), sx * 2.86, 2.54, 0.02, 0, 0, 0, roofG);

      // Concentric courses of 3D sculpted limestone-slate roof shingles over both side-wing apse domes!
      for (let ring = 0; ring < 4; ring++) {
        const rf = 0.42 + (ring / 3) * 0.54;
        const rx = 2.02 * rf, rz = 2.82 * rf;
        const ry = 2.56 + Math.sqrt(Math.max(0, 1 - rf * rf)) * 0.48;
        const nSlabs = 10 + ring * 3;
        for (let k = 0; k < nSlabs; k++) {
          const a = (sx < 0 ? PI * 0.48 : -PI * 0.48) + ((k + 0.5) / nSlabs) * PI * 1.04;
          const px = sx * 2.86 + Math.cos(a) * rx;
          const pz = 0.02 + Math.sin(a) * rz;
          if (Math.hypot(px, pz - CZ_ROT) < 3.12) continue; // stop cleanly at central drum!
          pushInst('sanc_ash', roofSlabGeo, sm.stoneInst,
            px, ry, pz, 0, -a + PI * 0.5, sx * -0.18,
            0.46, 0.055, 0.44, pick(apseShinglePal), roofG);
        }
      }
      for (let r = 0; r < 5; r++) {
        const a = (sx < 0 ? PI * 0.58 : -PI * 0.42) + (r / 4) * PI * 0.84;
        const rib = new THREE.TorusGeometry(2.02, 0.045, 6, 14, PI * 0.42);
        rib.scale(1.0, 0.24, 1.0);
        add(new THREE.Mesh(rib, sm.travertinePlain), sx * 2.86, 2.54, 0.02, 0, a, PI * 0.5, roofG);
      }
    }

    // Dainty mossy & lavender blossom cushion along the right apse ridge (`ext_01` & `int_01`!)
    const flwGeo = () => sharedSkyGeo(THREE, 'sr_wildflower', () => new THREE.DodecahedronGeometry(0.085, 0));
    for (let m = 0; m < 22; m++) {
      const mx = 3.25 + jr(-0.75, 0.85), mz = 0.05 + jr(-1.35, 1.35);
      pushInst('sanc_rv_flw', flwGeo, sm.foliageInst,
        mx, 2.88 + jr(0, 0.12), mz, jr(0, 2), jr(0, TAU), 0,
        jr(2.0, 3.2), jr(1.0, 1.5), jr(2.0, 3.2), pick(MOSS_PAL), roofG);
      if (m % 2 === 0) {
        pushInst('sanc_rv_flw', flwGeo, sm.foliageInst,
          mx + jr(-0.12, 0.12), 2.98 + jr(0, 0.10), mz + jr(-0.12, 0.12),
          jr(0, TAU), jr(0, TAU), 0, jr(1.0, 1.45), jr(0.85, 1.25), jr(1.0, 1.45),
          pick(BLOSSOM_BUSH_PAL), roofG);
      }
    }

    // --- B. Unbroken Carved Turquoise & Gold Celestian Square-Spiral Rune Frieze Drum (y = 2.86..3.58) ---
    const DRUM_R = 3.22;
    add(new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R + 0.16, DRUM_R + 0.12, 0.14, 42), sm.travertineWarm),
      0, 2.90, CZ_ROT, 0, 0, 0, roofG);
    const lowGoldTorus = new THREE.TorusGeometry(DRUM_R + 0.15, 0.044, 6, 42);
    lowGoldTorus.rotateX(PI * 0.5);
    add(new THREE.Mesh(lowGoldTorus, brightBrassMat), 0, 2.98, CZ_ROT, 0, 0, 0, roofG);

    // Main cylindrical Turquoise & Gold Spiral Rune Frieze Drum (`ext_01.png`!)
    add(new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, 0.52, 44, 1, false), spiralDrumMat),
      0, 3.26, CZ_ROT, 0, 0, 0, roofG);

    // Hero Front Flush Golden-Framed Glowing Cyan Aether Medallion above Portal Arch (`ext_01.png`!)
    const medZ = CZ_ROT + DRUM_R + 0.04;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.10, 22), brightBrassMat),
      0, 3.26, medZ - 0.02, PI * 0.5, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.048, 8, 22), brightBrassMat),
      0, 3.26, medZ + 0.03, 0, 0, 0, roofG);
    const medGem = new THREE.SphereGeometry(0.28, 16, 12);
    medGem.scale(1.0, 1.0, 0.36);
    add(new THREE.Mesh(medGem, sm.cyanCrystal), 0, 3.26, medZ + 0.02, 0, 0, 0, roofG);

    // Secondary golden-rimmed cyan gem boss linking portal arch keystone to the drum medallion (`ext_01.png`!)
    add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.032, 6, 16), brightBrassMat),
      0, 2.92, 3.52, 0, 0, 0, roofG);
    const smallGem = new THREE.SphereGeometry(0.12, 12, 10);
    smallGem.scale(1.0, 1.0, 0.45);
    add(new THREE.Mesh(smallGem, sm.cyanCrystal), 0, 2.92, 3.53, 0, 0, 0, roofG);

    // Upper Golden-Brass Riveted Cornice & Modillion Bracket Ring (y = 3.52..3.66)
    add(new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R + 0.20, DRUM_R + 0.12, 0.14, 44), brightBrassMat),
      0, 3.56, CZ_ROT, 0, 0, 0, roofG);
    const modGeo = () => sharedSkyGeo(THREE, 'sr_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU;
      pushInst('sanc_ash', modGeo, sm.stoneInst,
        Math.sin(a) * (DRUM_R + 0.15), 3.54, CZ_ROT + Math.cos(a) * (DRUM_R + 0.15),
        0, a, 0, 0.09, 0.18, 0.13, GOLD_TILE_PAL[1], roofG);
    }

    // --- C. Upper Brass Observation Gallery Railing & Celestial Mini-Globe (y = 3.62..4.06) ---
    const RAIL_R = DRUM_R + 0.05;
    for (const ry of [3.84, 4.02]) {
      const railTorus = new THREE.TorusGeometry(RAIL_R, 0.025, 6, 44);
      railTorus.rotateX(PI * 0.5);
      add(new THREE.Mesh(railTorus, brightBrassMat), 0, ry, CZ_ROT, 0, 0, 0, roofG);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      pushInst('sanc_ash', modGeo, sm.stoneInst,
        Math.sin(a) * RAIL_R, 3.82, CZ_ROT + Math.cos(a) * RAIL_R,
        0, a, 0, 0.055, 0.44, 0.055, GOLD_TILE_PAL[1], roofG);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.16, 12), sm.brassDeep), -2.08, 3.70, 1.15, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), domeGlassMat), -2.08, 3.96, 1.15, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.020, 6, 18), brightBrassMat), -2.08, 3.96, 1.15, 0.35, 0.4, 0, roofG);

    // --- D. Stained-Glass Star-Chart Observatory Dome + Open Telescope Slot (y = 3.60..6.28) ---
    const DOME_R = 2.92;
    const DOME_Y = 3.60;

    const domeGlassGeo = new THREE.SphereGeometry(DOME_R, 36, 18, 0.24, TAU - 0.76, 0.08, PI * 0.49);
    add(new THREE.Mesh(domeGlassGeo, domeGlassMat), 0, DOME_Y, CZ_ROT, 0, 0, 0, roofG);

    const slotRecessGeo = new THREE.SphereGeometry(DOME_R - 0.14, 14, 12, -0.54, 0.80, 0.10, PI * 0.48);
    add(new THREE.Mesh(slotRecessGeo, darkSlotMat), 0, DOME_Y, CZ_ROT, 0, 0, 0, roofG);

    // 12 Sculpted 3D Golden-Brass Meridian Ribs + 3 Horizontal Latitude Rings!
    const nMeridians = 12;
    for (let m = 0; m < nMeridians; m++) {
      const ry = (m / nMeridians) * TAU;
      const dirX = Math.cos(ry), dirZ = -Math.sin(ry);
      if (dirX > 0.74 && dirZ > 0.04 && dirZ < 0.64) continue;
      const ribGeo = new THREE.TorusGeometry(DOME_R + 0.028, 0.045, 6, 22, PI * 0.5);
      add(new THREE.Mesh(ribGeo, brightBrassMat), 0, DOME_Y, CZ_ROT, 0, ry, 0, roofG);
    }
    for (const elev of [0.34, 0.68, 1.02]) {
      const latR = Math.cos(elev) * (DOME_R + 0.024);
      const latY = DOME_Y + Math.sin(elev) * (DOME_R + 0.024);
      const latTorus = new THREE.TorusGeometry(latR, 0.034, 6, 36);
      latTorus.rotateX(PI * 0.5);
      add(new THREE.Mesh(latTorus, brightBrassMat), 0, latY, CZ_ROT, 0, 0, 0, roofG);
    }

    // Twin Heavy Curved Golden-Brass Shutter Arch Cheeks flanking the Telescope Slot (`ext_01.png`!)
    for (const slotYaw of [-0.54, 0.20]) {
      const cheekRib = new THREE.TorusGeometry(DOME_R + 0.09, 0.092, 8, 24, PI * 0.52);
      add(new THREE.Mesh(cheekRib, brightBrassMat), 0, DOME_Y, CZ_ROT, 0, slotYaw, 0, roofG);
      const innerCheek = new THREE.TorusGeometry(DOME_R + 0.045, 0.058, 6, 22, PI * 0.52);
      add(new THREE.Mesh(innerCheek, sm.brassDeep), 0, DOME_Y, CZ_ROT, 0, slotYaw + 0.04, 0, roofG);
    }

    // Ornate Raised Golden-Brass Observatory Crest Arch & Celestial Finial at Dome Apex!
    const crestY = DOME_Y + DOME_R;
    const crestArch = new THREE.TorusGeometry(1.18, 0.058, 8, 22, PI * 0.74);
    add(new THREE.Mesh(crestArch, brightBrassMat), 0, crestY - 0.78, CZ_ROT, 0, -0.18, PI * 0.14, roofG);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 0.14, 16), brightBrassMat), 0, crestY + 0.04, CZ_ROT, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), sm.cyanCrystal), 0, crestY + 0.20, CZ_ROT, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.30, 8), brightBrassMat), 0, crestY + 0.44, CZ_ROT, 0, 0, 0, roofG);

    // --- E. GIANT SEGMENTED GOLDEN-BRASS REFRACTOR TELESCOPE (`metalness: 0`!) ---
    const teleMount = new THREE.Group();
    teleMount.position.set(0.86, 3.64, CZ_ROT + 0.32);
    teleMount.rotation.y = -0.36;
    roofG.add(teleMount);

    add(new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.66, 0.20, 18), warmBronzeMat), 0, 0.10, 0, 0, 0, 0, teleMount);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.50, 0.22, 16), brightBrassMat), 0, 0.28, 0, 0, 0, 0, teleMount);
    for (const sz of [-1, 1]) {
      add(rbox(0.20, 1.02, 0.12, 0.03, brightBrassMat, 1), 0.04, 0.82, sz * 0.34, 0, 0, -0.08, teleMount);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.09, 14), warmBronzeMat),
        0.10, 1.28, sz * 0.38, PI * 0.5, 0, 0, teleMount);
    }
    add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 6, 20), brightBrassMat), 0.10, 1.28, 0.42, 0, 0, 0, teleMount);

    const barrelG = new THREE.Group();
    barrelG.position.set(0.10, 1.28, 0);
    barrelG.rotation.z = 0.48;
    teleMount.add(barrelG);

    const segments = [
      { x0: -0.82, len: 0.74, r0: 0.22, r1: 0.28, mat: warmBronzeMat },
      { x0: -0.10, len: 0.90, r0: 0.28, r1: 0.34, mat: brightBrassMat },
      { x0: 0.78, len: 0.95, r0: 0.34, r1: 0.40, mat: brightBrassMat },
      { x0: 1.70, len: 0.92, r0: 0.40, r1: 0.47, mat: brightBrassMat },
    ];
    for (const seg of segments) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(seg.r1, seg.r0, seg.len, 24), seg.mat),
        seg.x0 + seg.len * 0.5, 0, 0, 0, 0, -PI * 0.5, barrelG);
      add(new THREE.Mesh(new THREE.CylinderGeometry(seg.r1 + 0.04, seg.r1 + 0.04, 0.10, 24), warmBronzeMat),
        seg.x0 + seg.len, 0, 0, 0, 0, -PI * 0.5, barrelG);
    }

    const hoodX = 2.62;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.48, 0.42, 26), brightBrassMat),
      hoodX + 0.19, 0, 0, 0, 0, -PI * 0.5, barrelG);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.048, 8, 26), brightBrassMat),
      hoodX + 0.39, 0, 0, 0, PI * 0.5, 0, barrelG);

    // Brilliant glowing cyan Aether objective lens inside the brass hood (`ext_01` & `int_01`!)
    const lensGeo = new THREE.SphereGeometry(0.49, 22, 16);
    lensGeo.scale(0.32, 1, 1);
    add(new THREE.Mesh(lensGeo, sm.cyanCrystal), hoodX + 0.29, 0, 0, 0, 0, 0, barrelG);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.022, 6, 24), sm.cyanSoft),
      hoodX + 0.34, 0, 0, 0, PI * 0.5, 0, barrelG);

    add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.34, 16), brightBrassMat),
      -0.96, 0, 0, 0, 0, -PI * 0.5, barrelG);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), sm.cyanCrystal),
      -1.14, 0, 0, 0, 0, 0, barrelG);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.058, 1.42, 14), sm.brassDeep),
      0.82, 0.46, 0.12, 0, 0, -PI * 0.5, barrelG);
    add(rbox(0.07, 0.18, 0.07, 0.014, brightBrassMat, 1), 0.32, 0.36, 0.09, 0, 0, 0, barrelG);
    add(rbox(0.07, 0.18, 0.07, 0.014, brightBrassMat, 1), 1.32, 0.40, 0.09, 0, 0, 0, barrelG);

    // --- F. SEAMLESS UPPER ANCIENT TREE TRUNK BOUGHS & PAINTERLY STORYBOOK FOLIAGE CROWN (`roofG`!) ---
    // Seamless continuation from Joint 1 [-3.12, 2.62, 1.82] (r = 0.29) wrapping over the left drum & dome!
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-3.12, 2.58, 1.82],
        [-3.48, 3.45, 1.18],
        [-3.05, 4.48, 0.38],
        [-2.05, 5.55, -0.45],
        [-0.78, 6.38, -1.18],
      ],
      rStart: 0.30, rEnd: 0.16, mossy: true, parent: roofG, batchPrefix: 'sanc',
    }));
    // Seamless continuation from Joint 2 [-3.88, 2.62, 1.35] (r = 0.24) out to the left boughs!
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-3.88, 2.58, 1.35],
        [-4.38, 3.55, 0.68],
        [-4.68, 4.65, -0.25],
        [-4.18, 5.65, -1.08],
      ],
      rStart: 0.25, rEnd: 0.12, mossy: false, parent: roofG, batchPrefix: 'sanc',
    }));
    // Seamless continuation from Joint 3 [-3.68, 2.62, -2.02] (r = 0.34) into the massive central crown!
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-3.68, 2.58, -2.02],
        [-3.38, 3.85, -2.18],
        [-2.58, 5.12, -1.98],
        [-1.35, 6.18, -1.62],
        [0.35, 6.58, -1.52],
      ],
      rStart: 0.35, rEnd: 0.17, mossy: true, parent: roofG, batchPrefix: 'sanc',
    }));
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [-2.85, 2.75, -3.22],
        [-1.68, 4.18, -3.18],
        [-0.08, 5.48, -2.88],
        [1.72, 6.08, -2.32],
        [3.35, 5.88, -1.48],
      ],
      rStart: 0.34, rEnd: 0.14, mossy: false, parent: roofG, batchPrefix: 'sanc',
    }));
    // Right upper gnarled root arch curling from Joint 4 [2.98, 2.60, 1.92] around the right rune drum (`ext_01.png`!)
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [
        [2.98, 2.56, 1.92],
        [3.52, 3.18, 1.18],
        [3.68, 3.68, 0.25],
        [3.42, 3.35, -0.85],
        [4.38, 2.60, -0.78],
      ],
      rStart: 0.24, rEnd: 0.16, mossy: true, parent: roofG, batchPrefix: 'sanc',
    }));
    // Charming smaller bonsai side-limbs on far-left & far-right (`ext_01.png`!)
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [[-4.25, 2.72, 1.25], [-5.08, 3.28, 1.42], [-5.42, 3.65, 1.25]],
      rStart: 0.13, rEnd: 0.05, mossy: false, parent: roofG, batchPrefix: 'sanc',
    }));
    styleBark(buildGnarledRootTube(THREE, K, {
      points: [[4.32, 2.72, -0.78], [4.95, 3.55, -0.58], [5.28, 4.15, -0.42]],
      rStart: 0.14, rEnd: 0.05, mossy: false, parent: roofG, batchPrefix: 'sanc',
    }));

    // Multi-tiered Painterly Storybook Foliage Bough Pads (780 crisp faceted leaf rosettes in 1 InstancedMesh!)
    const tuftGeo = () => sharedSkyGeo(THREE, 'sr_foliage_tuft', () => new THREE.DodecahedronGeometry(0.28, 0));
    const addPainterlyCanopyPad = (cx, cy, cz, rx, ry, rz, count) => {
      for (let i = 0; i < count; i++) {
        // Golden-angle phyllotaxis + layered vertical tiers for authentic Kazuo Oga foliage!
        const f = (i + 0.5) / count;
        const a = i * 2.39996 + jr(-0.14, 0.14);
        const rad = Math.sqrt(f) * jr(0.76, 1.08);
        const layer = jr(-1.0, 1.0);
        const lx = cx + Math.cos(a) * rx * rad;
        const lz = cz + Math.sin(a) * rz * rad;
        const domeLift = (1 - rad * rad * 0.68) * ry * 0.65;
        const ly = cy + domeLift + layer * ry * 0.45;
        let col;
        if (layer < -0.32) col = pick(CANOPY_SHADOW_PAL);
        else if (layer < 0.22) col = pick(CANOPY_MID_PAL);
        else col = pick(CANOPY_SUN_PAL);
        const sc = jr(0.82, 1.38) * (1.08 - rad * 0.22);
        pushInst('sanc_tuft', tuftGeo, sm.foliageInst,
          lx, ly, lz, jr(-0.35, 0.35), jr(0, TAU), jr(-0.35, 0.35),
          sc * 1.32, sc * 0.78, sc * 1.24, col, roofG);
      }
    };

    // Sculpted layered Storybook bough clouds framing the dome & telescope (`ext_01.png`!)
    addPainterlyCanopyPad(-2.85, 6.45, -1.25, 2.55, 0.95, 2.05, 135);
    addPainterlyCanopyPad(-0.45, 6.88, -1.72, 2.48, 0.95, 1.98, 135);
    addPainterlyCanopyPad(-4.22, 5.58, -0.42, 2.05, 0.88, 1.82, 105);
    addPainterlyCanopyPad(-4.72, 4.58, 0.45, 1.62, 0.76, 1.48, 85);
    addPainterlyCanopyPad(2.05, 6.38, -1.98, 2.25, 0.90, 1.85, 110);
    addPainterlyCanopyPad(3.85, 5.65, -1.35, 1.88, 0.82, 1.55, 90);
    addPainterlyCanopyPad(-5.35, 3.78, 1.25, 0.92, 0.44, 0.82, 42);
    addPainterlyCanopyPad(5.18, 4.28, -0.42, 0.98, 0.46, 0.88, 46);
  }

  // ==========================================================================
  // 6. 2-ROOM CUTAWAY INTERIOR (`int_01.png`):
  //    LEFT/CENTER `crystal_rotunda` + RIGHT `stele_sanctum`
  // ==========================================================================
  const addHangingBrassLantern = (x, yHang, z) => {
    const lg = new THREE.Group();
    lg.position.set(x, yHang, z);
    root.add(lg);

    add(new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.28, 6), sm.brassDeep), 0, 0.14, 0, 0, 0, 0, lg);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.13, 8), brightBrassMat), 0, -0.02, 0, 0, 0, 0, lg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.30, 8), sm.amberGlow), 0, -0.20, 0, 0, 0, 0, lg);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI * 0.25;
      add(rbox(0.022, 0.32, 0.022, 0.006, sm.brassDeep, 1),
        Math.cos(a) * 0.145, -0.20, Math.sin(a) * 0.145, 0, 0, 0, lg);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.11, 8), brightBrassMat), 0, -0.40, 0, PI, 0, 0, lg);
  };

  // --- ROOM 1: `crystal_rotunda` (Left / Center) ---
  // 1) Central Carved Golden-Stone Dais + Giant Levitating Cyan Skyglass Crystal + 2 Interlocking Rune Rings!
  {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.84, 0.13, 24), sm.travertineWarm),
      ROT_CX, FL + 0.065, ROT_CZ, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.16, 24), brightBrassMat),
      ROT_CX, FL + 0.20, ROT_CZ, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.11, 24), spiralDrumMat),
      ROT_CX, FL + 0.24, ROT_CZ, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.045, 22), sm.cyanCrystal),
      ROT_CX, FL + 0.30, ROT_CZ, 0, 0, 0, root);

    const leviG = buildSkyglassCrystal(THREE, K, {
      x: ROT_CX, y: FL + 1.38, z: ROT_CZ,
      radius: 0.46, height: 1.58, rings: 2, parent: root,
    });
    leviG.traverse((o) => {
      if (o.isMesh && o.material === sm.runeFrieze) o.material = spiralDrumMat;
      if (o.isMesh && o.material === sm.goldBrass) o.material = brightBrassMat;
    });
    boxCol(ROT_CX, ROT_CZ, 1.42, 1.42);
  }

  // 2) Left Apse Scholar Desk & Multi-Tiered Bookshelf Packed with Colorful Tomes & Glowing Cyan Jars (`int_01.png`!)
  {
    const bx = -3.72, bz = -0.24, rotY = PI * 0.5;
    const bg = new THREE.Group();
    bg.position.set(bx, FL, bz);
    bg.rotation.y = rotY;
    root.add(bg);

    add(rbox(1.88, 0.08, 0.68, 0.025, sm.oakTimber, 1), 0, 0.74, 0, 0, 0, 0, bg);
    for (const sx of [-0.80, 0.80]) for (const sz of [-0.24, 0.24]) {
      add(rbox(0.10, 0.72, 0.10, 0.02, sm.darkTimber, 1), sx, 0.36, sz, 0, 0, 0, bg);
    }
    add(rbox(1.60, 0.05, 0.48, 0.015, sm.darkTimber, 1), 0, 0.22, 0, 0, 0, 0, bg);

    add(rbox(1.68, 0.06, 0.36, 0.02, sm.oakTimber, 1), 0, 1.28, -0.13, 0, 0, 0, bg);
    add(rbox(1.72, 0.07, 0.40, 0.02, sm.oakTimber, 1), 0, 1.80, -0.13, 0, 0, 0, bg);
    for (const sx of [-0.80, 0, 0.80]) {
      add(rbox(0.06, 1.06, 0.34, 0.015, sm.darkTimber, 1), sx, 1.30, -0.13, 0, 0, 0, bg);
    }

    const bookGeo = () => sharedSkyGeo(THREE, 'sr_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    for (const [shelfY, xStart, xEnd] of [[0.78, -0.72, -0.08], [1.31, -0.74, -0.08], [1.31, 0.08, 0.74]]) {
      let lx = xStart;
      while (lx < xEnd) {
        const bw = jr(0.065, 0.092);
        const bh = jr(0.26, 0.35);
        const wx = bx - 0.13;
        const wz = bz - (lx + bw * 0.5);
        pushInst('sanc_ash', bookGeo, sm.stoneInst,
          wx, FL + shelfY + bh * 0.5, wz,
          jr(-0.04, 0.04), rotY, jr(-0.05, 0.05),
          bw, bh, 0.23, pick(BOOK_SPINE_PAL), root);
        lx += bw + 0.012;
      }
    }

    for (const [jx, jz, sc] of [[0.46, 0.12, 1.0], [0.64, 0.05, 0.82], [-0.58, 0.15, 0.90]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.08 * sc, 0.09 * sc, 0.22 * sc, 10), sm.cyanCrystal),
        jx, 0.78 + 0.11 * sc, jz, 0, 0, 0, bg);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06 * sc, 0.07 * sc, 0.045 * sc, 10), brightBrassMat),
        jx, 0.78 + 0.23 * sc, jz, 0, 0, 0, bg);
    }
    add(rbox(0.34, 0.04, 0.24, 0.01, sm.crimsonLeather, 1), 0.12, 0.80, 0.13, 0, 0.12, 0, bg);
    add(rbox(0.30, 0.03, 0.20, 0.008, sm.travertinePlain, 1), 0.12, 0.825, 0.13, 0, 0.12, 0, bg);

    boxCol(bx, bz, 0.74, 1.94);
  }

  // 3) Back-Right Rotunda Armillary Celestial Globe on Oak Pedestal Table (`int_01.png`!)
  {
    const gx = 0.08, gz = -2.54;
    const ag = new THREE.Group();
    ag.position.set(gx, FL, gz);
    ag.rotation.y = -0.28;
    root.add(ag);

    add(rbox(1.38, 0.08, 0.64, 0.025, sm.oakTimber, 1), 0, 0.72, 0, 0, 0, 0, ag);
    for (const sx of [-0.58, 0.58]) for (const sz of [-0.22, 0.22]) {
      add(rbox(0.095, 0.70, 0.095, 0.02, sm.darkTimber, 1), sx, 0.35, sz, 0, 0, 0, ag);
    }

    add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.26, 0.11, 16), sm.brassDeep), 0.14, 0.81, 0, 0, 0, 0, ag);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.20, 12), brightBrassMat), 0.14, 0.94, 0, 0, 0, 0, ag);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.030, 8, 24), brightBrassMat), 0.14, 1.32, 0, 0, 0.25, 0.38, ag);
    const eqRing = new THREE.TorusGeometry(0.38, 0.024, 6, 24);
    eqRing.rotateX(PI * 0.5);
    add(new THREE.Mesh(eqRing, brightBrassMat), 0.14, 1.32, 0, 0.38, 0, -0.22, ag);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.30, 18, 14), sm.starDome), 0.14, 1.32, 0, 0.25, 0.6, 0, ag);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.19, 10), sm.cyanCrystal), -0.42, 0.85, 0.06, 0, 0, 0, ag);
    add(rbox(0.28, 0.11, 0.22, 0.015, sm.crimsonLeather, 1), -0.40, 0.81, -0.13, 0, 0.22, 0, ag);

    boxCol(gx, gz, 1.42, 0.70);
  }

  addHangingBrassLantern(-2.68, 2.48, -2.28);
  addHangingBrassLantern(-0.46, 2.48, -2.38);

  // --- ROOM 2: `stele_sanctum` (Right, x ∈ [1.18, 4.45], z ∈ [-3.22, 2.90]) ---
  // 1) 3 Tall Carved Celestian Sandstone Relief Steles against Back Wall (`int_01.png`!)
  {
    const buildCarvedStele = (sx, sz, w, h, th, hero = false) => {
      const sg = new THREE.Group();
      sg.position.set(sx, FL, sz);
      root.add(sg);

      add(rbox(w + 0.16, 0.16, th + 0.14, 0.03, sm.travertineDark, 1), 0, 0.08, 0, 0, 0, 0, sg);

      const rTop = w * 0.5;
      const bodyH = Math.max(0.45, h - rTop);
      const stShape = new THREE.Shape();
      stShape.moveTo(-rTop, 0);
      stShape.lineTo(rTop, 0);
      stShape.lineTo(rTop, bodyH);
      stShape.absarc(0, bodyH, rTop, 0, PI, false);
      stShape.lineTo(-rTop, 0);

      const stGeo = new THREE.ExtrudeGeometry(stShape, {
        depth: th, bevelEnabled: true, bevelThickness: 0.028, bevelSize: 0.028, bevelSegments: 1, curveSegments: 16,
      });
      stGeo.translate(0, 0, -th * 0.5);
      const p = stGeo.attributes.position;
      const uvs = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uvs[i * 2] = (p.getX(i) + rTop) / Math.max(0.01, w);
        uvs[i * 2 + 1] = p.getY(i) / Math.max(0.01, h);
      }
      stGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      add(new THREE.Mesh(stGeo, heroSteleMat), 0, 0.14, 0, 0, 0, 0, sg);

      const archTrim = new THREE.TorusGeometry(rTop - 0.02, 0.032, 6, 18, PI);
      add(new THREE.Mesh(archTrim, brightBrassMat), 0, 0.14 + bodyH, th * 0.5 + 0.02, 0, 0, 0, sg);
      for (const side of [-1, 1]) {
        add(rbox(0.055, bodyH, 0.045, 0.012, brightBrassMat, 1),
          side * (rTop - 0.02), 0.14 + bodyH * 0.5, th * 0.5 + 0.02, 0, 0, 0, sg);
      }
      if (hero) {
        add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 6, 16), brightBrassMat),
          0, 0.14 + h * 0.74, th * 0.5 + 0.03, 0, 0, 0, sg);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), sm.cyanSoft),
          0, 0.14 + h * 0.74, th * 0.5 + 0.04, 0, 0, 0, sg);
      }
    };

    buildCarvedStele(1.98, -2.96, 0.66, 1.58, 0.20, false);
    buildCarvedStele(2.88, -2.98, 1.12, 2.12, 0.24, true);
    buildCarvedStele(3.84, -2.94, 0.70, 1.66, 0.20, false);
    boxCol(2.90, -2.96, 2.72, 0.44);
  }

  // 2) Carved Celestian Stone Scholar Throne (`x = 1.66, z = -1.65`, facing +X/+Z as in `int_01.png`!)
  {
    const tx = 1.66, tz = -1.65;
    const tg = new THREE.Group();
    tg.position.set(tx, FL, tz);
    tg.rotation.y = PI * 0.36;
    root.add(tg);

    for (const sx of [-0.28, 0.28]) for (const sz of [-0.24, 0.24]) {
      add(rbox(0.15, 0.44, 0.15, 0.025, sm.travertineDark, 1), sx, 0.22, sz, 0, 0, 0, tg);
    }
    add(rbox(0.80, 0.12, 0.70, 0.03, sm.travertinePlain, 1), 0, 0.46, 0.02, 0, 0, 0, tg);
    for (const sx of [-0.34, 0.34]) {
      add(rbox(0.13, 0.28, 0.62, 0.03, sm.travertineWarm, 1), sx, 0.64, 0.0, 0, 0, 0, tg);
    }
    add(rbox(0.64, 1.12, 0.14, 0.03, heroSteleMat, 1), 0, 1.04, -0.26, 0, 0, 0, tg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.14, 16, 1, false, 0, PI), sm.travertineWarm),
      0, 1.60, -0.26, 0, PI * 0.5, PI * 0.5, tg);
    for (const sx of [-0.40, 0.40]) {
      add(rbox(0.15, 0.96, 0.16, 0.025, sm.travertinePlain, 1), sx, 0.96, -0.26, 0, 0, 0, tg);
    }
    boxCol(tx, tz, 0.84, 0.84);
  }

  addHangingBrassLantern(1.88, 2.48, -2.18);

  // 3) Oak Scholar Chart/Scroll Table + Rolled Parchments & Storage Boxes Underneath (`int_01.png`!)
  {
    const sx = 3.16, sz = -1.32;
    const sg = new THREE.Group();
    sg.position.set(sx, FL, sz);
    sg.rotation.y = -0.16;
    root.add(sg);

    add(rbox(1.82, 0.10, 0.80, 0.025, sm.oakTimber, 1), 0, 0.74, 0, 0, 0, 0, sg);
    add(rbox(1.66, 0.08, 0.64, 0.02, sm.darkTimber, 1), 0, 0.65, 0, 0, 0, 0, sg);
    for (const lx of [-0.74, 0.74]) for (const lz of [-0.28, 0.28]) {
      add(rbox(0.12, 0.70, 0.12, 0.02, sm.darkTimber, 1), lx, 0.35, lz, 0, 0, 0, sg);
    }

    const addScrollRoll = (px, py, pz, len = 0.46, ry = 0) => {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, len, 12), sm.travertinePlain),
        px, py, pz, 0, ry, PI * 0.5, sg);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.048, 12), brightBrassMat),
        px, py, pz, 0, ry, PI * 0.5, sg);
    };
    addScrollRoll(-0.44, 0.85, -0.11, 0.50, 0.05);
    addScrollRoll(-0.42, 0.85, 0.04, 0.48, -0.04);
    addScrollRoll(-0.43, 0.95, -0.03, 0.46, 0.02);
    addScrollRoll(0.08, 0.85, -0.09, 0.44, -0.08);
    addScrollRoll(0.10, 0.85, 0.06, 0.44, 0.06);
    addScrollRoll(0.56, 0.85, -0.12, 0.42, 0.12);

    add(rbox(0.44, 0.022, 0.32, 0.008, sm.travertinePlain, 1), 0.52, 0.80, 0.13, 0, -0.08, 0, sg);

    add(rbox(0.44, 0.26, 0.38, 0.025, sm.oakTimber, 1), -0.34, 0.13, 0.0, 0, 0.08, 0, sg);
    add(rbox(0.40, 0.20, 0.34, 0.02, sm.darkTimber, 1), -0.32, 0.35, -0.02, 0, -0.06, 0, sg);
    add(rbox(0.46, 0.28, 0.40, 0.025, sm.darkTimber, 1), 0.32, 0.14, 0.04, 0, -0.10, 0, sg);

    boxCol(sx, sz, 1.86, 0.88, -0.16);
  }

  // Warm Storybook Interior PointLights (when `opts.lit !== false`)
  if (isLit) {
    const cyanGlowLight = new THREE.PointLight(0x5ae6ff, 1.35, 7.5, 1.6);
    cyanGlowLight.position.set(ROT_CX, FL + 1.50, ROT_CZ);
    root.add(cyanGlowLight);

    const sanctumWarmLight = new THREE.PointLight(0xffcb78, 1.25, 7.0, 1.6);
    sanctumWarmLight.position.set(2.30, FL + 2.15, -1.50);
    root.add(sanctumWarmLight);
  }

  // ==========================================================================
  // 7. REQUIRED `root.userData` METADATA (ROOMS, DOORS & 9 VALID `sr_*` PROP SLOTS)
  // ==========================================================================
  root.userData.footprint = { w: 10.2, d: 8.2 };
  root.userData.footprintBox = { w: 10.2, d: 8.2 };
  root.userData.rooms = [
    { name: 'crystal_rotunda', x: -1.66, z: -0.10, w: 5.42, d: 6.75, walkX: 0.0, walkZ: 1.55 },  // x ∈ [-4.37, 1.05]
    { name: 'stele_sanctum', x: 2.75, z: -0.10, w: 3.40, d: 6.15, walkX: 2.25, walkZ: 0.20 },    // x ∈ [1.05, 4.45]
  ];
  root.userData.door = { x: 0, z: 5.1 };
  root.userData.doorIn = { x: 0, z: 2.9 };
  root.userData.innerDoors = [{ x: 1.05, z: 0.1 }];

  root.userData.propSlots = [
    // crystal_rotunda open walkable perimeter slots (5 slots)
    { id: 'sr_sky_compass', x: -2.78, y: FL, z: 1.48, rot: 0.52 },
    { id: 'sr_telescope_tripod', x: -2.72, y: FL, z: -1.68, rot: 0.85 },
    { id: 'sr_crystal_lantern', x: -1.18, y: FL, z: 2.18, rot: -0.35 },
    { id: 'sr_levitation_urn', x: -3.28, y: FL, z: 0.88, rot: 1.15 },
    { id: 'sr_sky_compass', x: 0.28, y: FL, z: -1.35, rot: -0.78 },
    // stele_sanctum open walkable floor slots (4 slots)
    { id: 'sr_stone_stele', x: 3.72, y: FL, z: 0.38, rot: -1.35 },
    { id: 'sr_pirate_chest', x: 3.42, y: FL, z: 1.52, rot: -2.42 },
    { id: 'sr_crystal_lantern', x: 1.78, y: FL, z: 1.75, rot: 2.65 },
    { id: 'sr_levitation_urn', x: 3.62, y: FL, z: -0.42, rot: 0.42 },
  ];

  K.finalize();

  // Safety pass: guarantee 100% metalness: 0 on every mesh material in the hierarchy!
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      if (Array.isArray(o.material)) {
        o.material.forEach((m) => { if (m && m.metalness !== undefined) m.metalness = 0; });
      } else if (o.material.metalness !== undefined) {
        o.material.metalness = 0;
      }
    }
  });

  return root;
}
