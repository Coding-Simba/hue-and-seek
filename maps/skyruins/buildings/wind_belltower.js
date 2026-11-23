// ============================================================================
// Celestia Sky-Ruins (Celestia) — Temple of the Four Winds Colonnade
// (maps/skyruins/buildings/wind_belltower.js)
// Handcrafted 1:1 from Panel 5 Codex references (ext_05.png & int_05.png):
//   - Floating mossy Celestian limestone plinth, grand stairs, twin waterfalls & twin cyan obelisks
//   - 12 Classical Fluted Cream-Travertine Columns around a sunlit rotunda court
//     + right-side arched pergola gallery (pergola_walk)
//   - Grand Front Arched Pediment crowned with a Golden Sun-Sphere Armillary
//     Emblem (K.roofG above y = 3.3m) draped in sunlit ivy, white blossoms & wisteria
//   - 24 gleaming golden-brass tubular wind chimes (tips >= 1.89m) + 4 Royal-Blue
//     Sun-Star Temple Banners + Golden Sun-Compass Mosaic + 4 curved oak benches
// ALL materials use metalness: 0 for warm luminous Storybook rendering!
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
  mergeGeometries,
} from '../../map_kit.js?v=2';
import {
  getSkyMats,
  sharedSkyGeo,
  buildMossyIslandPlinth,
  buildCrystalObeliskLantern,
  buildFlutedColumn,
  buildStoneArch,
  buildWisteriaRacemes,
  buildSkyOrchidCluster,
  TRAVERTINE_PAL,
  MOSS_PAL,
  FOLIAGE_SUN_PAL,
  WISTERIA_PAL,
  WILDFLOWER_PAL,
} from '../sky_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

let _wbTexCache = null;
function getWindBelltowerTextures(THREE) {
  if (_wbTexCache && _wbTexCache._T === THREE) return _wbTexCache;

  // 1. Rich Sun-Compass & Slate-Azure Wind-Rose Mosaic (matches int_05.png & ext_05.png!)
  const sunZodiacFloor = paintedCanvasTex(THREE, 'sr_wb_sun_zodiac_v2', 512, (ctx, s, rng) => {
    const c = s * 0.5;
    ctx.fillStyle = '#f5ead3';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 220, ['#fcf5e6', '#e7d8bc', '#f1e4ca'], 5, 14, 0.32);

    // Outer slate-azure Celestian wind-glyph ring (visible around compass in ext_05 & int_05!)
    ctx.strokeStyle = '#5678a6';
    ctx.lineWidth = s * 0.086;
    ctx.beginPath(); ctx.arc(c, c, s * 0.425, 0, TAU); ctx.stroke();

    ctx.strokeStyle = '#6f94c4';
    ctx.lineWidth = s * 0.036;
    ctx.beginPath(); ctx.arc(c, c, s * 0.425, 0, TAU); ctx.stroke();

    // Radial stone joint lines & 16 golden rune ticks around the blue ring
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      ctx.strokeStyle = i % 2 === 0 ? '#f4c24e' : 'rgba(246,235,212,0.70)';
      ctx.lineWidth = i % 2 === 0 ? 4.8 : 2.2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * s * 0.375, c + Math.sin(a) * s * 0.375);
      ctx.lineTo(c + Math.cos(a) * s * 0.47, c + Math.sin(a) * s * 0.47);
      ctx.stroke();

      const ga = a + PI / 16;
      ctx.fillStyle = '#ffd86e';
      ctx.beginPath();
      ctx.arc(c + Math.cos(ga) * s * 0.425, c + Math.sin(ga) * s * 0.425, 4.8, 0, TAU);
      ctx.fill();
    }

    // Concentric warm-golden trim borders
    for (const [r, w, col] of [
      [0.472, 9, '#dfa638'],
      [0.378, 8, '#f0bc48'],
      [0.265, 6, '#e2a93c'],
      [0.145, 7, '#f4c24e'],
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(c, c, s * r, 0, TAU); ctx.stroke();
    }

    // Secondary warm-gold 16-ray sunburst
    ctx.fillStyle = '#ecba48';
    ctx.beginPath();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      const r = i % 2 === 0 ? (i % 4 === 0 ? s * 0.355 : s * 0.275) : s * 0.135;
      const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Primary 8-point cardinal compass star in luminous sunlit gold
    ctx.fillStyle = '#ffe078';
    ctx.strokeStyle = '#9c6c1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU - PI * 0.5;
      const r = i % 2 === 0 ? (i % 4 === 0 ? s * 0.375 : s * 0.255) : s * 0.105;
      const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing golden sun center
    const sunGrd = ctx.createRadialGradient(c, c, 4, c, c, s * 0.098);
    sunGrd.addColorStop(0, '#fffdf2');
    sunGrd.addColorStop(0.55, '#ffe588');
    sunGrd.addColorStop(1, '#e8ad38');
    ctx.fillStyle = sunGrd;
    ctx.beginPath(); ctx.arc(c, c, s * 0.098, 0, TAU); ctx.fill();
  }, 1, 1);

  // 2. Carved Cream-Travertine Wind-Scroll Entablature Frieze
  const windFrieze = paintedCanvasTex(THREE, 'sr_wb_frieze_v2', 512, (ctx, s, rng) => {
    ctx.fillStyle = '#f4e8d0';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 180, ['#fcf5e8', '#e5d5b8', '#dfd0b2'], 4, 12, 0.30);
    ctx.fillStyle = '#cbb896';
    ctx.fillRect(0, 0, s, 34);
    ctx.fillRect(0, s - 34, s, 34);
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 34, s, 10);
    ctx.fillRect(0, s - 44, s, 10);
    const cells = 4, cw = s / cells;
    for (let i = 0; i < cells; i++) {
      const cx = (i + 0.5) * cw, cy = s * 0.5;
      ctx.strokeStyle = '#ae956e';
      ctx.lineWidth = 7;
      ctx.strokeRect(cx - cw * 0.38, s * 0.20, cw * 0.76, s * 0.60);
      ctx.strokeStyle = '#e2ae42';
      ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.arc(cx, cy, cw * 0.16, 0, PI * 1.65); ctx.stroke();
    }
  }, 3, 1);

  _wbTexCache = { _T: THREE, sunZodiacFloor, windFrieze };
  return _wbTexCache;
}

// Helper: Royal-Blue & Sunlit-Gold Pointed Sun-Star Temple Banner (sm.starBanner)
function addSunStarBanner(THREE, K, mats, x, yTop, z, rotY = 0, scale = 1.0, parent = K.root) {
  const { add, rbox } = K;
  const { sm, sunGold, amberBronze, royalBlueCloth } = mats;
  const g = new THREE.Group();
  g.position.set(x, yTop, z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);
  parent.add(g);

  const bW = 0.68, bH = 1.14, tipH = 0.36;
  // Sunlit golden crossbar rod + turned finial spheres + mounting brackets
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, bW + 0.24, 7), sunGold),
    0, 0, 0, 0, 0, PI * 0.5, g);
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), sunGold),
      sx * (bW * 0.5 + 0.13), 0, 0, 0, 0, 0, g);
    add(rbox(0.026, 0.14, 0.026, 0.008, amberBronze, 1), sx * (bW * 0.36), 0.07, -0.02, 0, 0, 0, g);
  }

  // Main banner cloth mapped with sm.starBanner (16-point golden sun-star on royal blue!)
  add(new THREE.Mesh(new THREE.PlaneGeometry(bW, bH), sm.starBanner), 0, -bH * 0.5 - 0.02, 0.01, 0, 0, 0, g);

  // Pointed triangular chevron tail at bottom + raised 3D golden V-trim & tassel!
  const tailShape = new THREE.Shape();
  tailShape.moveTo(-bW * 0.5, 0);
  tailShape.lineTo(bW * 0.5, 0);
  tailShape.lineTo(0, -tipH);
  tailShape.closePath();
  add(new THREE.Mesh(new THREE.ShapeGeometry(tailShape), royalBlueCloth), 0, -bH - 0.02, 0.01, 0, 0, 0, g);

  for (const sx of [-1, 1]) {
    add(rbox(0.036, bH, 0.018, 0.006, sunGold, 1), sx * (bW * 0.5 - 0.018), -bH * 0.5 - 0.02, 0.014, 0, 0, 0, g);
    const diagLen = Math.hypot(bW * 0.5, tipH);
    const diagAng = Math.atan2(bW * 0.5, tipH);
    add(rbox(0.038, diagLen, 0.02, 0.006, sunGold, 1),
      sx * (bW * 0.25), -bH - tipH * 0.5 - 0.02, 0.015, 0, 0, sx * diagAng, g);
  }
  add(new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 5), sunGold), 0, -bH - tipH - 0.03, 0.015, 0, 0, 0, g);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.13, 6), sunGold), 0, -bH - tipH - 0.11, 0.015, PI, 0, 0, g);

  return g;
}

// Helper: Curved Warm-Oak & Carved-Stone Colonnade Bench (matches ext_05 & int_05!)
function addColonnadeBench(THREE, K, mats, cx, y0, cz, rotY = 0, arcSpan = 0.52, arcR = 2.85, parent = K.root) {
  const { add, rbox } = K;
  const { sm, sunGold } = mats;
  const g = new THREE.Group();
  g.position.set(cx, y0, cz);
  g.rotation.y = rotY;
  parent.add(g);

  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const a0 = -arcSpan * 0.5 + (i / segs) * arcSpan;
    const a1 = -arcSpan * 0.5 + ((i + 1) / segs) * arcSpan;
    const am = (a0 + a1) * 0.5;
    const segLen = arcR * (arcSpan / segs) * 1.05;
    const px = Math.sin(am) * arcR;
    const pz = Math.cos(am) * arcR - arcR;

    add(rbox(segLen, 0.075, 0.48, 0.022, sm.oakTimber, 1), px, 0.45, pz, 0, am, 0, g);
    add(rbox(segLen * 0.98, 0.055, 0.42, 0.015, sm.darkTimber, 1), px, 0.39, pz, 0, am, 0, g);
    const bx = Math.sin(am) * (arcR + 0.20);
    const bz = Math.cos(am) * (arcR + 0.20) - arcR;
    add(rbox(segLen * 0.96, 0.085, 0.055, 0.018, sm.oakTimber, 1), bx, 0.72, bz, 0, am, 0, g);
  }

  for (const frac of [-0.42, 0, 0.42]) {
    const a = frac * arcSpan;
    const lx = Math.sin(a) * arcR;
    const lz = Math.cos(a) * arcR - arcR;
    add(rbox(0.14, 0.40, 0.42, 0.03, sm.darkTimber, 1), lx, 0.20, lz, 0, a, 0, g);
    add(rbox(0.18, 0.08, 0.46, 0.02, sm.travertineDark, 1), lx, 0.04, lz, 0, a, 0, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), sunGold),
      Math.sin(a) * (arcR - 0.22), 0.39, Math.cos(a) * (arcR - 0.22) - arcR, 0, 0, 0, g);
    const rx = Math.sin(a) * (arcR + 0.20);
    const rz = Math.cos(a) * (arcR + 0.20) - arcR;
    add(rbox(0.06, 0.32, 0.06, 0.015, sm.darkTimber, 1), rx, 0.59, rz, 0, a, 0, g);
  }
  return g;
}

// Helper: Sculpted Celestian Stone Goblet Flower Urn overflowing with purple/white blossoms (int_05.png!)
function addSculptedFlowerUrn(THREE, K, mats, x, y0, z, scale = 1.0, batchKey = 'wb_urn', parent = K.root) {
  const { add, rbox, pushInst, jr, pick } = K;
  const { sm, sunGold } = mats;
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.scale.setScalar(scale);
  parent.add(g);

  add(rbox(0.48, 0.12, 0.48, 0.025, sm.travertineDark, 1), 0, 0.06, 0, 0, 0, 0, g);
  add(rbox(0.36, 0.30, 0.36, 0.025, sm.travertineWarm, 1), 0, 0.27, 0, 0, 0, 0, g);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.20, 0.28, 12), sm.travertinePlain), 0, 0.56, 0, 0, 0, 0, g);
  const rim = new THREE.TorusGeometry(0.38, 0.038, 6, 14);
  rim.rotateX(PI * 0.5);
  add(new THREE.Mesh(rim, sunGold), 0, 0.70, 0, 0, 0, 0, g);

  const puffGeo = () => sharedSkyGeo(THREE, 'sr_urn_puff', () => new THREE.DodecahedronGeometry(0.11, 0));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const r = (i < 9 ? 0.24 : 0.10) * scale;
    pushInst(`${batchKey}_lf`, puffGeo, sm.foliageInst,
      x + Math.cos(a) * r, y0 + (0.74 + (i >= 9 ? 0.12 : 0)) * scale, z + Math.sin(a) * r,
      jr(-0.3, 0.3), jr(0, TAU), jr(-0.3, 0.3),
      1.35 * scale, 0.85 * scale, 1.35 * scale, pick(MOSS_PAL), parent);
  }
  const bloomCols = [0xb97ef5, 0xd8a6ff, 0xfffbf0, 0xffb8dc, 0x9c66e4];
  for (let i = 0; i < 18; i++) {
    const a = (i * 2.39996) % TAU;
    const rf = Math.sqrt((i + 0.4) / 18) * 0.30 * scale;
    const by = y0 + (0.82 + (1 - (rf / (0.32 * scale))) * 0.20 + jr(-0.03, 0.03)) * scale;
    pushInst(`${batchKey}_bl`, puffGeo, sm.foliageInst,
      x + Math.cos(a) * rf, by, z + Math.sin(a) * rf,
      jr(0, TAU), jr(0, TAU), 0,
      0.88 * scale, 0.82 * scale, 0.88 * scale, bloomCols[i % bloomCols.length], parent);
  }
  return g;
}

export function buildWindBelltower(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'wind_belltower', 51);
  // Provide K.box required by sky_kit.js buildMossyIslandPlinth(garden=true)
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const { root, roofG, add, addR, rbox, boxCol, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const WT = getWindBelltowerTextures(THREE);

  const W = 10.6;
  const D = 9.2;
  const FL = 0.34;
  const DOOR_X = -0.6;

  // Shared Storybook sunlit golden-brass & painted materials (created ONCE so K.finalize merges cleanly!)
  const sunGold = K.M(0xfaca4e, null, {
    roughness: 0.35,
    metalness: 0,
    emissive: new THREE.Color(0x704508),
    emissiveIntensity: 0.28,
  });
  const amberBronze = K.M(0xdc9428, null, {
    roughness: 0.44,
    metalness: 0,
    emissive: new THREE.Color(0x4c2904),
    emissiveIntensity: 0.20,
  });
  const warmCopper = K.M(0xd87a3c, null, {
    roughness: 0.46,
    metalness: 0,
    emissive: new THREE.Color(0x461c06),
    emissiveIntensity: 0.16,
  });
  const royalBlueCloth = K.M(0x2856a2, null, {
    roughness: 0.76,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const zodiacFloorMat = K.M(0xffffff, WT.sunZodiacFloor, { roughness: 0.66, metalness: 0 });
  const friezeMat = K.M(0xffffff, WT.windFrieze, { roughness: 0.80, metalness: 0 });

  const mats = { sm, sunGold, amberBronze, warmCopper, royalBlueCloth };

  // ==========================================================================
  // 1. FLOATING ISLAND STONE PLINTH, GRAND STAIRS, TWIN WATERFALLS & OBELISKS
  // ==========================================================================
  buildMossyIslandPlinth(THREE, K, {
    w: W,
    d: D,
    h: FL - 0.02,
    doorX: DOOR_X,
    doorZ: D * 0.5,
    doorW: 2.75,
    steps: 4,
    garden: opts.garden !== false,
    obelisks: false,
    parent: root,
    batchPrefix: 'wb_plinth',
  });

  // Matching Left-FrontCliff Waterfall when garden !== false (ext_05.png shows twin front waterfalls!)
  if (opts.garden !== false) {
    add(rbox(0.84, 0.08, 0.95, 0.02, sm.waterGlow, 1), -3.85, FL - 0.02, D * 0.49, 0, -0.18, 0, root);
    add(rbox(0.80, 2.85, 0.16, 0.03, sm.waterGlow, 1), -3.96, -1.28, D * 0.56, 0.08, -0.18, 0, root);
    const mistMat = K.M(0xf2fcff, null, { roughness: 0.92, metalness: 0, emissive: 0x8be4ff, emissiveIntensity: 0.24 });
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), mistMat), -4.02, -2.65, D * 0.59, 0, 0, 0, root);
  }

  // Walkable limestone floor slab + 5 wide grand step treads up to FL = 0.34
  {
    const walkGeos = [];
    const slab = new RoundedBoxGeometry(W - 0.12, 0.12, D - 0.12, 0.02, 1);
    slab.translate(0, FL - 0.06, 0);
    walkGeos.push(slab);

    const nSteps = 5;
    for (let s = 0; s < nSteps; s++) {
      const topY = FL * (1 - s / (nSteps + 0.6)) + 0.07;
      const sw = 2.92 + s * 0.10;
      const sz = D * 0.5 + 0.18 + s * 0.34;
      const stg = new RoundedBoxGeometry(sw, topY + 0.18, 0.46, 0.025, 1);
      stg.translate(DOOR_X, topY - (topY + 0.18) * 0.5, sz);
      walkGeos.push(stg);
    }
    const walkFloor = new THREE.Mesh(mergeGeometries(walkGeos, false), sm.travertine);
    walkFloor.name = 'wb_walkable_floor';
    walkFloor.castShadow = true;
    walkFloor.receiveShadow = true;
    walkFloor.userData.ground = true;
    walkFloor.userData.keep = true;
    root.add(walkFloor);
    walkGeos.forEach((g) => g.dispose());
  }

  // Twin Grand Carved Cheek Pedestals + Glowing Cyan Crystal Obelisk Lanterns (ext_05 & int_05!)
  for (const sx of [-1, 1]) {
    const ox = DOOR_X + sx * 1.76;
    const oz = 4.22;
    add(rbox(1.04, 0.22, 1.04, 0.04, sm.travertineDark, 1), ox, FL + 0.05, oz, 0, 0, 0, root);
    add(rbox(0.88, 0.68, 0.88, 0.04, sm.travertinePlain, 1), ox, FL + 0.46, oz, 0, 0, 0, root);
    add(rbox(0.98, 0.14, 0.98, 0.03, sm.travertineWarm, 1), ox, FL + 0.85, oz, 0, 0, 0, root);
    for (const [dx, dz, ry] of [[0, 0.45, 0], [sx * 0.45, 0, PI * 0.5]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.04, 12), sunGold),
        ox + dx, FL + 0.46, oz + dz, PI * 0.5, 0, ry, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10), sx > 0 && dx === 0 ? sm.cyanSoft : sunGold),
        ox + dx, FL + 0.46, oz + dz, PI * 0.5, 0, ry, root);
    }
    buildCrystalObeliskLantern(THREE, K, { x: ox, y: FL + 0.90, z: oz, scale: 1.02, parent: root });
    // Sunlit gold cap trim over obelisk lantern base
    add(rbox(0.46, 0.08, 0.46, 0.02, sunGold, 1), ox, FL + 1.24, oz, 0, 0, 0, root);
    boxCol(ox, oz, 0.96, 0.96);

    const lx = DOOR_X + sx * 1.62;
    const lz = 5.26;
    add(rbox(0.62, 0.52, 0.72, 0.04, sm.travertinePlain, 1), lx, 0.26, lz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), sm.cyanSoft), lx, 0.24, lz + 0.36, 0, 0, 0, root);
  }

  // Lush Rim Wildflower Beds & Trailing Purple Wisteria off the Front & Side Plinth Edges
  {
    const flwGeo = () => sharedSkyGeo(THREE, 'sr_wb_rim_flw', () => new THREE.DodecahedronGeometry(0.11, 0));
    const flowerBeds = [
      [-3.55, 4.15, 1.35, 0.55],
      [2.85, 4.15, 1.45, 0.55],
      [-4.85, 2.85, 0.55, 1.25],
      [4.85, 1.95, 0.50, 1.15],
    ];
    for (const [bx, bz, rx, rz] of flowerBeds) {
      for (let i = 0; i < 16; i++) {
        const px = bx + jr(-rx, rx);
        const pz = bz + jr(-rz, rz);
        pushInst('wb_bed_moss', flwGeo, sm.foliageInst,
          px, FL + 0.08 + jr(0, 0.08), pz, 0, jr(0, TAU), 0,
          jr(1.6, 2.4), jr(0.7, 1.1), jr(1.6, 2.4), pick(MOSS_PAL), root);
        pushInst('wb_bed_flw', flwGeo, sm.foliageInst,
          px + jr(-0.06, 0.06), FL + 0.20 + jr(0, 0.12), pz + jr(-0.06, 0.06),
          jr(0, TAU), jr(0, TAU), 0, jr(0.9, 1.35), jr(0.85, 1.25), jr(0.9, 1.35),
          i % 3 === 0 ? pick(WISTERIA_PAL) : (i % 3 === 1 ? 0xfffcf0 : pick(WILDFLOWER_PAL)), root);
      }
    }
    if (opts.garden !== false) {
      buildWisteriaRacemes(THREE, K, {
        cx: -2.95, yTop: FL + 0.05, cz: D * 0.53,
        spanX: 1.65, strands: 8, maxLen: 1.45, parent: root, batchPrefix: 'wb_fr_wistL',
      });
      buildWisteriaRacemes(THREE, K, {
        cx: 3.35, yTop: FL + 0.05, cz: D * 0.53,
        spanX: 1.45, strands: 7, maxLen: 1.35, parent: root, batchPrefix: 'wb_fr_wistR',
      });
    }
  }

  // ==========================================================================
  // 2. GOLDEN SUN-COMPASS ROTUNDA MOSAIC + PERGOLA WALKWAY FLAGSTONES
  // ==========================================================================
  const ROT_X = -1.15;
  const ROT_Z = 0.05;

  {
    const outerDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.54, 2.58, 0.026, 36), zodiacFloorMat);
    add(outerDisc, ROT_X, FL + 0.014, ROT_Z, 0, 0, 0, root);
    outerDisc.userData.ground = true;

    const innerDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.028, 30), sm.sunCompass);
    add(innerDisc, ROT_X, FL + 0.017, ROT_Z, 0, 0, 0, root);
    innerDisc.userData.ground = true;

    for (const rRing of [2.54, 1.92, 1.42, 0.52]) {
      const tr = new THREE.TorusGeometry(rRing, 0.022, 5, 32);
      tr.rotateX(PI * 0.5);
      add(new THREE.Mesh(tr, sunGold), ROT_X, FL + 0.022, ROT_Z, 0, 0, 0, root);
    }

    const flagGeo = () => sharedSkyGeo(THREE, 'sr_wb_flagstone', () => new RoundedBoxGeometry(1, 0.028, 1, 0.01, 1));
    for (const rad of [2.88, 3.38]) {
      const cnt = Math.round((TAU * rad) / 0.68);
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU;
        const fx = ROT_X + Math.cos(a) * rad;
        const fz = ROT_Z + Math.sin(a) * rad;
        if (fx > 1.45 || fx < -4.85 || Math.abs(fz) > 4.05) continue;
        pushInst('wb_pave', flagGeo, sm.stoneInst,
          fx, FL + 0.012, fz, 0, -a, 0, 0.46, 1, 0.62, pick(TRAVERTINE_PAL), root);
      }
    }

    for (let px = 1.65; px <= 4.45; px += 0.66) {
      for (let pz = -3.45; pz <= 3.35; pz += 0.68) {
        const stag = (Math.round((pz + 4) / 0.68) % 2) * 0.22;
        const fx = Math.min(4.45, px + stag);
        pushInst('wb_pave', flagGeo, sm.stoneInst,
          fx, FL + 0.012, pz, 0, jr(-0.02, 0.02), 0,
          0.61, 1, 0.63, pick(TRAVERTINE_PAL), root);
      }
    }
  }

  // ==========================================================================
  // 3. CARVED STONE PERIMETER BALUSTRADE + 12 FLUTED TRAVERTINE COLUMNS (y < 3.3m!)
  // ==========================================================================
  const H_COL = 2.90; // FL(0.34) + 2.90 = 3.24m (< 3.30m cutaway plane!)

  const addSunlitColRings = (cx, cz, r, extraScroll = false) => {
    for (const fy of [0.35, 0.68, 0.87]) {
      const tr = new THREE.TorusGeometry(r * 1.03, 0.022, 5, 14);
      tr.rotateX(PI * 0.5);
      add(new THREE.Mesh(tr, sunGold), cx, FL + H_COL * fy, cz, 0, 0, 0, root);
    }
    if (extraScroll) {
      const capRing = new THREE.TorusGeometry(r + 0.045, 0.036, 6, 16);
      capRing.rotateX(PI * 0.5);
      add(new THREE.Mesh(capRing, sunGold), cx, FL + H_COL - 0.34, cz, 0, 0, 0, root);
    }
  };

  // A. Two Hero Front Pediment Columns flanking doorX = -0.6 (2.72m clear opening!)
  const HERO_COLS = [
    [-2.30, 3.35],
    [1.10, 3.35],
  ];
  for (const [cx, cz] of HERO_COLS) {
    buildFlutedColumn(THREE, K, { x: cx, y0: FL, z: cz, height: H_COL, radius: 0.27, goldRings: false, parent: root });
    addSunlitColRings(cx, cz, 0.27, true);
    boxCol(cx, cz, 0.72, 0.72);
  }

  // B. Five Curved Rotunda Perimeter Columns (West & Back arc)
  const ROT_COLS = [
    [-4.25, 2.05],
    [-4.45, -0.75],
    [-3.25, -3.15],
    [-0.95, -3.65],
    [1.35, -3.15],
  ];
  for (const [cx, cz] of ROT_COLS) {
    buildFlutedColumn(THREE, K, { x: cx, y0: FL, z: cz, height: H_COL, radius: 0.24, goldRings: false, parent: root });
    addSunlitColRings(cx, cz, 0.24, false);
    boxCol(cx, cz, 0.64, 0.64);
  }

  // C. Inner North Pergola Column framing innerDoors: [{ x: 1.5, z: 0.2 }] (2.85m clear opening!)
  buildFlutedColumn(THREE, K, { x: 1.45, y0: FL, z: -1.55, height: H_COL, radius: 0.22, goldRings: false, parent: root });
  addSunlitColRings(1.45, -1.55, 0.22, false);
  boxCol(1.45, -1.55, 0.58, 0.58);

  // D. Four Right Pergola Outer Columns along East Rim
  const PERG_COLS = [
    [4.45, 2.95],
    [4.55, 0.75],
    [4.55, -1.35],
    [4.35, -3.20],
  ];
  for (const [cx, cz] of PERG_COLS) {
    buildFlutedColumn(THREE, K, { x: cx, y0: FL, z: cz, height: H_COL, radius: 0.23, goldRings: false, parent: root });
    addSunlitColRings(cx, cz, 0.23, false);
    boxCol(cx, cz, 0.62, 0.62);
  }

  // E. Low Carved Cream-Travertine Perimeter Balustrade Wall (y = FL to FL + 0.78m)
  const addBalustradeSpan = (ax, az, bx, bz, withOrb = false) => {
    const mx = (ax + bx) * 0.5, mz = (az + bz) * 0.5;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.45) return;
    const ang = Math.atan2(bx - ax, bz - az);
    const spanLen = Math.max(0.3, len - 0.52);

    add(rbox(0.34, 0.16, spanLen, 0.025, sm.travertineDark, 1), mx, FL + 0.08, mz, 0, ang, 0, root);
    add(rbox(0.24, 0.50, spanLen, 0.02, sm.travertinePlain, 1), mx, FL + 0.41, mz, 0, ang, 0, root);
    add(rbox(0.28, 0.32, spanLen * 0.74, 0.02, sm.travertineWarm, 1), mx, FL + 0.41, mz, 0, ang, 0, root);
    add(rbox(0.38, 0.11, spanLen + 0.08, 0.025, sm.travertinePlain, 1), mx, FL + 0.72, mz, 0, ang, 0, root);
    boxCol(mx, mz, 0.36, spanLen, ang);

    if (withOrb) {
      add(rbox(0.36, 0.18, 0.36, 0.025, sm.travertineWarm, 1), mx, FL + 0.84, mz, 0, ang, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.08, 8), sunGold), mx, FL + 0.96, mz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), sm.cyanCrystal), mx, FL + 1.08, mz, 0, 0, 0, root);
    }
  };

  addBalustradeSpan(-2.30, 3.35, -4.25, 2.05, false);
  addBalustradeSpan(-4.25, 2.05, -4.45, -0.75, false);
  addBalustradeSpan(-4.45, -0.75, -3.25, -3.15, true);
  addBalustradeSpan(-3.25, -3.15, -0.95, -3.65, false);
  addBalustradeSpan(-0.95, -3.65, 1.35, -3.15, true);
  addBalustradeSpan(1.35, -3.15, 4.35, -3.20, false);
  addBalustradeSpan(4.35, -3.20, 4.55, -1.35, true);
  addBalustradeSpan(4.55, -1.35, 4.55, 0.75, false);
  addBalustradeSpan(4.55, 0.75, 4.45, 2.95, false);

  // ==========================================================================
  // 4. 4 ROYAL-BLUE SUN-STAR BANNERS + 24 SUNLIT GOLDEN WIND CHIMES (tips >= 1.89m!)
  // ==========================================================================
  addSunStarBanner(THREE, K, mats, -2.30, FL + 2.54, 3.66, 0, 1.04, root);      // 1. Front-Left Hero Column
  addSunStarBanner(THREE, K, mats, 1.10, FL + 2.54, 3.66, 0, 1.04, root);       // 2. Front-Right Hero Column
  addSunStarBanner(THREE, K, mats, -4.46, FL + 2.48, 2.24, -0.58, 0.92, root);  // 3. West Colonnade Column
  addSunStarBanner(THREE, K, mats, -0.95, FL + 2.48, -3.32, 0, 0.92, root);     // 4. Inner Rotunda Back Column

  // 24 Gleaming Golden-Brass Tubular Wind Chimes on sleek column-mounted bracket arms!
  // Keeps Sun-Compass Mosaic 100% framed & unobstructed from above in mode=interiors,
  // with all diamond wind-catcher tips >= 1.89m (> 1.85m!) and tops < 3.26m (< 3.30m!).
  {
    const chimeAssemblies = [
      // 2 Ornate Hero-Arch Ring Chandeliers flanking the front entrance (visible under pediment in ext_05 & int_05!)
      { cx: -1.72, cz: 2.86, ax: -2.30, az: 3.35, r: 0.36, count: 5, style: 'ring' },
      { cx: 0.52,  cz: 2.86, ax: 1.10,  az: 3.35, r: 0.36, count: 5, style: 'ring' },
      // 2 Back-Arc Ring Chandeliers flanking the rear Sun-Star Banner
      { cx: -2.62, cz: -2.55, ax: -3.25, az: -3.15, r: 0.34, count: 4, style: 'ring' },
      { cx: 0.72,  cz: -2.55, ax: 1.35,  az: -3.15, r: 0.34, count: 4, style: 'ring' },
      // West & East Side-Bay Crossbar Chime Racks (matching ext_05 left & right bays!)
      { cx: -4.02, cz: 0.65, ax: -4.25, az: 2.05, bx: -4.45, bz: -0.75, span: 1.08, rotY: 1.50, count: 3, style: 'bar' },
      { cx: 2.78,  cz: 3.05, ax: 1.10,  az: 3.35, bx: 4.45,  bz: 2.95,  span: 1.16, rotY: -0.12, count: 3, style: 'bar' },
    ];

    const yBar = 3.16; // Strictly < 3.30m!
    const sailGeo = sharedSkyGeo(THREE, 'sr_chime_diamond', () => {
      const g = new THREE.OctahedronGeometry(0.082, 0);
      g.scale(0.85, 1.60, 0.32);
      return g;
    });

    let chimeIdx = 0;
    for (const asm of chimeAssemblies) {
      if (asm.style === 'ring') {
        // Short sculpted golden scroll bracket arm cantilevering off nearby column shaft!
        K.beam([asm.ax, yBar + 0.04, asm.az], [asm.cx, yBar + 0.04, asm.cz], 0.048, amberBronze, root);
        K.beam([asm.ax, yBar - 0.16, asm.az], [(asm.ax + asm.cx) * 0.5, yBar + 0.03, (asm.az + asm.cz) * 0.5], 0.034, sunGold, root);

        // Ornate domed golden canopy disc + ring (matches ext_05.png!)
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, asm.r, 0.08, 12), sunGold),
          asm.cx, yBar + 0.03, asm.cz, 0, 0, 0, root);
        const ringTorus = new THREE.TorusGeometry(asm.r, 0.028, 6, 16);
        ringTorus.rotateX(PI * 0.5);
        add(new THREE.Mesh(ringTorus, amberBronze), asm.cx, yBar - 0.01, asm.cz, 0, 0, 0, root);
      } else {
        // Side-bay horizontal bronze crossbar spanning neatly between adjacent columns
        K.beam([asm.ax, yBar + 0.03, asm.az], [asm.bx, yBar + 0.03, asm.bz], 0.045, amberBronze, root);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, asm.span + 0.20, 8), sunGold),
          asm.cx, yBar - 0.02, asm.cz, 0, asm.rotY, PI * 0.5, root);
        for (const sEnd of [-1, 1]) {
          const ex = asm.cx + Math.cos(asm.rotY) * sEnd * (asm.span * 0.5 + 0.11);
          const ez = asm.cz - Math.sin(asm.rotY) * sEnd * (asm.span * 0.5 + 0.11);
          add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), sunGold), ex, yBar - 0.02, ez, 0, 0, 0, root);
        }
      }

      for (let i = 0; i < asm.count; i++) {
        let tx, tz;
        if (asm.style === 'ring') {
          const a = (i / asm.count) * TAU + 0.30;
          tx = asm.cx + Math.cos(a) * (asm.r * 0.88);
          tz = asm.cz + Math.sin(a) * (asm.r * 0.88);
        } else {
          const u = ((i / Math.max(1, asm.count - 1)) - 0.5) * asm.span;
          tx = asm.cx + Math.cos(asm.rotY) * u;
          tz = asm.cz - Math.sin(asm.rotY) * u;
        }

        // Musical stepped tube lengths; keep lowest diamond wind-catcher tip >= 1.89m!
        const tubeLen = 0.54 + (chimeIdx % 4) * 0.088; // 0.54m .. 0.804m
        const tubeR = 0.055 + (chimeIdx % 2) * 0.007;
        const yTubeTop = yBar - 0.14;
        const yTubeMid = yTubeTop - tubeLen * 0.5;
        const yTubeBot = yTubeTop - tubeLen;
        const safeSailY = Math.max(2.03, yTubeBot - 0.18); // Bottom tip = safeSailY - 0.13 >= 1.90m!

        const tubeMat = chimeIdx % 3 === 0 ? sunGold : (chimeIdx % 3 === 1 ? amberBronze : warmCopper);

        const cordLen = yBar - safeSailY;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, cordLen, 4), amberBronze),
          tx, safeSailY + cordLen * 0.5, tz, 0, 0, 0, root);

        add(new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR * 1.04, tubeLen, 10), tubeMat),
          tx, yTubeMid, tz, 0, 0, 0, root);
        add(new THREE.Mesh(new THREE.SphereGeometry(tubeR * 1.02, 8, 5), sunGold),
          tx, yTubeTop, tz, 0, 0, 0, root);

        add(new THREE.Mesh(sailGeo, sunGold),
          tx, safeSailY, tz, 0, (chimeIdx * 0.7) % TAU, 0, root);

        chimeIdx++;
      }
    }
  }

  // ==========================================================================
  // 5. INTERIOR FURNITURE: 4 CURVED OAK BENCHES + SCULPTED PERGOLA URN PLANTERS
  // ==========================================================================
  addColonnadeBench(THREE, K, mats, -2.55, FL, -2.42, PI + 0.56, 0.52, 2.9, root);
  addColonnadeBench(THREE, K, mats, -0.05, FL, -2.85, PI - 0.14, 0.50, 2.9, root);
  addColonnadeBench(THREE, K, mats, -3.55, FL, 0.55, PI * 0.5 + 0.12, 0.48, 2.9, root);
  addColonnadeBench(THREE, K, mats, 3.82, FL, -0.35, -PI * 0.5, 0.56, 3.4, root);

  // Carved Wooden Planter Box beside inner hero column (matching int_05.png!)
  {
    const px = 1.82, pz = 2.68;
    add(rbox(0.74, 0.48, 0.62, 0.03, sm.oakTimber, 1), px, FL + 0.24, pz, 0, 0.08, 0, root);
    add(rbox(0.78, 0.07, 0.66, 0.02, sm.darkTimber, 1), px, FL + 0.48, pz, 0, 0.08, 0, root);
    add(rbox(0.78, 0.07, 0.66, 0.02, sm.darkTimber, 1), px, FL + 0.05, pz, 0, 0.08, 0, root);
    buildSkyOrchidCluster(THREE, K, { x: px, y: FL + 0.50, z: pz, count: 3, scale: 0.95, rotY: 0.4, parent: root });
    boxCol(px, pz, 0.78, 0.66);
  }

  // Sculpted Stone Flower Urns with Purple Blossoms in the Right Pergola Walkway (matches int_05.png!)
  addSculptedFlowerUrn(THREE, K, mats, 3.92, FL, 2.82, 1.06, 'wb_urn1', root);
  boxCol(3.92, 2.82, 0.58, 0.58);
  addSculptedFlowerUrn(THREE, K, mats, 2.15, FL, -2.55, 0.96, 'wb_urn2', root);
  boxCol(2.15, -2.55, 0.54, 0.54);

  // ==========================================================================
  // 6. UPPER ENTABLATURE, GRAND ARCHED SUN-SPHERE PEDIMENT, PERGOLA ARCHES
  //    & BOTANICAL CROWN — 100% INSIDE K.roofG (y >= 3.30m) FOR CLEAN CUTAWAY!
  // ==========================================================================
  const addEntablatureBeam = (ax, az, bx, bz, heightScale = 1.0) => {
    const mx = (ax + bx) * 0.5, mz = (az + bz) * 0.5;
    const len = Math.hypot(bx - ax, bz - az) + 0.48;
    const ang = Math.atan2(bx - ax, bz - az);
    add(rbox(0.58, 0.16, len, 0.025, sm.travertineDark, 1), mx, 3.38, mz, 0, ang, 0, roofG);
    add(rbox(0.52, 0.28 * heightScale, len - 0.06, 0.02, friezeMat, 1), mx, 3.60, mz, 0, ang, 0, roofG);
    add(rbox(0.72, 0.14, len + 0.10, 0.03, sm.travertinePlain, 1), mx, 3.82, mz, 0, ang, 0, roofG);
  };

  addEntablatureBeam(-2.30, 3.35, 1.10, 3.35, 1.15);
  addEntablatureBeam(-2.30, 3.35, -4.25, 2.05);
  addEntablatureBeam(-4.25, 2.05, -4.45, -0.75);
  addEntablatureBeam(-4.45, -0.75, -3.25, -3.15);
  addEntablatureBeam(-3.25, -3.15, -0.95, -3.65);
  addEntablatureBeam(-0.95, -3.65, 1.35, -3.15);
  addEntablatureBeam(1.35, -3.15, 1.45, -1.55);
  addEntablatureBeam(1.45, -1.55, 1.10, 3.35);

  addEntablatureBeam(1.10, 3.35, 4.45, 2.95);
  addEntablatureBeam(4.45, 2.95, 4.55, 0.75);
  addEntablatureBeam(4.55, 0.75, 4.55, -1.35);
  addEntablatureBeam(4.55, -1.35, 4.35, -3.20);
  addEntablatureBeam(4.35, -3.20, 1.35, -3.15);

  // Right Pergola Stone Ribbed Vault Arches (4 transverse voussoir arches matching int_05.png!)
  for (let i = 0; i < 4; i++) {
    const [ix, iz] = [
      [1.15, 3.10],
      [1.26, 0.85],
      [1.40, -1.40],
      [1.35, -3.15],
    ][i];
    const [ox, oz] = PERG_COLS[i];
    const mx = (ix + ox) * 0.5;
    const mz = (iz + oz) * 0.5;
    const span = Math.hypot(ox - ix, oz - iz);
    const yaw = Math.atan2(oz - iz, ox - ix);
    buildStoneArch(THREE, K, {
      cx: mx,
      cy: 3.36,
      cz: mz,
      radius: span * 0.46,
      thickness: 0.30,
      depth: 0.40,
      segments: 11,
      rotY: -yaw,
      keystoneGlow: i === 0 || i === 3,
      parent: roofG,
      batchPrefix: `wb_pga_${i}`,
    });
  }
  addR(rbox(0.32, 0.22, 6.55, 0.03, sm.travertineWarm, 1), 2.92, 4.82, -0.10, 0, -0.04, 0);

  // GRAND FRONT ARCHED PEDIMENT + GLEAMING GOLDEN SUN-SPHERE ARMILLARY EMBLEM (ext_05 & int_05!)
  {
    const pz = 3.35;
    for (const hx of [-2.30, 1.10]) {
      addR(rbox(0.98, 0.56, 0.94, 0.04, sm.travertinePlain, 1), hx, 4.02, pz);
      addR(rbox(1.10, 0.15, 1.06, 0.03, sm.travertineWarm, 1), hx, 4.35, pz);
      addR(rbox(0.46, 0.30, 0.08, 0.02, sm.travertineDark, 1), hx, 4.00, pz + 0.46);
      addR(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), sunGold), hx, 4.00, pz + 0.50);
    }

    const archR = 1.72;
    const archY = 3.92;

    // Solid seamless cream-travertine arched ring backing so zero gaps appear between radial voussoirs!
    const archRingShape = new THREE.Shape();
    archRingShape.absarc(0, 0, archR + 0.19, 0, PI, false);
    archRingShape.absarc(0, 0, archR - 0.19, PI, 0, true);
    archRingShape.closePath();
    const archRingGeo = new THREE.ExtrudeGeometry(archRingShape, { depth: 0.56, bevelEnabled: false, curveSegments: 28 });
    archRingGeo.translate(0, 0, -0.28);
    addR(new THREE.Mesh(archRingGeo, sm.travertineWarm), DOOR_X, archY, pz);

    buildStoneArch(THREE, K, {
      cx: DOOR_X,
      cy: archY,
      cz: pz,
      radius: archR,
      thickness: 0.40,
      depth: 0.62,
      segments: 15,
      rotY: 0,
      keystoneGlow: false,
      parent: roofG,
      batchPrefix: 'wb_hero_arch',
    });

    const hoodTorus = new THREE.TorusGeometry(archR + 0.22, 0.11, 8, 28, PI);
    addR(new THREE.Mesh(hoodTorus, sm.travertinePlain), DOOR_X, archY, pz + 0.02);
    const goldInnerArc = new THREE.TorusGeometry(archR - 0.18, 0.048, 7, 26, PI);
    addR(new THREE.Mesh(goldInnerArc, sunGold), DOOR_X, archY, pz + 0.16);

    // Semicircular Celestial Star-Blue Tympanum Inlay inside the Arch Pediment!
    const tymShape = new THREE.Shape();
    tymShape.absarc(0, 0, archR - 0.18, 0, PI, false);
    tymShape.closePath();
    const tymGeo = new THREE.ExtrudeGeometry(tymShape, { depth: 0.22, bevelEnabled: false, curveSegments: 24 });
    tymGeo.translate(0, 0, -0.11);
    addR(new THREE.Mesh(tymGeo, sm.starDome), DOOR_X, archY, pz);

    // Gleaming Sunlit-Gold Filigree S-Scrolls flanking the Sun-Sphere inside the Tympanum
    for (const sx of [-1, 1]) {
      const scrollPts = [
        new THREE.Vector3(DOOR_X + sx * 0.42, archY + 0.86, pz + 0.16),
        new THREE.Vector3(DOOR_X + sx * 0.82, archY + 0.74, pz + 0.17),
        new THREE.Vector3(DOOR_X + sx * 1.18, archY + 0.36, pz + 0.17),
        new THREE.Vector3(DOOR_X + sx * 0.96, archY + 0.16, pz + 0.16),
      ];
      addR(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(scrollPts), 12, 0.044, 6, false), sunGold), 0, 0, 0);
      const upperScroll = [
        new THREE.Vector3(DOOR_X + sx * 0.38, archY + 1.02, pz + 0.16),
        new THREE.Vector3(DOOR_X + sx * 0.74, archY + 1.12, pz + 0.17),
        new THREE.Vector3(DOOR_X + sx * 0.92, archY + 0.86, pz + 0.17),
      ];
      addR(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(upperScroll), 10, 0.036, 6, false), sunGold), 0, 0, 0);
    }

    // Centerpiece: Gleaming Golden Sun-Sphere Armillary Emblem!
    const sunY = archY + 0.88;
    addR(new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), sunGold), DOOR_X, sunY, pz + 0.22);
    addR(new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.045, 7, 22), sunGold), DOOR_X, sunY, pz + 0.22);
    addR(new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.030, 6, 20), amberBronze), DOOR_X, sunY, pz + 0.22, 0.52, 0.38, 0);
    addR(new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.030, 6, 20), amberBronze), DOOR_X, sunY, pz + 0.22, -0.52, -0.38, 0);

    for (let r = 0; r < 8; r++) {
      const ra = (r / 8) * TAU;
      addR(new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.25, 5), sunGold),
        DOOR_X + Math.cos(ra) * 0.57, sunY + Math.sin(ra) * 0.57, pz + 0.20,
        0, 0, ra - PI * 0.5);
    }

    // Apex Golden Crown Ring Finial (y = 5.88m) + Lower Heart-Scroll Plumb Finial (y = 3.74m > 3.30m!)
    addR(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.044, 6, 14), sunGold), DOOR_X, archY + archR + 0.24, pz + 0.14);
    addR(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 6), sunGold), DOOR_X, archY + archR + 0.46, pz + 0.14);
    addR(rbox(0.24, 0.24, 0.10, 0.03, sunGold, 1), DOOR_X, archY - 0.12, pz + 0.36, 0, 0, PI * 0.25);
  }

  // TAILORED STORYBOOK CORNICE BOTANICAL GARLANDS: Sunlit Ivy Cushions, Crisp White Blossoms,
  // Lilac/Buttercup Blooms & Cascading Purple Wisteria (strictly inside roofG, y >= 3.35m!)
  {
    const leafGeo = () => sharedSkyGeo(THREE, 'sr_wb_ivy_lf', () => new THREE.IcosahedronGeometry(0.22, 1));
    const blmGeo = () => sharedSkyGeo(THREE, 'sr_wb_roof_blm2', () => new THREE.DodecahedronGeometry(0.115, 0));

    // Organic cornice garland paths hugging left colonnade shoulder & right pergola arches
    const garlandArcs = [
      // Left Pediment Shoulder -> West Colonnade Cornice (ext_05 & int_05 left garland!)
      { pts: [[-2.45, 4.42, 3.38], [-3.35, 4.02, 2.75], [-4.28, 3.96, 1.95], [-4.45, 3.94, 0.15]], count: 26, spread: 0.46 },
      // Right Pediment Shoulder -> Pergola Front Arch & Vault Crown (ext_05 & int_05 right garland!)
      { pts: [[1.25, 4.42, 3.38], [2.45, 4.56, 3.05], [3.75, 4.22, 2.95], [4.45, 3.98, 2.55]], count: 28, spread: 0.48 },
      // Right Pergola Mid-Crown Ivy Trail
      { pts: [[2.55, 4.86, 1.25], [3.05, 4.84, -0.35], [2.75, 4.78, -2.05]], count: 18, spread: 0.42 },
    ];

    for (const ga of garlandArcs) {
      const curve = new THREE.CatmullRomCurve3(ga.pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      for (let i = 0; i < ga.count; i++) {
        const u = i / Math.max(1, ga.count - 1);
        const p = curve.getPoint(u);
        const ox = jr(-ga.spread, ga.spread);
        const oz = jr(-ga.spread, ga.spread);
        const py = Math.max(3.62, p.y + jr(-0.10, 0.16));

        // Layered sunlit emerald/chartreuse ivy cushion (compact scale so architecture stays crisp!)
        pushInst('wb_rf_ivy', leafGeo, sm.foliageInst,
          p.x + ox, py, p.z + oz,
          jr(-0.25, 0.25), jr(0, TAU), jr(-0.25, 0.25),
          jr(1.05, 1.65), jr(0.68, 1.05), jr(1.05, 1.65), pick(FOLIAGE_SUN_PAL), roofG);

        // Abundant surface-mounted creamy-white blossoms, lavender clusters & golden buttercups ON TOP!
        if (i % 2 === 0) {
          for (let b = 0; b < 3; b++) {
            const bCol = b === 0 ? 0xfffef6 : (b === 1 ? pick(WISTERIA_PAL) : 0xffe46c);
            pushInst('wb_rf_blm', blmGeo, sm.foliageInst,
              p.x + ox * 0.7 + jr(-0.18, 0.18), py + 0.18 + jr(0.0, 0.10), p.z + oz * 0.7 + jr(-0.18, 0.18),
              jr(0, TAU), jr(0, TAU), 0,
              jr(0.85, 1.35), jr(0.75, 1.15), jr(0.85, 1.35), bCol, roofG);
          }
        }
      }
    }

    // Trailing green ivy tendrils draping gracefully over the outer left & right column capitals (y >= 3.38m!)
    for (const [vx, vz] of [[-4.38, 2.22], [-2.58, 3.62], [1.38, 3.62], [4.56, 3.08]]) {
      for (let k = 0; k < 4; k++) {
        pushInst('wb_rf_ivy', blmGeo, sm.foliageInst,
          vx + jr(-0.08, 0.08), 3.88 - k * 0.14, vz + jr(-0.08, 0.08),
          0, jr(0, TAU), 0, 1.05 - k * 0.12, 0.95, 1.05 - k * 0.12, pick(FOLIAGE_SUN_PAL), roofG);
      }
    }

    // Cascading Purple Wisteria Racemes hanging from upper entablature (yTop = 3.98, maxLen = 0.56 -> y >= 3.36m!)
    buildWisteriaRacemes(THREE, K, {
      cx: -3.55, yTop: 3.98, cz: 3.05, spanX: 1.45, strands: 8, maxLen: 0.56,
      rotY: -0.52, parent: roofG, batchPrefix: 'wb_rf_wistL',
    });
    buildWisteriaRacemes(THREE, K, {
      cx: 2.85, yTop: 3.98, cz: 3.32, spanX: 1.55, strands: 8, maxLen: 0.56,
      rotY: 0.10, parent: roofG, batchPrefix: 'wb_rf_wistR',
    });
  }

  // ==========================================================================
  // 7. REQUIRED GAMEPLAY USERDATA: ROOMS, DOORS & 9 VALID PROP SLOTS
  // ==========================================================================
  root.userData.footprint = { w: 10.0, d: 8.2 };
  root.userData.footprintBox = { w: 10.0, d: 8.2 };
  root.userData.door = { x: -0.6, z: 5.55 };
  root.userData.doorIn = { x: -0.6, z: 2.6 };
  root.userData.innerDoors = [{ x: 1.5, z: 0.2 }];
  root.userData.rooms = [
    { name: 'chime_rotunda', x: -1.28, z: 0.0, w: 5.56, d: 6.8, walkX: -0.55, walkZ: 0.95 }, // x ∈ [-4.06, 1.50]
    { name: 'pergola_walk', x: 2.95, z: 0.0, w: 2.90, d: 6.6, walkX: 2.65, walkZ: 0.40 },    // x ∈ [1.50, 4.40]
  ];
  root.userData.propSlots = [
    // chime_rotunda (5 slots around the sunlit colonnade perimeter, clear of doors & benches!)
    { id: 'sr_wind_chime_stand', x: -3.15, y: FL, z: 2.15, rot: 0.58 },
    { id: 'sr_sky_compass',      x: -1.65, y: FL, z: -0.05, rot: 0.0 },
    { id: 'sr_crystal_lantern',  x: -3.25, y: FL, z: -1.15, rot: 1.12 },
    { id: 'sr_levitation_urn',   x: -1.35, y: FL, z: -1.95, rot: 0.24 },
    { id: 'sr_cloud_planter',    x: 0.45,  y: FL, z: -1.85, rot: -0.45 },
    // pergola_walk (4 slots along the sunlit right arched pergola gallery!)
    { id: 'sr_cloud_planter',    x: 2.65,  y: FL, z: 1.95, rot: -0.35 },
    { id: 'sr_wind_chime_stand', x: 3.35,  y: FL, z: -1.15, rot: -1.52 },
    { id: 'sr_crystal_lantern',  x: 3.55,  y: FL, z: -2.15, rot: -0.85 },
    { id: 'sr_levitation_urn',   x: 3.55,  y: FL, z: 1.45, rot: 2.15 },
  ];

  return K.finalize();
}
