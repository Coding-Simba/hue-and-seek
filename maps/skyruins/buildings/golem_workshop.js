// ============================================================================
// Celestia Sky-Ruins (Celestia) — Building 4: Mossy Guardian Golem Ziggurat
// (`maps/skyruins/buildings/golem_workshop.js`)
// Handcrafted 1:1 from Codex references `ext_04.png` & `int_04.png`:
//   - Floating Celestian stone plinth w/ front limestone steps, twin cyan crystal
//     obelisk lanterns, cascading purple wisteria, wildflowers & cliff waterfalls
//   - 5-terraced mossy cream-travertine ashlar ziggurat w/ circular golden-cyan
//     rune medallions & sunlit ancient Storybook trees sprouting from upper terraces
//   - Colossal Celestian Guardian Golem Head, Shoulders & Glowing Cyan Chest Core
//     emerging above the grand radial voussoir & golden-rune temple doorway
//   - 2-Room Cutaway Interior (`K.roofG` lifts cleanly in `mode=interiors`):
//       1) `golem_sanctum` (left/center): unobstructed 16-point compass-rose
//          mosaic floor, Ancient Mossy Seated Guardian Golem Statue (`y < 3.25m`)
//          w/ glowing cyan eyes, chest core & turquoise Aether basin + lanterns
//       2) `flower_cloister` (right): sunlit open-air fluted-column stone arcade,
//          clover & wildflower garden carpet, curved carved stone garden bench,
//          cascading blossoms & 10 valid `propSlots`
//   - ALL materials strictly `metalness: 0`; merged draw calls <= 60; tris 60k–180k.
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
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
  buildCrystalObeliskLantern,
  buildFlutedColumn,
  buildGnarledRootTube,
  buildFoliageCanopyCluster,
  buildWisteriaRacemes,
} from '../sky_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

const BLOSSOM_CLOISTER_PAL = [0xd99aff, 0xffa6d2, 0xfff8e8, 0xc382f8, 0xffe27a, 0xf7c4ec];

function getWorkshopTextures(THREE) {
  // 1. Hand-Painted Sunlit Chiseled Celestian Golem Sandstone (warm cream-tan, crisp joints)
  const golemSandstone = paintedCanvasTex(THREE, 'sr_gw_golem_stone_v3', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#eee2ca';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 320, ['#f8f0e2', '#e4d5ba', '#dacaa9', '#fcf6ea'], 4, 14, 0.36);
    ctx.strokeStyle = 'rgba(122,104,78,0.22)';
    ctx.lineWidth = 2;
    for (const y of [s * 0.25, s * 0.52, s * 0.78]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    for (const x of [s * 0.34, s * 0.68]) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
    brushStrokes(ctx, s, rng, 40, ['#8ab85a', '#a4cc74'], 2, 5, 0.14);
  }, 1.5, 1.5);

  // 2. Lush Sunlit Clover, Wildflower & Warm Winding Garden Path Carpet (`flower_cloister`)
  const cloisterCarpet = paintedCanvasTex(THREE, 'sr_gw_cloister_carpet_v3', 512, (ctx, s, rng) => {
    ctx.fillStyle = '#6fb843';
    ctx.fillRect(0, 0, s, s);

    for (let i = 0; i < 75; i++) {
      const x = rng.jr(0, s), y = rng.jr(0, s), r = rng.jr(26, 98);
      const grd = ctx.createRadialGradient(x, y, 4, x, y, r);
      grd.addColorStop(0, rng.rr() > 0.38 ? 'rgba(196,238,108,0.55)' : 'rgba(78,140,46,0.38)');
      grd.addColorStop(1, 'rgba(111,184,67,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    brushStrokes(ctx, s, rng, 620, ['#8cd458', '#5c9e38', '#ade670', '#76be48', '#c6ee82'], 3, 9, 0.46);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const strokePath = (w, col, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(s * 0.04, s * 0.54);
      ctx.bezierCurveTo(s * 0.34, s * 0.56, s * 0.48, s * 0.42, s * 0.58, s * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.34, s * 0.53);
      ctx.quadraticCurveTo(s * 0.52, s * 0.68, s * 0.46, s * 0.88);
      ctx.stroke();
      ctx.restore();
    };
    strokePath(86, '#b8c870', 0.45);
    strokePath(62, '#e8d8b4', 0.72);
    strokePath(38, '#f8eed6', 0.82);
    brushStrokes(ctx, s, rng, 180, ['#98cf5c', '#f5ebd2', '#ffe89c'], 2, 6, 0.28);

    for (let i = 0; i < 340; i++) {
      ctx.fillStyle = rng.pick(['#fffaf0', '#f0b4ff', '#ff9ec8', '#ffe478', '#d49aff', '#ffd0e6']);
      ctx.beginPath();
      ctx.arc(rng.jr(10, s - 10), rng.jr(10, s - 10), rng.jr(2.0, 5.2), 0, TAU);
      ctx.fill();
    }
  }, 1, 1);

  // 3. Circular Golden-Cyan Celestian Ziggurat Medallion Face
  const runeMedallion = paintedCanvasTex(THREE, 'sr_gw_rune_medallion_v3', 256, (ctx, s, rng) => {
    const c = s * 0.5;
    const grd = ctx.createRadialGradient(c, c, 8, c, c, c);
    grd.addColorStop(0, '#b4ffff');
    grd.addColorStop(0.38, '#2ec4e8');
    grd.addColorStop(0.74, '#1b7294');
    grd.addColorStop(1, '#eab648');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 70, ['#64e4fc', '#1d6888', '#98fcff'], 3, 8, 0.30);

    ctx.strokeStyle = '#fad066';
    ctx.lineWidth = 15;
    ctx.beginPath(); ctx.arc(c, c, s * 0.42, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#befcff';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(c, c, s * 0.27, 0, TAU); ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.strokeStyle = '#ffe590';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * s * 0.13, c + Math.sin(a) * s * 0.13);
      ctx.lineTo(c + Math.cos(a) * s * 0.39, c + Math.sin(a) * s * 0.39);
      ctx.stroke();
    }
    ctx.fillStyle = '#ebffff';
    ctx.beginPath(); ctx.arc(c, c, s * 0.11, 0, TAU); ctx.fill();
  }, 1, 1);

  return { golemSandstone, cloisterCarpet, runeMedallion };
}

export function buildGolemWorkshop(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'golem_workshop', 4);
  // Required by `sky_kit.js` `buildMossyIslandPlinth` when `garden: true`
  K.box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const {
    root, roofG, add, rbox, wall, boxCol,
    pushInst, pushInstMatrix, jr, pick, M, glowMat,
  } = K;

  const sm = getSkyMats(THREE, K);
  const wt = getWorkshopTextures(THREE);

  // Calibrated Storybook Celestia Materials (100% metalness: 0!)
  const golemSunStone = M(0xffffff, wt.golemSandstone, { roughness: 0.86, metalness: 0 });
  const golemTrimStone = M(0xe3d3b6, wt.golemSandstone, { roughness: 0.88, metalness: 0 });
  const golemSeamDark = M(0x766956, null, { roughness: 0.92, metalness: 0 });
  const warmGoldMat = M(0xf7c652, null, {
    roughness: 0.48,
    metalness: 0,
    emissive: new THREE.Color(0x563608),
    emissiveIntensity: 0.24,
  });
  const lanternBronze = M(0x6e5236, null, { roughness: 0.86, metalness: 0 });
  const cloisterFloorMat = M(0xffffff, wt.cloisterCarpet, { roughness: 0.88, metalness: 0 });
  const medallionFaceMat = M(0xffffff, wt.runeMedallion, {
    roughness: 0.38,
    metalness: 0,
    emissive: new THREE.Color(0x16789c),
    emissiveIntensity: 0.48,
  });
  const amberCoreMat = glowMat(0xffefb0, 0xff9e28, 1.35, { roughness: 0.26, metalness: 0 });

  const FL = 0.34;

  // Consolidated Instancing Geometries (keeps merged draw calls <= 54 & tris ~125k–152k!)
  const ashlarGeo = () => sharedSkyGeo(THREE, 'gw3_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.08, 1));
  const voussoirGeo = () => sharedSkyGeo(THREE, 'gw3_voussoir', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
  const mossPuffGeo = () => sharedSkyGeo(THREE, 'gw3_moss_puff', () => new THREE.IcosahedronGeometry(0.32, 1));
  const bloomBeadGeo = () => sharedSkyGeo(THREE, 'gw3_bloom_bead', () => new THREE.DodecahedronGeometry(0.085, 0));

  // ==========================================================================
  // Helper: World-Space Radial Voussoir Stone Arch (1 shared InstancedMesh batch!)
  // ==========================================================================
  const _archGrpM = new THREE.Matrix4();
  const _archLocM = new THREE.Matrix4();
  const _archPos = new THREE.Vector3();
  const _archQuat = new THREE.Quaternion();
  const _archScl = new THREE.Vector3();
  const _archEul = new THREE.Euler();

  function addWorldStoneArch({
    cx = 0, cy = 2.0, cz = 0,
    radius = 1.15, thickness = 0.24, depth = 0.34,
    segments = 11, rotY = 0,
    keystoneGlow = false,
    parent = root,
  }) {
    _archGrpM.makeRotationY(rotY).setPosition(cx, cy, cz);
    for (let i = 0; i < segments; i++) {
      const isKey = i === Math.floor(segments * 0.5);
      const a = -PI * 0.5 + ((i + 0.5) / segments) * PI;
      _archPos.set(Math.sin(a) * radius, Math.cos(a) * radius, 0);
      _archEul.set(0, 0, -a);
      _archQuat.setFromEuler(_archEul);
      _archScl.set(
        (PI * radius) / segments * 1.08,
        thickness * (isKey ? 1.28 : 1.0),
        depth * (isKey ? 1.16 : 1.0)
      );
      _archLocM.compose(_archPos, _archQuat, _archScl).premultiply(_archGrpM);
      pushInstMatrix('gw_arch_vs', voussoirGeo, sm.stoneInst, _archLocM, isKey ? 0xf8eed6 : pick(TRAVERTINE_PAL), parent);
    }

    if (keystoneGlow) {
      const cY = Math.cos(rotY), sY = Math.sin(rotY);
      add(rbox(0.26, 0.26, depth * 1.18, 0.04, warmGoldMat, 1),
        cx, cy + radius + 0.02, cz, 0, rotY, PI * 0.25, parent);
      const off = depth * 0.58;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), sm.cyanCrystal),
        cx + off * sY, cy + radius + 0.02, cz + off * cY, 0, 0, 0, parent);
    }
  }

  // ==========================================================================
  // Helper: 3D Circular Golden-Rimmed Glowing Cyan Rune Medallion (`ext_04.png`)
  // ==========================================================================
  const medRimGeo = sharedSkyGeo(THREE, 'gw3_med_rim', () => new THREE.TorusGeometry(0.30, 0.058, 8, 20));
  const medDiscGeo = sharedSkyGeo(THREE, 'gw3_med_disc', () => {
    const c = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 20);
    c.rotateX(PI * 0.5);
    return c;
  });
  const medBackGeo = sharedSkyGeo(THREE, 'gw3_med_back', () => {
    const c = new THREE.CylinderGeometry(0.37, 0.39, 0.08, 20);
    c.rotateX(PI * 0.5);
    return c;
  });
  const medGemGeo = sharedSkyGeo(THREE, 'gw3_med_gem', () => new THREE.SphereGeometry(0.088, 10, 8));

  function addRuneMedallion(x, y, z, rotY = 0, scale = 1.0, parent = root) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    parent.add(g);

    add(new THREE.Mesh(medBackGeo, sm.travertineDark), 0, 0, 0, 0, 0, 0, g);
    add(new THREE.Mesh(medDiscGeo, medallionFaceMat), 0, 0, 0.025, 0, 0, 0, g);
    add(new THREE.Mesh(medRimGeo, warmGoldMat), 0, 0, 0.055, 0, 0, 0, g);
    add(new THREE.Mesh(medGemGeo, sm.cyanCrystal), 0, 0, 0.078, 0, 0, 0, g);
    return g;
  }

  // ==========================================================================
  // Helper: Tightly-Jointed Chiseled Celestian Ziggurat Ashlar Course Volume
  // ==========================================================================
  function addZigguratBlockVolume({
    x0, x1, z0, z1, y0, y1,
    parent = root,
    core = true,
    mossTop = true,
    flowersTop = true,
    flowerPal = WILDFLOWER_PAL,
    openFront = false,
    openBack = false,
    openLeft = false,
    openRight = false,
  }) {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
    if (w <= 0.15 || d <= 0.15 || h <= 0.12) return;

    if (core) {
      add(rbox(w - 0.06, h - 0.03, d - 0.06, 0.04, sm.travertineWarm, 1), cx, cy, cz, 0, 0, 0, parent);
    }

    const rows = Math.max(2, Math.round(h / 0.42));
    const rh = h / rows;

    const populateFace = (len, fixedCoord, alongZ, sign) => {
      const cols = Math.max(2, Math.round(len / 0.62));
      const cw = len / cols;
      for (let r = 0; r < rows; r++) {
        const by = y0 + (r + 0.5) * rh;
        const stag = (r % 2 === 1 && cols > 2) ? cw * 0.18 : 0;
        for (let c = 0; c < cols; c++) {
          let u = -len * 0.5 + (c + 0.5) * cw + (c === 0 || c === cols - 1 ? 0 : stag);
          u = Math.max(-len * 0.5 + cw * 0.48, Math.min(len * 0.5 - cw * 0.48, u));
          const colHex = jr(0, 1) < 0.12 ? pick(MOSS_PAL) : pick(TRAVERTINE_PAL);
          if (alongZ) {
            pushInst('gw_ashlar', ashlarGeo, sm.stoneInst,
              fixedCoord + sign * 0.012 + jr(-0.008, 0.008), by, cz + u,
              jr(-0.01, 0.01), jr(-0.012, 0.012), jr(-0.01, 0.01),
              0.14, rh * 0.96, cw * 0.97, colHex, parent);
          } else {
            pushInst('gw_ashlar', ashlarGeo, sm.stoneInst,
              cx + u, by, fixedCoord + sign * 0.012 + jr(-0.008, 0.008),
              jr(-0.01, 0.01), jr(-0.012, 0.012), jr(-0.01, 0.01),
              cw * 0.97, rh * 0.96, 0.14, colHex, parent);
          }
        }
      }
    };

    if (!openFront) populateFace(w, z1, false, 1);
    if (!openBack) populateFace(w, z0, false, -1);
    if (!openLeft) populateFace(d, x0, true, -1);
    if (!openRight) populateFace(d, x1, true, 1);

    if (mossTop) {
      const area = w * d;
      const nMoss = Math.max(4, Math.min(28, Math.round(area * 2.4)));
      for (let i = 0; i < nMoss; i++) {
        const mx = jr(x0 + 0.06, x1 - 0.06);
        const mz = jr(z0 + 0.06, z1 - 0.06);
        const nearEdge = (mx - x0 < 0.42) || (x1 - mx < 0.42) || (mz - z0 < 0.42) || (z1 - mz < 0.42);
        const sx = jr(0.68, 1.28), sz = jr(0.68, 1.28);
        pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
          mx, y1 + (nearEdge ? -0.02 : 0.02), mz,
          jr(-0.2, 0.2), jr(0, TAU), jr(-0.2, 0.2),
          sx, jr(0.24, 0.44), sz, pick(MOSS_PAL), parent);

        if (flowersTop && jr(0, 1) < 0.72) {
          for (let f = 0; f < 2; f++) {
            const sc = jr(0.82, 1.32);
            pushInst('gw_bloom', bloomBeadGeo, sm.foliageInst,
              mx + jr(-0.16, 0.16), y1 + jr(0.09, 0.19), mz + jr(-0.16, 0.16),
              jr(0, TAU), jr(0, TAU), 0,
              sc, sc * 0.85, sc, pick(flowerPal), parent);
          }
        }
      }
    }
  }

  function addMossBlossomVine(pts, { blooms = WILDFLOWER_PAL, nSteps = 22, parent = root } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.032, 5, false), sm.barkAncient), 0, 0, 0, 0, 0, 0, parent);
    for (let i = 0; i < nSteps; i++) {
      const pt = curve.getPoint(i / Math.max(1, nSteps - 1));
      pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
        pt.x + jr(-0.10, 0.10), pt.y + jr(-0.06, 0.08), pt.z + jr(-0.10, 0.10),
        jr(-0.3, 0.3), jr(0, TAU), jr(-0.3, 0.3),
        jr(0.36, 0.65), jr(0.22, 0.38), jr(0.36, 0.65), pick(MOSS_PAL), parent);
      if (blooms && jr(0, 1) < 0.58) {
        const sc = jr(0.85, 1.32);
        pushInst('gw_bloom', bloomBeadGeo, sm.foliageInst,
          pt.x + jr(-0.12, 0.12), pt.y + jr(0.02, 0.14), pt.z + jr(-0.12, 0.12),
          jr(0, TAU), jr(0, TAU), 0, sc, sc * 0.88, sc, pick(blooms), parent);
      }
    }
  }

  // ==========================================================================
  // Helper: Hero Celestian Guardian Golem Head & Glowing Cyan Chest Core
  // ==========================================================================
  function buildCelestianGolemHead({ x, y, z, scale = 1.0, rotY = 0, tiltX = 0.04, parent = root }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(tiltX, rotY, 0);
    g.scale.setScalar(scale);
    parent.add(g);

    // Armored stone neck & warm golden collar ring
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.45, 0.28, 14), golemSeamDark), 0, -0.44, -0.03, 0, 0, 0, g);
    const neckRing = new THREE.TorusGeometry(0.43, 0.045, 7, 18);
    neckRing.rotateX(PI * 0.5);
    add(new THREE.Mesh(neckRing, warmGoldMat), 0, -0.35, -0.02, 0, 0, 0, g);

    // Smooth rounded-rectangular Celestian skull + domed cranium cap
    add(rbox(0.96, 0.80, 0.92, 0.24, golemSunStone, 3), 0, 0.06, 0, 0, 0, 0, g);
    const crownDome = new THREE.SphereGeometry(0.50, 18, 12, 0, TAU, 0, PI * 0.52);
    crownDome.scale(0.96, 0.58, 0.92);
    add(new THREE.Mesh(crownDome, golemSunStone), 0, 0.34, 0, 0, 0, 0, g);

    // Central raised forehead crest strip + golden circular forehead rune boss (`ext_04.png`!)
    add(rbox(0.20, 0.42, 0.95, 0.05, golemTrimStone, 2), 0, 0.36, 0.01, 0, 0, 0, g);
    add(rbox(0.19, 0.26, 0.12, 0.03, golemTrimStone, 1), 0, 0.28, 0.44, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.05, 12), warmGoldMat), 0, 0.28, 0.49, PI * 0.5, 0, 0, g);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), warmGoldMat), -0.05, 0.65, -0.04, 0, 0.3, 0.25, g);

    // Heroic chiseled brow ridge + curved side helmet plates
    add(rbox(0.92, 0.14, 0.24, 0.045, golemSunStone, 2), 0, 0.18, 0.41, 0.06, 0, 0, g);
    for (const sx of [-1, 1]) {
      add(rbox(0.15, 0.54, 0.82, 0.05, golemTrimStone, 2), sx * 0.44, 0.07, -0.02, 0, 0, 0, g);
    }

    // Recessed dark eye visor + Twin Luminous Glowing Cyan Optic Eyes (`sm.cyanCrystal`)
    add(rbox(0.74, 0.17, 0.12, 0.02, golemSeamDark, 1), 0, 0.045, 0.42, 0, 0, 0, g);
    for (const sx of [-1, 1]) {
      add(rbox(0.23, 0.112, 0.08, 0.03, sm.cyanCrystal, 1), sx * 0.215, 0.048, 0.465, 0, sx * 0.09, -sx * 0.03, g);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), sm.cyanSoft), sx * 0.215, 0.048, 0.50, 0, 0, 0, g);
      add(rbox(0.31, 0.23, 0.22, 0.06, golemSunStone, 2), sx * 0.28, -0.12, 0.39, 0, sx * 0.12, 0, g);
    }

    // Sleek chiseled Celestian nose bridge + stoic mouth seam + beveled chin
    add(rbox(0.125, 0.24, 0.18, 0.035, golemSunStone, 1), 0, -0.035, 0.455, -0.10, 0, 0, g);
    add(rbox(0.70, 0.28, 0.76, 0.09, golemSunStone, 2), 0, -0.27, 0.08, 0, 0, 0, g);
    add(rbox(0.32, 0.032, 0.10, 0.01, golemSeamDark, 1), 0, -0.20, 0.455, 0, 0, 0, g);
    add(rbox(0.38, 0.14, 0.14, 0.04, golemTrimStone, 1), 0, -0.31, 0.44, 0, 0, 0, g);

    // Twin cylindrical Celestian ear-discs with recessed dark rings & golden center hubs
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 16), golemTrimStone),
        sx * 0.51, 0.05, -0.02, 0, 0, PI * 0.5, g);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 14), golemSeamDark),
        sx * 0.52, 0.05, -0.02, 0, 0, PI * 0.5, g);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12), warmGoldMat),
        sx * 0.53, 0.05, -0.02, 0, 0, PI * 0.5, g);
    }

    // Weathered green moss cushions on left jaw & temple
    pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
      x - 0.35 * scale, y - 0.16 * scale, z + 0.36 * scale,
      0.2, 0.4, 0, 0.40 * scale, 0.24 * scale, 0.36 * scale, MOSS_PAL[0], parent);
    pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
      x - 0.33 * scale, y + 0.32 * scale, z + 0.26 * scale,
      0, 0.6, 0.2, 0.36 * scale, 0.20 * scale, 0.34 * scale, MOSS_PAL[1], parent);
    return g;
  }

  function buildGolemChestCore({ x, y, z, radius = 0.42, tiltX = -0.12, parent = root }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.x = tiltX;
    parent.add(g);

    const stoneBezel = new THREE.CylinderGeometry(radius * 1.25, radius * 1.34, 0.14, 22);
    stoneBezel.rotateX(PI * 0.5);
    add(new THREE.Mesh(stoneBezel, golemTrimStone), 0, 0, 0, 0, 0, 0, g);

    const darkWell = new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, 0.16, 20);
    darkWell.rotateX(PI * 0.5);
    add(new THREE.Mesh(darkWell, golemSeamDark), 0, 0, 0.02, 0, 0, 0, g);

    const goldRing = new THREE.TorusGeometry(radius * 1.04, radius * 0.155, 10, 24);
    add(new THREE.Mesh(goldRing, warmGoldMat), 0, 0, 0.065, 0, 0, 0, g);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      add(rbox(radius * 0.22, radius * 0.26, 0.12, 0.02, warmGoldMat, 1),
        Math.cos(a) * radius * 1.12, Math.sin(a) * radius * 1.12, 0.065, 0, 0, a, g);
    }

    const coreLens = new THREE.SphereGeometry(radius * 0.84, 16, 12);
    coreLens.scale(1, 1, 0.48);
    add(new THREE.Mesh(coreLens, sm.cyanCrystal), 0, 0, 0.055, 0, 0, 0, g);

    const innerSpark = new THREE.SphereGeometry(radius * 0.50, 12, 10);
    innerSpark.scale(1, 1, 0.54);
    add(new THREE.Mesh(innerSpark, sm.cyanSoft), 0, 0, 0.11, 0, 0, 0, g);
    return g;
  }

  function addWarmSanctuaryLantern(x, y, z, scale = 1.0, withArmillary = false, parent = root) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    parent.add(g);

    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6), lanternBronze), 0, 0.34, 0, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.16, 6), warmGoldMat), 0, 0.16, 0, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.28, 8), amberCoreMat), 0, -0.02, 0, 0, 0, 0, g);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      add(rbox(0.024, 0.28, 0.024, 0.005, lanternBronze, 1), Math.cos(a) * 0.135, -0.02, Math.sin(a) * 0.135, 0, 0, 0, g);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 6), warmGoldMat), 0, -0.20, 0, PI, 0, 0, g);

    if (withArmillary) {
      for (const [rx, ry, rz, rad] of [[0.32, 0.2, 0.15, 0.40], [-0.28, 0.9, -0.22, 0.46]]) {
        add(new THREE.Mesh(new THREE.TorusGeometry(rad, 0.025, 6, 22), warmGoldMat), 0, -0.02, 0, rx, ry, rz, g);
      }
    }
    return g;
  }

  // ==========================================================================
  // 1. FLOATING ISLAND STONE PLINTH, ENTRANCE STAIRS & TWIN CYAN OBELISKS
  // ==========================================================================
  buildMossyIslandPlinth(THREE, K, {
    w: 10.8,
    d: 9.6,
    h: 0.32,
    doorX: -0.6,
    doorZ: 3.64,
    doorW: 2.55,
    steps: 3,
    garden: opts.garden !== false,
    obelisks: false,
    parent: root,
    batchPrefix: 'gw_plinth',
  });

  // Twin Medallion-Carved Pedestals + Glowing Cyan Crystal Obelisk Lanterns (`ext_04.png` & `int_04.png`)
  for (const sx of [-1, 1]) {
    const ox = -0.6 + sx * 1.72;
    const oz = 4.18;
    add(rbox(0.82, 0.52, 0.82, 0.04, sm.travertinePlain, 1), ox, 0.26, oz, 0, 0, 0, root);
    add(rbox(0.90, 0.10, 0.90, 0.03, sm.travertineDark, 1), ox, 0.52, oz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14), warmGoldMat), ox, 0.28, oz + 0.41, PI * 0.5, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14), warmGoldMat), ox + sx * 0.41, 0.28, oz, 0, 0, PI * 0.5, root);
    buildCrystalObeliskLantern(THREE, K, { x: ox, y: 0.54, z: oz, scale: 0.90, parent: root });
    boxCol(ox, oz, 0.84, 0.84);
  }

  if (opts.garden !== false) {
    buildWisteriaRacemes(THREE, K, {
      cx: -0.25, yTop: 0.30, cz: 4.94,
      spanX: 1.50, strands: 8, maxLen: 1.38, parent: root, batchPrefix: 'gw_wist',
    });
    buildWisteriaRacemes(THREE, K, {
      cx: -3.35, yTop: 0.30, cz: 4.90,
      spanX: 1.15, strands: 6, maxLen: 1.15, parent: root, batchPrefix: 'gw_wist',
    });
    buildWisteriaRacemes(THREE, K, {
      cx: 4.35, yTop: 0.30, cz: 4.88,
      spanX: 1.10, strands: 6, maxLen: 1.20, parent: root, batchPrefix: 'gw_wist',
    });
  }

  // ==========================================================================
  // 2. WALKABLE FLOORS, PERIMETER PHYSICS WALLS & CUTAWAY BOUNDARY (`y <= 3.3m`)
  // ==========================================================================
  const sanctumFloor = add(rbox(5.36, 0.04, 7.10, 0.02, sm.travertinePlain, 1), -1.35, FL - 0.008, 0.0, 0, 0, 0, root);
  sanctumFloor.userData.ground = true;

  const cloisterFloor = add(rbox(3.28, 0.045, 6.94, 0.02, cloisterFloorMat, 1), 3.02, FL - 0.004, 0.0, 0, 0, 0, root);
  cloisterFloor.userData.ground = true;

  // Front Sanctum Perimeter Wall split into two separate wings flanking `x ∈ [-1.64, +0.44]`
  // -> 2.08m wide 100% open threshold with ZERO bevel bar across the doorway!
  wall(-2.845, 3.60, 0, 2.41, 1.18, 0.28, [], sm.travertine, sm.travertineWarm, root, true);
  wall(0.895, 3.60, 0, 0.91, 1.18, 0.28, [], sm.travertine, sm.travertineWarm, root, true);

  // Back Wall: Left sanctum apse (`H = 3.20m`) + Right cloister garden parapet (`H = 0.96m`)
  wall(-1.40, -3.54, PI, 5.50, 3.20, 0.30, [], sm.travertine, sm.travertineWarm, root, true);
  wall(3.00, -3.50, PI, 3.30, 0.96, 0.26, [], sm.travertine, sm.travertinePlain, root, true);

  // Left Sanctum Wall (`H = 3.16m`) + Right & Front Cloister Garden Curbs (`H = 0.92m`)
  wall(-4.05, 0.03, -PI * 0.5, 7.14, 3.16, 0.28, [], sm.travertine, sm.travertineWarm, root, true);
  wall(4.66, 0.01, PI * 0.5, 7.02, 0.94, 0.26, [], sm.travertine, sm.travertinePlain, root, true);
  wall(3.005, 3.52, 0, 3.31, 0.92, 0.26, [], sm.travertine, sm.travertinePlain, root, true);

  // Interior Partition Wall at `x = 1.35` (`innerDoors: [{ x: 1.35, z: 0.3 }]`, clear gap = 1.98m >= 1.8m!)
  wall(1.44, 0.0, -PI * 0.5, 7.04, 3.14, 0.18, [
    { u: 0.30, w: 1.98, h: 2.82, door: true, arch: true },
    { u: 2.34, y0: 0.98, w: 1.24, h: 1.68 },
  ], sm.travertineWarm, sm.travertinePlain, root, true);

  // Classical Fluted Columns along the Cutaway Front & Interior Partition (`int_04.png`!)
  buildFlutedColumn(THREE, K, { x: -3.72, y0: FL, z: 3.24, height: 2.84, radius: 0.24, parent: root });
  buildFlutedColumn(THREE, K, { x: 1.35, y0: FL, z: 3.22, height: 2.84, radius: 0.23, parent: root });
  buildFlutedColumn(THREE, K, { x: 1.35, y0: FL, z: 1.38, height: 1.98, radius: 0.21, parent: root });
  buildFlutedColumn(THREE, K, { x: 1.35, y0: FL, z: -0.78, height: 1.98, radius: 0.21, parent: root });
  addWorldStoneArch({
    cx: 1.35, cy: 2.28, cz: 0.30,
    radius: 0.92, thickness: 0.24, depth: 0.32, segments: 9,
    rotY: PI * 0.5, keystoneGlow: true, parent: root,
  });

  // Lower Stepped Ziggurat Courses around Left & Rear (`y <= 3.22m` in `root`)
  addZigguratBlockVolume({ x0: -5.12, x1: -3.95, z0: -4.28, z1: 3.84, y0: FL, y1: 1.28, parent: root });
  addZigguratBlockVolume({ x0: -3.95, x1: -1.66, z0: 3.38, z1: 3.88, y0: FL, y1: 1.22, parent: root });
  addZigguratBlockVolume({ x0: -4.25, x1: 4.95, z0: -4.28, z1: -3.48, y0: FL, y1: 1.28, parent: root });
  addZigguratBlockVolume({ x0: 0.46, x1: 1.82, z0: 3.38, z1: 3.84, y0: FL, y1: 1.20, parent: root });
  addZigguratBlockVolume({ x0: 4.58, x1: 5.04, z0: -4.20, z1: 3.68, y0: FL, y1: 1.04, parent: root });

  addZigguratBlockVolume({ x0: -4.64, x1: -3.82, z0: -3.96, z1: 2.95, y0: 1.28, y1: 2.26, parent: root });
  addZigguratBlockVolume({ x0: -3.95, x1: 1.55, z0: -4.02, z1: -3.45, y0: 1.28, y1: 2.26, parent: root });
  addZigguratBlockVolume({ x0: -4.18, x1: -3.56, z0: -3.68, z1: 2.15, y0: 2.26, y1: 3.22, parent: root });
  addZigguratBlockVolume({ x0: -3.65, x1: 1.45, z0: -3.82, z1: -3.38, y0: 2.26, y1: 3.22, parent: root });

  // Lower Ziggurat Circular Golden-Cyan Rune Medallions
  addRuneMedallion(-2.45, 0.80, 3.90, 0, 0.88, root);
  addRuneMedallion(-4.66, 1.78, 1.15, -PI * 0.5, 0.86, root);
  addRuneMedallion(-5.14, 0.82, -0.45, -PI * 0.5, 0.88, root);
  addRuneMedallion(1.15, 0.78, 3.86, 0, 0.76, root);
  addRuneMedallion(5.06, 0.72, 2.85, PI * 0.5, 0.76, root);

  // ==========================================================================
  // 3. LEFT ROOM (`golem_sanctum`): COMPASS MOSAIC + SEATED GOLEM SHRINE
  //    (100% below `y = 3.25m` in `root` — completely unobstructed in `int_04.png`!)
  // ==========================================================================
  const mosaicRadius = 1.64;
  const mosaicDisc = add(new THREE.Mesh(new THREE.CylinderGeometry(mosaicRadius, mosaicRadius, 0.036, 36), sm.compassMosaic),
    -0.60, FL + 0.018, 1.26, 0, 0, 0, root);
  mosaicDisc.userData.ground = true;

  const mosaicGoldRim = new THREE.TorusGeometry(mosaicRadius + 0.04, 0.036, 8, 36);
  mosaicGoldRim.rotateX(PI * 0.5);
  add(new THREE.Mesh(mosaicGoldRim, warmGoldMat), -0.60, FL + 0.024, 1.26, 0, 0, 0, root);

  // Deep Coffered Vaulted Stone Apse + Crisp Radial Voussoir Arch framing the Seated Golem (`y <= 3.22m`!)
  add(rbox(3.30, 2.76, 0.22, 0.03, golemSeamDark, 1), -0.60, FL + 1.38, -3.32, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    add(rbox(0.50, 2.80, 0.66, 0.05, sm.travertineWarm, 1), -0.60 + sx * 1.76, FL + 1.40, -3.16, 0, 0, 0, root);
    add(rbox(0.58, 0.16, 0.72, 0.03, warmGoldMat, 1), -0.60 + sx * 1.76, FL + 2.22, -3.16, 0, 0, 0, root);
  }
  addWorldStoneArch({
    cx: -0.60, cy: 1.82, cz: -3.14,
    radius: 1.26, thickness: 0.26, depth: 0.56, segments: 13,
    rotY: 0, keystoneGlow: true, parent: root,
  });

  // ANCIENT MOSSY SEATED GUARDIAN GOLEM STATUE (`x = -0.60, z = -2.56`, crown top at `y = 3.21m < 3.25m`!)
  {
    const gx = -0.60, gz = -2.56;
    add(rbox(2.42, 0.38, 1.26, 0.06, sm.travertineDark, 1), gx, FL + 0.19, gz, 0, 0, 0, root);
    add(rbox(1.94, 0.62, 1.10, 0.14, golemTrimStone, 2), gx, FL + 0.64, gz + 0.04, 0, 0, 0, root);

    // Sleek rounded Celestian chest & beveled armor seams
    add(rbox(2.14, 1.24, 1.20, 0.30, golemSunStone, 3), gx, FL + 1.42, gz + 0.08, 0.06, 0, 0, root);
    for (const sx of [-1, 1]) {
      add(rbox(0.68, 0.82, 0.18, 0.09, golemTrimStone, 2), gx + sx * 0.66, FL + 1.46, gz + 0.56, 0.08, -sx * 0.24, -sx * 0.14, root);
      add(rbox(0.045, 0.82, 0.20, 0.01, golemSeamDark, 1), gx + sx * 0.38, FL + 1.44, gz + 0.58, 0.08, 0, -sx * 0.22, root);
    }

    buildGolemChestCore({ x: gx, y: FL + 1.46, z: gz + 0.66, radius: 0.36, tiltX: -0.08, parent: root });
    buildCelestianGolemHead({ x: gx, y: FL + 2.32, z: gz + 0.14, scale: 0.94, rotY: 0, tiltX: 0.06, parent: root });

    for (const sx of [-1, 1]) {
      const shx = gx + sx * 1.28;
      add(rbox(0.82, 0.88, 0.90, 0.26, golemSunStone, 3), shx, FL + 1.56, gz + 0.12, 0.12, 0, -sx * 0.18, root);
      add(rbox(0.68, 0.86, 0.76, 0.20, golemTrimStone, 2), shx + sx * 0.05, FL + 0.98, gz + 0.44, 0.40, 0, -sx * 0.08, root);

      const hx = gx + sx * 1.18;
      const hz = -1.68;
      add(rbox(0.74, 0.66, 0.92, 0.16, golemSunStone, 2), hx, FL + 0.46, hz, 0.05, -sx * 0.10, 0, root);
      add(rbox(0.62, 0.62, 0.46, 0.09, golemTrimStone, 2), hx - sx * 0.06, FL + 0.34, hz + 0.42, 0, 0, 0, root);
      add(rbox(0.28, 0.30, 0.06, 0.02, warmGoldMat, 1), hx - sx * 0.06, FL + 0.34, hz + 0.65, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), sm.cyanSoft), hx - sx * 0.06, FL + 0.34, hz + 0.68, 0, 0, 0, root);

      for (let m = 0; m < 15; m++) {
        pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
          shx + jr(-0.36, 0.36), FL + 1.88 + jr(-0.26, 0.22), gz + 0.18 + jr(-0.34, 0.38),
          jr(-0.25, 0.25), jr(0, TAU), jr(-0.25, 0.25),
          jr(0.72, 1.25), jr(0.30, 0.52), jr(0.72, 1.25), pick(MOSS_PAL), root);
      }

      boxCol(hx + sx * 0.06, hz, 0.72, 1.05);
    }
    boxCol(gx, gz - 0.05, 2.20, 1.18);

    // GLOWING TURQUOISE AETHER BASIN (`x = -0.60, z = -1.90`)
    const bx = gx, bz = -1.90;
    const basinBase = new THREE.CylinderGeometry(0.68, 0.74, 0.46, 22);
    basinBase.scale(1.18, 1, 0.78);
    add(new THREE.Mesh(basinBase, sm.travertinePlain), bx, FL + 0.23, bz, 0, 0, 0, root);

    const basinRim = new THREE.TorusGeometry(0.68, 0.075, 8, 24);
    basinRim.rotateX(PI * 0.5);
    basinRim.scale(1.18, 1, 0.78);
    add(new THREE.Mesh(basinRim, warmGoldMat), bx, FL + 0.48, bz, 0, 0, 0, root);

    for (const dx of [-0.36, 0, 0.36]) {
      add(rbox(0.22, 0.26, 0.06, 0.02, warmGoldMat, 1), bx + dx, FL + 0.23, bz + 0.53, 0, 0, 0, root);
    }

    const waterPool = new THREE.CylinderGeometry(0.62, 0.60, 0.05, 22);
    waterPool.scale(1.15, 1, 0.74);
    add(new THREE.Mesh(waterPool, sm.waterGlow), bx, FL + 0.46, bz, 0, 0, 0, root);
    const rippleRing = new THREE.TorusGeometry(0.32, 0.025, 6, 20);
    rippleRing.rotateX(PI * 0.5);
    add(new THREE.Mesh(rippleRing, sm.cyanSoft), bx, FL + 0.49, bz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 10), sm.cyanSoft), bx, FL + 0.56, bz, 0, 0, 0, root);
    boxCol(bx, bz - 0.06, 1.24, 0.68);
  }

  // Twin Warm Sanctuary Wall Lanterns + Carved Relief Stele
  addWarmSanctuaryLantern(1.06, 2.32, -1.22, 1.0, false, root);
  addWarmSanctuaryLantern(-2.36, 2.32, -1.22, 1.0, false, root);
  add(rbox(0.16, 1.65, 0.95, 0.03, sm.carvedStele, 1), -3.82, FL + 1.05, -2.15, 0, 0, 0, root);
  add(rbox(0.24, 0.14, 1.08, 0.03, warmGoldMat, 1), -3.80, FL + 1.92, -2.15, 0, 0, 0, root);

  // ==========================================================================
  // 4. RIGHT ROOM (`flower_cloister`): SUNLIT FLUTED COLONNADE & GARDEN BENCH
  // ==========================================================================
  const cloisterCols = [
    [4.56, 3.26],
    [4.56, 1.12],
    [4.56, -1.08],
    [4.56, -3.26],
    [2.96, -3.26],
  ];
  for (const [cx, cz] of cloisterCols) {
    buildFlutedColumn(THREE, K, { x: cx, y0: FL, z: cz, height: 1.98, radius: 0.21, parent: root });
  }

  // Crisp Radial Voussoir Stone Arches springing directly off the Cloister Column Capitals (`y <= 3.22m` in `root`!)
  for (const cz of [2.19, 0.02, -2.17]) {
    addWorldStoneArch({
      cx: 4.56, cy: 2.28, cz,
      radius: 0.88, thickness: 0.21, depth: 0.30, segments: 9,
      rotY: PI * 0.5, keystoneGlow: false, parent: root,
    });
  }
  for (const cx of [3.76, 2.16]) {
    addWorldStoneArch({
      cx, cy: 2.28, cz: -3.26,
      radius: 0.78, thickness: 0.21, depth: 0.30, segments: 7,
      rotY: PI, keystoneGlow: false, parent: root,
    });
  }

  // Curved Carved Cream-Travertine Garden Bench + Tall Warm Post Lantern (`int_04.png`!)
  {
    const bcx = 3.22, bcz = -1.65, bRad = 1.18;
    const benchSegs = 7;
    const aStart = -PI * 0.78, aEnd = -PI * 0.14;
    for (let i = 0; i < benchSegs; i++) {
      const a = aStart + ((i + 0.5) / benchSegs) * (aEnd - aStart);
      const sx = bcx + Math.cos(a) * bRad;
      const sz = bcz + Math.sin(a) * bRad;
      const yaw = -a + PI * 0.5;
      const segW = ((aEnd - aStart) * bRad) / benchSegs * 1.10;
      add(rbox(segW, 0.11, 0.48, 0.03, sm.travertinePlain, 1), sx, FL + 0.46, sz, 0, yaw, 0, root);
      add(rbox(segW * 0.94, 0.08, 0.38, 0.02, sm.travertineWarm, 1), sx, FL + 0.38, sz, 0, yaw, 0, root);
      if (i === 0 || i === 3 || i === benchSegs - 1) {
        add(rbox(0.22, 0.38, 0.42, 0.03, sm.travertineWarm, 1), sx, FL + 0.19, sz, 0, yaw, 0, root);
      }
    }
    boxCol(3.48, -2.55, 1.55, 0.62);

    add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 1.85, 8), lanternBronze), 3.68, FL + 0.92, -2.92, 0, 0, 0, root);
    addWarmSanctuaryLantern(3.68, FL + 1.98, -2.92, 0.95, false, root);
  }

  // Carved Terracotta & Gold Flower Urn at Front-Right Cloister Column (instanced blooms -> 0 extra materials!)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.16, 0.44, 12), sm.terracotta), 4.22, FL + 0.22, 2.88, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 14), warmGoldMat), 4.22, FL + 0.44, 2.88, PI * 0.5, 0, 0, root);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
      4.22 + Math.cos(a) * 0.14, FL + 0.48, 2.88 + Math.sin(a) * 0.14,
      0.2, a, 0, 0.48, 0.24, 0.48, pick(MOSS_PAL), root);
    pushInst('gw_bloom', bloomBeadGeo, sm.foliageInst,
      4.22 + Math.cos(a) * 0.16, FL + 0.58 + (i % 2) * 0.08, 2.88 + Math.sin(a) * 0.16,
      jr(0, TAU), jr(0, TAU), 0, 1.35, 1.15, 1.35, pick(BLOSSOM_CLOISTER_PAL), root);
  }

  // Lush Blooming Flower Beds around the Cloister Perimeter
  const flowerBeds = [
    [1.72, 3.18, 0.45], [2.45, 3.18, 0.52], [3.25, 3.18, 0.52], [4.05, 3.12, 0.48],
    [1.72, 1.85, 0.38], [1.72, -2.75, 0.44], [2.55, -2.95, 0.46], [4.22, -2.65, 0.44],
    [4.25, -1.65, 0.40], [4.28, 0.88, 0.40],
  ];
  for (const [fx, fz, rad] of flowerBeds) {
    for (let m = 0; m < 5; m++) {
      pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
        fx + jr(-rad, rad), FL + 0.06, fz + jr(-rad, rad),
        jr(-0.15, 0.15), jr(0, TAU), jr(-0.15, 0.15),
        jr(0.55, 0.95), jr(0.22, 0.38), jr(0.55, 0.95), pick(MOSS_PAL), root);
    }
    for (let b = 0; b < 10; b++) {
      const sc = jr(0.88, 1.38);
      pushInst('gw_bloom', bloomBeadGeo, sm.foliageInst,
        fx + jr(-rad, rad), FL + jr(0.14, 0.34), fz + jr(-rad, rad),
        jr(0, TAU), jr(0, TAU), 0,
        sc, sc * 0.88, sc, pick(BLOSSOM_CLOISTER_PAL), root);
    }
  }

  for (let i = 0; i < 24; i++) {
    const bx = jr(1.65, 4.35), bz = 3.40 + jr(-0.14, 0.14);
    pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
      bx, 0.94, bz, 0, jr(0, TAU), 0, jr(0.45, 0.78), 0.25, jr(0.45, 0.72), pick(MOSS_PAL), root);
    const sc = jr(0.88, 1.38);
    pushInst('gw_bloom', bloomBeadGeo, sm.foliageInst,
      bx + jr(-0.08, 0.08), 1.06 + jr(0, 0.14), bz + jr(-0.08, 0.08),
      jr(0, TAU), jr(0, TAU), 0, sc, sc, sc, pick(BLOSSOM_CLOISTER_PAL), root);
  }

  addMossBlossomVine([[-4.15, 0.45, 3.65], [-4.22, 1.45, 3.25], [-4.05, 2.45, 2.65], [-3.65, 3.10, 2.25]],
    { blooms: WILDFLOWER_PAL, nSteps: 20, parent: root });
  addMossBlossomVine([[4.66, 0.85, 3.28], [4.68, 1.95, 3.24], [4.55, 2.92, 2.80], [4.55, 3.08, 1.65]],
    { blooms: BLOSSOM_CLOISTER_PAL, nSteps: 22, parent: root });

  buildWisteriaRacemes(THREE, K, {
    cx: 4.54, yTop: 2.85, cz: 2.15,
    spanX: 1.35, strands: 7, maxLen: 0.92, rotY: PI * 0.5, parent: root, batchPrefix: 'gw_wist',
  });
  buildWisteriaRacemes(THREE, K, {
    cx: 3.05, yTop: 2.85, cz: -3.24,
    spanX: 2.20, strands: 9, maxLen: 0.88, rotY: 0, parent: root, batchPrefix: 'gw_wist',
  });

  // ==========================================================================
  // 5. EXTERIOR CUTAWAY CARAPACE, GRAND TEMPLE ARCH & UPPER ZIGGURAT (`K.roofG`)
  // ==========================================================================
  for (const sx of [-1, 1]) {
    const px = -0.60 + sx * 1.22;
    add(rbox(0.44, 1.98, 0.50, 0.04, sm.travertinePlain, 1), px, FL + 0.99, 3.70, 0, 0, 0, roofG);
    add(rbox(0.56, 0.16, 0.60, 0.03, warmGoldMat, 1), px, FL + 1.98, 3.70, 0, 0, 0, roofG);
    add(rbox(0.60, 0.14, 0.64, 0.03, sm.travertinePlain, 1), px, FL + 2.12, 3.70, 0, 0, 0, roofG);
  }
  // Crisp radial voussoir stone arch around the front temple portal (`ext_04.png`!)
  addWorldStoneArch({
    cx: -0.60, cy: 2.22, cz: 3.68,
    radius: 1.08, thickness: 0.26, depth: 0.50, segments: 13,
    rotY: 0, keystoneGlow: false, parent: roofG,
  });
  // Solid spandrel backing tucked behind the waist conduits & below the cyan chest core!
  add(rbox(2.90, 0.78, 0.38, 0.04, sm.travertineWarm, 1), -0.60, 2.95, 2.78, 0, 0, 0, roofG);

  {
    const runeArchGeo = new THREE.TorusGeometry(1.34, 0.16, 10, 24, PI);
    add(new THREE.Mesh(runeArchGeo, warmGoldMat), -0.60, 2.24, 3.72, 0, 0, 0, roofG);
    const outerStoneArch = new THREE.TorusGeometry(1.49, 0.14, 8, 24, PI);
    add(new THREE.Mesh(outerStoneArch, sm.travertinePlain), -0.60, 2.24, 3.68, 0, 0, 0, roofG);
    add(rbox(0.40, 0.42, 0.42, 0.04, warmGoldMat, 1), -0.60, 3.62, 3.74, 0, 0, 0, roofG);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), sm.cyanCrystal), -0.60, 3.62, 3.96, 0, 0, 0, roofG);
  }

  // Warm Golden Armillary Sanctuary Chandelier glowing inside the arched portal (`ext_04.png`!)
  addWarmSanctuaryLantern(-0.60, 1.92, 2.48, 1.28, true, roofG);

  // Exterior Stepped Ziggurat Pyramid Courses (tightly-jointed Celestian ashlar blocks!)
  addZigguratBlockVolume({ x0: -3.82, x1: -1.84, z0: 2.78, z1: 3.48, y0: 1.22, y1: 2.24, parent: roofG });
  addZigguratBlockVolume({ x0: -3.56, x1: -1.94, z0: 2.15, z1: 2.95, y0: 2.24, y1: 3.18, parent: roofG });

  addZigguratBlockVolume({ x0: 1.82, x1: 4.86, z0: 2.95, z1: 3.68, y0: 0.92, y1: 1.48, parent: roofG });
  addZigguratBlockVolume({ x0: 0.68, x1: 4.42, z0: 2.35, z1: 3.22, y0: 1.48, y1: 2.38, parent: roofG });
  addZigguratBlockVolume({ x0: 0.85, x1: 3.88, z0: 1.75, z1: 2.68, y0: 2.38, y1: 3.24, parent: roofG });

  addZigguratBlockVolume({ x0: -3.45, x1: 3.45, z0: -3.28, z1: 2.22, y0: 3.18, y1: 3.98, parent: roofG });

  addZigguratBlockVolume({ x0: -2.95, x1: -1.78, z0: -2.45, z1: 1.95, y0: 3.98, y1: 4.86, parent: roofG });
  addZigguratBlockVolume({ x0: 0.68, x1: 2.25, z0: -2.35, z1: 1.85, y0: 3.98, y1: 4.76, parent: roofG });
  addZigguratBlockVolume({ x0: -1.78, x1: 0.68, z0: -2.65, z1: 0.25, y0: 3.98, y1: 4.88, parent: roofG });

  addRuneMedallion(-2.48, 1.74, 3.50, 0, 0.86, roofG);
  addRuneMedallion(-2.62, 2.72, 2.98, 0, 0.82, roofG);
  addRuneMedallion(-2.38, 4.42, 1.98, 0, 0.78, roofG);
  addRuneMedallion(2.85, 1.94, 3.25, 0, 0.88, roofG);
  addRuneMedallion(2.42, 2.82, 2.70, 0, 0.82, roofG);
  addRuneMedallion(1.48, 4.38, 1.88, 0, 0.76, roofG);

  // ==========================================================================
  // 6. COLOSSAL EXTERIOR CELESTIAN GUARDIAN GOLEM (`ext_04.png` HERO CENTERPIECE!)
  // ==========================================================================
  {
    const ex = -0.58, ez = 1.72;

    // Segmented Curved Stone Waist/Shoulder Conduits straddling the front doorway arch
    for (const sx of [-1, 1]) {
      const segPts = [
        [ex + sx * 0.44, 3.84, ez + 0.92],
        [ex + sx * 0.82, 3.70, ez + 1.24],
        [ex + sx * 1.15, 3.48, ez + 1.52],
        [ex + sx * 1.42, 3.22, ez + 1.76],
      ];
      for (let i = 0; i < segPts.length; i++) {
        const [px, py, pz] = segPts[i];
        const sc = 1 - i * 0.06;
        add(rbox(0.52 * sc, 0.44 * sc, 0.48 * sc, 0.16, i % 2 === 0 ? golemSunStone : golemTrimStone, 2),
          px, py, pz, 0.35, sx * 0.32, -sx * 0.48, roofG);
      }
    }

    // Smooth Rounded Celestian Stone Chest / Carapace (`ext_04.png`!)
    add(rbox(2.62, 1.48, 1.68, 0.36, golemSunStone, 3), ex, 4.26, ez + 0.04, 0.08, 0, 0, roofG);
    for (const sx of [-1, 1]) {
      add(rbox(0.84, 0.92, 0.22, 0.12, golemTrimStone, 2), ex + sx * 0.80, 4.30, ez + 0.74, 0.10, -sx * 0.26, -sx * 0.14, roofG);
      add(rbox(0.05, 0.94, 0.24, 0.01, golemSeamDark, 1), ex + sx * 0.44, 4.26, ez + 0.78, 0.10, 0, -sx * 0.20, roofG);
    }

    const collarTorus = new THREE.TorusGeometry(0.82, 0.14, 10, 22);
    collarTorus.rotateX(PI * 0.5 + 0.10);
    add(new THREE.Mesh(collarTorus, golemTrimStone), ex, 4.90, ez + 0.06, 0, 0, 0, roofG);

    buildGolemChestCore({ x: ex, y: 4.20, z: ez + 0.90, radius: 0.48, tiltX: -0.14, parent: roofG });

    for (const sx of [-1, 1]) {
      const shx = ex + sx * 1.56;
      add(rbox(0.98, 1.12, 1.18, 0.30, golemSunStone, 3), shx, 4.30, ez + 0.08, 0.14, 0, -sx * 0.18, roofG);
      add(rbox(0.84, 0.86, 0.98, 0.24, golemTrimStone, 2), shx + sx * 0.12, 3.68, ez + 0.30, 0.26, 0, -sx * 0.10, roofG);

      for (let m = 0; m < 22; m++) {
        const mx = shx + jr(-0.52, 0.52);
        const my = 4.84 + jr(-0.24, 0.22);
        const mz = ez + 0.14 + jr(-0.50, 0.56);
        pushInst('gw_moss', mossPuffGeo, sm.foliageInst,
          mx, my, mz, jr(-0.25, 0.25), jr(0, TAU), jr(-0.25, 0.25),
          jr(0.82, 1.38), jr(0.34, 0.58), jr(0.82, 1.38), pick(MOSS_PAL), roofG);
        if (m % 2 === 0) {
          const sc = jr(0.95, 1.45);
          pushInst('gw_bloom', bloomBeadGeo, sm.foliageInst,
            mx + jr(-0.12, 0.12), my + jr(0.10, 0.22), mz + jr(-0.12, 0.12),
            jr(0, TAU), jr(0, TAU), 0, sc, sc * 0.85, sc, pick(WILDFLOWER_PAL), roofG);
        }
      }
    }

    addMossBlossomVine([[ex - 1.15, 4.85, ez + 0.50], [ex - 0.72, 4.52, ez + 0.82], [ex - 0.48, 4.12, ez + 0.92]],
      { blooms: WILDFLOWER_PAL, nSteps: 12, parent: roofG });
    addMossBlossomVine([[ex + 1.08, 4.80, ez + 0.48], [ex + 0.68, 4.48, ez + 0.80], [ex + 0.45, 4.08, ez + 0.90]],
      { blooms: WILDFLOWER_PAL, nSteps: 12, parent: roofG });

    buildCelestianGolemHead({
      x: ex, y: 5.48, z: ez - 0.02,
      scale: 1.26, rotY: 0.08, tiltX: 0.06, parent: roofG,
    });
  }

  // ==========================================================================
  // 7. SUNLIT STORYBOOK TREES SPROUTING FROM REAR & SIDE ZIGGURAT TERRACES (`roofG`)
  // ==========================================================================
  buildGnarledRootTube(THREE, K, {
    points: [
      [-2.65, 3.65, -0.85],
      [-3.25, 4.55, -0.75],
      [-3.05, 5.38, -0.45],
      [-2.35, 5.82, -0.25],
    ],
    rStart: 0.30, rEnd: 0.11, mossy: true, parent: roofG, batchPrefix: 'gw_tree',
  });
  buildGnarledRootTube(THREE, K, {
    points: [
      [-3.12, 4.38, -0.72],
      [-4.10, 4.78, -0.35],
      [-4.65, 5.02, 0.05],
    ],
    rStart: 0.20, rEnd: 0.08, mossy: false, parent: roofG, batchPrefix: 'gw_tree',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: -2.65, cy: 5.95, cz: -0.35,
    rx: 1.85, ry: 1.02, rz: 1.45, puffs: 24,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'gw_canopy',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: -4.45, cy: 5.08, cz: -0.05,
    rx: 1.42, ry: 0.86, rz: 1.25, puffs: 16,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'gw_canopy',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: -4.65, cy: 3.72, cz: -1.85,
    rx: 1.25, ry: 0.78, rz: 1.25, puffs: 14,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'gw_canopy',
  });

  buildGnarledRootTube(THREE, K, {
    points: [
      [1.65, 3.95, -0.85],
      [2.15, 4.82, -0.65],
      [1.85, 5.38, -0.45],
    ],
    rStart: 0.22, rEnd: 0.09, mossy: true, parent: roofG, batchPrefix: 'gw_tree',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: 1.75, cy: 5.52, cz: -0.45,
    rx: 1.42, ry: 0.85, rz: 1.22, puffs: 16,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'gw_canopy',
  });

  buildGnarledRootTube(THREE, K, {
    points: [
      [3.15, 3.35, 0.45],
      [3.95, 3.98, 0.65],
      [4.35, 4.48, 0.55],
    ],
    rStart: 0.20, rEnd: 0.08, mossy: true, parent: roofG, batchPrefix: 'gw_tree',
  });
  buildFoliageCanopyCluster(THREE, K, {
    cx: 4.15, cy: 4.62, cz: 0.55,
    rx: 1.38, ry: 0.82, rz: 1.18, puffs: 15,
    palette: FOLIAGE_SUN_PAL, parent: roofG, batchPrefix: 'gw_canopy',
  });

  // ==========================================================================
  // 8. REQUIRED `root.userData` METADATA, ROOMS, DOORS, HIDE SPOT & PROP SLOTS
  // ==========================================================================
  root.userData.footprint = { w: 10.2, d: 8.2 };
  root.userData.footprintBox = { w: 10.2, d: 8.2 };
  root.userData.rooms = [
    { name: 'golem_sanctum', x: -1.30, z: 0.0, w: 5.30, d: 6.85, walkX: -0.55, walkZ: 1.25 },   // x ∈ [-3.95, 1.35]
    { name: 'flower_cloister', x: 2.94, z: 0.0, w: 3.18, d: 6.70, walkX: 2.85, walkZ: 0.35 },   // x ∈ [1.35, 4.53]
  ];
  root.userData.door = { x: -0.6, z: 5.55 };
  root.userData.doorIn = { x: -0.6, z: 2.8 };
  root.userData.innerDoors = [{ x: 1.35, z: 0.3 }];
  root.userData.golemHideSpot = { x: -0.6, y: FL, z: -1.35 };

  root.userData.propSlots = [
    // Left Room (`golem_sanctum` — 5 slots)
    { id: 'sr_golem_head', x: -3.05, y: FL, z: -1.85, rot: 0.45 },
    { id: 'sr_stone_stele', x: -3.12, y: FL, z: -0.38, rot: 1.35 },
    { id: 'sr_levitation_urn', x: -2.95, y: FL, z: 1.15, rot: 0.28 },
    { id: 'sr_crystal_lantern', x: -2.35, y: FL, z: 2.28, rot: 0.18 },
    { id: 'sr_crystal_lantern', x: 0.68, y: FL, z: 2.24, rot: -0.22 },
    // Right Room (`flower_cloister` — 5 slots)
    { id: 'sr_cloud_planter', x: 2.22, y: FL, z: 2.18, rot: 0.35 },
    { id: 'sr_cloud_planter', x: 3.74, y: FL, z: 2.04, rot: -0.55 },
    { id: 'sr_levitation_urn', x: 3.82, y: FL, z: 0.25, rot: -1.45 },
    { id: 'sr_stone_stele', x: 2.15, y: FL, z: -1.82, rot: 0.52 },
    { id: 'sr_golem_head', x: 3.80, y: FL, z: -0.92, rot: -0.85 },
  ];

  K.finalize();

  // Strictly enforce metalness = 0 across 100% of materials!
  root.traverse((o) => {
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => { if (m) m.metalness = 0; });
      else o.material.metalness = 0;
    }
  });

  return root;
}
