/* Hue & Seek — Shared Storybook 3D Map, Building, Prop & Character Toolkit (maps/map_kit.js).
 * Used by all 5 new Storybook maps (bathhouse, skyruins, seaplane, clockwork, tinyfolk).
 * Matches Map 0's hand-painted Storybook gouache rendering:
 *   - Matte gouache materials (metalness = 0, roughness = 0.86–0.95) + luminance-preserving brushwork shaders
 *   - Meter-scale planar UVs on hollow walls so painted stone/plaster/wood brushwork never stretches
 *   - 3D instanced roof tiles/shingles, corner stone quoins, arch voussoirs, shuttered flowerbox windows & vines
 *   - 3D instanced domed squircle cobblestone plazas & multi-tiered gouache foliage trees
 *   - Painterly 1,100-stroke fur/cloth brush textures on rigged Storybook Seekers & Bean-Spirit Hiders
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeStatic, kitTex } from '../hero_cottage.js';

export { mergeStatic, kitTex, RoundedBoxGeometry, mergeGeometries };

const PI = Math.PI;
const TAU = PI * 2;

// ============================================================================
// 1. Seeded randomness, Codex-painted map texture loader & gouache shaders
// ============================================================================
export function makeRng(seed = 7) {
  let s = (Math.abs(Math.floor(seed)) * 7919 + 104729) % 2147483646 || 7;
  const rr = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 4; i++) rr();
  const jr = (a, b) => a + rr() * (b - a);
  const pick = (arr) => arr[Math.floor(rr() * arr.length)];
  return { rr, jr, pick };
}

const mapTexCache = new Map();
const mapBaseTexCache = new Map();
let sharedMapLoader = null;
const MAX_MAP_ANISO = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ? 4 : 8;
export function mapTex(THREE, mapId, name, rx = 1, ry = rx, clamp = false) {
  const key = `${mapId}/${name}|${rx}|${ry}|${clamp ? 1 : 0}`;
  if (mapTexCache.has(key)) return mapTexCache.get(key);
  const file = /\.(png|jpe?g)$/i.test(name) ? name.replace(/\.(png|jpe?g)$/i, '.webp') : (name.endsWith('.webp') ? name : `${name}.webp`);
  const baseKey = `${mapId}/${file}|${clamp ? 1 : 0}`;
  let base = mapBaseTexCache.get(baseKey);
  if (!base) {
    if (!sharedMapLoader) sharedMapLoader = new THREE.TextureLoader();
    base = sharedMapLoader.load(`assets/maps/${mapId}/${file}`, () => {
      if (base._clones) {
        for (const cl of base._clones) cl.needsUpdate = true;
      }
    });
    base.colorSpace = THREE.SRGBColorSpace;
    base.wrapS = base.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    base.anisotropy = MAX_MAP_ANISO;
    if (!clamp) base._unitBase = base;
    base._clones = [];
    mapBaseTexCache.set(baseKey, base);
  }
  if (rx === 1 && ry === 1) {
    mapTexCache.set(key, base);
    return base;
  }
  const t = base.clone();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = MAX_MAP_ANISO;
  if (!clamp) t._unitBase = base;
  if (base._clones) base._clones.push(t);
  if (base.image) t.needsUpdate = true;
  mapTexCache.set(key, t);
  return t;
}

const canvasCache = new Map();
export function paintedCanvasTex(THREE, key, size, drawFn, rx = 1, ry = 1) {
  const fullKey = `${key}|${rx}|${ry}`;
  if (canvasCache.has(fullKey)) return canvasCache.get(fullKey);
  let baseTex = canvasCache.get(`base:${key}`);
  if (!baseTex) {
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = baseCanvas.height = size;
    const rng = makeRng(key.length * 97 + 13);
    if (drawFn.length >= 4) drawFn(baseCanvas.getContext('2d'), size, size, rng);
    else drawFn(baseCanvas.getContext('2d'), size, rng);
    baseTex = new THREE.CanvasTexture(baseCanvas);
    baseTex.colorSpace = THREE.SRGBColorSpace;
    baseTex.wrapS = baseTex.wrapT = THREE.RepeatWrapping;
    baseTex.anisotropy = MAX_MAP_ANISO;
    baseTex._unitBase = baseTex;
    canvasCache.set(`base:${key}`, baseTex);
  }
  if (rx === 1 && ry === 1) {
    canvasCache.set(fullKey, baseTex);
    return baseTex;
  }
  const t = baseTex.clone();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = MAX_MAP_ANISO;
  t._unitBase = baseTex;
  t.needsUpdate = true;
  canvasCache.set(fullKey, t);
  return t;
}

export function brushStrokes(g, s, rng, count, cols, w0, w1, alpha, ang = 0, angVar = 3.14, len = 36) {
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    g.strokeStyle = rng.pick(cols);
    g.globalAlpha = alpha * rng.jr(0.4, 1);
    g.lineWidth = rng.jr(w0, w1);
    const x = rng.jr(-12, s + 12), y = rng.jr(-12, s + 12);
    const a = ang + rng.jr(-angVar, angVar) * 0.5, l = rng.jr(len * 0.45, len);
    for (const dx of x < 28 ? [0, s] : x > s - 28 ? [-s, 0] : [0]) {
      for (const dy of y < 28 ? [0, s] : y > s - 28 ? [-s, 0] : [0]) {
        g.beginPath();
        g.moveTo(x + dx, y + dy);
        g.quadraticCurveTo(
          x + dx + Math.cos(a) * l * 0.5 + rng.jr(-4, 4),
          y + dy + Math.sin(a) * l * 0.5 + rng.jr(-4, 4),
          x + dx + Math.cos(a) * l,
          y + dy + Math.sin(a) * l
        );
        g.stroke();
      }
    }
  }
  g.globalAlpha = 1;
}

// Seamless neutral Storybook gouache brush-grain map (near-white so hue stays 100% pure!)
export function gouacheGrainTex(THREE, rx = 1.6, ry = rx) {
  return paintedCanvasTex(THREE, 'storybook_gouache_grain_v2', 256, (g, s, rng) => {
    g.fillStyle = '#fcf8f0';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 620, ['#ffffff', '#ede4d3', '#f6efe2', '#e4d9c5'], 3, 11, 0.38, 0.35, 2.6, 34);
    brushStrokes(g, s, rng, 260, ['#dfd2bc', '#ffffff'], 1.2, 3.2, 0.26, -0.8, 3.14, 18);
  }, rx, ry);
}

// Luminance-preserving greyscale brushwork shader (matches houses/farmhouse.js lines 42-54!)
// Keeps painted kit textures crisp under ANY clean Storybook colour (slate blue, sakura pink, jade, gold) without muddying!
const greyMatCache = new Map();
export function greyMat(THREE, hex, map, norm = 0.44, k = 0.68, extra = {}) {
  const safeExtra = sanitizeStorybookExtra(extra);
  const key = `${hex}|${map ? map.uuid : 'none'}|${norm.toFixed(3)}|${k.toFixed(2)}|${JSON.stringify(safeExtra)}`;
  if (greyMatCache.has(key)) return greyMatCache.get(key);
  const m = new THREE.MeshStandardMaterial(Object.assign({
    color: hex,
    map: map || null,
    roughness: 0.93,
    metalness: 0,
  }, safeExtra));
  if (map) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  diffuseColor.rgb *= mix( 1.0, clamp( dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) / ${norm.toFixed(3)}, 0.0, 1.38 ), ${k.toFixed(2)} );
#endif`);
    };
    m.customProgramCacheKey = () => `storybook_grey|${norm.toFixed(3)}|${k.toFixed(2)}`;
  }
  greyMatCache.set(key, m);
  return m;
}

// Enforce warm matte Storybook gouache shading (scene.environment is null, so metalness > 0 turns dark grey!)
function sanitizeStorybookExtra(extra = {}) {
  const out = Object.assign({}, extra);
  delete out.greyscale;
  delete out.norm;
  delete out.k;
  const isGlassOrGlow = !!out.transparent || (out.emissive != null && (out.emissiveIntensity ?? 1) > 0.25);
  if (!isGlassOrGlow) {
    out.metalness = 0;
    out.roughness = Math.max(out.roughness ?? 0.92, 0.85);
  } else {
    out.metalness = Math.min(out.metalness ?? 0, 0.08);
  }
  return out;
}

// Meter-scale planar UVs (matches houses/bakery.js lines 133-138) so extruded walls never smear textures
export function applyPlanarUVs(geo, scale = 0.42) {
  const p = geo.attributes.position;
  if (!p) return geo;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.normal;
  let uv = geo.attributes.uv;
  if (!uv || uv.count !== p.count) {
    uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
      if (nx > 0.5) { uv[i * 2] = p.getZ(i) * scale; uv[i * 2 + 1] = p.getY(i) * scale; }
      else if (ny > 0.5) { uv[i * 2] = p.getX(i) * scale; uv[i * 2 + 1] = p.getZ(i) * scale; }
      else { uv[i * 2] = p.getX(i) * scale; uv[i * 2 + 1] = p.getY(i) * scale; }
    }
    geo.setAttribute('uv', new (p.constructor)(uv, 2));
    return geo;
  }
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    if (nx > 0.5) uv.setXY(i, p.getZ(i) * scale, p.getY(i) * scale);
    else if (ny > 0.5) uv.setXY(i, p.getX(i) * scale, p.getZ(i) * scale);
    else uv.setXY(i, p.getX(i) * scale, p.getY(i) * scale);
  }
  uv.needsUpdate = true;
  return geo;
}

// ============================================================================
// 2. Shared Cached Instancing Geometries (Tiles, Shingles, Stones, Leaves, Cobbles)
// ============================================================================
const sharedGeos = new WeakMap();
function getSharedGeos(THREE) {
  if (sharedGeos.has(THREE)) return sharedGeos.get(THREE);
  const barrelTile = new THREE.CylinderGeometry(0.145, 0.162, 0.46, 5, 1, false, 0, PI);
  barrelTile.rotateX(PI / 2);
  barrelTile.scale(1, 0.68, 1);

  const slateShingle = new THREE.BoxGeometry(0.36, 0.048, 0.44);

  const quoinStone = new RoundedBoxGeometry(1, 1, 1, 1, 0.22);

  const leaf = new THREE.CircleGeometry(0.105, 6);
  leaf.scale(1, 1.38, 1);

  const bloom = new THREE.IcosahedronGeometry(0.078, 0);

  // Domed squircle cobblestone (24 tris, exact match to world/plaza.js cobbleGeo!)
  const cobble = (() => {
    const pos = [], uv = [], idx = [], N = 8;
    for (const [r, y] of [[0.5, 0], [0.42, 0.72]]) {
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU + PI / N, c = Math.cos(a), s = Math.sin(a);
        const x = Math.sign(c) * Math.pow(Math.abs(c), 0.4) * r;
        const z = Math.sign(s) * Math.pow(Math.abs(s), 0.4) * r;
        pos.push(x, y, z);
        uv.push(x + 0.5, z + 0.5);
      }
    }
    pos.push(0, 1, 0);
    uv.push(0.5, 0.5);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      idx.push(i, N + j, j, i, N + i, N + j);
      idx.push(N + i, 2 * N, N + j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();

  const bundle = { barrelTile, slateShingle, quoinStone, leaf, bloom, cobble };
  sharedGeos.set(THREE, bundle);
  return bundle;
}

// ============================================================================
// 3. Building & Landmark Modeling Toolkit (hollow walls, instanced roofs, Storybook trim)
// ============================================================================
export function createBuilderKit(THREE, opts = {}, name = 'piece', salt = 1) {
  const { rr, jr, pick } = makeRng((opts.seed ?? 7) + salt * 31);
  const garden = opts.garden !== false;
  const matCache = new Map();
  const SG = getSharedGeos(THREE);

  const tex = (n, rx = 1, ry = rx) => kitTex(THREE, n, rx, ry);
  const G = (hex, map, norm = 0.44, k = 0.68, extra = {}) => greyMat(THREE, hex, map, norm, k, extra);

  const M = (hex, map = null, extra = {}) => {
    if (extra && extra.greyscale && map) {
      return greyMat(THREE, hex, map, extra.norm ?? 0.44, extra.k ?? 0.68, extra);
    }
    const safeExtra = sanitizeStorybookExtra(extra);
    const isGlassOrGlow = !!safeExtra.transparent || (safeExtra.emissive != null && (safeExtra.emissiveIntensity ?? 1) > 0.25);
    const resolvedMap = map || (!isGlassOrGlow ? gouacheGrainTex(THREE, 1.5, 1.5) : null);
    const key = `${hex}|${resolvedMap ? resolvedMap.uuid : ''}|${JSON.stringify(safeExtra)}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial(Object.assign({
        color: hex,
        map: resolvedMap,
        roughness: 0.92,
        metalness: 0,
      }, safeExtra)));
    }
    return matCache.get(key);
  };

  const glowMat = (hex = 0xffe09c, emissive = 0xffa838, intensity = 1.65, extra = {}) =>
    M(hex, null, Object.assign({ emissive, emissiveIntensity: intensity, roughness: 0.48 }, extra));

  const root = new THREE.Group();
  root.name = name;
  const roofG = new THREE.Group();
  roofG.name = 'roof';
  roofG.userData.keep = true;
  root.add(roofG);

  const colliders = [];
  const add = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root) => {
    if (ry && typeof ry === 'object') { parent = ry; ry = 0; rz = 0; }
    else if (rz && typeof rz === 'object') { parent = rz; rz = 0; }
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const addR = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => add(mesh, x, y, z, rx, ry, rz, roofG);
  const rbox = (w, h, d, r = 0.05, mat, seg = 2) =>
    new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, Math.min(r, w / 2, h / 2, d / 2) * 0.98)), mat);
  const boxCol = (x, z, w, d, rot = 0) => {
    const rec = { x: +x.toFixed(3), z: +z.toFixed(3), w: +w.toFixed(3), d: +d.toFixed(3) };
    if (rot) rec.rot = +rot.toFixed(4);
    colliders.push(rec);
  };

  const flipGeo = (g) => {
    if (g.index) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    }
    const n = g.attributes.normal;
    if (n) for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    return g;
  };

  // Hollow straight wall: outer face at local z = 0, inner face at local z = -th, local x in [-L/2, L/2].
  // Computes meter-scale planar UVs so stone/plaster/wood textures tile crisply without smearing!
  function wall(cx, cz, rotY, L, H, th, opens = [], outMat, inMat = null, P = root, recordCols = true) {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = rotY;
    P.add(g);

    const s = new THREE.Shape();
    s.moveTo(-L / 2, 0);
    const doors = opens.filter((o) => o.door).sort((a, b) => a.u - b.u);
    for (const o of doors) {
      const r = o.w / 2;
      s.lineTo(o.u - r, 0);
      if (o.arch) {
        s.lineTo(o.u - r, Math.max(0.2, o.h - r));
        s.absarc(o.u, Math.max(0.2, o.h - r), r, PI, 0, true);
      } else {
        s.lineTo(o.u - r, o.h);
        s.lineTo(o.u + r, o.h);
      }
      s.lineTo(o.u + r, 0);
    }
    s.lineTo(L / 2, 0);
    s.lineTo(L / 2, H);
    s.lineTo(-L / 2, H);
    s.lineTo(-L / 2, 0);

    for (const o of opens) {
      if (o.door) continue;
      const p = new THREE.Path(), r = o.w / 2;
      if (o.round) {
        p.absarc(o.u, o.y0 + o.h / 2, r, 0, TAU, false);
      } else {
        const top = o.y0 + o.h;
        p.moveTo(o.u - r, o.y0);
        p.lineTo(o.u + r, o.y0);
        p.lineTo(o.u + r, top);
        p.lineTo(o.u - r, top);
        p.lineTo(o.u - r, o.y0);
      }
      s.holes.push(p);
    }
    const eg = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(0.04, th - 0.05),
      bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 12,
    });
    eg.translate(0, 0, -th + 0.025);
    applyPlanarUVs(eg, 0.38);
    add(new THREE.Mesh(eg, outMat), 0, 0, 0, 0, 0, 0, g);
    if (inMat) {
      const ig = flipGeo(new THREE.ShapeGeometry(s, 12));
      applyPlanarUVs(ig, 0.42);
      add(new THREE.Mesh(ig, inMat), 0, 0, -th - 0.004, 0, 0, 0, g);
    }
    if (recordCols) {
      const c = Math.cos(rotY), sn = Math.sin(rotY);
      const seg = (a, b) => {
        if (b - a < 0.06) return;
        const uc = (a + b) / 2, lz = -th / 2;
        const wx = cx + uc * c + lz * sn, wz = cz - uc * sn + lz * c;
        const axisAlignedX = Math.abs(sn) < 0.02;
        const axisAlignedZ = Math.abs(c) < 0.02;
        if (axisAlignedX) boxCol(wx, wz, b - a, th);
        else if (axisAlignedZ) boxCol(wx, wz, th, b - a);
        else boxCol(wx, wz, b - a, th, rotY);
      };
      let u0 = -L / 2;
      for (const o of doors) { seg(u0, o.u - o.w / 2); u0 = o.u + o.w / 2; }
      seg(u0, L / 2);
    }
    return g;
  }

  const beam = (a, b, thick, mat, P = root) => {
    const va = a.isVector3 ? a : new THREE.Vector3(...a);
    const vb = b.isVector3 ? b : new THREE.Vector3(...b);
    const m = rbox(thick, va.distanceTo(vb), thick, Math.min(0.03, thick * 0.35), mat, 1);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    m.castShadow = true; m.receiveShadow = true;
    P.add(m);
    return m;
  };

  // Instanced batch helper
  const batches = new Map();
  const o3 = new THREE.Object3D();
  function pushInst(key, geoFn, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, hex = 0xffffff, parent = root) {
    const bKey = `${key}|${parent === roofG ? 'R' : 'B'}`;
    if (!batches.has(bKey)) batches.set(bKey, { geoFn, mat, parent, items: [] });
    o3.position.set(x, y, z);
    o3.rotation.set(rx, ry, rz);
    o3.scale.set(sx, sy, sz);
    o3.updateMatrix();
    batches.get(bKey).items.push([o3.matrix.clone(), hex instanceof THREE.Color ? hex : new THREE.Color(hex)]);
  }
  function pushInstMatrix(key, geoFn, mat, matrix, hex = 0xffffff, parent = root) {
    const bKey = `${key}|${parent === roofG ? 'R' : 'B'}`;
    if (!batches.has(bKey)) batches.set(bKey, { geoFn, mat, parent, items: [] });
    batches.get(bKey).items.push([matrix.clone(), hex instanceof THREE.Color ? hex : new THREE.Color(hex)]);
  }

  // --------------------------------------------------------------------------
  // Storybook Handcrafted 3D Architectural Detailing Helpers (Map 0 Parity)
  // --------------------------------------------------------------------------
  const tileSlopeMat = G(0xffffff, tex('roof_tiles', 0.45), 0.39, 0.65);
  const stoneDetailMat = G(0xffffff, tex('stone', 0.42), 0.447, 0.58);
  const leafDetailMat = G(0xffffff, tex('leaves', 0.9), 0.313, 0.52, { side: THREE.DoubleSide });
  const bloomDetailMat = M(0xffffff, null, { roughness: 0.86 });

  const tintFrom = (pal, lVar = 0.055, sVar = 0.04) =>
    new THREE.Color(Array.isArray(pal) ? pick(pal) : pal).offsetHSL(jr(-0.015, 0.015), jr(-sVar, sVar), jr(-lVar, lVar));

  // Populate a sloped roof plane (centered at cx,cy,cz with orientation rotY and pitch rx around local X)
  // with hundreds of real 3D instanced barrel tiles or slate shingles!
  function tileRoofSlope({
    cx = 0, cy = 3.5, cz = 0, width = 6, slopeLen = 3.2, pitch = 0.55, rotY = 0,
    style = 'barrel', palette = [0xc95f3c, 0xd8704a, 0xb85233, 0xd47d54], parent = roofG,
  }) {
    const isBarrel = style !== 'shingle' && style !== 'slate';
    const colStep = isBarrel ? 0.29 : 0.34;
    const rowStep = isBarrel ? 0.37 : 0.35;
    const cols = Math.max(2, Math.round(width / colStep));
    const rows = Math.max(2, Math.round(slopeLen / rowStep));
    const grpM = new THREE.Matrix4().makeRotationY(rotY).setPosition(cx, cy, cz);
    const pitchM = new THREE.Matrix4().makeRotationX(pitch);
    grpM.multiply(pitchM);
    const localM = new THREE.Matrix4();
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), eu = new THREE.Euler();

    for (let r = 0; r < rows; r++) {
      const lz = -slopeLen * 0.5 + (r + 0.5) * (slopeLen / rows);
      const stag = !isBarrel && (r % 2 === 1) ? (width / cols) * 0.45 : 0;
      for (let c = 0; c < cols; c++) {
        const lx = -width * 0.5 + (c + 0.5) * (width / cols) + stag;
        if (Math.abs(lx) > width * 0.52) continue;
        p.set(lx + jr(-0.015, 0.015), 0.035 + (rows - r) * 0.004, lz + jr(-0.015, 0.015));
        eu.set(isBarrel ? 0.05 + jr(-0.025, 0.025) : 0.07 + jr(-0.02, 0.02), jr(-0.035, 0.035), jr(-0.03, 0.03));
        q.setFromEuler(eu);
        s.set((width / cols) / (isBarrel ? 0.29 : 0.35) * jr(0.95, 1.06), jr(0.92, 1.12), (slopeLen / rows) / (isBarrel ? 0.38 : 0.39) * jr(0.96, 1.06));
        localM.compose(p, q, s).premultiply(grpM);
        pushInstMatrix(
          isBarrel ? 'storybook_barrel_tile' : 'storybook_slate_shingle',
          isBarrel ? SG.barrelTile : SG.slateShingle,
          tileSlopeMat,
          localM,
          tintFrom(palette, 0.06, 0.045),
          parent
        );
      }
    }
  }

  // Populate a conical / pagoda / octagonal / dome roof with concentric rings of 3D instanced shingles!
  function coneRoofTiles({
    cx = 0, yBase = 3.2, cz = 0, rBase = 3.0, height = 2.0, rTop = 0.15,
    style = 'shingle', palette = [0x4c6882, 0x5b7894, 0x3f5870], parent = roofG,
  }) {
    const isBarrel = style === 'barrel';
    const slope = Math.hypot(rBase - rTop, height);
    const pitch = Math.atan2(height, Math.max(0.05, rBase - rTop));
    const rings = Math.max(3, Math.round(slope / 0.36));
    const localM = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), eu = new THREE.Euler();
    for (let r = 0; r < rings; r++) {
      const t = (r + 0.45) / rings;
      const rad = rBase + (rTop - rBase) * t;
      if (rad < 0.22) continue;
      const y = yBase + height * t + 0.03;
      const n = Math.max(6, Math.round((TAU * rad) / 0.34));
      const off = (r % 2) * (PI / n);
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU + jr(-0.02, 0.02);
        p.set(cx + Math.sin(a) * rad, y, cz + Math.cos(a) * rad);
        eu.set(-(PI / 2 - pitch) + 0.08 + jr(-0.02, 0.02), a + jr(-0.03, 0.03), jr(-0.025, 0.025), 'YXZ');
        q.setFromEuler(eu);
        s.set(jr(0.92, 1.08), jr(0.9, 1.12), jr(0.95, 1.08));
        localM.compose(p, q, s);
        pushInstMatrix(
          isBarrel ? 'storybook_barrel_tile' : 'storybook_slate_shingle',
          isBarrel ? SG.barrelTile : SG.slateShingle,
          tileSlopeMat,
          localM,
          tintFrom(palette, 0.055, 0.04),
          parent
        );
      }
    }
  }

  // Alternating long-and-short 3D rounded corner stone quoins up building corners!
  function stoneQuoins(x, z, topY = 3.2, palette = [0xd8ccb8, 0xcabca4, 0xe2d6c2, 0xbeb09a], size = 0.36, cutY = 2.65) {
    let y = 0.02, idx = 0;
    while (y < topY - 0.14) {
      const h = jr(0.26, 0.35);
      const longX = idx % 2 === 0;
      const sx = longX ? size * 1.28 : size * 0.88;
      const sz = longX ? size * 0.88 : size * 1.28;
      pushInst(
        'storybook_quoin_stone',
        SG.quoinStone,
        stoneDetailMat,
        x, y + h * 0.5, z,
        jr(-0.015, 0.015), jr(-0.02, 0.02), jr(-0.015, 0.015),
        sx, h * 0.92, sz,
        tintFrom(palette, 0.05, 0.035),
        y + h * 0.5 > cutY ? roofG : root
      );
      y += h + 0.018;
      idx++;
    }
  }

  // Staggered course of 3D rounded foundation stones along a wall base
  function stonePlinthCourse(ax, az, bx, bz, h = 0.34, palette = [0xc9bca6, 0xbab09c, 0xd5c8b2]) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.25) return;
    const ry = Math.atan2(bx - ax, bz - az);
    const count = Math.max(2, Math.round(len / 0.54));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const sh = h * jr(0.88, 1.08);
      pushInst(
        'storybook_quoin_stone',
        SG.quoinStone,
        stoneDetailMat,
        ax + (bx - ax) * t, sh * 0.48, az + (bz - az) * t,
        jr(-0.02, 0.02), ry + jr(-0.03, 0.03), jr(-0.02, 0.02),
        0.26 * jr(0.9, 1.12), sh, (len / count) * 0.94,
        tintFrom(palette, 0.055, 0.04),
        root
      );
    }
  }

  // Wedge-rotated 3D stone arch voussoir ring + keystone around arched doorways!
  function stoneArchVoussoirs(cx, ySpring, cz, rotY, radius = 0.72, palette = [0xd8ccb6, 0xc8baa2, 0xe4d8c4], count = 9, parent = root) {
    const c = Math.cos(rotY), sn = Math.sin(rotY);
    for (let i = 0; i < count; i++) {
      const a = PI - ((i + 0.5) / count) * PI;
      const isKey = i === Math.floor(count / 2);
      const rMid = radius + (isKey ? 0.12 : 0.09);
      const lx = Math.cos(a) * rMid;
      const ly = ySpring + Math.sin(a) * rMid;
      const wx = cx + lx * c;
      const wz = cz - lx * sn;
      const localM = new THREE.Matrix4().makeRotationY(rotY).setPosition(wx, ly, wz);
      localM.multiply(new THREE.Matrix4().makeRotationZ(a - PI / 2));
      localM.scale(new THREE.Vector3((TAU * rMid * 0.5) / count * 0.92, isKey ? 0.28 : 0.21, isKey ? 0.34 : 0.28));
      pushInstMatrix('storybook_quoin_stone', SG.quoinStone, stoneDetailMat, localM, tintFrom(palette, 0.05, 0.03), parent);
    }
  }

  // Handcrafted Storybook Divided-Light Shuttered Window + Spilling 3D Flowerbox!
  function storybookShutterWindow(cx, y, cz, rotY, w = 0.86, h = 0.96, o = {}) {
    const P = o.parent || root;
    const wg = new THREE.Group();
    wg.position.set(cx, y, cz);
    wg.rotation.y = rotY;
    P.add(wg);

    const frameM = M(o.frameHex ?? 0x7c5333, tex('wood_light', 0.7));
    const shutterM = G(o.shutterHex ?? 0x4f7c6b, tex('wood_light', 0.8), 0.53, 0.58);
    const paneM = glowMat(o.paneHex ?? 0xffe6ab, o.glowHex ?? 0xffb347, o.glowInt ?? 1.15);

    // Warm glowing divided-light window pane + recessed frame & mullion crossbars
    add(rbox(w - 0.06, h - 0.06, 0.04, 0.01, paneM, 1), 0, 0, -0.02, 0, 0, 0, wg);
    for (const sx of [-1, 1]) add(rbox(0.065, h + 0.06, 0.09, 0.018, frameM, 1), sx * (w * 0.5), 0, 0.01, 0, 0, 0, wg);
    add(rbox(w + 0.14, 0.075, 0.12, 0.02, frameM, 1), 0, h * 0.5 + 0.02, 0.02, 0, 0, 0, wg);
    add(rbox(w + 0.16, 0.075, 0.15, 0.02, frameM, 1), 0, -h * 0.5 - 0.02, 0.035, 0, 0, 0, wg);
    add(rbox(0.036, h - 0.06, 0.055, 0.01, frameM, 1), 0, 0, 0.005, 0, 0, 0, wg);
    add(rbox(w - 0.06, 0.036, 0.055, 0.01, frameM, 1), 0, 0.04, 0.005, 0, 0, 0, wg);

    // Pair of open wooden louvered shutters
    if (o.shutters !== false) {
      const sw = Math.max(0.22, w * 0.44);
      for (const sx of [-1, 1]) {
        add(rbox(sw, h - 0.02, 0.042, 0.015, shutterM, 1), sx * (w * 0.5 + sw * 0.5 + 0.02), 0, 0.035, 0, -sx * 0.22, 0, wg);
      }
    }

    // Spilling 3D wooden flowerbox with instanced gouache leaves & blossoms!
    if (o.flowerbox !== false) {
      const boxM = M(o.boxHex ?? 0x8f5b38, tex('wood_light', 0.8));
      const fbw = w + 0.18, fby = -h * 0.5 - 0.13;
      add(rbox(fbw, 0.18, 0.22, 0.025, boxM, 1), 0, fby, 0.11, 0, 0, 0, wg);
      const c = Math.cos(rotY), sn = Math.sin(rotY);
      const toW = (lx, ly, lz) => [cx + lx * c + lz * sn, y + ly, cz - lx * sn + lz * c];
      const greens = o.leafCols || [0x4c8d3a, 0x5ea344, 0x72b650, 0x3e7a31];
      const blooms = o.bloomCols || [0xf26d8a, 0xffd25a, 0xfff6e6, 0xe85a4f];
      for (let i = 0; i < 20; i++) {
        const lx = jr(-fbw * 0.46, fbw * 0.46), ly = fby + jr(0.05, 0.22), lz = jr(0.05, 0.26);
        const [wx, wy, wz] = toW(lx, ly, lz);
        pushInst('storybook_leaf', SG.leaf, leafDetailMat, wx, wy, wz, jr(-0.9, 0.9), jr(-1, 1), jr(0, TAU), jr(0.75, 1.25), jr(0.75, 1.25), 1, tintFrom(greens, 0.05, 0.03), P);
      }
      for (let i = 0; i < 11; i++) {
        const lx = jr(-fbw * 0.44, fbw * 0.44), ly = fby + jr(0.1, 0.26), lz = jr(0.07, 0.27);
        const [wx, wy, wz] = toW(lx, ly, lz);
        const sc = jr(0.8, 1.25);
        pushInst('storybook_bloom', SG.bloom, bloomDetailMat, wx, wy, wz, jr(0, TAU), jr(0, TAU), 0, sc, sc * 0.85, sc, tintFrom(blooms, 0.04, 0.04), P);
      }
    }
    return wg;
  }

  // Sculpted climbing ivy / wisteria / bougainvillea vine along 3D control points!
  function climbingVine(pts, o = {}) {
    if (!pts || pts.length < 2) return;
    const P = o.parent || root;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
    const stemMat = M(o.stemHex ?? 0x5c422c, tex('bark', 1, 2));
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(10, pts.length * 5), o.stemR ?? 0.032, 5, false), stemMat), 0, 0, 0, 0, 0, 0, P);

    const greens = o.leafCols || [0x4c8d3a, 0x5ea344, 0x72b650, 0x3e7a31];
    const blooms = o.bloomCols || null;
    const nLeaves = o.leaves ?? 36;
    for (let i = 0; i < nLeaves; i++) {
      const pt = curve.getPoint(i / Math.max(1, nLeaves - 1));
      const wx = pt.x + jr(-0.18, 0.18), wy = pt.y + jr(-0.14, 0.16), wz = pt.z + jr(-0.18, 0.18);
      const targetP = o.cutY && wy > o.cutY ? roofG : P;
      pushInst('storybook_leaf', SG.leaf, leafDetailMat, wx, wy, wz, jr(-0.9, 0.9), jr(-1, 1), jr(0, TAU), jr(0.85, 1.45), jr(0.85, 1.45), 1, tintFrom(greens, 0.05, 0.03), targetP);
      if (blooms && rr() < (o.bloomRate ?? 0.48)) {
        if (o.droop) {
          // Drooping wisteria / blossom raceme cluster!
          const dropLen = jr(0.28, 0.58);
          for (let d = 0; d < 5; d++) {
            const k = d / 4;
            const sc = (1.15 - k * 0.45) * jr(0.85, 1.15);
            pushInst('storybook_bloom', SG.bloom, bloomDetailMat, wx + jr(-0.04, 0.04), wy - k * dropLen, wz + jr(-0.04, 0.04), jr(0, TAU), jr(0, TAU), 0, sc, sc, sc, tintFrom(blooms, 0.05, 0.04), targetP);
          }
        } else {
          const sc = jr(0.9, 1.35);
          pushInst('storybook_bloom', SG.bloom, bloomDetailMat, wx + jr(-0.06, 0.06), wy + jr(-0.04, 0.08), wz + jr(-0.06, 0.06), jr(0, TAU), jr(0, TAU), 0, sc, sc * 0.85, sc, tintFrom(blooms, 0.05, 0.04), targetP);
        }
      }
    }
  }

  function flushBatches() {
    for (const [bKey, { geoFn, mat, parent, items }] of batches) {
      if (!items.length) continue;
      const geo = typeof geoFn === 'function' ? geoFn() : geoFn;
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach(([mx, c], i) => { im.setMatrixAt(i, mx); im.setColorAt(i, c); });
      im.castShadow = true; im.receiveShadow = true;
      im.name = `inst_${bKey}`;
      parent.add(im);
    }
    batches.clear();
  }

  function finalize(keepGroups = []) {
    flushBatches();
    root.userData.colliders = colliders;
    root.traverse((o) => { if (o.isMesh && o.userData.ground) o.userData.keep = true; });
    if (opts.merge !== false) {
      for (const kg of keepGroups) if (kg) { kg.userData.keep = true; mergeStatic(THREE, kg); }
      if (roofG.children.length) mergeStatic(THREE, roofG);
      mergeStatic(THREE, root);
      root.userData.merged = true;
    }
    return root;
  }

  return {
    root, roofG, colliders, garden, rr, jr, pick, tex, M, G, glowMat,
    add, addR, rbox, boxCol, flipGeo, wall, beam, pushInst, pushInstMatrix,
    tileRoofSlope, coneRoofTiles, stoneQuoins, stonePlinthCourse, stoneArchVoussoirs,
    storybookShutterWindow, climbingVine, flushBatches, finalize,
  };
}

// ============================================================================
// 4. Standalone 3D Instanced Cobblestone Plaza & Multi-Tiered Storybook Tree Builders
// ============================================================================
export function buildInstancedCobblePaving(THREE, opts = {}) {
  const { rr, jr, pick } = makeRng(opts.seed || 77);
  const SG = getSharedGeos(THREE);
  const root = new THREE.Group();
  root.name = opts.name || 'storybook_cobble_paving';

  const R = opts.r || 10.5;
  const rInner = opts.rInner ?? 0;
  const Y0 = opts.y ?? 0.016;
  const PAL = opts.palette || [0xd2c4b0, 0xc4b5a0, 0xdcd0bc, 0xbab4c4, 0xcab8ad, 0xd6cab6];
  const accentPal = opts.accentPalette || PAL;
  const spokes = opts.spokes ?? 8;
  const spokeOff = PI / Math.max(4, spokes);

  // Optional grout / painted stone bed disc underneath the 3D cobbles
  if (opts.bedMap || opts.bedHex != null) {
    const bedGeo = rInner > 0.1 ? new THREE.RingGeometry(rInner, R + 0.08, 72) : new THREE.CircleGeometry(R + 0.08, 72);
    bedGeo.rotateX(-PI / 2);
    const bedMat = new THREE.MeshStandardMaterial({
      color: opts.bedHex ?? 0xffffff,
      map: opts.bedMap || kitTex(THREE, 'plaster', R * 0.45, R * 0.45),
      roughness: 0.94,
      metalness: 0,
    });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.y = Y0 - 0.004;
    bed.receiveShadow = true;
    bed.userData.ground = true;
    bed.userData.paint = new THREE.Color(opts.paintHex ?? PAL[0]);
    root.add(bed);
  }

  const mats = [], cols = [];
  const o = new THREE.Object3D();
  const pushStone = (rad, a, len, wid, h, col) => {
    o.position.set(Math.cos(a) * rad, Y0, Math.sin(a) * rad);
    o.rotation.set(0, -a + (rr() < 0.5 ? 0 : PI) + jr(-0.04, 0.04), 0);
    o.scale.set(wid, h, len);
    o.updateMatrix();
    mats.push(o.matrix.clone());
    cols.push(col);
  };
  const tint = (pal, l = 0) => new THREE.Color(pick(pal)).offsetHSL(jr(-0.01, 0.01), jr(-0.025, 0.025), jr(-0.055, 0.05) + l);

  if (rInner < 0.4) {
    o.position.set(0, Y0, 0);
    o.rotation.set(0, jr(0, 3), 0);
    o.scale.set(0.95, 0.032, 0.95);
    o.updateMatrix();
    mats.push(o.matrix.clone());
    cols.push(tint(accentPal, 0.03));
  }

  const acc1 = opts.accentR1 ?? Math.max(rInner + 1.8, R * 0.36);
  const acc2 = opts.accentR2 ?? R - 1.15;
  let rad = Math.max(0.55, rInner + 0.25);
  const stepMul = opts.stoneScale ?? 1.0;

  while (rad < R - 0.45) {
    const cw = (0.44 * stepMul) * jr(0.94, 1.06);
    const accent = (rad < acc1 && rad + cw >= acc1) || (rad < acc2 && rad + cw >= acc2);
    const rc = rad + cw * 0.5;
    const target = (accent ? 0.68 : 0.52) * stepMul;
    const n = Math.max(8, Math.round((TAU * rc) / target));
    const off = jr(0, TAU), step = TAU / n;
    for (let i = 0; i < n; i++) {
      const a = off + i * step + jr(-0.05, 0.05) * step;
      let col;
      let h = jr(0.024, 0.034);
      if (accent) {
        col = tint(accentPal, 0.04);
        h = 0.036;
      } else if (spokes > 0 && rc > acc1 + 0.3 && rc < acc2 - 0.3) {
        const period = TAU / spokes;
        const d = Math.abs((((a - spokeOff) % period) + period) % period - period * 0.5) * rc;
        col = d > period * 0.5 * rc - 0.28 ? tint(accentPal, 0.06) : tint(PAL, 0);
      } else {
        col = tint(PAL, 0);
      }
      pushStone(rc, a, rc * step * jr(0.87, 0.95), cw * jr(0.85, 0.93), h, col);
    }
    rad += cw;
  }

  // Outer kerb stone ring (kept <= 0.046m so movement is 100% smooth!)
  {
    const rc = R - 0.22, n = Math.max(12, Math.round((TAU * rc) / (0.64 * stepMul)));
    const off = jr(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      pushStone(rc, a, ((TAU * rc) / n) * jr(0.86, 0.94), 0.42 * stepMul, jr(0.038, 0.044), tint(accentPal, -0.05));
    }
  }

  if (mats.length) {
    const cobMat = greyMat(THREE, 0xffffff, kitTex(THREE, 'plaster', 0.45, 0.45), 0.64, 0.58);
    const im = new THREE.InstancedMesh(SG.cobble, cobMat, mats.length);
    mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
    im.castShadow = false;
    im.receiveShadow = true;
    im.name = 'paving_cobbles';
    im.userData.ground = true;
    im.userData.paint = new THREE.Color(opts.paintHex ?? PAL[0]);
    root.add(im);
  }
  root.userData.ground = true;
  return root;
}

// Sculptural Storybook Tree with twisted bark limbs, gouache-textured foliage domes & instanced outer leaf clusters!
export function buildStorybookTree(THREE, opts = {}) {
  const { rr, jr, pick } = makeRng(opts.seed || 101);
  const SG = getSharedGeos(THREE);
  const g = new THREE.Group();
  g.name = opts.name || 'storybook_tree';

  const hTrunk = opts.trunkHeight ?? jr(2.5, 3.3);
  const rTrunk = opts.trunkRadius ?? 0.28;
  const barkMat = new THREE.MeshStandardMaterial({
    color: opts.barkHex ?? 0x765038,
    map: kitTex(THREE, 'bark', 1, 2),
    roughness: 0.93,
    metalness: 0,
  });

  // Twisted sculpted trunk + root buttress flares + 3 spreading limbs
  const bendX = jr(-0.26, 0.26), bendZ = jr(-0.26, 0.26);
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.05, 0),
    new THREE.Vector3(bendX * 0.4, hTrunk * 0.38, bendZ * 0.4),
    new THREE.Vector3(bendX, hTrunk * 0.78, bendZ),
    new THREE.Vector3(bendX * 0.75, hTrunk * 1.05, bendZ * 0.75),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 12, rTrunk, 8, false), barkMat));

  for (let r = 0; r < 3; r++) {
    const ra = (r / 3) * TAU + jr(-0.3, 0.3);
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ra) * rTrunk * 1.9, 0.02, Math.sin(ra) * rTrunk * 1.9),
      new THREE.Vector3(Math.cos(ra) * rTrunk * 0.8, 0.42, Math.sin(ra) * rTrunk * 0.8),
      new THREE.Vector3(0, 0.88, 0),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(rootCurve, 6, rTrunk * 0.46, 6, false), barkMat));
  }

  const limbTips = [];
  const nLimbs = opts.limbs ?? 4;
  for (let b = 0; b < nLimbs; b++) {
    const ba = (b / nLimbs) * TAU + jr(-0.28, 0.28);
    const reach = (opts.spread ?? 1.75) * jr(0.85, 1.15);
    const tip = new THREE.Vector3(bendX + Math.cos(ba) * reach, hTrunk + jr(0.45, 1.05), bendZ + Math.sin(ba) * reach);
    const limbCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(bendX * 0.85, hTrunk * 0.76, bendZ * 0.85),
      new THREE.Vector3(bendX + Math.cos(ba) * reach * 0.55, hTrunk + 0.25, bendZ + Math.sin(ba) * reach * 0.55),
      tip,
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(limbCurve, 8, rTrunk * 0.44, 6, false), barkMat));
    limbTips.push(tip);
  }
  limbTips.push(new THREE.Vector3(bendX * 0.6, hTrunk + (opts.crownLift ?? 1.45), bendZ * 0.6));

  // Gouache-textured inner canopy cushions (using luminance-preserving leaves.png!)
  const palette = opts.foliagePalette || [0x5ca442, 0x74be52, 0x8fd162, 0x488c36];
  const folMats = palette.map((hex) => greyMat(THREE, hex, kitTex(THREE, 'leaves', 1.6, 1.6), 0.313, 0.62));

  const leafMatrices = [], leafColors = [];
  const o = new THREE.Object3D();
  const cTmp = new THREE.Color();

  limbTips.forEach((center, idx) => {
    const isTop = idx === limbTips.length - 1;
    const rad = (isTop ? 1.42 : 1.18) * (opts.canopyScale ?? 1.0) * jr(0.9, 1.12);
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 2), folMats[idx % folMats.length]);
    dome.position.copy(center);
    dome.scale.set(1.18, 0.74, 1.18);
    dome.rotation.set(jr(-0.15, 0.15), jr(0, TAU), jr(-0.15, 0.15));
    g.add(dome);

    // Outer sunlit painterly 3D leaf tufts around each bough cushion!
    const tuftN = isTop ? 34 : 24;
    for (let k = 0; k < tuftN; k++) {
      const a = jr(0, TAU), el = jr(-0.35, 1.05);
      const rrOut = rad * jr(0.86, 1.14);
      o.position.set(
        center.x + Math.cos(a) * Math.cos(el) * rrOut * 1.14,
        center.y + Math.sin(el) * rrOut * 0.76,
        center.z + Math.sin(a) * Math.cos(el) * rrOut * 1.14
      );
      o.rotation.set(jr(-0.85, 0.85), jr(-1, 1), jr(0, TAU));
      const sc = jr(1.45, 2.35) * (opts.canopyScale ?? 1.0);
      o.scale.set(sc, sc, 1);
      o.updateMatrix();
      leafMatrices.push(o.matrix.clone());
      cTmp.setHex(pick(palette)).offsetHSL(jr(-0.015, 0.015), jr(-0.03, 0.04), el * 0.06 + jr(-0.04, 0.05));
      leafColors.push(cTmp.clone());
    }
  });

  // Optional hanging wisteria / sakura blossom racemes!
  const dropMatrices = [], dropColors = [];
  if (opts.hangingBlossoms && opts.hangingBlossoms.length) {
    const nClusters = opts.hangingCount ?? 14;
    for (let c = 0; c < nClusters; c++) {
      const tip = limbTips[c % (limbTips.length - 1)];
      const a = jr(0, TAU), rrC = jr(0.3, 1.1) * (opts.canopyScale ?? 1.0);
      const bx = tip.x + Math.cos(a) * rrC, bz = tip.z + Math.sin(a) * rrC, by = tip.y - jr(0.35, 0.65);
      const len = jr(0.45, 0.88);
      for (let d = 0; d < 6; d++) {
        const k = d / 5;
        const sc = (1.5 - k * 0.65) * jr(0.85, 1.15);
        o.position.set(bx + jr(-0.05, 0.05), by - k * len, bz + jr(-0.05, 0.05));
        o.rotation.set(jr(0, TAU), jr(0, TAU), 0);
        o.scale.setScalar(sc);
        o.updateMatrix();
        dropMatrices.push(o.matrix.clone());
        cTmp.setHex(pick(opts.hangingBlossoms)).offsetHSL(jr(-0.01, 0.01), jr(-0.03, 0.04), (1 - k) * 0.05);
        dropColors.push(cTmp.clone());
      }
    }
  }

  mergeStatic(THREE, g);

  if (leafMatrices.length) {
    const leafMat = greyMat(THREE, 0xffffff, kitTex(THREE, 'leaves', 0.9, 0.9), 0.313, 0.48, { side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(SG.leaf, leafMat, leafMatrices.length);
    leafMatrices.forEach((mx, i) => { im.setMatrixAt(i, mx); im.setColorAt(i, leafColors[i]); });
    im.castShadow = true; im.receiveShadow = true;
    g.add(im);
  }
  if (dropMatrices.length) {
    const blMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 });
    const im = new THREE.InstancedMesh(SG.bloom, blMat, dropMatrices.length);
    dropMatrices.forEach((mx, i) => { im.setMatrixAt(i, mx); im.setColorAt(i, dropColors[i]); });
    im.castShadow = true; im.receiveShadow = true;
    g.add(im);
  }

  g.userData.merged = true;
  g.userData.colliders = [{ x: 0, z: 0, w: +(rTrunk * 2.5).toFixed(2), d: +(rTrunk * 2.5).toFixed(2) }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = new THREE.Color(palette[0]);
    }
  });
  return g;
}

// ============================================================================
// 5. Prop Kit Factory (builds once, merges per material, matte gouache brushwork)
// ============================================================================
export function createPropBuilder(THREE, seed = 17) {
  const matCache = new Map();
  const protoCache = new Map();

  function mat(key, hex, texName = null, repeat = 1, extra = {}) {
    const safeExtra = sanitizeStorybookExtra(extra);
    const isGlassOrGlow = !!safeExtra.transparent || (safeExtra.emissive != null && (safeExtra.emissiveIntensity ?? 1) > 0.25);
    const full = `${key}:${hex}:${texName || ''}:${repeat}:${JSON.stringify(safeExtra)}`;
    if (!matCache.has(full)) {
      const map = texName
        ? kitTex(THREE, texName, repeat, repeat)
        : (!isGlassOrGlow ? gouacheGrainTex(THREE, 2.0, 2.0) : null);
      matCache.set(full, new THREE.MeshStandardMaterial(Object.assign({
        color: hex, map, roughness: 0.9, metalness: 0,
      }, safeExtra)));
    }
    return matCache.get(full);
  }

  function buildMergedProto(id, fn) {
    if (!protoCache.has(id)) {
      const g = new THREE.Group();
      fn(g, makeRng(id.length * 131 + seed));
      mergeStatic(THREE, g);
      protoCache.set(id, g);
    }
    const src = protoCache.get(id);
    const out = new THREE.Group();
    out.name = id;
    out.userData.propId = id;
    src.children.forEach((c) => {
      if (c.isMesh) {
        const m = new THREE.Mesh(c.geometry, c.material);
        m.position.copy(c.position);
        m.rotation.copy(c.rotation);
        m.scale.copy(c.scale);
        m.castShadow = true;
        m.receiveShadow = true;
        out.add(m);
      }
    });
    return out;
  }

  const add = (g, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };
  const rbox = (w, h, d, r = 0.04, seg = 2) =>
    new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, Math.min(r, w / 2, h / 2, d / 2) * 0.98));
  const lathe = (pts, seg = 18, p0 = 0, pl = TAU) =>
    new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, p0, pl);
  const tube = (pts, r = 0.022, seg = 16, rad = 6, closed = false) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed), seg, r, rad, closed);

  return { mat, buildMergedProto, add, rbox, lathe, tube };
}

// ============================================================================
// 6. Shared Rigged 3D Storybook Seeker (Chaser) & Hider Spirit Builders
// ============================================================================
let CHAR_SHARED = null;
function getCharShared(THREE) {
  if (CHAR_SHARED && CHAR_SHARED.T === THREE) return CHAR_SHARED;
  // Exact 1,100-stroke seamless fur/cloth brush texture from Map 0's characters/hider.js!
  const charBrush = paintedCanvasTex(THREE, 'char_gouache_brush_v2', 256, (g, S, rng) => {
    g.fillStyle = '#fffcf6';
    g.fillRect(0, 0, S, S);
    g.lineCap = 'round';
    for (let i = 0; i < 1100; i++) {
      const x = rng.rr() * S, y = rng.rr() * S, l = 7 + rng.rr() * 16;
      const a = -PI / 2 + (rng.rr() - 0.5) * 1.1, w = 1.5 + rng.rr() * 3.5;
      const v = (232 + rng.rr() * 23) | 0, warm = rng.rr() < 0.5;
      g.strokeStyle = `rgba(${v},${v - (warm ? 5 : 1)},${v - (warm ? 13 : 0)},${0.2 + rng.rr() * 0.32})`;
      g.lineWidth = w;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        g.beginPath();
        g.moveTo(x + dx, y + dy);
        g.quadraticCurveTo(x + dx + Math.cos(a + 0.4) * l * 0.5, y + dy + Math.sin(a + 0.4) * l * 0.5, x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
        g.stroke();
      }
    }
  }, 2, 2);

  CHAR_SHARED = {
    T: THREE,
    brush: charBrush,
    cloth: new THREE.MeshStandardMaterial({ map: charBrush, vertexColors: true, roughness: 0.92, metalness: 0 }),
    eye: new THREE.MeshBasicMaterial({ vertexColors: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0xe4f5ff, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.4, depthWrite: false }),
    glow: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffb84d, emissiveIntensity: 0.95, roughness: 0.5, metalness: 0 }),
  };
  return CHAR_SHARED;
}

export function buildRiggedSeeker(THREE, kind, D, sculptFn) {
  const S = getCharShared(THREE);
  const V = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4;
  const X = new V(1, 0, 0), Y = new V(0, 1, 0), Z = new V(0, 0, 1);
  const paint = new THREE.MeshStandardMaterial({ color: D.main, map: S.brush, vertexColors: true, roughness: 0.9, metalness: 0 });
  const MAT = { cloth: S.cloth, paint, eye: S.eye, eyeC: S.eye, glass: S.glass, glow: S.glow };

  const root = new THREE.Group();
  root.name = 'seeker_' + kind;
  const G = {}, LOCAL = new Set();
  const grp = (name, parent, pos, local = false) => {
    const g = new THREE.Group();
    g.name = name; g.position.set(...pos); g.userData.keep = true;
    parent.add(g); G[name] = g;
    if (local) LOCAL.add(name);
    return g;
  };
  const hy = D.hipY;
  grp('legL', root, [D.legX, hy, 0]);
  grp('legR', root, [-D.legX, hy, 0]);
  grp('torso', root, [0, hy, 0]);
  grp('head', G.torso, [0, D.neckY - hy, 0]);
  const eyeEl = D.eyeEl ?? -0.05;
  const eyeY = D.head.c[1] + D.head.r * D.head.s[1] * Math.sin(eyeEl);
  grp('eyes', G.head, [0, eyeY - D.neckY, 0]);
  grp('upperL', G.torso, [D.sh[0], D.sh[1] - hy, 0], true);
  grp('foreL', G.upperL, [0, -D.a, 0], true);
  grp('upperR', G.torso, [-D.sh[0], D.sh[1] - hy, 0], true);
  grp('foreR', G.upperR, [0, -D.a, 0], true);
  grp('weapon', G.torso, [0, 0, 0], true);
  const nozzle = new THREE.Object3D();
  nozzle.name = 'nozzle';
  nozzle.position.set(...D.nozzle);
  G.weapon.add(nozzle);
  root.updateMatrixWorld(true);

  const v = (a) => (a.isVector3 ? a.clone() : new V(a[0], a[1], a[2]));
  const sv = (s) => (typeof s === 'number' ? new V(s, s, s) : v(s));
  const qq = (r) => (!r ? new Q() : r.isQuaternion ? r.clone() : new Q().setFromEuler(new THREE.Euler(r[0], r[1], r[2])));
  const xf = (g, pos = [0, 0, 0], rot = null, scl = 1) => g.applyMatrix4(new M4().compose(v(pos), qq(rot), sv(scl)));
  const sph = (r, pos, scl = 1, rot = null, w = 12, h = 9) => xf(new THREE.SphereGeometry(r, w, h), pos, rot, scl);
  const bowl = (pos, scl, rot) => xf(new THREE.SphereGeometry(1, 16, 6, 0, 2 * PI, PI / 2, PI / 2), pos, rot, scl);
  const lathe = (pts, pos = [0, 0, 0], scl = 1, rot = null, n = 20, p0 = 0, pl = 2 * PI) =>
    xf(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n, p0, pl), pos, rot, scl);
  const tor = (R, r, pos, rot = null, scl = 1, arc = 2 * PI, rs = 6, ts = 18) =>
    xf(new THREE.TorusGeometry(R, r, rs, ts, arc), pos, rot, scl);
  const rbox = (w, h, d, rad, pos, rot = null) =>
    xf(new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 0.2 ? 2 : 1, Math.min(rad, w / 2, h / 2, d / 2) * 0.95), pos, rot);
  const tube = (pts, r, n = 20, rs = 6, closed = false) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v), closed), n, r, rs, closed);
  const seg = (a, b, r1, r2 = r1, n = 10, caps = true) => {
    const A = v(a), B = v(b), d = B.clone().sub(A), L = d.length() || 0.001;
    const g = new THREE.CylinderGeometry(r2, r1, L, n, 1, true);
    g.applyMatrix4(new M4().compose(A.clone().add(B).multiplyScalar(0.5), new Q().setFromUnitVectors(Y, d.normalize()), new V(1, 1, 1)));
    return caps ? [g, sph(r1, A, 1, null, n, Math.max(4, (n >> 1) - 1)), sph(r2, B, 1, null, n, Math.max(4, (n >> 1) - 1))] : [g];
  };
  const cylz = (r1, r2, z0, z1, x = 0, y = 0, n = 12, open = false) =>
    xf(new THREE.CylinderGeometry(r2, r1, z1 - z0, n, 1, open), [x, y, (z0 + z1) / 2], [PI / 2, 0, 0]);
  const qn = (n, roll = 0) => {
    const q = new Q().setFromUnitVectors(Z, v(n).normalize());
    if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll));
    return q;
  };
  const nz = (x, y, z) => Math.sin(x * 13.1 + y * 4.3) * 0.5 + Math.sin(y * 16.7 + z * 7.9 + 1.3) * 0.3 + Math.sin(z * 11.3 + x * 9.1 + 2.1) * 0.2;

  const buckets = new Map(), col = new THREE.Color();
  const add = (gk, mk, geos, hex = 0xffffff) => {
    for (const g0 of [].concat(geos)) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal;
      if (!g.attributes.uv) {
        const uvArr = new Float32Array(P.count * 2);
        for (let i = 0; i < P.count; i++) {
          uvArr[i * 2] = (P.getX(i) + P.getZ(i)) * 1.8;
          uvArr[i * 2 + 1] = P.getY(i) * 1.8;
        }
        g.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
      }
      col.setHex(hex);
      const c = new Float32Array(P.count * 3);
      const flat = mk === 'eye' || mk === 'eyeC' || mk === 'glass' || mk === 'glow';
      for (let i = 0; i < P.count; i++) {
        let k = 1;
        if (!flat) k = (1 + 0.045 * nz(P.getX(i), P.getY(i), P.getZ(i))) * (0.87 + 0.15 * (0.5 + 0.5 * N.getY(i)));
        c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const key = gk + '|' + mk;
      if (!buckets.has(key)) buckets.set(key, { gk, mk, geos: [] });
      buckets.get(key).geos.push(g);
    }
  };

  // Head surface & expressive Storybook face builder
  const H = D.head, HC = v(H.c), HR = H.r, HS = H.s;
  const SKIN = D.skin ?? 0xffd2b4, SKIN_SH = D.skinSh ?? 0xf0b090, BLUSH = 0xf59a8c, LASH = 0x2b1712;
  const surf = (az, el, out = 0) => {
    const d = new V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const p = new V(HC.x + d.x * HR * HS[0], HC.y + d.y * HR * HS[1], HC.z + d.z * HR * HS[2]);
    const n = new V(d.x / HS[0], d.y / HS[1], d.z / HS[2]).normalize();
    return { p: p.addScaledVector(n, out), n, q: qn(n) };
  };
  const dec = (gk, mk, az, el, out, sc, hex, roll = 0, w = 10, h = 7) => {
    const { p, q } = surf(az, el, out);
    if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll));
    add(gk, mk, sph(1, p, sc, q, w, h), hex);
  };
  const lockGeo = () => {
    const g = new THREE.SphereGeometry(1, 10, 8), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i);
      if (y < 0) { const k = Math.pow(1 + y, 0.9) * 0.9 + 0.1; P.setXYZ(i, P.getX(i) * k, y * 1.25, P.getZ(i) * k); }
    }
    g.computeVertexNormals();
    return g;
  };
  const lock = (az, el, out, sc, hex, roll = 0, bend = 0) => {
    const { p, q } = surf(az, el, out);
    if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll));
    if (bend) q.multiply(new Q().setFromAxisAngle(X, bend));
    add('head', 'cloth', xf(lockGeo(), p, q, sc), hex);
  };
  const arcAt = (gk, mk, az, el, R, r, arcK, hex, up = true, out = 0.004, roll = 0) => {
    const { p, q } = surf(az, el, out);
    if (roll) q.multiply(new Q().setFromAxisAngle(Z, roll));
    const upV = Y.clone().applyQuaternion(q);
    const ctr = p.clone().addScaledVector(upV, up ? -R * 0.72 : R * 0.72);
    const g = new THREE.TorusGeometry(R, r, 6, 16, arcK * PI);
    g.rotateZ(up ? PI / 2 - arcK * PI / 2 : -PI / 2 - arcK * PI / 2);
    g.scale(1, 1, 0.5);
    add(gk, mk, xf(g, ctr, q), hex);
  };

  function buildFace(st = {}) {
    add('head', 'cloth', sph(HR, HC, HS, null, 24, 18), SKIN);
    for (const s of [-1, 1]) {
      dec('head', 'cloth', s * PI / 2, -0.12, -0.012, [0.04, 0.055, 0.03], SKIN);
      dec('head', 'cloth', s * 0.57, -0.24, -0.006, [0.045, 0.027, 0.012], BLUSH);
      const k = st.eyeK || 1, az = s * (st.eyeAz || 0.36), el = eyeEl;
      const e = (dx, dy, out, sc, hex, roll = 0, w = 10, h = 8) =>
        dec('eyes', 'eye', az + (s * dx) / (HR * HS[0]), el + dy / (HR * HS[1]), out, sc, hex, roll, w, h);
      e(0, 0, -0.014, [0.046 * k, 0.05 * k, 0.03], 0xffffff, 0, 12, 8);
      e(-0.004, -0.002, -0.008, [0.037 * k, 0.054 * k, 0.03], st.iris || 0x4b2f20, 0, 12, 8);
      e(-0.004, -0.024 * k, -0.005, [0.029 * k, 0.026 * k, 0.03], st.iris2 || 0xc4834a);
      e(-0.004, 0.004 * k, -0.002, [0.019 * k, 0.028 * k, 0.03], 0x120a07);
      e(s * 0.014 * k, 0.02 * k, 0.012, [0.014 * k, 0.017 * k, 0.02], 0xffffff, 0, 8, 6);
      e(-s * 0.013 * k, -0.026 * k, 0.01, [0.006 * k, 0.006 * k, 0.02], 0xffffff, 0, 6, 4);
      e(0, 0.047 * k, 0.003, [0.052 * k, 0.012, 0.03], LASH, -s * 0.12);
      arcAt('head', 'eyeC', az, el - 0.03, 0.04 * k, 0.0075, 0.62, LASH, !!st.happyClosed);
      dec('head', 'cloth', s * (st.browAz || 0.37), st.browEl || 0.36, 0.003, st.browSc || [0.042, 0.009, 0.01], st.brow || 0x3b2418, s * (st.browRoll || 0));
    }
    dec('head', 'cloth', 0, -0.17, -0.002, [0.016, 0.012, 0.013], SKIN_SH);
    const mel = -0.37;
    if (st.mouth === 'grin' || st.mouth === 'laugh') {
      const w = st.mouth === 'laugh' ? 0.066 : 0.056, { p, q } = surf(0, mel, -0.008);
      add('head', 'cloth', bowl(p, [w, w * 0.85, 0.022], q), 0x7c2a30);
      dec('head', 'cloth', 0, mel - 0.13, -0.002, [w * 0.55, 0.02, 0.016], 0xe8707a);
      dec('head', 'cloth', 0, mel - 0.018, 0.0, [w * 0.78, 0.01, 0.014], 0xfbf8f1);
    } else if (st.mouth === 'smirk') {
      arcAt('head', 'cloth', 0.05, mel + 0.03, 0.045, 0.0075, 0.45, 0x6e2e28, false, 0.002, 0.18);
    } else {
      arcAt('head', 'cloth', 0, mel + 0.02, 0.05, 0.008, 0.5, 0x6e2e28, false, 0.002);
    }
  }

  function buildArm(s, o) {
    const u = s > 0 ? 'upperL' : 'upperR', f = s > 0 ? 'foreL' : 'foreR', a = D.a, b = D.b;
    add(u, o.upperMat || 'cloth', sph(1, [0, -0.01, 0], [o.puff || o.r1 * 1.15, o.puff || o.r1 * 1.15, o.puff || o.r1 * 1.15], null, 14, 10), o.upper);
    add(u, o.upperMat || 'cloth', seg([0, 0, 0], [0, -a * (o.sleeve ?? 1), 0], o.r1, o.r1 * 0.92), o.upper);
    if ((o.sleeve ?? 1) < 1) add(u, 'cloth', seg([0, -a * o.sleeve, 0], [0, -a, 0], o.rs || 0.045, (o.rs || 0.045) * 0.95), SKIN);
    if (o.cuffU) add(u, 'cloth', tor(o.r1 * 0.98, 0.016, [0, -a * (o.sleeve ?? 1), 0], [PI / 2, 0, 0], 1, 2 * PI, 6, 16), o.cuffU);
    if (o.foreSleeve) {
      add(f, o.upperMat || 'cloth', seg([0, 0, 0], [0, -b * o.foreSleeve, 0], o.r1 * 0.92, o.r1 * 0.98), o.upper);
      add(f, 'cloth', seg([0, -b * o.foreSleeve, 0], [0, -b, 0], 0.036, 0.036, 10, false), SKIN);
    } else {
      add(f, 'cloth', seg([0, 0, 0], [0, -b * 0.9, 0], (o.rs || 0.045) * 0.95, (o.rs || 0.045) * 0.82), SKIN);
    }
    add(f, 'cloth', sph(1, [0, -b, 0.005], [o.hand || 0.052, (o.hand || 0.052) * 1.1, (o.hand || 0.052) * 1.05], null, 14, 10), o.glove || SKIN);
  }

  function buildBoot(gk, x, colHex = 0x4b3322, soleHex = 0x2b1c12, cuffHex = null, h = 0.22) {
    add(gk, 'cloth', lathe([[0.058, 0.03], [0.068, 0.06], [0.062, h], [0, h + 0.005]], [x, 0, 0], 1, null, 16), colHex);
    add(gk, 'cloth', sph(1, [x, 0.055, 0.048], [0.068, 0.052, 0.108], null, 14, 10), colHex);
    add(gk, 'cloth', rbox(0.132, 0.026, 0.21, 0.01, [x, 0.014, 0.03]), soleHex);
    if (cuffHex != null) add(gk, 'cloth', tor(0.064, 0.018, [x, h, 0], [PI / 2, 0, 0], 1, 2 * PI, 6, 16), cuffHex);
  }

  sculptFn({
    G, D, SKIN, SKIN_SH, v, xf, sph, bowl, lathe, tor, rbox, tube, seg, cylz, qn,
    add, surf, dec, lock, arcAt, buildFace, buildArm, buildBoot,
  });

  // Merge buckets per group+material
  const tmp = new V();
  let body = null;
  const open = [], closed = [], parts = [];
  for (const { gk, mk, geos } of buckets.values()) {
    const piv = LOCAL.has(gk) ? new V() : G[gk].getWorldPosition(tmp).clone();
    geos.forEach((g) => g.translate(-piv.x, -piv.y, -piv.z));
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), MAT[mk]);
    geos.forEach((g) => g.dispose());
    mesh.name = gk + '_' + mk;
    mesh.castShadow = mk === 'cloth' || mk === 'paint';
    mesh.receiveShadow = gk !== 'head' && gk !== 'eyes';
    G[gk].add(mesh);
    if (gk === 'torso' && mk === 'paint') body = mesh;
    if (mk === 'eye') open.push(mesh);
    if (mk === 'eyeC') { closed.push(mesh); mesh.visible = false; } else parts.push(mesh);
  }

  // 2-bone IK & stride animation
  const hip = (p) => new V(p[0], p[1] - hy, p[2]);
  const R0 = { p: hip(D.rest.p), r: new THREE.Euler(...D.rest.r) };
  const A0 = { p: hip(D.aim.p), r: new THREE.Euler(...D.aim.r) };
  const gripF = v(D.gripF), poleL = v(D.pole), poleR = v(D.pole).multiply(new V(-1, 1, 1));
  const qR = new Q().setFromEuler(R0.r), qA = new Q().setFromEuler(A0.r), qW = new Q(), qInv = new Q(), qU = new Q(), qF = new Q(), m4 = new M4();
  const wp = new V(), tA = new V(), tB = new V(), eu = new THREE.Euler(), g1 = new V(), g2 = new V(), du = new V(), pp = new V(), E = new V(), Wt = new V(), ax = new V(), ay = new V(), az3 = new V();

  const frameQ = (dir, pole, out) => {
    ay.copy(dir).negate().normalize();
    az3.copy(pole).addScaledVector(ay, -pole.dot(ay)).normalize();
    ax.crossVectors(ay, az3);
    return out.setFromRotationMatrix(m4.makeBasis(ax, ay, az3));
  };
  const ik = (up, fore, S0, W, pole) => {
    const a = D.a, b = D.b;
    du.subVectors(W, S0);
    let L = du.length();
    du.divideScalar(L || 1);
    L = Math.min(Math.max(L, Math.abs(a - b) + 0.02), (a + b) * 0.999);
    const cA = (a * a + L * L - b * b) / (2 * a * L), sA = Math.sqrt(Math.max(0, 1 - cA * cA));
    pp.copy(pole).addScaledVector(du, -pole.dot(du)).normalize();
    E.copy(S0).addScaledVector(du, a * cA).addScaledVector(pp, a * sA);
    Wt.copy(S0).addScaledVector(du, L);
    frameQ(g1.subVectors(E, S0), pp, qU);
    frameQ(g2.subVectors(Wt, E), pp, qF);
    up.quaternion.copy(qU);
    fore.quaternion.copy(qU).invert().multiply(qF);
  };

  const u = root.userData;
  Object.assign(u, {
    kind, paint, body, open, closed, parts, nozzle, squash: 0, bob: 0, jy: 0, vy: 0, aim: false,
    rig: G, phase: 0, t: 0, mv: 0, run: 0, aimK: 0, blinkT: 2 + (kind.length % 3),
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
    const amp = (0.42 + 0.25 * run) * mv;
    G.legL.rotation.set(sn * amp, 0, 0.035 * still);
    G.legR.rotation.set(-sn * amp, 0, -0.035 * still);
    G.legL.position.y = hy + Math.max(0, -cs) * (0.03 + 0.03 * run) * mv;
    G.legR.position.y = hy + Math.max(0, cs) * (0.03 + 0.03 * run) * mv;
    const bobY = (Math.abs(cs) - 0.6) * (0.04 + 0.03 * run) * mv;
    G.torso.position.y = hy + bobY + br * 0.004;
    const tw = D.tw + (D.twAim - D.tw) * aim + sn * 0.08 * mv * (1 - 0.6 * aim);
    G.torso.rotation.set((0.05 + 0.1 * run) * mv + 0.03 * aim, tw, sn * 0.035 * mv);
    if (body) body.scale.set(1 + br * 0.012, 1, 1 + br * 0.014);
    G.head.rotation.set(
      -G.torso.rotation.x * 0.6 + Math.sin(u.t * 1.3) * 0.025 * still + 0.07 * aim,
      -tw * 0.85 + Math.sin(u.t * 0.7) * 0.06 * still * (1 - aim),
      Math.sin(u.t * 0.9) * 0.03 * still - sn * 0.03 * mv
    );
    wp.lerpVectors(R0.p, A0.p, aim);
    const sw = 1 - 0.7 * aim;
    wp.x += sn * 0.022 * mv * sw;
    wp.y += bobY * -0.5 + (Math.abs(cs) - 0.6) * 0.02 * mv * sw + br * 0.008 + 0.05 * run * (1 - aim);
    qW.slerpQuaternions(qR, qA, aim).multiply(qInv.setFromEuler(eu.set(-0.18 * run * (1 - aim) + cs * 0.04 * mv * sw, cs * 0.05 * mv * sw, sn * 0.08 * mv * sw)));
    qInv.copy(G.torso.quaternion).invert();
    G.weapon.quaternion.copy(qInv).multiply(qW);
    G.weapon.position.copy(wp).applyQuaternion(qInv);
    G.weapon.updateMatrix();
    ik(G.upperR, G.foreR, G.upperR.position, tA.set(0, 0, 0).applyMatrix4(G.weapon.matrix), poleR);
    ik(G.upperL, G.foreL, G.upperL.position, tB.copy(gripF).applyMatrix4(G.weapon.matrix), poleL);
    u.blinkT -= dt;
    if (u.blinkT < -0.14) u.blinkT = 2.2 + ((Math.sin(u.t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3;
    G.eyes.scale.y = u.blinkT < 0 ? 0.12 : 1;
    if (D.extraAnim) D.extraAnim(u.t, ph, mv, G);
  };
  u.animate(0, false, 0);
  return root;
}

// Shared Chubby Bean-Spirit Hider Builder for Map-Specific Spirits
export function buildRiggedHiderSpirit(THREE, skinId, bodyHex, decorateFn) {
  const S = getCharShared(THREE);
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const PROFILE = [[0, 0.03], [0.15, 0.037], [0.252, 0.075], [0.31, 0.135], [0.33, 0.21], [0.322, 0.29], [0.295, 0.37], [0.262, 0.44],
    [0.244, 0.5], [0.252, 0.56], [0.268, 0.63], [0.27, 0.7], [0.255, 0.78], [0.216, 0.85], [0.146, 0.903], [0.058, 0.927], [0, 0.93]];
  const curve = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
  const dense = curve.getPoints(400);
  const R = (y) => {
    if (y <= dense[0].y) return 0;
    for (let i = 1; i < dense.length; i++) if (dense[i].y >= y) {
      const a = dense[i - 1], b = dense[i], t = (y - a.y) / Math.max(1e-6, b.y - a.y);
      return Math.max(0, a.x + (b.x - a.x) * t);
    }
    return 0;
  };
  const deform = (v) => {
    const r = Math.hypot(v.x, v.z), c = r > 1e-6 ? Math.max(0, v.z / r) : 0;
    v.z = v.z * 0.94 + Math.exp(-(((v.y - 0.25) / 0.15) ** 2)) * c * c * 0.045;
    return v;
  };
  const surf = (y, th) => { const r = R(y); return deform(V3(r * Math.sin(th), y, r * Math.cos(th))); };
  const normal = (y, th) => {
    const e = 0.004;
    return surf(y, th + e).sub(surf(y, th - e)).cross(surf(y + e, th).sub(surf(y - e, th))).normalize();
  };
  const frame = (y, th, off = 0, extra = null) => {
    const n = normal(y, th), x = V3(0, 1, 0).cross(n).normalize(), up = n.clone().cross(x).normalize();
    const m = new THREE.Matrix4().makeBasis(x, up, n).setPosition(surf(y, th).addScaledVector(n, off));
    return extra ? m.multiply(extra) : m;
  };
  const place = (geo, y, th, off = 0, extra = null) => geo.applyMatrix4(frame(y, th, off, extra));
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
  const grey = (v, warm = 0.025) => new THREE.Color(v, v * (1 - warm * 0.4), v * (1 - warm * 1.1));

  // Lift ultra-dark bodyHex values slightly so dark spirits still show velvety Storybook fur brushstrokes!
  const liftedBody = new THREE.Color(bodyHex);
  const hsl = { h: 0, s: 0, l: 0 };
  liftedBody.getHSL(hsl);
  if (hsl.l < 0.30) liftedBody.setHSL(hsl.h, Math.min(1, hsl.s + 0.08), 0.34);

  const paint = new THREE.MeshStandardMaterial({ color: liftedBody, map: S.brush, vertexColors: true, roughness: 0.89, metalness: 0 });
  const std = (extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ map: S.brush, vertexColors: true, roughness: 0.88, metalness: 0 }, sanitizeStorybookExtra(extra)));
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: true });

  const root = new THREE.Group(); root.name = `hider_${skinId}`;
  const torso = new THREE.Group(); torso.name = 'torso'; root.add(torso);
  const crest = new THREE.Group(); crest.name = 'crest'; crest.position.set(0, 0.91, 0); torso.add(crest);
  const mk = (geo, mat, parent = torso, name = '') => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  };

  const bodyGeo = new THREE.LatheGeometry(curve.getPoints(38), 38);
  { const p = bodyGeo.attributes.position, v = V3(); for (let i = 0; i < p.count; i++) { deform(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x, v.y, v.z); } }
  bodyGeo.computeVertexNormals();
  paintGeo(bodyGeo, (x, y, z) => {
    const r = Math.hypot(x, z) || 1, front = Math.max(0, z / r);
    const crown = Math.max(0, (y - 0.55) / 0.38) * 0.08;
    const v = 0.94 + crown + Math.exp(-(((y - 0.24) / 0.16) ** 2)) * front ** 1.5 * 0.1 - Math.max(0, (0.14 - y) / 0.11) * 0.09;
    return grey(Math.min(1.04, v), 0.03);
  });
  const body = mk(bodyGeo, paint, torso, 'body');

  // Expressive eyes + happy mouth + rosy cheeks
  const ell = (sx, sy, sz, ws = 14, hs = 10) => new THREE.SphereGeometry(1, ws, hs).scale(sx, sy, sz);
  const eyes = [], closedG = [];
  const eyeColor = skinId === 'suds_star' ? 0x5c4a94 : 0x5c361e;
  for (const sx of [-1, 1]) {
    const iris = paintGeo(ell(0.042, 0.052, 0.018), (x, y) => new THREE.Color(eyeColor).lerp(new THREE.Color(0x180e08), (y / 0.052 + 1) * 0.45));
    const hl1 = paintGeo(ell(0.016, 0.018, 0.006).translate(-0.013, 0.019, 0.015), 0xffffff);
    const hl2 = paintGeo(ell(0.007, 0.007, 0.004).translate(0.013, -0.018, 0.013), 0xfff6ea);
    const tilt = new THREE.Matrix4().makeRotationY(-sx * 0.16);
    for (const g of [iris, hl1, hl2]) eyes.push(place(g, 0.668, sx * 0.5, -0.003, tilt));
    const lid = paintGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-0.036, 0.006, 0), V3(0, -0.016, 0), V3(0.036, 0.006, 0)]), 12, 0.0065, 6, false), 0x2a1810);
    closedG.push(place(lid, 0.664, sx * 0.5, 0.004, tilt));
  }
  const eyeOpen = mk(mergeGeometries(eyes, false), eyeMat, torso, 'eyes');
  const eyeClosed = mk(mergeGeometries(closedG, false), eyeMat, torso, 'eyesClosed');
  eyeClosed.visible = false;
  eyeOpen.castShadow = eyeClosed.castShadow = false;

  const faceParts = [
    place(paintGeo(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, PI / 2, PI / 2).scale(0.04, 0.035, 0.013), 0x6b2626), 0.6, 0, 0),
    place(paintGeo(ell(0.022, 0.011, 0.007).translate(0, -0.023, 0.007), 0xe8808a), 0.6, 0, 0),
    place(paintGeo(ell(0.052, 0.031, 0.008), 0xf6a69a), 0.618, -0.8, -0.002),
    place(paintGeo(ell(0.052, 0.031, 0.008), 0xf6a69a), 0.618, 0.8, -0.002),
  ];
  mk(mergeGeometries(faceParts, false), std({ roughness: 0.84 }), torso, 'face');

  const arms = [], feet = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.name = sx < 0 ? 'armL' : 'armR';
    a.position.set(sx * 0.275, 0.41, 0.015); a.rotation.z = sx * 0.4; a.userData.rz = sx * 0.4;
    const ag = paintGeo(new THREE.CapsuleGeometry(0.066, 0.1, 5, 12).scale(1, 1, 1.12), (x, y) => grey(0.9 + 0.1 * y));
    ag.rotateX(0.12); ag.translate(0, -0.09, 0);
    mk(ag, paint, a, a.name); torso.add(a); arms.push(a);

    const f = new THREE.Group(); f.name = sx < 0 ? 'footL' : 'footR';
    f.position.set(sx * 0.13, 0, 0); f.rotation.y = sx * 0.12;
    const fg = paintGeo(ell(0.078, 0.052, 0.1), (x, y) => grey(y > 0 ? 0.96 : 0.84));
    fg.translate(0, 0.046, 0.07);
    mk(fg, paint, f, f.name); root.add(f); feet.push(f);
  }

  let extraAnim = null;
  if (decorateFn) {
    extraAnim = decorateFn({ torso, crest, paint, std, mk, paintGeo, place, surf, normal, ell, V3 });
  }

  const parts = [torso, ...feet];
  const open = [eyeOpen], closed = [eyeClosed];
  let ph = 0, walkK = 0, t = 0, lastBob = 0;
  const footBase = feet.map((f) => f.position.clone());
  const animate = (dt, moving, speed = 0) => {
    const u = root.userData;
    dt = Math.min(dt || 0, 0.1); t += dt;
    walkK += ((moving ? 1 : 0) - walkK) * Math.min(1, dt * 9);
    const db = (u.bob || 0) - lastBob; lastBob = u.bob || 0;
    if (moving) ph += db > 0 && db < 1.5 ? db : dt * (7 + Math.min(speed, 8) * 1.1);
    const s = Math.sin(ph), c = Math.cos(ph), k = walkK, idle = 1 - k;
    feet.forEach((f, i) => {
      const sg = i === 0 ? 1 : -1, sw = s * sg, lift = Math.max(0, c * sg);
      f.position.z = footBase[i].z + sw * 0.075 * k;
      f.position.y = lift * 0.055 * k;
      f.rotation.x = -c * sg * 0.35 * k;
    });
    const breathe = Math.sin(t * 2.3);
    torso.position.y = Math.abs(s) * 0.035 * k;
    torso.rotation.z = -s * 0.085 * k + Math.sin(t * 1.1) * 0.012 * idle;
    torso.rotation.x = 0.07 * k * Math.min(1, speed / 5);
    torso.rotation.y = s * 0.06 * k;
    torso.scale.set(1 - breathe * 0.008 * idle, 1 + breathe * 0.016 * idle, 1 - breathe * 0.008 * idle);
    arms.forEach((a, i) => {
      const sg = i === 0 ? 1 : -1;
      a.rotation.x = s * sg * 0.6 * k + Math.sin(t * 2.3 + i) * 0.04 * idle;
      a.rotation.z = a.userData.rz + (i === 0 ? -1 : 1) * (Math.abs(s) * 0.18 * k + (breathe + 1) * 0.025 * idle);
    });
    crest.rotation.z = Math.sin(t * 1.7) * 0.09 * idle + s * 0.12 * k;
    crest.rotation.x = -0.15 * k + Math.sin(t * 1.3 + 1) * 0.05 * idle;
    if (extraAnim) extraAnim(t, ph, k, idle);
  };

  root.userData = {
    paint, body, open, closed, parts, squash: 0, bob: 0, jy: 0, vy: 0, animate,
    skin: skinId, skinColor: liftedBody.getHex(),
  };
  animate(0, false, 0);
  return root;
}

// ============================================================================
// 7. Storybook Painterly Animated Water & Swaying Meadow Ribbon Blades
// ============================================================================
export function createAnimatedWater(THREE, opts = {}) {
  const geo = opts.geometry || new THREE.CircleGeometry(opts.radius || 38, 64);
  if (!opts.preRotated) geo.rotateX(-PI / 2);
  const uTime = { value: 0 };
  // Sample Codex-painted Storybook water brushwork (`assets/maps/seaplane/water.webp`)!
  const waterTex = opts.waterMap || mapTex(THREE, 'seaplane', 'water', 1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: opts.transparent ?? true,
    depthWrite: opts.depthWrite ?? false,
    uniforms: {
      uTime,
      tWater: { value: waterTex },
      cDeep: { value: new THREE.Color(opts.deep || 0x1c6988) },
      cShallow: { value: new THREE.Color(opts.shallow || 0x4cc4d8) },
      cFoam: { value: new THREE.Color(opts.foam || 0xf0fcff) },
      uOpacity: { value: opts.opacity ?? 0.88 },
      uScale: { value: opts.scale ?? 0.35 },
      uTexScale: { value: opts.texScale ?? 0.09 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(uTime * 1.6 + wp.x * 0.45 + wp.z * 0.35) * 0.02 + cos(uTime * 1.1 - wp.z * 0.55) * 0.015;
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D tWater;
      uniform vec3 cDeep, cShallow, cFoam;
      uniform float uOpacity, uScale, uTexScale;
      varying vec3 vW;
      void main() {
        vec2 uvA = vW.xz * uTexScale + vec2(uTime * 0.014, uTime * 0.009);
        vec2 uvB = vW.xz * (uTexScale * 1.45) - vec2(uTime * 0.011, -uTime * 0.013);
        vec3 texA = texture2D(tWater, uvA).rgb;
        vec3 texB = texture2D(tWater, uvB).rgb;
        float lum = dot(texA * 0.58 + texB * 0.42, vec3(0.299, 0.587, 0.114));
        float flow = sin(vW.x * uScale * 1.4 + uTime * 1.1) * 0.12 + cos(vW.z * uScale * 1.3 - uTime * 0.9) * 0.12;
        float band = clamp(lum * 1.18 + flow, 0.0, 1.0);
        vec3 col = mix(cDeep, cShallow, smoothstep(0.24, 0.82, band));
        float ribbon = smoothstep(0.76, 0.94, band);
        col = mix(col, cFoam, ribbon * 0.58);
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = opts.y ?? 0.02;
  mesh.userData.ground = opts.walkable !== false;
  mesh.userData.paint = new THREE.Color(opts.shallow || 0x4cc4d8);
  return { mesh, update: (t) => { uTime.value = t; } };
}

// Soft Storybook ribbon grass shader (exact match to Map 0 main.js lines 235-262!)
export function createSwayingBlades(THREE, opts = {}) {
  const count = opts.count || 4500;
  const h = opts.height || 0.58;
  const w = opts.width || 0.056;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 0, 0,
    w, 0, 0,
    -w * 0.55, h * 0.52, 0.012,
    w * 0.55, h * 0.52, 0.012,
    0.008, h, 0.032,
  ], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 0.55, 1,
    0, 0.55, 1,
    0, 0.68, 1,
    0, 0.68, 1,
    0, 0.85, 1,
  ], 3));
  geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  const uTime = { value: 0 };
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = `uniform float uTime;\nvarying float vH;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vH = position.y / ${h.toFixed(3)};
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sway = sin(uTime * 1.6 + wp.x * 0.33 + wp.z * 0.21) * 0.55 + sin(uTime * 2.7 + wp.z * 0.47) * 0.25;
      transformed.x += sway * ${(h * 0.26).toFixed(3)} * vH * vH;
      transformed.z += sway * ${(h * 0.12).toFixed(3)} * vH * vH;`);
    sh.fragmentShader = 'varying float vH;\n' + sh.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb *= mix(0.54, 1.22, clamp(vH, 0.0, 1.0));'
    );
  };
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.userData.isGrassBlades = true;
  const { jr } = makeRng(opts.seed || 41);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const filter = opts.filter || ((x, z) => Math.hypot(x, z) > 10 && Math.hypot(x, z) < 34);
  const baseHex = opts.color || 0x7fb35a;
  let k = 0, guard = 0;
  const R = opts.spread || 35;
  while (k < count && guard++ < count * 8) {
    const x = jr(-R, R), z = jr(-R, R);
    if (!filter(x, z)) continue;
    q.setFromEuler(new THREE.Euler(jr(-0.18, 0.18), jr(0, 6.28), jr(-0.18, 0.18)));
    sc.set(jr(0.8, 1.32), jr(0.52, 1.08), 1);
    p.set(x, opts.yOffset ? opts.yOffset(x, z) : 0, z);
    m.compose(p, q, sc);
    inst.setMatrixAt(k, m);
    inst.setColorAt(k, c.set(baseHex).offsetHSL(jr(-0.03, 0.04), jr(-0.04, 0.1), jr(-0.04, 0.1)));
    k++;
  }
  inst.count = k;
  inst.receiveShadow = true;
  return { inst, update: (t) => { uTime.value = t; } };
}
