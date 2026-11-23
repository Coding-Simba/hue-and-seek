/* Hue & Seek — Map 3: Porto Sereno Seaplane Cove (maps/seaplane/props.js)
 * 12 Storybook hideable props for an original seaside harbour town,
 * sculpted faithfully from assets/maps/seaplane/props_sheet.png (<= 8 draw calls each).
 */
import {
  createPropBuilder,
  paintedCanvasTex,
  brushStrokes,
  mergeGeometries,
} from '../map_kit.js?v=2';
import { attachCreatureKinematics, createMatCache } from '../world_interactives.js?v=v10';

const PI = Math.PI;
const TAU = PI * 2;

export const PROPS = [
  { id: 'sp_gelato_cart', label: 'Gelato Cart', icon: '🍨', radius: 0.56, height: 1.32 },
  { id: 'sp_olive_amphora', label: 'Olive Amphora', icon: '🏺', radius: 0.34, height: 1.02 },
  { id: 'sp_lobster_trap', label: 'Lobster Pot', icon: '🦞', radius: 0.52, height: 0.72 },
  { id: 'sp_anchor_bollard', label: 'Harbor Bollard', icon: '⚓', radius: 0.44, height: 0.84 },
  { id: 'sp_lemon_planter', label: 'Lemon Majolica Pot', icon: '🍋', radius: 0.46, height: 1.08 },
  { id: 'sp_bistro_set', label: 'Trattoria Table', icon: '🍷', radius: 0.58, height: 0.86 },
  { id: 'sp_fuel_drum', label: 'Aviation Fuel Drum', icon: '⛽', radius: 0.34, height: 1.06 },
  { id: 'sp_pelican_post', label: 'Seagull Pier Post', icon: '🐦', radius: 0.44, height: 1.16 },
  { id: 'sp_wine_rack', label: 'Chianti Bottle Rack', icon: '🍾', radius: 0.48, height: 0.96 },
  { id: 'sp_sea_chest', label: 'Sailor Sea Chest', icon: '🧳', radius: 0.50, height: 0.72 },
  { id: 'sp_buoy_float', label: 'Glass Float Rack', icon: '🫧', radius: 0.46, height: 0.94 },
  { id: 'sp_propeller_stand', label: 'Seaplane Propeller', icon: '🛩️', radius: 0.56, height: 0.88 },
  { id: 'sp_seagull', label: 'Adriatic Seagull', icon: '🕊️', radius: 0.31, height: 0.62, hp: 150, _hpScaled: true, speed: 1.15, isAnimal: true, canFly: true, flyMaxY: 14.5, flapIntervalMs: 320, flapPitch: 1.25 },
  { id: 'sp_pelican', label: 'Porto Pelican', icon: '🦢', radius: 0.46, height: 0.86, hp: 175, _hpScaled: true, speed: 1.05, isAnimal: true, canFly: true, flyMaxY: 14.0, flapIntervalMs: 420, flapPitch: 0.82 },
];

export const PROP_ICONS = Object.fromEntries(PROPS.map((p) => [p.id, p.icon]));

export function buildMapProps(THREE) {
  const pb = createPropBuilder(THREE, 303);
  const { mat, buildMergedProto, add, rbox, lathe, tube } = pb;

  const customMatCache = new Map();
  const cMat = (key, map, hex = 0xffffff, extra = {}) => {
    if (!customMatCache.has(key)) {
      customMatCache.set(
        key,
        new THREE.MeshStandardMaterial(
          Object.assign({ color: hex, map, roughness: 0.88 }, extra, { metalness: 0 })
        )
      );
    }
    return customMatCache.get(key);
  };

  // Shared kit materials (strictly metalness: 0 everywhere for pure sunlit Storybook shading!)
  const mWoodWarm = mat('woodWarm', 0xdfac72, 'wood_light', 1.2, { roughness: 0.86, metalness: 0 });
  const mWoodHoney = mat('woodHoney', 0xc98d52, 'wood_light', 1.4, { roughness: 0.88, metalness: 0 });
  const mWoodDark = mat('woodDark', 0x8c5d38, 'wood_planks_dark', 1.2, { roughness: 0.9, metalness: 0 });
  const mRope = mat('rope', 0xe2be82, 'hay', 1.8, { roughness: 0.94, metalness: 0 });
  const mRopeDark = mat('ropeDark', 0xc4985a, 'burlap', 1.6, { roughness: 0.94, metalness: 0 });
  const mTerracotta = mat('terracotta', 0xfff0dc, 'terracotta', 1.1, { roughness: 0.86, metalness: 0 });
  const mCream = mat('cream', 0xfff3dc, 'plaster', 1.2, { roughness: 0.9, metalness: 0 });
  const mGullWhite = mat('gullWhite', 0xfaf8f2, null, 1, { roughness: 0.82, metalness: 0 });
  const mMintWood = mat('mintWood', 0xbfd8be, 'plaster', 1.2, { roughness: 0.88, metalness: 0 });
  const mBrass = mat('brass', 0xe5b44c, null, 1, { roughness: 0.44, metalness: 0 });
  const mIronDark = mat('ironDark', 0x565c64, 'painted_metal', 1.2, { roughness: 0.74, metalness: 0 });
  const mRubber = mat('rubber', 0x2e2c2a, null, 1, { roughness: 0.82, metalness: 0 });
  const mLeafBright = mat('leafBright', 0x6ba63e, 'leaves', 1.2, { roughness: 0.84, metalness: 0 });
  const mLeafDeep = mat('leafDeep', 0x487a2d, 'leaves', 1.2, { roughness: 0.86, metalness: 0 });
  const mLemon = mat('lemon', 0xf7cf2a, null, 1, { roughness: 0.54, metalness: 0 });
  const mPinkBloom = mat('pinkBloom', 0xe65884, null, 1, { roughness: 0.76, metalness: 0 });
  const mBottleGreen = mat('bottleGreen', 0x2e612c, null, 1, { roughness: 0.34, metalness: 0 });
  const mGlassCase = mat('glassCase', 0xe6f6ff, null, 1, {
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const mAquaGlass = mat('aquaGlass', 0x72f0df, null, 1, {
    emissive: 0x1ba89a,
    emissiveIntensity: 0.38,
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const mAquaCore = mat('aquaCore', 0x36cbb8, null, 1, {
    emissive: 0x1ca392,
    emissiveIntensity: 0.52,
    roughness: 0.32,
    metalness: 0,
  });

  // ==========================================================================
  // Hand-painted procedural Storybook textures matching props_sheet.png
  // ==========================================================================
  const tParasol = paintedCanvasTex(THREE, 'sp_parasol_stripe', 256, (g, s, rng) => {
    const cols = ['#eb8d88', '#fbf0dc', '#a9cfb4', '#fbf0dc'];
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect((i * s) / segs, 0, s / segs + 1, s);
    }
    brushStrokes(g, s, rng, 260, ['#fff8ea', '#e37b76', '#97bfa3'], 1.5, 4, 0.22, PI / 2, 0.35, 28);
    g.fillStyle = 'rgba(215,165,95,0.28)';
    g.fillRect(0, s - 14, s, 14);
  });
  const mParasol = cMat('sp_parasol', tParasol, 0xffffff, { roughness: 0.86, side: THREE.DoubleSide });

  const tAmphora = paintedCanvasTex(THREE, 'sp_amphora_olive', 256, (g, s, rng) => {
    g.fillStyle = '#cc6b3d';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 420, ['#d97b4a', '#b6582e', '#df905e'], 2, 6, 0.35, 0, 3.14, 30);
    // Cream slip band around upper-mid belly (v ~ 0.42..0.70 -> canvas y ~ 0.30..0.58)
    g.fillStyle = '#f5e6c8';
    g.fillRect(0, s * 0.30, s, s * 0.27);
    brushStrokes(g, s, rng, 120, ['#efe0be', '#fff4dc'], 2, 5, 0.4, 0, 0.5, 24);
    g.fillStyle = '#b64a28';
    g.fillRect(0, s * 0.30, s, 6);
    g.fillRect(0, s * 0.55, s, 7);
    g.fillStyle = '#e7b86a';
    g.fillRect(0, s * 0.58, s, 5);
    // Painted olive branch garland around the band
    for (let rep = 0; rep < 3; rep++) {
      const cx = (rep + 0.5) * (s / 3);
      const cy = s * 0.435;
      g.strokeStyle = '#5c6e38';
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(cx - 34, cy + 8);
      g.quadraticCurveTo(cx, cy - 10, cx + 34, cy + 5);
      g.stroke();
      const leaves = [[-22, -4, -0.5], [-6, -11, -0.2], [12, -9, 0.3], [26, -1, 0.5], [-12, 9, 0.4], [14, 8, -0.4]];
      g.fillStyle = '#6c873e';
      for (const [dx, dy, rot] of leaves) {
        g.save();
        g.translate(cx + dx, cy + dy);
        g.rotate(rot);
        g.beginPath();
        g.ellipse(0, 0, 10, 4.2, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      g.fillStyle = '#3b2e35';
      for (const [ox, oy] of [[-3, 3], [8, 1], [-18, 5]]) {
        g.beginPath();
        g.ellipse(cx + ox, cy + oy, 4.8, 6.2, 0.25, 0, TAU);
        g.fill();
      }
    }
  });
  const mAmphoraBelly = cMat('sp_amphora_belly', tAmphora, 0xffffff, { roughness: 0.85 });

  const tFloatRedWhite = paintedCanvasTex(THREE, 'sp_cork_float', 128, (g, s, rng) => {
    g.fillStyle = '#d94c3a';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#f5ead6';
    g.fillRect(0, s * 0.33, s, s * 0.34);
    brushStrokes(g, s, rng, 150, ['#c43d2c', '#f8efe0', '#b87c52'], 1.5, 4, 0.25, 0, 3.14, 18);
  });
  const mCorkFloat = cMat('sp_cork_float', tFloatRedWhite, 0xffffff, { roughness: 0.86 });

  const tRustIron = paintedCanvasTex(THREE, 'sp_rust_iron', 256, (g, s, rng) => {
    g.fillStyle = '#4c4744';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 500, ['#5c5550', '#3d3937', '#9e5c34', '#b86f3c', '#754c36'], 2, 8, 0.42, 0, 3.14, 26);
  });
  const mRustIron = cMat('sp_rust_iron', tRustIron, 0xffffff, { roughness: 0.78, metalness: 0 });

  const tMajolica = paintedCanvasTex(THREE, 'sp_majolica_pot', 256, (g, s, rng) => {
    g.fillStyle = '#f7eedb';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 180, ['#fff8eb', '#efe2c6'], 2, 5, 0.35, 0, 3.14, 24);
    // Blue & ochre border bands near top lip (y=0..28) and foot (y=s-32..s)
    g.fillStyle = '#2455a4';
    g.fillRect(0, 10, s, 10);
    g.fillRect(0, s - 22, s, 10);
    g.fillStyle = '#e8ad2c';
    g.fillRect(0, 23, s, 6);
    g.fillRect(0, s - 31, s, 6);
    // Rich scrolling cobalt acanthus & painted lemons across full belly (y = 0.24..0.78)
    for (let rep = 0; rep < 3; rep++) {
      const cx = (rep + 0.5) * (s / 3);
      const cy = s * 0.44;
      g.strokeStyle = '#2455a4';
      g.lineWidth = 5.5;
      g.beginPath();
      g.arc(cx - 24, cy + 4, 24, 0.1, PI * 1.5);
      g.stroke();
      g.beginPath();
      g.arc(cx + 24, cy + 4, 24, -PI * 0.5, PI * 0.9);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy + 28, 16, PI * 1.1, PI * 1.9);
      g.stroke();
      // Leaves & lemons
      g.fillStyle = '#569434';
      for (const [dx, dy, a] of [[-16, -24, -0.5], [16, -24, 0.5], [0, -32, 0], [-22, 12, 0.5], [22, 12, -0.5]]) {
        g.save();
        g.translate(cx + dx, cy + dy);
        g.rotate(a);
        g.beginPath();
        g.ellipse(0, 0, 14, 6.5, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      g.fillStyle = '#f6cc24';
      g.beginPath();
      g.ellipse(cx - 9, cy - 6, 13, 17, 0.3, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(cx + 11, cy + 2, 12, 16, -0.35, 0, TAU);
      g.fill();
    }
  });
  const mMajolica = cMat('sp_majolica', tMajolica, 0xffffff, { roughness: 0.48, metalness: 0 });

  const tGingham = paintedCanvasTex(THREE, 'sp_gingham', 256, (g, s) => {
    g.fillStyle = '#faf1e2';
    g.fillRect(0, 0, s, s);
    const n = 10;
    const cell = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (x % 2 === 0 && y % 2 === 0) {
          g.fillStyle = '#cc3e36';
          g.fillRect(x * cell, y * cell, cell, cell);
        } else if (x % 2 === 0 || y % 2 === 0) {
          g.fillStyle = '#e5867d';
          g.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }, 2, 2);
  const mGingham = cMat('sp_gingham', tGingham, 0xffffff, { roughness: 0.92, side: THREE.DoubleSide });

  const tFuelDrum = paintedCanvasTex(THREE, 'sp_fuel_drum', 256, (g, s, rng) => {
    g.fillStyle = '#c83c2e';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#f4e6cc';
    g.fillRect(0, s * 0.33, s, s * 0.34);
    brushStrokes(g, s, rng, 340, ['#b23124', '#d94c3c', '#8e4830', '#ebd8b8'], 2, 5, 0.28, 0, 3.14, 22);
    // Subtle weathered rust scuffs along rolling ribs
    g.fillStyle = 'rgba(92,48,30,0.35)';
    g.fillRect(0, s * 0.32, s, 5);
    g.fillRect(0, s * 0.66, s, 5);
  });
  const mFuelDrum = cMat('sp_fuel_drum', tFuelDrum, 0xffffff, { roughness: 0.68, metalness: 0 });

  const tPiling = paintedCanvasTex(THREE, 'sp_pier_piling', 256, (g, s, rng) => {
    g.fillStyle = '#b59672';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 520, ['#9c7d5a', '#cbb08c', '#7d6245'], 2, 5, 0.42, PI / 2, 0.2, 42);
    // Damp olive-green mossy tidal base at bottom (y = 0.68..1.0)
    const grad = g.createLinearGradient(0, s * 0.62, 0, s);
    grad.addColorStop(0, 'rgba(92,118,52,0)');
    grad.addColorStop(0.45, 'rgba(86,116,46,0.78)');
    grad.addColorStop(1, 'rgba(58,86,34,0.96)');
    g.fillStyle = grad;
    g.fillRect(0, s * 0.62, s, s * 0.38);
    brushStrokes(g, s, rng, 180, ['#6a9438', '#4c7028', '#7fa644'], 2, 6, 0.3, PI / 2, 0.4, 20);
  });
  const mPiling = cMat('sp_piling', tPiling, 0xffffff, { roughness: 0.92 });

  const tLifebuoy = paintedCanvasTex(THREE, 'sp_lifebuoy', 256, (g, s, rng) => {
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      g.fillStyle = i % 2 === 0 ? '#f6ecda' : '#db4b38';
      g.fillRect((i * s) / segs, 0, s / segs + 1, s);
    }
    brushStrokes(g, s, rng, 180, ['#fff6e6', '#c63d2c'], 1.5, 4, 0.2, 0, 3.14, 20);
  });
  const mLifebuoy = cMat('sp_lifebuoy', tLifebuoy, 0xffffff, { roughness: 0.84 });

  const tSeaChest = paintedCanvasTex(THREE, 'sp_chest_compass', 256, (g, s, rng) => {
    g.fillStyle = '#3f9392';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 380, ['#4ea8a6', '#2f7a79', '#8b7355'], 2, 5, 0.35, 0, 0.15, 40);
    // Plank seams
    g.fillStyle = 'rgba(32,68,68,0.45)';
    for (const py of [0.33, 0.66]) g.fillRect(0, s * py, s, 3);
    // Scrolling cream waves left & right
    g.strokeStyle = '#f2e2c4';
    g.lineWidth = 6;
    g.lineCap = 'round';
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 0.5 + dir * 34, s * 0.76);
      g.bezierCurveTo(s * 0.5 + dir * 65, s * 0.62, s * 0.5 + dir * 78, s * 0.88, s * 0.5 + dir * 102, s * 0.72);
      g.stroke();
    }
    // Compass rose circle & 8 points
    const cx = s * 0.5;
    const cy = s * 0.55;
    g.strokeStyle = '#f4e5c8';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, 38, 0, TAU);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * PI) / 4;
      const R = i % 2 === 0 ? 54 : 34;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.beginPath();
      g.moveTo(0, -R);
      g.lineTo(9, 0);
      g.lineTo(0, 0);
      g.closePath();
      g.fillStyle = '#d4513a';
      g.fill();
      g.beginPath();
      g.moveTo(0, -R);
      g.lineTo(-9, 0);
      g.lineTo(0, 0);
      g.closePath();
      g.fillStyle = '#f7ebd2';
      g.fill();
      g.restore();
    }
  });
  const mChestFront = cMat('sp_chest_front', tSeaChest, 0xffffff, { roughness: 0.85 });

  const tTurqPlanks = paintedCanvasTex(THREE, 'sp_turq_planks', 256, (g, s, rng) => {
    g.fillStyle = '#3f9392';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 420, ['#4ea8a6', '#2f7a79', '#56b2af', '#947a5a'], 2, 5, 0.36, 0, 0.14, 44);
    g.fillStyle = 'rgba(28,64,64,0.42)';
    for (const py of [0.25, 0.50, 0.75]) g.fillRect(0, s * py, s, 3);
  });
  const mTurquoiseWood = cMat('sp_turq_wood', tTurqPlanks, 0xffffff, { roughness: 0.85 });

  const tPropBlade = paintedCanvasTex(THREE, 'sp_prop_blade', 256, (g, s, rng) => {
    // v=0 at hub, v=1 at tip (canvas y=0 is tip, y=s is hub)
    g.fillStyle = '#8e381c';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 420, ['#a64523', '#732912', '#b8562e'], 2, 5, 0.4, PI / 2, 0.14, 44);
    // Cream & crimson tip warning stripes near top of canvas (v near 1 = tip)
    g.fillStyle = '#f5e8ce';
    g.fillRect(0, 0, s, s * 0.14);
    g.fillStyle = '#c8372b';
    g.fillRect(0, s * 0.14, s, s * 0.08);
    g.fillStyle = '#f5e8ce';
    g.fillRect(0, s * 0.22, s, s * 0.05);
  });
  const mPropBlade = cMat('sp_prop_blade', tPropBlade, 0xffffff, { roughness: 0.38, metalness: 0 });

  // ==========================================================================
  // 1. sp_gelato_cart — Mint-cream pushcart w/ striped parasol, cones & brass lids
  // ==========================================================================
  function buildGelatoCart() {
    return buildMergedProto('sp_gelato_cart', (g) => {
      // Main mint-green cart box & corner trim (front/side oriented pleasantly)
      add(g, rbox(0.72, 0.36, 0.48, 0.03), mMintWood, 0, 0.43, 0);
      add(g, rbox(0.76, 0.045, 0.52, 0.018), mMintWood, 0, 0.25, 0);
      // Recessed cream side & end panels
      add(g, rbox(0.58, 0.24, 0.50, 0.015), mCream, 0, 0.43, 0);
      add(g, rbox(0.74, 0.24, 0.36, 0.015), mCream, 0, 0.43, 0);
      // Olive/lemon branch relief on front & back panels
      for (const sz of [-1, 1]) {
        const z = sz * 0.255;
        add(g, new THREE.SphereGeometry(0.028, 10, 8), mParasol, 0.01, 0.42, z, 0, 0, 0, 0.9, 1.15, 0.35);
        for (const [dx, dy, rz] of [[-0.05, 0.03, 0.5], [0.05, 0.04, -0.5], [-0.03, -0.04, -0.4], [0.06, -0.02, 0.4]]) {
          add(g, new THREE.SphereGeometry(0.034, 8, 6), mLeafBright, dx, 0.43 + dy, z, 0, 0, rz, 1.3, 0.48, 0.25);
        }
      }

      // Honey-wood counter top + push handle on +X end
      add(g, rbox(0.78, 0.05, 0.54, 0.02), mWoodWarm, 0, 0.63, 0);
      add(g, new THREE.CylinderGeometry(0.018, 0.018, 0.42, 10), mWoodWarm, 0.48, 0.62, 0, PI / 2, 0, 0);
      for (const sz of [-0.16, 0.16]) {
        add(g, rbox(0.12, 0.026, 0.028, 0.01), mBrass, 0.42, 0.62, sz);
      }

      // Two large spoked wooden wheels at +X side + small swivel wheel at -X front
      for (const sz of [-0.27, 0.27]) {
        add(g, new THREE.TorusGeometry(0.19, 0.026, 6, 18), mWoodWarm, 0.15, 0.215, sz);
        add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), mBrass, 0.15, 0.215, sz, PI / 2, 0, 0);
        for (let k = 0; k < 4; k++) {
          add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.36, 5), mWoodWarm, 0.15, 0.215, sz, 0, 0, (k * PI) / 4);
        }
      }
      // Front caster fork + wheel
      add(g, rbox(0.05, 0.12, 0.06, 0.012, 1), mBrass, -0.26, 0.16, 0);
      add(g, new THREE.CylinderGeometry(0.075, 0.075, 0.042, 12), mWoodWarm, -0.26, 0.075, 0, PI / 2, 0, 0);

      // Gelato scoops inside display case + two brass pozzetti domed lids
      add(g, new THREE.SphereGeometry(0.068, 10, 8), mPinkBloom, -0.19, 0.68, 0.04, 0, 0, 0, 1, 0.85, 1);
      add(g, new THREE.SphereGeometry(0.068, 10, 8), mCream, -0.06, 0.68, 0.04, 0, 0, 0, 1, 0.85, 1);
      add(g, new THREE.SphereGeometry(0.064, 10, 8), mMintWood, -0.13, 0.68, -0.07, 0, 0, 0, 1, 0.85, 1);
      // Curved display case frame + SINGLE transparent glass hood
      add(g, rbox(0.36, 0.03, 0.34, 0.01, 1), mBrass, -0.13, 0.66, -0.01);
      add(g, rbox(0.34, 0.19, 0.31, 0.07, 2), mGlassCase, -0.13, 0.75, -0.01);

      // Two gleaming brass pozzetti gelato lids on right half of counter
      for (const [lx, lz] of [[0.14, 0.08], [0.24, -0.07]]) {
        add(
          g,
          lathe([[0, 0], [0.072, 0], [0.068, 0.03], [0.052, 0.075], [0.016, 0.095], [0.022, 0.115], [0, 0.122]], 12),
          mBrass,
          lx,
          0.655,
          lz
        );
      }

      // Side cone rack on -X end holding two golden waffle cones
      add(g, rbox(0.09, 0.03, 0.22, 0.01, 1), mWoodWarm, -0.41, 0.56, 0.02);
      for (const cz of [-0.04, 0.08]) {
        add(g, new THREE.ConeGeometry(0.038, 0.15, 10), mWoodWarm, -0.41, 0.55, cz, PI, 0, 0.08);
        add(g, new THREE.SphereGeometry(0.038, 8, 6), mCream, -0.41, 0.635, cz);
      }

      // Four slender brass canopy support poles
      for (const sx of [-0.31, 0.31]) {
        for (const sz of [-0.20, 0.20]) {
          add(g, new THREE.CylinderGeometry(0.013, 0.013, 0.44, 7), mBrass, sx, 0.86, sz);
        }
      }

      // Cascading pink bougainvillea vine & green leaves on front-left post
      for (let i = 0; i < 7; i++) {
        const y = 0.68 + i * 0.056;
        const a = i * 0.9;
        add(g, new THREE.SphereGeometry(0.044, 7, 5), mLeafBright, -0.32 + Math.cos(a) * 0.035, y, 0.21 + Math.sin(a) * 0.035, 0.3, a, 0.4, 1.2, 0.55, 0.9);
        add(g, new THREE.SphereGeometry(0.038, 7, 5), mPinkBloom, -0.34 + Math.sin(a) * 0.04, y + 0.02, 0.22 + Math.cos(a) * 0.03, 0, 0, 0, 1.1, 0.85, 1.1);
      }

      // Striped parasol canopy + scalloped valance + top brass finial (h = 1.32m)
      const canopyGeo = new THREE.ConeGeometry(0.54, 0.22, 16, 1, true);
      add(g, canopyGeo, mParasol, 0, 1.16, 0, 0, 0, 0, 1.04, 1, 0.82);
      // Scalloped fringe tabs around canopy eaves
      const tabs = 12;
      for (let i = 0; i < tabs; i++) {
        const a = (i / tabs) * TAU;
        const rx = Math.cos(a) * 0.535;
        const rz = Math.sin(a) * 0.422;
        add(g, rbox(0.145, 0.075, 0.018, 0.016, 1), mParasol, rx, 1.03, rz, 0, -a + PI / 2, 0);
      }
      add(g, lathe([[0, 0], [0.034, 0.01], [0.022, 0.04], [0.028, 0.065], [0, 0.085]], 12), mBrass, 0, 1.24, 0);
    });
  }

  // ==========================================================================
  // 2. sp_olive_amphora — Hand-painted olive amphora jar in knotted hemp sling
  // ==========================================================================
  function buildOliveAmphora() {
    return buildMergedProto('sp_olive_amphora', (g) => {
      // Classic Mediterranean amphora profile (height 0.94m + cork to 1.02m)
      const profile = [
        [0, 0],
        [0.125, 0.005],
        [0.145, 0.04],
        [0.22, 0.16],
        [0.305, 0.32],
        [0.335, 0.48],
        [0.31, 0.62],
        [0.22, 0.74],
        [0.125, 0.82],
        [0.118, 0.88],
        [0.158, 0.92],
        [0.148, 0.945],
        [0.095, 0.94],
      ];
      add(g, lathe(profile, 24), mAmphoraBelly, 0, 0, 0);

      // Chunky cork stopper on top (reaches y = 1.02m)
      add(
        g,
        lathe([[0, 0], [0.095, 0], [0.108, 0.075], [0.098, 0.09], [0, 0.092]], 16),
        mRopeDark,
        0,
        0.928,
        0
      );

      // Two curved terracotta loop handles on +/-X
      for (const sx of [-1, 1]) {
        const hPts = [
          [sx * 0.23, 0.71, 0],
          [sx * 0.33, 0.77, 0],
          [sx * 0.31, 0.86, 0],
          [sx * 0.14, 0.87, 0],
        ];
        add(g, tube(hPts, 0.032, 14, 8), mTerracotta);
      }

      // Knotted hemp rope sling: 3 horizontal rings + 6 vertical curved ribs + knots
      const ringLevels = [
        [0.15, 0.225],
        [0.36, 0.328],
        [0.70, 0.262],
      ];
      for (const [ry, rr] of ringLevels) {
        add(g, new THREE.TorusGeometry(rr, 0.021, 7, 24), mRope, 0, ry, 0, PI / 2, 0, 0);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.26;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const ribPts = [
          [c * 0.13, 0.03, s * 0.13],
          [c * 0.23, 0.15, s * 0.23],
          [c * 0.338, 0.36, s * 0.338],
          [c * 0.348, 0.52, s * 0.348],
          [c * 0.266, 0.70, s * 0.266],
        ];
        add(g, tube(ribPts, 0.018, 16, 6), mRope);
        for (const [ry, rr] of ringLevels) {
          add(g, new THREE.SphereGeometry(0.031, 8, 6), mRope, c * (rr + 0.008), ry, s * (rr + 0.008));
        }
      }
    });
  }

  // ==========================================================================
  // 3. sp_lobster_trap — Curved slatted wooden Adriatic lobster pot w/ floats
  // ==========================================================================
  function buildLobsterTrap() {
    return buildMergedProto('sp_lobster_trap', (g) => {
      const W = 0.74;
      const D = 0.56;
      const R = D * 0.5;
      const archRise = 0.48; // base skids + arch reaches ~0.60m

      // Bottom cross-battens & longitudinal skids
      for (let i = 0; i < 5; i++) {
        const x = -0.31 + i * 0.155;
        add(g, rbox(0.088, 0.045, D + 0.05, 0.012, 1), mWoodDark, x, 0.024, 0);
      }
      for (const sz of [-1, 1]) {
        add(g, rbox(W, 0.04, 0.06, 0.01, 1), mWoodWarm, 0, 0.055, sz * (R - 0.02));
      }

      // Three arched wooden U-ribs
      for (const rx of [-0.32, 0, 0.32]) {
        const ribPts = [];
        for (let k = 0; k <= 10; k++) {
          const t = (k / 10) * PI;
          ribPts.push([rx, 0.06 + Math.sin(t) * archRise, -Math.cos(t) * R]);
        }
        add(g, tube(ribPts, 0.024, 16, 6), mWoodDark);
      }

      // Eleven chunky longitudinal wooden slats curving smoothly up and over the arch
      for (let s = 0; s < 11; s++) {
        const t = (s / 10) * PI;
        const y = 0.075 + Math.sin(t) * (archRise + 0.016);
        const z = -Math.cos(t) * (R + 0.018);
        add(g, rbox(W + 0.03, 0.020, 0.056, 0.006, 1), mWoodWarm, 0, y, z, PI / 2 - t, 0, 0);
      }

      // Criss-cross hemp rope netting across both arched ends + funnel ring
      for (const sx of [-1, 1]) {
        const ex = sx * 0.325;
        add(g, new THREE.TorusGeometry(0.078, 0.012, 6, 14), mRope, ex - sx * 0.04, 0.28, 0, 0, PI / 2, 0);
        for (let k = -3; k <= 3; k++) {
          const z0 = k * 0.068;
          const hMax = Math.sqrt(Math.max(0.02, 1 - (z0 / R) ** 2)) * 0.44;
          add(g, new THREE.CylinderGeometry(0.007, 0.007, hMax, 5), mRope, ex, 0.07 + hMax * 0.5, z0, 0.22, 0, 0);
        }
        for (let h = 0; h < 4; h++) {
          const yy = 0.14 + h * 0.105;
          const span = Math.sqrt(Math.max(0.04, 1 - ((yy - 0.07) / 0.49) ** 2)) * D * 0.92;
          add(g, new THREE.CylinderGeometry(0.007, 0.007, span, 5), mRope, ex, yy, 0, PI / 2, 0, 0);
        }
      }

      // Coiled hauling rope + two plump red-and-white striped cork floats in front
      add(g, new THREE.TorusGeometry(0.11, 0.022, 6, 18), mRope, 0.16, 0.035, 0.32, PI / 2, 0.15, 0);
      add(g, new THREE.TorusGeometry(0.085, 0.02, 6, 16), mRope, 0.14, 0.065, 0.30, PI / 2 - 0.2, 0, 0);
      add(
        g,
        tube(
          [
            [0.32, 0.26, 0.22],
            [0.26, 0.12, 0.31],
            [0.18, 0.04, 0.35],
            [0.34, 0.06, 0.35],
          ],
          0.018,
          14,
          6
        ),
        mRope
      );
      for (const [fx, fz, ry] of [[0.29, 0.36, 0.45], [0.40, 0.27, -0.25]]) {
        add(g, new THREE.CapsuleGeometry(0.055, 0.08, 6, 12), mCorkFloat, fx, 0.06, fz, PI / 2, 0, ry);
      }
    });
  }

  // ==========================================================================
  // 4. sp_anchor_bollard — Cast-iron mooring bollard w/ hemp rope & iron anchor
  // ==========================================================================
  function buildAnchorBollard() {
    return buildMergedProto('sp_anchor_bollard', (g) => {
      // Heavy bevelled square base plate + 4 corner bolts
      add(g, rbox(0.52, 0.10, 0.52, 0.025), mRustIron, -0.03, 0.05, 0);
      for (const bx of [-0.19, 0.19]) {
        for (const bz of [-0.19, 0.19]) {
          add(g, new THREE.CylinderGeometry(0.026, 0.03, 0.035, 6), mIronDark, -0.03 + bx, 0.11, bz);
        }
      }

      // Waisted cast-iron bollard column + broad mushroom cap (reaches y = 0.84m)
      const bollardProfile = [
        [0, 0.09],
        [0.21, 0.09],
        [0.185, 0.16],
        [0.155, 0.34],
        [0.162, 0.54],
        [0.245, 0.64],
        [0.268, 0.72],
        [0.242, 0.79],
        [0.15, 0.83],
        [0, 0.84],
      ];
      add(g, lathe(bollardProfile, 22), mRustIron, -0.03, 0, 0);

      // Thick braided hemp rope wrapped 4 coils around waist + trailing tail on dock
      for (let i = 0; i < 4; i++) {
        const y = 0.23 + i * 0.072;
        const tilt = (i % 2 === 0 ? 1 : -1) * 0.09;
        add(g, new THREE.TorusGeometry(0.192, 0.038, 8, 22), mRope, -0.03, y, 0, PI / 2 + tilt, 0, 0.06 * i);
      }
      add(
        g,
        tube(
          [
            [-0.18, 0.24, 0.12],
            [-0.27, 0.14, 0.20],
            [-0.34, 0.045, 0.25],
            [-0.24, 0.035, 0.32],
          ],
          0.036,
          14,
          7
        ),
        mRope
      );

      // Leaning forged-iron harbor anchor on the right (+X)
      const ax = 0.23;
      const az = 0.12;
      const tiltZ = 0.26;
      // Anchor shank
      add(g, new THREE.CylinderGeometry(0.022, 0.026, 0.46, 10), mIronDark, ax, 0.31, az, -0.18, 0, tiltZ);
      // Top shackle ring
      add(g, new THREE.TorusGeometry(0.048, 0.014, 7, 16), mIronDark, ax - 0.06, 0.55, az - 0.04, 0, 0.3, tiltZ);
      // Cross stock bar + ball ends
      add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.24, 8), mIronDark, ax - 0.04, 0.46, az - 0.03, 0, 0.2, PI / 2 + tiltZ);
      for (const s of [-1, 1]) {
        add(g, new THREE.SphereGeometry(0.025, 8, 6), mIronDark, ax - 0.04 + s * 0.11, 0.46 + s * 0.03, az - 0.03);
      }
      // Curved twin anchor arms + fluke arrowheads
      add(
        g,
        tube(
          [
            [ax - 0.10, 0.18, az + 0.08],
            [ax + 0.05, 0.06, az + 0.04],
            [ax + 0.19, 0.19, az - 0.02],
          ],
          0.022,
          12,
          6
        ),
        mIronDark
      );
      add(g, new THREE.ConeGeometry(0.048, 0.095, 4), mIronDark, ax - 0.10, 0.21, az + 0.08, 0.2, 0, 0.55);
      add(g, new THREE.ConeGeometry(0.048, 0.095, 4), mIronDark, ax + 0.19, 0.22, az - 0.02, -0.2, 0, -0.45);
    });
  }

  // ==========================================================================
  // 5. sp_lemon_planter — Blue-and-yellow majolica pot w/ fruiting lemon tree
  // ==========================================================================
  function buildLemonPlanter() {
    return buildMergedProto('sp_lemon_planter', (g, rng) => {
      // Terracotta foot ring & rolled top lip
      add(g, new THREE.TorusGeometry(0.165, 0.028, 8, 22), mTerracotta, 0, 0.028, 0, PI / 2, 0, 0);
      add(g, new THREE.TorusGeometry(0.245, 0.032, 9, 24), mTerracotta, 0, 0.435, 0, PI / 2, 0, 0);

      // Plump glazed majolica pot belly
      const potPts = [
        [0, 0.03],
        [0.165, 0.04],
        [0.245, 0.14],
        [0.282, 0.26],
        [0.265, 0.37],
        [0.238, 0.43],
      ];
      add(g, lathe(potPts, 24), mMajolica, 0, 0, 0);

      // Dark soil disc + gnarled woody trunk & branches
      add(g, new THREE.CylinderGeometry(0.225, 0.22, 0.04, 18), mWoodDark, 0, 0.42, 0);
      add(g, tube([[0, 0.42, 0], [0.02, 0.56, 0.01], [-0.01, 0.72, 0]], 0.038, 10, 7), mWoodDark);
      for (const [bx, by, bz] of [[-0.17, 0.78, 0.08], [0.18, 0.79, 0.06], [0.03, 0.82, -0.16], [-0.12, 0.77, -0.12]]) {
        add(g, tube([[0, 0.60, 0], [bx * 0.55, 0.70, bz * 0.55], [bx, by, bz]], 0.02, 8, 6), mWoodDark);
      }

      // Lush Mediterranean leaf canopy (reaches y = 1.08m, r ~ 0.44m)
      const puffs = [
        [0, 0.90, 0, 0.22, mLeafBright],
        [-0.19, 0.82, 0.11, 0.17, mLeafDeep],
        [0.20, 0.83, 0.09, 0.17, mLeafBright],
        [0.02, 0.84, -0.18, 0.17, mLeafDeep],
        [-0.14, 0.82, -0.14, 0.16, mLeafBright],
        [0.13, 0.80, -0.13, 0.15, mLeafDeep],
        [0, 0.76, 0.18, 0.16, mLeafBright],
      ];
      for (const [px, py, pz, pr, pm] of puffs) {
        add(g, new THREE.SphereGeometry(pr, 12, 10), pm, px, py, pz, 0, 0, 0, 1.08, 0.86, 1.08);
      }
      // Pointed outer citrus leaves for crisp Storybook silhouette
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        const el = rng.jr(-0.25, 0.65);
        const rad = rng.jr(0.24, 0.36);
        const lx = Math.cos(a) * Math.cos(el) * rad;
        const lz = Math.sin(a) * Math.cos(el) * rad;
        const ly = 0.82 + Math.sin(el) * 0.20;
        add(
          g,
          new THREE.SphereGeometry(0.072, 8, 6),
          i % 2 === 0 ? mLeafBright : mLeafDeep,
          lx,
          ly,
          lz,
          rng.jr(-0.4, 0.4),
          -a,
          rng.jr(-0.5, 0.5),
          1.35,
          0.36,
          0.72
        );
      }

      // Plump bright yellow Amalfi lemons hanging prominently around the outer crown
      const lemons = [
        [-0.29, 0.73, 0.19],
        [-0.07, 0.70, 0.33],
        [0.21, 0.74, 0.26],
        [0.34, 0.74, -0.02],
        [0.21, 0.82, -0.27],
        [-0.19, 0.76, -0.28],
        [-0.33, 0.78, -0.06],
        [0.10, 0.95, 0.24],
        [-0.16, 0.95, 0.16],
        [0.24, 0.90, 0.08],
      ];
      for (const [lx, ly, lz] of lemons) {
        add(g, new THREE.SphereGeometry(0.052, 10, 8), mLemon, lx, ly, lz, 0.18, 0, -0.14, 0.84, 1.24, 0.84);
      }
    });
  }

  // ==========================================================================
  // 6. sp_bistro_set — Round café table w/ checkered cloth, Chianti & chairs
  // ==========================================================================
  function buildBistroSet() {
    return buildMergedProto('sp_bistro_set', (g) => {
      // Wrought-iron central pedestal & 3 scrolled cabriole legs
      add(g, new THREE.CylinderGeometry(0.026, 0.032, 0.52, 10), mLeafDeep, 0, 0.28, 0);
      add(g, new THREE.TorusGeometry(0.09, 0.014, 6, 14), mLeafDeep, 0, 0.16, 0, PI / 2, 0, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.52;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const legPts = [
          [c * 0.02, 0.24, s * 0.02],
          [c * 0.14, 0.16, s * 0.14],
          [c * 0.22, 0.03, s * 0.22],
          [c * 0.25, 0.02, s * 0.25],
        ];
        add(g, tube(legPts, 0.016, 12, 6), mLeafDeep);
      }

      // Round tabletop + red-and-white checkered gingham tablecloth with draped folds
      add(g, new THREE.CylinderGeometry(0.31, 0.31, 0.03, 24), mGingham, 0, 0.57, 0);
      const skirtPts = [
        [0.305, 0.575],
        [0.325, 0.53],
        [0.348, 0.42],
      ];
      add(g, lathe(skirtPts, 24), mGingham, 0, 0, 0);
      // Four draped corner points around the cloth hem
      for (let i = 0; i < 4; i++) {
        const a = (i * PI) / 2 + PI / 4;
        add(
          g,
          new THREE.ConeGeometry(0.11, 0.16, 6),
          mGingham,
          Math.cos(a) * 0.29,
          0.41,
          Math.sin(a) * 0.29,
          PI,
          a,
          Math.cos(a) * -0.18,
          1,
          1,
          0.38
        );
      }

      // Two rustic ladder-back wooden trattoria chairs tucked on left & right
      for (const sx of [-1, 1]) {
        const cx = sx * 0.38;
        const ry = -sx * PI * 0.5 + sx * 0.12;
        const cg = new THREE.Group();
        // Chair legs (front & tall curved back posts)
        for (const lx of [-0.12, 0.12]) {
          add(cg, new THREE.CylinderGeometry(0.016, 0.014, 0.36, 7), mWoodHoney, lx, 0.18, 0.11);
          add(cg, new THREE.CylinderGeometry(0.017, 0.015, 0.72, 7), mWoodHoney, lx, 0.36, -0.12, -0.06, 0, 0);
        }
        // Stretchers + woven rush seat
        add(cg, rbox(0.27, 0.032, 0.26, 0.01), mWoodHoney, 0, 0.35, 0);
        add(cg, rbox(0.24, 0.036, 0.23, 0.014), mRope, 0, 0.37, 0);
        for (const sy of [0.13, 0.23]) {
          add(cg, new THREE.CylinderGeometry(0.01, 0.01, 0.24, 6), mWoodHoney, 0, sy, 0.11, 0, 0, PI / 2);
          add(cg, new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6), mWoodHoney, -0.12, sy, 0, PI / 2, 0, 0);
          add(cg, new THREE.CylinderGeometry(0.01, 0.01, 0.22, 6), mWoodHoney, 0.12, sy, 0, PI / 2, 0, 0);
        }
        // Curved ladder-back slats
        for (const by of [0.50, 0.60, 0.70]) {
          add(cg, rbox(0.25, 0.042, 0.018, 0.008), mWoodHoney, 0, by, -0.135);
        }
        cg.position.set(cx, 0, 0.02);
        cg.rotation.y = ry;
        while (cg.children.length) {
          const ch = cg.children[0];
          ch.applyMatrix4(
            new THREE.Matrix4().compose(
              cg.position,
              new THREE.Quaternion().setFromEuler(cg.rotation),
              cg.scale
            )
          );
          g.add(ch);
        }
      }

      // Tabletop: Straw-wrapped Chianti fiasco bottle + 2 ruby wine glasses + pink flower pitcher
      add(g, lathe([[0, 0], [0.052, 0], [0.064, 0.05], [0.056, 0.11], [0, 0.115]], 14), mRope, -0.05, 0.585, -0.02);
      add(g, lathe([[0.052, 0.10], [0.042, 0.15], [0.018, 0.20], [0.019, 0.24], [0, 0.242]], 14), mLeafDeep, -0.05, 0.585, -0.02);
      add(g, new THREE.CylinderGeometry(0.019, 0.019, 0.028, 10), mPinkBloom, -0.05, 0.835, -0.02);

      // Two small wine goblets
      for (const [gx, gz] of [[-0.14, 0.09], [0.08, 0.11]]) {
        add(g, lathe([[0, 0], [0.026, 0], [0.006, 0.01], [0.006, 0.045], [0.028, 0.06], [0.026, 0.095]], 12), mCream, gx, 0.585, gz);
        add(g, new THREE.CylinderGeometry(0.023, 0.018, 0.026, 10), mPinkBloom, gx, 0.655, gz);
      }

      // Cream ceramic flower jug + bouquet of pink flowers (reaches y = 0.86m)
      add(g, lathe([[0, 0], [0.042, 0], [0.056, 0.05], [0.042, 0.10], [0.048, 0.125]], 14), mCream, 0.09, 0.585, -0.05);
      add(g, new THREE.TorusGeometry(0.028, 0.008, 6, 12, PI), mCream, 0.135, 0.65, -0.05, 0, 0, -PI / 2);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const r = i === 0 ? 0 : 0.048;
        const fy = i === 0 ? 0.83 : 0.78 + (i % 2) * 0.03;
        add(g, new THREE.SphereGeometry(0.028, 8, 6), mLeafDeep, 0.09 + Math.cos(a) * r * 0.8, fy - 0.04, -0.05 + Math.sin(a) * r * 0.8, 0.3, a, 0, 1.2, 0.6, 0.8);
        add(g, new THREE.SphereGeometry(0.028, 8, 6), mPinkBloom, 0.09 + Math.cos(a) * r, fy, -0.05 + Math.sin(a) * r);
      }
    });
  }

  // ==========================================================================
  // 7. sp_fuel_drum — Red-and-cream fuel drum w/ brass hand pump & black hose
  // ==========================================================================
  function buildFuelDrum() {
    return buildMergedProto('sp_fuel_drum', (g) => {
      // Main 55-gallon drum cylinder + rolling ribs
      add(g, new THREE.CylinderGeometry(0.245, 0.245, 0.72, 24), mFuelDrum, 0, 0.365, 0);
      for (const ry of [0.02, 0.245, 0.485, 0.715]) {
        add(g, new THREE.TorusGeometry(0.248, 0.016, 7, 24), mFuelDrum, 0, ry, 0, PI / 2, 0, 0);
      }
      add(g, new THREE.CylinderGeometry(0.235, 0.235, 0.02, 20), mRustIron, 0, 0.722, 0);

      // Cast-brass rotary hand pump mounted on top bung (reaches y = 1.06m)
      add(g, new THREE.CylinderGeometry(0.058, 0.068, 0.05, 14), mBrass, 0.03, 0.75, 0);
      add(g, new THREE.CylinderGeometry(0.038, 0.044, 0.22, 14), mBrass, 0.03, 0.87, 0);
      add(g, new THREE.SphereGeometry(0.048, 12, 10), mBrass, 0.03, 0.98, 0);
      add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.08, 10), mBrass, 0.03, 1.02, 0);
      // Curved brass gooseneck spout on -X
      add(
        g,
        tube(
          [
            [0.01, 0.96, 0],
            [-0.10, 0.99, 0],
            [-0.17, 0.96, 0],
            [-0.20, 0.90, 0],
          ],
          0.02,
          12,
          8
        ),
        mBrass
      );
      // Brass crank arm + wooden handle on +X
      add(g, rbox(0.11, 0.022, 0.024, 0.008), mBrass, 0.09, 0.88, 0.02, 0, 0, -0.25);
      add(g, new THREE.CylinderGeometry(0.018, 0.022, 0.11, 10), mWoodDark, 0.18, 0.855, 0.02, 0, 0, PI / 2);

      // Side brass valve bracket + looped black rubber fuel hose + brass nozzle
      add(g, rbox(0.06, 0.08, 0.07, 0.015), mBrass, 0.15, 0.65, 0.16, 0, 0.6, 0);
      const hosePts = [
        [0.17, 0.66, 0.18],
        [0.25, 0.56, 0.20],
        [0.29, 0.34, 0.18],
        [0.28, 0.11, 0.13],
        [0.22, 0.08, 0.06],
        [0.19, 0.26, 0.17],
        [0.18, 0.54, 0.19],
      ];
      add(g, tube(hosePts, 0.022, 22, 8), mRubber);
      add(g, new THREE.CylinderGeometry(0.024, 0.018, 0.14, 10), mBrass, 0.18, 0.58, 0.19, 0.15, 0, -0.1);
    });
  }

  // ==========================================================================
  // 8. sp_pelican_post — Trio of mossy pier pilings w/ lifebuoy & seagull
  // ==========================================================================
  function buildPelicanPost() {
    return buildMergedProto('sp_pelican_post', (g) => {
      // Three stepped mossy timber pier pilings
      const posts = [
        [0.09, 0.88, -0.02, 0.125],  // tallest right-back piling
        [-0.10, 0.70, -0.04, 0.118], // medium left piling
        [-0.20, 0.44, 0.10, 0.092],  // short front-left piling
      ];
      for (const [px, ph, pz, pr] of posts) {
        add(g, new THREE.CylinderGeometry(pr * 0.95, pr * 1.04, ph, 16), mPiling, px, ph * 0.5, pz);
        add(g, new THREE.CylinderGeometry(pr * 0.82, pr * 0.95, 0.03, 16), mPiling, px, ph + 0.012, pz);
      }

      // Wrapped hemp rope around top of pilings + hanging rope loop
      for (let i = 0; i < 3; i++) {
        add(g, new THREE.TorusGeometry(0.128, 0.021, 7, 18), mRope, 0.09, 0.67 + i * 0.04, -0.02, PI / 2 + 0.08, 0, 0.1);
        add(g, new THREE.TorusGeometry(0.122, 0.02, 7, 18), mRope, -0.10, 0.54 + i * 0.038, -0.04, PI / 2 - 0.1, 0, -0.1);
      }
      add(g, tube([[0.09, 0.72, 0.11], [0.06, 0.66, 0.17], [0.06, 0.58, 0.18]], 0.018, 8, 6), mRope);

      // Red-and-white lifebuoy ring hung on the front of the tall piling
      const bx = 0.06;
      const by = 0.43;
      const bz = 0.175;
      add(g, new THREE.TorusGeometry(0.185, 0.058, 12, 24), mLifebuoy, bx, by, bz, -0.08, 0.12, 0);
      add(g, new THREE.TorusGeometry(0.246, 0.012, 6, 24), mRope, bx, by, bz, -0.08, 0.12, 0);

      // Plump crisp-white Storybook Adriatic seagull perched atop tallest piling (reaches y = 1.16m)
      const gx = 0.09;
      const gy = 0.90;
      const gz = -0.02;
      // Legs & orange webbed feet
      for (const sx of [-0.026, 0.026]) {
        add(g, new THREE.CylinderGeometry(0.007, 0.007, 0.068, 6), mLemon, gx + sx, gy + 0.032, gz + 0.01);
        add(g, rbox(0.028, 0.01, 0.045, 0.004, 1), mLemon, gx + sx, gy + 0.004, gz + 0.026);
      }
      // Plump sea-bird white body, breast & head
      add(g, new THREE.SphereGeometry(0.096, 14, 12), mGullWhite, gx, gy + 0.115, gz, -0.18, -0.32, 0, 0.86, 0.90, 1.38);
      add(g, new THREE.SphereGeometry(0.060, 12, 10), mGullWhite, gx - 0.03, gy + 0.215, gz + 0.062);
      // Slate-grey folded wings + dark tail tips
      for (const sx of [-1, 1]) {
        add(
          g,
          new THREE.SphereGeometry(0.084, 10, 8),
          mIronDark,
          gx + sx * 0.064 - 0.01 * sx,
          gy + 0.125,
          gz - 0.02,
          -0.25,
          -0.32 + sx * 0.12,
          sx * 0.22,
          0.36,
          0.74,
          1.45
        );
      }
      add(g, new THREE.ConeGeometry(0.042, 0.12, 6), mRubber, gx + 0.038, gy + 0.095, gz - 0.14, -PI / 2 - 0.22, 0, -0.32, 1, 1, 0.35);
      // Bright yellow-orange beak + dark bead eyes
      add(g, new THREE.ConeGeometry(0.018, 0.075, 8), mLemon, gx - 0.06, gy + 0.21, gz + 0.125, PI / 2 + 0.12, 0, 0.35);
      for (const sx of [-1, 1]) {
        add(g, new THREE.SphereGeometry(0.010, 6, 6), mRubber, gx - 0.03 + sx * 0.044, gy + 0.225, gz + 0.082);
      }
    });
  }

  // ==========================================================================
  // 9. sp_wine_rack — Two-shelf oak rack w/ straw Chianti bottles & demijohn
  // ==========================================================================
  function buildWineRack() {
    return buildMergedProto('sp_wine_rack', (g) => {
      const W = 0.72;
      const D = 0.34;
      // Slightly tapered side A-frame uprights & base runners
      for (const sx of [-1, 1]) {
        const x = sx * (W * 0.5 - 0.025);
        add(g, rbox(0.05, 0.06, D + 0.06, 0.012), mWoodDark, x, 0.03, 0);
        add(g, rbox(0.048, 0.86, 0.055, 0.012), mWoodHoney, x, 0.46, 0.13, -0.05, 0, 0);
        add(g, rbox(0.048, 0.86, 0.055, 0.012), mWoodHoney, x, 0.46, -0.13, 0.05, 0, 0);
        add(g, rbox(0.052, 0.045, D, 0.01), mWoodDark, x, 0.87, 0);
      }

      // Two sturdy oak shelves + front & back keeper rails + wavy top crest board (reaches y = 0.96m)
      add(g, rbox(W, 0.035, D, 0.01), mWoodWarm, 0, 0.11, 0);
      add(g, rbox(W - 0.02, 0.035, D - 0.03, 0.01), mWoodWarm, 0, 0.50, 0);
      add(g, rbox(W + 0.03, 0.038, 0.032, 0.008), mWoodDark, 0, 0.22, 0.145);
      add(g, rbox(W + 0.01, 0.038, 0.032, 0.008), mWoodDark, 0, 0.61, 0.13);
      add(g, rbox(W + 0.04, 0.05, 0.04, 0.012), mWoodHoney, 0, 0.88, -0.11);
      add(g, new THREE.SphereGeometry(0.18, 14, 8), mWoodHoney, 0, 0.91, -0.11, 0, 0, 0, 1.85, 0.28, 0.18);

      // Helper for straw-sleeved green Chianti bottle
      const addChianti = (bx, by, bz) => {
        add(g, lathe([[0, 0], [0.054, 0], [0.062, 0.05], [0.058, 0.13], [0, 0.135]], 14), mRope, bx, by, bz);
        add(g, new THREE.TorusGeometry(0.058, 0.009, 5, 14), mRopeDark, bx, by + 0.065, bz, PI / 2, 0, 0);
        add(g, lathe([[0.052, 0.12], [0.048, 0.17], [0.019, 0.22], [0.019, 0.28], [0, 0.282]], 14), mBottleGreen, bx, by, bz);
        add(g, new THREE.CylinderGeometry(0.017, 0.015, 0.032, 8), mRopeDark, bx, by + 0.292, bz);
      };

      // Top shelf: 4 Chianti bottles
      for (let i = 0; i < 4; i++) {
        addChianti(-0.225 + i * 0.15, 0.518, -0.01);
      }
      // Bottom shelf: 3 Chianti bottles on left + plump wicker demijohn on right
      for (let i = 0; i < 3; i++) {
        addChianti(-0.24 + i * 0.135, 0.128, 0.01);
      }
      // Wicker demijohn (damigiana) on bottom right
      const dx = 0.19;
      const dy = 0.128;
      add(
        g,
        lathe([[0, 0], [0.088, 0.01], [0.118, 0.09], [0.112, 0.18], [0.065, 0.24], [0.036, 0.27], [0.04, 0.30]], 18),
        mRope,
        dx,
        dy,
        0.01
      );
      for (const ry of [0.06, 0.12, 0.18]) {
        add(g, new THREE.TorusGeometry(0.114, 0.01, 5, 16), mRopeDark, dx, dy + ry, 0.01, PI / 2, 0, 0);
      }
      add(g, new THREE.TorusGeometry(0.038, 0.011, 6, 12, PI * 1.15), mRopeDark, dx + 0.058, dy + 0.25, 0.01, 0, 0, -0.9);
      add(g, new THREE.CylinderGeometry(0.024, 0.021, 0.035, 10), mRopeDark, dx, dy + 0.315, 0.01);
    });
  }

  // ==========================================================================
  // 10. sp_sea_chest — Turquoise wooden sailor chest w/ brass corners & compass
  // ==========================================================================
  function buildSeaChest() {
    return buildMergedProto('sp_sea_chest', (g) => {
      const W = 0.78;
      const H = 0.48;
      const D = 0.48;

      // Four sturdy corner block feet
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          add(g, rbox(0.14, 0.065, 0.14, 0.014), mTurquoiseWood, sx * 0.31, 0.032, sz * 0.165);
        }
      }

      // Main turquoise wooden chest box + painted front & back compass rose panels
      add(g, rbox(W, H, D, 0.022), mTurquoiseWood, 0, 0.065 + H * 0.5, 0);
      add(g, new THREE.BoxGeometry(W - 0.12, H - 0.09, D + 0.012), mChestFront, 0, 0.065 + H * 0.5, 0);

      // Slightly arched cambered lid (reaches y = 0.70m)
      add(g, rbox(W + 0.03, 0.11, D + 0.03, 0.026), mTurquoiseWood, 0, 0.585, 0);
      add(g, new THREE.CylinderGeometry(D * 0.51, D * 0.51, W + 0.02, 16, 1, false, 0, PI), mTurquoiseWood, 0, 0.61, 0, 0, 0, PI / 2, 0.26, 1, 1);

      // Brass lid reinforcement straps, 8 heavy corner brackets, front padlock & side handles
      for (const sx of [-0.21, 0.21]) {
        add(g, rbox(0.048, 0.145, D + 0.048, 0.01), mBrass, sx, 0.605, 0);
      }
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          for (const cy of [0.11, 0.49, 0.61]) {
            add(g, rbox(0.095, 0.085, 0.095, 0.014), mBrass, sx * (W * 0.5 - 0.025), cy, sz * (D * 0.5 - 0.025));
          }
        }
        // Side brass bail carry handles on +/-X
        const hx = sx * (W * 0.5 + 0.015);
        add(g, rbox(0.025, 0.075, 0.14, 0.008), mBrass, hx, 0.36, 0);
        add(g, new THREE.TorusGeometry(0.052, 0.013, 6, 14, PI * 1.15), mBrass, hx + sx * 0.012, 0.34, 0, 0, PI / 2, PI);
      }

      // Chunky center brass clasp & padlock + dark keyhole
      add(g, rbox(0.095, 0.13, 0.035, 0.012), mBrass, 0, 0.54, D * 0.5 + 0.015);
      add(g, rbox(0.076, 0.09, 0.038, 0.016), mBrass, 0, 0.47, D * 0.5 + 0.028);
      add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.042, 8), mRubber, 0, 0.475, D * 0.5 + 0.03, PI / 2, 0, 0);
    });
  }

  // ==========================================================================
  // 11. sp_buoy_float — Wooden A-frame rack w/ 3 glowing turquoise glass floats
  // ==========================================================================
  function buildBuoyFloat() {
    return buildMergedProto('sp_buoy_float', (g) => {
      // Wooden A-frame trestles on left & right + top round crossbar + slatted lower tray
      for (const sx of [-1, 1]) {
        const x = sx * 0.30;
        add(g, rbox(0.052, 0.90, 0.052, 0.012), mWoodHoney, x, 0.44, 0.13, -0.24, 0, 0);
        add(g, rbox(0.052, 0.90, 0.052, 0.012), mWoodHoney, x, 0.44, -0.13, 0.24, 0, 0);
        add(g, rbox(0.048, 0.042, 0.42, 0.01), mWoodDark, x, 0.16, 0);
        // Rope lashing at lower joints
        for (const sz of [-0.18, 0.18]) {
          add(g, new THREE.TorusGeometry(0.04, 0.011, 5, 12), mRope, x, 0.165, sz, 0, PI / 2, 0);
        }
      }
      // Top crossbar + slatted cradle planks
      add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.78, 12), mWoodWarm, 0, 0.85, 0, 0, 0, PI / 2);
      for (const sz of [-0.11, 0, 0.11]) {
        add(g, rbox(0.64, 0.026, 0.068, 0.008), mWoodWarm, 0, 0.18, sz);
      }

      // Three suspended seafoam-turquoise glass fishing floats in knotted hemp nets
      const floats = [
        [-0.145, 0.33, 0.02, 0.135],
        [0.145, 0.33, -0.01, 0.135],
        [0, 0.56, 0.01, 0.14],
      ];
      const outerShells = [];
      for (const [fx, fy, fz, fr] of floats) {
        // Luminous inner seafoam core
        add(g, new THREE.SphereGeometry(fr * 0.76, 14, 12), mAquaCore, fx, fy, fz);
        // Outer translucent glass sphere (collected to merge into 1 single draw call!)
        const sg = new THREE.SphereGeometry(fr, 16, 14);
        sg.translate(fx, fy, fz);
        outerShells.push(sg);

        // Diamond hemp rope net around each float (meridian & latitude rings)
        for (let m = 0; m < 3; m++) {
          add(g, new THREE.TorusGeometry(fr + 0.008, 0.011, 6, 20), mRope, fx, fy, fz, 0.25, (m * PI) / 3, 0.2);
        }
        for (const ly of [-0.065, 0.065]) {
          const lr = Math.sqrt(Math.max(0.01, fr * fr - ly * ly)) + 0.008;
          add(g, new THREE.TorusGeometry(lr, 0.011, 6, 18), mRope, fx, fy + ly, fz, PI / 2, 0, 0);
        }
      }
      // Single merged transparent glass mesh for all 3 floats!
      add(g, mergeGeometries(outerShells, false), mAquaGlass);

      // Suspension ropes & central top knot over the crossbar (reaches y = 0.94m)
      add(g, tube([[-0.145, 0.47, 0.02], [-0.15, 0.85, 0]], 0.014, 8, 6), mRope);
      add(g, tube([[0.145, 0.47, -0.01], [0.04, 0.85, 0]], 0.014, 8, 6), mRope);
      add(g, tube([[0, 0.70, 0.01], [0, 0.88, 0]], 0.016, 8, 6), mRope);
      add(g, new THREE.TorusGeometry(0.045, 0.018, 7, 14), mRope, 0, 0.88, 0, 0.2, PI / 2, 0);
      add(g, new THREE.TorusGeometry(0.042, 0.016, 7, 14), mRope, -0.15, 0.86, 0, 0, PI / 2, 0);
    });
  }

  // ==========================================================================
  // 12. sp_propeller_stand — Glossy mahogany twin-blade propeller on trestle
  // ==========================================================================
  function buildPropellerStand() {
    return buildMergedProto('sp_propeller_stand', (g) => {
      // Carpenter's wooden A-frame display trestle
      for (const sx of [-1, 1]) {
        const x = sx * 0.22;
        add(g, rbox(0.065, 0.055, 0.44, 0.012), mWoodDark, x, 0.028, 0);
        add(g, rbox(0.048, 0.54, 0.05, 0.01), mWoodHoney, x, 0.29, 0.11, -0.22, 0, 0);
        add(g, rbox(0.048, 0.54, 0.05, 0.01), mWoodHoney, x, 0.29, -0.11, 0.22, 0, 0);
        add(g, rbox(0.045, 0.04, 0.26, 0.008), mWoodWarm, x, 0.24, 0);
        // Saddle block at top of each A-frame
        add(g, rbox(0.07, 0.075, 0.13, 0.014), mWoodDark, x, 0.54, 0);
      }
      // Cross stretchers linking the two A-frames
      add(g, rbox(0.52, 0.045, 0.045, 0.01), mWoodWarm, 0, 0.14, 0);
      add(g, rbox(0.46, 0.04, 0.045, 0.01), mWoodWarm, 0, 0.36, 0.07);
      add(g, rbox(0.46, 0.04, 0.045, 0.01), mWoodWarm, 0, 0.36, -0.07);

      // Glossy laminated mahogany twin-blade seaplane propeller tilted dynamically
      // Span ~1.08m -> radius ~0.54m, upper blade tip reaches ~0.84m
      const propGroup = new THREE.Group();
      propGroup.position.set(0, 0.60, 0.01);
      propGroup.rotation.set(0.08, -0.18, 0.24);

      // Broad Storybook paddle-airfoil blade profile w/ red-white warning tip stripes!
      const bladeLathe = lathe(
        [
          [0.060, 0],
          [0.080, 0.08],
          [0.118, 0.20],
          [0.132, 0.34],
          [0.116, 0.45],
          [0.075, 0.515],
          [0, 0.54],
        ],
        18
      );
      for (const dir of [-1, 1]) {
        const bg = bladeLathe.clone();
        bg.scale(1, 1, 0.24);
        bg.rotateY(dir * 0.22); // aerodynamic pitch twist
        bg.rotateZ(dir > 0 ? -PI / 2 : PI / 2);
        add(propGroup, bg, mPropBlade);
      }

      // Central mahogany hub barrel + polished brass boss plate, spinner nut & 8 bolts
      add(propGroup, new THREE.CylinderGeometry(0.088, 0.088, 0.11, 18), mWoodDark, 0, 0, 0, PI / 2, 0, 0);
      add(propGroup, new THREE.CylinderGeometry(0.078, 0.084, 0.125, 18), mBrass, 0, 0, 0, PI / 2, 0, 0);
      add(propGroup, new THREE.SphereGeometry(0.045, 14, 10), mBrass, 0, 0, 0.065, 0, 0, 0, 1, 1, 0.8);
      for (let b = 0; b < 8; b++) {
        const a = (b / 8) * TAU;
        add(
          propGroup,
          new THREE.CylinderGeometry(0.009, 0.009, 0.134, 6),
          mBrass,
          Math.cos(a) * 0.058,
          Math.sin(a) * 0.058,
          0,
          PI / 2,
          0,
          0
        );
      }

      const pmx = new THREE.Matrix4().compose(
        propGroup.position,
        new THREE.Quaternion().setFromEuler(propGroup.rotation),
        propGroup.scale
      );
      while (propGroup.children.length) {
        const ch = propGroup.children[0];
        ch.applyMatrix4(pmx);
        g.add(ch);
      }
    });
  }

  // ==========================================================================
  // 13. sp_seagull — Articulated Flying Storybook Adriatic Seagull (`isAnimal`, `canFly`)
  // ==========================================================================
  const mc = createMatCache(THREE);
  function buildSeagullAnimal() {
    const root = new THREE.Group();
    root.name = 'sp_seagull';
    root.userData.keep = true;

    const wMat = mc(0xfbfaf4, { roughness: 0.72 });
    const slateMat = mc(0x526576, { roughness: 0.76 });
    const tipMat = mc(0x232930, { roughness: 0.78 });
    const beakMat = mc(0xf2ad28, { roughness: 0.54 });
    const redSpot = mc(0xc93a2b, { roughness: 0.5 });

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.y = 0.25;
    root.add(bodyGrp);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), wMat);
    torso.scale.set(0.84, 0.82, 1.52);
    torso.castShadow = true;
    bodyGrp.add(torso);

    const back = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), slateMat);
    back.scale.set(0.82, 0.42, 1.32);
    back.position.set(0, 0.06, -0.02);
    bodyGrp.add(back);

    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(0, 0.13, 0.22);
    bodyGrp.add(headGrp);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), wMat);
    head.position.set(0, 0.04, 0.03);
    headGrp.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.15, 7), beakMat);
    beak.rotation.x = PI / 2;
    beak.position.set(0, 0.03, 0.16);
    headGrp.add(beak);
    const bTip = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), redSpot);
    bTip.position.set(0, 0.02, 0.20);
    headGrp.add(bTip);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), tipMat);
      eye.position.set(sx * 0.072, 0.06, 0.08);
      headGrp.add(eye);
    }

    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(0, 0.03, -0.24);
    bodyGrp.add(tailGrp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.024, 0.20), wMat);
    tail.position.z = -0.08;
    tailGrp.add(tail);

    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      wing.name = s < 0 ? 'wingL' : 'wingR';
      wing.position.set(s * 0.12, 0.05, 0.02);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.032, 0.20), slateMat);
      inner.position.set(s * 0.19, 0, -0.02);
      inner.castShadow = true;
      wing.add(inner);

      const tip = new THREE.Group();
      tip.name = s < 0 ? 'tipL' : 'tipR';
      tip.position.set(s * 0.38, 0, -0.02);
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.024, 0.14), wMat);
      outer.position.set(s * 0.15, 0, -0.02);
      tip.add(outer);
      const darkTip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.11), tipMat);
      darkTip.position.set(s * 0.28, 0.002, -0.03);
      tip.add(darkTip);
      wing.add(tip);
      bodyGrp.add(wing);
    }

    for (const [nm, sx] of [['legsA', -0.055], ['legsB', 0.055]]) {
      const lg = new THREE.Group();
      lg.name = nm;
      lg.position.set(sx, 0.16, 0.01);
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.16, 6), beakMat);
      stilt.position.y = -0.08;
      lg.add(stilt);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, 0.075), beakMat);
      foot.position.set(0, -0.155, 0.025);
      lg.add(foot);
      root.add(lg);
    }

    attachCreatureKinematics(root, { mode: 'bird_flapper', canFly: true });
    return root;
  }

  // ==========================================================================
  // 14. sp_pelican — Whimsical Coastal Adriatic Pelican (`isAnimal`, `canFly`)
  // ==========================================================================
  function buildPelicanAnimal() {
    const root = new THREE.Group();
    root.name = 'sp_pelican';
    root.userData.keep = true;

    const creamMat = mc(0xf6efe0, { roughness: 0.78 });
    const slateMat = mc(0x647280, { roughness: 0.78 });
    const pouchMat = mc(0xf09f34, { roughness: 0.56 });
    const billMat = mc(0xe5b95c, { roughness: 0.55 });
    const darkMat = mc(0x23262e, { roughness: 0.65 });

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.y = 0.36;
    root.add(bodyGrp);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), creamMat);
    torso.scale.set(0.92, 0.90, 1.48);
    torso.castShadow = true;
    bodyGrp.add(torso);

    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(0, 0.22, 0.22);
    bodyGrp.add(headGrp);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.11, 0.28, 8), creamMat);
    neck.rotation.x = 0.28;
    neck.position.set(0, 0.06, 0.02);
    headGrp.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), creamMat);
    head.position.set(0, 0.18, 0.08);
    headGrp.add(head);

    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5), creamMat);
    crest.rotation.x = -0.9;
    crest.position.set(0, 0.24, -0.02);
    headGrp.add(crest);

    // Upper long bill & plump golden-orange pelican throat pouch!
    const billTop = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.036, 0.34), billMat);
    billTop.position.set(0, 0.17, 0.29);
    headGrp.add(billTop);

    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), pouchMat);
    pouch.scale.set(0.66, 0.72, 1.55);
    pouch.position.set(0, 0.10, 0.26);
    headGrp.add(pouch);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.020, 6, 6), darkMat);
      eye.position.set(sx * 0.082, 0.20, 0.12);
      headGrp.add(eye);
    }

    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(0, 0.04, -0.32);
    bodyGrp.add(tailGrp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.24), slateMat);
    tail.position.z = -0.10;
    tailGrp.add(tail);

    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      wing.name = s < 0 ? 'wingL' : 'wingR';
      wing.position.set(s * 0.20, 0.08, 0.02);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.044, 0.28), creamMat);
      inner.position.set(s * 0.26, 0, -0.02);
      inner.castShadow = true;
      wing.add(inner);

      const tip = new THREE.Group();
      tip.name = s < 0 ? 'tipL' : 'tipR';
      tip.position.set(s * 0.52, 0, -0.02);
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.032, 0.20), slateMat);
      outer.position.set(s * 0.20, 0, -0.02);
      tip.add(outer);
      const blackTip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.032, 0.15), darkMat);
      blackTip.position.set(s * 0.36, 0.002, -0.03);
      tip.add(blackTip);
      wing.add(tip);
      bodyGrp.add(wing);
    }

    for (const [nm, sx] of [['legsA', -0.09], ['legsB', 0.09]]) {
      const lg = new THREE.Group();
      lg.name = nm;
      lg.position.set(sx, 0.20, 0.01);
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.018, 0.20, 6), pouchMat);
      stilt.position.y = -0.10;
      lg.add(stilt);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.11), pouchMat);
      foot.position.set(0, -0.19, 0.035);
      lg.add(foot);
      root.add(lg);
    }

    attachCreatureKinematics(root, { mode: 'bird_flapper', canFly: true });
    return root;
  }

  return {
    sp_gelato_cart: buildGelatoCart,
    sp_olive_amphora: buildOliveAmphora,
    sp_lobster_trap: buildLobsterTrap,
    sp_anchor_bollard: buildAnchorBollard,
    sp_lemon_planter: buildLemonPlanter,
    sp_bistro_set: buildBistroSet,
    sp_fuel_drum: buildFuelDrum,
    sp_pelican_post: buildPelicanPost,
    sp_wine_rack: buildWineRack,
    sp_sea_chest: buildSeaChest,
    sp_buoy_float: buildBuoyFloat,
    sp_propeller_stand: buildPropellerStand,
    sp_seagull: buildSeagullAnimal,
    sp_pelican: buildPelicanAnimal,
  };
}

// ============================================================================
// Custom Hiding-Spot 3D Disguises for Porto Sereno Seaplane Cove (`metalness: 0`)
//   1. `sea_float`: Bobbing harbor buoy, glass fishing float in rope net, or floating Gabbiano crate
//   2. `rowboat_cargo`: Coiled rope, wicker fishing basket & folded sailcloth inside drifting rowboat
//   3. `balcony_ledge`: Cliffside terracotta & majolica flower-box planter w/ bougainvillea & lemons
// ============================================================================
export function buildCustomDisguiseMesh(THREE, spot = {}) {
  const g = new THREE.Group();
  const std = (hex, extra = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.84 }, extra, { metalness: 0 }));

  const put = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  const type = spot.spotType || 'sea_float';
  const variant = spot.variant || 'buoy';

  if (type === 'sea_float') {
    const mFoam = std(0xf2fcff, { roughness: 0.55 });
    const mRed = std(0xd93c2e, { roughness: 0.72 });
    const mCream = std(0xfaf2df, { roughness: 0.82 });
    const mRope = std(0xdcbe82, { roughness: 0.92 });
    const mBrass = std(0xe6b448, { roughness: 0.45 });
    const mWood = std(0xc88d52, { roughness: 0.86 });
    const mWoodDark = std(0x845530, { roughness: 0.9 });

    // Gentle floating seafoam collar ring at waterline
    put(new THREE.TorusGeometry(0.42, 0.032, 6, 22), mFoam, 0, 0.04, 0, PI / 2, 0, 0);

    if (variant === 'glass_float') {
      const mCore = std(0x32cbb8, { emissive: 0x1ca392, emissiveIntensity: 0.55, roughness: 0.28 });
      const mGlass = std(0x7af4e4, {
        emissive: 0x1aa090,
        emissiveIntensity: 0.35,
        roughness: 0.18,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
      });
      put(new THREE.SphereGeometry(0.24, 14, 12), mCore, 0, 0.24, 0);
      put(new THREE.SphereGeometry(0.30, 16, 14), mGlass, 0, 0.24, 0);
      for (let k = 0; k < 4; k++) {
        put(new THREE.TorusGeometry(0.31, 0.018, 6, 20), mRope, 0, 0.24, 0, 0.22, (k * PI) / 4, 0.15);
      }
      put(new THREE.TorusGeometry(0.27, 0.02, 6, 18), mRope, 0, 0.36, 0, PI / 2, 0, 0);
      put(new THREE.TorusGeometry(0.27, 0.02, 6, 18), mRope, 0, 0.12, 0, PI / 2, 0, 0);
      put(new THREE.TorusGeometry(0.08, 0.024, 6, 12), mRope, 0, 0.56, 0);
      // Small companion cork bobbers
      put(new THREE.CylinderGeometry(0.065, 0.065, 0.11, 10), mRed, 0.34, 0.09, 0.14, 0.2, 0, 0.3);
      put(new THREE.CylinderGeometry(0.068, 0.068, 0.04, 10), mCream, 0.34, 0.09, 0.14, 0.2, 0, 0.3);
    } else if (variant === 'crate') {
      // Floating Gabbiano Mail Plane wooden aviation supply crate w/ rope & lifebuoy
      put(new THREE.BoxGeometry(0.68, 0.52, 0.64), mWood, 0, 0.22, 0, 0.05, 0.18, -0.04);
      for (const s of [-1, 1]) {
        put(new THREE.BoxGeometry(0.72, 0.07, 0.68), mWoodDark, 0, 0.22 + s * 0.21, 0, 0.05, 0.18, -0.04);
        put(new THREE.BoxGeometry(0.71, 0.54, 0.07), mWoodDark, 0, 0.22, s * 0.28, 0.05, 0.18, -0.04);
      }
      // Italian crimson-cream aviation stripe & lashed rope + mini lifebuoy on top
      put(new THREE.BoxGeometry(0.70, 0.12, 0.66), mRed, 0, 0.24, 0, 0.05, 0.18, -0.04);
      put(new THREE.TorusGeometry(0.22, 0.055, 8, 16), mRed, 0.04, 0.52, 0.02, PI / 2 + 0.05, 0, 0);
      put(new THREE.TorusGeometry(0.22, 0.058, 8, 8), mCream, 0.04, 0.52, 0.02, PI / 2 + 0.05, 0.4, 0);
    } else {
      // Classic red-and-white Adriatic harbor bell buoy
      put(new THREE.CylinderGeometry(0.34, 0.28, 0.22, 16), mRed, 0, 0.12, 0);
      put(new THREE.CylinderGeometry(0.35, 0.35, 0.11, 16), mCream, 0, 0.26, 0);
      put(new THREE.ConeGeometry(0.30, 0.24, 16), mRed, 0, 0.43, 0);
      put(new THREE.TorusGeometry(0.36, 0.045, 7, 18), mRope, 0, 0.18, 0, PI / 2, 0, 0);
      // Bell cage & sunlit beacon cap
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        put(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6), mRed, Math.cos(a) * 0.12, 0.68, Math.sin(a) * 0.12, 0, 0, -Math.cos(a) * 0.14);
      }
      put(new THREE.CylinderGeometry(0.11, 0.14, 0.12, 12), mBrass, 0, 0.66, 0);
      put(new THREE.SphereGeometry(0.09, 10, 8), std(0xfff1a8, { emissive: 0xffb838, emissiveIntensity: 0.75, roughness: 0.3 }), 0, 0.92, 0);
    }
    return g;
  }

  if (type === 'rowboat_cargo') {
    const mWicker = std(0xc99658, { roughness: 0.9 });
    const mRope = std(0xe0be82, { roughness: 0.92 });
    const mCloth = std(0xf8efe0, { roughness: 0.88 });
    const mStripe = std(0x2b6cb5, { roughness: 0.85 });
    const mCoral = std(0xd44736, { roughness: 0.82 });
    const mBrass = std(0xe4b248, { roughness: 0.45 });

    // Woven wicker fisherman creel basket + folded striped sailcloth bundle + coiled hemp rope + lantern
    put(new THREE.CylinderGeometry(0.32, 0.26, 0.38, 14), mWicker, -0.10, 0.20, 0.06);
    put(new THREE.TorusGeometry(0.32, 0.035, 6, 16), mRope, -0.10, 0.39, 0.06, PI / 2, 0, 0);
    put(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 14), mWicker, -0.10, 0.41, 0.06, 0.08, 0, -0.06);
    // Folded Mediterranean striped canvas tarp
    put(new THREE.BoxGeometry(0.46, 0.16, 0.36), mCloth, 0.14, 0.12, -0.16, 0, 0.28, 0);
    put(new THREE.BoxGeometry(0.47, 0.06, 0.14), mStripe, 0.14, 0.17, -0.16, 0, 0.28, 0);
    // Stacked rope coil & cork floats + warm fisherman lantern
    for (let r = 0; r < 3; r++) {
      put(new THREE.TorusGeometry(0.19 - r * 0.015, 0.038, 6, 14), mRope, 0.18, 0.06 + r * 0.062, 0.20, PI / 2, 0, 0);
    }
    put(new THREE.SphereGeometry(0.085, 10, 8), mCoral, -0.26, 0.46, 0.12);
    put(new THREE.CylinderGeometry(0.07, 0.085, 0.18, 10), mBrass, 0.08, 0.30, -0.16);
    put(new THREE.SphereGeometry(0.06, 8, 8), std(0xffe9a6, { emissive: 0xffae3d, emissiveIntensity: 0.8 }), 0.08, 0.32, -0.16);
    return g;
  }

  // `balcony_ledge`: Terracotta & majolica cliff-balcony flower planter w/ cascading bougainvillea & lemons!
  const mTerra = std(0xd46b3e, { roughness: 0.84 });
  const mStone = std(0xeae0c8, { roughness: 0.9 });
  const mLeaf = std(0x468d38, { roughness: 0.85 });
  const mLeafDk = std(0x2f6c28, { roughness: 0.88 });
  const mBougA = std(0xe62e82, { roughness: 0.78 });
  const mBougB = std(0xff62ad, { roughness: 0.78 });
  const mLemon = std(0xfad228, { roughness: 0.52 });

  // Stone corbel bracket + terracotta trough box
  put(new THREE.BoxGeometry(0.92, 0.12, 0.48), mStone, 0, 0.06, 0);
  put(new THREE.BoxGeometry(0.86, 0.34, 0.42), mTerra, 0, 0.28, 0);
  put(new THREE.BoxGeometry(0.92, 0.07, 0.48), mTerra, 0, 0.45, 0);
  // Overflowing foliage mounds, cascading magenta bougainvillea & bright lemons
  const puffs = [
    [-0.28, 0.56, 0.02, 0.22, mLeaf],
    [0.0, 0.62, 0.0, 0.25, mLeafDk],
    [0.28, 0.56, 0.02, 0.22, mLeaf],
    [-0.18, 0.42, 0.22, 0.18, mLeafDk],
    [0.18, 0.40, 0.22, 0.18, mLeaf],
  ];
  for (const [px, py, pz, r, lm] of puffs) {
    put(new THREE.DodecahedronGeometry(r, 1), lm, px, py, pz, 0.2, 0.4, 0, 1.15, 0.85, 1.0);
  }
  const blooms = [
    [-0.32, 0.68, 0.08, mBougA], [-0.12, 0.74, 0.06, mBougB], [0.12, 0.72, 0.08, mBougA],
    [0.32, 0.66, 0.06, mBougB], [-0.22, 0.34, 0.28, mBougA], [0.02, 0.28, 0.29, mBougB],
    [0.24, 0.32, 0.27, mBougA], [-0.08, 0.14, 0.28, mBougB],
  ];
  for (const [bx, by, bz, bm] of blooms) {
    put(new THREE.DodecahedronGeometry(0.13, 0), bm, bx, by, bz, bx * 2, by * 2, 0);
  }
  for (const [lx, ly, lz] of [[-0.20, 0.62, -0.06], [0.20, 0.64, -0.04], [0.02, 0.56, 0.18]]) {
    put(new THREE.SphereGeometry(0.065, 8, 6), mLemon, lx, ly, lz, 0.2, 0, 0.2, 0.85, 1.25, 0.85);
  }
  return g;
}
