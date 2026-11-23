// ============================================================================
// Yu-Machi Spirit Bathhouse — Moonlit Taiko Shrine Gatehouse (shrine_gatehouse.js)
// Handcrafted Storybook procedural 3D building matching ext_05 & int_05:
//   - Double-tier Verdigris 3D instanced Kawara roof crowned by a gleaming
//     Golden Crescent-Moon Finial on a sculpted cloud pedestal + front filigree gable
//   - Open Vermilion Sanctuary portal with 4 gold-collared pillars, braided
//     golden-straw Shimenawa rope, 4 crisp white zig-zag Shide & hex brass lanterns
//   - 2-room cutaway interior: Left Taiko Sanctum (purple maku curtain, dais &
//     giant Sacred Tomoe Taiko Drum) + Right Ema Hall (omikuji fortune counter &
//     32 instanced pentagonal wooden Ema wish plaques with crimson cords)
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
  mergeGeometries,
} from '../../map_kit.js?v=2';
import {
  getBathMats,
  buildKawaraGableRoof,
  buildKawaraPentAwning,
  buildMossyStonePlinth,
  addKumikoWindow,
  addPostLantern,
  VERDIGRIS_PAL,
} from '../bath_kit.js?v=2';
import { ensureBathTexWarm } from './landmarks.js?v=54';

const PI = Math.PI;
const TAU = PI * 2;

// Cached bespoke Shrine gouache textures (purple crest Maku curtain & Ema wish plaque)
let _shrineTex = null;
function getShrineTextures(THREE) {
  if (_shrineTex) return _shrineTex;

  // Royal purple sacred Maku bunting curtain with pleats & crisp white three-orb shrine crests
  const makuPurple = paintedCanvasTex(THREE, 'bh_shrine_maku_v1', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#3a1f62');
    grd.addColorStop(0.55, '#4d2b7e');
    grd.addColorStop(1, '#361c5c');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Vertical woven panel seams & soft folds
    const panels = 4;
    const pw = w / panels;
    for (let i = 0; i < panels; i++) {
      const px = i * pw;
      const fold = ctx.createLinearGradient(px, 0, px + pw, 0);
      fold.addColorStop(0, 'rgba(20,8,38,0.38)');
      fold.addColorStop(0.32, 'rgba(138,96,204,0.22)');
      fold.addColorStop(0.68, 'rgba(98,60,162,0.12)');
      fold.addColorStop(1, 'rgba(18,6,34,0.40)');
      ctx.fillStyle = fold;
      ctx.fillRect(px, 0, pw, h);
      ctx.fillStyle = 'rgba(255,244,225,0.75)';
      ctx.fillRect(px + pw - 2, 0, 2, h * 0.86);
    }
    brushStrokes(ctx, w, rng, 110, ['#5f3998', '#301750', '#6d45ab'], 2, 6, 0.22);

    // White sacred shrine crests (mitsudomoe / wish-jewel triad) on alternating panels
    ctx.fillStyle = '#faf3e6';
    ctx.strokeStyle = '#faf3e6';
    for (const cx of [pw * 0.5, pw * 1.5, pw * 2.5, pw * 3.5]) {
      const cy = h * 0.42;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, TAU);
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU - PI * 0.5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 8.2, cy + Math.sin(a) * 8.2, 5.2, 0, TAU);
        ctx.fill();
      }
    }
    // Gold-trimmed top header band
    ctx.fillStyle = '#2a1448';
    ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = '#e5b852';
    ctx.fillRect(0, 16, w, 4);
  }, 1, 1);

  // Warm hinoki wooden Ema wish plaque face with subtle calligraphy brush strokes & red stamp
  const emaFace = paintedCanvasTex(THREE, 'bh_shrine_ema_v1', 128, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#edd09d';
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 70, ['#f7dfB4', '#d8b37c', '#e6c58e'], 2, 5, 0.30, 0, 0.25, 28);
    ctx.strokeStyle = '#6b4426';
    ctx.lineWidth = 3;
    for (let c = 0; c < 3; c++) {
      const lx = w * (0.28 + c * 0.20);
      ctx.beginPath();
      ctx.moveTo(lx, h * 0.30);
      ctx.quadraticCurveTo(lx + rng.jr(-4, 4), h * 0.54, lx + rng.jr(-3, 3), h * 0.78);
      ctx.stroke();
    }
    ctx.fillStyle = '#c83b2b';
    ctx.fillRect(w * 0.70, h * 0.62, 14, 16);
  }, 1, 1);

  _shrineTex = { makuPurple, emaFace };
  return _shrineTex;
}

// Helper: Ornate Hanging Golden Hexagonal Shrine Lantern (Tsuridoro)
function addHexShrineLantern(THREE, K, bm, x, yBody, z, chainTopY, scale = 1.0, parent = K.root) {
  const { add, rbox } = K;
  const g = new THREE.Group();
  g.position.set(x, yBody, z);
  g.scale.setScalar(scale);
  parent.add(g);

  // Hanging chain/rod up to tie-beam (kept below y = 3.3m when in K.root!)
  const rodLen = Math.max(0.14, (chainTopY - yBody) / scale - 0.28);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, rodLen, 6), bm.goldTrim),
    0, 0.28 + rodLen * 0.5, 0, 0, 0, 0, g);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12), bm.goldTrim),
    0, 0.28, 0, 0, 0, 0, g);

  // Glowing golden hexagonal core
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.34, 6), bm.lanternGlow),
    0, 0, 0, 0, PI / 6, 0, g);

  // 6 filigree corner struts
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + PI / 6;
    add(rbox(0.024, 0.36, 0.024, 0.008, bm.brassWarm),
      Math.cos(a) * 0.175, 0, Math.sin(a) * 0.175, 0, -a, 0, g);
  }

  // Swept hexagonal pagoda canopy + 6 upturned scroll curls
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.16, 6), bm.goldTrim);
  add(cap, 0, 0.21, 0, 0, PI / 6, 0, g);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bm.goldTrim), 0, 0.30, 0, 0, 0, 0, g);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + PI / 6;
    add(rbox(0.035, 0.055, 0.09, 0.015, bm.goldTrim),
      Math.cos(a) * 0.28, 0.16, Math.sin(a) * 0.28, -0.45, a, 0, g);
  }

  // Base tray + pendant finial
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.14, 0.07, 6), bm.brassWarm),
    0, -0.19, 0, 0, PI / 6, 0, g);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 6), bm.goldTrim),
    0, -0.28, 0, PI, 0, 0, g);

  return g;
}

// Helper: Braided Golden-Straw Shimenawa Rope (true 3D double/triple helix!) + crisp white zig-zag Shide
function buildShimenawaWithShide(THREE, K, strawMat, shideMat, opts = {}) {
  const {
    cx = 0, yEnds = 2.96, sag = 0.38, z = 3.38,
    span = 2.76, maxR = 0.088, shideCount = 4,
    parent = K.root,
  } = opts;
  const { add, rbox } = K;

  // 3 braided helical strands twisting around a catenary curve, thicker at center & tapering to ends!
  const SEG = 40;
  for (let strand = 0; strand < 3; strand++) {
    const phase0 = (strand / 3) * TAU;
    const pts = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const env = Math.sin(t * PI);
      const bx = cx + (t - 0.5) * span;
      const by = yEnds - env * sag;
      const helixR = (0.018 + env * (maxR * 0.46));
      const ang = t * PI * 13 + phase0;
      pts.push(new THREE.Vector3(
        bx,
        by + Math.cos(ang) * helixR,
        z + Math.sin(ang) * helixR
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    // Custom variable-radius tube along strand so center bulges authentically
    const frames = curve.computeFrenetFrames(SEG, false);
    const radial = 7;
    const pos = [], norm = [], uvs = [], idx = [];
    const p = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const rTube = 0.026 + Math.sin(t * PI) * (maxR * 0.58);
      const cPt = curve.getPointAt(t);
      const N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const v = (j / radial) * TAU;
        const cs = Math.cos(v), sn = Math.sin(v);
        nrm.set(N.x * cs + B.x * sn, N.y * cs + B.y * sn, N.z * cs + B.z * sn).normalize();
        p.copy(cPt).addScaledVector(nrm, rTube);
        pos.push(p.x, p.y, p.z);
        norm.push(nrm.x, nrm.y, nrm.z);
        uvs.push(t * 6, j / radial);
      }
    }
    const stride = radial + 1;
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * stride + j, b = (i + 1) * stride + j, c = (i + 1) * stride + j + 1, d = i * stride + j + 1;
        idx.push(a, b, d, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    add(new THREE.Mesh(g, strawMat), 0, 0, 0, 0, 0, 0, parent);
  }

  // Straw binding knots & flared end tassels
  for (const sx of [-1, 1]) {
    const ex = cx + sx * (span * 0.5);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 12), strawMat), ex - sx * 0.05, yEnds, z, 0, PI * 0.5, 0, parent);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.24, 8), strawMat), ex + sx * 0.06, yEnds - 0.06, z, 0, 0, sx * 0.72, parent);
  }

  // Crisp white zig-zag paper Shide streamers
  const zigShape = new THREE.Shape();
  zigShape.moveTo(-0.025, 0);
  zigShape.lineTo(0.035, 0);
  zigShape.lineTo(0.095, -0.13);
  zigShape.lineTo(0.025, -0.15);
  zigShape.lineTo(0.105, -0.29);
  zigShape.lineTo(0.025, -0.31);
  zigShape.lineTo(0.115, -0.46);
  zigShape.lineTo(0.015, -0.58);
  zigShape.lineTo(-0.065, -0.45);
  zigShape.lineTo(0.005, -0.42);
  zigShape.lineTo(-0.075, -0.28);
  zigShape.lineTo(0.005, -0.25);
  zigShape.lineTo(-0.065, -0.12);
  zigShape.closePath();
  const shideGeo = new THREE.ExtrudeGeometry(zigShape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
  shideGeo.translate(0, 0, -0.009);

  for (let k = 0; k < shideCount; k++) {
    const t = (k + 0.85) / (shideCount + 0.7);
    const sx = cx + (t - 0.5) * span;
    const sy = yEnds - Math.sin(t * PI) * sag - 0.05;
    add(rbox(0.05, 0.05, 0.12, 0.015, strawMat), sx, sy + 0.05, z, 0, 0, 0, parent);
    add(new THREE.Mesh(shideGeo, shideMat), sx, sy, z + 0.03, 0.04, (k % 2 ? 0.08 : -0.08), 0, parent);
  }
}

export function buildShrineGatehouse(THREE, opts = {}) {
  ensureBathTexWarm(THREE);
  const K = createBuilderKit(THREE, opts, 'shrine_gatehouse', 5);
  const { root, roofG, add, rbox, boxCol, wall, pushInst, jr, pick } = K;
  const bm = getBathMats(THREE, K);
  const ST = getShrineTextures(THREE);

  const W = 8.8;
  const D = 7.2;
  const FL = 0.44;       // Sanctuary stone terrace height
  const H_WALL = 3.24;   // Lower wall height in K.root (strictly < 3.3m for clean cutaway!)
  const TH = 0.24;

  // Custom non-metallic Storybook materials (100% metalness: 0!)
  const strawGold = K.M(0xe6ba62, K.tex('wood_light', 2, 2), { roughness: 0.78, metalness: 0, emissive: 0x52360a, emissiveIntensity: 0.12 });
  const shideWhite = K.M(0xfdfaf2, null, { roughness: 0.65, metalness: 0, emissive: 0xffe8c2, emissiveIntensity: 0.22 });
  const makuMat = K.M(0xffffff, ST.makuPurple, { roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  const emaMat = K.M(0xffffff, ST.emaFace, { roughness: 0.82, metalness: 0 });
  const redCordMat = K.M(0xd9342b, null, { roughness: 0.72, metalness: 0 });
  const darkBaseIron = K.M(0x3a3744, K.tex('stone', 1, 1), { roughness: 0.70, metalness: 0 });
  const twilightStone = K.G(0x9b92a2, K.tex('plaster', 1.8, 1.8), 0.70, 0.55);
  const flagstonePal = [0x9e92a2, 0xaea0aa, 0x8b8294, 0xb8a6a0, 0x948c9a];

  // ==========================================================================
  // 1. MOSSY SHORELINE FOUNDATION, WIDE CENTRAL STAIRS, RAILINGS & POST LANTERNS
  // ==========================================================================
  buildMossyStonePlinth(THREE, K, {
    w: W + 0.2,
    d: D + 0.2,
    h: FL,
    doorX: 0,
    doorW: 2.35,
    steps: 4,
    hydrangeas: true,
    parent: root,
  });

  // Extra sculpted faceted Storybook shoreline boulders at front corners (matching ext_05!)
  {
    const shoreRockGeo = () => new THREE.IcosahedronGeometry(0.46, 0);
    for (const sx of [-1, 1]) {
      pushInst('shr_shore_rk', shoreRockGeo, bm.stoneInst, sx * 3.85, 0.24, 4.35, 0.3, 0.5 * sx, 0.1, 1.45, 0.95, 1.25, 0x7f7a8c, root);
      pushInst('shr_shore_rk', shoreRockGeo, bm.stoneInst, sx * 3.15, 0.16, 4.65, 0.6, 1.1 * sx, 0.2, 1.05, 0.68, 0.95, 0x6f8b62, root);
      pushInst('shr_shore_rk', shoreRockGeo, bm.stoneInst, sx * 4.55, 0.20, 3.85, 0.2, 0.8 * sx, 0.4, 1.22, 0.85, 1.15, 0x8b8494, root);
    }
  }

  // Merged single-draw-call walkable ground mesh covering sanctuary floor + 4 front steps!
  {
    const groundGeos = [];
    const mainSlab = new THREE.BoxGeometry(W - 0.1, 0.12, D - 0.1);
    mainSlab.translate(0, FL - 0.055, 0);
    groundGeos.push(mainSlab);

    const hd = (D + 0.2) * 0.5 + 0.12;
    for (let s = 0; s < 4; s++) {
      const stepTop = FL * (1 - s / 4);
      const tr = new THREE.BoxGeometry(2.58, 0.13, 0.44);
      tr.translate(0, stepTop - 0.06, hd + s * 0.34 + 0.18);
      groundGeos.push(tr);
    }
    const walkMesh = new THREE.Mesh(mergeGeometries(groundGeos, false), twilightStone);
    walkMesh.name = 'shrine_walkable_floor';
    walkMesh.receiveShadow = true;
    walkMesh.userData.ground = true;
    walkMesh.userData.keep = true;
    root.add(walkMesh);
    groundGeos.forEach((g) => g.dispose());
  }

  // Low-poly crisp instanced twilight flagstones across sanctuary & front steps!
  {
    const paverGeo = () => new THREE.BoxGeometry(0.68, 0.022, 0.54);
    for (let ix = -5; ix <= 5; ix++) {
      for (let iz = -5; iz <= 5; iz++) {
        const px = ix * 0.74 + (iz % 2) * 0.22 + jr(-0.02, 0.02);
        const pz = iz * 0.60 + jr(-0.02, 0.02);
        if (Math.abs(px) > 4.05 || Math.abs(pz) > 3.35) continue;
        pushInst('shrine_paver', paverGeo, bm.stoneInst,
          px, FL + 0.008, pz, 0, jr(-0.018, 0.018), 0,
          jr(0.92, 1.04), 1, jr(0.92, 1.04), pick(flagstonePal), root);
      }
    }
    // Dressed stone step blocks across the 4 central stairs
    const hd = (D + 0.2) * 0.5 + 0.12;
    for (let s = 0; s < 4; s++) {
      const stepTop = FL * (1 - s / 4);
      const sz = hd + s * 0.34 + 0.18;
      for (let c = -2; c <= 2; c++) {
        pushInst('shrine_paver', paverGeo, bm.stoneInst,
          c * 0.48 + (s % 2) * 0.08, stepTop + 0.008, sz,
          0, 0, 0, 0.68, 1.2, 0.72, pick(flagstonePal), root);
      }
    }
  }

  // Vermilion central stair handrails + golden giboshi ball finials
  const zPorch = D * 0.5 + 0.02;
  const zFoot = zPorch + 1.48;
  for (const sx of [-1, 1]) {
    const rx = sx * 1.28;
    // Top & bottom newel posts
    add(rbox(0.15, 0.78, 0.15, 0.03, bm.vermilion), rx, FL + 0.39, zPorch, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), bm.goldTrim), rx, FL + 0.83, zPorch, 0, 0, 0, root);
    add(rbox(0.15, 0.76, 0.15, 0.03, bm.vermilion), rx, 0.38, zFoot, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), bm.goldTrim), rx, 0.81, zFoot, 0, 0, 0, root);
    // Mid baluster post
    add(rbox(0.10, 0.64, 0.10, 0.02, bm.vermilion), rx, FL * 0.5 + 0.32, (zPorch + zFoot) * 0.5, 0, 0, 0, root);
    // Sloped top & middle vermilion rails
    K.beam([rx, FL + 0.72, zPorch], [rx, 0.70, zFoot], 0.095, bm.vermilion, root);
    K.beam([rx, FL + 0.42, zPorch], [rx, 0.40, zFoot], 0.065, bm.vermilion, root);
    // Cheek wall base curb
    K.beam([rx, FL + 0.08, zPorch], [rx, 0.08, zFoot], 0.16, bm.vermilionDeep, root);
    boxCol(rx, (zPorch + zFoot) * 0.5, 0.22, zFoot - zPorch);
  }

  // Vermilion perimeter veranda railings on Front-Left & Front-Right + golden giboshi finials
  for (const sx of [-1, 1]) {
    const xIn = sx * 1.32, xOut = sx * 4.26;
    const xMid = (xIn + xOut) * 0.5, spanW = Math.abs(xOut - xIn);
    add(rbox(spanW, 0.085, 0.095, 0.025, bm.vermilion), xMid, FL + 0.68, zPorch, 0, 0, 0, root);
    add(rbox(spanW, 0.06, 0.07, 0.02, bm.vermilion), xMid, FL + 0.38, zPorch, 0, 0, 0, root);
    add(rbox(spanW, 0.07, 0.11, 0.02, bm.vermilionDeep), xMid, FL + 0.08, zPorch, 0, 0, 0, root);
    for (const px of [sx * 2.30, sx * 3.28, xOut]) {
      add(rbox(0.13, 0.72, 0.13, 0.025, bm.vermilion), px, FL + 0.36, zPorch, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 6), bm.goldTrim), px, FL + 0.76, zPorch, 0, 0, 0, root);
    }
    boxCol(xMid, zPorch, spanW, 0.22);
  }

  // Twin standing stone/timber Toro Post Lanterns flanking front corners (matching ext_05!)
  for (const sx of [-1, 1]) {
    add(rbox(0.58, FL + 0.14, 0.58, 0.06, bm.mossStone), sx * 4.22, (FL + 0.14) * 0.5, zPorch + 0.36, 0, 0, 0, root);
    addPostLantern(THREE, K, { x: sx * 4.22, y: FL + 0.14, z: zPorch + 0.36, height: 1.58, stone: false, parent: root });
  }
  // Gallery shoreline floating/waterside square lanterns (only when opts.garden !== false)
  if (K.garden) {
    for (const sx of [-1, 1]) {
      const lx = sx * 2.35, lz = zFoot + 0.35;
      add(rbox(0.42, 0.06, 0.42, 0.015, bm.darkTimber), lx, 0.03, lz, 0, 0.08 * sx, 0, root);
      add(rbox(0.30, 0.34, 0.30, 0.02, bm.lanternGlow), lx, 0.22, lz, 0, 0.08 * sx, 0, root);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.12, 4), bm.darkTimber), lx, 0.43, lz, 0, PI * 0.25 + 0.08 * sx, 0, root);
    }
  }

  // ==========================================================================
  // 2. SANCTUARY WALLS, KUMIKO SHOJI BAYS & OPEN VERMILION PORTAL (ext_05)
  // ==========================================================================
  // Front wall recessed behind veranda (z = 2.92) with wide open 2.86m central portal + twin glowing Kumiko Shoji bays
  const zFrontWall = 2.92;
  wall(0, zFrontWall, 0, 8.48, H_WALL, TH, [
    { u: 0, w: 2.86, h: 2.94, door: true },
    { u: -2.92, w: 1.88, h: 1.38, y0: 1.24 },
    { u: 2.92, w: 1.88, h: 1.38, y0: 1.24 },
  ], bm.cedar, bm.warmInnerWall, root, true);

  for (const sx of [-1, 1]) {
    // Timber dado wainscoting below front shoji windows
    add(rbox(2.24, 0.78, 0.06, 0.015, bm.darkTimber, 1), sx * 2.92, FL + 0.39, zFrontWall + 0.02, 0, 0, 0, root);
    for (let k = -4; k <= 4; k++) {
      add(rbox(0.035, 0.74, 0.08, 0.01, bm.rafterWood, 1), sx * 2.92 + k * 0.23, FL + 0.39, zFrontWall + 0.03, 0, 0, 0, root);
    }
    addKumikoWindow(THREE, K, {
      cx: sx * 2.92, cy: 1.93, cz: zFrontWall - TH * 0.5, rotY: 0,
      w: 1.94, h: 1.42, cols: 5, rows: 4, parent: root,
    });
  }

  // Back wall (z = -3.42, facing -Z) with shoji window between maku & partition + right alcove window
  wall(0, -3.42, PI, 8.52, H_WALL, TH, [
    { u: -0.05, w: 1.05, h: 1.45, y0: 1.20 }, // maps to world x = +0.05
    { u: -2.35, w: 1.45, h: 1.35, y0: 1.25 }, // maps to world x = +2.35 (ema_hall back window)
  ], bm.cedar, bm.warmInnerWall, root, true);
  addKumikoWindow(THREE, K, { cx: 0.05, cy: 1.92, cz: -3.42 + TH * 0.5, rotY: PI, w: 1.08, h: 1.48, cols: 3, rows: 4, parent: root });
  addKumikoWindow(THREE, K, { cx: 2.35, cy: 1.92, cz: -3.42 + TH * 0.5, rotY: PI, w: 1.48, h: 1.38, cols: 4, rows: 4, parent: root });

  // Left wall (x = -4.26, facing -X) with 2 tall glowing Kumiko Shoji bays (visible in int_05!)
  wall(-4.26, -0.25, -PI * 0.5, 6.42, H_WALL, TH, [
    { u: -1.45, w: 1.65, h: 1.48, y0: 1.22 },
    { u: 1.45, w: 1.65, h: 1.48, y0: 1.22 },
  ], bm.cedar, bm.warmInnerWall, root, true);
  for (const wz of [-1.70, 1.20]) {
    addKumikoWindow(THREE, K, { cx: -4.26 + TH * 0.5, cy: 1.96, cz: wz, rotY: PI * 0.5, w: 1.68, h: 1.52, cols: 4, rows: 4, parent: root });
  }

  // Right wall (x = +4.26, facing +X) with dark timber interior boarding behind Ema rack + 2 upper Kumiko clerestories!
  wall(4.26, -0.25, PI * 0.5, 6.42, H_WALL, TH, [
    { u: 1.10, w: 1.65, h: 0.44, y0: 2.74 },  // maps to world z = -1.35
    { u: -1.15, w: 1.65, h: 0.44, y0: 2.74 }, // maps to world z = +0.90
  ], bm.cedar, bm.darkTimber, root, true);
  for (const wz of [-1.35, 0.90]) {
    addKumikoWindow(THREE, K, { cx: 4.26 - TH * 0.5, cy: 2.96, cz: wz, rotY: -PI * 0.5, w: 1.68, h: 0.46, cols: 5, rows: 2, parent: root });
  }

  // 4 Hero Vermilion Sanctuary Front Pillars with dark stone bases & golden collar bands (ext_05!)
  const frontPillars = [
    [-4.16, 3.38, 0.19],
    [-1.56, 3.42, 0.24],
    [1.56, 3.42, 0.24],
    [4.16, 3.38, 0.19],
  ];
  for (const [px, pz, pr] of frontPillars) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(pr * 1.12, pr * 1.18, 0.42, 14), darkBaseIron), px, FL + 0.21, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(pr * 1.16, pr * 1.16, 0.055, 14), bm.goldTrim), px, FL + 0.43, pz, 0, 0, 0, root);
    const colH = H_WALL - FL - 0.42;
    add(new THREE.Mesh(new THREE.CylinderGeometry(pr * 0.94, pr, colH, 14), bm.vermilion), px, FL + 0.42 + colH * 0.5, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(pr * 1.08, pr * 1.08, 0.075, 14), bm.goldTrim), px, H_WALL - 0.14, pz, 0, 0, 0, root);
  }
  // Back & interior vermilion corner/sanctuary columns (visible in int_05!)
  for (const [px, pz] of [[-4.06, -3.22], [-0.36, -3.12], [0.65, 2.28], [4.06, -3.22]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.36, 12), darkBaseIron), px, FL + 0.18, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), bm.goldTrim), px, FL + 0.37, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.165, H_WALL - FL - 0.36, 12), bm.vermilion), px, (H_WALL + FL + 0.36) * 0.5, pz, 0, 0, 0, root);
  }

  // Grand Vermilion Front Portal Lintel Beam (Koryo) + Golden Corner Brackets + Shimenawa & 4 Shide + 2 Front Hex Lanterns
  add(rbox(3.56, 0.22, 0.28, 0.04, bm.vermilion), 0, 3.13, 3.42, 0, 0, 0, root);
  add(rbox(8.56, 0.18, 0.24, 0.03, bm.vermilionDeep), 0, 3.14, zFrontWall - 0.08, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    add(rbox(0.32, 0.16, 0.32, 0.03, bm.goldTrim), sx * 1.36, 3.12, 3.44, 0, 0, 0, root);
    // Warm hanging hexagonal brass shrine lanterns on front pillars (ext_05!)
    addHexShrineLantern(THREE, K, bm, sx * 1.58, 2.40, 3.74, 3.06, 1.06, root);
  }

  buildShimenawaWithShide(THREE, K, strawGold, shideWhite, {
    cx: 0, yEnds: 3.04, sag: 0.30, z: 3.44, span: 2.88, maxR: 0.095, shideCount: 4, parent: root,
  });

  // ==========================================================================
  // 3. 2-ROOM DOLLHOUSE CUTAWAY INTERIOR (int_05_shrine_gatehouse.png)
  // ==========================================================================
  // Partition wall at x = 0.65 (cx = 0.55, th = 0.20, rotY = -PI/2 -> center x = 0.65!)
  // Runs z ∈ [-3.30, +2.28] (cz = -0.51, L = 5.58) capped by the vermilion pillar at (0.65, 2.28),
  // with wide open portal at z = 0.30 (u = 0.81 -> -0.51 + 0.81 = +0.30, w = 1.65, h = 2.45)!
  wall(0.55, -0.51, -PI * 0.5, 5.58, H_WALL, 0.20, [
    { u: 0.81, w: 1.65, h: 2.45, door: true },
    { u: -1.65, w: 1.18, h: 1.48, y0: 0.94 }, // glowing shoji screen panel on partition (int_05!)
  ], bm.darkTimber, bm.cedar, root, true);
  // Portal vermilion jambs, lintel & transom kumiko lattice
  add(rbox(0.24, 0.14, 1.82, 0.03, bm.vermilion, 1), 0.65, 2.50, 0.30, 0, 0, 0, root);
  for (const sz of [-0.84, 0.84]) {
    add(rbox(0.24, 2.50 - FL, 0.12, 0.025, bm.vermilion, 1), 0.65, FL + (2.50 - FL) * 0.5, 0.30 + sz, 0, 0, 0, root);
  }
  addKumikoWindow(THREE, K, { cx: 0.65, cy: 2.86, cz: 0.30, rotY: PI * 0.5, w: 1.62, h: 0.52, cols: 5, rows: 2, parent: root });
  addKumikoWindow(THREE, K, { cx: 0.65, cy: 1.68, cz: -2.16, rotY: PI * 0.5, w: 1.20, h: 1.50, cols: 3, rows: 4, parent: root });

  // --- LEFT ROOM: Taiko Sanctum (x ∈ [-4.1, 0.5], z ∈ [-3.3, 3.2]) ---
  // Purple sacred Maku bunting curtain with white crests across the back wall + upper interior Shimenawa & 3 Shide
  add(rbox(3.56, 0.08, 0.08, 0.02, bm.darkTimber, 1), -2.15, 2.92, -3.12, 0, 0, 0, root);
  add(new THREE.Mesh(new RoundedBoxGeometry(3.48, 1.42, 0.045, 1, 0.015), makuMat), -2.15, 2.18, -3.12, 0, 0, 0, root);
  buildShimenawaWithShide(THREE, K, strawGold, shideWhite, {
    cx: -2.12, yEnds: 3.00, sag: 0.22, z: -3.02, span: 3.28, maxR: 0.072, shideCount: 3, parent: root,
  });

  // Raised wooden sanctuary dais + Giant Ornate Sacred Tomoe Taiko Drum at (x = -1.42, z = -1.70)
  // Framed cleanly through the open +Z portal while keeping doorX = 0 -> (0, 2.45) -> (0.65, 0.3) 100% wide open!
  const tx = -1.42, tz = -1.70;
  add(rbox(2.12, 0.14, 1.46, 0.03, bm.cedar, 1), tx, FL + 0.07, tz, 0, 0, 0, root);
  add(rbox(2.20, 0.045, 1.54, 0.02, bm.hinoki, 1), tx, FL + 0.15, tz, 0, 0, 0, root);

  // Carved wooden Taiko stand (Yagura-dai) with splayed legs & crossbars
  const standY = FL + 0.17;
  for (const sx of [-0.58, 0.58]) {
    for (const sz of [-0.34, 0.34]) {
      add(rbox(0.12, 0.50, 0.12, 0.02, bm.cedar, 1), tx + sx, standY + 0.24, tz + sz, sz * 0.12, 0, -sx * 0.16, root);
    }
    add(rbox(0.13, 0.11, 0.92, 0.02, bm.hinoki, 1), tx + sx * 1.02, standY + 0.44, tz, 0, 0, 0, root);
  }
  add(rbox(1.52, 0.11, 0.13, 0.02, bm.hinoki, 1), tx, standY + 0.28, tz + 0.34, 0, 0, 0, root);
  add(rbox(1.52, 0.11, 0.13, 0.02, bm.hinoki, 1), tx, standY + 0.28, tz - 0.34, 0, 0, 0, root);
  for (const bx of [-0.22, 0.18]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.44, 8), bm.hinoki),
      tx + bx, standY + 0.35, tz + 0.38, 0.15, 0.25, PI * 0.46, root);
  }

  // Giant bulged Taiko barrel body (radius ≈ 0.68m!) + Tomoe drumheads + 36 brass tacks
  const drumY = standY + 0.98;
  const drumRotY = 0.14;
  const barrelLathe = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, -0.45),
    new THREE.Vector2(0.64, -0.45),
    new THREE.Vector2(0.73, -0.23),
    new THREE.Vector2(0.75, 0.0),
    new THREE.Vector2(0.73, 0.23),
    new THREE.Vector2(0.64, 0.45),
    new THREE.Vector2(0.0, 0.45),
  ], 26);
  barrelLathe.rotateX(PI * 0.5);
  add(new THREE.Mesh(barrelLathe, bm.darkTimber), tx, drumY, tz, 0, drumRotY, 0, root);

  const headMat = K.M(0xffffff, bm.BT.taikoHead, { roughness: 0.70, metalness: 0, emissive: 0x7c4a16, emissiveIntensity: 0.22 });
  const rimSkinMat = K.M(0xebd4aa, null, { roughness: 0.78, metalness: 0 });
  const tackGeo = () => new THREE.SphereGeometry(0.025, 6, 5);
  for (const sz of [-1, 1]) {
    const faceG = new THREE.CircleGeometry(0.635, 26);
    add(new THREE.Mesh(faceG, headMat), tx + Math.sin(drumRotY) * sz * 0.455, drumY, tz + Math.cos(drumRotY) * sz * 0.455,
      0, (sz > 0 ? 0 : PI) + drumRotY, 0, root);
    const rimC = new THREE.CylinderGeometry(0.66, 0.68, 0.09, 24, 1, true);
    rimC.rotateX(PI * 0.5);
    add(new THREE.Mesh(rimC, rimSkinMat), tx + Math.sin(drumRotY) * sz * 0.41, drumY, tz + Math.cos(drumRotY) * sz * 0.41, 0, drumRotY, 0, root);
    for (let t = 0; t < 18; t++) {
      const a = (t / 18) * TAU;
      const lx = Math.cos(a) * 0.665, ly = Math.sin(a) * 0.665, lz = sz * 0.42;
      const wx = tx + lx * Math.cos(drumRotY) + lz * Math.sin(drumRotY);
      const wz = tz - lx * Math.sin(drumRotY) + lz * Math.cos(drumRotY);
      pushInst('taiko_tack', tackGeo, bm.goldTrim, wx, drumY + ly, wz, 0, 0, 0, 1, 1, 1, 0xf4c44e, root);
    }
  }
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12), bm.goldTrim),
      tx + sx * 0.75, drumY, tz, 0, PI * 0.5 + drumRotY, 0, root);
  }
  boxCol(tx, tz, 1.65, 1.28);

  // 3 Ornate Hanging Golden Hexagonal Shrine Lanterns across the sanctuary (int_05!)
  // Kept below y = 3.24m so they remain visible & luminous in interior cutaway mode!
  add(rbox(5.4, 0.13, 0.15, 0.03, bm.vermilion), -0.85, 3.16, -0.35, 0, 0, 0, root);
  addHexShrineLantern(THREE, K, bm, -2.35, 2.58, -0.35, 3.14, 1.02, root);
  addHexShrineLantern(THREE, K, bm, -0.55, 2.58, -0.35, 3.14, 1.02, root);
  addHexShrineLantern(THREE, K, bm, 1.55, 2.58, -0.35, 3.14, 0.96, root);

  // Interior sanctuary post lanterns & vermilion side balustrade accents (int_05!)
  addPostLantern(THREE, K, { x: -3.45, y: FL, z: 2.35, height: 1.48, stone: false, parent: root });
  addPostLantern(THREE, K, { x: 0.15, y: FL, z: -2.65, height: 1.42, stone: false, parent: root });
  boxCol(-3.45, 2.35, 0.42, 0.42);
  boxCol(0.15, -2.65, 0.42, 0.42);

  // --- RIGHT ROOM: Ema Wish & Omikuji Fortune Hall (x ∈ [0.8, 4.1], z ∈ [-3.3, 3.2]) ---
  // Warm wooden paneled Shrine Counter along right wall (x ≈ 3.35, z ≈ -0.55)
  const cxCnt = 3.38, czCnt = -0.50, wCnt = 1.06, dCnt = 3.92, hCnt = 0.90;
  add(rbox(wCnt, hCnt, dCnt, 0.03, bm.cedar), cxCnt, FL + hCnt * 0.5, czCnt, 0, 0, 0, root);
  add(rbox(wCnt + 0.12, 0.075, dCnt + 0.14, 0.025, bm.hinoki), cxCnt - 0.02, FL + hCnt + 0.03, czCnt, 0, 0, 0, root);
  // Recessed front wainscoting frames on counter
  for (let p = 0; p < 4; p++) {
    const pz = czCnt - dCnt * 0.375 + p * (dCnt * 0.25);
    add(rbox(0.04, hCnt - 0.18, dCnt * 0.21, 0.015, bm.darkTimber), cxCnt - wCnt * 0.5 - 0.01, FL + hCnt * 0.48, pz, 0, 0, 0, root);
  }

  // 3 Wooden Omikuji Fortune-Paper Stands filled with crisp white rolled fortune scrolls!
  const scrollGeo = () => {
    const g = new THREE.CylinderGeometry(0.028, 0.028, 0.30, 7);
    g.rotateZ(-0.42);
    return g;
  };
  const cntTopY = FL + hCnt + 0.07;
  for (const sz of [-1.35, -0.35, 0.62]) {
    add(rbox(0.54, 0.12, 0.68, 0.02, bm.darkTimber), cxCnt - 0.05, cntTopY + 0.06, czCnt + sz, 0, 0, 0, root);
    add(rbox(0.46, 0.28, 0.06, 0.015, bm.cedar), cxCnt + 0.14, cntTopY + 0.16, czCnt + sz, 0, 0, 0, root);
    for (let s = 0; s < 5; s++) {
      pushInst('omikuji_scroll', scrollGeo, shideWhite,
        cxCnt - 0.04 + (s % 2) * 0.06, cntTopY + 0.20, czCnt + sz - 0.22 + s * 0.11,
        0, 0, 0, 1, 1, 1, 0xfff8ea, root);
    }
  }

  // Slatted Wooden Saisen-Bako Offertory Box + Fortune Shaker + Counter Lantern
  add(rbox(0.62, 0.46, 0.72, 0.025, bm.hinoki), cxCnt - 0.06, cntTopY + 0.23, czCnt - 2.38 > -3.0 ? czCnt - 2.20 : -2.68, 0, 0, 0, root);
  for (let b = -2; b <= 2; b++) {
    add(rbox(0.08, 0.03, 0.64, 0.01, bm.darkTimber), cxCnt - 0.06 + b * 0.10, cntTopY + 0.47, -2.68, 0, 0, 0, root);
  }
  add(rbox(0.66, 0.06, 0.76, 0.015, bm.goldTrim), cxCnt - 0.06, cntTopY + 0.45, -2.68, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 6), bm.hinoki), cxCnt - 0.18, cntTopY + 0.12, czCnt + 1.22, 0, 0.3, 0, root);
  addPostLantern(THREE, K, { x: cxCnt - 0.08, y: cntTopY, z: czCnt + 1.62, height: 0.96, stone: false, parent: root });
  boxCol(cxCnt, -0.68, wCnt + 0.16, 4.35);

  // 32 Instanced Hanging Pentagonal Wooden Ema Wish Plaques with Red Cords on Right Wall!
  {
    const emaGeo = () => {
      const s = new THREE.Shape();
      s.moveTo(-0.125, -0.095);
      s.lineTo(0.125, -0.095);
      s.lineTo(0.125, 0.045);
      s.lineTo(0.0, 0.115);
      s.lineTo(-0.125, 0.045);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
      g.rotateY(-PI * 0.5); // face -X into ema_hall!
      return g;
    };
    const cordGeo = () => new THREE.BoxGeometry(0.032, 0.115, 0.034);

    const emaWallX = 3.96;
    const rows = 4, cols = 8; // 4 * 8 = 32 Ema wish plaques!
    for (let r = 0; r < rows; r++) {
      const ry = 1.68 + r * 0.30;
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 3.88, 8), bm.hinoki);
      add(rail, emaWallX, ry + 0.13, -0.45, PI * 0.5, 0, 0, root);
      for (let c = 0; c < cols; c++) {
        const pz = -2.18 + c * 0.49 + jr(-0.015, 0.015);
        const tilt = jr(-0.06, 0.06);
        pushInst('ema_plaque', emaGeo, emaMat,
          emaWallX - 0.02, ry, pz,
          tilt * 0.4, jr(-0.05, 0.05), jr(-0.04, 0.04),
          1, 1, 1, pick([0xfff6e6, 0xf7e6c4, 0xffeed2, 0xf2dcb4]), root);
        pushInst('ema_cord', cordGeo, redCordMat,
          emaWallX - 0.046, ry + 0.11, pz,
          0.18, 0, jr(-0.12, 0.12), 1, 1, 1, 0xe83226, root);
      }
    }
  }

  // Subtle warm interior PointLight for golden shrine ambiance
  if (opts.light !== false) {
    const pl = new THREE.PointLight(0xffb44c, 1.35, 9.5, 1.8);
    pl.position.set(-0.6, 2.55, 0.2);
    root.add(pl);
  }

  // ==========================================================================
  // 4. DOUBLE-TIER VERDIGRIS KAWARA ROOF & GOLDEN CRESCENT FINIAL (in K.roofG!)
  // Everything above y = 3.3m is placed in roofG so cutaway view is 100% clean!
  // ==========================================================================
  // Upper frieze beam & bracket cornice above H_WALL (y = 3.26 .. 3.68)
  add(rbox(W - 0.08, 0.34, D - 0.22, 0.04, bm.vermilionDeep), 0, 3.42, -0.22, 0, 0, 0, roofG);
  for (const [px, pz, pr] of frontPillars) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 0.96, 0.36, 12), bm.vermilion), px, 3.42, pz, 0, 0, 0, roofG);
    add(rbox(pr * 2.8, 0.16, pr * 2.8, 0.03, bm.vermilion), px, 3.60, pz, 0, 0, 0, roofG);
    add(rbox(pr * 2.2, 0.10, pr * 2.2, 0.02, bm.goldTrim), px, 3.48, pz, 0, 0, 0, roofG);
  }

  // Tier 1: Lower Verdigris 3D Kawara Pent Eave Awnings flanking left/right verandas & side wings
  buildKawaraPentAwning(THREE, K, {
    cx: -3.02, zWall: 2.85, yWall: 3.68, width: 3.45, depth: 1.48, drop: 0.44,
    palette: VERDIGRIS_PAL, parent: roofG, batchPrefix: 'shr_pent_fl',
  });
  buildKawaraPentAwning(THREE, K, {
    cx: 3.02, zWall: 2.85, yWall: 3.68, width: 3.45, depth: 1.48, drop: 0.44,
    palette: VERDIGRIS_PAL, parent: roofG, batchPrefix: 'shr_pent_fr',
  });

  // Upper Sanctuary Attic / Clerestory Drum supporting Tier 2 Roof
  add(rbox(6.6, 0.68, 5.1, 0.05, bm.darkTimber), 0, 3.88, -0.18, 0, 0, 0, roofG);
  add(rbox(6.75, 0.16, 5.25, 0.03, bm.vermilion), 0, 4.18, -0.18, 0, 0, 0, roofG);

  // Tier 2A: Sweeping Main East-West Verdigris Kawara Gable Roof crowned with Golden Crescent Finial!
  const mainRoof = buildKawaraGableRoof(THREE, K, {
    cx: 0, cz: -0.18, yBase: 4.12,
    spanX: 7.4, spanZ: 5.5, rise: 1.92,
    overhangX: 0.92, overhangZ: 0.86,
    ridgeAlongX: true,
    palette: VERDIGRIS_PAL,
    finial: 'crescent',
    parent: roofG,
    batchPrefix: 'shr_main',
  });

  // Sculpted Golden Cloud-Scroll & Sun-Disc Pedestal enriching the Crescent Moon Crown at the Ridge Peak!
  {
    const peakY = mainRoof.ridgeY;
    const pz = -0.18;
    add(rbox(1.18, 0.22, 0.46, 0.06, bm.darkTimber), 0, peakY + 0.22, pz, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 8, 18), bm.goldTrim), 0, peakY + 0.36, pz + 0.20, 0, 0, 0, roofG);
    for (const sx of [-1, 1]) {
      const scroll = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.18, peakY + 0.34, pz + 0.18),
        new THREE.Vector3(sx * 0.46, peakY + 0.26, pz + 0.18),
        new THREE.Vector3(sx * 0.62, peakY + 0.38, pz + 0.18),
      ]);
      add(new THREE.Mesh(new THREE.TubeGeometry(scroll, 10, 0.042, 6, false), bm.goldTrim), 0, 0, 0, 0, 0, 0, roofG);
    }
    // Extra bold hero golden crescent accent ring so it gleams against the twilight sky from afar
    const cPts = [];
    for (let i = 0; i <= 26; i++) {
      const a = -0.80 * PI + (i / 26) * 1.60 * PI;
      cPts.push(new THREE.Vector2(Math.sin(a) * 0.66, -Math.cos(a) * 0.66));
    }
    for (let i = 26; i >= 0; i--) {
      const a = -0.70 * PI + (i / 26) * 1.40 * PI;
      cPts.push(new THREE.Vector2(Math.sin(a) * 0.44, 0.22 - Math.cos(a) * 0.46));
    }
    const cGeo = new THREE.ExtrudeGeometry(new THREE.Shape(cPts), {
      depth: 0.15, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2,
    });
    cGeo.translate(0, 0, -0.075);
    add(new THREE.Mesh(cGeo, bm.goldTrim), 0, peakY + 0.96, pz, 0, 0, 0, roofG);
  }

  // Tier 2B: Prominent Forward-Projecting Sanctuary Gable (+Z) with Sculpted 3D Gold Filigree Bargeboard!
  const frontGable = buildKawaraGableRoof(THREE, K, {
    cx: 0, cz: 1.82, yBase: 3.68,
    spanX: 4.55, spanZ: 3.15, rise: 1.56,
    overhangX: 0.68, overhangZ: 0.68,
    ridgeAlongX: false,
    palette: VERDIGRIS_PAL,
    finial: 'none',
    parent: roofG,
    batchPrefix: 'shr_fgab',
  });

  // Recessed crimson-timber tympanum + Rainbow Tie-Beam + Sculpted 3D Golden Filigree Gegyo Crest on Front Gable!
  {
    const gz = 1.82 + frontGable.ridgeLen * 0.5;
    const gyApex = frontGable.ridgeY;
    // Tympanum triangular backing
    const tymShape = new THREE.Shape();
    tymShape.moveTo(-2.35, 3.66);
    tymShape.lineTo(2.35, 3.66);
    tymShape.lineTo(0, gyApex - 0.08);
    tymShape.closePath();
    const tymGeo = new THREE.ExtrudeGeometry(tymShape, { depth: 0.14, bevelEnabled: false });
    add(new THREE.Mesh(tymGeo, bm.darkTimber), 0, 0, gz - 0.52, 0, 0, 0, roofG);

    // Rainbow tie-beam (Koryo) + King-post (Kaerumata frog-leg strut) in front gable
    add(rbox(3.65, 0.22, 0.24, 0.04, bm.vermilion), 0, 3.74, gz - 0.22, 0, 0, 0, roofG);
    add(rbox(0.46, 0.62, 0.18, 0.04, bm.vermilion), 0, 4.18, gz - 0.22, 0, 0, 0, roofG);

    // Rich 3D Golden Filigree Gegyo Crest & Cloud Scrolls at Gable Peak + Rafter Ends (matching ext_05 & int_05!)
    add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), bm.goldTrim), 0, gyApex - 0.28, gz + 0.08, 0, 0, 0, roofG);
    add(rbox(0.32, 0.32, 0.09, 0.03, bm.goldTrim), 0, gyApex - 0.44, gz + 0.06, 0, 0, PI * 0.25, roofG);
    for (const sx of [-1, 1]) {
      const filigree = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.14, gyApex - 0.24, gz + 0.07),
        new THREE.Vector3(sx * 0.48, gyApex - 0.36, gz + 0.07),
        new THREE.Vector3(sx * 0.72, gyApex - 0.56, gz + 0.07),
        new THREE.Vector3(sx * 0.52, gyApex - 0.66, gz + 0.08),
      ]);
      add(new THREE.Mesh(new THREE.TubeGeometry(filigree, 12, 0.042, 6, false), bm.goldTrim), 0, 0, 0, 0, 0, 0, roofG);
      // Golden bargeboard end-plates
      add(rbox(0.44, 0.20, 0.16, 0.03, bm.goldTrim), sx * 1.65, 4.15, gz + 0.05, 0, 0, -sx * frontGable.theta, roofG);
      add(rbox(0.36, 0.18, 0.16, 0.03, bm.goldTrim), sx * 2.55, 3.68, gz + 0.05, 0, 0, -sx * 0.18, roofG);
      // Lower tie-beam gold filigree scroll
      add(rbox(0.52, 0.14, 0.08, 0.025, bm.goldTrim), sx * 0.36, 3.88, gz - 0.08, 0, 0, -sx * 0.16, roofG);
    }
  }

  // ==========================================================================
  // 5. REQUIRED USERDATA: ROOMS, DOORS & 9 INDOOR PROP SLOTS
  // ==========================================================================
  root.userData.footprint = { w: W, d: D };
  root.userData.rooms = [
    { name: 'taiko_sanctum', x: -1.725, z: -0.05, w: 4.75, d: 6.5, walkX: -1.15, walkZ: 0.75 }, // x ∈ [-4.10, 0.65]
    { name: 'ema_hall', x: 2.375, z: -0.05, w: 3.45, d: 6.5, walkX: 1.65, walkZ: 0.30 },     // x ∈ [0.65, 4.10]
  ];
  root.userData.door = { x: 0, z: 4.65 };
  root.userData.doorIn = { x: 0, z: 2.45 };
  root.userData.innerDoors = [{ x: 0.65, z: 0.3 }];
  root.userData.propSlots = [
    { id: 'bh_stone_fox', x: -3.25, y: FL, z: 1.55, rot: 0.65 },
    { id: 'bh_stone_fox', x: -3.35, y: FL, z: -2.45, rot: 0.92 },
    { id: 'bh_taiko_drum', x: -3.25, y: FL, z: -0.15, rot: 1.42 },
    { id: 'bh_sake_cask', x: -0.55, y: FL, z: -2.35, rot: -0.28 },
    { id: 'bh_paper_lantern', x: -2.35, y: FL, z: 2.35, rot: 0.0 },
    { id: 'bh_daruma_doll', x: 2.35, y: FL, z: -2.45, rot: 0.38 },
    { id: 'bh_sake_cask', x: 2.35, y: FL, z: -1.35, rot: 1.15 },
    { id: 'bh_bonsai_pot', x: 1.65, y: FL, z: 2.35, rot: -0.55 },
    { id: 'bh_paper_lantern', x: 2.45, y: FL, z: 2.35, rot: 0.18 },
  ];

  return K.finalize();
}
