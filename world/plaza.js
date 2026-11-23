/* Village plaza — hand-modelled in code from Codex's concept paintings
 * (assets/concepts/map_plaza.png at eye level, and the plaza in the centre of map_overview.png).
 * Exports, each (THREE, opts) → THREE.Group. Origin = ground centre, front faces +Z, metres:
 *   well, stall, bench, planter, paving, buildPlazaShowcase
 * Repeated parts (stones, shingles, cobbles, produce, leaves, blossoms) are instanced; the rest is merged per material.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

// materials and instancing geometries are shared by every plaza piece, so a merged plaza buckets them together
const matCache = {};
const geoCache = {};
const cachedGeo = (key, make) => geoCache[key] || (geoCache[key] = make());

function kit(THREE, opts, name) {
  const root = new THREE.Group();
  root.name = name;
  let seed = Math.abs(Math.floor(opts.seed || 7)) % 2147483646 || 7;
  const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 4; i++) rr();                       // small seeds start with tiny values, warm the generator up
  const jr = (a, b) => a + rr() * (b - a);
  const pick = (arr) => arr[Math.floor(rr() * arr.length)];
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const rbox = (w, h, d, r, mat) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  return { root, rr, jr, pick, M, add, rbox, garden: opts.garden !== false };
}

// collects instance transforms + colours, then builds one InstancedMesh (one draw call)
function batch(THREE) {
  const o = new THREE.Object3D(), mats = [], cols = [];
  return {
    push(x, y, z, rx, ry, rz, sx, sy = sx, sz = sx, col = 0xffffff, parent = null) {
      o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
      const m = o.matrix.clone(); if (parent) m.premultiply(parent);
      mats.push(m); cols.push(col instanceof THREE.Color ? col : new THREE.Color(col));
    },
    get count() { return mats.length; },
    build(root, geo, material, name) {
      if (!mats.length) return null;
      const im = new THREE.InstancedMesh(geo, material, mats.length);
      mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
      im.castShadow = true; im.receiveShadow = true; im.name = name; root.add(im);
      return im;
    },
  };
}

const unitStone = (THREE) => cachedGeo('stone', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.3));
const unitShingle = (THREE) => cachedGeo('shingle', () => new RoundedBoxGeometry(1, 1, 1, 1, 0.14));
const leafGeo = (THREE) => cachedGeo('leaf', () => { const g = new THREE.CircleGeometry(0.1, 6); g.scale(1, 1.4, 1); return g; });
const blossomGeo = (THREE) => cachedGeo('blossom', () => new THREE.IcosahedronGeometry(0.075, 0));
const STONE_PAL = [0xf4f2f4, 0xe6e4ea, 0xdcdbe2, 0xefe4e0, 0xd8dce4, 0xeae6de, 0xd2cfd2];   // cool tints calm the warm painted stone
const GREENS = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55];

// a ring of individual rounded stones laid in staggered courses (well wall, planter wall)
function stoneRing(THREE, k, stones, R, courses, ch, depth, stoneLen, capH, capDepth) {
  const tint = () => new THREE.Color(k.pick(STONE_PAL)).offsetHSL(0, k.jr(-0.03, 0.03), k.jr(-0.06, 0.04));
  for (let c = 0; c <= courses; c++) {
    const cap = c === courses;
    const n = Math.max(6, Math.round((Math.PI * 2 * R) / (cap ? stoneLen * 0.85 : stoneLen)) + (c % 2));
    const off = (c % 2) * Math.PI / n + k.jr(-0.08, 0.08);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2 + k.jr(-0.025, 0.025);
      const len = ((Math.PI * 2 * R) / n) * k.jr(0.98, 1.1);
      const h = cap ? capH * k.jr(0.9, 1.08) : ch * k.jr(0.9, 1.0);
      const y = cap ? courses * ch + capH / 2 : ch / 2 + c * ch + k.jr(-0.01, 0.01);
      const rad = R + (cap ? 0.02 : k.jr(-0.015, 0.02));
      stones.push(Math.cos(a) * rad, y, Math.sin(a) * rad, k.jr(-0.05, 0.05), -a, k.jr(-0.06, 0.06),
        (cap ? capDepth : depth) * k.jr(0.92, 1.08), h, len, tint());
    }
  }
}

// ======================================================================== well
export function well(THREE, opts = {}) {
  const k = kit(THREE, opts, 'well');
  const { root, add, rbox, M, jr, rr } = k;
  const stoneMat = M(0xffffff, kitTex(THREE, 'stone', 0.32, 0.32));
  const timber = M(0xb07e50, kitTex(THREE, 'wood_light', 0.5, 0.5));
  const rope = M(0xf2dcae, kitTex(THREE, 'burlap', 0.6, 0.6));
  const iron = M(0x4a423a, null, { roughness: 0.85 });
  const shaft = M(0x41666c, null, { side: THREE.DoubleSide });
  const shingleMat = M(0xd8907e, kitTex(THREE, 'wood_light', 0.3, 0.3));   // red-stained wooden shingles
  const leafMat = M(0xffffff, null, { side: THREE.DoubleSide, roughness: 0.9 });
  const flowerMat = M(0xffffff, null, { roughness: 0.85 });

  // ---- round wall of individual stones, flat coping stones on top; dark shaft + water inside
  const R = 0.88, COURSES = 4, CH = 0.21, RIM = COURSES * CH + 0.13;
  const stones = batch(THREE);
  stoneRing(THREE, k, stones, R, COURSES, CH, 0.27, 0.44, 0.13, 0.38);
  stones.build(root, unitStone(THREE), stoneMat, 'well_stones');
  add(new THREE.Mesh(new THREE.CylinderGeometry(R - 0.12, R - 0.12, RIM - 0.02, 20, 1, true), shaft), 0, (RIM - 0.02) / 2);
  add(new THREE.Mesh(new THREE.CircleGeometry(R - 0.12, 20), shaft), 0, 0.52, 0, -Math.PI / 2);

  // ---- two posts set into the wall, tie beams, braces, gable frames
  const PX = R, TOP = 2.32, RIDGE = 2.86, EAVE_Z = 0.92;
  for (const sx of [-1, 1]) {
    add(rbox(0.17, TOP - 0.3, 0.17, 0.04, timber), sx * PX, 0.3 + (TOP - 0.3) / 2, 0, 0, 0, sx * jr(-0.015, 0.015));
    add(rbox(0.12, 0.46, 0.12, 0.03, timber), sx * (PX - 0.2), TOP - 0.25, 0, 0, 0, sx * Math.PI / 4);           // brace
    add(rbox(0.16, 0.14, EAVE_Z * 2 + 0.12, 0.04, timber), sx * (PX + 0.04), TOP + 0.02, 0);                        // tie beam
    add(rbox(0.1, RIDGE - TOP, 0.1, 0.03, timber), sx * (PX + 0.04), (TOP + RIDGE) / 2, 0);                        // king post
    const raf = Math.hypot(EAVE_Z + 0.1, RIDGE - TOP);
    for (const sz of [-1, 1]) {
      add(rbox(0.11, 0.12, raf, 0.03, timber), sx * (PX + 0.06), (TOP + RIDGE) / 2 + 0.04, sz * (EAVE_Z + 0.1) / 2,
        sz * Math.atan2(RIDGE - TOP, EAVE_Z + 0.1));
    }
  }
  add(rbox(PX * 2 + 0.1, 0.13, 0.15, 0.04, timber), 0, TOP + 0.02, 0);                                              // lintel

  // ---- windlass: axle with wound rope, iron collars, crank on the right
  const AY = 1.76;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, PX * 2 + 0.26, 12), timber), 0.04, AY, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 9; i++) add(new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.022, 6, 14), rope), -0.24 + i * 0.058, AY, 0, 0, Math.PI / 2 + jr(-0.08, 0.08), 0);
  for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 12), iron), sx * (PX - 0.13), AY, 0, 0, 0, Math.PI / 2);
  add(rbox(0.06, 0.36, 0.08, 0.025, iron), PX + 0.2, AY - 0.15, 0, 0, 0, 0.12);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), timber), PX + 0.3, AY - 0.31, 0, 0, 0, Math.PI / 2);
  // rope down to a little bucket hanging over the mouth (attached to the windlass, not a free-standing prop)
  const BY = 1.06;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, AY - 0.02 - (BY + 0.42), 6), rope), 0, (AY - 0.02 + BY + 0.42) / 2, 0.088);
  {
    const prof = [[0, 0], [0.12, 0], [0.15, 0.27], [0.135, 0.27], [0.108, 0.03], [0, 0.03]].map(([a, b]) => new THREE.Vector2(a, b));
    add(new THREE.Mesh(new THREE.LatheGeometry(prof, 14), timber), 0, BY, 0.088);
    for (const [y, r] of [[0.05, 0.127], [0.21, 0.143]]) add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 5, 18), iron), 0, BY + y, 0.088, Math.PI / 2);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.011, 5, 14, Math.PI), iron), 0, BY + 0.27, 0.088);
  }

  // ---- little gabled roof of individual shingles (instanced), deck + ridge board
  const theta = Math.atan2(RIDGE - TOP, EAVE_Z);
  const slopeLen = Math.hypot(EAVE_Z, RIDGE - TOP) + 0.2, roofW = 2.4;
  const shingles = batch(THREE);
  const pal = [0xffffff, 0xf4e4dc, 0xeacfc4, 0xfff0e8, 0xdcbcb0, 0xf2dcd2];   // weathered variation
  for (const sz of [-1, 1]) {
    const nx = Math.cos(theta), ny = Math.sin(theta);                 // along-slope direction (z, -y)
    add(rbox(roofW, 0.05, slopeLen, 0.02, timber), 0, RIDGE + 0.06 - ny * slopeLen / 2, sz * nx * slopeLen / 2, sz * theta);
    const rows = Math.floor((slopeLen - 0.05) / 0.16);
    for (let r = rows - 1; r >= 0; r--) {
      const s = slopeLen - 0.13 - r * 0.16;
      const cols = 11, w = roofW / cols;
      for (let c = 0; c < cols + (r % 2); c++) {
        const x = -roofW / 2 + w / 2 + c * w - (r % 2) * w / 2 + jr(-0.012, 0.012);
        if (Math.abs(x) > roofW / 2 - w * 0.3) continue;
        const lift = 0.035 + jr(0, 0.01);
        shingles.push(x, RIDGE + 0.06 - ny * s + nx * lift, sz * (nx * s + ny * lift), sz * (theta - 0.07) + jr(-0.03, 0.03), jr(-0.05, 0.05), jr(-0.04, 0.04),
          w * jr(0.88, 0.96), 0.03, 0.26 * jr(0.95, 1.05), new THREE.Color(pal[Math.floor(rr() * pal.length)]).offsetHSL(0, jr(-0.04, 0.04), jr(-0.05, 0.03)));
      }
    }
  }
  // ridge caps along the top
  for (let i = 0; i < 10; i++) shingles.push(-1.12 + i * 0.249, RIDGE + 0.1, 0, Math.PI / 4, 0, 0, 0.26, 0.15, 0.15, new THREE.Color(pal[i % pal.length]).offsetHSL(0, 0, -0.06));
  shingles.build(root, unitShingle(THREE), shingleMat, 'well_shingles');
  add(rbox(roofW + 0.06, 0.1, 0.12, 0.03, timber), 0, RIDGE + 0.06, 0);

  // ---- ivy creeping up the stones and a post, wild flowers around the foot
  const leaves = batch(THREE), blossoms = batch(THREE);
  const leaf = (x, y, z, s = 0.62) => leaves.push(x, y, z, jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28), s * jr(0.7, 1.2), s * jr(0.7, 1.2), 1, new THREE.Color(k.pick(GREENS)).offsetHSL(0, 0, jr(-0.05, 0.06)));
  const OUT = R + 0.15;
  for (const a0 of [1.15, 2.2, -0.5]) {                                  // vines on the front-ish faces
    let a = a0 + jr(-0.2, 0.2), y = 0.05;
    const top = jr(0.6, RIM + 0.05);
    while (y < top) { a += jr(-0.07, 0.07); y += jr(0.04, 0.09); for (let i = 0; i < 3; i++) leaf(Math.cos(a + jr(-0.1, 0.1)) * (OUT + jr(0, 0.04)), y + jr(-0.06, 0.06), Math.sin(a + jr(-0.1, 0.1)) * (OUT + jr(0, 0.04))); }
    for (let i = 0; i < 8; i++) { const aa = a + jr(-0.3, 0.3); leaf(Math.cos(aa) * jr(R - 0.05, R + 0.15), RIM + jr(0, 0.05), Math.sin(aa) * jr(R - 0.1, R + 0.15)); }
  }
  for (let y = 0.95; y < 2.0; y += jr(0.05, 0.09)) for (let i = 0; i < 2; i++) { const a = jr(0, 6.28); leaf(-PX + Math.cos(a) * 0.12, y, Math.sin(a) * 0.12); }
  for (const [a, n] of [[0.9, 9], [1.9, 7], [-0.8, 6], [3.6, 6]]) {      // flower clumps at the base
    const cx = Math.cos(a) * (R + 0.32), cz = Math.sin(a) * (R + 0.32);
    for (let i = 0; i < n * 4; i++) leaf(cx + jr(-0.22, 0.22), jr(0.04, 0.28), cz + jr(-0.2, 0.2), 0.7);
    const col = k.pick([0xfff8ec, 0xffe066, 0xf4a2c0, 0xffffff]);
    for (let i = 0; i < n; i++) blossoms.push(cx + jr(-0.2, 0.2), jr(0.18, 0.36), cz + jr(-0.18, 0.18), jr(0, 6), jr(0, 6), 0, jr(0.6, 0.95), jr(0.6, 0.95), jr(0.6, 0.95), new THREE.Color(col).offsetHSL(0, 0, jr(-0.04, 0.03)));
  }
  leaves.build(root, leafGeo(THREE), leafMat, 'well_leaves');
  blossoms.build(root, blossomGeo(THREE), flowerMat, 'well_blossoms');

  root.userData.footprint = { w: 2.4, d: 2.4, r: R + 0.15 };
  if (opts.merge !== false) mergeStatic(THREE, root);
  return root;
}

// ======================================================================== market stall
export function stall(THREE, opts = {}) {
  const k = kit(THREE, opts, 'stall');
  const { root, add, rbox, M, jr, rr, pick, garden } = k;
  const A = opts.a ?? 0xd9534f, B = opts.b ?? 0xfff3dc;
  const fab = [A, B].map((c) => M(c, null, { side: THREE.DoubleSide, shadowSide: THREE.FrontSide, roughness: 1 }));
  const timber = M(0xb07e50, kitTex(THREE, 'wood_light', 0.5, 0.5));
  const plank = M(0xf0d2a4, kitTex(THREE, 'wood_light', 0.22, 0.22));
  const produceMat = M(0xffffff, null, { roughness: 0.85 });

  const PX = 1.45, PZ = 0.66, HF = 2.2, HB = 2.55;
  const slope = (HB - HF) / (PZ * 2);
  const yAt = (z) => HB - (z + PZ) * slope + 0.07;                   // underside of the awning at depth z
  // ---- posts, top frame, corner braces
  for (const sx of [-1, 1]) for (const [z, h] of [[PZ, HF], [-PZ, HB]]) add(rbox(0.14, h, 0.14, 0.035, timber), sx * PX, h / 2, z, jr(-0.01, 0.01), 0, jr(-0.012, 0.012));
  add(rbox(PX * 2 + 0.3, 0.13, 0.13, 0.035, timber), 0, HF - 0.06, PZ);
  add(rbox(PX * 2 + 0.3, 0.13, 0.13, 0.035, timber), 0, HB - 0.06, -PZ);
  for (const sx of [-1, 1]) {
    add(rbox(0.12, 0.12, Math.hypot(PZ * 2, HB - HF) + 0.3, 0.03, timber), sx * PX, (HF + HB) / 2 - 0.06, 0, Math.atan(slope));
    for (const z of [PZ, -PZ]) add(rbox(0.07, 0.48, 0.07, 0.02, timber), sx * (PX - 0.17), (z > 0 ? HF : HB) - 0.27, z, 0, 0, sx * Math.PI / 4);
  }

  // ---- striped fabric awning: sagging stripes + scalloped valance on the front and sides
  const ZB = -0.88, ZF = 0.98, AW = 3.3, NS = 8, SW = AW / NS;
  for (let i = 0; i < NS; i++) {
    const g = new THREE.PlaneGeometry(1, 1, 3, 8), p = g.attributes.position;
    const xc = -AW / 2 + SW / 2 + i * SW, sag = jr(0.04, 0.07), bil = jr(0.015, 0.03);
    for (let v = 0; v < p.count; v++) {
      const u = p.getX(v), t = 0.5 - p.getY(v);
      const z = ZB + (ZF - ZB) * t;
      p.setXYZ(v, xc + u * SW, yAt(z) - sag * Math.sin(Math.PI * t) + bil * (1 - 4 * u * u), z);
    }
    g.computeVertexNormals();
    add(new THREE.Mesh(g, fab[i % 2]));
  }
  const scallop = (w, top, depth) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, -top);
    s.absellipse(0, -top, w / 2, depth, 0, Math.PI, true); s.lineTo(-w / 2, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false, curveSegments: 8 });
  };
  for (let i = 0; i < NS; i++) add(new THREE.Mesh(scallop(SW, 0.13, 0.12), fab[i % 2]), -AW / 2 + SW / 2 + i * SW, yAt(ZF) + 0.01, ZF - 0.01, -0.15);
  const nSide = 4, sideLen = (ZF - ZB) / nSide;
  for (const sx of [-1, 1]) for (let i = 0; i < nSide; i++) {
    const zc = ZB + sideLen / 2 + i * sideLen;
    const g = scallop(sideLen, 0.1, 0.1); g.translate(0, 0, -0.009);
    add(new THREE.Mesh(g, fab[(i + (sx > 0 ? 1 : 0)) % 2]), sx * (AW / 2 - 0.005), yAt(zc) + 0.01, zc, 0, sx * Math.PI / 2, sx * Math.atan(slope));
  }

  // ---- counter: slatted front, plank top, raised back tier; shallow trays built into both levels
  const CT = 0.9;
  add(rbox(2.8, CT - 0.08, 0.95, 0.04, timber), 0, (CT - 0.08) / 2 + 0.02, 0.15);
  for (let x = -1.33; x <= 1.34; x += 0.16) add(rbox(0.15, CT - 0.14 + jr(-0.02, 0.01), 0.05, 0.02, plank), x + jr(-0.005, 0.005), (CT - 0.14) / 2 + 0.06, 0.64, 0, 0, jr(-0.012, 0.012));
  add(rbox(2.9, 0.1, 0.08, 0.03, timber), 0, 0.08, 0.66);                                                   // kick rail
  add(rbox(3.0, 0.07, 1.08, 0.025, plank), 0, CT - 0.005, 0.15);                                           // counter top
  add(rbox(2.8, 0.26, 0.4, 0.03, timber), 0, CT + 0.13, -0.18);                                             // back tier riser
  add(rbox(2.95, 0.06, 0.48, 0.02, plank), 0, CT + 0.29, -0.18);
  for (const sx of [-1, 1]) add(rbox(0.07, CT, 0.07, 0.02, timber), sx * 1.38, CT / 2, -0.35);

  const fruit = batch(THREE), carrots = batch(THREE);
  const trays = [];
  for (const [tz, ty, td] of [[0.36, CT + 0.03, 0.52], [-0.18, CT + 0.32, 0.4]]) for (const tx of [-0.93, 0, 0.93]) {
    const tray = new THREE.Group(); tray.position.set(tx + jr(-0.02, 0.02), ty, tz); tray.rotation.set(0.1, jr(-0.02, 0.02), 0);
    const w = 0.86;
    add(rbox(w, 0.03, td, 0.01, plank), 0, 0.015, 0, 0, 0, 0, tray);
    add(rbox(w, 0.09, 0.035, 0.012, timber), 0, 0.045, td / 2, 0, 0, 0, tray);
    add(rbox(w, 0.13, 0.035, 0.012, timber), 0, 0.065, -td / 2, 0, 0, 0, tray);
    for (const sx of [-1, 1]) add(rbox(0.035, 0.11, td, 0.012, timber), sx * w / 2, 0.055, 0, 0, 0, 0, tray);
    root.add(tray); tray.updateMatrix(); trays.push({ m: tray.matrix.clone(), w: w - 0.06, d: td - 0.06 });
  }
  // heaps: a mound of rounded produce, a few layers deep
  const heap = (t, r, col, sc = [1, 1, 1], spin = false, extra = null) => {
    for (let L = 0; L < 3; L++) {
      const iw = t.w - 2 * r - L * r * 1.6, id = t.d - 2 * r - L * r * 1.6;
      if (iw < -r || id < -r) break;
      const nx = Math.max(1, Math.round(Math.max(iw, 0) / (r * 1.9)) + 1), nz = Math.max(1, Math.round(Math.max(id, 0) / (r * 1.9)) + 1);
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        const x = (nx > 1 ? -iw / 2 + (ix / (nx - 1)) * iw : 0) + jr(-0.012, 0.012), z = (nz > 1 ? -id / 2 + (iz / (nz - 1)) * id : 0) + jr(-0.012, 0.012);
        const y = 0.03 + r * 0.85 + L * r * 1.35, s = jr(0.88, 1.1);
        fruit.push(x, y, z, jr(-0.3, 0.3), spin ? jr(-0.35, 0.35) : jr(0, 6), jr(-0.3, 0.3), r * sc[0] * s, r * sc[1] * s, r * sc[2] * s, col(), t.m);
        if (extra) extra(x, y, z, r * s);
      }
    }
  };
  const C = (arr, l = 0.04) => () => new THREE.Color(pick(arr)).offsetHSL(0, jr(-0.03, 0.03), jr(-l, l));
  const goods = {
    apples: (t) => heap(t, 0.055, C([0xd8362e, 0xc72c2a, 0xe0473a, 0xb82a24, 0xe5603a])),
    oranges: (t) => heap(t, 0.058, C([0xf08a24, 0xf59b2c, 0xee7d1e])),
    pears: (t) => heap(t, 0.055, C([0xc2cf4a, 0xd8d256, 0xb4c84a]), [1, 1.2, 1]),
    // cabbages: dark outer leaves with a pale heart bulging out of the top
    cabbages: (t) => heap(t, 0.12, C([0x7fae4e, 0x8fbc58, 0x76a648]), [1, 0.85, 1], false, (x, y, z, r) =>
      fruit.push(x, y + r * 0.32, z, 0, jr(0, 6), 0, r * 0.74, r * 0.62, r * 0.74, C([0xc8df8f, 0xd4e6a0])(), t.m)),
    bread: (t) => heap(t, 0.075, C([0xd99a52, 0xc98642, 0xe3ad66], 0.05), [1.7, 0.85, 1.0], true),
    carrots: (t) => {
      for (let L = 0; L < 2; L++) for (let i = 0; i < 11 - L * 2; i++) {
        const x = -t.w / 2 + 0.06 + (i + L * 1.0) * ((t.w - 0.12) / 10), y = 0.06 + L * 0.055, s = jr(0.9, 1.1);
        carrots.push(x + jr(-0.01, 0.01), y, 0.04 + jr(-0.02, 0.02), Math.PI / 2 + jr(-0.06, 0.06), 0, jr(-0.15, 0.15), 0.034 * s, 0.24 * s, 0.034 * s, new THREE.Color(pick([0xf07a24, 0xf58a2c, 0xe86c1c])), t.m);
        for (let q = 0; q < 3; q++) carrots.push(x + jr(-0.02, 0.02), y + 0.03, -0.14, -1.0 + jr(-0.25, 0.25), 0, jr(-0.5, 0.5), 0.014, 0.17 * jr(0.8, 1.1), 0.014, new THREE.Color(pick(GREENS)), t.m);
      }
    },
  };
  const order = ['apples', 'oranges', 'carrots', 'cabbages', 'bread', 'pears'];
  // seed-dependent shuffle so the two stalls in the plaza don't sell the same layout
  const front = order.slice(0, 3).sort(() => rr() - 0.5), back = order.slice(3).sort(() => rr() - 0.5);
  front.forEach((g, i) => goods[g](trays[i]));
  back.forEach((g, i) => goods[g](trays[3 + i]));

  // ---- garden version only: a crate of apples and a woven basket beside the stall (these read as hideable props)
  if (garden) {
    const crate = new THREE.Group(); crate.position.set(1.95, 0, 0.35); crate.rotation.y = -0.2;
    for (let j = 0; j < 3; j++) for (const sz of [-1, 1]) add(rbox(0.6, 0.1, 0.03, 0.01, plank), 0, 0.07 + j * 0.13, sz * 0.2, 0, 0, 0, crate);
    for (let j = 0; j < 3; j++) for (const sx of [-1, 1]) add(rbox(0.03, 0.1, 0.4, 0.01, plank), sx * 0.29, 0.07 + j * 0.13, 0, 0, 0, 0, crate);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rbox(0.05, 0.4, 0.05, 0.01, timber), sx * 0.28, 0.2, sz * 0.19, 0, 0, 0, crate);
    add(rbox(0.56, 0.03, 0.38, 0.01, plank), 0, 0.03, 0, 0, 0, 0, crate);
    root.add(crate); crate.updateMatrix();
    const cm = crate.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.25, 0));
    goods.apples({ m: cm, w: 0.5, d: 0.32 });
    const basket = M(0xf3d9a8, kitTex(THREE, 'hay', 0.8, 0.8));
    const prof = [[0, 0], [0.2, 0], [0.27, 0.12], [0.3, 0.3], [0.28, 0.32], [0.25, 0.14], [0, 0.04]].map(([a, b]) => new THREE.Vector2(a, b));
    add(new THREE.Mesh(new THREE.LatheGeometry(prof, 16), basket), -2.0, 0, 0.45);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 6, 20), basket), -2.0, 0.31, 0.45, Math.PI / 2);
    goods.pears({ m: new THREE.Matrix4().makeTranslation(-2.0, 0.17, 0.45), w: 0.36, d: 0.36 });
  }

  fruit.build(root, cachedGeo('fruit', () => new THREE.IcosahedronGeometry(1, 1)), produceMat, 'stall_produce');
  carrots.build(root, cachedGeo('carrot', () => new THREE.ConeGeometry(1, 1, 7)), produceMat, 'stall_carrots');
  root.userData.footprint = { w: 3.3, d: 1.9 };
  if (opts.merge !== false) mergeStatic(THREE, root);
  return root;
}

// ======================================================================== bench
export function bench(THREE, opts = {}) {
  const k = kit(THREE, opts, 'bench');
  const { root, add, rbox, M, jr } = k;
  const wood = M(0xd2a06a, kitTex(THREE, 'wood_light', 0.6, 0.6));
  const stone = M(0xe6e2da, kitTex(THREE, 'stone', 0.45, 0.45));
  const L = 1.8, SY = 0.47, LX = 0.6;
  for (const sx of [-1, 1]) {                                          // chunky stone legs: foot, block, cap
    const x = sx * LX + jr(-0.02, 0.02);
    add(rbox(0.36, 0.1, 0.56, 0.04, stone), x, 0.05, 0, 0, jr(-0.04, 0.04), 0);
    add(rbox(0.24, 0.27, 0.44, 0.07, stone), x, 0.23, 0, 0, jr(-0.03, 0.03), jr(-0.02, 0.02));
    add(rbox(0.32, 0.07, 0.52, 0.03, stone), x, SY - 0.075, 0, 0, jr(-0.03, 0.03), 0);
  }
  for (const z of [-0.16, 0, 0.16]) add(rbox(L + jr(-0.04, 0.02), 0.055, 0.14, 0.025, wood), jr(-0.015, 0.015), SY - 0.01 + jr(-0.005, 0.005), z, 0, jr(-0.01, 0.01), jr(-0.006, 0.006));
  const tilt = 0.16;
  for (const x of [-LX, 0, LX]) add(rbox(0.08, 0.66, 0.06, 0.025, wood), x, SY + 0.22, -0.27 - Math.sin(tilt) * 0.3, -tilt);
  for (const [y, h] of [[SY + 0.25, 0.1], [SY + 0.43, 0.12]]) add(rbox(L - 0.02 + jr(-0.03, 0.03), h, 0.045, 0.02, wood), jr(-0.01, 0.01), y, -0.31 - Math.sin(tilt) * (y - SY), -tilt);
  root.userData.footprint = { w: L, d: 0.66 };
  if (opts.merge !== false) mergeStatic(THREE, root);
  return root;
}

// ======================================================================== stone planter
export function planter(THREE, opts = {}) {
  const k = kit(THREE, opts, 'planter');
  const { root, add, M, jr, pick } = k;
  const stoneMat = M(0xffffff, kitTex(THREE, 'stone', 0.32, 0.32));
  const soil = M(0x7a5a3e, null);
  const leafMat = M(0xffffff, null, { side: THREE.DoubleSide, roughness: 0.9 });
  const flowerMat = M(0xffffff, null, { roughness: 0.85 });
  const R = 0.52, COURSES = 3, CH = 0.17, TOP = COURSES * CH + 0.1;
  const stones = batch(THREE);
  stoneRing(THREE, k, stones, R, COURSES, CH, 0.2, 0.32, 0.1, 0.28);
  stones.build(root, unitStone(THREE), stoneMat, 'planter_stones');
  add(new THREE.Mesh(new THREE.CylinderGeometry(R - 0.08, R - 0.08, TOP - 0.06, 16), soil), 0, (TOP - 0.06) / 2);

  const leaves = batch(THREE), blossoms = batch(THREE);
  const leaf = (x, y, z, s = 1, dark = 0) => leaves.push(x, y, z, jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28), s * jr(0.75, 1.2), s * jr(0.75, 1.2), 1, new THREE.Color(pick(GREENS)).offsetHSL(0, 0, jr(-0.06, 0.05) - dark));
  const bloom = (x, y, z, col, s = 1) => blossoms.push(x, y, z, jr(0, 6), jr(0, 6), 0, s * jr(0.75, 1.15), s * jr(0.6, 0.9), s * jr(0.75, 1.15), new THREE.Color(col).offsetHSL(0, jr(-0.04, 0.04), jr(-0.04, 0.04)));
  // small rounded shrub in the middle
  const SY = TOP + 0.3;
  for (let i = 0; i < 420; i++) {
    const a = jr(0, 6.28), e = Math.acos(jr(-0.35, 1)), rad = jr(0.8, 1.02);
    leaf(Math.cos(a) * Math.sin(e) * 0.3 * rad, SY + Math.cos(e) * 0.36 * rad, Math.sin(a) * Math.sin(e) * 0.3 * rad, 0.75, -0.04);
  }
  // a few blooms dotted over the shrub itself
  const shrubCol = pick([0xfff8ec, 0xf4a2c0, 0xffe27a]);
  for (let i = 0; i < 14; i++) { const a = jr(0, 6.28), e = Math.acos(jr(0, 1)); bloom(Math.cos(a) * Math.sin(e) * 0.32, SY + Math.cos(e) * 0.38, Math.sin(a) * Math.sin(e) * 0.32, shrubCol, 0.9); }
  // flowers all round the rim, some spilling over and trailing down the stones
  const palette = [[0xf06a8a, 0xf4a2c0], [0xe8443a, 0xff7a5a], [0xfff8ec, 0xfdf1d0], [0xffd23f, 0xffe27a], [0xb48ae0, 0xc9a6ee]];
  const nClump = 9, off = jr(0, 6.28);
  for (let c = 0; c < nClump; c++) {
    const a = off + (c / nClump) * Math.PI * 2 + jr(-0.15, 0.15), cols = pick(palette);
    const cx = Math.cos(a) * jr(0.32, 0.42), cz = Math.sin(a) * jr(0.32, 0.42);
    for (let i = 0; i < 18; i++) leaf(cx + jr(-0.16, 0.16), TOP + jr(-0.02, 0.2), cz + jr(-0.16, 0.16), 0.8);
    for (let i = 0; i < 15; i++) bloom(cx + jr(-0.16, 0.16), TOP + jr(0.1, 0.32), cz + jr(-0.16, 0.16), cols[i % 2], 0.95);
    if (c % 2 === 0) {                                                   // trailing over the edge
      let y = TOP + 0.02, rad = R + 0.06;
      while (y > 0.18) {
        y -= jr(0.04, 0.08); rad = Math.min(R + 0.17, rad + 0.02);
        const aa = a + jr(-0.12, 0.12);
        leaf(Math.cos(aa) * rad, y, Math.sin(aa) * rad, 0.9);
        leaf(Math.cos(aa + 0.08) * rad, y + 0.03, Math.sin(aa + 0.08) * rad, 0.9);
        if (k.rr() < 0.35) bloom(Math.cos(aa) * (rad + 0.03), y, Math.sin(aa) * (rad + 0.03), cols[0], 0.8);
      }
    }
  }
  leaves.build(root, leafGeo(THREE), leafMat, 'planter_leaves');
  blossoms.build(root, blossomGeo(THREE), flowerMat, 'planter_blossoms');
  root.userData.footprint = { w: 1.3, d: 1.3, r: R + 0.12 };
  if (opts.merge !== false) mergeStatic(THREE, root);
  return root;
}

// ======================================================================== plaza paving
// one low domed cobble (24 tris): squircle base, shoulder ring, crown; scaling gives soft rounded rectangles
function cobbleGeo(THREE) {
  return cachedGeo('cobble', () => {
    const pos = [], uv = [], idx = [], N = 8;
    const rings = [[0.5, 0], [0.42, 0.72]];
    for (const [r, y] of rings) for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.PI / N, c = Math.cos(a), s = Math.sin(a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), 0.4) * r, z = Math.sign(s) * Math.pow(Math.abs(s), 0.4) * r;   // squircle corners
      pos.push(x, y, z); uv.push(x + 0.5, z + 0.5);
    }
    pos.push(0, 1, 0); uv.push(0.5, 0.5);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      idx.push(i, N + j, j, i, N + i, N + j);           // side band
      idx.push(N + i, 2 * N, N + j);                     // crown fan
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
}

export function paving(THREE, opts = {}) {
  const k = kit(THREE, opts, 'paving');
  const { root, M, jr, rr, pick } = k;
  const R = opts.r || 9;
  const Y0 = 0.006;
  // grout bed between the stones
  const bed = new THREE.Mesh(new THREE.CircleGeometry(R + 0.05, 72), M(0x7c826a, kitTex(THREE, 'plaster', R * 0.5, R * 0.5)));   // dark mossy grout
  bed.rotation.x = -Math.PI / 2; bed.position.y = 0.009; bed.receiveShadow = true; bed.name = 'paving_bed';
  root.add(bed);

  const cob = batch(THREE);
  const PAL = [0x9ea6c4, 0x949ebe, 0xb4a4b8, 0xa8a6bc, 0x8e9cbe, 0xb4b4cc, 0xac9cae, 0xb2a4b6];   // cool tints over cream plaster → grey/pink/blue-grey cobbles
  const tint = (l = 0) => new THREE.Color(pick(PAL)).offsetHSL(0, jr(-0.02, 0.02), jr(-0.06, 0.05) + l);
  const spokes = 8, spokeOff = Math.PI / 8;
  const stone = (rad, a, len, wid, h, col) => cob.push(Math.cos(a) * rad, Y0, Math.sin(a) * rad, 0, -a + (rr() < 0.5 ? 0 : Math.PI) + jr(-0.04, 0.04), 0, wid, h, len, col);
  // centre flagstone, then concentric courses out to the kerb
  cob.push(0, Y0, 0, 0, jr(0, 3), 0, 0.95, 0.04, 0.95, tint(0.03));
  const ACCENT1 = 2.8, ACCENT2 = R - 1.25;
  let rad = 0.5;
  while (rad < R - 0.48) {
    const accent = (rad < ACCENT1 && rad + 0.42 >= ACCENT1) || (rad < ACCENT2 && rad + 0.42 >= ACCENT2);
    const cw = accent ? 0.5 : 0.4 * jr(0.95, 1.06);
    const rc = rad + cw / 2;
    const target = accent ? 0.72 : 0.5;
    const n = Math.max(6, Math.round((Math.PI * 2 * rc) / target));
    const off = jr(0, 6.28), step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const a = off + i * step + jr(-0.06, 0.06) * step;
      let col, h = jr(0.03, 0.04), len = rc * step * jr(0.88, 0.95), wid = cw * jr(0.86, 0.93);
      if (accent) { col = tint(0.07); h = 0.042; }
      else if (rc > ACCENT1 + 0.3 && rc < ACCENT2 - 0.3) {
        // radial spokes of paler stones between the two accent rings
        const d = Math.abs(((a - spokeOff) % (Math.PI * 2 / spokes) + Math.PI * 2 / spokes) % (Math.PI * 2 / spokes) - Math.PI / spokes) * rc;
        col = d > (Math.PI / spokes) * rc - 0.3 ? tint(0.09) : tint();
      } else col = tint();
      stone(rc, a, len, wid, h, col);
    }
    rad += cw;
  }
  // kerb ring of bigger stones, the highest point of the paving (top ≤ 0.06)
  {
    const rc = R - 0.22, n = Math.round((Math.PI * 2 * rc) / 0.62), off = jr(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      stone(rc, a, ((Math.PI * 2 * rc) / n) * jr(0.86, 0.93), 0.4, jr(0.048, 0.052), new THREE.Color(pick(PAL)).offsetHSL(0, 0.02, jr(-0.12, -0.06)));
    }
  }
  const im = cob.build(root, cobbleGeo(THREE), M(0xffffff, kitTex(THREE, 'plaster', 0.45, 0.45)), 'paving_cobbles');
  im.castShadow = false;
  root.traverse((o) => { if (o.isMesh) o.userData.ground = true; });
  root.userData.ground = true;
  root.userData.footprint = { r: R };
  return root;          // already 2 draw calls; nothing for mergeStatic to do
}

// ======================================================================== showcase (gallery.html?only=plaza)
export function buildPlazaShowcase(THREE, opts = {}) {
  const root = new THREE.Group();
  root.name = 'plaza';
  const seed = opts.seed || 7;
  const sub = (o) => Object.assign({}, opts, { merge: false }, o);
  const place = (g, x, z, ry) => { g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); return g; };
  const facing = (x, z) => Math.atan2(-x, -z);            // +Z front turned toward the well
  place(well(THREE, sub({ seed })), 0, 0, 0);
  place(stall(THREE, sub({ seed: seed + 11 })), -4.4, -2.6, facing(-4.4, -2.6) + 0.15);
  place(stall(THREE, sub({ seed: seed + 23, a: 0x6fb1e8, b: 0xfff3dc })), 4.4, -2.6, facing(4.4, -2.6) - 0.15);
  for (const [x, z, i] of [[-3.9, 4.4, 1], [3.9, 4.4, 2], [0, -5.6, 3]]) place(bench(THREE, sub({ seed: seed + 40 + i })), x, z, facing(x, z));
  for (const [x, z, i] of [[-6.4, 1.6, 1], [6.4, 1.6, 2]]) place(planter(THREE, sub({ seed: seed + 60 + i })), x, z, 0);
  if (opts.merge !== false) mergeStatic(THREE, root);
  root.add(paving(THREE, { seed, r: opts.r || 9 }));      // added after merging so its meshes keep userData.ground
  return root;
}
