/* Thatched cottage — hand-modelled in code from Codex's concept painting (assets/concepts/house_thatch.png), now enterable.
 * export buildHouse(THREE, opts) → THREE.Group 'thatch'. Origin = ground centre, front (door) faces +Z. Metres.
 * Cream plaster walls under a thick, rounded golden thatch: parametric roof shells covered in instanced hay tufts with
 * fat puffy bundles along every eave; an eyebrow dormer and a gabled dormer in the thatch, a curved bay window with
 * small panes, a sage round-top door under a climbing-rose arch, a stone chimney, stone steps, lavender and flowers.
 * Inside (hollow 0.25 m walls, 6.6 × 8 m): the bay-window parlour at the front (assets/interiors/thatch_living.png) and
 * the bedroom behind an arched doorway (thatch_bedroom.png). Everything above the rooms lives in the child group 'roof'.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

export function buildHouse(THREE, opts = {}) {
  const garden = opts.garden !== false;               // false = in-game: nothing that could pass for a hideable prop
  const W = 6.6, D = 8.0, H = 2.9, FRONT = D / 2;     // walls (hidden under the thatch above ~2.85)
  const T = 0.25, IX = W / 2 - T, IZ = FRONT - T, PT = 0.2, F = 0.05;   // wall thickness, inner half-sizes, partition z ∈ [-PT, 0], floor
  const tex = (name, rx = 1, ry = 1) => kitTex(THREE, name, rx, ry);
  const matCache = {};
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  const root = new THREE.Group();
  root.name = 'thatch';
  // everything above the rooms → one group the game hides while the player is inside
  const roofG = new THREE.Group(); roofG.name = 'roof'; roofG.userData.keep = true; root.add(roofG);
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const addR = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => add(mesh, x, y, z, rx, ry, rz, roofG);
  const rbox = (w, h, d, r, mat, seg = 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  let seed = Math.abs(Math.floor(opts.seed || 7)) % 2147483646 || 7;
  const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const pick = (arr) => arr[Math.floor(rr() * arr.length)];
  // turn a geometry inside out (wall linings, window views seen from inside)
  const flip = (g) => {
    const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    return g;
  };

  // ---------------- materials (painted kit textures, light tints)
  const plaster = M(opts.wall || 0xfff4dc, tex('plaster', 1.6, 0.8));
  const innerPlaster = M(0xfff1da, tex('plaster', 0.4, 0.4));
  const stone = M(0xe6e0d4, tex('stone', 0.6, 0.6));
  const stoneDark = M(0xc4b8a2, tex('stone', 0.8, 0.8));
  const thatchMat = M(0xfff2d6, tex('thatch', 1, 1));
  const soffitMat = M(0xb58c55, tex('hay', 2, 2));
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex('hay', 0.45, 0.5), roughness: 0.95, metalness: 0 });
  const sage = M(0xeef6e4, tex('painted_metal', 0.6, 0.6));
  const sageDark = M(0x9db594, tex('painted_metal', 0.6, 0.6));
  const timber = M(0xd6a26a, tex('wood_light', 0.6, 0.6));
  const timberDark = M(0x8a5a36, tex('wood_light', 0.5, 0.5));
  const glass = M(0x5d7783, null, { roughness: 0.85 });
  const view = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe2a8, emissiveIntensity: 0.55, roughness: 0.9, metalness: 0 });
  const curtain = M(0xfbf1df, tex('plaster', 0.5, 0.5));
  const iron = M(0x3b3530, null, { roughness: 0.85 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd894, emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.85, metalness: 0 });
  const terracotta = M(0xffd2b0, tex('terracotta', 1, 1));
  const floorMat = M(0xf4cf9c, tex('wood_light', 4.4, 5.4));
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });

  const leaves = [], blossoms = [], roses = [];        // { p, s?, r?, c?, roof? } — roof:true items go in the roof group
  const greens = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55];
  const colliders = [];
  const box = (x, z, w, d) => colliders.push({ x: +x.toFixed(3), z: +z.toFixed(3), w: +w.toFixed(3), d: +d.toFixed(3) });
  // cloth / crockery / books clutter: one instanced mesh per shape, tinted per instance
  const C = { box: [], soft: [], cyl: [], disc: [], sph: [] };
  const cl = (k, x, y, z, sx, sy, sz, c, ry = 0, rx = 0, rz = 0) => C[k].push([x, y, z, sx, sy, sz, c, rx, ry, rz]);
  const at = (gx, gz, ry) => (lx, lz) => [gx + lx * Math.cos(ry) + lz * Math.sin(ry), gz - lx * Math.sin(ry) + lz * Math.cos(ry)];

  // =====================================================================================================
  // Thatch shells. A shell is a rounded hip roof: at height-parameter t its plan is a superellipse of half-sizes
  // A(t) (x) and B(t) (z), both shrinking with s = 1 - t, while y rises as a parabola → steep puffy eave, soft round
  // ridge. `half` shells keep only the front half (z ≥ cz) — used as hoods over the bay and the dormers.
  // =====================================================================================================
  const sp = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);
  const shells = [];
  function makeShell(o) {
    const S = Object.assign({ cx: 0, cz: 0, L0: 0, n: 2.4, half: false, nu: 72, nv: 18 }, o);
    S.th0 = S.half ? -Math.PI / 2 : -Math.PI; S.th1 = S.half ? Math.PI / 2 : Math.PI;
    S.P = (u, t, out = new THREE.Vector3()) => {
      const th = S.th0 + u * (S.th1 - S.th0), s = Math.max(0, 1 - t);
      const A = S.L0 + (S.A0 - S.L0) * s, B = S.B0 * s;
      return out.set(S.cx + A * sp(Math.sin(th), 2 / S.n), S.y0 + S.h * (1 - s * s), S.cz + B * sp(Math.cos(th), 2 / S.n));
    };
    S.frame = (u, t) => {
      const e = 1e-3, p = S.P(u, t);
      const du = S.P(Math.min(1, u + e), t).sub(S.P(Math.max(0, u - e), t));
      const dt = S.P(u, Math.min(1, t + e)).sub(S.P(u, Math.max(0, t - e)));
      return { p, n: new THREE.Vector3().crossVectors(du, dt).normalize(), d: dt.negate().normalize() };
    };
    S.inside = (q, pad = 0) => {
      const k = (q.y - S.y0) / S.h; if (k < -0.02 || k > 1) return false;
      const s = Math.sqrt(Math.max(0, 1 - k)), A = S.L0 + (S.A0 - S.L0) * s + pad, B = S.B0 * s + pad;
      const dz = q.z - S.cz; if (S.half && dz < -pad) return false;
      return Math.pow(Math.abs(q.x - S.cx) / A, S.n) + Math.pow(Math.abs(dz) / B, S.n) < 1;
    };
    // mesh: a (u,t) grid wound so faces point outward; thatch streaks run down the slope
    const per = 2 * (S.A0 + S.B0) * (S.half ? 1 : 2), slope = Math.hypot(S.B0, S.h);
    const pos = [], uv = [], idx = [], q = new THREE.Vector3();
    for (let j = 0; j <= S.nv; j++) for (let i = 0; i <= S.nu; i++) {
      S.P(i / S.nu, j / S.nv, q); pos.push(q.x, q.y, q.z); uv.push((i / S.nu) * per / 1.3, (j / S.nv) * slope / 1.3);
    }
    for (let j = 0; j < S.nv; j++) for (let i = 0; i < S.nu; i++) {
      const a = j * (S.nu + 1) + i; idx.push(a, a + 1, a + S.nu + 2, a, a + S.nu + 2, a + S.nu + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    addR(new THREE.Mesh(g, thatchMat));
    // soffit: flat underside at the eave so nobody sees sky through the roof from below (the main one is the ceiling)
    const sh = new THREE.Shape();
    const N = 64;
    for (let i = 0; i <= N; i++) { S.P(i / N, 0, q); const x = S.cx + (q.x - S.cx) * 0.97, z = S.cz + (q.z - S.cz) * 0.97; i ? sh.lineTo(x, z) : sh.moveTo(x, z); }
    if (S.half) sh.lineTo(S.cx, S.cz);
    const sg = new THREE.ShapeGeometry(sh); sg.rotateX(Math.PI / 2);
    addR(new THREE.Mesh(sg, soffitMat), 0, S.y0 + 0.03, 0);
    shells.push(S);
    return S;
  }

  // main roof over the whole house, eave at 2.85 m, ridge ≈ 6.45 m (taller than before so the deeper house keeps its steep, puffy front slope)
  const main = makeShell({ y0: 2.85, h: 3.6, A0: W / 2 + 0.6, B0: D / 2 + 0.6, L0: 1.75, n: 3.0, nu: 104, nv: 24 });
  // bay hood: a low half dome over the curved bay window
  const bayX = -1.3, bayR = 1.3, bayCZ = FRONT - 0.35;
  const bayHood = makeShell({ cx: bayX, cz: bayCZ, y0: 2.3, h: 1.2, A0: bayR + 0.45, B0: bayR + 0.32, n: 2.1, half: true, nu: 40, nv: 12 });
  // gabled dormer above the door and the eyebrow dormer above the bay — their hoods merge back into the main thatch
  const doorX = 1.55;
  const dormHood = makeShell({ cx: doorX, cz: FRONT - 1.6, y0: 4.55, h: 0.85, A0: 1.05, B0: 2.45, n: 2.2, half: true, nu: 36, nv: 12 });
  const browX = -1.3;
  const browHood = makeShell({ cx: browX, cz: FRONT - 0.8, y0: 4.2, h: 0.6, A0: 0.82, B0: 1.6, n: 2.0, half: true, nu: 30, nv: 10 });
  const chimney = { x: -W / 2 + 0.75, z: 0.0, r: 0.6, top: 7.35 };

  // ---------------- instanced hay tufts in overlapping courses + fat bundles along the eaves
  const tufts = [];
  {
    const mtx = new THREE.Matrix4(), X = new THREE.Vector3(), sc = new THREE.Vector3();
    const tuftPal = [0xffffff, 0xfffaf0, 0xfff3de, 0xfcebd0, 0xfffdf8, 0xf6e4c4].map((h) => new THREE.Color(h));
    const blocked = (S, q) => {
      if (Math.abs(q.x - chimney.x) < chimney.r && Math.abs(q.z - chimney.z) < chimney.r) return true;
      for (const o of shells) if (o !== S && o.inside(q, S === main ? 0.12 : 0)) return true;
      return false;
    };
    const push = (S, u, t, w, th, l, shift, lift, light) => {
      const { p, n, d } = S.frame(u, t);
      const probe = p.clone().addScaledVector(n, lift);
      if (blocked(S, probe)) return;
      d.addScaledVector(n, -d.dot(n)).normalize().applyAxisAngle(n, jr(-0.2, 0.2));
      X.crossVectors(n, d);
      mtx.makeBasis(X, n, d).scale(sc.set(w * jr(0.85, 1.15), th * jr(0.8, 1.2), l * jr(0.85, 1.15)));
      mtx.setPosition(p.addScaledVector(n, lift).addScaledVector(d, shift));
      const c = tuftPal[Math.floor(rr() * tuftPal.length)].clone().offsetHSL(0, jr(-0.03, 0.03), jr(-0.04, light ? 0.05 : 0.02));
      tufts.push([mtx.clone(), c]);
    };
    const coverShell = (S, rowGap, colGap, w, th, l, tMax) => {
      const q0 = new THREE.Vector3(), q1 = new THREE.Vector3();
      const NS = 160, cum = new Float32Array(NS + 1);
      let t = 0.07, row = 0;
      while (t < tMax) {
        // arc length around this course
        S.P(0, t, q0);
        for (let i = 1; i <= NS; i++) { S.P(i / NS, t, q1); cum[i] = cum[i - 1] + q1.distanceTo(q0); q0.copy(q1); }
        const len = cum[NS], count = Math.max(2, Math.round(len / colGap)), off = (row % 2) * 0.5;
        for (let k = 0; k < count; k++) {
          const target = ((k + off + jr(-0.18, 0.18) + (S.half ? 0.25 : 0)) / count) * len;
          let lo = 0, hi = NS;
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; cum[mid] < target ? (lo = mid) : (hi = mid); }
          const u = Math.min(1, Math.max(0, (lo + (target - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo])) / NS));
          push(S, u, Math.min(0.97, t + jr(-0.01, 0.01)), w, th, l, -0.15 * l, 0.02, false);
        }
        // step up the slope by ~rowGap of surface distance (measured at the front)
        S.P(0.5, t, q0); S.P(0.5, t + 0.01, q1);
        t += 0.01 * rowGap / Math.max(1e-4, q1.distanceTo(q0)); row++;
      }
      // puffy eave: two staggered rows of fat rounded bundles hanging over the edge
      for (const [tt, ww, hh, ll, gap] of [[0.0, 0.3, 0.22, 0.3, 0.34], [0.05, 0.28, 0.14, 0.32, 0.36]]) {
        S.P(0, tt, q0); let len = 0;
        for (let i = 1; i <= NS; i++) { S.P(i / NS, tt, q1); len += q1.distanceTo(q0); q0.copy(q1); }
        const count = Math.round(len / gap * (S === main ? 1 : 1.15));
        for (let k = 0; k < count; k++) push(S, (k + (tt ? 0.5 : 0) + jr(-0.1, 0.1) + (S.half ? 0.3 : 0)) / (count + (S.half ? 0.6 : 0)), tt, ww, hh, ll, -0.7 * ll, 0.06, true);
      }
    };
    coverShell(main, 0.4, 0.44, 0.33, 0.065, 0.4, 0.93);
    coverShell(bayHood, 0.32, 0.36, 0.27, 0.06, 0.32, 0.85);
    coverShell(dormHood, 0.32, 0.36, 0.27, 0.06, 0.32, 0.85);
    coverShell(browHood, 0.3, 0.33, 0.25, 0.06, 0.3, 0.85);
    // tuft = a squashed sphere pushed towards a squircle (blunt cut ends like a straw bundle), poles along the slope
    // so the straw streaks run downhill, a little fuller at its lower end
    const tg = new THREE.SphereGeometry(1, 7, 5); tg.rotateX(Math.PI / 2);
    const pa = tg.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = sp(pa.getX(i), 0.55), z = sp(pa.getZ(i), 0.6);
      pa.setX(i, x * (0.8 + 0.2 * (z + 1) / 2)); pa.setZ(i, z + 0.8);
    }
    tg.computeVertexNormals();
    const im = new THREE.InstancedMesh(tg, tuftMat, tufts.length);
    tufts.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); });
    im.castShadow = true; im.receiveShadow = true; im.name = 'thatch_tufts'; roofG.add(im);
  }

  // ---------------- hollow wall: door notches + window holes, outer face at local z = 0, inner face at z = -th,
  // local x along the wall. Returns its group (windows are built in it) and records the wall colliders.
  function wall(cx, cz, rotY, L, th, opens, outMat, inMat) {
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rotY; root.add(g);
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
      p.moveTo(o.u - r, o.y0); p.lineTo(o.u + r, o.y0);
      if (o.arch) { p.lineTo(o.u + r, top - r); p.absarc(o.u, top - r, r, 0, Math.PI, false); } else { p.lineTo(o.u + r, top); p.lineTo(o.u - r, top); }
      p.lineTo(o.u - r, o.y0); s.holes.push(p);
    }
    const eg = new THREE.ExtrudeGeometry(s, { depth: th - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 12 });
    eg.translate(0, 0, -th + 0.04);
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
  const DW = 1.4, DH = 2.22, bayHalf = bayR * Math.sin((65 * Math.PI) / 180);
  const frontW = wall(0, FRONT, 0, W, T, [{ u: doorX, w: DW, h: DH, door: true, arch: true }, { u: bayX, y0: 0.45, w: 2 * bayHalf + 0.02, h: 1.75 }], plaster, innerPlaster);
  const backW = wall(0, -FRONT, Math.PI, W, T, [{ u: 1.6, y0: 1.15, w: 0.8, h: 1.05, arch: true }, { u: -2.3, y0: 1.3, w: 0.6, h: 0.75 }], plaster, innerPlaster);
  const leftW = wall(-W / 2, 0, -Math.PI / 2, D - 2 * T, T, [{ u: 1.9, y0: 1.25, w: 0.7, h: 0.8 }], plaster, innerPlaster);
  const rightW = wall(W / 2, 0, Math.PI / 2, D - 2 * T, T, [{ u: -2.0, y0: 1.25, w: 0.7, h: 0.8 }, { u: 1.5, y0: 1.25, w: 0.7, h: 0.8 }], plaster, innerPlaster);
  const innerDoor = { x: 1.65, w: 1.3, h: 2.2 };
  wall(0, 0, 0, 2 * IX, PT, [{ u: innerDoor.x, w: innerDoor.w, h: innerDoor.h, door: true, arch: true }], innerPlaster, null);
  add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.05, D - 0.1), floorMat), 0, 0.025, 0);
  // stone plinth outside, with a few stones peeking through the plaster (outside and in)
  {
    const edges = [[-W / 2, FRONT, W / 2, FRONT], [-W / 2, -FRONT, W / 2, -FRONT], [-W / 2, -FRONT, -W / 2, FRONT], [W / 2, -FRONT, W / 2, FRONT]];
    for (const [ax, az, bx, bz] of edges) {
      const len = Math.hypot(bx - ax, bz - az), along = Math.atan2(bz - az, bx - ax);
      for (let course = 0; course < 2; course++) {
        let d = course * 0.2;
        while (d < len) {
          const sw = jr(0.32, 0.55), t = Math.min(len, d + sw / 2) / len;
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          d += sw;
          if (az === FRONT && bz === FRONT && (Math.abs(x - doorX) < 0.85 || Math.abs(x - bayX) < 1.15)) continue;
          const nx = Math.abs(bz - az) > 0 ? Math.sign(ax) * 0.07 : 0, nz = Math.abs(bx - ax) > 0 ? Math.sign(az) * 0.07 : 0;
          add(rbox(sw - 0.03, jr(0.2, 0.26), 0.2, 0.08, course ? stone : stoneDark, 1), x + nx, 0.12 + course * 0.23, z + nz, 0, -along, jr(-0.06, 0.06));
        }
      }
    }
    // stones peeking through the plaster (front & sides & back), like the painting
    const peeks = [[-3.15, 0.75, 'f'], [-2.9, 1.05, 'f'], [0.4, 0.7, 'f'], [0.25, 1.0, 'f'], [3.1, 0.8, 'f'], [2.85, 1.15, 'f'], [3.1, 1.9, 'f'],
      [-1.4, 0.8, 'l'], [-1.1, 1.1, 'l'], [-3.0, 0.9, 'l'], [1.2, 0.85, 'r'], [0.9, 1.15, 'r'], [-3.1, 0.8, 'r'], [-1.6, 0.8, 'b'], [0.3, 0.9, 'b'], [2.5, 0.75, 'b']];
    for (const [a, y, side] of peeks) {
      const s = rbox(jr(0.3, 0.42), jr(0.2, 0.27), 0.12, 0.08, stone, 1);
      if (side === 'f') add(s, a, y, FRONT + 0.02, 0, 0, jr(-0.15, 0.15));
      else if (side === 'b') add(s, a, y, -FRONT - 0.02, 0, 0, jr(-0.15, 0.15));
      else add(s, (side === 'l' ? -1 : 1) * (W / 2 + 0.02), y, a, 0, Math.PI / 2, jr(-0.15, 0.15));
    }
    // inside: stones showing through the warm plaster low on the walls (thatch_living.png)
    const ipeeks = [[-IX, 0.5], [-IX, 1.15], [-IX, -1.6], [IX, 0.4], [IX, -0.9], [IX, -2.8]];
    for (const [x, z] of ipeeks) for (let k = 0; k < 3; k++) add(rbox(0.1, jr(0.18, 0.26), jr(0.28, 0.4), 0.06, rr() < 0.5 ? stone : stoneDark, 1), x - Math.sign(x) * 0.02, jr(0.35, 1.6), z + jr(-0.35, 0.35), jr(-0.1, 0.1));
    for (const x of [-2.6, 2.55, -0.6]) for (let k = 0; k < 2; k++) add(rbox(jr(0.28, 0.4), jr(0.18, 0.26), 0.1, 0.06, rr() < 0.5 ? stone : stoneDark, 1), x + jr(-0.3, 0.3), jr(0.35, 1.5), -IZ + 0.02, 0, 0, jr(-0.1, 0.1));
    // dark rafter ends poking out under the eaves
    for (const x of [-2.6, 0.15, 2.6]) for (const sz of [-1, 1]) add(rbox(0.16, 0.16, 0.5, 0.04, timberDark, 1), x, 2.74, sz * (FRONT + 0.16));
    for (const x of [-1.55, -0.5, 0.6, 1.7]) add(rbox(0.16, 0.16, 0.5, 0.04, timberDark, 1), x, 2.74, -(FRONT + 0.16));
    for (const sx of [-1, 1]) for (const z of [-3.0, -1.5, 0, 1.5, 3.0]) add(rbox(0.5, 0.16, 0.16, 0.04, timberDark, 1), sx * (W / 2 + 0.16), 2.74, z);
    // inside: a dark wall-plate rail round every room just under the thatch, joists across (hidden with the roof)
    const rail = H - 0.14;
    for (const [z0, z1] of [[0, IZ], [-IZ, -PT]]) {
      add(rbox(2 * IX, 0.16, 0.14, 0.03, timberDark, 1), 0, rail, z0 + (z0 === 0 ? 0.07 : 0.07));
      add(rbox(2 * IX, 0.16, 0.14, 0.03, timberDark, 1), 0, rail, z1 - 0.07);
      for (const sx of [-1, 1]) add(rbox(0.14, 0.16, z1 - z0, 0.03, timberDark, 1), sx * (IX - 0.07), rail, (z0 + z1) / 2);
    }
    for (const z of [-2.9, -1.5, 0.9, 2.3, 3.4]) addR(rbox(2 * IX, 0.22, 0.22, 0.05, timberDark, 1), 0, H - 0.12, z);
  }

  // ---------------- small-paned window with optional sage shutters (built facing +z in its wall's frame):
  // real opening, glass outside, warm daylight pane + cream curtains + sill seen from inside
  function windowUnit(x, y, w, h, nShut, z, P = root, cols = 2, rows = 2, th = T, arch = false) {
    const fr = 0.08;
    const a = (m, px, py, pz) => add(m, px, py, pz, 0, 0, 0, P);
    const zg = z - 0.02 - th / 2;
    let pane;
    if (arch) { const r = w / 2, s = new THREE.Shape(); s.moveTo(-r, -h / 2); s.lineTo(r, -h / 2); s.lineTo(r, h / 2 - r); s.absarc(0, h / 2 - r, r, 0, Math.PI, false); s.lineTo(-r, -h / 2); pane = () => new THREE.ShapeGeometry(s, 10); } else pane = () => new THREE.PlaneGeometry(w, h);
    a(new THREE.Mesh(pane(), glass), x, y, zg + 0.012);
    a(new THREE.Mesh(flip(pane()), view), x, y, zg - 0.012);
    for (let i = 1; i < cols; i++) a(rbox(0.035, h - 0.04, 0.04, 0.012, timber, 1), x - w / 2 + (i * w) / cols, y - 0.02, zg - 0.035);
    for (let i = 1; i < rows; i++) a(rbox(w, 0.035, 0.04, 0.012, timber, 1), x, y - h / 2 + (i * h) / rows, zg - 0.035);
    a(rbox(w + 0.24, 0.06, 0.22, 0.02, timber, 1), x, y - h / 2 - 0.03, z - 0.02 - th - 0.07);                  // inner sill
    for (const s of [-1, 1]) a(rbox(w * 0.3, h + 0.1, 0.025, 0.01, curtain, 1), x + s * (w / 2 + 0.02), y + 0.02, z - th - 0.06);
    if (arch) {
      a(new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.04, 0.05, 6, 16, Math.PI), timber), x, y + h / 2 - w / 2, z + 0.05);
      for (const s of [-1, 1]) a(rbox(fr, h - w / 2, 0.14, 0.03, timber, 1), x + s * (w / 2 + fr / 2), y - w / 4, z + 0.03);
    } else {
      a(rbox(w + fr * 2, fr, 0.14, 0.03, timber, 1), x, y + h / 2 + fr / 2, z + 0.03);
      for (const s of [-1, 1]) a(rbox(fr, h, 0.14, 0.03, timber, 1), x + s * (w / 2 + fr / 2), y, z + 0.03);
    }
    a(rbox(w + fr * 2.8, fr * 1.4, 0.24, 0.03, timber, 1), x, y - h / 2 - fr * 0.6, z + 0.08);
    for (let i = 1; i < cols; i++) a(rbox(0.04, h, 0.07, 0.015, timber, 1), x - w / 2 + (i * w) / cols, y, z + 0.05);
    for (let i = 1; i < rows; i++) a(rbox(w, 0.04, 0.07, 0.015, timber, 1), x, y - h / 2 + (i * h) / rows, z + 0.05);
    const shutters = nShut === 2 ? [-1, 1] : nShut === -1 ? [-1] : nShut === 1 ? [1] : [];
    for (const s of shutters) {
      const sw = w * 0.55, g = new THREE.Group();
      for (let k = 0; k < 3; k++) add(rbox(sw / 3 - 0.012, h + 0.06, 0.05, 0.012, sage, 1), (k - 1) * (sw / 3), 0, 0, 0, 0, 0, g);
      for (const yy of [0.28, -0.28]) add(rbox(sw * 0.9, 0.07, 0.03, 0.01, sageDark, 1), 0, h * yy, 0.035, 0, 0, 0, g);
      g.position.set(x + s * (w / 2 + fr + sw / 2 + 0.02), y, z + 0.06); g.rotation.y = -s * 0.2;
      P.add(g);
    }
  }
  windowUnit(1.9, 1.65, 0.7, 0.8, 2, 0.02, leftW);                       // parlour, over the lace table
  windowUnit(-2.0, 1.65, 0.7, 0.8, 2, 0.02, rightW);                     // parlour, over the bench
  windowUnit(1.5, 1.65, 0.7, 0.8, 2, 0.02, rightW);                      // bedroom side window
  windowUnit(1.6, 1.675, 0.8, 1.05, 2, 0.02, backW, 2, 3, T, true);       // bedroom: arched window behind the bed
  windowUnit(-2.3, 1.675, 0.6, 0.75, 0, 0.02, backW);                    // bedroom: small window over the sewing bench

  // ---------------- curved bay window: a window-seat nook behind five flat facets of small panes on a stone base
  {
    const facets = 5, span = (130 * Math.PI) / 180, th0 = -span / 2, dth = span / facets;
    const yb = 0.85, yt = 2.2, gh = yt - yb, seatY = 0.45;
    // flat plan shapes (x, z) extruded upwards between y0 and y1
    const slab = (pts, y0, y1, mat) => {
      const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
      const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2);
      return add(new THREE.Mesh(g, mat), 0, y0, 0);
    };
    const arc = (r, n = 20) => Array.from({ length: n + 1 }, (_, i) => { const a = th0 + (i / n) * span; return [bayX + Math.sin(a) * r, bayCZ + Math.cos(a) * r]; });
    const ring = (r0, r1, y0, y1, mat) => slab([...arc(r1), ...arc(r0).reverse()], y0, y1, mat);
    // seat block filling the bay from the inner wall face out to the glass, sage plank front, long cushion on top
    slab([[bayX - bayHalf - 0.01, IZ], ...arc(bayR - 0.05), [bayX + bayHalf + 0.01, IZ]], 0, seatY, stoneDark);
    add(rbox(2 * bayHalf - 0.04, seatY - 0.06, 0.06, 0.02, sage, 1), bayX, (seatY - 0.06) / 2 + 0.03, IZ - 0.02);
    for (let k = -4; k <= 4; k++) add(rbox(0.02, seatY - 0.12, 0.02, 0.006, sageDark, 1), bayX + k * 0.25, seatY / 2, IZ - 0.055);
    slab([[bayX - bayHalf + 0.02, IZ - 0.06], ...arc(bayR - 0.16), [bayX + bayHalf - 0.02, IZ - 0.06]], seatY, seatY + 0.1, curtain);
    ring(bayR - 0.14, bayR - 0.04, seatY, yb, innerPlaster);                                        // low inner wall under the glass
    add(new THREE.Mesh(new THREE.CylinderGeometry(bayR - 0.04, bayR - 0.04, gh, facets, 1, true, th0, span), glass), bayX, yb + gh / 2, bayCZ);
    add(new THREE.Mesh(flip(new THREE.CylinderGeometry(bayR - 0.07, bayR - 0.07, gh, facets, 1, true, th0, span)), view), bayX, yb + gh / 2, bayCZ);
    ring(bayR - 0.16, bayR + 0.1, yb - 0.05, yb + 0.05, sage);                                       // sill (outside) / sill shelf (inside)
    ring(bayR - 0.2, bayR + 0.06, yt, yt + 0.18, timber);                                           // head beam
    // stones round the base: two courses of rounded stones following the curve
    for (let course = 0; course < 2; course++) {
      const n = 9 + course;
      for (let i = 0; i < n; i++) {
        const a = th0 + ((i + 0.5 + course * 0.3) / n) * span * 0.99;
        add(rbox(jr(0.36, 0.44), jr(0.3, 0.36), 0.2, 0.09, course ? stone : stoneDark, 1), bayX + Math.sin(a) * (bayR + 0.02), 0.18 + course * 0.38, bayCZ + Math.cos(a) * (bayR + 0.02), 0, a, jr(-0.08, 0.08));
      }
    }
    const rf = bayR * Math.cos(dth / 2), fw = 2 * bayR * Math.sin(dth / 2);
    for (let k = 0; k <= facets; k++) {                                                             // posts at facet edges
      const a = th0 + k * dth;
      add(rbox(0.11, gh, 0.12, 0.03, timber, 1), bayX + Math.sin(a) * bayR, yb + gh / 2, bayCZ + Math.cos(a) * bayR, 0, a, 0);
    }
    for (let k = 0; k < facets; k++) {                                                              // muntins → small panes
      const a = th0 + (k + 0.5) * dth, fx = bayX + Math.sin(a) * (rf + 0.01), fz = bayCZ + Math.cos(a) * (rf + 0.01);
      add(rbox(0.035, gh, 0.06, 0.012, timber, 1), fx, yb + gh / 2, fz, 0, a, 0);
      for (const y of [1.3, 1.75, 1.98]) add(rbox(fw, y === 1.98 ? 0.06 : 0.035, 0.06, 0.012, timber, 1), fx, y, fz, 0, a, 0);
      // inner glazing bars, so the panes read from inside too
      const ix = bayX + Math.sin(a) * (rf - 0.1), iz = bayCZ + Math.cos(a) * (rf - 0.1);
      add(rbox(0.03, gh, 0.03, 0.01, timber, 1), ix, yb + gh / 2, iz, 0, a, 0);
      add(rbox(fw, 0.03, 0.03, 0.01, timber, 1), ix, 1.6, iz, 0, a, 0);
    }
    // cream curtains tied back at both ends of the bay, inside the glass
    for (const s of [-1, 1]) {
      const a = s * (span / 2 - dth * 0.35), r = bayR - 0.2;
      add(rbox(0.36, gh + 0.2, 0.05, 0.02, curtain, 1), bayX + Math.sin(a) * r, yb + gh / 2 - 0.05, bayCZ + Math.cos(a) * r, 0, a, 0);
      add(rbox(0.38, 0.06, 0.08, 0.02, sage, 1), bayX + Math.sin(a) * r, yb + 0.55, bayCZ + Math.cos(a) * r, 0, a, 0);
    }
    add(rbox(2 * bayHalf + 0.3, 0.1, 0.1, 0.03, timber, 1), bayX, yt + 0.25, IZ - 0.08);           // curtain pole across the nook
    // plaster cheeks closing the bay back to the wall
    for (const s of [-1, 1]) {
      const a = s * span / 2;
      add(rbox(0.22, yt + 0.15, 0.3, 0.05, plaster, 1), bayX + Math.sin(a) * bayR - s * 0.04, (yt + 0.15) / 2, bayCZ + Math.cos(a) * bayR - 0.06);
    }
    // cushions on the window seat (floral, mustard, rose — thatch_living.png)
    for (const [dx, c, ry] of [[-0.75, 0xfbf3e3, 0.5], [-0.35, 0xf2c14e, 0.2], [0.35, 0xea9a86, -0.2], [0.75, 0xfbf3e3, -0.5]]) {
      const a = Math.atan2(dx, 1), r = bayR - 0.35;
      cl('soft', bayX + Math.sin(a) * r * 1.15, seatY + 0.3, bayCZ + Math.cos(a) * r, 0.42, 0.38, 0.13, c, ry, -0.25);
    }
    for (let k = 0; k < 6; k++) blossoms.push({ p: [bayX - 0.85 + jr(-0.06, 0.06), seatY + 0.32 + jr(-0.06, 0.06), bayCZ + 0.62 + jr(-0.02, 0.02)], s: 0.7, c: pick([0xf06a8a, 0x8fae6a]) });
    box(bayX, IZ + 0.4, 2 * bayHalf, 0.8);
  }

  // ---------------- gabled dormer above the door: plaster face, shuttered window, thatch hood (all roof group)
  addR(rbox(1.5, 1.75, 1.4, 0.1, plaster), doorX, 2.875 + 0.875, FRONT - 0.1);
  {
    const g = new THREE.Group(); roofG.add(g);
    windowUnit(doorX, 3.75, 0.62, 0.66, 2, FRONT + 0.65, g, 2, 2, 0.04);
  }
  // ---------------- eyebrow dormer above the bay: arched window peeping out of the thatch
  {
    addR(rbox(1.04, 1.1, 1.2, 0.1, plaster), browX, 3.75, FRONT);
    const w = 0.62, rh = 0.32, r = w / 2, z = FRONT + 0.61, yb = 3.42;
    const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, rh); s.absarc(0, rh, r, 0, Math.PI, false); s.lineTo(-r, 0);
    addR(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), glass), browX, yb, z);
    addR(new THREE.Mesh(new THREE.TorusGeometry(r + 0.04, 0.05, 6, 16, Math.PI), timber), browX, yb + rh, z + 0.05);
    for (const sx of [-1, 1]) addR(rbox(0.09, rh + 0.02, 0.1, 0.03, timber, 1), browX + sx * (r + 0.04), yb + rh / 2, z + 0.05);
    addR(rbox(0.035, rh + r, 0.06, 0.012, timber, 1), browX, yb + (rh + r) / 2, z + 0.06);
    addR(rbox(w, 0.035, 0.06, 0.012, timber, 1), browX, yb + rh, z + 0.06);
    addR(rbox(w + 0.26, 0.1, 0.2, 0.03, timber, 1), browX, yb - 0.04, z + 0.08);
  }

  // ---------------- chimney: a stack of big rounded stones rising through the thatch at the left end (roof group)
  {
    const { x: cx, z: cz, top } = chimney;
    addR(rbox(0.95, top - 3.4, 0.95, 0.08, M(0xd9cfbd, tex('stone', 0.9, 2.4))), cx, (top + 3.4) / 2, cz);
    for (let y = 5.2, c = 0; y < top - 0.2; y += 0.34, c++) {
      for (let sd = 0; sd < 4; sd++) {
        const a = (sd * Math.PI) / 2, n = 2;
        for (let i = 0; i < n; i++) {
          const along = ((i + 0.5 + (c % 2) * 0.25) / n - 0.5) * 0.92;
          const px = cx + Math.cos(a) * 0.5 - Math.sin(a) * along, pz = cz + Math.sin(a) * 0.5 + Math.cos(a) * along;
          addR(rbox(jr(0.4, 0.5), jr(0.28, 0.34), 0.16, 0.08, rr() < 0.5 ? stone : stoneDark, 1), px, y + jr(-0.02, 0.02), pz, 0, -a + Math.PI / 2, jr(-0.06, 0.06));
        }
      }
    }
    addR(rbox(1.25, 0.18, 1.25, 0.06, stoneDark), cx, top + 0.05, cz);
    for (const dx of [-0.2, 0.22]) {
      addR(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.4, 10), terracotta), cx + dx, top + 0.33, cz + jr(-0.08, 0.08));
      addR(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 12), terracotta), cx + dx, top + 0.53, cz, Math.PI / 2);
    }
  }

  // ---------------- round-top doorway in a stone arch; the sage door stands open into the parlour + stone steps
  {
    const r = DW / 2, dh = DH - r;
    const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, dh); s.absarc(0, dh, r, 0, Math.PI, false); s.lineTo(-r, 0);
    const leaf = new THREE.Group();
    const a = (m, x, y, z, rx = 0, ry = 0, rz = 0) => add(m, x, y, z, rx, ry, rz, leaf);
    a(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }), sage), 0, 0, 0);
    for (let k = -2; k <= 2; k++) a(rbox(0.025, dh + r * 0.85 - Math.abs(k) * 0.08, 0.02, 0.008, sageDark, 1), k * 0.22, (dh + r * 0.85 - Math.abs(k) * 0.08) / 2, 0.1);
    for (const y of [0.4, 1.2]) a(rbox(DW * 0.9, 0.06, 0.03, 0.015, iron, 1), 0, y, 0.11);
    a(new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), glass), 0, 1.6, 0.105);
    a(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 16), timber), 0, 1.6, 0.11);
    a(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 14), iron), -0.42, 0.95, 0.13);
    // hinged on the right jamb, swung ~95° into the room
    const hx = doorX + r, hz = IZ - 0.04, ang = -(Math.PI / 2 + 0.08);
    leaf.rotation.y = ang; leaf.position.set(hx - Math.cos(ang) * r, F, hz + Math.sin(ang) * r); root.add(leaf);
    box(hx + 0.02, IZ - r, 0.14, DW);
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const aa = (i / n) * Math.PI, rad = r + 0.17;
      add(rbox(0.24, 0.22, 0.24, 0.07, stone, 1), doorX + Math.cos(aa) * rad, dh + Math.sin(aa) * rad, FRONT + 0.05, 0, 0, aa - Math.PI / 2);
    }
    for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) {
      const wide = j % 2 === 0;
      add(rbox(wide ? 0.32 : 0.24, 0.34, 0.24, 0.07, stone, 1), doorX + sx * (r + (wide ? 0.2 : 0.16)), 0.19 + j * 0.37, FRONT + 0.05);
    }
    add(rbox(DW + 0.06, 0.06, T + 0.1, 0.02, stone, 1), doorX, 0.03, FRONT - T / 2);               // threshold
    add(rbox(1.7, 0.08, 0.7, 0.05, stoneDark), doorX, 0.04, FRONT + 0.36);                          // low step
    for (const sx of [-1, 1]) add(rbox(0.36, 0.14, 0.3, 0.06, stone, 1), doorX + sx * 0.72, 0.07, FRONT + 0.6, 0, jr(-0.2, 0.2), 0);
  }

  // ---------------- iron wall lantern right of the door
  {
    const lx = doorX + 1.3, ly = 2.2, z = FRONT;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14, Math.PI / 2), iron), lx - 0.02, ly + 0.08, z + 0.16, 0, Math.PI / 2, 0);
    add(rbox(0.2, 0.28, 0.2, 0.03, glow, 1), lx + 0.02, ly - 0.08, z + 0.32);
    add(rbox(0.26, 0.05, 0.26, 0.02, iron, 1), lx + 0.02, ly + 0.08, z + 0.32);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 4), iron), lx + 0.02, ly + 0.18, z + 0.32, 0, Math.PI / 4, 0);
    add(rbox(0.22, 0.04, 0.22, 0.02, iron, 1), lx + 0.02, ly - 0.24, z + 0.32);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffb45a, 1.2, 4, 2); pl.position.set(lx + 0.02, ly - 0.1, z + 0.5); root.add(pl); }
  }

  // ---------------- climbing-rose arch over the door
  {
    const z = FRONT + 0.3, hw = 1.0, cy = 1.95;
    const pts = [];
    for (let y = 0; y <= cy; y += 0.3) pts.push(new THREE.Vector3(doorX - hw, y, z));
    for (let i = 1; i < 12; i++) { const a = Math.PI - (i / 12) * Math.PI; pts.push(new THREE.Vector3(doorX + Math.cos(a) * hw, cy + Math.sin(a) * hw, z)); }
    for (let y = cy; y >= 0; y -= 0.3) pts.push(new THREE.Vector3(doorX + hw, y, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.035, 5), timberDark));
    const p = new THREE.Vector3();
    for (let i = 0; i < 300; i++) {
      curve.getPointAt(rr(), p);
      leaves.push({ p: [p.x + jr(-0.17, 0.17), p.y + jr(-0.14, 0.14), z + jr(-0.12, 0.16)], s: jr(0.75, 1.3) });
    }
    for (let i = 0; i < 64; i++) {
      curve.getPointAt(Math.min(1, Math.max(0, jr(0.04, 0.96))), p);
      roses.push({ p: [p.x + jr(-0.15, 0.15), p.y + jr(-0.1, 0.12), z + jr(0.02, 0.2)], s: jr(0.8, 1.25), c: pick([0xf06a8a, 0xf48fb1, 0xe2557e, 0xffb3c6, 0xf37d9c]) });
    }
    // the rose spills along the wall towards the lantern and under the dormer
    for (let i = 0; i < 70; i++) leaves.push({ p: [doorX + jr(-0.9, 0.95), jr(2.4, 2.78), FRONT + jr(0.04, 0.2)], s: jr(0.7, 1.15) });
    for (let i = 0; i < 12; i++) roses.push({ p: [doorX + jr(-0.85, 0.9), jr(2.45, 2.78), FRONT + jr(0.1, 0.22)], s: jr(0.7, 1.05), c: pick([0xf06a8a, 0xf48fb1, 0xffb3c6]) });
    // rose bush at the right of the steps (planted, so it stays in-game)
    for (let i = 0; i < 70; i++) leaves.push({ p: [doorX + 1.3 + jr(-0.4, 0.4), jr(0.08, 0.95), FRONT + 0.4 + jr(-0.25, 0.3)], s: jr(0.8, 1.3) });
    for (let i = 0; i < 16; i++) roses.push({ p: [doorX + 1.3 + jr(-0.38, 0.38), jr(0.45, 1.05), FRONT + 0.45 + jr(-0.15, 0.32)], s: jr(0.8, 1.2), c: pick([0xf48fb1, 0xffb3c6, 0xf06a8a]) });
  }

  // ---------------- flower boxes, lavender and flower beds (planted → fine in-game)
  const dz = FRONT - 2.4, dx = W / 2 - 3.1;           // the garden was laid out for the old 6.2 × 4.8 house
  {
    // flower box under the dormer window (roof group)
    addR(rbox(0.95, 0.2, 0.26, 0.04, timber, 1), doorX, 3.27, FRONT + 0.75);
    for (let i = 0; i < 26; i++) leaves.push({ p: [doorX + jr(-0.45, 0.45), 3.4 + jr(-0.05, 0.12), FRONT + 0.78 + jr(-0.08, 0.12)], s: jr(0.6, 1), roof: true });
    for (let i = 0; i < 18; i++) blossoms.push({ p: [doorX + jr(-0.44, 0.44), 3.45 + jr(0, 0.14), FRONT + 0.8 + jr(-0.06, 0.12)], c: pick([0xf06a8a, 0xffd23f, 0xf4a2c0, 0xffffff]), roof: true });
    // lavender clumps: thin green stalks with long purple spikes
    const lav = [[-3.55 - dx, 2.75 + dz], [-3.15 - dx, 3.25 + dz], [-3.6 - dx, 3.55 + dz], [-2.75 - dx, 3.0 + dz], [3.35 + dx, 2.75 + dz], [3.7 + dx, 3.2 + dz]];
    for (const [lx, lz] of lav) for (let k = 0; k < 16; k++) {
      const x = lx + jr(-0.26, 0.26), z = lz + jr(-0.24, 0.24), h = jr(0.55, 0.85), tilt = [jr(-0.25, 0.25), jr(0, 6.28), jr(-0.25, 0.25)];
      leaves.push({ p: [x, h * 0.45, z], r: tilt, s: [0.18, h * 3.2, 1], c: 0x6f9a5a });
      blossoms.push({ p: [x + tilt[2] * -0.35 * h, h * 0.92, z + tilt[0] * 0.35 * h], r: [tilt[0], 0, tilt[2]], s: [0.55, 2.4, 0.55], c: pick([0x8e6cc8, 0x9b7fd4, 0x7a5cb8, 0xa58ade]) });
    }
    // low beds of daisies, red & white flowers along the foot of the bay and by the steps
    const beds = [[-2.55 - dx, 3.15 + dz, 0.35], [-1.3, 3.0 + dz + 0.15, 0.5], [-0.15, 3.0 + dz, 0.32], [0.45, 2.85 + dz, 0.28]];
    for (const [bx, bz, r] of beds) {
      for (let i = 0; i < 36; i++) leaves.push({ p: [bx + jr(-r, r), jr(0.05, 0.42), bz + jr(-0.22, 0.25)], s: jr(0.8, 1.2) });
      for (let i = 0; i < 16; i++) blossoms.push({ p: [bx + jr(-r, r), jr(0.3, 0.55), bz + jr(-0.2, 0.25)], s: jr(0.9, 1.3), c: pick([0xffffff, 0xfff6e0, 0xffd23f, 0xe8443a, 0xf06a8a]) });
    }
    // greenery hugging the back corners
    for (const [bx, bz] of [[-W / 2 - 0.15, -FRONT - 0.05], [W / 2 + 0.2, -FRONT + 0.1]]) for (let i = 0; i < 70; i++) { const a = jr(0, 6.28), r = Math.sqrt(rr()) * 0.42, y = jr(0.08, 0.95); leaves.push({ p: [bx + Math.cos(a) * r * (1.1 - y * 0.5), y, bz + Math.sin(a) * r * (1.1 - y * 0.5)], s: jr(0.9, 1.4) }); }
  }

  // ---------------- garden props (concept dressing) — only outside the game, they'd look like hideable props
  if (garden) {
    const barrelWood = M(0xe8b37e, tex('wood_light', 1.5, 0.6));
    const metal = M(0xd8e2e8, tex('painted_metal', 0.6, 0.6));
    const pumpkinMat = M(0xff8a1e, null);
    const red = M(0xd9483e, tex('painted_metal', 0.5, 0.5));
    // barrel overflowing with lavender, left of the bay
    const bx = -3.35 - dx, bz = 3.75 + dz;
    const bg = new THREE.LatheGeometry([[0, 0], [0.33, 0], [0.38, 0.2], [0.41, 0.42], [0.38, 0.66], [0.34, 0.8], [0, 0.8]].map(([a, b]) => new THREE.Vector2(a, b)), 18);
    add(new THREE.Mesh(bg, barrelWood), bx, 0, bz);
    for (const y of [0.16, 0.64]) add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 22), iron), bx, y, bz, Math.PI / 2);
    for (let k = 0; k < 18; k++) { const x = bx + jr(-0.25, 0.25), z = bz + jr(-0.25, 0.25); blossoms.push({ p: [x, jr(0.95, 1.25), z], s: [0.55, 2.4, 0.55], c: pick([0x8e6cc8, 0x9b7fd4, 0x7a5cb8]) }); leaves.push({ p: [x, 0.9, z], r: [0, jr(0, 6), 0], s: [0.18, 2.4, 1], c: 0x6f9a5a }); }
    // crate of red apples
    const cx = -2.35, cz = 3.95 + dz;
    for (const y of [0.08, 0.24]) for (const s of [-1, 1]) { add(rbox(0.7, 0.13, 0.04, 0.015, timber, 1), cx, y, cz + s * 0.24); add(rbox(0.04, 0.13, 0.5, 0.015, timber, 1), cx + s * 0.33, y, cz); }
    add(rbox(0.66, 0.03, 0.46, 0.01, timber, 1), cx, 0.04, cz);
    for (let i = 0; i < 12; i++) blossoms.push({ p: [cx + jr(-0.26, 0.26), 0.33 + jr(0, 0.05), cz + jr(-0.17, 0.17)], s: 1.15, c: pick([0xd8352d, 0xe8443a, 0xc62f28]) });
    // pumpkins in front of the bay
    const pg = new THREE.SphereGeometry(1, 14, 10); pg.scale(1, 0.72, 1);
    for (const [px, pz, r] of [[-1.15, 4.0 + dz + 0.15, 0.3], [-0.6, 4.1 + dz + 0.1, 0.2]]) {
      add(new THREE.Mesh(pg, pumpkinMat), px, r * 0.7, pz, 0, 0, 0).scale.setScalar(r);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6), timberDark), px, r * 1.4, pz);
    }
    // watering can
    {
      const wx = 0.2, wz = 3.95 + dz;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.32, 14), metal), wx, 0.16, wz);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.42, 8), metal), wx + 0.27, 0.3, wz, 0, 0, -0.9);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12, Math.PI), metal), wx - 0.03, 0.33, wz, 0, 0, 0);
    }
    // terracotta pots of daisies and pink roses either side of the steps
    const potG = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.22, 0.3], [0.25, 0.36], [0.22, 0.38], [0, 0.38]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
    for (const [px, pz, cols] of [[doorX - 1.1, FRONT + 0.85, [0xffffff, 0xfff6e0, 0xffd23f]], [doorX + 1.0, FRONT + 1.2, [0xf48fb1, 0xffb3c6]]]) {
      add(new THREE.Mesh(potG, terracotta), px, 0, pz);
      for (let i = 0; i < 16; i++) leaves.push({ p: [px + jr(-0.22, 0.22), jr(0.4, 0.62), pz + jr(-0.22, 0.22)], s: jr(0.7, 1.1) });
      for (let i = 0; i < 10; i++) blossoms.push({ p: [px + jr(-0.2, 0.2), jr(0.55, 0.72), pz + jr(-0.2, 0.2)], s: 1.2, c: pick(cols) });
    }
    // red mailbox on a post at the right
    add(rbox(0.12, 1.05, 0.12, 0.03, timberDark, 1), 3.75 + dx, 0.52, 3.6 + dz);
    add(rbox(0.32, 0.3, 0.5, 0.06, red), 3.75 + dx, 1.18, 3.6 + dz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12, 1, false, 0, Math.PI), red), 3.75 + dx, 1.33, 3.6 + dz, Math.PI / 2, 0, -Math.PI / 2);
    // stepping-stone path
    const pav = M(0xd2cfc6, tex('stone', 0.5, 0.5));
    for (let k = 0; k < 2; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.3, 0.38), jr(0.32, 0.4), 0.08, 9), pav), doorX + Math.sin(k * 1.3) * 0.18, 0.03, FRONT + 1.15 + k * 0.7, 0, jr(0, 3), 0);
  }

  // =====================================================================================================
  // INTERIOR — bay-window parlour (front, z 0 … IZ) and bedroom under the thatch (back, z -IZ … -PT)
  // =====================================================================================================
  const CREAM = 0xfaf2e2, ROSE = 0xeaa0a0, PINK = 0xf2a7b8, SAGEC = 0xb9cf9e, MUST = 0xf0c25a;
  const lathe = (pts, seg = 8) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  const legGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.46, 6), postGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.6, 6), spGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5);
  // round-back wooden chair with a sage seat pad, facing +z in its own frame
  function chair(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, F, z); g.rotation.y = ry; root.add(g);
    const a = (m, px, py, pz, rx = 0, ryy = 0, rz = 0) => add(m, px, py, pz, rx, ryy, rz, g);
    a(rbox(0.44, 0.05, 0.42, 0.02, timber, 1), 0, 0.45, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) a(new THREE.Mesh(legGeo, timber), sx * 0.18, 0.22, sz * 0.17, sz * 0.05, 0, -sx * 0.05);
    for (const sx of [-1, 1]) a(new THREE.Mesh(postGeo, timber), sx * 0.19, 0.76, -0.2, -0.08, 0, 0);
    a(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 5, 12, Math.PI), timber), 0, 0.98, -0.22, -0.08, 0, 0);
    for (let k = -1; k <= 1; k++) a(new THREE.Mesh(spGeo, timber), k * 0.09, 0.78, -0.21, -0.08, 0, 0);
    const [px, pz] = at(x, z, ry)(0, 0.02);
    cl('soft', px, F + 0.5, pz, 0.42, 0.07, 0.4, 0x9fbf86, ry);
  }
  const pot = (x, y, z, r, trail = 0, flowers = null) => {
    cl('cyl', x, y + r * 0.9, z, r * 2, r * 1.8, r * 2, 0xe08a5e);
    cl('cyl', x, y + r * 1.85, z, r * 2.25, r * 0.3, r * 2.25, 0xe7976a);
    for (let k = 0; k < 14; k++) leaves.push({ p: [x + jr(-r * 1.6, r * 1.6), y + r * 2 + jr(0, r * 2.4), z + jr(-r * 1.6, r * 1.6)], s: jr(0.6, 1.0) });
    for (let k = 0; k < trail; k++) leaves.push({ p: [x + jr(-0.12, 0.12), y + r * 1.8 - k * 0.07, z + jr(-0.1, 0.1)], s: jr(0.6, 0.9) });
    if (flowers) for (let k = 0; k < 8; k++) blossoms.push({ p: [x + jr(-r * 1.3, r * 1.3), y + r * 3.2 + jr(0, r), z + jr(-r * 1.3, r * 1.3)], c: pick(flowers) });
  };
  const vase = (x, y, z, col, flowers, big = 1) => {
    cl('sph', x, y + 0.1 * big, z, 0.17 * big, 0.2 * big, 0.17 * big, col);
    cl('cyl', x, y + 0.22 * big, z, 0.09 * big, 0.08 * big, 0.09 * big, col);
    for (let k = 0; k < 6; k++) leaves.push({ p: [x + jr(-0.15, 0.15) * big, y + (0.3 + jr(0, 0.12)) * big, z + jr(-0.15, 0.15) * big], s: 0.7 });
    for (let k = 0; k < 4; k++) { const cx = x + jr(-0.12, 0.12) * big, cy = y + (0.38 + jr(0, 0.1)) * big, cz = z + jr(-0.12, 0.12) * big, c = pick(flowers); for (let q = 0; q < 6; q++) blossoms.push({ p: [cx + jr(-0.06, 0.06), cy + jr(-0.05, 0.05), cz + jr(-0.06, 0.06)], c }); }
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
      cl('box', x + (along === 'x' ? o : 0), y + h / 2, z + (along === 'z' ? o : 0), along === 'x' ? t : 0.16, h, along === 'x' ? 0.16 : t, c, ry, 0, jr(-0.04, 0.04));
      o += t + 0.004;
    }
  };
  const jars = (x, y, z, n, along = 'x') => {
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * 0.17, jx = x + (along === 'x' ? o : 0), jz = z + (along === 'z' ? o : 0), h = jr(0.17, 0.22);
      cl('cyl', jx, y + h / 2, jz, 0.13, h, 0.13, pick([0xe8a04a, 0xd2562f, 0xb8382e, 0xe9c25a, 0x9aa64a]));
      cl('cyl', jx, y + h + 0.02, jz, 0.14, 0.04, 0.14, 0xf3ead6);
    }
  };
  const herbs = (x, y, z, c) => {                       // a dried bunch hanging upside down from the rail
    cl('cyl', x, y + 0.06, z, 0.012, 0.12, 0.012, 0x8a6a3a);
    for (let k = 0; k < 9; k++) blossoms.push({ p: [x + jr(-0.06, 0.06), y - jr(0.02, 0.3), z + jr(-0.06, 0.06)], s: [0.55, 1.4, 0.55], c: pick(c) });
    for (let k = 0; k < 5; k++) leaves.push({ p: [x + jr(-0.05, 0.05), y - jr(0, 0.12), z + jr(-0.05, 0.05)], s: 0.6, c: 0x7f9a5a });
  };
  const picture = (x, y, z, ry, w, h, top = 0xbcd7e6, bot = 0x9cbf6e) => {
    add(rbox(w, h, 0.04, 0.015, timberDark, 1), x, y, z, 0, ry, 0);
    const p = at(x, z, ry), [ax, az] = p(0, 0.024);
    cl('box', ax, y + h * 0.12, az, w - 0.08, h * 0.55, 0.01, top, ry);
    cl('box', ax, y - h * 0.18, az, w - 0.08, h * 0.4, 0.01, bot, ry);
  };

  // ---------------- parlour: stone chimney breast on the partition with the stove alcove, stone hearth, sheepskin
  const SX = -0.3;
  {
    add(rbox(1.1, 1.75, 0.42, 0.06, stone, 1), SX, F + 0.875, 0.2);
    add(rbox(0.8, H - 1.8, 0.36, 0.06, stone, 1), SX, 1.8 + (H - 1.8) / 2, 0.17);
    add(rbox(1.16, 0.14, 0.48, 0.04, stoneDark, 1), SX, F + 1.78, 0.23);
    for (let k = 0; k < 10; k++) add(rbox(jr(0.24, 0.36), jr(0.16, 0.24), 0.08, 0.05, rr() < 0.5 ? stone : stoneDark, 1), SX + jr(-0.3, 0.3), jr(1.95, 2.7), 0.36, 0, 0, jr(-0.1, 0.1));
    // arched sooty alcove mouth framed by rounded stones
    add(rbox(0.62, 0.5, 0.04, 0.02, iron, 1), SX, F + 0.4, 0.42);
    add(new THREE.Mesh(new THREE.CircleGeometry(0.31, 14, 0, Math.PI), iron), SX, F + 0.65, 0.441);
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; add(rbox(0.2, 0.16, 0.1, 0.05, i % 2 ? stoneDark : stone, 1), SX + Math.cos(a) * 0.4, F + 0.65 + Math.sin(a) * 0.4, 0.44, 0, 0, a - Math.PI / 2); }
    for (const sx of [-1, 1]) for (let j = 0; j < 3; j++) add(rbox(0.16, 0.2, 0.1, 0.05, j % 2 ? stoneDark : stone, 1), SX + sx * 0.4, F + 0.12 + j * 0.2, 0.44);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 20, 1, false, -Math.PI / 2, Math.PI), stoneDark), SX, F + 0.04, 0.42);
    box(SX, 0.21, 1.16, 0.46);
    // sheepskin rug
    for (let k = 0; k < 9; k++) cl('soft', SX + jr(-0.45, 0.45), F + 0.012, 1.35 + jr(-0.25, 0.25), jr(0.35, 0.55), 0.02, jr(0.3, 0.45), 0xfbf3e4, jr(0, 3));
    cl('soft', SX, F + 0.016, 1.35, 1.1, 0.02, 0.7, 0xfdf7ea);
    // dried flower bunches hanging from the rails
    for (const [x, z, c] of [[-2.2, 0.14, [0x8e6cc8, 0x9b7fd4]], [-1.0, 0.14, [0xf2c14e, 0xe9b03a]], [0.6, 0.14, [0x8e6cc8, 0xf2c14e]], [-IX + 0.14, 1.0, [0xfdfbf2, 0xf4b6c6]], [-IX + 0.14, 2.8, [0x8e6cc8, 0x9b7fd4]]]) herbs(x, H - 0.24, z, c);
  }
  // ---------------- parlour: sage dresser with cups, jam jars and teapot (partition, far left)
  {
    const x = -2.45, w = 1.1;
    add(rbox(w, 0.85, 0.5, 0.04, sage, 1), x, F + 0.425, 0.26);
    add(rbox(w + 0.08, 0.05, 0.56, 0.02, timber, 1), x, F + 0.87, 0.28);
    for (const sx of [-1, 1]) { add(rbox(w / 2 - 0.08, 0.6, 0.03, 0.02, sageDark, 1), x + sx * w / 4, F + 0.42, 0.52); cl('sph', x - sx * 0.06, F + 0.5, 0.54, 0.04, 0.04, 0.04, 0x6e4223); }
    for (const y of [1.45, 1.85, 2.25]) { add(rbox(w + 0.1, 0.04, 0.24, 0.01, timber, 1), x, y, 0.12); for (const sx of [-1, 1]) add(rbox(0.03, 0.12, 0.2, 0.01, timber, 1), x + sx * 0.45, y - 0.08, 0.1); }
    jars(x, 2.27, 0.12, 5);
    for (let k = 0; k < 5; k++) { cl('cyl', x - 0.44 + k * 0.22, 1.89, 0.13, 0.1, 0.08, 0.1, 0xfbf6ec); cl('disc', x - 0.44 + k * 0.22, 1.87, 0.13, 0.15, 0.01, 0.15, 0xfbf6ec); }
    for (let k = 0; k < 5; k++) cl('cyl', x - 0.44 + k * 0.22, 1.37, 0.18, 0.09, 0.08, 0.09, 0xf6efe4);                   // cups on hooks
    for (let k = 0; k < 4; k++) cl('disc', x - 0.35, F + 0.9 + k * 0.012, 0.32, 0.26, 0.01, 0.26, 0xfbf6ec);              // plate stack
    cl('sph', x + 0.05, F + 0.97, 0.3, 0.2, 0.17, 0.2, 0xfbf6ec); cl('cyl', x + 0.05, F + 1.07, 0.3, 0.06, 0.04, 0.06, 0xfbf6ec);
    cl('sph', x + 0.38, F + 0.93, 0.32, 0.26, 0.1, 0.26, 0xc98a52);                                                        // bowl of apples
    for (let k = 0; k < 4; k++) cl('sph', x + 0.38 + jr(-0.06, 0.06), F + 0.99, 0.32 + jr(-0.06, 0.06), 0.08, 0.08, 0.08, 0xd8352d);
    cl('box', x + 0.2, F + 0.75, 0.53, 0.18, 0.28, 0.02, 0xf4ece0); cl('box', x + 0.2, F + 0.75, 0.535, 0.18, 0.03, 0.02, 0xd98a8a);
    for (let k = 0; k < 18; k++) leaves.push({ p: [x - 0.62 + jr(-0.04, 0.04), 2.6 - k * 0.11, 0.1 + jr(-0.04, 0.06)], s: jr(0.6, 0.95) });   // ivy down the side
    box(x, 0.27, w + 0.08, 0.56);
  }
  // ---------------- parlour: round lace-covered table + three chairs, in front of the window seat
  {
    const tx = -1.75, tz = 2.25;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), timber), tx, F + 0.74, tz);
    add(new THREE.Mesh(lathe([[0, 0], [0.22, 0], [0.12, 0.06], [0.06, 0.12], [0.08, 0.3], [0.05, 0.5], [0.07, 0.66], [0.07, 0.72], [0, 0.72]], 10), timber), tx, F, tz);
    cl('cyl', tx, F + 0.62, tz, 1.12, 0.26, 1.12, 0xfbf3e6);                                        // lace cloth skirt
    cl('disc', tx, F + 0.775, tz, 1.1, 0.012, 1.1, 0xfdf8ee);
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; cl('sph', tx + Math.cos(a) * 0.55, F + 0.5, tz + Math.sin(a) * 0.55, 0.09, 0.06, 0.09, 0xfbf3e6); }
    vase(tx + 0.05, F + 0.78, tz - 0.1, 0xe2b06a, [PINK, 0xb7a4e0, 0xfdfbf2, 0xf4b6c6], 1.2);
    cl('sph', tx - 0.25, F + 0.86, tz + 0.12, 0.2, 0.17, 0.2, 0xfbf6ec); cl('cyl', tx - 0.25, F + 0.96, tz + 0.12, 0.05, 0.04, 0.05, 0xfbf6ec);   // teapot
    cl('cyl', tx - 0.12, F + 0.81, tz - 0.28, 0.06, 0.06, 0.06, 0xfbf6ec);
    for (const [cx, cz] of [[0.22, 0.2], [-0.05, 0.32]]) { cl('disc', tx + cx, F + 0.785, tz + cz, 0.16, 0.01, 0.16, 0xfbf6ec); cl('cyl', tx + cx, F + 0.82, tz + cz, 0.09, 0.07, 0.09, 0xfbf6ec); }
    chair(tx - 0.78, tz - 0.15, Math.PI / 2 - 0.2);
    chair(tx + 0.1, tz - 0.8, 0.1);
    chair(tx + 0.72, tz + 0.35, -Math.PI / 2 - 0.4);
    box(tx, tz, 1.1, 1.1);
  }
  // ---------------- parlour: right wall — jar & book shelves, trestle bench with lantern and daisies
  {
    for (const y of [1.55, 1.95]) {
      add(rbox(0.26, 0.04, 1.0, 0.01, timber, 1), IX - 0.13, y, 0.85);
      for (const sz of [-1, 1]) add(rbox(0.2, 0.12, 0.03, 0.01, timber, 1), IX - 0.1, y - 0.08, 0.85 + sz * 0.42);
    }
    jars(IX - 0.13, 1.97, 0.85, 4, 'z');
    books(IX - 0.13, 1.57, 0.5, 5, 'z');
    cl('sph', IX - 0.14, 1.66, 1.12, 0.16, 0.2, 0.16, 0xfbf6ec);
    pot(IX - 0.14, 1.97, 1.32, 0.08, 10);
    // trestle bench under the window
    const bz = -(-2.0), bx = IX - 0.3;
    add(rbox(0.42, 0.06, 1.0, 0.02, timber, 1), bx, F + 0.5, bz);
    for (const sz of [-1, 1]) { add(rbox(0.06, 0.46, 0.34, 0.02, timber, 1), bx, F + 0.24, bz + sz * 0.38, sz * 0.12, 0, 0); }
    add(rbox(0.05, 0.06, 0.7, 0.02, timber, 1), bx, F + 0.2, bz);
    lantern(bx, F + 0.53, bz - 0.25);
    vase(bx + 0.02, F + 0.53, bz + 0.12, 0xf3eee4, [0xfdfbf2, 0xfffbe8], 1.0);
    books(bx - 0.05, F + 0.53, bz + 0.36, 2, 'x', 0.3);
    box(bx, bz, 0.44, 1.0);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffc070, 0.9, 4.5, 2); pl.position.set(bx - 0.4, F + 1.0, bz - 0.25); root.add(pl); }
    picture(0.62, 1.95, 0.02, 0, 0.42, 0.34);
  }
  // ---------------- parlour loose decor (garden version only: these read as hideable props in-game)
  if (garden) {
    // cast-iron stove with a glowing window, flue into the breast, copper kettle; log tub beside it
    const sz = 0.82;
    add(rbox(0.62, 0.55, 0.5, 0.04, iron, 1), SX, F + 0.4, sz);
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.14, 6), iron), SX + ex * 0.24, F + 0.07, sz + ez * 0.18);
    add(rbox(0.38, 0.28, 0.04, 0.03, glow, 1), SX, F + 0.4, sz + 0.25);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 10), iron), SX, F + 1.04, sz - 0.12);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 10), iron), SX, F + 1.38, sz - 0.33, Math.PI / 2, 0, 0);
    cl('sph', SX + 0.12, F + 0.78, sz + 0.06, 0.26, 0.22, 0.26, 0xd9823e); cl('cyl', SX + 0.12, F + 0.9, sz + 0.06, 0.06, 0.06, 0.06, 0xd9823e);
    cl('cyl', SX + 0.8, F + 0.2, 0.75, 0.42, 0.4, 0.42, 0xb57e4a);
    for (let k = 0; k < 6; k++) cl('cyl', SX + 0.8 + jr(-0.1, 0.1), F + 0.5, 0.75 + jr(-0.1, 0.1), 0.09, 0.45, 0.09, 0xc89a62, jr(0, 3), jr(-0.2, 0.2));
    if (opts.light !== false) { const pl = new THREE.PointLight(0xff9a48, 1.2, 5, 2); pl.position.set(SX, 0.8, sz + 0.6); root.add(pl); }
    // grandfather clock
    const cx = -1.4;
    add(rbox(0.5, 1.95, 0.32, 0.03, timber, 1), cx, F + 0.98, 0.2);
    add(rbox(0.58, 0.5, 0.36, 0.05, timber, 1), cx, F + 2.1, 0.21);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.34, 14, 1, false, -Math.PI / 2, Math.PI), timber), cx, F + 2.35, 0.21, Math.PI / 2, 0, Math.PI / 2);
    cl('disc', cx, F + 2.12, 0.39, 0.36, 0.01, 0.36, 0xfbf3e0, 0, Math.PI / 2);
    add(rbox(0.3, 0.8, 0.02, 0.01, glass, 1), cx, F + 1.35, 0.37);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), M(0xe9b04a, null)), cx, F + 1.05, 0.37, Math.PI / 2, 0, 0);
    // potted fern + lidded basket + yarn basket by the bedroom arch
    const fx = 2.55, fz = 0.7;
    cl('cyl', fx, F + 0.28, fz, 0.6, 0.55, 0.6, 0xd97c50); cl('cyl', fx, F + 0.56, fz, 0.66, 0.08, 0.66, 0xe08a5e);
    for (let k = 0; k < 40; k++) { const a = jr(0, 6.28), r = jr(0.1, 0.55); leaves.push({ p: [fx + Math.cos(a) * r, F + 0.75 + jr(0, 0.5) - r * 0.4, fz + Math.sin(a) * r], r: [jr(-1.3, -0.4), a, 0], s: [0.5, 2.4, 1], c: pick([0x4f8a3c, 0x5f9c45, 0x6fae4d]) }); }
    cl('cyl', 2.62, F + 0.22, 1.25, 0.42, 0.44, 0.42, 0xc8955a); cl('sph', 2.62, F + 0.44, 1.25, 0.42, 0.14, 0.42, 0xc8955a);
    cl('box', 2.52, F + 0.42, 1.17, 0.2, 0.3, 0.04, 0xf4dede, 0.4, 0, 0.3);
    // a pair of cushions in the stool corner
    for (const [k, c] of [[0, 0xea9a86], [1, 0xfbf3e3]]) cl('soft', -0.45, F + 0.08 + k * 0.14, 3.25, 0.5, 0.15, 0.45, c, jr(-0.3, 0.3));
  }

  // ---------------- bedroom: bed against the left wall, floral quilt, round nightstand
  {
    const bx = -IX + 1.0, bz = -2.3, L = 2.0, Wb = 1.4;
    for (const sz of [-1, 1]) add(rbox(L - 0.1, 0.18, 0.07, 0.03, timber, 1), bx, F + 0.33, bz + sz * (Wb / 2 - 0.02));
    add(rbox(0.09, 0.95, Wb, 0.03, timber, 1), -IX + 0.07, F + 0.52, bz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(Wb / 2, Wb / 2, 0.09, 18, 1, false, 0, Math.PI).scale(0.4, 1, 1), timber), -IX + 0.07, F + 0.99, bz, 0, 0, Math.PI / 2);
    add(rbox(0.09, 0.62, Wb, 0.03, timber, 1), -IX + L - 0.03, F + 0.36, bz);
    for (const sz of [-1, 1]) for (const fx of [-IX + 0.07, -IX + L - 0.03]) {
      const hgt = fx < bx ? 1.1 : 0.78;
      add(rbox(0.12, hgt, 0.12, 0.03, timberDark, 1), fx, F + hgt / 2, bz + sz * Wb / 2);
      cl('sph', fx, F + hgt + 0.06, bz + sz * Wb / 2, 0.15, 0.15, 0.15, 0x9a6a46);
    }
    cl('soft', bx + 0.02, F + 0.5, bz, L - 0.16, 0.26, Wb - 0.16, CREAM);
    cl('soft', bx + 0.25, F + 0.66, bz, L - 0.62, 0.06, Wb - 0.08, 0xfbf3e3);                       // cream quilt
    for (const sz of [-1, 1]) cl('box', bx + 0.25, F + 0.5, bz + sz * (Wb / 2 - 0.065), L - 0.62, 0.3, 0.025, 0xfbf3e3);
    for (let k = 0; k < 14; k++) {                                                                  // embroidered roses on the quilt
      const qx = bx - 0.4 + (k % 5) * 0.28 + jr(-0.03, 0.03), qz = bz - 0.48 + Math.floor(k / 5) * 0.45 + jr(-0.03, 0.03);
      cl('sph', qx, F + 0.69, qz, 0.13, 0.02, 0.13, pick([0xe9768e, 0xf09aae, 0xe8667f]));
      for (const s of [-1, 1]) cl('sph', qx + s * 0.08, F + 0.688, qz + s * 0.04, 0.09, 0.015, 0.05, 0x8fae6a, s);
    }
    for (let k = 0; k < 12; k++) cl('sph', bx + 0.95, F + 0.35, bz - Wb / 2 + 0.1 + k * 0.11, 0.06, 0.04, 0.06, 0xfdf8ee);   // lace edge
    for (const s of [-1, 1]) cl('soft', -IX + 0.32, F + 0.74, bz + s * 0.32, 0.26, 0.24, 0.56, CREAM, 0, 0, -0.35);
    cl('soft', -IX + 0.5, F + 0.74, bz, 0.16, 0.3, 0.52, 0x9fbf86, 0, 0, -0.3);
    cl('soft', bx + 0.62, F + 0.72, bz, 0.4, 0.07, Wb - 0.2, 0x9fbf86);                              // folded green blanket
    cl('soft', bx + 0.62, F + 0.78, bz, 0.34, 0.06, Wb - 0.3, 0xf6ead4);
    box(bx, bz, L, Wb + 0.1);
    // round nightstand with lantern, daisies and books
    const nx = -IX + 0.32, nz = -1.2;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16), timber), nx, F + 0.6, nz);
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.6, 6), timber), nx + Math.cos(a) * 0.18, F + 0.3, nz + Math.sin(a) * 0.18, Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1); }
    cl('disc', nx, F + 0.63, nz, 0.4, 0.005, 0.4, 0xfdf8ee);
    lantern(nx + 0.08, F + 0.63, nz + 0.08);
    vase(nx - 0.06, F + 0.63, nz - 0.1, 0xf3eee4, [0xfdfbf2, 0xf6e27a]);
    books(nx + 0.1, F + 0.63, nz - 0.14, 2, 'x', 0.5);
    box(nx, nz, 0.56, 0.56);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffc070, 0.9, 4.5, 2); pl.position.set(nx + 0.4, F + 1.1, nz); root.add(pl); }
  }
  // ---------------- bedroom: dressing table with oval mirror, hat boxes, bookshelf, sewing bench, rug, pictures
  {
    // sage dressing table on the back wall
    const dx = 0.55, dz = -IZ + 0.25;
    add(rbox(1.15, 0.06, 0.5, 0.02, sage, 1), dx, F + 0.78, dz);
    add(rbox(1.1, 0.14, 0.45, 0.02, sage, 1), dx, F + 0.68, dz);
    add(rbox(0.5, 0.1, 0.03, 0.01, sageDark, 1), dx, F + 0.68, dz + 0.23);
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) add(new THREE.Mesh(lathe([[0, 0], [0.03, 0], [0.04, 0.2], [0.025, 0.45], [0.035, 0.62], [0, 0.62]], 6), sage), dx + ex * 0.5, F, dz + ez * 0.18);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 20), timber), dx, F + 1.38, dz - 0.15);
    add(new THREE.Mesh(new THREE.CircleGeometry(0.29, 20), M(0xc9d8de, null, { roughness: 0.6 })), dx, F + 1.38, dz - 0.14);
    for (const ex of [-1, 1]) add(rbox(0.05, 0.6, 0.05, 0.015, timber, 1), dx + ex * 0.36, F + 1.12, dz - 0.15);
    lantern(dx + 0.42, F + 0.81, dz + 0.02);
    vase(dx - 0.4, F + 0.81, dz + 0.02, 0xf3eee4, [PINK, 0xfbeaf0, 0xe9768e]);
    for (let k = 0; k < 3; k++) cl('cyl', dx - 0.1 + k * 0.1, F + 0.86, dz + 0.08, 0.05, 0.1, 0.05, pick([0xe9c6d0, 0xd6e4f0, 0xf3e3b6]));
    cl('cyl', dx + 0.15, F + 0.84, dz + 0.1, 0.12, 0.06, 0.12, 0xfbf6ec);
    cl('box', dx, F + 0.815, dz + 0.05, 0.6, 0.008, 0.3, 0xfdf8ee);
    box(dx, dz, 1.2, 0.52);
    // stack of painted hat boxes
    for (const [k, c, r] of [[0, 0xc9dcc0, 0.3], [1, 0xf6eee0, 0.26], [2, 0xeaa79c, 0.22]]) { cl('cyl', -0.45, F + 0.14 + k * 0.26, -IZ + 0.4, r * 2, 0.24, r * 2, c); cl('cyl', -0.45, F + 0.26 + k * 0.26, -IZ + 0.4, r * 2 + 0.03, 0.04, r * 2 + 0.03, c); }
    for (let k = 0; k < 8; k++) { const a = jr(0, 6.28); blossoms.push({ p: [-0.45 + Math.cos(a) * 0.3, F + 0.14 + jr(-0.06, 0.06), -IZ + 0.4 + Math.sin(a) * 0.3], s: 0.6, c: pick([0xe9768e, 0x8fae6a]) }); }
    // sage bookshelf on the right wall: books, folded quilts, pitcher, plant on top
    const sx = IX - 0.2, sz = -2.9;
    add(rbox(0.38, 1.85, 1.0, 0.03, sage, 1), sx + 0.02, F + 0.925, sz);
    for (const y of [0.1, 0.55, 1.0, 1.45]) add(rbox(0.36, 0.04, 0.92, 0.01, sageDark, 1), sx - 0.02, F + y + 0.05, sz);
    books(sx - 0.05, F + 1.52, sz - 0.4, 12, 'z');
    books(sx - 0.05, F + 1.07, sz - 0.4, 6, 'z');
    for (let k = 0; k < 3; k++) cl('soft', sx - 0.05, F + 0.66 + k * 0.08, sz + 0.05, 0.32, 0.08, 0.6, pick([0xf6ead4, 0xeaa79c, 0xc9dcc0, 0xfbf3e3]));
    for (let k = 0; k < 3; k++) cl('soft', sx - 0.05, F + 0.21 + k * 0.08, sz, 0.32, 0.08, 0.8, pick([0xf6ead4, 0xeaa79c, 0xfbf3e3]));
    cl('sph', sx - 0.05, F + 1.15, sz + 0.25, 0.18, 0.22, 0.18, 0xfbf6ec);
    pot(sx - 0.05, F + 1.87, sz - 0.2, 0.11, 12);
    box(sx + 0.02, sz, 0.42, 1.0);
    // sewing bench under the small back window, basket on top
    const wx = 2.3, wz = -IZ + 0.4;
    add(rbox(0.9, 0.06, 0.4, 0.02, timber, 1), wx, F + 0.45, wz);
    for (const ex of [-1, 1]) add(rbox(0.06, 0.42, 0.34, 0.02, timber, 1), wx + ex * 0.36, F + 0.21, wz);
    cl('cyl', wx - 0.1, F + 0.6, wz, 0.38, 0.24, 0.3, 0xc8955a);
    cl('box', wx - 0.1, F + 0.68, wz + 0.05, 0.3, 0.12, 0.2, 0xf4dede, 0.3);
    cl('cyl', wx + 0.25, F + 0.53, wz, 0.06, 0.1, 0.06, 0x8fae6a);
    cl('sph', wx + 0.35, F + 0.53, wz + 0.08, 0.1, 0.09, 0.1, 0xd8352d);
    box(wx, wz, 0.9, 0.42);
    // braided round rug (green / oat rings)
    [1.0, 0.9, 0.78, 0.66, 0.54, 0.42, 0.3, 0.18].forEach((r, i) => cl('disc', 0.45, F + 0.006 + i * 0.002, -1.95, r * 2, 0.012, r * 2, [0x9db884, 0xe9d9b4, 0xd8c495, 0x9db884, 0xf2e6c8, 0xd8c495, 0x9db884, 0xe9d9b4][i]));
    // pictures, lavender bunches
    picture(-0.45, 1.8, -IZ + 0.02, 0, 0.42, 0.5, 0xf6efe0, 0xf6efe0);
    for (let k = 0; k < 6; k++) blossoms.push({ p: [-0.45 + jr(-0.08, 0.08), 1.82 + jr(-0.1, 0.1), -IZ + 0.05], s: 0.8, c: pick([0xe9768e, 0x8fae6a]) });
    herbs(1.35, 2.35, -IZ + 0.06, [0x8e6cc8, 0x9b7fd4]); herbs(1.55, 2.3, -IZ + 0.06, [0x8e6cc8, 0x7a5cb8]);
    for (let k = 0; k < 2; k++) herbs(-IX + 0.14, H - 0.24, -0.9 - k * 0.3, [0x8e6cc8, 0xfdfbf2]);
    // pitcher of roses on the inner sill of the arched window
    vase(-1.6, 1.15 + 0.03, -IZ + 0.09, 0xfbf6ec, [PINK, 0xf4b6c6, 0xe9768e]);
  }
  // ---------------- bedroom loose decor (garden version only)
  if (garden) {
    // chest at the foot of the bed with folded blankets
    const cx = -0.5, cz = -2.3;
    add(rbox(0.52, 0.48, 0.9, 0.04, timber, 1), cx, F + 0.24, cz);
    for (const ez of [-0.32, 0.32]) add(rbox(0.56, 0.5, 0.05, 0.01, iron, 1), cx, F + 0.25, cz + ez);
    cl('soft', cx, F + 0.55, cz, 0.46, 0.1, 0.7, 0x9fbf86); cl('soft', cx, F + 0.65, cz, 0.42, 0.1, 0.66, 0xf6ead4);
    // vanity stool, spinning wheel, wool basket by the bed
    add(rbox(0.42, 0.14, 0.34, 0.06, M(0xf4d6d0, tex('plaster', 0.5, 0.5)), 1), 0.55, F + 0.46, -2.85);
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) add(new THREE.Mesh(legGeo, timber), 0.55 + ex * 0.15, F + 0.2, -2.85 + ez * 0.11);
    const g = new THREE.Group(); g.position.set(2.35, F, -1.45); g.rotation.y = -1.2; root.add(g);
    const a = (m, x, y, z, rx = 0, ry = 0, rz = 0) => add(m, x, y, z, rx, ry, rz, g);
    a(rbox(0.9, 0.08, 0.2, 0.02, timber, 1), 0, 0.45, 0, 0, 0, 0.12);
    for (const [lx, lz] of [[-0.38, -0.08], [-0.38, 0.08], [0.35, 0]]) a(new THREE.Mesh(legGeo, timber), lx, 0.22, lz, 0, 0, lx < 0 ? 0.15 : -0.15);
    a(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 22), timber), 0.18, 0.9, 0);
    for (let k = 0; k < 6; k++) a(rbox(0.02, 0.66, 0.02, 0.006, timber, 1), 0.18, 0.9, 0, 0, 0, (k / 6) * Math.PI);
    for (const s of [-1, 1]) a(rbox(0.05, 0.52, 0.05, 0.015, timber, 1), 0.18, 0.66, s * 0.07);
    a(rbox(0.04, 0.5, 0.04, 0.01, timber, 1), -0.32, 0.72, 0);
    cl('cyl', -1.8, F + 0.18, -0.8, 0.55, 0.32, 0.55, 0xc8955a);
    for (let k = 0; k < 5; k++) cl('sph', -1.8 + jr(-0.14, 0.14), F + 0.37, -0.8 + jr(-0.14, 0.14), 0.22, 0.16, 0.22, 0xfbf6ec);
  }

  // ---------------- leaves, blossoms, roses (instanced; the dormer flower box goes in the roof group)
  {
    const o = new THREE.Object3D();
    const inst = (geo, mat, all, colors, name) => {
      for (const P of [root, roofG]) {
        const items = all.filter((it) => !!it.roof === (P === roofG));
        if (!items.length) continue;
        const im = new THREE.InstancedMesh(geo, mat, items.length);
        items.forEach((it, i) => {
          o.position.set(...it.p);
          if (it.r) o.rotation.set(...it.r); else o.rotation.set(jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28));
          const s = it.s ?? 1; typeof s === 'number' ? o.scale.setScalar(s) : o.scale.set(...s);
          o.updateMatrix(); im.setMatrixAt(i, o.matrix);
          im.setColorAt(i, it.c !== undefined ? new THREE.Color(it.c) : pick(colors).clone().offsetHSL(0, 0, jr(-0.05, 0.06)));
        });
        im.castShadow = true; im.receiveShadow = true; im.name = name; P.add(im);
      }
    };
    const leafGeo = new THREE.CircleGeometry(0.1, 6); leafGeo.scale(1, 1.4, 1);
    inst(leafGeo, leafMat, leaves, greens.map((h) => new THREE.Color(h)), 'leaves');
    inst(new THREE.IcosahedronGeometry(0.075, 0), flowerMat, blossoms, [], 'blossoms');
    const roseGeo = new THREE.IcosahedronGeometry(0.1, 1); roseGeo.scale(1, 0.78, 1);
    inst(roseGeo, flowerMat, roses, [], 'roses');
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

  root.userData.footprint = { w: W + 1.7, d: D + 2.0 };
  root.userData.door = { x: doorX, z: FRONT + 1.35 };
  root.userData.doorIn = { x: doorX - 0.2, z: IZ - 0.6 };
  root.userData.innerDoors = [{ x: innerDoor.x, z: -PT / 2 }];
  root.userData.rooms = [
    { name: 'parlour', x: 0, z: IZ / 2, w: 2 * IX, d: IZ },
    { name: 'bedroom', x: 0, z: -(IZ + PT) / 2, w: 2 * IX, d: IZ - PT },
  ];
  root.userData.colliders = colliders;
  // hideable-prop slots: next to furniture, in small groups, off the door → inner-door line
  root.userData.propSlots = [
    { id: 'stove', x: SX, z: 0.95, rot: 0 },
    { id: 'grandfather_clock', x: -1.38, z: 0.6, rot: 0 },
    { id: 'potted_fern', x: 2.5, z: 0.72, rot: 0.3 },
    { id: 'flower_pot', x: -2.6, z: 3.28, rot: -0.4 },
    { id: 'cushion_pile', x: -0.45, z: 3.15, rot: 0.2 },
    { id: 'cushion_pile', x: 0.5, z: 3.18, rot: -0.3 },
    { id: 'chest', x: -0.45, z: -2.3, rot: Math.PI / 2 },
    { id: 'spinning_wheel', x: 2.35, z: -1.45, rot: -1.2 },
    { id: 'laundry_basket', x: -1.8, z: -0.8, rot: 0.3 },
    { id: 'stool', x: 0.55, z: -2.68, rot: 0 },
    { id: 'book_stack', x: 2.25, z: -2.48, rot: 0.4 },
    { id: 'book_stack', x: 1.6, z: -2.55, rot: -0.3 },
  ];
  if (opts.merge !== false) { mergeStatic(THREE, roofG); mergeStatic(THREE, root); }
  return root;
}
