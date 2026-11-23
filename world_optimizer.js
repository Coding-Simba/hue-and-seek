/* Hue & Seek — Zero-Visual-Loss World Batching, Material Consolidation & Thermal Light Optimizer
 *
 * Cuts per-frame WebGL draw calls from ~2,400 -> ~250-380 and fragment-shader PointLight loops by ~90%
 * while keeping 100% identical Storybook geometry, colours, brushwork shaders, shadows, roofs & props:
 *   1. Automatically detects dynamic subtrees (waterwheels, trams, pendulums, bobbing lanterns, sails, props).
 *   2. Bakes diffuse `material.color` into vertex `color` (`vColor`) across untextured, standard-textured, and
 *      `greyMat` gouache-shader materials so dozens of colour variants share a single canonical GPU material.
 *   3. Batches static world meshes into 4-quadrant frustum-cullable static chunks (preserving `solids`,
 *      `ground`, `isRoof`, `castShadow`, `receiveShadow`, and `paint` camouflage sampling).
 *   4. Replaces decorative static `PointLight` spam (10-13 lights/map) with soft warm volumetric lantern halos
 *      + ground light pools, keeping 1 central hero `PointLight` on mobile (2 on desktop) so every pixel runs
 *      90% fewer PBR BRDF light loops.
 *   5. Prunes redundant shadow casters (flat ground planes, meshes outside the +-43m shadow frustum, and
 *      sub-texel <22cm instanced micro-clutter whose backing wall/roof already casts a solid shadow) and
 *      freezes `matrixAutoUpdate = false` on static world hierarchies.
 */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CANON_MAT_CACHE = new Map();
let sharedGlowSpriteTex = null;
let sharedGlowPoolTex = null;

function ensureGlowTextures(THREE) {
  if (!sharedGlowSpriteTex && typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0.0, 'rgba(255, 252, 238, 0.95)');
    gr.addColorStop(0.22, 'rgba(255, 232, 185, 0.55)');
    gr.addColorStop(0.58, 'rgba(255, 205, 130, 0.16)');
    gr.addColorStop(1.0, 'rgba(255, 190, 110, 0.0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    sharedGlowSpriteTex = new THREE.CanvasTexture(cv);
    sharedGlowSpriteTex.colorSpace = THREE.SRGBColorSpace;
  }
  if (!sharedGlowPoolTex && typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0.0, 'rgba(255, 245, 215, 0.85)');
    gr.addColorStop(0.45, 'rgba(255, 215, 150, 0.36)');
    gr.addColorStop(1.0, 'rgba(255, 195, 120, 0.0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    sharedGlowPoolTex = new THREE.CanvasTexture(cv);
    sharedGlowPoolTex.colorSpace = THREE.SRGBColorSpace;
  }
}

function quant(v, step = 0.05) {
  return Math.round((Number(v) || 0) / step) * step;
}

function resolveRepeatableUnitMap(THREE, tex) {
  if (!tex || !tex.isTexture) return tex;
  if (
    tex.wrapS === THREE.RepeatWrapping &&
    tex.wrapT === THREE.RepeatWrapping &&
    Math.abs(tex.rotation || 0) < 1e-5 &&
    tex._unitBase
  ) {
    return tex._unitBase;
  }
  return tex;
}

/**
 * Resolves a lossless canonical vertex-color Material when `mat` is eligible for diffuse->vColor baking,
 * or deduplicates exact material signatures otherwise.
 */
export function resolveCanonicalMaterial(THREE, mat) {
  if (!mat || Array.isArray(mat)) return { mat, bakeColor: false };

  const progKey = typeof mat.customProgramCacheKey === 'function' ? (mat.customProgramCacheKey() || '') : '';
  const isDefaultOBC =
    !mat.onBeforeCompile ||
    mat.onBeforeCompile === THREE.Material.prototype.onBeforeCompile ||
    progKey === 'onBeforeCompile(){}';
  const isGreyShader = progKey.startsWith('storybook_grey|') || progKey.startsWith('greymap|');
  const hasCustomCompile = !isDefaultOBC && !isGreyShader;

  const hasEmissive = Boolean(mat.emissive && mat.emissive.getHex() !== 0 && (mat.emissiveIntensity ?? 1) > 0.001);
  const hasExtraMaps = Boolean(
    mat.emissiveMap || mat.normalMap || mat.bumpMap || mat.roughnessMap || mat.metalnessMap || mat.aoMap || mat.alphaMap
  );

  // Lossless diffuse -> vertex-color (`vColor`) + UV-repeat consolidation for matte Storybook Standard & Lambert materials
  const canBakeDiffuseToVCol =
    (mat.isMeshStandardMaterial || mat.isMeshLambertMaterial) &&
    !mat.transparent &&
    (mat.opacity ?? 1) >= 0.999 &&
    !(mat.alphaTest > 0) &&
    !hasEmissive &&
    !hasExtraMaps &&
    !hasCustomCompile;

  if (canBakeDiffuseToVCol) {
    const unitMap = resolveRepeatableUnitMap(THREE, mat.map);
    const mapSig = unitMap ? unitMap.uuid : 'nomap';
    const rawR = mat.roughness ?? 0.92;
    const rawM = mat.metalness ?? 0;
    const isMatteGouache = mat.isMeshStandardMaterial && rawR >= 0.80 && rawM <= 0.05;
    const canonR = isMatteGouache ? 0.92 : quant(rawR, 0.08);
    const canonM = isMatteGouache ? 0.0 : quant(rawM, 0.05);
    const rQuant = mat.isMeshStandardMaterial ? canonR.toFixed(2) : 'L';
    const mQuant = mat.isMeshStandardMaterial ? canonM.toFixed(2) : 'L';
    const key = `vcol|${mat.type}|${mapSig}|${progKey}|r:${rQuant}|m:${mQuant}|s:${mat.side}|f:${mat.flatShading ? 1 : 0}|fog:${mat.fog === false ? 0 : 1}`;
    let canon = CANON_MAT_CACHE.get(key);
    if (!canon) {
      canon = mat.clone();
      canon.color.setHex(0xffffff);
      canon.vertexColors = true;
      if (unitMap && canon.map !== unitMap) {
        canon.map = unitMap;
      }
      if (mat.isMeshStandardMaterial) {
        canon.roughness = canonR;
        canon.metalness = canonM;
      }
      if (isGreyShader && mat.onBeforeCompile) {
        canon.onBeforeCompile = mat.onBeforeCompile;
        canon.customProgramCacheKey = mat.customProgramCacheKey;
      }
      CANON_MAT_CACHE.set(key, canon);
    }
    return { mat: canon, bakeColor: true };
  }

  // Exact-match deduplication for emissive / window / special materials (excluding transparent animated ones)
  if (!mat.transparent && !hasCustomCompile && (mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshBasicMaterial)) {
    const mapSig = mat.map ? mat.map.uuid : 'nomap';
    const emHex = mat.emissive ? mat.emissive.getHexString() : '0';
    const emInt = quant(mat.emissiveIntensity ?? 1, 0.02).toFixed(2);
    const rQuant = mat.isMeshStandardMaterial ? quant(mat.roughness ?? 0.9, 0.05).toFixed(2) : 'x';
    const mQuant = mat.isMeshStandardMaterial ? quant(mat.metalness ?? 0, 0.05).toFixed(2) : 'x';
    const colHex = mat.color ? mat.color.getHexString() : 'ffffff';
    const key = `exact|${mat.type}|c:${colHex}|e:${emHex}|ei:${emInt}|${mapSig}|${progKey}|r:${rQuant}|m:${mQuant}|s:${mat.side}|vc:${mat.vertexColors ? 1 : 0}|f:${mat.flatShading ? 1 : 0}`;
    let canon = CANON_MAT_CACHE.get(key);
    if (!canon) {
      canon = mat;
      CANON_MAT_CACHE.set(key, canon);
    }
    return { mat: canon, bakeColor: false };
  }

  return { mat, bakeColor: false };
}

/**
 * Normalizes a cloned geometry into `targetInvMatrix * mesh.matrixWorld` space with matching
 * `['position', 'normal', 'uv']` (+ `'color'` when `wantVertexColors` is true).
 */
export function prepareGeometryForBatch(THREE, mesh, targetInvMatrix, wantVertexColors, bakeMaterialColor = wantVertexColors) {
  const srcGeo = mesh.geometry;
  if (!srcGeo || !srcGeo.attributes || !srcGeo.attributes.position) return null;

  // Copy into a plain BufferGeometry: srcGeo.clone() runs `new this.constructor()`, which for
  // RoundedBoxGeometry rebuilds a whole default rounded box (UVs and all) before copying over it —
  // that alone was ~0.9 s of every village build.
  let g = srcGeo.index ? srcGeo.toNonIndexed() : new THREE.BufferGeometry().copy(srcGeo);
  const vCount = g.attributes.position.count;
  if (vCount === 0) {
    g.dispose();
    return null;
  }

  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  if (!g.attributes.uv || g.attributes.uv.count !== vCount) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vCount * 2), 2));
  }

  const origMat = mesh.material;
  const origMap = origMat && origMat.map;
  if (
    origMap &&
    origMap._unitBase &&
    origMap !== origMap._unitBase &&
    origMap.wrapS === THREE.RepeatWrapping &&
    origMap.wrapT === THREE.RepeatWrapping &&
    Math.abs(origMap.rotation || 0) < 1e-5
  ) {
    const rx = origMap.repeat.x;
    const ry = origMap.repeat.y;
    const ox = origMap.offset.x;
    const oy = origMap.offset.y;
    if (rx !== 1 || ry !== 1 || ox !== 0 || oy !== 0) {
      const uvAttr = g.attributes.uv.clone();
      for (let i = 0; i < uvAttr.count; i++) {
        uvAttr.setXY(i, uvAttr.getX(i) * rx + ox, uvAttr.getY(i) * ry + oy);
      }
      g.setAttribute('uv', uvAttr);
    }
  }

  if (wantVertexColors) {
    const cr = (bakeMaterialColor && origMat.color) ? origMat.color.r : 1;
    const cg = (bakeMaterialColor && origMat.color) ? origMat.color.g : 1;
    const cb = (bakeMaterialColor && origMat.color) ? origMat.color.b : 1;
    const cols = new Float32Array(vCount * 3);
    const existingCol = origMat.vertexColors ? g.attributes.color : null;
    if (existingCol && existingCol.count === vCount) {
      for (let i = 0; i < vCount; i++) {
        cols[i * 3] = existingCol.getX(i) * cr;
        cols[i * 3 + 1] = existingCol.getY(i) * cg;
        cols[i * 3 + 2] = existingCol.getZ(i) * cb;
      }
    } else {
      for (let i = 0; i < vCount; i++) {
        cols[i * 3] = cr;
        cols[i * 3 + 1] = cg;
        cols[i * 3 + 2] = cb;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }

  const keepSet = wantVertexColors
    ? new Set(['position', 'normal', 'uv', 'color'])
    : new Set(['position', 'normal', 'uv']);
  for (const attrName of Object.keys(g.attributes)) {
    if (!keepSet.has(attrName)) {
      g.deleteAttribute(attrName);
    }
  }
  g.clearGroups();

  const rel = new THREE.Matrix4().multiplyMatrices(targetInvMatrix, mesh.matrixWorld);
  g.applyMatrix4(rel);
  return g;
}

function detectDynamicSubtrees(mapRoot, activeWorldUpdate, extraDynamicRoots = []) {
  const dynSet = new Set();
  const markSubtree = (obj) => {
    if (!obj || dynSet.has(obj)) return;
    obj.traverse((c) => dynSet.add(c));
  };

  for (const r of extraDynamicRoots) {
    if (r) markSubtree(r);
  }

  if (typeof activeWorldUpdate === 'function') {
    const snaps = [];
    mapRoot.traverse((o) => {
      snaps.push({
        o,
        px: o.position.x, py: o.position.y, pz: o.position.z,
        rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z,
        sx: o.scale.x, sy: o.scale.y, sz: o.scale.z,
        vis: o.visible,
      });
    });

    try {
      activeWorldUpdate(0.05, 1.37);
    } catch (_) {
      // Ignore probe errors
    }

    const eps = 1e-5;
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i];
      const o = s.o;
      const moved =
        Math.abs(o.position.x - s.px) > eps ||
        Math.abs(o.position.y - s.py) > eps ||
        Math.abs(o.position.z - s.pz) > eps ||
        Math.abs(o.rotation.x - s.rx) > eps ||
        Math.abs(o.rotation.y - s.ry) > eps ||
        Math.abs(o.rotation.z - s.rz) > eps ||
        Math.abs(o.scale.x - s.sx) > eps ||
        Math.abs(o.scale.y - s.sy) > eps ||
        Math.abs(o.scale.z - s.sz) > eps ||
        o.visible !== s.vis;
      if (moved) {
        markSubtree(o);
      }
      // Restore initial transform cleanly
      o.position.set(s.px, s.py, s.pz);
      o.rotation.set(s.rx, s.ry, s.rz);
      o.scale.set(s.sx, s.sy, s.sz);
      o.visible = s.vis;
    }

    try {
      activeWorldUpdate(0, 0);
    } catch (_) {
      // Ignore reset errors
    }
  }

  return dynSet;
}

function optimizePointLights(THREE, mapRoot, groundHeightAt, isMobile, roofRoots, disposableGeos, disposableMats) {
  const lights = [];
  mapRoot.updateMatrixWorld(true);
  mapRoot.traverse((o) => {
    if (o.isPointLight && o.visible && o.intensity > 0.05) {
      const wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      let roofAnc = null;
      for (let p = o.parent; p && p !== mapRoot; p = p.parent) {
        if (roofRoots && roofRoots.has(p)) {
          roofAnc = p;
          break;
        }
      }
      const centerScore = o.intensity * 10 - Math.hypot(wp.x, wp.z) * 0.25;
      lights.push({ light: o, wp, roofAnc, score: centerScore });
    }
  });

  const maxRealPointLights = isMobile ? 0 : 1;
  if (lights.length <= maxRealPointLights) return 0;

  lights.sort((a, b) => b.score - a.score);
  const toReplace = lights.slice(maxRealPointLights);

  ensureGlowTextures(THREE);
  const poolGeos = [];

  for (const item of toReplace) {
    const { light, wp, roofAnc } = item;
    const col = light.color ? light.color.clone() : new THREE.Color(0xffb45a);
    const dist = Math.max(4, light.distance || 8);
    const inten = Math.min(2.5, light.intensity || 1.2);

    // 1. Warm volumetric Storybook lantern aura sprite at exact light origin
    if (sharedGlowSpriteTex) {
      const spMat = new THREE.SpriteMaterial({
        map: sharedGlowSpriteTex,
        color: col,
        transparent: true,
        opacity: Math.min(0.24, 0.10 + inten * 0.055),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: true,
      });
      disposableMats.push(spMat);
      const sp = new THREE.Sprite(spMat);
      const haloSize = Math.min(2.8, Math.max(1.25, dist * 0.22));
      if (roofAnc) {
        const lp = roofAnc.worldToLocal(wp.clone());
        const rScale = roofAnc.getWorldScale(new THREE.Vector3()).x || 1;
        sp.position.copy(lp);
        sp.scale.set(haloSize / rScale, haloSize / rScale, 1);
        sp.renderOrder = 2;
        roofAnc.add(sp);
      } else {
        sp.position.copy(wp);
        sp.scale.set(haloSize, haloSize, 1);
        sp.renderOrder = 2;
        mapRoot.add(sp);
      }
    }

    // 2. Soft warm ground light-pool disc below outdoor/ground-floor lanterns
    if (!roofAnc && sharedGlowPoolTex && typeof groundHeightAt === 'function') {
      const gy = groundHeightAt(wp.x, wp.z, wp.y);
      if (wp.y - gy > 0.2 && wp.y - gy < dist * 0.95) {
        const poolR = Math.min(2.8, Math.max(1.2, dist * 0.24));
        const pg = new THREE.PlaneGeometry(poolR * 2, poolR * 2);
        pg.rotateX(-Math.PI / 2);
        pg.translate(wp.x, gy + 0.028, wp.z);
        const vCount = pg.attributes.position.count;
        const cols = new Float32Array(vCount * 3);
        const k = Math.min(0.22, 0.08 + inten * 0.05);
        for (let i = 0; i < vCount; i++) {
          cols[i * 3] = col.r * k;
          cols[i * 3 + 1] = col.g * k;
          cols[i * 3 + 2] = col.b * k;
        }
        pg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        poolGeos.push(pg);
      }
    }

    if (light.parent) {
      light.parent.remove(light);
    }
  }

  // Merge ALL ground light pools across the map into 1 single draw call!
  if (poolGeos.length > 0 && sharedGlowPoolTex) {
    const mergedPools = mergeGeometries(poolGeos, false);
    poolGeos.forEach((g) => g.dispose());
    if (mergedPools) {
      disposableGeos.push(mergedPools);
      const poolMat = new THREE.MeshBasicMaterial({
        map: sharedGlowPoolTex,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      });
      disposableMats.push(poolMat);
      const poolMesh = new THREE.Mesh(mergedPools, poolMat);
      poolMesh.name = 'baked_lantern_pools';
      poolMesh.renderOrder = 1;
      poolMesh.userData.noSolid = true;
      mapRoot.add(poolMesh);
    }
  }

  return toReplace.length;
}

function pruneRedundantShadowCasters(THREE, mapRoot, shadowExtent = 43, isMobile = false) {
  let pruned = 0;
  const wp = new THREE.Vector3();
  const ws = new THREE.Vector3();
  const lim = shadowExtent + 4.5;

  mapRoot.traverse((m) => {
    if (!m.isMesh || !m.castShadow) return;
    if (m.userData && m.userData.keepShadow) return;
    if (m.userData && m.userData.ground) {
      m.castShadow = false;
      pruned++;
      return;
    }
    m.getWorldPosition(wp);
    if (!m.isInstancedMesh && (Math.abs(wp.x) > lim || Math.abs(wp.z) > lim)) {
      m.castShadow = false;
      pruned++;
      return;
    }
    // Underground enclosed rooms sit below terrain and never receive direct overhead sunlight shadows
    if (!m.isInstancedMesh && wp.y < -1.1) {
      m.castShadow = false;
      pruned++;
      return;
    }
    if (m.geometry) {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const rawR = m.geometry.boundingSphere ? m.geometry.boundingSphere.radius : 1;
      m.getWorldScale(ws);
      const maxS = Math.max(Math.abs(ws.x), Math.abs(ws.y), Math.abs(ws.z), 0.01);
      const effR = rawR * maxS;
      if (m.isInstancedMesh) {
        // Instanced decor (shingles, thatch tufts, pebbles, moss, flowers, fence slats, cliff rocks) sit on shadow-casting masses
        if (effR < (isMobile ? 1.15 : 0.72) || (isMobile && m.count > 64)) {
          m.castShadow = false;
          pruned++;
        }
      } else if (!m.userData?.propRoot && effR < (isMobile ? 0.85 : 0.45)) {
        // Tiny wall trim, shutters, pebbles, tiny props — keeps hero architecture, trees, roofs & large props casting crisp shadows
        m.castShadow = false;
        pruned++;
      }
    }
  });
  return pruned;
}

function batchSubtreeContainer(THREE, container, eligibleMeshes, solidSet, solids, disposableGeos, opts = {}) {
  if (!eligibleMeshes.length) return 0;
  container.updateMatrixWorld(true);
  const invContainer = new THREE.Matrix4().copy(container.matrixWorld).invert();
  const useQuadrants = opts.useQuadrants !== false;
  const isRoofBatch = !!opts.isRoofBatch;

  const buckets = new Map();
  const deadMeshes = [];
  const wp = new THREE.Vector3();

  for (let i = 0; i < eligibleMeshes.length; i++) {
    const m = eligibleMeshes[i];
    const { mat: canonMat, bakeColor } = resolveCanonicalMaterial(THREE, m.material);
    const inSolids = solidSet.has(m);
    const isGround = Boolean(m.userData && m.userData.ground);
    const cast = Boolean(m.castShadow && !isGround);
    const recv = Boolean(m.receiveShadow);
    const key = `${canonMat.uuid}|s:${inSolids ? 1 : 0}|g:${isGround ? 1 : 0}|c:${cast ? 1 : 0}|r:${recv ? 1 : 0}`;

    const prepGeo = prepareGeometryForBatch(THREE, m, invContainer, Boolean(canonMat.vertexColors), bakeColor);
    if (!prepGeo) continue;

    m.getWorldPosition(wp);
    const quad = (wp.x >= 0 ? 1 : 0) + (wp.z >= 0 ? 2 : 0);

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        mat: canonMat,
        inSolids,
        isGround,
        cast,
        recv,
        samplePaint: m.userData?.paint || (m.material?.color ? m.material.color.clone() : null),
        totalVerts: 0,
        items: [],
      };
      buckets.set(key, bucket);
    }
    const vc = prepGeo.attributes.position.count;
    bucket.totalVerts += vc;
    bucket.items.push({ geo: prepGeo, quad });
    deadMeshes.push(m);
  }

  // Remove merged source meshes cleanly from scene & solids
  const deadSet = new Set(deadMeshes);
  if (deadSet.size > 0) {
    for (let i = solids.length - 1; i >= 0; i--) {
      if (deadSet.has(solids[i])) {
        solidSet.delete(solids[i]);
        solids.splice(i, 1);
      }
    }
    for (const m of deadMeshes) {
      if (m.parent) m.parent.remove(m);
    }
  }

  let createdCount = 0;
  for (const bucket of buckets.values()) {
    // Split large world buckets (> 10,000 verts) into 4 spatial quadrants so camera frustum culling stays razor-sharp!
    const groups = (useQuadrants && bucket.totalVerts > 10000 && bucket.items.length >= 4)
      ? [0, 1, 2, 3].map((q) => bucket.items.filter((it) => it.quad === q).map((it) => it.geo)).filter((arr) => arr.length > 0)
      : [bucket.items.map((it) => it.geo)];

    for (const geoList of groups) {
      const merged = geoList.length === 1 ? geoList[0] : mergeGeometries(geoList, false);
      if (geoList.length > 1) {
        geoList.forEach((g) => g.dispose());
      }
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      disposableGeos.push(merged);

      const batchMesh = new THREE.Mesh(merged, bucket.mat);
      batchMesh.name = isRoofBatch ? 'batched_roof' : 'batched_world';
      batchMesh.castShadow = bucket.cast;
      batchMesh.receiveShadow = bucket.recv;
      if (bucket.isGround) batchMesh.userData.ground = true;
      if (isRoofBatch) batchMesh.userData.isRoof = true;
      if (bucket.samplePaint) batchMesh.userData.paint = bucket.samplePaint;

      container.add(batchMesh);
      if (bucket.inSolids) {
        solids.push(batchMesh);
        solidSet.add(batchMesh);
      }
      createdCount++;
    }
  }

  return createdCount;
}

export function createWorldOptimizer(THREE) {
  const disposableGeos = [];
  const disposableMats = [];

  function disposePreviousWorldBatches() {
    while (disposableGeos.length) {
      const g = disposableGeos.pop();
      if (!g) continue;
      if (g.boundsTree && typeof g.disposeBoundsTree === 'function') {
        try { g.disposeBoundsTree(); } catch (_) {}
      }
      g.dispose();
    }
    while (disposableMats.length) {
      const m = disposableMats.pop();
      if (m && typeof m.dispose === 'function') m.dispose();
    }
  }

  function optimizeWorldScene({
    mapRoot,
    solids,
    ENTER = [],
    realProps = [],
    activeWorldUpdate = null,
    extraDynamicRoots = [],
    groundHeightAt = null,
    isMobile = false,
    shadowExtent = 42,
  }) {
    if (!mapRoot) return null;

    mapRoot.updateMatrixWorld(true);

    // 1. Identify all dynamic subtrees + interactive props + enterable roofs
    const propRoots = realProps.map((rp) => rp && rp.g).filter(Boolean);
    const dynSet = detectDynamicSubtrees(mapRoot, activeWorldUpdate, [...extraDynamicRoots, ...propRoots]);

    const roofRoots = new Set();
    const roofDescendants = new Map();
    for (const eb of ENTER) {
      if (eb && eb.roof) {
        roofRoots.add(eb.roof);
        const list = [];
        eb.roof.traverse((o) => {
          if (o !== eb.roof) list.push(o);
        });
        roofDescendants.set(eb.roof, new Set(list));
      }
    }

    // 2. Replace redundant PointLight spam with warm volumetric lantern sprites + ground light pools
    const replacedLights = optimizePointLights(
      THREE,
      mapRoot,
      groundHeightAt,
      isMobile,
      roofRoots,
      disposableGeos,
      disposableMats
    );

    // 3. Prune redundant shadow casters BEFORE batching (ground flats, underground caves, instanced clutter, tiny trim)
    const prunedShadows = pruneRedundantShadowCasters(THREE, mapRoot, shadowExtent, isMobile);

    // 4. Batch each enterable building's cutaway roof internally (preserving `eb.roof.visible` toggle!)
    const solidSet = new Set(solids);
    const isMeshEligible = (m, stopRoot) => {
      if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh) return false;
      if (dynSet.has(m) || m.userData?.propRoot || m.userData?.keep) return false;
      if (!m.visible || Array.isArray(m.material) || !m.material) return false;
      const mat = m.material;
      if (mat.transparent || (mat.opacity ?? 1) < 0.999 || (mat.alphaTest > 0) || mat.isShaderMaterial) return false;
      if (m.matrixWorld.determinant() <= 0) return false;
      for (let p = m.parent; p && p !== stopRoot; p = p.parent) {
        if (!p.visible || dynSet.has(p) || p.userData?.keep || p.userData?.propRoot) return false;
      }
      return true;
    };

    let roofBatches = 0;
    for (const [roofGrp] of roofDescendants.entries()) {
      const roofEligible = [];
      roofGrp.traverse((m) => {
        if (m !== roofGrp && isMeshEligible(m, roofGrp)) {
          roofEligible.push(m);
        }
      });
      if (roofEligible.length > 1) {
        roofBatches += batchSubtreeContainer(THREE, roofGrp, roofEligible, solidSet, solids, disposableGeos, {
          useQuadrants: false,
          isRoofBatch: true,
        });
      }
    }

    // 5. Batch all static outdoor & building-wall meshes across `mapRoot` into 4-quadrant frustum-cullable batches!
    const allRoofNodes = new Set();
    for (const [rg, desc] of roofDescendants.entries()) {
      allRoofNodes.add(rg);
      for (const d of desc) allRoofNodes.add(d);
    }

    const worldEligible = [];
    mapRoot.traverse((m) => {
      if (allRoofNodes.has(m)) return;
      if (isMeshEligible(m, mapRoot)) {
        worldEligible.push(m);
      }
    });

    const worldBatches = batchSubtreeContainer(THREE, mapRoot, worldEligible, solidSet, solids, disposableGeos, {
      useQuadrants: true,
      isRoofBatch: false,
    });

    // 6. Deduplicate materials on remaining unmerged props/instanced meshes & freeze static world matrices!
    mapRoot.updateMatrixWorld(true);
    let frozenMatrices = 0;
    mapRoot.traverse((o) => {
      if (o === mapRoot) return;
      if (o.isMesh && !o.isInstancedMesh && o.material && !Array.isArray(o.material) && !dynSet.has(o)) {
        const { mat: exactMat, bakeColor } = resolveCanonicalMaterial(THREE, o.material);
        if (!bakeColor && exactMat !== o.material) {
          o.material = exactMat;
        }
      }
      // Freeze matrixAutoUpdate on static meshes whose entire ancestor chain up to mapRoot is static
      if (o.isMesh && !dynSet.has(o) && !o.userData?.propRoot && !allRoofNodes.has(o)) {
        let ancestorDyn = false;
        for (let p = o.parent; p && p !== mapRoot; p = p.parent) {
          if (dynSet.has(p) || p.userData?.propRoot) {
            ancestorDyn = true;
            break;
          }
        }
        if (!ancestorDyn) {
          o.matrixAutoUpdate = false;
          frozenMatrices++;
        }
      }
    });

    console.log(
      `[perf:world] batched ${worldEligible.length} static meshes -> ${worldBatches} chunks (+${roofBatches} roof batches) · replaced ${replacedLights} PointLights · pruned ${prunedShadows} shadow casters · froze ${frozenMatrices} matrices`
    );

    return {
      mergedSourceMeshes: worldEligible.length,
      worldBatches,
      roofBatches,
      replacedLights,
      prunedShadows,
      frozenMatrices,
    };
  }

  return {
    optimizeWorldScene,
    disposePreviousWorldBatches,
  };
}
