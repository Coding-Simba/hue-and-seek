/* Hue & Seek — Map 2: Celestia Sky-Ruins (`maps/skyruins/props.js`)
 * 12 hand-sculpted Storybook sky-island & airship props matched 1:1 to
 * `assets/maps/skyruins/props_sheet.png` (`prop_01.png` .. `prop_12.png`),
 * plus 3 bespoke Sky-Ruins interactive hiding disguises:
 *   - `buildRootClingPod(THREE)`
 *   - `buildHoveringRuneStone(THREE)`
 *   - `buildDormantGolemCore(THREE)`
 *
 * STRICT STORYBOOK SHADING: `metalness: 0` on EVERY SINGLE MATERIAL (since `scene.environment` is `null`),
 * using warm golden Storybook diffuse colors + subtle warm emissive on brass/bronze and radiant
 * cyan/amber/orchid emissives on Skyglass crystals, runes, sight-glasses & sky-orchids.
 * Every prop has origin at ground center (y = 0), front facing +Z, <= 8 draw calls, <= 12k tris.
 */
import {
  createPropBuilder,
  paintedCanvasTex,
  brushStrokes,
  gouacheGrainTex,
  kitTex,
  mergeGeometries,
} from '../map_kit.js?v=2';
import { attachCreatureKinematics } from '../world_interactives.js?v=v10';

const PI = Math.PI;
const TAU = PI * 2;

export const PROPS = [
  { id: 'sr_levitation_urn',   label: 'Levitation Urn',      icon: '🏺', radius: 0.44, height: 1.08 },
  { id: 'sr_golem_head',       label: 'Guardian Head',       icon: '🗿', radius: 0.50, height: 0.88 },
  { id: 'sr_sky_compass',      label: 'Sky Armillary',       icon: '🧭', radius: 0.35, height: 1.04 },
  { id: 'sr_pirate_chest',     label: 'Sky-Pirate Trunk',    icon: '🧰', radius: 0.52, height: 0.74 },
  { id: 'sr_cloud_planter',    label: 'Orchid Basin',        icon: '🌺', radius: 0.48, height: 0.92 },
  { id: 'sr_propeller_barrel', label: 'Airship Fuel Cask',   icon: '🛢️', radius: 0.52, height: 0.86 },
  { id: 'sr_wind_chime_stand', label: 'Bronze Wind Bells',   icon: '🎐', radius: 0.54, height: 1.18 },
  { id: 'sr_crystal_lantern',  label: 'Aether Cage Lantern', icon: '💎', radius: 0.34, height: 0.96 },
  { id: 'sr_stone_stele',      label: 'Celestian Monolith',    icon: '🪨', radius: 0.48, height: 1.24 },
  { id: 'sr_telescope_tripod', label: 'Brass Spyglass',      icon: '🔭', radius: 0.46, height: 1.16 },
  { id: 'sr_specimen_crate',   label: 'Botanist Crate',      icon: '🌿', radius: 0.50, height: 0.88 },
  { id: 'sr_ornithopter_seat',     label: 'Ornithopter Seat',    icon: '💺', radius: 0.50, height: 1.12 },
  { id: 'sr_sky_manta',        label: 'Floating Sky-Manta',  icon: '🐋', radius: 0.46, height: 0.86, isAnimal: true, canFly: true, flyMaxY: 16.0, flapIntervalMs: 480, flapPitch: 0.74 },
  { id: 'sr_fox_squirrel',     label: 'Sky-Ruin Glider',   icon: '🐿️', radius: 0.31, height: 0.68, isAnimal: true },
];

export const PROP_ICONS = Object.fromEntries(PROPS.map((p) => [p.id, p.icon]));

const _kitCache = new WeakMap();

// Ensure geometries merged manually (e.g. multi-part glass) have matching non-indexed attributes
function prepMergeGeo(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Sculpted faceted hexagonal bipyramid Skyglass crystal with sharp Celestian bevel waist
function makeFacetedCrystalGeo(THREE, rx = 0.12, hTop = 0.23, hBot = 0.20, sides = 6) {
  const waist = 0.032 * Math.min(hTop, hBot) / 0.18;
  const coneTop = new THREE.ConeGeometry(rx, hTop, sides, 1, true);
  coneTop.translate(0, waist + hTop * 0.5, 0);
  const belt = new THREE.CylinderGeometry(rx, rx * 0.96, waist * 2, sides, 1, true);
  const coneBot = new THREE.ConeGeometry(rx * 0.96, hBot, sides, 1, true);
  coneBot.rotateX(PI);
  coneBot.translate(0, -waist - hBot * 0.5, 0);
  const out = mergeGeometries([prepMergeGeo(coneTop), prepMergeGeo(belt), prepMergeGeo(coneBot)], false);
  coneTop.dispose();
  belt.dispose();
  coneBot.dispose();
  out.computeVertexNormals();
  return out;
}

function getSkyPropKit(THREE) {
  if (_kitCache.has(THREE)) return _kitCache.get(THREE);

  const { buildMergedProto, add, rbox: rawRbox, lathe, tube } = createPropBuilder(THREE, 202);
  const rbox = (w, h, d, r = 0.025, seg = 1) => rawRbox(w, h, d, r, seg);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  const customMats = new Map();
  // Strict metalness: 0 material factory so gold, brass, verdigris, azure & iron glow warmly without HDRI!
  const cMat = (key, hex, map = null, extra = {}) => {
    const safe = Object.assign({}, extra, { metalness: 0 });
    if (!customMats.has(key)) {
      customMats.set(key, new THREE.MeshStandardMaterial(Object.assign({
        color: hex,
        map: map || null,
        roughness: 0.88,
        metalness: 0,
      }, safe)));
    }
    return customMats.get(key);
  };

  // Hand-painted Storybook procedural surface maps
  const grainTex = gouacheGrainTex(THREE, 2.0, 2.0);

  const verdigrisPatinaTex = paintedCanvasTex(THREE, 'sr_verdigris_patina_v3', 256, (g, s, rng) => {
    g.fillStyle = '#dceee6';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 340, ['#cce6dc', '#b6d8cb', '#ebf7f2', '#f3e3ba'], 3, 10, 0.42, 0.2, 3.14, 26);
    brushStrokes(g, s, rng, 140, ['#ead08e', '#a5cbbd'], 1.5, 4.5, 0.32, 1.57, 0.8, 20);
  }, 1.6, 1.6);

  const azureStarTex = paintedCanvasTex(THREE, 'sr_azure_star_v3', 256, (g, s, rng) => {
    g.fillStyle = '#d4e6fa';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 260, ['#bed8f4', '#e8f2ff', '#afd0f0'], 3, 9, 0.38, 0, 3.14, 24);
    g.fillStyle = '#fff3b4';
    for (let i = 0; i < 68; i++) {
      const x = rng.jr(8, s - 8), y = rng.jr(8, s - 8), r = rng.jr(1.5, 3.2);
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  }, 2.0, 2.0);

  const crimsonTrunkTex = paintedCanvasTex(THREE, 'sr_crimson_trunk_v3', 256, (g, s, rng) => {
    g.fillStyle = '#e4cec8';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 360, ['#eedad4', '#cdb2aa', '#dfc4bc', '#f2dcc0'], 3, 10, 0.38, 0, 0.65, 32);
    brushStrokes(g, s, rng, 95, ['#f0d49c', '#bfa098'], 1.5, 3.5, 0.28, 0.5, 3.14, 16);
  }, 1.5, 1.5);

  const orchidPetalTex = paintedCanvasTex(THREE, 'sr_orchid_petal_v3', 128, (g, s) => {
    const gr = g.createRadialGradient(s * 0.5, s * 0.84, s * 0.05, s * 0.5, s * 0.50, s * 0.62);
    gr.addColorStop(0.0, '#ffffff');
    gr.addColorStop(0.34, '#aaf4ff');
    gr.addColorStop(0.68, '#55a4ff');
    gr.addColorStop(1.0, '#366ce0');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(34, 78, 196, 0.30)';
    g.lineWidth = 1.6;
    for (let i = -4; i <= 4; i++) {
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.88);
      g.quadraticCurveTo(s * (0.5 + i * 0.08), s * 0.5, s * (0.5 + i * 0.11), s * 0.08);
      g.stroke();
    }
  }, 1, 1);

  // Calibrated Storybook & Celestian materials — 100% metalness: 0!
  const mStone         = cMat('stone',        0xf2e6d0, kitTex(THREE, 'plaster', 1.6, 1.6), { roughness: 0.90 });
  const mStoneDark     = cMat('stoneDk',      0xcab596, kitTex(THREE, 'stone', 1.6, 1.6),   { roughness: 0.93 });
  const mMoss          = cMat('moss',         0x8ecc4c, kitTex(THREE, 'leaves', 1.7, 1.7),  { roughness: 0.82, side: THREE.DoubleSide });
  const mFern          = cMat('fern',         0x7cc440, kitTex(THREE, 'leaves', 1.3, 1.3),  { roughness: 0.76, side: THREE.DoubleSide });
  const mBrass         = cMat('brass',        0xf2be4e, grainTex,                            { roughness: 0.40, emissive: 0x764908, emissiveIntensity: 0.17 });
  const mBrassDark     = cMat('brassDk',      0xc88a28, grainTex,                            { roughness: 0.48, emissive: 0x482804, emissiveIntensity: 0.11 });
  const mVerdigris     = cMat('verdigris',    0x68ab92, verdigrisPatinaTex,                  { roughness: 0.62, emissive: 0x163a2e, emissiveIntensity: 0.10 });
  const mAzure         = cMat('azure',        0x2e6ab0, azureStarTex,                        { roughness: 0.48, emissive: 0x0d2b52, emissiveIntensity: 0.16 });
  const mWood          = cMat('wood',         0xc58b52, kitTex(THREE, 'wood_light', 1.3, 1.3), { roughness: 0.84 });
  const mWoodDark      = cMat('woodDk',       0x8d5632, kitTex(THREE, 'wood_planks_dark', 1.3, 1.3), { roughness: 0.82 });
  const mCrimson       = cMat('crimson',      0x9c3834, crimsonTrunkTex,                     { roughness: 0.74, emissive: 0x2c0806, emissiveIntensity: 0.08 });
  const mPennant       = cMat('pennant',      0xdc4438, grainTex,                            { roughness: 0.76, emissive: 0x3b0a06, emissiveIntensity: 0.10, side: THREE.DoubleSide });
  const mLeather       = cMat('leather',      0x9a4836, grainTex,                            { roughness: 0.64, emissive: 0x2b0d06, emissiveIntensity: 0.09 });
  const mRope          = cMat('rope',         0xe8ca8c, kitTex(THREE, 'hay', 2.2, 2.2),      { roughness: 0.86 });
  const mWing          = cMat('wing',         0xedd29e, grainTex,                            { roughness: 0.72, emissive: 0x483110, emissiveIntensity: 0.09, side: THREE.DoubleSide });
  const mIron          = cMat('iron',         0x463d38, grainTex,                            { roughness: 0.62 });
  const mCream         = cMat('cream',        0xfffaf0, grainTex,                            { roughness: 0.68, emissive: 0x383020, emissiveIntensity: 0.08, side: THREE.DoubleSide });
  const mPollen        = cMat('pollen',       0xf8be30, null,                                { roughness: 0.48, emissive: 0xa45e06, emissiveIntensity: 0.26 });
  const mOrchid        = cMat('orchid',       0xffffff, orchidPetalTex,                      { roughness: 0.42, emissive: 0x1b5fd6, emissiveIntensity: 0.44, side: THREE.DoubleSide });
  const mWisteria      = cMat('wisteria',     0xb684f4, null,                                { roughness: 0.58, emissive: 0x4a228c, emissiveIntensity: 0.26 });
  const mWisteriaLight = cMat('wisteriaLt',   0xe4ceff, null,                                { roughness: 0.60, emissive: 0x5c349c, emissiveIntensity: 0.22, side: THREE.DoubleSide });
  const mCyanGlow      = cMat('cyanGlow',     0x2ad8ff, null,                                { roughness: 0.22, emissive: 0x0ab4f4, emissiveIntensity: 1.05, side: THREE.DoubleSide });
  const mCyanCore      = cMat('cyanCore',     0xd4fcff, null,                                { roughness: 0.16, emissive: 0x5ae6ff, emissiveIntensity: 1.38 });
  const mAmberGlow     = cMat('amberGlow',    0xffb830, null,                                { roughness: 0.22, emissive: 0xf47e08, emissiveIntensity: 1.12 });
  const mGlass         = cMat('glass',        0xd4f4ff, null,                                { roughness: 0.14, transparent: true, opacity: 0.36, depthWrite: false });

  const cyl = (rt, rb, h, seg = 14, open = false, ts = 0, tl = TAU) =>
    new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl);
  const sph = (r = 1, ws = 8, hs = 6, ps = 0, pl = TAU, ts = 0, tl = PI) =>
    new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl);
  const tor = (R, r, rs = 5, ts = 18, arc = TAU) => new THREE.TorusGeometry(R, r, rs, ts, arc);

  function addLeaf(g, m, x, y, z, rx = 0, ry = 0, rz = 0, len = 0.085, wid = 0.048) {
    return add(g, sph(1, 6, 4), m, x, y, z, rx, ry, rz, wid, 0.014, len);
  }

  function addClover(g, m, x, y, z, rx = 0, ry = 0, rz = 0, sc = 1) {
    const cg = new THREE.Group();
    cg.position.set(x, y, z);
    cg.rotation.set(rx, ry, rz);
    cg.scale.setScalar(sc);
    g.add(cg);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      add(cg, sph(1, 5, 4), m, Math.cos(a) * 0.024, 0, Math.sin(a) * 0.024, 0.15, -a + PI / 2, 0, 0.022, 0.008, 0.026);
    }
  }

  function addVine(g, m, pts, r = 0.011, leaves = 6) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    add(g, new THREE.TubeGeometry(curve, Math.max(7, pts.length * 2 + 2), r, 4, false), m);
    for (let i = 1; i <= leaves; i++) {
      const t = i / (leaves + 0.35);
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const side = i % 2 ? 1 : -1;
      const yaw = Math.atan2(tan.x, tan.z) + side * 0.85;
      const taper = 1 - t * 0.30;
      addLeaf(g, m, p.x + side * 0.018, p.y, p.z, 0.35, yaw, side * 0.28, 0.060 * taper, 0.040 * taper);
    }
  }

  function addMossClump(g, m, x, y, z, s = 0.09) {
    add(g, sph(1, 7, 5), m, x, y, z, 0, 0, 0, s * 1.28, s * 0.54, s * 1.02);
    add(g, sph(1, 6, 4), m, x + s * 0.56, y - s * 0.08, z + s * 0.24, 0, 0.4, 0, s * 0.82, s * 0.46, s * 0.76);
    add(g, sph(1, 6, 4), m, x - s * 0.48, y - s * 0.10, z - s * 0.20, 0, -0.3, 0, s * 0.72, s * 0.42, s * 0.68);
  }

  function addDaisy(g, mPetal, mCenter, x, y, z, rx = 0, ry = 0, rz = 0, sc = 1) {
    const fg = new THREE.Group();
    fg.position.set(x, y, z);
    fg.rotation.set(rx, ry, rz);
    fg.scale.setScalar(sc);
    g.add(fg);
    const petals = 8;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU;
      add(fg, sph(1, 5, 4), mPetal, Math.cos(a) * 0.040, 0, Math.sin(a) * 0.040, 0.10, -a + PI / 2, 0, 0.017, 0.007, 0.035);
    }
    add(fg, sph(1, 6, 4), mCenter, 0, 0.007, 0, 0, 0, 0, 0.022, 0.014, 0.022);
  }

  function addOrchid(g, x, y, z, rx = 0.42, ry = 0, rz = 0, sc = 1) {
    const fg = new THREE.Group();
    fg.position.set(x, y, z);
    fg.rotation.set(rx, ry, rz);
    fg.scale.setScalar(sc);
    g.add(fg);
    const specs = [
      [0.0,   0.040, 0.078, -0.18],
      [1.14,  0.054, 0.084, -0.24],
      [-1.14, 0.054, 0.084, -0.24],
      [2.32,  0.044, 0.080, -0.20],
      [-2.32, 0.044, 0.080, -0.20],
    ];
    for (const [a, w, l, cup] of specs) {
      add(fg, sph(1, 8, 6), mOrchid, Math.sin(a) * 0.058, Math.cos(a) * 0.058, 0.012, cup, 0, -a, w, l, 0.012);
    }
    add(fg, sph(1, 7, 5), mCyanGlow, 0, 0.002, 0.022, 0, 0, 0, 0.028, 0.028, 0.016);
    add(fg, sph(1, 6, 4), mPollen, 0, -0.018, 0.036, 0.30, 0, 0, 0.019, 0.025, 0.015);
    add(fg, sph(1, 5, 4), mWisteriaLight, -0.014, -0.006, 0.032, 0, 0,  0.3, 0.011, 0.018, 0.010);
    add(fg, sph(1, 5, 4), mWisteriaLight,  0.014, -0.006, 0.032, 0, 0, -0.3, 0.011, 0.018, 0.010);
  }

  function addSquareSpiralRune(g, mLine, x, y, z, ry = 0, s = 0.08) {
    const rg = new THREE.Group();
    rg.position.set(x, y, z);
    rg.rotation.y = ry;
    g.add(rg);
    const t = s * 0.14;
    add(rg, box(s, t, t), mLine, 0, s * 0.43, 0);
    add(rg, box(t, s, t), mLine, s * 0.43, 0, 0);
    add(rg, box(s * 0.86, t, t), mLine, -s * 0.07, -s * 0.43, 0);
    add(rg, box(t, s * 0.68, t), mLine, -s * 0.43, -s * 0.09, 0);
    add(rg, box(s * 0.52, t, t), mLine, -s * 0.17, s * 0.18, 0);
    add(rg, sph(t * 0.85, 6, 4), mLine, 0, -s * 0.04, 0);
  }

  // ==========================================================================
  // 1. sr_levitation_urn — Carved Celestian stone urn w/ arcade niches, vines & luminous cyan rune bands
  // ==========================================================================
  function sr_levitation_urn() {
    return buildMergedProto('sr_levitation_urn', (g) => {
      add(g, cyl(0.24, 0.26, 0.058, 18), mStone, 0, 0.029, 0);
      add(g, cyl(0.19, 0.225, 0.048, 18), mStoneDark, 0, 0.080, 0);

      const urnProf = [
        [0.0, 0.095], [0.165, 0.10], [0.142, 0.175], [0.162, 0.235],
        [0.248, 0.315], [0.302, 0.44], [0.314, 0.555], [0.282, 0.675],
        [0.196, 0.748], [0.176, 0.815], [0.222, 0.852], [0.205, 0.885], [0.0, 0.885],
      ];
      add(g, lathe(urnProf, 22), mStone, 0, 0, 0);

      const lidProf = [
        [0.0, 0.885], [0.188, 0.885], [0.172, 0.928], [0.118, 0.972],
        [0.056, 1.005], [0.092, 1.032], [0.082, 1.052], [0.036, 1.078], [0.0, 1.092],
      ];
      add(g, lathe(lidProf, 18), mStone, 0, 0, 0);
      add(g, tor(0.214, 0.018, 6, 22), mStoneDark, 0, 0.858, 0, PI / 2, 0, 0);
      add(g, tor(0.172, 0.015, 5, 18), mBrass, 0, 0.242, 0, PI / 2, 0, 0);

      // Base & neck arched niches w/ glowing cyan slits
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const sx = Math.sin(a), cz = Math.cos(a);
        add(g, tor(0.028, 0.008, 4, 8, PI), mStoneDark, sx * 0.152, 0.155, cz * 0.152, 0, a, 0);
        add(g, box(0.020, 0.062, 0.018), mCyanGlow, sx * 0.146, 0.142, cz * 0.146, 0, a, 0);
        add(g, tor(0.028, 0.008, 4, 8, PI), mStoneDark, sx * 0.184, 0.785, cz * 0.184, 0, a, 0);
        add(g, box(0.018, 0.042, 0.016), mCyanGlow, sx * 0.178, 0.775, cz * 0.178, 0, a, 0);
      }

      // Shoulder blind-arcade relief arches
      for (let i = 0; i < 8; i++) {
        if (i === 0 || i === 4) continue;
        const a = (i / 8) * TAU;
        const sx = Math.sin(a), cz = Math.cos(a);
        add(g, tor(0.056, 0.015, 5, 12, PI), mStoneDark, sx * 0.298, 0.575, cz * 0.298, -0.18, a, 0);
        add(g, box(0.044, 0.034, 0.038), mStoneDark, sx * 0.308, 0.562, cz * 0.308, 0, a, 0);
        add(g, box(0.032, 0.18, 0.028), mStoneDark, sx * 0.292, 0.45, cz * 0.292, 0.12, a, 0);
      }

      // Front (+Z) & Back (-Z) Hero Glowing Cyan Medallion Bezels
      for (const sz of [1, -1]) {
        const ry = sz > 0 ? 0 : PI;
        add(g, tor(0.112, 0.020, 6, 18, PI), mStoneDark, 0, 0.565, sz * 0.292, sz * -0.16, ry, 0);
        add(g, tor(0.088, 0.020, 6, 18), mStoneDark, 0, 0.535, sz * 0.296, 0, ry, 0);
        add(g, tor(0.068, 0.010, 5, 16), mBrass, 0, 0.535, sz * 0.308, 0, ry, 0);
        add(g, sph(0.056, 12, 8), mCyanGlow, 0, 0.535, sz * 0.302, 0, 0, 0, 1, 1, 0.62);
        add(g, sph(0.034, 8, 6), mCyanCore, 0, 0.535, sz * 0.322, 0, 0, 0, 1, 1, 0.55);
        add(g, box(0.024, 0.16, 0.024), mStoneDark, 0, 0.38, sz * 0.286);
        add(g, box(0.012, 0.12, 0.026), mCyanGlow, 0, 0.38, sz * 0.290);
      }

      // Two tilted orbiting luminous cyan levitation rune bands w/ white-cyan glyphs!
      const rings = [
        { y: 0.450, R: 0.395, rx: 0.35, rz: -0.26, n: 16 },
        { y: 0.335, R: 0.340, rx: 0.25, rz: -0.33, n: 12 },
      ];
      for (const rg of rings) {
        const rgGrp = new THREE.Group();
        rgGrp.position.set(0, rg.y, 0);
        rgGrp.rotation.set(rg.rx, 0.18, rg.rz);
        g.add(rgGrp);
        add(rgGrp, cyl(rg.R, rg.R, 0.028, 28, true), mCyanGlow, 0, 0, 0);
        add(rgGrp, tor(rg.R, 0.0055, 4, 28), mCyanCore, 0,  0.014, 0, PI / 2, 0, 0);
        add(rgGrp, tor(rg.R, 0.0055, 4, 28), mCyanCore, 0, -0.014, 0, PI / 2, 0, 0);
        for (let i = 0; i < rg.n; i++) {
          const a = (i / rg.n) * TAU;
          const gx = Math.sin(a) * (rg.R + 0.004), gz = Math.cos(a) * (rg.R + 0.004);
          add(rgGrp, box(0.022, 0.016, 0.007), mCyanCore, gx, 0, gz, 0, a, 0);
        }
      }

      // Lush trailing ivy cascades & mossy patches
      addMossClump(g, mMoss, -0.17, 0.76, 0.15, 0.105);
      addMossClump(g, mMoss,  0.11, 0.89, 0.06, 0.075);
      addMossClump(g, mMoss,  0.02, 1.03, 0.05, 0.048);
      addMossClump(g, mMoss,  0.12, 0.042, 0.19, 0.072);
      addMossClump(g, mMoss, -0.16, 0.038, 0.16, 0.058);

      addVine(g, mFern, [
        [-0.14, 0.80, 0.14], [-0.28, 0.74, 0.18], [-0.36, 0.60, 0.16],
        [-0.35, 0.41, 0.12], [-0.32, 0.22, 0.09],
      ], 0.012, 9);
      addVine(g, mMoss, [
        [-0.19, 0.78, 0.06], [-0.32, 0.66, 0.04], [-0.30, 0.48, 0.02],
      ], 0.010, 5);
      addVine(g, mFern, [
        [0.09, 0.90, 0.06], [0.23, 0.84, 0.12], [0.33, 0.72, 0.10], [0.34, 0.57, 0.06],
      ], 0.011, 6);
    });
  }

  // ==========================================================================
  // 2. sr_golem_head — Mossy weathered Celestian guardian mask-head w/ one glowing visor slit,
  //    carved cheek runes & a crown of skyglass crystal shards
  // ==========================================================================
  function sr_golem_head() {
    return buildMergedProto('sr_golem_head', (g) => {
      // Fractured mossy Celestian rubble blocks & fallen jaw slab at ground level
      add(g, rbox(0.78, 0.10, 0.68, 0.028), mStoneDark, 0, 0.05, 0.02, 0, 0.06, 0);
      add(g, rbox(0.29, 0.15, 0.25, 0.032), mStone, -0.23, 0.082, 0.20, 0.08, 0.30, -0.06);
      add(g, rbox(0.28, 0.14, 0.20, 0.024), mStone,  0.16, 0.078, 0.25, -0.06, -0.14, 0.04);
      add(g, rbox(0.26, 0.13, 0.24, 0.030), mStoneDark, -0.28, 0.072, -0.15, 0.04, -0.35, 0.05);
      add(g, rbox(0.24, 0.12, 0.22, 0.028), mStone, 0.26, 0.068, -0.12, -0.04, 0.28, 0.05);

      // Soulfully tilted weathered stone Golem cranium (matching prop_02.png angle!)
      const head = new THREE.Group();
      head.position.set(0.02, 0.38, -0.01);
      head.rotation.set(-0.10, 0.24, -0.12);
      g.add(head);

      add(head, rbox(0.55, 0.44, 0.50, 0.082, 2), mStone, 0, 0.04, 0);
      add(head, box(0.36, 0.11, 0.18), mIron, 0.02, -0.17, 0.16);
      add(head, rbox(0.19, 0.15, 0.10, 0.020), mStone, -0.16, -0.08, 0.22, 0, 0.08, 0.04);
      add(head, rbox(0.18, 0.15, 0.10, 0.020), mStone,  0.17, -0.08, 0.22, 0, -0.08, -0.04);
      for (const [bx, bw, rz] of [[-0.19, 0.14, 0.05], [-0.05, 0.13, 0.01], [0.09, 0.13, -0.02], [0.21, 0.11, -0.05]]) {
        add(head, rbox(bw, 0.105, 0.09, 0.018), mStone, bx, 0.168, 0.225, 0.04, 0, rz);
      }
      add(head, rbox(0.095, 0.21, 0.105, 0.020), mStone, 0.015, 0.01, 0.248, -0.08, 0, 0);
      add(head, box(0.48, 0.08, 0.42), mStoneDark, 0, 0.23, -0.01);

      // Concentric cylindrical stone ear-drums on ±X
      for (const sx of [-1, 1]) {
        add(head, cyl(0.162, 0.168, 0.092, 16), mStone, sx * 0.288, -0.01, -0.02, 0, 0, PI / 2);
        add(head, cyl(0.128, 0.128, 0.100, 14), mStoneDark, sx * 0.295, -0.01, -0.02, 0, 0, PI / 2);
        add(head, tor(0.116, 0.021, 5, 16), mStone, sx * 0.336, -0.01, -0.02, 0, PI / 2, 0);
        add(head, cyl(0.068, 0.068, 0.036, 12), mStone, sx * 0.340, -0.01, -0.02, 0, 0, PI / 2);
      }

      // Single recessed visor slit glowing cyan across the stone mask + carved square-spiral cheek runes
      add(head, rbox(0.44, 0.085, 0.07, 0.018), mIron, 0.012, 0.040, 0.232);
      add(head, rbox(0.37, 0.040, 0.04, 0.012), mCyanGlow, 0.012, 0.040, 0.262);
      add(head, rbox(0.20, 0.018, 0.03, 0.006), mCyanCore, 0.012, 0.044, 0.276);
      for (const sx of [-1, 1]) {
        add(head, box(0.020, 0.085, 0.07), mStone, 0.012 + sx * 0.095, 0.040, 0.248);
      }
      addSquareSpiralRune(head, mCyanGlow, -0.165, -0.085, 0.274, 0, 0.050);
      addSquareSpiralRune(head, mCyanGlow, 0.172, -0.085, 0.274, 0, 0.050);

      // Thick mossy brow blanket, cheek moss & trailing left vine
      add(head, rbox(0.48, 0.09, 0.43, 0.038), mMoss, -0.01, 0.258, 0.0);
      addMossClump(head, mMoss, -0.17, 0.245, 0.17, 0.115);
      addMossClump(head, mMoss,  0.14, 0.255, 0.14, 0.095);
      addMossClump(head, mMoss, -0.22, 0.08,  0.19, 0.075);
      addMossClump(g, mMoss, -0.12, 0.135, 0.26, 0.105);
      addMossClump(g, mMoss, -0.34, 0.155, -0.04, 0.095);

      addVine(g, mMoss, [[-0.22, 0.64, 0.10], [-0.37, 0.54, 0.12], [-0.44, 0.39, 0.09]], 0.011, 5);
      addVine(g, mMoss, [[-0.34, 0.28, -0.06], [-0.44, 0.22, -0.02], [-0.39, 0.12, 0.06]], 0.011, 4);

      // Cluster of skyglass crystal shards sprouting through the mossy crown (tallest tip at y ~ 0.88)
      for (const [cx, cy, cz, rx, rz, rad, hTop] of [
        [-0.05, 0.672, 0.00, 0.06, 0.12, 0.062, 0.185],
        [0.10, 0.650, 0.05, 0.16, -0.38, 0.046, 0.130],
        [-0.17, 0.640, -0.04, -0.10, 0.46, 0.040, 0.110],
        [0.03, 0.640, -0.13, -0.42, -0.08, 0.036, 0.100],
      ]) {
        add(g, makeFacetedCrystalGeo(THREE, rad, hTop, 0.07, 6), mCyanGlow, cx, cy, cz, rx, 0.3, rz);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        addClover(g, mMoss, Math.sin(a) * 0.17, 0.67, Math.cos(a) * 0.15, 0.35 * Math.cos(a), a, -0.35 * Math.sin(a), 1.15);
      }
      addClover(g, mMoss, -0.08, 0.16, 0.29, 0.45, 0.2, 0, 1.05);
      addDaisy(g, mCream, mPollen, -0.05, 0.19, 0.32, 0.55, 0.15, 0, 0.86);
    });
  }

  // ==========================================================================
  // 3. sr_sky_compass — Brass-and-azure armillary sphere w/ 12-ray sunburst & cyan core on glyph pedestal
  // ==========================================================================
  function sr_sky_compass() {
    return buildMergedProto('sr_sky_compass', (g) => {
      add(g, rbox(0.46, 0.068, 0.46, 0.018), mStone, 0, 0.034, 0);
      add(g, rbox(0.36, 0.135, 0.36, 0.020), mStone, 0, 0.132, 0);
      add(g, rbox(0.40, 0.052, 0.40, 0.016), mStone, 0, 0.222, 0);

      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        const nx = Math.sin(a) * 0.182, nz = Math.cos(a) * 0.182;
        add(g, tor(0.058, 0.013, 5, 12, PI), mStoneDark, nx, 0.118, nz, 0, a, 0);
        add(g, box(0.082, 0.082, 0.016), mCyanGlow, nx * 0.98, 0.112, nz * 0.98, 0, a, 0);
        add(g, box(0.032, 0.056, 0.020), mStoneDark, nx, 0.112, nz, 0, a, 0);
      }
      addMossClump(g, mMoss, -0.20, 0.048, 0.19, 0.072);
      addMossClump(g, mMoss,  0.19, 0.048, 0.18, 0.068);
      addMossClump(g, mMoss,  0.16, 0.245, -0.15, 0.052);

      add(g, cyl(0.135, 0.165, 0.042, 18), mBrass, 0, 0.268, 0);
      add(g, cyl(0.095, 0.122, 0.036, 16), mBrassDark, 0, 0.304, 0);
      add(g, rbox(0.095, 0.088, 0.068, 0.020), mBrass, 0, 0.352, 0);

      const arm = new THREE.Group();
      arm.position.set(0, 0.665, 0);
      arm.rotation.set(0.06, 0.18, -0.24);
      g.add(arm);

      add(arm, cyl(0.324, 0.324, 0.052, 30, true), mAzure, 0, 0, 0, PI / 2, 0, 0);
      add(arm, tor(0.334, 0.015, 6, 30), mBrass, 0, 0,  0.024);
      add(arm, tor(0.334, 0.015, 6, 30), mBrass, 0, 0, -0.024);
      add(arm, tor(0.305, 0.011, 5, 28), mBrassDark, 0, 0, 0);

      add(arm, cyl(0.038, 0.050, 0.034, 12), mBrass, 0, 0.350, 0);
      add(arm, new THREE.ConeGeometry(0.038, 0.102, 12), mBrass, 0, 0.412, 0);
      for (const sx of [-1, 1]) {
        add(arm, cyl(0.038, 0.046, 0.050, 12), mBrass, sx * 0.356, 0, 0, 0, 0, -sx * PI / 2);
        add(arm, sph(0.030, 8, 6), mBrassDark, sx * 0.384, 0, 0);
      }

      add(arm, tor(0.292, 0.020, 6, 28), mBrass, 0, 0, 0, PI / 2 + 0.36, 0.16, 0);
      add(arm, tor(0.274, 0.012, 5, 26), mAzure, 0, 0, 0, PI / 2 + 0.36, 0.16, 0);
      add(arm, tor(0.268, 0.016, 6, 26), mBrass, 0, 0, 0, 0.32, PI / 2 - 0.38, 0);
      add(arm, tor(0.238, 0.011, 5, 24), mAzure, 0, 0, 0, PI / 2 - 0.52, -0.28, 0);

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const isMain = i % 3 === 0;
        const len = isMain ? 0.212 : 0.142;
        const rad = isMain ? 0.032 : 0.021;
        add(arm, new THREE.ConeGeometry(rad, len, 4), mBrass,
          Math.cos(a) * (len * 0.5 + 0.042), Math.sin(a) * (len * 0.5 + 0.042), 0,
          0, PI / 4, a - PI / 2, 1, 1, 0.54);
      }
      for (let i = 0; i < 6; i++) {
        const a = ((i + 0.5) / 6) * TAU;
        add(arm, new THREE.ConeGeometry(0.015, 0.060, 4), mCyanGlow,
          Math.cos(a) * 0.100, Math.sin(a) * 0.100, 0, 0, PI / 4, a - PI / 2, 1, 1, 0.45);
      }
      add(arm, cyl(0.084, 0.084, 0.030, 18), mBrass, 0, 0, 0, PI / 2, 0, 0);
      add(arm, tor(0.072, 0.013, 5, 18), mBrassDark, 0, 0, 0.015);
      add(arm, tor(0.072, 0.013, 5, 18), mBrassDark, 0, 0, -0.015);
      add(arm, sph(0.064, 12, 8), mCyanGlow, 0, 0, 0, 0, 0, 0, 1, 1, 0.72);
    });
  }

  // ==========================================================================
  // 4. sr_pirate_chest — Domed crimson & riveted brass sky-pirate trunk w/ winged crest, pennant & rope
  // ==========================================================================
  function sr_pirate_chest() {
    return buildMergedProto('sr_pirate_chest', (g) => {
      const W = 0.82, D = 0.50;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          add(g, rbox(0.125, 0.085, 0.125, 0.014), mBrass, sx * 0.362, 0.042, sz * 0.205);
          add(g, box(0.105, 0.030, 0.105), mBrassDark, sx * 0.362, 0.015, sz * 0.205);
        }
      }

      add(g, rbox(W, 0.38, D, 0.024), mCrimson, 0, 0.245, 0);
      add(g, box(W + 0.010, 0.020, D + 0.010), mIron, 0, 0.435, 0);
      add(g, cyl(0.250, 0.250, W - 0.008, 22), mCrimson, 0, 0.44, 0, 0, 0, PI / 2);

      for (const x of [-0.38, -0.185, 0.185, 0.38]) {
        const w = Math.abs(x) > 0.3 ? 0.064 : 0.056;
        add(g, box(w, 0.39, D + 0.026), mBrass, x, 0.245, 0);
        add(g, tor(0.256, w * 0.48, 5, 20, PI), mBrass, x, 0.44, 0, 0, PI / 2, 0);
        for (const y of [0.13, 0.245, 0.355]) {
          add(g, sph(0.015, 6, 4), mBrassDark, x, y,  D / 2 + 0.018);
          add(g, sph(0.015, 6, 4), mBrassDark, x, y, -D / 2 - 0.018);
        }
        for (const a of [0.45, 0.95, 1.57, 2.19, 2.69]) {
          add(g, sph(0.015, 6, 4), mBrassDark, x, 0.44 + Math.sin(a) * 0.268, Math.cos(a) * 0.268);
        }
      }
      add(g, box(W + 0.028, 0.050, D + 0.028), mBrass, 0, 0.45, 0);
      add(g, box(W + 0.022, 0.044, D + 0.022), mBrass, 0, 0.075, 0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          add(g, rbox(0.115, 0.088, 0.115, 0.012), mBrass, sx * 0.368, 0.452, sz * 0.212);
        }
      }

      // Swinging brass side bail handles on ±X
      for (const sx of [-1, 1]) {
        add(g, box(0.028, 0.068, 0.165), mBrassDark, sx * (W / 2 + 0.014), 0.285, 0);
        add(g, tor(0.062, 0.016, 5, 12, PI), mBrass, sx * (W / 2 + 0.028), 0.275, 0, PI + sx * 0.18, PI / 2, 0);
      }

      // Shield-shaped front brass lockplate + hinged top hasp + dark iron keyhole
      add(g, rbox(0.165, 0.162, 0.038, 0.024), mBrass, 0, 0.382, D / 2 + 0.018);
      add(g, rbox(0.110, 0.098, 0.044, 0.016), mBrassDark, 0, 0.468, D / 2 + 0.022);
      add(g, sph(0.021, 8, 6), mIron, 0, 0.396, D / 2 + 0.038, 0, 0, 0, 1, 1, 0.5);
      add(g, new THREE.ConeGeometry(0.021, 0.056, 4), mIron, 0, 0.362, D / 2 + 0.037, 0, PI / 4, 0, 1, 1, 0.45);

      // Sculpted Golden Airship Wing Crest on front slope of domed lid (+Z)
      const crestY = 0.595, crestZ = 0.214;
      add(g, sph(0.034, 8, 6), mBrass, 0, crestY, crestZ, -0.52, 0, 0, 0.95, 1.25, 0.48);
      add(g, tor(0.036, 0.008, 5, 12), mBrassDark, 0, crestY, crestZ - 0.004, -0.52, 0, 0);
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const len = 0.125 - k * 0.020;
          add(g, sph(1, 7, 5), mBrass,
            sx * (0.070 + k * 0.020), crestY + 0.020 - k * 0.016, crestZ - 0.004 - k * 0.005,
            -0.52, -sx * 0.12, sx * (0.28 + k * 0.14), len, 0.018, 0.011);
        }
      }

      // Left Brass Mooring Ring + Bold Draped Notched Swallowtail Red Pirate Pennant!
      add(g, tor(0.046, 0.013, 5, 14), mBrass, -0.185, 0.405, D / 2 + 0.034, 0.15, 0, 0);
      add(g, rbox(0.118, 0.195, 0.022, 0.008), mPennant, -0.150, 0.275, D / 2 + 0.048, 0.06, 0.10, -0.14);
      add(g, cyl(0.016, 0.028, 0.19, 8), mPennant, -0.128, 0.280, D / 2 + 0.058, 0.06, 0, -0.22);
      add(g, new THREE.ConeGeometry(0.038, 0.118, 4), mPennant, -0.180, 0.148, D / 2 + 0.052, PI, PI / 4, -0.08, 1, 1, 0.48);
      add(g, new THREE.ConeGeometry(0.038, 0.118, 4), mPennant, -0.115, 0.156, D / 2 + 0.052, PI, PI / 4,  0.16, 1, 1, 0.48);

      // Right Brass Mooring Ring + Thick Twisted Braided Hemp Rope Swag & Knotted Tails!
      add(g, tor(0.046, 0.013, 5, 14), mBrass, 0.185, 0.435, D / 2 + 0.034, 0.15, 0, 0);
      const ropePts = [
        [-0.215, 0.19, D / 2 + 0.042],
        [-0.195, 0.37, D / 2 + 0.052],
        [-0.095, 0.28, D / 2 + 0.064],
        [ 0.035, 0.21, D / 2 + 0.066],
        [ 0.140, 0.29, D / 2 + 0.058],
        [ 0.195, 0.42, D / 2 + 0.048],
        [ 0.265, 0.36, D / 2 + 0.044],
      ];
      const ropeCurve = new THREE.CatmullRomCurve3(ropePts.map((p) => new THREE.Vector3(...p)));
      add(g, new THREE.TubeGeometry(ropeCurve, 22, 0.023, 6, false), mRope);
      for (let i = 1; i < 16; i++) {
        const t = i / 16;
        const p = ropeCurve.getPoint(t);
        const tan = ropeCurve.getTangent(t);
        add(g, tor(0.022, 0.0065, 4, 8), mRope, p.x, p.y, p.z, 0, Math.atan2(tan.x, tan.z), 0.45);
      }
      add(g, sph(0.032, 7, 5), mRope, -0.19, 0.375, D / 2 + 0.054);
      add(g, sph(0.032, 7, 5), mRope,  0.19, 0.425, D / 2 + 0.052);
    });
  }

  // ==========================================================================
  // 5. sr_cloud_planter — Fluted Romanesque-Celestian stone goblet basin w/ glowing blue sky-orchids & buds
  // ==========================================================================
  function sr_cloud_planter() {
    return buildMergedProto('sr_cloud_planter', (g) => {
      add(g, cyl(0.24, 0.26, 0.055, 8), mStone, 0, 0.028, 0, 0, PI / 8, 0);
      add(g, cyl(0.195, 0.225, 0.042, 16), mStoneDark, 0, 0.072, 0);

      const goblet = [
        [0.0, 0.09], [0.168, 0.095], [0.145, 0.165], [0.148, 0.235],
        [0.185, 0.255], [0.275, 0.32], [0.355, 0.40], [0.392, 0.465],
        [0.412, 0.515], [0.365, 0.522], [0.335, 0.46], [0.0, 0.45],
      ];
      add(g, lathe(goblet, 22), mStone, 0, 0, 0);
      add(g, tor(0.402, 0.024, 6, 24), mStone, 0, 0.492, 0, PI / 2, 0, 0);
      add(g, tor(0.172, 0.015, 5, 18), mStoneDark, 0, 0.248, 0, PI / 2, 0, 0);

      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        add(g, sph(1, 7, 5), mStoneDark, Math.sin(a) * 0.332, 0.375, Math.cos(a) * 0.332, -0.58, a, 0, 0.038, 0.105, 0.028);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        add(g, tor(0.032, 0.009, 4, 10, PI), mStoneDark, Math.sin(a) * 0.152, 0.175, Math.cos(a) * 0.152, 0, a, 0);
        add(g, box(0.026, 0.075, 0.018), mCyanGlow, Math.sin(a) * 0.146, 0.158, Math.cos(a) * 0.146, 0, a, 0);
      }

      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        addMossClump(g, mMoss, Math.sin(a) * 0.26, 0.525, Math.cos(a) * 0.26, 0.115);
        addClover(g, mFern, Math.sin(a + 0.35) * 0.33, 0.545, Math.cos(a + 0.35) * 0.33, 0.45 * Math.cos(a), a, -0.45 * Math.sin(a), 1.30);
      }
      addMossClump(g, mMoss, 0, 0.565, 0, 0.16);
      addMossClump(g, mMoss, -0.17, 0.042, 0.17, 0.058);
      addMossClump(g, mMoss,  0.16, 0.042, 0.16, 0.052);

      addVine(g, mFern, [[-0.33, 0.50, 0.16], [-0.43, 0.40, 0.19], [-0.45, 0.25, 0.15], [-0.41, 0.11, 0.11]], 0.012, 7);
      addVine(g, mFern, [[ 0.34, 0.50, 0.14], [ 0.44, 0.39, 0.16], [ 0.45, 0.22, 0.12], [ 0.42, 0.13, 0.09]], 0.012, 6);
      addVine(g, mMoss, [[-0.20, 0.49,-0.32], [-0.28, 0.35,-0.39], [-0.26, 0.19,-0.36]], 0.011, 5);

      const blooms = [
        { p: [-0.16, 0.76,  0.14], r: [ 0.22,  0.32, 0.12], s: 1.22 },
        { p: [ 0.02, 0.68,  0.23], r: [ 0.34, -0.04, 0.02], s: 1.26 },
        { p: [ 0.18, 0.75,  0.11], r: [ 0.26, -0.38,-0.10], s: 1.10 },
        { p: [ 0.01, 0.85, -0.02], r: [ 0.16,  0.08, 0.04], s: 1.18 },
      ];
      for (const b of blooms) {
        add(g, tube([[b.p[0] * 0.35, 0.53, b.p[2] * 0.35], [b.p[0] * 0.78, (0.53 + b.p[1]) * 0.5 + 0.04, b.p[2] * 0.78], b.p], 0.013, 7, 4), mFern);
        addOrchid(g, b.p[0], b.p[1], b.p[2], b.r[0], b.r[1], b.r[2], b.s);
      }

      const spikes = [
        [[0.08, 0.58, 0.0], [0.20, 0.86, 0.04], [0.34, 0.84, 0.08], [0.42, 0.75, 0.10]],
        [[-0.02, 0.58, -0.04], [-0.10, 0.88, -0.02], [-0.22, 0.91, 0.02]],
      ];
      for (const sp of spikes) {
        const cv = new THREE.CatmullRomCurve3(sp.map((p) => new THREE.Vector3(...p)));
        add(g, new THREE.TubeGeometry(cv, 9, 0.009, 4, false), mFern);
        for (const t of [0.55, 0.78, 0.98]) {
          const bp = cv.getPoint(t);
          add(g, sph(1, 6, 4), t > 0.9 ? mPollen : mOrchid, bp.x, bp.y - 0.022, bp.z, 0.3, 0, -0.35, 0.019, 0.032, 0.019);
        }
      }
      for (const [fx, fy, fz] of [[0.14, 0.59, 0.24], [0.23, 0.56, 0.21]]) {
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU;
          add(g, sph(1, 5, 4), mWisteriaLight, fx + Math.cos(a) * 0.018, fy + 0.006, fz + Math.sin(a) * 0.018, 0.35, -a, 0, 0.011, 0.005, 0.016);
        }
        add(g, sph(0.008, 5, 4), mPollen, fx, fy + 0.010, fz);
      }
    });
  }

  // ==========================================================================
  // 6. sr_propeller_barrel — Coopered oak airship fuel cask oriented 1:1 with prop_06.png!
  //    (Long coopered oak stave side facing +Z, 3-blade brass propeller on +X,
  //     glowing amber sight-glass on front-left (-X/+Z), twin round cream dials facing +Z!)
  // ==========================================================================
  function sr_propeller_barrel() {
    return buildMergedProto('sr_propeller_barrel', (g) => {
      // Orient whole assembly slightly angled (-0.28 rad) so coopered oak staves, glowing amber sight-glass,
      // twin cream gauges AND the 3-blade right-hand brass propeller are ALL 100% visible from +Z!
      const rig = new THREE.Group();
      rig.rotation.y = -0.30;
      g.add(rig);

      const cy = 0.355;
      // Two splayed trapezoidal dark-wood chock cradles under X-oriented barrel
      for (const x of [-0.195, 0.195]) {
        for (const sz of [-1, 1]) {
          add(rig, rbox(0.135, 0.185, 0.135, 0.014), mWoodDark, x, 0.092, sz * 0.195, sz * 0.18, 0, 0);
        }
        add(rig, rbox(0.115, 0.082, 0.45, 0.012), mWoodDark, x, 0.048, 0);
      }

      // Horizontal coopered oak barrel along X axis + recessed dark-wood end-heads
      const caskProf = [
        [0.0, -0.325], [0.218, -0.325], [0.240, -0.345], [0.272, -0.185],
        [0.290, 0.0], [0.272, 0.185], [0.240, 0.345], [0.218, 0.325], [0.0, 0.325],
      ];
      add(rig, lathe(caskProf, 24), mWood, 0, cy, 0, 0, 0, -PI / 2);
      add(rig, cyl(0.222, 0.222, 0.658, 18), mWoodDark, 0, cy, 0, 0, 0, -PI / 2);

      // 4 wide riveted golden-brass barrel hoops along X
      for (const [x, R] of [[-0.295, 0.252], [-0.105, 0.286], [0.105, 0.286], [0.295, 0.252]]) {
        add(rig, cyl(R, R, 0.048, 24, true), mBrass, x, cy, 0, 0, 0, PI / 2);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          add(rig, sph(0.013, 6, 4), mBrassDark, x, cy + Math.sin(a) * (R + 0.006), Math.cos(a) * (R + 0.006));
        }
      }

      // Right End (+X) 3-Blade Warm-Brass Airship Propeller + bolted hub & conical spinner!
      const propX = 0.39;
      add(rig, cyl(0.072, 0.078, 0.032, 16), mBrassDark, 0.338, cy, 0, 0, 0, -PI / 2);
      add(rig, cyl(0.024, 0.056, 0.098, 16), mBrass, propX + 0.022, cy, 0, 0, 0, -PI / 2);
      add(rig, sph(0.026, 8, 6), mBrass, propX + 0.068, cy, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.38;
        const by = cy + Math.sin(a) * 0.152, bz = Math.cos(a) * 0.152;
        add(rig, sph(1, 9, 7), mBrass, propX, by, bz,
          a, 0.34 * Math.cos(a), 0.34 * Math.sin(a), 0.012, 0.056, 0.148);
        add(rig, cyl(0.016, 0.022, 0.065, 8), mBrassDark, propX, cy + Math.sin(a) * 0.045, Math.cos(a) * 0.045,
          a - PI / 2, 0, 0);
      }

      // Front-Left (-X / +Z) Glowing Amber Fuel Sight-Glass + brass caps & elbow plumbing!
      const sgX = -0.225, sgZ = 0.278;
      add(rig, cyl(0.032, 0.032, 0.140, 14), mAmberGlow, sgX, cy - 0.020, sgZ);
      add(rig, cyl(0.054, 0.050, 0.038, 14), mBrass, sgX, cy + 0.122, sgZ);
      add(rig, cyl(0.050, 0.054, 0.038, 14), mBrass, sgX, cy - 0.095, sgZ);
      for (const a of [0.6, 2.5, 4.7]) {
        add(rig, cyl(0.005, 0.005, 0.185, 5), mBrassDark, sgX + Math.cos(a) * 0.046, cy + 0.014, sgZ + Math.sin(a) * 0.046);
      }
      add(rig, tube([
        [sgX, cy + 0.14, sgZ], [sgX, cy + 0.215, sgZ - 0.02], [sgX + 0.03, cy + 0.225, 0.16],
      ], 0.018, 10, 6), mBrass);
      add(rig, tube([
        [sgX, cy - 0.11, sgZ], [sgX, cy - 0.185, sgZ - 0.02], [-0.04, cy - 0.195, 0.25], [0.10, cy - 0.165, 0.23],
      ], 0.019, 12, 6), mBrass);

      // Clear glass sleeve around sight-glass (1 single glass mesh transformed with rig!)
      const sightGlassGeo = prepMergeGeo(cyl(0.044, 0.044, 0.185, 14));
      sightGlassGeo.translate(sgX, cy + 0.014, sgZ);
      sightGlassGeo.rotateY(-0.30);
      g.add(new THREE.Mesh(sightGlassGeo, mGlass));

      // Top-right brass filler dome & U-bend manifold pipe
      add(rig, cyl(0.062, 0.072, 0.065, 14), mBrass, 0.15, cy + 0.285, 0.03);
      add(rig, cyl(0.076, 0.076, 0.020, 14), mBrassDark, 0.15, cy + 0.300, 0.03);
      add(rig, tube([
        [0.15, cy + 0.32, 0.03], [0.15, cy + 0.40, 0.03], [0.25, cy + 0.38, 0.03], [0.27, cy + 0.24, 0.03],
      ], 0.017, 12, 6), mBrass);

      // Twin Round Cream-Dial Pressure Gauges facing +Z on top of the barrel!
      const gauges = [
        { x: -0.105, y: 0.725, z: 0.04, r: 0.074, ang:  0.72, ry: 0.24 },
        { x:  0.025, y: 0.805, z: 0.01, r: 0.088, ang: -0.58, ry: 0.20 },
      ];
      for (const gg of gauges) {
        add(rig, cyl(0.020, 0.028, gg.y - (cy + 0.25), 8), mBrass, gg.x, (gg.y + cy + 0.25) * 0.5, gg.z);
        add(rig, tor(0.028, 0.008, 4, 10), mBrassDark, gg.x, cy + 0.295, gg.z, PI / 2, 0, 0);

        const dGrp = new THREE.Group();
        dGrp.position.set(gg.x, gg.y, gg.z);
        dGrp.rotation.set(0, gg.ry, 0);
        rig.add(dGrp);
        add(dGrp, cyl(gg.r, gg.r, 0.046, 18), mBrass, 0, 0, 0, PI / 2, 0, 0);
        add(dGrp, tor(gg.r * 0.94, 0.010, 5, 18), mBrassDark, 0, 0, 0.022);
        add(dGrp, cyl(gg.r * 0.84, gg.r * 0.84, 0.048, 16), mCream, 0, 0, 0.002, PI / 2, 0, 0);
        add(dGrp, sph(0.012, 6, 4), mBrassDark, 0, 0, 0.028);
        add(dGrp, box(0.009, gg.r * 0.68, 0.008), mIron,
          -Math.sin(gg.ang) * gg.r * 0.26, Math.cos(gg.ang) * gg.r * 0.26, 0.028, 0, 0, gg.ang);
        for (let t = -3; t <= 3; t++) {
          const ta = t * 0.42;
          add(dGrp, box(0.006, 0.016, 0.006), mIron,
            Math.sin(ta) * gg.r * 0.68, Math.cos(ta) * gg.r * 0.68, 0.026, 0, 0, -ta);
        }
      }
    });
  }

  // ==========================================================================
  // 7. sr_wind_chime_stand — Twin mossy Celestian stone pillars & beam w/ 3 leaf-embossed verdigris bells
  // ==========================================================================
  function sr_wind_chime_stand() {
    return buildMergedProto('sr_wind_chime_stand', (g) => {
      for (const sx of [-1, 1]) {
        const px = sx * 0.375;
        add(g, rbox(0.28, 0.075, 0.28, 0.014), mStone, px, 0.038, 0);
        add(g, rbox(0.225, 0.145, 0.225, 0.014), mStone, px, 0.145, 0);
        add(g, box(0.185, 0.065, 0.185), mStoneDark, px, 0.245, 0);
        add(g, rbox(0.155, 0.56, 0.155, 0.014), mStone, px, 0.555, 0);
        add(g, box(0.19, 0.05, 0.19), mStoneDark, px, 0.85, 0);
        add(g, rbox(0.23, 0.12, 0.23, 0.016), mStone, px, 0.935, 0);
        add(g, rbox(0.275, 0.095, 0.265, 0.018), mStone, px, 1.04, 0);

        for (const a of [0, PI / 2, PI, -PI / 2]) {
          const ox = px + Math.sin(a) * 0.078, oz = Math.cos(a) * 0.078;
          add(g, tor(0.026, 0.008, 4, 8, PI), mStoneDark, ox, 0.72, oz, 0, a, 0);
          add(g, box(0.026, 0.32, 0.014), mCyanGlow, ox * 0.99 + px * 0.01, 0.56, oz * 0.96, 0, a, 0);
        }
        for (const sz of [-1, 1]) {
          add(g, tor(0.044, 0.010, 4, 10, PI), mStoneDark, px, 0.135, sz * 0.112, 0, sz > 0 ? 0 : PI, 0);
          add(g, box(0.056, 0.068, 0.014), mCyanGlow, px, 0.125, sz * 0.108);
          add(g, box(0.042, 0.058, 0.016), mCyanGlow, px, 0.935, sz * 0.114, 0, 0, PI / 4);
        }
      }

      add(g, rbox(0.68, 0.098, 0.098, 0.014), mWoodDark, 0, 0.995, 0);

      const bells = [
        { x: -0.185, y: 0.655, s: 1.04, tilt:  0.03 },
        { x:  0.0,   y: 0.635, s: 0.99, tilt: -0.03 },
        { x:  0.185, y: 0.648, s: 0.95, tilt:  0.04 },
      ];
      const bellProf = [
        [0.092, 0.0], [0.098, 0.018], [0.082, 0.046], [0.078, 0.155],
        [0.068, 0.210], [0.040, 0.242], [0.0, 0.248],
      ];
      for (const b of bells) {
        add(g, box(0.038, 0.118, 0.116), mBrass, b.x, 0.995, 0);
        add(g, tor(0.022, 0.007, 4, 10), mBrass, b.x, 0.925, 0);
        add(g, tor(0.022, 0.007, 4, 10), mBrass, b.x, 0.892, 0, 0, PI / 2, 0);

        const bg = new THREE.Group();
        bg.position.set(b.x, b.y, 0);
        bg.rotation.z = b.tilt;
        bg.scale.setScalar(b.s);
        g.add(bg);

        add(bg, lathe(bellProf, 16), mVerdigris, 0, 0, 0);
        add(bg, tor(0.022, 0.008, 4, 10), mBrass, 0, 0.256, 0);
        add(bg, tor(0.095, 0.010, 5, 16), mBrass, 0, 0.016, 0, PI / 2, 0, 0);
        add(bg, tor(0.082, 0.007, 4, 16), mBrass, 0, 0.045, 0, PI / 2, 0, 0);
        add(bg, tor(0.076, 0.008, 4, 16), mBrass, 0, 0.175, 0, PI / 2, 0, 0);

        for (const sz of [1, -1]) {
          for (const [la, len, wid] of [[0, 0.036, 0.012], [0.65, 0.030, 0.010], [-0.65, 0.030, 0.010], [1.28, 0.024, 0.009], [-1.28, 0.024, 0.009]]) {
            add(bg, sph(1, 6, 4), mBrass,
              Math.sin(la) * 0.022, 0.098 + Math.cos(la) * 0.020, sz * 0.080,
              0, 0, -la, wid, len, 0.007);
          }
        }

        add(bg, sph(0.020, 6, 5), mBrass, 0, -0.005, 0);
        add(bg, tor(0.014, 0.005, 4, 8), mBrass, 0, -0.042, 0);
        add(bg, tor(0.014, 0.005, 4, 8), mBrass, 0, -0.068, 0, 0, PI / 2, 0);

        // Wide sculpted feather wind-catcher tag facing forward (+Z) w/ golden quill & barbs!
        add(bg, cyl(0.005, 0.003, 0.23, 5), mBrass, 0, -0.185, 0, 0, 0.14, 0);
        add(bg, sph(1, 8, 6), mVerdigris, 0.003, -0.195, 0, 0, 0.14, 0.04, 0.044, 0.122, 0.010);
        for (let f = -2; f <= 2; f++) {
          add(bg, box(0.042, 0.005, 0.013), mBrass, 0.002, -0.19 + f * 0.032, 0, 0, 0.14, 0.52);
        }
      }

      addMossClump(g, mMoss,  0.37, 1.10, 0.02, 0.115);
      addMossClump(g, mMoss, -0.27, 1.07, 0.05, 0.072);
      addMossClump(g, mMoss, -0.39, 0.23, 0.10, 0.085);
      addMossClump(g, mMoss, -0.41, 0.06, 0.12, 0.082);
      addMossClump(g, mMoss,  0.39, 0.18, 0.10, 0.075);

      addVine(g, mMoss, [[0.32, 1.12, 0.06], [0.47, 1.03, 0.10], [0.51, 0.84, 0.08], [0.46, 0.64, 0.06]], 0.012, 7);
      addVine(g, mMoss, [[-0.25, 1.08, 0.06], [-0.23, 0.92, 0.09], [-0.26, 0.80, 0.07]], 0.010, 4);
      addVine(g, mMoss, [[-0.41, 0.24, 0.09], [-0.46, 0.42, 0.09], [-0.42, 0.60, 0.07]], 0.011, 5);
    });
  }

  // ==========================================================================
  // 8. sr_crystal_lantern — Openwork golden-brass filigree cage lantern w/ large faceted cyan crystal
  // ==========================================================================
  function sr_crystal_lantern() {
    return buildMergedProto('sr_crystal_lantern', (g) => {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + PI / 4;
        const fx = Math.sin(a) * 0.175, fz = Math.cos(a) * 0.175;
        add(g, tor(0.040, 0.017, 5, 12, PI * 1.45), mBrass, fx, 0.045, fz, 0, a + PI / 2, 0.35);
        add(g, sph(0.022, 6, 4), mBrassDark, fx * 1.12, 0.032, fz * 1.12);
      }

      // Hemispherical lower bowl w/ azure-teal inner liner & raised golden scrollwork
      const baseProf = [
        [0.0, 0.075], [0.145, 0.082], [0.235, 0.132], [0.278, 0.195],
        [0.272, 0.235], [0.215, 0.238], [0.192, 0.208], [0.0, 0.202],
      ];
      add(g, lathe(baseProf, 22), mAzure, 0, 0, 0);
      add(g, tor(0.278, 0.022, 6, 24), mBrass, 0, 0.222, 0, PI / 2, 0, 0);
      add(g, tor(0.195, 0.011, 5, 20), mCyanGlow, 0, 0.228, 0, PI / 2, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        add(g, tube([
          [Math.sin(a) * 0.12, 0.09, Math.cos(a) * 0.12],
          [Math.sin(a) * 0.235, 0.145, Math.cos(a) * 0.235],
          [Math.sin(a) * 0.276, 0.215, Math.cos(a) * 0.276],
        ], 0.013, 7, 5), mBrass);
        const aMid = a + PI / 6;
        add(g, tor(0.038, 0.009, 4, 10, PI * 1.4), mBrass,
          Math.sin(aMid) * 0.225, 0.155, Math.cos(aMid) * 0.225, 0.65, aMid, 0);
      }

      // 6 Turned Colonnette Pillars + Cusped Filigree Arches + Floating Equatorial Ring + OPENWORK Crown!
      const cageR = 0.252;
      add(g, tor(0.198, 0.014, 5, 22), mBrass, 0, 0.455, 0, PI / 2, 0, 0);
      add(g, tor(0.278, 0.022, 6, 24), mBrass, 0, 0.675, 0, PI / 2, 0, 0);

      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const cx = Math.sin(a) * cageR, cz = Math.cos(a) * cageR;
        add(g, cyl(0.018, 0.021, 0.43, 8), mBrass, cx, 0.45, cz);
        add(g, cyl(0.027, 0.029, 0.045, 8), mBrassDark, cx, 0.27, cz);
        add(g, cyl(0.029, 0.027, 0.045, 8), mBrassDark, cx, 0.63, cz);
        add(g, tor(0.022, 0.007, 4, 8), mBrassDark, cx, 0.455, cz, PI / 2, 0, 0);
        add(g, sph(0.028, 7, 5), mBrass, cx * 1.08, 0.222, cz * 1.08);
        add(g, sph(0.028, 7, 5), mBrass, cx * 1.08, 0.675, cz * 1.08);
        add(g, cyl(0.005, 0.005, 0.055, 5), mBrassDark, Math.sin(a) * 0.224, 0.455, Math.cos(a) * 0.224, PI / 2, 0, -a);

        const aMid = a + PI / 6;
        const mx = Math.sin(aMid) * (cageR - 0.008), mz = Math.cos(aMid) * (cageR - 0.008);
        add(g, tor(0.088, 0.011, 4, 12, PI), mBrass, mx, 0.585, mz, 0, aMid, 0);
        add(g, tor(0.042, 0.008, 4, 10, PI * 1.2), mBrassDark, mx, 0.635, mz, PI, aMid, 0);
        add(g, tor(0.088, 0.011, 4, 12, PI), mBrass, mx, 0.312, mz, PI, aMid, 0);

        // Openwork golden crown ribs + twin heart-scroll filigree in every bay (see-through like prop_08.png!)
        add(g, tube([
          [cx * 1.04, 0.68, cz * 1.04],
          [Math.sin(a) * 0.21, 0.79, Math.cos(a) * 0.21],
          [Math.sin(a) * 0.082, 0.858, Math.cos(a) * 0.082],
        ], 0.016, 8, 5), mBrass);
        add(g, tor(0.048, 0.010, 4, 10, PI * 1.55), mBrass,
          Math.sin(aMid) * 0.195, 0.758, Math.cos(aMid) * 0.195, -0.58, aMid, 0.42);
        add(g, tor(0.048, 0.010, 4, 10, PI * 1.55), mBrass,
          Math.sin(aMid) * 0.195, 0.758, Math.cos(aMid) * 0.195, -0.58, aMid, -0.42);
      }

      add(g, cyl(0.068, 0.118, 0.044, 14), mBrass, 0, 0.860, 0);
      add(g, sph(0.032, 8, 6), mBrassDark, 0, 0.894, 0);
      add(g, tor(0.054, 0.015, 6, 16), mBrass, 0, 0.938, 0);

      // Large Hero Faceted Cyan Skyglass Bipyramid Crystal floating in the cage!
      add(g, makeFacetedCrystalGeo(THREE, 0.134, 0.235, 0.210, 6), mCyanGlow, 0, 0.455, 0, 0.02, 0.32, -0.02);
      add(g, makeFacetedCrystalGeo(THREE, 0.082, 0.155, 0.140, 6), mCyanCore, 0, 0.455, 0, 0.02, 0.32, -0.02);
    });
  }

  // ==========================================================================
  // 9. sr_stone_stele — Stepped mossy wisteria-draped Celestian monolith w/ cyan cross-ring glyph & twin portals
  // ==========================================================================
  function sr_stone_stele() {
    return buildMergedProto('sr_stone_stele', (g) => {
      add(g, rbox(0.86, 0.088, 0.58, 0.018), mStone, 0, 0.044, 0.01);
      add(g, rbox(0.72, 0.125, 0.46, 0.018), mStone, -0.02, 0.148, -0.01);
      add(g, rbox(0.58, 0.135, 0.36, 0.018), mStone, 0, 0.272, -0.02);
      add(g, box(0.18, 0.11, 0.22), mStoneDark, -0.34, 0.12, 0.14);
      add(g, box(0.16, 0.09, 0.20), mStoneDark, -0.40, 0.065, -0.04);

      for (const x of [-0.105, 0.105]) {
        add(g, tor(0.058, 0.015, 5, 12, PI), mStone, x, 0.165, 0.225);
        add(g, box(0.026, 0.095, 0.026), mStoneDark, x - 0.058, 0.12, 0.225);
        add(g, box(0.026, 0.095, 0.026), mStoneDark, x + 0.058, 0.12, 0.225);
        add(g, box(0.086, 0.115, 0.018), mCyanGlow, x, 0.135, 0.218);
        add(g, box(0.022, 0.10, 0.022), mStoneDark, x, 0.128, 0.222);
      }

      add(g, rbox(0.52, 0.62, 0.22, 0.024), mStone, 0, 0.635, -0.02);
      add(g, cyl(0.26, 0.26, 0.22, 22), mStone, 0, 0.94, -0.02, PI / 2, 0, 0);
      add(g, box(0.15, 0.17, 0.24), mStoneDark,  0.21, 0.43, -0.02);
      add(g, box(0.15, 0.22, 0.24), mStoneDark, -0.20, 0.49, -0.02);

      for (const [z, dir] of [[0.092, 1], [-0.132, -1]]) {
        const ry = dir > 0 ? 0 : PI;
        add(g, tor(0.158, 0.022, 5, 22), mStoneDark, 0, 0.765, z, 0, ry, 0);
        add(g, tor(0.122, 0.015, 5, 22), mCyanGlow, 0, 0.765, z + dir * 0.005, 0, ry, 0);
        add(g, tor(0.068, 0.016, 5, 18), mStone, 0, 0.765, z + dir * 0.008, 0, ry, 0);
        add(g, sph(0.044, 10, 7), mCyanGlow, 0, 0.765, z + dir * 0.012, 0, 0, 0, 1, 1, 0.45);
        add(g, box(0.026, 0.20, 0.018), mCyanGlow, 0, 0.97, z + dir * 0.003);
        add(g, box(0.026, 0.22, 0.018), mCyanGlow, 0, 0.54, z + dir * 0.003);
        add(g, box(0.13, 0.026, 0.018), mCyanGlow, -0.185, 0.765, z + dir * 0.003);
        add(g, box(0.13, 0.026, 0.018), mCyanGlow,  0.185, 0.765, z + dir * 0.003);
      }

      addMossClump(g, mMoss, -0.10, 1.19, 0.02, 0.125);
      addMossClump(g, mMoss, -0.24, 1.07, 0.05, 0.115);
      addMossClump(g, mMoss,  0.17, 1.07, -0.01, 0.095);
      addMossClump(g, mMoss, -0.20, 0.62, 0.08, 0.085);
      addMossClump(g, mMoss,  0.22, 0.53, 0.06, 0.075);
      addMossClump(g, mMoss, -0.22, 0.095, 0.24, 0.090);
      addMossClump(g, mMoss,  0.32, 0.095, 0.18, 0.095);

      // Delicate tapering lavender-lilac wisteria racemes cascading down upper-left
      const racemes = [
        [-0.31, 1.05,  0.09, 8, 1.00],
        [-0.22, 1.13,  0.11, 7, 0.95],
        [-0.36, 0.93,  0.03, 8, 1.02],
        [-0.14, 1.17,  0.10, 6, 0.88],
        [-0.29, 1.08, -0.09, 7, 0.92],
      ];
      for (const [rx, ry, rz, cnt, sc] of racemes) {
        for (let k = 0; k < cnt; k++) {
          const frac = k / (cnt - 1);
          const s = 0.036 * sc * (1 - frac * 0.62);
          const m = frac > 0.58 ? mWisteriaLight : mWisteria;
          const ox = rx + Math.sin(k * 2.2) * 0.012;
          const oy = ry - k * 0.050 * sc;
          const oz = rz + Math.cos(k * 1.8) * 0.012;
          add(g, sph(s, 7, 5), m, ox, oy, oz, 0, 0, 0, 1.0, 1.32, 1.0);
          if (k < cnt - 2) {
            add(g, sph(s * 0.74, 6, 4), k % 2 ? mWisteriaLight : mWisteria,
              ox + (k % 2 ? 0.019 : -0.019), oy - 0.015, oz + 0.012, 0, 0, 0, 1, 1.25, 1);
          }
        }
      }
      addVine(g, mMoss, [[-0.08, 1.20, 0.02], [-0.30, 1.06, 0.06], [-0.41, 0.80, 0.05], [-0.38, 0.54, 0.04]], 0.012, 7);

      addDaisy(g, mCream, mPollen, 0.34, 0.145, 0.20, 0.42, -0.3, 0, 0.84);
      addDaisy(g, mCream, mPollen, 0.26, 0.155, 0.24, 0.48,  0.2, 0, 0.74);
      addDaisy(g, mCream, mPollen, 0.38, 0.130, 0.13, 0.35, -0.6, 0, 0.68);
    });
  }

  // ==========================================================================
  // 10. sr_telescope_tripod — Cross-stitched leather & brass spyglass angled at graceful 3/4 profile (prop_10.png!)
  // ==========================================================================
  function sr_telescope_tripod() {
    return buildMergedProto('sr_telescope_tripod', (g) => {
      const headY = 0.64;
      add(g, cyl(0.085, 0.098, 0.058, 18), mBrass, 0, headY, 0);
      add(g, cyl(0.062, 0.078, 0.038, 16), mBrassDark, 0, headY + 0.042, 0);
      add(g, cyl(0.046, 0.046, 0.040, 14), mBrass, 0, 0.285, 0);

      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.18;
        const topX = Math.sin(a) * 0.065, topZ = Math.cos(a) * 0.065;
        const botX = Math.sin(a) * 0.345, botZ = Math.cos(a) * 0.345;
        const midX = (topX + botX) * 0.5, midZ = (topZ + botZ) * 0.5;
        const tilt = Math.atan2(0.28, headY);

        const legGrp = new THREE.Group();
        legGrp.position.set(midX, headY * 0.5, midZ);
        legGrp.rotation.set(0, a, 0);
        g.add(legGrp);

        add(legGrp, rbox(0.046, 0.70, 0.050, 0.008), mWoodDark, 0, 0, 0, -tilt, 0, 0);
        add(legGrp, box(0.058, 0.085, 0.062), mBrass, 0,  0.265, -0.118, -tilt, 0, 0);
        add(legGrp, box(0.058, 0.058, 0.062), mBrass, 0, -0.042,  0.019, -tilt, 0, 0);
        add(legGrp, box(0.056, 0.068, 0.060), mBrass, 0, -0.310,  0.138, -tilt, 0, 0);
        add(legGrp, sph(0.011, 6, 4), mBrassDark, 0, -0.042, 0.052, -tilt, 0, 0);

        add(g, tube([[0, 0.285, 0], [Math.sin(a) * 0.215, 0.285, Math.cos(a) * 0.215]], 0.013, 5, 5), mBrass);
      }

      // Azimuth turret rotated 0.88 rad (~50 deg toward front-right +X/+Z) matching prop_10.png!
      const yaw = 0.88;
      const turret = new THREE.Group();
      turret.rotation.y = yaw;
      g.add(turret);

      add(turret, cyl(0.048, 0.060, 0.075, 16), mBrass, 0, 0.70, 0);
      add(turret, tor(0.072, 0.018, 5, 14, PI), mBrass, 0, 0.815, 0, PI, 0, 0);
      add(turret, tor(0.088, 0.015, 5, 14, PI * 0.82), mBrassDark, 0, 0.85, 0.04, PI * 0.95, PI / 2, 0);

      for (const sx of [-1, 1]) {
        const wx = sx * 0.082, wy = 0.825;
        add(turret, tor(0.066, 0.013, 5, 16), mBrass, wx, wy, 0, 0, PI / 2, 0);
        add(turret, cyl(0.022, 0.022, 0.028, 10), mBrassDark, wx, wy, 0, 0, 0, PI / 2);
        for (let sp = 0; sp < 6; sp++) {
          add(turret, box(0.012, 0.122, 0.012), mBrassDark, wx, wy, 0, (sp / 6) * TAU, 0, 0);
        }
      }

      const scope = new THREE.Group();
      scope.position.set(0, 0.875, 0.02);
      scope.rotation.set(-0.32, 0, 0);
      turret.add(scope);

      // Eyepiece + 3 stepped brass drawtubes + top knurled focus wheel
      add(scope, tor(0.032, 0.010, 5, 12), mBrass, 0, 0, -0.405);
      add(scope, cyl(0.020, 0.020, 0.016, 10), mIron, 0, 0, -0.412, PI / 2, 0, 0);
      add(scope, cyl(0.030, 0.024, 0.11, 14), mBrass, 0, 0, -0.35, PI / 2, 0, 0);
      add(scope, tor(0.034, 0.008, 4, 12), mBrassDark, 0, 0, -0.295);
      add(scope, cyl(0.044, 0.034, 0.11, 14), mBrass, 0, 0, -0.24, PI / 2, 0, 0);
      add(scope, tor(0.048, 0.009, 4, 14), mBrassDark, 0, 0, -0.185);
      add(scope, cyl(0.060, 0.048, 0.13, 16), mBrass, 0, 0, -0.12, PI / 2, 0, 0);

      add(scope, cyl(0.014, 0.018, 0.044, 8), mBrassDark, 0, 0.070, -0.125);
      add(scope, cyl(0.034, 0.034, 0.018, 12), mBrass, 0, 0.095, -0.125);

      // Russet-leather main barrel wrap + 3D tan X-laced cross-stitching facing camera (-X flank of scope!)
      add(scope, cyl(0.086, 0.064, 0.23, 18), mLeather, 0, 0, 0.055, PI / 2, 0, 0);
      for (const [z, R] of [[-0.058, 0.066], [0.168, 0.088]]) {
        add(scope, cyl(R, R, 0.028, 18), mBrass, 0, 0, z, PI / 2, 0, 0);
      }
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const z0 = -0.025 + k * 0.050;
          const rM = 0.069 + k * 0.0045;
          for (const diag of [-1, 1]) {
            add(scope, tube([
              [sx * rM * 0.94, -0.026 * diag, z0],
              [sx * (rM + 0.006), 0.0, z0 + 0.022],
              [sx * (rM + 0.005) * 0.94, 0.026 * diag, z0 + 0.044],
            ], 0.0055, 5, 4), mRope);
          }
        }
      }

      add(scope, cyl(0.098, 0.088, 0.07, 18), mLeather, 0, 0, 0.21, PI / 2, 0, 0);
      add(scope, cyl(0.114, 0.100, 0.10, 20), mBrass, 0, 0, 0.29, PI / 2, 0, 0);
      add(scope, tor(0.112, 0.013, 5, 20), mBrassDark, 0, 0, 0.34);
      add(scope, cyl(0.096, 0.096, 0.018, 18), mAzure, 0, 0, 0.312, PI / 2, 0, 0);

      const gLens = prepMergeGeo(sph(0.095, 14, 9));
      gLens.scale(1, 1, 0.28);
      gLens.rotateX(-0.32);
      gLens.translate(0, 0.875 + Math.sin(0.32) * 0.325, 0.02 + Math.cos(0.32) * 0.325);
      gLens.rotateY(yaw);
      g.add(new THREE.Mesh(gLens, mGlass));
    });
  }

  // ==========================================================================
  // 11. sr_specimen_crate — Slatted cedar crate w/ riveted brass corners, lush ferns, fiddlehead & 2 glowing jars
  // ==========================================================================
  function sr_specimen_crate() {
    return buildMergedProto('sr_specimen_crate', (g) => {
      const W = 0.72, D = 0.50, H = 0.43;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const px = sx * 0.324, pz = sz * 0.214;
          add(g, rbox(0.072, H, 0.072, 0.008), mWood, px, H * 0.5, pz);
          for (const by of [0.042, H - 0.048]) {
            add(g, box(0.086, 0.076, 0.086), mBrass, px, by, pz);
            add(g, sph(0.012, 6, 4), mBrass, px + sx * 0.044, by, pz);
            add(g, sph(0.012, 6, 4), mBrass, px, by, pz + sz * 0.044);
          }
        }
      }
      add(g, box(W - 0.04, 0.038, D - 0.04), mWood, 0, 0.025, 0);
      for (const y of [0.078, 0.212, 0.348]) {
        add(g, rbox(W, 0.082, 0.032, 0.005), mWood, 0, y,  D / 2 - 0.012);
        add(g, box(W, 0.082, 0.032), mWood, 0, y, -D / 2 + 0.012);
        add(g, box(0.032, 0.082, D), mWood,  W / 2 - 0.012, y, 0);
        add(g, box(0.032, 0.082, D), mWood, -W / 2 + 0.012, y, 0);
      }

      // Mossy soil bed + cascading front-left & far-left botanical vines
      add(g, rbox(W - 0.10, 0.15, D - 0.10, 0.030), mFern, 0, 0.125, 0);
      addMossClump(g, mFern, -0.19, 0.41, 0.11, 0.12);
      addMossClump(g, mFern, -0.08, 0.39, -0.06, 0.11);

      addVine(g, mFern, [[-0.20, 0.43, 0.23], [-0.23, 0.30, 0.28], [-0.19, 0.14, 0.27]], 0.011, 5);
      addVine(g, mFern, [[-0.34, 0.42, 0.08], [-0.43, 0.30, 0.10], [-0.42, 0.14, 0.07]], 0.011, 6);
      addVine(g, mFern, [[ 0.28, 0.42, 0.02], [ 0.39, 0.45, 0.04], [ 0.41, 0.30, 0.06]], 0.010, 4);

      addDaisy(g, mCream, mAmberGlow, -0.16, 0.47, 0.18, 0.45,  0.15, 0, 0.82);
      addDaisy(g, mCream, mAmberGlow, -0.09, 0.46, 0.21, 0.52, -0.10, 0, 0.76);
      addDaisy(g, mCream, mAmberGlow, -0.23, 0.48, 0.14, 0.38,  0.35, 0, 0.72);

      // 4 Sweeping Pinnate Fern Fronds framed cleanly BEHIND the 2 glowing specimen jars!
      const fronds = [
        { pts: [[-0.16, 0.36, -0.02], [-0.30, 0.66, -0.02], [-0.45, 0.77, -0.02]], yaw:  2.55, sc: 1.05 },
        { pts: [[-0.06, 0.36, -0.07], [ 0.02, 0.72, -0.10], [ 0.14, 0.89, -0.12]], yaw: -0.32, sc: 1.12 },
        { pts: [[ 0.05, 0.36, -0.08], [ 0.24, 0.66, -0.08], [ 0.42, 0.74, -0.06]], yaw: -1.18, sc: 1.04 },
        { pts: [[-0.19, 0.36,  0.04], [-0.34, 0.57,  0.10], [-0.45, 0.61,  0.15]], yaw:  1.72, sc: 0.90 },
      ];
      for (const fr of fronds) {
        const cv = new THREE.CatmullRomCurve3(fr.pts.map((p) => new THREE.Vector3(...p)));
        add(g, new THREE.TubeGeometry(cv, 9, 0.011 * fr.sc, 4, false), mFern);
        for (let i = 2; i <= 11; i++) {
          const t = i / 12;
          const p = cv.getPoint(t);
          const sz = Math.sin(t * PI * 0.92) * fr.sc;
          for (const s of [-1, 1]) {
            addLeaf(g, mFern,
              p.x + Math.cos(fr.yaw) * s * 0.052 * sz,
              p.y,
              p.z - Math.sin(fr.yaw) * s * 0.052 * sz,
              0.14, fr.yaw + s * 1.28, s * 0.16, 0.082 * sz + 0.016, 0.016 * sz + 0.005);
          }
        }
      }

      // Coiled Spiral Fiddlehead Fern rising at upper-left!
      const spiralPts = [[-0.13, 0.38, 0.0], [-0.15, 0.62, 0.01], [-0.16, 0.78, 0.02]];
      for (let i = 0; i <= 11; i++) {
        const a = (i / 11) * PI * 2.65;
        const r = 0.056 * (1 - (i / 11) * 0.78);
        spiralPts.push([-0.205 + Math.cos(a) * r, 0.835 + Math.sin(a) * r, 0.022]);
      }
      add(g, tube(spiralPts, 0.014, 18, 5), mFern);

      // 2 Unobstructed Corked Glass Specimen Jars at front-right (+Z) w/ radiant cyan & amber blooms!
      const jars = [
        { x: 0.175, z: 0.095, h: 0.45, r: 0.092, glow: mCyanGlow, petals: 8 },
        { x: 0.000, z: 0.115, h: 0.34, r: 0.082, glow: mAmberGlow, petals: 8 },
      ];
      const jarGlassGeos = [];
      for (const jr of jars) {
        const y0 = 0.16;
        add(g, cyl(jr.r * 0.66, jr.r * 0.56, 0.058, 12), mRope, jr.x, y0 + jr.h + 0.018, jr.z);
        const fy = y0 + jr.h * 0.65;
        add(g, cyl(0.009, 0.011, fy - y0, 5), mFern, jr.x, (y0 + fy) * 0.5, jr.z);
        addLeaf(g, mFern, jr.x - 0.026, fy - 0.065, jr.z + 0.01, 0.35, 0.4,  0.5, 0.048, 0.020);
        addLeaf(g, mFern, jr.x + 0.026, fy - 0.075, jr.z + 0.01, 0.35, -0.4, -0.5, 0.048, 0.020);
        for (let p = 0; p < jr.petals; p++) {
          const a = (p / jr.petals) * TAU;
          add(g, sph(1, 6, 4), jr.glow,
            jr.x + Math.cos(a) * 0.036, fy + Math.sin(a) * 0.030, jr.z + 0.018,
            0.22, 0, -a + PI / 2, 0.016, 0.040, 0.009);
        }
        add(g, sph(0.022, 7, 5), jr.glow === mCyanGlow ? mCream : mAmberGlow, jr.x, fy, jr.z + 0.024);

        const bodyG = prepMergeGeo(cyl(jr.r, jr.r, jr.h - 0.055, 14));
        bodyG.translate(jr.x, y0 + (jr.h - 0.055) * 0.5, jr.z);
        const shldG = prepMergeGeo(cyl(jr.r * 0.68, jr.r, 0.042, 14));
        shldG.translate(jr.x, y0 + jr.h - 0.034, jr.z);
        const lipG = prepMergeGeo(tor(jr.r * 0.70, 0.010, 4, 14));
        lipG.rotateX(PI / 2);
        lipG.translate(jr.x, y0 + jr.h - 0.008, jr.z);
        jarGlassGeos.push(bodyG, shldG, lipG);
      }
      g.add(new THREE.Mesh(mergeGeometries(jarGlassGeos, false), mGlass));
    });
  }

  // ==========================================================================
  // 12. sr_ornithopter_seat — Quilted leather & brass ornithopter captain's seat w/ dragon wings, gears & twin levers
  // ==========================================================================
  function sr_ornithopter_seat() {
    return buildMergedProto('sr_ornithopter_seat', (g) => {
      add(g, cyl(0.285, 0.315, 0.068, 20), mWoodDark, 0, 0.034, 0);
      add(g, tor(0.285, 0.018, 5, 20), mBrass, 0, 0.068, 0, PI / 2, 0, 0);
      add(g, cyl(0.185, 0.215, 0.055, 16), mBrass, 0, 0.095, 0);
      add(g, rbox(0.22, 0.14, 0.22, 0.020), mBrassDark, 0, 0.185, 0);
      add(g, sph(0.042, 8, 6), mBrass, 0.115, 0.195, 0);
      add(g, sph(0.042, 8, 6), mBrass, -0.115, 0.195, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + PI / 6;
        add(g, box(0.062, 0.088, 0.085), mBrass, Math.sin(a) * 0.285, 0.048, Math.cos(a) * 0.285, -0.25, a, 0);
        add(g, sph(0.012, 5, 4), mBrassDark, Math.sin(a) * 0.322, 0.042, Math.cos(a) * 0.322);
      }

      add(g, rbox(0.50, 0.068, 0.48, 0.016), mBrass, 0, 0.285, 0.02);
      add(g, rbox(0.43, 0.125, 0.45, 0.042, 2), mLeather, 0, 0.365, 0.03);
      for (const tx of [-0.105, 0.105]) {
        for (const tz of [-0.05, 0.11]) {
          add(g, sph(0.058, 7, 5), mLeather, tx, 0.418, tz, 0, 0, 0, 1.28, 0.42, 1.28);
        }
      }
      add(g, sph(0.012, 6, 4), mBrass, 0, 0.428, 0.03);

      const back = new THREE.Group();
      back.position.set(0, 0.37, -0.165);
      back.rotation.set(-0.24, 0, 0);
      g.add(back);

      add(back, rbox(0.48, 0.62, 0.075, 0.020), mBrass, 0, 0.31, -0.025);
      for (const sx of [-1, 1]) {
        add(back, rbox(0.058, 0.64, 0.092, 0.014), mBrass, sx * 0.225, 0.32, -0.012);
      }
      add(back, rbox(0.40, 0.56, 0.105, 0.040, 2), mLeather, 0, 0.31, 0.018);

      for (let r = 0; r < 3; r++) {
        for (const tx of [-0.095, 0.0, 0.095]) {
          const py = 0.13 + r * 0.165 + (tx === 0 ? 0.05 : 0);
          if (py > 0.54) continue;
          add(back, sph(0.052, 7, 5), mLeather, tx, py, 0.058, 0, 0, PI / 4, 1.15, 1.15, 0.36);
          add(back, sph(0.010, 5, 4), mBrass, tx, py + 0.05, 0.072);
        }
      }

      add(back, cyl(0.088, 0.088, 0.45, 16), mLeather, 0, 0.665, 0.022, 0, 0, PI / 2);
      for (const sx of [-1, 1]) {
        add(back, tor(0.088, 0.011, 5, 16), mBrass, sx * 0.125, 0.665, 0.022, 0, PI / 2, 0);
        add(back, cyl(0.094, 0.094, 0.036, 14), mBrass, sx * 0.228, 0.665, 0.022, 0, 0, PI / 2);
        add(back, sph(0.038, 7, 5), mBrassDark, sx * 0.248, 0.665, 0.022);
      }

      for (const sx of [-1, 1]) {
        const wg = new THREE.Group();
        wg.position.set(sx * 0.235, 0.41, -0.02);
        wg.rotation.set(0.05, -sx * 0.24, 0);
        back.add(wg);

        add(wg, cyl(0.044, 0.044, 0.038, 10), mBrass, 0, 0, 0, 0, 0, PI / 2);
        const ribs = [
          [[0, 0.02, 0], [sx * 0.16,  0.14, -0.01], [sx * 0.32,  0.17, -0.02]],
          [[0, 0.00, 0], [sx * 0.15,  0.03, -0.02], [sx * 0.28,  0.02, -0.03]],
          [[0,-0.02, 0], [sx * 0.12, -0.07, -0.02], [sx * 0.22, -0.11, -0.02]],
          [[0,-0.04, 0], [sx * 0.07, -0.14, -0.01], [sx * 0.13, -0.22, -0.01]],
        ];
        for (const rb of ribs) {
          add(wg, tube(rb, 0.011, 7, 4), mBrassDark);
        }
        add(wg, sph(1, 8, 6), mWing, sx * 0.15,  0.07, -0.02, 0, 0,  sx * 0.35, 0.145, 0.072, 0.008);
        add(wg, sph(1, 8, 6), mWing, sx * 0.13, -0.03, -0.02, 0, 0, -sx * 0.22, 0.130, 0.068, 0.008);
        add(wg, sph(1, 8, 6), mWing, sx * 0.09, -0.12, -0.015, 0, 0, -sx * 0.68, 0.105, 0.058, 0.008);
      }

      for (const sx of [-1, 1]) {
        const ax = sx * 0.245;
        add(g, box(0.058, 0.19, 0.064), mBrass, ax, 0.39, -0.13, -0.22, 0, 0);
        add(g, box(0.058, 0.18, 0.064), mBrass, ax, 0.39,  0.19,  0.22, 0, 0);
        add(g, rbox(0.072, 0.048, 0.39, 0.014), mBrass, ax, 0.485, 0.03);
        add(g, rbox(0.064, 0.036, 0.32, 0.012), mLeather, ax, 0.512, 0.025);

        const gx = sx * 0.278, gy = 0.355, gz = -0.08;
        add(g, tor(0.074, 0.016, 5, 16), mBrass, gx, gy, gz, 0, PI / 2, 0);
        add(g, cyl(0.028, 0.028, 0.036, 10), mBrassDark, gx, gy, gz, 0, 0, PI / 2);
        for (let s = 0; s < 6; s++) {
          add(g, box(0.018, 0.138, 0.016), mBrassDark, gx, gy, gz, (s / 6) * TAU, 0, 0);
        }
        for (let t = 0; t < 12; t++) {
          const ta = (t / 12) * TAU;
          add(g, box(0.026, 0.022, 0.020), mBrass, gx, gy + Math.cos(ta) * 0.086, gz + Math.sin(ta) * 0.086, ta, 0, 0);
        }
        add(g, cyl(0.042, 0.042, 0.030, 10), mBrassDark, sx * 0.272, 0.33, -0.20, 0, 0, PI / 2);
      }

      for (const [lx, lz, tiltX] of [[-0.225, 0.29, 0.24], [-0.315, 0.25, 0.34]]) {
        add(g, tube([
          [lx, 0.26, 0.06], [lx, 0.20, 0.20], [lx, 0.29, 0.33], [lx, 0.45, lz + 0.04],
        ], 0.026, 11, 6), mBrass);
        add(g, rbox(0.064, 0.062, 0.135, 0.010), mBrass, lx, 0.475, lz);
        add(g, box(0.018, 0.022, 0.095), mIron, lx, 0.502, lz);
        add(g, cyl(0.022, 0.026, 0.032, 8), mBrassDark, lx, 0.515, lz);
        add(g, cyl(0.014, 0.018, 0.23, 8), mBrass, lx, 0.625, lz + Math.sin(tiltX) * 0.095, tiltX, 0, 0);
        add(g, tor(0.019, 0.006, 4, 8), mBrassDark, lx, 0.715, lz + Math.sin(tiltX) * 0.175, tiltX + PI / 2, 0, 0);
        add(g, sph(0.038, 10, 8), mWoodDark, lx, 0.755, lz + Math.sin(tiltX) * 0.21, 0, 0, 0, 0.96, 1.12, 0.96);
      }
    });
  }

  // ==========================================================================
  // 13. BESPOKE DISGUISE 1: buildRootClingPod (`sr_root_cling_pod`)
  //     Mossy gnarled ancient Celestian root-knot & glowing blue sky-orchid vine pod (~0.75m tall)
  // ==========================================================================
  function sr_root_cling_pod() {
    return buildMergedProto('sr_root_cling_pod', (g) => {
      add(g, sph(1, 12, 9), mWoodDark, 0, 0.37, -0.02, 0, 0, 0, 0.25, 0.30, 0.23);
      const rootPaths = [
        [[-0.06, 0.73, -0.04], [-0.22, 0.57, 0.12], [-0.28, 0.34, 0.18], [-0.14, 0.10, 0.10], [-0.04, 0.03, 0.0]],
        [[ 0.07, 0.74, -0.02], [ 0.24, 0.55, 0.10], [ 0.27, 0.32, 0.16], [ 0.13, 0.09, 0.09], [ 0.04, 0.03, 0.0]],
        [[ 0.00, 0.72, -0.08], [-0.12, 0.52, 0.21], [ 0.10, 0.28, 0.22], [-0.05, 0.06, 0.12]],
        [[-0.16, 0.65, -0.10], [-0.30, 0.44, -0.06], [-0.24, 0.18, -0.08], [-0.08, 0.04, -0.06]],
        [[ 0.16, 0.64, -0.10], [ 0.29, 0.42, -0.07], [ 0.23, 0.17, -0.09], [ 0.08, 0.04, -0.06]],
        [[ 0.02, 0.67,  0.08], [ 0.16, 0.46,  0.20], [-0.15, 0.22,  0.19], [ 0.02, 0.05,  0.08]],
      ];
      rootPaths.forEach((pts, idx) => {
        add(g, tube(pts, idx < 3 ? 0.046 : 0.038, 14, 6), idx % 2 === 0 ? mWoodDark : mWood);
      });

      add(g, makeFacetedCrystalGeo(THREE, 0.045, 0.095, 0.065, 6), mCyanGlow,  0.02, 0.42, 0.20, 0.35, 0.2, -0.15);
      add(g, makeFacetedCrystalGeo(THREE, 0.035, 0.075, 0.055, 6), mCyanGlow, -0.11, 0.33, 0.19, 0.28, -0.3, 0.30);

      addMossClump(g, mMoss, -0.08, 0.64, 0.11, 0.125);
      addMossClump(g, mMoss,  0.12, 0.58, 0.12, 0.110);
      addMossClump(g, mMoss, -0.18, 0.36, 0.16, 0.105);
      addMossClump(g, mMoss,  0.16, 0.28, 0.15, 0.095);
      addVine(g, mFern, [[-0.18, 0.60, 0.14], [-0.33, 0.44, 0.18], [-0.31, 0.20, 0.14], [-0.24, 0.05, 0.10]], 0.012, 6);
      addVine(g, mFern, [[ 0.20, 0.56, 0.12], [ 0.34, 0.38, 0.15], [ 0.30, 0.15, 0.11]], 0.011, 5);

      addOrchid(g, -0.09, 0.56, 0.24, 0.24,  0.28,  0.12, 1.08);
      addOrchid(g,  0.12, 0.46, 0.25, 0.30, -0.32, -0.14, 1.02);
      addOrchid(g,  0.02, 0.67, 0.17, 0.18,  0.05,  0.04, 0.92);
    });
  }

  // ==========================================================================
  // 14. BESPOKE DISGUISE 2: buildHoveringRuneStone (`sr_hovering_rune_stone`)
  //     Carved floating Celestian skyglass boulder (~0.85m wide) w/ glowing cyan square-spiral runes
  // ==========================================================================
  function sr_hovering_rune_stone() {
    return buildMergedProto('sr_hovering_rune_stone', (g) => {
      const boulder = new THREE.Group();
      boulder.position.set(0, 0.42, 0);
      boulder.rotation.set(0.08, 0.22, -0.09);
      g.add(boulder);

      add(boulder, rbox(0.58, 0.46, 0.54, 0.090, 2), mStone, 0, 0.02, 0);
      add(boulder, rbox(0.42, 0.14, 0.40, 0.028), mStoneDark, 0.02, 0.24, -0.01);
      add(boulder, cyl(0.24, 0.09, 0.20, 7), mStoneDark, 0, -0.24, 0);
      add(boulder, rbox(0.26, 0.24, 0.24, 0.036), mStoneDark, -0.20, -0.06, 0.16, 0.15, 0.35, -0.12);
      add(boulder, rbox(0.24, 0.22, 0.24, 0.036), mStone,  0.21, -0.04, -0.14, -0.12, 0.28, 0.15);

      addSquareSpiralRune(boulder, mCyanGlow, 0, 0.03,  0.275, 0, 0.22);
      addSquareSpiralRune(boulder, mCyanGlow, 0, 0.03, -0.275, PI, 0.20);
      addSquareSpiralRune(boulder, mCyanGlow,  0.295, 0.03, 0, PI / 2, 0.19);
      addSquareSpiralRune(boulder, mCyanGlow, -0.295, 0.03, 0, -PI / 2, 0.19);
      add(boulder, tor(0.285, 0.010, 4, 22), mCyanGlow, 0, -0.10, 0, PI / 2, 0, 0);
      add(boulder, makeFacetedCrystalGeo(THREE, 0.058, 0.14, 0.08, 6), mCyanGlow, 0.12, 0.28, 0.08, 0.18, 0.4, -0.28);
      add(boulder, makeFacetedCrystalGeo(THREE, 0.036, 0.09, 0.05, 6), mCyanCore, 0.12, 0.28, 0.08, 0.18, 0.4, -0.28);

      addMossClump(boulder, mMoss, -0.08, 0.31, 0.04, 0.13);
      addMossClump(boulder, mMoss,  0.14, 0.26, -0.06, 0.09);
      addDaisy(boulder, mCream, mPollen, -0.12, 0.37, 0.08, 0.3, 0.2, 0, 0.84);
      addDaisy(boulder, mCream, mPollen, -0.03, 0.38, 0.02, 0.2, -0.3, 0, 0.76);

      const shards = [
        [ 0.38, 0.48,  0.12, 0.092, 0.4, 0.6, true],
        [-0.39, 0.36,  0.14, 0.086, -0.3, 0.8, true],
        [ 0.18, 0.26,  0.38, 0.074, 0.5, -0.4, false],
        [-0.22, 0.56, -0.35, 0.080, -0.5, 0.3, true],
        [ 0.33, 0.32, -0.25, 0.070, 0.2, 1.1, false],
        [-0.14, 0.22,  0.35, 0.066, 0.6, 0.2, false],
      ];
      for (const [sx, sy, sz, sr, rx, ry, hasGlow] of shards) {
        add(g, rbox(sr * 1.25, sr * 0.85, sr, sr * 0.20), mStoneDark, sx, sy, sz, rx, ry, 0.25);
        if (hasGlow) {
          add(g, box(sr * 0.82, 0.014, sr * 1.04), mCyanGlow, sx, sy, sz, rx, ry, 0.25);
        }
      }
    });
  }

  // ==========================================================================
  // 15. BESPOKE DISGUISE 3: buildDormantGolemCore (`sr_dormant_golem_core`)
  //     Mossy ancient Celestian stone Golem torso-shell / relic cube (~0.85m) w/ pulsing cyan core & daisies
  // ==========================================================================
  function sr_dormant_golem_core() {
    return buildMergedProto('sr_dormant_golem_core', (g) => {
      add(g, rbox(0.58, 0.12, 0.48, 0.028), mStoneDark, 0, 0.06, 0);
      add(g, cyl(0.24, 0.27, 0.14, 16), mIron, 0, 0.16, 0);
      add(g, rbox(0.64, 0.54, 0.50, 0.10, 2), mStone, 0, 0.47, 0);
      add(g, rbox(0.46, 0.10, 0.38, 0.024), mStoneDark, 0, 0.75, -0.01);
      add(g, cyl(0.15, 0.17, 0.075, 14), mIron, 0, 0.79, 0);

      for (const sx of [-1, 1]) {
        add(g, cyl(0.165, 0.175, 0.10, 16), mStone, sx * 0.348, 0.52, 0, 0, 0, PI / 2);
        add(g, tor(0.125, 0.022, 5, 16), mStoneDark, sx * 0.398, 0.52, 0, 0, PI / 2, 0);
        add(g, cyl(0.082, 0.082, 0.04, 12), mIron, sx * 0.402, 0.52, 0, 0, 0, PI / 2);
      }

      add(g, cyl(0.148, 0.158, 0.08, 18), mIron, 0, 0.48, 0.228, PI / 2, 0, 0);
      add(g, tor(0.155, 0.022, 6, 20), mStoneDark, 0, 0.48, 0.252);
      add(g, tor(0.126, 0.012, 5, 20), mCyanGlow, 0, 0.48, 0.262);
      add(g, makeFacetedCrystalGeo(THREE, 0.088, 0.13, 0.13, 6), mCyanGlow, 0, 0.48, 0.252, PI / 2, 0, 0.35);
      add(g, sph(0.056, 10, 8), mCyanCore, 0, 0.48, 0.285, 0, 0, 0, 1, 1, 0.55);

      for (const sx of [-1, 1]) {
        add(g, box(0.095, 0.028, 0.024), mStoneDark, sx * 0.215, 0.52, 0.250);
        add(g, box(0.082, 0.026, 0.026), mCyanGlow,  sx * 0.205, 0.44, 0.250);
      }
      add(g, tor(0.11, 0.016, 5, 16), mCyanGlow, 0, 0.48, -0.252, 0, PI, 0);

      addMossClump(g, mMoss, -0.20, 0.76, 0.08, 0.135);
      addMossClump(g, mMoss,  0.18, 0.75, -0.05, 0.105);
      addMossClump(g, mMoss, -0.34, 0.66, 0.06, 0.10);
      addMossClump(g, mMoss,  0.24, 0.08, 0.22, 0.095);
      addVine(g, mMoss, [[-0.24, 0.76, 0.16], [-0.36, 0.60, 0.21], [-0.38, 0.38, 0.18], [-0.32, 0.18, 0.16]], 0.012, 6);

      addDaisy(g, mCream, mPollen, -0.22, 0.84, 0.10, 0.25, 0.2, 0.15, 0.96);
      addDaisy(g, mCream, mPollen, -0.13, 0.86, 0.05, 0.18, -0.2, 0.05, 0.88);
      addDaisy(g, mCream, mPollen, -0.29, 0.80, 0.04, 0.30, 0.5, 0.28, 0.82);
      addDaisy(g, mCream, mPollen,  0.26, 0.13, 0.25, 0.48, -0.3, 0, 0.78);
    });
  }

  // Animated Storybook creatures (non-merged hierarchy so attachCreatureKinematics articulates limbs!)
  const mFoxFur   = cMat('sr_gliderFur',   0x6f8fb8, grainTex, { roughness: 0.74, emissive: 0x101c30, emissiveIntensity: 0.08 });
  const mFoxCream = cMat('sr_gliderCream', 0xf4f1e6, grainTex, { roughness: 0.78 });
  const mGliderPink = cMat('sr_gliderPink', 0xf2a6b0, null, { roughness: 0.7 });
  const mDarkEye  = cMat('sr_darkEye',  0x1e2430, null,     { roughness: 0.28 });

  const mkAnimPart = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // 16. Floating Celestia Sky-Manta (`sr_sky_manta`)
  function sr_sky_manta(variant = 'cyan') {
    const g = new THREE.Group();
    g.name = `sr_sky_manta_${variant}`;
    g.userData.keep = true;

    const topHex = variant === 'lavender' ? 0x9b82f2 : variant === 'gold' ? 0xeba938 : 0x3ab6e8;
    const emiHex = variant === 'lavender' ? 0x382474 : variant === 'gold' ? 0x704208 : 0x0c5e8a;
    const mTop = cMat(`sr_mantaTop_${variant}`, topHex, grainTex, { roughness: 0.42, emissive: emiHex, emissiveIntensity: 0.22, side: THREE.DoubleSide });
    const mBelly = cMat('sr_mantaBelly', 0xf6f9ff, null, { roughness: 0.56, emissive: 0x9adfff, emissiveIntensity: 0.14 });
    const mRune = variant === 'gold' ? mAmberGlow : mCyanGlow;

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.set(0, 0.44, 0);
    g.add(bodyGrp);

    // Sculpted diamond mantle body + pale glowing belly
    mkAnimPart(bodyGrp, sph(1, 14, 10), mTop, 0, 0.02, 0.02, 0, 0, 0, 0.30, 0.095, 0.42);
    mkAnimPart(bodyGrp, sph(1, 12, 8), mBelly, 0, -0.025, 0.02, 0, 0, 0, 0.25, 0.065, 0.36);
    mkAnimPart(bodyGrp, sph(1, 10, 6), mRune, 0, 0.098, 0.04, 0, 0, 0, 0.10, 0.022, 0.22);

    // Forward cephalic lobes & glowing Celestian eyes (+Z forward)
    for (const sx of [-1, 1]) {
      mkAnimPart(bodyGrp, rbox(0.065, 0.032, 0.20, 0.014), mTop, sx * 0.115, 0.01, 0.40, 0.08, sx * 0.22, 0);
      mkAnimPart(bodyGrp, sph(0.026, 8, 6), mCyanCore, sx * 0.115, 0.042, 0.31);
    }

    // Articulated swept ribbon wings (-X left, +X right) + outer tips
    const buildMantaWing = (sx) => {
      const wing = new THREE.Group();
      wing.name = sx < 0 ? 'wingL' : 'wingR';
      wing.position.set(sx * 0.22, 0.02, 0.04);
      bodyGrp.add(wing);

      mkAnimPart(wing, sph(1, 10, 7), mTop, sx * 0.22, 0.0, -0.02, 0.04, sx * -0.22, 0, 0.26, 0.034, 0.23);
      mkAnimPart(wing, sph(1, 8, 6), mBelly, sx * 0.20, -0.014, -0.02, 0.04, sx * -0.22, 0, 0.22, 0.022, 0.18);
      mkAnimPart(wing, box(0.24, 0.014, 0.032), mRune, sx * 0.20, 0.024, -0.02, 0, sx * -0.26, 0);

      const tip = new THREE.Group();
      tip.name = sx < 0 ? 'tipL' : 'tipR';
      tip.position.set(sx * 0.42, 0.0, -0.07);
      wing.add(tip);
      mkAnimPart(tip, sph(1, 8, 6), mTop, sx * 0.16, 0.0, -0.05, 0, sx * -0.45, 0, 0.22, 0.022, 0.11);
      mkAnimPart(tip, sph(0.030, 8, 6), mCyanCore, sx * 0.34, 0.004, -0.13);
    };
    buildMantaWing(-1);
    buildMantaWing(1);

    // Undulating Celestian skyglass ribbon tail (-Z)
    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(0, 0.01, -0.34);
    bodyGrp.add(tailGrp);
    mkAnimPart(tailGrp, cyl(0.038, 0.016, 0.46, 8), mTop, 0, 0.0, -0.22, PI * 0.5, 0, 0);
    mkAnimPart(tailGrp, box(0.018, 0.018, 0.40), mRune, 0, 0.018, -0.21);
    mkAnimPart(tailGrp, sph(0.042, 8, 6), mCyanCore, 0, 0.008, -0.48);

    attachCreatureKinematics(g, { mode: 'sky_manta', canFly: true });
    return g;
  }

  // 17. Sky-Ruin Glider (`sr_fox_squirrel`) — slate-blue sugar-glider possum with round ears,
  //     cream face mask & belly, gliding skin-flaps along its flanks and a plain fluffy tail
  function sr_fox_squirrel() {
    const g = new THREE.Group();
    g.name = 'sr_fox_squirrel';
    g.userData.keep = true;

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.set(0, 0.22, 0);
    g.add(bodyGrp);

    // Plump slate-blue torso + cream belly + flat gliding membranes along both flanks
    mkAnimPart(bodyGrp, sph(1, 12, 9), mFoxFur, 0, 0.04, -0.02, 0.20, 0, 0, 0.130, 0.115, 0.20);
    mkAnimPart(bodyGrp, sph(1, 10, 7), mFoxCream, 0, 0.02, 0.07, 0.30, 0, 0, 0.095, 0.088, 0.12);
    for (const sx of [-1, 1]) {
      mkAnimPart(bodyGrp, sph(1, 8, 6), mFoxFur, sx * 0.125, -0.005, -0.01, 0, 0, sx * -0.20, 0.085, 0.012, 0.165);
      mkAnimPart(bodyGrp, sph(1, 8, 6), mFoxCream, sx * 0.132, -0.014, -0.01, 0, 0, sx * -0.20, 0.070, 0.008, 0.150);
    }

    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(0, 0.15, 0.14);
    bodyGrp.add(headGrp);

    mkAnimPart(headGrp, sph(0.098, 10, 8), mFoxFur, 0, 0.02, 0.02, 0, 0, 0, 1.08, 0.92, 1.0);
    mkAnimPart(headGrp, sph(0.070, 8, 6), mFoxCream, 0, -0.012, 0.050, 0, 0, 0, 1.0, 0.74, 0.95);
    mkAnimPart(headGrp, sph(0.014, 6, 5), mGliderPink, 0, 0.000, 0.118);
    for (const sx of [-1, 1]) {
      // Big round night-glider eyes + catchlights
      mkAnimPart(headGrp, sph(0.026, 8, 6), mDarkEye, sx * 0.052, 0.034, 0.090);
      mkAnimPart(headGrp, sph(0.008, 5, 4), mFoxCream, sx * 0.046, 0.044, 0.112);
      // Round cupped ears with pink inner
      mkAnimPart(headGrp, sph(0.046, 9, 7), mFoxFur, sx * 0.078, 0.098, -0.012, 0, 0, sx * -0.30, 1, 1.05, 0.42);
      mkAnimPart(headGrp, sph(0.030, 8, 6), mGliderPink, sx * 0.078, 0.098, 0.004, 0, 0, sx * -0.30, 1, 1.05, 0.30);
    }

    // Long plain fluffy tail curving upward (one even slate tone, no bands)
    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(0, 0.06, -0.18);
    bodyGrp.add(tailGrp);
    mkAnimPart(tailGrp, sph(1, 10, 8), mFoxFur, 0, 0.11, -0.10, -0.78, 0, 0, 0.066, 0.165, 0.072);
    mkAnimPart(tailGrp, sph(1, 9, 7), mFoxFur, 0, 0.245, -0.165, -0.30, 0, 0, 0.062, 0.110, 0.066);

    // 4 nimble bounding paws split into diagonal trot pairs
    const legsA = new THREE.Group();
    legsA.name = 'legsA';
    legsA.position.set(0, 0.12, 0);
    g.add(legsA);
    mkAnimPart(legsA, cyl(0.028, 0.022, 0.15, 7), mFoxFur, -0.075, -0.04, 0.12);
    mkAnimPart(legsA, cyl(0.032, 0.024, 0.15, 7), mFoxFur, 0.078, -0.04, -0.12);

    const legsB = new THREE.Group();
    legsB.name = 'legsB';
    legsB.position.set(0, 0.12, 0);
    g.add(legsB);
    mkAnimPart(legsB, cyl(0.028, 0.022, 0.15, 7), mFoxFur, 0.075, -0.04, 0.12);
    mkAnimPart(legsB, cyl(0.032, 0.024, 0.15, 7), mFoxFur, -0.078, -0.04, -0.12);

    attachCreatureKinematics(g, { mode: 'clockwork_pet', canFly: false });
    return g;
  }

  const builders = {
    sr_levitation_urn,
    sr_golem_head,
    sr_sky_compass,
    sr_pirate_chest,
    sr_cloud_planter,
    sr_propeller_barrel,
    sr_wind_chime_stand,
    sr_crystal_lantern,
    sr_stone_stele,
    sr_telescope_tripod,
    sr_specimen_crate,
    sr_ornithopter_seat,
    sr_sky_manta: () => sr_sky_manta('cyan'),
    sr_fox_squirrel,
    sr_root_cling_pod,
    sr_hovering_rune_stone,
    sr_dormant_golem_core,
  };

  _kitCache.set(THREE, builders);
  return builders;
}

export function buildRootClingPod(THREE) {
  return getSkyPropKit(THREE).sr_root_cling_pod();
}

export function buildHoveringRuneStone(THREE) {
  return getSkyPropKit(THREE).sr_hovering_rune_stone();
}

export function buildDormantGolemCore(THREE) {
  return getSkyPropKit(THREE).sr_dormant_golem_core();
}

export function buildSkyMantaVariant(THREE, variant = 'cyan') {
  getSkyPropKit(THREE);
  // Build variant dynamically so fleet maintains distinct turquoise/lavender/gold hues
  const base = getSkyPropKit(THREE).sr_sky_manta();
  if (variant === 'cyan') return base;
  const topCol = variant === 'lavender' ? 0x9b82f2 : variant === 'gold' ? 0xeba938 : 0x3ab6e8;
  const emiCol = variant === 'lavender' ? 0x382474 : variant === 'gold' ? 0x704208 : 0x0c5e8a;
  const runeCol = variant === 'gold' ? 0xffb830 : 0x2ad8ff;
  base.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    if (m.material.name === 'sr_mantaTop_cyan' || m.material.color?.getHex() === 0x3ab6e8) {
      m.material = m.material.clone();
      m.material.color.setHex(topCol);
      m.material.emissive.setHex(emiCol);
    } else if (m.material.color?.getHex() === 0x2ad8ff && variant === 'gold') {
      m.material = m.material.clone();
      m.material.color.setHex(runeCol);
      m.material.emissive.setHex(0xf47e08);
    }
  });
  return base;
}

export function buildFoxSquirrel(THREE) {
  return getSkyPropKit(THREE).sr_fox_squirrel();
}

export function buildMapProps(THREE) {
  return getSkyPropKit(THREE);
}
