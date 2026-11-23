/* Hider — hand-modelled in code from Codex's concept art (assets/concepts/char_hider_turnaround.png = 'classic',
 * assets/concepts/char_hiders_lineup.png = the six other skins).
 * export buildHider(THREE, opts) → THREE.Group, export HIDER_SKINS.
 * Origin = ground between the feet, faces +Z, metres, ≈1.15 m tall including the sprout.
 * One chubby bean-shaped spirit (body + head are one lathe), painterly brush texture + vertex-colour shading,
 * ≤14 meshes / ≤15k triangles per character. The body-coloured parts (body, hair lobes, arms, feet, belly emblem)
 * all share ONE per-character MeshStandardMaterial (userData.paint) so the game can repaint the whole spirit.
 * Hierarchy: root ─ footL, footR, torso ─ body, hair|hat, eyes, closed eyes, face, collar, emblem, armL, armR, sprout
 * userData.animate(dt, moving, speed) drives feet / arms / torso / sprout only; the game owns the root transform.
 */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const HIDER_SKINS = ['classic', 'mushroom', 'straw', 'raincloud', 'flower', 'goggles', 'bow'];

// body: initial paint colour · hair: hair-lobe shade (0 = no hair lobes) · hat · collar · emblem · sprout: leaf colours [base, tip]
const SKINS = {
  classic: { body: 0xfff3dc, hair: 0.97, collar: 'kerchief', brows: true, sprout: [0x7aab34, 0xd3e676] },
  mushroom: { body: 0xa6cc6e, hat: 'mushroom', collar: 'leaves', emblem: 'leaf' },
  straw: { body: 0xffa47c, hat: 'straw', collar: 'petals', petal: [0xf5a172, 0xe2744a], emblem: 'swirl' },
  raincloud: { body: 0x9ccbf5, hat: 'cloud', collar: 'drops', emblem: 'drop' },
  flower: { body: 0xd6baf2, hat: 'flower', collar: 'petals', petal: [0xd9bdf4, 0xa57ad8], emblem: 'fleur' },
  goggles: { body: 0xffcf45, hat: 'goggles', collar: 'scarf', emblem: 'sun', sprout: [0xf0a92e, 0xffe27a], tuft: true },
  bow: { body: 0xffb0c6, hair: 0.8, hat: 'bow', collar: 'petals', petal: [0xf9a3bd, 0xe36a92], emblem: 'heart' },
};

// ---------------------------------------------------------------- shared painterly textures (generated once)
let brushT = null, strawT = null;
function canvasTex(THREE, draw, size = 256) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function seeded(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
// soft fur-like brush strokes, near white so they only modulate the paint colour
function brushTex(THREE) {
  return brushT || (brushT = canvasTex(THREE, (g, S) => {
    g.fillStyle = '#fffcf6'; g.fillRect(0, 0, S, S);
    const rnd = seeded(91);
    g.lineCap = 'round';
    for (let i = 0; i < 1100; i++) {
      const x = rnd() * S, y = rnd() * S, l = 7 + rnd() * 16, a = -Math.PI / 2 + (rnd() - 0.5) * 1.1, w = 1.5 + rnd() * 3.5;
      const v = (234 + rnd() * 21) | 0, warm = rnd() < 0.5;
      g.strokeStyle = `rgba(${v},${v - (warm ? 4 : 1)},${v - (warm ? 12 : 0)},${0.18 + rnd() * 0.3})`; g.lineWidth = w;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + Math.cos(a + 0.4) * l * 0.5, y + dy + Math.sin(a + 0.4) * l * 0.5, x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke();
      }
    }
  }));
}
// woven straw for the straw hat
function strawTex(THREE) {
  return strawT || (strawT = canvasTex(THREE, (g, S) => {
    g.fillStyle = '#f3dca0'; g.fillRect(0, 0, S, S);
    const rnd = seeded(7), n = 16, h = S / n;
    for (let r = 0; r < n; r++) {
      for (let k = 0; k < 10; k++) {
        const v = (200 + rnd() * 50) | 0;
        g.fillStyle = `rgba(${v},${(v * 0.82) | 0},${(v * 0.48) | 0},0.35)`;
        g.fillRect(0, r * h + rnd() * h, S, 1 + rnd() * 2);
      }
      g.fillStyle = 'rgba(150,110,50,0.35)'; g.fillRect(0, r * h, S, 1.5);
      for (let c = 0; c < n; c++) if ((c + r) % 2 === 0) { g.fillStyle = 'rgba(255,245,210,0.25)'; g.fillRect(c * h, r * h, h, h); }
    }
  }, 128));
}

export function buildHider(THREE, opts = {}) {
  const skinId = SKINS[opts.skin] ? opts.skin : 'classic';
  const S = SKINS[skinId];
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const col = (hex) => new THREE.Color(hex);

  // ---------------------------------------------------------------- body surface model
  // profile (radius, height) of the bean: round belly, soft neck pinch, big round head
  const PROFILE = [[0, 0.03], [0.15, 0.037], [0.252, 0.075], [0.31, 0.135], [0.33, 0.21], [0.322, 0.29], [0.295, 0.37], [0.262, 0.44],
    [0.244, 0.5], [0.252, 0.56], [0.268, 0.63], [0.27, 0.7], [0.255, 0.78], [0.216, 0.85], [0.146, 0.903], [0.058, 0.927], [0, 0.93]];
  const curve = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
  const dense = curve.getPoints(600);
  const R = (y) => {                                     // radius of the (undeformed) body at height y
    if (y <= dense[0].y) return 0;
    for (let i = 1; i < dense.length; i++) if (dense[i].y >= y) {
      const a = dense[i - 1], b = dense[i], t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return Math.max(0, a.x + (b.x - a.x) * t);
    }
    return 0;
  };
  const ZS = 0.94;                                       // a touch shallower front-to-back
  const deform = (v) => {                                // + a forward belly bulge
    const r = Math.hypot(v.x, v.z), c = r > 1e-6 ? Math.max(0, v.z / r) : 0;
    v.z = v.z * ZS + Math.exp(-(((v.y - 0.25) / 0.15) ** 2)) * c * c * 0.045;
    return v;
  };
  const surf = (y, th) => { const r = R(y); return deform(V3(r * Math.sin(th), y, r * Math.cos(th))); };
  const normal = (y, th) => {
    const e = 0.004;
    const ty = surf(y + e, th).sub(surf(y - e, th)), tt = surf(y, th + e).sub(surf(y, th - e));
    return tt.cross(ty).normalize();
  };
  // matrix that puts local +Z along the surface normal at (y, th), local +Y roughly up
  const frame = (y, th, off = 0, extra = null) => {
    const n = normal(y, th), x = V3(0, 1, 0).cross(n).normalize(), up = n.clone().cross(x).normalize();
    const m = new THREE.Matrix4().makeBasis(x, up, n).setPosition(surf(y, th).addScaledVector(n, off));
    return extra ? m.multiply(extra) : m;
  };
  const place = (geo, y, th, off, extra) => geo.applyMatrix4(frame(y, th, off, extra));
  // bend a flat local-XY geometry onto the body (x → around, y → up, z → out along the normal)
  const conform = (geo, y0, th0, off) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const Y = y0 + p.getY(i), th = th0 + p.getX(i) / Math.max(0.05, R(Y));
      const q = surf(Y, th).addScaledVector(normal(Y, th), off + p.getZ(i));
      p.setXYZ(i, q.x, q.y, q.z);
    }
    geo.computeVertexNormals();
    return geo;
  };
  // a shell that follows the head from height y0 up over the crown, `off` metres proud of the surface
  const shell = (y0, off, segs = 40, phiStart = 0, phiLen = Math.PI * 2, flare = 0) => {
    const pts = [];
    for (let i = 1; i < dense.length; i += 11) {
      const a = dense[i - 1], b = dense[Math.min(dense.length - 1, i + 1)];
      if (dense[i].y < y0) continue;
      const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
      const fl = Math.max(0, (y0 + 0.08 - dense[i].y) / 0.08) * flare;
      pts.push(new THREE.Vector2(dense[i].x + (ty / l) * off + fl, dense[i].y - (tx / l) * off));
    }
    pts.push(new THREE.Vector2(0, 0.93 + off));
    const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLen);
    const p = g.attributes.position, v = V3();
    for (let i = 0; i < p.count; i++) { deform(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    return g;
  };

  // ---------------------------------------------------------------- geometry helpers
  // vertex colours: fn(x,y,z,i) → THREE.Color | hex (sRGB). All merged parts carry position/normal/uv/color.
  const paintGeo = (geo, fn) => {
    const p = geo.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color();
    const f = typeof fn === 'function' ? fn : () => fn;
    for (let i = 0; i < p.count; i++) {
      const r = f(p.getX(i), p.getY(i), p.getZ(i), i);
      if (r && r.isColor) c.copy(r); else c.set(r);
      a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  };
  const grey = (v, warm = 0.02) => new THREE.Color(v, v * (1 - warm * 0.5), v * (1 - warm * 1.6));
  const mix = (a, b, t) => col(a).lerp(col(b), Math.min(1, Math.max(0, t)));
  const merge = (geos) => { const g = mergeGeometries(geos, false); geos.forEach((x) => x.dispose()); return g; };
  const xf = (geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) =>
    geo.applyMatrix4(new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V3(...s)));
  const ell = (sx, sy, sz, ws = 16, hs = 12) => new THREE.SphereGeometry(1, ws, hs).scale(sx, sy, sz);
  const tube = (pts, rad, segs = 16, radial = 6, closed = false) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => V3(...q)), closed), segs, rad, radial, closed);
  // a leaf / petal lying flat: base at origin, length along +X, width along Z, thickness along Y.
  // tip: 1 = pointed leaf, 0.5 = rounded petal. cup lifts the edges, curl lifts the tip.
  const leafGeo = (len, hw, thick, { cup = 0, curl = 0, tip = 1, ws = 10, hs = 9, base = null, end = null } = {}) => {
    const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position;
    const a = 0.55, fmax = Math.pow(a / (a + tip), a) * Math.pow(tip / (a + tip), tip);
    const cols = base ? new Float32Array(p.count * 3) : null, cb = base ? col(base) : null, ce = end ? col(end) : null, c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const env = Math.sqrt(Math.max(0, 1 - y * y)), s = (y + 1) / 2;
      const ux = env > 1e-5 ? x / env : 0, uz = env > 1e-5 ? z / env : 0;
      const f = (Math.pow(s, a) * Math.pow(1 - s, tip)) / fmax;
      const w = ux * f * hw;
      p.setXYZ(i, s * len, uz * f * thick + cup * ux * ux * f * hw + curl * s * s * len, w);
      if (cols) { c.copy(cb).lerp(ce, s * 0.85 + Math.abs(ux) * 0.15); if (Math.abs(ux) < 0.12 && s > 0.08) c.multiplyScalar(1.12); cols.set([c.r, c.g, c.b], i * 3); }
    }
    if (cols) g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  };
  // a leaf/petal hanging down from its base (length along -Y, cupped toward +Z)
  const hangGeo = (len, hw, thick, o) => leafGeo(len, hw, thick, o).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2);

  // ---------------------------------------------------------------- materials (per character; cheap)
  const brush = brushTex(THREE);
  const paint = new THREE.MeshStandardMaterial({ color: S.body, map: brush, vertexColors: true, roughness: 0.92, metalness: 0 });
  const std = (extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.9, metalness: 0 }, extra));
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });

  const root = new THREE.Group(); root.name = `hider_${skinId}`;
  const torso = new THREE.Group(); torso.name = 'torso'; root.add(torso);
  const meshes = [];
  const mk = (geo, mat, parent = torso, name = '') => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = true; m.receiveShadow = true;
    parent.add(m); meshes.push(m); return m;
  };

  // ---------------------------------------------------------------- body (one lathe, gradient-shaded)
  const bodyGeo = new THREE.LatheGeometry(curve.getPoints(42), 42);
  { const p = bodyGeo.attributes.position, v = V3(); for (let i = 0; i < p.count; i++) { deform(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); } }
  bodyGeo.computeVertexNormals();
  paintGeo(bodyGeo, (x, y, z) => {
    const r = Math.hypot(x, z) || 1, front = Math.max(0, z / r);
    let v = 0.92;
    v += Math.exp(-(((y - 0.24) / 0.16) ** 2)) * front ** 1.5 * 0.1;   // pale round belly
    v += Math.max(0, (y - 0.55) / 0.4) * 0.06 * (0.5 + front * 0.5);   // bright face / crown
    v -= Math.max(0, (0.14 - y) / 0.11) * 0.12;                         // warm shade underneath
    v -= Math.max(0, -z / r) * 0.03;
    return grey(Math.min(1, v), 0.05);
  });
  const body = mk(bodyGeo, paint, torso, 'body');

  // ---------------------------------------------------------------- face
  const EYE_Y = 0.668, EYE_TH = 0.5;
  const eyes = [], closedG = [];
  for (const sx of [-1, 1]) {
    const iris = paintGeo(ell(0.041, 0.051, 0.018, 18, 12), (x, y) => mix(0x6a3f24, 0x1b100a, (y / 0.051 + 1) / 2 + 0.1));
    const hl1 = paintGeo(xf(ell(0.016, 0.018, 0.006, 10, 8), { p: [-0.013, 0.019, 0.0145] }), 0xffffff);
    const hl2 = paintGeo(xf(ell(0.0075, 0.0075, 0.004, 8, 6), { p: [0.014, -0.019, 0.013] }), 0xfff6ea);
    const tilt = new THREE.Matrix4().makeRotationY(-sx * 0.16);                  // turn the eyes a bit toward the front
    for (const g of [iris, hl1, hl2]) eyes.push(place(g, EYE_Y, sx * EYE_TH, -0.003, tilt));
    const lid = paintGeo(tube([[-0.036, 0.006, 0], [0, -0.016, 0], [0.036, 0.006, 0]], 0.0065, 12, 6), 0x2a1810);
    closedG.push(place(lid, EYE_Y - 0.004, sx * EYE_TH, 0.004, tilt));
  }
  const eyeOpen = mk(merge(eyes), eyeMat, torso, 'eyes');
  const eyeClosed = mk(merge(closedG), eyeMat, torso, 'eyesClosed'); eyeClosed.visible = false;
  eyeOpen.castShadow = eyeClosed.castShadow = false;

  const face = [];
  // open smiling mouth: lower half-ellipsoid + tongue
  face.push(place(paintGeo(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.04, 0.036, 0.013), 0x6b2626), 0.6, 0, 0.0));
  face.push(place(paintGeo(xf(ell(0.022, 0.011, 0.007, 10, 6), { p: [0, -0.023, 0.007] }), 0xe8808a), 0.6, 0, 0.0));
  for (const sx of [-1, 1]) {
    face.push(place(paintGeo(ell(0.055, 0.033, 0.008, 12, 8), 0xf6a69a), 0.618, sx * 0.8, -0.002));
    if (S.brows) face.push(place(paintGeo(tube([[-sx * 0.019, -0.005, 0], [0, 0.003, 0], [sx * 0.019, 0.006, 0]], 0.0042, 8, 5), 0x7a4e30), 0.755, sx * 0.47, 0.004));
  }
  mk(merge(face), std({ roughness: 0.8 }), torso, 'face');

  // ---------------------------------------------------------------- arms & feet (separate pivots for the walk)
  const limbShade = (lo, hi) => (x, y) => grey(Math.min(1, lo + (hi - lo) * y), 0.04);
  const arms = [], feet = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.name = sx < 0 ? 'armL' : 'armR';
    a.position.set(sx * 0.275, 0.41, 0.015); a.rotation.z = sx * 0.4; a.userData.rz = sx * 0.4;
    const g = paintGeo(new THREE.CapsuleGeometry(0.066, 0.1, 5, 12).scale(1, 1, 1.12), limbShade(0.84, 0.96));
    mk(xf(g, { p: [0, -0.09, 0], r: [0.12, 0, 0] }), paint, a, a.name);
    torso.add(a); arms.push(a);
    const f = new THREE.Group(); f.name = sx < 0 ? 'footL' : 'footR';
    f.position.set(sx * 0.13, 0, 0.0); f.rotation.y = sx * 0.12;
    const fg = paintGeo(ell(0.078, 0.052, 0.1, 14, 9), (x, y) => grey(y > 0 ? 0.95 : 0.8, 0.05));
    mk(xf(fg, { p: [0, 0.046, 0.07] }), paint, f, f.name);
    root.add(f); feet.push(f);
  }

  // ---------------------------------------------------------------- hair lobes (classic, bow)
  if (S.hair) {
    const h = S.hair, lob = [];
    lob.push(paintGeo(shell(0.79, 0.016, 36), (x, y) => grey(h * (0.93 + (y - 0.79) * 0.4), 0.04)));
    // big soft petal lobes: a short fringe over the brow, longer ear-like flaps at the sides, a bob at the back
    const LOBES = [[0, 0.768, 0.1], [0.4, 0.776, 0.095], [-0.4, 0.776, 0.095], [0.9, 0.7, 0.11], [-0.9, 0.7, 0.11], [1.45, 0.615, 0.12], [-1.45, 0.615, 0.12],
      [2.05, 0.6, 0.13], [-2.05, 0.6, 0.13], [2.65, 0.585, 0.13], [-2.65, 0.585, 0.13], [Math.PI, 0.58, 0.12]];
    for (const [th, bottom, w] of LOBES) {
      const hh = (0.875 - bottom) / 2;
      const g = paintGeo(ell(w, hh + 0.014, 0.05, 12, 9), (x, y) => grey(h * (0.84 + 0.14 * (y / hh + 1) / 2), 0.05));
      // tilt the lower edge out so the lobes flare like petals
      lob.push(place(g, bottom + hh, th, 0.014, new THREE.Matrix4().makeRotationX(-0.22)));
    }
    // a few soft swirls on the crown
    for (const th of [0.35, 2.45, 4.4]) lob.push(place(paintGeo(ell(0.13, 0.065, 0.04, 12, 8), grey(h * 0.97, 0.03)), 0.882, th, 0.006, new THREE.Matrix4().makeRotationX(-0.3)));
    mk(merge(lob), paint, torso, 'hair');
  }

  // ---------------------------------------------------------------- hats
  const latheFrame = (pts, i, phi) => {                  // point + outward normal on a lathe profile
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], p = pts[i];
    const dr = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dr, dy) || 1;
    const nr = dy / l, ny = -dr / l;
    return { p: V3(p.x * Math.sin(phi), p.y, p.x * Math.cos(phi)), n: V3(nr * Math.sin(phi), ny, nr * Math.cos(phi)) };
  };
  const orient = (pos, n, extra) => {                    // matrix: local +Z along n at pos
    const ref = Math.abs(n.y) > 0.95 ? V3(0, 0, 1) : V3(0, 1, 0);
    const x = ref.clone().cross(n).normalize(), up = n.clone().cross(x).normalize();
    const m = new THREE.Matrix4().makeBasis(x, up, n).setPosition(pos);
    return extra ? m.multiply(extra) : m;
  };
  if (S.hat === 'mushroom') {
    const prof = new THREE.SplineCurve([[0, 0.05], [0.12, 0.03], [0.26, 0.012], [0.355, 0.0], [0.385, 0.04], [0.35, 0.12], [0.26, 0.2], [0.13, 0.245], [0, 0.255]]
      .map(([r, y]) => new THREE.Vector2(r, y))).getPoints(30);
    const cap = paintGeo(new THREE.LatheGeometry(prof, 40), (x, y, z) => {
      const r = Math.hypot(x, z);
      if (y < 0.035 && r < 0.35) return mix(0xe9d3a8, 0xf6e8c8, r / 0.35);   // gills underneath
      return mix(0xb83a2c, 0xe0533c, (y - 0.02) / 0.22).lerp(col(0xf06a4a), Math.max(0, (z / 0.38)) * 0.15);
    });
    const parts = [cap], rnd = seeded(5);
    const SP = [[14, 0.2], [18, 1.4], [16, 2.6], [20, 3.7], [15, 5.0], [24, 0.8], [23, 2.0], [25, 3.1], [22, 4.3], [24, 5.5], [29, 0.1]];
    for (const [i, phi] of SP) {
      const { p, n } = latheFrame(prof, i, phi), s = 0.03 + rnd() * 0.025;
      parts.push(paintGeo(ell(s, s * 0.9, 0.012, 12, 8), 0xfff6e4).applyMatrix4(orient(p.addScaledVector(n, 0.002), n)));
    }
    mk(xf(merge(parts), { p: [0.01, 0.8, -0.01], r: [-0.06, 0, -0.1] }), std({ roughness: 0.75 }), torso, 'hat').castShadow = false;
  } else if (S.hat === 'straw') {
    const prof = [[0.205, 0.0], [0.3, -0.012], [0.4, -0.022], [0.44, -0.012], [0.435, 0.004], [0.36, 0.014], [0.255, 0.025], [0.232, 0.05], [0.228, 0.11], [0.2, 0.155], [0.12, 0.178], [0, 0.182]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const hat = paintGeo(new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(34), 40), (x, y, z) => {
      const r = Math.hypot(x, z);
      if (r < 0.245 && y > 0.03 && y < 0.075) return mix(0xd2603c, 0xe8805a, (y - 0.03) / 0.045);       // ribbon band
      return mix(0xe7c37c, 0xfde8b4, Math.min(1, y / 0.18 + 0.3));
    });
    const parts = [hat];
    for (const [rz, ry, s] of [[0.55, 0.0, 1], [1.05, 0.35, 0.8]]) {
      parts.push(xf(leafGeo(0.13 * s, 0.035 * s, 0.006, { cup: 0.25, curl: 0.06, base: 0x4f8a2c, end: 0x9cc94e }), { p: [0.23, 0.055, 0.03], r: [0, ry, rz] }));
    }
    mk(xf(merge(parts), { p: [0, 0.825, -0.01], r: [-0.08, 0, -0.13] }), std({ map: strawTex(THREE), roughness: 0.95 }), torso, 'hat').castShadow = false;
  } else if (S.hat === 'cloud') {
    const OPEN = 1.12;
    const hoodCol = (x, y) => mix(0x4a86cc, 0x7cb0e6, (y - 0.44) / 0.5);
    const BROW = 0.775;
    const parts = [paintGeo(shell(0.44, 0.03, 30, OPEN, Math.PI * 2 - OPEN * 2, 0.05), hoodCol), paintGeo(shell(BROW, 0.03, 14, -OPEN, OPEN * 2), hoodCol)];
    // rolled rim around the face opening: up one side, across the brow, down the other
    const rim = [], at = (y, phi) => { const r = R(y) + 0.03 + Math.max(0, (0.52 - y) / 0.08) * 0.05; return deform(V3(r * Math.sin(phi), y, r * Math.cos(phi))).toArray(); };
    for (let y = 0.44; y < BROW; y += 0.05) rim.push(at(y, -OPEN));
    for (let k = 0; k <= 8; k++) rim.push(at(BROW + Math.sin((k / 8) * Math.PI) * 0.012, -OPEN + (k / 8) * OPEN * 2));
    for (let y = BROW - 0.05; y >= 0.44; y -= 0.05) rim.push(at(y, OPEN));
    parts.push(paintGeo(tube(rim, 0.016, 40, 6), 0x9fc8ef));
    // droplets on the hood
    for (const [y, th] of [[0.62, 1.6], [0.74, 2.3], [0.58, 2.9], [0.7, -1.7], [0.6, -2.5], [0.82, 1.35], [0.8, -1.25], [0.66, 3.6]]) {
      const m = frame(y, th, 0.034, new THREE.Matrix4().makeRotationZ(Math.PI));
      const d = merge([ell(0.016, 0.016, 0.006, 8, 6), new THREE.ConeGeometry(0.0145, 0.03, 8, 1, true).translate(0, 0.018, 0).scale(1, 1, 0.4)]);
      parts.push(paintGeo(d.applyMatrix4(m), 0xd2ebff));
    }
    // the rain cloud on top
    const puffs = [[0, 0.99, 0, 0.13], [0.12, 0.95, 0.02, 0.1], [-0.12, 0.95, 0.02, 0.1], [0, 0.95, 0.12, 0.1], [0, 0.95, -0.11, 0.1],
      [0.08, 1.04, -0.03, 0.085], [-0.08, 1.04, 0.0, 0.08], [0.08, 0.93, 0.12, 0.075], [-0.09, 0.93, 0.11, 0.075], [0.0, 0.93, -0.16, 0.07]];
    for (const [x, y, z, r] of puffs) parts.push(paintGeo(xf(ell(r, r * 0.86, r, 12, 8), { p: [x, y, z] }), (px, py) => mix(0xb4c8f0, 0xf2f7ff, (py - 0.86) / 0.14)));
    mk(merge(parts), std({ roughness: 0.92, side: THREE.DoubleSide }), torso, 'hat');
  } else if (S.hat === 'flower') {
    const parts = [];
    // outer petals droop over the head like a bonnet (short over the brow), inner ring radiates over the crown
    const petal = (len, hw, y, th, tilt, lo, hi) => place(hangGeo(len, hw, 0.026, { cup: -0.3, curl: 0.02, tip: 0.6, base: lo, end: hi }).translate(0, len / 2, 0),
      y, th, 0.03, new THREE.Matrix4().makeRotationX(tilt));
    for (const [th, len, hw, y] of [[0, 0.15, 0.1, 0.86], [0.78, 0.15, 0.1, 0.855], [-0.78, 0.15, 0.1, 0.855], [1.5, 0.27, 0.12, 0.765], [-1.5, 0.27, 0.12, 0.765],
      [2.3, 0.28, 0.12, 0.76], [-2.3, 0.28, 0.12, 0.76], [Math.PI, 0.28, 0.12, 0.76]]) {
      parts.push(petal(len, hw, y, th, -0.3, 0xe6cffb, 0x9560d6));
    }
    for (let k = 0; k < 6; k++) parts.push(petal(0.15, 0.085, 0.905, (k / 6) * Math.PI * 2 + 0.52, -0.15, 0xf1e2fd, 0xa877de));
    parts.push(paintGeo(xf(ell(0.065, 0.035, 0.065, 16, 10), { p: [0, 0.955, 0] }), (x, y) => mix(0xe39b1c, 0xffd54a, (y - 0.935) / 0.04)));
    const rnd = seeded(3);
    for (let k = 0; k < 12; k++) {
      const a = k * 2.4, rr = 0.018 + (k % 3) * 0.015;
      parts.push(paintGeo(xf(ell(0.012, 0.012, 0.012, 6, 5), { p: [Math.cos(a) * rr, 0.985 - rr * 0.35 + rnd() * 0.004, Math.sin(a) * rr] }), 0xffe27a));
    }
    mk(merge(parts), std({ roughness: 0.85, side: THREE.DoubleSide }), torso, 'hat');
  } else if (S.hat === 'goggles') {
    const parts = [];
    parts.push(paintGeo(shell(0.78, 0.014, 40), (x, y) => mix(0x7b4a2a, 0xa36a3e, (y - 0.78) / 0.16)));
    // seams on the leather cap
    for (const th of [0.95, -0.95, Math.PI]) {
      const pts = []; for (let y = 0.79; y < 0.94; y += 0.025) pts.push(surf(y, th).addScaledVector(normal(y, th), 0.018).toArray());
      parts.push(paintGeo(tube(pts, 0.006, 10, 5), 0x5e3820));
    }
    for (const sx of [-1, 1]) parts.push(place(paintGeo(ell(0.058, 0.1, 0.03, 14, 10), (x, y) => mix(0x6f4224, 0x9a643a, y / 0.1 + 0.5)), 0.7, sx * 1.62, 0.012));
    // strap + goggles on the forehead
    const strapPts = [];
    for (let k = 0; k <= 32; k++) { const th = (k / 32) * Math.PI * 2; const y = 0.805 + Math.cos(th) * 0.035; strapPts.push(surf(y, th).addScaledVector(normal(y, th), 0.026).toArray()); }
    parts.push(paintGeo(tube(strapPts.slice(0, 32), 0.014, 48, 6, true), 0x6a3d22));
    for (const sx of [-1, 1]) {
      const m = frame(0.83, sx * 0.34, 0.05);
      parts.push(paintGeo(new THREE.TorusGeometry(0.05, 0.016, 8, 22).applyMatrix4(m), 0xb8823e));
      parts.push(paintGeo(ell(0.046, 0.046, 0.022, 14, 8).applyMatrix4(m), (x, y) => mix(0x9cc7d6, 0xeaf6fb, 0.5 + (y - 0.83) * 12)));
    }
    parts.push(paintGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6).rotateZ(Math.PI / 2).applyMatrix4(frame(0.835, 0, 0.055)), 0x8a5a2e));
    mk(merge(parts), std({ roughness: 0.6 }), torso, 'hat');
  } else if (S.hat === 'bow') {
    const pinch = (g) => {                                 // squeeze a loop toward its knot end
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), t = Math.min(1, Math.abs(x) / 0.12); p.setY(i, p.getY(i) * (0.35 + 0.65 * Math.sqrt(t))); p.setZ(i, p.getZ(i) * (0.5 + 0.5 * t)); }
      g.computeVertexNormals(); return g;
    };
    const shade = (x, y) => mix(0xd23c68, 0xf27a9c, y / 0.1 + 0.5);
    const parts = [];
    for (const sx of [-1, 1]) {
      parts.push(paintGeo(xf(pinch(ell(0.13, 0.095, 0.055, 18, 12).translate(sx * 0.12, 0, 0)), { r: [0, 0, sx * 0.22] }), shade));
      parts.push(paintGeo(xf(hangGeo(0.13, 0.04, 0.012, { cup: -0.2, tip: 0.8 }), { p: [sx * 0.02, -0.02, -0.02], r: [0.35, 0, sx * 0.45] }), 0xd94a75));
    }
    parts.push(paintGeo(ell(0.048, 0.052, 0.045, 14, 10), 0xc8335d));
    mk(xf(merge(parts), { p: [0.0, 0.95, 0.03], r: [-0.3, 0, 0.12] }), std({ roughness: 0.8, side: THREE.DoubleSide }), torso, 'hat');
  }

  // ---------------------------------------------------------------- collars
  const NECK = 0.515;
  const knot = (th, y, hex, tails = true) => {         // a tied knot with two floppy ends
    const out = [], m = frame(y, th, 0.035);
    out.push(paintGeo(ell(0.034, 0.03, 0.026, 12, 8).applyMatrix4(m), hex));
    if (tails) for (const [rz, len] of [[0.5, 0.11], [-0.35, 0.09]]) {
      out.push(paintGeo(hangGeo(len, 0.035, 0.01, { cup: -0.2, tip: 0.7 }).applyMatrix4(frame(y - 0.01, th + (rz > 0 ? 0.08 : -0.05), 0.04, new THREE.Matrix4().makeRotationZ(rz))), hex));
    }
    return out;
  };
  if (S.collar === 'kerchief' || S.collar === 'scarf') {
    const scarf = S.collar === 'scarf';
    const base = scarf ? 0xcf4436 : 0x4f9a93, alt = scarf ? 0xe25b45 : 0x6fae8f, rnd = seeded(13);
    const mot = () => mix(base, alt, rnd());
    const band = new THREE.TorusGeometry(R(NECK) + 0.006, 0.027, 8, 44).rotateX(Math.PI / 2).scale(1, 0.9, ZS).translate(0, NECK, 0.004);
    const parts = [paintGeo(band, mot)];
    if (!scarf) {
      // the triangular flap draped over the chest
      const flap = new THREE.PlaneGeometry(1, 1, 10, 8), p = flap.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) * 2, v = 0.5 - p.getY(i);         // u -1..1 across, v 0 top → 1 tip
        const w = 0.17 * (1 - v * 0.96), drape = Math.sin(v * Math.PI) * 0.006;
        p.setXYZ(i, u * w, -v * 0.155, 0.006 + drape + (1 - u * u) * 0.004);
      }
      parts.push(paintGeo(conform(flap, NECK - 0.005, -0.05, 0.012), mot));
    }
    parts.push(...knot(0.72, NECK + 0.01, scarf ? 0xbf3a2e : 0x3f8a86));
    if (scarf) parts.push(paintGeo(hangGeo(0.15, 0.04, 0.012, { cup: -0.2, tip: 0.6 }).applyMatrix4(frame(NECK - 0.03, 0.62, 0.05, new THREE.Matrix4().makeRotationZ(0.15))), 0xd94b3b));
    mk(merge(parts), std({ roughness: 0.95, side: THREE.DoubleSide }), torso, 'collar');
  } else if (S.collar) {
    const parts = [], N = S.collar === 'leaves' ? 10 : 12;
    for (let k = 0; k < N; k++) {
      const th = (k / N) * Math.PI * 2 + (S.collar === 'leaves' ? 0.15 : 0);
      let g;
      if (S.collar === 'leaves') g = hangGeo(0.15, 0.06, 0.01, { cup: -0.3, curl: 0.04, tip: 1, base: 0x6f9e3a, end: 0xb4d65a });
      else if (S.collar === 'drops') g = hangGeo(0.12, 0.055, 0.014, { cup: -0.2, tip: 1.1, base: 0x8fc0ee, end: 0x5d97d6 });
      else g = hangGeo(0.115, 0.078, 0.012, { cup: -0.2, curl: 0.0, tip: 0.6, base: S.petal[0], end: S.petal[1] });
      parts.push(place(g, NECK + 0.03, th, 0.008, new THREE.Matrix4().makeRotationX(-0.62)));
    }
    if (S.collar === 'drops') parts.push(...knot(0, NECK + 0.0, 0x5d97d6));
    mk(merge(parts), std({ roughness: 0.9, side: THREE.DoubleSide }), torso, 'collar');
  }

  // ---------------------------------------------------------------- belly emblem (paint material, darker tone)
  if (S.emblem) {
    const lines = [], fills = [];
    const ring = (r, segs = 28) => { const pts = []; for (let k = 0; k < segs; k++) { const a = (k / segs) * Math.PI * 2; pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]); } return pts; };
    const shapeGeo = (shape) => new THREE.ShapeGeometry(shape, 8);
    const E = S.emblem;
    if (E === 'leaf') {
      lines.push(tube(ring(0.058), 0.0045, 40, 5, true));
      const s = new THREE.Shape(); s.moveTo(0, -0.04); s.quadraticCurveTo(0.045, 0, 0, 0.042); s.quadraticCurveTo(-0.045, 0, 0, -0.04);
      fills.push(xf(shapeGeo(s), { r: [0, 0, -0.6] }));
      lines.push(tube([[0.03, -0.045, 0], [0.012, -0.022, 0], [-0.005, 0.0, 0], [-0.016, 0.02, 0]], 0.004, 10, 5));
    } else if (E === 'swirl') {
      const pts = []; for (let k = 0; k <= 40; k++) { const a = k * 0.27, r = 0.008 + k * 0.0012; pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]); }
      lines.push(tube(pts, 0.0055, 60, 5));
      lines.push(tube(ring(0.064), 0.004, 40, 5, true));
    } else if (E === 'drop') {
      const s = new THREE.Shape(); s.moveTo(0, 0.05); s.quadraticCurveTo(0.008, 0.02, 0.03, -0.01); s.absarc(0, -0.018, 0.031, 0.25, Math.PI - 0.25, true); s.quadraticCurveTo(-0.008, 0.02, 0, 0.05);
      fills.push(shapeGeo(s));
    } else if (E === 'fleur') {
      for (const [a, l] of [[0, 0.05], [0.75, 0.04], [-0.75, 0.04]]) {
        const s = new THREE.Shape(); s.absellipse(0, l * 0.5, l * 0.38, l * 0.6, 0, Math.PI * 2);
        fills.push(xf(shapeGeo(s), { p: [0, -0.008, 0], r: [0, 0, a] }));
      }
      lines.push(tube([[0, -0.01, 0], [0.004, -0.035, 0], [-0.004, -0.055, 0]], 0.0045, 8, 5));
    } else if (E === 'sun') {
      const s = new THREE.Shape(); s.absarc(0, 0, 0.026, 0, Math.PI * 2); fills.push(shapeGeo(s));
      lines.push(tube(ring(0.036), 0.0035, 32, 5, true));
      for (let k = 0; k < 8; k++) {
        const r = new THREE.Shape(); r.absellipse(0, 0.055, 0.0075, 0.012, 0, Math.PI * 2);
        fills.push(xf(shapeGeo(r), { r: [0, 0, (k / 8) * Math.PI * 2] }));
      }
    } else if (E === 'heart') {
      const s = new THREE.Shape(); s.moveTo(0, -0.045);
      s.bezierCurveTo(-0.02, -0.025, -0.052, -0.005, -0.048, 0.02); s.bezierCurveTo(-0.044, 0.045, -0.01, 0.048, 0, 0.026);
      s.bezierCurveTo(0.01, 0.048, 0.044, 0.045, 0.048, 0.02); s.bezierCurveTo(0.052, -0.005, 0.02, -0.025, 0, -0.045);
      fills.push(shapeGeo(s));
      lines.push(tube([[0, -0.03, 0], [0.003, -0.005, 0], [0, 0.015, 0]], 0.0035, 8, 5));
    }
    const geos = [...fills.map((g) => g.translate(0, 0, 0.001)), ...lines];
    geos.forEach((g) => paintGeo(g, grey(0.66, 0.06)));
    // lines sit a bit darker on top of fills
    lines.forEach((g) => paintGeo(g, grey(fills.length ? 0.55 : 0.6, 0.06)));
    if (E === 'heart') lines.forEach((g) => paintGeo(g, grey(0.92, 0.02)));
    mk(conform(merge(geos).scale(1.4, 1.4, 1), 0.25, 0, 0.004), paint, torso, 'emblem');
  }

  // ---------------------------------------------------------------- sprout (classic) / tuft (goggles)
  let sprout = null, leaves = [];
  if (S.sprout) {
    sprout = new THREE.Group(); sprout.name = 'sprout';
    const top = S.tuft ? 0.95 : 0.945;
    sprout.position.set(0, top - 0.012, 0.0);
    torso.add(sprout);
    const [lo, hi] = S.sprout;
    const stemH = S.tuft ? 0.02 : 0.085;
    mk(paintGeo(tube([[0, -0.01, 0], [0.004, stemH * 0.5, 0], [-0.003, stemH, 0]], S.tuft ? 0.016 : 0.012, 8, 6), lo), std({ roughness: 0.7 }), sprout, 'stem');
    const leafMat = std({ roughness: 0.6, side: THREE.DoubleSide });
    const specs = S.tuft
      ? [[0.13, 0.05, 1.25, 0.2, -1], [0.13, 0.05, 1.25, 0.2, 1]]
      : [[0.17, 0.076, 0.62, 0.15, -1], [0.19, 0.082, 0.52, -0.05, 1]];
    for (const [len, hw, lift, yaw, sx] of specs) {
      const lg = leafGeo(len, hw, 0.008, { cup: 0.25, curl: -0.04, tip: S.tuft ? 0.8 : 1.15, base: lo, end: hi, ws: 14, hs: 12 });
      const pivot = new THREE.Group(); pivot.position.set(0, stemH, 0);
      pivot.rotation.set(0, sx < 0 ? Math.PI + yaw : yaw, lift);
      pivot.userData.lift = lift;
      mk(lg, leafMat, pivot, sx < 0 ? 'leafL' : 'leafR');
      sprout.add(pivot); leaves.push(pivot);
    }
  }

  // ---------------------------------------------------------------- interface for the game
  const parts = [...root.children, ...meshes];
  const open = [eyeOpen], closed = [eyeClosed];
  let ph = 0, walkK = 0, t = 0, lastBob = 0;
  const footBase = feet.map((f) => f.position.clone());
  const animate = (dt, moving, speed = 0) => {
    const u = root.userData;
    dt = Math.min(dt || 0, 0.1); t += dt;
    walkK += ((moving ? 1 : 0) - walkK) * Math.min(1, dt * 9);
    // follow the game's footstep clock (userData.bob) when it is advancing, otherwise run our own
    const db = (u.bob || 0) - lastBob; lastBob = u.bob || 0;
    if (moving) ph += db > 0 && db < 1.5 ? db : dt * (7 + Math.min(speed, 8) * 1.1);
    const s = Math.sin(ph), c = Math.cos(ph), k = walkK, idle = 1 - k;
    // feet: step forward/back, lift on the forward swing
    feet.forEach((f, i) => {
      const sg = i === 0 ? 1 : -1, sw = s * sg, lift = Math.max(0, c * sg);
      f.position.z = footBase[i].z + sw * 0.075 * k;
      f.position.y = lift * 0.055 * k;
      f.rotation.x = -c * sg * 0.35 * k;
    });
    // torso: hop each step, roll onto the planted foot, lean into the run; breathe when idle
    const breathe = Math.sin(t * 2.3);
    torso.position.y = Math.abs(s) * 0.035 * k;
    torso.rotation.z = -s * 0.085 * k + Math.sin(t * 1.1) * 0.012 * idle;
    torso.rotation.x = 0.07 * k * Math.min(1, speed / 5);
    torso.rotation.y = s * 0.06 * k;
    torso.scale.set(1 - breathe * 0.008 * idle, 1 + breathe * 0.016 * idle, 1 - breathe * 0.008 * idle);
    // arms swing opposite to the feet, flap out a little for the waddle
    arms.forEach((a, i) => {
      const sg = i === 0 ? 1 : -1;
      a.rotation.x = s * sg * 0.6 * k + Math.sin(t * 2.3 + i) * 0.04 * idle;
      a.rotation.z = a.userData.rz + (i === 0 ? -1 : 1) * (Math.abs(s) * 0.18 * k + (breathe + 1) * 0.025 * idle);
    });
    // sprout: lags behind the hop when walking, sways gently in the breeze when still
    if (sprout) {
      sprout.rotation.z = Math.sin(t * 1.6) * 0.1 * idle + s * 0.12 * k;
      sprout.rotation.x = -0.18 * k * Math.min(1, speed / 5) + Math.sin(t * 1.25 + 1) * 0.05 * idle;
      leaves.forEach((l, i) => {
        l.rotation.z = l.userData.lift + Math.sin(t * 2.1 + i * 1.7) * 0.09 * idle + Math.cos(ph * 2) * 0.16 * k;
      });
    }
  };

  root.userData = {
    paint, body, open, closed, parts, squash: 0, bob: 0, jy: 0, vy: 0, animate,
    skin: skinId, skinColor: S.body,
  };
  animate(0, false, 0);
  return root;
}
