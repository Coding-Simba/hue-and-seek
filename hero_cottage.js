/* Hero cottage — hand-modelled in code from Codex's concept painting (assets/kit/concept_cottage.png), now enterable.
 * export buildHeroCottage(THREE, opts) → THREE.Group. Origin = ground centre of the house, front (gable, door) faces +Z.
 * Metres. 7 m wide, 8.4 m deep, ridge ≈ 5.9 m. Hollow 0.25 m walls; two ground-floor rooms behind an open arched doorway:
 * the kitchen-living room at the front (assets/interiors/hero_living.png) and the bedroom at the back (hero_bedroom.png).
 * Everything above the rooms (roof, gables, ceiling, chimney) lives in the child group 'roof' so the game can hide it.
 * Instanced tiles / leaves / logs / cloth clutter keep it light enough for phones.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { resolveCanonicalMaterial, prepareGeometryForBatch } from './world_optimizer.js?v=6';
const texCache = {};
const baseTexCache = {};
const sharedKitLoader = { inst: null };
const MAX_KIT_ANISO = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ? 4 : 8;
// shared painted-texture loader for every hand-modelled building (assets/kit/<name>.png), cached per name+repeat
// Shares a single THREE.Source per PNG file so 100+ (rx, ry) repeat variants upload to the GPU only ONCE!
export function kitTex(THREE, name, rx = 1, ry = 1) {
  const key = `${name}|${rx}|${ry}`;
  if (texCache[key]) return texCache[key];
  let base = baseTexCache[name];
  if (!base) {
    if (!sharedKitLoader.inst) sharedKitLoader.inst = new THREE.TextureLoader();
    base = sharedKitLoader.inst.load(`assets/kit/${name}.webp`, () => {
      if (base._clones) {
        for (const cl of base._clones) cl.needsUpdate = true;
      }
    });
    base.colorSpace = THREE.SRGBColorSpace;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = MAX_KIT_ANISO;
    base._unitBase = base;
    base._clones = [];
    baseTexCache[name] = base;
  }
  if (rx === 1 && ry === 1) return (texCache[key] = base);
  const t = base.clone();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = MAX_KIT_ANISO;
  t._unitBase = base;
  if (base._clones) base._clones.push(t);
  if (base.image) t.needsUpdate = true;
  return (texCache[key] = t);
}

export function buildHeroCottage(THREE, opts = {}) {
  const garden = opts.garden !== false;               // false = in-game: no decor that could be mistaken for a hideable prop
  const W = 7.0, D = 8.4, H = 3.0, RISE = 2.75, T = 0.25; // walls, gable & wall thickness
  const FRONT = D / 2, IX = W / 2 - T, IZ = FRONT - T;     // outer front face, inner half-width / half-depth
  const PT = 0.2;                                           // partition wall z ∈ [-PT, 0]: living room in front, bedroom behind
  const theta = Math.atan2(RISE, W / 2);                    // roof pitch
  const tex = (name, rx = 1, ry = 1) => kitTex(THREE, name, rx, ry);
  const matCache = {};
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  const root = new THREE.Group();
  root.name = 'hero_cottage';
  // everything above the rooms → one group the game hides while the player is inside
  const roofG = new THREE.Group(); roofG.name = 'roof'; roofG.userData.keep = true; root.add(roofG);
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const addR = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => add(mesh, x, y, z, rx, ry, rz, roofG);
  const rbox = (w, h, d, r, mat, seg = 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  // deterministic jitter so the house looks the same every load
  let seed = opts.seed || 7; const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const pick = (arr) => arr[Math.floor(rr() * arr.length)];
  // turn a geometry inside out (lining faces, window views seen from inside)
  const flip = (g) => {
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    return g;
  };

  // ---------------- materials (Codex's painted textures)
  const plaster = M(opts.wall || 0xf6e6c4, tex('plaster', 0.32, 0.32));
  const innerPlaster = M(0xfff0d6, tex('plaster', 0.4, 0.4));
  const stone = M(0xdcd8cf, tex('stone', 0.6, 0.6));
  const stoneDark = M(0xb8ab92, tex('stone', 0.8, 0.8));
  const timber = M(0x9a6a40, tex('wood_light', 0.5, 0.5));
  const timberLight = M(0xc89a5e, tex('wood_light', 0.6, 0.6));
  const doorWood = M(0xd9944e, tex('wood_light', 0.9, 0.9));
  const shutterMat = M(0x86a2bb, tex('plaster', 0.6, 0.6));
  const iron = M(0x3b3530, null, { roughness: 0.7 });
  const glass = M(0x4d6b7a, null, { roughness: 0.25, metalness: 0.1 });
  const view = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe2a8, emissiveIntensity: 0.55, roughness: 0.9, metalness: 0 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd894, emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.4 });
  const fireMat = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff7a1e, emissiveIntensity: 2.2, roughness: 0.9, metalness: 0 });
  const terracotta = M(0xffcfa8, tex('terracotta', 1, 1));
  const floorMat = M(0xf6d3a2, tex('wood_light', 4.6, 5.5));
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('roof_tiles', 0.5, 0.5), roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  const logMat = M(0xb88452, tex('bark', 1, 1));
  const logEnd = M(0xe3bf86, tex('wood_light', 0.4, 0.4));

  const leaves = [], blossoms = [];                        // [x, y, z, colour (0 = random green), isLeaf]
  const colliders = [];
  // cloth / crockery / books clutter: one instanced mesh per shape, tinted per instance
  const C = { box: [], soft: [], cyl: [], disc: [], sph: [] };
  const cl = (k, x, y, z, sx, sy, sz, c, ry = 0, rx = 0, rz = 0) => C[k].push([x, y, z, sx, sy, sz, c, rx, ry, rz]);
  const at = (gx, gz, ry) => (lx, lz) => [gx + lx * Math.cos(ry) + lz * Math.sin(ry), gz - lx * Math.sin(ry) + lz * Math.cos(ry)];
  const box = (x, z, w, d) => colliders.push({ x: +x.toFixed(3), z: +z.toFixed(3), w: +w.toFixed(3), d: +d.toFixed(3) });

  // ---------------- hollow wall: a straight wall with door notches and window holes, outer face at local z = 0,
  // inner face at z = -th, local x along the wall. Returns its group (for windows) and records the wall colliders.
  function wall(cx, cz, rotY, L, th, opens, outMat, inMat, P = root) {
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rotY; P.add(g);
    const s = new THREE.Shape(); s.moveTo(-L / 2, 0);
    const doors = opens.filter((o) => o.door).sort((a, b) => a.u - b.u);
    for (const o of doors) {
      const r = o.w / 2; s.lineTo(o.u - r, 0);
      if (o.arch) { s.lineTo(o.u - r, o.h - r); s.absarc(o.u, o.h - r, r, Math.PI, 0, true); } else { s.lineTo(o.u - r, o.h); s.lineTo(o.u + r, o.h); }
      s.lineTo(o.u + r, 0);
    }
    s.lineTo(L / 2, 0); s.lineTo(L / 2, H); s.lineTo(-L / 2, H); s.lineTo(-L / 2, 0);
    for (const o of opens) if (!o.door) {
      const p = new THREE.Path(), r = o.w / 2, top = o.y0 + o.h;
      p.moveTo(o.u - r, o.y0); p.lineTo(o.u + r, o.y0); p.lineTo(o.u + r, top); p.lineTo(o.u - r, top); p.lineTo(o.u - r, o.y0);
      s.holes.push(p);
    }
    const eg = new THREE.ExtrudeGeometry(s, { depth: th - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 12 });
    eg.translate(0, 0, -th + 0.03);
    add(new THREE.Mesh(eg, outMat), 0, 0, 0, 0, 0, 0, g);
    if (inMat) add(new THREE.Mesh(flip(new THREE.ShapeGeometry(s, 12)), inMat), 0, 0, -th - 0.004, 0, 0, 0, g);
    const c = Math.cos(rotY), sn = Math.sin(rotY);
    const seg = (a, b) => {
      if (b - a < 0.05) return;
      const uc = (a + b) / 2, lz = -th / 2, along = Math.abs(c) > 0.5;
      box(cx + uc * c + lz * sn, cz - uc * sn + lz * c, along ? b - a : th, along ? th : b - a);
    };
    let u0 = -L / 2;
    for (const o of doors) { seg(u0, o.u - o.w / 2); u0 = o.u + o.w / 2; }
    seg(u0, L / 2);
    return g;
  }
  // a beam between two points (braces, rails)
  const beam = (a, b, s, mat, P = root) => {
    const m = rbox(s, a.distanceTo(b), s, 0.03, mat, 1);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = true; m.receiveShadow = true; P.add(m); return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------------- walls: hollow shell (plaster outside, warm plaster inside), plank floor
  const doorX = -1.0, DW = 1.36, DH = 2.23;                 // arched front doorway
  const innerDoor = { x: 0.65, w: 1.3, h: 2.15 };           // open doorway living → bedroom
  const frontW = wall(0, FRONT, 0, W, T, [{ u: doorX, w: DW, h: DH, door: true, arch: true }, { u: 1.85, y0: 1.25, w: 1.05, h: 1.0 }, { u: -2.75, y0: 1.35, w: 0.46, h: 0.8 }], plaster, innerPlaster);
  const backW = wall(0, -FRONT, Math.PI, W, T, [{ u: -0.3, y0: 1.25, w: 0.9, h: 1.0 }], plaster, innerPlaster);
  const leftW = wall(-W / 2, 0, -Math.PI / 2, D - 2 * T, T, [{ u: 0.7, y0: 1.32, w: 0.75, h: 0.85 }], plaster, innerPlaster);
  const rightW = wall(W / 2, 0, Math.PI / 2, D - 2 * T, T, [{ u: -3.25, y0: 1.35, w: 0.55, h: 0.8 }, { u: 3.25, y0: 1.35, w: 0.6, h: 0.8 }], plaster, innerPlaster);
  wall(0, 0, 0, 2 * IX, PT, [{ u: innerDoor.x, w: innerDoor.w, h: innerDoor.h, door: true }], innerPlaster, null);
  add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.05, D - 0.1), floorMat), 0, 0.025, 0);
  {
    // stone plinth: individual rounded stones, two courses (not across the doorway)
    const edges = [[-W / 2, FRONT, W / 2, FRONT], [-W / 2, -FRONT, W / 2, -FRONT], [-W / 2, -FRONT, -W / 2, FRONT], [W / 2, -FRONT, W / 2, FRONT]];
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az), along = Math.atan2(bz - az, bx - ax);
      for (let course = 0; course < 2; course++) {
        let d = course * 0.18;
        while (d < len) {
          const sw = jr(0.3, 0.52); const t = Math.min(len, d + sw / 2) / len;
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          d += sw;
          if (az === FRONT && bz === FRONT && Math.abs(x - doorX) < DW / 2 + 0.3) continue;
          const nx = Math.abs(bz - az) > 0 ? Math.sign(ax) * 0.06 : 0, nz = Math.abs(bx - ax) > 0 ? Math.sign(az) * 0.06 : 0;
          add(rbox(sw - 0.03, jr(0.17, 0.22), 0.2, 0.07, course ? stone : stoneDark, 1), x + nx, 0.1 + course * 0.2, z + nz, 0, -along, jr(-0.05, 0.05));
        }
      }
    }
    // stone quoins up the two front corners (alternating long/short, like the concept)
    for (const sx of [-1, 1]) for (let j = 0; j < 7; j++) {
      const long = j % 2 === 0;
      add(rbox(long ? 0.5 : 0.32, 0.34, 0.16, 0.07, stone, 1), sx * (W / 2 - (long ? 0.2 : 0.11)), 0.55 + j * 0.37, FRONT + 0.05, 0, 0, jr(-0.03, 0.03));
    }
  }
  for (const [x, z, w, d] of [[0, FRONT - T / 2, W, T], [0, -FRONT + T / 2, W, T], [-W / 2 + T / 2, 0, T, D - 2 * T], [W / 2 - T / 2, 0, T, D - 2 * T], [0, -PT / 2, 2 * IX, PT]]) add(rbox(w + 0.04, 0.1, d + 0.04, 0.03, timber, 1), x, H + 0.02, z);
  // ---------------- gables (above the rooms → roof group), with the attic window in the front one
  for (const sz of [1, -1]) {
    const s = new THREE.Shape(); s.moveTo(-W / 2, H); s.lineTo(W / 2, H); s.lineTo(0, H + RISE); s.lineTo(-W / 2, H);
    if (sz > 0) { const p = new THREE.Path(); p.moveTo(-0.33, H + 0.58); p.lineTo(0.33, H + 0.58); p.lineTo(0.33, H + 1.26); p.lineTo(-0.33, H + 1.26); p.lineTo(-0.33, H + 0.58); s.holes.push(p); }
    const g = new THREE.ExtrudeGeometry(s, { depth: T - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, steps: 1 });
    g.translate(0, 0, -T + 0.05);
    addR(new THREE.Mesh(g, plaster), 0, 0, sz * FRONT, 0, sz > 0 ? 0 : Math.PI, 0);
  }
  // ceiling over both rooms + a few joists (only seen through the windows; hidden with the roof)
  addR(new THREE.Mesh(new THREE.BoxGeometry(2 * IX, 0.06, 2 * IZ), timberLight), 0, H + 0.03, 0);
  for (const z of [-2.6, -1.0, 1.4, 2.8]) addR(rbox(2 * IX, 0.2, 0.2, 0.04, timber, 1), 0, H - 0.1, z);
  // ---------------- timber frame
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rbox(0.24, H, 0.24, 0.04, timber), sx * (W / 2 + 0.02), H / 2 + 0.1, sz * (FRONT + 0.03));
  add(rbox(W + 0.6, 0.26, 0.26, 0.05, timber), 0, H, FRONT + 0.06);               // front tie beam (pokes past the walls)
  add(rbox(W + 0.6, 0.26, 0.26, 0.05, timber), 0, H, -FRONT - 0.06);
  for (const sx of [-1, 1]) {                                                       // side wall plates
    add(rbox(0.24, 0.24, D + 0.5, 0.05, timber), sx * (W / 2 + 0.04), H - 0.05, 0);
    // gable braces framing the attic window
    addR(rbox(0.16, 1.5, 0.16, 0.04, timber), sx * 1.15, H + 0.75, FRONT + 0.08, 0, 0, sx * 0.55);
    // little corbels under the tie beam ends
    add(rbox(0.22, 0.3, 0.3, 0.05, timber), sx * (W / 2 + 0.22), H - 0.24, FRONT + 0.1);
  }
  // inside: exposed posts, a wall-plate rail and corner braces on every room wall (like both interior paintings)
  {
    const rail = H - 0.13, s = 0.17;
    const rooms = [[0, IZ], [-IZ, -PT]];
    for (const [z0, z1] of rooms) {
      for (const [x, z] of [[-IX, z0], [IX, z0], [-IX, z1], [IX, z1]]) add(rbox(s, H, s, 0.03, timber, 1), x - Math.sign(x) * 0.07, H / 2, z + (z === z0 ? 0.07 : -0.07));
      beam(V(-IX + 0.06, rail, z0 + 0.07), V(IX - 0.06, rail, z0 + 0.07), s, timber);
      beam(V(-IX + 0.06, rail, z1 - 0.07), V(IX - 0.06, rail, z1 - 0.07), s, timber);
      for (const sx of [-1, 1]) {
        beam(V(sx * (IX - 0.07), rail, z0 + 0.1), V(sx * (IX - 0.07), rail, z1 - 0.1), s, timber);
        // corner braces running along the side walls
        beam(V(sx * (IX - 0.07), rail - 0.75, z0 + 0.1), V(sx * (IX - 0.07), rail - 0.05, z0 + 0.8), 0.12, timber);
        beam(V(sx * (IX - 0.07), rail - 0.75, z1 - 0.1), V(sx * (IX - 0.07), rail - 0.05, z1 - 0.8), 0.12, timber);
      }
    }
    // mid posts with braces: bedroom back wall, living left wall
    for (const x of [-0.75, 1.05]) {
      add(rbox(s, H, s, 0.03, timber, 1), x, H / 2, -IZ + 0.07);
      for (const d of x > 0 ? [1] : [-1, 1]) beam(V(x + d * 0.06, rail - 0.7, -IZ + 0.07), V(x + d * 0.7, rail - 0.05, -IZ + 0.07), 0.12, timber);
    }
    add(rbox(s, H, s, 0.03, timber, 1), -IX + 0.07, H / 2, 2.0);
    for (const d of [-1, 1]) beam(V(-IX + 0.07, rail - 0.7, 2.0 + d * 0.06), V(-IX + 0.07, rail - 0.05, 2.0 + d * 0.7), 0.12, timber);
    // the inner doorway: chunky posts + lintel on both faces
    for (const zf of [0.04, -PT - 0.04]) {
      for (const sx of [-1, 1]) add(rbox(0.16, innerDoor.h + 0.1, 0.1, 0.03, timber, 1), innerDoor.x + sx * (innerDoor.w / 2 + 0.05), (innerDoor.h + 0.1) / 2, zf);
      add(rbox(innerDoor.w + 0.5, 0.2, 0.12, 0.03, timber, 1), innerDoor.x, innerDoor.h + 0.12, zf);
    }
  }

  // ---------------- roof: two slopes of individual rounded clay tiles (instanced), deck underneath
  const OVER_SIDE = 0.65, OVER_FRONT = 0.25;
  const slopeLen = Math.hypot(W / 2, RISE) + OVER_SIDE;
  const roofDepth = D + OVER_FRONT * 2;
  const ridgeY = H + RISE + 0.12;
  for (const sx of [-1, 1]) {                                                       // roof deck boards
    const deck = rbox(slopeLen, 0.12, roofDepth, 0.04, M(0x7a5236, null));
    const cx = sx * (Math.cos(theta) * slopeLen / 2), cy = ridgeY - Math.sin(theta) * slopeLen / 2 - 0.08;
    addR(deck, cx, cy, 0, 0, 0, sx * -theta);
    // bargeboards on the front & back gable edges
    for (const sz of [-1, 1]) {
      const bb = rbox(slopeLen + 0.1, 0.32, 0.12, 0.04, timber);
      addR(bb, cx, cy - 0.12, sz * (roofDepth / 2 + 0.02), 0, 0, sx * -theta);
    }
    // purlin ends poking out of both gables just under the roof deck, each on a little carved bracket
    for (const t of [0.3, 0.62, 0.92]) {
      const px = sx * (W / 2) * t, py = H + RISE * (1 - t) - 0.2;
      for (const sz of [-1, 1]) {
        addR(rbox(0.2, 0.2, 0.36, 0.05, timber), px, py, sz * (FRONT + 0.12));
        addR(rbox(0.14, 0.3, 0.14, 0.04, timber), px, py - 0.22, sz * (FRONT + 0.08), sz * 0.6, 0, 0);
      }
    }
  }
  {
    const tileLen = 0.46, stepDown = 0.33, tileW = 0.31;
    const rows = Math.floor(slopeLen / stepDown), cols = Math.floor(roofDepth / tileW);
    const geoL = new THREE.CylinderGeometry(0.155, 0.17, tileLen, 7, 1, true, 0, Math.PI);
    const geoR = new THREE.CylinderGeometry(0.155, 0.17, tileLen, 7, 1, true, Math.PI, Math.PI);
    const pal = [0xffffff, 0xfff1e2, 0xffe4cc, 0xf6d2b4, 0xffd9b0, 0xe9c2a2, 0xfff8ee].map((h) => new THREE.Color(h));
    const o = new THREE.Object3D();
    for (const sx of [-1, 1]) {
      const inst = new THREE.InstancedMesh(sx < 0 ? geoL : geoR, tileMat, rows * cols);
      let k = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const sdist = 0.2 + r * stepDown + jr(-0.02, 0.02);
        const z = -roofDepth / 2 + tileW * 0.5 + c * tileW + jr(-0.015, 0.015);
        const sag = Math.sin((z / roofDepth + 0.5) * Math.PI) * 0.05 + jr(-0.015, 0.02);    // gently sagging hand-laid roof
        const x = sx * Math.cos(theta) * sdist, y = ridgeY + 0.06 - Math.sin(theta) * sdist - sag * 0.4;
        o.position.set(x, y, z);
        o.rotation.set(0, 0, sx < 0 ? Math.PI / 2 + theta : -(Math.PI / 2 + theta));
        o.rotateY(jr(-0.04, 0.04)); o.rotateZ(jr(-0.03, 0.03));
        o.scale.set(1, jr(0.95, 1.05), 1);
        o.updateMatrix(); inst.setMatrixAt(k, o.matrix);
        inst.setColorAt(k, pal[Math.floor(rr() * pal.length)].clone().offsetHSL(0, jr(-0.05, 0.05), jr(-0.05, 0.04)));
        k++;
      }
      inst.castShadow = true; inst.receiveShadow = true; roofG.add(inst);
    }
    // ridge cap
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, roofDepth + 0.1, 10), M(0xffcfa8, tex('terracotta', 1, 3)));
    addR(ridge, 0, ridgeY + 0.08, 0, Math.PI / 2);
  }
  // ---------------- chimney (stone stack, cap, little clay pot) — straight above the living-room fireplace
  const FZ = 1.5;                                                                   // fireplace centre on the right wall
  {
    const cx = 2.0, cz = FZ;
    addR(rbox(0.95, 3.1, 0.95, 0.08, M(0xd9ccb1, tex('stone', 0.9, 2.6))), cx, 5.05, cz);
    addR(rbox(1.15, 0.22, 1.15, 0.06, stoneDark), cx, 6.6, cz);
    addR(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 12), terracotta), cx, 6.9, cz);
  }

  // ---------------- arched front doorway in a stone surround; the plank door stands open, folded back against the inner wall
  {
    const r = DW / 2, dh = DH - r;
    const s = new THREE.Shape();
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, dh); s.absarc(0, dh, r, 0, Math.PI, false); s.lineTo(-r, 0);
    const leaf = new THREE.Group();
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 }), doorWood), 0, 0, 0, 0, 0, 0, leaf);
    // plank grooves, iron straps, ring
    for (let k = -2; k <= 2; k++) add(rbox(0.025, dh + r * 0.9, 0.02, 0.008, M(0x6e4223, null)), k * 0.24, (dh + r * 0.9) / 2, 0.09, 0, 0, 0, leaf);
    for (const y of [0.5, 1.45]) add(rbox(DW * 0.96, 0.07, 0.03, 0.015, iron), 0, y, 0.1, 0, 0, 0, leaf);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 18), iron), -0.4, 1.0, 0.12, 0, 0, 0, leaf);
    leaf.position.set(doorX + r + r + 0.02, 0.05, IZ - 0.02); leaf.rotation.y = Math.PI; root.add(leaf);
    // voussoirs around the arch + jamb stones
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI;
      const rad = r + 0.2;
      add(rbox(0.26, 0.24, 0.26, 0.07, stone, 1), doorX + Math.cos(a) * rad, dh + Math.sin(a) * rad, FRONT + 0.06, 0, 0, a - Math.PI / 2);
    }
    for (const sxx of [-1, 1]) for (let j = 0; j < 4; j++) {
      const wide = j % 2 === 0;
      add(rbox(wide ? 0.34 : 0.24, 0.36, 0.26, 0.07, stone, 1), doorX + sxx * (r + (wide ? 0.22 : 0.18)), 0.2 + j * 0.39, FRONT + 0.06);
    }
    // threshold + one low step flush with the floor
    add(rbox(DW + 0.1, 0.06, T + 0.1, 0.02, stone), doorX, 0.03, FRONT - T / 2);
    add(rbox(1.8, 0.07, 0.42, 0.03, stone), doorX, 0.035, FRONT + 0.22);
  }
  // ---------------- iron wall lantern with warm glass
  {
    const lx = doorX + 1.0, ly = 2.35;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14, Math.PI / 2), iron), lx - 0.02, ly + 0.08, FRONT + 0.16, 0, Math.PI / 2, 0);
    add(rbox(0.22, 0.3, 0.22, 0.03, glow), lx + 0.02, ly - 0.08, FRONT + 0.32);
    add(rbox(0.28, 0.05, 0.28, 0.02, iron), lx + 0.02, ly + 0.09, FRONT + 0.32);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 4), iron), lx + 0.02, ly + 0.19, FRONT + 0.32, 0, Math.PI / 4, 0);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffb45a, 1.2, 4, 2); pl.position.set(lx + 0.02, ly - 0.1, FRONT + 0.45); root.add(pl); }
  }
  // ---------------- windows with shutters: real openings, glass outside, warm daylight pane seen from inside, inner sill
  function windowUnit(x, y, w, h, nShut, z = FRONT + 0.02, P = root, th = T) {
    const fr = 0.08;
    const a = (m, px, py, pz) => add(m, px, py, pz, 0, 0, 0, P);
    const zg = z - 0.02 - th / 2;
    a(new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass), x, y, zg + 0.012);
    a(new THREE.Mesh(flip(new THREE.PlaneGeometry(w, h)), view), x, y, zg - 0.012);
    a(rbox(0.04, h, 0.04, 0.012, timberLight, 1), x, y, zg - 0.04);                           // inner glazing bars
    a(rbox(w, 0.04, 0.04, 0.012, timberLight, 1), x, y + h * 0.12, zg - 0.04);
    a(rbox(w + 0.22, 0.06, 0.22, 0.02, timberLight, 1), x, y - h / 2 - 0.03, z - 0.02 - th - 0.07); // inner sill
    a(rbox(w + fr * 2, fr, 0.14, 0.03, timberLight), x, y + h / 2 + fr / 2, z + 0.03);
    a(rbox(w + fr * 2.6, fr * 1.4, 0.24, 0.03, timberLight), x, y - h / 2 - fr * 0.6, z + 0.08); // sill
    for (const sxx of [-1, 1]) a(rbox(fr, h, 0.14, 0.03, timberLight), x + sxx * (w / 2 + fr / 2), y, z + 0.03);
    a(rbox(0.045, h, 0.08, 0.015, timberLight), x, y, z + 0.05);                                // mullion
    a(rbox(w, 0.045, 0.08, 0.015, timberLight), x, y + h * 0.12, z + 0.05);                     // transom
    const shutters = nShut === 2 ? [-1, 1] : nShut === -1 ? [-1] : nShut === 1 ? [1] : [];
    for (const sxx of shutters) {
      const sw = w * 0.56;
      const sh = new THREE.Group();
      for (let k = 0; k < 3; k++) add(rbox(sw / 3 - 0.012, h + 0.06, 0.05, 0.012, shutterMat), (k - 1) * (sw / 3), 0, 0, 0, 0, 0, sh);
      add(rbox(sw * 0.9, 0.07, 0.03, 0.01, M(0x5f7285, null)), 0, h * 0.28, 0.035, 0, 0, 0, sh);
      add(rbox(sw * 0.9, 0.07, 0.03, 0.01, M(0x5f7285, null)), 0, -h * 0.28, 0.035, 0, 0, 0, sh);
      sh.position.set(x + sxx * (w / 2 + fr + sw / 2 + 0.02), y, z + 0.06);
      sh.rotation.y = -sxx * 0.18;
      P.add(sh);
    }
  }
  // windows are built in their wall's local frame (outer face at z = 0)
  windowUnit(1.85, 1.75, 1.05, 1.0, 2, 0.02, frontW);                 // big front window (living room)
  windowUnit(-2.75, 1.75, 0.46, 0.8, -1, 0.02, frontW);               // small window, one shutter
  windowUnit(-0.3, 1.75, 0.9, 1.0, 2, 0.02, backW);                   // bedroom window
  windowUnit(0.7, 1.745, 0.75, 0.85, 2, 0.02, leftW);                 // kitchen window over the sink
  windowUnit(-3.25, 1.75, 0.55, 0.8, 2, 0.02, rightW);                // living room, by the armchair
  windowUnit(3.25, 1.75, 0.6, 0.8, 2, 0.02, rightW);                   // bedroom side window
  {                                                                    // attic window in the gable (roof group)
    const g = new THREE.Group(); g.position.set(0, 0, FRONT); roofG.add(g);
    windowUnit(0, H + 0.92, 0.66, 0.68, 2, 0.0, g);
  }
  // ---------------- flower box under the big window
  {
    const bx = 1.85, by = 1.08;
    add(rbox(1.35, 0.28, 0.32, 0.04, timberLight), bx, by, FRONT + 0.2);
    for (let k = 0; k < 34; k++) blossoms.push([bx + jr(-0.6, 0.6), by + 0.18 + jr(0, 0.22), FRONT + 0.22 + jr(-0.1, 0.12), [0xe8443a, 0xf06a8a, 0xffd23f, 0xf4a2c0, 0xff7a3d][k % 5]]);
    for (let k = 0; k < 40; k++) leaves.push([bx + jr(-0.65, 0.65), 1.2 + jr(0, 0.18), FRONT + 0.3 + jr(-0.05, 0.12), 0, true]);
  }
  // ---------------- pot with plant by the door
  if (garden) {
    const pg = new THREE.LatheGeometry([[0, 0], [0.22, 0], [0.3, 0.38], [0.34, 0.5], [0.3, 0.52], [0, 0.52]].map(([a, b]) => new THREE.Vector2(a, b)), 18);
    add(new THREE.Mesh(pg, terracotta), doorX + 1.3, 0.0, FRONT + 0.75);
    for (let k = 0; k < 18; k++) leaves.push([doorX + 1.3 + jr(-0.3, 0.3), 0.55 + jr(0, 0.5), FRONT + 0.75 + jr(-0.3, 0.3), 0x5c9a46, true]);
  }
  // ---------------- ivy up the wall beside the door, hydrangeas & foxgloves
  {
    const vines = [[-2.05, 0.3, 2.9], [-2.3, 0.3, 2.6], [-2.15, 0.3, 2.4], [-3.3, 0.3, 2.2]];
    for (const [vx, vy, top] of vines) {
      let x = vx, y = vy;
      while (y < top) {
        x += jr(-0.1, 0.1); y += jr(0.05, 0.12);
        for (let k = 0; k < 3; k++) leaves.push([x + jr(-0.14, 0.14), y + jr(-0.08, 0.08), FRONT + 0.04 + jr(0, 0.05), 0, true]);
      }
      // a few tendrils along the tie beam
      for (let k = 0; k < 10; k++) leaves.push([x + jr(-0.6, 0.9), top + jr(-0.05, 0.12), FRONT + 0.18 + jr(0, 0.05), 0, true]);
    }
    const bushes = garden ? [[-W / 2 - 0.5, FRONT + 0.4], [-W / 2 - 1.0, FRONT - 0.3], [-W / 2 - 0.7, FRONT + 1.1]] : [];
    for (const [bx, bz] of bushes) {
      for (let k = 0; k < 40; k++) leaves.push([bx + jr(-0.55, 0.55), jr(0.1, 0.9), bz + jr(-0.45, 0.45), 0, true]);
      for (let k = 0; k < 7; k++) { const cx2 = bx + jr(-0.45, 0.45), cy2 = jr(0.6, 1.05), cz2 = bz + jr(-0.3, 0.45); for (let q = 0; q < 9; q++) blossoms.push([cx2 + jr(-0.12, 0.12), cy2 + jr(-0.1, 0.1), cz2 + jr(-0.12, 0.12), [0xf4f1e6, 0xe9e4d4, 0xdfe7f5][k % 3]]); }
    }
    if (garden) for (let k = 0; k < 4; k++) { const fx = W / 2 + 1.3 + jr(-0.3, 0.5), fz = FRONT + 0.2 + jr(-0.4, 0.6); for (let q = 0; q < 12; q++) blossoms.push([fx + jr(-0.05, 0.05), 0.4 + q * 0.09, fz + jr(-0.05, 0.05), [0xf08fb8, 0xe36ea0][q % 2]]); for (let q = 0; q < 8; q++) leaves.push([fx + jr(-0.2, 0.2), jr(0.05, 0.4), fz + jr(-0.2, 0.2), 0, true]); }
  }
  // ---------------- lean-to woodshed on the right (behind the fireplace wall) with stacked logs + a barrel
  {
    const x0 = W / 2 + 0.1, x1 = W / 2 + 1.7, zf = 2.3, zb = -0.7;
    for (const z of [zf, zb]) add(rbox(0.16, 2.1, 0.16, 0.03, timber), x1, 1.05, z);
    const lean = Math.atan2(0.55, x1 - x0 + 0.4);
    const roofL = rbox(x1 - x0 + 0.8, 0.12, zf - zb + 0.7, 0.04, new THREE.MeshStandardMaterial({ color: 0xffe6cc, map: tex('roof_tiles', 1, 1), roughness: 0.9 }));
    add(roofL, (x0 + x1) / 2 + 0.2, 2.35, (zf + zb) / 2, 0, 0, -lean);
    add(rbox(x1 - x0 + 0.4, 0.14, 0.14, 0.03, timber), (x0 + x1) / 2 + 0.1, 2.1, zf);
    const logGeo = new THREE.CylinderGeometry(0.13, 0.14, 1.3, 9);
    const logs = new THREE.InstancedMesh(logGeo, [logMat, logEnd, logEnd], 60);
    const o = new THREE.Object3D(); let k = 0;
    for (let row = 0; row < 7; row++) for (let c = 0; c < 6 && k < 60; c++) {
      const x = x0 + 0.22 + c * 0.27 + (row % 2) * 0.13; if (x > x1 - 0.12) continue;
      o.position.set(x, 0.15 + row * 0.24, zf - 0.6 + jr(-0.06, 0.06)); o.rotation.set(Math.PI / 2, 0, 0); o.rotateY(jr(0, 6)); o.scale.set(jr(0.88, 1.12), 1, jr(0.88, 1.12)); o.updateMatrix();
      logs.setMatrixAt(k++, o.matrix);
    }
    logs.count = k; logs.castShadow = true; logs.receiveShadow = true; root.add(logs);
    box((x0 + x1) / 2, zf - 0.6, x1 - x0 + 0.1, 1.4);
    for (const z of [zf, zb]) box(x1, z, 0.25, 0.25);
    if (garden) {
      const bg = new THREE.LatheGeometry([[0, 0], [0.33, 0], [0.38, 0.2], [0.41, 0.42], [0.38, 0.66], [0.33, 0.82], [0, 0.82]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
      add(new THREE.Mesh(bg, M(0xa2693b, tex('wood_planks_dark', 1.5, 0.6))), x1 - 0.1, 0, zf + 0.75);
      for (const y of [0.18, 0.64]) add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 24), iron), x1 - 0.1, y, zf + 0.75, Math.PI / 2);
    }
  }
  // ---------------- stepping-stone path to the door
  if (garden) {
    const pav = M(0xd2cfc6, tex('stone', 0.5, 0.5));
    for (let k = 0; k < 6; k++) {
      const z = FRONT + 0.95 + k * 0.62, x = doorX + Math.sin(k * 0.9) * 0.25;
      add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.28, 0.36), jr(0.3, 0.38), 0.08, 9), pav), x + jr(-0.12, 0.12), 0.03, z, 0, jr(0, 3), 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.2, 0.26), jr(0.22, 0.28), 0.07, 8), pav), x + 0.48 + jr(-0.08, 0.08), 0.03, z + 0.15, 0, jr(0, 3), 0);
    }
  }

  // =====================================================================================================
  // INTERIOR — kitchen-living room (front, z 0 … IZ) and bedroom (back, z -IZ … -PT), floor at y 0.05
  // =====================================================================================================
  const F = 0.05;
  const CREAM = 0xfaf2e2, BLUE = 0x9fb8d6, ROSE = 0xe9a3a0, SAGE = 0xb5c99a, OCHRE = 0xf0c26a, RUST = 0xd98257, BROWN = 0x9a6a46;
  const sage = M(0xd8e6c4, tex('painted_metal', 0.5, 0.5));
  const legGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.46, 6), postGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.6, 6), spGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5);
  // spindle-back chair facing +z in its own frame
  function chair(x, z, ry, mat) {
    const g = new THREE.Group(); g.position.set(x, F, z); g.rotation.y = ry; root.add(g);
    const a = (m, px, py, pz, rx = 0, ryy = 0, rz = 0) => add(m, px, py, pz, rx, ryy, rz, g);
    a(rbox(0.46, 0.05, 0.43, 0.02, mat, 1), 0, 0.45, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a(new THREE.Mesh(legGeo, mat), sx * 0.18, 0.22, sz * 0.17, sz * 0.05, 0, -sx * 0.05);
    for (const sz of [-1, 1]) a(rbox(0.36, 0.03, 0.03, 0.01, mat, 1), 0, 0.16, sz * 0.17);
    for (const sx of [-1, 1]) a(new THREE.Mesh(postGeo, mat), sx * 0.19, 0.76, -0.2, -0.08, 0, 0);
    a(rbox(0.46, 0.1, 0.045, 0.02, mat, 1), 0, 1.04, -0.23, -0.08, 0, 0);
    for (let k = -1; k <= 1; k++) a(new THREE.Mesh(spGeo, mat), k * 0.09, 0.76, -0.21, -0.08, 0, 0);
  }
  const lathe = (pts, seg = 8) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  const turnedLeg = lathe([[0, 0], [0.045, 0], [0.05, 0.08], [0.032, 0.16], [0.058, 0.32], [0.034, 0.52], [0.045, 0.66], [0.045, 0.74], [0, 0.74]]);
  // a little potted plant (terracotta pot + leaves), optional trailing ivy
  const pot = (x, y, z, r, trail = 0, flowers = null) => {
    cl('cyl', x, y + r * 0.9, z, r * 2, r * 1.8, r * 2, 0xe08a5e);
    cl('cyl', x, y + r * 1.85, z, r * 2.25, r * 0.3, r * 2.25, 0xe7976a);
    for (let k = 0; k < 14; k++) leaves.push([x + jr(-r * 1.6, r * 1.6), y + r * 2 + jr(0, r * 2.4), z + jr(-r * 1.6, r * 1.6), 0, true]);
    for (let k = 0; k < trail; k++) leaves.push([x + jr(-0.12, 0.12), y + r * 1.8 - k * 0.07, z + jr(-0.1, 0.1), 0, true]);
    if (flowers) for (let k = 0; k < 8; k++) blossoms.push([x + jr(-r * 1.3, r * 1.3), y + r * 3.2 + jr(0, r), z + jr(-r * 1.3, r * 1.3), pick(flowers)]);
  };
  const vase = (x, y, z, col, flowers) => {
    cl('sph', x, y + 0.1, z, 0.17, 0.2, 0.17, col);
    cl('cyl', x, y + 0.22, z, 0.09, 0.08, 0.09, col);
    for (let k = 0; k < 6; k++) leaves.push([x + jr(-0.15, 0.15), y + 0.3 + jr(0, 0.12), z + jr(-0.15, 0.15), 0, true]);
    for (let k = 0; k < 4; k++) { const cx = x + jr(-0.12, 0.12), cy = y + 0.38 + jr(0, 0.1), cz = z + jr(-0.12, 0.12), c = pick(flowers); for (let q = 0; q < 6; q++) blossoms.push([cx + jr(-0.06, 0.06), cy + jr(-0.05, 0.05), cz + jr(-0.06, 0.06), c]); }
  };
  const lantern = (x, y, z) => {
    add(rbox(0.16, 0.22, 0.16, 0.03, glow, 1), x, y + 0.13, z);
    add(rbox(0.2, 0.04, 0.2, 0.015, iron, 1), x, y + 0.02, z);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 4), iron), x, y + 0.3, z, 0, Math.PI / 4, 0);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 4, 8), iron), x, y + 0.39, z);
  };
  const books = (x, y, z, n, along = 'x', ry = 0) => {
    let o = 0;
    for (let k = 0; k < n; k++) {
      const t = jr(0.04, 0.07), h = jr(0.17, 0.25), c = pick([0x8a3b2e, 0x3f5f7a, 0x4f6b3f, 0xb07a3a, 0x6b4a6e, 0x9a4f3c, 0x2f4a5c]);
      const dx = along === 'x' ? o : 0, dz = along === 'z' ? o : 0;
      cl('box', x + dx, y + h / 2, z + dz, along === 'x' ? t : 0.16, h, along === 'x' ? 0.16 : t, c, ry, 0, jr(-0.04, 0.04));
      o += t + 0.004;
    }
  };
  const picture = (x, y, z, ry, w, h) => {
    const p = at(x, z, ry);
    const fr = rbox(w, h, 0.04, 0.015, timber, 1); add(fr, x, y, z, 0, ry, 0);
    const [ax, az] = p(0, 0.022), [bx, bz] = p(0, 0.026);
    cl('box', ax, y + h * 0.12, az, w - 0.08, h * 0.55, 0.01, 0xbcd7e6, ry);
    cl('box', bx, y - h * 0.18, bz, w - 0.08, h * 0.4, 0.01, 0x9cbf6e, ry);
  };

  // ---------------- living room: fireplace on the right wall
  {
    const fx0 = IX - 0.7;                                                           // breast front face
    add(rbox(0.7, 1.12, 0.4, 0.05, stone, 1), IX - 0.35, 0.56, FZ - 0.66);          // cheeks
    add(rbox(0.7, 1.12, 0.4, 0.05, stone, 1), IX - 0.35, 0.56, FZ + 0.66);
    add(rbox(0.72, 0.42, 1.74, 0.06, stone, 1), IX - 0.36, 1.32, FZ);               // lintel block
    add(rbox(0.5, H - 1.5, 1.2, 0.06, M(0xd9ccb1, tex('stone', 0.9, 2.6)), 1), IX - 0.25, 1.5 + (H - 1.5) / 2, FZ);   // stack to the ceiling
    add(rbox(0.12, 1.1, 0.96, 0.03, iron, 1), IX - 0.06, 0.6, FZ);                   // sooty firebox back
    add(rbox(1.0, 0.14, 1.95, 0.05, stoneDark, 1), IX - 0.5, F + 0.05, FZ);         // hearth
    // rounded arch stones around the firebox mouth + rough stones on the breast
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      add(rbox(0.16, 0.2, 0.24, 0.06, stone, 1), fx0 - 0.04, 0.62 + Math.sin(a) * 0.5, FZ + Math.cos(a) * 0.5, a - Math.PI / 2, 0, 0);
    }
    for (const sz of [-1, 1]) for (let j = 0; j < 3; j++) add(rbox(0.12, 0.2, jr(0.28, 0.36), 0.05, j % 2 ? stoneDark : stone, 1), fx0 - 0.03, 0.22 + j * 0.2, FZ + sz * 0.62);
    for (let k = 0; k < 9; k++) add(rbox(0.08, jr(0.16, 0.22), jr(0.24, 0.34), 0.05, rr() < 0.5 ? stone : stoneDark, 1), IX - 0.52, jr(1.8, 2.9), FZ + jr(-0.48, 0.48));
    // mantel beam + clutter
    add(rbox(0.34, 0.16, 2.0, 0.04, timber, 1), fx0 - 0.08, 1.6, FZ);
    books(fx0, 1.68, FZ - 0.75, 3, 'z');
    cl('box', fx0 - 0.02, 1.71, FZ - 0.35, 0.18, 0.06, 0.26, 0x4f6b3f, 0.2);
    lantern(fx0 - 0.02, 1.68, FZ + 0.15);
    vase(fx0 - 0.04, 1.68, FZ + 0.65, 0xd98a5a, [0xfdfbf2, 0xf2efe2, 0xffffff]);
    for (let k = 0; k < 26; k++) leaves.push([fx0 - 0.2 + jr(-0.05, 0.05), 1.65 - k * 0.04 + jr(-0.05, 0.05), FZ + 0.85 + jr(-0.12, 0.12), 0, true]);
    // logs, flames, a hanging cauldron
    for (const [dz, ry] of [[-0.12, 0.3], [0.12, -0.3], [0, 0]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 7), logMat), IX - 0.32, F + 0.2 + (dz === 0 ? 0.1 : 0), FZ + dz, Math.PI / 2, ry, 0);
    for (const [dz, s] of [[0, 1], [-0.15, 0.7], [0.16, 0.75]]) add(new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.42 * s, 7), fireMat), IX - 0.3, F + 0.36 + 0.2 * s, FZ + dz, 0, jr(0, 3), jr(-0.1, 0.1));
    add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), iron), IX - 0.32, 0.86, FZ);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 5, 14), iron), IX - 0.32, 0.88, FZ, Math.PI / 2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), iron), IX - 0.32, 1.02, FZ);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xff9a48, 1.6, 6, 2); pl.position.set(IX - 0.9, 0.7, FZ); root.add(pl); }
    box(IX - 0.48, FZ, 0.96, 1.95);
    // braided round rug in front of the fire
    const rugR = [0.95, 0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.25, 0.14], rugC = [RUST, CREAM, SAGE, OCHRE, BLUE, CREAM, RUST, SAGE, OCHRE];
    rugR.forEach((r, i) => cl('disc', 1.25, F + 0.006 + i * 0.002, FZ + 0.15, r * 2, 0.012, r * 2, rugC[i]));
  }
  // ---------------- living room: dresser against the partition, left of the doorway
  {
    const x = -1.3, z0 = 0.0, w = 1.5;
    add(rbox(w, 0.85, 0.55, 0.04, doorWood, 1), x, F + 0.425, z0 + 0.28);
    add(rbox(w + 0.1, 0.06, 0.62, 0.02, timberLight, 1), x, F + 0.88, z0 + 0.31);
    for (const sx of [-1, 1]) for (const y of [0.68, 0.36]) {
      add(rbox(w / 2 - 0.1, 0.25, 0.04, 0.02, timberLight, 1), x + sx * w / 4, F + y, z0 + 0.57);
      cl('sph', x + sx * w / 4, F + y, z0 + 0.6, 0.05, 0.05, 0.04, 0x6e4223);
    }
    add(rbox(w, 1.3, 0.05, 0.02, doorWood, 1), x, F + 1.55, z0 + 0.04);
    for (const sx of [-1, 1]) add(rbox(0.06, 1.3, 0.32, 0.02, doorWood, 1), x + sx * (w / 2 - 0.03), F + 1.55, z0 + 0.17);
    for (const y of [1.25, 1.62, 1.98]) add(rbox(w - 0.1, 0.04, 0.3, 0.01, timberLight, 1), x, F + y, z0 + 0.17);
    add(rbox(w + 0.14, 0.1, 0.38, 0.03, timber, 1), x, F + 2.24, z0 + 0.19);
    for (let k = 0; k < 5; k++) cl('disc', x - 0.56 + k * 0.28, F + 2.13, z0 + 0.1, 0.25, 0.018, 0.25, k % 2 ? 0xf3ede0 : 0xe8eef4, 0, Math.PI / 2 - 0.15);
    for (let k = 0; k < 4; k++) { cl('sph', x - 0.5 + k * 0.33, F + 1.69, z0 + 0.17, 0.2, 0.09, 0.2, 0xf5efe2); cl('sph', x - 0.5 + k * 0.33, F + 1.76, z0 + 0.17, 0.17, 0.08, 0.17, k % 2 ? 0xdfe8f2 : 0xf5efe2); }
    for (let k = 0; k < 5; k++) cl('cyl', x - 0.58 + k * 0.24, F + 1.37, z0 + 0.17, 0.13, jr(0.16, 0.24), 0.13, pick([0xf2e6c8, 0xe9b65a, 0xd9734a, 0xf5efe2]));
    cl('sph', x + 0.58, F + 1.38, z0 + 0.2, 0.16, 0.22, 0.16, 0xf5efe2);
    pot(x - 0.45, F + 2.29, z0 + 0.2, 0.09, 10); pot(x + 0.35, F + 2.29, z0 + 0.2, 0.09, 6);
    box(x, z0 + 0.3, w + 0.1, 0.62);
  }
  // ---------------- living room: kitchen counter with a farmhouse sink under the left-wall window
  {
    const x = -IX + 0.31, z = 0.7, len = 1.4;
    add(rbox(0.6, 0.86, len, 0.04, shutterMat, 1), x, F + 0.43, z);
    add(rbox(0.68, 0.07, len + 0.05, 0.02, timberLight, 1), x + 0.03, F + 0.9, z);
    for (const dz of [-0.45, 0.45]) { add(rbox(0.03, 0.55, 0.4, 0.015, M(0x5f7285, null), 1), x + 0.31, F + 0.42, z + dz); cl('sph', x + 0.34, F + 0.52, z + dz + (dz < 0 ? 0.14 : -0.14), 0.04, 0.04, 0.04, 0x6e4223); }
    add(rbox(0.56, 0.34, 0.62, 0.05, stone, 1), x + 0.06, F + 0.8, z);                            // sink
    add(rbox(0.44, 0.04, 0.5, 0.02, glass, 1), x + 0.06, F + 0.96, z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), iron), x - 0.22, F + 1.1, z);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 5, 10, Math.PI), iron), x - 0.12, F + 1.25, z, 0, 0, 0);
    cl('box', x + 0.33, F + 0.72, z + 0.18, 0.03, 0.4, 0.22, 0xf6f1e6);                              // tea towel
    cl('box', x + 0.335, F + 0.7, z + 0.18, 0.03, 0.05, 0.22, 0x7f9cc4);
    cl('cyl', x, F + 1.04, z - 0.55, 0.14, 0.2, 0.14, 0xf2eadb);                                     // utensil crock
    for (let k = 0; k < 4; k++) cl('cyl', x + jr(-0.03, 0.03), F + 1.2, z - 0.55 + jr(-0.03, 0.03), 0.02, 0.3, 0.02, 0xb07a44, 0, jr(-0.2, 0.2), jr(-0.2, 0.2));
    cl('cyl', x + 0.05, F + 0.98, z + 0.55, 0.3, 0.1, 0.3, 0xc8955a);                                // basket of lemons
    for (let k = 0; k < 5; k++) cl('sph', x + 0.05 + jr(-0.08, 0.08), F + 1.06, z + 0.55 + jr(-0.08, 0.08), 0.09, 0.08, 0.09, 0xf2c94c);
    pot(x - 0.12, F + 0.94, z + 0.25, 0.07, 0, [0xe8443a, 0xff7a3d]);
    // hooks with a cutting board and a lavender bundle on the wall beside the window
    add(rbox(0.04, 0.05, 0.5, 0.01, timber, 1), -IX + 0.02, 2.05, 1.6);
    add(rbox(0.03, 0.42, 0.22, 0.03, timberLight, 1), -IX + 0.04, 1.78, 1.72);
    for (let k = 0; k < 14; k++) blossoms.push([-IX + 0.07 + jr(-0.03, 0.03), 1.62 + jr(0, 0.28), 1.45 + jr(-0.05, 0.05), pick([0x8e6cc8, 0x9b7fd4, 0x7a5cb8])]);
    for (let k = 0; k < 5; k++) leaves.push([-IX + 0.07, 1.92 + jr(0, 0.1), 1.45 + jr(-0.04, 0.04), 0x6f9a5a, true]);
    box(x + 0.02, z, 0.66, len + 0.05);
  }
  // ---------------- living room: farmhouse table + four odd chairs, painting above
  {
    const tx = -2.3, tz = 2.55;
    add(rbox(0.86, 0.07, 1.36, 0.03, timberLight), tx, F + 0.76, tz);
    for (let k = -1; k <= 1; k++) add(rbox(0.012, 0.072, 1.34, 0.004, timber, 1), tx + k * 0.22, F + 0.765, tz);
    add(rbox(0.66, 0.12, 1.1, 0.02, timberLight, 1), tx, F + 0.66, tz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(turnedLeg, timberLight), tx + sx * 0.33, F, tz + sz * 0.56);
    chair(tx, tz - 0.88, 0, shutterMat);
    chair(tx, tz + 0.88, Math.PI, doorWood);
    chair(tx + 0.66, tz - 0.1, -Math.PI / 2, sage);
    chair(-IX + 0.32, tz + 0.15, Math.PI / 2, timberLight);
    cl('disc', tx + 0.05, F + 0.8, tz + 0.1, 0.42, 0.006, 0.42, 0xd8c39a);
    vase(tx + 0.05, F + 0.8, tz + 0.1, 0xf3eee4, [0xf4b6c6, 0xfbeaf0, 0xf7f3e6]);
    cl('sph', tx - 0.12, F + 0.83, tz - 0.32, 0.28, 0.1, 0.28, 0xd8a868);
    for (let k = 0; k < 3; k++) cl('sph', tx - 0.12 + jr(-0.06, 0.06), F + 0.9, tz - 0.32 + jr(-0.06, 0.06), 0.08, 0.11, 0.08, 0xc9c25a);
    picture(-IX + 0.02, 1.85, tz, Math.PI / 2, 0.55, 0.42);
    box(tx, tz, 0.86, 1.36);
  }
  // ---------------- living room loose decor (garden version only: these read as hideable props in-game)
  if (garden) {
    // armchair with knitted throw & blue cushion, facing the fire
    const ax = 1.95, az = 3.25, ary = -2.55, p = at(ax, az, ary), put = (k, lx, y, lz, sx, sy, sz, c, rx = 0, rz = 0) => { const [x, z] = p(lx, lz); cl(k, x, y, z, sx, sy, sz, c, ary, rx, rz); };
    put('soft', 0, F + 0.27, 0.02, 0.86, 0.4, 0.8, 0xf1e6cf);
    put('soft', 0, F + 0.72, -0.3, 0.86, 0.62, 0.22, 0xf1e6cf);
    for (const sx of [-1, 1]) put('soft', sx * 0.38, F + 0.55, 0.02, 0.2, 0.3, 0.8, 0xf1e6cf);
    put('soft', 0, F + 0.52, 0.04, 0.52, 0.12, 0.6, 0xf7efe0);
    put('soft', 0.08, F + 0.75, -0.14, 0.4, 0.32, 0.1, 0x9fb5cf, -0.2, 0.2);
    put('soft', -0.38, F + 0.66, 0.06, 0.26, 0.06, 0.86, 0xfbf6ea);
    put('soft', -0.47, F + 0.42, 0.06, 0.06, 0.5, 0.86, 0xfbf6ea);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [x, z] = p(sx * 0.36, sz * 0.32); add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.1, 6), timber), x, F + 0.05, z); }
    // round side stool with a mug and books
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 14), timberLight), 0.85, F + 0.5, 3.45);
    for (let k = 0; k < 3; k++) { const a = k * 2.1; add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), timberLight), 0.85 + Math.cos(a) * 0.15, F + 0.25, 3.45 + Math.sin(a) * 0.15, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); }
    cl('cyl', 0.92, F + 0.59, 3.42, 0.09, 0.1, 0.09, 0xf5efe2);
    books(0.75, F + 0.53, 3.48, 2, 'x', 1.4);
    // basket of firewood by the hearth, lavender pot on the hearth
    cl('cyl', IX - 0.45, F + 0.2, FZ + 1.28, 0.6, 0.4, 0.48, 0xc8955a);
    for (let k = 0; k < 6; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.55, 7), logMat), IX - 0.45 + jr(-0.08, 0.08), F + 0.42 + (k % 2) * 0.08, FZ + 1.18 + (k % 3) * 0.1, 0, 0, Math.PI / 2 + jr(-0.2, 0.2));
    pot(IX - 0.65, F + 0.12, FZ - 0.78, 0.09, 0, [0x8e6cc8, 0x9b7fd4]);
    // pot plant beside the dresser
    pot(-2.3, F, 0.4, 0.17, 4);
  }

  // ---------------- bedroom: bed against the left wall with a patchwork quilt
  {
    const bx = -IX + 1.0, bz = -2.35, L = 2.0, Wb = 1.46;
    for (const sz of [-1, 1]) add(rbox(L - 0.1, 0.18, 0.07, 0.03, doorWood, 1), bx, F + 0.33, bz + sz * (Wb / 2 - 0.02));
    add(rbox(0.09, 1.0, Wb, 0.03, doorWood, 1), -IX + 0.07, F + 0.55, bz);                       // headboard
    add(new THREE.Mesh(new THREE.CylinderGeometry(Wb / 2, Wb / 2, 0.09, 18, 1, false, 0, Math.PI).scale(0.4, 1, 1), doorWood), -IX + 0.07, F + 1.04, bz, 0, 0, Math.PI / 2);
    add(rbox(0.09, 0.66, Wb, 0.03, doorWood, 1), -IX + L - 0.03, F + 0.38, bz);                  // footboard
    for (const sz of [-1, 1]) for (const fx of [-IX + 0.07, -IX + L - 0.03]) {
      const hgt = fx < bx ? 1.15 : 0.82;
      add(rbox(0.12, hgt, 0.12, 0.03, timber, 1), fx, F + hgt / 2, bz + sz * Wb / 2);
      cl('sph', fx, F + hgt + 0.06, bz + sz * Wb / 2, 0.14, 0.14, 0.14, BROWN);
    }
    cl('soft', bx + 0.02, F + 0.5, bz, L - 0.16, 0.26, Wb - 0.16, CREAM);                         // mattress
    const qc = [BLUE, ROSE, OCHRE, SAGE, CREAM, RUST, 0x8fa9c4, 0xf2d6b0];
    const nx = 6, nz = 5, x0 = bx - 0.45, pw = (L - 0.62) / nx, pd = (Wb - 0.12) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) cl('box', x0 + (i + 0.5) * pw, F + 0.645, bz - Wb / 2 + 0.06 + (j + 0.5) * pd, pw + 0.004, 0.035, pd + 0.004, pick(qc));
    for (let i = 0; i < nx; i++) for (const sz of [-1, 1]) cl('box', x0 + (i + 0.5) * pw, F + 0.5, bz + sz * (Wb / 2 - 0.065), pw + 0.004, 0.3, 0.03, pick(qc));
    for (const sz of [-1, 1]) { cl('soft', -IX + 0.32, F + 0.76, bz + sz * 0.34, 0.26, 0.24, 0.58, CREAM, 0, 0, -0.35); cl('soft', -IX + 0.48, F + 0.73, bz + sz * 0.3, 0.16, 0.22, 0.48, BLUE, 0, 0, -0.3); }
    cl('soft', -IX + 0.6, F + 0.74, bz, 0.12, 0.26, 0.36, 0xf7ead8, 0, 0, -0.25);
    for (let k = 0; k < 5; k++) blossoms.push([-IX + 0.67, F + 0.7 + jr(-0.06, 0.06), bz + jr(-0.1, 0.1), pick([ROSE, 0xe8443a, 0x9cbf6e])]);
    cl('box', bx + 0.6, F + 0.69, bz, 0.36, 0.05, Wb - 0.08, 0xf4eadb);                   // folded throw at the foot
    box(bx, bz, L, Wb + 0.1);
    // nightstand with lantern and flowers
    const nxs = -IX + 0.3, nzs = bz + Wb / 2 + 0.36;
    add(rbox(0.48, 0.58, 0.46, 0.03, doorWood, 1), nxs, F + 0.29, nzs);
    add(rbox(0.52, 0.04, 0.5, 0.015, timberLight, 1), nxs, F + 0.6, nzs);
    add(rbox(0.04, 0.16, 0.36, 0.015, timberLight, 1), nxs + 0.25, F + 0.45, nzs);
    cl('disc', nxs, F + 0.625, nzs, 0.36, 0.005, 0.36, 0xfbf6ea);
    lantern(nxs - 0.05, F + 0.63, nzs + 0.1);
    vase(nxs + 0.08, F + 0.63, nzs - 0.12, 0xf3eee4, [0xfdf3c8, 0xfffbe8, 0xf6e27a]);
    box(nxs, nzs, 0.5, 0.48);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffc070, 0.9, 4.5, 2); pl.position.set(nxs + 0.3, F + 1.1, nzs + 0.2); root.add(pl); }
  }
  // ---------------- bedroom: wardrobe, washstand, desk, wall shelf, rug, pictures
  {
    // wardrobe on the back wall with a basket and trailing ivy on top
    const wx = -1.4, wz = -IZ + 0.32;
    add(rbox(1.1, 2.05, 0.6, 0.04, doorWood, 1), wx, F + 1.03, wz);
    add(rbox(1.2, 0.12, 0.66, 0.03, timber, 1), wx, F + 2.1, wz);
    add(rbox(1.14, 0.1, 0.64, 0.03, timber, 1), wx, F + 0.05, wz);
    for (const sx of [-1, 1]) {
      add(rbox(0.46, 1.25, 0.04, 0.03, timberLight, 1), wx + sx * 0.25, F + 1.25, wz + 0.31);
      cl('sph', wx + sx * 0.05, F + 1.2, wz + 0.34, 0.05, 0.05, 0.04, 0x6e4223);
    }
    add(rbox(1.0, 0.3, 0.04, 0.02, timberLight, 1), wx, F + 0.35, wz + 0.31);
    cl('cyl', wx - 0.2, F + 2.28, wz, 0.44, 0.24, 0.34, 0xc8955a);
    pot(wx + 0.3, F + 2.16, wz + 0.05, 0.09, 14);
    box(wx, wz, 1.14, 0.64);
    // washstand (painted blue-grey) with jug & basin, towels below
    const sx0 = 1.6, sz0 = -IZ + 0.25;
    add(rbox(0.9, 0.05, 0.46, 0.02, shutterMat, 1), sx0, F + 0.82, sz0);
    add(rbox(0.86, 0.15, 0.42, 0.02, shutterMat, 1), sx0, F + 0.72, sz0);
    add(rbox(0.86, 0.04, 0.42, 0.02, shutterMat, 1), sx0, F + 0.18, sz0);
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) add(rbox(0.05, 0.82, 0.05, 0.015, shutterMat, 1), sx0 + ex * 0.4, F + 0.41, sz0 + ez * 0.18);
    add(rbox(0.9, 0.3, 0.04, 0.02, shutterMat, 1), sx0, F + 1.0, sz0 - 0.2);
    cl('sph', sx0, F + 0.9, sz0 + 0.02, 0.4, 0.12, 0.34, 0xf3f1ec);
    cl('sph', sx0 - 0.02, F + 1.0, sz0 + 0.02, 0.14, 0.24, 0.14, 0xf3f1ec);
    cl('cyl', sx0 + 0.04, F + 1.12, sz0 + 0.02, 0.08, 0.1, 0.08, 0xf3f1ec);
    for (let k = 0; k < 3; k++) cl('soft', sx0 - 0.15, F + 0.24 + k * 0.07, sz0, 0.4, 0.07, 0.3, k % 2 ? 0xf7f1e4 : 0xefe6d2);
    cl('cyl', sx0 + 0.25, F + 0.3, sz0, 0.26, 0.2, 0.26, 0xc8955a);
    cl('box', sx0 + 0.45, F + 0.62, sz0 + 0.12, 0.03, 0.4, 0.14, 0xf6f1e6);
    box(sx0, sz0, 0.92, 0.48);
    // writing desk & chair on the right wall, lamp, books, wall shelf above
    const dz = -2.1, dx = IX - 0.3;
    add(rbox(0.6, 0.05, 1.15, 0.02, timberLight, 1), dx, F + 0.76, dz);
    add(rbox(0.5, 0.14, 1.0, 0.02, timberLight, 1), dx, F + 0.66, dz);
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) add(rbox(0.06, 0.74, 0.06, 0.02, timberLight, 1), dx + ex * 0.24, F + 0.37, dz + ez * 0.5);
    chair(dx - 0.62, dz - 0.05, Math.PI / 2, shutterMat);
    cl('soft', dx - 0.62, F + 0.5, dz - 0.05, 0.38, 0.06, 0.36, 0xf3e9d6);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), timber), dx + 0.08, F + 0.94, dz + 0.4);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 12, 1, true), glow), dx + 0.08, F + 1.16, dz + 0.4);
    books(dx + 0.18, F + 0.78, dz - 0.45, 4, 'z');
    cl('box', dx - 0.08, F + 0.8, dz - 0.05, 0.28, 0.02, 0.36, 0xfbf6ea, 0.1);
    cl('cyl', dx - 0.05, F + 0.84, dz + 0.22, 0.07, 0.12, 0.07, 0xf3eee4);
    vase(dx + 0.12, F + 0.78, dz + 0.12, 0xf3eee4, [0xfdfbf2, 0xf6e27a]);
    add(rbox(0.26, 0.04, 1.0, 0.015, timber, 1), IX - 0.13, 1.75, dz - 0.05);
    for (const ez of [-0.4, 0.4]) add(rbox(0.04, 0.2, 0.2, 0.015, timber, 1), IX - 0.04, 1.65, dz - 0.05 + ez);
    books(IX - 0.14, 1.77, dz - 0.5, 9, 'z');
    pot(IX - 0.14, 1.77, dz + 0.32, 0.08, 12);
    box(dx, dz, 0.62, 1.15);
    // floral rug in the middle of the room, fringed ends
    const rx = 0.35, rz = -2.15;
    cl('box', rx, F + 0.006, rz, 1.8, 0.01, 1.15, 0xd9a07a);
    cl('box', rx, F + 0.009, rz, 1.62, 0.01, 0.98, 0xf4e7cc);
    for (let k = 0; k < 10; k++) for (const ez of [-1, 1]) cl('sph', rx - 0.66 + k * 0.147, F + 0.014, rz + ez * 0.4, 0.09, 0.012, 0.09, k % 2 ? 0xd9746c : 0x8fae6a);
    for (let k = 0; k < 5; k++) for (const ex of [-1, 1]) cl('sph', rx + ex * 0.72, F + 0.014, rz - 0.28 + k * 0.14, 0.09, 0.012, 0.09, k % 2 ? 0x8fae6a : 0xd9746c);
    for (let k = 0; k < 7; k++) cl('sph', rx + jr(-0.4, 0.4), F + 0.014, rz + jr(-0.2, 0.2), 0.12, 0.012, 0.12, pick([0xd9746c, 0xe9a3a0, 0x8fae6a]));
    for (let k = 0; k < 16; k++) for (const ex of [-1, 1]) cl('box', rx + ex * 0.93, F + 0.006, rz - 0.52 + k * 0.07, 0.08, 0.008, 0.02, 0xf6efe0);
    // pictures and a hanging embroidered sampler
    picture(-IX + 0.02, 1.9, -0.75, Math.PI / 2, 0.5, 0.4);
    picture(2.55, 1.85, -IZ + 0.02, 0, 0.42, 0.5);
    // flower pots on the inner window sill
    for (const ex of [-0.22, 0.2]) pot(0.3 + ex, 1.25, -IZ + 0.09, 0.07, ex < 0 ? 0 : 6, ex < 0 ? [0xf48fb1, 0xe8443a] : [0xfdfbf2]);
  }
  // ---------------- bedroom loose decor (garden version only)
  if (garden) {
    // iron-bound chest at the foot of the bed with books and a folded blanket
    const cx = -IX + 2.42, cz = -2.35;
    add(rbox(0.5, 0.48, 0.9, 0.04, doorWood, 1), cx, F + 0.24, cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.9, 12, 1, false, 0, Math.PI), doorWood), cx, F + 0.48, cz, Math.PI / 2, 0, Math.PI / 2);
    for (const ez of [-0.32, 0.32]) add(rbox(0.54, 0.05, 0.05, 0.01, iron, 1), cx, F + 0.52, cz + ez);
    cl('soft', cx, F + 0.74, cz - 0.1, 0.42, 0.06, 0.5, 0x9fb0c4, 0, 0, 0.1);
    books(cx - 0.05, F + 0.73, cz + 0.25, 2, 'x', 1.57);
    // rocking chair with a knitted throw
    const rx = 2.3, rz = -0.95, rry = -2.3, g = new THREE.Group(); g.position.set(rx, F, rz); g.rotation.y = rry; root.add(g);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.025, 5, 16, 0.85), timber), sx * 0.22, 0.95, 0.05, 0, Math.PI / 2, -Math.PI / 2 - 0.42, g);
    add(rbox(0.5, 0.05, 0.46, 0.02, timber, 1), 0, 0.45, 0, 0, 0, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(legGeo, timber), sx * 0.21, 0.24, sz * 0.18, 0, 0, 0, g);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), timber), sx * 0.22, 0.85, -0.25, -0.2, 0, 0, g);
    for (let k = -2; k <= 2; k++) add(new THREE.Mesh(spGeo, timber), k * 0.08, 0.86, -0.26, -0.2, 0, 0, g);
    add(rbox(0.52, 0.08, 0.05, 0.02, timber, 1), 0, 1.27, -0.33, -0.2, 0, 0, g);
    const p = at(rx, rz, rry), [ax, az] = p(0, -0.2), [bx2, bz2] = p(0.12, -0.1);
    cl('soft', ax, F + 0.95, az, 0.42, 0.3, 0.1, 0x9fb5cf, rry, -0.2);
    cl('soft', bx2, F + 0.62, bz2, 0.3, 0.55, 0.06, 0xfbf6ea, rry, -0.6);
    // pile of cushions and a basket of lavender by the nightstand
    for (const [k, c] of [[0, 0x9fb0c4], [1, 0xc8d4de], [2, 0xf3e3d0]]) cl('soft', -1.9 + jr(-0.03, 0.03), F + 0.08 + k * 0.15, -0.8, 0.62 - k * 0.06, 0.15, 0.5 - k * 0.04, c, jr(-0.2, 0.2));
    cl('cyl', -0.85, F + 0.14, -0.8, 0.34, 0.28, 0.34, 0xc8955a);
    for (let k = 0; k < 22; k++) { const x = -0.85 + jr(-0.12, 0.12), z = -0.8 + jr(-0.12, 0.12); blossoms.push([x, F + jr(0.4, 0.62), z, pick([0x8e6cc8, 0x9b7fd4, 0x7a5cb8])]); if (k % 2) leaves.push([x, F + 0.35, z, 0x6f9a5a, true]); }
  }

  // ---------------- leaves & flowers (instanced): ivy, flower boxes, pot plants, hydrangeas, indoor plants & bouquets
  {
    const leafGeo = new THREE.CircleGeometry(0.1, 6); leafGeo.scale(1, 1.4, 1);
    const blossomGeo = new THREE.IcosahedronGeometry(0.075, 0);
    const o = new THREE.Object3D();
    const leafI = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
    const greens = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55].map((h) => new THREE.Color(h));
    leaves.forEach(([x, y, z, c], i) => {
      o.position.set(x, y, z); o.rotation.set(jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28)); o.scale.setScalar(jr(0.7, 1.25)); o.updateMatrix();
      leafI.setMatrixAt(i, o.matrix); leafI.setColorAt(i, (c ? new THREE.Color(c) : greens[Math.floor(rr() * greens.length)].clone()).offsetHSL(0, 0, jr(-0.05, 0.06)));
    });
    leafI.castShadow = true; leafI.receiveShadow = true; root.add(leafI);
    const blossomI = new THREE.InstancedMesh(blossomGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }), blossoms.length);
    blossoms.forEach(([x, y, z, c], i) => { o.position.set(x, y, z); o.rotation.set(jr(0, 6), jr(0, 6), 0); o.scale.setScalar(jr(0.8, 1.3)); o.updateMatrix(); blossomI.setMatrixAt(i, o.matrix); blossomI.setColorAt(i, new THREE.Color(c)); });
    blossomI.castShadow = true; root.add(blossomI);
  }
  // ---------------- cloth, crockery, books (instanced per shape, tinted per instance)
  {
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('plaster', 1, 1), roughness: 0.9, metalness: 0 });
    const geos = { box: new RoundedBoxGeometry(1, 1, 1, 1, 0.1), soft: new RoundedBoxGeometry(1, 1, 1, 2, 0.3), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), disc: new THREE.CylinderGeometry(0.5, 0.5, 1, 32), sph: new THREE.IcosahedronGeometry(0.5, 1) };
    const o = new THREE.Object3D();
    for (const k of Object.keys(C)) {
      if (!C[k].length) continue;
      const im = new THREE.InstancedMesh(geos[k], clothMat, C[k].length);
      C[k].forEach(([x, y, z, sx, sy, sz, c, rx, ry, rz], i) => {
        o.position.set(x, y, z); o.rotation.set(rx, ry, rz, 'YXZ'); o.scale.set(sx, sy, sz); o.updateMatrix();
        im.setMatrixAt(i, o.matrix); im.setColorAt(i, new THREE.Color(c));
      });
      im.castShadow = true; im.receiveShadow = true; im.name = `clutter_${k}`; root.add(im);
    }
  }

  root.userData.footprint = { w: W + 2.4, d: D + 0.8 };
  root.userData.door = { x: doorX, z: FRONT + 0.75 };
  root.userData.doorIn = { x: doorX, z: IZ - 0.6 };
  root.userData.innerDoors = [{ x: innerDoor.x, z: -PT / 2 }];
  root.userData.rooms = [
    { name: 'living', x: 0, z: IZ / 2, w: 2 * IX, d: IZ },
    { name: 'bedroom', x: 0, z: -(IZ + PT) / 2, w: 2 * IX, d: IZ - PT },
  ];
  root.userData.colliders = colliders;
  // hideable-prop slots: next to furniture, in small groups, off the door → inner-door line
  root.userData.propSlots = [
    { id: 'armchair', x: 2.05, z: 3.2, rot: -2.55 },
    { id: 'armchair', x: 0.75, z: 3.3, rot: -3.0 },
    { id: 'stool', x: -1.65, z: 1.18, rot: 0.3 },
    { id: 'stool', x: -0.7, z: 1.16, rot: 1.1 },
    { id: 'chest', x: -0.65, z: -2.35, rot: Math.PI / 2 },
    { id: 'rocking_chair', x: 2.3, z: -0.95, rot: -2.3 },
    { id: 'cushion_pile', x: -1.85, z: -0.8, rot: 0.2 },
    { id: 'cushion_pile', x: -0.85, z: -0.85, rot: -0.3 },
    { id: 'laundry_basket', x: 2.65, z: -3.3, rot: 0.4 },
    { id: 'book_stack', x: -0.45, z: -3.4, rot: 0.2 },
    { id: 'book_stack', x: 0.25, z: -3.45, rot: -0.5 },
  ];
  if (opts.merge !== false) { mergeStatic(THREE, roofG); mergeStatic(THREE, root); }
  return root;
}

// Collapse every plain mesh into canonical vertex-colour batches (1-2 draw calls per prop/tree/house instead of ~5-400) — needed for phones.
export function mergeStatic(THREE, root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), dead = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.material) return;
    for (let a = o.parent; a && a !== root; a = a.parent) if (a.userData.keep || a.name === 'sails' || a.name === 'cloth') return;   // animated parts stay separate
    const mat = o.material;
    if (mat.transparent || (mat.opacity ?? 1) < 0.999 || (mat.alphaTest > 0) || mat.isShaderMaterial || o.matrixWorld.determinant() < 0 || o.userData.keep) return;
    const { mat: canonMat, bakeColor } = resolveCanonicalMaterial(THREE, mat);
    if (mat.vertexColors && !canonMat.vertexColors) return;
    const g = prepareGeometryForBatch(THREE, o, inv, Boolean(canonMat.vertexColors), bakeColor);
    if (!g) return;
    const isGround = Boolean(o.userData && o.userData.ground);
    const bKey = `${canonMat.uuid}|g:${isGround ? 1 : 0}`;
    let b = buckets.get(bKey);
    if (!b) {
      b = {
        mat: canonMat,
        isGround,
        samplePaint: o.userData?.paint || (mat.color ? mat.color.clone() : null),
        geos: [],
      };
      buckets.set(bKey, b);
    }
    b.geos.push(g);
    dead.push(o);
  });
  for (const o of dead) { o.parent.remove(o); o.geometry.dispose(); }
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (b.geos.length > 1) b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = !b.isGround;
    m.receiveShadow = true;
    m.name = 'merged';
    if (b.isGround) m.userData.ground = true;
    if (b.samplePaint) m.userData.paint = b.samplePaint;
    root.add(m);
  }
  // drop now-empty helper groups
  for (const c of [...root.children]) if (c.isGroup && c.children.length === 0) root.remove(c);
}
