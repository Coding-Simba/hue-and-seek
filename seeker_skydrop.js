/* Hue & Seek — Storybook Seeker Sky-Drop Intro System (seeker_skydrop.js)
 * Replaces the static Seeker blindfold screen during the 12s `G.phase === 'ready'` prep phase:
 * All 5 Seekers (local player + 4 AI teammates) sky-drop from high in the sunlit clouds under
 * handcrafted Storybook striped canvas-and-bentwood parachutes with interactive mid-air
 * steering, panoramic bird's-eye map overview, and fairness cloaking on scrambling Hiders.
 */

export const STORYBOOK_PARACHUTE_ACCENTS = [
  0x4ea8de, // 0: Sky Blue (Local Player)
  0xee7b59, // 1: Coral
  0x6ab859, // 2: Meadow Green
  0xf4b942, // 3: Warm Amber
  0x9b87d8, // 4: Soft Lavender
];

const CREAM_HEX = 0xfff6e3;
const WOOD_HEX = 0x8f5936;
const WOOD_LIGHT_HEX = 0xb57a4c;
const ROPE_HEX = 0xf0e3c8;

const PI = Math.PI;
const TAU = PI * 2;

const _sharedByThree = new WeakMap();

function normAng(a) {
  while (a > PI) a -= TAU;
  while (a < -PI) a += TAU;
  return a;
}

function lerpAngle(a, b, t) {
  return a + normAng(b - a) * t;
}

function smoothstep01(x) {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

// Concatenate indexed or non-indexed BufferGeometries into one single BufferGeometry (zero external deps)
function concatBufferGeometries(THREE, geos) {
  const nonIdx = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let totalVerts = 0;
  let hasColor = false;
  for (const g of nonIdx) {
    if (!g.attributes.normal) g.computeVertexNormals();
    totalVerts += g.attributes.position.count;
    if (g.attributes.color) hasColor = true;
  }
  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const colArr = hasColor ? new Float32Array(totalVerts * 3) : null;

  let offset = 0;
  for (const g of nonIdx) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const c = g.attributes.color;
    const cnt = p.count;
    posArr.set(p.array.subarray(0, cnt * 3), offset * 3);
    normArr.set(n.array.subarray(0, cnt * 3), offset * 3);
    if (colArr) {
      if (c) {
        colArr.set(c.array.subarray(0, cnt * 3), offset * 3);
      } else {
        colArr.fill(1, offset * 3, (offset + cnt) * 3);
      }
    }
    offset += cnt;
    if (geos.indexOf(g) === -1) g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  if (colArr) out.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  out.computeBoundingSphere();
  return out;
}

function buildGoreSetGeometry(THREE, segIndices, totalSegs, radius, rimY, domeH) {
  const uSteps = 6;
  const vSteps = 8;
  const geos = [];

  for (const segIdx of segIndices) {
    const th0 = (segIdx / totalSegs) * TAU;
    const th1 = ((segIdx + 1) / totalSegs) * TAU;
    const vertsPerRow = uSteps + 1;
    const vertCount = (vSteps + 1) * vertsPerRow;
    const pos = new Float32Array(vertCount * 3);
    const col = new Float32Array(vertCount * 3);
    const indices = [];

    let vi = 0;
    for (let iv = 0; iv <= vSteps; iv++) {
      const v = iv / vSteps;
      const phi = v * PI * 0.5;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      for (let iu = 0; iu <= uSteps; iu++) {
        const u = iu / uSteps;
        const th = th0 + (th1 - th0) * u;
        const seamArch = Math.sin(u * PI);
        // Billowy Storybook canvas pillowing between bentwood ribs + scalloped rim hem
        const puff = seamArch * Math.cos(phi * 0.92) * 0.068;
        const hemDip = -seamArch * (1 - v) * (1 - v) * 0.042;
        const r = Math.max(0.001, (radius + puff) * cosPhi);

        const x = r * Math.sin(th);
        const z = r * Math.cos(th);
        const y = rimY + domeH * sinPhi + puff * 0.36 + hemDip;

        pos[vi * 3] = x;
        pos[vi * 3 + 1] = y;
        pos[vi * 3 + 2] = z;

        // Soft painterly sun-kissed crown & gentle rib-seam shading
        const shade = 0.91 + 0.06 * v + 0.05 * seamArch;
        col[vi * 3] = shade;
        col[vi * 3 + 1] = shade * 0.995;
        col[vi * 3 + 2] = shade * 0.985;
        vi++;
      }
    }

    for (let iv = 0; iv < vSteps; iv++) {
      for (let iu = 0; iu < uSteps; iu++) {
        const a = iv * vertsPerRow + iu;
        const b = a + 1;
        const c = a + vertsPerRow;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    geos.push(g);
  }

  const merged = concatBufferGeometries(THREE, geos);
  for (const g of geos) g.dispose();
  return merged;
}

function makeTubeSegmentGeo(THREE, ax, ay, az, bx, by, bz, rTop, rBot, radialSegs = 6) {
  const va = new THREE.Vector3(ax, ay, az);
  const vb = new THREE.Vector3(bx, by, bz);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rTop, rBot, len, radialSegs, 1, false);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

function buildStreamerSegmentGeo(THREE, width0, width1, length, swallowtail = false) {
  // Extends from z = 0 backward to z = -length so rotating X/Y flutters naturally
  const pos = swallowtail
    ? new Float32Array([
        -width0 * 0.5, 0, 0,
        width0 * 0.5, 0, 0,
        width1 * 0.55, 0, -length,
        0, 0, -length * 0.72,
        -width1 * 0.55, 0, -length,
      ])
    : new Float32Array([
        -width0 * 0.5, 0, 0,
        width0 * 0.5, 0, 0,
        width1 * 0.5, 0, -length,
        -width1 * 0.5, 0, -length,
      ]);

  const idx = swallowtail
    ? [0, 1, 3, 1, 2, 3, 0, 3, 4]
    : [0, 1, 2, 0, 2, 3];

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function getSharedParachuteAssets(THREE) {
  let cached = _sharedByThree.get(THREE);
  if (cached) return cached;

  const RIM_R = 1.45;
  const RIM_Y = 0.44;
  const DOME_H = 0.88;
  const TOTAL_SEGS = 12;

  // 1. Alternating Cream & Accent Striped Dome Canopy Geometries
  const creamGoreGeo = buildGoreSetGeometry(THREE, [0, 2, 4, 6, 8, 10], TOTAL_SEGS, RIM_R, RIM_Y, DOME_H);
  const accentGoreGeo = buildGoreSetGeometry(THREE, [1, 3, 5, 7, 9, 11], TOTAL_SEGS, RIM_R, RIM_Y, DOME_H);

  // 2. Handcrafted Bent-Wood Rim Ring, Crown Vent Ring, Turned Wooden Finial Cap & Spreader Bar
  const woodParts = [];
  const rimTorus = new THREE.TorusGeometry(RIM_R, 0.034, 8, 40);
  rimTorus.rotateX(PI * 0.5);
  rimTorus.translate(0, RIM_Y, 0);
  woodParts.push(rimTorus);

  // 6 bentwood structural ribs hugging the canopy seams
  for (let k = 0; k < 6; k++) {
    const th = (k / 6) * TAU;
    const sinT = Math.sin(th);
    const cosT = Math.cos(th);
    const ribSegs = 5;
    for (let s = 0; s < ribSegs; s++) {
      const p0 = (s / ribSegs) * PI * 0.5;
      const p1 = ((s + 1) / ribSegs) * PI * 0.5;
      const r0 = (RIM_R + 0.012) * Math.cos(p0);
      const y0 = RIM_Y + (DOME_H + 0.012) * Math.sin(p0);
      const r1 = (RIM_R + 0.012) * Math.cos(p1);
      const y1 = RIM_Y + (DOME_H + 0.012) * Math.sin(p1);
      woodParts.push(makeTubeSegmentGeo(THREE, r0 * sinT, y0, r0 * cosT, r1 * sinT, y1, r1 * cosT, 0.014, 0.016, 5));
    }
  }

  // Crown wooden collar + turned acorn finial cap at top of dome
  const apexY = RIM_Y + DOME_H;
  const collar = new THREE.CylinderGeometry(0.14, 0.19, 0.07, 14);
  collar.translate(0, apexY + 0.02, 0);
  woodParts.push(collar);

  const finialBulb = new THREE.SphereGeometry(0.095, 12, 10);
  finialBulb.scale(1, 1.18, 1);
  finialBulb.translate(0, apexY + 0.11, 0);
  woodParts.push(finialBulb);

  const finialSpire = new THREE.ConeGeometry(0.048, 0.13, 10);
  finialSpire.translate(0, apexY + 0.22, 0);
  woodParts.push(finialSpire);

  // Harness wooden spreader bar & twin hand-grip bars (aligns with raised Seeker hands at y ≈ 1.49m!)
  const gripY = -0.46;
  const crossBar = makeTubeSegmentGeo(THREE, -0.28, gripY, 0.04, 0.28, gripY, 0.04, 0.021, 0.021, 8);
  woodParts.push(crossBar);
  for (const sx of [-1, 1]) {
    const sideGrip = makeTubeSegmentGeo(THREE, sx * 0.25, gripY, -0.07, sx * 0.25, gripY, 0.14, 0.022, 0.022, 8);
    woodParts.push(sideGrip);
    const knob = new THREE.SphereGeometry(0.034, 8, 6);
    knob.translate(sx * 0.29, gripY, 0.04);
    woodParts.push(knob);
  }

  const woodFrameGeo = concatBufferGeometries(THREE, woodParts);
  for (const gp of woodParts) gp.dispose();

  // 3. 4 Crisp Cord Risers + Shoulder Harness Straps (CylinderGeometry thin lines)
  const cordParts = [];
  const riserAnchors = [
    // [rimX, rimY, rimZ, gripX, gripY, gripZ]
    [-0.96, RIM_Y - 0.01, 0.98, -0.25, gripY, 0.11],
    [-1.02, RIM_Y - 0.01, -0.92, -0.25, gripY, -0.04],
    [0.96, RIM_Y - 0.01, 0.98, 0.25, gripY, 0.11],
    [1.02, RIM_Y - 0.01, -0.92, 0.25, gripY, -0.04],
  ];
  for (const [x0, y0, z0, x1, y1, z1] of riserAnchors) {
    cordParts.push(makeTubeSegmentGeo(THREE, x0, y0, z0, x1, y1, z1, 0.013, 0.011, 6));
  }
  // Auxiliary mid-canopy stabilizing cords + shoulder harness lines down to y = -0.86 (shoulder height 1.09m)
  for (const sx of [-1, 1]) {
    cordParts.push(makeTubeSegmentGeo(THREE, sx * 1.42, RIM_Y - 0.01, 0.04, sx * 0.25, gripY, 0.04, 0.010, 0.010, 5));
    cordParts.push(makeTubeSegmentGeo(THREE, sx * 0.25, gripY, 0.03, sx * 0.19, -0.86, 0.01, 0.013, 0.012, 6));
  }
  const cordRisersGeo = concatBufferGeometries(THREE, cordParts);
  for (const cp of cordParts) cp.dispose();

  // 4. Articulated Wind Streamer Geometries (3 segments per ribbon)
  const streamerGeo0 = buildStreamerSegmentGeo(THREE, 0.125, 0.105, 0.52, false);
  const streamerGeo1 = buildStreamerSegmentGeo(THREE, 0.105, 0.088, 0.48, false);
  const streamerGeo2 = buildStreamerSegmentGeo(THREE, 0.088, 0.072, 0.46, true);

  // 5. Wind-Streak & Sunlit Cloud Puff Geometries for the Descent Particle Ring
  const streakGeo = new THREE.CylinderGeometry(0.008, 0.026, 2.7, 5, 1, true);
  const wispParts = [];
  const w0 = new THREE.SphereGeometry(0.55, 8, 6);
  w0.scale(1.35, 0.36, 0.85);
  wispParts.push(w0);
  const w1 = new THREE.SphereGeometry(0.42, 8, 6);
  w1.scale(1.15, 0.34, 0.8);
  w1.translate(0.46, -0.03, 0.08);
  wispParts.push(w1);
  const w2 = new THREE.SphereGeometry(0.38, 8, 6);
  w2.scale(1.1, 0.32, 0.78);
  w2.translate(-0.44, -0.04, -0.06);
  wispParts.push(w2);
  const cloudWispGeo = concatBufferGeometries(THREE, wispParts);
  for (const wp of wispParts) wp.dispose();

  // 6. Shared Materials (metalness: 0 for warm painterly Storybook lighting)
  const creamMat = new THREE.MeshStandardMaterial({
    color: CREAM_HEX,
    vertexColors: true,
    roughness: 0.84,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const creamRibbonMat = new THREE.MeshStandardMaterial({
    color: CREAM_HEX,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: WOOD_HEX,
    emissive: WOOD_LIGHT_HEX,
    emissiveIntensity: 0.06,
    roughness: 0.78,
    metalness: 0,
  });
  const ropeMat = new THREE.MeshStandardMaterial({
    color: ROPE_HEX,
    roughness: 0.88,
    metalness: 0,
  });

  const accentMats = new Map();
  const accentRibbonMats = new Map();

  const getAccentMat = (hex) => {
    const key = typeof hex === 'number' ? hex : new THREE.Color(hex).getHex();
    if (!accentMats.has(key)) {
      accentMats.set(
        key,
        new THREE.MeshStandardMaterial({
          color: key,
          vertexColors: true,
          roughness: 0.80,
          metalness: 0,
          side: THREE.DoubleSide,
        })
      );
    }
    return accentMats.get(key);
  };

  const getAccentRibbonMat = (hex) => {
    const key = typeof hex === 'number' ? hex : new THREE.Color(hex).getHex();
    if (!accentRibbonMats.has(key)) {
      accentRibbonMats.set(
        key,
        new THREE.MeshStandardMaterial({
          color: key,
          roughness: 0.78,
          metalness: 0,
          side: THREE.DoubleSide,
        })
      );
    }
    return accentRibbonMats.get(key);
  };

  cached = {
    RIM_R,
    RIM_Y,
    DOME_H,
    creamGoreGeo,
    accentGoreGeo,
    woodFrameGeo,
    cordRisersGeo,
    streamerGeo0,
    streamerGeo1,
    streamerGeo2,
    streakGeo,
    cloudWispGeo,
    creamMat,
    creamRibbonMat,
    woodMat,
    ropeMat,
    getAccentMat,
    getAccentRibbonMat,
  };
  _sharedByThree.set(THREE, cached);
  return cached;
}

/**
 * Handcrafted Storybook 3D Parachute / Glider Mesh.
 * Origin sits at `y ≈ 1.95` local on the Seeker so the 4 cord risers meet the Seeker's raised hands
 * while the striped canvas dome floats cleanly above their head & nameplate.
 */
export function buildStorybookParachute(THREE, accentHex = STORYBOOK_PARACHUTE_ACCENTS[0]) {
  const S = getSharedParachuteAssets(THREE);
  const root = new THREE.Group();
  root.name = 'storybookParachute';
  root.position.set(0, 1.95, 0);

  const canopyCream = new THREE.Mesh(S.creamGoreGeo, S.creamMat);
  canopyCream.castShadow = true;
  canopyCream.receiveShadow = false;
  canopyCream.userData.noSolid = true;
  root.add(canopyCream);

  const canopyAccent = new THREE.Mesh(S.accentGoreGeo, S.getAccentMat(accentHex));
  canopyAccent.castShadow = true;
  canopyAccent.receiveShadow = false;
  canopyAccent.userData.noSolid = true;
  root.add(canopyAccent);

  const woodFrame = new THREE.Mesh(S.woodFrameGeo, S.woodMat);
  woodFrame.castShadow = true;
  woodFrame.receiveShadow = false;
  woodFrame.userData.noSolid = true;
  root.add(woodFrame);

  const cordRisers = new THREE.Mesh(S.cordRisersGeo, S.ropeMat);
  cordRisers.castShadow = false;
  cordRisers.receiveShadow = false;
  cordRisers.userData.noSolid = true;
  root.add(cordRisers);

  // 2 Fluttering Wind Ribbons / Streamers trailing from the back (-Z) of the bentwood rim
  const streamers = [];
  const ribbonAccentMat = S.getAccentRibbonMat(accentHex);
  for (const side of [-1, 1]) {
    const anchor = new THREE.Group();
    anchor.position.set(side * 0.56, S.RIM_Y + 0.01, -1.33);
    root.add(anchor);

    const seg0 = new THREE.Mesh(S.streamerGeo0, ribbonAccentMat);
    seg0.castShadow = false;
    seg0.userData.noSolid = true;
    anchor.add(seg0);

    const piv1 = new THREE.Group();
    piv1.position.set(0, 0, -0.50);
    seg0.add(piv1);

    const seg1 = new THREE.Mesh(S.streamerGeo1, S.creamRibbonMat);
    seg1.castShadow = false;
    seg1.userData.noSolid = true;
    piv1.add(seg1);

    const piv2 = new THREE.Group();
    piv2.position.set(0, 0, -0.46);
    seg1.add(piv2);

    const seg2 = new THREE.Mesh(S.streamerGeo2, ribbonAccentMat);
    seg2.castShadow = false;
    seg2.userData.noSolid = true;
    piv2.add(seg2);

    streamers.push({ side, anchor, seg0, piv1, piv2 });
  }

  root.userData = {
    noSolid: true,
    accentHex,
    canopyAccent,
    streamers,
    setAccent(nextHex) {
      root.userData.accentHex = nextHex;
      canopyAccent.material = S.getAccentMat(nextHex);
      const nextRibMat = S.getAccentRibbonMat(nextHex);
      for (const st of streamers) {
        st.seg0.material = nextRibMat;
        st.piv2.children[0].material = nextRibMat;
      }
    },
  };

  return root;
}

export function createSeekerSkyDropManager(env = {}) {
  const { THREE, scene, camera, G, input } = env;
  const clamp = env.clamp || ((v, a, b) => (v < a ? a : v > b ? b : v));
  const lerp = env.lerp || ((a, b, t) => a + (b - a) * t);
  const rand = env.rand || ((a, b) => a + Math.random() * (b - a));

  const getGroundY = (x, z, refY) =>
    typeof env.groundHeightAt === 'function' ? env.groundHeightAt(x, z, refY) : 0;

  const getSafeSpawn = (x, z, r = 0.52, avoid = [], minSep = 1.32) =>
    typeof env.findSafeSpawn === 'function'
      ? env.findSafeSpawn(x, z, r, avoid, minSep)
      : new THREE.Vector3(x, getGroundY(x, z), z);

  // Reusable pool of 5 Storybook Parachutes (zero per-round mesh allocation or GC!)
  const parachutePool = [];
  function acquireParachute(slotIndex) {
    const accent = STORYBOOK_PARACHUTE_ACCENTS[slotIndex % STORYBOOK_PARACHUTE_ACCENTS.length];
    let para = parachutePool[slotIndex];
    if (!para) {
      para = buildStorybookParachute(THREE, accent);
      parachutePool[slotIndex] = para;
    } else if (para.userData && para.userData.accentHex !== accent) {
      para.userData.setAccent(accent);
    }
    para.visible = true;
    para.position.set(0, 1.95, 0);
    para.rotation.set(0, 0, 0);
    para.scale.set(1, 1, 1);
    return para;
  }

  // Reusable Wind-Streak & Sunlit Cloud Puff Ring (20 pooled particles around descending squad)
  const WIND_COUNT = 20;
  let windGroup = null;
  const windParticles = [];

  function ensureWindRing() {
    if (windGroup || !THREE || !scene) return;
    const S = getSharedParachuteAssets(THREE);
    windGroup = new THREE.Group();
    windGroup.name = 'seekerSkyDropWindRing';
    windGroup.visible = false;
    scene.add(windGroup);

    for (let i = 0; i < WIND_COUNT; i++) {
      const isCloud = i % 3 === 0; // 7 soft sunlit cloud wisps + 13 vertical wind streaks
      const mat = new THREE.MeshBasicMaterial({
        color: isCloud ? 0xfffcf2 : 0xeef8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(isCloud ? S.cloudWispGeo : S.streakGeo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      mesh.userData.noSolid = true;
      windGroup.add(mesh);

      const ang = (i / WIND_COUNT) * TAU + (i % 2) * 0.23;
      const rad = isCloud ? 4.8 + (i % 5) * 2.1 : 2.9 + (i % 6) * 1.65;
      windParticles.push({
        mesh,
        mat,
        isCloud,
        ang,
        rad,
        relY: -9.5 + (i / WIND_COUNT) * 20.0,
        riseSpd: isCloud ? 5.2 + (i % 4) * 0.9 : 9.4 + (i % 5) * 1.4,
        rotY: (i * 1.7) % TAU,
        peakOpacity: isCloud ? 0.23 : 0.31,
        baseScale: isCloud ? 0.85 + (i % 3) * 0.28 : 0.85 + (i % 4) * 0.2,
      });
    }
  }

  function resetWindRingPositions(cx, cy, cz) {
    ensureWindRing();
    if (!windGroup) return;
    windGroup.visible = true;
    for (let i = 0; i < windParticles.length; i++) {
      const wp = windParticles[i];
      wp.relY = -9.5 + (i / windParticles.length) * 20.0;
      const wx = cx + Math.cos(wp.ang) * wp.rad;
      const wz = cz + Math.sin(wp.ang) * wp.rad;
      wp.mesh.position.set(wx, cy + wp.relY, wz);
      wp.mesh.rotation.set(0, wp.rotY, 0);
      wp.mesh.scale.setScalar(wp.baseScale);
      wp.mat.opacity = 0;
    }
  }

  // Live Sky-Drop State
  let skyDropActive = false;
  let totalDuration = 12;
  let activeMapRadius = 30;
  let currentProg = 0;
  let elapsedSec = 0;
  let seekerSlots = [];
  let cloakedHiders = [];
  let savedFog = null;
  let savedGun = null;

  // Bot-Only Sky-Drop State (Hide Mode: 5 AI Seekers parachute into spread-out sectors)
  let botDropActive = false;
  let botDropPrepDuration = 20;
  let botDropMapRadius = 40;
  let botDropSlots = [];

  // Scratch math objects (zero per-frame allocations)
  const _qChase = THREE ? new THREE.Quaternion() : null;
  const _qFp = THREE ? new THREE.Quaternion() : null;
  const _mLook = THREE ? new THREE.Matrix4() : null;
  const _euTmp = THREE ? new THREE.Euler(0, 0, 0, 'YXZ') : null;
  const _vEye = THREE ? new THREE.Vector3() : null;
  const _vLook = THREE ? new THREE.Vector3() : null;
  const _vUp = THREE ? new THREE.Vector3(0, 1, 0) : null;

  function computeAltFactor(prog) {
    const p = clamp(prog, 0, 1);
    if (p <= 0.85) {
      return Math.pow(1 - p, 1.18);
    }
    // Smooth C1 Hermite parachute flare in final 15% (prog = 0.85..1.0):
    // Matches value & slope of (1 - p)^1.18 at p = 0.85 and cushions vertical touchdown speed by 5.4x!
    const f0 = Math.pow(0.15, 1.18);
    const u = clamp((p - 0.85) / 0.15, 0, 1);
    const flarePoly = 0.60 * u * u * u - 0.42 * u * u - 1.18 * u + 1.0;
    return Math.max(0, f0 * flarePoly);
  }

  function applyHiderCloak() {
    if (!G) return;
    const list = [...(G.hiders || []), ...(G.allHiders || [])];
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      if (!h) continue;
      if (cloakedHiders.indexOf(h) === -1) cloakedHiders.push(h);
      h.visible = false;
      if (h.userData) {
        if (h.userData.cosmeticHat) h.userData.cosmeticHat.visible = false;
        if (h.userData.ai && h.userData.ai.mark) h.userData.ai.mark.visible = false;
      }
    }
  }

  function releaseHiderCloak() {
    const set = new Set([...cloakedHiders, ...((G && G.hiders) || []), ...((G && G.allHiders) || [])]);
    for (const h of set) {
      if (!h) continue;
      const elim = !!(h.userData && h.userData.actor && h.userData.actor.eliminated);
      if (!elim) h.visible = true;
      if (h.userData && h.userData.cosmeticHat) {
        const disguised = Boolean(h.userData.propId || h.userData.specialMode);
        h.userData.cosmeticHat.visible = !disguised;
      }
    }
    cloakedHiders.length = 0;
  }

  function installParachutePoseWrapper(seeker, slot) {
    const u = seeker.userData;
    if (!u) return;
    const origAnimate = typeof u.animate === 'function' ? u.animate : null;
    slot.origAnimate = origAnimate;

    // Open Seeker's eyes wide so they gaze down in wonder at the Storybook village below
    if (Array.isArray(u.open)) u.open.forEach((m) => { m.visible = true; });
    if (Array.isArray(u.closed)) u.closed.forEach((m) => { m.visible = false; });

    u.animate = (dt) => {
      if (origAnimate) origAnimate(dt, false, 0);
      if (!skyDropActive && !botDropActive) return;

      const rig = u.rig;
      const t = elapsedSec;
      const ph = slot.phaseOff;
      const slotProg = typeof slot.prog === 'number' ? slot.prog : currentProg;
      const flareK = smoothstep01((slotProg - 0.85) / 0.15);
      const settleK = 1 - smoothstep01((slotProg - 0.94) / 0.06);

      if (rig) {
        // Untwist torso & breathe gently in harness
        if (rig.torso) {
          rig.torso.rotation.set(
            (0.05 - flareK * 0.10) * settleK,
            Math.sin(t * 1.35 + ph) * 0.06 * settleK,
            slot.roll * -0.18 * settleK
          );
        }
        // Cute dangling & bicycle-kicking rainboots in the breeze, extending forward for flare landing!
        const kick = Math.sin(t * 4.4 + ph) * 0.26 * (1 - flareK * 0.65) * settleK;
        const flareLeg = -0.22 * flareK * settleK;
        if (rig.legL) {
          rig.legL.rotation.set(0.16 * settleK + kick + flareLeg, 0, 0.055 * settleK);
        }
        if (rig.legR) {
          rig.legR.rotation.set(0.16 * settleK - kick + flareLeg, 0, -0.055 * settleK);
        }
        // Peer curiously down at the village rooftops & courtyards
        if (rig.head) {
          rig.head.rotation.set(
            (0.28 + Math.sin(t * 1.6 + ph) * 0.05) * settleK,
            Math.sin(t * 0.95 + ph * 1.3) * 0.20 * settleK,
            Math.cos(t * 1.2 + ph) * 0.04 * settleK
          );
        }
        // Sling water blaster neatly across back while hands hold overhead parachute grips
        if (rig.weapon && settleK > 0.05) {
          rig.weapon.position.set(0.03, 0.25, -0.19);
          rig.weapon.rotation.set(0.34, 1.32, -0.66);
          rig.weapon.updateMatrix();
        }
        // Raise both arms overhead so hands grip the wooden spreader handles at (±0.25, 1.49m, +0.06)
        const armRaise = settleK;
        if (rig.upperL && armRaise > 0.02) {
          const swayL = Math.sin(t * 2.3 + ph) * 0.04;
          rig.upperL.rotation.set((-2.82 + swayL) * armRaise, 0, 0.18 * armRaise);
          if (rig.foreL) rig.foreL.rotation.set(0.24 * armRaise, 0, -0.08 * armRaise);
        }
        if (rig.upperR && armRaise > 0.02) {
          const swayR = Math.cos(t * 2.3 + ph) * 0.04;
          rig.upperR.rotation.set((-2.82 + swayR) * armRaise, 0, -0.18 * armRaise);
          if (rig.foreR) rig.foreR.rotation.set(0.24 * armRaise, 0, 0.08 * armRaise);
        }
      }
    };
  }

  function restoreSeekerRig(slot) {
    const s = slot.char;
    if (!s) return;
    const u = s.userData || {};
    if (slot.origAnimate !== undefined) {
      u.animate = slot.origAnimate;
      slot.origAnimate = undefined;
      if (typeof u.animate === 'function') u.animate(0, false, 0);
    }
    s.rotation.order = slot.origRotOrder || 'XYZ';
    s.rotation.x = 0;
    s.rotation.z = 0;
  }

  function updateParachuteVisuals(slot, dt, tSec, flareU) {
    const para = slot.para;
    if (!para) return;
    const ph = slot.phaseOff;
    const airSpd = Math.hypot(slot.vx || 0, slot.vz || 0);

    // Subtle secondary canopy lag & flare inflation cushion
    const targetCanopyRoll = clamp(-slot.roll * 0.35 + Math.sin(tSec * 2.1 + ph) * 0.038, -0.25, 0.25);
    const targetCanopyPitch = clamp(-slot.pitch * 0.28 + Math.cos(tSec * 1.7 + ph) * 0.032 - flareU * 0.08, -0.24, 0.24);
    const k = Math.min(1, dt * 7.5);
    para.rotation.z = lerp(para.rotation.z, targetCanopyRoll, k);
    para.rotation.x = lerp(para.rotation.x, targetCanopyPitch, k);

    // Gentle canopy breathing + flare spread in final 15%
    const flareSpread = Math.sin(flareU * PI) * 0.085;
    const breath = Math.sin(tSec * 3.1 + ph) * 0.016;
    const sxz = 1 + breath + flareSpread;
    const sy = 1 - breath * 0.6 - flareSpread * 0.35;
    para.scale.set(sxz, sy, sxz);

    // In final 6% touchdown swoop on local player, float canopy slightly higher so it never enters 1st-person FOV
    if (slot.isPlayer && currentProg > 0.92) {
      const liftK = smoothstep01((currentProg - 0.92) / 0.08);
      para.position.y = 1.95 + liftK * 0.85;
    } else {
      para.position.y = 1.95;
    }

    // Animate the 2 articulated trailing wind streamers
    const streamers = para.userData && para.userData.streamers;
    if (streamers) {
      const flutterFreq = 6.2 + Math.min(5.0, airSpd * 0.85);
      const w = tSec * flutterFreq + ph * 2.0;
      const bankBias = clamp(slot.roll * 0.65, -0.35, 0.35);
      for (let i = 0; i < streamers.length; i++) {
        const st = streamers[i];
        const sOff = i * 0.9;
        // Relative airflow rushes upward (+Y) & backward (-Z) past descending canopy
        st.seg0.rotation.x = 0.34 + Math.sin(w + sOff) * 0.20 - flareU * 0.14;
        st.seg0.rotation.y = st.side * 0.12 + Math.cos(w * 0.82 + sOff) * 0.15 + bankBias;
        st.seg0.rotation.z = st.side * 0.08 + Math.sin(w * 0.65 + sOff) * 0.10;

        st.piv1.rotation.x = Math.sin(w - 1.15 + sOff) * 0.32;
        st.piv1.rotation.y = Math.cos(w * 0.82 - 1.05 + sOff) * 0.24;

        st.piv2.rotation.x = Math.sin(w - 2.30 + sOff) * 0.42;
        st.piv2.rotation.y = Math.cos(w * 0.82 - 2.10 + sOff) * 0.30;
      }
    }
  }

  function updateCamera(dt = 0.016) {
    if (!skyDropActive || !camera || !G || !G.player) return;

    const p = G.player;
    const pSlot = seekerSlots[0];
    const prog = currentProg;
    const eyeHeight = 1.55;
    const footY = p.position.y;
    const eyeY = footY + eyeHeight;

    // Stage 1 (prog < 0.35): Grand Map Overview -> Stage 2 (0.35..0.92): Interactive 3rd-Person Glider Chase
    const s1 = clamp(prog / 0.35, 0, 1);
    const ease1 = smoothstep01(s1);
    const s2 = clamp((prog - 0.35) / 0.57, 0, 1);

    const camDist = prog < 0.35
      ? lerp(13.5, 6.8, s1)
      : lerp(6.8, 4.75, smoothstep01(s2));

    // Smoothly clamp pitch during aerial view; ease into grounded [-0.35, 0.2] during final 0.08 blend
    G.pitch = clamp(G.pitch, -1.08, 0.45);
    const fpRaw = clamp((prog - 0.92) / 0.08, 0, 1);
    const fpBlend = smoothstep01(fpRaw);
    if (fpRaw > 0) {
      const groundedPitch = clamp(G.pitch, -0.35, 0.2);
      G.pitch = lerp(G.pitch, groundedPitch, Math.min(1, fpBlend * (0.28 + dt * 14)));
    }

    const stage1HeightOffset = lerp(11.8, 3.4, s1) - Math.sin(G.pitch + 0.58) * 3.4 * (1 - ease1);
    const stage2HeightOffset = -Math.sin(G.pitch) * camDist + 0.06;
    const heightOffset = prog < 0.35
      ? lerp(stage1HeightOffset, stage2HeightOffset, ease1)
      : stage2HeightOffset;

    const horizDist = camDist * Math.cos(G.pitch * 0.65);
    const chaseX = p.position.x + Math.sin(G.yaw) * horizDist;
    const chaseZ = p.position.z + Math.cos(G.yaw) * horizDist;
    const minGroundClear = getGroundY(chaseX, chaseZ) + 0.85;
    const chaseY = Math.max(minGroundClear, eyeY + heightOffset);

    // Look target angled downward & inward in Stage 1 to frame all 5 parachutes + the entire Storybook village below,
    // blending seamlessly into player eye pivot in Stage 2
    const overviewLookBiasY = (1 - ease1) * -6.4;
    const overviewInwardPull = (1 - ease1) * 5.2;
    const lookX = p.position.x - Math.sin(G.yaw) * overviewInwardPull;
    const lookY = eyeY + overviewLookBiasY - Math.sin(G.pitch) * -0.35 * ease1;
    const lookZ = p.position.z - Math.cos(G.yaw) * overviewInwardPull;

    _vEye.set(p.position.x, eyeY, p.position.z);

    if (fpBlend <= 0.0001) {
      camera.position.set(chaseX, chaseY, chaseZ);
      _vLook.set(lookX, lookY, lookZ);
      _mLook.lookAt(camera.position, _vLook, _vUp);
      _qChase.setFromRotationMatrix(_mLook);
      // Blend from lookAt framing in Stage 1 into pure free-look (G.pitch, G.yaw) in Stage 2
      _euTmp.set(G.pitch, G.yaw, (pSlot ? pSlot.roll : 0) * -0.14, 'YXZ');
      _qFp.setFromEuler(_euTmp);
      _qChase.slerp(_qFp, ease1 * 0.72);
      camera.quaternion.copy(_qChase);
    } else {
      // Seamless final swoop (prog = 0.92..1.0) right into 1st-person eye-height (landingY + 1.55)!
      const cx = lerp(chaseX, _vEye.x, fpBlend);
      const cy = lerp(chaseY, _vEye.y, fpBlend);
      const cz = lerp(chaseZ, _vEye.z, fpBlend);
      camera.position.set(cx, cy, cz);

      const targetLookY = lerp(lookY, _vEye.y, fpBlend);
      _mLook.lookAt(
        _vLook.set(chaseX, chaseY, chaseZ),
        _vEye.set(lookX, targetLookY, lookZ),
        _vUp
      );
      _vEye.set(p.position.x, eyeY, p.position.z);
      _qChase.setFromRotationMatrix(_mLook);
      const bankRoll = (pSlot ? pSlot.roll : 0) * -0.14 * (1 - fpBlend);
      _euTmp.set(G.pitch, G.yaw, bankRoll, 'YXZ');
      _qFp.setFromEuler(_euTmp);
      camera.quaternion.copy(_qChase).slerp(_qFp, 0.72 + 0.28 * fpBlend);

      if (fpBlend >= 0.999) {
        camera.rotation.set(G.pitch, G.yaw, 0, 'YXZ');
      }
    }

    // Hide G.player body mesh right before camera enters the head in the final 3.5% so inside of hood never clips,
    // and smoothly bring in the 1st-person water blaster!
    const distToEye = Math.hypot(
      camera.position.x - _vEye.x,
      camera.position.y - _vEye.y,
      camera.position.z - _vEye.z
    );
    p.visible = distToEye > 0.62 && prog < 0.975;

    if (savedGun && savedGun.ref) {
      if (prog >= 0.93) {
        savedGun.ref.visible = true;
        const gunIn = smoothstep01((prog - 0.93) / 0.07);
        savedGun.ref.position.z = lerp(-0.78, savedGun.baseZ, gunIn);
      } else {
        savedGun.ref.visible = false;
      }
    }
  }

  function beginSkyDrop({ prepDuration = 12, mapRadius = 30 } = {}) {
    if (!THREE || !G || !G.player) return;
    if (skyDropActive || botDropActive) cancelSkyDrop();

    totalDuration = Math.max(0.5, Number(prepDuration) || 12);
    activeMapRadius = Math.max(16, Number(mapRadius) || 30);
    currentProg = 0;
    elapsedSec = 0;
    skyDropActive = true;

    // Save & gently expand scene fog at cloud altitude so the entire Storybook map is crisp from bird's-eye view
    if (scene && scene.fog && typeof scene.fog.near === 'number' && typeof scene.fog.far === 'number') {
      savedFog = { near: scene.fog.near, far: scene.fog.far };
      scene.fog.near = Math.max(savedFog.near, 58);
      scene.fog.far = Math.max(savedFog.far, 185);
    } else {
      savedFog = null;
    }

    // Tuck away 1st-person viewmodel blaster attached to camera while in 3rd-person sky-drop view
    const gunChild = env.gun || (camera && camera.children && camera.children[0]) || null;
    if (gunChild) {
      savedGun = {
        ref: gunChild,
        wasVisible: gunChild.visible,
        baseZ: gunChild.position ? gunChild.position.z : -0.5,
      };
      gunChild.visible = false;
    } else {
      savedGun = null;
    }

    // Ordered Seekers: index 0 is G.player, indices 1..4 are AI squad wingmen (remote human Seekers steer via MP!)
    const orderedSeekers = [];
    const seen = new Set();
    for (const s of [G.player, ...(G.seekers || []), ...(G.allSeekers || [])]) {
      if (!s || seen.has(s)) continue;
      if (s !== G.player && s.userData?.actor?.isRemote && !s.userData?.actor?.isBot) continue;
      seen.add(s);
      orderedSeekers.push(s);
    }
    preliftRemoteHumanSeekers(48);

    const pLandX = G.player.position.x;
    const pLandZ = G.player.position.z;
    const pLandY = typeof G.player.userData?.groundY === 'number'
      ? G.player.userData.groundY
      : getGroundY(pLandX, pLandZ);

    // Initial panoramic camera orientation looking down & inward toward village heart [0, 0]
    G.pitch = -0.58;
    G.yaw = Math.hypot(pLandX, pLandZ) > 1e-4 ? Math.atan2(pLandX, pLandZ) : PI;

    const inX = -Math.sin(G.yaw);
    const inZ = -Math.cos(G.yaw);
    const rightX = Math.cos(G.yaw);
    const rightZ = -Math.sin(G.yaw);

    const baseStartAlt = clamp(activeMapRadius * 1.55, 42, 58);
    const approachBack = clamp(activeMapRadius * 0.34, 9.0, 12.5);

    // Staggered V-formation offsets (0..4m in Y, wingmen gliding slightly ahead & beside G.player in frame!)
    const yStagger = [3.4, 1.9, 2.2, 0.3, 0.75];
    const vEchelon = [
      [0, 0],
      [-3.2, 3.4],
      [3.2, 3.4],
      [-6.0, 6.2],
      [6.0, 6.2],
    ];

    // Precompute 4 spread-out safe sector landing targets for AI Seekers (separated >= 4.5m & off roofs/water)
    const baseSectorAng = rand(0, TAU);
    const placedDropTargets = [
      THREE ? new THREE.Vector3(pLandX, pLandY, pLandZ) : { x: pLandX, y: pLandY, z: pLandZ },
    ];

    seekerSlots = orderedSeekers.map((s, idx) => {
      const isPlayer = s === G.player;
      const lx = s.position.x;
      const lz = s.position.z;
      const ly = typeof s.userData?.groundY === 'number' ? s.userData.groundY : getGroundY(lx, lz);
      const startAlt = baseStartAlt + yStagger[idx % yStagger.length];

      let targetLandingX = lx;
      let targetLandingY = ly;
      let targetLandingZ = lz;
      if (!isPlayer) {
        const ang = baseSectorAng + (idx / 5) * TAU + rand(-0.24, 0.24);
        const maxDropR = Math.max(7.6, activeMapRadius - 4.5);
        const rad = clamp(activeMapRadius * rand(0.32, 0.62), 7.5, maxDropR);
        const tx = Math.cos(ang) * rad;
        const tz = Math.sin(ang) * rad;
        const safeDrop = getSafeSpawn(tx, tz, 0.52, placedDropTargets, 4.5);
        placedDropTargets.push(safeDrop);
        targetLandingX = safeDrop.x;
        targetLandingY = safeDrop.y;
        targetLandingZ = safeDrop.z;
      }

      const [echR, echFwd] = vEchelon[idx % vEchelon.length];
      const startOffX = -inX * approachBack + rightX * echR + inX * echFwd;
      const startOffZ = -inZ * approachBack + rightZ * echR + inZ * echFwd;

      const initX = lx + startOffX;
      const initZ = lz + startOffZ;
      const initY = ly + startAlt;

      const para = acquireParachute(idx);
      if (para.parent !== s) s.add(para);

      const origRotOrder = s.rotation.order;
      s.rotation.order = 'YXZ';
      const initFacingYaw = Math.atan2(inX, inZ);
      s.rotation.set(0, initFacingYaw, 0);

      s.position.set(initX, initY, initZ);
      if (s.userData) {
        s.userData._localSkyDrop = true;
        s.userData.groundY = ly;
        s.userData.jy = startAlt;
        s.userData.vy = 0.35;
        s.userData.gliding = true;
        s.userData.lastX = initX;
        s.userData.lastZ = initZ;
        s.userData.spd = 0;
      }

      if (isPlayer) s.visible = true;

      const slot = {
        char: s,
        idx,
        isPlayer,
        para,
        initX,
        initY,
        initZ,
        formBaseX: lx,
        formBaseY: ly,
        formBaseZ: lz,
        landingX: isPlayer ? lx : targetLandingX,
        landingZ: isPlayer ? lz : targetLandingZ,
        landingY: isPlayer ? ly : targetLandingY,
        targetLandingX,
        targetLandingY,
        targetLandingZ,
        safeX: isPlayer ? lx : targetLandingX,
        safeZ: isPlayer ? lz : targetLandingZ,
        safeY: isPlayer ? ly : targetLandingY,
        lastSafeQueryX: lx,
        lastSafeQueryZ: lz,
        startAlt,
        startOffX,
        startOffZ,
        echSide: echR < 0 ? -1 : echR > 0 ? 1 : (idx % 2 === 0 ? 1 : -1),
        vx: 0,
        vz: 0,
        roll: 0,
        pitch: 0,
        prog: 0,
        phaseOff: idx * 1.37 + 0.4,
        spiralSign: idx % 2 === 0 ? 1 : -1,
        origRotOrder,
        origAnimate: undefined,
      };

      installParachutePoseWrapper(s, slot);
      return slot;
    });

    // Fairness Cloak on all Hiders so Seekers get a pure panoramic map overview without spoiling Hider spots
    applyHiderCloak();

    // Position sunlit wind-streak & cloud-wisp ring around descending squad
    resetWindRingPositions(G.player.position.x, G.player.position.y, G.player.position.z);

    // Prime camera immediately for frame 0
    updateCamera(0);
  }

  /**
   * Bot-Only Sky-Drop in Hide Mode (`G.mode === 'hide'` & `G.phase === 'hide'`):
   * Never touches `G.player`, `camera`, `G.yaw`, `G.pitch`, HUD blindfolds, or `cloakedHiders`.
   * Holds all 5 AI Seekers high in the clouds (`y = landingY + 54m`) during early Hide seconds,
   * then glides them down on curved parachute paths over the final 12.5s onto 5 spread-out safe sectors!
   */
  function beginBotOnlySkyDrop({ prepDuration = 20, mapRadius = 40 } = {}) {
    if (!THREE || !G) return;
    if (skyDropActive || botDropActive) cancelSkyDrop();
    preliftRemoteHumanSeekers(48);

    const botSeekers = (G.seekers || []).filter((s) => s && s !== G.player && !!(s.userData?.actor ? s.userData.actor.isBot : !s.userData?.actor?.isRemote));
    if (!botSeekers.length) return;

    botDropPrepDuration = Math.max(1, Number(prepDuration) || 20);
    botDropMapRadius = Math.max(16, Number(mapRadius) || 40);
    elapsedSec = 0;
    botDropActive = true;

    if (windGroup) windGroup.visible = false;

    const randOffset = rand(0, TAU);
    const placed = [];

    botDropSlots = botSeekers.map((s, i) => {
      // Seekers touch down together at the map's seeker spawn (where the round placed them), NOT scattered across the
      // hiding grounds: a seeker landing on top of a hider in the first second is no fun for anyone. Hiders learn that
      // "far from the landing zone" buys time; seekers then fan out from one known place.
      const homeX = s.position.x, homeZ = s.position.z;
      const ang = Math.atan2(homeZ, homeX) + (Math.hypot(homeX, homeZ) < 0.5 ? randOffset + (i / 5) * TAU : 0);
      const rad = Math.hypot(homeX, homeZ);
      const safeSpot = getSafeSpawn(homeX, homeZ, 0.52, placed, 1.35);
      placed.push(safeSpot);

      const safeX = safeSpot.x;
      const safeY = safeSpot.y;
      const safeZ = safeSpot.z;

      const spiralSign = i % 2 === 0 ? 1 : -1;
      const cloudAng = ang - spiralSign * 0.42;
      const cloudRad = clamp(rad * 0.45, 4.5, Math.max(6.0, botDropMapRadius * 0.42));
      const cloudX = Math.cos(cloudAng) * cloudRad;
      const cloudZ = Math.sin(cloudAng) * cloudRad;
      const startAlt = 54;
      const cloudY = safeY + startAlt;

      const para = acquireParachute(i);
      if (para.parent !== s) s.add(para);

      const origRotOrder = s.rotation.order;
      s.rotation.order = 'YXZ';
      const initYaw = Math.atan2(safeX - cloudX, safeZ - cloudZ);
      s.rotation.set(0, initYaw, 0);
      s.visible = true;
      s.position.set(cloudX, cloudY, cloudZ);

      if (s.userData) {
        const ng = getGroundY(cloudX, cloudZ, cloudY);
        s.userData._localSkyDrop = true;
        s.userData.groundY = ng;
        s.userData.jy = Math.max(0.5, cloudY - ng);
        s.userData.vy = 0;
        s.userData.gliding = true;
        s.userData.lastX = cloudX;
        s.userData.lastZ = cloudZ;
        s.userData.spd = 0;
        s.userData.squash = 0;
        s.userData.squashTarget = 0;
      }

      const slot = {
        char: s,
        idx: i,
        isPlayer: false,
        para,
        cloudX,
        cloudZ,
        safeX,
        safeY,
        safeZ,
        startAlt,
        vx: 0,
        vz: 0,
        roll: 0,
        pitch: 0,
        prog: 0,
        phaseOff: i * 1.37 + 0.35,
        spiralSign,
        origRotOrder,
        origAnimate: undefined,
      };

      installParachutePoseWrapper(s, slot);
      return slot;
    });
  }

  function finishBotOnlySkyDrop() {
    if (!botDropActive && !botDropSlots.length) {
      if (windGroup && !skyDropActive) windGroup.visible = false;
      return;
    }

    botDropActive = false;
    if (windGroup && !skyDropActive) windGroup.visible = false;

    for (let i = 0; i < botDropSlots.length; i++) {
      const slot = botDropSlots[i];
      if (slot.para) {
        if (slot.para.parent) slot.para.parent.remove(slot.para);
        slot.para.visible = false;
      }
      const s = slot.char;
      if (!s) continue;

      restoreSeekerRig(slot);
      s.rotation.order = slot.origRotOrder || 'XYZ';
      s.rotation.x = 0;
      s.rotation.z = 0;
      s.rotation.y = Math.hypot(slot.safeX, slot.safeZ) > 0.3
        ? Math.atan2(-slot.safeX, -slot.safeZ)
        : 0;
      s.position.set(slot.safeX, slot.safeY, slot.safeZ);

      if (s.userData) {
        s.userData._localSkyDrop = false;
        s.userData.groundY = slot.safeY;
        s.userData.jy = 0;
        s.userData.vy = 0;
        s.userData.gliding = false;
        s.userData.lastX = slot.safeX;
        s.userData.lastZ = slot.safeZ;
        s.userData.spd = 0;
        s.userData.squash = 0;
        s.userData.squashTarget = 0;
      }
    }

    botDropSlots = [];
  }

  function updateBotOnlySkyDrop(safeDt, tSec) {
    if (!G || G.mode !== 'hide' || G.phase !== 'hide' || G.over || G.t <= 0.05) {
      finishBotOnlySkyDrop();
      return;
    }

    const glideDuration = Math.min(12.5, botDropPrepDuration);
    const dropProg = G.t >= glideDuration
      ? 0
      : clamp((glideDuration - G.t) / glideDuration, 0, 1);
    const altFactor = computeAltFactor(dropProg);
    const flareU = clamp((dropProg - 0.85) / 0.15, 0, 1);
    const uprightSettle = 1 - smoothstep01((dropProg - 0.91) / 0.09);
    const easeP = smoothstep01(dropProg);
    const arcEnv = easeP * (1 - easeP) * 4;
    const holdDrift = 1 - easeP;

    for (let i = 0; i < botDropSlots.length; i++) {
      const slot = botDropSlots[i];
      const s = slot.char;
      if (!s) continue;

      const prevX = s.position.x;
      const prevZ = s.position.z;

      const dx = slot.safeX - slot.cloudX;
      const dz = slot.safeZ - slot.cloudZ;
      const dist = Math.hypot(dx, dz) || 1;
      const perpX = -dz / dist;
      const perpZ = dx / dist;
      const arcAmp = clamp(dist * 0.22, 2.2, 5.8) * slot.spiralSign;
      const driftAng = tSec * 0.42 * slot.spiralSign + slot.phaseOff;

      const curX = lerp(slot.cloudX, slot.safeX, easeP)
        + perpX * arcAmp * arcEnv
        + Math.cos(driftAng) * 1.35 * holdDrift;
      const curZ = lerp(slot.cloudZ, slot.safeZ, easeP)
        + perpZ * arcAmp * arcEnv
        + Math.sin(driftAng) * 1.35 * holdDrift;

      const curAlt = slot.startAlt * altFactor + Math.sin(tSec * 0.9 + slot.phaseOff) * 0.45 * holdDrift;
      const terrainBelow = getGroundY(curX, curZ);
      const minClearY = dropProg < 0.96
        ? terrainBelow + Math.min(curAlt, 1.25 * (1 - dropProg))
        : slot.safeY;
      const curY = Math.max(slot.safeY + curAlt, minClearY);

      slot.prog = dropProg;
      s.position.set(curX, curY, curZ);

      if (s.userData) {
        const rawNg = getGroundY(curX, curZ, curY);
        s.userData.groundY = rawNg;
        s.userData.jy = Math.max(0.05, curY - rawNg);
        s.userData.vy = 0;
        s.userData.gliding = true;
        s.userData.squash = 0;
        s.userData.squashTarget = 0;
      }

      const vx = (curX - prevX) / safeDt;
      const vz = (curZ - prevZ) / safeDt;
      slot.vx = lerp(slot.vx, vx, Math.min(1, safeDt * 7.5));
      slot.vz = lerp(slot.vz, vz, Math.min(1, safeDt * 7.5));

      const inwardYaw = Math.hypot(slot.safeX, slot.safeZ) > 0.3
        ? Math.atan2(-slot.safeX, -slot.safeZ)
        : 0;
      const flightSpd = Math.hypot(slot.vx, slot.vz);
      const flightYaw = flightSpd > 0.2 ? Math.atan2(slot.vx, slot.vz) : inwardYaw;
      const settleInward = smoothstep01((dropProg - 0.82) / 0.18);
      const wantYaw = lerpAngle(flightYaw, inwardYaw, settleInward);
      const yawDelta = normAng(wantYaw - s.rotation.y);
      s.rotation.y = lerpAngle(s.rotation.y, wantYaw, Math.min(1, safeDt * 6.0));

      const bankFromTurn = clamp(-yawDelta * 1.4, -0.32, 0.32);
      const breezeRoll = Math.sin(tSec * 1.85 + slot.phaseOff) * 0.068;
      const breezePitch = Math.cos(tSec * 1.45 + slot.phaseOff) * 0.048;
      slot.roll = lerp(slot.roll, (bankFromTurn + breezeRoll) * uprightSettle, Math.min(1, safeDt * 6.5));
      slot.pitch = lerp(slot.pitch, (0.07 + breezePitch - flareU * 0.14) * uprightSettle, Math.min(1, safeDt * 6.5));
      s.rotation.z = slot.roll;
      s.rotation.x = slot.pitch;

      updateParachuteVisuals(slot, safeDt, tSec, flareU);
    }
  }

  function update(dt, now) {
    const safeDt = clamp(Number(dt) || 0.016, 0.0005, 0.1);

    if (botDropActive) {
      elapsedSec += safeDt;
      const tSec = typeof now === 'number' && now > 0 ? now * 0.001 : elapsedSec;
      updateBotOnlySkyDrop(safeDt, tSec);
      return;
    }

    if (!skyDropActive || !G || G.mode !== 'seek' || G.phase !== 'ready') return;

    elapsedSec += safeDt;
    const tSec = typeof now === 'number' && now > 0 ? now * 0.001 : elapsedSec;

    const prog = clamp(1 - (G.t / totalDuration), 0, 1);
    currentProg = prog;

    const altFactor = computeAltFactor(prog);
    const flareU = clamp((prog - 0.85) / 0.15, 0, 1);
    const uprightSettle = 1 - smoothstep01((prog - 0.91) / 0.09);
    const approachDecay = Math.pow(1 - prog, 1.35);
    const maxSteerRadius = activeMapRadius * 0.72;

    // Smoothly blend fog from high-altitude crystal overview back to native map ground fog
    if (savedFog && scene && scene.fog) {
      scene.fog.near = lerp(savedFog.near, Math.max(savedFog.near, 58), altFactor);
      scene.fog.far = lerp(savedFog.far, Math.max(savedFog.far, 185), altFactor);
    }

    // Keep all Hiders cloaked throughout sky-drop even if AI transforms mid-scramble
    applyHiderCloak();

    // Read local player mid-air glider steering inputs
    let mx = (input && input.mx) || 0;
    let mz = (input && input.mz) || 0;
    const keys = (input && input.keys) || {};
    if (keys.KeyW || keys.ArrowUp) mz = -1;
    if (keys.KeyS || keys.ArrowDown) mz = 1;
    if (keys.KeyA || keys.ArrowLeft) mx = -1;
    if (keys.KeyD || keys.ArrowRight) mx = 1;
    const mLen = Math.hypot(mx, mz);
    if (mLen > 1) {
      mx /= mLen;
      mz /= mLen;
    }

    const fx = -Math.sin(G.yaw);
    const fz = -Math.cos(G.yaw);
    const rx = Math.cos(G.yaw);
    const rz = -Math.sin(G.yaw);

    for (let i = 0; i < seekerSlots.length; i++) {
      const slot = seekerSlots[i];
      const s = slot.char;
      if (!s) continue;

      const prevX = s.position.x;
      const prevZ = s.position.z;

      if (slot.isPlayer) {
        // Interactive mid-air horizontal glide (~4.8 m/s within mapRadius * 0.72)
        const glideSpd = 4.8 * (1 - 0.45 * flareU);
        const wantVx = (rx * mx - fx * mz) * glideSpd;
        const wantVz = (rz * mx - fz * mz) * glideSpd;
        const steerLerp = Math.min(1, safeDt * 6.5);
        slot.vx = lerp(slot.vx, wantVx, steerLerp);
        slot.vz = lerp(slot.vz, wantVz, steerLerp);

        slot.landingX += slot.vx * safeDt;
        slot.landingZ += slot.vz * safeDt;

        const rDist = Math.hypot(slot.landingX, slot.landingZ);
        if (rDist > maxSteerRadius) {
          const kClamp = maxSteerRadius / rDist;
          slot.landingX *= kClamp;
          slot.landingZ *= kClamp;
        }

        // Final 20% (prog > 0.80): smoothly guide landing coordinates onto verified walkable ground/plaza!
        if (prog > 0.80) {
          const movedSinceSafe = Math.hypot(
            slot.landingX - slot.lastSafeQueryX,
            slot.landingZ - slot.lastSafeQueryZ
          );
          if (!slot._safeLocked || movedSinceSafe > 0.14) {
            const safe = getSafeSpawn(slot.landingX, slot.landingZ, 0.52);
            slot.safeX = safe.x;
            slot.safeZ = safe.z;
            slot.safeY = safe.y;
            slot.lastSafeQueryX = slot.landingX;
            slot.lastSafeQueryZ = slot.landingZ;
            slot._safeLocked = true;
          }
          const guideT = clamp((prog - 0.80) / 0.20, 0, 1);
          const guideRate = Math.min(1, safeDt * lerp(4.5, 18.0, guideT));
          slot.landingX = lerp(slot.landingX, slot.safeX, guideRate);
          slot.landingZ = lerp(slot.landingZ, slot.safeZ, guideRate);
          const targetGroundY = slot.safeY;
          slot.landingY = lerp(slot.landingY, targetGroundY, Math.min(1, safeDt * lerp(7.0, 18.0, guideT)));
        } else {
          const rawGroundY = getGroundY(slot.landingX, slot.landingZ);
          slot.landingY = lerp(slot.landingY, rawGroundY, Math.min(1, safeDt * 5.5));
        }

        const curX = slot.landingX + slot.startOffX * approachDecay;
        const curZ = slot.landingZ + slot.startOffZ * approachDecay;
        const curAlt = slot.startAlt * altFactor;
        const curY = slot.landingY + curAlt;
        slot.prog = prog;

        s.position.set(curX, curY, curZ);
        if (s.userData) {
          s.userData.groundY = slot.landingY;
          s.userData.jy = Math.max(0.04, curAlt);
          s.userData.vy = 0.35;
          s.userData.gliding = true;
        }

        // Smooth Seeker facing & parachute banking from steering + Storybook breeze
        const lookYaw = Math.atan2(fx, fz);
        const moveSpd = Math.hypot(slot.vx, slot.vz);
        const steerYaw = moveSpd > 0.35 ? Math.atan2(slot.vx, slot.vz) : lookYaw;
        const blendToLook = smoothstep01((prog - 0.84) / 0.16);
        const targetYaw = lerpAngle(steerYaw, lookYaw, 0.55 + 0.45 * blendToLook);
        s.rotation.y = lerpAngle(s.rotation.y, targetYaw, Math.min(1, safeDt * 8.5));

        const breezeRoll = Math.sin(tSec * 1.85 + slot.phaseOff) * 0.062;
        const breezePitch = Math.cos(tSec * 1.45 + slot.phaseOff) * 0.048;
        const targetRoll = (clamp(-mx * 0.34, -0.36, 0.36) + breezeRoll) * uprightSettle;
        const targetPitch = (clamp(mz * 0.24, -0.28, 0.28) + breezePitch - flareU * 0.12) * uprightSettle;

        slot.roll = lerp(slot.roll, targetRoll, Math.min(1, safeDt * 7.5));
        slot.pitch = lerp(slot.pitch, targetPitch, Math.min(1, safeDt * 7.5));
        s.rotation.z = slot.roll;
        s.rotation.x = slot.pitch;
      } else {
        // AI Wingmen:
        // Stage 1 (prog = 0..0.22): Hold opening V-formation in the sunlit clouds framing all 5 parachutes!
        // Stage 2 (prog = 0.22..1.0): Smoothly peel outward along curved glider arcs onto 4 spread-out safe sectors!
        const vFormX = slot.formBaseX + slot.startOffX * approachDecay;
        const vFormZ = slot.formBaseZ + slot.startOffZ * approachDecay;

        const peelRaw = clamp((prog - 0.22) / 0.78, 0, 1);
        const peelT = smoothstep01(peelRaw);
        const arcEnv = peelT * (1 - peelT) * 4;

        const dxT = slot.targetLandingX - slot.initX;
        const dzT = slot.targetLandingZ - slot.initZ;
        const distT = Math.hypot(dxT, dzT) || 1;
        const perpX = -dzT / distT;
        const perpZ = dxT / distT;
        const arcAmp = clamp(distT * 0.16, 2.0, 6.0) * slot.echSide;

        const formBreezeAmp = Math.sin(clamp(prog / 0.22, 0, 1) * PI) * 0.25;
        const swayAng = prog * PI * 2.0 + slot.phaseOff;

        const curX = lerp(vFormX, slot.targetLandingX, peelT)
          + perpX * arcAmp * arcEnv
          + Math.cos(swayAng) * formBreezeAmp;
        const curZ = lerp(vFormZ, slot.targetLandingZ, peelT)
          + perpZ * arcAmp * arcEnv
          + Math.sin(swayAng) * formBreezeAmp;

        const baseGroundY = lerp(slot.formBaseY, slot.targetLandingY, peelT);
        const curAlt = slot.startAlt * altFactor;
        const terrainBelow = getGroundY(curX, curZ);
        const minClearY = prog < 0.96
          ? terrainBelow + Math.min(curAlt, 1.25 * (1 - prog))
          : slot.targetLandingY;
        const curY = Math.max(baseGroundY + curAlt, minClearY);

        slot.landingX = slot.targetLandingX;
        slot.landingY = slot.targetLandingY;
        slot.landingZ = slot.targetLandingZ;
        slot.prog = prog;

        s.position.set(curX, curY, curZ);
        if (s.userData) {
          s.userData.groundY = baseGroundY;
          s.userData.jy = Math.max(0.04, curY - baseGroundY);
          s.userData.vy = 0.35;
          s.userData.gliding = true;
        }

        const vx = (curX - prevX) / safeDt;
        const vz = (curZ - prevZ) / safeDt;
        slot.vx = lerp(slot.vx, vx, Math.min(1, safeDt * 8));
        slot.vz = lerp(slot.vz, vz, Math.min(1, safeDt * 8));

        const inwardYaw = Math.hypot(slot.targetLandingX, slot.targetLandingZ) > 0.3
          ? Math.atan2(-slot.targetLandingX, -slot.targetLandingZ)
          : 0;
        const flightSpd = Math.hypot(slot.vx, slot.vz);
        const flightYaw = flightSpd > 0.25 ? Math.atan2(slot.vx, slot.vz) : s.rotation.y;
        const settleInward = smoothstep01((prog - 0.84) / 0.16);
        const wantYaw = lerpAngle(flightYaw, inwardYaw, settleInward);
        const yawDelta = normAng(wantYaw - s.rotation.y);
        s.rotation.y = lerpAngle(s.rotation.y, wantYaw, Math.min(1, safeDt * 6.5));

        const bankFromTurn = clamp(-yawDelta * 1.45, -0.34, 0.34);
        const forwardLean = clamp(flightSpd * 0.022, 0, 0.14);
        const breezeRoll = Math.sin(tSec * 1.9 + slot.phaseOff) * 0.07;
        const breezePitch = Math.cos(tSec * 1.5 + slot.phaseOff) * 0.05;
        slot.roll = lerp(slot.roll, (bankFromTurn + breezeRoll) * uprightSettle, Math.min(1, safeDt * 6.5));
        slot.pitch = lerp(slot.pitch, (0.06 + forwardLean + breezePitch - flareU * 0.16) * uprightSettle, Math.min(1, safeDt * 6.5));
        s.rotation.z = slot.roll;
        s.rotation.x = slot.pitch;
      }

      updateParachuteVisuals(slot, safeDt, tSec, flareU);
    }

    // Update Wind-Streak & Cloud Puff Ring around G.player
    if (windGroup && G.player) {
      const px = G.player.position.x;
      const py = G.player.position.y;
      const pz = G.player.position.z;
      const altFade = clamp((0.95 - prog) / 0.16, 0, 1);
      windGroup.visible = altFade > 0.005;

      if (windGroup.visible) {
        for (let i = 0; i < windParticles.length; i++) {
          const wp = windParticles[i];
          wp.relY += wp.riseSpd * safeDt;
          if (wp.relY > 10.5) {
            wp.relY -= 20.0;
            wp.ang = (wp.ang + 1.15) % TAU;
          }
          const wx = px + Math.cos(wp.ang) * wp.rad;
          const wz = pz + Math.sin(wp.ang) * wp.rad;
          const wy = py + wp.relY;
          const minAirY = getGroundY(wx, wz) + 2.2;

          wp.mesh.position.set(wx, wy, wz);
          if (wp.isCloud) {
            wp.rotY += safeDt * 0.25;
            wp.mesh.rotation.y = wp.rotY;
          } else {
            // Subtle tilt matching player glide direction
            const pSlot = seekerSlots[0];
            wp.mesh.rotation.set(
              pSlot ? clamp(pSlot.vz * 0.035, -0.2, 0.2) : 0,
              0,
              pSlot ? clamp(-pSlot.vx * 0.035, -0.2, 0.2) : 0
            );
          }

          if (wy < minAirY) {
            wp.mat.opacity = 0;
          } else {
            const normBand = clamp((wp.relY + 9.5) / 20.0, 0, 1);
            const bell = Math.sin(normBand * PI);
            wp.mat.opacity = wp.peakOpacity * bell * altFade;
          }
        }
      }
    }

    updateCamera(safeDt);
  }

  function finishSkyDrop() {
    if (!skyDropActive) {
      if (botDropActive) finishBotOnlySkyDrop();
      return {
        landedPos: G && G.player ? G.player.position.clone() : (THREE ? new THREE.Vector3() : { x: 0, y: 0, z: 0 }),
      };
    }

    skyDropActive = false;
    currentProg = 1;

    if (windGroup) windGroup.visible = false;

    if (savedFog && scene && scene.fog) {
      scene.fog.near = savedFog.near;
      scene.fog.far = savedFog.far;
      savedFog = null;
    }

    if (savedGun && savedGun.ref) {
      savedGun.ref.visible = true;
      savedGun.ref.position.z = savedGun.baseZ;
      savedGun = null;
    }

    // Place all 5 Seekers cleanly onto non-overlapping verified walkable coordinates
    const placed = [];
    for (let i = 0; i < seekerSlots.length; i++) {
      const slot = seekerSlots[i];
      const s = slot.char;
      if (slot.para) {
        if (slot.para.parent) slot.para.parent.remove(slot.para);
        slot.para.visible = false;
      }
      if (!s) continue;

      restoreSeekerRig(slot);

      const dropX = slot.isPlayer ? slot.landingX : slot.targetLandingX;
      const dropZ = slot.isPlayer ? slot.landingZ : slot.targetLandingZ;
      const safePos = getSafeSpawn(
        dropX,
        dropZ,
        slot.isPlayer ? 0.52 : 0.52,
        placed,
        1.32
      );
      placed.push(safePos);

      s.position.copy(safePos);
      if (s.userData) {
        s.userData._localSkyDrop = false;
        s.userData.groundY = safePos.y;
        s.userData.jy = 0;
        s.userData.vy = 0;
        s.userData.gliding = false;
        s.userData.lastX = safePos.x;
        s.userData.lastZ = safePos.z;
        s.userData.spd = 0;
        if (Array.isArray(s.userData.open)) s.userData.open.forEach((m) => { m.visible = true; });
        if (Array.isArray(s.userData.closed)) s.userData.closed.forEach((m) => { m.visible = false; });
      }

      if (slot.isPlayer) {
        s.visible = false; // 1st-person Seek mode
        s.rotation.y = Math.atan2(-Math.sin(G.yaw), -Math.cos(G.yaw));
      } else {
        s.visible = true;
        s.rotation.y = Math.hypot(safePos.x, safePos.z) > 0.3
          ? Math.atan2(-safePos.x, -safePos.z)
          : 0;
      }
    }

    if (G) {
      G.pitch = clamp(G.pitch, -0.35, 0.2);
      if (G.player && camera) {
        const py = G.player.userData?.groundY || G.player.position.y || 0;
        camera.position.set(G.player.position.x, py + 1.55, G.player.position.z);
        camera.rotation.set(G.pitch, G.yaw, 0, 'YXZ');
      }
    }

    releaseHiderCloak();
    seekerSlots = [];

    return {
      landedPos: G && G.player ? G.player.position.clone() : new THREE.Vector3(),
    };
  }

  function cancelSkyDrop() {
    if (!skyDropActive && !botDropActive && !seekerSlots.length && !botDropSlots.length && !cloakedHiders.length) {
      if (windGroup) windGroup.visible = false;
      return;
    }

    if (botDropActive || botDropSlots.length) {
      botDropActive = false;
      for (let i = 0; i < botDropSlots.length; i++) {
        const slot = botDropSlots[i];
        if (slot.para) {
          if (slot.para.parent) slot.para.parent.remove(slot.para);
          slot.para.visible = false;
        }
        const s = slot.char;
        if (!s) continue;
        restoreSeekerRig(slot);
        s.rotation.order = slot.origRotOrder || 'XYZ';
        s.rotation.x = 0;
        s.rotation.z = 0;
        s.position.set(slot.safeX, slot.safeY, slot.safeZ);
        if (s.userData) {
          s.userData._localSkyDrop = false;
          s.userData.groundY = slot.safeY;
          s.userData.jy = 0;
          s.userData.vy = 0;
          s.userData.gliding = false;
          s.userData.lastX = slot.safeX;
          s.userData.lastZ = slot.safeZ;
          s.userData.spd = 0;
        }
      }
      botDropSlots = [];
    }

    if (!skyDropActive && !seekerSlots.length && !cloakedHiders.length) {
      if (windGroup) windGroup.visible = false;
      return;
    }

    skyDropActive = false;
    currentProg = 0;

    if (windGroup) windGroup.visible = false;

    if (savedFog && scene && scene.fog) {
      scene.fog.near = savedFog.near;
      scene.fog.far = savedFog.far;
      savedFog = null;
    }

    if (savedGun && savedGun.ref) {
      savedGun.ref.visible = savedGun.wasVisible;
      savedGun.ref.position.z = savedGun.baseZ;
      savedGun = null;
    }

    for (let i = 0; i < seekerSlots.length; i++) {
      const slot = seekerSlots[i];
      if (slot.para) {
        if (slot.para.parent) slot.para.parent.remove(slot.para);
        slot.para.visible = false;
      }
      const s = slot.char;
      if (!s) continue;
      restoreSeekerRig(slot);
      if (s.userData) {
        s.userData._localSkyDrop = false;
        s.userData.jy = 0;
        s.userData.vy = 0;
        s.userData.gliding = false;
      }
      if (slot.isPlayer && G && G.mode === 'seek') {
        s.visible = false;
      }
    }

    releaseHiderCloak();
    seekerSlots = [];
  }

  function preliftRemoteHumanSeekers(alt = 48) {
    if (!G) return;
    const list = G.allSeekers && G.allSeekers.length ? G.allSeekers : (G.seekers || []);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s || s === G.player || !s.userData || s.userData._localSkyDrop) continue;
      if (!s.userData.actor?.isRemote || s.userData.actor?.isBot) continue;
      const gy = typeof s.userData.groundY === 'number' ? s.userData.groundY : getGroundY(s.position.x, s.position.z);
      s.userData.groundY = gy;
      s.userData.jy = alt;
      s.userData.gliding = true;
      s.visible = true;
      s.position.y = gy + alt;
    }
  }

  function syncRemoteParachutes() {
    if (!THREE || !G) return;
    const prepPhase = !G.over && (G.phase === 'hide' || G.phase === 'ready');
    const list = G.allSeekers && G.allSeekers.length ? G.allSeekers : (G.seekers || []);
    const tSec = performance.now() * 0.001;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s || s === G.player || !s.userData || s.userData._localSkyDrop) continue;
      if (!s.userData.actor?.isRemote || s.userData.actor?.isBot) {
        if (s.userData._remotePara) {
          if (s.userData._remotePara.parent) s.userData._remotePara.parent.remove(s.userData._remotePara);
          s.userData._remotePara.visible = false;
          s.userData._remotePara = null;
        }
        continue;
      }
      const inAir = prepPhase && (s.userData.jy || 0) > 1.1;
      if (inAir && !s.userData._remotePara) {
        const accent = STORYBOOK_PARACHUTE_ACCENTS[i % STORYBOOK_PARACHUTE_ACCENTS.length];
        const para = acquireParachute(5 + i);
        if (para.userData && para.userData.setAccent) para.userData.setAccent(accent);
        para.position.set(0, 1.95, 0);
        s.add(para);
        s.userData._remotePara = para;
      } else if (!inAir && s.userData._remotePara) {
        if (s.userData._remotePara.parent) s.userData._remotePara.parent.remove(s.userData._remotePara);
        s.userData._remotePara.visible = false;
        s.userData._remotePara = null;
      }
      if (s.userData._remotePara) {
        const breath = Math.sin(tSec * 3.1 + i * 1.1) * 0.016;
        s.userData._remotePara.scale.set(1 + breath, 1 - breath * 0.6, 1 + breath);
      }
    }
  }

  return {
    beginSkyDrop,
    beginBotOnlySkyDrop,
    syncRemoteParachutes,
    update,
    updateCamera,
    finishSkyDrop,
    finishDrop: finishSkyDrop,
    finishBotOnlySkyDrop,
    cancelSkyDrop,
    reset: cancelSkyDrop,
    isActive: () => skyDropActive,
    isDropping: () => skyDropActive,
    isBotDropActive: () => botDropActive,
    getProgress: () => currentProg,
    buildParachute: (accentHex) => buildStorybookParachute(THREE, accentHex),
  };
}
