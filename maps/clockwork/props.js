/* Hue & Seek — Map 4 (`clockwork`: Pendulum Square Wizard's Market) Hideable Props.
 * 12 hand-crafted Storybook 3D props for an original steam-and-magic market town, matching
 * assets/maps/clockwork/props_sheet.png with <= 8 draw calls each.
 */
import {
  createPropBuilder,
  paintedCanvasTex,
  brushStrokes,
  mergeGeometries,
} from '../map_kit.js?v=2';
import { attachCreatureKinematics } from '../world_interactives.js?v=v10';

const PI = Math.PI;

export const PROPS = [
  { id: 'cw_grandfather_clock', label: 'Pendulum Clock', icon: '🕰️', radius: 0.34, height: 1.48 },
  { id: 'cw_hatbox_stack', label: 'Millinery Hatboxes', icon: '👒', radius: 0.48, height: 0.96 },
  { id: 'cw_brass_orrery', label: 'Astronomical Orrery', icon: '🪐', radius: 0.46, height: 1.02 },
  { id: 'cw_potion_rack', label: 'Alchemist Retorts', icon: '⚗️', radius: 0.50, height: 0.94 },
  { id: 'cw_dress_form', label: 'Wizard Cloak Form', icon: '🧥', radius: 0.46, height: 1.30 },
  { id: 'cw_steam_samovar', label: 'Copper Samovar', icon: '🫖', radius: 0.46, height: 0.88 },
  { id: 'cw_gramophone', label: 'Brass Gramophone', icon: '📻', radius: 0.44, height: 1.04 },
  { id: 'cw_automaton_owl', label: 'Clockwork Owl', icon: '🦉', radius: 0.34, height: 0.98, isAnimal: true, canFly: true, flyMaxY: 14.5, flapIntervalMs: 340, flapPitch: 1.08 },
  { id: 'cw_cake_stand', label: 'Pâtisserie Stand', icon: '🧁', radius: 0.44, height: 0.98 },
  { id: 'cw_spellbook_lectern', label: 'Grimoire Lectern', icon: '📖', radius: 0.48, height: 1.12 },
  { id: 'cw_street_lamp', label: 'Gaslight Flower Post', icon: '🏮', radius: 0.42, height: 1.42 },
  { id: 'cw_coal_hearth_pot', label: 'Emberwick Brazier', icon: '🔥', radius: 0.46, height: 0.88 },
  { id: 'cw_clockwork_pup', label: 'Wind-Up Brass Hound', icon: '🐕', radius: 0.32, height: 0.66, isAnimal: true },
];

export const PROP_ICONS = Object.fromEntries(PROPS.map((p) => [p.id, p.icon]));

// ============================================================================
// Procedural Painted Canvas Textures (cached once via paintedCanvasTex)
// ============================================================================
function getClockworkPropTextures(THREE) {
  // 1. Roman numeral Victorian clock dial
  const clockDial = paintedCanvasTex(THREE, 'cw_clock_dial', 256, (g, s, rng) => {
    const cx = s / 2, cy = s / 2;
    const rad = g.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.49);
    rad.addColorStop(0, '#fffaf0');
    rad.addColorStop(0.78, '#f6e7c8');
    rad.addColorStop(1, '#dec496');
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 120, ['#fdf3de', '#eedbb6'], 1.5, 3.5, 0.22, 0, PI, 22);

    g.strokeStyle = '#3b2618';
    g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, s * 0.44, 0, PI * 2); g.stroke();
    g.lineWidth = 1.6;
    g.beginPath(); g.arc(cx, cy, s * 0.39, 0, PI * 2); g.stroke();
    g.strokeStyle = '#b98836';
    g.lineWidth = 2.2;
    g.beginPath(); g.arc(cx, cy, s * 0.25, 0, PI * 2); g.stroke();

    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * PI * 2 - PI / 2;
      const r0 = i % 5 === 0 ? s * 0.39 : s * 0.415;
      const r1 = s * 0.44;
      g.strokeStyle = '#2d1c10';
      g.lineWidth = i % 5 === 0 ? 2.4 : 1.1;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.stroke();
    }

    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.fillStyle = '#24150c';
    g.font = 'bold 21px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    numerals.forEach((num, idx) => {
      const a = (idx / 12) * PI * 2 - PI / 2;
      const rr = s * 0.325;
      g.save();
      g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      g.rotate(a + PI / 2);
      g.fillText(num, 0, 0);
      g.restore();
    });
  });

  // Helper to paint roses on hatboxes / china
  const drawRose = (g, x, y, r, mainCol = '#df6f89', hiCol = '#f9bac8', leafCol = '#5a8a4b') => {
    for (const [ang, d] of [[-0.5, 1.25], [0.55, 1.2], [2.5, 1.15], [-2.4, 1.1]]) {
      g.save();
      g.translate(x + Math.cos(ang) * r * d, y + Math.sin(ang) * r * d * 0.72);
      g.rotate(ang);
      g.fillStyle = leafCol;
      g.beginPath(); g.ellipse(0, 0, r * 0.62, r * 0.28, 0, 0, PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = mainCol;
    g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + 0.3;
      g.fillStyle = i % 2 === 0 ? hiCol : mainCol;
      g.beginPath();
      g.arc(x + Math.cos(a) * r * 0.38, y + Math.sin(a) * r * 0.38, r * 0.5, 0, PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffe59c';
    g.beginPath(); g.arc(x, y, r * 0.22, 0, PI * 2); g.fill();
  };

  // 2. Bottom hatbox: cream & blush pink stripes + rose clusters
  const hatboxBot = paintedCanvasTex(THREE, 'cw_hatbox_bot', 256, (g, s, rng) => {
    g.fillStyle = '#f8ecd4';
    g.fillRect(0, 0, s, s);
    const stripes = 14;
    const sw = s / stripes;
    for (let i = 0; i < stripes; i++) {
      if (i % 2 === 1) {
        g.fillStyle = '#e7a0ae';
        g.fillRect(i * sw, 0, sw * 0.56, s);
      }
    }
    brushStrokes(g, s, rng, 90, ['#fff6e4', '#e396a5'], 1, 2.5, 0.16, PI / 2, 0.2, 28);
    g.fillStyle = '#d4a24c';
    g.fillRect(0, 0, s, 10);
    g.fillRect(0, s - 10, s, 10);
    for (const x of [s * 0.22, s * 0.55, s * 0.84]) {
      drawRose(g, x, s * 0.54, 18);
      drawRose(g, x + 18, s * 0.64, 11, '#eb8aa0', '#ffd2dc', '#689955');
    }
  });

  // 3. Middle hatbox: deep sage-forest floral garland + gold trim
  const hatboxMid = paintedCanvasTex(THREE, 'cw_hatbox_mid', 256, (g, s, rng) => {
    g.fillStyle = '#3f624d';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 140, ['#4d745c', '#335240', '#588267'], 2, 5, 0.28, 0, PI, 24);
    g.fillStyle = '#deb052';
    g.fillRect(0, 8, s, 8);
    g.fillRect(0, s - 16, s, 8);
    for (let i = 0; i < 5; i++) {
      const x = (i + 0.5) * (s / 5);
      drawRose(g, x, s * 0.52, 17, '#e88296', '#ffd6df', '#7db067');
    }
  });

  // 4. Top hatbox: cream & plum-lavender stripes
  const hatboxTop = paintedCanvasTex(THREE, 'cw_hatbox_top', 256, (g, s, rng) => {
    g.fillStyle = '#f6ead4';
    g.fillRect(0, 0, s, s);
    const stripes = 12, sw = s / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 === 0 ? '#f6ead4' : '#95658e';
      g.fillRect(i * sw, 0, sw, s);
    }
    brushStrokes(g, s, rng, 80, ['#fff5e2', '#a877a0'], 1.2, 3, 0.16, PI / 2, 0.25, 24);
    g.fillStyle = '#deb052';
    g.fillRect(0, 0, s, 9);
    g.fillRect(0, s - 9, s, 9);
  });

  // 5. Starry emerald & gold wizard cloak fabric
  const wizardCloak = paintedCanvasTex(THREE, 'cw_wizard_cloak', 256, (g, s, rng) => {
    g.fillStyle = '#1d5a4c';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 220, ['#256c5b', '#16483c', '#2b7765'], 2, 6, 0.32, PI / 2, 0.5, 32);
    // Ornate gold border along bottom (v near 0 or 1 depending on lathe orientation; draw at bottom y -> s)
    g.fillStyle = '#e2b24a';
    g.fillRect(0, s - 22, s, 10);
    g.fillRect(0, s - 8, s, 8);
    g.strokeStyle = '#f5cf70';
    g.lineWidth = 2.6;
    g.beginPath();
    for (let x = 0; x <= s; x += 16) {
      g.moveTo(x, s - 24);
      g.quadraticCurveTo(x + 8, s - 42, x + 16, s - 24);
    }
    g.stroke();

    const drawStar = (cx, cy, rOut, rIn, pts = 8) => {
      g.fillStyle = '#f4c95d';
      g.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a = (i / (pts * 2)) * PI * 2 - PI / 2;
        const r = i % 2 === 0 ? rOut : rIn;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    };
    const starSpots = [
      [38, 48, 13], [110, 36, 9], [188, 56, 14], [234, 40, 8],
      [66, 108, 15], [148, 98, 11], [214, 122, 13], [24, 142, 10],
      [94, 168, 16], [174, 174, 15], [42, 196, 11], [228, 190, 12],
    ];
    for (const [x, y, r] of starSpots) drawStar(x, y, r, r * 0.28, r > 12 ? 8 : 4);
    g.fillStyle = '#ffe28a';
    for (let i = 0; i < 36; i++) {
      g.beginPath(); g.arc(rng.jr(8, s - 8), rng.jr(12, s - 38), rng.jr(1.3, 2.6), 0, PI * 2); g.fill();
    }
  });

  // 6. Floral bone-china porcelain (teacup, saucer, sugar pot, 3-tier cake plates)
  const porcelainFloral = paintedCanvasTex(THREE, 'cw_porcelain_floral', 256, (g, s, rng) => {
    const cx = s / 2, cy = s / 2;
    g.fillStyle = '#fcf6ea';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 80, ['#fffaf2', '#f3e8d4'], 2, 4, 0.2, 0, PI, 20);
    g.strokeStyle = '#dfa944';
    g.lineWidth = 7;
    g.beginPath(); g.arc(cx, cy, s * 0.46, 0, PI * 2); g.stroke();
    g.lineWidth = 2.2;
    g.beginPath(); g.arc(cx, cy, s * 0.31, 0, PI * 2); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      drawRose(g, cx + Math.cos(a) * s * 0.385, cy + Math.sin(a) * s * 0.385, 11, '#e36f8a', '#ffc6d4', '#639652');
    }
  });

  // 7. Open Illuminated Grimoire pages (left: autumn maple leaves, right: crescent moon chart)
  const grimoirePages = paintedCanvasTex(THREE, 'cw_grimoire_pages', 256, (g, s, rng) => {
    g.fillStyle = '#f4e3be';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 150, ['#faeed2', '#e5cca0', '#edd8b0'], 2, 5, 0.3, 0, PI, 24);
    // Center spine crease
    const sp = g.createLinearGradient(s * 0.45, 0, s * 0.55, 0);
    sp.addColorStop(0, 'rgba(90,52,24,0)');
    sp.addColorStop(0.5, 'rgba(90,52,24,0.48)');
    sp.addColorStop(1, 'rgba(90,52,24,0)');
    g.fillStyle = sp;
    g.fillRect(s * 0.44, 0, s * 0.12, s);

    // Ornate page borders
    g.strokeStyle = '#b98332';
    g.lineWidth = 3;
    g.strokeRect(12, 14, s * 0.35, s - 28);
    g.strokeRect(s * 0.53, 14, s * 0.35, s - 28);

    // Left page: painted autumn maple leaves & script lines
    for (const [lx, ly, col, sc] of [[54, 72, '#d85532', 18], [82, 118, '#e3962b', 15], [48, 154, '#c43e38', 14]]) {
      g.fillStyle = col;
      for (let k = 0; k < 5; k++) {
        const a = -PI / 2 + (k - 2) * 0.48;
        g.beginPath();
        g.ellipse(lx + Math.cos(a) * sc * 0.45, ly + Math.sin(a) * sc * 0.45, sc * 0.5, sc * 0.22, a, 0, PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = '#6c4528';
    g.lineWidth = 2;
    for (let y = 186; y <= 222; y += 9) {
      g.beginPath(); g.moveTo(24, y); g.lineTo(92, y); g.stroke();
    }

    // Right page: midnight-blue celestial moon circle + golden crescent + script
    const mcx = s * 0.705, mcy = 92, mr = 38;
    g.fillStyle = '#283d70';
    g.beginPath(); g.arc(mcx, mcy, mr, 0, PI * 2); g.fill();
    g.strokeStyle = '#e0ae42';
    g.lineWidth = 3;
    g.beginPath(); g.arc(mcx, mcy, mr + 3, 0, PI * 2); g.stroke();
    g.fillStyle = '#f8d264';
    g.beginPath(); g.arc(mcx - 3, mcy, 22, 0, PI * 2); g.fill();
    g.fillStyle = '#283d70';
    g.beginPath(); g.arc(mcx + 7, mcy - 4, 19, 0, PI * 2); g.fill();
    g.strokeStyle = '#6c4528';
    g.lineWidth = 2;
    for (let y = 152; y <= 220; y += 9) {
      g.beginPath(); g.moveTo(s * 0.57, y); g.lineTo(s * 0.84, y); g.stroke();
    }
  });

  // 8. Autumn & emerald ivy leaf gradient texture (allows green + crimson leaves in 1 draw call!)
  const autumnIvy = paintedCanvasTex(THREE, 'cw_autumn_ivy', 128, (g, s, rng) => {
    const grd = g.createLinearGradient(0, 0, s, s);
    grd.addColorStop(0, '#4e863b');
    grd.addColorStop(0.52, '#699842');
    grd.addColorStop(0.75, '#d96b38');
    grd.addColorStop(1, '#c94148');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 60, ['#5f9944', '#e07a42', '#b83840'], 2, 5, 0.3, 0, PI, 18);
  });

  return {
    clockDial,
    hatboxBot,
    hatboxMid,
    hatboxTop,
    wizardCloak,
    porcelainFloral,
    grimoirePages,
    autumnIvy,
  };
}

// ============================================================================
// Reusable Clockwork & Artisanal 3D Geometry Helpers
// ============================================================================
function makeGearGeo(THREE, rOut, rRoot, rHole, teeth = 12, thick = 0.022) {
  const s = new THREE.Shape();
  const step = (PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.66;
    const a4 = a0 + step * 0.78;
    const p0x = Math.cos(a0) * rRoot, p0y = Math.sin(a0) * rRoot;
    if (i === 0) s.moveTo(p0x, p0y); else s.lineTo(p0x, p0y);
    s.lineTo(Math.cos(a1) * rRoot, Math.sin(a1) * rRoot);
    s.lineTo(Math.cos(a2) * rOut, Math.sin(a2) * rOut);
    s.lineTo(Math.cos(a3) * rOut, Math.sin(a3) * rOut);
    s.lineTo(Math.cos(a4) * rRoot, Math.sin(a4) * rRoot);
  }
  s.closePath();
  if (rHole > 0.004) {
    const h = new THREE.Path();
    h.absarc(0, 0, rHole, 0, PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: false,
    curveSegments: 3,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

function makeStarGeo(THREE, pts = 5, rOut = 0.055, rIn = 0.024, thick = 0.018) {
  const s = new THREE.Shape();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * PI * 2 + PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: Math.min(0.005, thick * 0.28),
    bevelSize: Math.min(0.004, thick * 0.24),
    bevelSegments: 1,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

function planarDiscGeo(THREE, R, thick = 0.016, seg = 28) {
  const g = new THREE.CylinderGeometry(R, R, thick, seg);
  g.rotateX(PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, 0.5 + pos.getX(i) / (2.02 * R), 0.5 + pos.getY(i) / (2.02 * R));
  }
  return g;
}

function scallopedPlateGeo(THREE, R, petals = 12) {
  const prof = [
    [0, 0], [R * 0.58, 0], [R * 0.78, 0.008], [R * 0.96, 0.026],
    [R * 1.0, 0.033], [R * 0.94, 0.036], [R * 0.72, 0.016], [0, 0.012],
  ];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rr = Math.hypot(x, z);
    if (rr > R * 0.62) {
      const ang = Math.atan2(z, x);
      const k = (rr - R * 0.62) / (R * 0.38);
      const wave = 1 + 0.045 * k * Math.cos(ang * petals);
      x *= wave; z *= wave;
      y += 0.004 * k * Math.cos(ang * petals);
      pos.setXYZ(i, x, y, z);
    }
    uv.setXY(i, 0.5 + x / (2.12 * R), 0.5 + z / (2.12 * R));
  }
  g.computeVertexNormals();
  return g;
}

function scallopedHornBellGeo(THREE, length = 0.36, rMouth = 0.25, petals = 9) {
  const pts = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = 0.032 + Math.pow(t, 2.05) * (rMouth - 0.032);
    const y = t * length;
    pts.push(new THREE.Vector2(r, y));
  }
  const g = new THREE.LatheGeometry(pts, 40);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = Math.max(0, Math.min(1, y / length));
    const ang = Math.atan2(z, x);
    const rib = Math.cos(ang * petals);
    const radialWave = 1 + 0.068 * Math.pow(t, 1.4) * rib;
    x *= radialWave;
    z *= radialWave;
    y += 0.024 * Math.pow(t, 2.2) * rib;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function wizardCloakGeo(THREE) {
  // Open-front draped cloak spanning around sides & back, flaring from collar to floor hem
  const rows = [
    { y: 1.07, r: 0.125, open: 0.28, pleat: 0.004 },
    { y: 0.98, r: 0.225, open: 0.36, pleat: 0.008 },
    { y: 0.80, r: 0.255, open: 0.48, pleat: 0.015 },
    { y: 0.56, r: 0.300, open: 0.56, pleat: 0.022 },
    { y: 0.30, r: 0.355, open: 0.62, pleat: 0.030 },
    { y: 0.08, r: 0.395, open: 0.66, pleat: 0.036 },
    { y: 0.025, r: 0.410, open: 0.68, pleat: 0.040 },
  ];
  const cols = 38;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const { y, r, open, pleat } = rows[ri];
    const vCoord = 1 - ri / (rows.length - 1); // v=0 at bottom hem where gold border is!
    for (let ci = 0; ci <= cols; ci++) {
      const u = ci / cols;
      const th = open + u * (PI * 2 - open * 2); // 0 is +Z front; sweeps around +X -> -Z -> -X
      const fold = Math.sin(u * PI * 9) * pleat + Math.cos(u * PI * 5) * pleat * 0.45;
      const rr = r + fold;
      const sweepBack = (1 - Math.cos(th)) * 0.028 * (ri / rows.length);
      positions.push(Math.sin(th) * rr, y, Math.cos(th) * rr * 0.92 - sweepBack);
      uvs.push(u * 1.6, vCoord);
    }
  }
  const stride = cols + 1;
  for (let ri = 0; ri < rows.length - 1; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const a = ri * stride + ci;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// ============================================================================
// Main Prop Builder Factory
// ============================================================================
export function buildMapProps(THREE) {
  const { mat, buildMergedProto, add, rbox, lathe, tube } = createPropBuilder(THREE, 404);
  const T = getClockworkPropTextures(THREE);

  // Shared core materials (metalness: 0 everywhere; warm Storybook diffuse tones + subtle emissive)
  const walnut = mat('walnut', 0xdca472, 'wood_light', 1.2, { roughness: 0.80, metalness: 0 });
  const walnutDark = mat('walnutDark', 0xbe8658, 'wood_planks_dark', 1.2, { roughness: 0.84, metalness: 0 });
  const oak = mat('oak', 0xe8b57c, 'wood_light', 1.2, { roughness: 0.82, metalness: 0 });
  const brass = mat('brass', 0xe8b84b, null, 1, { roughness: 0.44, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.14 });
  const brassDouble = mat('brass2', 0xe8b84b, null, 1, { roughness: 0.44, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.14, side: THREE.DoubleSide });
  const bronzeDark = mat('bronzeDark', 0x6b4c32, 'painted_metal', 1, { roughness: 0.62, metalness: 0 });
  const copper = mat('copper', 0xc97842, null, 1, { roughness: 0.46, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
  const castIron = mat('castIron', 0x4a4d5c, 'painted_metal', 1.2, { roughness: 0.68, metalness: 0 });
  const foliage = mat('foliage', 0x629b46, 'leaves', 1, { roughness: 0.86, metalness: 0 });
  const strawMat = mat('straw', 0xf4d78e, 'hay', 1.8, { roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const satinPink = mat('satinPink', 0xd86886, null, 1, { roughness: 0.56, metalness: 0, side: THREE.DoubleSide });

  // Custom painted canvas materials (cached per buildMapProps instance, metalness: 0)
  const dialMat = new THREE.MeshStandardMaterial({ map: T.clockDial, roughness: 0.72, metalness: 0 });
  const boxBotMat = new THREE.MeshStandardMaterial({ map: T.hatboxBot, roughness: 0.86, metalness: 0 });
  const boxMidMat = new THREE.MeshStandardMaterial({ map: T.hatboxMid, roughness: 0.86, metalness: 0 });
  const boxTopMat = new THREE.MeshStandardMaterial({ map: T.hatboxTop, roughness: 0.86, metalness: 0 });
  const cloakMat = new THREE.MeshStandardMaterial({ map: T.wizardCloak, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  const porcelainMat = new THREE.MeshStandardMaterial({ map: T.porcelainFloral, roughness: 0.35, metalness: 0 });
  const grimoireMat = new THREE.MeshStandardMaterial({ map: T.grimoirePages, roughness: 0.88, metalness: 0 });
  const ivyMat = new THREE.MeshStandardMaterial({ map: T.autumnIvy, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });

  const sph = (r = 0.05, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
  const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const tor = (R, r, rs = 8, ts = 22, arc = PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);

  const builders = {
    // ------------------------------------------------------------------------
    // 1. cw_grandfather_clock ('Pendulum Clock', r:0.42, h:1.48)
    // ------------------------------------------------------------------------
    cw_grandfather_clock: () => buildMergedProto('cw_grandfather_clock', (g) => {
      const nightBlue = mat('nightBlue', 0x243b6e, null, 1, { roughness: 0.62 });
      const moonGlow = mat('moonGlow', 0xffe694, null, 1, { emissive: 0xffb838, emissiveIntensity: 0.85, roughness: 0.42 });

      // Bracket feet & stepped walnut plinth
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(g, rbox(0.11, 0.055, 0.10, 0.016), walnutDark, sx * 0.21, 0.027, sz * 0.13);
      }
      add(g, rbox(0.54, 0.05, 0.34, 0.018), walnutDark, 0, 0.065, 0);
      add(g, rbox(0.50, 0.25, 0.30, 0.025), walnut, 0, 0.20, 0);
      add(g, rbox(0.36, 0.14, 0.025, 0.01), walnutDark, 0, 0.20, 0.148);
      // Carved golden leaf scroll on base panel
      add(g, sph(0.024, 10, 8), brass, 0, 0.20, 0.163, 0, 0, 0, 1.1, 0.8, 0.35);
      for (const sx of [-1, 1]) {
        add(g, sph(0.02, 10, 8), brass, sx * 0.055, 0.20, 0.162, 0, 0, sx * 0.45, 1.8, 0.55, 0.3);
        add(g, sph(0.015, 8, 6), brass, sx * 0.105, 0.195, 0.162, 0, 0, -sx * 0.3, 1.4, 0.45, 0.3);
      }
      add(g, rbox(0.52, 0.045, 0.32, 0.016), walnutDark, 0, 0.34, 0);

      // Waist section with recessed dark pendulum chamber & brass pendulum + weights
      add(g, rbox(0.42, 0.48, 0.20, 0.02), walnut, 0, 0.59, -0.04);
      for (const sx of [-1, 1]) {
        add(g, rbox(0.075, 0.48, 0.26, 0.018), walnut, sx * 0.175, 0.59, 0);
        add(g, cyl(0.026, 0.028, 0.43, 12), walnutDark, sx * 0.195, 0.59, 0.125);
        add(g, cyl(0.033, 0.033, 0.025, 12), brass, sx * 0.195, 0.385, 0.125);
        add(g, cyl(0.033, 0.033, 0.025, 12), brass, sx * 0.195, 0.795, 0.125);
      }
      // Dark interior backing & arched waist door frame
      add(g, rbox(0.24, 0.42, 0.02, 0.008), walnutDark, 0, 0.59, 0.055);
      add(g, tor(0.095, 0.018, 6, 18, PI), walnutDark, 0, 0.72, 0.115);
      // Hanging weights & shiny brass pendulum bob
      for (const [wx, wy] of [[-0.052, 0.67], [0.052, 0.63]]) {
        add(g, cyl(0.004, 0.004, 0.16, 6), brass, wx, wy + 0.08, 0.085);
        add(g, cyl(0.018, 0.018, 0.085, 12), brass, wx, wy, 0.085);
      }
      add(g, cyl(0.006, 0.006, 0.30, 8), brass, 0, 0.64, 0.098, 0, 0, 0.05);
      add(g, sph(0.055, 16, 12), brass, 0.012, 0.485, 0.102, 0, 0, 0, 1, 1, 0.38);
      add(g, tor(0.056, 0.007, 6, 20), brass, 0.012, 0.485, 0.105);

      // Waist cornice molding
      add(g, rbox(0.50, 0.05, 0.32, 0.018), walnutDark, 0, 0.845, 0);
      add(g, rbox(0.54, 0.04, 0.34, 0.016), walnut, 0, 0.885, 0);

      // Hood section: Roman dial + midnight-blue moon-phase arch
      add(g, rbox(0.46, 0.40, 0.29, 0.022), walnut, 0, 1.10, -0.005);
      for (const sx of [-1, 1]) {
        add(g, cyl(0.026, 0.028, 0.38, 12), walnutDark, sx * 0.215, 1.10, 0.138);
        add(g, cyl(0.034, 0.034, 0.024, 12), brass, sx * 0.215, 0.92, 0.138);
        add(g, cyl(0.034, 0.034, 0.024, 12), brass, sx * 0.215, 1.28, 0.138);
      }
      // Roman dial face + brass bezel + ornate hands
      add(g, planarDiscGeo(THREE, 0.148, 0.018, 28), dialMat, 0, 1.055, 0.142);
      add(g, tor(0.150, 0.014, 8, 28), brass, 0, 1.055, 0.150);
      add(g, rbox(0.016, 0.088, 0.008, 0.003), walnutDark, -0.028, 1.082, 0.158, 0, 0, 0.68);
      add(g, rbox(0.012, 0.116, 0.008, 0.003), walnutDark, 0.042, 1.084, 0.160, 0, 0, -0.88);
      add(g, sph(0.014, 10, 8), brass, 0, 1.055, 0.164);

      // Blue Moon-Phase Lunette Arch above dial
      const archCrown = new THREE.CylinderGeometry(0.125, 0.125, 0.27, 22, 1, false, 0, PI);
      archCrown.rotateZ(PI / 2);
      archCrown.rotateY(PI / 2);
      add(g, archCrown, walnut, 0, 1.27, -0.005);
      const lunette = new THREE.CylinderGeometry(0.102, 0.102, 0.02, 22, 1, false, 0, PI);
      lunette.rotateZ(PI / 2);
      lunette.rotateY(PI / 2);
      add(g, lunette, nightBlue, 0, 1.225, 0.140);
      add(g, tor(0.105, 0.011, 6, 20, PI), brass, 0, 1.225, 0.148);
      // Crescent moon & stars inside lunette
      add(g, tor(0.028, 0.008, 6, 14, PI * 1.35), moonGlow, -0.008, 1.275, 0.153, 0, 0, 0.9);
      for (const [sx, sy, sr] of [[-0.055, 1.26, 0.007], [0.052, 1.268, 0.008], [0.028, 1.295, 0.006]]) {
        add(g, sph(sr, 6, 5), moonGlow, sx, sy, 0.153);
      }

      // Swan-neck scrolled pediment + carved crest & 3 finials (reaching 1.48m)
      add(g, rbox(0.52, 0.038, 0.33, 0.014), walnutDark, 0, 1.31, 0);
      for (const sx of [-1, 1]) {
        const scrollPts = [
          [sx * 0.24, 1.32, 0.14],
          [sx * 0.18, 1.385, 0.14],
          [sx * 0.095, 1.425, 0.14],
          [sx * 0.055, 1.40, 0.14],
        ];
        add(g, tube(scrollPts, 0.022, 12, 7), walnut);
        add(g, sph(0.024, 10, 8), brass, sx * 0.055, 1.40, 0.148);
        // Side finials
        add(g, cyl(0.016, 0.022, 0.045, 10), walnutDark, sx * 0.22, 1.35, 0.12);
        add(g, sph(0.022, 10, 8), brass, sx * 0.22, 1.385, 0.12);
      }
      // Central crown finial
      add(g, rbox(0.11, 0.09, 0.24, 0.02), walnut, 0, 1.365, 0);
      add(g, cyl(0.018, 0.026, 0.045, 10), brass, 0, 1.425, 0.04);
      add(g, sph(0.026, 10, 8), brass, 0, 1.460, 0.04, 0, 0, 0, 0.9, 1.25, 0.9);
    }),

    // ------------------------------------------------------------------------
    // 2. cw_hatbox_stack ('Millinery Hatboxes', r:0.48, h:0.96)
    // ------------------------------------------------------------------------
    cw_hatbox_stack: () => buildMergedProto('cw_hatbox_stack', (g) => {
      const creamBlossom = mat('creamBlossom', 0xfff3dc, null, 1, { roughness: 0.72 });

      // Box 1 (Bottom): wide striped & rose-floral hatbox + big pink satin bow
      add(g, cyl(0.385, 0.385, 0.24, 32), boxBotMat, 0, 0.12, 0);
      add(g, cyl(0.402, 0.402, 0.052, 32), boxBotMat, 0, 0.245, 0, 0, 0.4, 0);
      add(g, tor(0.402, 0.009, 6, 32), satinPink, 0, 0.222, 0, PI / 2, 0, 0);
      // Big front satin bow on bottom lid rim (+Z)
      add(g, sph(0.032, 10, 8), satinPink, 0, 0.235, 0.408, 0, 0, 0, 1.1, 0.9, 0.65);
      for (const sx of [-1, 1]) {
        add(g, tor(0.058, 0.020, 7, 16), satinPink, sx * 0.068, 0.242, 0.404, 0.15, sx * 0.22, sx * 0.25, 1.25, 0.78, 0.55);
        const tailPts = [
          [sx * 0.02, 0.225, 0.408],
          [sx * 0.055, 0.145, 0.415],
          [sx * 0.082, 0.065, 0.402],
        ];
        add(g, tube(tailPts, 0.019, 10, 6), satinPink, 0, 0, 0, 0, 0, 0, 1.25, 1, 0.38);
      }

      // Box 2 (Middle): sage-emerald rose garland hatbox + brass clasp
      add(g, cyl(0.30, 0.30, 0.20, 28), boxMidMat, -0.01, 0.37, -0.01, 0, -0.35, 0);
      add(g, cyl(0.314, 0.314, 0.044, 28), boxMidMat, -0.01, 0.472, -0.01, 0, 0.2, 0);
      add(g, rbox(0.036, 0.048, 0.018, 0.006), brass, 0.06, 0.46, 0.305, 0, 0.22, 0);

      // Box 3 (Top): cream & plum-violet striped hatbox + brass clasp
      add(g, cyl(0.225, 0.225, 0.17, 26), boxTopMat, 0.015, 0.58, -0.015, 0, 0.25, 0);
      add(g, cyl(0.238, 0.238, 0.040, 26), boxTopMat, 0.015, 0.672, -0.015, 0, -0.15, 0);
      add(g, rbox(0.030, 0.042, 0.016, 0.005), brass, 0.08, 0.662, 0.212, 0, 0.32, 0);

      // Milliner's Flower-Trimmed Woven Straw Sunhat perched jauntily on top (y ~ 0.69..0.96)
      const hatGrp = new THREE.Group();
      hatGrp.position.set(-0.025, 0.745, 0.015);
      hatGrp.rotation.set(0.24, 0.16, 0.36);
      hatGrp.scale.setScalar(1.16);
      g.add(hatGrp);

      const hatProf = [
        [0.31, -0.025], [0.255, -0.012], [0.165, 0.008], [0.145, 0.025],
        [0.140, 0.095], [0.115, 0.145], [0.06, 0.168], [0, 0.174],
      ];
      const hatGeo = lathe(hatProf, 32);
      const hp = hatGeo.attributes.position;
      for (let i = 0; i < hp.count; i++) {
        const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
        const r = Math.hypot(x, z);
        if (r > 0.17) {
          const a = Math.atan2(z, x);
          hp.setY(i, y + Math.sin(a * 3) * 0.012 * ((r - 0.17) / 0.13));
        }
      }
      hatGeo.computeVertexNormals();
      add(hatGrp, hatGeo, strawMat);
      // Pink satin hatband + trailing ribbons cascading down left side
      add(hatGrp, cyl(0.146, 0.150, 0.042, 28), satinPink, 0, 0.042, 0);
      for (const [dx, dz, len] of [[-0.02, 0.04, 0.26], [0.02, -0.02, 0.22]]) {
        const rPts = [
          [-0.145, 0.04, dz],
          [-0.23 + dx, -0.03, dz + 0.04],
          [-0.27 + dx, -0.14, dz + 0.06],
          [-0.25 + dx, -len, dz + 0.05],
        ];
        add(hatGrp, tube(rPts, 0.018, 12, 6), satinPink, 0, 0, 0, 0, 0, 0, 1, 1, 0.42);
      }
      // Ribbon bow loops + floral bouquet on hatband
      for (const sz of [-1, 1]) {
        add(hatGrp, tor(0.042, 0.014, 6, 14), satinPink, -0.145, 0.055, sz * 0.048, 0, PI / 2, sz * 0.35, 1.2, 0.75, 0.6);
      }
      for (const [bx, by, bz, colM, sc] of [
        [-0.13, 0.072, 0.075, satinPink, 0.032],
        [-0.095, 0.088, 0.115, creamBlossom, 0.028],
        [-0.145, 0.052, 0.118, creamBlossom, 0.024],
        [-0.065, 0.062, 0.138, satinPink, 0.025],
      ]) {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * PI * 2;
          add(hatGrp, sph(sc * 0.65, 8, 6), colM, bx + Math.cos(a) * sc * 0.55, by + Math.sin(a) * sc * 0.45, bz + 0.008, 0, 0, 0, 1, 1, 0.55);
        }
        add(hatGrp, sph(sc * 0.32, 8, 6), brass, bx, by, bz + 0.016);
      }
      for (const [lx, ly, lz, rz] of [[-0.16, 0.095, 0.05, 0.6], [-0.05, 0.08, 0.15, -0.7], [-0.13, 0.03, 0.14, -0.4]]) {
        add(hatGrp, sph(0.026, 8, 6), foliage, lx, ly, lz, 0.2, 0.4, rz, 1.6, 0.65, 0.3);
      }
    }),

    // ------------------------------------------------------------------------
    // 3. cw_brass_orrery ('Astronomical Orrery', r:0.46, h:1.02)
    // ------------------------------------------------------------------------
    cw_brass_orrery: () => buildMergedProto('cw_brass_orrery', (g) => {
      const celestialBlue = mat('celestialBlue', 0x2b4380, null, 1, { roughness: 0.52, metalness: 0 });
      const marsRed = mat('marsRed', 0xc95a38, null, 1, { roughness: 0.55, metalness: 0 });
      const silverMoon = mat('silverMoon', 0xb5c2dc, null, 1, { roughness: 0.50, metalness: 0 });
      const sunGlow = mat('sunGlow', 0xffe27a, null, 1, { emissive: 0xff9a18, emissiveIntensity: 1.85, roughness: 0.3, metalness: 0 });

      // 4 Lion-claw scrolled brass legs supporting celestial drum base
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 4;
        const c = Math.cos(a), s = Math.sin(a);
        const legPts = [
          [c * 0.16, 0.14, s * 0.16],
          [c * 0.22, 0.09, s * 0.22],
          [c * 0.25, 0.035, s * 0.25],
        ];
        add(g, tube(legPts, 0.024, 8, 7), brass);
        add(g, sph(0.032, 10, 8), brass, c * 0.265, 0.022, s * 0.265, 0, -a, 0, 1.25, 0.68, 1.1);
      }
      // Celestial blue drum base w/ brass rims & star studs
      add(g, cyl(0.20, 0.23, 0.032, 24), brass, 0, 0.09, 0);
      add(g, cyl(0.175, 0.205, 0.095, 24), celestialBlue, 0, 0.145, 0);
      add(g, tor(0.205, 0.014, 7, 26), brass, 0, 0.102, 0, PI / 2, 0, 0);
      add(g, tor(0.176, 0.014, 7, 26), brass, 0, 0.192, 0, PI / 2, 0, 0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * PI * 2;
        add(g, makeStarGeo(THREE, 5, 0.018, 0.007, 0.008), brass, Math.sin(a) * 0.192, 0.146, Math.cos(a) * 0.192, 0, a, 0);
      }

      // Geared neck column & exposed bevel gears
      add(g, cyl(0.068, 0.115, 0.09, 18), brass, 0, 0.235, 0);
      add(g, makeGearGeo(THREE, 0.115, 0.095, 0.04, 16, 0.020), bronzeDark, 0, 0.22, 0, PI / 2, 0, 0);
      add(g, makeGearGeo(THREE, 0.068, 0.052, 0.018, 12, 0.018), brass, -0.095, 0.265, 0.03, 0, 0.3, 0);
      add(g, cyl(0.034, 0.048, 0.11, 14), brass, 0, 0.31, 0);

      // Center coordinates of armillary sphere
      const cy = 0.625;
      // Outer meridian ring + top 5-pointed star finial (reaching y = 1.01m)
      add(g, tor(0.305, 0.016, 8, 36), brass, 0, cy, 0, 0, 0.18, 0);
      add(g, cyl(0.016, 0.022, 0.035, 10), brass, 0, cy + 0.315, 0);
      add(g, makeStarGeo(THREE, 5, 0.052, 0.021, 0.018), brass, 0, cy + 0.362, 0);

      // Tilted concentric ecliptic & zodiac armillary bands
      add(g, tor(0.275, 0.018, 8, 34), brass, 0, cy, 0, PI / 2 - 0.48, 0.25, 0.32, 1, 1, 1.35);
      add(g, tor(0.215, 0.013, 7, 30), bronzeDark, 0, cy, 0, PI / 2 + 0.55, -0.35, -0.28);
      add(g, tor(0.155, 0.011, 7, 26), brass, 0, cy, 0, 0.68, 0.52, 0.2);
      // Polar axis spindle through sun
      add(g, cyl(0.008, 0.008, 0.58, 8), brass, 0, cy, 0, 0, 0, -0.28);

      // Radiant glowing Sun at center + brass corona points
      add(g, sph(0.072, 18, 14), sunGlow, 0, cy, 0);
      add(g, tor(0.082, 0.007, 6, 20), brass, 0, cy, 0, 0.4, 0.3, 0);

      // Orbiting Planets on curved brass arms:
      // 1) Ringed Saturn (upper right)
      add(g, tube([[0, cy - 0.12, 0], [0.18, cy - 0.02, 0.06], [0.30, cy + 0.10, 0.08]], 0.008, 10, 6), brass);
      add(g, sph(0.046, 14, 12), brass, 0.30, cy + 0.10, 0.08);
      add(g, tor(0.086, 0.012, 6, 24), brass, 0.30, cy + 0.10, 0.08, PI / 2 - 0.35, 0.2, -0.32, 1, 1, 0.38);

      // 2) Cobalt-blue Earth/Neptune w/ gold ring (top-front)
      add(g, tube([[0, cy + 0.12, 0], [0.05, cy + 0.21, 0.09]], 0.007, 8, 6), brass);
      add(g, sph(0.044, 14, 12), celestialBlue, 0.055, cy + 0.225, 0.10);
      add(g, tor(0.046, 0.005, 5, 18), brass, 0.055, cy + 0.225, 0.10, 1.1, 0.2, 0.4);

      // 3) Terracotta Mars (left)
      add(g, tube([[0, cy - 0.08, 0], [-0.24, cy + 0.02, 0.05], [-0.33, cy + 0.07, 0.06]], 0.008, 10, 6), brass);
      add(g, sph(0.036, 12, 10), marsRed, -0.335, cy + 0.075, 0.06);

      // 4) Silver-slate Moon (lower left) & minor planetoids
      add(g, tube([[0, cy - 0.16, 0], [-0.18, cy - 0.14, 0.11], [-0.25, cy - 0.08, 0.14]], 0.007, 8, 6), brass);
      add(g, sph(0.030, 12, 10), silverMoon, -0.255, cy - 0.075, 0.145);
      add(g, sph(0.022, 10, 8), silverMoon, 0.16, cy + 0.20, -0.08);
      add(g, sph(0.020, 10, 8), marsRed, 0.21, cy - 0.16, 0.11);
    }),

    // ------------------------------------------------------------------------
    // 4. cw_potion_rack ('Alchemist Retorts', r:0.50, h:0.94)
    // ------------------------------------------------------------------------
    cw_potion_rack: () => buildMergedProto('cw_potion_rack', (g) => {
      const rubyGlow = mat('rubyGlow', 0xd9183b, null, 1, { emissive: 0xb80828, emissiveIntensity: 0.72, roughness: 0.25, metalness: 0 });
      const amberGlow = mat('amberGlow', 0xf29614, null, 1, { emissive: 0xd96400, emissiveIntensity: 0.78, roughness: 0.25, metalness: 0 });
      const emeraldGlow = mat('emeraldGlow', 0x2cc828, null, 1, { emissive: 0x158f10, emissiveIntensity: 0.72, roughness: 0.25, metalness: 0 });
      const glassFlaskMat = mat('flaskGlass', 0xeaf8ff, null, 1, {
        roughness: 0.16, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false,
      });

      // Carved apothecary walnut bench base w/ central brass gear & leaf panels
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(g, rbox(0.09, 0.05, 0.09, 0.014), walnut, sx * 0.39, 0.025, sz * 0.14);
      }
      add(g, rbox(0.88, 0.04, 0.36, 0.014), walnut, 0, 0.06, 0);
      add(g, rbox(0.82, 0.13, 0.31, 0.018), walnut, 0, 0.14, 0);
      add(g, rbox(0.88, 0.042, 0.36, 0.015), walnut, 0, 0.22, 0);

      // Front gear & golden leaf reliefs
      add(g, makeGearGeo(THREE, 0.056, 0.042, 0.016, 12, 0.016), brass, 0, 0.14, 0.162);
      for (const sx of [-1, 1]) {
        add(g, rbox(0.20, 0.075, 0.014, 0.005), copper, sx * 0.24, 0.14, 0.156);
        add(g, sph(0.022, 8, 6), brass, sx * 0.24, 0.14, 0.165, 0, 0, sx * 0.35, 1.8, 0.55, 0.3);
      }

      // Twin-arch turned walnut & copper retort stand frame (rising to y = 0.94m)
      for (const px of [-0.37, 0, 0.37]) {
        const hPost = px === 0 ? 0.62 : 0.48;
        add(g, cyl(0.022, 0.028, hPost, 12), walnut, px, 0.24 + hPost / 2, 0);
        add(g, tor(0.030, 0.009, 6, 14), brass, px, 0.38, 0, PI / 2, 0, 0);
        add(g, tor(0.028, 0.009, 6, 14), brass, px, 0.58, 0, PI / 2, 0, 0);
      }
      // Central fleur-de-lis finial at y = 0.90..0.94
      add(g, sph(0.028, 10, 8), brass, 0, 0.90, 0, 0, 0, 0, 0.75, 1.45, 0.65);
      for (const sx of [-1, 1]) {
        add(g, sph(0.02, 8, 6), brass, sx * 0.028, 0.885, 0, 0, 0, -sx * 0.65, 0.7, 1.3, 0.6);
        // Side scroll volutes
        add(g, tor(0.042, 0.010, 6, 14, PI * 1.4), walnut, sx * 0.41, 0.33, 0, 0, 0, sx > 0 ? -0.6 : PI - 0.8);
      }
      // Twin copper top arches
      for (const sx of [-1, 1]) {
        const archPts = [
          [sx * 0.37, 0.72, 0],
          [sx * 0.34, 0.83, 0],
          [sx * 0.19, 0.86, 0],
          [sx * 0.03, 0.82, 0],
        ];
        add(g, tube(archPts, 0.016, 14, 8), copper);
      }

      // 3 Glowing Potion Flasks + Spirit Burners + Merged Glass Shells (1 draw call for all glass!)
      const flasks = [
        { x: -0.24, r: 0.105, neckH: 0.14, matGlow: rubyGlow },
        { x: 0.01, r: 0.098, neckH: 0.13, matGlow: amberGlow },
        { x: 0.25, r: 0.082, neckH: 0.12, matGlow: emeraldGlow },
      ];
      const glassGeos = [];
      for (const f of flasks) {
        // Brass burner stand
        add(g, cyl(0.062, 0.076, 0.042, 16), brass, f.x, 0.26, 0.02);
        add(g, tor(f.r * 0.86, 0.009, 6, 18), copper, f.x, 0.33, 0.02, PI / 2, 0, 0);
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * PI * 2 + 0.5;
          add(g, cyl(0.006, 0.007, 0.08, 6), brass, f.x + Math.cos(a) * f.r * 0.84, 0.29, 0.02 + Math.sin(a) * f.r * 0.84);
        }
        const by = 0.33 + f.r * 0.92;
        // Glowing potion liquid inside flask (lower 72% of bulb + bubbles)
        const liq = new THREE.SphereGeometry(f.r * 0.86, 18, 12);
        liq.scale(1, 0.84, 1);
        add(g, liq, f.matGlow, f.x, by - f.r * 0.10, 0.02);
        add(g, cyl(f.r * 0.76, f.r * 0.76, 0.012, 16), f.matGlow, f.x, by + f.r * 0.22, 0.02);

        // Brass collar & cork stopper at neck top
        const neckTopY = by + f.r * 0.82 + f.neckH;
        add(g, tor(0.032, 0.008, 6, 14), brass, f.x, neckTopY - 0.015, 0.02, PI / 2, 0, 0);
        add(g, cyl(0.024, 0.020, 0.032, 12), copper, f.x, neckTopY + 0.006, 0.02);

        // Outer glass shell geometry (collected for 1-draw-call merge)
        const gp = [
          [0, -f.r * 0.94],
          [f.r * 0.65, -f.r * 0.78],
          [f.r, -f.r * 0.15],
          [f.r * 0.92, f.r * 0.42],
          [0.032, f.r * 0.85],
          [0.028, f.r * 0.85 + f.neckH],
          [0.038, f.r * 0.85 + f.neckH + 0.012],
        ];
        const fg = lathe(gp, 20);
        fg.translate(f.x, by, 0.02);
        glassGeos.push(fg.index ? fg.toNonIndexed() : fg);
      }
      const mergedGlass = new THREE.Mesh(mergeGeometries(glassGeos, false), glassFlaskMat);
      mergedGlass.castShadow = false;
      g.add(mergedGlass);
      glassGeos.forEach((gg) => gg.dispose());

      // Coiled & looping copper distillation tubes linking the 3 flasks
      add(g, tube([
        [-0.24, 0.65, 0.02], [-0.24, 0.74, 0.02], [-0.12, 0.74, 0.02],
        [-0.10, 0.62, 0.02], [0.01, 0.62, 0.02],
      ], 0.011, 18, 7), copper);
      // Helical spiral condenser above green flask!
      const spiralPts = [[0.01, 0.64, 0.02], [0.09, 0.69, 0.02], [0.20, 0.78, 0.02]];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const a = t * PI * 6.5;
        spiralPts.push([0.25 + Math.cos(a) * 0.038, 0.77 - t * 0.18, 0.02 + Math.sin(a) * 0.038]);
      }
      spiralPts.push([0.25, 0.56, 0.02]);
      add(g, tube(spiralPts, 0.009, 44, 6), copper);
    }),

    // ------------------------------------------------------------------------
    // 5. cw_dress_form ('Wizard Cloak Form', r:0.46, h:1.30)
    // ------------------------------------------------------------------------
    cw_dress_form: () => buildMergedProto('cw_dress_form', (g) => {
      const linen = mat('linen', 0xf6ebd2, 'plaster', 1.5, { roughness: 0.92 });
      const emeraldGem = mat('emeraldGem', 0x26c478, null, 1, { emissive: 0x0e6e3e, emissiveIntensity: 0.45, roughness: 0.25 });

      // Turned wood tripod base (y = 0..0.46) + neck finial (y = 1.15..1.30)
      add(g, cyl(0.032, 0.044, 0.46, 14), walnut, 0, 0.25, 0);
      add(g, sph(0.052, 12, 10), walnut, 0, 0.16, 0, 0, 0, 0, 1, 0.75, 1);
      add(g, tor(0.042, 0.012, 6, 14), walnut, 0, 0.34, 0, PI / 2, 0, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2 + PI / 3;
        const c = Math.cos(a), s = Math.sin(a);
        const legPts = [
          [c * 0.035, 0.15, s * 0.035],
          [c * 0.14, 0.12, s * 0.14],
          [c * 0.21, 0.035, s * 0.21],
          [c * 0.24, 0.02, s * 0.24],
        ];
        add(g, tube(legPts, 0.022, 12, 7), walnut);
        add(g, sph(0.026, 8, 6), walnut, c * 0.245, 0.02, s * 0.245);
      }

      // Tailored cream-linen dressmaker mannequin bust (y = 0.46..1.14)
      const bustProf = [
        [0, 0.46], [0.155, 0.47], [0.175, 0.54], [0.145, 0.66], [0.118, 0.77],
        [0.148, 0.89], [0.168, 0.97], [0.145, 1.05], [0.068, 1.11], [0.058, 1.15], [0, 1.155],
      ];
      add(g, lathe(bustProf, 26), linen, 0, 0, 0, 0, 0, 0, 1, 1, 0.80);
      // Stitched leather waist belt + brass buckle
      add(g, cyl(0.124, 0.126, 0.036, 22), walnutDark, 0, 0.775, 0, 0, 0, 0, 1, 1, 0.82);
      add(g, rbox(0.042, 0.044, 0.016, 0.005), brass, 0, 0.775, 0.104);
      // Turned walnut neck cap & top finial knob (reaching y = 1.30m)
      add(g, cyl(0.062, 0.066, 0.026, 16), walnut, 0, 1.16, 0);
      add(g, cyl(0.020, 0.026, 0.075, 12), walnut, 0, 1.205, 0);
      add(g, sph(0.034, 12, 10), walnut, 0, 1.265, 0, 0, 0, 0, 0.92, 1.15, 0.92);

      // Sweeping Starry Emerald-and-Gold Hooded Wizard Cloak!
      add(g, wizardCloakGeo(THREE), cloakMat);

      // Plush draped cowl/hood around shoulders & back + gold front lapels
      add(g, tor(0.148, 0.048, 10, 26, PI * 1.65), cloakMat, 0, 1.09, -0.02, PI / 2 + 0.25, 0, 0.68);
      add(g, sph(0.15, 14, 10), cloakMat, 0, 1.08, -0.14, -0.35, 0, 0, 1.05, 0.78, 0.95);
      // Gold trim cords sweeping down the front cloak edges
      for (const sx of [-1, 1]) {
        const edgePts = [
          [sx * 0.035, 1.04, 0.12],
          [sx * 0.12, 0.88, 0.17],
          [sx * 0.17, 0.62, 0.20],
          [sx * 0.23, 0.32, 0.24],
          [sx * 0.28, 0.04, 0.28],
        ];
        add(g, tube(edgePts, 0.011, 16, 6), brass);
      }
      // Emerald-and-gold throat brooch fastening the cloak
      add(g, sph(0.032, 12, 10), brass, 0, 1.035, 0.132, 0, 0, 0, 1.15, 0.9, 0.45);
      add(g, sph(0.021, 12, 10), emeraldGem, 0, 1.035, 0.142, 0, 0, 0, 1.1, 0.85, 0.45);
    }),

    // ------------------------------------------------------------------------
    // 6. cw_steam_samovar ('Copper Samovar', r:0.46, h:0.88)
    // ------------------------------------------------------------------------
    cw_steam_samovar: () => buildMergedProto('cw_steam_samovar', (g) => {
      const steamMat = mat('steamPuff', 0xfbf9f4, null, 1, {
        emissive: 0xeae2d4, emissiveIntensity: 0.30, roughness: 0.95,
      });

      // Oval polished brass tray w/ raised rim & loop handles
      add(g, cyl(0.41, 0.39, 0.022, 32), brass, 0, 0.014, 0, 0, 0, 0, 1.04, 1, 0.82);
      add(g, tor(0.405, 0.016, 8, 36), brass, 0, 0.030, 0, PI / 2, 0, 0, 1.04, 0.82, 1);
      for (const sx of [-1, 1]) {
        add(g, tor(0.052, 0.011, 6, 14, PI), brass, sx * 0.425, 0.040, 0, -0.35, sx > 0 ? PI / 2 : -PI / 2, 0);
      }

      // Copper & Brass Samovar (slightly back-center so teacup & sugar pot sit in front)
      const sx0 = -0.01, sz0 = -0.04;
      for (const fx of [-1, 1]) for (const fz of [-1, 1]) {
        add(g, sph(0.022, 8, 6), brass, sx0 + fx * 0.085, 0.038, sz0 + fz * 0.085);
      }
      add(g, rbox(0.20, 0.032, 0.20, 0.01), brass, sx0, 0.062, sz0);
      // Fluted stem + burnished copper melon urn belly + brass crown
      add(g, lathe([
        [0.095, 0.075], [0.055, 0.12], [0.048, 0.18], [0.095, 0.22], [0, 0.22],
      ], 22), brass, sx0, 0, sz0);
      add(g, lathe([
        [0.085, 0.21], [0.165, 0.27], [0.205, 0.36], [0.198, 0.45],
        [0.145, 0.51], [0.105, 0.535], [0, 0.54],
      ], 28), copper, sx0, 0, sz0);
      // Brass shoulder collar, stepped chimney cap & top vent
      add(g, tor(0.150, 0.014, 7, 26), brass, sx0, 0.505, sz0, PI / 2, 0, 0);
      add(g, lathe([
        [0.118, 0.53], [0.125, 0.56], [0.085, 0.60], [0.078, 0.68],
        [0.092, 0.70], [0.052, 0.73], [0.025, 0.77], [0, 0.785],
      ], 22), brass, sx0, 0, sz0);
      // Engraved golden floral relief on front of copper belly
      add(g, sph(0.028, 8, 6), brass, sx0, 0.36, sz0 + 0.202, 0, 0, 0, 0.7, 1.35, 0.25);
      for (const side of [-1, 1]) {
        add(g, sph(0.022, 8, 6), brass, sx0 + side * 0.042, 0.34, sz0 + 0.198, 0, 0, side * 0.55, 1.35, 0.55, 0.25);
        // Sweeping S-scroll brass side handles w/ walnut grips
        const hPts = [
          [sx0 + side * 0.185, 0.34, sz0],
          [sx0 + side * 0.265, 0.40, sz0],
          [sx0 + side * 0.255, 0.49, sz0],
          [sx0 + side * 0.165, 0.48, sz0],
        ];
        add(g, tube(hPts, 0.013, 14, 7), brass);
        add(g, cyl(0.019, 0.019, 0.055, 10), walnutDark, sx0 + side * 0.262, 0.445, sz0, 0, 0, side * 0.1);
      }
      // Ornate front spigot tap
      add(g, tube([
        [sx0, 0.28, sz0 + 0.17], [sx0, 0.28, sz0 + 0.25], [sx0, 0.215, sz0 + 0.275],
      ], 0.015, 10, 8), brass);
      add(g, cyl(0.010, 0.010, 0.05, 8), brass, sx0, 0.315, sz0 + 0.235);
      add(g, rbox(0.056, 0.012, 0.016, 0.004), brass, sx0, 0.34, sz0 + 0.235);

      // Fluffy Storybook Steam Puffs drifting up from top vent (reaching y = 0.88m)
      for (const [px, py, pz, pr] of [
        [0.03, 0.76, sz0, 0.026],
        [0.085, 0.795, sz0 + 0.01, 0.038],
        [0.155, 0.825, sz0 + 0.02, 0.050],
        [0.215, 0.842, sz0 + 0.01, 0.044],
        [0.125, 0.848, sz0 - 0.015, 0.036],
      ]) {
        add(g, sph(pr, 12, 10), steamMat, px, py, pz, 0, 0, 0, 1.2, 0.92, 1.05);
      }

      // Front-left: Floral Porcelain Teacup on Saucer w/ hot tea
      const cx = -0.175, cz = 0.145;
      add(g, scallopedPlateGeo(THREE, 0.105, 10), porcelainMat, cx, 0.026, cz);
      add(g, lathe([[0, 0.035], [0.042, 0.038], [0.068, 0.085], [0.074, 0.125], [0.068, 0.125], [0.040, 0.050], [0, 0.050]], 20), porcelainMat, cx, 0, cz);
      add(g, tor(0.072, 0.004, 5, 20), brass, cx, 0.125, cz, PI / 2, 0, 0);
      add(g, cyl(0.062, 0.062, 0.008, 16), walnutDark, cx, 0.108, cz);
      add(g, tor(0.026, 0.006, 6, 12, PI * 1.25), brass, cx - 0.078, 0.092, cz, 0, 0, PI / 2);

      // Front-right: Floral Porcelain Lidded Sugar Pot
      const sxp = 0.205, szp = 0.125;
      add(g, lathe([
        [0, 0.026], [0.048, 0.028], [0.078, 0.072], [0.076, 0.122],
        [0.055, 0.148], [0.062, 0.156], [0.036, 0.180], [0, 0.185],
      ], 20), porcelainMat, sxp, 0, szp);
      add(g, sph(0.016, 10, 8), brass, sxp, 0.198, szp);
      for (const hs of [-1, 1]) {
        add(g, tor(0.022, 0.005, 5, 12, PI), brass, sxp + hs * 0.078, 0.102, szp, 0, 0, -hs * PI / 2);
      }
    }),

    // ------------------------------------------------------------------------
    // 7. cw_gramophone ('Brass Gramophone', r:0.44, h:1.04)
    // ------------------------------------------------------------------------
    cw_gramophone: () => buildMergedProto('cw_gramophone', (g) => {
      const vinyl = mat('vinyl', 0x262632, null, 1, { roughness: 0.32, metalness: 0 });
      const labelRed = mat('labelRed', 0xc93b38, null, 1, { roughness: 0.6, metalness: 0 });

      // Carved mahogany cabinet on 4 turned bun feet (y = 0..0.41)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(g, sph(0.042, 12, 8), walnutDark, sx * 0.205, 0.030, sz * 0.195, 0, 0, 0, 1.15, 0.72, 1.15);
      }
      add(g, rbox(0.50, 0.048, 0.48, 0.016), walnutDark, 0, 0.072, 0);
      add(g, rbox(0.44, 0.27, 0.42, 0.02), walnut, 0, 0.225, 0);
      // Lower drawer & brass knob
      add(g, rbox(0.32, 0.065, 0.02, 0.007), walnutDark, 0, 0.125, 0.210);
      add(g, sph(0.015, 10, 8), brass, 0, 0.125, 0.226);
      // Carved floral front panel + corner columns
      add(g, rbox(0.30, 0.13, 0.018, 0.008), walnutDark, 0, 0.255, 0.208);
      add(g, makeStarGeo(THREE, 6, 0.036, 0.015, 0.010), brass, 0, 0.255, 0.218);
      for (const sx of [-1, 1]) {
        add(g, sph(0.022, 8, 6), brass, sx * 0.075, 0.255, 0.218, 0, 0, sx * 0.4, 1.6, 0.55, 0.3);
        for (const sz of [-1, 1]) {
          add(g, cyl(0.026, 0.026, 0.25, 12), walnutDark, sx * 0.21, 0.225, sz * 0.20);
          add(g, tor(0.029, 0.007, 5, 12), brass, sx * 0.21, 0.34, sz * 0.20, PI / 2, 0, 0);
        }
      }
      // Molded top deck
      add(g, rbox(0.50, 0.042, 0.48, 0.016), walnutDark, 0, 0.38, 0);
      add(g, rbox(0.46, 0.026, 0.44, 0.012), walnut, 0, 0.408, 0);

      // Right-side S-curved brass winding crank w/ wooden grip
      add(g, tube([
        [0.22, 0.24, 0.03], [0.30, 0.24, 0.03], [0.32, 0.17, 0.06], [0.36, 0.165, 0.09],
      ], 0.012, 12, 7), brass);
      add(g, cyl(0.020, 0.016, 0.075, 10), walnut, 0.385, 0.165, 0.115, PI / 2, 0, -0.5);

      // Turntable platter + glossy black 78rpm vinyl record + red label
      add(g, cyl(0.165, 0.170, 0.018, 28), brass, 0, 0.428, 0.02);
      add(g, cyl(0.158, 0.158, 0.010, 32), vinyl, 0, 0.440, 0.02);
      add(g, cyl(0.052, 0.052, 0.012, 20), labelRed, 0, 0.442, 0.02);
      add(g, cyl(0.008, 0.008, 0.025, 8), brass, 0, 0.450, 0.02);

      // Rear brass bracket, tonearm & soundbox resting on record
      add(g, rbox(0.08, 0.09, 0.07, 0.014), brass, 0.10, 0.44, -0.175);
      add(g, tube([
        [0.10, 0.48, -0.16], [0.14, 0.49, -0.05], [0.09, 0.465, 0.06],
      ], 0.013, 12, 7), brass);
      add(g, cyl(0.026, 0.026, 0.014, 14), brass, 0.085, 0.46, 0.07, 0, 0, PI / 2);

      // Sweeping curved horn neck + scalloped petal-ribbed golden brass bell (reaching y = 1.03m)
      add(g, tube([
        [0.10, 0.48, -0.175],
        [0.13, 0.58, -0.20],
        [0.09, 0.69, -0.14],
        [0.03, 0.73, -0.05],
      ], 0.030, 16, 10), brassDouble);

      const hornBell = scallopedHornBellGeo(THREE, 0.36, 0.245, 9);
      add(g, hornBell, brassDouble, 0.03, 0.73, -0.05, PI / 2 - 0.30, 0, 0.24);
    }),

    // ------------------------------------------------------------------------
    // 8. cw_automaton_owl ('Clockwork Owl', r:0.42, h:0.98) — articulated flyer!
    // ------------------------------------------------------------------------
    cw_automaton_owl: () => {
      const ivoryMetal = mat('ivoryMetal', 0xf2e4c4, 'painted_metal', 1, { roughness: 0.52, metalness: 0 });
      const tealEnamel = mat('tealEnamel', 0x357a82, 'painted_metal', 1, { roughness: 0.48, metalness: 0 });
      const amberLens = mat('amberLens', 0xffcb38, null, 1, { emissive: 0xff9810, emissiveIntensity: 1.45, roughness: 0.18, metalness: 0 });

      const g = new THREE.Group();
      g.name = 'cw_automaton_owl';
      g.userData.keep = true;

      const bodyGrp = new THREE.Group();
      bodyGrp.name = 'bodyGrp';
      bodyGrp.position.set(0, 0.24, 0);
      g.add(bodyGrp);

      // Plump Owl Torso + mechanical chest gears
      add(bodyGrp, sph(0.18, 12, 10), ivoryMetal, 0, 0.22, 0, 0.08, 0, 0, 1.0, 1.18, 0.92);
      add(bodyGrp, cyl(0.10, 0.10, 0.032, 14), bronzeDark, 0.01, 0.20, 0.145, PI / 2 - 0.08, 0, 0);
      add(bodyGrp, tor(0.104, 0.012, 5, 16), brass, 0.01, 0.20, 0.155, -0.08, 0, 0);
      add(bodyGrp, makeGearGeo(THREE, 0.060, 0.046, 0.015, 12, 0.016), brass, 0.02, 0.21, 0.163);
      add(bodyGrp, makeGearGeo(THREE, 0.038, 0.028, 0.009, 9, 0.016), copper, -0.042, 0.165, 0.164);

      // Fan tail feathers (-Z)
      const tailGrp = new THREE.Group();
      tailGrp.name = 'tailGrp';
      tailGrp.position.set(0, 0.08, -0.15);
      bodyGrp.add(tailGrp);
      for (const tx of [-0.055, 0, 0.055]) {
        add(tailGrp, rbox(0.055, 0.16, 0.022, 0.01, 1), tealEnamel, tx, -0.02, -0.03, 0.55, 0, tx * 1.2);
      }

      // Dorsal Brass Wind-Up Key (-Z back)
      const windKey = new THREE.Group();
      windKey.name = 'windKey';
      windKey.position.set(0, 0.24, -0.18);
      bodyGrp.add(windKey);
      add(windKey, cyl(0.014, 0.014, 0.11, 8), brass, 0, 0, -0.04, PI / 2, 0, 0);
      add(windKey, tor(0.042, 0.011, 6, 14), brass, 0, 0.038, -0.10, 0, PI / 2, 0);
      add(windKey, tor(0.042, 0.011, 6, 14), brass, 0, -0.038, -0.10, 0, PI / 2, 0);

      // Articulated Brass & Teal Wings (-X left, +X right)
      const mkOwlWing = (sx) => {
        const wing = new THREE.Group();
        wing.name = sx < 0 ? 'wingL' : 'wingR';
        wing.position.set(sx * 0.16, 0.28, 0.0);
        bodyGrp.add(wing);

        add(wing, rbox(0.24, 0.045, 0.16, 0.016, 1), tealEnamel, sx * 0.13, 0.0, -0.01, 0.08, sx * -0.14, 0);
        add(wing, rbox(0.22, 0.032, 0.12, 0.012, 1), brass, sx * 0.12, -0.015, 0.02, 0.08, sx * -0.14, 0);
        const tip = new THREE.Group();
        tip.name = sx < 0 ? 'tipL' : 'tipR';
        tip.position.set(sx * 0.24, 0.0, -0.02);
        wing.add(tip);
        for (let f = 0; f < 3; f++) {
          add(tip, rbox(0.20 - f * 0.03, 0.022, 0.048, 0.008, 1), f % 2 === 0 ? ivoryMetal : brass,
            sx * (0.09 - f * 0.015), 0.0, -f * 0.042, 0, sx * (-0.18 - f * 0.12), 0);
        }
      };
      mkOwlWing(-1);
      mkOwlWing(1);

      // Owl Head + Teal Brow + Glowing Amber Lens Eyes + Sweeping Brass Ear-Tuft Horns
      const headGrp = new THREE.Group();
      headGrp.name = 'headGrp';
      headGrp.position.set(0, 0.44, 0.01);
      bodyGrp.add(headGrp);

      add(headGrp, sph(0.155, 12, 10), ivoryMetal, 0, 0.08, 0, 0, 0, 0, 1.12, 0.96, 0.96);
      add(headGrp, sph(0.122, 10, 7), tealEnamel, 0, 0.16, 0.025, -0.35, 0, 0, 1.12, 0.68, 0.88);
      for (const sx of [-1, 1]) {
        const ex = sx * 0.074, ey = 0.08, ez = 0.124;
        add(headGrp, tor(0.062, 0.012, 5, 14), tealEnamel, ex, ey, ez - 0.008, 0, sx * 0.22, 0);
        add(headGrp, tor(0.052, 0.009, 5, 14), brass, ex, ey, ez + 0.004, 0, sx * 0.22, 0);
        add(headGrp, sph(0.044, 9, 7), amberLens, ex, ey, ez + 0.004, 0, sx * 0.22, 0, 1, 1, 0.45);
        add(headGrp, sph(0.020, 7, 5), bronzeDark, ex - sx * 0.004, ey, ez + 0.020, 0, sx * 0.22, 0, 1, 1, 0.35);
        add(headGrp, tube([
          [sx * 0.055, 0.175, 0.05],
          [sx * 0.135, 0.215, 0.02],
          [sx * 0.185, 0.265, -0.02],
        ], 0.017, 7, 5), brass);
      }
      add(headGrp, tube([[0, 0.07, 0.145], [0, 0.04, 0.175], [0, 0.008, 0.158]], 0.017, 6, 5), brass);

      // Articulated brass perch talons (`legsA`, `legsB`) at `y = 0..0.24`
      const mkTalon = (name, sx) => {
        const lg = new THREE.Group();
        lg.name = name;
        lg.position.set(sx * 0.08, 0.22, 0.0);
        g.add(lg);
        add(lg, cyl(0.020, 0.016, 0.19, 8), bronzeDark, 0, -0.10, 0);
        add(lg, rbox(0.055, 0.028, 0.11, 0.008, 1), brass, 0, -0.205, 0.03);
      };
      mkTalon('legsA', -1);
      mkTalon('legsB', 1);

      g.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      attachCreatureKinematics(g, { mode: 'bird_flapper', canFly: true });
      return g;
    },

    // ------------------------------------------------------------------------
    // 9. cw_cake_stand ('Pâtisserie Stand', r:0.44, h:0.98)
    // ------------------------------------------------------------------------
    cw_cake_stand: () => buildMergedProto('cw_cake_stand', (g, rng) => {
      const crust = mat('pastryCrust', 0xdea154, null, 1, { roughness: 0.82 });
      const cream = mat('creamWhite', 0xfff8ee, null, 1, { roughness: 0.65 });
      const berryRed = mat('berryRed', 0xd92f3e, null, 1, { roughness: 0.38 });
      const pastelPink = mat('pastelPink', 0xf28ca8, null, 1, { roughness: 0.58 });
      const violetChoc = mat('violetChoc', 0x56325e, null, 1, { roughness: 0.45 });

      // 4 Scrolled brass cabriole feet + central turned brass spindle
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 4;
        const c = Math.cos(a), s = Math.sin(a);
        add(g, tube([
          [c * 0.04, 0.13, s * 0.04],
          [c * 0.15, 0.08, s * 0.15],
          [c * 0.21, 0.022, s * 0.21],
        ], 0.016, 8, 6), brass);
        add(g, sph(0.022, 7, 5), brass, c * 0.215, 0.020, s * 0.215);
      }
      add(g, cyl(0.022, 0.032, 0.78, 12), brass, 0, 0.46, 0);
      for (const ky of [0.14, 0.31, 0.45, 0.60, 0.73]) {
        add(g, sph(0.034, 8, 6), brass, 0, ky, 0, 0, 0, 0, 1, 0.68, 1);
      }
      // Ornate heart-scroll brass handle at top (y = 0.82..0.98)
      add(g, tor(0.062, 0.012, 6, 16), brass, 0, 0.905, 0, 0, 0, 0, 0.92, 1.15, 1);
      for (const sx of [-1, 1]) {
        add(g, sph(0.018, 7, 5), brass, sx * 0.068, 0.91, 0);
      }
      add(g, sph(0.020, 7, 5), brass, 0, 0.972, 0);

      // 3 Scalloped Floral Porcelain Plates
      const tiers = [
        { y: 0.155, R: 0.365, petals: 14 },
        { y: 0.455, R: 0.290, petals: 12 },
        { y: 0.735, R: 0.215, petals: 10 },
      ];
      for (const t of tiers) {
        add(g, scallopedPlateGeo(THREE, t.R, t.petals), porcelainMat, 0, t.y, 0);
      }

      // Helper: fruit/cream tartlet
      const addTart = (tx, ty, tz, rT = 0.068, pinkSwirl = false) => {
        add(g, cyl(rT, rT * 0.76, 0.036, 10), crust, tx, ty + 0.020, tz);
        add(g, sph(rT * 0.78, 9, 6), pinkSwirl ? pastelPink : cream, tx, ty + 0.042, tz, 0, 0, 0, 1, 0.65, 1);
        add(g, sph(rT * 0.46, 8, 6), cream, tx, ty + 0.064, tz, 0, 0, 0, 1, 0.75, 1);
        add(g, sph(0.020, 7, 5), berryRed, tx - 0.012, ty + 0.082, tz + 0.006, 0.2, 0, 0.15, 0.85, 1.25, 0.85);
        add(g, sph(0.012, 6, 5), violetChoc, tx + 0.020, ty + 0.066, tz + 0.014);
        add(g, sph(0.012, 6, 5), violetChoc, tx + 0.008, ty + 0.065, tz - 0.020);
      };

      // Bottom tier: 5 lush berry & strawberry cream tarts
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * PI * 2 + 0.35;
        addTart(Math.cos(a) * 0.205, 0.168, Math.sin(a) * 0.205, 0.074, i % 2 === 1);
      }

      // Middle tier: chocolate & pink-glazed éclairs + berry tartlets
      const addEclair = (ex, ey, ez, ry, glazeMat) => {
        const eg = new THREE.Group();
        eg.position.set(ex, ey, ez);
        eg.rotation.y = ry;
        g.add(eg);
        add(eg, rbox(0.145, 0.038, 0.056, 0.018, 1), crust, 0, 0.020, 0);
        add(eg, rbox(0.138, 0.020, 0.050, 0.009, 1), glazeMat, 0, 0.038, 0);
        for (const dx of [-0.04, 0, 0.04]) {
          add(eg, rbox(0.012, 0.006, 0.044, 0.002, 1), cream, dx, 0.050, 0, 0, 0.35, 0);
        }
      };
      addEclair(-0.115, 0.470, -0.05, 0.45, violetChoc);
      addEclair(-0.085, 0.470, 0.095, 0.38, pastelPink);
      addTart(0.115, 0.468, 0.065, 0.064, false);
      addTart(0.095, 0.468, -0.095, 0.060, true);

      // Top tier: stacked pastel macarons + violet cream tartlet
      const addMacaron = (mx, my, mz, mMat) => {
        add(g, sph(0.040, 9, 6), mMat, mx, my + 0.010, mz, 0, 0, 0, 1, 0.38, 1);
        add(g, cyl(0.037, 0.037, 0.010, 10), cream, mx, my + 0.022, mz);
        add(g, sph(0.040, 9, 6), mMat, mx, my + 0.034, mz, 0, 0, 0, 1, 0.38, 1);
      };
      addMacaron(-0.085, 0.748, 0.045, pastelPink);
      addMacaron(-0.075, 0.790, 0.035, pastelPink);
      addMacaron(-0.020, 0.748, -0.075, violetChoc);
      addTart(0.075, 0.748, 0.025, 0.058, false);
      rng.rr();
    }),

    // ------------------------------------------------------------------------
    // 10. cw_spellbook_lectern ('Grimoire Lectern', r:0.48, h:1.12)
    // ------------------------------------------------------------------------
    cw_spellbook_lectern: () => buildMergedProto('cw_spellbook_lectern', (g) => {
      const plumVelvet = mat('plumVelvet', 0x6e3168, null, 1, { roughness: 0.78 });
      const candleWax = mat('candleWax', 0xf7ecd2, null, 1, { roughness: 0.76 });
      const flameGlow = mat('flameGlow', 0xffec94, null, 1, { emissive: 0xff9e1c, emissiveIntensity: 2.15, roughness: 0.25 });

      // Stepped Gothic carved oak plinth & buttressed pedestal (y = 0..0.72)
      add(g, rbox(0.62, 0.06, 0.46, 0.016), walnutDark, 0, 0.03, 0);
      add(g, rbox(0.56, 0.07, 0.40, 0.016), oak, 0, 0.09, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(g, rbox(0.085, 0.56, 0.085, 0.016), walnutDark, sx * 0.22, 0.39, sz * 0.145);
      }
      add(g, rbox(0.46, 0.54, 0.30, 0.02), oak, 0, 0.40, 0);
      // Gothic pointed arch panel on front (+Z) w/ plum velvet & golden stars
      add(g, rbox(0.24, 0.36, 0.022, 0.01), plumVelvet, 0, 0.36, 0.148);
      for (const sx of [-1, 1]) {
        add(g, tube([
          [sx * 0.125, 0.18, 0.16],
          [sx * 0.125, 0.42, 0.16],
          [sx * 0.06, 0.54, 0.16],
          [0, 0.58, 0.16],
        ], 0.016, 12, 7), walnutDark);
        add(g, makeStarGeo(THREE, 4, 0.022, 0.007, 0.008), brass, sx * 0.055, 0.30, 0.162);
      }
      add(g, cyl(0.010, 0.010, 0.32, 8), brass, 0, 0.34, 0.162);
      add(g, makeStarGeo(THREE, 5, 0.024, 0.009, 0.008), brass, 0, 0.48, 0.162);

      // Slanted oak reading desk + side candle ledges
      add(g, rbox(0.60, 0.06, 0.40, 0.018), walnutDark, 0, 0.69, 0);
      const desk = new THREE.Group();
      desk.position.set(0, 0.80, 0.01);
      desk.rotation.x = 0.52; // tilted forward toward +Z viewer!
      g.add(desk);
      add(desk, rbox(0.64, 0.045, 0.44, 0.016), oak, 0, 0, 0);
      add(desk, rbox(0.64, 0.042, 0.042, 0.012), walnutDark, 0, 0.032, 0.205);

      // Open Illuminated Moon Grimoire resting on slanted desk (left page: autumn leaves u=0..0.5, right page: moon u=0.5..1)
      add(desk, rbox(0.50, 0.022, 0.36, 0.008), walnutDark, 0, 0.028, -0.01);
      for (const sx of [-1, 1]) {
        const pgGeo = rbox(0.23, 0.045, 0.33, 0.012);
        const pPos = pgGeo.attributes.position, pUv = pgGeo.attributes.uv;
        const uBase = sx < 0 ? 0.0 : 0.50;
        for (let i = 0; i < pPos.count; i++) {
          const uLocal = Math.max(0, Math.min(1, (pPos.getX(i) + 0.115) / 0.23));
          const vLocal = Math.max(0, Math.min(1, 1 - (pPos.getZ(i) + 0.165) / 0.33));
          pUv.setXY(i, uBase + uLocal * 0.48, vLocal);
        }
        add(desk, pgGeo, grimoireMat, sx * 0.116, 0.054, -0.01, 0, 0, -sx * 0.08);
        for (const sz of [-1, 1]) {
          add(desk, rbox(0.035, 0.026, 0.035, 0.005), brass, sx * 0.235, 0.030, sz * 0.155 - 0.01);
        }
      }
      // Hanging royal-purple & gold bookmark ribbon over front ledge
      add(g, rbox(0.056, 0.16, 0.014, 0.004), plumVelvet, 0.14, 0.65, 0.215, 0.10, 0, 0);
      add(g, makeStarGeo(THREE, 4, 0.020, 0.007, 0.008), brass, 0.14, 0.64, 0.224);

      // 3 Glowing Wax Pillar Candles on side brass holders (reaching y = 1.11m)
      for (const [cx, cy, cz, ch] of [
        [-0.27, 0.78, 0.06, 0.11],
        [-0.21, 0.87, -0.10, 0.13],
        [0.27, 0.81, -0.02, 0.11],
      ]) {
        add(g, cyl(0.042, 0.032, 0.022, 12), brass, cx, cy, cz);
        add(g, cyl(0.026, 0.028, ch, 12), candleWax, cx, cy + ch / 2 + 0.01, cz);
        add(g, sph(0.016, 8, 8), flameGlow, cx, cy + ch + 0.038, cz, 0, 0, 0, 0.78, 1.85, 0.78);
      }

      // Climbing green & autumn-crimson ivy vines trailing down the left side
      add(g, tube([
        [-0.22, 0.78, 0.18], [-0.30, 0.62, 0.17], [-0.28, 0.42, 0.15], [-0.31, 0.22, 0.12],
      ], 0.010, 16, 6), ivyMat);
      const leafSpots = [
        [-0.24, 0.74, 0.20, 0.4], [-0.32, 0.66, 0.18, -0.5], [-0.27, 0.56, 0.19, 0.6],
        [-0.33, 0.48, 0.16, -0.4], [-0.27, 0.38, 0.17, 0.5], [-0.32, 0.28, 0.14, -0.6],
        [-0.28, 0.19, 0.13, 0.3], [-0.18, 0.68, 0.21, 0.7],
      ];
      for (const [lx, ly, lz, rz] of leafSpots) {
        add(g, sph(0.036, 8, 6), ivyMat, lx, ly, lz, 0.3, 0.2, rz, 1.35, 1.1, 0.22);
      }
    }),

    // ------------------------------------------------------------------------
    // 11. cw_street_lamp ('Gaslight Flower Post', r:0.42, h:1.42)
    // ------------------------------------------------------------------------
    cw_street_lamp: () => buildMergedProto('cw_street_lamp', (g) => {
      const lanternGlow = mat('lanternGlow', 0xffd65a, null, 1, { emissive: 0xff9810, emissiveIntensity: 1.35, roughness: 0.28 });
      const wicker = mat('wicker', 0xb87b3e, 'hay', 1.5, { roughness: 0.90 });

      const px = -0.10; // balanced left so post + hanging basket sit neatly inside r=0.42
      // Flared dark-iron octagonal Victorian base w/ golden fleur-de-lis reliefs
      add(g, cyl(0.16, 0.195, 0.045, 8), castIron, px, 0.022, 0);
      add(g, tor(0.162, 0.012, 6, 16), brass, px, 0.046, 0, PI / 2, 0, 0);
      add(g, cyl(0.092, 0.155, 0.18, 8), castIron, px, 0.135, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2;
        add(g, sph(0.020, 8, 6), brass, px + Math.sin(a) * 0.128, 0.125, Math.cos(a) * 0.128, 0, a, 0, 0.75, 1.4, 0.3);
      }
      add(g, tor(0.095, 0.014, 6, 16), brass, px, 0.23, 0, PI / 2, 0, 0);

      // Fluted post shaft (y = 0.23..0.88)
      add(g, cyl(0.042, 0.068, 0.34, 10), castIron, px, 0.40, 0);
      add(g, tor(0.054, 0.012, 6, 14), brass, px, 0.57, 0, PI / 2, 0, 0);
      add(g, cyl(0.036, 0.044, 0.31, 10), castIron, px, 0.725, 0);
      add(g, cyl(0.072, 0.042, 0.045, 8), castIron, px, 0.89, 0);

      // Glowing 6-sided Victorian Gaslight Lantern + Pagoda Cap + Spire (reaching y = 1.41m)
      add(g, cyl(0.125, 0.078, 0.22, 6), lanternGlow, px, 1.02, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + PI / 6;
        add(g, tube([
          [px + Math.sin(a) * 0.080, 0.91, Math.cos(a) * 0.080],
          [px + Math.sin(a) * 0.128, 1.13, Math.cos(a) * 0.128],
        ], 0.008, 6, 5), castIron);
      }
      add(g, cyl(0.155, 0.155, 0.024, 6), castIron, px, 1.14, 0);
      add(g, cyl(0.075, 0.158, 0.10, 6), castIron, px, 1.195, 0);
      add(g, cyl(0.028, 0.082, 0.08, 6), castIron, px, 1.28, 0);
      add(g, sph(0.024, 10, 8), brass, px, 1.34, 0);
      add(g, cyl(0.005, 0.016, 0.06, 8), castIron, px, 1.38, 0);

      // Ornate wrought-iron S-scroll bracket sweeping right (+X)
      add(g, tube([
        [px + 0.04, 0.96, 0],
        [0.02, 1.14, 0],
        [0.14, 1.18, 0],
        [0.21, 1.11, 0],
      ], 0.015, 16, 7), castIron);
      add(g, tor(0.046, 0.011, 6, 14, PI * 1.55), castIron, 0.03, 0.99, 0, 0, 0, -0.5);
      add(g, tor(0.032, 0.010, 6, 12, PI * 1.6), castIron, 0.21, 1.14, 0, 0, 0, 0.8);

      // Brass hanging chains + woven wicker basket + overflowing pink flowers & trailing ivy!
      const bx = 0.19, by = 0.56;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2;
        add(g, tube([
          [0.20, 1.09, 0],
          [bx + Math.cos(a) * 0.105, by + 0.07, Math.sin(a) * 0.105],
        ], 0.005, 8, 5), brass);
      }
      add(g, lathe([
        [0, 0], [0.055, 0.008], [0.105, 0.055], [0.122, 0.12], [0.112, 0.125], [0, 0.09],
      ], 18), wicker, bx, by - 0.055, 0);
      add(g, tor(0.120, 0.013, 6, 20), wicker, bx, by + 0.065, 0, PI / 2, 0, 0);

      // Lush foliage cushion + overflowing pink petunia/hydrangea clusters on OUTSIDE surface!
      add(g, sph(0.130, 12, 9), foliage, bx, by + 0.095, 0, 0, 0, 0, 1.12, 0.72, 1.12);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * PI * 2;
        const rr = 0.138;
        const fy = by + 0.095 + (i % 2) * 0.022;
        const fx = bx + Math.cos(a) * rr, fz = Math.sin(a) * rr;
        add(g, sph(0.044, 8, 6), satinPink, fx, fy, fz, 0, 0, 0, 1.15, 0.92, 1.15);
        add(g, sph(0.012, 6, 5), brass, fx + Math.cos(a) * 0.032, fy + 0.012, fz + Math.sin(a) * 0.032);
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * PI * 2 + 0.4;
        const fx = bx + Math.cos(a) * 0.068, fy = by + 0.165, fz = Math.sin(a) * 0.068;
        add(g, sph(0.042, 8, 6), satinPink, fx, fy, fz, 0, 0, 0, 1.15, 0.88, 1.15);
        add(g, sph(0.012, 6, 5), brass, fx, fy + 0.034, fz);
      }
      // Trailing ivy tendrils below basket
      for (const [tx, tz, len] of [[0.09, 0.07, 0.20], [-0.08, 0.08, 0.17], [0.06, -0.09, 0.22]]) {
        add(g, tube([
          [bx + tx * 0.8, by + 0.05, tz * 0.8],
          [bx + tx * 1.25, by - len * 0.45, tz * 1.2],
          [bx + tx * 1.1, by - len, tz * 1.05],
        ], 0.008, 10, 5), foliage);
        for (const t of [0.45, 0.78, 1.0]) {
          add(g, sph(0.022, 7, 5), foliage, bx + tx * 1.18, by - len * t, tz * 1.12, 0.3, 0, 0.4, 1.2, 1, 0.35);
        }
      }
    }),

    // ------------------------------------------------------------------------
    // 12. cw_coal_hearth_pot ('Emberwick Brazier', r:0.46, h:0.88)
    // ------------------------------------------------------------------------
    cw_coal_hearth_pot: () => buildMergedProto('cw_coal_hearth_pot', (g) => {
      const charWood = mat('charWood', 0x6b452c, 'bark', 1.2, { roughness: 0.92 });
      const emberGlow = mat('emberGlow', 0xf25c18, null, 1, { emissive: 0xd93800, emissiveIntensity: 1.05, roughness: 0.42 });
      const flameBright = mat('flameBright', 0xffc838, null, 1, { emissive: 0xff8c10, emissiveIntensity: 1.35, roughness: 0.28 });

      // 4 Scrolled S-curved cast-iron legs (y = 0..0.18)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 6;
        const c = Math.cos(a), s = Math.sin(a);
        add(g, tube([
          [c * 0.22, 0.17, s * 0.22],
          [c * 0.28, 0.12, s * 0.28],
          [c * 0.27, 0.045, s * 0.27],
          [c * 0.31, 0.024, s * 0.31],
        ], 0.026, 12, 8), castIron);
        add(g, sph(0.032, 8, 6), castIron, c * 0.315, 0.025, s * 0.315);
      }

      // Openwork Cast-Iron Hearth Brazier Bowl & Gothic Flame Arches (y = 0.15..0.50)
      add(g, cyl(0.285, 0.245, 0.06, 26), castIron, 0, 0.175, 0);
      add(g, tor(0.285, 0.020, 7, 28), castIron, 0, 0.20, 0, PI / 2, 0, 0);
      add(g, tor(0.325, 0.026, 8, 30), castIron, 0, 0.475, 0, PI / 2, 0, 0);

      // 8 Openwork Gothic pointed iron arches around drum so glowing fire shines through!
      const N = 8;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * PI * 2;
        const aNext = ((i + 1) / N) * PI * 2;
        const aMid = (a + aNext) / 2;
        add(g, tube([
          [Math.cos(a) * 0.285, 0.20, Math.sin(a) * 0.285],
          [Math.cos(a) * 0.320, 0.47, Math.sin(a) * 0.320],
        ], 0.018, 8, 6), castIron);
        add(g, tube([
          [Math.cos(a) * 0.305, 0.32, Math.sin(a) * 0.305],
          [Math.cos(aMid) * 0.318, 0.44, Math.sin(aMid) * 0.318],
          [Math.cos(aNext) * 0.305, 0.32, Math.sin(aNext) * 0.305],
        ], 0.013, 10, 6), castIron);
        add(g, sph(0.012, 6, 5), brass, Math.cos(a) * 0.345, 0.475, Math.sin(a) * 0.345);
      }

      // Glowing ember coal bed + crossed charred firewood logs + lively Emberwick flames!
      add(g, sph(0.24, 16, 12), emberGlow, 0, 0.23, 0, 0, 0, 0, 1, 0.45, 1);
      for (const [lx, lz, ry, rz] of [
        [-0.06, 0.04, 0.4, 0.38],
        [0.07, 0.03, -0.5, -0.36],
        [0.0, -0.06, 1.4, 0.32],
      ]) {
        add(g, cyl(0.038, 0.042, 0.34, 10), charWood, lx, 0.29, lz, 0, ry, PI / 2 - rz);
      }
      // Dancing outer coral-orange & inner bright-gold flame tongues licking under kettle
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2 + 0.2;
        const rr = 0.13;
        add(g, sph(0.068, 10, 8), emberGlow, Math.cos(a) * rr, 0.31, Math.sin(a) * rr, 0, -a, 0.2, 0.85, 1.65, 0.85);
        add(g, sph(0.048, 10, 8), flameBright, Math.cos(a + 0.3) * 0.085, 0.38, Math.sin(a + 0.3) * 0.085, 0, 0, 0, 0.78, 1.85, 0.78);
      }
      add(g, sph(0.095, 12, 10), flameBright, 0, 0.37, 0, 0, 0, 0, 1.0, 1.45, 1.0);

      // Iron cross-trivet + Plump Engraved Copper Tea Kettle over the fire (y = 0.48..0.75)
      add(g, rbox(0.58, 0.016, 0.028, 0.005), castIron, 0, 0.48, 0);
      add(g, rbox(0.028, 0.016, 0.58, 0.005), castIron, 0, 0.48, 0);
      add(g, lathe([
        [0, 0.485], [0.115, 0.49], [0.155, 0.54], [0.148, 0.62],
        [0.102, 0.675], [0.082, 0.688], [0, 0.692],
      ], 24), copper);
      add(g, tor(0.082, 0.009, 6, 18), brass, 0, 0.688, 0, PI / 2, 0, 0);
      add(g, sph(0.024, 10, 8), copper, 0, 0.715, 0);
      // Kettle spout, handle & golden leaf motif
      add(g, tube([
        [-0.135, 0.56, 0], [-0.205, 0.62, 0], [-0.225, 0.685, 0],
      ], 0.022, 12, 8), copper);
      add(g, tor(0.092, 0.012, 6, 18, PI * 1.15), castIron, 0.02, 0.67, 0, 0, 0, -0.15);
      add(g, sph(0.024, 8, 6), brass, 0, 0.575, 0.152, 0, 0, 0, 0.7, 1.3, 0.25);
      for (const sx of [-1, 1]) {
        add(g, sph(0.018, 8, 6), brass, sx * 0.032, 0.56, 0.148, 0, 0, sx * 0.55, 1.3, 0.55, 0.25);
      }

      // High overarching wrought-iron bail handle w/ ribbed copper grip (reaching y = 0.87m)
      add(g, tube([
        [-0.325, 0.48, 0],
        [-0.29, 0.76, 0],
        [-0.14, 0.855, 0],
        [0.14, 0.855, 0],
        [0.29, 0.76, 0],
        [0.325, 0.48, 0],
      ], 0.016, 24, 8), castIron);
      add(g, cyl(0.028, 0.028, 0.16, 14), copper, 0, 0.855, 0, 0, 0, PI / 2);
      for (const gx of [-0.055, -0.02, 0.02, 0.055]) {
        add(g, tor(0.030, 0.005, 5, 14), brass, gx, 0.855, 0, 0, PI / 2, 0);
      }
    }),

    // ------------------------------------------------------------------------
    // Special Wall Hook Disguise: cw_cuckoo_clock ('Wall Cuckoo Clock', r:0.36, h:0.86)
    // ------------------------------------------------------------------------
    cw_cuckoo_clock: () => buildWallCuckooClock(THREE, { animated: false }).group,

    // ------------------------------------------------------------------------
    // 13. cw_clockwork_pup ('Wind-Up Brass Hound', r:0.40, h:0.66) — articulated brass wind-up pet!
    // ------------------------------------------------------------------------
    cw_clockwork_pup: () => {
      const tealEnamel = mat('pupTeal', 0x357a82, 'painted_metal', 1, { roughness: 0.48, metalness: 0 });
      const amberEye = mat('pupAmber', 0xffcb38, null, 1, { emissive: 0xff9810, emissiveIntensity: 1.45, roughness: 0.18, metalness: 0 });
      const emeraldEye = mat('pupEmerald', 0x52f2a8, null, 1, { emissive: 0x18c474, emissiveIntensity: 1.1, roughness: 0.22, metalness: 0 });

      const g = new THREE.Group();
      g.name = 'cw_clockwork_pup';
      g.userData.keep = true;

      const bodyGrp = new THREE.Group();
      bodyGrp.name = 'bodyGrp';
      bodyGrp.position.set(0, 0.24, 0);
      g.add(bodyGrp);

      // Riveted copper-and-brass boiler barrel body
      add(bodyGrp, sph(0.145, 12, 10), copper, 0, 0.06, -0.02, 0, 0, 0, 0.92, 0.92, 1.48);
      add(bodyGrp, tor(0.135, 0.014, 6, 18), brass, 0, 0.06, 0.07);
      add(bodyGrp, tor(0.135, 0.014, 6, 18), brass, 0, 0.06, -0.10);
      // Warm Emberwick ember heart dial on flank
      add(bodyGrp, sph(0.052, 8, 6), emeraldEye, 0, 0.06, 0.0, 0, 0, 0, 2.75, 0.95, 0.95);
      // Side cogwheels
      for (const sx of [-1, 1]) {
        add(bodyGrp, makeGearGeo(THREE, 0.065, 0.050, 0.018, 12, 0.018), brass, sx * 0.138, 0.06, -0.02, 0, PI / 2, 0);
      }

      // Dorsal/rear spinning brass butterfly wind-up key (-Z axis so rotation.z spins cleanly!)
      const windKey = new THREE.Group();
      windKey.name = 'windKey';
      windKey.position.set(0, 0.14, -0.16);
      bodyGrp.add(windKey);
      add(windKey, cyl(0.014, 0.014, 0.10, 8), brass, 0, 0, -0.04, PI / 2, 0, 0);
      add(windKey, tor(0.042, 0.011, 6, 14), brass, 0, 0.038, -0.095, 0, PI / 2, 0);
      add(windKey, tor(0.042, 0.011, 6, 14), brass, 0, -0.038, -0.095, 0, PI / 2, 0);

      // Articulated brass collar & hound head (+Z)
      const headGrp = new THREE.Group();
      headGrp.name = 'headGrp';
      headGrp.position.set(0, 0.16, 0.18);
      bodyGrp.add(headGrp);
      add(headGrp, tor(0.095, 0.020, 6, 16), tealEnamel, 0, -0.04, -0.02, PI / 2 - 0.35, 0, 0);
      add(headGrp, rbox(0.20, 0.17, 0.19, 0.05, 1), brass, 0, 0.06, 0.02);
      add(headGrp, rbox(0.125, 0.095, 0.12, 0.03, 1), bronzeDark, 0, 0.025, 0.125);
      add(headGrp, sph(0.024, 8, 6), tealEnamel, 0, 0.055, 0.190);
      for (const sx of [-1, 1]) {
        add(headGrp, cyl(0.030, 0.030, 0.035, 10), bronzeDark, sx * 0.055, 0.088, 0.112, PI / 2, 0, 0);
        add(headGrp, sph(0.026, 8, 6), amberEye, sx * 0.055, 0.088, 0.132);
        // Floppy copper & gear-rimmed ears
        add(headGrp, rbox(0.032, 0.115, 0.072, 0.012, 1), copper, sx * 0.116, 0.06, -0.01, 0.18, 0, sx * -0.18);
        add(headGrp, makeGearGeo(THREE, 0.038, 0.028, 0.010, 10, 0.014), brass, sx * 0.118, 0.10, -0.01, 0, PI / 2, 0);
      }

      // Wagging spring-coiled brass tail (-Z)
      const tailGrp = new THREE.Group();
      tailGrp.name = 'tailGrp';
      tailGrp.position.set(0, 0.11, -0.22);
      bodyGrp.add(tailGrp);
      add(tailGrp, cyl(0.016, 0.012, 0.17, 8), brass, 0, 0.07, -0.05, -0.62, 0, 0);
      add(tailGrp, sph(0.032, 8, 6), copper, 0, 0.145, -0.105);

      // 4 Articulated copper-and-brass piston legs (`legsA`, `legsB`)
      const legsA = new THREE.Group();
      legsA.name = 'legsA';
      legsA.position.set(0, 0.22, 0);
      g.add(legsA);
      add(legsA, cyl(0.030, 0.026, 0.20, 8), copper, -0.085, -0.10, 0.11);
      add(legsA, rbox(0.062, 0.040, 0.088, 0.012, 1), brass, -0.085, -0.20, 0.13);
      add(legsA, cyl(0.032, 0.026, 0.20, 8), copper, 0.085, -0.10, -0.12);
      add(legsA, rbox(0.062, 0.040, 0.088, 0.012, 1), brass, 0.085, -0.20, -0.10);

      const legsB = new THREE.Group();
      legsB.name = 'legsB';
      legsB.position.set(0, 0.22, 0);
      g.add(legsB);
      add(legsB, cyl(0.030, 0.026, 0.20, 8), copper, 0.085, -0.10, 0.11);
      add(legsB, rbox(0.062, 0.040, 0.088, 0.012, 1), brass, 0.085, -0.20, 0.13);
      add(legsB, cyl(0.032, 0.026, 0.20, 8), copper, -0.085, -0.10, -0.12);
      add(legsB, rbox(0.062, 0.040, 0.088, 0.012, 1), brass, -0.085, -0.20, -0.10);

      g.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      attachCreatureKinematics(g, { mode: 'clockwork_pet', canFly: false });
      return g;
    },
  };

  return builders;
}

export function buildClockworkOwl(THREE) {
  return buildMapProps(THREE).cw_automaton_owl();
}

export function buildClockworkPup(THREE) {
  return buildMapProps(THREE).cw_clockwork_pup();
}

// ============================================================================
// Special Interactive Disguises & Animated Wall Props for Pendulum Square
// ============================================================================

/**
 * Carved Alsace/Colmar Chalet Wall Cuckoo Clock with swinging brass pendulum & pine-cone weights.
 * Local origin y=0 sits at bottom of pine-cone weights; chalet body spans y=0.28..0.86, back at z=-0.12.
 */
export function buildWallCuckooClock(THREE, { animated = false } = {}) {
  const { mat, add, rbox, tube } = createPropBuilder(THREE, 909);
  const T = getClockworkPropTextures(THREE);
  const walnut = mat('ckWalnut', 0xc98c58, 'wood_light', 1.2, { roughness: 0.80, metalness: 0 });
  const walnutDark = mat('ckWalnutDark', 0x7a4e2d, 'wood_planks_dark', 1.2, { roughness: 0.84, metalness: 0 });
  const slateRoof = mat('ckSlate', 0x5c6884, 'roof_tiles', 1.2, { roughness: 0.82, metalness: 0 });
  const brass = mat('ckBrass', 0xe8b84b, null, 1, { roughness: 0.42, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const goldGlow = mat('ckGoldGlow', 0xf5cc5c, null, 1, { roughness: 0.38, metalness: 0, emissive: 0xd98a1c, emissiveIntensity: 0.35 });
  const birdRed = mat('ckBirdRed', 0xd94848, null, 1, { roughness: 0.68, metalness: 0 });
  const leafGreen = mat('ckLeaf', 0x5e9644, 'leaves', 1.0, { roughness: 0.84, metalness: 0 });
  const dialMat = new THREE.MeshStandardMaterial({ map: T.clockDial, roughness: 0.72, metalness: 0 });

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // Carved chalet bracket shelf & chalet house box (y = 0.28..0.76, back near z = -0.11)
  add(body, rbox(0.46, 0.045, 0.24, 0.014), walnutDark, 0, 0.30, 0.0);
  for (const sx of [-1, 1]) {
    add(body, rbox(0.055, 0.11, 0.16, 0.012), walnutDark, sx * 0.16, 0.235, -0.02, 0.25, 0, 0);
  }
  add(body, rbox(0.38, 0.38, 0.20, 0.018), walnut, 0, 0.51, -0.01);
  // Half-timbered trim & carved leaf reliefs
  for (const sx of [-1, 1]) {
    add(body, rbox(0.036, 0.38, 0.03, 0.008), walnutDark, sx * 0.175, 0.51, 0.09);
    add(body, new THREE.SphereGeometry(0.034, 8, 6), leafGreen, sx * 0.165, 0.44, 0.105, 0, 0, sx * 0.45, 1.35, 0.72, 0.35);
    add(body, new THREE.SphereGeometry(0.028, 8, 6), leafGreen, sx * 0.155, 0.56, 0.105, 0, 0, -sx * 0.35, 1.25, 0.68, 0.35);
  }

  // Roman numeral clock dial + brass bezel + hands
  add(body, planarDiscGeo(THREE, 0.122, 0.016, 24), dialMat, 0, 0.47, 0.094);
  add(body, new THREE.TorusGeometry(0.124, 0.012, 7, 24), brass, 0, 0.47, 0.102);
  add(body, rbox(0.014, 0.072, 0.008, 0.003), walnutDark, -0.022, 0.49, 0.110, 0, 0, 0.65);
  add(body, rbox(0.010, 0.095, 0.008, 0.003), walnutDark, 0.034, 0.495, 0.112, 0, 0, -0.82);

  // Little arched cuckoo-bird gable door + cheerful perched cuckoo bird!
  add(body, rbox(0.11, 0.10, 0.024, 0.008), walnutDark, 0, 0.655, 0.095);
  add(body, rbox(0.09, 0.022, 0.07, 0.006), walnut, 0, 0.615, 0.125);
  add(body, new THREE.SphereGeometry(0.030, 10, 8), birdRed, 0, 0.648, 0.135, 0, 0, 0, 0.92, 0.88, 1.25);
  add(body, new THREE.ConeGeometry(0.012, 0.032, 8), goldGlow, 0, 0.650, 0.172, PI / 2, 0, 0);

  // Steep Alsace slate-and-walnut chalet gable roof + brass gear finial (y = 0.66..0.86)
  for (const sx of [-1, 1]) {
    add(body, rbox(0.32, 0.042, 0.28, 0.012), slateRoof, sx * 0.115, 0.735, 0.005, 0, 0, -sx * 0.68);
    add(body, rbox(0.33, 0.022, 0.032, 0.006), walnutDark, sx * 0.118, 0.742, 0.142, 0, 0, -sx * 0.68);
  }
  add(body, makeGearGeo(THREE, 0.044, 0.032, 0.011, 10, 0.014), brass, 0, 0.84, 0.02);

  // Twin hanging brass chains & cast-bronze pine-cone weights (y = 0.02..0.28)
  for (const [wx, wy] of [[-0.095, 0.08], [0.095, 0.13]]) {
    add(body, new THREE.CylinderGeometry(0.005, 0.005, 0.28 - wy, 6), brass, wx, (0.28 + wy) * 0.5, 0.01);
    add(body, new THREE.SphereGeometry(0.028, 10, 8), copperWeightMat(mat), wx, wy, 0.01, 0, 0, 0, 0.85, 1.65, 0.85);
  }

  // Swinging Brass Pendulum (separate sub-group when animated = true!)
  const pendPivot = new THREE.Group();
  pendPivot.name = 'pendulum';
  pendPivot.position.set(0, 0.30, 0.045);
  add(pendPivot, new THREE.CylinderGeometry(0.007, 0.007, 0.23, 8), brass, 0, -0.115, 0);
  add(pendPivot, new THREE.SphereGeometry(0.056, 14, 10), goldGlow, 0, -0.235, 0, 0, 0, 0, 1, 1, 0.38);
  add(pendPivot, new THREE.TorusGeometry(0.058, 0.008, 6, 20), brass, 0, -0.235, 0.004);
  if (animated) {
    group.add(pendPivot);
  } else {
    pendPivot.rotation.z = 0.14;
    body.add(pendPivot);
  }

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, pendulum: animated ? pendPivot : null };
}

function copperWeightMat(mat) {
  return mat('ckPineWeight', 0xc97842, null, 1, { roughness: 0.48, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
}

/**
 * Vintage Brass-Strapped Steamer Trunk + Rose Hatbox + Alpine Copper Milk-Can Disguise
 * for riding ON the Looping Streetcar Tram (`kind: 'custom_spot'`).
 */
export function buildTramLuggageDisguise(THREE) {
  const { mat, add, rbox, lathe, tube } = createPropBuilder(THREE, 919);
  const T = getClockworkPropTextures(THREE);
  const leather = mat('trLeather', 0x8c5230, 'wood_light', 1.2, { roughness: 0.78, metalness: 0 });
  const strap = mat('trStrap', 0x54321d, 'wood_planks_dark', 1.2, { roughness: 0.84, metalness: 0 });
  const brass = mat('trBrass', 0xe8b84b, null, 1, { roughness: 0.42, metalness: 0, emissive: 0x3b2406, emissiveIntensity: 0.16 });
  const copper = mat('trCopper', 0xc97842, null, 1, { roughness: 0.46, metalness: 0, emissive: 0x2e1204, emissiveIntensity: 0.12 });
  const creamTag = mat('trTag', 0xfbf2dc, null, 1, { roughness: 0.82, metalness: 0 });
  const hatboxMat = new THREE.MeshStandardMaterial({ map: T.hatboxBot, roughness: 0.86, metalness: 0 });
  const ribbonMat = mat('trRibbon', 0xd85c78, null, 1, { roughness: 0.58, metalness: 0 });

  const g = new THREE.Group();

  // 1. Vintage Brass-Strapped Leather Steamer Valise (left/center, y = 0..0.38)
  add(g, rbox(0.56, 0.34, 0.36, 0.028), leather, -0.08, 0.17, 0.02, 0, 0.08, 0);
  for (const sx of [-0.18, 0.18]) {
    add(g, rbox(0.052, 0.355, 0.375, 0.010), strap, -0.08 + sx, 0.172, 0.02, 0, 0.08, 0);
    add(g, rbox(0.068, 0.055, 0.022, 0.006), brass, -0.08 + sx, 0.21, 0.21, 0, 0.08, 0);
  }
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.028, 8, 6), brass, -0.08 + cx * 0.26, 0.33, 0.02 + cz * 0.16);
  }
  add(g, new THREE.TorusGeometry(0.068, 0.014, 6, 14, PI), strap, -0.08, 0.345, 0.02);
  // Luggage destination tag
  add(g, rbox(0.11, 0.065, 0.012, 0.004), creamTag, -0.22, 0.26, 0.215, 0, 0.12, -0.28);

  // 2. Jaunty Striped Millinery Hatbox perched on trunk (y = 0.34..0.58)
  add(g, new THREE.CylinderGeometry(0.185, 0.185, 0.18, 22), hatboxMat, -0.10, 0.43, -0.01, 0.04, 0.35, -0.05);
  add(g, new THREE.CylinderGeometry(0.196, 0.196, 0.040, 22), hatboxMat, -0.10, 0.52, -0.01, 0.04, 0.15, -0.05);
  add(g, new THREE.TorusGeometry(0.196, 0.009, 6, 22), ribbonMat, -0.10, 0.505, -0.01, PI / 2 + 0.04, 0, -0.05);

  // 3. Gleaming Copper-and-Brass Alpine Milk Can beside trunk (right, y = 0..0.64)
  const mx = 0.24, mz = -0.02;
  add(g, lathe([
    [0, 0.0], [0.165, 0.0], [0.172, 0.05], [0.168, 0.34],
    [0.105, 0.44], [0.102, 0.54], [0.122, 0.56], [0, 0.56],
  ], 22), copper, mx, 0, mz);
  add(g, new THREE.TorusGeometry(0.170, 0.012, 6, 22), brass, mx, 0.06, mz, PI / 2, 0, 0);
  add(g, new THREE.TorusGeometry(0.168, 0.012, 6, 22), brass, mx, 0.33, mz, PI / 2, 0, 0);
  add(g, new THREE.CylinderGeometry(0.112, 0.126, 0.055, 18), brass, mx, 0.585, mz);
  add(g, new THREE.TorusGeometry(0.045, 0.010, 6, 14, PI), brass, mx, 0.612, mz);
  for (const hs of [-1, 1]) {
    add(g, tube([
      [mx + hs * 0.155, 0.36, mz],
      [mx + hs * 0.205, 0.42, mz],
      [mx + hs * 0.115, 0.48, mz],
    ], 0.012, 10, 6), brass);
  }

  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
