/* Hue & Seek — Map 5: Tinyfolk Secret Hollow (`tinyfolk`) — 12 Hideable Storybook Props
 * Original tiny-folk garden designs (assets/maps/tinyfolk/props_sheet.png).
 * Built with createPropBuilder(THREE, 505), <= 8 draw calls per prop, origin at ground center y = 0.
 */
import {
  createPropBuilder,
  paintedCanvasTex,
  brushStrokes,
  mergeGeometries,
} from '../map_kit.js?v=2';
import { attachCreatureKinematics } from '../world_interactives.js?v=v10';

const PI = Math.PI;
const TAU = PI * 2;

export const PROPS = [
  { id: 'bw_thimble_stool', label: 'Thimble Pincushion', icon: '🧵', radius: 0.34, height: 0.80 },
  { id: 'bw_spool_table', label: 'Thread-Spool Table', icon: '🪡', radius: 0.48, height: 0.78 },
  { id: 'bw_matchbox_bed', label: 'Matchbox Bed', icon: '🛏️', radius: 0.56, height: 0.64 },
  { id: 'bw_acorn_lantern', label: 'Acorn Firefly Lamp', icon: '🌰', radius: 0.33, height: 1.18 },
  { id: 'bw_inkwell_pot', label: 'Snowdrop Inkwell', icon: '🖋️', radius: 0.42, height: 0.98 },
  { id: 'bw_sugar_crate', label: 'Sugar-Cube Bundle', icon: '🧊', radius: 0.46, height: 0.78 },
  { id: 'bw_pocket_watch', label: 'Gold Pocket Watch', icon: '⏱️', radius: 0.48, height: 0.96 },
  { id: 'bw_mushroom_cluster', label: 'Amanita Cluster', icon: '🍄', radius: 0.52, height: 0.96 },
  { id: 'bw_teacup_planter', label: 'Teacup Clover Pot', icon: '🍵', radius: 0.48, height: 0.84 },
  { id: 'bw_button_stack', label: 'Button Stack', icon: '🔘', radius: 0.35, height: 0.76 },
  { id: 'bw_bottle_cap_chair', label: 'Bottle-Cap Chair', icon: '🪑', radius: 0.48, height: 0.88 },
  { id: 'bw_strawberry_basket', label: 'Giant Strawberry', icon: '🍓', radius: 0.48, height: 0.86 },
  { id: 'bw_bumblebee', label: 'Fluffy Bumblebee', icon: '🐝', radius: 0.31, height: 0.72, isAnimal: true, canFly: true, flyMaxY: 16.0, flapIntervalMs: 210, flapPitch: 1.85 },
  { id: 'bw_dragonfly', label: 'Jewel Dragonfly', icon: '🪰', radius: 0.33, height: 0.68, isAnimal: true, canFly: true, flyMaxY: 16.0, flapIntervalMs: 230, flapPitch: 1.55 },
  { id: 'bw_ladybug', label: 'Garden Ladybug', icon: '🐞', radius: 0.32, height: 0.56, isAnimal: true },
];

export const PROP_ICONS = Object.fromEntries(PROPS.map((p) => [p.id, p.icon]));

// Planar UV helpers so custom painted Storybook illustrations map cleanly onto sculpted cushions, dials & shells
function projectTopUV(geo, halfX, halfZ) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv || new pos.constructor(new Float32Array(pos.count * 2), 2);
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(0.995, Math.max(0.005, pos.getX(i) / (halfX * 2) + 0.5));
    const v = Math.min(0.995, Math.max(0.005, 0.5 - pos.getZ(i) / (halfZ * 2)));
    uv.setXY(i, u, v);
  }
  geo.setAttribute('uv', uv);
  return geo;
}

function projectFrontUV(geo, halfX, halfY, cy = 0) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv || new pos.constructor(new Float32Array(pos.count * 2), 2);
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(0.995, Math.max(0.005, pos.getX(i) / (halfX * 2) + 0.5));
    const v = Math.min(0.995, Math.max(0.005, (pos.getY(i) - cy) / (halfY * 2) + 0.5));
    uv.setXY(i, u, v);
  }
  geo.setAttribute('uv', uv);
  return geo;
}

// Plump pillow / mattress deformer
function makePillowGeo(THREE, w, h, d, pinch = 0.18, segX = 14, segZ = 12) {
  const g = new THREE.BoxGeometry(w, h, d, segX, 4, segZ);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.max(-1, Math.min(1, p.getX(i) / (w / 2)));
    const nz = Math.max(-1, Math.min(1, p.getZ(i) / (d / 2)));
    const env = pinch + (1 - pinch) * Math.pow(Math.max(0, (1 - nx * nx) * (1 - nz * nz)), 0.52);
    p.setY(i, p.getY(i) * env);
    p.setX(i, p.getX(i) * (1 + 0.055 * (1 - nz * nz)));
    p.setZ(i, p.getZ(i) * (1 + 0.055 * (1 - nx * nx)));
  }
  g.computeVertexNormals();
  return g;
}

// Sculpted heart-shaped clover leaflet or pointed botanical leaf
function makeLeafGeo(THREE, len, halfW, thick, heartNotch = 0, curl = 0.08, cup = 0.16) {
  const g = new THREE.SphereGeometry(1, 10, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = Math.max(0, Math.min(1, (y + 1) * 0.5)); // 0 at stem base -> 1 at tip (clamped so pow never NaNs!)
    const env = Math.sqrt(Math.max(0, 1 - y * y));
    const ux = env > 1e-5 ? x / env : 0;
    const uz = env > 1e-5 ? z / env : 0;
    let widthProfile = Math.pow(s, 0.55) * Math.pow(Math.max(0, 1 - s), heartNotch > 0 ? 0.35 : 0.85) * 1.85;
    if (heartNotch > 0) widthProfile = Math.sin(Math.min(1, s * 1.05) * PI * 0.86) * (0.45 + 0.65 * s);
    let lenOut = s * len;
    if (heartNotch > 0 && s > 0.62) {
      const centerDip = Math.max(0, 1 - Math.abs(ux) * 2.1);
      lenOut -= centerDip * heartNotch * len * Math.pow((s - 0.62) / 0.38, 1.3);
    }
    const wx = ux * widthProfile * halfW;
    const wy = uz * Math.sin(s * PI) * thick + cup * Math.abs(ux) * halfW * 0.45 - curl * s * s * len;
    p.setXYZ(i, wx, wy, lenOut);
  }
  g.computeVertexNormals();
  return g;
}

// 4-hole chunky coat button with raised rim lip and recessed center dish
function makeButtonGeo(THREE, R, H, seg = 28) {
  const pts = [
    [0, 0],
    [R * 0.9, 0],
    [R, H * 0.24],
    [R, H * 0.78],
    [R * 0.88, H],
    [R * 0.72, H],
    [R * 0.65, H * 0.74],
    [0, H * 0.72],
  ];
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export function buildMapProps(THREE) {
  const PB = createPropBuilder(THREE, 505);
  const { mat, buildMergedProto, add, rbox, lathe, tube } = PB;

  // Custom painted material cache scoped to THREE
  const paintedMats = new Map();
  function cMat(key, size, drawFn, extra = {}, rx = 1, ry = 1) {
    if (!paintedMats.has(key)) {
      const map = paintedCanvasTex(THREE, `bw_prop_${key}`, size, drawFn, rx, ry);
      paintedMats.set(key, new THREE.MeshStandardMaterial(Object.assign({
        color: 0xffffff,
        map,
        roughness: 0.86,
        metalness: 0,
      }, extra)));
    }
    return paintedMats.get(key);
  }

  // ---------------- Shared Hand-Painted Textures ----------------
  const mThimbleBrass = cMat('thimble_brass', 256, (g, s, rng) => {
    const grd = g.createLinearGradient(0, s, 0, 0);
    grd.addColorStop(0, '#9e7222');
    grd.addColorStop(0.45, '#cfa03c');
    grd.addColorStop(0.85, '#be8f30');
    grd.addColorStop(1, '#8c621c');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 180, ['#dab04e', '#8f651e', '#e5c166'], 1.5, 4, 0.24, 0, 0.5, 28);
    // Upper dimpled honeycomb rows (Lathe V runs 0 at bottom -> 1 at top; canvas Y=0 is top)
    for (let row = 0; row < 7; row++) {
      const y = s * (0.12 + row * 0.062);
      const cols = 22;
      for (let c = 0; c < cols; c++) {
        const x = ((c + (row % 2) * 0.5) / cols) * s;
        g.fillStyle = 'rgba(58,36,8,0.62)';
        g.beginPath(); g.arc(x, y, 4.1, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,228,142,0.5)';
        g.beginPath(); g.arc(x + 1, y + 1.3, 2.2, 0, TAU); g.fill();
      }
    }
    // Lower embossed floral vine band
    g.strokeStyle = '#6c4910';
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const cx = (i + 0.5) * (s / 4), cy = s * 0.73;
      g.strokeStyle = '#f2cc72';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(cx - 28, cy + 12);
      g.quadraticCurveTo(cx - 12, cy - 14, cx, cy);
      g.quadraticCurveTo(cx + 12, cy + 14, cx + 28, cy - 10);
      g.stroke();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        g.fillStyle = '#5e3d0c';
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11 + 1.5, 6.5, 4.5, a, 0, TAU); g.fill();
        g.fillStyle = '#f0c766';
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 5.8, 3.8, a, 0, TAU); g.fill();
      }
      g.fillStyle = '#ffe394';
      g.beginPath(); g.arc(cx, cy, 4.5, 0, TAU); g.fill();
    }
  }, { roughness: 0.56, metalness: 0 });

  const mPatchworkDome = cMat('patchwork_dome', 512, (g, s, rng) => {
    const cx = s / 2, cy = s / 2, R = s * 0.52;
    const pals = ['#b62f2a', '#f4ead2', '#3c5e7e', '#e2a634', '#b62f2a', '#f4ead2', '#3c5e7e', '#e2a634'];
    for (let w = 0; w < 8; w++) {
      const a0 = (w / 8) * TAU, a1 = ((w + 1) / 8) * TAU;
      g.save();
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, a0, a1);
      g.closePath();
      g.clip();
      g.fillStyle = pals[w];
      g.fillRect(0, 0, s, s);
      if (w % 4 === 2) {
        // Blue gingham check
        g.fillStyle = 'rgba(242,232,208,0.48)';
        for (let k = 0; k < s; k += 18) {
          g.fillRect(k, 0, 9, s);
          g.fillRect(0, k, s, 9);
        }
      } else {
        // Lush Storybook chintz florals distributed right inside each patchwork wedge
        const fc = w % 4 === 0 ? '#f6e7c6' : w % 4 === 1 ? '#d4424a' : '#b8322a';
        const lc = w % 4 === 0 ? '#78a248' : '#58863b';
        for (let f = 0; f < 11; f++) {
          const ang = rng.jr(a0 + 0.08, a1 - 0.08);
          const rad = rng.jr(34, R - 26);
          const fx = cx + Math.cos(ang) * rad, fy = cy + Math.sin(ang) * rad;
          g.fillStyle = lc;
          g.beginPath(); g.ellipse(fx + 8, fy + 5, 8.5, 4.2, 0.5, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(fx - 8, fy - 5, 8.5, 4.2, -0.6, 0, TAU); g.fill();
          g.fillStyle = fc;
          for (let p = 0; p < 5; p++) {
            const pa = (p / 5) * TAU;
            g.beginPath(); g.arc(fx + Math.cos(pa) * 7.2, fy + Math.sin(pa) * 7.2, 4.8, 0, TAU); g.fill();
          }
          g.fillStyle = '#f5c542';
          g.beginPath(); g.arc(fx, fy, 3.4, 0, TAU); g.fill();
        }
      }
      g.restore();
    }
    // Seam shadows & cream whip-stitch dashes
    for (let w = 0; w < 8; w++) {
      const a = (w / 8) * TAU;
      g.strokeStyle = 'rgba(55,30,18,0.45)';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
      g.strokeStyle = '#f8eed5';
      g.lineWidth = 2.2;
      for (let r = 18; r < R - 10; r += 13) {
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        const nx = -Math.sin(a) * 5.5, ny = Math.cos(a) * 5.5;
        g.beginPath(); g.moveTo(px - nx, py - ny); g.lineTo(px + nx, py + ny); g.stroke();
      }
    }
  }, { roughness: 0.92 });

  const mMatchboxTop = cMat('matchbox_top', 256, (g, s, rng) => {
    g.fillStyle = '#eddcc0';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 150, ['#e4cfa8', '#f5e8cf', '#d7be94'], 2, 6, 0.3, 0.3, 1.5, 30);
    // Vintage double frame
    g.strokeStyle = '#586e3c'; g.lineWidth = 6; g.strokeRect(14, 14, s - 28, s - 28);
    g.strokeStyle = '#b63c34'; g.lineWidth = 2.5; g.strokeRect(23, 23, s - 46, s - 46);
    // Botanical stem & leaves
    const cx = s * 0.5, cy = s * 0.44;
    g.strokeStyle = '#4e6f34'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(cx - 18, s - 36); g.quadraticCurveTo(cx + 12, cy + 44, cx, cy); g.stroke();
    for (const [lx, ly, ang, sc] of [[cx - 32, cy + 42, -0.6, 1], [cx + 30, cy + 52, 0.65, 1], [cx - 42, cy + 12, -0.9, 0.85], [cx + 38, cy + 16, 0.8, 0.85]]) {
      g.fillStyle = '#5e833d';
      g.beginPath(); g.ellipse(lx, ly, 22 * sc, 9 * sc, ang, 0, TAU); g.fill();
    }
    // Crimson vintage blossom
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * TAU;
      g.fillStyle = p % 2 === 0 ? '#c43b38' : '#da564e';
      g.beginPath(); g.ellipse(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 19, 11, a, 0, TAU); g.fill();
    }
    g.fillStyle = '#f2c144';
    g.beginPath(); g.arc(cx, cy, 11, 0, TAU); g.fill();
  }, { roughness: 0.88 });

  const mStriker = cMat('matchbox_striker', 128, (g, s) => {
    g.fillStyle = '#68271e';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#ead2ac';
    g.lineWidth = 4;
    g.strokeRect(3, 3, s - 6, s - 6);
    g.fillStyle = '#dfbFA0';
    const step = 11;
    for (let row = 1; row < s / step - 0.5; row++) {
      for (let col = 1; col < s / step - 0.5; col++) {
        const x = col * step + (row % 2) * (step * 0.5);
        const y = row * step;
        if (x > 9 && x < s - 9 && y > 9 && y < s - 9) {
          g.beginPath(); g.arc(x, y, 2.7, 0, TAU); g.fill();
        }
      }
    }
  }, { roughness: 0.95 });

  const mStampQuilt = cMat('stamp_quilt', 512, (g, s) => {
    g.fillStyle = '#cbb899';
    g.fillRect(0, 0, s, s);
    const stamps = [
      { x: 18, y: 18, col: '#4a76ad', motif: 'queen' },
      { x: 266, y: 18, col: '#c44646', motif: 'castle' },
      { x: 18, y: 266, col: '#5c8440', motif: 'fern' },
      { x: 266, y: 266, col: '#8a59a4', motif: 'flower' },
    ];
    const sw = 228, sh = 228;
    for (const st of stamps) {
      g.fillStyle = '#f9f1de';
      g.fillRect(st.x, st.y, sw, sh);
      // Perforated stamp notches around edges
      g.fillStyle = '#b9a282';
      for (let k = 8; k <= sw - 8; k += 18) {
        g.beginPath(); g.arc(st.x + k, st.y, 5.2, 0, TAU); g.fill();
        g.beginPath(); g.arc(st.x + k, st.y + sh, 5.2, 0, TAU); g.fill();
        g.beginPath(); g.arc(st.x, st.y + k, 5.2, 0, TAU); g.fill();
        g.beginPath(); g.arc(st.x + sw, st.y + k, 5.2, 0, TAU); g.fill();
      }
      g.fillStyle = st.col;
      g.fillRect(st.x + 18, st.y + 18, sw - 36, sh - 36);
      g.strokeStyle = '#f9f1de';
      g.lineWidth = 3;
      g.strokeRect(st.x + 26, st.y + 26, sw - 52, sh - 52);
      const cx = st.x + sw / 2, cy = st.y + sh / 2;
      g.fillStyle = '#f9f1de';
      if (st.motif === 'queen') {
        g.beginPath(); g.arc(cx, cy - 14, 30, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(cx, cy + 38, 40, 26, 0, PI, TAU); g.fill();
      } else if (st.motif === 'castle') {
        g.fillRect(cx - 42, cy - 10, 84, 52);
        g.fillRect(cx - 46, cy - 34, 24, 28);
        g.fillRect(cx - 12, cy - 42, 24, 36);
        g.fillRect(cx + 22, cy - 34, 24, 28);
      } else if (st.motif === 'fern') {
        g.strokeStyle = '#f9f1de'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(cx - 20, cy + 46); g.quadraticCurveTo(cx + 8, cy, cx + 16, cy - 44); g.stroke();
        for (let l = -2; l <= 2; l++) {
          g.beginPath(); g.ellipse(cx - 16 + l * 4, cy + l * 14, 22, 9, -0.5, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(cx + 18 + l * 3, cy + l * 14, 22, 9, 0.5, 0, TAU); g.fill();
        }
      } else {
        for (let p = 0; p < 7; p++) {
          const a = (p / 7) * TAU;
          g.beginPath(); g.ellipse(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28, 20, 10, a, 0, TAU); g.fill();
        }
        g.fillStyle = '#f4cb4c';
        g.beginPath(); g.arc(cx, cy, 12, 0, TAU); g.fill();
      }
      // Postmark waves
      g.strokeStyle = 'rgba(42,30,22,0.42)';
      g.lineWidth = 2.4;
      g.beginPath(); g.arc(st.x + 54, st.y + 52, 22, 0, TAU); g.stroke();
    }
  }, { roughness: 0.9 });

  const mQuillFeather = cMat('quill_feather', 256, (g, s) => {
    const grd = g.createLinearGradient(0, s, 0, 0);
    grd.addColorStop(0, '#f8f0e0');
    grd.addColorStop(0.45, '#e8d4b8');
    grd.addColorStop(0.75, '#9d6b48');
    grd.addColorStop(1, '#583722');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    // Banded owl/hawk stripes & diagonal feather barbs
    for (let y = 18; y < s; y += 28) {
      g.fillStyle = 'rgba(82,48,28,0.34)';
      g.fillRect(0, y, s, 10);
    }
    g.strokeStyle = 'rgba(255,248,236,0.55)';
    g.lineWidth = 1.4;
    for (let y = 0; y < s; y += 5) {
      g.beginPath(); g.moveTo(s * 0.5, y + 14); g.lineTo(0, y); g.stroke();
      g.beginPath(); g.moveTo(s * 0.5, y + 14); g.lineTo(s, y); g.stroke();
    }
  }, { roughness: 0.82, side: THREE.DoubleSide });

  const mSugarCrystal = cMat('sugar_crystal', 256, (g, s, rng) => {
    g.fillStyle = '#f8f1e1';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 650; i++) {
      const x = rng.jr(0, s), y = rng.jr(0, s), w = rng.jr(5, 14);
      g.fillStyle = rng.pick(['#ffffff', '#fdf9ef', '#efe2c8', '#e6d4b2', '#fffdf8']);
      g.save();
      g.translate(x, y);
      g.rotate(rng.jr(0, PI));
      g.fillRect(-w / 2, -w / 2, w, w);
      g.strokeStyle = 'rgba(185,158,118,0.35)';
      g.lineWidth = 1;
      g.strokeRect(-w / 2, -w / 2, w, w);
      g.restore();
    }
  }, { roughness: 0.42, metalness: 0 });

  const mWatchDial = cMat('watch_dial', 512, (g, s) => {
    const cx = s / 2, cy = s / 2;
    const grd = g.createRadialGradient(cx, cy, 20, cx, cy, s * 0.48);
    grd.addColorStop(0, '#fcf6e6');
    grd.addColorStop(0.8, '#f3e5c4');
    grd.addColorStop(1, '#d8c298');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    // Minute track
    g.strokeStyle = '#221c16';
    g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, s * 0.44, 0, TAU); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, s * 0.405, 0, TAU); g.stroke();
    g.beginPath(); g.arc(cx, cy, s * 0.27, 0, TAU); g.stroke();
    for (let m = 0; m < 60; m++) {
      const a = (m / 60) * TAU - PI / 2;
      const r0 = m % 5 === 0 ? s * 0.398 : s * 0.408;
      g.lineWidth = m % 5 === 0 ? 3.5 : 1.6;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * (s * 0.44), cy + Math.sin(a) * (s * 0.44));
      g.stroke();
    }
    const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.fillStyle = '#1e1812';
    g.font = 'bold 36px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * TAU - PI / 2;
      const rx = cx + Math.cos(a) * (s * 0.338);
      const ry = cy + Math.sin(a) * (s * 0.338);
      g.save();
      g.translate(rx, ry);
      g.rotate(a + PI / 2);
      g.fillText(numerals[h], 0, 0);
      g.restore();
    }
  }, { roughness: 0.35 });

  const mPorcelainDelft = cMat('porcelain_delft', 512, (g, s, rng) => {
    g.fillStyle = '#f6eedc';
    g.fillRect(0, 0, s, s);
    // Fine porcelain craze lines
    g.strokeStyle = 'rgba(175,152,118,0.22)';
    g.lineWidth = 1.1;
    for (let i = 0; i < 65; i++) {
      let x = rng.jr(0, s), y = rng.jr(0, s);
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rng.jr(-38, 38); y += rng.jr(-38, 38); g.lineTo(x, y); }
      g.stroke();
    }
    // Delft cobalt blue roses & vines
    for (let b = 0; b < 4; b++) {
      const cx = (b + 0.5) * (s / 4), cy = s * 0.52;
      g.strokeStyle = '#3b64ab'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx - 48, cy + 32); g.quadraticCurveTo(cx, cy - 28, cx + 52, cy + 20); g.stroke();
      for (const [dx, dy, ang] of [[-34, 18, -0.5], [34, 12, 0.5], [-18, -24, -0.8], [26, -22, 0.7]]) {
        g.fillStyle = '#4e7bc2';
        g.beginPath(); g.ellipse(cx + dx, cy + dy, 18, 8, ang, 0, TAU); g.fill();
      }
      for (let r = 28; r >= 8; r -= 6) {
        g.fillStyle = r > 18 ? '#2b5299' : r > 12 ? '#4c79c4' : '#8cb2ea';
        for (let p = 0; p < 6; p++) {
          const a = (p / 6) * TAU + r * 0.1;
          g.beginPath(); g.arc(cx + Math.cos(a) * (r * 0.55), cy + Math.sin(a) * (r * 0.55), r * 0.48, 0, TAU); g.fill();
        }
      }
    }
    // Gold rim bands top & bottom
    g.fillStyle = '#e5b84b';
    g.fillRect(0, 0, s, 12);
    g.fillRect(0, s - 14, s, 14);
  }, { roughness: 0.36, metalness: 0 });

  const mPearlNacre = cMat('pearl_nacre', 256, (g, s, rng) => {
    const grd = g.createLinearGradient(0, 0, s, s);
    grd.addColorStop(0, '#f7efe6');
    grd.addColorStop(0.28, '#f2d4df');
    grd.addColorStop(0.54, '#d2edf2');
    grd.addColorStop(0.78, '#dfd4f4');
    grd.addColorStop(1, '#f8efd4');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 180, ['#ffffff', '#f8d8e6', '#d4f2f5', '#e5daf8'], 4, 14, 0.34, 0.65, 0.6, 65);
  }, { roughness: 0.36, metalness: 0 });

  const mCapFiligree = cMat('bottle_cap_filigree', 512, (g, s, rng) => {
    g.fillStyle = '#b42c25';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 200, ['#9c211b', '#c83a30', '#8f1e18'], 3, 9, 0.3, 0, PI, 40);
    // Ornate golden acanthus & vine arabesques
    const cx = s / 2, cy = s * 0.48;
    g.strokeStyle = '#e5b84b';
    g.fillStyle = '#e5b84b';
    g.lineWidth = 6;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx, cy + 75);
      g.bezierCurveTo(cx + sx * 18, cy - 10, cx + sx * 125, cy - 85, cx + sx * 150, cy + 10);
      g.stroke();
      for (const [dx, dy, ang, sc] of [[32, -28, 0.5, 1.1], [74, -56, 0.9, 1], [116, -34, 1.3, 0.9], [52, 24, 0.7, 0.95], [98, 34, 1.1, 0.85]]) {
        g.beginPath(); g.ellipse(cx + sx * dx, cy + dy, 24 * sc, 10 * sc, sx * ang, 0, TAU); g.fill();
      }
    }
    // Central gold fleur-de-lis bud
    g.beginPath(); g.ellipse(cx, cy - 68, 14, 34, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(cx, cy + 72, 10, 0, TAU); g.fill();
  }, { roughness: 0.54, metalness: 0 });

  const mLeafCushion = cMat('leaf_cushion', 256, (g, s, rng) => {
    g.fillStyle = '#4e7f29';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 220, ['#5f9433', '#3e6a1f', '#72a83e'], 3, 8, 0.35, 0.5, 2, 34);
    g.strokeStyle = '#a9d162';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(16, s * 0.5); g.quadraticCurveTo(s * 0.5, s * 0.46, s - 16, s * 0.52); g.stroke();
    g.lineWidth = 3;
    for (let x = 44; x < s - 32; x += 36) {
      g.beginPath(); g.moveTo(x, s * 0.49); g.quadraticCurveTo(x + 18, s * 0.28, x + 36, 20); g.stroke();
      g.beginPath(); g.moveTo(x, s * 0.49); g.quadraticCurveTo(x + 18, s * 0.72, x + 36, s - 20); g.stroke();
    }
  }, { roughness: 0.88 });

  const mBerrySkin = cMat('berry_skin', 256, (g, s, rng) => {
    const grd = g.createLinearGradient(0, s, 0, 0);
    grd.addColorStop(0, '#a61418');
    grd.addColorStop(0.55, '#d62222');
    grd.addColorStop(0.92, '#ea3c2c');
    grd.addColorStop(1, '#f0623a');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 140, ['#be191c', '#e63329', '#991116'], 2, 6, 0.26, PI / 2, 0.5, 26);
  }, { roughness: 0.32, metalness: 0 });

  // ---------------- Standard Shared Materials (Storybook Diffuse, metalness: 0) ----------------
  const mBrass = mat('brass', 0xe5b84b, null, 1, { roughness: 0.54, metalness: 0 });
  const mGoldBright = mat('gold_bright', 0xefc65c, null, 1, { roughness: 0.48, metalness: 0 });
  const mCord = mat('cord', 0xd8b278, 'hay', 2, { roughness: 0.92, metalness: 0 });
  const mThreadRed = mat('thread_red', 0xb6242a, 'plaster', 2, { roughness: 0.88, metalness: 0 });
  const mWoodSpool = mat('wood_spool', 0xc9965c, 'wood_light', 1.4, { roughness: 0.86, metalness: 0 });
  const mVeneer = mat('veneer', 0xe8cfa4, 'wood_light', 1.2, { roughness: 0.88, metalness: 0 });
  const mCotton = mat('cotton', 0xf9f2e4, 'plaster', 1.6, { roughness: 0.94, metalness: 0 });
  const mCream = mat('cream', 0xf2e4c8, 'plaster', 1.2, { roughness: 0.72, metalness: 0 });
  const mDarkHole = mat('dark_hole', 0x261d18, null, 1, { roughness: 0.85, metalness: 0 });
  const mBark = mat('bark', 0x8e6340, 'bark', 1.5, { roughness: 0.95, metalness: 0 });
  const mAcornCap = mat('acorn_cap', 0x6e4728, 'bark', 2.2, { roughness: 0.90, metalness: 0 });
  const mMoss = mat('moss', 0x76a83c, 'leaves', 1.8, { roughness: 0.92, metalness: 0 });
  const mClover = mat('clover', 0x5da432, null, 1, { roughness: 0.76, metalness: 0 });
  const mBulbCore = mat('bulb_core', 0xfff3a8, null, 1, { emissive: 0xffb828, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0 });
  const mPetalAmber = mat('petal_amber', 0xffd262, null, 1, { emissive: 0xf59b1e, emissiveIntensity: 1.05, roughness: 0.38, metalness: 0 });
  const mIndigoInk = mat('indigo_ink', 0x283c92, null, 1, { roughness: 0.32, metalness: 0 });
  const mSnowWhite = mat('snow_white', 0xfbf9f4, null, 1, { roughness: 0.65, metalness: 0 });
  const mAmanitaRed = mat('amanita_red', 0xd63628, 'plaster', 1.2, { roughness: 0.72, metalness: 0 });
  const mMushroomCream = mat('mushroom_cream', 0xf4ebd8, 'plaster', 1.5, { roughness: 0.88, metalness: 0 });
  const mChanterelle = mat('chanterelle', 0xe89e28, 'plaster', 1.2, { roughness: 0.78, metalness: 0 });
  const mLichen = mat('lichen', 0xa2b690, 'plaster', 1.4, { roughness: 0.92, metalness: 0 });
  const mForgetBlue = mat('forget_blue', 0x6798f0, null, 1, { roughness: 0.68, metalness: 0 });
  const mSeedGold = mat('seed_gold', 0xf2c844, null, 1, { roughness: 0.55, metalness: 0 });
  const mBtnGreen = mat('btn_green', 0x5c7236, 'plaster', 1.2, { roughness: 0.52, metalness: 0 });
  const mBtnBlue = mat('btn_blue', 0x3b4e7c, 'plaster', 1.2, { roughness: 0.50, metalness: 0 });
  const mBtnRed = mat('btn_red', 0xb8382e, 'plaster', 1.2, { roughness: 0.48, metalness: 0 });
  const mGlassClear = new THREE.MeshStandardMaterial({
    color: 0xdff0ff,
    roughness: 0.16,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  // ==========================================================================
  // 1. bw_thimble_stool ('Thimble Pincushion', r:0.42, h:0.80)
  // ==========================================================================
  function buildThimbleStool(g) {
    // Tapered vintage brass thimble body with flared beaded base rim
    const body = lathe([
      [0, 0],
      [0.335, 0],
      [0.35, 0.024],
      [0.338, 0.048],
      [0.315, 0.06],
      [0.272, 0.49],
      [0.285, 0.515],
      [0.24, 0.52],
    ], 32);
    add(g, body, mThimbleBrass);

    // 3D beaded bottom collar + raised embossed brass floral reliefs around lower band
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      add(g, new THREE.SphereGeometry(0.018, 8, 6), mBrass, Math.cos(a) * 0.34, 0.025, Math.sin(a) * 0.34);
    }
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * TAU;
      const r = 0.304, y = 0.17;
      add(g, new THREE.SphereGeometry(0.022, 8, 6), mBrass, Math.cos(a) * r, y, Math.sin(a) * r, 0, -a, 0, 1, 1, 0.45);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * TAU;
        const dy = Math.sin(pa) * 0.042, da = (Math.cos(pa) * 0.042) / r;
        add(g, new THREE.SphereGeometry(0.018, 8, 6), mBrass, Math.cos(a + da) * (r - dy * 0.09), y + dy, Math.sin(a + da) * (r - dy * 0.09), 0, -(a + da), 0, 0.9, 0.9, 0.4);
      }
    }

    // Twisted rope cord collar under pincushion
    add(g, new THREE.TorusGeometry(0.296, 0.028, 8, 28), mCord, 0, 0.50, 0, PI / 2, 0, 0);

    // Plump 8-lobed floral patchwork pincushion dome hugging the cord rim (y = 0.47 .. 0.80)
    const dome = new THREE.SphereGeometry(0.39, 36, 20, 0, TAU, 0, PI * 0.62);
    const dp = dome.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i), y = dp.getY(i), z = dp.getZ(i);
      const ang = Math.atan2(z, x);
      const lobe = 1 - 0.042 * Math.pow(Math.abs(Math.cos(ang * 4)), 3) * (1 - y / 0.39);
      const puffR = 1 + 0.08 * Math.sin(Math.max(0, 1 - y / 0.39) * PI * 0.8);
      dp.setXYZ(i, x * lobe * puffR, y * 0.78, z * lobe * puffR);
    }
    dome.computeVertexNormals();
    projectTopUV(dome, 0.41, 0.41);
    add(g, dome, mPatchworkDome, 0, 0.485, 0);

    // 4 cute red yarn tassels hanging from the cord rim
    const tasselAngles = [0.42, 1.45, PI - 0.42, -0.58, -PI + 0.58];
    for (const a of tasselAngles) {
      const tx = Math.cos(a) * 0.322, tz = Math.sin(a) * 0.322;
      add(g, new THREE.SphereGeometry(0.025, 8, 6), mThreadRed, tx, 0.482, tz);
      add(g, new THREE.TorusGeometry(0.020, 0.006, 6, 12), mCord, tx, 0.464, tz, PI / 2, 0, 0);
      const skirt = lathe([[0, 0], [0.038, 0.008], [0.030, 0.06], [0.016, 0.095], [0, 0.10]], 12);
      add(g, skirt, mThreadRed, tx * 1.03, 0.368, tz * 1.03, Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1);
    }
  }

  // ==========================================================================
  // 2. bw_spool_table ('Thread-Spool Table', r:0.48, h:0.78)
  // ==========================================================================
  function buildSpoolTable(g) {
    // Bottom & top turned wooden spool flanges
    const botFlange = lathe([
      [0, 0], [0.37, 0], [0.395, 0.022], [0.395, 0.072], [0.365, 0.098], [0.27, 0.11], [0, 0.11],
    ], 32);
    add(g, botFlange, mWoodSpool);

    const topFlange = lathe([
      [0, 0.49], [0.27, 0.49], [0.38, 0.505], [0.425, 0.532], [0.428, 0.588], [0.402, 0.612], [0, 0.612],
    ], 32);
    add(g, topFlange, mWoodSpool);

    // Densely wound crimson thread core with organic ridged windings
    const threadPts = [[0.255, 0.105]];
    for (let k = 0; k <= 22; k++) {
      const t = k / 22;
      const r = 0.278 + Math.sin(k * 2.4) * 0.009 + Math.sin(t * PI) * 0.014;
      threadPts.push([r, 0.11 + t * 0.385]);
    }
    threadPts.push([0.255, 0.498]);
    add(g, lathe(threadPts, 28), mThreadRed);

    // Diagonal cross-wound thread strands + loose crimson tail draping onto the floor
    for (let k = 0; k < 5; k++) {
      const a0 = k * 1.25;
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const f = s / 8;
        const a = a0 + f * 1.9;
        const r = 0.292 + Math.sin(f * PI) * 0.008;
        pts.push([Math.cos(a) * r, 0.13 + f * 0.34, Math.sin(a) * r]);
      }
      add(g, tube(pts, 0.0085, 14, 6), mThreadRed);
    }
    add(g, tube([
      [0.06, 0.30, 0.292],
      [0.16, 0.20, 0.275],
      [0.21, 0.105, 0.335],
      [0.25, 0.055, 0.398],
      [0.29, 0.012, 0.42],
      [0.37, 0.010, 0.38],
      [0.44, 0.010, 0.41],
    ], 0.008, 20, 6), mThreadRed);

    // Scalloped mother-of-pearl button saucer on top (y = 0.612)
    const saucerX = 0.02, saucerZ = 0.01;
    add(g, new THREE.CylinderGeometry(0.165, 0.148, 0.024, 24), mCream, saucerX, 0.624, saucerZ);
    for (let p = 0; p < 12; p++) {
      const a = (p / 12) * TAU;
      add(g, new THREE.SphereGeometry(0.036, 8, 6), mCream, saucerX + Math.cos(a) * 0.158, 0.624, saucerZ + Math.sin(a) * 0.158, 0, 0, 0, 1, 0.38, 1);
    }

    // Upright 4-hole cream button cup with dainty curved loop handle (reaches h = 0.78m!)
    const cupY = 0.715;
    const btnCup = makeButtonGeo(THREE, 0.098, 0.052, 24);
    add(g, btnCup, mCream, saucerX, cupY, saucerZ - 0.022, PI / 2 - 0.08, 0, 0);
    const cupBack = lathe([[0, 0], [0.062, 0.004], [0.084, 0.045], [0.086, 0.105], [0.072, 0.108], [0.062, 0.03]], 20);
    add(g, cupBack, mCream, saucerX, 0.635, saucerZ - 0.035);
    add(g, new THREE.CylinderGeometry(0.066, 0.058, 0.012, 16), mDarkHole, saucerX, 0.728, saucerZ - 0.035);
    for (const [dx, dy] of [[-0.025, 0.025], [0.025, 0.025], [-0.025, -0.025], [0.025, -0.025]]) {
      add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.022, 10), mDarkHole, saucerX + dx, cupY + dy, saucerZ + 0.022, PI / 2 - 0.08, 0, 0);
    }
    add(g, tube([
      [saucerX + 0.085, cupY + 0.030, saucerZ - 0.008],
      [saucerX + 0.145, cupY + 0.038, saucerZ - 0.010],
      [saucerX + 0.140, cupY - 0.026, saucerZ - 0.010],
      [saucerX + 0.080, cupY - 0.032, saucerZ - 0.008],
    ], 0.013, 14, 6), mCream);
  }

  // ==========================================================================
  // 3. bw_matchbox_bed ('Matchbox Bed', r:0.56, h:0.64)
  // ==========================================================================
  function buildMatchboxBed(g) {
    // True half-open sliding vintage matchbox tilted gently up toward headboard (matching props_sheet 3/4 view!)
    const bedGrp = new THREE.Group();
    bedGrp.position.set(0, 0.255, 0.0);
    bedGrp.rotation.set(0.28, -1.12, 0.04); // pitches headboard (-Z) up to h ~ 0.60m & front foot (+Z) down to ground!
    g.add(bedGrp);

    // Small wooden spool/twig block tucked underneath back sleeve so the matchbox props naturally on the floor
    add(bedGrp, rbox(0.46, 0.16, 0.16, 0.025, 1), mWoodSpool, 0, -0.175, -0.24, -0.28, 0, 0);

    // Inner birch-veneer drawer tray slid halfway out (+Z)
    const trayW = 0.56, trayH = 0.21, trayD = 0.62, th = 0.026;
    add(bedGrp, rbox(trayW, th, trayD, 0.008), mVeneer, 0, -trayH / 2 + th / 2, 0.15);
    add(bedGrp, rbox(trayW, trayH, th, 0.008), mVeneer, 0, 0, 0.15 + trayD / 2 - th / 2);
    add(bedGrp, rbox(trayW, trayH, th, 0.008), mVeneer, 0, 0, 0.15 - trayD / 2 + th / 2);
    for (const sx of [-1, 1]) {
      add(bedGrp, rbox(th, trayH, trayD, 0.008), mVeneer, sx * (trayW / 2 - th / 2), 0, 0.15);
    }

    // Fluffy mattress + plump stitched white cotton pillow tucked right against the open sleeve mouth!
    add(bedGrp, makePillowGeo(THREE, 0.50, 0.13, 0.56, 0.35, 8, 8), mCotton, 0, -0.01, 0.15);
    add(bedGrp, makePillowGeo(THREE, 0.45, 0.145, 0.23, 0.16, 10, 8), mCotton, 0, 0.09, -0.01, 0.16, 0, 0);

    // Puffy 4-stamp patchwork quilt covering the front half of the drawer tray!
    const quilt = makePillowGeo(THREE, 0.51, 0.13, 0.38, 0.28, 12, 12);
    projectTopUV(quilt, 0.255, 0.19);
    add(bedGrp, quilt, mStampQuilt, 0, 0.078, 0.255, 0.04, 0, 0);

    // Vintage floral matchbox outer sleeve encasing the back (-Z) half inline with the drawer!
    const slW = 0.62, slH = 0.255, slD = 0.52;
    const topLid = rbox(slW, 0.028, slD, 0.01);
    projectTopUV(topLid, slW / 2, slD / 2);
    add(bedGrp, topLid, mMatchboxTop, 0, slH / 2, -0.19);
    add(bedGrp, rbox(slW, 0.026, slD, 0.008), mVeneer, 0, -slH / 2, -0.19);
    add(bedGrp, rbox(slW, slH, 0.026, 0.008), mVeneer, 0, 0, -0.19 - slD / 2 + 0.013);

    // Side walls of the matchbox sleeve featuring the brown honeycomb phosphorus striker strips!
    for (const sx of [-1, 1]) {
      add(bedGrp, rbox(0.028, slH, slD, 0.008), mVeneer, sx * (slW / 2 - 0.014), 0, -0.19);
      const strip = new THREE.BoxGeometry(0.008, slH * 0.80, slD * 0.88);
      const pos = strip.attributes.position, uv = strip.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getZ(i) / (slD * 0.88) + 0.5) * 2.2, pos.getY(i) / (slH * 0.80) + 0.5);
      }
      add(bedGrp, strip, mStriker, sx * (slW / 2 + 0.003), 0, -0.19);
    }
  }

  // ==========================================================================
  // 4. bw_acorn_lantern ('Acorn Firefly Lamp', r:0.40, h:1.18)
  // ==========================================================================
  function buildAcornLantern(g) {
    // Sturdy tripod of gnarly bark twigs lashed together at y = 0.24
    const hubX = -0.10, hubZ = -0.01;
    const legs = [
      [[-0.31, 0.03, 0.16], [-0.20, 0.14, 0.08], [hubX, 0.26, hubZ]],
      [[-0.25, 0.03, -0.22], [-0.17, 0.14, -0.11], [hubX, 0.26, hubZ]],
      [[0.16, 0.03, 0.06], [0.02, 0.14, 0.02], [hubX, 0.26, hubZ]],
      [[hubX, 0.25, hubZ], [-0.09, 0.12, -0.02], [-0.08, 0.03, -0.01]],
    ];
    for (const pts of legs) {
      add(g, tube(pts, 0.036, 12, 8), mBark);
    }

    // Main curved rough-bark stem rising to crook h = 1.18m
    add(g, tube([
      [hubX, 0.22, hubZ],
      [-0.16, 0.48, 0.01],
      [-0.13, 0.76, -0.02],
      [-0.04, 1.01, 0.0],
      [0.10, 1.13, 0.01],
      [0.25, 1.15, 0.0],
    ], 0.044, 22, 9), mBark);

    // Side twig fork near top-left & stubby knots
    add(g, tube([
      [-0.07, 0.94, 0.0],
      [-0.13, 1.06, 0.03],
      [-0.12, 1.16, 0.04],
    ], 0.025, 10, 7), mBark);
    add(g, tube([
      [-0.15, 0.50, 0.01],
      [-0.23, 0.57, 0.05],
    ], 0.020, 6, 6), mBark);

    // Chunky twine lashings at base hub, mid-stem & crook tip
    for (let i = 0; i < 4; i++) {
      add(g, new THREE.TorusGeometry(0.058, 0.013, 6, 16), mCord, hubX, 0.22 + i * 0.021, hubZ, PI / 2 + (i - 1.5) * 0.08, 0, 0.08);
    }
    for (let i = 0; i < 3; i++) {
      add(g, new THREE.TorusGeometry(0.050, 0.011, 6, 14), mCord, -0.12, 0.76 + i * 0.020, -0.02, PI / 2 + 0.15, 0, -0.18);
    }
    for (let i = 0; i < 3; i++) {
      add(g, new THREE.TorusGeometry(0.046, 0.010, 6, 14), mCord, 0.185 + i * 0.018, 1.148, 0.0, 0.1, PI / 2, 0);
    }

    // Lush moss clumps along the bark
    for (const [mx, my, mz, r] of [
      [-0.11, 0.44, 0.04, 0.040], [-0.14, 0.47, -0.02, 0.034], [-0.06, 0.96, 0.035, 0.032], [hubX + 0.035, 0.29, 0.035, 0.036],
    ]) {
      add(g, new THREE.SphereGeometry(r, 8, 6), mMoss, mx, my, mz, 0, 0, 0, 1.2, 0.75, 1.1);
    }

    // Hanging twine eyelet + textured oak acorn cupule + glowing amber petal bulb!
    const lx = 0.20, lz = 0.0;
    add(g, new THREE.TorusGeometry(0.028, 0.009, 6, 14), mCord, lx, 1.09, lz);
    add(g, new THREE.TorusGeometry(0.026, 0.008, 6, 14), mCord, lx, 1.045, lz, 0, PI / 2, 0);

    const cup = lathe([
      [0.155, 0.875], [0.168, 0.91], [0.156, 0.955], [0.115, 0.998], [0.045, 1.022], [0, 1.028],
    ], 22);
    add(g, cup, mAcornCap, lx, 0, lz);
    for (let row = 0; row < 3; row++) {
      const n = 12 - row * 2;
      const ry = 0.898 + row * 0.038;
      const rr = 0.162 - row * 0.025;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + row * 0.26;
        add(g, new THREE.SphereGeometry(0.025, 7, 5), mAcornCap, lx + Math.cos(a) * rr, ry, lz + Math.sin(a) * rr, 0.3, -a, 0, 1.1, 0.8, 0.65);
      }
    }

    // Inner bright glowing firefly bulb + 6 cupped golden-amber veined petals!
    const core = lathe([[0, 0.63], [0.076, 0.675], [0.098, 0.755], [0.084, 0.85], [0.045, 0.895], [0, 0.905]], 18);
    add(g, core, mBulbCore, lx, 0, lz);

    const petalGeo = makeLeafGeo(THREE, 0.26, 0.068, 0.018, 0, 0.16, 0.22);
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * TAU;
      const pGrp = new THREE.Group();
      pGrp.position.set(lx + Math.cos(a) * 0.082, 0.89, lz + Math.sin(a) * 0.082);
      pGrp.rotation.y = -a + PI / 2;
      g.add(pGrp);
      add(pGrp, petalGeo, mPetalAmber, 0, 0, 0, PI / 2 - 0.22, 0, 0);
    }
  }

  // ==========================================================================
  // 5. bw_inkwell_pot ('Snowdrop Inkwell', r:0.42, h:0.98)
  // ==========================================================================
  function buildInkwellPot(g) {
    // Deep indigo ink pool inside the faceted octagonal bottle
    const inkBody = lathe([
      [0, 0.042], [0.225, 0.042], [0.242, 0.14], [0.215, 0.255], [0, 0.258],
    ], 8);
    inkBody.rotateY(PI / 8);
    add(g, inkBody, mIndigoInk);

    // Clear faceted octagonal glass bottle (merged into ONE single transparent mesh = 1 draw call!)
    const glassParts = [];
    const outerBottle = lathe([
      [0, 0.002], [0.285, 0.002], [0.305, 0.035], [0.282, 0.255], [0.205, 0.345],
      [0.105, 0.362], [0.102, 0.435], [0.128, 0.452], [0.126, 0.476], [0.088, 0.478], [0.082, 0.35],
    ], 8);
    outerBottle.rotateY(PI / 8);
    glassParts.push(outerBottle.index ? outerBottle.toNonIndexed() : outerBottle);
    const mergedGlass = mergeGeometries(glassParts, false);
    const glassMesh = new THREE.Mesh(mergedGlass, mGlassClear);
    glassMesh.name = 'inkwell_glass';
    g.add(glassMesh);

    // Subtle silver-cream highlight collar on rim for crisp Storybook readability
    add(g, new THREE.TorusGeometry(0.114, 0.011, 6, 16), mCream, 0, 0.465, 0, PI / 2, 0, 0);

    // Left: Graceful arching green snowdrop stem + 2 slender leaves + drooping white snowdrop flower!
    add(g, tube([
      [-0.015, 0.28, 0.0],
      [-0.025, 0.48, 0.01],
      [-0.055, 0.72, 0.02],
      [-0.115, 0.87, 0.01],
      [-0.195, 0.89, 0.0],
      [-0.245, 0.82, 0.01],
    ], 0.013, 20, 7), mClover);

    // Two slender snowdrop leaves rising from neck
    add(g, tube([[-0.01, 0.42, 0.02], [-0.06, 0.58, 0.05], [-0.11, 0.71, 0.08]], 0.014, 10, 5), mClover);
    add(g, tube([[0.01, 0.43, -0.02], [0.04, 0.57, -0.04], [0.06, 0.69, -0.05]], 0.013, 10, 5), mClover);

    // Green ovary & 3 drooping pure-white outer petals + notched inner bell at (-0.255, 0.80, 0.01)
    const fx = -0.255, fy = 0.805, fz = 0.01;
    add(g, new THREE.SphereGeometry(0.025, 10, 8), mClover, fx, fy + 0.012, fz, 0, 0, 0.35, 0.9, 1.35, 0.9);
    const snowPetal = makeLeafGeo(THREE, 0.165, 0.042, 0.014, 0, 0.12, 0.2);
    for (let p = 0; p < 3; p++) {
      const a = (p / 3) * TAU + 0.4;
      add(g, snowPetal, mSnowWhite, fx + Math.cos(a) * 0.014, fy - 0.005, fz + Math.sin(a) * 0.014, PI / 2 + 0.32, -a, 0.15);
    }
    add(g, new THREE.CylinderGeometry(0.018, 0.032, 0.068, 12), mSnowWhite, fx - 0.018, fy - 0.048, fz, 0, 0, -0.28);

    // Right: Tall striped brown-and-cream feather quill (y = 0.28 .. 0.98)
    add(g, tube([
      [0.01, 0.25, -0.01],
      [0.045, 0.48, 0.0],
      [0.125, 0.73, 0.0],
      [0.245, 0.955, -0.01],
    ], 0.011, 18, 6), mCream);

    // Sculpted curved feather vane around the upper shaft
    const vane = new THREE.PlaneGeometry(0.185, 0.48, 8, 18);
    const vp = vane.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i), y = vp.getY(i);
      const t = Math.max(0, Math.min(1, (y + 0.24) / 0.48)); // clamped [0, 1] so pow never NaNs!
      const widthEnv = Math.sin(Math.pow(t, 0.72) * PI) * 1.12;
      const curveX = Math.pow(t, 1.35) * 0.055;
      vp.setXYZ(i, x * widthEnv + curveX, y, -Math.abs(x) * 0.18 + Math.sin(t * PI) * 0.018);
    }
    vane.computeVertexNormals();
    add(g, vane, mQuillFeather, 0.152, 0.745, -0.005, 0.04, 0.08, -0.44);
  }

  // ==========================================================================
  // 6. bw_sugar_crate ('Sugar-Cube Bundle', r:0.46, h:0.78)
  // ==========================================================================
  function buildSugarCrate(g, rng) {
    // Three giant crystalline white sugar cubes stacked in a pyramid/stepped bundle
    const cubes = [
      { x: -0.165, y: 0.165, z: 0.01, s: 0.325, ry: 0.04 },
      { x: 0.165, y: 0.165, z: -0.01, s: 0.325, ry: -0.05 },
      { x: 0.0, y: 0.485, z: 0.0, s: 0.315, ry: 0.07 },
    ];
    const crystalGeo = new THREE.OctahedronGeometry(0.022, 0);
    for (const c of cubes) {
      add(g, rbox(c.s, c.s, c.s, 0.032, 1), mSugarCrystal, c.x, c.y, c.z, 0, c.ry, 0);
      const hs = c.s * 0.485;
      for (let k = 0; k < 20; k++) {
        const face = k % 5;
        let dx = rng.jr(-hs, hs), dy = rng.jr(-hs * 0.7, hs), dz = rng.jr(-hs, hs);
        if (face === 0) dx = hs;
        else if (face === 1) dx = -hs;
        else if (face === 2) dy = hs;
        else if (face === 3) dz = hs;
        else dz = -hs;
        add(g, crystalGeo, mSugarCrystal, c.x + dx, Math.max(0.025, c.y + dy), c.z + dz, rng.jr(0, PI), rng.jr(0, PI), rng.jr(0, PI), rng.jr(0.75, 1.3));
      }
    }

    // Snug braided jute twine hugging the front/back & stepped sides of the 3 sugar cubes!
    add(g, tube([
      [0, 0.018, -0.176], [0, 0.018, 0.176], [0, 0.31, 0.178], [0, 0.36, 0.172],
      [0, 0.646, 0.168], [0, 0.654, 0], [0, 0.646, -0.168], [0, 0.36, -0.172], [0, 0.31, -0.178], [0, 0.022, -0.176],
    ], 0.016, 28, 6), mCord);

    // Side-to-side twine hugging the inner step corners cleanly without bowing into midair
    for (const sx of [-1, 1]) {
      add(g, tube([
        [0, 0.018, 0], [sx * 0.332, 0.018, 0], [sx * 0.336, 0.17, 0], [sx * 0.334, 0.326, 0],
        [sx * 0.172, 0.334, 0], [sx * 0.166, 0.49, 0], [sx * 0.162, 0.646, 0], [0, 0.652, 0],
      ], 0.016, 22, 6), mCord);
    }
    // Horizontal belly wrap around the lower pair seam
    add(g, tube([
      [-0.335, 0.318, 0.176], [0, 0.318, 0.180], [0.335, 0.318, 0.176],
      [0.335, 0.318, -0.176], [0, 0.318, -0.180], [-0.335, 0.318, -0.176], [-0.332, 0.318, 0.172],
    ], 0.014, 24, 6), mCord);

    // Big floppy double-loop twine bow on top (y = 0.65 .. 0.78)
    add(g, new THREE.SphereGeometry(0.032, 10, 8), mCord, 0, 0.665, 0);
    for (const sx of [-1, 1]) {
      add(g, tube([
        [sx * 0.01, 0.665, 0.005],
        [sx * 0.088, 0.758, 0.025],
        [sx * 0.160, 0.738, -0.01],
        [sx * 0.095, 0.676, -0.02],
        [sx * 0.012, 0.665, -0.005],
      ], 0.015, 16, 6), mCord);
      add(g, tube([
        [sx * 0.01, 0.66, 0.01],
        [sx * 0.075, 0.635, 0.085],
        [sx * 0.135, 0.565, 0.145],
      ], 0.013, 10, 6), mCord);
    }

    // Antique toothed brass watch gear leaning against the front-right cube (y >= 0.005)
    const gearPivot = new THREE.Group();
    gearPivot.position.set(0.235, 0.192, 0.205);
    gearPivot.rotation.set(-0.20, 0.34, 0);
    g.add(gearPivot);

    add(gearPivot, new THREE.TorusGeometry(0.142, 0.021, 7, 24), mBrass);
    add(gearPivot, new THREE.TorusGeometry(0.040, 0.017, 6, 16), mBrass);
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * TAU;
      add(gearPivot, rbox(0.022, 0.25, 0.020, 0.004, 1), mBrass, 0, 0, 0, 0, 0, a);
    }
    const teeth = 20;
    for (let t = 0; t < teeth; t++) {
      const a = (t / teeth) * TAU;
      add(gearPivot, rbox(0.023, 0.034, 0.026, 0.004, 1), mBrass, Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0, 0, 0, a + PI / 2);
    }
  }

  // ==========================================================================
  // 7. bw_pocket_watch ('Gold Pocket Watch', r:0.48, h:0.96)
  // ==========================================================================
  function buildPocketWatch(g) {
    // Lashed rough-bark twig easel stand behind & supporting the watch
    const easelLegs = [
      [[0.15, 0.02, 0.19], [0.11, 0.44, 0.02], [0.06, 0.87, -0.14]],
      [[-0.17, 0.02, 0.16], [-0.11, 0.44, 0.0], [-0.02, 0.87, -0.14]],
      [[0.02, 0.84, -0.14], [0.16, 0.42, -0.24], [0.28, 0.02, -0.30]],
      [[-0.24, 0.13, 0.17], [0.0, 0.13, 0.19], [0.25, 0.13, 0.17]],
      [[0.13, 0.25, 0.08], [0.21, 0.23, -0.10], [0.25, 0.21, -0.24]],
    ];
    for (const pts of easelLegs) {
      add(g, tube(pts, 0.028, 12, 8), mBark);
    }
    for (const [lx, ly, lz] of [[0.02, 0.79, -0.12], [0.14, 0.13, 0.18], [-0.14, 0.13, 0.17], [0.24, 0.22, -0.22]]) {
      for (let k = -1; k <= 1; k++) {
        add(g, new THREE.TorusGeometry(0.038, 0.009, 6, 14), mCord, lx, ly + k * 0.016, lz, PI / 2 + 0.2, 0.2, 0);
      }
    }

    // Gold pocket watch tilted slightly back on the easel (center y = 0.475, top bow reaches y = 0.96!)
    const watch = new THREE.Group();
    watch.position.set(0.01, 0.475, 0.05);
    watch.rotation.set(-0.22, 0.16, 0.04);
    g.add(watch);

    const caseBody = lathe([
      [0, -0.09], [0.24, -0.082], [0.302, -0.045], [0.315, 0.0], [0.305, 0.048], [0.275, 0.062], [0.262, 0.042], [0, 0.04],
    ], 34);
    caseBody.rotateX(PI / 2);
    add(watch, caseBody, mGoldBright);
    add(watch, new THREE.TorusGeometry(0.288, 0.024, 10, 34), mGoldBright, 0, 0, 0.042);

    add(watch, new THREE.CylinderGeometry(0.034, 0.042, 0.075, 16), mGoldBright, 0, 0.34, 0.005);
    add(watch, new THREE.CylinderGeometry(0.056, 0.056, 0.046, 18), mGoldBright, 0, 0.388, 0.005);
    add(watch, new THREE.TorusGeometry(0.082, 0.016, 8, 22), mGoldBright, 0, 0.432, 0.005, 0, 0, 0, 1.15, 0.85, 1);

    const dial = new THREE.CylinderGeometry(0.266, 0.266, 0.012, 34);
    dial.rotateX(PI / 2);
    projectFrontUV(dial, 0.266, 0.266, 0);
    add(watch, dial, mWatchDial, 0, 0, 0.045);

    add(watch, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), mDarkHole, 0, 0, 0.056, PI / 2, 0, 0);
    add(watch, rbox(0.016, 0.145, 0.01, 0.004, 1), mDarkHole, -0.052, 0.032, 0.058, 0, 0, 0.98);
    add(watch, rbox(0.013, 0.205, 0.01, 0.004, 1), mDarkHole, 0.078, 0.048, 0.060, 0, 0, -0.96);

    // Open-hinged front gold cover lid resting saucer-up on the ground at front-left (matching props_sheet!)
    const lid = new THREE.Group();
    lid.position.set(-0.23, 0.018, 0.23);
    lid.rotation.set(0.08, 0.18, -0.10);
    g.add(lid);
    const lidBowl = lathe([
      [0, 0], [0.15, 0.01], [0.225, 0.046], [0.242, 0.082], [0.225, 0.088], [0.16, 0.045], [0, 0.026],
    ], 30);
    add(lid, lidBowl, mGoldBright);
    add(lid, new THREE.SphereGeometry(0.026, 8, 6), mBrass, 0, 0.032, 0, 0, 0, 0, 1, 0.35, 1);
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * TAU;
      add(lid, new THREE.SphereGeometry(0.046, 8, 6), mBrass, Math.cos(a) * 0.068, 0.034, Math.sin(a) * 0.068, 0, -a, 0, 1.3, 0.22, 0.55);
    }
    add(g, new THREE.CylinderGeometry(0.020, 0.020, 0.085, 10), mGoldBright, -0.10, 0.14, 0.14, 0.5, 0.3, 0.95);
  }

  // ==========================================================================
  // 8. bw_mushroom_cluster ('Amanita Cluster', r:0.52, h:0.96)
  // ==========================================================================
  function buildMushroomCluster(g, rng) {
    // Gnarly mossy bark log base along X (y = 0 .. 0.22)
    add(g, tube([
      [-0.41, 0.105, 0.02], [-0.15, 0.115, -0.02], [0.16, 0.11, 0.02], [0.40, 0.10, -0.01],
    ], 0.098, 16, 9), mBark);
    add(g, tube([
      [-0.38, 0.075, 0.12], [-0.08, 0.08, 0.14], [0.24, 0.075, 0.11], [0.38, 0.07, 0.08],
    ], 0.062, 12, 8), mBark);
    add(g, rbox(0.82, 0.075, 0.34, 0.03, 1), mBark, 0, 0.04, 0.03);

    for (let i = 0; i < 22; i++) {
      const mx = rng.jr(-0.36, 0.36), mz = rng.jr(-0.11, 0.15);
      const my = 0.165 + (1 - Math.abs(mx) / 0.42) * 0.045 + rng.jr(-0.015, 0.025);
      add(g, new THREE.SphereGeometry(rng.jr(0.042, 0.076), 8, 6), mMoss, mx, my, mz, 0, rng.jr(0, PI), 0, 1.25, 0.72, 1.15);
    }
    for (let l = 0; l < 7; l++) {
      const a = (l / 7) * TAU;
      add(g, new THREE.SphereGeometry(0.038, 8, 6), mLichen, -0.14 + Math.cos(a) * 0.045, 0.12 + Math.sin(a) * 0.032, 0.178, 0.2, 0, a, 1.2, 0.65, 0.32);
    }

    const addAmanita = (cx, cy, cz, scale, tiltX, tiltZ) => {
      const m = new THREE.Group();
      m.position.set(cx, cy, cz);
      m.rotation.set(tiltX, 0, tiltZ);
      m.scale.setScalar(scale);
      g.add(m);

      add(m, lathe([
        [0, 0], [0.105, 0.02], [0.115, 0.09], [0.086, 0.26], [0.072, 0.46], [0.082, 0.53], [0, 0.54],
      ], 18), mMushroomCream);
      const skirt = lathe([[0.074, 0.38], [0.118, 0.34], [0.132, 0.29], [0.115, 0.285], [0.082, 0.35]], 18);
      add(m, skirt, mMushroomCream);

      add(m, lathe([[0.06, 0.50], [0.22, 0.485], [0.335, 0.505], [0, 0.55]], 26), mMushroomCream);
      const cap = lathe([
        [0.332, 0.502], [0.355, 0.525], [0.335, 0.585], [0.265, 0.668], [0.155, 0.735], [0.055, 0.768], [0, 0.775],
      ], 28);
      add(m, cap, mAmanitaRed);

      const spots = [
        [0, 0.775, 0, 0.032],
        [0.12, 0.74, 0.06, 0.028], [-0.13, 0.735, 0.05, 0.026], [0.04, 0.742, -0.13, 0.027], [-0.08, 0.745, -0.11, 0.025],
        [0.23, 0.665, 0.11, 0.026], [-0.22, 0.67, 0.12, 0.028], [0.18, 0.675, -0.18, 0.025], [-0.21, 0.665, -0.15, 0.024],
        [0.02, 0.68, 0.24, 0.029], [0.31, 0.575, 0.02, 0.022], [-0.30, 0.58, -0.02, 0.023], [0.18, 0.57, 0.25, 0.024], [-0.17, 0.575, 0.26, 0.022],
      ];
      for (const [sx, sy, sz, sr] of spots) {
        add(m, new THREE.SphereGeometry(sr, 7, 5), mMushroomCream, sx, sy, sz, 0, 0, 0, 1.15, 0.55, 1.15);
      }
    };

    addAmanita(-0.08, 0.18, -0.02, 0.99, 0.04, 0.07);
    addAmanita(-0.32, 0.165, 0.05, 0.48, 0.08, 0.24);

    // Three bright golden fluted Chanterelles prominently visible on the right side!
    const chanterelles = [
      { x: 0.19, y: 0.18, z: 0.06, h: 0.37, r: 0.155, rx: 0.08, rz: -0.14 },
      { x: 0.31, y: 0.18, z: -0.02, h: 0.45, r: 0.165, rx: -0.04, rz: -0.26 },
      { x: 0.29, y: 0.17, z: 0.12, h: 0.23, r: 0.098, rx: 0.18, rz: -0.36 },
    ];
    for (const ch of chanterelles) {
      const funnel = new THREE.LatheGeometry([
        new THREE.Vector2(0, 0),
        new THREE.Vector2(ch.r * 0.28, ch.h * 0.05),
        new THREE.Vector2(ch.r * 0.26, ch.h * 0.45),
        new THREE.Vector2(ch.r * 0.50, ch.h * 0.74),
        new THREE.Vector2(ch.r * 0.92, ch.h * 0.93),
        new THREE.Vector2(ch.r, ch.h),
        new THREE.Vector2(ch.r * 0.72, ch.h * 0.94),
        new THREE.Vector2(0, ch.h * 0.84),
      ], 22);
      const fp = funnel.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i);
        const rad = Math.hypot(x, z);
        if (rad > ch.r * 0.38) {
          const ang = Math.atan2(z, x);
          const wave = Math.sin(ang * 7) * 0.015 * (rad / ch.r);
          fp.setY(i, y + wave);
          fp.setX(i, x * (1 + Math.cos(ang * 5) * 0.06));
        }
      }
      funnel.computeVertexNormals();
      add(g, funnel, mChanterelle, ch.x, ch.y, ch.z, ch.rx, 0, ch.rz);
    }
  }

  // ==========================================================================
  // 9. bw_teacup_planter ('Teacup Clover Pot', r:0.48, h:0.84)
  // ==========================================================================
  function buildTeacupPlanter(g, rng) {
    const foot = lathe([[0, 0], [0.195, 0], [0.21, 0.025], [0.18, 0.062], [0.165, 0.08], [0, 0.08]], 24);
    add(g, foot, mPorcelainDelft, -0.03, 0, 0);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      add(g, new THREE.SphereGeometry(0.024, 7, 5), mSeedGold, -0.03 + Math.cos(a) * 0.196, 0.016, Math.sin(a) * 0.196, 0, 0, 0, 1.1, 0.45, 1.1);
    }

    const cupBowl = lathe([
      [0, 0.065], [0.165, 0.072], [0.245, 0.145], [0.305, 0.265], [0.338, 0.405],
      [0.348, 0.445], [0.324, 0.448], [0.295, 0.30], [0.22, 0.14], [0, 0.11],
    ], 36);
    const cp = cupBowl.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
      if (y > 0.34) {
        const a = Math.atan2(x, z);
        let da = Math.abs(a - (-0.42));
        if (da > PI) da = TAU - da;
        if (da < 0.28) {
          const dip = (1 - da / 0.28) * 0.078 * ((y - 0.34) / 0.11);
          cp.setY(i, y - dip);
        }
      }
    }
    cupBowl.computeVertexNormals();
    add(g, cupBowl, mPorcelainDelft, -0.03, 0, 0);

    add(g, tube([
      [0.295, 0.39, 0], [0.405, 0.435, 0], [0.455, 0.375, 0],
      [0.435, 0.265, 0], [0.355, 0.185, 0], [0.255, 0.145, 0],
    ], 0.022, 20, 8), mPorcelainDelft);
    add(g, new THREE.SphereGeometry(0.026, 8, 6), mSeedGold, 0.415, 0.442, 0, 0, 0, 0.4, 1.2, 0.65, 0.8);

    add(g, new THREE.CylinderGeometry(0.305, 0.25, 0.12, 22), mBark, -0.03, 0.355, 0);
    for (let i = 0; i < 14; i++) {
      const a = rng.jr(0, TAU), r = rng.jr(0.03, 0.26);
      add(g, new THREE.SphereGeometry(rng.jr(0.038, 0.062), 7, 5), mMoss, -0.03 + Math.cos(a) * r, 0.425 + rng.jr(0, 0.03), Math.sin(a) * r, 0, 0, 0, 1.2, 0.65, 1.2);
    }

    // Left side: Lush green shamrock clovers (3-leaf & 4-leaf heart leaflets reaching h = 0.84m!)
    const cloverLeaf = makeLeafGeo(THREE, 0.135, 0.070, 0.013, 0.24, 0.05, 0.14);
    const cloverStems = [
      { top: [-0.14, 0.80, 0.04], leaves: 4, s: 1.0, tilt: [0.20, 0.1, 0.15] },
      { top: [-0.28, 0.74, 0.09], leaves: 3, s: 0.94, tilt: [0.28, -0.2, 0.38] },
      { top: [-0.25, 0.62, -0.08], leaves: 3, s: 0.84, tilt: [-0.18, 0.3, 0.44] },
      { top: [-0.05, 0.68, -0.12], leaves: 3, s: 0.86, tilt: [-0.24, 0, 0.1] },
    ];
    for (const cs of cloverStems) {
      add(g, tube([
        [-0.08, 0.42, 0],
        [(cs.top[0] - 0.08) * 0.55, (cs.top[1] + 0.42) * 0.52, cs.top[2] * 0.6],
        cs.top,
      ], 0.012, 10, 6), mClover);
      const head = new THREE.Group();
      head.position.set(...cs.top);
      head.rotation.set(...cs.tilt);
      head.scale.setScalar(cs.s);
      g.add(head);
      for (let l = 0; l < cs.leaves; l++) {
        const a = (l / cs.leaves) * TAU + 0.35;
        add(head, cloverLeaf, mClover, 0, 0, 0, 0.14, a, 0);
      }
    }

    const blossomCenters = [
      [0.11, 0.81, 0.02], [0.19, 0.76, 0.09], [0.23, 0.69, -0.04],
      [0.06, 0.72, 0.13], [0.15, 0.64, 0.15], [0.16, 0.73, -0.11], [0.03, 0.63, 0.18],
    ];
    for (const bc of blossomCenters) {
      add(g, tube([[0.05, 0.43, 0.02], [bc[0] * 0.7, (bc[1] + 0.43) * 0.5, bc[2] * 0.7], bc], 0.008, 8, 5), mClover);
      const fl = new THREE.Group();
      fl.position.set(...bc);
      fl.lookAt(bc[0] * 2.2, bc[1] + 0.8, bc[2] * 2.2 + 0.6);
      g.add(fl);
      add(fl, new THREE.SphereGeometry(0.016, 7, 5), mSeedGold, 0, 0, 0.006);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        add(fl, new THREE.SphereGeometry(0.025, 7, 5), mForgetBlue, Math.cos(a) * 0.031, Math.sin(a) * 0.031, 0, 0, 0, a, 1.15, 0.88, 0.35);
      }
    }
  }

  // ==========================================================================
  // 10. bw_button_stack ('Button Stack', r:0.44, h:0.76)
  // ==========================================================================
  function buildButtonStack(g) {
    const stack = [
      { y: 0.016, r: 0.345, h: 0.110, m: mBtnGreen, x: 0.01, z: 0.0, rx: 0, rz: 0, ry: 0.1 },
      { y: 0.122, r: 0.352, h: 0.110, m: mBtnBlue, x: -0.012, z: 0.01, rx: 0.02, rz: -0.02, ry: 0.6 },
      { y: 0.228, r: 0.355, h: 0.112, m: mCream, x: 0.01, z: -0.01, rx: -0.02, rz: 0.02, ry: -0.3 },
      { y: 0.336, r: 0.352, h: 0.112, m: mBtnRed, x: -0.022, z: 0.01, rx: 0.03, rz: -0.04, ry: 0.4 },
      { y: 0.458, r: 0.345, h: 0.115, m: mPearlNacre, x: 0.005, z: 0.015, rx: 0.16, rz: -0.08, ry: 0.2, top: true },
    ];

    for (const b of stack) {
      const geo = makeButtonGeo(THREE, b.r, b.h, 30);
      if (b.top) projectTopUV(geo, b.r, b.r);
      add(g, geo, b.m, b.x, b.y, b.z, b.rx, b.ry, b.rz);
      if (b.top) {
        const topGrp = new THREE.Group();
        topGrp.position.set(b.x, b.y, b.z);
        topGrp.rotation.set(b.rx, b.ry, b.rz);
        g.add(topGrp);
        for (const [hx, hz] of [[-0.078, -0.078], [0.078, -0.078], [-0.078, 0.078], [0.078, 0.078]]) {
          add(topGrp, new THREE.CylinderGeometry(0.035, 0.035, 0.048, 12), mDarkHole, hx, b.h * 0.68, hz);
        }
      }
    }

    for (const rotY of [0.22, 0.22 + PI / 2]) {
      const wrap = new THREE.Group();
      wrap.rotation.y = rotY;
      g.add(wrap);
      add(wrap, tube([
        [0, 0.018, -0.355], [0, 0.018, 0.355], [0.01, 0.28, 0.370], [0, 0.54, 0.335],
        [0, 0.595, 0.0], [0, 0.53, -0.345], [-0.01, 0.28, -0.370], [0, 0.022, -0.350],
      ], 0.015, 28, 6), mCord);
    }

    const bx = 0.0, by = 0.598, bz = 0.01;
    add(g, new THREE.SphereGeometry(0.032, 10, 8), mCord, bx, by, bz);
    for (const sx of [-1, 1]) {
      add(g, tube([
        [bx + sx * 0.01, by, bz + 0.005],
        [bx + sx * 0.11, by + 0.145, bz + 0.03],
        [bx + sx * 0.20, by + 0.115, bz - 0.01],
        [bx + sx * 0.12, by + 0.03, bz - 0.02],
        [bx + sx * 0.012, by, bz - 0.005],
      ], 0.016, 16, 6), mCord);
      add(g, tube([
        [bx + sx * 0.01, by - 0.005, bz + 0.01],
        [bx + sx * 0.15, by - 0.03, bz + 0.08],
        [bx + sx * 0.25, by - 0.11, bz + 0.14],
      ], 0.014, 10, 6), mCord);
    }
  }

  // ==========================================================================
  // 11. bw_bottle_cap_chair ('Bottle-Cap Chair', r:0.48, h:0.88)
  // ==========================================================================
  function buildBottleCapChair(g) {
    const legs = [
      [[-0.26, 0.02, 0.24], [-0.21, 0.24, 0.18]],
      [[0.26, 0.02, 0.24], [0.21, 0.24, 0.18]],
      [[-0.25, 0.02, -0.22], [-0.20, 0.24, -0.16]],
      [[0.25, 0.02, -0.22], [0.20, 0.24, -0.16]],
    ];
    for (const [p0, p1] of legs) {
      add(g, tube([p0, [(p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5, (p0[2] + p1[2]) * 0.5], p1], 0.038, 6, 7), mBark);
    }

    add(g, new THREE.CylinderGeometry(0.355, 0.33, 0.065, 24), mCapFiligree, 0, 0.245, 0.02);
    const seatFlutes = 17;
    for (let k = 0; k < seatFlutes; k++) {
      const a = -PI * 0.58 + (k / (seatFlutes - 1)) * (PI * 1.16);
      const fx = Math.sin(a) * 0.358, fz = 0.02 + Math.cos(a) * 0.358;
      add(g, new THREE.CylinderGeometry(0.026, 0.034, 0.105, 6), mCapFiligree, fx, 0.218, fz, 0.28 * Math.cos(a), a, -0.28 * Math.sin(a));
      add(g, new THREE.SphereGeometry(0.028, 6, 4), mBrass, fx * 1.03, 0.172, fz * 1.03, 0, a, 0, 1.0, 0.55, 0.8);
    }

    const backR = 0.355;
    const backDish = new THREE.CylinderGeometry(backR, backR, 0.046, 28, 1, false);
    backDish.rotateX(PI / 2);
    const bp = backDish.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
      const bendZ = (x * x) * 0.52 + Math.max(0, -y) * 0.12;
      bp.setZ(i, z + bendZ);
    }
    backDish.computeVertexNormals();
    projectFrontUV(backDish, backR, backR, 0);
    add(g, backDish, mCapFiligree, 0, 0.505, -0.15, -0.12, 0, 0);

    const backGrp = new THREE.Group();
    backGrp.position.set(0, 0.505, -0.15);
    backGrp.rotation.x = -0.12;
    g.add(backGrp);
    const flutes = 19;
    for (let k = 0; k < flutes; k++) {
      const a = -PI * 0.12 + (k / (flutes - 1)) * (PI * 1.24);
      const rx = Math.cos(a) * backR, ry = Math.sin(a) * backR;
      const bendZ = rx * rx * 0.52;
      add(backGrp, new THREE.CylinderGeometry(0.028, 0.036, 0.11, 6), mCapFiligree, rx * 0.99, ry * 0.99, bendZ + 0.032, PI / 2 - 0.35, 0, a - PI / 2);
      add(backGrp, new THREE.SphereGeometry(0.030, 6, 4), mBrass, rx * 1.02, ry * 1.02, bendZ + 0.080, 0, 0, a, 0.85, 1.0, 0.65);
    }

    for (const sx of [-1, 1]) {
      add(g, tube([
        [sx * 0.33, 0.43, -0.08],
        [sx * 0.36, 0.40, 0.06],
        [sx * 0.37, 0.355, 0.21],
        [sx * 0.335, 0.26, 0.25],
      ], 0.042, 12, 7), mCapFiligree);
      add(g, new THREE.TorusGeometry(0.044, 0.011, 6, 12), mBrass, sx * 0.368, 0.355, 0.215, 0.3, 0, 0);
    }

    const cushion = makePillowGeo(THREE, 0.45, 0.135, 0.41, 0.18, 10, 9);
    projectTopUV(cushion, 0.225, 0.205);
    add(g, cushion, mLeafCushion, 0, 0.335, 0.035, 0.12, 0.16, -0.04);

    const stitchGrp = new THREE.Group();
    stitchGrp.position.set(0, 0.335, 0.035);
    stitchGrp.rotation.set(0.12, 0.16, -0.04);
    g.add(stitchGrp);
    for (let s = -4; s <= 4; s++) {
      add(stitchGrp, rbox(0.028, 0.012, 0.012, 0.003, 1), mCream, s * 0.044, 0.005, 0.20);
      add(stitchGrp, rbox(0.012, 0.012, 0.028, 0.003, 1), mCream, 0.216, 0.005, s * 0.039);
      add(stitchGrp, rbox(0.012, 0.012, 0.028, 0.003, 1), mCream, -0.216, 0.005, s * 0.039);
    }
  }

  // ==========================================================================
  // 12. bw_strawberry_basket ('Giant Strawberry', r:0.48, h:0.86)
  // ==========================================================================
  function buildStrawberryBasket(g) {
    const botH = 0.23, topH = 0.30, bH = 0.40, flare = Math.atan2(topH - botH, bH);
    add(g, rbox(botH * 2, 0.024, botH * 2, 0.006, 1), mVeneer, 0, 0.012, 0);

    for (let side = 0; side < 4; side++) {
      const sideGrp = new THREE.Group();
      sideGrp.rotation.y = side * (PI / 2);
      g.add(sideGrp);
      for (const u of [-0.155, 0, 0.155]) {
        const wSplint = 0.115;
        const zMid = (botH + topH) * 0.5 + (u === 0 ? 0.008 : -0.006);
        add(sideGrp, rbox(wSplint, bH, 0.016, 0.003, 1), mVeneer, u * 1.12, bH * 0.5, zMid, flare, 0, -u * 0.16);
      }
      for (const [hy, thick, matUse] of [[0.14, 0.068, mWoodSpool], [0.27, 0.068, mVeneer], [0.382, 0.062, mVeneer]]) {
        const t = hy / bH;
        const hw = botH + (topH - botH) * t + (hy > 0.35 ? 0.018 : 0.006);
        add(sideGrp, rbox(hw * 2.04, thick, 0.022, 0.004, 1), matUse, 0, hy, hw, flare * 0.4, 0, 0);
      }
      for (const bx of [-0.09, 0.09]) {
        add(sideGrp, new THREE.SphereGeometry(0.012, 6, 4), mDarkHole, bx, 0.382, topH + 0.028);
      }
    }

    const berryGrp = new THREE.Group();
    berryGrp.position.set(-0.01, 0.43, 0.0);
    berryGrp.rotation.set(0.10, 0.18, -0.34);
    g.add(berryGrp);

    const berryPts = [
      [0, -0.33],
      [0.085, -0.31],
      [0.165, -0.24],
      [0.242, -0.13],
      [0.298, 0.0],
      [0.322, 0.12],
      [0.302, 0.23],
      [0.228, 0.305],
      [0.115, 0.342],
      [0, 0.345],
    ];
    const berryGeo = lathe(berryPts, 30);
    const bp = berryGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
      const a = Math.atan2(z, x);
      const swell = 1 + 0.035 * Math.cos(a * 2) - 0.012 * Math.sin(y * 32 + a * 9);
      bp.setXYZ(i, x * swell, y, z * swell);
    }
    berryGeo.computeVertexNormals();
    add(berryGrp, berryGeo, mBerrySkin);

    const seedGeo = new THREE.SphereGeometry(0.014, 5, 4);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.7) / (rows + 0.4);
      const y = -0.25 + t * 0.54;
      let rad = 0.25;
      for (let k = 0; k < berryPts.length - 1; k++) {
        const [r0, y0] = berryPts[k], [r1, y1] = berryPts[k + 1];
        if (y >= y0 && y <= y1) {
          rad = r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
          break;
        }
      }
      const cols = Math.max(6, Math.round(rad * 46));
      for (let c = 0; c < cols; c++) {
        const a = (c / cols) * TAU + r * 0.36;
        const swell = 1 + 0.035 * Math.cos(a * 2);
        const sx = Math.cos(a) * rad * swell * 0.995;
        const sz = Math.sin(a) * rad * swell * 0.995;
        add(berryGrp, seedGeo, mSeedGold, sx, y, sz, 0, -a, 0, 0.75, 1.35, 0.65);
      }
    }

    // Lush starburst green leafy calyx (8 curling pointed sepals) + thick curved green stem!
    const sepalGeo = makeLeafGeo(THREE, 0.24, 0.058, 0.015, 0, -0.18, 0.22);
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * TAU + 0.2;
      const sGrp = new THREE.Group();
      sGrp.position.set(Math.cos(a) * 0.035, 0.335, Math.sin(a) * 0.035);
      sGrp.rotation.y = -a + PI / 2;
      berryGrp.add(sGrp);
      add(sGrp, sepalGeo, mClover, 0, 0, 0, s % 2 === 0 ? -0.18 : 0.06, 0, 0);
    }
    add(berryGrp, tube([
      [0, 0.33, 0],
      [0.02, 0.41, 0.01],
      [0.075, 0.465, 0.02],
    ], 0.022, 10, 7), mClover);
  }

  const BUILDERS = {
    bw_thimble_stool: buildThimbleStool,
    bw_spool_table: buildSpoolTable,
    bw_matchbox_bed: buildMatchboxBed,
    bw_acorn_lantern: buildAcornLantern,
    bw_inkwell_pot: buildInkwellPot,
    bw_sugar_crate: buildSugarCrate,
    bw_pocket_watch: buildPocketWatch,
    bw_mushroom_cluster: buildMushroomCluster,
    bw_teacup_planter: buildTeacupPlanter,
    bw_button_stack: buildButtonStack,
    bw_bottle_cap_chair: buildBottleCapChair,
    bw_strawberry_basket: buildStrawberryBasket,
  };

  // 3 Animated Miniature-Garden Insect Builders (preserve child hierarchy for kinematics!)
  const mkInsectMat = (hex, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({
    color: hex,
    roughness: 0.72,
    metalness: 0,
  }, extra));

  const addInst = (parent, geo, matRef, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, matRef);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  function buildBumblebee() {
    const mVelvet = mkInsectMat(0x28211e, { roughness: 0.90 });
    const mSaffron = mkInsectMat(0xf5bf2a, { roughness: 0.86, emissive: 0x3b2604, emissiveIntensity: 0.12 });
    const mCreamFluff = mkInsectMat(0xfcf4dc, { roughness: 0.90 });
    const mEye = mkInsectMat(0x161214, { roughness: 0.25 });
    const mWing = mkInsectMat(0xeef9ff, {
      roughness: 0.22, transparent: true, opacity: 0.74, side: THREE.DoubleSide,
      emissive: 0x8ad6f5, emissiveIntensity: 0.18,
    });

    const g = new THREE.Group();
    g.name = 'bw_bumblebee';
    g.userData.keep = true;

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.set(0, 0.26, 0);
    g.add(bodyGrp);

    // Fluffy bumblebee thorax & golden-and-black banded abdomen
    addInst(bodyGrp, new THREE.SphereGeometry(0.145, 12, 9), mVelvet, 0, 0.04, 0.05, 0, 0, 0, 1.05, 0.95, 1.05);
    addInst(bodyGrp, new THREE.TorusGeometry(0.118, 0.036, 6, 14), mSaffron, 0, 0.07, 0.12, PI / 2 - 0.3, 0, 0);
    addInst(bodyGrp, new THREE.SphereGeometry(0.165, 12, 10), mSaffron, 0, 0.02, -0.14, -0.15, 0, 0, 1.05, 0.96, 1.25);
    addInst(bodyGrp, new THREE.TorusGeometry(0.155, 0.038, 6, 16), mVelvet, 0, 0.025, -0.10);
    addInst(bodyGrp, new THREE.TorusGeometry(0.142, 0.036, 6, 16), mVelvet, 0, 0.015, -0.20);
    addInst(bodyGrp, new THREE.SphereGeometry(0.088, 9, 7), mCreamFluff, 0, 0.0, -0.32, 0, 0, 0, 1.0, 0.88, 0.92);

    // Tail tip stinger
    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(0, -0.01, -0.38);
    bodyGrp.add(tailGrp);
    addInst(tailGrp, new THREE.ConeGeometry(0.022, 0.07, 6), mEye, 0, 0, -0.03, -PI / 2, 0, 0);

    // Plump fuzzy bee head & curling antennae (+Z)
    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(0, 0.04, 0.21);
    bodyGrp.add(headGrp);
    addInst(headGrp, new THREE.SphereGeometry(0.095, 10, 8), mVelvet, 0, 0, 0, 0, 0, 0, 1.05, 0.92, 0.88);
    for (const sx of [-1, 1]) {
      addInst(headGrp, new THREE.SphereGeometry(0.042, 8, 6), mEye, sx * 0.068, 0.015, 0.038, 0, 0, 0, 0.75, 1.15, 0.85);
      addInst(headGrp, new THREE.CylinderGeometry(0.008, 0.010, 0.13, 6), mVelvet, sx * 0.042, 0.085, 0.065, 0.65, 0, sx * -0.28);
    }

    // Four iridescent translucent bee wings (`wingL/R` & `wing2L/R`)
    for (const sx of [-1, 1]) {
      const fWing = new THREE.Group();
      fWing.name = sx < 0 ? 'wingL' : 'wingR';
      fWing.position.set(sx * 0.09, 0.13, 0.06);
      bodyGrp.add(fWing);
      addInst(fWing, new THREE.SphereGeometry(1, 10, 6), mWing, sx * 0.17, 0.01, -0.03, 0.05, sx * -0.22, 0, 0.19, 0.014, 0.085);
      addInst(fWing, new THREE.BoxGeometry(0.32, 0.012, 0.016), mVelvet, sx * 0.16, 0.016, 0.02, 0, sx * -0.20, 0);

      const hWing = new THREE.Group();
      hWing.name = sx < 0 ? 'wing2L' : 'wing2R';
      hWing.position.set(sx * 0.08, 0.11, -0.02);
      bodyGrp.add(hWing);
      addInst(hWing, new THREE.SphereGeometry(1, 8, 5), mWing, sx * 0.125, 0.0, -0.05, 0.04, sx * -0.42, 0, 0.135, 0.012, 0.062);
    }

    // 6 nimble furry legs (`legsA`, `legsB`)
    const legsA = new THREE.Group();
    legsA.name = 'legsA';
    legsA.position.set(0, 0.18, 0);
    g.add(legsA);
    const legsB = new THREE.Group();
    legsB.name = 'legsB';
    legsB.position.set(0, 0.18, 0);
    g.add(legsB);
    for (let i = 0; i < 3; i++) {
      const zOff = 0.09 - i * 0.095;
      addInst(i % 2 === 0 ? legsA : legsB, new THREE.CylinderGeometry(0.014, 0.010, 0.17, 6), mVelvet, -0.105, -0.085, zOff, 0, 0, -0.26);
      addInst(i % 2 === 0 ? legsB : legsA, new THREE.CylinderGeometry(0.014, 0.010, 0.17, 6), mVelvet, 0.105, -0.085, zOff, 0, 0, 0.26);
    }

    attachCreatureKinematics(g, { mode: 'insect_hover', canFly: true });
    return g;
  }

  function buildDragonfly(variant = 'teal') {
    const isSapphire = variant === 'sapphire';
    const mBody = mkInsectMat(isSapphire ? 0x2c6bd4 : 0x1d9e8a, {
      roughness: 0.42, emissive: isSapphire ? 0x0b2a6e : 0x064038, emissiveIntensity: 0.20,
    });
    const mAccent = mkInsectMat(isSapphire ? 0x6ce0ff : 0x9ef566, {
      roughness: 0.48, emissive: isSapphire ? 0x1888b8 : 0x2a6614, emissiveIntensity: 0.22,
    });
    const mEye = mkInsectMat(0x521d6b, { roughness: 0.24, emissive: 0x3b0c4f, emissiveIntensity: 0.25 });
    const mWing = mkInsectMat(0xecfbff, {
      roughness: 0.18, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
      emissive: 0x94ecff, emissiveIntensity: 0.22,
    });

    const g = new THREE.Group();
    g.name = `bw_dragonfly_${variant}`;
    g.userData.keep = true;

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.set(0, 0.25, 0.06);
    g.add(bodyGrp);

    // Sculpted jewel thorax
    addInst(bodyGrp, new THREE.SphereGeometry(0.115, 11, 9), mBody, 0, 0.04, 0.04, 0, 0, 0, 0.92, 0.96, 1.32);
    addInst(bodyGrp, new THREE.SphereGeometry(0.078, 9, 7), mAccent, 0, 0.09, 0.04, 0, 0, 0, 0.9, 0.45, 1.1);

    // Big wraparound jewel compound eyes (+Z)
    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(0, 0.05, 0.20);
    bodyGrp.add(headGrp);
    addInst(headGrp, new THREE.SphereGeometry(0.072, 10, 8), mBody, 0, 0, 0);
    for (const sx of [-1, 1]) {
      addInst(headGrp, new THREE.SphereGeometry(0.056, 9, 7), mEye, sx * 0.052, 0.012, 0.018);
    }

    // Long slender 5-segment jewel abdomen extending -Z
    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(0, 0.02, -0.09);
    bodyGrp.add(tailGrp);
    for (let s = 0; s < 5; s++) {
      const rr = 0.044 - s * 0.004;
      addInst(tailGrp, new THREE.CylinderGeometry(rr, rr * 0.9, 0.088, 8), s % 2 === 0 ? mBody : mAccent,
        0, 0, -0.045 - s * 0.082, PI / 2, 0, 0);
    }

    // 4 Wide gossamer tandem dragonfly wings!
    for (const sx of [-1, 1]) {
      const w1 = new THREE.Group();
      w1.name = sx < 0 ? 'wingL' : 'wingR';
      w1.position.set(sx * 0.07, 0.11, 0.06);
      bodyGrp.add(w1);
      addInst(w1, new THREE.SphereGeometry(1, 10, 5), mWing, sx * 0.22, 0.0, 0.02, 0.04, sx * -0.10, 0, 0.24, 0.012, 0.062);
      addInst(w1, new THREE.BoxGeometry(0.42, 0.010, 0.015), mBody, sx * 0.21, 0.008, 0.05, 0, sx * -0.08, 0);

      const w2 = new THREE.Group();
      w2.name = sx < 0 ? 'wing2L' : 'wing2R';
      w2.position.set(sx * 0.07, 0.10, -0.03);
      bodyGrp.add(w2);
      addInst(w2, new THREE.SphereGeometry(1, 10, 5), mWing, sx * 0.20, 0.0, -0.04, 0.03, sx * -0.26, 0, 0.21, 0.012, 0.058);
      addInst(w2, new THREE.BoxGeometry(0.38, 0.010, 0.014), mBody, sx * 0.19, 0.008, -0.02, 0, sx * -0.22, 0);
    }

    const legsA = new THREE.Group();
    legsA.name = 'legsA';
    legsA.position.set(0, 0.18, 0.06);
    g.add(legsA);
    const legsB = new THREE.Group();
    legsB.name = 'legsB';
    legsB.position.set(0, 0.18, 0.06);
    g.add(legsB);
    for (let i = 0; i < 3; i++) {
      const zOff = 0.09 - i * 0.075;
      addInst(i % 2 === 0 ? legsA : legsB, new THREE.CylinderGeometry(0.010, 0.008, 0.16, 6), mBody, -0.078, -0.08, zOff, 0.18, 0, -0.28);
      addInst(i % 2 === 0 ? legsB : legsA, new THREE.CylinderGeometry(0.010, 0.008, 0.16, 6), mBody, 0.078, -0.08, zOff, 0.18, 0, 0.28);
    }

    attachCreatureKinematics(g, { mode: 'insect_hover', canFly: true });
    return g;
  }

  function buildLadybug() {
    const mCrimson = mkInsectMat(0xd92828, { roughness: 0.28, emissive: 0x3b0404, emissiveIntensity: 0.12, side: THREE.DoubleSide });
    const mCharcoal = mkInsectMat(0x222024, { roughness: 0.65 });
    const mCream = mkInsectMat(0xfdf6e2, { roughness: 0.72 });
    const mWing = mkInsectMat(0xf2faff, {
      roughness: 0.22, transparent: true, opacity: 0.66, side: THREE.DoubleSide,
    });

    const g = new THREE.Group();
    g.name = 'bw_ladybug';
    g.userData.keep = true;

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.set(0, 0.12, 0);
    g.add(bodyGrp);

    // Dark beetle underbody & head/pronotum (+Z)
    addInst(bodyGrp, new THREE.SphereGeometry(0.24, 14, 10), mCharcoal, 0, 0.06, -0.02, 0, 0, 0, 0.96, 0.45, 1.12);
    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(0, 0.11, 0.21);
    bodyGrp.add(headGrp);
    addInst(headGrp, new THREE.SphereGeometry(0.115, 10, 8), mCharcoal, 0, 0.0, 0, 0, 0, 0, 1.15, 0.75, 0.95);
    for (const sx of [-1, 1]) {
      addInst(headGrp, new THREE.SphereGeometry(0.032, 7, 5), mCream, sx * 0.072, 0.02, 0.065);
      addInst(headGrp, new THREE.CylinderGeometry(0.008, 0.008, 0.10, 5), mCharcoal, sx * 0.045, 0.065, 0.085, 0.72, 0, sx * -0.35);
    }

    // Split Glossy Red Elytra Wing Covers (`elytraL`, `elytraR` pivoted at +Z hinge so they flare open on jumps!)
    const mkElytron = (sx) => {
      const el = new THREE.Group();
      el.name = sx < 0 ? 'elytraL' : 'elytraR';
      el.position.set(sx * 0.02, 0.14, 0.12);
      bodyGrp.add(el);
      const halfDome = new THREE.SphereGeometry(0.26, 14, 10, sx < 0 ? -PI * 0.5 : PI * 0.5, PI, 0, PI * 0.52);
      addInst(el, halfDome, mCrimson, -sx * 0.01, -0.06, -0.14, 0, 0, 0, 0.98, 0.95, 1.15);
      // Charcoal polka dots riding directly with each shell half!
      addInst(el, new THREE.SphereGeometry(0.046, 8, 6), mCharcoal, sx * 0.11, 0.125, -0.09, 0, 0, 0, 1.0, 0.45, 1.0);
      addInst(el, new THREE.SphereGeometry(0.052, 8, 6), mCharcoal, sx * 0.15, 0.065, -0.22, 0, 0, 0, 1.0, 0.45, 1.0);
      addInst(el, new THREE.SphereGeometry(0.040, 8, 6), mCharcoal, sx * 0.09, 0.055, -0.34, 0, 0, 0, 1.0, 0.45, 1.0);

      // Hidden gauze underwing flashing when elytra spread
      const uw = new THREE.Group();
      uw.name = sx < 0 ? 'wingL' : 'wingR';
      uw.position.set(sx * 0.06, 0.15, 0.06);
      uw.visible = false;
      bodyGrp.add(uw);
      addInst(uw, new THREE.SphereGeometry(1, 8, 5), mWing, sx * 0.17, 0.0, -0.08, 0.05, sx * -0.25, 0, 0.19, 0.012, 0.09);
    };
    mkElytron(-1);
    mkElytron(1);

    const legsA = new THREE.Group();
    legsA.name = 'legsA';
    legsA.position.set(0, 0.10, 0);
    g.add(legsA);
    const legsB = new THREE.Group();
    legsB.name = 'legsB';
    legsB.position.set(0, 0.10, 0);
    g.add(legsB);
    for (let i = 0; i < 3; i++) {
      const zOff = 0.10 - i * 0.11;
      addInst(i % 2 === 0 ? legsA : legsB, new THREE.CylinderGeometry(0.016, 0.012, 0.12, 6), mCharcoal, -0.20, -0.05, zOff, 0, 0, -0.45);
      addInst(i % 2 === 0 ? legsB : legsA, new THREE.CylinderGeometry(0.016, 0.012, 0.12, 6), mCharcoal, 0.20, -0.05, zOff, 0, 0, 0.45);
    }

    attachCreatureKinematics(g, { mode: 'scuttle_beetle', canFly: false });
    return g;
  }

  const out = {};
  for (const p of PROPS) {
    if (!BUILDERS[p.id]) continue;
    out[p.id] = () => {
      const grp = buildMergedProto(p.id, BUILDERS[p.id]);
      grp.traverse((m) => {
        if (m.isMesh && m.material && typeof m.material.metalness === 'number') {
          m.material.metalness = 0;
        }
      });
      return grp;
    };
  }
  out.bw_bumblebee = buildBumblebee;
  out.bw_dragonfly = () => buildDragonfly('teal');
  out.bw_dragonfly_sapphire = () => buildDragonfly('sapphire');
  out.bw_ladybug = buildLadybug;
  return out;
}

export function buildBumblebee(THREE) {
  return buildMapProps(THREE).bw_bumblebee();
}

export function buildDragonflyVariant(THREE, variant = 'teal') {
  const kit = buildMapProps(THREE);
  return variant === 'sapphire' ? kit.bw_dragonfly_sapphire() : kit.bw_dragonfly();
}

export function buildLadybug(THREE) {
  return buildMapProps(THREE).bw_ladybug();
}

// ============================================================================
// Custom Tiny-Folk Hiding-Spot Disguises (`buildCustomSpotDisguise` in map.js)
// ============================================================================
export function buildTeacupHiderDisguise(THREE) {
  const g = new THREE.Group();
  const petalM = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.74, metalness: 0 });
  const centerM = new THREE.MeshStandardMaterial({ color: 0xe5b84b, roughness: 0.68, metalness: 0 });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x66aa3e, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const spoonM = new THREE.MeshStandardMaterial({ color: 0xb8c8d8, roughness: 0.52, metalness: 0 });
  const sugarM = new THREE.MeshStandardMaterial({ color: 0xfbf7ec, roughness: 0.48, metalness: 0 });

  // Floating shamrock clover leaves & chamomile blossoms resting on warm tea inside the cup
  const cloverGeo = makeLeafGeo(THREE, 0.24, 0.13, 0.018, 0.24, 0.06, 0.16);
  for (let i = 0; i < 3; i++) {
    const lm = new THREE.Mesh(cloverGeo, leafM);
    lm.position.set(-0.08, 0.34, 0.05);
    lm.rotation.set(0.12, (i / 3) * TAU + 0.3, 0);
    lm.castShadow = true;
    g.add(lm);
  }
  // Floating chamomile flower
  const fl = new THREE.Group();
  fl.position.set(0.14, 0.37, -0.08);
  g.add(fl);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), centerM);
  disc.scale.set(1, 0.55, 1);
  fl.add(disc);
  const pGeo = new THREE.SphereGeometry(1, 7, 5);
  pGeo.scale(0.045, 0.018, 0.13);
  for (let p = 0; p < 10; p++) {
    const a = (p / 10) * TAU;
    const pm = new THREE.Mesh(pGeo, petalM);
    pm.position.set(Math.sin(a) * 0.14, -0.01, Math.cos(a) * 0.14);
    pm.rotation.set(0.1, a, 0);
    fl.add(pm);
  }
  // Silver-blue Tinyfolk sugar spoon leaning up against inside of teacup + sugar cube
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, TAU, PI * 0.5, PI * 0.5), spoonM);
  bowl.position.set(-0.04, 0.28, -0.14);
  bowl.scale.set(0.85, 0.55, 1.25);
  g.add(bowl);
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.04, 0.28, -0.02),
    new THREE.Vector3(0.12, 0.56, 0.18),
    new THREE.Vector3(0.28, 0.86, 0.34),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.022, 7, false), spoonM);
  handle.castShadow = true;
  g.add(handle);
  const sugar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), sugarM);
  sugar.position.set(-0.04, 0.33, -0.14);
  sugar.rotation.set(0.1, 0.4, 0.08);
  g.add(sugar);
  return g;
}

export function buildFlowerpotHiderDisguise(THREE) {
  const g = new THREE.Group();
  const mossM = new THREE.MeshStandardMaterial({ color: 0x6ba642, roughness: 0.90, metalness: 0 });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x5ea238, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const copperM = new THREE.MeshStandardMaterial({ color: 0xc97640, roughness: 0.56, metalness: 0 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0xba8248, roughness: 0.84, metalness: 0 });

  for (const [mx, my, mz, r] of [[0, 0.22, 0, 0.28], [-0.16, 0.20, 0.12, 0.18], [0.18, 0.21, -0.10, 0.19]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mossM);
    m.scale.set(1.2, 0.55, 1.15);
    m.position.set(mx, my, mz);
    g.add(m);
  }
  const cloverGeo = makeLeafGeo(THREE, 0.26, 0.14, 0.018, 0.24, 0.08, 0.16);
  for (const [sx, sy, sz, n] of [[-0.08, 0.62, 0.04, 4], [0.14, 0.52, -0.08, 3]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, sy - 0.18, 6), leafM);
    st.position.set(sx * 0.6, (sy + 0.18) * 0.5, sz * 0.6);
    g.add(st);
    for (let i = 0; i < n; i++) {
      const lf = new THREE.Mesh(cloverGeo, leafM);
      lf.position.set(sx, sy, sz);
      lf.rotation.set(0.16, (i / n) * TAU + 0.2, 0);
      g.add(lf);
    }
  }
  // Mini copper hand-trowel stuck into potting moss
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.03), copperM);
  blade.position.set(0.12, 0.34, 0.12);
  blade.rotation.set(-0.28, 0.4, -0.22);
  g.add(blade);
  const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.24, 8), woodM);
  hdl.position.set(0.18, 0.54, 0.18);
  hdl.rotation.set(-0.28, 0.4, -0.22);
  g.add(hdl);
  return g;
}

export function buildBurrowAcornDisguise(THREE) {
  const g = new THREE.Group();
  const mossM = new THREE.MeshStandardMaterial({ color: 0x6ca240, roughness: 0.92, metalness: 0 });
  const nutM = new THREE.MeshStandardMaterial({ color: 0xa86b36, roughness: 0.72, metalness: 0 });
  const capM = new THREE.MeshStandardMaterial({ color: 0x6b4424, roughness: 0.88, metalness: 0 });
  const glowM = new THREE.MeshStandardMaterial({
    color: 0xffe49c, emissive: 0xffa834, emissiveIntensity: 1.45, roughness: 0.42, metalness: 0,
  });
  const stemM = new THREE.MeshStandardMaterial({ color: 0xf4ebd8, roughness: 0.86, metalness: 0 });

  // Plump forest-moss nest base
  for (const [mx, my, mz, r] of [[0, 0.14, 0, 0.34], [-0.22, 0.12, 0.12, 0.22], [0.22, 0.12, -0.10, 0.24]]) {
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mossM);
    tuft.scale.set(1.25, 0.52, 1.15);
    tuft.position.set(mx, my, mz);
    tuft.castShadow = true;
    g.add(tuft);
  }
  // 2 Cozy Oak Acorns nestled in the moss
  for (const [ax, ay, az, rx, rz, sc] of [[-0.08, 0.30, 0.03, 0.35, 0.42, 1.0], [0.16, 0.25, -0.06, -0.28, -0.52, 0.82]]) {
    const ac = new THREE.Group();
    ac.position.set(ax, ay, az);
    ac.rotation.set(rx, 0.2, rz);
    ac.scale.setScalar(sc);
    g.add(ac);
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), nutM);
    nut.scale.set(0.92, 1.28, 0.92);
    ac.add(nut);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 8, 0, TAU, 0, PI * 0.48), capM);
    cap.position.y = 0.05;
    ac.add(cap);
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.11, 6), capM);
    twig.position.y = 0.25;
    ac.add(twig);
  }
  // 3 Tiny Bioluminescent Amber Burrow Mushrooms
  for (const [bx, bz, h, r] of [[0.04, 0.18, 0.28, 0.085], [-0.20, -0.12, 0.22, 0.068], [0.22, 0.12, 0.19, 0.058]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, h, 7), stemM);
    st.position.set(bx, 0.12 + h * 0.5, bz);
    g.add(st);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 7, 0, TAU, 0, PI * 0.55), glowM);
    cap.position.set(bx, 0.12 + h - r * 0.2, bz);
    g.add(cap);
  }
  return g;
}
