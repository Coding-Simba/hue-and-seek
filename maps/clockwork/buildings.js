/* Hue & Seek — Map 4: Pendulum Square Wizard's Market (maps/clockwork/buildings.js).
 * Hand-crafted procedural Storybook 3D architecture matching assets/maps/clockwork/buildings_sheet.png
 * and assets/maps/clockwork/interiors_sheet.png:
 *   1. hatter_boutique   — 'Primrose Millinery' (dusty-rose & sage shopfront, gable bow, bow window, showroom & sewing studio)
 *   2. wizard_parlor     — 'Wizard Portal House' (purple-slate turret house, spinning brass astrolabe portalWheel, log-fire hearth & library)
 *   3. clockmaker_hall   — 'Clockmaker Guildhall' (butter-gold timber hall, Roman clockface & spinning gears, pendulum wall & bell loft)
 *   4. alchemist_shop    — 'Stained-Glass Apothecary' (lavender plaster, cascading wisteria, glowing flask gable, cauldron & herb room)
 *   5. royal_patisserie  — 'Royal Pâtisserie' (cream Haussmann limestone, mansard crown roof, mint balcony, macaron vitrine & tea salon)
 * Plus landmarks: orreryFountain, clockworkTram, walkingTurret (wind-up clock-tower wagon), marketKiosk, stoneBridge.
 */
import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  mergeStatic,
  RoundedBoxGeometry,
} from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

export const BUILDING_DEFS = [
  { id: 'hatter_boutique', label: 'Primrose Millinery' },
  { id: 'wizard_parlor', label: 'Wizard Portal House' },
  { id: 'clockmaker_hall', label: 'Clockmaker Guildhall' },
  { id: 'alchemist_shop', label: 'Stained-Glass Apothecary' },
  { id: 'royal_patisserie', label: 'Royal Pâtisserie' },
];

// ============================================================================
// Shared Procedural Painted Canvas Textures & Toothed Brass Gear Geometry
// ============================================================================
function texStripes(THREE, key, c1, c2, stripes = 10) {
  return paintedCanvasTex(THREE, `cw_stripe_${key}`, 256, (g, s, rng) => {
    const sw = s / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 === 0 ? c1 : c2;
      g.fillRect(i * sw, 0, sw + 1, s);
    }
    brushStrokes(g, s, rng, 140, ['#ffffff', '#e6d6c2', '#4a2c2a'], 1.2, 3.2, 0.14, PI / 2, 0.22, 42);
    g.fillStyle = 'rgba(60,30,25,0.16)';
    g.fillRect(0, s - 10, s, 10);
  });
}

function texSlateShingles(THREE) {
  return paintedCanvasTex(THREE, 'cw_slate_shingles', 256, (g, s, rng) => {
    g.fillStyle = '#dcdde6';
    g.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) {
      const y = r * 32;
      const off = (r % 2) * 16;
      for (let c = -1; c < 9; c++) {
        const x = c * 32 + off;
        const v = 205 + ((r * 13 + c * 7 + 40) % 36);
        g.fillStyle = `rgb(${v - 6},${v - 4},${v + 8})`;
        g.beginPath();
        g.roundRect(x + 1, y + 1, 30, 30, 5);
        g.fill();
        g.strokeStyle = 'rgba(40,42,62,0.38)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    brushStrokes(g, s, rng, 90, ['#ffffff', '#b8bccf'], 2, 5, 0.16, 0, 0.8, 26);
  }, 4, 3);
}

// Midnight-enamel brass astrolabe / star-compass dial (spins on the Wizard house gable & above every portal door)
function texPortalWheel(THREE) {
  return paintedCanvasTex(THREE, 'cw_astrolabe_dial_v1', 512, (g, s, rng) => {
    const cx = s / 2, cy = s / 2;
    g.fillStyle = '#2a2140';
    g.fillRect(0, 0, s, s);
    // Deep indigo night-sky enamel face
    const bg = g.createRadialGradient(cx, cy, 10, cx, cy, s * 0.49);
    bg.addColorStop(0, '#4a4f9a');
    bg.addColorStop(0.6, '#2f3170');
    bg.addColorStop(1, '#1d1d48');
    g.fillStyle = bg;
    g.beginPath();
    g.arc(cx, cy, s * 0.48, 0, TAU);
    g.fill();
    brushStrokes(g, s, rng, 120, ['#5a60b0', '#262660', '#3c3f88'], 3, 9, 0.22, 0, PI, 30);

    // Scattered painted gold stars on the enamel
    g.fillStyle = '#ffe9a8';
    for (let i = 0; i < 46; i++) {
      const a = rng.jr(0, TAU), r = rng.jr(0.10, 0.36) * s;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rng.jr(1.2, 3.4), 0, TAU);
      g.fill();
    }

    // Engraved brass chapter ring with 48 tick marks + 12 raised studs
    g.strokeStyle = '#e8b84b';
    g.lineWidth = 34;
    g.beginPath();
    g.arc(cx, cy, s * 0.425, 0, TAU);
    g.stroke();
    g.strokeStyle = '#ffdf85';
    g.lineWidth = 5;
    for (const rr of [0.462, 0.388]) {
      g.beginPath();
      g.arc(cx, cy, s * rr, 0, TAU);
      g.stroke();
    }
    g.strokeStyle = '#6b4416';
    g.lineCap = 'butt';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      const r0 = s * (i % 4 === 0 ? 0.398 : 0.412), r1 = s * 0.452;
      g.lineWidth = i % 4 === 0 ? 5 : 2.5;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.stroke();
    }

    // Off-centre ecliptic ring + thin crescent arc (classic astrolabe rete)
    g.strokeStyle = '#f5cc5c';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(cx + s * 0.045, cy - s * 0.070, s * 0.235, 0, TAU);
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx - s * 0.03, cy + s * 0.05, s * 0.30, PI * 0.15, PI * 0.95);
    g.stroke();

    // 8-point brass compass rose (4 long cardinal blades + 4 short ordinal blades), two-tone split
    const blade = (ang, len, wid, light, dark) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(ang);
      g.fillStyle = light;
      g.beginPath();
      g.moveTo(0, -len); g.lineTo(wid, 0); g.lineTo(0, 0);
      g.closePath(); g.fill();
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(0, -len); g.lineTo(-wid, 0); g.lineTo(0, 0);
      g.closePath(); g.fill();
      g.restore();
    };
    for (let i = 0; i < 4; i++) blade(PI / 4 + (i * PI) / 2, s * 0.20, s * 0.040, '#f2d48a', '#b88432');
    for (let i = 0; i < 4; i++) blade((i * PI) / 2, s * 0.355, s * 0.052, '#fff0b8', '#d29a3a');

    // Centre brass boss
    g.fillStyle = '#b88432';
    g.beginPath();
    g.arc(cx, cy, 30, 0, TAU);
    g.fill();
    g.fillStyle = '#ffe28a';
    g.beginPath();
    g.arc(cx, cy, 20, 0, TAU);
    g.fill();
  });
}

function texClockFace(THREE) {
  return paintedCanvasTex(THREE, 'cw_roman_clock', 512, (g, s, rng) => {
    const cx = s / 2, cy = s / 2;
    g.fillStyle = '#f8eed4';
    g.fillRect(0, 0, s, s);
    const rg = g.createRadialGradient(cx, cy, 20, cx, cy, s * 0.48);
    rg.addColorStop(0, '#fffaf0');
    rg.addColorStop(0.76, '#f4e3bc');
    rg.addColorStop(1, '#d9be8a');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, s * 0.48, 0, TAU);
    g.fill();
    brushStrokes(g, s, rng, 110, ['#fffdf7', '#e8d4a8', '#dfca9c'], 2, 6, 0.22, 0, PI, 36);

    // Concentric chapter rings
    for (const [r, w, col] of [[0.46, 8, '#7a5220'], [0.43, 3, '#3b2612'], [0.30, 4, '#8c6026'], [0.21, 5, '#b88332']]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.arc(cx, cy, s * r, 0, TAU);
      g.stroke();
    }

    // 60 minute ticks + 12 Roman numerals
    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - PI / 2;
      const major = i % 5 === 0;
      g.strokeStyle = '#2d1c0e';
      g.lineWidth = major ? 4 : 1.8;
      const r0 = s * (major ? 0.405 : 0.415), r1 = s * 0.43;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.stroke();
    }
    g.fillStyle = '#2a190c';
    g.font = 'bold 34px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU - PI / 2;
      const nr = s * 0.362;
      g.save();
      g.translate(cx + Math.cos(a) * nr, cy + Math.sin(a) * nr);
      g.rotate(a + PI / 2);
      g.fillText(numerals[i], 0, 0);
      g.restore();
    }
    // Inner brass gear rose
    g.fillStyle = '#c99035';
    g.beginPath();
    g.arc(cx, cy, s * 0.19, 0, TAU);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.strokeStyle = '#593914';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * s * 0.19, cy + Math.sin(a) * s * 0.19);
      g.stroke();
    }
  });
}

function texStainedFlask(THREE) {
  return paintedCanvasTex(THREE, 'cw_stained_flask', 512, (g, s) => {
    const cx = s / 2, cy = s * 0.56;
    // Jewel-toned stained glass mosaic rays
    const segCols = ['#38d4ff', '#ffcf48', '#ff64b4', '#4ce896', '#9b6bff', '#ff8c42', '#42b8ff', '#ffd95e'];
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU, a1 = ((i + 1) / 16) * TAU;
      g.fillStyle = segCols[i % segCols.length];
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, s * 0.72, a0, a1);
      g.closePath();
      g.fill();
      g.strokeStyle = '#2d1938';
      g.lineWidth = 6;
      g.stroke();
    }
    // Leaded concentric gothic rings
    g.strokeStyle = '#2d1938';
    g.lineWidth = 7;
    for (const r of [0.24, 0.38, 0.5]) {
      g.beginPath();
      g.arc(cx, cy, s * r, 0, TAU);
      g.stroke();
    }
    // Central glowing round-bottomed alchemist potion flask
    const fr = s * 0.21;
    g.fillStyle = '#e8f7ff';
    g.beginPath();
    g.arc(cx, cy + 28, fr, 0, TAU);
    g.fill();
    g.fillRect(cx - 28, cy - 125, 56, 115);

    const pg = g.createRadialGradient(cx - 16, cy + 36, 10, cx, cy + 34, fr * 0.92);
    pg.addColorStop(0, '#ff9ef5');
    pg.addColorStop(0.5, '#d938ff');
    pg.addColorStop(1, '#6d14b8');
    g.fillStyle = pg;
    g.beginPath();
    g.arc(cx, cy + 32, fr * 0.88, 0.08 * PI, 0.92 * PI, false);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy + 44, fr * 0.84, fr * 0.68, 0, 0, TAU);
    g.fill();

    // Glowing bubbles & cork
    g.fillStyle = '#fff0ff';
    for (const [bx, by, br] of [[-24, 28, 11], [18, 12, 9], [-6, -16, 7], [10, -48, 6]]) {
      g.beginPath();
      g.arc(cx + bx, cy + by, br, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#d49a45';
    g.fillRect(cx - 34, cy - 136, 68, 22);
    g.strokeStyle = '#2d1938';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(cx, cy + 28, fr, -0.36 * PI, 1.36 * PI);
    g.stroke();
    g.strokeRect(cx - 28, cy - 125, 56, 92);
  });
}

function texBanner(THREE, key, bgHex, emblem = 'star') {
  return paintedCanvasTex(THREE, `cw_banner_${key}`, 256, (g, s) => {
    g.fillStyle = bgHex;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#f2c14e';
    g.lineWidth = 12;
    g.strokeRect(14, 14, s - 28, s - 28);
    const cx = s / 2, cy = s * 0.48;
    g.fillStyle = '#ffd966';
    g.strokeStyle = '#ffd966';
    if (emblem === 'star') {
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU - PI / 2;
        const r = i % 2 === 0 ? (i % 4 === 0 ? 74 : 48) : 16;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    } else {
      g.lineWidth = 9;
      g.beginPath();
      g.arc(cx, cy, 48, 0, TAU);
      g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66);
        g.stroke();
      }
    }
  });
}

function texRug(THREE, key, cOuter, cMain, cInner, star = false) {
  return paintedCanvasTex(THREE, `cw_rug_${key}`, 256, (g, s, rng) => {
    const cx = s / 2, cy = s / 2;
    g.fillStyle = cOuter;
    g.fillRect(0, 0, s, s);
    for (const [r, col] of [[0.48, cOuter], [0.41, '#f4d99b'], [0.37, cMain], [0.22, '#f4d99b'], [0.18, cInner]]) {
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx, cy, s * r, 0, TAU);
      g.fill();
    }
    if (star) {
      g.fillStyle = '#ffe08c';
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU - PI / 2;
        const r = i % 2 === 0 ? s * 0.34 : s * 0.12;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    }
    brushStrokes(g, s, rng, 180, ['#ffffff', cOuter, cInner], 1, 2.5, 0.16, 0, PI, 20);
  });
}

// Extruded 3D spoked cogwheel geometry (with UVs + normals so mergeStatic merges cleanly)
const gearGeoCache = new Map();
export function makeGearGeo(THREE, radius = 0.6, depth = 0.1, teeth = 12, spokes = 6) {
  const key = `${radius.toFixed(3)}|${depth.toFixed(3)}|${teeth}|${spokes}`;
  if (gearGeoCache.has(key)) return gearGeoCache.get(key).clone();
  const s = new THREE.Shape();
  const rRoot = radius * 0.86;
  const rTip = radius;
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.66;
    const a4 = a0 + step * 0.78;
    const p0 = [Math.cos(a0) * rRoot, Math.sin(a0) * rRoot];
    if (i === 0) s.moveTo(p0[0], p0[1]); else s.lineTo(p0[0], p0[1]);
    s.lineTo(Math.cos(a1) * rRoot, Math.sin(a1) * rRoot);
    s.lineTo(Math.cos(a2) * rTip, Math.sin(a2) * rTip);
    s.lineTo(Math.cos(a3) * rTip, Math.sin(a3) * rTip);
    s.lineTo(Math.cos(a4) * rRoot, Math.sin(a4) * rRoot);
  }
  s.closePath();
  if (spokes > 0 && radius > 0.22) {
    const rHub = radius * 0.25;
    const rRim = radius * 0.68;
    const wAng = (TAU / spokes) * 0.32;
    for (let i = 0; i < spokes; i++) {
      const ac = (i / spokes) * TAU;
      const h = new THREE.Path();
      h.absarc(0, 0, rHub, ac - wAng, ac + wAng, false);
      h.absarc(0, 0, rRim, ac + wAng, ac - wAng, true);
      h.closePath();
      s.holes.push(h);
    }
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.018, depth * 0.22),
    bevelSize: Math.min(0.016, radius * 0.03),
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  gearGeoCache.set(key, g);
  return g.clone();
}

// ============================================================================
// Common Storybook Building Dressing Helpers (Paint colors, Roofs, Lanterns, Quoins)
// ============================================================================
function stampPaintColors(THREE, root) {
  root.traverse((o) => {
    if (o.isMesh && !o.userData.paint) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      o.userData.paint = new THREE.Color(m && m.color ? m.color.getHex() : 0xd8c8b0);
    }
  });
  return root;
}

function addCoachLantern(THREE, K, x, y, z, ironMat, glowM, parent = K.root) {
  K.add(K.rbox(0.06, 0.06, 0.22, 0.02, ironMat, 1), x, y + 0.14, z - 0.08, 0, 0, 0, parent);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.24, 6), glowM), x, y, z, 0, 0, 0, parent);
  K.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 6), ironMat), x, y + 0.17, z, 0, 0, 0, parent);
  K.add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.09, 6), ironMat), x, y - 0.15, z, PI, 0, 0, parent);
}

function addStoneSteps(K, x, z, w, stoneMat) {
  K.add(K.rbox(w + 0.55, 0.11, 0.92, 0.04, stoneMat, 1), x, 0.055, z + 0.34);
  K.add(K.rbox(w + 0.24, 0.13, 0.58, 0.04, stoneMat, 1), x, 0.085, z + 0.12);
}

function addArchedDoorSurround(THREE, K, x, z, w, h, stoneMat, doorMat, ironMat) {
  const r = w / 2;
  const springY = Math.max(0.2, h - r);
  // Stone pilasters + arch ring
  for (const sx of [-1, 1]) {
    K.add(K.rbox(0.22, springY, 0.32, 0.04, stoneMat, 1), x + sx * (r + 0.1), springY / 2, z - 0.11);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 0.09, 0.11, 6, 18, PI), stoneMat);
  arch.scale.set(1, 1, 1.45);
  K.add(arch, x, springY, z - 0.11);
  // Open oak door leaves swung slightly outward/inward against the jambs so doorway stays 100% clear
  const leafW = w * 0.44;
  for (const sx of [-1, 1]) {
    const leaf = K.rbox(leafW, h * 0.84, 0.07, 0.02, doorMat, 1);
    K.add(leaf, x + sx * (r - 0.05), h * 0.42, z + 0.26, 0, sx * 1.28, 0);
    K.add(K.rbox(leafW * 0.72, 0.05, 0.09, 0.01, ironMat, 1), x + sx * (r - 0.05), h * 0.62, z + 0.26, 0, sx * 1.28, 0);
  }
}

function addWindowDress(THREE, K, x, y, z, w, h, rotY, frameMat, paneMat, sillMat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  K.root.add(g);
  K.add(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), paneMat), 0, 0, -0.11, 0, 0, 0, g);
  K.add(new THREE.Mesh(K.flipGeo(new THREE.PlaneGeometry(w - 0.06, h - 0.06)), paneMat), 0, 0, -0.13, 0, 0, 0, g);
  K.add(K.rbox(w + 0.14, 0.09, 0.28, 0.025, sillMat || frameMat, 1), 0, -h / 2 - 0.03, -0.1, 0, 0, 0, g);
  K.add(K.rbox(w + 0.12, 0.08, 0.26, 0.02, frameMat, 1), 0, h / 2 + 0.02, -0.1, 0, 0, 0, g);
  for (const sx of [-1, 1]) {
    K.add(K.rbox(0.08, h + 0.06, 0.26, 0.02, frameMat, 1), sx * (w / 2 + 0.02), 0, -0.1, 0, 0, 0, g);
  }
  K.add(K.rbox(0.05, h - 0.04, 0.14, 0.015, frameMat, 1), 0, 0, -0.11, 0, 0, 0, g);
  K.add(K.rbox(w - 0.04, 0.05, 0.14, 0.015, frameMat, 1), 0, 0.06, -0.11, 0, 0, 0, g);
  return g;
}

function buildMainGableRoof(THREE, K, W, D, H, rise, wallMat, timberMat, roofMat, overX = 0.45, overZ = 0.48, tilePalette = null) {
  // Left & right gable end triangles (along X ridge)
  const gs = new THREE.Shape();
  gs.moveTo(-D / 2 - 0.04, H);
  gs.lineTo(D / 2 + 0.04, H);
  gs.lineTo(0, H + rise);
  gs.closePath();
  const gGeo = new THREE.ExtrudeGeometry(gs, { depth: 0.24, bevelEnabled: false });
  gGeo.rotateY(PI / 2);
  K.addR(new THREE.Mesh(gGeo, wallMat), -W / 2 - 0.02, 0, 0);
  K.addR(new THREE.Mesh(gGeo.clone(), wallMat), W / 2 - 0.22, 0, 0);

  // Sloped roof slabs + crisp 3D instanced Storybook slate shingles
  const slopeLen = Math.hypot(D / 2 + overZ, rise);
  const pitch = Math.atan2(rise, D / 2 + overZ);
  const pal = tilePalette || [0x5c6884, 0x687694, 0x505c76, 0x72809e];
  for (const sz of [-1, 1]) {
    const slab = K.rbox(W + overX * 2, 0.18, slopeLen, 0.04, roofMat, 1);
    K.addR(slab, 0, H + rise * 0.5 - 0.04, sz * (D / 2 + overZ) * 0.5, sz * pitch, 0, 0);
    K.tileRoofSlope({
      cx: 0,
      cy: H + rise * 0.5 + 0.05,
      cz: sz * (D / 2 + overZ) * 0.5,
      width: W + overX * 2 - 0.22,
      slopeLen: slopeLen - 0.16,
      pitch,
      rotY: sz > 0 ? 0 : PI,
      style: 'slate',
      palette: pal,
      parent: K.roofG,
    });
    // Bargeboards on gable ends
    for (const sx of [-1, 1]) {
      K.addR(
        K.rbox(0.14, 0.24, slopeLen + 0.08, 0.03, timberMat, 1),
        sx * (W / 2 + overX - 0.06), H + rise * 0.5 - 0.04, sz * (D / 2 + overZ) * 0.5,
        sz * pitch, 0, 0
      );
    }
  }
  // Ridge beam
  K.addR(K.rbox(W + overX * 2 + 0.12, 0.22, 0.24, 0.05, timberMat, 1), 0, H + rise + 0.04, 0);
}

function buildFrontCrossGable(THREE, K, gx, zFront, zBack, wGable, H, riseG, wallMat, timberMat, roofMat, tilePalette = null) {
  const gs = new THREE.Shape();
  gs.moveTo(-wGable / 2, H);
  gs.lineTo(wGable / 2, H);
  gs.lineTo(0, H + riseG);
  gs.closePath();
  const gGeo = new THREE.ExtrudeGeometry(gs, { depth: 0.24, bevelEnabled: false });
  K.addR(new THREE.Mesh(gGeo, wallMat), gx, 0, zFront - 0.22);

  const depthG = zFront + 0.45 - zBack;
  const slopeLen = Math.hypot(wGable / 2 + 0.36, riseG);
  const pitch = Math.atan2(riseG, wGable / 2 + 0.36);
  const pal = tilePalette || [0x5c6884, 0x687694, 0x505c76, 0x72809e];
  for (const sx of [-1, 1]) {
    K.addR(
      K.rbox(slopeLen, 0.17, depthG, 0.04, roofMat, 1),
      gx + sx * (wGable / 2 + 0.36) * 0.5, H + riseG * 0.5 - 0.02, (zFront + 0.45 + zBack) * 0.5,
      0, 0, -sx * pitch
    );
    K.tileRoofSlope({
      cx: gx + sx * (wGable / 2 + 0.36) * 0.5,
      cy: H + riseG * 0.5 + 0.06,
      cz: (zFront + 0.45 + zBack) * 0.5,
      width: depthG - 0.20,
      slopeLen: slopeLen - 0.16,
      pitch,
      rotY: sx > 0 ? PI / 2 : -PI / 2,
      style: 'slate',
      palette: pal,
      parent: K.roofG,
    });
    K.addR(
      K.rbox(slopeLen + 0.08, 0.24, 0.16, 0.03, timberMat, 1),
      gx + sx * (wGable / 2 + 0.36) * 0.5, H + riseG * 0.5 - 0.02, zFront + 0.38,
      0, 0, -sx * pitch
    );
  }
  K.addR(K.rbox(0.22, 0.22, depthG + 0.1, 0.05, timberMat, 1), gx, H + riseG + 0.04, (zFront + 0.45 + zBack) * 0.5);
}

function addChimney(K, x, y0, z, h, stoneMat, capMat) {
  K.addR(K.rbox(0.78, h, 0.78, 0.06, stoneMat, 1), x, y0 + h / 2, z);
  K.addR(K.rbox(0.94, 0.18, 0.94, 0.04, capMat, 1), x, y0 + h + 0.06, z);
  for (const dx of [-0.18, 0.18]) {
    K.addR(K.rbox(0.22, 0.34, 0.22, 0.04, capMat, 1), x + dx, y0 + h + 0.28, z);
  }
}

function addQuoinsAndPlinth(THREE, K, W, D, H, stoneMat) {
  const pH = 0.38;
  K.add(K.rbox(W + 0.18, pH, 0.34, 0.04, stoneMat, 1), 0, pH / 2, D / 2 - 0.08);
  K.add(K.rbox(W + 0.18, pH, 0.34, 0.04, stoneMat, 1), 0, pH / 2, -D / 2 + 0.08);
  K.add(K.rbox(0.34, pH, D + 0.18, 0.04, stoneMat, 1), -W / 2 + 0.08, pH / 2, 0);
  K.add(K.rbox(0.34, pH, D + 0.18, 0.04, stoneMat, 1), W / 2 - 0.08, pH / 2, 0);

  const qGeo = () => new RoundedBoxGeometry(0.34, 0.28, 0.34, 1, 0.04);
  const qMat = K.M(0xffffff, K.tex('stone', 0.8, 0.8));
  const cols = [0xd8c8b0, 0xcab89e, 0xe2d4be, 0xc0ae95];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const longX = i % 2 === 0 ? 1.28 : 0.92;
        const longZ = i % 2 === 0 ? 0.92 : 1.28;
        K.pushInst(
          'quoin', qGeo, qMat,
          sx * (W / 2 - 0.03), 0.54 + i * 0.33, sz * (D / 2 - 0.03),
          0, 0, 0, longX, 1, longZ, K.pick(cols)
        );
      }
    }
  }
}

function scatterFoliageCluster(THREE, K, cx, cy, cz, rx, ry, rz, count, flowerColors, parent = K.root) {
  const leafGeo = () => new THREE.IcosahedronGeometry(0.15, 0);
  const bloomGeo = () => new THREE.IcosahedronGeometry(0.095, 0);
  const leafMat = K.M(0xffffff, null, { roughness: 0.88 });
  const bloomMat = K.M(0xffffff, null, { roughness: 0.8 });
  const greens = [0x4c8d3e, 0x5da048, 0x3e7834, 0x6fb254];
  for (let i = 0; i < count; i++) {
    const px = cx + K.jr(-rx, rx);
    const py = cy + K.jr(-ry, ry);
    const pz = cz + K.jr(-rz, rz);
    const ls = K.jr(0.75, 1.35);
    K.pushInst('foliage_leaf', leafGeo, leafMat, px, py, pz, K.jr(0, 3), K.jr(0, 3), 0, ls, ls * 0.8, ls, K.pick(greens), parent);
    if (flowerColors && flowerColors.length && i % 2 === 0) {
      const bs = K.jr(0.75, 1.3);
      K.pushInst(
        'foliage_bloom', bloomGeo, bloomMat,
        px + K.jr(-0.07, 0.07), py + K.jr(0.02, 0.1), pz + K.jr(0.03, 0.1),
        K.jr(0, 3), K.jr(0, 3), 0, bs, bs, bs, K.pick(flowerColors), parent
      );
    }
  }
}

// ============================================================================
// 1. HATTER BOUTIQUE — 'Primrose Millinery'
// ============================================================================
function buildHatterBoutique(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'hatter_boutique', 11);
  const W = 9.6, D = 7.6, H = 3.55, th = 0.24;

  const plaster = K.M(0xfbf0de, K.tex('plaster', 2.2, 1.8));
  const innerWall = K.M(0xfff5e6, K.tex('plaster', 2.0, 1.6));
  const roseWood = K.M(0xb85b6c, K.tex('wood_light', 1.4, 1.4));
  const dustyPink = K.M(0xe5899d, K.tex('painted_metal', 1.0, 1.0));
  const sageGreen = K.M(0x7ca27a, K.tex('painted_metal', 1.0, 1.0));
  const honeyWood = K.M(0xb9824f, K.tex('wood_light', 1.5, 1.5));
  const darkWood = K.M(0x6e4232, K.tex('wood_planks_dark', 1.5, 1.5));
  const stoneMat = K.M(0xd9cbb8, K.tex('stone', 1.8, 1.8));
  const floorWood = K.M(0xeac99b, K.tex('wood_light', 4.2, 4.2));
  const roofTile = K.M(0xd96e7a, texSlateShingles(THREE), { metalness: 0 });
  const brass = K.M(0xe8b84b, null, { roughness: 0.44, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.14 });
  const iron = K.M(0x4a4d5c, null, { roughness: 0.65, metalness: 0 });
  const warmGlow = K.glowMat(0xffe6a8, 0xffad42, 1.45, { metalness: 0 });
  const winGlass = K.glowMat(0xffdf9e, 0xd88830, 0.55, { metalness: 0 });
  const stripeMat = K.M(0xffffff, texStripes(THREE, 'hatter', '#c85568', '#fff4e2', 12), { metalness: 0 });
  const rugMat = K.M(0xffffff, texRug(THREE, 'hatter', '#b8566e', '#e7a4b5', '#f7dce2', false), { metalness: 0 });

  // Floor & stone plinth
  K.add(K.rbox(W - 0.12, 0.1, D - 0.12, 0.02, floorWood, 1), 0, 0.05, 0);
  addQuoinsAndPlinth(THREE, K, W, D, H, stoneMat);

  // Exterior walls (+Z front has bow window opening on left & arched door on right)
  const doorX = 1.95, doorW = 1.72;
  K.wall(0, D / 2, 0, W, H, th, [
    { u: -2.15, y0: 0.82, w: 2.95, h: 1.88 },
    { door: true, u: doorX, w: doorW, h: 2.62, arch: true },
  ], plaster, innerWall);
  K.wall(0, -D / 2, PI, W, H, th, [
    { u: -2.45, y0: 1.05, w: 1.35, h: 1.45 },
    { u: 2.25, y0: 1.05, w: 1.35, h: 1.45 },
  ], plaster, innerWall);
  K.wall(-W / 2, 0, -PI / 2, D, H, th, [{ u: -0.4, y0: 1.05, w: 1.3, h: 1.4 }], plaster, innerWall);
  K.wall(W / 2, 0, PI / 2, D, H, th, [{ u: 0.8, y0: 1.05, w: 1.3, h: 1.4 }], plaster, innerWall);

  // Interior partition wall centered at x = 0.45 with open timber arch (w = 1.72m at z = 0.35)
  K.wall(0.56, 0, PI / 2, D - 2 * th, H, 0.22, [
    { door: true, u: -0.35, w: 1.72, h: 2.72, arch: true },
  ], innerWall, innerWall);
  // Timber arch trim on interior doorway
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.90, 0.08, 6, 16, PI), roseWood), 0.45, 1.86, 0.35, 0, PI / 2, 0);

  // Windows & shutters
  addWindowDress(THREE, K, 2.45, 1.77, -D / 2, 1.35, 1.45, PI, sageGreen, winGlass, stoneMat);
  addWindowDress(THREE, K, -2.25, 1.77, -D / 2, 1.35, 1.45, PI, sageGreen, winGlass, stoneMat);
  addWindowDress(THREE, K, -W / 2, 1.75, -0.4, 1.3, 1.4, -PI / 2, sageGreen, winGlass, stoneMat);
  addWindowDress(THREE, K, W / 2, 1.75, -0.8, 1.3, 1.4, PI / 2, sageGreen, winGlass, stoneMat);

  // Front entrance surround, steps, lanterns, and hanging ribbon-hat sign
  addArchedDoorSurround(THREE, K, doorX, D / 2, doorW, 2.58, stoneMat, honeyWood, iron);
  addStoneSteps(K, doorX, D / 2, doorW, stoneMat);
  addCoachLantern(THREE, K, doorX - 1.12, 2.25, D / 2 + 0.16, brass, warmGlow);
  addCoachLantern(THREE, K, doorX + 1.12, 2.25, D / 2 + 0.16, brass, warmGlow);

  // Wrought-iron hanging Millinery Hat Sign on right front corner
  K.add(K.rbox(0.95, 0.07, 0.07, 0.02, iron, 1), W / 2 + 0.42, 2.95, D / 2 - 0.35);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.028, 6, 14, PI * 1.3), iron), W / 2 + 0.25, 2.72, D / 2 - 0.35);
  K.add(K.rbox(0.68, 0.48, 0.06, 0.08, darkWood, 1), W / 2 + 0.56, 2.56, D / 2 - 0.35);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 14), K.M(0xf6d98a)), W / 2 + 0.56, 2.52, D / 2 - 0.3, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.11, 14), dustyPink), W / 2 + 0.56, 2.58, D / 2 - 0.27, PI / 2, 0, 0);

  // Half-timbering beams on facade
  for (const bx of [-4.68, -3.72, -0.55, 0.85, 3.05, 4.68]) {
    K.add(K.rbox(0.13, H, 0.12, 0.02, roseWood, 1), bx, H / 2, D / 2 + 0.02);
  }
  K.add(K.rbox(W + 0.14, 0.16, 0.18, 0.03, sageGreen, 1), 0, H - 0.08, D / 2 + 0.04);

  // Curved multi-pane Bow Shop Window on front-left (-2.15, z = 3.8..4.42) + striped dome awning
  const bowX = -2.15, bowZ = D / 2 + 0.38;
  K.boxCol(bowX, D / 2 + 0.22, 3.15, 0.62);
  // Paneled dusty-rose wainscot apron
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.66, 0.84, 16, 1, false, -PI * 0.48, PI * 0.96), roseWood), bowX, 0.44, D / 2 - 0.12);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.12, 16, 1, false, -PI * 0.5, PI), honeyWood), bowX, 0.86, D / 2 - 0.12);
  // Curved mullions & warm sill stage
  for (let i = -3; i <= 3; i++) {
    const a = (i / 3) * PI * 0.45;
    K.add(K.rbox(0.07, 1.86, 0.08, 0.015, honeyWood, 1), bowX + Math.sin(a) * 1.58, 1.78, D / 2 - 0.12 + Math.cos(a) * 0.62, 0, a, 0);
  }
  for (const wy of [1.45, 2.15, 2.68]) {
    K.add(new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.035, 6, 18, PI * 0.92), honeyWood), bowX, wy, D / 2 - 0.12, PI / 2, 0, -PI * 0.96);
  }
  // Built-in window display hat stands with wide-brimmed Storybook sun hats!
  const strawMat = K.M(0xf5d98e, K.tex('hay', 1, 1));
  const lilacMat = K.M(0xc89be8);
  for (const [dx, dz, hStand, brimCol, bandCol, tilt] of [
    [-0.78, 0.24, 0.58, dustyPink, innerWall, 0.18],
    [0.0, 0.34, 0.46, strawMat, dustyPink, -0.14],
    [0.78, 0.22, 0.62, lilacMat, strawMat, 0.16],
  ]) {
    const sx = bowX + dx, sz = D / 2 + dz - 0.1;
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.06, 12), honeyWood), sx, 0.91, sz);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, hStand, 8), honeyWood), sx, 0.91 + hStand / 2, sz);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), innerWall), sx, 0.91 + hStand, sz);
    const hatG = new THREE.Group();
    hatG.position.set(sx, 0.96 + hStand, sz);
    hatG.rotation.set(0.12, 0, tilt);
    K.root.add(hatG);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.03, 16), brimCol), 0, 0, 0, 0, 0, 0, hatG);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 14), brimCol), 0, 0.06, 0, 0, 0, 0, hatG);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.035, 14), bandCol), 0, 0.03, 0, 0, 0, 0, hatG);
  }
  // Striped curved dome awning over bow window (projects outward toward +Z!)
  const awnGeo = new THREE.SphereGeometry(1.78, 20, 10, 0, PI, 0, PI * 0.48);
  awnGeo.scale(1.04, 0.54, 0.62);
  const awn = new THREE.Mesh(awnGeo, stripeMat);
  K.add(awn, bowX, 2.68, D / 2 - 0.04, 0, 0, 0);
  K.add(K.rbox(3.52, 0.16, 0.14, 0.04, dustyPink, 1), bowX, 2.66, bowZ + 0.56);

  // Climbing pink roses up left facade & flower boxes
  for (let i = 0; i < 6; i++) {
    scatterFoliageCluster(THREE, K, -W / 2 + 0.25 + i * 0.12, 0.65 + i * 0.46, D / 2 + 0.14, 0.28, 0.24, 0.16, 8, [0xf68ba8, 0xffc4d4, 0xfff0c8]);
  }
  if (K.garden) {
    for (const px of [doorX - 1.05, doorX + 1.05]) {
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.36, 12), K.M(0xc97b52, K.tex('terracotta', 1, 1))), px, 0.18, D / 2 + 0.48);
      scatterFoliageCluster(THREE, K, px, 0.46, D / 2 + 0.48, 0.24, 0.16, 0.24, 10, [0xf68ba8, 0xffd2de, 0xffe596]);
    }
  }

  // ---------------- ROOF & ICONIC PINK GABLE RIBBON BOW (roofG) ----------------
  const hatterRosePal = [0xd66876, 0xc85b6a, 0xe27886, 0xba5060];
  buildMainGableRoof(THREE, K, W, D, H, 2.45, plaster, roseWood, roofTile, 0.45, 0.48, hatterRosePal);
  buildFrontCrossGable(THREE, K, 1.35, D / 2, -0.4, 4.4, H, 2.35, plaster, sageGreen, roofTile, hatterRosePal);
  addChimney(K, -2.85, H + 1.2, -1.35, 1.85, stoneMat, roseWood);

  // Left roof dormer window
  K.addR(K.rbox(1.15, 0.95, 1.1, 0.04, plaster, 1), -2.35, H + 1.05, D / 2 - 1.05);
  K.addR(new THREE.Mesh(new THREE.ConeGeometry(0.92, 0.65, 4), roofTile), -2.35, H + 1.78, D / 2 - 1.05, 0, PI / 4, 0);
  K.addR(K.rbox(0.68, 0.62, 0.1, 0.02, winGlass, 1), -2.35, H + 1.02, D / 2 - 0.48);

  // Gable window w/ sage shutters + flower box + BIG SCULPTED PINK RIBBON BOW!
  K.addR(K.rbox(1.05, 1.08, 0.14, 0.03, winGlass, 1), 1.35, H + 0.78, D / 2 + 0.04);
  for (const sx of [-1, 1]) {
    K.addR(K.rbox(0.42, 1.06, 0.08, 0.02, sageGreen, 1), 1.35 + sx * 0.78, H + 0.78, D / 2 + 0.07);
  }
  K.addR(K.rbox(1.45, 0.22, 0.28, 0.04, honeyWood, 1), 1.35, H + 0.18, D / 2 + 0.18);
  scatterFoliageCluster(THREE, K, 1.35, H + 0.36, D / 2 + 0.22, 0.62, 0.14, 0.15, 14, [0xf68ba8, 0xffd1dc, 0xfff3b8], K.roofG);

  // Big sculpted dusty-pink ribbon bow on front gable apex!
  const bowY = H + 1.62, bowZf = D / 2 + 0.18;
  K.addR(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), dustyPink), 1.35, bowY, bowZf + 0.04);
  for (const sx of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 8, 16), dustyPink);
    loop.scale.set(1.25, 0.78, 0.55);
    K.addR(loop, 1.35 + sx * 0.42, bowY + 0.05, bowZf, 0, sx * 0.18, sx * 0.22);
    const tail = K.rbox(0.22, 0.68, 0.07, 0.03, dustyPink, 1);
    K.addR(tail, 1.35 + sx * 0.26, bowY - 0.42, bowZf - 0.02, 0, 0, sx * 0.34);
  }

  // ---------------- ROOM 1 (Left: Hat Showroom) ----------------
  // Braided oval rose rug
  const rug1 = new THREE.Mesh(new THREE.CircleGeometry(1.85, 28), rugMat);
  rug1.scale.set(1.12, 0.92, 1);
  K.add(rug1, -2.25, 0.106, 0.35, -PI / 2, 0, 0);

  // Round Tiered Hat Display Table (hero centerpiece of Room 1)
  const tx = -2.35, tz = 0.42;
  K.boxCol(tx, tz, 1.52, 1.52);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.8, 0.68, 20), roseWood), tx, 0.44, tz);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.08, 20), honeyWood), tx, 0.8, tz);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.03, 6, 20), brass), tx, 0.72, tz, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.26, 16), roseWood), tx, 0.96, tz);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 16), honeyWood), tx, 1.1, tz);
  // Display hats on brass stands atop the table
  for (const [hx, hz, hy, hCol, bCol] of [
    [0, 0, 1.38, lilacMat, dustyPink],
    [-0.46, 0.28, 1.08, strawMat, dustyPink],
    [0.46, 0.26, 1.06, dustyPink, innerWall],
    [-0.36, -0.38, 1.05, strawMat, lilacMat],
    [0.38, -0.36, 1.08, sageGreen, strawMat],
  ]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.24, 8), brass), tx + hx, hy - 0.12, tz + hz);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 14), hCol), tx + hx, hy, tz + hz, 0.1, 0, -0.08);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 12), hCol), tx + hx, hy + 0.06, tz + hz, 0.1, 0, -0.08);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 12), bCol), tx + hx, hy + 0.03, tz + hz, 0.1, 0, -0.08);
  }

  // Tall Mahogany Ribbon-Spool Armoire against back wall
  const ax = -1.65, az = -3.12;
  K.boxCol(ax, az, 1.98, 0.72);
  K.add(K.rbox(1.94, 2.65, 0.62, 0.04, darkWood, 1), ax, 1.42, az);
  K.add(K.rbox(2.08, 0.2, 0.72, 0.04, roseWood, 1), ax, 2.8, az);
  for (let sy = 0; sy < 4; sy++) {
    const yS = 1.02 + sy * 0.42;
    K.add(K.rbox(1.76, 0.05, 0.56, 0.01, honeyWood, 1), ax, yS, az + 0.04);
    const spoolGeo = () => new THREE.CylinderGeometry(0.085, 0.085, 0.18, 10);
    const spoolMat = K.M(0xffffff, null, { roughness: 0.75 });
    const spoolCols = [0xf27999, 0xffcf5c, 0xb884e8, 0x6ec49a, 0xff9d5c, 0x7cb8f2];
    for (let k = 0; k < 7; k++) {
      K.pushInst('spool', spoolGeo, spoolMat, ax - 0.72 + k * 0.24, yS + 0.12, az + 0.12, 0, 0, 0, 1, 1, 1, spoolCols[(sy * 3 + k) % spoolCols.length]);
    }
  }

  // ---------------- ROOM 2 (Right: Sewing Machine Worktable & Fabric Studio) ----------------
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.6), rugMat);
  K.add(rug2, 2.45, 0.106, -0.95, -PI / 2, 0, 0);

  // Vintage Treadle Sewing Machine & Lace Worktable against right wall
  const sx = 3.82, sz = -1.15;
  K.boxCol(sx, sz, 1.28, 1.72);
  K.add(K.rbox(0.95, 0.08, 1.65, 0.03, honeyWood, 1), sx, 0.84, sz);
  for (const dx of [-0.38, 0.38]) {
    for (const dz of [-0.68, 0.68]) {
      K.add(K.rbox(0.08, 0.78, 0.08, 0.02, iron, 1), sx + dx, 0.44, sz + dz);
    }
  }
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 14), iron), sx - 0.1, 0.38, sz, 0, PI / 2, 0);
  // White lace cloth runner + black-and-gold cast-iron sewing machine head
  K.add(K.rbox(0.88, 0.04, 0.72, 0.02, innerWall, 1), sx - 0.02, 0.89, sz + 0.22);
  K.add(K.rbox(0.22, 0.32, 0.48, 0.04, iron, 1), sx, 1.06, sz - 0.05);
  K.add(K.rbox(0.16, 0.09, 0.38, 0.03, iron, 1), sx, 1.22, sz - 0.08);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), brass), sx, 1.12, sz - 0.32);
  // Padded red stool tucked beside sewing table
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 14), roseWood), sx - 0.68, 0.54, sz - 0.05);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.46, 8), darkWood), sx - 0.68, 0.28, sz - 0.05);

  // Standing Fabric Bolts & Tailor Wall Shelf against back wall of Room 2
  const fx = 2.45, fz = -3.14;
  K.boxCol(fx, fz, 2.05, 0.68);
  K.add(K.rbox(1.95, 0.48, 0.56, 0.04, honeyWood, 1), fx, 0.34, fz);
  const boltGeo = () => new THREE.CylinderGeometry(0.1, 0.1, 1.15, 10);
  const boltMat = K.M(0xffffff, null, { roughness: 0.82 });
  const boltCols = [0xe86f8c, 0x67b5c9, 0xf2c45a, 0xa87cd9, 0x7ac486, 0xf4ece0];
  for (let i = 0; i < 6; i++) {
    K.pushInst('bolt', boltGeo, boltMat, fx - 0.75 + i * 0.3, 1.08, fz + 0.05, K.jr(-0.08, 0.08), 0, K.jr(-0.1, 0.1), 1, K.jr(0.85, 1.15), 1, boltCols[i]);
  }
  K.add(K.rbox(1.85, 0.08, 0.36, 0.02, honeyWood, 1), fx, 2.15, fz - 0.1);
  // Warm interior ceiling lamps (stay in root at y = 2.95m so interior stays cosy)
  for (const lx of [-2.15, 2.45]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), warmGlow), lx, 2.95, 0.1);
  }

  K.root.userData = {
    floorY: 0.10,
    footprint: { w: W + 0.3, d: D + 0.3 },
    footprintBox: { x: 0, z: 0, w: W + 0.3, d: D + 0.3 },
    door: { x: doorX, z: +(D / 2 + 1.05).toFixed(2) },
    doorIn: { x: doorX, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 0.45, z: 0.35 }],
    rooms: [
      { name: 'Hat Showroom', x: -2.055, z: 0, w: 5.01, d: 7.12, walkX: -0.85, walkZ: 1.85 },
      { name: 'Sewing Studio', x: 2.505, z: 0, w: 4.11, d: 7.12, walkX: 2.05, walkZ: 1.25 },
    ],
    propSlots: [
      { id: 'cw_hatbox_stack', x: -3.78, z: -2.65, rot: 0.35 },
      { id: 'cw_hatbox_stack', x: -3.78, z: -1.52, rot: -0.22 },
      { id: 'cw_hatbox_stack', x: -3.75, z: 2.35, rot: 0.48 },
      { id: 'cw_dress_form', x: -0.32, z: -2.55, rot: -0.45 },
      { id: 'cw_dress_form', x: -3.78, z: 1.05, rot: 1.15 },
      { id: 'cw_gramophone', x: -0.42, z: 2.55, rot: -2.45 },
      { id: 'cw_dress_form', x: 1.22, z: -2.2, rot: 0.42 },
      { id: 'cw_hatbox_stack', x: 3.78, z: 0.85, rot: -1.45 },
      { id: 'cw_hatbox_stack', x: 3.78, z: 1.95, rot: -1.72 },
      { id: 'cw_grandfather_clock', x: 3.82, z: 2.88, rot: -2.35 },
    ],
  };

  K.finalize([]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// 2. WIZARD PARLOR — 'Wizard Portal House'
// ============================================================================
function buildWizardParlor(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'wizard_parlor', 23);
  const W = 9.8, D = 7.8, H = 3.65, th = 0.24;

  const plaster = K.M(0xf2e4cc, K.tex('plaster', 2.2, 1.8));
  const innerWall = K.M(0xfbf0dc, K.tex('plaster', 2.0, 1.6));
  const oakWood = K.M(0x966338, K.tex('wood_light', 1.6, 1.6));
  const darkTimber = K.M(0x5b3924, K.tex('wood_planks_dark', 1.5, 1.5));
  const slatePurple = K.M(0x635b92, texSlateShingles(THREE), { metalness: 0 });
  const stoneMat = K.M(0xcfc2ae, K.tex('stone', 1.8, 1.8));
  const hearthStone = K.M(0xb8a38c, K.tex('stone', 2.2, 2.2));
  const floorStone = K.M(0xe4d2b8, K.tex('stone', 3.6, 3.6));
  const brass = K.M(0xe8b84b, null, { roughness: 0.44, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.15 });
  const iron = K.M(0x4a4d5c, null, { roughness: 0.65, metalness: 0 });
  const leatherBurg = K.M(0x8c3540, K.tex('painted_metal', 1, 1), { metalness: 0 });
  const warmGlow = K.glowMat(0xffe6a3, 0xffa838, 1.55, { metalness: 0 });
  const emberwickGlow = K.glowMat(0xffd25a, 0xff6e14, 2.25, { metalness: 0 });
  const crystalGlow = K.glowMat(0xd68cff, 0x9b38ff, 1.6, { metalness: 0 });
  const winGlass = K.glowMat(0xffe19c, 0xd8882c, 0.6, { metalness: 0 });
  const portalMat = K.M(0xffffff, texPortalWheel(THREE), { emissive: 0xffd27a, emissiveMap: texPortalWheel(THREE), emissiveIntensity: 0.92, roughness: 0.42, metalness: 0 });
  const bannerMat = K.M(0xffffff, texBanner(THREE, 'wiz', '#49307a', 'star'), { metalness: 0 });
  const rugMat = K.M(0xffffff, texRug(THREE, 'wiz', '#5e3473', '#8c4b8e', '#462666', true), { metalness: 0 });

  // Floor & plinth
  K.add(K.rbox(W - 0.12, 0.1, D - 0.12, 0.02, floorStone, 1), 0, 0.05, 0);
  addQuoinsAndPlinth(THREE, K, W, D, H, stoneMat);

  // Exterior walls (+Z front has central-left arched portal doorway)
  const doorX = -0.45, doorW = 1.72;
  K.wall(0, D / 2, 0, W, H, th, [
    { u: -3.25, y0: 1.0, w: 1.25, h: 1.45, round: false },
    { door: true, u: doorX, w: doorW, h: 2.65, arch: true },
    { u: 2.95, y0: 1.0, w: 1.35, h: 1.55, round: false },
  ], plaster, innerWall);
  K.wall(0, -D / 2, PI, W, H, th, [
    { u: -2.4, y0: 1.1, w: 1.35, h: 1.5 },
    { u: 2.4, y0: 1.1, w: 1.35, h: 1.5 },
  ], plaster, innerWall);
  K.wall(-W / 2, 0, -PI / 2, D, H, th, [{ u: 1.8, y0: 1.1, w: 1.2, h: 1.4 }], plaster, innerWall);
  K.wall(W / 2, 0, PI / 2, D, H, th, [{ u: -0.9, y0: 1.1, w: 1.3, h: 1.45 }], plaster, innerWall);

  // Interior partition wall centered at x = 0.65 with arched doorway (w = 1.72m at z = 0.45)
  K.wall(0.76, 0, PI / 2, D - 2 * th, H, 0.22, [
    { door: true, u: -0.45, w: 1.72, h: 2.74, arch: true },
  ], innerWall, innerWall);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.90, 0.09, 6, 16, PI), oakWood), 0.65, 1.88, 0.45, 0, PI / 2, 0);

  // Windows, entrance arch, steps, lanterns & purple star banners
  addWindowDress(THREE, K, -3.25, 1.72, D / 2, 1.25, 1.45, 0, oakWood, winGlass, stoneMat);
  addWindowDress(THREE, K, 2.95, 1.77, D / 2, 1.35, 1.55, 0, oakWood, winGlass, stoneMat);
  addWindowDress(THREE, K, -2.4, 1.85, -D / 2, 1.35, 1.5, PI, oakWood, winGlass, stoneMat);
  addWindowDress(THREE, K, 2.4, 1.85, -D / 2, 1.35, 1.5, PI, oakWood, winGlass, stoneMat);
  addWindowDress(THREE, K, -W / 2, 1.8, 1.8, 1.2, 1.4, -PI / 2, oakWood, winGlass, stoneMat);
  addWindowDress(THREE, K, W / 2, 1.82, 0.9, 1.3, 1.45, PI / 2, oakWood, winGlass, stoneMat);

  addArchedDoorSurround(THREE, K, doorX, D / 2, doorW, 2.6, stoneMat, oakWood, iron);
  addStoneSteps(K, doorX, D / 2, doorW, stoneMat);
  addCoachLantern(THREE, K, doorX - 1.15, 2.22, D / 2 + 0.16, brass, warmGlow);
  addCoachLantern(THREE, K, doorX + 1.15, 2.22, D / 2 + 0.16, brass, warmGlow);

  // Two royal-purple golden-star banners flanking the front gable
  for (const bx of [doorX - 1.75, doorX + 1.75]) {
    K.add(K.rbox(0.82, 0.07, 0.14, 0.02, brass, 1), bx, 3.05, D / 2 + 0.15);
    K.add(K.rbox(0.68, 1.45, 0.04, 0.01, bannerMat, 1), bx, 2.3, D / 2 + 0.16);
  }
  // Crooked half-timber braces
  for (const bx of [-4.72, -2.15, 1.38, 4.72]) {
    K.add(K.rbox(0.14, H, 0.13, 0.02, darkTimber, 1), bx, H / 2, D / 2 + 0.02);
  }
  K.beam([-4.65, 2.1, D / 2 + 0.03], [-2.2, 3.45, D / 2 + 0.03], 0.11, darkTimber);
  // Autumn orange/gold ivy & purple flowers on facade
  for (let i = 0; i < 5; i++) {
    scatterFoliageCluster(THREE, K, -3.5 + i * 0.42, 2.65 + (i % 2) * 0.25, D / 2 + 0.15, 0.35, 0.22, 0.15, 7, [0xf2842c, 0xffbe3d, 0xb67ef2]);
  }

  // ---------------- ROOF, CONICAL CORNER TURRET & SPINNING ASTROLABE DIAL ----------------
  const wizPurplePal = [0x635b92, 0x7268a4, 0x544d80, 0x7d73b2];
  buildMainGableRoof(THREE, K, W, D, H, 2.65, plaster, oakWood, slatePurple, 0.45, 0.48, wizPurplePal);
  buildFrontCrossGable(THREE, K, doorX, D / 2, -0.5, 4.9, H, 2.95, plaster, oakWood, slatePurple, wizPurplePal);
  // Two crooked stone chimneys on left + rooftop cupola lantern
  addChimney(K, -3.35, H + 1.1, -0.85, 2.05, stoneMat, oakWood);
  addChimney(K, -2.15, H + 1.5, -1.65, 2.25, stoneMat, oakWood);
  K.addR(K.rbox(1.15, 1.05, 1.15, 0.04, oakWood, 1), 0.75, H + 2.75, -0.2);
  K.addR(K.rbox(0.86, 0.62, 0.86, 0.02, winGlass, 1), 0.75, H + 2.8, -0.2);
  K.addR(new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.15, 4), slatePurple), 0.75, H + 3.82, -0.2, 0, PI / 4, 0);

  // Conical purple-slate Corner Turret on front-right (roofG)
  const turX = 2.85, turZ = 2.15;
  K.addR(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.08, 1.85, 16), stoneMat), turX, H + 1.15, turZ);
  K.addR(new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.24, 0.22, 16), oakWood), turX, H + 2.05, turZ);
  for (let i = 0; i < 4; i++) {
    const a = -PI * 0.35 + i * 0.52;
    K.addR(K.rbox(0.42, 0.78, 0.12, 0.02, winGlass, 1), turX + Math.sin(a) * 1.13, H + 1.32, turZ + Math.cos(a) * 1.13, 0, a, 0);
  }
  K.addR(new THREE.Mesh(new THREE.ConeGeometry(1.52, 2.45, 18), slatePurple), turX, H + 3.32, turZ);
  K.coneRoofTiles({ cx: turX, yBase: H + 2.12, cz: turZ, rBase: 1.54, height: 2.42, rTop: 0.12, style: 'slate', palette: wizPurplePal, parent: K.roofG });
  K.addR(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), brass), turX, H + 4.62, turZ);

  // GIANT GLOWING BRASS ASTROLABE DIAL on front gable (kept via finalize([portalWheel]))
  const portalY = H + 1.28, portalZ = D / 2 + 0.14;
  K.addR(new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.11, 8, 28), brass), doorX, portalY, portalZ - 0.02);
  const portalWheel = new THREE.Group();
  portalWheel.name = 'portalWheel';
  portalWheel.position.set(doorX, portalY, portalZ);
  K.roofG.add(portalWheel);
  const wheelDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.34, 0.1, 28), portalMat);
  wheelDisc.rotation.x = PI / 2;
  portalWheel.add(wheelDisc);
  portalWheel.add(new THREE.Mesh(makeGearGeo(THREE, 1.48, 0.08, 20, 4), brass));

  // ---------------- ROOM 1 (Left: Stone Fireplace w/ Log Fire & Kettle + Interior Compass Dial) ----------------
  const rug1 = new THREE.Mesh(new THREE.CircleGeometry(1.95, 28), rugMat);
  K.add(rug1, -1.95, 0.106, -0.35, -PI / 2, 0, 0);

  // Stone Fireplace w/ crackling log fire & hanging iron kettle on left wall
  const hx = -4.06, hz = -0.15;
  K.boxCol(hx, hz, 1.16, 2.32);
  K.add(K.rbox(1.1, 2.55, 2.28, 0.06, hearthStone, 1), hx, 1.32, hz);
  K.add(K.rbox(1.24, 0.18, 2.46, 0.04, oakWood, 1), hx + 0.04, 2.18, hz);
  K.add(K.rbox(0.88, 1.15, 1.65, 0.05, hearthStone, 1), hx - 0.05, 3.02, hz);
  // Dark firebox + crossed oak logs + plain tapering flames (no face) + black round cauldron kettle above
  K.add(K.rbox(0.55, 1.22, 1.32, 0.04, iron, 1), hx + 0.34, 0.76, hz);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.92, 8), darkTimber), hx + 0.70, 0.19, hz, PI / 2, 0, 0.18);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.86, 8), darkTimber), hx + 0.78, 0.30, hz, PI / 2, 0, -0.24);
  for (const [fz, fh, fr, fy] of [[0, 0.62, 0.18, 0.62], [-0.25, 0.42, 0.14, 0.50], [0.26, 0.46, 0.15, 0.52], [0.11, 0.30, 0.10, 0.44]]) {
    K.add(new THREE.Mesh(new THREE.ConeGeometry(fr, fh, 8), emberwickGlow), hx + 0.70, fy, hz + fz, fz * 0.35, 0, 0);
  }
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), iron), hx + 0.42, 1.08, hz);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 14, PI), iron), hx + 0.42, 1.22, hz, 0, PI / 2, 0);

  // Tufted Burgundy Wingback Armchair & small round tea table
  const cx = -2.42, cz = -0.82;
  K.boxCol(cx, cz, 1.15, 1.15);
  K.add(K.rbox(0.92, 0.42, 0.88, 0.12, leatherBurg, 2), cx, 0.36, cz, 0, -0.55, 0);
  K.add(K.rbox(0.92, 0.95, 0.26, 0.1, leatherBurg, 2), cx + 0.18, 0.88, cz - 0.26, 0, -0.55, 0);
  for (const s of [-1, 1]) {
    K.add(K.rbox(0.22, 0.45, 0.82, 0.08, leatherBurg, 2), cx + s * 0.36, 0.58, cz, 0, -0.55, 0);
  }

  // Interior Standing Brass Portal Dial against back wall of Room 1
  const px = -1.05, pz = -3.08;
  K.boxCol(px, pz, 1.62, 0.85);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.56, 18), brass), px, 0.38, pz);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.45, 0.08, 12, 5), brass), px + 0.42, 0.72, pz + 0.28);
  const inDial = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.1, 24), portalMat);
  K.add(inDial, px, 1.85, pz, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.08, 8, 24), brass), px, 1.85, pz);

  // ---------------- ROOM 2 (Right: Spellbook Library & Astrolabe Desk) ----------------
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), rugMat);
  K.add(rug2, 2.75, 0.106, -0.85, -PI / 2, 0, 0);

  // Tall Spellbook Library Shelves along back & right-back walls
  K.boxCol(2.65, -3.25, 3.25, 0.68);
  K.add(K.rbox(3.2, 2.85, 0.58, 0.04, darkTimber, 1), 2.65, 1.52, -3.25);
  K.boxCol(4.25, -1.55, 0.68, 2.55);
  K.add(K.rbox(0.58, 2.85, 2.5, 0.04, darkTimber, 1), 4.25, 1.52, -1.55);
  const bookGeo = () => new RoundedBoxGeometry(0.09, 0.32, 0.26, 1, 0.015);
  const bookMat = K.M(0xffffff, null, { roughness: 0.82 });
  const bookCols = [0x9c3238, 0x2e5e9c, 0x3b7a4c, 0xc98b2e, 0x6e3b8c, 0xb85238];
  for (let sy = 0; sy < 4; sy++) {
    const yB = 0.65 + sy * 0.58;
    K.add(K.rbox(3.05, 0.06, 0.54, 0.01, oakWood, 1), 2.65, yB, -3.22);
    for (let k = 0; k < 18; k++) {
      K.pushInst('book', bookGeo, bookMat, 1.25 + k * 0.16, yB + 0.19, -3.12, 0, 0, K.jr(-0.08, 0.08), 1, K.jr(0.82, 1.14), 1, bookCols[(sy * 5 + k) % bookCols.length]);
    }
  }

  // Wizard's Carved Desk w/ Open Illuminated Grimoire, Glowing Crystal & Brass Astrolabe
  const dx = 2.68, dz = -1.05;
  K.boxCol(dx, dz, 1.72, 0.96);
  K.add(K.rbox(1.68, 0.82, 0.88, 0.04, oakWood, 1), dx, 0.51, dz);
  K.add(K.rbox(1.76, 0.08, 0.96, 0.03, darkTimber, 1), dx, 0.92, dz);
  // Open grimoire + glowing amethyst crystal + mini brass astrolabe
  K.add(K.rbox(0.46, 0.08, 0.34, 0.02, innerWall, 1), dx - 0.32, 1.0, dz, 0.16, 0.1, 0);
  for (let c = 0; c < 3; c++) {
    K.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28 - c * 0.04, 6), crystalGlow), dx - 0.66 + c * 0.07, 1.08, dz - 0.15, c * 0.15, 0, (c - 1) * 0.22);
  }
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.08, 12), brass), dx + 0.44, 0.99, dz - 0.05);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 6, 16), brass), dx + 0.44, 1.25, dz - 0.05, 0.4, 0.3, 0);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 16), brass), dx + 0.44, 1.25, dz - 0.05, -0.5, 0.9, 0);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), warmGlow), dx + 0.44, 1.25, dz - 0.05);

  for (const lx of [-1.85, 2.65]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), warmGlow), lx, 3.05, 0.2);
  }

  K.root.userData = {
    floorY: 0.10,
    footprint: { w: W + 0.3, d: D + 0.3 },
    footprintBox: { x: 0, z: 0, w: W + 0.3, d: D + 0.3 },
    door: { x: doorX, z: +(D / 2 + 1.05).toFixed(2) },
    doorIn: { x: doorX, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 0.65, z: 0.45 }],
    rooms: [
      { name: 'Emberwick Hearth Parlor', x: -2.005, z: 0, w: 5.31, d: 7.32, walkX: -0.65, walkZ: 1.45 },
      { name: 'Spellbook & Astrolabe Study', x: 2.655, z: 0, w: 4.01, d: 7.32, walkX: 2.15, walkZ: 1.35 },
    ],
    propSlots: [
      { id: 'cw_coal_hearth_pot', x: -3.45, z: 1.95, rot: 0.78 },
      { id: 'cw_coal_hearth_pot', x: -3.45, z: -1.85, rot: 1.85 },
      { id: 'cw_spellbook_lectern', x: -2.95, z: -2.85, rot: 0.35 },
      { id: 'cw_automaton_owl', x: 0.02, z: -2.72, rot: -0.42 },
      { id: 'cw_dress_form', x: -3.78, z: 2.95, rot: 2.32 },
      { id: 'cw_spellbook_lectern', x: 1.55, z: 2.48, rot: -2.62 },
      { id: 'cw_spellbook_lectern', x: 2.75, z: 2.68, rot: -3.02 },
      { id: 'cw_brass_orrery', x: 3.78, z: 1.65, rot: -1.52 },
      { id: 'cw_brass_orrery', x: 3.78, z: 0.45, rot: -1.82 },
      { id: 'cw_automaton_owl', x: 1.48, z: -1.95, rot: 0.62 },
    ],
  };

  K.finalize([portalWheel]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// 3. CLOCKMAKER HALL — 'Clockmaker Guildhall'
// ============================================================================
function buildClockmakerHall(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'clockmaker_hall', 37);
  const W = 10.0, D = 7.8, H = 3.7, th = 0.24;

  const butterPlaster = K.M(0xf7dc8a, K.tex('plaster', 2.2, 1.8));
  const innerWall = K.M(0xfff3d4, K.tex('plaster', 2.0, 1.6));
  const honeyTimber = K.M(0xa66e38, K.tex('wood_light', 1.5, 1.5));
  const darkOak = K.M(0x633d22, K.tex('wood_planks_dark', 1.5, 1.5));
  const slateBlue = K.M(0x5c6884, texSlateShingles(THREE), { metalness: 0 });
  const stoneMat = K.M(0xd6c8b2, K.tex('stone', 1.8, 1.8));
  const floorStone = K.M(0xe6d6bc, K.tex('stone', 3.6, 3.6));
  const brass = K.M(0xe8b84b, null, { roughness: 0.42, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const copper = K.M(0xc97842, null, { roughness: 0.46, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
  const iron = K.M(0x4a4d5c, null, { roughness: 0.64, metalness: 0 });
  const warmGlow = K.glowMat(0xffe7a8, 0xffae3d, 1.5, { metalness: 0 });
  const winGlass = K.glowMat(0xffe29c, 0xd88a2e, 0.58, { metalness: 0 });
  const clockMat = K.M(0xffffff, texClockFace(THREE), { roughness: 0.55, metalness: 0 });
  const bannerMat = K.M(0xffffff, texBanner(THREE, 'clock', '#5a2d78', 'gear'), { metalness: 0 });
  const compassMat = K.M(0xffffff, texRug(THREE, 'clock_compass', '#b89f7d', '#dfc99f', '#8c6f48', true), { metalness: 0 });

  // Floor & plinth
  K.add(K.rbox(W - 0.12, 0.1, D - 0.12, 0.02, floorStone, 1), 0, 0.05, 0);
  addQuoinsAndPlinth(THREE, K, W, D, H, stoneMat);

  // Exterior walls (+Z front has center-left arched guildhall doorway & workshop windows)
  const doorX = -0.85, doorW = 1.72;
  K.wall(0, D / 2, 0, W, H, th, [
    { u: -3.55, y0: 0.98, w: 1.28, h: 1.5 },
    { door: true, u: doorX, w: doorW, h: 2.66, arch: true },
    { u: 2.65, y0: 0.92, w: 2.35, h: 1.65 },
  ], butterPlaster, innerWall);
  K.wall(0, -D / 2, PI, W, H, th, [
    { u: -2.6, y0: 1.1, w: 1.4, h: 1.5 },
    { u: 2.5, y0: 1.1, w: 1.4, h: 1.5 },
  ], butterPlaster, innerWall);
  K.wall(-W / 2, 0, -PI / 2, D, H, th, [{ u: 0.5, y0: 1.05, w: 1.35, h: 1.5 }], butterPlaster, innerWall);
  K.wall(W / 2, 0, PI / 2, D, H, th, [{ u: -0.6, y0: 1.05, w: 1.35, h: 1.5 }], butterPlaster, innerWall);

  // Interior partition wall centered at x = 0.55 with wide archway (w = 1.72m at z = 0.55)
  K.wall(0.66, 0, PI / 2, D - 2 * th, H, 0.22, [
    { door: true, u: -0.55, w: 1.72, h: 2.76, arch: true },
  ], innerWall, innerWall);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.90, 0.09, 6, 16, PI), honeyTimber), 0.55, 1.90, 0.55, 0, PI / 2, 0);

  // Windows & entrance surround
  addWindowDress(THREE, K, -3.55, 1.73, D / 2, 1.28, 1.5, 0, honeyTimber, winGlass, stoneMat);
  addWindowDress(THREE, K, 2.65, 1.75, D / 2, 2.35, 1.65, 0, honeyTimber, winGlass, stoneMat);
  addWindowDress(THREE, K, 2.6, 1.85, -D / 2, 1.4, 1.5, PI, honeyTimber, winGlass, stoneMat);
  addWindowDress(THREE, K, -2.5, 1.85, -D / 2, 1.4, 1.5, PI, honeyTimber, winGlass, stoneMat);
  addWindowDress(THREE, K, -W / 2, 1.8, 0.5, 1.35, 1.5, -PI / 2, honeyTimber, winGlass, stoneMat);
  addWindowDress(THREE, K, W / 2, 1.8, 0.6, 1.35, 1.5, PI / 2, honeyTimber, winGlass, stoneMat);

  addArchedDoorSurround(THREE, K, doorX, D / 2, doorW, 2.62, stoneMat, honeyTimber, iron);
  addStoneSteps(K, doorX, D / 2, doorW, stoneMat);
  addCoachLantern(THREE, K, doorX - 1.15, 2.24, D / 2 + 0.16, brass, warmGlow);
  addCoachLantern(THREE, K, doorX + 1.15, 2.24, D / 2 + 0.16, brass, warmGlow);

  // Guild banners & right-side exposed timber gear arcade on front facade
  for (const bx of [doorX - 1.72, doorX + 1.72]) {
    K.add(K.rbox(0.78, 0.07, 0.14, 0.02, brass, 1), bx, 3.05, D / 2 + 0.15);
    K.add(K.rbox(0.64, 1.4, 0.04, 0.01, bannerMat, 1), bx, 2.32, D / 2 + 0.16);
  }
  for (const bx of [-4.82, -2.65, 0.95, 2.65, 4.82]) {
    K.add(K.rbox(0.15, H, 0.14, 0.02, honeyTimber, 1), bx, H / 2, D / 2 + 0.03);
  }
  // Decorative brass cogwheels mounted prominently on right front workshop bay
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.72, 0.09, 14, 6), brass), 2.15, 2.98, D / 2 + 0.12);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.56, 0.09, 12, 5), copper), 3.35, 2.95, D / 2 + 0.12);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.44, 0.08, 10, 5), brass), 4.25, 2.45, D / 2 + 0.12);

  // ---------------- ROOF, HUGE ROMAN CLOCKFACE & SPINNING GEARS ----------------
  const clockSlatePal = [0x5c6884, 0x6a7896, 0x4e5973, 0x7482a0];
  buildMainGableRoof(THREE, K, W, D, H, 2.6, butterPlaster, honeyTimber, slateBlue, 0.45, 0.48, clockSlatePal);
  buildFrontCrossGable(THREE, K, -0.55, D / 2, -0.5, 5.6, H, 2.95, butterPlaster, honeyTimber, slateBlue, clockSlatePal);
  addChimney(K, 3.35, H + 1.25, -1.2, 1.9, stoneMat, honeyTimber);
  // Rooftop brass weather-wheel / armillary finial
  K.addR(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.85, 10), brass), 1.45, H + 2.95, 0);
  K.addR(new THREE.Mesh(makeGearGeo(THREE, 0.62, 0.06, 16, 8), brass), 1.45, H + 3.85, 0);

  // Huge Exterior Roman-Numeral Brass Clockface on front gable!
  const clkX = -0.55, clkY = H + 1.18, clkZ = D / 2 + 0.14;
  K.addR(new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.12, 8, 28), brass), clkX, clkY, clkZ + 0.02);
  const faceMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.08, 28), clockMat);
  K.addR(faceMesh, clkX, clkY, clkZ, PI / 2, 0, 0);

  // Animated clockHands + exposed interlocking gearA & gearB (kept via finalize([clockHands, gearA, gearB]))
  const clockHands = new THREE.Group();
  clockHands.name = 'clockHands';
  clockHands.position.set(clkX, clkY, clkZ + 0.09);
  K.roofG.add(clockHands);
  clockHands.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), iron));
  const minHand = K.rbox(0.09, 1.12, 0.04, 0.02, iron, 1);
  minHand.position.set(0, 0.46, 0);
  clockHands.add(minHand);
  const hrHand = K.rbox(0.11, 0.76, 0.04, 0.02, copper, 1);
  hrHand.position.set(0.24, 0.22, 0.02);
  hrHand.rotation.z = -0.82;
  clockHands.add(hrHand);

  const gearA = new THREE.Group();
  gearA.name = 'gearA';
  gearA.position.set(1.18, H + 0.62, D / 2 + 0.14);
  K.roofG.add(gearA);
  gearA.add(new THREE.Mesh(makeGearGeo(THREE, 0.82, 0.1, 16, 6), brass));

  const gearB = new THREE.Group();
  gearB.name = 'gearB';
  gearB.position.set(2.26, H + 0.12, D / 2 + 0.16);
  K.roofG.add(gearB);
  gearB.add(new THREE.Mesh(makeGearGeo(THREE, 0.58, 0.1, 12, 5), copper));

  // ---------------- ROOM 1 (Left: Towering Brass Pendulum & Gear Wall) ----------------
  const compassDisc = new THREE.Mesh(new THREE.CircleGeometry(2.05, 28), compassMat);
  K.add(compassDisc, -2.15, 0.106, 0.35, -PI / 2, 0, 0);

  // Monumental Brass Pendulum & Interlocking Gear Wall against back wall
  const px = -2.15, pz = -2.85;
  K.boxCol(px, pz, 3.45, 1.42);
  // Timber arch frame + giant interlocking cogwheels + gleaming brass pendulum bob
  for (const sx of [-1, 1]) {
    K.add(K.rbox(0.28, 3.25, 0.42, 0.04, honeyTimber, 1), px + sx * 1.55, 1.68, pz - 0.35);
  }
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.14, 8, 22, PI), honeyTimber), px, 1.95, pz - 0.35);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 1.15, 0.1, 20, 6), brass), px, 2.35, pz - 0.42);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.72, 0.1, 14, 5), copper), px - 0.95, 1.65, pz - 0.32);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.68, 0.1, 14, 5), brass), px + 0.98, 1.75, pz - 0.32);
  // Gleaming brass pendulum rod & heavy golden bob
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.15, 8), brass), px, 2.15, pz - 0.12);
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), brass);
  bob.scale.set(1, 1, 0.48);
  K.add(bob, px, 1.15, pz - 0.12);
  // Curved brass balustrade railing in front of pendulum pit
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.58, 0.18, 20), stoneMat), px, 0.18, pz + 0.02);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.045, 6, 20, PI), brass), px, 0.88, pz + 0.02, PI / 2, 0, 0);
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * PI;
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.72, 8), brass), px - Math.cos(a) * 1.48, 0.52, pz + Math.sin(a) * 0.62);
  }

  // ---------------- ROOM 2 (Right: Chime-Bell Loft & Watchmaker Bench) ----------------
  // Overhead timber belfry rack w/ 4 graduated brass chime bells (at y = 2.68m — full headroom!)
  K.add(K.rbox(3.4, 0.16, 0.22, 0.03, honeyTimber, 1), 2.75, 3.12, -1.55);
  K.add(K.rbox(3.4, 0.08, 0.65, 0.02, honeyTimber, 1), 2.75, 2.58, -2.15);
  for (let b = 0; b < 4; b++) {
    const bx = 1.55 + b * 0.8, rBell = 0.18 + (b % 2) * 0.04;
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(rBell * 0.45, rBell, 0.38, 14), brass), bx, 2.82, -1.55);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), copper), bx, 2.61, -1.55);
  }

  // Long Watchmaker's Workbench w/ drawers, brass desk lamp & stool along back-right wall
  const wx = 2.88, wz = -2.95;
  K.boxCol(wx, wz, 2.88, 0.95);
  K.add(K.rbox(2.82, 0.84, 0.88, 0.04, honeyTimber, 1), wx, 0.48, wz);
  K.add(K.rbox(2.92, 0.08, 0.94, 0.03, darkOak, 1), wx, 0.92, wz);
  // Brass watchmaker lamp + tiny scattered gears + red watchmaker stool
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.06, 10), brass), wx + 0.85, 0.99, wz - 0.12);
  K.add(K.rbox(0.04, 0.36, 0.04, 0.01, brass, 1), wx + 0.92, 1.16, wz - 0.12, 0, 0, 0.32);
  K.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 12), brass), wx + 0.72, 1.28, wz - 0.08, 0, 0, -0.4);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), warmGlow), wx + 0.7, 1.21, wz - 0.08);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 14), K.M(0xb84244)), wx - 0.1, 0.56, wz + 0.62);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.46, 8), darkOak), wx - 0.1, 0.3, wz + 0.62);

  for (const lx of [-2.05, 2.75]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), warmGlow), lx, 3.12, 0.35);
  }

  K.root.userData = {
    floorY: 0.10,
    footprint: { w: W + 0.3, d: D + 0.3 },
    footprintBox: { x: 0, z: 0, w: W + 0.3, d: D + 0.3 },
    door: { x: doorX, z: +(D / 2 + 1.05).toFixed(2) },
    doorIn: { x: doorX, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 0.55, z: 0.55 }],
    rooms: [
      { name: 'Great Pendulum Hall', x: -2.105, z: 0, w: 5.31, d: 7.32, walkX: -1.35, walkZ: 1.45 },
      { name: 'Chime-Bell & Watchmaker Loft', x: 2.655, z: 0, w: 4.21, d: 7.32, walkX: 2.15, walkZ: 1.25 },
    ],
    propSlots: [
      { id: 'cw_grandfather_clock', x: -4.08, z: -1.42, rot: 1.57 },
      { id: 'cw_grandfather_clock', x: -4.08, z: 0.25, rot: 1.57 },
      { id: 'cw_grandfather_clock', x: -4.08, z: 2.15, rot: 1.57 },
      { id: 'cw_brass_orrery', x: -2.65, z: 2.68, rot: -2.8 },
      { id: 'cw_automaton_owl', x: 0.02, z: 2.75, rot: -2.5 },
      { id: 'cw_grandfather_clock', x: 4.08, z: -0.95, rot: -1.57 },
      { id: 'cw_automaton_owl', x: 3.92, z: 1.15, rot: -1.6 },
      { id: 'cw_automaton_owl', x: 3.92, z: 2.35, rot: -2.1 },
      { id: 'cw_gramophone', x: 1.55, z: 2.65, rot: -2.9 },
      { id: 'cw_brass_orrery', x: 2.75, z: 2.75, rot: 3.1 },
    ],
  };

  K.finalize([clockHands, gearA, gearB]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// 4. ALCHEMIST SHOP — 'Stained-Glass Apothecary'
// ============================================================================
function buildAlchemistShop(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'alchemist_shop', 53);
  const W = 9.6, D = 7.6, H = 3.55, th = 0.24;

  const lavPlaster = K.M(0xdcc2f2, K.tex('plaster', 2.2, 1.8));
  const innerWall = K.M(0xf7ecfc, K.tex('plaster', 2.0, 1.6));
  const walnut = K.M(0x5e3b2e, K.tex('wood_planks_dark', 1.5, 1.5));
  const honeyWood = K.M(0xa87444, K.tex('wood_light', 1.5, 1.5));
  const slateViolet = K.M(0x66588c, texSlateShingles(THREE), { metalness: 0 });
  const stoneMat = K.M(0xd3c4b4, K.tex('stone', 1.8, 1.8));
  const floorStone = K.M(0xdecab8, K.tex('stone', 3.5, 3.5));
  const brass = K.M(0xe8b84b, null, { roughness: 0.44, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.15 });
  const copper = K.M(0xc97842, null, { roughness: 0.46, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
  const iron = K.M(0x4a4d5c, null, { roughness: 0.64, metalness: 0 });
  const warmGlow = K.glowMat(0xffe6a6, 0xffac38, 1.45, { metalness: 0 });
  const potionGlow = K.glowMat(0xf498ff, 0xc838ff, 1.85, { metalness: 0 });
  const cyanGlow = K.glowMat(0x88f4ff, 0x1fc4e8, 1.45, { metalness: 0 });
  const winGlass = K.glowMat(0xffe3a4, 0xd88a32, 0.58, { metalness: 0 });
  const stainedMat = K.M(0xffffff, texStainedFlask(THREE), {
    emissive: 0xe698ff,
    emissiveMap: texStainedFlask(THREE),
    emissiveIntensity: 0.96,
    roughness: 0.38,
    metalness: 0,
  });
  const rugMat = K.M(0xffffff, texRug(THREE, 'alch', '#6b3b7d', '#a8649e', '#e2b878', false), { metalness: 0 });

  // Floor & plinth
  K.add(K.rbox(W - 0.12, 0.1, D - 0.12, 0.02, floorStone, 1), 0, 0.05, 0);
  addQuoinsAndPlinth(THREE, K, W, D, H, stoneMat);

  // Exterior walls (+Z front has curved apothecary bay on left & hooded arched door on right)
  const doorX = 1.85, doorW = 1.72;
  K.wall(0, D / 2, 0, W, H, th, [
    { u: -2.05, y0: 0.78, w: 2.85, h: 1.85 },
    { door: true, u: doorX, w: doorW, h: 2.60, arch: true },
  ], lavPlaster, innerWall);
  K.wall(0, -D / 2, PI, W, H, th, [
    { u: -2.35, y0: 1.05, w: 1.35, h: 1.45 },
    { u: 2.35, y0: 1.05, w: 1.35, h: 1.45 },
  ], lavPlaster, innerWall);
  K.wall(-W / 2, 0, -PI / 2, D, H, th, [{ u: 0.2, y0: 1.05, w: 1.3, h: 1.45 }], lavPlaster, innerWall);
  K.wall(W / 2, 0, PI / 2, D, H, th, [{ u: -0.9, y0: 1.05, w: 1.3, h: 1.45 }], lavPlaster, innerWall);

  // Interior partition wall centered at x = 0.45 with stone/timber arch (w = 1.72m at z = 0.45)
  K.wall(0.56, 0, PI / 2, D - 2 * th, H, 0.22, [
    { door: true, u: -0.45, w: 1.72, h: 2.72, arch: true },
  ], innerWall, innerWall);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.90, 0.085, 6, 16, PI), walnut), 0.45, 1.86, 0.45, 0, PI / 2, 0);

  // Windows & entrance surround + peaked porch hood
  addWindowDress(THREE, K, 2.35, 1.78, -D / 2, 1.35, 1.45, PI, walnut, winGlass, stoneMat);
  addWindowDress(THREE, K, -2.35, 1.78, -D / 2, 1.35, 1.45, PI, walnut, winGlass, stoneMat);
  addWindowDress(THREE, K, -W / 2, 1.78, 0.2, 1.3, 1.45, -PI / 2, walnut, winGlass, stoneMat);
  addWindowDress(THREE, K, W / 2, 1.78, 0.9, 1.3, 1.45, PI / 2, walnut, winGlass, stoneMat);

  addArchedDoorSurround(THREE, K, doorX, D / 2, doorW, 2.56, stoneMat, honeyWood, iron);
  addStoneSteps(K, doorX, D / 2, doorW, stoneMat);
  addCoachLantern(THREE, K, doorX, 2.78, D / 2 + 0.42, brass, warmGlow);
  // Peaked walnut porch hood over doorway
  for (const sx of [-1, 1]) {
    K.add(K.rbox(1.18, 0.14, 0.85, 0.03, slateViolet, 1), doorX + sx * 0.48, 3.05, D / 2 + 0.34, 0, 0, -sx * 0.48);
  }

  // Wrought-iron hanging Glowing Potion Retort Sign on front-right corner
  K.add(K.rbox(0.96, 0.07, 0.07, 0.02, iron, 1), W / 2 + 0.42, 2.95, D / 2 - 0.35);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 16), brass), W / 2 + 0.58, 2.5, D / 2 - 0.35);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), warmGlow), W / 2 + 0.58, 2.44, D / 2 - 0.35);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), warmGlow), W / 2 + 0.58, 2.64, D / 2 - 0.35);

  // Curved Apothecary Bay Window on front-left filled with glowing rainbow flasks
  const bayX = -2.05;
  K.boxCol(bayX, D / 2 + 0.2, 2.95, 0.58);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.56, 0.82, 14, 1, false, -PI * 0.48, PI * 0.96), stoneMat), bayX, 0.42, D / 2 - 0.1);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.58, 0.1, 14, 1, false, -PI * 0.5, PI), walnut), bayX, 0.84, D / 2 - 0.1);
  for (let i = -3; i <= 3; i++) {
    const a = (i / 3) * PI * 0.44;
    K.add(K.rbox(0.07, 1.82, 0.08, 0.015, walnut, 1), bayX + Math.sin(a) * 1.48, 1.74, D / 2 - 0.1 + Math.cos(a) * 0.58, 0, a, 0);
  }
  K.add(new THREE.Mesh(new THREE.ConeGeometry(1.65, 0.58, 14, 1, false, -PI * 0.5, PI), slateViolet), bayX, 2.86, D / 2 - 0.02);
  // Glowing flasks in bay window
  for (const [fx, fMat] of [[-0.68, cyanGlow], [-0.22, potionGlow], [0.24, warmGlow], [0.68, cyanGlow]]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), fMat), bayX + fx, 1.02, D / 2 + 0.22);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), fMat), bayX + fx, 1.16, D / 2 + 0.22);
  }

  // LUSH CASCADING PURPLE WISTERIA draping across left eave, roof & bay window!
  const wisteriaGeo = () => new THREE.ConeGeometry(0.16, 0.56, 6);
  const wisteriaMat = K.M(0xffffff, null, { roughness: 0.78 });
  const wistCols = [0xb67ef5, 0x9b5de5, 0xd8a8ff, 0x864ed4, 0xe8ccff];
  for (let i = 0; i < 46; i++) {
    const wx = -4.75 + (i / 45) * 4.8 + K.jr(-0.14, 0.14);
    const wy = 2.48 + Math.sin((i / 45) * PI) * 0.62 + K.jr(-0.28, 0.24);
    const wz = D / 2 + 0.36 + (wx > -3.6 && wx < -0.5 ? 0.38 : 0.08) + K.jr(-0.12, 0.14);
    K.pushInst('wisteria', wisteriaGeo, wisteriaMat, wx, wy, wz, PI + K.jr(-0.16, 0.16), K.jr(0, 3), K.jr(-0.16, 0.16), K.jr(0.95, 1.4), K.jr(1.0, 1.65), K.jr(0.95, 1.4), K.pick(wistCols));
  }
  scatterFoliageCluster(THREE, K, -2.35, 3.18, D / 2 + 0.42, 2.3, 0.28, 0.28, 28, [0xc592ff, 0x9e63eb]);

  // ---------------- ROOF & GLOWING POTION-FLASK STAINED-GLASS GABLE (roofG) ----------------
  const alchVioletPal = [0x685a92, 0x7666a4, 0x584b80, 0x8272b2];
  buildMainGableRoof(THREE, K, W, D, H, 2.55, lavPlaster, walnut, slateViolet, 0.45, 0.48, alchVioletPal);
  buildFrontCrossGable(THREE, K, 0.15, D / 2, -0.45, 5.2, H, 2.85, lavPlaster, walnut, slateViolet, alchVioletPal);
  addChimney(K, -3.15, H + 1.15, -1.25, 2.0, stoneMat, walnut);

  // Gothic-arched Glowing Potion-Flask Stained-Glass Window in front gable
  const sgX = 0.15, sgY = H + 1.08, sgZ = D / 2 + 0.14;
  const sgPane = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.08, 24), stainedMat);
  K.addR(sgPane, sgX, sgY, sgZ, PI / 2, 0, 0);
  K.addR(new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.1, 8, 24), walnut), sgX, sgY, sgZ + 0.03);

  // ---------------- ROOM 1 (Left: Curved Gear-Fronted Potion Counter, Bubbling Cauldron & Shelves) ----------------
  // Curved Gear-Fronted Potion Counter w/ Bubbling Cauldron & Copper Alembic
  const cx = -1.85, cz = -1.25;
  K.boxCol(cx, cz, 2.52, 1.14);
  K.add(K.rbox(2.46, 0.88, 1.08, 0.18, walnut, 2), cx, 0.52, cz);
  K.add(K.rbox(2.56, 0.09, 1.16, 0.16, honeyWood, 2), cx, 0.98, cz);
  // Inset brass cogwheels along the counter front
  for (const gx of [-0.78, 0, 0.78]) {
    K.add(new THREE.Mesh(makeGearGeo(THREE, 0.28, 0.05, 10, 5), brass), cx + gx, 0.52, cz + 0.56);
  }
  // Bubbling copper cauldron + glowing magenta potion + copper alembic retort coil!
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), copper), cx - 0.15, 1.28, cz);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 16), brass), cx - 0.15, 1.52, cz, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 16), potionGlow), cx - 0.15, 1.54, cz);
  for (const [bx, bz, br] of [[-0.25, 0.06, 0.07], [-0.06, -0.05, 0.06], [-0.16, 0.1, 0.05]]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(br, 8, 6), potionGlow), cx + bx, 1.62, cz + bz);
  }
  // Copper distillation alembic tower on right end of counter
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.46, 14), copper), cx + 0.75, 1.24, cz - 0.08);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), copper), cx + 0.75, 1.58, cz - 0.08);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 14, PI), brass), cx + 0.55, 1.76, cz - 0.08);

  // Rainbow Bottle Apothecary Wall Shelves against back & left walls
  K.boxCol(-2.1, -3.22, 3.55, 0.62);
  K.add(K.rbox(3.5, 2.75, 0.52, 0.04, walnut, 1), -2.1, 1.48, -3.22);
  const flaskGeo = () => new THREE.SphereGeometry(0.1, 8, 7);
  const flaskMat = K.M(0xffffff, null, { roughness: 0.3, emissive: 0x3a1c4a, emissiveIntensity: 0.55 });
  const flaskCols = [0xff4fd8, 0x3be8ff, 0xffcf42, 0x45eb88, 0xa864ff, 0xff7b42];
  for (let sy = 0; sy < 4; sy++) {
    const yF = 0.72 + sy * 0.56;
    K.add(K.rbox(3.32, 0.05, 0.48, 0.01, honeyWood, 1), -2.1, yF, -3.18);
    for (let k = 0; k < 12; k++) {
      K.pushInst('flask', flaskGeo, flaskMat, -3.62 + k * 0.27, yF + 0.13, -3.08, 0, 0, 0, 1, K.jr(1.0, 1.45), 1, flaskCols[(sy * 4 + k) % flaskCols.length]);
    }
  }

  // ---------------- ROOM 2 (Right: Hanging Dried-Lavender Herb Workroom) ----------------
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.7), rugMat);
  K.add(rug2, 2.35, 0.106, -1.05, -PI / 2, 0, 0);

  // Overhead wooden drying pole w/ hanging bundles of dried purple lavender & golden herbs (y = 2.65m!)
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), walnut), 2.55, 2.95, -1.35, 0, 0, PI / 2);
  const herbCols = [0x9e63eb, 0xc48cff, 0xe8be48, 0x6ba356, 0xb274f0];
  for (let h = 0; h < 9; h++) {
    K.pushInst('wisteria', wisteriaGeo, wisteriaMat, 1.25 + h * 0.32, 2.68, -1.35, 0, h * 0.7, 0, 0.85, 1.05, 0.85, herbCols[h % herbCols.length]);
  }

  // Rustic Herb-Grinding Worktable w/ mortar & pestle & wicker baskets along right wall
  const tx = 3.78, tz = -1.15;
  K.boxCol(tx, tz, 1.26, 2.28);
  K.add(K.rbox(1.12, 0.08, 2.18, 0.03, honeyWood, 1), tx, 0.86, tz);
  for (const dx of [-0.44, 0.44]) {
    for (const dz of [-0.92, 0.92]) {
      K.add(K.rbox(0.09, 0.8, 0.09, 0.02, walnut, 1), tx + dx, 0.45, tz + dz);
    }
  }
  // Ceramic mortar & pestle + fresh lavender bundles on table + back spice cabinet
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.16, 12), innerWall), tx - 0.12, 0.98, tz + 0.45);
  K.add(K.rbox(0.45, 0.34, 0.55, 0.05, K.M(0xc99658, K.tex('burlap', 1, 1)), 1), tx, 0.27, tz - 0.35);
  K.boxCol(2.45, -3.18, 2.05, 0.65);
  K.add(K.rbox(1.98, 2.1, 0.56, 0.04, walnut, 1), 2.45, 1.15, -3.18);

  for (const lx of [-2.05, 2.55]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), warmGlow), lx, 3.02, 0.25);
  }

  K.root.userData = {
    floorY: 0.10,
    footprint: { w: W + 0.3, d: D + 0.3 },
    footprintBox: { x: 0, z: 0, w: W + 0.3, d: D + 0.3 },
    door: { x: doorX, z: +(D / 2 + 1.05).toFixed(2) },
    doorIn: { x: doorX, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 0.45, z: 0.45 }],
    rooms: [
      { name: 'Potion & Cauldron Apothecary', x: -2.055, z: 0, w: 5.01, d: 7.12, walkX: -1.45, walkZ: 1.45 },
      { name: 'Dried-Lavender Herb Workroom', x: 2.505, z: 0, w: 4.11, d: 7.12, walkX: 1.95, walkZ: 1.25 },
    ],
    propSlots: [
      { id: 'cw_potion_rack', x: -3.55, z: 1.95, rot: 0.52 },
      { id: 'cw_potion_rack', x: -2.25, z: 2.55, rot: -2.92 },
      { id: 'cw_potion_rack', x: -0.65, z: 2.55, rot: -2.62 },
      { id: 'cw_coal_hearth_pot', x: -0.32, z: -2.35, rot: -0.5 },
      { id: 'cw_spellbook_lectern', x: -3.65, z: 0.62, rot: 1.35 },
      { id: 'cw_potion_rack', x: 3.72, z: 1.35, rot: -1.57 },
      { id: 'cw_potion_rack', x: 3.72, z: 2.55, rot: -1.82 },
      { id: 'cw_coal_hearth_pot', x: 1.25, z: -2.22, rot: 0.42 },
      { id: 'cw_automaton_owl', x: 1.25, z: -1.12, rot: 0.92 },
      { id: 'cw_hatbox_stack', x: 3.68, z: -2.82, rot: -0.82 },
    ],
  };

  K.finalize([]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// 5. ROYAL PÂTISSERIE — 'Royal Pâtisserie'
// ============================================================================
function buildRoyalPatisserie(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'royal_patisserie', 67);
  const W = 10.0, D = 7.6, H = 3.75, th = 0.24;

  const limestone = K.M(0xfbf1dc, K.tex('plaster', 2.0, 1.6));
  const trimStone = K.M(0xf1dfc0, K.tex('stone', 1.6, 1.6));
  const innerWall = K.M(0xfff7ea, K.tex('plaster', 1.8, 1.5));
  const mansardSlate = K.M(0x526b82, texSlateShingles(THREE), { metalness: 0 });
  const mintIron = K.M(0x4d8e7e, K.tex('painted_metal', 1, 1), { roughness: 0.55, metalness: 0 });
  const burgWood = K.M(0x8c2f46, K.tex('painted_metal', 1, 1), { metalness: 0 });
  const velvetRose = K.M(0xc44868, null, { roughness: 0.88, metalness: 0 });
  const creamMarble = K.M(0xfffaf0, K.tex('stone', 1.4, 1.4), { roughness: 0.42, metalness: 0 });
  const floorTile = K.M(0xf5e5cb, K.tex('stone', 3.8, 3.8), { metalness: 0 });
  const brass = K.M(0xf5cc5c, null, { roughness: 0.40, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const honeyOak = K.M(0xb88248, K.tex('wood_light', 1.4, 1.4), { metalness: 0 });
  const warmGlow = K.glowMat(0xffe9ad, 0xffb342, 1.5, { metalness: 0 });
  const winGlass = K.glowMat(0xffe5a8, 0xd98f34, 0.58, { metalness: 0 });
  const clearCase = K.M(0xe6f7ff, null, { roughness: 0.16, metalness: 0, transparent: true, opacity: 0.34, depthWrite: false });
  const stripeMat = K.M(0xffffff, texStripes(THREE, 'patisserie', '#9e2e46', '#fff5e4', 10), { metalness: 0 });
  const rugMat = K.M(0xffffff, texRug(THREE, 'patis', '#a63e58', '#eb9eb0', '#fff0e6', false), { metalness: 0 });

  // Floor & Haussmann carved limestone pilasters
  K.add(K.rbox(W - 0.12, 0.1, D - 0.12, 0.02, floorTile, 1), 0, 0.05, 0);
  addQuoinsAndPlinth(THREE, K, W, D, H, trimStone);

  // Exterior walls (+Z front has central arched French door at u = 0 & twin shop windows)
  const doorX = 0.0, doorW = 1.72;
  K.wall(0, D / 2, 0, W, H, th, [
    { u: -2.85, y0: 0.85, w: 2.15, h: 1.85 },
    { door: true, u: doorX, w: doorW, h: 2.68, arch: true },
    { u: 2.85, y0: 0.85, w: 2.15, h: 1.85 },
  ], limestone, innerWall);
  K.wall(0, -D / 2, PI, W, H, th, [
    { u: -2.85, y0: 0.95, w: 1.55, h: 1.75 },
    { u: 2.35, y0: 0.95, w: 1.55, h: 1.75 },
  ], limestone, innerWall);
  K.wall(-W / 2, 0, -PI / 2, D, H, th, [{ u: 0.3, y0: 1.0, w: 1.4, h: 1.6 }], limestone, innerWall);
  K.wall(W / 2, 0, PI / 2, D, H, th, [{ u: -0.5, y0: 1.0, w: 1.4, h: 1.6 }], limestone, innerWall);

  // Interior partition wall centered at x = 1.15 (clear of door at x = 0!) with salon arch (w = 1.72m at z = 0.25)
  K.wall(1.26, 0, PI / 2, D - 2 * th, H, 0.22, [
    { door: true, u: -0.25, w: 1.72, h: 2.76, arch: true },
  ], innerWall, innerWall);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.90, 0.09, 6, 16, PI), trimStone), 1.15, 1.90, 0.25, 0, PI / 2, 0);

  // Windows & fluted Haussmann pilasters
  addWindowDress(THREE, K, -2.85, 1.78, D / 2, 2.15, 1.85, 0, brass, winGlass, trimStone);
  addWindowDress(THREE, K, 2.85, 1.78, D / 2, 2.15, 1.85, 0, brass, winGlass, trimStone);
  addWindowDress(THREE, K, -2.85, 1.82, -D / 2, 1.55, 1.75, PI, brass, winGlass, trimStone);
  addWindowDress(THREE, K, 2.35, 1.82, -D / 2, 1.55, 1.75, PI, brass, winGlass, trimStone);
  addWindowDress(THREE, K, -W / 2, 1.8, 0.3, 1.4, 1.6, -PI / 2, brass, winGlass, trimStone);
  addWindowDress(THREE, K, W / 2, 1.8, 0.5, 1.4, 1.6, PI / 2, brass, winGlass, trimStone);

  for (const px of [-4.72, -1.42, 1.42, 4.72]) {
    K.add(K.rbox(0.32, H, 0.22, 0.04, trimStone, 1), px, H / 2, D / 2 + 0.05);
  }
  // Upper Haussmann cornice lives in roofG so hiding 'roof' cleanly reveals both interior rooms!
  K.addR(K.rbox(W + 0.36, 0.26, D + 0.36, 0.05, trimStone, 1), 0, H - 0.05, 0);

  // Entrance French arch, steps, brass coach lanterns & burgundy-cream striped awnings
  addArchedDoorSurround(THREE, K, doorX, D / 2, doorW, 2.65, trimStone, honeyOak, brass);
  addStoneSteps(K, doorX, D / 2, doorW, trimStone);
  addCoachLantern(THREE, K, -1.18, 2.32, D / 2 + 0.18, brass, warmGlow);
  addCoachLantern(THREE, K, 1.18, 2.32, D / 2 + 0.18, brass, warmGlow);

  for (const ax of [-2.85, 2.85]) {
    K.add(K.rbox(2.55, 0.1, 1.15, 0.03, stripeMat, 1), ax, 2.92, D / 2 + 0.52, 0.36, 0, 0);
    K.add(K.rbox(2.56, 0.18, 0.08, 0.03, burgWood, 1), ax, 2.68, D / 2 + 1.04);
  }
  if (K.garden) {
    // Bistro umbrella café tables on apron in gallery showcase mode
    for (const sx of [-3.1, 3.1]) {
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 16), creamMarble), sx, 0.72, D / 2 + 1.45);
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.7, 8), mintIron), sx, 0.36, D / 2 + 1.45);
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.55, 8), brass), sx, 1.45, D / 2 + 1.45);
      K.add(new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.42, 14), stripeMat), sx, 2.25, D / 2 + 1.45);
    }
  }

  // ---------------- SLATE MANSARD DOME ROOF, GOLDEN CROWN CREST & MINT BALCONY (roofG) ----------------
  // Mint wrought-iron flower balcony perched along the front cornice!
  K.addR(K.rbox(5.6, 0.14, 0.75, 0.04, trimStone, 1), 0, H + 0.12, D / 2 + 0.32);
  K.addR(K.rbox(5.5, 0.07, 0.07, 0.02, mintIron, 1), 0, H + 0.82, D / 2 + 0.64);
  for (let i = -8; i <= 8; i++) {
    K.addR(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 6), mintIron), i * 0.32, H + 0.48, D / 2 + 0.64);
  }
  K.addR(new THREE.Mesh(makeGearGeo(THREE, 0.32, 0.05, 12, 6), brass), 0, H + 0.48, D / 2 + 0.66);
  scatterFoliageCluster(THREE, K, 0, H + 0.32, D / 2 + 0.48, 2.4, 0.16, 0.16, 26, [0xf67e9c, 0xffc8d6, 0xffe49c], K.roofG);

  // Mansard lower sloped curb + flat top deck + central dome & dormers
  const mGeo = new THREE.CylinderGeometry(3.45, 4.35, 1.95, 4, 1);
  mGeo.rotateY(PI / 4);
  const mansard = new THREE.Mesh(mGeo, mansardSlate);
  mansard.scale.set(1.66, 1, 1.28);
  K.addR(mansard, 0, H + 1.05, 0);
  K.addR(K.rbox(7.8, 0.14, 5.6, 0.03, trimStone, 1), 0, H + 2.04, 0);
  // Central arched Haussmann pediment + sculpted Golden Royal Crown Crest!
  K.addR(K.rbox(2.85, 1.65, 0.75, 0.06, limestone, 1), 0, H + 0.95, D / 2 - 0.12);
  K.addR(new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.14, 8, 18, PI), trimStone), 0, H + 1.55, D / 2 + 0.28);
  K.addR(K.rbox(1.65, 1.28, 0.12, 0.03, winGlass, 1), 0, H + 0.88, D / 2 + 0.26);
  // Central slate dome + 3D instanced shingles + Golden Royal Crown at apex!
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.85, 20, 12, 0, TAU, 0, PI / 2), mansardSlate);
  dome.scale.set(1.25, 0.82, 1.05);
  K.addR(dome, 0, H + 1.98, 0.35);
  const mansardPal = [0x526b82, 0x607b94, 0x455c72, 0x6c87a0];
  K.coneRoofTiles({ cx: 0, yBase: H + 2.02, cz: 0.35, rBase: 2.05, height: 1.38, rTop: 0.32, style: 'slate', palette: mansardPal, parent: K.roofG });
  for (const sz of [-1, 1]) {
    K.tileRoofSlope({
      cx: 0, cy: H + 1.08, cz: sz * 3.35, width: 9.2, slopeLen: 2.15, pitch: 1.18,
      rotY: sz > 0 ? 0 : PI, style: 'slate', palette: mansardPal, parent: K.roofG,
    });
  }
  const crY = H + 2.95, crZ = D / 2 + 0.22;
  K.addR(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.26, 14), brass), 0, crY, crZ);
  K.addR(new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), velvetRose), 0, crY + 0.16, crZ);
  for (let i = 0; i < 4; i++) {
    K.addR(new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 6, 12, PI), brass), 0, crY + 0.12, crZ, 0, (i * PI) / 4, 0);
  }
  K.addR(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), brass), 0, crY + 0.56, crZ);
  // Flanking mansard dormers
  for (const dx of [-3.15, 3.15]) {
    K.addR(K.rbox(1.15, 1.15, 0.95, 0.04, limestone, 1), dx, H + 0.92, D / 2 - 0.35);
    K.addR(K.rbox(0.68, 0.78, 0.12, 0.02, winGlass, 1), dx, H + 0.88, D / 2 + 0.14);
    K.addR(new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8, 0, TAU, 0, PI / 2), mansardSlate), dx, H + 1.48, D / 2 - 0.35);
  }

  // ---------------- ROOM 1 (Left: Curved Glass Macaron & Tiered-Cake Vitrine) ----------------
  const rug1 = new THREE.Mesh(new THREE.CircleGeometry(1.55, 24), rugMat);
  K.add(rug1, -0.35, 0.106, 0.95, -PI / 2, 0, 0);

  // Curved Glass & Burgundy-Gold Pastry Vitrine Counter
  const vx = -2.95, vz = -0.55;
  K.boxCol(vx, vz, 2.65, 1.18);
  K.add(K.rbox(2.58, 0.78, 1.1, 0.06, burgWood, 1), vx, 0.48, vz);
  K.add(K.rbox(2.64, 0.08, 1.14, 0.04, creamMarble, 1), vx, 0.9, vz);
  K.add(K.rbox(2.42, 0.04, 0.04, 0.01, brass, 1), vx, 0.78, vz + 0.56);
  // Single curved glass hood (only 1 transparent mesh so draw calls stay ultra-low!)
  const hoodGeo = new THREE.CylinderGeometry(0.54, 0.54, 2.48, 14, 1, false, 0, PI * 0.55);
  hoodGeo.rotateZ(PI / 2);
  const glassHood = new THREE.Mesh(hoodGeo, clearCase);
  K.add(glassHood, vx, 0.92, vz - 0.02);
  // Brass pastry shelves + instanced colourful macarons & berry tarts inside vitrine!
  const macGeo = () => new THREE.CylinderGeometry(0.075, 0.075, 0.065, 10);
  const macMat = K.M(0xffffff, null, { roughness: 0.65 });
  const macCols = [0xff85a8, 0x9be388, 0xffe066, 0xc898ff, 0xffa66b, 0x7fd8f5];
  for (let sy = 0; sy < 3; sy++) {
    const yM = 0.96 + sy * 0.2;
    K.add(K.rbox(2.38, 0.03, 0.78 - sy * 0.14, 0.01, brass, 1), vx, yM, vz - sy * 0.06);
    for (let k = 0; k < 11; k++) {
      K.pushInst('macaron', macGeo, macMat, vx - 1.05 + k * 0.21, yM + 0.05, vz + 0.12 - sy * 0.08, 0, 0, 0, 1, 1, 1, macCols[(sy * 3 + k) % macCols.length]);
    }
  }

  // Back Marble Pastry Shelf w/ Multi-Tiered Wedding Cakes & Golden Samovar Counter
  K.boxCol(-1.85, -3.12, 4.6, 0.72);
  K.add(K.rbox(4.5, 0.92, 0.64, 0.04, burgWood, 1), -1.85, 0.56, -3.12);
  K.add(K.rbox(4.58, 0.08, 0.7, 0.03, creamMarble, 1), -1.85, 1.04, -3.12);
  // Multi-tiered strawberry wedding cake + golden samovar!
  for (const [cx2, tiers] of [[-3.15, 3], [-1.75, 2]]) {
    for (let t = 0; t < tiers; t++) {
      const rC = 0.28 - t * 0.065;
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(rC, rC, 0.18, 16), innerWall), cx2, 1.18 + t * 0.18, -3.1);
      K.add(new THREE.Mesh(new THREE.TorusGeometry(rC, 0.025, 6, 14), velvetRose), cx2, 1.26 + t * 0.18, -3.1, PI / 2, 0, 0);
    }
  }
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), brass), -0.15, 1.42, -3.08);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 12), brass), -0.15, 1.18, -3.08);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.18, 12), brass), -0.15, 1.72, -3.08);

  // ---------------- ROOM 2 (Right: Velvet Tea Salon Parlor) ----------------
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.9), rugMat);
  K.add(rug2, 3.05, 0.106, -1.35, -PI / 2, 0, 0);

  // Tufted Raspberry-Velvet Salon Settee & Swagged Burgundy Drapes against back wall
  const sx = 3.05, sz = -2.88;
  K.boxCol(sx, sz, 2.15, 0.92);
  K.add(K.rbox(1.98, 0.42, 0.82, 0.14, velvetRose, 2), sx, 0.38, sz);
  K.add(K.rbox(1.96, 0.82, 0.24, 0.12, velvetRose, 2), sx, 0.86, sz - 0.28);
  for (const s of [-1, 1]) {
    K.add(K.rbox(0.22, 0.42, 0.78, 0.1, velvetRose, 2), sx + s * 0.92, 0.56, sz);
    K.add(K.rbox(0.42, 2.35, 0.14, 0.06, burgWood, 1), sx + s * 0.95, 1.85, -3.42);
  }
  // Round Lace-Draped Porcelain Tea Table & Twin Velvet Salon Chairs
  const tx = 3.08, tz = -1.12;
  K.boxCol(tx, tz, 1.56, 1.38);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.34, 18), innerWall), tx, 0.64, tz);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.62, 10), brass), tx, 0.36, tz);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), innerWall), tx, 0.88, tz);
  for (const s of [-1, 1]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 14), velvetRose), tx + s * 0.68, 0.48, tz);
    K.add(K.rbox(0.08, 0.52, 0.38, 0.04, velvetRose, 1), tx + s * 0.88, 0.78, tz);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 0.42, 8), honeyOak), tx + s * 0.68, 0.26, tz);
  }

  for (const lx of [-1.85, 3.05]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), warmGlow), lx, 3.12, 0.1);
  }

  K.root.userData = {
    floorY: 0.10,
    footprint: { w: W + 0.3, d: D + 0.3 },
    footprintBox: { x: 0, z: 0, w: W + 0.3, d: D + 0.3 },
    door: { x: doorX, z: +(D / 2 + 1.05).toFixed(2) },
    doorIn: { x: doorX, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 1.15, z: 0.25 }],
    rooms: [
      { name: 'Macaron & Cake Vitrine', x: -1.805, z: 0, w: 5.91, d: 7.12, walkX: -0.35, walkZ: 1.45 },
      { name: 'Velvet Tea Salon', x: 2.955, z: 0, w: 3.61, d: 7.12, walkX: 2.25, walkZ: 1.35 },
    ],
    propSlots: [
      { id: 'cw_cake_stand', x: -3.95, z: 1.65, rot: 0.42 },
      { id: 'cw_cake_stand', x: -3.95, z: 2.65, rot: 0.92 },
      { id: 'cw_cake_stand', x: -1.65, z: 2.65, rot: -2.82 },
      { id: 'cw_steam_samovar', x: 0.35, z: -2.12, rot: -0.42 },
      { id: 'cw_hatbox_stack', x: -4.12, z: -2.15, rot: 1.22 },
      { id: 'cw_cake_stand', x: 3.95, z: 1.25, rot: -1.52 },
      { id: 'cw_steam_samovar', x: 3.95, z: 2.35, rot: -1.92 },
      { id: 'cw_steam_samovar', x: 1.98, z: 2.65, rot: -2.72 },
      { id: 'cw_gramophone', x: 1.88, z: -2.62, rot: 0.52 },
      { id: 'cw_dress_form', x: 4.08, z: 0.15, rot: -1.57 },
    ],
  };

  K.finalize([]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// LANDMARK 1: ORRERY FOUNTAIN (Centerpiece w/ spinning brass orreryRings & sun core)
// ============================================================================
function buildOrreryFountain(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'orreryFountain', 79);
  const stone = K.M(0xd9cab4, K.tex('stone', 2.2, 2.2), { metalness: 0 });
  const darkStone = K.M(0xb8a58e, K.tex('stone', 2.0, 2.0), { metalness: 0 });
  const brass = K.M(0xe8b84b, null, { roughness: 0.40, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const copper = K.M(0xc97842, null, { roughness: 0.46, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
  const waterMat = K.glowMat(0x56c8e8, 0x1d8ab8, 0.65, { roughness: 0.2, metalness: 0 });
  const foamMat = K.glowMat(0xe8fbff, 0x9ce8ff, 0.55, { metalness: 0 });
  const sunGlow = K.glowMat(0xfff0a0, 0xffa624, 2.4, { metalness: 0 });
  const planetBlue = K.M(0x3a64b8, null, { roughness: 0.5, metalness: 0 });
  const planetTerra = K.M(0xc85c38, null, { roughness: 0.55, metalness: 0 });
  const planetTeal = K.M(0x48a89c, null, { roughness: 0.5, metalness: 0 });

  // Compact 3.1m-wide collider so plaza spawn points (±2.2, -1.8) & (0, 3.2) stay 100% unobstructed!
  K.boxCol(0, 0, 3.1, 3.1);

  // Lower carved stone fountain basin + turquoise water
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.92, 2.04, 0.16, 28), darkStone), 0, 0.08, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.74, 1.82, 0.62, 28), stone), 0, 0.42, 0);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.11, 8, 28), darkStone), 0, 0.72, 0, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.66, 0.08, 26), waterMat), 0, 0.66, 0);

  // Partially submerged giant brass cogwheels around lower basin!
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    K.add(
      new THREE.Mesh(makeGearGeo(THREE, i % 2 === 0 ? 0.52 : 0.4, 0.09, 12, 5), i % 2 === 0 ? brass : copper),
      Math.cos(a) * 1.24, 0.76, Math.sin(a) * 1.24, 0, -a + PI / 2, 0
    );
  }

  // Upper stone fountain tier + cascading waterfall ribbons
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.76, 0.85, 18), darkStone), 0, 1.05, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.92, 0.36, 22), stone), 0, 1.52, 0);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.08, 8, 24), darkStone), 0, 1.68, 0, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.06, 22), waterMat), 0, 1.66, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.52;
    K.add(K.rbox(0.24, 0.92, 0.08, 0.03, foamMat, 1), Math.cos(a) * 1.16, 1.15, Math.sin(a) * 1.16, 0, -a + PI / 2, 0.24);
  }

  // Central brass gear pedestal supporting the Armillary Orrery
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 1.25, 16), brass), 0, 2.22, 0);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.62, 0.09, 14, 6), brass), 0.38, 2.15, 0);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.055, 8, 28, PI * 1.25), brass), 0, 3.68, 0, 0, 0, -PI * 0.125);

  // Blazing glowing golden Sun Core at (0, 3.68, 0)
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), sunGlow), 0, 3.68, 0);

  // Animated Brass Planetary Rings (`orreryRings` + nested `ringA`, `ringB` kept via finalize)
  const orreryRings = new THREE.Group();
  orreryRings.name = 'orreryRings';
  orreryRings.position.set(0, 3.68, 0);
  K.root.add(orreryRings);

  // Outer brass ecliptic ring + ringed Saturn & cobalt Earth
  orreryRings.add(new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.05, 8, 32), brass));
  const saturn = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), copper);
  saturn.position.set(1.38, 0.12, 0);
  orreryRings.add(saturn);
  const satRing = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 6, 18), brass);
  satRing.position.set(1.38, 0.12, 0);
  satRing.rotation.set(1.22, 0.25, 0);
  orreryRings.add(satRing);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), planetBlue);
  earth.position.set(-0.98, 0.98, 0);
  orreryRings.add(earth);

  const ringA = new THREE.Group();
  ringA.name = 'orreryRingA';
  ringA.rotation.set(0.58, 0.35, 0.24);
  orreryRings.add(ringA);
  ringA.add(new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.042, 8, 28), copper));
  const mars = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), planetTerra);
  mars.position.set(-1.08, 0, 0);
  ringA.add(mars);

  const ringB = new THREE.Group();
  ringB.name = 'orreryRingB';
  ringB.rotation.set(-0.62, -0.42, 0.55);
  orreryRings.add(ringB);
  ringB.add(new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.036, 8, 24), brass));
  const nept = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), planetTeal);
  nept.position.set(0, 0.78, 0);
  ringB.add(nept);

  K.finalize([orreryRings, ringA, ringB]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// LANDMARK 2: CLOCKWORK TRAM (Rideable Open-Vestibule Burgundy & Brass Streetcar)
// ============================================================================
function buildClockworkTram(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'clockworkTram', 89);
  const burgundy = K.M(0x8e283b, K.tex('painted_metal', 1.4, 1.4), { roughness: 0.52, metalness: 0 });
  const cream = K.M(0xf8ecd2, K.tex('painted_metal', 1.2, 1.2), { roughness: 0.56, metalness: 0 });
  const deckWood = K.M(0xc89258, K.tex('wood_light', 2.4, 2.4), { roughness: 0.78, metalness: 0 });
  const roofWood = K.M(0x7c4c2b, K.tex('wood_light', 1.8, 1.8), { roughness: 0.80, metalness: 0 });
  const brass = K.M(0xe8b84b, null, { roughness: 0.40, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const copper = K.M(0xc97842, null, { roughness: 0.46, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
  const iron = K.M(0x4a4d5c, null, { roughness: 0.62, metalness: 0 });
  const winGlow = K.glowMat(0xffe7a8, 0xffae3d, 1.45, { metalness: 0 });
  const lampGlow = K.glowMat(0xfff4c2, 0xffbe45, 2.1, { metalness: 0 });

  const L = 6.2, W = 2.40;
  K.boxCol(0, 0, W, L);

  // Iron undercarriage chassis + walkable polished walnut boarding deck at y = 0.48m!
  K.add(K.rbox(W - 0.14, 0.20, L - 0.36, 0.04, iron, 1), 0, 0.32, 0);
  const deckMesh = K.rbox(W + 0.04, 0.10, L - 0.18, 0.03, deckWood, 1);
  K.add(deckMesh, 0, 0.44, 0);
  // Wide brass-trimmed side running-board steps at y = 0.24m so boarding from either side looks authentic!
  for (const sx of [-1, 1]) {
    K.add(K.rbox(0.24, 0.05, L - 1.2, 0.015, deckWood, 1), sx * (W / 2 + 0.08), 0.24, 0);
    K.add(K.rbox(0.05, 0.06, L - 1.2, 0.015, brass, 1), sx * (W / 2 + 0.19), 0.25, 0);
  }

  // Rounded front & rear driver dashboards (low waist h = 0.92m so front/rear vestibules stay open & airy!)
  for (const sz of [-1, 1]) {
    const dash = new THREE.Mesh(
      new THREE.CylinderGeometry(W / 2 - 0.04, W / 2 - 0.04, 0.84, 18, 1, false, -PI * 0.42, PI * 0.84),
      burgundy
    );
    K.add(dash, 0, 0.90, sz * (L / 2 - 0.96), 0, sz > 0 ? 0 : PI, 0);
    K.add(new THREE.Mesh(new THREE.TorusGeometry(W / 2 - 0.03, 0.035, 6, 18, PI * 0.84), brass),
      0, 1.32, sz * (L / 2 - 0.96), PI / 2, 0, sz > 0 ? -PI * 0.92 : PI * 0.08);
    // Brass controller stand inside cab
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.72, 10), brass), -0.22 * sz, 0.84, sz * (L / 2 - 0.48));
    // Glowing brass headlamp + cowcatcher
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.22, 14), brass), 0, 0.96, sz * (L / 2 + 0.02), PI / 2, 0, 0);
    K.add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), lampGlow), 0, 0.96, sz * (L / 2 + 0.14), sz > 0 ? 0 : PI, 0, 0);
    K.add(K.rbox(W * 0.80, 0.20, 0.32, 0.04, brass, 1), 0, 0.24, sz * (L / 2 - 0.02), sz * 0.35, 0, 0);
  }

  // Open-Air Storybook Excursion Streetcar Side Bays:
  // Wide open center boarding portal (`z in [-0.92, +0.92]`) + twin windowed saloon bays fore & aft!
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bayZ = sz * 1.48;
      // Lower burgundy waist panel + brass trim + exposed side cogwheels
      K.add(K.rbox(0.10, 0.78, 1.08, 0.03, burgundy, 1), sx * (W / 2 - 0.05), 0.88, bayZ);
      K.add(K.rbox(0.12, 0.07, 1.12, 0.02, brass, 1), sx * (W / 2 - 0.05), 1.28, bayZ);
      K.add(new THREE.Mesh(makeGearGeo(THREE, 0.22, 0.04, 10, 5), brass), sx * (W / 2 + 0.02), 0.88, bayZ, 0, PI / 2, 0);
      // Cream window pillars & upper arch spandrel
      for (const pz of [bayZ - 0.50, bayZ + 0.50]) {
        K.add(K.rbox(0.10, 1.38, 0.12, 0.02, cream, 1), sx * (W / 2 - 0.05), 1.95, pz);
      }
      K.add(K.rbox(0.06, 0.74, 0.84, 0.02, winGlow, 1), sx * (W / 2 - 0.05), 1.72, bayZ);
      // Interior wooden passenger bench tucked neatly against bay wall
      K.add(K.rbox(0.38, 0.07, 0.98, 0.02, deckWood, 1), sx * (W / 2 - 0.28), 0.82, bayZ);
      K.add(K.rbox(0.08, 0.34, 0.90, 0.02, brass, 1), sx * (W / 2 - 0.42), 0.65, bayZ);
    }
    // Ornate brass grab-poles flanking the wide 1.84m center boarding archway!
    for (const gz of [-0.94, 0.94, -2.58, 2.58]) {
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 2.16, 8), brass), sx * (W / 2 - 0.06), 1.56, gz);
    }
    // Center boarding arch header sign ('PENDULUM LINE')
    K.add(K.rbox(0.12, 0.26, L - 0.6, 0.03, cream, 1), sx * (W / 2 - 0.04), 2.48, 0);
    K.add(K.rbox(0.14, 0.06, L - 0.5, 0.02, brass, 1), sx * (W / 2 - 0.04), 2.34, 0);
  }

  // Rear luggage rack brass rail at z = -2.35 (frames the interactive Tram-Luggage spot!)
  K.add(K.rbox(1.18, 0.05, 0.05, 0.015, brass, 1), 0, 0.64, -2.68);

  // Curved timber roof (y = 2.66m -> 2.18m standing headroom!) + clerestory skylight + brass pantograph!
  K.add(K.rbox(W + 0.18, 0.16, L - 0.16, 0.07, roofWood, 2), 0, 2.66, 0);
  K.add(K.rbox(W * 0.62, 0.26, L * 0.64, 0.06, roofWood, 1), 0, 2.86, 0);
  K.add(K.rbox(W * 0.64, 0.15, L * 0.60, 0.02, winGlow, 1), 0, 2.84, 0);
  // Trolley pole & copper dome bell
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.12, 12), brass), 0, 3.04, -0.35);
  K.beam([0, 3.08, -0.35], [0, 3.92, -1.65], 0.055, brass);
  K.beam([0, 3.92, -1.65], [0, 4.22, -0.55], 0.045, brass);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), brass), 0, 4.25, -0.52, 0, PI / 2, 0);

  // Iron wheels + kept `tramGears` group for rolling animation
  for (const sz of [-1.85, -0.95, 0.95, 1.85]) {
    for (const sx of [-0.92, 0.92]) {
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 14), iron), sx, 0.26, sz, 0, 0, PI / 2);
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10), brass), sx, 0.26, sz, 0, 0, PI / 2);
    }
  }
  const tramGears = new THREE.Group();
  tramGears.name = 'tramGears';
  tramGears.position.set(0, 3.04, 1.35);
  K.root.add(tramGears);
  tramGears.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.18, 12), copper));

  K.finalize([tramGears]);
  stampPaintColors(THREE, K.root);
  K.root.traverse((m) => {
    if (m.isMesh && m.material === deckWood) {
      m.userData.ground = true;
      m.userData.paint = new THREE.Color(0xc89258);
    }
  });
  return K.root;
}

// ============================================================================
// LANDMARK 3: WALKING TURRET (`walkingTurret` — wind-up music-box clock tower on a three-wheeled brass wagon)
// A round patina-teal music-box drum with a clock face, pin studs & a giant butterfly wind-up key,
// capped by a conical slate roof with a steam whistle, riding a spoked tricycle carriage.
// ============================================================================
function buildWalkingTurret(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'walkingTurret', 101);
  const copper = K.M(0xc97842, K.tex('painted_metal', 1.5, 1.5), { roughness: 0.46, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
  const brass = K.M(0xe8b84b, null, { roughness: 0.40, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const bronzeDark = K.M(0x6b4c32, K.tex('painted_metal', 1.2, 1.2), { roughness: 0.58, metalness: 0 });
  const iron = K.M(0x4a4d5c, null, { roughness: 0.62, metalness: 0 });
  const patinaTeal = K.M(0x4a9a90, K.tex('painted_metal', 1.6, 1.2), { roughness: 0.56, metalness: 0 });
  const slateRoof = K.M(0x5c6884, texSlateShingles(THREE), { metalness: 0 });
  const clockMat = K.M(0xffffff, texClockFace(THREE), { roughness: 0.55, metalness: 0 });
  const winGlow = K.glowMat(0xffe7a2, 0xffad38, 1.65, { metalness: 0 });

  K.boxCol(0, 0, 3.8, 3.8);

  // Three-wheeled brass wagon carriage planted on the terrace (stays in root!)
  const wheel = (wx, wy, wz, R) => {
    K.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.085, 8, 22), bronzeDark), wx, wy, wz, 0, PI / 2, 0);
    K.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.09, 0.03, 6, 22), brass), wx, wy, wz, 0, PI / 2, 0);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12), brass), wx, wy, wz, 0, 0, PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      K.beam([wx, wy, wz], [wx, wy + Math.sin(a) * (R - 0.04), wz + Math.cos(a) * (R - 0.04)], 0.07, copper);
    }
  };
  wheel(-1.52, 0.80, -0.80, 0.72);
  wheel(1.52, 0.80, -0.80, 0.72);
  wheel(0, 0.60, 1.26, 0.52);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 3.1, 10), iron), 0, 0.80, -0.80, 0, 0, PI / 2);
  for (const sx of [-1, 1]) K.beam([sx * 0.16, 0.60, 1.26], [sx * 0.16, 1.08, 1.02], 0.09, iron);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), iron), 0, 0.60, 1.26, 0, 0, PI / 2);
  // Riveted chassis deck, leaf-spring brackets & tapered drum pedestal
  K.add(K.rbox(2.55, 0.22, 2.75, 0.07, bronzeDark, 1), 0, 1.02, -0.12);
  for (const sx of [-1, 1]) {
    K.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 14, PI), brass), sx * 1.18, 0.86, -0.80, PI, PI / 2, 0);
    for (const rz of [-1.2, -0.4, 0.4, 1.0]) {
      K.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), brass), sx * 1.28, 1.02, rz);
    }
  }
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.12, 0.74, 14), copper), 0, 1.50, -0.12);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.90, 0.06, 8, 22), brass), 0, 1.86, -0.12, PI / 2, 0, 0);

  // Animated upper music-box clock drum (`turretBody` kept via finalize([turretBody]))
  const turretBody = new THREE.Group();
  turretBody.name = 'turretBody';
  turretBody.position.set(0, 2.55, 0);
  K.root.add(turretBody);

  const addB = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => K.add(mesh, x, y, z, rx, ry, rz, turretBody);
  const bz = -0.12; // drum axis sits over the pedestal
  addB(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.5, 14), bronzeDark), 0, -0.90, bz);
  addB(new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.26, 1.48, 26), patinaTeal), 0, 0.06, bz);
  // Riveted brass drum bands + music-box pin studs
  addB(new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.065, 8, 28), brass), 0, 0.74, bz, PI / 2, 0, 0);
  addB(new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.065, 8, 28), brass), 0, -0.62, bz, PI / 2, 0, 0);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + 0.17;
    addB(new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), brass), Math.sin(a) * 1.27, -0.36 + (i % 3) * 0.07, bz + Math.cos(a) * 1.27);
  }

  // Front clock face (+Z) with brass bezel & hands
  addB(new THREE.Mesh(new THREE.CylinderGeometry(0.60, 0.60, 0.10, 22), clockMat), 0, 0.14, bz + 1.24, PI / 2, 0, 0);
  addB(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.065, 8, 24), brass), 0, 0.14, bz + 1.27);
  addB(K.rbox(0.06, 0.42, 0.03, 0.01, iron, 1), 0.07, 0.30, bz + 1.31, 0, 0, -0.42);
  addB(K.rbox(0.05, 0.30, 0.03, 0.01, iron, 1), -0.11, 0.21, bz + 1.31, 0, 0, 0.95);
  addB(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), brass), 0, 0.14, bz + 1.31);

  // Glowing arched windows on both flanks
  for (const sx of [-1, 1]) {
    addB(K.rbox(0.10, 0.62, 0.46, 0.04, winGlow, 1), sx * 1.24, 0.02, bz);
    addB(new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.10, 14, 1, false, 0, PI), winGlow), sx * 1.24, 0.33, bz, 0, 0, sx * PI / 2);
    addB(K.rbox(0.05, 0.86, 0.05, 0.01, iron, 1), sx * 1.30, 0.10, bz);
    addB(K.rbox(0.05, 0.05, 0.50, 0.01, iron, 1), sx * 1.30, 0.02, bz);
  }

  // Giant butterfly wind-up key at the back (-Z)
  addB(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.52, 10), brass), 0, 0.10, bz - 1.46, PI / 2, 0, 0);
  for (const sx of [-1, 1]) {
    addB(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 18), brass), sx * 0.28, 0.10, bz - 1.72);
  }

  // Conical slate roof with brass eave ring, finial ball & steam whistle (tip at local y = 2.55 -> world y = 5.1m!)
  addB(new THREE.Mesh(new THREE.CylinderGeometry(1.50, 1.36, 0.16, 26), bronzeDark), 0, 0.88, bz);
  addB(new THREE.Mesh(new THREE.ConeGeometry(1.50, 1.22, 22), slateRoof), 0, 1.57, bz);
  addB(new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), brass), 0, 2.18, bz);
  addB(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.34, 10), copper), 0, 2.38, bz);
  addB(new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.03, 6, 12), brass), 0, 2.52, bz, PI / 2, 0, 0);

  K.root.userData.steamOrigin = { x: 0, y: 5.1, z: -0.12 };
  K.finalize([turretBody]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// LANDMARK 4: MARKET KIOSK (Wrought-iron & striped autumn flower/gear stall)
// ============================================================================
function buildMarketKiosk(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'marketKiosk', 113);
  const patinaGreen = K.M(0x476b59, K.tex('painted_metal', 1.4, 1.4), { roughness: 0.58, metalness: 0 });
  const darkIron = K.M(0x4a4d5c, null, { roughness: 0.64, metalness: 0 });
  const oakWood = K.M(0x9e6838, K.tex('wood_light', 1.5, 1.5), { metalness: 0 });
  const brass = K.M(0xe8b84b, null, { roughness: 0.40, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const stripeMat = K.M(0xffffff, texStripes(THREE, 'kiosk', '#a8343e', '#f8e6b8', 10), { metalness: 0 });
  const clockMat = K.M(0xffffff, texClockFace(THREE), { roughness: 0.55, metalness: 0 });
  const warmGlow = K.glowMat(0xffe6a3, 0xffaa36, 1.55, { metalness: 0 });
  const crystalGlow = K.glowMat(0xd694ff, 0x9b3eff, 1.55, { metalness: 0 });
  const cyanGlow = K.glowMat(0x88f2ff, 0x22bde8, 1.45, { metalness: 0 });

  const W = 3.3, D = 2.15;
  K.boxCol(0, 0, W, D);

  // Gear-paneled oak counter base
  K.add(K.rbox(W - 0.16, 0.92, D - 0.24, 0.05, oakWood, 1), 0, 0.46, 0);
  K.add(K.rbox(W, 0.09, D - 0.1, 0.04, oakWood, 1), 0, 0.94, 0);
  for (const gx of [-0.95, 0, 0.95]) {
    K.add(new THREE.Mesh(makeGearGeo(THREE, 0.26, 0.05, 10, 5), brass), gx, 0.48, (D - 0.2) / 2);
  }

  // 4 wrought-iron corner columns + hanging warm lanterns
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.45, 10), darkIron), sx * (W / 2 - 0.14), 1.24, sz * (D / 2 - 0.14));
    }
    addCoachLantern(THREE, K, sx * (W / 2 + 0.04), 2.18, D / 2 - 0.06, brass, warmGlow);
  }

  // Patina-green curved metal roof + striped valence awning + brass gear & clockface pediment!
  for (const sz of [-1, 1]) {
    K.add(K.rbox(W + 0.36, 0.12, 1.32, 0.03, patinaGreen, 1), 0, 2.76, sz * 0.56, sz * 0.36, 0, 0);
  }
  K.add(K.rbox(W + 0.18, 0.28, 0.42, 0.04, stripeMat, 1), 0, 2.34, D / 2 - 0.02, 0.25, 0, 0);
  // Front clockface & exposed brass cogwheels on kiosk crest
  const cf = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 20), clockMat);
  K.add(cf, 0, 2.95, D / 2 - 0.18, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.05, 6, 20), brass), 0, 2.95, D / 2 - 0.16);
  for (const sx of [-0.72, 0.72]) {
    K.add(new THREE.Mesh(makeGearGeo(THREE, 0.34, 0.06, 12, 5), brass), sx, 2.78, D / 2 - 0.18);
  }

  // Countertop wares: glowing crystal clusters, rainbow potion flasks & autumn flowers
  for (let c = 0; c < 3; c++) {
    K.add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3 - c * 0.04, 6), crystalGlow), -0.95 + c * 0.11, 1.12, 0.12, 0.12, 0, (c - 1) * 0.2);
  }
  for (const [fx, fMat] of [[-0.15, cyanGlow], [0.22, warmGlow], [0.58, crystalGlow], [0.95, cyanGlow]]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), fMat), fx, 1.09, 0.1);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), brass), fx, 1.24, 0.1);
  }

  K.finalize([]);
  return stampPaintColors(THREE, K.root);
}

// ============================================================================
// LANDMARK 5: STONE BRIDGE (Walkable arched stone canal bridge w/ lanterns & ivy)
// ============================================================================
function buildStoneBridge(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'stoneBridge', 127);
  const stone = K.M(0xd3c4ae, K.tex('stone', 2.4, 2.4), { metalness: 0 });
  const cobble = K.M(0xc4b199, K.tex('stone', 3.0, 3.0), { metalness: 0 });
  const brass = K.M(0xe8b84b, null, { roughness: 0.40, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const warmGlow = K.glowMat(0xffe7a6, 0xffad3b, 1.55, { metalness: 0 });

  const W = 3.8, L = 5.8;
  // Walkable low-rise cobble deck + masonry arch underneath (spans along Z across the brook!)
  const deck = K.rbox(W, 0.28, L, 0.06, cobble, 1);
  K.add(deck, 0, 0.18, 0);
  // Stone arch ring underneath the deck
  for (const sx of [-1, 1]) {
    const archRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.22, 6, 18, PI), stone);
    K.add(archRing, sx * (W / 2 - 0.18), -0.35, 0, 0, PI / 2, 0);
  }
  // Stone arch spandrels & low parapet walls on left/right sides (colliders ONLY on side parapets!)
  for (const sx of [-1, 1]) {
    K.boxCol(sx * (W / 2 - 0.17), 0, 0.34, L - 0.4);
    K.add(K.rbox(0.32, 0.72, L - 0.3, 0.05, stone, 1), sx * (W / 2 - 0.17), 0.56, 0);
    K.add(K.rbox(0.38, 0.12, L - 0.16, 0.04, stone, 1), sx * (W / 2 - 0.17), 0.94, 0);
    for (const sz of [-1, 1]) {
      K.add(K.rbox(0.46, 1.08, 0.46, 0.05, stone, 1), sx * (W / 2 - 0.17), 0.54, sz * (L / 2 - 0.22));
    }
    addCoachLantern(THREE, K, sx * (W / 2 - 0.17), 1.32, 0, brass, warmGlow);
    scatterFoliageCluster(THREE, K, sx * (W / 2 + 0.06), 0.72, 0, 0.18, 0.22, 1.4, 14, [0xf5849e, 0xffbe48, 0xfff0be]);
  }

  K.finalize([]);
  stampPaintColors(THREE, K.root);
  K.root.traverse((m) => {
    if (m.isMesh && m.material === cobble) {
      m.userData.ground = true;
      m.userData.paint = new THREE.Color(0xc4b199);
    }
  });
  return K.root;
}

// ============================================================================
// ASTROLABE PORTAL DOORWAY (Interactive Town Teleport Mechanism)
// A spinning brass star-compass astrolabe crowns the arch; the single gem at its hub (`destGem`)
// glows in the colour of the currently dialled destination.
// ============================================================================
export function buildDialPortalDoor(THREE, opts = {}) {
  const colorHex = opts.colorHex ?? 0x3b82f6;
  const glowHex = opts.glowHex ?? 0x7cc4ff;
  const K = createBuilderKit(THREE, opts, 'dialPortalDoor', 139 + (opts.seed || 0));

  const stone = K.M(0xd6c7b0, K.tex('stone', 1.8, 1.8), { metalness: 0 });
  const darkOak = K.M(0x633d24, K.tex('wood_planks_dark', 1.5, 1.5), { metalness: 0 });
  const brass = K.M(0xe8b84b, null, { roughness: 0.38, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.18 });
  const gold = K.M(0xf5cc5c, null, { roughness: 0.36, metalness: 0, emissive: 0x4a2e08, emissiveIntensity: 0.22 });
  const copper = K.M(0xc97842, null, { roughness: 0.44, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.14 });
  const iron = K.M(0x4a4d5c, null, { roughness: 0.62, metalness: 0 });
  const slate = K.M(0x5c6884, texSlateShingles(THREE), { metalness: 0 });
  const warmGlow = K.glowMat(0xffe7a8, 0xffad3b, 1.55, { metalness: 0 });
  const portalCurtainMat = K.glowMat(glowHex, colorHex, 1.35, { roughness: 0.32, metalness: 0 });
  const wheelMat = K.M(0xffffff, texPortalWheel(THREE), {
    emissive: 0xffd27a,
    emissiveMap: texPortalWheel(THREE),
    emissiveIntensity: 0.96,
    roughness: 0.38,
    metalness: 0,
  });

  // Collider ONLY on the stone/oak doorway frame at z = 0; landing pad at +Z (z = +1.45m) is 100% open!
  K.boxCol(0, -0.06, 2.24, 0.56);

  // Carved Alsace stone arch piers & peaked slate gable hood
  for (const sx of [-1, 1]) {
    K.add(K.rbox(0.42, 2.28, 0.52, 0.05, stone, 1), sx * 0.88, 1.14, 0);
    K.add(K.rbox(0.50, 0.22, 0.60, 0.04, stone, 1), sx * 0.88, 0.11, 0);
    addCoachLantern(THREE, K, sx * 1.04, 1.98, 0.34, brass, warmGlow);
  }
  const archStone = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.22, 8, 22, PI), stone);
  archStone.scale.set(1, 1, 1.25);
  K.add(archStone, 0, 2.22, 0);
  // Peaked slate portal gable cap + brass finial
  for (const sx of [-1, 1]) {
    K.add(K.rbox(1.52, 0.15, 0.78, 0.03, slate, 1), sx * 0.56, 3.06, 0.02, 0, 0, -sx * 0.52);
  }
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.28, 0.06, 12, 5), gold), 0, 3.48, 0.06);

  // Recessed iron-studded oak door & shimmering arcane portal veil (+Z front)
  K.add(K.rbox(1.52, 2.22, 0.22, 0.03, darkOak, 1), 0, 1.12, -0.06);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.22, 20, 1, false, 0, PI), darkOak), 0, 2.20, -0.06, PI / 2, 0, -PI / 2);
  K.add(K.rbox(1.26, 2.04, 0.08, 0.02, portalCurtainMat, 1), 0, 1.08, 0.06);
  const veilArch = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.08, 20), portalCurtainMat);
  K.add(veilArch, 0, 2.08, 0.06, PI / 2, 0, 0);
  // Ornate brass astrological ring & door handle
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.028, 6, 22), brass), 0, 1.36, 0.11);
  K.add(new THREE.Mesh(makeGearGeo(THREE, 0.22, 0.04, 10, 4), copper), 0, 1.36, 0.12);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), gold), 0.46, 1.06, 0.14);

  // Inlaid brass & stone Star-Compass Landing Pad on ground in front (+Z = 1.45m)
  const padStone = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.18, 0.05, 24), stone);
  K.add(padStone, 0, 0.025, 1.45);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.035, 6, 26), brass), 0, 0.052, 1.45, PI / 2, 0, 0);
  const padColorRing = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.88, 24), portalCurtainMat);
  K.add(padColorRing, 0, 0.056, 1.45, -PI / 2, 0, 0);

  // Spinning Brass Astrolabe Dial (`portalWheel`) + live Destination Gem at its hub (`destGem`)!
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.055, 8, 24), brass), 0, 2.66, 0.28);
  // Fixed iron index pointer at top of the dial
  K.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.20, 6), iron), 0, 3.20, 0.32, PI, 0, 0);

  const portalWheel = new THREE.Group();
  portalWheel.name = 'portalWheel';
  portalWheel.position.set(0, 2.66, 0.29);
  K.root.add(portalWheel);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 24), wheelMat);
  disc.rotation.x = PI / 2;
  portalWheel.add(disc);
  portalWheel.add(new THREE.Mesh(makeGearGeo(THREE, 0.52, 0.05, 16, 4), gold));
  // Raised off-centre armillary ring + sighting bar riding on the dial face
  const rete = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 6, 22), copper);
  rete.position.set(0.045, 0.07, 0.045);
  portalWheel.add(rete);
  const alidade = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.035, 0.02), gold);
  alidade.position.z = 0.05;
  alidade.rotation.z = PI / 4;
  portalWheel.add(alidade);

  const destGemMat = new THREE.MeshStandardMaterial({
    color: glowHex,
    emissive: colorHex,
    emissiveIntensity: 1.65,
    roughness: 0.28,
    metalness: 0,
  });
  // Faceted hub gem in a brass bezel
  const destGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 1), destGemMat);
  destGem.name = 'destGem';
  destGem.position.set(0, 2.66, 0.38);
  destGem.scale.set(1, 1, 0.7);
  K.root.add(destGem);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.022, 6, 16), brass), 0, 2.66, 0.36);

  K.finalize([portalWheel, destGem]);
  stampPaintColors(THREE, K.root);
  K.root.traverse((m) => {
    if (m.isMesh && m === padStone) {
      m.userData.ground = true;
      m.userData.paint = new THREE.Color(0xd6c7b0);
    }
  });
  return K.root;
}

// ============================================================================
// Exported Factory Registry
// ============================================================================
export function buildBuildings(THREE) {
  const bind = (fn) => (a, b) => (a && typeof a.Group === 'function' ? fn(a, b || {}) : fn(THREE, a || {}));
  const orrery = bind(buildOrreryFountain);
  const kiosk = bind(buildMarketKiosk);
  return {
    hatter_boutique: bind(buildHatterBoutique),
    wizard_parlor: bind(buildWizardParlor),
    clockmaker_hall: bind(buildClockmakerHall),
    alchemist_shop: bind(buildAlchemistShop),
    royal_patisserie: bind(buildRoyalPatisserie),
    orreryFountain: orrery,
    clockworkTram: bind(buildClockworkTram),
    walkingTurret: bind(buildWalkingTurret),
    marketKiosk: kiosk,
    stoneBridge: bind(buildStoneBridge),
    dialPortalDoor: bind(buildDialPortalDoor),
    buildCenterpiece: orrery,
    buildStall: kiosk,
  };
}
