/* Turret cottage — hand-modelled in code from Codex's concept paintings (assets/concepts/house_turret.png, interiors
 * assets/interiors/turret_living.png + turret_tower.png).
 * export buildHouse(THREE, opts) → THREE.Group 'turret'. Origin = ground centre, front (door) faces +Z. Metres.
 * Sage-green plaster cottage with a steep dark-slate gable roof (gable to the front) and warm timber trim, joined at its
 * right side to a round rubble-stone tower with a conical slate roof, finial and small arched windows. A slate door
 * hood and a timber pergola carry purple wisteria with hanging instanced blossom clusters; yellow-green shutters, flower
 * boxes, a wall lantern and stone steps. Instanced slates / stones / leaves / blossoms / books keep it phone-friendly.
 * Enterable: hollow walls, an open arched doorway, two ground-floor rooms (library-living room with inglenook fireplace,
 * and the round astronomer's tower room through a stone arch). Everything above the walls lives in the 'roof' group.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

const greyCache = {};

export function buildHouse(THREE, opts = {}) {
  const garden = opts.garden !== false;               // false = in-game: no decor that could be mistaken for a hideable prop
  const PI = Math.PI;
  const XL = -4.6, XR = 1.1, W = XR - XL, MX = (XL + XR) / 2;   // main cottage, ridge runs front-to-back (gable faces +Z)
  const D = 5.6, FRONT = D / 2, H = 3.0, RISE = 3.1;
  const FW = FRONT + 0.05;                                         // outer face of the walls
  const T = 0.26;                                                  // wall thickness
  const IXL = XL - 0.05 + T, IXR = XR + 0.05 - T, IZ = FW - T;     // inner faces of the living room
  const TX = 1.95, TZ = 0.1, TR = 2.8, TRI = TR - 0.28, TH = 6.0;  // round tower: centre, outer / inner radius, wall height
  const FL = 0.05;                                                 // floor level
  const doorX = -0.6, DW = 1.4, DH = 1.65;                         // front doorway: centre, width, straight height (+ arch)
  const ARCHZ = 0.6;                                               // arched opening living room → tower (in the shared wall)
  const OX = 0.0;                                                // final shift so the whole silhouette is centred on x = 0
  let seed = opts.seed || 7; const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const tex = (n, rx = 1, ry = 1) => kitTex(THREE, n, rx, ry);
  const matCache = {};
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  // painted kit texture used as greyscale detail under a clean colour (interior sage plaster, pale tower stone)
  const G = (hex, map, norm, k = 0.7) => {
    const key = `${hex}|${map.uuid}|${norm}|${k}`;
    if (greyCache[key]) return greyCache[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, map, roughness: 0.95, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  diffuseColor.rgb *= mix( 1.0, clamp( dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) / ${norm.toFixed(3)}, 0.0, 1.4 ), ${k.toFixed(2)} );
#endif`);
    };
    m.customProgramCacheKey = () => `greymap|${norm}|${k}`;
    return (greyCache[key] = m);
  };

  // ---------------- materials (Codex's painted kit textures, light tints)
  const plaster = M(opts.wall || 0x90c49c, tex('plaster', 0.32, 0.32));      // sage green
  const inPlaster = G(0xb4c896, tex('plaster', 0.45, 0.45), 0.707, 0.7);     // interior: soft sage lime plaster
  const towerIn = G(0xe2d2b8, tex('stone', 0.42, 0.42), 0.447, 0.75);       // interior: pale dressed stone
  const floorMat = G(0xc08a5c, tex('wood_planks_dark', 0.42, 0.42), 0.107, 0.8);
  const stoneM = M(0xffffff, null);                                           // instanced stones: per-stone grey-beige colours
  const stoneSlab = M(0xe2ded8, tex('plaster', 0.5, 0.5));
  const mortar = M(0x8a8478, null);
  const timber = M(0xa8784c, tex('wood_light', 0.5, 0.5));
  const timberLight = M(0xd8b07a, tex('wood_light', 0.6, 0.6));
  const doorWood = M(0xd9944e, tex('wood_light', 0.9, 0.9));
  const darkWood = M(0x6e4223, null);
  const shutterMat = M(0xc4e890, tex('plaster', 0.6, 0.6));                  // yellow-green painted boards
  const sofaMat = M(0xa6c79c, tex('plaster', 0.8, 0.8));                     // squashy sage sofa
  const ceramic = M(0xf6f1e6, null);
  const brass = M(0xc8902e, null, { roughness: 0.85 });
  const flame = M(0xffb050, null, { emissive: 0xff7a18, emissiveIntensity: 1.5, roughness: 0.85 });
  const soot = M(0x3b3530, null, { roughness: 0.85 });
  const iron = M(0x3b3530, null, { roughness: 0.85 });
  const warmGlass = M(0xffd38a, null, { emissive: 0xc77a2a, emissiveIntensity: 0.55, roughness: 0.85 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd894, emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.85 });
  const slateUnder = M(0x3f4656, null);
  const slateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const bark = M(0x9a7a5e, tex('bark', 1, 1));
  const paintMat = M(0xffffff, null);                                         // instanced books / fabrics / rugs: per-instance colours

  const root = new THREE.Group();
  root.name = 'turret';
  // everything above the walls (roofs, gables, ceiling, chimney stack, upper tower) — the game hides it while you're inside
  const roof = new THREE.Group();
  roof.name = 'roof'; roof.userData.keep = true; root.add(roof);
  const inRoof = (P) => { for (let a = P; a; a = a.parent) if (a === roof) return true; return false; };
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, P = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; P.add(mesh); return mesh;
  };
  const rbox = (w, h, d, r, mat, seg = Math.min(w, h, d) < 0.16 ? 1 : 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  const ib = (w, h, d, r, mat) => rbox(w, h, d, r, mat, 1);                    // interior furniture: one bevel segment
  const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  // a wall frame: local x runs along the wall, local z points out of it (or into the room for interior frames), y up
  const frame = (x, z, ry, P = root) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.updateMatrix(); P.add(g); return g; };
  const Pf = frame(0, FW, 0), Pr = frame(XR + 0.05, 0, PI / 2), Pb = frame(0, -FW, PI), Pl = frame(XL - 0.05, 0, -PI / 2);
  const PfR = frame(0, FW, 0, roof), PbR = frame(0, -FW, PI, roof);
  const towerFrame = (a, r = TR, P = root) => frame(TX + Math.sin(a) * r, TZ + Math.cos(a) * r, a, P);   // tangent frame on the tower
  const pol = (a, r) => [TX + Math.sin(a) * r, TZ + Math.cos(a) * r];

  // ---------------- instanced pools (one draw call each)
  const pools = {};
  const pool = (k, geo, mat, par = root) => (pools[k] = { geo, mat, par, items: [] });
  const o3 = new THREE.Object3D();
  const pushM = (k, m, col) => pools[k].items.push([m, col]);
  const put = (k, P, x, y, z, rx, ry, rz, sx, sy, sz, col) => {
    o3.position.set(x, y, z); o3.rotation.set(rx, ry, rz); o3.scale.set(sx, sy, sz); o3.updateMatrix();
    pushM(k, P && P !== root && P !== roof ? o3.matrix.clone().premultiply(P.matrix) : o3.matrix.clone(), col);
  };
  const tint = (hex, l = 0.05, s = 0.04) => new THREE.Color(hex).offsetHSL(jr(-0.01, 0.01), jr(-s, s), jr(-l, l));
  const pebGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const domeGeo = (() => { const g = new THREE.SphereGeometry(0.5, 8, 3, 0, 2 * PI, 0, PI / 2); g.rotateX(PI / 2); return g; })();   // wall stones: domed face out (+z)
  const blockGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.22);
  const slateGeo = new THREE.BoxGeometry(1, 1, 1);
  const leafGeo = (() => { const g = new THREE.CircleGeometry(0.1, 6); g.scale(1, 1.4, 1); return g; })();
  const bloomGeo = new THREE.IcosahedronGeometry(0.075, 0);
  pool('peb', pebGeo, stoneM);                       // rounded rubble stones
  pool('dome', domeGeo, stoneM); pool('domeR', domeGeo, stoneM, roof);
  pool('block', blockGeo, stoneM); pool('blockR', blockGeo, stoneM, roof);     // dressed stones: voussoirs, sills, chimney
  pool('slate', slateGeo, slateMat, roof); pool('hslate', slateGeo, slateMat);  // flat slates: main roof / door hood
  {
    // fish-scale slates for the cone: rounded bottom edge, centred unit size (len along y, thickness along z)
    const s = new THREE.Shape();
    s.moveTo(-0.5, 1); s.lineTo(-0.5, 0.4); s.absarc(0, 0.4, 0.5, PI, 2 * PI, false); s.lineTo(0.5, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 4 }); g.translate(0, -0.45, -0.5);
    pool('scale', g, slateMat, roof);
  }
  pool('leaf', leafGeo, leafMat); pool('leafR', leafGeo, leafMat, roof);
  pool('bloom', bloomGeo, blossomMat); pool('bloomR', bloomGeo, blossomMat, roof);
  pool('book', new THREE.BoxGeometry(1, 1, 1), paintMat);                      // books, rug patterns, star chart
  pool('cush', new RoundedBoxGeometry(1, 1, 1, 1, 0.3), paintMat);            // cushions, throws, curtains, runners
  pool('disc', new THREE.CylinderGeometry(1, 1, 1, 28), paintMat);            // round rugs
  const STONES = [0xcfc6b4, 0xbfb5a2, 0xd8cfbd, 0xb3a893, 0xc8bca6, 0xa99e8a, 0xd2c4a8];
  const stoneCol = () => tint(STONES[Math.floor(rr() * STONES.length)], 0.05, 0.05);
  const peb = (P, x, y, z, w, h, d) => put('peb', P, x, y, z, jr(-0.12, 0.12), jr(-0.12, 0.12), jr(-0.2, 0.2), w, h, d, stoneCol());
  const block = (P, x, y, z, w, h, d, rz = 0) => put(inRoof(P) ? 'blockR' : 'block', P, x, y, z, 0, 0, rz + jr(-0.03, 0.03), w, h, d, stoneCol());
  const SLATES = [0x5b6478, 0x4f5869, 0x667086, 0x58617a, 0x6c7488, 0x4a5262, 0x737b8e];
  const slateCol = () => tint(SLATES[Math.floor(rr() * SLATES.length)], 0.04, 0.03);
  const GREENS = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55];
  const leaf = (P, x, y, z, s = 1, pal = GREENS) => put(inRoof(P) ? 'leafR' : 'leaf', P, x, y, z, jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28), s * jr(0.7, 1.25), s * jr(0.7, 1.25), s, tint(pal[Math.floor(rr() * pal.length)], 0.05, 0.02));
  const bloom = (P, x, y, z, c, s = 1) => { const k = s * jr(0.8, 1.3); put(inRoof(P) ? 'bloomR' : 'bloom', P, x, y, z, jr(0, 6), jr(0, 6), 0, k, k, k, tint(c, 0.04, 0.03)); };
  const cush = (P, x, y, z, sx, sy, sz, col, rx = 0, ry = 0, rz = 0) => put('cush', P, x, y, z, rx, ry, rz, sx, sy, sz, tint(col, 0.03, 0.03));
  const inTower = (x, z, pad = 0) => Math.hypot(x - TX, z - TZ) < TR + pad;

  // ---------------- hollow walls: an outer (sage) and an inner skin, with real openings for the door, windows and the arch
  const wallSlab = (P, a, b, holes, door, mat, z0, z1, top = H) => {
    const s = new THREE.Shape();
    s.moveTo(a, 0);
    if (door) { const [dx, dw, dh] = door, r = dw / 2; s.lineTo(dx - r, 0); s.lineTo(dx - r, dh); s.absarc(dx, dh, r, PI, 0, true); s.lineTo(dx + r, 0); }
    s.lineTo(b, 0); s.lineTo(b, top); s.lineTo(a, top); s.closePath();
    for (const [x, y, w, h] of holes) { const p = new THREE.Path(); p.moveTo(x - w / 2, y - h / 2); p.lineTo(x + w / 2, y - h / 2); p.lineTo(x + w / 2, y + h / 2); p.lineTo(x - w / 2, y + h / 2); p.closePath(); s.holes.push(p); }
    const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, z0);
    return add(new THREE.Mesh(g, mat), 0, 0, 0, 0, 0, 0, P);
  };
  const FWIN = [-3.4, 1.65, 0.82, 0.9];                                   // front ground window (under the wisteria)
  const LWIN = [[-0.4, 1.65, 0.85, 0.85], [1.9, 1.65, 0.6, 0.8]];        // left wall windows (local x = world z)
  {
    const both = (P, a, b, holes, door) => { wallSlab(P, a, b, holes, door, plaster, -0.12, 0); wallSlab(P, a, b, holes, door, inPlaster, -T, -0.12); };
    both(Pf, XL - 0.05, XR + 0.05, [FWIN], [doorX, DW, DH]);
    both(Pb, -(XR + 0.05), -(XL - 0.05), []);
    both(Pl, -(FW - T), FW - T, LWIN);
    // shared wall to the tower: stone on the tower side (plaster only on the little bit outside, behind the tower)
    const zx = TZ - Math.sqrt(TR * TR - (XR + 0.05 - TX) ** 2);           // where the tower meets it at the back (world z)
    wallSlab(Pr, -(FW - T), -zx, [], [-ARCHZ, 1.36, 1.7], towerIn, -0.12, 0);
    wallSlab(Pr, -zx, FW - T, [], null, plaster, -0.12, 0);
    wallSlab(Pr, -(FW - T), FW - T, [], [-ARCHZ, 1.36, 1.7], inPlaster, -T, -0.12);
    // gables above the walls (roof group)
    const tri = (P, cx) => {
      const s = new THREE.Shape(); s.moveTo(cx - W / 2 - 0.05, H); s.lineTo(cx + W / 2 + 0.05, H); s.lineTo(cx, H + RISE); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }); g.translate(0, 0, -T);
      add(new THREE.Mesh(g, plaster), 0, 0, 0, 0, 0, 0, P);
    };
    tri(PfR, MX); tri(PbR, -MX);
  }
  // floors: plank slabs at y = 0..FL (UVs in metres so the planks run continuously)
  const floorSlab = (pts) => {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: FL, bevelEnabled: false }); g.rotateX(-PI / 2);
    add(new THREE.Mesh(g, floorMat));
  };
  floorSlab([[XL - 0.05, FW], [XR + 0.05, FW], [XR + 0.05, -FW], [XL - 0.05, -FW]]);
  {
    const pts = [], aS = Math.asin((XR + 0.05 - TX) / (TRI + 0.04));
    for (let i = 0; i <= 40; i++) pts.push(pol(aS + (i / 40) * (PI - 2 * aS), TRI + 0.04));
    floorSlab(pts.reverse());
  }
  // rubble plinth along the cottage walls (skipping the door and where the tower swallows the corner)
  const plinth = (P, a, b, skip) => {
    for (let course = 0; course < 2; course++) {
      let x = a - 0.05 + course * 0.18;
      while (x < b + 0.05) {
        const sw = jr(0.32, 0.5), cx = x + sw / 2;
        if (!skip || !skip(cx)) peb(P, cx, 0.11 + course * 0.2, 0.05, sw, jr(0.2, 0.26), 0.2);
        x += sw * 0.92;
      }
    }
  };
  plinth(Pf, XL, XR, (x) => Math.abs(x - doorX) < DW / 2 + 0.35 || inTower(x, FW, 0.1));
  plinth(Pb, -XR, -XL); plinth(Pl, -FRONT, FRONT); plinth(Pr, -FRONT, FRONT, (x) => inTower(XR, -x, 0.1));
  // ---------------- timber frame: corner posts, front & back tie beams, left wall plate (gable braces up in the roof)
  for (const [x, z] of [[XL, 1], [XL, -1], [XR, -1]]) add(rbox(0.24, H, 0.24, 0.04, timber), x + Math.sign(x) * 0.02, H / 2 + 0.1, z * (FRONT + 0.03));
  add(rbox(W + 0.5, 0.26, 0.26, 0.05, timber), MX - 0.1, H, FRONT + 0.06);
  add(rbox(W + 0.6, 0.26, 0.26, 0.05, timber), MX, H, -FRONT - 0.06);
  add(rbox(0.24, 0.24, D + 0.4, 0.05, timber), XL - 0.04, H - 0.05, 0);
  for (const sx of [-1, 1]) add(rbox(0.16, 1.5, 0.16, 0.04, timber), MX + sx * 1.2, H + 0.75, -(FRONT + 0.08), 0, 0, sx * 0.5, roof);   // back gable braces

  // ---------------- gable roofs of instanced slates (main roof in the roof group, door hood outside it)
  const slope = (half, rise) => ({ theta: Math.atan2(rise, half), run: Math.hypot(half, rise) });
  const deck = (P, sx, theta, ridgeY, len, z0, z1) => {
    add(rbox(len, 0.12, z1 - z0, 0.04, slateUnder), sx * Math.cos(theta) * len / 2, ridgeY - Math.sin(theta) * len / 2 - 0.08, (z0 + z1) / 2, 0, 0, sx * -theta, P);
  };
  const barge = (P, sx, theta, ridgeY, len, z, t = 0.32) => {
    add(rbox(len + 0.1, t, 0.13, 0.04, timber), sx * Math.cos(theta) * len / 2, ridgeY - Math.sin(theta) * len / 2 - 0.2 * t / 0.32, z, 0, 0, sx * -theta, P);
  };
  // ridge along local z (za..zb) in frame P; slopes fall to x = ±half at eaveY
  const slateRoof = (P, half, rise, eaveY, za, zb, over, skip, sw = 0.3, sl = 0.44, step = 0.22) => {
    const { theta, run } = slope(half, rise), slopeLen = run + over, ridgeY = eaveY + rise + 0.12;
    const rows = Math.floor((slopeLen - 0.1) / step), len = zb - za, cols = Math.ceil(len / sw);
    const o = new THREE.Object3D(), w = new THREE.Vector3(), key = inRoof(P) ? 'slate' : 'hslate';
    for (const sx of [-1, 1]) for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
      const z = za + (c + (r % 2) * 0.5) * sw + jr(-0.012, 0.012);
      if (z > zb - 0.02 || z < za + sw * 0.35) continue;
      const sdist = 0.22 + r * step + jr(-0.01, 0.01), sag = Math.sin(((z - za) / len) * PI) * 0.04;
      o.position.set(sx * Math.cos(theta) * sdist, ridgeY + 0.03 - Math.sin(theta) * sdist - sag * 0.4, z);
      o.rotation.set(0, 0, -sx * (theta - 0.06)); o.rotateY(jr(-0.03, 0.03)); o.rotateX(jr(-0.02, 0.02));
      o.scale.set(sl, 0.035, sw * jr(0.92, 1.0)); o.updateMatrix();
      const col = slateCol(), m = o.matrix.clone().premultiply(P.matrix);
      if (skip) { w.setFromMatrixPosition(m); if (skip(w)) continue; }
      pushM(key, m, col);
    }
    return { theta, slopeLen, ridgeY };
  };
  const ridgeMat = M(0x5a6070, null);
  {
    // main roof: ridge along z, gable to the front
    const P = frame(MX, 0, 0, roof), OVF = 0.5, za = -FRONT - OVF, zb = FRONT + OVF;
    const { theta, slopeLen, ridgeY } = slateRoof(P, W / 2, RISE, H, za, zb, 0.3, (w) => inTower(w.x, w.z, -0.04), 0.34, 0.5, 0.25);
    for (const sx of [-1, 1]) { deck(P, sx, theta, ridgeY, slopeLen, za, zb); for (const z of [za - 0.03, zb + 0.03]) barge(P, sx, theta, ridgeY, slopeLen, z); }
    add(rbox(0.3, 0.2, zb - za + 0.12, 0.08, ridgeMat), 0, ridgeY + 0.06, 0, 0, 0, 0, P);
    for (const sz of [-1, 1]) {                                                       // turned timber finials on both gable apexes
      add(rbox(0.13, 0.62, 0.13, 0.04, timber), 0, ridgeY + 0.1, sz * (zb + 0.04), 0, 0, 0, P);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), timber), 0, ridgeY + 0.47, sz * (zb + 0.04), 0, 0, 0, P);
    }
    // purlin ends + carved brackets poking out of both gables
    for (const t of [0.3, 0.62, 0.92]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = MX + sx * (W / 2) * t, py = H + RISE * (1 - t) - 0.22;
      if (inTower(px, sz * FRONT, 0.2)) continue;
      add(rbox(0.2, 0.2, 0.5, 0.05, timber), px, py, sz * (FRONT + 0.25), 0, 0, 0, roof);
      add(rbox(0.14, 0.3, 0.14, 0.04, timber), px, py - 0.22, sz * (FRONT + 0.12), sz * 0.6, 0, 0, roof);
    }
    // plank ceiling + beams over the living room (seen only from outside through the windows)
    add(new THREE.Mesh(new THREE.BoxGeometry(IXR - IXL, 0.08, 2 * IZ), timberLight), MX, H + 0.04, 0, 0, 0, 0, roof);
    for (const z of [-1.6, 0, 1.6]) add(rbox(IXR - IXL, 0.2, 0.2, 0.04, timber), MX, H - 0.08, z, 0, 0, 0, roof);
  }
  // ---------------- stone chimney stack rising from the inglenook on the back wall (stack above the walls → roof)
  const FX = -1.9;                                                    // fireplace / chimney x
  {
    const cx = FX, cz = -FW + 0.36, top = 7.0;
    add(rbox(0.7, top - H, 0.7, 0.05, mortar), cx, (top + H) / 2, cz, 0, 0, 0, roof);
    for (let y = H + 0.15, j = 0; y < top - 0.1; y += 0.26, j++) for (let f = 0; f < 4; f++) {
      const a = (f * PI) / 2, nx = Math.sin(a) * 0.36, nz = Math.cos(a) * 0.36;
      for (const off of j % 2 ? [-0.18, 0.18] : [0]) put('domeR', roof, cx + nx + Math.cos(a) * off, y, cz + nz - Math.sin(a) * off, 0, a, jr(-0.03, 0.03), j % 2 ? 0.35 : 0.72, 0.23, 0.12, stoneCol());
    }
    add(rbox(0.94, 0.14, 0.94, 0.05, stoneSlab), cx, top + 0.04, cz, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.36, 10), M(0xffcfa8, tex('terracotta', 1, 1))), cx, top + 0.28, cz, 0, 0, 0, roof);
  }

  // ---------------- the round stone tower: thick hollow wall, courses of rubble stones, cornice, conical slate roof, finial
  const twin = [[0.55, 1.45, 0.62, 0.55], [1.5, 1.45, 0.62, 0.55], [2.45, 1.45, 0.62, 0.55], [0.25, 4.3, 0.52, 0.42], [1.95, 3.9, 0.5, 0.4], [-0.1, 5.15, 0.34, 0.22]];   // [angle, sill y, width, straight height]
  {
    // the ground-storey wall: an annular sector from where it meets the shared wall all the way round (pale stone)
    const sector = (r0, r1) => {
      const a0 = Math.asin((XR + 0.05 - TX) / r1), a1 = Math.asin((XR + 0.05 - TX) / r0), s = new THREE.Shape(), N = 48;
      for (let i = 0; i <= N; i++) { const a = a0 + (i / N) * (PI - 2 * a0), [x, z] = pol(a, r1); i ? s.lineTo(x, -z) : s.moveTo(x, -z); }
      for (let i = N; i >= 0; i--) { const a = a1 + (i / N) * (PI - 2 * a1), [x, z] = pol(a, r0); s.lineTo(x, -z); }
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-PI / 2);
      return g;
    };
    add(new THREE.Mesh(sector(TRI, TR - 0.04), towerIn));
    add(new THREE.Mesh(new THREE.CylinderGeometry(TR - 0.04, TR - 0.04, TH - H, 40, 1, true), mortar), TX, (TH + H) / 2, TZ, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.CircleGeometry(TRI + 0.02, 40), timberLight), TX, H + 0.02, TZ, PI / 2, 0, 0, roof);   // tower ceiling
    const roofTop = (x) => H + RISE * (1 - Math.abs(x - MX) / (W / 2));
    for (let j = 0, y = 0.1; y < TH - 0.12; j++) {
      // one course: stones of random width walked round the tower, staggered course to course
      const ch = Math.min(jr(0.26, 0.36), TH - 0.05 - y), a0 = jr(0, 0.4);
      for (let a = a0; a < a0 + 2 * PI - 0.12;) {
        const w = jr(0.36, 0.66), da = w / TR, ac = a + da / 2; a += da;
        const x = TX + Math.sin(ac) * (TR + 0.02), z = TZ + Math.cos(ac) * (TR + 0.02), yy = y + ch / 2 + jr(-0.02, 0.02);
        if (x < XR + 0.1 && z < FRONT + 0.08 && yy < Math.max(H + 0.1, roofTop(x) - 0.15)) continue;           // buried in the cottage
        if (twin.some(([wa, wy, ww, wh]) => Math.abs(Math.atan2(Math.sin(ac - wa), Math.cos(ac - wa))) * TR < ww / 2 + 0.22 && yy > wy - 0.12 && yy < wy + wh + ww / 2 + 0.2)) continue;
        put(yy + ch / 2 > H + 0.02 ? 'domeR' : 'dome', root, x, yy, z, jr(-0.08, 0.08), ac + jr(-0.06, 0.06), jr(-0.12, 0.12), w * 1.04, ch * jr(0.9, 1.08), jr(0.16, 0.26), stoneCol());
      }
      y += ch;
    }
    // cornice: a ring of corbel blocks + a timber eave ring under the cone
    for (let k = 0; k < 40; k++) { const a = (k / 40) * 2 * PI; put('blockR', roof, TX + Math.sin(a) * (TR + 0.1), TH - 0.05, TZ + Math.cos(a) * (TR + 0.1), 0, a, 0, 0.42, 0.26, 0.32, stoneCol()); }
    add(new THREE.Mesh(new THREE.CylinderGeometry(TR + 0.28, TR + 0.24, 0.18, 40), timber), TX, TH + 0.13, TZ, 0, 0, 0, roof);
    // cone: dark underlay + rings of rounded fish-scale slates, sweeping out slightly at the eave
    const RB = TR + 0.22, HC = 3.0, base = TH + 0.15, L = Math.hypot(RB, HC), beta = Math.atan2(RB, HC);
    add(new THREE.Mesh(new THREE.ConeGeometry(RB - 0.04, HC, 40, 1, true), slateUnder), TX, base + HC / 2, TZ, 0, 0, 0, roof);
    const SW = 0.4, SL = 0.52, STEP = 0.3;
    for (let i = 0, s = 0; s < L - 0.3; i++, s += STEP) {
      const sc = s + SL * 0.5, r = RB * (1 - sc / L) + 0.04, y = base + HC * (sc / L);
      const n = Math.max(7, Math.ceil((2 * PI * r) / (SW * 0.9)));
      for (let k = 0; k < n; k++) {
        const a = ((k + (i % 2) * 0.5) / n) * 2 * PI + jr(-0.02, 0.02);
        o3.position.set(TX + Math.sin(a) * r, y, TZ + Math.cos(a) * r);
        o3.rotation.set(0, 0, 0); o3.rotateY(a); o3.rotateX(-(beta + 0.1) + jr(-0.03, 0.03)); o3.rotateZ(jr(-0.04, 0.04));
        o3.scale.set(Math.min(SW, (2 * PI * r) / n * 1.15), SL, 0.04); o3.updateMatrix();
        pushM('scale', o3.matrix.clone(), slateCol());
      }
    }
    // finial: collar, ball and spike
    const ft = base + HC;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.26, 10), iron), TX, ft - 0.02, TZ, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), iron), TX, ft + 0.2, TZ, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.55, 6), iron), TX, ft + 0.55, TZ, 0, 0, 0, roof);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 5, 10), iron), TX, ft + 0.4, TZ, PI / 2, 0, 0, roof);
    // small arched windows in the tower (outside face); the ground-storey ones get a deep niche inside too
    for (const [a, wy, ww, wh] of twin) {
      const up = wy > H, G = towerFrame(a, TR + 0.02, up ? roof : root), r = ww / 2;
      const s = new THREE.Shape();
      s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, wh); s.absarc(0, wh, r, 0, PI, false); s.lineTo(-r, 0);
      const glassGeo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false, curveSegments: 10 });
      add(new THREE.Mesh(glassGeo, warmGlass), 0, wy, -0.02, 0, 0, 0, G);
      for (const sx of [-1, 1]) add(rbox(0.07, wh, 0.12, 0.025, timberLight), sx * (r + 0.035), wy + wh / 2, 0.04, 0, 0, 0, G);
      add(new THREE.Mesh(new THREE.TorusGeometry(r + 0.035, 0.04, 6, 12, PI), timberLight), 0, wy + wh, 0.06, 0, 0, 0, G);
      add(rbox(0.035, wh + r, 0.05, 0.012, timberLight), 0, wy + (wh + r) / 2, 0.04, 0, 0, 0, G);
      add(rbox(ww, 0.035, 0.05, 0.012, timberLight), 0, wy + wh * 0.6, 0.04, 0, 0, 0, G);
      for (let i = 0; i <= 7; i++) { const t = (i / 7) * PI, rad = r + 0.16; block(G, Math.cos(t) * rad, wy + wh + Math.sin(t) * rad, 0.1, 0.2, 0.17, 0.2, t - PI / 2); }
      for (const sx of [-1, 1]) for (let j = 0; j < 2; j++) block(G, sx * (r + (j ? 0.13 : 0.16)), wy + 0.1 + j * (wh / 2 + 0.02), 0.1, j ? 0.2 : 0.26, wh / 2 - 0.02, 0.2);
      block(G, 0, wy - 0.07, 0.14, ww + 0.36, 0.12, 0.28);
      if (up) continue;
      // inside: glowing arched pane in a splayed stone niche with a deep sill and a little built-in planter
      const I = frame(...pol(a, TRI), a + PI);
      add(new THREE.Mesh(glassGeo, warmGlass), 0, wy, -0.03, 0, 0, 0, I);
      add(rbox(0.035, wh + r, 0.05, 0.012, timberLight), 0, wy + (wh + r) / 2, 0.03, 0, 0, 0, I);
      add(rbox(ww, 0.035, 0.05, 0.012, timberLight), 0, wy + wh * 0.6, 0.03, 0, 0, 0, I);
      for (let i = 0; i <= 8; i++) { const t = (i / 8) * PI, rad = r + 0.13; block(I, Math.cos(t) * rad, wy + wh + Math.sin(t) * rad, 0.04, 0.2, 0.16, 0.12, t - PI / 2); }
      for (const sx of [-1, 1]) block(I, sx * (r + 0.12), wy + wh / 2, 0.04, 0.18, wh + 0.05, 0.12);
      add(rbox(ww + 0.5, 0.1, 0.36, 0.03, stoneSlab), 0, wy - 0.05, 0.12, 0, 0, 0, I);
      add(ib(0.36, 0.14, 0.18, 0.03, M(0xffcfa8, tex('terracotta', 1, 1))), 0.12 * Math.sign(a - 1.5 || 1), wy + 0.07, 0.15, 0, 0, 0, I);
      for (let k = 0; k < 9; k++) leaf(I, 0.12 * Math.sign(a - 1.5 || 1) + jr(-0.16, 0.16), wy + 0.16 + jr(0, 0.12), 0.15 + jr(-0.08, 0.08), 0.8, [0x8fbf6a, 0x7fb05e, 0xa3c97a]);
    }
  }

  // ---------------- open arched front doorway in a stone surround, the door leaf swung back against the inner wall
  {
    const r = DW / 2, by = 0.02;
    for (let i = 0; i <= 13; i++) {
      const a = (i / 13) * PI, rad = r + 0.17;
      block(Pf, doorX + Math.cos(a) * rad, by + DH + Math.sin(a) * rad, 0.03, 0.26, 0.24, 0.22, a - PI / 2);
    }
    for (const sxx of [-1, 1]) for (let j = 0; j < 5; j++) {
      const wide = (j + (sxx > 0 ? 1 : 0)) % 2 === 0;
      block(Pf, doorX + sxx * (r + (wide ? 0.2 : 0.15)), by + 0.18 + j * 0.34, 0.03, wide ? 0.32 : 0.22, 0.31, 0.22);
    }
    add(rbox(DW + 0.6, 0.1, 0.8, 0.04, stoneSlab), doorX, 0.05, 0.4, 0, 0.02, 0, Pf);                       // flat threshold step
    add(rbox(DW + 0.04, 0.1, T + 0.06, 0.03, stoneSlab), doorX, 0.03, -T / 2, 0, 0, 0, Pf);                 // sill through the wall
    // timber architrave inside
    for (const sx of [-1, 1]) add(ib(0.12, DH, 0.08, 0.03, timber), doorX + sx * (r + 0.06), FL + DH / 2, -T - 0.03, 0, 0, 0, Pf);
    add(new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.05, 5, 14, PI), timber), doorX, DH, -T - 0.03, 0, 0, 0, Pf);
    // the door leaf, open against the inner face of the front wall (hinged on the left jamb)
    const lw = DW - 0.04, lr = lw / 2, s = new THREE.Shape();
    s.moveTo(-lr, 0); s.lineTo(lr, 0); s.lineTo(lr, DH); s.absarc(0, DH, lr, 0, PI, false); s.lineTo(-lr, 0);
    const lx = doorX - r - lr - 0.04, lz = -T - 0.12;
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }), doorWood), lx, FL, lz - 0.04, 0, 0, 0, Pf);
    for (let k = -3; k <= 3; k++) add(rbox(0.025, DH + lr * (1 - Math.abs(k) * 0.08), 0.02, 0.008, darkWood, 1), lx + k * 0.19, FL + (DH + lr * 0.9) / 2, lz - 0.07, 0, 0, 0, Pf);
    for (const y of [0.45, 1.45]) add(rbox(lw * 0.96, 0.07, 0.03, 0.015, iron, 1), lx, FL + y, lz - 0.08, 0, 0, 0, Pf);
    add(rbox(0.26, 0.2, 0.03, 0.01, warmGlass, 1), lx, FL + 1.75, lz - 0.07, 0, 0, 0, Pf);
    // hood: little gable of slates projecting from the wall, on two carved brackets
    const P = frame(doorX, FW, 0), half = 1.05, rise = 0.62, eave = 2.98, za = 0, zb = 1.05;
    const { theta, slopeLen, ridgeY } = slateRoof(P, half, rise, eave, za, zb, 0.22, (w) => inTower(w.x, w.z, -0.04), 0.26, 0.36, 0.18);
    for (const sx of [-1, 1]) { deck(P, sx, theta, ridgeY, slopeLen, za, zb); barge(P, sx, theta, ridgeY, slopeLen, zb + 0.03, 0.22); }
    add(rbox(0.2, 0.14, zb + 0.1, 0.06, ridgeMat), 0, ridgeY + 0.05, zb / 2, 0, 0, 0, P);
    add(rbox(2 * half + 0.2, 0.14, 0.14, 0.04, timber), 0, eave - 0.02, zb - 0.05, 0, 0, 0, P);          // tie beam of the little gable
    add(rbox(0.1, rise - 0.05, 0.1, 0.03, timber), 0, eave + rise / 2, zb - 0.05, 0, 0, 0, P);          // king post
    for (const sx of [-1, 1]) {
      add(rbox(0.12, 0.12, zb, 0.03, timber), sx * half, eave - 0.02, zb / 2, 0, 0, 0, P);               // side beams into the wall
      add(rbox(0.1, 0.95, 0.1, 0.03, timber), sx * half, eave - 0.45, 0.32, -0.78, 0, 0, P);             // diagonal bracket
    }
  }
  // ---------------- iron wall lantern on the tower beside the door (real light only here)
  const lantern = (G, lx, ly, lz = 0) => {
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14, PI / 2), iron), lx - 0.02, ly + 0.08, lz + 0.11, 0, PI / 2, 0, G);
    add(rbox(0.06, 0.2, 0.04, 0.015, iron), lx - 0.02, ly + 0.02, lz + 0.02, 0, 0, 0, G);
    add(rbox(0.22, 0.3, 0.22, 0.03, glow), lx + 0.02, ly - 0.08, lz + 0.27, 0, 0, 0, G);
    add(rbox(0.28, 0.05, 0.28, 0.02, iron), lx + 0.02, ly + 0.09, lz + 0.27, 0, 0, 0, G);
    add(rbox(0.26, 0.04, 0.26, 0.02, iron), lx + 0.02, ly - 0.25, lz + 0.27, 0, 0, 0, G);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 4), iron), lx + 0.02, ly + 0.19, lz + 0.27, 0, PI / 4, 0, G);
  };
  {
    const G = towerFrame(-0.15, TR + 0.12);
    lantern(G, 0, 2.25);
    if (opts.light !== false) { const pl = new THREE.PointLight(0xffb45a, 1.2, 4, 2); pl.position.copy(new THREE.Vector3(0.02, 2.15, 0.45).applyMatrix4(G.matrix)); root.add(pl); }
  }

  // ---------------- windows with yellow-green board shutters and flower boxes
  const shutter = (P, x, y, w, h, side, z = 0.08) => {
    const sh = new THREE.Group();
    for (let k = 0; k < 3; k++) add(rbox(w / 3 - 0.012, h, 0.05, 0.012, shutterMat, 1), (k - 1) * (w / 3), 0, 0, 0, 0, 0, sh);
    for (const yy of [h * 0.3, -h * 0.3]) add(rbox(w * 0.9, 0.07, 0.03, 0.01, shutterMat, 1), 0, yy, 0.035, 0, 0, 0, sh);
    sh.position.set(x, y, z); sh.rotation.y = -side * 0.22; P.add(sh);
  };
  const flowerBox = (P, x, y, w, cols, n) => {
    add(rbox(w, 0.24, 0.3, 0.04, timberLight), x, y, 0.17, 0, 0, 0, P);
    for (let k = 0; k < w * 34; k++) leaf(P, x + jr(-w / 2, w / 2), y + 0.12 + jr(-0.02, 0.16), 0.2 + jr(-0.1, 0.16));
    for (let k = 0; k < w * 10; k++) leaf(P, x + jr(-w / 2, w / 2), y - jr(0, 0.25), 0.34 + jr(0, 0.05));
    for (let k = 0; k < n; k++) bloom(P, x + jr(-w / 2 + 0.05, w / 2 - 0.05), y + 0.18 + jr(0, 0.2), 0.19 + jr(-0.1, 0.13), cols[k % cols.length]);
  };
  const windowUnit = (P, x, y, w, h, flowers, shut = true) => {
    const fr = 0.08;
    add(rbox(w, h, 0.06, 0.02, warmGlass), x, y, 0.0, 0, 0, 0, P);
    add(rbox(w + fr * 2, fr, 0.14, 0.03, timberLight), x, y + h / 2 + fr / 2, 0.03, 0, 0, 0, P);
    add(rbox(w + fr * 2.6, fr * 1.4, 0.24, 0.03, timberLight), x, y - h / 2 - fr * 0.6, 0.08, 0, 0, 0, P);
    for (const s of [-1, 1]) add(rbox(fr, h, 0.14, 0.03, timberLight), x + s * (w / 2 + fr / 2), y, 0.03, 0, 0, 0, P);
    add(rbox(0.045, h, 0.08, 0.015, timberLight), x, y, 0.05, 0, 0, 0, P);
    add(rbox(w, 0.045, 0.08, 0.015, timberLight), x, y + h * 0.12, 0.05, 0, 0, 0, P);
    add(rbox(w + 0.36, 0.14, 0.14, 0.04, timber), x, y + h / 2 + 0.17, 0.05, 0, 0, 0, P);                      // timber lintel
    if (shut) for (const s of [-1, 1]) shutter(P, x + s * (w / 2 + fr + w * 0.28 + 0.02), y, w * 0.56, h + 0.06, s);
    if (flowers) flowerBox(P, x, y - h / 2 - 0.25, w + 0.25, flowers, 24);
  };
  const YELLOW = [0xffd23f, 0xffc21a, 0xfff07a, 0xff9f2e];
  windowUnit(Pf, FWIN[0], FWIN[1], FWIN[2], FWIN[3], YELLOW);                 // ground-floor window under the wisteria
  windowUnit(PfR, MX, H + 0.95, 0.72, 0.72, [0xffd23f, 0xffffff, 0xffe066, 0xff9f2e]);   // attic window in the gable
  windowUnit(Pl, LWIN[0][0], LWIN[0][1], LWIN[0][2], LWIN[0][3], null);
  windowUnit(Pl, LWIN[1][0], LWIN[1][1], LWIN[1][2], LWIN[1][3], null);
  windowUnit(PbR, -MX, H + 0.95, 0.6, 0.6, null, false);

  const WGREEN = [0x6fae4d, 0x7cbc55, 0x8cc760, 0x5f9c45, 0x9acf6a];
  const LILAC = [0x6a3fa6, 0x8457c4, 0xa47ddb, 0xc3a6ec, 0xe2d4f7];
  // ---------------- wisteria pergola on the front-left: posts, beams, joists, slats; gnarled trunks
  const PZ = FW + 1.2, PX0 = -4.6, PX1 = -1.95;
  {
    for (const x of [PX0 + 0.1, PX1]) add(rbox(0.18, 2.78, 0.18, 0.04, timber), x, 1.39, PZ, jr(-0.02, 0.02), 0, jr(-0.02, 0.02));
    add(rbox(PX1 - PX0 + 0.25, 0.16, 0.14, 0.04, timber), (PX0 + PX1) / 2, 2.62, FW + 0.07);            // ledger on the wall
    add(rbox(PX1 - PX0 + 0.55, 0.2, 0.18, 0.05, timber), (PX0 + PX1) / 2, 2.84, PZ);                    // front beam
    for (let k = 0; k < 5; k++) { const x = PX0 + 0.05 + k * ((PX1 - PX0) / 4); add(rbox(0.12, 0.17, PZ - FW + 0.4, 0.04, timber), x, 2.97, (FW + PZ + 0.25) / 2); }
    for (let k = 0; k < 4; k++) add(rbox(PX1 - PX0 + 0.4, 0.07, 0.08, 0.02, timberLight), (PX0 + PX1) / 2, 3.09, FW + 0.25 + k * 0.38);
    for (const x of [PX0 + 0.1, PX1]) for (const sx of [-1, 1]) {
      if ((x === PX0 + 0.1 && sx < 0) || (x === PX1 && sx > 0)) continue;
      add(rbox(0.08, 0.6, 0.08, 0.02, timber), x + sx * 0.22, 2.55, PZ, 0, 0, -sx * 0.75);
    }
    // two old twisting trunks climbing the posts
    for (const [x, ph] of [[PX0 + 0.1, 0], [PX1, 1.7]]) {
      const pts = [];
      for (let k = 0; k <= 14; k++) { const t = k / 14, a = ph + t * 7; pts.push(new THREE.Vector3(x + Math.cos(a) * 0.13, t * 2.95, PZ + Math.sin(a) * 0.13)); }
      add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.05, 5), bark));
      for (let k = 0; k < 26; k++) { const t = jr(0.15, 1), a = ph + t * 7; leaf(root, x + Math.cos(a) * 0.2 + jr(-0.08, 0.08), t * 2.9, PZ + Math.sin(a) * 0.2 + jr(-0.08, 0.08), 1.1, WGREEN); }
    }
  }
  // ---------------- wisteria: leafy canopy on the pergola and door hood, hanging blossom racemes
  const raceme = (x, y, z, L) => {
    const n = Math.round(L * 42);
    for (let i = 0; i < n; i++) {
      const t = i / n, rad = 0.12 * (1 - t * 0.75), a = jr(0, 2 * PI), u = jr(0.35, 1);
      const ci = Math.min(LILAC.length - 1, Math.floor(t * LILAC.length + jr(-0.6, 0.6)));
      bloom(root, x + Math.cos(a) * rad * u, y - t * L, z + Math.sin(a) * rad * u, LILAC[Math.max(0, ci)], 0.85 - t * 0.35);
    }
    for (let k = 0; k < 3; k++) leaf(root, x + jr(-0.12, 0.12), y + jr(-0.05, 0.08), z + jr(-0.12, 0.12), 1.1, WGREEN);
  };
  {
    for (let k = 0; k < 250; k++) leaf(root, jr(PX0, PX1 + 0.3), 3.05 + jr(0, 0.28), jr(FW + 0.05, PZ + 0.2), 1.3, WGREEN);
    for (let k = 0; k < 90; k++) leaf(root, jr(PX0, PX1 + 0.2), 2.6 + jr(0, 0.35), PZ + jr(0.05, 0.18), 1.2, WGREEN);   // draping over the front beam
    for (let k = 0; k < 24; k++) raceme(PX0 + (k + jr(0.1, 0.9)) * (PX1 - PX0) / 24, 2.8 + jr(0, 0.08), k % 2 ? PZ + jr(-0.05, 0.12) : jr(FW + 0.3, PZ - 0.2), jr(0.55, 1.0));
    // spilling onto the door hood (left half) and down its left edge
    for (let k = 0; k < 60; k++) leaf(root, doorX + jr(-1.25, 0.1), 3.1 + jr(0, 0.45), FW + jr(0.05, 1.1), 1.2, WGREEN);
    for (let k = 0; k < 5; k++) raceme(doorX - 1.1 + jr(-0.1, 0.12), 2.85, FW + jr(0.2, 1.0), jr(0.35, 0.6));
  }

  // ---------------- other greenery that stays in-game: ivy up the tower, shrubs at the corners
  for (const [a0, top] of [[0.15, 5.6], [0.95, 3.4], [2.3, 4.6]]) {
    let a = a0, y = 0.3;
    while (y < top) {
      a += jr(-0.05, 0.05); y += jr(0.06, 0.13);
      for (let k = 0; k < 3; k++) { const aa = a + jr(-0.06, 0.06), rad = TR + 0.16 + jr(0, 0.05); leaf(y > H ? roof : root, TX + Math.sin(aa) * rad, y + jr(-0.08, 0.08), TZ + Math.cos(aa) * rad); }
    }
  }
  const bush = (x, z, rx, ry, rz, n, fl) => {
    for (let k = 0; k < n; k++) { const a = jr(0, PI * 2), u = Math.sqrt(rr()), v = jr(0.05, 1); leaf(root, x + Math.cos(a) * rx * u, ry * v * (1 - 0.4 * u), z + Math.sin(a) * rz * u, 1.5); }
    if (fl) for (let k = 0; k < n / 5; k++) { const a = jr(0, PI * 2); bloom(root, x + Math.cos(a) * rx * 0.8, ry * jr(0.4, 0.95), z + Math.sin(a) * rz * 0.8, fl[k % fl.length]); }
  };
  bush(0.65, 3.25, 0.32, 0.75, 0.3, 50, [0xf08fb8, 0xf4a2c0, 0xe36ea0]);       // pink hydrangea between the door and the tower
  bush(4.05, -2.35, 0.4, 0.9, 0.4, 60, [0xffffff]);
  bush(-4.1, -3.2, 0.5, 0.85, 0.26, 55, [0xf4a2c0]);
  bush(-0.4, -3.15, 0.55, 0.8, 0.25, 55);

  // ================= INTERIOR =================
  const colliders = [], propSlots = [];
  const col = (x, z, w, d, rot = 0) => colliders.push(rot ? { x, z, w, d, rot } : { x, z, w, d });
  const slot = (id, x, z, rot = 0) => propSlots.push({ id, x, z, rot });
  const Ib = frame(0, -IZ, 0), Il = frame(IXL, 0, PI / 2), Ir = frame(IXR, 0, -PI / 2), It = frame(XR + 0.05, 0, PI / 2);
  const IfF = frame(0, IZ, PI);
  // interior frames: local x along the wall, local z into the room. Ib: x = world x · Il, It: x = −world z · Ir: x = world z · IfF: x = −world x
  const BOOKS = [0x8c3b2e, 0x2f5d50, 0x355a7a, 0xb9823a, 0x6b4a7a, 0x9a5a3a, 0x4e6b3a, 0xc9a66b, 0x7a2e2e, 0x3c4a6e];
  const jarGeo = lathe([[0, 0], [0.07, 0], [0.1, 0.06], [0.1, 0.15], [0.06, 0.2], [0.065, 0.23], [0, 0.23]], 10);
  const vaseGeo = lathe([[0, 0], [0.06, 0], [0.1, 0.08], [0.09, 0.16], [0.05, 0.22], [0.07, 0.26], [0, 0.26]], 10);
  const potMat = M(0xffcfa8, tex('terracotta', 1, 1));
  const books = (P, x0, x1, y, dep, gap) => {
    for (let x = x0 + 0.02; x < x1 - 0.05;) {
      if (gap && x > gap[0] && x < gap[1]) { add(new THREE.Mesh(jarGeo, rr() < 0.5 ? ceramic : potMat), (gap[0] + gap[1]) / 2, y, dep / 2 + 0.04, 0, jr(0, 3), 0, P); x = gap[1] + 0.03; continue; }
      const w = jr(0.035, 0.07), h = jr(0.2, 0.32), lean = rr() < 0.1 ? jr(-0.22, 0.22) : 0;
      put('book', P, x + w / 2, y + (h / 2) * Math.cos(lean), dep / 2 + 0.04 + jr(-0.02, 0.02), 0, 0, lean, w, h, jr(dep * 0.75, dep), tint(BOOKS[Math.floor(rr() * BOOKS.length)], 0.06, 0.05));
      x += w + 0.004 + Math.abs(lean) * 0.15;
    }
  };
  const bookStack = (P, x, y, z, n) => { let yy = y; for (let i = 0; i < n; i++) { const h = jr(0.04, 0.07); put('book', P, x + jr(-0.02, 0.02), yy + h / 2, z + jr(-0.02, 0.02), 0, jr(-0.25, 0.25), 0, jr(0.22, 0.3), h, jr(0.16, 0.22), tint(BOOKS[Math.floor(rr() * BOOKS.length)], 0.06, 0.05)); yy += h; } return yy; };
  const vaseOf = (P, x, y, z, cols, n = 9, s = 1) => {
    add(new THREE.Mesh(vaseGeo, ceramic), x, y, z, 0, 0, 0, P);
    for (let k = 0; k < n; k++) leaf(P, x + jr(-0.13, 0.13) * s, y + 0.26 + jr(0, 0.14) * s, z + jr(-0.13, 0.13) * s, 0.75);
    for (let k = 0; k < n; k++) bloom(P, x + jr(-0.11, 0.11) * s, y + 0.3 + jr(0, 0.14) * s, z + jr(-0.11, 0.11) * s, cols[k % cols.length], 0.9);
  };
  const bookcase = (P, x, w, hgt = 2.25, dep = 0.42) => {
    const a = (m, px, py, pz) => add(m, px, py, pz, 0, 0, 0, P);
    for (const s of [-1, 1]) a(ib(0.07, hgt, dep, 0.02, timber), x + s * (w / 2 + 0.035), FL + hgt / 2, dep / 2);
    a(ib(w + 0.24, 0.08, dep + 0.06, 0.03, timber), x, FL + hgt + 0.04, dep / 2 + 0.01);
    a(ib(w, hgt, 0.03, 0.01, darkWood), x, FL + hgt / 2, 0.02);
    a(ib(w, 0.78, dep - 0.02, 0.03, timber), x, FL + 0.39, dep / 2);
    for (const s of [-1, 1]) { a(ib(w / 2 - 0.06, 0.6, 0.03, 0.01, timberLight), x + s * w / 4, FL + 0.4, dep); a(new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), iron), x + s * 0.07, FL + 0.45, dep + 0.025); }
    for (const y of [0.8, 1.27, 1.74]) { a(ib(w, 0.04, dep - 0.04, 0.01, timberLight), x, FL + y, dep / 2); books(P, x - w / 2, x + w / 2, FL + y + 0.02, dep - 0.12, rr() < 0.6 ? [x + jr(-0.35, 0.05), x + jr(0.12, 0.3)] : null); }
    a(ib(w, 0.04, dep - 0.04, 0.01, timberLight), x, FL + 2.2, dep / 2);
    for (const dx of [-0.3, 0.05, 0.3]) add(new THREE.Mesh(jarGeo, rr() < 0.6 ? ceramic : potMat), x + dx * w, FL + hgt + 0.08, dep / 2, 0, jr(0, 3), 0, P).scale.setScalar(jr(1.0, 1.5));
    for (let k = 0; k < 22; k++) leaf(P, x + jr(-0.1, 0.25) * w, FL + hgt + 0.1 - jr(0, 0.9) * (k / 22), dep + jr(-0.05, 0.06), 0.85);   // trailing ivy off the top
  };
  const wallLamp = (P, x, y) => { lantern(P, x, y, -0.02); };

  // ---- living room: wide plank floor, timber posts & wall plates
  {
    for (const [x, z] of [[IXL + 0.08, IZ - 0.08], [IXL + 0.08, -IZ + 0.08], [IXR - 0.08, -IZ + 0.08], [IXR - 0.08, IZ - 0.08]]) add(ib(0.18, H - FL, 0.18, 0.03, timber), x, FL + (H - FL) / 2, z);
    add(ib(IXR - IXL, 0.2, 0.18, 0.04, timber), MX, H - 0.12, -IZ + 0.09);
    add(ib(IXR - IXL, 0.2, 0.18, 0.04, timber), MX, H - 0.12, IZ - 0.09);
    add(ib(0.18, 0.2, 2 * IZ, 0.04, timber), IXL + 0.09, H - 0.12, 0);
    add(ib(0.18, 0.2, 2 * IZ, 0.04, timber), IXR - 0.09, H - 0.12, 0);
    add(ib(0.16, 2.2, 0.16, 0.03, timber), IXL + 0.08, FL + 1.85, 0.75);                    // mid post between the left windows
    add(ib(0.14, 0.1, 2 * IZ - 0.3, 0.03, timber), IXL + 0.07, FL + 0.07, 0);               // skirting
  }
  // ---- inglenook fireplace on the back wall: stone jambs, timber mantel beam, chimney breast tapering to the ceiling
  {
    const P = Ib, a = (m, px, py, pz, rx = 0, ry = 0, rz = 0) => add(m, px, py, pz, rx, ry, rz, P);
    a(ib(2.2, 0.12, 1.0, 0.04, stoneSlab), FX, FL + 0.06, 0.5);                                   // hearth
    for (const s of [-1, 1]) {
      a(ib(0.46, 1.36, 0.72, 0.06, towerIn), FX + s * 0.72, FL + 0.8, 0.36);
      for (let j = 0; j < 5; j++) block(P, FX + s * (0.72 + jr(-0.05, 0.05)), FL + 0.22 + j * 0.27, 0.73, jr(0.28, 0.42), 0.24, 0.06);
    }
    a(ib(1.05, 1.05, 0.08, 0.02, soot), FX, FL + 0.66, 0.08);                                    // sooty back
    a(ib(1.0, 0.08, 0.5, 0.02, soot), FX, FL + 1.2, 0.3);
    a(ib(2.36, 0.28, 0.5, 0.05, timber), FX, FL + 1.6, 0.48);                                   // mantel beam
    a(ib(2.0, 0.06, 0.32, 0.02, timberLight), FX, FL + 1.77, 0.4);
    a(ib(1.95, 0.55, 0.56, 0.06, towerIn), FX, FL + 2.06, 0.3);                                 // breast, stepping in to the ceiling
    a(ib(1.6, 0.6, 0.48, 0.06, towerIn), FX, FL + 2.6, 0.24);
    for (let j = 0; j < 9; j++) block(P, FX + jr(-0.65, 0.65), FL + jr(1.85, 2.8), jr(0.5, 0.56) - (j % 2) * 0.05, jr(0.25, 0.4), jr(0.16, 0.24), 0.05);
    // fire: logs, grate, flames, embers
    for (const s of [-1, 1]) a(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 7), bark), FX + s * 0.05, FL + 0.25 + (s > 0 ? 0.09 : 0), 0.4, 0, 0.3 * s, PI / 2);
    a(ib(0.75, 0.05, 0.36, 0.01, flame), FX, FL + 0.16, 0.4);
    for (const [dx, h, s] of [[0, 0.5, 0.15], [-0.18, 0.36, 0.11], [0.17, 0.4, 0.12], [0.08, 0.28, 0.09]]) a(new THREE.Mesh(new THREE.ConeGeometry(s, h, 6), flame), FX + dx, FL + 0.3 + h / 2, 0.38);
    for (let k = -3; k <= 3; k++) a(ib(0.025, 0.3, 0.025, 0.008, iron), FX + k * 0.11, FL + 0.27, 0.62);
    a(ib(0.8, 0.03, 0.03, 0.01, iron), FX, FL + 0.4, 0.62);
    // fire irons and a copper pot on the hearth
    for (let k = 0; k < 3; k++) a(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4), iron), FX - 0.82 + k * 0.06, FL + 0.48, 0.86, 0, 0, (k - 1) * 0.08);
    a(new THREE.Mesh(lathe([[0, 0], [0.12, 0], [0.16, 0.1], [0.15, 0.2], [0.1, 0.24], [0, 0.24]], 12), brass), FX - 0.6, FL + 0.12, 0.62);
    // mantel: candlesticks, a vase of wisteria, a few books
    for (const dx of [0.62, 0.78]) { a(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6), ceramic), FX + dx, FL + 1.89, 0.42); a(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), glow), FX + dx, FL + 2.0, 0.42); }
    vaseOf(P, FX - 0.55, FL + 1.8, 0.4, LILAC, 12, 1.4);
    for (let k = 0; k < 9; k++) bloom(P, FX - 0.55 + jr(-0.2, 0.25), FL + 1.95 - jr(0, 0.25), 0.55 + jr(-0.05, 0.08), LILAC[k % 5], 0.8);   // drooping racemes
    bookStack(P, FX + 0.15, FL + 1.8, 0.4, 3);
    col(MX + (FX - MX), -IZ + 0.45, 2.2, 0.95);
    if (opts.light !== false) { const l = new THREE.PointLight(0xff9a40, 1.6, 7, 2); l.position.set(FX, FL + 0.6, -IZ + 1.0); root.add(l); }
  }
  // ---- bookcases either side of the fireplace
  bookcase(Ib, -3.55, 1.15); col(-3.55, -IZ + 0.22, 1.35, 0.5);
  bookcase(Ib, -0.25, 1.15); col(-0.25, -IZ + 0.22, 1.35, 0.5);
  // ---- squashy sage sofa under the left window, with cushions and a knitted throw (Il: local x = −world z)
  {
    const P = Il, sx0 = 0.4, L = 2.2, a = (m, px, py, pz, rx = 0, ry = 0, rz = 0) => add(m, px, py, pz, rx, ry, rz, P);
    a(rbox(L, 0.34, 0.92, 0.12, sofaMat), sx0, FL + 0.3, 0.5);
    a(rbox(L - 0.1, 0.62, 0.3, 0.14, sofaMat), sx0, FL + 0.74, 0.18, -0.12);
    for (const s of [-1, 1]) { a(rbox(0.3, 0.42, 0.94, 0.14, sofaMat), sx0 + s * (L / 2 - 0.12), FL + 0.5, 0.5); a(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.92, 12), sofaMat), sx0 + s * (L / 2 - 0.1), FL + 0.72, 0.5, PI / 2, 0, 0); }
    for (const s of [-1, 1]) { a(rbox(0.8, 0.18, 0.68, 0.08, sofaMat), sx0 + s * 0.41, FL + 0.54, 0.56); a(rbox(0.8, 0.44, 0.22, 0.1, sofaMat), sx0 + s * 0.41, FL + 0.84, 0.34, -0.18); }
    for (const s of [-1, 1]) for (const t of [-1, 1]) a(ib(0.08, 0.12, 0.08, 0.02, timber), sx0 + s * (L / 2 - 0.08), FL + 0.06, 0.5 + t * 0.38);
    cush(P, sx0 - 0.62, FL + 0.86, 0.48, 0.42, 0.4, 0.14, 0xf3ead6, -0.3, 0.15, 0.08);   // wisteria-embroidered pillow
    for (let k = 0; k < 6; k++) bloom(P, sx0 - 0.62 + jr(-0.1, 0.1), FL + 0.86 + jr(-0.08, 0.1), 0.56, LILAC[k % 5], 0.6);
    cush(P, sx0 - 0.15, FL + 0.88, 0.42, 0.42, 0.42, 0.15, 0xe8b640, -0.28, -0.1, -0.05);
    cush(P, sx0 + 0.3, FL + 0.86, 0.44, 0.38, 0.38, 0.14, 0xc6a2d4, -0.3, 0.12, 0.1);
    cush(P, sx0 + 0.7, FL + 0.67, 0.6, 0.62, 0.05, 0.6, 0xf6eedc, 0.05, 0.1, 0.02);          // throw over the seat …
    cush(P, sx0 + 0.75, FL + 0.42, 0.97, 0.58, 0.48, 0.05, 0xf6eedc, 0.08, 0, 0);            // … hanging down the front
    col(IXL + 0.47, -sx0, 0.95, L + 0.05);
    // window over the sofa: inner trim, curtains on a rod
    const [wx, wy, ww, wh] = LWIN[0], X = -wx;
    a(ib(ww + 0.3, 0.06, 0.2, 0.02, timberLight), X, wy - wh / 2 - 0.03, 0.08);
    a(ib(ww + 0.34, 0.12, 0.1, 0.02, timber), X, wy + wh / 2 + 0.06, 0.04);
    a(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, ww + 0.9, 6), timber), X, wy + wh / 2 + 0.2, 0.12, 0, 0, PI / 2);
    for (const s of [-1, 1]) { cush(P, X + s * (ww / 2 + 0.2), wy - 0.12, 0.13, 0.26, wh + 0.65, 0.08, 0xf4ecda, 0, 0, s * 0.03); a(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 10), timber), X + s * (ww / 2 + 0.2), wy - 0.15, 0.18); }
    // little window over the gramophone
    const [w2, y2, ww2, wh2] = LWIN[1];
    a(ib(ww2 + 0.3, 0.06, 0.2, 0.02, timberLight), -w2, y2 - wh2 / 2 - 0.03, 0.08);
    a(ib(ww2 + 0.34, 0.12, 0.1, 0.02, timber), -w2, y2 + wh2 / 2 + 0.06, 0.04);
    // ivy trailing down the left wall from the beam
    for (let k = 0; k < 40; k++) leaf(P, 1.6 + jr(-0.2, 0.2) - k * 0.02, H - 0.15 - jr(0, 1.2) * (k / 40), 0.08 + jr(0, 0.06), 0.9);
    wallLamp(P, 1.15, 2.05);
  }
  // ---- gramophone on a carved cabinet in the front-left corner, table runner and books
  {
    const cx = IXL + 0.31, cz = 1.95, P = frame(cx, cz, PI / 2), a = (m, px, py, pz, rx = 0, ry = 0, rz = 0) => add(m, px, py, pz, rx, ry, rz, P);
    a(ib(1.0, 0.78, 0.58, 0.04, timber), 0, FL + 0.39, 0);
    a(ib(1.06, 0.06, 0.62, 0.02, timberLight), 0, FL + 0.8, 0);
    for (const s of [-1, 1]) { a(ib(0.42, 0.55, 0.03, 0.01, timberLight), s * 0.23, FL + 0.4, 0.29); a(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), iron), s * 0.06, FL + 0.45, 0.31); }
    cush(P, 0.18, FL + 0.84, 0.05, 0.36, 0.015, 0.66, 0xf3ead6);
    cush(P, 0.18, FL + 0.62, 0.32, 0.36, 0.42, 0.02, 0xf3ead6);
    for (let k = 0; k < 6; k++) leaf(P, 0.18 + jr(-0.1, 0.1), FL + 0.55 + jr(-0.12, 0.12), 0.335, 0.5, [0x7fa86a, 0x93b87a]);
    a(ib(0.36, 0.14, 0.36, 0.03, darkWood), -0.25, FL + 0.9, -0.02);                             // gramophone box
    a(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 16), soot), -0.25, FL + 0.98, -0.02);
    a(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.3, 5), brass), -0.15, FL + 1.1, -0.08, 0.5, 0, 0.3);
    const horn = new THREE.Mesh(lathe([[0.02, 0], [0.03, 0.12], [0.05, 0.24], [0.09, 0.34], [0.17, 0.42], [0.27, 0.46], [0.29, 0.47]], 16), brass);
    horn.material = brass; a(horn, -0.08, FL + 1.18, -0.14, -0.9, 0, 0.55);
    bookStack(P, 0.22, FL + 0.83, 0.02, 3);
    add(new THREE.Mesh(jarGeo, ceramic), 0.24, FL + 1.02, 0.02, 0, 0, 0, P);
    col(cx, cz, 0.62, 1.06);
  }
  // ---- round tea table with teapot, cups, a book and a vase of daisies
  {
    const tx = -2.85, tz = 1.35;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 20), timberLight), tx, FL + 0.48, tz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.05, 20), timber), tx, FL + 0.42, tz);
    for (let k = 0; k < 4; k++) { const an = k * PI / 2 + 0.4; add(new THREE.Mesh(lathe([[0.05, 0], [0.07, 0.06], [0.045, 0.15], [0.065, 0.24], [0.04, 0.33], [0.05, 0.4], [0, 0.4]], 8), timber), tx + Math.cos(an) * 0.26, FL, tz + Math.sin(an) * 0.26); }
    add(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 5, 16), timber), tx, FL + 0.12, tz, PI / 2, 0, 0);
    add(new THREE.Mesh(lathe([[0, 0], [0.08, 0], [0.12, 0.06], [0.12, 0.13], [0.07, 0.18], [0.03, 0.2], [0.035, 0.23], [0, 0.23]], 12), ceramic), tx + 0.12, FL + 0.52, tz - 0.08);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.14, 5), ceramic), tx + 0.25, FL + 0.6, tz - 0.08, 0, 0, -0.9);
    for (const [dx, dz] of [[-0.18, 0.15], [0.05, 0.22]]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 12), ceramic), tx + dx, FL + 0.53, tz + dz); add(new THREE.Mesh(lathe([[0, 0], [0.035, 0], [0.05, 0.06], [0.045, 0.06], [0, 0.01]], 10), ceramic), tx + dx, FL + 0.535, tz + dz); }
    bookStack(root, tx - 0.18, FL + 0.52, tz - 0.16, 1);
    vaseOf(root, tx - 0.05, FL + 0.52, tz - 0.3, [0xffffff, 0xfff6d8, 0xffd23f], 10, 1.1);
    col(tx, tz, 0.98, 0.98);
  }
  // ---- slant-top writing bureau on the shared wall, quill and ink, books, daisies (Ir: local x = world z)
  {
    const bz = -1.55, P = Ir, a = (m, px, py, pz, rx = 0, ry = 0, rz = 0) => add(m, px, py, pz, rx, ry, rz, P);
    a(ib(1.0, 0.82, 0.52, 0.04, timber), bz, FL + 0.43, 0.27);
    for (let j = 0; j < 3; j++) { a(ib(0.9, 0.2, 0.03, 0.01, timberLight), bz, FL + 0.2 + j * 0.24, 0.53); for (const s of [-1, 1]) a(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), brass), bz + s * 0.22, FL + 0.2 + j * 0.24, 0.555); }
    a(ib(1.0, 0.04, 0.5, 0.01, timberLight), bz, FL + 1.0, 0.3, 0.42);                           // slanted lid
    a(ib(1.0, 0.4, 0.26, 0.03, timber), bz, FL + 1.06, 0.13);
    a(ib(1.04, 0.05, 0.3, 0.015, timberLight), bz, FL + 1.28, 0.14);
    bookStack(P, bz + 0.3, FL + 1.3, 0.14, 3);
    a(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.07, 8), soot), bz - 0.2, FL + 1.33, 0.14);
    cush(P, bz - 0.17, FL + 1.48, 0.13, 0.03, 0.3, 0.06, 0xf8f2e2, 0, 0, 0.35);                  // quill
    vaseOf(P, bz - 0.38, FL + 1.3, 0.14, [0xffffff, 0xffd23f], 9, 1.0);
    col(IXR - 0.27, bz, 0.56, 1.05);
  }
  // ---- the arch to the tower: stone voussoirs on both faces, lanterns either side
  {
    const r = 0.68;
    for (const [P, z] of [[Pr, 0.02], [Pr, -T - 0.02]]) {
      for (let i = 0; i <= 11; i++) { const t = (i / 11) * PI, rad = r + 0.15; block(P, -ARCHZ + Math.cos(t) * rad, 1.7 + Math.sin(t) * rad, z, 0.24, 0.22, 0.08, t - PI / 2); }
      for (const s of [-1, 1]) for (let j = 0; j < 5; j++) block(P, -ARCHZ + s * (r + 0.14 + (j % 2) * 0.04), 0.2 + j * 0.33, z, j % 2 ? 0.3 : 0.22, 0.3, 0.08);
    }
    wallLamp(Ir, ARCHZ + 1.25, 2.05);
    wallLamp(It, -ARCHZ - 1.25, 2.05);
  }
  // ---- front window inner trim and a round wisteria rug
  {
    const [wx, wy, ww, wh] = FWIN, X = -wx;
    add(ib(ww + 0.3, 0.06, 0.2, 0.02, timberLight), X, wy - wh / 2 - 0.03, 0.08, 0, 0, 0, IfF);
    add(ib(ww + 0.34, 0.12, 0.1, 0.02, timber), X, wy + wh / 2 + 0.06, 0.04, 0, 0, 0, IfF);
    const rx = -1.75, rz = 0.35;
    put('disc', root, rx, FL + 0.006, rz, 0, 0, 0, 1.3, 0.012, 1.3, new THREE.Color(0x9fb47e));
    put('disc', root, rx, FL + 0.01, rz, 0, 0, 0, 1.22, 0.012, 1.22, new THREE.Color(0xf1e2c2));
    for (let k = 0; k < 36; k++) {
      const an = (k / 36) * 2 * PI, rad = 0.95 + 0.06 * Math.sin(k * 1.7);
      put('book', root, rx + Math.cos(an) * rad, FL + 0.017, rz + Math.sin(an) * rad, 0, -an + jr(-0.4, 0.4), 0, 0.16, 0.006, 0.05, tint(0x7d9a5c, 0.05, 0.03));
      if (k % 3 === 0) for (let q = 0; q < 3; q++) put('book', root, rx + Math.cos(an) * (rad - 0.06 - q * 0.07), FL + 0.017, rz + Math.sin(an) * (rad - 0.06 - q * 0.07), 0, -an, 0, 0.09 - q * 0.02, 0.006, 0.07, tint(LILAC[q + 1], 0.04, 0.03));
    }
    for (let k = 0; k < 6; k++) { const an = (k / 6) * 2 * PI; put('book', root, rx + Math.cos(an) * 0.18, FL + 0.017, rz + Math.sin(an) * 0.18, 0, -an, 0, 0.14, 0.006, 0.05, tint(0xa47ddb, 0.04, 0.03)); }
  }

  // ---- tower room: spiral stair, telescope, astronomer's desk under a star chart, braided rug
  {
    // spiral stair (decoration — it climbs into the ceiling)
    const SPX = 2.05, SPZ = -1.35, n = 13;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, H - FL, 10), timber), SPX, FL + (H - FL) / 2, SPZ);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), timber), SPX, FL + 1.05, SPZ);
    const rail = [];
    for (let i = 0; i < n; i++) {
      const an = 0.6 + i * 0.45, y = FL + 0.2 + i * 0.215, cs = Math.cos(an), sn = Math.sin(an);
      const st = new THREE.Group(); st.position.set(SPX, 0, SPZ); st.rotation.y = an; root.add(st);
      add(ib(0.86, 0.07, 0.34, 0.02, timberLight), 0.47, y, 0, 0, 0, 0, st);
      add(ib(0.8, y - FL > 0.3 ? 0.06 : y - FL, 0.06, 0.02, timber), 0.47, y - 0.06, 0.15, 0, 0, 0, st);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.82, 5), timber), 0.86, y + 0.44, 0, 0, 0, 0, st);
      rail.push(new THREE.Vector3(SPX + cs * 0.86, y + 0.86, SPZ - sn * 0.86));
    }
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 40, 0.035, 5), timber));
    add(ib(0.14, 1.1, 0.14, 0.03, timber), rail[0].x, FL + 0.55, rail[0].z);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), timber), rail[0].x, FL + 1.15, rail[0].z);
    // baskets of rolled star maps tucked under the stair
    for (let k = 0; k < 4; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 6), ceramic), SPX + 0.15 + k * 0.07, FL + 0.28, SPZ - 0.35 + (k % 2) * 0.08, 0.2 * (k - 1.5), 0, 0.15);
    col(SPX, SPZ, 1.7, 1.7);
    // telescope on a tripod, aimed at the back-right window
    const tx = 3.25, tz = -1.2;
    for (let k = 0; k < 3; k++) { const an = k * 2.094 + 0.3; add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.25, 5), timberLight), tx + Math.sin(an) * 0.22, FL + 0.58, tz + Math.cos(an) * 0.22, Math.cos(an) * 0.36, 0, -Math.sin(an) * 0.36); }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), brass), tx, FL + 1.18, tz);
    const tel = new THREE.Group(); tel.position.set(tx, FL + 1.25, tz); tel.rotation.set(0, 2.45 - PI / 2, 0.55); root.add(tel);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.0, 12), brass), 0.15, 0, 0, 0, 0, PI / 2, tel);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), brass), 0.66, 0, 0, 0, 0, PI / 2, tel);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 8), brass), -0.4, 0, 0, 0, 0, PI / 2, tel);
    add(new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), warmGlass), 0.705, 0, 0, 0, PI / 2, 0, tel);
    col(tx, tz, 0.6, 0.6);
    // astronomer's desk against the right-back wall, star chart above it
    const da = 1.78, [dx, dz] = pol(da, TRI - 0.36), P = frame(dx, dz, da + PI), a = (m, px, py, pz, rx = 0, ry = 0, rz = 0) => add(m, px, py, pz, rx, ry, rz, P);
    a(ib(1.35, 0.07, 0.62, 0.02, timberLight), 0, FL + 0.76, 0);
    for (const s of [-1, 1]) for (const t of [-1, 1]) a(ib(0.08, 0.72, 0.08, 0.02, timber), s * 0.6, FL + 0.38, t * 0.25);
    a(ib(0.5, 0.42, 0.55, 0.03, timber), 0.38, FL + 0.5, 0);
    a(ib(0.42, 0.14, 0.03, 0.01, timberLight), 0.38, FL + 0.58, 0.28);
    a(new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), brass), 0.38, FL + 0.58, 0.3);
    a(ib(1.2, 0.05, 0.05, 0.01, timber), 0, FL + 0.2, -0.25);
    cush(P, 0.25, FL + 0.8, 0.0, 0.3, 0.015, 0.7, 0xf3ead6);                                   // runner
    cush(P, 0.25, FL + 0.6, 0.33, 0.3, 0.38, 0.02, 0xf3ead6);
    a(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), stoneSlab), -0.42, FL + 1.14, -0.08);   // globe
    a(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 5, 18), brass), -0.42, FL + 1.14, -0.08, 0, 0.3, 0.4);
    a(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, 0.22, 8), brass), -0.42, FL + 0.9, -0.08);
    for (const s of [-1, 1]) cush(P, -0.05 + s * 0.13, FL + 0.81, 0.05, 0.26, 0.03, 0.34, 0xf8f0dc, 0, 0, s * 0.08);   // open star atlas
    a(ib(0.03, 0.03, 0.34, 0.01, darkWood), -0.05, FL + 0.81, 0.05);
    a(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.06, 10), brass), 0.48, FL + 0.82, -0.12);   // oil lamp
    a(new THREE.Mesh(lathe([[0, 0], [0.06, 0], [0.08, 0.06], [0.05, 0.14], [0.035, 0.24], [0, 0.24]], 10), glow), 0.48, FL + 0.85, -0.12);
    bookStack(P, 0.48, FL + 0.8, 0.12, 2);
    for (let k = 0; k < 4; k++) put('book', P, 0.2 + k * 0.06, FL + 0.95, -0.24, 0, 0, 0, 0.05, 0.28, 0.2, tint(BOOKS[k * 2], 0.05, 0.04));
    // star chart tapestry and moon-phase card on the curved wall above
    cush(P, -0.15, FL + 1.85, -0.3, 0.95, 0.85, 0.03, 0x2f3a66);
    a(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), timber), -0.15, FL + 2.3, -0.28, 0, 0, PI / 2);
    for (let k = 0; k < 34; k++) bloom(P, -0.15 + jr(-0.42, 0.42), FL + 1.85 + jr(-0.38, 0.38), -0.28, 0xf2cf6a, 0.28);
    for (let k = 0; k < 20; k++) { const an = (k / 20) * 2 * PI; bloom(P, -0.15 + Math.cos(an) * 0.28, FL + 1.85 + Math.sin(an) * 0.28, -0.28, 0xf2cf6a, 0.18); }
    cush(P, 0.62, FL + 1.8, -0.27, 0.36, 0.26, 0.02, 0xf4ead2);
    for (let k = 0; k < 3; k++) bloom(P, 0.52 + k * 0.1, FL + 1.8, -0.25, k === 1 ? 0xf8f0dc : 0x3c3c4c, 0.45);
    col(dx, dz, 1.4, 0.68, da + PI);
    // braided round rug with a ring of green leaves
    const rx = 2.5, rz = 0.3;
    put('disc', root, rx, FL + 0.006, rz, 0, 0, 0, 1.05, 0.012, 1.05, new THREE.Color(0xe6d2a8));
    put('disc', root, rx, FL + 0.01, rz, 0, 0, 0, 0.98, 0.012, 0.98, new THREE.Color(0xf4e6c6));
    put('disc', root, rx, FL + 0.014, rz, 0, 0, 0, 0.5, 0.012, 0.5, new THREE.Color(0xeedcb6));
    for (let k = 0; k < 30; k++) { const an = (k / 30) * 2 * PI; put('book', root, rx + Math.cos(an) * 0.74, FL + 0.021, rz + Math.sin(an) * 0.74, 0, -an + 0.6 * (k % 2 ? 1 : -1), 0, 0.12, 0.006, 0.05, tint(0x86a866, 0.05, 0.03)); }
    if (opts.light !== false) { const l = new THREE.PointLight(0xffc070, 1.2, 6, 2); l.position.set(TX + 0.6, 2.0, TZ - 0.2); root.add(l); }
  }
  // tower wall colliders: short chord boxes round the curve, from the shared wall at the back to the shared wall at the front
  {
    const rc = (TR + TRI) / 2, a0 = Math.asin((XR + 0.05 - TX) / rc), a1 = PI - a0, n = 16, da = (a1 - a0) / n;
    for (let i = 0; i < n; i++) { const an = a0 + (i + 0.5) * da, [x, z] = pol(an, rc); col(x, z, 2 * rc * Math.sin(da / 2) + 0.14, TR - TRI, an); }
  }
  // cottage wall colliders, with gaps at the front doorway and the tower arch
  {
    const zc = FW - T / 2, xc = XL - 0.05 + T / 2, xs = XR + 0.05 - T / 2;
    const seg = (a, b, f) => { if (b - a > 0.02) f((a + b) / 2, b - a); };
    seg(XL - 0.05, doorX - DW / 2, (m, l) => col(m, zc, l, T));
    seg(doorX + DW / 2, XR + 0.05, (m, l) => col(m, zc, l, T));
    col(MX, -zc, W + 0.1, T);
    col(doorX - DW - 0.06, FW - T - 0.14, DW, 0.18);                       // the open door leaf against the wall
    col(xc, 0, T, 2 * FW);
    seg(-FW, ARCHZ - 0.68, (m, l) => col(xs, m, T, l));
    seg(ARCHZ + 0.68, FW, (m, l) => col(xs, m, T, l));
  }
  // prop slots: where hideable props naturally sit (small groups of the same id, beside furniture, off the walking lines)
  slot('log_pile', -0.6, -1.75, 0.2); slot('log_pile', -0.15, -1.8, -0.3);                 // by the hearth and bookcase
  slot('cushion_pile', -1.9, 1.7, 0.4); slot('cushion_pile', -2.3, 2.0, 1.2);               // poufs by the tea table
  slot('book_stack', -4.0, 1.0, 0.3); slot('book_stack', -3.75, 1.12, -0.5);                   // between sofa and cabinet
  slot('stool', 0.1, -1.55, PI / 2);                                                         // at the bureau
  slot('chest', 0.5, 2.15, -PI / 2);                                                         // old trunk front-right
  {
    const p = (id, a, r, rot) => { const [x, z] = pol(a, r); slot(id, x, z, rot); };
    p('cushion_pile', 0.85, 1.95, 0.3); p('cushion_pile', 0.42, 2.0, 1.1);                    // floor cushions under the windows
    p('book_stack', 1.25, 2.05, 0.5); p('book_stack', 1.12, 1.6, -0.4);                       // books by the desk
    p('crate', -0.3, 1.95, 0.2); p('crate', 0.06, 2.02, -0.25);                              // crates by the arch
  }
  if (garden) {
    // extra loose clutter in the gallery version: a trunk and a pouf (in-game these are props that hiders become)
    const [x, z] = [0.5, 2.15];
    add(ib(0.5, 0.42, 0.8, 0.05, M(0x8a5a34, tex('wood_planks_dark', 1, 1))), x, FL + 0.21, z);
    for (const dz of [-0.28, 0.28]) add(ib(0.52, 0.44, 0.05, 0.01, iron), x, FL + 0.22, z + dz);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), M(0xe0b84a, tex('burlap', 1, 1))), -1.9, FL + 0.16, 1.7).scale.set(1, 0.55, 1);
  }

  // ---------------- garden decor (NOT in-game: these look like hideable props)
  if (garden) {
    const barrelGeo = lathe([[0, 0], [0.33, 0], [0.38, 0.2], [0.41, 0.42], [0.38, 0.66], [0.33, 0.82], [0, 0.82]], 20);
    const barrelMat = M(0xa2693b, tex('wood_planks_dark', 1.5, 0.6));
    for (const [x, z] of [[-4.2, 3.05], [-3.45, 3.35]]) {
      add(new THREE.Mesh(barrelGeo, barrelMat), x, 0, z, 0, jr(0, 3), 0);
      for (const y of [0.18, 0.64]) add(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 24), iron), x, y, z, PI / 2);
    }
    add(rbox(0.6, 0.5, 0.5, 0.03, timberLight), -2.75, 0.25, 3.4, 0, 0.2, 0);                           // crate
    const can = M(0xd8e2e6, tex('painted_metal', 1, 1));
    add(new THREE.Mesh(lathe([[0, 0], [0.17, 0], [0.18, 0.3], [0.15, 0.34], [0, 0.34]], 14), can), -2.2, 0, 3.95);  // watering can
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.42, 6), can), -2.0, 0.28, 3.95, 0, 0, -0.9);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 5, 12, PI), can), -2.2, 0.34, 3.95, 0, PI / 2, 0);
    add(new THREE.Mesh(lathe([[0, 0], [0.2, 0], [0.26, 0.32], [0.3, 0.42], [0.26, 0.44], [0, 0.44]], 16), potMat), -1.65, 0, 3.3);   // pot of daisies
    for (let k = 0; k < 14; k++) leaf(root, -1.65 + jr(-0.24, 0.24), 0.48 + jr(0, 0.22), 3.3 + jr(-0.24, 0.24));
    for (let k = 0; k < 10; k++) bloom(root, -1.65 + jr(-0.2, 0.2), 0.62 + jr(0, 0.12), 3.3 + jr(-0.2, 0.2), 0xffffff, 1.2);
    add(new THREE.Mesh(lathe([[0, 0], [0.16, 0], [0.2, 0.32], [0.21, 0.34], [0, 0.34]], 14), can), 3.7, 0, 3.15);   // bucket
    // red mailbox on a post
    add(rbox(0.1, 1.1, 0.1, 0.03, timber), 4.3, 0.55, 3.0);
    add(rbox(0.3, 0.32, 0.45, 0.1, M(0xd2564a, null)), 4.3, 1.25, 3.0);
    // stepping stones to the door
    for (let k = 0; k < 3; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.28, 0.36), jr(0.3, 0.38), 0.08, 9), stoneSlab), doorX + Math.sin(k * 0.9) * 0.22 + jr(-0.1, 0.1), 0.03, FW + 1.05 + k * 0.62, 0, jr(0, 3), 0);
  }

  // ---------------- build the instanced meshes
  for (const k of Object.keys(pools)) {
    const p = pools[k]; if (!p.items.length) continue;
    const im = new THREE.InstancedMesh(p.geo, p.mat, p.items.length);
    p.items.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c instanceof THREE.Color ? c : new THREE.Color(c ?? 0xffffff)); });
    im.castShadow = true; im.receiveShadow = true; im.name = k; p.par.add(im);
  }
  for (const c of root.children) c.position.x += OX;
  const sh = (p) => Object.assign({}, p, { x: +(p.x + OX).toFixed(3), z: +p.z.toFixed(3) });
  root.userData.footprint = { w: 10.0, d: 7.4 };
  root.userData.door = sh({ x: doorX, z: FW + 0.95 });
  root.userData.doorIn = sh({ x: doorX, z: IZ - 0.75 });
  root.userData.innerDoors = [sh({ x: XR + 0.05 - T / 2, z: ARCHZ })];
  root.userData.rooms = [
    sh({ name: 'living', x: MX, z: 0, w: IXR - IXL - 0.05, d: 2 * IZ - 0.05 }),
    sh({ name: 'tower', x: 2.6, z: TZ, w: 2.9, d: 3.4 }),
  ];
  root.userData.colliders = colliders.map((c) => { const o = sh(c); o.w = +c.w.toFixed(3); o.d = +c.d.toFixed(3); if (c.rot) o.rot = +c.rot.toFixed(4); return o; });
  root.userData.propSlots = propSlots.map(sh);
  if (opts.merge !== false) { mergeStatic(THREE, roof); mergeStatic(THREE, root); }
  return root;
}
