// ============================================================================
// Celestia Sky-Ruins (Celestia) — Shared Handcrafted Storybook Architectural Kit
// Provides instanced 3D cream-travertine ashlar masonry, radial voussoir stone arches,
// fluted classical Celestian columns, glowing cyan Skyglass crystals & rune friezes,
// gnarled ancient tree roots, lush sunlit Storybook foliage pads, giant glowing sky-orchids,
// cascading purple wisteria racemes, and floating-island stone plinths.
// ALL materials use metalness: 0 so brass, gold, bronze & crystals glow warmly!
// ============================================================================

import {
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
} from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

export const TRAVERTINE_PAL = [0xf5ebd6, 0xede0c6, 0xfaf2e1, 0xe4d4b7, 0xefe3ca, 0xe8d9be];
export const CLIFF_ROCK_PAL = [0xbcae98, 0xa89a85, 0xcabca4, 0x9b8e7b, 0xb5a68f];
export const MOSS_PAL = [0x7ab84a, 0x8cc958, 0x67a43c, 0x9dd668, 0x5c9436];
export const FOLIAGE_SUN_PAL = [0x7ec447, 0x96d455, 0x64ab38, 0xb2e266, 0x52942e, 0xc5ea74];
export const WISTERIA_PAL = [0xb67ef4, 0xcf9aff, 0x9c64e2, 0xe4bcff, 0xf2d0fa];
export const ORCHID_PAL = [0x8c82ff, 0xa594ff, 0x6e98ff, 0xc2a8ff, 0x7cb2ff];
export const WILDFLOWER_PAL = [0xfff9e8, 0xffe27a, 0xffb8d2, 0xc8a4ff, 0x9ad8ff];
export const GOLD_TILE_PAL = [0xe8b54c, 0xf2c45e, 0xd8a23d, 0xf7d070];

let _texCache = null;
const _geoCache = new WeakMap();

export function sharedSkyGeo(THREE, key, make) {
  let m = _geoCache.get(THREE);
  if (!m) { m = {}; _geoCache.set(THREE, m); }
  return m[key] || (m[key] = make());
}

export function getSkyTextures(THREE) {
  if (_texCache && _texCache._T === THREE) return _texCache;

  // 1. Sunlit Cream Celestian Travertine Ashlar Stone
  const ashlarCream = paintedCanvasTex(THREE, 'sr2_ashlar_cream', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#f3e8d2';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 240, ['#fbf4e4', '#e6d8be', '#dccbb0', '#fffaf0'], 5, 15, 0.32);
    const rows = 6, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      ctx.strokeStyle = 'rgba(122,102,76,0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
      const cols = 4, cw = s / cols, off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + off;
        ctx.fillStyle = rng.pick(['rgba(255,250,238,0.22)', 'rgba(214,196,166,0.20)', 'rgba(238,224,198,0.18)']);
        ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rh); ctx.stroke();
      }
    }
    brushStrokes(ctx, s, rng, 48, ['#8ab65c', '#a4c876'], 2, 5, 0.16);
  }, 2, 2);

  // 2. Carved Turquoise & Gold Celestian Square-Spiral Rune Frieze (Observatory, Golem & Crystal Rings)
  const runeFrieze = paintedCanvasTex(THREE, 'sr2_rune_frieze', 512, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#1e7898');
    grd.addColorStop(0.5, '#299ec0');
    grd.addColorStop(1, '#1b6c8a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 180, ['#38b6d8', '#1d6f8e', '#56d0ec'], 4, 12, 0.35);

    // Upper & lower golden stone cornice bands
    ctx.fillStyle = '#e2b04a';
    ctx.fillRect(0, 0, s, 54);
    ctx.fillRect(0, s - 54, s, 54);
    ctx.fillStyle = '#fae08c';
    ctx.fillRect(0, 38, s, 10);
    ctx.fillRect(0, s - 48, s, 10);

    // Luminous cyan Celestian square-spiral & ring glyphs
    ctx.strokeStyle = '#92fbff';
    ctx.lineWidth = 8;
    const cells = 6, cw = s / cells;
    for (let i = 0; i < cells; i++) {
      const cx = (i + 0.5) * cw, cy = s * 0.5;
      ctx.strokeRect(cx - cw * 0.30, cy - cw * 0.30, cw * 0.60, cw * 0.60);
      ctx.beginPath(); ctx.arc(cx, cy, cw * 0.17, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#d4ffff';
      ctx.beginPath(); ctx.arc(cx, cy, cw * 0.07, 0, TAU); ctx.fill();
    }
  }, 3, 1);

  // 3. Cobalt & Gold Celestial Star-Chart Stained Glass (Observatory Dome & Windows)
  const starDome = paintedCanvasTex(THREE, 'sr2_star_dome', 512, (ctx, s, rng) => {
    const grd = ctx.createRadialGradient(s * 0.5, s * 0.38, 18, s * 0.5, s * 0.5, s * 0.56);
    grd.addColorStop(0, '#5ad6ff');
    grd.addColorStop(0.45, '#2472c8');
    grd.addColorStop(1, '#163c82');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 200, ['#368ae0', '#1d529e', '#6ce0ff'], 4, 14, 0.28);

    // Golden celestial orbit arcs & constellation lines
    ctx.strokeStyle = 'rgba(255,222,122,0.85)';
    ctx.lineWidth = 3.5;
    for (const r of [0.18, 0.31, 0.43]) {
      ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, s * r, 0, TAU); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(s * 0.5 + Math.cos(a) * s * 0.10, s * 0.5 + Math.sin(a) * s * 0.10);
      ctx.lineTo(s * 0.5 + Math.cos(a) * s * 0.48, s * 0.5 + Math.sin(a) * s * 0.48);
      ctx.stroke();
    }
    // Twinkling stars
    for (let i = 0; i < 65; i++) {
      const x = rng.jr(20, s - 20), y = rng.jr(20, s - 20), sr = rng.jr(2, 5.5);
      ctx.fillStyle = i % 3 === 0 ? '#fff6be' : '#b8f8ff';
      ctx.beginPath(); ctx.arc(x, y, sr, 0, TAU); ctx.fill();
    }
  }, 1, 1);

  // 4. Turquoise, Cream & Gold 16-Point Compass-Rose Mosaic (Central Basin, Observatory & Golem Sanctum)
  const compassMosaic = paintedCanvasTex(THREE, 'sr2_compass_mosaic', 512, (ctx, s, rng) => {
    const c = s * 0.5;
    ctx.fillStyle = '#2996b8';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 340, ['#3cb6d6', '#1e7898', '#68daf0', '#216888'], 6, 16, 0.4);
    const ring = (r, w, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(c, c, r, 0, TAU); ctx.stroke();
    };
    ring(s * 0.46, 20, '#f2e6ce');
    ring(s * 0.42, 8, '#e5b34c');
    ring(s * 0.31, 15, '#f5ebd6');
    ring(s * 0.27, 6, '#8cfaff');
    ring(s * 0.15, 10, '#e5b34c');

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      ctx.strokeStyle = i % 2 === 0 ? '#f6cf6e' : 'rgba(180,252,255,0.65)';
      ctx.lineWidth = i % 2 === 0 ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * s * 0.08, c + Math.sin(a) * s * 0.08);
      ctx.lineTo(c + Math.cos(a) * s * 0.44, c + Math.sin(a) * s * 0.44);
      ctx.stroke();
    }
    // 8-point golden star rose
    ctx.fillStyle = '#f5ca64';
    ctx.strokeStyle = '#9e6f20';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU - PI * 0.5;
      const r = i % 2 === 0 ? (i % 4 === 0 ? s * 0.30 : s * 0.22) : s * 0.095;
      const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#96fbff';
    ctx.beginPath(); ctx.arc(c, c, s * 0.065, 0, TAU); ctx.fill();
  }, 1, 1);

  // 5. Classical Cream & Gold Sun-Compass Mosaic (Wind-Chime Colonnade Floor)
  const sunCompassFloor = paintedCanvasTex(THREE, 'sr2_sun_compass', 512, (ctx, s, rng) => {
    const c = s * 0.5;
    ctx.fillStyle = '#f4ead4';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 220, ['#fcf5e6', '#e6d8bc', '#efe2c8'], 6, 16, 0.35);
    for (const [r, w, col] of [[0.45, 16, '#dfb04c'], [0.39, 6, '#b88c38'], [0.26, 10, '#dfb04c']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(c, c, s * r, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#eab94e';
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const r = i % 2 === 0 ? (i % 4 === 0 ? s * 0.36 : s * 0.25) : s * 0.11;
      const px = c + Math.cos(a) * r, py = c + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fae08a';
    ctx.beginPath(); ctx.arc(c, c, s * 0.08, 0, TAU); ctx.fill();
  }, 1, 1);

  // 6. Royal-Blue Sky-Pirate Winged Banner (Hangar & Sky-Pier)
  const pirateBanner = paintedCanvasTex(THREE, 'sr2_pirate_banner', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#264d8c';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 120, ['#315ea4', '#1d3c72', '#3a6bb4'], 4, 10, 0.3);
    ctx.strokeStyle = '#ebb64b';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, s - 20, s - 20);
    // Golden winged airship crest
    const cx = s * 0.5, cy = s * 0.48;
    ctx.fillStyle = '#f5ca5c';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 8);
      ctx.quadraticCurveTo(cx + sx * 52, cy - 42, cx + sx * 86, cy - 28);
      ctx.quadraticCurveTo(cx + sx * 68, cy + 12, cx, cy + 28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy + 6, 18, 0, TAU); ctx.fill();
  }, 1, 1);

  // 7. Royal-Blue Sun-Star Temple Banner (Wind-Chime Colonnade)
  const starBanner = paintedCanvasTex(THREE, 'sr2_star_banner', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#28549a';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 110, ['#3466b4', '#1f427c'], 4, 10, 0.28);
    ctx.strokeStyle = '#edc056';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, s - 24, s - 24);
    const cx = s * 0.5, cy = s * 0.5;
    ctx.fillStyle = '#fad46e';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const r = i % 2 === 0 ? (i % 4 === 0 ? 58 : 38) : 16;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }, 1, 1);

  // 8. Golden-Ochre Stretched Airship Canopy Canvas (Hangar Tent Roof)
  const canopyCanvas = paintedCanvasTex(THREE, 'sr2_canopy_canvas', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#f8cc68');
    grd.addColorStop(0.6, '#ebb44c');
    grd.addColorStop(1, '#d69836');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 180, ['#fce08c', '#dfa43e', '#f4c45c'], 3, 8, 0.28);
    ctx.strokeStyle = 'rgba(138,88,26,0.35)';
    ctx.lineWidth = 3;
    for (let x = 32; x < s; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
  }, 2, 2);

  // 9. Striped Sky-Merchant Awning Canvas
  const stripedStall = paintedCanvasTex(THREE, 'sr2_striped_stall', 256, (ctx, s, rng) => {
    const stripes = 8, sw = s / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#df6a42' : '#fbf1dc';
      ctx.fillRect(i * sw, 0, sw + 1, s);
    }
    brushStrokes(ctx, s, rng, 110, ['rgba(255,248,230,0.22)', 'rgba(180,72,38,0.18)'], 3, 7, 0.22);
  }, 2, 1);

  // 10. Carved Celestian Relief Stele Tablet (Observatory Inner Sanctum)
  const carvedStele = paintedCanvasTex(THREE, 'sr2_carved_stele', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#e7d5b4';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 140, ['#f2e4c8', '#cfb994', '#dcc7a4'], 4, 10, 0.3);
    ctx.strokeStyle = '#9c7e54';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, s - 36, s - 36);
    for (const cy of [s * 0.30, s * 0.56, s * 0.80]) {
      ctx.strokeRect(s * 0.24, cy - 22, s * 0.52, 44);
      ctx.beginPath(); ctx.arc(s * 0.5, cy, 14, 0, TAU); ctx.stroke();
    }
  }, 1, 1);

  _texCache = {
    _T: THREE,
    ashlarCream,
    runeFrieze,
    starDome,
    compassMosaic,
    sunCompassFloor,
    pirateBanner,
    starBanner,
    canopyCanvas,
    stripedStall,
    carvedStele,
  };
  return _texCache;
}

// ============================================================================
// Standard Celestian Palette Materials (100% metalness: 0 for luminous Storybook look!)
// ============================================================================
export function getSkyMats(THREE, K) {
  const { M, glowMat, tex } = K;
  const ST = getSkyTextures(THREE);
  return {
    ST,
    travertine: M(0xffffff, ST.ashlarCream, { roughness: 0.86, metalness: 0 }),
    travertinePlain: M(0xf5ebd6, tex('plaster', 1.5, 1.5), { roughness: 0.86, metalness: 0 }),
    travertineWarm: M(0xeadac0, tex('plaster', 1.5, 1.5), { roughness: 0.88, metalness: 0 }),
    travertineDark: M(0xcfc0a6, tex('stone', 1.6, 1.6), { roughness: 0.90, metalness: 0 }),
    golemStone: M(0xc8bea8, tex('stone', 1.5, 1.5), { roughness: 0.88, metalness: 0 }),
    golemDark: M(0x988e7b, tex('stone', 1.5, 1.5), { roughness: 0.90, metalness: 0 }),
    runeFrieze: M(0xffffff, ST.runeFrieze, { roughness: 0.56, metalness: 0, emissive: new THREE.Color(0x0c4a62), emissiveIntensity: 0.28 }),
    compassMosaic: M(0xffffff, ST.compassMosaic, { roughness: 0.62, metalness: 0 }),
    sunCompass: M(0xffffff, ST.sunCompassFloor, { roughness: 0.68, metalness: 0 }),
    carvedStele: M(0xffffff, ST.carvedStele, { roughness: 0.82, metalness: 0 }),
    starDome: M(0xffffff, ST.starDome, {
      roughness: 0.30, metalness: 0,
      emissive: new THREE.Color(0x1b5ca8), emissiveIntensity: 0.42,
      side: THREE.DoubleSide,
    }),
    pirateBanner: M(0xffffff, ST.pirateBanner, { roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
    starBanner: M(0xffffff, ST.starBanner, { roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
    canopyCanvas: M(0xffffff, ST.canopyCanvas, { roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
    stripedStall: M(0xffffff, ST.stripedStall, { roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
    creamCanvas: M(0xfbf0d8, tex('plaster', 1.4, 1.4), { roughness: 0.80, metalness: 0, side: THREE.DoubleSide }),
    wingParchment: M(0xf8e6c4, tex('plaster', 1.2, 1.2), { roughness: 0.74, metalness: 0, side: THREE.DoubleSide }),
    goldBrass: M(0xf0bc4e, tex('painted_metal', 1.2, 1.2), {
      roughness: 0.42, metalness: 0,
      emissive: new THREE.Color(0x3a2406), emissiveIntensity: 0.16,
    }),
    brassDeep: M(0xc89232, tex('painted_metal', 1.2, 1.2), {
      roughness: 0.48, metalness: 0,
      emissive: new THREE.Color(0x2c1a04), emissiveIntensity: 0.12,
    }),
    copperWarm: M(0xd67c44, tex('painted_metal', 1.2, 1.2), {
      roughness: 0.46, metalness: 0,
      emissive: new THREE.Color(0x2e1206), emissiveIntensity: 0.12,
    }),
    verdigrisFrame: M(0x5fa084, tex('painted_metal', 1.4, 1.4), { roughness: 0.56, metalness: 0 }),
    oliveIron: M(0x4b5c48, tex('painted_metal', 1.4, 1.4), { roughness: 0.62, metalness: 0 }),
    oakTimber: M(0xc88e52, tex('wood_light', 1.5, 1.5), { roughness: 0.80, metalness: 0 }),
    darkTimber: M(0x7c5030, tex('wood_planks_dark', 1.4, 1.4), { roughness: 0.84, metalness: 0 }),
    barkAncient: M(0x8b623c, tex('wood_planks_dark', 1.8, 1.8), { roughness: 0.88, metalness: 0 }),
    crimsonLeather: M(0xa64238, tex('plaster', 1.4, 1.4), { roughness: 0.74, metalness: 0 }),
    mossGreen: M(0x7eb84c, tex('leaves', 1.6, 1.6), { roughness: 0.84, metalness: 0 }),
    terracotta: M(0xd27248, tex('plaster', 1.4, 1.4), { roughness: 0.82, metalness: 0 }),
    cyanCrystal: glowMat(0x42e8ff, 0x0cb8f0, 0.92, { roughness: 0.20 }),
    cyanSoft: glowMat(0x8cf6ff, 0x22c8f4, 0.68, { roughness: 0.28 }),
    amberGlow: glowMat(0xffdf88, 0xff9d2e, 0.88, { roughness: 0.30 }),
    orchidPetal: glowMat(0x9a92ff, 0x4638c8, 0.36, { roughness: 0.52, side: THREE.DoubleSide }),
    waterGlow: glowMat(0x58e2f5, 0x1ba8cc, 0.44, { roughness: 0.22 }),
    conservatoryGlass: new THREE.MeshStandardMaterial({
      color: 0xd4f4ff,
      emissive: new THREE.Color(0x3a94c8),
      emissiveIntensity: 0.24,
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    // Neutral white base materials for InstancedMesh per-instance colors!
    stoneInst: M(0xffffff, tex('plaster', 0.5, 0.5), { roughness: 0.86, metalness: 0 }),
    foliageInst: M(0xffffff, tex('plaster', 0.45, 0.45), { roughness: 0.80, metalness: 0 }),
  };
}

// ============================================================================
// 1. Floating Island Stone Plinth + Entrance Steps + Twin Cyan Obelisks + Flora
//    When `garden: true` (gallery mode), includes craggy floating rock underside & waterfalls!
// ============================================================================
export function buildMossyIslandPlinth(THREE, K, opts = {}) {
  const {
    w = 10.6, d = 9.2, h = 0.32,
    doorX = 0, doorZ = d * 0.5, doorW = 2.4,
    steps = 3,
    garden = false,
    obelisks = true,
    parent = K.root,
    batchPrefix = 'plinth',
  } = opts;

  const { add, box, rbox, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);

  // Main stepped travertine foundation deck
  add(rbox(w + 0.52, h * 0.58, d + 0.52, 0.06, sm.travertineDark, 1), 0, h * 0.29, 0, 0, 0, 0, parent);
  const deck = add(rbox(w, h, d, 0.05, sm.travertine, 1), 0, h * 0.5 + 0.02, 0, 0, 0, 0, parent);
  deck.userData.ground = true;

  // Sculpted 3D Instanced Ashlar Curb Blocks & Moss Cushions around perimeter
  const blockGeo = () => sharedSkyGeo(THREE, 'sr_curb_block', () => new RoundedBoxGeometry(0.68, 0.30, 0.40, 0.05, 1));
  const rockGeo = () => sharedSkyGeo(THREE, 'sr_cliff_rock', () => new THREE.DodecahedronGeometry(0.5, 1));
  const flowerGeo = () => sharedSkyGeo(THREE, 'sr_wildflower', () => new THREE.DodecahedronGeometry(0.085, 0));

  const perimPts = [];
  const nx = Math.max(6, Math.floor(w / 0.72));
  const nz = Math.max(5, Math.floor(d / 0.72));
  for (let i = 0; i <= nx; i++) {
    const px = -w * 0.5 + (i / nx) * w;
    if (Math.abs(px - doorX) > doorW * 0.62) perimPts.push([px, d * 0.52, 0]);
    perimPts.push([px, -d * 0.52, PI]);
  }
  for (let i = 1; i < nz; i++) {
    const pz = -d * 0.5 + (i / nz) * d;
    perimPts.push([-w * 0.52, pz, PI * 0.5]);
    perimPts.push([w * 0.52, pz, -PI * 0.5]);
  }

  for (const [bx, bz, rot] of perimPts) {
    pushInst(`${batchPrefix}_curb`, blockGeo, sm.stoneInst,
      bx + jr(-0.03, 0.03), h * 0.52, bz + jr(-0.03, 0.03),
      jr(-0.02, 0.02), rot + jr(-0.04, 0.04), jr(-0.02, 0.02),
      jr(0.92, 1.08), jr(0.88, 1.12), jr(0.92, 1.08),
      pick(TRAVERTINE_PAL), parent);

    if (jr(0, 1) < 0.58) {
      pushInst(`${batchPrefix}_moss`, rockGeo, sm.foliageInst,
        bx + Math.sin(rot) * 0.24 + jr(-0.14, 0.14), h * 0.78, bz + Math.cos(rot) * 0.24 + jr(-0.14, 0.14),
        jr(-0.2, 0.2), jr(0, TAU), jr(-0.2, 0.2),
        jr(0.62, 1.05), jr(0.32, 0.52), jr(0.62, 1.05),
        pick(MOSS_PAL), parent);
      if (jr(0, 1) < 0.65) {
        pushInst(`${batchPrefix}_flw`, flowerGeo, sm.foliageInst,
          bx + Math.sin(rot) * 0.26 + jr(-0.15, 0.15), h * 0.96, bz + Math.cos(rot) * 0.26 + jr(-0.15, 0.15),
          0, jr(0, TAU), 0, jr(0.8, 1.25), jr(0.6, 0.95), jr(0.8, 1.25),
          pick(WILDFLOWER_PAL), parent);
      }
    }
  }

  // Carved Limestone Entrance Staircase + Twin Cyan Crystal Obelisk Pedestals (matches buildings_sheet.png!)
  for (let s = 0; s < steps; s++) {
    const t = (s + 1) / steps;
    const sh = h * (1 - s / steps);
    const stepM = add(rbox(doorW + 0.35 * t, sh, 0.42, 0.03, sm.travertinePlain, 1),
      doorX, sh * 0.5, doorZ + 0.24 + s * 0.36, 0, 0, 0, parent);
    stepM.userData.ground = true;
  }

  if (obelisks) {
    for (const sx of [-1, 1]) {
      const ox = doorX + sx * (doorW * 0.5 + 0.42);
      const oz = doorZ + 0.38;
      buildCrystalObeliskLantern(THREE, K, { x: ox, y: 0, z: oz, scale: 0.92, parent });
    }
  }

  // Craggy floating sky-island cliff belly & twin mini waterfalls when viewed standalone in Gallery!
  if (garden) {
    const rw = w * 0.56, rd = d * 0.56;
    for (let ring = 0; ring < 4; ring++) {
      const f = 1 - ring * 0.21;
      const yRing = -0.35 - ring * 0.62;
      const cnt = Math.max(8, 22 - ring * 4);
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU + ring * 0.28;
        pushInst(`${batchPrefix}_belly`, rockGeo, sm.stoneInst,
          Math.cos(a) * rw * f + jr(-0.22, 0.22), yRing + jr(-0.12, 0.12), Math.sin(a) * rd * f + jr(-0.22, 0.22),
          jr(-0.35, 0.35), jr(0, TAU), jr(-0.35, 0.35),
          jr(1.6, 2.5) * f, jr(1.2, 1.9), jr(1.6, 2.5) * f,
          pick(CLIFF_ROCK_PAL), parent);
      }
    }
    pushInst(`${batchPrefix}_belly`, rockGeo, sm.stoneInst, 0, -2.55, 0, 0.2, 0.6, -0.1, 2.2, 2.4, 2.2, CLIFF_ROCK_PAL[1], parent);

    // Trailing purple wisteria & mini turquoise waterfalls off the front corners
    for (const sx of [-1, 1]) {
      buildWisteriaRacemes(THREE, K, {
        cx: sx * (w * 0.36), yTop: h * 0.72, cz: d * 0.54,
        spanX: 1.2, strands: 5, maxLen: 1.25, parent, batchPrefix: `${batchPrefix}_wist`,
      });
      add(box(0.52, 2.2, 0.14, sm.waterGlow), sx * (w * 0.38), -0.98, d * 0.53, 0.08, 0, 0, parent);
    }
  }

  return { floorY: h + 0.02 };
}

// ============================================================================
// 2. Signature Celestian Glowing Cyan Crystal Obelisk Pedestal Lantern
// ============================================================================
export function buildCrystalObeliskLantern(THREE, K, opts = {}) {
  const { x = 0, y = 0, z = 0, scale = 1.0, parent = K.root } = opts;
  const { add, rbox } = K;
  const sm = getSkyMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  parent.add(g);

  add(rbox(0.62, 0.20, 0.62, 0.03, sm.travertineDark, 1), 0, 0.10, 0, 0, 0, 0, g);
  add(rbox(0.48, 0.44, 0.48, 0.03, sm.travertinePlain, 1), 0, 0.42, 0, 0, 0, 0, g);
  add(rbox(0.54, 0.10, 0.54, 0.025, sm.goldBrass, 1), 0, 0.69, 0, 0, 0, 0, g);
  // Bronze corner cage prongs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(rbox(0.05, 0.38, 0.05, 0.01, sm.brassDeep, 1), sx * 0.17, 0.92, sz * 0.17, -sz * 0.08, 0, sx * 0.08, g);
  }
  // Faceted glowing cyan Skyglass crystal
  const cryGeo = sharedSkyGeo(THREE, 'sr_obelisk_crystal', () => {
    const o = new THREE.OctahedronGeometry(0.18, 0);
    o.scale(0.95, 1.65, 0.95);
    return o;
  });
  add(new THREE.Mesh(cryGeo, sm.cyanCrystal), 0, 0.98, 0, 0, PI * 0.25, 0, g);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 4), sm.goldBrass), 0, 1.24, 0, 0, PI * 0.25, 0, g);
  return g;
}

// ============================================================================
// 3. Classical Fluted Celestian Column (Plinth + Fluted Shaft + Scroll Capital)
// ============================================================================
export function buildFlutedColumn(THREE, K, opts = {}) {
  const {
    x = 0, y0 = 0.34, height = 2.85, radius = 0.24,
    z = 0, goldRings = true, parent = K.root,
  } = opts;
  const { add, rbox } = K;
  const sm = getSkyMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  parent.add(g);

  // Moulded base plinth + torus collar
  add(rbox(radius * 2.75, 0.16, radius * 2.75, 0.03, sm.travertineDark, 1), 0, 0.08, 0, 0, 0, 0, g);
  const baseTorus = new THREE.TorusGeometry(radius * 1.12, radius * 0.18, 8, 18);
  baseTorus.rotateX(PI * 0.5);
  add(new THREE.Mesh(baseTorus, sm.travertinePlain), 0, 0.20, 0, 0, 0, 0, g);

  // Fluted shaft (star-fluted Cylinder via custom radial vertices!)
  const shaftH = Math.max(0.5, height - 0.54);
  const shaftGeo = sharedSkyGeo(THREE, `sr_fluted_${radius.toFixed(2)}_${shaftH.toFixed(2)}`, () => {
    const flutes = 12, seg = flutes * 2;
    const cyl = new THREE.CylinderGeometry(radius * 0.90, radius * 1.0, shaftH, seg, 1, false);
    const pos = cyl.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vz = pos.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r > 1e-4) {
        const ang = Math.atan2(vz, vx);
        const groove = 1 - 0.065 * (0.5 + 0.5 * Math.cos(ang * flutes));
        pos.setX(i, vx * groove);
        pos.setZ(i, vz * groove);
      }
    }
    cyl.computeVertexNormals();
    return cyl;
  });
  add(new THREE.Mesh(shaftGeo, sm.travertinePlain), 0, 0.22 + shaftH * 0.5, 0, 0, 0, 0, g);

  if (goldRings) {
    for (const ry of [0.28, 0.22 + shaftH - 0.06]) {
      const rg = new THREE.TorusGeometry(radius * 1.02, 0.025, 6, 18);
      rg.rotateX(PI * 0.5);
      add(new THREE.Mesh(rg, sm.goldBrass), 0, ry, 0, 0, 0, 0, g);
    }
  }

  // Carved Capital + Ionic Volutes + Abacus
  const capY = 0.22 + shaftH;
  add(new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.28, radius * 0.92, 0.18, 16), sm.travertineWarm), 0, capY + 0.09, 0, 0, 0, 0, g);
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, radius * 2.35, 10), sm.travertinePlain),
      sx * radius * 1.08, capY + 0.17, 0, PI * 0.5, 0, 0, g);
  }
  add(rbox(radius * 2.85, 0.12, radius * 2.85, 0.025, sm.travertinePlain, 1), 0, capY + 0.26, 0, 0, 0, 0, g);
  return g;
}

// ============================================================================
// 4. Radial Voussoir Stone Arch with Carved Keystone & Optional Cyan Rune Boss
// ============================================================================
export function buildStoneArch(THREE, K, opts = {}) {
  const {
    cx = 0, cy = 2.0, cz = 0,
    radius = 1.25, thickness = 0.34, depth = 0.44,
    segments = 11, rotY = 0,
    keystoneGlow = true,
    parent = K.root,
    batchPrefix = 'arch',
  } = opts;
  const { add, rbox, pushInst, pick } = K;
  const sm = getSkyMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  g.rotation.y = rotY;
  parent.add(g);

  const vGeo = () => sharedSkyGeo(THREE, 'sr_voussoir', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));
  const arcSpan = PI;
  for (let i = 0; i < segments; i++) {
    const isKey = i === Math.floor(segments * 0.5);
    const a = -PI * 0.5 + ((i + 0.5) / segments) * arcSpan;
    const vx = Math.sin(a) * radius;
    const vy = Math.cos(a) * radius;
    const wSeg = (arcSpan * radius) / segments * 1.06;
    const hSeg = thickness * (isKey ? 1.26 : 1.0);
    const dSeg = depth * (isKey ? 1.14 : 1.0);
    pushInst(`${batchPrefix}_vs`, vGeo, sm.stoneInst,
      vx, vy, 0, 0, 0, -a, wSeg, hSeg, dSeg,
      isKey ? 0xf7ecd4 : pick(TRAVERTINE_PAL), g);
  }

  if (keystoneGlow) {
    add(rbox(0.28, 0.28, depth * 1.18, 0.04, sm.goldBrass, 1), 0, radius + 0.02, 0, 0, 0, PI * 0.25, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), sm.cyanCrystal), 0, radius + 0.02, depth * 0.58, 0, 0, 0, g);
  }
  return g;
}

// ============================================================================
// 5. Instanced 3D Celestian Ashlar Masonry Course Overlay (Crisp Individual Stones!)
// ============================================================================
export function buildAshlarMasonryFace(THREE, K, opts = {}) {
  const {
    cx = 0, y0 = 0.34, y1 = 3.2, cz = 0,
    span = 4.0, alongZ = false,
    depth = 0.09,
    mossChance = 0.14,
    parent = K.root,
    batchPrefix = 'ashlar',
  } = opts;
  const { pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const stoneGeo = () => sharedSkyGeo(THREE, 'sr_ashlar_blk', () => new RoundedBoxGeometry(1, 1, 1, 0.06, 1));

  const rowH = 0.38;
  const rows = Math.max(2, Math.floor((y1 - y0) / rowH));
  for (let r = 0; r < rows; r++) {
    const y = y0 + (r + 0.5) * ((y1 - y0) / rows);
    const blkW = 0.68;
    const cols = Math.max(2, Math.floor(span / blkW));
    for (let c = 0; c < cols; c++) {
      const u = -span * 0.5 + (c + 0.5) * (span / cols);
      const sx = span / cols - 0.035;
      const sy = (y1 - y0) / rows - 0.03;
      const col = jr(0, 1) < mossChance ? pick(MOSS_PAL) : pick(TRAVERTINE_PAL);
      if (alongZ) {
        pushInst(`${batchPrefix}_st`, stoneGeo, sm.stoneInst,
          cz + jr(-0.012, 0.012), y, cx + u, 0, 0, 0, depth, sy, sx, col, parent);
      } else {
        pushInst(`${batchPrefix}_st`, stoneGeo, sm.stoneInst,
          cx + u, y, cz + jr(-0.012, 0.012), 0, 0, 0, sx, sy, depth, col, parent);
      }
    }
  }
}

// ============================================================================
// 6. Sculpted Gnarled Ancient Celestian Tree Root / Trunk Tube
// ============================================================================
export function buildGnarledRootTube(THREE, K, opts = {}) {
  const {
    points = [[0, 0, 0], [0, 2, 0]],
    rStart = 0.36, rEnd = 0.12,
    radialSeg = 9, tubularSeg = 22,
    mossy = true,
    parent = K.root,
    batchPrefix = 'root',
  } = opts;
  const { add, pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);

  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const geo = new THREE.TubeGeometry(curve, tubularSeg, 1, radialSeg, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const cPt = new THREE.Vector3();
  for (let i = 0; i <= tubularSeg; i++) {
    const t = i / tubularSeg;
    curve.getPointAt(t, cPt);
    const rad = rStart * (1 - t) + rEnd * t;
    for (let j = 0; j <= radialSeg; j++) {
      const idx = i * (radialSeg + 1) + j;
      if (idx >= pos.count) continue;
      v.fromBufferAttribute(pos, idx).sub(cPt);
      const ang = (j / radialSeg) * TAU;
      const barkWave = 1 + 0.11 * Math.sin(ang * 4 + t * 9.0);
      v.multiplyScalar(rad * barkWave).add(cPt);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const mesh = add(new THREE.Mesh(geo, sm.barkAncient), 0, 0, 0, 0, 0, 0, parent);

  if (mossy) {
    const mossGeo = () => sharedSkyGeo(THREE, 'sr_root_moss', () => new THREE.DodecahedronGeometry(0.16, 1));
    const nPatches = Math.max(3, Math.floor(points.length * 1.4));
    for (let k = 0; k < nPatches; k++) {
      const t = (k + 0.5) / nPatches;
      const p = curve.getPointAt(t);
      const rad = rStart * (1 - t) + rEnd * t;
      pushInst(`${batchPrefix}_rmoss`, mossGeo, sm.foliageInst,
        p.x + jr(-0.06, 0.06), p.y + rad * 0.72, p.z + jr(-0.06, 0.06),
        jr(-0.2, 0.2), jr(0, TAU), jr(-0.2, 0.2),
        rad * 2.4, rad * 1.05, rad * 2.2, pick(MOSS_PAL), parent);
    }
  }
  return mesh;
}

// ============================================================================
// 7. Sunlit Storybook Puffy Foliage Canopy Cluster (Instanced Leaf Clouds!)
// ============================================================================
export function buildFoliageCanopyCluster(THREE, K, opts = {}) {
  const {
    cx = 0, cy = 4.5, cz = 0,
    rx = 2.4, ry = 1.25, rz = 2.0,
    puffs = 26,
    palette = FOLIAGE_SUN_PAL,
    parent = K.root,
    batchPrefix = 'canopy',
  } = opts;
  const { pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const puffGeo = () => sharedSkyGeo(THREE, 'sr_leaf_puff', () => new THREE.IcosahedronGeometry(0.56, 1));

  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * TAU * 2.39996;
    const rFrac = Math.sqrt((i + 0.4) / puffs);
    const px = cx + Math.cos(a) * rx * rFrac * jr(0.75, 1.05);
    const pz = cz + Math.sin(a) * rz * rFrac * jr(0.75, 1.05);
    const py = cy + (1 - rFrac * rFrac * 0.75) * ry * 0.58 + jr(-0.18, 0.22);
    const s = jr(0.78, 1.32) * (1.12 - rFrac * 0.28);
    // Brighter yellow-green puffs toward top/sunlit crown!
    const col = py > cy + 0.15 ? palette[Math.floor(jr(0, 2.99))] : pick(palette);
    pushInst(`${batchPrefix}_pf`, puffGeo, sm.foliageInst,
      px, py, pz, jr(-0.25, 0.25), jr(0, TAU), jr(-0.25, 0.25),
      s * 1.22, s * 0.78, s * 1.15, col, parent);
  }
}

// ============================================================================
// 8. Cascading 3D Lavender-Violet Wisteria Blossom Racemes
// ============================================================================
export function buildWisteriaRacemes(THREE, K, opts = {}) {
  const {
    cx = 0, yTop = 2.8, cz = 0,
    spanX = 2.0, spanZ = 0.35,
    strands = 9, maxLen = 1.15,
    rotY = 0,
    parent = K.root,
    batchPrefix = 'wisteria',
  } = opts;
  const { pushInst, jr, pick } = K;
  const sm = getSkyMats(THREE, K);
  const beadGeo = () => sharedSkyGeo(THREE, 'sr_wist_bead', () => new THREE.DodecahedronGeometry(0.085, 0));

  const cY = Math.cos(rotY), sY = Math.sin(rotY);
  for (let i = 0; i < strands; i++) {
    const lx = (i / Math.max(1, strands - 1) - 0.5) * spanX + jr(-0.08, 0.08);
    const lz = jr(-spanZ * 0.5, spanZ * 0.5);
    const wx = cx + lx * cY + lz * sY;
    const wz = cz - lx * sY + lz * cY;
    const len = maxLen * jr(0.65, 1.12);
    const beads = Math.max(4, Math.floor(len / 0.13));
    // Leaf cap at top
    pushInst(`${batchPrefix}_wlf`, beadGeo, sm.foliageInst,
      wx, yTop + 0.04, wz, 0, jr(0, TAU), 0, 1.5, 0.75, 1.5, pick(MOSS_PAL), parent);
    for (let b = 0; b < beads; b++) {
      const f = b / beads;
      const sc = (1 - f * 0.58) * jr(0.95, 1.25);
      pushInst(`${batchPrefix}_wb`, beadGeo, sm.foliageInst,
        wx + jr(-0.025, 0.025), yTop - b * 0.125, wz + jr(-0.025, 0.025),
        jr(-0.2, 0.2), jr(0, TAU), jr(-0.2, 0.2),
        sc, sc * 1.18, sc, WISTERIA_PAL[Math.min(WISTERIA_PAL.length - 1, Math.floor(f * WISTERIA_PAL.length))], parent);
    }
  }
}

// ============================================================================
// 9. Signature Giant Luminous Celestia Sky-Orchid Cluster (Conservatory & Planters)
// ============================================================================
export function buildSkyOrchidCluster(THREE, K, opts = {}) {
  const {
    x = 0, y = 0.5, z = 0,
    count = 3, scale = 1.0, rotY = 0,
    parent = K.root,
  } = opts;
  const { add } = K;
  const sm = getSkyMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);
  parent.add(g);

  const petalGeo = sharedSkyGeo(THREE, 'sr_orchid_petal', () => {
    const s = new THREE.SphereGeometry(0.14, 8, 6);
    s.scale(0.62, 1.35, 0.18);
    return s;
  });
  const leafGeo = sharedSkyGeo(THREE, 'sr_orchid_leaf', () => {
    const s = new THREE.SphereGeometry(0.22, 8, 6);
    s.scale(0.45, 0.12, 1.35);
    return s;
  });

  for (let l = 0; l < 5; l++) {
    const a = (l / 5) * TAU;
    add(new THREE.Mesh(leafGeo, sm.mossGreen), Math.cos(a) * 0.18, 0.05, Math.sin(a) * 0.18, 0.25, -a + PI * 0.5, 0, g);
  }

  for (let k = 0; k < count; k++) {
    const ox = (k - (count - 1) * 0.5) * 0.26;
    const oy = 0.24 + (k % 2) * 0.14;
    const oz = (k % 2 === 0 ? 0.08 : -0.04);
    const fg = new THREE.Group();
    fg.position.set(ox, oy, oz);
    fg.rotation.set(0.35, (k - 1) * 0.42, 0);
    g.add(fg);
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * TAU;
      add(new THREE.Mesh(petalGeo, sm.orchidPetal), Math.sin(pa) * 0.11, Math.cos(pa) * 0.11, 0, -0.18, 0, -pa, fg);
    }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), sm.cyanCrystal), 0, 0, 0.03, 0, 0, 0, fg);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), sm.amberGlow), 0, -0.03, 0.055, 0, 0, 0, fg);
  }
  return g;
}

// ============================================================================
// 10. Faceted Double-Terminated Glowing Cyan Skyglass Crystal + Rune Rings
// ============================================================================
export function buildSkyglassCrystal(THREE, K, opts = {}) {
  const {
    x = 0, y = 1.6, z = 0,
    radius = 0.42, height = 1.35,
    rings = 2,
    parent = K.root,
  } = opts;
  const { add } = K;
  const sm = getSkyMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);

  const cGeo = sharedSkyGeo(THREE, `sr_levi_${radius.toFixed(2)}_${height.toFixed(2)}`, () => {
    const o = new THREE.OctahedronGeometry(1, 0);
    o.scale(radius, height * 0.55, radius);
    return o;
  });
  const innerGeo = sharedSkyGeo(THREE, `sr_levi_in_${radius.toFixed(2)}_${height.toFixed(2)}`, () => {
    const o = new THREE.OctahedronGeometry(1, 0);
    o.rotateY(PI * 0.25);
    o.scale(radius * 0.84, height * 0.50, radius * 0.84);
    return o;
  });

  const crystal = new THREE.Group();
  crystal.name = 'skyglassCrystal';
  add(new THREE.Mesh(cGeo, sm.cyanCrystal), 0, 0, 0, 0, 0, 0, crystal);
  add(new THREE.Mesh(innerGeo, sm.cyanSoft), 0, 0, 0, 0, 0, 0, crystal);
  g.add(crystal);

  const ringGroups = [];
  for (let r = 0; r < rings; r++) {
    const rg = new THREE.Group();
    rg.name = `runeRing_${r}`;
    const R = radius * (1.85 + r * 0.42);
    const bandGeo = new THREE.CylinderGeometry(R, R, 0.14, 28, 1, true);
    add(new THREE.Mesh(bandGeo, sm.runeFrieze), 0, 0, 0, 0, 0, 0, rg);
    for (const sy of [-1, 1]) {
      const rim = new THREE.TorusGeometry(R, 0.024, 6, 28);
      rim.rotateX(PI * 0.5);
      add(new THREE.Mesh(rim, sm.goldBrass), 0, sy * 0.072, 0, 0, 0, 0, rg);
    }
    rg.rotation.set(r === 0 ? 0.42 : -0.38, r * 0.8, r === 0 ? -0.26 : 0.34);
    g.add(rg);
    ringGroups.push(rg);
  }

  g.userData.crystal = crystal;
  g.userData.rings = ringGroups;
  return g;
}
