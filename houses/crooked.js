/* Crooked cottage — hand-modelled in code from Codex's concept paintings (assets/concepts/house_crooked.png, interiors
 * assets/interiors/crooked_living.png + crooked_attic.png).
 * export buildHouse(THREE, opts) → THREE.Group 'crooked'. Origin = ground centre, front (porch, door) faces +Z. Metres.
 * A charmingly crooked sky-blue cottage: the whole body leans (a shear on the 'crook' group, zero at floor level so the
 * floor stays flat), the ridge sags and wanders. Very steep terracotta roof of instanced tiles with a front cross gable
 * and a dormer, a leaning stone chimney, a little gabled porch on carved posts over a round-top doorway, ivy, hanging
 * lanterns, window boxes, white window frames and stone steps.
 * Enterable: hollow walls, an open arched doorway, two ground-floor rooms side by side (crooked kitchen-living room with
 * a wood stove, and the "attic" bedroom with the little bed, rocking horse and mannequin). Everything above the walls
 * lives in the 'roof' group (inside the shear). colliders / rooms / propSlots are in the un-sheared local frame at y = 0.
 * ~9.6 m wide × 7.4 m deep, ridge ≈ 6.8 m, chimney ≈ 8.3 m.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

const matCache = {}, greyCache = {};

export function buildHouse(THREE, opts = {}) {
  const garden = opts.garden !== false;               // false = in-game: no decor that could be mistaken for a hideable prop
  const V3 = THREE.Vector3, PI = Math.PI;
  // main body
  const W = 8.8, ZF = 2.2, ZB = -3.0, ZM = -0.4, H = 3.0, T = 1.4;  // walls, ridge line z, eave height, roof pitch (tan)
  const R0 = H + (ZF - ZM) * T;                                     // nominal ridge 6.64
  const XR = W / 2 + 0.25, SM = ZF - ZM + 0.45;                     // roof reach along x / down each slope
  // front cross gable (holds the door and the upper window)
  const XC = -1.7, B = 1.45, ZC = ZF + 0.5, TC = 1.75, RC = H + B * TC, SC = B + 0.35;
  // dormer on the right of the front slope
  const XD = 1.9, BD = 0.62, ZDF = ZF - 0.5, YDE = 4.75, TD = 1.2, RD = YDE + (BD + 0.02) * TD;
  // porch
  const ZPF = ZC + 1.05, PE = 2.6, TP = 0.85, BP = 1.2, RP = PE + BP * TP;
  // interior
  const WT = 0.26, FL = 0.05;                                       // wall thickness, floor level
  const XP = 0.35, ZDOOR = -0.6, IDW = 1.3;                        // partition wall x, its doorway centre z and width
  const DW = 1.3, DH = 1.6;                                         // front doorway width, straight height (+ arch)
  const IXL = -W / 2 + WT, IXR = W / 2 - WT, IZF = ZF - WT, IZB = ZB + WT;

  // wonky roof surfaces (height of the roof deck)
  const ridgeMain = (x) => R0 + 0.05 * x - 0.13 * (1 - (x / XR) ** 2);
  const yMain = (x, z) => { const s = Math.min(Math.abs(z - ZM), SM); return ridgeMain(x) - T * s - 0.07 * Math.sin((Math.PI * s) / SM) * (1 - (x / XR) ** 2); };
  const yCross = (x, z) => { const s = Math.abs(x - XC); return RC + 0.04 * Math.sin(z * 1.4) - TC * s - 0.05 * Math.sin((Math.PI * Math.min(s, SC)) / SC); };
  const yDorm = (x) => RD - TD * Math.abs(x - XD);
  const inCross = (x) => Math.abs(x - XC) < SC + 0.05;

  let seed = opts.seed || 7; const rr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jr = (a, b) => a + rr() * (b - a);
  const tex = (n, rx = 1, ry = rx) => kitTex(THREE, n, rx, ry);
  const M = (hex, map, extra = {}) => {
    const key = `${hex}|${map ? map.uuid : ''}|${JSON.stringify(extra)}`;
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color: hex, map: map || null, roughness: 0.95, metalness: 0 }, extra));
    return matCache[key];
  };
  // painted kit texture used as greyscale detail under a clean colour (sky-blue plaster, white frames, blue door)
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
  root.name = 'crooked';
  // everything architectural lives in 'crook': a shear makes the whole cottage lean right and a touch forward.
  // The shear only depends on y (x += 0.055·y, z += 0.012·y), so at floor level the frame is the plain local frame.
  const crook = new THREE.Group();
  crook.matrixAutoUpdate = false;
  crook.matrix.makeShear(0, 0, 0.055, 0.012, 0, 0);
  root.add(crook);
  // everything above the walls (roofs, gables, dormer, chimney, upper windows) — the game hides it while you're inside
  const roof = new THREE.Group();
  roof.name = 'roof'; roof.userData.keep = true; crook.add(roof);
  let PAR = crook;                                                  // default parent for add(): switched to roof while roofing
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = PAR) => {
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const rbox = (w, h, d, r, mat, seg = 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat);
  const ib = (w, h, d, r, mat) => rbox(w, h, d, r, mat, 1);
  const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
  const o = new THREE.Object3D();

  // ---------------- materials
  const plaster = G(opts.wall || 0xa9cdea, tex('plaster', 0.3), 0.707, 0.85);
  const inPlaster = G(0x9fbde0, tex('plaster', 0.42), 0.707, 0.9);           // interior: patchy powder-blue lime plaster
  const floorMat = G(0xc08a5c, tex('wood_planks_dark', 0.42), 0.107, 0.8);
  const white = G(0xfbf8f1, tex('plaster', 0.6), 0.707, 0.5);
  const doorBlue = G(0x5a86b2, tex('wood_light', 0.7), 0.53, 0.6);
  const shutterMat = G(0x4b8682, tex('wood_light', 0.7), 0.53, 0.55);
  const stoneMat = G(0xffffff, tex('stone', 0.32), 0.447, 0.55);
  const stoneCore = G(0x9d968a, tex('stone', 0.6), 0.447, 0.6);
  const stepMat = G(0xcdc9c0, tex('stone', 0.45), 0.447, 0.6);
  const timber = M(0x9a6a40, tex('wood_light', 0.5));
  const timberLight = M(0xc89a5e, tex('wood_light', 0.6));
  const deckMat = M(0x7a5236, null, { side: THREE.DoubleSide });
  const terracotta = M(0xffcfa8, tex('terracotta', 1, 3));
  const iron = M(0x3b3530, null, { roughness: 0.85 });
  const copper = M(0xc8783e, null, { roughness: 0.85 });
  const glass = M(0x5a4a30, null, { roughness: 0.85, emissive: 0xffa040, emissiveIntensity: 0.32 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd894, emissive: 0xffb44d, emissiveIntensity: 1.6, roughness: 0.85 });
  const tileMat = M(0xffffff, tex('roof_tiles', 0.5));
  const paintMat = M(0xffffff, null);                                         // instanced fabrics / books / rugs: per-instance colours

  // ---------------- wall frames: local x runs along the wall, local z points out of it (exterior) / into the room (interior)
  const frame = (x, z, ry, P = crook) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.updateMatrix(); P.add(g); return g; };
  // a wall slab: outline a..b along local x, from the floor up to topFn(x), extruded over local z0..z1, with window holes
  // and an optional doorway notch ([x, width, straight height, flat?] — arched unless flat)
  const wallSlab = (P, a, b, holes, door, mat, z0, z1, topFn) => {
    const s = new THREE.Shape(), N = 14;
    s.moveTo(a, 0);
    if (door) {
      const [dx, dw, dh, flat] = door, r = dw / 2;
      s.lineTo(dx - r, 0); s.lineTo(dx - r, dh);
      if (flat) s.lineTo(dx + r, dh); else s.absarc(dx, dh, r, PI, 0, true);
      s.lineTo(dx + r, 0);
    }
    s.lineTo(b, 0);
    for (let i = N; i >= 0; i--) { const x = a + ((b - a) * i) / N; s.lineTo(x, topFn(x)); }
    s.closePath();
    for (const [x, y, w, h] of holes) { const p = new THREE.Path(); p.moveTo(x - w / 2, y - h / 2); p.lineTo(x + w / 2, y - h / 2); p.lineTo(x + w / 2, y + h / 2); p.lineTo(x - w / 2, y + h / 2); p.closePath(); s.holes.push(p); }
    const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, z0);
    return add(new THREE.Mesh(g, mat), 0, 0, 0, 0, 0, 0, P);
  };
  // a gable infill between a lower edge (bot) and the roof line (top), in frame P (roof group)
  const gable = (P, a, b, bot, top, mat) => {
    const s = new THREE.Shape(), N = 16;
    for (let i = 0; i <= N; i++) { const x = a + ((b - a) * i) / N; i ? s.lineTo(x, bot(x)) : s.moveTo(x, bot(x)); }
    for (let i = N; i >= 0; i--) { const x = a + ((b - a) * i) / N; s.lineTo(x, Math.max(top(x), bot(x) + 0.02)); }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: WT, bevelEnabled: false }); g.translate(0, 0, -WT);
    add(new THREE.Mesh(g, mat), 0, 0, 0, 0, 0, 0, P);
  };
  // window holes, in each wall frame's local coords [x, y, w, h]
  const FWIN = [[1.5, 1.55, 0.7, 0.85], [3.3, 1.55, 0.62, 0.85]];          // Pf: x = world x (both in the attic room)
  const BWIN = [[1.0, 1.75, 0.62, 0.75], [-2.2, 1.75, 0.62, 0.75]];        // Pb: x = −world x (living over the dresser, attic over the bed)
  const LWIN = [[-0.5, 1.55, 0.62, 0.8]];                                  // Pl: x = world z
  const RWIN = [[-0.6, 1.55, 0.62, 0.8]];                                  // Pr: x = −world z
  {
    const Pf = frame(0, ZF, 0), Pb = frame(0, ZB, PI), Pl = frame(-W / 2, 0, -PI / 2), Pr = frame(W / 2, 0, PI / 2);
    const Pc = frame(XC, ZC, 0), Pcl = frame(XC - B, 0, -PI / 2), Pcr = frame(XC + B, 0, PI / 2);
    const both = (P, a, b, holes, door, top) => { wallSlab(P, a, b, holes, door, plaster, -0.12, 0, top); wallSlab(P, a, b, holes, door, inPlaster, -WT, -0.12, top); };
    const eaveF = (x) => yMain(x, ZF) - 0.04, eaveB = (lx) => yMain(-lx, ZB) - 0.04;
    both(Pf, -W / 2, XC - B, [], null, eaveF);
    both(Pf, XC + B, W / 2, FWIN, null, eaveF);
    both(Pb, -W / 2, W / 2, BWIN, null, eaveB);
    const sideL = (z) => Math.min(H, yMain(-W / 2, z) - 0.04), sideR = (lz) => Math.min(H, yMain(W / 2, -lz) - 0.04);
    both(Pl, ZB + WT, ZF - WT, LWIN, null, sideL);
    both(Pr, -(ZF - WT), -(ZB + WT), RWIN, null, sideR);
    // the cross-gable bay: front wall with the arched doorway, two short side walls
    const bayF = (lx) => Math.min(H, yCross(XC + lx, ZC) - 0.04);
    both(Pc, -B, B, [], [0, DW, DH], bayF);
    both(Pcl, ZF - WT, ZC - WT, [], null, (z) => yCross(XC - B, z) - 0.04);
    both(Pcr, -(ZC - WT), -(ZF - WT), [], null, (lz) => yCross(XC + B, -lz) - 0.04);
    // partition between the two rooms, with a rough timber-framed doorway
    const Pp = frame(XP + 0.1, 0, PI / 2);
    wallSlab(Pp, -(ZF - WT), -(ZB + WT), [], [-ZDOOR, IDW, 2.15, true], inPlaster, -0.2, 0, () => H - 0.12);
    // gables above the walls (roof group)
    const PlR = frame(-W / 2, 0, -PI / 2, roof), PrR = frame(W / 2, 0, PI / 2, roof), PcR = frame(XC, ZC, 0, roof);
    gable(PlR, ZB, ZF, sideL, (z) => yMain(-W / 2, z) - 0.02, plaster);
    gable(PrR, -ZF, -ZB, sideR, (lz) => yMain(W / 2, -lz) - 0.02, plaster);
    gable(PcR, -B, B, bayF, (lx) => yCross(XC + lx, ZC) - 0.02, plaster);
  }
  // floor: one plank slab under both rooms and the bay (UVs in metres)
  {
    const s = new THREE.Shape([[-W / 2, ZF], [XC - B, ZF], [XC - B, ZC], [XC + B, ZC], [XC + B, ZF], [W / 2, ZF], [W / 2, ZB], [-W / 2, ZB]].map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: FL, bevelEnabled: false }); g.rotateX(-PI / 2);
    add(new THREE.Mesh(g, floorMat));
  }

  // ---------------- stones: rounded fieldstone geometry, instanced for the foundation and the chimney
  const stoneGeo = new THREE.SphereGeometry(1, 9, 6);
  {
    const p = stoneGeo.attributes.position, v = new V3();
    const b = (c) => Math.sign(c) * Math.pow(Math.abs(c), 0.72);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + 0.07 * Math.sin(v.x * 3.1 + v.y * 2.3) + 0.05 * Math.sin(v.z * 4.1 - v.x * 1.9 + 1.3);
      p.setXYZ(i, b(v.x) * n, b(v.y) * n, b(v.z) * n);
    }
    stoneGeo.computeVertexNormals();
  }
  const STONE_PAL = [0xc9c4ba, 0xb5b1a9, 0xd6cfc0, 0xa9a59c, 0xc4bcaa, 0xdcd8cf, 0xb8ae9a].map((h) => new THREE.Color(h));
  const stones = [];
  const pushStone = (x, y, z, sx, sy, sz, ry, pre = null) => {
    o.position.set(x, y, z); o.rotation.set(jr(-0.06, 0.06), ry + jr(-0.05, 0.05), jr(-0.06, 0.06)); o.scale.set(sx, sy, sz); o.updateMatrix();
    const m = o.matrix.clone(); if (pre) m.premultiply(pre);
    stones.push([m, STONE_PAL[Math.floor(rr() * STONE_PAL.length)].clone().offsetHSL(0, 0, jr(-0.05, 0.04))]);
  };
  function wallStones(ax, az, bx, bz, top, holes = [], y0 = 0, k = 1, out = 0.06, pre = null) {
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    const ry = -Math.atan2(dz, dx), nx = Math.sin(ry), nz = Math.cos(ry);
    for (let y = y0, guard = 0; y < top - 0.1 * k && guard < 40; guard++) {
      const rh = Math.min(jr(0.24, 0.34) * k, top - y + 0.02);
      let t = -jr(0.05, 0.25) * k;
      while (t < len) {
        const w = jr(0.38, 0.7) * k; t += w;
        let segs = [[t - w, Math.min(t, len + 0.1)]];
        for (const [t0, t1] of holes) segs = segs.flatMap(([s0, s1]) => (s1 <= t0 || s0 >= t1 ? [[s0, s1]] : [[s0, Math.min(s1, t0)], [Math.max(s0, t1), s1]].filter(([q0, q1]) => q1 - q0 > 0.18 * k)));
        for (const [s0, s1] of segs) { const sc = (s0 + s1) / 2; pushStone(ax + dx * sc + nx * out, y + rh / 2, az + dz * sc + nz * out, (s1 - s0) * 0.54, rh * 0.6, jr(0.12, 0.17) * k, ry, pre); }
      }
      y += rh;
    }
  }
  {
    // foundation band, two low courses all the way round (the doorway gap is left open)
    const fb = 0.55, k = 0.8;
    const doorT = XC - (XC - B);
    wallStones(-W / 2, ZF, XC - B, ZF, fb, [], 0, k);
    wallStones(XC - B, ZF, XC - B, ZC, fb, [], 0, k);
    wallStones(XC - B, ZC, XC + B, ZC, fb, [[doorT - DW / 2 - 0.05, doorT + DW / 2 + 0.05]], 0, k);
    wallStones(XC + B, ZC, XC + B, ZF, fb, [], 0, k);
    wallStones(XC + B, ZF, W / 2, ZF, fb, [], 0, k);
    wallStones(W / 2, ZF, W / 2, ZB, fb, [], 0, k);
    wallStones(W / 2, ZB, -W / 2, ZB, fb, [], 0, k);
    wallStones(-W / 2, ZB, -W / 2, ZF, fb, [], 0, k);
  }

  // ---------------- roof: wonky decks + individual instanced pantiles, ridge caps, bargeboards (all in the roof group)
  const tiles = [], tilesP = [];
  let tileDest = tiles;
  const TILE_PAL = [0xf6ece4, 0xf0dccb, 0xffe4cc, 0xe8c8b0, 0xf6d6b8, 0xdcb89c, 0xfff4ea, 0xe6c0a4, 0xd8c4b4].map((h) => new THREE.Color(h));
  const _a = new V3(), _d = new V3(), _n = new V3(), _u = new V3(), _x = new V3(), _m = new THREE.Matrix4(), _j = new THREE.Matrix4(), _e = new THREE.Euler();
  // P(t, s) → point on a roof: t runs along the ridge, s down the slope (horizontal metres); skip(p) drops hidden tiles
  function tileField(P, t0, t1, smax, skip, sc = 1) {
    const cols = Math.max(1, Math.round((t1 - t0) / (0.3 * sc))), dt = (t1 - t0) / cols, e = 0.02;
    for (let c = 0; c < cols; c++) {
      let s = 0.08 * sc;
      for (let guard = 0; s <= smax && guard < 60; guard++) {
        const t = t0 + dt * (c + 0.5) + jr(-0.012, 0.012);
        const p = P(t, s);
        const k = p.distanceTo(P(t, s + 0.05)) / 0.05;
        if (!skip || !skip(p)) {
          _a.subVectors(P(t + e, s), P(t - e, s)); _d.subVectors(P(t, s + e), P(t, Math.max(0, s - e)));
          _n.crossVectors(_a, _d).normalize(); if (_n.y < 0) _n.negate();
          _u.copy(_d).negate().normalize(); _x.crossVectors(_n, _u).normalize(); _u.crossVectors(_x, _n);
          _m.makeBasis(_x, _n, _u);
          _j.makeRotationFromEuler(_e.set(0.09 + jr(-0.03, 0.03), jr(-0.05, 0.05), jr(-0.04, 0.04)));
          _m.multiply(_j).scale(new V3(sc, sc * jr(0.95, 1.05), sc * jr(0.95, 1.05)));
          _m.setPosition(p.x + _n.x * 0.07 * sc, p.y + _n.y * 0.07 * sc, p.z + _n.z * 0.07 * sc);
          tileDest.push([_m.clone(), TILE_PAL[Math.floor(rr() * TILE_PAL.length)].clone().offsetHSL(0, jr(-0.05, 0.05), jr(-0.05, 0.04))]);
        }
        s += (0.29 * sc) / k;
      }
    }
  }
  function deck(P, t0, t1, smax, nt, ns) {
    const g = new THREE.PlaneGeometry(1, 1, nt, ns), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const q = P(t0 + (t1 - t0) * uv.getX(i), smax * (1 - uv.getY(i))); p.setXYZ(i, q.x, q.y - 0.03, q.z); }
    g.computeVertexNormals();
    add(new THREE.Mesh(g, deckMat));
  }
  const tube = (pts, r, mat, seg = 24, rad = 8) => add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, rad, false), mat));
  const CX = 2.7, CZ = -1.95;                                  // chimney through the back slope
  const nearChimney = (p) => Math.abs(p.x - CX) < 0.5 && Math.abs(p.z - CZ) < 0.5;
  PAR = roof;
  {
    const front = (x, s) => new V3(x, yMain(x, ZM + s), ZM + s);
    const back = (x, s) => new V3(x, yMain(x, ZM - s), ZM - s);
    const underDorm = (p) => Math.abs(p.x - XD) < BD + 0.06 && p.z < ZDF + 0.12 && yDorm(p.x) + 0.05 > p.y;
    deck(front, -XR, XR, SM, 18, 10); deck(back, -XR, XR, SM, 18, 10);
    tileField(front, -XR, XR, SM, (p) => (inCross(p.x) && yCross(p.x, p.z) > p.y - 0.03) || underDorm(p));
    tileField(back, -XR, XR, SM, nearChimney);
    tube(Array.from({ length: 9 }, (_, i) => { const x = -XR - 0.05 + (i / 8) * (XR * 2 + 0.1); return new V3(x, ridgeMain(x) + 0.12, ZM); }), 0.17, terracotta, 24, 10);
    for (const sx of [-1, 1]) {                                     // bargeboards over both main gables
      const x = sx * (XR + 0.02), pts = [];
      for (let i = 0; i <= 10; i++) { const z = ZM - SM + (i / 10) * SM * 2; pts.push(new V3(x, yMain(x, z) + 0.02, z)); }
      tube(pts, 0.1, timber, 20, 6);
    }
    for (const side of [-1, 1]) {                                   // eave fascia, front one split around the cross gable
      const z = ZM + side * (SM - 0.02), segs = side > 0 ? [[XC + SC, XR]] : [[-XR, XR]];
      for (const [a, b] of segs) tube(Array.from({ length: 6 }, (_, i) => { const x = a + (i / 5) * (b - a); return new V3(x, yMain(x, z) - 0.05, z); }), 0.09, timber, 10, 6);
    }
    // cross gable roof
    const zj = 0.1, zEnd = ZC + 0.42;
    const cl = (z, s) => new V3(XC - s, yCross(XC - s, z), z), cr = (z, s) => new V3(XC + s, yCross(XC + s, z), z);
    deck(cl, zj, zEnd, SC, 8, 8); deck(cr, zj, zEnd, SC, 8, 8);
    const underMain = (p) => p.z < ZM + SM && yMain(p.x, p.z) > p.y + 0.02;
    tileField(cl, zj, zEnd, SC, underMain); tileField(cr, zj, zEnd, SC, underMain);
    const zr = ZM + (ridgeMain(XC) - RC) / T;
    tube([0, 0.33, 0.66, 1].map((t) => { const z = zr + (zEnd + 0.04 - zr) * t; return new V3(XC, yCross(XC, z) + 0.12, z); }), 0.15, terracotta, 10, 10);
    tube(Array.from({ length: 9 }, (_, i) => { const s = -SC + (i / 8) * SC * 2; return new V3(XC + s, yCross(XC + s, zEnd) + 0.03, zEnd + 0.03); }), 0.1, timber, 20, 6);
    // dormer: little blue box with its own tiny tiled gable
    {
      const zb = -0.15;
      const subShape = (pts, n = 2) => {
        const s = new THREE.Shape();
        pts.forEach(([x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; for (let k = 0; k < n; k++) { const t = k / n, px = x + (x2 - x) * t, py = y + (y2 - y) * t; i || k ? s.lineTo(px, py) : s.moveTo(px, py); } });
        s.closePath(); return s;
      };
      const g = new THREE.ExtrudeGeometry(subShape([[XD - BD, 3.4], [XD + BD, 3.4], [XD + BD, YDE], [XD, RD - 0.05], [XD - BD, YDE]]), { depth: ZDF - zb, steps: 2, bevelEnabled: false });
      g.translate(0, 0, zb);
      add(new THREE.Mesh(g, plaster));
      const dEnd = ZDF + 0.3, dl = (z, s) => new V3(XD - s, yDorm(XD - s) + 0.02 * Math.sin(z * 3), z), dr = (z, s) => new V3(XD + s, yDorm(XD + s) + 0.02 * Math.sin(z * 3), z);
      deck(dl, 0, dEnd, BD + 0.28, 4, 4); deck(dr, 0, dEnd, BD + 0.28, 4, 4);
      tileField(dl, 0, dEnd, BD + 0.28, underMain, 0.72); tileField(dr, 0, dEnd, BD + 0.28, underMain, 0.72);
      const zdr = ZM + (ridgeMain(XD) - RD) / T;
      tube([new V3(XD, RD + 0.08, zdr), new V3(XD, RD + 0.08, dEnd + 0.03)], 0.11, terracotta, 4, 8);
      tube(Array.from({ length: 5 }, (_, i) => { const s = -BD - 0.28 + (i / 4) * (BD + 0.28) * 2; return new V3(XD + s, yDorm(XD + s) + 0.02, dEnd + 0.03); }), 0.07, timber, 10, 6);
    }
  }

  // ---------------- leaning stone chimney: core, stones, cap, pot
  {
    const pre = new THREE.Matrix4().makeRotationZ(-0.07).premultiply(new THREE.Matrix4().makeTranslation(CX, 0, CZ));
    const ch = new THREE.Group(); ch.position.set(CX, 0, CZ); ch.rotation.z = -0.07; roof.add(ch);
    add(rbox(0.78, 3.7, 0.78, 0.07, stoneCore), 0, 6.3, 0, 0, 0, 0, ch);
    const h = 0.39, top = 8.0;
    wallStones(-h, h, h, h, top, [], 5.0, 0.6, 0.04, pre);
    wallStones(h, h, h, -h, top, [], 5.0, 0.6, 0.04, pre);
    wallStones(h, -h, -h, -h, top, [], 5.0, 0.6, 0.04, pre);
    wallStones(-h, -h, -h, h, top, [], 5.0, 0.6, 0.04, pre);
    add(rbox(1.04, 0.16, 1.04, 0.05, stepMat), 0, top + 0.12, 0, 0, 0, 0, ch);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 12), M(0xffcfa8, tex('terracotta', 1))), 0.1, top + 0.38, 0, 0, 0, 0.05, ch);
  }
  PAR = crook;

  // ---------------- round-top doorway in a stone arch (door leaf swung open inside), low stone step
  {
    const z = ZC, r = DW / 2;
    const n = 12;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; add(rbox(0.24, 0.22, 0.22, 0.06, stepMat), XC + Math.cos(a) * (r + 0.16), DH + Math.sin(a) * (r + 0.16), z + 0.05, 0, 0, a - Math.PI / 2); }
    for (const sx of [-1, 1]) for (let j = 0; j < 5; j++) { const wide = j % 2 === 0; add(rbox(wide ? 0.3 : 0.22, 0.3, 0.22, 0.06, stepMat), XC + sx * (r + (wide ? 0.19 : 0.15)), 0.17 + j * 0.33, z + 0.05); }
    add(rbox(DW + 0.6, 0.1, 0.75, 0.04, stepMat), XC, 0.05, z + 0.4, 0, 0.02, 0);
    add(rbox(DW + 0.04, 0.08, WT + 0.06, 0.03, stepMat), XC, 0.03, z - WT / 2);
    // timber architrave inside the bay
    for (const sx of [-1, 1]) add(ib(0.12, DH, 0.08, 0.03, timber), XC + sx * (r + 0.06), FL + DH / 2, z - WT - 0.03);
    add(new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.05, 5, 14, PI), timber), XC, DH, z - WT - 0.03);
    // the blue round-top door, standing open into the room (hinged on the left jamb)
    const lw = DW - 0.06, lr = lw / 2, s = new THREE.Shape();
    s.moveTo(-lr, 0); s.lineTo(lr, 0); s.lineTo(lr, DH); s.absarc(0, DH, lr, 0, Math.PI, false); s.lineTo(-lr, 0);
    const dg = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 10 });
    const leaf = new THREE.Group(); leaf.position.set(XC - r + 0.02, FL, z - WT - 0.02); leaf.rotation.y = -PI / 2 - 0.12; crook.add(leaf);
    add(new THREE.Mesh(dg, doorBlue), -lr - 0.02, 0, -0.04, 0, 0, 0, leaf);
    for (let k = -2; k <= 2; k++) add(rbox(0.022, DH + lr * (k ? 0.8 : 0.98), 0.02, 0.008, M(0x3c5c7c, null), 1), -lr - 0.02 + k * 0.2, (DH + lr * 0.85) / 2, 0.07, 0, 0, 0, leaf);
    add(rbox(0.3, 0.3, 0.04, 0.02, glass, 1), -lr - 0.02, 1.65, 0.07, 0, 0, 0, leaf);
    add(rbox(0.32, 0.03, 0.05, 0.01, white, 1), -lr - 0.02, 1.65, 0.09, 0, 0, 0, leaf);
    add(rbox(0.03, 0.32, 0.05, 0.01, white, 1), -lr - 0.02, 1.65, 0.09, 0, 0, 0, leaf);
    for (const y of [0.4, 1.3]) add(rbox(0.42, 0.05, 0.03, 0.01, iron, 1), -0.25, y, 0.08, 0, 0, 0, leaf);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 16), iron), -lw + 0.2, 0.98, 0.1, 0, 0, 0, leaf);
  }

  // ---------------- gabled porch on carved posts with hanging lanterns
  {
    const zp = ZPF - 0.2;
    const post = new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.13, 0.14], [0.09, 0.2], [0.085, 0.55], [0.115, 0.64], [0.085, 0.74], [0.075, PE - 0.75], [0.105, PE - 0.62], [0.075, PE - 0.5], [0.085, PE - 0.22], [0.12, PE - 0.12], [0.12, PE - 0.1], [0, PE - 0.1]].map(([a, b]) => new THREE.Vector2(a, b)), 8);
    for (const sx of [-1, 1]) {
      add(new THREE.Mesh(post, timber), XC + sx * (BP - 0.22), 0, zp, jr(-0.03, 0.03), 0, sx * 0.025);
      add(rbox(0.16, 0.18, ZPF - ZC + 0.1, 0.04, timber), XC + sx * (BP - 0.2), PE - 0.08, (ZC + ZPF) / 2);   // side plates
      add(rbox(0.1, 0.62, 0.1, 0.03, timber, 1), XC + sx * (BP - 0.42), PE - 0.38, zp, 0, 0, sx * 0.75);     // carved brackets
      add(rbox(0.1, 0.55, 0.1, 0.03, timber, 1), XC + sx * (BP - 0.22), PE - 0.38, zp - 0.25, -0.8, 0, 0);
      add(rbox(0.32, 0.32, 0.14, 0.04, stepMat), XC + sx * (BP - 0.22), 0.07, zp);                          // stone pad
    }
    add(rbox(BP * 2 - 0.1, 0.18, 0.16, 0.04, timber), XC, PE - 0.08, zp);                                   // tie beam
    add(rbox(0.12, RP - PE - 0.1, 0.1, 0.03, timber, 1), XC, (RP + PE) / 2 - 0.08, ZPF - 0.05);               // king post
    const pl = (z, s) => new V3(XC - s, RP - TP * s + 0.02 * Math.sin(z * 2.2), z), pr = (z, s) => new V3(XC + s, RP - TP * s + 0.02 * Math.sin(z * 2.2), z);
    deck(pl, ZC - 0.05, ZPF + 0.2, BP + 0.15, 4, 4); deck(pr, ZC - 0.05, ZPF + 0.2, BP + 0.15, 4, 4);
    tileDest = tilesP;
    tileField(pl, ZC - 0.05, ZPF + 0.2, BP + 0.15, null, 0.8); tileField(pr, ZC - 0.05, ZPF + 0.2, BP + 0.15, null, 0.8);
    tileDest = tiles;
    tube([new V3(XC, RP + 0.1, ZC - 0.05), new V3(XC, RP + 0.1, ZPF + 0.23)], 0.12, terracotta, 4, 8);
    for (const sx of [-1, 1]) {                                                                                // carved bargeboards
      tube([0, 0.5, 1].map((t) => new V3(XC + sx * t * (BP + 0.15), RP - TP * t * (BP + 0.15) + 0.03 - 0.05 * Math.sin(t * Math.PI), ZPF + 0.22)), 0.08, timber, 8, 6);
      // hanging lantern on an iron bracket off each post
      const lx = XC + sx * (BP + 0.05), ly = PE - 0.62;
      add(rbox(0.42, 0.04, 0.04, 0.01, iron, 1), XC + sx * (BP - 0.05), PE - 0.25, zp);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 4), iron), lx, PE - 0.36, zp);
      add(rbox(0.2, 0.26, 0.2, 0.03, glow, 1), lx, ly, zp);
      add(rbox(0.26, 0.04, 0.26, 0.015, iron, 1), lx, ly - 0.15, zp);
      add(rbox(0.26, 0.04, 0.26, 0.015, iron, 1), lx, ly + 0.15, zp);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.15, 4), iron), lx, ly + 0.24, zp, 0, Math.PI / 4, 0);
      for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(rbox(0.025, 0.28, 0.025, 0.008, iron, 1), lx + ax * 0.105, ly, zp + az * 0.105);
    }
    if (opts.light !== false) { const l = new THREE.PointLight(0xffb45a, 1.3, 5, 2); l.position.set(XC, PE - 0.7, zp + 0.3); root.add(l); }
  }

  // ---------------- windows: warm glass, white frames, slatted teal shutters, flower boxes
  const leaves = [], blossoms = [];
  const BOX_FLOWERS = [0xf28ab2, 0xfbf6ee, 0xe8607a, 0xf6b3cf, 0xffd23f];
  function windowUnit(P, x, y, w, h, nSh, box) {
    const a = (m, px, py, pz) => add(m, px, py, pz, 0, 0, 0, P);
    const fr = 0.09;
    a(rbox(w, h, 0.05, 0.02, glass, 1), x, y, 0.0);
    a(rbox(w + fr * 2, fr, 0.12, 0.03, white, 1), x, y + h / 2 + fr / 2, 0.04);
    a(rbox(w + fr * 2.8, fr * 1.3, 0.2, 0.03, white, 1), x, y - h / 2 - fr * 0.5, 0.08);
    for (const s of [-1, 1]) a(rbox(fr, h, 0.12, 0.03, white, 1), x + s * (w / 2 + fr / 2), y, 0.04);
    a(rbox(0.045, h, 0.07, 0.015, white, 1), x, y, 0.04);
    a(rbox(w, 0.045, 0.07, 0.015, white, 1), x, y + h * 0.1, 0.04);
    if (nSh) for (const s of [-1, 1]) {
      const sw = w * 0.55, sh = new THREE.Group();
      for (let k = 0; k < 3; k++) add(rbox(sw / 3 - 0.012, h + 0.08, 0.05, 0.012, shutterMat, 1), (k - 1) * (sw / 3), 0, 0, 0, 0, 0, sh);
      for (const yy of [-0.3, 0.3]) add(rbox(sw * 0.9, 0.06, 0.03, 0.01, shutterMat, 1), 0, h * yy, 0.035, 0, 0, 0, sh);
      sh.position.set(x + s * (w / 2 + fr + sw / 2 + 0.02), y, 0.08); sh.rotation.y = -s * 0.2;
      P.add(sh);
    }
    if (box) {
      const by = y - h / 2 - 0.22;
      a(rbox(w + 0.3, 0.24, 0.28, 0.04, M(0xc89a5e, tex('wood_light', 0.6))), x, by, 0.2);
      P.updateMatrixWorld(true);
      const wp = new V3();
      for (let k = 0; k < 22; k++) { wp.set(x + jr(-(w + 0.2) / 2, (w + 0.2) / 2), by + 0.14 + jr(0, 0.15), 0.22 + jr(-0.1, 0.12)); P.localToWorld(wp); crook.worldToLocal(wp); leaves.push([wp.x, wp.y, wp.z, 1]); }
      for (let k = 0; k < 18; k++) { wp.set(x + jr(-(w + 0.15) / 2, (w + 0.15) / 2), by + 0.2 + jr(0, 0.18), 0.24 + jr(-0.08, 0.12)); P.localToWorld(wp); crook.worldToLocal(wp); blossoms.push([wp.x, wp.y, wp.z, BOX_FLOWERS[k % 5], 1.15]); }
    }
  }
  const wall = (x, z, ry, P = crook) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; P.add(g); return g; };
  root.updateMatrixWorld(true);
  for (const [x, y, w, h] of FWIN) windowUnit(wall(0, ZF + 0.02, 0), x, y, w, h, x > 2 ? 2 : 0, true);
  windowUnit(wall(0, ZB - 0.02, PI), BWIN[0][0], BWIN[0][1], BWIN[0][2], BWIN[0][3], 2, true);   // over the dresser
  windowUnit(wall(0, ZB - 0.02, PI), BWIN[1][0], BWIN[1][1], BWIN[1][2], BWIN[1][3], 0, true);   // over the bed
  windowUnit(wall(-W / 2 - 0.02, 0, -PI / 2), LWIN[0][0], LWIN[0][1], LWIN[0][2], LWIN[0][3], 2, false);
  windowUnit(wall(W / 2 + 0.02, 0, PI / 2), RWIN[0][0], RWIN[0][1], RWIN[0][2], RWIN[0][3], 2, true);
  // upper windows (roof group)
  windowUnit(wall(XC, ZC + 0.02, 0, roof), 0, 4.05, 0.55, 0.62, 0, true);            // upper window in the cross gable
  windowUnit(wall(XD, ZDF + 0.02, 0, roof), 0, 4.2, 0.5, 0.55, 0, true);             // dormer
  windowUnit(wall(-W / 2 - 0.02, -0.4, -PI / 2, roof), 0, 4.1, 0.5, 0.6, 0, false);
  windowUnit(wall(W / 2 + 0.02, -0.4, PI / 2, roof), 0, 4.25, 0.5, 0.6, 0, false);

  // ---------------- ivy, hollyhocks
  {
    const vine = (x, z, top, nx, nz, drift = 0.03, flowers = 0.25) => {
      let y = 0.25;
      while (y < top) {
        x += jr(-0.06, 0.06) + drift * Math.abs(nz); z += jr(-0.06, 0.06) * Math.abs(nx); y += jr(0.07, 0.12);
        for (let k = 0; k < 3; k++) leaves.push([x + jr(-0.13, 0.13) * Math.abs(nz), y + jr(-0.06, 0.06), z + jr(-0.13, 0.13) * Math.abs(nx), 1, nx, nz]);
        if (rr() < flowers) blossoms.push([x + nx * 0.06, y, z + nz * 0.06, 0xfbf6ea, 1.25]);
      }
      return x;
    };
    // up the cross gable's right corner and spreading along the main eave
    let ex = vine(XC + B + 0.06, ZC + 0.03, H - 0.1, 0, 1, 0.0);
    for (let x = ex; x < ex + 1.8; x += 0.08) { const y = H - 0.25 - jr(0, 0.35) * Math.abs(Math.sin(x * 3)); leaves.push([x, y, ZF + 0.06, 1, 0, 1]); if (rr() < 0.2) blossoms.push([x, y, ZF + 0.1, 0xfbf6ea, 1.25]); }
    vine(XC + B + 0.06, ZF + 0.3, H + 0.2, 1, 0, -0.0);
    // up the left corner of the cross gable and up its bargeboard
    vine(XC - B - 0.04, ZC + 0.03, H + 0.3, 0, 1, 0.0);
    for (let s = SC; s > 0.5; s -= 0.07) { const x = XC - s, y = yCross(x, ZC + 0.4) - 0.1; for (let k = 0; k < 2; k++) leaves.push([x + jr(-0.08, 0.08), y + jr(-0.12, 0.05), ZC + 0.47 + jr(0, 0.06), 1, 0, 1]); if (rr() < 0.25) blossoms.push([x, y - 0.05, ZC + 0.52, 0xfbf6ea, 1.25]); }
    // around the right porch post
    vine(XC + BP - 0.22, ZPF - 0.08, PE - 0.1, 0, 1, 0.0, 0.3);
    // along the right side wall corner
    vine(W / 2 + 0.05, ZF - 0.2, H - 0.2, 1, 0, 0, 0.15);
    // hollyhocks: in front of the left wall and at the right corner
    const stemMat = M(0x6f9a42, null);
    for (const [x, z, hh] of [[-3.7, 2.55, 2.2], [-4.05, 2.4, 1.8], [-3.35, 2.75, 1.6], [3.75, 2.55, 1.7], [4.1, 2.4, 2.0]]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, hh, 5), stemMat), x, hh / 2, z);
      for (let q = 0; q < 12; q++) blossoms.push([x + jr(-0.06, 0.06), 0.6 + (q / 12) * (hh - 0.6), z + jr(-0.06, 0.06), [0xf08fb8, 0xe36ea0, 0xf6b3cf][q % 3], 1.55]);
      for (let q = 0; q < 9; q++) leaves.push([x + jr(-0.22, 0.22), jr(0.08, 0.7), z + jr(-0.22, 0.22), 1.7]);
    }
  }

  // ================= INTERIOR =================
  const books = [], cushs = [], discs = [];                                    // instanced paint pools: [matrix, colour]
  const putI = (arr, P, x, y, z, rx, ry, rz, sx, sy, sz, col) => {
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
    arr.push([P && P !== crook ? o.matrix.clone().premultiply(P.matrix) : o.matrix.clone(), new THREE.Color(col).offsetHSL(0, jr(-0.03, 0.03), jr(-0.03, 0.03))]);
  };
  const cush = (P, x, y, z, sx, sy, sz, col, rx = 0, ry = 0, rz = 0) => putI(cushs, P, x, y, z, rx, ry, rz, sx, sy, sz, col);
  const leafAt = (P, x, y, z, s = 1) => { const v = new V3(x, y, z); if (P !== crook) v.applyMatrix4(P.matrix); leaves.push([v.x, v.y, v.z, s]); };
  const bloomAt = (P, x, y, z, c, s = 1) => { const v = new V3(x, y, z); if (P !== crook) v.applyMatrix4(P.matrix); blossoms.push([v.x, v.y, v.z, c, s]); };
  const BOOKS = [0x8c3b2e, 0x2f5d50, 0x355a7a, 0xb9823a, 0x6b4a7a, 0x9a5a3a, 0x4e6b3a, 0xc9a66b, 0x7a2e2e];
  const bookRow = (P, x0, x1, y, z, dep) => { for (let x = x0; x < x1 - 0.05;) { const w = jr(0.035, 0.065), h = jr(0.18, 0.28); putI(books, P, x + w / 2, y + h / 2, z, 0, 0, rr() < 0.1 ? jr(-0.2, 0.2) : 0, w, h, dep * jr(0.8, 1), BOOKS[Math.floor(rr() * BOOKS.length)]); x += w + 0.005; } };
  const colliders = [], propSlots = [];
  const col = (x, z, w, d, rot = 0) => colliders.push(rot ? { x, z, w, d, rot } : { x, z, w, d });
  const slot = (id, x, z, rot = 0) => propSlots.push({ id, x, z, rot });
  // interior frames (local z into the room): Ib x = world x · Il x = −world z · Ip (partition, living side) x = world z
  // Ia (partition, attic side) x = −world z · Ir x = world z · If x = −world x
  const Ib = frame(0, IZB, 0), Il = frame(IXL, 0, PI / 2), Ip = frame(XP - 0.1, 0, -PI / 2), Ia = frame(XP + 0.1, 0, PI / 2), Ir = frame(IXR, 0, -PI / 2), If = frame(0, IZF, PI);
  const jarGeo = lathe([[0, 0], [0.08, 0], [0.1, 0.04], [0.1, 0.2], [0.07, 0.24], [0.075, 0.26], [0, 0.26]], 10);
  const vaseGeo = lathe([[0, 0], [0.06, 0], [0.1, 0.08], [0.09, 0.16], [0.05, 0.22], [0.07, 0.26], [0, 0.26]], 10);
  const vaseOf = (P, x, y, z, cols, n = 9, s = 1) => {
    add(new THREE.Mesh(vaseGeo, white), x, y, z, 0, 0, 0, P);
    for (let k = 0; k < n; k++) leafAt(P, x + jr(-0.13, 0.13) * s, y + 0.26 + jr(0, 0.12) * s, z + jr(-0.13, 0.13) * s, 0.75);
    for (let k = 0; k < n; k++) bloomAt(P, x + jr(-0.12, 0.12) * s, y + 0.3 + jr(0, 0.14) * s, z + jr(-0.12, 0.12) * s, cols[k % cols.length], 1.1);
  };
  const lantern = (P, x, y) => {                                  // wall lantern on an iron bracket, glowing
    add(ib(0.05, 0.05, 0.36, 0.01, iron), x, y + 0.42, 0.18, 0, 0, 0, P);
    add(ib(0.04, 0.3, 0.04, 0.01, iron), x, y + 0.3, 0.03, 0, 0, 0, P);
    add(ib(0.16, 0.22, 0.16, 0.03, glow), x, y + 0.12, 0.33, 0, 0, 0, P);
    add(ib(0.21, 0.035, 0.21, 0.01, iron), x, y, 0.33, 0, 0, 0, P);
    add(ib(0.21, 0.035, 0.21, 0.01, iron), x, y + 0.24, 0.33, 0, 0, 0, P);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 4), iron), x, y + 0.32, 0.33, 0, PI / 4, 0, P);
  };
  const trim = (P, x, y, w, h) => {                               // inner window trim: sill board + rough lintel
    add(ib(w + 0.3, 0.06, 0.2, 0.02, timberLight), x, y - h / 2 - 0.03, 0.08, 0, 0, 0, P);
    add(ib(w + 0.36, 0.12, 0.1, 0.02, timber), x, y + h / 2 + 0.06, 0.04, 0, jr(-0.04, 0.04), jr(-0.05, 0.05), P);
  };
  const ivyRun = (P, x0, x1, y, n) => { for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * (k / n); leafAt(P, x + jr(-0.1, 0.1), y - jr(0, 0.5) * Math.abs(Math.sin(x * 2.3)), 0.1 + jr(0, 0.06), 0.9); if (rr() < 0.18) bloomAt(P, x, y - jr(0, 0.3), 0.15, 0xfbf6ea, 1.2); } };

  // ---- rough timber frame inside both rooms: corner posts, wall posts with crooked braces, wall plates
  {
    const plateY = 2.62;
    for (const [x, z] of [[IXL + 0.09, IZF - 0.09], [IXL + 0.09, IZB + 0.09], [XP - 0.19, IZB + 0.09], [XP - 0.19, IZF - 0.09], [XP + 0.19, IZB + 0.09], [XP + 0.19, IZF - 0.09], [IXR - 0.09, IZB + 0.09], [IXR - 0.09, IZF - 0.09]]) add(ib(0.18, plateY - FL, 0.18, 0.03, timber), x, FL + (plateY - FL) / 2, z, 0, jr(-0.05, 0.05), jr(-0.02, 0.02));
    add(ib(XP - 0.1 - IXL, 0.16, 0.16, 0.04, timber), (IXL + XP - 0.1) / 2, plateY, IZB + 0.08, 0, 0, 0.012);
    add(ib(IXR - XP - 0.1, 0.16, 0.16, 0.04, timber), (IXR + XP + 0.1) / 2, plateY, IZB + 0.08, 0, 0, -0.01);
    add(ib(0.16, 0.16, IZF - IZB, 0.04, timber), IXL + 0.08, plateY, (IZF + IZB) / 2);
    add(ib(0.16, 0.16, IZF - IZB, 0.04, timber), IXR - 0.08, plateY, (IZF + IZB) / 2);
    add(ib(XC - B - IXL, 0.16, 0.16, 0.04, timber), (IXL + XC - B) / 2, plateY, IZF - 0.08);
    add(ib(IXR - XC - B, 0.16, 0.16, 0.04, timber), (IXR + XC + B) / 2, plateY, IZF - 0.08);
    // mid-wall posts with curved (angled) braces up into the plate — the crooked cruck look
    for (const [P, x] of [[Ib, -1.95], [Ib, 1.0], [Il, -1.2], [Ir, -1.7], [If, -2.4]]) {
      add(ib(0.17, plateY - FL, 0.14, 0.03, timber), x, FL + (plateY - FL) / 2, 0.08, 0, 0, jr(-0.03, 0.03), P);
      for (const s of [-1, 1]) add(ib(0.11, 0.7, 0.1, 0.03, timber), x + s * 0.28, plateY - 0.3, 0.08, 0, 0, -s * 0.75, P);
    }
    ivyRun(Ib, -4.0, -2.9, plateY, 18); ivyRun(Ib, -0.4, 0.2, plateY, 10); ivyRun(Ir, 0.6, 1.8, plateY, 18); ivyRun(Il, -1.9, -0.6, plateY, 16);
    // partition doorway: rough slanted timber frame on both faces
    for (const P of [Ip, Ia]) {
      const zx = P === Ip ? ZDOOR : -ZDOOR;
      for (const s of [-1, 1]) add(ib(0.16, 2.2, 0.08, 0.03, timber), zx + s * (IDW / 2 + 0.06), FL + 1.1, 0.03, 0, 0, s * 0.025, P);
      add(ib(IDW + 0.4, 0.18, 0.1, 0.03, timber), zx, FL + 2.22, 0.04, 0, 0, 0.04, P);
    }
    add(ib(0.2, 0.06, IDW, 0.02, timberLight), XP, FL + 0.01, ZDOOR);
  }

  // ---- LIVING: wood stove on a stone hearth in the back-left corner, flue pipe into the back wall, kettle
  {
    const sx = -3.5, sz = -2.25;
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.07, 18, 1, false, 0, PI / 2), stepMat), IXL, FL + 0.03, IZB);
    for (let k = 0; k < 9; k++) { const an = (k + 0.5) / 9 * PI / 2; add(ib(0.3, 0.09, 0.2, 0.03, stepMat), IXL + Math.sin(an) * 1.12, FL + 0.04, IZB + Math.cos(an) * 1.12, 0, an, 0); }
    add(ib(1.0, 1.4, 0.06, 0.02, stoneCore), sx, FL + 0.7, IZB + 0.03);                       // stone patch behind the stove
    add(rbox(0.66, 0.56, 0.52, 0.06, iron), sx, FL + 0.5, sz);
    add(ib(0.74, 0.05, 0.6, 0.02, iron), sx, FL + 0.8, sz);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.2, 6), iron), sx + ax * 0.26, FL + 0.11, sz + az * 0.2);
    const fd = new THREE.Shape(); fd.moveTo(-0.17, 0); fd.lineTo(0.17, 0); fd.lineTo(0.17, 0.16); fd.absarc(0, 0.16, 0.17, 0, PI, false); fd.closePath();
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(fd, { depth: 0.02, bevelEnabled: false, curveSegments: 8 }), glow), sx, FL + 0.32, sz + 0.26);
    for (const dx of [-0.08, 0, 0.08]) add(ib(0.02, 0.3, 0.02, 0.005, iron), sx + dx, FL + 0.47, sz + 0.285);
    add(ib(0.5, 0.04, 0.06, 0.01, iron), sx, FL + 0.28, sz + 0.29);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.45, 10), iron), sx + 0.12, FL + 1.55, sz - 0.08);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.08, 8, 10, PI / 2), iron), sx + 0.12, FL + 2.27, sz - 0.24, 0, -PI / 2, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.27, 10), iron), sx + 0.12, FL + 2.43, IZB + 0.13, PI / 2, 0, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 10), iron), sx + 0.12, FL + 2.43, IZB + 0.02, PI / 2, 0, 0);
    add(new THREE.Mesh(lathe([[0, 0], [0.13, 0], [0.16, 0.08], [0.14, 0.17], [0.07, 0.21], [0.03, 0.26], [0, 0.26]], 12), copper), sx - 0.14, FL + 0.82, sz + 0.06);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 10, PI), copper), sx - 0.14, FL + 1.02, sz + 0.06);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.16, 5), copper), sx + 0.02, FL + 0.95, sz + 0.06, 0, 0, -0.9);
    col(sx, sz, 0.85, 0.75);
    if (opts.light !== false) { const l = new THREE.PointLight(0xff9a40, 1.3, 6, 2); l.position.set(sx + 0.3, FL + 0.6, sz + 0.8); root.add(l); }
    // pot rack with hanging pans and the lanterns on the back wall
    const rx = -2.6;
    add(ib(1.0, 0.1, 0.1, 0.02, timber), rx, FL + 1.98, 0.08, 0, 0, 0, Ib);
    for (const s of [-1, 1]) add(ib(0.06, 0.2, 0.12, 0.02, timber), rx + s * 0.42, FL + 1.88, 0.06, 0, 0, 0, Ib);
    for (let k = 0; k < 4; k++) {
      const px = rx - 0.33 + k * 0.22, rad = [0.11, 0.13, 0.14, 0.12][k], m = k % 2 ? iron : copper;
      add(ib(0.03, 0.28, 0.02, 0.005, m), px, FL + 1.78, 0.1, 0, 0, 0, Ib);
      add(new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.85, 0.05, 14), m), px, FL + 1.62 - rad, 0.12, PI / 2, 0, 0, Ib);
    }
    for (let k = 0; k < 5; k++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 8), k % 2 ? white : copper), rx - 0.4 + k * 0.2, FL + 2.07, 0.1, 0, 0, 0, Ib);
  }
  // ---- LIVING: lopsided dresser with jars of sweets and a vase of pink hydrangeas, under the back window
  {
    const dx = -BWIN[0][0], P = frame(dx, IZB + 0.3, 0), a = (m, px, py, pz, rx = 0, ry = 0, rz = 0) => add(m, px, py, pz, rx, ry, rz, P);
    P.rotation.z = 0.035; P.updateMatrix();
    a(ib(1.3, 0.82, 0.55, 0.04, timberLight), 0, FL + 0.49, 0);
    a(ib(1.4, 0.06, 0.6, 0.02, timber), 0, FL + 0.93, 0.01);
    for (const s of [-1, 1]) for (const t of [-1, 1]) a(ib(0.1, 0.1, 0.1, 0.02, timber), s * 0.58, FL + 0.05, t * 0.2);
    for (const s of [-1, 1]) { a(ib(0.58, 0.22, 0.03, 0.01, timber), s * 0.31, FL + 0.74, 0.28); a(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), timber), s * 0.31, FL + 0.74, 0.31); }
    a(ib(1.2, 0.36, 0.03, 0.01, timber), 0, FL + 0.38, 0.28);
    for (const s of [-1, 1]) a(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), timber), s * 0.3, FL + 0.38, 0.31);
    const sweets = [0xf28ab2, 0xffd23f, 0x8fc0e8];
    for (let k = 0; k < 3; k++) {
      a(new THREE.Mesh(jarGeo, M(0xe4eef0, null, { roughness: 0.6 })), 0.08 + k * 0.2, FL + 0.96, -0.02);
      a(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10), timberLight), 0.08 + k * 0.2, FL + 1.235, -0.02);
      for (let q = 0; q < 6; q++) bloomAt(P, 0.08 + k * 0.2 + jr(-0.05, 0.05), FL + 1.0 + jr(0, 0.15), 0.05, sweets[k], 0.8);
    }
    vaseOf(P, -0.42, FL + 0.96, 0.0, [0xf28ab2, 0xf6b3cf, 0xe8607a, 0xffffff], 14, 1.3);
    col(dx, IZB + 0.3, 1.4, 0.62);
    trim(Ib, dx, BWIN[0][1], BWIN[0][2], BWIN[0][3]);
  }
  // ---- LIVING: wobbly table with a runner, daisies and a bowl of apples; three odd painted chairs
  {
    const tx = -0.5, tz = 1.05;                                      // long side along z, tucked into the front-right corner
    add(ib(0.82, 0.08, 1.3, 0.03, timberLight), tx, FL + 0.74, tz, 0.015, 0.05, 0);
    for (const s of [-1, 1]) for (const t of [-1, 1]) add(ib(0.09, 0.72, 0.09, 0.02, timber), tx + s * 0.33, FL + 0.36, tz + t * 0.55, t * 0.03, 0, 0);
    for (const s of [-1, 1]) add(ib(0.05, 0.06, 1.0, 0.01, timber), tx + s * 0.33, FL + 0.2, tz);
    cush(crook, tx, FL + 0.785, tz, 0.95, 0.012, 0.36, 0xf4ecda, 0, 0.05, 0);
    for (const dx of [-0.36, 0.36]) cush(crook, tx + dx, FL + 0.79, tz, 0.05, 0.013, 0.37, 0xd86a6a, 0, 0.05, 0);
    vaseOf(crook, tx - 0.2, FL + 0.78, tz - 0.12, [0xffffff, 0xfff6d8, 0xffd23f], 10, 1.2);
    add(new THREE.Mesh(lathe([[0, 0], [0.08, 0], [0.16, 0.05], [0.18, 0.09], [0, 0.02]], 14), timberLight), tx + 0.3, FL + 0.78, tz + 0.05);
    for (let k = 0; k < 5; k++) bloomAt(crook, tx + 0.3 + jr(-0.08, 0.08), FL + 0.88, tz + 0.05 + jr(-0.08, 0.08), 0xd8402e, 1.4);
    col(tx, tz, 0.88, 1.35);
    const chair = (x, z, ry, mat) => {
      const P = frame(x, z, ry), a = (m, px, py, pz, rx = 0, rzz = 0) => add(m, px, py, pz, rx, 0, rzz, P);
      a(ib(0.44, 0.05, 0.42, 0.02, mat), 0, FL + 0.46, 0);
      for (const s of [-1, 1]) for (const t of [-1, 1]) a(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.46, 6), mat), s * 0.18, FL + 0.23, t * 0.17, t * 0.06, -s * 0.06);
      for (const s of [-1, 1]) a(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 6), mat), s * 0.18, FL + 0.76, -0.19, -0.08);
      for (const s of [-1, 0, 1]) a(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 5), mat), s * 0.08, FL + 0.7, -0.2, -0.08);
      a(ib(0.44, 0.09, 0.05, 0.02, mat), 0, FL + 1.02, -0.22, -0.08, 0.04);
      col(x, z, 0.46, 0.46, ry);
    };
    chair(tx - 0.72, tz - 0.25, PI / 2 + 0.15, doorBlue);
    chair(tx + 0.02, tz - 0.95, 0.12, M(0xc86a5c, tex('wood_light', 0.7)));
  }
  // ---- LIVING: patchwork rag rug, left window trim, lanterns
  {
    const rx = -2.45, rz = 0.55, cols = [0xd98a8a, 0x9bb8d8, 0xf1e2c4, 0xc96a6a, 0xa9c4e0, 0xe8d4b0, 0xd98a8a, 0x9bb8d8];
    for (let k = 0; k < cols.length; k++) putI(books, crook, rx - 0.9 + (k + 0.5) * (1.8 / cols.length), FL + 0.008, rz, 0, 0, 0, 1.8 / cols.length + 0.005, 0.012, 1.2, cols[k]);
    for (const s of [-1, 1]) for (let k = 0; k < 14; k++) putI(books, crook, rx + s * 0.97, FL + 0.006, rz - 0.55 + k * 0.085, 0, 0, 0, 0.12, 0.008, 0.02, 0xf1e2c4);
    trim(Il, -LWIN[0][0], LWIN[0][1], LWIN[0][2], LWIN[0][3]);
    lantern(Il, 1.4, FL + 1.85);
    lantern(Il, -1.3, FL + 1.85);
    lantern(Ip, 0.55, FL + 1.85);
    // little shelf with a plant over the left window
    add(ib(0.9, 0.05, 0.22, 0.02, timberLight), -LWIN[0][0], FL + 2.3, 0.11, 0, 0, 0, Il);
    for (let k = 0; k < 14; k++) leafAt(Il, -LWIN[0][0] + jr(-0.4, 0.4), FL + 2.3 - jr(0, 0.5) * (k / 14), 0.2 + jr(-0.05, 0.05), 0.85);
  }
  // ---- ATTIC: little patchwork bed against the back wall, headboard right, footboard left
  {
    const bx = 1.95, bz = IZB + 0.53, L = 2.0, D = 1.0;
    for (const s of [-1, 1]) {
      const hx = bx + s * (L / 2 + 0.04), hh = s > 0 ? 1.15 : 0.8;
      for (const t of [-1, 1]) { add(ib(0.1, hh, 0.1, 0.03, timberLight), hx, FL + hh / 2, bz + t * (D / 2 - 0.02)); add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), timberLight), hx, FL + hh + 0.05, bz + t * (D / 2 - 0.02)); }
      add(ib(0.06, hh - 0.35, D - 0.1, 0.02, timber), hx, FL + 0.3 + (hh - 0.35) / 2, bz);
    }
    add(ib(L, 0.2, D, 0.03, timber), bx, FL + 0.28, bz);
    cush(crook, bx, FL + 0.48, bz, L - 0.04, 0.2, D - 0.06, 0xf4ecdc);
    const Q = [0xf2a7b8, 0x9bb8d8, 0xf6e6c8, 0xe8c08a, 0xb8d0a0, 0xf6b3cf];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) cush(crook, bx - 0.75 + i * 0.32 - 0.12, FL + 0.6, bz - 0.36 + j * 0.25, 0.32, 0.05, 0.26, Q[(i + j * 2) % Q.length]);
    cush(crook, bx - 0.35, FL + 0.45, bz + D / 2 - 0.01, L - 0.75, 0.3, 0.04, 0xf2a7b8);          // quilt hanging down the front
    for (let k = 0; k < 16; k++) cush(crook, bx - 0.95 + k * 0.08, FL + 0.27, bz + D / 2 + 0.01, 0.025, 0.08, 0.02, 0xf6e6c8);
    cush(crook, bx + 0.72, FL + 0.7, bz - 0.2, 0.36, 0.16, 0.4, 0xf6efe2, 0, 0, 0.25);
    cush(crook, bx + 0.7, FL + 0.7, bz + 0.22, 0.34, 0.16, 0.38, 0xf6e6c8, 0, 0.1, 0.2);
    col(bx, bz, L + 0.2, D + 0.06);
    trim(Ib, -BWIN[1][0], BWIN[1][1], BWIN[1][2], BWIN[1][3]);
    for (let k = 0; k < 10; k++) bloomAt(Ib, -BWIN[1][0] + jr(-0.3, 0.3), BWIN[1][1] - BWIN[1][3] / 2 + 0.06 + jr(0, 0.1), 0.12 + jr(-0.04, 0.04), 0xf28ab2, 1.1);
    for (let k = 0; k < 10; k++) leafAt(Ib, -BWIN[1][0] + jr(-0.32, 0.32), BWIN[1][1] - BWIN[1][3] / 2 + 0.03 + jr(-0.05, 0.08), 0.12 + jr(-0.04, 0.04), 0.8);
    // shelf over the foot of the bed: books, a trailing plant, a little lantern
    add(ib(1.0, 0.05, 0.24, 0.02, timberLight), 0.95, FL + 1.75, 0.12, 0, 0, 0, Ib);
    for (const s of [-1, 1]) add(ib(0.05, 0.2, 0.2, 0.02, timber), 0.95 + s * 0.38, FL + 1.64, 0.1, 0, 0, 0, Ib);
    bookRow(Ib, 0.5, 0.85, FL + 1.78, 0.12, 0.17);
    for (let k = 0; k < 16; k++) leafAt(Ib, 1.05 + jr(-0.12, 0.15), FL + 1.85 - jr(0, 0.6) * (k / 16), 0.2 + jr(-0.05, 0.05), 0.85);
    lantern(Ib, 1.32, FL + 1.78);
    // lavender bundle hanging by the doorway
    for (let k = 0; k < 14; k++) bloomAt(Ia, 0.05 + jr(-0.06, 0.06), FL + 1.5 + jr(0, 0.35), 0.05, [0x8457c4, 0xa47ddb][k % 2], 0.7);
    add(ib(0.03, 0.4, 0.03, 0.01, M(0x6f9a42, null)), 0.05, FL + 1.75, 0.04, 0, 0, 0, Ia);
  }
  // ---- ATTIC: mannequin, stacked suitcases, rocking horse, low bookshelf, braided rug, lanterns
  {
    // dress form on a tripod stand, back-right corner
    const mx = 3.7, mz = -1.6;
    for (let k = 0; k < 3; k++) { const an = k * 2.094; add(ib(0.04, 0.04, 0.32, 0.01, timber), mx + Math.sin(an) * 0.14, FL + 0.06, mz + Math.cos(an) * 0.14, 0.15, an, 0); }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 6), timber), mx, FL + 0.5, mz);
    add(new THREE.Mesh(lathe([[0, 0], [0.17, 0.02], [0.2, 0.14], [0.15, 0.32], [0.14, 0.42], [0.19, 0.56], [0.17, 0.66], [0.07, 0.73], [0.04, 0.8], [0, 0.82]], 14), white), mx, FL + 0.92, mz);
    cush(crook, mx + 0.05, FL + 1.55, mz + 0.06, 0.08, 0.5, 0.06, 0xe86a7a, 0.1, 0, 0.2);           // scarf
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), timber), mx, FL + 1.76, mz);
    col(mx, mz, 0.5, 0.5);
    // suitcases stacked against the right wall
    const SC3 = [[0.8, 0.28, 0.5, 0x9a5a3a], [0.7, 0.26, 0.45, 0x7f9a7a], [0.6, 0.22, 0.4, 0xa8614a]];
    let y = FL;
    for (const [w, h, d, c] of SC3) {
      cush(Ir, -0.85 + jr(-0.04, 0.04), y + h / 2, d / 2 + 0.02, w, h, d, c, 0, jr(-0.08, 0.08), 0);
      for (const s of [-1, 1]) cush(Ir, -0.85 + s * w * 0.28, y + h / 2, d / 2 + 0.03, 0.05, h + 0.01, d + 0.01, 0x6a4026);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 8, PI), timber), -0.85, y + h + 0.01, d / 2 + 0.02, 0, 0, 0, Ir);
      y += h;
    }
    col(IXR - 0.27, -0.85, 0.56, 0.85);
    // rocking horse, front-left
    {
      const P = frame(1.2, 1.15, 0.3), a = (m, px, py, pz, rx = 0, ry = 0, rz = 0) => add(m, px, py, pz, rx, ry, rz, P);
      const wood = M(0xe8c48e, tex('wood_light', 0.8));
      for (const s of [-1, 1]) a(new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 5, 18, 0.9), wood), 0, FL + 1.04, s * 0.13, 0, 0, -PI / 2 - 0.45);
      for (const s of [-1, 1]) for (const t of [-1, 1]) a(ib(0.05, 0.36, 0.05, 0.015, wood), s * 0.22, FL + 0.27, t * 0.12, t * 0.15, 0, -s * 0.12);
      a(rbox(0.6, 0.2, 0.2, 0.08, wood), 0, FL + 0.5, 0);
      a(rbox(0.12, 0.34, 0.14, 0.05, wood), 0.28, FL + 0.7, 0, 0, 0, -0.4);
      a(rbox(0.26, 0.13, 0.13, 0.05, wood), 0.4, FL + 0.86, 0, 0, 0, -0.2);
      a(ib(0.24, 0.03, 0.24, 0.01, M(0xc8504a, null)), -0.02, FL + 0.61, 0);
      for (let k = 0; k < 6; k++) a(ib(0.04, 0.12, 0.03, 0.01, M(0xc8504a, null)), 0.2 - k * 0.035, FL + 0.82 - k * 0.03, 0, 0, 0, 0.5);
      col(1.2, 1.15, 0.85, 0.4, 0.3);
    }
    // low bookshelf in the front-left corner with a trailing plant on top
    {
      const P = frame(0.75, IZF - 0.2, PI), a = (m, px, py, pz) => add(m, px, py, pz, 0, 0, 0, P);
      a(ib(0.62, 0.9, 0.36, 0.02, timberLight), 0, FL + 0.45, 0);
      for (const y2 of [0.12, 0.47]) { a(ib(0.54, 0.32, 0.02, 0.005, timber), 0, FL + y2 + 0.16, -0.16); bookRow(P, -0.26, 0.26, FL + y2 + 0.02, 0.0, 0.26); }
      for (let k = 0; k < 18; k++) leafAt(P, jr(-0.25, 0.25), FL + 0.92 - jr(0, 0.5) * (k / 18), 0.15 + jr(-0.05, 0.08), 0.85);
      for (let k = 0; k < 7; k++) bloomAt(P, jr(-0.2, 0.2), FL + 0.98 + jr(0, 0.08), jr(-0.1, 0.1), 0xfbf6ee, 1.3);
      col(0.75, IZF - 0.2, 0.66, 0.4);
    }
    // braided round rug with a leaf ring and a pink rim
    const rx = 2.4, rz = -0.3;
    for (const [r, c, y] of [[0.95, 0xd88a8a, 0.006], [0.88, 0xf1e2c4, 0.01], [0.45, 0xeedcb6, 0.014]]) putI(discs, crook, rx, FL + y, rz, 0, 0, 0, r, 0.012, r, c);
    for (let k = 0; k < 26; k++) { const an = (k / 26) * 2 * PI; putI(books, crook, rx + Math.cos(an) * 0.66, FL + 0.021, rz + Math.sin(an) * 0.66, 0, -an + 0.6 * (k % 2 ? 1 : -1), 0, 0.11, 0.006, 0.045, 0x86a866); }
    trim(If, -FWIN[0][0], FWIN[0][1], FWIN[0][2], FWIN[0][3]);
    trim(If, -FWIN[1][0], FWIN[1][1], FWIN[1][2], FWIN[1][3]);
    trim(Ir, -RWIN[0][0], RWIN[0][1], RWIN[0][2], RWIN[0][3]);
    lantern(Ia, -1.2, FL + 1.85);
    lantern(Ir, -2.25, FL + 1.85);
    // wall shelf with a plant by the right window
    add(ib(0.7, 0.05, 0.22, 0.02, timberLight), 1.55, FL + 1.35, 0.11, 0, 0, 0, Ir);
    for (let k = 0; k < 14; k++) leafAt(Ir, 1.55 + jr(-0.25, 0.25), FL + 1.45 - jr(0, 0.45) * (k / 14), 0.18 + jr(-0.05, 0.05), 0.85);
    if (opts.light !== false) { const l = new THREE.PointLight(0xffc070, 1.0, 6, 2); l.position.set(2.6, 2.0, -1.2); root.add(l); }
  }
  // ---- wall colliders (un-sheared, at floor level), with gaps at the front doorway and the partition doorway
  {
    const h = WT / 2;
    col((-W / 2 + XC - B) / 2, ZF - h, XC - B + W / 2, WT);
    col((XC + B + W / 2) / 2, ZF - h, W / 2 - XC - B, WT);
    col(XC - B + h, (ZF + ZC) / 2 - h, WT, ZC - ZF + WT);
    col(XC + B - h, (ZF + ZC) / 2 - h, WT, ZC - ZF + WT);
    col((XC - B + XC - DW / 2) / 2, ZC - h, B - DW / 2, WT);
    col((XC + DW / 2 + XC + B) / 2, ZC - h, B - DW / 2, WT);
    col(0, ZB + h, W, WT);
    col(-W / 2 + h, (ZF + ZB) / 2, WT, ZF - ZB);
    col(W / 2 - h, (ZF + ZB) / 2, WT, ZF - ZB);
    col(XP, (ZB + ZDOOR - IDW / 2) / 2, 0.2, ZDOOR - IDW / 2 - ZB);
    col(XP, (ZDOOR + IDW / 2 + ZF) / 2, 0.2, ZF - ZDOOR - IDW / 2);
    col(XC - DW / 2 - 0.02, ZC - WT - 0.62, 0.12, 1.2);                     // the open door leaf
  }
  // ---- prop slots: hideable props where they'd naturally sit (pairs of a kind, off the walking lines)
  slot('armchair', -3.45, -1.2, 0.9); slot('armchair', -3.5, 0.6, 1.9);         // by the stove and the left window
  slot('stool', -3.65, -0.3, 0.3);                                             // between them, under the window
  slot('log_pile', -2.75, -2.35, 0.1); slot('log_pile', -2.3, -2.4, -0.3);     // beside the stove
  slot('chest', -3.55, 1.55, 0.1);                                             // front-left corner
  slot('chest', 0.7, -2.25, PI / 2);                                           // toy chest at the foot of the bed
  slot('lamp_table', 3.35, -2.4, 0);                                           // bedside, under the back window
  slot('laundry_basket', 3.55, 1.4, 0.2); slot('laundry_basket', 3.05, 1.6, -0.4);
  slot('potted_fern', 3.75, 0.45, 0);
  slot('book_stack', 1.6, 1.65, 0.3); slot('book_stack', 1.95, 1.5, -0.4);    // by the low bookshelf
  if (garden) {
    // gallery-only clutter where prop slots are (in-game the hiders' props stand here)
    const chestM = M(0x5f8a8e, tex('wood_light', 0.8));
    for (const [x, z, ry] of [[-3.55, 1.55, 0.1], [0.7, -2.25, PI / 2]]) {
      add(rbox(0.8, 0.45, 0.5, 0.06, chestM), x, FL + 0.225, z, 0, ry, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 12, 1, false, 0, PI), chestM), x, FL + 0.45, z, 0, ry, PI / 2);
    }
    cush(crook, -3.45, FL + 0.45, -1.2, 0.8, 0.7, 0.75, 0xd88a8a, 0, 0.9, 0);                 // patchwork armchair stand-in
  }

  // ---------------- garden dressing (garden mode only — these look like hideable props)
  if (garden) {
    const gadd = (m, x, y, z, rx = 0, ry = 0, rz = 0) => add(m, x, y, z, rx, ry, rz, root);
    const pot = (x, y, z, c) => {
      gadd(new THREE.Mesh(lathe([[0, 0], [0.15, 0], [0.21, 0.28], [0.24, 0.34], [0.21, 0.36], [0, 0.36]], 18), M(0xffcfa8, tex('terracotta', 1))), x, y, z);
      for (let k = 0; k < 10; k++) leaves.push([x + jr(-0.2, 0.2), y + 0.36 + jr(0, 0.2), z + jr(-0.2, 0.2), 1]);
      for (let k = 0; k < 9; k++) blossoms.push([x + jr(-0.17, 0.17), y + 0.48 + jr(0, 0.15), z + jr(-0.17, 0.17), c, 1.15]);
    };
    // barrel
    const bx = 1.45, bz = 2.95;
    gadd(new THREE.Mesh(lathe([[0, 0], [0.31, 0], [0.36, 0.2], [0.39, 0.4], [0.36, 0.62], [0.31, 0.8], [0, 0.8]], 20), M(0xa2693b, tex('wood_planks_dark', 1.5, 0.6))), bx, 0, bz);
    for (const y of [0.17, 0.62]) gadd(new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.02, 6, 24), iron), bx, y, bz, Math.PI / 2);
    // stool with a pot of pinks
    gadd(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14), timberLight), 0.55, 0.5, 2.95);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.28 + 0.4; gadd(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), timberLight), 0.55 + Math.cos(a) * 0.13, 0.24, 2.95 + Math.sin(a) * 0.13, Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1); }
    pot(0.55, 0.53, 2.95, 0xf28ab2);
    // crates
    for (const [x, y, z, ry] of [[2.35, 0.2, 2.8, 0.15], [2.9, 0.2, 3.1, -0.2]]) {
      gadd(rbox(0.55, 0.4, 0.45, 0.03, timberLight, 1), x, y, z, 0, ry, 0);
      for (const yy of [-0.12, 0.12]) gadd(rbox(0.58, 0.07, 0.48, 0.02, timber, 1), x, y + yy, z, 0, ry, 0);
    }
    // pots by the step
    pot(XC - 1.05, 0, ZC + 0.4, 0xfbf6ee); pot(XC + 1.05, 0, ZC + 0.4, 0xf28ab2);
    // red mailbox on a post
    {
      const mx = 3.9, mz = 3.3;
      gadd(rbox(0.1, 1.15, 0.1, 0.03, timber, 1), mx, 0.58, mz);
      gadd(rbox(0.32, 0.26, 0.5, 0.05, M(0xd9584a, null)), mx, 1.25, mz);
      gadd(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12, 1, false, 0, Math.PI), M(0xd9584a, null)), mx, 1.38, mz, Math.PI / 2, 0, Math.PI / 2);
    }
    // stepping stones out from the step
    for (let k = 0; k < 4; k++) gadd(new THREE.Mesh(new THREE.CylinderGeometry(jr(0.26, 0.34), jr(0.28, 0.36), 0.07, 8), stepMat), XC + Math.sin(k * 0.9) * 0.22 + jr(-0.1, 0.1), 0.03, ZPF + 0.55 + k * 0.6, 0, jr(0, 3), 0);
  }

  // ---------------- instanced tiles, stones, leaves, blossoms, fabrics and books (split: walls/rooms vs the roof group)
  {
    const inst = (geo, mat, items, P, set) => {
      if (!items.length) return;
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => set(im, it, i));
      im.castShadow = true; im.receiveShadow = true; P.add(im);
    };
    const mc = (im, [m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); };
    const tg = new THREE.CylinderGeometry(0.155, 0.17, 0.44, 7, 1, true, 0, Math.PI);
    tg.rotateZ(Math.PI / 2); tg.rotateY(Math.PI / 2);                 // axis down the slope (+Z = upslope), bulge up
    inst(tg, tileMat, tiles, roof, mc);
    inst(tg, tileMat, tilesP, crook, mc);
    const hi = ([m]) => m.elements[13] > H + 0.1;
    inst(stoneGeo, stoneMat, stones.filter((s) => !hi(s)), crook, mc);
    inst(stoneGeo, stoneMat, stones.filter(hi), roof, mc);
    const leafGeo = new THREE.CircleGeometry(0.1, 6); leafGeo.scale(1, 1.4, 1);
    const leafMat = M(0xffffff, null, { side: THREE.DoubleSide });
    const greens = [0x4f8a3c, 0x5f9c45, 0x3f7a35, 0x6fae4d, 0x7cbc55].map((h) => new THREE.Color(h));
    const setLeaf = (im, [x, y, z, s, nx, nz], i) => {
      o.position.set(x, y, z);
      if (nx !== undefined) { o.rotation.set(jr(-0.5, 0.5), Math.atan2(nx, nz) + jr(-0.6, 0.6), jr(0, 6.28)); } else o.rotation.set(jr(-0.9, 0.9), jr(-1, 1), jr(0, 6.28));
      o.scale.setScalar(jr(0.7, 1.25) * s); o.updateMatrix();
      im.setMatrixAt(i, o.matrix); im.setColorAt(i, greens[Math.floor(rr() * greens.length)].clone().offsetHSL(0, 0, jr(-0.05, 0.06)));
    };
    inst(leafGeo, leafMat, leaves.filter((l) => l[1] <= H + 0.1), crook, setLeaf);
    inst(leafGeo, leafMat, leaves.filter((l) => l[1] > H + 0.1), roof, setLeaf);
    const bGeo = new THREE.IcosahedronGeometry(0.06, 0), bMat = M(0xffffff, null, { roughness: 0.85 });
    const setBloom = (im, [x, y, z, c, s], i) => { o.position.set(x, y, z); o.rotation.set(jr(0, 6), jr(0, 6), 0); o.scale.setScalar(jr(0.85, 1.2) * s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, new THREE.Color(c)); };
    inst(bGeo, bMat, blossoms.filter((b) => b[1] <= H + 0.1), crook, setBloom);
    inst(bGeo, bMat, blossoms.filter((b) => b[1] > H + 0.1), roof, setBloom);
    inst(new THREE.BoxGeometry(1, 1, 1), paintMat, books, crook, mc);
    inst(new RoundedBoxGeometry(1, 1, 1, 1, 0.3), paintMat, cushs, crook, mc);
    inst(new THREE.CylinderGeometry(1, 1, 1, 28), paintMat, discs, crook, mc);
  }

  root.userData.footprint = { w: XR * 2 + 0.4, d: ZPF + 0.25 - (ZM - SM) };
  root.userData.door = { x: XC, z: ZC + 0.95 };
  root.userData.doorIn = { x: XC, z: IZF - 0.45 };
  root.userData.innerDoors = [{ x: XP, z: ZDOOR }];
  const r3 = (v) => +v.toFixed(3);
  root.userData.rooms = [
    { name: 'living', x: r3((IXL + XP - 0.1) / 2), z: r3((IZB + ZF + 0.1) / 2), w: r3(XP - 0.1 - IXL), d: r3(ZF + 0.1 - IZB) },
    { name: 'attic', x: r3((XP + 0.1 + IXR) / 2), z: r3((IZB + IZF) / 2), w: r3(IXR - XP - 0.1), d: r3(IZF - IZB) },
  ];
  root.userData.colliders = colliders.map((c) => Object.assign({}, c, { x: r3(c.x), z: r3(c.z), w: r3(c.w), d: r3(c.d) }, c.rot ? { rot: r3(c.rot) } : {}));
  root.userData.propSlots = propSlots.map((p) => ({ id: p.id, x: r3(p.x), z: r3(p.z), rot: r3(p.rot) }));
  if (opts.merge !== false) { roof.updateMatrixWorld(true); mergeStatic(THREE, roof); mergeStatic(THREE, root); }
  return root;
}
