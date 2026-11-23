/* Hue & Seek — the four SEEKER characters, hand-modelled in code from Codex's concept art
 * (assets/concepts/char_seekers_lineup.png, assets/concepts/char_action.png).
 *
 * export buildSeeker(THREE, { kind }) → THREE.Group   kind ∈ SEEKER_KINDS (default 'raincoat')
 * Origin at the feet, facing +Z, metres, ~1.55–1.75 m tall.
 *
 * Rig (all child Groups, the root transform belongs to the game):
 *   root ─ legL, legR                 (pivot at the hip joint, swing on X)
 *        └ torso                      (pivot at hip height: bob, lean, twist)
 *            ├ head ─ eyes            (eyes pivot at eye height: blink = scale.y)
 *            ├ upperL ─ foreL         (2-bone IK: hands always stay on the weapon grips)
 *            ├ upperR ─ foreR
 *            └ weapon ─ nozzle        (pose blended hip-carry ↔ aim, held level in root space)
 * Every Group bucket is merged per material into one mesh: cloth (vertex-coloured, painterly mottle + baked soft AO),
 * paint (the character's main clothing colour, unique per character so the game can tint it), eye (unlit), glass.
 */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SEEKER_KINDS = ['raincoat', 'farmer', 'firefighter', 'grandma'];

const PI = Math.PI;
const SKIN = 0xffd2b4, SKIN_SH = 0xf0b090, BLUSH = 0xf59a8c, LASH = 0x2b1712, MOUTH = 0x7c2a30, TONGUE = 0xe8707a, WHITE = 0xfbf8f1;

let SHARED = null;
function shared(THREE) {
  if (SHARED && SHARED.T === THREE) return SHARED;
  SHARED = {
    T: THREE,
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    eye: new THREE.MeshBasicMaterial({ vertexColors: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0xe4f5ff, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.36, depthWrite: false }),
  };
  return SHARED;
}

// per-kind proportions. World coords at rest (feet at 0). sh = shoulder joint (x, y), a/b = upper/fore arm length,
// tw = torso twist at rest (negative brings the left shoulder forward onto the weapon), rest/aim = weapon grip pose.
const DIMS = {
  raincoat: {
    main: 0xf7c531, hipY: 0.6, legX: 0.088, neckY: 1.12, sh: [0.19, 1.05], a: 0.235, b: 0.225, tw: -0.3, twAim: -0.45,
    head: { c: [0, 1.34, 0.012], r: 0.2, s: [1, 0.95, 0.94] },
    rest: { p: [-0.035, 0.84, 0.19], r: [0.03, 0, 0] }, aim: { p: [-0.06, 0.99, 0.24], r: [0, 0, 0] },
    gripF: [0, 0.0, 0.19], nozzle: [0, 0.075, 0.45], pole: [0.55, -0.6, -0.55],
  },
  farmer: {
    main: 0x5b7d92, hipY: 0.58, legX: 0.11, neckY: 1.11, sh: [0.255, 1.06], a: 0.255, b: 0.25, tw: -0.22, twAim: -0.35,
    head: { c: [0, 1.3, 0.02], r: 0.21, s: [1.06, 0.95, 0.95] },
    rest: { p: [-0.03, 0.8, 0.26], r: [0, 0, 0] }, aim: { p: [-0.04, 0.93, 0.27], r: [-0.05, 0, 0] },
    gripF: [0, 0.18, 0.17], nozzle: [0, 0.075, 0.5], pole: [0.6, -0.55, -0.5],
  },
  firefighter: {
    main: 0xe5552d, hipY: 0.8, legX: 0.085, neckY: 1.36, sh: [0.195, 1.3], a: 0.27, b: 0.26, tw: -0.3, twAim: -0.45,
    head: { c: [0, 1.53, 0.012], r: 0.185, s: [0.95, 1.0, 0.95] },
    rest: { p: [-0.035, 1.0, 0.21], r: [0.03, 0, 0] }, aim: { p: [-0.07, 1.2, 0.26], r: [0, 0, 0] },
    gripF: [0, -0.02, 0.2], nozzle: [0, 0.07, 0.47], pole: [0.55, -0.6, -0.55],
  },
  grandma: {
    main: 0x7fa04e, hipY: 0.5, legX: 0.1, neckY: 1.0, sh: [0.255, 0.97], a: 0.245, b: 0.235, tw: -0.3, twAim: -0.42,
    head: { c: [0, 1.19, 0.03], r: 0.2, s: [1.06, 0.95, 0.97] },
    rest: { p: [-0.08, 0.86, 0.25], r: [0, 0, 0] }, aim: { p: [-0.1, 0.98, 0.29], r: [0, 0, 0] },
    gripF: [0.085, -0.17, 0.12], nozzle: [0, 0.07, 0.5], pole: [0.6, -0.55, -0.5],
  },
};

export function buildSeeker(THREE, opts = {}) {
  const kind = SEEKER_KINDS.includes(opts.kind) ? opts.kind : 'raincoat';
  const D = DIMS[kind];
  const S = shared(THREE);
  const V = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
  const X = new V(1, 0, 0), Y = new V(0, 1, 0), Z = new V(0, 0, 1);
  const paint = new THREE.MeshStandardMaterial({ color: D.main, vertexColors: true, roughness: 0.9, metalness: 0 });
  const MAT = { cloth: S.cloth, paint, eye: S.eye, eyeC: S.eye, glass: S.glass };

  // ---------------------------------------------------------------- rig
  const root = new THREE.Group(); root.name = 'seeker_' + kind;
  const G = {}, LOCAL = new Set();
  const grp = (name, parent, pos, local = false) => {
    const g = new THREE.Group(); g.name = name; g.position.set(...pos); g.userData.keep = true; parent.add(g); G[name] = g;
    if (local) LOCAL.add(name);
    return g;
  };
  const hy = D.hipY;
  grp('legL', root, [D.legX, hy, 0]); grp('legR', root, [-D.legX, hy, 0]);
  grp('torso', root, [0, hy, 0]);
  grp('head', G.torso, [0, D.neckY - hy, 0]);
  const eyeEl = kind === 'grandma' ? -0.06 : -0.05;
  const eyeY = D.head.c[1] + D.head.r * D.head.s[1] * Math.sin(eyeEl);
  grp('eyes', G.head, [0, eyeY - D.neckY, 0]);
  grp('upperL', G.torso, [D.sh[0], D.sh[1] - hy, 0], true); grp('foreL', G.upperL, [0, -D.a, 0], true);
  grp('upperR', G.torso, [-D.sh[0], D.sh[1] - hy, 0], true); grp('foreR', G.upperR, [0, -D.a, 0], true);
  grp('weapon', G.torso, [0, 0, 0], true);
  const nozzle = new THREE.Object3D(); nozzle.name = 'nozzle'; nozzle.position.set(...D.nozzle); G.weapon.add(nozzle);
  root.updateMatrixWorld(true);

  // ---------------------------------------------------------------- geometry helpers
  const v = (a) => (a.isVector3 ? a.clone() : new V(a[0], a[1], a[2]));
  const sv = (s) => (typeof s === 'number' ? new V(s, s, s) : v(s));
  const qq = (r) => (!r ? new Q() : r.isQuaternion ? r.clone() : new Q().setFromEuler(new THREE.Euler(r[0], r[1], r[2])));
  const xf = (g, pos = [0, 0, 0], rot = null, scl = 1) => g.applyMatrix4(new M4().compose(v(pos), qq(rot), sv(scl)));
  const sph = (r, pos, scl = 1, rot = null, w = 10, h = 7) => xf(new THREE.SphereGeometry(r, w, h), pos, rot, scl);
  const bowl = (pos, scl, rot) => xf(new THREE.SphereGeometry(1, 16, 6, 0, 2 * PI, PI / 2, PI / 2), pos, rot, scl); // lower half
  const lathe = (pts, pos = [0, 0, 0], scl = 1, rot = null, n = 20, p0 = 0, pl = 2 * PI, flip = false) =>   // profile bottom→top = outward normals
    xf(new THREE.LatheGeometry((flip ? pts.slice().reverse() : pts).map(([r, y]) => new THREE.Vector2(r, y)), n, p0, pl), pos, rot, scl);
  const tor = (R, r, pos, rot = null, scl = 1, arc = 2 * PI, rs = 6, ts = 18) => xf(new THREE.TorusGeometry(R, r, rs, ts, arc), pos, rot, scl);
  const rbox = (w, h, d, rad, pos, rot = null) => xf(new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 0.2 ? 2 : 1, rad), pos, rot);   // small boxes: 1 bevel segment
  const tube = (pts, r, n = 20, rs = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v)), n, r, rs, false);
  // tapered limb between two points with round ends
  const seg = (a, b, r1, r2 = r1, n = 10, caps = true) => {
    const A = v(a), B = v(b), d = B.clone().sub(A), L = d.length();
    const g = new THREE.CylinderGeometry(r2, r1, L, n, 1, true);
    g.applyMatrix4(new M4().compose(A.clone().add(B).multiplyScalar(0.5), new Q().setFromUnitVectors(Y, d.normalize()), new V(1, 1, 1)));
    return caps ? [g, sph(r1, A, 1, null, n, Math.max(4, (n >> 1) - 1)), sph(r2, B, 1, null, n, Math.max(4, (n >> 1) - 1))] : [g];
  };
  // cylinder along +Z (weapons)
  const cylz = (r1, r2, z0, z1, x = 0, y = 0, n = 12, open = false) =>
    xf(new THREE.CylinderGeometry(r2, r1, z1 - z0, n, 1, open), [x, y, (z0 + z1) / 2], [PI / 2, 0, 0]);
  const qn = (n, roll = 0) => { const q = new Q().setFromUnitVectors(Z, v(n).normalize()); if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll)); return q; };
  const nz = (x, y, z) => Math.sin(x * 13.1 + y * 4.3) * 0.5 + Math.sin(y * 16.7 + z * 7.9 + 1.3) * 0.3 + Math.sin(z * 11.3 + x * 9.1 + 2.1) * 0.2;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // add geometry (rest-world coords; arms & weapon in their own local coords) into a group/material bucket
  const buckets = new Map(), col = new THREE.Color();
  const add = (gk, mk, geos, hex = 0xffffff) => {
    for (const g0 of [].concat(geos)) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      col.setHex(hex);
      const P = g.attributes.position, N = g.attributes.normal, c = new Float32Array(P.count * 3);
      const flat = mk === 'eye' || mk === 'eyeC' || mk === 'glass';
      for (let i = 0; i < P.count; i++) {
        let k = 1;
        if (!flat) k = (1 + 0.055 * nz(P.getX(i), P.getY(i), P.getZ(i))) * (0.83 + 0.17 * (0.5 + 0.5 * N.getY(i)));
        c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const key = gk + '|' + mk;
      if (!buckets.has(key)) buckets.set(key, { gk, mk, geos: [] });
      buckets.get(key).geos.push(g);
    }
  };

  // ---------------------------------------------------------------- face (shared by all four)
  const H = D.head, HC = v(H.c), HR = H.r, HS = H.s;
  const surf = (az, el, out = 0) => {
    const d = new V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const p = new V(HC.x + d.x * HR * HS[0], HC.y + d.y * HR * HS[1], HC.z + d.z * HR * HS[2]);
    const n = new V(d.x / HS[0], d.y / HS[1], d.z / HS[2]).normalize();
    return { p: p.addScaledVector(n, out), n, q: qn(n) };
  };
  const dec = (gk, mk, az, el, out, sc, hex, roll = 0, w = 10, h = 7) => {
    const { p, q } = surf(az, el, out); if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll));
    add(gk, mk, sph(1, p, sc, q, w, h), hex);
  };
  const lockGeo = () => {   // teardrop: round top, tapered tip along local -Y
    const g = new THREE.SphereGeometry(1, 10, 8), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < 0) { const k = Math.pow(1 + y, 0.9) * 0.9 + 0.1; P.setXYZ(i, P.getX(i) * k, y * 1.25, P.getZ(i) * k); } }
    g.computeVertexNormals(); return g;
  };
  const lock = (az, el, out, sc, hex, roll = 0, bend = 0) => {   // sculpted hair lock on the head; bend < 0 flicks the tip outward
    const { p, q } = surf(az, el, out);
    if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll)); if (bend) q.multiply(new Q().setFromAxisAngle(X, bend));
    add('head', 'cloth', xf(lockGeo(), p, q, sc), hex);
  };
  const arcAt = (gk, mk, az, el, R, r, arcK, hex, up = true, out = 0.004, roll = 0) => {   // ∪ (up=false) or ∩ (up=true) line
    const { p, q } = surf(az, el, out); if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll));
    const upV = Y.clone().applyQuaternion(q);
    const ctr = p.clone().addScaledVector(upV, up ? -R * 0.72 : R * 0.72);
    const g = new THREE.TorusGeometry(R, r, 6, 16, arcK * PI);
    g.rotateZ(up ? PI / 2 - arcK * PI / 2 : -PI / 2 - arcK * PI / 2);
    g.scale(1, 1, 0.5);
    add(gk, mk, xf(g, ctr, q), hex);
  };
  function face(st) {
    add('head', 'cloth', sph(HR, HC, HS, null, 24, 18), SKIN);
    for (const s of [-1, 1]) {
      dec('head', 'cloth', s * PI / 2, -0.12, -0.012, [0.04, 0.055, 0.03], SKIN);                    // ears
      dec('head', 'cloth', s * 0.57, -0.24, -0.006, [0.045, 0.027, 0.012], BLUSH);                   // rosy cheeks
      const k = st.eyeK || 1, az = s * (st.eyeAz || 0.36), el = eyeEl;
      // e(): place an eye layer offset (dx, dy) metres from the eye centre; layers stack outward (out) so none z-fight
      const e = (dx, dy, out, sc, hex, roll = 0, w = 10, h = 8) => dec('eyes', 'eye', az + (s * dx) / (HR * HS[0]), el + dy / (HR * HS[1]), out, sc, hex, roll, w, h);
      if (st.eyes !== 'small') {
        e(0, 0, -0.014, [0.046 * k, 0.05 * k, 0.03], 0xffffff, 0, 12, 8);                    // white (shows at the sides)
        e(-0.004, -0.002, -0.008, [0.037 * k, 0.054 * k, 0.03], st.iris, 0, 12, 8);          // iris, dark top
        e(-0.004, -0.024 * k, -0.005, [0.029 * k, 0.026 * k, 0.03], st.iris2 || 0xc4834a);  // warm lower iris
        e(-0.004, 0.004 * k, -0.002, [0.019 * k, 0.028 * k, 0.03], 0x120a07);               // pupil
        e(s * 0.014 * k, 0.02 * k, 0.012, [0.014 * k, 0.017 * k, 0.02], 0xffffff, 0, 8, 6);  // big highlight (same side on both eyes)
        e(-s * 0.013 * k, -0.026 * k, 0.01, [0.006 * k, 0.006 * k, 0.02], 0xffffff, 0, 6, 4); // small highlight
        e(0, 0.047 * k, 0.003, [0.052 * k, 0.012, 0.03], LASH, -s * 0.12);                    // upper lid line
        e(0.046 * k, 0.038 * k, 0.004, [0.018, 0.007, 0.02], LASH, -s * 0.6, 8, 4);           // lash flick at the outer corner
      } else {                                                                                // grandma: kind little eyes behind the glasses
        e(0, 0, -0.004, [0.022, 0.029, 0.02], 0x2a1a14);
        e(s * 0.007, 0.01, 0.01, [0.008, 0.009, 0.012], 0xffffff, 0, 8, 6);
        e(0, 0.03, 0.0, [0.03, 0.007, 0.02], 0x8a7a72, -s * 0.15);
      }
      arcAt('head', 'eyeC', az, el - 0.03, 0.04 * k, 0.0075, 0.62, LASH, !!st.happyClosed);        // closed eye line
      dec('head', 'cloth', s * (st.browAz || 0.37), st.browEl || 0.36, st.browOut ?? 0.003, st.browSc || [0.042, 0.009, 0.01], st.brow, s * (st.browRoll || 0)); // brows
    }
    dec('head', 'cloth', 0, -0.17, -0.002, [0.016, 0.012, 0.013], SKIN_SH);                          // nose
    const mel = -0.37;
    if (st.mouth === 'grin' || st.mouth === 'laugh') {
      const w = st.mouth === 'laugh' ? 0.068 : 0.058, { p, q } = surf(0, mel, -0.008);
      add('head', 'cloth', bowl(p, [w, w * 0.85, 0.022], q), MOUTH);
      dec('head', 'cloth', 0, mel - 0.13, -0.002, [w * 0.55, 0.02, 0.016], TONGUE);
      dec('head', 'cloth', 0, mel - 0.018, 0.0, [w * 0.78, 0.01, 0.014], WHITE);
    } else if (st.mouth === 'smile') {
      arcAt('head', 'cloth', 0, mel + 0.02, 0.05, 0.008, 0.5, 0x6e2e28, false, 0.002);
    } else if (st.mouth === 'smirk') {
      arcAt('head', 'cloth', 0.05, mel + 0.03, 0.045, 0.0075, 0.45, 0x6e2e28, false, 0.002, 0.18);
    }
  }

  // torso surface helper (lathe silhouette 'side' = [[r, y]…] bottom→top, scaled in z by sz)
  const rAt = (P, y) => {
    for (let i = 0; i < P.length - 1; i++) { const [r0, y0] = P[i], [r1, y1] = P[i + 1]; if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); }
    return P[P.length - 1][0];
  };
  const onT = (P, sz, az, y, out = 0) => { const r = rAt(P, y) + out; return new V(r * Math.sin(az), y, r * sz * Math.cos(az)); };
  const strap = (P, sz, x, out, yFront, yBack) => {   // a strap from the front over the shoulder to the back
    const pts = [];
    for (const y of [yFront, (yFront + D.sh[1]) / 2 + 0.03]) { const r = rAt(P, y) + out; pts.push(new V(x, y, Math.sqrt(Math.max(0, r * r - x * x)) * sz)); }
    pts.push(new V(x * 1.05, D.sh[1] + 0.085, 0.02), new V(x * 1.05, D.sh[1] + 0.06, -0.08));
    for (const y of [(yBack + D.sh[1]) / 2 + 0.03, yBack]) { const r = rAt(P, y) + out; pts.push(new V(x, y, -Math.sqrt(Math.max(0, r * r - x * x)) * sz)); }
    return pts;
  };
  const checkTowel = (pos, rotY, base, stripe) => {   // checked towel: cloth + painted stripes
    const q = qq([0.08, rotY, 0.06]);
    add('torso', 'cloth', rbox(0.12, 0.2, 0.025, 0.01, pos, q), base);
    for (const dy of [-0.06, 0, 0.06]) add('torso', 'cloth', xf(new THREE.BoxGeometry(0.124, 0.014, 0.028), v(pos).add(new V(0, dy, 0).applyQuaternion(q)), q), stripe);
    for (const dx of [-0.035, 0.035]) add('torso', 'cloth', xf(new THREE.BoxGeometry(0.012, 0.204, 0.029), v(pos).add(new V(dx, 0, 0).applyQuaternion(q)), q), stripe);
  };
  const leaf = (gk, pos, n, size, hex, roll = 0) => add(gk, 'cloth', sph(1, pos, [size * 0.55, size, size * 0.18], qn(n, roll), 10, 8), hex);
  // arms: built hanging down in local coords; IK swings them onto the grips every frame
  function arm(s, o) {
    const u = s > 0 ? 'upperL' : 'upperR', f = s > 0 ? 'foreL' : 'foreR', a = D.a, b = D.b;
    add(u, o.upperMat || 'cloth', sph(1, [0, -0.01, 0], [o.puff || o.r1 * 1.15, o.puff || o.r1 * 1.15, o.puff || o.r1 * 1.15], null, 14, 10), o.upper);
    add(u, o.upperMat || 'cloth', seg([0, 0, 0], [0, -a * (o.sleeve ?? 1), 0], o.r1, o.r1 * 0.92), o.upper);
    if ((o.sleeve ?? 1) < 1) add(u, 'cloth', seg([0, -a * o.sleeve, 0], [0, -a, 0], o.rs, o.rs * 0.95), SKIN);
    if (o.cuffU) add(u, 'cloth', tor(o.r1 * 0.98, 0.016, [0, -a * o.sleeve, 0], [PI / 2, 0, 0], 1, 2 * PI, 6, 16), o.cuffU);
    if (o.foreSleeve) {
      add(f, o.upperMat || 'cloth', seg([0, 0, 0], [0, -b * o.foreSleeve, 0], o.r1 * 0.92, o.r1 * 0.98), o.upper);
      add(f, o.upperMat || 'cloth', sph(1, [0, -b * o.foreSleeve, 0], [o.r1 * 1.12, 0.03, o.r1 * 1.12], null, 14, 8), o.upper);
      add(f, 'cloth', seg([0, -b * o.foreSleeve, 0], [0, -b, 0], 0.034, 0.034, 10, false), SKIN);
    } else add(f, 'cloth', seg([0, 0, 0], [0, -b * 0.9, 0], o.rs * 0.95, o.rs * 0.8), SKIN);
    add(f, 'cloth', sph(1, [0, -b, 0.005], [o.hand, o.hand * 1.1, o.hand * 1.05], null, 14, 10), o.glove || SKIN);
    if (o.glove) add(f, 'cloth', sph(1, [s * -0.01, -b - o.hand * 0.55, 0.03], [o.hand * 0.7, o.hand * 0.45, o.hand * 0.6], null, 10, 8), SKIN); // fingertips
  }
  const legBoots = (gk, x, o) => {   // shared rubber/leather boot
    add(gk, 'cloth', sph(1, [x, o.toeY, o.toeZ], o.toe, null, 16, 12), o.col);
    add(gk, 'cloth', rbox(o.toe[0] * 2.05, 0.04, o.toe[2] * 2 + 0.07, 0.016, [x, 0.02, o.toeZ - 0.035]), o.sole);
  };

  // ================================================================ the four characters
  if (kind === 'raincoat') {
    const YEL2 = 0xe3a624, NAVY = 0x3a4a6e, HAIR = 0x7a4a2c, OL = 0x6f7a4c;
    // legs: bare knees, big yellow rain boots
    for (const s of [-1, 1]) {
      const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
      add(gk, 'cloth', seg([x, 0.63, 0], [x, 0.3, 0.005], 0.058, 0.052), SKIN);
      add(gk, 'cloth', lathe([[0, 0.03], [0.074, 0.03], [0.083, 0.06], [0.08, 0.22], [0.092, 0.33], [0.088, 0.345], [0.075, 0.34], [0.062, 0.32]], [x, 0, -0.01], [1, 1, 1.05], null, 18), 0xf4c22e);
      legBoots(gk, x, { toeY: 0.075, toeZ: 0.06, toe: [0.08, 0.07, 0.12], col: 0xf4c22e, sole: NAVY });
      add(gk, 'cloth', sph(1, [x + s * 0.083, 0.2, -0.01], [0.006, 0.026, 0.04], null, 8, 6), WHITE);           // cloud patch
      add(gk, 'cloth', sph(1, [x + s * 0.083, 0.215, 0.022], [0.006, 0.02, 0.026], null, 8, 6), WHITE);
    }
    // coat (paint): A-line, rounded hem
    const side = [[0.262, 0.53], [0.272, 0.55], [0.258, 0.63], [0.228, 0.76], [0.207, 0.9], [0.2, 0.99], [0.185, 1.05], [0.14, 1.1], [0.08, 1.13]];
    const sz = 0.86;
    add('torso', 'paint', lathe([[0, 0.6], [0.2, 0.535], ...side, [0, 1.14]], [0, 0, 0], [1, 1, sz], null, 24));
    add('torso', 'paint', tor(0.105, 0.045, [0, 1.125, -0.045], [PI / 2 - 0.45, 0, 0], [1, 1, 0.9], 2 * PI, 8, 20), 0xf2f2f2);  // hood rolled at the collar
    add('torso', 'paint', sph(1, [0, 1.12, -0.15], [0.13, 0.075, 0.07]), 0xe6e6e6);
    add('torso', 'cloth', lathe([[0.16, 0.5], [0.175, 0.52], [0.18, 0.62]], [0, 0, 0], [1, 1, 0.9], null, 20), NAVY);          // shorts peek under the coat
    add('torso', 'cloth', seg([0, 1.06, 0], [0, 1.2, 0.01], 0.05, 0.05), SKIN);                                                // neck
    add('torso', 'cloth', tor(0.065, 0.02, [0, 1.12, 0.03], [PI / 2 - 0.3, 0, 0], 1, 2 * PI, 6, 16), 0xf4ead2);               // cream collar
    // closure line, toggles, pockets, cloud patch
    add('torso', 'cloth', tube([0.6, 0.75, 0.9, 1.05].map((y) => onT(side, sz, 0.12, y, 0.002)), 0.006, 12, 5), YEL2);
    for (const y of [0.98, 0.86, 0.74]) {
      const p = onT(side, sz, 0.12, y, 0.012);
      add('torso', 'cloth', sph(1, p, [0.032, 0.012, 0.012], [0, 0.12, 0], 10, 6), 0x3e62a8);
      add('torso', 'cloth', tor(0.012, 0.004, onT(side, sz, 0.02, y, 0.006), [0, 0.02, 0], 1, 2 * PI, 4, 10), 0x3e62a8);
    }
    for (const s of [-1, 1]) {
      const az = s * 0.62, p = onT(side, sz, az, 0.67, 0.004);
      add('torso', 'cloth', rbox(0.11, 0.09, 0.02, 0.009, p, [0.12, az * 0.85, 0]), YEL2);
      add('torso', 'cloth', rbox(0.115, 0.025, 0.024, 0.009, onT(side, sz, az, 0.715, 0.008), [0.12, az * 0.85, 0]), 0xd99a1e);
    }
    for (const [dx, dy, r] of [[0, 0, 0.022], [0.02, 0.005, 0.017], [-0.02, -0.002, 0.016], [0.035, -0.004, 0.012]]) {
      const p = onT(side, sz, 0.55 + dx * 3, 0.66 + dy, 0.016); add('torso', 'cloth', sph(1, p, [r, r * 0.8, 0.006], [0, 0.5, 0], 10, 6), WHITE);
    }
    // backpack + bedroll + straps
    add('torso', 'cloth', rbox(0.28, 0.3, 0.14, 0.05, [0, 0.88, -0.235]), OL);
    add('torso', 'cloth', rbox(0.2, 0.13, 0.05, 0.02, [0, 0.8, -0.315]), 0x5c6740);
    add('torso', 'cloth', xf(cylz(0.062, 0.062, -0.16, 0.16, 0, 0, 14), [0, 1.07, -0.24], [0, PI / 2, 0]), 0x4e6eae);   // bedroll
    for (const s of [-1, 1]) add('torso', 'cloth', tor(0.035, 0.012, [s * 0.16, 1.07, -0.24], [0, PI / 2, 0], 1, 2 * PI, 6, 14), 0x7d95c8);
    for (const s of [-1, 1]) add('torso', 'cloth', tube(strap(side, sz, s * 0.12, 0.012, 0.8, 0.8), 0.016, 24, 6), 0x7a5634);
    // head
    face({ iris: 0x4a2a18, brow: 0x5a3420, browRoll: 0.28, browEl: 0.36, browOut: 0.036, mouth: 'grin' });
    dec('head', 'cloth', -0.62, -0.18, 0.004, [0.03, 0.016, 0.006], 0xf3d6aa, 0.4);                      // band-aid
    add('head', 'cloth', sph(1, [0, 1.36, -0.035], [0.214, 0.2, 0.2], null, 20, 14), HAIR);               // bob mass
    add('head', 'cloth', sph(1, [0, 1.235, -0.075], [0.2, 0.1, 0.15], null, 20, 12), HAIR);
    for (const s of [-1, 1]) {
      lock(s * 0.98, 0.12, 0.012, [0.07, 0.08, 0.035], HAIR, -s * 0.12, -0.15);                                 // face-framing side locks
      lock(s * 1.35, 0.15, 0.03, [0.07, 0.085, 0.045], HAIR, -s * 0.2, -0.25);
      add('head', 'cloth', sph(1, [s * 0.195, 1.17, -0.02], [0.06, 0.045, 0.1], [0, 0, -s * 0.5], 12, 8), HAIR);  // outward flick
      add('head', 'cloth', sph(1, [s * 0.11, 1.18, -0.12], [0.08, 0.05, 0.08], [0, 0, -s * 0.4], 12, 8), HAIR);
    }
    for (const [az, l] of [[-0.62, 0.042], [-0.37, 0.048], [-0.12, 0.05], [0.12, 0.05], [0.37, 0.048], [0.62, 0.042]]) lock(az, 0.47, 0.01, [0.06, l, 0.028], HAIR, -az * 0.3, -0.1);
    // bucket hat (paint) + flower
    const hat = [[0, 0.17], [0.1, 0.166], [0.165, 0.14], [0.2, 0.085], [0.212, 0.02], [0.226, 0.008], [0.29, -0.045], [0.305, -0.058], [0.296, -0.068], [0.23, -0.026], [0.2, -0.01]];
    add('head', 'paint', lathe(hat, [0, 1.43, -0.01], 1, [-0.1, 0, 0], 28, 0, 2 * PI, true));
    add('head', 'paint', lathe([[0.214, 0.035], [0.217, 0.06]], [0, 1.43, -0.01], 1, [-0.1, 0, 0], 28), 0xe0e0e0);
    {
      const n = new V(Math.sin(0.62), 0.25, Math.cos(0.62)).normalize(), c = new V(0.118, 1.462, 0.168), q = qn(n);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 2 * PI, off = new V(Math.cos(a), Math.sin(a), 0).multiplyScalar(0.026).applyQuaternion(q);
        add('head', 'cloth', sph(1, c.clone().add(off), [0.017, 0.028, 0.008], qn(n, a - PI / 2), 10, 6), 0xffffff);
      }
      add('head', 'cloth', sph(0.013, c.clone().addScaledVector(n, 0.006), 1, null, 8, 6), 0xf5c542);
    }
    arm(1, { upper: 0xffffff, upperMat: 'paint', r1: 0.066, puff: 0.075, foreSleeve: 0.72, hand: 0.048 });
    arm(-1, { upper: 0xffffff, upperMat: 'paint', r1: 0.066, puff: 0.075, foreSleeve: 0.72, hand: 0.048 });
    // pump-action water blaster (blue / orange / white, clear tank)
    const BL = 0x3d62b8, OR = 0xf08a2a;
    add('weapon', 'cloth', rbox(0.085, 0.085, 0.36, 0.03, [0, 0.075, 0.1]), BL);
    add('weapon', 'cloth', rbox(0.075, 0.1, 0.13, 0.03, [0, 0.055, -0.135]), BL);
    add('weapon', 'cloth', rbox(0.08, 0.108, 0.03, 0.012, [0, 0.055, -0.2]), OR);
    add('weapon', 'cloth', rbox(0.089, 0.018, 0.3, 0.008, [0, 0.045, 0.1]), WHITE);
    for (const s of [-1, 1]) for (const [dz, dy, r] of [[0, 0, 0.02], [0.022, 0.006, 0.015], [-0.02, 0.002, 0.014]]) add('weapon', 'cloth', sph(1, [s * 0.044, 0.088 + dy, 0.14 + dz], [0.004, r * 0.8, r], null, 8, 6), WHITE);
    add('weapon', 'glass', cylz(0.05, 0.05, -0.06, 0.18, 0, 0.155, 14));
    add('weapon', 'cloth', xf(cylz(0.042, 0.042, -0.055, 0.175, 0, 0, 14), [0, 0.148, 0], null, [1, 0.82, 1]), 0x74c4ee);
    for (const z of [-0.075, 0.195]) add('weapon', 'cloth', cylz(0.054, 0.054, z - 0.015, z + 0.015, 0, 0.155, 14), OR);
    add('weapon', 'cloth', cylz(0.04, 0.04, 0.28, 0.38, 0, 0.075, 14), OR);
    add('weapon', 'cloth', cylz(0.056, 0.056, 0.38, 0.43, 0, 0.075, 14), 0xe0702a);
    add('weapon', 'cloth', sph(1, [0, 0.075, 0.432], [0.026, 0.026, 0.006], null, 10, 6), 0x2a2a35);
    add('weapon', 'cloth', cylz(0.034, 0.034, 0.1, 0.27, 0, 0.01, 14), OR);
    for (const z of [0.13, 0.18, 0.23]) add('weapon', 'cloth', tor(0.034, 0.006, [0, 0.01, z], null, 1, 2 * PI, 5, 14), 0xd8691f);
    add('weapon', 'cloth', rbox(0.045, 0.11, 0.055, 0.018, [0, -0.025, -0.01], [0.35, 0, 0]), OR);
  }

  if (kind === 'farmer') {
    const CREAM = 0xf2e5c8, HAIR = 0x2f2720, STRAW = 0xe2c27a, BRASS = 0xd6ad52, BOOT = 0x6e4a2e;
    for (const s of [-1, 1]) {
      const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
      add(gk, 'paint', seg([x, 0.62, 0], [x, 0.24, 0.01], 0.105, 0.108, 14));
      add(gk, 'cloth', lathe([[0.112, 0.17], [0.118, 0.19], [0.118, 0.24], [0.11, 0.255]], [x, 0, 0.01], 1, null, 18), 0x9db0bb);  // rolled cuff
      add(gk, 'cloth', lathe([[0.07, 0.03], [0.088, 0.06], [0.088, 0.2], [0.07, 0.21]], [x, 0, 0], 1, null, 16), BOOT);
      legBoots(gk, x, { toeY: 0.075, toeZ: 0.07, toe: [0.095, 0.075, 0.13], col: BOOT, sole: 0x46301f });
      add(gk, 'cloth', tor(0.02, 0.005, [x, 0.13, 0.13], [-0.6, 0, 0], 1, 2 * PI, 4, 10), 0xe8d8b0);
    }
    // dungarees body (paint), cream shirt
    const side = [[0.24, 0.54], [0.3, 0.6], [0.318, 0.7], [0.31, 0.8], [0.295, 0.88], [0.27, 0.93]], sz = 0.85;
    add('torso', 'paint', lathe([[0, 0.56], [0.2, 0.53], ...side, [0, 0.95]], [0, 0, 0], [1, 1, sz], null, 24));
    const shirt = [[0.27, 0.86], [0.29, 0.95], [0.29, 1.03], [0.26, 1.09], [0.17, 1.13], [0.05, 1.15]];
    add('torso', 'cloth', lathe([...shirt, [0, 1.15]], [0, 0, 0], [1, 1, 0.84], null, 28), CREAM);
    add('torso', 'cloth', seg([0, 1.05, 0.01], [0, 1.18, 0.02], 0.065, 0.065), SKIN);
    add('torso', 'cloth', tor(0.08, 0.022, [0, 1.13, 0.02], [PI / 2 - 0.2, 0, 0], 1, 2 * PI, 6, 18), CREAM);
    // bib + straps + buttons + leaf emblem
    const bz = rAt(shirt, 1.0) * 0.84 + 0.012;
    add('torso', 'paint', rbox(0.28, 0.22, 0.04, 0.03, [0, 0.97, bz - 0.02], [-0.1, 0, 0]));
    for (const s of [-1, 1]) {
      add('torso', 'paint', tube([new V(s * 0.11, 1.06, bz - 0.02), new V(s * 0.14, 1.13, 0.17), new V(s * 0.15, 1.17, 0.02), new V(s * 0.14, 1.13, -0.14), new V(s * 0.1, 0.98, rAt(shirt, 0.98) * -0.84 - 0.01), new V(s * 0.06, 0.9, -0.255)], 0.022, 24, 6));
      add('torso', 'cloth', sph(1, [s * 0.11, 1.055, bz + 0.005], [0.022, 0.022, 0.012], null, 10, 8), BRASS);
    }
    leaf('torso', [-0.03, 0.97, bz + 0.004], [0, 0.1, 1], 0.045, 0x77a548, 0.6);
    leaf('torso', [0.03, 0.975, bz + 0.004], [0, 0.1, 1], 0.045, 0x8bb85a, -0.6);
    add('torso', 'cloth', seg([0, 0.93, bz + 0.004], [0, 0.965, bz + 0.004], 0.005, 0.005, 6), 0x5d8a3a);
    for (const s of [-1, 1]) add('torso', 'cloth', rbox(0.1, 0.1, 0.02, 0.01, onT(side, sz, s * 0.45, 0.68, 0.006), [0, s * 0.4, 0]), 0x4f6d80);  // pockets
    add('torso', 'cloth', lathe([[0.302, 0.76], [0.312, 0.775], [0.31, 0.8], [0.3, 0.81]], [0, 0, 0], [1, 1, sz], null, 24), 0x6b4a30);    // belt
    add('torso', 'cloth', rbox(0.06, 0.05, 0.02, 0.01, onT(side, sz, 0, 0.785, 0.01), null), BRASS);
    checkTowel(onT(side, sz, -0.9, 0.68, 0.03), -0.9, 0xf3ecd6, 0x8fb06a);
    // head: round face, freckles, grass stalk
    face({ iris: 0x3a2216, iris2: 0x9a6438, brow: 0x2a211c, browRoll: 0.2, browEl: 0.33, browOut: 0.012, browSc: [0.05, 0.013, 0.013], mouth: 'smile', eyeK: 0.9 });
    for (const s of [-1, 1]) for (const [da, de] of [[0, 0], [0.06, 0.025], [0.08, -0.02], [-0.05, 0.02]]) dec('head', 'cloth', s * (0.6 + da), -0.2 + de, 0.001, [0.005, 0.005, 0.004], 0xd99577, 0, 6, 4);
    { const p = surf(0.2, -0.37, 0).p; add('head', 'cloth', seg(p, p.clone().add(new V(0.13, -0.03, 0.09)), 0.0045, 0.0035, 6), 0x7da34a); leaf('head', p.clone().add(new V(0.15, -0.025, 0.1)), [0.3, 1, 0.3], 0.03, 0x8bb85a, 1.2); }
    add('head', 'cloth', sph(1, [0, 1.33, -0.04], [0.225, 0.2, 0.2], null, 18, 12), HAIR);
    for (const [az, el, l, r] of [[-0.6, 0.6, 0.04, 0.45], [-0.32, 0.64, 0.042, -0.3], [-0.05, 0.63, 0.044, 0.35], [0.24, 0.64, 0.042, -0.35], [0.52, 0.6, 0.04, 0.3], [0.8, 0.5, 0.042, -0.2], [-0.85, 0.5, 0.042, 0.2]]) lock(az, el, 0.012, [0.06, l, 0.032], HAIR, r, -0.25);
    for (const s of [-1, 1]) { lock(s * 1.22, 0.22, 0.012, [0.05, 0.05, 0.03], HAIR, s * 0.25, -0.2); lock(s * 1.9, 0.2, 0.02, [0.07, 0.06, 0.04], HAIR, s * 0.4, -0.35); }
    // straw hat with frayed brim
    const hp = [0, 1.45, -0.01], hr = [-0.2, 0, 0.08];
    add('head', 'cloth', lathe([[0, 0.17], [0.09, 0.168], [0.15, 0.15], [0.182, 0.1], [0.192, 0.03], [0.198, 0.012], [0.3, -0.012], [0.37, -0.04], [0.382, -0.05], [0.37, -0.058], [0.29, -0.028], [0.19, -0.006]], hp, 1, hr, 26, 0, 2 * PI, true), STRAW);
    add('head', 'cloth', lathe([[0.194, 0.025], [0.192, 0.075], [0.187, 0.085]], hp, 1, hr, 26), 0x3e4f6a);
    arm(1, { upper: CREAM, r1: 0.085, puff: 0.095, sleeve: 0.55, rs: 0.07, cuffU: 0xe6d6b4, hand: 0.06 });
    arm(-1, { upper: CREAM, r1: 0.085, puff: 0.095, sleeve: 0.55, rs: 0.07, cuffU: 0xe6d6b4, hand: 0.06 });
    // brass watering-can cannon (origin = rear handle, right hand; left hand on the top handle)
    const Cb = new V(0, -0.01, 0.17);
    add('weapon', 'cloth', lathe([[0.122, -0.02], [0.122, 0.05], [0.112, 0.09], [0.075, 0.11], [0, 0.115]], Cb, 1, null, 26), BRASS);
    add('weapon', 'cloth', lathe([[0, -0.125], [0.118, -0.125], [0.126, -0.115]], Cb, 1, null, 26), 0xc49a40);
    add('weapon', 'glass', lathe([[0.124, -0.12], [0.124, -0.02]], Cb, 1, null, 26));
    add('weapon', 'cloth', lathe([[0, -0.118], [0.114, -0.118], [0.114, -0.04], [0, -0.04]], Cb, 1, null, 20), 0x78c3ea);
    for (const y of [-0.12, -0.02]) add('weapon', 'cloth', tor(0.124, 0.01, Cb.clone().add(new V(0, y, 0)), [PI / 2, 0, 0], 1, 2 * PI, 6, 26), 0xc89d42);
    add('weapon', 'cloth', tor(0.085, 0.016, Cb.clone().add(new V(0, 0.105, 0)), [0, PI / 2, 0], 1, PI, 6, 18), BRASS);       // top handle
    add('weapon', 'cloth', tor(0.06, 0.016, [0, -0.01, 0.06], [0, -PI / 2, PI / 2], 1, PI, 6, 16), BRASS);                     // rear handle
    const sp0 = Cb.clone().add(new V(0, -0.04, 0.1)), sp1 = new V(0, 0.06, 0.45), dir = sp1.clone().sub(sp0).normalize();
    add('weapon', 'cloth', seg(sp0, sp1, 0.028, 0.02, 12), BRASS);
    add('weapon', 'cloth', xf(new THREE.CylinderGeometry(0.06, 0.03, 0.05, 18), sp1.clone().addScaledVector(dir, 0.02), new Q().setFromUnitVectors(Y, dir)), BRASS);
    const face0 = sp1.clone().addScaledVector(dir, 0.046);
    add('weapon', 'cloth', sph(1, face0, [0.058, 0.058, 0.008], qn(dir), 16, 6), 0xe7c46e);
    { const q = qn(dir); for (const [x, y] of [[0, 0], [0.025, 0], [-0.025, 0], [0, 0.025], [0, -0.025], [0.018, 0.018], [-0.018, 0.018], [0.018, -0.018], [-0.018, -0.018]]) add('weapon', 'cloth', sph(1, face0.clone().add(new V(x, y, 0.005).applyQuaternion(q)), [0.006, 0.006, 0.004], q, 6, 4), 0x5a4220); }
    for (const s of [-1, 1]) {
      const c = Cb.clone().add(new V(s * 0.124, 0.035, 0));
      leaf('weapon', c.clone().add(new V(0, 0.012, -0.02)), [s, 0, 0], 0.035, 0x6f9e44, s * 0.7);
      leaf('weapon', c.clone().add(new V(0, 0.012, 0.02)), [s, 0, 0], 0.035, 0x86b558, -s * 0.7);
    }
  }

  if (kind === 'firefighter') {
    const SH = 0x6c5a49, RED = 0xcf3d33, HAIR = 0x2a211d, TEE = 0xf3efe6, DARK = 0x3a3a42;
    for (const s of [-1, 1]) {
      const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
      add(gk, 'cloth', seg([x, 0.84, 0], [x, 0.58, 0.012], 0.098, 0.103, 14), SH);                                 // cargo shorts leg
      add(gk, 'cloth', rbox(0.05, 0.1, 0.09, 0.015, [x + s * 0.1, 0.66, 0.012]), 0x5c4b3c);                       // side pocket
      add(gk, 'cloth', seg([x, 0.62, 0.01], [x, 0.17, 0.0], 0.052, 0.042), SKIN);
      add(gk, 'cloth', seg([x, 0.21, 0.0], [x, 0.1, 0.0], 0.048, 0.05, 12, false), 0xf6f3ec);                    // socks
      add(gk, 'cloth', sph(1, [x, 0.095, 0.0], [0.07, 0.075, 0.09], null, 14, 10), RED);
      legBoots(gk, x, { toeY: 0.07, toeZ: 0.07, toe: [0.075, 0.065, 0.12], col: RED, sole: 0xf3eee4 });
      for (const dz of [0.04, 0.07, 0.1]) add(gk, 'cloth', xf(new THREE.BoxGeometry(0.07, 0.008, 0.012), [x, 0.125 - dz * 0.35, dz + 0.01], [0.5, 0, 0]), WHITE);
      add(gk, 'cloth', sph(1, [x + s * 0.068, 0.09, -0.02], [0.006, 0.025, 0.03], null, 8, 6), 0xf1c43c);
    }
    add('torso', 'cloth', lathe([[0, 0.76], [0.17, 0.75], [0.185, 0.8], [0.185, 0.93], [0, 0.94]], [0, 0, 0], [1, 1, 0.82], null, 24), SH);
    const tee = [[0.17, 0.9], [0.18, 1.0], [0.19, 1.2], [0.17, 1.3], [0.1, 1.36], [0.05, 1.37]];
    add('torso', 'cloth', lathe([...tee, [0, 1.37]], [0, 0, 0], [1, 1, 0.8], null, 24), TEE);
    add('torso', 'cloth', seg([0, 1.3, 0], [0, 1.42, 0.01], 0.046, 0.046), SKIN);
    // vest (paint) with reflective bands + collar
    const vest = [[0.198, 0.88], [0.206, 0.96], [0.212, 1.1], [0.21, 1.22], [0.19, 1.3], [0.14, 1.345], [0.12, 1.35]], sz = 0.8;
    add('torso', 'paint', lathe(vest, [0, 0, 0], [1, 1, sz], null, 24));
    for (const y of [0.99, 1.12]) {
      add('torso', 'cloth', lathe([[rAt(vest, y - 0.024) + 0.003, y - 0.024], [rAt(vest, y) + 0.005, y], [rAt(vest, y + 0.024) + 0.003, y + 0.024]], [0, 0, 0], [1, 1, sz], null, 24), 0xf3d23e);
      add('torso', 'cloth', lathe([[rAt(vest, y - 0.007) + 0.006, y - 0.007], [rAt(vest, y + 0.007) + 0.006, y + 0.007]], [0, 0, 0], [1, 1, sz], null, 24), 0xb8b8b4);
    }
    add('torso', 'cloth', tube([0.9, 1.05, 1.2, 1.32].map((y) => onT(vest, sz, 0, y, 0.004)), 0.007, 12, 5), 0xa33325);
    add('torso', 'paint', lathe([[0.1, 1.33], [0.11, 1.36], [0.115, 1.4], [0.105, 1.405]], [0, 0, 0.0], [1, 1, 0.9], null, 20), 0xdddddd);
    // water-tank backpack + harness + hose to the right hip
    const tz = -0.33;
    add('torso', 'glass', lathe([[0.04, 0.88], [0.12, 0.89], [0.13, 0.93], [0.13, 1.38], [0.12, 1.42], [0.05, 1.43]], [0, 0, tz], 1, null, 22));
    add('torso', 'cloth', lathe([[0, 0.9], [0.112, 0.9], [0.118, 0.93], [0.118, 1.24], [0, 1.24]], [0, 0, tz], 1, null, 18), 0x82c8ef);
    add('torso', 'cloth', lathe([[0.13, 1.38], [0.135, 1.42], [0.11, 1.47], [0.05, 1.49], [0, 1.495]], [0, 0, tz], 1, null, 20), RED);
    add('torso', 'cloth', seg([0, 1.49, tz], [0, 1.53, tz], 0.03, 0.032, 12), RED);
    add('torso', 'cloth', lathe([[0, 0.84], [0.11, 0.84], [0.135, 0.87], [0.135, 0.92], [0.12, 0.93]], [0, 0, tz], 1, null, 20), RED);
    for (const y of [1.0, 1.28]) add('torso', 'cloth', tor(0.133, 0.012, [0, y, tz], [PI / 2, 0, 0], 1, 2 * PI, 5, 22), DARK);
    for (const s of [-1, 1]) {
      add('torso', 'cloth', tube(strap(vest, sz, s * 0.11, 0.012, 0.95, 1.0), 0.02, 24, 6), DARK);
      add('torso', 'cloth', rbox(0.045, 0.035, 0.02, 0.006, onT(vest, sz, s * 0.55, 1.2, 0.02), [0, s * 0.5, 0]), 0xb9bcc2);
    }
    add('torso', 'cloth', tube([-0.62, -0.3, 0, 0.3, 0.62].map((a) => onT(vest, sz, a, 1.18, 0.018)), 0.012, 16, 5), DARK);
    add('torso', 'cloth', tube([[0, 0.84, tz], [-0.06, 0.78, tz + 0.02], [-0.19, 0.8, -0.12], [-0.22, 0.82, 0.02], [-0.19, 0.84, 0.12]].map(v), 0.024, 24, 8), 0x3c5aa0);
    // head
    face({ iris: 0x33201a, iris2: 0x9a6a40, brow: 0x241a15, browRoll: 0.32, browEl: 0.35, browOut: 0.024, browSc: [0.046, 0.011, 0.011], mouth: 'smirk', eyeK: 0.92 });
    dec('head', 'cloth', -0.45, -0.12, 0.004, [0.034, 0.017, 0.006], 0xf3d6aa, 0.7);
    add('head', 'cloth', sph(1, [0, 1.535, -0.035], [0.178, 0.168, 0.178], null, 18, 12), HAIR);
    for (const [az, el, l, r] of [[-0.5, 0.5, 0.05, 0.55], [-0.2, 0.53, 0.055, 0.2], [0.1, 0.53, 0.055, -0.15], [0.4, 0.5, 0.05, -0.5]]) lock(az, el - 0.27, 0.0, [0.045, l, 0.024], HAIR, r, -0.3);
    for (const s of [-1, 1]) for (const [az, el, l, r, b] of [[0.95, 0.3, 0.05, 0.7, -0.5], [1.3, 0.25, 0.06, 0.9, -0.7], [1.75, 0.2, 0.06, 1.0, -0.7], [2.3, 0.15, 0.065, 0.6, -0.6]]) lock(s * az, el, 0.012, [0.05, l, 0.03], HAIR, s * r, b);
    lock(PI, 0.1, 0.012, [0.07, 0.07, 0.035], HAIR, 0, -0.5);
    // cap: red crown with a white front panel, red brim
    const cp = [0, 1.585, -0.005], cr = [-0.12, 0, 0], crown = [[0, 0.155], [0.1, 0.15], [0.17, 0.115], [0.207, 0.05], [0.216, 0.0]];
    add('head', 'cloth', lathe(crown, cp, [1, 1, 1.05], cr, 22, PI * 0.28, PI * 1.44, true), RED);
    add('head', 'cloth', lathe(crown, cp, [1, 1, 1.05], cr, 10, -PI * 0.28, PI * 0.56, true), WHITE);
    add('head', 'cloth', sph(0.02, v(cp).add(new V(0, 0.152, -0.02)), [1, 0.6, 1], null, 8, 6), RED);
    add('head', 'cloth', sph(1, v(cp).add(new V(0, 0.012, 0.2)), [0.15, 0.016, 0.135], cr, 18, 8), RED);
    arm(1, { upper: TEE, r1: 0.062, puff: 0.07, sleeve: 0.5, rs: 0.046, cuffU: 0xe4ded2, hand: 0.05, glove: DARK });
    arm(-1, { upper: TEE, r1: 0.062, puff: 0.07, sleeve: 0.5, rs: 0.046, cuffU: 0xe4ded2, hand: 0.05, glove: DARK });
    // hose blaster: red body, clear chamber, orange/yellow nozzle
    add('weapon', 'cloth', cylz(0.042, 0.042, -0.17, 0.08, 0, 0.07, 14), RED);
    add('weapon', 'cloth', rbox(0.07, 0.07, 0.04, 0.02, [0, 0.07, -0.18]), 0xa82e26);
    add('weapon', 'glass', cylz(0.05, 0.05, 0.08, 0.24, 0, 0.07, 14));
    add('weapon', 'cloth', cylz(0.04, 0.04, 0.085, 0.235, 0, 0.065, 14), 0x82c8ef);
    for (const z of [0.08, 0.24]) add('weapon', 'cloth', cylz(0.054, 0.054, z - 0.012, z + 0.012, 0, 0.07, 14), RED);
    add('weapon', 'cloth', cylz(0.04, 0.04, 0.24, 0.32, 0, 0.07, 14), RED);
    add('weapon', 'cloth', cylz(0.042, 0.056, 0.32, 0.41, 0, 0.07, 14), 0xf08a2a);
    add('weapon', 'cloth', cylz(0.06, 0.06, 0.41, 0.445, 0, 0.07, 14), 0xf6cf3e);
    add('weapon', 'cloth', sph(1, [0, 0.07, 0.447], [0.028, 0.028, 0.005], null, 10, 6), 0x2a2a35);
    add('weapon', 'cloth', rbox(0.045, 0.12, 0.055, 0.018, [0, -0.02, -0.005], [0.3, 0, 0]), DARK);
    add('weapon', 'cloth', rbox(0.04, 0.1, 0.045, 0.016, [0, 0.0, 0.2]), DARK);
    add('weapon', 'cloth', tube([[0, 0.05, -0.19], [0, 0.0, -0.27], [-0.02, -0.16, -0.25], [-0.06, -0.24, -0.15]].map(v), 0.022, 18, 8), 0x3c5aa0);
  }

  if (kind === 'grandma') {
    const BLOUSE = 0xf3e7c8, HAIR = 0xcac6cf, PANTS = 0x7e6450, SCARF = 0x7aa258;
    for (const s of [-1, 1]) {
      const gk = s > 0 ? 'legL' : 'legR', x = s * D.legX;
      add(gk, 'cloth', seg([x, 0.52, 0], [x, 0.18, 0.02], 0.112, 0.105, 14), PANTS);
      add(gk, 'cloth', lathe([[0.108, 0.12], [0.118, 0.14], [0.118, 0.19], [0.108, 0.2]], [x, 0, 0.02], 1, null, 18), 0x9c836a);
      add(gk, 'cloth', seg([x, 0.15, 0.02], [x, 0.08, 0.02], 0.045, 0.045, 10, false), SKIN);
      legBoots(gk, x, { toeY: 0.06, toeZ: 0.05, toe: [0.09, 0.065, 0.13], col: 0x5b3d28, sole: 0x3e2a1c });
    }
    // round body: blouse + green pinafore apron (paint)
    const blouse = [[0.24, 0.62], [0.3, 0.72], [0.31, 0.85], [0.29, 0.95], [0.22, 1.03], [0.1, 1.06]];
    add('torso', 'cloth', lathe([[0, 0.6], ...blouse, [0, 1.065]], [0, 0, 0], [1, 1, 0.9], null, 28), BLOUSE);
    for (let i = 0; i < 14; i++) { const az = (i / 14) * 2 * PI + 0.2, y = 0.8 + (i % 3) * 0.08; add('torso', 'cloth', sph(1, onT(blouse, 0.9, az, y, 0.003), [0.016, 0.016, 0.005], [0, az, 0], 8, 5), i % 2 ? 0xe3d38a : 0xc9c9a0); }
    add('torso', 'cloth', seg([0, 0.96, 0.01], [0, 1.06, 0.02], 0.06, 0.06), SKIN);
    add('torso', 'cloth', tor(0.075, 0.02, [0, 1.025, 0.03], [PI / 2 - 0.25, 0, 0], 1, 2 * PI, 6, 18), 0xe8dab8);
    const apron = [[0.31, 0.37], [0.345, 0.4], [0.355, 0.46], [0.34, 0.58], [0.318, 0.7], [0.305, 0.78]], sz = 0.9;
    add('torso', 'paint', lathe([[0, 0.45], [0.26, 0.38], ...apron, [0.2, 0.8], [0, 0.8]], [0, 0, 0], [1, 1, sz], null, 24));
    const bz = rAt(blouse, 0.88) * 0.9 + 0.006;
    add('torso', 'paint', rbox(0.26, 0.2, 0.035, 0.03, [0, 0.86, bz - 0.01], [-0.12, 0, 0]));
    for (const s of [-1, 1]) add('torso', 'paint', tube(strap(blouse, 0.9, s * 0.11, 0.008, 0.92, 0.8), 0.016, 24, 6));
    for (const s of [-1, 1]) add('torso', 'paint', sph(1, [s * 0.05, 0.75, -0.3], [0.06, 0.035, 0.03], [0, 0, s * 0.5], 10, 8), 0xd8d8d8);   // back bow
    for (const s of [-1, 1]) add('torso', 'cloth', rbox(0.13, 0.12, 0.025, 0.012, onT(apron, sz, s * 0.42, 0.55, 0.008), [0.08, s * 0.4, 0]), 0x9aba68);
    for (const dx of [-0.012, 0.012]) add('torso', 'cloth', tor(0.016, 0.005, onT(apron, sz, 0.4 + dx * 3, 0.63, 0.012), [0, 0.4, 0], 1, 2 * PI, 4, 10), 0xd8402e);   // scissors
    leaf('torso', onT(apron, sz, -0.05, 0.86, 0.04).setZ(bz + 0.012).setY(0.87), [0, 0.1, 1], 0.03, 0xa7c97a, 0.6);
    leaf('torso', onT(apron, sz, 0.05, 0.86, 0.04).setZ(bz + 0.012).setY(0.87), [0, 0.1, 1], 0.03, 0xb7d68a, -0.6);
    checkTowel(onT(apron, sz, -0.18, 0.6, 0.03), -0.18, 0xf3ecd6, 0x9cbf72);
    // head: grey bun, headscarf with a bow, round glasses
    face({ eyes: 'small', iris: 0x2a1a14, brow: 0x9a96a0, browRoll: -0.2, browEl: 0.3, browSc: [0.045, 0.01, 0.01], mouth: 'laugh', happyClosed: true, eyeAz: 0.38 });
    add('head', 'cloth', sph(1, [0, 1.25, -0.06], [0.22, 0.19, 0.18], null, 18, 12), HAIR);
    for (const s of [-1, 1]) {
      add('head', 'cloth', sph(1, [s * 0.19, 1.2, -0.02], [0.07, 0.1, 0.1], [0, 0, s * 0.2], 14, 10), HAIR);
      add('head', 'cloth', sph(1, [s * 0.16, 1.12, -0.07], [0.06, 0.06, 0.08], null, 12, 8), 0xbdb8c2);
    }
    for (const [az, l, r] of [[-0.5, 0.045, 0.9], [-0.18, 0.045, 0.5], [0.18, 0.045, -0.5], [0.5, 0.045, -0.9]]) lock(az, 0.47, 0.012, [0.075, l, 0.035], HAIR, r, -0.2);
    add('head', 'cloth', sph(0.105, [0, 1.44, -0.07], [1, 0.9, 1], null, 18, 14), HAIR);
    add('head', 'cloth', tor(0.06, 0.016, [0, 1.47, -0.03], [-0.6, 0, 0], 1, 1.6 * PI, 6, 16), 0xb6b1bc);
    add('head', 'cloth', tor(0.205, 0.03, [0, 1.3, -0.015], [PI / 2 - 0.38, 0, 0], [1.07, 1, 1.0], 2 * PI, 6, 26), SCARF);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * PI, p = new V(Math.sin(a) * 0.249, 0, Math.cos(a) * 0.233).applyEuler(new THREE.Euler(-0.38, 0, 0)).add(new V(0, 1.3, -0.015)); add('head', 'cloth', sph(1, p, [0.013, 0.013, 0.006], qn(new V(p.x, 0.2, p.z + 0.015)), 6, 4), i % 2 ? 0xd9e6a8 : 0xa8c880); }
    for (const s of [-1, 1]) add('head', 'cloth', sph(1, [0.05 + s * 0.055, 1.43, 0.14], [0.055, 0.03, 0.022], [0.4, 0, s * 0.5], 12, 8), SCARF);
    add('head', 'cloth', sph(0.022, [0.05, 1.425, 0.145], 1, null, 8, 6), 0x6d9248);
    for (const s of [-1, 1]) {
      const { p, q } = surf(s * 0.38, eyeEl, 0.03);
      add('head', 'cloth', tor(0.05, 0.0055, p, q, [1, 0.92, 1], 2 * PI, 5, 22), 0x8c6b4a);
      add('head', 'cloth', seg(p.clone().add(new V(s * 0.05, 0.005, -0.01)), surf(s * 1.45, -0.02, 0.01).p, 0.004, 0.004, 5, false), 0x8c6b4a);
    }
    add('head', 'cloth', seg(surf(-0.14, eyeEl + 0.02, 0.03).p, surf(0.14, eyeEl + 0.02, 0.03).p, 0.005, 0.005, 5, false), 0x8c6b4a);
    arm(1, { upper: BLOUSE, r1: 0.075, puff: 0.1, sleeve: 0.62, rs: 0.062, cuffU: 0xe0d2b0, hand: 0.055 });
    arm(-1, { upper: BLOUSE, r1: 0.075, puff: 0.1, sleeve: 0.62, rs: 0.062, cuffU: 0xe0d2b0, hand: 0.055 });
    // garden pump sprayer (origin = trigger handle, right hand; left hand on the bottle side)
    const Bc = new V(0, -0.11, 0.12), GR = 0x5f8f3e;
    add('weapon', 'glass', lathe([[0.03, -0.12], [0.085, -0.12], [0.1, -0.1], [0.106, 0.0], [0.092, 0.07], [0.055, 0.1], [0.045, 0.12]], Bc, 1, null, 22));
    add('weapon', 'cloth', lathe([[0, -0.115], [0.08, -0.115], [0.094, -0.095], [0.099, 0.02], [0, 0.02]], Bc, 1, null, 18), 0x86ccef);
    add('weapon', 'cloth', lathe([[0, -0.128], [0.08, -0.128], [0.09, -0.12], [0.088, -0.11]], Bc, 1, null, 20), GR);
    add('weapon', 'cloth', seg(Bc.clone().add(new V(0, 0.115, 0)), Bc.clone().add(new V(0, 0.155, 0)), 0.052, 0.052, 16), GR);
    add('weapon', 'cloth', seg(Bc.clone().add(new V(0, 0.16, 0)), Bc.clone().add(new V(0, 0.26, 0)), 0.01, 0.01, 8), 0xd8d8d0);
    add('weapon', 'cloth', seg(Bc.clone().add(new V(-0.055, 0.265, 0)), Bc.clone().add(new V(0.055, 0.265, 0)), 0.016, 0.016, 10), 0x3f6a2c);
    add('weapon', 'cloth', seg([0, 0.035, 0.085], [0, -0.025, -0.005], 0.024, 0.022, 10), GR);
    add('weapon', 'cloth', rbox(0.012, 0.05, 0.02, 0.005, [0, -0.0, 0.035], [0.4, 0, 0]), 0xf1c43c);
    add('weapon', 'cloth', seg(Bc.clone().add(new V(0, 0.15, 0.05)), [0, 0.07, 0.44], 0.011, 0.01, 8), 0x4d7a33);
    add('weapon', 'cloth', cylz(0.017, 0.022, 0.44, 0.485, 0, 0.07, 12), 0xf1c43c);
    leaf('weapon', Bc.clone().add(new V(-0.018, -0.03, 0.107)), [0, 0, 1], 0.032, 0x6f9e44, 0.6);
    leaf('weapon', Bc.clone().add(new V(0.018, -0.03, 0.107)), [0, 0, 1], 0.032, 0x86b558, -0.6);
    add('weapon', 'cloth', seg(Bc.clone().add(new V(0, -0.07, 0.106)), Bc.clone().add(new V(0, -0.035, 0.108)), 0.004, 0.004, 5, false), 0x5d8a3a);
  }

  // ---------------------------------------------------------------- merge buckets into meshes
  const tmp = new V();
  let body = null; const open = [], closed = [], parts = [];
  for (const { gk, mk, geos } of buckets.values()) {
    const piv = LOCAL.has(gk) ? new V() : G[gk].getWorldPosition(tmp).clone();
    geos.forEach((g) => g.translate(-piv.x, -piv.y, -piv.z));
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), MAT[mk]);
    geos.forEach((g) => g.dispose());
    mesh.name = gk + '_' + mk;
    mesh.castShadow = mk === 'cloth' || mk === 'paint';
    mesh.receiveShadow = gk !== 'head' && gk !== 'eyes';   // faces never sit in the hat-brim shadow, so they read at a distance
    G[gk].add(mesh);
    if (gk === 'torso' && mk === 'paint') body = mesh;
    if (mk === 'eye') open.push(mesh);
    if (mk === 'eyeC') { closed.push(mesh); mesh.visible = false; } else parts.push(mesh);
  }

  // ---------------------------------------------------------------- animation
  const hip = (p) => new V(p[0], p[1] - hy, p[2]);
  const R0 = { p: hip(D.rest.p), r: new THREE.Euler(...D.rest.r) }, A0 = { p: hip(D.aim.p), r: new THREE.Euler(...D.aim.r) };
  const gripF = v(D.gripF), poleL = v(D.pole), poleR = v(D.pole).multiply(new V(-1, 1, 1));
  const qR = new Q(), qA = new Q(), qW = new Q(), qInv = new Q(), qU = new Q(), qF = new Q(), m4 = new M4();
  const wp = new V(), tA = new V(), tB = new V(), eu = new THREE.Euler(), g1 = new V(), g2 = new V(), du = new V(), pp = new V(), E = new V(), Wt = new V(), ax = new V(), ay = new V(), az3 = new V();
  qR.setFromEuler(R0.r); qA.setFromEuler(A0.r);
  const frameQ = (dir, pole, out) => {   // rotation taking local -Y onto dir, local +Z toward the pole
    ay.copy(dir).negate().normalize();
    az3.copy(pole).addScaledVector(ay, -pole.dot(ay)).normalize();
    ax.crossVectors(ay, az3);
    return out.setFromRotationMatrix(m4.makeBasis(ax, ay, az3));
  };
  const ik = (up, fore, S0, W, pole) => {
    const a = D.a, b = D.b;
    du.subVectors(W, S0); let L = du.length(); du.divideScalar(L || 1);
    const reach = L / (a + b);
    L = Math.min(Math.max(L, Math.abs(a - b) + 0.02), (a + b) * 0.999);
    const cA = (a * a + L * L - b * b) / (2 * a * L), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
    pp.copy(pole).addScaledVector(du, -pole.dot(du)).normalize();
    E.copy(S0).addScaledVector(du, a * cA).addScaledVector(pp, a * sA);
    Wt.copy(S0).addScaledVector(du, L);
    frameQ(g1.subVectors(E, S0), pp, qU); frameQ(g2.subVectors(Wt, E), pp, qF);
    up.quaternion.copy(qU); fore.quaternion.copy(qU).invert().multiply(qF);
    return reach;
  };
  const u = root.userData;
  Object.assign(u, {
    kind, paint, body, open, closed, parts, nozzle, squash: 0, bob: 0, jy: 0, vy: 0, aim: false,
    rig: G, phase: 0, t: 0, mv: 0, run: 0, aimK: 0, blinkT: 2 + (kind.length % 3), reach: [0, 0],
  });
  u.animate = (dt, moving, speed) => {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const sp = moving ? Math.max(speed || 2.5, 0.6) : 0, k8 = Math.min(1, dt * 8);
    u.t += dt;
    u.mv += ((moving ? 1 : 0) - u.mv) * k8;
    u.run += ((sp > 3.5 ? 1 : 0) - u.run) * Math.min(1, dt * 5);
    u.aimK += ((u.aim ? 1 : 0) - u.aimK) * Math.min(1, dt * 12);
    if (moving) u.phase += dt * (3 + sp * 1.7);
    const ph = u.phase, mv = u.mv, run = u.run, aim = u.aimK, still = 1 - mv;
    const sn = Math.sin(ph), cs = Math.cos(ph), br = Math.sin(u.t * 2.1) * still;
    // legs: swing + lift on the forward stroke, feet a little apart when standing
    const amp = (0.42 + 0.25 * run) * mv;
    G.legL.rotation.set(sn * amp, 0, 0.035 * still); G.legR.rotation.set(-sn * amp, 0, -0.035 * still);
    G.legL.position.y = hy + Math.max(0, -cs) * (0.03 + 0.03 * run) * mv;
    G.legR.position.y = hy + Math.max(0, cs) * (0.03 + 0.03 * run) * mv;
    // torso: double-bob per stride, lean into the run, hips twist, breathing
    const bobY = (Math.abs(cs) - 0.6) * (0.04 + 0.03 * run) * mv;
    G.torso.position.y = hy + bobY + br * 0.004;
    const tw = D.tw + (D.twAim - D.tw) * aim + sn * 0.08 * mv * (1 - 0.6 * aim);
    G.torso.rotation.set((0.05 + 0.1 * run) * mv + 0.03 * aim, tw, sn * 0.035 * mv);
    if (body) body.scale.set(1 + br * 0.012, 1, 1 + br * 0.014);
    G.head.rotation.set(-G.torso.rotation.x * 0.6 + Math.sin(u.t * 1.3) * 0.025 * still + 0.07 * aim, -tw * 0.85 + Math.sin(u.t * 0.7) * 0.06 * still * (1 - aim), Math.sin(u.t * 0.9) * 0.03 * still - sn * 0.03 * mv);
    // weapon pose in hip space (held level, pointing +Z in root space), then into torso space
    wp.lerpVectors(R0.p, A0.p, aim);
    const sw = 1 - 0.7 * aim;
    wp.x += sn * 0.022 * mv * sw; wp.y += bobY * -0.5 + (Math.abs(cs) - 0.6) * 0.02 * mv * sw + br * 0.008 + 0.05 * run * (1 - aim);
    qW.slerpQuaternions(qR, qA, aim).multiply(qInv.setFromEuler(eu.set(-0.18 * run * (1 - aim) + cs * 0.04 * mv * sw, cs * 0.05 * mv * sw, sn * 0.08 * mv * sw)));
    qInv.copy(G.torso.quaternion).invert();
    G.weapon.quaternion.copy(qInv).multiply(qW);
    G.weapon.position.copy(wp).applyQuaternion(qInv);
    G.weapon.updateMatrix();
    // 2-bone IK: right hand → rear grip (weapon origin), left hand → front grip
    u.reach[0] = ik(G.upperR, G.foreR, G.upperR.position, tA.set(0, 0, 0).applyMatrix4(G.weapon.matrix), poleR);
    u.reach[1] = ik(G.upperL, G.foreL, G.upperL.position, tB.copy(gripF).applyMatrix4(G.weapon.matrix), poleL);
    // blink (squash the open-eye mesh; never touches visibility, which the game owns)
    u.blinkT -= dt;
    if (u.blinkT < -0.14) u.blinkT = 2.2 + ((Math.sin(u.t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3;
    G.eyes.scale.y = u.blinkT < 0 ? 0.12 : 1;
  };
  u.animate(0, false, 0);
  return root;
}
