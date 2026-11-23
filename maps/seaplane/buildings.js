/* Hue & Seek — Map 3: Porto Sereno Seaplane Cove (`maps/seaplane/buildings.js`).
 * Hand-sculpted storybook Adriatic architecture matching Codex's
 * `assets/maps/seaplane/buildings_sheet.png`, `interiors_sheet.png`, and `overview.png`.
 *
 * Exports:
 *   - BUILDING_DEFS: 5 enterable 2-room harbor buildings
 *   - buildBuildings(THREE): builders for all 5 buildings + landmarks:
 *       sereno_hangar, adriano_trattoria, harbor_lighthouse, coastal_gelateria, boathouse_loft,
 *       seahorseFountain, harborKiosk, crimsonSeaplane, woodenPier, rowboat
 */
import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
  mergeStatic,
} from '../map_kit.js?v=2';

const PI = Math.PI;

export const BUILDING_DEFS = [
  { id: 'sereno_hangar', label: 'Gabbiano Seaplane Hangar' },
  { id: 'adriano_trattoria', label: 'Trattoria Bella Vista' },
  { id: 'harbor_lighthouse', label: 'Harbor Lighthouse' },
  { id: 'coastal_gelateria', label: 'Coastal Gelateria' },
  { id: 'boathouse_loft', label: 'Fisherman Boathouse' },
];

// Normalize `(opts)` vs `(THREE, opts)` calls so both `maps_gallery.html` and `main.js` work seamlessly
function bindBuilder(THREE, fn) {
  return (a = {}, b = {}) => {
    const opts = a && (a.Scene || a.Group || a.Mesh || a.Vector3) ? b : a;
    return fn(THREE, opts || {});
  };
}

// Tag every static mesh with `userData.paint` AND enforce `metalness = 0` on every MeshStandardMaterial
function tagPaintColors(THREE, root, fallbackHex = 0xefe3cb) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && m.isMeshStandardMaterial) m.metalness = 0;
    }
    if (o.userData.ground) return;
    if (!o.userData.paint) {
      const mat = mats[0];
      o.userData.paint = new THREE.Color(mat && mat.color ? mat.color.getHex() : fallbackHex);
    }
  });
  return root;
}

// Helper to append an explicit standable furniture collider (`h` in 0.40..1.40m) after `finalize()`
function addStandableCols(root, list) {
  if (!root.userData.colliders) root.userData.colliders = [];
  for (const [x, z, w, d, h, rot] of list) {
    const rec = { x: +x.toFixed(3), z: +z.toFixed(3), w: +w.toFixed(3), d: +d.toFixed(3), h: +h.toFixed(3) };
    if (rot) rec.rot = +rot.toFixed(4);
    root.userData.colliders.push(rec);
  }
}

// Shared procedural canvas textures for Adriatic tiles, mosaic waves, charts & signs
function checkeredFloorTex(THREE, key, hexA, hexB, repeatX = 5, repeatY = 5) {
  return paintedCanvasTex(THREE, key, 256, (g, s, rng) => {
    const half = s / 2;
    for (let iy = 0; iy < 2; iy++) {
      for (let ix = 0; ix < 2; ix++) {
        g.fillStyle = (ix + iy) % 2 === 0 ? hexA : hexB;
        g.fillRect(ix * half, iy * half, half, half);
      }
    }
    brushStrokes(g, s, rng, 220, ['#ffffff', '#e6d8be', '#bfa98a'], 1.2, 3.8, 0.18, 0.4, 2.4, 26);
    g.strokeStyle = 'rgba(92,70,48,0.22)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
    g.beginPath();
    g.moveTo(half, 0); g.lineTo(half, s);
    g.moveTo(0, half); g.lineTo(s, half);
    g.stroke();
  }, repeatX, repeatY);
}

function seaChartTex(THREE) {
  return paintedCanvasTex(THREE, 'sp_nautical_chart', 256, (g, s, rng) => {
    g.fillStyle = '#f3e4bf';
    g.fillRect(0, 0, s, s);
    // Azure sea bay
    g.fillStyle = '#8ecae6';
    g.beginPath();
    g.moveTo(s * 0.25, s);
    g.bezierCurveTo(s * 0.18, s * 0.55, s * 0.48, s * 0.2, s, s * 0.15);
    g.lineTo(s, s);
    g.closePath();
    g.fill();
    // Islands & rhumb lines
    g.fillStyle = '#dfc590';
    for (const [cx, cy, r] of [[168, 130, 22], [212, 92, 14], [142, 185, 16]]) {
      g.beginPath(); g.arc(cx, cy, r, 0, PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(130,78,42,0.45)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      g.beginPath();
      g.moveTo(155, 150);
      g.lineTo(155 + Math.cos(a) * 140, 150 + Math.sin(a) * 140);
      g.stroke();
    }
    // Compass star
    g.fillStyle = '#c83e37';
    g.beginPath(); g.arc(155, 150, 8, 0, PI * 2); g.fill();
    brushStrokes(g, s, rng, 90, ['#fff6de', '#d8be8a'], 1, 2.5, 0.15, 0, 3.14, 18);
  });
}

function waveMosaicTex(THREE) {
  return paintedCanvasTex(THREE, 'sp_fountain_mosaic', 256, (g, s, rng) => {
    g.fillStyle = '#f5ebd0';
    g.fillRect(0, 0, s, s);
    // Gold & cobalt trim bands
    g.fillStyle = '#d9a13b';
    g.fillRect(0, 12, s, 20);
    g.fillRect(0, s - 32, s, 20);
    g.fillStyle = '#1d5fa8';
    g.fillRect(0, 36, s, s - 72);
    // Scrolling Mediterranean turquoise & cream wave curls
    for (let i = -1; i < 5; i++) {
      const x = i * 64;
      g.strokeStyle = '#6fe0eb';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(x + 32, s * 0.54, 24, PI * 0.95, PI * 2.05);
      g.stroke();
      g.strokeStyle = '#fff6dc';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(x + 32, s * 0.54, 17, PI * 1.05, PI * 1.98);
      g.stroke();
    }
    // Tesserae tile grid hint
    g.strokeStyle = 'rgba(255,245,220,0.22)';
    g.lineWidth = 1.2;
    for (let u = 0; u < s; u += 12) {
      g.beginPath(); g.moveTo(u, 0); g.lineTo(u, s); g.stroke();
      g.beginPath(); g.moveTo(0, u); g.lineTo(s, u); g.stroke();
    }
    brushStrokes(g, s, rng, 80, ['#2980cf', '#f7cf68', '#ffffff'], 1, 2.2, 0.16, 0, 3.14, 14);
  }, 4, 1);
}

// Shared primitive caches per THREE instance for instanced terracotta tiles & Storybook foliage
let PRIM_CACHE = null;
function getPrims(THREE) {
  if (PRIM_CACHE && PRIM_CACHE.T === THREE) return PRIM_CACHE;
  const barrel = new THREE.CylinderGeometry(0.105, 0.118, 0.52, 7, 1, false, 0, PI);
  barrel.rotateZ(PI / 2);
  barrel.rotateY(PI / 2);
  const leaf = new THREE.SphereGeometry(0.16, 7, 5);
  leaf.scale(1.15, 0.62, 0.92);
  const bloom = new THREE.DodecahedronGeometry(0.115, 0);
  const lemon = new THREE.SphereGeometry(0.072, 8, 6);
  lemon.scale(0.85, 1.22, 0.85);
  PRIM_CACHE = { T: THREE, barrel, leaf, bloom, lemon };
  return PRIM_CACHE;
}

// ============================================================================
// Reusable Architectural Detailing Helpers
// ============================================================================
function addCornerQuoins(kit, W, D, y0, y1, stoneMat, step = 0.44) {
  const { add, rbox } = kit;
  let idx = 0;
  for (let y = y0 + step * 0.5; y < y1 - 0.08; y += step, idx++) {
    const longX = idx % 2 === 0;
    const qw = longX ? 0.42 : 0.28;
    const qd = longX ? 0.28 : 0.42;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(
          rbox(qw, step * 0.88, qd, 0.035, stoneMat),
          sx * (W / 2 - qw / 2 + 0.045),
          y,
          sz * (D / 2 - qd / 2 + 0.045)
        );
      }
    }
  }
}

function addStoneArchTrim(kit, cx, cz, rotY, w, h, stoneMat, parent) {
  const { THREE } = kit;
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  (parent || kit.root).add(g);
  const r = w / 2;
  const springY = Math.max(0.25, h - r);
  // Jamb blocks
  for (const s of [-1, 1]) {
    for (let y = 0.24; y < springY - 0.05; y += 0.44) {
      kit.add(kit.rbox(0.24, 0.4, 0.34, 0.03, stoneMat), s * (r + 0.11), y, -0.12, 0, 0, 0, g);
    }
  }
  // Voussoirs around arch
  const segs = 9;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * PI;
    const isKey = i === Math.floor(segs / 2);
    const vx = Math.cos(a) * (r + 0.12);
    const vy = springY + Math.sin(a) * (r + 0.12);
    kit.add(
      kit.rbox(isKey ? 0.28 : 0.23, isKey ? 0.34 : 0.26, 0.35, 0.03, stoneMat),
      vx, vy, -0.12, 0, 0, a - PI / 2, g
    );
  }
}

function addShutteredWindow(kit, THREE, cx, y0, cz, rotY, w, h, mats, opts = {}) {
  const g = new THREE.Group();
  g.position.set(cx, y0, cz);
  g.rotation.y = rotY;
  const P = opts.parent || kit.root;
  P.add(g);
  const { rbox, add, pushInst } = kit;
  const prims = getPrims(THREE);
  // Limestone sill & lintel
  add(rbox(w + 0.26, 0.11, 0.36, 0.025, mats.stone), 0, -0.04, -0.08, 0, 0, 0, g);
  add(rbox(w + 0.22, 0.12, 0.32, 0.025, mats.stone), 0, h + 0.05, -0.09, 0, 0, 0, g);
  // Glass pane + timber mullions
  add(rbox(w - 0.04, h - 0.04, 0.05, 0.01, mats.glass), 0, h / 2, -0.13, 0, 0, 0, g);
  add(rbox(0.055, h, 0.09, 0.012, mats.frame), 0, h / 2, -0.11, 0, 0, 0, g);
  add(rbox(w, 0.055, 0.09, 0.012, mats.frame), 0, h * 0.52, -0.11, 0, 0, 0, g);
  // Open louvered shutters
  if (opts.shutters !== false && mats.shutter) {
    const sw = w * 0.48;
    for (const s of [-1, 1]) {
      add(rbox(sw, h - 0.02, 0.06, 0.015, mats.shutter), s * (w / 2 + sw * 0.48), h / 2, 0.04, 0, -s * 0.26, 0, g);
      add(rbox(sw * 0.78, h * 0.76, 0.08, 0.012, mats.shutterDark || mats.shutter), s * (w / 2 + sw * 0.48), h / 2, 0.045, 0, -s * 0.26, 0, g);
    }
  }
  // Terracotta flower box with geraniums
  if (opts.flowerBox && mats.terra) {
    add(rbox(w + 0.12, 0.2, 0.24, 0.03, mats.terra), 0, -0.14, 0.09, 0, 0, 0, g);
    const c = Math.cos(rotY), sn = Math.sin(rotY);
    const bloomHex = opts.bloomHex || 0xe83b48;
    for (let i = -2; i <= 2; i++) {
      const lx = i * (w * 0.19), lz = 0.11;
      const wx = cx + lx * c + lz * sn, wz = cz - lx * sn + lz * c;
      pushInst('foliage', prims.leaf, mats.foliageInst, wx, y0 - 0.01, wz, 0.1, i * 0.7, 0, 0.9, 0.85, 0.9, 0x3e8438, P);
      pushInst('bloom', prims.bloom, mats.foliageInst, wx + sn * 0.04, y0 + 0.07, wz + c * 0.04, 0.3, i, 0.2, 0.85, 0.85, 0.85, bloomHex, P);
    }
  }
}

function addStripedAwning(kit, cx, yTop, cz, w, drop, proj, matA, matB, ironMat, P) {
  const { rbox, add, beam } = kit;
  const parent = P || kit.root;
  const tilt = Math.atan2(drop, proj);
  const slopeLen = Math.hypot(drop, proj);
  const stripes = Math.max(7, Math.round(w / 0.36));
  const sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    const m = i % 2 === 0 ? matA : matB;
    const sx = cx - w / 2 + (i + 0.5) * sw;
    add(rbox(sw + 0.012, 0.055, slopeLen, 0.018, m), sx, yTop - drop * 0.5, cz + proj * 0.5, tilt, 0, 0, parent);
    // Scalloped front valance tab
    add(rbox(sw * 0.94, 0.2, 0.045, 0.04, m), sx, yTop - drop - 0.08, cz + proj - 0.02, 0, 0, 0, parent);
  }
  // Wrought-iron brackets & front bar
  add(rbox(w + 0.06, 0.045, 0.045, 0.015, ironMat), cx, yTop - drop, cz + proj - 0.04, 0, 0, 0, parent);
  for (const s of [-1, 1]) {
    const bx = cx + s * (w * 0.46);
    beam([bx, yTop - drop - 0.28, cz + 0.02], [bx, yTop - drop, cz + proj - 0.05], 0.04, ironMat, parent);
    beam([bx, yTop - 0.04, cz + 0.02], [bx, yTop - drop, cz + proj - 0.05], 0.035, ironMat, parent);
  }
}

// Terracotta barrel-tile gable roof (all placed inside `roofG` so interior cutaway hides cleanly!)
function addGableBarrelRoof(kit, THREE, cfg) {
  const {
    cx = 0, cz = 0, W, D, wallH, rise = 1.45, overX = 0.42, overZ = 0.45,
    wallMat, innerMat, timberMat, tileInstMat, skylightSide = 0, gableVent = true,
  } = cfg;
  const { roofG, addR, rbox, pushInst, jr, pick } = kit;
  const prims = getPrims(THREE);
  const halfSpan = W / 2 + overX;
  const roofD = D + overZ * 2;
  const slope = Math.hypot(halfSpan, rise);
  const pitch = Math.atan2(rise, halfSpan);

  // Front & back triangular stucco gables in `roofG`
  for (const sz of [-1, 1]) {
    const gs = new THREE.Shape();
    gs.moveTo(-W / 2, 0);
    gs.lineTo(W / 2, 0);
    gs.lineTo(0, rise);
    gs.closePath();
    const gGeo = new THREE.ExtrudeGeometry(gs, { depth: 0.24, bevelEnabled: false });
    gGeo.translate(0, 0, -0.12);
    addR(new THREE.Mesh(gGeo, wallMat), cx, wallH - 0.02, cz + sz * (D / 2 - 0.12));
    if (innerMat) {
      addR(new THREE.Mesh(gGeo.clone(), innerMat), cx, wallH - 0.02, cz + sz * (D / 2 - 0.22), 0, 0, 0);
    }
    if (gableVent) {
      addR(rbox(0.56, 0.56, 0.3, 0.04, timberMat), cx, wallH + rise * 0.52, cz + sz * (D / 2 - 0.08));
    }
  }

  // Timber ridge beam, purlins & sloped cedar roof deck
  addR(rbox(0.22, 0.24, roofD, 0.04, timberMat), cx, wallH + rise - 0.08, cz);
  for (const sx of [-1, 1]) {
    const mx = cx + sx * (halfSpan * 0.5);
    const my = wallH + rise * 0.5;
    addR(rbox(slope, 0.1, roofD, 0.025, timberMat), mx, my, cz, 0, 0, -sx * pitch);
    // Exposed rafter tails along eaves
    const rafters = Math.max(6, Math.round(roofD / 0.85));
    for (let i = 0; i <= rafters; i++) {
      const rz = cz - roofD / 2 + (i / rafters) * roofD;
      addR(rbox(0.38, 0.09, 0.09, 0.02, timberMat), cx + sx * (halfSpan - 0.08), wallH - 0.02, rz, 0, 0, -sx * pitch);
    }
  }

  // Instanced warm terracotta barrel tiles across both slopes + ridge cap tiles
  // (`terracotta` kit texture is already richly coloured, so tint with warm sunlit creams/ochres!)
  const tilePalette = [0xffd8b0, 0xf7be8a, 0xffe4c4, 0xf4a672, 0xffcfa0, 0xeba26c];
  const colsU = Math.max(8, Math.round(slope / 0.38));
  const rowsZ = Math.max(11, Math.round(roofD / 0.30));
  for (const sx of [-1, 1]) {
    for (let iu = 0; iu < colsU; iu++) {
      const t = (iu + 0.5) / colsU;
      const uDist = t * slope;
      const tx = cx + sx * Math.cos(pitch) * uDist;
      const ty = wallH + rise - Math.sin(pitch) * uDist + 0.095;
      for (let iz = 0; iz < rowsZ; iz++) {
        const tz = cz - roofD / 2 + (iz + 0.5) * (roofD / rowsZ);
        if (skylightSide === sx && Math.abs(tz - (cz + 0.2)) < 1.15 && t > 0.28 && t < 0.72) continue;
        pushInst(
          'barrel_tile',
          prims.barrel,
          tileInstMat,
          tx,
          ty + jr(-0.008, 0.008),
          tz,
          0,
          0,
          -sx * pitch,
          (roofD / rowsZ / 0.41),
          1.06,
          (slope / colsU / 0.42),
          pick(tilePalette),
          roofG
        );
      }
    }
  }
  // Ridge barrel tiles
  for (let iz = 0; iz < rowsZ; iz++) {
    const tz = cz - roofD / 2 + (iz + 0.5) * (roofD / rowsZ);
    pushInst('barrel_tile', prims.barrel, tileInstMat, cx, wallH + rise + 0.145, tz, 0, PI / 2, 0, 1.2, 1.18, (roofD / rowsZ) / 0.40, pick(tilePalette), roofG);
  }
}

function addStuccoChimney(kit, x, yBase, z, wallMat, stoneMat, terraMat) {
  const { addR, rbox } = kit;
  addR(rbox(0.68, 1.15, 0.68, 0.05, wallMat), x, yBase + 0.55, z);
  addR(rbox(0.82, 0.14, 0.82, 0.03, stoneMat), x, yBase + 1.14, z);
  for (const dx of [-0.16, 0.16]) {
    addR(new kit.THREE.Mesh(new kit.THREE.CylinderGeometry(0.1, 0.12, 0.34, 10), terraMat), x + dx, yBase + 1.35, z);
  }
}

function addBougainvillea(kit, THREE, pts, mats, bloomCols = [0xd92378, 0xf2449b, 0xb81864, 0xff6bb5], parent = null) {
  const prims = getPrims(THREE);
  const P = parent || kit.root;
  // Woody vine stem
  if (pts.length >= 2) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    kit.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.045, 6, false), mats.vine), 0, 0, 0, 0, 0, 0, P);
  }
  for (const [bx, by, bz, spread = 0.42, density = 7] of pts) {
    for (let i = 0; i < density; i++) {
      const ox = kit.jr(-spread, spread), oy = kit.jr(-spread * 0.75, spread * 0.75), oz = kit.jr(-spread * 0.5, spread * 0.5);
      kit.pushInst('foliage', prims.leaf, mats.foliageInst, bx + ox, by + oy, bz + oz, kit.jr(-0.5, 0.5), kit.jr(0, 6.2), kit.jr(-0.4, 0.4), kit.jr(0.85, 1.35), kit.jr(0.8, 1.2), kit.jr(0.85, 1.3), kit.pick([0x2f6e2e, 0x3f8539, 0x4b9640]), P);
      if (i % 3 !== 2) {
        kit.pushInst('bloom', prims.bloom, mats.foliageInst, bx + ox * 1.05, by + oy + 0.05, bz + oz + 0.05, kit.jr(0, 3), kit.jr(0, 3), 0, kit.jr(0.85, 1.45), kit.jr(0.85, 1.35), kit.jr(0.85, 1.45), kit.pick(bloomCols), P);
      }
    }
  }
}

// ============================================================================
// 1. SERENO SEAPLANE HANGAR (`sereno_hangar`)
// ============================================================================
function buildSerenoHangar(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'sereno_hangar', 11);
  kit.THREE = THREE;
  const { root, roofG, M, glowMat, tex, add, addR, rbox, boxCol, wall, beam, finalize } = kit;

  const W = 9.8, D = 7.8, H = 3.9, T = 0.26;
  const stucco = M(0xf6ead2, tex('plaster', 2.2, 1.8));
  const innerWall = M(0xfbf2df, tex('plaster', 2.2, 1.8));
  const stone = M(0xe3d5b8, tex('stone', 2.0, 2.0));
  const floorStone = M(0xd8ccb4, tex('stone', 4.2, 3.6));
  const floorWood = M(0xd8aa72, tex('wood_light', 3.5, 3.5));
  const doorGreen = M(0x95b384, tex('wood_light', 1.6, 1.6));
  const doorGreenDk = M(0x749465, tex('wood_light', 1.4, 1.4));
  const timber = M(0x8e5f36, tex('wood_light', 1.8, 1.8));
  const oakLight = M(0xc89558, tex('wood_light', 1.5, 1.5));
  const iron = M(0x464a50, null, { roughness: 0.62, metalness: 0 });
  const brass = M(0xe4b248, null, { roughness: 0.44, metalness: 0 });
  const lockerBlue = M(0x4d6f80, tex('painted_metal', 1.2, 1.2), { roughness: 0.65, metalness: 0 });
  const crimson = M(0xd12828, null, { roughness: 0.46, metalness: 0 });
  const glass = M(0x98d2ee, null, { roughness: 0.24, metalness: 0 });
  const lampGlow = glowMat(0xffe7a8, 0xffb347, 1.75);
  const chartMat = M(0xffffff, seaChartTex(THREE));
  const leather = M(0x734423, tex('bark', 1.2, 1.2));
  const creamCloth = M(0xfaf3e3, tex('burlap', 1.5, 1.5));
  const redStripe = M(0xd83b32, null, { roughness: 0.8, metalness: 0 });
  const vine = M(0x5c432b, tex('bark', 1, 2));
  const terra = M(0xd46d3f, tex('terracotta', 1, 1));
  const tileInstMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('terracotta', 0.6, 0.6), roughness: 0.88, metalness: 0 });
  const foliageInst = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });

  // Plinth & interior floors (workshop stone on left, timber office floor on right)
  add(rbox(W + 0.32, 0.06, D + 0.32, 0.02, stone), 0, 0.03, 0);
  add(rbox(6.18, 0.04, D - 0.36, 0.01, floorStone), -1.68, 0.055, 0);
  add(rbox(3.15, 0.045, D - 0.36, 0.01, floorWood), 3.08, 0.058, 0);
  // Woven red pilot rug in Room 2
  add(rbox(1.55, 0.02, 2.2, 0.008, redStripe), 2.85, 0.082, 0.45);
  add(rbox(1.32, 0.022, 1.95, 0.008, creamCloth), 2.85, 0.084, 0.45);

  // Hollow exterior walls (front hangar doorway w = 3.5m >= 1.48m!)
  wall(0, D / 2, 0, W, H, T, [
    { door: true, u: -1.35, w: 3.5, h: 3.02, arch: false },
    { u: 2.95, y0: 1.15, w: 1.15, h: 1.38, round: false },
  ], stucco, innerWall);
  wall(0, -D / 2, PI, W, H, T, [
    { u: -2.4, y0: 1.25, w: 1.35, h: 1.35, round: false },
    { u: 2.1, y0: 1.2, w: 1.35, h: 1.35, round: false },
  ], stucco, innerWall);
  wall(-W / 2, 0, -PI / 2, D, H, T, [
    { u: -1.65, y0: 1.2, w: 1.15, h: 1.35, round: false },
    { u: 1.75, y0: 1.2, w: 1.15, h: 1.35, round: false },
  ], stucco, innerWall);
  wall(W / 2, 0, PI / 2, D, H, T, [
    { u: 0.55, y0: 1.2, w: 1.25, h: 1.35, round: false },
  ], stucco, innerWall);

  // Interior partition wall at x = +1.45 with wide open stone arch (w = 1.76m at z = +0.35)
  wall(1.45 - T / 2, 0, -PI / 2, D - 2 * T, H, T, [
    { door: true, u: 0.35, w: 1.76, h: 2.72, arch: true },
  ], innerWall, innerWall);
  addStoneArchTrim(kit, 1.45 + 0.06, 0.35, -PI / 2, 1.76, 2.72, stone);

  // Limestone corner quoins + hangar opening timber lintel & arched fanlight window
  addCornerQuoins(kit, W, D, 0.06, H, stone);
  add(rbox(3.95, 0.22, 0.38, 0.03, timber), -1.35, 3.08, D / 2 - 0.12);
  // Semicircular clerestory fanlight above hangar doors (in roofG / upper front gable)
  const fanShape = new THREE.Shape();
  fanShape.absarc(0, 0, 1.65, 0, PI, false);
  fanShape.closePath();
  const fanGeo = new THREE.ExtrudeGeometry(fanShape, { depth: 0.08, bevelEnabled: false });
  addR(new THREE.Mesh(fanGeo, glass), -1.35, 3.22, D / 2 - 0.14);
  for (let i = 1; i < 5; i++) {
    const a = (i / 5) * PI;
    beam([-1.35, 3.22, D / 2 - 0.08], [-1.35 + Math.cos(a) * 1.62, 3.22 + Math.sin(a) * 1.62, D / 2 - 0.08], 0.045, iron, roofG);
  }
  addStoneArchTrim(kit, -1.35, D / 2 + 0.02, 0, 3.3, 4.88, stone, roofG);

  // Wide open green-painted timber bi-fold hangar doors (folded aside leaving 3.5m clear opening!)
  for (const [side, hx] of [[-1, -3.22], [1, 0.52]]) {
    for (let leaf = 0; leaf < 2; leaf++) {
      const lx = hx + side * (leaf * 0.22 + 0.14);
      const lz = D / 2 + 0.18 + leaf * 0.34;
      const ry = side * (leaf === 0 ? 0.32 : -0.38);
      add(rbox(0.84, 2.96, 0.09, 0.02, doorGreen), lx, 1.52, lz, 0, ry, 0);
      add(rbox(0.72, 0.14, 0.12, 0.02, doorGreenDk), lx, 2.75, lz, 0, ry, 0);
      add(rbox(0.72, 0.14, 0.12, 0.02, doorGreenDk), lx, 0.35, lz, 0, ry, 0);
      add(rbox(0.76, 0.11, 0.12, 0.015, doorGreenDk), lx, 1.52, lz, 0, ry, side * 0.62);
      add(rbox(0.45, 0.06, 0.13, 0.01, iron), lx, 2.55, lz, 0, ry, 0);
      add(rbox(0.45, 0.06, 0.13, 0.01, iron), lx, 0.55, lz, 0, ry, 0);
    }
    boxCol(hx + side * 0.24, D / 2 + 0.34, 0.72, 0.72);
  }

  // Mullioned windows + gooseneck hangar lamps
  const winMats = { stone, glass, frame: timber, shutter: doorGreen, shutterDark: doorGreenDk, terra, foliageInst };
  addShutteredWindow(kit, THREE, 2.95, 1.15, D / 2, 0, 1.15, 1.38, winMats, { flowerBox: true, bloomHex: 0xf05a7e });
  addShutteredWindow(kit, THREE, 2.4, 1.25, -D / 2, PI, 1.35, 1.35, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, -2.1, 1.2, -D / 2, PI, 1.35, 1.35, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, -W / 2, 1.2, -1.65, -PI / 2, 1.15, 1.35, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, -W / 2, 1.2, 1.75, -PI / 2, 1.15, 1.35, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, W / 2, 1.2, -0.55, PI / 2, 1.25, 1.35, winMats, { shutters: true });
  for (const lx of [-3.35, 0.65]) {
    beam([lx, 3.38, D / 2], [lx, 3.48, D / 2 + 0.42], 0.04, iron);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 12), iron), lx, 3.42, D / 2 + 0.44);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), lampGlow), lx, 3.33, D / 2 + 0.44);
  }

  // Terracotta barrel-tile gable roof + glass workshop skylight + chimney + fluttering WINDSOCK!
  addGableBarrelRoof(kit, THREE, {
    W, D, wallH: H, rise: 1.55, wallMat: stucco, innerMat: innerWall,
    timberMat: timber, tileInstMat, skylightSide: -1,
  });
  // Workshop roof skylight frame on left slope
  const pitch = Math.atan2(1.55, W / 2 + 0.42);
  addR(rbox(1.65, 0.12, 2.25, 0.025, iron), -2.55, H + 0.86, 0.2, 0, 0, pitch);
  addR(rbox(1.48, 0.08, 2.08, 0.015, glass), -2.55, H + 0.88, 0.2, 0, 0, pitch);
  // Metal stove pipe chimney on left slope + masonry finial on right
  addR(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.15, 10), iron), -3.55, H + 1.1, -1.65);
  addR(new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 10), iron), -3.55, H + 1.75, -1.65);
  addStuccoChimney(kit, 3.45, H + 0.35, -2.15, stucco, stone, terra);

  // Red-and-white striped WINDSOCK on tall timber mast (`finalize([windsock])`)
  addR(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 2.35, 8), timber), -2.35, H + 1.85, 1.65);
  addR(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), brass), -2.35, H + 3.05, 1.65);
  const windsock = new THREE.Group();
  windsock.name = 'windsock';
  windsock.position.set(-2.35, H + 2.9, 1.65);
  roofG.add(windsock);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 6, 14), iron), 0.14, 0, 0, 0, PI / 2, 0, windsock);
  for (let i = 0; i < 5; i++) {
    const r0 = 0.21 - i * 0.026, r1 = 0.21 - (i + 1) * 0.026;
    const seg = new THREE.CylinderGeometry(r1, r0, 0.28, 12, 1, false);
    seg.rotateZ(-PI / 2);
    add(new THREE.Mesh(seg, i % 2 === 0 ? redStripe : creamCloth), 0.28 + i * 0.27, -i * 0.032, 0, 0, 0, -0.09, windsock);
  }

  // Climbing bougainvillea & ivy on left hangar corner
  addBougainvillea(kit, THREE, [
    [-4.85, 0.7, 3.85, 0.35, 6],
    [-4.88, 1.85, 3.88, 0.42, 8],
    [-4.65, 3.05, 3.92, 0.48, 9],
    [-3.75, 3.95, 3.95, 0.42, 7],
  ], { vine, foliageInst });

  // ---- ROOM 1 (Aircraft Workshop): Wooden Workbench, Radial Engine Stand, Crimson Wing Ribs & Back Shelf ----
  // 1) Wooden workbench along left wall (standable h = 0.96m)
  add(rbox(0.95, 0.86, 2.3, 0.04, oakLight), -4.05, 0.46, 0.85);
  add(rbox(1.04, 0.1, 2.4, 0.03, timber), -4.05, 0.91, 0.85);
  add(rbox(0.24, 0.22, 0.28, 0.03, iron), -3.65, 1.04, 1.65); // Bench vise
  add(rbox(0.08, 0.95, 1.85, 0.02, timber), -4.54, 1.62, 0.85); // Pegboard tool rack
  for (let i = 0; i < 5; i++) add(rbox(0.05, 0.34, 0.06, 0.01, iron), -4.48, 1.62, 0.18 + i * 0.32);

  // 2) Back parts shelving with toolboxes & oil cans (tall rack -> full blocker)
  add(rbox(3.1, 2.35, 0.68, 0.03, timber), -2.25, 1.22, -3.22);
  for (const sy of [0.65, 1.32, 1.98]) add(rbox(3.02, 0.07, 0.64, 0.02, oakLight), -2.25, sy, -3.2);
  add(rbox(0.62, 0.38, 0.44, 0.03, redStripe), -3.1, 0.88, -3.18);
  add(rbox(0.58, 0.42, 0.46, 0.03, oakLight), -2.15, 0.9, -3.18);
  add(rbox(0.52, 0.36, 0.42, 0.03, lockerBlue), -1.3, 1.54, -3.18);
  boxCol(-2.25, -3.22, 3.12, 0.72);

  // 3) Radial 9-cylinder aircraft engine on oak A-frame stand (standable h = 1.32m)
  const ex = -0.35, ez = -1.95;
  add(rbox(1.12, 0.12, 1.08, 0.03, timber), ex, 0.12, ez);
  for (const sx of [-0.42, 0.42]) {
    beam([ex + sx, 0.14, ez - 0.38], [ex + sx * 0.65, 1.32, ez], 0.1, oakLight);
    beam([ex + sx, 0.14, ez + 0.38], [ex + sx * 0.65, 1.32, ez], 0.1, oakLight);
  }
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.36, 14), iron), ex, 1.36, ez, PI / 2, 0, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.055, 8, 18), brass), ex, 1.36, ez - 0.12);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 12), brass), ex, 1.36, ez + 0.28, PI / 2, 0, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * PI * 2;
    add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.38, 8), iron),
      ex + Math.cos(a) * 0.44,
      1.36 + Math.sin(a) * 0.44,
      ez + 0.02,
      0, 0, a - PI / 2
    );
  }

  // 4) Spare crimson biplane wing frames & wooden ribs mounted on inner partition wall (high up)
  for (const wy of [2.15, 3.02]) {
    add(rbox(0.12, 0.12, 2.75, 0.03, crimson), 1.24, wy, -1.65);
    add(rbox(0.08, 0.08, 2.75, 0.02, crimson), 0.92, wy - 0.16, -1.65);
    for (let r = -3; r <= 3; r++) {
      add(rbox(0.46, 0.09, 0.035, 0.015, oakLight), 1.08, wy - 0.08, -1.65 + r * 0.38, 0, 0, 0.32);
    }
  }
  // Hanging workshop pendant lamps
  for (const [lx, lz] of [[-2.1, -0.4], [-0.4, 1.2], [2.9, -0.5]]) {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.16, 12), iron), lx, 3.45, lz);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), lampGlow), lx, 3.36, lz);
  }

  // ---- ROOM 2 (Pilot Locker & Nautical Map Desk) ----
  // 1) Slate-blue steel pilot lockers + hanging leather flight jacket
  add(rbox(1.42, 2.35, 0.64, 0.04, lockerBlue), 2.55, 1.22, -3.18);
  add(rbox(0.04, 2.15, 0.67, 0.01, iron), 2.55, 1.22, -3.18);
  // Leather flight jacket & shearling collar hanging on locker hook
  add(rbox(0.44, 0.62, 0.18, 0.06, leather), 2.18, 1.55, -2.78);
  add(rbox(0.28, 0.14, 0.2, 0.05, creamCloth), 2.18, 1.88, -2.77);
  boxCol(2.55, -3.18, 1.46, 0.68);

  // 2) Nautical map desk + framed Adriatic chart on wall + brass lamp & pilot chair (standable h = 0.88m)
  add(rbox(0.9, 0.78, 1.92, 0.04, oakLight), 4.08, 0.42, -0.65);
  add(rbox(0.98, 0.08, 2.0, 0.025, timber), 4.08, 0.84, -0.65);
  add(rbox(0.68, 0.03, 0.92, 0.01, chartMat), 4.02, 0.895, -0.65);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.32, 10), brass), 4.22, 1.04, -1.32);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 10), doorGreen), 4.18, 1.2, -1.32);
  // Wall-mounted painted sea chart
  add(rbox(0.08, 1.15, 1.58, 0.02, timber), 4.56, 2.05, -0.65);
  add(rbox(0.05, 1.02, 1.44, 0.01, chartMat), 4.53, 2.05, -0.65);
  // Pilot wooden chair tucked beside desk
  add(rbox(0.46, 0.44, 0.46, 0.03, timber), 3.38, 0.25, -0.65);
  add(rbox(0.08, 0.52, 0.46, 0.02, timber), 3.18, 0.68, -0.65);

  finalize([windsock]);
  addStandableCols(root, [
    [-4.05, 0.85, 0.98, 2.35, 0.96],
    [ex, ez, 1.14, 1.12, 1.32],
    [4.02, -0.65, 1.05, 1.98, 0.88],
  ]);
  Object.assign(root.userData, {
    floorY: 0.08,
    footprint: { w: W, d: D },
    rooms: [
      { name: 'workshop', x: -1.625, z: 0, w: 6.15, d: 7.30, walkX: -1.35, walkZ: 1.35 },
      { name: 'pilot_office', x: 3.075, z: 0, w: 3.25, d: 7.30, walkX: 2.65, walkZ: 0.55 },
    ],
    door: { x: -1.35, z: +(D / 2 + 1.25).toFixed(2) },
    doorIn: { x: -1.35, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 1.45, z: 0.35 }],
    propSlots: [
      { id: 'sp_fuel_drum', x: -3.88, z: 2.75, rot: 0.4 },
      { id: 'sp_fuel_drum', x: -3.88, z: -1.05, rot: -0.35 },
      { id: 'sp_propeller_stand', x: -2.25, z: -1.85, rot: 0.22 },
      { id: 'sp_sea_chest', x: -4.02, z: -2.55, rot: 1.57 },
      { id: 'sp_anchor_bollard', x: 0.45, z: 2.75, rot: -2.5 },
      { id: 'sp_buoy_float', x: 0.58, z: -2.92, rot: 0.18 },
      { id: 'sp_sea_chest', x: 3.92, z: -2.82, rot: -1.57 },
      { id: 'sp_olive_amphora', x: 2.35, z: 2.85, rot: 2.4 },
      { id: 'sp_wine_rack', x: 3.95, z: 2.55, rot: -1.57 },
      { id: 'sp_lemon_planter', x: 3.95, z: 1.25, rot: -1.57 },
    ],
  });
  return tagPaintColors(THREE, root, 0xf6ead2);
}

// ============================================================================
// 2. TRATTORIA BELLA VISTA (`adriano_trattoria`)
// ============================================================================
function buildAdrianoTrattoria(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'adriano_trattoria', 23);
  kit.THREE = THREE;
  const { root, roofG, M, glowMat, tex, add, addR, rbox, boxCol, wall, beam, finalize } = kit;

  const W = 9.4, D = 7.6, H = 3.85, T = 0.26;
  const ochre = M(0xf4cc6e, tex('plaster', 2.2, 2.0));
  const innerWall = M(0xfdf0d5, tex('plaster', 2.0, 2.0));
  const stone = M(0xeadbc0, tex('stone', 2.0, 2.0));
  const terraFloor = M(0xcf7f56, tex('terracotta', 3.4, 3.4));
  const checkFloor = M(0xffffff, checkeredFloorTex(THREE, 'sp_trattoria_floor', '#d88259', '#f7ead0', 6, 6));
  const shutterGreen = M(0x3a8260, tex('wood_light', 1.5, 1.5));
  const shutterDark = M(0x296347, tex('wood_light', 1.5, 1.5));
  const frenchBlue = M(0x4f7f94, tex('wood_light', 1.4, 1.4));
  const awningRed = M(0xd63c37, tex('burlap', 1.4, 1.4));
  const awningCream = M(0xfff6e2, tex('burlap', 1.4, 1.4));
  const brick = M(0xc85c3d, tex('terracotta', 2.2, 2.2));
  const marble = M(0xf7f3ea, tex('stone', 1.4, 1.4), { roughness: 0.42 });
  const oak = M(0x8e5930, tex('wood_light', 1.8, 1.8));
  const oakLight = M(0xc69255, tex('wood_light', 1.6, 1.6));
  const copper = M(0xd9783e, null, { roughness: 0.44, metalness: 0 });
  const iron = M(0x43464b, null, { roughness: 0.62, metalness: 0 });
  const glass = M(0x9bd4ee, null, { roughness: 0.22, metalness: 0 });
  const fireGlow = glowMat(0xffd275, 0xff6714, 2.25);
  const lampGlow = glowMat(0xffe8ac, 0xffb347, 1.7);
  const vine = M(0x5c4128, tex('bark', 1, 2));
  const terra = M(0xd46d3f, tex('terracotta', 1.2, 1.2));
  const bottleGreen = M(0x2e6438, null, { roughness: 0.34, metalness: 0 });
  const tileInstMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('terracotta', 0.6, 0.6), roughness: 0.88, metalness: 0 });
  const foliageInst = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });
  const signTex = paintedCanvasTex(THREE, 'sp_sign_bellavista', 256, (g, s) => {
    g.fillStyle = '#fff5dc'; g.fillRect(0, 0, s, s);
    g.strokeStyle = '#b93832'; g.lineWidth = 10; g.strokeRect(10, 10, s - 20, s - 20);
    g.fillStyle = '#8b2620'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center';
    g.fillText('TRATTORIA', s / 2, 112);
    g.font = 'italic bold 34px Georgia, serif';
    g.fillText('BELLA VISTA', s / 2, 166);
  });
  const signMat = M(0xffffff, signTex);

  // Plinth & interior floors
  add(rbox(W + 0.32, 0.06, D + 0.32, 0.02, stone), 0, 0.03, 0);
  add(rbox(3.85, 0.04, D - 0.36, 0.01, terraFloor), -2.55, 0.055, 0);
  add(rbox(4.85, 0.045, D - 0.36, 0.01, checkFloor), 1.95, 0.058, 0);

  // Exterior walls (front arched restaurant doorway w = 2.05m >= 1.48m)
  wall(0, D / 2, 0, W, H, T, [
    { door: true, u: 0.75, w: 2.05, h: 2.82, arch: true },
    { u: -2.55, y0: 1.12, w: 1.15, h: 1.38, round: false },
    { u: 3.25, y0: 1.12, w: 1.05, h: 1.38, round: false },
  ], ochre, innerWall);
  wall(0, -D / 2, PI, W, H, T, [
    { u: -2.2, y0: 1.2, w: 1.2, h: 1.35, round: false },
  ], ochre, innerWall);
  wall(-W / 2, 0, -PI / 2, D, H, T, [
    { u: 0.25, y0: 1.2, w: 1.15, h: 1.35, round: false },
  ], ochre, innerWall);
  wall(W / 2, 0, PI / 2, D, H, T, [
    { u: -1.1, y0: 1.15, w: 1.2, h: 1.35, round: false },
    { u: 1.6, y0: 1.15, w: 1.2, h: 1.35, round: false },
  ], ochre, innerWall);

  // Interior partition at x = -0.55 with wide stone arch (w = 1.75m at z = +0.35)
  wall(-0.55 - T / 2, 0, -PI / 2, D - 2 * T, H, T, [
    { door: true, u: 0.35, w: 1.75, h: 2.72, arch: true },
  ], innerWall, innerWall);
  addStoneArchTrim(kit, -0.55 + 0.06, 0.35, -PI / 2, 1.75, 2.72, stone);
  addStoneArchTrim(kit, 0.75, D / 2 + 0.02, 0, 2.05, 2.82, stone);
  addCornerQuoins(kit, W, D, 0.06, H, stone);

  // Open teal-blue glazed French doors flanking front arch + wrought-iron coach lamp + sign
  for (const s of [-1, 1]) {
    add(rbox(0.56, 2.35, 0.07, 0.015, frenchBlue), 0.75 + s * 1.12, 1.2, D / 2 + 0.18, 0, -s * 0.35, 0);
    add(rbox(0.38, 1.15, 0.08, 0.01, glass), 0.75 + s * 1.12, 1.68, D / 2 + 0.18, 0, -s * 0.35, 0);
  }
  add(rbox(1.38, 0.56, 0.07, 0.02, signMat), -0.95, 2.95, D / 2 + 0.05);
  beam([-0.95, 2.35, D / 2 + 0.02], [-0.95, 2.35, D / 2 + 0.34], 0.04, iron);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lampGlow), -0.95, 2.22, D / 2 + 0.36);

  // Red-and-cream striped awning over front entrance
  addStripedAwning(kit, 1.25, 3.56, D / 2, 4.85, 0.58, 1.32, awningRed, awningCream, iron);

  // Sea-green shuttered windows on ground floor
  const winMats = { stone, glass, frame: oak, shutter: shutterGreen, shutterDark, terra, foliageInst };
  addShutteredWindow(kit, THREE, -2.55, 1.12, D / 2, 0, 1.15, 1.38, winMats, { flowerBox: true });
  addShutteredWindow(kit, THREE, 3.25, 1.12, D / 2, 0, 1.05, 1.38, winMats, { flowerBox: true });
  addShutteredWindow(kit, THREE, -W / 2, 1.2, 0.25, -PI / 2, 1.15, 1.35, winMats, { flowerBox: true });
  addShutteredWindow(kit, THREE, W / 2, 1.15, -1.1, PI / 2, 1.2, 1.35, winMats, { shutters: true });
  addShutteredWindow(kit, THREE, W / 2, 1.15, 1.6, PI / 2, 1.2, 1.35, winMats, { shutters: true });
  addShutteredWindow(kit, THREE, 2.2, 1.2, -D / 2, PI, 1.2, 1.35, winMats, { shutters: false });

  // ---- TWO-STOREY UPPER FACADE & TERRACOTTA ROOF IN `roofG` ----
  const H2 = 1.95;
  addR(rbox(W + 0.14, 0.14, D + 0.14, 0.03, stone), 0, H + 0.04, 0);
  addR(rbox(W, H2, D, 0.04, ochre), 0, H + H2 / 2, 0);
  addCornerQuoins({ add: addR, rbox }, W, D, H + 0.08, H + H2, stone, 0.44);
  for (const ux of [-2.55, 0.65, 3.15]) {
    addShutteredWindow(kit, THREE, ux, H + 0.36, D / 2 + 0.02, 0, 1.08, 1.26, winMats, { flowerBox: true, parent: roofG });
  }
  // Harbor-facing (-X in local -> +Z south in world when rot = PI/2) & (+X) upper shuttered windows with flower boxes!
  for (const uz of [-1.75, 1.55]) {
    addShutteredWindow(kit, THREE, W / 2 + 0.02, H + 0.36, uz, PI / 2, 1.08, 1.26, winMats, { flowerBox: true, parent: roofG });
    addShutteredWindow(kit, THREE, -W / 2 - 0.02, H + 0.36, uz, -PI / 2, 1.08, 1.26, winMats, { flowerBox: true, parent: roofG });
  }
  // Upper wrought-iron Juliet balcony on center window
  addR(rbox(2.15, 0.12, 0.56, 0.03, stone), 0.65, H + 0.26, D / 2 + 0.26);
  addR(rbox(2.08, 0.05, 0.5, 0.015, iron), 0.65, H + 0.92, D / 2 + 0.28);
  for (let i = -4; i <= 4; i++) {
    addR(rbox(0.035, 0.62, 0.035, 0.01, iron), 0.65 + i * 0.24, H + 0.6, D / 2 + 0.5);
  }
  addGableBarrelRoof(kit, THREE, {
    W, D, wallH: H + H2, rise: 1.25, wallMat: ochre, innerMat: innerWall,
    timberMat: oak, tileInstMat, gableVent: false,
  });
  addStuccoChimney(kit, -3.15, H + H2 + 0.38, -1.65, ochre, stone, terra);
  addStuccoChimney(kit, 3.25, H + H2 + 0.35, -1.85, ochre, stone, terra);

  // Cascading magenta bougainvillea vines across upper roof, front patio & harbor-facing (+X) corner!
  addBougainvillea(kit, THREE, [
    [-4.65, 1.0, 3.88, 0.48, 12],
    [-4.55, 2.25, 3.92, 0.58, 15],
    [-3.95, 3.45, 3.98, 0.65, 18],
    [W / 2 + 0.12, 1.35, 3.55, 0.54, 14],
    [W / 2 + 0.14, 2.45, 3.25, 0.64, 18],
  ], { vine, foliageInst });
  addBougainvillea(kit, THREE, [
    [-3.85, H + 0.55, 3.98, 0.72, 20],
    [-2.55, H + 1.45, 4.05, 0.82, 24],
    [-1.15, H + 2.05, 4.05, 0.78, 22],
    [0.25, H + 1.35, 4.12, 0.65, 16],
    [4.45, H + 1.15, 3.92, 0.62, 16],
    [4.58, H + 0.15, 3.88, 0.55, 14],
    [W / 2 + 0.14, H + 0.95, 2.75, 0.76, 22],
    [W / 2 + 0.16, H + 1.65, 0.25, 0.82, 24],
    [W / 2 + 0.14, H + 1.15, -2.45, 0.68, 18],
    [-W / 2 - 0.14, H + 0.95, 2.65, 0.76, 22],
    [-W / 2 - 0.16, H + 1.55, 0.10, 0.80, 24],
    [-W / 2 - 0.14, H + 0.85, -2.35, 0.68, 18],
  ], { vine, foliageInst }, undefined, roofG);

  // ---- ROOM 1 (Kitchen): Glowing Brick Wood-Fired Pizza Oven & Marble Dough Counter ----
  // 1) Brick pizza oven igloo dome + chimney + firewood arch + glowing fire
  const ox = -2.65, oz = -2.45;
  add(rbox(2.08, 0.95, 1.65, 0.05, brick), ox, 0.5, oz);
  add(rbox(2.16, 0.1, 1.72, 0.03, stone), ox, 1.0, oz);
  // Firewood log niche under oven
  add(rbox(0.86, 0.58, 0.35, 0.04, iron), ox, 0.38, oz + 0.72);
  for (let i = 0; i < 6; i++) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.55, 7), oakLight), ox - 0.24 + (i % 3) * 0.24, 0.22 + Math.floor(i / 3) * 0.16, oz + 0.68, PI / 2, 0, 0);
  }
  // Brick dome + chimney breast + glowing fire inside mouth
  add(new THREE.Mesh(new THREE.SphereGeometry(0.92, 16, 12, 0, PI * 2, 0, PI / 2), brick), ox, 1.02, oz - 0.04);
  add(rbox(0.72, 1.95, 0.62, 0.04, brick), ox, 2.65, oz - 0.35);
  add(rbox(0.68, 0.52, 0.35, 0.12, fireGlow), ox, 1.28, oz + 0.58);
  // Hanging copper skillets & wooden pizza peel on partition wall
  for (let i = 0; i < 3; i++) {
    const pz = -2.1 + i * 0.48;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15 - i * 0.015, 0.15 - i * 0.015, 0.05, 12), copper), -0.74, 1.85, pz, 0, 0, PI / 2);
    add(rbox(0.04, 0.28, 0.04, 0.01, iron), -0.74, 2.08, pz);
  }
  add(rbox(0.05, 1.35, 0.06, 0.015, oakLight), -0.74, 1.35, -0.75);
  add(rbox(0.04, 0.38, 0.34, 0.05, oakLight), -0.74, 0.68, -0.75);
  boxCol(ox, oz, 2.12, 1.72);

  // 2) Marble dough prep counter with dough balls & olive oil bottle (standable h = 0.96m)
  add(rbox(1.06, 0.84, 1.98, 0.04, oakLight), -3.55, 0.45, 1.35);
  add(rbox(1.16, 0.09, 2.08, 0.025, marble), -3.55, 0.91, 1.35);
  for (const dz of [0.85, 1.25, 1.62]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), awningCream), -3.45, 0.99, dz);
  }
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.28, 8), bottleGreen), -3.78, 1.09, 1.85);

  // ---- ROOM 2 (Dining & Oak Wine-Barrel Bar) ----
  // Panelled oak bar counter + horizontal oak wine barrel + back wine shelves + hanging glasses
  add(rbox(3.38, 0.98, 0.72, 0.04, oak), 1.95, 0.52, -2.42);
  add(rbox(3.5, 0.08, 0.84, 0.03, oakLight), 1.95, 1.04, -2.42);
  // Horizontal oak wine barrel on bar
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.68, 12), oakLight), 0.85, 1.36, -2.45, 0, 0, PI / 2);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 6, 14), iron), 0.68, 1.36, -2.45, 0, PI / 2, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 6, 14), iron), 1.02, 1.36, -2.45, 0, PI / 2, 0);
  // Back bottle shelving + wine bottles
  add(rbox(3.25, 2.35, 0.36, 0.03, oak), 1.95, 1.35, -3.32);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 8; i++) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.28, 8), bottleGreen), 0.65 + i * 0.36, 1.32 + row * 0.58, -3.26);
    }
  }
  // Overhead brass glass rack + warm dining pendants
  add(rbox(2.4, 0.05, 0.52, 0.015, brassOrCopper(M)), 1.95, 2.55, -2.42);
  for (const [lx, lz] of [[-2.2, 0.2], [1.2, 0.8], [2.9, -0.4]]) {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.14, 12), awningCream), lx, 3.38, lz);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), lampGlow), lx, 3.29, lz);
  }
  boxCol(1.95, -3.32, 3.32, 0.42);

  finalize([]);
  addStandableCols(root, [
    [-3.55, 1.35, 1.16, 2.08, 0.96],
    [1.95, -2.42, 3.48, 0.86, 1.08],
  ]);
  Object.assign(root.userData, {
    floorY: 0.08,
    footprint: { w: W, d: D },
    rooms: [
      { name: 'dining_bar', x: 1.975, z: 0, w: 5.05, d: 7.10, walkX: 1.35, walkZ: 0.85 },
      { name: 'pizza_kitchen', x: -2.525, z: 0, w: 3.95, d: 7.10, walkX: -1.85, walkZ: 0.55 },
    ],
    door: { x: 0.75, z: +(D / 2 + 1.25).toFixed(2) },
    doorIn: { x: 0.75, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: -0.55, z: 0.35 }],
    propSlots: [
      { id: 'sp_bistro_set', x: 3.15, z: 2.15, rot: 0.35 },
      { id: 'sp_bistro_set', x: 3.15, z: -0.25, rot: -0.25 },
      { id: 'sp_wine_rack', x: 3.85, z: -1.52, rot: -1.57 },
      { id: 'sp_lemon_planter', x: -0.05, z: 2.85, rot: 2.8 },
      { id: 'sp_olive_amphora', x: 2.15, z: 2.95, rot: -2.9 },
      { id: 'sp_olive_amphora', x: -1.45, z: 2.75, rot: 2.5 },
      { id: 'sp_wine_rack', x: -4.02, z: -0.55, rot: 1.57 },
      { id: 'sp_sea_chest', x: -3.85, z: -0.95, rot: 0.0 },
      { id: 'sp_fuel_drum', x: -3.85, z: 2.85, rot: 0.8 },
      { id: 'sp_lemon_planter', x: 0.08, z: -1.25, rot: 0.4 },
    ],
  });
  return tagPaintColors(THREE, root, 0xf4cc6e);
}

function brassOrCopper(M) {
  return M(0xe4b248, null, { roughness: 0.44, metalness: 0 });
}

// ============================================================================
// 3. HARBOR LIGHTHOUSE (`harbor_lighthouse`)
// ============================================================================
function buildHarborLighthouse(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'harbor_lighthouse', 37);
  kit.THREE = THREE;
  const { root, roofG, M, glowMat, tex, add, addR, rbox, boxCol, wall, beam, finalize } = kit;

  const cW = 5.8, cD = 7.2, cH = 3.75, T = 0.26, cX = -1.65;
  const tX = 2.75, tZ = -0.1, tR = 2.22;

  const limestone = M(0xf0e5ce, tex('stone', 2.2, 2.0));
  const innerWall = M(0xfaf0dc, tex('plaster', 2.0, 2.0));
  const stoneTrim = M(0xdcd0b6, tex('stone', 1.8, 1.8));
  const coralRed = M(0xd65341, tex('plaster', 1.6, 1.6));
  const towerCream = M(0xf8f0e0, tex('plaster', 1.6, 1.6));
  const terraFloor = M(0xc8825a, tex('terracotta', 3.4, 3.4));
  const towerStoneFloor = M(0xd4c8b0, tex('stone', 3.0, 3.0));
  const shutterGreen = M(0x468368, tex('wood_light', 1.4, 1.4));
  const oak = M(0x88562d, tex('wood_light', 1.8, 1.8));
  const oakLight = M(0xc69358, tex('wood_light', 1.6, 1.6));
  const brass = M(0xe6b448, null, { roughness: 0.42, metalness: 0 });
  const iron = M(0x424750, null, { roughness: 0.62, metalness: 0 });
  const glass = M(0x98d2ee, null, { roughness: 0.22, metalness: 0 });
  const lanternGlass = M(0xdcf4ff, null, { roughness: 0.18, metalness: 0, transparent: true, opacity: 0.45, depthWrite: false });
  const beaconGlow = glowMat(0xfff5bd, 0xffcc4d, 2.6);
  const beamConeMat = M(0xfff2b2, null, { emissive: 0xffd25a, emissiveIntensity: 1.4, metalness: 0, transparent: true, opacity: 0.26, depthWrite: false });
  const chartMat = M(0xffffff, seaChartTex(THREE));
  const vine = M(0x5c4128, tex('bark', 1, 2));
  const terra = M(0xd46d3f, tex('terracotta', 1.2, 1.2));
  const tileInstMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('terracotta', 0.6, 0.6), roughness: 0.88, metalness: 0 });
  const foliageInst = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });

  // Plinths & floors for Chart House (Room 1) & Round Lighthouse Base (Room 2)
  add(rbox(cW + 0.28, 0.06, cD + 0.28, 0.02, stoneTrim), cX, 0.03, 0);
  add(rbox(cW - 0.36, 0.04, cD - 0.36, 0.01, terraFloor), cX, 0.055, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(tR + 0.18, tR + 0.24, 0.07, 16), stoneTrim), tX, 0.035, tZ);
  add(new THREE.Mesh(new THREE.CylinderGeometry(tR - 0.22, tR - 0.22, 0.045, 16), towerStoneFloor), tX, 0.058, tZ);

  // Chart House hollow walls (front `+Z` doorway at x = -1.45, w = 1.76m >= 1.65m!)
  wall(cX, cD / 2, 0, cW, cH, T, [
    { door: true, u: 0.2, w: 1.76, h: 2.72, arch: true },
    { u: -1.85, y0: 1.12, w: 1.05, h: 1.32, round: false },
  ], limestone, innerWall);
  wall(cX, -cD / 2, PI, cW, cH, T, [
    { u: 0.65, y0: 1.05, w: 2.25, h: 1.65, round: false }, // Grand sea-view window!
  ], limestone, innerWall);
  wall(cX - cW / 2, 0, -PI / 2, cD, cH, T, [
    { u: 0.1, y0: 1.18, w: 1.15, h: 1.32, round: false },
  ], limestone, innerWall);
  // Shared junction wall at x = +1.25 (`cX + cW/2`) with wide arched passage into Lighthouse Tower Base (`w = 1.76m`)!
  wall(cX + cW / 2 - T / 2, 0, -PI / 2, cD - 2 * T, cH, T, [
    { door: true, u: 0.15, w: 1.76, h: 2.72, arch: true },
  ], limestone, innerWall);
  addStoneArchTrim(kit, cX + 0.2, cD / 2 + 0.02, 0, 1.76, 2.72, stoneTrim);
  addStoneArchTrim(kit, cX + cW / 2 + 0.05, 0.15, -PI / 2, 1.76, 2.72, stoneTrim);

  // Shuttered windows & open door leaves on Chart House
  const winMats = { stone: stoneTrim, glass, frame: oak, shutter: shutterGreen, shutterDark: shutterGreen, terra, foliageInst };
  addShutteredWindow(kit, THREE, cX - 1.85, 1.12, cD / 2, 0, 1.05, 1.32, winMats, { flowerBox: true });
  addShutteredWindow(kit, THREE, cX - cW / 2, 1.18, 0.1, -PI / 2, 1.15, 1.32, winMats, { flowerBox: true });
  addShutteredWindow(kit, THREE, cX - 0.65, 1.05, -cD / 2, PI, 2.25, 1.65, winMats, { shutters: false });
  for (const s of [-1, 1]) {
    add(rbox(0.5, 2.28, 0.07, 0.015, shutterGreen), cX + 0.2 + s * 0.96, 1.18, cD / 2 + 0.16, 0, -s * 0.35, 0);
  }

  // ---- ROUND LIGHTHOUSE TOWER BASE (Lower walkable drum y = 0..cH) ----
  // 8-sided masonry ring skipping the west segment (`i === 4`, angle PI) where the Chart House arch connects!
  const octN = 8;
  const segLen = 2 * tR * Math.sin(PI / octN) + 0.12;
  for (let i = 0; i < octN; i++) {
    const a = (i / octN) * PI * 2; // 0 = +X, PI/2 = +Z, PI = -X (junction!)
    if (i === 4) continue;
    const mx = tX + Math.cos(a) * (tR - 0.15);
    const mz = tZ + Math.sin(a) * (tR - 0.15);
    const ry = PI / 2 - a;
    // Rusticated stone base + first coral-red & cream stripes
    add(rbox(segLen, 1.35, 0.32, 0.03, stoneTrim), mx, 0.68, mz, 0, ry, 0);
    add(rbox(segLen * 0.98, 1.22, 0.3, 0.025, coralRed), mx, 1.95, mz, 0, ry, 0);
    add(rbox(segLen * 0.96, 1.22, 0.29, 0.025, towerCream), mx, 3.16, mz, 0, ry, 0);
    if (i === 0 || i === 2) {
      add(rbox(0.46, 0.72, 0.34, 0.03, oak), mx, 2.15, mz, 0, ry, 0);
      add(rbox(0.34, 0.58, 0.36, 0.015, glass), mx, 2.15, mz, 0, ry, 0);
    }
    boxCol(mx, mz, segLen, 0.34, ry);
  }
  // Heavy dark-iron harbor anchor leaning outside front of lighthouse tower base!
  add(rbox(0.11, 1.18, 0.11, 0.03, iron), tX - 0.65, 0.65, tZ + tR + 0.16, -0.18, 0, 0.18);
  add(rbox(0.62, 0.09, 0.09, 0.02, iron), tX - 0.76, 1.05, tZ + tR + 0.1, -0.18, 0, 0.18);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.065, 8, 14, PI), iron), tX - 0.56, 0.48, tZ + tR + 0.22, -0.18, 0, PI + 0.18);

  // ---- UPPER LIGHTHOUSE SHAFT, BRASS LANTERN DOME, ROTATING `beacon` & CHART ROOF IN `roofG` ----
  addGableBarrelRoof(kit, THREE, {
    cx: cX, cz: 0, W: cW, D: cD, wallH: cH, rise: 1.32,
    wallMat: limestone, innerMat: innerWall, timberMat: oak, tileInstMat,
  });
  addStuccoChimney(kit, cX - 1.65, cH + 0.45, -1.85, limestone, stoneTrim, terra);

  // Striped upper cylindrical tower (`y = cH .. 7.15m`)
  const bands = [
    [cH, 4.95, 2.08, 1.98, coralRed],
    [4.95, 6.05, 1.98, 1.88, towerCream],
    [6.05, 7.05, 1.88, 1.8, coralRed],
  ];
  for (const [y0, y1, r0, r1, bMat] of bands) {
    addR(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 20), bMat), tX, (y0 + y1) / 2, tZ);
  }
  // Tower slit windows
  for (const [wy, wzOff] of [[5.48, 1.92], [4.38, -2.02]]) {
    addR(rbox(0.48, 0.74, 0.22, 0.04, stoneTrim), tX, wy, tZ + wzOff);
    addR(rbox(0.32, 0.56, 0.25, 0.02, glass), tX, wy, tZ + wzOff);
  }
  // Corbelled stone gallery deck & wrought-iron railing
  addR(new THREE.Mesh(new THREE.CylinderGeometry(2.26, 1.82, 0.34, 20), stoneTrim), tX, 7.18, tZ);
  addR(new THREE.Mesh(new THREE.CylinderGeometry(2.36, 2.26, 0.16, 20), limestone), tX, 7.42, tZ);
  addR(new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.038, 6, 24), iron), tX, 8.05, tZ, PI / 2, 0, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    addR(rbox(0.04, 0.62, 0.04, 0.01, iron), tX + Math.cos(a) * 2.22, 7.75, tZ + Math.sin(a) * 2.22);
  }
  // Brass lantern housing, single transparent glass cylinder, brass cupola dome & weathervane
  addR(new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.4, 0.34, 18), brass), tX, 7.64, tZ);
  addR(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.18, 18, 1, true), lanternGlass), tX, 8.38, tZ);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    addR(rbox(0.055, 1.22, 0.055, 0.01, brass), tX + Math.cos(a) * 1.31, 8.38, tZ + Math.sin(a) * 1.31);
  }
  addR(new THREE.Mesh(new THREE.SphereGeometry(1.42, 18, 12, 0, PI * 2, 0, PI * 0.52), brass), tX, 8.95, tZ);
  addR(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.72, 8), brass), tX, 10.55, tZ);
  addR(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), brass), tX, 10.35, tZ);
  addR(rbox(0.62, 0.08, 0.03, 0.01, brass), tX + 0.12, 10.76, tZ);

  // Rotating `beacon` group inside lantern dome (`finalize([beacon])`)
  const beacon = new THREE.Group();
  beacon.name = 'beacon';
  beacon.position.set(tX, 8.36, tZ);
  roofG.add(beacon);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.56, 14), brass), 0, 0, 0, 0, 0, 0, beacon);
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), beaconGlow), 0, 0.04, s * 0.34, 0, 0, 0, beacon);
    const cone = new THREE.ConeGeometry(0.75, 2.4, 14, 1, true);
    cone.translate(0, -1.2, 0);
    cone.rotateX(s > 0 ? -PI / 2 : PI / 2);
    const cm = new THREE.Mesh(cone, beamConeMat);
    cm.castShadow = false;
    cm.receiveShadow = false;
    cm.position.set(0, 0.04, s * 0.42);
    beacon.add(cm);
  }

  // Bougainvillea on Chart House right gable
  addBougainvillea(kit, THREE, [
    [0.85, 1.35, cD / 2 + 0.06, 0.35, 6],
    [0.65, 2.55, cD / 2 + 0.08, 0.42, 8],
    [0.15, 3.35, cD / 2 + 0.1, 0.4, 7],
  ], { vine, foliageInst });

  // ---- ROOM 1 (Chart House): Slanted Nautical Chart Table, Ship Wheel on Wall & Sextant Shelves ----
  // 1) Slanted nautical chart table (standable h = 0.98m)
  const tx = -3.05, tz = -1.35;
  add(rbox(1.68, 0.82, 1.12, 0.04, oak), tx, 0.44, tz);
  add(rbox(1.82, 0.09, 1.24, 0.03, oakLight), tx, 0.92, tz, 0.18, 0, 0);
  add(rbox(1.48, 0.025, 0.94, 0.01, chartMat), tx, 0.975, tz + 0.02, 0.18, 0, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 10), brass), tx + 0.62, 1.12, tz - 0.34);

  // 2) Wooden ship's wheel mounted on inner/back wall + sextant & logbook shelves
  const wx = 0.05, wy = 2.52, wz = -3.26;
  add(new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 18), oak), wx, wy, wz);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), brass), wx, wy, wz, PI / 2, 0, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2;
    add(rbox(0.045, 1.28, 0.045, 0.015, oakLight), wx, wy, wz, 0, 0, a);
  }
  // Nautical bookshelves with brass globe & sextant
  add(rbox(1.82, 1.72, 0.66, 0.03, oak), -0.35, 0.9, -2.95);
  for (let i = 0; i < 9; i++) {
    add(rbox(0.11, 0.34, 0.28, 0.015, i % 2 ? coralRed : shutterGreen), -1.02 + i * 0.17, 1.22, -2.92);
  }
  add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), glass), 0.18, 1.96, -2.92);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.02, 6, 14, PI), brass), 0.18, 1.96, -2.92, 0, 0, -PI / 2);
  boxCol(-0.35, -2.95, 1.86, 0.72);

  // ---- ROOM 2 (Round Lighthouse Base): Curved Stone Spiral Stair Accent & Brass Anchor ----
  for (let s = 0; s < 9; s++) {
    const a = -PI * 0.85 + s * 0.24;
    const sr = tR - 0.62;
    const sx = tX + Math.cos(a) * sr;
    const sz = tZ + Math.sin(a) * sr;
    const sh = 0.22 + s * 0.28;
    add(rbox(0.68, sh, 0.38, 0.03, stoneTrim), sx, sh / 2 + 0.05, sz, 0, -a, 0);
    if (s % 2 === 0) add(rbox(0.04, 0.68, 0.04, 0.01, iron), sx - Math.cos(a) * 0.26, sh + 0.38, sz - Math.sin(a) * 0.26);
  }
  // Brass interior anchor & hanging lantern
  add(rbox(0.09, 0.92, 0.09, 0.025, brass), tX + 1.48, 0.55, tZ + 0.72, 0, -0.8, -0.2);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 12, PI), brass), tX + 1.44, 0.36, tZ + 0.72, 0, -0.8, PI);
  for (const [lx, lz] of [[cX - 0.5, 0.2], [tX, tZ + 0.2]]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), beaconGlow), lx, 3.3, lz);
  }

  finalize([beacon]);
  addStandableCols(root, [
    [tx, tz, 1.82, 1.24, 0.98],
    [2.92, -1.55, 1.95, 0.85, 1.15],
  ]);
  Object.assign(root.userData, {
    floorY: 0.08,
    footprint: { w: 9.7, d: cD },
    rooms: [
      { name: 'chart_room', x: -1.60, z: 0, w: 5.70, d: 6.75, walkX: -1.35, walkZ: 0.85 },
      { name: 'tower_base', x: 2.95, z: -0.1, w: 3.40, d: 3.80, walkX: 2.45, walkZ: 0.15 },
    ],
    door: { x: +(cX + 0.2).toFixed(2), z: +(cD / 2 + 1.25).toFixed(2) },
    doorIn: { x: +(cX + 0.2).toFixed(2), z: +(cD / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: +(cX + cW / 2).toFixed(2), z: 0.15 }],
    propSlots: [
      { id: 'sp_sea_chest', x: -3.85, z: 2.55, rot: 1.57 },
      { id: 'sp_olive_amphora', x: -3.95, z: 0.65, rot: 1.4 },
      { id: 'sp_anchor_bollard', x: 0.25, z: 2.65, rot: -2.7 },
      { id: 'sp_buoy_float', x: -3.85, z: -2.82, rot: 0.5 },
      { id: 'sp_propeller_stand', x: 0.12, z: -1.55, rot: -0.4 },
      { id: 'sp_lemon_planter', x: -2.75, z: 2.75, rot: 3.0 },
      { id: 'sp_anchor_bollard', x: 3.45, z: 1.05, rot: -2.2 },
      { id: 'sp_sea_chest', x: 2.75, z: 1.25, rot: 3.1 },
      { id: 'sp_pelican_post', x: 3.55, z: -0.2, rot: -1.57 },
    ],
  });
  return tagPaintColors(THREE, root, 0xf0e5ce);
}

// ============================================================================
// 4. COASTAL GELATERIA (`coastal_gelateria`)
// ============================================================================
function buildCoastalGelateria(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'coastal_gelateria', 53);
  kit.THREE = THREE;
  const { root, roofG, M, glowMat, tex, add, addR, rbox, boxCol, wall, pushInst, finalize } = kit;
  const prims = getPrims(THREE);

  const W = 9.2, D = 7.5, H = 3.8, T = 0.26;
  const mint = M(0xc6e0bf, tex('plaster', 2.2, 2.0));
  const mintDark = M(0x9dc296, tex('plaster', 1.6, 1.6));
  const innerWall = M(0xfdf5e6, tex('plaster', 2.0, 2.0));
  const stone = M(0xefe3c9, tex('stone', 2.0, 2.0));
  const parlorFloor = M(0xffffff, checkeredFloorTex(THREE, 'sp_gelato_floor', '#b5d4e6', '#fff7e6', 6, 6));
  const cafeFloor = M(0xffffff, checkeredFloorTex(THREE, 'sp_cafe_floor', '#de9b6c', '#fdf2dc', 5, 5));
  const shutterGreen = M(0x4a8a6d, tex('wood_light', 1.4, 1.4));
  const pinkStripe = M(0xe88ba4, tex('burlap', 1.4, 1.4));
  const creamStripe = M(0xfff8ec, tex('burlap', 1.4, 1.4));
  const marble = M(0xfaf6ee, tex('stone', 1.4, 1.4), { roughness: 0.36 });
  const walnut = M(0x7c4e29, tex('wood_light', 1.8, 1.8));
  const oakLight = M(0xcfa065, tex('wood_light', 1.6, 1.6));
  const copper = M(0xd9783e, null, { roughness: 0.42, metalness: 0 });
  const brass = M(0xe6b448, null, { roughness: 0.42, metalness: 0 });
  const iron = M(0x43484c, null, { roughness: 0.62, metalness: 0 });
  const glass = M(0xa6dcf2, null, { roughness: 0.22, metalness: 0 });
  const vitrineGlass = M(0xdff5ff, null, { roughness: 0.16, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false });
  const lampGlow = glowMat(0xfff0be, 0xffbe58, 1.65);
  const vine = M(0x5a4028, tex('bark', 1, 2));
  const terra = M(0xd46d3f, tex('terracotta', 1.2, 1.2));
  const tileInstMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('terracotta', 0.6, 0.6), roughness: 0.88, metalness: 0 });
  const foliageInst = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });

  // Plinth & floors
  add(rbox(W + 0.32, 0.06, D + 0.32, 0.02, stone), 0, 0.03, 0);
  add(rbox(4.45, 0.04, D - 0.36, 0.01, parlorFloor), -1.95, 0.055, 0);
  add(rbox(3.95, 0.045, D - 0.36, 0.01, cafeFloor), 2.42, 0.058, 0);

  // Exterior walls (front right arched doorway w = 1.74m >= 1.48m + left gelato display window!)
  wall(0, D / 2, 0, W, H, T, [
    { door: true, u: 2.05, w: 1.74, h: 2.72, arch: true },
    { u: -1.95, y0: 0.82, w: 2.45, h: 1.82, round: false },
  ], mint, innerWall);
  wall(0, -D / 2, PI, W, H, T, [
    { u: -2.15, y0: 1.18, w: 1.25, h: 1.38, round: false },
  ], mint, innerWall);
  wall(-W / 2, 0, -PI / 2, D, H, T, [
    { u: -0.65, y0: 1.18, w: 1.2, h: 1.35, round: false },
  ], mint, innerWall);
  wall(W / 2, 0, PI / 2, D, H, T, [
    { u: -0.35, y0: 1.05, w: 1.45, h: 1.65, round: false },
  ], mint, innerWall);

  // Interior partition at x = +0.35 with wide arch (w = 1.74m at z = -0.15)
  wall(0.35 - T / 2, 0, -PI / 2, D - 2 * T, H, T, [
    { door: true, u: -0.15, w: 1.74, h: 2.68, arch: true },
  ], innerWall, innerWall);
  addStoneArchTrim(kit, 0.35 + 0.06, -0.15, -PI / 2, 1.74, 2.68, stone);
  addStoneArchTrim(kit, 2.05, D / 2 + 0.02, 0, 1.74, 2.72, stone);
  addCornerQuoins(kit, W, D, 0.06, H, stone);

  // Front display window stone sill & open mint French doors
  add(rbox(2.72, 0.14, 0.38, 0.03, stone), -1.95, 0.78, D / 2 - 0.08);
  add(rbox(2.72, 0.15, 0.34, 0.03, stone), -1.95, 2.68, D / 2 - 0.09);
  for (const s of [-1, 1]) {
    add(rbox(0.52, 2.32, 0.07, 0.015, shutterGreen), 2.05 + s * 0.98, 1.2, D / 2 + 0.16, 0, -s * 0.35, 0);
    add(rbox(0.34, 1.1, 0.08, 0.01, glass), 2.05 + s * 0.98, 1.66, D / 2 + 0.16, 0, -s * 0.35, 0);
  }
  const winMats = { stone, glass, frame: walnut, shutter: shutterGreen, shutterDark: shutterGreen, terra, foliageInst };
  addShutteredWindow(kit, THREE, 2.15, 1.18, -D / 2, PI, 1.25, 1.38, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, -W / 2, 1.18, -0.65, -PI / 2, 1.2, 1.35, winMats, { flowerBox: true, bloomHex: 0xf06595 });
  addShutteredWindow(kit, THREE, W / 2, 1.05, 0.35, PI / 2, 1.45, 1.65, winMats, { shutters: false });

  // Pink-and-cream striped scalloped awning over gelato display window!
  addStripedAwning(kit, -1.95, 3.42, D / 2, 3.35, 0.56, 1.28, pinkStripe, creamStripe, iron);

  // ---- UPPER STOREY, LEMON-DRAPED WROUGHT-IRON BALCONY & ROOF IN `roofG` ----
  const H2 = 1.85;
  addR(rbox(W + 0.14, 0.14, D + 0.14, 0.03, stone), 0, H + 0.04, 0);
  addR(rbox(W, H2, D, 0.04, mint), 0, H + H2 / 2, 0);
  addCornerQuoins({ add: addR, rbox }, W, D, H + 0.08, H + H2, stone, 0.44);
  addShutteredWindow(kit, THREE, -2.05, H + 0.32, D / 2 + 0.02, 0, 1.05, 1.22, winMats, { flowerBox: true, bloomHex: 0xffd43b, parent: roofG });
  addShutteredWindow(kit, THREE, 1.65, H + 0.22, D / 2 + 0.02, 0, 1.18, 1.38, winMats, { shutters: true, parent: roofG });

  // Wrought-iron balcony draped with potted lemon trees & golden lemons!
  const bx = 1.65, by = H + 0.14, bz = D / 2 + 0.42;
  addR(rbox(2.75, 0.14, 0.84, 0.03, stone), bx, by, bz);
  addR(rbox(2.68, 0.05, 0.78, 0.015, iron), bx, by + 0.78, bz);
  for (let i = -5; i <= 5; i++) {
    addR(rbox(0.035, 0.72, 0.035, 0.01, iron), bx + i * 0.24, by + 0.42, bz + 0.36);
  }
  for (const lx of [bx - 0.92, bx + 0.92]) {
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.34, 10), terra), lx, by + 0.24, bz + 0.12);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.48, 7), walnut), lx, by + 0.56, bz + 0.12);
    for (let k = 0; k < 14; k++) {
      const ox = kit.jr(-0.38, 0.38), oy = kit.jr(0.68, 1.18), oz = kit.jr(-0.28, 0.34);
      pushInst('foliage', prims.leaf, foliageInst, lx + ox, by + oy, bz + 0.12 + oz, kit.jr(-0.4, 0.4), kit.jr(0, 6), 0, 1.05, 0.95, 1.05, kit.pick([0x3d8a35, 0x4ea03e, 0x2f742a]), roofG);
      if (k % 2 === 0) {
        pushInst('lemon', prims.lemon, foliageInst, lx + ox * 1.08, by + oy - 0.06, bz + 0.16 + oz, 0.2, k, 0.15, 1.15, 1.15, 1.15, 0xfad228, roofG);
      }
    }
  }
  addGableBarrelRoof(kit, THREE, {
    W, D, wallH: H + H2, rise: 1.25, wallMat: mint, innerMat: innerWall,
    timberMat: walnut, tileInstMat, gableVent: false,
  });
  addStuccoChimney(kit, 3.05, H + H2 + 0.35, -1.75, mint, stone, terra);

  // Bougainvillea on right corner + trailing lemon garland over awning
  addBougainvillea(kit, THREE, [
    [4.55, 1.15, 3.78, 0.38, 7],
    [4.52, 2.45, 3.82, 0.44, 9],
    [4.25, 3.55, 3.85, 0.46, 8],
  ], { vine, foliageInst });

  // ---- ROOM 1 (Gelato Parlor): Marble Gelato Vitrine w/ 8 Flavours & Waffle-Cone Shelf ----
  // 1) Gelato vitrine right behind front window (`x = -2.05, z = 2.15`, standable h = 1.16m)
  const vx = -2.05, vz = 2.15;
  add(rbox(2.32, 0.88, 0.98, 0.04, mintDark), vx, 0.47, vz);
  add(rbox(2.38, 0.08, 1.04, 0.025, marble), vx, 0.94, vz);
  // 8 colourful pastel gelato mounds in 2x4 stainless tubs!
  const flavours = [0xf78da7, 0x9bd67e, 0xffe46b, 0xffae52, 0x89c4f4, 0xfaf3e6, 0xc68b59, 0xe84a72];
  for (let i = 0; i < 8; i++) {
    const gx = vx - 0.82 + (i % 4) * 0.55;
    const gz = vz - 0.18 + Math.floor(i / 4) * 0.36;
    pushInst('bloom', prims.bloom, foliageInst, gx, 1.05, gz, 0, i * 0.8, 0, 1.55, 1.25, 1.55, flavours[i]);
  }
  // Curved vitrine sneeze-guard glass (1 single mesh)
  const vGlassGeo = new THREE.CylinderGeometry(0.52, 0.52, 2.28, 12, 1, false, 0, PI * 0.62);
  vGlassGeo.rotateZ(PI / 2);
  add(new THREE.Mesh(vGlassGeo, vitrineGlass), vx, 1.02, vz + 0.02);

  // 2) Back waffle-cone & ceramic syrup jar shelf (standable counter h = 1.04m + back wall shelf)
  add(rbox(2.82, 0.92, 0.78, 0.04, oakLight), -2.05, 0.49, -2.85);
  add(rbox(2.88, 0.08, 0.84, 0.025, marble), -2.05, 0.98, -2.85);
  add(rbox(2.68, 1.25, 0.34, 0.03, walnut), -2.05, 1.88, -3.12);
  for (let i = 0; i < 5; i++) {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 8), oakLight), -2.95 + i * 0.26, 1.18, -2.75, PI, 0, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 10), glass), -1.65 + i * 0.26, 1.72, -3.06);
  }
  boxCol(-2.05, -3.14, 2.72, 0.38);

  // ---- ROOM 2 (Sunny Pastry Parlor & Gleaming Copper Espresso Bar, standable h = 1.06m) ----
  const ex = 2.45, ez = -2.65;
  add(rbox(2.52, 0.96, 0.88, 0.04, walnut), ex, 0.51, ez);
  add(rbox(2.6, 0.08, 0.96, 0.03, marble), ex, 1.02, ez);
  // Vintage vertical Italian copper & brass espresso machine w/ eagle dome!
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.58, 14), copper), ex + 0.35, 1.35, ez);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, PI * 2, 0, PI / 2), brass), ex + 0.35, 1.64, ez);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), brass), ex + 0.35, 1.92, ez);
  for (const dx of [-0.12, 0.12]) {
    add(rbox(0.06, 0.08, 0.22, 0.02, brass), ex + 0.35 + dx, 1.24, ez + 0.26);
  }
  // Brioche & lemon pastry stand on bar
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.08, 0.16, 12), marble), ex - 0.55, 1.14, ez + 0.05);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2;
    pushInst('lemon', prims.lemon, foliageInst, ex - 0.55 + Math.cos(a) * 0.12, 1.26, ez + 0.05 + Math.sin(a) * 0.12, PI / 2, a, 0, 1.25, 1.25, 1.25, 0xf2a93b);
  }
  for (const [lx, lz] of [[-2.05, 0.5], [2.25, 0.2]]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lampGlow), lx, 3.28, lz);
  }

  finalize([]);
  addStandableCols(root, [
    [vx, vz, 2.38, 1.04, 1.16],
    [-2.05, -2.72, 2.88, 0.62, 1.04],
    [ex, ez, 2.60, 0.96, 1.06],
  ]);
  Object.assign(root.userData, {
    floorY: 0.08,
    footprint: { w: W, d: D },
    rooms: [
      { name: 'espresso_bar', x: 2.40, z: 0, w: 4.10, d: 7.00, walkX: 1.95, walkZ: 0.45 },
      { name: 'gelato_parlor', x: -2.05, z: 0, w: 4.80, d: 7.00, walkX: -1.35, walkZ: -0.15 },
    ],
    door: { x: 2.05, z: +(D / 2 + 1.25).toFixed(2) },
    doorIn: { x: 2.05, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 0.35, z: -0.15 }],
    propSlots: [
      { id: 'sp_gelato_cart', x: -3.45, z: 0.25, rot: 1.57 },
      { id: 'sp_lemon_planter', x: -0.42, z: 2.75, rot: -2.8 },
      { id: 'sp_olive_amphora', x: -3.75, z: -1.52, rot: 1.2 },
      { id: 'sp_bistro_set', x: -2.65, z: -1.15, rot: 0.3 },
      { id: 'sp_bistro_set', x: 3.32, z: 1.15, rot: -0.5 },
      { id: 'sp_bistro_set', x: 3.32, z: -0.85, rot: -1.1 },
      { id: 'sp_lemon_planter', x: 0.95, z: 2.85, rot: 2.9 },
      { id: 'sp_wine_rack', x: 3.85, z: 2.55, rot: -1.57 },
      { id: 'sp_sea_chest', x: 0.95, z: -2.75, rot: 0.1 },
      { id: 'sp_olive_amphora', x: 3.82, z: -2.62, rot: -2.3 },
    ],
  });
  return tagPaintColors(THREE, root, 0xc6e0bf);
}

// ============================================================================
// 5. FISHERMAN BOATHOUSE (`boathouse_loft`)
// ============================================================================
function buildBoathouseLoft(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'boathouse_loft', 67);
  kit.THREE = THREE;
  const { root, roofG, M, glowMat, tex, add, addR, rbox, boxCol, wall, beam, finalize } = kit;

  const W = 9.6, D = 7.6, H = 3.85, T = 0.28;
  const whiteStone = M(0xf3ead8, tex('stone', 2.4, 2.0));
  const innerStone = M(0xfaf2e4, tex('plaster', 2.0, 2.0));
  const stoneTrim = M(0xe0d4bc, tex('stone', 1.8, 1.8));
  const seaBlueWood = M(0x7ca7cc, tex('wood_light', 1.8, 1.8));
  const seaBlueLight = M(0x9bc0de, tex('wood_light', 1.6, 1.6));
  const flagFloor = M(0xd5c7ad, tex('stone', 4.0, 3.6));
  const plankFloor = M(0xc79862, tex('wood_light', 3.4, 3.4));
  const timber = M(0x845730, tex('wood_light', 1.8, 1.8));
  const oarWood = M(0xd9a660, tex('wood_light', 1.4, 1.4));
  const ropeMat = M(0xd6b882, tex('burlap', 2.2, 2.2));
  const hullWhite = M(0xf6f0e2, tex('plaster', 1.2, 1.2));
  const buoyRed = M(0xd84032, null, { roughness: 0.65, metalness: 0 });
  const floatTeal = M(0x36c2c7, null, { roughness: 0.32, metalness: 0 });
  const glass = M(0x98d0ec, null, { roughness: 0.22, metalness: 0 });
  const iron = M(0x43484e, null, { roughness: 0.62, metalness: 0 });
  const lampGlow = glowMat(0xffe7a6, 0xffb142, 1.7);
  const vine = M(0x5a4028, tex('bark', 1, 2));
  const terra = M(0xd46d3f, tex('terracotta', 1.2, 1.2));
  const tileInstMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('terracotta', 0.6, 0.6), roughness: 0.88, metalness: 0 });
  const foliageInst = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });

  // Plinth & floors
  add(rbox(W + 0.32, 0.06, D + 0.32, 0.02, stoneTrim), 0, 0.03, 0);
  add(rbox(4.45, 0.04, D - 0.36, 0.01, flagFloor), -2.18, 0.055, 0);
  add(rbox(4.15, 0.045, D - 0.36, 0.01, plankFloor), 2.32, 0.058, 0);

  // Whitewashed limestone exterior walls (grand front arch doorway w = 2.45m >= 1.48m at x = +1.95!)
  wall(0, D / 2, 0, W, H, T, [
    { door: true, u: 1.95, w: 2.45, h: 2.95, arch: true },
    { u: -2.25, y0: 1.18, w: 1.25, h: 1.35, round: false },
  ], whiteStone, innerStone);
  wall(0, -D / 2, PI, W, H, T, [
    { u: 2.15, y0: 1.18, w: 1.25, h: 1.35, round: false },
  ], whiteStone, innerStone);
  wall(-W / 2, 0, -PI / 2, D, H, T, [
    { u: 0.35, y0: 1.2, w: 1.2, h: 1.32, round: false },
  ], whiteStone, innerStone);
  wall(W / 2, 0, PI / 2, D, H, T, [
    { u: -0.25, y0: 1.2, w: 1.25, h: 1.32, round: false },
  ], whiteStone, innerStone);

  // Interior stone partition at x = +0.15 with wide arch (w = 1.76m at z = +0.45)
  wall(0.15 - T / 2, 0, -PI / 2, D - 2 * T, H, T, [
    { door: true, u: 0.45, w: 1.76, h: 2.7, arch: true },
  ], whiteStone, innerStone);
  addStoneArchTrim(kit, 0.15 + 0.06, 0.45, -PI / 2, 1.76, 2.7, stoneTrim);
  addStoneArchTrim(kit, 1.95, D / 2 + 0.03, 0, 2.45, 2.95, stoneTrim);
  addStoneArchTrim(kit, -2.25, D / 2 + 0.03, 0, 2.15, 2.85, stoneTrim); // Twin blind stone arch on left!
  addCornerQuoins(kit, W, D, 0.06, H, stoneTrim);

  const winMats = { stone: stoneTrim, glass, frame: timber, shutter: seaBlueLight, shutterDark: seaBlueWood, terra, foliageInst };
  addShutteredWindow(kit, THREE, -2.25, 1.18, D / 2, 0, 1.25, 1.35, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, -2.15, 1.18, -D / 2, PI, 1.25, 1.35, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, -W / 2, 1.2, 0.35, -PI / 2, 1.2, 1.32, winMats, { shutters: false });
  addShutteredWindow(kit, THREE, W / 2, 1.2, 0.25, PI / 2, 1.25, 1.32, winMats, { shutters: true });

  // Draped fishing nets, turquoise glass floats & red-and-white harbor buoys on front facade!
  const netCurve1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.65, 3.35, D / 2 + 0.14),
    new THREE.Vector3(-2.85, 2.05, D / 2 + 0.22),
    new THREE.Vector3(-1.35, 2.55, D / 2 + 0.18),
    new THREE.Vector3(-0.55, 3.45, D / 2 + 0.14),
  ]);
  const netCurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.35, 2.75, D / 2 + 0.16),
    new THREE.Vector3(-2.35, 1.45, D / 2 + 0.24),
    new THREE.Vector3(-0.95, 1.95, D / 2 + 0.2),
  ]);
  add(new THREE.Mesh(new THREE.TubeGeometry(netCurve1, 18, 0.055, 6, false), ropeMat));
  add(new THREE.Mesh(new THREE.TubeGeometry(netCurve2, 14, 0.048, 6, false), ropeMat));
  // Hanging turquoise glass floats
  for (const [fx, fy] of [[-3.25, 2.25], [-2.95, 1.95], [-1.25, 1.65]]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), floatTeal), fx, fy, D / 2 + 0.24);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.02, 5, 12), ropeMat), fx, fy, D / 2 + 0.24);
  }
  // Hanging red-and-white buoys flanking the stone arch
  for (const [bx, by] of [[-0.68, 2.05], [-0.42, 1.78], [3.48, 2.15]]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), buoyRed), bx, by, D / 2 + 0.22, 0, 0, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.09, 10), hullWhite), bx, by, D / 2 + 0.22);
  }

  // ---- WEATHERED BLUE-GREY SEA-TIMBER GABLE & TERRACOTTA ROOF IN `roofG` ----
  addGableBarrelRoof(kit, THREE, {
    W, D, wallH: H, rise: 1.58, wallMat: seaBlueWood, innerMat: seaBlueLight,
    timberMat: timber, tileInstMat, gableVent: false,
  });
  // Weathered sea-blue hayloft shutter door + net swags in upper gable (`roofG`)
  addR(rbox(1.12, 1.05, 0.14, 0.03, seaBlueLight), 0, H + 0.72, D / 2 - 0.02);
  addR(rbox(1.22, 0.1, 0.18, 0.02, timber), 0, H + 1.24, D / 2 + 0.02);
  const gableNet = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.85, H + 0.75, D / 2 + 0.12),
    new THREE.Vector3(-0.75, H + 0.18, D / 2 + 0.18),
    new THREE.Vector3(0.15, H + 0.85, D / 2 + 0.14),
    new THREE.Vector3(1.15, H + 0.22, D / 2 + 0.18),
    new THREE.Vector3(2.05, H + 0.72, D / 2 + 0.12),
  ]);
  addR(new THREE.Mesh(new THREE.TubeGeometry(gableNet, 20, 0.055, 6, false), ropeMat));
  addStuccoChimney(kit, -2.55, H + 0.55, -1.75, whiteStone, stoneTrim, terra);

  addBougainvillea(kit, THREE, [
    [-4.72, 1.45, 3.78, 0.38, 7],
    [-4.65, 2.65, 3.82, 0.44, 8],
  ], { vine, foliageInst });

  // ---- ROOM 1 (Oar Lounge): Cutaway Painted Rowboat Sofa & Wooden Oar Rack Wall ----
  // 1) Painted white-and-blue rowboat sofa with red-and-cream striped seat cushion (standable h = 0.78m)!
  const sx = -2.25, sz = -2.25;
  add(rbox(2.58, 0.44, 0.98, 0.08, hullWhite), sx, 0.34, sz);
  add(rbox(2.64, 0.38, 0.16, 0.05, seaBlueWood), sx, 0.78, sz - 0.44); // Curved boat gunwale backrest
  for (const side of [-1, 1]) {
    add(rbox(0.28, 0.34, 0.96, 0.06, seaBlueWood), sx + side * 1.22, 0.68, sz); // Bow/stern armrests
    add(rbox(0.22, 0.24, 0.78, 0.03, timber), sx + side * 0.85, 0.14, sz); // Trestle legs
  }
  // Red-and-cream striped boat cushion + throw pillows
  for (let i = 0; i < 7; i++) {
    add(rbox(0.32, 0.14, 0.78, 0.04, i % 2 === 0 ? buoyRed : hullWhite), sx - 0.96 + i * 0.32, 0.58, sz + 0.04);
  }

  // 2) Wooden oar rack along left wall (6 tall golden-oak paddles + coiled ropes)
  add(rbox(0.1, 0.12, 2.85, 0.02, timber), -4.44, 1.48, -1.15);
  for (let i = 0; i < 6; i++) {
    const oz = -2.35 + i * 0.46;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.45, 7), oarWood), -4.38, 1.32, oz);
    add(rbox(0.04, 0.68, 0.18, 0.04, oarWood), -4.38, 2.38, oz);
  }
  add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 6, 14), ropeMat), -0.75, 1.75, -3.32);

  // ---- ROOM 2 (Lobster-Pot & Net Mezzanine Storage) ----
  // Timber loft platform beam, wooden ladder & stacked wicker lobster cages
  add(rbox(3.95, 0.18, 1.55, 0.03, timber), 2.32, 2.42, -2.65);
  beam([0.65, 0.06, -1.92], [0.65, 2.42, -1.92], 0.16, timber);
  beam([4.05, 0.06, -1.92], [4.05, 2.42, -1.92], 0.16, timber);
  // Wooden loft ladder leaning against beam (tucked at z = -1.78)
  for (const lx of [0.85, 1.28]) beam([lx, 0.08, -1.55], [lx, 2.52, -1.92], 0.065, oarWood);
  for (let r = 0; r < 6; r++) {
    const t = (r + 1) / 7;
    add(rbox(0.46, 0.05, 0.05, 0.015, oarWood), 1.065, 0.08 + t * 2.42, -1.55 - t * 0.37);
  }
  // Stacked wicker lobster pots & coiled nets under loft + turquoise floats above loft
  for (const [px, py, pz] of [[2.25, 0.35, -2.75], [3.22, 0.35, -2.75], [2.75, 0.96, -2.78], [2.15, 2.82, -2.65], [3.15, 2.82, -2.65]]) {
    add(rbox(0.82, 0.56, 0.68, 0.12, ropeMat), px, py, pz);
  }
  for (const fx of [2.05, 2.65, 3.25]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), floatTeal), fx, 2.15, -1.88);
  }
  for (const [lx, lz] of [[-2.15, 0.2], [2.25, 0.6]]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), lampGlow), lx, 3.25, lz);
  }

  finalize([]);
  addStandableCols(root, [
    [sx, sz, 2.68, 1.12, 0.78],
    [2.45, -2.55, 3.35, 1.38, 1.22],
  ]);
  Object.assign(root.userData, {
    floorY: 0.08,
    footprint: { w: W, d: D },
    rooms: [
      { name: 'net_storage', x: 2.35, z: 0, w: 4.40, d: 7.10, walkX: 1.95, walkZ: 0.75 },
      { name: 'oar_lounge', x: -2.20, z: 0, w: 4.70, d: 7.10, walkX: -1.85, walkZ: 0.45 },
    ],
    door: { x: 1.95, z: +(D / 2 + 1.25).toFixed(2) },
    doorIn: { x: 1.95, z: +(D / 2 - 0.95).toFixed(2) },
    innerDoors: [{ x: 0.15, z: 0.45 }],
    propSlots: [
      { id: 'sp_lobster_trap', x: 3.62, z: 0.65, rot: -1.57 },
      { id: 'sp_lobster_trap', x: 3.62, z: -0.65, rot: -1.4 },
      { id: 'sp_buoy_float', x: 0.85, z: -2.65, rot: 0.3 },
      { id: 'sp_fuel_drum', x: 3.72, z: 2.55, rot: -2.2 },
      { id: 'sp_anchor_bollard', x: 0.75, z: 2.75, rot: 2.8 },
      { id: 'sp_sea_chest', x: -3.72, z: 2.55, rot: 1.57 },
      { id: 'sp_buoy_float', x: -1.25, z: 2.75, rot: 3.0 },
      { id: 'sp_pelican_post', x: -3.72, z: 0.75, rot: 1.57 },
      { id: 'sp_olive_amphora', x: -3.82, z: -0.95, rot: 1.2 },
      { id: 'sp_lobster_trap', x: -0.65, z: -2.65, rot: 0.1 },
    ],
  });
  return tagPaintColors(THREE, root, 0xede4cf);
}

// ============================================================================
// LANDMARK 1: SEAHORSE FOUNTAIN (`seahorseFountain`)
// ============================================================================
function buildSeahorseFountain(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'seahorse_fountain', 79);
  const { root, M, tex, add, boxCol, finalize } = kit;

  const stone = M(0xefe4cc, tex('stone', 1.8, 1.8));
  const mosaicMat = M(0xffffff, waveMosaicTex(THREE));
  const waterMat = M(0x2ebad6, null, { roughness: 0.22, metalness: 0, emissive: 0x116b85, emissiveIntensity: 0.28 });
  const seaBlue = M(0x2278bf, null, { roughness: 0.34, metalness: 0 });
  const seaTurq = M(0x3ec2cc, null, { roughness: 0.34, metalness: 0 });
  const seaGold = M(0xe6b447, null, { roughness: 0.42, metalness: 0 });
  const jetMat = M(0xdff8ff, null, { roughness: 0.14, metalness: 0, emissive: 0x93e4ff, emissiveIntensity: 0.45, transparent: true, opacity: 0.72, depthWrite: false });

  // Stepped circular limestone plinth + blue-gold wave mosaic basin (R_outer = 1.46m so plaza spawns stay 100% clear!)
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.58, 0.14, 28), stone), 0, 0.07, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.4, 0.48, 28, 1, true), mosaicMat), 0, 0.38, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.48, 24), stone), 0, 0.36, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.13, 10, 28), stone), 0, 0.64, 0, PI / 2, 0, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.24, 0.06, 26), waterMat), 0, 0.61, 0);

  // Scalloped ceramic pedestal
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.36, 14), seaTurq), 0, 0.78, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 8, 16), seaGold), 0, 0.7, 0, PI / 2, 0, 0);

  // Sculpted Storybook Ceramic Seahorse (curled tail, plump belly, S-curved neck, coronet crest & spouting snout!)
  const spinePts = [
    [0, 1.18, -0.32], [0, 0.94, -0.42], [0, 0.88, -0.18], [0, 1.08, 0.04],
    [0, 1.48, 0.14], [0, 1.94, 0.06], [0, 2.40, -0.10], [0, 2.82, -0.02], [0, 3.04, 0.18],
  ].map((p) => new THREE.Vector3(...p));
  const spineCurve = new THREE.CatmullRomCurve3(spinePts);
  const bodySegs = 24;
  for (let i = 0; i <= bodySegs; i++) {
    const t = i / bodySegs;
    const p = spineCurve.getPoint(t);
    const r = t < 0.25 ? 0.09 + t * 0.48 : t < 0.62 ? 0.31 - Math.abs(t - 0.45) * 0.26 : 0.25 - (t - 0.62) * 0.28;
    const segMat = i % 3 === 0 ? seaGold : i % 2 === 0 ? seaBlue : seaTurq;
    add(new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.085, r), 12, 10), segMat), p.x, p.y, p.z, 0, 0, 0);
  }
  // Curled prehensile tail spiral tip
  add(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.068, 8, 16, PI * 1.55), seaBlue), 0, 1.10, -0.28, 0, PI / 2, 0.6);
  // Golden ridged dorsal fin + pectoral cheek fins + coronet crown
  for (let i = 0; i < 8; i++) {
    const t = 0.32 + i * 0.062;
    const p = spineCurve.getPoint(t);
    add(kit.rbox(0.055, 0.18, 0.24, 0.02, seaGold), 0, p.y, p.z - 0.24, 0.35, 0, 0);
  }
  // Head, eyes & tubular ceramic snout at (0, 2.94, +0.46)
  add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), seaBlue), 0, 3.04, 0.15);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 7), seaGold), 0, 3.32, 0.08, -0.2, 0, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.12, 0.40, 10), seaTurq), 0, 2.94, 0.36, PI * 0.56, 0, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 12), seaGold), 0, 2.90, 0.54);
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), seaGold), s * 0.19, 3.08, 0.20);
    add(kit.rbox(0.04, 0.18, 0.15, 0.015, seaGold), s * 0.22, 2.98, 0.03, 0, s * 0.4, 0);
  }

  // 4 graceful arching crystal water streams merged into 1 single transparent mesh!
  const jetCurves = [
    [[0, 2.90, 0.55], [0, 3.06, 0.92], [0, 1.88, 1.14], [0, 0.62, 1.18]],
    [[-0.18, 1.75, 0.1], [-0.62, 1.92, 0.38], [-0.98, 1.22, 0.54], [-1.08, 0.62, 0.58]],
    [[0.18, 1.75, 0.1], [0.62, 1.92, 0.38], [0.98, 1.22, 0.54], [1.08, 0.62, 0.58]],
    [[0, 1.68, -0.15], [0, 1.88, -0.62], [0, 1.18, -0.98], [0, 0.62, -1.08]],
  ];
  for (const pts of jetCurves) {
    const jg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 14, 0.026, 6, false);
    const jm = new THREE.Mesh(jg, jetMat);
    jm.castShadow = false;
    root.add(jm);
  }

  boxCol(0, 0, 2.86, 2.86);
  finalize([]);
  root.userData.snout = { x: 0, y: 2.41, z: 0.44 };
  return tagPaintColors(THREE, root, 0x2278bf);
}

// ============================================================================
// LANDMARK 2: OCTAGONAL HARBOR KIOSK (`harborKiosk`)
// ============================================================================
function buildHarborKiosk(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'harbor_kiosk', 89);
  const { root, M, glowMat, tex, add, rbox, boxCol, finalize } = kit;

  const stripeHex = opts.stripeHex || 0xd64540;
  const baseHex = opts.baseHex || 0xb55346;
  const theme = opts.theme || 'gelato';

  const woodBase = M(baseHex, tex('wood_light', 1.6, 1.6));
  const woodTrim = M(0x7c4e29, tex('wood_light', 1.5, 1.5));
  const marble = M(0xf8f2e4, tex('stone', 1.4, 1.4), { roughness: 0.4 });
  const stripeA = M(stripeHex, tex('burlap', 1.2, 1.2));
  const stripeB = M(0xfff7e6, tex('burlap', 1.2, 1.2));
  const brass = M(0xe6b448, null, { roughness: 0.42, metalness: 0 });
  const iron = M(0x42474e, null, { roughness: 0.62, metalness: 0 });
  const glass = M(0xbfe8f7, null, { roughness: 0.22, metalness: 0 });
  const lampGlow = glowMat(0xffe9ab, 0xffb344, 1.65);

  const R = 1.38;
  // Octagonal stone base, panelled waist & marble service counter
  add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.1, R + 0.14, 0.1, 8), marble), 0, 0.05, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.92, 8), woodBase), 0, 0.52, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.08, 0.09, 8), marble), 0, 1.01, 0);
  // 8 turned wooden corner posts
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + PI / 8;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.36, 8), woodTrim), Math.cos(a) * (R - 0.06), 1.68, Math.sin(a) * (R - 0.06));
  }
  // Striped 8-wedge octagonal tent canopy + scalloped valance + brass finial!
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * PI * 2;
    const mat = i % 2 === 0 ? stripeA : stripeB;
    const wedge = new THREE.ConeGeometry(R + 0.34, 1.05, 1, 1, false, a0, PI / 4);
    add(new THREE.Mesh(wedge, mat), 0, 2.86, 0);
    const ma = a0 + PI / 8;
    add(rbox(0.98, 0.22, 0.05, 0.04, mat), Math.cos(ma) * (R + 0.26), 2.26, Math.sin(ma) * (R + 0.26), 0, -ma + PI / 2, 0);
  }
  add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), brass), 0, 3.46, 0);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 8), brass), 0, 3.64, 0);

  // Kiosk display counter goods (gelato tubs & cones OR fresh harbor catch on ice)
  add(rbox(1.15, 0.32, 0.62, 0.04, glass), 0, 1.2, 0.42);
  const goodsCols = theme === 'seafood'
    ? [0xd94832, 0x6ea0b8, 0xe86b42, 0x89b5c9]
    : [0xf78da7, 0x9bd67e, 0xffe46b, 0x89c4f4];
  goodsCols.forEach((hex, idx) => {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), M(hex)), -0.36 + idx * 0.24, 1.18, 0.44);
  });
  // Harbor iron lamp post attached to kiosk side
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 2.85, 8), iron), R + 0.24, 1.42, -0.25);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), lampGlow), R + 0.24, 2.92, -0.25);

  boxCol(0, 0, R * 1.92, R * 1.92);
  finalize([]);
  return tagPaintColors(THREE, root, stripeHex);
}

// ============================================================================
// LANDMARK 3: HARBOUR MAIL FLOATPLANE (`crimsonSeaplane` builder id kept for the map code)
// A cream-and-teal twin-engine mail BIPLANE on twin pontoon floats: two open cockpits, staggered
// wings joined by interplane struts, an engine pod between the wings on each side and a twin-fin tail.
// Engine pods sit at local (±1.6, 2.05, 1.15): the port propeller is the `propeller` group built here,
// the starboard one is added by maps/seaplane/map.js at the mirrored mount (`root.userData.propMounts`).
// ============================================================================
function buildCrimsonSeaplane(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'crimson_seaplane', 101);
  const { root, M, tex, add, rbox, beam, finalize } = kit;

  // Nose faces `+Z`, wings span `X`, spinning `propeller` group on the port engine pod!
  const cream = M(0xf6eedb, null, { roughness: 0.42, metalness: 0 });
  const teal = M(0x2f8f8a, null, { roughness: 0.40, metalness: 0 });
  const tealDark = M(0x1f6a68, null, { roughness: 0.46, metalness: 0 });
  const brass = M(0xe6b448, null, { roughness: 0.38, metalness: 0 });
  const iron = M(0x434850, null, { roughness: 0.54, metalness: 0 });
  const leather = M(0x693c1e, tex('bark', 1, 1));
  const propWood = M(0x9e5324, tex('wood_light', 1.4, 1.4), { roughness: 0.42, metalness: 0 });
  const tipCream = M(0xfbf8ef, null, { roughness: 0.42, metalness: 0 });
  const glass = M(0xbbe8fa, null, { roughness: 0.22, metalness: 0 });

  const spindle = (profile, sx, sz, x, y, z, mat) => {
    const geo = new THREE.LatheGeometry(profile.map(([r, l]) => new THREE.Vector2(r, l)), 18);
    geo.scale(sx, 1, sz);
    geo.rotateX(-PI / 2);
    geo.translate(x, y, z);
    return add(new THREE.Mesh(geo, mat), 0, 0, 0);
  };

  // Twin teal pontoon floats with cream decks (`x = ±1.15`, bow at `z = +3.1`, stern at `z = -2.3`)
  const floatProfile = [[0.02, 0.0], [0.20, 0.30], [0.34, 1.10], [0.37, 2.60], [0.31, 4.00], [0.17, 5.00], [0.0, 5.4]];
  for (const sx of [-1, 1]) {
    spindle(floatProfile, 1.0, 0.82, sx * 1.15, 0.30, 3.1, teal);
    add(rbox(0.46, 0.07, 3.6, 0.03, cream), sx * 1.15, 0.585, 0.75);
    add(rbox(0.50, 0.05, 0.9, 0.02, brass), sx * 1.15, 0.03, 0.9);
    // N-struts from each float up to the fuselage & lower wing
    beam([sx * 1.15, 0.58, 1.55], [sx * 0.42, 1.22, 1.45], 0.055, iron);
    beam([sx * 1.15, 0.58, 0.05], [sx * 0.42, 1.22, 0.15], 0.055, iron);
    beam([sx * 1.15, 0.58, 1.55], [sx * 0.42, 1.22, 0.15], 0.04, iron);
    beam([sx * 1.15, 0.58, 0.80], [sx * 1.60, 1.30, 0.80], 0.05, iron);
  }
  beam([-1.15, 0.55, 1.55], [1.15, 0.55, 1.55], 0.045, iron);
  beam([-1.15, 0.55, 0.05], [1.15, 0.55, 0.05], 0.045, iron);

  // Slender cream fuselage (`z` from `-3.3` tail to `+3.3` nose) with teal nose cap & cheat-line
  const fuseProfile = [
    [0.02, 0.0], [0.30, 0.12], [0.46, 0.50], [0.50, 1.40], [0.48, 2.60],
    [0.38, 4.00], [0.24, 5.30], [0.10, 6.30], [0.0, 6.6],
  ];
  spindle(fuseProfile, 1.0, 1.06, 0, 1.42, 3.3, cream);
  const noseCap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 16, 12), teal);
  noseCap.scale.set(1.08, 1.14, 1.0);
  add(noseCap, 0, 1.42, 2.93);
  add(rbox(1.03, 0.10, 4.3, 0.04, teal), 0, 1.40, 0.35);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), brass), 0, 1.42, 3.40, PI / 2, 0, 0);
  for (const sx of [-1, 1]) {
    // Brass mail-service roundel on each flank
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 16), brass), sx * 0.44, 1.56, -1.55, 0, 0, PI / 2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), tealDark), sx * 0.45, 1.56, -1.55, 0, 0, PI / 2);
  }

  // Two open cockpits in tandem (pilot + mail clerk): leather coamings, headrests & windscreens
  for (const cz of [0.15, -0.95]) {
    add(rbox(0.66, 0.16, 0.74, 0.07, leather), 0, 1.90, cz);
    add(rbox(0.44, 0.20, 0.18, 0.06, leather), 0, 2.00, cz - 0.38);
    add(rbox(0.56, 0.24, 0.05, 0.02, glass), 0, 2.06, cz + 0.40, -0.45, 0, 0);
  }

  // Staggered biplane wings: cream lower wing (`7.6m`) + teal upper wing (`8.6m`) with cream tips
  add(rbox(7.6, 0.13, 1.40, 0.06, cream), 0, 1.30, 0.75);
  add(rbox(7.4, 0.04, 0.26, 0.02, teal), 0, 1.33, 0.14);
  add(rbox(8.6, 0.15, 1.50, 0.07, teal), 0, 2.78, 0.95);
  add(rbox(8.4, 0.05, 0.28, 0.02, tealDark), 0, 2.80, 0.28);
  for (const sx of [-1, 1]) {
    add(rbox(0.62, 0.16, 1.52, 0.07, cream), sx * 4.02, 2.78, 0.95);
    // Cabane struts (fuselage -> upper wing) and two bays of interplane struts
    beam([sx * 0.34, 1.86, 1.25], [sx * 0.62, 2.72, 1.42], 0.05, iron);
    beam([sx * 0.34, 1.86, 0.55], [sx * 0.62, 2.72, 0.50], 0.05, iron);
    for (const bx of [2.55, 3.45]) {
      beam([sx * bx, 1.36, 1.25], [sx * bx, 2.72, 1.48], 0.05, iron);
      beam([sx * bx, 1.36, 0.25], [sx * bx, 2.72, 0.45], 0.05, iron);
    }
    beam([sx * 2.55, 1.36, 1.25], [sx * 3.45, 2.72, 0.45], 0.022, iron);

    // Engine pod slung between the wings on each side + brass radiator + exhaust stubs
    const ex = sx * 1.6;
    beam([ex - 0.2, 1.36, 0.70], [ex - 0.16, 1.84, 0.80], 0.05, iron);
    beam([ex + 0.2, 1.36, 0.70], [ex + 0.16, 1.84, 0.80], 0.05, iron);
    beam([ex - 0.16, 2.28, 1.20], [ex - 0.2, 2.72, 1.30], 0.05, iron);
    beam([ex + 0.16, 2.28, 1.20], [ex + 0.2, 2.72, 1.30], 0.05, iron);
    add(rbox(0.52, 0.52, 1.36, 0.20, tealDark), ex, 2.05, 1.12);
    add(rbox(0.40, 0.40, 0.08, 0.04, brass), ex, 2.05, 1.80);
    for (let k = 0; k < 3; k++) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 6), iron), ex + sx * 0.29, 2.12, 1.40 - k * 0.22, 0, 0, sx * 1.25);
    }
  }

  // Spinning 2-blade mahogany `propeller` group on the PORT engine pod (`finalize([propeller])`)!
  const propeller = new THREE.Group();
  propeller.name = 'propeller';
  propeller.position.set(-1.6, 2.05, 1.94);
  root.add(propeller);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 14), brass), 0, 0, 0.10, PI / 2, 0, 0, propeller);
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.84, 0.045, 2, 0.02), propWood);
    blade.position.set(0, s * 0.45, 0);
    blade.rotation.y = s * 0.22;
    propeller.add(blade);
    add(rbox(0.175, 0.14, 0.048, 0.018, tipCream), 0, s * 0.80, 0, 0, s * 0.22, 0, propeller);
  }

  // Twin-fin tail: cream tailplane carrying a rounded teal end-plate fin on each tip (`z = -2.9`)
  add(rbox(2.9, 0.10, 0.82, 0.04, cream), 0, 1.74, -2.90);
  add(rbox(2.7, 0.04, 0.22, 0.02, teal), 0, 1.76, -3.24);
  for (const sx of [-1, 1]) {
    add(rbox(0.10, 0.98, 0.86, 0.30, teal), sx * 1.42, 1.90, -2.92);
    add(rbox(0.11, 0.30, 0.50, 0.10, cream), sx * 1.42, 1.90, -2.92);
    beam([sx * 0.14, 1.50, -2.70], [sx * 0.95, 1.72, -2.80], 0.04, iron);
  }
  add(rbox(0.16, 0.26, 1.10, 0.07, cream), 0, 1.62, -2.65);

  root.userData.propMounts = { port: [-1.6, 2.05, 1.94], starboard: [1.6, 2.05, 1.94] };
  finalize([propeller]);
  return tagPaintColors(THREE, root, 0x2f8f8a);
}

// ============================================================================
// LANDMARK 4: WALKABLE WOODEN HARBOR PIER (`woodenPier`)
// ============================================================================
function buildWoodenPier(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'wooden_pier', 113);
  const { root, M, tex, add, rbox, boxCol, beam, finalize } = kit;

  const length = opts.length || 10.4;
  const width = opts.width || 4.2;
  const hasCrane = opts.hasCrane !== false;
  const waterRamp = opts.waterRamp !== false;
  const rampW = opts.rampWidth || 2.65;
  const rampLen = opts.rampLength || 2.95;
  const rampDrop = opts.rampDrop || 1.07; // 0.75m pier deck -> -0.32m swimmable bay

  // Pier runs from local `z = -length/2` (shore entry — WIDE OPEN!) to `z = +length/2` (seaward tip).
  const deckMat = M(0xba8d5c, tex('wood_light', 2.4, 5.2));
  const beamMat = M(0x7c532e, tex('wood_planks_dark', 2.0, 2.0));
  const pilingMat = M(0x6e4b2b, tex('bark', 1.2, 2.2));
  const mossMat = M(0x4b7039, tex('leaves', 1.2, 1.2));
  const ropeMat = M(0xd8ba82, tex('burlap', 2.0, 2.0));
  const iron = M(0x434850, null, { roughness: 0.58, metalness: 0 });

  // Stringer beams underneath deck
  for (const sx of [-width * 0.42, 0, width * 0.42]) {
    add(rbox(0.24, 0.26, length, 0.03, beamMat), sx, -0.11, 0);
  }

  // Timber pilings reaching into the turquoise bay with mossy tidal band right around y = -1.07m!
  const pairs = Math.max(4, Math.round(length / 2.5));
  const pilingZ = [];
  for (let i = 0; i <= pairs; i++) pilingZ.push(-length / 2 + 0.35 + (i / pairs) * (length - 0.7));

  for (const sx of [-1, 1]) {
    const px = sx * (width / 2 - 0.16);
    pilingZ.forEach((pz, idx) => {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.185, 2.85, 10), pilingMat), px, -0.68, pz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.195, 0.42, 10), mossMat), px, -1.04, pz);
      for (let r = 0; r < 3; r++) {
        add(new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.03, 6, 12), ropeMat), px, 0.56 + r * 0.065, pz, PI / 2, 0, 0);
      }
      if (idx < pilingZ.length - 1) {
        const nz = pilingZ[idx + 1];
        const sag = new THREE.CatmullRomCurve3([
          new THREE.Vector3(px, 0.72, pz),
          new THREE.Vector3(px, 0.5, (pz + nz) / 2),
          new THREE.Vector3(px, 0.72, nz),
        ]);
        add(new THREE.Mesh(new THREE.TubeGeometry(sag, 10, 0.032, 6, false), ropeMat));
      }
    });
    // Side guardrail collider along pier deck
    boxCol(px, 0, 0.32, length);
  }

  // Seaward tip (`z = +length/2 - 0.18`): if `waterRamp` is enabled, leave a wide 2.65m center gateway open!
  const tipZ = length / 2 - 0.18;
  if (waterRamp) {
    const postX = rampW / 2 + 0.16;
    for (const sx of [-1, 1]) {
      const bx = sx * postX;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.88, 10), pilingMat), bx, 0.45, tipZ);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 12), ropeMat), bx, 0.68, tipZ, PI / 2, 0, 0);
      const outerX = sx * (width / 2 - 0.16);
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(outerX, 0.72, tipZ),
        new THREE.Vector3((outerX + bx) / 2, 0.54, tipZ),
        new THREE.Vector3(bx, 0.72, tipZ),
      ]);
      add(new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.032, 6, false), ropeMat));
      const sideW = Math.max(0.28, (width - rampW) * 0.5);
      boxCol(sx * (width / 2 - sideW / 2), tipZ, sideW, 0.34);
    }
    // Sloped side stringers & submerged pilings for the wooden water step-ramp!
    const zStart = length / 2 - 0.08;
    const zEnd = length / 2 + rampLen;
    for (const sx of [-1, 1]) {
      const rx = sx * (rampW / 2 + 0.08);
      beam([rx, 0.02, zStart], [rx, -rampDrop, zEnd], 0.14, beamMat);
      beam([rx, 0.68, zStart], [rx, -rampDrop + 0.58, zEnd - 0.35], 0.045, ropeMat);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.55, 8), pilingMat), rx, -rampDrop - 0.18, zEnd - 0.35);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.16, 0.38, 8), mossMat), rx, -rampDrop + 0.02, zEnd - 0.35);
    }
  } else {
    for (const bx of [-0.65, 0.65]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.85, 10), pilingMat), bx, 0.45, tipZ);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 12), ropeMat), bx, 0.68, tipZ, PI / 2, 0, 0);
    }
    const endRopes = [
      [-(width / 2 - 0.16), -0.65],
      [-0.65, 0.65],
      [0.65, width / 2 - 0.16],
    ];
    for (const [x0, x1] of endRopes) {
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, 0.72, tipZ),
        new THREE.Vector3((x0 + x1) / 2, 0.52, tipZ),
        new THREE.Vector3(x1, 0.72, tipZ),
      ]);
      add(new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.032, 6, false), ropeMat));
    }
    boxCol(0, tipZ, width, 0.34);
  }

  // Optional timber harbor cargo crane near mid-side of main pier (matching `interiors_sheet.png` bottom-right!)
  if (hasCrane) {
    const cx = -(width / 2 - 0.52), cz = 0.65;
    add(rbox(0.68, 0.24, 0.68, 0.04, beamMat), cx, 0.18, cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.65, 10), beamMat), cx, 1.48, cz);
    beam([cx, 2.45, cz], [cx - 1.15, 3.25, cz + 0.55], 0.13, beamMat);
    beam([cx, 1.65, cz], [cx - 0.72, 2.9, cz + 0.34], 0.09, beamMat);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 10), ropeMat), cx + 0.12, 1.05, cz, 0, 0, PI / 2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 6), ropeMat), cx - 1.08, 2.48, cz + 0.52);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.032, 6, 10, PI * 1.45), iron), cx - 1.08, 1.72, cz + 0.52);
    boxCol(cx, cz, 0.78, 0.78);
  }

  finalize([]);

  // Add walkable deck planks + water step-ramp AFTER `finalize()` as ground meshes (`userData.ground = true`)!
  const plankCount = Math.max(16, Math.round(length / 0.34));
  const stepZ = length / plankCount;
  const deckGeo = new RoundedBoxGeometry(width - 0.14, 0.11, length, 2, 0.03);
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.set(0, 0.03, 0);
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  deckMesh.userData.ground = true;
  deckMesh.userData.paint = new THREE.Color(0xba8d5c);
  root.add(deckMesh);

  // Subtle plank seam strips + wooden water step-ramp treads merged into 1 ground mesh
  const seamGroup = new THREE.Group();
  for (let i = 0; i < plankCount; i += 2) {
    const m = rbox(width - 0.22, 0.015, stepZ * 0.82, 0.005, deckMat);
    m.position.set(0, 0.082, -length / 2 + (i + 0.5) * stepZ);
    seamGroup.add(m);
  }
  if (waterRamp) {
    const steps = 9;
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const sy = 0.02 - t * rampDrop;
      const sz = length / 2 + t * rampLen;
      const stepM = rbox(rampW, 0.10, (rampLen / steps) * 1.08, 0.02, s >= 6 ? mossMat : deckMat);
      stepM.position.set(0, sy, sz);
      stepM.rotation.x = 0.12;
      seamGroup.add(stepM);
    }
  }
  mergeStatic(THREE, seamGroup);
  root.add(seamGroup);
  seamGroup.traverse((m) => {
    if (m.isMesh) {
      m.userData.ground = true;
      m.userData.paint = new THREE.Color(0xba8d5c);
    }
  });
  root.userData.merged = true;
  return tagPaintColors(THREE, root, 0xba8d5c);
}

// ============================================================================
// LANDMARK 5: MEDITERRANEAN PAINTED ROWBOAT SKIFF (`rowboat`)
// ============================================================================
function buildRowboat(THREE, opts = {}) {
  const kit = createBuilderKit(THREE, opts, 'rowboat', 127);
  const { root, M, tex, add, rbox, finalize } = kit;

  const trimHex = opts.trimHex || 0x2c6fb8;
  const hullHex = opts.hullHex || 0xf7f1e3;
  const hullMat = M(hullHex, tex('plaster', 1.2, 1.2));
  const trimMat = M(trimHex, null, { roughness: 0.55 });
  const keelRed = M(0xb83b2e, null, { roughness: 0.65 });
  const oak = M(0xb8844c, tex('wood_light', 1.5, 1.5));
  const rope = M(0xd8ba82, tex('burlap', 1.8, 1.8));

  // Curved clinker skiff hull (`L = 3.55m`, `W = 1.44m`) — crisp white exterior + painted sheer & fore/aft decks!
  const hullGeo = new THREE.SphereGeometry(1, 20, 12, 0, PI * 2, PI * 0.48, PI * 0.52);
  hullGeo.scale(0.72, 0.54, 1.78);
  const hullInner = new THREE.SphereGeometry(1, 18, 10, 0, PI * 2, PI * 0.5, PI * 0.5);
  hullInner.scale(0.61, 0.44, 1.56);
  kit.flipGeo(hullInner);
  add(new THREE.Mesh(hullGeo, hullMat), 0, 0.5, 0);
  add(new THREE.Mesh(hullInner, hullMat), 0, 0.52, 0);

  // Bold Mediterranean cobalt/coral sheer band, fore/aft deck caps & oak gunwale ring
  const trimRing = new THREE.TorusGeometry(1, 0.075, 8, 26);
  trimRing.scale(0.71, 1.76, 0.95);
  trimRing.rotateX(PI / 2);
  add(new THREE.Mesh(trimRing, trimMat), 0, 0.48, 0);
  const gunwale = new THREE.TorusGeometry(1, 0.045, 8, 26);
  gunwale.scale(0.72, 1.78, 0.85);
  gunwale.rotateX(PI / 2);
  add(new THREE.Mesh(gunwale, oak), 0, 0.55, 0);
  add(rbox(0.72, 0.06, 0.52, 0.14, trimMat), 0, 0.51, 1.34);
  add(rbox(0.68, 0.06, 0.46, 0.12, trimMat), 0, 0.51, -1.34);
  add(rbox(0.14, 0.14, 3.18, 0.04, keelRed), 0, 0.04, 0);

  // 3 wooden thwart benches + central slatted oak standing deck (`local y = 0.42` -> world `~0.15m`!) + resting oars + coiled bow rope
  add(rbox(0.98, 0.06, 0.28, 0.02, oak), 0, 0.42, -0.74);
  add(rbox(1.22, 0.06, 0.3, 0.02, oak), 0, 0.43, 0.05);
  add(rbox(0.92, 0.06, 0.28, 0.02, oak), 0, 0.43, 0.82);
  add(rbox(0.58, 0.045, 1.92, 0.015, oak), 0, 0.405, 0.04);
  add(rbox(0.64, 0.045, 1.95, 0.015, oak), 0, 0.18, 0);
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.28, 7), oak), s * 0.36, 0.5, -0.08, PI / 2, s * 0.08, 0);
    add(rbox(0.15, 0.032, 0.56, 0.02, trimMat), s * 0.44, 0.5, -0.98, 0, s * 0.08, 0);
  }
  add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 12), rope), 0, 0.56, 1.34, PI / 2, 0, 0);

  finalize([]);
  return tagPaintColors(THREE, root, hullHex);
}

// ============================================================================
// Public Factory Export
// ============================================================================
export function buildBuildings(THREE) {
  const seahorseFountain = bindBuilder(THREE, buildSeahorseFountain);
  const harborKiosk = bindBuilder(THREE, buildHarborKiosk);
  const crimsonSeaplane = bindBuilder(THREE, buildCrimsonSeaplane);
  const woodenPier = bindBuilder(THREE, buildWoodenPier);
  const rowboat = bindBuilder(THREE, buildRowboat);

  return {
    sereno_hangar: bindBuilder(THREE, buildSerenoHangar),
    adriano_trattoria: bindBuilder(THREE, buildAdrianoTrattoria),
    harbor_lighthouse: bindBuilder(THREE, buildHarborLighthouse),
    coastal_gelateria: bindBuilder(THREE, buildCoastalGelateria),
    boathouse_loft: bindBuilder(THREE, buildBoathouseLoft),
    seahorseFountain,
    harborKiosk,
    crimsonSeaplane,
    woodenPier,
    rowboat,
    buildCenterpiece: seahorseFountain,
    buildStall: harborKiosk,
  };
}
