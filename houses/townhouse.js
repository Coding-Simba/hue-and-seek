/* Townhouse — hand-modelled in code from Codex's concept paintings (assets/concepts/house_townhouse.png outside,
 * assets/interiors/townhouse_ground.png + townhouse_upstairs.png inside).
 * export buildHouse(THREE, opts) → THREE.Group 'townhouse'. Origin = ground centre, front (door) faces +Z. Metres.
 * A two-storey apricot plaster house: steep slate roof (instanced slates) with a front cross-gable, stone quoins on the
 * corners and round the arched doorway, blue-grey slatted shutters, a wooden balcony with flower boxes under a little pent
 * roof, a climbing vine up the left corner, an iron wall lantern, a gutter + downpipe and a chimney.
 * Enterable: the ground storey is a hollow shell with two rooms joined by an open doorway —
 *   front: sitting room + kitchen (sofa, piano, decorative staircase, stove under a hood, dresser, round table),
 *   back:  the concept's "upstairs" rebuilt on the ground floor (canopy bed, desk with globe under bookshelves, rug).
 * Everything above the ground storey (upper walls, balcony, roofs, ceiling, chimney) is in the child group 'roof',
 * which the game hides while the player is inside. userData: door, doorIn, innerDoors, rooms, colliders, propSlots.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

export function buildHouse(THREE, opts = {}) {
  const garden = opts.garden !== false;               // false = in-game: nothing that could pass for a hideable prop
  const PI = Math.PI;
  const W = 8.2, D = 8.0, FRONT = D / 2, HE = 5.1;    // walls; HE = eave-wall height (two storeys)
  const T = 0.25, HG = 3.2, FL = 0.05, IX = W / 2 - T, IZ = FRONT - T, PZ = -0.1;   // wall thickness, ground-storey top, floor, inner faces, partition
  const FO = FRONT + 0.05, SO = W / 2 + 0.05;         // outer wall faces
  const PITCH = Math.atan(1.05), RIDGE = HE + FRONT * Math.tan(PITCH);                // main roof, ridge along x
  const GX = 2.1, GW = 3.4, GPITCH = Math.atan(1.5), GRIDGE = HE + (GW / 2) * 1.5;    // front cross-gable (right half)
  const doorX = 0, DR = 0.7, DSPRING = FL + 2.0;      // front doorway 1.4 m wide, round arch springing at 2.05
  const IDX = 0.7, IDW = 1.4, IDH = 2.3;              // open doorway in the partition between the two rooms
  const tex = (name, rx = 1, ry = 1) => kitTex(THREE, name, rx, ry);
  const matCache = {};
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  const root = new THREE.Group();
  root.name = 'townhouse';
  const roof = new THREE.Group();                     // everything above the rooms: hidden by the game while you're inside
  roof.name = 'roof'; roof.userData.keep = true; root.add(roof);
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const addR = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => add(mesh, x, y, z, rx, ry, rz, roof);
  const rbox = (w, h, d, r, mat, seg = 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  const rb = (x, y, z, w, h, d, mat, r = 0.03, ry = 0, P = root) => add(rbox(w, h, d, r, mat, 1), x, y, z, 0, ry, 0, P);
  const pbox = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);              // thin sticks & slats: no bevel needed
  let seed = Math.abs(Math.floor(opts.seed || 7)) % 2147483646 || 7;
  const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const pick = (arr) => arr[Math.floor(rr() * arr.length)];

  // ---------------- materials (painted kit textures, light tints)
  const plaster = M(opts.wall || 0xffaca4, tex('plaster', 0.3, 0.3));
  const quoin = M(0xf4ede2, tex('stone', 0.5, 0.5));
  const stoneDark = M(0xcfc4b2, tex('stone', 0.8, 0.8));
  const timber = M(0xd49a64, tex('wood_light', 0.6, 0.6));
  const timberDark = M(0x9c6a42, tex('wood_light', 0.5, 0.5));
  const doorWood = M(0xffe4cc, tex('wood_planks_dark', 0.9, 0.9));
  const trim = M(0xf3e6d0, tex('plaster', 0.6, 0.6));            // also the cream upholstery, linen and curtains inside
  const shutterMat = M(0x8aa0bd, null);                          // also the painted kitchen dresser, range and chairs
  const glass = M(0x546f80, null, { roughness: 0.85 });
  const iron = M(0x3b3530, null, { roughness: 0.85 });
  const zinc = M(0x9aa3ad, tex('painted_metal', 0.5, 0.5));
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd894, emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.85, metalness: 0 });
  const warmPane = new THREE.MeshStandardMaterial({ color: 0xffe8c0, emissive: 0xffb860, emissiveIntensity: 0.6, roughness: 0.9, metalness: 0 });
  const terracotta = M(0xffd2b0, tex('terracotta', 1, 1));
  const floorMat = M(0xf6cf9c, tex('wood_light', 0.4, 0.4));
  const rush = M(0xffe2a8, tex('hay', 1, 1));
  const deckMat = M(0x4a5266, null);
  const slateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  const instMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });   // small coloured interior bits
  const leaves = [], blossoms = [];
  const greens = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55];
  // instanced interior clutter (books, cushions, plates, jars, pans, rugs…): one draw call per shape
  const IB = [], IR = [], IC = [], IS = [];
  const ib = (x, y, z, w, h, d, c, ry = 0, rx = 0, rz = 0) => IB.push([x, y, z, w, h, d, c, rx, ry, rz]);      // hard-edged (books, rugs, panels)
  const ir = (x, y, z, w, h, d, c, ry = 0, rx = 0, rz = 0) => IR.push([x, y, z, w, h, d, c, rx, ry, rz]);      // soft (cushions, pillows, throws)
  const ic = (x, y, z, r, h, c, rx = 0, ry = 0, rz = 0) => IC.push([x, y, z, r * 2, h, r * 2, c, rx, ry, rz]);
  const is = (x, y, z, sx, sy, sz, c) => IS.push([x, y, z, sx, sy, sz, c, 0, 0, 0]);
  const COPPER = 0xc77a42, BRASS = 0xd9a650, WHITE = 0xf6f1e6, BLUE = 0x8ea2c2, DELFT = 0x5b78a8;
  const bunch = (x, y, z, r, n, cols, s = 1) => { for (let k = 0; k < n; k++) blossoms.push({ p: [x + jr(-r, r), y + jr(0, r * 0.8), z + jr(-r, r)], s: jr(0.8, 1.2) * s, c: pick(cols) }); };
  const sprig = (x, y, z, r, n, s = 0.8) => { for (let k = 0; k < n; k++) leaves.push({ p: [x + jr(-r, r), y + jr(-r * 0.3, r), z + jr(-r, r)], s: jr(0.6, 1.0) * s }); };
  const colliders = [];
  const C = (x0, x1, z0, z1) => colliders.push({ x: +((x0 + x1) / 2).toFixed(3), z: +((z0 + z1) / 2).toFixed(3), w: +(x1 - x0).toFixed(3), d: +(z1 - z0).toFixed(3) });

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
  const wallRun = (alongX, a0, a1, t0, t1, holes, y0 = 0, y1 = HG) => {
    const piece = (b0, b1, c0, c1) => { if (b1 - b0 > 0.005 && c1 - c0 > 0.005) alongX ? slab(b0, b1, c0, c1, t0, t1, plaster) : slab(t0, t1, c0, c1, b0, b1, plaster); };
    let cur = a0;
    for (const [h0, h1, hy0, hy1] of [...holes].sort((p, q) => p[0] - q[0])) { piece(cur, h0, y0, y1); piece(h0, h1, y0, hy0); piece(h0, h1, hy1, y1); cur = h1; }
    piece(cur, a1, y0, y1);
  };
  const holes = { f: [], b: [], l: [], r: [] };

  // ---------------- upper storey shell (side profile from the ground-storey top up to the gables) — part of 'roof'
  {
    const s = new THREE.Shape();
    s.moveTo(-FRONT, HG); s.lineTo(FRONT, HG); s.lineTo(FRONT, HE - 0.08); s.lineTo(0, RIDGE - 0.2); s.lineTo(-FRONT, HE - 0.08); s.closePath();   // kept under the roof deck
    const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, steps: 1 });
    g.rotateY(-PI / 2); g.translate(W / 2, 0, 0);
    addR(new THREE.Mesh(g, plaster), 0, 0, 0);
    // front cross-gable wall face (a hair proud of the facade so it reads as one plaster skin)
    const c = new THREE.Shape();
    c.moveTo(GX - GW / 2, HG); c.lineTo(GX + GW / 2, HG); c.lineTo(GX + GW / 2, HE - 0.08); c.lineTo(GX, GRIDGE - 0.2); c.lineTo(GX - GW / 2, HE - 0.08); c.closePath();
    const cg = new THREE.ExtrudeGeometry(c, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, steps: 1 });
    addR(new THREE.Mesh(cg, plaster), 0, 0, FRONT - 0.6);
    // ceiling of the ground storey: boards + beams running front to back (all well above head height)
    slab(-IX, IX, HG - 0.06, HG, -IZ, IZ, floorMat, roof);
    for (const x of [-3.0, -1.5, 0, 1.5, 3.0]) addR(rbox(0.2, 0.18, 2 * IZ, 0.03, timber, 1), x, HG - 0.15, 0);
    addR(rbox(2 * IX, 0.2, 0.22, 0.03, timberDark, 1), 0, HG - 0.16, PZ);
  }

  // ---------------- slate roofs: individual slates (instanced) on dark decks
  const slates = [];
  {
    const mtx = new THREE.Matrix4(), F = new THREE.Matrix4(), L = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const pal = [0x5d6a85, 0x66748f, 0x52607a, 0x6e7c98, 0x58647c, 0x76849f, 0x4d5872].map((h) => new THREE.Color(h));
    const tileW = 0.36, rowGap = 0.2, tileL = 0.34;
    const mainY = (z) => RIDGE + 0.06 - Math.abs(z) * Math.tan(PITCH);
    const crossY = (x) => GRIDGE + 0.06 - Math.abs(x - GX) * Math.tan(GPITCH);
    const inCross = (x) => Math.abs(x - GX) < GW / 2 + 0.36;
    // a roof plane: origin o on its top edge, u along the eave, n up out of the roof, d down the slope
    const plane = (o, u, n, d, lenU, lenD, skip) => {
      F.makeBasis(u, n, d).setPosition(o);
      const deck = rbox(lenU, 0.1, lenD, 0.03, deckMat, 1);
      deck.matrixAutoUpdate = false;
      deck.matrix.copy(F).multiply(L.makeTranslation(lenU / 2, -0.06, lenD / 2));
      deck.castShadow = deck.receiveShadow = true; roof.add(deck);
      const rows = Math.floor((lenD - 0.05) / rowGap);
      for (let r = 0; r < rows; r++) {
        const cols = Math.ceil(lenU / tileW) + 1;
        for (let c = 0; c < cols; c++) {
          const a = (c + (r % 2) * 0.5 - 0.25) * tileW + jr(-0.012, 0.012);
          if (a < tileW * 0.3 || a > lenU - tileW * 0.3) continue;
          const dist = Math.min(lenD - tileL, r * rowGap) + jr(-0.01, 0.01);
          L.compose(p.set(a, 0.02, dist), q.setFromEuler(e.set(-0.07 + jr(-0.03, 0.02), jr(-0.04, 0.04), jr(-0.03, 0.03))), sc.set(jr(0.92, 1.04), 1, jr(0.95, 1.05)));
          mtx.multiplyMatrices(F, L);
          p.setFromMatrixPosition(mtx);
          if (skip && skip(p)) continue;
          slates.push([mtx.clone(), pal[Math.floor(rr() * pal.length)].clone().offsetHSL(0, jr(-0.03, 0.03), jr(-0.05, 0.04))]);
        }
      }
    };
    const c = Math.cos(PITCH), s = Math.sin(PITCH), OV = 0.45, SIDE = 0.32;
    const lenD = (FRONT + OV) / c, lenU = W + SIDE * 2;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // front slope (skip the slates hidden under the cross-gable roof) and back slope
    const xL = GX - GW / 2 - 0.36;                     // left of here the front slope runs to the eave; right of it the cross-gable takes over
    plane(V(-W / 2 - SIDE, RIDGE + 0.06, 0), V(1, 0, 0), V(0, c, s), V(0, -s, c), xL + W / 2 + SIDE, lenD);
    plane(V(xL, RIDGE + 0.06, 0), V(1, 0, 0), V(0, c, s), V(0, -s, c), W / 2 + SIDE - xL, FRONT / c, (q2) => inCross(q2.x) && q2.y < crossY(q2.x) - 0.12);
    plane(V(W / 2 + SIDE, RIDGE + 0.06, 0), V(-1, 0, 0), V(0, c, -s), V(0, -s, -c), lenU, lenD);
    // cross-gable roof: two steep slopes running back from the gable until they disappear under the main roof
    const gc = Math.cos(GPITCH), gs = Math.sin(GPITCH), GOV = 0.36, zF = FRONT + 0.42, zM = (RIDGE - GRIDGE) / Math.tan(PITCH), zB = zM - 0.8;
    const glen = (GW / 2 + GOV) / gc, gU = zF - zB;
    const under = (q2) => q2.y < mainY(q2.z) - 0.2;
    plane(V(GX, GRIDGE + 0.06, zF), V(0, 0, -1), V(gs, gc, 0), V(gc, -gs, 0), gU, glen, under);
    plane(V(GX, GRIDGE + 0.06, zB), V(0, 0, 1), V(-gs, gc, 0), V(-gc, -gs, 0), gU, glen, under);
    // ridge caps
    const ridgeMat = M(0x5d6a85, null);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, lenU + 0.05, 10), ridgeMat), 0, RIDGE + 0.12, 0, 0, 0, PI / 2);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, zF - zM + 0.1, 10), ridgeMat), GX, GRIDGE + 0.1, (zF + zM - 0.1) / 2, PI / 2);
    // painted bargeboards on the side gables and the front gable, a gutter + downpipe on the left eave
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bl = lenD + 0.05;
      addR(rbox(0.1, 0.24, bl, 0.03, trim, 1), sx * (W / 2 + SIDE + 0.03), RIDGE - (bl / 2) * s - 0.04, sz * (bl / 2) * c, sz * PITCH, 0, 0);
    }
    for (const sx of [-1, 1]) {
      const bl = glen + 0.05;
      addR(rbox(bl, 0.22, 0.1, 0.03, trim, 1), GX + sx * (bl / 2) * gc, GRIDGE - (bl / 2) * gs - 0.04, zF + 0.04, 0, 0, -sx * GPITCH);
    }
    const eaveY = HE - OV * Math.tan(PITCH) - 0.06, gutterL = GX - GW / 2 - 0.36 + W / 2 + SIDE;
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, gutterL, 10, 1, true, PI / 2, PI), zinc), -W / 2 - SIDE + gutterL / 2, eaveY - 0.02, FRONT + OV + 0.04, 0, 0, PI / 2);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, lenU, 10, 1, true, PI / 2, PI), zinc), 0, eaveY - 0.02, -(FRONT + OV + 0.04), 0, 0, PI / 2);
    const px = -W / 2 + 0.18;
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, eaveY - 0.3, 8), zinc), px, (eaveY - 0.3) / 2 + 0.05, FO + 0.07);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.6, 8), zinc), px, eaveY - 0.32, FRONT + 0.3, -0.75, 0, 0);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.25, 8), zinc), px, 0.12, FO + 0.15, 0.4, 0, 0);
    for (const y of [1.2, 2.6, 4.0]) addR(rbox(0.16, 0.05, 0.14, 0.015, iron, 1), px, y, FO + 0.03);
    // slates (one instanced draw call)
    const tg = new THREE.Shape(), hw = 0.18, tl = tileL, rc = 0.06;
    tg.moveTo(-hw, 0); tg.lineTo(hw, 0); tg.lineTo(hw, tl - rc); tg.quadraticCurveTo(hw, tl, hw - rc, tl); tg.lineTo(-hw + rc, tl); tg.quadraticCurveTo(-hw, tl, -hw, tl - rc); tg.closePath();
    const geo = new THREE.ExtrudeGeometry(tg, { depth: 0.035, bevelEnabled: false, curveSegments: 3 });
    geo.rotateX(PI / 2); geo.translate(0, 0.035, 0);
    const im = new THREE.InstancedMesh(geo, slateMat, slates.length);
    slates.forEach(([m, col], i) => { im.setMatrixAt(i, m); im.setColorAt(i, col); });
    im.castShadow = true; im.receiveShadow = true; im.name = 'slates'; roof.add(im);
  }

  // ---------------- chimney: apricot stucco stack on the left slope, stone band, two clay pots
  {
    const cx = -2.7, cz = 0.6, base = RIDGE - cz * Math.tan(PITCH) - 1.0, top = RIDGE + 0.05;
    addR(rbox(0.8, top - base, 0.8, 0.06, M(0xffa294, tex('plaster', 0.8, 1.6))), cx, (top + base) / 2, cz);
    addR(rbox(0.96, 0.16, 0.96, 0.05, quoin), cx, top - 0.25, cz);
    addR(rbox(0.92, 0.12, 0.92, 0.04, stoneDark), cx, top + 0.04, cz);
    for (const dx of [-0.17, 0.18]) {
      addR(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.36, 10), terracotta), cx + dx, top + 0.28, cz);
      addR(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), terracotta), cx + dx, top + 0.46, cz, PI / 2);
    }
  }

  // ---------------- stone quoins: both front corners (wrapping round), the cross-gable edge; string course between storeys
  {
    const z = FO - 0.01, PQ = (y) => (y > HG - 0.05 ? roof : root);
    for (const sx of [-1, 1]) for (let j = 0; j < 14; j++) {
      const long = j % 2 === 0, y = 0.5 + j * 0.37;
      if (y > HE - 0.15) break;
      add(rbox(long ? 0.52 : 0.32, 0.33, 0.14, 0.07, quoin, 1), sx * (W / 2 - (long ? 0.22 : 0.12)), y, z, 0, 0, jr(-0.03, 0.03), PQ(y));
      add(rbox(0.14, 0.33, long ? 0.32 : 0.52, 0.07, quoin, 1), sx * (SO - 0.01), y, FRONT - (long ? 0.12 : 0.22), jr(-0.03, 0.03), 0, 0, PQ(y));
    }
    for (let j = 0; j < 6; j++) {
      const long = j % 2 === 0, y = 3.4 + j * 0.37;
      if (y > HE - 0.1) break;
      addR(rbox(long ? 0.46 : 0.3, 0.33, 0.14, 0.07, quoin, 1), GX - GW / 2 + (long ? 0.2 : 0.12), y, z + 0.04, 0, 0, jr(-0.03, 0.03));
    }
    add(rbox(W + 0.1, 0.12, 0.1, 0.03, trim, 1), 0, 3.15, FO + 0.0);
    // stone plinth round the outside (gap at the doorway) + a low step and threshold
    const pl = (x0, x1, z0, z1) => add(rbox(x1 - x0, 0.32, z1 - z0, 0.05, stoneDark, 1), (x0 + x1) / 2, 0.16, (z0 + z1) / 2);
    pl(-SO - 0.03, doorX - DR - 0.02, FO - 0.05, FO + 0.09); pl(doorX + DR + 0.02, SO + 0.03, FO - 0.05, FO + 0.09);
    pl(-SO - 0.03, SO + 0.03, -FO - 0.09, -FO + 0.05);
    for (const sx of [-1, 1]) pl(sx * SO - 0.07, sx * SO + 0.07, -FO, FO);
    add(rbox(1.9, 0.1, 0.62, 0.04, stoneDark), doorX, 0.05, FO + 0.3);
    add(rbox(2 * DR + 0.02, FL + 0.01, FO - IZ + 0.02, 0.01, quoin, 1), doorX, (FL + 0.01) / 2, (IZ + FO) / 2);
  }

  // ---------------- open arched doorway in a big stone surround; the plank door swung back flat against the inner wall
  {
    holes.f.push([doorX - DR, doorX + DR, 0, DSPRING + DR]);
    // fill the corners above the arch so the opening is truly round on both faces
    const sL = new THREE.Shape(); sL.moveTo(-DR, 0); sL.lineTo(-DR, DR); sL.lineTo(0, DR); sL.absarc(0, 0, DR, PI / 2, PI, false);
    const sR = new THREE.Shape(); sR.moveTo(DR, 0); sR.absarc(0, 0, DR, 0, PI / 2, false); sR.lineTo(DR, DR); sR.closePath();
    add(new THREE.Mesh(new THREE.ExtrudeGeometry([sL, sR], { depth: FO - IZ, bevelEnabled: false, curveSegments: 10 }), plaster), doorX, DSPRING, IZ);
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * PI, rad = DR + 0.18, key = i === Math.round(n / 2);
      add(rbox(key ? 0.32 : 0.28, key ? 0.36 : 0.3, 0.2, 0.07, quoin, 1), doorX + Math.cos(a) * rad, DSPRING + Math.sin(a) * rad, FO, 0, 0, a - PI / 2);
    }
    for (const sx of [-1, 1]) for (let j = 0; j < 6; j++) {
      const wide = j % 2 === 0;
      add(rbox(wide ? 0.42 : 0.3, 0.33, 0.2, 0.07, quoin, 1), doorX + sx * (DR + (wide ? 0.2 : 0.14)), 0.2 + j * 0.355, FO);
    }
    // the door leaf, built facing out then turned round against the inner face of the front wall, right of the opening
    const r = DR - 0.04, dh = DSPRING - FL;
    const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, dh); s.absarc(0, dh, r, 0, PI, false); s.lineTo(-r, 0);
    const lg = new THREE.Group();
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }), doorWood), 0, 0, 0, 0, 0, 0, lg);
    for (let k = -3; k <= 3; k++) { const h = dh + Math.sqrt(Math.max(0, r * r - (k * 0.19) ** 2)) * 0.92; add(rbox(0.025, h, 0.02, 0.008, timberDark, 1), k * 0.19, h / 2, 0.1, 0, 0, 0, lg); }
    for (const y of [0.5, 1.7]) add(rbox(2 * r * 0.9, 0.07, 0.03, 0.015, iron, 1), 0, y, 0.11, 0, 0, 0, lg);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 14), iron), -r + 0.2, 1.1, 0.13, 0, 0, 0, lg);
    lg.position.set(doorX + DR + 0.04 + r, FL, IZ - 0.03); lg.rotation.y = PI; root.add(lg);
  }

  // ---------------- windows: frame, small panes, stone sill + lintel, slatted blue-grey shutters
  function windowUnit(x, y, w, h, nShut, z = FRONT + 0.06, P = root, stoneFrame = true) {
    const fr = 0.08;
    const a = (m, px, py, pz, rz = 0) => add(m, px, py, pz, 0, 0, rz, P);
    a(rbox(w, h, 0.06, 0.02, glass, 1), x, y, z);
    a(rbox(w + fr * 2, fr, 0.12, 0.03, timber, 1), x, y + h / 2 + fr / 2, z + 0.03);
    for (const s of [-1, 1]) a(rbox(fr, h, 0.12, 0.03, timber, 1), x + s * (w / 2 + fr / 2), y, z + 0.03);
    a(rbox(0.04, h, 0.07, 0.015, timber, 1), x, y, z + 0.05);
    for (const t of [0.33, 0.66]) a(rbox(w, 0.04, 0.07, 0.015, timber, 1), x, y - h / 2 + h * t, z + 0.05);
    if (stoneFrame) {
      a(rbox(w + 0.5, 0.13, 0.24, 0.04, quoin, 1), x, y - h / 2 - 0.07, z + 0.08);
      a(rbox(w + 0.42, 0.22, 0.14, 0.05, quoin, 1), x, y + h / 2 + fr + 0.11, z + 0.03);
      a(rbox(0.2, 0.26, 0.16, 0.05, quoin, 1), x, y + h / 2 + fr + 0.14, z + 0.06);
    } else a(rbox(w + 0.3, 0.1, 0.22, 0.03, timber, 1), x, y - h / 2 - 0.05, z + 0.07);
    const shutters = nShut === 2 ? [-1, 1] : nShut === -1 ? [-1] : nShut === 1 ? [1] : [];
    for (const s of shutters) {
      const sw = w * 0.55, g = new THREE.Group(), slatGeo = new THREE.BoxGeometry(sw * 0.8, 0.055, 0.03);
      add(rbox(sw, h + 0.06, 0.04, 0.012, shutterMat, 1), 0, 0, 0, 0, 0, 0, g);
      const nSl = Math.round(h / 0.09);
      for (let k = 0; k < nSl; k++) add(new THREE.Mesh(slatGeo, shutterMat), 0, -h / 2 + 0.06 + k * ((h - 0.08) / nSl), 0.03, -0.35, 0, 0, g);
      for (const sxx of [-1, 1]) add(rbox(0.06, h + 0.06, 0.06, 0.015, shutterMat, 1), sxx * (sw / 2 - 0.03), 0, 0.03, 0, 0, 0, g);
      for (const yy of [0.32, -0.32]) add(rbox(sw * 0.5, 0.035, 0.02, 0.008, iron, 1), -s * sw * 0.22, h * yy, 0.05, 0, 0, 0, g);
      g.position.set(x + s * (w / 2 + fr + sw / 2 + 0.03), y, z + 0.05); g.rotation.y = -s * 0.22;
      P.add(g);
    }
  }
  // a window on one face ('f','b','l','r'); `a` is the world coordinate along that wall (x for f/b, z for l/r).
  // Ground-storey windows punch a real hole: warm glowing pane inside, a timber sill and (optionally) curtains.
  const faceGroup = (face, P) => {
    const [x, z, ry] = { f: [0, FRONT, 0], b: [0, -FRONT, PI], l: [-W / 2, 0, -PI / 2], r: [W / 2, 0, PI / 2] }[face];
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; P.add(g); return g;
  };
  function opening(face, a, y, w, h, nShut, o = {}) {
    const upper = y > HG, P = faceGroup(face, upper ? roof : root), la = face === 'b' || face === 'r' ? -a : a;
    windowUnit(la, y, w, h, nShut, 0.06, P, o.stone !== false);
    if (upper) return;
    holes[face].push([a - w / 2, a + w / 2, y - h / 2, y + h / 2]);
    add(rbox(w, h, 0.02, 0.006, warmPane, 1), la, y, 0.0, 0, 0, 0, P);
    for (const t of [0.33, 0.66]) add(rbox(w, 0.04, 0.04, 0.01, timber, 1), la, y - h / 2 + h * t, -0.03, 0, 0, 0, P);
    add(rbox(0.04, h, 0.04, 0.01, timber, 1), la, y, -0.03, 0, 0, 0, P);
    add(rbox(w + 0.24, 0.06, 0.2, 0.02, timber, 1), la, y - h / 2 - 0.03, -T - 0.02, 0, 0, 0, P);
    if (o.curtains) {
      add(rbox(w + 0.7, 0.03, 0.03, 0.01, iron, 1), la, y + h / 2 + 0.18, -T - 0.08, 0, 0, 0, P);
      for (const s of [-1, 1]) add(rbox(0.26, h + 0.4, 0.07, 0.03, trim, 1), la + s * (w / 2 + 0.16), y - 0.02, -T - 0.08, 0, 0, s * 0.03, P);
    }
  }
  function flowerBox(x, y, w, z, cols, spill = 0.5) {
    const R = y > HG, LV = [], BL = [];
    add(rbox(w, 0.22, 0.26, 0.04, timber, 1), x, y, z, 0, 0, 0, R ? roof : root);
    for (let i = 0; i < w * 34; i++) LV.push({ p: [x + jr(-w / 2, w / 2), y + jr(0.08, 0.26), z + jr(-0.1, 0.12)], s: jr(0.6, 1.05) });
    for (let i = 0; i < w * 14 * spill; i++) LV.push({ p: [x + jr(-w / 2, w / 2), y - jr(0, 0.45), z + 0.15 + jr(0, 0.06)], s: jr(0.55, 0.9) });
    for (let i = 0; i < w * 24; i++) BL.push({ p: [x + jr(-w / 2, w / 2), y + jr(0.14, 0.32), z + jr(-0.08, 0.14)], s: jr(0.9, 1.3), c: pick(cols) });
    for (let i = 0; i < w * 8 * spill; i++) BL.push({ p: [x + jr(-w / 2, w / 2), y - jr(0.05, 0.4), z + 0.17 + jr(0, 0.05)], s: jr(0.8, 1.1), c: pick(cols) });
    for (const it of LV) leaves.push(Object.assign(it, { R })); for (const it of BL) blossoms.push(Object.assign(it, { R }));
  }
  // ground storey
  opening('f', -2.5, 1.6, 0.9, 1.1, -1, { curtains: true });              // sitting room, one shutter
  flowerBox(-2.5, 0.82, 1.15, FO + 0.17, [0xffffff, 0xfff4f8, 0xf4a2c0, 0xc9a0e8], 0.3);
  opening('f', 2.75, 1.55, 0.8, 1.0, 0, { curtains: true });              // kitchen, under the balcony
  flowerBox(2.75, 0.83, 1.0, FO + 0.17, [0xffd23f, 0xffb43d, 0xffffff], 0.4);
  opening('l', 3.05, 1.75, 0.72, 0.95, 2, { stone: false, curtains: true });   // sitting room side window
  opening('l', -1.55, 1.65, 0.75, 1.0, 2, { stone: false, curtains: true });   // bedroom
  opening('r', 0.95, 1.85, 0.75, 0.85, 2, { stone: false });                  // over the kitchen sink
  opening('r', -2.0, 1.45, 1.1, 1.95, 0, { stone: false, curtains: true });   // the bedroom's tall glazed doors
  opening('b', -0.35, 1.65, 0.8, 1.0, 2, { curtains: true });                 // bedroom back window
  // upper storey (in 'roof')
  opening('f', -2.3, 4.15, 0.82, 1.05, 2);
  flowerBox(-2.3, 3.45, 1.1, FO + 0.19, [0xf06a8a, 0xffd23f, 0xf4a2c0, 0xffb3c6], 1);
  windowUnit(GX, 6.55, 0.48, 0.55, 0, FRONT + 0.07, roof, false);         // attic window in the gable peak
  for (const [f, a] of [['l', 2.0], ['l', -2.0], ['r', 1.8], ['r', -2.0], ['b', -2.0], ['b', 1.6]]) opening(f, a, 4.15, 0.75, 0.95, 2, { stone: f === 'b' });
  for (const f of ['l', 'r']) opening(f, 0, 6.6, 0.5, 0.6, 0, { stone: false });   // little attic windows in the end gables

  // ---------------- ground-storey walls (real thickness, holes for the doorway and windows), partition, floor
  wallRun(true, -SO, SO, IZ, FO, holes.f);
  wallRun(true, -SO, SO, -FO, -IZ, holes.b);
  wallRun(false, -IZ, IZ, -SO, -IX, holes.l);
  wallRun(false, -IZ, IZ, IX, SO, holes.r);
  wallRun(true, -IX, IX, PZ - 0.1, PZ + 0.1, [[IDX - IDW / 2, IDX + IDW / 2, 0, IDH]]);
  slab(-IX, IX, 0, FL, -IZ, IZ, floorMat);
  for (const [x0, x1, z0, z1] of [[-SO, SO, IZ, FO], [-SO, SO, -FO, -IZ], [-SO, -IX, -IZ, IZ], [IX, SO, -IZ, IZ], [-IX, IX, PZ - 0.1, PZ + 0.1]]) slab(x0, x1, HG, HG + 0.05, z0, z1, timber);   // wall-top plates
  C(-SO, doorX - DR, IZ, FO); C(doorX + DR, SO, IZ, FO);
  C(-SO, SO, -FO, -IZ); C(-SO, -IX, -IZ, IZ); C(IX, SO, -IZ, IZ);
  C(-IX, IDX - IDW / 2, PZ - 0.1, PZ + 0.1); C(IDX + IDW / 2, IX, PZ - 0.1, PZ + 0.1);
  // stone-block surround on both faces of the interior doorway (as in the painting)
  for (const zf of [PZ + 0.12, PZ - 0.12]) {
    for (const sx of [-1, 1]) for (let j = 0; j < 6; j++) { const wide = (j + (sx > 0 ? 1 : 0)) % 2 === 0; rb(IDX + sx * (IDW / 2 + (wide ? 0.16 : 0.11)), 0.22 + j * 0.37, zf, wide ? 0.32 : 0.22, 0.33, 0.06, quoin, 0.04); }
    for (let k = 0; k < 5; k++) rb(IDX - IDW / 2 - 0.12 + k * ((IDW + 0.24) / 4), IDH + 0.17, zf, 0.36, 0.3, 0.06, quoin, 0.04);
  }
  for (const sx of [-1, 1]) rb(IDX + sx * (IDW / 2 - 0.03), IDH / 2, PZ, 0.06, IDH, 0.22, timberDark, 0.01);
  rb(IDX, IDH - 0.03, PZ, IDW, 0.06, 0.22, timberDark, 0.01);

  // ================= FRONT ROOM: sitting room (left) + kitchen (right) =================
  // ---- staircase along the partition, climbing to the left and vanishing through the ceiling (decoration)
  {
    const N = 12, xb = -0.8, run = xb + IX, tr = run / N, rise = (2.95 - FL) / N, z1 = 0.95, zc = z1 / 2;
    for (let i = 0; i < N; i++) {
      const xr = xb - i * tr, top = FL + (i + 1) * rise;
      rb(xr - tr / 2, top - 0.03, zc, tr + 0.03, 0.06, z1, timber, 0.015);
      add(pbox(0.03, rise, z1 - 0.04, timberDark), xr - 0.02, top - rise / 2 - 0.03, zc);
    }
    const s = new THREE.Shape(); s.moveTo(xb, FL); s.lineTo(-IX, FL); s.lineTo(-IX, FL + N * rise - 0.06); s.closePath();   // boarded side under the flight
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), timberDark), 0, 0, z1 - 0.06);
    for (let k = 0; k < 6; k++) { const x = xb - 0.35 - k * 0.45, hgt = (xb - x) * rise / tr - 0.12; if (hgt > 0.2) rb(x, FL + hgt / 2, z1 + 0.0, 0.03, hgt, 0.02, timber, 0.005); }
    rb(-2.0, FL + 0.45, z1 + 0.0, 0.62, 0.8, 0.04, timber, 0.02);     // little cupboard door under the stairs
    is(-2.25, FL + 0.45, z1 + 0.03, 0.04, 0.04, 0.03, BRASS);
    const L = Math.hypot(run, N * rise), ang = Math.atan2(N * rise, run);
    add(rbox(L, 0.22, 0.06, 0.02, timberDark, 1), xb - run / 2, FL + (N * rise) / 2 - 0.1, z1 + 0.01, 0, 0, -ang);
    const NR = 9, runR = NR * tr, LR = Math.hypot(runR, NR * rise);
    for (let i = 0; i < NR; i++) { const top = FL + (i + 1) * rise; add(pbox(0.05, 0.84, 0.05, timber), xb - (i + 0.5) * tr, top + 0.42, z1 - 0.06); }
    add(rbox(LR + 0.1, 0.07, 0.09, 0.02, timberDark, 1), xb - runR / 2, FL + (NR * rise) / 2 + 0.88, z1 - 0.06, 0, 0, -ang);
    rb(xb - 0.03, FL + 0.62, z1 - 0.06, 0.14, 1.24, 0.14, timberDark, 0.03);
    is(xb - 0.03, FL + 1.32, z1 - 0.06, 0.17, 0.17, 0.17, 0xb07a48);
    C(-IX, xb + 0.06, 0.0, z1 + 0.04);
  }
  // ---- upright piano against the left wall, music on the stand, picture + plant above
  {
    const x0 = -IX, z = 1.95;
    rb(x0 + 0.3, FL + 0.62, z, 0.58, 1.24, 1.5, timberDark, 0.04);
    rb(x0 + 0.33, FL + 1.27, z, 0.66, 0.06, 1.56, timberDark, 0.02);
    rb(x0 + 0.7, FL + 0.74, z, 0.3, 0.08, 1.46, timberDark, 0.02);
    for (const s of [-1, 1]) rb(x0 + 0.78, FL + 0.35, z + s * 0.66, 0.08, 0.7, 0.08, timberDark, 0.02);
    ib(x0 + 0.73, FL + 0.795, z, 0.18, 0.025, 1.36, WHITE);
    for (let k = 0; k < 22; k++) if (k % 7 !== 2 && k % 7 !== 6) ib(x0 + 0.68, FL + 0.815, z - 0.64 + k * 0.061, 0.09, 0.025, 0.03, 0x2a2420);
    ib(x0 + 0.62, FL + 1.0, z, 0.02, 0.26, 0.48, 0xf3ead6, 0, 0, 0.2);
    ib(x0 + 0.03, 2.25, z, 0.04, 0.62, 0.82, 0x8a5a3a);                      // landscape painting
    ib(x0 + 0.05, 2.21, z, 0.02, 0.32, 0.7, 0x9fbf8a); ib(x0 + 0.05, 2.43, z, 0.02, 0.18, 0.7, 0xc6dceb);
    ib(x0 + 0.3, FL + 1.35, z + 0.35, 0.22, 0.1, 0.3, 0x5b78a8); ib(x0 + 0.3, FL + 1.43, z + 0.35, 0.2, 0.06, 0.28, 0xa8473a);
    ic(x0 + 0.3, FL + 1.4, z - 0.45, 0.09, 0.2, WHITE); ic(x0 + 0.3, FL + 1.4, z - 0.45, 0.092, 0.06, DELFT);
    bunch(x0 + 0.3, FL + 1.5, z - 0.45, 0.13, 16, [0x9b86d6, 0xb6a2e8, 0x8a74c8]); sprig(x0 + 0.3, FL + 1.47, z - 0.45, 0.14, 8);
    ic(x0 + 0.3, FL + 1.37, z - 0.05, 0.1, 0.14, 0xd98c5a);                 // pot plant trailing down the side
    sprig(x0 + 0.3, FL + 1.45, z - 0.05, 0.16, 14, 0.9);
    for (let k = 0; k < 14; k++) leaves.push({ p: [x0 + 0.55 + jr(0, 0.05), FL + 1.35 - k * 0.07, z - 0.05 + jr(-0.12, 0.12)], s: 0.8 });
    C(x0, x0 + 0.86, z - 0.8, z + 0.8);
  }
  // ---- wall lantern (emissive) over the piano end
  const wallLamp = (x, y, z, ry) => {
    const g = new THREE.Group();
    add(rbox(0.08, 0.22, 0.04, 0.015, iron, 1), 0, 0.12, 0.02, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 12, PI / 2), iron), 0, 0.1, 0.14, 0, PI / 2, 0, g);
    add(rbox(0.2, 0.26, 0.2, 0.03, glow, 1), 0, -0.06, 0.26, 0, 0, 0, g);
    add(rbox(0.26, 0.05, 0.26, 0.02, iron, 1), 0, 0.1, 0.26, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 4), iron), 0, 0.19, 0.26, 0, PI / 4, 0, g);
    g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
  };
  wallLamp(-IX, 2.35, 1.0, PI / 2);
  // ---- cream sofa under the front window: plump arms, cushions, a blue throw
  {
    const cx = -2.35, L = 1.75, zb = IZ;
    rb(cx, FL + 0.2, zb - 0.43, L, 0.32, 0.84, trim, 0.08);
    add(rbox(L, 0.62, 0.26, 0.11, trim, 2), cx, FL + 0.6, zb - 0.14);
    for (const s of [-1, 1]) add(rbox(0.24, 0.5, 0.88, 0.1, trim, 2), cx + s * (L / 2 - 0.1), FL + 0.43, zb - 0.43);
    for (const s of [-1, 1]) add(rbox(0.64, 0.15, 0.62, 0.06, trim, 2), cx + s * 0.33, FL + 0.43, zb - 0.5);
    ir(cx - 0.42, FL + 0.93, zb - 0.16, 0.7, 0.05, 0.34, BLUE, 0.1); ir(cx - 0.45, FL + 0.62, zb - 0.32, 0.6, 0.6, 0.04, BLUE, 0.1, 0.35);
    ir(cx - 0.42, FL + 0.52, zb - 0.55, 0.62, 0.04, 0.5, BLUE, 0.08);
    const cush = [[-0.62, 0xf2c25a], [-0.22, 0x8ea2c2], [0.2, 0xf6efe0], [0.6, 0xf2c25a]];
    for (const [dx, c] of cush) ir(cx + dx, FL + 0.7, zb - 0.38, 0.36, 0.34, 0.13, c, jr(-0.2, 0.2), 0.3, jr(-0.1, 0.1));
    is(cx + 0.2, FL + 0.72, zb - 0.45, 0.07, 0.07, 0.03, 0xd9483e);
    C(cx - L / 2, cx + L / 2, zb - 0.9, zb);
  }
  // ---- low coffee table on a braided rug (tea set, a book)
  {
    const tx = -2.35, tz = 2.3;
    ib(tx, FL + 0.006, tz, 2.1, 0.012, 1.7, BLUE); ib(tx, FL + 0.008, tz, 1.9, 0.012, 1.5, 0xf1e3c6); ib(tx, FL + 0.01, tz, 1.55, 0.012, 1.15, 0xc9d3e2); ib(tx, FL + 0.012, tz, 1.3, 0.012, 0.9, 0xf1e3c6);
    rb(tx, FL + 0.42, tz, 1.05, 0.07, 0.6, timber, 0.025);
    rb(tx, FL + 0.32, tz, 0.95, 0.1, 0.5, timberDark, 0.02);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rb(tx + sx * 0.44, FL + 0.2, tz + sz * 0.22, 0.07, 0.4, 0.07, timber, 0.02);
    is(tx + 0.15, FL + 0.55, tz, 0.22, 0.17, 0.2, WHITE); is(tx + 0.15, FL + 0.66, tz, 0.06, 0.05, 0.06, WHITE);
    ic(tx + 0.3, FL + 0.56, tz + 0.04, 0.02, 0.14, WHITE, 0, 0, -0.8); is(tx + 0.15, FL + 0.55, tz + 0.1, 0.1, 0.06, 0.02, DELFT);
    for (const [dx, dz] of [[-0.15, 0.12], [-0.05, -0.15]]) { ic(tx + dx, FL + 0.5, tz + dz, 0.05, 0.06, WHITE); ic(tx + dx, FL + 0.465, tz + dz, 0.08, 0.01, WHITE); }
    ib(tx - 0.33, FL + 0.48, tz + 0.02, 0.26, 0.05, 0.2, 0x4f6a8a, 0.3);
    C(tx - 0.55, tx + 0.55, tz - 0.32, tz + 0.32);
  }
  // ---- range + cream hood with hanging copper pans
  {
    const sx = 2.3;
    rb(sx, FL + 0.43, 0.34, 1.0, 0.86, 0.64, shutterMat, 0.04);
    rb(sx, FL + 0.89, 0.34, 1.06, 0.06, 0.68, iron, 0.02);
    ib(sx, FL + 0.42, 0.665, 0.72, 0.42, 0.03, 0x4b4f5a); ib(sx, FL + 0.42, 0.68, 0.5, 0.22, 0.02, 0x6d7280);
    ic(sx, FL + 0.7, 0.7, 0.015, 0.74, BRASS, 0, 0, PI / 2);
    for (const k of [-1, 0, 1]) is(sx + k * 0.3, FL + 0.78, 0.68, 0.05, 0.05, 0.04, BRASS);
    for (const dx of [-0.25, 0.25]) ic(sx + dx, FL + 0.93, 0.34, 0.13, 0.025, 0x2c2826);
    ic(sx + 0.25, FL + 1.03, 0.32, 0.16, 0.17, COPPER); ic(sx + 0.25, FL + 1.12, 0.32, 0.17, 0.02, COPPER); is(sx + 0.25, FL + 1.15, 0.32, 0.05, 0.04, 0.05, 0x7a4a2a);
    ib(sx - 0.18, FL + 0.6, 0.715, 0.22, 0.3, 0.02, WHITE); ib(sx - 0.18, FL + 0.6, 0.72, 0.22, 0.04, 0.02, DELFT);
    rb(sx, 2.0, 0.37, 1.4, 0.22, 0.74, trim, 0.05);
    rb(sx, 2.63, 0.25, 1.0, 1.06, 0.5, trim, 0.05);
    rb(sx, 1.86, 0.72, 1.44, 0.08, 0.06, timber, 0.02);
    ib(sx, 1.42, 0.015, 1.3, 0.85, 0.02, 0xf4ecdc);
    for (let i = 0; i < 4; i++) ib(sx, 1.05 + i * 0.21, 0.02, 1.3, 0.012, 0.02, 0xdccfb8);
    ic(sx, 1.72, 0.06, 0.012, 1.25, 0x3b3530, 0, 0, PI / 2);
    for (const k of [-1, 0, 1]) { const r = 0.11 + (k + 1) * 0.02; ic(sx + k * 0.38, 1.6 - r, 0.07, r, 0.05, COPPER, PI / 2); ib(sx + k * 0.38, 1.66, 0.07, 0.03, 0.14, 0.02, COPPER); }
    C(sx - 0.7, sx + 0.7, 0.0, 0.74);
  }
  // ---- painted counter with a farmhouse sink in the back-right corner, shelf of jugs above
  {
    const cab = (x0, x1, z0, z1) => { rb((x0 + x1) / 2, FL + 0.43, (z0 + z1) / 2, x1 - x0, 0.86, z1 - z0, shutterMat, 0.03); rb((x0 + x1) / 2, FL + 0.89, (z0 + z1) / 2, x1 - x0 + 0.05, 0.06, z1 - z0 + 0.04, timber, 0.02); };
    cab(3.0, IX, 0.0, 0.65); cab(IX - 0.65, IX, 0.65, 1.5);
    for (const x of [3.22, 3.6]) { ib(x, FL + 0.42, 0.665, 0.32, 0.6, 0.02, 0x7d93b1); is(x + 0.1, FL + 0.6, 0.68, 0.04, 0.04, 0.03, BRASS); }
    ib(IX - 0.665, FL + 0.42, 1.07, 0.02, 0.6, 0.6, 0x7d93b1); is(IX - 0.68, FL + 0.6, 0.85, 0.03, 0.04, 0.04, BRASS);
    ib(IX - 0.33, FL + 0.82, 0.95, 0.52, 0.28, 0.6, 0xf4f0e6); ib(IX - 0.33, FL + 0.93, 0.95, 0.42, 0.04, 0.5, 0xc9cfd6);
    ic(IX - 0.08, FL + 1.06, 0.95, 0.02, 0.3, BRASS); ic(IX - 0.17, FL + 1.2, 0.95, 0.018, 0.2, BRASS, 0, 0, PI / 2);
    rb(3.42, 1.86, 0.13, 0.85, 0.04, 0.24, timber, 0.01);
    ic(3.15, 1.98, 0.13, 0.08, 0.2, WHITE); ic(3.15, 2.09, 0.13, 0.05, 0.04, DELFT);
    ic(3.4, 1.97, 0.13, 0.07, 0.18, 0xe8dcc0); ic(3.62, 1.95, 0.13, 0.06, 0.14, 0xe8dcc0);
    ic(3.3, FL + 0.97, 0.33, 0.17, 0.08, BLUE); for (let k = 0; k < 5; k++) is(3.3 + jr(-0.09, 0.09), FL + 1.03, 0.33 + jr(-0.09, 0.09), 0.08, 0.07, 0.08, 0xf5cf3a);
    ic(IX - 0.25, FL + 1.0, 1.35, 0.09, 0.14, 0xd98c5a); sprig(IX - 0.25, FL + 1.1, 1.35, 0.14, 12, 0.8);
    C(3.0, IX, 0.0, 0.67); C(IX - 0.67, IX, 0.65, 1.5);
  }
  // ---- blue-grey china dresser on the right wall: cupboard below, plate rack above
  {
    const x = IX - 0.25, z = 2.4, L = 1.2;
    rb(x, FL + 0.45, z, 0.5, 0.9, L, shutterMat, 0.03);
    rb(x - 0.02, FL + 0.93, z, 0.56, 0.06, L + 0.06, timber, 0.02);
    for (const s of [-1, 1]) { ib(x - 0.255, FL + 0.45, z + s * 0.29, 0.02, 0.66, 0.5, 0x7d93b1); is(x - 0.27, FL + 0.6, z + s * 0.08, 0.03, 0.04, 0.04, BRASS); }
    rb(IX - 0.03, 1.72, z, 0.04, 1.3, L, shutterMat, 0.01);
    for (const s of [-1, 1]) rb(x + 0.06, 1.72, z + s * (L / 2 - 0.03), 0.36, 1.3, 0.05, shutterMat, 0.01);
    for (const y of [1.48, 1.9]) rb(x + 0.06, y, z, 0.34, 0.04, L - 0.06, shutterMat, 0.01);
    rb(x + 0.02, 2.42, z, 0.46, 0.1, L + 0.1, shutterMat, 0.02);
    for (const y of [1.11, 1.53, 1.95]) for (let k = 0; k < 4; k++) {
      const zz = z - 0.42 + k * 0.28;
      ic(IX - 0.13, y + 0.13, zz, 0.12, 0.02, WHITE, 0, 0, PI / 2 + 0.12); ic(IX - 0.145, y + 0.13, zz, 0.07, 0.01, k % 2 ? DELFT : 0x9fb3d6, 0, 0, PI / 2 + 0.12);
    }
    is(x, 2.62, z - 0.3, 0.24, 0.26, 0.24, WHITE); is(x, 2.62, z - 0.3, 0.25, 0.08, 0.25, DELFT);
    for (let k = 0; k < 18; k++) leaves.push({ p: [x - 0.2 + jr(-0.05, 0.05), 2.55 - k * 0.06, z + 0.35 + jr(-0.1, 0.1)], s: 0.8 });
    sprig(x, 2.6, z + 0.35, 0.2, 14); ic(x, 2.53, z + 0.35, 0.11, 0.14, 0xd98c5a);
    C(IX - 0.52, IX, z - L / 2 - 0.03, z + L / 2 + 0.03);
  }
  // ---- round table with four ladder-back chairs on a braided rug, jug of flowers
  const chair = (x, z, ry) => {
    const g = new THREE.Group(), a = (m, px, py, pz, rx = 0) => add(m, px, py, pz, rx, 0, 0, g);
    a(rbox(0.44, 0.06, 0.42, 0.02, rush, 1), 0, FL + 0.46, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a(pbox(0.045, 0.46, 0.045, shutterMat), sx * 0.19, FL + 0.23, sz * 0.18);
    for (const sx of [-1, 1]) a(pbox(0.05, 0.64, 0.05, shutterMat), sx * 0.19, FL + 0.78, -0.19);
    for (const y of [0.74, 0.9, 1.04]) a(pbox(0.36, 0.06, 0.03, shutterMat), 0, FL + y, -0.19);
    g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  };
  {
    const tx = 2.0, tz = 2.25;
    for (const [r, c] of [[1.2, 0xe0b878], [1.02, 0xc99a5c], [0.84, 0xe8c690], [0.6, 0xcf9f62], [0.38, 0xe8c690]]) ic(tx, FL + 0.004 + (1.2 - r) * 0.008, tz, r, 0.01, c);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 22), timber), tx, FL + 0.77, tz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.72, 10), timberDark), tx, FL + 0.38, tz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.07, 12), timberDark), tx, FL + 0.035, tz);
    ic(tx, FL + 0.805, tz, 0.24, 0.006, WHITE);
    ic(tx, FL + 0.9, tz, 0.08, 0.18, WHITE); ic(tx, FL + 0.9, tz, 0.082, 0.05, DELFT);
    bunch(tx, FL + 1.0, tz, 0.13, 16, [0xffd23f, 0xffffff, 0xfff1a8]); sprig(tx, FL + 0.98, tz, 0.15, 10);
    for (const [dx, dz] of [[0, -0.75], [0.75, 0], [0, 0.75], [-0.75, 0]]) chair(tx + dx, tz + dz, Math.atan2(-dx, -dz));
    C(tx - 0.95, tx + 0.95, tz - 0.95, tz + 0.95);
  }

  // ================= BACK ROOM: the concept's upstairs bedroom & study, on the ground floor =================
  // ---- canopy bed, head against the back wall
  {
    const cx = -2.2, z0 = -IZ, L = 2.1, Wb = 1.6, zc = z0 + L / 2;
    rb(cx, FL + 0.27, zc, Wb + 0.04, 0.2, L, timber, 0.03);
    add(rbox(Wb - 0.06, 0.26, L - 0.14, 0.08, trim, 2), cx, FL + 0.5, zc + 0.02);
    rb(cx, FL + 0.72, z0 + 0.06, Wb + 0.1, 1.24, 0.09, timber, 0.04);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.09, 18, 1, false, -PI / 2, PI), timber), cx, FL + 1.28, z0 + 0.06, -PI / 2, 0, 0);
    rb(cx, FL + 0.47, z0 + L - 0.05, Wb + 0.1, 0.78, 0.09, timber, 0.04);
    for (const sx of [-1, 1]) for (const zz of [z0 + 0.06, z0 + L - 0.05]) { rb(cx + sx * (Wb / 2 + 0.05), FL + 1.3, zz, 0.11, 2.6, 0.11, timber, 0.03); is(cx + sx * (Wb / 2 + 0.05), FL + 2.66, zz, 0.15, 0.15, 0.15, 0xc8925a); }
    for (const sx of [-1, 1]) rb(cx + sx * (Wb / 2 + 0.05), FL + 2.55, zc, 0.07, 0.07, L, timber, 0.02);
    for (const zz of [z0 + 0.06, z0 + L - 0.05]) rb(cx, FL + 2.55, zz, Wb + 0.18, 0.07, 0.07, timber, 0.02);
    for (const sx of [-1, 1]) add(rbox(0.03, 0.24, L + 0.1, 0.01, trim, 1), cx + sx * (Wb / 2 + 0.12), FL + 2.48, zc);
    add(rbox(Wb + 0.24, 0.24, 0.03, 0.01, trim, 1), cx, FL + 2.48, z0 + L + 0.03);
    for (const sx of [-1, 1]) for (const zz of [z0 + 0.15, z0 + L - 0.08]) add(rbox(0.3, 2.0, 0.14, 0.06, trim, 2), cx + sx * (Wb / 2 + 0.16), FL + 1.42, zz, 0, 0, sx * 0.03);
    ir(cx, FL + 0.66, zc + 0.35, Wb + 0.02, 0.06, L - 0.8, 0xe58d86); for (const sx of [-1, 1]) ib(cx + sx * (Wb / 2 - 0.01), FL + 0.48, zc + 0.35, 0.03, 0.34, L - 0.8, 0xe58d86);
    ir(cx, FL + 0.68, zc - 0.08, Wb + 0.03, 0.07, 0.24, 0xf6efe0);
    for (const sx of [-1, 1]) ir(cx + sx * 0.38, FL + 0.74, z0 + 0.3, 0.62, 0.22, 0.34, 0xfbf8f0, 0, -0.45);
    ir(cx - 0.05, FL + 0.8, z0 + 0.48, 0.42, 0.32, 0.12, BLUE, 0.05, -0.3); ir(cx + 0.35, FL + 0.78, z0 + 0.52, 0.34, 0.28, 0.11, 0xf6efe0, -0.1, -0.3);
    for (let k = 0; k < 40; k++) leaves.push({ p: [cx + 0.7 + jr(-0.4, 0.4) - k * 0.02, HG - 0.15 - jr(0, 0.7) * (k % 3 === 0 ? 1.6 : 1), z0 + 0.05 + jr(0, 0.06)], s: 0.9 });   // ivy over the bed head
    C(cx - Wb / 2 - 0.13, cx + Wb / 2 + 0.13, z0, z0 + L + 0.05);
    // nightstand with an oil lamp and a little jug of pinks
    const nx = -3.5, nz = z0 + 0.3;
    rb(nx, FL + 0.3, nz, 0.5, 0.6, 0.48, timber, 0.03); rb(nx, FL + 0.62, nz, 0.56, 0.04, 0.52, timber, 0.015);
    ib(nx, FL + 0.42, nz + 0.245, 0.4, 0.16, 0.02, 0xb27a48); is(nx, FL + 0.42, nz + 0.26, 0.04, 0.04, 0.03, BRASS);
    ic(nx - 0.1, FL + 0.68, nz, 0.08, 0.04, BRASS); add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 10), glow), nx - 0.1, FL + 0.8, nz);
    ic(nx + 0.12, FL + 0.72, nz - 0.05, 0.06, 0.14, WHITE); bunch(nx + 0.12, FL + 0.8, nz - 0.05, 0.09, 10, [0xf4a2c0, 0xffb3c6, 0xffffff]);
    C(-IX, nx + 0.28, z0, nz + 0.27);
  }
  // ---- study: tall bookshelves on the back wall with a desk in front (globe, oil lamp, open book), chair
  {
    const x0 = 0.95, x1 = 3.05, zb = -IZ, dep = 0.38, top = 2.75, xm = (x0 + x1) / 2;
    for (const x of [x0, xm, x1]) rb(x, (FL + top) / 2, zb + dep / 2, 0.06, top - FL, dep, timber, 0.015);
    rb(xm, (FL + top) / 2, zb + 0.02, x1 - x0, top - FL, 0.03, timberDark, 0.01);
    for (const y of [1.28, 1.74, 2.2, top]) rb(xm, y, zb + dep / 2, x1 - x0 + 0.06, 0.05, dep, timber, 0.012);
    rb(xm, top + 0.08, zb + dep / 2 + 0.02, x1 - x0 + 0.16, 0.1, dep + 0.06, timber, 0.02);
    const BOOK = [0xa8473a, 0x5f7d4f, 0x4f6a8a, 0xc9963d, 0x8a5a3a, 0xe8dcc0, 0x7a4a6a, 0xb86a3a, 0x3f5a48];
    for (const y of [1.305, 1.765, 2.225]) for (const [a0, a1] of [[x0 + 0.04, xm - 0.04], [xm + 0.04, x1 - 0.04]]) {
      let x = a0 + jr(0, 0.12);
      while (x < a1 - 0.05) {
        if (rr() < 0.08) { x += jr(0.12, 0.25); continue; }
        const bw = jr(0.035, 0.075), bh = jr(0.24, 0.36) * (y > 2 ? 0.95 : 1), lean = x > a1 - 0.2 && rr() < 0.4 ? 0.25 : 0;
        ib(x + bw / 2, y + bh / 2 + 0.01, zb + 0.2 + jr(-0.02, 0.02), bw, bh, jr(0.2, 0.26), pick(BOOK), 0, 0, lean);
        x += bw + 0.004;
      }
    }
    ic(x0 + 0.35, top + 0.25, zb + 0.2, 0.17, 0.22, 0xd9b26a); ic(x1 - 0.4, top + 0.24, zb + 0.2, 0.15, 0.2, 0xd9b26a);
    sprig(xm + 0.2, top + 0.3, zb + 0.2, 0.25, 16); for (let k = 0; k < 16; k++) leaves.push({ p: [xm + 0.2 + jr(-0.2, 0.2), top + 0.1 - k * 0.07, zb + 0.4 + jr(0, 0.05)], s: 0.85 });
    // desk
    const dz = zb + 0.38 + 0.3;
    rb(xm, FL + 0.76, dz - 0.06, x1 - x0 - 0.3, 0.06, 0.72, timber, 0.02);
    rb(x1 - 0.42, FL + 0.37, dz - 0.06, 0.5, 0.74, 0.66, timber, 0.02);
    for (let k = 0; k < 3; k++) { ib(x1 - 0.42, FL + 0.16 + k * 0.22, dz + 0.275, 0.42, 0.17, 0.02, 0xb27a48); is(x1 - 0.42, FL + 0.16 + k * 0.22, dz + 0.29, 0.04, 0.04, 0.03, BRASS); }
    for (const zz of [dz + 0.22, dz - 0.32]) rb(x0 + 0.24, FL + 0.37, zz, 0.07, 0.74, 0.07, timber, 0.02);
    is(x0 + 0.5, FL + 1.1, dz - 0.15, 0.3, 0.3, 0.3, 0x7fa6a8); is(x0 + 0.47, FL + 1.15, dz - 0.07, 0.12, 0.1, 0.1, 0x8fae6a);
    ic(x0 + 0.5, FL + 0.86, dz - 0.15, 0.08, 0.05, BRASS); ic(x0 + 0.5, FL + 0.92, dz - 0.15, 0.015, 0.1, BRASS);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 5, 18), M(0xd9a650, null)), x0 + 0.5, FL + 1.1, dz - 0.15, 0, 0.5, 0);
    ib(xm + 0.1, FL + 0.8, dz, 0.22, 0.02, 0.3, 0xf3ead6, 0.2, 0, 0.08); ib(xm + 0.32, FL + 0.8, dz + 0.02, 0.22, 0.02, 0.3, 0xf3ead6, 0.2, 0, -0.08);
    ic(x1 - 0.4, FL + 0.84, dz - 0.2, 0.08, 0.04, BRASS); add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.17, 10), glow), x1 - 0.4, FL + 0.95, dz - 0.2);
    ic(x1 - 0.18, FL + 0.88, dz + 0.05, 0.07, 0.16, WHITE); bunch(x1 - 0.18, FL + 0.98, dz + 0.05, 0.12, 14, [0xffd23f, 0xffc21a, 0xfff1a8]); sprig(x1 - 0.18, FL + 0.96, dz + 0.05, 0.12, 8);
    ib(x0 + 0.85, FL + 0.84, dz - 0.25, 0.25, 0.1, 0.2, 0xa8473a, 0.3); ib(x0 + 0.85, FL + 0.91, dz - 0.25, 0.23, 0.05, 0.18, 0x4f6a8a, 0.25);
    chair(xm - 0.1, dz + 0.62, PI);
    C(x0 - 0.04, x1 + 0.04, zb, dz + 0.32); C(xm - 0.37, xm + 0.17, dz + 0.36, dz + 0.88);
  }
  // ---- cream rug with a blue border, birdcage on its stand by the tall window, wall lantern
  {
    const rx = 0.25, rz = -2.05;
    ib(rx, FL + 0.006, rz, 2.6, 0.012, 1.7, 0x9fb0c8); ib(rx, FL + 0.009, rz, 2.4, 0.012, 1.5, 0xf2e6cc); ib(rx, FL + 0.011, rz, 2.0, 0.012, 1.1, 0xb9c6d8); ib(rx, FL + 0.013, rz, 1.85, 0.012, 0.95, 0xf2e6cc);
    for (let k = 0; k < 22; k++) for (const s of [-1, 1]) ib(rx + s * 1.32, FL + 0.005, rz - 0.8 + k * 0.076, 0.07, 0.008, 0.025, 0xf2e6cc);
    const bx = 3.45, bz = -3.4;
    ic(bx, FL + 0.03, bz, 0.22, 0.06, 0x9c6a42); ic(bx, FL + 0.75, bz, 0.035, 1.4, 0x9c6a42); ic(bx, FL + 1.45, bz, 0.2, 0.04, 0x9c6a42);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2; ic(bx + Math.cos(a) * 0.17, FL + 1.7, bz + Math.sin(a) * 0.17, 0.007, 0.48, 0x7a6a4a); }
    is(bx, FL + 1.94, bz, 0.36, 0.2, 0.36, 0x9c8a5a); is(bx, FL + 2.06, bz, 0.05, 0.08, 0.05, 0x7a6a4a); ic(bx, FL + 1.6, bz, 0.17, 0.02, 0x7a6a4a);
    C(bx - 0.25, bx + 0.25, bz - 0.25, bz + 0.25);
    wallLamp(-IX, 2.25, -2.6, PI / 2);
    wallLamp(IX, 2.3, -0.75, -PI / 2);
  }
  // ---- pendant lanterns hang from the ceiling (part of 'roof', so they hide with it)
  for (const [x, z] of [[2.0, 2.25], [-2.35, 2.2], [0.25, -2.05]]) {
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), iron), x, HG - 0.27, z);
    addR(rbox(0.24, 0.3, 0.24, 0.03, glow, 1), x, HG - 0.66, z);
    addR(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 4), iron), x, HG - 0.43, z, 0, PI / 4, 0);
    addR(rbox(0.28, 0.04, 0.28, 0.015, iron, 1), x, HG - 0.82, z);
  }

  // ---------------- upper-floor balcony on the cross-gable (in 'roof'): deck on brackets, balusters, flower boxes, pent roof
  {
    const y = 3.3, bw = 2.8, bd = 0.72, z0 = FO + 0.01, zf = z0 + bd;
    windowUnit(GX, y + 0.88, 0.86, 1.62, 2, FRONT + 0.06, roof, false);
    addR(rbox(bw, 0.14, bd, 0.04, timber), GX, y, z0 + bd / 2);
    for (let k = 0; k < 6; k++) addR(rbox(0.12, 0.14, bd + 0.12, 0.03, timberDark, 1), GX - bw / 2 + 0.12 + k * ((bw - 0.24) / 5), y - 0.13, z0 + bd / 2 + 0.05);
    for (const sx of [-1, 0, 1]) {
      addR(rbox(0.1, 0.95, 0.1, 0.03, timberDark, 1), GX + sx * (bw / 2 - 0.2), y - 0.52, z0 + 0.35, 0.72, 0, 0);
      addR(rbox(0.12, 0.4, 0.1, 0.03, timberDark, 1), GX + sx * (bw / 2 - 0.2), y - 0.28, z0 + 0.04);
    }
    const rh = 0.85;
    for (const sx of [-1, 1]) for (const zz of [z0 + 0.05, zf - 0.05]) addR(rbox(0.1, rh + 0.08, 0.1, 0.03, timber, 1), GX + sx * (bw / 2 - 0.05), y + (rh + 0.08) / 2, zz);
    const nb = 16;
    for (let k = 1; k < nb; k++) addR(pbox(0.05, rh - 0.08, 0.05, timber), GX - bw / 2 + 0.05 + (k * (bw - 0.1)) / nb, y + rh / 2, zf - 0.05);
    for (const sx of [-1, 1]) for (let k = 1; k < 5; k++) addR(pbox(0.05, rh - 0.08, 0.05, timber), GX + sx * (bw / 2 - 0.05), y + rh / 2, z0 + 0.05 + (k * (bd - 0.1)) / 5);
    addR(rbox(bw + 0.06, 0.08, 0.12, 0.03, timber, 1), GX, y + rh, zf - 0.05);
    for (const sx of [-1, 1]) addR(rbox(0.12, 0.08, bd, 0.03, timber, 1), GX + sx * (bw / 2 - 0.05), y + rh, z0 + bd / 2);
    addR(rbox(bw, 0.06, 0.08, 0.02, timber, 1), GX, y + 0.12, zf - 0.05);
    flowerBox(GX - 0.68, y + rh - 0.08, 1.1, zf + 0.12, [0xf06a8a, 0xf4a2c0, 0xffffff, 0xffb3c6], 1.4);
    flowerBox(GX + 0.68, y + rh - 0.08, 1.1, zf + 0.12, [0xffd23f, 0xffb43d, 0xf06a8a, 0xffffff], 1.4);
    const ry = 5.2, rf = 4.9, rd = bd + 0.3;
    for (const sx of [-1, 1]) {
      addR(rbox(0.1, ry - y - rh - 0.25, 0.1, 0.03, timber, 1), GX + sx * (bw / 2 - 0.05), (y + rh + rf - 0.15) / 2, zf - 0.05);
      addR(rbox(0.08, 0.42, 0.08, 0.02, timberDark, 1), GX + sx * (bw / 2 - 0.18), rf - 0.32, zf - 0.17, 0, 0, sx * 0.7);
    }
    addR(rbox(bw + 0.1, 0.12, 0.12, 0.03, timber, 1), GX, rf - 0.12, zf - 0.05);
    const tilt = Math.atan2(ry - rf, rd);
    addR(rbox(bw + 0.4, 0.08, rd + 0.12, 0.03, deckMat, 1), GX, (ry + rf) / 2 + 0.02, z0 + rd / 2, tilt, 0, 0);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 9; k++) {
      const zz = z0 + 0.12 + r * 0.24, yy = ry - (zz - z0) * Math.tan(tilt) + 0.09;
      addR(rbox(0.29, 0.035, 0.3, 0.02, M(0x66748f, null), 1), GX - bw / 2 - 0.05 + (k + (r % 2) * 0.5 + 0.25) * ((bw + 0.2) / 9.5), yy, zz, tilt - 0.06, jr(-0.04, 0.04), jr(-0.03, 0.03));
    }
  }

  // ---------------- iron wall lantern on a scroll bracket, right of the doorway
  {
    const lx = 1.4, ly = 2.6, z = FO - 0.05;
    add(rbox(0.12, 0.3, 0.05, 0.02, iron, 1), lx, ly + 0.1, z + 0.03);
    add(rbox(0.04, 0.04, 0.36, 0.015, iron, 1), lx, ly + 0.22, z + 0.2);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 14, PI * 1.3), iron), lx, ly + 0.08, z + 0.2, 0, PI / 2, 0);
    add(rbox(0.22, 0.3, 0.22, 0.03, glow, 1), lx, ly - 0.12, z + 0.38);
    add(rbox(0.28, 0.05, 0.28, 0.02, iron, 1), lx, ly + 0.05, z + 0.38);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.18, 4), iron), lx, ly + 0.16, z + 0.38, 0, PI / 4, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), iron), lx, ly + 0.27, z + 0.38);
    add(rbox(0.24, 0.04, 0.24, 0.02, iron, 1), lx, ly - 0.29, z + 0.38);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffb45a, 1.2, 4.5, 2); pl.position.set(lx, ly - 0.15, z + 0.6); root.add(pl); }
  }

  // ---------------- climbing vine up the left corner (front face and round the side), with little blossoms
  {
    const vines = [[-3.45, 4.9, 'f'], [-3.2, 3.6, 'f'], [-3.65, 5.0, 'f'], [3.85, 4.6, 's'], [3.6, 3.4, 's'], [3.75, 2.4, 's']];
    for (const [v0, top, face] of vines) {
      let a = v0, y = 0.25;
      while (y < top) {
        a += jr(-0.1, 0.1); y += jr(0.05, 0.11);
        if (face === 'f') a = Math.min(-3.05, Math.max(-W / 2 + 0.2, a)); else a = Math.min(FRONT - 0.1, Math.max(3.55, a));
        for (let k = 0; k < 3; k++) {
          const p = face === 'f' ? [a + jr(-0.15, 0.15), y + jr(-0.08, 0.08), FO + 0.05 + jr(0, 0.06)] : [-SO - 0.03 - jr(0, 0.06), y + jr(-0.08, 0.08), a + jr(-0.15, 0.15)];
          leaves.push({ p, s: jr(0.75, 1.25) });
        }
        if (rr() < 0.18) {
          const p = face === 'f' ? [a + jr(-0.12, 0.12), y, FO + 0.12] : [-SO - 0.1, y, a + jr(-0.12, 0.12)];
          blossoms.push({ p, s: jr(0.8, 1.1), c: pick([0xf4a2c0, 0xffffff, 0xf06a8a, 0xffd0e0]) });
        }
      }
    }
    for (let k = 0; k < 30; k++) leaves.push({ p: [jr(-3.9, -2.9), jr(4.35, 4.6), FRONT + 0.25 + jr(0, 0.15)], s: jr(0.7, 1.1) });
    // shrubs at the corners (planted → fine in-game)
    for (const [bx, bz, n] of [[-3.95, FO + 0.38, 60], [3.95, FO + 0.33, 50], [-4.45, -2.6, 40], [4.45, -3.0, 40]]) {
      for (let i = 0; i < n; i++) { const a = jr(0, 6.28), r = Math.sqrt(rr()) * 0.4, y = jr(0.08, 0.85); leaves.push({ p: [bx + Math.cos(a) * r * (1.1 - y * 0.5), y, bz + Math.sin(a) * r * (1.1 - y * 0.5)], s: jr(0.9, 1.35) }); }
    }
  }

  // ---------------- prop slots: where the game puts hideable props indoors (groups of the same kind beside furniture)
  const propSlots = [
    { id: 'lamp_table', x: -3.55, z: 3.45, rot: 0 }, { id: 'lamp_table', x: -1.15, z: 3.45, rot: 0.3 },
    { id: 'stool', x: -2.95, z: 1.95, rot: 0 }, { id: 'stool', x: 2.95, z: 1.02, rot: 0.5 },
    { id: 'flower_pot', x: 3.5, z: 3.5, rot: 0 }, { id: 'flower_pot', x: 3.05, z: 3.55, rot: 1 }, { id: 'flower_pot', x: 3.55, z: 3.05, rot: 2 },
    { id: 'chest', x: -2.2, z: -1.42, rot: 0 }, { id: 'chest', x: -3.45, z: -0.72, rot: PI / 2 },
    { id: 'armchair', x: 3.2, z: -0.9, rot: -2.36 }, { id: 'armchair', x: 2.2, z: -0.78, rot: -2.85 },
    { id: 'book_stack', x: 0.6, z: -3.5, rot: 0 }, { id: 'book_stack', x: 0.6, z: -3.05, rot: 0.7 }, { id: 'book_stack', x: 3.6, z: -1.3, rot: 0.3 },
  ];

  // ---------------- garden version only: the concept's loose furniture & clutter at those same slots, and the porch props
  if (garden) {
    const barrelWood = M(0xe8b37e, tex('wood_light', 1.5, 0.6));
    const metal = M(0xdfe6ec, tex('painted_metal', 0.6, 0.6));
    const red = M(0xd9483e, tex('painted_metal', 0.5, 0.5));
    const pot = new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.18, 0.24], [0.2, 0.29], [0.17, 0.3], [0, 0.3]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
    for (const s of propSlots) {
      const { x, z, rot } = s;
      if (s.id === 'lamp_table') { ic(x, FL + 0.6, z, 0.24, 0.04, 0xb27a48); ic(x, FL + 0.3, z, 0.04, 0.58, 0x9c6a42); ic(x, FL + 0.02, z, 0.16, 0.04, 0x9c6a42); ic(x, FL + 0.72, z, 0.06, 0.2, WHITE); add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.2, 12), glow), x, FL + 0.92, z); }
      if (s.id === 'stool') { ic(x, FL + 0.48, z, 0.18, 0.06, 0x3f5a8a); for (let k = 0; k < 3; k++) { const a = rot + (k / 3) * PI * 2; ic(x + Math.cos(a) * 0.11, FL + 0.23, z + Math.sin(a) * 0.11, 0.025, 0.46, 0x9c6a42); } }
      if (s.id === 'flower_pot') { add(new THREE.Mesh(pot, terracotta), x, FL, z).scale.setScalar(1.15); sprig(x, FL + 0.4, z, 0.2, 12); bunch(x, FL + 0.45, z, 0.18, 12, [0xf4a2c0, 0xffb3c6, 0xf06a8a]); }
      if (s.id === 'chest') { const g = new THREE.Group(); add(rbox(0.9, 0.5, 0.5, 0.05, timber, 1), 0, FL + 0.25, 0, 0, 0, 0, g); add(rbox(0.92, 0.1, 0.52, 0.04, timberDark, 1), 0, FL + 0.52, 0, 0, 0, 0, g); for (const sx of [-0.3, 0.3]) add(rbox(0.05, 0.6, 0.53, 0.01, iron, 1), sx, FL + 0.29, 0, 0, 0, 0, g); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g); }
      if (s.id === 'armchair') { const g = new THREE.Group(); add(rbox(0.8, 0.42, 0.75, 0.1, shutterMat, 2), 0, FL + 0.25, 0, 0, 0, 0, g); add(rbox(0.8, 0.6, 0.2, 0.1, shutterMat, 2), 0, FL + 0.7, -0.3, 0, 0, 0, g); for (const sx of [-1, 1]) add(rbox(0.16, 0.36, 0.72, 0.07, shutterMat, 2), sx * 0.36, FL + 0.55, 0, 0, 0, 0, g); add(rbox(0.5, 0.42, 0.06, 0.03, trim, 1), 0.05, FL + 0.82, -0.18, -0.2, 0, 0, g); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g); }
      if (s.id === 'book_stack') for (let k = 0; k < 4; k++) ib(x, FL + 0.04 + k * 0.07, z, 0.3 - k * 0.02, 0.065, 0.22, pick([0xa8473a, 0x5f7d4f, 0x4f6a8a, 0xc9963d]), rot + jr(-0.2, 0.2));
    }
    ic(-0.6, FL + 0.17, 1.35, 0.14, 0.3, WHITE); ic(-0.6, FL + 0.17, 1.35, 0.142, 0.08, DELFT); bunch(-0.6, FL + 0.38, 1.35, 0.12, 18, [0x9b86d6, 0xb6a2e8]); sprig(-0.6, FL + 0.35, 1.35, 0.12, 10);   // lavender jug at the stair foot
    // barrel + crate + milk can left of the door
    const bx = -3.35, bz = FO + 0.7;
    const bg = new THREE.LatheGeometry([[0, 0], [0.33, 0], [0.38, 0.2], [0.41, 0.42], [0.38, 0.66], [0.34, 0.8], [0, 0.8]].map(([a, b]) => new THREE.Vector2(a, b)), 18);
    add(new THREE.Mesh(bg, barrelWood), bx, 0, bz);
    for (const y of [0.16, 0.64]) add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 22), iron), bx, y, bz, PI / 2);
    const crate = (cx, cz, w, d, h) => {
      for (let k = 0; k < 3; k++) { const y = 0.07 + k * (h / 3); for (const s of [-1, 1]) { add(rbox(w, h / 3 - 0.03, 0.04, 0.015, timber, 1), cx, y, cz + s * (d / 2 - 0.02)); add(rbox(0.04, h / 3 - 0.03, d, 0.015, timber, 1), cx + s * (w / 2 - 0.02), y, cz); } }
      add(rbox(w - 0.04, 0.03, d - 0.04, 0.01, timber, 1), cx, 0.03, cz);
    };
    crate(-2.4, FO + 0.7, 0.6, 0.5, 0.48);
    add(new THREE.Mesh(pot, terracotta), -2.4, 0.48, FO + 0.7);
    for (let i = 0; i < 12; i++) { leaves.push({ p: [-2.4 + jr(-0.18, 0.18), jr(0.8, 0.98), FO + 0.7 + jr(-0.18, 0.18)], s: 0.8 }); blossoms.push({ p: [-2.4 + jr(-0.16, 0.16), jr(0.9, 1.05), FO + 0.7 + jr(-0.16, 0.16)], c: pick([0xf06a8a, 0xffffff]) }); }
    const can = new THREE.LatheGeometry([[0, 0], [0.17, 0], [0.18, 0.4], [0.12, 0.5], [0.1, 0.62], [0.13, 0.66], [0, 0.66]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
    add(new THREE.Mesh(can, metal), -1.45, 0, FO + 0.95);
    // right of the door: pot of sunflowers, a planter crate of pink flowers, a watering can, a wooden chair
    add(new THREE.Mesh(pot, terracotta), 1.2, 0, FO + 0.7).scale.setScalar(1.3);
    for (let i = 0; i < 14; i++) { leaves.push({ p: [1.2 + jr(-0.22, 0.22), jr(0.42, 0.7), FO + 0.7 + jr(-0.2, 0.2)], s: 0.9 }); blossoms.push({ p: [1.2 + jr(-0.2, 0.2), jr(0.6, 0.8), FO + 0.7 + jr(-0.2, 0.2)], s: 1.3, c: pick([0xffd23f, 0xffc21a]) }); }
    crate(2.75, FO + 0.7, 0.75, 0.45, 0.36);
    for (let i = 0; i < 26; i++) { leaves.push({ p: [2.75 + jr(-0.33, 0.33), jr(0.34, 0.55), FO + 0.7 + jr(-0.18, 0.18)], s: 0.9 }); blossoms.push({ p: [2.75 + jr(-0.32, 0.32), jr(0.45, 0.62), FO + 0.7 + jr(-0.18, 0.18)], s: 1.25, c: pick([0xf48fb1, 0xffb3c6, 0xf06a8a]) }); }
    {
      const wx = 1.75, wz = FO + 1.2;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 14), metal), wx, 0.15, wz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.4, 8), metal), wx + 0.26, 0.28, wz, 0, 0, -0.9);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 12, PI), metal), wx - 0.03, 0.31, wz);
    }
    {
      const cx = 3.75, cz = FO + 0.95;
      add(rbox(0.46, 0.06, 0.44, 0.02, timber, 1), cx, 0.46, cz);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rbox(0.05, sz < 0 ? 1.0 : 0.46, 0.05, 0.015, timber, 1), cx + sx * 0.19, sz < 0 ? 0.5 : 0.23, cz + sz * 0.18);
      for (const y of [0.7, 0.85]) add(rbox(0.42, 0.06, 0.03, 0.01, timber, 1), cx, y, cz - 0.18);
    }
    // red mailbox on a post at the far left
    add(rbox(0.12, 1.05, 0.12, 0.03, timberDark, 1), -4.6, 0.52, FO + 0.4);
    add(rbox(0.32, 0.3, 0.48, 0.06, red), -4.6, 1.18, FO + 0.4);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 12, 1, false, 0, PI), red), -4.6, 1.33, FO + 0.4, PI / 2, 0, -PI / 2);
    // stepping-stone path
    const pav = M(0xd2cfc6, tex('stone', 0.5, 0.5));
    for (let k = 0; k < 2; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.3, 0.38), jr(0.32, 0.4), 0.08, 9), pav), doorX + Math.sin(k * 1.3) * 0.18, 0.03, FO + 1.1 + k * 0.7, 0, jr(0, 3), 0);
  }

  // ---------------- instanced meshes: leaves & blossoms (split ground / roof), interior clutter
  {
    const o = new THREE.Object3D();
    const inst = (geo, mat, items, colors, name, P) => {
      if (!items.length) return;
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => {
        o.position.set(...it.p);
        if (it.r) o.rotation.set(...it.r); else o.rotation.set(jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28));
        const s = it.s ?? 1; typeof s === 'number' ? o.scale.setScalar(s) : o.scale.set(...s);
        o.updateMatrix(); im.setMatrixAt(i, o.matrix);
        im.setColorAt(i, it.c !== undefined ? new THREE.Color(it.c) : pick(colors).clone().offsetHSL(0, 0, jr(-0.05, 0.06)));
      });
      im.castShadow = true; im.receiveShadow = true; im.name = name; P.add(im);
    };
    const leafGeo = new THREE.CircleGeometry(0.1, 6); leafGeo.scale(1, 1.4, 1);
    const bloomGeo = new THREE.IcosahedronGeometry(0.075, 0);
    const gc = greens.map((h) => new THREE.Color(h)), up = (it) => (it.R !== undefined ? it.R : it.p[1] > HG);
    inst(leafGeo, leafMat, leaves.filter((it) => !up(it)), gc, 'leaves', root);
    inst(leafGeo, leafMat, leaves.filter(up), gc, 'leaves', roof);
    inst(bloomGeo, flowerMat, blossoms.filter((it) => !up(it)), [], 'blossoms', root);
    inst(bloomGeo, flowerMat, blossoms.filter(up), [], 'blossoms', roof);
    const prim = (geo, list, name) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, instMat, list.length);
      list.forEach(([x, y, z, sx, sy, sz, c, rx, ry, rz], i) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, new THREE.Color(c)); });
      im.castShadow = true; im.receiveShadow = true; im.name = name; root.add(im);
    };
    prim(new THREE.BoxGeometry(1, 1, 1), IB, 'clutter_box');
    prim(new RoundedBoxGeometry(1, 1, 1, 1, 0.2), IR, 'clutter_soft');
    prim(new THREE.CylinderGeometry(0.5, 0.5, 1, 14), IC, 'clutter_cyl');
    prim(new THREE.SphereGeometry(0.5, 12, 8), IS, 'clutter_ball');
  }

  root.userData.footprint = { w: W + 1.2, d: D + 1.6 };
  root.userData.door = { x: doorX, z: FRONT + 1.0 };
  root.userData.doorIn = { x: doorX, z: IZ - 0.7 };
  root.userData.innerDoors = [{ x: IDX, z: PZ }];
  root.userData.rooms = [
    { name: 'sitting room & kitchen', x: 0, z: +((IZ + PZ + 0.1) / 2).toFixed(3), w: 2 * IX, d: +(IZ - PZ - 0.1).toFixed(3) },
    { name: 'bedroom & study', x: 0, z: +((PZ - 0.1 - IZ) / 2).toFixed(3), w: 2 * IX, d: +(IZ + PZ - 0.1).toFixed(3) },
  ];
  root.userData.colliders = colliders;
  root.userData.propSlots = propSlots;
  if (opts.merge !== false) { mergeStatic(THREE, roof); mergeStatic(THREE, root); }
  return root;
}
