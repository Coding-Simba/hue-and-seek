/* Hue & Seek — Map 1 (bathhouse: Yu-Machi Spirit Bathhouse Quarter) Hideable Props + Tub Disguises.
 * 12 hand-modelled Storybook 3D props built 1:1 from assets/maps/bathhouse/props_sheet.png,
 * plus 2 interactive steaming-tub submerge disguises (buildFloatingBathDuck, buildCedarTubLid).
 * ALL materials strictly enforce metalness: 0 for warm, luminous Storybook shading without HDRI.
 * Origin at ground centre (y = 0), front facing +Z, <= 8 draw calls & <= 12k tris per prop.
 */
import {
  createPropBuilder,
  paintedCanvasTex,
  brushStrokes,
  gouacheGrainTex,
  kitTex,
  mergeGeometries,
} from '../map_kit.js?v=2';
import { attachCreatureKinematics, createMatCache } from '../world_interactives.js?v=v10';

const PI = Math.PI;
const TAU = PI * 2;

export const PROPS = [
  { id: 'bh_hinoki_tub', label: 'Hinoki Tub', icon: '🛁', radius: 0.55, height: 0.78, hp: 135, speed: 0.88 },
  { id: 'bh_paper_lantern', label: 'Spirit Lantern', icon: '🏮', radius: 0.34, height: 1.48, hp: 100, speed: 1.0 },
  { id: 'bh_stone_fox', label: 'Kitsune Statue', icon: '🦊', radius: 0.42, height: 1.05, hp: 100, speed: 1.0 },
  { id: 'bh_sake_cask', label: 'Sake Komodaru', icon: '🍶', radius: 0.46, height: 0.84, hp: 100, speed: 1.0 },
  { id: 'bh_steamer_stack', label: 'Bao Steamers', icon: '🥟', radius: 0.40, height: 0.76, hp: 75, speed: 1.12 },
  { id: 'bh_bonsai_pot', label: 'Pine Bonsai', icon: '🪴', radius: 0.44, height: 0.88, hp: 100, speed: 1.0 },
  { id: 'bh_tea_table', label: 'Lacquer Tea Table', icon: '🍵', radius: 0.54, height: 0.56, hp: 100, speed: 1.0 },
  { id: 'bh_daruma_doll', label: 'Daruma Doll', icon: '🎎', radius: 0.33, height: 0.72, hp: 75, speed: 1.12 },
  { id: 'bh_towel_basket', label: 'Onsen Basket', icon: '🧺', radius: 0.44, height: 0.70, hp: 75, speed: 1.12 },
  { id: 'bh_folding_screen', label: 'Gold Byobu Screen', icon: '🖼️', radius: 0.56, height: 1.32, hp: 135, speed: 0.88 },
  { id: 'bh_coal_scuttle', label: 'Boiler Coal Bucket', icon: '🪣', radius: 0.40, height: 0.68, hp: 75, speed: 1.12 },
  { id: 'bh_taiko_drum', label: 'Sacred Taiko', icon: '🥁', radius: 0.48, height: 1.08, hp: 135, speed: 0.88 },
  { id: 'bh_suds_sprite', label: 'Suds-Sprite', icon: '🫧', radius: 0.31, height: 0.62, hp: 155, _hpScaled: true, speed: 1.18, isAnimal: true, canFly: false },
  { id: 'bh_spirit_crane', label: 'Origami Spirit Crane', icon: '🪶', radius: 0.44, height: 0.96, hp: 165, _hpScaled: true, speed: 1.10, isAnimal: true, canFly: true, flyMaxY: 14.5, flapIntervalMs: 340, flapPitch: 1.18 },
];

export const PROP_ICONS = Object.fromEntries(PROPS.map((p) => [p.id, p.icon]));

// ----------------------------------------------------------------------------
// 2D Storybook Motif Canvas Helpers (Sakura, Seigaiha Waves, Onsen Mark)
// ----------------------------------------------------------------------------
function drawSakura(g, cx, cy, r, petalCol = '#d84538', centerCol = '#f7d56c', rot = 0, aspectY = 1) {
  g.save();
  g.translate(cx, cy);
  if (aspectY !== 1) g.scale(1, aspectY);
  g.rotate(rot);
  g.fillStyle = petalCol;
  for (let i = 0; i < 5; i++) {
    g.save();
    g.rotate((i * TAU) / 5);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-r * 0.54, -r * 0.38, -r * 0.50, -r * 0.96, -r * 0.14, -r);
    g.lineTo(0, -r * 0.78);
    g.lineTo(r * 0.14, -r);
    g.bezierCurveTo(r * 0.50, -r * 0.96, r * 0.54, -r * 0.38, 0, 0);
    g.fill();
    g.restore();
  }
  if (centerCol) {
    g.fillStyle = centerCol;
    g.beginPath();
    g.arc(0, 0, r * 0.20, 0, TAU);
    g.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5 - PI / 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
      g.strokeStyle = centerCol;
      g.lineWidth = Math.max(1, r * 0.065);
      g.stroke();
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.37, Math.sin(a) * r * 0.37, r * 0.065, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

function drawSeigaiha(g, x0, y0, w, h, R, bgCol, archCol, lineCol, rows = 3, aspectY = 1) {
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  if (bgCol) {
    g.fillStyle = bgCol;
    g.fillRect(x0, y0, w, h);
  }
  const dx = R * 1.88;
  const dy = R * 0.56 * aspectY;
  for (let row = 0; row < rows + 3; row++) {
    const cy = y0 + row * dy + R * 0.52 * aspectY;
    const shift = (row % 2) * (dx * 0.5);
    for (let cx = x0 - dx + shift; cx <= x0 + w + dx; cx += dx) {
      g.save();
      g.translate(cx, cy);
      if (aspectY !== 1) g.scale(1, aspectY);
      g.fillStyle = archCol;
      g.beginPath();
      g.arc(0, 0, R, PI, TAU);
      g.closePath();
      g.fill();
      g.strokeStyle = lineCol;
      g.lineWidth = Math.max(1.6, R * 0.115);
      for (const f of [0.94, 0.68, 0.42, 0.18]) {
        g.beginPath();
        g.arc(0, 0, R * f, PI * 1.03, TAU * 0.985);
        g.stroke();
      }
      g.restore();
    }
  }
  g.restore();
}

function drawOnsenMark(g, cx, cy, s, col = '#c93428', scaleX = 1) {
  g.save();
  g.translate(cx, cy);
  g.scale(scaleX, 1);
  g.strokeStyle = col;
  g.lineCap = 'round';
  g.lineWidth = s * 0.125;
  g.beginPath();
  g.ellipse(0, s * 0.24, s * 0.54, s * 0.27, 0, -0.18 * PI, 1.18 * PI);
  g.stroke();
  for (const [ox, hMul] of [[-0.23, 0.88], [0, 1.04], [0.23, 0.88]]) {
    const x = ox * s;
    const top = -s * 0.52 * hMul;
    const bot = s * 0.18;
    const mid = (top + bot) * 0.5;
    g.beginPath();
    g.moveTo(x, bot);
    g.bezierCurveTo(x - s * 0.16, bot - (bot - mid) * 0.5, x + s * 0.16, mid, x, top);
    g.stroke();
  }
  g.restore();
}

// Remap Box/RoundedBox UVs along local X & Y so draped towels display crisp wave borders on front & back
function mapTowelUV(geo, w, h) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) / w) + 0.5;
    const v = (pos.getY(i) / h) + 0.5;
    uv.setXY(i, Math.min(0.99, Math.max(0.01, u)), Math.min(0.99, Math.max(0.01, v)));
  }
  return geo;
}

// ----------------------------------------------------------------------------
// Custom Geometry Builders (Coal Lumps, Floating Sakura, Steam)
// ----------------------------------------------------------------------------
function makeCoalChunkGeo(THREE, r, rng) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = `${x.toFixed(4)}_${y.toFixed(4)}_${z.toFixed(4)}`;
    if (!map.has(k)) {
      map.set(k, [
        x * rng.jr(0.76, 1.24),
        y * rng.jr(0.72, 1.18),
        z * rng.jr(0.76, 1.24),
      ]);
    }
    const [nx, ny, nz] = map.get(k);
    p.setXYZ(i, nx, ny, nz);
  }
  g.computeVertexNormals();
  return g;
}

function makeMergedSteamGeo(THREE, puffs, ribbons = []) {
  const geos = puffs.map(([x, y, z, rx, ry, rz]) => {
    const s = new THREE.SphereGeometry(1, 9, 7);
    s.scale(rx, ry, rz);
    s.translate(x, y, z);
    return s;
  });
  for (const [pts, r] of ribbons) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    geos.push(new THREE.TubeGeometry(curve, 12, r, 6, false));
  }
  const out = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return out;
}

function makeSakuraBlossomGeo(THREE, r = 0.042) {
  const geos = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const pet = new THREE.SphereGeometry(1, 7, 5);
    pet.scale(r * 0.40, r * 0.16, r * 0.58);
    pet.translate(0, 0, r * 0.52);
    pet.rotateY(a);
    geos.push(pet);
  }
  const ctr = new THREE.SphereGeometry(r * 0.24, 6, 5);
  ctr.scale(1, 0.60, 1);
  ctr.translate(0, r * 0.06, 0);
  geos.push(ctr);
  const out = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return out;
}

function paintVertexColor(THREE, geo, hex, tipBoost = 0.16) {
  const g = geo.clone();
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const base = new THREE.Color(hex);
  const hi = base.clone().lerp(new THREE.Color(0xffffff), tipBoost);
  let maxR = 1e-4;
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
    if (d > maxR) maxR = d;
  }
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) / maxR;
    tmp.copy(base).lerp(hi, Math.max(0, (d - 0.68) / 0.32));
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

// Shared Bathhouse Prop Kit singleton per THREE instance
const _kitCache = new WeakMap();

function getBathPropKit(THREE) {
  if (_kitCache.has(THREE)) return _kitCache.get(THREE);

  const { mat, buildMergedProto, add, rbox, lathe, tube } = createPropBuilder(THREE, 101);
  const customMats = new Map();
  // Enforce metalness: 0 on EVERY custom material!
  const cMat = (key, hex, map, extra = {}) => {
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

  // Shared painted materials across the Bathhouse prop kit (100% metalness: 0!)
  const hinokiWood = mat('hinoki', 0xf3c68c, 'wood_light', 1.4, { roughness: 0.85 });
  const hinokiDark = mat('hinokiDark', 0xc89056, 'wood_light', 1.2, { roughness: 0.88 });
  const cedarDark = mat('cedarDark', 0x844d2e, 'wood_planks_dark', 1.3, { roughness: 0.84 });
  const rosewood = cMat('rosewood', 0x723d26, kitTex(THREE, 'wood_planks_dark', 1.4, 1.4), { roughness: 0.58 });

  // Warm luminous Storybook gold/brass (metalness: 0 so it never turns dark/black without HDRI!)
  const brass = cMat('brassStorybook', 0xf0bd48, gouacheGrainTex(THREE, 2.0, 2.0), {
    roughness: 0.42,
    metalness: 0,
    emissive: 0x7a4e0c,
    emissiveIntensity: 0.18,
  });
  const goldTrim = cMat('goldTrimStorybook', 0xf0bd48, null, {
    roughness: 0.42,
    metalness: 0,
    emissive: 0x7a4e0c,
    emissiveIntensity: 0.18,
  });

  // Warm weathered russet-charcoal iron (metalness: 0!)
  const ironPatinaTex = paintedCanvasTex(THREE, 'bh_iron_patina_v3', 256, (g, s, rng) => {
    g.fillStyle = '#d6c8be';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 280, ['#e8dad0', '#bca89b', '#cfb9a8', '#f2e6dc'], 3, 9, 0.36, 0, 3.14, 24);
    brushStrokes(g, s, rng, 110, ['#d9a889', '#b59786'], 2, 5, 0.25, 0.4, 2.5, 16);
  }, 2, 2);
  const castIronMat = cMat('tetsubinIronWarm', 0x6b5346, ironPatinaTex, {
    roughness: 0.62,
    metalness: 0,
  });
  const bucketIronMat = cMat('bucketIronWarm', 0x785d4c, ironPatinaTex, {
    roughness: 0.62,
    metalness: 0,
  });

  const crimsonSilk = mat('crimsonSilk', 0xd1382e, 'plaster', 1.2, { roughness: 0.85 });
  const sakuraPetalMat = cMat('sakuraPetalFloat', 0xffacc4, null, {
    roughness: 0.62,
    metalness: 0,
    emissive: 0x942e4d,
    emissiveIntensity: 0.22,
  });
  const steamMat = cMat('steamWisps', 0xfffcf6, null, {
    transparent: true,
    opacity: 0.42,
    roughness: 1.0,
    metalness: 0,
    emissive: 0xfff6e8,
    emissiveIntensity: 0.28,
    depthWrite: false,
  });

  // 1. Onsen Water Canvas Texture with shimmering turquoise ripples & floating pink 5-petal sakura
  const waterTex = paintedCanvasTex(THREE, 'bh_onsen_water_v4', 256, (g, s, rng) => {
    const grd = g.createRadialGradient(s * 0.5, s * 0.5, s * 0.05, s * 0.5, s * 0.5, s * 0.52);
    grd.addColorStop(0, '#82dce0');
    grd.addColorStop(0.58, '#55b6bf');
    grd.addColorStop(1, '#347c88');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 95, ['#9eedf0', '#64c6cf', '#bcf7f9'], 2, 5, 0.30, 0, 3.14, 28);
    g.strokeStyle = 'rgba(242,254,255,0.62)';
    g.lineWidth = 2.5;
    for (const rr of [0.15, 0.27, 0.39]) {
      g.beginPath();
      g.arc(s * 0.48, s * 0.48, s * rr, 0.15, PI * 1.65);
      g.stroke();
    }
    for (const [fx, fy, fr, rot] of [
      [0.33, 0.40, 18, 0.3], [0.58, 0.34, 16, 1.1], [0.44, 0.62, 19, 0.7],
      [0.25, 0.58, 14, 2.0], [0.66, 0.55, 15, 1.6], [0.48, 0.25, 13, 0.5],
    ]) {
      drawSakura(g, s * fx, s * fy, fr, '#ffb2c8', '#ffe88c', rot);
    }
  });
  const onsenWaterMat = cMat('onsenWater', 0xffffff, waterTex, {
    emissive: 0x2c7d8a,
    emissiveIntensity: 0.38,
    roughness: 0.20,
    metalness: 0,
  });

  // Cream towel with crisp indigo seigaiha wave border along lower half
  const creamWaveTowelTex = paintedCanvasTex(THREE, 'bh_cream_wave_towel_v4', 256, (g, s, rng) => {
    g.fillStyle = '#fdf4e2';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 200, ['#fffcf2', '#f2e4c8', '#f8ecd6'], 2, 4, 0.35, PI / 2, 0.4, 22);
    drawSeigaiha(g, 0, s * 0.46, s, s * 0.46, 32, '#fdf4e2', '#fdf4e2', '#2d4b82', 3);
    g.fillStyle = '#2d4b82';
    g.fillRect(0, s * 0.44, s, 5);
    g.fillRect(0, s * 0.92, s, 5);
  });
  const creamWaveTowelMat = cMat('creamWaveTowel', 0xffffff, creamWaveTowelTex, {
    roughness: 0.86,
    metalness: 0,
    emissive: 0x5c4a30,
    emissiveIntensity: 0.16,
  });

  // --------------------------------------------------------------------------
  // 1. bh_hinoki_tub — Coopered warm hinoki cedar tub, golden-brass hoops,
  //    steaming turquoise water, 3D floating pink sakura & cream seigaiha towel
  // --------------------------------------------------------------------------
  const buildHinokiTub = () => buildMergedProto('bh_hinoki_tub', (g) => {
    const sx = 1.05, sz = 0.93;
    const R0 = 0.425, R1 = 0.468, H = 0.64, footH = 0.068;
    for (const a of [0.65, PI - 0.65, PI + 0.65, -0.65]) {
      const fx = Math.cos(a) * (R0 - 0.05) * sx;
      const fz = Math.sin(a) * (R0 - 0.05) * sz;
      add(g, rbox(0.12, footH + 0.02, 0.135, 0.016, 1), hinokiDark, fx, (footH + 0.02) / 2, fz, 0, -a, 0);
    }
    add(g, new THREE.CylinderGeometry(R0 * 0.95, R0 * 0.95, 0.045, 20), hinokiDark, 0, footH + 0.03, 0, 0, 0, 0, sx, 1, sz);
    const innerLiner = lathe([[R1 * 0.99, H - 0.07], [R1 * 0.99, H - 0.02], [R1 * 0.895, H - 0.02], [R0 * 0.89, footH + 0.05]], 22);
    add(g, innerLiner, hinokiDark, 0, 0, 0, 0, 0, 0, sx, 1, sz);

    // 20 individual bevelled coopered hinoki cedar staves
    const nStaves = 20;
    for (let i = 0; i < nStaves; i++) {
      const th = (i / nStaves) * TAU;
      const rm = (R0 + R1) * 0.5;
      const cx = Math.sin(th) * rm * sx;
      const cz = Math.cos(th) * rm * sz;
      const ry = Math.atan2(Math.sin(th) / sx, Math.cos(th) / sz);
      const tilt = Math.atan2((R1 - R0), H - footH);
      const staveW = ((TAU * R1) / nStaves) * 0.97;
      const m = i % 3 === 0 ? hinokiDark : hinokiWood;
      add(g, rbox(staveW, H - footH, 0.048, 0.011, 1), m,
        cx, footH + (H - footH) * 0.5, cz,
        Math.cos(th) * tilt * 0.32, ry, -Math.sin(th) * tilt * 0.32);
    }
    const rimGeo = new THREE.TorusGeometry(R1 - 0.02, 0.030, 8, 26);
    rimGeo.rotateX(PI / 2);
    add(g, rimGeo, hinokiWood, 0, H, 0, 0, 0, 0, sx, 0.75, sz);

    // Two warm golden-brass riveted hoops
    const rivGeo = new THREE.SphereGeometry(0.014, 6, 5);
    for (const [hy, t] of [[0.205, 0.24], [0.435, 0.64]]) {
      const rh = R0 + (R1 - R0) * t + 0.025;
      add(g, new THREE.CylinderGeometry(rh + 0.004, rh, 0.054, 24, 1, true), brass, 0, hy, 0, 0, 0, 0, sx, 1, sz);
      for (const dy of [-0.025, 0.025]) {
        const edge = new THREE.TorusGeometry(rh + 0.002, 0.0065, 5, 24);
        edge.rotateX(PI / 2);
        add(g, edge, brass, 0, hy + dy, 0, 0, 0, 0, sx, 1, sz);
      }
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + (hy > 0.3 ? 0.12 : 0);
        add(g, rivGeo, brass, Math.sin(a) * (rh + 0.006) * sx, hy, Math.cos(a) * (rh + 0.006) * sz);
      }
    }

    // Steaming turquoise hot-spring water surface + 6 crisp 3D floating pink sakura blossoms
    const waterY = H - 0.062;
    add(g, new THREE.CylinderGeometry(R1 * 0.90, R1 * 0.90, 0.018, 24), onsenWaterMat, 0, waterY, 0, 0, 0, 0, sx, 1, sz);
    const sakGeo = makeSakuraBlossomGeo(THREE, 0.044);
    for (const [bx, bz, rot, sc] of [
      [-0.12, 0.07, 0.3, 1.08],
      [0.08, -0.09, 1.1, 1.02],
      [-0.02, 0.17, 0.8, 1.12],
      [-0.21, -0.07, 2.1, 0.96],
      [0.17, 0.04, 1.6, 0.98],
      [-0.08, -0.17, 0.5, 0.94],
    ]) {
      add(g, sakGeo, sakuraPetalMat, bx, waterY + 0.012, bz, 0, rot, 0, sc, sc, sc);
    }

    // Plush folded cream-and-indigo seigaiha wave towel draped over the front-right rim
    const ta = 0.28;
    const tx = Math.sin(ta) * (R1 - 0.01) * sx;
    const tz = Math.cos(ta) * (R1 - 0.01) * sz;
    const topFold = rbox(0.275, 0.074, 0.180, 0.026, 1);
    {
      const uv = topFold.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 0.64 + uv.getY(i) * 0.30);
    }
    add(g, topFold, creamWaveTowelMat, tx * 0.92, H + 0.032, tz * 0.92, 0.10, ta, 0);
    add(g, topFold.clone(), creamWaveTowelMat, tx * 0.78, H - 0.018, tz * 0.78, -0.52, ta, 0, 0.96, 0.9, 0.82);
    add(g, mapTowelUV(rbox(0.28, 0.31, 0.050, 0.020, 1), 0.28, 0.31), creamWaveTowelMat, tx * 1.07, H - 0.112, tz * 1.07, 0.08, ta, -0.03);
    add(g, mapTowelUV(rbox(0.265, 0.275, 0.044, 0.018, 1), 0.265, 0.275), creamWaveTowelMat, tx * 1.125, H - 0.092, tz * 1.125, 0.12, ta + 0.035, 0.025);

    // Gentle translucent rising steam wisps curling above the turquoise water
    const steamGeo = makeMergedSteamGeo(
      THREE,
      [
        [-0.10, 0.66, -0.03, 0.13, 0.070, 0.12],
        [0.06, 0.72, 0.03, 0.115, 0.072, 0.105],
        [-0.05, 0.80, -0.02, 0.100, 0.072, 0.094],
        [0.04, 0.88, 0.01, 0.084, 0.066, 0.082],
        [-0.03, 0.96, -0.01, 0.068, 0.058, 0.068],
      ],
      [
        [[[-0.09, 0.63, -0.02], [-0.14, 0.75, 0.02], [-0.05, 0.86, -0.02], [-0.09, 0.98, 0.01]], 0.034],
        [[[0.06, 0.64, 0.03], [0.11, 0.76, -0.01], [0.03, 0.89, 0.02]], 0.029],
      ]
    );
    add(g, steamGeo, steamMat);
  });

  // --------------------------------------------------------------------------
  // 2. bh_paper_lantern — Tall dark-cedar post stand, shingle mini-roof & glowing chochin
  // --------------------------------------------------------------------------
  const chochinTex = paintedCanvasTex(THREE, 'bh_chochin_amber_v3', 256, (g, s, rng) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#c83a24');
    grd.addColorStop(0.08, '#f6a234');
    grd.addColorStop(0.5, '#ffdc78');
    grd.addColorStop(0.92, '#f6a234');
    grd.addColorStop(1, '#c83a24');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 100, ['#ffe99c', '#f7b648', '#e88f28'], 2, 5, 0.25, 0, 0.4, 30);
    g.strokeStyle = 'rgba(165, 72, 18, 0.48)';
    g.lineWidth = 2.0;
    for (let i = 1; i < 12; i++) {
      const y = (i / 12) * s;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
    }
    g.fillStyle = '#c23022';
    g.fillRect(0, 0, s, s * 0.075);
    g.fillRect(0, s * 0.925, s, s * 0.075);
    for (const cx of [s * 0.25, s * 0.75]) {
      g.save();
      g.translate(cx, s * 0.50);
      g.scale(0.34, 1);
      g.fillStyle = 'rgba(255, 248, 212, 0.74)';
      g.beginPath();
      g.arc(0, 0, s * 0.29, 0, TAU);
      g.fill();
      g.restore();
      drawOnsenMark(g, cx, s * 0.51, s * 0.35, '#bf291d', 0.34);
    }
  });
  const chochinMat = cMat('chochinGlow', 0xffffff, chochinTex, {
    emissive: 0xff9422,
    emissiveIntensity: 0.86,
    roughness: 0.48,
    metalness: 0,
  });
  const roofShingleMat = mat('lanternRoof', 0x663d28, 'roof_tiles', 1.5, { roughness: 0.85 });

  const buildPaperLantern = () => buildMergedProto('bh_paper_lantern', (g) => {
    const px = 0.225;
    for (const sx of [-1, 1]) {
      const x = sx * px;
      add(g, rbox(0.098, 0.055, 0.42, 0.014, 1), cedarDark, x, 0.0275, 0);
      add(g, rbox(0.118, 0.045, 0.11, 0.010, 1), hinokiDark, x, 0.0225, 0.165);
      add(g, rbox(0.118, 0.045, 0.11, 0.010, 1), hinokiDark, x, 0.0225, -0.165);
      add(g, rbox(0.086, 0.06, 0.26, 0.012, 1), hinokiDark, x, 0.075, 0);
      add(g, rbox(0.066, 1.12, 0.066, 0.010, 1), cedarDark, x, 0.64, 0);
      add(g, rbox(0.084, 0.045, 0.084, 0.008, 1), hinokiDark, x, 0.12, 0);
      add(g, rbox(0.084, 0.05, 0.084, 0.008, 1), hinokiDark, x, 1.14, 0);
      add(g, rbox(0.098, 0.055, 0.054, 0.012, 1), hinokiDark, x - sx * 0.055, 1.12, 0, 0, 0, sx * 0.35);
    }
    add(g, rbox(px * 2 + 0.08, 0.046, 0.046, 0.008, 1), hinokiDark, 0, 0.145, 0);
    add(g, rbox(px * 2 + 0.18, 0.058, 0.068, 0.010, 1), cedarDark, 0, 1.185, 0);
    add(g, rbox(px * 2 + 0.22, 0.036, 0.28, 0.008, 1), hinokiDark, 0, 1.225, 0);

    const pitch = 0.48;
    for (const sx of [-1, 1]) {
      add(g, rbox(0.395, 0.044, 0.39, 0.010, 1), roofShingleMat, sx * 0.165, 1.325, 0, 0, 0, -sx * pitch);
      add(g, rbox(0.115, 0.038, 0.41, 0.008, 1), cedarDark, sx * 0.348, 1.25, 0, 0, 0, -sx * 0.14);
      for (const dz of [-0.12, 0, 0.12]) {
        add(g, rbox(0.375, 0.022, 0.036, 0.006, 1), cedarDark, sx * 0.165, 1.348, dz, 0, 0, -sx * pitch);
      }
      for (const sz of [-1, 1]) {
        add(g, rbox(0.385, 0.040, 0.028, 0.006, 1), hinokiDark, sx * 0.165, 1.315, sz * 0.186, 0, 0, -sx * pitch);
      }
    }
    add(g, rbox(0.24, 0.11, 0.34, 0.016, 1), cedarDark, 0, 1.30, 0);
    // Golden trefoil/sakura gable crest & ridge caps on front & back
    for (const sz of [-1, 1]) {
      for (const [ox, oy, or] of [[0, 1.335, 0.026], [-0.028, 1.312, 0.020], [0.028, 1.312, 0.020]]) {
        add(g, new THREE.SphereGeometry(or, 8, 6), goldTrim, ox, oy, sz * 0.182, 0, 0, 0, 1.1, 1.1, 0.45);
      }
      add(g, new THREE.CylinderGeometry(0.038, 0.042, 0.042, 10), goldTrim, 0, 1.448, sz * 0.198, PI / 2, 0, 0);
    }
    add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), roofShingleMat, 0, 1.442, 0, PI / 2, 0, 0);
    for (const dz of [-0.11, 0, 0.11]) {
      add(g, new THREE.TorusGeometry(0.038, 0.012, 5, 12), goldTrim, 0, 1.448, dz);
    }

    add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.14, 8), cedarDark, 0, 1.11, 0);
    add(g, new THREE.TorusGeometry(0.026, 0.007, 5, 12), goldTrim, 0, 1.035, 0);
    add(g, new THREE.CylinderGeometry(0.072, 0.098, 0.038, 16), cedarDark, 0, 0.995, 0);
    add(g, new THREE.CylinderGeometry(0.096, 0.068, 0.036, 16), cedarDark, 0, 0.585, 0);
    add(g, new THREE.TorusGeometry(0.090, 0.008, 5, 16), goldTrim, 0, 0.98, 0, PI / 2, 0, 0);
    add(g, new THREE.TorusGeometry(0.088, 0.008, 5, 16), goldTrim, 0, 0.60, 0, PI / 2, 0, 0);
    const lanternPts = [
      [0.078, 0.595], [0.148, 0.635], [0.188, 0.705], [0.200, 0.79],
      [0.188, 0.875], [0.148, 0.945], [0.078, 0.985],
    ];
    add(g, lathe(lanternPts, 22), chochinMat, 0, 0, 0, 0, PI * 0.5, 0);

    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), crimsonSilk, 0, 0.515, 0);
    add(g, new THREE.SphereGeometry(0.024, 8, 6), crimsonSilk, 0, 0.495, 0);
    for (const sx of [-1, 1]) {
      add(g, new THREE.TorusGeometry(0.024, 0.008, 5, 10), crimsonSilk, sx * 0.026, 0.495, 0);
    }
    add(g, new THREE.SphereGeometry(0.026, 8, 6), goldTrim, 0, 0.435, 0, 0, 0, 0, 1, 0.68, 1);
    add(g, lathe([[0, 0.30], [0.046, 0.30], [0.042, 0.33], [0.020, 0.435]], 12), crimsonSilk);
  });

  // --------------------------------------------------------------------------
  // 3. bh_stone_fox — Carved mossy grey-stone Inari kitsune statue with crimson sakura bib
  // --------------------------------------------------------------------------
  const foxStone = mat('foxStoneGrey', 0xbac8d6, 'stone', 1.5, { roughness: 0.93 });
  const foxStoneDark = mat('foxStoneDarkGrey', 0x7f8b96, 'stone', 1.6, { roughness: 0.95 });
  const mossGreen = mat('mossGreen', 0x779d42, 'leaves', 1.8, { roughness: 0.94 });
  const bibTex = paintedCanvasTex(THREE, 'bh_kitsune_bib_v3', 256, (g, s, rng) => {
    g.fillStyle = '#d43a2f';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 180, ['#e44d40', '#ba2c22', '#e86152'], 2, 5, 0.35, PI / 2, 0.6, 24);
    for (const [fx, fy, fr, rt] of [
      [0.32, 0.40, 19, 0.2], [0.68, 0.36, 16, 0.9], [0.50, 0.66, 21, 0.5],
      [0.23, 0.72, 14, 1.4], [0.77, 0.70, 15, 2.1],
    ]) {
      drawSakura(g, s * fx, s * fy, fr, '#fff6e4', '#f6cd62', rt);
    }
  });
  const kitsuneBibMat = cMat('kitsuneBib', 0xffffff, bibTex, { roughness: 0.88 });

  const buildStoneFox = () => buildMergedProto('bh_stone_fox', (g) => {
    add(g, new THREE.CylinderGeometry(0.35, 0.39, 0.11, 10), foxStoneDark, 0, 0.055, 0, 0, 0.2, 0, 1.06, 1, 0.94);
    add(g, new THREE.CylinderGeometry(0.29, 0.34, 0.10, 10), foxStone, 0, 0.145, 0.01, 0, 0.5, 0, 1.04, 1, 0.92);
    for (const [bx, by, bz, rx, ry, rz] of [
      [-0.25, 0.06, 0.16, 0.13, 0.06, 0.11],
      [0.26, 0.06, 0.14, 0.12, 0.06, 0.11],
      [-0.22, 0.07, -0.18, 0.14, 0.07, 0.12],
      [0.23, 0.065, -0.16, 0.13, 0.065, 0.12],
      [0.02, 0.06, 0.28, 0.14, 0.055, 0.09],
    ]) {
      add(g, rbox(rx * 2, ry * 2, rz * 2, 0.032, 1), foxStoneDark, bx, by, bz, 0.05, bx * 2, 0);
    }
    const sph = new THREE.SphereGeometry(1, 10, 8);
    for (const [mx, my, mz, sx, sy, sz] of [
      [-0.24, 0.11, 0.18, 0.105, 0.042, 0.085],
      [0.02, 0.19, 0.22, 0.098, 0.038, 0.078],
      [0.26, 0.10, 0.09, 0.095, 0.040, 0.082],
      [-0.27, 0.12, -0.10, 0.105, 0.044, 0.092],
      [0.18, 0.18, -0.18, 0.098, 0.038, 0.082],
      [-0.36, 0.035, 0.06, 0.088, 0.032, 0.065],
      [0.35, 0.035, -0.04, 0.082, 0.030, 0.060],
    ]) {
      add(g, sph, mossGreen, mx, my, mz, 0, 0, 0, sx, sy, sz);
    }
    // Small sprouting fern/grass tufts around plinth base (matching props_sheet!)
    const bladeGeo = new THREE.ConeGeometry(0.024, 0.11, 5);
    for (const [gx, gz, rz] of [
      [-0.37, 0.12, 0.55], [-0.34, 0.18, 0.35], [0.36, 0.10, -0.52],
      [0.33, 0.16, -0.32], [-0.28, -0.24, 0.45], [0.29, -0.22, -0.45],
    ]) {
      add(g, bladeGeo, mossGreen, gx, 0.05, gz, 0.15, gx * 2, rz);
    }

    add(g, sph, foxStone, 0, 0.34, -0.04, -0.22, 0, 0, 0.175, 0.165, 0.185);
    for (const sx of [-1, 1]) {
      add(g, sph, foxStone, sx * 0.135, 0.30, -0.03, 0.2, sx * 0.2, 0, 0.085, 0.115, 0.135);
      add(g, sph, foxStone, sx * 0.12, 0.215, 0.07, 0, sx * 0.15, 0, 0.058, 0.038, 0.075);
      add(g, new THREE.CylinderGeometry(0.042, 0.038, 0.27, 10), foxStone, sx * 0.068, 0.34, 0.125, -0.06, 0, -sx * 0.04);
      add(g, sph, foxStone, sx * 0.072, 0.215, 0.162, 0, 0, 0, 0.048, 0.036, 0.068);
    }
    add(g, sph, foxStone, 0, 0.50, 0.035, -0.28, 0, 0, 0.148, 0.175, 0.145);
    add(g, sph, foxStone, 0, 0.64, 0.065, -0.18, 0, 0, 0.11, 0.105, 0.105);
    add(g, sph, mossGreen, -0.135, 0.36, -0.03, 0, 0, 0.3, 0.072, 0.045, 0.082);
    add(g, sph, mossGreen, -0.09, 0.72, 0.02, 0, 0, 0.4, 0.060, 0.038, 0.060);

    const tailCurve = tube([
      [-0.01, 0.26, -0.14],
      [-0.08, 0.34, -0.26],
      [-0.10, 0.51, -0.29],
      [-0.06, 0.68, -0.23],
      [-0.02, 0.78, -0.18],
    ], 0.056, 16, 8);
    add(g, tailCurve, foxStone);
    add(g, sph, foxStone, -0.09, 0.47, -0.27, 0.25, 0.1, 0.12, 0.13, 0.20, 0.13);
    add(g, sph, foxStone, -0.05, 0.67, -0.225, -0.35, 0, 0.1, 0.095, 0.135, 0.095);
    add(g, new THREE.ConeGeometry(0.070, 0.155, 10), foxStone, -0.02, 0.785, -0.18, 0.35, 0, -0.18);
    add(g, sph, mossGreen, -0.13, 0.50, -0.28, 0.2, 0, 0.4, 0.088, 0.070, 0.088);

    add(g, sph, foxStone, 0, 0.775, 0.085, -0.18, 0, 0, 0.125, 0.112, 0.132);
    for (const sx of [-1, 1]) {
      add(g, sph, foxStone, sx * 0.105, 0.745, 0.095, 0, 0, -sx * 0.35, 0.055, 0.042, 0.065);
    }
    add(g, new THREE.ConeGeometry(0.072, 0.165, 12), foxStone, 0, 0.775, 0.195, PI / 2 - 0.16, 0, 0, 1.05, 1, 0.82);
    add(g, sph, foxStoneDark, 0, 0.80, 0.272, 0, 0, 0, 0.022, 0.018, 0.022);
    for (const sx of [-1, 1]) {
      const eyeArc = new THREE.TorusGeometry(0.026, 0.0055, 5, 10, PI * 0.85);
      add(g, eyeArc, foxStoneDark, sx * 0.066, 0.79, 0.182, -0.15, sx * 0.52, 0.1 * sx);
      add(g, new THREE.ConeGeometry(0.054, 0.18, 10), foxStone, sx * 0.072, 0.948, 0.055, 0.08, sx * 0.22, -sx * 0.12, 0.9, 1, 0.65);
      add(g, new THREE.ConeGeometry(0.030, 0.118, 8), kitsuneBibMat, sx * 0.072, 0.938, 0.075, 0.08, sx * 0.22, -sx * 0.12, 0.85, 1, 0.35);
    }

    const collarTor = new THREE.TorusGeometry(0.112, 0.022, 7, 18);
    collarTor.rotateX(PI / 2 + 0.22);
    add(g, collarTor, kitsuneBibMat, 0, 0.64, 0.06, 0, 0, 0, 1.02, 1, 1.05);
    const bibShape = new THREE.Shape();
    bibShape.moveTo(-0.115, 0.092);
    bibShape.quadraticCurveTo(0, 0.108, 0.115, 0.092);
    bibShape.quadraticCurveTo(0.15, -0.02, 0.12, -0.108);
    bibShape.quadraticCurveTo(0, -0.15, -0.12, -0.108);
    bibShape.quadraticCurveTo(-0.15, -0.02, -0.115, 0.092);
    const bibGeo = new THREE.ExtrudeGeometry(bibShape, {
      depth: 0.022, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 10,
    });
    {
      const uv = bibGeo.attributes.uv, pos = bibGeo.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (pos.getX(i) + 0.16) / 0.32, (pos.getY(i) + 0.16) / 0.32);
      }
    }
    add(g, bibGeo, kitsuneBibMat, 0, 0.535, 0.158, -0.28, 0, 0);
    add(g, sph, kitsuneBibMat, 0, 0.665, -0.055, 0, 0, 0, 0.032, 0.026, 0.026);
    for (const sx of [-1, 1]) {
      add(g, rbox(0.034, 0.095, 0.018, 0.006, 1), kitsuneBibMat, sx * 0.028, 0.615, -0.068, 0.25, 0, -sx * 0.28);
    }
  });

  // --------------------------------------------------------------------------
  // 4. bh_sake_cask — Straw-wrapped ceremonial sake komodaru with plump golden
  //    straw rope bindings, grand top bow-knot & vivid crimson sakura/seigaiha label
  // --------------------------------------------------------------------------
  const strawBarrelTex = paintedCanvasTex(THREE, 'bh_komo_straw_v3', 256, (g, s, rng) => {
    g.fillStyle = '#ead096';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 6) {
      g.fillStyle = rng.pick(['#f3dca6', '#dfbf7e', '#edd39a', '#d6b370']);
      g.fillRect(x, 0, 5, s);
    }
    brushStrokes(g, s, rng, 160, ['#fae6b4', '#cca562'], 1.2, 2.8, 0.28, PI / 2, 0.12, 28);
    g.fillStyle = 'rgba(154, 110, 52, 0.38)';
    for (const fy of [0.18, 0.50, 0.82]) g.fillRect(0, s * fy, s, 4);
  }, 3, 1);
  const strawBarrelMat = cMat('strawBarrel', 0xffffff, strawBarrelTex, { roughness: 0.92 });

  const ropeBraidTex = paintedCanvasTex(THREE, 'bh_rope_braid_v3', 128, (g, s) => {
    g.fillStyle = '#ebd092';
    g.fillRect(0, 0, s, s);
    for (let y = -s; y < s * 2; y += 22) {
      g.strokeStyle = '#f8e4af';
      g.lineWidth = 9;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + s * 0.65); g.stroke();
      g.strokeStyle = '#c49850';
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, y + 10); g.lineTo(s, y + 10 + s * 0.65); g.stroke();
    }
  }, 3, 2);
  const ropePlumpLight = cMat('ropePlumpLight', 0xeed28e, ropeBraidTex, { roughness: 0.86, emissive: 0x4a3410, emissiveIntensity: 0.10 });
  const ropePlumpWarm = cMat('ropePlumpWarm', 0xdab46a, ropeBraidTex, { roughness: 0.88, emissive: 0x3d2a0c, emissiveIntensity: 0.08 });

  const sakeLabelTex = paintedCanvasTex(THREE, 'bh_sake_label_v3', 256, (g, s, rng) => {
    g.fillStyle = '#fbf0da';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 6) {
      g.fillStyle = y % 12 === 0 ? 'rgba(222,198,156,0.34)' : 'rgba(255,248,232,0.30)';
      g.fillRect(0, y, s, 3);
    }
    brushStrokes(g, s, rng, 110, ['#fff8e8', '#ecdcc0'], 2, 4, 0.30, 0, 0.25, 22);
    g.strokeStyle = '#c9a062';
    g.lineWidth = 5;
    g.strokeRect(6, 6, s - 12, s - 12);
    drawSeigaiha(g, 10, s * 0.62, s - 20, s * 0.34, 34, null, '#fbf0da', '#d43b2e', 3);
    // Flanking olive-green leafy sprigs
    g.strokeStyle = '#628040';
    g.lineWidth = 3.5;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 0.5 + sx * 62, s * 0.56);
      g.quadraticCurveTo(s * 0.5 + sx * 86, s * 0.40, s * 0.5 + sx * 76, s * 0.22);
      g.stroke();
      g.fillStyle = '#678845';
      for (const [dx, dy, ang, len] of [[78, -32, 0.55, 21], [86, -6, 0.2, 23], [72, 20, -0.25, 20]]) {
        g.save();
        g.translate(s * 0.5 + sx * dx, s * 0.39 + dy);
        g.rotate(sx * ang);
        g.beginPath(); g.ellipse(0, 0, len, 7.5, 0, 0, TAU); g.fill();
        g.restore();
      }
    }
    // Bold central crimson 5-petal sakura blossom
    drawSakura(g, s * 0.5, s * 0.37, 54, '#d4382c', '#f8d878', 0);
  });
  const sakeLabelMat = cMat('sakeLabel', 0xffffff, sakeLabelTex, { roughness: 0.88 });

  const buildSakeCask = () => buildMergedProto('bh_sake_cask', (g) => {
    const barrelPts = [
      [0, 0.015], [0.365, 0.015], [0.402, 0.08], [0.424, 0.23], [0.432, 0.38],
      [0.424, 0.53], [0.402, 0.67], [0.365, 0.735], [0, 0.742],
    ];
    add(g, lathe(barrelPts, 26), strawBarrelMat);

    // Wide front (+Z) & back (-Z) woven ceremonial sakura/seigaiha labels
    const makeCurvedLabel = (rotY) => {
      const labelGeo = new THREE.PlaneGeometry(0.62, 0.50, 16, 10);
      const p = labelGeo.attributes.position;
      const rAt = (y) => 0.432 - 0.052 * (((y - 0.38) / 0.34) ** 2);
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), vy = p.getY(i) + 0.382;
        const th = u / 0.42;
        const rr = rAt(vy) + 0.008;
        p.setXYZ(i, Math.sin(th) * rr, vy, Math.cos(th) * rr);
      }
      labelGeo.computeVertexNormals();
      add(g, labelGeo, sakeLabelMat, 0, 0, 0, 0, rotY, 0);
    };
    makeCurvedLabel(0);
    makeCurvedLabel(PI);

    // Plump double braided straw rope coils around top & bottom rims
    for (const [ry, rr, tr, m] of [
      [0.042, 0.394, 0.039, ropePlumpWarm],
      [0.102, 0.415, 0.041, ropePlumpLight],
      [0.662, 0.416, 0.042, ropePlumpLight],
      [0.726, 0.396, 0.040, ropePlumpWarm],
    ]) {
      const tGeo = new THREE.TorusGeometry(rr, tr, 8, 26);
      tGeo.rotateX(PI / 2);
      add(g, tGeo, m, 0, ry, 0);
    }

    // Plump braided vertical/chevron side ropes framing the front & back labels cleanly!
    const rCurve = (y) => 0.438 - 0.048 * (((y - 0.38) / 0.34) ** 2);
    for (const sx of [-1, 1]) {
      // Framing vertical braided rope columns along label borders
      for (const aBase of [sx * 0.78, sx * (PI - 0.78)]) {
        const pts = [];
        for (let k = 0; k <= 5; k++) {
          const y = 0.09 + (k / 5) * 0.58;
          const rr = rCurve(y) + 0.008;
          pts.push([Math.sin(aBase) * rr, y, Math.cos(aBase) * rr]);
        }
        add(g, tube(pts, 0.030, 10, 7), ropePlumpLight);
      }
      // Plump braided chevron wraps along the left/right flanks
      for (const aMid of [sx * 1.18, sx * 1.57, sx * 1.96]) {
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const f = k / 6;
          const y = 0.09 + f * 0.58;
          const a = aMid + Math.sin(f * PI * 2) * 0.12;
          const rr = rCurve(y) + 0.008;
          pts.push([Math.sin(a) * rr, y, Math.cos(a) * rr]);
        }
        add(g, tube(pts, 0.028, 12, 6), ropePlumpWarm);
      }
    }

    // Plump radial straw-mat lid bindings + BIG ceremonial double-looped top bow-knot!
    for (let i = 0; i < 6; i++) {
      add(g, rbox(0.74, 0.052, 0.094, 0.022, 1), i % 2 === 0 ? ropePlumpLight : ropePlumpWarm, 0, 0.754, 0, 0, (i / 6) * PI, 0);
    }
    add(g, new THREE.SphereGeometry(0.080, 10, 8), ropePlumpWarm, 0, 0.822, 0, 0, 0, 0, 1.25, 0.92, 1.18);
    for (const sx of [-1, 1]) {
      add(g, tube([
        [0, 0.822, 0],
        [sx * 0.148, 0.888, 0.062],
        [sx * 0.272, 0.836, 0],
        [sx * 0.148, 0.792, -0.062],
        [0, 0.822, 0],
      ], 0.045, 16, 8, true), ropePlumpLight);
      add(g, tube([
        [sx * 0.04, 0.81, 0.035],
        [sx * 0.15, 0.785, 0.16],
        [sx * 0.24, 0.758, 0.27],
      ], 0.033, 8, 6), ropePlumpWarm);
    }
  });

  // --------------------------------------------------------------------------
  // 5. bh_steamer_stack — Three stacked bamboo bao steamers, tilted lid, plump buns & steam
  // --------------------------------------------------------------------------
  const steamerSideTex = paintedCanvasTex(THREE, 'bh_steamer_side_v3', 256, (g, s, rng) => {
    g.fillStyle = '#eab978';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 160, ['#f4ca8d', '#d6a15e', '#eebe7f'], 2, 4, 0.35, 0, 0.2, 34);
    for (const fx of [0.16, 0.52, 0.84]) {
      drawSakura(g, s * fx, s * 0.50, 25, '#cf4836', '#f6d478', fx * 2);
    }
  }, 2, 1);
  const steamerSideMat = cMat('steamerSide', 0xffffff, steamerSideTex, { roughness: 0.86 });

  const bambooWeaveTex = paintedCanvasTex(THREE, 'bh_bamboo_weave_v3', 256, (g, s) => {
    g.fillStyle = '#dfb26f';
    g.fillRect(0, 0, s, s);
    const step = 24;
    for (let y = -s; y < s * 2; y += step) {
      g.strokeStyle = '#f5cf92';
      g.lineWidth = 9;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + s); g.stroke();
      g.strokeStyle = '#c18f4e';
      g.lineWidth = 8;
      g.beginPath(); g.moveTo(0, y + step * 0.5); g.lineTo(s, y + step * 0.5 - s); g.stroke();
    }
  }, 2, 2);
  const bambooWeaveMat = cMat('bambooWeave', 0xffffff, bambooWeaveTex, { roughness: 0.88 });
  const bambooRimMat = mat('bambooRim', 0xca9352, 'wood_light', 1.4, { roughness: 0.85 });
  const baoDoughMat = cMat('baoDough', 0xfff9ed, gouacheGrainTex(THREE, 2, 2), { roughness: 0.68 });

  const buildSteamerStack = () => buildMergedProto('bh_steamer_stack', (g) => {
    const R = 0.315, tierH = 0.175;
    for (let t = 0; t < 3; t++) {
      const y0 = t * tierH;
      add(g, new THREE.CylinderGeometry(R - 0.012, R - 0.012, tierH - 0.02, 22), steamerSideMat, 0, y0 + tierH * 0.5, 0, 0, t * 0.25, 0);
      add(g, new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.042, 22, 1, true), bambooRimMat, 0, y0 + 0.025, 0);
      add(g, new THREE.CylinderGeometry(R + 0.010, R + 0.010, 0.044, 22, 1, true), bambooRimMat, 0, y0 + tierH - 0.022, 0);
      const rimTor = new THREE.TorusGeometry(R + 0.002, 0.014, 6, 22);
      rimTor.rotateX(PI / 2);
      add(g, rimTor, bambooRimMat, 0, y0 + tierH, 0);
      for (const dy of [0.055, 0.12]) {
        for (const rz of [-0.62, 0.62]) {
          add(g, rbox(0.052, 0.014, 0.015, 0.004, 1), cedarDark, -0.04, y0 + dy, R + 0.009, 0, -0.12, rz);
        }
      }
    }
    const topWall = lathe([[R + 0.008, 0.525], [R - 0.028, 0.525], [R - 0.028, 0.465]], 22);
    add(g, topWall, bambooRimMat);
    add(g, new THREE.CylinderGeometry(R - 0.026, R - 0.026, 0.018, 20), bambooWeaveMat, 0, 0.472, 0);

    // 4 plump snowy-white pleated baozi buns peeking proudly above the top steamer rim
    const baoGeo = lathe([
      [0, 0], [0.076, 0.004], [0.098, 0.034], [0.096, 0.072],
      [0.072, 0.102], [0.030, 0.120], [0.012, 0.130], [0, 0.122],
    ], 14);
    for (const [bx, bz, sc] of [
      [-0.065, 0.075, 1.05],
      [0.105, 0.055, 1.03],
      [0.025, -0.085, 1.06],
      [-0.115, -0.075, 0.98],
    ]) {
      add(g, baoGeo, baoDoughMat, bx, 0.478, bz, 0, bx * 4, 0, sc, sc, sc);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        add(g, rbox(0.014, 0.028, 0.050, 0.005, 1), baoDoughMat,
          bx + Math.sin(a) * 0.040 * sc, 0.574, bz + Math.cos(a) * 0.040 * sc,
          -0.55, a, 0);
      }
    }

    const lid = new THREE.Group();
    lid.position.set(-0.238, 0.575, 0.02);
    lid.rotation.set(0.14, 0.12, 0.88);
    g.add(lid);
    add(lid, new THREE.CylinderGeometry(R + 0.015, R + 0.015, 0.065, 22, 1, true), bambooRimMat, 0, 0, 0);
    for (const dy of [-0.028, 0.028]) {
      const lt = new THREE.TorusGeometry(R + 0.012, 0.012, 5, 22);
      lt.rotateX(PI / 2);
      add(lid, lt, bambooRimMat, 0, dy, 0);
    }
    add(lid, new THREE.ConeGeometry(R + 0.008, 0.105, 22), bambooWeaveMat, 0, 0.072, 0);
    add(lid, new THREE.TorusGeometry(0.044, 0.013, 6, 12, PI), bambooRimMat, 0, 0.118, 0);

    const steamGeo = makeMergedSteamGeo(
      THREE,
      [
        [0.04, 0.64, 0.01, 0.092, 0.058, 0.085],
        [0.09, 0.71, -0.02, 0.082, 0.062, 0.076],
        [0.03, 0.78, 0.01, 0.068, 0.055, 0.066],
        [0.06, 0.85, -0.01, 0.054, 0.046, 0.054],
      ],
      [[[[0.04, 0.62, 0.01], [0.09, 0.72, -0.01], [0.03, 0.83, 0.01]], 0.025]]
    );
    add(g, steamGeo, steamMat);
  });

  // --------------------------------------------------------------------------
  // 6. bh_bonsai_pot — Celadon pot painted with cream-white 5-petal sakura & twigs,
  //    carved rosewood stand & S-curved pine bonsai with sunlit olive-green pads
  // --------------------------------------------------------------------------
  const celadonPotTex = paintedCanvasTex(THREE, 'bh_celadon_pot_v4', 512, (g, s, rng) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#c2dec5');
    grd.addColorStop(0.52, '#9cc0a4');
    grd.addColorStop(1, '#71957d');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 190, ['#d2ebd4', '#86ac90', '#aed0b5'], 3, 7, 0.30, 0, 3.14, 34);
    // Flowing dark-brown flowering sakura branch wrapping seamlessly around the celadon belly
    g.strokeStyle = '#563926';
    g.lineCap = 'round';
    g.lineWidth = 7.5;
    g.beginPath();
    g.moveTo(0, s * 0.62);
    g.bezierCurveTo(s * 0.22, s * 0.48, s * 0.42, s * 0.68, s * 0.64, s * 0.44);
    g.bezierCurveTo(s * 0.80, s * 0.32, s * 0.90, s * 0.56, s, s * 0.62);
    g.stroke();
    g.lineWidth = 4.8;
    for (const [x0, y0, x1, y1] of [
      [0.14, 0.55, 0.08, 0.35],
      [0.32, 0.57, 0.40, 0.35],
      [0.54, 0.54, 0.47, 0.72],
      [0.68, 0.41, 0.76, 0.28],
      [0.84, 0.48, 0.92, 0.34],
    ]) {
      g.beginPath(); g.moveTo(s * x0, s * y0); g.lineTo(s * x1, s * y1); g.stroke();
    }
    // Delicate olive leaves & pink sakura buds along twigs
    g.fillStyle = '#628544';
    for (const [lx, ly, rot] of [
      [0.18, 0.58, 0.5], [0.37, 0.44, -0.4], [0.58, 0.52, 0.5],
      [0.72, 0.36, -0.5], [0.88, 0.46, 0.4],
    ]) {
      g.save(); g.translate(s * lx, s * ly); g.rotate(rot);
      g.beginPath(); g.ellipse(0, 0, 15, 6.5, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.fillStyle = '#f8b2c4';
    for (const [bx, by] of [[0.08, 0.35], [0.41, 0.34], [0.47, 0.72], [0.76, 0.27], [0.92, 0.33]]) {
      g.beginPath(); g.arc(s * bx, s * by, 9, 0, TAU); g.fill();
    }
    // 6 bold cream-white 5-petal sakura blossoms with golden centers wrapping all around the pot!
    for (const [fx, fy, fr, rot] of [
      [0.12, 0.50, 34, 0.2],
      [0.27, 0.53, 40, 0.7],
      [0.44, 0.49, 44, 0.3],
      [0.60, 0.46, 38, 1.1],
      [0.77, 0.45, 40, 1.6],
      [0.92, 0.54, 32, 0.5],
    ]) {
      drawSakura(g, s * fx, s * fy, fr, '#fffdf4', '#e8af42', rot, 1.65);
    }
  }, 1, 1);
  const celadonPotMat = cMat('celadonPot', 0xffffff, celadonPotTex, {
    roughness: 0.34,
    metalness: 0,
    emissive: 0x354d3c,
    emissiveIntensity: 0.16,
  });
  const pineBark = mat('pineBark', 0xa6764b, 'bark', 1.8, { roughness: 0.94 });

  // Feathery painterly pine-needle cluster textures with warm sunlit olive-green highlights (0x82b44e!)
  const pineNeedleTex = paintedCanvasTex(THREE, 'bh_pine_needles_v4', 256, (g, s, rng) => {
    g.fillStyle = '#68963e';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 480, ['#82b44e', '#a8d45c', '#456d26', '#92c052', '#c0e46e'], 2, 4.5, 0.65, -PI / 2, 2.5, 26);
  }, 2, 2);
  const pineDark = cMat('pineDarkTex', 0x4f7830, pineNeedleTex, { roughness: 0.88 });
  const pineMid = cMat('pineMidTex', 0x82b44e, pineNeedleTex, { roughness: 0.85 });
  const pineBright = cMat('pineBrightTex', 0xaad45c, pineNeedleTex, { roughness: 0.84 });

  const buildBonsaiPot = () => buildMergedProto('bh_bonsai_pot', (g) => {
    add(g, rbox(0.52, 0.032, 0.38, 0.010, 1), rosewood, 0, 0.088, 0);
    add(g, rbox(0.46, 0.028, 0.32, 0.008, 1), rosewood, 0, 0.065, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(g, rbox(0.068, 0.075, 0.068, 0.018, 1), rosewood, sx * 0.215, 0.038, sz * 0.145, sz * 0.08, 0, -sx * 0.08);
        add(g, rbox(0.082, 0.022, 0.082, 0.008, 1), rosewood, sx * 0.22, 0.011, sz * 0.15);
      }
      add(g, rbox(0.035, 0.025, 0.24, 0.006, 1), rosewood, sx * 0.21, 0.048, 0);
    }
    for (const sz of [-1, 1]) {
      add(g, rbox(0.36, 0.025, 0.035, 0.006, 1), rosewood, 0, 0.048, sz * 0.14);
    }

    const potPts = [
      [0, 0.112], [0.158, 0.112], [0.212, 0.146], [0.246, 0.208],
      [0.254, 0.260], [0.268, 0.280], [0.238, 0.288], [0.216, 0.266],
    ];
    // Rotate Y by PI*0.5 so u=0.45..0.50 (largest sakura cluster) faces squarely +Z!
    add(g, lathe(potPts, 24), celadonPotMat, 0, 0, 0, 0, PI * 0.5, 0, 1.20, 1, 0.88);
    for (const [fx, fz] of [[-0.14, 0.09], [0.14, 0.09], [-0.14, -0.09], [0.14, -0.09]]) {
      add(g, rbox(0.055, 0.024, 0.045, 0.008, 1), celadonPotMat, fx, 0.112, fz);
    }
    const sph = new THREE.SphereGeometry(1, 10, 7);
    add(g, sph, mossGreen, 0, 0.268, 0, 0, 0, 0, 0.25, 0.050, 0.185);

    for (const [rx, rz] of [[-0.08, 0.05], [0.09, 0.04], [0.02, -0.07], [-0.06, -0.05]]) {
      add(g, tube([[0, 0.31, 0], [rx * 0.7, 0.295, rz * 0.7], [rx * 1.45, 0.275, rz * 1.45]], 0.025, 6, 5), pineBark);
    }
    add(g, tube([
      [-0.02, 0.275, 0], [0.082, 0.365, 0.025], [0.112, 0.455, 0.01],
      [-0.048, 0.565, -0.02], [-0.078, 0.655, 0.005], [0.018, 0.778, 0.01],
    ], 0.046, 18, 7), pineBark);
    add(g, tube([
      [-0.02, 0.275, 0.01], [0.068, 0.35, 0.03], [0.088, 0.43, 0.015],
    ], 0.058, 8, 7), pineBark);

    const branches = [
      [[0.09, 0.44, 0.01], [0.21, 0.48, 0.04], [0.32, 0.535, 0.03]],
      [[-0.03, 0.54, -0.01], [-0.19, 0.53, 0.02], [-0.32, 0.545, 0.03]],
      [[-0.06, 0.63, 0], [-0.18, 0.68, -0.03], [-0.25, 0.715, -0.02]],
      [[-0.04, 0.66, 0], [0.11, 0.69, -0.04], [0.20, 0.72, -0.03]],
      [[-0.02, 0.72, 0.01], [0.02, 0.805, 0.01]],
    ];
    for (const pts of branches) add(g, tube(pts, 0.023, 8, 5), pineBark);

    const addPinePad = (cx, cy, cz, rx, ry, rz) => {
      add(g, sph, pineDark, cx, cy - ry * 0.20, cz, 0, 0, 0, rx * 1.08, ry * 0.66, rz * 1.08);
      add(g, sph, pineMid, cx, cy + ry * 0.06, cz, 0, 0, 0, rx * 0.98, ry * 0.68, rz * 0.98);
      add(g, sph, pineBright, cx - rx * 0.08, cy + ry * 0.30, cz + rz * 0.06, 0, 0, 0, rx * 0.82, ry * 0.62, rz * 0.82);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + cx * 3;
        add(g, sph, i % 2 === 0 ? pineBright : pineMid,
          cx + Math.cos(a) * rx * 0.58,
          cy + (i % 2 === 0 ? ry * 0.22 : -ry * 0.04),
          cz + Math.sin(a) * rz * 0.58,
          0, 0, 0, rx * 0.46, ry * 0.56, rz * 0.46);
      }
    };
    addPinePad(-0.32, 0.555, 0.03, 0.165, 0.050, 0.125);
    addPinePad(0.32, 0.555, 0.03, 0.155, 0.048, 0.120);
    addPinePad(-0.22, 0.725, -0.02, 0.145, 0.048, 0.115);
    addPinePad(0.19, 0.73, -0.03, 0.138, 0.046, 0.110);
    addPinePad(0.01, 0.83, 0.01, 0.185, 0.056, 0.148);
  });

  // --------------------------------------------------------------------------
  // 7. bh_tea_table — Vermilion chabudai table with gold sakura, russet-iron tetsubin & 2 teacups
  // --------------------------------------------------------------------------
  const vermilionTopTex = paintedCanvasTex(THREE, 'bh_chabudai_top_v3', 256, (g, s, rng) => {
    const grd = g.createRadialGradient(s * 0.45, s * 0.45, s * 0.05, s * 0.5, s * 0.5, s * 0.52);
    grd.addColorStop(0, '#dd3e2f');
    grd.addColorStop(0.78, '#c22b20');
    grd.addColorStop(1, '#941d14');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 120, ['#e85040', '#b2251b'], 2, 5, 0.22, 0, 3.14, 26);
    g.strokeStyle = '#f4cc60';
    g.lineWidth = 3.5;
    g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.44, 0, TAU); g.stroke();
    for (const [fx, fy, fr] of [
      [0.74, 0.64, 16], [0.80, 0.46, 12], [0.64, 0.78, 13],
      [0.24, 0.30, 15], [0.34, 0.20, 11], [0.22, 0.68, 12],
    ]) {
      drawSakura(g, s * fx, s * fy, fr, '#f7d066', '#fff4b6', fx * 4);
    }
  });
  const vermilionTopMat = cMat('vermilionTop', 0xffffff, vermilionTopTex, { roughness: 0.28 });
  const vermilionLegMat = cMat('vermilionLeg', 0xbd281d, null, { roughness: 0.32 });
  const teacupTex = paintedCanvasTex(THREE, 'bh_yunomi_cup_v3', 128, (g, s) => {
    g.fillStyle = '#f8eed8';
    g.fillRect(0, 0, s, s);
    drawSeigaiha(g, 0, s * 0.34, s, s * 0.46, 16, '#f8eed8', '#f8eed8', '#365686', 2);
    g.fillStyle = '#bc955c';
    g.fillRect(0, s * 0.85, s, s * 0.15);
  }, 2, 1);
  const teacupMat = cMat('teacupWave', 0xffffff, teacupTex, { roughness: 0.36 });
  const matchaMat = cMat('matchaTea', 0x86b048, null, { roughness: 0.22 });

  const buildTeaTable = () => buildMergedProto('bh_tea_table', (g) => {
    const TR = 0.50, topY = 0.265;
    add(g, new THREE.CylinderGeometry(TR - 0.012, TR - 0.018, 0.048, 32), vermilionLegMat, 0, topY, 0);
    add(g, new THREE.CylinderGeometry(TR - 0.015, TR - 0.015, 0.008, 32), vermilionTopMat, 0, topY + 0.024, 0);
    const rimTor = new THREE.TorusGeometry(TR - 0.012, 0.022, 8, 32);
    rimTor.rotateX(PI / 2);
    add(g, rimTor, vermilionLegMat, 0, topY, 0);
    const goldEdge = new THREE.TorusGeometry(TR + 0.007, 0.0055, 5, 32);
    goldEdge.rotateX(PI / 2);
    add(g, goldEdge, goldTrim, 0, topY + 0.006, 0);

    add(g, new THREE.CylinderGeometry(0.38, 0.37, 0.055, 24, 1, true), vermilionLegMat, 0, topY - 0.045, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI * 0.25;
      const lx = Math.sin(a) * 0.345, lz = Math.cos(a) * 0.345;
      add(g, rbox(0.068, 0.245, 0.068, 0.012, 1), vermilionLegMat, lx, 0.122, lz,
        -Math.cos(a) * 0.11, a, Math.sin(a) * 0.11);
      add(g, rbox(0.075, 0.026, 0.075, 0.006, 1), goldTrim,
        Math.sin(a) * 0.355, 0.044, Math.cos(a) * 0.355,
        -Math.cos(a) * 0.11, a, Math.sin(a) * 0.11);
      add(g, rbox(0.092, 0.044, 0.034, 0.008, 1), goldTrim,
        Math.sin(a) * 0.34, topY - 0.055, Math.cos(a) * 0.34, 0, a + PI / 2, 0);
    }

    // Russet-charcoal cast-iron Tetsubin kettle (metalness: 0!)
    const kx = 0.085, kz = -0.055, ky = topY + 0.025;
    const kettlePts = [
      [0, 0], [0.098, 0.002], [0.136, 0.036], [0.146, 0.084],
      [0.130, 0.130], [0.094, 0.158], [0.098, 0.168], [0.080, 0.168],
    ];
    add(g, lathe(kettlePts, 22), castIronMat, kx, ky, kz);
    const hobGeo = new THREE.SphereGeometry(0.009, 5, 4);
    for (const [hy, hr, n] of [[0.065, 0.142, 14], [0.096, 0.140, 14], [0.124, 0.128, 12]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hy * 8;
        add(g, hobGeo, castIronMat, kx + Math.sin(a) * hr, ky + hy, kz + Math.cos(a) * hr);
      }
    }
    add(g, new THREE.CylinderGeometry(0.080, 0.086, 0.020, 16), castIronMat, kx, ky + 0.170, kz);
    add(g, new THREE.SphereGeometry(0.019, 8, 6), goldTrim, kx, ky + 0.189, kz);
    add(g, tube([
      [kx - 0.108, ky + 0.086, kz + 0.03],
      [kx - 0.162, ky + 0.120, kz + 0.048],
      [kx - 0.190, ky + 0.165, kz + 0.058],
    ], 0.021, 8, 7), castIronMat);
    add(g, tube([
      [kx, ky + 0.158, kz - 0.098],
      [kx, ky + 0.258, kz - 0.068],
      [kx, ky + 0.276, kz],
      [kx, ky + 0.258, kz + 0.068],
      [kx, ky + 0.158, kz + 0.098],
    ], 0.013, 16, 6), castIronMat);
    add(g, tube([
      [kx, ky + 0.262, kz - 0.054],
      [kx, ky + 0.276, kz],
      [kx, ky + 0.262, kz + 0.054],
    ], 0.019, 8, 7), goldTrim);

    const cupGeo = lathe([
      [0, 0], [0.033, 0], [0.036, 0.012], [0.050, 0.046],
      [0.054, 0.094], [0.045, 0.094], [0.041, 0.070], [0, 0.070],
    ], 16);
    for (const [cx, cz] of [[-0.175, -0.01], [-0.075, 0.135]]) {
      add(g, cupGeo, teacupMat, cx, ky, cz, 0, cx * 5, 0);
      add(g, new THREE.CylinderGeometry(0.044, 0.044, 0.008, 14), matchaMat, cx, ky + 0.076, cz);
    }
  });

  // --------------------------------------------------------------------------
  // 8. bh_daruma_doll — Plump crimson Daruma doll with sculpted face, brows & gold sakura crest
  // --------------------------------------------------------------------------
  const darumaBodyTex = paintedCanvasTex(THREE, 'bh_daruma_red_v3', 256, (g, s, rng) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#df3f2e');
    grd.addColorStop(0.65, '#c62b1e');
    grd.addColorStop(1, '#921d14');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 180, ['#ea5240', '#b12418', '#d63728'], 2, 5, 0.32, 0, 3.14, 24);
    for (const [fx, fy, fr] of [[0.18, 0.45, 15], [0.82, 0.45, 15], [0.50, 0.30, 17]]) {
      drawSakura(g, s * fx, s * fy, fr, '#f0bf4c', '#fff2aa', fx * 3);
    }
  });
  const darumaRedMat = cMat('darumaRed', 0xffffff, darumaBodyTex, { roughness: 0.48 });
  const darumaCreamMat = mat('darumaCream', 0xfcf2dc, 'plaster', 1.2, { roughness: 0.85 });
  const darumaInkMat = cMat('darumaInk', 0x261d1a, null, { roughness: 0.72 });

  const buildDarumaDoll = () => buildMergedProto('bh_daruma_doll', (g) => {
    const sx = 1.06, sz = 0.96;
    const pts = [
      [0, 0.0], [0.21, 0.005], [0.30, 0.06], [0.352, 0.16], [0.368, 0.28],
      [0.356, 0.40], [0.322, 0.52], [0.258, 0.62], [0.16, 0.69], [0, 0.72],
    ];
    const rBody = (y) => {
      for (let i = 1; i < pts.length; i++) {
        if (y <= pts[i][1]) {
          const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
          return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-5, y1 - y0);
        }
      }
      return 0;
    };
    add(g, lathe(pts, 28), darumaRedMat, 0, 0, 0, 0, PI, 0, sx, 1, sz);

    const sph = new THREE.SphereGeometry(1, 16, 12);
    add(g, sph, darumaCreamMat, 0, 0.49, 0.255, -0.18, 0, 0, 0.235, 0.145, 0.095);
    add(g, tube([
      [-0.235, 0.43, 0.265], [-0.22, 0.555, 0.255], [-0.10, 0.625, 0.235],
      [0, 0.608, 0.252], [0.10, 0.625, 0.235], [0.22, 0.555, 0.255], [0.235, 0.43, 0.265],
    ], 0.022, 20, 7), darumaRedMat);
    add(g, tube([
      [-0.205, 0.45, 0.29], [-0.185, 0.545, 0.282], [0, 0.588, 0.282],
      [0.185, 0.545, 0.282], [0.205, 0.45, 0.29],
    ], 0.0085, 16, 5), goldTrim);

    for (const s of [-1, 1]) {
      const ex = s * 0.095, ey = 0.495, ez = 0.332;
      add(g, sph, goldTrim, ex, ey, ez - 0.006, -0.18, s * 0.25, 0, 0.056, 0.056, 0.022);
      add(g, sph, darumaCreamMat, ex, ey, ez, -0.18, s * 0.25, 0, 0.048, 0.048, 0.022);
      add(g, sph, darumaInkMat, ex - s * 0.005, ey, ez + 0.012, -0.18, s * 0.25, 0, 0.030, 0.032, 0.018);
      add(g, sph, darumaCreamMat, ex + s * 0.008, ey + 0.012, ez + 0.024, 0, 0, 0, 0.009, 0.009, 0.008);
      add(g, tube([
        [s * 0.022, 0.535, 0.342], [s * 0.088, 0.568, 0.328],
        [s * 0.168, 0.548, 0.296], [s * 0.195, 0.515, 0.278],
      ], 0.016, 10, 6), darumaInkMat);
      add(g, tube([
        [s * 0.198, 0.468, 0.282], [s * 0.175, 0.415, 0.315],
        [s * 0.115, 0.405, 0.344], [s * 0.072, 0.422, 0.352],
      ], 0.015, 10, 6), darumaInkMat);
    }
    add(g, sph, darumaRedMat, 0, 0.455, 0.352, 0, 0, 0, 0.024, 0.018, 0.018);
    add(g, tube([
      [-0.078, 0.382, 0.344], [-0.038, 0.408, 0.355], [0, 0.415, 0.358],
      [0.038, 0.408, 0.355], [0.078, 0.382, 0.344],
    ], 0.010, 10, 5), darumaRedMat);

    for (const az of [-0.72, -0.46, -0.24, 0.24, 0.46, 0.72]) {
      const sPts = [];
      const yTop = Math.abs(az) > 0.5 ? 0.31 : 0.29;
      for (let k = 0; k <= 5; k++) {
        const y = 0.09 + (k / 5) * (yTop - 0.09);
        const rr = rBody(y) + 0.008;
        sPts.push([Math.sin(az) * rr * sx, y, Math.cos(az) * rr * sz]);
      }
      add(g, tube(sPts, 0.017, 8, 5), goldTrim);
    }
    const by = 0.215, bz = (rBody(by) + 0.012) * sz;
    add(g, sph, goldTrim, 0, by, bz + 0.006, 0, 0, 0, 0.024, 0.024, 0.012);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      add(g, sph, goldTrim, Math.sin(a) * 0.050, by + Math.cos(a) * 0.050, bz, 0, 0, -a, 0.028, 0.044, 0.010);
    }
  });

  // --------------------------------------------------------------------------
  // 9. bh_towel_basket — Woven rattan bathhouse basket overflowing with white & indigo wave towels
  // --------------------------------------------------------------------------
  const rattanWeaveTex = paintedCanvasTex(THREE, 'bh_rattan_basket_v3', 256, (g, s) => {
    g.fillStyle = '#4a311c';
    g.fillRect(0, 0, s, s);
    const step = 32;
    for (let y = -s; y < s * 2; y += step) {
      g.strokeStyle = '#dca762';
      g.lineWidth = 11;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + s); g.stroke();
      g.strokeStyle = '#c88f49';
      g.lineWidth = 11;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y - s); g.stroke();
    }
    g.fillStyle = '#e8b976';
    for (const fy of [0.06, 0.50, 0.92]) g.fillRect(0, s * fy, s, 9);
  }, 3, 2);
  const rattanWeaveMat = cMat('rattanWeave', 0xffffff, rattanWeaveTex, { roughness: 0.88 });
  const rattanRibMat = mat('rattanRib', 0xdaa35d, 'wood_light', 1.5, { roughness: 0.85 });

  const creamRollTex = paintedCanvasTex(THREE, 'bh_cream_roll_v3', 256, (g, s, rng) => {
    g.fillStyle = '#faf0dd';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 240, ['#fffaf0', '#ebdcc0', '#f3e6cc'], 2, 4, 0.4, 0, 3.14, 18);
    g.strokeStyle = 'rgba(182, 156, 122, 0.55)';
    g.lineWidth = 4;
    g.beginPath();
    for (let a = 0; a < TAU * 2.6; a += 0.12) {
      const rr = (a / (TAU * 2.6)) * s * 0.42;
      const x = s * 0.5 + Math.cos(a) * rr, y = s * 0.5 + Math.sin(a) * rr;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  });
  const creamRollMat = cMat('creamRoll', 0xffffff, creamRollTex, { roughness: 0.94 });

  const indigoTowelTex = paintedCanvasTex(THREE, 'bh_indigo_wave_towel_v3', 256, (g, s, rng) => {
    g.fillStyle = '#3d5288';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 220, ['#4f66a2', '#314270', '#5870ad'], 2, 4, 0.35, 0, 3.14, 20);
    drawSeigaiha(g, 0, s * 0.48, s, s * 0.44, 30, '#3d5288', '#3d5288', '#faf0dd', 3);
    g.fillStyle = '#faf0dd';
    g.fillRect(0, s * 0.46, s, 4);
    g.fillRect(0, s * 0.92, s, 4);
  });
  const indigoTowelMat = cMat('indigoTowel', 0xffffff, indigoTowelTex, { roughness: 0.94 });

  const buildTowelBasket = () => buildMergedProto('bh_towel_basket', (g) => {
    const rb = 0.27, rt = 0.365, H = 0.42;
    add(g, new THREE.CylinderGeometry(rt, rb, H, 24), rattanWeaveMat, 0, H * 0.5 + 0.015, 0);
    for (const [hy, hr, tr] of [[0.028, rb + 0.008, 0.026], [0.22, (rb + rt) * 0.5 + 0.008, 0.016], [H + 0.015, rt + 0.012, 0.028]]) {
      const hoop = new THREE.TorusGeometry(hr, tr, 7, 26);
      hoop.rotateX(PI / 2);
      add(g, hoop, rattanRibMat, 0, hy, 0);
    }
    for (let i = 0; i < 14; i++) {
      const a0 = (i / 14) * TAU;
      for (const dir of [-0.36, 0.36]) {
        const pts = [];
        for (let k = 0; k <= 4; k++) {
          const f = k / 4;
          const y = 0.035 + f * (H - 0.02);
          const rr = rb + (rt - rb) * f + 0.008;
          const a = a0 + dir * (f - 0.5) * 2;
          pts.push([Math.sin(a) * rr, y, Math.cos(a) * rr]);
        }
        add(g, tube(pts, 0.010, 7, 5), rattanRibMat);
      }
    }
    for (const sx of [-1, 1]) {
      add(g, tube([
        [sx * (rt - 0.01), H + 0.01, -0.095],
        [sx * (rt + 0.035), H + 0.13, -0.06],
        [sx * (rt + 0.042), H + 0.165, 0],
        [sx * (rt + 0.035), H + 0.13, 0.06],
        [sx * (rt - 0.01), H + 0.01, 0.095],
      ], 0.022, 12, 6), rattanRibMat);
    }

    const makeRoll = (r, len) => {
      const c = new THREE.CylinderGeometry(r, r * 0.96, len, 16);
      c.rotateX(PI / 2);
      return c;
    };
    add(g, makeRoll(0.104, 0.34), creamRollMat, -0.115, 0.548, -0.02, -0.32, 0.38, 0.08);
    add(g, new THREE.SphereGeometry(0.102, 12, 9), creamRollMat, -0.18, 0.598, -0.15, 0, 0, 0, 1, 0.92, 1);
    add(g, makeRoll(0.090, 0.28), creamRollMat, -0.01, 0.498, 0.06, -0.28, 0.28, 0);
    const topIndigo = makeRoll(0.10, 0.32);
    {
      const uv = topIndigo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 0.62 + uv.getY(i) * 0.32);
    }
    add(g, topIndigo, indigoTowelMat, 0.135, 0.518, -0.02, -0.25, -0.32, -0.1);
    const da = 0.38;
    const dx = Math.sin(da) * (rt + 0.005), dz = Math.cos(da) * (rt + 0.005);
    const indigoSaddle = rbox(0.22, 0.068, 0.17, 0.024, 1);
    {
      const uv = indigoSaddle.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 0.62 + uv.getY(i) * 0.32);
    }
    add(g, indigoSaddle, indigoTowelMat, dx * 0.86, H + 0.052, dz * 0.86, 0.14, da, 0);
    add(g, mapTowelUV(rbox(0.225, 0.29, 0.046, 0.018, 1), 0.225, 0.29), indigoTowelMat, dx * 1.06, H - 0.105, dz * 1.06, 0.16, da, -0.04);
    add(g, mapTowelUV(rbox(0.21, 0.25, 0.040, 0.016, 1), 0.21, 0.25), indigoTowelMat, dx * 1.11, H - 0.085, dz * 1.11, 0.19, da + 0.04, 0.03);
  });

  // --------------------------------------------------------------------------
  // 10. bh_folding_screen — V-angled two-panel gold-leaf Byobu screen (metalness: 0!)
  // --------------------------------------------------------------------------
  const BYOBU_AY = 0.42;
  function paintGoldFoilBg(g, s, rng) {
    g.fillStyle = '#ecc058';
    g.fillRect(0, 0, s, s);
    const cols = 3, rows = 7;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = rng.pick(['#f5cd6d', '#e5b850', '#f9d77e', '#dead46']);
        g.fillRect((c * s) / cols, (r * s) / rows, s / cols + 1, s / rows + 1);
      }
    }
    brushStrokes(g, s, rng, 160, ['#fbe08c', '#d5a43e', '#fff0ab'], 3, 7, 0.25, 0, 3.14, 34);
    g.fillStyle = 'rgba(255, 244, 190, 0.65)';
    for (const [cx, cy, cw, ch] of [[0.28, 0.72, 105, 14], [0.72, 0.30, 98, 13], [0.64, 0.68, 92, 12]]) {
      g.beginPath(); g.ellipse(s * cx, s * cy, cw, ch, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(s * cx - cw * 0.32, s * cy - ch * 0.55, cw * 0.55, ch * 0.85, 0, 0, TAU); g.fill();
    }
    drawSeigaiha(g, 0, s * 0.83, s, s * 0.17, 56, null, '#385688', '#f6d06a', 3, BYOBU_AY);
  }

  const byobuLeftTex = paintedCanvasTex(THREE, 'bh_byobu_left_v3', 512, (g, s, rng) => {
    paintGoldFoilBg(g, s, rng);
    g.strokeStyle = '#5d3a22';
    g.lineCap = 'round';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(s * 0.22, s * 0.84);
    g.bezierCurveTo(s * 0.54, s * 0.72, s * 0.18, s * 0.56, s * 0.48, s * 0.48);
    g.stroke();
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(s * 0.36, s * 0.63);
    g.quadraticCurveTo(s * 0.62, s * 0.64, s * 0.78, s * 0.67);
    g.stroke();
    for (const [px, py, pw, ph] of [
      [0.46, 0.47, 112, 22], [0.26, 0.57, 92, 18], [0.72, 0.66, 98, 19], [0.54, 0.55, 84, 16],
    ]) {
      g.fillStyle = '#385f36';
      g.beginPath(); g.ellipse(s * px, s * py + 4, pw, ph, 0, 0, TAU); g.fill();
      g.fillStyle = '#689b4e';
      g.beginPath(); g.ellipse(s * px, s * py - 3, pw * 0.88, ph * 0.82, 0, 0, TAU); g.fill();
    }
    g.strokeStyle = '#5b3624';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(0, s * 0.27);
    g.quadraticCurveTo(s * 0.38, s * 0.17, s * 0.78, s * 0.11);
    g.stroke();
    for (const [fx, fy, fr] of [
      [0.18, 0.22, 34], [0.36, 0.16, 38], [0.55, 0.14, 32], [0.72, 0.11, 28], [0.28, 0.28, 26],
    ]) {
      drawSakura(g, s * fx, s * fy, fr, '#ffd4df', '#e65a73', fx * 3, BYOBU_AY);
    }
  });

  const byobuRightTex = paintedCanvasTex(THREE, 'bh_byobu_right_v3', 512, (g, s, rng) => {
    paintGoldFoilBg(g, s, rng);
    g.save();
    g.translate(s * 0.50, s * 0.43);
    g.scale(1, BYOBU_AY);
    g.rotate(-0.28);
    g.strokeStyle = '#2d2622';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(28, 28); g.lineTo(132, 92);
    g.moveTo(22, 38); g.lineTo(122, 108);
    g.stroke();
    for (const wy of [-1, 1]) {
      g.fillStyle = '#26211e';
      g.beginPath(); g.ellipse(14, wy * 82, 52, 96, wy * 0.42, 0, TAU); g.fill();
      g.fillStyle = '#fffaf0';
      g.beginPath(); g.ellipse(-6, wy * 74, 48, 94, wy * 0.38, 0, TAU); g.fill();
    }
    g.fillStyle = '#fffaf0';
    g.beginPath(); g.ellipse(10, 14, 60, 30, 0.3, 0, TAU); g.fill();
    g.strokeStyle = '#26211e';
    g.lineWidth = 17;
    g.beginPath(); g.moveTo(-34, -2); g.quadraticCurveTo(-84, -30, -106, -70); g.stroke();
    g.strokeStyle = '#fffaf0';
    g.lineWidth = 11;
    g.beginPath(); g.moveTo(-30, 2); g.quadraticCurveTo(-70, -20, -106, -70); g.stroke();
    g.fillStyle = '#fffaf0';
    g.beginPath(); g.arc(-110, -76, 15, 0, TAU); g.fill();
    g.fillStyle = '#d43328';
    g.beginPath(); g.arc(-110, -83, 9, PI * 0.9, TAU * 1.05); g.fill();
    g.fillStyle = '#c89b3c';
    g.beginPath(); g.moveTo(-122, -78); g.lineTo(-162, -86); g.lineTo(-120, -69); g.closePath(); g.fill();
    g.restore();
  });

  // Strict metalness: 0 + warm golden sheen on Byobu panels!
  const byobuLeftMat = cMat('byobuLeftWarm', 0xffffff, byobuLeftTex, {
    roughness: 0.44,
    metalness: 0,
    emissive: 0x5c3c08,
    emissiveIntensity: 0.12,
  });
  const byobuRightMat = cMat('byobuRightWarm', 0xffffff, byobuRightTex, {
    roughness: 0.44,
    metalness: 0,
    emissive: 0x5c3c08,
    emissiveIntensity: 0.12,
  });
  const screenFrameMat = cMat('screenFrameWarm', 0x6b3d24, kitTex(THREE, 'wood_planks_dark', 1.5, 1.5), { roughness: 0.56 });

  const buildFoldingScreen = () => buildMergedProto('bh_folding_screen', (g) => {
    const W = 0.54, H = 1.32, st = 0.040, th = 0.042;
    const ang = 0.24;
    const buildPanel = (side, artMat) => {
      const p = new THREE.Group();
      p.position.set(0, 0, -0.065);
      p.rotation.y = -side * ang;
      g.add(p);
      const cx = side * (W * 0.5);
      add(p, rbox(st, H, th, 0.007, 1), screenFrameMat, cx - side * (W * 0.5 - st * 0.5), H * 0.5, 0);
      add(p, rbox(st, H, th, 0.007, 1), screenFrameMat, cx + side * (W * 0.5 - st * 0.5), H * 0.5, 0);
      add(p, rbox(W, st, th, 0.007, 1), screenFrameMat, cx, H - st * 0.5, 0);
      add(p, rbox(W, st * 1.15, th, 0.007, 1), screenFrameMat, cx, st * 0.575, 0);
      add(p, rbox(W - st * 1.8, H - st * 2, th * 0.55, 0.004, 1), screenFrameMat, cx, H * 0.5, -0.003);
      add(p, new THREE.PlaneGeometry(W - st * 1.9, H - st * 2.15), artMat, cx, H * 0.5, th * 0.28 + 0.003);

      for (const sy of [-1, 1]) {
        const ky = sy > 0 ? H - 0.042 : 0.045;
        const ox = cx + side * (W * 0.5 - 0.042);
        add(p, rbox(0.086, 0.086, th + 0.010, 0.006, 1), goldTrim, ox, ky, 0);
        add(p, new THREE.SphereGeometry(0.009, 6, 4), goldTrim, ox, ky, th * 0.5 + 0.006);
      }
      add(p, rbox(0.046, 0.075, th + 0.009, 0.005, 1), goldTrim, cx + side * (W * 0.5 - 0.023), H * 0.5, 0);
    };
    buildPanel(-1, byobuLeftMat);
    buildPanel(1, byobuRightMat);
    for (const hy of [0.18, 0.66, 1.14]) {
      add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.085, 8), goldTrim, 0, hy, -0.065);
    }
  });

  // --------------------------------------------------------------------------
  // 11. bh_coal_scuttle — Warm russet-iron boiler bucket, gold sakura crest,
  //     faceted coals, glowing embers & pale binchotan ash chips!
  // --------------------------------------------------------------------------
  const coalDarkMat = mat('coalDark3', 0x4b4652, 'stone', 2.2, { roughness: 0.90 });
  const emberGlowMat = cMat('emberGlow', 0xffa84c, null, {
    emissive: 0xff5e14,
    emissiveIntensity: 1.75,
    roughness: 0.48,
    metalness: 0,
  });
  const ashVertexMat = cMat('ashVertex', 0xffffff, null, {
    vertexColors: true,
    roughness: 0.86,
    metalness: 0,
  });

  const buildCoalScuttle = () => buildMergedProto('bh_coal_scuttle', (g, rng) => {
    const rb = 0.245, rt = 0.308, H = 0.405;
    const shellPts = [
      [0, 0.005], [rb - 0.01, 0.005], [rb, 0.03], [rt, H],
      [rt + 0.016, H + 0.008], [rt - 0.018, H + 0.008], [rt - 0.024, H - 0.04],
    ];
    add(g, lathe(shellPts, 26), bucketIronMat);
    const topRim = new THREE.TorusGeometry(rt + 0.004, 0.019, 7, 26);
    topRim.rotateX(PI / 2);
    add(g, topRim, bucketIronMat, 0, H, 0);
    const botRim = new THREE.TorusGeometry(rb + 0.004, 0.015, 6, 24);
    botRim.rotateX(PI / 2);
    add(g, botRim, bucketIronMat, 0, 0.022, 0);

    const riv = new THREE.SphereGeometry(0.013, 6, 5);
    for (const [sy, f] of [[0.115, 0.28], [0.305, 0.75]]) {
      const sr = rb + (rt - rb) * f + 0.007;
      add(g, new THREE.CylinderGeometry(sr + 0.004, sr, 0.044, 26, 1, true), bucketIronMat, 0, sy, 0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + f;
        add(g, riv, bucketIronMat, Math.sin(a) * (sr + 0.006), sy, Math.cos(a) * (sr + 0.006));
      }
    }

    // Crisp golden 5-petal sakura blossom crest on front center
    const ez = (rb + (rt - rb) * 0.52) + 0.011, ey = 0.212;
    add(g, new THREE.SphereGeometry(0.014, 7, 5), goldTrim, 0, ey, ez + 0.005);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      add(g, new THREE.SphereGeometry(1, 7, 5), goldTrim,
        Math.sin(a) * 0.034, ey + Math.cos(a) * 0.034, ez,
        0, 0, -a, 0.018, 0.030, 0.009);
    }

    for (const sx of [-1, 1]) {
      const lx = sx * (rb + (rt - rb) * 0.65 + 0.012);
      add(g, rbox(0.034, 0.070, 0.054, 0.008, 1), bucketIronMat, lx, 0.27, 0);
      const dropRing = new THREE.TorusGeometry(0.046, 0.012, 6, 14);
      dropRing.rotateY(PI / 2);
      add(g, dropRing, bucketIronMat, lx + sx * 0.016, 0.228, 0, 0, 0, sx * 0.14);
      add(g, rbox(0.030, 0.068, 0.050, 0.008, 1), bucketIronMat, sx * (rt + 0.014), H + 0.015, 0);
    }

    add(g, tube([
      [-(rt + 0.016), H + 0.02, 0], [-0.258, 0.568, 0], [-0.12, 0.658, 0],
      [0, 0.675, 0], [0.12, 0.658, 0], [0.258, 0.568, 0], [rt + 0.016, H + 0.02, 0],
    ], 0.015, 18, 7), bucketIronMat);
    // Ribbed warm tan wooden/bamboo top handle grip (matching props_sheet!)
    add(g, tube([
      [-0.108, 0.660, 0], [0, 0.676, 0], [0.108, 0.660, 0],
    ], 0.024, 10, 7), hinokiWood);
    for (const gx of [-0.07, -0.035, 0, 0.035, 0.07]) {
      const gr = new THREE.TorusGeometry(0.024, 0.004, 5, 10);
      gr.rotateY(PI / 2);
      add(g, gr, hinokiDark, gx, 0.674 - gx * gx * 1.4, 0);
    }

    add(g, new THREE.SphereGeometry(1, 12, 8), coalDarkMat, 0, 0.37, 0, 0, 0, 0, 0.275, 0.09, 0.275);
    const coalPlacements = [
      [0, 0.498, -0.02, 0.074], [-0.11, 0.468, -0.06, 0.070], [0.11, 0.472, -0.05, 0.070],
      [-0.18, 0.428, 0.04, 0.065], [0.18, 0.428, 0.05, 0.064], [0, 0.448, -0.15, 0.068],
      [-0.12, 0.422, -0.15, 0.062], [0.12, 0.422, -0.14, 0.064], [-0.07, 0.448, 0.08, 0.064],
      [0.08, 0.442, 0.08, 0.062], [-0.16, 0.408, 0.14, 0.058], [0.16, 0.408, 0.14, 0.058],
      [-0.02, 0.418, 0.17, 0.060], [-0.21, 0.408, -0.06, 0.056], [0.21, 0.408, -0.06, 0.056],
      [-0.06, 0.492, -0.09, 0.060], [0.06, 0.492, -0.09, 0.060],
    ];
    for (const [cx, cy, cz, cr] of coalPlacements) {
      add(g, makeCoalChunkGeo(THREE, cr, rng), coalDarkMat, cx, cy, cz, rng.jr(0, 3), rng.jr(0, 3), rng.jr(0, 3));
    }
    for (const [ex, ey2, ez2, er] of [
      [-0.05, 0.432, 0.03, 0.046], [0.06, 0.428, 0.01, 0.044],
      [0.13, 0.412, 0.09, 0.040], [-0.13, 0.418, 0.08, 0.040],
    ]) {
      add(g, makeCoalChunkGeo(THREE, er, rng), emberGlowMat, ex, ey2, ez2, rng.jr(0, 3), rng.jr(0, 3), 0);
    }

    // Pale binchotan ash chips resting on the front of the coal mound
    const ashItems = [
      [-0.072, 0.458, 0.155, 0xd9d2c6, 1.08],
      [0.048, 0.480, 0.125, 0xc4bcb0, 1.12],
      [-0.005, 0.436, 0.205, 0xe9e2d4, 1.05],
      [0.128, 0.448, 0.165, 0xbdb5aa, 1.04],
      [-0.138, 0.440, 0.125, 0xd9d2c6, 0.96],
      [0.075, 0.436, 0.205, 0xcfc7ba, 0.94],
    ];
    const ashGeos = ashItems.map(([kx, ky, kz, khex, sc]) => {
      const chip = makeCoalChunkGeo(THREE, 0.036, rng);
      const kg = paintVertexColor(THREE, chip, khex, 0.14);
      chip.dispose();
      const m4 = new THREE.Matrix4().compose(
        new THREE.Vector3(kx, ky, kz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(kx * 5, kz * 7, ky * 3)),
        new THREE.Vector3(sc, sc * 0.72, sc)
      );
      return kg.applyMatrix4(m4);
    });
    add(g, mergeGeometries(ashGeos, false), ashVertexMat);
    ashGeos.forEach((kg) => kg.dispose());
  });

  // --------------------------------------------------------------------------
  // 12. bh_taiko_drum — Reddish-lacquer sacred taiko drum with tomoe swirl, stand & bachi
  // --------------------------------------------------------------------------
  const taikoBodyTex = paintedCanvasTex(THREE, 'bh_taiko_body_v3', 256, (g, s, rng) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#843920');
    grd.addColorStop(0.5, '#a84c2b');
    grd.addColorStop(1, '#843920');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 160, ['#bc5b37', '#73301a', '#964326'], 2, 5, 0.35, 0, 0.25, 32);
    g.strokeStyle = '#dfae4c';
    g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(0, s * 0.62); g.quadraticCurveTo(s * 0.5, s * 0.32, s, s * 0.58); g.stroke();
    for (const [fx, fy, fr] of [[0.20, 0.52, 23], [0.50, 0.42, 27], [0.80, 0.52, 23], [0.36, 0.68, 16]]) {
      drawSakura(g, s * fx, s * fy, fr, '#f4ca62', '#fff4b4', fx * 4);
    }
  }, 2, 1);
  const taikoBodyMat = cMat('taikoBody', 0xffffff, taikoBodyTex, { roughness: 0.36 });

  const taikoHeadTex = paintedCanvasTex(THREE, 'bh_taiko_head_v3', 256, (g, s, rng) => {
    const grd = g.createRadialGradient(s * 0.5, s * 0.5, s * 0.05, s * 0.5, s * 0.5, s * 0.5);
    grd.addColorStop(0, '#faeed8');
    grd.addColorStop(0.76, '#eddab7');
    grd.addColorStop(0.88, '#d6b78b');
    grd.addColorStop(1, '#ba9464');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 100, ['#fff6e2', '#e2caa4'], 2, 4, 0.25, 0, 3.14, 20);
    const cx = s * 0.5, cy = s * 0.5, R = s * 0.32;
    g.strokeStyle = '#82311e';
    g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, R * 1.08, 0, TAU); g.stroke();
    g.fillStyle = '#82311e';
    for (let i = 0; i < 3; i++) {
      g.save();
      g.translate(cx, cy);
      g.rotate((i * TAU) / 3 - 0.35);
      g.beginPath(); g.arc(0, -R * 0.46, R * 0.34, 0, TAU); g.fill();
      g.beginPath();
      g.arc(0, 0, R * 0.88, -PI * 0.52, PI * 0.08, false);
      g.arc(R * 0.16, -R * 0.14, R * 0.58, PI * 0.12, -PI * 0.42, true);
      g.closePath();
      g.fill();
      g.restore();
    }
  });
  const taikoHeadMat = cMat('taikoHead', 0xffffff, taikoHeadTex, { roughness: 0.76 });
  const bachiMat = mat('bachiWood', 0xf6ddb2, 'wood_light', 1.2, { roughness: 0.85 });

  const buildTaikoDrum = () => buildMergedProto('bh_taiko_drum', (g) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(g, rbox(0.118, 0.044, 0.128, 0.010, 1), cedarDark, sx * 0.255, 0.022, sz * 0.185);
        add(g, rbox(0.098, 0.024, 0.108, 0.005, 1), goldTrim, sx * 0.25, 0.050, sz * 0.18);
        add(g, rbox(0.074, 0.44, 0.074, 0.012, 1), cedarDark, sx * 0.22, 0.255, sz * 0.15,
          -sz * 0.14, 0, sx * 0.14);
      }
      add(g, rbox(0.054, 0.055, 0.34, 0.010, 1), cedarDark, sx * 0.225, 0.21, 0);
      add(g, rbox(0.076, 0.068, 0.38, 0.012, 1), cedarDark, sx * 0.195, 0.445, 0);
      for (const sz of [-1, 1]) {
        add(g, rbox(0.076, 0.14, 0.070, 0.018, 1), cedarDark, sx * 0.215, 0.505, sz * 0.155, sz * 0.16, 0, -sx * 0.12);
        add(g, new THREE.SphereGeometry(0.030, 8, 6), goldTrim, sx * 0.245, 0.545, sz * 0.165, 0, 0, 0, 0.55, 1, 1);
      }
      const sRing = new THREE.TorusGeometry(0.034, 0.009, 5, 12);
      sRing.rotateY(PI / 2);
      add(g, sRing, goldTrim, sx * 0.295, 0.475, 0.08);
      add(g, new THREE.SphereGeometry(0.022, 7, 5), crimsonSilk, sx * 0.30, 0.435, 0.08);
      add(g, lathe([[0, 0.29], [0.040, 0.29], [0.036, 0.315], [0.016, 0.435]], 10), crimsonSilk, sx * 0.30, 0, 0.08);
    }
    for (const sz of [-1, 1]) {
      add(g, rbox(0.46, 0.052, 0.052, 0.010, 1), cedarDark, 0, 0.21, sz * 0.155);
      add(g, rbox(0.40, 0.058, 0.058, 0.010, 1), cedarDark, 0, 0.40, sz * 0.135);
    }
    for (const [cx, cy, cr] of [[0, 0.165, 0.058], [-0.068, 0.138, 0.044], [0.068, 0.138, 0.044]]) {
      add(g, new THREE.CylinderGeometry(cr + 0.013, cr + 0.013, 0.026, 12), goldTrim, cx, cy, 0.178, PI / 2, 0, 0);
      add(g, new THREE.CylinderGeometry(cr, cr, 0.032, 12), cedarDark, cx, cy, 0.18, PI / 2, 0, 0);
    }
    for (const [bx, by, bz, ry, rz] of [
      [-0.02, 0.248, 0.155, 0.14, 1.48],
      [0.03, 0.248, 0.105, -0.18, 1.54],
    ]) {
      add(g, new THREE.CylinderGeometry(0.016, 0.018, 0.36, 10), bachiMat, bx, by, bz, 0, ry, rz);
    }

    const drum = new THREE.Group();
    drum.position.set(0, 0.745, 0);
    drum.rotation.set(-0.18, -0.12, 0);
    g.add(drum);

    const drumPts = [
      [0.258, -0.235], [0.295, -0.16], [0.322, -0.08], [0.332, 0],
      [0.322, 0.08], [0.295, 0.16], [0.258, 0.235],
    ];
    const barrelGeo = lathe(drumPts, 26);
    barrelGeo.rotateX(PI / 2);
    add(drum, barrelGeo, taikoBodyMat);

    const tackGeo = new THREE.SphereGeometry(0.013, 6, 4);
    for (const sz of [-1, 1]) {
      const headDisc = new THREE.CylinderGeometry(0.262, 0.262, 0.016, 26);
      headDisc.rotateX(sz > 0 ? PI / 2 : -PI / 2);
      add(drum, headDisc, taikoHeadMat, 0, 0, sz * 0.236);
      const hideLip = new THREE.CylinderGeometry(0.268, 0.282, 0.058, 26, 1, true);
      hideLip.rotateX(sz > 0 ? PI / 2 : -PI / 2);
      add(drum, hideLip, darumaCreamMat, 0, 0, sz * 0.212);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        add(drum, tackGeo, castIronMat, Math.cos(a) * 0.274, Math.sin(a) * 0.274, sz * 0.212);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 13. NEW Tub Disguise 1: bh_bath_duck (buildFloatingBathDuck)
  //     Adorable chunky Storybook yellow wooden/ceramic spirit bath duck (~0.28m long)
  //     with orange bill, rosy cheeks, folded ♨ mini towel & fresh green hinoki leaf on head!
  // --------------------------------------------------------------------------
  const duckYellowMat = cMat('duckYellow', 0xffd542, gouacheGrainTex(THREE, 2.2, 2.2), {
    roughness: 0.46,
    metalness: 0,
    emissive: 0x6b4506,
    emissiveIntensity: 0.12,
  });
  const duckBillMat = cMat('duckBill', 0xf27928, gouacheGrainTex(THREE, 2.0, 2.0), {
    roughness: 0.48,
    metalness: 0,
  });
  const duckCheekMat = cMat('duckCheek', 0xff8ea2, null, { roughness: 0.65, metalness: 0 });
  const duckEyeMat = cMat('duckEye', 0x221614, null, { roughness: 0.22, metalness: 0 });
  const duckTowelTex = paintedCanvasTex(THREE, 'bh_duck_towel_v2', 128, (g, s) => {
    g.fillStyle = '#fffaf0';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#325288';
    g.fillRect(0, s * 0.10, s, 6);
    g.fillRect(0, s * 0.20, s, 4);
    drawOnsenMark(g, s * 0.5, s * 0.60, s * 0.40, '#d4382a', 1);
  });
  const duckTowelMat = cMat('duckTowel', 0xffffff, duckTowelTex, { roughness: 0.88, metalness: 0 });

  const buildBathDuck = () => buildMergedProto('bh_bath_duck', (g) => {
    const sph = new THREE.SphereGeometry(1, 16, 12);
    // Plump buoyant spirit-duck body (~0.28m total length along Z)
    add(g, sph, duckYellowMat, 0, 0.068, -0.015, 0, 0, 0, 0.098, 0.072, 0.122);
    // Perky upturned tail feathers
    add(g, new THREE.ConeGeometry(0.048, 0.085, 10), duckYellowMat, 0, 0.105, -0.118, -0.82, 0, 0, 1.05, 1, 0.72);
    // Sculpted chubby wings hugged against left & right flanks
    for (const sx of [-1, 1]) {
      add(g, sph, duckYellowMat, sx * 0.094, 0.078, -0.012, 0.14, sx * 0.16, -sx * 0.18, 0.026, 0.046, 0.078);
    }
    // Round cheerful Storybook head + neck
    add(g, sph, duckYellowMat, 0, 0.158, 0.058, 0, 0, 0, 0.076, 0.074, 0.076);
    // Plump tangerine-orange upper & lower duck bill
    add(g, sph, duckBillMat, 0, 0.146, 0.132, 0.08, 0, 0, 0.042, 0.020, 0.038);
    add(g, sph, duckBillMat, 0, 0.136, 0.124, -0.06, 0, 0, 0.034, 0.014, 0.030);
    // Glossy dark spirit eyes + white starlight catchlights + rosy pink cheeks!
    for (const sx of [-1, 1]) {
      add(g, sph, duckEyeMat, sx * 0.052, 0.168, 0.112, 0, sx * 0.42, 0, 0.014, 0.016, 0.008);
      add(g, sph, duckTowelMat, sx * 0.048, 0.174, 0.119, 0, 0, 0, 0.005, 0.005, 0.004);
      add(g, sph, duckCheekMat, sx * 0.062, 0.148, 0.105, 0, sx * 0.52, 0, 0.018, 0.011, 0.006);
    }
    // Folded white ♨ bath towel balanced adorably on its head + fresh green hinoki leaf!
    const headTowel = rbox(0.102, 0.028, 0.088, 0.009, 1);
    {
      const pos = headTowel.attributes.position, uv = headTowel.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const u = (pos.getX(i) / 0.102) + 0.5;
        const v = 0.94 - ((pos.getZ(i) / 0.088) + 0.5) * 0.88;
        uv.setXY(i, Math.min(0.99, Math.max(0.01, u)), Math.min(0.99, Math.max(0.01, v)));
      }
    }
    add(g, headTowel, duckTowelMat, 0, 0.228, 0.056, 0.14, 0.06, 0.04);
    add(g, sph, pineMid, 0.024, 0.248, 0.058, 0.15, 0.25, -0.52, 0.036, 0.009, 0.018);
    add(g, sph, pineBright, -0.012, 0.244, 0.062, -0.1, -0.2, 0.42, 0.026, 0.008, 0.014);
  });

  // --------------------------------------------------------------------------
  // 14. NEW Tub Disguise 2: bh_tub_lid (buildCedarTubLid)
  //     Warm hinoki plank bath lid (~0.78m wide) with twin wooden handles & folded mini towel!
  // --------------------------------------------------------------------------
  const buildTubLid = () => buildMergedProto('bh_tub_lid', (g) => {
    // 5 bevelled warm hinoki cedar planks trimmed to a rounded ~0.78m x 0.72m tub cover
    const plankSpec = [
      [-0.28, 0.125, 0.54],
      [-0.14, 0.132, 0.68],
      [0.00, 0.136, 0.72],
      [0.14, 0.132, 0.68],
      [0.28, 0.125, 0.54],
    ];
    plankSpec.forEach(([px, pw, pd], idx) => {
      add(g, rbox(pw, 0.034, pd, 0.009, 1), idx % 2 === 0 ? hinokiWood : hinokiDark, px, 0.017, 0);
    });
    // Two transverse batten cleats across the planks
    for (const bz of [-0.18, 0.18]) {
      add(g, rbox(0.66, 0.024, 0.058, 0.007, 1), hinokiDark, 0, 0.042, bz);
    }
    // Twin sculpted hinoki bridge grip handles
    for (const sx of [-0.19, 0.19]) {
      for (const sz of [-0.085, 0.085]) {
        add(g, rbox(0.038, 0.046, 0.038, 0.007, 1), cedarDark, sx, 0.056, sz);
      }
      add(g, rbox(0.042, 0.028, 0.22, 0.009, 1), hinokiWood, sx, 0.082, 0);
    }
    // Neatly folded cream-and-indigo wave mini towel resting on the center of the lid!
    add(g, mapTowelUV(rbox(0.18, 0.032, 0.14, 0.011, 1), 0.18, 0.14), creamWaveTowelMat, 0.01, 0.048, 0.02, 0, 0.24, 0);
    add(g, mapTowelUV(rbox(0.155, 0.024, 0.115, 0.009, 1), 0.155, 0.115), indigoTowelMat, 0.005, 0.072, 0.015, 0, 0.20, 0);
  });

  // --------------------------------------------------------------------------
  // 15. Living Scurrying Suds-Sprite (`bh_suds_sprite` — pearly bath-foam bubble cluster!)
  //     A glossy lavender soap bubble with two smaller mint & peach bubbles riding on its back,
  //     two sleepy dot eyes, droplet feet and a tiny tinted bubble bobbing overhead (`starGrp`).
  // --------------------------------------------------------------------------
  const mc = createMatCache(THREE);
  const buildSudsSprite = (bubbleHex = 0xff9ecb) => {
    const root = new THREE.Group();
    root.name = 'bh_suds_sprite';
    root.userData.keep = true;

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.y = 0.25;
    root.add(bodyGrp);

    // Pearly soap-film materials (smooth, glossy, softly self-lit so they stay luminous in shade)
    const pearl = (hex, glow) => mc(hex, { roughness: 0.16, emissive: glow, emissiveIntensity: 0.22, flatShading: false });
    const lavenderMat = pearl(0xdccff8, 0x8f7ad0);
    const mintMat = pearl(0xc9f2e2, 0x58b89a);
    const peachMat = pearl(0xffd9c8, 0xe08a70);
    const glintMat = mc(0xffffff, { roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.85, flatShading: false });

    // Main bubble + two smaller bubbles clustered on its back / shoulder
    const bubbles = [
      [0.205, 0, 0, 0, lavenderMat, [1.05, 0.96, 1.0]],
      [0.118, -0.125, 0.165, -0.075, mintMat, [1, 1, 1]],
      [0.082, 0.150, 0.105, -0.040, peachMat, [1, 1, 1]],
    ];
    for (const [r, bx, by, bz, m, sc] of bubbles) {
      const bub = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
      bub.position.set(bx, by, bz);
      bub.scale.set(sc[0], sc[1], sc[2]);
      bub.castShadow = true;
      bub.receiveShadow = true;
      bodyGrp.add(bub);
      // Painted soap-film window glint on the upper-left of every bubble
      const glint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.20, 8, 6), glintMat);
      glint.scale.set(1, 1.45, 0.35);
      glint.position.set(bx - r * 0.42, by + r * 0.52, bz + r * 0.70);
      glint.rotation.z = 0.5;
      bodyGrp.add(glint);
    }

    // Two small sleepy dot eyes + rosy blush (+Z forward)
    const eyeMat = mc(0x4a3a66, { roughness: 0.3, flatShading: false });
    const blushMat = mc(0xffa9b8, { roughness: 0.7, flatShading: false });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), eyeMat);
      eye.scale.set(1, 1.15, 0.6);
      eye.position.set(sx * 0.068, 0.012, 0.196);
      bodyGrp.add(eye);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), blushMat);
      blush.scale.set(1.25, 0.7, 0.3);
      blush.position.set(sx * 0.118, -0.034, 0.172);
      bodyGrp.add(blush);
    }

    // Tiny tinted bubble bobbing overhead with a satellite droplet (`starGrp` spins in the creature rig)
    const starGrp = new THREE.Group();
    starGrp.name = 'starGrp';
    starGrp.position.set(0, 0.325, 0.02);
    const floatMat = mc(bubbleHex, { emissive: bubbleHex, emissiveIntensity: 0.45, roughness: 0.2, flatShading: false });
    const floatBubble = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), floatMat);
    starGrp.add(floatBubble);
    const satellite = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), floatMat);
    satellite.position.set(0.098, 0.022, 0);
    starGrp.add(satellite);
    bodyGrp.add(starGrp);

    // Soft foam droplet feet (alternating `legsA` / `legsB` gait pivots)
    const legsA = new THREE.Group();
    legsA.name = 'legsA';
    legsA.position.set(0, 0.14, 0);
    const legsB = new THREE.Group();
    legsB.name = 'legsB';
    legsB.position.set(0, 0.14, 0);
    const footGeo = new THREE.SphereGeometry(0.052, 10, 8);
    const mkFoot = (x, z) => {
      const f = new THREE.Mesh(footGeo, lavenderMat);
      f.scale.set(1, 0.62, 1.2);
      f.position.set(x, -0.108, z);
      return f;
    };
    legsA.add(mkFoot(-0.085, 0.045));
    legsB.add(mkFoot(0.085, 0.045));
    root.add(legsA, legsB);

    attachCreatureKinematics(root, { mode: 'suds_sprite', canFly: false });
    return root;
  };

  // --------------------------------------------------------------------------
  // 16. Origami Spirit Crane (`bh_spirit_crane` — playable flyer & 3 spirit variants!)
  // --------------------------------------------------------------------------
  const buildOrigamiCrane = (variant = 'vermilion') => {
    const pal = {
      vermilion: { body: 0xe64833, trim: 0xf7e3aa, accent: 0xffe488 },
      gold:      { body: 0xf3c24f, trim: 0xfff4dc, accent: 0xff8a47 },
      azure:     { body: 0x56b9d0, trim: 0xf4f8fc, accent: 0x9cf4e8 },
    }[variant] || { body: 0xe64833, trim: 0xf7e3aa, accent: 0xffe488 };

    const root = new THREE.Group();
    root.name = 'bh_spirit_crane';
    root.userData.keep = true;

    const mainMat = mc(pal.body, { roughness: 0.56, metalness: 0, doubleSided: true });
    const trimMat = mc(pal.trim, { roughness: 0.50, metalness: 0, doubleSided: true });
    const glowMat = mc(pal.accent, { emissive: pal.accent, emissiveIntensity: 0.32, roughness: 0.4 });
    const legMat = mc(0xdc923c, { roughness: 0.72 });

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.y = 0.48;
    root.add(bodyGrp);

    // Origami Diamond Fuselage (crisp folded paper facets!)
    const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), mainMat);
    hull.scale.set(0.88, 0.74, 1.85);
    hull.castShadow = true;
    bodyGrp.add(hull);

    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 4), trimMat);
    crest.rotation.y = PI / 4;
    crest.position.set(0, 0.22, 0.02);
    bodyGrp.add(crest);

    // Sleek Origami Neck & Gold-Tipped Beak (+Z)
    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(0, 0.10, 0.34);
    bodyGrp.add(headGrp);

    const neck = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.42, 4), mainMat);
    neck.rotation.x = 0.52;
    neck.position.set(0, 0.16, 0.10);
    headGrp.add(neck);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.22, 4), trimMat);
    head.rotation.x = PI * 0.55;
    head.position.set(0, 0.31, 0.23);
    headGrp.add(head);

    // Crisp Folded Tail & Spirit Paper Ribbon
    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(0, 0.08, -0.34);
    bodyGrp.add(tailGrp);
    const tailPlume = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.46, 4), trimMat);
    tailPlume.rotation.x = -0.78;
    tailPlume.position.set(0, 0.15, -0.14);
    tailGrp.add(tailPlume);
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.48), glowMat);
    ribbon.rotation.x = PI * 0.42;
    ribbon.position.set(0, 0.02, -0.24);
    tailGrp.add(ribbon);

    // Articulated Origami Inner Wings + Outer Tips (`wingL/R`, `tipL/R`)
    const makeWing = (side) => {
      const wg = new THREE.Group();
      wg.name = side < 0 ? 'wingL' : 'wingR';
      wg.position.set(side * 0.14, 0.06, 0.02);

      const inner = new THREE.Mesh(new THREE.BufferGeometry(), mainMat);
      const sx = side;
      inner.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, -0.22,
        sx * 0.54, 0.03, -0.12,
        sx * 0.54, 0.03, 0.16,
        0, 0, 0.20,
      ], 3));
      inner.geometry.setIndex([0, 1, 2, 0, 2, 3]);
      inner.geometry.computeVertexNormals();
      inner.castShadow = true;
      wg.add(inner);

      const tip = new THREE.Group();
      tip.name = side < 0 ? 'tipL' : 'tipR';
      tip.position.set(sx * 0.54, 0.03, 0.02);
      const outer = new THREE.Mesh(new THREE.BufferGeometry(), trimMat);
      outer.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, -0.14,
        sx * 0.44, 0.05, -0.02,
        0, 0, 0.14,
      ], 3));
      outer.geometry.setIndex([0, 1, 2]);
      outer.geometry.computeVertexNormals();
      outer.castShadow = true;
      tip.add(outer);
      wg.add(tip);
      return wg;
    };
    bodyGrp.add(makeWing(-1), makeWing(1));

    // Slender Crane Legs tucked cleanly in sky flight
    const makeLeg = (name, xOff) => {
      const lg = new THREE.Group();
      lg.name = name;
      lg.position.set(xOff, 0.40, 0);
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.40, 5), legMat);
      stilt.position.y = -0.20;
      lg.add(stilt);
      return lg;
    };
    root.add(makeLeg('legsA', -0.075), makeLeg('legsB', 0.075));

    attachCreatureKinematics(root, { mode: 'bird_flapper', canFly: true });
    return root;
  };

  const builders = {
    bh_hinoki_tub: buildHinokiTub,
    bh_paper_lantern: buildPaperLantern,
    bh_stone_fox: buildStoneFox,
    bh_sake_cask: buildSakeCask,
    bh_steamer_stack: buildSteamerStack,
    bh_bonsai_pot: buildBonsaiPot,
    bh_tea_table: buildTeaTable,
    bh_daruma_doll: buildDarumaDoll,
    bh_towel_basket: buildTowelBasket,
    bh_folding_screen: buildFoldingScreen,
    bh_coal_scuttle: buildCoalScuttle,
    bh_taiko_drum: buildTaikoDrum,
    bh_bath_duck: buildBathDuck,
    bh_tub_lid: buildTubLid,
    bh_suds_sprite: () => buildSudsSprite(0xff9ecb),
    bh_spirit_crane: () => buildOrigamiCrane('vermilion'),
    bh_crane_gold: () => buildOrigamiCrane('gold'),
    bh_crane_azure: () => buildOrigamiCrane('azure'),
  };

  _kitCache.set(THREE, builders);
  return builders;
}

export function buildFloatingBathDuck(THREE) {
  return getBathPropKit(THREE).bh_bath_duck();
}

export function buildCedarTubLid(THREE) {
  return getBathPropKit(THREE).bh_tub_lid();
}

export function buildSudsSpriteVariant(THREE, hex) {
  // Suds-sprite with its overhead float-bubble (`starGrp`) tinted per NPC bath helper
  const fn = getBathPropKit(THREE).bh_suds_sprite;
  const g = fn();
  if (hex) {
    const sg = g.getObjectByName('starGrp');
    if (sg) {
      sg.traverse((m) => {
        if (m.isMesh && m.material) {
          m.material = m.material.clone();
          m.material.color.setHex(hex);
          m.material.emissive.setHex(hex);
        }
      });
    }
  }
  return g;
}

export function buildOrigamiCraneVariant(THREE, variant = 'vermilion') {
  const kit = getBathPropKit(THREE);
  if (variant === 'gold') return kit.bh_crane_gold();
  if (variant === 'azure') return kit.bh_crane_azure();
  return kit.bh_spirit_crane();
}

export function buildMapProps(THREE) {
  return getBathPropKit(THREE);
}
