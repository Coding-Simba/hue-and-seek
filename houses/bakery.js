/* Bakery — hand-modelled in code from Codex's concept paintings (assets/concepts/house_bakery.png outside,
 * assets/interiors/bakery_shop.png + bakery_kitchen.png inside).
 * export buildHouse(THREE, opts) → THREE.Group 'bakery'. Origin = ground centre, front (door + shop window) faces +Z. Metres.
 * Cream stone-and-plaster baker's house: terracotta tile roof (ridge left-right) with a front cross-gable holding a round-arched
 * attic window, a big stone chimney, a red/cream striped awning over a bay shop window full of bread, an arched doorway in a
 * stone surround, wall lanterns, flower boxes and a woodstore lean-to with stacked firewood on the left.
 * Enterable: a hollow ground storey with two rooms joined by a stone archway —
 *   front: the shop (domed brick bread oven glowing, kneading table, bread shelves, counter, pastry rack, the bay window's
 *          bread shelves open to the room);
 *   back:  the kitchen (hearth sharing the oven's chimney, dresser of bowls, long table with benches, hanging onions).
 * Everything above the rooms (gables, roofs, ceiling, chimney, attic window) is in the child group 'roof', which the game
 * hides while the player is inside. userData: door, doorIn, innerDoors, rooms, colliders, propSlots.
 * Instanced tiles / stones / loaves / logs / leaves / clutter keep it phone-friendly.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

export function buildHouse(THREE, opts = {}) {
  const garden = opts.garden !== false;               // false = in-game: no decor that could be mistaken for a hideable prop
  const PI = Math.PI;
  const XL = -3.35, XR = 3.65, W = XR - XL, MX = (XL + XR) / 2;   // main body, ridge runs along X
  const D = 7.8, FRONT = D / 2, H = 3.2, RISE = 2.85;              // H = eave = top of the ground-storey walls
  const CX = 2.1, WC = 3.1, RISEC = 2.1;                          // front cross-gable over the shop (its ridge dies into the main roof)
  const FW = FRONT + 0.05;                                         // outer face of the front/back walls
  const T = 0.25, FL = 0.05, IXL = XL + T, IXR = XR - T, IZ = FRONT - T, PZ = -0.05;   // wall thickness, floor, inner faces, partition
  const doorX = -0.75, DR = 0.7, DSPRING = FL + 1.8;               // front doorway 1.4 m wide, round arch
  const AX = 0, AR = 0.65, ASPRING = FL + 1.95;                    // round-arched opening between shop and kitchen
  const B0 = 0.9, B1 = 3.3, BD = 0.42;                             // bay shop window (x range, projection)
  const ZC0 = FRONT * (1 - RISEC / RISE);                          // where the cross-gable ridge meets the main roof
  const OX = 0.45;                                                 // final shift so the whole silhouette is centred on x = 0
  let seed = opts.seed || 7; const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const pick = (arr) => arr[Math.floor(rr() * arr.length)];
  const tex = (n, rx = 1, ry = 1) => kitTex(THREE, n, rx, ry);
  const matCache = {};
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };

  // ---------------- materials (Codex's painted kit textures, light tints)
  const plaster = M(opts.wall || 0xfff2dc, tex('plaster', 0.32, 0.32));
  const stoneM = M(0xffffff, null);                                // instanced stones/clutter: per-instance colours
  const stoneSlab = M(0xe6e2dc, tex('plaster', 0.5, 0.5));
  const timber = M(0xa8784c, tex('wood_light', 0.5, 0.5));
  const timberLight = M(0xd8b07a, tex('wood_light', 0.6, 0.6));
  const doorWood = M(0xd9944e, tex('wood_light', 0.9, 0.9));
  const darkWood = M(0x6e4223, null);
  const weathered = M(0xc8ab8c, tex('wood_light', 0.7, 0.7));
  const shutterMat = M(0xa8dca0, tex('painted_metal', 0.6, 0.6)); // painted green board shutters
  const iron = M(0x3b3530, null, { roughness: 0.85 });
  const glass = M(0x557688, null, { roughness: 0.85 });
  const clearGlass = M(0xe8f4f8, null, { roughness: 0.85, transparent: true, opacity: 0.16, depthWrite: false });
  const warmGlass = M(0xffd38a, null, { emissive: 0xc77a2a, emissiveIntensity: 0.55, roughness: 0.85 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd894, emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.85, metalness: 0 });
  const fire = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 1.8, roughness: 0.85, metalness: 0 });
  const ember = M(0x3a1608, null, { emissive: 0xa83a08, emissiveIntensity: 0.9 });
  const terracotta = M(0xffcfa8, tex('terracotta', 1, 1));
  const brick = M(0xffa888, tex('stone', 1.6, 1.6));
  const floorMat = M(0xfff0dc, tex('stone', 0.55, 0.55));
  const awnRed = M(0xd65a4c, null, { roughness: 0.9 });
  const awnCream = M(0xfbefd9, null, { roughness: 0.9 });
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('roof_tiles', 0.5, 0.5), roughness: 0.9, metalness: 0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  const breadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, emissive: 0x3a1a04, emissiveIntensity: 0.3 });   // a little warm so it reads under the awning
  const logMat = M(0xb88452, tex('bark', 1, 1));
  const logEnd = M(0xe3bf86, tex('wood_light', 0.4, 0.4));

  const root = new THREE.Group();
  root.name = 'bakery';
  const roof = new THREE.Group();                                  // everything above the rooms: hidden by the game while you're inside
  roof.name = 'roof'; roof.userData.keep = true; root.add(roof);
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, P = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; P.add(mesh); return mesh;
  };
  const rbox = (w, h, d, r, mat, seg = Math.min(w, h, d) < 0.16 ? 1 : 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  const rb = (x, y, z, w, h, d, mat, r = 0.03, ry = 0, P = root) => add(rbox(w, h, d, r, mat, 1), x, y, z, 0, ry, 0, P);
  // a wall frame: local x runs along the wall, local z points out of it, y up
  const frame = (x, z, ry, parent = root) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.updateMatrix(); parent.add(g); return g; };
  const Pf = frame(0, FW, 0), Pr = frame(XR + 0.05, 0, PI / 2), Pb = frame(0, -FW, PI), Pl = frame(XL - 0.05, 0, -PI / 2);
  const RPf = frame(0, FW, 0, roof), RPr = frame(XR + 0.05, 0, PI / 2, roof), RPl = frame(XL - 0.05, 0, -PI / 2, roof);

  // ---------------- instanced pools (one draw call each)
  const pools = {};
  const pool = (k, geo, mat, P = root) => (pools[k] = { geo, mat, P, items: [] });
  const o3 = new THREE.Object3D();
  const pushM = (k, m, col) => pools[k].items.push([m, col]);
  const put = (k, P, x, y, z, rx, ry, rz, sx, sy, sz, col) => {
    o3.position.set(x, y, z); o3.rotation.set(rx, ry, rz); o3.scale.set(sx, sy, sz); o3.updateMatrix();
    pushM(k, P && P !== root && P !== roof ? o3.matrix.clone().premultiply(P.matrix) : o3.matrix.clone(), col);
  };
  const tint = (hex, l = 0.05, s = 0.04) => new THREE.Color(hex).offsetHSL(jr(-0.01, 0.01), jr(-s, s), jr(-l, l));
  let RO = false;                                                  // true while building parts that belong to 'roof'
  const K = (k) => (RO ? 'r' + k : k);
  const leafGeo = (() => { const g = new THREE.CircleGeometry(0.1, 6); g.scale(1, 1.4, 1); return g; })();
  const blockGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.22);
  pool('peb', new THREE.IcosahedronGeometry(0.5, 1), stoneM);                 // rounded rubble stones
  pool('block', blockGeo, stoneM);                                            // dressed stones: quoins, voussoirs, oven, hearth
  pool('leaf', leafGeo, leafMat);
  pool('bloom', new THREE.IcosahedronGeometry(0.075, 0), blossomMat);
  pool('bread', new THREE.SphereGeometry(0.5, 12, 8), breadMat);
  pool('log', new THREE.CylinderGeometry(0.12, 0.13, 0.85, 9), [logMat, logEnd, logEnd]);
  pool('box', new THREE.BoxGeometry(1, 1, 1), stoneM);                        // interior clutter: towels, boards, cloths
  pool('cyl', new THREE.CylinderGeometry(0.5, 0.5, 1, 14), stoneM);           // jars, bowls, baskets, pans, jugs
  pool('flame', new THREE.ConeGeometry(0.5, 1, 6), fire);
  pool('tile', new THREE.CylinderGeometry(0.155, 0.17, 0.46, 7, 1, true, 0, PI), tileMat, roof);
  pool('rblock', blockGeo, stoneM, roof);
  pool('rleaf', leafGeo, leafMat, roof);
  pool('rbloom', new THREE.IcosahedronGeometry(0.075, 0), blossomMat, roof);
  pool('rball', new THREE.SphereGeometry(0.5, 8, 6), stoneM, roof);           // onions + garlic hanging from the beams
  const STONES = [0xd2bc96, 0xc4ad88, 0xdcc7a2, 0xb9a07e, 0xcdb590, 0xc2a985, 0xd8c09a];
  const stoneCol = () => tint(STONES[Math.floor(rr() * STONES.length)], 0.05, 0.05);
  const peb = (P, x, y, z, w, h, d) => put('peb', P, x, y, z, jr(-0.12, 0.12), jr(-0.12, 0.12), jr(-0.2, 0.2), w, h, d, stoneCol());
  const block = (P, x, y, z, w, h, d, rz = 0, ry = 0) => put(K('block'), P, x, y, z, 0, ry, rz + jr(-0.03, 0.03), w, h, d, stoneCol());
  const GREENS = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55];
  const leaf = (P, x, y, z, s = 1) => put(K('leaf'), P, x, y, z, jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28), s * jr(0.7, 1.25), s * jr(0.7, 1.25), s, tint(GREENS[Math.floor(rr() * 5)], 0.05, 0.02));
  const bloom = (P, x, y, z, c, s = 1) => { const k = s * jr(0.8, 1.3); put(K('bloom'), P, x, y, z, jr(0, 6), jr(0, 6), 0, k, k, k, tint(c, 0.04, 0.03)); };
  const ib = (x, y, z, w, h, d, c, ry = 0, rx = 0, rz = 0) => put('box', root, x, y, z, rx, ry, rz, w, h, d, new THREE.Color(c));
  const ic = (x, y, z, r, h, c, rx = 0, ry = 0, rz = 0) => put('cyl', root, x, y, z, rx, ry, rz, r * 2, h, r * 2, new THREE.Color(c));
  const CRUST = [0xc8782a, 0xb86a22, 0xd88c3a, 0xa85e1e, 0xd0842e];
  const loaf = (P, x, y, z, sx, sy, sz, ry = 0) => put('bread', P, x, y + sy * 0.55, z, jr(-0.05, 0.05), ry, jr(-0.05, 0.05), sx * 1.12, sy * 1.12, sz * 1.12, tint(CRUST[Math.floor(rr() * CRUST.length)], 0.06, 0.05));
  const HAY = 0xd9b26a, CREAM = 0xf3ead8, WHITE = 0xf7f3ea, COPPER = 0xc77a42, BRASS = 0xd9a650, CLOTH_RED = 0xd25a4a;
  const colliders = [];
  const C = (x0, x1, z0, z1) => colliders.push({ x: +((x0 + x1) / 2 + OX).toFixed(3), z: +((z0 + z1) / 2).toFixed(3), w: +(x1 - x0).toFixed(3), d: +(z1 - z0).toFixed(3) });

  // a plain box from x0..x1 / y0..y1 / z0..z1 with planar UVs in metres, so painted textures run evenly across wall pieces
  const slab = (x0, x1, y0, y1, z0, z1, mat, P = root) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, p.getZ(i), p.getY(i));
      else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i), p.getZ(i));
      else uv.setXY(i, p.getX(i), p.getY(i));
    }
    return add(new THREE.Mesh(g, mat), 0, 0, 0, 0, 0, 0, P);
  };
  // a straight wall with rectangular holes [a0, a1, y0, y1]: along x (t = z range) or along z (t = x range)
  const wallRun = (alongX, a0, a1, t0, t1, holes) => {
    const piece = (b0, b1, c0, c1) => { if (b1 - b0 > 0.005 && c1 - c0 > 0.005) alongX ? slab(b0, b1, c0, c1, t0, t1, plaster) : slab(t0, t1, c0, c1, b0, b1, plaster); };
    let cur = a0;
    for (const [h0, h1, hy0, hy1] of [...holes].sort((p, q) => p[0] - q[0])) { piece(cur, h0, 0, H); piece(h0, h1, 0, hy0); piece(h0, h1, hy1, H); cur = h1; }
    piece(cur, a1, 0, H);
  };
  // fills the two corners above a round arch so an opening of radius r reads round on both faces (centre at x, y; wall z0..z1)
  const spandrels = (x, y, r, z0, z1) => {
    const sL = new THREE.Shape(); sL.moveTo(-r, 0); sL.lineTo(-r, r); sL.lineTo(0, r); sL.absarc(0, 0, r, PI / 2, PI, false);
    const sR = new THREE.Shape(); sR.moveTo(r, 0); sR.absarc(0, 0, r, 0, PI / 2, false); sR.lineTo(r, r); sR.closePath();
    add(new THREE.Mesh(new THREE.ExtrudeGeometry([sL, sR], { depth: z1 - z0, bevelEnabled: false, curveSegments: 10 }), plaster), x, y, z0);
  };
  const holes = { f: [], b: [], r: [] };

  // ---------------- roof shells: main gable prism + cross-gable prism above the walls, the ceiling under them
  {
    const s = new THREE.Shape();
    s.moveTo(-FRONT, H); s.lineTo(FRONT, H); s.lineTo(0, H + RISE); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, steps: 1 });
    g.translate(0, 0, -W / 2); g.rotateY(PI / 2);
    add(new THREE.Mesh(g, plaster), MX, 0, 0, 0, 0, 0, roof);
    const c = new THREE.Shape();
    c.moveTo(-WC / 2, H); c.lineTo(WC / 2, H); c.lineTo(0, H + RISEC); c.closePath();
    const cg = new THREE.ExtrudeGeometry(c, { depth: FRONT - ZC0 + 0.5, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, steps: 1 });
    add(new THREE.Mesh(cg, plaster), CX, 0, ZC0 - 0.5, 0, 0, 0, roof);
    slab(IXL, IXR, H - 0.07, H - 0.01, -IZ, IZ, timberLight, roof);
    for (const x of [-2.35, -0.75, 0.85, 2.45]) add(rbox(0.22, 0.2, 2 * IZ, 0.04, timber, 1), x, H - 0.17, 0, 0, 0, 0, roof);
    for (const z of [-2.0, 2.0]) add(rbox(IXR - IXL, 0.2, 0.2, 0.04, timber, 1), MX, H - 0.36, z, 0, 0, 0, roof);
  }
  // rubble plinth (two courses of rounded stones) + interlocking quoins at every corner
  const plinth = (P, a, b, gaps = []) => {
    for (let course = 0; course < 2; course++) {
      let x = a - 0.05 + course * 0.18;
      while (x < b + 0.05) {
        const sw = jr(0.32, 0.5);
        if (!gaps.some(([g0, g1]) => x + sw / 2 > g0 && x + sw / 2 < g1)) peb(P, x + sw / 2, 0.11 + course * 0.2, 0.05, sw, jr(0.2, 0.26), 0.2);
        x += sw * 0.92;
      }
    }
  };
  const quoins = (P, a, b, phase) => {
    for (const [end, sg] of [[a, 1], [b, -1]]) for (let j = 0; j < 7; j++) {
      const long = (j + phase) % 2 === 0, len = long ? 0.46 : 0.3;
      block(P, end + sg * (len / 2 - 0.04), 0.6 + j * 0.36, 0.03, len, 0.32, 0.14);
    }
  };
  plinth(Pf, XL, XR, [[-1.6, 0.1], [0.85, 3.35]]); quoins(Pf, XL, XR, 0);
  plinth(Pb, -XR, -XL); quoins(Pb, -XR, -XL, 0);
  plinth(Pr, -FRONT, FRONT); quoins(Pr, -FRONT, FRONT, 1);
  plinth(Pl, -FRONT, FRONT, [[-1.6, 1.9]]); quoins(Pl, -FRONT, FRONT, 1);
  // patches of bare stone showing through the plaster, as in the painting
  const patch = (P, x, y, n, sx = 0.45, sy = 0.3) => { for (let k = 0; k < n; k++) peb(P, x + jr(-sx, sx), y + jr(-sy, sy), 0.0, jr(0.24, 0.4), jr(0.16, 0.26), 0.1); };
  patch(Pf, -2.65, 1.3, 5, 0.25, 0.45); patch(Pf, 0.45, 0.75, 4, 0.12, 0.25); patch(Pf, 3.45, 2.75, 3, 0.1, 0.12);
  patch(Pr, 0.1, 0.9, 5); patch(Pr, -0.2, 2.6, 3, 0.3, 0.15); patch(Pb, -0.9, 2.4, 5, 0.35); patch(Pb, 1.3, 0.9, 5, 0.35); patch(Pl, -2.9, 1.6, 5, 0.4); patch(Pl, 2.9, 2.2, 4, 0.4);

  // ---------------- timber: front beam under the eaves (runs under the gable too), its poking ends on corbels
  add(rbox(W + 0.6, 0.24, 0.24, 0.05, timber), MX, H - 0.15, 0.08, 0, 0, 0, Pf);
  for (const x of [XL - 0.18, XR + 0.18]) add(rbox(0.22, 0.28, 0.28, 0.05, timber), x, H - 0.4, 0.1, 0, 0, 0, Pf);
  add(rbox(W + 0.6, 0.24, 0.24, 0.05, timber), -MX, H - 0.15, 0.08, 0, 0, 0, Pb);

  // ---------------- roofs (all in 'roof'): individual clay tiles (instanced), timber decks, bargeboards, ridge caps
  RO = true;
  const tilePal = [0xffffff, 0xfff1e2, 0xffe4cc, 0xf6d2b4, 0xffd9b0, 0xe9c2a2, 0xfff8ee].map((h) => new THREE.Color(h));
  const deckMat = M(0x7a5236, null);
  const slope = (half, rise) => ({ theta: Math.atan2(rise, half), run: Math.hypot(half, rise) });
  const deck = (P, sx, theta, ridgeY, s0, s1, z0, z1) => {
    const sm = (s0 + s1) / 2;
    add(rbox(s1 - s0, 0.12, z1 - z0, 0.04, deckMat), sx * Math.cos(theta) * sm, ridgeY - Math.sin(theta) * sm - 0.08, (z0 + z1) / 2, 0, 0, sx * -theta, P);
  };
  const barge = (P, sx, theta, ridgeY, len, z) => {
    add(rbox(len + 0.1, 0.32, 0.12, 0.04, timber), sx * Math.cos(theta) * len / 2, ridgeY - Math.sin(theta) * len / 2 - 0.2, z, 0, 0, sx * -theta, P);
  };
  // tiles for one gable roof in frame P: ridge along local z from za to zb, slopes fall to x = ±half at eaveY
  const tiles = (P, half, rise, eaveY, za, zb, over, skip) => {
    const { theta, run } = slope(half, rise), slopeLen = run + over, ridgeY = eaveY + rise + 0.12;
    const stepDown = 0.33, tileW = 0.31, len = zb - za;
    const rows = Math.floor(slopeLen / stepDown), cols = Math.floor(len / tileW), z0 = za + (len - cols * tileW) / 2;
    const o = new THREE.Object3D(), w = new THREE.Vector3();
    for (const sx of [-1, 1]) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const sdist = 0.2 + r * stepDown + jr(-0.02, 0.02);
      const z = z0 + tileW * 0.5 + c * tileW + jr(-0.015, 0.015);
      const sag = Math.sin(((z - za) / len) * PI) * 0.05 + jr(-0.015, 0.02);     // gently sagging hand-laid roof
      o.position.set(sx * Math.cos(theta) * sdist, ridgeY + 0.06 - Math.sin(theta) * sdist - sag * 0.4, z);
      o.rotation.set(0, 0, sx < 0 ? PI / 2 + theta : -(PI / 2 + theta));
      if (sx > 0) o.rotateY(PI);
      o.rotateY(jr(-0.04, 0.04)); o.rotateZ(jr(-0.03, 0.03)); o.scale.set(1, jr(0.95, 1.05), 1); o.updateMatrix();
      const col = tilePal[Math.floor(rr() * tilePal.length)].clone().offsetHSL(0, jr(-0.05, 0.05), jr(-0.05, 0.04));
      const m = o.matrix.clone().premultiply(P.matrix);
      if (skip) { w.setFromMatrixPosition(m); if (skip(w, sx)) continue; }
      pushM('tile', m, col);
    }
    return { theta, slopeLen, ridgeY };
  };
  const ridgeMat = M(0xffcfa8, tex('terracotta', 1, 3));
  const tileTop = (u, half, rise) => H + rise * (1 - Math.abs(u) / half) + 0.18;   // tile-surface height of a slope
  {
    // main roof: frame turned so local z runs along world x; local -x slope = front
    const P = frame(MX, 0, PI / 2, roof), OV = 0.5;
    const za = -W / 2 - OV, zb = W / 2 + OV;
    const { theta, slopeLen, ridgeY } = tiles(P, FRONT, RISE, H, za, zb, 0.55, (w, sx) => {
      if (sx > 0 || w.x < CX - WC / 2 - 0.1) return false;                       // back slope / left of the cross-gable: keep
      return w.x > XR + 0.02 || w.z > FRONT - 0.05 || w.y < tileTop(w.x - CX, WC / 2, RISEC) + 0.02;
    });
    const run = slope(FRONT, RISE).run;
    deck(P, 1, theta, ridgeY, 0, slopeLen, za, zb);
    deck(P, -1, theta, ridgeY, 0, slopeLen, za, CX - WC / 2 - 0.05 - MX);
    deck(P, -1, theta, ridgeY, 0, run - 0.12, CX - WC / 2 - MX, XR - MX);
    for (const sx of [-1, 1]) barge(P, sx, theta, ridgeY, slopeLen, za - 0.02);
    barge(P, 1, theta, ridgeY, slopeLen, zb + 0.02);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, zb - za + 0.1, 10), ridgeMat), 0, ridgeY + 0.08, 0, PI / 2, 0, 0, P);
    // purlin ends + carved brackets on both end gables
    for (const t of [0.3, 0.62]) for (const sx of [-1, 1]) {
      const px = sx * FRONT * t, py = H + RISE * (1 - t) - 0.2;
      for (const G of [RPl, RPr]) {
        add(rbox(0.2, 0.2, 0.5, 0.05, timber), px, py, 0.25, 0, 0, 0, G);
        add(rbox(0.14, 0.3, 0.14, 0.04, timber), px, py - 0.22, 0.12, 0.6, 0, 0, G);
      }
    }
  }
  {
    // cross-gable roof over the shop: ridge along +z from where it meets the main slope out past the front wall
    const P = frame(CX, 0, 0, roof), za = ZC0 - 0.6, zb = FRONT + 0.5;
    const { theta, slopeLen, ridgeY } = tiles(P, WC / 2, RISEC, H, za, zb, 0.45, (w) => w.x < XR && w.y < tileTop(w.z, FRONT, RISE) - 0.04);
    for (const sx of [-1, 1]) { deck(P, sx, theta, ridgeY, 0, slopeLen, za, zb); barge(P, sx, theta, ridgeY, slopeLen, zb + 0.02); }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, zb - ZC0 + 0.1, 10), ridgeMat), 0, ridgeY + 0.08, (zb + ZC0) / 2, PI / 2, 0, 0, P);
    for (const t of [0.3, 0.62, 0.92]) for (const sx of [-1, 1]) {
      const px = CX + sx * (WC / 2) * t, py = H + RISEC * (1 - t) - 0.2;
      add(rbox(0.2, 0.2, 0.5, 0.05, timber), px, py, 0.2, 0, 0, 0, RPf);
      add(rbox(0.14, 0.3, 0.14, 0.04, timber), px, py - 0.22, 0.07, 0.6, 0, 0, RPf);
    }
  }
  // ---------------- big stone chimney astride the ridge (the oven and the kitchen hearth share it): core + dressed stone courses, cap, pot
  const CHX = -2.15;
  {
    const cx = CHX, cz = 0, CW = 1.05, CD = 0.95, y0 = H + RISE - 0.8, top = H + RISE + 1.15;
    add(rbox(CW - 0.16, top - y0, CD - 0.16, 0.05, M(0x8f8574, null)), cx, (top + y0) / 2, cz, 0, 0, 0, roof);              // dark mortar core
    for (let j = 0, y = y0; y < top - 0.15; j++) {
      const ch = Math.min(jr(0.3, 0.42), top - y);
      const faces = [[0, CD / 2, CW, 0], [0, -CD / 2, CW, 0], [CW / 2, 0, CD, PI / 2], [-CW / 2, 0, CD, PI / 2]];
      faces.forEach(([fx, fz, len, ry], fi) => {
        const nx = Math.sign(fx) * -0.07, nz = Math.sign(fz) * -0.07;
        const n = (j + fi) % 2 ? 2 : 3, ws = Array.from({ length: n }, () => jr(0.7, 1.3)), sum = ws.reduce((p, q) => p + q, 0);
        let a = -len / 2 - 0.02;
        for (const wv of ws) {
          const l = (wv / sum) * (len + 0.04), off = a + l / 2; a += l;
          const ox = ry ? 0 : off, oz = ry ? off : 0;
          put('rblock', roof, cx + fx + nx + ox + jr(-0.01, 0.01), y + ch / 2, cz + fz + nz + oz, jr(-0.03, 0.03), ry, jr(-0.03, 0.03), l - 0.035, ch - 0.035, 0.18, stoneCol());
        }
      });
      y += ch;
    }
    add(rbox(CW + 0.2, 0.18, CD + 0.2, 0.06, stoneSlab), cx, top + 0.05, cz, 0, 0, 0, roof);
    add(rbox(CW - 0.1, 0.26, CD - 0.1, 0.06, stoneSlab), cx, top + 0.27, cz, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.42, 12), terracotta), cx + 0.18, top + 0.6, cz, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 6, 14), terracotta), cx + 0.18, top + 0.8, cz, PI / 2, 0, 0, roof);
  }
  RO = false;

  // ---------------- open arched doorway in a stone surround; the plank door (with its little lit window) swung back inside
  {
    holes.f.push([doorX - DR, doorX + DR, 0, DSPRING + DR]);
    spandrels(doorX, DSPRING, DR, IZ, FW);
    for (let i = 0; i <= 11; i++) {
      const a = (i / 11) * PI, rad = DR + 0.17;
      block(Pf, doorX + Math.cos(a) * rad, DSPRING + Math.sin(a) * rad, 0.03, 0.26, 0.24, 0.24, a - PI / 2);
    }
    for (const sxx of [-1, 1]) for (let j = 0; j < 5; j++) {
      const wide = (j + (sxx > 0 ? 1 : 0)) % 2 === 0;
      block(Pf, doorX + sxx * (DR + (wide ? 0.21 : 0.16)), 0.2 + j * 0.37, 0.03, wide ? 0.34 : 0.24, 0.34, 0.24);
    }
    add(rbox(1.9, 0.1, 0.62, 0.04, stoneSlab), doorX, 0.05, 0.3, 0, 0, 0, Pf);
    add(rbox(2 * DR + 0.02, FL + 0.01, FW - IZ + 0.02, 0.01, stoneSlab, 1), doorX, (FL + 0.01) / 2, (IZ + FW) / 2);
    // door leaf: built facing out, turned round flat against the inner face of the front wall, left of the opening
    const r = DR - 0.04, dh = DSPRING - FL, lg = new THREE.Group();
    const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, dh); s.absarc(0, dh, r, 0, PI, false); s.lineTo(-r, 0);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }), doorWood), 0, 0, 0, 0, 0, 0, lg);
    for (let k = -3; k <= 3; k++) add(rbox(0.025, 1.0, 0.02, 0.008, darkWood), k * 0.19, 0.55, 0.1, 0, 0, 0, lg);
    add(rbox(2 * r * 0.94, 0.07, 0.03, 0.015, iron), 0, 0.45, 0.11, 0, 0, 0, lg);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 18), iron), -r + 0.22, 1.0, 0.12, 0, 0, 0, lg);
    const gw = 0.56, ws = new THREE.Shape();
    ws.moveTo(-gw / 2, 0); ws.lineTo(gw / 2, 0); ws.lineTo(gw / 2, 0.34); ws.absarc(0, 0.34, gw / 2, 0, PI, false); ws.lineTo(-gw / 2, 0);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(ws, { depth: 0.02, bevelEnabled: false, curveSegments: 10 }), warmGlass), 0, 1.25, 0.09, 0, 0, 0, lg);
    add(rbox(0.04, 0.6, 0.04, 0.012, darkWood), 0, 1.55, 0.12, 0, 0, 0, lg);
    add(rbox(gw, 0.04, 0.04, 0.012, darkWood), 0, 1.52, 0.12, 0, 0, 0, lg);
    add(rbox(gw + 0.1, 0.06, 0.06, 0.02, darkWood), 0, 1.22, 0.12, 0, 0, 0, lg);
    lg.position.set(doorX - DR - 0.04 - r, FL, IZ - 0.03); lg.rotation.y = PI; root.add(lg);
  }
  // ---------------- iron wall lanterns with warm glass (only the door one carries a real light)
  const lantern = (P, lx, ly, light) => {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14, PI / 2), iron), lx - 0.02, ly + 0.08, 0.11, 0, PI / 2, 0, P);
    add(rbox(0.06, 0.2, 0.04, 0.015, iron), lx - 0.02, ly + 0.02, 0.02, 0, 0, 0, P);
    add(rbox(0.22, 0.3, 0.22, 0.03, glow), lx + 0.02, ly - 0.08, 0.27, 0, 0, 0, P);
    add(rbox(0.28, 0.05, 0.28, 0.02, iron), lx + 0.02, ly + 0.09, 0.27, 0, 0, 0, P);
    add(rbox(0.26, 0.04, 0.26, 0.02, iron), lx + 0.02, ly - 0.25, 0.27, 0, 0, 0, P);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 4), iron), lx + 0.02, ly + 0.19, 0.27, 0, PI / 4, 0, P);
    if (light && opts.light !== false) {
      const pl = new THREE.PointLight(0xffb45a, 1.2, 4, 2);
      pl.position.copy(new THREE.Vector3(lx + 0.02, ly - 0.1, 0.42).applyMatrix4(P.matrix)); root.add(pl);
    }
  };
  lantern(Pf, 0.55, 2.35, true);
  lantern(Pr, -0.35, 2.35, false);

  // ---------------- windows: rectangular with board shutters (real openings, warm pane + sill inside), round-arched attic window
  const shutter = (P, x, y, w, h, side, z = 0.08) => {
    const sh = new THREE.Group();
    for (let k = 0; k < 3; k++) add(rbox(w / 3 - 0.012, h, 0.05, 0.012, shutterMat, 1), (k - 1) * (w / 3), 0, 0, 0, 0, 0, sh);
    for (const yy of [h * 0.3, -h * 0.3]) add(rbox(w * 0.9, 0.07, 0.03, 0.01, M(0x5e7f52, null), 1), 0, yy, 0.035, 0, 0, 0, sh);
    sh.position.set(x, y, z); sh.rotation.y = -side * 0.22; P.add(sh);
  };
  const flowerBox = (P, x, y, w, cols, n) => {
    add(rbox(w, 0.24, 0.3, 0.04, timberLight), x, y, 0.17, 0, 0, 0, P);
    for (let k = 0; k < w * 34; k++) leaf(P, x + jr(-w / 2, w / 2), y + 0.12 + jr(-0.02, 0.16), 0.2 + jr(-0.1, 0.16));
    for (let k = 0; k < w * 10; k++) leaf(P, x + jr(-w / 2, w / 2), y - jr(0, 0.25), 0.34 + jr(0, 0.05));       // trailing over the front
    for (let k = 0; k < n; k++) bloom(P, x + jr(-w / 2 + 0.05, w / 2 - 0.05), y + 0.18 + jr(0, 0.2), 0.19 + jr(-0.1, 0.13), cols[k % cols.length]);
  };
  const windowUnit = (P, face, x, y, w, h, flowers) => {
    const fr = 0.08;
    add(rbox(w, h, 0.06, 0.02, glass), x, y, 0.0, 0, 0, 0, P);
    add(rbox(w + fr * 2, fr, 0.14, 0.03, timberLight), x, y + h / 2 + fr / 2, 0.03, 0, 0, 0, P);
    add(rbox(w + fr * 2.6, fr * 1.4, 0.24, 0.03, timberLight), x, y - h / 2 - fr * 0.6, 0.08, 0, 0, 0, P);
    for (const s of [-1, 1]) add(rbox(fr, h, 0.14, 0.03, timberLight), x + s * (w / 2 + fr / 2), y, 0.03, 0, 0, 0, P);
    add(rbox(0.045, h, 0.08, 0.015, timberLight), x, y, 0.05, 0, 0, 0, P);
    add(rbox(w, 0.045, 0.08, 0.015, timberLight), x, y + h * 0.12, 0.05, 0, 0, 0, P);
    for (const s of [-1, 1]) shutter(P, x + s * (w / 2 + fr + w * 0.28 + 0.02), y, w * 0.56, h + 0.06, s);
    block(P, x, y + h / 2 + 0.2, 0.02, w + 0.5, 0.22, 0.14);                     // stone lintel
    if (flowers) flowerBox(P, x, y - h / 2 - 0.25, w + 0.25, flowers, 22);
    // the opening through the wall: warm pane seen from inside, glazing bars, a deep timber sill
    holes[face].push([(face === 'f' ? x : -x) - w / 2, (face === 'f' ? x : -x) + w / 2, y - h / 2, y + h / 2]);
    add(rbox(w, h, 0.02, 0.006, warmGlass, 1), x, y, -0.05, 0, 0, 0, P);
    add(rbox(0.04, h, 0.04, 0.01, timberLight, 1), x, y, -0.08, 0, 0, 0, P);
    add(rbox(w, 0.04, 0.04, 0.01, timberLight, 1), x, y + h * 0.12, -0.08, 0, 0, 0, P);
    add(rbox(w + 0.24, 0.06, 0.2, 0.02, timberLight, 1), x, y - h / 2 - 0.03, -T - 0.07, 0, 0, 0, P);
  };
  const GERANIUM = [0xe8443a, 0xd93a3a, 0xf06a5a, 0xc92f3a];
  windowUnit(Pr, 'r', -2.0, 1.75, 0.75, 0.85, GERANIUM);                    // shop, over the counter
  windowUnit(Pr, 'r', 2.0, 1.75, 0.75, 0.85, [0xf4a2c0, 0xffffff, 0xf06a8a]); // kitchen
  windowUnit(Pb, 'b', 0.75, 1.75, 0.7, 0.85, [0xf4a2c0, 0xffd23f, 0xf06a8a]);
  windowUnit(Pb, 'b', -2.3, 1.75, 0.7, 0.85, null);
  RO = true;
  {
    // attic window in the cross-gable: round-arched, stone voussoirs, open shutters, box of white flowers
    const P = RPf, x = CX, y0 = H + 0.22, w = 0.62, hs = 0.36, r = w / 2;
    const s = new THREE.Shape();
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, hs); s.absarc(0, hs, r, 0, PI, false); s.lineTo(-r, 0);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false, curveSegments: 12 }), warmGlass), x, y0, -0.01, 0, 0, 0, P);
    for (const sx of [-1, 1]) add(rbox(0.08, hs, 0.12, 0.03, timberLight), x + sx * (r + 0.04), y0 + hs / 2, 0.04, 0, 0, 0, P);
    add(new THREE.Mesh(new THREE.TorusGeometry(r + 0.04, 0.045, 6, 14, PI), timberLight), x, y0 + hs, 0.06, 0, 0, 0, P);
    add(rbox(0.04, hs + r, 0.05, 0.012, timberLight), x, y0 + (hs + r) / 2, 0.05, 0, 0, 0, P);
    add(rbox(w, 0.04, 0.05, 0.012, timberLight), x, y0 + hs, 0.05, 0, 0, 0, P);
    for (let i = 0; i <= 9; i++) { const a = (i / 9) * PI, rad = r + 0.17; block(P, x + Math.cos(a) * rad, y0 + hs + Math.sin(a) * rad, 0.02, 0.2, 0.18, 0.15, a - PI / 2); }
    for (const sx of [-1, 1]) for (let j = 0; j < 2; j++) block(P, x + sx * (r + (j ? 0.15 : 0.19)), y0 + 0.08 + j * 0.2, 0.02, j ? 0.2 : 0.28, 0.18, 0.15);
    for (const sx of [-1, 1]) shutter(P, x + sx * (r + 0.24), y0 + (hs + r) / 2, 0.3, hs + r + 0.04, sx, 0.1);
    flowerBox(P, x, y0 - 0.2, 0.85, [0xffffff, 0xfff6e0, 0xf6f0ff, 0xffe066], 26);
  }
  for (const P of [RPl, RPr]) {
    // round windows high in both end gables
    const y = H + 1.35;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), glass), 0, y, 0.0, PI / 2, 0, 0, P);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 16), timberLight), 0, y, 0.05, 0, 0, 0, P);
    add(rbox(0.04, 0.58, 0.04, 0.012, timberLight), 0, y, 0.04, 0, 0, 0, P);
    add(rbox(0.58, 0.04, 0.04, 0.012, timberLight), 0, y, 0.04, 0, 0, 0, P);
    for (let i = 0; i < 11; i++) { const a = (i / 11) * PI * 2; block(P, Math.cos(a) * 0.49, y + Math.sin(a) * 0.49, 0.02, 0.2, 0.16, 0.13, a - PI / 2); }
  }
  RO = false;

  // ---------------- bay shop window under a striped fabric awning: its bread shelves run through the wall into the shop
  {
    const P = Pf, BW = B1 - B0;
    holes.f.push([B0 + 0.05, B1 - 0.05, 0.86, 2.4]);
    add(rbox(BW, 0.8, BD, 0.05, plaster), CX, 0.4, BD / 2, 0, 0, 0, P);                                      // plastered stone riser
    for (let x = B0 + 0.05; x < B1 - 0.1;) { const w = jr(0.3, 0.46); peb(P, Math.min(x + w / 2, B1 - 0.2), 0.12, BD + 0.02, w, 0.22, 0.14); x += w * 0.95; }
    for (let k = 0; k < 5; k++) peb(P, B0 + jr(0.2, BW - 0.2), jr(0.35, 0.65), BD + 0.0, jr(0.22, 0.34), jr(0.15, 0.22), 0.08);
    add(rbox(BW + 0.16, 0.08, BD + 0.42, 0.03, timberLight), CX, 0.84, (BD - 0.32) / 2 + 0.02, 0, 0, 0, P);   // sill / bottom shelf, right through the wall
    for (const y of [1.33, 1.83]) add(rbox(BW - 0.2, 0.05, BD + 0.26, 0.015, timberLight), CX, y - 0.025, (BD - 0.3) / 2, 0, 0, 0, P);
    for (const x of [B0 + 0.06, B1 - 0.06]) add(rbox(0.12, 1.56, BD, 0.03, timber), x, 1.62, BD / 2, 0, 0, 0, P);
    for (const x of [CX - 0.4, CX + 0.4]) add(rbox(0.06, 1.5, 0.06, 0.02, timberLight), x, 1.62, BD - 0.03, 0, 0, 0, P);
    add(rbox(BW - 0.1, 0.05, 0.06, 0.02, timberLight), CX, 2.14, BD - 0.03, 0, 0, 0, P);
    add(rbox(BW - 0.16, 1.5, 0.02, 0.005, clearGlass, 1), CX, 1.62, BD - 0.06, 0, 0, 0, P);                   // clear glazing: the bread shows from both sides
    add(rbox(BW + 0.2, 0.22, BD + 0.12, 0.05, timber), CX, 2.49, BD / 2 + 0.04, 0, 0, 0, P);                // cornice
    add(rbox(BW + 0.3, 0.06, BD + 0.18, 0.02, timberLight), CX, 2.62, BD / 2 + 0.05, 0, 0, 0, P);
    // the bread: boules and batards below, crusty loaves on the middle shelf, baguettes and rolls on top — a row facing out, a row facing in
    for (const zr of [BD / 2, -0.17]) {
      for (let x = B0 + 0.3; x < B1 - 0.2; x += jr(0.27, 0.33)) rr() < 0.5 ? loaf(P, x, 0.88, zr, 0.24, 0.16, 0.24, 0) : loaf(P, x, 0.88, zr, 0.3, 0.15, 0.18, jr(-0.4, 0.4));
      for (let x = B0 + 0.28; x < B1 - 0.2; x += jr(0.25, 0.3)) loaf(P, x, 1.33, zr, 0.28, 0.14, 0.17, jr(-0.5, 0.5));
      for (let k = 0; k < 4; k++) loaf(P, B0 + 0.45 + k * 0.48, 1.83, zr + jr(-0.05, 0.05), 0.46, 0.08, 0.09, jr(-0.25, 0.25));
      for (let k = 0; k < 5; k++) loaf(P, B0 + 0.25 + k * 0.48, 1.83, zr - 0.08, 0.12, 0.09, 0.12, 0);
    }
    // awning: curved fabric stripes, scalloped valance, iron arms
    const AW = 2.9, N = 12, sw = AW / N, top = 2.86, drop = 0.62, out = 1.15;
    const prof = new THREE.Shape(), pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([t * out, -drop * (0.35 * t + 0.65 * t * t)]); }
    prof.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([a, b]) => prof.lineTo(a, b));
    for (let i = pts.length - 1; i >= 0; i--) prof.lineTo(pts[i][0], pts[i][1] - 0.035);
    const stripeGeo = new THREE.ExtrudeGeometry(prof, { depth: sw, bevelEnabled: false });
    stripeGeo.rotateY(-PI / 2); stripeGeo.translate(sw / 2, 0, 0);
    const val = new THREE.Shape();
    val.moveTo(-sw / 2, 0); val.lineTo(sw / 2, 0); val.lineTo(sw / 2, -0.14); val.absarc(0, -0.14, sw / 2, 0, PI, true); val.lineTo(-sw / 2, 0);
    const valGeo = new THREE.ExtrudeGeometry(val, { depth: 0.03, bevelEnabled: false, curveSegments: 6 });
    for (let i = 0; i < N; i++) {
      const m = i % 2 ? awnCream : awnRed, x = CX - AW / 2 + sw * (i + 0.5);
      add(new THREE.Mesh(stripeGeo, m), x, top, 0.04, 0, 0, 0, P);
      add(new THREE.Mesh(valGeo, m), x, top - drop - 0.01, out + 0.025, 0, 0, 0, P);
    }
    add(rbox(AW + 0.08, 0.08, 0.1, 0.03, timber), CX, top + 0.02, 0.06, 0, 0, 0, P);                       // fixing batten
    for (const sx of [-1, 1]) {
      const x = CX + sx * (AW / 2 - 0.06), y0 = 2.0, y1 = top - drop, L = Math.hypot(out, y1 - y0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, L, 6), iron), x, (y0 + y1) / 2, out / 2 + 0.03, Math.atan2(out, y1 - y0), 0, 0, P);
    }
  }

  // ---------------- ground-storey walls (real thickness, holes for doorway and windows), partition with its archway, floor
  wallRun(true, XL - 0.05, XR + 0.05, IZ, FW, holes.f);
  wallRun(true, XL - 0.05, XR + 0.05, -FW, -IZ, holes.b);
  wallRun(false, -IZ, IZ, XL - 0.05, IXL, []);
  wallRun(false, -IZ, IZ, IXR, XR + 0.05, holes.r);
  wallRun(true, IXL, IXR, PZ - 0.1, PZ + 0.1, [[AX - AR, AX + AR, 0, ASPRING + AR]]);
  spandrels(AX, ASPRING, AR, PZ - 0.1, PZ + 0.1);
  slab(IXL, IXR, 0, FL, -IZ, IZ, floorMat);
  for (const [x0, x1, z0, z1] of [[XL - 0.05, XR + 0.05, IZ, FW], [XL - 0.05, XR + 0.05, -FW, -IZ], [XL - 0.05, IXL, -IZ, IZ], [IXR, XR + 0.05, -IZ, IZ], [IXL, IXR, PZ - 0.1, PZ + 0.1]]) slab(x0, x1, H, H + 0.04, z0, z1, timber);   // wall-top plates
  C(XL - 0.05, doorX - DR, IZ, FW); C(doorX + DR, XR + 0.05, IZ, FW); C(B0, B1, FW, FW + BD);
  C(XL - 0.05, XR + 0.05, -FW, -IZ); C(XL - 0.05, IXL, -IZ, IZ); C(IXR, XR + 0.05, -IZ, IZ);
  C(IXL, AX - AR, PZ - 0.1, PZ + 0.1); C(AX + AR, IXR, PZ - 0.1, PZ + 0.1);
  // stone voussoirs + jambs round the archway, on both faces
  for (const zf of [PZ + 0.11, PZ - 0.11]) {
    for (let i = 0; i <= 9; i++) { const a = (i / 9) * PI; block(root, AX + Math.cos(a) * (AR + 0.15), ASPRING + Math.sin(a) * (AR + 0.15), zf, 0.26, 0.22, 0.07, a - PI / 2); }
    for (const sx of [-1, 1]) for (let j = 0; j < 5; j++) { const wide = (j + (sx > 0 ? 1 : 0)) % 2 === 0; block(root, AX + sx * (AR + (wide ? 0.18 : 0.13)), 0.22 + j * 0.37, zf, wide ? 0.32 : 0.22, 0.33, 0.07); }
  }

  // ================= SHOP =================
  const wallLamp = (x, y, z, ry) => {
    const g = new THREE.Group();
    add(rbox(0.08, 0.22, 0.04, 0.015, iron, 1), 0, 0.12, 0.02, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 12, PI / 2), iron), 0, 0.1, 0.14, 0, PI / 2, 0, g);
    add(rbox(0.2, 0.26, 0.2, 0.03, glow, 1), 0, -0.06, 0.26, 0, 0, 0, g);
    add(rbox(0.26, 0.05, 0.26, 0.02, iron, 1), 0, 0.1, 0.26, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 4), iron), 0, 0.19, 0.26, 0, PI / 4, 0, g);
    g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
  };
  // ---- domed brick bread oven against the partition: stone base, iron ash door, arched mouth with fire and loaves, flue up to the chimney
  {
    const ox = CHX, x0 = IXL, x1 = -1.25, z0 = PZ + 0.1, z1 = 1.75, oz = 0.85, base = 0.9, R = 0.8;
    rb((x0 + x1) / 2, base / 2, (z0 + z1) / 2, x1 - x0, base, z1 - z0, stoneSlab, 0.04);
    for (let row = 0; row < 3; row++) for (let x = x0 + 0.05 + (row % 2) * 0.18; x < x1 - 0.1;) { const w = Math.min(jr(0.3, 0.42), x1 - 0.05 - x); block(root, x + w / 2, 0.15 + row * 0.29, z1 + 0.01, w - 0.03, 0.26, 0.08); x += w; }
    for (let k = 0; k < 6; k++) block(root, x1 + 0.01, 0.15 + (k % 3) * 0.29, z0 + 0.3 + Math.floor(k / 3) * 0.7 + jr(-0.1, 0.1), 0.08, 0.26, 0.5);
    rb(ox, 0.42, z1 + 0.02, 0.62, 0.42, 0.04, iron, 0.02); ib(ox, 0.42, z1 + 0.045, 0.5, 0.32, 0.01, 0x55504a); ic(ox + 0.18, 0.42, z1 + 0.07, 0.03, 0.04, 0x8a8075, PI / 2);
    rb((x0 + x1) / 2, base + 0.04, (z0 + z1) / 2, x1 - x0 + 0.06, 0.08, z1 - z0 + 0.06, stoneSlab, 0.02);
    add(new THREE.Mesh(new THREE.SphereGeometry(R, 20, 10, 0, PI * 2, 0, PI / 2), brick), ox, base + 0.06, oz);
    // arched mouth: a stone portal on the dome front, fire glowing inside, loaves at its lip
    const mz = oz + R - 0.1, mr = 0.3, my = base + 0.12;
    rb(ox, my + 0.32, mz + 0.06, 0.95, 0.66, 0.3, stoneSlab, 0.06);
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * PI; block(root, ox + Math.cos(a) * (mr + 0.1), my + 0.14 + Math.sin(a) * (mr + 0.1), mz + 0.22, 0.17, 0.15, 0.08, a - PI / 2); }
    const ms = new THREE.Shape(); ms.moveTo(-mr, 0); ms.lineTo(mr, 0); ms.lineTo(mr, 0.14); ms.absarc(0, 0.14, mr, 0, PI, false); ms.lineTo(-mr, 0);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(ms, { depth: 0.02, bevelEnabled: false, curveSegments: 10 }), ember), ox, my, mz + 0.215);
    for (let k = 0; k < 7; k++) put('flame', root, ox + jr(-0.2, 0.2), my + 0.13, mz + 0.25, 0, 0, jr(-0.2, 0.2), jr(0.07, 0.12), jr(0.18, 0.32), 0.04, new THREE.Color(pick([0xffd060, 0xffa030, 0xff8020])));
    for (const dx of [-0.16, 0.0, 0.16]) loaf(root, ox + dx, my, mz + 0.3, 0.16, 0.08, 0.13, jr(-0.3, 0.3));
    for (let k = 0; k < 10; k++) block(root, ox + jr(-0.45, 0.45), base + 0.1 + jr(0, 0.15), oz + jr(-0.7, 0.2) * (k % 2 ? 1 : -1), 0.18, 0.12, 0.12);
    // flue: stone stack from the dome to the ceiling (the chimney above)
    rb(ox, (base + R + H) / 2, z0 + 0.32, 0.7, H - base - R + 0.1, 0.6, stoneSlab, 0.04);
    for (let y = base + R + 0.05; y < H - 0.2; y += 0.3) for (const dx of [-0.17, 0.17]) block(root, ox + dx + jr(-0.03, 0.03), y + 0.13, z0 + 0.63, 0.3, 0.26, 0.06);
    // bread peel leaning on the oven
    add(rbox(0.04, 1.6, 0.04, 0.015, timberLight, 1), x1 + 0.12, 0.85, z1 - 0.1, 0.12, 0, -0.12);
    add(rbox(0.3, 0.36, 0.03, 0.01, timberLight, 1), x1 + 0.22, 1.62, z1 - 0.0, 0.12, 0, -0.12);
    C(x0, x1 + 0.05, z0, z1 + 0.1);
  }
  // ---- wall shelves of crocks on the left wall, a pot plant trailing down, copper pans hanging below
  {
    const x = IXL;
    for (const y of [1.55, 2.1]) { rb(x + 0.15, y, 2.65, 0.3, 0.05, 1.3, timber, 0.01); for (const z of [2.15, 3.15]) add(rbox(0.04, 0.22, 0.2, 0.01, timber, 1), x + 0.1, y - 0.12, z, 0.7, PI / 2, 0); }
    for (const [y, zs] of [[1.58, [2.15, 2.4, 2.7]], [2.13, [2.15, 2.45, 3.2]]]) for (const z of zs) { const hh = jr(0.18, 0.26); ic(x + 0.15, y + hh / 2, z, jr(0.08, 0.1), hh, CREAM); ic(x + 0.15, y + hh + 0.02, z, 0.07, 0.04, 0x8a5a3a); }
    ic(x + 0.15, 1.66, 3.15, 0.11, 0.17, 0xd98c5a);
    for (let k = 0; k < 18; k++) leaf(root, x + 0.15 + jr(-0.12, 0.12), 1.8 + jr(-0.05, 0.12), 3.15 + jr(-0.14, 0.14));
    for (let k = 0; k < 14; k++) leaf(root, x + 0.3 + jr(0, 0.04), 1.55 - k * 0.07, 3.1 + jr(-0.1, 0.1));
    for (const [z, r] of [[2.2, 0.12], [2.45, 0.1], [2.68, 0.14]]) { ic(x + 0.1, 1.2 - r, z, r, 0.05, COPPER, 0, 0, PI / 2); ib(x + 0.1, 1.38, z, 0.02, 0.2, 0.03, COPPER); }
    ib(x + 0.06, 1.48, 2.45, 0.03, 0.03, 0.8, 0x3b3530);
  }
  // ---- kneading table dusted with flour: bowl, rolling pin, towel; baskets and a crate on the shelf underneath
  {
    const tx = -2.35, tz = 2.45, tw = 1.25, td = 0.8;
    rb(tx, FL + 0.84, tz, tw, 0.08, td, timberLight, 0.02);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rb(tx + sx * (tw / 2 - 0.08), FL + 0.4, tz + sz * (td / 2 - 0.08), 0.09, 0.8, 0.09, timber, 0.02);
    rb(tx, FL + 0.22, tz, tw - 0.1, 0.04, td - 0.1, timber, 0.01);
    ib(tx + 0.1, FL + 0.885, tz, 0.8, 0.005, 0.5, WHITE, 0.3);
    ic(tx - 0.3, FL + 0.95, tz - 0.1, 0.2, 0.13, 0xc8925a); put('bread', root, tx - 0.3, FL + 1.01, tz - 0.1, 0, 0, 0, 0.33, 0.12, 0.33, new THREE.Color(WHITE));
    ic(tx + 0.25, FL + 0.92, tz + 0.05, 0.035, 0.5, 0xe2b880, 0, 0.5, PI / 2); for (const s of [-1, 1]) ic(tx + 0.25 + s * 0.3 * Math.cos(0.5), FL + 0.92, tz + 0.05 - s * 0.3 * Math.sin(0.5), 0.015, 0.12, 0xc8925a, 0, 0.5, PI / 2);
    ib(tx + 0.5, FL + 0.7, tz + td / 2 + 0.01, 0.32, 0.4, 0.015, WHITE); for (const dy of [-0.08, 0.06]) ib(tx + 0.5, FL + 0.7 + dy, tz + td / 2 + 0.02, 0.32, 0.03, 0.012, CLOTH_RED);
    ic(tx - 0.3, FL + 0.32, tz, 0.17, 0.16, HAY); ic(tx + 0.1, FL + 0.32, tz, 0.15, 0.15, HAY); for (let k = 0; k < 3; k++) loaf(root, tx - 0.3 + jr(-0.06, 0.06), FL + 0.38, tz + jr(-0.06, 0.06), 0.1, 0.06, 0.1);
    ib(tx + 0.42, FL + 0.38, tz, 0.3, 0.28, 0.4, 0xb88a58);
    C(tx - tw / 2 - 0.02, tx + tw / 2 + 0.02, tz - td / 2 - 0.02, tz + td / 2 + 0.02);
  }
  // ---- tall bread shelves on the partition: loaves, baskets of rolls, a towel over the low bench
  {
    const x0 = 0.95, x1 = 2.55, z0 = PZ + 0.1, dep = 0.45, top = 2.15, xm = (x0 + x1) / 2;
    for (const x of [x0, xm, x1]) rb(x, top / 2, z0 + dep / 2, 0.07, top, dep, timber, 0.015);
    for (const y of [0.45, 0.95, 1.5, top]) rb(xm, y, z0 + dep / 2, x1 - x0 + 0.05, 0.05, dep, timber, 0.012);
    rb(xm, 0.2, z0 + dep / 2, x1 - x0 - 0.1, 0.05, dep - 0.05, timber, 0.012);
    for (const y of [0.975]) for (const [a0, a1] of [[x0 + 0.08, xm - 0.06], [xm + 0.08, x1 - 0.06]]) for (let x = a0 + 0.08; x < a1; x += 0.19) loaf(root, x, y, z0 + 0.24 + jr(-0.04, 0.04), 0.2, 0.13, 0.2, jr(-0.4, 0.4));
    for (const x of [x0 + 0.38, x1 - 0.38]) { ic(x, 1.605, z0 + 0.24, 0.26, 0.16, HAY); for (let k = 0; k < 5; k++) loaf(root, x + jr(-0.14, 0.14), 1.66, z0 + 0.24 + jr(-0.11, 0.11), 0.15, 0.09, 0.13); }
    ic(x0 + 0.38, 2.15 + 0.09, z0 + 0.25, 0.26, 0.18, HAY); for (let k = 0; k < 5; k++) loaf(root, x0 + 0.38 + jr(-0.14, 0.14), 2.3, z0 + 0.25 + jr(-0.1, 0.1), 0.15, 0.09, 0.13);
    ic(x1 - 0.35, 2.15 + 0.1, z0 + 0.25, 0.2, 0.2, 0xd98c5a); for (let k = 0; k < 24; k++) leaf(root, x1 - 0.35 + jr(-0.25, 0.25), 2.35 + jr(0, 0.25), z0 + 0.25 + jr(-0.2, 0.2)); for (let k = 0; k < 10; k++) leaf(root, x1 + 0.0 + jr(0, 0.05), 2.2 - k * 0.08, z0 + 0.4 + jr(-0.05, 0.05));
    for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.24) loaf(root, x, 0.475, z0 + 0.24, 0.22, 0.14, 0.2, jr(-0.4, 0.4));
    ib(xm - 0.35, 0.36, z0 + dep + 0.005, 0.4, 0.3, 0.015, WHITE); for (const dy of [-0.06, 0.06]) ib(xm - 0.35, 0.36 + dy, z0 + dep + 0.01, 0.4, 0.03, 0.012, CLOTH_RED);
    C(x0 - 0.04, x1 + 0.04, z0, z0 + dep + 0.03);
    // chalkboard + lantern between the shelves and the counter
    ib(3.0, 1.8, z0 + 0.03, 0.72, 0.56, 0.03, 0x2f3a33); for (const [w, h, y] of [[0.84, 0.07, 2.1], [0.84, 0.07, 1.5]]) ib(3.0, y, z0 + 0.04, w, h, 0.04, 0x8a5a3a); for (const s of [-1, 1]) ib(3.0 + s * 0.4, 1.8, z0 + 0.04, 0.07, 0.66, 0.04, 0x8a5a3a);
    for (let k = 0; k < 3; k++) ib(2.95 + jr(-0.1, 0.1), 1.95 - k * 0.14, z0 + 0.05, jr(0.3, 0.5), 0.025, 0.005, 0xe8e4da);
    wallLamp(3.3, 2.45, z0 + 0.0, 0);
  }
  // ---- shop counter along the right wall: panelled front, scales, a basket of baguettes, rolls, pot of yellow flowers
  {
    const x0 = 2.7, x1 = IXR, z0 = 0.85, z1 = 3.0, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
    rb(xm, FL + 0.45, zm, x1 - x0, 0.9, z1 - z0, timberLight, 0.03);
    rb(xm - 0.03, FL + 0.93, zm, x1 - x0 + 0.12, 0.07, z1 - z0 + 0.08, timber, 0.02);
    for (let k = 0; k < 4; k++) { const z = z0 + 0.27 + k * ((z1 - z0 - 0.54) / 3); ib(x0 - 0.005, FL + 0.45, z, 0.02, 0.62, 0.38, 0xc89a62); }
    ic(xm, FL + 1.0, 1.25, 0.09, 0.06, BRASS); ib(xm, FL + 1.06, 1.25, 0.04, 0.12, 0.04, 0x3b3530); ib(xm, FL + 1.13, 1.25, 0.03, 0.03, 0.42, BRASS);
    for (const s of [-1, 1]) { ic(xm, FL + 1.09, 1.25 + s * 0.2, 0.09, 0.025, BRASS); ic(xm, FL + 1.11, 1.25 + s * 0.2, 0.012, 0.04, 0x3b3530); }
    ic(xm, FL + 1.07, 2.35, 0.28, 0.16, HAY); for (let k = 0; k < 7; k++) put('bread', root, xm + jr(-0.12, 0.12), FL + 1.3, 2.35 + jr(-0.12, 0.12), jr(-0.35, 0.35), jr(0, 3), jr(-0.3, 0.3), 0.075, 0.62, 0.075, tint(0xd99a4e, 0.06, 0.05));
    ic(xm, FL + 1.04, 1.7, 0.2, 0.1, HAY); for (let k = 0; k < 6; k++) loaf(root, xm + jr(-0.1, 0.1), FL + 1.06, 1.7 + jr(-0.1, 0.1), 0.12, 0.08, 0.12);
    ic(xm + 0.05, FL + 1.06, 2.85, 0.1, 0.16, 0xd98c5a); for (let k = 0; k < 12; k++) { leaf(root, xm + 0.05 + jr(-0.14, 0.14), FL + 1.2 + jr(0, 0.15), 2.85 + jr(-0.14, 0.14), 0.8); bloom(root, xm + 0.05 + jr(-0.12, 0.12), FL + 1.28 + jr(0, 0.12), 2.85 + jr(-0.12, 0.12), 0xffd23f, 1.1); }
    C(x0 - 0.06, x1, z0 - 0.04, z1 + 0.04);
    // pastry rack on castors in the front corner: croissants, buns, jam tarts
    const rx = 3.05, rz = 3.3;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { rb(rx + sx * 0.27, FL + 0.55, rz + sz * 0.17, 0.035, 1.1, 0.035, iron, 0.01); ic(rx + sx * 0.27, FL + 0.03, rz + sz * 0.17, 0.035, 0.05, 0x3b3530, PI / 2); }
    const PASTRY = [[0.35, 0xe0a050, [0.12, 0.06, 0.07]], [0.7, 0xc87a3a, [0.1, 0.06, 0.1]], [1.05, 0xd89a4a, [0.09, 0.04, 0.09]]];
    for (const [y, col, [a, b, c]] of PASTRY) {
      rb(rx, FL + y, rz, 0.6, 0.03, 0.38, timberLight, 0.01);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) put('bread', root, rx - 0.21 + i * 0.14, FL + y + 0.04, rz - 0.08 + j * 0.16, 0, jr(-0.5, 0.5), 0, a, b, c, tint(col, 0.06, 0.05));
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ic(rx - 0.21 + i * 0.14, FL + 1.1, rz - 0.08 + j * 0.16, 0.025, 0.012, 0xb8282a);
    C(rx - 0.3, rx + 0.3, rz - 0.2, rz + 0.2);
  }

  // ================= KITCHEN =================
  // ---- hearth on the partition (back to back with the oven, same chimney): stone jambs, mantel beam, fire under a hanging pot
  {
    const hx = CHX, x0 = hx - 0.85, x1 = hx + 0.85, z1 = PZ - 0.1, z0 = z1 - 0.7, fy = FL + 0.12;
    for (const s of [-1, 1]) rb(hx + s * 0.68, 0.68, z0 + 0.35, 0.36, 1.32, 0.7, stoneSlab, 0.04);
    for (const s of [-1, 1]) for (let j = 0; j < 4; j++) block(root, hx + s * 0.68 + jr(-0.03, 0.03), 0.2 + j * 0.31, z0 - 0.01, 0.34, 0.28, 0.06);
    rb(hx, fy - 0.05, z0 + 0.25, 1.9, 0.14, 1.1, stoneSlab, 0.03);                                            // hearthstone
    rb(hx, 0.75, z1 - 0.04, 1.0, 1.3, 0.08, M(0x6a4a3a, tex('terracotta', 1, 1)), 0.01);                   // sooty brick back
    add(rbox(x1 - x0 + 0.2, 0.2, 0.32, 0.04, timber, 1), hx, 1.42, z0 + 0.12);                              // mantel beam
    rb(hx, (1.52 + H) / 2, z0 + 0.42, 1.55, H - 1.52, 0.56, stoneSlab, 0.04);                                // chimney breast
    for (let y = 1.6; y < H - 0.2; y += 0.3) for (const dx of [-0.5, 0, 0.5]) block(root, hx + dx + jr(-0.06, 0.06), y + 0.13, z0 + 0.13, 0.42, 0.26, 0.06);
    for (const [dx, h, c] of [[-0.35, 0.22, CREAM], [-0.12, 0.18, 0xe8dcc0], [0.5, 0.26, COPPER]]) ic(hx + dx, 1.52 + h / 2, z0 + 0.15, 0.09, h, c);
    ic(hx - 0.72, 1.6, z0 + 0.15, 0.12, 0.16, 0xd98c5a); for (let k = 0; k < 20; k++) leaf(root, hx - 0.72 + jr(-0.2, 0.2), 1.7 + jr(0, 0.18), z0 + 0.15 + jr(-0.12, 0.12)); for (let k = 0; k < 12; k++) leaf(root, hx - 0.82 + jr(-0.06, 0.06), 1.5 - k * 0.07, z0 - 0.04);
    for (let k = 0; k < 4; k++) put('log', root, hx + jr(-0.2, 0.2), fy + 0.08 + (k > 1 ? 0.12 : 0), z0 + 0.38 + jr(-0.1, 0.1), 0, jr(-0.3, 0.3), PI / 2, 0.8, 0.7, 0.8, null);
    for (let k = 0; k < 9; k++) put('flame', root, hx + jr(-0.28, 0.28), fy + 0.3 + jr(0, 0.1), z0 + 0.38 + jr(-0.12, 0.12), jr(-0.1, 0.1), 0, jr(-0.15, 0.15), jr(0.1, 0.18), jr(0.3, 0.55), jr(0.1, 0.18), new THREE.Color(pick([0xffd060, 0xffa030, 0xff8020])));
    rb(hx - 0.45, 0.9, z0 + 0.3, 0.04, 0.9, 0.04, iron, 0.01); rb(hx - 0.2, 1.3, z0 + 0.3, 0.5, 0.04, 0.04, iron, 0.01);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, PI * 2, PI * 0.25, PI * 0.75), iron), hx, 0.82, z0 + 0.3);
    ic(hx, 1.08, z0 + 0.3, 0.008, 0.36, 0x3b3530);
    for (const s of [-1, 1]) rb(hx + s * 0.32, fy + 0.12, z0 - 0.02, 0.05, 0.22, 0.05, iron, 0.01);
    ib(hx + 1.02, 0.4, z0 + 0.15, 0.03, 0.75, 0.03, 0x3b3530, 0, 0, 0.08); ib(hx + 1.08, 0.08, z0 + 0.15, 0.14, 0.1, 0.02, 0x3b3530);   // fire shovel
    C(x0 - 0.12, x1 + 0.12, z0 - 0.1, z1);
  }
  // ---- dresser on the left wall: drawers and cupboard below, open shelves of striped bowls above
  {
    const x = IXL + 0.26, z0 = -3.2, z1 = -1.7, zm = (z0 + z1) / 2, L = z1 - z0;
    rb(x, FL + 0.45, zm, 0.52, 0.9, L, timberLight, 0.03);
    rb(x + 0.02, FL + 0.93, zm, 0.58, 0.06, L + 0.06, timber, 0.02);
    for (let k = 0; k < 3; k++) { ib(x + 0.265, FL + 0.72, z0 + 0.27 + k * 0.48, 0.02, 0.18, 0.42, 0xc89a62); ic(x + 0.29, FL + 0.72, z0 + 0.27 + k * 0.48, 0.025, 0.03, BRASS, 0, 0, PI / 2); }
    for (const s of [-1, 1]) ib(x + 0.265, FL + 0.3, zm + s * 0.36, 0.02, 0.4, 0.62, 0xc89a62);
    rb(IXL + 0.03, 1.78, zm, 0.04, 1.6, L, timberLight, 0.01);
    for (const s of [-1, 1]) rb(IXL + 0.18, 1.78, zm + s * (L / 2 - 0.03), 0.3, 1.6, 0.05, timberLight, 0.01);
    for (const y of [1.42, 1.86, 2.3]) rb(IXL + 0.18, y, zm, 0.3, 0.04, L, timberLight, 0.01);
    rb(IXL + 0.2, 2.62, zm, 0.36, 0.1, L + 0.1, timber, 0.02);
    for (const y of [1.44, 1.88]) for (let k = 0; k < 3; k++) { const z = z0 + 0.3 + k * 0.45; ic(IXL + 0.18, y + 0.07, z, 0.15, 0.13, CREAM); ic(IXL + 0.18, y + 0.1, z, 0.153, 0.025, 0x6d8ac2); }
    ib(x + 0.27, FL + 0.84, zm + 0.1, 0.02, 0.3, 0.28, WHITE); for (const dy of [-0.06, 0.06]) ib(x + 0.28, FL + 0.84 + dy, zm + 0.1, 0.012, 0.025, 0.28, CLOTH_RED);
    ic(x, FL + 1.06, zm - 0.3, 0.18, 0.18, CREAM); ic(x, FL + 1.1, zm - 0.3, 0.183, 0.03, 0x6d8ac2);
    ic(x, FL + 1.08, zm + 0.45, 0.07, 0.2, CREAM); for (let k = 0; k < 12; k++) bloom(root, x + jr(-0.12, 0.12), FL + 1.25 + jr(0, 0.12), zm + 0.45 + jr(-0.12, 0.12), 0xffd23f, 1.1);
    for (let k = 0; k < 26; k++) leaf(root, IXL + 0.25 + jr(-0.15, 0.15), 2.75 + jr(0, 0.2), zm + jr(-0.6, 0.6)); for (let k = 0; k < 16; k++) leaf(root, IXL + 0.42, 2.6 - k * 0.07, z0 + 0.15 + jr(-0.08, 0.08));
    C(IXL, x + 0.32, z0 - 0.03, z1 + 0.03);
  }
  // ---- long table with a striped runner and two benches, jug of daisies, bowl of apples
  {
    const tx = 1.4, tz = -2.0, tw = 2.0, td = 0.82;
    rb(tx, FL + 0.74, tz, tw, 0.08, td, timberLight, 0.025);
    for (const s of [-1, 1]) { rb(tx + s * (tw / 2 - 0.25), FL + 0.36, tz, 0.12, 0.72, td - 0.18, timber, 0.02); rb(tx + s * (tw / 2 - 0.25), FL + 0.05, tz, 0.16, 0.1, td - 0.05, timber, 0.02); }
    rb(tx, FL + 0.3, tz, tw - 0.5, 0.1, 0.08, timber, 0.02);
    ib(tx - 0.2, FL + 0.785, tz, 0.5, 0.01, td + 0.3, WHITE); for (const dx of [-0.17, -0.12, 0.12, 0.17]) ib(tx - 0.2 + dx, FL + 0.79, tz, 0.02, 0.01, td + 0.3, CLOTH_RED);
    ib(tx - 0.2, FL + 0.66, tz + td / 2 + 0.15, 0.5, 0.25, 0.01, WHITE); ib(tx - 0.2, FL + 0.66, tz - td / 2 - 0.15, 0.5, 0.25, 0.01, WHITE);
    ic(tx - 0.2, FL + 0.9, tz, 0.09, 0.2, 0xd98c5a); for (let k = 0; k < 16; k++) bloom(root, tx - 0.2 + jr(-0.15, 0.15), FL + 1.02 + jr(0, 0.15), tz + jr(-0.15, 0.15), pick([0xffffff, 0xfff6e0, 0xffd23f]), 1.1); for (let k = 0; k < 8; k++) leaf(root, tx - 0.2 + jr(-0.15, 0.15), FL + 1.0 + jr(0, 0.1), tz + jr(-0.15, 0.15), 0.8);
    ic(tx + 0.35, FL + 0.82, tz + 0.05, 0.2, 0.08, 0xd98c5a); for (let k = 0; k < 6; k++) put('bread', root, tx + 0.35 + jr(-0.1, 0.1), FL + 0.9, tz + 0.05 + jr(-0.1, 0.1), 0, 0, 0, 0.11, 0.1, 0.11, tint(0xd8362e, 0.05, 0.05));
    for (const s of [-1, 1]) {
      const bz = tz + s * 0.72;
      rb(tx, FL + 0.44, bz, tw - 0.1, 0.07, 0.32, timberLight, 0.02);
      for (const sx of [-1, 1]) rb(tx + sx * (tw / 2 - 0.3), FL + 0.21, bz, 0.08, 0.42, 0.26, timber, 0.02);
    }
    C(tx - tw / 2 - 0.02, tx + tw / 2 + 0.02, tz - 0.92, tz + 0.92);
  }
  // ---- little wall niche of jam jars on the back wall, wall lanterns
  {
    const nx = 0.8, z = -IZ;
    for (const y of [1.45, 1.9]) rb(nx, y, z + 0.12, 0.55, 0.04, 0.22, timber, 0.01);
    for (const [y, cs] of [[1.47, [0xb8282a, 0xd8662a, 0xb8282a]], [1.92, [CREAM, 0xe8dcc0]]]) cs.forEach((c, k) => { ic(nx - 0.15 + k * 0.15, y + 0.08, z + 0.12, 0.05, 0.12, c); ic(nx - 0.15 + k * 0.15, y + 0.15, z + 0.12, 0.052, 0.03, 0xf3ead6); });
    ic(nx, 2.06, z + 0.12, 0.08, 0.1, 0xd98c5a); for (let k = 0; k < 12; k++) leaf(root, nx + jr(-0.14, 0.14), 2.15 + jr(0, 0.12), z + 0.12 + jr(-0.08, 0.08), 0.8);
    wallLamp(IXR, 2.3, -0.9, -PI / 2);
    wallLamp(IXL, 2.3, 1.95, PI / 2);
  }
  // ---- pendant lanterns + strings of onions and garlic hang from the ceiling (part of 'roof', so they hide with it)
  RO = true;
  for (const [x, z] of [[0.6, 2.0], [1.4, -2.0]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), iron), x, H - 0.3, z, 0, 0, 0, roof);
    add(rbox(0.24, 0.3, 0.24, 0.03, glow, 1), x, H - 0.72, z, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 4), iron), x, H - 0.49, z, 0, PI / 4, 0, roof);
    add(rbox(0.28, 0.04, 0.28, 0.015, iron, 1), x, H - 0.88, z, 0, 0, 0, roof);
  }
  for (const [x, z, col, n] of [[2.45, -1.3, 0xd99a4a, 9], [2.45, -1.0, 0xf2ece0, 8], [-0.75, -2.6, 0xd99a4a, 8]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75, 4), timberLight), x, H - 0.55, z, 0, 0, 0, roof);
    for (let k = 0; k < n; k++) { const s = jr(0.11, 0.14); put('rball', roof, x + jr(-0.07, 0.07), H - 0.4 - k * 0.07, z + jr(-0.07, 0.07), 0, 0, 0, s, s * 1.1, s, tint(col, 0.05, 0.05)); }
  }
  RO = false;

  // ---------------- woodstore lean-to on the left: posts, plank roof, shelf, back boards, stacked firewood
  {
    const X0 = XL - 0.05, X1 = XL - 1.35, XE = XL - 1.7, Z0 = -1.5, Z1 = 1.8, Y0 = 2.9, YE = 2.1;
    const ang = Math.atan2(Y0 - YE, X0 - XE), yr = (x) => Y0 - (X0 - x) * Math.tan(ang);
    for (const z of [Z0, (Z0 + Z1) / 2, Z1]) add(rbox(0.16, 2.2, 0.16, 0.04, timber), X1, 1.08, z, 0, 0, jr(-0.02, 0.02));
    add(rbox(0.15, 0.15, Z1 - Z0 + 0.4, 0.04, timber), X1, 2.18, (Z0 + Z1) / 2);
    for (const z of [Z0, Z1]) add(rbox(X0 - X1 + 0.1, 0.12, 0.12, 0.03, timber), (X0 + X1) / 2, yr((X0 + X1) / 2) - 0.12, z, 0, 0, ang);
    const rl = Math.hypot(X0 - XE, Y0 - YE) + 0.05, nb = 13, bw = (Z1 - Z0 + 0.6) / nb;
    for (let k = 0; k < nb; k++) {
      const z = Z0 - 0.3 + bw * (k + 0.5), xm = (X0 + XE) / 2;
      add(rbox(rl + jr(-0.06, 0.06), 0.07, bw - 0.02, 0.025, weathered), xm + jr(-0.03, 0.03), yr(xm) + 0.06 + (k % 2) * 0.03, z, jr(-0.02, 0.02), 0, ang + jr(-0.02, 0.02));
    }
    for (const t of [0.3, 0.75]) { const x = X0 - (X0 - XE) * t; add(rbox(0.1, 0.06, Z1 - Z0 + 0.6, 0.02, timber), x, yr(x) + 0.13 + 0.015, (Z0 + Z1) / 2, 0, 0, ang); }
    add(rbox(0.14, 0.16, Z1 - Z0 + 0.7, 0.04, timber), X0 - 0.05, Y0 + 0.08, (Z0 + Z1) / 2);             // wall plate / flashing
    add(rbox(X0 - X1 + 0.1, 0.06, Z1 - Z0 + 0.1, 0.02, weathered), (X0 + X1) / 2 + 0.02, 1.02, (Z0 + Z1) / 2);   // shelf
    for (let k = 0; k < 5; k++) add(rbox(0.25, 2.05, 0.05, 0.02, weathered), X1 + 0.15 + k * 0.26, 1.03, Z0 - 0.05, 0, 0, jr(-0.02, 0.02));
    for (const zc of [1.33, 0.46, -0.41]) for (const [yb, nr] of [[0.14, 4], [1.18, 4]]) for (let row = 0; row < nr; row++) {
      for (let c = 0; c < 5; c++) {
        const x = X1 + 0.16 + c * 0.25 + (row % 2) * 0.12; if (x > X0 - 0.12) continue;
        put('log', root, x, yb + row * 0.22, zc + jr(-0.05, 0.05), PI / 2, jr(0, 6), 0, jr(0.85, 1.1), 1, jr(0.85, 1.1));
      }
    }
    C(X1 - 0.12, X0, Z0 - 0.12, Z1 + 0.12);
  }

  // ---------------- greenery that stays in-game: shrubs at the corners, ivy up the right corner
  const bush = (P, x, z, rx, ry, rz, n, fl) => {
    for (let k = 0; k < n; k++) {
      const a = jr(0, PI * 2), u = Math.sqrt(rr()), v = jr(0.05, 1);
      leaf(P, x + Math.cos(a) * rx * u, ry * v * (1 - 0.4 * u), z + Math.sin(a) * rz * u, 1.5);
    }
    if (fl) for (let k = 0; k < n / 6; k++) { const a = jr(0, PI * 2); bloom(P, x + Math.cos(a) * rx * 0.8, ry * jr(0.4, 0.95), z + Math.sin(a) * rz * 0.8, fl[k % fl.length]); }
  };
  bush(root, 3.75, 3.4, 0.34, 0.95, 0.5, 80, [0xf08fb8, 0xffffff]);
  bush(root, -2.0, FW + 0.3, 0.32, 0.7, 0.3, 40, [0xffd23f]);
  bush(root, 3.85, -3.4, 0.4, 1.1, 0.55, 75);
  bush(root, -3.75, -3.0, 0.5, 0.9, 0.5, 70, [0xf4a2c0]);
  for (const [vx, top] of [[3.4, 2.6], [2.9, 2.2]]) {
    let x = vx, y = 0.3;
    while (y < top) { x += jr(-0.1, 0.1); y += jr(0.06, 0.13); for (let k = 0; k < 3; k++) leaf(Pr, x + jr(-0.14, 0.14), y + jr(-0.08, 0.08), 0.04 + jr(0, 0.05)); }
  }

  // ---------------- prop slots: where the game puts hideable props indoors (groups of the same kind beside furniture)
  const propSlots = [
    { id: 'flour_sack', x: -2.75, z: 3.22, rot: 0.2 }, { id: 'flour_sack', x: -2.2, z: 3.25, rot: 1.1 }, { id: 'flour_sack', x: -1.25, z: 2.15, rot: 2.3 },
    { id: 'bread_basket', x: 1.15, z: 0.82, rot: 0 }, { id: 'bread_basket', x: 1.7, z: 0.85, rot: 0.6 }, { id: 'bread_basket', x: 2.3, z: 0.82, rot: 1.2 },
    { id: 'butter_churn', x: -2.75, z: -1.3, rot: 0 }, { id: 'butter_churn', x: -2.75, z: -3.45, rot: 0.8 },
    { id: 'crate', x: -1.7, z: -3.35, rot: 0.1 }, { id: 'crate', x: -1.1, z: -3.38, rot: -0.15 },
    { id: 'armchair', x: 2.95, z: -3.2, rot: -0.785 }, { id: 'armchair', x: 3.0, z: -0.75, rot: -2.36 },
  ].map((s) => ({ ...s, x: +(s.x + OX).toFixed(3) }));

  // ---------------- garden version only: the concept's loose props indoors (at those slots) and outside
  if (garden) {
    const burlap = M(0xf3e2c8, tex('burlap', 1, 1)), can = M(0xe8eef0, tex('painted_metal', 1, 1));
    const lathe = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
    const sackGeo = lathe([[0, 0], [0.26, 0.02], [0.32, 0.2], [0.3, 0.42], [0.18, 0.58], [0.08, 0.62], [0.12, 0.72], [0, 0.74]], 14);
    for (const s of propSlots) {
      const x = s.x - OX, z = s.z;
      if (s.id === 'flour_sack') add(new THREE.Mesh(sackGeo, burlap), x, FL, z, 0, s.rot, 0.06);
      if (s.id === 'bread_basket') { ic(x, FL + 0.12, z, 0.22, 0.24, HAY); for (let k = 0; k < 4; k++) loaf(root, x + jr(-0.1, 0.1), FL + 0.22, z + jr(-0.1, 0.1), 0.16, 0.1, 0.13); }
      if (s.id === 'butter_churn') { ic(x, FL + 0.4, z, 0.2, 0.8, 0xb88452); for (const y of [0.15, 0.65]) ic(x, FL + y, z, 0.21, 0.04, 0x3b3530); ic(x, FL + 1.0, z, 0.025, 0.5, 0xd8b07a); }
      if (s.id === 'crate') { rb(x, FL + 0.18, z, 0.6, 0.36, 0.45, timberLight, 0.03, s.rot); for (let k = 0; k < 6; k++) put('bread', root, x + jr(-0.2, 0.2), FL + 0.4, z + jr(-0.14, 0.14), 0, 0, 0, 0.12, 0.11, 0.12, tint(k % 2 ? 0xd8362e : 0xf2e6d0, 0.05, 0.05)); }
      if (s.id === 'armchair') { const g = new THREE.Group(); const fab = M(0xd88c4a, tex('burlap', 1, 1)); add(rbox(0.8, 0.42, 0.75, 0.1, fab, 2), 0, FL + 0.25, 0, 0, 0, 0, g); add(rbox(0.8, 0.62, 0.2, 0.1, fab, 2), 0, FL + 0.72, -0.3, 0, 0, 0, g); for (const sx of [-1, 1]) add(rbox(0.16, 0.36, 0.72, 0.07, fab, 2), sx * 0.36, FL + 0.55, 0, 0, 0, 0, g); g.position.set(x, 0, z); g.rotation.y = s.rot; root.add(g); }
    }
    // barrel by the woodstore
    add(new THREE.Mesh(lathe([[0, 0], [0.33, 0], [0.38, 0.2], [0.41, 0.42], [0.38, 0.66], [0.33, 0.82], [0, 0.82]], 20), M(0xa2693b, tex('wood_planks_dark', 1.5, 0.6))), XL - 0.95, 0, 2.45);
    for (const y of [0.18, 0.64]) add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 24), iron), XL - 0.95, y, 2.45, PI / 2);
    // flour sack + milk can between the woodstore and the steps
    add(new THREE.Mesh(sackGeo, burlap), -2.6, 0, FW + 0.95, 0, 0, 0.06);
    add(new THREE.Mesh(lathe([[0, 0], [0.2, 0], [0.22, 0.05], [0.22, 0.42], [0.12, 0.54], [0.1, 0.62], [0.13, 0.64], [0, 0.66]], 16), can), -3.05, 0, FW + 0.7);
    // bread stand: little bench with a basket of baguettes in front of the shop
    add(rbox(1.15, 0.07, 0.42, 0.02, timberLight), 1.75, 0.46, FW + 1.25);
    for (const sx of [-1, 1]) add(rbox(0.07, 0.43, 0.38, 0.02, timber), 1.75 + sx * 0.5, 0.215, FW + 1.25);
    add(new THREE.Mesh(lathe([[0, 0], [0.3, 0], [0.36, 0.18], [0.38, 0.2], [0, 0.2]], 16), M(0xffe2a8, tex('hay', 1, 1))), 1.75, 0.5, FW + 1.25, 0, 0, 0);
    for (let k = 0; k < 5; k++) put('bread', root, 1.6 + k * 0.08, 0.76, FW + 1.25 + jr(-0.08, 0.08), jr(-0.3, 0.3), jr(-0.3, 0.3), 0.5 + jr(-0.2, 0.2), 0.08, 0.6, 0.08, tint(0xd99a4e, 0.06, 0.05));
    // crate of geraniums
    add(rbox(0.75, 0.38, 0.5, 0.03, timberLight), 3.0, 0.19, FW + 1.1);
    for (let k = 0; k < 30; k++) leaf(root, 3.0 + jr(-0.35, 0.35), 0.4 + jr(0, 0.2), FW + 1.1 + jr(-0.22, 0.22));
    for (let k = 0; k < 18; k++) bloom(root, 3.0 + jr(-0.3, 0.3), 0.55 + jr(0, 0.15), FW + 1.1 + jr(-0.2, 0.2), GERANIUM[k % 4], 1.3);
    // pot of yellow flowers beside the steps
    add(new THREE.Mesh(lathe([[0, 0], [0.2, 0], [0.26, 0.32], [0.3, 0.42], [0.26, 0.44], [0, 0.44]], 16), terracotta), 0.45, 0, FW + 0.7);
    for (let k = 0; k < 16; k++) leaf(root, 0.45 + jr(-0.24, 0.24), 0.48 + jr(0, 0.25), FW + 0.7 + jr(-0.24, 0.24));
    for (let k = 0; k < 12; k++) bloom(root, 0.45 + jr(-0.2, 0.2), 0.62 + jr(0, 0.15), FW + 0.7 + jr(-0.2, 0.2), 0xffd23f, 1.2);
    // cart wheel leaning on the right wall
    {
      const g = new THREE.Group();
      add(new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 6, 24), timber), 0, 0, 0, 0, 0, 0, g);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10), timber), 0, 0, 0, PI / 2, 0, 0, g);
      for (let k = 0; k < 8; k++) add(rbox(0.05, 0.9, 0.04, 0.015, timberLight), 0, 0, 0, 0, 0, (k / 8) * PI, g);
      g.position.set(XR + 0.25, 0.5, 3.1); g.rotation.set(0, PI / 2 - 0.25, -0.18); root.add(g);
    }
    // stepping stones to the door
    for (let k = 0; k < 3; k++) {
      const z = FW + 1.05 + k * 0.62, x = doorX + Math.sin(k * 0.9) * 0.22;
      add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.28, 0.36), jr(0.3, 0.38), 0.08, 9), stoneSlab), x + jr(-0.1, 0.1), 0.03, z, 0, jr(0, 3), 0);
    }
  }

  // ---------------- build the instanced meshes
  for (const k of Object.keys(pools)) {
    const p = pools[k]; if (!p.items.length) continue;
    const im = new THREE.InstancedMesh(p.geo, p.mat, p.items.length);
    p.items.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c instanceof THREE.Color ? c : new THREE.Color(c ?? 0xffffff)); });
    im.castShadow = true; im.receiveShadow = true; im.name = k; p.P.add(im);
  }
  for (const c of root.children) c.position.x += OX;
  root.userData.footprint = { w: 9.4, d: 9.2 };
  root.userData.door = { x: doorX + OX, z: FW + 0.95 };
  root.userData.doorIn = { x: doorX + OX, z: +(IZ - 0.7).toFixed(3) };
  root.userData.innerDoors = [{ x: AX + OX, z: PZ }];
  root.userData.rooms = [
    { name: 'shop', x: +((IXL + IXR) / 2 + OX).toFixed(3), z: +((IZ + PZ + 0.1) / 2).toFixed(3), w: +(IXR - IXL).toFixed(3), d: +(IZ - PZ - 0.1).toFixed(3) },
    { name: 'kitchen', x: +((IXL + IXR) / 2 + OX).toFixed(3), z: +((PZ - 0.1 - IZ) / 2).toFixed(3), w: +(IXR - IXL).toFixed(3), d: +(IZ + PZ - 0.1).toFixed(3) },
  ];
  root.userData.colliders = colliders;
  root.userData.propSlots = propSlots;
  if (opts.merge !== false) { mergeStatic(THREE, roof); mergeStatic(THREE, root); }
  return root;
}
