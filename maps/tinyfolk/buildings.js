/* Hue & Seek — Map 5: Tinyfolk Secret Hollow (`maps/tinyfolk/buildings.js`)
 * Storybook 10cm-Tinyfolk architectural scale: giant household treasures reimagined as cosy 2-room homes & garden landmarks.
 * Built directly from Codex concept sheets: `overview.png`, `buildings_sheet.png`, `interiors_sheet.png`.
 */
import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  mergeGeometries,
} from '../map_kit.js?v=2';

const PI = Math.PI;

export const BUILDING_DEFS = [
  { id: 'biscuit_tin_house', label: 'Biscuit-Tin House' },
  { id: 'teacup_conservatory', label: 'Teapot & Teacup Conservatory' },
  { id: 'oak_mushroom_lodge', label: 'Amanita Root Lodge' },
  { id: 'sewing_watch_workshop', label: 'Sewing-Caddy Workshop' },
  { id: 'flowerpot_greenhouse', label: 'Flowerpot Greenhouse' },
];

// ============================================================================
// Shared Procedural Painted Canvas Textures (cached via map_kit)
// ============================================================================
function getTinyfolkTextures(THREE) {
  const biscuitTin = paintedCanvasTex(THREE, 'bw_biscuit_tin_v1', 512, (g, s, rng) => {
    g.fillStyle = '#1f4477';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 420, ['#1b3b69', '#27538e', '#2f5f9e', '#17345d'], 4, 14, 0.36, 0.2, 3.14, 48);
    // Gold double filigree frame
    g.strokeStyle = '#e0b456';
    g.lineWidth = 10;
    g.strokeRect(18, 18, s - 36, s - 36);
    g.strokeStyle = '#f7dc8e';
    g.lineWidth = 3.5;
    g.strokeRect(32, 32, s - 64, s - 64);
    // Corner gold flourishes
    for (const [cx, cy] of [[44, 44], [s - 44, 44], [44, s - 44], [s - 44, s - 44]]) {
      g.fillStyle = '#ecc56a';
      g.beginPath(); g.arc(cx, cy, 11, 0, PI * 2); g.fill();
    }
    // Painted floral sprays (pink roses, cream daisies, green leaves)
    const flowerPts = [
      [110, 96, '#f6a6b2'], [256, 82, '#fff5dc'], [402, 102, '#f39aa8'],
      [88, 252, '#fff4da'], [424, 248, '#f6a6b2'], [118, 412, '#f39aa8'],
      [260, 424, '#fff5dc'], [398, 404, '#f6a6b2'], [205, 195, '#89c4f4'], [320, 315, '#89c4f4'],
    ];
    for (const [fx, fy, col] of flowerPts) {
      g.fillStyle = '#5e9b52';
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.4;
        g.beginPath();
        g.ellipse(fx + Math.cos(a) * 20, fy + Math.sin(a) * 20, 12, 5.5, a, 0, PI * 2);
        g.fill();
      }
      g.fillStyle = col;
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * PI * 2;
        g.beginPath();
        g.ellipse(fx + Math.cos(a) * 11, fy + Math.sin(a) * 11, 8.5, 5.5, a, 0, PI * 2);
        g.fill();
      }
      g.fillStyle = '#f2be49';
      g.beginPath(); g.arc(fx, fy, 5.5, 0, PI * 2); g.fill();
    }
  });

  const biscuitFace = paintedCanvasTex(THREE, 'bw_biscuit_face_v1', 256, (g, s, rng) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 16, s / 2, s / 2, s * 0.5);
    gr.addColorStop(0, '#ecc37b');
    gr.addColorStop(0.74, '#d9a458');
    gr.addColorStop(1, '#b67c35');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 220, ['#cfa054', '#e8be76', '#c18940'], 2, 6, 0.3, 0, 3.14, 22);
    // Scalloped ring & docked pinholes
    g.strokeStyle = '#9e6828';
    g.lineWidth = 4;
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.41, 0, PI * 2); g.stroke();
    g.fillStyle = '#8b571e';
    for (let gx = -2; gx <= 2; gx++) {
      for (let gy = -2; gy <= 2; gy++) {
        if (Math.hypot(gx, gy) > 2.4) continue;
        g.beginPath();
        g.arc(s / 2 + gx * 26, s / 2 + gy * 26, 3.6, 0, PI * 2);
        g.fill();
      }
    }
  });

  const brickMoss = paintedCanvasTex(THREE, 'bw_brick_moss_v1', 512, (g, s, rng) => {
    g.fillStyle = '#dfd2bc';
    g.fillRect(0, 0, s, s);
    const rows = 10, cols = 5, bh = s / rows, bw = s / cols;
    const brickCols = ['#b9573e', '#c76449', '#a84b35', '#ce7152', '#9e4632'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        g.fillStyle = rng.pick(brickCols);
        const x = c * bw + off + 3.5, y = r * bh + 3.5;
        g.beginPath();
        g.roundRect(x, y, bw - 7, bh - 7, 5);
        g.fill();
        g.fillStyle = 'rgba(255,225,195,0.16)';
        g.fillRect(x + 3, y + 2, bw - 14, 5);
      }
    }
    brushStrokes(g, s, rng, 110, ['#5f8d3e', '#76a44c', '#4b7431'], 3, 9, 0.25, 0, 3.14, 26);
  }, 1.6, 1.5);

  const rosePorcelain = paintedCanvasTex(THREE, 'bw_rose_porcelain_v1', 512, (g, s, rng) => {
    g.fillStyle = '#fbf3e4';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 280, ['#f5ead6', '#fffaf0', '#efe1c8'], 4, 12, 0.35, 0, 3.14, 42);
    // Subtle porcelain glaze crackle
    g.strokeStyle = 'rgba(168,142,108,0.22)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 38; i++) {
      let x = rng.jr(0, s), y = rng.jr(0, s);
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rng.jr(-45, 45); y += rng.jr(-45, 45); g.lineTo(x, y); }
      g.stroke();
    }
    // Painted English pink roses & vine leaves
    const clusters = [[128, 150, 1.05], [375, 165, 0.95], [248, 340, 1.12], [95, 390, 0.8], [415, 395, 0.85]];
    for (const [cx, cy, sc] of clusters) {
      g.strokeStyle = '#5c8f47';
      g.lineWidth = 3.5 * sc;
      g.beginPath(); g.moveTo(cx - 46 * sc, cy + 28 * sc); g.quadraticCurveTo(cx, cy - 12 * sc, cx + 48 * sc, cy + 20 * sc); g.stroke();
      for (const [lx, ly, la] of [[-32, 12, -0.5], [34, 8, 0.5], [-12, -26, -1.2], [22, -22, 0.9]]) {
        g.fillStyle = '#6da352';
        g.beginPath(); g.ellipse(cx + lx * sc, cy + ly * sc, 16 * sc, 7.5 * sc, la, 0, PI * 2); g.fill();
      }
      for (let ring = 3; ring >= 0; ring--) {
        const rr = (8 + ring * 7) * sc;
        g.fillStyle = ['#d95876', '#ea7b96', '#f4a2b5', '#fbd0da'][ring];
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * PI * 2 + ring * 0.4;
          g.beginPath(); g.arc(cx + Math.cos(a) * rr * 0.45, cy + Math.sin(a) * rr * 0.45, rr * 0.62, 0, PI * 2); g.fill();
        }
      }
    }
  });

  const gingham = paintedCanvasTex(THREE, 'bw_gingham_v1', 256, (g, s) => {
    g.fillStyle = '#fcf4e3';
    g.fillRect(0, 0, s, s);
    const st = 32;
    g.fillStyle = 'rgba(208,68,62,0.48)';
    for (let i = 0; i < s; i += st * 2) {
      g.fillRect(i, 0, st, s);
      g.fillRect(0, i, s, st);
    }
  }, 2, 2);

  const amanitaCap = paintedCanvasTex(THREE, 'bw_amanita_cap_v1', 512, (g, s, rng) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 20, s / 2, s / 2, s * 0.52);
    gr.addColorStop(0, '#b9221b');
    gr.addColorStop(0.62, '#d63726');
    gr.addColorStop(1, '#e66335');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 340, ['#c42b1e', '#df482c', '#9e1b15', '#eb7440'], 4, 14, 0.35, 0, 3.14, 38);
    // Painted cream spots to complement 3D warts
    for (let i = 0; i < 28; i++) {
      const a = rng.jr(0, PI * 2), d = rng.jr(28, s * 0.44);
      g.fillStyle = '#fbf2dc';
      g.beginPath();
      g.ellipse(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, rng.jr(7, 15), rng.jr(6, 12), a, 0, PI * 2);
      g.fill();
    }
  });

  const gills = paintedCanvasTex(THREE, 'bw_mushroom_gills_v1', 256, (g, s) => {
    g.fillStyle = '#f3e3c3';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#c8aa7b';
    g.lineWidth = 2;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * PI * 2;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(a) * 18, s / 2 + Math.sin(a) * 18);
      g.lineTo(s / 2 + Math.cos(a) * (s * 0.5), s / 2 + Math.sin(a) * (s * 0.5));
      g.stroke();
    }
  });

  const treeRing = paintedCanvasTex(THREE, 'bw_tree_ring_v1', 256, (g, s) => {
    g.fillStyle = '#e4c38d';
    g.fillRect(0, 0, s, s);
    for (let r = 12; r < s * 0.49; r += 11) {
      g.strokeStyle = r % 22 === 0 ? '#b78952' : '#cda067';
      g.lineWidth = 2.4;
      g.beginPath(); g.arc(s / 2, s / 2, r, 0, PI * 2); g.stroke();
    }
    g.strokeStyle = 'rgba(145,98,48,0.28)';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2;
      g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * 115, s / 2 + Math.sin(a) * 115); g.stroke();
    }
  });

  const watchDial = paintedCanvasTex(THREE, 'bw_watch_dial_v1', 512, (g, s) => {
    g.fillStyle = '#f7ebd0';
    g.fillRect(0, 0, s, s);
    const c = s / 2;
    g.strokeStyle = '#6c4d23';
    g.lineWidth = 5;
    g.beginPath(); g.arc(c, c, s * 0.45, 0, PI * 2); g.stroke();
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(c, c, s * 0.34, 0, PI * 2); g.stroke();
    g.fillStyle = '#3c2912';
    g.font = 'bold 30px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    nums.forEach((nm, i) => {
      const a = (i / 12) * PI * 2 - PI / 2;
      g.fillText(nm, c + Math.cos(a) * (s * 0.395), c + Math.sin(a) * (s * 0.395));
    });
    // Dark brass recessed skeletonized center
    g.fillStyle = '#533a18';
    g.beginPath(); g.arc(c, c, s * 0.31, 0, PI * 2); g.fill();
  });

  const awningStripe = paintedCanvasTex(THREE, 'bw_awning_stripe_v1', 256, (g, s, rng) => {
    const w = s / 6;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 === 0 ? '#cf4b3c' : '#fbf0d9';
      g.fillRect(i * w, 0, w, s);
    }
    brushStrokes(g, s, rng, 140, ['rgba(255,255,255,0.14)', 'rgba(90,40,20,0.12)'], 2, 5, 0.5, PI / 2, 0.2, 32);
  });

  const crackedPot = paintedCanvasTex(THREE, 'bw_cracked_pot_v1', 512, (g, s, rng) => {
    g.fillStyle = '#c8683c';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 480, ['#d77849', '#b5562e', '#de8858', '#9f4824'], 5, 16, 0.38, 0.3, 3.14, 46);
    // Mineral weathering & dark cracks
    brushStrokes(g, s, rng, 95, ['#e6c5a3', '#6b8e3d'], 3, 9, 0.22, 0, 3.14, 24);
    g.strokeStyle = '#4c2312';
    g.lineWidth = 3.2;
    for (let i = 0; i < 9; i++) {
      let x = rng.jr(30, s - 30), y = rng.jr(30, s - 30);
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += rng.jr(-36, 36); y += rng.jr(-36, 36); g.lineTo(x, y); }
      g.stroke();
    }
  });

  const shellNacre = paintedCanvasTex(THREE, 'bw_shell_nacre_v1', 256, (g, s, rng) => {
    const gr = g.createLinearGradient(0, 0, s, s);
    gr.addColorStop(0, '#f7e9d7');
    gr.addColorStop(0.35, '#e8d4dc');
    gr.addColorStop(0.7, '#cfe4e2');
    gr.addColorStop(1, '#d7b68a');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 220, ['#fff7ec', '#e5c6cf', '#bfe0de', '#cfa873'], 3, 10, 0.35, PI / 2, 0.5, 36);
  });

  const makeStamp = (key, bg, drawMotif) => paintedCanvasTex(THREE, key, 256, (g, s) => {
    g.fillStyle = '#fbf3df';
    g.fillRect(0, 0, s, s);
    // Perforated stamp scallops around edge
    g.fillStyle = '#6e5239';
    for (let i = 16; i < s; i += 24) {
      for (const [x, y] of [[i, 0], [i, s], [0, i], [s, i]]) {
        g.beginPath(); g.arc(x, y, 6.5, 0, PI * 2); g.fill();
      }
    }
    g.fillStyle = bg;
    g.fillRect(24, 24, s - 48, s - 48);
    g.strokeStyle = '#fbf3df';
    g.lineWidth = 3;
    g.strokeRect(32, 32, s - 64, s - 64);
    drawMotif(g, s);
  });

  const stampRose = makeStamp('bw_stamp_rose_v1', '#f3d6d8', (g, s) => {
    g.fillStyle = '#5a8f49';
    g.fillRect(s / 2 - 4, s / 2 + 10, 8, 62);
    g.beginPath(); g.ellipse(s / 2 - 22, s / 2 + 38, 18, 8, -0.5, 0, PI * 2); g.fill();
    g.beginPath(); g.ellipse(s / 2 + 22, s / 2 + 32, 18, 8, 0.5, 0, PI * 2); g.fill();
    for (const [r, c] of [[38, '#d4526e'], [26, '#eb8098'], [14, '#fad0da']]) {
      g.fillStyle = c; g.beginPath(); g.arc(s / 2, s / 2 - 8, r, 0, PI * 2); g.fill();
    }
  });

  const stampButterfly = makeStamp('bw_stamp_bfly_v1', '#d6eaf6', (g, s) => {
    g.fillStyle = '#3d7ec2';
    for (const sx of [-1, 1]) {
      g.beginPath(); g.ellipse(s / 2 + sx * 34, s / 2 - 14, 32, 22, sx * 0.4, 0, PI * 2); g.fill();
      g.beginPath(); g.ellipse(s / 2 + sx * 26, s / 2 + 22, 22, 17, -sx * 0.4, 0, PI * 2); g.fill();
    }
    g.fillStyle = '#2d241e';
    g.fillRect(s / 2 - 4, s / 2 - 34, 8, 68);
  });

  const stampClover = makeStamp('bw_stamp_clover_v1', '#ddecd4', (g, s) => {
    g.fillStyle = '#4f9643';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      g.beginPath(); g.arc(s / 2 + Math.cos(a) * 24, s / 2 - 8 + Math.sin(a) * 24, 21, 0, PI * 2); g.fill();
    }
    g.strokeStyle = '#3f7b35'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(s / 2, s / 2 + 4); g.quadraticCurveTo(s / 2 + 6, s / 2 + 46, s / 2 + 20, s / 2 + 68); g.stroke();
  });

  return {
    biscuitTin, biscuitFace, brickMoss, rosePorcelain, gingham,
    amanitaCap, gills, treeRing, watchDial, awningStripe, crackedPot, shellNacre,
    stampRose, stampButterfly, stampClover,
  };
}

// ============================================================================
// Shared Geometry & Finishing Helpers
// ============================================================================
function tagPaintMeshes(root) {
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mt of mats) {
        if (mt && typeof mt.metalness === 'number' && mt.metalness !== 0) {
          mt.metalness = 0;
          mt.needsUpdate = true;
        }
      }
    }
    if (!m.userData.paint && m.material && m.material.color) {
      m.userData.paint = m.material.color.clone();
    }
  });
  return root;
}

function makeGearGeo(THREE, outerR, innerR, teeth, thick) {
  const sh = new THREE.Shape();
  const step = (PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    sh.lineTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
    sh.lineTo(Math.cos(a0 + step * 0.2) * outerR, Math.sin(a0 + step * 0.2) * outerR);
    sh.lineTo(Math.cos(a0 + step * 0.55) * outerR, Math.sin(a0 + step * 0.55) * outerR);
    sh.lineTo(Math.cos(a0 + step * 0.75) * innerR, Math.sin(a0 + step * 0.75) * innerR);
  }
  sh.closePath();
  const spokeR0 = innerR * 0.28, spokeR1 = innerR * 0.78;
  if (innerR > 0.22) {
    for (let s = 0; s < 5; s++) {
      const sa0 = (s / 5) * PI * 2 + 0.14, sa1 = ((s + 1) / 5) * PI * 2 - 0.14;
      const hole = new THREE.Path();
      hole.absarc(0, 0, spokeR1, sa0, sa1, false);
      hole.absarc(0, 0, spokeR0, sa1, sa0, true);
      hole.closePath();
      sh.holes.push(hole);
    }
  }
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: thick, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}

function addButtonDisc(THREE, K, x, y, z, R, h, rimMat, holeMat, threadMat, rx = 0, ry = 0, rz = 0, parent = K.root) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  parent.add(g);
  const body = new THREE.LatheGeometry([
    [0, 0], [R * 0.95, 0], [R, h * 0.45], [R * 0.96, h], [R * 0.76, h], [R * 0.72, h * 0.68], [0, h * 0.68],
  ].map(([r, py]) => new THREE.Vector2(r, py)), 22);
  K.add(new THREE.Mesh(body, rimMat), 0, 0, 0, 0, 0, 0, g);
  const holeGeo = new THREE.CylinderGeometry(R * 0.12, R * 0.12, h * 0.45, 10);
  const hd = R * 0.28;
  for (const [hx, hz] of [[-hd, -hd], [hd, -hd], [-hd, hd], [hd, hd]]) {
    K.add(new THREE.Mesh(holeGeo, holeMat), hx, h * 0.62, hz, 0, 0, 0, g);
  }
  if (threadMat) {
    for (const [ax, az] of [[1, 1], [1, -1]]) {
      const th = K.rbox(R * 0.72, h * 0.24, R * 0.12, 0.01, threadMat, 1);
      K.add(th, 0, h * 0.8, 0, 0, ax * az * (PI / 4), 0, g);
    }
  }
  return g;
}

function addThreadSpool(THREE, K, x, y, z, R, H, woodMat, threadMat, parent = K.root) {
  const flH = H * 0.13;
  const flGeo = new THREE.CylinderGeometry(R, R * 0.96, flH, 20);
  K.add(new THREE.Mesh(flGeo, woodMat), x, y + flH * 0.5, z, 0, 0, 0, parent);
  K.add(new THREE.Mesh(flGeo, woodMat), x, y + H - flH * 0.5, z, 0, 0, 0, parent);
  const core = new THREE.CylinderGeometry(R * 0.76, R * 0.76, H - flH * 1.8, 20);
  K.add(new THREE.Mesh(core, threadMat), x, y + H * 0.5, z, 0, 0, 0, parent);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, H + 0.02, 12), K.M(0x4b3321)), x, y + H * 0.5, z, 0, 0, 0, parent);
}

function addHangingLantern(THREE, K, x, y, z, brassMat, glowM, parent = K.root, scale = 1) {
  const s = scale;
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.32 * s, 6), brassMat), x, y + 0.22 * s, z, 0, 0, 0, parent);
  K.add(new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 0.16 * s, 8), brassMat), x, y + 0.06 * s, z, 0, 0, 0, parent);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.13 * s, 0.32 * s, 8), glowM), x, y - 0.14 * s, z, 0, 0, 0, parent);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.05 * s, 8), brassMat), x, y - 0.31 * s, z, 0, 0, 0, parent);
}

function addMossAndDaisies(THREE, K, pts, parent = K.root) {
  const mossMat = K.M(0x9ed164, K.tex('leaves', 1, 1));
  const daisyMat = K.M(0xfffcf2);
  const centerMat = K.M(0xf6c242);
  const sphGeo = () => new THREE.SphereGeometry(1, 9, 7);
  pts.forEach(([x, y, z, r, flowers = true], idx) => {
    K.pushInst('moss_tuft', sphGeo, mossMat, x, y, z, 0, idx * 0.7, 0, r * 1.3, r * 0.42, r * 1.15, idx % 2 ? 0xa8da6e : 0x8bc256, parent);
    if (flowers) {
      for (let f = 0; f < 3; f++) {
        const a = f * 2.1 + idx;
        const fx = x + Math.cos(a) * 0.32 * r, fz = z + Math.sin(a) * 0.32 * r, fy = y + r * 0.38;
        K.pushInst('daisy_p', sphGeo, daisyMat, fx, fy, fz, 0, f * 1.1, 0, 0.14, 0.03, 0.14, 0xffffff, parent);
        K.pushInst('daisy_c', sphGeo, centerMat, fx, fy + 0.025, fz, 0, 0, 0, 0.055, 0.03, 0.055, 0xf6c445, parent);
      }
    }
  });
}

// ============================================================================
// 1. BISCUIT-TIN HOUSE (`biscuit_tin_house`)
// ============================================================================
export function buildBiscuitTinHouse(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'biscuit_tin_house', 11);
  const T = getTinyfolkTextures(THREE);

  const tinOut = K.M(0xffffff, T.biscuitTin, { roughness: 0.52, metalness: 0 });
  const tinIn = K.M(0xf5e2be, K.tex('painted_metal', 1.5, 1.5), { roughness: 0.68, metalness: 0 });
  const goldTrim = K.M(0xe5b84b, null, { roughness: 0.50, metalness: 0 });
  const biscuitMat = K.M(0xffffff, T.biscuitFace, { roughness: 0.88, metalness: 0 });
  const brickOut = K.M(0xfbf0e4, T.brickMoss, { roughness: 0.92, metalness: 0 });
  const brickIn = K.M(0xf5e5cc, K.tex('plaster', 1.4, 1.4));
  const stoneMat = K.M(0xdad2c3, K.tex('stone', 1.4, 1.4));
  const woodWarm = K.M(0xc89258, K.tex('wood_light', 1.4, 1.4));
  const woodDark = K.M(0x7c5030, K.tex('wood_planks_dark', 1.2, 1.2));
  const floorTin = K.M(0xdfb47c, K.tex('wood_light', 3.4, 3.4));
  const floorStone = K.M(0xd9ceb8, K.tex('stone', 2.4, 2.4));
  const ginghamMat = K.M(0xffffff, T.gingham);
  const leafRoof = K.M(0x7cb348, K.tex('leaves', 1.2, 1.2));
  const sugarMat = K.M(0xfaf6ec, K.tex('plaster', 2, 2), { roughness: 0.78, metalness: 0 });
  const glow = K.glowMat(0xffe6a6, 0xffad3b, 1.75);
  const jarGlass = K.M(0xdff3fb, null, { roughness: 0.20, metalness: 0, transparent: true, opacity: 0.52 });

  // Floor slabs (top at y = 0.10m matching floorY: 0.10)
  K.add(K.rbox(5.7, 0.12, 6.6, 0.04, floorTin), -1.65, 0.04, -0.15);
  K.add(K.rbox(3.35, 0.12, 6.95, 0.04, floorStone), 2.85, 0.04, 0.0);
  // Gold rolled bottom base rim around biscuit tin
  K.add(K.rbox(5.92, 0.18, 6.86, 0.08, goldTrim), -1.65, 0.09, -0.15);

  // Hollow walls: Royal-blue biscuit tin wing (left) + Red-brick entrance wing (right)
  K.wall(-4.5, -0.15, -PI / 2, 6.7, 3.55, 0.24, [], tinOut, tinIn);
  K.wall(-1.65, -3.5, PI, 5.7, 3.55, 0.24, [], tinOut, tinIn);
  K.wall(-1.65, 3.2, 0, 5.7, 3.55, 0.24, [{ u: -0.95, y0: 1.15, w: 1.25, h: 1.18, round: false }], tinOut, tinIn);

  // Embossed 3D digestive biscuits on the -X royal-blue tin wall
  const embBiscuit = new THREE.CylinderGeometry(0.92, 0.96, 0.16, 24);
  K.add(new THREE.Mesh(embBiscuit, biscuitMat), -4.56, 1.95, -1.15, 0, 0, PI / 2);
  K.add(new THREE.Mesh(embBiscuit, biscuitMat), -4.56, 1.55, 0.65, 0, 0, PI / 2);

  // Red-brick entrance wing (front door at x = 2.85, z = 3.5, w = 1.72 >= 1.65!)
  K.wall(2.85, 3.5, 0, 3.3, 3.68, 0.24, [
    { door: true, u: 0, w: 1.72, h: 2.48, arch: true },
    { u: 0, y0: 2.74, w: 0.86, h: 0.70, round: false },
  ], brickOut, brickIn);
  K.wall(4.5, 0.0, PI / 2, 7.0, 3.62, 0.24, [{ u: 0.15, y0: 1.18, w: 1.08, h: 1.12, round: false }], brickOut, brickIn);
  K.wall(2.85, -3.5, PI, 3.3, 3.62, 0.24, [], brickOut, brickIn);

  // Interior partition wall with stone-keyed open archway (w = 1.72 >= 1.65)
  K.wall(1.24, 0.0, PI / 2, 6.9, 3.52, 0.22, [{ door: true, u: -0.1, w: 1.72, h: 2.48, arch: true }], brickIn, tinIn);

  // Arched stone & wood door trim + swung-open cottage plank door leaf inside foyer
  const doorArch = new THREE.TorusGeometry(0.92, 0.12, 8, 18, PI);
  K.add(new THREE.Mesh(doorArch, stoneMat), 2.85, 1.68, 3.52);
  K.add(K.rbox(0.20, 1.72, 0.28, 0.04, stoneMat), 1.90, 0.86, 3.52);
  K.add(K.rbox(0.20, 1.72, 0.28, 0.04, stoneMat), 3.80, 0.86, 3.52);
  K.add(K.rbox(0.84, 2.15, 0.09, 0.03, woodWarm), 3.70, 1.08, 3.00, 0, -1.32, 0);
  // Window mullions & warm window glow
  K.add(K.rbox(0.88, 0.74, 0.08, 0.02, glow), 2.85, 3.08, 3.38);
  K.add(K.rbox(1.26, 1.18, 0.08, 0.02, glow), -2.6, 1.74, 3.08);
  K.add(K.rbox(0.08, 1.1, 1.08, 0.02, glow), 4.38, 1.74, -0.15);

  // Front stone threshold + 3 cream 4-hole button stepping stones
  K.add(K.rbox(1.95, 0.08, 0.68, 0.03, stoneMat), 2.85, 0.04, 3.82);
  const btnCream = K.M(0xf2e3c2, K.tex('plaster', 1, 1));
  addButtonDisc(THREE, K, 2.55, 0.01, 4.48, 0.38, 0.06, btnCream, woodDark, ginghamMat);
  addButtonDisc(THREE, K, 1.85, 0.01, 4.92, 0.36, 0.06, btnCream, woodDark, ginghamMat);
  addButtonDisc(THREE, K, 1.08, 0.01, 5.25, 0.35, 0.06, btnCream, woodDark, ginghamMat);

  // Matchbox Front Porch Sofa & Ribbed Green Leaf Umbrella (left of doorway, clear of walk path!)
  const strikerMat = K.M(0x7a4232, K.tex('terracotta', 2, 2));
  K.add(K.rbox(2.15, 0.48, 1.25, 0.04, woodWarm), -1.35, 0.24, 3.92);
  K.add(K.rbox(2.05, 0.32, 0.05, 0.02, strikerMat), -1.35, 0.24, 4.55);
  K.add(K.rbox(1.88, 0.24, 0.98, 0.08, ginghamMat), -1.35, 0.56, 3.88);
  K.add(K.rbox(1.88, 0.68, 0.24, 0.08, ginghamMat), -1.35, 0.88, 3.42, 0.14, 0, 0);
  for (const sx of [-1, 1]) {
    K.add(K.rbox(0.14, 1.85, 0.14, 0.04, woodDark), -1.35 + sx * 0.96, 0.95, 4.42);
    K.add(K.rbox(0.14, 0.12, 1.15, 0.04, woodWarm), -1.35 + sx * 0.96, 0.82, 3.9);
  }
  const umbGeo = new THREE.ConeGeometry(1.52, 0.58, 9);
  K.add(new THREE.Mesh(umbGeo, leafRoof), -1.35, 2.38, 3.98, 0.12, 0.2, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.35, 8), woodDark), -1.35, 1.2, 3.55);
  addHangingLantern(THREE, K, 1.75, 2.15, 3.72, goldTrim, glow, K.root, 0.85);
  K.boxCol(-1.35, 3.92, 2.18, 1.3);

  // ---- ROOM 1 (`tin_parlor`): Postage-stamp framed art, matchbox chest of drawers & gingham sofa
  const stampFrames = [
    [-2.95, 2.18, -3.22, 0, T.stampRose],
    [-1.65, 1.92, -3.22, 0, T.stampButterfly],
    [-0.35, 2.22, -3.22, 0, T.stampClover],
  ];
  for (const [sx, sy, sz, ry, stTex] of stampFrames) {
    K.add(K.rbox(0.98, 1.12, 0.06, 0.02, K.M(0xffffff, stTex)), sx, sy, sz, 0, ry, 0);
  }
  // Matchbox 3-drawer chest against back wall (boxCol)
  K.add(K.rbox(1.62, 1.32, 0.82, 0.05, woodWarm), -0.95, 0.66, -2.72);
  for (let d = 0; d < 3; d++) {
    const dy = 0.28 + d * 0.39;
    K.add(K.rbox(1.42, 0.31, 0.08, 0.03, K.M(d === 1 ? 0xd96b59 : 0xe8b878)), -0.95, dy, -2.29);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), woodDark), -0.95, dy, -2.23);
  }
  K.boxCol(-0.95, -2.72, 1.66, 0.86);
  // Built-in gingham tin-parlor settee along -X wall + moss rug + hanging lantern
  K.add(K.rbox(1.02, 0.44, 2.35, 0.05, woodWarm), -3.68, 0.22, -0.55);
  K.add(K.rbox(0.88, 0.22, 2.15, 0.07, ginghamMat), -3.64, 0.52, -0.55);
  K.add(K.rbox(0.24, 0.68, 2.15, 0.07, ginghamMat), -4.02, 0.84, -0.55);
  K.boxCol(-3.68, -0.55, 1.06, 2.38);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.48, 0.05, 22), leafRoof), -1.85, 0.09, -0.35);
  addHangingLantern(THREE, K, -1.65, 3.08, -0.35, goldTrim, glow);

  // ---- ROOM 2 (`sugar_pantry`): Sugar-cube stacks, glass berry/honey jars & sugar basket
  K.add(K.rbox(2.18, 0.12, 0.72, 0.03, woodWarm), 2.85, 1.15, -2.82);
  K.add(K.rbox(2.18, 0.12, 0.72, 0.03, woodWarm), 2.85, 2.05, -2.82);
  K.add(K.rbox(0.14, 2.2, 0.68, 0.03, woodDark), 1.82, 1.1, -2.82);
  K.add(K.rbox(0.14, 2.2, 0.68, 0.03, woodDark), 3.88, 1.1, -2.82);
  K.boxCol(2.85, -2.82, 2.24, 0.82);

  // Instanced sugar cubes & glass pantry jars
  const cubeGeo = () => K.rbox(0.32, 0.3, 0.32, 0.04, sugarMat).geometry;
  for (const [cx, cy, cz] of [
    [2.15, 0.24, -2.75], [2.5, 0.24, -2.75], [2.32, 0.54, -2.75],
    [3.25, 2.26, -2.8], [3.58, 2.26, -2.8], [3.41, 2.56, -2.8],
  ]) {
    K.pushInst('sugar_cube', cubeGeo, sugarMat, cx, cy, cz, 0, 0.15, 0, 1, 1, 1, 0xfdfaf0);
  }
  const jarColors = [0xd43d3d, 0xeba834, 0x9b5bc4];
  jarColors.forEach((jc, idx) => {
    const jx = 2.15 + idx * 0.56, jy = 1.46, jz = -2.8;
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.44, 12), K.M(jc)), jx, jy - 0.04, jz);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.54, 12), jarGlass), jx, jy, jz);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.09, 12), woodWarm), jx, jy + 0.3, jz);
  });
  // Woven sugar basket in back-right corner
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.56, 16), K.M(0xc59352, K.tex('burlap', 2, 2))), 3.68, 0.36, -1.72);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), sugarMat), 3.68, 0.62, -1.72);
  K.boxCol(3.68, -1.72, 0.92, 0.92);
  addHangingLantern(THREE, K, 2.85, 3.05, 0.2, goldTrim, glow, K.root, 0.9);

  // ---- ROOF (`roofG`): Hinged Royal-Blue Biscuit-Tin Lid + Mossy Brick Gable + Chimney + Fern Fiddleheads
  const lidG = new THREE.Group();
  lidG.position.set(-1.65, 3.56, -3.45);
  lidG.rotation.x = -0.16; // slightly propped open like Codex sheet!
  K.roofG.add(lidG);
  K.add(K.rbox(5.96, 0.36, 6.92, 0.12, tinOut), 0, 0.18, 3.32, 0, 0, 0, lidG);
  K.add(K.rbox(6.08, 0.16, 7.04, 0.08, goldTrim), 0, 0.06, 3.32, 0, 0, 0, lidG);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.14, 26), biscuitMat), 0, 0.39, 3.35, 0, 0, 0, lidG);

  // Mossy brick wing gable roof + double-pot brick chimney
  const gableSh = new THREE.Shape();
  gableSh.moveTo(-1.78, 0);
  gableSh.quadraticCurveTo(-1.55, 1.15, 0, 1.45);
  gableSh.quadraticCurveTo(1.55, 1.15, 1.78, 0);
  gableSh.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableSh, { depth: 7.3, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05 });
  gableGeo.translate(0, 0, -3.65);
  K.addR(new THREE.Mesh(gableGeo, brickOut), 2.85, 3.62, 0.0);
  K.addR(K.rbox(1.12, 1.48, 0.96, 0.04, brickOut), 2.15, 5.15, 1.35);
  K.addR(K.rbox(1.26, 0.18, 1.1, 0.04, stoneMat), 2.15, 5.88, 1.35);
  for (const cx of [1.9, 2.4]) {
    K.addR(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.42, 12), K.M(0x9e4b37)), cx, 6.12, 1.35);
  }
  // 2 Giant Curling Green Fern Fiddleheads sprouting behind chimney
  for (const [fx, fz, sc, ry] of [[3.25, -0.45, 1.0, 0.2], [3.75, 0.25, 0.78, -0.35]]) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const ang = t * PI * 2.15;
      const spiralR = (1 - t) * 0.48 * sc;
      pts.push(new THREE.Vector3(
        t > 0.52 ? Math.sin((t - 0.52) * PI * 3.8) * spiralR + 0.35 * sc : Math.sin(t * 1.4) * 0.38 * sc,
        t < 0.65 ? t * 2.85 * sc : (1.75 + Math.cos((t - 0.65) * PI * 4.2) * 0.42) * sc,
        0
      ));
    }
    const fiddleGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.11 * sc, 8, false);
    K.addR(new THREE.Mesh(fiddleGeo, leafRoof), fx, 4.15, fz, 0, ry, 0);
  }

  addMossAndDaisies(THREE, K, [
    [1.35, 3.85, 3.35, 0.55, true], [2.1, 4.45, 3.4, 0.48, true], [3.85, 4.15, 3.35, 0.45, true],
  ], K.roofG);
  addMossAndDaisies(THREE, K, [
    [1.92, 0.12, 3.85, 0.38, true], [-4.55, 0.1, 2.6, 0.42, true], [4.45, 0.1, 2.8, 0.4, true],
  ]);

  Object.assign(K.root.userData, {
    floorY: 0.10,
    footprint: { w: 9.3, d: 7.5 },
    door: { x: 2.85, z: 4.45 },
    doorIn: { x: 2.85, z: 2.55 },
    innerDoors: [{ x: 1.24, z: 0.1 }],
    rooms: [
      { name: 'tin_parlor', x: -1.52, z: -0.15, w: 5.52, d: 6.2, walkX: -0.15, walkZ: 0.25 },
      { name: 'sugar_pantry', x: 2.81, z: 0.0, w: 3.14, d: 6.5, walkX: 2.55, walkZ: 1.25 },
    ],
    propSlots: [
      { id: 'bw_thimble_stool', x: -2.45, z: 0.95, rot: 0.4 },
      { id: 'bw_thimble_stool', x: -1.35, z: 1.25, rot: -0.5 },
      { id: 'bw_spool_table', x: -2.05, z: 0.15, rot: 0.2 },
      { id: 'bw_button_stack', x: -3.55, z: 1.95, rot: 0.6 },
      { id: 'bw_button_stack', x: -2.85, z: 2.25, rot: -0.3 },
      { id: 'bw_acorn_lantern', x: 0.15, z: -2.35, rot: 0.2 },
      { id: 'bw_sugar_crate', x: 2.05, z: -1.65, rot: 0.1 },
      { id: 'bw_sugar_crate', x: 2.75, z: -1.75, rot: -0.25 },
      { id: 'bw_strawberry_basket', x: 3.72, z: 1.45, rot: -0.8 },
      { id: 'bw_strawberry_basket', x: 3.68, z: 0.55, rot: -1.2 },
    ],
  });

  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// 2. TEAPOT & TEACUP CONSERVATORY (`teacup_conservatory`)
// ============================================================================
export function buildTeacupConservatory(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'teacup_conservatory', 23);
  const T = getTinyfolkTextures(THREE);

  const porcOut = K.M(0xffffff, T.rosePorcelain, { roughness: 0.36, metalness: 0 });
  const porcIn = K.M(0xfbf0dc, K.tex('plaster', 1.4, 1.4), { roughness: 0.62, metalness: 0 });
  const brassMat = K.M(0xe5b84b, null, { roughness: 0.50, metalness: 0 });
  const woodWarm = K.M(0xc68e54, K.tex('wood_light', 1.4, 1.4));
  const woodDark = K.M(0x7c4e2e, K.tex('wood_planks_dark', 1.2, 1.2));
  const twineMat = K.M(0xcfa56a, K.tex('burlap', 2, 2));
  const stoneFloor = K.M(0xe6dac4, K.tex('stone', 2.6, 2.6));
  const glassDome = K.M(0xd9f4fb, null, { roughness: 0.18, metalness: 0, transparent: true, opacity: 0.44 });
  const glow = K.glowMat(0xffebb0, 0xffb748, 1.8);
  const leafMat = K.M(0x6da644, K.tex('leaves', 1.2, 1.2));
  const ginghamMat = K.M(0xffffff, T.gingham);

  // Porcelain & stone base floors
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(3.38, 3.48, 0.14, 32), stoneFloor), -1.35, 0.04, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(2.72, 2.55, 0.14, 28), stoneFloor), 2.82, 0.04, 0);

  // Helper: plump curved porcelain arc shells + collider registration
  const potProfile = [
    [3.08, 0.08], [3.35, 0.85], [3.52, 1.75], [3.38, 2.65], [2.98, 3.45],
  ];
  const addPorcArc = (cx, cz, prof, p0, pl, segs, colR) => {
    const outerG = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs, p0, pl);
    const innerG = K.flipGeo(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r - 0.22, y)), segs, p0, pl));
    K.add(new THREE.Mesh(outerG, porcOut), cx, 0, cz);
    K.add(new THREE.Mesh(innerG, porcIn), cx, 0, cz);
    const nCol = Math.max(2, Math.round((pl * colR) / 1.45));
    for (let i = 0; i < nCol; i++) {
      const a0 = p0 + (i / nCol) * pl, a1 = p0 + ((i + 1) / nCol) * pl, am = (a0 + a1) * 0.5;
      const chord = 2 * colR * Math.sin((a1 - a0) * 0.5);
      K.boxCol(cx + Math.sin(am) * colR, cz + Math.cos(am) * colR, chord, 0.28, -am);
    }
  };

  // Teapot main shell at cx = -1.35:
  // Gap 1 around phi = 0 (+Z front doorway, half-angle 0.30 -> clear width 1.90m >= 1.65m!)
  // Gap 2 around phi = PI/2 (+X conservatory arch, phi in [1.10, 2.04] -> clear width 2.01m >= 1.65m!)
  addPorcArc(-1.35, 0, potProfile, 0.30, 0.80, 10, 3.22);
  addPorcArc(-1.35, 0, potProfile, 2.04, PI * 2 - 0.30 - 2.04, 24, 3.22);

  // Teacup lower porcelain rim + brass/glass side ribs at cx = 2.82 (open toward -X phi = 3*PI/2 = 4.712):
  const cupProfile = [[2.35, 0.08], [2.58, 0.65], [2.72, 1.38], [2.76, 1.62]];
  addPorcArc(2.82, 0, cupProfile, -1.12, PI + 2.24, 22, 2.58);
  // Conservatory vertical glass enclosure above teacup rim (y = 1.58..3.15)
  const glassWall = new THREE.CylinderGeometry(2.68, 2.72, 1.56, 20, 1, true, -1.12, PI + 2.24);
  K.add(new THREE.Mesh(glassWall, glassDome), 2.82, 2.36, 0);
  for (let k = 0; k <= 6; k++) {
    const a = -1.10 + (k / 6) * (PI + 2.20);
    K.add(K.rbox(0.08, 1.62, 0.08, 0.02, brassMat), 2.82 + Math.sin(a) * 2.7, 2.36, Math.cos(a) * 2.7, 0, a, 0);
  }
  K.add(new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.07, 8, 24, PI + 2.24), brassMat), 2.82, 3.14, 0, PI / 2, 0, -PI / 2 - 1.12);

  // Partition junction collars so teapot & teacup meet cleanly around open inner arch (x = 1.52, z = 0, w = 2.01m >= 1.65m)
  K.wall(1.52, 2.08, PI / 2, 2.15, 3.25, 0.24, [], porcIn, porcIn);
  K.wall(1.52, -2.08, PI / 2, 2.15, 3.25, 0.24, [], porcIn, porcIn);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.11, 8, 18, PI), woodWarm), 1.42, 1.72, 0, 0, PI / 2, 0);

  // Giant Curved Porcelain Teapot Spout on -X!
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.45, 1.25, 0),
    new THREE.Vector3(-5.25, 1.75, 0),
    new THREE.Vector3(-5.55, 2.85, 0),
    new THREE.Vector3(-5.92, 3.52, 0),
  ]);
  K.add(new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 20, 0.44, 14, false), porcOut));
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 16), porcOut), -5.94, 3.54, 0, 0, PI / 2, 0.45);
  K.boxCol(-5.15, 0, 1.35, 1.0);

  // Giant Curved Porcelain Teacup Handle on +X!
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.38, 1.48, 0),
    new THREE.Vector3(6.22, 1.55, 0),
    new THREE.Vector3(6.18, 0.68, 0),
    new THREE.Vector3(5.28, 0.48, 0),
  ]);
  K.add(new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 18, 0.17, 10, false), porcOut));

  // Front Arched Doorway Frame (x = -1.35, z = 3.35, clear opening 1.72m >= 1.65m!) + Giant Red & Blue Thread-Spool Entrance Pillars!
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.13, 8, 18, PI), stoneFloor), -1.35, 1.72, 3.35);
  K.add(K.rbox(0.20, 1.74, 0.28, 0.04, stoneFloor), -2.31, 0.87, 3.35);
  K.add(K.rbox(0.20, 1.74, 0.28, 0.04, stoneFloor), -0.39, 0.87, 3.35);
  K.add(K.rbox(0.84, 2.15, 0.09, 0.03, woodWarm), -2.20, 1.08, 2.86, 0, 1.28, 0);
  addThreadSpool(THREE, K, -2.88, 0.04, 3.42, 0.50, 1.85, woodWarm, K.M(0xcf434a, K.tex('burlap', 2, 2)));
  addThreadSpool(THREE, K, 0.18, 0.04, 3.42, 0.50, 1.85, woodWarm, K.M(0x4b87c2, K.tex('burlap', 2, 2)));
  K.boxCol(-2.88, 3.42, 1.0, 1.0);
  K.boxCol(0.18, 3.42, 1.0, 1.0);
  K.add(K.rbox(1.9, 0.08, 0.88, 0.03, stoneFloor), -1.35, 0.04, 3.85);
  addHangingLantern(THREE, K, 0.25, 2.55, 3.15, brassMat, glow, K.root, 0.9);

  // ---- ROOM 1 (`porcelain_parlor`): Dewdrop Chandelier, Button Table, Curved Bookcase Bench & Floral Rug
  K.add(K.rbox(0.95, 0.46, 2.15, 0.05, woodWarm), -3.55, 0.23, -0.55);
  K.add(K.rbox(0.84, 0.2, 1.98, 0.06, ginghamMat), -3.52, 0.54, -0.55);
  K.add(K.rbox(0.55, 1.45, 1.85, 0.04, woodDark), -3.72, 1.45, -0.55);
  const bookCols = [0xc94e46, 0x457cb8, 0x5c9a4c, 0xdba43c];
  for (let b = 0; b < 7; b++) {
    K.add(K.rbox(0.32, 0.34, 0.14, 0.02, K.M(bookCols[b % 4])), -3.58, 1.88, -1.18 + b * 0.2);
  }
  K.boxCol(-3.58, -0.55, 1.05, 2.2);

  // Button-top parlor table (placed at x = -1.95, z = -0.85, clear of doorIn -> innerDoors walk path!)
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.82, 12), woodDark), -1.95, 0.41, -0.85);
  addButtonDisc(THREE, K, -1.95, 0.82, -0.85, 0.88, 0.12, woodWarm, woodDark, null);
  K.boxCol(-1.95, -0.85, 1.65, 1.65);
  // Floral woven rug
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.6, 0.05, 24), K.M(0x88b45c)), -1.75, 0.09, -0.45);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 20), K.M(0xea8ca2)), -1.75, 0.1, -0.45);

  // Dewdrop Chandelier suspended in parlor
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), brassMat), -1.45, 3.18, -0.2);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 18), brassMat), -1.45, 2.88, -0.2, PI / 2, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), glow), -1.45 + Math.cos(a) * 0.62, 2.74, -0.2 + Math.sin(a) * 0.62, 0, 0, 0);
  }

  // ---- ROOM 2 (`teacup_conservatory_room`): Sunlit Seedling Benches, Terracotta Pots & Watering Can
  K.add(K.rbox(1.95, 0.78, 0.68, 0.04, woodWarm), 2.95, 0.39, -1.82);
  K.add(K.rbox(0.68, 0.78, 1.65, 0.04, woodWarm), 4.48, 0.39, -0.15);
  K.boxCol(2.95, -1.82, 2.0, 0.75);
  K.boxCol(4.48, -0.15, 0.75, 1.7);

  const potMat = K.M(0xc96b3e, K.tex('terracotta', 1, 1));
  for (const [px, py, pz] of [
    [2.35, 0.92, -1.82], [2.95, 0.92, -1.82], [3.55, 0.92, -1.82],
    [4.48, 0.92, -0.68], [4.48, 0.92, 0.32],
  ]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.28, 10), potMat), px, py, pz);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 7), leafMat), px, py + 0.26, pz);
  }
  // Tiny painted silver-blue watering can on conservatory floor corner
  const zincMat = K.M(0xb8c8d8, null, { roughness: 0.52, metalness: 0 });
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 12), zincMat), 3.65, 0.28, 1.35);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.45, 8), zincMat), 3.4, 0.42, 1.35, 0, 0, 0.7);

  // ---- ROOF (`roofG`): Domed Teapot Lid w/ Twine Bow + Curved Brass-and-Glass Conservatory Dome
  const lidProf = [[2.98, 3.42], [2.62, 3.92], [1.75, 4.38], [0.58, 4.58], [0.68, 4.92], [0.42, 5.22], [0, 5.28]];
  K.addR(new THREE.Mesh(new THREE.LatheGeometry(lidProf.map(([r, y]) => new THREE.Vector2(r, y)), 28), porcOut), -1.35, 0, 0);
  // Twine collar + chunky braided bow around teapot finial
  K.addR(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.09, 8, 18), twineMat), -1.35, 4.62, 0, PI / 2, 0, 0);
  for (const sx of [-1, 1]) {
    K.addR(new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.075, 8, 16), twineMat), -1.35 + sx * 0.54, 4.74, 0.18, 0.35, sx * 0.3, sx * 0.4);
  }
  // Upper brass & glass conservatory dome over teacup
  K.addR(new THREE.Mesh(new THREE.SphereGeometry(2.7, 22, 12, 0, PI * 2, 0, PI * 0.48), glassDome), 2.82, 3.12, 0);
  for (let r = 0; r < 4; r++) {
    K.addR(new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.055, 6, 24, PI), brassMat), 2.82, 3.12, 0, 0, (r / 4) * PI, 0);
  }
  addMossAndDaisies(THREE, K, [
    [-0.25, 3.65, 2.75, 0.42, true], [-2.35, 3.68, 2.55, 0.4, true], [0.85, 3.35, 2.1, 0.45, false],
  ], K.roofG);

  Object.assign(K.root.userData, {
    floorY: 0.11,
    footprint: { w: 9.8, d: 7.4 },
    door: { x: -1.35, z: 4.45 },
    doorIn: { x: -1.35, z: 2.35 },
    innerDoors: [{ x: 1.48, z: 0.0 }],
    rooms: [
      { name: 'porcelain_parlor', x: -1.32, z: 0.0, w: 5.6, d: 5.8, walkX: -0.45, walkZ: 0.95 },
      { name: 'teacup_conservatory_room', x: 2.98, z: 0.0, w: 3.0, d: 4.8, walkX: 2.85, walkZ: 0.15 },
    ],
    propSlots: [
      { id: 'bw_thimble_stool', x: -2.75, z: -0.95, rot: 0.5 },
      { id: 'bw_thimble_stool', x: -1.15, z: -1.55, rot: -0.4 },
      { id: 'bw_spool_table', x: -2.35, z: 1.55, rot: 0.2 },
      { id: 'bw_bottle_cap_chair', x: -3.15, z: 1.35, rot: 0.7 },
      { id: 'bw_button_stack', x: -0.55, z: -2.25, rot: 0.3 },
      { id: 'bw_button_stack', x: 0.15, z: -2.15, rot: -0.4 },
      { id: 'bw_teacup_planter', x: 2.25, z: 1.45, rot: 2.4 },
      { id: 'bw_teacup_planter', x: 3.15, z: 1.55, rot: 2.8 },
      { id: 'bw_inkwell_pot', x: 2.15, z: -1.15, rot: 0.4 },
      { id: 'bw_strawberry_basket', x: 3.85, z: 0.85, rot: -1.1 },
    ],
  });

  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// 3. AMANITA ROOT LODGE (`oak_mushroom_lodge`)
// ============================================================================
export function buildOakMushroomLodge(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'oak_mushroom_lodge', 37);
  const T = getTinyfolkTextures(THREE);

  const barkOut = K.M(0xd2a87c, K.tex('bark', 1.6, 1.6));
  const barkIn = K.M(0xe6be8a, K.tex('wood_light', 1.6, 1.6));
  const rootDark = K.M(0xb88b5e, K.tex('bark', 1.4, 2.2));
  const treeSlice = K.M(0xffffff, T.treeRing);
  const capMat = K.M(0xffffff, T.amanitaCap, { roughness: 0.68 });
  const gillMat = K.M(0xffffff, T.gills, { roughness: 0.9 });
  const stemMat = K.M(0xfaf0d8, K.tex('plaster', 1.2, 1.8));
  const stoneMat = K.M(0xd3c7b2, K.tex('stone', 2.2, 2.2));
  const mossFloor = K.M(0x7eb44e, K.tex('leaves', 1.6, 1.6));
  const quiltMat = K.M(0xfbf2dd, T.rosePorcelain);
  const glow = K.glowMat(0xffdd88, 0xff9e2c, 1.9);

  // Flagstone & mossy lodge floor
  K.add(K.rbox(8.8, 0.12, 6.8, 0.05, stoneMat), 0, 0.03, 0);

  // Hollow bark cottage enclosure: front door at x = -0.35, z = 3.45, w = 1.72 >= 1.65
  K.wall(0, 3.45, 0, 8.6, 3.48, 0.28, [
    { door: true, u: -0.35, w: 1.72, h: 2.48, arch: true },
    { u: -2.85, y0: 0.85, w: 0.96, h: 0.96, round: true },
    { u: -0.35, y0: 2.62, w: 0.78, h: 0.78, round: true },
  ], barkOut, barkIn);
  K.wall(-4.3, 0, -PI / 2, 6.9, 3.45, 0.28, [{ u: 0.2, y0: 1.1, w: 1.02, h: 1.02, round: true }], barkOut, barkIn);
  K.wall(4.3, 0, PI / 2, 6.9, 3.45, 0.28, [], barkOut, barkIn);
  K.wall(0, -3.45, PI, 8.6, 3.45, 0.28, [], barkOut, barkIn);

  // Interior root-arch partition wall at x = 1.15 (open arch w = 1.72 >= 1.65)
  K.wall(1.15, 0, PI / 2, 6.8, 3.42, 0.24, [{ door: true, u: 0, w: 1.72, h: 2.46, arch: true }], barkOut, barkIn);

  // Sculpted sweeping gnarled oak root buttresses around front & sides
  const rootPaths = [
    [[-0.35, 3.85, 3.45], [-1.35, 2.55, 3.62], [-1.55, 0.95, 3.72], [-2.1, 0.08, 4.15]],
    [[-0.35, 3.85, 3.45], [0.65, 2.55, 3.62], [0.85, 0.95, 3.72], [1.45, 0.08, 4.15]],
    [[-2.2, 3.35, 3.42], [-3.45, 1.95, 3.65], [-4.55, 0.55, 3.85], [-5.05, 0.08, 4.1]],
    [[1.85, 3.35, 3.42], [3.35, 1.95, 3.62], [4.45, 0.65, 3.82], [4.95, 0.08, 4.05]],
    [[-4.3, 3.2, -1.2], [-4.75, 1.5, -1.35], [-5.05, 0.08, -1.55]],
    [[4.3, 3.2, 1.1], [4.75, 1.5, 1.25], [5.05, 0.08, 1.45]],
  ];
  for (const pts of rootPaths) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    K.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.26, 8, false), rootDark));
  }

  // Round glowing amber twig-mullion windows & stepped bracket fungi on +X flank
  for (const [wx, wy, wz, wr] of [[-2.85, 1.33, 3.38, 0.48], [-0.35, 3.01, 3.38, 0.39]]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.08, 16), glow), wx, wy, wz, PI / 2, 0, 0);
    K.add(K.rbox(wr * 1.9, 0.07, 0.12, 0.02, rootDark), wx, wy, wz + 0.06);
    K.add(K.rbox(0.07, wr * 1.9, 0.12, 0.02, rootDark), wx, wy, wz + 0.06);
  }
  const fungusMat = K.M(0xd9aa6c, K.tex('wood_light', 1, 1));
  for (const [fy, fz, fr] of [[1.48, 3.65, 0.52], [1.08, 3.75, 0.44], [0.72, 3.82, 0.36]]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(fr, fr * 0.7, 0.12, 14, 1, false, 0, PI * 1.2), fungusMat), 1.48, fy, fz, 0, -0.5, 0);
  }
  K.add(K.rbox(1.85, 0.08, 0.85, 0.03, stoneMat), -0.35, 0.04, 3.92);
  addHangingLantern(THREE, K, -1.18, 2.08, 3.68, rootDark, glow, K.root, 0.85);

  // ---- ROOM 1 (`root_hall`): Tree-Ring Slice Table, Moss Rug, Shelf & Glowing Amber Resin Lanterns
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.58, 0.05, 22), mossFloor), -2.25, 0.09, -0.45);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.78, 12), rootDark), -2.25, 0.39, -0.45);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.98, 0.14, 22), treeSlice), -2.25, 0.84, -0.45);
  K.boxCol(-2.25, -0.45, 1.78, 1.78);

  // Back wall root shelf with glowing amber jars
  K.add(K.rbox(2.35, 0.12, 0.68, 0.04, barkIn), -1.95, 1.38, -2.92);
  K.add(K.rbox(0.16, 1.4, 0.62, 0.03, rootDark), -3.02, 0.7, -2.92);
  K.add(K.rbox(0.16, 1.4, 0.62, 0.03, rootDark), -0.88, 0.7, -2.92);
  K.boxCol(-1.95, -2.92, 2.4, 0.76);
  for (const jx of [-2.45, -1.95, -1.45]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glow), jx, 1.62, -2.9);
  }
  // Hanging glowing acorn & amber resin lanterns
  for (const [lx, ly, lz] of [[-2.15, 2.95, -0.45], [-0.95, 2.82, -1.15]]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow), lx, ly - 0.16, lz, 0, 0, 0);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 6, 0, PI * 2, 0, PI * 0.52), rootDark), lx, ly - 0.08, lz);
  }

  // ---- ROOM 2 (`root_bedroom`): Cosy Woven-Twig & Floral-Quilt Bed + Stump Nightstand + Moss Rug
  K.add(K.rbox(1.95, 0.52, 2.35, 0.06, K.M(0xc49556, K.tex('burlap', 2, 2))), 2.75, 0.26, -1.78);
  K.add(K.rbox(1.82, 0.28, 2.12, 0.1, quiltMat), 2.75, 0.62, -1.75);
  K.add(K.rbox(1.42, 0.22, 0.55, 0.09, stemMat), 2.75, 0.82, -2.45);
  K.add(K.rbox(1.98, 1.15, 0.16, 0.05, rootDark), 2.75, 0.62, -2.92);
  K.boxCol(2.75, -1.78, 2.02, 2.42);

  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.68, 12), rootDark), 3.72, 0.34, 0.25);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), glow), 3.72, 0.85, 0.25);
  K.boxCol(3.72, 0.25, 0.78, 0.78);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.08, 0.05, 20), mossFloor), 2.55, 0.09, 1.15);

  // ---- ROOF (`roofG`): Flattened Mossy Bark Crown + GIANT Red White-Spotted Amanita Cap + 2 Side Amanita Caps!
  const barkCrownGeo = new THREE.SphereGeometry(4.65, 22, 10, 0, PI * 2, 0, PI * 0.46);
  barkCrownGeo.scale(1.02, 0.26, 0.86);
  K.addR(new THREE.Mesh(barkCrownGeo, barkOut), 0, 3.25, 0);
  const mossCapGeo = new THREE.SphereGeometry(4.25, 18, 8, 0, PI * 2, 0, PI * 0.42);
  mossCapGeo.scale(1.0, 0.22, 0.84);
  K.addR(new THREE.Mesh(mossCapGeo, mossFloor), -0.35, 3.55, 0.1);

  const addAmanitaCap = (cx, cy, cz, R, H, tiltX, tiltZ) => {
    const mg = new THREE.Group();
    mg.position.set(cx, cy, cz);
    mg.rotation.set(tiltX, 0, tiltZ);
    K.roofG.add(mg);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.23, R * 0.32, H * 1.35, 14), stemMat), 0, -H * 0.58, 0, 0, 0, 0, mg);
    const capProf = [
      [0, H], [R * 0.44, H * 0.94], [R * 0.8, H * 0.66], [R, H * 0.2], [R * 0.96, 0], [R * 0.22, 0.08],
    ];
    K.add(new THREE.Mesh(new THREE.LatheGeometry(capProf.map(([r, y]) => new THREE.Vector2(r, y)), 28), capMat), 0, 0, 0, 0, 0, 0, mg);
    K.add(new THREE.Mesh(new THREE.CircleGeometry(R * 0.94, 24), gillMat), 0, 0.03, 0, PI / 2, 0, 0, mg);
    // Raised 3D cream velum warts across the scarlet cap
    for (let w = 0; w < 18; w++) {
      const a = (w / 18) * PI * 2 + (w % 3) * 0.28, rr = R * (0.22 + (w % 4) * 0.2);
      const wy = H * (1 - (rr / R) ** 1.65) + 0.03;
      K.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.085, 8, 6), stemMat), Math.cos(a) * rr, wy, Math.sin(a) * rr, 0, 0, 0, mg);
    }
  };
  addAmanitaCap(0.95, 5.48, -0.15, 3.65, 1.68, 0.1, -0.11);
  addAmanitaCap(-3.05, 4.62, -0.15, 1.65, 0.88, 0.08, 0.18);
  addAmanitaCap(3.35, 4.32, 0.45, 1.25, 0.68, 0.09, -0.18);

  addMossAndDaisies(THREE, K, [
    [-0.95, 4.35, 1.95, 0.65, true], [0.25, 4.42, 1.85, 0.58, true], [-2.25, 3.95, 2.25, 0.52, true],
  ], K.roofG);
  addMossAndDaisies(THREE, K, [
    [-4.35, 0.14, 3.25, 0.45, true], [4.15, 0.14, 3.15, 0.45, true], [1.65, 0.14, 3.95, 0.38, true],
  ]);

  Object.assign(K.root.userData, {
    floorY: 0.10,
    footprint: { w: 9.2, d: 7.5 },
    door: { x: -0.35, z: 4.45 },
    doorIn: { x: -0.35, z: 2.45 },
    innerDoors: [{ x: 1.15, z: 0.0 }],
    rooms: [
      { name: 'root_hall', x: -1.5, z: 0.0, w: 5.3, d: 6.3, walkX: -0.25, walkZ: 0.95 },
      { name: 'root_bedroom', x: 2.65, z: 0.0, w: 3.0, d: 6.1, walkX: 2.35, walkZ: 0.55 },
    ],
    propSlots: [
      { id: 'bw_thimble_stool', x: -3.25, z: -0.55, rot: 0.3 },
      { id: 'bw_thimble_stool', x: -2.25, z: -1.65, rot: -0.4 },
      { id: 'bw_mushroom_cluster', x: -3.45, z: 1.75, rot: 0.6 },
      { id: 'bw_mushroom_cluster', x: -2.65, z: 2.15, rot: -0.2 },
      { id: 'bw_acorn_lantern', x: -3.55, z: -2.35, rot: 0.5 },
      { id: 'bw_acorn_lantern', x: 0.25, z: -2.45, rot: -0.4 },
      { id: 'bw_matchbox_bed', x: 2.25, z: 1.85, rot: 3.05 },
      { id: 'bw_strawberry_basket', x: 3.55, z: 1.95, rot: -0.8 },
      { id: 'bw_strawberry_basket', x: 3.58, z: 1.15, rot: -1.2 },
      { id: 'bw_button_stack', x: 1.85, z: -2.35, rot: 0.2 },
    ],
  });

  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// 4. SEWING-CADDY WORKSHOP (`sewing_watch_workshop`)
// ============================================================================
export function buildSewingWatchWorkshop(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'sewing_watch_workshop', 53);
  const T = getTinyfolkTextures(THREE);

  const walnutOut = K.M(0xcf9a64, K.tex('wood_light', 1.5, 1.5), { roughness: 0.82, metalness: 0 });
  const cedarIn = K.M(0xe6ba82, K.tex('wood_light', 1.6, 1.6), { metalness: 0 });
  const brassMat = K.M(0xe5b84b, null, { roughness: 0.48, metalness: 0 });
  const brassDark = K.M(0xc97640, null, { roughness: 0.56, metalness: 0 });
  const dialMat = K.M(0xffffff, T.watchDial, { roughness: 0.55, metalness: 0 });
  const awningMat = K.M(0xffffff, T.awningStripe, { metalness: 0 });
  const ginghamMat = K.M(0xffffff, T.gingham, { metalness: 0 });
  const stoneMat = K.M(0xdcd0ba, K.tex('stone', 2.2, 2.2), { metalness: 0 });
  const glow = K.glowMat(0xffe7a4, 0xffae3a, 1.75);

  // Floor + dovetailed brass-bound base plinth
  K.add(K.rbox(8.9, 0.12, 6.9, 0.04, stoneMat), 0, 0.03, 0);
  K.add(K.rbox(9.28, 0.22, 7.28, 0.06, brassDark), 0, 0.11, 0);

  // Hollow dovetailed walnut sewing box walls: front door at x = 0.85, z = 3.55, w = 1.72 >= 1.65
  K.wall(0, 3.55, 0, 9.1, 3.58, 0.26, [
    { door: true, u: 0.85, w: 1.72, h: 2.48, arch: true },
  ], walnutOut, cedarIn);
  K.wall(-4.55, 0, -PI / 2, 7.1, 3.58, 0.26, [], walnutOut, cedarIn);
  K.wall(4.55, 0, PI / 2, 7.1, 3.58, 0.26, [{ u: 0, y0: 1.25, w: 1.1, h: 1.1, round: false }], walnutOut, cedarIn);
  K.wall(0, -3.55, PI, 9.1, 3.58, 0.26, [], walnutOut, cedarIn);

  // Brass corner dovetail brackets
  for (const [cx, cz] of [[-4.55, 3.55], [4.55, 3.55], [-4.55, -3.55], [4.55, -3.55]]) {
    for (let y = 0.55; y < 3.4; y += 0.95) {
      K.add(K.rbox(0.34, 0.22, 0.34, 0.03, brassMat), cx, y, cz);
    }
  }

  // Interior partition wall at x = 1.95 (open arch w = 1.72 >= 1.65, completely clear of front door x=0.85!)
  K.wall(1.95, 0, PI / 2, 7.0, 3.52, 0.22, [{ door: true, u: -0.15, w: 1.72, h: 2.46, arch: true }], cedarIn, cedarIn);

  // Striped Red-and-Cream Awning + Front Stone Steps + Door Trim
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.11, 8, 18, PI), walnutOut), 0.85, 1.68, 3.58);
  K.add(K.rbox(0.84, 2.14, 0.08, 0.03, cedarIn), -0.02, 1.07, 3.05, 0, 1.22, 0);
  K.add(K.rbox(2.18, 0.12, 1.08, 0.04, awningMat), 0.85, 2.86, 3.98, 0.36, 0, 0);
  K.add(K.rbox(2.18, 0.18, 0.08, 0.03, awningMat), 0.85, 2.62, 4.46);
  K.add(K.rbox(1.98, 0.08, 0.85, 0.03, stoneMat), 0.85, 0.04, 3.96);
  addHangingLantern(THREE, K, -0.25, 2.28, 3.74, brassMat, glow, K.root, 0.88);

  // GIANT Gold Tailor's Scissors leaning on -X front corner!
  const scisG = new THREE.Group();
  scisG.position.set(-4.52, 0.05, 3.55);
  scisG.rotation.set(-0.14, 0.25, -0.12);
  K.root.add(scisG);
  const bladeMat = K.M(0xb8c8d8, null, { roughness: 0.44, metalness: 0 });
  for (const s of [-1, 1]) {
    K.add(K.rbox(0.18, 2.55, 0.06, 0.02, bladeMat), s * 0.1, 1.28, s * 0.03, 0, 0, s * 0.11, scisG);
    K.add(K.rbox(0.14, 1.15, 0.07, 0.03, brassMat), -s * 0.16, 2.72, s * 0.03, 0, 0, s * 0.13, scisG);
    K.add(new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.085, 8, 18), brassMat), -s * 0.34, 3.48, s * 0.03, 0, 0, s * 0.2, scisG);
  }
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12), brassDark), 0, 2.02, 0, PI / 2, 0, 0, scisG);
  K.boxCol(-4.48, 3.55, 0.85, 0.85);

  // GIANT Gleaming Open-Gear Brass Pocket Watch built into front facade (x = -2.25, z = 3.68)!
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.46, 0.34, 32), brassMat), -2.25, 1.52, 3.62, PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.12, 10, 28), brassMat), -2.25, 1.52, 3.78);
  K.add(new THREE.Mesh(new THREE.CircleGeometry(1.32, 28), dialMat), -2.25, 1.52, 3.79);
  // Watch stem, crown & bow ring + gold chain
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.32, 12), brassMat), -2.25, 3.04, 3.68);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 14), brassMat), -2.25, 3.22, 3.68);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 18), brassMat), -2.25, 3.42, 3.68);
  const chainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.58, 3.35, 3.72),
    new THREE.Vector3(-3.68, 1.45, 3.85),
    new THREE.Vector3(-3.25, 0.18, 4.15),
    new THREE.Vector3(-2.15, 0.14, 4.22),
  ]);
  K.add(new THREE.Mesh(new THREE.TubeGeometry(chainCurve, 22, 0.065, 8, false), brassMat));

  // Animated `watchGears` group (kept via finalize([watchGears]) so map.js ticks/spins each cogwheel!)
  const watchGears = new THREE.Group();
  watchGears.name = 'watchGears';
  watchGears.userData.keep = true;
  K.root.add(watchGears);
  const addAnimGear = (gx, gy, gz, rOut, rIn, teeth, ry, speed, mat) => {
    const m = new THREE.Mesh(makeGearGeo(THREE, rOut, rIn, teeth, 0.09), mat);
    m.position.set(gx, gy, gz);
    m.rotation.y = ry;
    m.userData.keep = true;
    m.userData.speed = speed;
    m.castShadow = true;
    m.receiveShadow = true;
    watchGears.add(m);
  };
  // Exterior pocket-watch gears (z = 3.84)
  addAnimGear(-2.48, 1.66, 3.84, 0.44, 0.35, 14, 0, 0.9, brassMat);
  addAnimGear(-1.92, 1.36, 3.84, 0.34, 0.26, 11, 0, -1.25, brassDark);
  addAnimGear(-2.38, 1.08, 3.84, 0.26, 0.19, 9, 0, 1.6, brassMat);
  // Interior Room 1 giant brass clockwork wall gears (along -X wall x = -4.22!)
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.58, 0.12, 28), brassDark), -4.32, 2.02, -1.25, 0, 0, PI / 2);
  addAnimGear(-4.2, 2.22, -1.55, 0.72, 0.58, 16, PI / 2, 0.65, brassMat);
  addAnimGear(-4.18, 1.52, -0.78, 0.54, 0.42, 12, PI / 2, -0.95, brassMat);

  // ---- ROOM 1 (`watch_workshop`): Tailor's Needle/Button Workbench, Pincushion & Ribbon Shelf
  K.add(K.rbox(2.85, 0.14, 1.15, 0.04, cedarIn), -2.25, 0.96, -2.25);
  for (const [lx, lz] of [[-3.48, -2.68], [-1.02, -2.68], [-3.48, -1.82], [-1.02, -1.82]]) {
    K.add(K.rbox(0.16, 0.96, 0.16, 0.03, walnutOut), lx, 0.48, lz);
  }
  // Fringed gingham cloth runner & plump tomato pincushion w/ pearl pins on workbench
  K.add(K.rbox(0.76, 0.06, 1.2, 0.02, ginghamMat), -2.15, 1.04, -2.25);
  K.add(K.rbox(0.76, 0.46, 0.05, 0.02, ginghamMat), -2.15, 0.82, -1.64);
  K.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), ginghamMat), -1.55, 1.24, -2.28, 0, 0, 0);
  for (const [px, pz, rz] of [[-1.68, -2.28, 0.25], [-1.52, -2.18, -0.1], [-1.4, -2.35, -0.3]]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.48, 6), bladeMat), px, 1.62, pz, 0, 0, rz);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), K.M(px < -1.55 ? 0xfbf4e4 : 0xd94848)), px - Math.sin(rz) * 0.24, 1.85, pz);
  }
  addThreadSpool(THREE, K, -3.25, 1.03, -2.32, 0.22, 0.42, cedarIn, K.M(0xc94248));
  addButtonDisc(THREE, K, -2.75, 1.03, -2.15, 0.24, 0.05, K.M(0xf2dfb8), walnutOut, null);
  K.boxCol(-2.25, -2.25, 2.9, 1.22);
  addHangingLantern(THREE, K, -0.85, 3.05, -0.85, brassMat, glow);

  // ---- ROOM 2 (`ribbon_storeroom`): Folded Pastel Silk Ribbons Shelf & Overflowing Yarn Basket
  K.add(K.rbox(1.95, 0.12, 0.72, 0.03, cedarIn), 3.22, 1.28, -2.85);
  K.add(K.rbox(1.95, 0.12, 0.72, 0.03, cedarIn), 3.22, 2.15, -2.85);
  K.boxCol(3.22, -2.85, 2.02, 0.8);
  const ribCols = [0xf2a2b4, 0x8bc2e8, 0xf6dca0, 0x9cd18b];
  for (let r = 0; r < 4; r++) {
    K.add(K.rbox(0.58, 0.2, 0.48, 0.06, K.M(ribCols[r])), 2.75 + (r % 2) * 0.88, 1.45 + Math.floor(r / 2) * 0.88, -2.84);
  }
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.44, 0.65, 16), K.M(0xc49250, K.tex('burlap', 2, 2))), 3.55, 0.38, -1.25);
  for (const [yx, yz, yc] of [[3.42, -1.32, 0xd44b52], [3.72, -1.18, 0x4b87c4], [3.52, -1.08, 0xf2dfb8]]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), K.M(yc, K.tex('burlap', 2, 2))), yx, 0.78, yz);
  }
  K.boxCol(3.55, -1.25, 1.08, 1.08);
  addHangingLantern(THREE, K, 3.15, 3.02, 0.2, brassMat, glow, K.root, 0.86);

  // ---- ROOF (`roofG`): Propped-Open Wooden Sewing Box Lid + Upper Caddy Tray w/ Giant Spools & Pincushion!
  // Divided upper caddy tray at top of sewing box
  K.addR(K.rbox(8.95, 0.34, 2.55, 0.04, cedarIn), 0, 3.68, -2.05);
  addThreadSpool(THREE, K, -3.45, 3.82, -2.15, 0.38, 0.82, cedarIn, K.M(0x3f84bd), K.roofG);
  addThreadSpool(THREE, K, -2.55, 3.82, -2.05, 0.46, 0.95, cedarIn, K.M(0xdc7e38), K.roofG);
  K.addR(new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), ginghamMat), 1.35, 4.15, -2.05);

  const boxLid = new THREE.Group();
  boxLid.position.set(0, 3.62, -3.52);
  boxLid.rotation.x = -0.52; // propped wide open like Codex buildings_sheet!
  K.roofG.add(boxLid);
  K.add(K.rbox(9.28, 0.34, 7.25, 0.08, walnutOut), 0, 0.18, 3.55, 0, 0, 0, boxLid);
  K.add(K.rbox(8.6, 0.14, 6.55, 0.04, cedarIn), 0, 0.04, 3.55, 0, 0, 0, boxLid);
  K.add(K.rbox(0.88, 0.26, 0.34, 0.04, brassMat), 0, 0.22, 7.18, 0, 0, 0, boxLid);

  Object.assign(K.root.userData, {
    watchGears,
    floorY: 0.10,
    footprint: { w: 9.4, d: 7.5 },
    door: { x: 0.85, z: 4.55 },
    doorIn: { x: 0.85, z: 2.45 },
    innerDoors: [{ x: 1.95, z: 0.15 }],
    rooms: [
      { name: 'watch_workshop', x: -1.2, z: 0.0, w: 6.3, d: 6.5, walkX: 0.45, walkZ: 0.55 },
      { name: 'ribbon_storeroom', x: 3.15, z: 0.0, w: 2.4, d: 6.5, walkX: 2.75, walkZ: 0.35 },
    ],
    propSlots: [
      { id: 'bw_thimble_stool', x: -2.85, z: -0.95, rot: 0.2 },
      { id: 'bw_thimble_stool', x: -1.65, z: -0.92, rot: -0.3 },
      { id: 'bw_pocket_watch', x: -3.35, z: 1.65, rot: 0.7 },
      { id: 'bw_button_stack', x: -2.45, z: 2.25, rot: 0.4 },
      { id: 'bw_button_stack', x: -1.55, z: 2.35, rot: -0.5 },
      { id: 'bw_spool_table', x: -0.25, z: -2.25, rot: 0.1 },
      { id: 'bw_acorn_lantern', x: 0.55, z: -2.45, rot: -0.3 },
      { id: 'bw_sugar_crate', x: 2.65, z: 2.15, rot: 0.15 },
      { id: 'bw_sugar_crate', x: 3.55, z: 2.18, rot: -0.2 },
      { id: 'bw_bottle_cap_chair', x: 3.45, z: 0.85, rot: -1.8 },
    ],
  });

  K.finalize([watchGears]);
  return tagPaintMeshes(K.root);
}

// ============================================================================
// 5. FLOWERPOT GREENHOUSE (`flowerpot_greenhouse`)
// ============================================================================
export function buildFlowerpotGreenhouse(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'flowerpot_greenhouse', 67);
  const T = getTinyfolkTextures(THREE);

  const potOut = K.M(0xffffff, T.crackedPot, { roughness: 0.88, metalness: 0 });
  const potRim = K.M(0xc97640, K.tex('terracotta', 1.4, 1.4), { metalness: 0 });
  const woodIn = K.M(0xdca96e, K.tex('wood_light', 1.6, 1.6), { metalness: 0 });
  const twigMat = K.M(0x885c38, K.tex('bark', 1.4, 2.0), { metalness: 0 });
  const brassCap = K.M(0xe5b84b, null, { roughness: 0.50, metalness: 0 });
  const stoneMat = K.M(0xd8cab2, K.tex('stone', 2.4, 2.4), { metalness: 0 });
  const glassSky = K.M(0xdaf4fc, null, { roughness: 0.18, metalness: 0, transparent: true, opacity: 0.46 });
  const leafMat = K.M(0x6ea645, K.tex('leaves', 1.2, 1.2), { metalness: 0 });
  const wisteriaMat = K.M(0xa574d8, null, { roughness: 0.8, metalness: 0 });
  const glow = K.glowMat(0xffe7a2, 0xffad38, 1.75);

  // Terracotta & flagstone interior floor + wooden veranda deck
  K.add(K.rbox(8.4, 0.12, 6.45, 0.05, stoneMat), 0, 0.03, -0.15);
  K.add(K.rbox(6.8, 0.1, 1.42, 0.04, woodIn), -0.1, 0.03, 3.82);

  // Sideways half-buried Terracotta Pot lower walls (-X, +X, -Z) + recessed wooden front wall (+Z at z = 3.12, w = 1.72 >= 1.65)
  K.wall(0, 3.12, 0, 8.3, 3.38, 0.25, [
    { door: true, u: -0.35, w: 1.72, h: 2.48, arch: true },
    { u: 2.15, y0: 1.08, w: 1.05, h: 1.08, round: false },
  ], woodIn, woodIn);
  K.wall(-4.15, -0.15, -PI / 2, 6.55, 3.35, 0.28, [], potOut, woodIn);
  K.wall(4.15, -0.15, PI / 2, 6.55, 3.35, 0.28, [
    { u: -1.15, y0: 1.45, w: 1.02, h: 1.02, round: true },
    { u: 1.15, y0: 1.18, w: 0.98, h: 0.98, round: true },
  ], potOut, woodIn);
  K.wall(0, -3.42, PI, 8.3, 3.35, 0.28, [
    { u: -2.65, y0: 1.12, w: 1.35, h: 1.22, round: false },
  ], potOut, woodIn);

  // Curved exterior lower terracotta pot flanks (-X and +X below y = 3.1m so interiors mode stays 100% open!)
  const flankR = new THREE.CylinderGeometry(4.32, 3.95, 6.55, 14, 1, true, PI * 0.42, PI * 0.24);
  flankR.rotateX(PI / 2);
  K.add(new THREE.Mesh(flankR, potOut), 0.15, 1.15, -0.15);
  const flankL = new THREE.CylinderGeometry(4.32, 3.95, 6.55, 14, 1, true, PI * 1.34, PI * 0.24);
  flankL.rotateX(PI / 2);
  K.add(new THREE.Mesh(flankL, potOut), -0.15, 1.15, -0.15);
  // 2 Crimped Brass Bottle-Cap Porthole Windows on +X terracotta flank!
  for (const [wy, wz] of [[1.96, 1.0], [1.67, -1.3]]) {
    K.add(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.11, 8, 16), brassCap), 4.28, wy, wz, 0, PI / 2, 0);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), glow), 4.18, wy, wz, 0, 0, PI / 2);
    K.add(K.rbox(0.08, 0.96, 0.07, 0.02, brassCap), 4.28, wy, wz);
    K.add(K.rbox(0.08, 0.07, 0.96, 0.02, brassCap), 4.28, wy, wz);
  }

  // Interior partition wall at x = 1.55 (open arch w = 1.72 >= 1.65)
  K.wall(1.55, -0.15, PI / 2, 6.45, 3.32, 0.22, [{ door: true, u: 0, w: 1.72, h: 2.45, arch: true }], woodIn, woodIn);

  // Lashed Twig Front Veranda (wide 2.25m open entry gap around x = -0.35 so door walk path is 100% clear!)
  for (const px of [-3.35, -1.48, 0.78, 2.85]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.85, 8), twigMat), px, 1.42, 4.42);
  }
  // Left & right twig railings (with 2.25m gap in middle!)
  K.add(K.rbox(1.90, 0.1, 0.1, 0.03, twigMat), -2.42, 0.88, 4.42);
  K.add(K.rbox(2.08, 0.1, 0.1, 0.03, twigMat), 1.82, 0.88, 4.42);
  K.boxCol(-2.42, 4.42, 1.90, 0.28);
  K.boxCol(1.82, 4.42, 2.08, 0.28);
  K.add(K.rbox(1.75, 0.07, 0.65, 0.03, woodIn), -0.35, 0.03, 4.78);
  addHangingLantern(THREE, K, 0.55, 2.22, 3.45, brassCap, glow, K.root, 0.86);

  // Trailing Purple Wisteria Clusters on left veranda corner
  for (const [wx, wy, wz] of [[-3.25, 2.55, 4.38], [-2.85, 2.62, 4.42], [-3.42, 2.48, 3.95]]) {
    for (let k = 0; k < 4; k++) {
      K.add(new THREE.Mesh(new THREE.SphereGeometry(0.16 - k * 0.025, 8, 6), wisteriaMat), wx, wy - k * 0.22, wz);
    }
  }

  // ---- ROOM 1 (`herb_apothecary`): Corked Glass-Vial Herb Shelves, Seed-Packet Frames & Button Table
  for (const sy of [0.85, 1.68]) {
    K.add(K.rbox(0.68, 0.1, 2.85, 0.03, woodIn), -3.55, sy, -0.45);
  }
  K.boxCol(-3.55, -0.45, 0.78, 2.9);
  const vialCols = [0x9d6cd6, 0xe8c448, 0x62aa4c, 0xdd6b5c];
  for (let v = 0; v < 8; v++) {
    const vy = v < 4 ? 1.08 : 1.91, vz = -1.45 + (v % 4) * 0.65;
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 10), K.M(vialCols[v % 4])), -3.52, vy, vz);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.42, 10), glassSky), -3.52, vy + 0.03, vz);
  }
  // Apothecary drawer counter + 3 botanical paintings on -Z wall
  K.add(K.rbox(2.05, 0.96, 0.72, 0.04, woodIn), 0.05, 0.48, -2.85);
  K.boxCol(0.05, -2.85, 2.1, 0.78);
  const packetTexs = [T.stampClover, T.stampRose, T.stampButterfly];
  for (let p = 0; p < 3; p++) {
    K.add(K.rbox(0.58, 0.76, 0.05, 0.02, K.M(0xffffff, packetTexs[p])), -0.62 + p * 0.66, 2.02, -3.22);
  }
  // Button-top center table + braided jute rug
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.48, 0.05, 22), K.M(0xc9a368, K.tex('burlap', 2, 2))), -1.85, 0.09, -0.65);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.78, 12), twigMat), -1.85, 0.39, -0.65);
  addButtonDisc(THREE, K, -1.85, 0.78, -0.65, 0.85, 0.11, woodIn, twigMat, null);
  K.boxCol(-1.85, -0.65, 1.6, 1.6);
  addHangingLantern(THREE, K, -0.95, 2.95, -0.45, brassCap, glow);

  // ---- ROOM 2 (`potting_room`): Sunlit Seedling Potting Bench & Terracotta Thumb-Pots
  K.add(K.rbox(2.05, 0.88, 0.72, 0.04, woodIn), 2.82, 0.44, -2.65);
  K.boxCol(2.82, -2.65, 2.1, 0.78);
  for (let s = 0; s < 4; s++) {
    const px = 2.08 + s * 0.48;
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 10), potRim), px, 1.0, -2.65);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), leafMat), px, 1.24, -2.65);
  }

  // ---- ROOF (`roofG`): Upper Curved Cracked Terracotta Pot Arch + Rolled Rim + Glass-Slide Skylight!
  // After .rotateX(PI/2), theta = PI is +Y (crown!), theta = PI/2 is +X, theta = 3*PI/2 is -X!
  const roofArch = new THREE.CylinderGeometry(4.42, 4.02, 6.85, 24, 1, false, PI * 0.64, PI * 0.72);
  roofArch.rotateX(PI / 2);
  K.addR(new THREE.Mesh(roofArch, potOut), 0, 1.08, -0.15);
  // Thick warm-terracotta rolled front collar rim arching cleanly from +X over +Y to -X
  const potRimWarm = K.M(0xcf6d3e, T.crackedPot, { roughness: 0.84 });
  K.addR(new THREE.Mesh(new THREE.TorusGeometry(4.36, 0.34, 10, 28, PI * 0.88), potRimWarm), 0, 1.08, 3.16, 0, 0, PI * 0.06);
  // Sloped glass-slide veranda skylight framed in twigs & brass mullions
  K.addR(K.rbox(6.45, 0.09, 1.62, 0.03, glassSky), -0.1, 3.22, 3.82, 0.38, 0, 0);
  for (let m = -3; m <= 3; m++) {
    K.addR(K.rbox(0.08, 0.12, 1.66, 0.02, twigMat), -0.1 + m * 1.04, 3.23, 3.82, 0.38, 0, 0);
  }
  addMossAndDaisies(THREE, K, [
    [0.65, 5.42, 1.15, 0.72, true], [1.55, 5.12, -0.15, 0.62, true], [-1.15, 5.28, 1.55, 0.58, true],
  ], K.roofG);

  Object.assign(K.root.userData, {
    floorY: 0.10,
    footprint: { w: 8.8, d: 7.8 },
    door: { x: -0.35, z: 4.95 },
    doorIn: { x: -0.35, z: 2.15 },
    innerDoors: [{ x: 1.55, z: -0.15 }],
    rooms: [
      { name: 'herb_apothecary', x: -1.25, z: -0.15, w: 5.6, d: 6.2, walkX: 0.15, walkZ: 0.65 },
      { name: 'potting_room', x: 2.8, z: -0.15, w: 2.5, d: 6.0, walkX: 2.55, walkZ: 0.25 },
    ],
    propSlots: [
      { id: 'bw_spool_table', x: -2.65, z: 1.65, rot: 0.2 },
      { id: 'bw_thimble_stool', x: -2.85, z: -0.65, rot: 0.4 },
      { id: 'bw_thimble_stool', x: -1.85, z: -1.75, rot: -0.3 },
      { id: 'bw_inkwell_pot', x: -2.75, z: -2.45, rot: 0.5 },
      { id: 'bw_inkwell_pot', x: -2.05, z: -2.55, rot: -0.2 },
      { id: 'bw_teacup_planter', x: -3.25, z: 2.15, rot: 0.8 },
      { id: 'bw_bottle_cap_chair', x: 0.65, z: -1.65, rot: -0.6 },
      { id: 'bw_teacup_planter', x: 2.25, z: 1.75, rot: 2.5 },
      { id: 'bw_teacup_planter', x: 3.15, z: 1.85, rot: 2.9 },
      { id: 'bw_strawberry_basket', x: 3.35, z: -0.65, rot: -1.1 },
    ],
  });

  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// LANDMARK 1: FAUCET SHELL POND + GIANT GLASS MARBLES (`faucetShellPond`)
// ============================================================================
export function buildFaucetShellPond(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'faucetShellPond', 79);
  const T = getTinyfolkTextures(THREE);

  const brassMat = K.M(0xe5b84b, null, { roughness: 0.48, metalness: 0 });
  const brassAged = K.M(0xc97640, null, { roughness: 0.56, metalness: 0 });
  const shellMat = K.M(0xffffff, T.shellNacre, { roughness: 0.42, metalness: 0 });
  const stoneMat = K.M(0xcfc4ae, K.tex('stone', 1.8, 1.8), { metalness: 0 });
  const waterMat = K.M(0x4cb8cf, null, { roughness: 0.16, metalness: 0, transparent: true, opacity: 0.82 });

  // Scalloped Iridescent Shell Basin (centered at local (0, 0.28))
  const lobes = 18, R0 = 1.62;
  const shellPts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    shellPts.push(new THREE.Vector2(0.45 + Math.sin(t * PI * 0.55) * R0, t * 0.78));
  }
  const basinGeo = new THREE.LatheGeometry(shellPts, lobes * 2);
  const pos = basinGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x), flute = 1 + Math.sin(a * lobes) * 0.065 * (y / 0.78);
    pos.setXYZ(i, x * flute, y + Math.sin(a * lobes) * 0.03 * (y / 0.78), z * flute * 0.92);
  }
  basinGeo.computeVertexNormals();
  K.add(new THREE.Mesh(basinGeo, shellMat), 0, 0.04, 0.25);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.35, 0.08, 28), waterMat), 0, 0.56, 0.25);
  K.boxCol(0, 0.25, 2.95, 2.65);

  // Mossy cobblestone plinth & Tall Antique Brass Garden Tap behind basin (z = -1.25)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    K.add(K.rbox(0.46, 0.26, 0.38, 0.08, stoneMat), Math.cos(a) * 1.65, 0.13, 0.25 + Math.sin(a) * 1.48, 0, a, 0);
  }
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 0.42, 8), brassAged), 0, 0.21, -1.25);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.15, 16), brassMat), 0, 1.38, -1.25);
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 8, 16), brassAged), 0, 1.45, -1.25, PI / 2, 0, 0);
  // Curved gooseneck spout overhanging shell basin center!
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.38, -1.25),
    new THREE.Vector3(0, 2.75, -0.75),
    new THREE.Vector3(0, 2.68, -0.05),
    new THREE.Vector3(0, 2.18, 0.18),
  ]);
  K.add(new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 20, 0.24, 14, false), brassMat));
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 16), brassAged), 0, 2.18, 0.18, PI / 2, 0, 0);
  // 4-lobed antique cross-handle on top of tap
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 12), brassAged), 0, 2.76, -1.25);
  for (const ry of [0, PI / 2]) {
    K.add(K.rbox(1.12, 0.14, 0.16, 0.06, brassMat), 0, 3.04, -1.25, 0, ry, 0);
    for (const sx of [-1, 1]) {
      K.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), brassMat), Math.cos(ry) * sx * 0.56, 3.04, -1.25 + Math.sin(ry) * sx * 0.56);
    }
  }
  K.boxCol(0, -1.25, 1.05, 1.05);

  // 3 Giant Swirled Glass Marbles (configurable offset; included by default!)
  if (opts.includeMarbles !== false) {
    const mx = opts.marbleX ?? 2.65, mz = opts.marbleZ ?? 1.95;
    const marbles = [
      [mx, 0.58, mz, 0.58, 0x2d6fd6, 0xeef7ff],
      [mx + 0.92, 0.44, mz - 0.55, 0.44, 0x4ba847, 0xebffd9],
      [mx - 0.68, 0.34, mz + 0.52, 0.34, 0xd84339, 0xffe8dc],
    ];
    for (const [x, y, z, r, swirlHex, glassHex] of marbles) {
      K.add(new THREE.Mesh(new THREE.TorusKnotGeometry(r * 0.46, r * 0.14, 28, 8, 2, 3), K.M(swirlHex, null, { roughness: 0.25, metalness: 0 })), x, y, z);
      K.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), K.M(glassHex, null, { roughness: 0.10, metalness: 0, transparent: true, opacity: 0.46 })), x, y, z);
    }
    K.boxCol(mx + 0.12, mz, 2.15, 1.75);
  }

  addMossAndDaisies(THREE, K, [
    [-1.45, 0.22, -0.85, 0.45, true], [1.45, 0.22, -0.85, 0.45, true], [0, 0.24, -1.85, 0.5, true],
  ]);

  K.root.userData.spoutTip = new THREE.Vector3(0, 2.12, 0.18);
  K.root.userData.waterY = 0.61;
  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// LANDMARK 2: WALKABLE GARDEN TROWEL BRIDGE (`trowelBridge`, userData.ground = true!)
// ============================================================================
export function buildTrowelBridge(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'trowelBridge', 89);

  const steelDeckMat = K.M(0xb8c8d8, K.tex('painted_metal', 1.6, 1.6), { roughness: 0.54, metalness: 0 });
  const steelRimMat = K.M(0x98aab8, K.tex('painted_metal', 1.2, 1.2), { roughness: 0.58, metalness: 0 });
  const brassCollar = K.M(0xe5b84b, null, { roughness: 0.48, metalness: 0 });
  const handleWood = K.M(0xa66b3b, K.tex('wood_light', 1.5, 2.2), { roughness: 0.8, metalness: 0 });
  const dewMat = K.M(0xdcf6ff, null, { roughness: 0.08, metalness: 0, transparent: true, opacity: 0.76 });

  // Broad walkable forged-steel trowel blade spanning z ∈ [-3.6, +3.2] at y ≈ 0.045m!
  // Kept unmerged (`keep = true`) so `userData.ground = true` and `userData.paint` survive mergeStatic!
  const bladeSh = new THREE.Shape();
  bladeSh.moveTo(0, -3.75);
  bladeSh.quadraticCurveTo(1.58, -2.55, 1.62, 0.45);
  bladeSh.quadraticCurveTo(1.55, 2.45, 0.85, 3.25);
  bladeSh.lineTo(-0.85, 3.25);
  bladeSh.quadraticCurveTo(-1.55, 2.45, -1.62, 0.45);
  bladeSh.quadraticCurveTo(-1.58, -2.55, 0, -3.75);
  const deckGeo = new THREE.ExtrudeGeometry(bladeSh, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.025 });
  deckGeo.rotateX(PI / 2);
  const deckMesh = new THREE.Mesh(deckGeo, steelDeckMat);
  deckMesh.position.set(0, 0.07, 0);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  deckMesh.userData.ground = true;
  deckMesh.userData.keep = true;
  deckMesh.userData.paint = new THREE.Color(0x8e9ba6);
  K.root.add(deckMesh);

  // Raised curved trowel scoop side flanges (low decorative curb along edges)
  for (const sx of [-1, 1]) {
    const rimCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.55, 0.09, -3.25),
      new THREE.Vector3(sx * 1.48, 0.22, -1.25),
      new THREE.Vector3(sx * 1.56, 0.28, 1.15),
      new THREE.Vector3(sx * 0.92, 0.24, 3.05),
    ]);
    K.add(new THREE.Mesh(new THREE.TubeGeometry(rimCurve, 18, 0.085, 8, false), steelRimMat));
  }
  // Sparkling water dewdrops on the steel trowel blade
  for (const [dx, dz, dr] of [[-0.45, -0.8, 0.09], [0.52, 0.4, 0.11], [-0.2, 1.35, 0.08]]) {
    K.add(new THREE.Mesh(new THREE.SphereGeometry(dr, 10, 8), dewMat), dx, 0.11, dz);
  }

  // Forged steel neck + Brass ferrule + Giant Turned Ashwood Handle on the +X/+Z side (offset slightly +X so walk path across blade is open!)
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.55, 0.14, 3.05),
    new THREE.Vector3(1.25, 0.42, 3.85),
    new THREE.Vector3(1.85, 0.62, 4.45),
  ]);
  K.add(new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 12, 0.2, 10, false), steelRimMat));
  const handleG = new THREE.Group();
  handleG.position.set(1.85, 0.62, 4.45);
  handleG.rotation.set(PI / 2 - 0.12, 0, -0.58);
  K.root.add(handleG);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.58, 16), brassCollar), 0, 0.28, 0, 0, 0, 0, handleG);
  const hProf = [[0.44, 0.55], [0.58, 1.35], [0.62, 2.55], [0.54, 3.35], [0.32, 3.68], [0, 3.74]];
  K.add(new THREE.Mesh(new THREE.LatheGeometry(hProf.map(([r, y]) => new THREE.Vector2(r, y)), 20), handleWood), 0, 0, 0, 0, 0, 0, handleG);

  // Collider ONLY on the giant raised wooden handle off to the side so the entire steel blade stays walkable!
  K.boxCol(2.75, 5.65, 1.35, 3.35, -0.58);
  K.root.userData.ground = true;
  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// LANDMARK 3: BUTTON-CROWNED LEAF MARKET STALL (`buttonLeafStall`)
// ============================================================================
export function buildButtonLeafStall(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'buttonLeafStall', 97);
  const autumn = !!opts.autumn;

  const twigMat = K.M(0x7d5332, K.tex('bark', 1.4, 2.0));
  const woodCounter = K.M(0xc89256, K.tex('wood_light', 1.5, 1.5));
  const leafCanopy = K.M(autumn ? 0xd87a38 : 0x6ea844, K.tex('leaves', 1.3, 1.3));
  const clothMat = K.M(autumn ? 0xe4edf6 : 0xfbf0df, getTinyfolkTextures(THREE).gingham);
  const btnMat = K.M(autumn ? 0xf5ebd2 : 0x9b653c, K.tex('wood_light', 1, 1));
  const glow = K.glowMat(0xffe7a4, 0xffad38, 1.7);

  // Wooden counter + tablecloth + fruit/honey crates
  K.add(K.rbox(2.75, 0.88, 1.25, 0.04, woodCounter), 0, 0.44, 0);
  K.add(K.rbox(1.15, 0.62, 1.32, 0.03, clothMat), 0.55, 0.62, 0.02);
  for (const [px, pz] of [[-1.25, -0.52], [1.25, -0.52], [-1.25, 0.52], [1.25, 0.52]]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.48, 8), twigMat), px, 1.24, pz);
  }
  // Produce baskets on counter
  for (let i = 0; i < 6; i++) {
    const col = autumn ? 0xe5a438 : (i < 3 ? 0xd83f38 : 0xefa636);
    K.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), K.M(col)), -0.85 + i * 0.34, 0.98, (i % 2 ? -0.14 : 0.14));
  }
  // Sculpted giant ribbed leaf roof + Giant 4-Hole Button crown!
  const leafSh = new THREE.Shape();
  leafSh.moveTo(0, -1.15);
  leafSh.quadraticCurveTo(1.92, -0.85, 1.78, 0.25);
  leafSh.quadraticCurveTo(1.42, 1.08, 0, 1.25);
  leafSh.quadraticCurveTo(-1.42, 1.08, -1.78, 0.25);
  leafSh.quadraticCurveTo(-1.92, -0.85, 0, -1.15);
  const leafGeo = new THREE.ExtrudeGeometry(leafSh, { depth: 0.09, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 });
  leafGeo.rotateX(PI / 2);
  K.add(new THREE.Mesh(leafGeo, leafCanopy), 0, 2.52, 0.05, 0.16, 0, 0);
  addButtonDisc(THREE, K, -0.15, 2.62, 0.25, 0.56, 0.12, btnMat, twigMat, K.M(0xfaf2dd), 0.22, 0, -0.08);
  addHangingLantern(THREE, K, 1.25, 2.15, 0.58, twigMat, glow, K.root, 0.72);

  K.boxCol(0, 0, 2.8, 1.3);
  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// LANDMARK 4: WOODEN SPRING CLOTHESPIN & TWINE FENCE (`clothespinFence`)
// ============================================================================
export function buildClothespinFence(THREE, opts = {}) {
  const count = opts.count || 4;
  const spacing = opts.spacing || 0.92;
  const K = createBuilderKit(THREE, opts, 'clothespinFence', 107);

  const woodPin = K.M(0xd7a568, K.tex('wood_light', 1.2, 2.0), { metalness: 0 });
  const steelSpring = K.M(0xb8c8d8, null, { roughness: 0.48, metalness: 0 });
  const twineMat = K.M(0xcba066, K.tex('burlap', 2, 2), { metalness: 0 });

  const totalW = (count - 1) * spacing;
  for (let i = 0; i < count; i++) {
    const px = -totalW / 2 + i * spacing;
    const tilt = ((i % 2) * 2 - 1) * 0.03;
    const pg = new THREE.Group();
    pg.position.set(px, 0, 0);
    pg.rotation.z = tilt;
    K.root.add(pg);
    for (const sz of [-1, 1]) {
      K.add(K.rbox(0.24, 1.48, 0.1, 0.03, woodPin), 0, 0.74, sz * 0.075, sz * 0.03, 0, 0, pg);
      K.add(K.rbox(0.25, 0.28, 0.05, 0.02, woodPin), 0, 1.32, sz * 0.13, 0, 0, 0, pg);
    }
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.3, 10), steelSpring), 0, 0.86, 0, 0, 0, PI / 2, pg);
  }
  // Lashed double jute-twine rails
  for (const ry of [0.48, 1.02]) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      pts.push(new THREE.Vector3(-totalW / 2 + i * spacing, ry - (i % 2) * 0.04, 0));
    }
    if (pts.length >= 2) {
      K.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), count * 6, 0.045, 6, false), twineMat));
    }
  }
  K.boxCol(0, 0, totalW + 0.38, 0.36);
  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// LANDMARK 5: MOSSY STONE TOAD-LANTERN GUARDIAN (`mossGuardianStatue`)
// A squat weathered garden toad carved from stone, crouched on a two-tier plinth with a glowing
// lantern niche in its belly, a hexagonal stone lantern cap on its head & clover sprigs at its back.
// ============================================================================
export function buildMossGuardianStatue(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'mossGuardianStatue', 113);

  const mossyStone = K.M(0x9ca494, K.tex('stone', 1.8, 1.8));
  const darkStone = K.M(0x757f70, K.tex('stone', 2.0, 2.0));
  const mossCap = K.M(0x699c42, K.tex('leaves', 1.4, 1.4));
  const stemMat = K.M(0x528636, K.tex('leaves', 1, 2));
  const nicheGlow = K.glowMat(0xffe6a6, 0xffad3b, 1.75);
  const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
  const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    return K.add(m, x, y, z, rx, ry, rz);
  };

  // Two-tier mossy stone plinth
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.78, 0.48, 16), darkStone), 0, 0.24, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.46, 0.30, 8), mossyStone), 0, 0.63, 0, 0, PI / 8, 0);

  // Squat crouching toad body, broad flat head & warty back
  part(sph(1), mossyStone, 0, 1.72, -0.12, 1.30, 1.06, 1.36);
  part(sph(1), mossyStone, 0, 2.70, 0.38, 1.10, 0.62, 0.98);
  for (const [wx, wy, wz, wr] of [[-0.62, 2.50, -0.78, 0.17], [0.55, 2.62, -0.70, 0.15], [0.05, 2.42, -1.12, 0.19], [-0.98, 1.95, -0.62, 0.14], [0.96, 2.05, -0.58, 0.16]]) {
    part(sph(wr, 8, 6), darkStone, wx, wy, wz, 1, 0.7, 1);
  }
  for (const sx of [-1, 1]) {
    // Bulging eye domes on top of the head with serene carved closed lids
    part(sph(0.33, 12, 10), mossyStone, sx * 0.56, 3.10, 0.52);
    K.add(K.rbox(0.36, 0.045, 0.06, 0.02, darkStone), sx * 0.58, 3.08, 0.84, 0, sx * 0.22, -sx * 0.10);
    // Folded hind legs + planted front legs with three stubby toes
    part(sph(1, 14, 10), mossyStone, sx * 1.12, 1.30, -0.42, 0.52, 0.62, 0.88, 0, 0, sx * 0.25);
    part(sph(1, 12, 10), mossyStone, sx * 0.82, 1.28, 0.92, 0.30, 0.56, 0.30, -0.25, 0, sx * 0.12);
    for (let t = -1; t <= 1; t++) {
      part(sph(0.13, 8, 6), mossyStone, sx * 0.84 + t * 0.19, 0.84, 1.24 - Math.abs(t) * 0.06, 1, 0.6, 1.25);
    }
    // Nostril dots
    part(sph(0.035, 6, 5), darkStone, sx * 0.14, 2.86, 1.30);
  }
  // Wide carved mouth line curving around the front of the head
  K.add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.032, 6, 22, PI * 0.82), darkStone), 0, 2.62, 0.40, PI / 2, 0, PI * 0.09);

  // Glowing arched lantern niche carved into the belly
  K.add(K.rbox(0.62, 0.70, 0.20, 0.06, darkStone), 0, 1.66, 1.20, -0.10, 0, 0);
  K.add(K.rbox(0.42, 0.48, 0.10, 0.05, nicheGlow), 0, 1.64, 1.30, -0.10, 0, 0);
  K.add(K.rbox(0.05, 0.50, 0.06, 0.02, darkStone), 0, 1.64, 1.36, -0.10, 0, 0);
  K.add(K.rbox(0.44, 0.05, 0.06, 0.02, darkStone), 0, 1.66, 1.36, -0.10, 0, 0);

  // Hexagonal stone lantern cap balanced on the head: short post, upswept roof & onion finial
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 0.34, 6), darkStone), 0, 3.42, 0.10);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 1.02, 0.46, 6), mossyStone), 0, 3.80, 0.10);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.02, 0.07, 6), darkStone), 0, 3.56, 0.10);
  part(sph(0.17, 10, 8), darkStone, 0, 4.16, 0.10, 1, 1.25, 1);
  K.add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), darkStone), 0, 4.44, 0.10);

  // Moss blanket draped over the back + cap, daisies on the plinth corners
  part(new THREE.SphereGeometry(1, 14, 10, 0, PI * 2, 0, PI * 0.5), mossCap, 0, 1.92, -0.34, 1.22, 0.98, 1.20, -0.42, 0, 0);
  part(new THREE.SphereGeometry(1, 10, 6, 0, PI * 2, 0, PI * 0.5), mossCap, 0.12, 3.84, 0.02, 0.62, 0.24, 0.60, -0.18, 0, 0.12);
  addMossAndDaisies(THREE, K, [[-0.5, 4.02, -0.08, 0.26, true], [-1.15, 0.52, 0.85, 0.48, true], [1.15, 0.52, 0.85, 0.48, true], [0.2, 0.82, -1.22, 0.36, false]]);

  // Two clover sprigs sprouting behind the plinth (kept low so the stone lantern cap stays the crown)
  const heartSh = new THREE.Shape();
  heartSh.moveTo(0, 0);
  heartSh.bezierCurveTo(0.85, 0.45, 1.35, 1.45, 0.55, 1.85);
  heartSh.bezierCurveTo(0.15, 2.02, 0, 1.65, 0, 1.55);
  heartSh.bezierCurveTo(0, 1.65, -0.15, 2.02, -0.55, 1.85);
  heartSh.bezierCurveTo(-1.35, 1.45, -0.85, 0.45, 0, 0);
  const leafGeo = new THREE.ExtrudeGeometry(heartSh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 });
  leafGeo.rotateX(PI / 2);
  for (const [bx, bz, topX, topY, topZ, sc] of [[-1.25, -0.85, -1.38, 2.55, -1.20, 0.34], [1.18, -0.95, 1.36, 1.95, -1.18, 0.27]]) {
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bx, 0.1, bz),
      new THREE.Vector3((bx + topX) / 2 - Math.sign(bx) * 0.12, topY * 0.55, (bz + topZ) / 2),
      new THREE.Vector3(topX, topY, topZ),
    ]);
    K.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.07, 6, false), stemMat));
    for (let l = 0; l < 3; l++) {
      const leaf = new THREE.Mesh(leafGeo, mossCap);
      leaf.scale.setScalar(sc);
      K.add(leaf, topX, topY + 0.02, topZ, 0.16, (l / 3) * PI * 2 + 0.35, 0);
    }
  }

  K.boxCol(0, 0, 2.95, 2.95);
  K.finalize();
  return tagPaintMeshes(K.root);
}

// ============================================================================
// MACRO VERTICALITY & INTERACTIVE TINY-FOLK BUILDERS
// ============================================================================

// 6. GIANT WOODEN POTTING BENCH TERRACE (`pottingBenchTerrace`, tabletop at local y = 3.40m!)
export function buildPottingBenchTerrace(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'pottingBenchTerrace', 131);

  const plankTop = K.M(0xc9965c, K.tex('wood_light', 3.4, 2.6), { roughness: 0.84, metalness: 0 });
  const plankEdge = K.M(0xa8743e, K.tex('wood_planks_dark', 2.8, 1.4), { roughness: 0.86, metalness: 0 });
  const legWood = K.M(0x8c5b34, K.tex('bark', 1.4, 2.4), { roughness: 0.88, metalness: 0 });
  const brassMat = K.M(0xe5b84b, null, { roughness: 0.48, metalness: 0 });
  const terracotta = K.M(0xc97640, K.tex('terracotta', 1.4, 1.4), { roughness: 0.84, metalness: 0 });
  const mossMat = K.M(0x6da644, K.tex('leaves', 1.8, 1.8), { roughness: 0.9, metalness: 0 });

  // Broad walkable plank tabletop (16.0m x 12.0m, top surface at local y = 3.40m)
  const topMesh = K.rbox(16.0, 0.24, 12.0, 0.05, plankTop);
  topMesh.position.set(0, 3.28, 0);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  topMesh.userData.ground = true;
  topMesh.userData.keep = true;
  topMesh.userData.paint = new THREE.Color(0xc9965c);
  K.root.add(topMesh);

  // Decorative individual plank seams & mossy potting soil patches on tabletop
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;
    K.add(K.rbox(15.8, 0.02, 0.06, 0.01, plankEdge), 0, 3.402, i * 1.02);
  }
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.03, 18), mossMat), -5.1, 3.405, 3.3);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.03, 16), mossMat), 4.6, 3.405, 3.8);

  // Sturdy dovetailed apron beams underneath tabletop (y = 2.68..3.16m — plenty of 2.68m headroom underneath!)
  K.add(K.rbox(15.2, 0.48, 0.26, 0.03, plankEdge), 0, 2.92, 5.45);
  K.add(K.rbox(15.2, 0.48, 0.26, 0.03, plankEdge), 0, 2.92, -5.45);
  K.add(K.rbox(0.26, 0.48, 11.2, 0.03, plankEdge), -7.45, 2.92, 0);
  K.add(K.rbox(0.26, 0.48, 11.2, 0.03, plankEdge), 7.45, 2.92, 0);

  // Brass corner brackets + 4 giant turned timber table legs at (±7.1, ±5.1)
  const legCols = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lx = sx * 7.1, lz = sz * 5.1;
      K.add(K.rbox(0.56, 0.42, 0.56, 0.04, brassMat), sx * 7.48, 2.96, sz * 5.48);
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.40, 3.24, 14), legWood), lx, 1.60, lz);
      // Terracotta coaster saucer under each giant table leg
      K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.58, 0.16, 16), terracotta), lx, 0.08, lz);
      legCols.push({ x: lx, z: lz, w: 1.06, d: 1.06, y0: -0.35, y1: 3.34, noJump: true });
    }
  }
  addMossAndDaisies(THREE, K, [
    [-7.1, 0.18, 5.1, 0.55, true], [7.1, 0.18, 5.1, 0.52, true],
    [-7.1, 0.18, -5.1, 0.50, true], [7.1, 0.18, -5.1, 0.50, true],
  ]);

  K.finalize();
  K.root.userData.ground = true;
  K.root.userData.colliders = legCols;
  return tagPaintMeshes(K.root);
}

// 7. GIANT WOODEN METRIC RULER & STACKED HARDCOVER BOOKS RAMP (`rulerBookRamp`)
// Spans local x ∈ [-4.0, +4.0], z ∈ [-1.9, +1.9] (width = 3.8m >= 3.2m!), climbing local y: 0.00 -> 3.40m!
export function buildRulerBookRamp(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'rulerBookRamp', 139);

  const rulerTex = paintedCanvasTex(THREE, 'bw_vintage_ruler_v1', 512, (g, s, rng) => {
    g.fillStyle = '#ebbd52';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 280, ['#dfae40', '#f4ca68', '#d49d34'], 14, 48, 0.25, 0, 0.08, 19);
    // Brass inlaid top & bottom edge strips
    g.fillStyle = '#e5b84b';
    g.fillRect(0, 0, s, 20);
    g.fillRect(0, s - 20, s, 20);
    // Metric cm & mm ticks along both edges
    g.strokeStyle = '#3d2814';
    g.fillStyle = '#3d2814';
    g.font = 'bold 26px Georgia, serif';
    g.textAlign = 'center';
    for (let mm = 0; mm <= 60; mm++) {
      const px = (mm / 60) * (s - 24) + 12;
      const isCm = mm % 2 === 0;
      const isFive = mm % 10 === 0;
      const tickH = isFive ? 56 : (isCm ? 38 : 22);
      g.lineWidth = isFive ? 4 : 2;
      g.beginPath(); g.moveTo(px, 20); g.lineTo(px, 20 + tickH); g.stroke();
      g.beginPath(); g.moveTo(px, s - 20); g.lineTo(px, s - 20 - tickH); g.stroke();
      if (isFive && mm > 0 && mm < 60) {
        g.fillText(String(mm / 2), px, 102);
      }
    }
  });

  const rulerMat = K.M(0xffffff, rulerTex, { roughness: 0.68, metalness: 0 });
  const brassMat = K.M(0xe5b84b, null, { roughness: 0.48, metalness: 0 });
  const pageMat = K.M(0xf8f0dc, K.tex('plaster', 2, 1), { roughness: 0.85, metalness: 0 });

  const runX = 8.0, riseY = 3.40, widthZ = 3.80;
  const slopeLen = Math.hypot(runX, riseY);
  const slopeAng = Math.atan2(riseY, runX);

  const rampDeck = new THREE.Mesh(new THREE.BoxGeometry(slopeLen + 0.35, 0.14, widthZ), rulerMat);
  rampDeck.position.set(0, riseY * 0.5 - 0.05, 0);
  rampDeck.rotation.z = slopeAng;
  rampDeck.castShadow = true;
  rampDeck.receiveShadow = true;
  rampDeck.userData.ground = true;
  rampDeck.userData.keep = true;
  rampDeck.userData.paint = new THREE.Color(0xebbd52);
  K.root.add(rampDeck);

  // Brass ferrule end-caps on the giant wooden ruler
  for (const sx of [-1, 1]) {
    const cap = K.rbox(0.22, 0.18, widthZ + 0.08, 0.03, brassMat);
    cap.position.set(sx * (runX * 0.5), sx < 0 ? 0.02 : riseY - 0.02, 0);
    cap.rotation.z = slopeAng;
    K.root.add(cap);
  }

  // Stacked Giant Clothbound Botanical Hardcover Books propping up the ruler from underneath!
  // Every book's uphill & downhill top edge stays strictly beneath `y_under(x - w/2)` so zero corners poke through!
  const bookStacks = [
    { x: -0.55, y: 0.34, w: 2.15, h: 0.68, d: 3.45, rotY: 0.05, col: 0x3b6e4c },
    { x: 1.65, y: 0.41, w: 2.35, h: 0.82, d: 3.55, rotY: -0.04, col: 0x8f3438 },
    { x: 1.75, y: 1.19, w: 2.05, h: 0.74, d: 3.35, rotY: 0.06, col: 0x355c8c },
    { x: 3.05, y: 0.45, w: 1.85, h: 0.90, d: 3.30, rotY: 0.03, col: 0x5c4332 },
    { x: 3.05, y: 1.32, w: 1.80, h: 0.84, d: 3.25, rotY: -0.05, col: 0xc98a38 },
    { x: 3.10, y: 2.04, w: 1.65, h: 0.60, d: 3.18, rotY: 0.04, col: 0x7b3b52 },
  ];
  for (const bk of bookStacks) {
    const coverMat = K.M(bk.col, K.tex('burlap', 1.5, 1.5), { roughness: 0.78, metalness: 0 });
    const bg = new THREE.Group();
    bg.position.set(bk.x, bk.y, 0);
    bg.rotation.y = bk.rotY;
    K.root.add(bg);
    K.add(K.rbox(bk.w, bk.h, bk.d, 0.04, coverMat), 0, 0, 0, 0, 0, 0, bg);
    K.add(K.rbox(bk.w - 0.16, bk.h - 0.14, bk.d - 0.14, 0.02, pageMat), 0.06, 0, 0, 0, 0, 0, bg);
    K.add(K.rbox(0.08, bk.h - 0.12, 0.85, 0.02, brassMat), -bk.w * 0.5 + 0.02, 0, 0, 0, 0, 0, bg);
  }

  // 2 Low Standable Pocket-Field-Guide Books beside the ramp foot (`z = +2.55`, completely outside ramp deck!)
  K.add(K.rbox(1.55, 0.48, 1.18, 0.04, K.M(0x497856, K.tex('burlap', 1, 1))), -3.15, 0.24, 2.58, 0, 0.12, 0);
  K.add(K.rbox(1.38, 0.42, 1.05, 0.04, K.M(0xb84a3e, K.tex('burlap', 1, 1))), -3.10, 0.69, 2.58, 0, -0.08, 0);

  K.finalize();
  K.root.userData.ground = true;
  // Standable book step beside ramp foot (`y1 = 0.90 <= 1.68` -> standable = true!), zero blockers on ramp itself!
  K.root.userData.colliders = [
    { x: -3.12, z: 2.58, w: 1.52, d: 1.15, y0: 0, y1: 0.90 },
  ];
  return tagPaintMeshes(K.root);
}

// 8. HIGH CONSERVATORY BRICK & JAM-JAR SHELF (`highConservatoryShelf`, placed at y = 8.40m!)
export function buildHighConservatoryShelf(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'highConservatoryShelf', 149);
  const T = getTinyfolkTextures(THREE);

  const shelfWood = K.M(0xc48e54, K.tex('wood_light', 3.0, 1.6), { roughness: 0.82, metalness: 0 });
  const brickMat = K.M(0xe69574, T.brick, { roughness: 0.86, metalness: 0 });
  const bracketMat = K.M(0x6e8578, K.tex('painted_metal', 1.2, 1.2), { roughness: 0.62, metalness: 0 });
  const glassJar = K.M(0xeaf8ff, null, { roughness: 0.14, metalness: 0, transparent: true, opacity: 0.50 });
  const apricotGlow = K.glowMat(0xffd268, 0xf29024, 1.65);
  const berryGlow = K.M(0xd93b44, null, { roughness: 0.45, metalness: 0 });
  const gingham = K.M(0xffffff, T.gingham, { metalness: 0 });
  const twineMat = K.M(0xcfa56a, K.tex('burlap', 2, 2), { metalness: 0 });

  // Broad 14.0m x 6.0m plank shelf (top surface at local y = 0.0 -> world y = 8.40m!)
  const deck = K.rbox(14.0, 0.28, 6.0, 0.05, shelfWood);
  deck.position.set(0, -0.14, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.userData.ground = true;
  deck.userData.keep = true;
  deck.userData.paint = new THREE.Color(0xc48e54);
  K.root.add(deck);

  // 3 Conservatory mossy brick corbels & painted sage-green iron brackets underneath shelf
  for (const bx of [-5.2, 0, 5.2]) {
    K.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.65, 1.25), brickMat), bx, -1.60, -2.25);
    const brace = K.rbox(0.24, 0.24, 4.4, 0.03, bracketMat);
    brace.position.set(bx, -1.25, -0.45);
    brace.rotation.x = 0.48;
    K.root.add(brace);
  }

  // Giant Glowing Apricot & Strawberry Preserve Jam Jars along back edge (z = -2.05)
  const jars = [
    { x: -4.4, z: -2.02, mat: apricotGlow, r: 0.82, h: 1.95 },
    { x: 4.5, z: -2.02, mat: berryGlow, r: 0.78, h: 1.82 },
  ];
  const cols = [];
  for (const j of jars) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(j.r * 0.88, j.r * 0.88, j.h * 0.78, 18), j.mat), j.x, j.h * 0.42, j.z);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(j.r, j.r, j.h, 20), glassJar), j.x, j.h * 0.50, j.z);
    // Frilled gingham cloth jar bonnet & twine tie
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(j.r * 0.92, j.r * 1.08, 0.34, 18), gingham), j.x, j.h + 0.10, j.z);
    K.add(new THREE.Mesh(new THREE.TorusGeometry(j.r * 0.94, 0.06, 8, 18), twineMat), j.x, j.h - 0.02, j.z, PI / 2, 0, 0);
    cols.push({ x: j.x, z: j.z, w: j.r * 1.95, d: j.r * 1.95, y0: 0, y1: j.h + 0.28, noJump: true });
  }

  // Giant Botanical Seed-Packet Billboard Frames leaning against conservatory wall (z = -2.65)
  const seedTexs = [T.stampClover, T.stampRose, T.stampButterfly];
  for (let i = 0; i < 3; i++) {
    K.add(K.rbox(1.65, 2.15, 0.12, 0.03, K.M(0xffffff, seedTexs[i], { metalness: 0 })), -1.9 + i * 1.9, 1.08, -2.62, -0.08, 0, 0);
  }

  // 2 Standable Giant Twine Spools on the shelf (`y1 = 0.84 <= 1.68` -> standable = true!)
  addThreadSpool(THREE, K, -2.15, 0.0, -1.65, 0.56, 0.84, shelfWood, twineMat);
  addThreadSpool(THREE, K, 2.25, 0.0, -1.65, 0.56, 0.84, shelfWood, K.M(0x4b87c2, K.tex('burlap', 2, 2)));
  cols.push({ x: -2.15, z: -1.65, w: 1.08, d: 1.08, y0: 0, y1: 0.84 });
  cols.push({ x: 2.25, z: -1.65, w: 1.08, d: 1.08, y0: 0, y1: 0.84 });

  addMossAndDaisies(THREE, K, [
    [-6.2, 0.04, -2.2, 0.55, true], [6.2, 0.04, -2.2, 0.55, true], [0, 0.04, -2.4, 0.48, true],
  ]);

  K.finalize();
  K.root.userData.ground = true;
  K.root.userData.colliders = cols;
  return tagPaintMeshes(K.root);
}

// 9. WALKABLE MOSSY TWIG & BUTTON BRIDGE (`mossyTwigBridge`, userData.ground = true!)
export function buildMossyTwigBridge(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'mossyTwigBridge', 157);

  const twigMat = K.M(0x885c38, K.tex('bark', 1.4, 2.2), { roughness: 0.86, metalness: 0 });
  const plankMat = K.M(0xc49058, K.tex('wood_light', 1.8, 1.8), { roughness: 0.82, metalness: 0 });
  const mossMat = K.M(0x69a642, K.tex('leaves', 1.6, 1.6), { roughness: 0.88, metalness: 0 });
  const btnMat = K.M(0xf3e2c2, K.tex('wood_light', 1, 1), { roughness: 0.72, metalness: 0 });

  // Broad walkable arched mossy-plank bridge deck spanning z ∈ [-2.75, +2.75], width = 2.85m
  const deckMesh = K.rbox(2.85, 0.11, 5.5, 0.04, plankMat);
  deckMesh.position.set(0, 0.07, 0);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  deckMesh.userData.ground = true;
  deckMesh.userData.keep = true;
  deckMesh.userData.paint = new THREE.Color(0xc49058);
  K.root.add(deckMesh);

  // Lashed side birch-twig logs & decorative 4-hole buttons along curbs
  for (const sx of [-1, 1]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 5.6, 10), twigMat), sx * 1.38, 0.16, 0, PI / 2, 0, 0);
  }
  for (const bz of [-1.8, -0.6, 0.6, 1.8]) {
    addButtonDisc(THREE, K, (bz > 0 ? 0.65 : -0.65), 0.125, bz, 0.34, 0.04, btnMat, twigMat, null);
  }
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.05, 12), mossMat), -0.95, 0.13, -0.9);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.05, 12), mossMat), 0.95, 0.13, 1.0);

  K.finalize();
  K.root.userData.ground = true;
  K.root.userData.colliders = [];
  return tagPaintMeshes(K.root);
}

// 10. HOLLOW GIANT PORCELAIN TEACUP (`hollowGiantTeacup` — 8 octagonal `standable` rim colliders!)
export function buildHollowGiantTeacup(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'hollowGiantTeacup', 163);
  const T = getTinyfolkTextures(THREE);

  const porcOut = K.M(0xffffff, T.rosePorcelain, { roughness: 0.36, metalness: 0 });
  const porcIn = K.M(0xfcf5e6, null, { roughness: 0.42, metalness: 0 });
  const goldRim = K.M(0xe5b84b, null, { roughness: 0.46, metalness: 0 });
  const teaAmber = K.M(0xd9963b, null, { roughness: 0.20, metalness: 0, transparent: true, opacity: 0.80 });

  // Scalloped porcelain saucer underneath (`y <= 0.10m` so players step right up to cup rim)
  const saucerProf = [[0, 0.0], [1.25, 0.02], [1.92, 0.11], [1.96, 0.13], [1.20, 0.05], [0, 0.04]];
  K.add(new THREE.Mesh(new THREE.LatheGeometry(saucerProf.map(([r, y]) => new THREE.Vector2(r, y)), 28), porcOut));

  // Hollow double-walled giant porcelain teacup (`inner r = 1.14m`, `outer r = 1.32m`, `rim y = 1.06m`)
  const cupOuter = [[0.78, 0.06], [1.06, 0.34], [1.26, 0.72], [1.34, 1.06]];
  const cupInner = [[0.70, 0.14], [0.96, 0.38], [1.14, 0.74], [1.20, 1.06]];
  K.add(new THREE.Mesh(new THREE.LatheGeometry(cupOuter.map(([r, y]) => new THREE.Vector2(r, y)), 28), porcOut));
  K.add(new THREE.Mesh(K.flipGeo(new THREE.LatheGeometry(cupInner.map(([r, y]) => new THREE.Vector2(r, y)), 28)), porcIn));
  K.add(new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), porcIn), 0, 0.14, 0, -PI / 2, 0, 0);
  // Shallow warm golden chamomile tea pool inside bottom of cup (`y = 0.24m`)
  K.add(new THREE.Mesh(new THREE.CircleGeometry(0.80, 24), teaAmber), 0, 0.24, 0, -PI / 2, 0, 0);
  // Hand-painted diffuse gold lip rim (`y = 1.06m`)
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.075, 10, 28), goldRim), 0, 1.05, 0, PI / 2, 0, 0);

  // Curved porcelain teacup ear-handle on +X
  const hCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.28, 0.88, 0),
    new THREE.Vector3(1.82, 0.92, 0),
    new THREE.Vector3(1.76, 0.42, 0),
    new THREE.Vector3(1.06, 0.32, 0),
  ]);
  K.add(new THREE.Mesh(new THREE.TubeGeometry(hCurve, 16, 0.10, 10, false), porcOut));

  // 8 Octagonal Standable Rim Colliders (`y0: 0, y1: 1.06 <= 1.68` -> `standable: true`! Seekers jump onto rim!)
  const rimCols = [];
  const rMid = 1.24;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    rimCols.push({
      x: Math.sin(a) * rMid,
      z: Math.cos(a) * rMid,
      w: 1.04,
      d: 0.28,
      rot: -a,
      y0: 0,
      y1: 1.06,
    });
  }

  K.finalize();
  K.root.userData.colliders = rimCols;
  return tagPaintMeshes(K.root);
}

// 11. HOLLOW GIANT TERRACOTTA FLOWERPOT (`hollowTerracottaPot` — 8 octagonal `standable` rim colliders!)
export function buildHollowTerracottaPot(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'hollowTerracottaPot', 173);
  const T = getTinyfolkTextures(THREE);

  const potOut = K.M(0xffffff, T.crackedPot, { roughness: 0.86, metalness: 0 });
  const potIn = K.M(0x9e4f2c, K.tex('terracotta', 1.4, 1.4), { roughness: 0.9, metalness: 0 });
  const soilMat = K.M(0x583c26, K.tex('bark', 2, 2), { roughness: 0.95, metalness: 0 });
  const mossMat = K.M(0x68a440, K.tex('leaves', 1.6, 1.6), { roughness: 0.9, metalness: 0 });

  const outerP = [[0.92, 0.0], [1.24, 0.86], [1.34, 0.88], [1.36, 1.08]];
  const innerP = [[0.82, 0.22], [1.10, 0.86], [1.18, 1.08]];
  K.add(new THREE.Mesh(new THREE.LatheGeometry(outerP.map(([r, y]) => new THREE.Vector2(r, y)), 26), potOut));
  K.add(new THREE.Mesh(K.flipGeo(new THREE.LatheGeometry(innerP.map(([r, y]) => new THREE.Vector2(r, y)), 26)), potIn));
  K.add(new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.10, 10, 26), potIn), 0, 0.98, 0, PI / 2, 0, 0);
  // Potting soil & soft emerald moss cushion inside pot (`y = 0.24m`)
  K.add(new THREE.Mesh(new THREE.CircleGeometry(0.88, 22), soilMat), 0, 0.24, 0, -PI / 2, 0, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.08, 14), mossMat), -0.15, 0.26, 0.12);
  addMossAndDaisies(THREE, K, [[1.22, 0.12, 0.45, 0.42, true], [-1.18, 0.12, -0.35, 0.38, true]]);

  const rimCols = [];
  const rMid = 1.24;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    rimCols.push({
      x: Math.sin(a) * rMid,
      z: Math.cos(a) * rMid,
      w: 1.04,
      d: 0.28,
      rot: -a,
      y0: 0,
      y1: 1.08,
    });
  }

  K.finalize();
  K.root.userData.colliders = rimCols;
  return tagPaintMeshes(K.root);
}

// 12. BOUNCY RED AMANITA MUSHROOM PAD (`bouncyAmanitaPad` — squashes & launches players with clover-glide!)
export function buildBouncyAmanitaPad(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'bouncyAmanitaPad', 181);
  const T = getTinyfolkTextures(THREE);
  const R = opts.radius || 1.52;

  const capMat = K.M(0xffffff, T.amanitaCap, { roughness: 0.58, metalness: 0 });
  const gillMat = K.M(0xffffff, T.gills, { roughness: 0.88, metalness: 0 });
  const stemMat = K.M(0xfaf0d8, K.tex('plaster', 1.2, 1.6), { roughness: 0.82, metalness: 0 });
  const mossMat = K.M(0x6ea844, K.tex('leaves', 1.5, 1.5), { roughness: 0.9, metalness: 0 });
  const glowSpot = K.glowMat(0xfff6d2, 0xffbe58, 1.35);

  // Mossy fairy-ring cushion + sturdy cream mushroom stalk
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.68, R * 0.82, 0.10, 18), mossMat), 0, 0.05, 0);
  K.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.28, R * 0.38, 0.52, 16), stemMat), 0, 0.28, 0);

  // Unmerged `amanitaCap` group so `map.js` squashes & springs the cap on bounce!
  const capGroup = new THREE.Group();
  capGroup.name = 'amanitaCap';
  capGroup.position.set(0, 0.48, 0);
  capGroup.userData.keep = true;
  K.root.add(capGroup);

  const H = R * 0.42;
  const capProf = [
    [0, H], [R * 0.45, H * 0.94], [R * 0.82, H * 0.64], [R, H * 0.20], [R * 0.95, 0], [R * 0.25, 0.05],
  ];
  const capMesh = new THREE.Mesh(new THREE.LatheGeometry(capProf.map(([r, y]) => new THREE.Vector2(r, y)), 28), capMat);
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  capMesh.userData.ground = true;
  capMesh.userData.keep = true;
  capMesh.userData.paint = new THREE.Color(0xd9382e);
  capGroup.add(capMesh);

  const gillMesh = new THREE.Mesh(new THREE.CircleGeometry(R * 0.92, 22), gillMat);
  gillMesh.rotation.x = PI / 2;
  gillMesh.position.y = 0.02;
  gillMesh.userData.keep = true;
  capGroup.add(gillMesh);

  // Glowing cream velum warts across the scarlet Amanita cap!
  for (let w = 0; w < 14; w++) {
    const a = (w / 14) * PI * 2 + (w % 3) * 0.25;
    const rr = R * (0.20 + (w % 4) * 0.19);
    const wy = H * (1 - (rr / R) ** 1.65) + 0.02;
    const wart = new THREE.Mesh(new THREE.SphereGeometry(R * 0.085, 8, 6), glowSpot);
    wart.position.set(Math.cos(a) * rr, wy, Math.sin(a) * rr);
    wart.scale.set(1, 0.55, 1);
    wart.userData.keep = true;
    capGroup.add(wart);
  }

  K.finalize([capGroup]);
  K.root.userData.ground = true;
  K.root.userData.colliders = [];
  return tagPaintMeshes(K.root);
}

// 13. OVERHEAD CLOTHESPIN TWINE LINE (`clothespinTwineLine` — hanging vertical clothespins at y = 1.75m!)
export function buildClothespinTwineLine(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'clothespinTwineLine', 191);
  const T = getTinyfolkTextures(THREE);

  const twigMat = K.M(0x7d5332, K.tex('bark', 1.4, 2.2), { roughness: 0.88, metalness: 0 });
  const woodPin = K.M(0xdca86a, K.tex('wood_light', 1.2, 2.0), { roughness: 0.78, metalness: 0 });
  const silverSpring = K.M(0xb8c8d8, null, { roughness: 0.46, metalness: 0 });
  const twineMat = K.M(0xcfa56a, K.tex('burlap', 2, 2), { roughness: 0.85, metalness: 0 });
  const clothMat = K.M(0xffffff, T.gingham, { roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  const glow = K.glowMat(0xffeab0, 0xffb23e, 1.6);

  // Two forked hazel-twig clothesline posts at x = ±2.55m (5.1m clear walk span underneath!)
  for (const sx of [-1, 1]) {
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 2.85, 10), twigMat), sx * 2.55, 1.42, 0);
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.52, 8), twigMat), sx * 2.42, 2.75, 0, 0, 0, sx * 0.42);
    addHangingLantern(THREE, K, sx * 2.25, 2.45, 0.16, twigMat, glow, K.root, 0.68);
  }

  // Overhead catenary jute twine line (`y ~ 2.48m` in center)
  const lineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.55, 2.66, 0),
    new THREE.Vector3(-1.25, 2.52, 0),
    new THREE.Vector3(0, 2.46, 0),
    new THREE.Vector3(1.25, 2.52, 0),
    new THREE.Vector3(2.55, 2.66, 0),
  ]);
  K.add(new THREE.Mesh(new THREE.TubeGeometry(lineCurve, 22, 0.04, 7, false), twineMat));

  // 3 Giant Vertical Wooden Spring Clothespins clipped onto the overhead twine (`y = 1.75..2.52m`)!
  for (const [px, py] of [[-1.18, 2.52], [0.0, 2.46], [1.18, 2.52]]) {
    const pg = new THREE.Group();
    pg.position.set(px, py - 0.36, 0);
    K.root.add(pg);
    for (const sz of [-1, 1]) {
      K.add(K.rbox(0.18, 0.86, 0.08, 0.025, woodPin), 0, 0, sz * 0.055, sz * 0.03, 0, 0, pg);
    }
    K.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 10), silverSpring), 0, 0.06, 0, 0, 0, PI / 2, pg);
  }
  // Tiny Tinyfolk gingham handkerchief & button drying on the side pin (`x = -1.18`)
  K.add(K.rbox(0.68, 0.64, 0.025, 0.01, clothMat), -1.18, 1.56, 0, 0.06, 0, 0.04);

  K.finalize();
  // Colliders ONLY on the two outer twig posts at x = ±2.55 so players stand cleanly at (0, 0) underneath!
  K.root.userData.colliders = [
    { x: -2.55, z: 0, w: 0.42, d: 0.42, y0: 0, y1: 2.9, noJump: true },
    { x: 2.55, z: 0, w: 0.42, d: 0.42, y0: 0, y1: 2.9, noJump: true },
  ];
  return tagPaintMeshes(K.root);
}

// ============================================================================
// Factory Export (`buildBuildings(THREE)`)
// ============================================================================
export function buildBuildings(THREE) {
  const wrap = (fn) => (a, b) => (a && a.Scene ? fn(a, b || {}) : fn(THREE, a || {}));
  const out = {
    // First 6 keys match `buildings_sheet.png` & `interiors_sheet.png` 3x2 gallery layout!
    biscuit_tin_house: wrap(buildBiscuitTinHouse),
    teacup_conservatory: wrap(buildTeacupConservatory),
    oak_mushroom_lodge: wrap(buildOakMushroomLodge),
    sewing_watch_workshop: wrap(buildSewingWatchWorkshop),
    flowerpot_greenhouse: wrap(buildFlowerpotGreenhouse),
    faucetShellPond: wrap(buildFaucetShellPond),
    // Additional landmarks & macro verticality / interactive structures
    trowelBridge: wrap(buildTrowelBridge),
    mossyTwigBridge: wrap(buildMossyTwigBridge),
    buttonLeafStall: wrap(buildButtonLeafStall),
    clothespinFence: wrap(buildClothespinFence),
    mossGuardianStatue: wrap(buildMossGuardianStatue),
    pottingBenchTerrace: wrap(buildPottingBenchTerrace),
    rulerBookRamp: wrap(buildRulerBookRamp),
    highConservatoryShelf: wrap(buildHighConservatoryShelf),
    hollowGiantTeacup: wrap(buildHollowGiantTeacup),
    hollowTerracottaPot: wrap(buildHollowTerracottaPot),
    bouncyAmanitaPad: wrap(buildBouncyAmanitaPad),
    clothespinTwineLine: wrap(buildClothespinTwineLine),
    buildCenterpiece: wrap(buildFaucetShellPond),
    buildStall: wrap(buildButtonLeafStall),
  };
  return out;
}
