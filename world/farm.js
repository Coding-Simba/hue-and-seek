/* Farm edge & outskirts — hand-modelled in code from Codex's concepts (assets/concepts/map_farm.png, map_overview.png).
 * Every export takes (THREE, opts) and returns a THREE.Group: origin = ground centre, front faces +Z, metres.
 *   barn         ~10 × 9.4 × 8 m red plank barn, gambrel slate roof, open X-braced doors, hay hood, lean-to; enterable
 *                (stalls, tool corner, hay floor under a loft deck; child Group 'roof'; userData rooms/colliders/propSlots)
 *   windmill     ~9.6 m stone tower + wooden cap; child Group 'sails' spins on rotation.z (hub on its origin)
 *   woodshed     ~4 × 2 m open timber shed, shingle roof, firewood stacked inside
 *   fence        rustic fence along X, length opts.len (3 m)
 *   stoneWall    dry-stone wall along X, length opts.len (4 m), ~0.9 m high
 *   bridge       arched stone footbridge, 5 m long (walkway runs along Z) × 1.8 m wide; deck mesh has userData.ground
 *   stream       water channel along X, opts.len (12) × opts.w (2); bed + water have userData.ground, water ripples in its shader
 *   laundryLine  two posts, rope, pegged cloths in child Group 'cloth' (pivot on the rope line)
 *   buildFarmShowcase  everything laid out like the overview map (gallery.html?only=farm)
 * opts: seed, wall (barn tint), garden (false = in-game, no prop look-alikes), light, merge — see houses/BRIEF.md.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

const matCache = {};
const STONE_PAL = [0xf2efe8, 0xe2ddd3, 0xd6d0c5, 0xe9e0cf, 0xcdc8bf, 0xf7f3ec, 0xdcd4c4, 0xc9cdd0];
const GREENS = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55];
const HAY_PAL = [0xf2d27a, 0xe8c25e, 0xf7e2a0, 0xd9b04c, 0xfbe9b4];

// shared per-piece toolkit: seeded random, cached materials, rounded boxes, instancing, roof shingles
function kit(THREE, opts, name, salt) {
  let s = ((Math.abs(Math.floor(opts.seed ?? 7)) * 7919 + salt * 104729) % 2147483646) + 1;
  const rr = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const tex = (n, rx = 1, ry = 1) => kitTex(THREE, n, rx, ry);
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  const root = new THREE.Group();
  root.name = name;
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const rbox = (w, h, d, r, mat, seg = 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, Math.min(r, w / 2, h / 2, d / 2) * 0.98)), mat);
  const col = (c) => (c && c.isColor ? c : new THREE.Color(c ?? 0xffffff));
  const tint = (pal, l = 0.05) => col(pal[Math.floor(rr() * pal.length)]).clone().offsetHSL(0, jr(-0.03, 0.03), jr(-l, l));
  const o3 = new THREE.Object3D();
  // instance lists hold [matrix, colour]; put() = position / euler / scale
  const put = (list, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, c, order = 'XYZ') => {
    o3.position.set(x, y, z); o3.rotation.set(rx, ry, rz, order); o3.scale.set(sx, sy, sz); o3.updateMatrix();
    list.push([o3.matrix.clone(), col(c)]);
  };
  const inst = (geo, mat, list, parent = root) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([mx, c], i) => { m.setMatrixAt(i, mx); m.setColorAt(i, c); });
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  // matrix from a local frame: x along xAx, z along zAx, y = z × x (flipped to point up unless fixUp=false)
  const basis = (pos, xAx, zAx, tilt, yaw, sx, sy, sz, fixUp = true) => {
    const yAx = new THREE.Vector3().crossVectors(zAx, xAx);
    let z = zAx;
    if (fixUp && yAx.y < 0) { yAx.negate(); z = zAx.clone().negate(); }
    const m = new THREE.Matrix4().makeBasis(xAx, yAx, z);
    m.multiply(new THREE.Matrix4().makeRotationZ(tilt)).multiply(new THREE.Matrix4().makeRotationY(yaw)).scale(new THREE.Vector3(sx, sy, sz));
    m.setPosition(pos);
    return m;
  };
  // one roof plane of overlapping shingles: profile line A (upper) → B (lower eave) in XY, running along Z from z0 to z1
  const slope = (list, ax, ay, bx, by, z0, z1, o = {}) => {
    const L = o.len ?? 0.42, W = o.w ?? 0.34, step = o.step ?? 0.24, pal = o.pal ?? [0xffffff];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    const d = new THREE.Vector3(dx / len, dy / len, 0), n = new THREE.Vector3(-d.y, d.x, 0);
    if (n.y < 0) n.negate();
    const cols = Math.max(1, Math.round((z1 - z0) / W)), wc = (z1 - z0) / cols;
    let r = 0;
    for (let sd = len - L / 2; sd > L / 2 - step * 0.7; sd -= step, r++) {
      for (let c = 0; c < cols; c++) {
        const z = z0 + (c + 0.5 + (r % 2 ? 0.25 : -0.25)) * wc + jr(-0.012, 0.012);
        const p = new THREE.Vector3(ax + d.x * sd, ay + d.y * sd, z).addScaledVector(n, (o.off ?? 0.09) + jr(-0.004, 0.006));
        const m = basis(p, d, new THREE.Vector3(0, 0, 1), (o.lift ?? 0.07) + jr(-0.025, 0.025), jr(-0.05, 0.05), jr(0.95, 1.05), 1, (wc / W) * jr(0.9, 1.0));
        if (o.pre) m.premultiply(o.pre);
        list.push([m, tint(pal)]);
      }
    }
  };
  const finish = (animated = []) => {
    if (opts.merge !== false) { for (const g of animated) mergeStatic(THREE, g); mergeStatic(THREE, root); }
    return root;
  };
  return { root, rr, jr, tex, M, add, rbox, col, tint, put, inst, basis, slope, finish, V: THREE.Vector3 };
}

// chamfered shingle slab: length along X (the butt end, +X, is clipped), width along Z, thickness along Y — 44 triangles
function shingleGeo(THREE, len = 0.42, w = 0.34, t = 0.035) {
  const s = new THREE.Shape(), c = Math.min(w, len) * 0.22, hl = len / 2, hw = w / 2;
  s.moveTo(-hl, -hw); s.lineTo(hl - c, -hw); s.lineTo(hl, -hw + c); s.lineTo(hl, hw - c); s.lineTo(hl - c, hw); s.lineTo(-hl, hw); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: Math.min(0.012, t * 0.35), bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -t / 2); g.rotateX(-Math.PI / 2);
  return g;
}
// lumpy rounded stone, unit size (1 m across before scaling); k varies the lumps
function stoneGeo(THREE, k = 1, ws = 8, hs = 6) {
  const g = new THREE.SphereGeometry(0.5, ws, hs), p = g.attributes.position, v = new THREE.Vector3(), cube = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    cube.copy(v).multiplyScalar(0.5 / Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z), 1e-4));
    v.lerp(cube, 0.38);
    const n = Math.sin(v.x * 9.1 + k * 1.7) * Math.sin(v.y * 7.3 + k * 2.3) * Math.sin(v.z * 8.7 + k * 0.9) * 0.22 + Math.sin((v.x + v.z) * 14 + k) * 0.035;
    v.multiplyScalar(1 + n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const leafGeo = (THREE) => { const g = new THREE.CircleGeometry(0.1, 6); g.scale(1, 1.4, 1); return g; };
const leafMat = (M, THREE) => M(0xffffff, null, { roughness: 0.9, side: THREE.DoubleSide });

// ============================================================ BARN
// Enterable (assets/interiors/barn_ground.png + barn_loft.png): the open front double doors lead onto a packed-earth threshing
// floor with two empty stalls on the left, saddle / tool corner on the right; a low wall of stacked hay splits off the back
// hay floor (the walkable stand-in for the loft), under a narrow loft deck with a ladder that is decoration only.
// Everything above the eaves (gambrel roof, upper gables, hay hood, cupola, tie beams) is in the child Group 'roof'.
export function barn(THREE, opts = {}) {
  const K = kit(THREE, opts, 'barn', 1);
  const { root, M, add, rbox, jr, rr, tex, put, inst, slope, tint } = K;
  const garden = opts.garden !== false;
  const hw = 4.0, hd = 4.1, H = 3.5, kx = 2.8, ky = 5.7, ry = 7.0, F = 0.3, RO = 0.3, FL = 0.05;   // half width/depth, eave, gambrel knee, ridge, plank base, gable overhang, floor
  const T = 0.2, IW = hw - T, ID = hd - T;                                                     // wall thickness, inner faces
  const DW = 1.6, DH = 3.3, LW = 0.7, LY0 = 4.15, LY1 = 5.3;                                  // doorway half-width/top, hayloft door half-width/sill/head
  const cx = -1.05;                                                                           // barn body sits left so body + lean-to are centred
  const B = new THREE.Group(); B.position.x = cx; root.add(B);
  const RF = new THREE.Group(); RF.name = 'roof'; RF.userData.keep = true; RF.position.x = cx; root.add(RF);
  const at = (m, x, y, z, rx = 0, ryy = 0, rz = 0, P = B) => add(m, x, y, z, rx, ryy, rz, P);
  const prof = (x) => { const a = Math.abs(x); return a >= kx ? H + (hw - a) / (hw - kx) * (ky - H) : ky + (kx - a) / kx * (ry - ky); };
  const SZ = [0.55, 2.2, 3.85], STX = -2.2;                        // stall partitions (z) along the left wall, stall fronts (x)
  const DZ0 = 0.05, DZ1 = 0.5, GAP = 1.0;                        // hay-stack divider band between the two floors, half gap
  const DECK = -2.95, DECKY = 3.0;                                // loft deck front edge (z) and height

  // ---------------- materials
  const wallHex = opts.wall ?? 0xdc9c8e;
  const red = M(wallHex, tex('terracotta', 0.7, 0.7));
  const red2 = M(new THREE.Color(wallHex).multiplyScalar(0.86).getHex(), tex('terracotta', 0.9, 0.9));
  const trim = M(0xfff7ea, tex('plaster', 0.5, 0.5));
  const timber = M(0xb4824f, tex('wood_light', 0.6, 0.6));
  const darkWood = M(0xd6b8a0, tex('wood_planks_dark', 0.6, 0.6));
  const stone = M(0xe2dacb, tex('stone', 0.6, 0.6));
  const stoneI = M(0xffffff, tex('plaster', 0.6, 0.6));
  const slateDark = M(0xb4aec4, tex('painted_metal', 0.6, 0.6));
  const shMat = M(0xffffff, tex('painted_metal', 0.35, 0.35));
  const hayM = M(0xfff2cc, tex('hay', 1.3, 1.3));
  const iron = M(0x3b3530, null, { roughness: 0.7 });
  const glass = M(0x4d6b7a, null, { roughness: 0.3 });
  const glowIn = M(0xffc878, null, { emissive: 0xff9a30, emissiveIntensity: 0.9, roughness: 0.6 });
  const glassIn = M(0x6a5236, null, { roughness: 0.85, emissive: 0xffb050, emissiveIntensity: 0.45 });
  const glow = M(0xffd894, null, { emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.4 });
  const rope = M(0xe9d3ad, tex('burlap', 2, 2));
  const dirt = M(0xcf9f6e, tex('plaster', 0.35, 0.35));
  const twine = M(0x9a7a50, null);
  const SLATE = [0xd6cce4, 0xc6bed8, 0xe0d8ec, 0xbab2cc, 0xd2c8d8, 0xc4bcd4, 0xe8e2f0];
  const shL = [], shL2 = [], stoneL = [], strawL = [], leaves = [], blossoms = [];

  // ---------------- boards: extruded planks (top edge follows the gambrel profile on the gables when y1 == null)
  const plank = (x0, x1, y0, y1, mat, px, pz, rotY = 0, t = 0.08, P = B) => {
    const s = new THREE.Shape(), a = x0 + 0.008, b = x1 - 0.008;
    s.moveTo(a, y0); s.lineTo(b, y0);
    if (y1 == null) { s.lineTo(b, prof(b)); for (const q of [kx, 0, -kx]) if (q < b - 0.01 && q > a + 0.01) s.lineTo(q, prof(q)); s.lineTo(a, prof(a)); }
    else { s.lineTo(b, y1); s.lineTo(a, y1); }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -t / 2);
    return at(new THREE.Mesh(g, mat), px, 0, pz, 0, rotY, 0, P);
  };
  const runs = (breaks) => {
    const out = [];
    for (let i = 0; i < breaks.length - 1; i++) {
      const a = breaks[i], b = breaks[i + 1], n = Math.max(1, Math.round((b - a) / 0.3));
      for (let j = 0; j < n; j++) out.push([a + (b - a) * j / n, a + (b - a) * (j + 1) / n]);
    }
    return out;
  };
  // one board column from y0 up to `top` (a height, or null = gable profile) with gaps; everything above the eave goes to 'roof'
  const column = (x0, x1, y0, top, cuts, mat, px, pz, rotY, t) => {
    let y = y0;
    const piece = (a, b) => {
      if (b != null && b - a < 0.02) return;
      if (a < H - 0.01) { plank(x0, x1, a, b == null || b > H ? H : b, mat, px, pz, rotY, t); if (b == null || b > H) plank(x0, x1, H, b, mat, px, pz, rotY, t, RF); }
      else plank(x0, x1, a, b, mat, px, pz, rotY, t, RF);
    };
    for (const [c0, c1] of cuts) { if (c0 > y + 0.01) piece(y, c0); y = Math.max(y, c1); }
    if (top == null) { if (prof(Math.max(Math.abs(x0), Math.abs(x1))) > y + 0.03) piece(y, null); } else if (top > y + 0.01) piece(y, top);
  };
  const WIN_L = [-2.2, 2.0], WIN_R = [-1.0], WY = 2.0, WH = 0.78, WWD = 0.72;   // side windows (z), sill centre, size
  for (const zs of [1, -1]) {                                                   // front & back gables, outer boards + inner lining
    const front = zs > 0;
    runs(front ? [-hw, -DW, -LW, LW, DW, hw] : [-hw, -1.5, 0, 1.5, hw]).forEach(([x0, x1], i) => {
      const xc = (x0 + x1) / 2, mat = (i % 3 === 1 || rr() < 0.2) ? red2 : red, z = zs * (hd + jr(0, 0.014));
      const cuts = [];
      if (front && Math.abs(xc) < DW) cuts.push([F, DH]);
      if (front && Math.abs(xc) < LW) cuts.push([LY0, LY1]);
      if (!front && Math.abs(xc) < 0.42) cuts.push([4.6, 5.35]);                 // little back window
      column(x0, x1, F, null, cuts, mat, 0, z);
      if (Math.abs(xc) < IW) column(Math.max(x0, -IW), Math.min(x1, IW), FL, H, front && Math.abs(xc) < DW ? [[FL, DH]] : [], rr() < 0.5 ? red : red2, 0, zs * (ID + 0.03), 0, 0.06);
    });
  }
  for (const sx of [-1, 1]) {
    const wins = sx < 0 ? WIN_L : WIN_R;
    runs([-hd, hd]).forEach(([u0, u1], i) => {
      column(u0, u1, F, H + 0.06, [], (i % 3 === 1 || rr() < 0.2) ? red2 : red, sx * (hw + jr(0, 0.014)), 0, sx * Math.PI / 2);
      const uc = (u0 + u1) / 2;
      if (Math.abs(uc) > ID) return;
      const zc = sx < 0 ? uc : -uc;                                             // board → world z on this wall
      const cut = wins.some((wz) => Math.abs(zc - wz) < WWD / 2 + 0.06) ? [[WY - WH / 2 - 0.06, WY + WH / 2 + 0.06]] : [];
      column(Math.max(u0, -ID), Math.min(u1, ID), FL, H, cut, rr() < 0.5 ? red : red2, sx * (IW + 0.03), 0, sx * Math.PI / 2, 0.06);
    });
  }
  // wall plates capping the hollow walls at the eave, so the top reads as solid timber when the roof lifts away
  for (const sx of [-1, 1]) at(rbox(T + 0.14, 0.16, 2 * hd + 0.1, 0.04, timber, 1), sx * (hw - T / 2), H + 0.02, 0);
  for (const sz of [-1, 1]) for (const [x0, x1] of sz > 0 ? [[-hw, -DW], [DW, hw]] : [[-hw, hw]]) at(rbox(x1 - x0, 0.16, T + 0.14, 0.04, timber, 1), (x0 + x1) / 2, H + 0.02, sz * (hd - T / 2));
  at(rbox(2 * DW + 0.1, 0.16, T + 0.14, 0.04, timber, 1), 0, H + 0.02, hd - T / 2);
  // plinth: a ring of stone (gap at the doorway) + a course of individual stones; packed-earth floor inside
  for (const [x0, z0, x1, z1] of [[-hw, -hd, hw, -hd + T], [-hw, -hd, -hw + T, hd], [hw - T, -hd, hw, hd], [-hw, hd - T, -DW, hd], [DW, hd - T, hw, hd]]) {
    at(rbox(x1 - x0 + 0.14, F, z1 - z0 + 0.14, 0.05, stone), (x0 + x1) / 2, F / 2, (z0 + z1) / 2);
  }
  for (const [ax, az, bx, bz] of [[-hw, hd, -DW, hd], [DW, hd, hw, hd], [-hw, -hd, hw, -hd], [-hw, -hd, -hw, hd], [hw, -hd, hw, hd]]) {
    const len = Math.hypot(bx - ax, bz - az), along = Math.atan2(bz - az, bx - ax);
    for (let d = 0; d < len;) {
      const sw = jr(0.32, 0.52), t = Math.min(len, d + sw / 2) / len;
      const nx = ax === bx ? Math.sign(ax) * 0.08 : 0, nz = az === bz ? Math.sign(az) * 0.08 : 0;
      put(stoneL, ax + (bx - ax) * t + nx + cx, jr(0.14, 0.17), az + (bz - az) * t + nz, 0, -along, jr(-0.06, 0.06), sw, jr(0.25, 0.3), 0.24, tint(STONE_PAL));
      d += sw;
    }
  }
  at(rbox(2 * IW + 0.1, 0.05, 2 * ID + 0.1, 0.02, dirt, 1), 0, FL / 2, 0);
  at(rbox(2 * DW + 0.1, 0.06, T + 0.5, 0.02, stone, 1), 0, 0.03, hd - 0.05);                         // flat stone threshold
  // corner trim boards
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    at(rbox(0.2, H - F + 0.08, 0.05, 0.02, trim, 1), sx * (hw - 0.09), (H + F) / 2, sz * (hd + 0.07));
    at(rbox(0.2, H - F + 0.08, 0.05, 0.02, trim, 1), sx * (hw + 0.07), (H + F) / 2, sz * (hd - 0.09), 0, Math.PI / 2, 0);
  }

  // ---------------- gambrel roof: decks, slate shingles, cream rake trim, fascia, ridge (all in 'roof')
  const ZR = hd + RO;
  const llen = Math.hypot(hw - kx, H - ky), ldx = (hw - kx) / llen, ldy = (H - ky) / llen;
  const ulen = Math.hypot(kx, ry - ky), udx = kx / ulen, udy = (ky - ry) / ulen;
  for (const sx of [-1, 1]) {
    const segs = [[0, ry, sx * (kx + udx * 0.12), ky + udy * 0.12], [sx * kx, ky, sx * (hw + ldx * 0.38), H + ldy * 0.38]];
    for (const [ax, ay, bx, by] of segs) {
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      let nx = -dy / len, ny = dx / len; if (ny < 0) { nx = -nx; ny = -ny; }
      at(rbox(len + 0.04, 0.1, 2 * ZR, 0.03, darkWood, 1), (ax + bx) / 2 + nx * 0.05, (ay + by) / 2 + ny * 0.05, 0, 0, 0, ang, RF);
      slope(shL, ax, ay, bx, by, -ZR - 0.03, ZR + 0.03, { off: 0.13, pal: SLATE });
      for (const sz of [-1, 1]) at(rbox(len + 0.02, 0.26, 0.07, 0.025, trim, 1), (ax + bx) / 2 - nx * 0.05, (ay + by) / 2 - ny * 0.05, sz * (ZR + 0.02), 0, 0, ang, RF);
    }
    at(rbox(0.07, 0.22, 2 * ZR + 0.04, 0.025, trim, 1), sx * (hw + ldx * 0.38 + 0.03), H + ldy * 0.38 + 0.03, 0, 0, 0, 0, RF);       // eave fascia
    at(rbox(0.2, 0.08, 2 * ZR + 0.06, 0.03, slateDark, 1), sx * (kx + 0.05), ky + 0.17, 0, 0, 0, -sx * 0.75, RF);       // knee cap
  }
  at(rbox(0.3, 0.12, 2 * ZR + 0.1, 0.05, slateDark), 0, ry + 0.2, 0, 0, 0, 0, RF);                                                 // ridge
  for (const z of [-1.6, 0.9, 3.0]) {                                                                                               // tie beams + king posts
    at(rbox(2 * IW, 0.22, 0.2, 0.05, timber), 0, H + 0.12, z, 0, 0, 0, RF);
    at(rbox(0.18, ky - H - 0.3, 0.18, 0.04, timber, 1), 0, (ky + H) / 2, z, 0, 0, 0, RF);
    for (const s2 of [-1, 1]) at(rbox(0.14, 2.0, 0.14, 0.04, timber, 1), s2 * 1.45, H + 0.95, z, 0, 0, -s2 * 0.95, RF);
  }
  // little louvred cupola + weathervane
  {
    at(rbox(0.7, 0.62, 0.7, 0.05, trim), 0, ry + 0.12, 0, 0, 0, 0, RF);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, g = new THREE.Group(); g.rotation.y = a; RF.add(g);
      for (let j = 0; j < 3; j++) at(rbox(0.46, 0.06, 0.05, 0.015, timber, 1), 0, ry + 0.02 + j * 0.13, 0.36, -0.5, 0, 0, g);
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.42, 4), slateDark); at(cone, 0, ry + 0.64, 0, 0, Math.PI / 4, 0, RF);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5), iron), 0, ry + 1.0, 0, 0, 0, 0, RF);
    at(rbox(0.34, 0.035, 0.025, 0.01, iron, 1), 0.04, ry + 1.12, 0, 0, 0, 0, RF);
    at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), iron), 0.24, ry + 1.12, 0, 0, 0, -Math.PI / 2, RF);
  }

  // ---------------- hay bales built into stacks (fixed architecture: whole walls of bales, never a lone bale)
  const moundGeo = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const bale = (x, y, z, len, rotY = 0) => {
    const r = rotY + jr(-0.05, 0.05);
    at(rbox(len - 0.04, 0.48, 0.52, 0.09, hayM), x, y + 0.24, z, 0, r, jr(-0.02, 0.02));
    for (const d of [-0.27, 0.27]) at(rbox(0.035, 0.5, 0.54, 0.015, twine, 1), x + d * len * Math.cos(r), y + 0.24, z - d * len * Math.sin(r), 0, r, 0);
    for (let k = 0; k < 5; k++) put(strawL, x + jr(-len / 2, len / 2), y + jr(0.05, 0.5), z + jr(-0.28, 0.28), jr(0, 3), jr(0, 3), jr(0, 3), 1, 1, jr(0.6, 1.2), tint(HAY_PAL, 0.04));
  };
  // fill x0..x1 × z0..z1 with bales (lengths along X), `layers` high, upper layers ragged
  const stack = (x0, x1, z0, z1, layers, y0 = FL, ragged = 0.3) => {
    const rows = Math.max(1, Math.round((z1 - z0) / 0.55)), rd = (z1 - z0) / rows;
    for (let l = 0; l < layers; l++) for (let r = 0; r < rows; r++) {
      const off = (l + r) % 2 ? 0.5 : 0, n = Math.max(1, Math.round((x1 - x0) / 1.0 - off * 0.5)), len = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        if (l > 0 && rr() < ragged * l) continue;
        bale(x0 + (i + 0.5) * len + (l === 0 ? 0 : jr(-0.06, 0.06)), y0 + l * 0.48, z0 + (r + 0.5) * rd, len);
      }
    }
  };
  const mound = (x, y, z, sx, sy, sz, P = B) => {
    at(new THREE.Mesh(moundGeo, hayM), x, y - 0.02, z, 0, jr(-0.08, 0.08), 0, P).scale.set(sx, sy, sz);   // unrotated, so long mounds stay off the walls
    const n = Math.round(sx * sz * 26);
    for (let k = 0; k < n; k++) {
      const th = jr(0, Math.PI * 2), ph = jr(0.15, 1.45);
      put(strawL, x + Math.cos(th) * Math.sin(ph) * sx, y + Math.cos(ph) * sy, z + Math.sin(th) * Math.sin(ph) * sz, jr(0, 3), jr(0, 3), jr(0, 3), 1, 1, jr(0.7, 1.4), tint(HAY_PAL, 0.04));
    }
  };

  // ---------------- interior timber frame: posts on the walls, knee braces high up, lanterns
  {
    const posts = [];
    for (const z of [-ID + 0.1, -1.6, 0.9, 3.0, ID - 0.1]) for (const sx of [-1, 1]) posts.push([sx * (IW - 0.1), z]);
    for (const x of [-DW - 0.12, DW + 0.12, -IW + 0.1, IW - 0.1]) posts.push([x, ID - 0.1]);
    for (const [x, z] of posts) at(rbox(0.2, H - FL, 0.2, 0.04, timber, 1), x, (H + FL) / 2, z, 0, 0, jr(-0.01, 0.01));
    for (const z of [-1.6, 0.9, 3.0]) for (const sx of [-1, 1]) at(rbox(0.12, 0.95, 0.12, 0.03, timber, 1), sx * (IW - 0.42), H - 0.42, z, 0, 0, sx * 0.75);
    for (const sx of [-1, 1]) at(rbox(0.16, 0.2, 2 * ID, 0.04, timber, 1), sx * (IW - 0.06), H - 0.12, 0);
  }
  const lantern = (x, y, z, ryy = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ryy; B.add(g);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 12, Math.PI / 2), iron), 0, 0.07, 0, 0, Math.PI / 2, 0, g);
    at(rbox(0.2, 0.26, 0.2, 0.03, glowIn, 1), 0, -0.07, 0.15, 0, 0, 0, g);
    at(rbox(0.25, 0.05, 0.25, 0.02, iron, 1), 0, 0.08, 0.15, 0, 0, 0, g);
    at(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.14, 4), iron), 0, 0.17, 0.15, 0, Math.PI / 4, 0, g);
  };
  lantern(-IW, 2.45, 1.45, Math.PI / 2); lantern(IW, 2.45, 1.5, -Math.PI / 2); lantern(-IW, 2.45, -0.7, Math.PI / 2); lantern(IW, 2.45, -0.15, -Math.PI / 2);

  // ---------------- side windows: glass + cream frame outside, warm glass + timber reveal inside
  const windowUnit = (x, y, z, w, h, rotY, P = B) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; P.add(g);
    at(rbox(w, h, 0.05, 0.015, glass, 1), 0, 0, 0, 0, 0, 0, g);
    for (const sy of [-1, 1]) at(rbox(w + 0.2, 0.1, 0.09, 0.025, trim, 1), 0, sy * (h / 2 + 0.05), 0.03, 0, 0, 0, g);
    for (const sx of [-1, 1]) at(rbox(0.1, h, 0.09, 0.025, trim, 1), sx * (w / 2 + 0.05), 0, 0.03, 0, 0, 0, g);
    at(rbox(0.045, h, 0.06, 0.012, trim, 1), 0, 0, 0.04, 0, 0, 0, g);
    at(rbox(w, 0.045, 0.06, 0.012, trim, 1), 0, 0, 0.04, 0, 0, 0, g);
    at(rbox(w + 0.32, 0.08, 0.2, 0.025, trim, 1), 0, -h / 2 - 0.12, 0.08, 0, 0, 0, g);
    return g;
  };
  const innerWindow = (x, y, z, w, h, rotY) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; B.add(g);
    at(rbox(w + 0.1, h + 0.1, 0.04, 0.01, glassIn, 1), 0, 0, 0.08, 0, 0, 0, g);
    for (const sx of [-1, 1]) at(rbox(0.08, h + 0.2, T + 0.04, 0.02, timber, 1), sx * (w / 2 + 0.08), 0, T / 2, 0, 0, 0, g);
    for (const sy of [-1, 1]) at(rbox(w + 0.3, 0.08, T + 0.06, 0.02, timber, 1), 0, sy * (h / 2 + 0.08), T / 2, 0, 0, 0, g);
    at(rbox(0.05, h, 0.04, 0.01, timber, 1), 0, 0, 0.11, 0, 0, 0, g);
    at(rbox(w, 0.05, 0.04, 0.01, timber, 1), 0, 0, 0.11, 0, 0, 0, g);
  };
  for (const z of WIN_L) { windowUnit(-hw - 0.06, WY, z, WWD, WH, -Math.PI / 2); innerWindow(-hw + 0.04, WY, z, WWD - 0.02, WH - 0.02, Math.PI / 2); }
  for (const z of WIN_R) innerWindow(hw - 0.04, WY, z, WWD - 0.02, WH - 0.02, -Math.PI / 2);
  windowUnit(0, 4.98, -hd - 0.06, 0.62, 0.62, Math.PI, RF);

  // ---------------- open double doors (X-braced, cream frame), doorway trim, hayloft shutters
  const leaf = (w, h, hingeX, dir, y0, z, ang, P = B) => {
    const g = new THREE.Group(); g.position.set(hingeX, y0, z); g.rotation.y = ang; P.add(g);
    const n = Math.max(2, Math.round(w / 0.26));
    for (let i = 0; i < n; i++) at(rbox(w / n - 0.012, h, 0.06, 0.012, i % 2 ? red2 : red, 1), dir * (w / n) * (i + 0.5), h / 2, 0, 0, 0, 0, g);
    const fw = Math.min(0.13, w * 0.12), pw = w - 2 * fw, ph = h / 2 - fw * 1.5, L = Math.hypot(pw, ph), a = Math.atan2(ph, pw);
    for (const fz of [0.045, -0.045]) {
      for (const y of [fw / 2, h / 2, h - fw / 2]) at(rbox(w, fw, 0.035, 0.012, trim, 1), dir * w / 2, y, fz, 0, 0, 0, g);
      for (const x of [fw / 2, w - fw / 2]) at(rbox(fw, h, 0.035, 0.012, trim, 1), dir * x, h / 2, fz, 0, 0, 0, g);
      for (const py of [h / 4 + fw * 0.25, h * 0.75 - fw * 0.25]) for (const s2 of [1, -1]) at(rbox(L, fw * 0.75, 0.03, 0.01, trim, 1), dir * w / 2, py, fz * 1.15, 0, 0, s2 * a, g);
    }
    for (const y of [h * 0.18, h * 0.82]) at(rbox(w * 0.32, 0.06, 0.08, 0.015, iron, 1), dir * w * 0.16, y, 0, 0, 0, 0, g);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 14), iron), dir * (w - 0.25), h * 0.45, 0.07, 0, 0, 0, g);
    return g;
  };
  const DANG = 2.5, DLH = DH - FL - 0.02;
  leaf(DW, DLH, -DW, 1, FL + 0.01, hd + 0.08, -DANG);
  leaf(DW, DLH, DW, -1, FL + 0.01, hd + 0.08, DANG);
  for (const sx of [-1, 1]) at(rbox(0.17, DH - FL + 0.12, T + 0.14, 0.03, trim, 1), sx * (DW + 0.085), (FL + DH) / 2 + 0.03, hd - T / 2 + 0.05);
  at(rbox(2 * DW + 0.5, 0.22, T + 0.16, 0.04, trim), 0, DH + 0.1, hd - T / 2 + 0.06);
  for (const sx of [-1, 1]) at(rbox(0.14, LY1 - LY0 + 0.24, 0.09, 0.03, trim, 1), sx * (LW + 0.07), (LY0 + LY1) / 2, hd + 0.07, 0, 0, 0, RF);
  at(rbox(2 * LW + 0.4, 0.16, 0.12, 0.04, trim, 1), 0, LY0 - 0.06, hd + 0.08, 0, 0, 0, RF);
  at(rbox(2 * LW + 0.4, 0.16, 0.1, 0.04, trim, 1), 0, LY1 + 0.08, hd + 0.08, 0, 0, 0, RF);
  leaf(LW, LY1 - LY0 - 0.02, -LW, 1, LY0 + 0.01, hd + 0.08, -2.5, RF);
  leaf(LW, LY1 - LY0 - 0.02, LW, -1, LY0 + 0.01, hd + 0.08, 2.5, RF);
  at(rbox(1.6, 0.12, 0.9, 0.03, darkWood, 1), 0, LY0 - 0.07, hd - 0.5, 0, 0, 0, RF);                 // hayloft landing + hay in the opening
  mound(0, LY0, hd - 0.45, 0.62, 0.5, 0.42, RF);

  // ---------------- hay hood over the loft door: small gable roof, hay beam, pulley and rope (in 'roof')
  {
    const hz0 = hd - 0.05, hz1 = hd + 0.95, hY = ry - 0.35, hX = 0.95, hE = hY - 0.45, BY = LY1 + 0.35;
    for (const sx of [-1, 1]) {
      const dx = sx * hX, dy = hE - hY, len = Math.hypot(dx, dy) + 0.08, ang = Math.atan2(dy, dx);
      at(rbox(len, 0.08, hz1 - hz0, 0.03, darkWood, 1), dx / 2, hY + dy / 2 + 0.04, (hz0 + hz1) / 2, 0, 0, ang, RF);
      slope(shL, 0, hY + 0.02, sx * (hX + 0.1), hE - 0.03, hz0, hz1 + 0.06, { off: 0.1, pal: SLATE, len: 0.36, w: 0.3, step: 0.2 });
      at(rbox(len, 0.18, 0.06, 0.02, trim, 1), dx / 2, hY + dy / 2 - 0.06, hz1 + 0.05, 0, 0, ang, RF);
    }
    at(rbox(0.16, 0.08, hz1 - hz0 + 0.1, 0.03, slateDark, 1), 0, hY + 0.13, (hz0 + hz1) / 2, 0, 0, 0, RF);
    at(rbox(0.18, 0.2, 1.3, 0.04, timber), 0, BY, hd + 0.5, 0, 0, 0, RF);
    at(rbox(0.12, 0.62, 0.12, 0.03, timber, 1), 0, BY - 0.28, hd + 0.25, 0.75, 0, 0, RF);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 14), iron), 0, BY - 0.22, hd + 0.98, 0, Math.PI / 2, 0, RF);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.1, 5), rope), 0, BY - 0.85, hd + 1.08, 0, 0, 0, RF);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 5, 10, Math.PI * 1.4), iron), 0, BY - 1.45, hd + 1.08, 0, Math.PI / 2, 2.2, RF);
  }

  // ---------------- wall lantern by the doors (fixed, glowing)
  {
    const lx = DW + 0.62, ly = 2.55, lzz = hd + 0.05;
    at(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14, Math.PI / 2), iron), lx - 0.02, ly + 0.08, lzz + 0.12, 0, Math.PI / 2, 0);
    at(rbox(0.22, 0.3, 0.22, 0.03, glow), lx + 0.02, ly - 0.08, lzz + 0.28);
    at(rbox(0.28, 0.05, 0.28, 0.02, iron), lx + 0.02, ly + 0.09, lzz + 0.28);
    at(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 4), iron), lx + 0.02, ly + 0.19, lzz + 0.28, 0, Math.PI / 4, 0);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffb45a, 1.2, 4, 2); pl.position.set(lx + 0.02, ly - 0.1, lzz + 0.45); B.add(pl); }
  }

  // ================= THRESHING FLOOR (front) =================
  // ---------------- two empty stalls along the left wall: plank partitions, posts, half gates, hay racks, straw bedding
  {
    for (const z of SZ) {
      const x0 = -IW, x1 = STX, len = x1 - x0;
      for (const y of [0.3, 0.62, 0.94]) at(rbox(len, 0.26, 0.07, 0.02, timber, 1), (x0 + x1) / 2, y, z, 0, 0, jr(-0.01, 0.01));
      at(rbox(len + 0.1, 0.1, 0.12, 0.03, timber, 1), (x0 + x1) / 2, 1.22, z);
      at(rbox(0.16, 1.6, 0.16, 0.04, timber, 1), x1, 0.8, z);
      at(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), timber), x1, 1.64, z);
    }
    for (let i = 0; i < SZ.length - 1; i++) {
      const z0 = SZ[i] + 0.08, gw = 0.72;
      for (const y of [0.35, 0.95]) at(rbox(0.07, 0.12, gw, 0.02, timber, 1), STX, y, z0 + gw / 2);
      for (const k of [0.1, 0.36, 0.62]) at(rbox(0.06, 0.72, 0.1, 0.02, timber, 1), STX, 0.65, z0 + k + 0.05);
      at(rbox(0.05, 0.9, 0.09, 0.02, timber, 1), STX, 0.65, z0 + gw / 2, Math.atan2(gw, 0.6) - Math.PI / 2 + 0.85, 0, 0);
      for (const y of [0.4, 0.9]) at(rbox(0.06, 0.05, 0.1, 0.01, iron, 1), STX, y, z0 + 0.03);
      // slatted hay rack on the wall above, and straw bedding on the floor
      const zc = (SZ[i] + SZ[i + 1]) / 2;
      at(rbox(0.07, 0.07, 1.3, 0.02, timber, 1), -IW + 0.45, 1.95, zc);
      for (let k = 0; k < 7; k++) at(rbox(0.04, 0.7, 0.04, 0.01, timber, 1), -IW + 0.27, 1.62, zc - 0.6 + k * 0.2, 0, 0, -0.45);
      at(new THREE.Mesh(moundGeo, hayM), -IW + 0.14, 1.32, zc).scale.set(0.16, 0.55, 0.62);
      at(new THREE.Mesh(moundGeo, hayM), (STX - IW) / 2, FL, zc).scale.set(0.75, 0.06, 0.7);
      for (let k = 0; k < 40; k++) put(strawL, jr(-IW + 0.1, STX - 0.1), FL + 0.02, jr(SZ[i] + 0.1, SZ[i + 1] - 0.1), jr(-0.2, 0.2), jr(0, 6), 0, 1, 1, jr(0.8, 1.3), tint(HAY_PAL, 0.04));
    }
  }
  // ---------------- tool rack on the right wall: rail with pegs, pitchfork, rake, shovel, coiled rope; harness pegs + horseshoes
  {
    const x = IW - 0.05, z0 = 2.3;
    at(rbox(0.08, 0.14, 1.5, 0.03, timber, 1), x, 2.05, z0 + 0.6);
    const tool = (z, kind) => {
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.45, 6), timber), x - 0.1, 1.35, z, 0.0, 0, 0);
      if (kind === 0) for (const k of [-1, 0, 1]) at(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.006, 0.34, 4), iron), x - 0.1, 0.5, z + k * 0.06);
      if (kind === 1) { at(rbox(0.04, 0.05, 0.4, 0.01, iron, 1), x - 0.1, 0.62, z); for (let k = -3; k <= 3; k++) at(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 4), iron), x - 0.1, 0.56, z + k * 0.06); }
      if (kind === 2) at(rbox(0.03, 0.32, 0.24, 0.02, iron, 1), x - 0.1, 0.5, z);
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 5), timber), x - 0.05, 2.05, z, 0, 0, Math.PI / 2);
    };
    tool(z0 + 0.05, 0); tool(z0 + 0.35, 1); tool(z0 + 0.65, 0); tool(z0 + 0.95, 2);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 16), rope), x - 0.06, 1.75, z0 + 1.28, 0, Math.PI / 2, 0);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 16), rope), x - 0.08, 1.72, z0 + 1.3, 0, Math.PI / 2, 0.4);
    for (const z of [0.2, 0.5]) at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 5, 10, Math.PI * 1.6), iron), x - 0.03, 2.3, z, 0, Math.PI / 2, Math.PI * 1.3);
  }
  // ---------------- divider: low walls of stacked bales between the threshing floor and the hay floor (gap in the middle)
  stack(-IW, -GAP, DZ0, DZ1, 2, FL, 0.15);
  stack(GAP, IW, DZ0, DZ1, 2, FL, 0.35);
  mound(-GAP - 0.2, FL, DZ0 - 0.1, 0.5, 0.25, 0.3); mound(GAP + 0.3, FL, DZ1 + 0.1, 0.45, 0.2, 0.25);

  // ================= HAY FLOOR (back, stands in for the hay loft) =================
  // ---------------- narrow loft deck along the back wall (decoration only), on posts, railing, hay piled on it, ladder up
  const DPX = [-1.4, 1.5];
  {
    const dz0 = -ID, dzc = (dz0 + DECK) / 2, dd = DECK - dz0;
    at(rbox(2 * IW, 0.12, dd, 0.03, darkWood, 1), 0, DECKY, dzc);
    at(rbox(2 * IW, 0.22, 0.18, 0.04, timber), 0, DECKY - 0.14, DECK);
    for (let x = -IW + 0.6; x < IW; x += 1.0) at(rbox(0.1, 0.14, dd, 0.03, timber, 1), x, DECKY - 0.12, dzc);
    for (const px of DPX) {
      at(rbox(0.2, DECKY - FL, 0.2, 0.04, timber), px, (DECKY + FL) / 2, DECK);
      for (const s2 of [-1, 1]) at(rbox(0.1, 0.7, 0.1, 0.03, timber, 1), px + s2 * 0.26, DECKY - 0.42, DECK, 0, 0, -s2 * 0.75);
    }
    for (let x = -IW + 0.05; x <= IW; x += 0.95) at(rbox(0.09, 0.85, 0.09, 0.02, timber, 1), x, DECKY + 0.48, DECK + 0.02);
    for (const y of [0.45, 0.85]) at(rbox(2 * IW, 0.08, 0.07, 0.02, timber, 1), 0, DECKY + y, DECK + 0.02);
    stack(-IW + 0.1, -0.6, dz0 + 0.05, DECK - 0.2, 2, DECKY + 0.06, 0.4);
    mound(1.3, DECKY + 0.06, (dz0 + DECK) / 2, 1.3, 0.75, 0.45);
    // ladder from the hay floor up to the deck edge
    const lx = 2.15, z0 = -2.3, z1 = DECK + 0.05, y1 = DECKY + 0.75, L = Math.hypot(z0 - z1, y1 - FL), tilt = -Math.atan2(z0 - z1, y1 - FL);
    for (const s2 of [-1, 1]) at(rbox(0.07, L, 0.07, 0.02, timber, 1), lx + s2 * 0.24, (FL + y1) / 2, (z0 + z1) / 2, tilt, 0, 0);
    for (let j = 1; j < 12; j++) { const t = j / 12; at(rbox(0.52, 0.05, 0.05, 0.015, timber, 1), lx, FL + (y1 - FL) * t, z0 + (z1 - z0) * t); }
    // tack-room door on the back wall (closed), horseshoe over it
    const tx = 3.0;
    for (let k = 0; k < 4; k++) at(rbox(0.22, 2.1, 0.05, 0.01, k % 2 ? darkWood : timber, 1), tx - 0.33 + k * 0.22, FL + 1.05, -ID + 0.04);
    for (const y of [0.4, 1.7]) at(rbox(0.9, 0.12, 0.04, 0.015, timber, 1), tx, FL + y, -ID + 0.08);
    for (const s2 of [-1, 1]) at(rbox(0.12, 2.3, 0.12, 0.03, timber, 1), tx + s2 * 0.52, FL + 1.15, -ID + 0.06);
    at(rbox(1.2, 0.14, 0.14, 0.03, timber, 1), tx, FL + 2.28, -ID + 0.06);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 5, 10, Math.PI * 1.5), iron), tx, FL + 2.5, -ID + 0.05, 0, 0, -Math.PI * 0.25);
    lantern(tx - 0.75, 2.1, -ID, 0);
  }
  // ---------------- great hay stacks under the deck, loose hay mounds, strewn straw everywhere
  stack(-IW + 0.05, 1.25, -ID + 0.02, DECK - 0.05, 3, FL, 0.25);
  mound(-2.6, FL, DECK + 0.05, 1.3, 0.2, 0.5); mound(0.3, FL, DECK + 0.1, 1.0, 0.16, 0.4);
  for (let k = 0; k < 160; k++) put(strawL, jr(-IW + 0.2, IW - 0.2), FL + 0.02, jr(-ID + 0.9, hd + 0.6), jr(-0.2, 0.2), jr(0, 6), 0, 1, 1, jr(0.8, 1.3), tint(HAY_PAL, 0.04));

  // ---------------- lean-to on the right: posts, shingle roof, boarded back, built-in manger & hay rack
  {
    const lx0 = hw + 0.04, lx1 = hw + 1.75, lz0 = -hd + 0.4, lz1 = hd - 0.8, lyT = H - 0.25, lyL = 2.45, lxe = lx1 + 0.35, mid = (lz0 + lz1) / 2;
    const ly = (x) => lyT + (x - lx0) / (lxe - lx0) * (lyL - lyT);
    const px = lx1 - 0.1, ph = ly(px) - 0.12;
    [lz0 + 0.1, mid, lz1 - 0.1].forEach((z, i) => {
      at(rbox(0.18, ph, 0.18, 0.04, timber), px, ph / 2, z);
      at(rbox(0.34, 0.1, 0.34, 0.04, stone, 1), px, 0.05, z);
      for (const s2 of i === 0 ? [1] : i === 2 ? [-1] : [-1, 1]) at(rbox(0.1, 0.66, 0.1, 0.03, timber, 1), px, ph - 0.36, z + s2 * 0.22, s2 * 0.75, 0, 0);
    });
    at(rbox(0.2, 0.22, lz1 - lz0 + 0.3, 0.04, timber), px, ph - 0.02, mid);
    at(rbox(0.16, 0.2, lz1 - lz0 + 0.3, 0.04, timber), lx0 + 0.08, lyT - 0.14, mid);
    const dx = lxe - lx0, dy = lyL - lyT, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), nx = -dy / len, ny = dx / len;
    at(rbox(len, 0.08, lz1 - lz0 + 0.5, 0.03, darkWood, 1), (lx0 + lxe) / 2 + nx * 0.04, (lyT + lyL) / 2 + ny * 0.04, mid, 0, 0, ang);
    for (let k = 0; k < 7; k++) at(rbox(len, 0.12, 0.08, 0.02, timber, 1), (lx0 + lxe) / 2 - nx * 0.06, (lyT + lyL) / 2 - ny * 0.06, lz0 + 0.05 + k * (lz1 - lz0 - 0.1) / 6, 0, 0, ang);
    slope(shL2, lx0 - 0.04, lyT + 0.02, lxe, lyL, lz0 - 0.25, lz1 + 0.25, { off: 0.12, pal: SLATE });
    at(rbox(0.07, 0.2, lz1 - lz0 + 0.5, 0.025, trim, 1), lxe + 0.03, lyL - 0.02, mid);
    for (let x = lx0 + 0.02, i = 0; x < lx1 + 0.05; x += 0.29, i++) {
      const h = ly(x + 0.145) - 0.04;
      at(rbox(0.278, h, 0.07, 0.015, i % 3 === 1 ? red2 : red, 1), x + 0.145, h / 2, lz0);
    }
    // manger + slatted hay rack against the barn wall, hay in both
    at(rbox(0.5, 0.3, 3.2, 0.05, timber), lx0 + 0.35, 0.62, 0.2);
    for (const z of [-1.3, 1.7]) for (const xo of [0.15, 0.55]) at(rbox(0.09, 0.48, 0.09, 0.02, timber, 1), lx0 + xo, 0.24, z);
    const mg = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    at(new THREE.Mesh(mg, hayM), lx0 + 0.35, 0.72, 0.2).scale.set(0.2, 0.14, 1.5);
    for (let k = 0; k < 9; k++) at(rbox(0.05, 0.85, 0.05, 0.015, timber, 1), lx0 + 0.27, 1.38, -1.3 + k * 0.375, 0, 0, -0.42);
    at(rbox(0.07, 0.07, 3.2, 0.02, timber, 1), lx0 + 0.46, 1.76, 0.2);
    at(new THREE.Mesh(mg, hayM), lx0 + 0.12, 1.02, 0.2).scale.set(0.28, 0.62, 1.45);
  }

  // ---------------- greenery: ivy on the front corner and door, hollyhocks, a bush (plants are fine in-game)
  {
    const vine = (x, y, top, z, dx) => {
      while (y < top) {
        x += jr(-0.1, 0.1) + dx; y += jr(0.05, 0.12);
        for (let k = 0; k < 3; k++) leaves.push([x + jr(-0.14, 0.14), y + jr(-0.08, 0.08), z + jr(0, 0.05)]);
      }
      for (let k = 0; k < 14; k++) leaves.push([x + jr(-0.7, 0.7), top + jr(-0.12, 0.08), z + jr(0, 0.05)]);
    };
    vine(hw - 0.3, F, H - 0.1, hd + 0.09, -0.01);
    vine(hw - 0.7, F, 2.6, hd + 0.09, 0.0);
    vine(DW + 0.3, DH, DH + 0.9, hd + 0.13, 0.02);
    vine(-hw + 0.25, F, 2.4, hd + 0.09, 0.01);
    for (const [hx, hz] of [[-hw + 0.55, hd + 0.3], [-hw + 0.25, hd + 0.45], [-hw + 0.8, hd + 0.5], [-hw + 0.05, hd + 0.62]]) {
      const ht = jr(1.6, 2.2), lean = jr(-0.08, 0.08);
      for (let y = 0.1; y < 0.9; y += 0.12) for (let k = 0; k < 3; k++) leaves.push([hx + jr(-0.22, 0.22), y, hz + jr(-0.2, 0.2), 1.4]);
      const pc = [0xf28fb3, 0xf7b4c8, 0xe86a96, 0xfff0f4][Math.floor(rr() * 4)];
      for (let y = 0.9; y < ht; y += 0.08) {
        const t = (y - 0.9) / (ht - 0.9);
        for (let k = 0; k < 3; k++) blossoms.push([hx + lean * y + jr(-0.1, 0.1) * (1 - t * 0.6), y, hz + jr(-0.1, 0.1) * (1 - t * 0.6), pc, 1.3 - t * 0.6]);
      }
    }
    for (let k = 0; k < 50; k++) leaves.push([-hw - 0.25 + jr(-0.3, 0.3), jr(0.1, 0.85), hd - 0.6 + jr(-0.6, 0.6), 1.3]);
    for (let k = 0; k < 6; k++) { const bx = -hw - 0.25 + jr(-0.25, 0.25), by = jr(0.6, 0.95), bz = hd - 0.6 + jr(-0.5, 0.5); for (let q = 0; q < 8; q++) blossoms.push([bx + jr(-0.1, 0.1), by + jr(-0.08, 0.08), bz + jr(-0.1, 0.1), 0xfff8ea, 1]); }
  }

  // ---------------- garden-only decor (in-game these would look like hideable props)
  if (garden) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.05, 22), hayM);
    at(roll, hw + 1.1, 0.72, hd + 1.3, Math.PI / 2, 0.3, 0);
    for (const [bx, by, bz, ry2] of [[hw + 0.7, 0.23, 2.2, 0.1], [hw + 0.75, 0.68, 2.15, -0.08], [hw + 0.75, 0.23, 1.55, 0.05]]) {
      at(rbox(0.95, 0.44, 0.55, 0.08, hayM), bx, by, bz, 0, Math.PI / 2 + ry2, 0);
    }
    const can = new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.21, 0.45], [0.13, 0.6], [0.11, 0.7], [0.14, 0.72], [0, 0.74]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
    const canM = M(0xe8eef2, tex('painted_metal', 0.5, 0.5));
    for (const [mx, mz] of [[-hw - 0.4, hd + 1.0], [-hw - 0.85, hd + 0.75], [2.22, 3.52], [3.0, 3.52]]) at(new THREE.Mesh(can, canM), mx, mx > 0 ? FL : 0, mz);
  }

  // ---------------- instanced batches (roof shingles live in 'roof')
  inst(shingleGeo(THREE), shMat, shL, RF);
  inst(shingleGeo(THREE), shMat, shL2, B);                                        // lean-to roof is not over the interior
  inst(stoneGeo(THREE, 3), stoneI, stoneL, root);
  const straw = new THREE.BoxGeometry(0.014, 0.014, 0.26);
  inst(straw, M(0xffffff, null, { roughness: 0.9 }), strawL, B);
  {
    const lv = [], bl = [], gc = GREENS.map((h) => new THREE.Color(h));
    for (const [x, y, z, s2 = 1] of leaves) put(lv, x, y, z, jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28), jr(0.7, 1.25) * s2, undefined, undefined, gc[Math.floor(rr() * gc.length)].clone().offsetHSL(0, 0, jr(-0.05, 0.06)));
    for (const [x, y, z, c, s2 = 1] of blossoms) put(bl, x, y, z, jr(0, 6), jr(0, 6), 0, jr(0.8, 1.2) * s2, undefined, undefined, c);
    inst(leafGeo(THREE), leafMat(M, THREE), lv, B);
    inst(new THREE.IcosahedronGeometry(0.06, 0), M(0xffffff, null, { roughness: 0.8 }), bl, B);
  }

  // ---------------- gameplay data (root-local coords: the body sits at x = cx)
  const box = (x0, z0, x1, z1, rot) => ({ x: cx + (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), ...(rot ? { rot } : {}) });
  const leafBox = (hingeX, dir, ang) => ({ x: cx + hingeX + dir * (DW / 2) * Math.cos(ang), z: hd + 0.08 - dir * (DW / 2) * Math.sin(ang), w: DW, d: 0.16, rot: ang });
  root.userData.rooms = [
    { name: 'threshing floor', ...box(-IW, DZ1, IW, ID) },
    { name: 'hay floor', ...box(-IW, -ID, IW, DZ1) },
  ];
  root.userData.colliders = [
    box(-hw, ID, -DW, hd), box(DW, ID, hw, hd), box(-hw, -hd, hw, -ID), box(-hw, -hd, -IW, hd), box(IW, -hd, hw, hd),
    leafBox(-DW, 1, -DANG), leafBox(DW, -1, DANG),
    ...SZ.map((z) => box(-IW, z - 0.06, STX + 0.08, z + 0.06)),                      // stall partitions
    ...SZ.slice(0, -1).map((z) => box(STX - 0.06, z, STX + 0.06, z + 0.85)),        // half gates
    box(-IW, DZ0, -GAP, DZ1), box(GAP, DZ0, IW, DZ1),                                 // bale divider
    box(-IW, -ID, 1.25, DECK - 0.05),                                                 // hay stacks under the deck
    ...DPX.map((px) => box(px - 0.12, DECK - 0.12, px + 0.12, DECK + 0.12)),          // deck posts
    box(1.85, DECK, 2.45, -2.25),                                                     // ladder
    box(hw + 0.04, -1.45, hw + 0.66, 1.85),                                           // lean-to manger
    ...[-hd + 0.5, (-hd + 0.4 + hd - 0.8) / 2, hd - 0.9].map((z) => box(hw + 1.55, z - 0.12, hw + 1.75, z + 0.12)),   // lean-to posts
  ];
  const S = (id, x, z, rot) => ({ id, x: cx + x, z, rot });
  root.userData.propSlots = [
    // threshing floor: troughs in the stalls, saddles + milk cans in the tool corner
    S('feed_trough', -3.2, 1.375, Math.PI / 2), S('feed_trough', -3.2, 3.025, Math.PI / 2),
    S('saddle', 3.15, 0.95, -Math.PI / 2), S('saddle', 3.15, 1.92, -Math.PI / 2),
    S('milk_can', 2.22, 3.52, 0.2), S('milk_can', 3.05, 3.55, 1.1), S('milk_can', 3.18, 2.8, 2.3),
    // hay floor: bales in front of the great stacks, round rolls by the left wall, grain sacks by the right wall
    S('hay_bale', -2.6, -2.3, 0.05), S('hay_bale', -1.45, -2.3, -0.08), S('hay_bale', -0.3, -2.3, 0.1),
    S('hay_round', -3.2, -1.25, Math.PI / 2), S('hay_round', -1.95, -0.95, 0.3),
    S('grain_sack', 3.2, -1.5, 0.4), S('grain_sack', 3.2, -0.5, -0.3),
  ];
  root.userData.footprint = { w: 2 * hw + 2.3, d: 2 * hd + 0.8 };
  root.userData.door = { x: cx, z: hd + 1.2 };
  root.userData.doorIn = { x: cx, z: ID - 0.7 };
  root.userData.innerDoors = [{ x: cx, z: (DZ0 + DZ1) / 2 }];
  return K.finish([RF]);
}

// ============================================================ WINDMILL
export function windmill(THREE, opts = {}) {
  const K = kit(THREE, opts, 'windmill', 2);
  const { root, M, add, rbox, jr, rr, tex, put, inst, basis, tint } = K;
  const R0 = 2.0, R1 = 1.45, Y0 = 0.35, TH = 7.2, CB = TH + 0.25;     // tower radius base/top, plinth top, tower top, cap base
  const rad = (y) => R0 + (R1 - R0) * (y - Y0) / (TH - Y0), lean = Math.atan2(R0 - R1, TH - Y0);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const stone = M(0xeee6d8, tex('stone', 0.7, 0.7));
  const mortar = M(0xcdbfa8, tex('stone', 1.2, 1.2));
  const stoneI = M(0xffffff, tex('plaster', 0.6, 0.6));
  const timber = M(0xb4824f, tex('wood_light', 0.6, 0.6));
  const capWood = M(0xc59468, tex('wood_light', 0.8, 0.8));
  const doorWood = M(0xd9944e, tex('wood_light', 0.9, 0.9));
  const iron = M(0x3b3530, null, { roughness: 0.7 });
  const glass = M(0x4d6b7a, null, { roughness: 0.3 });
  const sailWood = M(0xe8dccc, tex('wood_light', 0.5, 0.5));
  const cloth = M(0xfffaf0, tex('plaster', 0.7, 0.7), { side: THREE.DoubleSide });
  const stones = [], shL = [], leaves = [], blossoms = [];

  // ---------------- base: stone plinth, rim stones, front step
  add(new THREE.Mesh(new THREE.CylinderGeometry(R0 + 0.38, R0 + 0.46, Y0, 32), stone), 0, Y0 / 2, 0);
  for (let i = 0; i < 30; i++) { const a = (i + jr(-0.1, 0.1)) / 30 * Math.PI * 2, r = R0 + 0.36; put(stones, r * Math.sin(a), Y0 - 0.02, r * Math.cos(a), 0, a, jr(-0.05, 0.05), 0.5, jr(0.16, 0.2), 0.32, tint(STONE_PAL)); }
  add(rbox(1.5, 0.2, 0.55, 0.06, stone), 0, 0.1, R0 + 0.66);
  // ---------------- tower: mortar core + courses of individual stones (gaps left for the door and windows)
  add(new THREE.Mesh(new THREE.CylinderGeometry(R1 - 0.09, R0 - 0.09, TH - Y0, 28), mortar), 0, (TH + Y0) / 2, 0);
  const wins = [[0, 4.7], [1.65, 3.0], [-1.85, 5.5], [Math.PI - 0.4, 3.9]];
  const doorTop = Y0 + 1.6 + 0.475 + 0.3;
  for (let y = Y0 + 0.16, ring = 0; y < TH - 0.1; y += 0.3, ring++) {
    const r = rad(y), n = Math.round(2 * Math.PI * r / 0.52), sw = 2 * Math.PI * r / n;
    for (let i = 0; i < n; i++) {
      const a = (i + (ring % 2) * 0.5 + jr(-0.07, 0.07)) / n * Math.PI * 2, aw = wrap(a);
      if (Math.abs(aw) < 0.37 && y < doorTop) continue;
      if (wins.some(([wa, wy]) => Math.abs(wrap(aw - wa)) < 0.2 && Math.abs(y - wy) < 0.48)) continue;
      put(stones, r * Math.sin(a), y + jr(-0.015, 0.015), r * Math.cos(a), -lean, a, jr(-0.05, 0.05), sw * jr(0.95, 1.1), jr(0.27, 0.32), jr(0.22, 0.28), tint(STONE_PAL), 'YXZ');
    }
  }
  // ---------------- arched plank door with stone voussoirs + jambs
  {
    const ym = Y0 + 1.1, g = new THREE.Group(); g.position.set(0, ym, rad(ym) - 0.02); g.rotation.x = -lean; root.add(g);
    const r = 0.475, sh = 1.6, y0 = Y0 - ym;
    const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, sh); s.absarc(0, sh, r, 0, Math.PI, false); s.lineTo(-r, 0);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }), doorWood), 0, y0, -0.1, 0, 0, 0, g);
    for (let k = -2; k <= 2; k++) add(rbox(0.025, sh + r * 0.8, 0.02, 0.008, M(0x6e4223, null), 1), k * 0.18, y0 + (sh + r * 0.8) / 2, 0.0, 0, 0, 0, g);
    for (const y of [0.5, 1.35]) add(rbox(0.9, 0.07, 0.03, 0.015, iron, 1), 0, y0 + y, 0.01, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.016, 6, 14), iron), 0.26, y0 + 1.0, 0.03, 0, 0, 0, g);
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; add(rbox(0.26, 0.24, 0.3, 0.07, stone), Math.cos(a) * (r + 0.17), y0 + sh + Math.sin(a) * (r + 0.17), 0.0, 0, 0, a - Math.PI / 2, g); }
    for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) { const wide = j % 2 === 0; add(rbox(wide ? 0.34 : 0.25, 0.37, 0.3, 0.07, stone), sx * (r + (wide ? 0.2 : 0.16)), y0 + 0.2 + j * 0.39, 0.0, 0, 0, 0, g); }
  }
  // ---------------- little windows with timber frames, stone lintels and sills
  for (const [wa, wy] of wins) {
    const g0 = new THREE.Group(); g0.rotation.y = wa; root.add(g0);
    const g = new THREE.Group(); g.position.set(0, wy, rad(wy) - 0.03); g.rotation.x = -lean; g0.add(g);
    add(rbox(0.4, 0.56, 0.05, 0.015, glass, 1), 0, 0, -0.04, 0, 0, 0, g);
    for (const sy of [-1, 1]) add(rbox(0.6, 0.1, 0.12, 0.03, timber, 1), 0, sy * 0.32, 0, 0, 0, 0, g);
    for (const sx of [-1, 1]) add(rbox(0.1, 0.56, 0.12, 0.03, timber, 1), sx * 0.25, 0, 0, 0, 0, 0, g);
    add(rbox(0.04, 0.56, 0.06, 0.012, timber, 1), 0, 0, 0.0, 0, 0, 0, g);
    add(rbox(0.4, 0.04, 0.06, 0.012, timber, 1), 0, 0.05, 0.0, 0, 0, 0, g);
    add(rbox(0.78, 0.17, 0.3, 0.05, stone), 0, 0.45, 0.04, 0, 0, 0, g);
    add(rbox(0.7, 0.09, 0.32, 0.03, stone, 1), 0, -0.42, 0.08, 0, 0, 0, g);
  }
  // ---------------- curb + brackets, boarded wooden cap with shingles, finial
  add(new THREE.Mesh(new THREE.CylinderGeometry(R1 + 0.22, R1 + 0.15, 0.26, 28), timber), 0, TH + 0.12, 0);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = R1 + 0.06; add(rbox(0.12, 0.3, 0.24, 0.03, timber, 1), r * Math.sin(a), TH - 0.13, r * Math.cos(a), 0, a, 0); }
  const capPts = [[1.66, 0], [1.74, 0.2], [1.66, 0.55], [1.42, 1.0], [1.05, 1.42], [0.62, 1.7], [0.25, 1.86], [0.001, 1.9]];
  add(new THREE.Mesh(new THREE.LatheGeometry(capPts.map(([a, b]) => new THREE.Vector2(a, b)), 22), capWood), 0, CB, 0);
  {
    const pts = capPts.slice().reverse(), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1];
    let row = 0;
    for (let sd = 0.2; sd < total - 0.27; sd += 0.19, row++) {
      let i = 1; while (cum[i] < sd) i++;
      const t = (sd - cum[i - 1]) / (cum[i] - cum[i - 1]), [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
      const r = r0 + (r1 - r0) * t, y = y0 + (y1 - y0) * t, sl = Math.hypot(r1 - r0, y1 - y0), dr = (r1 - r0) / sl, dy = (y1 - y0) / sl;
      const n = Math.max(5, Math.round(2 * Math.PI * r / 0.28));
      for (let k = 0; k < n; k++) {
        const a = (k + (row % 2) * 0.5) / n * Math.PI * 2;
        const xAx = new THREE.Vector3(dr * Math.sin(a), dy, dr * Math.cos(a)).normalize(), zAx = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a));
        const nrm = new THREE.Vector3().crossVectors(zAx, xAx).normalize();
        const p = new THREE.Vector3(r * Math.sin(a), CB + y, r * Math.cos(a)).addScaledVector(nrm, 0.04);
        shL.push([basis(p, xAx, zAx, 0.09 + jr(-0.02, 0.02), jr(-0.04, 0.04), 1, 1, (2 * Math.PI * r / n) / 0.3 * 1.08, false), tint([0xffffff, 0xf3e3cf, 0xe6d0b4, 0xdcc3a2, 0xfff2e2])]);
      }
    }
  }
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.35, 8), timber), 0, CB + 2.05, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), timber), 0, CB + 2.28, 0);
  // windshaft housing + shaft out of the cap front
  const hubY = CB + 0.6, hubZ = 2.25;
  add(rbox(0.72, 0.62, 0.9, 0.08, capWood), 0, hubY, 1.35);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 10), timber), 0, hubY, hubZ - 0.35, Math.PI / 2, 0, 0);

  // ---------------- sails: child Group 'sails' (hub on its origin) — the game / gallery spins rotation.z
  const sails = new THREE.Group(); sails.name = 'sails'; sails.position.set(0, hubY, hubZ); root.add(sails);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.42, 14), timber), 0, 0, 0.05, Math.PI / 2, 0, 0, sails);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), iron), 0, 0, 0.28, 0, 0, 0, sails);
  for (let q = 0; q < 4; q++) {
    const arm = new THREE.Group(); arm.rotation.z = q * Math.PI / 2 + Math.PI / 4; sails.add(arm);
    const y0 = 0.9, y1 = 4.25, xw = 1.2, n = 7;
    add(rbox(0.17, 4.3, 0.15, 0.04, sailWood), 0, 2.2, 0.12, 0, 0, 0, arm);
    add(rbox(0.07, y1 - y0, 0.07, 0.02, sailWood, 1), xw, (y0 + y1) / 2, 0.16, 0, 0, 0, arm);
    for (let i = 0; i <= n; i++) add(rbox(xw + 0.06, 0.05, 0.06, 0.015, sailWood, 1), xw / 2, y0 + (y1 - y0) * i / n, 0.17, 0, 0, 0, arm);
    add(rbox(0.26, y1 - y0, 0.03, 0.01, sailWood, 1), -0.2, (y0 + y1) / 2, 0.13, 0, 0, 0, arm);
    const cg = new THREE.PlaneGeometry(xw - 0.06, y1 - y0 - 0.06, 3, 6), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const u = cp.getX(i) / (xw - 0.06) + 0.5, v = cp.getY(i) / (y1 - y0) + 0.5; cp.setZ(i, -0.09 * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(Math.PI * v))); }
    cg.computeVertexNormals();
    add(new THREE.Mesh(cg, cloth), xw / 2, (y0 + y1) / 2, 0.12, 0, 0, 0, arm);
  }

  // ---------------- greenery: flowering bushes by the door, ivy up one side
  for (const side of [-1, 1]) {
    const a = side * 0.62, r = R0 + 0.75, bx = r * Math.sin(a), bz = r * Math.cos(a);
    for (let k = 0; k < 55; k++) leaves.push([bx + jr(-0.55, 0.55), jr(0.1, 0.95), bz + jr(-0.45, 0.45)]);
    for (let k = 0; k < 8; k++) { const fx = bx + jr(-0.45, 0.45), fy = jr(0.55, 1.0), fz = bz + jr(-0.35, 0.4), c = [0xfff8ea, 0xf6eef8, 0xf7c6d6][k % 3]; for (let q = 0; q < 8; q++) blossoms.push([fx + jr(-0.1, 0.1), fy + jr(-0.08, 0.08), fz + jr(-0.1, 0.1), c]); }
  }
  {
    let a = 1.05, y = Y0;
    while (y < 3.4) { a += jr(-0.03, 0.03); y += jr(0.05, 0.11); const r = rad(y) + 0.15; for (let k = 0; k < 3; k++) { const aa = a + jr(-0.07, 0.07); leaves.push([r * Math.sin(aa), y + jr(-0.08, 0.08), r * Math.cos(aa)]); } }
  }
  inst(stoneGeo(THREE, 1), stoneI, stones);
  inst(shingleGeo(THREE, 0.36, 0.3, 0.03), M(0xffffff, tex('wood_light', 0.5, 0.5)), shL);
  {
    const lv = [], bl = [], gc = GREENS.map((h) => new THREE.Color(h));
    for (const [x, y, z] of leaves) put(lv, x, y, z, jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28), jr(0.75, 1.3), undefined, undefined, gc[Math.floor(rr() * gc.length)].clone().offsetHSL(0, 0, jr(-0.05, 0.06)));
    for (const [x, y, z, c] of blossoms) put(bl, x, y, z, jr(0, 6), jr(0, 6), 0, jr(0.8, 1.25), undefined, undefined, c);
    inst(leafGeo(THREE), leafMat(M, THREE), lv);
    inst(new THREE.IcosahedronGeometry(0.07, 0), M(0xffffff, null, { roughness: 0.8 }), bl);
  }
  root.userData.footprint = { w: 5, d: 5.4 };
  root.userData.door = { x: 0, z: R0 + 1.3 };
  return K.finish([sails]);
}

// ============================================================ WOODSHED
export function woodshed(THREE, opts = {}) {
  const K = kit(THREE, opts, 'woodshed', 3);
  const { root, M, add, rbox, jr, rr, tex, put, inst, slope } = K;
  const garden = opts.garden !== false;
  const W = 4.0, D = 2.0, EH = 2.05, RY = 2.8, OV = 0.35;
  const timber = M(0xb4824f, tex('wood_light', 0.6, 0.6));
  const boards = M(0xd2ab80, tex('wood_light', 0.9, 0.9));
  const deck = M(0xd6b8a0, tex('wood_planks_dark', 0.6, 0.6));
  const stone = M(0xe2dacb, tex('stone', 0.6, 0.6));
  const shL = [];
  // floor, post pads, posts, plates, tie beams, king posts
  add(rbox(W + 0.1, 0.1, D + 0.1, 0.03, deck, 1), 0, 0.05, 0);
  for (const x of [-W / 2 + 0.08, 0, W / 2 - 0.08]) for (const z of [-D / 2 + 0.08, D / 2 - 0.08]) {
    add(rbox(0.32, 0.14, 0.32, 0.05, stone, 1), x, 0.07, z);
    add(rbox(0.17, EH, 0.17, 0.04, timber), x + jr(-0.02, 0.02), EH / 2 + 0.1, z, jr(-0.02, 0.02), 0, jr(-0.02, 0.02));
  }
  for (const z of [-D / 2 + 0.08, D / 2 - 0.08]) add(rbox(W + 0.4, 0.18, 0.18, 0.04, timber), 0, EH + 0.12, z);
  for (const x of [-W / 2 + 0.08, 0, W / 2 - 0.08]) {
    add(rbox(0.15, 0.15, D + 0.3, 0.03, timber, 1), x, EH + 0.08, 0);
    add(rbox(0.12, RY - EH - 0.1, 0.12, 0.03, timber, 1), x, (RY + EH) / 2, 0);
  }
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) for (const sz of [-1, 1]) add(rbox(0.1, 0.6, 0.1, 0.02, timber, 1), x, EH - 0.2, sz * (D / 2 - 0.3), sz * -0.75, 0, 0);
  // boarded back and side walls (horizontal boards)
  for (let y = 0.2, i = 0; y < EH; y += 0.215, i++) {
    add(rbox(W - 0.1, 0.2, 0.05, 0.02, boards, 1), jr(-0.02, 0.02), y, -D / 2 + 0.02, 0, 0, jr(-0.006, 0.006));
    for (const sx of [-1, 1]) if (y < 1.75) add(rbox(0.05, 0.2, D - 0.15, 0.02, boards, 1), sx * (W / 2 - 0.02), y, jr(-0.02, 0.02) - 0.02);
  }
  // gable roof, ridge along X: built in a frame turned 90° so the shared slope() helper can lay the shingles
  {
    const R = new THREE.Group(); R.rotation.y = Math.PI / 2; root.add(R);
    const pre = new THREE.Matrix4().makeRotationY(Math.PI / 2), tn = (RY - EH) / (D / 2), run = W / 2 + 0.3;
    for (const s of [-1, 1]) {
      const bx = s * (D / 2 + OV), by = EH - OV * tn + 0.12, dx = bx, dy = by - RY, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      let nx = -dy / len, ny = dx / len; if (ny < 0) { nx = -nx; ny = -ny; }
      add(rbox(len, 0.08, 2 * run, 0.03, deck, 1), bx / 2 + nx * 0.04, (RY + by) / 2 + ny * 0.04, 0, 0, 0, ang, R);
      for (const sz of [-1, 1]) add(rbox(len, 0.18, 0.08, 0.02, timber, 1), bx / 2 - nx * 0.05, (RY + by) / 2 - ny * 0.05, sz * (run + 0.02), 0, 0, ang, R);
      slope(shL, 0, RY, bx, by, -run - 0.03, run + 0.03, { off: 0.11, pre, len: 0.4, w: 0.3, step: 0.22, pal: [0xe2c8aa, 0xd2b292, 0xc6a684, 0xead4ba, 0xbf9e80, 0xd8bea0] });
    }
    add(rbox(0.22, 0.12, 2 * run + 0.1, 0.04, timber), 0, RY + 0.16, 0, 0, 0, 0, R);
  }
  // stacked firewood under the roof (fixed architecture), end-grain facing the front
  {
    const logGeo = new THREE.CylinderGeometry(0.105, 0.115, 0.46, 8);
    const logs = [], col = [0xffffff, 0xf3e6d6, 0xe8d6bf];
    for (const zc of [-0.62, -0.14]) for (let row = 0; row < 7; row++) for (let c = 0; c < 16; c++) {
      const x = -W / 2 + 0.3 + c * 0.228 + (row % 2) * 0.114; if (x > W / 2 - 0.22) continue;
      if (row === 6 && rr() < 0.45) continue;
      put(logs, x + jr(-0.01, 0.01), 0.22 + row * 0.205, zc + jr(-0.04, 0.04), Math.PI / 2, 0, jr(0, 6), jr(0.88, 1.1), 1, jr(0.88, 1.1), col[Math.floor(rr() * 3)]);
    }
    for (const x of [-W / 2 + 0.16, W / 2 - 0.16]) add(rbox(0.08, 1.55, 0.08, 0.02, timber, 1), x, 0.85, 0.12);
    inst(logGeo, [M(0xc0905c, tex('bark', 1, 1)), M(0xf0cf98, tex('wood_light', 0.4, 0.4)), M(0xf0cf98, tex('wood_light', 0.4, 0.4))], logs);
  }
  if (garden) {   // chopping block in front (looks like a log prop, so garden-only)
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 12, 1, true), M(0xc0905c, tex('bark', 1, 1))), 1.1, 0.25, D / 2 + 0.75);
    add(new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), M(0xf0cf98, tex('wood_light', 0.4, 0.4))), 1.1, 0.5, D / 2 + 0.75, -Math.PI / 2, 0, 0);
  }
  inst(shingleGeo(THREE, 0.4, 0.3, 0.03), M(0xffffff, tex('wood_light', 0.45, 0.45)), shL);
  root.userData.footprint = { w: W + 0.6, d: D + 0.7 };
  root.userData.door = { x: 0, z: D / 2 + 0.8 };
  return K.finish();
}

// ============================================================ FENCE
export function fence(THREE, opts = {}) {
  const K = kit(THREE, opts, 'fence', 4);
  const { root, M, add, rbox, jr, tex } = K;
  const len = opts.len ?? 3, n = Math.max(1, Math.round(len / 1.5)), bay = len / n;
  const wood = M(0xc4b4a0, tex('wood_light', 0.5, 0.5));
  const rope = M(0xe9d3ad, tex('burlap', 2, 2));
  const tops = [];
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + i * bay, h = jr(1.05, 1.2);
    add(rbox(0.15, h, 0.15, 0.05, wood), x + jr(-0.02, 0.02), h / 2 - 0.05, 0, jr(-0.06, 0.06), jr(-0.4, 0.4), jr(-0.06, 0.06));
    tops.push(h);
    if (i % 2 === 0) for (const y of [0.85, 0.45]) add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 5, 12), rope), x, y + 0.04, 0.02, Math.PI / 2 + jr(-0.2, 0.2), 0, 0);
  }
  for (let i = 0; i < n; i++) {
    const xm = -len / 2 + (i + 0.5) * bay;
    for (const y of [0.45, 0.85]) add(rbox(bay + 0.22, jr(0.1, 0.13), 0.065, 0.03, wood, 1), xm + jr(-0.04, 0.04), y + jr(-0.04, 0.04), 0.1, jr(-0.05, 0.05), jr(-0.02, 0.02), jr(-0.045, 0.045));
  }
  return K.finish();
}

// ============================================================ DRY-STONE WALL
export function stoneWall(THREE, opts = {}) {
  const K = kit(THREE, opts, 'stone_wall', 5);
  const { root, M, add, rbox, jr, rr, tex, put, inst, tint } = K;
  const len = opts.len ?? 4, T0 = 0.62, T1 = 0.46;
  const th = (y) => T0 + (T1 - T0) * y / 0.9;
  add(rbox(len - 0.1, 0.66, T1 - 0.1, 0.06, M(0x9c968c, tex('stone', 1, 1)), 1), 0, 0.33, 0);
  const sA = [], sB = [], moss = [], tufts = [];
  const lay = (y, h0, h1, w0, w1) => {
    for (let x = -len / 2 + jr(0, 0.1); x < len / 2 - 0.1;) {
      const w = Math.min(jr(w0, w1), len / 2 - x), h = jr(h0, h1), t = th(y), list = rr() < 0.5 ? sA : sB;
      if (w < 0.12) break;
      if (rr() < 0.4) for (const sz of [-1, 1]) put(list, x + w / 2, y + jr(-0.02, 0.02), sz * t / 4, jr(-0.08, 0.08), jr(-0.1, 0.1), jr(-0.12, 0.12), w * 1.2, h * 1.3, t * 0.62, tint(STONE_PAL, 0.07));
      else put(list, x + w / 2, y + jr(-0.02, 0.02), jr(-0.03, 0.03), jr(-0.08, 0.08), jr(-0.1, 0.1), jr(-0.12, 0.12), w * 1.2, h * 1.3, t * jr(1.05, 1.15), tint(STONE_PAL, 0.07));
      if (rr() < 0.3) moss.push([x + w / 2 + jr(-0.1, 0.1), y + h * 0.42, jr(-0.2, 0.2)]);
      x += w;
    }
  };
  lay(0.12, 0.22, 0.26, 0.36, 0.6);
  lay(0.33, 0.19, 0.23, 0.3, 0.52);
  lay(0.53, 0.18, 0.22, 0.26, 0.46);
  // coping: stones set on edge along the top
  for (let x = -len / 2 + 0.08; x < len / 2 - 0.08;) {
    const w = jr(0.15, 0.24), h = jr(0.24, 0.3);
    put(rr() < 0.5 ? sA : sB, x + w / 2, 0.66 + h / 2 - 0.03, 0, jr(-0.08, 0.08), jr(-0.1, 0.1), jr(-0.18, 0.18), w * 1.25, h * 1.1, T1 * jr(0.95, 1.1), tint(STONE_PAL, 0.08));
    if (rr() < 0.45) moss.push([x + w / 2, 0.66 + h - 0.05, jr(-0.12, 0.12)]);
    x += w + 0.015;
  }
  const mossL = [], mc = [0x7aa84a, 0x8fbb52, 0x6a9a40, 0x9dc45e];
  for (const [x, y, z] of moss) put(mossL, x, y, z, 0, jr(0, 3), 0, jr(0.12, 0.3), jr(0.035, 0.06), jr(0.1, 0.2), mc[Math.floor(rr() * mc.length)]);
  for (let k = 0; k < Math.round(len * 5); k++) { const sz = rr() < 0.5 ? -1 : 1; put(tufts, jr(-len / 2, len / 2), jr(0.02, 0.18), sz * (T0 / 2 + jr(0, 0.1)), jr(-0.6, 0.6), jr(0, 6), jr(-0.4, 0.4), jr(0.6, 1.1), undefined, undefined, new THREE.Color(GREENS[Math.floor(rr() * 5)])); }
  const stMat = M(0xffffff, tex('plaster', 0.6, 0.6));
  inst(stoneGeo(THREE, 2), stMat, sA);
  inst(stoneGeo(THREE, 5.5), stMat, sB);
  inst(new THREE.SphereGeometry(0.5, 7, 4), M(0xffffff, null), mossL);
  inst(leafGeo(THREE), leafMat(M, THREE), tufts);
  return K.finish();
}

// ============================================================ STONE FOOTBRIDGE (walkway along Z)
export function bridge(THREE, opts = {}) {
  const K = kit(THREE, opts, 'bridge', 6);
  const { root, M, add, rbox, jr, rr, tex, put, inst, tint } = K;
  const L = 5.0, HWD = 0.9, ac = -0.55, ar = 1.2;                            // length, half width, arch centre height, arch radius
  const top = (z) => 0.06 + 0.82 * Math.pow(Math.max(0, Math.cos(Math.PI * z / (L + 0.2))), 1.2);
  const dtop = (z) => (top(z + 0.01) - top(z - 0.01)) / 0.02;
  // deck / core: one extruded hump profile with the arch cut out (kept unmerged, flagged as walkable ground)
  {
    const s = new THREE.Shape(), e = L / 2 + 0.1, a0 = Math.asin((-0.25 - ac) / ar), za = ar * Math.cos(a0);
    s.moveTo(-e, -0.25);
    for (let i = 0; i <= 28; i++) { const z = -e + 2 * e * i / 28; s.lineTo(z, top(z)); }
    s.lineTo(e, -0.25); s.lineTo(za, -0.25); s.absarc(0, ac, ar, a0, Math.PI - a0, false); s.lineTo(-e, -0.25);
    const g = new THREE.ExtrudeGeometry(s, { depth: 2 * HWD - 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 16 });
    g.translate(0, 0, -(HWD - 0.06)); g.rotateY(Math.PI / 2);
    const dg = new THREE.Group(); dg.name = 'deck'; dg.userData.keep = true; root.add(dg);
    const m = add(new THREE.Mesh(g, M(0xd8cfc0, tex('stone', 0.8, 0.8))), 0, 0, 0, 0, 0, 0, dg);
    m.userData.ground = true;
  }
  const sA = [], sB = [], moss = [], leaves = [];
  const pick = () => (rr() < 0.5 ? sA : sB);
  for (const sx of [-1, 1]) {
    const fx = sx * (HWD - 0.04);
    // arch ring voussoirs
    const a0 = Math.asin((-0.25 - ac) / ar), nV = 13;
    for (let i = 0; i <= nV; i++) {
      const a = a0 + (Math.PI - 2 * a0) * i / nV, r = ar + 0.15;
      put(pick(), fx, ac + Math.sin(a) * r, Math.cos(a) * r, Math.PI / 2 - a, 0, 0, 0.26, 0.34, (Math.PI - 2 * a0) * r / nV * 1.05, tint(STONE_PAL, 0.06));
    }
    // spandrel courses
    for (let y = -0.15; y < 0.95; y += 0.21) {
      for (let z = -L / 2 - 0.05 + jr(0, 0.15); z < L / 2;) {
        const w = jr(0.28, 0.46), zc = z + w / 2; z += w;
        if (Math.hypot(zc, y - ac) < ar + 0.36) continue;
        const h = Math.min(0.21, top(zc) - (y - 0.105));
        if (h < 0.07) continue;
        put(pick(), fx, y - 0.105 + h / 2, zc, jr(-0.06, 0.06), jr(-0.06, 0.06), jr(-0.08, 0.08), 0.22, h * 1.04, w * 1.04, tint(STONE_PAL, 0.07));
        if (rr() < 0.12) moss.push([fx + sx * 0.1, y - 0.1 + h, zc]);
      }
    }
    // low parapets: two courses of stones following the hump, flat cap stones on top
    const px = sx * (HWD - 0.17);
    for (let c = 0; c < 2; c++) for (let z = -L / 2 + 0.1 + c * 0.18; z < L / 2 - 0.1 - c * 0.18;) {
      const w = jr(0.3, 0.44), zc = z + w / 2; z += w;
      put(pick(), px, top(zc) + 0.1 + c * 0.17, zc, -Math.atan(dtop(zc)) + jr(-0.05, 0.05), jr(-0.05, 0.05), jr(-0.05, 0.05), 0.3, 0.19, w * 1.04, tint(STONE_PAL, 0.07));
    }
    for (let z = -L / 2 + 0.45; z < L / 2 - 0.45;) {
      const w = jr(0.42, 0.55), zc = z + w / 2; z += w + 0.01;
      add(rbox(0.36, 0.1, w, 0.04, M(0xe8e0d2, tex('stone', 0.5, 0.5)), 1), px, top(zc) + 0.42, zc, -Math.atan(dtop(zc)), 0, 0);
      if (rr() < 0.35) moss.push([px, top(zc) + 0.48, zc]);
    }
    for (let k = 0; k < 26; k++) { const z = jr(-1.6, -0.6) * (sx > 0 ? -1 : 1); leaves.push([px + sx * jr(0.1, 0.25), top(z) + jr(-0.3, 0.45), z]); }
  }
  const mossL = [], mc = [0x7aa84a, 0x8fbb52, 0x6a9a40];
  for (const [x, y, z] of moss) put(mossL, x, y, z, 0, jr(0, 3), 0, jr(0.15, 0.3), 0.05, jr(0.1, 0.22), mc[Math.floor(rr() * 3)]);
  const lv = [];
  for (const [x, y, z] of leaves) put(lv, x, y, z, jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28), jr(0.75, 1.25), undefined, undefined, new THREE.Color(GREENS[Math.floor(rr() * 5)]));
  const stMat = M(0xffffff, tex('plaster', 0.6, 0.6));
  inst(stoneGeo(THREE, 4), stMat, sA);
  inst(stoneGeo(THREE, 7.3), stMat, sB);
  inst(new THREE.SphereGeometry(0.5, 7, 4), M(0xffffff, null), mossL);
  inst(leafGeo(THREE), leafMat(M, THREE), lv);
  root.userData.footprint = { w: 2 * HWD, d: L };
  return K.finish();
}

// ============================================================ STREAM (along X)
const waterTime = { value: 0 };
let waterMatCache = null;
function waterMaterial(THREE) {
  if (waterMatCache) return waterMatCache;
  const m = new THREE.MeshStandardMaterial({ color: 0x7cc4d6, roughness: 0.14, metalness: 0, transparent: true, opacity: 0.8 });
  m.onBeforeCompile = (sh) => {     // drifting light ripples, flowing along local +X
    sh.uniforms.uTime = waterTime;
    sh.vertexShader = 'varying vec3 vFlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = transformed;');
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vFlow;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float rip = sin(vFlow.x * 2.6 - uTime * 1.7 + sin(vFlow.z * 3.3 + vFlow.x * 0.8) * 1.5) * sin(vFlow.x * 1.1 + vFlow.z * 4.7 - uTime * 1.1);
      diffuseColor.rgb += vec3(0.16, 0.2, 0.2) * smoothstep(0.55, 1.0, rip);`);
  };
  m.customProgramCacheKey = () => 'hueseek-water';
  return (waterMatCache = m);
}
export function stream(THREE, opts = {}) {
  const K = kit(THREE, opts, 'stream', 7);
  const { root, M, add, jr, rr, tex, put, inst, tint } = K;
  const len = opts.len ?? 12, w = opts.w ?? 2, hw = w / 2, bankH = 0.32, bedY = 0.03, waterY = 0.2;
  const ph = jr(0, 6);
  const wig = (x) => 0.16 * Math.sin(x * 0.55 + ph) + 0.07 * Math.sin(x * 1.3 + ph * 2);
  const bend = (g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + wig(p.getX(i))); g.computeVertexNormals(); return g; };
  // banks: extruded cross-sections (earth face + grassy top), gently meandering
  const bank = (pts, mat, sz) => {
    const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(-sz * z, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, steps: Math.max(8, Math.round(len * 2)) });
    g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2);
    return add(new THREE.Mesh(bend(g), mat));
  };
  const earth = M(0xd9bc98, tex('stone', 0.6, 0.6)), grass = M(0xc4e6a0, tex('leaves', 0.7, 0.7));
  for (const sz of [-1, 1]) {
    bank([[hw - 0.12, 0], [hw - 0.12, bedY], [hw + 0.45, bankH], [hw + 0.62, bankH + 0.01], [hw + 0.62, 0]], earth, sz);
    bank([[hw + 0.4, 0], [hw + 0.4, bankH - 0.02], [hw + 0.56, bankH + 0.04], [hw + 0.95, bankH + 0.03], [hw + 1.6, 0]], grass, sz);
  }
  // bed + water: kept separate (userData.ground) — the water ripples in its shader
  const wg = new THREE.Group(); wg.name = 'water'; wg.userData.keep = true; root.add(wg);
  const bedG = new THREE.PlaneGeometry(len, w + 0.5, Math.round(len * 2), 2); bedG.rotateX(-Math.PI / 2);
  const bed = add(new THREE.Mesh(bend(bedG), M(0xcabca2, tex('stone', 0.5, 0.5))), 0, bedY, 0, 0, 0, 0, wg);
  const watG = new THREE.PlaneGeometry(len, w + 0.6, Math.round(len * 4), 4); watG.rotateX(-Math.PI / 2);
  { const p = watG.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.012 * Math.sin(p.getX(i) * 3 + p.getZ(i) * 2)); }
  const water = add(new THREE.Mesh(bend(watG), waterMaterial(THREE)), 0, waterY, 0, 0, 0, 0, wg);
  water.castShadow = false;
  water.onBeforeRender = () => { waterTime.value = performance.now() / 1000; };
  bed.userData.ground = true; water.userData.ground = true;
  // rounded stones along both banks + pebbles on the bed, foam flecks, reeds
  const stones = [], foam = [], reeds = [];
  for (const sz of [-1, 1]) for (let x = -len / 2 + jr(0, 0.3); x < len / 2; x += jr(0.35, 0.8)) {
    const s = rr() < 0.15 ? jr(0.5, 0.75) : jr(0.22, 0.45), z = sz * (hw + jr(-0.12, 0.3)) + wig(x);
    put(stones, x, waterY * 0.4 + s * 0.22, z, jr(-0.2, 0.2), jr(0, 6), jr(-0.2, 0.2), s * jr(1, 1.3), s * jr(0.55, 0.8), s, tint(STONE_PAL, 0.08));
    if (rr() < 0.4) put(foam, x + jr(0.1, 0.4), waterY + 0.012, z - sz * s * 0.45, 0, jr(-0.3, 0.3), 0, jr(1.2, 2.4), 1, jr(0.5, 0.9), 0xffffff);
    if (rr() < 0.35) { const rx = x + jr(-0.2, 0.2), rz = sz * (hw + jr(0.35, 0.7)) + wig(x); for (let k = 0; k < 7; k++) put(reeds, rx + jr(-0.12, 0.12), bankH * 0.7, rz + jr(-0.1, 0.1), jr(-0.25, 0.25), jr(0, 6), jr(-0.25, 0.25), 1, jr(0.7, 1.3), 1, new THREE.Color(GREENS[Math.floor(rr() * 5)])); }
  }
  for (let k = 0; k < Math.round(len * 2.5); k++) { const x = jr(-len / 2, len / 2), s = jr(0.08, 0.2); put(stones, x, bedY + s * 0.2, jr(-hw + 0.2, hw - 0.2) + wig(x), 0, jr(0, 6), 0, s * 1.3, s * 0.5, s, tint(STONE_PAL, 0.1)); }
  for (let k = 0; k < Math.round(len * 1.5); k++) put(foam, jr(-len / 2, len / 2), waterY + 0.011, jr(-hw * 0.6, hw * 0.6), 0, jr(-0.2, 0.2), 0, jr(1.5, 3), 1, jr(0.3, 0.5), 0xffffff);
  const foamGeo = new THREE.CircleGeometry(0.1, 8); foamGeo.rotateX(-Math.PI / 2);
  const reedGeo = new THREE.PlaneGeometry(0.05, 0.75, 1, 2); reedGeo.translate(0, 0.37, 0);
  inst(stoneGeo(THREE, 6), M(0xffffff, tex('plaster', 0.6, 0.6)), stones);
  const fm = inst(foamGeo, M(0xffffff, null, { transparent: true, opacity: 0.55, roughness: 0.6 }), foam); if (fm) fm.castShadow = false;
  inst(reedGeo, leafMat(M, THREE), reeds);
  root.userData.footprint = { w: len, d: w + 3.2 };
  return K.finish();
}

// ============================================================ LAUNDRY LINE
export function laundryLine(THREE, opts = {}) {
  const K = kit(THREE, opts, 'laundry_line', 8);
  const { root, M, add, rbox, jr, tex } = K;
  const half = (opts.len ?? 3.8) / 2, topY = 1.95, sag = 0.2;
  const timber = M(0xc79a68, tex('wood_light', 0.6, 0.6));
  const ropeM = M(0xe9d3ad, tex('burlap', 2, 2));
  const ropeY = (x) => topY - sag * (1 - (x / half) ** 2);
  for (const sx of [-1, 1]) {
    add(rbox(0.13, topY + 0.2, 0.13, 0.04, timber), sx * (half + 0.04), (topY + 0.2) / 2, 0, 0, 0, sx * 0.03);
    add(rbox(0.5, 0.09, 0.09, 0.03, timber, 1), sx * (half + 0.08), topY + 0.04, 0);
    add(rbox(0.07, 0.4, 0.07, 0.02, timber, 1), sx * (half - 0.08), topY - 0.12, 0, 0, 0, -sx * 0.7);
  }
  const pts = []; for (let i = 0; i <= 16; i++) { const x = -half + 2 * half * i / 16; pts.push(new THREE.Vector3(x, ropeY(x), 0)); }
  add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.013, 5), ropeM));
  // cloths + pegs: child Group 'cloth' pivoting on the rope line so the game can sway it
  const cg = new THREE.Group(); cg.name = 'cloth'; cg.position.set(0, topY - sag, 0); root.add(cg);
  const local = (x) => ropeY(x) - (topY - sag);
  const peg = M(0xe3c49a, tex('wood_light', 0.4, 0.4));
  const hang = (cx, w, h, mat) => {
    const g = new THREE.PlaneGeometry(w, h, 6, 6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i) / h + 0.5, x = cx + u;
      p.setXYZ(i, x, local(x) - (1 - v) * h - 0.015, (0.05 * Math.sin(x * 6 + 1.3) + 0.03 * Math.sin(u * 9)) * (1 - v * 0.8));
    }
    g.computeVertexNormals();
    add(new THREE.Mesh(g, mat), 0, 0, 0, 0, 0, 0, cg);
    for (const s of [-1, 1]) { const x = cx + s * (w / 2 - 0.07); add(rbox(0.035, 0.1, 0.04, 0.012, peg, 1), x, local(x) - 0.02, 0, 0, 0, jr(-0.15, 0.15), cg); }
  };
  const white = M(0xffffff, tex('plaster', 0.8, 0.8), { side: THREE.DoubleSide });
  const blue = M(0x9fc4f0, tex('plaster', 0.8, 0.8), { side: THREE.DoubleSide });
  const pink = M(0xf6aab8, tex('plaster', 0.8, 0.8), { side: THREE.DoubleSide });
  hang(-1.15, 1.2, 1.05, white);
  hang(0.0, 0.55, 0.7, blue);
  hang(0.62, 0.5, 0.55, pink);
  hang(1.32, 0.62, 0.95, white);
  // a little shirt
  {
    const s = new THREE.Shape(), x0 = -0.52;
    s.moveTo(x0 - 0.17, 0); s.lineTo(x0 + 0.17, 0); s.lineTo(x0 + 0.17, -0.3); s.lineTo(x0 + 0.3, -0.36); s.lineTo(x0 + 0.24, -0.46); s.lineTo(x0 + 0.15, -0.42);
    s.lineTo(x0 + 0.15, -0.78); s.lineTo(x0 - 0.15, -0.78); s.lineTo(x0 - 0.15, -0.42); s.lineTo(x0 - 0.24, -0.46); s.lineTo(x0 - 0.3, -0.36); s.lineTo(x0 - 0.17, -0.3); s.closePath();
    const g = new THREE.ShapeGeometry(s), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x, y + local(x) - 0.015, 0.04 * Math.sin(x * 7) * -y); }
    g.computeVertexNormals();
    add(new THREE.Mesh(g, M(0xf6e7a8, tex('plaster', 0.8, 0.8), { side: THREE.DoubleSide })), 0, 0, 0.01, 0, 0, 0, cg);
    for (const s2 of [-1, 1]) add(rbox(0.035, 0.1, 0.04, 0.012, peg, 1), x0 + s2 * 0.12, local(x0 + s2 * 0.12) - 0.02, 0.01, 0, 0, 0, cg);
  }
  root.userData.footprint = { w: 2 * half + 0.6, d: 0.6 };
  return K.finish([cg]);
}

// ============================================================ SHOWCASE (gallery.html?only=farm)
export function buildFarmShowcase(THREE, opts = {}) {
  const root = new THREE.Group(); root.name = 'farm';
  let sd = Math.abs(Math.floor(opts.seed ?? 7));
  const o = () => ({ ...opts, merge: opts.merge, seed: (sd += 11) });
  const place = (g, x, z, ry = 0, y = 0) => { g.position.set(x, y, z); g.rotation.y = ry; root.add(g); return g; };
  // grassy mound for the windmill (walkable)
  {
    const prof = [[6.6, 0], [5.8, 0.16], [4.8, 0.46], [3.7, 0.76], [2.9, 0.88], [0.001, 0.9]].map(([a, b]) => new THREE.Vector2(a, b));
    const mg = new THREE.Group(); mg.name = 'mound'; mg.userData.keep = true; mg.position.set(-9, 0, -7); root.add(mg);
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), new THREE.MeshStandardMaterial({ color: 0xc4e6a0, map: kitTex(THREE, 'leaves', 0.25, 0.25), roughness: 1, side: THREE.DoubleSide }));
    m.receiveShadow = true; m.userData.ground = true; mg.add(m);
  }
  const b = place(barn(THREE, o()), 8, -6);
  root.userData.door = { x: 8 + b.userData.door.x, z: -6 + b.userData.door.z };
  place(windmill(THREE, o()), -9, -7, 0.35, 0.9);
  place(woodshed(THREE, o()), -10.5, 6, 0.3);
  place(stoneWall(THREE, { ...o(), len: 5 }), -13.2, 1.8, 0.04);
  place(stoneWall(THREE, { ...o(), len: 4 }), -6.4, 1.5, -0.08);
  place(stoneWall(THREE, { ...o(), len: 4 }), 0.5, 7.0, 0.05);
  place(fence(THREE, { ...o(), len: 3 }), 2.6, -0.6);
  place(fence(THREE, { ...o(), len: 3 }), 11.6, -0.6);
  place(fence(THREE, { ...o(), len: 4.5 }), 14.3, -3.2, Math.PI / 2);
  place(fence(THREE, { ...o(), len: 4.5 }), 14.3, -7.8, Math.PI / 2);
  place(stream(THREE, { ...o(), len: 16, w: 2 }), 6, 11);
  place(bridge(THREE, o()), 8, 11);
  place(laundryLine(THREE, o()), -2.5, 3.8, 0.25);
  if (opts.merge !== false) mergeStatic(THREE, root);
  return root;
}
