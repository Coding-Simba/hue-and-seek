import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* Hue & Seek, prop kit 2: 22 household, barn and bakery hideables (concepts: assets/props2/*_sheet.png).
 * Same interface as kit.js `props`: { label, build: () => THREE.Group, radius, height, zone }.
 * Origin = ground centre, upright, front = +Z, metres. Same painted kit textures and Lambert materials as kit.js.
 * Each prop is assembled ONCE from soft primitives and merged into one geometry per material (<= 8 draw calls);
 * every build() then returns a fresh Group whose meshes share those cached geometries and materials. */
export function createKit2(THREE) {
  const loader = new THREE.TextureLoader();
  const textureCache = new Map();
  const materialCache = new Map();
  const protoCache = new Map();
  const PI = Math.PI;

  // average colour of each painted kit texture: lets a material name its final colour instead of a raw tint
  const TEX_AVG = {
    bark: 0x94592c, burlap: 0xd19c5b, leaves: 0x6bae45, hay: 0xe9ae49, painted_metal: 0x96ac8d,
    wood_light: 0xf0b05e, wood_planks_dark: 0x884219, plaster: 0xf8d694, terracotta: 0xe06238, stone: 0xd7a46b,
  };
  const fit = (target, tex) => {
    const avg = TEX_AVG[tex];
    let out = 0;
    for (const sh of [16, 8, 0]) out |= Math.min(255, Math.round((((target >> sh) & 255) / ((avg >> sh) & 255)) * 255)) << sh;
    return out;
  };
  // key: { c: tint, t: kit texture, tile: metres per texture repeat, e/ei: emissive, ds: double sided, op: opacity }
  const MAT = {
    woodWarm: { c: 0x946441, t: 'wood_light', tile: 0.9 },            // = kit.js woodWarm
    woodLight: { c: 0xb88755, t: 'wood_light', tile: 0.9 },           // = kit.js woodLight
    woodDark: { c: 0x805738, t: 'wood_planks_dark', tile: 0.9 },      // = kit.js woodDark
    woodPale: { c: fit(0xd9b27c, 'wood_light'), t: 'wood_light', tile: 0.9 },
    woodRed: { c: fit(0x9c5434, 'wood_light'), t: 'wood_light', tile: 0.9 },
    peelWood: { c: fit(0xe2bd84, 'wood_light'), t: 'wood_light', tile: 0.7 },
    iron: { c: 0x575c55, t: 'painted_metal', tile: 0.5 },             // = kit.js metalDark
    stoveIron: { c: fit(0x5a4e45, 'painted_metal'), t: 'painted_metal', tile: 0.6 },
    rust: { c: fit(0x83593a, 'painted_metal'), t: 'painted_metal', tile: 0.4 },
    brass: { c: 0xd6a84a },
    ink: { c: 0x3a2e26 },
    glassDark: { c: 0x4d3a2b },
    dial: { c: fit(0xf3e7c9, 'plaster'), t: 'plaster', tile: 0.4 },
    sage: { c: fit(0x8d9c5c, 'plaster'), t: 'plaster', tile: 0.6 },
    sageDark: { c: fit(0x6b7a45, 'plaster'), t: 'plaster', tile: 0.6 },
    knit: { c: fit(0xefe3c6, 'plaster'), t: 'plaster', tile: 0.5 },
    cream: { c: fit(0xf1e5ca, 'plaster'), t: 'plaster', tile: 0.6 },
    clothRed: { c: fit(0xb6553f, 'plaster'), t: 'plaster', tile: 0.6 },
    clothGreen: { c: fit(0x7f9356, 'plaster'), t: 'plaster', tile: 0.6 },
    ochre: { c: 0xdcaa4c },
    leafMotif: { c: 0x7e9d4c },
    wicker: { c: fit(0xcd8f4a, 'hay'), t: 'hay', tile: 0.35 },
    wickerDark: { c: fit(0x9a6432, 'hay'), t: 'hay', tile: 0.35 },
    ceramic: { c: fit(0xf1e4c8, 'plaster'), t: 'plaster', tile: 0.5 },
    terracotta: { c: 0xc66d48, t: 'terracotta', tile: 0.6 },          // = kit.js terracotta
    soil: { c: 0x654a32 },
    fern: { c: 0x8ab64c, ds: true },
    fernDark: { c: 0x5e8e3a, ds: true },
    coverGreen: { c: fit(0x6b8650, 'plaster'), t: 'plaster', tile: 0.5 },
    coverRed: { c: fit(0xa9533e, 'plaster'), t: 'plaster', tile: 0.5 },
    coverTan: { c: fit(0xdcc393, 'plaster'), t: 'plaster', tile: 0.5 },
    pages: { c: fit(0xf4e8cc, 'plaster'), t: 'plaster', tile: 0.3 },
    greenPaint: { c: fit(0x8ba36a, 'painted_metal'), t: 'painted_metal', tile: 0.6 },
    greenLight: { c: fit(0xa6b880, 'painted_metal'), t: 'painted_metal', tile: 0.6 },
    leather: { c: fit(0x8e4c2b, 'plaster'), t: 'plaster', tile: 0.5 },
    leatherDark: { c: fit(0x67361f, 'plaster'), t: 'plaster', tile: 0.5 },
    fleece: { c: fit(0xf0e4c8, 'plaster'), t: 'plaster', tile: 0.4 },
    sack: { c: fit(0xd3ab72, 'burlap'), t: 'burlap', tile: 0.45 },
    sackPale: { c: fit(0xe6d4aa, 'plaster'), t: 'plaster', tile: 0.6 },
    stripeGreen: { c: fit(0x7f9c5a, 'plaster'), t: 'plaster', tile: 0.6 },
    rope: { c: fit(0xc9a066, 'hay'), t: 'hay', tile: 0.3 },
    wheat: { c: 0xd98f3c },
    crust: { c: fit(0xc0763a, 'plaster'), t: 'plaster', tile: 0.4 },
    crustLight: { c: fit(0xdca35c, 'plaster'), t: 'plaster', tile: 0.4 },
    flour: { c: 0xf6ecd6 },
    // the only light sources: emissive, no real lights
    fire: { c: 0xffc163, e: 0xff8a22, ei: 1.7 },
    flame: { c: 0xfff0b8, e: 0xffc04d, ei: 2.4 },
    lampGlass: { c: 0xfff3d6, e: 0xffcf7a, ei: 0.55, op: 0.5, ds: true },
    lanternGlow: { c: 0xffe3a6, e: 0xffad3d, ei: 1.35 },
  };

  function texture(name) {
    if (!textureCache.has(name)) {
      const tex = loader.load(`assets/kit/${name}.webp`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      textureCache.set(name, tex);
    }
    return textureCache.get(name);
  }
  function material(key) {
    if (!materialCache.has(key)) {
      const d = MAT[key];
      const m = new THREE.MeshLambertMaterial({ color: d.c, map: d.t ? texture(d.t) : null });
      if (d.e) { m.emissive.setHex(d.e); m.emissiveIntensity = d.ei; }
      if (d.ds) m.side = THREE.DoubleSide;
      if (d.op) { m.transparent = true; m.opacity = d.op; m.depthWrite = false; }
      m.name = `kit2:${key}`;
      materialCache.set(key, m);
    }
    return materialCache.get(key);
  }

  // ---------- primitives (only built once per prop, so no geometry cache needed here) ----------
  const rbox = (w, h, d, r, seg = 1) => {
    const g = new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, Math.min(r, w / 2, h / 2, d / 2) * 0.98));
    g.userData.box = true;
    return g;
  };
  const cylG = (rt, rb, h, seg = 12, o = {}) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open, o.ts ?? 0, o.tl ?? PI * 2);
    g.userData.uvm = [2 * PI * Math.max(rt, rb), h]; g.userData.swap = true;
    return g;
  };
  const sphG = (r, ws = 12, hs = 8) => {
    const g = new THREE.SphereGeometry(r, ws, hs);
    g.userData.uvm = [2 * PI * r, PI * r];
    return g;
  };
  const latheG = (pts, seg = 16) => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    g.userData.uvm = [2 * PI * Math.max(...pts.map((p) => p[0])), len]; g.userData.swap = true;
    return g;
  };
  const torusG = (R, r, rad = 6, tub = 20, arc = PI * 2) => {
    const g = new THREE.TorusGeometry(R, r, rad, tub, arc);
    g.userData.uvm = [R * arc, 2 * PI * r];
    return g;
  };
  const tubeG = (pts, r, ts = 12, rs = 6) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, ts, r, rs, false);
    g.userData.uvm = [curve.getLength(), 2 * PI * r];
    return g;
  };
  // flat trapezoid board in the XY plane (bottom width w0, top width w1), thickness t along Z, centred
  const trapG = (w0, w1, h, t) => {
    const s = new THREE.Shape();
    s.moveTo(-w0 / 2, -h / 2); s.lineTo(w0 / 2, -h / 2); s.lineTo(w1 / 2, h / 2); s.lineTo(-w1 / 2, h / 2); s.closePath();
    const bev = Math.min(0.012, t * 0.3);
    const g = new THREE.ExtrudeGeometry(s, { depth: t - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1 });
    g.translate(0, 0, -(t - bev * 2) / 2);
    g.userData.box = true;
    return g;
  };
  // puffy cushion / sack: a subdivided box squeezed toward its seams; x0..x1 (normalised -1..1) cuts a band of it
  const pillowF = (nx, nz, pinch, pow) => pinch + (1 - pinch) * Math.pow(Math.max(0, (1 - nx * nx) * (1 - nz * nz)), pow);
  function pillowG(w, h, d, o = {}) {
    const { x0 = -1, x1 = 1, puff = 1, pinch = 0.12, pow = 0.55, segX = 12, segZ = 9 } = o;
    const bw = ((x1 - x0) / 2) * w;
    const g = new THREE.BoxGeometry(bw, h, d, Math.max(1, Math.round((segX * (x1 - x0)) / 2)), 2, segZ);
    g.translate(((x0 + x1) / 2) * (w / 2), 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const nx = Math.max(-1, Math.min(1, p.getX(i) / (w / 2))), nz = Math.max(-1, Math.min(1, p.getZ(i) / (d / 2)));
      const f = pillowF(nx, nz, pinch, pow);
      p.setY(i, p.getY(i) * f * puff);
      // seams bulge a little outward in the middle of each side
      p.setX(i, p.getX(i) * (1 + 0.05 * (1 - nz * nz)));
      p.setZ(i, p.getZ(i) * (1 + 0.05 * (1 - nx * nx)));
    }
    g.computeVertexNormals();
    g.userData.box = true;
    return g;
  }

  // ---------- builder: collects transformed parts per material, merges them once ----------
  function makeBuilder() {
    const buckets = new Map();
    const stack = [new THREE.Matrix4()];
    const one = new THREE.Vector3(1, 1, 1);
    let seq = 0;
    let remap = {};
    const quat = (rot) => (rot && rot.isQuaternion ? rot.clone() : new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])));
    const localM = (pos, rot) => new THREE.Matrix4().compose(new THREE.Vector3(pos[0], pos[1], pos[2]), quat(rot), one);

    function boxUV(g, T, grain) {
      g.computeBoundingBox();
      const s = g.boundingBox.getSize(new THREE.Vector3());
      const L = grain ?? (s.x >= s.y && s.x >= s.z ? 0 : s.y >= s.z ? 1 : 2);
      const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
      const off = (seq * 0.371) % 1, off2 = (seq * 0.619) % 1;
      const n = [0, 0, 0], p = [0, 0, 0];
      for (let t = 0; t < P.count; t += 3) {
        n[0] = n[1] = n[2] = 0;
        for (let k = 0; k < 3; k++) { n[0] += N.getX(t + k); n[1] += N.getY(t + k); n[2] += N.getZ(t + k); }
        const a = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2;
        const axes = [0, 1, 2].filter((k) => k !== a);
        const u = axes.includes(L) ? L : axes[0];
        const v = axes.find((k) => k !== u);
        for (let k = 0; k < 3; k++) {
          p[0] = P.getX(t + k); p[1] = P.getY(t + k); p[2] = P.getZ(t + k);
          UV.setXY(t + k, p[u] / T + off, p[v] / T + off2);
        }
      }
    }
    function part(geo, key, pos = [0, 0, 0], rot = [0, 0, 0], scl = null, grain = null) {
      key = remap[key] || key;
      if (!MAT[key]) throw new Error(`kit2: unknown material ${key}`);
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (scl) typeof scl === 'number' ? g.scale(scl, scl, scl) : g.scale(scl[0], scl[1], scl[2]);
      const T = MAT[key].tile || 0.6;
      seq++;
      if (geo.userData.box) boxUV(g, T, grain);
      else {
        const [mu, mv] = geo.userData.uvm || [T, T];
        const UV = g.attributes.uv, off = (seq * 0.371) % 1;
        for (let i = 0; i < UV.count; i++) {
          const u = UV.getX(i) * (mu / T) + off, v = UV.getY(i) * (mv / T);
          geo.userData.swap ? UV.setXY(i, v, u) : UV.setXY(i, u, v);
        }
      }
      g.applyMatrix4(stack[stack.length - 1].clone().multiply(localM(pos, rot)));
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(g);
      return g;
    }
    const api = {
      // golden barn timber: lets a builder swap kit woods without rewriting every call
      remap(m) { remap = m; },
      push(pos = [0, 0, 0], rot = [0, 0, 0], scl = 1) {
        const m = localM(pos, rot);
        if (scl !== 1) m.scale(typeof scl === 'number' ? new THREE.Vector3(scl, scl, scl) : new THREE.Vector3(...scl));
        stack.push(stack[stack.length - 1].clone().multiply(m));
      },
      pop() { stack.pop(); },
      geo: part,
      box: (w, h, d, r, key, pos, rot, seg = 1, grain = null) => part(rbox(w, h, d, r, seg), key, pos, rot, null, grain),
      cyl: (rt, rb, h, seg, key, pos, rot, o = {}) => part(cylG(rt, rb, h, seg, o), key, pos, rot, o.scl),
      sph: (r, ws, hs, key, pos, rot, scl) => part(sphG(r, ws, hs), key, pos, rot, scl),
      lathe: (pts, seg, key, pos, rot, scl) => part(latheG(pts, seg), key, pos, rot, scl),
      torus: (R, r, rad, tub, key, pos, rot, scl, arc) => part(torusG(R, r, rad, tub, arc), key, pos, rot, scl),
      tube: (pts, r, ts, rs, key) => part(tubeG(pts, r, ts, rs), key),
      trap: (w0, w1, h, t, key, pos, rot) => part(trapG(w0, w1, h, t), key, pos, rot),
      // round rod from a to b (radius r at a, rTop at b)
      stick(a, b, r, key, rTop = r, seg = 6) {
        const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
        const dir = B.clone().sub(A), len = dir.length();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        return part(cylG(rTop, r, len, seg), key, A.add(B).multiplyScalar(0.5).toArray(), q);
      },
      // painted / stitched motifs: low-poly flattened blobs lying in the local XY plane, facing +Z
      blob(key, x, y, sx, sy, sz, angle = 0, z = 0) { return part(sphG(1, 6, 3), key, [x, y, z], [0, 0, angle], [sx, sy, sz]); },
      merge() {
        const out = [];
        for (const [key, geos] of buckets) {
          const g = mergeGeometries(geos, false);
          g.computeBoundingSphere(); g.computeBoundingBox();
          out.push({ geometry: g, material: material(key) });
          geos.forEach((x) => x.dispose());
        }
        return out;
      },
    };
    return api;
  }

  // deterministic jitter so every copy looks the same
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  // five-petal flower motif in the current local XY plane
  function flower(b, petal, centre, x, y, size, leaf = petal, z = 0, spin = 0.3) {
    for (let i = 0; i < 5; i++) {
      const a = i * (PI * 2 / 5) + spin;
      b.blob(petal, x + Math.cos(a) * size * 0.55, y + Math.sin(a) * size * 0.55, size * 0.5, size * 0.33, size * 0.13, a, z);
    }
    b.blob(centre, x, y, size * 0.25, size * 0.25, size * 0.14, 0, z + size * 0.04);
    if (leaf) for (const s of [-1, 1]) b.blob(leaf, x + s * size * 1.2, y - size * 0.75, size * 0.22, size * 0.55, size * 0.1, s * 0.9, z);
  }
  // leafy sprig: a curved stem with paired leaves, in the current local XY plane
  function sprig(b, key, x0, y0, x1, y1, n, leafLen, z = 0, stemR = 0.005) {
    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.12, my = (y0 + y1) / 2 - (x1 - x0) * 0.12;
    b.tube([[x0, y0, z], [mx, my, z], [x1, y1, z]], stemR, 6, 3, key);
    const ang = Math.atan2(y1 - y0, x1 - x0) - PI / 2;
    for (let i = 0; i < n; i++) {
      const t = 0.25 + (0.75 * i) / Math.max(1, n - 1);
      const px = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * mx + t * t * x1, py = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * my + t * t * y1;
      const s = i % 2 ? 1 : -1, l = leafLen * (i === n - 1 ? 0.8 : 1);
      const a = ang + s * 0.75;
      b.blob(key, px - Math.sin(a) * l * 0.8, py + Math.cos(a) * l * 0.8, l * 0.38, l, l * 0.22, a, z);
    }
  }

  // ===================================== HOUSE =====================================
  function armchair(b) {
    for (const x of [-0.34, 0.34]) for (const z of [-0.28, 0.3]) b.cyl(0.052, 0.036, 0.13, 8, 'woodWarm', [x, 0.065, z]);
    b.box(0.9, 0.3, 0.8, 0.1, 'sage', [0, 0.27, 0], [0, 0, 0], 2);
    b.box(0.92, 0.05, 0.82, 0.025, 'sageDark', [0, 0.14, 0]);
    b.box(0.6, 0.14, 0.64, 0.065, 'sage', [0, 0.47, 0.06], [0.03, 0, 0], 2);
    b.box(0.82, 0.6, 0.24, 0.11, 'sage', [0, 0.64, -0.27], [-0.12, 0, 0], 2);
    for (const s of [-1, 1]) {
      b.box(0.2, 0.32, 0.74, 0.08, 'sage', [s * 0.38, 0.5, 0.02], [0, 0, 0], 2);
      b.cyl(0.118, 0.118, 0.76, 14, 'sage', [s * 0.4, 0.66, 0.02], [PI / 2, 0, 0]);
      b.torus(0.088, 0.024, 6, 16, 'sageDark', [s * 0.4, 0.655, 0.402]);
      b.sph(0.118, 14, 6, 'sage', [s * 0.4, 0.66, 0.4], [0, 0, 0], [1, 1, 0.22]);
    }
    // knitted throw draped over the back and down the right arm
    b.push([0.17, 0, 0], [0, 0, -0.03]);
    b.box(0.42, 0.06, 0.3, 0.028, 'knit', [0, 0.925, -0.29], [-0.12, 0, 0]);
    b.box(0.42, 0.36, 0.055, 0.025, 'knit', [0, 0.74, -0.128], [-0.12, 0, 0]);
    b.cyl(0.035, 0.035, 0.42, 8, 'knit', [0, 0.915, -0.15], [0, 0, PI / 2]);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      const x = -0.15 + c * 0.1, y = 0.62 + r * 0.075;
      b.sph(0.03, 6, 3, 'knit', [x + (r % 2) * 0.012, y, -0.1 - (y - 0.74) * 0.12], [0, 0, (c % 2 ? 0.35 : -0.35)], [0.9, 1.5, 0.5]);
    }
    b.pop();
    b.box(0.28, 0.055, 0.48, 0.025, 'knit', [0.38, 0.795, 0.08], [0, 0, -0.04]);
    b.cyl(0.045, 0.045, 0.29, 10, 'knit', [0.39, 0.78, 0.4], [0, 0, PI / 2]);
    b.box(0.29, 0.32, 0.05, 0.022, 'knit', [0.395, 0.63, 0.44], [0.06, 0, 0]);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) {
      b.sph(0.03, 6, 3, 'knit', [0.31 + c * 0.085 + (r % 2) * 0.01, 0.52 + r * 0.075, 0.47 - (0.63 - (0.52 + r * 0.075)) * 0.06], [0, 0, c % 2 ? 0.35 : -0.35], [0.9, 1.5, 0.5]);
      b.sph(0.03, 6, 3, 'knit', [0.31 + c * 0.085, 0.826, 0.26 - r * 0.1], [0, 0, 0], [0.9, 0.5, 1.5]);
    }
    for (let i = 0; i < 6; i++) {
      const x = 0.28 + i * 0.046;
      b.stick([x, 0.475, 0.455], [x + 0.004, 0.395, 0.46], 0.011, 'knit', 0.014, 5);
      b.sph(0.019, 6, 3, 'knit', [x, 0.472, 0.456]);
    }
    // painted ochre flowers on the green fabric
    b.push([0, 0.64, -0.142], [-0.12, 0, 0]);
    flower(b, 'ochre', 'sageDark', -0.22, 0.12, 0.075);
    flower(b, 'ochre', 'sageDark', -0.07, -0.02, 0.05, null);
    b.pop();
    b.push([-0.486, 0.46, 0.08], [0, -PI / 2, 0]);
    flower(b, 'ochre', 'sageDark', 0, 0, 0.07);
    flower(b, 'ochre', 'sageDark', 0.18, 0.06, 0.045, null);
    b.pop();
    b.push([-0.38, 0.48, 0.392], [0, 0, 0]);
    flower(b, 'ochre', 'sageDark', 0, 0, 0.045, null);
    b.pop();
  }

  function rockingChair(b) {
    b.remap({ woodWarm: 'woodLight', woodLight: 'woodPale' });
    for (const s of [-1, 1]) {
      const x = s * 0.25, pts = [];
      for (let i = 0; i <= 10; i++) {
        const z = -0.5 + i * 0.1;
        pts.push([x, 0.034 + z * z * 0.32 + Math.max(0, Math.abs(z) - 0.38) * 0.55, z]);
      }
      b.tube(pts, 0.032, 22, 6, 'woodWarm');
      b.sph(0.033, 8, 5, 'woodWarm', pts[0]);
      b.sph(0.033, 8, 5, 'woodWarm', pts[10]);
      b.stick([x, 0.05, 0.2], [x * 1.02, 0.67, 0.225], 0.031, 'woodWarm', 0.027, 7);
      b.stick([x, 0.05, -0.2], [x * 0.94, 1.04, -0.4], 0.032, 'woodWarm', 0.027, 7);
      b.sph(0.034, 8, 6, 'woodLight', [x * 0.94, 1.05, -0.402]);
      b.stick([x, 0.22, 0.205], [x, 0.22, -0.225], 0.016, 'woodLight');
      b.box(0.075, 0.04, 0.6, 0.016, 'woodLight', [s * 0.275, 0.68, -0.02], [0.05, 0, 0]);
      b.sph(0.042, 8, 6, 'woodLight', [s * 0.275, 0.675, 0.285], [0, 0, 0], [1, 0.75, 1]);
    }
    b.stick([-0.25, 0.25, 0.205], [0.25, 0.25, 0.205], 0.016, 'woodLight');
    b.box(0.56, 0.05, 0.48, 0.018, 'woodLight', [0, 0.44, 0.0]);
    b.box(0.5, 0.08, 0.44, 0.036, 'cream', [0, 0.505, 0.015], [0, 0, 0], 2);
    for (const z of [0.1, 0.165]) b.box(0.506, 0.083, 0.03, 0.012, 'clothRed', [0, 0.505, z]);
    b.box(0.06, 0.08, 0.03, 0.01, 'clothRed', [0, 0.505, -0.16]);
    // back: lower rail, four flat slats, broad curved top rail
    b.box(0.5, 0.045, 0.035, 0.014, 'woodLight', [0, 0.6, -0.31], [-0.2, 0, 0]);
    for (const x of [-0.165, -0.055, 0.055, 0.165]) b.box(0.06, 0.36, 0.022, 0.01, 'woodWarm', [x, 0.79, -0.348], [-0.2, 0, 0]);
    b.box(0.6, 0.13, 0.05, 0.03, 'woodLight', [0, 0.995, -0.39], [-0.2, 0, 0], 2);
  }

  function grandfatherClock(b) {
    for (const x of [-0.22, 0.22]) for (const z of [-0.12, 0.12]) b.box(0.09, 0.06, 0.09, 0.02, 'woodDark', [x, 0.03, z]);
    b.box(0.54, 0.38, 0.34, 0.04, 'woodRed', [0, 0.25, 0], [0, 0, 0], 2);
    b.box(0.36, 0.22, 0.02, 0.01, 'woodDark', [0, 0.25, 0.172]);
    b.box(0.3, 0.16, 0.02, 0.01, 'woodRed', [0, 0.25, 0.18]);
    b.blob('brass', 0, 0.25, 0.032, 0.032, 0.008, PI / 4, 0.19);
    b.box(0.5, 0.05, 0.32, 0.02, 'woodDark', [0, 0.465, 0]);
    b.box(0.42, 0.8, 0.27, 0.035, 'woodRed', [0, 0.89, 0], [0, 0, 0], 2);
    b.box(0.29, 0.62, 0.02, 0.012, 'woodDark', [0, 0.9, 0.137]);
    b.box(0.21, 0.52, 0.012, 0.005, 'glassDark', [0, 0.915, 0.147]);
    b.stick([0, 1.15, 0.156], [0, 0.74, 0.156], 0.007, 'brass');
    b.cyl(0.055, 0.055, 0.014, 14, 'brass', [0, 0.72, 0.158], [PI / 2, 0, 0]);
    b.box(0.48, 0.05, 0.31, 0.02, 'woodDark', [0, 1.315, 0]);
    b.box(0.5, 0.38, 0.32, 0.035, 'woodRed', [0, 1.53, 0], [0, 0, 0], 2);
    for (const x of [-0.215, 0.215]) b.cyl(0.022, 0.022, 0.36, 8, 'woodDark', [x, 1.53, 0.165]);
    // dial
    b.cyl(0.145, 0.145, 0.02, 22, 'dial', [0, 1.53, 0.165], [PI / 2, 0, 0]);
    b.torus(0.148, 0.016, 6, 24, 'brass', [0, 1.53, 0.175]);
    for (let i = 0; i < 12; i++) {
      const a = (i * PI) / 6;
      b.box(0.013, i % 3 === 0 ? 0.034 : 0.022, 0.006, 0.002, 'ink', [Math.sin(a) * 0.112, 1.53 + Math.cos(a) * 0.112, 0.177], [0, 0, -a]);
    }
    for (const [a, len, w] of [[((10 + 10 / 60) * PI) / 6, 0.07, 0.016], [(2 * PI) / 6, 0.105, 0.011]]) {
      b.box(w, len, 0.006, 0.003, 'ink', [Math.sin(a) * len * 0.42, 1.53 + Math.cos(a) * len * 0.42, 0.182], [0, 0, -a]);
    }
    b.sph(0.013, 8, 5, 'brass', [0, 1.53, 0.185]);
    // arched bonnet with a carved leaf crest and finials
    b.cyl(0.25, 0.25, 0.3, 18, 'woodRed', [0, 1.72, 0], [PI / 2, 0, 0], { ts: PI / 2, tl: PI, scl: [1, 1, 0.56] });
    b.box(0.52, 0.035, 0.33, 0.012, 'woodDark', [0, 1.72, 0]);
    b.push([0, 1.765, 0.152]);
    b.blob('brass', 0, 0.01, 0.022, 0.04, 0.01);
    b.blob('brass', -0.035, -0.004, 0.018, 0.034, 0.009, 1.0);
    b.blob('brass', 0.035, -0.004, 0.018, 0.034, 0.009, -1.0);
    b.pop();
    for (const x of [-0.22, 0.22]) { b.cyl(0.018, 0.024, 0.04, 8, 'woodDark', [x, 1.74, 0.12]); b.sph(0.03, 8, 6, 'woodDark', [x, 1.78, 0.12]); }
    b.cyl(0.02, 0.028, 0.04, 8, 'woodDark', [0, 1.855, 0]);
    b.sph(0.034, 8, 6, 'woodDark', [0, 1.895, 0]);
  }

  function stove(b) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [[sx * 0.2, 0.25, sz * 0.13], [sx * 0.25, 0.15, sz * 0.165], [sx * 0.265, 0.07, sz * 0.18], [sx * 0.3, 0.025, sz * 0.21]];
      b.tube(pts, 0.03, 8, 6, 'stoveIron');
      b.sph(0.042, 8, 5, 'stoveIron', pts[3], [0, 0, 0], [1.25, 0.5, 1.25]);
    }
    b.cyl(0.29, 0.29, 0.04, 20, 'iron', [0, 0.235, 0], [0, 0, 0], { scl: [1, 1, 0.84] });
    b.lathe([[0, 0.22], [0.27, 0.22], [0.3, 0.25], [0.322, 0.32], [0.333, 0.45], [0.322, 0.6], [0.3, 0.69], [0.27, 0.73], [0, 0.73]], 22, 'stoveIron', [0, 0, 0], [0, 0, 0], [1, 1, 0.84]);
    for (const [y, R] of [[0.262, 0.305], [0.69, 0.302]]) b.torus(R, 0.022, 6, 28, 'iron', [0, y, 0], [PI / 2, 0, 0], [1, 0.84, 1]);
    b.cyl(0.34, 0.33, 0.05, 22, 'iron', [0, 0.755, 0], [0, 0, 0], { scl: [1, 1, 0.84] });
    b.cyl(0.11, 0.11, 0.025, 16, 'stoveIron', [-0.1, 0.792, 0.08]);
    b.sph(0.022, 8, 5, 'rust', [-0.1, 0.81, 0.08]);
    // flue pipe rising and bending back
    b.cyl(0.08, 0.085, 0.06, 14, 'iron', [0, 0.8, -0.1]);
    b.tube([[0, 0.8, -0.1], [0, 1.1, -0.1], [0, 1.2, -0.13], [0, 1.245, -0.2], [0, 1.25, -0.3]], 0.056, 18, 10, 'stoveIron');
    b.torus(0.06, 0.012, 5, 16, 'iron', [0, 1.0, -0.1], [PI / 2, 0, 0]);
    b.torus(0.06, 0.012, 5, 16, 'iron', [0, 1.25, -0.3]);
    // door: arched glowing window behind bars, fleur motif, handle and hinges
    const fz = 0.273;
    b.box(0.36, 0.38, 0.045, 0.02, 'iron', [0, 0.49, fz], [0, 0, 0], 1);
    b.box(0.2, 0.1, 0.02, 0.006, 'fire', [0, 0.52, fz + 0.022]);
    b.cyl(0.1, 0.1, 0.02, 14, 'fire', [0, 0.57, fz + 0.022], [PI / 2, 0, 0], { ts: PI / 2, tl: PI });
    b.torus(0.1, 0.014, 5, 14, 'iron', [0, 0.57, fz + 0.03], [0, 0, 0], null, PI);
    b.box(0.226, 0.022, 0.016, 0.006, 'iron', [0, 0.468, fz + 0.03]);
    for (const x of [-0.05, 0, 0.05]) b.box(0.014, 0.2 - Math.abs(x) * 0.6, 0.012, 0.005, 'iron', [x, 0.468 + (0.2 - Math.abs(x) * 0.6) / 2, fz + 0.03]);
    b.push([0, 0.38, fz + 0.024]);
    b.blob('rust', 0, 0.01, 0.018, 0.045, 0.008);
    b.blob('rust', -0.034, 0, 0.014, 0.036, 0.008, 0.9);
    b.blob('rust', 0.034, 0, 0.014, 0.036, 0.008, -0.9);
    b.blob('rust', 0, -0.035, 0.05, 0.01, 0.008);
    b.pop();
    b.stick([0.15, 0.5, fz + 0.025], [0.2, 0.5, fz + 0.065], 0.01, 'iron');
    b.sph(0.022, 8, 5, 'rust', [0.205, 0.5, fz + 0.07]);
    for (const y of [0.4, 0.6]) b.box(0.06, 0.025, 0.02, 0.006, 'rust', [-0.175, y, fz + 0.02]);
  }

  function laundryBasket(b) {
    const SX = 1.12, SZ = 0.8;
    b.lathe([[0, 0.012], [0.2, 0.0], [0.25, 0.03], [0.3, 0.12], [0.33, 0.3], [0.345, 0.46]], 22, 'wicker', [0, 0, 0], [0, 0, 0], [SX, 1, SZ]);
    b.lathe([[0.33, 0.46], [0.315, 0.3], [0.285, 0.12], [0.24, 0.05], [0, 0.05]], 18, 'wickerDark', [0, 0, 0], [0, 0, 0], [SX, 1, SZ]);
    const rAt = (y) => (y < 0.12 ? 0.25 + ((y - 0.03) / 0.09) * 0.05 : y < 0.3 ? 0.3 + ((y - 0.12) / 0.18) * 0.03 : 0.33 + ((y - 0.3) / 0.16) * 0.015);
    for (let i = 0; i < 6; i++) {
      const y = 0.075 + i * 0.065;
      b.torus(rAt(y) + 0.006, 0.019, 5, 30, i % 2 ? 'wicker' : 'wickerDark', [0, y, 0], [PI / 2, 0, 0], [SX, SZ, 1]);
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2, c = Math.cos(a), s = Math.sin(a);
      b.stick([c * 0.252 * SX, 0.035, s * 0.252 * SZ], [c * 0.35 * SX, 0.45, s * 0.35 * SZ], 0.011, 'wickerDark', 0.011, 4);
    }
    b.torus(0.35, 0.038, 7, 34, 'wicker', [0, 0.47, 0], [PI / 2, 0, 0], [SX, SZ, 1]);
    b.torus(0.35, 0.02, 5, 34, 'wickerDark', [0, 0.495, 0], [PI / 2, 0, 0], [SX, SZ, 1]);
    for (const s of [-1, 1]) {
      b.torus(0.085, 0.026, 6, 12, 'wicker', [s * 0.375, 0.48, 0], [0, 0, 0], null, PI);
      b.torus(0.085, 0.012, 4, 12, 'wickerDark', [s * 0.375, 0.48, 0.022], [0, 0, 0], null, PI);
    }
    // folded laundry
    b.sph(0.16, 10, 7, 'clothGreen', [-0.13, 0.48, -0.04], [0, 0.3, 0], [1.3, 0.55, 1]);
    b.sph(0.14, 10, 7, 'clothGreen', [0.11, 0.5, -0.07], [0, -0.4, 0], [1.15, 0.6, 0.9]);
    b.sph(0.13, 10, 7, 'cream', [0.16, 0.48, 0.06], [0, 0.2, 0.1], [1, 0.5, 0.9]);
    b.sph(0.1, 10, 7, 'clothGreen', [-0.05, 0.54, 0.02], [0, 0, 0], [1.2, 0.5, 1]);
    b.push([0.03, 0, 0], [0, -0.08, 0]);
    b.box(0.3, 0.04, 0.24, 0.018, 'cream', [0, 0.53, 0.15], [0.22, 0, 0]);
    b.cyl(0.036, 0.036, 0.3, 10, 'cream', [0, 0.505, 0.293], [0, 0, PI / 2]);
    b.push([0, 0.37, 0.315], [-0.12, 0, 0]);
    b.box(0.29, 0.27, 0.035, 0.016, 'cream', [0, 0, 0]);
    for (const y of [-0.055, -0.095]) b.box(0.294, 0.022, 0.038, 0.008, 'clothRed', [0, y, 0]);
    b.pop();
    b.pop();
  }

  function cushionPile(b) {
    const pile = [
      // w, h, d, key, y, rotY, x, z
      [0.72, 0.2, 0.6, 'clothRed', 0.1, 0.08, 0, 0],
      [0.68, 0.2, 0.58, 'clothGreen', 0.265, -0.1, -0.015, 0.01],
      [0.64, 0.22, 0.56, 'cream', 0.44, 0.15, 0.01, 0.0],
    ];
    pile.forEach(([w, h, d, key, y, ry, x, z], i) => {
      b.push([x, y, z], [0, ry, 0]);
      b.geo(pillowG(w, h, d), key);
      if (i === 0) for (const [x0, x1] of [[-0.66, -0.56], [-0.46, -0.38], [0.38, 0.46], [0.56, 0.66]]) b.geo(pillowG(w, h, d, { x0, x1, puff: 1.035 }), 'cream', [0, 0, 0], [0, 0, 0], [1, 1, 1.012]);
      if (i === 1) for (const nz of [-0.5, 0, 0.5]) b.geo(pillowG(w, h, d, { x0: -0.9, x1: 0.9, puff: 1.02 }), 'sageDark', [0, 0, nz * d / 2], [0, 0, 0], [1, 1, 0.02]);
      if (i === 2) {
        // red flowers and green leaves printed on the top cushion
        const spots = [[-0.45, 0.25, 0.085], [0.1, -0.35, 0.08], [0.48, 0.3, 0.075], [-0.05, 0.55, 0.06], [-0.55, -0.45, 0.06], [0.55, -0.55, 0.055], [0.05, 0.12, 0.05]];
        for (const [nx, nz, size] of spots) {
          const top = (fx, fz) => (h / 2) * pillowF(fx, fz, 0.12, 0.55);
          const yy = top(nx, nz), e = 0.02;
          const dx = (top(nx + e, nz) - top(nx - e, nz)) / (2 * e * (w / 2)), dz = (top(nx, nz + e) - top(nx, nz - e)) / (2 * e * (d / 2));
          const n = new THREE.Vector3(-dx, 1, -dz).normalize();
          b.push([nx * (w / 2) * 1.03, yy - 0.002, nz * (d / 2) * 1.03], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
          flower(b, 'clothRed', 'ochre', 0, 0, size, 'leafMotif', 0, nx * 3);
          b.pop();
        }
      }
      b.pop();
    });
  }

  function pottedFern(b) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.stick([sx * 0.16, 0, sz * 0.16], [sx * 0.13, 0.5, sz * 0.13], 0.03, 'woodWarm', 0.026, 6);
    b.box(0.37, 0.05, 0.37, 0.02, 'woodWarm', [0, 0.51, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2, c = Math.cos(a), s = Math.sin(a), r = 0.152;
      b.stick([c * r - s * r, 0.18, s * r + c * r], [c * r + s * r, 0.18, s * r - c * r], 0.016, 'woodWarm');
    }
    b.lathe([[0, 0.535], [0.1, 0.535], [0.14, 0.55], [0.18, 0.61], [0.2, 0.69], [0.19, 0.765], [0.2, 0.79], [0.185, 0.8]], 18, 'ceramic');
    b.torus(0.195, 0.017, 5, 22, 'terracotta', [0, 0.792, 0], [PI / 2, 0, 0]);
    b.torus(0.18, 0.009, 4, 22, 'terracotta', [0, 0.57, 0], [PI / 2, 0, 0]);
    b.cyl(0.18, 0.18, 0.02, 16, 'soil', [0, 0.78, 0]);
    for (const a of [0, PI]) {
      b.push([Math.sin(a) * 0.2, 0.68, Math.cos(a) * 0.2], [0, a, 0]);
      sprig(b, 'leafMotif', -0.06, -0.06, 0.06, 0.05, 5, 0.026, 0.004);
      b.pop();
    }
    // fronds: arching ribbons of serrated leaflets (two greens), double sided
    const rnd = rng(11);
    const fronds = { fern: [], fernDark: [] };
    const up = new THREE.Vector3(0, 1, 0);
    const N = 16;
    for (let f = 0; f < N; f++) {
      const ang = (f / N) * PI * 2 + rnd() * 0.3;
      const inner = f % 2 === 0;
      const L = inner ? 0.42 + rnd() * 0.08 : 0.5 + rnd() * 0.08, elev = inner ? 1.3 : 0.8 + rnd() * 0.15, bend = inner ? 2.1 : 2.3;
      const n = 14, ds = L / n, dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const pts = [];
      const p = new THREE.Vector3(Math.cos(ang) * 0.03, 0.79, Math.sin(ang) * 0.03);
      for (let i = 0; i <= n; i++) {
        pts.push(p.clone());
        const th = elev - bend * (i / n);
        p.addScaledVector(dir, Math.cos(th) * ds).addScaledVector(up, Math.sin(th) * ds);
      }
      const tris = fronds[f % 3 === 0 ? 'fernDark' : 'fern'];
      const pushTri = (A, B, C) => {
        const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
        if (nrm.y < 0) tris.push(A, C, B); else tris.push(A, B, C);
      };
      const W = 0.085;
      for (let i = 0; i < n; i++) {
        const t = new THREE.Vector3().subVectors(pts[i + 1], pts[i]).normalize();
        const side = new THREE.Vector3().crossVectors(t, up).normalize();
        pushTri(pts[i].clone().addScaledVector(side, 0.006), pts[i + 1].clone().addScaledVector(side, 0.004), pts[i].clone().addScaledVector(side, -0.006));
        pushTri(pts[i + 1].clone().addScaledVector(side, 0.004), pts[i + 1].clone().addScaledVector(side, -0.004), pts[i].clone().addScaledVector(side, -0.006));
        if (i < 1) continue;
        const s = i / n;
        const nrmV = new THREE.Vector3().crossVectors(side, t).normalize();
        const ll = W * Math.pow(Math.sin(PI * (0.1 + 0.88 * s)), 0.75);
        for (const sg of [-1, 1]) {
          const B = pts[i];
          const T = B.clone().addScaledVector(side, sg * ll).addScaledVector(t, ll * 0.5).addScaledVector(nrmV, -ll * 0.3);
          const E1 = B.clone().addScaledVector(side, sg * ll * 0.45).addScaledVector(t, ll * 0.42).addScaledVector(nrmV, ll * 0.05);
          const E2 = B.clone().addScaledVector(side, sg * ll * 0.55).addScaledVector(t, -ll * 0.1).addScaledVector(nrmV, ll * 0.05);
          pushTri(B, E1, T); pushTri(B, T, E2);
        }
      }
    }
    for (const [key, verts] of Object.entries(fronds)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts.flatMap((v) => [v.x, v.y, v.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(verts.flatMap((v) => [v.x, v.z]), 2));
      g.computeVertexNormals();
      g.userData.uvm = [1, 1];
      b.geo(g, key);
    }
  }

  function chest(b) {
    for (const x of [-0.37, 0.37]) for (const z of [-0.21, 0.21]) b.box(0.1, 0.07, 0.1, 0.02, 'woodDark', [x, 0.035, z]);
    b.box(0.9, 0.06, 0.56, 0.02, 'woodDark', [0, 0.09, 0]);
    for (let i = 0; i < 3; i++) b.box(0.86, 0.125, 0.52, 0.022, i % 2 ? 'woodLight' : 'woodWarm', [0, 0.1825 + i * 0.125, 0], [0, 0, (i - 1) * 0.004], 1, 0);
    b.box(0.88, 0.06, 0.54, 0.02, 'woodWarm', [0, 0.525, 0], [0, 0, 0], 1, 0);
    b.cyl(0.27, 0.27, 0.86, 18, 'woodLight', [0, 0.555, 0], [0, 0, PI / 2], { ts: 0, tl: PI, scl: [0.45, 1, 1] });
    for (const a of [PI / 3, (2 * PI) / 3]) b.stick([-0.43, 0.555 + 0.27 * 0.45 * Math.sin(a), 0.27 * Math.cos(a)], [0.43, 0.555 + 0.27 * 0.45 * Math.sin(a), 0.27 * Math.cos(a)], 0.006, 'woodDark', 0.006, 4);
    // iron strapping, rivets, lock
    for (const x of [-0.3, 0.3]) {
      b.box(0.055, 0.4, 0.014, 0.005, 'iron', [x, 0.305, 0.264]);
      b.box(0.055, 0.4, 0.014, 0.005, 'iron', [x, 0.305, -0.264]);
      b.torus(0.276, 0.022, 5, 18, 'iron', [x, 0.555, 0], [0, PI / 2, 0], [1, 0.45, 1], PI);
      for (const y of [0.16, 0.3, 0.44]) b.sph(0.013, 6, 4, 'iron', [x, y, 0.274]);
    }
    for (const sx of [-1, 1]) {
      b.box(0.05, 0.4, 0.014, 0.005, 'iron', [sx * 0.41, 0.305, 0.264]);
      b.box(0.014, 0.4, 0.05, 0.005, 'iron', [sx * 0.433, 0.305, 0.24]);
      b.torus(0.045, 0.01, 4, 12, 'iron', [sx * 0.445, 0.36, 0], [0, PI / 2, 0], null, PI);
      b.box(0.014, 0.4, 0.05, 0.005, 'iron', [sx * 0.433, 0.305, -0.24]);
    }
    b.box(0.88, 0.035, 0.016, 0.006, 'iron', [0, 0.525, 0.272]);
    b.box(0.13, 0.14, 0.022, 0.015, 'iron', [0, 0.43, 0.272]);
    b.box(0.07, 0.1, 0.02, 0.01, 'iron', [0, 0.52, 0.285]);
    b.cyl(0.014, 0.014, 0.01, 8, 'ink', [0, 0.445, 0.284], [PI / 2, 0, 0]);
    b.box(0.011, 0.03, 0.01, 0.003, 'ink', [0, 0.425, 0.284]);
  }

  function spinningWheel(b) {
    b.box(0.86, 0.07, 0.22, 0.025, 'woodWarm', [-0.05, 0.37, -0.02], [0, 0, -0.1], 1, 0);
    for (const sz of [-1, 1]) b.stick([-0.38, 0.39, sz * 0.07 - 0.02], [-0.48, 0, sz * 0.2 - 0.02], 0.028, 'woodWarm', 0.022, 6);
    b.stick([0.3, 0.33, -0.02], [0.42, 0, -0.06], 0.028, 'woodWarm', 0.022, 6);
    const C = [0.16, 0.7, 0], R = 0.3;
    for (const sz of [-1, 1]) {
      b.stick([0.16, 0.36, sz * 0.075], [0.16, 0.74, sz * 0.075], 0.024, 'woodWarm', 0.02, 6);
      b.sph(0.03, 8, 6, 'woodDark', [0.16, 0.76, sz * 0.075]);
    }
    b.cyl(0.018, 0.018, 0.2, 8, 'woodDark', C, [PI / 2, 0, 0]);
    b.cyl(0.05, 0.05, 0.08, 12, 'woodLight', C, [PI / 2, 0, 0]);
    b.torus(R, 0.028, 6, 36, 'woodWarm', C);
    b.torus(R - 0.035, 0.012, 4, 32, 'woodLight', C);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2, c = Math.cos(a), s = Math.sin(a);
      b.stick([C[0] + c * 0.045, C[1] + s * 0.045, 0], [C[0] + c * (R - 0.04), C[1] + s * (R - 0.04), 0], 0.011, 'woodLight', 0.009, 5);
    }
    b.stick([0.16, 0.7, 0.1], [0.22, 0.67, 0.1], 0.012, 'woodDark');
    b.stick([0.22, 0.67, 0.1], [0.0, 0.07, 0.12], 0.01, 'woodDark', 0.01, 5);
    b.box(0.34, 0.03, 0.2, 0.01, 'woodLight', [-0.04, 0.05, 0.1], [0, 0, 0.08], 1, 0);
    b.stick([-0.2, 0.04, 0.1], [-0.42, 0.04, 0.12], 0.012, 'woodDark');
    // flyer, bobbin of yarn and drive band
    for (const x of [-0.42, -0.2]) {
      b.stick([x, 0.41, -0.02], [x, 0.66, 0], 0.02, 'woodWarm', 0.017, 6);
      b.sph(0.026, 8, 6, 'woodDark', [x, 0.675, 0]);
    }
    b.stick([-0.47, 0.6, 0], [-0.13, 0.6, 0], 0.01, 'woodDark');
    b.cyl(0.055, 0.055, 0.12, 12, 'knit', [-0.31, 0.6, 0], [0, 0, PI / 2]);
    for (let i = 0; i < 4; i++) b.torus(0.056, 0.008, 4, 12, 'knit', [-0.355 + i * 0.03, 0.6, 0], [0, PI / 2, 0]);
    for (const x of [-0.375, -0.245]) b.cyl(0.068, 0.068, 0.014, 12, 'woodLight', [x, 0.6, 0], [0, 0, PI / 2]);
    b.cyl(0.04, 0.04, 0.03, 12, 'woodLight', [-0.16, 0.6, 0], [0, 0, PI / 2]);
    b.stick([-0.16, 0.64, 0], [0.14, 1.0, 0], 0.004, 'knit', 0.004, 4);
    b.stick([-0.16, 0.56, 0], [0.12, 0.405, 0], 0.004, 'knit', 0.004, 4);
  }

  function butterChurn(b) {
    const prof = [[0, 0.0], [0.2, 0.0], [0.215, 0.025], [0.21, 0.2], [0.192, 0.45], [0.168, 0.7], [0.16, 0.73]];
    b.lathe(prof, 22, 'woodPale');
    const rAt = (y) => (y < 0.2 ? 0.21 : y < 0.45 ? 0.21 - ((y - 0.2) / 0.25) * 0.018 : 0.192 - ((y - 0.45) / 0.25) * 0.024);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2 + 0.13, c = Math.cos(a), s = Math.sin(a);
      b.stick([c * 0.214, 0.03, s * 0.214], [c * 0.163, 0.715, s * 0.163], 0.0045, 'woodWarm', 0.0045, 3);
    }
    for (const y of [0.1, 0.6]) {
      const R = rAt(y) + 0.004;
      b.torus(R, 0.019, 6, 26, 'iron', [0, y, 0], [PI / 2, 0, 0]);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + 0.2; b.sph(0.012, 6, 4, 'iron', [Math.cos(a) * (R + 0.018), y, Math.sin(a) * (R + 0.018)]); }
    }
    b.cyl(0.152, 0.168, 0.04, 18, 'woodWarm', [0, 0.75, 0]);
    b.cyl(0.05, 0.055, 0.03, 12, 'woodWarm', [0, 0.785, 0]);
    b.stick([0, 0.78, 0], [0, 1.15, 0], 0.024, 'woodWarm', 0.022, 8);
    b.sph(0.028, 8, 6, 'woodWarm', [0, 1.155, 0]);
    // painted leaf sprig on the front stave
    b.push([0, 0.33, rAt(0.33) + 0.003], [-0.07, 0, 0]);
    sprig(b, 'leafMotif', -0.01, -0.13, 0.015, 0.13, 7, 0.042, 0, 0.006);
    b.pop();
  }

  function lampTable(b) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [[sx * 0.22, 0.5, sz * 0.16], [sx * 0.235, 0.36, sz * 0.175], [sx * 0.212, 0.18, sz * 0.158], [sx * 0.235, 0.06, sz * 0.18], [sx * 0.265, 0.018, sz * 0.205]];
      b.tube(pts, 0.03, 10, 6, 'woodWarm');
      b.sph(0.032, 8, 5, 'woodWarm', pts[4], [0, 0, 0], [1.25, 0.6, 1.25]);
    }
    b.box(0.5, 0.12, 0.38, 0.02, 'woodWarm', [0, 0.52, 0], [0, 0, 0], 1, 0);
    b.box(0.64, 0.05, 0.5, 0.022, 'woodLight', [0, 0.605, 0], [0, 0, 0], 2, 0);
    b.box(0.3, 0.08, 0.02, 0.008, 'woodLight', [0, 0.52, 0.196], [0, 0, 0], 1, 0);
    b.sph(0.022, 8, 6, 'woodWarm', [0, 0.52, 0.215]);
    // oil lamp
    b.push([0.02, 0.63, 0.0]);
    b.cyl(0.075, 0.082, 0.025, 16, 'brass', [0, 0.0125, 0]);
    b.lathe([[0, 0.02], [0.08, 0.025], [0.105, 0.06], [0.112, 0.1], [0.1, 0.14], [0.06, 0.17], [0.035, 0.18], [0, 0.18]], 18, 'ceramic');
    b.push([0, 0.095, 0.11], [0, 0, 0]);
    sprig(b, 'leafMotif', -0.03, -0.02, 0.035, 0.025, 5, 0.017, 0, 0.003);
    b.pop();
    b.push([0, 0.095, -0.11], [0, PI, 0]);
    sprig(b, 'leafMotif', -0.03, -0.02, 0.035, 0.025, 5, 0.017, 0, 0.003);
    b.pop();
    b.cyl(0.04, 0.045, 0.04, 14, 'brass', [0, 0.2, 0]);
    b.cyl(0.042, 0.052, 0.035, 14, 'brass', [0, 0.235, 0]);
    b.stick([0.04, 0.228, 0], [0.075, 0.228, 0], 0.005, 'brass');
    b.sph(0.016, 8, 5, 'brass', [0.078, 0.228, 0], [0, 0, 0], [0.5, 1, 1]);
    b.lathe([[0.04, 0.25], [0.058, 0.29], [0.065, 0.33], [0.05, 0.38], [0.035, 0.42], [0.038, 0.45]], 16, 'lampGlass');
    b.sph(0.018, 8, 6, 'flame', [0, 0.3, 0], [0, 0, 0], [1, 2, 1]);
    b.pop();
  }

  function bookStack(b) {
    const book = (w, t, d, cover, y, ry, x) => {
      b.push([x, y, 0], [0, ry, 0]);
      const bt = 0.016;
      b.box(w, bt, d, 0.008, cover, [0, t / 2 - bt / 2, 0]);
      b.box(w, bt, d, 0.008, cover, [0, -t / 2 + bt / 2, 0]);
      b.box(w, t, 0.034, 0.015, cover, [0, 0, d / 2 - 0.017], [0, 0, 0], 2);
      b.box(w - 0.026, t - 2 * bt + 0.004, d - 0.04, 0.006, 'pages', [0, 0, -0.012], [0, 0, 0], 1, 0);
      for (const sx of [-0.33, 0.33]) b.box(0.016, t + 0.003, 0.036, 0.006, 'ochre', [sx * w, 0, d / 2 - 0.016]);
      b.pop();
    };
    book(0.5, 0.12, 0.35, 'coverGreen', 0.06, 0.03, 0);
    book(0.45, 0.1, 0.33, 'coverRed', 0.17, -0.07, 0.015);
    book(0.47, 0.11, 0.34, 'coverTan', 0.275, 0.05, -0.012);
    book(0.43, 0.11, 0.32, 'coverGreen', 0.385, -0.1, 0.012);
    // leaf sprig on the tan spine and on the top cover
    b.push([-0.012, 0.275, 0], [0, 0.05, 0]);
    b.push([0, 0, 0.171]);
    sprig(b, 'leafMotif', -0.1, -0.005, 0.1, 0.005, 7, 0.028, 0, 0.004);
    b.pop();
    b.pop();
    b.push([0.012, 0.441, 0], [0, -0.1, 0]);
    b.push([0, 0, 0], [-PI / 2, 0, 0]);
    sprig(b, 'ochre', -0.13, 0.01, 0.12, -0.01, 9, 0.035, 0, 0.005);
    b.pop();
    b.pop();
  }

  // ===================================== FARM =====================================
  function wheelbarrow(b) {
    b.remap({ woodWarm: 'woodLight', woodLight: 'woodPale' });
    const W = [0, 0.2, 0.45];
    b.torus(0.18, 0.028, 6, 26, 'iron', W, [0, PI / 2, 0]);
    b.torus(0.148, 0.026, 6, 24, 'woodWarm', W, [0, PI / 2, 0]);
    b.cyl(0.045, 0.045, 0.12, 12, 'woodLight', W, [0, 0, PI / 2]);
    b.cyl(0.016, 0.016, 0.28, 6, 'iron', W, [0, 0, PI / 2]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2, c = Math.cos(a), s = Math.sin(a);
      b.stick([0, W[1] + s * 0.04, W[2] + c * 0.04], [0, W[1] + s * 0.135, W[2] + c * 0.135], 0.014, 'woodLight', 0.011, 5);
    }
    for (const s of [-1, 1]) {
      b.stick([s * 0.12, 0.19, 0.45], [s * 0.24, 0.56, -0.6], 0.032, 'woodWarm', 0.03, 7);
      b.stick([s * 0.24, 0.56, -0.6], [s * 0.25, 0.62, -0.7], 0.03, 'woodLight', 0.027, 7);
      b.sph(0.03, 8, 5, 'woodLight', [s * 0.25, 0.625, -0.705]);
      b.stick([s * 0.205, 0.45, -0.33], [s * 0.22, 0.0, -0.37], 0.027, 'woodWarm', 0.024, 6);
      b.box(0.06, 0.03, 0.08, 0.01, 'woodWarm', [s * 0.22, 0.015, -0.37]);
      b.stick([s * 0.155, 0.28, 0.17], [s * 0.17, 0.47, 0.15], 0.022, 'woodWarm');
      // splayed side planks: green lower board, plain upper board
      b.box(0.03, 0.12, 0.62, 0.012, 'greenPaint', [s * 0.25, 0.545, -0.09], [0, 0, -s * 0.22], 1, 2);
      b.box(0.03, 0.11, 0.66, 0.012, 'woodLight', [s * 0.277, 0.66, -0.09], [0, 0, -s * 0.22], 1, 2);
      for (const z of [-0.36, 0.17]) b.box(0.05, 0.26, 0.05, 0.012, 'woodWarm', [s * 0.265, 0.59, z], [0, 0, -s * 0.22]);
      for (const z of [-0.36, 0.17]) for (const y of [0.53, 0.66]) b.sph(0.011, 6, 4, 'iron', [s * (0.265 + (y - 0.59) * 0.22 + 0.027), y, z]);
    }
    b.box(0.46, 0.035, 0.6, 0.012, 'woodLight', [0, 0.47, -0.09]);
    b.box(0.52, 0.24, 0.03, 0.012, 'woodLight', [0, 0.6, -0.4], [-0.15, 0, 0]);
    b.box(0.54, 0.13, 0.03, 0.012, 'greenPaint', [0, 0.54, 0.24], [0.45, 0, 0]);
    b.box(0.58, 0.11, 0.03, 0.012, 'woodLight', [0, 0.65, 0.29], [0.45, 0, 0]);
  }

  function saddle(b) {
    b.remap({ woodWarm: 'woodLight', woodLight: 'woodPale' });
    b.box(0.86, 0.1, 0.12, 0.025, 'woodWarm', [0, 0.74, 0], [0, 0, 0], 1, 0);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) b.stick([sx * 0.34, 0.72, sz * 0.03], [sx * 0.4, 0, sz * 0.26], 0.034, 'woodWarm', 0.03, 6);
      b.box(0.05, 0.05, 0.4, 0.012, 'woodLight', [sx * 0.375, 0.28, 0]);
    }
    b.box(0.72, 0.05, 0.05, 0.012, 'woodLight', [0, 0.3, 0]);
    // fleece blanket with a green stripe
    b.box(0.6, 0.045, 0.36, 0.02, 'fleece', [0, 0.81, 0]);
    for (const s of [-1, 1]) {
      b.cyl(0.035, 0.035, 0.6, 10, 'fleece', [0, 0.795, s * 0.18], [0, 0, PI / 2]);
      b.box(0.6, 0.25, 0.045, 0.02, 'fleece', [0, 0.69, s * 0.2], [-s * 0.18, 0, 0]);
      b.cyl(0.03, 0.03, 0.6, 10, 'fleece', [0, 0.565, s * 0.222], [0, 0, PI / 2]);
      b.box(0.605, 0.035, 0.05, 0.012, 'greenPaint', [0, 0.615, s * 0.214], [-s * 0.18, 0, 0]);
    }
    // leather saddle: seat, high cantle, pommel, flaps, stirrups
    b.sph(1, 16, 8, 'leather', [0, 0.835, 0], [0, 0, 0], [0.29, 0.085, 0.2]);
    b.sph(1, 14, 7, 'leatherDark', [0.0, 0.875, 0], [0, 0, 0], [0.2, 0.04, 0.13]);
    // cantle (back, -X) sweeps up high; pommel (front, +X) is a lower rolled arch
    b.push([-0.21, 0.86, 0], [0, 0, 0.5]);
    b.sph(1, 14, 8, 'leather', [0, 0.04, 0], [0, 0, 0], [0.055, 0.12, 0.165]);
    b.sph(1, 12, 6, 'leatherDark', [0, 0.15, 0], [0, 0, 0], [0.05, 0.03, 0.14]);
    b.pop();
    b.push([0.23, 0.86, 0], [0, 0, -0.45]);
    b.sph(1, 12, 7, 'leather', [0, 0.03, 0], [0, 0, 0], [0.06, 0.085, 0.13]);
    b.sph(1, 10, 6, 'leatherDark', [0, 0.1, 0], [0, 0, 0], [0.045, 0.03, 0.1]);
    b.pop();
    for (const s of [-1, 1]) {
      b.push([0.02, 0.71, s * 0.24], [-s * 0.2, 0, 0]);
      b.box(0.36, 0.3, 0.025, 0.12, 'leather', [0, 0, 0], [0, 0, 0], 2);
      b.box(0.24, 0.2, 0.012, 0.08, 'leatherDark', [-0.04, 0.02, s * 0.016], [0, 0, 0], 1);
      b.pop();
      b.box(0.05, 0.36, 0.014, 0.006, 'leatherDark', [0.03, 0.62, s * 0.272], [-s * 0.08, 0, 0]);
      b.torus(0.022, 0.006, 4, 10, 'brass', [0.03, 0.7, s * 0.282], [0, 0, 0]);
      b.torus(0.055, 0.011, 5, 16, 'brass', [0.03, 0.4, s * 0.287], [0, 0, 0]);
      b.box(0.11, 0.018, 0.045, 0.006, 'brass', [0.03, 0.35, s * 0.287]);
    }
  }

  function feedTrough(b) {
    b.remap({ woodWarm: 'woodLight', woodLight: 'woodPale' });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) b.box(0.07, 0.57, 0.07, 0.015, 'woodWarm', [sx * 0.46, 0.28, sz * 0.19], [-sz * 0.25, 0, 0], 1, 1);
      b.trap(0.27, 0.5, 0.29, 0.035, 'woodWarm', [sx * 0.505, 0.37, 0], [0, PI / 2, 0]);
      b.box(0.05, 0.05, 0.36, 0.012, 'woodLight', [sx * 0.46, 0.12, 0]);
    }
    b.box(1.0, 0.04, 0.26, 0.012, 'woodDark', [0, 0.235, 0]);
    for (const sz of [-1, 1]) {
      [0.28, 0.37, 0.46].forEach((y, i) => {
        b.box(1.04, 0.095, 0.03, 0.012, i < 2 ? 'greenPaint' : 'woodWarm', [0, y, sz * (0.145 + (y - 0.28) * 0.365)], [sz * 0.35, 0, 0], 1, 0);
      });
      b.box(1.1, 0.035, 0.085, 0.012, 'woodLight', [0, 0.52, sz * 0.225], [0, 0, 0], 1, 0);
      for (const sx of [-1, 1]) for (const y of [0.28, 0.37, 0.46]) b.sph(0.011, 6, 4, 'iron', [sx * 0.48, y, sz * (0.163 + (y - 0.28) * 0.365)]);
    }
  }

  function grainSack(b) {
    const SZ = 0.82;
    const prof = [[0, 0], [0.18, 0.0], [0.26, 0.03], [0.3, 0.1], [0.315, 0.22], [0.305, 0.38], [0.27, 0.5], [0.2, 0.58], [0.12, 0.63], [0.085, 0.66]];
    b.lathe(prof, 20, 'sack', [0, 0, 0], [0, 0, 0], [1, 1, SZ]);
    b.lathe([[0.085, 0.65], [0.078, 0.68], [0.095, 0.71], [0.14, 0.755], [0.16, 0.785], [0.13, 0.8], [0.06, 0.785], [0, 0.775]], 16, 'sack', [0, 0, 0], [0, 0, 0], [1, 1, 0.9]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2 + 0.3;
      b.sph(0.055, 8, 6, 'sack', [Math.cos(a) * 0.12, 0.775 + (i % 2) * 0.012, Math.sin(a) * 0.11], [0, -a, 0.4], [1, 0.7, 0.8]);
    }
    b.lathe([[0.318, 0.15], [0.323, 0.19], [0.318, 0.23]], 20, 'stripeGreen', [0, 0, 0], [0, 0, 0], [1, 1, SZ]);
    b.torus(0.083, 0.024, 6, 16, 'rope', [0, 0.67, 0], [PI / 2, 0, 0], [1, 0.9, 1]);
    b.sph(0.032, 8, 6, 'rope', [0.045, 0.665, 0.075]);
    b.tube([[0.05, 0.665, 0.08], [0.095, 0.6, 0.15], [0.12, 0.54, 0.205]], 0.016, 8, 5, 'rope');
    b.tube([[0.04, 0.665, 0.08], [0.03, 0.61, 0.14], [0.045, 0.56, 0.185]], 0.015, 8, 5, 'rope');
    b.sph(0.02, 6, 5, 'rope', [0.12, 0.535, 0.207]);
    b.sph(0.019, 6, 5, 'rope', [0.045, 0.555, 0.187]);
    // painted wheat ears on the front
    const rAt = (y) => (y < 0.22 ? 0.315 : y < 0.38 ? 0.315 - ((y - 0.22) / 0.16) * 0.01 : 0.305 - ((y - 0.38) / 0.12) * 0.035);
    const onSack = (x, y, sx, sy, a) => {
      const r = rAt(y), z = SZ * Math.sqrt(Math.max(0, r * r - x * x)) + 0.004;
      b.push([x, y, z], [0, Math.asin(Math.min(1, x / r)) * 0.8, 0]);
      b.blob('wheat', 0, 0, sx, sy, 0.008, a);
      b.pop();
    };
    for (const [x0, x1, lean] of [[-0.015, -0.075, 0.3], [0.01, 0.065, -0.3]]) {
      const pts = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4, x = x0 + (x1 - x0) * t * t, y = 0.2 + 0.3 * t;
        const r = rAt(y);
        pts.push([x, y, SZ * Math.sqrt(r * r - x * x) + 0.003]);
      }
      b.tube(pts, 0.006, 10, 3, 'wheat');
      for (let k = 0; k < 5; k++) {
        const t = 0.55 + k * 0.1, x = x0 + (x1 - x0) * t * t, y = 0.2 + 0.3 * t;
        for (const s of [-1, 1]) onSack(x + s * 0.018, y - 0.008, 0.014, 0.03, lean + s * 0.55);
      }
      onSack(x1 + (x1 - x0) * 0.1, 0.515, 0.013, 0.032, lean);
    }
  }

  function flourSacks(b) {
    const sacks = [[0.92, 0.3, 0.58, 0.15, 0.04, 0, 0], [0.86, 0.28, 0.54, 0.41, -0.08, -0.01, 0.01]];
    for (const [w, h, d, y, ry, x, z] of sacks) {
      b.push([x, y, z], [0, ry, 0]);
      const o = { pinch: 0.2, pow: 0.42, segX: 14, segZ: 9 };
      b.geo(pillowG(w, h, d, o), 'sackPale');
      for (const [x0, x1] of [[0.48, 0.56], [0.64, 0.72]]) b.geo(pillowG(w, h, d, { ...o, x0, x1, puff: 1.03 }), 'stripeGreen', [0, 0, 0], [0, 0, 0], [1, 1, 1.012]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.sph(0.035, 8, 5, 'sackPale', [sx * w * 0.52, 0, sz * d * 0.52], [0, 0, 0], [1.3, 0.55, 1.1]);
      b.pop();
    }
  }

  function breadBasket(b) {
    b.lathe([[0, 0.0], [0.2, 0.0], [0.24, 0.03], [0.29, 0.14], [0.31, 0.28]], 22, 'wicker');
    b.lathe([[0.3, 0.28], [0.285, 0.15], [0.235, 0.05], [0, 0.05]], 18, 'wickerDark');
    for (const [y, R, k] of [[0.065, 0.257, 'wickerDark'], [0.135, 0.296, 'wicker'], [0.205, 0.307, 'wickerDark']]) b.torus(R, 0.02, 5, 28, k, [0, y, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * PI * 2, c = Math.cos(a), s = Math.sin(a);
      b.stick([c * 0.235, 0.03, s * 0.235], [c * 0.31, 0.27, s * 0.31], 0.011, 'wickerDark', 0.011, 4);
    }
    b.torus(0.31, 0.036, 6, 30, 'wicker', [0, 0.29, 0], [PI / 2, 0, 0]);
    b.torus(0.31, 0.018, 4, 30, 'wickerDark', [0, 0.315, 0], [PI / 2, 0, 0]);
    b.push([0, 0.29, -0.03], [-0.38, 0, 0]);
    b.torus(0.29, 0.027, 6, 22, 'wicker', [0, 0, 0], [0, 0, 0], null, PI);
    b.torus(0.29, 0.013, 4, 22, 'wickerDark', [0, 0.018, 0.012], [0, 0, 0], null, PI);
    b.pop();
    // big scored round loaf
    b.sph(0.15, 14, 10, 'crust', [-0.09, 0.34, 0.05], [0, 0.3, 0], [1, 0.72, 0.95]);
    for (const [dx, a] of [[-0.035, 0.75], [0.035, 0.75], [-0.035, -0.75], [0.035, -0.75]]) {
      b.push([-0.09 + dx * Math.cos(a), 0.44, 0.05 + dx * Math.sin(a)], [0, a, 0]);
      b.sph(1, 6, 4, 'flour', [0, 0.003, 0], [0, 0, 0], [0.008, 0.012, 0.085]);
      b.pop();
    }
    b.sph(1, 8, 5, 'flour', [-0.1, 0.43, 0.04], [0, 0, 0], [0.08, 0.018, 0.075]);
    // baguette leaning out at the back right
    b.push([0.13, 0.4, -0.05], [-0.3, 0, -0.55]);
    b.sph(1, 12, 8, 'crustLight', [0, 0, 0], [0, 0, 0], [0.065, 0.26, 0.062]);
    for (const y of [-0.1, 0, 0.1]) b.sph(1, 6, 4, 'crust', [0, y, 0.054], [0, 0, 0.6], [0.035, 0.013, 0.012]);
    b.pop();
    b.sph(0.08, 10, 7, 'crustLight', [0.1, 0.33, 0.15], [0, 0, 0], [1, 0.75, 1]);
    b.sph(1, 6, 4, 'crust', [0.1, 0.39, 0.15], [0, 0.5, 0], [0.04, 0.012, 0.012]);
    b.sph(0.1, 10, 7, 'crust', [-0.03, 0.36, -0.15], [0, 0, 0], [1, 0.8, 1]);
  }

  function peelBarrel(b) {
    b.push([0.1, 0, -0.05]);
    const prof = [[0, 0], [0.22, 0.0], [0.22, 0.024], [0.264, 0.056], [0.296, 0.2], [0.312, 0.4], [0.296, 0.616], [0.256, 0.8], [0.232, 0.824]];
    b.lathe(prof, 22, 'woodWarm');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2 + 0.1;
      b.tube(prof.slice(3).map(([r, y]) => [Math.cos(a) * (r + 0.003), y, Math.sin(a) * (r + 0.003)]), 0.0045, 8, 3, 'woodDark');
    }
    for (const [y, R] of [[0.11, 0.282], [0.4, 0.315], [0.68, 0.285]]) {
      b.torus(R, 0.022, 6, 26, 'iron', [0, y, 0], [PI / 2, 0, 0]);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; b.sph(0.012, 6, 4, 'iron', [Math.cos(a) * (R + 0.02), y, Math.sin(a) * (R + 0.02)]); }
    }
    b.cyl(0.236, 0.236, 0.03, 20, 'woodLight', [0, 0.81, 0]);
    for (const z of [-0.08, 0, 0.08]) b.box(0.44 - Math.abs(z) * 1.5, 0.008, 0.008, 0.003, 'woodDark', [0, 0.826, z]);
    b.pop();
    // bread peel leaning on the barrel rim
    const B = new THREE.Vector3(-0.24, 0, 0.36), Tp = new THREE.Vector3(0.138, 1.26, 0.179);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Tp.clone().sub(B).normalize());
    b.push(B.toArray(), q);
    b.box(0.28, 0.4, 0.022, 0.03, 'peelWood', [0, 0.21, 0], [0, 0, 0], 2, 1);
    b.trap(0.24, 0.07, 0.12, 0.024, 'peelWood', [0, 0.47, 0]);
    b.stick([0, 0.52, 0], [0, 1.25, 0], 0.022, 'peelWood', 0.02, 8);
    b.torus(0.032, 0.015, 5, 12, 'peelWood', [0, 1.28, 0]);
    b.pop();
  }

  function chickenCrate(b) {
    b.remap({ woodWarm: 'woodLight', woodLight: 'woodPale' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(0.07, 0.22, 0.07, 0.015, 'woodWarm', [sx * 0.37, 0.11, sz * 0.31], [0, 0, 0], 1, 1);
      b.box(0.06, 0.54, 0.06, 0.015, 'woodWarm', [sx * 0.38, 0.5, sz * 0.32], [0, 0, 0], 1, 1);
    }
    b.box(0.84, 0.05, 0.72, 0.015, 'woodLight', [0, 0.215, 0], [0, 0, 0], 1, 0);
    b.box(0.88, 0.07, 0.045, 0.015, 'greenPaint', [0, 0.215, 0.37], [0, 0, 0], 1, 0);
    b.box(0.88, 0.07, 0.045, 0.015, 'greenPaint', [0, 0.215, -0.37], [0, 0, 0], 1, 0);
    for (const sx of [-1, 1]) {
      b.box(0.065, 0.065, 0.76, 0.015, 'greenPaint', [sx * 0.38, 0.775, 0], [0, 0, 0], 1, 2);
      for (const y of [0.3, 0.41]) b.box(0.03, 0.105, 0.62, 0.012, y > 0.35 ? 'woodWarm' : 'woodLight', [sx * 0.38, y, 0], [0, 0, 0], 1, 2);
      b.box(0.035, 0.045, 0.62, 0.012, 'woodWarm', [sx * 0.385, 0.48, 0], [0, 0, 0], 1, 2);
      for (const z of [-0.21, -0.07, 0.07, 0.21]) b.box(0.03, 0.26, 0.05, 0.01, 'woodLight', [sx * 0.38, 0.62, z], [0, 0, 0], 1, 1);
    }
    [0.3, 0.42, 0.54, 0.66].forEach((y, i) => b.box(0.72, 0.115, 0.03, 0.012, i % 2 ? 'woodWarm' : 'woodLight', [0, y, -0.335], [0, 0, (i % 2 ? 1 : -1) * 0.006], 1, 0));
    b.box(0.72, 0.09, 0.03, 0.012, 'woodLight', [0, 0.285, 0.335], [0, 0, 0], 1, 0);
    for (const x of [-0.27, -0.17, -0.07]) b.box(0.045, 0.42, 0.03, 0.01, 'woodLight', [x, 0.54, 0.335], [0, 0, 0], 1, 1);
    for (const sz of [-1, 1]) {
      b.box(0.8, 0.05, 0.04, 0.012, 'greenPaint', [0, 0.745, sz * 0.335], [0, 0, 0], 1, 0);
      b.box(0.04, 0.2, 0.035, 0.01, 'woodWarm', [0, 0.86, sz * 0.335], [0, 0, 0], 1, 1);
    }
    // two-sided plank roof, ridge along Z, gable to the front
    const ang = Math.atan2(0.26, 0.5), L = Math.hypot(0.5, 0.26);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const d = (i + 0.5) * (L / 3);
        b.box(0.2, 0.035, 0.86, 0.012, (i + (s > 0 ? 1 : 0)) % 2 ? 'greenLight' : 'greenPaint', [s * Math.cos(ang) * d, 0.995 - Math.sin(ang) * d + 0.005 * i, 0.005 * i * s], [0, 0, -s * (ang + (i - 1) * 0.015)], 1, 2);
      }
      for (const sz of [-1, 1]) b.box(L, 0.04, 0.04, 0.012, 'woodWarm', [s * Math.cos(ang) * L * 0.5, 0.975 - Math.sin(ang) * L * 0.5, sz * 0.36], [0, 0, -s * ang], 1, 0);
    }
    b.box(0.09, 0.05, 0.88, 0.015, 'woodLight', [0, 1.005, 0], [0, 0, 0], 1, 2);
  }

  function toolRack(b) {
    b.remap({ woodWarm: 'woodLight', woodLight: 'woodPale' });
    for (const sx of [-1, 1]) {
      b.box(0.1, 0.07, 0.46, 0.015, 'woodWarm', [sx * 0.46, 0.035, 0], [0, 0, 0], 1, 2);
      b.box(0.08, 1.24, 0.08, 0.018, 'woodWarm', [sx * 0.46, 0.66, 0], [0, 0, 0], 1, 1);
      b.box(0.1, 0.03, 0.1, 0.01, 'woodLight', [sx * 0.46, 1.295, 0]);
      for (const sz of [-1, 1]) b.stick([sx * 0.46, 0.06, sz * 0.19], [sx * 0.46, 0.34, sz * 0.04], 0.022, 'woodWarm');
      for (const y of [1.12, 0.16]) b.sph(0.016, 6, 4, 'iron', [sx * 0.46, y, 0.105]);
    }
    b.box(1.04, 0.08, 0.06, 0.015, 'woodLight', [0, 1.12, 0.07], [0, 0, 0], 1, 0);
    b.box(0.98, 0.06, 0.05, 0.015, 'woodLight', [0, 0.16, 0.065], [0, 0, 0], 1, 0);
    // pitchfork hanging tines down
    const fx = -0.17, fz = 0.135;
    b.stick([fx, 0.44, fz], [fx, 1.3, fz], 0.022, 'woodLight', 0.02, 8);
    b.torus(0.045, 0.012, 5, 14, 'woodLight', [fx, 1.35, fz]);
    b.cyl(0.026, 0.026, 0.06, 8, 'iron', [fx, 0.43, fz]);
    b.tube([[fx - 0.075, 0.37, fz], [fx - 0.06, 0.41, fz], [fx, 0.42, fz], [fx + 0.06, 0.41, fz], [fx + 0.075, 0.37, fz]], 0.012, 10, 5, 'iron');
    for (const dx of [-0.075, -0.025, 0.025, 0.075]) b.stick([fx + dx * 1.05, 0.05, fz + 0.035], [fx + dx, 0.375, fz], 0.004, 'iron', 0.01, 5);
    // rake hanging head up
    const rx = 0.2, rz = 0.135;
    b.stick([rx, 0.08, rz], [rx, 1.31, rz], 0.022, 'woodLight', 0.02, 8);
    b.box(0.36, 0.045, 0.045, 0.012, 'woodWarm', [rx, 1.33, rz], [0, 0, 0], 1, 0);
    for (const s of [-1, 1]) b.stick([rx, 1.24, rz], [rx + s * 0.11, 1.315, rz], 0.008, 'iron');
    for (let i = 0; i < 7; i++) b.stick([rx + (i - 3) * 0.05, 1.345, rz], [rx + (i - 3) * 0.05, 1.41, rz + 0.04], 0.007, 'iron', 0.005, 4);
  }

  function lanternStool(b) {
    b.remap({ woodWarm: 'woodLight', woodLight: 'woodPale' });
    b.cyl(0.21, 0.22, 0.07, 18, 'woodWarm', [0, 0.445, 0]);
    b.cyl(0.2, 0.2, 0.012, 18, 'greenPaint', [0, 0.484, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.stick([sx * 0.17, 0, sz * 0.17], [sx * 0.11, 0.42, sz * 0.11], 0.034, 'woodWarm', 0.03, 6);
    const r = 0.147;
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2, c = Math.cos(a), s = Math.sin(a);
      b.stick([c * r - s * r, 0.16, s * r + c * r], [c * r + s * r, 0.16, s * r - c * r], 0.016, 'woodLight');
    }
    // hurricane lantern
    b.push([0, 0.49, 0]);
    b.cyl(0.085, 0.09, 0.04, 16, 'rust', [0, 0.02, 0]);
    b.lathe([[0, 0.04], [0.088, 0.04], [0.096, 0.06], [0.09, 0.09], [0.06, 0.1], [0, 0.1]], 16, 'rust');
    b.lathe([[0.045, 0.1], [0.07, 0.13], [0.082, 0.18], [0.075, 0.23], [0.05, 0.26], [0.04, 0.27]], 16, 'lanternGlow');
    b.torus(0.084, 0.006, 4, 18, 'iron', [0, 0.18, 0], [PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4, c = Math.cos(a), s = Math.sin(a);
      b.tube([[c * 0.066, 0.11, s * 0.066], [c * 0.09, 0.18, s * 0.09], [c * 0.058, 0.255, s * 0.058]], 0.005, 6, 3, 'iron');
    }
    for (const sx of [-1, 1]) b.stick([sx * 0.1, 0.06, 0], [sx * 0.092, 0.3, 0], 0.01, 'rust');
    b.cyl(0.03, 0.098, 0.05, 16, 'rust', [0, 0.295, 0]);
    b.cyl(0.03, 0.03, 0.035, 10, 'rust', [0, 0.335, 0]);
    b.cyl(0.05, 0.05, 0.01, 12, 'rust', [0, 0.355, 0]);
    b.torus(0.098, 0.007, 4, 18, 'iron', [0, 0.3, 0], [0, 0, 0], null, PI);
    b.torus(0.022, 0.007, 4, 10, 'iron', [0, 0.39, 0]);
    b.pop();
  }

  // ===================================== table =====================================
  const DEFS = {
    armchair: ['Armchair', 0.55, 0.97, 'house', armchair],
    rocking_chair: ['Rocking Chair', 0.53, 1.08, 'house', rockingChair],
    grandfather_clock: ['Grandfather Clock', 0.3, 1.93, 'house', grandfatherClock],
    stove: ['Cast-Iron Stove', 0.4, 1.32, 'house', stove],
    laundry_basket: ['Laundry Basket', 0.49, 0.59, 'house', laundryBasket],
    cushion_pile: ['Cushion Pile', 0.42, 0.56, 'house', cushionPile],
    potted_fern: ['Potted Fern', 0.45, 0.99, 'house', pottedFern],
    chest: ['Storage Chest', 0.5, 0.69, 'house', chest],
    spinning_wheel: ['Spinning Wheel', 0.52, 1.04, 'house', spinningWheel],
    butter_churn: ['Butter Churn', 0.25, 1.18, 'house', butterChurn],
    lamp_table: ['Side Table & Lamp', 0.35, 1.08, 'house', lampTable],
    book_stack: ['Stack of Books', 0.28, 0.45, 'house', bookStack],
    wheelbarrow: ['Wheelbarrow', 0.72, 0.73, 'farm', wheelbarrow],
    saddle: ['Saddle on Stand', 0.46, 1.04, 'farm', saddle],
    feed_trough: ['Feed Trough', 0.57, 0.56, 'farm', feedTrough],
    grain_sack: ['Grain Sack', 0.33, 0.83, 'farm', grainSack],
    flour_sacks: ['Flour Sacks', 0.55, 0.55, 'farm', flourSacks],
    bread_basket: ['Bread Basket', 0.36, 0.61, 'farm', breadBasket],
    peel_barrel: ['Barrel & Bread Peel', 0.44, 1.29, 'farm', peelBarrel],
    chicken_crate: ['Chicken Coop', 0.55, 1.03, 'farm', chickenCrate],
    tool_rack: ['Tool Rack', 0.55, 1.41, 'farm', toolRack],
    lantern_stool: ['Lantern on Stool', 0.25, 0.91, 'farm', lanternStool],
  };

  function proto(id) {
    if (!protoCache.has(id)) {
      const b = makeBuilder();
      DEFS[id][4](b);
      protoCache.set(id, b.merge());
    }
    return protoCache.get(id);
  }
  function makeProp(id) {
    const group = new THREE.Group();
    group.name = id;
    for (const { geometry, material: m } of proto(id)) {
      const mesh = new THREE.Mesh(geometry, m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    group.userData.propId = id;
    return group;
  }

  const props = {};
  for (const [id, [label, radius, height, zone]] of Object.entries(DEFS)) props[id] = { label, radius, height, zone, build: () => makeProp(id) };
  return { props };
}
