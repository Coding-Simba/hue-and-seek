// ============================================================================
// Celestia Sky-Ruins (Celestia) — 7 Signature Sky-Island Landmarks
// (maps/skyruins/buildings/landmarks.js)
// Handcrafted 1:1 from Panel 6 Codex references (ext_06.png, int_06.png & overview.png):
//   1. buildCrystalFountain      — Stepped Compass-Rose Water Basin, 8 Cyan Pedestal
//                                  Lanterns, 2 Spillways, Giant Skyglass Crystal & 3 Rune Rings
//   2. buildOrnithopterPier          — Cross-Braced Timber & Brass Sky-Dock, Pirate Banners,
//                                  Canvas Dock Awning & Moored Dragonfly-Wing Ornithopter
//   3. buildSkyStall             — Carved Stone & Timber Bazaar Pavilion w/ Catenary Awning,
//                                  Glowing Cyan Globes, Carpets, Pottery & Brass Lanterns
//   4. buildRootBridge           — Giant Walkable Gnarled Celestian Tree-Root Bridge w/ Mossy
//                                  Treads, Sky-Orchids, Fairy-Lanterns & Side Cling Root
//   5. buildUpdraftGeyser        — Octagonal Mossy Travertine Rune Plinth, Cyan-Gold Core &
//                                  3 Helical 3.2m Sky-Wind Ribbons (windSwirl) + Leaf Motes
//   6. buildOrbitingRunePlatform — Rideable Floating Mossy Celestian Rune-Stone Platform
//   7. buildFloatingIslet        — Scenic Satellite Floating Rock Islet w/ Storybook Tree,
//                                  Glowing Cyan Rune Crystal & Mini Waterfall
// ALL materials strictly use metalness: 0 for luminous Storybook colors!
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
  buildGnarledRootTube,
  buildFoliageCanopyCluster,
  buildWisteriaRacemes,
  buildSkyOrchidCluster,
  TRAVERTINE_PAL,
  CLIFF_ROCK_PAL,
  MOSS_PAL,
  FOLIAGE_SUN_PAL,
  WILDFLOWER_PAL,
} from '../sky_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

let _lmTexCache = null;
function getSkyLandmarkTextures(THREE) {
  if (_lmTexCache && _lmTexCache._T === THREE) return _lmTexCache;

  // 1. Golden-Sandstone & Glowing Cyan Spiral Celestian Rune-Ring Band (matches ext_06.png rings 1:1!)
  const goldRuneBand = paintedCanvasTex(THREE, 'sr_lm_gold_rune_ring_v2', 512, (ctx, s, rng) => {
    ctx.fillStyle = '#efc562';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 180, ['#f9d87e', '#dfa944', '#f4cb68'], 4, 12, 0.32);

    // Top & bottom carved golden bevel borders
    ctx.fillStyle = '#b98224';
    ctx.fillRect(0, 0, s, 44);
    ctx.fillRect(0, s - 44, s, 44);
    ctx.fillStyle = '#ffea9c';
    ctx.fillRect(0, 44, s, 14);
    ctx.fillRect(0, s - 58, s, 14);

    // Recessed turquoise-slate channel with glowing cyan Celestian spiral runes!
    ctx.fillStyle = '#1b6e8e';
    ctx.fillRect(0, 88, s, s - 176);

    const cells = 8, cw = s / cells, cy = s * 0.5;
    for (let i = 0; i < cells; i++) {
      const cx = (i + 0.5) * cw;
      // Golden divider bar between rune medallions
      ctx.fillStyle = '#ecc058';
      ctx.fillRect(i * cw - 4, 84, 8, s - 168);

      // Glowing cyan circular rune medallion + inner spiral dot
      ctx.strokeStyle = '#6cf8ff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, cw * 0.30, 0, PI * 1.72);
      ctx.stroke();

      ctx.strokeStyle = '#e8ffff';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cw * 0.30, 0.15, PI * 1.55);
      ctx.stroke();

      ctx.fillStyle = '#d8ffff';
      ctx.beginPath();
      ctx.arc(cx, cy, cw * 0.11, 0, TAU);
      ctx.fill();
    }
  }, 4, 1);

  // 2. Woven patterned Celestian bazaar carpet texture (crimson, saffron-gold & cobalt)
  const bazaarCarpet = paintedCanvasTex(THREE, 'sr_lm_bazaar_carpet_v2', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#b84434';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 140, ['#cc5442', '#9a3528', '#d86650'], 3, 8, 0.30);
    ctx.strokeStyle = '#f6c85c';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, s - 28, s - 28);
    ctx.strokeStyle = '#28589c';
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, s - 56, s - 56);
    ctx.fillStyle = '#f8cf68';
    ctx.beginPath();
    ctx.moveTo(s * 0.5, 48);
    ctx.lineTo(s - 48, s * 0.5);
    ctx.lineTo(s * 0.5, s - 48);
    ctx.lineTo(48, s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2d68b2';
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, 32, 0, TAU);
    ctx.fill();
  }, 1, 1);

  // 3. Glowing cyan-gold spiral wind core texture for Updraft Geysers
  const windCoreTex = paintedCanvasTex(THREE, 'sr_lm_wind_core_v2', 256, (ctx, s) => {
    const c = s * 0.5;
    const grd = ctx.createRadialGradient(c, c, 6, c, c, c);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.35, '#7cfaff');
    grd.addColorStop(0.72, '#22b8e8');
    grd.addColorStop(1, '#166e96');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = '#ffe694';
    ctx.lineWidth = 5.5;
    for (let arm = 0; arm < 4; arm++) {
      const a0 = (arm / 4) * TAU;
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const a = a0 + t * PI * 1.85;
        const r = t * c * 0.88;
        const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }, 1, 1);

  _lmTexCache = { _T: THREE, goldRuneBand, bazaarCarpet, windCoreTex };
  return _lmTexCache;
}

// Shared Storybook Sunlit Gold, Bronze & Copper Materials (metalness: 0, neutral white grain!)
function makeGoldMats(THREE, K) {
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
  const blueCloth = K.M(0x2856a2, null, {
    roughness: 0.76,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  return { sunGold, amberBronze, warmCopper, blueCloth };
}

// Helper: Pointed Royal-Blue Sky-Pirate Winged Banner (sm.pirateBanner)
function addPirateWingBanner(THREE, K, sm, gm, x, yTop, z, rotY = 0, scale = 1.0, parent = K.root) {
  const { add, rbox } = K;
  const { sunGold, blueCloth } = gm;
  const g = new THREE.Group();
  g.position.set(x, yTop, z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);
  parent.add(g);

  const bW = 0.72, bH = 0.84, tipH = 0.28;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, bW + 0.20, 7), sunGold),
    0, 0, 0, 0, 0, PI * 0.5, g);
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.042, 7, 5), sunGold), sx * (bW * 0.5 + 0.11), 0, 0, 0, 0, 0, g);
  }
  add(new THREE.Mesh(new THREE.PlaneGeometry(bW, bH), sm.pirateBanner), 0, -bH * 0.5 - 0.02, 0.01, 0, 0, 0, g);

  const tailShape = new THREE.Shape();
  tailShape.moveTo(-bW * 0.5, 0);
  tailShape.lineTo(bW * 0.5, 0);
  tailShape.lineTo(0, -tipH);
  tailShape.closePath();
  add(new THREE.Mesh(new THREE.ShapeGeometry(tailShape), blueCloth), 0, -bH - 0.02, 0.01, 0, 0, 0, g);

  for (const sx of [-1, 1]) {
    add(rbox(0.035, bH, 0.018, 0.006, sunGold, 1), sx * (bW * 0.5 - 0.018), -bH * 0.5 - 0.02, 0.014, 0, 0, 0, g);
    const dLen = Math.hypot(bW * 0.5, tipH);
    const dAng = Math.atan2(bW * 0.5, tipH);
    add(rbox(0.036, dLen, 0.018, 0.006, sunGold, 1), sx * (bW * 0.25), -bH - tipH * 0.5 - 0.02, 0.015, 0, 0, sx * dAng, g);
  }
  add(new THREE.Mesh(new THREE.SphereGeometry(0.036, 7, 5), sunGold), 0, -bH - tipH - 0.03, 0.015, 0, 0, 0, g);
  return g;
}

// Helper: Concave Catenary 4-Corner Tent Canopy Geometry (Sky-Stall & Dock Awning!)
function buildCatenaryCanopyGeo(THREE, spanX, spanZ, peakH, sag = 0.20, segs = 12) {
  const geo = new THREE.PlaneGeometry(spanX, spanZ, segs, segs);
  geo.rotateX(-PI * 0.5);
  const pos = geo.attributes.position;
  const hx = spanX * 0.5, hz = spanZ * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const ux = Math.abs(x) / hx;
    const uz = Math.abs(z) / hz;
    const radial = Math.min(1.42, Math.hypot(ux, uz));
    const peakTerm = Math.pow(Math.max(0, 1 - radial / 1.06), 1.65) * peakH;
    const edgeDroop = (1 - Math.max(ux, uz)) * -0.03 + Math.sin((1 - ux) * PI) * Math.sin((1 - uz) * PI) * sag * 0.32;
    const rimSag = (ux > 0.92 || uz > 0.92) ? -Math.sin((1 - Math.min(ux, uz)) * PI * 0.5) * sag * 0.40 : 0;
    pos.setY(i, peakTerm + edgeDroop + rimSag);
  }
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// 1. CENTRAL CRYSTAL FOUNTAIN (`buildCrystalFountain` / `crystalObelisk`)
// Matching ext_06.png & overview.png center!
// ============================================================================
export function buildCrystalFountain(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'crystal_fountain', 61);
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const { root, add, rbox, boxCol, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const LT = getSkyLandmarkTextures(THREE);
  const gm = makeGoldMats(THREE, K);
  const { sunGold, amberBronze } = gm;
  const garden = opts.garden !== false;

  const goldRuneRingMat = K.M(0xffffff, LT.goldRuneBand, {
    roughness: 0.42,
    metalness: 0,
    emissive: new THREE.Color(0x28b8e2),
    emissiveIntensity: 0.34,
  });

  const R_POOL = 5.35;
  const R_OUTER = 6.20;
  const Y_FLOOR = garden ? 0.04 : -0.12;

  // 1. Sunken 16-Point Turquoise, Cream & Gold Compass-Rose Mosaic Floor (walkable!)
  {
    const mosaicFloor = new THREE.Mesh(new THREE.CylinderGeometry(R_POOL + 0.15, R_POOL + 0.15, 0.10, 48), sm.compassMosaic);
    add(mosaicFloor, 0, Y_FLOOR - 0.04, 0, 0, 0, 0, root);
    mosaicFloor.userData.ground = true;

    if (garden) {
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x3ed4ee,
        emissive: new THREE.Color(0x148eb8),
        emissiveIntensity: 0.28,
        roughness: 0.18,
        metalness: 0,
        transparent: true,
        opacity: 0.40,
        depthWrite: false,
      });
      const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(R_POOL, R_POOL, 0.02, 48), waterMat);
      add(waterDisc, 0, Y_FLOOR + 0.05, 0, 0, 0, 0, root);
    }

    // Raised 3D Sunlit-Gold Compass Rings & 8 Star Rays + Central Glowing Cyan Vortex Socket!
    for (const [r, tubeR] of [[4.65, 0.036], [3.35, 0.034], [1.85, 0.038], [0.95, 0.050]]) {
      const tr = new THREE.TorusGeometry(r, tubeR, 6, 36);
      tr.rotateX(PI * 0.5);
      add(new THREE.Mesh(tr, sunGold), 0, Y_FLOOR + 0.03, 0, 0, 0, 0, root);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const rayLen = i % 2 === 0 ? 1.88 : 1.28;
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.19, rayLen, 4), sunGold);
      add(ray, Math.sin(a) * (0.85 + rayLen * 0.5), Y_FLOOR + 0.02, Math.cos(a) * (0.85 + rayLen * 0.5),
        PI * 0.5, 0, -a, root);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.04, 0.24, 16), sm.travertinePlain), 0, Y_FLOOR + 0.11, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.27, 16), sm.cyanCrystal), 0, Y_FLOOR + 0.12, 0, 0, 0, 0, root);
    boxCol(0, 0, 1.35, 1.35);
  }

  // 2. 12 Floating White Lotus Water-Lilies & Notched Green Lily Pads around the Pool! (ext_06.png!)
  {
    const padGeo = () => sharedSkyGeo(THREE, 'sr_lily_pad', () => new THREE.CylinderGeometry(0.34, 0.34, 0.018, 12, 1, false, 0.25, TAU - 0.5));
    const petalGeo = () => sharedSkyGeo(THREE, 'sr_lotus_petal2', () => {
      const g = new THREE.SphereGeometry(0.11, 7, 5);
      g.scale(0.58, 0.30, 1.45);
      return g;
    });
    const yLily = garden ? Y_FLOOR + 0.068 : -0.035;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.18;
      if (Math.abs(Math.sin(a * 2)) < 0.20) continue;
      const r = 3.85 + (i % 3) * 0.42;
      const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
      pushInst('cf_pad', padGeo, sm.foliageInst, lx, yLily, lz, 0, jr(0, TAU), 0, jr(1.0, 1.4), 1, jr(1.0, 1.4), pick(MOSS_PAL), root);
      if (i % 2 === 0 || i === 3) {
        for (let p = 0; p < 8; p++) {
          const pa = (p / 8) * TAU;
          pushInst('cf_lotus', petalGeo, sm.foliageInst,
            lx + Math.sin(pa) * 0.11, yLily + 0.04, lz + Math.cos(pa) * 0.11,
            -0.28, pa, 0, 1.05, 1.05, 1.05, p % 2 === 0 ? 0xffffff : 0xfff5e8, root);
        }
        pushInst('cf_lotus', petalGeo, sm.foliageInst, lx, yLily + 0.068, lz, 0, 0, 0, 0.72, 1.35, 0.72, 0xffd24c, root);
      }
    }
  }

  // 3. Stepped Circular Cream-Travertine Parapet Rim, 4 Wide Stair Approaches,
  //    8 Glowing Cyan Crystal Lantern Pedestals & 2 Side Stone Waterfall Spillways!
  {
    const curbGeo = () => sharedSkyGeo(THREE, 'sr_cf_curb', () => new RoundedBoxGeometry(0.84, 0.56, 0.72, 0.05, 1));
    const flwGeo = () => sharedSkyGeo(THREE, 'sr_cf_flw', () => new THREE.DodecahedronGeometry(0.10, 0));

    const stairAngles = [0, PI, PI * 0.30, -PI * 0.30];
    const isNearAngle = (ang, target, tol) => {
      const d = ((ang - target + PI * 3) % TAU) - PI;
      return Math.abs(d) < tol;
    };

    const segs = 40;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU;
      const onStair = stairAngles.some((sa) => isNearAngle(a, sa, 0.17));
      if (onStair) continue;
      const onSpillway = isNearAngle(a, PI * 0.5, 0.11) || isNearAngle(a, -PI * 0.5, 0.11);
      const bx = Math.sin(a) * 5.76;
      const bz = Math.cos(a) * 5.76;
      const hScale = onSpillway ? 0.58 : 1.0;

      pushInst('cf_rim_blk', curbGeo, sm.stoneInst,
        bx, Y_FLOOR + 0.26 * hScale, bz, 0, a, 0,
        1.12, hScale, 1.05, pick(TRAVERTINE_PAL), root);

      if (!onSpillway && i % 2 === 0) {
        const mx = Math.sin(a) * 6.18, mz = Math.cos(a) * 6.18;
        pushInst('cf_rim_moss', flwGeo, sm.foliageInst,
          mx, Y_FLOOR + 0.20, mz, 0, jr(0, TAU), 0, 2.2, 0.9, 2.2, pick(MOSS_PAL), root);
        pushInst('cf_rim_flw', flwGeo, sm.foliageInst,
          mx + jr(-0.08, 0.08), Y_FLOOR + 0.34, mz + jr(-0.08, 0.08),
          jr(0, TAU), jr(0, TAU), 0, 1.05, 0.95, 1.05, i % 4 === 0 ? 0xfffcf0 : pick(WILDFLOWER_PAL), root);
      }
    }

    for (const sa of stairAngles) {
      for (let s = 0; s < 3; s++) {
        const rad = 5.42 + s * 0.42;
        const stepH = 0.14 + (2 - s) * 0.08;
        const stepM = add(rbox(2.15, stepH, 0.48, 0.03, sm.travertinePlain, 1),
          Math.sin(sa) * rad, Y_FLOOR + stepH * 0.5, Math.cos(sa) * rad, 0, sa, 0, root);
        stepM.userData.ground = true;
      }
    }

    // 8 Perimeter Carved Stone Pedestals with Sunlit-Gold & Glowing Cyan Crystal Dome Lanterns (ext_06.png!)
    const pedAngles = [
      0.21, -0.21,
      PI - 0.21, -PI + 0.21,
      PI * 0.5 + 0.24, PI * 0.5 - 0.24,
      -PI * 0.5 + 0.24, -PI * 0.5 - 0.24,
    ];
    const cryGeo = sharedSkyGeo(THREE, 'sr_cf_ped_cry', () => {
      const o = new THREE.OctahedronGeometry(0.19, 0);
      o.scale(0.95, 1.55, 0.95);
      return o;
    });
    for (const pa of pedAngles) {
      const px = Math.sin(pa) * 5.82;
      const pz = Math.cos(pa) * 5.82;
      const pg = new THREE.Group();
      pg.position.set(px, Y_FLOOR, pz);
      pg.rotation.y = pa;
      root.add(pg);

      add(rbox(0.84, 0.20, 0.84, 0.03, sm.travertineDark, 1), 0, 0.10, 0, 0, 0, 0, pg);
      add(rbox(0.68, 0.66, 0.68, 0.03, sm.travertinePlain, 1), 0, 0.52, 0, 0, 0, 0, pg);
      add(rbox(0.28, 0.36, 0.72, 0.02, sunGold, 1), 0, 0.52, 0, 0, 0, 0, pg);
      add(rbox(0.18, 0.26, 0.75, 0.02, sm.cyanSoft, 1), 0, 0.52, 0, 0, 0, 0, pg);
      add(rbox(0.78, 0.12, 0.78, 0.03, sm.travertineWarm, 1), 0, 0.90, 0, 0, 0, 0, pg);

      add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.09, 10), sunGold), 0, 1.00, 0, 0, 0, 0, pg);
      add(new THREE.Mesh(cryGeo, sm.cyanCrystal), 0, 1.28, 0, 0, PI * 0.25, 0, pg);
      for (let k = 0; k < 4; k++) {
        const ka = (k / 4) * TAU + PI * 0.25;
        add(rbox(0.04, 0.44, 0.04, 0.01, amberBronze, 1),
          Math.sin(ka) * 0.20, 1.27, Math.cos(ka) * 0.20, 0, ka, 0, pg);
      }
      add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.20, 8), sunGold), 0, 1.56, 0, 0, 0, 0, pg);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), sunGold), 0, 1.69, 0, 0, 0, 0, pg);

      boxCol(px, pz, 0.74, 0.74);
    }

    // 2 Side Carved Stone Waterfall Spillways (West & East) pouring into the Lotus Pool!
    for (const sx of [-1, 1]) {
      const sg = new THREE.Group();
      sg.position.set(sx * 5.62, Y_FLOOR, 0);
      sg.rotation.y = sx > 0 ? -PI * 0.5 : PI * 0.5;
      root.add(sg);

      add(rbox(1.42, 0.62, 1.10, 0.04, sm.travertinePlain, 1), 0, 0.31, -0.18, 0, 0, 0, sg);
      for (const cx of [-0.58, 0.58]) {
        add(rbox(0.26, 0.84, 1.18, 0.03, sm.travertineWarm, 1), cx, 0.42, -0.16, 0, 0, 0, sg);
      }
      add(rbox(0.90, 0.08, 0.98, 0.02, sm.waterGlow, 1), 0, 0.64, -0.12, 0, 0, 0, sg);
      add(rbox(0.88, 0.62, 0.14, 0.03, sm.waterGlow, 1), 0, 0.34, 0.42, -0.26, 0, 0, sg);
      for (const fx of [-0.28, 0, 0.28]) {
        add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), sm.travertinePlain),
          fx, 0.09, 0.56, 0, 0, 0, sg);
      }
      boxCol(sx * 5.62, 0, 1.15, 1.35);
    }
  }

  // 4. Standalone Gallery Floating Sky-Island Cliff Belly & Waterfall (kept below y = 0!)
  if (garden) {
    const rockGeo = () => sharedSkyGeo(THREE, 'sr_cf_cliff_rk', () => new THREE.DodecahedronGeometry(0.62, 0));
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(R_OUTER + 0.85, R_OUTER + 0.50, 0.30, 36), sm.mossGreen);
    add(apron, 0, -0.14, 0, 0, 0, 0, root);
    apron.userData.ground = true;

    for (let ring = 0; ring < 4; ring++) {
      const f = 1 - ring * 0.21;
      const yR = -1.28 - ring * 0.82;
      const cnt = 24 - ring * 4;
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU + ring * 0.24;
        pushInst('cf_belly', rockGeo, sm.stoneInst,
          Math.cos(a) * (R_OUTER + 0.4) * f, yR + jr(-0.14, 0.14), Math.sin(a) * (R_OUTER + 0.4) * f,
          jr(-0.3, 0.3), jr(0, TAU), jr(-0.3, 0.3),
          jr(1.5, 2.2) * f, jr(1.2, 1.7), jr(1.5, 2.2) * f, pick(CLIFF_ROCK_PAL), root);
      }
    }
    pushInst('cf_belly', rockGeo, sm.stoneInst, 0, -4.25, 0, 0.2, 0.5, 0, 2.5, 2.8, 2.5, CLIFF_ROCK_PAL[1], root);
    add(rbox(0.95, 3.2, 0.18, 0.04, sm.waterGlow, 1), -4.55, -1.55, 5.25, 0.10, -0.55, 0, root);
    buildWisteriaRacemes(THREE, K, {
      cx: -3.2, yTop: 0.05, cz: 6.25, spanX: 1.6, strands: 7, maxLen: 1.4, parent: root, batchPrefix: 'cf_wist',
    });
  }

  // 5. GIANT FACETED GLOWING CYAN SKYGLASS CRYSTAL (crystalGrp)
  //    + 3 TILTED CARVED GOLDEN-TURQUOISE RUNE RINGS (ring1Grp, ring2Grp, ring3Grp)
  //    + 6 HOVERING MINI CRYSTAL SHARDS!
  const Y_CRYSTAL = 2.95;

  const crystalGrp = new THREE.Group();
  crystalGrp.name = 'crystalGrp';
  crystalGrp.position.set(0, Y_CRYSTAL, 0);
  crystalGrp.userData.keep = true;
  crystalGrp.userData.baseY = Y_CRYSTAL;
  root.add(crystalGrp);

  {
    const outerMain = new THREE.OctahedronGeometry(1, 0);
    outerMain.scale(0.94, 1.98, 0.94);
    add(new THREE.Mesh(outerMain, sm.cyanCrystal), 0, 0, 0, 0, 0, 0, crystalGrp);

    const outerRotated = new THREE.OctahedronGeometry(1, 0);
    outerRotated.rotateY(PI * 0.25);
    outerRotated.scale(0.88, 1.85, 0.88);
    add(new THREE.Mesh(outerRotated, sm.cyanSoft), 0, 0, 0, 0, 0, 0, crystalGrp);

    const heartMat = K.glowMat(0xe8ffff, 0x62f4ff, 1.18, { roughness: 0.14 });
    const innerCore = new THREE.OctahedronGeometry(1, 0);
    innerCore.scale(0.50, 1.28, 0.50);
    add(new THREE.Mesh(innerCore, heartMat), 0, 0, 0, 0, PI * 0.125, 0, crystalGrp);
  }

  // Thick Sculpted 3D Golden-Turquoise Celestian Rune Rings + 6 Hovering Faceted Diamond Shards!
  const makeRuneRing = (name, radius, bandH, rx, ry, rz, shardCount = 2) => {
    const rg = new THREE.Group();
    rg.name = name;
    rg.position.set(0, Y_CRYSTAL, 0);
    rg.rotation.set(rx, ry, rz);
    rg.userData.keep = true;
    root.add(rg);

    const outerCyl = new THREE.CylinderGeometry(radius + 0.08, radius + 0.08, bandH, 36, 1, true);
    add(new THREE.Mesh(outerCyl, goldRuneRingMat), 0, 0, 0, 0, 0, 0, rg);
    const innerCyl = new THREE.CylinderGeometry(radius - 0.08, radius - 0.08, bandH, 36, 1, true);
    innerCyl.scale(-1, 1, 1);
    add(new THREE.Mesh(innerCyl, goldRuneRingMat), 0, 0, 0, 0, 0, 0, rg);

    // Top & bottom sunlit golden cornice rims + 12 carved golden bosses!
    for (const sy of [-1, 1]) {
      const rim = new THREE.TorusGeometry(radius, 0.092, 7, 36);
      rim.rotateX(PI * 0.5);
      add(new THREE.Mesh(rim, sunGold), 0, sy * (bandH * 0.5), 0, 0, 0, 0, rg);
    }
    for (let b = 0; b < 12; b++) {
      const ba = (b / 12) * TAU;
      add(rbox(0.21, bandH + 0.07, 0.21, 0.03, amberBronze, 1),
        Math.sin(ba) * radius, 0, Math.cos(ba) * radius, 0, ba, 0, rg);
    }

    // Hovering Faceted Diamond Shards (6 total across the 3 rings, matching ext_06.png!)
    const miniShardGeo = new THREE.OctahedronGeometry(0.22, 0);
    miniShardGeo.scale(0.82, 1.85, 0.82);
    const miniBandGeo = new THREE.TorusGeometry(0.18, 0.028, 5, 8);
    miniBandGeo.rotateX(PI * 0.5);
    for (let s = 0; s < shardCount; s++) {
      const sa = (s / shardCount) * TAU + ry + 0.65;
      const sx = Math.cos(sa) * (radius * 0.82);
      const sz = Math.sin(sa) * (radius * 0.82);
      const sy = (s % 2 === 0 ? -0.54 : 0.50);
      add(new THREE.Mesh(miniShardGeo, sm.cyanCrystal), sx, sy, sz, 0, sa, 0, rg);
      add(new THREE.Mesh(miniBandGeo, sunGold), sx, sy, sz, 0, sa, 0, rg);
    }
    return rg;
  };

  const ring1Grp = makeRuneRing('ring1Grp', 1.94, 0.28, 0.44, 0.25, -0.32, 2);
  const ring2Grp = makeRuneRing('ring2Grp', 2.28, 0.30, -0.38, 1.15, 0.42, 2);
  const ring3Grp = makeRuneRing('ring3Grp', 2.60, 0.26, 0.18, 2.10, 0.52, 2);

  K.finalize([crystalGrp, ring1Grp, ring2Grp, ring3Grp]);
  Object.assign(root.userData, { crystalGrp, ring1Grp, ring2Grp, ring3Grp });
  return root;
}

// ============================================================================
// 2. SKY-PIRATE ORNITHOPTER PIER (`buildOrnithopterPier`)
// Matching overview.png & int_06.png SE cliff + Moored Dragonfly Ornithopter!
// ============================================================================
export function buildOrnithopterPier(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'ornithopter_pier', 62);
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const { root, add, rbox, boxCol, pushInst } = K;
  const sm = getSkyMats(THREE, K);
  const gm = makeGoldMats(THREE, K);
  const { sunGold, amberBronze, warmCopper } = gm;

  const W = 4.8;
  const L = 8.4;
  const Y_DECK = 0.05;

  // 1. Walkable Timber Deck Slab + 3D Individual Bevelled Oak Planks (width = 4.8m, length = 8.4m)
  {
    const baseWalk = add(rbox(W, 0.12, L, 0.02, sm.darkTimber, 1), 0, Y_DECK - 0.07, 0, 0, 0, 0, root);
    baseWalk.userData.ground = true;

    const plankGeo = () => sharedSkyGeo(THREE, 'sr_pier_plank', () => new RoundedBoxGeometry(1, 0.055, 0.34, 0.015, 1));
    const plankCols = [0xd49a5a, 0xc68a4c, 0xdfa868, 0xbc7e42, 0xd19556];
    const nRows = 23;
    for (let r = 0; r < nRows; r++) {
      const pz = -L * 0.5 + (r + 0.5) * (L / nRows);
      const split = (r % 2 === 0) ? -0.45 : 0.45;
      const wL = (W * 0.5 + split) - 0.04;
      const wR = (W * 0.5 - split) - 0.04;
      pushInst('pier_plk', plankGeo, sm.stoneInst,
        -W * 0.5 + wL * 0.5 + 0.02, Y_DECK - 0.022, pz, 0, 0, 0, wL, 1, 1, plankCols[r % plankCols.length], root);
      pushInst('pier_plk', plankGeo, sm.stoneInst,
        split + wR * 0.5 + 0.02, Y_DECK - 0.022, pz, 0, 0, 0, wR, 1, 1, plankCols[(r + 2) % plankCols.length], root);
    }
    const threshold = add(rbox(W + 0.36, 0.16, 0.58, 0.03, sm.travertinePlain, 1), 0, Y_DECK - 0.06, -L * 0.5 + 0.15, 0, 0, 0, root);
    threshold.userData.ground = true;
  }

  // 2. Heavy Edge Stringer Beams, Sunlit-Brass End-Rosettes & 8 Tall Cross-Braced Trestle Pilings!
  {
    for (const sx of [-1, 1]) {
      add(rbox(0.26, 0.30, L + 0.24, 0.03, sm.darkTimber, 1), sx * (W * 0.5 + 0.04), -0.12, 0, 0, 0, 0, root);
    }
    add(rbox(W + 0.34, 0.30, 0.28, 0.03, sm.darkTimber, 1), 0, -0.12, L * 0.5 + 0.04, 0, 0, 0, root);

    const pilingZ = [-3.4, -1.1, 1.2, 3.85];
    const pilingH = 5.4;
    for (const pz of pilingZ) {
      add(rbox(W + 0.44, 0.28, 0.28, 0.03, sm.darkTimber, 1), 0, -0.22, pz, 0, 0, 0, root);
      for (const sx of [-1, 1]) {
        const px = sx * (W * 0.5 - 0.12);
        add(rbox(0.36, pilingH, 0.36, 0.03, sm.darkTimber, 1), px, -pilingH * 0.5 - 0.08, pz, 0, 0, 0, root);
        for (const by of [-0.45, -1.85, -3.35]) {
          add(rbox(0.44, 0.20, 0.44, 0.025, sunGold, 1), px, by, pz, 0, 0, 0, root);
        }
        add(rbox(0.06, 0.26, 0.26, 0.02, sunGold, 1), sx * (W * 0.5 + 0.23), -0.22, pz, 0, 0, 0, root);
      }
      K.beam([-W * 0.45, -0.45, pz], [W * 0.45, -2.95, pz], 0.14, sm.oakTimber, root);
      K.beam([W * 0.45, -0.45, pz], [-W * 0.45, -2.95, pz], 0.14, sm.oakTimber, root);
    }
    for (let i = 0; i < pilingZ.length - 1; i++) {
      for (const sx of [-1, 1]) {
        const px = sx * (W * 0.5 - 0.12);
        K.beam([px, -0.45, pilingZ[i]], [px, -2.15, pilingZ[i + 1]], 0.13, sm.oakTimber, root);
        K.beam([px, -0.45, pilingZ[i + 1]], [px, -2.15, pilingZ[i]], 0.13, sm.oakTimber, root);
      }
    }
  }

  // 3. Rope-and-Post Railings, 4 Glowing Amber Pier Lanterns & 3 Royal-Blue Winged Banners!
  const ropeMat = K.M(0xe2bc78, null, { roughness: 0.84, metalness: 0 });
  {
    const addPost = (px, pz, withLantern = false) => {
      const hP = withLantern ? 1.32 : 0.96;
      add(rbox(0.18, hP, 0.18, 0.025, sm.darkTimber, 1), px, Y_DECK + hP * 0.5, pz, 0, 0, 0, root);
      add(rbox(0.22, 0.08, 0.22, 0.02, sunGold, 1), px, Y_DECK + 0.92, pz, 0, 0, 0, root);
      if (withLantern) {
        const ly = Y_DECK + hP + 0.20;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.30, 6), sm.amberGlow), px, ly, pz, 0, 0, 0, root);
        add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 6), amberBronze), px, ly + 0.21, pz, 0, 0, 0, root);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), sunGold), px, ly + 0.31, pz, 0, 0, 0, root);
      } else {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), sunGold), px, Y_DECK + 1.00, pz, 0, 0, 0, root);
      }
    };

    const addRopeSpan = (ax, az, bx, bz, yH = Y_DECK + 0.84, sag = 0.18) => {
      const p0 = new THREE.Vector3(ax, yH, az);
      const p2 = new THREE.Vector3(bx, yH, bz);
      const p1 = p0.clone().lerp(p2, 0.5);
      p1.y -= sag;
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.032, 6, false), ropeMat), 0, 0, 0, 0, 0, 0, root);
    };

    const postZ = [-3.6, -1.3, 1.1, 3.95];
    for (let i = 0; i < postZ.length; i++) {
      addPost(-W * 0.5 + 0.12, postZ[i], i === 0 || i === 3);
      addPost(W * 0.5 - 0.12, postZ[i], i === 1 || i === 3);
      if (i < postZ.length - 1) {
        addRopeSpan(-W * 0.5 + 0.12, postZ[i], -W * 0.5 + 0.12, postZ[i + 1]);
        if (i !== 1) addRopeSpan(W * 0.5 - 0.12, postZ[i], W * 0.5 - 0.12, postZ[i + 1]);
      }
    }
    addPost(0, 3.95, false);
    addRopeSpan(-W * 0.5 + 0.12, 3.95, 0, 3.95);
    addRopeSpan(0, 3.95, W * 0.5 - 0.12, 3.95);

    // Mooring rope tying the Ornithopter berth bollard out toward the moored Ornithopter!
    {
      const mCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.92, Y_DECK + 0.38, 0.05),
        new THREE.Vector3(2.38, Y_DECK + 0.24, 0.28),
        new THREE.Vector3(2.85, Y_DECK + 0.52, 0.52),
      ]);
      add(new THREE.Mesh(new THREE.TubeGeometry(mCurve, 10, 0.028, 5, false), ropeMat), 0, 0, 0, 0, 0, 0, root);
    }

    boxCol(-W * 0.5 + 0.12, 0.2, 0.24, L - 0.8);
    boxCol(W * 0.5 - 0.12, 0.2, 0.24, L - 0.8);
    boxCol(0, L * 0.5 - 0.18, W, 0.26);

    addPirateWingBanner(THREE, K, sm, gm, 0, -0.04, L * 0.5 + 0.20, 0, 1.05, root);
    addPirateWingBanner(THREE, K, sm, gm, -W * 0.5 - 0.20, -0.04, 1.25, -PI * 0.5, 0.98, root);
    addPirateWingBanner(THREE, K, sm, gm, W * 0.5 + 0.20, -0.04, -1.25, PI * 0.5, 0.98, root);
  }

  // 4. Small Catenary Canvas Dock Awning & Dock-Master Counter on Port Side (int_06.png!)
  {
    const ax = -1.25, az = -1.55;
    const awW = 2.05, awD = 2.25, awH = 2.38;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, awH, 8), sm.oakTimber),
          ax + sx * (awW * 0.46), Y_DECK + awH * 0.5, az + sz * (awD * 0.46), 0, 0, 0, root);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), sunGold),
          ax + sx * (awW * 0.46), Y_DECK + awH + 0.01, az + sz * (awD * 0.46), 0, 0, 0, root);
      }
    }
    const dockCanopyGeo = buildCatenaryCanopyGeo(THREE, awW + 0.26, awD + 0.26, 0.78, 0.16, 10);
    add(new THREE.Mesh(dockCanopyGeo, sm.creamCanvas), ax, Y_DECK + awH, az, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.34, 8), sunGold), ax, Y_DECK + awH + 0.88, az, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), sunGold), ax, Y_DECK + awH + 0.72, az, 0, 0, 0, root);

    add(rbox(0.76, 0.76, 1.48, 0.03, sm.oakTimber, 1), ax - 0.35, Y_DECK + 0.38, az, 0, 0, 0, root);
    add(rbox(0.84, 0.07, 1.56, 0.02, sm.darkTimber, 1), ax - 0.35, Y_DECK + 0.78, az, 0, 0, 0, root);
    add(rbox(0.42, 0.03, 0.54, 0.01, sm.cyanSoft, 1), ax - 0.32, Y_DECK + 0.83, az - 0.25, 0, 0.12, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.48, 10), amberBronze), 1.92, Y_DECK + 0.24, 0.05, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 6, 12), sunGold), 1.92, Y_DECK + 0.42, 0.05, PI * 0.5, 0, 0, root);
    boxCol(ax - 0.35, az, 0.82, 1.52);
  }

  // 5. MOORED BRASS, GLASS & DRAGONFLY-WING ORNITHOPTER (`mooredOrnithopter`, `ornithopterWingL`, `ornithopterWingR`)!
  const mooredOrnithopter = new THREE.Group();
  mooredOrnithopter.name = 'mooredOrnithopter';
  mooredOrnithopter.position.set(3.25, 0.95, 0.85);
  mooredOrnithopter.rotation.y = -0.18;
  mooredOrnithopter.userData.keep = true;
  mooredOrnithopter.userData.baseY = 0.95;
  root.add(mooredOrnithopter);

  const ornithopterWingL = new THREE.Group();
  ornithopterWingL.name = 'ornithopterWingL';
  ornithopterWingL.position.set(-0.52, 0.26, -0.05);
  ornithopterWingL.userData.keep = true;
  mooredOrnithopter.add(ornithopterWingL);

  const ornithopterWingR = new THREE.Group();
  ornithopterWingR.name = 'ornithopterWingR';
  ornithopterWingR.position.set(0.52, 0.26, -0.05);
  ornithopterWingR.userData.keep = true;
  mooredOrnithopter.add(ornithopterWingR);

  {
    // A. Streamlined Ribbed Sunlit Golden-Brass & Copper Fuselage Hull (matches ext_06.png!)
    const hullProf = [
      [0.0, -1.78], [0.16, -1.68], [0.42, -1.32], [0.58, -0.78],
      [0.64, -0.15], [0.60, 0.52], [0.44, 1.12], [0.22, 1.58], [0.08, 1.82], [0.0, 1.86],
    ];
    const hullGeo = new THREE.LatheGeometry(hullProf.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    hullGeo.rotateX(PI * 0.5);
    hullGeo.scale(1.0, 0.78, 1.0);
    add(new THREE.Mesh(hullGeo, sunGold), 0, -0.08, 0, 0, 0, 0, mooredOrnithopter);

    // Riveted bronze hull rings along nose & tail cone
    for (const [hz, hr] of [[-1.32, 0.41], [0.95, 0.48], [1.42, 0.29]]) {
      const hRing = new THREE.TorusGeometry(hr, 0.022, 6, 16);
      hRing.scale(1.0, 0.78, 1.0);
      add(new THREE.Mesh(hRing, amberBronze), 0, -0.08, hz, 0, 0, 0, mooredOrnithopter);
    }

    // Pointed copper nose cone + brass wind-vane pitot probe at front (-Z)
    add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 14), warmCopper), 0, -0.08, -1.86, -PI * 0.5, 0, 0, mooredOrnithopter);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), amberBronze), 0, 0.14, -1.85, 0.55, 0, 0, mooredOrnithopter);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), sunGold), 0, 0.32, -1.96, 0, 0, 0, mooredOrnithopter);

    // Arched Multi-Pane Glowing Sky-Blue Glass Cockpit Canopy + Ribbed Brass Frame!
    const canopyGeo = new THREE.SphereGeometry(0.58, 18, 12, 0, PI);
    canopyGeo.rotateX(-PI * 0.5);
    canopyGeo.scale(0.94, 0.78, 1.85);
    add(new THREE.Mesh(canopyGeo, sm.conservatoryGlass), 0, 0.08, -0.22, 0, 0, 0, mooredOrnithopter);

    for (const rz of [-0.95, -0.55, -0.15, 0.25, 0.62]) {
      const ribScale = 1 - Math.pow((rz + 0.18) / 1.15, 2) * 0.42;
      const rib = new THREE.TorusGeometry(0.55 * ribScale, 0.028, 6, 16, PI);
      add(new THREE.Mesh(rib, amberBronze), 0, 0.06, rz, 0, 0, 0, mooredOrnithopter);
    }
    add(rbox(0.06, 0.06, 2.25, 0.02, sunGold, 1), 0, 0.52, -0.15, 0.04, 0, 0, mooredOrnithopter);
    add(rbox(0.42, 0.36, 0.12, 0.03, sm.crimsonLeather, 1), 0, 0.16, -0.32, -0.22, 0, 0, mooredOrnithopter);
    add(rbox(0.42, 0.36, 0.12, 0.03, sm.crimsonLeather, 1), 0, 0.16, 0.28, -0.22, 0, 0, mooredOrnithopter);

    // Side Skyglass Aether Turbine Pods + Landing Skids + Tail Fin + 4-Blade Rear Propeller!
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.56, 14), warmCopper),
        sx * 0.58, -0.16, 0.42, PI * 0.5, 0, 0, mooredOrnithopter);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.032, 6, 14), sunGold),
        sx * 0.58, -0.16, 0.16, 0, 0, 0, mooredOrnithopter);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), sm.cyanCrystal),
        sx * 0.58, -0.16, 0.68, 0, 0, 0, mooredOrnithopter);

      add(rbox(0.06, 0.06, 1.85, 0.02, amberBronze, 1), sx * 0.44, -0.62, -0.15, 0, 0, 0, mooredOrnithopter);
      add(rbox(0.05, 0.36, 0.06, 0.015, amberBronze, 1), sx * 0.44, -0.44, -0.72, 0.2, 0, 0, mooredOrnithopter);
      add(rbox(0.05, 0.36, 0.06, 0.015, amberBronze, 1), sx * 0.44, -0.44, 0.42, -0.2, 0, 0, mooredOrnithopter);
    }
    add(rbox(0.96, 0.05, 0.42, 0.015, sm.wingParchment, 1), 0, 0.02, 1.65, 0, 0, 0, mooredOrnithopter);
    add(rbox(0.05, 0.48, 0.44, 0.015, sunGold, 1), 0, 0.20, 1.65, -0.25, 0, 0, mooredOrnithopter);
    // 4-blade brass tail propeller
    add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), warmCopper), 0, -0.06, 1.92, 0, 0, 0, mooredOrnithopter);
    for (let b = 0; b < 4; b++) {
      const ba = (b / 4) * TAU + PI * 0.25;
      add(rbox(0.09, 0.46, 0.022, 0.01, sunGold, 1),
        Math.cos(ba) * 0.22, -0.06 + Math.sin(ba) * 0.22, 1.94, 0.2, 0, ba - PI * 0.5, mooredOrnithopter);
    }

    // B. Articulated Left & Right Scalloped Dragonfly/Bat Ornithopter Wings (ext_06.png!)
    const buildArticulatedWing = (wingGrp, dirX) => {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), sunGold), 0, 0, 0, 0, 0, 0, wingGrp);

      const sparTips = [
        [dirX * 2.58, 0.36, -0.42],
        [dirX * 2.42, 0.28, 0.06],
        [dirX * 2.12, 0.18, 0.54],
        [dirX * 1.66, 0.08, 0.96],
        [dirX * 1.08, -0.02, 1.24],
      ];
      const sparMidPts = sparTips.map(([tx, ty, tz]) => [tx * 0.52, ty * 0.72 + 0.16, tz * 0.44 - 0.08]);

      for (let s = 0; s < sparTips.length; s++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(...sparMidPts[s]),
          new THREE.Vector3(...sparTips[s]),
        ]);
        const rTube = s === 0 ? 0.040 : 0.024;
        add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, rTube, 6, false), s === 0 ? sunGold : amberBronze),
          0, 0, 0, 0, 0, 0, wingGrp);
      }

      const webPos = [];
      const webIdx = [];
      const SEG_R = 8;
      for (let s = 0; s < sparTips.length - 1; s++) {
        const cA = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(...sparMidPts[s]), new THREE.Vector3(...sparTips[s])]);
        const cB = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(...sparMidPts[s + 1]), new THREE.Vector3(...sparTips[s + 1])]);
        const baseV = webPos.length / 3;
        for (let i = 0; i <= SEG_R; i++) {
          const u = i / SEG_R;
          const pA = cA.getPoint(u);
          const pB = cB.getPoint(u);
          const pMid = pA.clone().lerp(pB, 0.5);
          if (i === SEG_R) pMid.multiplyScalar(0.90);
          pMid.y += Math.sin(u * PI) * 0.035;
          webPos.push(pA.x, pA.y, pA.z, pMid.x, pMid.y, pMid.z, pB.x, pB.y, pB.z);
        }
        for (let i = 0; i < SEG_R; i++) {
          const r0 = baseV + i * 3, r1 = baseV + (i + 1) * 3;
          webIdx.push(r0, r1, r0 + 1, r1, r1 + 1, r0 + 1);
          webIdx.push(r0 + 1, r1 + 1, r0 + 2, r1 + 1, r1 + 2, r0 + 2);
        }
      }
      const webGeo = new THREE.BufferGeometry();
      webGeo.setAttribute('position', new THREE.Float32BufferAttribute(webPos, 3));
      const uvs = new Float32Array((webPos.length / 3) * 2);
      for (let i = 0; i < webPos.length / 3; i++) {
        uvs[i * 2] = webPos[i * 3] * 0.4;
        uvs[i * 2 + 1] = webPos[i * 3 + 2] * 0.4;
      }
      webGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      webGeo.setIndex(webIdx);
      webGeo.computeVertexNormals();
      add(new THREE.Mesh(webGeo, sm.wingParchment), 0, 0, 0, 0, 0, 0, wingGrp);
    };

    buildArticulatedWing(ornithopterWingL, -1);
    buildArticulatedWing(ornithopterWingR, 1);
    ornithopterWingL.rotation.z = -0.10;
    ornithopterWingR.rotation.z = 0.10;
  }

  K.finalize([ornithopterWingL, ornithopterWingR, mooredOrnithopter]);
  Object.assign(root.userData, { mooredOrnithopter, ornithopterWingL, ornithopterWingR });
  return root;
}

// ============================================================================
// 3. SKY-MERCHANT BAZAAR STALL (`buildSkyStall`)
// Matching overview.png foreground bazaar (Cream & Terracotta-Striped canopies!)
// ============================================================================
export function buildSkyStall(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'sky_stall', 63);
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const { root, add, rbox, boxCol, pushInst, jr } = K;
  const sm = getSkyMats(THREE, K);
  const LT = getSkyLandmarkTextures(THREE);
  const { sunGold, amberBronze } = makeGoldMats(THREE, K);

  const W = 3.8;
  const D = 3.2;
  const H_POST = 2.48;
  const isStriped = !!(opts.striped || opts.stripeHex);
  const canopyMat = isStriped ? sm.stripedStall : sm.creamCanvas;
  const carpetMat = K.M(0xffffff, LT.bazaarCarpet, { roughness: 0.84, metalness: 0 });
  const cobaltPotMat = K.M(0x2f64a8, K.tex('plaster', 1.2, 1.2), { roughness: 0.72, metalness: 0 });

  // 1. Stepped Travertine Base Plinth + Front Bazaar Carpet (walkable!)
  const plinth = add(rbox(W + 0.16, 0.10, D + 0.16, 0.03, sm.travertinePlain, 1), 0, 0.05, 0, 0, 0, 0, root);
  plinth.userData.ground = true;
  const frontRug = add(rbox(1.95, 0.025, 0.92, 0.01, carpetMat, 1), 0, 0.018, D * 0.5 + 0.42, 0, 0.03, 0, root);
  frontRug.userData.ground = true;

  // 2. 4 Carved Stone Plinth Blocks + Turned Warm-Timber Corner Posts + Eave Tie-Beams
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * (W * 0.5 - 0.18);
      const pz = sz * (D * 0.5 - 0.18);
      add(rbox(0.36, 0.24, 0.36, 0.03, sm.travertineWarm, 1), px, 0.18, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.098, H_POST - 0.22, 10), sm.oakTimber),
        px, 0.24 + (H_POST - 0.22) * 0.5, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.022, 6, 12), sunGold), px, 1.95, pz, PI * 0.5, 0, 0, root);
      // Sunlit brass corner finial seated flush on top of corner post & canopy eave!
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 10), amberBronze), px, H_POST - 0.02, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), sunGold), px, H_POST + 0.06, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.19, 8), sunGold), px, H_POST + 0.20, pz, 0, 0, 0, root);
    }
    add(rbox(0.12, 0.13, D - 0.18, 0.02, sm.darkTimber, 1), sx * (W * 0.5 - 0.18), H_POST - 0.06, 0, 0, 0, 0, root);
  }
  for (const sz of [-1, 1]) {
    add(rbox(W - 0.18, 0.13, 0.12, 0.02, sm.darkTimber, 1), 0, H_POST - 0.06, sz * (D * 0.5 - 0.18), 0, 0, 0, root);
  }

  // 3. Peaked Catenary Canvas Awning + Scalloped Valance Fringe + Tall Brass Spire Finial!
  {
    const awW = W + 0.42, awD = D + 0.42;
    const canopyGeo = buildCatenaryCanopyGeo(THREE, awW, awD, 1.04, 0.18, 14);
    add(new THREE.Mesh(canopyGeo, canopyMat), 0, H_POST + 0.02, 0, 0, 0, 0, root);

    const valGeo = () => sharedSkyGeo(THREE, 'sr_stall_val', () => new RoundedBoxGeometry(0.28, 0.20, 0.03, 0.05, 1));
    const nX = 12, nZ = 10;
    for (let i = 0; i < nX; i++) {
      const vx = -awW * 0.46 + (i / (nX - 1)) * awW * 0.92;
      const col = isStriped ? (i % 2 === 0 ? 0xdf6a42 : 0xfbf1dc) : 0xfbf0d8;
      for (const sz of [-1, 1]) {
        pushInst('stl_val', valGeo, sm.stoneInst, vx, H_POST - 0.08, sz * awD * 0.49, 0, 0, 0, 1, 1, 1, col, root);
      }
    }
    for (let i = 0; i < nZ; i++) {
      const vz = -awD * 0.45 + (i / (nZ - 1)) * awD * 0.90;
      const col = isStriped ? (i % 2 === 0 ? 0xdf6a42 : 0xfbf1dc) : 0xfbf0d8;
      for (const sx of [-1, 1]) {
        pushInst('stl_val', valGeo, sm.stoneInst, sx * awW * 0.49, H_POST - 0.08, vz, 0, PI * 0.5, 0, 1, 1, 1, col, root);
      }
    }

    add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.12, 12), sunGold), 0, H_POST + 1.06, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), sunGold), 0, H_POST + 1.20, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 8), sunGold), 0, H_POST + 1.44, 0, 0, 0, 0, root);
  }

  // 4. U-Shaped Carved Stone & Warm Timber Display Counters + Rich Celestian Wares!
  {
    const cY = 0.88;
    add(rbox(W - 0.64, 0.74, 0.74, 0.03, sm.oakTimber, 1), 0, 0.47, D * 0.5 - 0.56, 0, 0, 0, root);
    add(rbox(W - 0.52, 0.08, 0.84, 0.025, sm.travertineWarm, 1), 0, cY, D * 0.5 - 0.56, 0, 0, 0, root);
    for (const sx of [-1, 1]) {
      add(rbox(0.68, 0.74, D - 1.45, 0.03, sm.oakTimber, 1), sx * (W * 0.5 - 0.54), 0.47, -0.22, 0, 0, 0, root);
      add(rbox(0.76, 0.08, D - 1.35, 0.025, sm.travertineWarm, 1), sx * (W * 0.5 - 0.54), cY, -0.22, 0, 0, 0, root);
    }

    for (const [gx, gz, gr] of [[-0.86, D * 0.5 - 0.54, 0.22], [0.78, D * 0.5 - 0.58, 0.16]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(gr * 0.75, gr * 0.95, 0.10, 12), sunGold), gx, cY + 0.09, gz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.TorusGeometry(gr * 1.12, 0.022, 6, 16), amberBronze), gx, cY + 0.14 + gr, gz, 0.3, 0.4, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(gr, 14, 10), sm.cyanCrystal), gx, cY + 0.14 + gr, gz, 0, 0, 0, root);
    }

    const rugColors = [sm.terracotta, cobaltPotMat, sunGold, sm.crimsonLeather];
    for (let k = 0; k < 4; k++) {
      add(rbox(0.52 - k * 0.03, 0.075, 0.42 - k * 0.02, 0.02, rugColors[k], 1),
        0.02 + jr(-0.02, 0.02), cY + 0.08 + k * 0.075, D * 0.5 - 0.54, 0, jr(-0.08, 0.08), 0, root);
    }
    for (let r = 0; r < 3; r++) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.68, 10), rugColors[r]),
        -(W * 0.5 - 0.54) + (r - 1) * 0.16, cY + 0.13, -0.25, PI * 0.5, 0, 0.08, root);
    }

    const rx = W * 0.5 - 0.54;
    for (const [pz, pMat, sc] of [[-0.52, sm.terracotta, 1.0], [-0.08, cobaltPotMat, 0.86], [0.32, sm.travertinePlain, 0.92]]) {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.16 * sc, 10, 8), pMat), rx, cY + 0.18 * sc, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07 * sc, 0.09 * sc, 0.18 * sc, 10), pMat), rx, cY + 0.34 * sc, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.08 * sc, 0.018 * sc, 6, 10), sunGold), rx, cY + 0.42 * sc, pz, PI * 0.5, 0, 0, root);
    }

    for (const sx of [-1, 1]) {
      const lx = sx * (W * 0.5 - 0.48), lz = D * 0.5 - 0.18;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5), amberBronze), lx, H_POST - 0.20, lz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.24, 6), sm.amberGlow), lx, H_POST - 0.42, lz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), sunGold), lx, H_POST - 0.27, lz, 0, 0, 0, root);
    }
  }

  boxCol(0, 0.08, W - 0.55, D - 0.55);
  return K.finalize();
}

// ============================================================================
// 4. GIANT WALKABLE GNARLED TREE-ROOT BRIDGE (`buildRootBridge`)
// Spans along local Z from -length/2 to +length/2 matching map.js yaw & arch!
// ============================================================================
export function buildRootBridge(THREE, opts = {}) {
  const {
    length = 8.0,
    width = 2.8,
    rise = 0,
    arch = 0.55,
    seed = 41,
  } = opts;

  const K = createBuilderKit(THREE, Object.assign({}, opts, { seed }), 'root_bridge', 64);
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const { root, add, rbox, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const { sunGold, amberBronze } = makeGoldMats(THREE, K);
  const warmVineBark = K.M(0x9a6d44, K.tex('wood_light', 2, 3), { roughness: 0.84, metalness: 0 });

  const halfL = length * 0.5;
  const halfW = width * 0.5;
  const evalY = (t) => {
    const smT = t * t * (3 - 2 * t);
    return -rise * 0.5 + rise * smT + Math.sin(t * PI) * arch;
  };

  // 1. 3 Thick Intertwined Organic Bark Root Tubes forming the Load-Bearing Arch!
  const makeBridgeRootPts = (xBase, yOff, waveAmp, waveFreq, phase) => {
    const pts = [];
    const N = 9;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const z = -halfL + t * length;
      const env = Math.sin(t * PI);
      const x = xBase + Math.sin(t * TAU * waveFreq + phase) * waveAmp * env;
      const y = evalY(t) + yOff - (1 - env) * 0.12;
      pts.push([x, y, z]);
    }
    return pts;
  };

  buildGnarledRootTube(THREE, K, {
    points: makeBridgeRootPts(-halfW * 0.68, -0.22, 0.18, 1.5, 0.2),
    rStart: 0.34, rEnd: 0.30, radialSeg: 8, tubularSeg: 24, mossy: true, parent: root, batchPrefix: 'rb_rtL',
  });
  buildGnarledRootTube(THREE, K, {
    points: makeBridgeRootPts(halfW * 0.68, -0.22, 0.18, 1.5, PI + 0.2),
    rStart: 0.32, rEnd: 0.34, radialSeg: 8, tubularSeg: 24, mossy: true, parent: root, batchPrefix: 'rb_rtR',
  });
  buildGnarledRootTube(THREE, K, {
    points: makeBridgeRootPts(0, -0.36, 0.26, 2.0, 1.1),
    rStart: 0.38, rEnd: 0.36, radialSeg: 8, tubularSeg: 22, mossy: false, parent: root, batchPrefix: 'rb_rtC',
  });

  // Lush Emerald Moss Cushions & Wildflower Tufts along the outer root shoulders!
  {
    const mossGeo = () => sharedSkyGeo(THREE, 'sr_rb_moss_cush', () => new THREE.DodecahedronGeometry(0.14, 0));
    for (const side of [-1, 1]) {
      for (let m = 0; m < 7; m++) {
        const t = 0.12 + (m / 6) * 0.76;
        const mz = -halfL + t * length;
        const my = evalY(t) + 0.04;
        const mx = side * (halfW * 0.88) + jr(-0.05, 0.05);
        pushInst('rb_cush', mossGeo, sm.foliageInst,
          mx, my, mz, 0, jr(0, TAU), 0, jr(1.5, 2.2), jr(0.55, 0.85), jr(1.4, 2.0), pick(MOSS_PAL), root);
        if (m % 2 === 1) {
          pushInst('rb_cush_fl', mossGeo, sm.foliageInst,
            mx, my + 0.10, mz + 0.05, 0, jr(0, TAU), 0, 0.75, 0.70, 0.75, pick(WILDFLOWER_PAL), root);
        }
      }
    }
  }

  // 2. Natural Flat-Topped Mossy Stone & Hewn-Timber Tread Slabs along the Walkable Deck!
  {
    const nTreads = Math.max(10, Math.ceil(length / 0.56));
    const stoneTreadGeos = [];
    const woodTreadGeos = [];
    for (let i = 0; i <= nTreads; i++) {
      const t = i / nTreads;
      const z = -halfL + t * length;
      const y = evalY(t);
      const dt = 0.02;
      const dy = evalY(Math.min(1, t + dt)) - evalY(Math.max(0, t - dt));
      const pitch = -Math.atan2(dy, length * dt * 2);

      const gSlab = new RoundedBoxGeometry(width * 0.88 + jr(-0.08, 0.08), 0.16, (length / nTreads) * 1.12, 0.04, 1);
      gSlab.rotateX(pitch);
      gSlab.rotateY(jr(-0.025, 0.025));
      gSlab.translate(jr(-0.03, 0.03), y - 0.08, z);
      if (i % 3 === 0) woodTreadGeos.push(gSlab);
      else stoneTreadGeos.push(gSlab);
    }
    if (stoneTreadGeos.length) {
      const stDeck = new THREE.Mesh(mergeGeometries(stoneTreadGeos, false), sm.travertinePlain);
      stDeck.castShadow = true;
      stDeck.receiveShadow = true;
      stDeck.userData.ground = true;
      stDeck.userData.keep = true;
      root.add(stDeck);
      stoneTreadGeos.forEach((g) => g.dispose());
    }
    if (woodTreadGeos.length) {
      const wdDeck = new THREE.Mesh(mergeGeometries(woodTreadGeos, false), sm.oakTimber);
      wdDeck.castShadow = true;
      wdDeck.receiveShadow = true;
      wdDeck.userData.ground = true;
      wdDeck.userData.keep = true;
      root.add(wdDeck);
      woodTreadGeos.forEach((g) => g.dispose());
    }
  }

  // 3. Twisted Vine Side-Rails, Glowing Blue Sky-Orchids & Hanging Cyan Fairy-Lanterns!
  for (const side of [-1, 1]) {
    const railPts = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const z = -halfL + t * length;
      const y = evalY(t) + 0.58 + Math.sin(t * TAU * 1.5 + side) * 0.10;
      railPts.push(new THREE.Vector3(side * (halfW * 0.92), y, z));
    }
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 22, 0.095, 7, false), warmVineBark), 0, 0, 0, 0, 0, 0, root);

    for (const frac of [0.22, 0.50, 0.78]) {
      const z = -halfL + frac * length;
      const y0 = evalY(frac);
      const rx = side * (halfW * 0.90);
      add(rbox(0.14, 0.68, 0.14, 0.04, warmVineBark, 1), rx, y0 + 0.30, z, 0, 0, side * 0.08, root);

      if (Math.abs(frac - 0.50) < 0.05) {
        buildSkyOrchidCluster(THREE, K, {
          x: rx, y: y0 + 0.64, z, count: 2, scale: 0.82, rotY: side * 0.8, parent: root,
        });
      } else {
        const lx = rx + side * 0.16;
        add(rbox(0.24, 0.05, 0.05, 0.015, warmVineBark, 1), rx + side * 0.09, y0 + 0.68, z, 0, 0, -side * 0.25, root);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 5), amberBronze), lx, y0 + 0.56, z, 0, 0, 0, root);
        add(new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), sm.cyanCrystal), lx, y0 + 0.37, z, 0, 0.4, 0, root);
        add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.10, 6), sunGold), lx, y0 + 0.48, z, 0, 0, 0, root);
      }
    }
  }

  // 4. Dangling Vertical Side Root Cluster Underneath (`g.userData.clingOffset`) for Sky-Root Clinging!
  const clingX = -halfW * 0.92;
  const midY = evalY(0.5);
  buildGnarledRootTube(THREE, K, {
    points: [
      [clingX * 0.75, midY - 0.15, -0.35],
      [clingX - 0.12, midY - 0.78, -0.08],
      [clingX - 0.05, midY - 1.65, 0.06],
      [clingX + 0.08, midY - 2.35, 0.0],
    ],
    rStart: 0.24, rEnd: 0.08, radialSeg: 7, tubularSeg: 14, mossy: true, parent: root, batchPrefix: 'rb_clingA',
  });
  buildGnarledRootTube(THREE, K, {
    points: [
      [clingX * 0.80, midY - 0.18, 0.32],
      [clingX - 0.18, midY - 0.92, 0.15],
      [clingX - 0.10, midY - 1.88, -0.05],
    ],
    rStart: 0.18, rEnd: 0.06, radialSeg: 6, tubularSeg: 12, mossy: false, parent: root, batchPrefix: 'rb_clingB',
  });
  buildSkyOrchidCluster(THREE, K, {
    x: clingX - 0.12, y: midY - 0.85, z: 0.05, count: 2, scale: 0.75, rotY: -1.4, parent: root,
  });

  K.finalize();
  root.userData.clingOffset = {
    x: +(clingX - 0.14).toFixed(2),
    y: +(midY - 0.95).toFixed(2),
    z: 0,
  };
  return root;
}

// ============================================================================
// 5. GLOWING CELESTIAN WIND UPDRAFT GEYSER (`buildUpdraftGeyser`)
// Octagonal mossy travertine rune ring + cyan-gold core + 3.2m helical windSwirl!
// ============================================================================
export function buildUpdraftGeyser(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'updraft_geyser', 65);
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const { root, add, rbox, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const LT = getSkyLandmarkTextures(THREE);
  const { sunGold } = makeGoldMats(THREE, K);

  const R = 1.45;
  const coreMat = K.M(0xffffff, LT.windCoreTex, {
    roughness: 0.26,
    metalness: 0,
    emissive: new THREE.Color(0x28ccf2),
    emissiveIntensity: 0.78,
  });

  // 1. Octagonal Mossy Cream-Travertine Rune Plinth Flush with the Ground (walkable!)
  {
    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.08, R + 0.06, 0.16, 8), sm.travertinePlain);
    add(baseRing, 0, 0.08, 0, 0, PI / 8, 0, root);
    baseRing.userData.ground = true;

    const runeBand = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R + 0.02, 0.12, 8, 1, true), sm.runeFrieze);
    add(runeBand, 0, 0.08, 0, 0, PI / 8, 0, root);

    const mossGeo = () => sharedSkyGeo(THREE, 'sr_ug_moss', () => new THREE.DodecahedronGeometry(0.14, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const kx = Math.cos(a) * (R - 0.06), kz = Math.sin(a) * (R - 0.06);
      const kb = add(rbox(0.32, 0.18, 0.36, 0.03, sm.travertineWarm, 1), kx, 0.09, kz, 0, -a, 0, root);
      kb.userData.ground = true;
      add(rbox(0.14, 0.03, 0.18, 0.01, sunGold, 1), kx, 0.185, kz, 0, -a, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), sm.cyanCrystal), kx, 0.21, kz, 0, 0, 0, root);
      if (i % 2 === 0) {
        pushInst('ug_moss', mossGeo, sm.foliageInst,
          Math.cos(a + 0.2) * (R + 0.04), 0.08, Math.sin(a + 0.2) * (R + 0.04),
          0, jr(0, TAU), 0, 1.5, 0.65, 1.5, pick(MOSS_PAL), root);
      }
    }

    const coreDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.175, 24), coreMat);
    add(coreDisc, 0, 0.088, 0, 0, 0, 0, root);
    coreDisc.userData.ground = true;

    const goldRim = new THREE.TorusGeometry(1.08, 0.038, 6, 24);
    goldRim.rotateX(PI * 0.5);
    add(new THREE.Mesh(goldRim, sunGold), 0, 0.178, 0, 0, 0, 0, root);
  }

  // 2. Animated Child Group `windSwirl` rising 3.2m into the Sky!
  const windSwirl = new THREE.Group();
  windSwirl.name = 'windSwirl';
  windSwirl.userData.keep = true;
  root.add(windSwirl);

  {
    const ribbonMatCyan = new THREE.MeshStandardMaterial({
      color: 0xa6f8ff,
      emissive: new THREE.Color(0x28d2f8),
      emissiveIntensity: 0.65,
      roughness: 0.22,
      metalness: 0,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ribbonMatGold = new THREE.MeshStandardMaterial({
      color: 0xfff4c2,
      emissive: new THREE.Color(0xffcf5c),
      emissiveIntensity: 0.54,
      roughness: 0.28,
      metalness: 0,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * TAU;
      const SEG = 28;
      const pos = [], uvs = [], idx = [];
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const ang = a0 + t * TAU * 1.65;
        const rad = 0.68 + Math.sin(t * PI * 0.85) * 0.44;
        const y = 0.18 + t * 3.05;
        const halfW = Math.sin(t * PI) * 0.13 + 0.025;
        const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
        pos.push(cx, y - halfW, cz, cx, y + halfW, cz);
        uvs.push(t, 0, t, 1);
        if (i < SEG) {
          const b = i * 2;
          idx.push(b, b + 2, b + 1, b + 2, b + 3, b + 1);
        }
      }
      const rGeo = new THREE.BufferGeometry();
      rGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      rGeo.setIndex(idx);
      rGeo.computeVertexNormals();
      const rm = new THREE.Mesh(rGeo, k === 2 ? ribbonMatGold : ribbonMatCyan);
      rm.castShadow = false;
      windSwirl.add(rm);
    }

    const moteGeo = new THREE.SphereGeometry(0.08, 6, 5);
    moteGeo.scale(0.55, 0.18, 1.45);
    const featherMat = K.glowMat(0xfffdf5, 0xffe6a4, 0.44, { roughness: 0.45 });
    for (let m = 0; m < 14; m++) {
      const t = (m + 0.5) / 14;
      const ma = m * 2.15;
      const mr = 0.42 + t * 0.68;
      const my = 0.35 + t * 2.75;
      const mote = new THREE.Mesh(moteGeo, m % 2 === 0 ? sm.mossGreen : featherMat);
      mote.position.set(Math.cos(ma) * mr, my, Math.sin(ma) * mr);
      mote.rotation.set(0.45, -ma, 0.35);
      mote.castShadow = false;
      windSwirl.add(mote);
    }
  }

  K.finalize([windSwirl]);
  root.userData.windSwirl = windSwirl;
  return root;
}

// ============================================================================
// 6. FLOATING MOSSY CELESTIAN RUNE-STONE PLATFORM (`buildOrbitingRunePlatform`)
// Top walkable surface flush at y = 0.0 (`userData.ground = true`)!
// ============================================================================
export function buildOrbitingRunePlatform(THREE, opts = {}) {
  const { radius = 1.85, seed = 77 } = opts;
  const K = createBuilderKit(THREE, Object.assign({}, opts, { seed }), 'orbiting_rune_platform', 66);
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const { root, add, rbox, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const { sunGold } = makeGoldMats(THREE, K);

  // 1. Walkable Carved Cream-Travertine Top Slab (top flush at y = 0.0!)
  {
    const topSlab = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, 0.26, 10), sm.travertine);
    add(topSlab, 0, -0.13, 0, 0, PI / 10, 0, root);
    topSlab.userData.ground = true;

    const inlaidMosaic = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, 0.02, 20), sm.compassMosaic);
    add(inlaidMosaic, 0, -0.004, 0, 0, 0, 0, root);
    inlaidMosaic.userData.ground = true;

    const topGoldRing = new THREE.TorusGeometry(radius * 0.67, 0.026, 6, 24);
    topGoldRing.rotateX(PI * 0.5);
    add(new THREE.Mesh(topGoldRing, sunGold), 0, 0.004, 0, 0, 0, 0, root);
  }

  // 2. Glowing Cyan Celestian Rune-Vein Band around the Rim (y = -0.22 .. -0.48)
  {
    const runeCyl = new THREE.CylinderGeometry(radius * 0.95, radius * 0.86, 0.26, 10, 1, true);
    add(new THREE.Mesh(runeCyl, sm.runeFrieze), 0, -0.36, 0, 0, PI / 10, 0, root);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      add(rbox(0.24, 0.22, 0.14, 0.03, sunGold, 1),
        Math.sin(a) * (radius * 0.92), -0.35, Math.cos(a) * (radius * 0.92), 0, a, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), sm.cyanCrystal),
        Math.sin(a) * (radius * 0.97), -0.35, Math.cos(a) * (radius * 0.97), 0, 0, 0, root);
    }
  }

  // 3. Craggy Tapered Skyglass Underside + Protruding Cyan Crystal Shards (y = -0.48 .. -1.88)
  {
    const cragGeo = () => sharedSkyGeo(THREE, 'sr_orp_crag', () => new THREE.DodecahedronGeometry(0.48, 0));
    const coreCone = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.80, 1.38, 8), sm.travertineDark);
    add(coreCone, 0, -1.16, 0, PI, 0, 0, root);

    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      const r = radius * 0.64;
      pushInst('orp_rk', cragGeo, sm.stoneInst,
        Math.cos(a) * r, -0.72 + jr(-0.10, 0.08), Math.sin(a) * r,
        jr(-0.3, 0.3), jr(0, TAU), jr(-0.3, 0.3),
        jr(0.95, 1.35), jr(0.85, 1.25), jr(0.95, 1.35), pick(CLIFF_ROCK_PAL), root);
    }
    const keelCry = new THREE.OctahedronGeometry(0.26, 0);
    keelCry.scale(0.85, 1.75, 0.85);
    add(new THREE.Mesh(keelCry, sm.cyanCrystal), 0, -1.82, 0, 0, 0.4, 0, root);
  }

  // 4. Small Sprouting Rim Moss Cushions & Daisies (kept on outer edge so center stays flat!)
  {
    const dotGeo = () => sharedSkyGeo(THREE, 'sr_orp_flw', () => new THREE.DodecahedronGeometry(0.085, 0));
    for (const ang of [0.35, 1.95, 3.85, 5.10]) {
      const mx = Math.cos(ang) * (radius * 0.88);
      const mz = Math.sin(ang) * (radius * 0.88);
      pushInst('orp_ms', dotGeo, sm.foliageInst, mx, 0.02, mz, 0, ang, 0, 2.2, 0.65, 1.8, pick(MOSS_PAL), root);
      pushInst('orp_fl', dotGeo, sm.foliageInst, mx + 0.05, 0.08, mz - 0.04, 0, ang, 0, 0.95, 0.85, 0.95, 0xfffbf0, root);
    }
  }

  return K.finalize();
}

// ============================================================================
// 7. SATELLITE FLOATING ROCK ISLET (`buildFloatingIslet`)
// Scenic floating rock islet w/ mossy grass crown, Storybook tree, cyan crystal & waterfall!
// ============================================================================
export function buildFloatingIslet(THREE, opts = {}) {
  const scale = opts.scale || 1;
  const K = createBuilderKit(THREE, opts, 'floating_islet', 67);
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const { root, add, rbox, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const { sunGold } = makeGoldMats(THREE, K);

  // 1. Mossy Grass Crown + Craggy Multi-Boulder Floating Rock Cone
  {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.15, 0.36, 14), sm.mossGreen);
    add(crown, 0, 0.02, 0, 0, 0, 0, root);
    crown.userData.ground = true;

    const underCone = new THREE.Mesh(new THREE.ConeGeometry(2.05, 3.35, 9), sm.travertineDark);
    add(underCone, 0, -1.82, 0, PI, 0, 0, root);

    const rkGeo = () => sharedSkyGeo(THREE, 'sr_isl_rk', () => new THREE.DodecahedronGeometry(0.62, 0));
    const flwGeo = () => sharedSkyGeo(THREE, 'sr_isl_flw', () => new THREE.DodecahedronGeometry(0.11, 0));
    for (let ring = 0; ring < 3; ring++) {
      const f = 1 - ring * 0.28;
      const cnt = 12 - ring * 3;
      const ry = -0.58 - ring * 0.92;
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU + ring * 0.35;
        pushInst('isl_rk', rkGeo, sm.stoneInst,
          Math.cos(a) * 1.95 * f, ry + jr(-0.12, 0.12), Math.sin(a) * 1.95 * f,
          jr(-0.3, 0.3), jr(0, TAU), jr(-0.3, 0.3),
          jr(1.1, 1.55) * f, jr(1.0, 1.45), jr(1.1, 1.55) * f, pick(CLIFF_ROCK_PAL), root);
        if (ring === 0) {
          pushInst('isl_ms', flwGeo, sm.foliageInst,
            Math.cos(a) * 2.12, 0.20, Math.sin(a) * 2.12,
            0, jr(0, TAU), 0, 2.2, 0.9, 2.2, pick(MOSS_PAL), root);
          if (i % 2 === 0) {
            pushInst('isl_fl', flwGeo, sm.foliageInst,
              Math.cos(a) * 1.85, 0.30, Math.sin(a) * 1.85,
              0, jr(0, TAU), 0, 1.1, 0.9, 1.1, pick(WILDFLOWER_PAL), root);
          }
        }
      }
    }
    buildWisteriaRacemes(THREE, K, {
      cx: -1.55, yTop: 0.12, cz: 1.45, spanX: 1.1, strands: 5, maxLen: 1.15,
      rotY: 0.65, parent: root, batchPrefix: 'isl_wist',
    });
  }

  // 2. Small Windswept Storybook Tree (`buildGnarledRootTube` + `buildFoliageCanopyCluster`)
  {
    buildGnarledRootTube(THREE, K, {
      points: [[-0.35, 0.10, -0.25], [-0.55, 1.05, -0.15], [-0.25, 2.05, 0.05]],
      rStart: 0.26, rEnd: 0.11, radialSeg: 7, tubularSeg: 14, mossy: true, parent: root, batchPrefix: 'isl_trA',
    });
    buildGnarledRootTube(THREE, K, {
      points: [[-0.45, 1.15, -0.12], [-1.05, 1.82, -0.35]],
      rStart: 0.14, rEnd: 0.07, radialSeg: 6, tubularSeg: 8, mossy: false, parent: root, batchPrefix: 'isl_trB',
    });
    buildFoliageCanopyCluster(THREE, K, {
      cx: -0.45, cy: 2.35, cz: -0.05, rx: 1.55, ry: 0.95, rz: 1.45,
      puffs: 20, palette: FOLIAGE_SUN_PAL, parent: root, batchPrefix: 'isl_can',
    });
  }

  // 3. Glowing Cyan Rune Crystal + Sunlit Golden Orbit Ring!
  {
    add(rbox(0.58, 0.22, 0.58, 0.03, sm.travertinePlain, 1), 0.95, 0.28, -0.35, 0, 0.35, 0, root);
    const cryGeo = new THREE.OctahedronGeometry(0.32, 0);
    cryGeo.scale(0.85, 1.85, 0.85);
    add(new THREE.Mesh(cryGeo, sm.cyanCrystal), 0.95, 0.82, -0.35, 0.08, 0.5, -0.06, root);
    const ringGeo = new THREE.TorusGeometry(0.46, 0.030, 6, 18);
    add(new THREE.Mesh(ringGeo, sunGold), 0.95, 0.82, -0.35, 0.65, 0.35, 0, root);
  }

  // 4. Sparkling Mini Turquoise Waterfall + Mist Puff
  if (opts.waterfall !== false) {
    add(rbox(0.62, 0.08, 1.15, 0.02, sm.waterGlow, 1), 0.55, 0.20, 1.45, 0, 0.25, 0, root);
    add(rbox(0.58, 2.55, 0.14, 0.03, sm.waterGlow, 1), 0.72, -1.02, 2.02, 0.10, 0.25, 0, root);
    const mistMat = K.M(0xf4fcff, null, { roughness: 0.92, metalness: 0, emissive: 0x8be4ff, emissiveIntensity: 0.24 });
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), mistMat), 0.78, -2.25, 2.18, 0, 0, 0, root);
  }

  K.finalize();
  if (scale !== 1) root.scale.setScalar(scale);
  return root;
}
