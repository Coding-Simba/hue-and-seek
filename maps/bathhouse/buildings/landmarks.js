// ============================================================================
// Yu-Machi Spirit Bathhouse — Courtyard & Vertical Landmarks (landmarks.js)
// Handcrafted Storybook procedural 3D landmarks matching ext_06, int_06 & overview:
//   1. buildDragonFountain — Coiled Mossy-Jade Storybook River-Dragon hot-spring fountain
//   2. buildBellPavilion   — 4-post Vermilion Shoro Pavilion & cast-bronze Bonsho bell
//   3. buildSpiritStall    — Crimson cloth festival stall, 4 chochin & spirit fruits
//   4. buildRedBridge      — Arched Vermilion Taikobashi drum bridge with gold giboshi
//   5. buildToriiGate      — Majestic Vermilion Ryobu Water Torii with 4 hanging lanterns
//   6. buildRotenburo      — Outdoor mossy-boulder hot spring, bamboo screen & kakehi spout
//   7. buildPulleyLift     — 3-tier Bathhouse Pulley Lift Tower + rideable liftCar & wheel
//   8. buildStoneStaircase — Stepped Storybook twilight stone staircase with mossy cheeks
// ALL materials use metalness: 0 so gold, bronze & water glow warmly without HDRI!
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
  mergeGeometries,
} from '../../map_kit.js?v=2';
import {
  getBathMats,
  buildKawaraGableRoof,
  addChochinLantern,
  addPostLantern,
  addNorenCurtain,
  VERDIGRIS_PAL,
  INDIGO_SLATE_PAL,
  STONE_BOULDER_PAL,
  MOSS_BOULDER_PAL,
  HYDRANGEA_PAL,
  FOLIAGE_PAL,
} from '../bath_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

let _warmDone = false;
// Pre-warms map_kit's canvasCache with 3-arg (ctx, s, rng) draw callbacks so bath_kit.js
// getBathTextures(THREE) hits cached canvases cleanly without 4-arg NaN gradient errors.
export function ensureBathTexWarm(THREE) {
  if (_warmDone) return;
  _warmDone = true;

  paintedCanvasTex(THREE, 'bh2_shoji_paper', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffe094'); grd.addColorStop(0.55, '#ffd068'); grd.addColorStop(1, '#ffb33e');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 180, ['#ffebb0', '#ffc454', '#fff3c8'], 2, 6, 0.25);
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_tatami', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#b9be78'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(154,162,92,0.45)' : 'rgba(208,212,146,0.35)';
      ctx.fillRect(0, y, w, 2);
    }
    brushStrokes(ctx, w, rng, 110, ['#c8cc88', '#a4ab66'], 2, 4, 0.2);
    ctx.fillStyle = '#28364e';
    ctx.fillRect(0, 0, w, 14); ctx.fillRect(0, h - 14, w, 14);
    ctx.fillRect(0, 0, 12, h); ctx.fillRect(w - 12, 0, 12, h);
    ctx.strokeStyle = '#d8aa48'; ctx.lineWidth = 2; ctx.strokeRect(6, 6, w - 12, h - 12);
  }, 2, 2);

  paintedCanvasTex(THREE, 'bh2_noren_onsen', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#442b68'); grd.addColorStop(1, '#5d3c8c');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 140, ['#6a469c', '#382258', '#52347c'], 3, 7, 0.24);
    ctx.strokeStyle = '#d9b464'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, h - 16); ctx.lineTo(w, h - 16); ctx.stroke();
    ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, 52, 0.12 * PI, 0.88 * PI, false); ctx.stroke();
    ctx.lineWidth = 10;
    for (const dx of [-28, 0, 28]) {
      ctx.beginPath(); ctx.moveTo(w * 0.5 + dx, h * 0.58);
      ctx.bezierCurveTo(w * 0.5 + dx - 16, h * 0.44, w * 0.5 + dx + 16, h * 0.34, w * 0.5 + dx - 4, h * 0.20);
      ctx.stroke();
    }
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_noren_ramen', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#2d3b6e'; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 130, ['#3b4d88', '#232e58'], 3, 6, 0.25);
    ctx.fillStyle = '#fff4dc';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.56, 60, 0, PI, false); ctx.closePath(); ctx.fill();
    ctx.fillRect(w * 0.5 - 28, h * 0.56 + 56, 56, 10);
    ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const dx of [-24, 0, 24]) {
      ctx.beginPath(); ctx.moveTo(w * 0.5 + dx, h * 0.48);
      ctx.bezierCurveTo(w * 0.5 + dx - 14, h * 0.36, w * 0.5 + dx + 14, h * 0.26, w * 0.5 + dx, h * 0.15);
      ctx.stroke();
    }
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_noren_bun', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#2d3b6e'; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 130, ['#3b4d88', '#232e58'], 3, 6, 0.25);
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.58, 64, 46, 0, PI, TAU);
    ctx.ellipse(w * 0.5, h * 0.58, 64, 18, 0, 0, PI); ctx.fill();
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_noren_cream', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#f8ecd2'; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 100, ['#fff6e4', '#ead8b8'], 3, 6, 0.25);
    ctx.strokeStyle = '#7a3e26'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, 46, 0.12 * PI, 0.88 * PI); ctx.stroke();
    for (const dx of [-24, 0, 24]) {
      ctx.beginPath(); ctx.moveTo(w * 0.5 + dx, h * 0.56);
      ctx.bezierCurveTo(w * 0.5 + dx - 12, h * 0.42, w * 0.5 + dx + 12, h * 0.32, w * 0.5 + dx, h * 0.20);
      ctx.stroke();
    }
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_fuji_mural', 512, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f4d998'); sky.addColorStop(0.52, '#f9e9be'); sky.addColorStop(1, '#cfe4e8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 120, ['#fae8b6', '#eed08a'], 4, 9, 0.25);
    ctx.fillStyle = '#325688';
    ctx.beginPath(); ctx.moveTo(w * 0.16, h * 0.72); ctx.lineTo(w * 0.50, h * 0.24);
    ctx.lineTo(w * 0.60, h * 0.24); ctx.lineTo(w * 0.94, h * 0.72); ctx.closePath(); ctx.fill();
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_gold_pine_byobu', 512, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#e7ba52'; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 120, ['#fae094', '#cfa03c'], 3, 7, 0.24);
  }, 1, 1);

  for (const [k, b1, b2] of [['bh2_kimono_pink', '#e85d88', '#b83868'], ['bh2_kimono_purple', '#6c48a8', '#482e82']]) {
    paintedCanvasTex(THREE, k, 256, (ctx, s, c, d) => {
      const w = s, h = s, rng = d || c;
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, b1); grd.addColorStop(1, b2);
      ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      brushStrokes(ctx, w, rng, 90, [b1, b2], 3, 6, 0.3);
    }, 1, 1);
  }

  paintedCanvasTex(THREE, 'bh2_taiko_head', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    const grd = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.5);
    grd.addColorStop(0, '#fff4dc'); grd.addColorStop(0.78, '#ebd4ad'); grd.addColorStop(1, '#be9662');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 80, ['#fff8e8', '#dfc49a'], 2, 5, 0.22);
    const cx = w * 0.5, cy = h * 0.5, R = w * 0.33;
    ctx.strokeStyle = '#7c2d1c'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#7c2d1c';
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((i * TAU) / 3 - 0.3);
      ctx.beginPath(); ctx.arc(0, -R * 0.46, R * 0.34, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.88, -PI * 0.52, PI * 0.08, false);
      ctx.arc(R * 0.16, -R * 0.14, R * 0.58, PI * 0.12, -PI * 0.42, true);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_warm_brick', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#6c4c42'; ctx.fillRect(0, 0, w, h);
    const rows = 8, cols = 4, bh = h / rows, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw * 0.5);
      for (let col = -1; col <= cols; col++) {
        ctx.fillStyle = rng.pick(['#b84a39', '#c85843', '#9f3d2e', '#d0664e', '#a84334']);
        ctx.fillRect(col * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    brushStrokes(ctx, w, rng, 120, ['#d87458', '#8a3326'], 2, 4, 0.2);
  }, 2, 2);
}

let _landmarkTex = null;
function getLandmarkTextures(THREE) {
  if (_landmarkTex) return _landmarkTex;

  // Hand-painted mossy-jade Storybook dragon scale gouache canvas
  const dragonScale = paintedCanvasTex(THREE, 'bh_dragon_scales_v1', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#3d7d63');
    grd.addColorStop(0.5, '#4c9272');
    grd.addColorStop(1, '#2f6650');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    const rows = 10, cols = 8, rw = w / cols, rh = h / rows;
    for (let r = 0; r <= rows; r++) {
      const off = (r % 2) * (rw * 0.5);
      for (let col = -1; col <= cols; col++) {
        ctx.fillStyle = rng.pick(['#4f9878', '#3c7b60', '#5ca884', '#46896b', '#67b288']);
        ctx.beginPath();
        ctx.arc(col * rw + off, r * rh, rw * 0.56, 0, PI, false);
        ctx.fill();
        ctx.strokeStyle = 'rgba(24,52,40,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    brushStrokes(ctx, w, rng, 90, ['#7ec49b', '#2b5946', '#9cd4a4'], 2, 5, 0.22);
  }, 3, 2);

  // Woven golden-tan bamboo privacy fence texture
  const bambooFence = paintedCanvasTex(THREE, 'bh_bamboo_fence_v1', 256, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#b98b4e';
    ctx.fillRect(0, 0, w, h);
    const cols = 16, cw = w / cols;
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = rng.pick(['#cfa05e', '#b58446', '#d8ab6a', '#a8783c']);
      ctx.fillRect(i * cw + 1, 0, cw - 2, h);
      ctx.fillStyle = 'rgba(72,44,18,0.35)';
      ctx.fillRect(i * cw, 0, 2, h);
      const ny = ((i * 53) % 180) + 36;
      ctx.fillStyle = '#8b5e2e';
      ctx.fillRect(i * cw + 1, ny, cw - 2, 4);
    }
    for (const ry of [h * 0.22, h * 0.76]) {
      ctx.fillStyle = '#9c6e36';
      ctx.fillRect(0, ry - 6, w, 12);
      ctx.fillStyle = '#2d2420';
      for (let i = 0; i < cols; i += 2) {
        ctx.fillRect(i * cw + 3, ry - 8, cw - 6, 16);
      }
    }
  }, 2, 1);

  // White cotton towel with traditional rust-red onsen double stripe
  const onsenTowel = paintedCanvasTex(THREE, 'bh_onsen_towel_v1', 128, (ctx, s, c, d) => {
    const w = s, h = s, rng = d || c;
    ctx.fillStyle = '#f8f1e5';
    ctx.fillRect(0, 0, w, h);
    brushStrokes(ctx, w, rng, 60, ['#ffffff', '#eadfce'], 2, 6, 0.3);
    ctx.fillStyle = '#b84b3e';
    ctx.fillRect(0, h - 22, w, 5);
    ctx.fillRect(0, h - 13, w, 3);
  }, 1, 1);

  _landmarkTex = { dragonScale, bambooFence, onsenTowel };
  return _landmarkTex;
}

// Shared helper: variable-radius custom tube along a CatmullRomCurve3
function buildTaperedTubeGeo(THREE, curve, tubularSegs, radialSegs, radiusFn, uvRepX = 3, uvRepY = 1) {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const pos = [], norm = [], uvs = [], idx = [];
  const p = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const r = radiusFn(t);
    const cPt = curve.getPointAt(t);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const v = (j / radialSegs) * TAU;
      const cs = Math.cos(v), sn = Math.sin(v);
      nrm.set(N.x * cs + B.x * sn, N.y * cs + B.y * sn, N.z * cs + B.z * sn).normalize();
      p.copy(cPt).addScaledVector(nrm, r);
      pos.push(p.x, p.y, p.z);
      norm.push(nrm.x, nrm.y, nrm.z);
      uvs.push(t * uvRepX, (j / radialSegs) * uvRepY);
    }
  }
  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j, b = (i + 1) * stride + j, c = (i + 1) * stride + j + 1, d = i * stride + j + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

// Shared helper: scatter a lush purple Storybook Hydrangea clump
function addHydrangeaCluster(THREE, K, bm, cx, cy, cz, radius = 0.42, count = 12, batchKey = 'lm_hyd') {
  const { pushInst, jr, pick } = K;
  const leafGeo = () => {
    const g = new THREE.CircleGeometry(0.14, 6);
    g.scale(1, 1.35, 1);
    return g;
  };
  const floretGeo = () => new THREE.IcosahedronGeometry(0.125, 0);
  for (let l = 0; l < count + 3; l++) {
    pushInst(`${batchKey}_lf`, leafGeo, bm.leafInst,
      cx + jr(-radius, radius), cy + jr(0, 0.30), cz + jr(-radius, radius),
      jr(-0.8, 0.8), jr(0, TAU), jr(-0.5, 0.5),
      jr(1.0, 1.45), jr(1.0, 1.45), 1, pick(FOLIAGE_PAL), K.root);
  }
  for (let b = 0; b < count; b++) {
    pushInst(`${batchKey}_fl`, floretGeo, bm.whiteInst,
      cx + jr(-radius * 0.85, radius * 0.85), cy + 0.14 + jr(0, 0.32), cz + jr(-radius * 0.85, radius * 0.85),
      jr(0, 3), jr(0, 3), 0,
      jr(0.9, 1.35), jr(0.8, 1.2), jr(0.9, 1.35), pick(HYDRANGEA_PAL), K.root);
  }
}

// Shared helper: Low Glowing Stone / Yukimi Lantern
function addLowStoneLantern(THREE, K, bm, x, y, z, yukimi = false, scale = 1.0) {
  const { add, rbox } = K;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  K.root.add(g);

  if (yukimi) {
    // 3 curved stone legs + hexagonal snow-viewing umbrella roof
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.3;
      add(rbox(0.10, 0.26, 0.10, 0.03, bm.mossStone), Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14, 0, -a, 0.18, g);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.08, 6), bm.stoneFloor), 0, 0.25, 0, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.28, 6), bm.lanternGlow), 0, 0.42, 0, 0, 0, 0, g);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      add(rbox(0.028, 0.30, 0.028, 0.008, bm.darkTimber), Math.cos(a) * 0.16, 0.42, Math.sin(a) * 0.16, 0, -a, 0, g);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.22, 6), bm.mossStone), 0, 0.65, 0, 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), bm.mossStone), 0, 0.78, 0, 0, 0, 0, g);
  } else {
    // Low waterside stone pedestal lantern (ext_06!)
    add(rbox(0.40, 0.14, 0.40, 0.04, bm.mossStone), 0, 0.07, 0, 0, 0, 0, g);
    add(rbox(0.32, 0.34, 0.32, 0.02, bm.lanternGlow), 0, 0.30, 0, 0, 0, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(rbox(0.036, 0.36, 0.036, 0.01, bm.darkTimber), sx * 0.155, 0.30, sz * 0.155, 0, 0, 0, g);
    }
    add(new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.22, 4), bm.ironWarm), 0, 0.56, 0, 0, PI * 0.25, 0, g);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bm.goldTrim), 0, 0.69, 0, 0, 0, 0, g);
  }
  return g;
}

// ============================================================================
// 1. DRAGON FOUNTAIN (ext_06_courtyard_landmarks.png)
// Steaming turquoise pool ringed by mossy boulders, 4 low stone lanterns,
// hydrangeas & a richly sculpted coiled Mossy-Jade Storybook River-Dragon!
// ============================================================================
export function buildDragonFountain(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'dragon_fountain', 11);
  const { root, add, rbox, boxCol, pushInst, jr, pick } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);
  const LT = getLandmarkTextures(THREE);

  const scaleMat = K.M(0xffffff, LT.dragonScale, { roughness: 0.72, metalness: 0 });
  const bellyMat = K.M(0xebd094, K.tex('plaster', 1.5, 1.5), { roughness: 0.78, metalness: 0 });
  const jadeSkin = K.M(0x4b8f70, null, { roughness: 0.74, metalness: 0 });
  const maneJade = K.M(0x62a878, null, { roughness: 0.80, metalness: 0 });
  const maneCream = K.M(0xf2ead6, null, { roughness: 0.78, metalness: 0 });
  const spineGold = K.M(0xcfc068, null, { roughness: 0.62, metalness: 0, emissive: 0x4a3d10, emissiveIntensity: 0.14 });
  const mouthCoral = K.M(0xc8524b, null, { roughness: 0.78, metalness: 0 });
  const fangIvory = K.M(0xfbf5e6, null, { roughness: 0.55, metalness: 0 });
  const eyeAmber = K.glowMat(0xffea88, 0xff9818, 2.35, { roughness: 0.35, metalness: 0 });
  const foamGlow = K.glowMat(0xeefdff, 0x7ef2ff, 1.35, { roughness: 0.35, metalness: 0 });
  const softSteam = K.M(0xf2fbff, null, { roughness: 1.0, metalness: 0, transparent: true, opacity: 0.19, depthWrite: false });

  // 1. Steaming Turquoise Hot-Spring Basin (radius ≈ 2.35m)
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.38, 2.48, 0.22, 32), bm.stoneFloor), 0, 0.11, 0, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.16, 2.20, 0.10, 36), bm.waterGlow), 0, 0.33, 0, 0, 0, 0, root);

  // 18+ Instanced Mossy Shoreline Boulders around pool perimeter + stacked Dragon Crag on back-left
  const boulderGeo = () => new THREE.IcosahedronGeometry(0.47, 0);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + jr(-0.06, 0.06);
    const rad = 2.22 + jr(-0.12, 0.18);
    const bx = Math.sin(a) * rad, bz = Math.cos(a) * rad;
    const isBackCrag = a < -0.35 && a > -2.35;
    const sy = isBackCrag ? jr(1.05, 1.55) : jr(0.68, 1.05);
    pushInst('df_boulder', boulderGeo, bm.stoneInst,
      bx, sy * 0.32, bz,
      jr(0, 3), jr(0, 3), jr(0, 3),
      jr(0.95, 1.38), sy, jr(0.95, 1.35),
      i % 3 === 0 ? pick(MOSS_BOULDER_PAL) : pick(STONE_BOULDER_PAL), root);
    if (i % 2 === 0) {
      pushInst('df_boulder', boulderGeo, bm.stoneInst,
        bx * 0.92, sy * 0.56 + 0.08, bz * 0.92,
        jr(0, 3), jr(0, 3), 0,
        jr(0.65, 0.95), jr(0.32, 0.48), jr(0.65, 0.95),
        pick(MOSS_BOULDER_PAL), root);
    }
  }

  // Dramatic stacked mossy rock pedestal crag on back-left supporting the coiled River-Dragon
  const cragRocks = [
    [-1.15, 0.52, -0.88, 1.55, 1.25, 1.45, STONE_BOULDER_PAL[0]],
    [-1.58, 0.65, -0.35, 1.35, 1.35, 1.28, MOSS_BOULDER_PAL[0]],
    [-0.65, 0.58, -1.32, 1.32, 1.22, 1.25, STONE_BOULDER_PAL[2]],
    [-1.18, 1.08, -0.68, 1.28, 1.15, 1.22, MOSS_BOULDER_PAL[1]],
    [-1.45, 1.22, -0.95, 0.98, 0.92, 1.02, STONE_BOULDER_PAL[4]],
  ];
  for (const [rx, ry, rz, sx, sy, sz, col] of cragRocks) {
    pushInst('df_boulder', boulderGeo, bm.stoneInst, rx, ry, rz, jr(0, 2), jr(0, 2), 0, sx, sy, sz, col, root);
  }

  // 4 Warm Glowing Low Stone Lanterns around the boulder rim (matching ext_06!)
  addLowStoneLantern(THREE, K, bm, -1.96, 0.36, 1.02, false, 1.02);
  addLowStoneLantern(THREE, K, bm, -0.86, 0.24, 2.18, false, 0.96);
  addLowStoneLantern(THREE, K, bm, 1.08, 0.24, 2.08, false, 0.96);
  addLowStoneLantern(THREE, K, bm, 2.12, 0.30, 0.78, false, 1.00);

  // Blooming Purple Hydrangea clumps & rising hot-spring steam puffs
  addHydrangeaCluster(THREE, K, bm, -2.35, 0.18, 0.38, 0.44, 11, 'df_hyd');
  addHydrangeaCluster(THREE, K, bm, 2.18, 0.18, -0.95, 0.40, 9, 'df_hyd');
  for (let s = 0; s < 8; s++) {
    const sa = (s / 8) * TAU;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + (s % 3) * 0.10, 0), softSteam);
    puff.scale.set(1.25, 0.68, 1.25);
    add(puff, Math.cos(sa) * 1.18 - 0.15, 0.58 + (s % 3) * 0.24, Math.sin(sa) * 1.08, 0, sa, 0, root);
  }

  // 2. Sculpted Coiled Mossy-Jade Storybook River-Dragon!
  const spineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, 1.24, -1.38), // Tail tip curled on crag
    new THREE.Vector3(-1.55, 1.38, -0.95),
    new THREE.Vector3(-1.82, 1.66, -0.22), // Sweeping lower S-coil
    new THREE.Vector3(-1.92, 2.24, -0.28), // Outer left coil rise
    new THREE.Vector3(-1.46, 2.86, -0.68), // High majestic dorsal arch
    new THREE.Vector3(-0.78, 2.94, -0.45), // Muscular shoulder crest
    new THREE.Vector3(-0.26, 2.66, -0.10), // Curved neck
    new THREE.Vector3(0.10, 2.44, 0.18),   // Back of skull
  ]);

  const bodyGeo = buildTaperedTubeGeo(THREE, spineCurve, 56, 12, (t) => {
    if (t < 0.12) return 0.05 + (t / 0.12) * 0.13;
    if (t < 0.72) return 0.18 + Math.sin(((t - 0.12) / 0.60) * PI) * 0.145;
    return 0.26 - ((t - 0.72) / 0.28) * 0.05;
  }, 5, 2);
  add(new THREE.Mesh(bodyGeo, scaleMat), 0, 0, 0, 0, 0, 0, root);

  // Cream-Gold Segmented Ventral Belly Scutes along the dragon's coil + White/Jade Tail Tuft
  const scuteGeo = () => new RoundedBoxGeometry(0.22, 0.055, 0.20, 1, 0.02);
  const spineFinGeo = () => {
    const g = new THREE.ConeGeometry(0.058, 0.36, 5);
    g.translate(0, 0.16, 0);
    g.rotateX(-0.48);
    return g;
  };
  const upWorld = new THREE.Vector3(0, 1, 0);
  const refBelly = new THREE.Vector3(0.45, -0.85, 0.45).normalize();
  const refCrest = new THREE.Vector3(-0.35, 0.92, -0.25).normalize();
  const mTmp = new THREE.Matrix4(), qTmp = new THREE.Quaternion(), sTmp = new THREE.Vector3();
  const rotMat = new THREE.Matrix4();

  for (let i = 1; i <= 18; i++) {
    const t = 0.12 + (i / 19) * 0.82;
    const pt = spineCurve.getPointAt(t);
    const tan = spineCurve.getTangentAt(t).normalize();
    const r = 0.17 + Math.sin(t * PI) * 0.11;
    const bellyDir = refBelly.clone().addScaledVector(tan, -refBelly.dot(tan)).normalize();
    const bellyUp = bellyDir.clone().negate();
    const sideVec = new THREE.Vector3().crossVectors(bellyUp, tan).normalize();
    rotMat.makeBasis(sideVec, bellyUp, tan);
    qTmp.setFromRotationMatrix(rotMat);
    const bp = pt.clone().addScaledVector(bellyDir, r * 0.82);
    const sc = 0.62 + Math.sin(t * PI) * 0.46;
    sTmp.set(sc, sc, sc);
    mTmp.compose(bp, qTmp, sTmp);
    K.pushInstMatrix('df_scute', scuteGeo, bellyMat, mTmp, 0xf0d698, root);
  }

  // 22 Instanced Golden-Green Dorsal Ridge Spines from tail to crown!
  for (let i = 0; i < 22; i++) {
    const t = 0.06 + (i / 21) * 0.90;
    const pt = spineCurve.getPointAt(t);
    const tan = spineCurve.getTangentAt(t).normalize();
    const crestDir = refCrest.clone().addScaledVector(tan, -refCrest.dot(tan)).normalize();
    const r = 0.12 + Math.sin(t * PI) * 0.16;
    const sp = pt.clone().addScaledVector(crestDir, r * 0.88);
    qTmp.setFromUnitVectors(upWorld, crestDir.clone().lerp(tan.clone().negate(), 0.38).normalize());
    const sc = 0.68 + Math.sin(t * PI) * 0.74;
    sTmp.set(sc * 0.85, sc * 1.20, sc);
    mTmp.compose(sp, qTmp, sTmp);
    K.pushInstMatrix('df_spine', spineFinGeo, spineGold, mTmp, i % 2 ? 0xd9c662 : 0x8fb868, root);
  }

  // Flowing Spirit-Fur Tail Plume & Neck Mane Locks
  const tailPlume = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, 1.24, -1.38),
    new THREE.Vector3(-0.52, 1.52, -1.52),
    new THREE.Vector3(-0.78, 1.88, -1.32),
  ]);
  add(new THREE.Mesh(buildTaperedTubeGeo(THREE, tailPlume, 14, 7, (t) => 0.09 * Math.sin(t * PI + 0.25)), maneCream), 0, 0, 0, 0, 0, 0, root);

  // Sculpted Dragon Head, Glowing Amber Eyes, Golden Antlers, Whiskers & Open Fanged Jaws!
  const headG = new THREE.Group();
  headG.position.set(0.14, 2.40, 0.22);
  headG.rotation.set(0.24, 0.42, -0.06); // Facing +Z / slightly +X down into the pool!
  headG.scale.setScalar(1.20);
  root.add(headG);

  // Cranium + Elongated Snout Bridge + Flared Nostrils
  add(rbox(0.44, 0.34, 0.48, 0.12, jadeSkin), 0, 0.04, 0, 0, 0, 0, headG);
  add(rbox(0.30, 0.20, 0.56, 0.08, jadeSkin), 0, -0.02, 0.38, 0.06, 0, 0, headG);
  add(rbox(0.34, 0.15, 0.18, 0.06, jadeSkin), 0, 0.03, 0.62, 0, 0, 0, headG);
  add(rbox(0.26, 0.07, 0.50, 0.03, mouthCoral), 0, -0.10, 0.38, 0, 0, 0, headG);

  // Brow Ridges, Glowing Amber Eyes, Cheek Mane Frills, Antlers & Flowing Golden Whiskers
  for (const sx of [-1, 1]) {
    // Fierce jade brow ridge & glowing golden-amber eye
    add(rbox(0.12, 0.08, 0.26, 0.03, maneJade), sx * 0.19, 0.14, 0.12, -0.12, sx * 0.22, -sx * 0.28, headG);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), eyeAmber), sx * 0.20, 0.07, 0.14, 0, 0, 0, headG);
    // Flared nostril ring
    add(new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.016, 6, 10), jadeSkin), sx * 0.10, 0.08, 0.63, PI * 0.4, 0, 0, headG);

    // Upper ivory fangs
    add(new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.13, 6), fangIvory), sx * 0.11, -0.14, 0.58, PI, 0, 0, headG);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 6), fangIvory), sx * 0.11, -0.12, 0.40, PI, 0, 0, headG);

    // Swept-back Branching Golden Antlers
    const antMain = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.13, 0.18, -0.02),
      new THREE.Vector3(sx * 0.28, 0.42, -0.32),
      new THREE.Vector3(sx * 0.36, 0.68, -0.68),
      new THREE.Vector3(sx * 0.26, 0.84, -0.92),
    ]);
    add(new THREE.Mesh(buildTaperedTubeGeo(THREE, antMain, 14, 6, (t) => 0.045 * (1 - t * 0.72)), bm.goldTrim), 0, 0, 0, 0, 0, 0, headG);
    const antTine = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.30, 0.48, -0.40),
      new THREE.Vector3(sx * 0.48, 0.66, -0.48),
      new THREE.Vector3(sx * 0.52, 0.80, -0.60),
    ]);
    add(new THREE.Mesh(buildTaperedTubeGeo(THREE, antTine, 8, 5, (t) => 0.030 * (1 - t * 0.7)), bm.goldTrim), 0, 0, 0, 0, 0, 0, headG);

    // Flowing Golden Dragon Whiskers curling from upper snout
    const whisker = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.15, 0.02, 0.56),
      new THREE.Vector3(sx * 0.42, 0.08, 0.52),
      new THREE.Vector3(sx * 0.62, -0.06, 0.24),
      new THREE.Vector3(sx * 0.74, 0.08, -0.08),
    ]);
    add(new THREE.Mesh(buildTaperedTubeGeo(THREE, whisker, 16, 5, (t) => 0.022 * (1 - t * 0.65)), bm.goldTrim), 0, 0, 0, 0, 0, 0, headG);

    // Mossy leafy cheek & neck mane tufts
    for (let m = 0; m < 4; m++) {
      const mc = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.20, 0.06 - m * 0.07, -0.04 - m * 0.05),
        new THREE.Vector3(sx * 0.40, 0.10 - m * 0.06, -0.34 - m * 0.08),
        new THREE.Vector3(sx * 0.48, 0.18 - m * 0.05, -0.62 - m * 0.08),
      ]);
      add(new THREE.Mesh(buildTaperedTubeGeo(THREE, mc, 8, 5, (t) => 0.052 * (1 - t * 0.8)), m === 0 ? maneCream : maneJade), 0, 0, 0, 0, 0, 0, headG);
    }
  }

  // Articulated Open Lower Jaw + Lower Fangs + Chin Beard
  const jawG = new THREE.Group();
  jawG.position.set(0, -0.11, 0.08);
  jawG.rotation.x = 0.48;
  headG.add(jawG);
  add(rbox(0.25, 0.11, 0.48, 0.05, bellyMat), 0, -0.03, 0.22, 0, 0, 0, jawG);
  add(rbox(0.19, 0.05, 0.40, 0.02, mouthCoral), 0, 0.02, 0.22, 0, 0, 0, jawG);
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.10, 6), fangIvory), sx * 0.09, 0.06, 0.42, 0, 0, 0, jawG);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.16, 5), spineGold), sx * 0.06, -0.12, 0.36, PI * 0.85, 0, 0, jawG);
  }

  // 3. Gleaming Arched TubeGeometry Turquoise Water Stream + Foaming Concentric Ripples!
  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.32, 2.18, 0.58),
    new THREE.Vector3(0.50, 1.88, 0.82),
    new THREE.Vector3(0.60, 1.22, 0.96),
    new THREE.Vector3(0.64, 0.34, 1.02),
  ]);
  add(new THREE.Mesh(buildTaperedTubeGeo(THREE, streamCurve, 24, 10, (t) => 0.080 + t * 0.075, 2, 1), bm.waterGlow), 0, 0, 0, 0, 0, 0, root);

  // Concentric foaming ripples & splash droplets around water impact point (0.64, 0.38, 1.02)
  for (const [rrRing, tubeR] of [[0.22, 0.028], [0.48, 0.020], [0.78, 0.014], [1.10, 0.010]]) {
    const ring = new THREE.TorusGeometry(rrRing, tubeR, 6, 28);
    ring.rotateX(PI * 0.5);
    add(new THREE.Mesh(ring, foamGlow), 0.64, 0.385, 1.02, 0, 0, 0, root);
  }
  const splashGeo = () => new THREE.IcosahedronGeometry(0.075, 0);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    pushInst('df_splash', splashGeo, foamGlow,
      0.64 + Math.cos(a) * jr(0.08, 0.24), 0.42 + jr(0, 0.14), 1.02 + Math.sin(a) * jr(0.08, 0.24),
      jr(0, 3), jr(0, 3), 0, jr(0.8, 1.4), jr(0.6, 1.1), jr(0.8, 1.4), 0xeefdff, root);
  }

  boxCol(0, 0, 3.85, 3.85);
  return K.finalize();
}

// ============================================================================
// 2. SHORO BELL PAVILION (ext_06_courtyard_landmarks.png)
// Raised stone & railed vermilion base, 4 vermilion pillars, 2 hanging golden
// lanterns, Verdigris Kawara gable roof & cast-bronze Bonsho Temple Bell!
// ============================================================================
export function buildBellPavilion(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'bell_pavilion', 17);
  const { root, add, rbox, boxCol, pushInst, pick } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);

  // Warm cast-bronze olive material (100% metalness: 0!)
  const bronzeBellMat = K.M(0x8d8456, K.tex('painted_metal', 1.5, 1.5), {
    roughness: 0.46,
    metalness: 0,
    emissive: 0x3b3012,
    emissiveIntensity: 0.22,
  });
  const bronzeBandMat = K.M(0xbca660, null, { roughness: 0.42, metalness: 0, emissive: 0x4a3c14, emissiveIntensity: 0.22 });
  const twilightStone = K.G(0x968e9e, K.tex('plaster', 1.6, 1.6), 0.70, 0.55);

  const BW = 3.1, BD = 3.1, BH = 0.62;

  // 1. Raised Stone Platform & Dressed Blocks + Front Steps (+Z)
  add(rbox(BW, BH, BD, 0.06, twilightStone), 0, BH * 0.5, 0, 0, 0, 0, root);
  const blkGeo = () => new RoundedBoxGeometry(0.52, 0.28, 0.32, 2, 0.06);
  for (let i = -2; i <= 2; i++) {
    for (const sz of [-1, 1]) {
      if (sz > 0 && Math.abs(i) <= 1) continue;
      pushInst('bp_blk', blkGeo, bm.stoneInst, i * 0.58, 0.28, sz * (BD * 0.5 + 0.04), 0, 0, 0, 1, 1.1, 1, pick(STONE_BOULDER_PAL), root);
    }
    for (const sx of [-1, 1]) {
      pushInst('bp_blk', blkGeo, bm.stoneInst, sx * (BW * 0.5 + 0.04), 0.28, i * 0.58, 0, PI * 0.5, 0, 1, 1.1, 1, pick(STONE_BOULDER_PAL), root);
    }
  }
  for (let s = 0; s < 3; s++) {
    add(rbox(1.32, 0.18, 0.36, 0.03, twilightStone), 0, BH * (1 - s / 3) - 0.08, BD * 0.5 + 0.18 + s * 0.30, 0, 0, 0, root);
  }

  // Low Vermilion Perimeter Balustrade around Platform (leaving front steps open!)
  const rOff = 1.38;
  // Back, Left, Right rails
  add(rbox(2.84, 0.075, 0.08, 0.02, bm.vermilion), 0, BH + 0.46, -rOff, 0, 0, 0, root);
  add(rbox(2.84, 0.055, 0.06, 0.015, bm.vermilion), 0, BH + 0.24, -rOff, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    add(rbox(0.08, 0.075, 2.84, 0.02, bm.vermilion), sx * rOff, BH + 0.46, 0, 0, 0, 0, root);
    add(rbox(0.06, 0.055, 2.84, 0.015, bm.vermilion), sx * rOff, BH + 0.24, 0, 0, 0, 0, root);
    // Front side segments flanking steps
    add(rbox(0.76, 0.075, 0.08, 0.02, bm.vermilion), sx * 1.02, BH + 0.46, rOff, 0, 0, 0, root);
    add(rbox(0.76, 0.055, 0.06, 0.015, bm.vermilion), sx * 1.02, BH + 0.24, rOff, 0, 0, 0, root);
    add(rbox(0.12, 0.52, 0.12, 0.02, bm.vermilion), sx * 0.66, BH + 0.26, rOff, 0, 0, 0, root);
  }

  // 2. 4 Thick Vermilion Pillars + Temple Tie-Beams & Stepped Brackets
  const pSpan = 1.18, yTop = 3.06;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * pSpan, pz = sz * pSpan;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.18, 12), bm.ironWarm), px, BH + 0.09, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.19, yTop - BH - 0.18, 14), bm.vermilion),
        px, BH + 0.18 + (yTop - BH - 0.18) * 0.5, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.065, 14), bm.goldTrim), px, yTop - 0.24, pz, 0, 0, 0, root);
      add(rbox(0.46, 0.14, 0.46, 0.03, bm.vermilionDeep), px, yTop - 0.06, pz, 0, 0, 0, root);
    }
    add(rbox(0.20, 0.22, 2.86, 0.03, bm.vermilion), sx * pSpan, yTop - 0.22, 0, 0, 0, 0, root);
    add(rbox(2.86, 0.22, 0.20, 0.03, bm.vermilion), 0, yTop - 0.22, sx * pSpan, 0, 0, 0, root);

    // 2 Warm Hanging Golden Lanterns flanking the front-left & front-right eaves (ext_06!)
    const lx = sx * 1.54, ly = 2.40, lz = 0.88;
    add(rbox(0.44, 0.09, 0.09, 0.02, bm.vermilionDeep), sx * 1.36, 2.82, lz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 6), bm.goldTrim), lx, 2.70, lz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.34, 6), bm.lanternGlow), lx, ly, lz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.15, 6), bm.ironWarm), lx, ly + 0.22, lz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.10, 0.06, 6), bm.ironWarm), lx, ly - 0.19, lz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bm.goldTrim), lx, ly + 0.31, lz, 0, 0, 0, root);
  }

  // Cross-beam holding the Bonsho Bell
  add(rbox(2.65, 0.22, 0.24, 0.03, bm.darkTimber), 0, yTop - 0.08, 0, 0, 0, 0, root);

  // 3. Sweeping Verdigris 3D Instanced Kawara Gable Roof on K.root!
  const bellRoof = buildKawaraGableRoof(THREE, K, {
    cx: 0, cz: 0, yBase: yTop,
    spanX: 3.4, spanZ: 3.2, rise: 1.25,
    overhangX: 0.62, overhangZ: 0.58,
    ridgeAlongX: false,
    palette: VERDIGRIS_PAL,
    finial: 'onigawara',
    parent: root,
    batchPrefix: 'bell_kaw',
  });

  // Recessed dark-timber gable tympanum + vermilion tie-beam + sculpted golden gegyo crest!
  {
    const tymShape = new THREE.Shape();
    tymShape.moveTo(-1.72, yTop - 0.02);
    tymShape.lineTo(1.72, yTop - 0.02);
    tymShape.lineTo(0, bellRoof.ridgeY - 0.06);
    tymShape.closePath();
    const tymGeo = new THREE.ExtrudeGeometry(tymShape, { depth: 0.12, bevelEnabled: false });
    for (const sz of [-1, 1]) {
      const gz = sz * (bellRoof.ridgeLen * 0.5 - 0.36);
      add(new THREE.Mesh(tymGeo, bm.darkTimber), 0, 0, gz - 0.06, 0, 0, 0, root);
      add(rbox(2.55, 0.16, 0.18, 0.03, bm.vermilion), 0, yTop + 0.10, gz + sz * 0.14, 0, 0, 0, root);
      add(rbox(0.24, 0.24, 0.08, 0.025, bm.goldTrim), 0, bellRoof.ridgeY - 0.30, sz * (bellRoof.ridgeLen * 0.5 + 0.04), 0, 0, PI * 0.25, root);
    }
  }

  // 4. Heavy Sculpted Cast-Bronze Bonsho Temple Bell (LatheGeometry + 36 Studs + Wooden Shumoku!)
  const bellBaseY = 1.66;
  const bellPts = [
    new THREE.Vector2(0.46, 0.00),
    new THREE.Vector2(0.51, 0.04), // Flared koma-no-tsume lip
    new THREE.Vector2(0.48, 0.10),
    new THREE.Vector2(0.45, 0.32),
    new THREE.Vector2(0.43, 0.64),
    new THREE.Vector2(0.38, 0.84),
    new THREE.Vector2(0.24, 0.96),
    new THREE.Vector2(0.00, 1.00),
  ];
  add(new THREE.Mesh(new THREE.LatheGeometry(bellPts, 28), bronzeBellMat), 0, bellBaseY, 0, 0, 0, 0, root);
  // Dark hollow interior underside disc
  const innerBell = new THREE.CircleGeometry(0.44, 24);
  innerBell.rotateX(PI * 0.5);
  add(new THREE.Mesh(innerBell, bm.ironWarm), 0, bellBaseY + 0.02, 0, 0, 0, 0, root);

  // Horizontal bronze relief bands (kesa-dasuki) + Dragon-head hook (ryuzu)
  for (const [ry, rrB] of [[0.14, 0.47], [0.46, 0.445], [0.80, 0.40]]) {
    const band = new THREE.TorusGeometry(rrB, 0.018, 6, 28);
    band.rotateX(PI * 0.5);
    add(new THREE.Mesh(band, bronzeBandMat), 0, bellBaseY + ry, 0, 0, 0, 0, root);
  }
  add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.036, 8, 16), bronzeBandMat), 0, bellBaseY + 1.06, 0, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 8), bm.ironWarm), 0, bellBaseY + 1.20, 0, 0, 0, 0, root);

  // 36 Instanced Bronze Boss Studs (chichi) + Front/Back Lotus Striking Medallions (tsuki-za)
  const studGeo = () => new THREE.SphereGeometry(0.022, 6, 5);
  for (let panel = 0; panel < 4; panel++) {
    const baseA = (panel / 4) * TAU + PI * 0.25;
    for (let r = 0; r < 3; r++) {
      const sy = bellBaseY + 0.54 + r * 0.085;
      const rad = 0.435 - r * 0.014;
      for (let c = -1; c <= 1; c++) {
        const a = baseA + c * 0.14;
        pushInst('bell_stud', studGeo, bronzeBandMat,
          Math.sin(a) * rad, sy, Math.cos(a) * rad, 0, 0, 0, 1, 1, 1, 0x948e62, root);
      }
    }
  }
  for (const sz of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 12), bm.goldTrim),
      0, bellBaseY + 0.28, sz * 0.455, PI * 0.5, 0, 0, root);
  }

  // Suspended Wooden Striking Beam (Shumoku) hanging on ropes ready to toll the bell!
  const shuX = 0.68, shuY = bellBaseY + 0.28;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.96, 10), bm.cedar), shuX, shuY, 0, 0, 0, PI * 0.5, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.08, 10), bm.goldTrim), shuX - 0.44, shuY, 0, 0, 0, PI * 0.5, root);
  for (const dx of [-0.26, 0.28]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, yTop - 0.18 - shuY, 5), bm.hinoki),
      shuX + dx, (yTop - 0.18 + shuY) * 0.5, 0, 0, 0, 0, root);
  }

  boxCol(0, 0, 2.55, 2.55);
  return K.finalize();
}

// ============================================================================
// 3. RED CLOTH SPIRIT FESTIVAL STALL (ext_06_courtyard_landmarks.png)
// Corrugated crimson cloth awning with golden trim & scalloped valance,
// 4 warm timber posts, 4 glowing chochin lanterns & spirit fruit crates!
// ============================================================================
export function buildSpiritStall(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'spirit_stall', 23);
  const { root, add, rbox, boxCol, pushInst, jr, pick } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);

  const crimsonCloth = K.M(0xc82b34, null, { roughness: 0.84, metalness: 0 });
  const crimsonDeep = K.M(0x9e1d25, null, { roughness: 0.86, metalness: 0 });
  const wickerMat = K.M(0xb8864b, K.tex('wood_light', 2, 2), { roughness: 0.86, metalness: 0 });

  const W = 2.86, D = 1.76, HC = 0.88, HP = 2.46;

  // 1. Warm Timber Paneled Counter & 4 Corner Posts + Front Wicker Basket Crate (ext_06!)
  add(rbox(W, HC - 0.08, D, 0.03, bm.cedar), 0, (HC - 0.08) * 0.5 + 0.04, 0, 0, 0, 0, root);
  add(rbox(W + 0.14, 0.08, D + 0.14, 0.025, bm.hinoki), 0, HC + 0.02, 0, 0, 0, 0, root);
  for (let i = -3; i <= 3; i++) {
    add(rbox(0.32, HC - 0.24, 0.04, 0.01, bm.darkTimber), i * 0.39, HC * 0.46, D * 0.5 + 0.01, 0, 0, 0, root);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(rbox(0.13, HP, 0.13, 0.025, bm.cedar), sx * (W * 0.5 - 0.06), HP * 0.5, sz * (D * 0.5 - 0.06), 0, 0, 0, root);
    }
    add(rbox(0.11, 0.14, D + 0.16, 0.02, bm.darkTimber), sx * (W * 0.5 - 0.06), HP - 0.06, 0, 0, 0, 0, root);
  }
  add(rbox(W + 0.16, 0.13, 0.11, 0.02, bm.darkTimber), 0, HP - 0.06, D * 0.5 - 0.06, 0, 0, 0, root);
  add(rbox(W + 0.16, 0.13, 0.11, 0.02, bm.darkTimber), 0, HP - 0.06, -D * 0.5 + 0.06, 0, 0, 0, root);

  // Woven bamboo wicker crate in front of the stall counter (matching ext_06!)
  add(rbox(0.58, 0.54, 0.48, 0.03, wickerMat), 0.18, 0.27, D * 0.5 + 0.26, 0, 0.05, 0, root);
  add(rbox(0.62, 0.07, 0.52, 0.02, bm.hinoki), 0.18, 0.55, D * 0.5 + 0.26, 0, 0.05, 0, root);
  for (const wy of [0.16, 0.38]) {
    add(rbox(0.60, 0.045, 0.50, 0.015, bm.darkTimber), 0.18, wy, D * 0.5 + 0.26, 0, 0.05, 0, root);
  }

  // 2. Corrugated Crimson Cloth Awning with Golden Trim & Scalloped Front Valance!
  const awW = 3.32, awHalfZ = 1.20, awRise = 0.66, awY = HP + 0.02;
  const slopeL = Math.hypot(awHalfZ, awRise), pitch = Math.atan2(awRise, awHalfZ);
  const ribGeo = () => {
    const g = new THREE.CylinderGeometry(0.042, 0.045, slopeL + 0.04, 7);
    g.rotateX(PI * 0.5);
    return g;
  };
  const scallopGeo = () => new RoundedBoxGeometry(0.24, 0.19, 0.035, 2, 0.06);

  for (const sz of [-1, 1]) {
    add(rbox(awW, 0.06, slopeL, 0.02, crimsonCloth),
      0, awY + awRise * 0.5, sz * awHalfZ * 0.5, sz * pitch, 0, 0, root);
    // Corrugated crimson cloth ribs down each slope
    const nRibs = 13;
    for (let r = 0; r < nRibs; r++) {
      const rx = -awW * 0.47 + (r / (nRibs - 1)) * awW * 0.94;
      pushInst('st_rib', ribGeo, r % 2 === 0 ? crimsonCloth : crimsonDeep,
        rx, awY + awRise * 0.5 + 0.03, sz * awHalfZ * 0.5, sz * pitch, 0, 0, 1, 0.65, 1,
        r % 2 === 0 ? 0xd9333c : 0xa82128, root);
    }
    // Golden eave trim bar + scalloped crimson valance tabs!
    add(rbox(awW + 0.06, 0.045, 0.05, 0.015, bm.goldTrim), 0, awY + 0.02, sz * awHalfZ, 0, 0, 0, root);
    const nScallops = 12;
    for (let s = 0; s < nScallops; s++) {
      const sx = -awW * 0.46 + (s / (nScallops - 1)) * awW * 0.92;
      pushInst('st_scal', scallopGeo, crimsonCloth,
        sx, awY - 0.08, sz * awHalfZ, 0, 0, 0, 1, 1, 1, s % 2 === 0 ? 0xd63038 : 0xb5232b, root);
    }
  }
  // Golden ridge beam & ornate gable end-trims
  add(rbox(awW + 0.14, 0.10, 0.12, 0.03, bm.goldTrim), 0, awY + awRise + 0.04, 0, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(rbox(0.08, 0.12, slopeL + 0.06, 0.02, crimsonDeep),
        sx * (awW * 0.5), awY + awRise * 0.5, sz * awHalfZ * 0.5, sz * pitch, 0, 0, root);
    }
  }

  // 3. 4 Glowing Red-Orange Chochin Lanterns Strung Under the Front Eave!
  for (const lx of [-1.24, -0.42, 0.42, 1.24]) {
    addChochinLantern(THREE, K, {
      x: lx, y: HP - 0.30, z: D * 0.5 + 0.22,
      radius: 0.20, height: 0.40, red: true, tassel: true, parent: root,
    });
  }

  // 4. Counter Display: Wooden Crates of Spirit Fruits (Peaches, Yuzu, Apples) & Steamed Bun Boxes!
  const topY = HC + 0.06;
  const pinkBoxMat = K.M(0xffffff, bm.BT.kimonoPink, { roughness: 0.78, metalness: 0 });
  // Slanted front wooden fruit trays with raised wooden dividers
  for (const cx of [-0.62, 0.58]) {
    add(rbox(1.14, 0.16, 0.74, 0.02, bm.cedar), cx, topY + 0.08, 0.24, 0.14, 0, 0, root);
    add(rbox(0.04, 0.18, 0.72, 0.01, bm.hinoki), cx, topY + 0.14, 0.24, 0.14, 0, 0, root);
  }
  // Back display shelf with stacked wooden bun boxes & pink/white festival treat boxes
  add(rbox(W - 0.32, 0.28, 0.58, 0.02, bm.darkTimber), 0, topY + 0.14, -0.44, 0, 0, 0, root);
  const fruitGeo = () => new THREE.SphereGeometry(0.086, 8, 7);
  const fruitCols = [
    0xff8c7e, // Spirit peach
    0xffca38, // Golden yuzu citrus
    0xe03b30, // Crisp crimson apple
    0xb4de6c, // Pale jade melon-pear
    0xffaa58, // Persimmon
  ];
  // Base layer + mounded pyramid top layer of spirit fruits!
  const subTrays = [[-0.90, 0], [-0.34, 1], [0.30, 2], [0.86, 4]];
  for (const [tx, colIdx] of subTrays) {
    const colHex = fruitCols[colIdx];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const fx = tx - 0.16 + c * 0.16 + jr(-0.015, 0.015);
        const fz = 0.46 - r * 0.145 + jr(-0.015, 0.015);
        const fy = topY + 0.17 + r * 0.022;
        pushInst('st_fruit', fruitGeo, bm.whiteInst, fx, fy, fz, 0, jr(0, TAU), 0, jr(0.95, 1.12), jr(0.88, 1.05), jr(0.95, 1.12), colHex, root);
      }
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const fx = tx - 0.08 + c * 0.16;
        const fz = 0.39 - r * 0.145;
        const fy = topY + 0.29 + r * 0.022;
        pushInst('st_fruit', fruitGeo, bm.whiteInst, fx, fy, fz, 0, jr(0, TAU), 0, 0.98, 0.92, 0.98, colIdx === 1 ? fruitCols[3] : colHex, root);
      }
    }
  }

  // Steamed bun boxes (seiro), sakura-pink gift boxes & lucky spirit gourd on upper back shelf!
  const bunGeo = () => new THREE.SphereGeometry(0.068, 8, 6);
  for (const bx of [-0.92, -0.34]) {
    add(rbox(0.46, 0.16, 0.42, 0.02, bm.hinoki), bx, topY + 0.36, -0.42, 0, jr(-0.05, 0.05), 0, root);
    add(rbox(0.46, 0.14, 0.42, 0.02, bm.cedar), bx, topY + 0.51, -0.44, 0, jr(-0.05, 0.05), 0, root);
    for (const dx of [-0.10, 0.10]) for (const dz of [-0.08, 0.08]) {
      pushInst('st_bun', bunGeo, bm.whiteInst, bx + dx, topY + 0.60, -0.44 + dz, 0, 0, 0, 1, 0.80, 1, 0xfff5e2, root);
    }
  }
  for (const bx of [0.30, 0.88]) {
    add(rbox(0.44, 0.22, 0.38, 0.025, pinkBoxMat), bx, topY + 0.39, -0.42, 0, jr(-0.06, 0.06), 0, root);
    add(rbox(0.46, 0.04, 0.40, 0.01, bm.goldTrim), bx, topY + 0.40, -0.42, 0, jr(-0.06, 0.06), 0, root);
    add(rbox(0.36, 0.18, 0.32, 0.02, bm.hinoki), bx, topY + 0.59, -0.44, 0, 0.08, 0, root);
    for (const dx of [-0.08, 0.08]) {
      pushInst('st_bun', bunGeo, bm.whiteInst, bx + dx, topY + 0.70, -0.44, 0, 0, 0, 1.05, 0.82, 1.05, 0xffbfd0, root);
    }
  }
  // Golden lucky gourd centerpiece on back shelf
  add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bm.goldTrim), -0.02, topY + 0.38, -0.38, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), bm.goldTrim), -0.02, topY + 0.52, -0.38, 0, 0, 0, root);

  boxCol(0, 0, 3.1, 2.0);
  return K.finalize();
}

// ============================================================================
// 4. ARCHED VERMILION TAIKOBASHI DRUM BRIDGE (overview.png)
// Curved walkable cedar deck (userData.ground = true), twin curved vermilion
// arch beams, balusters, handrails, 4 golden giboshi finials & 4 corner lanterns!
// Side rail colliders ONLY: boxCol(0, ±width*0.48, length, 0.22)!
// ============================================================================
export function buildRedBridge(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'red_bridge', 31);
  const { root, add, rbox, boxCol, pushInst } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);

  const length = opts.length ?? opts.len ?? 6.8;
  const width = opts.width ?? opts.w ?? 3.2;
  const arch = opts.arch ?? 0.72;
  const halfL = length * 0.5;
  const zRail = width * 0.46;

  const archY = (x) => {
    const u = Math.min(1, Math.abs(x) / halfL);
    return Math.cos(u * PI * 0.5) * arch;
  };
  const archSlope = (x) => {
    const dx = 0.05;
    return Math.atan2(archY(x + dx) - archY(x - dx), dx * 2);
  };

  // 1. Curved Cedar Deck Planks merged into ONE walkable mesh (userData.ground = true = 1 draw call!)
  const nPlanks = Math.max(18, Math.round(length / 0.28));
  const plankW = (length / nPlanks) * 0.96;
  const deckGeos = [];
  for (let i = 0; i < nPlanks; i++) {
    const px = -halfL + (i + 0.5) * (length / nPlanks);
    const py = archY(px) + 0.06;
    const ang = archSlope(px);
    const pg = new RoundedBoxGeometry(plankW, 0.11, width - 0.16, 1, 0.02);
    pg.rotateZ(ang);
    pg.translate(px, py, 0);
    deckGeos.push(pg);
  }
  const deckMesh = new THREE.Mesh(mergeGeometries(deckGeos, false), bm.cedar);
  deckMesh.name = 'bridge_walkable_deck';
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  deckMesh.userData.ground = true;
  deckMesh.userData.keep = true;
  root.add(deckMesh);
  deckGeos.forEach((g) => g.dispose());

  // Stone abutments at ±halfL & twin submerged stone canal pilings
  for (const sx of [-1, 1]) {
    add(rbox(0.56, 0.34, width + 0.26, 0.05, bm.stoneFloor), sx * (halfL - 0.10), -0.02, 0, 0, 0, 0, root);
    for (const sz of [-1, 1]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, arch * 0.85 + 0.45, 10), bm.mossStone),
        sx * (length * 0.20), (arch * 0.85 - 0.35) * 0.5, sz * (width * 0.34), 0, 0, 0, root);
    }
  }

  // 2. Twin Curved Vermilion Arch Stringers, Curved Top & Mid Handrails & Balusters!
  const balGeo = () => new RoundedBoxGeometry(0.075, 0.78, 0.075, 1, 0.018);
  const giboshiPts = [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.095, 0.00),
    new THREE.Vector2(0.105, 0.05),
    new THREE.Vector2(0.082, 0.10),
    new THREE.Vector2(0.102, 0.16),
    new THREE.Vector2(0.065, 0.24),
    new THREE.Vector2(0.018, 0.31),
    new THREE.Vector2(0.00, 0.33),
  ];
  const giboshiGeo = new THREE.LatheGeometry(giboshiPts, 14);

  for (const sz of [-1, 1]) {
    const rz = sz * zRail;
    const beamPts = [], topPts = [], midPts = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const px = -halfL + (i / N) * length;
      const py = archY(px);
      beamPts.push(new THREE.Vector3(px, py + 0.02, rz));
      topPts.push(new THREE.Vector3(px, py + 0.90, rz));
      midPts.push(new THREE.Vector3(px, py + 0.52, rz));
    }
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beamPts), 28, 0.13, 8, false), bm.vermilionDeep), 0, 0, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topPts), 28, 0.062, 8, false), bm.vermilion), 0, 0, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(midPts), 28, 0.042, 7, false), bm.vermilion), 0, 0, 0, 0, 0, 0, root);

    // Vertical vermilion balusters along the arch
    const nBal = Math.max(8, Math.round(length / 0.52));
    for (let b = 1; b < nBal; b++) {
      const bx = -halfL + (b / nBal) * length;
      pushInst('br_bal', balGeo, bm.vermilion, bx, archY(bx) + 0.48, rz, 0, 0, 0, 1, 1, 1, 0xd43b2f, root);
    }

    // Turned mid-span & quarter-span vermilion posts with gleaming Golden Giboshi Onion Finials!
    for (const gx of [-length * 0.22, length * 0.22]) {
      const gy = archY(gx);
      add(rbox(0.15, 0.98, 0.15, 0.03, bm.vermilion), gx, gy + 0.49, rz, 0, 0, 0, root);
      add(new THREE.Mesh(giboshiGeo, bm.goldTrim), gx, gy + 0.98, rz, 0, 0, 0, root);
    }

    // 4 Warm Corner Post Lanterns at the 4 bridge ends!
    for (const sx of [-1, 1]) {
      const cx = sx * (halfL - 0.16), cy = archY(cx);
      add(rbox(0.26, 0.98, 0.26, 0.04, bm.vermilion), cx, cy + 0.49, rz, 0, 0, 0, root);
      add(new THREE.Mesh(giboshiGeo, bm.goldTrim), cx - sx * 0.32, archY(cx - sx * 0.32) + 0.94, rz, 0, 0, 0, root);
      add(rbox(0.32, 0.07, 0.32, 0.02, bm.darkTimber), cx, cy + 1.00, rz, 0, 0, 0, root);
      add(rbox(0.24, 0.28, 0.24, 0.02, bm.lanternGlow), cx, cy + 1.17, rz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.20, 4), bm.ironWarm), cx, cy + 1.40, rz, 0, PI * 0.25, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), bm.goldTrim), cx, cy + 1.52, rz, 0, 0, 0, root);
    }

    // Side rail collider ONLY so center bridge deck & any under-bridge boardwalk stay 100% walkable!
    boxCol(0, sz * (width * 0.48), length, 0.22);
  }

  const out = K.finalize();
  out.userData.colliderBottom = -0.12;
  out.userData.colliderHeight = arch + 1.55;
  return out;
}

// ============================================================================
// 5. MAJESTIC VERMILION RYOBU WATER TORII GATE (overview.png)
// Twin main vermilion columns on stone pedestals + low outrigger pillars
// (chigo-bashira), nuki tie beam, upturned double kasagi lintel with dark
// verdigris cap, framed golden gakuzuka tablet & 4 glowing hanging lanterns!
// ============================================================================
export function buildToriiGate(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'torii_gate', 41);
  const { root, add, rbox, boxCol } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);

  const span = opts.span ?? 5.2;
  const height = opts.height ?? 6.2;
  const halfS = span * 0.5;
  const verdigrisCap = K.M(0x2d6f64, K.tex('roof_tiles', 2, 1), { roughness: 0.68, metalness: 0 });
  const darkNemaki = K.M(0x2d2934, K.tex('stone', 1, 1), { roughness: 0.72, metalness: 0 });

  // 1. Twin Main Vermilion Columns + Submerged Stone Pedestals + Low Chigo-Bashira Outriggers!
  const colTopY = height - 0.34;
  for (const sx of [-1, 1]) {
    const px = sx * halfS;
    // Stone lagoon pedestal + black nemaki base sleeve + gold collar
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.62, 0.44, 12), bm.mossStone), px, 0.16, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.39, 0.78, 14), darkNemaki), px, 0.68, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.07, 14), bm.goldTrim), px, 1.08, 0, 0, 0, 0, root);

    // Tall slightly inward-canted main vermilion hashira column
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, colTopY - 0.90, 16), bm.vermilion),
      px - sx * 0.05, 0.90 + (colTopY - 0.90) * 0.5, 0, 0, 0, sx * 0.018, root);

    // Ryobu Torii Outrigger Pillars (chigo-bashira) on ±Z + cross-rails + mini verdigris roofs!
    const outH = height * 0.40;
    for (const sz of [-1, 1]) {
      const oz = sz * 0.94;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 0.34, 10), bm.mossStone), px, 0.12, oz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.46, 12), darkNemaki), px, 0.46, oz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, outH - 0.55, 12), bm.vermilion),
        px, 0.55 + (outH - 0.55) * 0.5, oz, 0, 0, 0, root);
      add(rbox(0.46, 0.12, 0.48, 0.03, verdigrisCap), px, outH + 0.04, oz, 0, 0, 0, root);
    }
    // Cross-tie beams (hikae-nuki) linking outrigger columns through main column
    add(rbox(0.14, 0.16, 2.28, 0.025, bm.vermilion), px, outH * 0.78, 0, 0, 0, 0, root);
    add(rbox(0.14, 0.14, 2.20, 0.025, bm.vermilion), px, outH * 0.42, 0, 0, 0, 0, root);

    // Side pillar boxCol ONLY so center water/walkway channel is 100% open!
    boxCol(px, 0, 0.88, 2.15);
  }

  // 2. Penetrating Lower Nuki Tie Beam + End Wedges (Kusabi)
  const nukiY = height * 0.76;
  const nukiSpan = span + 1.95;
  add(rbox(nukiSpan, 0.28, 0.20, 0.03, bm.vermilion), 0, nukiY, 0, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    add(rbox(0.18, 0.38, 0.28, 0.02, darkNemaki), sx * (halfS + 0.34), nukiY + 0.04, 0, 0, 0, -sx * 0.15, root);
  }

  // 3. Sweeping Upturned Double Kasagi & Shimaki Lintel with Dark Verdigris Cap!
  const kasagiW = span + 2.95;
  const kCurvePts = [];
  for (let i = 0; i <= 24; i++) {
    const u = (i / 24) * 2 - 1; // -1 .. +1
    const flare = Math.pow(Math.abs(u), 2.8) * 0.52;
    kCurvePts.push(new THREE.Vector3(u * (kasagiW * 0.5), flare, 0));
  }
  const kCurve = new THREE.CatmullRomCurve3(kCurvePts);
  // Lower shimaki vermilion beam
  add(new THREE.Mesh(new THREE.TubeGeometry(kCurve, 28, 0.17, 8, false), bm.vermilion), 0, height - 0.32, 0, 0, 0, 0, root);
  // Upper kasagi vermilion beam
  add(new THREE.Mesh(new THREE.TubeGeometry(kCurve, 28, 0.20, 8, false), bm.vermilionDeep), 0, height - 0.12, 0, 0, 0, 0, root);
  // Dark verdigris curved temple cap sitting directly atop the kasagi lintel!
  const capGeo = new THREE.TubeGeometry(kCurve, 28, 0.24, 8, false);
  capGeo.scale(1.02, 0.56, 1.34);
  add(new THREE.Mesh(capGeo, verdigrisCap), 0, height + 0.06, 0, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    add(rbox(0.22, 0.32, 0.48, 0.03, bm.goldTrim), sx * (kasagiW * 0.5 + 0.04), height + 0.40, 0, 0, 0, -sx * 0.36, root);
  }

  // 4. Framed Golden Central Gakuzuka Tablet between Nuki and Kasagi
  const tabY = (nukiY + height - 0.30) * 0.5;
  const tabH = (height - 0.36) - nukiY;
  add(rbox(0.84, tabH + 0.08, 0.18, 0.03, bm.goldTrim), 0, tabY, 0, 0, 0, 0, root);
  add(rbox(0.66, tabH - 0.10, 0.21, 0.02, darkNemaki), 0, tabY, 0, 0, 0, 0, root);
  // Sculpted golden kanji emblem inside tablet
  add(rbox(0.22, tabH * 0.54, 0.24, 0.02, bm.goldTrim), 0, tabY, 0, 0, 0, 0, root);
  add(rbox(0.40, 0.08, 0.24, 0.02, bm.goldTrim), 0, tabY + 0.13, 0, 0, 0, 0, root);
  add(rbox(0.36, 0.08, 0.24, 0.02, bm.goldTrim), 0, tabY - 0.13, 0, 0, 0, 0, root);

  // 5. 4 Glowing Hanging Lanterns Under the Lintel (matching overview.png!)
  const lanternXs = [-(halfS + 0.68), -(halfS - 0.86), (halfS - 0.86), (halfS + 0.68)];
  for (const lx of lanternXs) {
    const isOuter = Math.abs(lx) > halfS;
    const anchorY = isOuter ? height - 0.16 : nukiY - 0.14;
    const ly = anchorY - 0.52;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), bm.goldTrim), lx, anchorY - 0.18, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.17, 0.42, 6), bm.lanternGlow), lx, ly, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.18, 6), verdigrisCap), lx, ly + 0.26, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.12, 0.07, 6), darkNemaki), lx, ly - 0.23, 0, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), bm.vermilion), lx, ly - 0.34, 0, PI, 0, 0, root);
  }

  return K.finalize();
}

// ============================================================================
// 6. OUTDOOR MOSSY-ROCK ROTENBURO HOT SPRING (int_06_courtyard_landmarks.png)
// Steaming turquoise boulder pool, woven bamboo privacy screen + tall green
// bamboo stalks & hydrangeas, shingled kakehi shelter with 3-panel cream ♨ noren,
// bamboo water spout, foreground cedar bucket & draped towel, 2 yukimi lanterns!
// ============================================================================
export function buildRotenburo(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'rotenburo', 53);
  const { root, add, rbox, boxCol, pushInst, jr, pick } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);
  const LT = getLandmarkTextures(THREE);

  const bambooStalkMat = K.M(0x63a64c, null, { roughness: 0.68, metalness: 0 });
  const bambooGoldMat = K.M(0xd4a652, K.tex('wood_light', 1.5, 1.5), { roughness: 0.68, metalness: 0 });
  const fenceMat = K.M(0xffffff, LT.bambooFence, { roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
  const towelMat = K.M(0xffffff, LT.onsenTowel, { roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  const foamGlow = K.glowMat(0xeefdff, 0x7ef2ff, 1.30, { roughness: 0.35, metalness: 0 });

  // 1. Walkable Stone Bath Floor + Stepping Stones (merged 1 draw call, userData.ground = true!)
  {
    const gGeos = [];
    const poolBed = new THREE.CylinderGeometry(2.35, 2.42, 0.14, 28);
    poolBed.translate(0, 0.06, 0);
    gGeos.push(poolBed);
    for (const [sx, sy, sz, sr] of [[0.32, 0.14, 1.85, 0.42], [0.68, 0.10, 2.38, 0.44], [0.22, 0.07, 2.78, 0.46]]) {
      const st = new THREE.CylinderGeometry(sr, sr * 1.06, sy, 12);
      st.translate(sx, sy * 0.5, sz);
      gGeos.push(st);
    }
    const bedMesh = new THREE.Mesh(mergeGeometries(gGeos, false), bm.stoneFloor);
    bedMesh.name = 'rotenburo_walkable_bed';
    bedMesh.receiveShadow = true;
    bedMesh.userData.ground = true;
    bedMesh.userData.keep = true;
    root.add(bedMesh);
    gGeos.forEach((g) => g.dispose());
  }

  // Steaming Turquoise Hot-Spring Water Surface (radius ≈ 2.3m) + Steam Wisps
  const rotSteam = K.M(0xf2fbff, null, { roughness: 1.0, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false });
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.18, 2.22, 0.08, 36), bm.waterGlow), -0.05, 0.28, 0.05, 0, 0, 0, root);
  for (let s = 0; s < 6; s++) {
    const a = (s / 6) * TAU;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.30 + (s % 2) * 0.10, 0), rotSteam);
    puff.scale.set(1.30, 0.65, 1.30);
    add(puff, Math.cos(a) * 1.02 - 0.15, 0.52 + (s % 3) * 0.20, Math.sin(a) * 0.92, 0, a, 0, root);
  }

  // Ring of 22 Instanced Mossy Shoreline Boulders (leaving front-right stepping-stone path open!)
  const rockGeo = () => new THREE.IcosahedronGeometry(0.47, 0);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    // Leave front-right stepping-stone entry & foreground bucket/towel boulder slot open
    if (a < 0.55 || a > 5.75) continue;
    const rad = 2.18 + jr(-0.12, 0.18);
    const rx = Math.sin(a) * rad, rz = Math.cos(a) * rad;
    const isBackLeft = rx < -0.5 && rz < 0.2;
    const sy = isBackLeft ? jr(1.05, 1.48) : jr(0.68, 1.08);
    pushInst('rot_rock', rockGeo, bm.stoneInst,
      rx, sy * 0.34, rz, jr(0, 3), jr(0, 3), 0,
      jr(0.95, 1.42), sy, jr(0.95, 1.35),
      i % 2 === 0 ? pick(MOSS_BOULDER_PAL) : pick(STONE_BOULDER_PAL), root);
  }
  // Flat-topped foreground mossy boulder holding the cedar bucket & draped towel clearly!
  add(rbox(1.16, 0.42, 0.68, 0.14, bm.mossStone), -0.56, 0.21, 2.04, 0, 0.08, 0, root);

  // 2. Woven Bamboo Privacy Screen on Back-Left + Tall Jointed Green Bamboo Stalks & Leaves + Hydrangeas!
  for (const [fx, fz, frot, fw] of [[-1.45, -2.18, 0.36, 1.85], [0.18, -2.35, -0.05, 1.75]]) {
    add(rbox(fw, 1.62, 0.08, 0.02, fenceMat), fx, 0.88, fz, 0, frot, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, fw + 0.08, 8), bambooGoldMat),
      fx, 1.70, fz, 0, frot, PI * 0.5, root);
  }

  // 11 Tall Jointed Green Bamboo Culms & Arching Bamboo Leaf Sprays on Back-Left (int_06!)
  const bLeafGeo = () => {
    const g = new THREE.CircleGeometry(0.16, 5);
    g.scale(0.38, 1.65, 1);
    return g;
  };
  const culmPositions = [
    [-2.42, -0.85, 3.8], [-2.35, -1.35, 4.3], [-2.18, -1.78, 4.5], [-1.85, -2.12, 4.2],
    [-1.48, -2.32, 3.9], [-2.52, -0.35, 3.5], [-2.05, -1.45, 3.7], [-1.65, -1.95, 4.1],
    [-1.15, -2.38, 3.6], [-2.45, 0.15, 3.3], [-0.75, -2.42, 3.4],
  ];
  for (const [bx, bz, bh] of culmPositions) {
    const tiltX = jr(-0.06, 0.08), tiltZ = jr(-0.07, 0.07);
    const stalkG = new THREE.Group();
    stalkG.position.set(bx, 0, bz);
    stalkG.rotation.set(tiltX, 0, tiltZ);
    root.add(stalkG);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.068, bh, 8), bambooStalkMat),
      0, bh * 0.5, 0, 0, 0, 0, stalkG);
    for (let n = 1; n <= 4; n++) {
      const ny = (n / 5) * bh;
      add(new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.011, 5, 10), bm.darkTimber),
        0, ny, 0, PI * 0.5, 0, 0, stalkG);
    }
    for (let l = 0; l < 8; l++) {
      pushInst('rot_bleaf', bLeafGeo, bm.leafInst,
        bx + jr(-0.42, 0.48), bh * jr(0.55, 1.02), bz + jr(-0.42, 0.48),
        jr(-0.9, 0.9), jr(0, TAU), jr(-0.8, 0.8), jr(1.0, 1.5), jr(1.0, 1.5), 1, pick(FOLIAGE_PAL), root);
    }
  }
  addHydrangeaCluster(THREE, K, bm, -1.12, 0.62, -1.88, 0.48, 14, 'rot_hyd');
  addHydrangeaCluster(THREE, K, bm, -2.22, 0.26, 0.82, 0.42, 11, 'rot_hyd');
  addHydrangeaCluster(THREE, K, bm, 1.88, 0.42, -0.42, 0.34, 7, 'rot_hyd');

  // 3. Rustic Shingled Wooden Kakehi Shelter on Right + 3-Panel Cream ♨ Noren + Bamboo Water Spout!
  const shG = new THREE.Group();
  shG.position.set(1.38, 0.22, -0.96);
  shG.rotation.y = -0.44;
  root.add(shG);

  const shW = 1.92, shD = 1.05, shH = 2.08;
  for (const sx of [-1, 1]) {
    add(rbox(0.13, shH, 0.13, 0.02, bm.cedar), sx * (shW * 0.5 - 0.12), shH * 0.5, 0.18, 0, 0, 0, shG);
    add(rbox(0.11, shH - 0.15, 0.11, 0.02, bm.darkTimber), sx * (shW * 0.5 - 0.12), (shH - 0.15) * 0.5, -0.36, 0, 0, 0, shG);
    add(rbox(0.10, 0.12, shD, 0.02, bm.cedar), sx * (shW * 0.5 - 0.12), shH - 0.08, -0.08, 0, 0, 0, shG);
  }
  add(rbox(shW - 0.16, shH * 0.78, 0.07, 0.02, bm.darkTimber), 0, shH * 0.39, -0.38, 0, 0, 0, shG);
  add(rbox(shW, 0.13, 0.13, 0.02, bm.cedar), 0, shH - 0.04, 0.18, 0, 0, 0, shG);

  // Rustic pitched wooden shingle roof on kakehi shelter + warm eave lantern
  add(rbox(shW + 0.42, 0.09, shD + 0.56, 0.025, bm.darkTimber), 0, shH + 0.22, -0.02, 0.34, 0, 0, shG);
  const shingleCols = [0x8c5a38, 0x76482b, 0x9c6842, 0x6b4025];
  for (let r = 0; r < 4; r++) {
    const f = (r - 1.5) / 3.5;
    for (let c = 0; c < 8; c++) {
      const sx = -(shW + 0.28) * 0.5 + (c + 0.5) * ((shW + 0.28) / 8);
      add(rbox(0.26, 0.045, 0.42, 0.012, K.M(shingleCols[(r + c) % 4], K.tex('wood_planks_dark', 1, 1), { roughness: 0.85, metalness: 0 })),
        sx, shH + 0.27 - f * 0.26, -0.02 + f * 0.72, 0.34, 0, 0, shG);
    }
  }
  // Small glowing lantern tucked under right eave of shelter (int_06!)
  add(rbox(0.22, 0.28, 0.22, 0.02, bm.lanternGlow), shW * 0.5 + 0.02, shH - 0.26, 0.18, 0, 0, 0, shG);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.12, 4), bm.darkTimber), shW * 0.5 + 0.02, shH - 0.08, 0.18, 0, PI * 0.25, 0, shG);

  // 3-panel Cream ♨ Noren Curtain (bm.BT.norenCream!)
  addNorenCurtain(THREE, K, {
    cx: 0, yTop: shH - 0.12, z: 0.20, rotY: 0,
    width: 1.46, height: 0.84, panels: 3, texMap: bm.BT.norenCream, parent: shG,
  });

  // Thick Jointed Bamboo Spout (Kakehi) + Glowing Turquoise Water Arc into the Pool!
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 1.10, 10), bambooGoldMat), 0.74, 0.62, -0.82, 0, 0, 0, root);
  const spoutG = new THREE.Group();
  spoutG.position.set(0.44, 1.12, -0.52);
  spoutG.rotation.set(0.22, -0.68, PI * 0.44);
  root.add(spoutG);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.86, 12), bambooGoldMat), 0, 0, 0, 0, 0, 0, spoutG);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.114, 0.016, 6, 12), bm.darkTimber), 0, -0.18, 0, PI * 0.5, 0, 0, spoutG);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.014, 6, 12), bm.darkTimber), 0, 0.18, 0, PI * 0.5, 0, 0, spoutG);

  const spoutStream = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.16, 1.04, -0.26),
    new THREE.Vector3(0.02, 0.78, -0.10),
    new THREE.Vector3(-0.08, 0.30, 0.04),
  ]);
  add(new THREE.Mesh(buildTaperedTubeGeo(THREE, spoutStream, 18, 9, (t) => 0.062 + t * 0.042), bm.waterGlow), 0, 0, 0, 0, 0, 0, root);
  for (const [rrR, tR] of [[0.18, 0.020], [0.38, 0.014], [0.62, 0.010]]) {
    const rg = new THREE.TorusGeometry(rrR, tR, 6, 24);
    rg.rotateX(PI * 0.5);
    add(new THREE.Mesh(rg, foamGlow), -0.08, 0.33, 0.04, 0, 0, 0, root);
  }

  // 4. Cedar Bucket (Oke) & Draped White Towel on Foreground Boulder (int_06!)
  const bx = -0.80, by = 0.42, bz = 1.98;
  const bucketLathe = new THREE.LatheGeometry([
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.20, 0.00),
    new THREE.Vector2(0.23, 0.25),
    new THREE.Vector2(0.205, 0.25),
    new THREE.Vector2(0.18, 0.03),
    new THREE.Vector2(0.00, 0.03),
  ], 18);
  add(new THREE.Mesh(bucketLathe, bm.hinoki), bx, by, bz, 0.02, 0, -0.03, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.02, 16), bm.waterGlow), bx, by + 0.19, bz, 0.02, 0, -0.03, root);
  for (const hy of [0.06, 0.19]) {
    const hoop = new THREE.TorusGeometry(0.215, 0.011, 5, 18);
    hoop.rotateX(PI * 0.5);
    add(new THREE.Mesh(hoop, bm.copperWarm), bx, by + hy, bz, 0.02, 0, -0.03, root);
  }

  // Draped folded white cotton bath towel cascading down front of foreground rock!
  add(rbox(0.42, 0.065, 0.42, 0.025, towelMat), -0.28, 0.45, 2.16, 0.06, 0.08, 0, root);
  add(rbox(0.41, 0.36, 0.065, 0.025, towelMat), -0.26, 0.28, 2.38, -0.16, 0.08, 0, root);

  // 5. 2 Stone Yukimi Lanterns + Small Warm Foreground Lantern (int_06!)
  add(rbox(0.42, 0.44, 0.42, 0.08, bm.mossStone), -2.14, 0.22, -0.34, 0, 0.2, 0, root);
  addLowStoneLantern(THREE, K, bm, -2.14, 0.44, -0.34, true, 1.08);
  addLowStoneLantern(THREE, K, bm, 1.98, 0.28, 1.18, true, 0.98);
  addLowStoneLantern(THREE, K, bm, 1.44, 0.04, 1.94, false, 0.72);

  // Perimeter colliders around back screen, left rocks & right shelter (front stepping stones open!)
  boxCol(-0.6, -2.25, 3.6, 0.55);
  boxCol(-2.15, -0.2, 0.85, 3.6);
  boxCol(1.55, -0.85, 1.65, 1.55);

  root.userData.tubSpots = [{ x: -0.2, y: 0.30, z: 0.15 }];
  return K.finalize();
}

// ============================================================================
// 7. 3-TIER WOODEN BATHHOUSE PULLEY LIFT TOWER (buildPulleyLift)
// 4 vermilion/cedar guide posts (open +Z & -Z boarding at all 3 tiers!),
// top Verdigris 3D Kawara mini-roof, giant spoked wooden pulleyWheel group +
// rideable liftCar group (2.1m x 2.1m deck with userData.ground = true)!
// ============================================================================
export function buildPulleyLift(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'pulley_lift', 61);
  const { root, add, rbox, boxCol } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);

  const height = opts.height ?? opts.h ?? 6.2;
  const W = 2.5, D = 2.5;
  const halfX = W * 0.5, halfZ = D * 0.5;
  const topBeamY = height + 1.72;
  const ropeMat = K.M(0xcba062, K.tex('wood_light', 1, 4), { roughness: 0.86, metalness: 0 });

  // 1. Stationary Lift Tower Guide Shaft (open on +Z and -Z at ALL tiers!)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * halfX, pz = sz * halfZ;
      add(rbox(0.32, 0.28, 0.32, 0.04, bm.mossStone), px, 0.14, pz, 0, 0, 0, root);
      add(rbox(0.22, topBeamY, 0.22, 0.03, bm.vermilion), px, topBeamY * 0.5, pz, 0, 0, 0, root);
      add(rbox(0.26, 0.09, 0.26, 0.02, bm.goldTrim), px, topBeamY - 0.18, pz, 0, 0, 0, root);
    }

    // ±X Side Lattice Bracing & Iron Guide Tracks ONLY (never blocking +Z/-Z!)
    const sxPos = sx * halfX;
    add(rbox(0.08, topBeamY - 0.3, 0.10, 0.015, bm.ironWarm), sx * (halfX - 0.12), (topBeamY - 0.3) * 0.5, 0, 0, 0, 0, root);
    const tiers = 4;
    for (let t = 0; t <= tiers; t++) {
      const ty = 0.25 + (t / tiers) * (topBeamY - 0.55);
      add(rbox(0.16, 0.15, D, 0.025, bm.cedar), sxPos, ty, 0, 0, 0, 0, root);
      if (t < tiers) {
        const tyNext = 0.25 + ((t + 1) / tiers) * (topBeamY - 0.55);
        K.beam([sxPos, ty, -halfZ + 0.12], [sxPos, tyNext, halfZ - 0.12], 0.095, bm.darkTimber, root);
        K.beam([sxPos, tyNext, -halfZ + 0.12], [sxPos, ty, halfZ - 0.12], 0.095, bm.darkTimber, root);
      }
    }
    // Side shaft colliders ONLY on ±X!
    boxCol(sxPos, 0, 0.30, D + 0.12);
  }

  // Overhead hoist head-frame beams at y = topBeamY (plenty of clearance above Tier 3!)
  for (const sz of [-1, 1]) {
    add(rbox(W + 0.36, 0.24, 0.22, 0.03, bm.vermilion), 0, topBeamY, sz * halfZ, 0, 0, 0, root);
  }
  add(rbox(W + 0.24, 0.26, 0.32, 0.04, bm.darkTimber), 0, topBeamY - 0.42, 0, 0, 0, 0, root);

  // Side iron-banded wooden counterweight + static guide cables on -X side
  add(rbox(0.24, 0.72, 0.62, 0.03, bm.ironWarm), -halfX + 0.02, height * 0.52, 0, 0, 0, 0, root);
  add(rbox(0.28, 0.10, 0.66, 0.02, bm.goldTrim), -halfX + 0.02, height * 0.52, 0, 0, 0, 0, root);
  for (const rz of [-0.14, 0.14]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, topBeamY - 0.6, 6), ropeMat),
      0, (topBeamY - 0.6) * 0.5 + 0.5, rz, 0, 0, 0, root);
  }

  // Top Verdigris 3D Kawara Mini-Roof crowning the Lift Tower!
  buildKawaraGableRoof(THREE, K, {
    cx: 0, cz: 0, yBase: topBeamY + 0.08,
    spanX: 2.95, spanZ: 2.95, rise: 1.08,
    overhangX: 0.58, overhangZ: 0.58,
    ridgeAlongX: true,
    palette: VERDIGRIS_PAL,
    finial: 'jewel',
    parent: root,
    batchPrefix: 'lift_kaw',
  });

  // 2. Giant Spoked Wooden Overhead Pulley Wheel (pulleyWheel group, userData.keep = true!)
  const pulleyWheel = new THREE.Group();
  pulleyWheel.name = 'pulleyWheel';
  pulleyWheel.userData.keep = true;
  pulleyWheel.position.set(0, topBeamY - 0.42, 0);
  root.add(pulleyWheel);

  const wRim = new THREE.TorusGeometry(0.76, 0.105, 10, 28);
  wRim.rotateY(PI * 0.5); // Wheel in YZ plane, axle along X!
  add(new THREE.Mesh(wRim, bm.cedar), 0, 0, 0, 0, 0, 0, pulleyWheel);
  const wGroove = new THREE.TorusGeometry(0.81, 0.035, 8, 28);
  wGroove.rotateY(PI * 0.5);
  add(new THREE.Mesh(wGroove, bm.goldTrim), 0, 0, 0, 0, 0, 0, pulleyWheel);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 12), bm.ironWarm), 0, 0, 0, 0, 0, PI * 0.5, pulleyWheel);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.12, 12), bm.goldTrim), 0, 0, 0, 0, 0, PI * 0.5, pulleyWheel);
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * TAU;
    add(rbox(0.08, 1.44, 0.09, 0.02, bm.hinoki), 0, 0, 0, a, 0, 0, pulleyWheel);
  }

  // 3. Separate Movable Rideable Wooden Lift Car (liftCar group, userData.keep = true!)
  const liftCar = new THREE.Group();
  liftCar.name = 'liftCar';
  liftCar.userData.keep = true;
  liftCar.position.set(0, 0, 0);
  root.add(liftCar);

  // 2.1m x 2.1m plank deck at y = 0 local with userData.ground = true!
  const carDeck = rbox(2.10, 0.12, 2.10, 0.025, bm.cedar);
  carDeck.position.set(0, -0.05, 0); // Top surface right at y = +0.01 local!
  carDeck.castShadow = true;
  carDeck.receiveShadow = true;
  carDeck.userData.ground = true;
  carDeck.userData.keep = true;
  liftCar.add(carDeck);

  // Decorative iron edge thresholds on +Z / -Z open boarding edges
  for (const sz of [-1, 1]) {
    add(rbox(2.12, 0.04, 0.10, 0.01, bm.ironWarm), 0, 0.005, sz * 1.01, 0, 0, 0, liftCar);
  }

  // Side vermilion railings on ±X ONLY + 4 corner posts + overhead hoist yoke + 2 warm lanterns!
  const cxCar = 0.97, czCar = 0.97, hCar = 2.36;
  for (const sx of [-1, 1]) {
    const rx = sx * cxCar;
    add(rbox(0.10, 0.085, 2.02, 0.02, bm.vermilion), rx, 0.88, 0, 0, 0, 0, liftCar);
    add(rbox(0.075, 0.065, 2.02, 0.015, bm.vermilion), rx, 0.48, 0, 0, 0, 0, liftCar);
    add(rbox(0.10, 0.09, 2.04, 0.02, bm.darkTimber), rx, 0.06, 0, 0, 0, 0, liftCar);
    for (let b = -2; b <= 2; b++) {
      add(rbox(0.065, 0.82, 0.065, 0.015, bm.vermilion), rx, 0.46, b * 0.36, 0, 0, 0, liftCar);
    }
    for (const sz of [-1, 1]) {
      add(rbox(0.13, hCar, 0.13, 0.025, bm.vermilion), rx, hCar * 0.5, sz * czCar, 0, 0, 0, liftCar);
    }
    add(rbox(0.13, 0.14, 2.06, 0.025, bm.cedar), rx, hCar - 0.06, 0, 0, 0, 0, liftCar);
  }
  // Overhead arched suspension beam along X + brass hoist ring (2.30m clear headroom!)
  add(rbox(2.14, 0.16, 0.20, 0.03, bm.darkTimber), 0, hCar, 0, 0, 0, 0, liftCar);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 8, 16), bm.goldTrim), 0, hCar + 0.16, 0, 0, PI * 0.5, 0, liftCar);

  // 2 Warm Glowing Corner Post Lanterns on the Lift Car!
  for (const [lx, lz] of [[-cxCar + 0.18, czCar - 0.14], [cxCar - 0.18, -czCar + 0.14]]) {
    add(rbox(0.22, 0.28, 0.22, 0.02, bm.lanternGlow), lx, 1.84, lz, 0, 0, 0, liftCar);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.13, 4), bm.ironWarm), lx, 2.03, lz, 0, PI * 0.25, 0, liftCar);
  }

  const out = K.finalize([liftCar, pulleyWheel]);
  out.userData.liftCar = liftCar;
  out.userData.pulleyWheel = pulleyWheel;
  out.userData.colliderBottom = -0.25;
  out.userData.colliderHeight = topBeamY;
  return out;
}

// ============================================================================
// 8. STEPPED STORYBOOK TWILIGHT STONE STAIRCASE (buildStoneStaircase)
// Rises from (z = +run/2, y = 0) up to (z = -run/2, y = rise)!
// Merged walkable stone treads (userData.ground = true), mossy boulder cheeks,
// vermilion timber handrails with golden post caps & 2 warm foot lanterns!
// ============================================================================
export function buildStoneStaircase(THREE, opts = {}) {
  const K = createBuilderKit(THREE, opts, 'stone_staircase', 71);
  const { root, add, rbox, boxCol, pushInst, jr, pick } = K;
  ensureBathTexWarm(THREE);
  const bm = getBathMats(THREE, K);

  const width = opts.width ?? 3.2;
  const rise = opts.rise ?? 1.95;
  const run = opts.run ?? 3.8;
  const steps = Math.max(3, opts.steps ?? 9);

  const stepRun = run / steps;
  const stepRise = rise / steps;
  const treadW = width - 0.36;
  const stairStone = K.G(0x968e9e, K.tex('plaster', 1.6, 1.6), 0.70, 0.55);

  // 1. Stone Treads merged into ONE walkable mesh (userData.ground = true = 1 draw call!)
  const treadGeos = [];
  for (let i = 0; i < steps; i++) {
    const yTop = (i + 1) * stepRise;
    const zCenter = run * 0.5 - (i + 0.5) * stepRun;
    const hSlab = yTop; // Solid stepped stone mass down to y = 0 so no under-gaps!
    const tg = new RoundedBoxGeometry(treadW, hSlab, stepRun + 0.08, 1, 0.03);
    tg.translate(0, hSlab * 0.5, zCenter);
    treadGeos.push(tg);
  }
  // Smooth flush foot threshold pad at z = +run/2 + 0.16
  const footPad = new RoundedBoxGeometry(treadW, 0.08, 0.36, 1, 0.02);
  footPad.translate(0, 0.04, run * 0.5 + 0.14);
  treadGeos.push(footPad);

  const treadsMesh = new THREE.Mesh(mergeGeometries(treadGeos, false), stairStone);
  treadsMesh.name = 'staircase_walkable_treads';
  treadsMesh.castShadow = true;
  treadsMesh.receiveShadow = true;
  treadsMesh.userData.ground = true;
  treadsMesh.userData.keep = true;
  root.add(treadsMesh);
  treadGeos.forEach((g) => g.dispose());

  // Varied dressed stone tread pavers & mossy cheek boulders along ±X!
  const paverGeo = () => new BoxGeometryPaver(0.56, 0.026, stepRun * 0.88);
  function BoxGeometryPaver(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  const rockGeo = () => new THREE.IcosahedronGeometry(0.32, 0);
  for (let i = 0; i < steps; i++) {
    const yTop = (i + 1) * stepRise;
    const zCenter = run * 0.5 - (i + 0.5) * stepRun;
    for (let c = -2; c <= 2; c++) {
      pushInst('st_paver', paverGeo, bm.stoneInst,
        c * 0.54 + (i % 2) * 0.12, yTop + 0.008, zCenter,
        0, jr(-0.02, 0.02), 0, jr(0.92, 1.05), 1, 1, pick(STONE_BOULDER_PAL), root);
    }
    for (const sx of [-1, 1]) {
      pushInst('st_cheek_rk', rockGeo, bm.stoneInst,
        sx * (width * 0.5 + 0.04), yTop * 0.65 + 0.12, zCenter,
        jr(0, 3), jr(0, 3), 0, jr(0.85, 1.25), jr(0.75, 1.15), jr(0.85, 1.20),
        i % 3 === 0 ? pick(MOSS_BOULDER_PAL) : pick(STONE_BOULDER_PAL), root);
    }
  }

  // 2. Mossy Stone Cheek Stringers + Vermilion Timber Handrails with Golden Post Caps on ±X!
  const zBot = run * 0.5 + 0.06, zTop = -run * 0.5 + 0.06;
  for (const sx of [-1, 1]) {
    const rx = sx * (width * 0.5 - 0.08);
    K.beam([rx, 0.18, zBot], [rx, rise + 0.18, zTop], 0.28, bm.mossStone, root);
    K.beam([rx, 0.88, zBot], [rx, rise + 0.88, zTop], 0.095, bm.vermilion, root);
    K.beam([rx, 0.54, zBot], [rx, rise + 0.54, zTop], 0.065, bm.vermilion, root);

    for (const [pz, py] of [[zBot, 0], [0, rise * 0.5], [zTop, rise]]) {
      add(rbox(0.15, 0.94, 0.15, 0.03, bm.vermilion), rx, py + 0.47, pz, 0, 0, 0, root);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), bm.goldTrim), rx, py + 0.98, pz, 0, 0, 0, root);
    }

    // Cheek wall collider ONLY so center stairs are 100% open & walkable!
    boxCol(sx * (width * 0.5), 0, 0.34, run + 0.25);
  }

  // 3. 2 Warm Post Lanterns & Hydrangea Tufts at the Foot of the Staircase (+Z)!
  for (const sx of [-1, 1]) {
    addPostLantern(THREE, K, {
      x: sx * (width * 0.5 + 0.26), y: 0, z: run * 0.5 + 0.24,
      height: 1.54, stone: false, parent: root,
    });
    addHydrangeaCluster(THREE, K, bm, sx * (width * 0.5 + 0.42), 0.08, run * 0.5 - 0.35, 0.34, 7, 'st_hyd');
  }

  return K.finalize();
}
