// ============================================================================
// Celestia Sky-Ruins (Celestia) — Building 2: Botanical Sky-Orchid Root Conservatory
// Hand-sculpted from Codex references ext_02.png & int_02.png.
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  applyPlanarUVs,
  mergeGeometries,
  RoundedBoxGeometry,
} from '../../map_kit.js?v=2';
import {
  TRAVERTINE_PAL,
  MOSS_PAL,
  FOLIAGE_SUN_PAL,
  WILDFLOWER_PAL,
  sharedSkyGeo,
  getSkyMats,
  buildMossyIslandPlinth,
  buildFlutedColumn,
  buildStoneArch,
  buildAshlarMasonryFace,
  buildGnarledRootTube,
  buildFoliageCanopyCluster,
  buildWisteriaRacemes,
  buildSkyOrchidCluster,
} from '../sky_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

let _consTex = null;

function getConservatoryTextures(THREE) {
  if (_consTex && _consTex._T === THREE) return _consTex;

  // 1. Warm sunlit Celestian travertine & honey-ochre flagstone interior paving
  const flagstone = paintedCanvasTex(THREE, 'sr_cons_flagstone', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#e2d2b5';
    ctx.fillRect(0, 0, s, s);
    const rows = 5;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r % 2) * 26);
      while (x < s) {
        const bw = Math.floor(rng.jr(38, 66));
        ctx.fillStyle = rng.pick(['#f5ead2', '#eadbc0', '#f9f1df', '#e0cfa8', '#efe2c8', '#e6d8be']);
        ctx.fillRect(x + 2, r * rh + 2, bw - 4, rh - 4);
        ctx.fillStyle = 'rgba(255,252,240,0.34)';
        ctx.fillRect(x + 4, r * rh + 4, bw - 10, 5);
        x += bw;
      }
    }
    brushStrokes(ctx, s, rng, 110, ['#fff8e8', '#d4c2a2', '#9ec26e'], 2, 6, 0.18);
  }, 3.2, 3.2);

  // 2. Luminous turquoise-aqua Celestian botanical stream water with sunlit caustics
  const streamWater = paintedCanvasTex(THREE, 'sr_cons_stream_water', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, s, s);
    grd.addColorStop(0, '#27bcd6');
    grd.addColorStop(0.5, '#4ae0f2');
    grd.addColorStop(1, '#1da2c2');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 190, ['#84f5ff', '#28aec9', '#b2fcff', '#1c8ca8'], 4, 14, 0.36);
    ctx.strokeStyle = 'rgba(240,255,255,0.58)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 18; i++) {
      const cx = rng.jr(16, s - 16);
      const cy = rng.jr(16, s - 16);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rng.jr(10, 26), rng.jr(5, 12), rng.jr(-0.4, 0.4), 0, TAU);
      ctx.stroke();
    }
  }, 2.2, 2.2);

  // 3. Cascading white-and-aqua waterfall ribbon texture
  const waterfallTex = paintedCanvasTex(THREE, 'sr_cons_waterfall', 128, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#befdff');
    grd.addColorStop(0.45, '#5ce6f6');
    grd.addColorStop(0.85, '#b0fbff');
    grd.addColorStop(1, '#ffffff');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.82)' : 'rgba(130,244,255,0.58)';
      const x = rng.jr(2, s - 8);
      const y = rng.jr(0, s * 0.55);
      ctx.fillRect(x, y, rng.jr(2, 6), rng.jr(s * 0.35, s * 0.85));
    }
  }, 1, 1);

  // 4. Woven warm oatmeal burlap cloth for apothecary seed sacks
  const burlap = paintedCanvasTex(THREE, 'sr_cons_burlap', 128, (ctx, s, rng) => {
    ctx.fillStyle = '#dfc396';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 150, ['#ebd2aa', '#cca978', '#f2dec0', '#bfa070'], 2, 5, 0.35);
    ctx.strokeStyle = 'rgba(132,96,52,0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 6) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
  }, 2, 2);

  // 5. Sunlit golden-cinnamon Celestian ancient root bark texture (warm Storybook bark!)
  const sunlitBark = paintedCanvasTex(THREE, 'sr_cons_sunlit_bark', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#9c6e42';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 260, ['#b88754', '#825832', '#cca06a', '#6e4726', '#d8b07a'], 3, 9, 0.44, PI * 0.5, 0.45, 42);
    brushStrokes(ctx, s, rng, 55, ['#7eb64c', '#95ca62'], 2, 6, 0.22);
  }, 1.5, 2.0);

  _consTex = { _T: THREE, flagstone, streamWater, waterfallTex, burlap, sunlitBark };
  return _consTex;
}

// Merge all transparent glass meshes inside `container` into a single draw call!
function mergeTransparentGlass(THREE, container, targetMat, name) {
  container.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(container.matrixWorld).invert();
  const geos = [];
  const toRemove = [];

  container.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.material || !o.material.transparent) return;
    // Do not cross into a child keep-group (e.g., skip roofG when merging root!)
    for (let p = o.parent; p && p !== container; p = p.parent) {
      if (p.userData && p.userData.keep) return;
    }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) applyPlanarUVs(g, 0.4);
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    geos.push(g);
    toRemove.push(o);
  });

  toRemove.forEach((o) => {
    if (o.parent) o.parent.remove(o);
  });
  if (geos.length) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, targetMat);
    m.castShadow = false;
    m.receiveShadow = true;
    m.name = name;
    container.add(m);
  }
}

export function buildRootConservatory(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'root_conservatory', 22);
  const {
    root, roofG, add, rbox, boxCol, wall,
    pushInst, jr, pick, M, tex, glowMat, climbingVine,
  } = K;

  // Low-poly crisp box helper (12 tris) — attached to K so sky_kit.js helpers work seamlessly!
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  K.box = box;

  const sm = getSkyMats(THREE, K);
  const CT = getConservatoryTextures(THREE);

  // ==========================================================================
  // 1. CALIBRATED STORYBOOK CONSERVATORY MATERIALS (100% metalness: 0!)
  // ==========================================================================
  const flagstoneMat = M(0xffffff, CT.flagstone, { roughness: 0.88, metalness: 0 });
  const burlapMat = M(0xffffff, CT.burlap, { roughness: 0.90, metalness: 0 });
  const barkSunlitMat = M(0xffffff, CT.sunlitBark, { roughness: 0.88, metalness: 0 });

  const streamMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: CT.streamWater,
    emissive: new THREE.Color(0x1690b2),
    emissiveIntensity: 0.40,
    roughness: 0.20,
    metalness: 0,
  });
  const cascadeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: CT.waterfallTex,
    emissive: new THREE.Color(0x28b8dc),
    emissiveIntensity: 0.50,
    roughness: 0.18,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  // Luminous hero Sky-Orchid petal, inner-glow & orange labellum materials (ext_02.png & int_02.png!)
  const orchidBlueViolet = sm.orchidPetal;
  const orchidPeriwinkle = glowMat(0x88b2ff, 0x3266cc, 0.38, { roughness: 0.46, metalness: 0, side: THREE.DoubleSide });
  const orchidLavender = sm.orchidPetal;
  const orchidInnerWhite = glowMat(0xf4f0ff, 0xa89cff, 0.45, { roughness: 0.42, metalness: 0, side: THREE.DoubleSide });
  const orchidLipOrange = glowMat(0xffa038, 0xe85a10, 0.62, { roughness: 0.38, metalness: 0, side: THREE.DoubleSide });

  const glassWallMat = new THREE.MeshStandardMaterial({
    color: 0xd6f4ff,
    emissive: new THREE.Color(0x3a94c8),
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0,
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // ==========================================================================
  // 2. FLOATING ISLAND STONE PLINTH, ENTRANCE STAIRS & TWIN CYAN OBELISKS
  // ==========================================================================
  const plinthRes = buildMossyIslandPlinth(THREE, K, {
    w: 10.6,
    d: 9.0,
    h: 0.32,
    doorX: 0,
    doorZ: 4.36,
    doorW: 2.48,
    steps: 3,
    garden: opts.garden !== false,
    obelisks: true,
    parent: root,
    batchPrefix: 'cons_pl',
  });
  const FL = plinthRes.floorY; // 0.34m

  // Golden circular Celestian medallions on front obelisk pedestals & carved stair cheek stones (ext_02.png!)
  for (const sx of [-1, 1]) {
    const ox = sx * (2.48 * 0.5 + 0.42);
    const oz = 4.36 + 0.38;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14), sm.goldBrass),
      ox, 0.42, oz + 0.24, PI * 0.5, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 16), sm.brassDeep),
      ox, 0.42, oz + 0.255, 0, 0, 0, root);
    add(rbox(0.36, 0.44, 0.72, 0.03, sm.travertinePlain, 1), sx * 1.38, 0.22, 4.32, 0, 0, 0, root);
    add(rbox(0.32, 0.26, 0.52, 0.03, sm.travertineWarm, 1), sx * 1.38, 0.13, 4.92, 0, 0, 0, root);
  }

  // Right-front stone water spillway channel feeding the cliff waterfall (int_02.png & ext_02.png!)
  add(rbox(0.76, 0.16, 0.58, 0.03, sm.travertineDark, 1), 4.02, FL - 0.04, 4.44, 0, 0, 0, root);
  add(box(0.48, 0.06, 0.62, streamMat), 4.02, FL + 0.03, 4.46, 0.06, 0, 0, root);

  // Unified Interior Flagstone Floor (single ground-kept mesh across right workshop, vestibule & west orchid walk)
  {
    const floorGeos = [];
    const pushFloorBox = (w, d, cx, cz) => {
      const g = new THREE.BoxGeometry(w, 0.028, d);
      g.translate(cx, FL + 0.014, cz);
      applyPlanarUVs(g, 0.35);
      floorGeos.push(g);
    };
    pushFloorBox(2.85, 4.55, 0.02, 1.45);
    pushFloorBox(3.75, 7.25, 3.02, -0.10);
    pushFloorBox(2.15, 4.25, -3.58, 1.18);
    // Walkable stepping stones across stream waist at z ~ 0.55!
    for (const [sx, sz, sr] of [[-0.80, 0.56, 0.28], [-1.38, 0.52, 0.31], [-1.96, 0.58, 0.28]]) {
      const sg = new THREE.CylinderGeometry(sr, sr * 1.06, 0.075, 7);
      sg.scale(1.18, 1, 0.88);
      sg.translate(sx, FL + 0.038, sz);
      applyPlanarUVs(sg, 0.5);
      floorGeos.push(sg);
    }
    const mergedFloor = mergeGeometries(floorGeos, false);
    floorGeos.forEach((g) => g.dispose());
    const floorMesh = add(new THREE.Mesh(mergedFloor, flagstoneMat), 0, 0, 0, 0, 0, 0, root);
    floorMesh.userData.ground = true;
  }

  // ==========================================================================
  // 3. REUSABLE CONSERVATORY ARCHITECTURAL & BOTANICAL SCULPTING HELPERS
  // ==========================================================================
  const tubeBetween = (pts, rad, mat, tubularSeg = 16, radialSeg = 7, P = root) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
    const g = new THREE.TubeGeometry(curve, tubularSeg, rad, radialSeg, false);
    return add(new THREE.Mesh(g, mat), 0, 0, 0, 0, 0, 0, P);
  };

  // Sunlit Gnarled Root/Trunk Sculptor (uses warm sunlit Storybook bark + shared moss batch!)
  const addSunlitRoot = (points, rStart, rEnd, tubularSeg = 18, mossy = true, P = root) => {
    const m = buildGnarledRootTube(THREE, K, {
      points, rStart, rEnd, radialSeg: 8, tubularSeg, mossy,
      parent: P, batchPrefix: 'cons_rmoss',
    });
    m.material = barkSunlitMat;
    return m;
  };

  // Sculpted Gothic-Arched Patinated-Verdigris & Brass Conservatory Window Bay (y <= 3.25m in root!)
  const addConservatoryBay = ({
    x0, z0, x1, z1, y0 = FL, y1 = 2.58, kneewallH = 0.50,
    glass = true, archTracery = true, colStart = true, colEnd = false, P = root,
  }) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const span = Math.hypot(dx, dz);
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const rotY = Math.atan2(dx, dz) - PI * 0.5;
    const bg = new THREE.Group();
    bg.position.set(cx, 0, cz);
    bg.rotation.y = rotY;
    P.add(bg);

    if (kneewallH > 0.05) {
      add(rbox(span + 0.06, kneewallH, 0.24, 0.03, sm.travertine, 1), 0, y0 + kneewallH * 0.5, 0, 0, 0, 0, bg);
      add(rbox(span + 0.12, 0.075, 0.30, 0.02, sm.travertineDark, 1), 0, y0 + kneewallH + 0.02, 0, 0, 0, 0, bg);
      add(box(span + 0.08, 0.045, 0.18, sm.goldBrass), 0, y0 + kneewallH + 0.065, 0, 0, 0, 0, bg);
    }

    const glassY0 = y0 + kneewallH + 0.06;
    const glassH = y1 - glassY0;

    const addPilaster = (lx) => {
      add(rbox(0.18, 0.22, 0.22, 0.025, sm.travertineDark, 1), lx, y0 + 0.11, 0, 0, 0, 0, bg);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, y1 - y0, 8), sm.verdigrisFrame),
        lx, y0 + (y1 - y0) * 0.5, 0, 0, 0, 0, bg);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.065, 8), sm.goldBrass),
        lx, glassY0 + 0.04, 0, 0, 0, 0, bg);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.09, 8), sm.goldBrass),
        lx, y1 - 0.05, 0, 0, 0, 0, bg);
    };
    if (colStart) addPilaster(-span * 0.5);
    if (colEnd) addPilaster(span * 0.5);

    add(box(span + 0.08, 0.11, 0.15, sm.verdigrisFrame), 0, y1, 0, 0, 0, 0, bg);
    add(box(span + 0.10, 0.042, 0.17, sm.goldBrass), 0, y1 + 0.065, 0, 0, 0, 0, bg);
    add(box(0.042, glassH, 0.065, sm.verdigrisFrame), 0, glassY0 + glassH * 0.5, 0, 0, 0, 0, bg);
    add(box(span - 0.08, 0.036, 0.06, sm.goldBrass), 0, glassY0 + glassH * 0.66, 0, 0, 0, 0, bg);

    if (archTracery) {
      const springY = glassY0 + glassH * 0.64;
      const apexY = y1 - 0.06;
      const hw = span * 0.46;
      tubeBetween([
        [-hw, springY, 0],
        [-hw * 0.52, springY + (apexY - springY) * 0.68, 0],
        [0, apexY, 0],
      ], 0.028, sm.verdigrisFrame, 8, 5, bg);
      tubeBetween([
        [hw, springY, 0],
        [hw * 0.52, springY + (apexY - springY) * 0.68, 0],
        [0, apexY, 0],
      ], 0.028, sm.verdigrisFrame, 8, 5, bg);
      for (const sx of [-1, 1]) {
        tubeBetween([
          [sx * hw, springY - 0.08, 0],
          [sx * hw * 0.5, springY + (apexY - springY) * 0.42, 0],
          [0, springY - 0.08, 0],
        ], 0.02, sm.goldBrass, 8, 5, bg);
      }
      add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 5, 12), sm.goldBrass),
        0, apexY - 0.22, 0, 0, 0, 0, bg);
    }

    if (glass) {
      const gm = add(box(span - 0.08, glassH - 0.04, 0.02, glassWallMat), 0, glassY0 + glassH * 0.5, 0, 0, 0, 0, bg);
      gm.castShadow = false;
    }
    return bg;
  };

  // Hero Luminous 5-Petal Celestia Sky-Orchid Cluster (with pale inner petal sheen & orange-gold labellum!)
  const heroPetalGeo = sharedSkyGeo(THREE, 'sr_hero_orchid_petal2', () => {
    const g = new THREE.SphereGeometry(0.22, 10, 8);
    g.scale(0.76, 1.38, 0.15);
    g.translate(0, 0.23, 0);
    return g;
  });
  const heroInnerPetalGeo = sharedSkyGeo(THREE, 'sr_hero_orchid_inner2', () => {
    const g = new THREE.SphereGeometry(0.14, 8, 6);
    g.scale(0.68, 1.15, 0.14);
    g.translate(0, 0.15, 0.018);
    return g;
  });
  const heroLipGeo = sharedSkyGeo(THREE, 'sr_hero_orchid_lip2', () => {
    const g = new THREE.SphereGeometry(0.11, 8, 6);
    g.scale(0.85, 1.12, 0.48);
    return g;
  });
  const heroSwordLeafGeo = sharedSkyGeo(THREE, 'sr_hero_sword_leaf2', () => {
    const g = new THREE.SphereGeometry(0.30, 8, 6);
    g.scale(0.30, 0.09, 1.48);
    g.translate(0, 0, 0.32);
    return g;
  });

  const addHeroOrchidBloom = ({
    x = 0, y = 0.6, z = 0, scale = 1.0, rotY = 0, tiltX = 0.28,
    petalMat = orchidBlueViolet, withLeaves = true, P = root,
  }) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    P.add(g);

    if (withLeaves) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.25;
        add(new THREE.Mesh(heroSwordLeafGeo, sm.mossGreen),
          0, 0.04, 0, -0.26 - (i % 2) * 0.14, a, 0, g);
      }
      tubeBetween([[0, 0.02, 0], [0, 0.28, 0.05], [0, 0.48, 0.10]], 0.028, sm.mossGreen, 7, 5, g);
    }

    const head = new THREE.Group();
    head.position.set(0, withLeaves ? 0.48 : 0, withLeaves ? 0.11 : 0);
    head.rotation.x = tiltX;
    g.add(head);

    const angles = [0, 1.16, -1.16, 2.34, -2.34];
    angles.forEach((ang, idx) => {
      const pMesh = new THREE.Mesh(heroPetalGeo, petalMat);
      const s = idx === 0 ? 1.04 : (idx < 3 ? 1.14 : 0.94);
      pMesh.scale.set(s, s, 1);
      add(pMesh, 0, 0, idx < 3 ? 0.018 : -0.018, -0.20, 0, ang, head);
      if (idx < 3) {
        add(new THREE.Mesh(heroInnerPetalGeo, orchidInnerWhite), 0, 0, 0.026, -0.20, 0, ang, head);
      }
    });
    add(new THREE.Mesh(heroLipGeo, orchidLipOrange), 0, -0.05, 0.068, 0.30, 0, 0, head);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), P === roofG ? orchidInnerWhite : sm.cyanCrystal), 0, 0.03, 0.095, 0, 0, 0, head);
    return g;
  };

  const addFernRosette = (x, y, z, scale = 0.72, P = root) => {
    const fg = new THREE.Group();
    fg.position.set(x, y, z);
    fg.scale.setScalar(scale);
    P.add(fg);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.15;
      add(new THREE.Mesh(heroSwordLeafGeo, sm.mossGreen), 0, 0.02, 0, -0.34 - (i % 2) * 0.18, a, 0, fg);
    }
  };

  // Warm Hanging Faceted Brass Apothecary / Conservatory Lantern
  const addHangingBrassLantern = (x, yTop, z, drop = 0.52, scale = 1.0, P = root) => {
    const lg = new THREE.Group();
    lg.position.set(x, yTop, z);
    P.add(lg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, drop, 5), sm.brassDeep), 0, -drop * 0.5, 0, 0, 0, 0, lg);
    const body = new THREE.Group();
    body.position.set(0, -drop, 0);
    body.scale.setScalar(scale);
    lg.add(body);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 6), sm.goldBrass), 0, 0.04, 0, 0, 0, 0, body);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.30, 6), sm.amberGlow), 0, -0.16, 0, 0, 0, 0, body);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      add(box(0.024, 0.32, 0.024, sm.brassDeep), Math.cos(a) * 0.15, -0.16, Math.sin(a) * 0.15, 0, -a, 0, body);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.11, 6), sm.brassDeep), 0, -0.35, 0, PI, 0, 0, body);
    return lg;
  };

  // ==========================================================================
  // 4. EXTERIOR PERIMETER WALLS, CURVED GLASSHOUSE WINGS & OPEN DOUBLE DOORS
  //    (All structural walls in `root` stay <= 3.28m so `mode=interiors` is 100% clear!)
  // ==========================================================================
  const PORTAL_Z = 3.80;
  const DOOR_HW = 1.02; // 2.04m clear entrance gap (>= 1.8m!)

  addConservatoryBay({ x0: -2.06, z0: PORTAL_Z, x1: -1.06, z1: PORTAL_Z, y0: FL, y1: 2.82, kneewallH: 0.48, colStart: true, colEnd: true, P: root });
  addConservatoryBay({ x0: 1.06, z0: PORTAL_Z, x1: 2.06, z1: PORTAL_Z, y0: FL, y1: 2.82, kneewallH: 0.48, colStart: true, colEnd: true, P: root });
  boxCol(-1.56, PORTAL_Z, 1.00, 0.28);
  boxCol(1.56, PORTAL_Z, 1.00, 0.28);

  for (const sx of [-1, 1]) {
    add(rbox(0.28, 0.32, 0.32, 0.03, sm.travertinePlain, 1), sx * 1.06, FL + 0.16, PORTAL_Z + 0.04, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.102, 2.44, 10), sm.verdigrisFrame),
      sx * 1.06, FL + 1.42, PORTAL_Z + 0.04, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.112, 0.12, 10), sm.goldBrass),
      sx * 1.06, 2.06, PORTAL_Z + 0.04, 0, 0, 0, root);

    add(rbox(0.32, 0.36, 0.36, 0.03, sm.travertinePlain, 1), sx * 2.06, FL + 0.18, PORTAL_Z + 0.04, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.118, 2.64, 10), sm.verdigrisFrame),
      sx * 2.06, FL + 1.52, PORTAL_Z + 0.04, 0, 0, 0, root);
  }

  // Lower Doorway Arch Ring (crown at y = 3.12m <= 3.3m -> stays in root!)
  {
    const archPts = [];
    for (let i = 0; i <= 18; i++) {
      const a = PI - (i / 18) * PI;
      archPts.push(new THREE.Vector3(Math.cos(a) * 1.06, 2.06 + Math.sin(a) * 1.04, PORTAL_Z + 0.04));
    }
    tubeBetween(archPts, 0.082, sm.verdigrisFrame, 20, 8, root);
    const brassPts = archPts.map((p) => new THREE.Vector3(p.x * 0.96, 2.06 + (p.y - 2.06) * 0.96, PORTAL_Z + 0.09));
    tubeBetween(brassPts, 0.040, sm.goldBrass, 20, 6, root);
  }

  // Open Arched Wooden & Brass Double Doors (swung open outward so clear gap >= 1.92m!)
  for (const sx of [-1, 1]) {
    const dg = new THREE.Group();
    dg.position.set(sx * DOOR_HW, FL + 0.02, PORTAL_Z + 0.06);
    dg.rotation.y = sx * 1.28;
    root.add(dg);

    const dw = 0.96;
    const dh = 2.46;
    const cxD = -sx * (dw * 0.5);

    add(rbox(0.085, dh - 0.34, 0.065, 0.015, sm.darkTimber, 1), -sx * 0.045, (dh - 0.34) * 0.5, 0, 0, 0, 0, dg);
    add(rbox(0.085, dh - 0.48, 0.065, 0.015, sm.darkTimber, 1), -sx * (dw - 0.045), (dh - 0.48) * 0.5, 0, 0, 0, 0, dg);
    add(rbox(dw, 0.82, 0.058, 0.015, sm.oakTimber, 1), cxD, 0.41, 0, 0, 0, 0, dg);
    add(rbox(dw - 0.16, 0.56, 0.072, 0.015, sm.darkTimber, 1), cxD, 0.42, 0, 0, 0, 0, dg);
    add(rbox(dw - 0.24, 0.44, 0.080, 0.01, sm.oakTimber, 1), cxD, 0.42, 0, 0, 0, 0, dg);
    add(box(dw - 0.06, 0.07, 0.07, sm.goldBrass), cxD, 0.84, 0, 0, 0, 0, dg);

    const topPts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      topPts.push(new THREE.Vector3(-sx * (0.04 + t * (dw - 0.08)), (dh - 0.04) - Math.pow(t, 1.7) * 0.44, 0));
    }
    tubeBetween(topPts, 0.044, sm.darkTimber, 8, 6, dg);

    const paneH = 1.30;
    const pm = add(box(dw - 0.14, paneH, 0.018, glassWallMat), cxD, 0.86 + paneH * 0.5, 0, 0, 0, 0, dg);
    pm.castShadow = false;
    add(box(0.032, paneH + 0.08, 0.042, sm.goldBrass), cxD, 0.86 + paneH * 0.5, 0, 0, 0, 0, dg);
    add(box(dw - 0.14, 0.032, 0.042, sm.goldBrass), cxD, 1.34, 0, 0, 0, 0, dg);
    add(box(dw - 0.14, 0.032, 0.042, sm.goldBrass), cxD, 1.78, 0, 0, 0, 0, dg);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 12), sm.goldBrass),
      -sx * (dw - 0.14), 0.96, 0.045, 0, 0, 0, dg);
  }

  // Left Wing Curved Glasshouse Perimeter
  const leftWingNodes = [
    [-2.06, 3.66],
    [-3.36, 3.44],
    [-4.44, 2.72],
    [-4.90, 1.54],
    [-4.94, 0.00],
    [-4.90, -1.54],
    [-4.44, -2.84],
    [-3.34, -3.66],
    [-1.65, -3.85],
    [1.15, -3.85],
  ];
  for (let i = 0; i < leftWingNodes.length - 1; i++) {
    const [x0, z0] = leftWingNodes[i];
    const [x1, z1] = leftWingNodes[i + 1];
    addConservatoryBay({
      x0, z0, x1, z1,
      y0: FL,
      y1: i >= 7 ? 2.92 : 2.58,
      kneewallH: i >= 7 ? 0.60 : 0.50,
      colStart: true,
      colEnd: i === leftWingNodes.length - 2,
      P: root,
    });
    boxCol((x0 + x1) * 0.5, (z0 + z1) * 0.5, Math.hypot(x1 - x0, z1 - z0), 0.28, Math.atan2(x1 - x0, z1 - z0) - PI * 0.5);
  }

  // Right Wing Front Curved Glasshouse Bays (symmetrical with left wing in ext_02.png!)
  const rightFrontNodes = [
    [2.06, 3.66],
    [3.36, 3.44],
    [4.44, 2.72],
    [4.90, 1.38],
  ];
  for (let i = 0; i < rightFrontNodes.length - 1; i++) {
    const [x0, z0] = rightFrontNodes[i];
    const [x1, z1] = rightFrontNodes[i + 1];
    addConservatoryBay({
      x0, z0, x1, z1,
      y0: FL, y1: 2.58, kneewallH: 0.50,
      colStart: true, colEnd: i === rightFrontNodes.length - 2,
      P: root,
    });
    boxCol((x0 + x1) * 0.5, (z0 + z1) * 0.5, Math.hypot(x1 - x0, z1 - z0), 0.28, Math.atan2(x1 - x0, z1 - z0) - PI * 0.5);
  }

  // Right Room (`botanist_potting`) Warm Cream-Travertine Stone Apothecary Walls (int_02.png!)
  wall(4.90, -1.235, PI * 0.5, 5.23, 3.06, 0.28, [], sm.travertine, sm.travertineWarm, root, true);
  buildAshlarMasonryFace(THREE, K, {
    cx: -1.235, y0: FL + 0.06, y1: 2.98, cz: 4.94,
    span: 5.02, alongZ: true, depth: 0.08, mossChance: 0.16, parent: root, batchPrefix: 'cons_ash',
  });
  buildAshlarMasonryFace(THREE, K, {
    cx: -1.235, y0: FL + 0.06, y1: 2.98, cz: 4.60,
    span: 4.82, alongZ: true, depth: 0.06, mossChance: 0.03, parent: root, batchPrefix: 'cons_ash',
  });

  wall(3.025, -3.85, PI, 3.75, 3.06, 0.28, [], sm.travertine, sm.travertineWarm, root, true);
  buildAshlarMasonryFace(THREE, K, {
    cx: 3.025, y0: FL + 0.06, y1: 2.98, cz: -3.90,
    span: 3.60, alongZ: false, depth: 0.08, mossChance: 0.18, parent: root, batchPrefix: 'cons_ash',
  });
  buildAshlarMasonryFace(THREE, K, {
    cx: 3.025, y0: FL + 0.06, y1: 2.94, cz: -3.55,
    span: 3.48, alongZ: false, depth: 0.06, mossChance: 0.03, parent: root, batchPrefix: 'cons_ash',
  });

  // Warm stone coping caps along cutaway stone wall tops
  add(rbox(0.34, 0.08, 5.26, 0.02, sm.travertineWarm, 1), 4.76, 3.06, -1.235, 0, 0, 0, root);
  add(rbox(3.80, 0.08, 0.34, 0.02, sm.travertineWarm, 1), 3.025, 3.06, -3.71, 0, 0, 0, root);
  add(rbox(0.30, 0.08, 7.44, 0.02, sm.travertineWarm, 1), 1.03, 3.06, -0.10, 0, 0, 0, root);

  // Radial travertine voussoir blind-arch relief on inside back wall of apothecary (flush below 3.0m!)
  buildStoneArch(THREE, K, {
    cx: 3.02, cy: 1.50, cz: -3.52,
    radius: 1.24, thickness: 0.24, depth: 0.18, segments: 11, rotY: 0,
    keystoneGlow: false, parent: root, batchPrefix: 'bk_arch',
  });

  buildFlutedColumn(THREE, K, { x: 4.84, y0: FL, height: 2.74, radius: 0.17, z: 1.35, goldRings: true, parent: root });
  buildFlutedColumn(THREE, K, { x: 4.84, y0: FL, height: 2.74, radius: 0.17, z: -3.76, goldRings: true, parent: root });

  // Interior Partition Wall at x = 1.15 with Wide Arched Doorway at z = 0.20 (w = 1.84m >= 1.6m!)
  wall(1.15, -0.10, -PI * 0.5, 7.42, 3.06, 0.24, [
    { u: 0.30, w: 1.84, h: 2.72, door: true, arch: true },
    { u: 2.28, y0: 1.06, w: 1.16, h: 1.36 },
  ], sm.travertineWarm, sm.travertinePlain, root, true);

  buildStoneArch(THREE, K, {
    cx: 1.03, cy: 1.80, cz: 0.20,
    radius: 0.96, thickness: 0.24, depth: 0.34, segments: 9, rotY: PI * 0.5,
    keystoneGlow: true, parent: root, batchPrefix: 'pt_arch',
  });
  add(rbox(0.28, 0.08, 1.24, 0.02, sm.travertineDark, 1), 1.03, 1.04, 2.18, 0, 0, 0, root);
  add(box(0.05, 1.34, 0.05, sm.goldBrass), 1.03, 1.74, 2.18, 0, 0, 0, root);
  add(box(0.05, 0.05, 1.14, sm.goldBrass), 1.03, 1.74, 2.18, 0, 0, 0, root);

  buildFlutedColumn(THREE, K, { x: 1.05, y0: FL, height: 2.74, radius: 0.17, z: 3.44, goldRings: true, parent: root });
  buildFlutedColumn(THREE, K, { x: 1.05, y0: FL, height: 2.74, radius: 0.16, z: 1.24, goldRings: false, parent: root });
  buildFlutedColumn(THREE, K, { x: 1.05, y0: FL, height: 2.74, radius: 0.16, z: -0.84, goldRings: false, parent: root });

  // ==========================================================================
  // 5. LEFT ROOM (`orchid_stream`): GNARLED ROOTS, 2-STEP WATERFALL, LILY STREAM & ORCHIDS
  // ==========================================================================
  const curbGeo = () => sharedSkyGeo(THREE, 'sr_curb_block', () => new RoundedBoxGeometry(0.68, 0.30, 0.40, 0.05, 1));
  const rockGeo = () => sharedSkyGeo(THREE, 'sr_cliff_rock', () => new THREE.DodecahedronGeometry(0.5, 1));
  const flwGeo = () => sharedSkyGeo(THREE, 'sr_wildflower', () => new THREE.DodecahedronGeometry(0.085, 0));

  // Helper to build organic stone-walled circular/oval terrace pools (no boxy exposed corners!)
  const addStoneTerracePool = (cx, cz, rx, rz, h, curbCount = 14) => {
    const core = new THREE.CylinderGeometry(1, 1.06, h, 16);
    core.scale(rx * 0.96, 1, rz * 0.96);
    add(new THREE.Mesh(core, sm.travertineDark), cx, FL + h * 0.5, cz, 0, 0, 0, root);

    const wDisc = new THREE.CylinderGeometry(1, 1, 0.05, 16);
    wDisc.scale(rx * 0.88, 1, rz * 0.88);
    add(new THREE.Mesh(wDisc, streamMat), cx, FL + h + 0.01, cz, 0, 0, 0, root);

    for (let i = 0; i < curbCount; i++) {
      const a = (i / curbCount) * TAU;
      const bx = cx + Math.cos(a) * rx;
      const bz = cz + Math.sin(a) * rz;
      pushInst('cons_pl_curb', curbGeo, sm.stoneInst,
        bx, FL + h - 0.10, bz, 0, -a + PI * 0.5, 0, 0.56, 0.88, 0.68, pick(TRAVERTINE_PAL), root);
      if (i % 2 === 0) {
        pushInst('cons_pl_moss', rockGeo, sm.foliageInst,
          bx + Math.cos(a) * 0.14, FL + h + 0.06, bz + Math.sin(a) * 0.14,
          0, jr(0, TAU), 0, 0.48, 0.24, 0.48, pick(MOSS_PAL), root);
      }
    }
  };

  // Organic 2-Step Waterfall Pools + Root Pool (no rectangular box corners!)
  addStoneTerracePool(-1.32, -2.72, 1.12, 0.86, 0.96, 14);
  addStoneTerracePool(-0.88, -1.52, 0.92, 0.76, 0.50, 12);
  addStoneTerracePool(-2.32, -1.28, 0.86, 0.74, 0.48, 12);
  // Mossy boulder mound behind/under the ancient tree root crown
  for (const [rx, ry, rz, sx, sy, sz, cIdx] of [
    [-2.95, FL + 0.42, -2.55, 2.2, 1.35, 1.8, 0],
    [-3.75, FL + 0.34, -2.05, 1.8, 1.05, 1.6, 2],
    [-1.95, FL + 0.52, -2.95, 1.9, 1.45, 1.5, 1],
  ]) {
    pushInst('cons_pl_moss', rockGeo, sm.foliageInst, rx, ry, rz, 0.1, 0.5, -0.1, sx, sy, sz, MOSS_PAL[cIdx], root);
  }
  boxCol(-2.05, -2.32, 3.65, 2.30);

  // Sculpted Cascading Waterfalls (Upper->Middle + Twin Middle->Lower Stream Cascades!)
  const addWaterfallRibbon = (cx, yTop, yBot, zTop, zBot, width) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, yTop, zTop),
      new THREE.Vector3(0, (yTop + yBot) * 0.5 + 0.06, (zTop + zBot) * 0.5 + 0.09),
      new THREE.Vector3(0, yBot, zBot),
    ]);
    const pts = curve.getPoints(10);
    const pos = [];
    const uvs = [];
    const idx = [];
    for (let i = 0; i < pts.length; i++) {
      const v = i / (pts.length - 1);
      const w = width * (1 + 0.12 * Math.sin(v * PI));
      pos.push(-w * 0.5, pts[i].y, pts[i].z, w * 0.5, pts[i].y, pts[i].z);
      uvs.push(0, 1 - v, 1, 1 - v);
      if (i < pts.length - 1) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    add(new THREE.Mesh(g, cascadeMat), cx, 0, 0, 0, 0, 0, root);
    for (let f = -2; f <= 2; f++) {
      const fg = new THREE.SphereGeometry(0.085 + (2 - Math.abs(f)) * 0.02, 7, 5);
      add(new THREE.Mesh(fg, sm.cyanSoft), cx + f * (width * 0.22), yBot + 0.04, zBot + 0.05 + (f % 2) * 0.03, 0, 0, 0, root);
    }
  };

  addWaterfallRibbon(-1.10, FL + 0.96, FL + 0.52, -1.96, -1.76, 0.54);
  addWaterfallRibbon(-0.88, FL + 0.50, FL + 0.04, -0.84, -0.58, 0.60);
  addWaterfallRibbon(-2.15, FL + 0.48, FL + 0.04, -0.60, -0.34, 0.56);

  // Winding Glowing Turquoise Lower Lily-Pad Stream
  {
    const streamShape = new THREE.Shape();
    const rightBank = [
      [-0.45, -0.68], [-0.32, -0.10], [-0.52, 0.48], [-1.05, 1.05],
      [-1.18, 1.65], [-0.88, 2.25], [-1.35, 2.72],
    ];
    const leftBank = [
      [-2.45, 2.68], [-2.78, 2.05], [-2.52, 1.28], [-2.28, 0.55],
      [-2.58, -0.18], [-2.48, -0.72],
    ];
    streamShape.moveTo(rightBank[0][0], -rightBank[0][1]);
    for (let i = 1; i < rightBank.length; i++) streamShape.lineTo(rightBank[i][0], -rightBank[i][1]);
    for (let i = 0; i < leftBank.length; i++) streamShape.lineTo(leftBank[i][0], -leftBank[i][1]);
    streamShape.closePath();

    const sGeo = new THREE.ShapeGeometry(streamShape, 10);
    sGeo.rotateX(-PI * 0.5);
    const sp = sGeo.attributes.position;
    const suv = sGeo.attributes.uv;
    for (let i = 0; i < sp.count; i++) {
      suv.setXY(i, sp.getX(i) * 0.42 + 0.5, sp.getZ(i) * 0.42 + 0.5);
    }
    const sMesh = add(new THREE.Mesh(sGeo, streamMat), 0, FL + 0.024, 0, 0, 0, 0, root);
    sMesh.userData.ground = true;

    const bankPts = [...rightBank, ...leftBank];
    bankPts.forEach(([bx, bz], idx) => {
      pushInst('cons_pl_curb', curbGeo, sm.stoneInst,
        bx, FL + 0.06, bz, 0, idx * 0.5, 0, 0.54, 0.36, 0.62, pick(TRAVERTINE_PAL), root);
      if (idx % 2 === 0) {
        pushInst('cons_pl_moss', rockGeo, sm.foliageInst,
          bx + (idx < rightBank.length ? 0.22 : -0.22), FL + 0.11, bz + jr(-0.1, 0.1),
          0, jr(0, TAU), 0, 0.48, 0.22, 0.48, pick(MOSS_PAL), root);
      }
    });

    // Floating notched green lily pads & glowing lotus buds on the turquoise stream
    const lilySpots = [
      [-1.45, -0.22, 0.20], [-1.88, 0.08, 0.17], [-1.62, 1.18, 0.21],
      [-2.08, 1.56, 0.18], [-1.52, 1.96, 0.22], [-1.92, 2.28, 0.16], [-1.18, 1.62, 0.15],
    ];
    lilySpots.forEach(([lx, lz, lr], i) => {
      const padGeo = new THREE.CylinderGeometry(lr, lr, 0.018, 12, 1, false, 0.25, TAU - 0.5);
      add(new THREE.Mesh(padGeo, sm.mossGreen), lx, FL + 0.036, lz, 0, i * 1.3, 0, root);
      if (i % 2 === 0) {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), i === 0 ? sm.amberGlow : orchidLavender),
          lx + 0.02, FL + 0.068, lz, 0, 0, 0, root);
      }
    });
  }

  //Lush fern rosettes around waterfall & stream banks
  addFernRosette(-0.28, FL + 0.05, -0.42, 0.78, root);
  addFernRosette(-2.65, FL + 0.05, 0.85, 0.82, root);
  addFernRosette(-2.78, FL + 0.05, 2.15, 0.74, root);
  addFernRosette(-0.35, FL + 0.52, -1.65, 0.72, root);

  // Foreground-Right Curved Stone Peninsula Bed beside stream (int_02.png hero foreground detail!)
  for (let i = 0; i < 6; i++) {
    const a = 0.4 + (i / 5) * 2.5;
    pushInst('cons_pl_curb', curbGeo, sm.stoneInst,
      -0.46 + Math.cos(a) * 0.56, FL + 0.14, 1.52 + Math.sin(a) * 0.48,
      0, -a + PI * 0.5, 0, 0.48, 0.72, 0.54, pick(TRAVERTINE_PAL), root);
  }
  pushInst('cons_pl_moss', rockGeo, sm.foliageInst, -0.46, FL + 0.22, 1.52, 0, 0.4, 0, 0.88, 0.34, 0.78, MOSS_PAL[1], root);
  addHeroOrchidBloom({ x: -0.46, y: FL + 0.24, z: 1.52, scale: 0.76, rotY: 0.35, petalMat: orchidLavender, P: root });

  // Raised Left Stone Orchid Terrace Bed (x ∈ [-4.65, -2.95], z ∈ [-0.85, +1.05])
  add(rbox(1.55, 0.38, 1.82, 0.04, sm.travertine, 1), -3.82, FL + 0.19, 0.08, 0, 0.12, 0, root);
  add(rbox(1.38, 0.08, 1.64, 0.02, sm.darkTimber, 1), -3.82, FL + 0.38, 0.08, 0, 0.12, 0, root);
  for (let i = 0; i < 7; i++) {
    pushInst('cons_pl_curb', curbGeo, sm.stoneInst,
      -3.04, FL + 0.20, -0.72 + i * 0.27, 0, PI * 0.5, 0, 0.44, 0.92, 0.48, pick(TRAVERTINE_PAL), root);
  }
  boxCol(-3.82, 0.08, 1.55, 1.82);

  // Giant Luminous Celestia Sky-Orchids blooming across `orchid_stream`!
  addHeroOrchidBloom({ x: -4.15, y: FL + 0.42, z: 0.58, scale: 0.96, rotY: 0.65, petalMat: orchidBlueViolet, P: root });
  addHeroOrchidBloom({ x: -3.55, y: FL + 0.44, z: 0.12, scale: 1.08, rotY: 0.42, petalMat: orchidPeriwinkle, P: root });
  addHeroOrchidBloom({ x: -3.88, y: FL + 0.38, z: -0.46, scale: 0.88, rotY: 0.85, petalMat: orchidLavender, P: root });
  buildSkyOrchidCluster(THREE, K, { x: -4.22, y: FL + 0.20, z: 1.58, count: 3, scale: 1.20, rotY: 0.5, parent: root });

  addHeroOrchidBloom({ x: -2.42, y: FL + 0.82, z: -2.02, scale: 1.12, rotY: 0.28, petalMat: orchidPeriwinkle, P: root });
  addHeroOrchidBloom({ x: -1.82, y: FL + 0.96, z: -2.34, scale: 1.02, rotY: 0.15, petalMat: orchidBlueViolet, P: root });
  addHeroOrchidBloom({ x: -1.10, y: FL + 1.18, z: -2.82, scale: 1.15, rotY: -0.18, petalMat: orchidPeriwinkle, P: root });
  addHeroOrchidBloom({ x: -0.42, y: FL + 1.14, z: -2.65, scale: 1.02, rotY: -0.32, petalMat: orchidBlueViolet, P: root });
  buildSkyOrchidCluster(THREE, K, { x: -1.52, y: FL + 1.00, z: -2.50, count: 3, scale: 1.10, rotY: 0.1, parent: root });

  for (let i = 0; i < 34; i++) {
    const spot = i < 16
      ? [-3.85 + jr(-0.65, 0.65), FL + 0.44, 0.08 + jr(-0.82, 0.82)]
      : [-1.65 + jr(-1.35, 1.35), FL + (i % 2 ? 0.56 : 1.02), -1.95 + jr(-0.95, 0.75)];
    pushInst('cons_pl_moss', rockGeo, sm.foliageInst,
      spot[0], spot[1], spot[2], 0, jr(0, TAU), 0, jr(0.45, 0.85), jr(0.20, 0.36), jr(0.45, 0.85),
      pick(MOSS_PAL), root);
    pushInst('cons_pl_flw', flwGeo, sm.foliageInst,
      spot[0] + jr(-0.12, 0.12), spot[1] + 0.12, spot[2] + jr(-0.12, 0.12),
      0, jr(0, TAU), 0, jr(0.9, 1.4), jr(0.7, 1.05), jr(0.9, 1.4),
      pick(WILDFLOWER_PAL), root);
  }

  // Organic S-Curved Sunlit Ancient Tree Trunk & Roots Hugging the Rockery (int_02.png hero!)
  addSunlitRoot([
    [-4.38, 1.55, -1.65],
    [-3.38, 1.98, -2.35],
    [-2.18, 2.52, -2.98],
    [-0.75, 2.88, -3.35],
    [0.62, 3.08, -3.48],
  ], 0.38, 0.24, 22, true, root);
  addSunlitRoot([
    [-3.45, 1.95, -2.32],
    [-2.55, 2.38, -2.82],
    [-1.45, 2.85, -3.28],
    [-0.35, 3.16, -3.45],
  ], 0.26, 0.15, 18, false, root);

  // Sinuous flaring roots hugging the stone boulders & cascading down beside the waterfalls!
  [
    { pts: [[-3.35, 1.88, -2.25], [-3.05, 1.35, -1.85], [-2.78, 0.78, -1.35], [-2.52, FL + 0.08, -0.58]], r0: 0.24, r1: 0.06 },
    { pts: [[-2.85, 2.05, -2.55], [-2.42, 1.42, -2.02], [-1.92, 0.82, -1.48], [-1.58, FL + 0.08, -0.62]], r0: 0.22, r1: 0.06 },
    { pts: [[-3.68, 1.78, -2.02], [-3.88, 1.18, -1.32], [-3.65, FL + 0.44, -0.52]], r0: 0.20, r1: 0.06 },
    { pts: [[-1.55, 2.65, -3.12], [-1.18, 1.88, -2.75], [-0.58, 1.22, -2.15], [-0.25, FL + 0.18, -1.18]], r0: 0.20, r1: 0.06 },
    { pts: [[-4.25, 1.52, -1.58], [-4.52, 0.98, -0.68], [-4.38, FL + 0.42, 0.42]], r0: 0.19, r1: 0.06 },
    { pts: [[-2.95, 1.55, -2.12], [-2.35, 1.05, -1.68], [-1.98, 0.56, -0.98], [-1.42, FL + 0.06, -0.25]], r0: 0.16, r1: 0.05 },
  ].forEach((rp) => addSunlitRoot(rp.pts, rp.r0, rp.r1, 16, true, root));

  // Warm Hanging Brass Lanterns in `orchid_stream`
  add(box(0.08, 0.08, 0.46, sm.brassDeep), 0.58, 2.84, -2.42, 0, 0, 0, root);
  addHangingBrassLantern(0.58, 2.82, -2.24, 0.50, 1.06, root);

  add(box(0.42, 0.08, 0.08, sm.brassDeep), -3.82, 2.48, 1.65, 0, 0, 0, root);
  addHangingBrassLantern(-3.64, 2.46, 1.65, 0.42, 0.90, root);

  // Slatted Wooden Orchid Bench at (0.38, FL, -1.28) — glimpsed warmly through the open front double doors (ext_02.png!)
  {
    const tx = 0.38;
    const tz = -1.28;
    for (const dx of [-0.18, 0, 0.18]) {
      add(rbox(0.14, 0.045, 1.06, 0.01, sm.oakTimber, 1), tx + dx, FL + 0.66, tz, 0, 0, 0, root);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(box(0.065, 0.64, 0.065, sm.darkTimber), tx + sx * 0.22, FL + 0.32, tz + sz * 0.44, 0, 0, 0, root);
    }
    add(box(0.48, 0.05, 0.06, sm.darkTimber), tx, FL + 0.24, tz - 0.44, 0, 0, 0, root);
    add(box(0.48, 0.05, 0.06, sm.darkTimber), tx, FL + 0.24, tz + 0.44, 0, 0, 0, root);
    for (const [dz, fc] of [[-0.28, 0xff9ec4], [0.26, 0xc8a4ff]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.18, 8), sm.terracotta), tx, FL + 0.77, tz + dz, 0, 0, 0, root);
      pushInst('cons_pl_moss', rockGeo, sm.foliageInst, tx, FL + 0.89, tz + dz, 0, dz, 0, 0.26, 0.22, 0.26, FOLIAGE_SUN_PAL[0], root);
      pushInst('cons_pl_flw', flwGeo, sm.foliageInst, tx, FL + 0.98, tz + dz, 0, 0, 0, 1.2, 0.9, 1.2, fc, root);
    }
    boxCol(tx, tz, 0.58, 1.08);
  }

  // ==========================================================================
  // 6. RIGHT ROOM (`botanist_potting`): L-WORKBENCH, POTTER SHELVES, HERBS & SACKS
  // ==========================================================================

  // Sunny Front-Right Window Orchid Bed (x = 3.92, z = 2.52 — visible through right wing in ext_02.png!)
  add(rbox(1.52, 0.34, 1.18, 0.04, sm.travertine, 1), 3.92, FL + 0.17, 2.52, 0, -0.48, 0, root);
  add(rbox(1.36, 0.07, 1.02, 0.02, sm.darkTimber, 1), 3.92, FL + 0.35, 2.52, 0, -0.48, 0, root);
  addHeroOrchidBloom({ x: 3.42, y: FL + 0.38, z: 2.82, scale: 0.95, rotY: -0.35, petalMat: orchidBlueViolet, P: root });
  addHeroOrchidBloom({ x: 4.02, y: FL + 0.40, z: 2.54, scale: 1.02, rotY: -0.58, petalMat: orchidPeriwinkle, P: root });
  addHeroOrchidBloom({ x: 4.38, y: FL + 0.34, z: 1.98, scale: 0.90, rotY: -0.88, petalMat: orchidLavender, P: root });
  boxCol(3.92, 2.52, 1.48, 1.15, -0.48);

  // Long Oak Potting Workbench along Right Wall + L-Return under Herb Bundles (matches int_02.png 1:1!)
  {
    const bx = 4.18;
    const bz = -1.18;
    const bw = 0.88;
    const bl = 2.98;
    const bh = 0.84;

    add(rbox(bw, 0.09, bl, 0.025, sm.oakTimber, 1), bx, FL + bh, bz, 0, 0, 0, root);
    add(box(bw - 0.10, 0.11, bl - 0.12, sm.darkTimber), bx, FL + bh - 0.09, bz, 0, 0, 0, root);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(rbox(0.11, bh - 0.04, 0.11, 0.015, sm.darkTimber, 1),
        bx + sx * (bw * 0.5 - 0.09), FL + (bh - 0.04) * 0.5, bz + sz * (bl * 0.5 - 0.11), 0, 0, 0, root);
    }

    // Back-wall L-return counter (`x ∈ [2.35, 3.82], z = -3.08`) holding the twin big flowering terracotta pots!
    add(rbox(1.52, 0.085, 0.72, 0.025, sm.oakTimber, 1), 3.08, FL + bh, -3.08, 0, 0, 0, root);
    add(box(1.42, 0.10, 0.62, sm.darkTimber), 3.08, FL + bh - 0.08, -3.08, 0, 0, 0, root);
    add(rbox(0.10, bh - 0.04, 0.10, 0.015, sm.darkTimber, 1), 2.42, FL + (bh - 0.04) * 0.5, -2.80, 0, 0, 0, root);
    add(rbox(0.10, bh - 0.04, 0.10, 0.015, sm.darkTimber, 1), 2.42, FL + (bh - 0.04) * 0.5, -3.35, 0, 0, 0, root);
    boxCol(3.08, -3.08, 1.52, 0.76);

    // Two carved 2-drawer wooden storage chests tucked under main workbench
    for (const dz of [-0.68, 0.62]) {
      add(rbox(0.68, 0.58, 0.86, 0.02, sm.oakTimber, 1), bx - 0.04, FL + 0.29, bz + dz, 0, 0, 0, root);
      for (const dy of [0.16, 0.42]) {
        add(rbox(0.04, 0.20, 0.72, 0.01, sm.darkTimber, 1), bx - 0.39, FL + dy, bz + dz, 0, 0, 0, root);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), sm.goldBrass), bx - 0.42, FL + dy, bz + dz, 0, 0, 0, root);
      }
    }

    // Twin large flowering terracotta planters on L-return right below the hanging herbs (int_02.png!)
    for (const [px, pz, fCol] of [[2.72, -3.06, 0xff9ec4], [3.34, -3.06, 0xffe27a]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.28, 10), sm.terracotta), px, FL + bh + 0.17, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.026, 6, 12), sm.terracotta), px, FL + bh + 0.30, pz, PI * 0.5, 0, 0, root);
      pushInst('cons_pl_moss', rockGeo, sm.foliageInst, px, FL + bh + 0.36, pz, 0, pz, 0, 0.44, 0.30, 0.44, FOLIAGE_SUN_PAL[1], root);
      for (let b = 0; b < 5; b++) {
        const a = (b / 5) * TAU;
        pushInst('cons_pl_flw', flwGeo, sm.foliageInst,
          px + Math.cos(a) * 0.10, FL + bh + 0.48, pz + Math.sin(a) * 0.10, 0, 0, 0, 1.25, 0.95, 1.25, fCol, root);
      }
    }

    // Workbench tabletop clutter: ceramic mortar & pestle, folded seed bags, botanical ledger & herb boxes!
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.065, 0.11, 8), sm.travertinePlain), bx - 0.18, FL + bh + 0.09, bz - 0.65, 0, 0, 0, root);
    add(box(0.38, 0.02, 0.46, sm.travertinePlain), bx - 0.14, FL + bh + 0.055, bz + 0.18, 0, 0.18, 0, root);
    add(rbox(0.28, 0.14, 0.32, 0.02, burlapMat, 1), bx + 0.12, FL + bh + 0.11, bz - 0.18, 0, 0.25, 0, root);
    add(rbox(0.26, 0.12, 0.30, 0.02, sm.oakTimber, 1), bx + 0.14, FL + bh + 0.10, bz + 0.78, 0, -0.12, 0, root);

    boxCol(bx, bz, bw + 0.08, bl + 0.08);
  }

  // 3-Tier Wooden Wall Shelves with Rows of Terracotta Flowerpots & Green Seedlings (int_02.png!)
  {
    const sx = 4.46;
    const sz = -1.12;
    const sl = 2.66;
    const potGeo = () => sharedSkyGeo(THREE, 'sr_shelf_pot_merged', () => {
      const c = new THREE.CylinderGeometry(0.095, 0.068, 0.16, 8).toNonIndexed();
      const t = new THREE.TorusGeometry(0.094, 0.016, 5, 10).toNonIndexed();
      t.rotateX(PI * 0.5);
      t.translate(0, 0.072, 0);
      return mergeGeometries([c, t], false);
    });

    for (const dz of [-sl * 0.48, 0, sl * 0.48]) {
      add(box(0.08, 1.72, 0.08, sm.darkTimber), sx + 0.12, FL + 1.80, sz + dz, 0, 0, 0, root);
      add(box(0.34, 0.06, 0.07, sm.darkTimber), sx, FL + 1.24, sz + dz, 0, 0, 0, root);
    }

    [1.32, 1.86, 2.38].forEach((sh, tier) => {
      add(rbox(0.36, 0.055, sl, 0.015, sm.oakTimber, 1), sx, FL + sh, sz, 0, 0, 0, root);
      const nPots = 6;
      for (let p = 0; p < nPots; p++) {
        const pz = sz - sl * 0.42 + (p / (nPots - 1)) * (sl * 0.84) + jr(-0.03, 0.03);
        const px = sx - 0.03 + jr(-0.02, 0.02);
        const py = FL + sh + 0.105;
        const sc = jr(0.88, 1.12);
        const pCol = pick([0xd67448, 0xc8643c, 0xdf8254, 0xba5b36]);
        pushInst('sh_pot', potGeo, sm.stoneInst, px, py, pz, 0, 0, 0, sc, sc, sc, pCol, root);
        if ((p + tier) % 4 !== 3) {
          pushInst('cons_pl_moss', rockGeo, sm.foliageInst,
            px, py + 0.12 * sc, pz, 0, jr(0, TAU), 0, 0.22 * sc, 0.20 * sc, 0.22 * sc,
            pick(FOLIAGE_SUN_PAL), root);
        }
      }
    });
  }

  // Hanging Bundles of Dried Herbs on Back Apothecary Wall & Warm Pendant Lantern
  {
    const hy = FL + 2.18;
    const hz = -3.44;
    add(box(1.92, 0.055, 0.055, sm.darkTimber), 2.58, hy, hz, 0, 0, 0, root);
    for (const dx of [-0.88, 0.88]) {
      add(box(0.06, 0.08, 0.16, sm.brassDeep), 2.58 + dx, hy, hz - 0.05, 0, 0, 0, root);
    }
    [1.82, 2.20, 2.58, 2.96, 3.34].forEach((bx, idx) => {
      const bMat = idx % 2 === 0 ? sm.goldBrass : sm.mossGreen;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 5), sm.oakTimber), bx, hy - 0.08, hz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.44, 7), bMat), bx, hy - 0.34, hz, 0, idx * 0.5, (idx - 2) * 0.03, root);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.012, 5, 8), burlapMat), bx, hy - 0.18, hz, PI * 0.5, 0, 0, root);
    });
    for (let k = 0; k < 5; k++) {
      pushInst('cons_pl_moss', rockGeo, sm.foliageInst,
        3.68 + jr(-0.08, 0.08), hy - 0.18 - k * 0.11, hz + 0.06, 0, jr(0, TAU), 0,
        0.30 - k * 0.03, 0.22, 0.26, FOLIAGE_SUN_PAL[k % 3], root);
    }

    add(rbox(0.56, 0.88, 0.54, 0.025, sm.oakTimber, 1), 1.62, FL + 0.44, -3.15, 0, 0, 0, root);
    add(rbox(0.42, 0.34, 0.40, 0.02, sm.darkTimber, 1), 1.62, FL + 1.04, -3.15, 0, 0, 0, root);
    boxCol(1.62, -3.15, 0.62, 0.60);

    add(box(0.09, 0.09, 0.68, sm.darkTimber), 3.12, 2.94, -3.22, 0, 0, 0, root);
    addHangingBrassLantern(3.12, 2.90, -2.92, 0.46, 1.10, root);
  }

  // Plump Tied Burlap Seed Sacks & Wooden Crate Stool (int_02.png!)
  const sackBodyGeo = sharedSkyGeo(THREE, 'sr_burlap_sack', () => {
    const g = new THREE.SphereGeometry(0.24, 10, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const bulge = y < 0 ? 1.24 : (1.0 - y * 1.45);
      p.setX(i, p.getX(i) * Math.max(0.42, bulge));
      p.setZ(i, p.getZ(i) * Math.max(0.42, bulge * 0.92));
      p.setY(i, y * 1.28 + 0.24);
    }
    g.computeVertexNormals();
    return g;
  });
  const addBurlapSack = (x, y, z, scale = 1.0, rotY = 0) => {
    const sg = new THREE.Group();
    sg.position.set(x, y, z);
    sg.rotation.y = rotY;
    sg.scale.setScalar(scale);
    root.add(sg);
    add(new THREE.Mesh(sackBodyGeo, burlapMat), 0, 0, 0, 0, 0, 0, sg);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 6, 10), sm.oakTimber), 0, 0.48, 0, PI * 0.5, 0, 0, sg);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.14, 7, 1, true), burlapMat), 0, 0.55, 0, PI, 0, 0, sg);
  };

  addBurlapSack(4.12, FL, 0.54, 1.08, 0.35);
  addBurlapSack(4.46, FL, 0.92, 1.14, -0.25);
  addBurlapSack(4.44, FL + 0.48, 0.98, 0.88, 0.55);

  add(rbox(0.54, 0.42, 0.54, 0.02, sm.oakTimber, 1), 1.62, FL + 0.21, -1.62, 0, 0.08, 0, root);
  addBurlapSack(1.62, FL + 0.42, -1.62, 0.76, 0.42);
  boxCol(1.62, -1.62, 0.58, 0.58);

  // ==========================================================================
  // 7. EXTERIOR ANCIENT TREE ROOTS & CASCADING PURPLE WISTERIA (<= 3.25m in root)
  // ==========================================================================
  // Prominent Sunlit Ancient Tree Trunks & Roots Wrapping the Front-Right Conservatory Corner (ext_02.png hero!)
  addSunlitRoot([
    [4.68, 0.18, 3.12],
    [4.88, 1.05, 2.52],
    [4.75, 1.98, 1.82],
    [4.52, 2.86, 1.18],
    [4.35, 3.22, 0.72],
  ], 0.38, 0.24, 20, true, root);
  addSunlitRoot([
    [5.05, 0.16, 2.38],
    [5.12, 1.08, 1.68],
    [4.95, 2.12, 0.92],
    [4.68, 3.15, 0.25],
  ], 0.32, 0.20, 16, true, root);
  addSunlitRoot([
    [4.35, 0.22, 3.52],
    [4.68, 0.88, 2.88],
    [4.82, 1.72, 2.15],
  ], 0.24, 0.12, 14, true, root);

  // Cascading Lavender-Purple Wisteria Racemes & Climbing Vines on Front Portal & Left Eave
  for (const sx of [-1, 1]) {
    buildWisteriaRacemes(THREE, K, {
      cx: sx * 1.90, yTop: 2.84, cz: PORTAL_Z + 0.18,
      spanX: 0.92, spanZ: 0.28, strands: 9, maxLen: 1.36,
      parent: root, batchPrefix: 'cons_pl_wist',
    });
    climbingVine([
      [sx * 2.10, 1.35, PORTAL_Z + 0.16],
      [sx * 2.00, 2.05, PORTAL_Z + 0.18],
      [sx * 1.66, 2.75, PORTAL_Z + 0.16],
      [sx * 1.24, 3.06, PORTAL_Z + 0.14],
    ], {
      leaves: 30, bloomCols: WILDFLOWER_PAL, bloomRate: 0.55, parent: root,
    });
  }
  buildWisteriaRacemes(THREE, K, {
    cx: -4.94, yTop: 2.54, cz: 1.45,
    spanX: 1.15, spanZ: 0.28, strands: 8, maxLen: 1.26, rotY: PI * 0.5,
    parent: root, batchPrefix: 'cons_pl_wist',
  });

  // ==========================================================================
  // 8. UPPER VAULTED GLASS DOME, ROSE PORTAL, CUPOLA CROWN & CANOPY (`roofG`!)
  //    Everything above y = 3.3m lives in `roofG` so `mode=interiors` opens cleanly!
  // ==========================================================================

  // A. Upper Front Lotus/Rose Fanlight Portal Arch + Filigree Crest + Finial
  {
    const outerPts = [];
    for (let i = 0; i <= 22; i++) {
      const a = PI - (i / 22) * PI;
      outerPts.push(new THREE.Vector3(Math.cos(a) * 2.06, 2.68 + Math.sin(a) * 1.76, PORTAL_Z + 0.05));
    }
    tubeBetween(outerPts, 0.10, sm.verdigrisFrame, 24, 8, roofG);
    const outerBrass = outerPts.map((p) => new THREE.Vector3(p.x * 0.96, 2.68 + (p.y - 2.68) * 0.96, PORTAL_Z + 0.11));
    tubeBetween(outerBrass, 0.045, sm.goldBrass, 24, 6, roofG);

    const lunShape = new THREE.Shape();
    for (let i = 0; i <= 20; i++) {
      const a = PI - (i / 20) * PI;
      const x = Math.cos(a) * 2.00;
      const y = 2.68 + Math.sin(a) * 1.70;
      if (i === 0) lunShape.moveTo(x, y); else lunShape.lineTo(x, y);
    }
    for (let i = 20; i >= 0; i--) {
      const a = PI - (i / 20) * PI;
      lunShape.lineTo(Math.cos(a) * 1.06, 2.06 + Math.sin(a) * 1.04);
    }
    lunShape.closePath();
    const lunMesh = add(new THREE.Mesh(new THREE.ShapeGeometry(lunShape, 8), sm.conservatoryGlass), 0, 0, PORTAL_Z + 0.03, 0, 0, 0, roofG);
    lunMesh.castShadow = false;

    for (let k = 0; k < 7; k++) {
      const aMid = PI * 0.14 + (k / 6) * (PI * 0.72);
      const aL = aMid - 0.15;
      const aR = aMid + 0.15;
      const p0 = new THREE.Vector3(Math.cos(aL) * 1.06, 2.06 + Math.sin(aL) * 1.04, PORTAL_Z + 0.08);
      const pTip = new THREE.Vector3(Math.cos(aMid) * 1.94, 2.68 + Math.sin(aMid) * 1.64, PORTAL_Z + 0.08);
      const p1 = new THREE.Vector3(Math.cos(aR) * 1.06, 2.06 + Math.sin(aR) * 1.04, PORTAL_Z + 0.08);
      tubeBetween([p0, p0.clone().lerp(pTip, 0.55), pTip, p1.clone().lerp(pTip, 0.55), p1],
        0.030, k % 2 === 0 ? sm.goldBrass : sm.verdigrisFrame, 12, 5, roofG);
    }

    for (let s = -4; s <= 4; s++) {
      const a = PI * 0.5 + s * 0.11;
      const rx = -Math.sin(a - PI * 0.5) * 2.14;
      const ry = 2.68 + Math.cos(a - PI * 0.5) * 1.84;
      add(new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 5, 12), sm.goldBrass), rx, ry, PORTAL_Z + 0.09, 0, 0, 0, roofG);
    }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), sm.goldBrass), 0, 4.62, PORTAL_Z + 0.09, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.30, 8), sm.goldBrass), 0, 4.82, PORTAL_Z + 0.09, 0, 0, 0, roofG);

    for (let i = 0; i <= 8; i++) {
      const a = PI - (i / 8) * PI;
      add(box(0.055, 0.055, 1.95, i % 2 === 0 ? sm.verdigrisFrame : sm.goldBrass),
        Math.cos(a) * 2.04, 2.68 + Math.sin(a) * 1.74, 2.84, 0, 0, 0, roofG);
    }
    const barrelGeo = new THREE.CylinderGeometry(2.00, 2.00, 1.92, 18, 1, true, -PI * 0.5, PI);
    barrelGeo.rotateZ(PI * 0.5);
    barrelGeo.rotateY(PI * 0.5);
    barrelGeo.scale(1.0, 0.86, 1.0);
    const bGlass = add(new THREE.Mesh(barrelGeo, sm.conservatoryGlass), 0, 2.68, 2.84, 0, 0, 0, roofG);
    bGlass.castShadow = false;
  }

  // B. Left & Right Curved Quarter-Barrel Side-Wing Glass Roofs (`roofG`)
  const addCurvedWingRoof = (nodes, innerScaleX = 0.54, innerScaleZ = 0.66, yEave = 2.58, yTop = 3.44) => {
    for (let i = 0; i < nodes.length; i++) {
      const [ox, oz] = nodes[i];
      const ix = ox * innerScaleX;
      const iz = oz * innerScaleZ;
      const mx = (ox + ix) * 0.5 + (ox > 0 ? 0.22 : -0.22);
      const mz = (oz + iz) * 0.5 + (oz > 0 ? 0.18 : -0.18);
      tubeBetween([
        [ox, yEave, oz],
        [mx, yEave + (yTop - yEave) * 0.72, mz],
        [ix, yTop, iz],
      ], 0.050, sm.verdigrisFrame, 10, 6, roofG);

      if (i < nodes.length - 1) {
        const [ox2, oz2] = nodes[i + 1];
        const ix2 = ox2 * innerScaleX;
        const iz2 = oz2 * innerScaleZ;
        const mx2 = (ox2 + ix2) * 0.5 + (ox2 > 0 ? 0.22 : -0.22);
        const mz2 = (oz2 + iz2) * 0.5 + (oz2 > 0 ? 0.18 : -0.18);

        tubeBetween([[mx, yEave + (yTop - yEave) * 0.70, mz], [mx2, yEave + (yTop - yEave) * 0.70, mz2]],
          0.030, sm.goldBrass, 6, 5, roofG);

        const gPos = new Float32Array([
          ox, yEave, oz, ox2, yEave, oz2, mx, yEave + (yTop - yEave) * 0.72, mz,
          ox2, yEave, oz2, mx2, yEave + (yTop - yEave) * 0.72, mz2, mx, yEave + (yTop - yEave) * 0.72, mz,
          mx, yEave + (yTop - yEave) * 0.72, mz, mx2, yEave + (yTop - yEave) * 0.72, mz2, ix, yTop, iz,
          mx2, yEave + (yTop - yEave) * 0.72, mz2, ix2, yTop, iz2, ix, yTop, iz,
        ]);
        const wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
        wg.computeVertexNormals();
        applyPlanarUVs(wg, 0.4);
        const wm = add(new THREE.Mesh(wg, sm.conservatoryGlass), 0, 0, 0, 0, 0, 0, roofG);
        wm.castShadow = false;
      }
    }
  };
  addCurvedWingRoof(leftWingNodes.slice(0, 8), 0.54, 0.66, 2.58, 3.44);
  // Extend right wing glass roof smoothly to z = -0.35 so front-right exterior reads as a seamless glass conservatory!
  addCurvedWingRoof([...rightFrontNodes, [4.90, -0.35]], 0.54, 0.66, 2.58, 3.44);

  // C. Rear-Right Stone Barrel-Arch Vault Roof over `botanist_potting` (recessed behind right wing in roofG!)
  {
    const vx = 3.02;
    const vz = -2.08;
    const vLen = 3.48;
    const vRad = 1.84;
    const vY0 = 2.94;

    const vaultInner = new THREE.CylinderGeometry(vRad - 0.12, vRad - 0.12, vLen, 14, 1, true, -PI * 0.42, PI * 0.84);
    vaultInner.rotateZ(PI * 0.5);
    vaultInner.rotateY(PI * 0.5);
    vaultInner.scale(1.0, 0.52, 1.0);
    add(new THREE.Mesh(vaultInner, sm.oakTimber), vx, vY0, vz, 0, 0, 0, roofG);

    const vaultOuter = new THREE.CylinderGeometry(vRad + 0.08, vRad + 0.08, vLen + 0.12, 14, 1, true, -PI * 0.44, PI * 0.88);
    vaultOuter.rotateZ(PI * 0.5);
    vaultOuter.rotateY(PI * 0.5);
    vaultOuter.scale(1.0, 0.54, 1.0);
    add(new THREE.Mesh(vaultOuter, sm.travertine), vx, vY0, vz, 0, 0, 0, roofG);

    const archG = buildStoneArch(THREE, K, {
      cx: vx, cy: vY0 - 0.10, cz: -3.76,
      radius: 1.76, thickness: 0.28, depth: 0.34, segments: 11, rotY: 0,
      keystoneGlow: false, parent: roofG, batchPrefix: 'rf_arch',
    });
    archG.scale.y = 0.58;
  }

  // D. Central High Vaulted Bronze & Verdigris Glass Atrium Dome + Ribbed Cupola Crown (`y = 3.38 .. 6.28m`)
  {
    const dZ = -0.15;
    const rx0 = 2.82;
    const rz0 = 3.38;
    const rxTop = 1.24;
    const rzTop = 1.24;
    const yBase = 3.42;
    const yTop = 5.02;

    const nSeg = 24;
    for (let i = 0; i < nSeg; i++) {
      const a0 = (i / nSeg) * TAU;
      const a1 = ((i + 1) / nSeg) * TAU;
      const x0 = Math.sin(a0) * rx0;
      const z0 = dZ + Math.cos(a0) * rz0;
      const x1 = Math.sin(a1) * rx0;
      const z1 = dZ + Math.cos(a1) * rz0;
      const mx = (x0 + x1) * 0.5;
      const mz = (z0 + z1) * 0.5;
      const w = Math.hypot(x1 - x0, z1 - z0);
      const ry = Math.atan2(x1 - x0, z1 - z0) - PI * 0.5;

      add(box(w + 0.04, 0.072, 0.14, sm.verdigrisFrame), mx, yBase - 0.12, mz, 0, ry, 0, roofG);
      add(box(w + 0.04, 0.072, 0.14, sm.verdigrisFrame), mx, yBase + 0.15, mz, 0, ry, 0, roofG);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.020, 5, 10), sm.goldBrass), mx, yBase + 0.015, mz, 0, ry, 0, roofG);
    }

    const nRibs = 14;
    const nRings = 5;
    const ringProf = (t) => {
      const ease = Math.sin(t * PI * 0.5);
      const rx = rx0 + (rxTop - rx0) * Math.pow(t, 0.85) + Math.sin(t * PI) * 0.24;
      const rz = rz0 + (rzTop - rz0) * Math.pow(t, 0.85) + Math.sin(t * PI) * 0.24;
      const y = yBase + 0.15 + ease * (yTop - yBase - 0.15);
      return { rx, rz, y };
    };

    for (let r = 0; r < nRibs; r++) {
      const a = (r / nRibs) * TAU;
      const pts = [];
      for (let k = 0; k <= nRings; k++) {
        const { rx, rz, y } = ringProf(k / nRings);
        pts.push([Math.sin(a) * rx, y, dZ + Math.cos(a) * rz]);
      }
      tubeBetween(pts, 0.058, r % 2 === 0 ? sm.verdigrisFrame : sm.goldBrass, 14, 6, roofG);
    }

    for (const tf of [0.34, 0.68, 1.0]) {
      const { rx, rz, y } = ringProf(tf);
      const pPts = [];
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * TAU;
        pPts.push([Math.sin(a) * rx, y, dZ + Math.cos(a) * rz]);
      }
      tubeBetween(pPts, tf === 1.0 ? 0.072 : 0.036, sm.goldBrass, 28, 6, roofG);
    }

    const dVerts = [];
    for (let k = 0; k < nRings; k++) {
      const p0 = ringProf(k / nRings);
      const p1 = ringProf((k + 1) / nRings);
      for (let r = 0; r < nRibs; r++) {
        const a0 = (r / nRibs) * TAU;
        const a1 = ((r + 1) / nRibs) * TAU;
        const v00 = [Math.sin(a0) * (p0.rx - 0.03), p0.y, dZ + Math.cos(a0) * (p0.rz - 0.03)];
        const v10 = [Math.sin(a1) * (p0.rx - 0.03), p0.y, dZ + Math.cos(a1) * (p0.rz - 0.03)];
        const v01 = [Math.sin(a0) * (p1.rx - 0.03), p1.y, dZ + Math.cos(a0) * (p1.rz - 0.03)];
        const v11 = [Math.sin(a1) * (p1.rx - 0.03), p1.y, dZ + Math.cos(a1) * (p1.rz - 0.03)];
        dVerts.push(...v00, ...v10, ...v01, ...v10, ...v11, ...v01);
      }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dVerts), 3));
    dg.computeVertexNormals();
    applyPlanarUVs(dg, 0.35);
    const dm = add(new THREE.Mesh(dg, sm.conservatoryGlass), 0, 0, 0, 0, 0, 0, roofG);
    dm.castShadow = false;

    // Proportional Glowing Sky-Orchids Blooming on the Upper Front-Right Glass Dome Slope (ext_02.png!)
    addHeroOrchidBloom({
      x: 0.62, y: 4.35, z: 1.92, scale: 0.86, rotY: 0.22, tiltX: 0.55,
      petalMat: orchidLavender, withLeaves: true, P: roofG,
    });
    addHeroOrchidBloom({
      x: 1.28, y: 4.02, z: 2.18, scale: 0.98, rotY: 0.44, tiltX: 0.52,
      petalMat: orchidBlueViolet, withLeaves: true, P: roofG,
    });
    addHeroOrchidBloom({
      x: 1.84, y: 3.68, z: 2.08, scale: 0.72, rotY: 0.62, tiltX: 0.48,
      petalMat: orchidPeriwinkle, withLeaves: true, P: roofG,
    });

    // Delicate Ribbed Central Cupola Crown + Golden Spire Finial (`y = 5.02 .. 6.32m` — fully visible in frame!)
    const cupY0 = 5.02;
    const cupR = 1.22;
    const cupH = 0.78;

    const collar = new THREE.TorusGeometry(cupR + 0.04, 0.062, 8, 24);
    collar.rotateX(PI * 0.5);
    add(new THREE.Mesh(collar, sm.verdigrisFrame), 0, cupY0, dZ, 0, 0, 0, roofG);

    const cupGlassGeo = new THREE.SphereGeometry(cupR - 0.03, 18, 10, 0, TAU, 0, PI * 0.48);
    cupGlassGeo.scale(1, cupH / cupR, 1);
    const cgMesh = add(new THREE.Mesh(cupGlassGeo, sm.conservatoryGlass), 0, cupY0, dZ, 0, 0, 0, roofG);
    cgMesh.castShadow = false;

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const cPts = [];
      for (let s = 0; s <= 5; s++) {
        const phi = (s / 5) * (PI * 0.48);
        cPts.push([
          Math.sin(a) * Math.sin(PI * 0.5 - phi) * cupR,
          cupY0 + Math.cos(PI * 0.5 - phi) * cupH,
          dZ + Math.cos(a) * Math.sin(PI * 0.5 - phi) * cupR,
        ]);
      }
      tubeBetween(cPts, 0.040, sm.goldBrass, 8, 5, roofG);
    }
    const midRing = new THREE.TorusGeometry(cupR * 0.78, 0.028, 6, 20);
    midRing.rotateX(PI * 0.5);
    add(new THREE.Mesh(midRing, sm.goldBrass), 0, cupY0 + cupH * 0.55, dZ, 0, 0, 0, roofG);

    const finY = cupY0 + cupH;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.12, 10), sm.verdigrisFrame), 0, finY + 0.03, dZ, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), sm.goldBrass), 0, finY + 0.15, dZ, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.46, 8), sm.goldBrass), 0, finY + 0.42, dZ, 0, 0, 0, roofG);
  }

  // F. Upper Sunlit Tree Limbs, Foliage Canopies & Roof Wisteria (`roofG`)
  addSunlitRoot([[4.35, 3.22, 0.72], [4.02, 3.88, 0.45], [3.42, 4.38, -0.15]], 0.24, 0.12, 12, true, roofG);
  addSunlitRoot([[4.68, 3.15, 0.25], [4.55, 3.92, -0.55], [3.85, 4.48, -1.25]], 0.20, 0.10, 10, true, roofG);
  addSunlitRoot([[-2.18, 2.52, -2.98], [-2.55, 3.95, -2.95], [-2.05, 4.75, -2.35]], 0.22, 0.10, 10, false, roofG);

  buildFoliageCanopyCluster(THREE, K, {
    cx: 4.05, cy: 4.18, cz: 0.45, rx: 1.55, ry: 0.95, rz: 1.45, puffs: 24,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'cons_fol',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: 3.15, cy: 4.62, cz: -1.45, rx: 1.45, ry: 0.88, rz: 1.35, puffs: 20,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'cons_fol',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: -3.65, cy: 4.05, cz: 0.25, rx: 1.45, ry: 0.86, rz: 1.28, puffs: 18,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'cons_fol',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: -1.85, cy: 4.82, cz: -2.25, rx: 1.42, ry: 0.85, rz: 1.22, puffs: 18,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'cons_fol',
  });

  buildWisteriaRacemes(THREE, K, {
    cx: 1.35, yTop: 3.56, cz: 1.72, spanX: 1.15, spanZ: 0.35, strands: 7, maxLen: 0.92,
    parent: roofG, batchPrefix: 'cons_wist',
  });

  // ==========================================================================
  // 9. REQUIRED `root.userData` (FOOTPRINT, 2 ROOMS, DOORS & 10 PROP SLOTS)
  // ==========================================================================
  root.userData.footprint = { w: 10.2, d: 8.2 };
  root.userData.footprintBox = { w: 10.2, d: 8.2 };
  root.userData.rooms = [
    { name: 'orchid_stream', x: -1.79, z: -0.10, w: 5.88, d: 7.05, walkX: 0.15, walkZ: 1.15 },    // x ∈ [-4.73, 1.15]
    { name: 'botanist_potting', x: 2.95, z: -0.10, w: 3.60, d: 7.05, walkX: 2.35, walkZ: 0.35 }, // x ∈ [1.15, 4.75]
  ];
  root.userData.door = { x: 0, z: 5.05 };
  root.userData.doorIn = { x: 0, z: 2.8 };
  root.userData.innerDoors = [{ x: 1.15, z: 0.2 }];

  root.userData.propSlots = [
    // Left Room (`orchid_stream` — 5 slots on flat walkable banks away from waterfall & doors)
    { id: 'sr_cloud_planter', x: -3.52, y: FL, z: 1.92, rot: 0.42 },
    { id: 'sr_crystal_lantern', x: -2.85, y: FL, z: 2.65, rot: -0.35 },
    { id: 'sr_cloud_planter', x: -3.65, y: FL, z: -1.35, rot: 1.05 },
    { id: 'sr_levitation_urn', x: 0.36, y: FL, z: -2.25, rot: -0.52 },
    { id: 'sr_crystal_lantern', x: -0.92, y: FL, z: 2.55, rot: 0.78 },
    // Right Room (`botanist_potting` — 5 slots across open flagstone floor away from L-bench & inner door)
    { id: 'sr_specimen_crate', x: 2.08, y: FL, z: -2.18, rot: 0.26 },
    { id: 'sr_levitation_urn', x: 2.95, y: FL, z: -1.85, rot: -0.44 },
    { id: 'sr_specimen_crate', x: 3.08, y: FL, z: 0.96, rot: 2.18 },
    { id: 'sr_cloud_planter', x: 2.75, y: FL, z: 2.22, rot: -2.20 },
    { id: 'sr_crystal_lantern', x: 1.88, y: FL, z: 2.28, rot: 0.62 },
  ];

  K.finalize();

  // Merge all transparent glass panes & same-material ground slabs to keep draw calls <= 55!
  if (opts.merge !== false) {
    mergeTransparentGlass(THREE, roofG, sm.conservatoryGlass, 'roof_glass_merged');
    mergeTransparentGlass(THREE, root, glassWallMat, 'root_glass_merged');

    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const gBuckets = new Map();
    for (const c of [...root.children]) {
      if (!c.isMesh || c.isInstancedMesh || !c.userData.ground || Array.isArray(c.material)) continue;
      if (!gBuckets.has(c.material)) gBuckets.set(c.material, []);
      gBuckets.get(c.material).push(c);
    }
    for (const [mat, arr] of gBuckets) {
      if (arr.length < 2) continue;
      const geos = arr.map((m) => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
        root.remove(m);
        m.geometry.dispose();
        return g;
      });
      const gm = new THREE.Mesh(mergeGeometries(geos, false), mat);
      geos.forEach((g) => g.dispose());
      gm.castShadow = true;
      gm.receiveShadow = true;
      gm.userData.ground = true;
      gm.userData.keep = true;
      gm.name = 'ground_merged';
      root.add(gm);
    }
  }

  // Guarantee 100% metalness: 0 on every single material (scene.environment is null!)
  root.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { m.metalness = 0; });
    }
  });

  return root;
}
