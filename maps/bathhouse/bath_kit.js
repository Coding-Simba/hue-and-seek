// ============================================================================
// Yu-Machi Spirit Bathhouse — Shared Handcrafted Storybook Architectural Kit
// Provides instanced 3D curved Kawara barrel-tile roofs, upturned temple eaves,
// Karahafu arched gables, mossy shoreline boulder foundations + hydrangeas,
// glowing Kumiko shoji & Marumado round lattice windows, Chochin & Toro lanterns,
// cascading 3D wisteria racemes, and high-res Storybook gouache canvases.
// ALL materials use metalness: 0 so gold, brass & copper glow warmly without HDRI!
// ============================================================================

import {
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
} from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

export const VERDIGRIS_PAL = [0x46b39f, 0x56c4af, 0x3b9d8c, 0x67ceb8, 0x4dbba7, 0x3ea695];
export const INDIGO_SLATE_PAL = [0x4c5d92, 0x5c6fa8, 0x404f7e, 0x6c80ba, 0x53669c, 0x455688];
export const STONE_BOULDER_PAL = [0x8b8896, 0x7c7988, 0x9c96a4, 0x6f737e, 0x858a84, 0x988f96];
export const MOSS_BOULDER_PAL = [0x6c8e58, 0x7a9d62, 0x5d7d4c, 0x86ab6a];
export const HYDRANGEA_PAL = [0x9f74eb, 0xb98dff, 0x8462d8, 0xd2a8ff, 0x7c86f2];
export const WISTERIA_PAL = [0xb57cf5, 0xcf98ff, 0x9b62e2, 0xe4b8ff, 0xf2ccf8];
export const SAKURA_PAL = [0xffb2cc, 0xffcce0, 0xf48fb4, 0xffe0ec];
export const FOLIAGE_PAL = [0x4d8c42, 0x5ea24e, 0x3f7836, 0x72b65c];

let _texCache = null;
const _geoCache = new WeakMap();

function sharedGeo(THREE, key, make) {
  let m = _geoCache.get(THREE);
  if (!m) { m = {}; _geoCache.set(THREE, m); }
  return m[key] || (m[key] = make());
}

export function getBathTextures(THREE) {
  if (_texCache) return _texCache;

  // 1. Warm amber Kumiko Shoji paper with subtle mulberry fiber & warm bottom glow
  const shojiPaper = paintedCanvasTex(THREE, 'bh2_shoji_paper', 256, (ctx, s, rng) => {
    const w = s, h = s;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffe094');
    grd.addColorStop(0.55, '#ffd068');
    grd.addColorStop(1, '#ffb33e');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 180, ['#ffebb0', '#ffc454', '#fff3c8'], 2, 6, 0.25);
  }, 1, 1);

  // 2. Woven green Igusa Tatami mat with dark indigo-Gold brocade border
  const tatami = paintedCanvasTex(THREE, 'bh2_tatami', 256, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#b9be78';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(154,162,92,0.45)' : 'rgba(208,212,146,0.35)';
      ctx.fillRect(0, y, w, 2);
    }
    brushStrokes(ctx, w, rng, 110, ['#c8cc88', '#a4ab66'], 2, 4, 0.2);
    ctx.fillStyle = '#28364e';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
    ctx.fillRect(0, 0, 12, h);
    ctx.fillRect(w - 12, 0, 12, h);
    ctx.strokeStyle = '#d8aa48';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }, 2, 2);

  // 3. Onsen purple Noren curtain with crisp white steaming ♨ mark & wave trim
  const norenOnsen = paintedCanvasTex(THREE, 'bh2_noren_onsen', 256, (ctx, s, rng) => {
    const w = s, h = s;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#442b68');
    grd.addColorStop(1, '#5d3c8c');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 140, ['#6a469c', '#382258', '#52347c'], 3, 7, 0.24);
    ctx.strokeStyle = '#d9b464';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, h - 16); ctx.lineTo(w, h - 16);
    ctx.stroke();
    ctx.strokeStyle = '#fff6e4';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.62, 52, 0.12 * PI, 0.88 * PI, false);
    ctx.stroke();
    ctx.lineWidth = 10;
    for (const dx of [-28, 0, 28]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + dx, h * 0.58);
      ctx.bezierCurveTo(w * 0.5 + dx - 16, h * 0.44, w * 0.5 + dx + 16, h * 0.34, w * 0.5 + dx - 4, h * 0.20);
      ctx.stroke();
    }
  });

  // 4. Indigo Ramen Bowl Noren banner (matches Ramen Izakaya left banner!)
  const norenRamen = paintedCanvasTex(THREE, 'bh2_noren_ramen', 256, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#2d3b6e';
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 130, ['#3b4d88', '#232e58'], 3, 6, 0.25);
    ctx.fillStyle = '#fff4dc';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.56, 60, 0, PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(w * 0.5 - 28, h * 0.56 + 56, 56, 10);
    ctx.strokeStyle = '#2d3b6e';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(w * 0.5 - 56, h * 0.62); ctx.lineTo(w * 0.5 + 56, h * 0.62); ctx.stroke();
    ctx.strokeStyle = '#fff4dc';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    for (const dx of [-24, 0, 24]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + dx, h * 0.48);
      ctx.bezierCurveTo(w * 0.5 + dx - 14, h * 0.36, w * 0.5 + dx + 14, h * 0.26, w * 0.5 + dx, h * 0.15);
      ctx.stroke();
    }
  });

  // 5. Indigo Steamed Pork-Bun (Nikuman) Noren banner (matches Ramen Izakaya right banner!)
  const norenBun = paintedCanvasTex(THREE, 'bh2_noren_bun', 256, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#2d3b6e';
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 130, ['#3b4d88', '#232e58'], 3, 6, 0.25);
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.58, 64, 46, 0, PI, TAU);
    ctx.ellipse(w * 0.5, h * 0.58, 64, 18, 0, 0, PI);
    ctx.fill();
    ctx.strokeStyle = '#b98f58';
    ctx.lineWidth = 5;
    for (const a of [-0.6, -0.2, 0.2, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.30);
      ctx.quadraticCurveTo(w * 0.5 + a * 44, h * 0.44, w * 0.5 + a * 58, h * 0.55);
      ctx.stroke();
    }
  });

  // 6. Cream Kakehi Onsen Noren (for Rotenburo bamboo spout shelter)
  const norenCream = paintedCanvasTex(THREE, 'bh2_noren_cream', 256, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#f8ecd2';
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 100, ['#fff6e4', '#ead8b8'], 3, 6, 0.25);
    ctx.strokeStyle = '#7a3e26';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, 46, 0.12 * PI, 0.88 * PI); ctx.stroke();
    for (const dx of [-24, 0, 24]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + dx, h * 0.56);
      ctx.bezierCurveTo(w * 0.5 + dx - 12, h * 0.42, w * 0.5 + dx + 12, h * 0.32, w * 0.5 + dx, h * 0.20);
      ctx.stroke();
    }
  });

  // 7. High-Res 512px Mt. Fuji & Great Wave Bathhouse Mural (interiors_sheet Panel 1!)
  const fujiMural = paintedCanvasTex(THREE, 'bh2_fuji_mural', 512, (ctx, s, rng) => {
    const w = s, h = s;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f4d998');
    sky.addColorStop(0.52, '#f9e9be');
    sky.addColorStop(1, '#cfe4e8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 180, ['#fae8b6', '#eed08a', '#fff4d2'], 4, 9, 0.25);

    // Golden stylized Storybook clouds
    ctx.fillStyle = '#e8b952';
    for (const [cx, cy, rx, ry] of [[0.20, 0.24, 68, 18], [0.80, 0.20, 74, 18], [0.72, 0.48, 86, 20]]) {
      ctx.beginPath(); ctx.ellipse(w * cx, h * cy, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * cx - rx * 0.35, h * cy - ry * 0.55, rx * 0.55, ry * 0.85, 0, 0, TAU); ctx.fill();
    }

    // Snow-capped Mt. Fuji in Prussian blue & warm snow
    ctx.fillStyle = '#325688';
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.72);
    ctx.quadraticCurveTo(w * 0.42, h * 0.52, w * 0.50, h * 0.24);
    ctx.lineTo(w * 0.60, h * 0.24);
    ctx.quadraticCurveTo(w * 0.68, h * 0.52, w * 0.94, h * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff9ec';
    ctx.beginPath();
    ctx.moveTo(w * 0.43, h * 0.40);
    ctx.lineTo(w * 0.50, h * 0.24);
    ctx.lineTo(w * 0.60, h * 0.24);
    ctx.lineTo(w * 0.67, h * 0.40);
    ctx.lineTo(w * 0.61, h * 0.36);
    ctx.lineTo(w * 0.57, h * 0.43);
    ctx.lineTo(w * 0.53, h * 0.36);
    ctx.lineTo(w * 0.48, h * 0.42);
    ctx.closePath();
    ctx.fill();

    // Rolling Hokusai Great Waves & white foam claws on left + foreground
    ctx.fillStyle = '#1e4678';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.46);
    ctx.bezierCurveTo(w * 0.14, h * 0.30, w * 0.34, h * 0.34, w * 0.38, h * 0.54);
    ctx.bezierCurveTo(w * 0.24, h * 0.48, w * 0.18, h * 0.62, w * 0.36, h * 0.68);
    ctx.quadraticCurveTo(w * 0.66, h * 0.58, w, h * 0.72);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3b73a8';
    for (const [wx, wy, wr] of [[0.18, 0.78, 72], [0.46, 0.82, 84], [0.76, 0.80, 78]]) {
      ctx.beginPath(); ctx.arc(w * wx, h * wy, wr, PI, TAU); ctx.fill();
    }
    ctx.fillStyle = '#fff9ec';
    for (let i = 0; i < 16; i++) {
      const fx = w * (0.08 + i * 0.056), fy = h * (0.50 + Math.sin(i * 0.9) * 0.16);
      ctx.beginPath(); ctx.arc(fx, fy, 9 + (i % 3) * 4, 0, TAU); ctx.fill();
    }
  });

  // 8. Gold-Leaf Pine & Cloud Byobu Screen (interiors_sheet Panel 4!)
  const goldPineScreen = paintedCanvasTex(THREE, 'bh2_gold_pine_byobu', 512, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#e7ba52';
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = rng.pick(['#f0c665', '#dfb048', '#f5d278', '#d6a43e']);
      ctx.fillRect((c * w) / 6, (r * h) / 6, w / 6 + 1, h / 6 + 1);
    }
    brushStrokes(ctx, w, rng, 150, ['#fae094', '#cfa03c'], 3, 7, 0.24);
    // Stylized golden mist bands
    ctx.fillStyle = 'rgba(255,242,190,0.65)';
    for (const [cx, cy, rx, ry] of [[0.25, 0.24, 95, 18], [0.75, 0.30, 105, 18], [0.55, 0.78, 120, 20]]) {
      ctx.beginPath(); ctx.ellipse(w * cx, h * cy, rx, ry, 0, 0, TAU); ctx.fill();
    }
    // Gnarled pine trunk & layered green pine pads across panels
    ctx.strokeStyle = '#5a3620';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.94);
    ctx.bezierCurveTo(w * 0.28, h * 0.68, w * 0.45, h * 0.56, w * 0.82, h * 0.44);
    ctx.stroke();
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.64);
    ctx.quadraticCurveTo(w * 0.20, h * 0.48, w * 0.12, h * 0.40);
    ctx.stroke();
    for (const [px, py, rx, ry] of [
      [0.16, 0.38, 68, 22], [0.38, 0.46, 84, 25], [0.62, 0.40, 88, 26],
      [0.82, 0.42, 72, 22], [0.48, 0.62, 74, 22], [0.72, 0.56, 68, 20],
    ]) {
      ctx.fillStyle = '#2f5830';
      ctx.beginPath(); ctx.ellipse(w * px, h * py + 4, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#588c44';
      ctx.beginPath(); ctx.ellipse(w * px, h * py - 3, rx * 0.88, ry * 0.8, 0, 0, TAU); ctx.fill();
    }
  });

  // 9. Floral Pink Sakura & Purple Wisteria Silk Kimono Patterns (Panel 4!)
  const makeKimonoTex = (key, base, hi, fl1, fl2) => paintedCanvasTex(THREE, key, 256, (ctx, s, rng) => {
    const w = s, h = s;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, base);
    grd.addColorStop(1, hi);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 120, [base, hi], 3, 6, 0.3);
    // Gold wave hem + scattered blossoms
    ctx.strokeStyle = '#f4cc68';
    ctx.lineWidth = 3;
    for (let x = 0; x < w; x += 36) {
      ctx.beginPath(); ctx.arc(x, h * 0.86, 22, PI, TAU); ctx.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const fx = rng.jr(16, w - 16), fy = rng.jr(16, h - 24), fr = rng.jr(7, 15);
      ctx.fillStyle = i % 2 === 0 ? fl1 : fl2;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * fr * 0.55, fy + Math.sin(a) * fr * 0.55, fr * 0.45, fr * 0.3, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe680';
      ctx.beginPath(); ctx.arc(fx, fy, fr * 0.22, 0, TAU); ctx.fill();
    }
  });
  const kimonoPink = makeKimonoTex('bh2_kimono_pink', '#e85d88', '#b83868', '#ffd8e8', '#ffe078');
  const kimonoPurple = makeKimonoTex('bh2_kimono_purple', '#6c48a8', '#482e82', '#e8c4ff', '#ffd670');

  // 10. Sacred Tomoe Taiko Drumhead (Shrine Panel 5!)
  const taikoHead = paintedCanvasTex(THREE, 'bh2_taiko_head', 256, (ctx, s, rng) => {
    const w = s, h = s;
    const grd = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.5);
    grd.addColorStop(0, '#fff4dc');
    grd.addColorStop(0.78, '#ebd4ad');
    grd.addColorStop(1, '#be9662');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 80, ['#fff8e8', '#dfc49a'], 2, 5, 0.22);
    const cx = w * 0.5, cy = h * 0.5, R = w * 0.33;
    ctx.strokeStyle = '#7c2d1c';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#7c2d1c';
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i * TAU) / 3 - 0.3);
      ctx.beginPath(); ctx.arc(0, -R * 0.46, R * 0.34, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.88, -PI * 0.52, PI * 0.08, false);
      ctx.arc(R * 0.16, -R * 0.14, R * 0.58, PI * 0.12, -PI * 0.42, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  // 11. Warm Kiln Red-Brick Texture (Boiler Tower Panel 3!)
  const warmBrick = paintedCanvasTex(THREE, 'bh2_warm_brick', 256, (ctx, s, rng) => {
    const w = s, h = s;
    ctx.fillStyle = '#6c4c42';
    ctx.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, bh = h / rows, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = rng.pick(['#b84a39', '#c85843', '#9f3d2e', '#d0664e', '#a84334']);
        ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    brushStrokes(ctx, w, rng, 120, ['#d87458', '#8a3326'], 2, 4, 0.2);
  }, 2, 2);

  _texCache = {
    shojiPaper,
    tatami,
    norenOnsen,
    norenRamen,
    norenBun,
    norenCream,
    fujiMural,
    goldPineScreen,
    kimonoPink,
    kimonoPurple,
    taikoHead,
    warmBrick,
  };
  return _texCache;
}

// ============================================================================
// Standard Bathhouse Palette Materials (100% metalness: 0 for warm Storybook look!)
// ============================================================================
export function getBathMats(THREE, K) {
  const { M, glowMat, tex } = K;
  const BT = getBathTextures(THREE);
  return {
    BT,
    vermilion: M(0xd43b2f, tex('painted_metal', 1.4, 1.4), { roughness: 0.58, metalness: 0 }),
    vermilionDeep: M(0xa62820, tex('wood_light', 1.4, 1.4), { roughness: 0.65, metalness: 0 }),
    cedar: M(0xc8884e, tex('wood_light', 1.6, 1.6), { roughness: 0.78, metalness: 0 }),
    hinoki: M(0xe6b87c, tex('wood_light', 1.4, 1.4), { roughness: 0.76, metalness: 0 }),
    darkTimber: M(0x5a3622, tex('wood_planks_dark', 1.4, 1.4), { roughness: 0.82, metalness: 0 }),
    rafterWood: M(0x7c4b2b, tex('wood_light', 1.4, 1.4), { roughness: 0.80, metalness: 0 }),
    creamPlaster: M(0xf6e6c8, tex('plaster', 1.5, 1.5), { roughness: 0.90, metalness: 0 }),
    warmInnerWall: M(0xf2dbb6, tex('plaster', 1.6, 1.6), { roughness: 0.90, metalness: 0 }),
    stoneFloor: M(0x9e95a4, tex('stone', 2.4, 2.4), { roughness: 0.86, metalness: 0 }),
    mossStone: M(0x7d8882, tex('stone', 1.6, 1.6), { roughness: 0.88, metalness: 0 }),
    warmBrick: M(0xffffff, BT.warmBrick, { roughness: 0.85, metalness: 0 }),
    tatami: M(0xffffff, BT.tatami, { roughness: 0.88, metalness: 0 }),
    goldTrim: M(0xf4c44e, null, { roughness: 0.42, metalness: 0, emissive: 0x8c5c10, emissiveIntensity: 0.22 }),
    brassWarm: M(0xe2a83c, null, { roughness: 0.46, metalness: 0, emissive: 0x6e440c, emissiveIntensity: 0.16 }),
    copperWarm: M(0xc96e42, tex('painted_metal', 1.6, 1.6), { roughness: 0.48, metalness: 0, emissive: 0x4a1e0c, emissiveIntensity: 0.12 }),
    ironWarm: M(0x524644, tex('painted_metal', 1.6, 1.6), { roughness: 0.65, metalness: 0 }),
    shojiGlow: glowMat(0xffe49c, 0xffaa36, 1.45, { map: BT.shojiPaper, roughness: 0.55 }),
    lanternGlow: glowMat(0xffea9f, 0xff9e2c, 1.85, { roughness: 0.45 }),
    chochinRedGlow: glowMat(0xff7448, 0xff3b18, 1.65, { roughness: 0.5 }),
    chochinGoldGlow: glowMat(0xffe07d, 0xff9d24, 1.75, { roughness: 0.5 }),
    waterGlow: glowMat(0x6ce8e0, 0x24a4b4, 0.92, { roughness: 0.22 }),
    fireGlow: glowMat(0xffbe58, 0xff5a10, 2.35, { roughness: 0.5 }),
    steamWisps: M(0xf6f8ff, null, { transparent: true, opacity: 0.36, roughness: 1, depthWrite: false }),
    whiteInst: M(0xffffff, null, { roughness: 0.82, metalness: 0 }),
    tileInst: M(0xffffff, tex('plaster', 0.45, 0.45), { roughness: 0.66, metalness: 0 }),
    stoneInst: M(0xffffff, tex('plaster', 0.55, 0.55), { roughness: 0.88, metalness: 0 }),
    leafInst: M(0xffffff, null, { roughness: 0.86, metalness: 0, side: THREE.DoubleSide }),
  };
}

// ============================================================================
// 1. Handcrafted 3D Instanced Japanese Kawara Tiled Gable / Hip-Gable Roof
// Renders hundreds of real 3D curved barrel tiles + round nokimaru eave caps +
// upturned eaves rafters + stacked cylindrical ridge + golden onigawara finials!
// ============================================================================
export function buildKawaraGableRoof(THREE, K, opts = {}) {
  const {
    cx = 0, cz = 0, yBase = 3.6,
    spanX = 8.6, spanZ = 7.4, rise = 2.05,
    overhangX = 0.85, overhangZ = 0.78,
    ridgeAlongX = true, // true: ridge runs along X (front/back slopes face ±Z); false: gable faces +Z!
    palette = VERDIGRIS_PAL,
    underMat, timberMat, goldMat, tileMat,
    finial = 'onigawara', // 'onigawara' | 'crescent' | 'jewel' | 'none'
    parent = K.roofG,
    batchPrefix = 'kawara',
  } = opts;

  const { add, rbox, pushInst, jr, pick } = K;
  const bm = getBathMats(THREE, K);
  const uMat = underMat || bm.darkTimber;
  const tMat = timberMat || bm.rafterWood;
  const gMat = goldMat || bm.goldTrim;
  const iMat = tileMat || bm.tileInst;

  const halfRun = (ridgeAlongX ? spanZ : spanX) * 0.5 + (ridgeAlongX ? overhangZ : overhangX);
  const ridgeLen = (ridgeAlongX ? spanX : spanZ) + (ridgeAlongX ? overhangX : overhangZ) * 2;
  const theta = Math.atan2(rise, halfRun * 0.86);
  const slopeLen = Math.hypot(halfRun, rise);
  const ridgeY = yBase + rise;

  // Curved barrel tile unit geometry (oriented along local Z down-slope — ultra crisp & mobile-fast!)
  const barrelGeo = () => sharedGeo(THREE, 'bh_kawara_barrel', () => {
    const g = new THREE.CylinderGeometry(0.13, 0.145, 0.43, 5, 1, false, 0, PI);
    g.rotateX(PI * 0.5);
    return g;
  });
  const panGeo = () => sharedGeo(THREE, 'bh_kawara_pan', () => new THREE.BoxGeometry(0.30, 0.032, 0.43));
  const capGeo = () => sharedGeo(THREE, 'bh_kawara_cap', () => {
    const g = new THREE.CylinderGeometry(0.095, 0.095, 0.06, 8);
    g.rotateX(PI * 0.5);
    return g;
  });

  // Supporting dark eaves deck + exposed rafters + upturned flying corner eaves
  for (const side of [-1, 1]) {
    const midOff = halfRun * 0.5;
    const midY = ridgeY - rise * 0.52 - 0.08;
    if (ridgeAlongX) {
      add(rbox(ridgeLen - 0.08, 0.11, slopeLen, 0.03, uMat), cx, midY, cz + side * midOff, side * theta, 0, 0, parent);
      // Exposed Storybook eave rafter tails (taruki)
      const nRafters = Math.max(6, Math.floor(ridgeLen / 0.62));
      for (let i = 0; i <= nRafters; i++) {
        const rx = cx - ridgeLen * 0.48 + (i / nRafters) * ridgeLen * 0.96;
        add(rbox(0.085, 0.085, 0.56, 0.02, tMat), rx, yBase - 0.03, cz + side * (halfRun - 0.18), side * (theta * 0.72), 0, 0, parent);
      }
      //Fascia eave board
      add(rbox(ridgeLen + 0.08, 0.13, 0.09, 0.025, tMat), cx, yBase + 0.03, cz + side * halfRun, 0, 0, 0, parent);
    } else {
      add(rbox(slopeLen, 0.11, ridgeLen - 0.08, 0.03, uMat), cx + side * midOff, midY, cz, 0, 0, -side * theta, parent);
      const nRafters = Math.max(6, Math.floor(ridgeLen / 0.62));
      for (let i = 0; i <= nRafters; i++) {
        const rz = cz - ridgeLen * 0.48 + (i / nRafters) * ridgeLen * 0.96;
        add(rbox(0.56, 0.085, 0.085, 0.02, tMat), cx + side * (halfRun - 0.18), yBase - 0.03, rz, 0, 0, -side * (theta * 0.72), parent);
      }
      add(rbox(0.09, 0.13, ridgeLen + 0.08, 0.025, tMat), cx + side * halfRun, yBase + 0.03, cz, 0, 0, 0, parent);
      // Ornate gable bargeboards (hafaita) on ±Z gable ends
      for (const gz of [-1, 1]) {
        add(rbox(slopeLen + 0.16, 0.24, 0.12, 0.03, bm.vermilion),
          cx + side * midOff, midY + 0.02, cz + gz * (ridgeLen * 0.5 + 0.02), 0, 0, -side * theta, parent);
      }
    }

    // Instanced 3D Kawara tiles down each slope with authentic Japanese upturned sori curve!
    const stepDown = 0.34, colStep = 0.31;
    const rows = Math.max(3, Math.floor((slopeLen - 0.12) / stepDown));
    const cols = Math.max(4, Math.floor((ridgeLen - 0.16) / colStep));

    for (let r = 0; r < rows; r++) {
      const f = (r + 0.5) / rows; // 0 near ridge -> 1 at eave
      // Japanese temple sori curve: steeper near ridge, graceful upward flare near eave!
      const soriLift = Math.pow(f, 2.3) * 0.22;
      const localPitch = theta * (1.08 - 0.34 * Math.pow(f, 1.5));
      const runDist = f * halfRun;
      const yRow = ridgeY - f * rise + soriLift + 0.04;

      for (let c = 0; c < cols; c++) {
        const along = -ridgeLen * 0.5 + colStep * 0.55 + c * colStep + jr(-0.01, 0.01);
        const colHex = pick(palette);
        if (ridgeAlongX) {
          const tx = cx + along, tz = cz + side * runDist;
          pushInst(`${batchPrefix}_pan`, panGeo, iMat, tx, yRow - 0.02, tz,
            side * localPitch, jr(-0.02, 0.02), jr(-0.02, 0.02), 1, 1, 1, colHex, parent);
          pushInst(`${batchPrefix}_brl`, barrelGeo, iMat, tx + colStep * 0.5, yRow + 0.02, tz,
            side * localPitch, jr(-0.025, 0.025), jr(-0.02, 0.02), 0.72, 0.85, 1.02, colHex, parent);
          if (r === rows - 1) {
            pushInst(`${batchPrefix}_cap`, capGeo, gMat, tx + colStep * 0.5, yRow + 0.04, cz + side * (halfRun + 0.09),
              0, 0, 0, 0.85, 0.85, 1, 0xffffff, parent);
          }
        } else {
          const tx = cx + side * runDist, tz = cz + along;
          pushInst(`${batchPrefix}_pan`, panGeo, iMat, tx, yRow - 0.02, tz,
            jr(-0.02, 0.02), PI * 0.5, -side * localPitch, 1, 1, 1, colHex, parent);
          pushInst(`${batchPrefix}_brl`, barrelGeo, iMat, tx, yRow + 0.02, tz + colStep * 0.5,
            jr(-0.02, 0.02), PI * 0.5, -side * localPitch, 0.72, 0.85, 1.02, colHex, parent);
          if (r === rows - 1) {
            pushInst(`${batchPrefix}_cap`, capGeo, gMat, cx + side * (halfRun + 0.09), yRow + 0.04, tz + colStep * 0.5,
              0, PI * 0.5, 0, 0.85, 0.85, 1, 0xffffff, parent);
          }
        }
      }
    }
  }

  // Stacked 3D Kawara Mune Ridge Beam + Cylindrical Ridge Tiles + Golden End Finials
  const rCount = Math.max(5, Math.floor(ridgeLen / 0.30));
  const ridgeCapGeo = () => sharedGeo(THREE, 'bh_ridge_cyl', () => {
    const g = new THREE.CylinderGeometry(0.19, 0.21, 0.28, 8, 1, false, 0, PI);
    g.rotateZ(PI * 0.5);
    return g;
  });

  if (ridgeAlongX) {
    add(rbox(ridgeLen + 0.22, 0.22, 0.30, 0.06, uMat), cx, ridgeY + 0.08, cz, 0, 0, 0, parent);
    add(rbox(ridgeLen + 0.28, 0.055, 0.14, 0.02, gMat), cx, ridgeY + 0.21, cz, 0, 0, 0, parent);
    for (let i = 0; i < rCount; i++) {
      const rx = cx - ridgeLen * 0.48 + (i / Math.max(1, rCount - 1)) * ridgeLen * 0.96;
      pushInst(`${batchPrefix}_rcap`, ridgeCapGeo, iMat, rx, ridgeY + 0.18, cz, 0, PI * 0.5, 0, 1, 1, 1, pick(palette), parent);
    }
    for (const sx of [-1, 1]) {
      const fx = cx + sx * (ridgeLen * 0.5 + 0.08);
      add(rbox(0.24, 0.44, 0.34, 0.06, gMat), fx, ridgeY + 0.32, cz, 0, 0, -sx * 0.18, parent);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), gMat), fx + sx * 0.05, ridgeY + 0.60, cz, 0, 0, 0, parent);
    }
  } else {
    add(rbox(0.30, 0.22, ridgeLen + 0.22, 0.06, uMat), cx, ridgeY + 0.08, cz, 0, 0, 0, parent);
    add(rbox(0.14, 0.055, ridgeLen + 0.28, 0.02, gMat), cx, ridgeY + 0.21, cz, 0, 0, 0, parent);
    for (let i = 0; i < rCount; i++) {
      const rz = cz - ridgeLen * 0.48 + (i / Math.max(1, rCount - 1)) * ridgeLen * 0.96;
      pushInst(`${batchPrefix}_rcap`, ridgeCapGeo, iMat, cx, ridgeY + 0.18, rz, 0, 0, 0, 1, 1, 1, pick(palette), parent);
    }
    for (const sz of [-1, 1]) {
      const fz = cz + sz * (ridgeLen * 0.5 + 0.08);
      add(rbox(0.34, 0.44, 0.24, 0.06, gMat), cx, ridgeY + 0.32, fz, sz * 0.18, 0, 0, parent);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), gMat), cx, ridgeY + 0.60, fz + sz * 0.05, 0, 0, 0, parent);
      // Decorative golden gegyo pendant on front/back gable peak
      add(rbox(0.42, 0.34, 0.08, 0.03, gMat), cx, ridgeY - 0.18, fz + sz * 0.04, 0, 0, PI * 0.25, parent);
    }
  }

  // Optional center crown finial (crescent moon for Shrine, golden flame jewel for Bathhouse)
  if (finial === 'crescent') {
    const fz = ridgeAlongX ? cz : cz + ridgeLen * 0.42;
    add(rbox(0.44, 0.24, 0.28, 0.05, gMat), cx, ridgeY + 0.32, fz, 0, 0, 0, parent);
    const outer = new THREE.Shape();
    outer.absarc(0, 0, 0.52, -0.35 * PI, 1.35 * PI, false);
    const crescentPts = [];
    for (let i = 0; i <= 24; i++) {
      const a = -0.78 * PI + (i / 24) * 1.56 * PI;
      crescentPts.push(new THREE.Vector2(Math.sin(a) * 0.52, -Math.cos(a) * 0.52));
    }
    for (let i = 24; i >= 0; i--) {
      const a = -0.68 * PI + (i / 24) * 1.36 * PI;
      crescentPts.push(new THREE.Vector2(Math.sin(a) * 0.34, 0.18 - Math.cos(a) * 0.36));
    }
    const cShape = new THREE.Shape(crescentPts);
    const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2 });
    cGeo.translate(0, 0, -0.06);
    add(new THREE.Mesh(cGeo, gMat), cx, ridgeY + 0.86, fz, 0, 0, 0, parent);
  } else if (finial === 'jewel') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.22, 10), gMat), cx, ridgeY + 0.30, cz, 0, 0, 0, parent);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), gMat), cx, ridgeY + 0.52, cz, 0, 0, 0, parent);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 10), gMat), cx, ridgeY + 0.78, cz, 0, 0, 0, parent);
  }

  return { ridgeY, halfRun, ridgeLen, theta };
}

// ============================================================================
// 2. Single-Slope Pent Awning Roof (Hisashi) with 3D Instanced Kawara Tiles
// ============================================================================
export function buildKawaraPentAwning(THREE, K, opts = {}) {
  const {
    cx = 0, zWall = 3.5, yWall = 2.85,
    width = 7.8, depth = 1.45, drop = 0.52,
    palette = VERDIGRIS_PAL,
    parent = K.root,
    batchPrefix = 'pent',
  } = opts;
  const { add, rbox, pushInst, jr, pick } = K;
  const bm = getBathMats(THREE, K);
  const theta = Math.atan2(drop, depth);
  const slopeLen = Math.hypot(depth, drop);

  add(rbox(width, 0.09, slopeLen, 0.025, bm.darkTimber), cx, yWall - drop * 0.5, zWall + depth * 0.5, theta, 0, 0, parent);
  add(rbox(width + 0.12, 0.11, 0.08, 0.02, bm.rafterWood), cx, yWall - drop + 0.02, zWall + depth, 0, 0, 0, parent);

  const panGeo = () => sharedGeo(THREE, 'bh_kawara_pan', () => new THREE.BoxGeometry(0.30, 0.032, 0.43));
  const barrelGeo = () => sharedGeo(THREE, 'bh_kawara_barrel', () => {
    const g = new THREE.CylinderGeometry(0.13, 0.145, 0.43, 5, 1, false, 0, PI);
    g.rotateX(PI * 0.5);
    return g;
  });
  const capGeo = () => sharedGeo(THREE, 'bh_kawara_cap', () => {
    const g = new THREE.CylinderGeometry(0.095, 0.095, 0.06, 8);
    g.rotateX(PI * 0.5);
    return g;
  });

  const rows = Math.max(2, Math.floor(slopeLen / 0.33));
  const cols = Math.max(4, Math.floor((width - 0.1) / 0.31));
  for (let r = 0; r < rows; r++) {
    const f = (r + 0.5) / rows;
    const tz = zWall + f * depth;
    const ty = yWall - f * drop + Math.pow(f, 2) * 0.06 + 0.05;
    for (let c = 0; c < cols; c++) {
      const tx = cx - width * 0.5 + 0.18 + c * 0.31 + jr(-0.01, 0.01);
      const col = pick(palette);
      pushInst(`${batchPrefix}_pan`, panGeo, bm.tileInst, tx, ty - 0.02, tz, theta * 0.88, 0, 0, 1, 1, 1, col, parent);
      pushInst(`${batchPrefix}_brl`, barrelGeo, bm.tileInst, tx + 0.155, ty + 0.02, tz, theta * 0.88, 0, 0, 0.70, 0.82, 0.96, col, parent);
      if (r === rows - 1) {
        pushInst(`${batchPrefix}_cap`, capGeo, bm.goldTrim, tx + 0.155, ty + 0.03, zWall + depth + 0.08, 0, 0, 0, 0.82, 0.82, 1, 0xffffff, parent);
      }
    }
  }
}

// ============================================================================
// 3. Sweeping Curved Japanese Karahafu Entrance Gable (Onsen Pavilion Hero!)
// ============================================================================
export function buildCurvedKarahafuGable(THREE, K, opts = {}) {
  const {
    cx = 0, zFront = 4.3, yBase = 2.95,
    width = 4.2, archRise = 1.28, depth = 1.35,
    palette = VERDIGRIS_PAL,
    parent = K.root,
  } = opts;
  const { add, rbox, pushInst, pick } = K;
  const bm = getBathMats(THREE, K);

  // Bell-shaped Karahafu curve (convex center arch, flared upturned wings)
  const curvePts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * 2 - 1; // -1 .. +1
    const bell = Math.cos(u * PI * 0.5);
    const wingFlare = Math.pow(Math.abs(u), 3) * 0.24;
    const y = yBase + bell * bell * archRise + wingFlare;
    curvePts.push(new THREE.Vector3(cx + u * (width * 0.5), y, zFront));
  }
  const archCurve = new THREE.CatmullRomCurve3(curvePts);

  // Thick vermilion & dark-timber curved bargeboards + gleaming golden rim
  add(new THREE.Mesh(new THREE.TubeGeometry(archCurve, 32, 0.14, 8, false), bm.vermilion), 0, 0, depth * 0.45, 0, 0, 0, parent);
  add(new THREE.Mesh(new THREE.TubeGeometry(archCurve, 32, 0.065, 8, false), bm.goldTrim), 0, -0.05, depth * 0.52, 0, 0, 0, parent);

  // Extruded curved roof canopy + instanced verdigris tiles along the arch
  const barrelGeo = () => sharedGeo(THREE, 'bh_kawara_barrel', () => {
    const g = new THREE.CylinderGeometry(0.145, 0.16, 0.44, 7, 1, false, 0, PI);
    g.rotateX(PI * 0.5);
    return g;
  });
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const p = archCurve.getPoint(t);
    const tan = archCurve.getTangent(t);
    const rz = Math.atan2(tan.y, tan.x);
    for (let r = 0; r < 3; r++) {
      pushInst('kara_brl', barrelGeo, bm.tileInst,
        p.x, p.y + 0.11, zFront - depth * 0.35 + r * 0.38,
        0.08, 0, rz, 0.72, 0.85, 0.95, pick(palette), parent);
    }
  }

  // Ornate sculpted 3D golden chrysanthemum & cloud crest inside the Karahafu tympanum!
  const tymY = yBase + archRise * 0.56, tymZ = zFront + depth * 0.40;
  add(rbox(width * 0.52, archRise * 0.52, 0.10, 0.03, bm.darkTimber), cx, tymY - 0.04, tymZ - 0.08, 0, 0, 0, parent);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), bm.goldTrim), cx, tymY + 0.06, tymZ, 0, 0, 0, parent);
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * TAU;
    add(rbox(0.11, 0.28, 0.07, 0.03, bm.goldTrim),
      cx + Math.cos(a) * 0.22, tymY + 0.06 + Math.sin(a) * 0.20, tymZ - 0.01, 0, 0, a, parent);
  }
  for (const sx of [-1, 1]) {
    const scroll = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + sx * 0.22, tymY + 0.02, tymZ),
      new THREE.Vector3(cx + sx * 0.58, tymY - 0.08, tymZ),
      new THREE.Vector3(cx + sx * 0.92, tymY - 0.22, tymZ),
      new THREE.Vector3(cx + sx * 0.78, tymY - 0.32, tymZ + 0.02),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(scroll, 14, 0.048, 7, false), bm.goldTrim), 0, 0, 0, 0, 0, 0, parent);
  }
  // Crown golden ridge jewel atop Karahafu peak
  add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bm.goldTrim), cx, yBase + archRise + 0.22, zFront + depth * 0.42, 0, 0, 0, parent);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.28, 8), bm.goldTrim), cx, yBase + archRise + 0.42, zFront + depth * 0.42, 0, 0, 0, parent);
}

// ============================================================================
// 4. Mossy Shoreline Stone Foundation, Steps & Hydrangea Clusters
// Matches the rounded Storybook waterside rockwork under EVERY building in buildings_sheet.png!
// ============================================================================
export function buildMossyStonePlinth(THREE, K, opts = {}) {
  const {
    w = 9.0, d = 7.6, h = 0.42,
    doorX = 0, doorW = 2.0,
    steps = 3,
    hydrangeas = true,
    parent = K.root,
  } = opts;
  const { add, rbox, pushInst, jr, pick } = K;
  const bm = getBathMats(THREE, K);

  // Core stone platform slab
  add(rbox(w + 0.28, h, d + 0.28, 0.08, bm.stoneFloor), 0, h * 0.5 - 0.04, 0, 0, 0, 0, parent);

  const rockGeo = () => sharedGeo(THREE, 'bh_plinth_rock', () => new THREE.DodecahedronGeometry(0.32, 0));
  const blockGeo = () => sharedGeo(THREE, 'bh_plinth_blk', () => new RoundedBoxGeometry(0.54, 0.26, 0.34, 1, 0.06));
  const leafGeo = () => sharedGeo(THREE, 'bh_hyd_leaf', () => {
    const g = new THREE.CircleGeometry(0.14, 6);
    g.scale(1, 1.35, 1);
    return g;
  });
  const floretGeo = () => sharedGeo(THREE, 'bh_hyd_floret', () => new THREE.IcosahedronGeometry(0.13, 0));

  // Ring of staggered dressed stones + rounded shoreline boulders around all 4 edges
  const hw = w * 0.5 + 0.12, hd = d * 0.5 + 0.12;
  const perim = [
    [-hw, hd, hw, hd, true],
    [hw, -hd, -hw, -hd, false],
    [-hw, -hd, -hw, hd, false],
    [hw, hd, hw, -hd, false],
  ];
  for (const [ax, az, bx, bz, isFront] of perim) {
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    const n = Math.max(4, Math.floor(len / 0.52));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      if (isFront && Math.abs(px - doorX) < doorW * 0.5 + 0.35) continue;
      pushInst('plinth_blk', blockGeo, bm.stoneInst,
        px, h * 0.52 + jr(-0.03, 0.03), pz,
        jr(-0.03, 0.03), -ang + jr(-0.04, 0.04), jr(-0.03, 0.03),
        jr(0.88, 1.15), jr(0.85, 1.12), jr(0.88, 1.1), pick(STONE_BOULDER_PAL), parent);
      if (i % 2 === 0) {
        pushInst('plinth_rock', rockGeo, bm.stoneInst,
          px + Math.sin(ang) * 0.18, 0.14 + jr(-0.03, 0.08), pz - Math.cos(ang) * 0.18,
          jr(0, 3), jr(0, 3), 0, jr(0.85, 1.35), jr(0.65, 0.95), jr(0.85, 1.3),
          i % 4 === 0 ? pick(MOSS_BOULDER_PAL) : pick(STONE_BOULDER_PAL), parent);
      }
    }
  }

  // Welcoming wide stone entrance steps at (doorX, +hd)
  if (steps > 0) {
    for (let s = 0; s < steps; s++) {
      const f = (s + 1) / steps;
      const stepH = h * (1 - s / steps);
      const stepD = 0.38 * (s + 1);
      add(rbox(doorW + 0.36, 0.13, 0.42, 0.04, bm.stoneFloor),
        doorX, stepH - 0.06, hd + s * 0.34 + 0.18, 0, 0, 0, parent);
      for (const sx of [-1, 1]) {
        pushInst('step_cheek', blockGeo, bm.stoneInst,
          doorX + sx * (doorW * 0.5 + 0.24), stepH * 0.55, hd + stepD * 0.55,
          0, PI * 0.5, 0, 0.75, 0.9 + (1 - f) * 0.5, 0.75, pick(STONE_BOULDER_PAL), parent);
      }
    }
  }

  // Lush purple/lilac Storybook Hydrangea clusters at front corners (seen in every panel of buildings_sheet.png!)
  if (hydrangeas) {
    for (const [hx, hz] of [[-hw - 0.18, hd - 0.15], [hw + 0.18, hd - 0.15]]) {
      for (let l = 0; l < 14; l++) {
        pushInst('hyd_leaf', leafGeo, bm.leafInst,
          hx + jr(-0.42, 0.42), 0.22 + jr(0, 0.36), hz + jr(-0.38, 0.38),
          jr(-0.8, 0.8), jr(0, TAU), jr(-0.5, 0.5), jr(1.0, 1.45), jr(1.0, 1.45), 1, pick(FOLIAGE_PAL), parent);
      }
      for (let b = 0; b < 12; b++) {
        pushInst('hyd_floret', floretGeo, bm.whiteInst,
          hx + jr(-0.36, 0.36), 0.34 + jr(0, 0.36), hz + jr(-0.32, 0.32),
          jr(0, 3), jr(0, 3), 0, jr(0.9, 1.35), jr(0.8, 1.2), jr(0.9, 1.35), pick(HYDRANGEA_PAL), parent);
      }
    }
  }
}

// ============================================================================
// 5. Glowing Kumiko Shoji Window Bay & Circular Marumado Lattice Window
// ============================================================================
export function addKumikoWindow(THREE, K, opts = {}) {
  const {
    cx = 0, cy = 1.65, cz = 0, rotY = 0,
    w = 1.45, h = 1.35, cols = 4, rows = 4,
    parent = K.root,
  } = opts;
  const { add, rbox } = K;
  const bm = getBathMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  g.rotation.y = rotY;
  parent.add(g);

  // Double-sided glowing shoji paper pane so both exterior and interior glow warmly!
  add(rbox(w - 0.08, h - 0.08, 0.04, 0.01, bm.shojiGlow), 0, 0, 0, 0, 0, 0, g);
  // Outer cedar frame
  for (const sx of [-1, 1]) add(rbox(0.08, h + 0.08, 0.11, 0.02, bm.darkTimber), sx * (w * 0.5), 0, 0, 0, 0, 0, g);
  for (const sy of [-1, 1]) add(rbox(w + 0.14, 0.08, 0.12, 0.02, bm.darkTimber), 0, sy * (h * 0.5), 0, 0, 0, 0, g);
  // Crisp 3D Kumiko muntin grid on both faces
  for (let c = 1; c < cols; c++) {
    const ux = -w * 0.5 + (c / cols) * w;
    add(rbox(0.028, h - 0.06, 0.075, 0.008, bm.rafterWood), ux, 0, 0, 0, 0, 0, g);
  }
  for (let r = 1; r < rows; r++) {
    const uy = -h * 0.5 + (r / rows) * h;
    add(rbox(w - 0.06, 0.028, 0.075, 0.008, bm.rafterWood), 0, uy, 0, 0, 0, 0, g);
  }
  return g;
}

export function addMarumadoWindow(THREE, K, opts = {}) {
  const {
    cx = 0, cy = 1.75, cz = 0, rotY = 0,
    radius = 0.72,
    parent = K.root,
  } = opts;
  const { add, rbox } = K;
  const bm = getBathMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(cx, cy, cz);
  g.rotation.y = rotY;
  parent.add(g);

  const disc = new THREE.CylinderGeometry(radius - 0.03, radius - 0.03, 0.04, 24);
  disc.rotateX(PI * 0.5);
  add(new THREE.Mesh(disc, bm.shojiGlow), 0, 0, 0, 0, 0, 0, g);
  add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.065, 8, 28), bm.darkTimber), 0, 0, 0, 0, 0, 0, g);
  // Asymmetric poetic Japanese kumiko lattice bars inside the round window
  for (const ux of [-0.36, 0, 0.36]) {
    const ch = Math.sqrt(Math.max(0.05, radius * radius - ux * ux)) * 1.92;
    add(rbox(0.028, ch, 0.07, 0.008, bm.rafterWood), ux * radius / 0.72, 0, 0, 0, 0, 0, g);
  }
  for (const uy of [-0.32, 0.04, 0.38]) {
    const cw = Math.sqrt(Math.max(0.05, radius * radius - uy * uy)) * 1.92;
    add(rbox(cw, 0.028, 0.07, 0.008, bm.rafterWood), 0, uy * radius / 0.72, 0, 0, 0, 0, g);
  }
  return g;
}

// ============================================================================
// 6. Glowing Paper Chochin Lanterns, Timber Toro Post Lanterns & Noren Curtains
// ============================================================================
export function addChochinLantern(THREE, K, opts = {}) {
  const {
    x = 0, y = 2.4, z = 0,
    radius = 0.22, height = 0.44,
    red = false, tassel = true,
    parent = K.root,
  } = opts;
  const { add, rbox } = K;
  const bm = getBathMats(THREE, K);
  const mat = red ? bm.chochinRedGlow : bm.chochinGoldGlow;

  add(rbox(0.03, 0.18, 0.03, 0.01, bm.darkTimber), x, y + height * 0.5 + 0.08, z, 0, 0, 0, parent);
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat);
  body.scale.set(1, height / (radius * 2), 1);
  add(body, x, y, z, 0, 0, 0, parent);
  for (const ry of [-0.26, 0, 0.26]) {
    const rRing = radius * Math.sqrt(Math.max(0.2, 1 - ry * ry * 2.2));
    const tor = new THREE.TorusGeometry(rRing, 0.008, 5, 14);
    tor.rotateX(PI * 0.5);
    add(new THREE.Mesh(tor, bm.darkTimber), x, y + ry * height, z, 0, 0, 0, parent);
  }
  for (const sy of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.52, radius * 0.56, 0.05, 12), bm.darkTimber),
      x, y + sy * (height * 0.48), z, 0, 0, 0, parent);
  }
  if (tassel) {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.16, 7), bm.vermilion), x, y - height * 0.5 - 0.09, z, 0, 0, 0, parent);
  }
}

export function addPostLantern(THREE, K, opts = {}) {
  const {
    x = 0, y = 0, z = 0, height = 1.65,
    stone = false,
    parent = K.root,
  } = opts;
  const { add, rbox } = K;
  const bm = getBathMats(THREE, K);
  const postMat = stone ? bm.mossStone : bm.darkTimber;
  const roofMat = stone ? bm.mossStone : bm.vermilionDeep;

  add(rbox(0.38, 0.18, 0.38, 0.04, bm.stoneFloor), x, y + 0.09, z, 0, 0, 0, parent);
  add(rbox(0.16, height - 0.45, 0.16, 0.03, postMat), x, y + 0.18 + (height - 0.45) * 0.5, z, 0, 0, 0, parent);
  const ly = y + height - 0.16;
  add(rbox(0.38, 0.07, 0.38, 0.02, postMat), x, ly - 0.18, z, 0, 0, 0, parent);
  add(rbox(0.28, 0.32, 0.28, 0.02, bm.lanternGlow), x, ly, z, 0, 0, 0, parent);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(rbox(0.035, 0.34, 0.035, 0.01, postMat), x + sx * 0.14, ly, z + sz * 0.14, 0, 0, 0, parent);
  }
  const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.24, 4), roofMat);
  add(pyr, x, ly + 0.26, z, 0, PI * 0.25, 0, parent);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bm.goldTrim), x, ly + 0.40, z, 0, 0, 0, parent);
}

export function addNorenCurtain(THREE, K, opts = {}) {
  const {
    cx = 0, yTop = 2.55, z = 0, rotY = 0,
    width = 1.65, height = 0.78, panels = 3,
    texMap, parent = K.root,
  } = opts;
  const { add, rbox, M } = K;
  const bm = getBathMats(THREE, K);
  const g = new THREE.Group();
  g.position.set(cx, yTop, z);
  g.rotation.y = rotY;
  parent.add(g);

  add(rbox(width + 0.22, 0.055, 0.055, 0.02, bm.darkTimber), 0, 0.02, 0, 0, 0, 0, g);
  const cMat = M(0xffffff, texMap || bm.BT.norenOnsen, { roughness: 0.9, side: THREE.DoubleSide });
  const pw = (width - (panels - 1) * 0.045) / panels;
  for (let i = 0; i < panels; i++) {
    const px = -width * 0.5 + pw * 0.5 + i * (pw + 0.045);
    const geo = new RoundedBoxGeometry(pw, height, 0.028, 1, 0.01);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) {
      uv.setX(k, (i + uv.getX(k)) / panels);
    }
    add(new THREE.Mesh(geo, cMat), px, -height * 0.5 - 0.02, 0, 0.04 * (i % 2 ? 1 : -1), 0, 0, g);
  }
  return g;
}

// ============================================================================
// 7. Cascading Storybook 3D Wisteria Racemes & Gnarled Woody Pergola Vines
// ============================================================================
export function addWisteriaRaceme(THREE, K, x, yTop, z, len = 0.95, parent = K.root, batchKey = 'wisteria') {
  const { pushInst, jr, pick } = K;
  const bm = getBathMats(THREE, K);
  const petalGeo = () => sharedGeo(THREE, 'bh_wist_petal', () => new THREE.IcosahedronGeometry(0.085, 0));
  const beads = Math.max(5, Math.floor(len / 0.11));
  const swayX = jr(-0.08, 0.08), swayZ = jr(-0.08, 0.08);
  for (let i = 0; i < beads; i++) {
    const f = i / beads; // 0 top (broad purple) -> 1 tip (slender pale lavender)
    const rSpread = (1 - f * 0.72) * 0.11;
    const scale = (1 - f * 0.58) * jr(0.95, 1.32);
    const col = f < 0.35 ? WISTERIA_PAL[2] : (f < 0.7 ? pick(WISTERIA_PAL) : WISTERIA_PAL[4]);
    const clusters = f < 0.5 ? 2 : 1;
    for (let c = 0; c < clusters; c++) {
      const a = jr(0, TAU);
      pushInst(`${batchKey}_bloom`, petalGeo, bm.whiteInst,
        x + swayX * f + Math.cos(a) * rSpread,
        yTop - f * len,
        z + swayZ * f + Math.sin(a) * rSpread,
        jr(0, 3), jr(0, 3), 0, scale, scale * 1.22, scale, col, parent);
    }
  }
}
