// ============================================================================
// Celestia Sky-Ruins (Celestia) — Building 3: Sky-Pirate Ornithopter Hangar
// Hand-sculpted 1:1 from Codex references `ext_03.png` & `int_03.png`:
//   - Mossy floating Celestian travertine island plinth + cobbled forecourt apron,
//     side wooden bollards with sagging hemp rope chains & stacked aviation crates
//   - Grand radial-voussoir stone & riveted-timber barrel-vault hangar arch with
//     keystone dark-bronze & gold Anchor Medallion, bi-fold oak doors (>= 3.3m clear),
//     vault-hung cyan celestial navigation globe, and twin Royal-Blue Winged
//     Sky-Pirate Banners (`sm.pirateBanner`)
//   - Multi-peaked golden-ochre stretched airship canvas tent canopy (`sm.canopyCanvas`)
//     with outrigger spars, catenary guy-ropes, brass finials & tall right-side weather
//     mast crowned by a spinning 6-blade brass wind-vane (`hangarWindvane`)
//   - 2-room cutaway interior: `ornithopter_bay` (centerpiece twin-pod Brass, Cyan-Glass &
//     4-Wing Parchment Storybook Ornithopter on drydock cradle, wall-mounted 4-blade brass
//     propeller, arched workshop windows, sawhorses, tool bench & amber lanterns) and
//     `rigging_loft` (stone partition arch >= 1.9m, flight-deck stairs & mezzanine,
//     hanging coiled hemp ropes, riveted chests, aviation workbench & 9 propSlots).
// ALL materials enforce `metalness: 0` for luminous Storybook gouache warmth!
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  gouacheGrainTex,
  RoundedBoxGeometry,
  mergeGeometries,
} from '../../map_kit.js?v=2';
import {
  TRAVERTINE_PAL,
  MOSS_PAL,
  WILDFLOWER_PAL,
  sharedSkyGeo,
  getSkyMats,
  buildMossyIslandPlinth,
  buildAshlarMasonryFace,
  buildWisteriaRacemes,
} from '../sky_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

const FLAGSTONE_PAL = [
  0xf2e5cc, 0xe8d7b8, 0xdfc9a4, 0xf6ebd6, 0xd8bf98, 0xeadbc0,
];

function getHangarWindowTex(THREE) {
  return paintedCanvasTex(THREE, 'sr_hangar_sky_pane_v2', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#6ed4ff');
    grd.addColorStop(0.50, '#bdf0ff');
    grd.addColorStop(0.76, '#fff2c2');
    grd.addColorStop(1, '#b6dc82');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 70, ['#ffffff', '#fff8e4', '#dff6ff'], 8, 22, 0.58, 0, 0.5, 42);
    ctx.fillStyle = 'rgba(130, 196, 78, 0.80)';
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.quadraticCurveTo(s * 0.35, s * 0.70, s * 0.7, s * 0.82);
    ctx.quadraticCurveTo(s * 0.88, s * 0.74, s, s * 0.80);
    ctx.lineTo(s, s);
    ctx.closePath();
    ctx.fill();
  }, 1, 1);
}

export function buildAirshipHangar(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'airship_hangar', 3);
  if (!K.box) {
    K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  const {
    root, roofG, garden, jr, pick, tex, M, glowMat,
    add, addR, box, rbox, boxCol, wall, beam, pushInst,
    stoneQuoins,
  } = K;

  const sm = getSkyMats(THREE, K);
  const grain = gouacheGrainTex(THREE, 1.6, 1.6);

  // Pure luminous Storybook sunlit brass, bronze, timber & glow materials (100% metalness: 0!)
  // Uses neutral `gouacheGrainTex` instead of greenish `painted_metal` so golds glow warm & rich!
  const sunBrass = M(0xf6c346, grain, {
    roughness: 0.86,
    metalness: 0,
    emissive: new THREE.Color(0x4a2c04),
    emissiveIntensity: 0.22,
  });
  const warmBronze = M(0xc9862c, grain, {
    roughness: 0.88,
    metalness: 0,
    emissive: new THREE.Color(0x331b04),
    emissiveIntensity: 0.16,
  });
  const deepBronze = M(0x4a3b2c, grain, { roughness: 0.88, metalness: 0 });
  const lanternCopper = warmBronze;
  const innerStone = M(0xecdec4, tex('plaster', 1.8, 1.8), { roughness: 0.90, metalness: 0 });
  const warmTimber = M(0xd69a58, tex('wood_light', 1.6, 1.6), { roughness: 0.86, metalness: 0 });
  const ropeMat = M(0xe6c382, tex('hay', 2.2, 2.2), { roughness: 0.88, metalness: 0 });
  const amberLanternGlow = glowMat(0xffe99a, 0xff9418, 1.42, { roughness: 0.28, metalness: 0 });
  const cyanGlobeGlow = sm.cyanCrystal;
  const skyPaneMat = M(0xffffff, getHangarWindowTex(THREE), {
    roughness: 0.40,
    metalness: 0,
    emissive: new THREE.Color(0xffe49c),
    emissiveIntensity: 0.55,
  });
  const cyanPortalMat = glowMat(0x98f2ff, 0x24b4e8, 0.68, { roughness: 0.30, metalness: 0 });
  const ornithopterGlassMat = new THREE.MeshStandardMaterial({
    color: 0x6cd8ff,
    emissive: new THREE.Color(0x1b84d4),
    emissiveIntensity: 0.52,
    roughness: 0.16,
    metalness: 0,
    transparent: true,
    opacity: 0.64,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Collect all transparent glass geometries into 1 merged mesh -> 1 draw call!
  const glassGeos = [];
  const pushGlassGeo = (geo, matrix) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const cnt = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
    }
    g.applyMatrix4(matrix);
    glassGeos.push(g);
  };

  // ==========================================================================
  // 1. FLOATING ISLAND STONE PLINTH, COBBLED APRON, BOLLARDS & CARGO CRATES
  // ==========================================================================
  const plinthRes = buildMossyIslandPlinth(THREE, K, {
    w: 11.0,
    d: 9.6,
    h: 0.32,
    doorX: -0.9,
    doorZ: 4.80,
    doorW: 3.10,
    steps: 3,
    garden,
    obelisks: false,
    parent: root,
    batchPrefix: 'hgr_plinth',
  });
  const FL = plinthRes.floorY; // 0.34m

  // Lush hanging wisteria & sunlit wildflowers along the mossy island rim when `garden === true`
  if (garden) {
    buildWisteriaRacemes(THREE, K, {
      cx: -4.15,
      yTop: FL - 0.04,
      cz: 4.92,
      spanX: 1.55,
      strands: 8,
      maxLen: 1.48,
      parent: root,
      batchPrefix: 'hgr_plinth_wist',
    });
    const flwGeo = () => sharedSkyGeo(THREE, 'sr_wildflower', () => new THREE.DodecahedronGeometry(0.085, 0));
    const mossGeo = () => sharedSkyGeo(THREE, 'sr_cliff_rock', () => new THREE.DodecahedronGeometry(0.5, 1));
    for (const [mx, mz, cnt] of [[-4.55, 4.78, 8], [1.15, 4.78, 7], [3.85, 4.76, 9]]) {
      for (let i = 0; i < cnt; i++) {
        pushInst('hgr_plinth_moss', mossGeo, sm.foliageInst,
          mx + jr(-0.55, 0.55), FL + 0.03, mz + jr(-0.22, 0.22),
          jr(-0.15, 0.15), jr(0, TAU), jr(-0.15, 0.15),
          jr(0.42, 0.72), jr(0.18, 0.30), jr(0.42, 0.72),
          pick(MOSS_PAL), root);
        pushInst('hgr_plinth_flw', flwGeo, sm.foliageInst,
          mx + jr(-0.52, 0.52), FL + 0.14, mz + jr(-0.22, 0.22),
          0, jr(0, TAU), 0, jr(0.85, 1.25), jr(0.65, 0.95), jr(0.85, 1.25),
          pick(WILDFLOWER_PAL), root);
      }
    }
  }

  // Walkable Flagstone Floor Base + 3D Instanced Chiseled Flagstones (Apron + Both Rooms!)
  const floorSlab = add(box(9.88, 0.04, 8.65, sm.travertineWarm), 0, FL - 0.01, 0.26, 0, 0, 0, root);
  floorSlab.userData.ground = true;

  const paverGeo = () => sharedSkyGeo(THREE, 'sr_hangar_paver', () => new RoundedBoxGeometry(0.66, 0.032, 0.54, 0.04, 1));
  for (let gz = -3.65; gz <= 4.45; gz += 0.58) {
    const rowOff = (Math.round((gz + 4) / 0.58) % 2) * 0.34;
    for (let gx = -4.55; gx <= 4.55; gx += 0.70) {
      const px = gx + rowOff;
      if (Math.abs(px) > 4.68) continue;
      pushInst('hgr_paver', paverGeo, sm.stoneInst,
        px + jr(-0.02, 0.02), FL + jr(0.004, 0.012), gz + jr(-0.02, 0.02),
        0, jr(-0.03, 0.03), 0,
        jr(0.92, 1.05), 1.0, jr(0.92, 1.05),
        pick(FLAGSTONE_PAL), root);
    }
  }

  // Helper: Catenary Rope Swag between two 3D points
  const addRopeSwag = (pA, pB, sag = 0.20, rad = 0.026, parent = root) => {
    const vA = new THREE.Vector3(...pA);
    const vB = new THREE.Vector3(...pB);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const v = new THREE.Vector3().lerpVectors(vA, vB, t);
      v.y -= sag * 4 * t * (1 - t);
      pts.push(v);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, rad, 6, false), ropeMat), 0, 0, 0, 0, 0, 0, parent);
  };

  // Helper: Low Wooden & Brass Mooring Bollard on Cobbled Forecourt Apron (sides ONLY, center wide open!)
  const addApronBollard = (bx, bz) => {
    add(rbox(0.36, 0.14, 0.36, 0.03, sm.travertineDark, 1), bx, FL + 0.07, bz, 0, 0, 0, root);
    add(rbox(0.24, 0.54, 0.24, 0.03, sm.oakTimber, 1), bx, FL + 0.38, bz, 0, 0, 0, root);
    add(rbox(0.28, 0.065, 0.28, 0.015, sunBrass, 1), bx, FL + 0.52, bz, 0, 0, 0, root);
    add(rbox(0.30, 0.08, 0.30, 0.025, sm.darkTimber, 1), bx, FL + 0.67, bz, 0, 0, 0, root);
    const ringGeo = new THREE.TorusGeometry(0.055, 0.014, 6, 12);
    add(new THREE.Mesh(ringGeo, sunBrass), bx, FL + 0.49, bz + 0.14, 0.25, 0, 0, root);
    boxCol(bx, bz, 0.38, 0.38);
  };

  // Left & Right Forecourt Bollards + Sagging Hemp Ropes (Clear entry x ∈ [-2.50, +0.88] = 3.38m wide!)
  addApronBollard(-2.68, 4.44);
  addApronBollard(-3.82, 4.44);
  addRopeSwag([-3.82, FL + 0.52, 4.44], [-2.68, FL + 0.52, 4.44], 0.16, 0.025, root);
  addRopeSwag([-4.35, FL + 0.64, 3.85], [-3.82, FL + 0.52, 4.44], 0.14, 0.025, root);

  addApronBollard(0.98, 4.44);
  addApronBollard(2.14, 4.44);
  addRopeSwag([0.98, FL + 0.52, 4.44], [2.14, FL + 0.52, 4.44], 0.16, 0.025, root);
  addRopeSwag([2.14, FL + 0.52, 4.44], [1.62, FL + 0.68, 3.86], 0.15, 0.025, root);

  // Helper: Framed Aviation Cargo Crate & Brass-Banded Barrel
  const addCargoCrate = (cx, y0, cz, w = 0.64, h = 0.56, d = 0.60, rotY = 0, parent = root) => {
    const g = new THREE.Group();
    g.position.set(cx, y0, cz);
    g.rotation.y = rotY;
    parent.add(g);
    add(rbox(w, h, d, 0.025, warmTimber, 1), 0, h * 0.5, 0, 0, 0, 0, g);
    for (const sy of [0.05, h - 0.05]) {
      add(box(w + 0.03, 0.06, d + 0.03, sm.darkTimber), 0, sy, 0, 0, 0, 0, g);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(box(0.06, h + 0.01, 0.06, sm.darkTimber), sx * (w * 0.5 - 0.02), h * 0.5, sz * (d * 0.5 - 0.02), 0, 0, 0, g);
      add(box(0.08, 0.08, 0.08, sunBrass), sx * (w * 0.5 - 0.02), h - 0.04, sz * (d * 0.5 - 0.02), 0, 0, 0, g);
    }
    return g;
  };

  const addWoodBarrel = (bx, y0, bz, r = 0.30, h = 0.68, parent = root) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, h, 14), sm.oakTimber), bx, y0 + h * 0.5, bz, 0, 0, 0, parent);
    add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.52, 14, 1, true), warmTimber), bx, y0 + h * 0.5, bz, 0, 0, 0, parent);
    for (const [hy, hr] of [[0.10, r * 0.91], [h * 0.34, r * 1.01], [h * 0.66, r * 1.01], [h - 0.10, r * 0.91]]) {
      const hp = new THREE.TorusGeometry(hr, 0.018, 6, 16);
      hp.rotateX(PI * 0.5);
      add(new THREE.Mesh(hp, warmBronze), bx, y0 + hy, bz, 0, 0, 0, parent);
    }
  };

  // Exterior Flank Stacked Crates, Barrels & Left Stone Pedestal Cyan Sky-Lantern (`ext_03.png`)
  {
    const px = -5.06, pz = 4.28;
    add(rbox(0.68, 0.54, 0.68, 0.04, sm.travertinePlain, 1), px, FL + 0.27, pz, 0, 0, 0, root);
    add(rbox(0.76, 0.10, 0.76, 0.025, sm.travertineDark, 1), px, FL + 0.57, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.08, 10), warmBronze), px, FL + 0.66, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 10), sm.cyanCrystal), px, FL + 0.86, pz, 0, 0, 0, root);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI * 0.25;
      add(box(0.03, 0.38, 0.03, warmBronze), px + Math.cos(a) * 0.17, FL + 0.86, pz + Math.sin(a) * 0.17, 0, a, 0, root);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.20, 8), warmBronze), px, FL + 1.12, pz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), sunBrass), px, FL + 1.24, pz, 0, 0, 0, root);
    boxCol(px, pz, 0.72, 0.72);

    // Left flank stacked cargo crates (`ext_03.png` bottom-left)
    addCargoCrate(-4.48, FL, 4.18, 0.68, 0.54, 0.62, 0.08, root);
    addCargoCrate(-3.82, FL, 3.96, 0.58, 0.48, 0.56, -0.12, root);
    addCargoCrate(-4.36, FL + 0.54, 4.12, 0.54, 0.44, 0.50, 0.22, root);
    boxCol(-4.22, 4.10, 1.32, 0.72);

    // Right flank stacked crates & brass-banded barrel beside right banner pier (`ext_03.png` bottom-right)
    addCargoCrate(2.18, FL, 3.98, 0.66, 0.50, 0.58, -0.06, root);
    addCargoCrate(2.78, FL, 4.06, 0.52, 0.44, 0.50, 0.14, root);
    addWoodBarrel(5.12, FL, 1.45, 0.29, 0.66, root);
    addCargoCrate(5.10, FL, 0.58, 0.58, 0.52, 0.58, 0.12, root);
    boxCol(2.46, 4.02, 1.22, 0.64);
    boxCol(5.10, 1.02, 0.62, 1.55);
  }

  // ==========================================================================
  // 2. HOLLOW STONE & TIMBER SHELL, ARCHED WINDOWS & PARTITION ARCH (`root`)
  // ==========================================================================
  const H_ROOT = 3.16; // Strictly below 3.3m so cutaway interior (`roof.visible = false`) is 100% clean!
  const T = 0.24;

  // Back Wall (`z = -4.05`, inner face at `z = -3.81`, length 10.10m)
  wall(0, -4.05, PI, 10.10, H_ROOT, T, [
    { u: 2.25, y0: 1.24, w: 1.18, h: 1.50 },
    { u: -3.48, y0: 1.96, w: 0.88, h: 0.96 },
  ], sm.travertine, innerStone, root, true);

  // Left Wall (`x = -5.05`, centered at `z = -0.35`, length 7.40m)
  wall(-5.05, -0.35, -PI * 0.5, 7.40, H_ROOT, T, [
    { u: 1.20, y0: 1.30, w: 1.12, h: 1.36 },
  ], sm.travertine, innerStone, root, true);

  // Right Wall (`x = +5.05`, centered at `z = -0.35`, length 7.40m)
  wall(5.05, -0.35, PI * 0.5, 7.40, H_ROOT, T, [], sm.travertine, innerStone, root, true);

  // Right-Wing Front Wall (`z = +3.35`, from `x = +1.55` to `+5.05`, length 3.50m, cx = 3.30)
  wall(3.30, 3.35, 0, 3.50, H_ROOT, T, [
    { u: 0.05, y0: 0.56, w: 1.14, h: 1.76 },
  ], sm.travertine, innerStone, root, true);

  // Interior Stone Partition Wall at `x = 1.55` (`z = -3.82 .. +3.12`, length 6.94m, cz = -0.35)
  // Wide Stone Partition Archway centered at world `z = 0.20` (`u = 0.55`), clear width = 1.96m (>= 1.65m)!
  wall(1.55, -0.35, -PI * 0.5, 6.94, H_ROOT, 0.22, [
    { u: 0.55, w: 1.96, h: 2.84, door: true, arch: true },
  ], innerStone, innerStone, root, true);

  // Clean Wall-Top Moulded Cornice Cap along `y = 3.16m` (dollhouse rim in `mode=interiors`!)
  add(box(10.22, 0.08, 0.30, sm.travertineDark), 0, H_ROOT + 0.02, -3.93, 0, 0, 0, root);
  add(box(0.30, 0.08, 7.56, sm.travertineDark), -4.93, H_ROOT + 0.02, -0.35, 0, 0, 0, root);
  add(box(0.30, 0.08, 7.56, sm.travertineDark), 4.93, H_ROOT + 0.02, -0.35, 0, 0, 0, root);
  add(box(3.56, 0.08, 0.30, sm.travertineDark), 3.30, H_ROOT + 0.02, 3.23, 0, 0, 0, root);
  add(box(0.28, 0.08, 2.98, sm.travertineDark), 1.44, H_ROOT + 0.02, -2.32, 0, 0, 0, root);
  add(box(0.28, 0.08, 1.96, sm.travertineDark), 1.44, H_ROOT + 0.02, 2.15, 0, 0, 0, root);

  // 3D Instanced Ashlar Masonry Courses & Corner Quoins on Exterior Walls (below y = 3.10m!)
  buildAshlarMasonryFace(THREE, K, {
    cx: -0.35, y0: FL + 0.08, y1: 3.06, cz: -5.08,
    span: 7.0, alongZ: true, depth: 0.08, mossChance: 0.14, parent: root, batchPrefix: 'hgr_ash',
  });
  buildAshlarMasonryFace(THREE, K, {
    cx: -0.35, y0: FL + 0.08, y1: 3.06, cz: 5.08,
    span: 7.0, alongZ: true, depth: 0.08, mossChance: 0.14, parent: root, batchPrefix: 'hgr_ash',
  });
  buildAshlarMasonryFace(THREE, K, {
    cx: 0.15, y0: FL + 0.08, y1: 3.06, cz: -4.08,
    span: 3.0, alongZ: false, depth: 0.08, mossChance: 0.16, parent: root, batchPrefix: 'hgr_ash',
  });
  for (const [qx, qz] of [[-5.02, -4.02], [5.02, -4.02], [5.02, 3.32]]) {
    stoneQuoins(qx, qz, 3.08, TRAVERTINE_PAL, 0.36, 3.05);
  }

  // Sculpted Radial Stone Arch Trim around the Interior Partition Archway (`x = 1.55, z = 0.20`)
  {
    const vGeo = () => sharedSkyGeo(THREE, 'sr_voussoir', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    const archR = 1.04;
    const ySp = 1.84;
    for (let i = 0; i < 11; i++) {
      const isKey = i === 5;
      const a = -PI * 0.5 + ((i + 0.5) / 11) * PI;
      const vz = 0.20 + Math.sin(a) * archR;
      const vy = ySp + Math.cos(a) * archR;
      if (vy > 3.12) continue;
      pushInst('hgr_part_vs', vGeo, sm.stoneInst,
        1.44, vy, vz, a, 0, 0,
        0.30 * (isKey ? 1.15 : 1.0), 0.24 * (isKey ? 1.2 : 1.0), 0.30,
        isKey ? 0xf7ecd4 : pick(TRAVERTINE_PAL), root);
    }
    for (const sz of [-1, 1]) {
      add(rbox(0.32, 1.50, 0.24, 0.03, sm.travertinePlain, 1), 1.44, FL + 0.75, 0.20 + sz * 1.04, 0, 0, 0, root);
      add(rbox(0.38, 0.12, 0.30, 0.025, sm.travertineDark, 1), 1.44, ySp - 0.02, 0.20 + sz * 1.04, 0, 0, 0, root);
    }
  }

  // Interior Timber Wainscot Pilasters along Workshop Walls (`int_03.png`)
  for (const zp of [-3.65, -1.65, 0.35, 2.35]) {
    add(box(0.14, 2.78, 0.14, sm.darkTimber), -4.76, FL + 1.39, zp, 0, 0, 0, root);
    add(box(0.14, 2.78, 0.14, sm.darkTimber), 4.76, FL + 1.39, zp, 0, 0, 0, root);
  }
  add(box(0.08, 0.12, 7.20, sm.oakTimber), -4.78, FL + 1.18, -0.25, 0, 0, 0, root);
  add(box(0.08, 0.12, 7.20, sm.oakTimber), 4.78, FL + 1.18, -0.25, 0, 0, 0, root);

  // Helper: True Round-Headed Arched Multi-Pane Workshop Window (with spandrel arch mask!)
  const addArchedWorkshopWindow = ({
    cx, cy, cz, rotY = 0, w = 1.16, h = 1.48, cyanGlass = false, stoneSteps = false,
  }) => {
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = rotY;
    root.add(g);

    const archR = w * 0.5;
    const springY = h * 0.5 - archR;

    // Extruded stone arch spandrel mask filling the top square corners of the wall cutout!
    const spShape = new THREE.Shape();
    spShape.moveTo(-archR - 0.02, springY);
    spShape.lineTo(-archR - 0.02, h * 0.5 + 0.02);
    spShape.lineTo(archR + 0.02, h * 0.5 + 0.02);
    spShape.lineTo(archR + 0.02, springY);
    spShape.absarc(0, springY, archR - 0.02, 0, PI, false);
    spShape.closePath();
    const spGeo = new THREE.ExtrudeGeometry(spShape, { depth: 0.28, bevelEnabled: false, curveSegments: 14 });
    spGeo.translate(0, 0, -0.25);
    add(new THREE.Mesh(spGeo, sm.travertinePlain), 0, 0, 0, 0, 0, 0, g);

    // Glowing sky/meadow or cyan glass pane
    const paneM = cyanGlass ? cyanPortalMat : skyPaneMat;
    add(rbox(w - 0.04, h - 0.04, 0.05, 0.015, paneM, 1), 0, 0, -0.12, 0, 0, 0, g);

    // Sculpted stone jambs, sill & 3D radial arch voussoir surround (both exterior & interior faces!)
    for (const sx of [-1, 1]) {
      add(rbox(0.16, h - archR + 0.06, 0.34, 0.03, sm.travertinePlain, 1),
        sx * (w * 0.5 + 0.06), -archR * 0.5, -0.12, 0, 0, 0, g);
    }
    add(rbox(w + 0.34, 0.14, 0.40, 0.03, sm.travertineDark, 1), 0, -h * 0.5 - 0.05, -0.11, 0, 0, 0, g);

    for (const zFace of [0.03, -0.26]) {
      const archRing = new THREE.TorusGeometry(archR + 0.04, 0.085, 8, 16, PI);
      add(new THREE.Mesh(archRing, sm.travertineWarm), 0, springY, zFace, 0, 0, 0, g);
      add(rbox(0.18, 0.22, 0.10, 0.025, sunBrass, 1), 0, springY + archR + 0.06, zFace, 0, 0, 0, g);
    }

    // Dark-timber divided-light mullions & arched fanlight bars
    add(box(0.055, h - 0.06, 0.12, sm.darkTimber), 0, 0, -0.12, 0, 0, 0, g);
    for (const fy of [-0.20, 0.08]) {
      add(box(w - 0.06, 0.048, 0.12, sm.darkTimber), 0, h * fy, -0.12, 0, 0, 0, g);
    }
    const innerArch = new THREE.TorusGeometry(archR - 0.04, 0.038, 6, 14, PI);
    add(new THREE.Mesh(innerArch, sm.darkTimber), 0, springY, -0.12, 0, 0, 0, g);

    if (stoneSteps) {
      add(rbox(w + 0.48, 0.16, 0.36, 0.03, sm.travertinePlain, 1), 0, -h * 0.5 - 0.18, 0.16, 0, 0, 0, g);
      add(rbox(w + 0.64, 0.10, 0.52, 0.025, sm.travertineDark, 1), 0, -h * 0.5 - 0.29, 0.28, 0, 0, 0, g);
    }
  };

  addArchedWorkshopWindow({ cx: -2.25, cy: 1.99, cz: -4.05, rotY: PI, w: 1.18, h: 1.50 });
  addArchedWorkshopWindow({ cx: 3.48, cy: 2.44, cz: -4.05, rotY: PI, w: 0.88, h: 0.96 });
  addArchedWorkshopWindow({ cx: -5.05, cy: 1.98, cz: 0.85, rotY: -PI * 0.5, w: 1.12, h: 1.36 });
  addArchedWorkshopWindow({ cx: 3.35, cy: 1.44, cz: 3.35, rotY: 0, w: 1.14, h: 1.76, cyanGlass: true, stoneSteps: true });

  // ==========================================================================
  // 3. FRONT BUTTRESS PIERS, ROYAL-BLUE PIRATE BANNERS & FOLDED HANGAR DOORS
  // ==========================================================================
  const buildButtressPier = (px, pz, pierW = 0.82, hasTimberShaft = true) => {
    add(rbox(pierW + 0.18, 0.42, pierW + 0.18, 0.04, sm.travertineDark, 1), px, FL + 0.21, pz, 0, 0, 0, root);
    add(rbox(pierW + 0.06, 0.20, pierW + 0.06, 0.03, sunBrass, 1), px, FL + 0.50, pz, 0, 0, 0, root);
    add(rbox(pierW, 2.24, pierW, 0.04, sm.travertinePlain, 1), px, FL + 1.72, pz, 0, 0, 0, root);

    if (hasTimberShaft) {
      // Exposed riveted timber & brass pilaster post flush on front of stone pier (`fz = pz + pierW*0.5 + 0.04`)
      const fz = pz + pierW * 0.5 + 0.03;
      add(rbox(0.36, 2.52, 0.20, 0.03, sm.oakTimber, 1), px, FL + 1.66, fz, 0, 0, 0, root);
      for (const by of [FL + 0.68, FL + 2.62]) {
        add(rbox(0.44, 0.11, 0.25, 0.02, sunBrass, 1), px, by, fz, 0, 0, 0, root);
        for (const rx of [-0.13, 0, 0.13]) {
          add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), warmBronze), px + rx, by, fz + 0.13, 0, 0, 0, root);
        }
      }
    }

    // Carved capital at y = 3.16m (`root` top)
    add(rbox(pierW + 0.18, 0.20, pierW + 0.18, 0.035, sm.travertineWarm, 1), px, 3.04, pz, 0, 0, 0, root);
    add(rbox(pierW + 0.26, 0.12, pierW + 0.26, 0.03, sunBrass, 1), px, 3.18, pz, 0, 0, 0, root);
    boxCol(px, pz, pierW + 0.12, pierW + 0.16);
  };

  buildButtressPier(-4.58, 3.44, 0.84, true); // Front-left banner pier (timber front at z = 3.99)
  buildButtressPier(1.50, 3.44, 0.82, true);  // Front-center banner pier (timber front at z = 3.98)
  buildButtressPier(4.86, 3.38, 0.70, true);  // Front-right corner pier

  // Sculpted Pointed-Shield Royal-Blue Winged Sky-Pirate Banners (`sm.pirateBanner`) HUNG CLEANLY IN FRONT OF PIERS (`bz = 4.10`)!
  const buildPirateShieldBanner = (bx, yTop, bz, bw = 1.18, rectH = 1.00, tipH = 0.50) => {
    const g = new THREE.Group();
    g.position.set(bx, yTop, bz);
    root.add(g);

    // Brass crossbar rod + turned finials + wall brackets reaching back to pier
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, bw + 0.40, 10), sunBrass), 0, 0.04, 0, 0, 0, PI * 0.5, g);
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 6), sunBrass), sx * (bw * 0.5 + 0.23), 0.04, 0, 0, 0, 0, g);
      add(box(0.06, 0.06, 0.24, warmBronze), sx * (bw * 0.36), 0.04, -0.11, 0, 0, 0, g);
      const ring = new THREE.TorusGeometry(0.045, 0.014, 6, 10);
      add(new THREE.Mesh(ring, sunBrass), sx * (bw * 0.36), 0.02, 0.01, 0, PI * 0.5, 0, g);
    }

    // Subdivided gently-billowing V-pointed shield cloth mesh mapped cleanly to `sm.pirateBanner`!
    const cols = 8, rows = 10;
    const totalH = rectH + tipH;
    const pos = [], uvs = [], idx = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const x = (u - 0.5) * bw;
        const edgeDist = Math.abs(u - 0.5) * 2;
        const colMaxY = rectH + (1 - edgeDist) * tipH;
        const y = -v * colMaxY;
        const waveZ = Math.sin(v * PI) * 0.055 + Math.cos(u * PI * 2) * 0.014;
        pos.push(x, y, waveZ);
        uvs.push(0.08 + u * 0.84, 1.0 - (Math.abs(y) / totalH) * 0.86 - 0.07);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + 1;
        const d = a + (cols + 1);
        const e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bGeo.setIndex(idx);
    bGeo.computeVertexNormals();
    add(new THREE.Mesh(bGeo, sm.pirateBanner), 0, 0, 0.02, 0, 0, 0, g);

    // Crisp 3D golden-brass V-point border trim & bottom tassel finial
    for (const sx of [-1, 1]) {
      beam([sx * bw * 0.5, 0, 0.03], [sx * bw * 0.5, -rectH, 0.04], 0.036, sunBrass, g);
      beam([sx * bw * 0.5, -rectH, 0.04], [0, -(rectH + tipH), 0.03], 0.038, sunBrass, g);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), sunBrass), 0, -(rectH + tipH + 0.05), 0.03, PI, 0, 0, g);
  };

  buildPirateShieldBanner(-4.58, 2.74, 4.10, 1.18, 1.00, 0.48);
  buildPirateShieldBanner(1.50, 2.74, 4.10, 1.18, 1.00, 0.48);

  // Heavy Accordion-Folded Cross-Braced Timber Hangar Doors on Left Jamb (`ext_03.png`)
  const buildHangarDoorLeaf = (dx, dz, rotY, leafW = 0.80, leafH = 2.64) => {
    const g = new THREE.Group();
    g.position.set(dx, FL, dz);
    g.rotation.y = rotY;
    root.add(g);

    const nPlanks = 4, pw = leafW / nPlanks;
    for (let i = 0; i < nPlanks; i++) {
      const lx = -leafW * 0.5 + (i + 0.5) * pw;
      const ph = leafH - (1 - (i + 0.5) / nPlanks) * 0.16;
      add(rbox(pw - 0.014, ph, 0.09, 0.015, i % 2 === 0 ? sm.oakTimber : warmTimber, 1), lx, ph * 0.5, 0, 0, 0, 0, g);
    }
    for (const ry of [0.16, leafH * 0.48, leafH - 0.22]) {
      add(box(leafW + 0.02, 0.11, 0.13, sm.darkTimber), 0, ry, 0, 0, 0, 0, g);
    }
    beam([-leafW * 0.44, 0.22, 0.055], [leafW * 0.44, leafH * 0.44, 0.055], 0.065, sm.darkTimber, g);
    beam([leafW * 0.44, 0.22, 0.055], [-leafW * 0.44, leafH * 0.44, 0.055], 0.065, sm.darkTimber, g);
    beam([-leafW * 0.44, leafH * 0.52, 0.055], [leafW * 0.44, leafH - 0.26, 0.055], 0.065, sm.darkTimber, g);
    beam([leafW * 0.44, leafH * 0.52, 0.055], [-leafW * 0.44, leafH - 0.26, 0.055], 0.065, sm.darkTimber, g);

    for (const hy of [0.38, leafH * 0.50, leafH - 0.36]) {
      add(box(leafW * 0.72, 0.065, 0.145, deepBronze), -leafW * 0.10, hy, 0, 0, 0, 0, g);
      for (const rx of [-0.28, -0.06, 0.14]) {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), sunBrass), rx * leafW, hy, 0.08, 0, 0, 0, g);
      }
    }
    const pullRing = new THREE.TorusGeometry(0.065, 0.015, 6, 12);
    add(new THREE.Mesh(pullRing, sunBrass), leafW * 0.32, 1.12, 0.09, 0.2, 0, 0, g);
  };

  buildHangarDoorLeaf(-3.82, 3.42, 0.22, 0.84, 2.66);
  buildHangarDoorLeaf(-2.96, 3.30, -0.34, 0.82, 2.74);
  boxCol(-3.38, 3.36, 1.62, 0.54);

  // ==========================================================================
  // 4. GRAND BARREL-VAULT ARCHES, ANCHOR MEDALLION, VAULT SKY-GLOBE, STRETCHED
  //    GOLDEN CANVAS CANOPY & SPINNING WEATHER MAST (ALL IN `K.roofG`!)
  // ==========================================================================
  const ARCH_CX = -1.54;
  const ARCH_CY = 1.38;
  const ARCH_R = 2.46;

  // 4a. Grand Front Radial Voussoir Stone & Riveted-Timber Hangar Arch (`ext_03.png`)
  {
    // Solid stone arch barrel core so mortar joints between 3D voussoirs are 100% solid (zero gaps!)
    const archCoreShape = new THREE.Shape();
    const a0 = -PI * 0.45, a1 = PI * 0.45;
    for (let i = 0; i <= 28; i++) {
      const a = a0 + (i / 28) * (a1 - a0);
      const x = ARCH_CX + Math.sin(a) * (ARCH_R + 0.60);
      const y = Math.max(2.22, ARCH_CY + Math.cos(a) * (ARCH_R + 0.60));
      if (i === 0) archCoreShape.moveTo(x, y); else archCoreShape.lineTo(x, y);
    }
    for (let i = 28; i >= 0; i--) {
      const a = a0 + (i / 28) * (a1 - a0);
      const x = ARCH_CX + Math.sin(a) * (ARCH_R + 0.04);
      const y = Math.max(2.22, ARCH_CY + Math.cos(a) * (ARCH_R + 0.04));
      archCoreShape.lineTo(x, y);
    }
    archCoreShape.closePath();
    addR(new THREE.Mesh(new THREE.ExtrudeGeometry(archCoreShape, { depth: 0.66, bevelEnabled: false }), sm.travertineDark), 0, 0, 3.20);

    const vGeo = () => sharedSkyGeo(THREE, 'sr_voussoir', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    const nSeg = 21;
    const rMid = ARCH_R + 0.32;
    const spanAng = PI * 0.92;
    const segArcW = (spanAng * (rMid + 0.20)) / nSeg * 0.96;
    for (let i = 0; i < nSeg; i++) {
      const a = -spanAng * 0.5 + ((i + 0.5) / nSeg) * spanAng;
      const vx = ARCH_CX + Math.sin(a) * rMid;
      const vy = ARCH_CY + Math.cos(a) * rMid;
      if (vy < 2.25) continue;
      const isKey = i === Math.floor(nSeg * 0.5);
      pushInst('hgr_main_vs', vGeo, sm.stoneInst,
        vx, vy, 3.56, 0, 0, -a,
        segArcW, isKey ? 0.60 : 0.54, isKey ? 0.76 : 0.70,
        isKey ? 0xf8eed8 : pick(TRAVERTINE_PAL), roofG);
    }

    // Riveted oak-and-brass intrados & extrados arch bands flush on the front face (`z = 3.86`)
    const innerRim = new THREE.TorusGeometry(ARCH_R + 0.03, 0.085, 8, 30, PI * 0.90);
    addR(new THREE.Mesh(innerRim, sm.oakTimber), ARCH_CX, ARCH_CY, 3.86, 0, 0, PI * 0.05);
    const outerRim = new THREE.TorusGeometry(ARCH_R + 0.61, 0.075, 8, 32, PI * 0.90);
    addR(new THREE.Mesh(outerRim, sunBrass), ARCH_CX, ARCH_CY, 3.86, 0, 0, PI * 0.05);

    const rivetGeo = () => sharedSkyGeo(THREE, 'sr_brass_rivet', () => new THREE.SphereGeometry(0.036, 7, 5));
    for (let i = 1; i < 16; i++) {
      const a = -PI * 0.42 + (i / 16) * (PI * 0.84);
      pushInst('hgr_rivet', rivetGeo, sm.stoneInst,
        ARCH_CX + Math.sin(a) * (ARCH_R + 0.04),
        ARCH_CY + Math.cos(a) * (ARCH_R + 0.04),
        3.94, 0, 0, 0, 1, 1, 1, 0xf8cc58, roofG);
    }

    // Round Dark-Bronze & Gold ANCHOR MEDALLION at the Keystone (`y = 3.68m`, matches `ext_03.png`!)
    const mx = ARCH_CX, my = 3.68, mz = 3.96;
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.57, 0.16, 24), sunBrass), mx, my, mz - 0.04, PI * 0.5, 0, 0);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 24), deepBronze), mx, my, mz + 0.02, PI * 0.5, 0, 0);
    addR(new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.058, 8, 26), sunBrass), mx, my, mz + 0.07);

    // 3D Sculpted Golden Anchor Relief on Medallion Face
    addR(new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.024, 7, 16), sunBrass), mx, my + 0.25, mz + 0.10);
    addR(rbox(0.28, 0.05, 0.05, 0.012, sunBrass, 1), mx, my + 0.14, mz + 0.10);
    for (const sx of [-1, 1]) {
      addR(new THREE.Mesh(new THREE.SphereGeometry(0.034, 7, 5), sunBrass), mx + sx * 0.15, my + 0.14, mz + 0.10);
    }
    addR(rbox(0.06, 0.40, 0.055, 0.014, sunBrass, 1), mx, my - 0.02, mz + 0.10);
    const flukeArc = new THREE.TorusGeometry(0.21, 0.038, 7, 18, PI * 0.82);
    addR(new THREE.Mesh(flukeArc, sunBrass), mx, my - 0.03, mz + 0.10, 0, 0, PI + PI * 0.09);
    for (const sx of [-1, 1]) {
      addR(new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.13, 4), sunBrass),
        mx + sx * 0.205, my - 0.06, mz + 0.10, 0, 0, -sx * 0.32);
    }
    addR(rbox(0.32, 0.22, 0.30, 0.03, sm.travertinePlain, 1), mx, my + 0.62, mz - 0.04);
    addR(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), sunBrass), mx, my + 0.80, mz - 0.04);
    addR(new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 8), sunBrass), mx, my + 0.96, mz - 0.04);

    // Vault-Hung Glowing Cyan Celestial Navigation Armillary Globe + Twin Flanking Amber Lanterns (`ext_03.png`!)
    const gx = -1.48, gy = 2.48, gz = 1.65;
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.32, 8), warmBronze), gx, 3.22, gz);
    addR(new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 12), cyanGlobeGlow), gx, gy, gz);
    for (const [rx, ry, rz] of [[0, 0, 0], [0, PI * 0.5, 0], [PI * 0.5, 0, 0.18]]) {
      addR(new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.024, 7, 24), sunBrass), gx, gy, gz, rx, ry, rz);
    }
    addR(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), sunBrass), gx, gy - 0.54, gz, PI, 0, 0);

    for (const lx of [-2.42, -0.52]) {
      addR(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.68, 6), warmBronze), lx, 2.98, 2.38);
      addR(new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.15, 8), lanternCopper), lx, 2.64, 2.38);
      addR(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.115, 0.30, 10), amberLanternGlow), lx, 2.44, 2.38);
      addR(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.07, 0.07, 8), lanternCopper), lx, 2.26, 2.38);
    }
  }

  // 4b. Secondary Right-Wing Radial Voussoir Stone Arch + Front Upper Spandrel (`rigging_loft`)
  const R_ARCH_CX = 3.26;
  const R_ARCH_CY = 2.02;
  const R_ARCH_R = 1.48;
  {
    const vGeo = () => sharedSkyGeo(THREE, 'sr_voussoir', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
    const nSeg = 15;
    const rMid = R_ARCH_R + 0.22;
    const segW = (PI * 0.90 * rMid) / nSeg * 1.04;
    for (let i = 0; i < nSeg; i++) {
      const a = -PI * 0.45 + ((i + 0.5) / nSeg) * (PI * 0.90);
      const vx = R_ARCH_CX + Math.sin(a) * rMid;
      const vy = R_ARCH_CY + Math.cos(a) * rMid;
      if (vy < 3.08) continue;
      const isKey = i === 7;
      pushInst('hgr_right_vs', vGeo, sm.stoneInst,
        vx, vy, 3.34, 0, 0, -a,
        segW, isKey ? 0.48 : 0.42, 0.52,
        isKey ? 0xf8eed8 : pick(TRAVERTINE_PAL), roofG);
    }

    // Solid stone front spandrel & arch backing between `y = 3.16m` and right vault arch (`roofG`)!
    const fTym = new THREE.Shape();
    for (let i = 0; i <= 16; i++) {
      const a = -0.92 + (i / 16) * 1.84;
      const tx = R_ARCH_CX + Math.sin(a) * (R_ARCH_R + 0.24);
      const ty = Math.max(3.12, R_ARCH_CY + Math.cos(a) * (R_ARCH_R + 0.24));
      if (i === 0) fTym.moveTo(tx, 3.12);
      fTym.lineTo(tx, ty);
    }
    fTym.lineTo(R_ARCH_CX - Math.sin(0.92) * (R_ARCH_R + 0.24), 3.12);
    addR(new THREE.Mesh(new THREE.ExtrudeGeometry(fTym, { depth: 0.36, bevelEnabled: false }), sm.travertineDark), 0, 0, 3.14);
  }

  // 4c. Dual Stone & Ribbed-Timber Barrel Vault Shells + Back Tympanum Closures (`K.roofG`)
  {
    const mainVaultGeo = new THREE.CylinderGeometry(
      ARCH_R + 0.22, ARCH_R + 0.22, 7.62, 22, 1, true, -PI * 0.38, PI * 0.76
    );
    mainVaultGeo.rotateZ(PI * 0.5);
    mainVaultGeo.rotateY(PI * 0.5);
    addR(new THREE.Mesh(mainVaultGeo, sm.oakTimber), ARCH_CX, ARCH_CY, -0.35);

    const mainOuterShell = new THREE.CylinderGeometry(
      ARCH_R + 0.34, ARCH_R + 0.34, 7.56, 22, 1, true, -PI * 0.38, PI * 0.76
    );
    mainOuterShell.rotateZ(PI * 0.5);
    mainOuterShell.rotateY(PI * 0.5);
    addR(new THREE.Mesh(mainOuterShell, sm.travertineWarm), ARCH_CX, ARCH_CY, -0.35);

    for (const zr of [-3.4, -1.8, -0.2, 1.4, 2.9]) {
      const ribGeo = new THREE.TorusGeometry(ARCH_R + 0.12, 0.085, 7, 22, PI * 0.74);
      addR(new THREE.Mesh(ribGeo, sm.darkTimber), ARCH_CX, ARCH_CY, zr, 0, 0, PI * 0.13);
    }
    for (const a of [-0.52, -0.26, 0, 0.26, 0.52]) {
      addR(box(0.11, 0.11, 7.52, sm.darkTimber),
        ARCH_CX + Math.sin(a) * (ARCH_R + 0.14),
        ARCH_CY + Math.cos(a) * (ARCH_R + 0.14),
        -0.35, 0, 0, -a);
    }

    const tymShape = new THREE.Shape();
    for (let i = 0; i <= 18; i++) {
      const a = -0.82 + (i / 18) * 1.64;
      const tx = ARCH_CX + Math.sin(a) * (ARCH_R + 0.26);
      const ty = Math.max(3.14, ARCH_CY + Math.cos(a) * (ARCH_R + 0.26));
      if (i === 0) tymShape.moveTo(tx, 3.14);
      tymShape.lineTo(tx, ty);
    }
    tymShape.lineTo(ARCH_CX - Math.sin(0.82) * (ARCH_R + 0.26), 3.14);
    addR(new THREE.Mesh(new THREE.ExtrudeGeometry(tymShape, { depth: 0.22, bevelEnabled: false }), sm.travertinePlain), 0, 0, -4.08);

    const rightVaultGeo = new THREE.CylinderGeometry(
      R_ARCH_R + 0.16, R_ARCH_R + 0.16, 7.48, 16, 1, true, -PI * 0.38, PI * 0.76
    );
    rightVaultGeo.rotateZ(PI * 0.5);
    rightVaultGeo.rotateY(PI * 0.5);
    addR(new THREE.Mesh(rightVaultGeo, sm.travertineWarm), R_ARCH_CX, R_ARCH_CY, -0.35);

    for (const zr of [-3.3, -1.1, 1.1, 3.1]) {
      const rRib = new THREE.TorusGeometry(R_ARCH_R + 0.08, 0.075, 6, 16, PI * 0.68);
      addR(new THREE.Mesh(rRib, sm.darkTimber), R_ARCH_CX, R_ARCH_CY, zr, 0, 0, PI * 0.16);
    }

    const rTym = new THREE.Shape();
    for (let i = 0; i <= 14; i++) {
      const a = -0.80 + (i / 14) * 1.60;
      const tx = R_ARCH_CX + Math.sin(a) * (R_ARCH_R + 0.18);
      const ty = Math.max(3.14, R_ARCH_CY + Math.cos(a) * (R_ARCH_R + 0.18));
      if (i === 0) rTym.moveTo(tx, 3.14);
      rTym.lineTo(tx, ty);
    }
    rTym.lineTo(R_ARCH_CX - Math.sin(0.80) * (R_ARCH_R + 0.18), 3.14);
    addR(new THREE.Mesh(new THREE.ExtrudeGeometry(rTym, { depth: 0.22, bevelEnabled: false }), sm.travertinePlain), 0, 0, -4.08);
  }

  // 4d. Multi-Peaked Golden-Ochre Stretched Airship Canvas Tent Canopy (`sm.canopyCanvas`, in `K.roofG`)!
  const buildDrapedTentSail = (p00, p10, p11, p01, sag = 0.34) => {
    const segU = 9, segV = 9;
    const v00 = new THREE.Vector3(...p00);
    const v10 = new THREE.Vector3(...p10);
    const v11 = new THREE.Vector3(...p11);
    const v01 = new THREE.Vector3(...p01);

    const pos = [], uvs = [], idx = [];
    const top = new THREE.Vector3(), bot = new THREE.Vector3(), pt = new THREE.Vector3();
    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      for (let iu = 0; iu <= segU; iu++) {
        const u = iu / segU;
        top.lerpVectors(v00, v10, u);
        bot.lerpVectors(v01, v11, u);
        pt.lerpVectors(top, bot, v);
        const belly = 4 * u * (1 - u) * 0.42 + 4 * v * (1 - v) * 0.58;
        pt.y -= sag * belly;
        pos.push(pt.x, pt.y, pt.z);
        uvs.push(u, v);
      }
    }
    for (let iv = 0; iv < segV; iv++) {
      for (let iu = 0; iu < segU; iu++) {
        const a = iv * (segU + 1) + iu;
        const b = a + 1;
        const c = a + (segU + 1);
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    addR(new THREE.Mesh(g, sm.canopyCanvas), 0, 0, 0);

    addRopeSwag(p01, p11, sag * 0.42, 0.032, roofG);
  };

  const addCanopyPeakPole = (px, yBase, yTop, pz, r = 0.095) => {
    const h = yTop - yBase;
    addR(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 10), sm.oakTimber), px, yBase + h * 0.5, pz);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.15, 0.12, 10), sunBrass), px, yTop - 0.04, pz);
    addR(new THREE.Mesh(new THREE.SphereGeometry(r * 1.32, 10, 8), sunBrass), px, yTop + 0.10, pz);
    addR(new THREE.Mesh(new THREE.ConeGeometry(r * 0.78, 0.24, 8), sunBrass), px, yTop + 0.28, pz);
  };

  {
    const P_FL = [-2.68, 5.26, 1.55];
    const P_FC = [0.08, 5.48, 1.15];
    const P_BL = [-2.58, 5.16, -2.05];
    const P_BC = [0.12, 5.38, -1.95];
    const P_RM = [2.62, 5.12, 0.42]; // Right-side weather mast canopy peak

    const E_FLC = [-5.42, 4.08, 3.88];
    const E_ML  = [-5.52, 3.96, -0.25];
    const E_BLC = [-5.42, 4.04, -4.18];

    const E_FA1 = [-3.65, 4.18, 4.12];
    const E_FA2 = [-1.54, 4.44, 4.18];
    const E_FA3 = [0.68, 4.08, 4.12];
    const E_FA4 = [1.85, 3.84, 4.08];
    const E_FRC = [5.38, 3.82, 3.68];
    const E_MR  = [5.48, 3.92, -0.15];
    const E_BRC = [5.38, 3.82, -4.12];

    const E_BA1 = [-3.35, 4.04, -4.28];
    const E_BA2 = [-0.65, 4.16, -4.32];
    const E_BA3 = [2.35, 3.98, -4.24];

    addCanopyPeakPole(P_FL[0], 3.82, P_FL[1], P_FL[2], 0.095);
    addCanopyPeakPole(P_FC[0], 3.76, P_FC[1], P_FC[2], 0.105);
    addCanopyPeakPole(P_BL[0], 3.80, P_BL[1], P_BL[2], 0.095);
    addCanopyPeakPole(P_BC[0], 3.74, P_BC[1], P_BC[2], 0.10);

    for (const [ex, ey, ez] of [E_FLC, E_BLC, E_FRC, E_BRC, E_MR]) {
      addCanopyPeakPole(ex * 0.92, 3.26, ey + 0.34, ez * 0.94, 0.075);
    }
    addR(rbox(1.55, 0.14, 0.14, 0.03, sm.oakTimber, 1), -4.92, 3.36, 3.92);
    addR(rbox(2.55, 0.14, 0.14, 0.03, sm.oakTimber, 1), 2.38, 3.36, 3.92);
    addR(rbox(1.45, 0.14, 0.14, 0.03, sm.oakTimber, 1), 5.06, 3.34, 3.42);
    for (const [bx, bz] of [[-5.68, 3.92], [1.12, 3.92], [3.64, 3.92], [5.76, 3.42]]) {
      addR(new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), sunBrass), bx, 3.36, bz);
    }

    buildDrapedTentSail(P_FL, P_FC, E_FA2, E_FA1, 0.28);
    buildDrapedTentSail(P_FL, P_FL, E_FA1, E_FLC, 0.26);
    buildDrapedTentSail(P_FC, P_RM, E_FA4, E_FA3, 0.34);
    buildDrapedTentSail(P_FC, P_FC, E_FA3, E_FA2, 0.24);
    buildDrapedTentSail(P_RM, P_RM, E_FRC, E_FA4, 0.30);

    buildDrapedTentSail(P_BL, P_BC, P_FC, P_FL, 0.28);
    buildDrapedTentSail(P_BC, P_RM, P_RM, P_FC, 0.26);

    buildDrapedTentSail(P_BL, P_FL, E_FLC, E_ML, 0.32);
    buildDrapedTentSail(P_BL, P_BL, E_ML, E_BLC, 0.28);

    buildDrapedTentSail(P_RM, P_RM, E_MR, E_FRC, 0.30);
    buildDrapedTentSail(P_BC, P_RM, E_BRC, E_MR, 0.32);

    buildDrapedTentSail(P_BL, P_BC, E_BA2, E_BA1, 0.30);
    buildDrapedTentSail(P_BL, P_BL, E_BA1, E_BLC, 0.26);
    buildDrapedTentSail(P_BC, P_RM, E_BRC, E_BA3, 0.30);
    buildDrapedTentSail(P_BC, P_BC, E_BA3, E_BA2, 0.26);

    const lift = (p, dy = 0.08) => [p[0], p[1] + dy, p[2]];
    addRopeSwag(lift(P_FL), lift(P_FC), 0.20, 0.024, roofG);
    addRopeSwag(lift(P_FC), lift(P_RM, 0.42), 0.22, 0.024, roofG);
    addRopeSwag(lift(P_BL), lift(P_BC), 0.18, 0.024, roofG);
    addRopeSwag(lift(P_FL), lift(P_BL), 0.20, 0.024, roofG);
    addRopeSwag(lift(P_FC), lift(P_BC), 0.20, 0.024, roofG);
    addRopeSwag(lift(P_FL), [E_FLC[0] * 0.92, E_FLC[1] + 0.36, E_FLC[2] * 0.94], 0.22, 0.022, roofG);
    addRopeSwag(lift(P_RM, 0.42), [E_FRC[0] * 0.92, E_FRC[1] + 0.36, E_FRC[2] * 0.94], 0.22, 0.022, roofG);
    addRopeSwag(lift(P_RM, 0.42), [E_MR[0] * 0.92, E_MR[1] + 0.36, E_MR[2] * 0.94], 0.20, 0.022, roofG);
  }

  // 4e. Tall Right-Side Wooden Weather Mast + Spinning 6-Blade Brass Wind-Vane (`hangarWindvane`)!
  let windvaneYawGrp = null;
  let windvaneGrp = null;
  {
    const mx = 2.62, mz = 0.42;
    addR(rbox(0.40, 2.38, 0.40, 0.035, sm.oakTimber, 1), mx, 4.45, mz);
    for (const sx of [-1, 1]) {
      beam([mx + sx * 0.68, 3.52, mz], [mx + sx * 0.18, 4.42, mz], 0.085, sm.darkTimber, roofG);
    }
    for (const by of [3.92, 4.78, 5.42]) {
      addR(rbox(0.46, 0.085, 0.46, 0.02, warmBronze, 1), mx, by, mz);
    }
    addR(rbox(0.66, 0.16, 0.66, 0.03, sm.oakTimber, 1), mx, 5.62, mz);
    addR(rbox(0.72, 0.08, 0.72, 0.02, sunBrass, 1), mx, 5.74, mz);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.20, 10), warmBronze), mx, 5.86, mz);

    windvaneYawGrp = new THREE.Group();
    windvaneYawGrp.name = 'windvane';
    windvaneYawGrp.position.set(mx, 5.95, mz);
    windvaneYawGrp.rotation.y = -0.48; // Angled into sky-breeze so all 6 fan blades gleam in 3/4 view!
    windvaneYawGrp.userData.keep = true;
    roofG.add(windvaneYawGrp);

    windvaneGrp = new THREE.Group();
    windvaneGrp.name = 'hangarWindvane';
    windvaneGrp.userData.keep = true;
    windvaneYawGrp.add(windvaneGrp);
    root.userData.windvane = windvaneGrp;

    // Vertical turned brass spindle post (`y = 0 .. 1.24m`)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.065, 1.20, 10), sunBrass), 0, 0.60, 0, 0, 0, 0, windvaneGrp);
    for (const sy of [0.14, 0.46, 0.88, 1.14]) {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.092, 9, 7), sunBrass), 0, sy, 0, 0, 0, 0, windvaneGrp);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.22, 8), sunBrass), 0, 1.30, 0, 0, 0, 0, windvaneGrp);

    const addWeatherArrow = (ay, leftReach, rightReach) => {
      const len = rightReach - leftReach;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, len, 8), sunBrass),
        (leftReach + rightReach) * 0.5, ay, 0, 0, 0, PI * 0.5, windvaneGrp);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.24, 6), sunBrass), leftReach - 0.08, ay, 0, 0, 0, PI * 0.5, windvaneGrp);
      for (const sy of [-1, 1]) {
        add(rbox(0.32, 0.11, 0.024, 0.008, warmBronze, 1), leftReach + 0.22, ay + sy * 0.075, 0, 0, 0, sy * 0.28, windvaneGrp);
      }
    };

    addWeatherArrow(0.46, -1.22, 0.14);
    addWeatherArrow(0.88, -1.42, 0.96);

    // 6-Blade Golden-Brass Wind-Vane Propeller radiating in full 360° fan wheel (`ext_03.png` & `int_03.png`)!
    const hubX = 0.98, hubY = 0.88;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.18, 12), warmBronze), hubX, hubY, 0, 0, 0, PI * 0.5, windvaneGrp);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), sunBrass), hubX + 0.10, hubY, 0, 0, 0, 0, windvaneGrp);

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.048, 0.10);
    bladeShape.lineTo(0.048, 0.10);
    bladeShape.lineTo(0.155, 0.78);
    bladeShape.lineTo(-0.155, 0.78);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
    bladeGeo.translate(0, 0, -0.014);

    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * TAU + 0.22;
      const bHolder = new THREE.Group();
      bHolder.position.set(hubX + 0.02, hubY, 0);
      bHolder.rotation.x = ang;
      windvaneGrp.add(bHolder);
      // Blade extends along +Y in bHolder => sweeps radial YZ fan wheel perpendicular to the X boom!
      add(new THREE.Mesh(bladeGeo, b % 2 === 0 ? sunBrass : warmBronze), 0, 0, 0, 0, 0.36, 0, bHolder);
    }
  }

  // ==========================================================================
  // 5. ROOM 1 (`ornithopter_bay`): CENTERPIECE BRASS, GLASS & PARCHMENT-WING
  //    STORYBOOK ORNITHOPTER (`ORNITHOPTER`), BACK-WALL 4-BLADE PROPELLER & WORKSHOP
  // ==========================================================================

  // Helper: Warm Glowing Amber Workshop Cage Lantern (wall-bracketed below y = 2.7m!)
  const addAmberWallLantern = (wx, wy, wz, armDirX = 0, armDirZ = 0) => {
    const g = new THREE.Group();
    g.position.set(wx, wy, wz);
    root.add(g);

    if (armDirX || armDirZ) {
      beam([0, 0.24, 0], [-armDirX * 0.36, 0.34, -armDirZ * 0.36], 0.048, lanternCopper, g);
      beam([-armDirX * 0.36, 0.12, -armDirZ * 0.36], [0, 0.24, 0], 0.034, lanternCopper, g);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.20, 6), sunBrass), 0, 0.16, 0, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.15, 8), lanternCopper), 0, 0.05, 0, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 12), sunBrass), 0, -0.01, 0, PI * 0.5, 0, 0, g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.12, 0.30, 10), amberLanternGlow), 0, -0.14, 0, 0, 0, 0, g);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      add(box(0.022, 0.32, 0.022, lanternCopper), Math.cos(a) * 0.15, -0.14, Math.sin(a) * 0.15, 0, a, 0, g);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.075, 0.075, 8), lanternCopper), 0, -0.31, 0, 0, 0, 0, g);
  };

  addAmberWallLantern(-4.38, 2.38, -1.85, 1, 0);
  addAmberWallLantern(-3.62, 2.48, 2.72, 1, -0.4);
  addAmberWallLantern(1.06, 2.48, 2.52, -1, 0);
  addAmberWallLantern(4.38, 2.22, 0.18, -1, 0);

  // Hanging herb/rigging bundles on upper-left wall (`int_03.png` upper-left!)
  for (const hz of [2.15, 1.72]) {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 7), sm.mossGreen), -4.68, 2.34, hz, PI, 0, 0.08, root);
  }

  // 5a. Large 4-Blade Golden-Brass Propeller Mounted Proudly IN FRONT of Back Wall (`z = -3.72`, `int_03.png`!)
  {
    const px = -0.32, py = 2.22, pz = -3.72; // Inner wall face is at z = -3.81!
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.08, 16), sm.darkTimber), px, py, -3.78, PI * 0.5, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 14), warmBronze), px, py, pz, PI * 0.5, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), sunBrass), px, py, pz + 0.07, 0, 0, 0, root);

    const pShape = new THREE.Shape();
    pShape.moveTo(-0.048, 0.12);
    pShape.quadraticCurveTo(0.15, 0.48, 0.12, 0.88);
    pShape.lineTo(-0.12, 0.88);
    pShape.quadraticCurveTo(-0.15, 0.48, -0.048, 0.12);
    const pBladeGeo = new THREE.ExtrudeGeometry(pShape, {
      depth: 0.032, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1,
    });
    pBladeGeo.translate(0, 0, -0.016);

    for (let i = 0; i < 4; i++) {
      const a = PI * 0.25 + (i / 4) * TAU; // Crisp symmetric 4-blade X!
      const bh = new THREE.Group();
      bh.position.set(px, py, pz + 0.02);
      bh.rotation.z = a;
      root.add(bh);
      // Pitch around local Y (blade radial axis!) so ALL 4 blades stay parallel to the wall!
      add(new THREE.Mesh(pBladeGeo, sunBrass), 0, 0, 0, 0, 0.26, 0, bh);
    }
  }

  // 5b. Centerpiece Parked Storybook Ornithopter (`Ornithopter`) on Wooden Cradle Trestles (`int_03.png`!)
  // Oriented with twin golden-brass noses pointing front-left (`fRot = -0.56`) just like `int_03.png`!
  {
    const fx = -2.14, fz = -0.88, fRot = -0.56;
    const flapG = new THREE.Group();
    flapG.position.set(fx, FL, fz);
    flapG.rotation.y = fRot;
    root.add(flapG);

    // 1) Wooden & Brass Wheeled Drydock Cradle Trestle
    for (const sz of [-0.52, 0.52]) {
      add(rbox(1.42, 0.11, 0.12, 0.02, sm.darkTimber, 1), 0, 0.16, sz, 0, 0, 0, flapG);
      add(rbox(1.36, 0.14, 0.14, 0.03, warmTimber, 1), 0, 0.52, sz, 0, 0, 0, flapG);
      for (const sx of [-0.52, 0, 0.52]) {
        beam([sx, 0.16, sz], [sx * 0.92, 0.52, sz], 0.09, sm.oakTimber, flapG);
      }
      for (const sx of [-0.58, 0.58]) {
        const wGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12);
        wGeo.rotateZ(PI * 0.5);
        add(new THREE.Mesh(wGeo, warmBronze), sx, 0.11, sz + (sz > 0 ? 0.09 : -0.09), 0, 0, 0, flapG);
      }
    }
    for (const sx of [-0.52, 0.52]) {
      add(rbox(0.10, 0.10, 1.16, 0.02, sm.darkTimber, 1), sx, 0.16, 0, 0, 0, 0, flapG);
    }

    // 2) Twin Streamlined Brass-Ribbed & Cyan-Glass Torpedo Nacelles (`int_03.png`!)
    flapG.updateMatrixWorld(true);
    for (const podSide of [-1, 1]) {
      const px = podSide * 0.39;
      const py = 0.84;

      const coreGeo = new THREE.SphereGeometry(0.28, 14, 10);
      coreGeo.scale(0.95, 0.92, 2.45);
      add(new THREE.Mesh(coreGeo, sm.cyanSoft), px, py, 0.05, 0, 0, 0, flapG);

      const podGlassGeo = new THREE.SphereGeometry(0.33, 14, 10);
      podGlassGeo.scale(1.0, 0.96, 2.65);
      const mLocal = new THREE.Matrix4().makeTranslation(px, py, 0.05);
      const mRoot = new THREE.Matrix4().makeRotationY(fRot).setPosition(fx, FL, fz).multiply(mLocal);
      pushGlassGeo(podGlassGeo, mRoot);

      // Conical golden-brass nose cone & spinner tip (+Z front of Ornithopter)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.46, 14), sunBrass), px, py, 0.98, PI * 0.5, 0, 0, flapG);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.078, 8, 6), warmBronze), px, py, 1.21, 0, 0, 0, flapG);

      // Rear tapered brass tail nozzle & side mooring ring (-Z rear)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.52, 12), warmBronze), px, py, -0.92, -PI * 0.5, 0, 0, flapG);
      const sideLoop = new THREE.TorusGeometry(0.14, 0.030, 7, 14);
      add(new THREE.Mesh(sideLoop, sunBrass), px + podSide * 0.28, py - 0.14, -0.36, 0, PI * 0.5, 0, flapG);

      // Circumferential brass cage hoops around the cyan glass pod
      for (const [rz, rr] of [[-0.52, 0.26], [-0.18, 0.325], [0.18, 0.335], [0.54, 0.285], [0.78, 0.21]]) {
        const hoop = new THREE.TorusGeometry(rr, 0.025, 6, 16);
        add(new THREE.Mesh(hoop, sunBrass), px, py, rz, 0, 0, 0, flapG);
      }
      // Longitudinal brass cage ribs along the pod
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        const ribPts = [
          new THREE.Vector3(px + Math.cos(a) * 0.18, py + Math.sin(a) * 0.17, -0.68),
          new THREE.Vector3(px + Math.cos(a) * 0.335, py + Math.sin(a) * 0.32, 0.06),
          new THREE.Vector3(px + Math.cos(a) * 0.20, py + Math.sin(a) * 0.19, 0.78),
        ];
        const rCurve = new THREE.CatmullRomCurve3(ribPts);
        add(new THREE.Mesh(new THREE.TubeGeometry(rCurve, 12, 0.020, 5, false), sunBrass), 0, 0, 0, 0, 0, 0, flapG);
      }
    }

    // 3) Central Brass Cockpit Saddle, Crimson Pilot Seat, Control Yoke & Dorsal Gearbox
    add(rbox(0.56, 0.22, 1.18, 0.04, warmBronze, 1), 0, 0.96, -0.05, 0, 0, 0, flapG);
    add(rbox(0.42, 0.14, 0.42, 0.03, sm.crimsonLeather, 1), 0, 1.12, -0.22, 0, 0, 0, flapG);
    add(rbox(0.40, 0.32, 0.10, 0.03, sm.crimsonLeather, 1), 0, 1.28, -0.40, -0.18, 0, 0, flapG);
    beam([0, 1.06, 0.16], [0, 1.34, 0.08], 0.036, sunBrass, flapG);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 12), sunBrass), 0, 1.35, 0.07, -0.45, 0, 0, flapG);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.24, 12), sunBrass), 0, 1.24, 0.28, 0, 0, 0, flapG);

    // Swept Parchment Dorsal Tail Vane
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 1.02);
    tailShape.lineTo(-0.56, 1.48);
    tailShape.lineTo(-0.68, 1.08);
    tailShape.closePath();
    add(new THREE.Mesh(new THREE.ShapeGeometry(tailShape), sm.wingParchment), 0, 0, -0.48, 0, PI * 0.5, 0, flapG);
    beam([0, 1.02, -0.48], [0, 1.48, -1.04], 0.032, sunBrass, flapG);

    // 4) 4 Sculpted Scalloped Bat/Dragonfly Parchment Wings (`sm.wingParchment` + `sunBrass` Veins)!
    const buildScallopedWing = (side, span = 1.95, chord = 0.92, sweepZ = 0.10, liftRot = 0.24, yawRot = 0.0) => {
      const wg = new THREE.Group();
      wg.position.set(side * 0.16, 1.28, sweepZ);
      wg.rotation.set(0.08, yawRot, side * liftRot);
      flapG.add(wg);

      const nU = 16, nV = 6;
      const pos = [], uvs = [], idx = [];
      for (let iv = 0; iv <= nV; iv++) {
        const v = iv / nV;
        for (let iu = 0; iu <= nU; iu++) {
          const u = iu / nU;
          const x = side * u * span;
          const leadZ = Math.sin(u * PI * 0.78) * (chord * 0.34) - u * 0.14;
          const taper = Math.sin(Math.min(1, u * 1.12 + 0.18) * PI * 0.85);
          const scallop = Math.abs(Math.sin(u * PI * 4)) * 0.17 * (1 - u * 0.32);
          const trailZ = leadZ - chord * Math.max(0.14, taper) + scallop;
          const z = leadZ * (1 - v) + trailZ * v;
          const camberY = Math.sin(u * PI * 0.75) * 0.17 + Math.sin(v * PI) * 0.055;
          pos.push(x, camberY, z);
          uvs.push(u, v);
        }
      }
      for (let iv = 0; iv < nV; iv++) {
        for (let iu = 0; iu < nU; iu++) {
          const a = iv * (nU + 1) + iu;
          const b = a + 1;
          const c = a + (nU + 1);
          const d = c + 1;
          if (side > 0) idx.push(a, b, c, b, d, c);
          else idx.push(a, c, b, b, c, d);
        }
      }
      const mGeo = new THREE.BufferGeometry();
      mGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      mGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      mGeo.setIndex(idx);
      mGeo.computeVertexNormals();
      add(new THREE.Mesh(mGeo, sm.wingParchment), 0, 0, 0, 0, 0, 0, wg);

      const sparPts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        sparPts.push(new THREE.Vector3(
          side * u * span,
          Math.sin(u * PI * 0.75) * 0.17 + 0.01,
          Math.sin(u * PI * 0.78) * (chord * 0.34) - u * 0.14
        ));
      }
      add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sparPts), 14, 0.028, 6, false), sunBrass),
        0, 0, 0, 0, 0, 0, wg);

      for (const uTip of [0.25, 0.50, 0.75, 0.96]) {
        const tx = side * uTip * span;
        const leadZ = Math.sin(uTip * PI * 0.78) * (chord * 0.34) - uTip * 0.14;
        const taper = Math.sin(Math.min(1, uTip * 1.12 + 0.18) * PI * 0.85);
        const tz = leadZ - chord * Math.max(0.14, taper);
        const ty = Math.sin(uTip * PI * 0.75) * 0.17;
        beam([side * 0.06, 0.04, 0.04], [tx, ty, tz], 0.020, warmBronze, wg);
      }
    };

    buildScallopedWing(-1, 1.94, 0.94, 0.22, 0.24, 0.14);
    buildScallopedWing(1, 1.94, 0.94, 0.22, 0.24, -0.14);
    buildScallopedWing(-1, 1.34, 0.66, -0.22, 0.11, -0.24);
    buildScallopedWing(1, 1.34, 0.66, -0.22, 0.11, 0.24);

    boxCol(fx, fz, 1.76, 1.90, fRot);
  }

  // 5c. Two Chunky Carpenter Sawhorse Trestles, Left Aviation Bench & Back Parts Rack (`int_03.png`)
  const addSawhorse = (sx, sz, rotY = 0) => {
    const g = new THREE.Group();
    g.position.set(sx, FL, sz);
    g.rotation.y = rotY;
    root.add(g);

    add(rbox(0.86, 0.11, 0.40, 0.025, warmTimber, 1), 0, 0.66, 0, 0, 0, 0, g);
    for (const ex of [-0.30, 0.30]) {
      beam([ex - 0.08, 0, -0.22], [ex, 0.65, -0.06], 0.075, sm.oakTimber, g);
      beam([ex + 0.08, 0, 0.22], [ex, 0.65, 0.06], 0.075, sm.oakTimber, g);
      beam([ex, 0.26, -0.15], [ex, 0.26, 0.15], 0.055, sm.darkTimber, g);
    }
    beam([-0.32, 0.26, 0], [0.32, 0.26, 0], 0.055, sm.darkTimber, g);
    add(rbox(0.24, 0.04, 0.08, 0.01, sunBrass, 1), 0.12, 0.74, 0.02, 0, 0.35, 0, g);
    boxCol(sx, sz, 0.84, 0.46, rotY);
  };

  addSawhorse(-3.36, 1.72, 0.22);
  addSawhorse(-0.18, 0.78, -0.22);

  // Left-wall workbench (`ext_03.png` & `int_03.png`)
  {
    const bx = -4.34, bz = 0.85;
    add(rbox(0.76, 0.09, 1.84, 0.02, warmTimber, 1), bx, FL + 0.78, bz, 0, 0, 0, root);
    add(rbox(0.66, 0.05, 1.66, 0.015, sm.oakTimber, 1), bx, FL + 0.24, bz, 0, 0, 0, root);
    for (const lx of [-0.28, 0.28]) for (const lz of [-0.78, 0.78]) {
      add(box(0.09, 0.76, 0.09, sm.darkTimber), bx + lx, FL + 0.38, bz + lz, 0, 0, 0, root);
    }
    add(rbox(0.22, 0.16, 0.20, 0.02, deepBronze, 1), bx + 0.22, FL + 0.90, bz + 0.52, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.18, 10), sunBrass), bx - 0.10, FL + 0.91, bz - 0.35, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 10), sm.creamCanvas), bx + 0.04, FL + 0.87, bz + 0.05, PI * 0.5, 0, 0.28, root);
    boxCol(bx, bz, 0.80, 1.88);
  }

  // Back-east spare parts rack & riveted crate in `ornithopter_bay` (`int_03.png`)
  {
    const rx = 0.88, rz = -3.36;
    for (const sx of [-0.42, 0.42]) for (const sz of [-0.24, 0.24]) {
      add(box(0.08, 1.72, 0.08, sm.darkTimber), rx + sx, FL + 0.86, rz + sz, 0, 0, 0, root);
    }
    for (const sy of [0.18, 0.78, 1.38]) {
      add(rbox(0.96, 0.06, 0.56, 0.015, sm.oakTimber, 1), rx, FL + sy, rz, 0, 0, 0, root);
    }
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 14), sunBrass), rx - 0.18, FL + 1.00, rz, 0.2, 0, 0, root);
    addCargoCrate(rx + 0.06, FL + 0.21, rz, 0.44, 0.38, 0.40, 0.1, root);
    boxCol(rx, rz, 1.00, 0.60);
  }

  // ==========================================================================
  // 6. ROOM 2 (`rigging_loft`): FLIGHT-DECK STAIRS, MEZZANINE SHELF, HANGING
  //    COILED HEMP ROPES, RIVETED CHEST & AVIATION WORKBENCH (`int_03.png`!)
  // ==========================================================================
  const addRivetedPirateChest = (cx, y0, cz, rotY = 0) => {
    const g = new THREE.Group();
    g.position.set(cx, y0, cz);
    g.rotation.y = rotY;
    root.add(g);

    const cw = 0.84, ch = 0.46, cd = 0.54;
    add(rbox(cw, ch, cd, 0.025, warmTimber, 1), 0, ch * 0.5, 0, 0, 0, 0, g);
    const lidGeo = new THREE.CylinderGeometry(cd * 0.5, cd * 0.5, cw, 12, 1, false, 0, PI);
    lidGeo.rotateZ(PI * 0.5);
    lidGeo.scale(1, 0.42, 1);
    add(new THREE.Mesh(lidGeo, sm.oakTimber), 0, ch, 0, 0, 0, 0, g);
    for (const sx of [-0.28, 0, 0.28]) {
      add(box(0.065, ch + 0.12, cd + 0.03, sunBrass), sx, (ch + 0.08) * 0.5, 0, 0, 0, 0, g);
    }
    add(rbox(0.14, 0.14, 0.06, 0.015, sunBrass, 1), 0, ch - 0.02, cd * 0.5 + 0.02, 0, 0, 0, g);
  };

  // 6a. Elevated Mezzanine Shelf + Wooden Flight-Deck Stairs (`int_03.png` top-right!)
  {
    const mezY = FL + 1.56;
    add(rbox(2.08, 0.12, 1.48, 0.025, sm.oakTimber, 1), 3.75, mezY, -3.16, 0, 0, 0, root);
    add(box(2.10, 0.14, 0.14, sm.darkTimber), 3.75, mezY - 0.10, -2.44, 0, 0, 0, root);
    for (const px of [2.82, 4.68]) {
      add(box(0.14, mezY - FL, 0.14, sm.darkTimber), px, FL + (mezY - FL) * 0.5, -2.46, 0, 0, 0, root);
      beam([px, mezY - 0.55, -2.46], [px + (px < 3.5 ? 0.45 : -0.45), mezY - 0.08, -2.46], 0.085, sm.darkTimber, root);
    }
    add(box(1.32, 0.065, 0.07, warmTimber), 4.10, mezY + 0.48, -2.44, 0, 0, 0, root);
    for (const rx of [3.50, 4.10, 4.68]) {
      add(box(0.07, 0.48, 0.07, sm.darkTimber), rx, mezY + 0.26, -2.44, 0, 0, 0, root);
    }
    addCargoCrate(4.28, mezY + 0.06, -3.22, 0.50, 0.38, 0.44, -0.18, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 7, 16), ropeMat), 3.62, mezY + 0.12, -3.15, PI * 0.5, 0, 0, root);

    const nSteps = 6;
    const stX = 2.24;
    const zStart = -1.24, zEnd = -2.46;
    for (let s = 0; s < nSteps; s++) {
      const f = (s + 1) / nSteps;
      const sy = FL + f * (mezY - FL);
      const sz = zStart + (s / (nSteps - 1)) * (zEnd - zStart);
      add(rbox(0.88, 0.075, 0.28, 0.02, warmTimber, 1), stX, sy - 0.04, sz, 0, 0, 0, root);
    }
    add(rbox(1.06, 0.12, 1.18, 0.025, sm.oakTimber, 1), 2.24, mezY, -3.16, 0, 0, 0, root);
    for (const sx of [-0.42, 0.42]) {
      beam([stX + sx, FL + 0.05, zStart + 0.10], [stX + sx, mezY, zEnd - 0.06], 0.10, sm.darkTimber, root);
    }
    add(box(0.10, 0.72, 0.10, sm.darkTimber), stX + 0.42, FL + 0.36, zStart + 0.10, 0, 0, 0, root);
    add(box(0.10, 0.62, 0.10, sm.darkTimber), stX + 0.42, mezY + 0.31, zEnd - 0.05, 0, 0, 0, root);
    beam([stX + 0.42, FL + 0.70, zStart + 0.10], [stX + 0.42, mezY + 0.60, zEnd - 0.05], 0.07, warmTimber, root);

    addRivetedPirateChest(2.38, FL, -0.96, 0.08);

    boxCol(3.26, -3.16, 3.04, 1.48);
    boxCol(2.28, -1.68, 0.96, 1.56);
  }

  // 6b. Right-Wall Aviation Tool Workbench + Coiled Hemp Ropes on Wall Pegs (`int_03.png`!)
  {
    const wx = 4.30, wz = -1.02;
    add(rbox(0.84, 0.76, 1.98, 0.025, sm.oakTimber, 1), wx, FL + 0.38, wz, 0, 0, 0, root);
    add(rbox(0.92, 0.09, 2.08, 0.025, warmTimber, 1), wx, FL + 0.80, wz, 0, 0, 0, root);
    for (const dz of [-0.52, 0.52]) {
      add(rbox(0.06, 0.54, 0.82, 0.015, sm.darkTimber, 1), wx - 0.41, FL + 0.38, wz + dz, 0, 0, 0, root);
      add(rbox(0.05, 0.05, 0.16, 0.01, sunBrass, 1), wx - 0.44, FL + 0.52, wz + dz, 0, 0, 0, root);
    }
    add(box(0.07, 0.76, 0.08, sunBrass), wx - 0.41, FL + 0.38, wz, 0, 0, 0, root);

    add(rbox(0.26, 0.18, 0.24, 0.02, warmBronze, 1), wx - 0.08, FL + 0.92, wz - 0.48, 0, 0.2, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 6, 14), sunBrass), wx - 0.18, FL + 0.96, wz - 0.48, 0, PI * 0.5, 0, root);
    add(rbox(0.28, 0.12, 0.32, 0.02, sm.crimsonLeather, 1), wx - 0.06, FL + 0.89, wz + 0.12, 0, -0.15, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 10), sunBrass), wx - 0.10, FL + 0.93, wz + 0.62, 0, 0, 0, root);

    addCargoCrate(4.36, FL, 0.32, 0.54, 0.46, 0.52, -0.05, root);
    boxCol(4.32, -0.72, 0.92, 2.68);

    // Timber Peg-Board Rail + Two Large Braided Hemp Rope Loops Hanging Proudly (`int_03.png`!)
    add(rbox(0.10, 0.16, 1.56, 0.02, sm.darkTimber, 1), 4.72, FL + 1.96, -1.04, 0, 0, 0, root);
    for (const rz of [-1.42, -0.66]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.28, 8), sm.darkTimber),
        4.62, FL + 1.96, rz, 0, 0, PI * 0.5, root);
      for (let strand = 0; strand < 3; strand++) {
        const loopGeo = new THREE.TorusGeometry(0.26 - strand * 0.024, 0.036, 7, 20);
        loopGeo.scale(0.70, 1.42, 1.0);
        add(new THREE.Mesh(loopGeo, ropeMat),
          4.56 - strand * 0.032, FL + 1.60, rz, 0, PI * 0.5, 0.04 * (strand - 1), root);
      }
    }
  }

  // Merge all transparent Ornithopter canopy glass meshes into ONE single draw call!
  if (glassGeos.length) {
    const mergedGlass = mergeGeometries(glassGeos, false);
    glassGeos.forEach((g) => g.dispose());
    const glassMesh = new THREE.Mesh(mergedGlass, ornithopterGlassMat);
    glassMesh.castShadow = false;
    glassMesh.receiveShadow = false;
    glassMesh.name = 'ornithopter_canopy_glass';
    root.add(glassMesh);
  }

  // ==========================================================================
  // 7. REQUIRED `root.userData` (FOOTPRINT, ROOMS, DOORS, WINDVANE & PROP SLOTS)
  // ==========================================================================
  root.userData.footprint = { w: 10.4, d: 8.2 };
  root.userData.footprintBox = { w: 10.4, d: 8.2 };
  root.userData.rooms = [
    { name: 'ornithopter_bay', x: -1.62, z: -0.28, w: 6.34, d: 7.26, walkX: -1.45, walkZ: 2.05 },  // x ∈ [-4.79, 1.55]
    { name: 'rigging_loft', x: 3.18, z: -0.28, w: 3.26, d: 7.26, walkX: 3.15, walkZ: 0.85 },   // x ∈ [1.55, 4.81]
  ];
  root.userData.door = { x: -0.9, z: 5.65 };
  root.userData.doorIn = { x: -0.9, z: 2.7 };
  root.userData.innerDoors = [{ x: 1.55, z: 0.2 }];

  root.userData.propSlots = [
    // `ornithopter_bay` — 6 valid slots around perimeter (keeping central walk & Ornithopter aisle wide open!)
    { id: 'sr_propeller_barrel', x: -3.95, y: FL, z: 2.52, rot: 0.35 },
    { id: 'sr_pirate_chest', x: -2.85, y: FL, z: 2.58, rot: -0.22 },
    { id: 'sr_ornithopter_seat', x: -4.05, y: FL, z: -3.02, rot: 0.68 },
    { id: 'sr_sky_compass', x: -3.18, y: FL, z: -3.18, rot: 0.18 },
    { id: 'sr_propeller_barrel', x: -0.58, y: FL, z: -3.12, rot: -0.40 },
    { id: 'sr_telescope_tripod', x: 0.52, y: FL, z: -2.38, rot: -2.35 },
    // `rigging_loft` — 3 valid slots in open southern loft floor
    { id: 'sr_pirate_chest', x: 3.98, y: FL, z: 2.42, rot: -2.55 },
    { id: 'sr_ornithopter_seat', x: 2.42, y: FL, z: 2.38, rot: 2.85 },
    { id: 'sr_sky_compass', x: 3.88, y: FL, z: 1.42, rot: -1.65 },
  ];

  K.finalize([windvaneGrp]);

  // Keep floating cliff underside rocks cleanly below y = 0 so front steps & apron stay 100% crisp!
  root.traverse((o) => {
    if (o.isInstancedMesh && o.name.includes('plinth_belly')) {
      o.position.y -= 0.58;
    }
  });

  return root;
}
