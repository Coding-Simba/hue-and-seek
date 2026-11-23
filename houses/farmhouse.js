/* Farmhouse — hand-modelled in code from Codex's concept paintings (assets/concepts/house_farmhouse.png, and the
 * interiors assets/interiors/farmhouse_kitchen.png + farmhouse_bedroom.png).
 * export buildHouse(THREE, opts) → THREE.Group 'farmhouse'. Origin = ground centre, front (porch, door) faces +Z. Metres.
 * A long, low house of rough rounded fieldstones (instanced over a hollow stone shell) under a thick turf roof of instanced
 * moss lumps, grass tufts and daisies. A deep timber porch with a built-in bench runs along the front.
 * Enterable: open doorway → flagstone kitchen (open hearth + hanging pot, trestle table, range, dresser) on the right,
 * interior doorway → plank-floored bedroom (curtained box bed, wardrobe, built-in stove, washtub) on the left.
 * Everything above the rooms (turf roof, gables, upper walls, chimney) lives in the child Group 'roof' (hidden by the game
 * while the player is inside). userData: door, doorIn, innerDoors, rooms, colliders, propSlots (see houses/BRIEF_INTERIORS.md).
 * ~9.6 m wide (10 m with the roof) × 7.9 m deep, ridge ≈ 5 m, chimney ≈ 6.2 m.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

const matCache = {}, greyCache = {};

export function buildHouse(THREE, opts = {}) {
  const garden = opts.garden !== false;               // false = in-game: no decor that could be mistaken for a hideable prop
  const W = 9.1, ZF = 2.2, ZB = -3.8, ZR = -0.75;         // wall length, front / back wall planes (outer faces), ridge line
  const T = 0.3, CUT = 2.6;                               // wall thickness; everything above CUT belongs to the 'roof' group
  const TF = 0.45, TB = 0.66;                             // front (catslide over the porch) & back roof pitch as tan
  const ZEF = ZF + 1.45, ZEB = ZB - 0.45, XR = W / 2 + 0.1;  // eaves: deep porch front, back, gable overhang
  const R = 2.68 + (ZEF - ZR) * TF;                       // ridge (underside of the turf) from a 2.68 m porch eave
  const HB = R - (ZR - ZB) * TB, HF = R - (ZF - ZR) * TF; // back wall top (2.65), front wall top (3.33)
  const roofY = (z) => (z >= ZR ? R - (z - ZR) * TF : R - (ZR - z) * TB);
  const DX = 2.15, DWH = 0.65, DH = 2.3;                   // front doorway centre, half width, height
  const ZP = ZF + 1.3;                                    // porch post line
  const XI = W / 2 - T, ZFI = ZF - T, ZBI = ZB + T;       // inner wall faces
  const PX = -0.4, PT = 0.24, IDZ = -1.75, IDW = 0.65;    // partition (kitchen | bedroom), inner doorway centre z, half width
  const HX = 1.9;                                         // hearth centre on the kitchen back wall

  let seed = opts.seed || 7; const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const tex = (n, rx = 1, ry = rx) => kitTex(THREE, n, rx, ry);
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  // painted kit texture used as greyscale detail under a clean colour (blue paint / grey stone stay clean over warm textures)
  const G = (hex, map, norm, k = 0.7, extra = {}) => {
    const key = `${hex}|${map.uuid}|${norm}|${k}|${JSON.stringify(extra)}`;
    if (greyCache[key]) return greyCache[key];
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map, roughness: 0.95, metalness: 0 }, extra));
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  diffuseColor.rgb *= mix( 1.0, clamp( dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) / ${norm.toFixed(3)}, 0.0, 1.4 ), ${k.toFixed(2)} );
#endif`);
    };
    m.customProgramCacheKey = () => `greymap|${norm}|${k}`;
    return (greyCache[key] = m);
  };
  const root = new THREE.Group();
  root.name = 'farmhouse';
  const RF = new THREE.Group();                           // everything above the interior: hidden while the player is inside
  RF.name = 'roof'; RF.userData.keep = true; root.add(RF);
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const rbox = (w, h, d, r, mat, seg = 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  const o = new THREE.Object3D();

  // ---------------- materials
  const stoneMat = G(opts.wall || 0xffffff, tex('stone', 0.32), 0.447, 0.55);
  const grout = G(0x7d776c, tex('stone', 0.7), 0.447, 0.6);
  const inWall = G(0xe8cba2, tex('stone', 0.55), 0.447, 0.75);        // interior face of the stone shell (warm lime-washed stone)
  const flag = G(0xc9c5bb, tex('stone', 0.45), 0.447, 0.6);
  const timber = M(0x9a6a40, tex('wood_light', 0.5));
  const timberLight = M(0xc89a5e, tex('wood_light', 0.6));
  const doorWood = M(0xd59a62, tex('wood_light', 0.8));
  const shutterMat = G(0x4a6c98, tex('wood_light', 0.7), 0.53, 0.55);
  const iron = M(0x3b3530, null, { roughness: 0.85 });
  const glass = M(0x5a4a30, null, { roughness: 0.85, emissive: 0xffa040, emissiveIntensity: 0.32 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd894, emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.85 });
  const fire = M(0xffb050, null, { emissive: 0xff7a1e, emissiveIntensity: 2.2, roughness: 0.9 });
  const terracotta = M(0xffcfa8, tex('terracotta', 1));
  const turf = G(0x86a850, tex('leaves', 0.8), 0.313, 0.6);
  const plaid = M(0xffb4a0, tex('burlap', 1.4));
  const soot = M(0x4a3b31, null);
  const copper = M(0xe4935c, null, { roughness: 0.85 });
  const crock = M(0xfff4e2, tex('plaster', 0.6));
  const linen = M(0xfffaf0, tex('plaster', 0.9));
  const quilt = M(0xffcabb, tex('burlap', 2.4));
  const rugMat = M(0xf6c2a8, tex('burlap', 1.1));
  const logMat = M(0xb88452, tex('bark', 1));
  const barrelWood = M(0xa2693b, tex('wood_planks_dark', 1.5, 0.6));

  // ---------------- rough rounded fieldstone (one geometry, instanced everywhere: walls, corners, hearth, chimney)
  const stoneGeo = new THREE.SphereGeometry(1, 8, 5);
  {
    const p = stoneGeo.attributes.position, v = new THREE.Vector3();
    const b = (c) => Math.sign(c) * Math.pow(Math.abs(c), 0.72);           // push toward a soft rounded block
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + 0.07 * Math.sin(v.x * 3.1 + v.y * 2.3) + 0.05 * Math.sin(v.z * 4.1 - v.x * 1.9 + 1.3);
      p.setXYZ(i, b(v.x) * n, b(v.y) * n, b(v.z) * n);
    }
    stoneGeo.computeVertexNormals();
  }
  const STONE_PAL = [0xbfb6a4, 0xa9a397, 0xc9bca2, 0x9c978c, 0xb8aa8e, 0xd0c8b8, 0xa89c84, 0xbcb19a].map((h) => new THREE.Color(h));
  const stones = [], roofStones = [];
  const pushStone = (x, y, z, sx, sy, sz, ry, tilt = 0.07) => {
    o.position.set(x, y, z); o.rotation.set(jr(-tilt, tilt), ry + jr(-0.06, 0.06), jr(-tilt, tilt)); o.scale.set(sx, sy, sz); o.updateMatrix();
    (y > CUT + 0.04 ? roofStones : stones).push([o.matrix.clone(), STONE_PAL[Math.floor(rr() * STONE_PAL.length)].clone().offsetHSL(0, jr(-0.02, 0.02), jr(-0.05, 0.04))]);
  };
  // lay one wall a→b in courses of rounded stones; top(t) caps the height, holes = [[t0, t1, y0, y1]] stay open
  function wallStones(ax, az, bx, bz, top, holes = [], y0 = 0, k = 1, out = 0.07) {
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    const ry = -Math.atan2(dz, dx), nx = Math.sin(ry), nz = Math.cos(ry);
    let y = y0;
    for (let guard = 0; guard < 40; guard++) {
      const rh = jr(0.3, 0.44) * k;
      let t = -jr(0.05, 0.3) * k, any = false;
      while (t < len) {
        const w = jr(0.42, 0.82) * k, tc = t + w / 2; t += w;
        const lim = top(Math.min(len, Math.max(0, tc)));
        if (y > lim - 0.12 * k) continue;
        any = true;
        const h = Math.min(rh, lim - y + 0.03), yc = y + h / 2;
        // clip the stone around openings: keep whatever free pieces are left either side
        let segs = [[t - w, t]];
        for (const [t0, t1, h0, h1] of holes) {
          if (yc + h * 0.3 < h0 || yc - h * 0.3 > h1) continue;
          segs = segs.flatMap(([s0, s1]) => (s1 <= t0 || s0 >= t1 ? [[s0, s1]] : [[s0, Math.min(s1, t0)], [Math.max(s0, t1), s1]].filter(([q0, q1]) => q1 - q0 > 0.2 * k)));
        }
        for (const [s0, s1] of segs) {
          const sc = (s0 + s1) / 2;
          pushStone(ax + dx * sc + nx * out, yc, az + dz * sc + nz * out, (s1 - s0) * 0.54, h * 0.6, jr(0.13, 0.19) * k, ry);
        }
      }
      if (!any) break;
      y += rh;
    }
  }
  // hollow shell: one extruded slab per wall a→b (outer face on the a→b line, thickness inward), doorway notches + window holes
  function slab(ax, az, bx, bz, thick, y0, topPts, notches, holes, mat, P = root) {
    const len = Math.hypot(bx - ax, bz - az), s = new THREE.Shape();
    s.moveTo(0, y0);
    for (const [t0, t1, h] of notches) { s.lineTo(t0, y0); s.lineTo(t0, h); s.lineTo(t1, h); s.lineTo(t1, y0); }
    s.lineTo(len, y0);
    for (let i = topPts.length - 1; i >= 0; i--) s.lineTo(topPts[i][0], topPts[i][1]);
    s.closePath();
    for (const [t0, t1, h0, h1] of holes) { const p = new THREE.Path(); p.moveTo(t0, h0); p.lineTo(t1, h0); p.lineTo(t1, h1); p.lineTo(t0, h1); p.closePath(); s.holes.push(p); }
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
    g.translate(0, 0, -thick);
    return add(new THREE.Mesh(g, mat), ax, 0, az, 0, -Math.atan2(bz - az, bx - ax), 0, P);
  }

  // ---------------- walls: hollow stone shell (lower part in root, gables + upper strips in 'roof') + outer stones
  const win = (x, y, w, h) => [x - w / 2 - 0.1, x + w / 2 + 0.1, y - h / 2 - 0.14, y + h / 2 + 0.25];
  const hole = (x, y, w, h) => [x - w / 2 - 0.1, x + w / 2 + 0.1, y - h / 2 - 0.02, y + h / 2 + 0.05];
  const FRONT_WIN = [[-3.25, 1.6, 0.62, 0.72, 2], [-1.75, 1.65, 0.52, 0.6, 0], [0.7, 1.62, 0.58, 0.66, 0], [3.75, 1.62, 0.5, 0.62, 0]];
  const BACK_WIN = [[-2.12, 1.45, 0.58, 0.66, 2], [0.45, 1.5, 0.5, 0.58, 0]];   // x in world
  const SIDE_WIN = [[-1, -0.45, 1.45, 0.58, 0.66, 2], [1, 0.55, 1.45, 0.58, 0.66, 2]]; // side, z, y, w, h
  {
    const fDoor = [DX - DWH + W / 2, DX + DWH + W / 2, DH];
    slab(-W / 2, ZF, W / 2, ZF, T, 0, [[0, CUT], [W, CUT]], [fDoor], FRONT_WIN.map(([x, y, w, h]) => hole(x + W / 2, y, w, h)), inWall);
    slab(W / 2, ZB, -W / 2, ZB, T, 0, [[0, CUT], [W, CUT]], [], BACK_WIN.map(([x, y, w, h]) => hole(W / 2 - x, y, w, h)), inWall);
    slab(W / 2, ZF, W / 2, ZB, T, 0, [[0, CUT], [ZF - ZB, CUT]], [], SIDE_WIN.filter((q) => q[0] > 0).map(([, z, y, w, h]) => hole(ZF - z, y, w, h)), inWall);
    slab(-W / 2, ZB, -W / 2, ZF, T, 0, [[0, CUT], [ZF - ZB, CUT]], [], SIDE_WIN.filter((q) => q[0] < 0).map(([, z, y, w, h]) => hole(z - ZB, y, w, h)), inWall);
    slab(-W / 2, ZF, W / 2, ZF, T, CUT, [[0, HF], [W, HF]], [], [], inWall, RF);
    slab(W / 2, ZB, -W / 2, ZB, T, CUT - 0.01, [[0, HB], [W, HB]], [], [], inWall, RF);
    slab(W / 2, ZF, W / 2, ZB, T, CUT, [[0, HF], [ZF - ZR, R], [ZF - ZB, HB]], [], [], inWall, RF);
    slab(-W / 2, ZB, -W / 2, ZF, T, CUT, [[0, HB], [ZR - ZB, R], [ZF - ZB, HF]], [], [], inWall, RF);

    const fh = FRONT_WIN.map(([x, y, w, h]) => win(x + W / 2, y, w, h));
    fh.push([DX - DWH - 0.05 + W / 2, DX + DWH + 0.05 + W / 2, 0, DH + 0.15]);
    wallStones(-W / 2, ZF, W / 2, ZF, () => HF, fh);
    wallStones(W / 2, ZB, -W / 2, ZB, () => HB, BACK_WIN.map(([x, y, w, h]) => win(W / 2 - x, y, w, h)));
    wallStones(W / 2, ZF, W / 2, ZB, (t) => roofY(ZF - t) - 0.02, SIDE_WIN.filter((q) => q[0] > 0).map(([, z, y, w, h]) => win(ZF - z, y, w, h)));
    wallStones(-W / 2, ZB, -W / 2, ZF, (t) => roofY(ZB + t) - 0.02, SIDE_WIN.filter((q) => q[0] < 0).map(([, z, y, w, h]) => win(z - ZB, y, w, h)));
    // big rounded corner stones bind the walls together
    for (const [cx, cz, top] of [[-W / 2, ZF, HF], [W / 2, ZF, HF], [-W / 2, ZB, HB], [W / 2, ZB, HB]]) {
      for (let y = 0; y < top - 0.2;) {
        const h = jr(0.32, 0.46);
        pushStone(cx + Math.sign(cx) * 0.05, y + h / 2, cz + Math.sign(cz) * 0.05, jr(0.3, 0.38), h * 0.58, jr(0.3, 0.38), jr(0, 3), 0.05);
        y += h;
      }
    }
    // partition between kitchen and bedroom, with a timber-framed doorway
    const pz0 = IDZ - IDW, pz1 = IDZ + IDW;
    add(rbox(PT, CUT, pz0 - ZBI + 0.05, 0.03, inWall), PX, CUT / 2, (ZBI + pz0) / 2);
    add(rbox(PT, CUT, ZFI - pz1 + 0.05, 0.03, inWall), PX, CUT / 2, (pz1 + ZFI) / 2);
    add(rbox(PT, CUT - 2.2, 2 * IDW + 0.1, 0.03, inWall), PX, (CUT + 2.2) / 2, IDZ);
    for (const s of [-1, 1]) add(rbox(PT + 0.1, 2.24, 0.14, 0.03, timber), PX, 1.12, IDZ + s * (IDW + 0.05));
    add(rbox(PT + 0.12, 0.2, 2 * IDW + 0.5, 0.04, timber), PX, 2.28, IDZ + jr(-0.02, 0.02));
    // timber ring beam along the tops of the inner walls (seen from above when the roof lifts away)
    for (const [x, z, w, d] of [[(PX + XI) / 2, ZFI - 0.09, XI - PX, 0.18], [(PX - XI) / 2, ZFI - 0.09, XI + PX, 0.18], [0, ZBI + 0.09, 2 * XI, 0.18], [XI - 0.09, (ZFI + ZBI) / 2, 0.18, ZFI - ZBI], [-XI + 0.09, (ZFI + ZBI) / 2, 0.18, ZFI - ZBI]]) {
      add(rbox(w, 0.18, d, 0.04, timber, 1), x, CUT - 0.1, z);
    }
    for (const [x, z] of [[XI - 0.1, ZFI - 0.1], [XI - 0.1, ZBI + 0.1], [-XI + 0.1, ZFI - 0.1], [-XI + 0.1, ZBI + 0.1]]) add(rbox(0.2, CUT - 0.2, 0.2, 0.04, timber, 1), x, (CUT - 0.2) / 2, z);
  }

  // ---------------- roof: thick turf slabs on rafters, a deep catslide over the porch (all in 'roof')
  const aF = Math.atan(TF), aB = Math.atan(TB);
  const dirF = new THREE.Vector3(0, -TF, 1).normalize(), nrmF = new THREE.Vector3(0, 1, TF).normalize();
  const dirB = new THREE.Vector3(0, -TB, -1).normalize(), nrmB = new THREE.Vector3(0, 1, -TB).normalize();
  const LF = (ZEF - ZR) * Math.hypot(1, TF), LB = (ZR - ZEB) * Math.hypot(1, TB);
  const onSlope = (front, x, s, up) => {
    const d = front ? dirF : dirB, n = front ? nrmF : nrmB;
    return new THREE.Vector3(x, R + d.y * s + n.y * up, ZR + d.z * s + n.z * up);
  };
  const SLAB = 0.3;
  for (const front of [true, false]) {
    const L = front ? LF : LB, rot = front ? aF : -aB;
    const c = onSlope(front, 0, L / 2 - 0.12, SLAB / 2);
    add(rbox(XR * 2, SLAB, L + 0.24, 0.12, turf), c.x, c.y, c.z, rot, 0, 0, RF);
    // fascia along the eave + bargeboards up both gable edges
    const fe = onSlope(front, 0, L + 0.08, SLAB * 0.45);
    add(rbox(XR * 2 + 0.12, SLAB + 0.12, 0.12, 0.04, timber), fe.x, fe.y, fe.z, rot, 0, 0, RF);
    for (const sx of [-1, 1]) {
      const bb = onSlope(front, sx * (XR + 0.04), L / 2, SLAB * 0.4);
      add(rbox(0.12, SLAB + 0.16, L + 0.1, 0.04, timber), bb.x, bb.y, bb.z, rot, 0, 0, RF);
    }
    // rafters under the overhang
    const sWall = (front ? ZF - ZR : ZR - ZB) * Math.hypot(1, front ? TF : TB) - 0.1;
    for (let x = -XR + 0.25; x <= XR - 0.2; x += 0.78) {
      const len = L - sWall + 0.06, p = onSlope(front, x + jr(-0.04, 0.04), sWall + len / 2, -0.08);
      add(rbox(0.14, 0.16, len, 0.04, timber, 1), p.x, p.y, p.z, rot, 0, 0, RF);
    }
  }
  // ridge beam + purlins: ends poke out past both gables; tie beams across the rooms
  add(rbox(W + 0.95, 0.24, 0.24, 0.05, timber), 0, R - 0.12, ZR, 0, 0, 0, RF);
  for (const [front, s] of [[true, 1.25], [false, 1.3]]) {
    const p = onSlope(front, 0, s, -0.12);
    add(rbox(W + 0.85, 0.2, 0.2, 0.05, timber), p.x, p.y, p.z, 0, 0, 0, RF);
  }
  for (const x of [-3.2, -1.8, 0.6, 3.4]) add(rbox(0.2, 0.22, ZFI - ZBI + 0.3, 0.05, timber, 1), x, CUT + 0.12, (ZFI + ZBI) / 2, 0, 0, 0, RF);
  // wall plate along the front wall top (seen under the porch)
  add(rbox(W + 0.3, 0.2, 0.26, 0.05, timber), 0, HF - 0.12, ZF + 0.06, 0, 0, 0, RF);

  // ---------------- porch: timber posts on stone pads, braces, beam; flush flagstone floor
  const POSTS = [-4.45, -1.4, DX - 1.15, DX + 1.15, 4.45];
  {
    const beamY = roofY(ZP) - 0.31;
    add(rbox(XR * 2 - 0.1, 0.22, 0.24, 0.05, timber), 0, beamY, ZP);
    for (const px of POSTS) {
      const h = beamY - 0.11 - 0.12;
      add(rbox(0.22, h, 0.22, 0.05, timber), px + jr(-0.02, 0.02), 0.12 + h / 2, ZP, jr(-0.02, 0.02), 0, jr(-0.02, 0.02));
      add(rbox(0.38, 0.14, 0.38, 0.06, flag), px, 0.07, ZP);
      for (const sx of [-1, 1]) {
        if (Math.abs(px + sx * 0.6) > XR - 0.2) continue;
        add(rbox(0.11, 0.92, 0.11, 0.03, timber, 1), px + sx * 0.32, beamY - 0.42, ZP, 0, 0, -sx * Math.PI / 4);
      }
    }
    add(rbox(4.4, 0.04, 1.25, 0.015, grout, 1), DX - 0.7, 0.02, ZF + 0.6);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) {
      const fx = DX - 2.75 + i * 0.58 + jr(-0.04, 0.04), fz = ZF + 0.22 + j * 0.39 + jr(-0.03, 0.03);
      add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.25, 0.3), jr(0.27, 0.31), 0.04, 7), flag), fx, 0.035, fz, 0, jr(0, 3), 0);
    }
  }

  // ---------------- chimney: stone stack rising from the hearth through the back slope, cap and clay pot (in 'roof')
  const CX = HX, CZ = -3.08;
  {
    add(rbox(0.82, 5.85 - CUT, 0.82, 0.08, grout), CX, (5.85 + CUT) / 2, CZ, 0, 0, 0, RF);
    const h = 0.41, top = () => 5.82;
    wallStones(CX - h, CZ + h, CX + h, CZ + h, top, [], 3.0, 0.62, 0.04);
    wallStones(CX + h, CZ + h, CX + h, CZ - h, top, [], 3.0, 0.62, 0.04);
    wallStones(CX + h, CZ - h, CX - h, CZ - h, top, [], 3.0, 0.62, 0.04);
    wallStones(CX - h, CZ - h, CX - h, CZ + h, top, [], 3.0, 0.62, 0.04);
    add(rbox(1.08, 0.16, 1.08, 0.05, flag), CX, 5.9, CZ, 0, 0, 0, RF);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.42, 12), terracotta), CX + 0.12, 6.18, CZ - 0.05, 0, 0, 0, RF);
  }

  // ---------------- doorway: deep timber frame; the plank door stands open, folded back against the inner wall
  {
    for (const sx of [-1, 1]) add(rbox(0.16, DH + 0.12, T + 0.14, 0.04, timber), DX + sx * (DWH + 0.08), (DH + 0.12) / 2, ZF - T / 2 + 0.05);
    add(rbox(2 * DWH + 0.5, 0.26, T + 0.18, 0.06, timber), DX + 0.02, DH + 0.13, ZF - T / 2 + 0.06, 0, 0, 0.015);
    add(rbox(2 * DWH + 0.1, 0.05, T + 0.1, 0.02, timberLight, 1), DX, 0.025, ZF - T / 2);                 // worn threshold
    const z = ZFI - 0.05, x0 = DX + DWH + 0.12, n = 6, pw = (2 * DWH) / n, dh = DH - 0.06;
    for (let k = 0; k < n; k++) add(rbox(pw - 0.008, dh, 0.07, 0.02, doorWood, 1), x0 + (k + 0.5) * pw, 0.03 + dh / 2, z, 0, 0, jr(-0.006, 0.006));
    for (const y of [0.5, 1.75]) {
      add(rbox(2 * DWH - 0.06, 0.11, 0.04, 0.015, timberLight, 1), x0 + DWH, y, z - 0.055);
      add(rbox(0.5, 0.05, 0.02, 0.01, iron, 1), x0 + 0.3, y, z - 0.08);
    }
    add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.016, 6, 16), iron), x0 + 2 * DWH - 0.25, 1.1, z - 0.09);
  }

  // ---------------- small deep-set windows: warm glass, timber reveal & lintel through the wall, stone sill, slatted blue shutters
  function windowUnit(P, x, y, w, h, nSh) {
    const a = (m, px, py, pz, ry = 0, rz = 0) => add(m, px, py, pz, 0, ry, rz, P);
    a(rbox(w + 0.06, h + 0.06, 0.05, 0.02, glass, 1), x, y, 0.01);
    for (const s of [-1, 1]) a(rbox(0.1, h + 0.1, T + 0.29, 0.03, timber, 1), x + s * (w / 2 + 0.05), y, (0.29 - T) / 2);
    a(rbox(w + 0.56, 0.2, T + 0.31, 0.05, timber), x + jr(-0.03, 0.03), y + h / 2 + 0.15, (0.31 - T) / 2, 0, jr(-0.03, 0.03));
    a(rbox(w + 0.34, 0.12, 0.42, 0.04, flag), x, y - h / 2 - 0.08, 0.16);
    a(rbox(w + 0.24, 0.07, T + 0.04, 0.02, timberLight, 1), x, y - h / 2 - 0.05, -T / 2);          // inner sill board
    a(rbox(0.05, h, 0.06, 0.015, timberLight, 1), x, y, 0.05);
    a(rbox(w, 0.05, 0.06, 0.015, timberLight, 1), x, y + h * 0.1, 0.05);
    if (!nSh) return;
    const sw = w * 0.56;
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      for (let k = 0; k < 3; k++) add(rbox(sw / 3 - 0.012, h + 0.1, 0.05, 0.012, shutterMat, 1), (k - 1) * (sw / 3), 0, 0, 0, 0, 0, sh);
      for (const yy of [-0.28, 0.28]) add(rbox(sw * 0.9, 0.07, 0.03, 0.01, shutterMat, 1), 0, h * yy, 0.035, 0, 0, 0, sh);
      sh.position.set(x + s * (w / 2 + 0.12 + sw / 2 * Math.cos(0.3)), y, 0.3 + sw / 2 * Math.sin(0.3));
      sh.rotation.y = -s * 0.3;
      P.add(sh);
    }
  }
  for (const [x, y, w, h, n] of FRONT_WIN) { const g = new THREE.Group(); windowUnit(g, 0, y, w, h, n); g.position.set(x, 0, ZF); root.add(g); }
  for (const [x, y, w, h, n] of BACK_WIN) { const g = new THREE.Group(); windowUnit(g, 0, y, w, h, n); g.position.set(x, 0, ZB); g.rotation.y = Math.PI; root.add(g); }
  for (const [sd, z, y, w, h, n] of SIDE_WIN) { const g = new THREE.Group(); windowUnit(g, 0, y, w, h, n); g.position.set(sd * W / 2, 0, z); g.rotation.y = sd * Math.PI / 2; root.add(g); }

  // ---------------- built-in porch bench with a plaid throw (left of the door)
  const BX = 0.45;
  {
    const z = ZF + 0.38, y0 = 0.04;
    add(rbox(1.18, 0.08, 0.44, 0.03, timberLight), BX, y0 + 0.44, z);
    add(rbox(1.1, 0.12, 0.04, 0.02, timberLight, 1), BX, y0 + 0.34, z + 0.19);
    for (const sx of [-1, 1]) {
      add(rbox(0.08, 0.42, 0.42, 0.03, timberLight, 1), BX + sx * 0.55, y0 + 0.21, z);
      add(rbox(0.08, 0.62, 0.08, 0.03, timberLight, 1), BX + sx * 0.55, y0 + 0.72, ZF + 0.2);
      add(rbox(0.09, 0.06, 0.46, 0.02, timberLight, 1), BX + sx * 0.55, y0 + 0.7, z + 0.01);
    }
    for (const y of [0.66, 0.88]) add(rbox(1.08, 0.1, 0.05, 0.02, timberLight, 1), BX, y0 + y, ZF + 0.22, -0.1);
    add(rbox(0.5, 0.035, 0.42, 0.015, plaid, 1), BX + 0.25, y0 + 0.5, z + 0.01, 0, 0.05, 0);
    add(rbox(0.5, 0.42, 0.035, 0.015, plaid, 1), BX + 0.26, y0 + 0.7, ZF + 0.26, -0.12, 0.05, 0);
  }

  // ---------------- iron wall lanterns (outside by the door, and inside both rooms)
  const lantern = (lx, ly, lz, ry = 0) => {
    const g = new THREE.Group(); g.position.set(lx, ly, lz); g.rotation.y = ry; root.add(g);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 14, Math.PI / 2), iron), 0, 0.08, 0, 0, Math.PI / 2, 0, g);
    add(rbox(0.22, 0.3, 0.22, 0.03, glow, 1), 0, -0.08, 0.16, 0, 0, 0, g);
    add(rbox(0.28, 0.05, 0.28, 0.02, iron, 1), 0, 0.09, 0.16, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 4), iron), 0, 0.19, 0.16, 0, Math.PI / 4, 0, g);
  };
  lantern(DX - DWH - 0.5, 2.12, ZF + 0.22);
  if (opts.light !== false) { const pl = new THREE.PointLight(0xffb45a, 1.2, 4.5, 2); pl.position.set(DX - DWH - 0.5, 2.02, ZF + 0.57); root.add(pl); }
  lantern(XI, 2.05, -2.45, -Math.PI / 2);                 // kitchen, beside the dresser
  lantern(PX + PT / 2, 2.05, 0.9, Math.PI / 2);           // kitchen, over the table
  lantern(-XI, 2.05, -0.95, Math.PI / 2);                 // bedroom, by the window

  // ---------------- interior floors: warm flagstones in the kitchen, boards in the bedroom
  const flags = [], boards = [];
  {
    add(rbox(XI - PX - PT / 2 + 0.02, 0.04, ZFI - ZBI + 0.02, 0.01, grout, 1), (XI + PX + PT / 2) / 2, 0.02, (ZFI + ZBI) / 2);
    const FLAGPAL = [0xdcb994, 0xcfa87e, 0xe6c8a2, 0xc49d78, 0xd8b088, 0xe9d0ae].map((h) => new THREE.Color(h));
    for (let z = ZBI + 0.24, r = 0; z < ZFI; z += 0.47, r++) for (let x = PX + PT / 2 + 0.2 + (r % 2) * 0.24; x < XI; x += 0.5) {
      o.position.set(x + jr(-0.04, 0.04), 0.045, z + jr(-0.04, 0.04)); o.rotation.set(0, jr(0, 6.28), 0);
      o.scale.set(jr(0.26, 0.31), 0.03, jr(0.24, 0.29)); o.updateMatrix();
      flags.push([o.matrix.clone(), FLAGPAL[Math.floor(rr() * FLAGPAL.length)].clone().offsetHSL(0, 0, jr(-0.03, 0.03))]);
    }
    const BOARD = [0xe7b27a, 0xd8a06a, 0xefc08c, 0xcf9862, 0xe2aa72].map((h) => new THREE.Color(h));
    for (let z = ZBI + 0.1; z < ZFI; z += 0.2) {
      let x = -XI;
      while (x < PX - PT / 2 - 0.05) {
        const len = Math.min(jr(1.2, 2.4), PX - PT / 2 - x);
        o.position.set(x + len / 2, 0.035, z); o.rotation.set(0, 0, jr(-0.004, 0.004)); o.scale.set(len - 0.015, 1, 1); o.updateMatrix();
        boards.push([o.matrix.clone(), BOARD[Math.floor(rr() * BOARD.length)].clone().offsetHSL(0, 0, jr(-0.03, 0.03))]);
        x += len;
      }
    }
    add(rbox(PX - PT / 2 + XI + 0.02, 0.03, ZFI - ZBI + 0.02, 0.01, timber, 1), (PX - PT / 2 - XI) / 2, 0.015, (ZFI + ZBI) / 2);
    // board threshold through the inner doorway
    add(rbox(PT + 0.2, 0.05, 2 * IDW, 0.02, timberLight, 1), PX, 0.035, IDZ);
  }

  const leaves = [], blossoms = [];
  const herbs = (x, y, z, col) => {                         // a dried herb bundle hanging stem-up from a nail
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), M(0x8a6a44, null)), x, y - 0.06, z);
    for (let q = 0; q < 7; q++) blossoms.push([x + jr(-0.04, 0.04), y - 0.14 - q * 0.035, z + jr(-0.03, 0.03), col, [0.75, 0.9, 0.75]]);
    for (let q = 0; q < 4; q++) leaves.push([x + jr(-0.05, 0.05), y - 0.12 - q * 0.05, z + jr(-0.03, 0.03), 0.6]);
  };
  const crockAt = (x, y, z, s = 1, mat = crock) => add(new THREE.Mesh(lathe([[0, 0], [0.08, 0], [0.11, 0.07], [0.115, 0.15], [0.08, 0.21], [0.085, 0.24], [0, 0.24]], 12), mat), x, y, z, 0, jr(0, 6), 0).scale.setScalar(s);

  // ================= KITCHEN =================
  // ---------------- the great open hearth: rounded stones, soot-black firebox, mantel beam, crane with the hanging pot
  {
    const x0 = HX - 1.1, x1 = HX + 1.1, zf = -2.62, fb0 = HX - 0.65, fb1 = HX + 0.65, FBH = 1.35, MY = 1.5;
    add(rbox(x1 - x0 + 0.1, 0.22, 1.2, 0.05, flag), HX, 0.11, ZBI + 0.6);                                   // raised hearth slab
    add(rbox(fb0 - x0, MY, zf - ZBI, 0.04, inWall), (x0 + fb0) / 2, MY / 2, (zf + ZBI) / 2);                // jambs
    add(rbox(x1 - fb1, MY, zf - ZBI, 0.04, inWall), (x1 + fb1) / 2, MY / 2, (zf + ZBI) / 2);
    add(rbox(x1 - x0, MY - FBH + 0.05, zf - ZBI, 0.04, inWall), HX, (MY + FBH) / 2, (zf + ZBI) / 2);
    add(rbox(fb1 - fb0, FBH, 0.1, 0.03, soot, 1), HX, FBH / 2 + 0.2, ZBI + 0.06);                          // sooty back
    for (const s of [-1, 1]) add(rbox(0.06, FBH, zf - ZBI - 0.1, 0.02, soot, 1), HX + s * (fb1 - fb0) / 2 * 0.98, FBH / 2 + 0.2, (zf + ZBI) / 2 + 0.03);
    add(rbox(x1 - x0 - 0.5, CUT - MY - 0.1, zf - ZBI, 0.05, inWall), HX, (CUT + MY + 0.1) / 2, (zf + ZBI) / 2);   // breast
    add(rbox(x1 - x0 + 0.4, 0.2, 0.42, 0.05, timber), HX, MY + 0.1, zf + 0.1, 0, 0, jr(-0.01, 0.01));     // mantel beam
    for (const s of [-1, 1]) add(rbox(0.16, 0.24, 0.3, 0.04, timber, 1), HX + s * 1.15, MY - 0.12, zf + 0.06);
    wallStones(x0, zf, x1, zf, (t) => (t < 0.26 || t > x1 - x0 - 0.26 ? MY - 0.02 : CUT), [[fb0 - x0 - 0.02, fb1 - x0 + 0.02, 0, FBH + 0.22], [-1, 9, MY - 0.02, MY + 0.22]], 0.22, 0.75, 0.02);
    wallStones(x0, ZBI, x0, zf, () => MY - 0.02, [], 0.22, 0.75, 0.02);
    wallStones(x1, zf, x1, ZBI, () => MY - 0.02, [], 0.22, 0.75, 0.02);
    for (let k = 0; k < 9; k++) pushStone(fb0 + (k + 0.5) * (fb1 - fb0) / 9, FBH + 0.12, zf + 0.04, 0.085, 0.13, 0.12, 0, 0.03);   // arch voussoirs
    // fire: logs on iron dogs, flames, embers
    for (const s of [-1, 1]) add(rbox(0.06, 0.18, 0.5, 0.02, iron, 1), HX + s * 0.35, 0.31, ZBI + 0.5);
    for (const [lx, ly, lz, ry] of [[-0.1, 0.4, 0.45, 0.2], [0.15, 0.42, 0.5, -0.25], [0.02, 0.55, 0.42, 0.05]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 8), logMat), HX + lx, ly, ZBI + lz, 0, ry, Math.PI / 2);
    for (const [fx, fh, fz] of [[0, 0.75, 0.45], [-0.25, 0.55, 0.5], [0.25, 0.6, 0.42], [0.12, 0.45, 0.62], [-0.12, 0.42, 0.36], [-0.38, 0.32, 0.55], [0.38, 0.35, 0.5]]) add(new THREE.Mesh(new THREE.ConeGeometry(0.13, fh, 7), fire), HX + fx, 0.4 + fh / 2, ZBI + fz, 0, jr(0, 3), jr(-0.1, 0.1));
    add(rbox(fb1 - fb0 - 0.2, 0.7, 0.04, 0.02, M(0xff9a40, null, { emissive: 0xff6a10, emissiveIntensity: 0.6 }), 1), HX, 0.6, ZBI + 0.12);   // glow on the sooty back
    add(rbox(0.9, 0.05, 0.5, 0.02, fire, 1), HX, 0.245, ZBI + 0.48);
    // iron crane, chain and the big pot
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), iron), HX - 0.55, 0.75, ZBI + 0.2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 6), iron), HX - 0.25, 1.22, ZBI + 0.42, 0, -0.6, Math.PI / 2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 4), iron), HX, 1.1, ZBI + 0.6);
    add(new THREE.Mesh(lathe([[0, 0.02], [0.14, 0.0], [0.27, 0.12], [0.3, 0.26], [0.26, 0.4], [0.27, 0.43], [0.23, 0.44]], 16), iron), HX, 0.55, ZBI + 0.6);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 5, 18, Math.PI), iron), HX, 0.98, ZBI + 0.6, 0, 0, 0);
    // tongs & shovel leaning by the hearth, crocks + a trailing plant on the mantel, herbs hanging off its front
    for (const [dx, rz] of [[1.28, -0.06], [1.38, 0.05]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 5), iron), HX + dx, 0.7, zf + 0.22, 0.08, 0, rz);
    add(rbox(0.14, 0.2, 0.03, 0.01, iron, 1), HX + 1.38, 0.3, zf + 0.25, 0.08);
    for (const [dx, s, m] of [[-0.95, 1.2, crock], [-0.7, 1.0, crock], [-0.48, 0.85, terracotta], [0.62, 1.1, crock], [0.9, 0.9, crock], [1.08, 0.75, terracotta]]) crockAt(HX + dx, MY + 0.2, zf + 0.12, s, m);
    for (let k = 0; k < 34; k++) leaves.push([HX + jr(-0.3, 0.35), MY + 0.2 + jr(-0.35, 0.2), zf + 0.3 + jr(-0.05, 0.08), 0.6]);
    [[-0.9, 0x9a7ad0], [-0.6, 0xe6c24a], [0.55, 0xf4f0e2], [0.85, 0xe6c24a]].forEach(([dx, c]) => herbs(HX + dx, MY - 0.02, zf + 0.34, c));
  }
  // ---------------- stone side block with a firewood niche + wall shelves of crocks (left of the hearth, under the back window)
  {
    const x0 = 0.05, x1 = HX - 1.15, d = 0.55;
    add(rbox(x1 - x0, 0.95, d, 0.05, inWall), (x0 + x1) / 2, 0.475, ZBI + d / 2);
    add(rbox(x1 - x0 + 0.08, 0.08, d + 0.06, 0.03, timber, 1), (x0 + x1) / 2, 0.98, ZBI + d / 2);
    add(rbox(x1 - x0 - 0.16, 0.56, 0.06, 0.03, soot, 1), (x0 + x1) / 2, 0.38, ZBI + d - 0.05);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r % 2); c++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.5, 7), logMat), x0 + 0.18 + c * 0.17 + (r % 2) * 0.08, 0.18 + r * 0.15, ZBI + d - 0.12, Math.PI / 2, jr(0, 3), 0);
    crockAt((x0 + x1) / 2 - 0.2, 1.02, ZBI + 0.3, 1.1, terracotta);
    add(new THREE.Mesh(lathe([[0, 0], [0.16, 0], [0.22, 0.1], [0.24, 0.13], [0, 0.13]], 14), timberLight), (x0 + x1) / 2 + 0.15, 1.02, ZBI + 0.32);
    for (let k = 0; k < 5; k++) blossoms.push([(x0 + x1) / 2 + 0.15 + jr(-0.1, 0.1), 1.12 + jr(0, 0.04), ZBI + 0.32 + jr(-0.1, 0.1), 0xd8402e, [1.15, 1.05, 1.15]]);
  }
  // ---------------- crock shelves on the partition (kitchen side) with hanging herbs
  {
    const x = PX + PT / 2 + 0.15;
    for (const y of [1.45, 1.95]) {
      add(rbox(0.3, 0.06, 1.3, 0.02, timberLight, 1), x, y, -0.35);
      for (const z of [-0.85, 0.15]) add(rbox(0.2, 0.18, 0.06, 0.02, timber, 1), x - 0.04, y - 0.1, z);
      for (let k = 0; k < 4; k++) crockAt(x + jr(-0.03, 0.03), y + 0.03, -0.85 + k * 0.33 + jr(-0.04, 0.04), jr(0.75, 1.15), rr() < 0.3 ? terracotta : crock);
    }
    for (let k = 0; k < 14; k++) leaves.push([x + jr(0, 0.12), 1.95 + jr(-0.35, 0.1), -0.05 + jr(-0.15, 0.15), 0.9]);
    [[-0.95, 0x9a7ad0], [-0.65, 0xe6c24a], [0.25, 0x8fb860]].forEach(([z, c]) => herbs(x + 0.1, 2.32, z, c));
  }
  // ---------------- dresser with plates and crocks (right of the hearth)
  {
    const x0 = HX + 1.35, x1 = XI, cx = (x0 + x1) / 2, w = x1 - x0;
    add(rbox(w, 0.92, 0.55, 0.04, timberLight), cx, 0.46, ZBI + 0.275);
    add(rbox(w + 0.06, 0.06, 0.6, 0.02, timber, 1), cx, 0.95, ZBI + 0.3);
    for (const s of [-1, 1]) {
      add(rbox(w / 2 - 0.1, 0.62, 0.03, 0.02, timber, 1), cx + s * w / 4, 0.48, ZBI + 0.56);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), iron), cx + s * 0.08, 0.55, ZBI + 0.59);
    }
    for (const s of [-1, 1]) add(rbox(0.06, 1.25, 0.3, 0.02, timberLight, 1), cx + s * (w / 2 - 0.03), 1.6, ZBI + 0.15);
    add(rbox(w, 1.25, 0.03, 0.01, timber, 1), cx, 1.6, ZBI + 0.02);
    add(rbox(w + 0.1, 0.1, 0.36, 0.03, timber, 1), cx, 2.26, ZBI + 0.18);
    for (const y of [1.35, 1.8]) {
      add(rbox(w - 0.1, 0.05, 0.28, 0.015, timberLight, 1), cx, y, ZBI + 0.15);
      add(rbox(w - 0.1, 0.04, 0.02, 0.01, timber, 1), cx, y + 0.08, ZBI + 0.28);
    }
    for (let k = 0; k < 4; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 14), crock), x0 + 0.2 + k * 0.24, 1.55, ZBI + 0.1, Math.PI / 2 - 0.2);
    for (let k = 0; k < 3; k++) crockAt(x0 + 0.22 + k * 0.33, 1.83, ZBI + 0.15, jr(0.8, 1.05), k === 1 ? terracotta : crock);
    crockAt(x0 + 0.25, 0.98, ZBI + 0.3, 1.2); crockAt(x0 + 0.62, 0.98, ZBI + 0.25, 0.9, terracotta);
    for (let k = 0; k < 18; k++) leaves.push([x1 - 0.2 + jr(-0.15, 0.12), 2.3 + jr(-0.45, 0.12), ZBI + 0.3 + jr(-0.1, 0.1), 0.9]);
  }
  // ---------------- cast-iron range against the right wall: oven doors, rail + tea towel, stovepipe into the wall, copper kettle
  const RZ = -1.4;
  {
    const d = 0.6, x = XI - d / 2;
    add(rbox(d, 0.78, 1.0, 0.04, iron), x, 0.47, RZ);
    for (const s of [-1, 1]) add(rbox(0.08, 0.1, 0.08, 0.02, iron, 1), x - 0.2, 0.05, RZ + s * 0.42);
    add(rbox(d + 0.06, 0.06, 1.08, 0.02, iron, 1), x, 0.89, RZ);
    for (const [dz, y, h] of [[-0.24, 0.42, 0.42], [0.24, 0.42, 0.42], [0.24, 0.73, 0.14]]) {
      add(rbox(0.04, h, 0.4, 0.015, M(0x2c2622, null), 1), x - d / 2 - 0.01, y, RZ + dz);
      add(rbox(0.04, 0.03, 0.16, 0.01, copper, 1), x - d / 2 - 0.035, y + h / 2 - 0.06, RZ + dz);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.96, 5), copper), x - d / 2 - 0.07, 0.8, RZ, Math.PI / 2);
    add(rbox(0.03, 0.34, 0.24, 0.01, plaid, 1), x - d / 2 - 0.08, 0.66, RZ - 0.15);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.45, 10), iron), x + 0.1, 1.64, RZ + 0.3);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10), iron), XI - 0.05, 2.32, RZ + 0.3, 0, 0, Math.PI / 2);
    add(new THREE.Mesh(lathe([[0, 0], [0.12, 0], [0.15, 0.08], [0.13, 0.17], [0.06, 0.21], [0.05, 0.24], [0, 0.24]], 14), copper), x - 0.05, 0.92, RZ - 0.22);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 5, 12, Math.PI), copper), x - 0.05, 1.14, RZ - 0.22);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.18, 6), copper), x - 0.2, 1.02, RZ - 0.22, 0, 0, 0.9);
  }
  // ---------------- long trestle table with two benches on a flowered rug, runner, daisy jug, apple bowl
  const TX = 0.55, TZ = 1.05;
  {
    add(rbox(2.5, 0.012, 2.0, 0.005, rugMat, 1), TX, 0.058, TZ - 0.1);
    add(rbox(1.8, 0.08, 0.82, 0.03, timberLight), TX, 0.78, TZ, 0, 0, jr(-0.005, 0.005));
    for (const s of [-1, 1]) {
      add(rbox(0.1, 0.72, 0.1, 0.03, timber, 1), TX + s * 0.64, 0.38, TZ, 0.18, 0, 0);
      add(rbox(0.1, 0.72, 0.1, 0.03, timber, 1), TX + s * 0.64, 0.38, TZ, -0.18, 0, 0);
      add(rbox(0.12, 0.08, 0.7, 0.03, timber, 1), TX + s * 0.64, 0.1, TZ);
    }
    add(rbox(1.35, 0.08, 0.08, 0.03, timber, 1), TX, 0.4, TZ);
    for (const bz of [TZ - 0.62, TZ + 0.64]) {
      add(rbox(1.6, 0.07, 0.3, 0.025, timberLight), TX, 0.46, bz);
      for (const s of [-1, 1]) add(rbox(0.08, 0.43, 0.24, 0.02, timber, 1), TX + s * 0.6, 0.22, bz);
    }
    add(rbox(0.42, 0.012, 1.0, 0.004, linen, 1), TX - 0.2, 0.825, TZ, 0, 0.04, 0);
    for (const dz of [-0.33, 0.33]) add(rbox(0.43, 0.014, 0.03, 0.004, M(0xd8584a, null), 1), TX - 0.2 + dz * 0.04, 0.83, TZ + dz, 0, 0.04, 0);
    crockAt(TX - 0.25, 0.82, TZ - 0.08, 1.1);
    for (let k = 0; k < 9; k++) { const px = TX - 0.25 + jr(-0.13, 0.13), py = 1.12 + jr(0, 0.12), pz = TZ - 0.08 + jr(-0.13, 0.13); blossoms.push([px, py, pz, 0xfbf8ef, [1.5, 0.45, 1.5]]); blossoms.push([px, py + 0.02, pz, 0xffcf3a, [0.55, 0.5, 0.55]]); }
    for (let k = 0; k < 8; k++) leaves.push([TX - 0.25 + jr(-0.1, 0.1), 1.02 + jr(0, 0.1), TZ - 0.08 + jr(-0.1, 0.1), 0.7]);
    add(new THREE.Mesh(lathe([[0, 0], [0.12, 0], [0.19, 0.08], [0.2, 0.11], [0, 0.11]], 14), timberLight), TX + 0.4, 0.82, TZ + 0.05);
    for (let k = 0; k < 9; k++) blossoms.push([TX + 0.4 + jr(-0.09, 0.09), 0.92 + jr(0, 0.05), TZ + 0.05 + jr(-0.09, 0.09), [0xd8402e, 0xe85a3a, 0xc8302a][k % 3], [1.15, 1.05, 1.15]]);
    crockAt(TX + 0.68, 0.82, TZ - 0.18, 0.6, terracotta); crockAt(TX + 0.58, 0.82, TZ + 0.2, 0.5);
  }

  // ================= BEDROOM =================
  // ---------------- curtained box bed in the back-left corner (built-in cupboard bed, patchwork quilt, lamp niche)
  const BED = { x0: -XI, x1: -XI + 1.45, z0: ZBI, z1: ZBI + 2.15 };
  {
    const { x0, x1, z0, z1 } = BED, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, TOP = 2.28;
    add(rbox(x1 - x0, 0.42, z1 - z0, 0.04, timber), cx, 0.21, cz);
    add(rbox(x1 - x0 - 0.12, 0.2, z1 - z0 - 0.12, 0.08, linen), cx, 0.52, cz);
    add(rbox(x1 - x0 - 0.06, 0.08, z1 - z0 - 0.5, 0.04, crock), cx + 0.02, 0.64, cz + 0.2);
    {                                                       // patchwork: rose, sky-blue and sage squares stitched over the cream quilt
      const PATCH = [quilt, shutterMat, M(0xb8d4a8, tex('burlap', 2.4)), plaid], n = 4, m = 6, pw = (x1 - x0 - 0.16) / n, pd = (z1 - z0 - 0.6) / m;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if ((i + j) % 2 === 0 || rr() < 0.3) add(rbox(pw - 0.03, 0.02, pd - 0.03, 0.008, PATCH[(i * 3 + j * 5 + Math.floor(rr() * 2)) % 4], 1), x0 + 0.1 + (i + 0.5) * pw, 0.685, z0 + 0.5 + (j + 0.5) * pd);
    }
    add(rbox(x1 - x0 + 0.02, 0.4, 0.04, 0.02, quilt, 1), cx + 0.02, 0.46, z1 - 0.07);
    add(rbox(0.04, 0.32, z1 - z0 - 0.5, 0.02, quilt, 1), x1 - 0.05, 0.5, cz + 0.2);
    for (const dx of [-0.3, 0.25]) add(rbox(0.5, 0.15, 0.32, 0.07, linen), cx + dx, 0.7, z0 + 0.3, 0.2, 0, jr(-0.05, 0.05));
    add(rbox(x1 - x0 + 0.1, 0.12, z1 - z0 + 0.1, 0.03, timber), cx, TOP, cz);                       // canopy
    add(rbox(x1 - x0 + 0.16, 0.08, z1 - z0 + 0.16, 0.03, timberLight, 1), cx, TOP + 0.09, cz);
    add(rbox(x1 - x0, 1.15, 0.08, 0.03, timberLight), cx, 0.575, z1 - 0.04);                       // foot panel + valance
    add(rbox(x1 - x0, 0.1, 0.12, 0.03, timber, 1), cx, 1.15, z1 - 0.04);
    add(rbox(x1 - x0, 0.32, 0.08, 0.03, timberLight, 1), cx, TOP - 0.2, z1 - 0.04);
    for (const z of [z0 + 0.05, z1 - 0.05]) add(rbox(0.12, TOP, 0.12, 0.03, timber, 1), x1 - 0.06, TOP / 2, z);
    add(rbox(0.12, 0.32, z1 - z0, 0.03, timber, 1), x1 - 0.06, TOP - 0.2, cz);                      // valance
    add(rbox(0.25, 0.05, 0.7, 0.015, timberLight, 1), x0 + 0.13, 1.35, z0 + 0.5);                  // niche shelf + lamp + books
    add(rbox(0.12, 0.2, 0.12, 0.03, glow, 1), x0 + 0.13, 1.48, z0 + 0.3);
    add(rbox(0.16, 0.04, 0.16, 0.01, iron, 1), x0 + 0.13, 1.6, z0 + 0.3);
    for (let k = 0; k < 4; k++) add(rbox(0.16, jr(0.17, 0.22), 0.05, 0.01, k % 2 ? M(0x7e9a6a, null) : M(0xc0604a, null), 1), x0 + 0.13, 1.47, z0 + 0.55 + k * 0.06, 0, 0, jr(-0.05, 0.05));
    // curtains gathered at both posts, rod across the front
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, z1 - z0, 6), timberLight), x1 + 0.04, TOP - 0.08, cz, Math.PI / 2);
    const curtainMat = M(0xffe6da, null);
    for (const [z, s] of [[z0 + 0.32, 1], [z1 - 0.34, -1]]) {
      for (let k = 0; k < 5; k++) add(rbox(0.07, TOP - 0.22, 0.13, 0.03, curtainMat, 1), x1 + 0.06 + (k % 2) * 0.04, (TOP - 0.16) / 2, z + s * (k - 2) * 0.075, 0, 0, s * (k - 2) * 0.012);
      for (let k = 0; k < 7; k++) blossoms.push([x1 + 0.12, jr(0.4, 2.0), z + jr(-0.17, 0.17), 0xe4706a, [0.5, 0.5, 0.25]]);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 5, 10), M(0xe08070, null)), x1 + 0.08, 1.15, z, Math.PI / 2, 0, 0);
    }
  }
  // ---------------- wardrobe (back wall, right of the spinning-wheel corner) with folded quilts on top
  {
    const x0 = -1.55, x1 = PX - PT / 2 - 0.02, cx = (x0 + x1) / 2, w = x1 - x0, d = 0.55;
    add(rbox(w, 2.0, d, 0.04, timberLight), cx, 1.06, ZBI + d / 2);
    add(rbox(w + 0.1, 0.1, d + 0.08, 0.03, timber, 1), cx, 2.09, ZBI + d / 2);
    add(rbox(w + 0.04, 0.1, d + 0.04, 0.03, timber, 1), cx, 0.05, ZBI + d / 2);
    for (const s of [-1, 1]) {
      add(rbox(w / 2 - 0.1, 1.25, 0.03, 0.02, timber, 1), cx + s * w / 4, 1.3, ZBI + d + 0.01);
      add(rbox(w / 2 - 0.22, 1.0, 0.03, 0.02, timberLight, 1), cx + s * w / 4, 1.3, ZBI + d + 0.025);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), timber), cx + s * 0.07, 1.25, ZBI + d + 0.05);
    }
    add(rbox(w - 0.16, 0.3, 0.03, 0.02, timber, 1), cx, 0.42, ZBI + d + 0.01);
    add(rbox(0.7, 0.13, 0.42, 0.05, quilt), cx, 2.21, ZBI + 0.3, 0, 0.05, 0);
    add(rbox(0.66, 0.12, 0.4, 0.05, M(0xc6dcc4, tex('burlap', 2.4))), cx + 0.02, 2.33, ZBI + 0.3, 0, -0.06, 0);
    for (let k = 0; k < 12; k++) leaves.push([x1 - 0.05 + jr(-0.1, 0.05), 2.1 + jr(-0.6, 0.1), ZBI + d + jr(-0.05, 0.08), 0.9]);
  }
  // ---------------- built-in stove: iron firebox set into a stone niche in the gable wall, pipe up the wall, copper kettle
  const SZ = 1.15;
  {
    add(rbox(0.7, 0.24, 0.85, 0.05, flag), -XI + 0.3, 0.12, SZ);
    add(rbox(0.36, 1.5, 0.95, 0.06, inWall), -XI + 0.1, 0.75, SZ);
    wallStones(-XI + 0.28, SZ - 0.48, -XI + 0.28, SZ + 0.48, () => 1.45, [[0.18, 0.78, 0.24, 1.0]], 0.24, 0.6, 0.0);
    add(rbox(0.5, 0.56, 0.56, 0.08, iron), -XI + 0.36, 0.52, SZ);
    add(rbox(0.04, 0.24, 0.3, 0.02, fire, 1), -XI + 0.6, 0.52, SZ);
    for (let k = -1; k <= 1; k++) add(rbox(0.05, 0.26, 0.025, 0.01, iron, 1), -XI + 0.62, 0.52, SZ + k * 0.08);
    add(rbox(0.56, 0.05, 0.62, 0.02, iron, 1), -XI + 0.36, 0.82, SZ);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 10), iron), -XI + 0.3, 1.58, SZ - 0.1);
    add(new THREE.Mesh(lathe([[0, 0], [0.12, 0], [0.15, 0.08], [0.13, 0.17], [0.06, 0.21], [0.05, 0.24], [0, 0.24]], 14), copper), -XI + 0.42, 0.85, SZ + 0.12);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 5, 12, Math.PI), copper), -XI + 0.42, 1.07, SZ + 0.12);
  }
  // ---------------- washtub on a low bench by the front wall, washboard, pitcher and towel
  const WX = -1.35;
  {
    add(rbox(1.05, 0.07, 0.44, 0.03, timberLight), WX, 0.42, ZFI - 0.24);
    for (const s of [-1, 1]) add(rbox(0.08, 0.4, 0.36, 0.02, timber, 1), WX + s * 0.42, 0.2, ZFI - 0.24);
    add(new THREE.Mesh(lathe([[0, 0], [0.26, 0], [0.3, 0.12], [0.31, 0.26], [0.28, 0.26], [0.27, 0.06], [0, 0.06]], 18), barrelWood), WX - 0.15, 0.455, ZFI - 0.24);
    for (const y of [0.52, 0.66]) add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 5, 20), iron), WX - 0.15, y, ZFI - 0.24, Math.PI / 2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 16), M(0xc6dce6, null, { roughness: 0.6 })), WX - 0.15, 0.68, ZFI - 0.24);
    add(rbox(0.36, 0.5, 0.03, 0.01, timberLight, 1), WX - 0.05, 0.84, ZFI - 0.08, -0.25, 0, 0);
    for (let k = 0; k < 6; k++) add(rbox(0.3, 0.02, 0.02, 0.005, M(0xb0aaa0, null), 1), WX - 0.05, 0.7 + k * 0.05, ZFI - 0.11 + k * 0.012, -0.25);
    add(rbox(0.28, 0.02, 0.36, 0.01, plaid, 1), WX - 0.2, 0.75, ZFI - 0.3, 0.2, 0.3, 0.6);
    add(new THREE.Mesh(lathe([[0, 0], [0.09, 0], [0.11, 0.12], [0.08, 0.22], [0.07, 0.3], [0.09, 0.32], [0, 0.32]], 12), crock), WX + 0.32, 0.455, ZFI - 0.22);
  }
  // ---------------- rag rug, shelf with jars + trailing ivy and herb bundles over the spinning-wheel corner, window planter
  {
    add(rbox(1.0, 0.012, 1.7, 0.005, M(0xf4c6b6, tex('burlap', 1.6)), 1), -2.4, 0.06, 0.1, 0, 0.04, 0);
    for (let k = 0; k < 6; k++) add(rbox(1.0, 0.014, 0.06, 0.004, M(0xd86a62, null), 1), -2.4 + Math.sin(0.04) * (k - 2.5) * 0.28, 0.064, 0.1 + (k - 2.5) * 0.28, 0, 0.04, 0);
    const sx = PX - PT / 2 - 0.12, sz = 0.95;                // shelf with jars, trailing ivy and herb bundles on the partition
    add(rbox(0.24, 0.05, 1.0, 0.015, timberLight, 1), sx, 1.95, sz);
    for (const s of [-1, 1]) add(rbox(0.18, 0.16, 0.05, 0.01, timber, 1), sx + 0.02, 1.86, sz + s * 0.4);
    crockAt(sx, 1.975, sz - 0.3, 0.9); crockAt(sx, 1.975, sz, 0.75, terracotta);
    for (let k = 0; k < 18; k++) leaves.push([sx - 0.03 + jr(-0.08, 0.05), 1.95 + jr(-0.45, 0.15), sz + 0.3 + jr(-0.1, 0.12), 0.9]);
    [[-0.35, 0x9a7ad0], [-0.1, 0xe6c24a], [0.15, 0xf4f0e2]].forEach(([dz, c]) => herbs(sx - 0.08, 1.92, sz + dz, c));
    // red geraniums in a planter on the front window's inner sill
    add(rbox(0.55, 0.14, 0.16, 0.03, terracotta, 1), -1.75, 1.36, ZFI - 0.06);
    for (let k = 0; k < 12; k++) leaves.push([-1.75 + jr(-0.25, 0.25), 1.48 + jr(0, 0.12), ZFI - 0.08 + jr(-0.06, 0.06), 0.8]);
    for (let k = 0; k < 14; k++) blossoms.push([-1.75 + jr(-0.22, 0.22), 1.58 + jr(0, 0.1), ZFI - 0.1 + jr(-0.05, 0.05), [0xe8443a, 0xd83a3a, 0xf06a5a][k % 3], [1.1, 1.1, 1.1]]);
  }

  // ---------------- turf roof: lumpy moss, grass tufts hanging over the edges, daisies (all in 'roof')
  const roofBlossoms = [];
  {
    const mossGeo = new THREE.SphereGeometry(1, 7, 4);
    {
      const p = mossGeo.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.12 * Math.sin(v.x * 4.0 + v.z * 3.0) + 0.08 * Math.sin(v.y * 5 - v.x * 2); p.setXYZ(i, v.x * n, v.y * n, v.z * n); }
      mossGeo.computeVertexNormals();
    }
    const blades = [];
    for (let k = 0; k < 5; k++) {
      const h = jr(0.16, 0.28), b = new THREE.ConeGeometry(0.035, h, 3, 1, true);
      b.translate(0, h / 2, 0); b.rotateZ(jr(0.2, 0.55)); b.rotateY((k / 5) * 6.28 + jr(-0.3, 0.3)); blades.push(b);
    }
    const tuftGeo = mergeGeometries(blades); blades.forEach((b) => b.dispose());
    const moss = [], tufts = [], groundTufts = [];
    const qF = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), aF);
    const qB = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -aB);
    const clearOfChimney = (p) => Math.abs(p.x - CX) > 0.62 || Math.abs(p.z - CZ) > 0.62;
    const MOSS = [0x8fc04a, 0x7aae3e, 0xa2cc58, 0x6c9f36, 0xb4d467, 0x86b845, 0x98c552].map((h) => new THREE.Color(h));
    const GRASS = [0x9cc850, 0xb2d660, 0x86b844, 0xc2dc6e, 0xa6cc58].map((h) => new THREE.Color(h));
    const putMoss = (p, q, sx, sy, sz, tip = 0.25) => {
      o.position.copy(p); o.quaternion.copy(q); o.rotateY(jr(0, 6.28)); o.rotateX(jr(-tip, tip)); o.scale.set(sx, sy, sz); o.updateMatrix();
      moss.push([o.matrix.clone(), MOSS[Math.floor(rr() * MOSS.length)].clone().offsetHSL(0, 0, jr(-0.04, 0.05))]);
    };
    const putTuft = (p, q, s, droop = 0, list = tufts) => {
      o.position.copy(p); o.quaternion.copy(q); o.rotateX(droop); o.rotateY(jr(0, 6.28)); o.scale.set(s, s * jr(0.8, 1.3), s); o.updateMatrix();
      list.push([o.matrix.clone(), GRASS[Math.floor(rr() * GRASS.length)].clone().offsetHSL(0, 0, jr(-0.05, 0.05))]);
    };
    for (const front of [true, false]) {
      const L = front ? LF : LB, q = front ? qF : qB, outward = front ? 1 : -1;
      const step = 0.45, rows = Math.ceil(L / step), cols = Math.ceil((XR * 2) / step);
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
        const s = Math.min(L, 0.12 + r * step + jr(-0.08, 0.08)), x = -XR + 0.05 + c * step + jr(-0.1, 0.1) + (r % 2) * step * 0.5;
        if (x > XR) continue;
        const p = onSlope(front, x, s, SLAB + jr(0.0, 0.05));
        if (!clearOfChimney(p)) continue;
        putMoss(p, q, jr(0.22, 0.36), jr(0.1, 0.17), jr(0.22, 0.36));
        for (let k = 0; k < 2; k++) if (rr() < 0.42) putTuft(onSlope(front, x + jr(-0.17, 0.17), s + jr(-0.17, 0.17), SLAB + 0.06), q, jr(0.7, 1.05));
        if (rr() < 0.42) {                                                 // daisies (white with a yellow eye) and a few buttercups
          const fp = onSlope(front, x + jr(-0.15, 0.15), s + jr(-0.15, 0.15), SLAB + 0.2 + jr(0, 0.06));
          if (rr() < 0.8) { roofBlossoms.push([fp.x, fp.y, fp.z, 0xfbf8ef, [1.6, 0.5, 1.6]]); roofBlossoms.push([fp.x, fp.y + 0.04, fp.z, 0xffcf3a, [0.6, 0.5, 0.6]]); }
          else roofBlossoms.push([fp.x, fp.y, fp.z, [0xffd84a, 0xf2a0c4][Math.floor(rr() * 2)], [0.8, 0.8, 0.8]]);
        }
      }
      // soft turf lip hanging over the eave, grass fringe drooping down
      for (let x = -XR; x <= XR; x += 0.28) {
        const p = onSlope(front, x + jr(-0.05, 0.05), L + 0.06, SLAB * 0.5);
        putMoss(p, q, jr(0.2, 0.28), jr(0.17, 0.24), jr(0.16, 0.22), 0.15);
        putTuft(onSlope(front, x + jr(-0.1, 0.1), L + 0.1, SLAB * 0.55), q, jr(0.7, 1.0), outward * jr(0.9, 1.4));
      }
      // and over both gable edges
      for (const sx of [-1, 1]) for (let s = 0.2; s < L; s += 0.28) {
        putMoss(onSlope(front, sx * (XR - 0.04), s + jr(-0.05, 0.05), SLAB * 0.55), q, jr(0.16, 0.22), jr(0.17, 0.24), jr(0.2, 0.28), 0.15);
        const tq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sx * jr(0.7, 1.1)));
        putTuft(onSlope(front, sx * (XR - 0.02), s + jr(-0.1, 0.1), SLAB * 0.6), tq, jr(0.6, 0.85));
      }
    }
    // rounded ridge of thicker moss
    for (let x = -XR; x <= XR; x += 0.28) {
      o.position.set(x + jr(-0.04, 0.04), R + SLAB * 0.95, ZR); o.rotation.set(0, jr(0, 6.28), 0); o.scale.set(jr(0.26, 0.34), jr(0.18, 0.24), jr(0.32, 0.4)); o.updateMatrix();
      moss.push([o.matrix.clone(), MOSS[Math.floor(rr() * MOSS.length)].clone()]);
      if (rr() < 0.5) roofBlossoms.push([x, R + SLAB + 0.2, ZR + jr(-0.2, 0.2), 0xfbf8ef, [1.6, 0.5, 1.6]]);
    }
    const mossI = new THREE.InstancedMesh(mossGeo, G(0xffffff, tex('leaves', 0.5), 0.313, 0.55), moss.length);
    moss.forEach(([m, c], i) => { mossI.setMatrixAt(i, m); mossI.setColorAt(i, c); });
    mossI.castShadow = true; mossI.receiveShadow = true; RF.add(mossI);
    // grass at the foot of the walls too (softens the stone into the meadow) — stays with the house, not the roof
    const qUp = new THREE.Quaternion();
    for (let k = 0; k < 70; k++) {
      const side = k % 4, t = rr();
      const p = side === 0 ? new THREE.Vector3(-W / 2 + t * W, 0, ZF + 0.28) : side === 1 ? new THREE.Vector3(-W / 2 + t * W, 0, ZB - 0.28) : new THREE.Vector3((side === 2 ? -1 : 1) * (W / 2 + 0.2), 0, ZB + t * (ZF - ZB));
      if (side === 0 && p.x > DX - 3.0 && p.x < DX + 1.6) continue;       // not on the porch floor
      putTuft(p, qUp, jr(0.9, 1.4), 0, groundTufts);
    }
    const tuftMat = M(0xffffff, null, { side: THREE.DoubleSide });
    for (const [list, P] of [[tufts, RF], [groundTufts, root]]) {
      const tuftI = new THREE.InstancedMesh(tuftGeo, tuftMat, list.length);
      list.forEach(([m, c], i) => { tuftI.setMatrixAt(i, m); tuftI.setColorAt(i, c); });
      tuftI.castShadow = true; tuftI.receiveShadow = true; P.add(tuftI);
    }
  }

  // ---------------- sunflowers by the porch, hollyhocks at the corner, climbing roses up the posts and along the eave
  {
    const stemMat = M(0x6f9a42, null), petal = M(0xffc83a, null, { side: THREE.DoubleSide }), disc = M(0x6b4220, null);
    const petalGeo = (() => {
      const s = new THREE.Shape(), n = 14;
      for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 0.1 : 0.25; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); }
      return new THREE.ShapeGeometry(s);
    })();
    const sun = [[-0.65, ZF + 0.8, 1.75], [-0.4, ZF + 1.02, 1.45], [-0.2, ZF + 0.75, 1.95], [-0.85, ZF + 1.05, 1.3], [-0.45, ZF + 0.62, 1.6]];
    for (const [x, z, h] of sun) {
      const lean = jr(-0.08, 0.08);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, h, 5), stemMat), x + lean * h / 2, h / 2, z, 0, 0, -lean);
      const hx = x + lean * h, face = jr(-0.3, 0.3);
      add(new THREE.Mesh(petalGeo, petal), hx, h + 0.02, z + 0.06, -0.25, face, 0).scale.setScalar(1.3);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.07, 12), disc), hx + Math.sin(face) * 0.03, h + 0.04, z + 0.09, Math.PI / 2 - 0.25, 0, -face);
      for (let k = 0; k < 6; k++) leaves.push([x + jr(-0.15, 0.15), jr(0.3, h - 0.25), z + jr(-0.12, 0.12), 1.35]);
    }
    for (const [x, z, h] of [[4.0, ZF + 0.42, 1.9], [4.2, ZF + 0.7, 1.55], [3.85, ZF + 0.85, 1.35]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 5), stemMat), x, h / 2, z);
      for (let q = 0; q < 11; q++) blossoms.push([x + jr(-0.06, 0.06), 0.55 + (q / 11) * (h - 0.55), z + jr(-0.06, 0.06), [0xf08fb8, 0xe36ea0, 0xf6b3cf][q % 3], [1.5, 1.5, 1.5]]);
      for (let q = 0; q < 8; q++) leaves.push([x + jr(-0.22, 0.22), jr(0.08, 0.6), z + jr(-0.22, 0.22), 1.7]);
    }
    // climbing rose up the right door post and the far-left post, along the beam and hanging from the eave
    const vine = (vx, vz, top) => { let x = vx, y = 0.2; while (y < top) { x += jr(-0.05, 0.05); y += jr(0.07, 0.13); for (let k = 0; k < 3; k++) leaves.push([x + jr(-0.13, 0.13), y + jr(-0.06, 0.06), vz + jr(-0.13, 0.13), 1]); if (rr() < 0.35) blossoms.push([x + jr(-0.12, 0.12), y, vz + jr(0, 0.14), 0xfbf6ea, [1.3, 1.3, 1.3]]); } };
    vine(POSTS[3], ZP, roofY(ZP) - 0.3);
    vine(POSTS[0], ZP, roofY(ZP) - 0.3);
    const beamY = roofY(ZP) - 0.31;
    for (let x = DX + 0.4; x < XR - 0.05; x += 0.1) {
      const hang = Math.max(0, Math.sin(x * 2.3) * 0.35 + jr(-0.05, 0.25));
      for (let k = 0; k < 2; k++) leaves.push([x + jr(-0.1, 0.1), beamY - jr(0, hang) + 0.05, ZP + jr(0.08, 0.2), 1]);
      if (rr() < 0.4) blossoms.push([x, beamY - jr(0, hang), ZP + 0.18, 0xfbf6ea, [1.3, 1.3, 1.3]]);
    }
    for (let x = -XR + 0.05; x < -3.0; x += 0.12) for (let k = 0; k < 2; k++) leaves.push([x + jr(-0.1, 0.1), beamY - jr(0, 0.25) + 0.05, ZP + jr(0.08, 0.2), 1]);
    // ivy creeping up the left gable corner
    { let x = -W / 2 - 0.2, z = ZF - 0.2, y = 0.2; while (y < HF - 0.2) { z -= jr(-0.02, 0.06); y += jr(0.07, 0.12); for (let k = 0; k < 3; k++) leaves.push([x + jr(-0.06, 0.03), y + jr(-0.06, 0.06), z + jr(-0.15, 0.15), 1]); } }
  }

  // ---------------- garden dressing (garden mode only — these look like hideable props)
  if (garden) {
    const hay = M(0xfff0cc, tex('hay', 0.8)), twine = M(0x8a6a44, null);
    const barrel = (x, z) => {
      add(new THREE.Mesh(lathe([[0, 0], [0.31, 0], [0.36, 0.2], [0.39, 0.4], [0.36, 0.62], [0.31, 0.8], [0, 0.8]], 20), barrelWood), x, 0, z, 0, jr(0, 3), 0);
      for (const y of [0.17, 0.62]) add(new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.02, 6, 24), iron), x, y, z, Math.PI / 2);
    };
    const pot = (x, y, z, col) => {
      add(new THREE.Mesh(lathe([[0, 0], [0.15, 0], [0.21, 0.28], [0.24, 0.34], [0.21, 0.36], [0, 0.36]], 18), terracotta), x, y, z);
      for (let k = 0; k < 10; k++) leaves.push([x + jr(-0.2, 0.2), y + 0.36 + jr(0, 0.2), z + jr(-0.2, 0.2), 1]);
      for (let k = 0; k < 9; k++) blossoms.push([x + jr(-0.17, 0.17), y + 0.48 + jr(0, 0.15), z + jr(-0.17, 0.17), col, [1.2, 0.8, 1.2]]);
    };
    const stool = (x, y, z) => {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), timberLight), x, y + 0.46, z);
      for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.28; add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.46, 6), timberLight), x + Math.cos(a) * 0.13, y + 0.22, z + Math.sin(a) * 0.13, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); }
    };
    // hay bales + pitchfork at the left end
    for (const [x, y, z, ry] of [[-4.4, 0.26, 2.95, 0.1], [-4.35, 0.78, 2.9, -0.15]]) {
      add(rbox(1.0, 0.52, 0.56, 0.12, hay), x, y, z, 0, ry, 0);
      for (const dx of [-0.25, 0.25]) add(rbox(0.04, 0.54, 0.58, 0.02, twine, 1), x + dx * Math.cos(ry), y, z - dx * Math.sin(ry), 0, ry, 0);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.7, 6), timberLight), -3.75, 0.82, 3.55, 0.12, 0, -0.32);
    for (const k of [-1, 0, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), iron), -3.47 + k * 0.05, 1.68, 3.67, 0.12, 0, -0.32);
    barrel(-3.3, 3.85);
    pot(0.3, 0, 3.85, 0xfbf8ef);
    // stool + pot on the porch right of the door, a stool and barrel at the right end, a planter crate
    stool(3.95, 0.04, 3.0); pot(3.95, 0.53, 3.0, 0xf06a8a);
    stool(4.2, 0, 4.5);
    barrel(4.95, 2.4);
    {
      const cx = 4.85, cz = 3.95;
      add(rbox(0.7, 0.42, 0.5, 0.03, timberLight, 1), cx, 0.21, cz);
      for (const y of [0.1, 0.32]) add(rbox(0.74, 0.08, 0.54, 0.02, timber, 1), cx, y, cz);
      for (let k = 0; k < 16; k++) leaves.push([cx + jr(-0.3, 0.3), 0.45 + jr(0, 0.18), cz + jr(-0.2, 0.2), 1]);
      for (let k = 0; k < 12; k++) blossoms.push([cx + jr(-0.28, 0.28), 0.55 + jr(0, 0.12), cz + jr(-0.18, 0.18), [0xff7a3d, 0xffd23f, 0xe8443a][k % 3], [1.2, 0.8, 1.2]]);
    }
    // stepping stones out from the porch
    for (let k = 0; k < 4; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.28, 0.36), jr(0.3, 0.38), 0.07, 8), flag), DX + Math.sin(k * 0.9) * 0.25 + jr(-0.1, 0.1), 0.03, ZF + 1.75 + k * 0.62, 0, jr(0, 3), 0);
  }

  // ---------------- instanced stones, floors, leaves, blossoms
  {
    for (const [list, P] of [[stones, root], [roofStones, RF]]) {
      const stoneI = new THREE.InstancedMesh(stoneGeo, stoneMat, list.length);
      list.forEach(([m, c], i) => { stoneI.setMatrixAt(i, m); stoneI.setColorAt(i, c); });
      stoneI.castShadow = true; stoneI.receiveShadow = true; P.add(stoneI);
    }
    const flagI = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 7), G(0xffffff, tex('stone', 0.5), 0.447, 0.5), flags.length);
    flags.forEach(([m, c], i) => { flagI.setMatrixAt(i, m); flagI.setColorAt(i, c); });
    flagI.receiveShadow = true; root.add(flagI);
    const boardI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 0.19), M(0xffffff, tex('wood_light', 0.9)), boards.length);
    boards.forEach(([m, c], i) => { boardI.setMatrixAt(i, m); boardI.setColorAt(i, c); });
    boardI.receiveShadow = true; root.add(boardI);
    const leafGeo = new THREE.CircleGeometry(0.1, 6); leafGeo.scale(1, 1.4, 1);
    const leafI = new THREE.InstancedMesh(leafGeo, M(0xffffff, null, { side: THREE.DoubleSide }), leaves.length);
    const greens = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55].map((h) => new THREE.Color(h));
    leaves.forEach(([x, y, z, s], i) => {
      o.position.set(x, y, z); o.rotation.set(jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28)); o.scale.setScalar(jr(0.7, 1.25) * s); o.updateMatrix();
      leafI.setMatrixAt(i, o.matrix); leafI.setColorAt(i, greens[Math.floor(rr() * greens.length)].clone().offsetHSL(0, 0, jr(-0.05, 0.06)));
    });
    leafI.castShadow = true; leafI.receiveShadow = true; root.add(leafI);
    const blossomGeo = new THREE.IcosahedronGeometry(0.06, 0), blossomMat = M(0xffffff, null, { roughness: 0.85 });
    for (const [list, P] of [[blossoms, root], [roofBlossoms, RF]]) {
      const blossomI = new THREE.InstancedMesh(blossomGeo, blossomMat, list.length);
      list.forEach(([x, y, z, c, sc], i) => {
        o.position.set(x, y, z); o.rotation.set(jr(-0.2, 0.2), jr(0, 6), jr(-0.2, 0.2)); o.scale.set(sc[0], sc[1], sc[2]).multiplyScalar(jr(0.85, 1.2)); o.updateMatrix();
        blossomI.setMatrixAt(i, o.matrix); blossomI.setColorAt(i, new THREE.Color(c));
      });
      blossomI.castShadow = true; P.add(blossomI);
    }
  }

  // ---------------- gameplay data (local coords): rooms, doors, wall + furniture colliders, hideable-prop slots
  const box = (x0, z0, x1, z1, rot) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0), d: Math.abs(z1 - z0), ...(rot ? { rot } : {}) });
  root.userData.rooms = [
    { name: 'kitchen', ...box(PX + PT / 2, ZBI, XI, ZFI) },
    { name: 'bedroom', ...box(-XI, ZBI, PX - PT / 2, ZFI) },
  ];
  root.userData.colliders = [
    box(-W / 2, ZFI, DX - DWH, ZF), box(DX + DWH, ZFI - 0.12, W / 2, ZF),          // front wall either side of the doorway (+ open leaf)
    box(-W / 2, ZB, W / 2, ZBI), box(-W / 2, ZB, -XI, ZF), box(XI, ZB, W / 2, ZF),
    box(PX - PT / 2, ZBI, PX + PT / 2, IDZ - IDW), box(PX - PT / 2, IDZ + IDW, PX + PT / 2, ZFI),
    box(HX - 1.15, ZBI, HX + 1.15, ZBI + 1.2),                                     // hearth + raised slab
    box(0.05, ZBI, HX - 1.15, ZBI + 0.55), box(HX + 1.35, ZBI, XI, ZBI + 0.55),    // log block, dresser
    box(XI - 0.62, RZ - 0.54, XI, RZ + 0.54),                                      // range
    box(TX - 0.92, TZ - 0.8, TX + 0.92, TZ + 0.8),                                   // table + benches
    box(BED.x0, BED.z0, BED.x1 + 0.12, BED.z1), box(-1.55, ZBI, PX - PT / 2, ZBI + 0.58),   // box bed, wardrobe
    box(-XI, SZ - 0.45, -XI + 0.68, SZ + 0.45),                                    // built-in stove
    box(WX - 0.53, ZFI - 0.48, WX + 0.53, ZFI),                                    // washtub bench
    ...POSTS.map((px) => box(px - 0.15, ZP - 0.15, px + 0.15, ZP + 0.15)),
    box(BX - 0.62, ZF, BX + 0.62, ZF + 0.62),                                      // porch bench
  ];
  root.userData.propSlots = [
    // kitchen: milk cans along the right wall, a butter churn by the dresser, veg baskets either side of the hearth
    { id: 'milk_can', x: XI - 0.62, z: -0.3, rot: 0.3 }, { id: 'milk_can', x: XI - 0.62, z: 0.48, rot: 1.1 }, { id: 'milk_can', x: XI - 0.62, z: 1.26, rot: 2.0 },
    { id: 'butter_churn', x: HX + 1.62, z: ZBI + 1.1, rot: 0.2 },
    { id: 'veg_basket', x: HX - 0.6, z: ZBI + 1.75, rot: 0.5 }, { id: 'veg_basket', x: HX + 0.6, z: ZBI + 1.75, rot: -0.3 },
    // bedroom: quilt chest at the foot of the box bed, spinning wheel between bed and wardrobe, cushions by the curtains,
    // rocking chairs by the stove, laundry baskets along the partition
    { id: 'chest', x: -XI + 0.7, z: BED.z1 + 0.62, rot: 0 },
    { id: 'spinning_wheel', x: -2.115, z: ZBI + 0.62, rot: 0.3 },
    { id: 'cushion_pile', x: -2.15, z: -1.2, rot: 0.1 },
    { id: 'rocking_chair', x: -3.05, z: 0.95, rot: -Math.PI / 2 + 0.3 }, { id: 'rocking_chair', x: -1.95, z: 0.35, rot: -0.6 },
    { id: 'laundry_basket', x: -1.0, z: 0.95, rot: 0.2 }, { id: 'laundry_basket', x: -1.0, z: -0.05, rot: -0.4 },
  ];
  root.userData.footprint = { w: XR * 2 + 0.2, d: ZEF - ZEB };
  root.userData.door = { x: DX, z: ZEF + 0.25 };
  root.userData.doorIn = { x: DX, z: ZFI - 0.6 };
  root.userData.innerDoors = [{ x: PX, z: IDZ }];
  if (opts.merge !== false) { mergeStatic(THREE, RF); mergeStatic(THREE, root); }
  return root;
}
