/* Hue & Seek (working title) — prototype.
 * Paint-camouflage hide-and-seek: hiders sample colours from the world to blend in, seekers wash paint off with
 * water splashers. Painterly (hand-painted, cosy village) look with placeholder geometry.
 * Modes: HIDE (you vs 2 AI seekers) · SEEK (you vs 5 AI hiders). Touch: left = move stick, right = look.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { audio } from './audio.js?v=21';
import { haptics } from './haptics.js?v=1';
import { buildHeroCottage, mergeStatic } from './hero_cottage.js';
import { mergeGeometries as mergeGeoms } from 'three/addons/utils/BufferGeometryUtils.js';
import { createEndCinematic } from './end_cinematic.js';
import { createWorldOptimizer } from './world_optimizer.js?v=6';
import { TEAM_SIZE, pickBotHandles, makeNameplateSprite, createAIManager } from './ai_brains.js?v=15';
import { PHOTON_CONFIG } from './photon_config.js?v=6';
import { createMultiplayerManager } from './multiplayer.js?v=18';
import { createHiderTricksManager, playTauntPreview } from './hider_tricks.js?v=10';
import { createSeekerGadgetsManager } from './seeker_gadgets.js?v=11';
import { createWorldEventsManager } from './world_events.js?v=5';
import { createMatchFlowManager } from './match_flow.js?v=8';
import { createViralHighlightsManager } from './viral_highlights.js?v=9';
import { createProgressionManager } from './progression.js?v=12';
import { createCloudSave } from './cloud_save.js?v=3';
import { createAnalytics } from './analytics.js?v=1';
import { CLOUD_CONFIG } from './cloud_config.js?v=1';
import { createElementalGunsManager, ELEMENTAL_GUN_SPECS, getElementSpec } from './elemental_guns.js?v=14';
import {
  ANIMAL_PROP_ICONS,
  ANIMAL_PROP_DEFS,
  isInMudWallow,
  buildAnimalPropBuilders,
  buildAnimalHabitats,
  playWingFlapSound,
  createMeadowAnimalsSystem,
} from './world/meadow_animals.js?v=9';
import {
  Y_UNDER,
  UNDERGROUND_PROP_ICONS,
  UNDERGROUND_PROP_DEFS,
  STAIR_EAST,
  STAIR_WEST,
  STAIR_CULVERT,
  isMeadowGroundCutout,
  cutMeadowGroundMesh,
  sampleUndergroundHeight,
  buildUndergroundPropBuilders,
  buildUndergroundSpotDisguise,
  breaksUndergroundLOS,
  buildUndergroundWorld,
} from './world/meadow_underground.js?v=5';
import {
  Y_TREEHOUSE,
  Y_HAYLOFT,
  FEATURE_PROP_ICONS,
  FEATURE_PROP_DEFS,
  buildFeaturePropBuilders,
  buildCustomSpotDisguise as buildMeadowSpotDisguise,
  breaksLineOfSight as meadowBreaksLineOfSight,
  checkFirePopHaystacks,
  buildMeadowFeatures,
} from './world/meadow_features.js?v=5';
import { createMobileControlsManager } from './mobile_controls.js?v=11';
import { createMobileLobbyManager } from './mobile_lobby.js?v=12';
import { createMobilePerfManager, probeHalfFloatSupport } from './mobile_perf.js?v=8';
import { createSeekerSkyDropManager } from './seeker_skydrop.js?v=9';
import { createTutorialManager } from './tutorial.js?v=3';
const GAME_VERSION = '8.4.0';
import { createHueLayerManager, HUE_RULES } from './hue_layer.js?v=4';
import { createStatusFxManager } from './status_fx.js?v=1';
import { createGenreKingManager } from './genre_king.js?v=2';
import { createPainterlyGfxManager, buildReliefBumpTexture, buildPBRMapsFromCanvas } from './painterly_gfx.js?v=4';
import { createTier1VisualsManager, GRASS_BEND_UNIFORM_DECL, GRASS_BEND_VERTEX_GLSL } from './tier1_visuals.js?v=2';
import { createNextGenRendererBridge, createNextGenAssetLoader, probeWebGPUAdapter } from './nextgen_pipeline.js?v=2';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
// BVH-accelerated raycasts: sight lines, camera bumps and water hits test a few triangles instead of whole buildings
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let analytics = null;
let hiderTricks = null, seekerGadgets = null, worldEvents = null, matchFlow = null, viralHighlights = null, progression = null, elementalGuns = null, hueLayer = null, statusFx = null, cloudSave = null, genreKing = null, painterlyGfx = null, tier1Visuals = null, nextGenBridge = null, nextGenAssets = null;
let mobileControls = null, mobileLobby = null, mobilePerf = null, seekerSkyDrop = null, tutorial = null;
let endRoundTO = 0, nonMasterEndTO = 0, nervesToastTO = 0;

let simClockOffset = 0;
const simNow = () => performance.now() + simClockOffset;

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const isTouch = matchMedia('(pointer: coarse)').matches;

// ============================================================ renderer / scene
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: isTouch ? 'default' : 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2.0));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
$('app').prepend(renderer.domElement);

const scene = new THREE.Scene();
const FOG = new THREE.Color(0xd8e6e4);
scene.fog = new THREE.Fog(FOG, 38, 120);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 400);
scene.add(camera);
// Unified PC-parity 16-bit HDR soft bloom + ACES filmic grade on BOTH desktop & mobile GPUs
// Mobile keeps RGBA16F at 0x MSAA so HDR stays inside on-chip tile memory (Adreno GMEM) with zero off-chip MSAA resolve heat!
let composer = null, outlinePass = null, bloomPass = null;
const gpuPostCaps = probeHalfFloatSupport(renderer);
if (gpuPostCaps.canHalfFloat) {
  const pr = renderer.getPixelRatio();
  const initSamples = isTouch ? 0 : (gpuPostCaps.maxHalfFloatSamples || 0);
  const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, {
    type: THREE.HalfFloatType,
    samples: initSamples,
  });
  composer = new EffectComposer(renderer, rt);
  if (composer.renderTarget2) {
    composer.renderTarget2.samples = initSamples;
  }
  composer.addPass(new RenderPass(scene, camera));
  outlinePass = null;
  const initBloomScale = isTouch ? 0.85 : 1.25;
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(128, Math.round(innerWidth * initBloomScale)), Math.max(128, Math.round(innerHeight * initBloomScale))),
    0.32,
    0.7,
    0.86
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

// painterly sky dome
const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x5aa6e6) }, mid: { value: new THREE.Color(0xc4e3f3) }, low: { value: new THREE.Color(0xf7e6c4) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top, mid, low; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.02, 0.55, h)) : mix(mid, low, smoothstep(0.0, -0.15, h)); gl_FragColor = vec4(c, 1.0); }',
}));
sky.renderOrder = -2;
scene.add(sky);

const hemiLight = new THREE.HemisphereLight(0xcfe6ff, 0x8aa35f, 1.25);
scene.add(hemiLight);
const sun = new THREE.DirectionalLight(0xffd29a, 2.75);
sun.position.set(28, 42, 18);
sun.castShadow = true;
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = true;
sun.shadow.mapSize.set(isTouch ? 2048 : 4096, isTouch ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 135 });
// Layer seen only by the sun's shadow camera: merged per-prop shadow proxies live here (see attachShadowProxy).
const SHADOW_ONLY_LAYER = 3;
sun.shadow.camera.layers.enable(SHADOW_ONLY_LAYER);
sun.shadow.bias = -0.0005;
sun.shadow.radius = isTouch ? 3 : 2.2;
sun.shadow.normalBias = isTouch ? 0.03 : 0.022;
scene.add(sun);

const worldOptimizer = createWorldOptimizer(THREE);
painterlyGfx = createPainterlyGfxManager({ THREE, scene, renderer, sun, sky, bloomPass, isTouch });
tier1Visuals = createTier1VisualsManager({ THREE, scene, sun, isTouch });
nextGenBridge = createNextGenRendererBridge(THREE, { renderer });
nextGenAssets = createNextGenAssetLoader({ THREE, renderer });
probeWebGPUAdapter(renderer).then((caps) => { if (nextGenBridge) nextGenBridge.capabilities = caps; }).catch(() => {});
if (composer && painterlyGfx) {
  const cgPass = painterlyGfx.attachColorGradePass(composer, ShaderPass);
  if (cgPass) composer.addPass(cgPass);
}

let GRASS_INST = null;
mobilePerf = createMobilePerfManager({
  renderer,
  composer,
  bloomPass,
  sun,
  outlinePass,
  onGrassCount: (targetCount) => {
    if (GRASS_INST) {
      const maxC = GRASS_INST.userData.maxCount || GRASS_INST.count;
      GRASS_INST.count = Math.min(maxC, Math.max(0, targetCount));
    }
  },
});
mobilePerf.applyInitialTuning();
if (painterlyGfx) painterlyGfx.setDetailLevel(mobilePerf.getTier ? mobilePerf.getTier() : 'ultra', 0);
if (tier1Visuals) tier1Visuals.setDetailLevel(mobilePerf.getTier ? mobilePerf.getTier() : 'ultra', 0);
// Adaptive Lite steps (only on phones that keep dropping frames): grass stops receiving shadows.
if (mobilePerf.onLiteChange) mobilePerf.onLiteChange((level) => {
  if (GRASS_INST) GRASS_INST.receiveShadow = level < 1;
  document.documentElement.classList.toggle('hs-lite', level >= 1);
  if (painterlyGfx) painterlyGfx.setDetailLevel(mobilePerf.getTier ? mobilePerf.getTier() : 'ultra', level);
  if (tier1Visuals) tier1Visuals.setDetailLevel(mobilePerf.getTier ? mobilePerf.getTier() : 'ultra', level);
});

// ============================================================ world building helpers
const mapRoot = new THREE.Group(); mapRoot.name = 'mapRoot'; scene.add(mapRoot);
const meadowSkyGroup = new THREE.Group(); meadowSkyGroup.name = 'meadowSkyGroup'; scene.add(meadowSkyGroup);
const solids = [];      // raycast targets (things you can hide against / shots hit)
const blockers = [];    // XZ boxes for movement collision
// Modules that move a blocker in place call blockers.markMoved(b) so the spatial grid stops trusting its
// old cells (it is then checked directly, like an oversized blocker).
blockers.markMoved = (b) => { if (b && !b.dynamic) { b.dynamic = true; _blockerGridLen = -1; } };
const spots = [];       // hiding spots {pos, color, kind}
const SKYCOL = new THREE.Color(0xc4e3f3);
let MAPR = 30;
let ACTIVE_MAP = null;
let activeMapId = 'meadow';
let selectedSpirit = (() => { try { return localStorage.getItem('hs_selected_spirit') || 'auto'; } catch (_) { return 'auto'; } })();
let selectedSeeker = (() => { try { return localStorage.getItem('hs_selected_seeker') || 'ranger'; } catch (_) { return 'ranger'; } })();
let lobbyPreviewRole = 'spirit'; // 'spirit' | 'seeker'
let lobbyPreviewGroup = null;
let lobbyPreviewChar = null;
let lobbyPreviewSig = '';
let lobbyPreviewSpinT = 0;
let charSelectOpen = false;
let charSelectUserYaw = 0;
let charSelectDragging = false;
let charSelectLastX = 0;
let activeWorldUpdate = null;
let activeWorldDispose = null;
let activeWorldTurret = null;
const getActiveTurret = () => (ACTIVE_MAP && ACTIVE_MAP.getTurret ? ACTIVE_MAP.getTurret() : (activeWorldTurret || meadowExpansion.features?.turret)) || null;

// ---------- hand-painted textures generated in code (stand-ins until real artist textures)
const MAX_ANISO = Math.min(isTouch ? 4 : 8, (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy() : 4);
function canvasTex(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO;
  t._unitBase = t;
  return t;
}
function brush(g, s, n, cols, w0, w1, alpha, ang = 0, angVar = 3.2, len = 40) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    g.strokeStyle = pick(cols); g.globalAlpha = alpha * rand(0.35, 1); g.lineWidth = rand(w0, w1);
    const x = rand(-10, s + 10), y = rand(-10, s + 10), a = ang + rand(-angVar, angVar) / 2, l = rand(len * 0.4, len);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rand(-6, 6), y + Math.sin(a) * l * 0.5 + rand(-6, 6), x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
}
const TEXUSE = { plaster: [], tiles: [], wood: [], straw: [], cobble: [], meadow: [] };
const TEX = {
  plaster: canvasTex(512, (g, s) => { g.fillStyle = '#f5efe3'; g.fillRect(0, 0, s, s); brush(g, s, 420, ['#ffffff', '#e6dac6', '#f2e8d6', '#d8cab0'], 10, 30, 0.34, 0.2, 1.2, 95); brush(g, s, 110, ['#c6b69b', '#fff9ec'], 1.5, 3.5, 0.38, 0, 6.3, 28); }),
  tiles: canvasTex(512, (g, s) => {
    g.fillStyle = '#d4c8be'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 10; r++) for (let c = -1; c < 10; c++) {
      const x = c * 56 + (r % 2) * 28, y = r * 54;
      g.fillStyle = `hsl(18, ${rand(8, 18)}%, ${rand(80, 95)}%)`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 56, y); g.lineTo(x + 56, y + 38); g.quadraticCurveTo(x + 28, y + 58, x, y + 38); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(72,46,36,0.44)'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = 'rgba(255,250,240,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y + 8); g.lineTo(x + 48, y + 8); g.stroke();
    }
    brush(g, s, 140, ['#ffffff', '#fff2dc'], 4, 12, 0.16, 0, 1, 45);
  }),
  wood: canvasTex(512, (g, s) => {
    for (let k = 0; k < 4; k++) { g.fillStyle = `hsl(30, ${rand(22, 36)}%, ${rand(78, 91)}%)`; g.fillRect(k * 128, 0, 128, s); }
    brush(g, s, 280, ['#b08f6a', '#dcc6a4', '#9c7b56', '#f0dec2'], 1.5, 4.5, 0.48, Math.PI / 2, 0.22, 210);
    g.fillStyle = 'rgba(62,38,20,0.62)'; for (let k = 1; k < 4; k++) g.fillRect(k * 128 - 3, 0, 5, s);
    g.fillStyle = 'rgba(255,244,224,0.28)'; for (let k = 0; k < 4; k++) g.fillRect(k * 128 + 3, 0, 3, s);
  }),
  straw: canvasTex(512, (g, s) => { g.fillStyle = '#f2e4b0'; g.fillRect(0, 0, s, s); brush(g, s, 820, ['#fff8d8', '#d6bc70', '#ead692', '#bfa04e'], 1.5, 4, 0.72, 0.15, 0.85, 85); }),
  cobble: canvasTex(512, (g, s) => {
    g.fillStyle = '#8b8278'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 115; i++) {
      const x = rand(0, s), y = rand(0, s), r = rand(20, 38);
      g.fillStyle = `hsl(${rand(28, 42)}, ${rand(6, 16)}%, ${rand(73, 91)}%)`;
      g.beginPath(); g.ellipse(x, y, r, r * rand(0.68, 0.94), rand(0, 3), 0, 7); g.fill();
      g.strokeStyle = 'rgba(66,56,48,0.45)'; g.lineWidth = 3.2; g.stroke();
      g.strokeStyle = 'rgba(255,250,236,0.34)'; g.lineWidth = 2; g.beginPath(); g.arc(x - r * 0.16, y - r * 0.16, r * 0.5, 3.6, 5.4); g.stroke();
    }
    brush(g, s, 90, ['#ffffff', '#fff6e4'], 6, 16, 0.14, 0, 6, 38);
  }),
  meadow: canvasTex(512, (g, s) => {
    g.fillStyle = '#edf3df'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 110; i++) { const x = rand(0, s), y = rand(0, s), r = rand(24, 78); const gr = g.createRadialGradient(x, y, 0, x, y, r); const l = rand(0, 1) < 0.5; gr.addColorStop(0, l ? 'rgba(255,255,224,0.38)' : 'rgba(136,166,108,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    brush(g, s, 1100, ['#ffffff', '#cadbb0', '#b1c98f', '#e5f0d2'], 1.2, 3.2, 0.58, -Math.PI / 2, 0.8, 16);
  }),
};
const TEX_PBR = {
  plaster: buildPBRMapsFromCanvas(THREE, TEX.plaster.image, { maxAniso: MAX_ANISO, normalStrength: 1.6, baseRoughness: 0.90, roughVar: 0.10 }),
  tiles: buildPBRMapsFromCanvas(THREE, TEX.tiles.image, { maxAniso: MAX_ANISO, normalStrength: 3.1, baseRoughness: 0.44, roughVar: 0.18 }),
  wood: buildPBRMapsFromCanvas(THREE, TEX.wood.image, { maxAniso: MAX_ANISO, normalStrength: 2.5, baseRoughness: 0.68, roughVar: 0.16 }),
  straw: buildPBRMapsFromCanvas(THREE, TEX.straw.image, { maxAniso: MAX_ANISO, normalStrength: 2.6, baseRoughness: 0.94, roughVar: 0.08 }),
  cobble: buildPBRMapsFromCanvas(THREE, TEX.cobble.image, { maxAniso: MAX_ANISO, normalStrength: 3.4, baseRoughness: 0.58, roughVar: 0.22 }),
  meadow: buildPBRMapsFromCanvas(THREE, TEX.meadow.image, { maxAniso: MAX_ANISO, normalStrength: 1.4, baseRoughness: 0.88, roughVar: 0.10 }),
};
const PBR_NORMAL_SCALES = { plaster: 0.55, tiles: 0.95, wood: 0.78, straw: 0.80, cobble: 1.05, meadow: 0.45 };
const PBR_ROUGHNESS = { plaster: 0.92, tiles: 0.52, wood: 0.72, straw: 0.94, cobble: 0.64, meadow: 0.88 };
const REP_TEX_CACHE = new Map();
const REP_PBR_CACHE = new Map();
const LAMBERT_MAT_CACHE = new Map();
const SHARED_VCOL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04 });
if (painterlyGfx) painterlyGfx.upgradeMaterialToPainterly(SHARED_VCOL_MAT);

function getRepeatedPBRMap(texName, kind, rx = 1, ry = 1) {
  const base = TEX_PBR[texName]?.[kind];
  if (!base) return null;
  if (rx === 1 && ry === 1) return base;
  const k = `${texName}|${kind}|${rx}|${ry}`;
  let t = REP_PBR_CACHE.get(k);
  if (!t) {
    t = base.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = MAX_ANISO;
    t.needsUpdate = true;
    REP_PBR_CACHE.set(k, t);
  }
  return t;
}

function getRepeatedTex(texName, rx = 1, ry = 1) {
  const base = TEX[texName];
  if (!base) return null;
  if (rx === 1 && ry === 1) return base;
  const k = `${texName}|${rx}|${ry}`;
  let t = REP_TEX_CACHE.get(k);
  if (!t) {
    t = base.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = MAX_ANISO;
    t._unitBase = base;
    t.needsUpdate = true;
    REP_TEX_CACHE.set(k, t);
    if (TEXUSE[texName]) TEXUSE[texName].push(t);
  }
  return t;
}

function getTexturedLambertMat(texName, rx, ry, hex) {
  const colHex = new THREE.Color(hex).getHexString();
  const k = `${texName}|${rx}|${ry}|${colHex}`;
  let mat = LAMBERT_MAT_CACHE.get(k);
  if (!mat) {
    const t = getRepeatedTex(texName, rx, ry);
    const nMap = getRepeatedPBRMap(texName, 'normalMap', rx, ry);
    const rMap = getRepeatedPBRMap(texName, 'roughnessMap', rx, ry);
    const nSc = PBR_NORMAL_SCALES[texName] || 0.7;
    mat = new THREE.MeshStandardMaterial({
      map: t,
      color: hex,
      roughness: PBR_ROUGHNESS[texName] ?? 0.76,
      metalness: 0.03,
      ...(nMap ? { normalMap: nMap, normalScale: new THREE.Vector2(nSc, nSc) } : {}),
      ...(rMap ? { roughnessMap: rMap } : {}),
    });
    if (painterlyGfx) painterlyGfx.upgradeMaterialToPainterly(mat);
    LAMBERT_MAT_CACHE.set(k, mat);
  }
  return mat;
}

function tinted(geo, hex, vary = 0.04) {
  const base = new THREE.Color(hex);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(base).offsetHSL(rand(-vary, vary) * 0.25, rand(-vary, vary) * 0.6, rand(-vary, vary));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}
function mesh(geo, hex, opts = {}) {
  let mat;
  if (opts.tex) {
    const r = opts.rep || [1, 1];
    mat = getTexturedLambertMat(opts.tex, r[0], r[1], hex);
  } else {
    mat = SHARED_VCOL_MAT;
  }
  const m = new THREE.Mesh(opts.tex ? geo : tinted(geo, hex, opts.vary ?? 0.05), mat);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = true;
  m.userData.paint = new THREE.Color(hex);
  if (opts.solid !== false) solids.push(m);
  return m;
}
function block(obj, pad = 0) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const h = b.max.y - b.min.y;
  blockers.push({
    x0: b.min.x - pad, x1: b.max.x + pad,
    z0: b.min.z - pad, z1: b.max.z + pad,
    y0: b.min.y - 0.12, y1: b.max.y,
    standable: h > 0.14 && h <= 1.75,
  });
}
function blockerOverlapsY(b, footY, isVaulting = false) {
  if (typeof footY !== 'number' || b.y0 == null || b.y1 == null) return true;
  const vaultClear = (isVaulting && b.standable) ? 0.34 : 0.08;
  return !(footY + 1.22 < b.y0 || footY >= b.y1 - vaultClear);
}
function addSpot(v, hex, kind) {
  spots.push({ pos: new THREE.Vector3(v.x, typeof v.y === 'number' ? v.y : 0, v.z), color: new THREE.Color(hex), kind, used: false });
}

// ---- ground: grass meadow with a cobbled plaza in the middle; gentle hills outside the play area
const PLAZA_R = 9;
let PLAZA_DISC = null;   // flat fallback plaza floor (replaced by world/plaza.js paving when available)
const GRASS = 0x7fb35a, STONE = 0xc9bfae;
function groundColorAt(x, z) {
  if (ACTIVE_MAP && ACTIVE_MAP.groundColorAt) {
    const c = ACTIVE_MAP.groundColorAt(x, z, new THREE.Color());
    if (c && c.isColor) return c;
    if (typeof c === 'number') return new THREE.Color(c);
  }
  const d = Math.hypot(x, z);
  return new THREE.Color(d < PLAZA_R ? STONE : GRASS);
}
const grassTime = { value: 0 };
function makePlazaDiscWithWellCutout(rad) {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, rad, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(1.5, -1.5, 0.74, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  const geo = new THREE.ShapeGeometry(sh, 56);
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = pos.getX(i) / (2 * rad) + 0.5;
    uvs[i * 2 + 1] = pos.getY(i) / (2 * rad) + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}
function buildMeadowGround() {
  {
    const g = new THREE.PlaneGeometry(220, 220, 132, 132);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z);
      const hill = d > 40 ? Math.pow((d - 40) / 28, 1.6) * 7 * (0.7 + 0.3 * Math.sin(x * 0.11) * Math.cos(z * 0.09)) : 0;
      pos.setY(i, hill);
      if (d < PLAZA_R) c.set(STONE).offsetHSL(0, 0, rand(-0.06, 0.05));
      else if (d < PLAZA_R + 0.8) c.set(0xa9b98e);
      else c.set(GRASS).offsetHSL(rand(-0.02, 0.025), rand(-0.05, 0.05), rand(-0.06, 0.06) + (hill > 0 ? 0.02 : 0));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    cutMeadowGroundMesh(g);
    g.computeVertexNormals();
    const gt = getRepeatedTex('meadow', 36, 36);
    const gn = getRepeatedPBRMap('meadow', 'normalMap', 36, 36);
    const groundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: gt,
      roughness: 0.88,
      metalness: 0.02,
      ...(gn ? { normalMap: gn, normalScale: new THREE.Vector2(0.45, 0.45) } : {}),
    });
    if (painterlyGfx) painterlyGfx.upgradeMaterialToPainterly(groundMat, { rimMul: 0.15, cloudMul: 1.15, macroMul: 1.25 });
    const ground = new THREE.Mesh(g, groundMat);
    ground.receiveShadow = true;
    ground.userData.ground = true;
    mapRoot.add(ground);
    solids.push(ground);
    const plaza = new THREE.Mesh(makePlazaDiscWithWellCutout(PLAZA_R + 0.3), getTexturedLambertMat('cobble', 12, 12, STONE));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.015; plaza.receiveShadow = true; plaza.userData.paint = new THREE.Color(STONE);
    mapRoot.add(plaza); solids.push(plaza); PLAZA_DISC = plaza;
  }
  // grass blades swaying in the wind (instanced, custom vertex sway — full 8,000 PC parity on Ultra!)
  {
    const maxN = 8000;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.055, 0, 0, 0.055, 0, 0, 0.01, 0.6, 0.03], 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.5, 1, 0, 0.5, 1, 0, 0.8, 1], 3));
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = grassTime;
      if (tier1Visuals) sh.uniforms.uBenders = tier1Visuals.grassBenderUniforms.uBenders;
      sh.vertexShader = 'uniform float uTime;\n' + (tier1Visuals ? GRASS_BEND_UNIFORM_DECL : '') + 'varying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vH = position.y / 0.6;
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * 1.6 + wp.x * 0.33 + wp.z * 0.21) * 0.55 + sin(uTime * 2.7 + wp.z * 0.47) * 0.25;
        transformed.x += sway * 0.16 * vH * vH;
        transformed.z += sway * 0.07 * vH * vH;
        ${tier1Visuals ? GRASS_BEND_VERTEX_GLSL : ''}`);
      sh.fragmentShader = 'varying float vH;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float tipT = clamp(vH, 0.0, 1.0); diffuseColor.rgb *= mix(0.46, 1.32, tipT); diffuseColor.rgb += vec3(0.11, 0.09, 0.02) * (tipT * tipT);');
    };
    const inst = new THREE.InstancedMesh(geo, mat, maxN);
    inst.userData.maxCount = maxN;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    let k = 0;
    while (k < maxN) {
      const x = rand(-39, 39), z = rand(-39, 39), d = Math.hypot(x, z);
      if (d < PLAZA_R + 1.0 || d > 39) continue;
      if (isMeadowGroundCutout(x, z) || isInMudWallow(x, z)) continue;
      q.setFromEuler(new THREE.Euler(rand(-0.2, 0.2), rand(0, 6.3), rand(-0.2, 0.2)));
      sc.set(rand(0.8, 1.3), rand(0.5, 1.05), 1); p.set(x, 0, z);
      m.compose(p, q, sc); inst.setMatrixAt(k, m);
      inst.setColorAt(k, c.set(GRASS).offsetHSL(rand(-0.03, 0.04), rand(0, 0.12), rand(-0.04, 0.1)));
      k++;
    }
    inst.count = mobilePerf ? Math.min(maxN, mobilePerf.getTargetGrassCount()) : maxN;
    inst.receiveShadow = !(mobilePerf && mobilePerf.getLiteLevel && mobilePerf.getLiteLevel() >= 1);
    mapRoot.add(inst); GRASS_INST = inst;
  }
}
// no grass growing through floors: drop blades inside enterable buildings and under the stream (after the village is built)
function clearGrassIndoors() {
  if (!GRASS_INST || !ENTER.length) return;
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const total = GRASS_INST.userData.maxCount || GRASS_INST.count;
  const isMeadow = activeMapId === 'meadow';
  let n = 0;
  for (let i = 0; i < total; i++) {
    GRASS_INST.getMatrixAt(i, m); p.setFromMatrixPosition(m);
    let inside = !!whereIs(p.x, p.z, 0);
    if (!inside) for (const b of ENTER) { const l = b.g.worldToLocal(_tv.set(p.x, 0, p.z)); const bb = b.bbox || (b.bbox = new THREE.Box3().setFromObject(b.g)); if (b.g.userData.footprintBox) { const f = b.g.userData.footprintBox; if (Math.abs(l.x - f.x) < f.w / 2 && Math.abs(l.z - f.z) < f.d / 2) { inside = true; break; } } }
    if (!inside && isMeadow) {
      if (
        isMeadowGroundCutout(p.x, p.z) ||
        isInMudWallow(p.x, p.z) ||
        Math.hypot(p.x - 17.4, p.z + 23.7) < 2.05 ||
        Math.hypot(p.x - 16.2, p.z - 24.5) < 1.85 ||
        Math.hypot(p.x - 17.6, p.z + 9.6) < 1.80 ||
        Math.hypot(p.x - 24.5, p.z + 2.2) < 1.68 ||
        Math.hypot(p.x + 6.2, p.z - 27.8) < 1.68 ||
        Math.hypot(p.x + 26.2, p.z + 6.5) < 1.68
      ) {
        inside = true;
      }
    }
    if (inside) { GRASS_INST.setMatrixAt(i, zero); n++; }
  }
  GRASS_INST.instanceMatrix.needsUpdate = true;
  console.log(`[grass] cleared ${n} blades indoors`);
}

// ---- cosy houses facing the plaza
const WALLS = [0xf3e3c3, 0xe9b98f, 0xb9d3e3, 0xcfe0b9, 0xf0cfc8, 0xe7d9a8];
const ROOFS = [0xc0563f, 0x4f7fa8, 0x8a5a3c, 0x5d8a52, 0xb4733e];
function house(angle, dist, w, d, h, wall, roof) {
  const g = new THREE.Group();
  const walls = mesh(new THREE.BoxGeometry(w, h, d), wall, { tex: 'plaster', rep: [w / 2.6, h / 2.6] });
  walls.position.y = h / 2; g.add(walls);
  // roof: triangular prism
  const shape = new THREE.Shape(); shape.moveTo(-w / 2 - 0.35, 0); shape.lineTo(0, h * 0.55); shape.lineTo(w / 2 + 0.35, 0); shape.closePath();
  const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.7, bevelEnabled: false });
  rg.translate(0, 0, -(d + 0.7) / 2);
  const r = mesh(rg, roof, { tex: 'tiles', rep: [0.32, 0.32] }); r.position.y = h; g.add(r);
  // door, windows, beams, chimney
  const door = mesh(new THREE.BoxGeometry(w * 0.22, h * 0.48, 0.12), 0x7a4e2d, { tex: 'wood', rep: [0.7, 1] }); door.position.set(-w * 0.18, h * 0.24, d / 2 + 0.05); g.add(door);
  for (const wx of [w * 0.22]) { const win = mesh(new THREE.BoxGeometry(w * 0.2, h * 0.22, 0.1), 0x9cc7dd, { vary: 0.02 }); win.position.set(wx, h * 0.6, d / 2 + 0.04); g.add(win); }
  const beam = mesh(new THREE.BoxGeometry(w + 0.06, 0.16, 0.1), 0x6b4a33); beam.position.set(0, h * 0.86, d / 2 + 0.05); g.add(beam);
  const ch = mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), 0x9b8f84, { tex: 'cobble', rep: [0.5, 1] }); ch.position.set(w * 0.25, h + h * 0.35, -d * 0.15); g.add(ch);
  const x = Math.sin(angle) * dist, z = Math.cos(angle) * dist;
  g.position.set(x, 0, z);
  g.rotation.y = angle + Math.PI; // front faces the plaza
  mapRoot.add(g);
  block(walls, 0.05);
  // hiding spots along each wall
  g.updateMatrixWorld(true);
  const sp = (lx, lz) => addSpot(g.localToWorld(new THREE.Vector3(lx, 0, lz)), wall, 'wall');
  sp(w * 0.28, d / 2 + 0.55); sp(-w / 2 - 0.55, 0); sp(w / 2 + 0.55, -d * 0.2); sp(-w * 0.2, -d / 2 - 0.55); sp(w * 0.25, -d / 2 - 0.55);
  addSpot(g.localToWorld(new THREE.Vector3(-w * 0.18, 0, d / 2 + 0.5)), 0x7a4e2d, 'door');
}
const ring = [
  [0.1, 19, 6, 5, 4], [0.95, 20, 5, 5, 3.6], [1.75, 19, 7, 5, 4.4], [2.6, 21, 5.5, 5, 3.8],
  [3.5, 19, 6, 5.5, 4], [4.35, 20, 5, 5, 3.6], [5.2, 19.5, 6.5, 5, 4.2],
];

// ---- market stalls with striped awnings
function stall(x, z, rot, c1, c2, fruit) {
  const g = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(3, 0.9, 1.4), 0xa9784f, { tex: 'wood', rep: [1.5, 0.5] }); top.position.y = 0.45; g.add(top);
  for (const [px, pz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) { const p = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4), 0x7a4e2d); p.position.set(px, 1.2, pz); g.add(p); }
  for (let i = 0; i < 6; i++) { const s = mesh(new THREE.BoxGeometry(0.52, 0.08, 1.9), i % 2 ? c1 : c2, { vary: 0.02 }); s.position.set(-1.3 + i * 0.52, 2.45, 0); s.rotation.x = 0.12; g.add(s); }
  for (let i = 0; i < 9; i++) { const f = mesh(new THREE.SphereGeometry(0.16, 8, 6), fruit, { vary: 0.08 }); f.position.set(rand(-1.2, 1.2), 1.05, rand(-0.45, 0.45)); g.add(f); }
  g.position.set(x, 0, z); g.rotation.y = rot; mapRoot.add(g); block(top, 0.1);
  g.updateMatrixWorld(true);
  addSpot(g.localToWorld(new THREE.Vector3(0, 0, -1.2)), 0xa9784f, 'stall');
}
// ============================================================ village structures — Codex's Storybook-style kit buildings when available
// ============================================================ enterable buildings (rooms, doors, roof hiding, AI routing)
const ENTER = [];      // { g, roof, rooms, door, doorIn, inner, doorRoom } — positions in world space
let INSIDE = null;     // building the player is in (its roof is hidden)
const _tv = new THREE.Vector3();
const _ghCand = [];
const _byBlockerIndex = (a, b) => a._bi - b._bi;
function groundHeightAt(x, z, refY, isVaulting = false) {
  let gy = (ACTIVE_MAP && ACTIVE_MAP.groundHeightAt) ? ACTIVE_MAP.groundHeightAt(x, z, refY) : 0;
  if (ENTER.length) {
    const w = whereIs(x, z, refY);
    if (w) {
      const fl = w.b.g.userData.floorY ?? (ACTIVE_MAP?.defaultBuildingFloorY ?? (ACTIVE_MAP ? 0.36 : 0.22));
      const bY = w.b.g.position.y + fl;
      if (gy < w.b.g.position.y - 0.1 || bY > gy) gy = Math.max(gy, bY);
    } else if (ACTIVE_MAP && !ACTIVE_MAP.isMeadowBase) {
      for (const b of ENTER) {
        if (typeof refY === 'number' && Math.abs(refY - b.g.position.y) > 1.6) continue;
        if (b.door && Math.hypot(x - b.door.x, z - b.door.z) < 1.65 && gy < b.g.position.y - 0.1) {
          gy = b.g.position.y;
          break;
        }
      }
    }
  }
  // Allow landing & perching on top of chairs, tables, benches, crates, barrels & low obstacles after jumping!
  // Only blockers in the grid cells around (x, z) can contain the foot point, so scan those (plus the few
  // oversized blockers) instead of every blocker on the map; called many times per frame per character.
  if (typeof refY === 'number') {
    const footPad = 0.18;
    const snapMargin = isVaulting ? 0.32 : 0.14;
    const standOn = (b) => {
      if (b.disabled || !b.standable || b.y1 == null) return;
      if (b.y1 <= gy + 0.08 || b.y1 > gy + 1.85) return;
      if (refY < b.y1 - snapMargin) return;
      if (x < b.x0 - footPad || x > b.x1 + footPad || z < b.z0 - footPad || z > b.z1 + footPad) return;
      if (b.obb) {
        const [lx, lz] = obbLocal(b.obb, x, z);
        if (Math.abs(lx) > b.obb.hx + footPad || Math.abs(lz) > b.obb.hz + footPad) return;
      }
      if (b.y1 > gy) gy = b.y1;
    };
    if (blockers.length !== _blockerGridLen) rebuildBlockerGrid();
    // the result depends on visiting order (a lower perch raises gy, which changes which higher ones
    // qualify), so candidates are applied in their original blockers[] order, exactly as before
    const cand = _ghCand; cand.length = 0;
    for (let i = 0; i < _bigBlockers.length; i++) cand.push(_bigBlockers[i]);
    const visit = (++_blockerVisitSeq) || (_blockerVisitSeq = 1);
    const cx0 = Math.floor((x - footPad) * 0.25), cx1 = Math.floor((x + footPad) * 0.25);
    const cz0 = Math.floor((z - footPad) * 0.25), cz1 = Math.floor((z + footPad) * 0.25);
    for (let gx = cx0; gx <= cx1; gx++) {
      for (let gz = cz0; gz <= cz1; gz++) {
        const bucket = _blockerCells.get((gx + 512) * 1024 + (gz + 512));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const b = bucket[i];
          if (b._gv === visit) continue;
          b._gv = visit;
          if (b.standable) cand.push(b);
        }
      }
    }
    if (cand.length > 1) cand.sort(_byBlockerIndex);
    for (let i = 0; i < cand.length; i++) standOn(cand[i]);
  }
  return gy;
}
function registerEnterable(g) {
  const u = g.userData; if (!u.rooms || !u.rooms.length) return;
  g.updateMatrixWorld(true);
  const W = (p) => { const v = g.localToWorld(new THREE.Vector3(p.x, 0, p.z)); v.y = g.position.y; return v; };
  const roof = g.getObjectByName('roof');
  if (roof) roof.traverse((m) => { if (m.isMesh) m.userData.isRoof = true; });
  const b = { g, roof, rooms: u.rooms, door: u.door ? W(u.door) : null, doorIn: u.doorIn ? W(u.doorIn) : null, inner: (u.innerDoors || []).map(W) };
  ENTER.push(b);
  b.doorRoom = b.doorIn ? (whereIs(b.doorIn.x, b.doorIn.z, g.position.y) || { room: 0 }).room : 0;
}
// whereIs runs several times per character per frame. Each building keeps a cached inverse world matrix
// (recomputed only if the building's matrix changes) and a world-space bounding circle around its rooms,
// so most buildings are rejected with one distance test instead of a 4x4 matrix inversion.
function _enterLocalCache(b) {
  const mw = b.g.matrixWorld;
  if (!b._inv || !b._invSrc.equals(mw)) {
    b._invSrc = (b._invSrc || new THREE.Matrix4()).copy(mw);
    b._inv = (b._inv || new THREE.Matrix4()).copy(mw).invert();
    let rLocal = 0;
    for (const r of b.rooms) rLocal = Math.max(rLocal, Math.hypot(Math.abs(r.x) + r.w / 2, Math.abs(r.z) + r.d / 2));
    const sc = Math.max(Math.hypot(mw.elements[0], mw.elements[1], mw.elements[2]), Math.hypot(mw.elements[8], mw.elements[9], mw.elements[10]));
    b._bx = mw.elements[12]; b._bz = mw.elements[14]; b._br = rLocal * sc + 0.05;
  }
  return b._inv;
}
function whereIs(x, z, refY) {
  for (const b of ENTER) {
    if (typeof refY === 'number' && Math.abs(refY - b.g.position.y) > 1.85) continue;
    const inv = _enterLocalCache(b);
    const dx = x - b._bx, dz = z - b._bz;
    if (dx * dx + dz * dz > b._br * b._br) continue;
    const l = _tv.set(x, b.g.position.y, z).applyMatrix4(inv);
    for (let i = 0; i < b.rooms.length; i++) { const r = b.rooms[i]; if (Math.abs(l.x - r.x) <= r.w / 2 && Math.abs(l.z - r.z) <= r.d / 2) return { b, room: i }; }
  }
  return null;
}
const nearestOf = (list, p) => list.reduce((best, q) => (!best || q.distanceTo(p) < best.distanceTo(p) ? q : best), null);
function innerDoorNormalWorld(b, rFrom, rTo) {
  const dx = rTo.x - rFrom.x, dz = rTo.z - rFrom.z;
  const lx = Math.abs(dx) >= Math.abs(dz) ? Math.sign(dx) : 0;
  const lz = lx === 0 ? Math.sign(dz) : 0;
  const p0 = b.g.localToWorld(new THREE.Vector3(0, 0, 0));
  const p1 = b.g.localToWorld(new THREE.Vector3(lx, 0, lz));
  const wx = p1.x - p0.x, wz = p1.z - p0.z, len = Math.hypot(wx, wz) || 1;
  return { nx: wx / len, nz: wz / len };
}
function routeInnerArchway(b, fromRoom, toRoom, from, nextGoal) {
  if (!b.inner || !b.inner.length) return null;
  const d = nearestOf(b.inner, from);
  if (nextGoal && Math.hypot(nextGoal.x - d.x, nextGoal.z - d.z) < 0.45) return d;
  if (fromRoom !== toRoom) {
    const { nx, nz } = innerDoorNormalWorld(b, b.rooms[fromRoom], b.rooms[toRoom]);
    const along = (from.x - d.x) * nx + (from.z - d.z) * nz;
    const perp = Math.abs(-(from.x - d.x) * nz + (from.z - d.z) * nx);
    if (perp > 0.38 && along < 0.15) return { x: d.x - nx * 0.58, y: d.y, z: d.z - nz * 0.58 };
    return { x: d.x + nx * 0.62, y: d.y, z: d.z + nz * 0.62 };
  }
  if (Math.hypot(from.x - d.x, from.z - d.z) < 0.58 && nextGoal && Math.hypot(nextGoal.x - d.x, nextGoal.z - d.z) > 0.65) {
    const otherIdx = b.rooms.findIndex((_, idx) => idx !== toRoom);
    if (otherIdx >= 0) {
      const { nx, nz } = innerDoorNormalWorld(b, b.rooms[otherIdx], b.rooms[toRoom]);
      const along = (from.x - d.x) * nx + (from.z - d.z) * nz;
      const perp = Math.abs(-(from.x - d.x) * nz + (from.z - d.z) * nx);
      const goalPerp = Math.abs(-(nextGoal.x - d.x) * nz + (nextGoal.z - d.z) * nx);
      if (along > -0.15 && along < 0.56 && perp < 0.55 && goalPerp > 0.55) {
        return { x: d.x + nx * 0.62, y: d.y, z: d.z + nz * 0.62 };
      }
    }
  }
  return null;
}
function segHitsRectT(x0, z0, x1, z1, minX, maxX, minZ, maxZ) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-8) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return (clip(-dx, x0 - minX) && clip(dx, maxX - x0) && clip(-dz, z0 - minZ) && clip(dz, maxZ - z0) && t0 <= t1) ? t0 : null;
}
function segHitsRect(x0, z0, x1, z1, minX, maxX, minZ, maxZ) {
  return segHitsRectT(x0, z0, x1, z1, minX, maxX, minZ, maxZ) !== null;
}
function routeAroundBuildings(from, target) {
  const fy = typeof from.y === 'number' ? from.y : groundHeightAt(from.x, from.z);
  const isSafeWalkPt = (x, z, refY) => !blockedAt(x, z, 0.38, refY) &&
    !(ACTIVE_MAP && ACTIVE_MAP.isDeepWater && ACTIVE_MAP.isDeepWater(x, z)) &&
    !(ACTIVE_MAP && ACTIVE_MAP.isSkyGap && ACTIVE_MAP.isSkyGap(x, z));

  let bestT0 = 1e9;
  let bestWp = null;

  // 1. Check enterable buildings (front porch + side-alley + backyard corner wrapping)
  for (const eb of ENTER) {
    const by = eb.g.position.y || 0;
    if (Math.abs(fy - by) > 1.35) continue;
    const u = eb.g.userData || {};
    const fw = (u.footprint && u.footprint.w) || (u.footprintBox && u.footprintBox.w) || 9.0;
    const fd = (u.footprint && u.footprint.d) || (u.footprintBox && u.footprintBox.d) || 8.0;
    const doorX = (u.door && typeof u.door.x === 'number') ? u.door.x : 0;
    const doorZ = (u.door && typeof u.door.z === 'number') ? u.door.z : (fd * 0.5 + 0.8);
    const minX = -(fw * 0.5 + 0.16), maxX = fw * 0.5 + 0.16;
    const minZ = -(fd * 0.5 + 0.16), maxZ = fd * 0.5 + 0.16;
    const lf = eb.g.worldToLocal(_tv.set(from.x, by, from.z)).clone();
    const lt = eb.g.worldToLocal(_tv.set(target.x, by, target.z)).clone();
    // Never corner-wrap if already standing in the front doorway / porch corridor!
    if (lf.z > 0.4 && Math.abs(lf.x - doorX) < 1.65) continue;
    if (lf.x > minX && lf.x < maxX && lf.z > minZ && lf.z < maxZ) continue;
    if (lt.x > minX && lt.x < maxX && lt.z > minZ && lt.z < maxZ) continue;
    if (Math.hypot(lf.x - lt.x, lf.z - lt.z) < 0.75) continue;
    const hitT = segHitsRectT(lf.x, lf.z, lt.x, lt.z, minX - 0.28, maxX + 0.28, minZ - 0.28, maxZ + 0.28);
    if (hitT === null || hitT >= bestT0) continue;

    const frontZ = Math.max(maxZ + 1.05, doorZ + 0.65);
    const okPt = (pt) => isSafeWalkPt(pt.x, pt.z, by);
    const okSeg = (a, b2) => okPt({ x: (a.x + b2.x) * 0.5, z: (a.z + b2.z) * 0.5 });
    const wrapX = fw * 0.5 + 1.28;
    const pref = (Math.abs(lf.x + wrapX) + Math.abs(lt.x + wrapX) <= Math.abs(lf.x - wrapX) + Math.abs(lt.x - wrapX)) ? -1 : 1;
    let chosenForEb = null;
    for (const s of [pref, -pref]) {
      const cFrontL = { x: s * wrapX, z: frontZ };
      const cFrontW = eb.g.localToWorld(new THREE.Vector3(cFrontL.x, 0, cFrontL.z));
      let cBackL = null, cBackW = null;
      for (const bPad of [1.18, 0.68, 1.65]) {
        const candL = { x: s * wrapX, z: -(fd * 0.5 + bPad) };
        const candW = eb.g.localToWorld(new THREE.Vector3(candL.x, 0, candL.z));
        if (okPt(candW) && okSeg(candW, cFrontW)) { cBackL = candL; cBackW = candW; break; }
      }
      const nearFront = Math.hypot(from.x - cFrontW.x, from.z - cFrontW.z) < 0.95;
      const nearBack = cBackW ? Math.hypot(from.x - cBackW.x, from.z - cBackW.z) < 0.95 : false;
      if (lt.z >= maxZ - 0.2) {
        if (nearFront || !okPt(cFrontW)) continue;
        const pastSide = s * lf.x >= fw * 0.5 + 0.52;
        if (!nearBack && !pastSide && segHitsRect(lf.x, lf.z, cFrontL.x, cFrontL.z, minX, maxX, minZ, maxZ)) {
          if (cBackW) { chosenForEb = { x: cBackW.x, y: by, z: cBackW.z }; break; }
          continue;
        }
        chosenForEb = { x: cFrontW.x, y: by, z: cFrontW.z };
        break;
      } else {
        if (nearBack || !cBackW) continue;
        const pastSide = s * lf.x >= fw * 0.5 + 0.52;
        if (!nearFront && !pastSide && segHitsRect(lf.x, lf.z, cBackL.x, cBackL.z, minX, maxX, minZ, maxZ)) {
          if (okPt(cFrontW)) { chosenForEb = { x: cFrontW.x, y: by, z: cFrontW.z }; break; }
          continue;
        }
        chosenForEb = { x: cBackW.x, y: by, z: cBackW.z };
        break;
      }
    }
    if (chosenForEb) {
      bestT0 = hitT;
      bestWp = chosenForEb;
    }
  }

  // 2. Also wrap around non-enterable houses, barns, stalls, towers & giant furniture in blockers!
  for (const b of blockers) {
    if (b.standable) continue;
    if (b.y0 != null && b.y1 != null && (fy + 1.22 < b.y0 || fy >= b.y1 - 0.12 || (b.y1 - b.y0) < 1.5)) continue;
    const hx = b.obb ? b.obb.hx : (b.x1 - b.x0) * 0.5;
    const hz = b.obb ? b.obb.hz : (b.z1 - b.z0) * 0.5;
    if ((hx * 2 < 2.1 && hz * 2 < 2.1) || hx * 2 > 28 || hz * 2 > 28) continue;
    const cx = b.obb ? b.obb.cx : (b.x0 + b.x1) * 0.5;
    const cz = b.obb ? b.obb.cz : (b.z0 + b.z1) * 0.5;
    // Skip wall segments belonging to an ENTER building already handled above
    if (ENTER.some((eb) => Math.hypot(cx - eb.g.position.x, cz - eb.g.position.z) < 6.0)) continue;

    let fLx, fLz, tLx, tLz;
    if (b.obb) {
      [fLx, fLz] = obbLocal(b.obb, from.x, from.z);
      [tLx, tLz] = obbLocal(b.obb, target.x, target.z);
    } else {
      fLx = from.x - cx; fLz = from.z - cz;
      tLx = target.x - cx; tLz = target.z - cz;
    }
    const padHit = 0.36;
    if (Math.abs(fLx) < hx + 0.08 && Math.abs(fLz) < hz + 0.08) continue;
    if (Math.abs(tLx) < hx + 0.08 && Math.abs(tLz) < hz + 0.08) continue;
    const hitT = segHitsRectT(fLx, fLz, tLx, tLz, -(hx + padHit), hx + padHit, -(hz + padHit), hz + padHit);
    if (hitT === null || hitT >= bestT0) continue;

    const toWorld = (lx, lz) => {
      if (b.obb) { const [wx, wz] = obbWorld(b.obb, lx, lz); return { x: wx, z: wz }; }
      return { x: cx + lx, z: cz + lz };
    };

    let bestCorner = null, bestCornerCost = 1e9;
    const cPadX = hx + 1.15, cPadZ = hz + 1.15;
    const cornersL = [
      [-cPadX, -cPadZ], [cPadX, -cPadZ],
      [-cPadX,  cPadZ], [cPadX,  cPadZ],
    ];
    for (const [clx, clz] of cornersL) {
      const cw = toWorld(clx, clz);
      if (Math.hypot(from.x - cw.x, from.z - cw.z) < 0.92) continue;
      const cy = groundHeightAt(cw.x, cw.z, fy);
      if (Math.abs(cy - fy) > 1.25 || !isSafeWalkPt(cw.x, cw.z, cy)) continue;
      // Prefer corners directly reachable from `from` without crossing the blocker itself
      const blockedToCorner = segHitsRect(fLx, fLz, clx, clz, -(hx + 0.08), hx + 0.08, -(hz + 0.08), hz + 0.08);
      if (blockedToCorner) continue;
      const cost = Math.hypot(clx - fLx, clz - fLz) + Math.hypot(tLx - clx, tLz - clz);
      if (cost < bestCornerCost) {
        bestCornerCost = cost;
        bestCorner = { x: cw.x, y: cy, z: cw.z };
      }
    }
    if (bestCorner) {
      bestT0 = hitT;
      bestWp = bestCorner;
    }
  }

  return bestWp;
}
// next waypoint so AI walks through doorways & multi-tier stairs/bridges instead of into walls or cliffs
function routeVia(from, goal) {
  if (ENTER.length) {
    const a = whereIs(from.x, from.z, from.y), t = whereIs(goal.x, goal.z, goal.y);
    if (a && (!t || t.b !== a.b)) {                                    // leaving building a
      const archWp = routeInnerArchway(a.b, a.room, a.b.doorRoom, from, a.b.doorIn || a.b.door || goal);
      if (archWp) return archWp;
      if (a.b.doorIn && Math.hypot(from.x - a.b.doorIn.x, from.z - a.b.doorIn.z) > 0.7) {
        if (a.b.door) {
          const vx = a.b.door.x - a.b.doorIn.x, vz = a.b.door.z - a.b.doorIn.z, vv = vx * vx + vz * vz;
          const u = vv > 1e-4 ? clamp(((from.x - a.b.doorIn.x) * vx + (from.z - a.b.doorIn.z) * vz) / vv, 0, 1) : 0;
          if (u > 0.05 && Math.hypot(from.x - (a.b.doorIn.x + vx * u), from.z - (a.b.doorIn.z + vz * u)) < 1.15) return a.b.door;
        }
        return a.b.doorIn;
      }
      if (a.b.door && Math.hypot(from.x - a.b.door.x, from.z - a.b.door.z) > 0.6) return a.b.door;
    } else if (t && !a) {                                              // entering building t
      const b = t.b;
      let inThresholdCorridor = false;
      if (b.door && b.doorIn) {
        const vx = b.doorIn.x - b.door.x, vz = b.doorIn.z - b.door.z, vv = vx * vx + vz * vz;
        const u = vv > 1e-4 ? clamp(((from.x - b.door.x) * vx + (from.z - b.door.z) * vz) / vv, 0, 1) : 0;
        if (Math.hypot(from.x - (b.door.x + vx * u), from.z - (b.door.z + vz * u)) < 1.15) inThresholdCorridor = true;
      }
      if (b.door && !inThresholdCorridor && Math.hypot(from.x - b.door.x, from.z - b.door.z) > 1.05 && (!b.doorIn || Math.hypot(from.x - b.doorIn.x, from.z - b.doorIn.z) > 0.95)) {
        if (ACTIVE_MAP && ACTIVE_MAP.routeTierWaypoint) {
          const tw = ACTIVE_MAP.routeTierWaypoint(from, b.door);
          if (tw) return tw;
        }
        const wrap = routeAroundBuildings(from, b.door);
        if (wrap) return wrap;
        return b.door;
      }
      return b.doorIn || goal;
    } else if (a && t && a.b === t.b) {                                // same building (possibly across partition archway)
      const archWp = routeInnerArchway(a.b, a.room, t.room, from, goal);
      if (archWp) return archWp;
    }
    if (!a) {
      if (ACTIVE_MAP && ACTIVE_MAP.routeTierWaypoint) {
        const tw = ACTIVE_MAP.routeTierWaypoint(from, goal);
        if (tw) return tw;
      }
      const wrapGoal = routeAroundBuildings(from, goal);
      if (wrapGoal) return wrapGoal;
      return goal;
    }
  }
  if (ACTIVE_MAP && ACTIVE_MAP.routeTierWaypoint) {
    const tw = ACTIVE_MAP.routeTierWaypoint(from, goal);
    if (tw) return tw;
  }
  const wrapOutdoor = routeAroundBuildings(from, goal);
  if (wrapOutdoor) return wrapOutdoor;
  return goal;
}
function updateInside() {
  if (!ENTER.length) return;
  const focusChar = (G.spectating && G.specTarget) ? G.specTarget : G.player;
  const p = focusChar && focusChar.position;
  const refY = focusChar ? (focusChar.userData.groundY ?? focusChar.position.y) : undefined;
  const w = p && G.phase !== 'menu' ? whereIs(p.x, p.z, refY) : null;
  // seek mode is first-person: hide the roof of the building you stand in too
  INSIDE = w ? w.b : null;
  for (const b of ENTER) if (b.roof) b.roof.visible = b !== INSIDE;
}
function collectKitMeshInfos(g) {
  g.updateMatrixWorld(true);
  const gInv = g.matrixWorld.clone().invert();
  const out = [];
  g.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.userData.isRoof || m.userData.ground || m.userData.noSolid) return;
    let anc = m;
    while (anc && anc !== g) { if (anc.name === 'roof' || anc.userData?.isRoof) return; anc = anc.parent; }
    const geo = m.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;
    const rel = new THREE.Matrix4().multiplyMatrices(gInv, m.matrixWorld);
    const e = rel.elements;
    const isIdent =
      Math.abs(e[0] - 1) < 1e-4 && Math.abs(e[5] - 1) < 1e-4 && Math.abs(e[10] - 1) < 1e-4 &&
      Math.abs(e[12]) < 1e-4 && Math.abs(e[13]) < 1e-4 && Math.abs(e[14]) < 1e-4 &&
      Math.abs(e[1]) < 1e-4 && Math.abs(e[2]) < 1e-4 && Math.abs(e[4]) < 1e-4 &&
      Math.abs(e[6]) < 1e-4 && Math.abs(e[8]) < 1e-4 && Math.abs(e[9]) < 1e-4;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const box = geo.boundingBox.clone();
    if (!isIdent) box.applyMatrix4(rel);
    out.push({ geo, rel, e, isIdent, box });
  });
  return out;
}
function inferColliderTopLocal(meshInfos, c, flY, defH, isEnterable) {
  if (isEnterable && Math.min(c.w, c.d) <= 0.36 && Math.max(c.w, c.d) >= 1.25) {
    return { y1: defH, standable: false };
  }
  const inX = c.w > 0.44 ? 0.08 : 0.02, inZ = c.d > 0.44 ? 0.08 : 0.02;
  const hx = Math.max(0.05, c.w * 0.5 - inX), hz = Math.max(0.05, c.d * 0.5 - inZ);
  const rot = c.rot || 0, cc = Math.cos(rot), sn = Math.sin(rot);
  const rad = Math.hypot(hx, hz);
  let topY = -Infinity;
  for (const mi of meshInfos) {
    if (mi.box.max.x < c.x - rad || mi.box.min.x > c.x + rad || mi.box.max.z < c.z - rad || mi.box.min.z > c.z + rad || mi.box.max.y <= flY + 0.14) continue;
    const pos = mi.geo.attributes.position, arr = pos.array, idx = mi.geo.index ? mi.geo.index.array : null;
    const cnt = idx ? idx.length : pos.count, e = mi.e;
    for (let i = 0; i < cnt; i += 3) {
      const i0 = (idx ? idx[i] : i) * 3, i1 = (idx ? idx[i + 1] : i + 1) * 3, i2 = (idx ? idx[i + 2] : i + 2) * 3;
      let x0 = arr[i0], y0 = arr[i0 + 1], z0 = arr[i0 + 2];
      let x1 = arr[i1], y1 = arr[i1 + 1], z1 = arr[i1 + 2];
      let x2 = arr[i2], y2 = arr[i2 + 1], z2 = arr[i2 + 2];
      if (!mi.isIdent) {
        const tx0 = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12], ty0 = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13], tz0 = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
        const tx1 = e[0] * x1 + e[4] * y1 + e[8] * z1 + e[12], ty1 = e[1] * x1 + e[5] * y1 + e[9] * z1 + e[13], tz1 = e[2] * x1 + e[6] * y1 + e[10] * z1 + e[14];
        const tx2 = e[0] * x2 + e[4] * y2 + e[8] * z2 + e[12], ty2 = e[1] * x2 + e[5] * y2 + e[9] * z2 + e[13], tz2 = e[2] * x2 + e[6] * y2 + e[10] * z2 + e[14];
        x0 = tx0; y0 = ty0; z0 = tz0; x1 = tx1; y1 = ty1; z1 = tz1; x2 = tx2; y2 = ty2; z2 = tz2;
      }
      const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
      if (maxY <= flY + 0.14 || minY > flY + 1.48) continue;
      let lx0 = x0 - c.x, lz0 = z0 - c.z, lx1 = x1 - c.x, lz1 = z1 - c.z, lx2 = x2 - c.x, lz2 = z2 - c.z;
      if (rot) {
        const rx0 = lx0 * cc - lz0 * sn, rz0 = lx0 * sn + lz0 * cc;
        const rx1 = lx1 * cc - lz1 * sn, rz1 = lx1 * sn + lz1 * cc;
        const rx2 = lx2 * cc - lz2 * sn, rz2 = lx2 * sn + lz2 * cc;
        lx0 = rx0; lz0 = rz0; lx1 = rx1; lz1 = rz1; lx2 = rx2; lz2 = rz2;
      }
      if (Math.max(lx0, lx1, lx2) < -hx || Math.min(lx0, lx1, lx2) > hx || Math.max(lz0, lz1, lz2) < -hz || Math.min(lz0, lz1, lz2) > hz) continue;
      if (maxY > topY) {
        topY = maxY;
        if (topY >= flY + 1.75) return { y1: defH, standable: false };
      }
    }
  }
  if (topY < flY + 0.16) return { y1: defH, standable: false };
  if (topY <= flY + 1.68) return { y1: topY, standable: !c.noJump };
  return { y1: defH, standable: false };
}
function placeKit(g, x, z, rotY, pad = 0.05, solid = true, yOverride) {
  let hasGroundMesh = Boolean(g.userData.ground || g.userData.noCollide);
  g.traverse((m) => {
    if (m.isMesh && m.userData.ground) {
      hasGroundMesh = true;
      m.userData.keep = true;
    }
  });
  if (!g.userData.rooms && !g.userData.merged) { try { mergeStatic(THREE, g); g.userData.merged = true; } catch (e) { console.warn('[placeKit] merge failed', g.name, e); } }   // trees, bushes, fences… → few draw calls
  const gy = typeof yOverride === 'number' ? yOverride : groundHeightAt(x, z);
  g.position.set(x, gy, z); g.rotation.y = rotY || 0; mapRoot.add(g);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (solid && !m.userData.noSolid) solids.push(m); } });
  if (solid) {
    // enterable buildings & bridges/piers declare their own colliders (local boxes) so doorways/decks stay open; walkable ground skips block()
    const cols = g.userData.colliders;
    if (cols && cols.length) {
      const sc = g.scale.x, baseY = g.position.y || 0;
      const defLocalH = g.userData.colliderHeight ?? 3.4;
      const defY0 = baseY + (g.userData.colliderBottom ?? -0.45);
      const isEnterable = Boolean(g.userData.rooms && g.userData.rooms.length);
      const flY = g.userData.floorY ?? (isEnterable ? (ACTIVE_MAP?.defaultBuildingFloorY ?? (ACTIVE_MAP ? 0.36 : 0.22)) : 0);
      let meshInfos = null;
      for (const c of cols) {
        const cy0 = typeof c.y0 === 'number' ? baseY + c.y0 * sc : defY0;
        let cy1, standable = false;
        if (typeof c.y1 === 'number') {
          cy1 = baseY + c.y1 * sc;
          standable = (c.y1 - flY) * sc <= 1.68 && !c.noJump;
        } else if (typeof c.h === 'number') {
          cy1 = baseY + c.h * sc;
          standable = (c.h - flY) * sc <= 1.68 && !c.noJump;
        } else {
          if (!meshInfos) meshInfos = collectKitMeshInfos(g);
          const inf = inferColliderTopLocal(meshInfos, c, flY, defLocalH, isEnterable);
          cy1 = baseY + inf.y1 * sc;
          standable = inf.standable;
        }
        blockRotated(g, c.x * sc, c.z * sc, (c.w / 2) * sc + pad, (c.d / 2) * sc + pad, c.rot || 0, cy0, cy1, standable);
      }
    } else if (!hasGroundMesh && !Array.isArray(cols)) block(g, pad);
  }
  return g;
}
// a rotated box blocker (OBB). Keeps an AABB + vertical [y0, y1] span so multi-tier bridges/viaducts never block underneath!
function blockRotated(g, lx, lz, hx, hz, lrot, y0, y1, standable = false) {
  const r = g.rotation.y, cs = Math.cos(r), sn = Math.sin(r);
  const cx = g.position.x + lx * cs + lz * sn, cz = g.position.z - lx * sn + lz * cs, rr = r + lrot;
  const c = Math.cos(rr), s2 = Math.sin(rr), ex = Math.abs(hx * c) + Math.abs(hz * s2), ez = Math.abs(hx * s2) + Math.abs(hz * c);
  const baseY = g.position.y || 0;
  blockers.push({
    x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez,
    y0: typeof y0 === 'number' ? y0 : baseY - 0.45,
    y1: typeof y1 === 'number' ? y1 : baseY + (g.userData.colliderHeight ?? 3.4),
    standable: !!standable,
    obb: { cx, cz, hx, hz, c, s: s2 },
  });
}
// world → blocker-local for an OBB (inverse of toWorld's rotation)
function obbLocal(o, x, z) { const dx = x - o.cx, dz = z - o.cz; return [dx * o.c - dz * o.s, dx * o.s + dz * o.c]; }
function obbWorld(o, lx, lz) { return [o.cx + lx * o.c + lz * o.s, o.cz - lx * o.s + lz * o.c]; }
let windmillSails = null, laundryCloth = null, STREAM = null;
const STRUCT = { cottages: [], stalls: [], well: null, barn: null, mill: null };
function isMeadowExpansionFootprint(x, z) {
  if (isMeadowGroundCutout(x, z) || isInMudWallow(x, z)) return true;
  if (x > 24.5 && x < 35.0 && z > -2.6 && z < 9.6) return true;      // Sunny Pasture
  if (x > 14.0 && x < 22.6 && z > -27.6 && z < -18.4) return true;   // Chicken Coop Yard
  if (x > 26.8 && x < 34.6 && z > -17.2 && z < -9.8) return true;    // Muddy Pigpen & Wallow
  if (x > 13.8 && x < 19.0 && z > 22.3 && z < 27.0) return true;     // Stream Duck Pond
  if (x > -8.6 && x < 2.6 && z > 25.6 && z < 33.6) return true;      // South Apple Orchard & Apiary
  if (x > -30.6 && x < -20.8 && z > 9.4 && z < 22.2) return true;    // Elder Oak Treehouse, Ramp & Trunk Slide
  if (x > 12.2 && x < 20.6 && z > -15.6 && z < -7.8) return true;    // Barn Hayloft Steps & Bouncy Hay-Wagon
  if (Math.hypot(x - 24.5, z + 2.2) < 2.8 || Math.hypot(x + 6.2, z - 27.8) < 2.8 || Math.hypot(x + 26.2, z + 6.5) < 2.8) return true;
  for (const s of [STAIR_EAST, STAIR_WEST, STAIR_CULVERT]) {
    if (x > s.x0 - 1.8 && x < s.x1 + 1.8 && z > s.z0 - 1.8 && z < s.z1 + 1.8) return true;
  }
  return false;
}
function openMeadowWellShaftAndPaving(wellGrp, paveGrp) {
  if (paveGrp) {
    const bed = paveGrp.getObjectByName('paving_bed');
    if (bed && bed.isMesh) {
      bed.geometry = makePlazaDiscWithWellCutout(PLAZA_R + 0.35);
    }
    const cob = paveGrp.getObjectByName('paving_cobbles');
    if (cob && cob.isInstancedMesh) {
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
      let changed = false;
      for (let i = 0; i < cob.count; i++) {
        cob.getMatrixAt(i, m);
        p.setFromMatrixPosition(m);
        if (Math.hypot(p.x - 1.5, p.z - 1.5) < 0.78) {
          cob.setMatrixAt(i, zero);
          changed = true;
        }
      }
      if (changed) cob.instanceMatrix.needsUpdate = true;
    }
  }
  if (wellGrp) {
    wellGrp.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || !m.geometry?.attributes?.position) return;
      const geo = m.geometry;
      const pos = geo.attributes.position, nrm = geo.attributes.normal;
      const idx = geo.index ? geo.index.array : null;
      const cnt = idx ? idx.length : pos.count;
      let hasFlatCap = false;
      for (let i = 0; i < cnt; i += 3) {
        const i0 = idx ? idx[i] : i;
        const y0 = pos.getY(i0), x0 = pos.getX(i0), z0 = pos.getZ(i0);
        const ny = nrm ? Math.abs(nrm.getY(i0)) : 0;
        if (ny > 0.85 && y0 > 0.44 && y0 < 0.60 && Math.hypot(x0, z0) < 0.82) {
          hasFlatCap = true;
          break;
        }
      }
      if (!hasFlatCap) return;
      const cloned = geo.clone();
      const cPos = cloned.attributes.position, cNrm = cloned.attributes.normal;
      const cIdx = cloned.index ? cloned.index.array : null;
      const kept = [];
      for (let i = 0; i < cnt; i += 3) {
        const a = cIdx ? cIdx[i] : i, b = cIdx ? cIdx[i + 1] : i + 1, c = cIdx ? cIdx[i + 2] : i + 2;
        const cy = (cPos.getY(a) + cPos.getY(b) + cPos.getY(c)) / 3;
        const cr = Math.hypot((cPos.getX(a) + cPos.getX(b) + cPos.getX(c)) / 3, (cPos.getZ(a) + cPos.getZ(b) + cPos.getZ(c)) / 3);
        const ny = cNrm ? Math.abs((cNrm.getY(a) + cNrm.getY(b) + cNrm.getY(c)) / 3) : 0;
        if (ny > 0.85 && cy > 0.44 && cy < 0.60 && cr < 0.82) continue;
        kept.push(a, b, c);
      }
      cloned.setIndex(kept);
      cloned.computeBoundingSphere();
      m.geometry = cloned;
    });
  }
}
function finishSpots() {
  const isMeadow = activeMapId === 'meadow';
  // open grass & plaza spots (crouch flat!)
  for (let i = 0; i < 10; i++) {
    const a = rand(0, 6.28), d = rand(12, 24), sx = Math.sin(a) * d, sz = Math.cos(a) * d;
    if (isMeadow && isMeadowGroundCutout(sx, sz)) continue;
    if (ACTIVE_MAP && ACTIVE_MAP.isDeepWater && ACTIVE_MAP.isDeepWater(sx, sz)) continue;
    addSpot(new THREE.Vector3(sx, groundHeightAt(sx, sz, 0), sz), groundColorAt(sx, sz).getHex(), 'grass');
  }
  for (let i = 0; i < 4; i++) {
    const a = rand(0, 6.28), d = rand(3, 7), sx = Math.sin(a) * d, sz = Math.cos(a) * d;
    if (isMeadow && isMeadowGroundCutout(sx, sz)) continue;
    if (ACTIVE_MAP && ACTIVE_MAP.isDeepWater && ACTIVE_MAP.isDeepWater(sx, sz)) continue;
    addSpot(new THREE.Vector3(sx, groundHeightAt(sx, sz, 0), sz), groundColorAt(sx, sz).getHex(), 'stone');
  }
  // keep spots out of solid boxes & deep water (tier-aware via p.y!)
  for (let i = spots.length - 1; i >= 0; i--) {
    const p = spots[i].pos;
    if (blockedAt(p.x, p.z, 0.45, p.y) || Math.hypot(p.x, p.z) > MAPR || (ACTIVE_MAP && ACTIVE_MAP.isDeepWater && ACTIVE_MAP.isDeepWater(p.x, p.z))) spots.splice(i, 1);
  }
}
// Builds the village in steps: `yield` marks a safe point where the startup build (selectMapStaged)
// may hand the frame back to the browser so taps stay responsive. buildStructures() runs it in one go.
function buildStructures(kit) { for (const _ of buildStructuresSteps(kit)); }
function* buildStructuresSteps(kit) {
  const B = kit && kit.buildings, N = kit && kit.nature;
  if (!B || !N) {
    ring.forEach(([a, dd, w, d, h], i) => house(a, dd, w, d, h, WALLS[i % WALLS.length], ROOFS[i % ROOFS.length]));
    stall(6, -4, -0.4, 0xef7a6b, 0xfff3dc, 0xff9a3c);
    stall(-4, 6, 2.6, 0x6fb1e8, 0xfff3dc, 0xd9443a);
    // ---- well in the plaza
    {
      const w = mesh(new THREE.CylinderGeometry(1.1, 1.2, 1, 16), 0x9e958a, { tex: 'cobble', rep: [3, 0.6] }); w.position.set(1.5, 0.5, 1.5); mapRoot.add(w); block(w);
      const r = mesh(new THREE.ConeGeometry(1.5, 1, 4), 0xc0563f); r.position.set(1.5, 2.9, 1.5); r.rotation.y = Math.PI / 4; mapRoot.add(r);
      for (const s of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.16, 2.3, 0.16), 0x7a4e2d); p.position.set(1.5 + s * 1.0, 1.4, 1.5); mapRoot.add(p); }
      addSpot(new THREE.Vector3(1.5, 0, 3.2), 0x9e958a, 'stone');
    }
    // ---- barn, haystacks, barrels, crates, flower beds
    {
      const barn = mesh(new THREE.BoxGeometry(7, 5, 6), 0xb5453a, { tex: 'wood', rep: [3, 2] }); barn.position.set(22, 2.5, -14); barn.rotation.y = -0.6; mapRoot.add(barn); block(barn);
      barn.updateMatrixWorld(true);
      addSpot(barn.localToWorld(new THREE.Vector3(-1.2, -2.5, 3.6)), 0xb5453a, 'wall'); addSpot(barn.localToWorld(new THREE.Vector3(4.1, -2.5, 0.5)), 0xb5453a, 'wall');
      const br = mesh(new THREE.ConeGeometry(5.6, 2.6, 4), 0x6b4a33); br.position.set(22, 6.3, -14); br.rotation.y = -0.6 + Math.PI / 4; mapRoot.add(br);
    }
    // ---- trees around the outskirts
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1), d = rand(25, 31);
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (Math.hypot(x - 22, z + 14) < 7) continue;
      const g = new THREE.Group();
      const trunk = mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.4, 8), 0x6e4b33, { tex: 'wood', rep: [1, 1.4] }); trunk.position.y = 1.2; g.add(trunk);
      const green = pick([0x4f8a46, 0x5f9a4c, 0x6aa553, 0x47803f]);
      for (let k = 0; k < 8; k++) { const top = k > 5; const f = mesh(new THREE.IcosahedronGeometry(rand(1.0, 1.7) * (top ? 0.75 : 1), 2), top ? new THREE.Color(green).offsetHSL(0.02, 0.05, 0.08).getHex() : green, { vary: 0.08 }); f.position.set(rand(-1.1, 1.1), rand(2.7, 4.2) + (top ? 0.9 : 0), rand(-1.1, 1.1)); g.add(f); }
      g.position.set(x, 0, z); g.scale.setScalar(rand(0.9, 1.3)); mapRoot.add(g);
      block(trunk, 0.1);
      addSpot(new THREE.Vector3(x - Math.sin(a) * 0.9, 0, z - Math.cos(a) * 0.9), 0x6e4b33, 'trunk');
    }
    return;
  }
  // cottages ring the plaza, fronts facing in
  for (const [i, [a, dd, w, d, h]] of ring.entries()) {
    // hero cottage: hand-modelled from Codex's concept painting (hero_cottage.js); kit cottage as fallback
    // every house is different: hand-modelled from Codex's concept sheet (houses/*.js), hero cottage as fallback
    let g;
    try {
      const kind = HOUSE_ORDER[i % HOUSE_ORDER.length], build = (VILLAGE.houses[kind]) || null;
      g = build ? build(THREE, { seed: 11 + i * 7, garden: false, light: false }) : buildHeroCottage(THREE, { wall: WALLS[i % WALLS.length], seed: 11 + i * 7, garden: false, light: false });
      g.scale.setScalar(g.userData.rooms ? 1.0 : 0.85);     // enterable houses keep full size so rooms have space to play
    }
    catch (e) { console.warn('[hero cottage] fallback', e); g = B.cottage({ w: w * 0.85, d: d * 0.85, h: h * 0.72, wall: WALLS[i % WALLS.length], roof: ROOFS[i % ROOFS.length] }); }
    const x = Math.sin(a) * dd, z = Math.cos(a) * dd;
    placeKit(g, x, z, a + Math.PI, 0.1); registerEnterable(g);
    g.updateMatrixWorld(true);
    const lb = localBox(g);
    STRUCT.cottages.push(g);
    addSpot(g.localToWorld(new THREE.Vector3(w * 0.3, 0, d * 0.6)), WALLS[i % WALLS.length], 'wall');
    addSpot(g.localToWorld(new THREE.Vector3(-w * 0.55, 0, 0)), WALLS[i % WALLS.length], 'wall');
    // garden dressing around each cottage (bushes are soft foliage — never invisible block walls!)
    for (let k = 0; k < 2; k++) { const b = N.bush(); const lx = (k ? lb.max.x + 0.7 : lb.min.x - 0.7) / g.scale.x; const off = g.localToWorld(new THREE.Vector3(lx, 0, 1.2)); placeKit(b, off.x, off.z, rand(0, 6), 0.05, false); }
    const fl = N.flowerClump(pick([0xf2a0c2, 0xffd166, 0xb68ad8, 0xef7a6b])); const fo = g.localToWorld(new THREE.Vector3(-w * 0.15, 0, d * 0.62)); placeKit(fl, fo.x, fo.z, 0, 0, false);
    yield;
  }
  const PZ = VILLAGE.plaza, FM = VILLAGE.farm, vopt = (o) => Object.assign({ garden: false, light: false, seed: 5 }, o);
  const tryBuild = (fn, fallback) => { try { return fn(); } catch (e) { console.warn('[village] fallback', e); return fallback(); } };
  STRUCT.stalls.push(placeKit(tryBuild(() => cloneHeroGlb('market_stall') || PZ.stall(THREE, vopt({ a: 0xd9534f, b: 0xfff3dc })), () => B.stall(0xef7a6b, 0xfff3dc)), 6, -4, -0.4, 0.1));
  STRUCT.stalls.push(placeKit(tryBuild(() => cloneHeroGlb('market_stall', { tintMat: { AwningRed: 0x4f9ee3 } }) || PZ.stall(THREE, vopt({ a: 0x6fb1e8, b: 0xfff3dc, seed: 9 })), () => B.stall(0x6fb1e8, 0xfff3dc)), -4, 6, 2.6, 0.1));
  STRUCT.well = placeKit(tryBuild(() => cloneHeroGlb('plaza_well') || PZ.well(THREE, vopt({})), () => B.well()), 1.5, 1.5, 0.4, 0.05);
  let paveBuilt = null;
  if (PZ) {
    // hand-built cobbled plaza floor, benches and stone planters (concept: assets/concepts/map_plaza.png)
    tryBuild(() => {
      const pave = PZ.paving(THREE, vopt({ r: PLAZA_R + 0.3 }));
      paveBuilt = pave;
      mapRoot.add(pave);
      pave.traverse((m) => { if (m.isMesh) { m.receiveShadow = true; m.userData.ground = true; solids.push(m); } });
      if (PLAZA_DISC) { mapRoot.remove(PLAZA_DISC); const k = solids.indexOf(PLAZA_DISC); if (k >= 0) solids.splice(k, 1); }
    }, () => null);
    const face = (x, z) => Math.atan2(1.5 - x, 1.5 - z);   // turn toward the well
    for (const [x, z] of [[6.6, 3.6], [-3.6, -1.6], [1.0, -6.6]]) tryBuild(() => placeKit(PZ.bench(THREE, vopt({ seed: x * 7 + z })), x, z, face(x, z), 0.05), () => null);
    for (const [x, z] of [[-6.6, 1.0], [4.6, 7.0]]) tryBuild(() => placeKit(PZ.planter(THREE, vopt({ seed: x * 3 + z })), x, z, 0, 0.05), () => null);
  }
  openMeadowWellShaftAndPaving(STRUCT.well, paveBuilt);
  addSpot(new THREE.Vector3(1.5, 0, 3.4), 0x9e958a, 'stone');
  yield;
  const barn = placeKit(tryBuild(() => FM.barn(THREE, vopt({})), () => B.barn()), 22, -14, -0.6, 0.1); STRUCT.barn = barn; registerEnterable(barn);
  barn.updateMatrixWorld(true);
  addSpot(barn.localToWorld(new THREE.Vector3(-1.2, 0, 4)), 0xb5453a, 'wall');
  const mill = placeKit(tryBuild(() => FM.windmill(THREE, vopt({})), () => B.windmill()), -23.5, -10.5, 0.9, 0.2); STRUCT.mill = mill;
  windmillSails = mill.getObjectByName('sails');
  if (FM) {
    // farm-edge set pieces from the overview concept: woodshed, stream + stone bridge, laundry line, dry-stone walls
    tryBuild(() => { const wx = -19.5, wz = -6.5, r = facingCenter(wx, wz); placeKit(FM.woodshed(THREE, vopt({})), wx - Math.sin(r) * 2.7, wz - Math.cos(r) * 2.7, r, 0.05); }, () => null);
    tryBuild(() => {
      const a = 0.55, rr = 25.5, x = Math.sin(a) * rr, z = Math.cos(a) * rr, rot = a;   // local X = tangent: the stream runs along the village edge, the bridge points outward
      const st = FM.stream(THREE, vopt({ len: 16, w: 2 })); st.position.set(x, 0, z); st.rotation.y = rot; mapRoot.add(st);
      st.traverse((m) => { if (m.isMesh) { m.receiveShadow = true; if (m.userData.ground) solids.push(m); } });
      STREAM = { x, z, r: 9 };
      const br = FM.bridge(THREE, vopt({})); br.position.set(x, 0, z); br.rotation.y = rot; mapRoot.add(br);
      br.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; solids.push(m); } });
    }, () => null);
    tryBuild(() => { const x = -10, z = 22.5; const ll = placeKit(FM.laundryLine(THREE, vopt({})), x, z, facingCenter(x, z), 0.05, false); laundryCloth = ll.getObjectByName('cloth'); }, () => null);
    for (const [a, rr, len] of [[2.05, 24.5, 4], [2.3, 24.5, 4], [4.0, 25, 4], [4.25, 25, 3]]) tryBuild(() => placeKit(FM.stoneWall(THREE, vopt({ len, seed: a * 10 })), Math.sin(a) * rr, Math.cos(a) * rr, a + Math.PI / 2, 0.05), () => null);
  }
  yield;
  // fences around the farm, rocks and bushes in the meadow (keeping expansion gates & stairwells open!)
  for (let k = 0; k < 6; k++) {
    const a = -0.95 + k * 0.17, r = 27;
    const fx = Math.sin(a + 1.6) * r, fz = Math.cos(a + 1.6) * r - 6;
    if (isMeadowExpansionFootprint(fx, fz)) continue;
    placeKit(N.fence(2.6), fx, fz, a + 1.6 + Math.PI / 2, 0, true);
  }
  for (let k = 0; k < 10; k++) {
    const a = rand(0, 6.28), d = rand(11, 26); const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (isMeadowExpansionFootprint(x, z)) continue;
    if (blockers.some((b) => x > b.x0 - 1.5 && x < b.x1 + 1.5 && z > b.z0 - 1.5 && z < b.z1 + 1.5)) continue;
    if (ENTER.some((eb) => (eb.door && Math.hypot(eb.door.x - x, eb.door.z - z) < 2.2) || (eb.doorIn && Math.hypot(eb.doorIn.x - x, eb.doorIn.z - z) < 2.2))) continue;
    const isRock = (k % 2) === 1;
    placeKit(isRock ? N.rock() : N.bush(), x, z, rand(0, 6), -0.06, isRock);
  }
  // trees around the outskirts: broadleaf + pines (trunk-only colliders so leaf canopies never form invisible walls!)
  const houseBoxes = STRUCT.cottages.map((g) => new THREE.Box3().setFromObject(g));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + rand(-0.1, 0.1), d = rand(26, 32);
    const x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (isMeadowExpansionFootprint(x, z)) continue;
    if (houseBoxes.some((bb) => x > bb.min.x - 1.5 && x < bb.max.x + 1.5 && z > bb.min.z - 1.5 && z < bb.max.z + 1.5)) continue;   // keep trees out of the (bigger, enterable) houses
    if (Math.hypot(x - 22, z + 14) < 8 || Math.hypot(x + 23.5, z + 10.5) < 6 || (STREAM && Math.hypot(x - STREAM.x, z - STREAM.z) < STREAM.r) || Math.hypot(x + 10, z - 22.5) < 3.5) continue;
    const t = i % 3 === 0 ? N.pine() : N.tree();
    const sc = rand(0.85, 1.2);
    t.scale.setScalar(sc);
    placeKit(t, x, z, rand(0, 6), 0, false);
    const tr = 0.36 * sc;
    blockers.push({ x0: x - tr, x1: x + tr, z0: z - tr, z1: z + tr, y0: -0.2, y1: 3.8, noJump: true });
  }
}

// distant mountains + clouds (atmosphere for Meadowbrook Village)
const backdrop = [];
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2 + rand(-0.2, 0.2);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rand(18, 30), rand(22, 40), 6), new THREE.MeshLambertMaterial({ color: 0x8fa7b8 }));
  m.position.set(Math.sin(a) * 120, 8, Math.cos(a) * 120); meadowSkyGroup.add(m); backdrop.push(m);
}
let sunGlowSprite = null;
{
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.18, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }));
  sp.position.copy(sun.position).normalize().multiplyScalar(200); sp.scale.set(70, 70, 1); scene.add(sp);
  sunGlowSprite = sp;
}
const clouds = [];
{
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = rand(26, 102), y = rand(48, 82) - (i > 8 ? 14 : 0), r = rand(16, 30); const gr = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(244,246,255,0.9)'); gr.addColorStop(1, 'rgba(210,222,240,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }));
    s.position.set(rand(-140, 140), rand(40, 70), rand(-140, 140)); s.scale.set(rand(40, 70), rand(20, 30), 1);
    meadowSkyGroup.add(s); clouds.push(s);
  }
}

// ============================================================ painted assets (generated with Codex) — hot-swapped in when present
{
  const loader = new THREE.ImageLoader();
  // neutralise a painted texture to light luminance (keeps the brushwork) so materials can tint it.
  // Downsampled to power-of-two 512x512 & staggered 1 per animation frame so the Home Screen never stutters!
  const neutral = (img, keepHue) => {
    const sz = 512;
    const cv = document.createElement('canvas'); cv.width = sz; cv.height = sz;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, sz, sz);
    const d = g.getImageData(0, 0, sz, sz), a = d.data;
    let sum = 0; for (let i = 0; i < a.length; i += 4) sum += 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
    const mean = sum / (a.length / 4) || 1, k = 225 / mean;
    for (let i = 0; i < a.length; i += 4) {
      const l = (0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]) * k;
      for (let c = 0; c < 3; c++) a[i + c] = clamp(l * (1 - keepHue) + a[i + c] * k * keepHue, 0, 255);
    }
    g.putImageData(d, 0, 0);
    return cv;
  };
  const swapQueue = [];
  let swapPumpActive = false;
  const pumpSwapQueue = () => {
    if (!swapQueue.length) { swapPumpActive = false; return; }
    const job = swapQueue.shift();
    job();
    requestAnimationFrame(pumpSwapQueue);
  };
  const enqueueSwap = (fn) => {
    swapQueue.push(fn);
    if (!swapPumpActive) {
      swapPumpActive = true;
      requestAnimationFrame(pumpSwapQueue);
    }
  };
  const files = { plaster: 'plaster_wall.webp', tiles: 'roof_tiles.webp', wood: 'wood_planks.webp', cobble: 'cobblestone.webp', meadow: 'meadow.webp', straw: 'straw.webp' };
  for (const [key, file] of Object.entries(files)) {
    loader.load(`assets/${file}?v=3`, (img) => {
      enqueueSwap(() => {
        const cv = neutral(img, key === 'meadow' ? 0.15 : 0.25);
        const base = TEX[key];
        base.image = cv;
        base.needsUpdate = true;
        for (const t of TEXUSE[key]) {
          if (t.source !== base.source) {
            t.image = cv;
            t.needsUpdate = true;
          }
        }
        console.log('[assets] painted texture', key);
      });
    }, undefined, () => {});
  }
  loader.load('assets/sky_panorama.webp?v=3', (img) => {
    enqueueSwap(() => {
      const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(4, 1); t.anisotropy = MAX_ANISO; t.needsUpdate = true;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(190, 190, 150, 64, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
      cyl.position.y = 52; cyl.renderOrder = -1; meadowSkyGroup.add(cyl);
      backdrop.forEach((m) => { m.visible = false; });
      clouds.forEach((c) => { c.visible = false; });
      console.log('[assets] painted sky panorama');
    });
  }, undefined, () => {});
}

const SEEKER_CHAMPION_ORDER = ['ranger', 'botanist', 'aviator', 'lantern', 'detective'];
const SEEKER_KIND_TO_CHAMPION = {
  raincoat: 'ranger', ranger: 'ranger',
  farmer: 'botanist', botanist: 'botanist', gardener: 'botanist', tiny: 'botanist', tinyfolk: 'botanist',
  firefighter: 'aviator', aviator: 'aviator', pilot: 'aviator', seaplane: 'aviator', sky: 'aviator', skyruins: 'aviator',
  grandma: 'lantern', lantern: 'lantern', watchman: 'lantern', bath: 'lantern', bathhouse: 'lantern',
  detective: 'detective', clockwork: 'detective', clock: 'detective',
};
const SPIRIT_CHAMPION_ORDER = ['meadow', 'bathhouse', 'skyruins', 'seaplane', 'clockwork', 'tinyfolk'];

function buildBlenderChampionCharacter(isSeeker, opt = {}) {
  let key = null;
  let skinId = 'meadow';
  let seekerId = 'ranger';
  if (isSeeker) {
    const rawK = String(opt.kind || '').toLowerCase();
    seekerId = SEEKER_KIND_TO_CHAMPION[rawK]
      || SEEKER_CHAMPION_ORDER[(opt.slotIdx || 0) % SEEKER_CHAMPION_ORDER.length];
    key = `char_seeker_${seekerId}`;
  } else {
    const spMap = opt.spiritMap || (selectedSpirit === 'auto' ? activeMapId : selectedSpirit);
    skinId = SPIRIT_CHAMPION_ORDER.includes(spMap) ? spMap : 'meadow';
    key = `char_spirit_${skinId}`;
  }
  const src = HERO_GLB_CACHE[key];
  if (!src) return null;

  const root = new THREE.Group();
  root.name = isSeeker ? `seeker_${seekerId}` : `hider_${skinId}`;
  const model = src.clone(true);
  root.add(model);

  // Locate articulated joints, paintable material, eye groups & blaster nozzle
  const findNode = (n) => model.getObjectByName(n) || null;
  const torso = findNode('Torso');
  const head = findNode('Head');
  const armL = findNode('ArmL');
  const armR = findNode('ArmR');
  const legL = findNode(isSeeker ? 'LegL' : 'FootL');
  const legR = findNode(isSeeker ? 'LegR' : 'FootR');
  const crest = findNode('Crest');
  const blaster = findNode('Blaster');
  const nozzle = findNode('Nozzle');
  const eyeOpenNode = findNode('EyeOpen');
  const eyeClosedNode = findNode('EyeClosed');

  const parts = [];
  const open = [];
  const closed = [];
  let paint = null;
  let body = torso || model;

  const paintMatName = isSeeker ? 'PaintCoat' : 'PaintBody';
  const cloneMap = new Map();
  model.traverse((m) => {
    if (!m.isMesh) return;
    const inEyeOpen = eyeOpenNode && (m === eyeOpenNode || m.parent === eyeOpenNode);
    const inEyeClosed = eyeClosedNode && (m === eyeClosedNode || m.parent === eyeClosedNode);
    if (inEyeOpen) {
      m.castShadow = false;
      m.receiveShadow = false;
      open.push(m);
      parts.push(m);
    } else if (inEyeClosed) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.visible = false;
      closed.push(m);
    } else {
      m.castShadow = true;
      m.receiveShadow = !(head && (m === head || m.parent === head));
      parts.push(m);
    }
    // Clone the primary PaintBody/PaintCoat material per-character so tinting/camo is isolated!
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      let changed = false;
      const next = mats.map((mt) => {
        if (mt && mt.name === paintMatName) {
          changed = true;
          if (!cloneMap.has(mt)) {
            const cm = mt.clone();
            if (painterlyGfx) painterlyGfx.upgradeMaterialToPainterly(cm, { rimMul: 1.25, cloudMul: 0.35, macroMul: 0.0 });
            cloneMap.set(mt, cm);
            if (!paint) paint = cm;
          }
          return cloneMap.get(mt);
        }
        return mt;
      });
      if (changed) m.material = Array.isArray(m.material) ? next : next[0];
    }
  });
  if (!paint) paint = new THREE.MeshStandardMaterial({ color: isSeeker ? 0xf5c436 : 0xfff2d8, roughness: 0.78 });
  const skinColorHex = paint.color ? paint.color.getHex() : (isSeeker ? 0xf5c436 : 0xfff2d8);

  // Record base joint transforms for crisp procedural animation
  const basePos = new Map();
  for (const n of [torso, head, armL, armR, legL, legR, crest, blaster]) {
    if (n) basePos.set(n, n.position.clone());
  }

  let ph = 0, walkK = 0, runK = 0, aimK = 0, t = Math.random() * 6.0, lastBob = 0;
  let blinkT = 2.0 + Math.random() * 2.5;
  const animate = (dt, moving, speed = 0) => {
    const u = root.userData;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    t += dt;
    walkK += ((moving ? 1 : 0) - walkK) * Math.min(1, dt * 9);
    runK += (((moving && speed > 3.5) ? 1 : 0) - runK) * Math.min(1, dt * 6);
    aimK += ((u.aim ? 1 : 0) - aimK) * Math.min(1, dt * 11);

    const db = (u.bob || 0) - lastBob;
    lastBob = u.bob || 0;
    if (moving) ph += (db > 0 && db < 1.5) ? db : dt * (isSeeker ? (3.4 + Math.min(speed, 8) * 1.65) : (7.0 + Math.min(speed, 8) * 1.1));

    const s = Math.sin(ph), c = Math.cos(ph), k = walkK, idle = 1 - k;
    const breathe = Math.sin(t * 2.2);

    if (isSeeker) {
      const amp = (0.48 + 0.24 * runK) * k;
      if (legL) {
        const bp = basePos.get(legL);
        legL.rotation.set(s * amp, 0, 0.03 * idle);
        legL.position.y = bp.y + Math.max(0, -c) * (0.035 + 0.03 * runK) * k;
      }
      if (legR) {
        const bp = basePos.get(legR);
        legR.rotation.set(-s * amp, 0, -0.03 * idle);
        legR.position.y = bp.y + Math.max(0, c) * (0.035 + 0.03 * runK) * k;
      }
      if (torso) {
        const bp = basePos.get(torso);
        torso.position.y = bp.y + (Math.abs(c) - 0.55) * (0.042 + 0.025 * runK) * k + breathe * 0.006 * idle;
        torso.rotation.set((0.06 + 0.09 * runK) * k + 0.03 * aimK, -0.14 * aimK + s * 0.07 * k, s * 0.035 * k);
      }
      if (head) {
        head.rotation.set(
          -0.05 * k + Math.sin(t * 1.4) * 0.025 * idle,
          0.12 * aimK + Math.sin(t * 0.75) * 0.06 * idle * (1 - aimK),
          Math.sin(t * 0.95) * 0.025 * idle - s * 0.03 * k
        );
      }
      if (armL) {
        armL.rotation.set(-s * 0.52 * k + Math.sin(t * 2.0) * 0.04 * idle, 0, 0.06 * idle);
      }
      if (armR) {
        armR.rotation.set(-0.28 * aimK + s * 0.18 * k * (1 - 0.7 * aimK), 0, -0.04 * idle);
      }
      if (blaster) {
        const bp = basePos.get(blaster);
        blaster.position.y = bp.y + 0.09 * aimK + Math.abs(c) * 0.018 * k * (1 - 0.6 * aimK);
        blaster.rotation.set(-0.08 * aimK + c * 0.04 * k * (1 - 0.7 * aimK), s * 0.035 * k * (1 - 0.7 * aimK), 0);
      }
    } else {
      // Joyful bouncy Storybook Spirit animation!
      if (legL) {
        const bp = basePos.get(legL);
        legL.position.z = bp.z + s * 0.075 * k;
        legL.position.y = bp.y + Math.max(0, c) * 0.055 * k;
        legL.rotation.x = -c * 0.35 * k;
      }
      if (legR) {
        const bp = basePos.get(legR);
        legR.position.z = bp.z - s * 0.075 * k;
        legR.position.y = bp.y + Math.max(0, -c) * 0.055 * k;
        legR.rotation.x = c * 0.35 * k;
      }
      if (torso) {
        const bp = basePos.get(torso);
        torso.position.y = bp.y + Math.abs(s) * 0.042 * k + breathe * 0.006 * idle;
        torso.rotation.set(0.08 * k * Math.min(1, speed / 5), s * 0.065 * k, -s * 0.085 * k + Math.sin(t * 1.1) * 0.015 * idle);
        torso.scale.set(1 - breathe * 0.010 * idle, 1 + breathe * 0.018 * idle, 1 - breathe * 0.010 * idle);
      }
      if (armL) {
        armL.rotation.set(s * 0.58 * k + Math.sin(t * 2.2) * 0.05 * idle, 0, -(Math.abs(s) * 0.16 * k + (breathe + 1) * 0.03 * idle));
      }
      if (armR) {
        armR.rotation.set(-s * 0.58 * k + Math.sin(t * 2.2 + 1.2) * 0.05 * idle, 0, (Math.abs(s) * 0.16 * k + (breathe + 1) * 0.03 * idle));
      }
      if (head) {
        head.rotation.set(Math.sin(t * 1.4) * 0.025 * idle, Math.sin(t * 0.85) * 0.055 * idle, s * 0.04 * k);
      }
      if (crest) {
        const bp = basePos.get(crest);
        crest.rotation.z = Math.sin(t * 1.7) * 0.075 * idle + s * 0.10 * k;
        crest.rotation.x = -0.14 * k * Math.min(1, speed / 5) + Math.sin(t * 1.3 + 1) * 0.04 * idle;
        if (skinId === 'skyruins') {
          crest.position.y = bp.y + Math.sin(t * 2.6) * 0.024;
        }
      }
    }

    // Natural expressive blinking (only when game hasn't forced eyes closed e.g. blindfold)
    blinkT -= dt;
    if (blinkT < -0.13) blinkT = 2.4 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 2.8;
    if (eyeOpenNode) eyeOpenNode.scale.y = blinkT < 0 ? 0.12 : 1.0;
  };

  root.userData = {
    paint, body, open, closed, parts, nozzle,
    squash: 0, bob: 0, jy: 0, vy: 0, aim: false,
    animate,
    kind: isSeeker ? seekerId : undefined,
    skin: isSeeker ? undefined : skinId,
    skinColor: skinColorHex,
    isBlenderChampion: true,
    championKey: key,
  };
  animate(0, false, 0);
  return root;
}

// ============================================================ characters ("painters")
function makePainter(isSeeker, opt = {}) {
  // v8.2.0: Champion-Tier Hand-Painted Blender 5.3 Sculpted Storybook Characters (6 Spirits + 5 Seekers)
  try {
    const champ = buildBlenderChampionCharacter(isSeeker, opt);
    if (champ) {
      attachContactShadow(champ);
      scene.add(champ);
      return champ;
    }
  } catch (e) { console.warn('[champion-char] fallback', e); }
  // Fallback to procedural Storybook-style characters
  const C = VILLAGE.chars;
  try {
    let g = null;
    if (isSeeker) {
      if (ACTIVE_MAP && ACTIVE_MAP.buildSeeker) {
        const k = opt.kind || pick(ACTIVE_MAP.seekerKinds || []);
        g = ACTIVE_MAP.buildSeeker(THREE, k);
      } else if (C.buildSeeker) {
        g = C.buildSeeker(THREE, { kind: opt.kind });
      }
    } else {
      const spMap = opt.spiritMap || (selectedSpirit === 'auto' ? activeMapId : selectedSpirit);
      const mapDef = spMap && spMap !== 'meadow' ? MAP_REGISTRY[spMap] : null;
      if (mapDef && mapDef.buildHider) {
        g = mapDef.buildHider(THREE);
      } else if (C.buildHider) {
        g = C.buildHider(THREE, { skin: opt.skin || 'classic' });
      }
    }
    if (g) {
      const u = g.userData; Object.assign(u, { squash: u.squash || 0, bob: 0, jy: 0, vy: 0 });
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      attachContactShadow(g);
      scene.add(g); return g;
    }
  } catch (e) { console.warn('[characters] fallback', e); }
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isSeeker ? 0x5b8fc9 : 0xffffff });
  const skin = isSeeker ? new THREE.MeshLambertMaterial({ color: 0xffe0c2 }) : paint;
  const hatMat = isSeeker ? new THREE.MeshLambertMaterial({ color: 0x2f5f8a }) : paint;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const body = add(new THREE.CapsuleGeometry(0.33, 0.3, 6, 16), paint, 0, 0.55, 0);
  add(new THREE.SphereGeometry(0.37, 20, 16), skin, 0, 1.08, 0);
  for (const sx of [-1, 1]) {
    const arm = add(new THREE.CapsuleGeometry(0.085, 0.24, 4, 8), paint, sx * 0.39, 0.6, 0.03); arm.rotation.z = sx * 0.4;
    add(new THREE.SphereGeometry(0.13, 12, 8), paint, sx * 0.15, 0.09, 0.06).scale.set(1, 0.55, 1.35);
  }
  const hat = add(new THREE.CylinderGeometry(0.31, 0.37, 0.12, 20), hatMat, 0.05, 1.43, 0); hat.rotation.z = -0.25;
  add(new THREE.SphereGeometry(0.05, 8, 6), hatMat, 0.09, 1.51, 0);
  const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff }), eyeB = new THREE.MeshBasicMaterial({ color: 0x2a2a33 });
  const open = [], closed = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), eyeW); e.position.set(sx * 0.13, 1.1, 0.31); e.scale.z = 0.6; g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeB); p.position.set(sx * 0.13, 1.1, 0.36); g.add(p);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), eyeW); hl.position.set(sx * 0.13 + 0.015, 1.12, 0.395); g.add(hl);
    open.push(e, p, hl);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.02), eyeB); c.position.set(sx * 0.13, 1.09, 0.355); c.visible = false; g.add(c); closed.push(c);
  }
  if (isSeeker) {
    const blush = new THREE.MeshBasicMaterial({ color: 0xffb3a7 });
    for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), blush); b.position.set(sx * 0.22, 1.0, 0.3); b.scale.z = 0.3; g.add(b); }
    add(new THREE.SphereGeometry(0.24, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffa94d }), 0, 0.72, -0.34);
    const barrel = add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), new THREE.MeshLambertMaterial({ color: 0x3fb8a8 }), 0.42, 0.66, 0.32); barrel.rotation.x = Math.PI / 2;
  }
  g.userData = { paint, body, open, closed, squash: 0, bob: 0, jy: 0, vy: 0, parts: [...g.children] };
  attachContactShadow(g);
  scene.add(g);
  return g;
}

// ============================================================ AAA Visual, Animation & Camera Feel Helpers
let _contactShadowGeo = null;
let _contactShadowTex = null;
function attachContactShadow(ch) {
  if (!ch || ch.userData?._contactShadow) return;
  try {
    if (!_contactShadowTex && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
      g.addColorStop(0, 'rgba(18, 28, 16, 0.42)');
      g.addColorStop(0.55, 'rgba(18, 28, 16, 0.18)');
      g.addColorStop(1, 'rgba(18, 28, 16, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      _contactShadowTex = new THREE.CanvasTexture(c);
    }
    if (!_contactShadowGeo) {
      _contactShadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
      _contactShadowGeo.rotateX(-Math.PI / 2);
    }
    if (!_contactShadowTex) return;
    const mat = new THREE.MeshBasicMaterial({
      map: _contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const m = new THREE.Mesh(_contactShadowGeo, mat);
    m.userData._isContactShadow = true;
    if (painterlyGfx) painterlyGfx.upgradeSceneGroup(ch, { rimMul: 1.45, cloudMul: 0.45, macroMul: 0.0 });
    m.position.y = 0.035;
    m.renderOrder = 1;
    ch.add(m);
    ch.userData._contactShadow = m;
  } catch (_) { /* ignore in headless */ }
}

// Per-world single-draw-call sunlit atmospheric pollen / ember / starlight motes
const MOTE_COUNT = isTouch ? 64 : 96;
const MOTE_COLORS = {
  meadow: 0xfff3b8,
  bathhouse: 0xffc87a,
  seaplane: 0xdaf6ff,
  skyruins: 0xd8ebff,
  clockwork: 0xffd584,
  tinyfolk: 0xe6ffb8,
  tutorial: 0xfff5c0,
};
let ambientMotes = null;
let _moteSeeds = null;
function initAmbientMotes() {
  if (ambientMotes) return;
  try {
    const pos = new Float32Array(MOTE_COUNT * 3);
    _moteSeeds = new Float32Array(MOTE_COUNT * 4);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const ox = (Math.random() - 0.5) * 30;
      const oy = 0.7 + Math.random() * 6.5;
      const oz = (Math.random() - 0.5) * 30;
      pos[i * 3] = ox; pos[i * 3 + 1] = oy; pos[i * 3 + 2] = oz;
      _moteSeeds[i * 4] = ox;
      _moteSeeds[i * 4 + 1] = oy;
      _moteSeeds[i * 4 + 2] = oz;
      _moteSeeds[i * 4 + 3] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    let moteTex = null;
    if (typeof document !== 'undefined') {
      const mc = document.createElement('canvas');
      mc.width = mc.height = 32;
      const mctx = mc.getContext('2d');
      const mg = mctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      mg.addColorStop(0, 'rgba(255,255,255,1)');
      mg.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      mg.addColorStop(1, 'rgba(255,255,255,0)');
      mctx.fillStyle = mg;
      mctx.fillRect(0, 0, 32, 32);
      moteTex = new THREE.CanvasTexture(mc);
    }
    const mat = new THREE.PointsMaterial({
      color: MOTE_COLORS.meadow,
      map: moteTex,
      size: isTouch ? 0.10 : 0.075,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    ambientMotes = new THREE.Points(geo, mat);
    ambientMotes.frustumCulled = false;
    scene.add(ambientMotes);
  } catch (_) { /* ignore */ }
}
function updateAmbientMotes(dt, nowSec) {
  if (!ambientMotes || !_moteSeeds) return;
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const wantCol = MOTE_COLORS[activeMapId] || MOTE_COLORS.meadow;
  if (ambientMotes.material && ambientMotes.material.color.getHex() !== wantCol) {
    ambientMotes.material.color.setHex(wantCol);
  }
  const attr = ambientMotes.geometry.attributes.position;
  const arr = attr.array;
  for (let i = 0; i < MOTE_COUNT; i++) {
    const k = i * 4;
    const ph = _moteSeeds[k + 3];
    let rx = _moteSeeds[k] + Math.sin(nowSec * 0.45 + ph) * 1.4;
    let ry = _moteSeeds[k + 1] + Math.sin(nowSec * 0.72 + ph * 1.7) * 0.55;
    let rz = _moteSeeds[k + 2] + Math.cos(nowSec * 0.41 + ph * 1.3) * 1.4;
    // Wrap gently around the camera volume so motes always frame the active view
    rx = cx + ((((rx - cx + 15) % 30) + 30) % 30) - 15;
    rz = cz + ((((rz - cz + 15) % 30) + 30) % 30) - 15;
    ry = Math.max(0.45, Math.min(cy + 6.5, (cy - 1.5) + ((((ry - (cy - 1.5)) % 7.5) + 7.5) % 7.5)));
    arr[i * 3] = rx;
    arr[i * 3 + 1] = ry;
    arr[i * 3 + 2] = rz;
  }
  attr.needsUpdate = true;
}

// Lightweight footstep / landing dust puffs
const dustPuffs = [];
let _dustGeo = null;
function spawnDustPuff(pos, count = 4, hex = 0xf3ead4) {
  if (!pos || dustPuffs.length > 36) return;
  if (!_dustGeo) _dustGeo = new THREE.SphereGeometry(0.11, 6, 5);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.62, depthWrite: false });
    const m = new THREE.Mesh(_dustGeo, mat);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.8;
    const sp = 0.9 + Math.random() * 1.3;
    m.position.set(pos.x + Math.cos(a) * 0.16, (pos.y || 0) + 0.08, pos.z + Math.sin(a) * 0.16);
    scene.add(m);
    dustPuffs.push({ m, vx: Math.cos(a) * sp, vy: 0.85 + Math.random() * 0.9, vz: Math.sin(a) * sp, t: 0, dur: 0.34 + Math.random() * 0.14 });
  }
}
function updateDustPuffs(dt) {
  for (let i = dustPuffs.length - 1; i >= 0; i--) {
    const d = dustPuffs[i];
    d.t += dt;
    const p = d.t / d.dur;
    if (p >= 1) {
      scene.remove(d.m);
      d.m.material.dispose();
      dustPuffs.splice(i, 1);
      continue;
    }
    d.m.position.x += d.vx * dt;
    d.m.position.y += d.vy * dt;
    d.m.position.z += d.vz * dt;
    d.vx *= 0.92; d.vz *= 0.92; d.vy *= 0.92;
    const sc = 0.7 + p * 1.55;
    d.m.scale.setScalar(sc);
    d.m.material.opacity = 0.62 * (1 - p) * (1 - p);
  }
}

// Slapstick spinning prop-launch physics when a disguised Hider gets soaked!
const elimPropLaunches = [];
function spawnElimPropLaunch(ch, propId) {
  if (!ch || !propId || !KIT?.props?.[propId]) return;
  try {
    const clone = buildProp(propId);
    if (!clone) return;
    const pos = centerOf(ch);
    clone.position.set(pos.x, Math.max(0.25, pos.y - 0.15), pos.z);
    clone.rotation.copy(ch.rotation);
    scene.add(clone);
    const ang = Math.random() * Math.PI * 2;
    elimPropLaunches.push({
      m: clone,
      vx: Math.cos(ang) * (3.2 + Math.random() * 1.8),
      vy: 6.4 + Math.random() * 1.8,
      vz: Math.sin(ang) * (3.2 + Math.random() * 1.8),
      rx: (Math.random() > 0.5 ? 1 : -1) * (6.5 + Math.random() * 4),
      ry: (Math.random() > 0.5 ? 1 : -1) * (7.5 + Math.random() * 5),
      rz: (Math.random() > 0.5 ? 1 : -1) * (5.5 + Math.random() * 4),
      t: 0,
      dur: 0.92,
      nextSplash: 0.12,
    });
  } catch (_) { /* ignore */ }
}
function updateElimPropLaunches(dt) {
  for (let i = elimPropLaunches.length - 1; i >= 0; i--) {
    const e = elimPropLaunches[i];
    e.t += dt;
    if (e.t >= e.dur) {
      splash(e.m.position, 20, 2.4);
      scene.remove(e.m);
      elimPropLaunches.splice(i, 1);
      continue;
    }
    e.vy -= 17.5 * dt;
    e.m.position.x += e.vx * dt;
    e.m.position.y = Math.max(0.15, e.m.position.y + e.vy * dt);
    e.m.position.z += e.vz * dt;
    e.m.rotation.x += e.rx * dt;
    e.m.rotation.y += e.ry * dt;
    e.m.rotation.z += e.rz * dt;
    const fade = e.t > e.dur * 0.65 ? clamp(1 - (e.t - e.dur * 0.65) / (e.dur * 0.35), 0.15, 1) : 1;
    e.m.scale.setScalar(fade);
    if (e.t >= e.nextSplash) {
      e.nextSplash += 0.18;
      spawnDustPuff(e.m.position, 2, 0x9ce8ff);
    }
  }
}

// 3D Floating Speech-Bubble Emotes visible above character heads
const emoteBubbles3D = [];
function spawn3DEmoteBubble(ch, emoji) {
  if (!ch || !emoji || typeof document === 'undefined') return;
  try {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(255, 253, 245, 0.96)';
    ctx.strokeStyle = '#f2a830';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 58, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(52, 98); ctx.lineTo(64, 120); ctx.lineTo(76, 98);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = emoji === 'GG' ? '900 44px Nunito, sans-serif' : '56px sans-serif';
    ctx.fillStyle = '#313d2b';
    ctx.fillText(emoji, 64, 60);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.renderOrder = 25;
    sp.scale.set(0.01, 0.01, 1);
    scene.add(sp);
    emoteBubbles3D.push({ sp, tex, mat, ch, t: 0, dur: 2.35 });
  } catch (_) { /* ignore */ }
}
function update3DEmoteBubbles(dt) {
  for (let i = emoteBubbles3D.length - 1; i >= 0; i--) {
    const b = emoteBubbles3D[i];
    b.t += dt;
    if (b.t >= b.dur || !b.ch || !b.ch.parent) {
      scene.remove(b.sp);
      b.tex.dispose();
      b.mat.dispose();
      emoteBubbles3D.splice(i, 1);
      continue;
    }
    const u = b.ch.userData || {};
    const topH = (u.propId || u.specialMode) ? (u.height || 0.9) + 1.15 : 2.35;
    b.sp.position.set(b.ch.position.x, (u.groundY || 0) + (u.jy || 0) + topH + Math.sin(b.t * 4.5) * 0.12, b.ch.position.z);
    const pop = b.t < 0.2 ? (1 + Math.sin((b.t / 0.2) * Math.PI) * 0.28) * (b.t / 0.2) : 1;
    const out = b.t > b.dur - 0.35 ? clamp((b.dur - b.t) / 0.35, 0, 1) : 1;
    const sc = 0.95 * Math.max(0.01, pop * out);
    b.sp.scale.set(sc, sc, 1);
    b.mat.opacity = out;
  }
}

// Trauma-based damped directional camera shake & Killstreak Banner
function addCamTrauma(amt = 0.25) {
  G._camTrauma = Math.min(1, (G._camTrauma || 0) + Math.max(0, amt));
}
let _killBannerTO = 0;
function showKillStreakBanner(streak) {
  const el = $('killBanner');
  if (!el || streak < 2) return;
  const labels = {
    2: '💦 DOUBLE SOAK!',
    3: '🔥 TRIPLE SOAK!',
    4: '⚡ MEGA SOAK!',
    5: '👑 TEAM ACE!',
  };
  el.textContent = labels[Math.min(5, streak)] || `🔥 ${streak}× STREAK!`;
  el.classList.remove('hidden');
  void el.offsetWidth;
  el.classList.add('on');
  clearTimeout(_killBannerTO);
  _killBannerTO = setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => el.classList.add('hidden'), 220);
  }, 2100);
}

// Diegetic World Toy Beacons (pooled 6 DOM pins projecting map interactives in 3D!)
const _beaconPool = [];
let _lastBeaconAt = 0;
const _beaconProjV = new THREE.Vector3();
function clearWorldBeacons() {
  for (const el of _beaconPool) el.style.display = 'none';
}
function updateWorldBeacons(now) {
  if (now - _lastBeaconAt < 50) return;
  _lastBeaconAt = now;
  const layer = $('worldBeaconsLayer');
  if (!layer) return;
  const show = !G.over && !G.spectating && (G.phase === 'hide' || G.phase === 'survive' || G.phase === 'seek') && G.player && ACTIVE_MAP;
  if (!show) { clearWorldBeacons(); return; }
  while (_beaconPool.length < 6) {
    const el = document.createElement('div');
    el.className = 'wb-pin';
    el.style.display = 'none';
    layer.appendChild(el);
    _beaconPool.push(el);
  }
  const spots = [];
  try {
    if (typeof ACTIVE_MAP.getInteractSpots === 'function') {
      const list = ACTIVE_MAP.getInteractSpots() || [];
      for (const sp of list) if (sp) spots.push(sp);
    }
    const tur = typeof ACTIVE_MAP.getTurret === 'function' ? ACTIVE_MAP.getTurret() : null;
    if (tur && !spots.some((s) => s.kind === 'turret')) {
      spots.push({ kind: 'turret', icon: '🎯', label: 'Sky-Turret', x: tur.x, y: (tur.y || 0) + 1.2, z: tur.z });
    }
    if (genreKing && G.mode === 'hide') {
      for (const cg of (genreKing.getActiveBubbleCages() || [])) {
        if (cg && cg.ch && cg.ch !== G.player) {
          spots.push({ kind: 'rescue_bubble', icon: '🫧', label: `RESCUE ${Math.ceil(cg.timeLeft)}s`, x: cg.ch.position.x, y: (cg.baseY || 0) + 1.2, z: cg.ch.position.z });
        }
      }
    }
  } catch (_) { /* ignore */ }

  const p = G.player.position;
  const isSeek = G.mode === 'seek';
  const scored = [];
  for (const sp of spots) {
    if (sp.occupiedBy && sp.occupiedBy !== G.player) continue;
    const kind = sp.kind || '';
    // Role-filter so players only see toys they can actually use!
    if (isSeek && (kind === 'tub' || kind === 'hook' || kind === 'custom_spot')) continue;
    if (!isSeek && kind === 'turret') continue;
    const sx = sp.triggerX ?? sp.fromX ?? sp.x;
    const sz = sp.triggerZ ?? sp.fromZ ?? sp.z;
    if (typeof sx !== 'number' || typeof sz !== 'number') continue;
    const sy = (sp.triggerY ?? sp.fromY ?? sp.y ?? sp.groundY ?? 0) + 1.35;
    const d = Math.hypot(sx - p.x, sz - p.z);
    const maxBeaconD = isTouch ? 16 : 28;
    if (d < 2.6 || d > maxBeaconD) continue;
    scored.push({ sp, sx, sy, sz, d });
  }
  scored.sort((a, b) => a.d - b.d);

  const W = window.innerWidth, H = window.innerHeight;
  let used = 0;
  const maxPins = isTouch ? 2 : 4;
  const placed = [];
  for (let i = 0; i < scored.length && used < maxPins; i++) {
    const { sp, sx, sy, sz, d } = scored[i];
    _beaconProjV.set(sx, sy, sz).project(camera);
    if (_beaconProjV.z < -1 || _beaconProjV.z > 1) continue;
    const x = (_beaconProjV.x * 0.5 + 0.5) * W;
    const y = (-_beaconProjV.y * 0.5 + 0.5) * H;
    if (x < 48 || x > W - 48 || y < 74 || y > H - 92) continue;
    if (placed.some((pt) => Math.abs(pt.x - x) < 96 && Math.abs(pt.y - y) < 34)) continue;
    placed.push({ x, y });
    const el = _beaconPool[used++];
    const ic = sp.icon || (sp.kind === 'turret' ? '🎯' : sp.kind === 'lift' ? '🛗' : sp.kind === 'ride_path' ? '🚀' : sp.kind === 'rail_chain' ? '🪂' : sp.kind === 'mechanism' ? '⚙️' : '✨');
    const rawLbl = String(sp.baseLabel || sp.label || sp.name || sp.kind || 'Toy').replace(/^(Ride|Call|Use|Hop Into|Climb Into|Enter|Trigger)\s+/i, '');
    const shortLbl = rawLbl.length > 14 ? `${rawLbl.slice(0, 13)}…` : rawLbl;
    el.innerHTML = `<span class="wb-ic">${ic}</span><span>${shortLbl}</span><span class="wb-dist">${Math.round(d)}m</span>`;
    el.style.display = 'inline-flex';
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
    el.style.opacity = String(clamp(1.12 - d / 30, 0.35, 0.94).toFixed(2));
    el.classList.toggle('wb-close', d < 8.5);
  }
  for (let i = used; i < _beaconPool.length; i++) _beaconPool[i].style.display = 'none';
}
initAmbientMotes();
function setEyes(ch, isOpen) { ch.userData.open.forEach((m) => { m.visible = isOpen; }); ch.userData.closed.forEach((m) => { m.visible = !isOpen; }); }
function centerOf(ch) {
  const u = ch.userData;
  const y = u.specialMode === 'tub' ? 0.24 : (u.propId ? u.height * 0.5 : (u.squash > 0.5 ? 0.42 : 0.78));
  return new THREE.Vector3(ch.position.x, (u.groundY || 0) + (u.specialY || 0) + y + (u.jy || 0), ch.position.z);
}

// ============================================================ colour helpers (camouflage maths)
const ray = new THREE.Raycaster();
function srgb(c) { const o = { r: 0, g: 0, b: 0 }; c.getRGB(o, THREE.SRGBColorSpace); return o; }
function cssOf(c) { const o = srgb(c); return `rgb(${(o.r * 255) | 0},${(o.g * 255) | 0},${(o.b * 255) | 0})`; }
function matchOf(a, b) { const x = srgb(a), y = srgb(b); const d = Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b); return clamp(1 - d * 2.4, 0, 1); }
function colorOfHit(h) {
  if (!h) return SKYCOL;
  if (h.object.userData.ground) return groundColorAt(h.point.x, h.point.z);
  const ca = h.object.geometry && h.object.geometry.attributes && h.object.geometry.attributes.color;
  if (h.face && ca && ca.count > h.face.a) {
    return new THREE.Color(ca.getX(h.face.a), ca.getY(h.face.a), ca.getZ(h.face.a));
  }
  return h.object.userData.paint || h.object.material?.color || SKYCOL;
}
// colour of whatever is directly BEHIND `target` as seen from `from`
function behindColor(from, target) {
  const dir = target.clone().sub(from).normalize();
  ray.set(target.clone().addScaledVector(dir, 0.55), dir);
  ray.far = 60; ray.firstHitOnly = true;
  const hit = ray.intersectObjects(solids, false)[0];
  ray.firstHitOnly = false;
  return colorOfHit(hit);
}
// average blend from 8 directions around the hider (what a seeker might see from anywhere)
function allAngleBlend(ch) {
  const c = centerOf(ch); let sum = 0, minM = 1, minBack = null;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const eye = new THREE.Vector3(c.x + Math.sin(a) * 9, 1.0, c.z + Math.cos(a) * 9);
    const back = behindColor(eye, c);
    const m = matchOf(ch.userData.paint.color, back);
    sum += m; if (m < minM) { minM = m; minBack = back; }
  }
  return { avg: sum / 8, worst: minBack };
}
const _losFrom = new THREE.Vector3();
const _losDir = new THREE.Vector3();
function lineOfSight(from, to) {
  if (hiderTricks && hiderTricks.breaksLineOfSight(from, to)) return false;
  if (ACTIVE_MAP && ACTIVE_MAP.breaksLineOfSight && ACTIVE_MAP.breaksLineOfSight(from, to)) return false;
  _losFrom.set(from.x || 0, from.y || 0, from.z || 0);
  _losDir.set((to.x || 0) - _losFrom.x, (to.y || 0) - _losFrom.y, (to.z || 0) - _losFrom.z);
  const dist = _losDir.length();
  if (dist <= 0.62) return true;
  _losDir.multiplyScalar(1 / dist);
  ray.set(_losFrom, _losDir); ray.far = dist - 0.6; ray.firstHitOnly = true;
  const clear = ray.intersectObjects(solids, false).length === 0;
  ray.firstHitOnly = false;
  return clear;
}

// ============================================================ water — smooth instanced streams, soft mist, ripples & spreading puddles
const GRAV = 9;
function softDotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function puddleTexMake() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 64 + rand(-22, 22), y = 64 + rand(-22, 22), r = rand(22, 40);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return new THREE.CanvasTexture(c);
}
const SOFT = softDotTex(), PUDDLE_TEX = puddleTexMake();
// every droplet: { p, v, owner, life, col (does collision), lead (group it leads), grp (group it follows), trav, delay, r, stretch, grow }
const shots = [];
const DMAX = 900;
const waterMat = new THREE.MeshPhongMaterial({ color: 0xa6e0ff, emissive: 0x2f78a8, emissiveIntensity: 0.38, specular: 0xffffff, shininess: 110, transparent: true, opacity: 0.8, depthWrite: false });
const dropI = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), waterMat, DMAX);
dropI.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dropI.frustumCulled = false; dropI.count = 0; dropI.renderOrder = 3; scene.add(dropI);
// mist / spray haze: soft round sprites with per-particle size & alpha
const MISTN = 700;
const mistGeo = new THREE.BufferGeometry();
const mPos = new Float32Array(MISTN * 3).fill(-50), mVel = new Float32Array(MISTN * 3), mLife = new Float32Array(MISTN), mMax = new Float32Array(MISTN).fill(1), mBase = new Float32Array(MISTN), mSize = new Float32Array(MISTN), mAlpha = new Float32Array(MISTN);
mistGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
mistGeo.setAttribute('size', new THREE.BufferAttribute(mSize, 1));
mistGeo.setAttribute('alpha', new THREE.BufferAttribute(mAlpha, 1));
const mistMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: SOFT }, scale: { value: 600 } },
  vertexShader: 'attribute float size; attribute float alpha; varying float vA; uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.2, -mv.z); vA = alpha; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vA; if (a < 0.01) discard; gl_FragColor = vec4(mix(vec3(0.66, 0.86, 1.0), vec3(1.0), t.r * 0.55), a); }',
  transparent: true, depthWrite: false,
});
const mist = new THREE.Points(mistGeo, mistMat); mist.frustumCulled = false; mist.renderOrder = 4; scene.add(mist);
let mistHead = 0;
function puff(p, n, spd, size, life, up = 0.5) {
  for (let i = 0; i < n; i++) {
    const k = mistHead++ % MISTN;
    mPos[k * 3] = p.x + rand(-0.08, 0.08); mPos[k * 3 + 1] = p.y + rand(-0.05, 0.08); mPos[k * 3 + 2] = p.z + rand(-0.08, 0.08);
    const a = rand(0, 6.28), e = rand(-0.3, 1);
    mVel[k * 3] = Math.cos(a) * spd * rand(0.3, 1); mVel[k * 3 + 1] = (e * spd * 0.6 + up); mVel[k * 3 + 2] = Math.sin(a) * spd * rand(0.3, 1);
    mLife[k] = mMax[k] = life * rand(0.7, 1.25); mBase[k] = size * rand(0.6, 1.3);
  }
}
// ground ripples
const rippleGeo = new THREE.RingGeometry(0.8, 1, 40); rippleGeo.rotateX(-Math.PI / 2);
const ripples = [];
for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color: 0xeef9ff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 2; scene.add(m); ripples.push({ m, t: 1, s: 1 }); }
let rippleHead = 0;
function ripple(p, s = 1) { const r = ripples[rippleHead++ % ripples.length]; r.t = 0; r.s = s * rand(0.8, 1.2); r.m.position.set(p.x, (p.y || 0) + 0.035, p.z); r.m.visible = true; }
// puddles that spread as you keep spraying the same spot, then soak away
const puddles = [];
const puddleGeo = new THREE.PlaneGeometry(1, 1); puddleGeo.rotateX(-Math.PI / 2);
function puddle(p) {
  const near = puddles.find((q) => Math.hypot(q.m.position.x - p.x, q.m.position.z - p.z) < q.s * 0.55 && Math.abs(q.m.position.y - (p.y || 0)) < 0.6);
  if (near) { near.target = Math.min(0.68, near.target + 0.025); near.t = Math.max(0, Math.min(near.t, near.t * 0.35)); return; }
  if (puddles.length >= 40) { const o = puddles.shift(); scene.remove(o.m); o.m.material.dispose(); }
  const m = new THREE.Mesh(puddleGeo, new THREE.MeshBasicMaterial({ map: PUDDLE_TEX, color: 0x4f86ad, transparent: true, opacity: 0, depthWrite: false }));
  m.position.set(p.x, (p.y || 0) + 0.022 + puddles.length * 0.0004, p.z); m.rotation.y = rand(0, 6.28); m.renderOrder = 1; m.scale.setScalar(0.08);
  scene.add(m); puddles.push({ m, t: 0, s: 0.08, target: rand(0.28, 0.42) });
}
function splash(p, n = 22, power = 4) {
  if (!p) return;
  const px = p.x || 0, py = p.y || 0, pz = p.z || 0;
  if (shots.length < DMAX - 60) for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), up = rand(0.45, 1) * power * 0.95, hz = power * rand(0.2, 0.75);
    shots.push({ p: new THREE.Vector3(px, py, pz), v: new THREE.Vector3(Math.cos(a) * hz, up, Math.sin(a) * hz), owner: null, life: rand(0.45, 0.85), col: false, grp: null, lead: null, trav: 0, delay: 0, r: rand(0.028, 0.06), stretch: 0.06, grow: false });
  }
  puff(p, Math.ceil(n / 3), power * 0.35, 0.5, 0.6);
  if (Math.abs(py - groundHeightAt(px, pz)) < 0.32) ripple(p, 0.6 + power * 0.08);
}
function fire(from, dir, shooter, speed = 26, remoteVisual = false, elemOverride = null, extraOpts = null) {
  const shooterChar = shooter === 'player' ? G.player : shooter;
  const isLocalPlayer = shooterChar === G.player;
  const shotCfg = elementalGuns
    ? elementalGuns.getShotParams(elemOverride || shooterChar)
    : { elemId: 'water', gravityMul: 1.0 };
  const elemId = shotCfg.elemId || 'water';
  const isAntiAir = !!(extraOpts && extraOpts.isAntiAir);
  const gravMul = extraOpts && typeof extraOpts.gravMulOverride === 'number'
    ? extraOpts.gravMulOverride
    : (shotCfg.gravityMul ?? 1.0);
  const shotLife = (extraOpts && extraOpts.lifeOverride) || 2.2;
  const rScale = (extraOpts && extraOpts.scaleOverride) || 1.0;
  if (!remoteVisual && matchFlow && shooterChar) matchFlow.onSeekerShot(shooterChar);
  const v = dir.clone().multiplyScalar(speed), grp = { hit: Infinity };
  const r = (elemId === 'water'
    ? (isLocalPlayer ? 0.046 : 0.058)
    : (isLocalPlayer ? 0.034 : 0.044)) * rScale;
  const leadShot = { p: from.clone(), v, shooter: shooterChar, elem: elemId, gravMul, isAntiAir, remoteVisual: !!remoteVisual, life: shotLife, col: true, lead: grp, grp: null, trav: 0, delay: 0, r, stretch: isAntiAir ? 0.11 : 0.075, grow: true };
  if (elementalGuns) elementalGuns.onShotSpawned(leadShot, elemId);
  shots.push(leadShot);
  const trailCount = elemId === 'water' ? 5 : 2;
  const trailGap = elemId === 'water' ? 0.012 : 0.016;
  for (let k = 1; k <= trailCount; k++) {
    const fol = { p: from.clone(), v: v.clone(), shooter: shooterChar, elem: elemId, gravMul, isAntiAir, remoteVisual: !!remoteVisual, life: shotLife, col: false, lead: null, grp, trav: 0, delay: k * trailGap, r: r * (elemId === 'water' ? (0.88 - k * 0.06) : (0.65 - k * 0.14)), stretch: isAntiAir ? 0.11 : 0.075, grow: true };
    if (elementalGuns) elementalGuns.onShotSpawned(fol, elemId);
    shots.push(fol);
  }
  if (elemId === 'water') {
    if (Math.random() < (isAntiAir ? 0.55 : 0.22)) puff(from, isAntiAir ? 2 : 1, 0.25, isLocalPlayer ? 0.04 : 0.07, 0.14, 0.08);
    if (!isLocalPlayer) audio.shot(from.x, from.z);   // the player's water spray is a continuous loop (audio.spray)
  }
  if (!remoteVisual && MP) MP.broadcastShot(shooterChar, from, dir, speed, elemId);
}

// ============================================================ audio — all sound is procedural Web Audio in audio.js
const sfx = audio; // legacy name (sfx.unlock)

// ============================================================ PROPS — prop hunt. Codex's Storybook-style art kit (kit.js) when present, stand-ins otherwise
const realProps = [];        // { g, id, pos, radius }
let KIT = null, READY = false;
const LIVE = []; // clusters actually placed: { c: Vector3, ids: [] }

function standInKit() {
  const M = (hex, tex, rep) => getTexturedLambertMat(tex, rep[0], rep[1], hex);
  const lathe = (pts, seg = 18) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const grp = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); }); return g; };
  const at = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };
  const wood = M(0x9a6a43, 'wood', [2, 1]), woodL = M(0xd2a56b, 'wood', [1, 1]), hay = M(0xe9c75e, 'straw', [2, 1]), sack = M(0xe2cfa6, 'straw', [1, 1]);
  const metal = new THREE.MeshLambertMaterial({ color: 0x8fa6b2 }), terra = new THREE.MeshLambertMaterial({ color: 0xc8653f });
  const pumpkin = new THREE.MeshLambertMaterial({ color: 0xf08a24 }), leaf = new THREE.MeshLambertMaterial({ color: 0x5d9a4c }), flower = new THREE.MeshLambertMaterial({ color: 0xf26d8f });
  const P = {
    barrel: { label: 'Barrel', radius: 0.5, height: 1.05, zone: 'any', build: () => grp(
      new THREE.Mesh(lathe([[0, 0], [0.4, 0], [0.47, 0.25], [0.5, 0.52], [0.47, 0.8], [0.4, 1.05], [0, 1.05]]), wood),
      at(new THREE.Mesh(new THREE.TorusGeometry(0.485, 0.025, 6, 24), metal), 0, 0.28, 0, Math.PI / 2),
      at(new THREE.Mesh(new THREE.TorusGeometry(0.485, 0.025, 6, 24), metal), 0, 0.78, 0, Math.PI / 2)) },
    crate: { label: 'Crate', radius: 0.55, height: 0.8, zone: 'any', build: () => grp(at(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), woodL), 0, 0.4, 0)) },
    hay_round: { label: 'Hay bale', radius: 0.85, height: 1.25, zone: 'farm', build: () => grp(
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.86, 1.0, 16), hay), 0, 0.5, 0),
      at(new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hay), 0, 1.0, 0, 0, 0, 0)) },
    bucket: { label: 'Bucket', radius: 0.3, height: 0.5, zone: 'farm', build: () => grp(new THREE.Mesh(lathe([[0, 0], [0.22, 0], [0.28, 0.45], [0.26, 0.45], [0.2, 0.03], [0, 0.03]]), wood),
      at(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.012, 4, 16, Math.PI), metal), 0, 0.45, 0)) },
    milk_can: { label: 'Milk can', radius: 0.3, height: 0.85, zone: 'farm', build: () => grp(new THREE.Mesh(lathe([[0, 0], [0.24, 0], [0.25, 0.55], [0.13, 0.7], [0.12, 0.8], [0.15, 0.82], [0, 0.85]]), metal)) },
    pumpkin: { label: 'Pumpkin', radius: 0.42, height: 0.55, zone: 'garden', build: () => grp(at(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), pumpkin), 0, 0.3, 0).scale.set(1, 0.72, 1) && grp(),
      at(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), pumpkin), 0, 0.29, 0), at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.14), leaf), 0, 0.6, 0)) },
    flour_sack: { label: 'Flour sack', radius: 0.4, height: 0.75, zone: 'plaza', build: () => grp(new THREE.Mesh(lathe([[0, 0], [0.33, 0], [0.36, 0.3], [0.28, 0.6], [0.12, 0.7], [0.16, 0.75], [0, 0.75]]), sack)) },
    flower_pot: { label: 'Flower pot', radius: 0.35, height: 0.75, zone: 'garden', build: () => grp(new THREE.Mesh(lathe([[0, 0], [0.18, 0], [0.27, 0.4], [0.3, 0.42], [0, 0.42]]), terra),
      at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), leaf), 0, 0.55, 0), at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), flower), 0.1, 0.72, 0.05), at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), flower), -0.12, 0.66, -0.05)) },
  };
  P.pumpkin.build = () => { const g = grp(at(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), pumpkin), 0, 0.29, 0), at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.14), leaf), 0, 0.6, 0)); g.children[0].scale.set(1, 0.72, 1); return g; };
  return { props: P };
}

// ---------- map design: every prop lives in a hand-authored little scene ("vignette").
// Each vignette is a set of SLOTS (prop id + exact spot + facing). Most slots get a real prop; a few are left
// empty on purpose — that gap in a row of milk cans is exactly where a hider can slip in and look natural.
const SLOTS = [];
function localBox(g) {
  const r = g.rotation.y, p = g.position.clone();
  g.rotation.y = 0; g.position.set(0, 0, 0); g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g);
  g.rotation.y = r; g.position.copy(p); g.updateMatrixWorld(true);
  return b;
}
const anchorOf = (g) => ({ x: g.position.x, y: g.position.y, z: g.position.z, rot: g.rotation.y, b: localBox(g) });
const anchorAt = (x, z, rot, y) => ({ x, y, z, rot, b: null });
const facingCenter = (x, z) => Math.atan2(-x, -z); // local +z points at the plaza
function toWorld(an, lx, lz) { const c = Math.cos(an.rot), sn = Math.sin(an.rot); return [an.x + lx * c + lz * sn, an.z - lx * sn + lz * c]; }
function vignette(name, an, items, freeCount, clearScale = 0.85) {
  const v = { name, c: new THREE.Vector3(an.x, an.y || 0, an.z), ids: [], slots: [] };
  for (const it of items) {
    const [id, lx, lz, lr, ly] = Array.isArray(it) ? it : [it.id, it.x || 0, it.z || 0, it.rot || 0, it.y || 0];
    if (!KIT.props[id]) continue;
    const [x, z] = toWorld(an, lx, lz);
    const sy = (typeof an.y === 'number' ? an.y : groundHeightAt(x, z)) + (ly || 0);
    const sl = { id, x, y: sy, z, rot: an.rot + (lr || 0) + rand(-0.1, 0.1), vig: v, real: null, taken: null };
    v.slots.push(sl); SLOTS.push(sl);
    if (!v.ids.includes(id)) v.ids.push(id);
  }
  if (!v.slots.length) return;
  v.c.set(
    v.slots.reduce((a2, q) => a2 + q.x, 0) / v.slots.length,
    v.slots.reduce((a2, q) => a2 + (q.y || 0), 0) / v.slots.length,
    v.slots.reduce((a2, q) => a2 + q.z, 0) / v.slots.length
  );
  LIVE.push(v);
  // fill all but a few slots with real props
  const order = v.slots.slice().sort(() => Math.random() - 0.5);
  const free = freeCount != null ? freeCount : v.slots.length >= 7 ? 2 : v.slots.length >= 3 ? 1 : 0;
  order.forEach((sl, k) => { if (k >= free) placeReal(sl, clearScale); });
}
function placeReal(sl, clearScale = 0.85) {
  const r = KIT.props[sl.id].radius || 0.5;
  const py = typeof sl.y === 'number' ? sl.y : groundHeightAt(sl.x, sl.z);
  if (!freeAt(sl.x, sl.z, r * clearScale, py)) { sl.blocked = true; return; }
  const g = buildProp(sl.id);
  g.position.set(sl.x, py, sl.z); g.rotation.y = sl.rot;
  mapRoot.add(g);
  const ph = clamp(KIT.props[sl.id].height || 1.0, 0.25, 2.5);
  const ownBox = {
    x0: sl.x - r * 0.78, x1: sl.x + r * 0.78,
    z0: sl.z - r * 0.78, z1: sl.z + r * 0.78,
    y: py, y0: py - 0.25, y1: py + ph,
    standable: ph <= 1.68,
    isProp: true,
  };
  blockers.push(ownBox);
  const rec = { g, id: sl.id, pos: g.position, radius: r, height: ph, ownBox, homeX: sl.x, homeY: py, homeZ: sl.z, homeRotY: g.rotation.y };
  g.traverse((m) => { if (m.isMesh && !m.userData.shadowProxy) { m.userData.propRoot = rec; solids.push(m); } });
  realProps.push(rec); sl.real = rec;
}
function freeAt(x, z, r, refY) {
  if (Math.hypot(x, z) > MAPR - 1) return false;
  const inRoom = ENTER.length ? whereIs(x, z, refY) : null;
  if (!inRoom && ACTIVE_MAP && ACTIVE_MAP.isDeepWater && ACTIVE_MAP.isDeepWater(x, z)) return false;
  for (const b of blockers) {
    if (!blockerOverlapsY(b, refY)) continue;
    if (!(x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r)) continue;
    if (!b.obb) return false;
    const [lx, lz] = obbLocal(b.obb, x, z); if (Math.abs(lx) < b.obb.hx + r && Math.abs(lz) < b.obb.hz + r) return false;
  }
  for (const b of ENTER) {
    if (typeof refY === 'number' && Math.abs(refY - b.g.position.y) > 1.85) continue;
    for (const d of [b.door, b.doorIn, ...(b.inner || [])]) {
      if (d && Math.hypot(d.x - x, d.z - z) < r + 0.85) return false;
    }
  }
  for (const p of realProps) {
    if (typeof refY === 'number' && Math.abs((p.pos.y || 0) - refY) > 1.85) continue;
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < p.radius + r + 0.05) return false;
  }
  return true;
}
// each prop type is built once, merged to a handful of meshes, then cloned (clones share geometry + materials)
const PROP_TEMPLATES = {};
// The shadow pass is depth-only, so the materials that split a prop into ~5 meshes don't matter there.
// Each prop template gets one merged "shadow proxy" per face side on a layer only the shadow camera
// renders; the visible meshes stop casting. Same silhouette, ~5x fewer shadow draw calls per prop.
// Cut-out (alpha-tested / alpha-mapped / transparent-textured) meshes keep casting themselves so their
// holes stay in the shadow. The proxy is a child of the prop, so it moves and clones with it.
const _proxyMats = new Map();
function attachShadowProxy(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const bySide = new Map();
  root.traverse((m) => {
    if (!m.isMesh || !m.castShadow || m.isInstancedMesh || m.isSkinnedMesh || m.userData.shadowProxy) return;
    const mat = m.material;
    if (!mat || Array.isArray(mat) || mat.alphaTest > 0 || mat.alphaMap || (mat.transparent && mat.map) || mat.isShaderMaterial) return;
    if (mat.shadowSide != null || m.customDepthMaterial) return;
    for (let a = m.parent; a && a !== root; a = a.parent) if (a.userData.keep || a.name === 'sails' || a.name === 'cloth') return;
    const src = m.geometry;
    if (!src || !src.attributes.position) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.attributes.position.clone());
    if (src.index) g.setIndex(src.index.clone());
    const ni = g.index ? g.toNonIndexed() : g;
    ni.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const list = bySide.get(mat.side) || [];
    list.push(ni); bySide.set(mat.side, list);
    m.castShadow = false;
  });
  for (const [side, geos] of bySide) {
    const merged = geos.length === 1 ? geos[0] : mergeGeoms(geos, false);
    if (!merged) continue;
    let pm = _proxyMats.get(side);
    if (!pm) { pm = new THREE.MeshBasicMaterial({ side, colorWrite: false, depthWrite: false }); _proxyMats.set(side, pm); }
    const proxy = new THREE.Mesh(merged, pm);
    proxy.name = 'shadowProxy';
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    proxy.layers.set(SHADOW_ONLY_LAYER);
    proxy.userData.shadowProxy = true;
    proxy.raycast = () => {};
    root.add(proxy);
  }
}
function buildProp(id) {
  if (KIT.props[id]?.isAnimal) {
    const g = KIT.props[id].build();
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
  }
  let t = PROP_TEMPLATES[id];
  if (!t) {
    t = KIT.props[id].build();
    try { mergeStatic(THREE, t); } catch (e) { console.warn('[props] merge failed', id, e); }
    t.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    try { attachShadowProxy(t); } catch (e) { console.warn('[props] shadow proxy failed', id, e); }
    PROP_TEMPLATES[id] = t;
  }
  return t.clone();
}
// soft dirt paths from each cottage door to the plaza
const pathTex = canvasTex(256, (g2, sz) => {
  g2.clearRect(0, 0, sz, sz);
  const gr = g2.createLinearGradient(0, 0, sz, 0);
  gr.addColorStop(0, 'rgba(176,146,104,0)'); gr.addColorStop(0.22, 'rgba(186,156,112,0.95)'); gr.addColorStop(0.78, 'rgba(186,156,112,0.95)'); gr.addColorStop(1, 'rgba(176,146,104,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, sz, sz);
  for (let i = 0; i < 160; i++) { g2.fillStyle = `rgba(${rand(120, 160) | 0},${rand(100, 130) | 0},${rand(70, 95) | 0},${rand(0.15, 0.4)})`; g2.beginPath(); g2.ellipse(rand(sz * 0.25, sz * 0.75), rand(0, sz), rand(2, 7), rand(1.5, 5), rand(0, 3), 0, 7); g2.fill(); }
});
function dirtPath(x0, z0, x1, z1, width) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const t = pathTex.clone(); t.needsUpdate = true; t.repeat.set(1, len / 3);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(x1 - x0, z1 - z0) + Math.PI;
  m.position.set((x0 + x1) / 2, 0.018, (z0 + z1) / 2); m.receiveShadow = true; m.renderOrder = 1;
  mapRoot.add(m);
}
function layoutProps() {
  const N = KIT.nature || null;
  // interiors: every enterable building declares prop slots next to its furniture (groups of 2–3 of a kind)
  ENTER.forEach((b, i) => {
    const slots = b.g.userData.propSlots; if (!slots || !slots.length) return;
    const sc = b.g.scale.x, an = anchorOf(b.g);
    vignette(`inside_${b.g.name}_${i}`, an, slots.map((q) => [q.id, q.x * sc, q.z * sc, q.rot || 0]), Math.max(2, Math.round(slots.length * 0.25)), 0.45);
  });
  // cottage porches + paths
  STRUCT.cottages.forEach((g, i) => {
    const an = anchorOf(g), f = an.b.max.z, hw = an.b.max.x;
    const doorX = g.userData.door ? g.userData.door.x * g.scale.x : 0;
    const [dx, dz] = toWorld(an, doorX, f + 0.2);
    const dir = Math.atan2(dx, dz), pr = PLAZA_R - 0.2;
    dirtPath(dx, dz, Math.sin(dir) * pr, Math.cos(dir) * pr, 1.7);
    const items = [['flower_pot', doorX - 1.1, f + 0.4, 0], ['flower_pot', doorX + 1.1, f + 0.4, 0.6], ['mailbox', doorX + 1.6, f + 3.2, 0], ['lantern_post', doorX - 1.6, f + 3.2, 0]];
    if (i % 2) items.push(['stool', hw - 0.5, f + 0.7, 0.4], ['watering_can', -hw + 0.6, f + 0.75, 1.2], ['flower_pot', -hw + 0.2, f + 0.5, 0]);
    else items.push(['barrel', hw + 0.65, f - 0.5, 0], ['crate', hw + 0.7, f - 1.6, 0.15], ['bucket', hw + 0.4, f + 0.5, 0]);
    vignette(`porch${i}`, an, items);
    if (N && N.flowerClump) for (const sx of [-1, 1]) { const [fx, fz] = toWorld(an, sx * (hw - 0.3), f + 0.35); placeKit(N.flowerClump(pick([0xf2a0c2, 0xffd166, 0xb68ad8, 0xef7a6b])), fx, fz, rand(0, 6), 0, false); }
  });
  // market stalls: crates stacked behind, baskets in front, sacks at the side
  STRUCT.stalls.forEach((g, i) => {
    const an = anchorOf(g), f = an.b.max.z, bk = an.b.min.z, sx = an.b.max.x;
    vignette(`market${i}`, an, [
      ['crate', -1.05, bk - 0.55, 0], ['crate', 0.05, bk - 0.6, 0.05], ['crate', 1.15, bk - 0.55, -0.05],
      ['veg_basket', -0.7, f + 0.55, 0], ['veg_basket', 0.6, f + 0.55, 0.3],
      ['flour_sack', sx + 0.55, 0.35, 0], ['flour_sack', sx + 0.55, -0.5, 0.4], ['stool', -sx - 0.5, 0.1, 0],
    ]);
  });
  // the well: buckets around the rim
  if (STRUCT.well) { const an = anchorOf(STRUCT.well), r = an.b.max.x; vignette('well', an, [['bucket', r + 0.45, 0.3, 0], ['bucket', -r - 0.45, -0.4, 0.5], ['bucket', 0.2, -r - 0.45, 1], ['watering_can', 0.4, r + 0.5, 0.3]]); }
  // a row of barrels + lantern posts around the plaza edge
  { const a = 3.9, x = Math.sin(a) * (PLAZA_R + 0.9), z = Math.cos(a) * (PLAZA_R + 0.9); const an = anchorAt(x, z, facingCenter(x, z));
    vignette('barrel_row', an, [['barrel', -1.6, 0, 0], ['barrel', -0.55, 0, 0.3], ['barrel', 0.5, 0, 0.1], ['barrel', 1.55, 0, 0.5], ['crate', 2.75, 0.1, 0.1]]); }
  { const items = []; for (let k = 0; k < 6; k++) { const a = 0.5 + k * (Math.PI * 2 / 6); items.push(['lantern_post', Math.sin(a) * (PLAZA_R + 0.4), Math.cos(a) * (PLAZA_R + 0.4), 0]); } vignette('lamps', anchorAt(0, 0, 0), items, 1); }
  // farmyard by the barn
  if (STRUCT.barn) {
    const an = anchorOf(STRUCT.barn), f = an.b.max.z, bk = an.b.min.z, hw = an.b.max.x;
    const L = (t) => bk + (f - bk) * t;
    vignette('farmyard', an, [
      ['hay_round', -hw - 1.0, L(0.2), 0], ['hay_round', -hw - 1.0, L(0.5), 0.4], ['hay_round', -hw - 1.0, L(0.8), 0.8],
      ['hay_bale', -1.9, f + 1.3, 0], ['hay_bale', -3.0, f + 1.35, 0.1],
      ['milk_can', 1.5, f + 0.75, 0], ['milk_can', 2.1, f + 0.8, 0.4], ['milk_can', 2.7, f + 0.75, 0.8], ['bucket', 1.0, f + 1.5, 0],
      ['cart_wheel', hw + 0.35, L(0.75), Math.PI / 2], ['log_pile', hw + 1.1, L(0.3), Math.PI / 2],
    ]);
  }
  // fenced vegetable garden with two neat pumpkin rows
  { const gx = -13.5, gz = 4.5, an = anchorAt(gx, gz, facingCenter(gx, gz));
    if (N && N.fence) {
      const fence = (lx, lz, lr, len) => { const [x, z] = toWorld(an, lx, lz); const fg = N.fence(len); fg.position.set(x, 0, z); fg.rotation.y = an.rot + lr; mapRoot.add(fg); fg.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; solids.push(m); } }); };
      fence(0, -2.3, 0, 6.2); fence(-3.1, 0, Math.PI / 2, 4.6); fence(3.1, 0, Math.PI / 2, 4.6); fence(-2.0, 2.3, 0, 2.2); fence(2.0, 2.3, 0, 2.2);
    }
    const items = [];
    for (const lz of [-1.0, 0.5]) for (const lx of [-2.1, -0.7, 0.7, 2.1]) items.push(['pumpkin', lx, lz, rand(-1, 1)]);
    items.push(['watering_can', 1.1, 3.0, 0.4], ['bucket', -1.1, 3.0, 0], ['veg_basket', 2.3, 3.1, 0.2]);
    vignette('veg_garden', an, items, 2);
  }
  // woodshed corner by the windmill
  { const wx = -19.5, wz = -6.5, an = anchorAt(wx, wz, facingCenter(wx, wz));
    vignette('woodshed', an, [['log_pile', -1.9, 0, 0], ['log_pile', 0, 0, 0.1], ['log_pile', 1.9, 0, -0.1], ['crate', 3.1, 0.3, 0], ['crate', 3.1, 1.4, 0.2], ['stool', -0.1, 1.7, 0.3], ['cart_wheel', -3.3, 0.6, 1.2], ['barrel', 3.2, -0.9, 0]]); }
  console.log(`[map] ${LIVE.length} hand-built scenes · ${realProps.length} props · ${SLOTS.filter((q) => !q.real && !q.blocked).length} open hiding slots`);
}
const MODULE_V = 'v12';
async function loadKit() {
  try {
    const m = await import(`./kit.js?v=${MODULE_V}`);
    const k = m.createKit(THREE);
    if (k && k.props && Object.keys(k.props).length) {
      console.log('[kit] Codex art kit loaded');
      try { const m2 = await import(`./kit2.js?v=${MODULE_V}`); const k2 = m2.createKit2(THREE); Object.assign(k.props, k2.props); console.log(`[kit] +${Object.keys(k2.props).length} indoor props`); }
      catch (e) { console.log('[kit] no indoor props yet', e.message); }
      return k;
    }
  } catch (e) { console.log('[kit] no art kit yet — using stand-ins'); }
  return standInKit();
}
// hand-modelled village pieces (each module optional: missing ones fall back to the kit / hero cottage)
const HOUSE_ORDER = ['hero', 'thatch', 'bakery', 'townhouse', 'turret', 'crooked', 'farmhouse'];
const VILLAGE = { houses: {}, plaza: null, farm: null, chars: {} };
async function loadVillage() {
  const v = MODULE_V;
  await Promise.all([
    ...HOUSE_ORDER.filter((k) => k !== 'hero').map((k) => import(`./houses/${k}.js?v=${v}`).then((m) => { VILLAGE.houses[k] = m.buildHouse; }).catch((e) => console.log(`[village] no house ${k} yet`, e.message))),
    import(`./world/plaza.js?v=${v}`).then((m) => { VILLAGE.plaza = m; }).catch((e) => console.log('[village] no plaza yet', e.message)),
    import(`./world/farm.js?v=${v}`).then((m) => { VILLAGE.farm = m; }).catch((e) => console.log('[village] no farm yet', e.message)),
    import(`./characters/hider.js?v=${v}`).then((m) => { VILLAGE.chars.buildHider = m.buildHider; VILLAGE.chars.HIDER_SKINS = m.HIDER_SKINS; }).catch((e) => console.log('[village] no hider model yet', e.message)),
    import(`./characters/seekers.js?v=${v}`).then((m) => { if (m.buildSeeker) { VILLAGE.chars.buildSeeker = m.buildSeeker; VILLAGE.chars.SEEKER_KINDS = m.SEEKER_KINDS; } }).catch((e) => console.log('[village] no seeker models yet', e.message)),
  ]);
  console.log(`[village] houses: ${Object.keys(VILLAGE.houses).join(', ') || 'none'} · plaza ${!!VILLAGE.plaza} · farm ${!!VILLAGE.farm}`);
}
// ============================================================ 6 Storybook Worlds Registry & Switcher
const meadowExpansion = {
  underground: null,
  features: null,
  habitats: null,
  animals: null,
  interactSpots: [],
  vigQueue: [],
};

function getMeadowSimSec(rawSec = simNow() / 1000) {
  if (G.phase !== 'menu' && G.phase !== 'vs' && G.player && !G.isTutorial) {
    if (G.phase === 'hide' || G.phase === 'ready') {
      const prepDur = G.mode === 'seek' ? ROUND.seekReady : ROUND.hide;
      return Math.max(0, prepDur - (G.t || 0));
    }
    const huntDur = G.huntDuration || (G.mode === 'seek' ? ROUND.seek : ROUND.survive);
    return 30 + Math.max(0, huntDur - (G.t || 0));
  }
  return rawSec;
}

const MEADOW_DEF = {
  id: 'meadow',
  title: 'Meadowbrook Village',
  shortTitle: 'Meadowbrook',
  subtitle: 'Sunlit square, flying storks & farm animals, crystal root-cellars, Sky-Turret & Elder Oak treehouse',
  badge: 'Cosy Village',
  preview: 'assets/concepts/map_overview.webp',
  mapRadius: 37.65,
  isMeadowBase: true,
  useMeadowSky: true,
  defaultBuildingFloorY: 0.22,
  propIcons: Object.assign({}, ANIMAL_PROP_ICONS, UNDERGROUND_PROP_ICONS, FEATURE_PROP_ICONS),
  sky: { top: 0x5aa6e6, mid: 0xc4e3f3, bot: 0xf7e6c4, sunDisc: 0xfff5dc },
  fog: { color: 0xd8e6e4, near: 42, far: 128 },
  lights: { hemiSky: 0xcfe6ff, hemiGround: 0x8aa35f, hemiInt: 1.25, sunColor: 0xffd29a, sunInt: 2.75, sunPos: [28, 42, 18], exposure: 1.08 },
  gunColors: { tank: 0xffa94d, barrel: 0x3fb8a8, grip: 0x2f5f8a },
  camMenu: { r: 16.5, y: 13.4, lookY: 0.6 },
  groundHeightAt(x, z, refY) {
    const ry = typeof refY === 'number' ? refY : 0;
    const uy = sampleUndergroundHeight(x, z, ry);
    if (typeof uy === 'number') return uy;
    if (meadowExpansion.features) {
      const fy = meadowExpansion.features.sampleFeatureHeight(x, z, ry);
      if (typeof fy === 'number') return fy;
    }
    return 0;
  },
  routeTierWaypoint(from, goal) {
    if (!from || !goal) return null;
    const fy = typeof from.y === 'number' ? from.y : 0;
    if (fy >= 2.2 && meadowExpansion.features) {
      const topDown = meadowExpansion.features.routeFeatureWaypoint(from, goal);
      if (topDown) return topDown;
    }
    if (meadowExpansion.underground) {
      const uw = meadowExpansion.underground.routeWaypoint(from, goal);
      if (uw) return uw;
    }
    if (meadowExpansion.features) {
      const fw = meadowExpansion.features.routeFeatureWaypoint(from, goal);
      if (fw) return fw;
    }
    return null;
  },
  getInteractSpots() {
    return meadowExpansion.interactSpots;
  },
  getNearbyInteraction(player, gState) {
    if (!player) return null;
    const u = player.userData || {};
    if (u.inTurret) {
      return {
        id: 'mb_sky_turret',
        kind: 'turret',
        icon: '🎯',
        label: 'Hop Off Turret',
        isExitTurret: true,
      };
    }
    if (u.specialMode) {
      return {
        kind: u.specialMode,
        icon: u.specialSpot?.icon || '🚪',
        label: u.specialSpot?.leaveLabel || 'Hop Out',
        exitHint: u.specialSpot?.exitHint,
      };
    }
    const px = player.position.x, pz = player.position.z;
    const py = (u.groundY ?? player.position.y ?? 0) + (u.jy || 0);
    const isHider = (gState?.mode || G.mode) === 'hide';
    let best = null, bestD = Infinity;
    for (let i = 0; i < meadowExpansion.interactSpots.length; i++) {
      const sp = meadowExpansion.interactSpots[i];
      if (!sp) continue;
      if (sp.kind === 'turret') {
        if (isHider) continue;
        if (sp.occupiedBy && sp.occupiedBy !== player) continue;
      } else {
        const isShared = sp.kind === 'ride_path' || sp.kind === 'mechanism' || sp.kind === 'lift';
        if (!isShared) {
          if (!isHider) continue;
          if (sp.occupiedBy && sp.occupiedBy !== player) continue;
        }
      }
      const ty = sp.triggerY ?? sp.groundY ?? sp.y ?? 0;
      if (Math.abs(py - ty) > 1.55) continue;
      const tx = sp.triggerX ?? sp.x;
      const tz = sp.triggerZ ?? sp.z;
      const rad = sp.interactRadius || sp.radius || 2.55;
      const d = Math.hypot(px - tx, pz - tz);
      if (d <= rad && d < bestD) {
        bestD = d;
        best = sp;
      }
    }
    return best;
  },
  buildCustomSpotDisguise(T, inter) {
    const dt = inter?.disguiseType || inter?.spotType || '';
    if (dt === 'cider_tun_lid' || dt === 'minecart_pile' || dt === 'moss_curtain') {
      return meadowExpansion.underground?.buildCustomSpotDisguise
        ? meadowExpansion.underground.buildCustomSpotDisguise(inter)
        : buildUndergroundSpotDisguise(T, inter);
    }
    return buildMeadowSpotDisguise(T, inter);
  },
  triggerMechanism(ch, inter, gState) {
    if (meadowExpansion.underground?.triggerMechanism) {
      const uMsg = meadowExpansion.underground.triggerMechanism(ch, inter, gState);
      if (uMsg) return uMsg;
    }
    return meadowExpansion.features ? meadowExpansion.features.triggerMechanism(ch, inter, gState) : null;
  },
  sampleLauncherAt(ch, gState, dt) {
    if (meadowExpansion.underground?.sampleLauncherAt) {
      const uLaunch = meadowExpansion.underground.sampleLauncherAt(ch, gState, dt);
      if (uLaunch) return uLaunch;
    }
    return meadowExpansion.features ? meadowExpansion.features.sampleLauncherAt(ch, gState, dt) : null;
  },
  breaksLineOfSight(from, to) {
    return meadowBreaksLineOfSight(from, to) || breaksUndergroundLOS(from, to);
  },
};
const MAP_ORDER = ['meadow', 'bathhouse', 'seaplane', 'skyruins', 'clockwork', 'tinyfolk'];
const MAP_SHORT_TITLES = {
  meadow: 'Meadowbrook',
  bathhouse: 'Yu-Machi Bathhouse',
  skyruins: 'Celestia Sky-Ruins',
  seaplane: 'Porto Sereno Cove',
  clockwork: 'Pendulum Square',
  tinyfolk: "Tinyfolk Hollow",
};
const gunMats = { tank: null, barrel: null, grip: null };
const MAP_GUN_COLORS = {
  meadow: { tank: 0xffa94d, barrel: 0x3fb8a8, grip: 0x2f5f8a },
  bathhouse: { tank: 0xd9534f, barrel: 0x6ea85c, grip: 0x4a2f24 },
  skyruins: { tank: 0x45d4f5, barrel: 0xc89643, grip: 0x3d4b63 },
  seaplane: { tank: 0xd83a34, barrel: 0xe6b85c, grip: 0x245682 },
  clockwork: { tank: 0xd4883c, barrel: 0x8f2d3c, grip: 0x3b2c26 },
  tinyfolk: { tank: 0x76b852, barrel: 0xc98a42, grip: 0x5c3e26 },
};
const SPIRIT_OPTIONS = [
  { id: 'auto', icon: '✨', label: 'World Spirit', role: 'Auto World', desc: 'Automatically matches the signature forest spirit of whichever storybook world you play.' },
  { id: 'meadow', icon: '🌱', label: 'Sprout', role: 'Acorn Druid', desc: 'Layered oak-leaf druid cloak, ribbed acorn beret with woodland blossom & glowing dew-potion vial.' },
  { id: 'bathhouse', icon: '🏮', label: 'Suds-Star', role: 'Kitsune Shrine', desc: 'Purple wave-silk kimono, crimson butterfly obi, sculpted fox festival mask & glowing paper lantern.' },
  { id: 'skyruins', icon: '💎', label: 'Sky-Crystal', role: 'Astral Star-Mage', desc: 'Curved starry wizard hat, orbiting brass astrolabe ring, floating sky crystals & constellation cloak.' },
  { id: 'seaplane', icon: '⚓', label: 'Seafoam', role: 'Sky-Corsair', desc: 'Double-breasted navy admiral coat, golden epaulettes, tilted captain cap & brass pocket spyglass.' },
  { id: 'clockwork', icon: '🔥', label: 'Ember-Star', role: 'Hearth Alchemist', desc: 'Stitched leather workshop apron, dual glowing elixir vials, brass aviator goggles & dancing flame crown.' },
  { id: 'tinyfolk', icon: '🍀', label: 'Clover-Dew', role: 'Toadstool Fey', desc: 'Fluted spotted toadstool parasol hat with perched butterfly, fern-leaf poncho & berry basket.' },
];
const SEEKER_OPTIONS = [
  { id: 'ranger', icon: '🌧️', label: 'Mina', role: 'Raincoat Scout', desc: 'Agile petite scout in an open yellow raincoat, daisy hairclip, rolled map pack & chunky super-soaker.' },
  { id: 'botanist', icon: '🌾', label: 'Bram', role: 'Orchard Giant', desc: 'Towering broad-shouldered gentle giant in leaf overalls, frayed straw hat & giant brass watering cannon.' },
  { id: 'aviator', icon: '✈️', label: 'Kael', role: 'Sky-Runner', desc: 'Tall athletic sky-ace with spiky hair, brass goggles, billowing striped scarf & twin-barrel sky-carbine.' },
  { id: 'lantern', icon: '🏮', label: 'Sora', role: 'Shrine Guardian', desc: 'Regal wide-sleeved shrine sentinel in a giant bamboo kasa hat, glowing hip lantern & aqua-orb staff.' },
  { id: 'detective', icon: '⚙️', label: 'Pip', role: 'Clockwork Granny', desc: 'Bubbly steampunk alchemist granny with round spectacles, cogwheel boiler pack & glass dome sprayer.' },
];
const MAP_REGISTRY = { meadow: MEADOW_DEF };
function restoreWaterBlasterColors(mapId = activeMapId) {
  const gc = MAP_GUN_COLORS[mapId] || MAP_GUN_COLORS.meadow;
  if (gunMats.tank) {
    gunMats.tank.color.setHex(gc.tank);
    gunMats.barrel.color.setHex(gc.barrel);
    gunMats.grip.color.setHex(gc.grip);
    if (progression && progression.getEquipped('blaster') !== 'classic') {
      progression.applyBlasterSkin(gunMats);
    }
  }
}

function clearWorld() {
  clearRound();
  if (activeWorldDispose) {
    try { activeWorldDispose(); } catch (_) {}
    activeWorldDispose = null;
  }
  activeWorldTurret = null;
  if (meadowExpansion.animals) {
    meadowExpansion.animals.dispose();
  }
  meadowExpansion.underground = null;
  meadowExpansion.features = null;
  meadowExpansion.habitats = null;
  meadowExpansion.animals = null;
  meadowExpansion.interactSpots.length = 0;
  meadowExpansion.vigQueue.length = 0;
  while (mapRoot.children.length) mapRoot.remove(mapRoot.children[0]);
  worldOptimizer.disposePreviousWorldBatches();
  solids.length = 0;
  blockers.length = 0;
  _blockerGridLen = -1;
  _nearCache.ts = 0;
  spots.length = 0;
  ENTER.length = 0;
  INSIDE = null;
  SLOTS.length = 0;
  LIVE.length = 0;
  realProps.length = 0;
  STRUCT.cottages = [];
  STRUCT.stalls = [];
  STRUCT.well = null;
  STRUCT.barn = null;
  STRUCT.mill = null;
  windmillSails = null;
  laundryCloth = null;
  STREAM = null;
  PLAZA_DISC = null;
  GRASS_INST = null;
  activeWorldUpdate = null;
}

const customSkyCache = {};
const customSkyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
const customSkyCyl = new THREE.Mesh(new THREE.CylinderGeometry(190, 190, 150, 64, 1, true), customSkyMat);
customSkyCyl.position.y = 52;
customSkyCyl.renderOrder = -1;
customSkyCyl.visible = false;
scene.add(customSkyCyl);

const BASE_ATMOS = {
  skyTop: new THREE.Color(0x5fa2dc),
  skyMid: new THREE.Color(0xa6d2f0),
  skyLow: new THREE.Color(0xf7e6c4),
  fog: new THREE.Color(FOG),
  sun: new THREE.Color(0xfff1d2),
  hemiSky: new THREE.Color(0xcfe6ff),
  hemiGround: new THREE.Color(0x8aa35f),
  sunInt: 2.0,
  hemiInt: 1.25,
  exposure: 1.08,
  activePhaseT: 0,
};
const _TOD_GOLDEN_TOP = new THREE.Color(0x5872b4);
const _TOD_GOLDEN_MID = new THREE.Color(0xf0a672);
const _TOD_GOLDEN_LOW = new THREE.Color(0xffd28a);
const _TOD_GOLDEN_FOG = new THREE.Color(0xf4c798);
const _TOD_GOLDEN_SUN = new THREE.Color(0xffbe6b);
const _TOD_DUSK_TOP = new THREE.Color(0x283069);
const _TOD_DUSK_MID = new THREE.Color(0x9b5788);
const _TOD_DUSK_LOW = new THREE.Color(0xff8e63);
const _TOD_DUSK_FOG = new THREE.Color(0x8a6d9c);
const _TOD_DUSK_SUN = new THREE.Color(0xff8a5b);
const _TOD_DUSK_HEMI = new THREE.Color(0xa689e8);

function captureBaseAtmosphere() {
  BASE_ATMOS.skyTop.copy(sky.material.uniforms.top.value);
  BASE_ATMOS.skyMid.copy(sky.material.uniforms.mid.value);
  BASE_ATMOS.skyLow.copy(sky.material.uniforms.low.value);
  BASE_ATMOS.fog.copy(scene.fog.color);
  BASE_ATMOS.sun.copy(sun.color);
  BASE_ATMOS.hemiSky.copy(hemiLight.color);
  BASE_ATMOS.hemiGround.copy(hemiLight.groundColor);
  BASE_ATMOS.sunInt = sun.intensity;
  BASE_ATMOS.hemiInt = hemiLight.intensity;
  BASE_ATMOS.exposure = renderer.toneMappingExposure;
  BASE_ATMOS.activePhaseT = 0;
}

function resetDynamicTimeOfDay() {
  sky.material.uniforms.top.value.copy(BASE_ATMOS.skyTop);
  sky.material.uniforms.mid.value.copy(BASE_ATMOS.skyMid);
  sky.material.uniforms.low.value.copy(BASE_ATMOS.skyLow);
  scene.fog.color.copy(BASE_ATMOS.fog);
  sun.color.copy(BASE_ATMOS.sun);
  hemiLight.color.copy(BASE_ATMOS.hemiSky);
  sun.intensity = BASE_ATMOS.sunInt;
  hemiLight.intensity = BASE_ATMOS.hemiInt;
  BASE_ATMOS.activePhaseT = 0;
}

// GTA 6 Dynamic Time-of-Day: Morning (Hide) -> Golden Hour Sunset (Mid-Hunt) -> Electric Twilight (Final 25s Overdrive)!
function updateDynamicTimeOfDay(dt) {
  const huntLive = (G.phase === 'survive' || G.phase === 'seek') && !G.over && !G.isTutorial;
  const targetP = huntLive
    ? clamp(1 - (G.t || 0) / Math.max(40, G.roundDur || 120), 0, 1)
    : 0;
  const nextP = BASE_ATMOS.activePhaseT + (targetP - BASE_ATMOS.activePhaseT) * Math.min(1, dt * 1.4);
  if (Math.abs(nextP - BASE_ATMOS.activePhaseT) < 0.0004 && nextP === 0) return;
  BASE_ATMOS.activePhaseT = nextP;

  // Stage 1 (0 -> 0.65): blend Morning -> Warm Golden Hour Sunset
  // Stage 2 (0.65 -> 1.0): blend Sunset -> Electric Storybook Twilight Dusk during Hue Overdrive!
  const gT = clamp(nextP / 0.65, 0, 1);
  const dT = clamp((nextP - 0.65) / 0.35, 0, 1);
  sky.material.uniforms.top.value.copy(BASE_ATMOS.skyTop).lerp(_TOD_GOLDEN_TOP, gT * 0.52).lerp(_TOD_DUSK_TOP, dT * 0.58);
  sky.material.uniforms.mid.value.copy(BASE_ATMOS.skyMid).lerp(_TOD_GOLDEN_MID, gT * 0.48).lerp(_TOD_DUSK_MID, dT * 0.52);
  sky.material.uniforms.low.value.copy(BASE_ATMOS.skyLow).lerp(_TOD_GOLDEN_LOW, gT * 0.45).lerp(_TOD_DUSK_LOW, dT * 0.48);
  scene.fog.color.copy(BASE_ATMOS.fog).lerp(_TOD_GOLDEN_FOG, gT * 0.34).lerp(_TOD_DUSK_FOG, dT * 0.38);
  sun.color.copy(BASE_ATMOS.sun).lerp(_TOD_GOLDEN_SUN, gT * 0.48).lerp(_TOD_DUSK_SUN, dT * 0.42);
  hemiLight.color.copy(BASE_ATMOS.hemiSky).lerp(_TOD_DUSK_HEMI, dT * 0.34);
  sun.intensity = BASE_ATMOS.sunInt * (1 - dT * 0.14);
}

function applyMapAtmosphere(def) {
  MAPR = def.mapRadius || 30;
  const sk = def.sky || MEADOW_DEF.sky;
  sky.material.uniforms.top.value.setHex(sk.top);
  sky.material.uniforms.mid.value.setHex(sk.mid);
  sky.material.uniforms.low.value.setHex(sk.bot ?? sk.low ?? 0xf7e6c4);
  SKYCOL.setHex(sk.mid);

  const fg = def.fog || MEADOW_DEF.fog;
  scene.fog.color.setHex(fg.color);
  scene.fog.near = fg.near;
  scene.fog.far = fg.far;

  const lt = def.lights || MEADOW_DEF.lights;
  hemiLight.color.setHex(lt.hemiSky);
  hemiLight.groundColor.setHex(lt.hemiGround);
  hemiLight.intensity = lt.hemiInt;
  sun.color.setHex(lt.sunColor);
  sun.intensity = lt.sunInt;
  if (Array.isArray(lt.sunPos)) sun.position.set(lt.sunPos[0], lt.sunPos[1], lt.sunPos[2]);
  renderer.toneMappingExposure = lt.exposure ?? 1.08;
  captureBaseAtmosphere();
  if (painterlyGfx) painterlyGfx.applyWorldPalette(def.id, def);

  const useMeadowSky = def.id === 'meadow' || !!def.useMeadowSky;
  meadowSkyGroup.visible = useMeadowSky;
  if (useMeadowSky) {
    customSkyCyl.visible = false;
  } else {
    const panoUrl = def.skyPanorama || `assets/maps/${def.id}/sky_panorama.webp`;
    customSkyCyl.position.y = def.skyCylY ?? 52;
    if (customSkyCache[panoUrl]) {
      customSkyMat.map = customSkyCache[panoUrl];
      customSkyMat.needsUpdate = true;
      customSkyCyl.visible = true;
    } else {
      customSkyCyl.visible = false;
      new THREE.TextureLoader().load(panoUrl, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.MirroredRepeatWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.repeat.set(def.skyRepeat ?? 4, 1);
        t.anisotropy = MAX_ANISO;
        t.needsUpdate = true;
        customSkyCache[panoUrl] = t;
        if (activeMapId === def.id) {
          customSkyMat.map = t;
          customSkyMat.needsUpdate = true;
          customSkyCyl.visible = true;
        }
      }, undefined, () => {});
    }
  }
  if (sunGlowSprite) {
    sunGlowSprite.position.copy(sun.position).normalize().multiplyScalar(200);
    sunGlowSprite.material.color.setHex(sk.sunDisc ?? 0xfff5dc);
  }
  restoreWaterBlasterColors(def.id);
  if (elementalGuns && elementalGuns.getCurrentElement() !== 'water') {
    elementalGuns.setFirstPersonElement(elementalGuns.getCurrentElement());
  }
}

function addWorldObb(cx, cz, hx, hz, rot = 0, y0, y1, standable = false) {
  const gy = groundHeightAt(cx, cz);
  const by0 = typeof y0 === 'number' ? y0 : gy - 0.45;
  const by1 = typeof y1 === 'number' ? y1 : gy + 3.4;
  if (Math.abs(rot) < 1e-4) {
    const b = { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, y0: by0, y1: by1, standable: !!standable };
    blockers.push(b);
    return b;
  }
  const c = Math.cos(rot), s2 = Math.sin(rot);
  const ex = Math.abs(hx * c) + Math.abs(hz * s2), ez = Math.abs(hx * s2) + Math.abs(hz * c);
  const b = { x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez, y0: by0, y1: by1, standable: !!standable, obb: { cx, cz, hx, hz, c, s: s2 } };
  blockers.push(b);
  return b;
}

function buildCustomMapWorld(def) {
  const indoorQueue = [];
  const outdoorQueue = [];
  let vigSeq = 0;

  const ctx = {
    THREE,
    root: mapRoot,
    placeKit(g, x = 0, z = 0, rotY = 0, a4 = 0.05, a5 = true, a6) {
      let pad = 0.05, solid = true, yOverride = a6;
      if (arguments.length === 5 && typeof a4 === 'number') {
        yOverride = a4;
      } else {
        if (typeof a4 === 'number') pad = a4;
        if (typeof a5 === 'boolean') solid = a5;
      }
      placeKit(g, x, z, rotY, pad, solid, yOverride);
      const ud = g.userData || {};
      if (ud.rooms && ud.rooms.length) registerEnterable(g);
      if (ud.propSlots && ud.propSlots.length) indoorQueue.push(g);
      return g;
    },
    placeSolid(g, x = 0, z = 0, rotY = 0, scale = 1, pad = 0.05, yOverride) {
      if (scale && scale !== 1) g.scale.setScalar(scale);
      return ctx.placeKit(g, x, z, rotY, pad, true, yOverride);
    },
    block(a0, a1, a2, a3, a4) {
      if (!a0 && a0 !== 0) return;
      if (a0 && a0.isObject3D) { block(a0, a1 || 0); return; }
      if (arguments.length === 3) {
        const r = a2, gy = groundHeightAt(a0, a1);
        blockers.push({ x0: a0 - r, x1: a0 + r, z0: a1 - r, z1: a1 + r, y0: gy - 0.45, y1: gy + 3.4, standable: false });
      } else if (arguments.length >= 4) {
        addWorldObb(a0, a1, a2 * 0.5, a3 * 0.5, a4 || 0);
      }
    },
    blockRotated(a0, a1, a2, a3, a4, a5) {
      if (a0 && a0.isObject3D) blockRotated(a0, a1, a2, a3, a4, a5 || 0);
      else addWorldObb(a0, a1, a2 * 0.5, a3 * 0.5, a4 || 0);
    },
    spot(a0, a1, a2, a3) {
      if (typeof a0 === 'number') addSpot({ x: a0, z: a1 }, a2 ?? 0x8fb57a, a3 || 'spot');
      else if (a0) addSpot(a0, a1 ?? 0x8fb57a, a2 || 'spot');
    },
    registerSpot(a0, a1, a2, a3) { ctx.spot(a0, a1, a2, a3); },
    addSlot(id, x, z, rot = 0, y) {
      if (!KIT.props[id]) return;
      SLOTS.push({ id, x, y: typeof y === 'number' ? y : groundHeightAt(x, z), z, rot, vig: null, real: null, taken: null });
    },
    addVig(a0, a1, a2, a3, a4) {
      let name = `vig_${++vigSeq}`, cx = 0, cz = 0, cy, rot = 0, items = [], openCount = 1;
      if (typeof a0 === 'string') {
        name = a0; cx = a1.x || 0; cz = a1.z || 0; cy = a1.y; rot = a1.rot || 0; items = a2 || []; openCount = a3 ?? 1;
      } else if (Array.isArray(a2)) {
        cx = a0; cz = a1; items = a2; openCount = a3 ?? 1; cy = a4;
      } else if (Array.isArray(a3)) {
        cx = a0; cz = a1; rot = a2; items = a3; openCount = a4 ?? 1;
      }
      outdoorQueue.push({ name, an: anchorAt(cx, cz, rot, cy), items, openCount });
    },
    notify(msg, ms = 2400) {
      if (G.phase !== 'menu' && !G.over) hint(msg, ms);
    },
    scatterRing(count, r0, r1, fn) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(-0.08, 0.08), d = rand(r0, r1);
        const x = Math.sin(a) * d, z = Math.cos(a) * d;
        if (blockedAt(x, z, 1.2)) continue;
        const g = fn(i, a, x, z);
        if (g && g.isObject3D && !g.parent) placeKit(g, x, z, rand(0, 6.28), 0.05, true);
      }
    },
    dirtPath(x0, z0, x1, z1, width = 1.7) {
      dirtPath(x0, z0, x1, z1, width);
    },
    solids,
    blockers,
    realProps,
    addWorldObb(cx, cz, hx, hz, rot = 0, y0, y1, standable = false) {
      return addWorldObb(cx, cz, hx, hz, rot, y0, y1, standable);
    },
    audio,
    groundHeightAt: (x, z, refY) => groundHeightAt(x, z, refY),
    getActors: () => [G.player, ...(G.seekers || []), ...(G.hiders || [])].filter(Boolean),
    getSimSec: () => getMeadowSimSec(simNow() / 1000),
    getG: () => G,
    splash: (pos, n, sc) => splash(pos, n, sc),
    spawnPuff: (pos, n, spd, size, life, up) => puff(pos, n, spd, size, life, up),
    emitSoundCue: (pos, radius, kind = 'chime', src = null) => AI.emitSoundCue(pos, radius, kind, src),
    pushFeed: (icon, html, kind = 'info') => pushFeed(icon, html, kind),
    lineOfSight: (a, b) => lineOfSight(a, b),
    blockedAt: (x, z, R, refY) => blockedAt(x, z, R, refY),
    whereIs: (x, z, refY) => whereIs(x, z, refY),
    centerOf: (ch) => centerOf(ch),
    moveChar: (ch, dx, dz) => moveChar(ch, dx, dz),
    doCharJump: (ch, vy) => doCharJump(ch, vy),
  };

  const handle = def.buildWorld(ctx);
  if (handle && typeof handle.update === 'function') {
    activeWorldUpdate = (dt, t) => handle.update(dt, t, G);
  }
  if (handle && typeof handle.dispose === 'function') {
    activeWorldDispose = () => handle.dispose();
  }
  if (handle && handle.turret) {
    activeWorldTurret = handle.turret;
    if (typeof activeWorldTurret.setAudio === 'function') activeWorldTurret.setAudio(audio);
  }

  // Clear any custom swaying grass blades inside enterable rooms
  mapRoot.traverse((m) => {
    if (m.isInstancedMesh && m.userData && m.userData.isGrassBlades) {
      GRASS_INST = m;
      clearGrassIndoors();
    }
  });

  // Ensure every walkable ground/plaza/bridge surface added directly to mapRoot participates in water raycasts
  const solidSet = new Set(solids);
  mapRoot.traverse((m) => {
    if (m.isMesh && m.userData.ground && !solidSet.has(m)) {
      m.receiveShadow = true;
      solids.push(m);
      solidSet.add(m);
    }
  });

  // Populate indoor propSlots vignettes + 16 outdoor vignettes now that all static colliders are registered
  indoorQueue.forEach((g, idx) => {
    const slots = g.userData.propSlots || [];
    if (!slots.length) return;
    const sc = g.scale.x || 1, an = anchorOf(g);
    const flY = g.userData.floorY ?? 0.36;
    vignette(
      `inside_${g.name || idx}_${idx}`,
      an,
      slots.map((q) => [q.id, q.x * sc, q.z * sc, q.rot || 0, ((q.y ?? flY) * sc)]),
      Math.max(2, Math.round(slots.length * 0.26)),
      0.45
    );
  });
  outdoorQueue.forEach((v) => {
    vignette(v.name, v.an, v.items, v.openCount, 0.72);
  });

  console.log(`[map:${def.id}] ${ENTER.length} enterable buildings · ${LIVE.length} scenes · ${realProps.length} props · ${SLOTS.filter((q) => !q.real && !q.blocked).length} open hiding slots`);
}

let quickPlayAnyMap = true;
function pickQuickPlayMap() {
  const unlocked = MAP_ORDER.filter((m) => !progression || progression.isMapUnlocked(m));
  const pool = unlocked.length ? unlocked : ['meadow'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function updateWorldPickerUI() {
  const grid = $('mapGrid');
  if (grid) {
    grid.querySelectorAll('.map-card').forEach((el) => {
      const mId = el.dataset.map;
      if (mId === 'any') {
        el.classList.toggle('active', Boolean(quickPlayAnyMap));
        el.classList.remove('is-locked');
        el.dataset.reqLevel = '1';
        return;
      }
      const unlocked = !progression || progression.isMapUnlocked(mId);
      const reqLv = progression ? progression.getMapUnlockLevel(mId) : 1;
      el.classList.toggle('active', !quickPlayAnyMap && mId === activeMapId);
      el.classList.toggle('is-locked', !unlocked);
      el.dataset.reqLevel = String(reqLv);
      const lockTag = el.querySelector('.map-lock-tag');
      if (lockTag) {
        lockTag.textContent = `🔒 Lv. ${reqLv}`;
        lockTag.classList.toggle('hidden', unlocked);
      }
    });
  }
  const spBar = $('spiritBar');
  if (spBar) {
    spBar.querySelectorAll('.sp-pill').forEach((el) => {
      el.classList.toggle('active', el.dataset.spirit === selectedSpirit);
    });
  }
  const skBar = $('seekerBar');
  if (skBar) {
    skBar.querySelectorAll('.sp-pill').forEach((el) => {
      el.classList.toggle('active', el.dataset.seeker === selectedSeeker);
    });
  }
  refreshLobbyChampionPreview(false);
  const def = MAP_REGISTRY[activeMapId] || MEADOW_DEF;
  if ($('mapSubtitle')) $('mapSubtitle').textContent = quickPlayAnyMap
    ? '⚡ Unified Quick Play — joins the fastest live 5v5 lobby across all unlocked worlds!'
    : def.subtitle;
  if ($('activeWorldBadge')) $('activeWorldBadge').textContent = quickPlayAnyMap
    ? '⚡ Quick Play · Any Map'
    : `${def.badge} · ${def.title}`;
  if ($('hudWorld')) $('hudWorld').textContent = def.title;
  syncDesktopLobbyCards();
}

function syncDesktopLobbyCards() {
  const def = MAP_REGISTRY[activeMapId] || MEADOW_DEF;
  const wTitle = $('dnwTitle');
  if (wTitle) wTitle.textContent = quickPlayAnyMap ? 'Quick Play' : (MAP_SHORT_TITLES[activeMapId] || def.title);

  const spId = selectedSpirit === 'auto' ? activeMapId : selectedSpirit;
  const spObj = SPIRIT_OPTIONS.find((o) => o.id === spId) || SPIRIT_OPTIONS[1];
  const skObj = SEEKER_OPTIONS.find((o) => o.id === selectedSeeker) || SEEKER_OPTIONS[0];
  const cSub = $('dncSub');
  if (cSub && spObj && skObj) cSub.textContent = `${spObj.label} · ${skObj.label}`;

  const lvTxt = ($('progLevelBadge')?.textContent?.trim() || 'Lv. 1').replace(/^⭐\s*/, '');
  const tokTxt = $('progTokenCount')?.textContent?.trim() || '60';
  const jTitle = $('dnjTitle');
  if (jTitle) jTitle.textContent = lvTxt;
  const profStats = $('deskProfStats');
  if (profStats) profStats.textContent = `${lvTxt} · ${tokTxt} Tokens`;
}

function renderWorldPickerUI() {
  const grid = $('mapGrid');
  if (grid) {
    const quickCard = `<button class="map-card quick-play-card${quickPlayAnyMap ? ' active' : ''}" data-map="any" data-req-level="1" role="option">
      <div class="map-thumb">
        <img src="${MEADOW_DEF.preview}" alt="Quick Play Any Map" loading="eager">
        <span class="map-badge">Fastest Match</span>
      </div>
      <span class="map-name">⚡ Quick Play</span>
    </button>`;
    grid.innerHTML = quickCard + MAP_ORDER.map((id) => {
      const d = MAP_REGISTRY[id] || MEADOW_DEF;
      const shortName = MAP_SHORT_TITLES[id] || d.title;
      const unlocked = !progression || progression.isMapUnlocked(id);
      const reqLv = progression ? progression.getMapUnlockLevel(id) : 1;
      return `<button class="map-card${!quickPlayAnyMap && id === activeMapId ? ' active' : ''}${unlocked ? '' : ' is-locked'}" data-map="${id}" data-req-level="${reqLv}" role="option">
        <div class="map-thumb">
          <img src="${d.preview}" alt="${d.title}" loading="eager">
          <span class="map-badge">${d.badge}</span>
          <span class="map-lock-tag${unlocked ? ' hidden' : ''}">🔒 Lv. ${reqLv}</span>
        </div>
        <span class="map-name">${shortName}</span>
      </button>`;
    }).join('');
    if (!grid.dataset.wired) {
      grid.dataset.wired = '1';
      grid.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.map-card');
      if (!card) return;
      e.stopPropagation(); sfx.unlock();
      const targetMap = card.dataset.map;
      if (targetMap === 'any') {
        quickPlayAnyMap = true;
        audio.tap();
        $('title')?.classList.remove('world-modal-open');
        updateWorldPickerUI();
        if (mobileLobby) mobileLobby.refresh();
        return;
      }
      if (progression && !progression.isMapUnlocked(targetMap)) {
        audio.wrong();
        card.classList.remove('locked-shake');
        void card.offsetWidth;
        card.classList.add('locked-shake');
        progression.notifyLockedMap(targetMap, MAP_REGISTRY[targetMap]?.title);
        return;
      }
      quickPlayAnyMap = false;
      audio.tap();
      $('title')?.classList.remove('world-modal-open');
      if (analytics) analytics.track('world_select', { map: targetMap });
      selectMap(targetMap);
      });
    }
  }
  const spBar = $('spiritBar');
  if (spBar) {
    spBar.innerHTML = SPIRIT_OPTIONS.map((sp) =>
      `<button class="sp-pill${sp.id === selectedSpirit ? ' active' : ''}" data-spirit="${sp.id}" role="option">${sp.icon} ${sp.label}</button>`
    ).join('');
    if (!spBar.dataset.wired) {
      spBar.dataset.wired = '1';
      spBar.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.sp-pill');
        if (!btn) return;
        e.stopPropagation(); sfx.unlock(); audio.tap();
        selectedSpirit = btn.dataset.spirit;
        try { localStorage.setItem('hs_selected_spirit', selectedSpirit); } catch (_) {}
        lobbyPreviewRole = 'spirit';
        updateWorldPickerUI();
        refreshLobbyChampionPreview(true);
      });
    }
  }
  const skBar = $('seekerBar');
  if (skBar) {
    skBar.innerHTML = SEEKER_OPTIONS.map((sk) =>
      `<button class="sp-pill${sk.id === selectedSeeker ? ' active' : ''}" data-seeker="${sk.id}" role="option">${sk.icon} ${sk.label}</button>`
    ).join('');
    if (!skBar.dataset.wired) {
      skBar.dataset.wired = '1';
      skBar.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.sp-pill');
        if (!btn) return;
        e.stopPropagation(); sfx.unlock(); audio.tap();
        selectedSeeker = btn.dataset.seeker;
        try { localStorage.setItem('hs_selected_seeker', selectedSeeker); } catch (_) {}
        lobbyPreviewRole = 'seeker';
        updateWorldPickerUI();
        refreshLobbyChampionPreview(true);
      });
    }
  }
  updateWorldPickerUI();
}

// ============================================================ Live 3D Champion Stage in Lobby (v8.3.0)
function ensureLobbyPreviewGroup() {
  if (lobbyPreviewGroup) return lobbyPreviewGroup;
  lobbyPreviewGroup = new THREE.Group();
  lobbyPreviewGroup.name = 'LobbyChampionPreview';
  // Subtle warm sunlit stone-and-moss pedestal disc beneath the featured 3D champion
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.54, 0.11, 24),
    new THREE.MeshStandardMaterial({ color: 0xcab58f, roughness: 0.88, metalness: 0.0 })
  );
  ped.position.y = -0.055;
  ped.receiveShadow = true;
  const mossRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.47, 0.04, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0x67a143, roughness: 0.84 })
  );
  mossRim.rotation.x = Math.PI * 0.5;
  mossRim.position.y = -0.01;
  lobbyPreviewGroup.add(ped, mossRim);
  lobbyPreviewGroup.visible = false;
  scene.add(lobbyPreviewGroup);
  return lobbyPreviewGroup;
}

function refreshLobbyChampionPreview(animatePop = false) {
  const isSeekerPreview = lobbyPreviewRole === 'seeker';
  const spKey = selectedSpirit === 'auto' ? activeMapId : selectedSpirit;
  const sig = isSeekerPreview ? `seeker:${selectedSeeker}` : `spirit:${spKey}`;
  const glbKey = isSeekerPreview ? `char_seeker_${selectedSeeker}` : `char_spirit_${spKey}`;
  if (!HERO_GLB_CACHE[glbKey]) return;
  const grp = ensureLobbyPreviewGroup();
  if (sig === lobbyPreviewSig && lobbyPreviewChar) {
    if (animatePop) lobbyPreviewSpinT = 0.42;
    return;
  }
  if (lobbyPreviewChar) {
    grp.remove(lobbyPreviewChar);
    lobbyPreviewChar = null;
  }
  const ch = buildBlenderChampionCharacter(isSeekerPreview, isSeekerPreview ? { kind: selectedSeeker } : { spiritMap: spKey });
  if (!ch) return;
  ch.position.set(0, 0, 0);
  // Slightly scale up Spirits so both Hider & Seeker champions feel heroically framed on the pedestal!
  const sc = isSeekerPreview ? 0.92 : 1.18;
  ch.scale.setScalar(sc);
  ch.userData._previewBaseScale = sc;
  grp.add(ch);
  lobbyPreviewChar = ch;
  lobbyPreviewSig = sig;
  lobbyPreviewSpinT = animatePop ? 0.45 : 0.22;
}

const _lpForward = new THREE.Vector3();
const _lpRight = new THREE.Vector3();
const _lpUp = new THREE.Vector3();
function updateLobbyChampionPreview(dt, now) {
  if (!lobbyPreviewGroup && (G.phase === 'menu' || G.phase === 'charselect')) refreshLobbyChampionPreview(false);
  if (!lobbyPreviewGroup) return;
  const inCharSelect = G.phase === 'charselect' && charSelectOpen;
  const show = (G.phase === 'menu' || inCharSelect) && READY && !!lobbyPreviewChar;
  lobbyPreviewGroup.visible = show;
  if (!show) return;

  const isSeekerNow = lobbyPreviewRole === 'seeker';
  let popSpin = 0;
  let popScale = 1;
  if (lobbyPreviewSpinT > 0) {
    lobbyPreviewSpinT = Math.max(0, lobbyPreviewSpinT - dt);
    const p = 1 - lobbyPreviewSpinT / 0.45;
    popSpin = (1 - p) * (1 - p) * Math.PI * 1.4;
    popScale = 1 + Math.sin(p * Math.PI) * 0.14;
  }

  if (inCharSelect) {
    // Eye-level sunlit hero showcase right in the open center of the world — always facing straight forward!
    const px = 1.15, pz = 5.35;
    const py = groundHeightAt(px, pz) + 0.14;
    lobbyPreviewGroup.position.set(px, py, pz);
    const idleSway = charSelectUserYaw + (charSelectDragging ? 0 : Math.sin(now * 0.0011) * 0.12);
    lobbyPreviewGroup.rotation.set(0, idleSway, 0);
    if (lobbyPreviewChar) {
      const bs = isSeekerNow ? 0.94 : 1.16;
      lobbyPreviewChar.scale.setScalar(bs * popScale);
      if (lobbyPreviewChar.userData.animate) lobbyPreviewChar.userData.animate(dt, false, 0);
    }
    return;
  }

  // Frame the live 3D champion cleanly in the open right-midground beside the centered crest & play dock
  camera.updateMatrixWorld();
  camera.getWorldDirection(_lpForward);
  _lpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _lpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const aspect = Math.max(0.75, camera.aspect || 1.77);
  const rightOff = aspect > 1.35 ? 2.15 : 1.15;
  const downOff = aspect > 1.35 ? 0.14 : 0.45;
  const dist = aspect > 1.35 ? 5.45 : 5.25;
  lobbyPreviewGroup.position.copy(camera.position)
    .addScaledVector(_lpForward, dist)
    .addScaledVector(_lpRight, rightOff)
    .addScaledVector(_lpUp, -downOff);

  const faceYaw = Math.atan2(camera.position.x - lobbyPreviewGroup.position.x, camera.position.z - lobbyPreviewGroup.position.z);
  lobbyPreviewGroup.rotation.set(0, faceYaw - 0.22 + Math.sin(now * 0.0011) * 0.22 + popSpin, 0);
  if (lobbyPreviewChar) {
    const bs = lobbyPreviewChar.userData._previewBaseScale || 1;
    lobbyPreviewChar.scale.setScalar(bs * popScale);
    if (lobbyPreviewChar.userData.animate) lobbyPreviewChar.userData.animate(dt, false, 0);
  }
}

function renderCharSelectUI() {
  const grid = $('csGrid');
  if (!grid) return;
  const isSeekerTab = lobbyPreviewRole === 'seeker';
  const tabH = $('csTabHider');
  const tabS = $('csTabSeeker');
  if (tabH) tabH.classList.toggle('active', !isSeekerTab);
  if (tabS) tabS.classList.toggle('active', isSeekerTab);

  const list = isSeekerTab ? SEEKER_OPTIONS : SPIRIT_OPTIONS.filter((o) => o.id !== 'auto');
  const activeId = isSeekerTab
    ? selectedSeeker
    : (selectedSpirit === 'auto' ? activeMapId : selectedSpirit);

  grid.innerHTML = list.map((item) => `
    <button class="cs-card${item.id === activeId ? ' active' : ''}" data-char-id="${item.id}" type="button" role="option">
      <span class="cs-card-ic">${item.icon}</span>
      <span class="cs-card-txt">
        <b>${item.label}</b>
        <small>${item.role || ''}</small>
      </span>
    </button>
  `).join('');

  const cur = list.find((o) => o.id === activeId) || list[0];
  if (cur) {
    if ($('csCharName')) $('csCharName').textContent = `${cur.icon} ${cur.label}`;
    if ($('csCharRole')) $('csCharRole').textContent = cur.role || (isSeekerTab ? 'Explorer Seeker' : 'Forest Spirit');
    if ($('csCharDesc')) $('csCharDesc').textContent = cur.desc || '';
  }
}

function openCharacterSelect(initialRole) {
  if (analytics) analytics.screen('characters');
  if (initialRole === 'seeker' || initialRole === 'spirit') lobbyPreviewRole = initialRole;
  charSelectOpen = true;
  charSelectUserYaw = 0;
  G.phase = 'charselect';
  $('title')?.classList.remove('on');
  $('charSelectScreen')?.classList.add('on');
  renderCharSelectUI();
  refreshLobbyChampionPreview(true);
}

function closeCharacterSelect() {
  charSelectOpen = false;
  charSelectDragging = false;
  $('charSelectScreen')?.classList.remove('on');
  if (G.phase === 'charselect') {
    G.phase = 'menu';
    $('title')?.classList.add('on');
  }
  updateWorldPickerUI();
  if (mobileLobby) mobileLobby.refresh();
}

function wireCharacterSelectUI() {
  const openBtn = $('btnDesktopChars');
  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = '1';
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.unlock(); audio.tap();
      openCharacterSelect();
    });
  }
  const titleEl = $('title');
  const worldBtn = $('btnDesktopWorldPicker');
  if (worldBtn && !worldBtn.dataset.wired) {
    worldBtn.dataset.wired = '1';
    worldBtn.addEventListener('click', (e) => {
      e.stopPropagation(); sfx.unlock(); audio.tap();
      titleEl?.classList.remove('desk-menu-open');
      $('btnDesktopMenu')?.setAttribute('aria-expanded', 'false');
      titleEl?.classList.toggle('world-modal-open');
    });
  }
  const closeWorldBtn = $('btnCloseWorldPicker');
  const worldBackdrop = $('worldPickerBackdrop');
  for (const el of [closeWorldBtn, worldBackdrop]) {
    if (el && !el.dataset.wired) {
      el.dataset.wired = '1';
      el.addEventListener('click', (e) => {
        e.stopPropagation(); audio.tap();
        titleEl?.classList.remove('world-modal-open');
      });
    }
  }
  const champCard = $('btnDesktopChampCard');
  if (champCard && !champCard.dataset.wired) {
    champCard.dataset.wired = '1';
    champCard.addEventListener('click', (e) => {
      e.stopPropagation(); sfx.unlock(); audio.tap();
      titleEl?.classList.remove('world-modal-open', 'desk-menu-open');
      openCharacterSelect();
    });
  }
  const journeyCard = $('btnDesktopJourneyCard');
  if (journeyCard && !journeyCard.dataset.wired) {
    journeyCard.dataset.wired = '1';
    journeyCard.addEventListener('click', (e) => {
      e.stopPropagation(); sfx.unlock(); audio.tap();
      titleEl?.classList.remove('world-modal-open', 'desk-menu-open');
      $('btnOpenWardrobe')?.click();
    });
  }
  const menuBtn = $('btnDesktopMenu');
  if (menuBtn && !menuBtn.dataset.wired) {
    menuBtn.dataset.wired = '1';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation(); sfx.unlock(); audio.tap();
      titleEl?.classList.remove('world-modal-open');
      const isOpen = titleEl?.classList.toggle('desk-menu-open');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!titleEl?.classList.contains('desk-menu-open')) return;
      if (e.target.closest('#btnDesktopMenu, #btnTitleTutorial, #btnTitleQuality, #btnTitleFpsCap, #btnTitleQuickSettings, #mobQuickSettings')) return;
      titleEl.classList.remove('desk-menu-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && titleEl) {
        titleEl.classList.remove('world-modal-open', 'desk-menu-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
  const progStripEl = $('progStrip');
  if (progStripEl && !progStripEl.dataset.deskObs && typeof MutationObserver !== 'undefined') {
    progStripEl.dataset.deskObs = '1';
    new MutationObserver(() => syncDesktopLobbyCards()).observe(progStripEl, {
      subtree: true, characterData: true, childList: true
    });
  }
  syncDesktopLobbyCards();
  const closeBtn = $('btnCloseCharSelect');
  if (closeBtn && !closeBtn.dataset.wired) {
    closeBtn.dataset.wired = '1';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); audio.tap(); closeCharacterSelect(); });
  }
  const doneBtn = $('btnEquipCharDone');
  if (doneBtn && !doneBtn.dataset.wired) {
    doneBtn.dataset.wired = '1';
    doneBtn.addEventListener('click', (e) => { e.stopPropagation(); audio.tap(); closeCharacterSelect(); });
  }
  for (const tabId of ['csTabHider', 'csTabSeeker']) {
    const tab = $(tabId);
    if (tab && !tab.dataset.wired) {
      tab.dataset.wired = '1';
      tab.addEventListener('click', (e) => {
        e.stopPropagation(); sfx.unlock(); audio.tap();
        lobbyPreviewRole = tab.dataset.role === 'seeker' ? 'seeker' : 'spirit';
        charSelectUserYaw = 0;
        renderCharSelectUI();
        refreshLobbyChampionPreview(true);
      });
    }
  }
  const grid = $('csGrid');
  if (grid && !grid.dataset.wired) {
    grid.dataset.wired = '1';
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.cs-card');
      if (!card) return;
      e.stopPropagation(); sfx.unlock(); audio.tap();
      const cid = card.dataset.charId;
      if (lobbyPreviewRole === 'seeker') {
        selectedSeeker = cid;
        try { localStorage.setItem('hs_selected_seeker', selectedSeeker); } catch (_) {}
        if (analytics) analytics.track('character_select', { role: 'seeker', id: cid });
      } else {
        selectedSpirit = cid;
        try { localStorage.setItem('hs_selected_spirit', selectedSpirit); } catch (_) {}
        if (analytics) analytics.track('character_select', { role: 'spirit', id: cid });
      }
      charSelectUserYaw = 0;
      renderCharSelectUI();
      updateWorldPickerUI();
      refreshLobbyChampionPreview(true);
      if (mobileLobby) mobileLobby.refresh();
    });
  }
  const stage = $('csDragStage');
  if (stage && !stage.dataset.wired) {
    stage.dataset.wired = '1';
    stage.addEventListener('pointerdown', (e) => {
      charSelectDragging = true;
      charSelectLastX = e.clientX;
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    });
    stage.addEventListener('pointermove', (e) => {
      if (!charSelectDragging) return;
      const dx = e.clientX - charSelectLastX;
      charSelectLastX = e.clientX;
      charSelectUserYaw += dx * 0.012;
    });
    const endDrag = () => { charSelectDragging = false; };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
  }
}

function buildMeadowExpansionStatic() {
  const queueVig = (name, an, items, openCount) => {
    meadowExpansion.vigQueue.push({
      name,
      an: { x: an.x || 0, y: an.y, z: an.z || 0, rot: an.rot || 0, b: null },
      items: items || [],
      openCount,
    });
  };

  meadowExpansion.underground = buildUndergroundWorld(THREE, {
    mapRoot,
    solids,
    blockers,
    addSpot,
    addVig: queueVig,
  });

  meadowExpansion.features = buildMeadowFeatures(THREE, {
    mapRoot,
    solids,
    blockers,
    addSpot,
    addVig: queueVig,
    audio,
    onDinnerBell: () => {
      if (meadowExpansion.animals) {
        meadowExpansion.animals.triggerStampede(
          getMeadowSimSec(simNow() / 1000),
          (G.player || camera).position
        );
      }
    },
  });

  meadowExpansion.habitats = buildAnimalHabitats(THREE, {
    getGroundY: (x, z) => groundHeightAt(x, z, 0),
  });
  if (meadowExpansion.habitats && meadowExpansion.habitats.group) {
    mapRoot.add(meadowExpansion.habitats.group);
    meadowExpansion.habitats.group.traverse((m) => {
      if (m.isMesh && !m.userData.noSolid) {
        solids.push(m);
      }
    });
    for (const c of meadowExpansion.habitats.colliders || []) {
      addWorldObb(c.x, c.z, c.w * 0.5, c.d * 0.5, c.rot || 0, c.y0, c.y1, c.standable);
    }
  }

  // Cosy dirt trails connecting the expanded outer habitats, orchard, treehouse & cellar stairs
  dirtPath(21.5, 1.5, 25.8, 3.0, 1.55);      // Village East -> Sunny Pasture Gate
  dirtPath(19.0, -16.8, 17.6, -19.8, 1.45);  // Barn -> Chicken Coop Yard
  dirtPath(24.0, -14.0, 27.6, -13.6, 1.45);  // Barn -> Muddy Pigpen Gate
  dirtPath(-2.2, 22.0, -3.2, 26.8, 1.55);    // South Village -> Apple Orchard & Apiary
  dirtPath(-19.5, 9.2, -24.1, 10.6, 1.45);   // West Village -> Elder Oak Treehouse Ramp
  dirtPath(6.8, -7.8, 8.8, -8.8, 1.40);      // Plaza East -> Barn Cheese Cellar Stairs

  meadowExpansion.interactSpots = [
    ...(meadowExpansion.underground?.interactSpots || []),
    ...(meadowExpansion.features?.interactSpots || []),
  ];
}

function materializeMeadowExpansionPropsAndAnimals() {
  for (const v of meadowExpansion.vigQueue) {
    vignette(v.name, v.an, v.items, v.openCount, 0.70);
  }
  meadowExpansion.vigQueue.length = 0;

  // Cosy farm-edge prop vignettes right beside the new outer habitats so static props & animals mingle naturally
  vignette('pasture_gate_dairy', anchorAt(25.2, 0.2, -0.35, 0), [
    ['milk_can', -0.55, 0, 0.1],
    ['milk_can', 0.15, 0.08, 0.6],
    ['bucket', 0.78, -0.1, 0.3],
    ['hay_round', -1.55, -0.4, 0.4],
  ], 1, 0.70);
  vignette('coop_feed_corner', anchorAt(14.5, -20.6, 0.45, 0), [
    ['chicken_crate', -0.5, 0, 0.1],
    ['grain_sack', 0.38, 0.12, 0.5],
    ['bucket', 0.95, -0.15, 0.2],
  ], 1, 0.70);
  vignette('pigpen_slop_corner', anchorAt(26.9, -11.2, -0.5, 0), [
    ['bucket', -0.4, 0, 0.2],
    ['pumpkin', 0.3, 0.15, 0.7],
    ['pumpkin', 0.85, -0.1, -0.4],
  ], 1, 0.70);

  meadowExpansion.animals = createMeadowAnimalsSystem(THREE, {
    mapRoot,
    realProps,
    blockers,
    solids,
    getGroundY: (x, z) => groundHeightAt(x, z, 0),
    getActors: () => [G.player, ...(G.seekers || []), ...(G.hiders || [])].filter(Boolean),
    audio,
  });
  if (meadowExpansion.animals) {
    meadowExpansion.animals.update(0.016, getMeadowSimSec(simNow() / 1000));
  }

  activeWorldUpdate = (dt, rawSec) => {
    const simSec = getMeadowSimSec(rawSec);
    if (meadowExpansion.animals) {
      meadowExpansion.animals.update(dt, simSec);
    }
    const focusChar = (G.spectating && G.specTarget) ? G.specTarget : G.player;
    const footY = focusChar
      ? (focusChar.userData?.groundY ?? focusChar.position.y ?? 0) + (focusChar.userData?.jy || 0)
      : camera.position.y;
    if (meadowExpansion.underground) {
      meadowExpansion.underground.update(dt, rawSec, camera, footY);
    }
    if (meadowExpansion.features) {
      meadowExpansion.features.update(dt, rawSec);
      const patches = elementalGuns && elementalGuns.getActivePatches ? elementalGuns.getActivePatches() : null;
      if (patches && patches.length) {
        checkFirePopHaystacks(patches, exitSpecialSpot, (msg, ms) => {
          if (G.player && !G.spectating && G.phase !== 'menu' && !G.over) hint(msg, ms || 2200);
        });
      }
    }
  };
}

// selectMap builds a world synchronously (map switches, party sync, tests). selectMapStaged runs the very
// same steps but hands the frame back to the browser whenever ~12 ms have passed, so the first build at
// app launch no longer freezes the lobby; while it runs the game loop skips updates/rendering (the
// canvas keeps its last frame) and other selectMap calls are queued until it finishes.
let WORLD_BUILDING = false;
let _queuedMapSelect = null;
function selectMap(mapId, opts = {}) {
  if (WORLD_BUILDING) { _queuedMapSelect = [mapId, opts]; return MAP_REGISTRY[mapId] || MAP_REGISTRY.meadow; }
  const it = selectMapSteps(mapId, opts);
  let r;
  while (!(r = it.next()).done);
  return r.value;
}
async function selectMapStaged(mapId, opts = {}) {
  WORLD_BUILDING = true;
  let def;
  try {
    const it = selectMapSteps(mapId, opts);
    let r, t = performance.now();
    while (!(r = it.next()).done) {
      if (performance.now() - t > 12) { await nextFrame(); t = performance.now(); }
    }
    def = r.value;
  } finally {
    WORLD_BUILDING = false;
  }
  if (_queuedMapSelect) { const [m, o] = _queuedMapSelect; _queuedMapSelect = null; def = selectMap(m, o); }
  return def;
}
function* selectMapSteps(mapId, opts = {}) {
  let id = MAP_REGISTRY[mapId] ? mapId : 'meadow';
  if (!opts.allowGuest && id !== 'tutorial' && progression && !progression.isMapUnlocked(id)) {
    progression.notifyLockedMap(id, MAP_REGISTRY[id]?.title);
    const fallback = progression.isMapUnlocked(activeMapId) ? activeMapId : 'meadow';
    if (fallback === activeMapId && mapRoot.children.length > 0) {
      updateWorldPickerUI();
      return MAP_REGISTRY[fallback];
    }
    id = fallback;
  }
  activeMapId = id;
  const def = MAP_REGISTRY[id];
  ACTIVE_MAP = def;
  clearWorld();
  applyMapAtmosphere(def);
  if (mobilePerf && mobilePerf.notifyMapLoad) mobilePerf.notifyMapLoad(3.5);
  if (id === 'meadow') {
    buildMeadowGround();
    yield;
    yield* buildStructuresSteps(KIT && KIT.buildings ? KIT : null);
    buildMeadowExpansionStatic();
    yield;
    layoutProps();
    yield;
    materializeMeadowExpansionPropsAndAnimals();
    finishSpots();
    clearGrassIndoors();
  } else {
    buildCustomMapWorld(def);
    yield;
    finishSpots();
  }
  yield;
  if (id !== 'tutorial') {
    worldOptimizer.optimizeWorldScene({
      mapRoot,
      solids,
      ENTER,
      realProps,
      activeWorldUpdate,
      extraDynamicRoots: [windmillSails, laundryCloth],
      groundHeightAt,
      isMobile: mobilePerf ? mobilePerf.isMobile : isTouch,
      shadowExtent: 42,
    });
  }
  if (painterlyGfx) painterlyGfx.upgradeSceneGroup(mapRoot);
  if (tier1Visuals) {
    // Pass every enterable building's padded bounding box so zero tree leaves can EVER spawn inside a house or porch!
    const excludeBoxes = [];
    for (const ent of ENTER) {
      if (!ent?.g) continue;
      ent.g.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(ent.g);
      if (!bb.isEmpty()) excludeBoxes.push(bb);
    }
    tier1Visuals.enhanceWorldTrees(mapRoot, id, null, { excludeBoxes });
    tier1Visuals.enhanceWorldWater(mapRoot, id);
  }
  sun.shadow.needsUpdate = true;
  _blockerGridLen = -1;
  AI.resetMatchIntel(true);
  scheduleBVH(G.phase !== 'menu');
  warmupMatchPipeline();
  updateWorldPickerUI();
  if (!opts.fromPartySync && id !== 'tutorial' && MP && MP.partyCode && MP.isPartyHost) {
    MP.setPartyMap(id);
  }
  return def;
}

const nextFrame = () => new Promise((r) => {
  let done = false;
  const go = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(go);
  setTimeout(go, 24);
});

const HERO_GLB_CACHE = {};
const HERO_GLB_MANIFEST = [
  ['barrel', 'assets/models/prop_barrel.glb'],
  ['crate', 'assets/models/prop_crate.glb'],
  ['pumpkin', 'assets/models/prop_pumpkin.glb'],
  ['flower_pot', 'assets/models/prop_flower_pot.glb'],
  ['lantern_post', 'assets/models/prop_lantern_post.glb'],
  ['mailbox', 'assets/models/prop_mailbox.glb'],
  ['milk_can', 'assets/models/prop_milk_can.glb'],
  ['watering_can', 'assets/models/prop_watering_can.glb'],
  ['stool', 'assets/models/prop_stool.glb'],
  ['bucket', 'assets/models/prop_bucket.glb'],
  ['plaza_well', 'assets/models/plaza_well.glb'],
  ['market_stall', 'assets/models/market_stall.glb'],
  // v8.2.0: 11 Champion-Tier Hand-Painted Storybook Characters (6 Hider Spirits + 5 Explorer Seekers)
  ['char_spirit_meadow', 'assets/models/char_spirit_meadow.glb'],
  ['char_spirit_bathhouse', 'assets/models/char_spirit_bathhouse.glb'],
  ['char_spirit_skyruins', 'assets/models/char_spirit_skyruins.glb'],
  ['char_spirit_seaplane', 'assets/models/char_spirit_seaplane.glb'],
  ['char_spirit_clockwork', 'assets/models/char_spirit_clockwork.glb'],
  ['char_spirit_tinyfolk', 'assets/models/char_spirit_tinyfolk.glb'],
  ['char_seeker_ranger', 'assets/models/char_seeker_ranger.glb'],
  ['char_seeker_botanist', 'assets/models/char_seeker_botanist.glb'],
  ['char_seeker_aviator', 'assets/models/char_seeker_aviator.glb'],
  ['char_seeker_lantern', 'assets/models/char_seeker_lantern.glb'],
  ['char_seeker_detective', 'assets/models/char_seeker_detective.glb'],
];

function cloneHeroGlb(key, opts = {}) {
  const src = HERO_GLB_CACHE[key];
  if (!src) return null;
  const grp = src.clone(true);
  if (opts.tintMat) {
    grp.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      let replaced = false;
      const next = mats.map((mt) => {
        if (mt && opts.tintMat[mt.name] !== undefined) {
          replaced = true;
          const cm = mt.clone();
          cm.color.setHex(opts.tintMat[mt.name]);
          if (painterlyGfx) painterlyGfx.upgradeMaterialToPainterly(cm);
          return cm;
        }
        return mt;
      });
      if (replaced) m.material = Array.isArray(m.material) ? next : next[0];
    });
  }
  return grp;
}

async function preloadBlenderHeroModels() {
  if (!nextGenAssets) return 0;
  let loaded = 0;
  await Promise.all(HERO_GLB_MANIFEST.map(async ([key, url]) => {
    try {
      const res = await nextGenAssets.loadHeroModel(url);
      const root = res && (res.scene || res.group);
      if (!root) return;
      root.traverse((m) => {
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
      });
      if (painterlyGfx) {
        const isChar = key.startsWith('char_');
        painterlyGfx.upgradeSceneGroup(root, isChar
          ? { rimMul: 1.25, cloudMul: 0.35, macroMul: 0.0 }
          : { rimMul: 0.9, cloudMul: 0.65, macroMul: 0.0 });
      }
      HERO_GLB_CACHE[key] = root;
      loaded++;
    } catch (_) {
      // Graceful fallback to procedural kit.js prop
    }
  }));
  // Wire Blender-sculpted props directly into KIT.props builders!
  if (KIT && KIT.props) {
    for (const [key] of HERO_GLB_MANIFEST) {
      if (HERO_GLB_CACHE[key] && KIT.props[key]) {
        const kCopy = key;
        KIT.props[key].build = () => cloneHeroGlb(kCopy);
      }
    }
  }
  return loaded;
}

async function initAll() {
  const v = MODULE_V;
  const [k] = await Promise.all([
    loadKit(),
    loadVillage(),
  ]);
  KIT = k;
  await preloadBlenderHeroModels();
  wireCharacterSelectUI();
  refreshLobbyChampionPreview(false);
  syncOfflineNoticeUI();
  const normalizeKitPropHp = () => {
    if (!KIT || !KIT.props) return;
    for (const def of Object.values(KIT.props)) {
      if (def && !def._hpScaled) {
        if (typeof def.hp === 'number') {
          def.hp = Math.round(clamp(def.hp * 1.45, 95, 205));
        } else {
          // Volume-based prop HP & speed scaling across all 6 worlds (tiny = agile glass cannon, large = tanky)
          const r = Number(def.radius) || 0.45;
          const h = Number(def.height) || 0.9;
          const vol = clamp(r * r * h, 0.04, 1.2);
          const t = clamp((vol - 0.06) / 0.65, 0, 1);
          def.hp = Math.round(lerp(100, 195, t));
          if (typeof def.speed !== 'number' && !def.canFly) {
            def.speed = +lerp(1.09, 0.91, t).toFixed(2);
          }
        }
        def._hpScaled = true;
      }
    }
  };
  normalizeKitPropHp();
  await nextFrame();

  const customMods = (await Promise.all([
    `./maps/bathhouse/map.js?v=${v}`,
    `./maps/skyruins/map.js?v=${v}`,
    `./maps/seaplane/map.js?v=${v}`,
    `./maps/clockwork/map.js?v=${v}`,
    `./maps/tinyfolk/map.js?v=${v}`,
    `./maps/tutorial/map.js?v=${v}`,
  ].map((url) => import(url).catch((err) => {
    console.error(`[map] failed to load ${url}:`, err);
    return null;
  })))).filter(Boolean);

  // Register Meadowbrook Village expansion props (7 living disguisable farm animals + 3 root-cellar props + 2 orchard props)
  {
    const mbBuilders = Object.assign(
      {},
      buildAnimalPropBuilders(THREE),
      buildUndergroundPropBuilders(THREE),
      buildFeaturePropBuilders(THREE)
    );
    for (const p of [...ANIMAL_PROP_DEFS, ...UNDERGROUND_PROP_DEFS, ...FEATURE_PROP_DEFS]) {
      const fn = mbBuilders[p.id];
      if (!fn) continue;
      KIT.props[p.id] = {
        label: p.label,
        radius: p.radius || 0.44,
        height: p.height || 0.85,
        hp: p.hp || 160,
        speed: p.speed || 1.0,
        isAnimal: !!p.isAnimal,
        canFly: !!p.canFly,
        _hpScaled: (p.hp || 0) >= 135,
        build: () => fn(THREE),
      };
    }
    Object.assign(PROP_ICON, ANIMAL_PROP_ICONS, UNDERGROUND_PROP_ICONS, FEATURE_PROP_ICONS);
    for (const rId of ['mb_cheese_wheel', 'mb_cider_cask', 'mb_glow_shroom_pot', 'mb_beehive', 'mb_apple_basket']) {
      ROUND_PROPS.add(rId);
    }
    normalizeKitPropHp();
  }

  // Register all 5 new Storybook maps and their 60 custom 3D props into KIT.props & PROP_ICON
  const roundNew = [
    'bh_hinoki_tub', 'bh_sake_cask', 'bh_steamer_stack', 'bh_tea_table', 'bh_daruma_doll', 'bh_coal_scuttle',
    'sr_levitation_urn', 'sr_cloud_planter', 'sr_propeller_barrel', 'sr_crystal_lantern',
    'sp_olive_amphora', 'sp_anchor_bollard', 'sp_lemon_planter', 'sp_rope_coil', 'sp_wine_cask',
    'cw_hatbox_stack', 'cw_brass_orrery', 'cw_steam_samovar', 'cw_pastry_tier',
    'bw_thimble_stool', 'bw_spool_table', 'bw_button_stack', 'bw_inkwell_pot',
  ];
  roundNew.forEach((id) => ROUND_PROPS.add(id));

  for (const mod of customMods) {
    const def = mod && mod.MAP_DEF;
    if (!def) continue;
    MAP_REGISTRY[def.id] = def;
    const builders = def.buildProps(THREE);
    for (const p of def.props || []) {
      const fn = builders[p.id];
      if (!fn) continue;
      KIT.props[p.id] = {
        label: p.label,
        radius: p.radius || 0.46,
        height: p.height || 0.95,
        hp: p.hp || 100,
        speed: p.speed || 1,
        isAnimal: !!p.isAnimal,
        canFly: !!p.canFly,
        flyMaxY: p.flyMaxY,
        flapIntervalMs: p.flapIntervalMs,
        flapPitch: p.flapPitch,
        _hpScaled: !!p._hpScaled,
        build: () => fn(THREE),
      };
      if (p.icon) PROP_ICON[p.id] = p.icon;
    }
    if (def.propIcons) Object.assign(PROP_ICON, def.propIcons);
    normalizeKitPropHp();
    await nextFrame();
  }

  renderWorldPickerUI();
  const params = new URLSearchParams(location.search);
  const urlMap = params.get('map');
  const urlAllowGuest = params.get('unlock') === '1';
  await selectMapStaged(urlMap && MAP_REGISTRY[urlMap] ? urlMap : 'meadow', { allowGuest: urlAllowGuest });
  if (tutorial) tutorial.syncLobbyBadges();
  if (mobileLobby) mobileLobby.refresh();
  READY = true;
  { const bg = $('worldLoadingBg'); if (bg) { requestAnimationFrame(() => requestAnimationFrame(() => { bg.classList.add('done'); setTimeout(() => bg.remove(), 900); })); } }
  if (MP && typeof MP.checkUrlPartyInvite === 'function') {
    MP.checkUrlPartyInvite();
  }
}
initAll().catch((err) => {
  console.error('[initAll] fatal startup error:', err);
  try { renderWorldPickerUI(); } catch {}
  try { selectMap('meadow', { allowGuest: true }); } catch {}
  READY = true;
  try { $('worldLoadingBg')?.remove(); } catch {}
});

let pendingBvhList = [];
let bvhRafId = 0;
let _shaderWarmed = false;

// The AI map caches (exploration nodes, backyard hide spots, perches) cast thousands of line-of-sight
// rays. Run them only after every collider has its BVH: without one, three.js tests every triangle and
// the warm-up took ~5 s on a fast laptop (~20 s on a phone) in ONE frame, freezing the title screen.
// With BVHs it is ~170 ms, and each cache runs in its own task so taps stay responsive.
let _aiWarmQueued = false;
function scheduleAIWarmup() {
  if (!AI || typeof requestAnimationFrame !== 'function' || _aiWarmQueued) return;
  _aiWarmQueued = true;
  const waitForBVH = () => {
    if (bvhRafId || pendingBvhList.length) { requestAnimationFrame(waitForBVH); return; }
    _aiWarmQueued = false;
    const steps = AI.warmupMapCacheSteps ? AI.warmupMapCacheSteps() : [() => AI.warmupMapCaches && AI.warmupMapCaches()];
    const runNext = () => {
      const f = steps.shift();
      if (!f) return;
      try { f(); } catch (_) {}
      if (steps.length) setTimeout(runNext, 32);
    };
    setTimeout(runNext, 32);
  };
  requestAnimationFrame(waitForBVH);
}

function warmupMatchPipeline() {
  scheduleAIWarmup();
  try { if (typeof endCinematic !== 'undefined' && endCinematic) setTimeout(() => endCinematic.prewarm(camera), 1500); } catch (_) {}
  if (_shaderWarmed || !renderer || !scene || !camera) return;
  _shaderWarmed = true;
  const warmGrp = new THREE.Group();
  warmGrp.scale.setScalar(0.001);
  warmGrp.position.set(0, 0.5, 0);
  const owned = [];
  const gunWasVis = gun.visible;
  const ringWasVis = aimRing.visible;
  let deferDispose = false;
  const disposeWarm = () => {
    for (let i = 0; i < owned.length; i++) {
      try { owned[i].dispose(); } catch (_) {}
    }
  };
  try {
    const gBox = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const gPlane = new THREE.PlaneGeometry(0.2, 0.2);
    owned.push(gBox, gPlane);
    const addM = (g, m) => { owned.push(m); const ms = new THREE.Mesh(g, m); warmGrp.add(ms); };
    addM(gBox, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    addM(gBox, new THREE.MeshLambertMaterial({ color: 0xffe4d6, transparent: true, opacity: 0.75, depthWrite: false }));
    addM(gPlane, new THREE.MeshBasicMaterial({ color: 0xffb7c5, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
    addM(gPlane, new THREE.MeshBasicMaterial({ color: 0x5ab7f0, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    addM(gBox, new THREE.MeshBasicMaterial({ color: 0xff8030, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85, depthWrite: false }));
    const sprMat = new THREE.SpriteMaterial({ color: 0xff8030, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false });
    owned.push(sprMat);
    warmGrp.add(new THREE.Sprite(sprMat));
    if (KIT && KIT.props) {
      const h = makePainter(false, { spiritMap: activeMapId, skin: 'classic' });
      const s = makePainter(true, { kind: 'raincoat' });
      warmGrp.add(h, s);
    }
    gun.visible = true;
    aimRing.visible = true;
    scene.add(warmGrp);
    // compileAsync (three r158+) lets the driver link programs in parallel (KHR_parallel_shader_compile)
    // instead of blocking on each one; the cached programs are reused when these materials first draw.
    // The world itself is already compiled by the menu background render; only match-only materials
    // (hider/seeker painters, splash, gun, aim ring) need warming. compileAsync polls just the warm-up
    // group (lit by the scene's lights), so world materials disposed by a map switch can't break it,
    // and the warm-up materials are disposed only once it settles.
    if (typeof renderer.compileAsync === 'function') {
      renderer.compile(gun, camera, scene);
      renderer.compile(aimRing, camera, scene);
      const pending = renderer.compileAsync(warmGrp, camera, scene);
      deferDispose = true;
      pending.catch(() => {}).finally(() => disposeWarm());
    } else {
      renderer.compile(scene, camera);
    }
  } catch (e) {
    console.warn('[warmup] compile skipped:', e);
  } finally {
    scene.remove(warmGrp);
    gun.visible = gunWasVis;
    aimRing.visible = ringWasVis;
    if (!deferDispose) disposeWarm();
  }
}

function flushPendingBVH() {
  if (bvhRafId) {
    cancelAnimationFrame(bvhRafId);
    bvhRafId = 0;
  }
  if (!pendingBvhList.length) return;
  let n = 0;
  for (let i = 0; i < pendingBvhList.length; i++) {
    const m = pendingBvhList[i];
    if (m && m.geometry && !m.geometry.boundsTree && m.geometry.attributes.position && m.geometry.attributes.position.count >= 96) {
      try { m.geometry.computeBoundsTree(); n++; } catch (e) { /* non-indexable geometry */ }
    }
  }
  pendingBvhList.length = 0;
  if (n > 0) console.log(`[bvh] flushed ${n} remaining geometries`);
}

function scheduleBVH(immediate = false) {
  if (bvhRafId) {
    cancelAnimationFrame(bvhRafId);
    bvhRafId = 0;
  }
  pendingBvhList.length = 0;
  // decorative instanced dressing (roof tiles, stones, leaves, books…) is skipped by raycasts: the merged walls/props behind it block shots and sight
  const before = solids.length;
  for (let i = solids.length - 1; i >= 0; i--) if (solids[i].isInstancedMesh && !solids[i].userData.ground) solids.splice(i, 1);
  console.log(`[bvh] raycast set ${before} → ${solids.length} meshes`);
  // the same small instanced dressing doesn't need to draw into the shadow map (walls, roofs and props still cast)
  let ns = 0;
  for (const b of [...ENTER.map((e) => e.g), ...STRUCT.stalls, STRUCT.well, STRUCT.mill].filter(Boolean)) b.traverse((m) => { if (m.isInstancedMesh && m.castShadow) { const big = m.geometry.boundingSphere || (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere); if (big.radius < 0.6) { m.castShadow = false; ns++; } } });
  console.log(`[perf] ${ns} instanced decor meshes no longer cast shadows`);

  for (const m of solids) {
    if (m.isMesh && !m.isInstancedMesh && m.geometry && !m.geometry.boundsTree && m.geometry.attributes.position && m.geometry.attributes.position.count >= 96) {
      pendingBvhList.push(m);
    }
  }
  if (immediate) {
    flushPendingBVH();
    return;
  }
  const pumpBVH = () => {
    bvhRafId = 0;
    const budgetStart = performance.now();
    let processed = 0;
    while (pendingBvhList.length > 0 && processed < 28 && (performance.now() - budgetStart) < 9.5) {
      const m = pendingBvhList.pop();
      if (m && m.geometry && !m.geometry.boundsTree && m.geometry.attributes.position) {
        try { m.geometry.computeBoundsTree(); } catch (e) { /* non-indexable geometry */ }
      }
      processed++;
    }
    if (pendingBvhList.length > 0) {
      bvhRafId = requestAnimationFrame(pumpBVH);
    }
  };
  if (pendingBvhList.length > 0) {
    bvhRafId = requestAnimationFrame(pumpBVH);
  }
}

// ============================================================ 5v5 game state & smart bot roster
// Hide · 5v5 = 30s Hide + 1:50 Survive · Seek · 5v5 = 10s Sky Drop + 1:50 Hunt (a full 2-round match is ~4.5 minutes)
const ROUND = { hide: 30, survive: 110, seekReady: 10, seek: 110 };
const BASE_HIDER_HP = 140;
const fmtTime = (t) => { t = Math.max(0, Math.round(t)); return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : `${t}s`; };
const G = {
  mode: null, phase: 'menu', t: 0,
  player: null, seekers: [], hiders: [], allSeekers: [], allHiders: [],
  found: 0, wrong: 0, yaw: 0, pitch: -0.2, over: false,
  firing: false, fireCd: 0, shotsFired: 0, lastPenalty: -9, transformCd: 0,
  spectating: false, specTarget: null,
};
const input = { mx: 0, mz: 0, keys: {} };
const ROUND_PROPS = new Set(['barrel', 'bucket', 'milk_can', 'flower_pot', 'pumpkin', 'lantern_post', 'stool']);

const gun = new THREE.Group();
{
  gunMats.tank = new THREE.MeshLambertMaterial({ color: 0xffa94d });
  gunMats.barrel = new THREE.MeshLambertMaterial({ color: 0x3fb8a8 });
  gunMats.grip = new THREE.MeshLambertMaterial({ color: 0x2f5f8a });
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), gunMats.tank); tank.position.set(0, -0.02, 0.08); gun.add(tank);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 10), gunMats.barrel); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, -0.16); gun.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), gunMats.grip); grip.position.set(0, -0.1, 0.02); gun.add(grip);
  gun.scale.setScalar(0.62); gun.position.set(0.26, -0.24, -0.5); gun.visible = false; camera.add(gun);
}

function pushFeed(icon, html, kind = 'info') {
  const box = $('feed');
  if (!box) return;
  while (box.children.length >= 4) box.removeChild(box.firstElementChild);
  const el = document.createElement('div');
  el.className = `feed-item ${kind}`;
  el.innerHTML = `<span>${icon}</span><span>${html}</span>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3900);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4250);
}

let MP = null;
let vsIntroTimer = null;

function attachActorMeta(ch, { id, name, team, isBot, isLocal = false, isRemote = false, slotIdx = 0, showTag = false }) {
  ch.userData.actor = {
    id,
    name,
    team,       // 'seekers' | 'hiders'
    isBot: !!isBot,
    isLocal: !!isLocal,
    isRemote: !!isRemote,
    slotIdx,
    eliminations: 0,
    eliminated: false,
  };
  if (showTag) {
    const tag = makeNameplateSprite(THREE, name, team);
    ch.add(tag);
    ch.userData.nameplate = tag;
  }
  return ch;
}

function findSafeSpawn(prefX, prefZ, r = 0.52, avoid = [], minSep = 1.32, refY = 'auto') {
  // maps with stacked levels (bathhouse: undercroft under the courtyard) choose which surface spawns use
  if (refY === 'auto') refY = (ACTIVE_MAP && Object.prototype.hasOwnProperty.call(ACTIVE_MAP, 'spawnRefY')) ? ACTIVE_MAP.spawnRefY : 0;
  const ok = (x, z) =>
    Math.hypot(x, z) < MAPR - 2.2 &&
    !(activeMapId === 'meadow' && isMeadowGroundCutout(x, z)) &&
    !(ACTIVE_MAP && ACTIVE_MAP.isDeepWater && ACTIVE_MAP.isDeepWater(x, z)) &&
    !(ACTIVE_MAP && ACTIVE_MAP.isSkyGap && ACTIVE_MAP.isSkyGap(x, z)) &&
    !blockedAt(x, z, r, groundHeightAt(x, z, refY)) &&
    !whereIs(x, z, refY) &&
    avoid.every((p) => Math.hypot(x - p.x, z - p.z) > minSep);
  if (ok(prefX, prefZ)) return new THREE.Vector3(prefX, groundHeightAt(prefX, prefZ, refY), prefZ);
  for (let step = 1; step <= 150; step++) {
    const rad = 0.65 + step * 0.24;
    const ang = step * 2.39996;
    const x = prefX + Math.cos(ang) * rad;
    const z = prefZ + Math.sin(ang) * rad;
    if (ok(x, z)) return new THREE.Vector3(x, groundHeightAt(x, z, refY), z);
  }
  return new THREE.Vector3(prefX, groundHeightAt(prefX, prefZ, refY), prefZ);
}

function getMudSpeedMul(ch) {
  if (!ch || activeMapId !== 'meadow') return 1;
  const u = ch.userData || {};
  if ((u.jy || 0) > 0.14 || (u.groundY ?? 0) < -0.5) return 1;
  if (!isInMudWallow(ch.position.x, ch.position.z)) return 1;
  return u.propId === 'mb_pig' ? 1.08 : 0.86;
}

function getCharHiderPerk(ch) {
  if (!ch || G.isTutorial) return 'none';
  if (ch === G.player && progression) return progression.getActiveHiderPerk();
  return ch.userData?.hiderPerk || 'none';
}

function getCharSeekerPerk(ch) {
  if (!ch || G.isTutorial) return 'none';
  if (ch === G.player && progression) return progression.getActiveSeekerPerk();
  return ch.userData?.seekerPerk || 'none';
}

function getHiderBonusMaxHp(ch) {
  return getCharHiderPerk(ch) === 'grove_sovereign' ? 35 : 0;
}

function setCharHpTarget(ch, targetMax) {
  const effMax = targetMax + getHiderBonusMaxHp(ch);
  const u = ch.userData;
  if (ch === G.player) {
    const prevMax = G.maxHp || (BASE_HIDER_HP + getHiderBonusMaxHp(ch));
    const frac = clamp((G.hp ?? prevMax) / prevMax, 0.12, 1);
    G.maxHp = effMax;
    G.hp = frac * effMax;
  } else if (u.ai) {
    const prevMax = u.ai.maxHp || (BASE_HIDER_HP + getHiderBonusMaxHp(ch));
    const frac = clamp((u.ai.hp ?? prevMax) / prevMax, 0.12, 1);
    u.ai.maxHp = effMax;
    u.ai.hp = frac * effMax;
  }
}

function exitSpecialSpot(ch, silent = false) {
  if (!ch) return;
  const u = ch.userData;
  if (!u.specialMode) return;
  if (u.specialMesh) { ch.remove(u.specialMesh); u.specialMesh = null; }
  const spot = u.specialSpot;
  if (spot && spot.occupiedBy === ch) spot.occupiedBy = null;
  u.specialMode = null; u.specialSpot = null; u.specialY = 0; u.specialLabel = null;
  if (spot && typeof spot.exitX === 'number') {
    ch.position.x = spot.exitX; ch.position.z = spot.exitZ;
    u.groundY = groundHeightAt(spot.exitX, spot.exitZ, spot.exitY ?? spot.groundY ?? spot.y);
  }
  const def = u.propId ? KIT.props[u.propId] : null;
  u.radius = def ? (def.radius || 0.5) : 0.45;
  u.height = def ? (def.height || 1) : 1.4;
  u.speedMul = def ? (def.speed || 1.0) : 1.0;
  setCharHpTarget(ch, def ? (def.hp || BASE_HIDER_HP) : BASE_HIDER_HP);
  if (u.propId) {
    if (u.disguise) u.disguise.visible = true;
  } else {
    u.parts.forEach((m) => { m.visible = true; });
  }
  if (!silent) { audio.poof(true); splash(centerOf(ch), 16, 2.0); }
}

function enterSpecialSpot(ch, inter, silent = false) {
  if (!ch || !inter) return false;
  const u = ch.userData;
  const isPlayer = ch === G.player;
  exitSpecialSpot(ch, true);
  inter.occupiedBy = ch;

  if (inter.kind === 'custom_spot') {
    if (inter.propId) disguise(ch, inter.propId);
    const gy = inter.groundY ?? inter.y ?? groundHeightAt(inter.x, inter.z);
    ch.position.set(inter.x, gy, inter.z);
    u.groundY = gy;
    inter.occupiedBy = ch;
    if (!inter.propId) {
      u.parts.forEach((m) => { m.visible = false; });
      if (u.disguise) u.disguise.visible = false;
      const mesh = ACTIVE_MAP && ACTIVE_MAP.buildCustomSpotDisguise ? ACTIVE_MAP.buildCustomSpotDisguise(THREE, inter) : null;
      if (mesh) { ch.add(mesh); u.specialMesh = mesh; }
    }
    u.specialMode = 'custom_spot';
    u.specialLabel = inter.disguiseLabel || inter.label || 'Hidden Spirit ✨';
    u.specialSpot = inter;
    u.specialY = inter.offsetY ?? 0;
    u.height = inter.height || 0.75;
    u.radius = inter.radius || 0.42;
    u.speedMul = inter.mobile ? (inter.speedMul || 0.72) : 0;
    if (typeof inter.rot === 'number') ch.rotation.y = inter.rot;
    setCharHpTarget(ch, Math.round(clamp((inter.hp || 95) * 1.85, 160, 220)));
    if (isPlayer) {
      G.specialLockT = 0.45;
      G.poofAt = performance.now();
      G.poofPos = ch.position.clone();
      if (!silent && !G.isTutorial && progression) progression.recordAchievementStat('propsMorphed', 1);
      hint(inter.enterHint || `Disguised as ${u.specialLabel}! (WASD or G to leave)`, 2700);
    } else if (u.ai) {
      u.ai.poofAt = performance.now();
    }
    if (!silent) {
      splash(centerOf(ch), 24, 2.3);
      if (isPlayer) audio.poof();
      AI.emitSoundCue(ch.position, 8.5, 'poof', ch);
    }
    return true;
  }

  if (inter.kind === 'tub') {
    ch.position.set(inter.x, inter.y, inter.z);
    u.groundY = inter.y;
    u.parts.forEach((m) => { m.visible = false; });
    if (u.disguise) u.disguise.visible = false;
    const mesh = ACTIVE_MAP && ACTIVE_MAP.buildTubDisguise ? ACTIVE_MAP.buildTubDisguise(THREE, inter) : null;
    if (mesh) { ch.add(mesh); u.specialMesh = mesh; }
    u.specialMode = 'tub';
    u.specialLabel = inter.disguiseLabel || 'Bath Duck 🦆';
    u.specialSpot = inter;
    u.specialY = inter.offsetY || 0.42;
    u.height = 0.55;
    u.radius = 0.35;
    u.speedMul = 0;
    setCharHpTarget(ch, 165);
    if (isPlayer) {
      G.specialLockT = 0.45;
      G.poofAt = performance.now();
      G.poofPos = ch.position.clone();
      if (!silent && !G.isTutorial && progression) progression.recordAchievementStat('propsMorphed', 1);
      hint(inter.enterHint || 'Submerged in the steaming cedar tub! Only a bath duck shows 🦆 (WASD or G to hop out)', 2700);
    } else if (u.ai) {
      u.ai.poofAt = performance.now();
    }
    if (!silent) {
      splash(centerOf(ch), 26, 2.4);
      audio.splash(inter.x, inter.z);
      AI.emitSoundCue(ch.position, 8.5, 'poof', ch);
    }
    return true;
  }

  if (inter.kind === 'hook') {
    if (inter.propId) disguise(ch, inter.propId);
    else setCharHpTarget(ch, 170);
    inter.occupiedBy = ch;
    ch.position.set(inter.x, inter.groundY, inter.z);
    u.groundY = inter.groundY;
    u.specialY = inter.hangY || 1.55;
    u.specialMode = 'hook';
    u.specialLabel = inter.disguiseLabel || 'Wall-Hung Lantern 🏮';
    u.specialSpot = inter;
    u.speedMul = 0;
    if (typeof inter.rot === 'number') ch.rotation.y = inter.rot;
    if (isPlayer) {
      G.specialLockT = 0.45;
      G.poofAt = performance.now();
      G.poofPos = ch.position.clone();
      if (!silent && !G.isTutorial && progression) progression.recordAchievementStat('propsMorphed', 1);
      hint(inter.enterHint || 'Hanging off the ground on an eave hook! 🏮 (WASD or G to drop)', 2700);
    } else if (u.ai) {
      u.ai.poofAt = performance.now();
    }
    if (!silent) {
      splash(centerOf(ch), 24, 2.2);
      if (isPlayer) audio.poof();
      AI.emitSoundCue(ch.position, 8.0, 'poof', ch);
    }
    return true;
  }
  return false;
}

function isFlyingBirdChar(ch) {
  const u = ch && ch.userData;
  return !!(u && !u.specialMode && u.propId && KIT?.props?.[u.propId]?.canFly);
}

function mountTurret(ch) {
  const tur = getActiveTurret();
  if (!ch || !tur || (tur.getOccupant() && tur.getOccupant() !== ch)) return false;
  const u = ch.userData;
  if (u.specialMode) exitSpecialSpot(ch, true);
  tur.mount(ch);
  const sy = tur.seatY ?? ((tur.y ?? 0) + 0.18);
  u.inTurret = true;
  u.vy = 0; u.jy = 0; u.gliding = false;
  u.groundY = sy;
  ch.position.set(tur.x, sy, tur.z);
  if (ch === G.player) {
    gun.visible = false;
    G.pitch = Math.max(G.pitch, 0.35);
    tur.setAim(G.yaw, G.pitch);
    audio.creak();
    hint(tur.mountHint || '🎯 Seated in the Sky-Turret! Aim up into the sky & fire to shoot flying creatures down! (G / Jump to hop off)', 2800);
    updateHelp();
  }
  return true;
}

function dismountTurret(ch, silent = false) {
  if (!ch || !ch.userData?.inTurret) return false;
  const u = ch.userData;
  u.inTurret = false;
  const tur = getActiveTurret();
  if (tur) {
    tur.dismount(ch);
    const refY = tur.y ?? 0;
    const safe = findSafeSpawn(tur.exitX ?? tur.x, tur.exitZ ?? (tur.z - 1.35), 0.48, [], 1.32, refY);
    ch.position.x = safe.x;
    ch.position.z = safe.z;
    u.groundY = groundHeightAt(safe.x, safe.z, refY);
    ch.position.y = u.groundY;
  }
  if (ch === G.player) {
    G.pitch = clamp(G.pitch, -1.2, 1.18);
    if (G.mode === 'seek' && G.phase === 'seek' && !G.over) gun.visible = true;
    if (!silent) {
      audio.creak();
      hint('Hopped off the Turret!', 1200);
    }
    updateHelp();
  }
  return true;
}

function disguise(ch, id) {
  const def = KIT.props[id]; if (!def) return false;
  const u = ch.userData;
  const perk = getCharHiderPerk(ch);
  exitSpecialSpot(ch, true);
  if (u.disguise) ch.remove(u.disguise);
  u.disguise = buildProp(id);
  if (painterlyGfx) painterlyGfx.upgradeSceneGroup(u.disguise, { rimMul: 1.35, cloudMul: 0.55, macroMul: 0.0 });
  ch.add(u.disguise);
  u.propId = id; u.radius = def.radius || 0.5; u.height = def.height || 1;
  u.speedMul = def.speed || 1.0;
  if (def.canFly) {
    u.birdStamina = 1.0;
    u.birdShotDownUntil = 0;
    u.birdClimbing = false;
    if (ch === G.player && G.pitch > -0.16) {
      G.pitch = -0.26;
    }
  } else {
    u.birdClimbing = false;
    u.gliding = false;
  }
  if (perk === 'tiny_spirit') {
    u.disguise.scale.multiplyScalar(0.78);
    u.radius *= 0.82;
    u.height *= 0.80;
    u.speedMul *= 1.08;
  } else if (perk === 'grove_sovereign') {
    u.speedMul *= 1.06;
  }
  setCharHpTarget(ch, def.hp || BASE_HIDER_HP);
  u.parts.forEach((m) => { m.visible = false; });
  u.squashTarget = 0;
  u._morphPopT = 0.28;
  if (hueLayer) hueLayer.onDisguise(ch);
  if (ch === G.player && G.phase !== 'menu') haptics.morph();
  if (worldEvents) worldEvents.onHiderTransformed(ch, id);
  return true;
}

function undisguise(ch) {
  const u = ch.userData;
  exitSpecialSpot(ch, true);
  if (hueLayer) hueLayer.onUndisguise(ch);
  if (u.disguise) ch.remove(u.disguise);
  u.disguise = null; u.propId = null; u.radius = 0.45; u.speedMul = 1.0;
  u.birdClimbing = false; u.gliding = false; u.birdShotDownUntil = 0;
  setCharHpTarget(ch, BASE_HIDER_HP);
  u.parts.forEach((m) => { m.visible = true; });
  setEyes(ch, true);
}

let chipList = [], chipKey = '';
function clearRound() {
  clearTimeout(endRoundTO);
  clearTimeout(nonMasterEndTO);
  nonMasterEndTO = 0;
  G.jumpHeld = false;
  G.posLocked = false;
  G._camTrauma = 0;
  G._hitstopT = 0;
  G._camLandDip = 0;
  G._gunRecoil = 0;
  G._killStreak = 0;
  G._lastKillAt = 0;
  G._heroRescues = 0;
  G._boopsLanded = 0;
  G._damageTaken = 0;
  G._propsMorphedRound = 0;
  G._overdriveClutch = false;
  syncPosLockBtn();
  const ebClear = $('hsEmoteBar'); if (ebClear) ebClear.classList.add('hidden');
  const emTrig = $('btnEmoteToggle'); if (emTrig) emTrig.classList.remove('is-open');
  const hudPop = $('hudSettingsPopover'); if (hudPop) hudPop.classList.add('hidden');
  const hudGear = $('btnHudSettings'); if (hudGear) hudGear.classList.remove('is-open');
  if (typeof document !== 'undefined') document.body.classList.remove('hud-settings-open');
  const slEl = $('speedLines'); if (slEl) slEl.style.opacity = '0';
  const kbEl = $('killBanner'); if (kbEl) { kbEl.classList.remove('on'); kbEl.classList.add('hidden'); }
  clearWorldBeacons();
  resetDynamicTimeOfDay();
  if (genreKing) genreKing.clearAll();
  if (tier1Visuals) tier1Visuals.pruneOutlines();
  for (const e of elimPropLaunches) scene.remove(e.m);
  elimPropLaunches.length = 0;
  for (const b of emoteBubbles3D) { scene.remove(b.sp); b.tex.dispose(); b.mat.dispose(); }
  emoteBubbles3D.length = 0;
  for (const d of dustPuffs) { scene.remove(d.m); d.m.material.dispose(); }
  dustPuffs.length = 0;
  const activeTur = getActiveTurret();
  if (activeTur) activeTur.dismount(null);
  if (seekerSkyDrop) seekerSkyDrop.cancelSkyDrop();
  if (hiderTricks) hiderTricks.clearAll();
  if (seekerGadgets) seekerGadgets.clearAll();
  if (elementalGuns) elementalGuns.clearAll();
  if (worldEvents) worldEvents.clearAll();
  if (hueLayer) hueLayer.clearAll();
  if (statusFx) statusFx.clearAll();
  if (progression) progression.clearRoundVfx();
  for (const c of [G.player, ...(G.seekers || []), ...(G.hiders || [])]) {
    if (!c) continue;
    if (c.userData) {
      c.userData.customPilot = null;
      c.userData.colliderScale = 1;
      c.userData._kvx = 0; c.userData._kvz = 0;
      c.userData._windCloakUntil = 0;
      c.userData._propJitterUntil = 0;
    }
    scene.remove(c);
  }
  if (ACTIVE_MAP && ACTIVE_MAP.getInteractSpots) {
    for (const sp of ACTIVE_MAP.getInteractSpots()) sp.occupiedBy = null;
  }
  if (ACTIVE_MAP && ACTIVE_MAP.onResetRound) {
    try { ACTIVE_MAP.onResetRound(G); } catch (e) { console.warn('[map] reset hook err:', e); }
  }
  SLOTS.forEach((q) => { q.taken = null; });
  shots.length = 0;
  for (const p of puddles) scene.remove(p.m); puddles.length = 0;
  if ($('feed')) $('feed').innerHTML = '';
  if ($('chips')) $('chips').innerHTML = '';
  const vig = document.querySelector('.vignette');
  if (vig) vig.classList.remove('blindfold');
  chipKey = ''; chipList = [];
  if ($('specBar')) $('specBar').classList.add('hidden');
  if ($('dangerVignette')) $('dangerVignette').style.opacity = '0';
  if ($('feverBanner')) $('feverBanner').classList.add('hidden');
  if ($('nervesToast')) $('nervesToast').classList.add('hidden');
  clearTimeout(nervesToastTO);
  audio.setProximityDanger(0);
  if (viralHighlights) {
    viralHighlights.skipHighlight();
    viralHighlights.setSpectating(false, []);
  }
  for (const r of feverWhistleRings) scene.remove(r.mesh);
  feverWhistleRings.length = 0;
  G.player = null; G.seekers = []; G.hiders = []; G.allSeekers = []; G.allHiders = [];
  G.spectating = false; G.specTarget = null; G.ghost = false;
  G.proxDanger = 0; G.nervesStillSec = 0; G.nervesAwardsCount = 0; G.feverMilestoneMask = 0;
  G.isTutorial = false;
  if (tutorial) tutorial.onClearRound();
}

const feverWhistleRings = [];
function spawnFeverWhistleRing(pos) {
  const gy = groundHeightAt(pos.x, pos.z, pos.y);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.54, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffc84a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, gy + 0.08, pos.z);
  scene.add(ring);
  feverWhistleRings.push({ mesh: ring, t: 0 });
}

function markTex(ch, col) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.font = '900 56px Fredoka, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = '#33402f'; g.strokeText(ch, 32, 36); g.fillStyle = col; g.fillText(ch, 32, 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const MARK = { '!': new THREE.SpriteMaterial({ map: markTex('!', '#ff5a4f'), depthTest: false, transparent: true }), '?': new THREE.SpriteMaterial({ map: markTex('?', '#ffd36b'), depthTest: false, transparent: true }) };
function setMark(s, ch) {
  const ai = s.userData.ai;
  if (!ai) return;
  if (!ai.mark) { ai.mark = new THREE.Sprite(MARK['!']); ai.mark.scale.setScalar(0.75); ai.mark.position.y = 2.15; ai.mark.renderOrder = 6; s.add(ai.mark); }
  ai.mark.visible = !!ch; if (ch) ai.mark.material = MARK[ch];
}
function normAng(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

const _blockerCells = new Map();
const _bigBlockers = [];
let _blockerGridLen = -1;
let _blockerVisitSeq = 1;

function rebuildBlockerGrid() {
  _blockerCells.clear();
  _bigBlockers.length = 0;
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    b._bi = i;
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    // moving blockers (animals, wind-pushed or swapped props) are always checked directly: their grid
    // cells would go stale as soon as they move
    if (b.dynamic || !Number.isFinite(w) || !Number.isFinite(d) || w > 18 || d > 18) {
      _bigBlockers.push(b);
      continue;
    }
    const cx0 = Math.floor(b.x0 * 0.25);
    const cx1 = Math.floor(b.x1 * 0.25);
    const cz0 = Math.floor(b.z0 * 0.25);
    const cz1 = Math.floor(b.z1 * 0.25);
    for (let gx = cx0; gx <= cx1; gx++) {
      for (let gz = cz0; gz <= cz1; gz++) {
        const key = (gx + 512) * 1024 + (gz + 512);
        let bucket = _blockerCells.get(key);
        if (!bucket) {
          bucket = [];
          _blockerCells.set(key, bucket);
        }
        bucket.push(b);
      }
    }
  }
  _blockerGridLen = blockers.length;
}

function blockerHitsXZ(b, x, z, R, refY) {
  if (b.disabled) return false;
  if (typeof b.maxR === 'number' && R <= b.maxR) return false;
  if (!blockerOverlapsY(b, refY, false)) return false;
  if (!(x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R)) return false;
  if (!b.obb) return true;
  const [lx, lz] = obbLocal(b.obb, x, z);
  return Math.abs(lx) < b.obb.hx + R && Math.abs(lz) < b.obb.hz + R;
}

function blockedAt(x, z, R, refY) {
  if (Math.hypot(x, z) > MAPR - 0.5) return true;
  if (ACTIVE_MAP && ACTIVE_MAP.isDynamicBlockedAt && ACTIVE_MAP.isDynamicBlockedAt(x, z, R, refY)) return true;
  if (blockers.length !== _blockerGridLen) rebuildBlockerGrid();
  for (let i = 0; i < _bigBlockers.length; i++) {
    if (blockerHitsXZ(_bigBlockers[i], x, z, R, refY)) return true;
  }
  const visit = (++_blockerVisitSeq) || (_blockerVisitSeq = 1);
  const cx0 = Math.floor((x - R) * 0.25);
  const cx1 = Math.floor((x + R) * 0.25);
  const cz0 = Math.floor((z - R) * 0.25);
  const cz1 = Math.floor((z + R) * 0.25);
  for (let gx = cx0; gx <= cx1; gx++) {
    for (let gz = cz0; gz <= cz1; gz++) {
      const bucket = _blockerCells.get((gx + 512) * 1024 + (gz + 512));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const b = bucket[i];
        if (b._gv === visit) continue;
        b._gv = visit;
        if (blockerHitsXZ(b, x, z, R, refY)) return true;
      }
    }
  }
  return false;
}

const SEEK = { mem: null, visited: new Map(), lostHintT: 0 };
const AI = createAIManager({
  THREE,
  G,
  now: simNow,
  getActiveBubbleCages: () => (genreKing ? genreKing.getActiveBubbleCages() : []),
  triggerBoopOrBait: (ch) => (genreKing ? genreKing.triggerBoopOrBait(ch) : false),
  getNearestFootprint: (pos, maxD) => (genreKing ? genreKing.getNearestFootprint(pos, maxD) : null),
  getActiveSquadPingForTeam: (team) => (genreKing ? genreKing.getActiveSquadPingForTeam(team) : null),
  ENTER,
  SLOTS,
  LIVE,
  ROUND_PROPS,
  blockers,
  realProps,
  audio,
  camera,
  getMapRadius: () => MAPR,
  getActiveMap: () => ACTIVE_MAP,
  getActiveMapId: () => activeMapId,
  getKit: () => KIT,
  groundHeightAt: (x, z, refY) => groundHeightAt(x, z, refY, false),
  blockedAt,
  whereIs,
  routeVia,
  lineOfSight,
  centerOf,
  moveChar: (ch, dx, dz) => {
    const wob = elementalGuns ? elementalGuns.getSteeringWobbleRad(ch) : 0;
    if (wob && Math.hypot(dx, dz) > 1e-4) {
      const c = Math.cos(wob), s = Math.sin(wob);
      moveChar(ch, dx * c - dz * s, dx * s + dz * c);
    } else {
      moveChar(ch, dx, dz);
    }
  },
  doCharJump: (ch, vy) => doCharJump(ch, vy),
  disguise,
  undisguise,
  enterSpecialSpot,
  exitSpecialSpot,
  fire,
  splash,
  ripple,
  hint,
  pushFeed,
  getHiderSpeedMul: (h) =>
    (hiderTricks ? hiderTricks.getSpeedMultiplier(h) : 1) *
    (worldEvents ? worldEvents.getHiderSpeedMul(h) : 1) *
    (elementalGuns ? elementalGuns.getCharacterSpeedMultiplier(h) : 1) *
    getMudSpeedMul(h) *
    (ACTIVE_MAP?.getSurfaceModifier?.(h, G)?.speedMul ?? 1) *
    (simNow() < (h?.userData?.adrenalineUntil || 0) ? 1.16 : 1),
  getSeekerSpeedMul: (s) =>
    (worldEvents ? worldEvents.getSeekerSpeedMul(s) : 1) *
    (elementalGuns ? elementalGuns.getCharacterSpeedMultiplier(s) : 1) *
    getMudSpeedMul(s) *
    (ACTIVE_MAP?.getSurfaceModifier?.(s, G)?.speedMul ?? 1) *
    (getCharSeekerPerk(s) === 'swift_boots' ? 1.08 : 1) *
    (simNow() < (s?.userData?.hunterSprintUntil || 0) ? 1.22 : 1),
  isOvertime: () => !!(worldEvents && worldEvents.isOvertime()),
  getWells: () => (hueLayer ? hueLayer.getWells() : []),
  getNearestPot: (pos, maxDist) => (hueLayer ? hueLayer.getNearestPot(pos, maxDist) : null),
  isPotActive: (id) => !!(hueLayer && hueLayer.isPotActive(id)),
  getActiveDecoys: () => (hiderTricks && hiderTricks.getActiveDecoys ? hiderTricks.getActiveDecoys() : []),
});

const SPIRIT_EMBLEM = {
  meadow: '🌿',
  bathhouse: '🏮',
  skyruins: '💎',
  seaplane: '🛩️',
  clockwork: '⚙️',
  tinyfolk: '🪡',
};

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtQueueSec(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let prevQueueFilled = 0;
let qFilledBumpTO = 0;
let vsTickInterval = 0;

function initQueueSlotsDOM() {
  for (const elId of ['qHiderSlots', 'qSeekerSlots']) {
    const box = $(elId);
    if (!box) continue;
    box.innerHTML = '';
    for (let i = 0; i < TEAM_SIZE; i++) {
      const row = document.createElement('div');
      row.className = 'q-slot empty';
      row.style.setProperty('--row-delay', `${(i * 0.16).toFixed(2)}s`);
      row.dataset.actorId = '';
      row.dataset.joining = '';
      row.innerHTML =
        `<span class="q-slot-left"><i class="q-slot-empty-dot"></i><span class="q-slot-txt">Searching<span class="q-dots"><i>.</i><i>.</i><i>.</i></span></span></span>` +
        `<span class="q-slot-right"></span>`;
      box.appendChild(row);
    }
  }
}

function syncOfflineNoticeUI(forceOffline = null) {
  const isOff = forceOffline !== null
    ? Boolean(forceOffline)
    : ((typeof navigator !== 'undefined' && navigator.onLine === false) || (MP && typeof MP.isOffline === 'function' && MP.isOffline()));
  const lobBan = $('lobbyOfflineBanner');
  if (lobBan) lobBan.classList.toggle('hidden', !isOff);
  const lobDot = $('lobbyOnlineDot');
  if (lobDot) {
    lobDot.classList.toggle('is-offline', isOff);
    lobDot.title = isOff ? 'Offline Mode — Solo AI Squad' : 'Global 5v5 Matchmaking';
  }
  const qPill = $('qTopPill');
  if (qPill) qPill.classList.toggle('is-offline', isOff);
  const qDot = $('qOnlineDot');
  if (qDot) qDot.classList.toggle('is-offline', isOff);
  const qTxt = $('qMatchPillText');
  if (qTxt) qTxt.textContent = isOff ? 'OFFLINE MODE · AI SQUAD' : 'ONLINE MATCHMAKING';
  const qNote = $('qOfflineNotice');
  if (qNote) qNote.classList.toggle('hidden', !isOff);
  if (mobileLobby && typeof mobileLobby.setOfflineState === 'function') {
    mobileLobby.setOfflineState(isOff);
  }
  return isOff;
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    syncOfflineNoticeUI(true);
    hint('📡 You are offline — Playing in Offline Mode with smart AI squad!', 4200);
  });
  window.addEventListener('online', () => {
    syncOfflineNoticeUI(false);
    hint('🌐 Back online! Global 5v5 matchmaking is ready.', 2800);
  });
}

function renderQueueScreen(snap) {
  if (!snap || !$('queueScreen')) return;
  syncOfflineNoticeUI(Boolean(snap.offline));
  if ($('qTimer')) $('qTimer').textContent = fmtQueueSec(snap.elapsed);
  if ($('qMaxLbl')) $('qMaxLbl').textContent = `max ${fmtQueueSec(snap.maxSec || 30)}`;
  if ($('qStatus')) $('qStatus').textContent = snap.statusText || 'Searching…';

  const filled = snap.filledCount || 1;
  const isFull = filled >= TEAM_SIZE * 2;
  if ($('qCard')) $('qCard').classList.toggle('is-full', isFull);

  // Smooth SVG progress ring tracks player fill (10%..100%) blended gently with elapsed search progress
  const arc = $('qDialArc');
  if (arc) {
    const fillFrac = clamp(Math.max(filled / (TEAM_SIZE * 2), (snap.elapsed || 0) / Math.max(1, (snap.maxSec || 30) * 1.12)), 0.08, 1);
    arc.style.strokeDashoffset = (144.5 * (1 - fillFrac)).toFixed(1);
  }
  if ($('qDialIcon')) $('qDialIcon').textContent = isFull ? '🎉' : '✨';

  const qf = $('qFilled');
  if (qf) qf.textContent = String(filled);
  if (filled !== prevQueueFilled) {
    if (filled > prevQueueFilled && prevQueueFilled > 0) {
      audio.tap();
      if (qf) {
        qf.classList.remove('bump');
        void qf.offsetWidth;
        qf.classList.add('bump');
        clearTimeout(qFilledBumpTO);
        qFilledBumpTO = setTimeout(() => qf.classList.remove('bump'), 260);
      }
    }
    prevQueueFilled = filled;
  }

  const hList = snap.hiders || [];
  const sList = snap.seekers || [];
  if ($('qHiderCount')) $('qHiderCount').textContent = `${hList.length} / ${TEAM_SIZE}`;
  if ($('qSeekerCount')) $('qSeekerCount').textContent = `${sList.length} / ${TEAM_SIZE}`;

  // Persistent DOM diff update: ONLY touch a slot node when its occupant changes or ping updates!
  // Never wipes innerHTML on unchanged slots, so animations never twitch or reset!
  const updateCol = (elId, list, isSeekerCol) => {
    const box = $(elId);
    if (!box) return;
    if (box.children.length !== TEAM_SIZE) initQueueSlotsDOM();
    for (let i = 0; i < TEAM_SIZE; i++) {
      const row = box.children[i];
      if (!row) continue;
      const p = list[i] || null;
      const prevId = row.dataset.actorId || '';
      const nextId = p ? String(p.actorId || p.name) : '';

      if (!p) {
        if (prevId !== '') {
          row.dataset.actorId = '';
          row.dataset.joining = '';
          row.className = 'q-slot empty';
          row.innerHTML =
            `<span class="q-slot-left"><i class="q-slot-empty-dot"></i><span class="q-slot-txt">Searching<span class="q-dots"><i>.</i><i>.</i><i>.</i></span></span></span>` +
            `<span class="q-slot-right"></span>`;
        }
        continue;
      }

      if (prevId !== nextId) {
        // New occupant arrived (or a real player replaced a scheduled/arrived bot!)
        const wasOccupied = prevId !== '';
        const avIcon = isSeekerCol ? '💦' : (SPIRIT_EMBLEM[p.spiritMap] || '🌿');
        const avCls = isSeekerCol ? 'seeker' : 'hider';
        const joinAnim = p.isSelf && (snap.elapsed || 0) < 0.35
          ? ''
          : (wasOccupied ? ' just-swapped' : ' just-joined');

        row.dataset.actorId = nextId;
        row.dataset.joining = p.joining ? '1' : '0';
        row.className = `q-slot filled${p.isSelf ? ' self' : ''}${joinAnim}`;
        row.innerHTML =
          `<span class="q-slot-left">` +
          `<span class="q-mini-av ${avCls}">${avIcon}</span>` +
          `<span class="q-slot-txt">${escHtml(p.name)}</span>` +
          (p.isSelf ? '<em class="q-you">YOU</em>' : '') +
          `</span>` +
          `<span class="q-slot-right">` +
          (p.joining
            ? `<span class="q-join-badge">joining…</span>`
            : `<i class="q-ready-dot"></i><span class="q-ping">${p.ping || 24}ms</span>`) +
          `</span>`;
        continue;
      }

      // Same player still in slot: only update right-hand status if 'joining' finished or ping changed!
      const nowJoining = p.joining ? '1' : '0';
      if (row.dataset.joining !== nowJoining) {
        row.dataset.joining = nowJoining;
        const right = row.querySelector('.q-slot-right');
        if (right) {
          right.innerHTML = p.joining
            ? `<span class="q-join-badge">joining…</span>`
            : `<i class="q-ready-dot"></i><span class="q-ping">${p.ping || 24}ms</span>`;
        }
      } else if (!p.joining) {
        const pingEl = row.querySelector('.q-ping');
        const nextPingTxt = `${p.ping || 24}ms`;
        if (pingEl && pingEl.textContent !== nextPingTxt) {
          pingEl.textContent = nextPingTxt;
        }
      }
    }
  };

  updateCol('qHiderSlots', hList, false);
  updateCol('qSeekerSlots', sList, true);
}

function launchRosterMatch(roster) {
  if (!roster) return;
  const onSeekers = (roster.seekers || []).some((s) => s.actorId === roster.localActorId);
  if (onSeekers) startSeek(roster);
  else startHide(roster);
}

function playVsIntro(roster, durOverride = null) {
  clearTimeout(vsIntroTimer);
  clearInterval(vsTickInterval);
  if (roster.mapId && roster.mapId !== activeMapId && MAP_REGISTRY[roster.mapId]) {
    selectMap(roster.mapId, { allowGuest: true });
  }
  const def = MAP_REGISTRY[activeMapId] || MEADOW_DEF;
  $('title').classList.remove('on');
  $('result').classList.remove('on');
  if ($('queueScreen')) $('queueScreen').classList.remove('on');
  $('hud').classList.add('hidden');

  if ($('vsWorldTitle')) $('vsWorldTitle').textContent = def.title;

  const buildCards = (arr, isSeeker) => (arr || []).map((slot, i) => {
    const isYou = slot.actorId === roster.localActorId;
    const icon = isSeeker ? getElementSpec(slot.elemGun || 'water').icon : (SPIRIT_EMBLEM[slot.spiritMap] || '🌿');
    const delay = ((isSeeker ? 0.11 : 0.06) + i * 0.08).toFixed(2);
    return (
      `<div class="vs-player${isYou ? ' is-you' : ''}" style="animation-delay:${delay}s">` +
      `<div class="vs-p-left">` +
      `<span class="vs-avatar">${icon}</span>` +
      `<span class="vs-name">${escHtml(slot.name)}</span>` +
      (isYou ? '<span class="vs-you-pill">YOU</span>' : '') +
      `</div>` +
      `<div class="vs-p-right"><i class="q-ready-dot"></i><span class="vs-ping">${slot.ping || 25}ms</span></div>` +
      `</div>`
    );
  }).join('');

  if ($('vsHidersList')) $('vsHidersList').innerHTML = buildCards(roster.hiders, false);
  if ($('vsSeekersList')) $('vsSeekersList').innerHTML = buildCards(roster.seekers, true);

  // Restart shockwave + crest animations cleanly on repeat matches
  const vsStage = document.querySelector('#vsScreen .vs-stage');
  if (vsStage) {
    vsStage.style.animation = 'none';
    void vsStage.offsetWidth;
    vsStage.style.animation = '';
  }

  const qVs = Number(new URLSearchParams(location.search).get('vsSec'));
  const dur = (typeof durOverride === 'number' && durOverride >= 0)
    ? durOverride
    : (!Number.isNaN(qVs) && qVs >= 0.1 && qVs <= 10 ? qVs : (PHOTON_CONFIG.vsIntroSeconds || 3.5));

  const fill = $('vsBarFill');
  if (fill) {
    fill.classList.remove('run');
    fill.style.setProperty('--vs-dur', `${dur}s`);
    void fill.offsetWidth;
    fill.classList.add('run');
  }

  const onSeekers = (roster.seekers || []).some((s) => s.actorId === roster.localActorId);
  const vsStart = performance.now();
  const updateVsFoot = () => {
    const rem = Math.max(1, Math.ceil(dur - (performance.now() - vsStart) / 1000));
    if ($('vsFootTxt')) {
      $('vsFootTxt').textContent = onSeekers
        ? `Water splashers ready · Match starts in ${rem}…`
        : `Spirits entering ${def.title} in ${rem}…`;
    }
  };
  updateVsFoot();
  vsTickInterval = setInterval(updateVsFoot, 250);

  G.phase = 'vs';
  if ($('vsScreen')) $('vsScreen').classList.add('on');
  audio.cue('go');

  vsIntroTimer = setTimeout(() => {
    clearInterval(vsTickInterval);
    if ($('vsScreen')) $('vsScreen').classList.remove('on');
    if (MP) MP.markMatchStarted();
    launchRosterMatch(roster);
  }, Math.round(dur * 1000));
}

// A Play tap that arrives while the world is still being built at launch shows the queue screen right
// away (matchmaking itself starts once READY), instead of leaving the lobby looking frozen.
function showQueueWhileLoading(mode, opts) {
  try {
    $('title')?.classList.remove('on', 'world-modal-open', 'desk-menu-open');
    const urlNoTut = new URLSearchParams(location.search).get('notut') === '1';
    if (!opts.skipTutorialCheck && !urlNoTut && tutorial && tutorial.shouldRunFirstTime(mode)) return;
    if ($('queueScreen') && $('queueScreen').classList.contains('on')) return;
    const def = MAP_REGISTRY[activeMapId] || MEADOW_DEF;
    if ($('qWorldTitle')) $('qWorldTitle').textContent = def.title;
    if ($('qRoleBadge')) $('qRoleBadge').textContent = mode === 'seek' ? '💦 Queueing as Seeker · Seek 5v5' : '🎭 Queueing as Spirit · Hide 5v5';
    $('hud').classList.add('hidden');
    initQueueSlotsDOM();
    if ($('queueScreen')) $('queueScreen').classList.add('on');
  } catch (_) { /* the normal path below sets the screen up once READY */ }
}

function enterMatchQueue(mode = 'hide', opts = {}) {
  if (analytics && !opts._anTracked) {
    opts._anTracked = true;
    analytics.track('play_click', { mode, map: quickPlayAnyMap ? 'any' : activeMapId, ready: !!READY, offline: !!(MP && MP.isOffline && MP.isOffline()) });
  }
  if (!READY) {
    showQueueWhileLoading(mode, opts);
    setTimeout(() => enterMatchQueue(mode, opts), 80);
    return;
  }
  const urlNoTut = new URLSearchParams(location.search).get('notut') === '1';
  if (!opts.skipTutorialCheck && !urlNoTut && tutorial && tutorial.shouldRunFirstTime(mode)) {
    tutorial.start(mode, { source: 'play_gate' });
    return;
  }
  if (activeMapId === 'tutorial') {
    const fallbackMap = (tutorial && tutorial.getSavedMapId && tutorial.getSavedMapId()) || 'meadow';
    selectMap(fallbackMap !== 'tutorial' ? fallbackMap : 'meadow');
  }
  clearTimeout(vsIntroTimer);
  clearInterval(vsTickInterval);
  if (document.pointerLockElement) document.exitPointerLock();
  clearRound();
  G.phase = 'menu';
  G.mode = mode;

  const nameIn = $('playerNameInput');
  if (nameIn && nameIn.value.trim()) {
    MP.setPlayerName(nameIn.value);
    nameIn.value = MP.getPlayerName();
  }

  const useQuickPlay = Boolean(quickPlayAnyMap && !(MP && MP.partyCode) && !opts.rematch && !opts.specificMap);
  let targetQueueMap = activeMapId;
  if (useQuickPlay) {
    targetQueueMap = pickQuickPlayMap();
    if (targetQueueMap && MAP_REGISTRY[targetQueueMap] && targetQueueMap !== activeMapId) {
      selectMap(targetQueueMap, { allowGuest: true, fromPartySync: true });
    }
  }
  const def = MAP_REGISTRY[targetQueueMap] || MEADOW_DEF;
  if ($('qWorldTitle')) {
    $('qWorldTitle').textContent = opts.rematch
      ? `🔁 Rematch · ${def.title}`
      : (useQuickPlay ? `⚡ Quick Play · ${def.title}` : def.title);
  }
  if ($('qRoleBadge')) {
    $('qRoleBadge').textContent = mode === 'seek'
      ? '💦 Queueing as Seeker · Seek 5v5'
      : '🎭 Queueing as Spirit · Hide 5v5';
  }

  $('title').classList.remove('on');
  $('result').classList.remove('on');
  if ($('halftimeScreen')) $('halftimeScreen').classList.remove('on');
  if ($('vsScreen')) $('vsScreen').classList.remove('on');
  if (matchFlow) matchFlow.resetSeries();
  $('hud').classList.add('hidden');
  initQueueSlotsDOM();
  if ($('qCard')) $('qCard').classList.remove('is-full');
  if ($('queueScreen')) $('queueScreen').classList.add('on');
  prevQueueFilled = 0;

  const queuePayload = {
    mode,
    mapId: targetQueueMap,
    spiritMap: selectedSpirit,
    hat: progression ? progression.getEquipped('hat') : 'none',
    elemGun: progression ? progression.getActiveElemGun() : 'water',
    worldTitle: def.title,
    maxSecOverride: opts.maxSecOverride ?? null,
    quickPlay: useQuickPlay,
  };
  if (opts.rematch && MP && typeof MP.rematchSameLobby === 'function') {
    MP.rematchSameLobby(queuePayload);
  } else {
    MP.enterQueue(queuePayload);
  }
}

function rematchLobby() {
  if (genreKing) {
    const voted = genreKing.getWinningVotedMap(activeMapId);
    if (voted && MAP_REGISTRY[voted] && voted !== activeMapId) {
      selectMap(voted, { allowGuest: true, fromPartySync: true });
    }
  }
  enterMatchQueue(G.mode === 'seek' ? 'seek' : 'hide', { rematch: true, skipTutorialCheck: true });
}

MP = createMultiplayerManager({
  G,
  markBangMat: MARK['!'],
  setMark,
  disguise,
  undisguise,
  exitSpecialSpot,
  getLocalPlayer: () => G.player,
  getActiveMapId: () => activeMapId,
  getSelectedSpirit: () => selectedSpirit,
  getEquippedHat: () => (progression ? progression.getEquipped('hat') : 'none'),
  getActiveElemGun: () => (progression ? progression.getActiveElemGun() : 'water'),
  onQueueMapResolved: (roomMapId, roomWorldTitle) => {
    if (roomMapId && MAP_REGISTRY[roomMapId] && activeMapId !== roomMapId) {
      selectMap(roomMapId, { allowGuest: true, fromPartySync: true });
      if (mobileLobby) mobileLobby.refresh();
    }
    if ($('qWorldTitle') && roomWorldTitle) {
      $('qWorldTitle').textContent = `⚡ Joined Live Lobby · ${roomWorldTitle}`;
    }
  },
  onPartyMapChanged: (nextMapId) => {
    if (nextMapId && MAP_REGISTRY[nextMapId] && activeMapId !== nextMapId) {
      selectMap(nextMapId, { allowGuest: true, fromPartySync: true });
      if (mobileLobby) mobileLobby.refresh();
    }
  },
  onPartyStateChanged: (partySnap) => {
    const deskBtn = $('btnDesktopParty');
    if (deskBtn) {
      const code = partySnap && partySnap.code;
      deskBtn.classList.toggle('in-party', Boolean(code));
      deskBtn.textContent = code
        ? `🎉 Room ${code} (${partySnap.memberCount || 1}/10)`
        : '🎉 Friends Party';
    }
    if (mobileLobby) mobileLobby.refresh();
  },
  onUrlPartyInviteJoined: (partySnap) => {
    if (mobileLobby) {
      mobileLobby.openPartyModal();
      if (partySnap?.code) {
        mobileLobby.showPartyToast(`🎉 Joined Friends Room ${partySnap.code}!`, 'success');
      }
    }
  },
  getCharBySlot: (team, slotIdx) => (team === 'seekers' ? G.allSeekers?.[slotIdx] : G.allHiders?.[slotIdx]) || null,
  getWorldMeta: (mId) => {
    const seekerKinds = ['raincoat', 'farmer', 'firefighter', 'grandma', 'detective'];
    const hiderSkins = (VILLAGE.chars && VILLAGE.chars.HIDER_SKINS) || ['classic'];
    return { mapOrder: MAP_ORDER, seekerKinds, hiderSkins };
  },
  applyRemoteSpecialSpot: (ch, specialKey) => {
    if (!ch || !ACTIVE_MAP) return;
    let spot = null;
    if (ACTIVE_MAP.getInteractSpots) {
      const list = ACTIVE_MAP.getInteractSpots() || [];
      if (specialKey.startsWith('id:')) {
        const wantId = specialKey.slice(3);
        spot = list.find((s) => String(s.id) === wantId);
      } else {
        const [kind, coords] = specialKey.split(':');
        const [sx, sz] = (coords || '').split(',').map(Number);
        spot = list.find((s) => s.kind === kind && Math.hypot((s.x || 0) * 10 - sx, (s.z || 0) * 10 - sz) < 8);
      }
    }
    if (!spot && ACTIVE_MAP.getNearbyInteraction) {
      spot = ACTIVE_MAP.getNearbyInteraction(ch, { mode: 'hide', phase: 'survive', over: false });
    }
    if (spot && spot.kind !== 'lift' && spot.kind !== 'mechanism' && spot.kind !== 'ride_path') {
      enterSpecialSpot(ch, spot, true);
    }
  },
  onQueueTick: (snap) => renderQueueScreen(snap),
  onMatchLocked: (roster) => {
    if (mobileLobby) mobileLobby.closePartyModal();
    if (roster?.mapId && MAP_REGISTRY[roster.mapId] && activeMapId !== roster.mapId) {
      selectMap(roster.mapId, { allowGuest: true, fromPartySync: true });
    }
    roster._seriesStarted = true;
    if (progression) progression.resetMatchSessionCounter();
    if (matchFlow) matchFlow.startSeries(roster);
    playVsIntro(roster);
  },
  onRemoteShot: (pkt) => {
    const shooter = (pkt.t === 1 ? G.allSeekers?.[pkt.s] : G.allHiders?.[pkt.s]) || null;
    if (!shooter || shooter === G.player) return;
    if (matchFlow) matchFlow.recordStat(shooter, 'shotsFired', 1);
    const shotElem = pkt.eg || shooter.userData?.elemId || shooter.userData?.elemGun || 'water';
    if (pkt.eg && elementalGuns && shooter.userData?.elemId !== pkt.eg) {
      shooter.userData.elemGun = pkt.eg;
      elementalGuns.setSeekerElement(shooter, pkt.eg);
    }
    const fromV = new THREE.Vector3(pkt.f[0], pkt.f[1], pkt.f[2]);
    const dirV = new THREE.Vector3(pkt.d[0], pkt.d[1], pkt.d[2]);
    shooter.userData.aim = true;
    shooter.userData.aimUntil = simNow() + 360;
    fire(fromV, dirV, shooter, pkt.sp || 28, true, shotElem);
  },
  onRemoteHit: (pkt) => {
    const victim = G.allHiders?.[pkt.vs];
    const shooter = (pkt.st === 1 ? G.allSeekers?.[pkt.ss] : G.allHiders?.[pkt.ss]) || null;
    if (!victim) return;
    onCharHit(victim, shooter, {
      fromNet: true,
      netHp: pkt.hp,
      netElim: !!pkt.el,
      elemId: shooter?.userData?.elemId || shooter?.userData?.elemGun || 'water',
    });
  },
  onRemotePhaseSync: (stage, rt) => {
    if (G.over) return;
    if (stage === 'hunt') {
      if (G.mode === 'hide' && G.phase === 'hide') {
        if (seekerSkyDrop && seekerSkyDrop.isBotDropActive && seekerSkyDrop.isBotDropActive()) {
          seekerSkyDrop.finishBotOnlySkyDrop();
        }
        G.phase = 'survive';
        G.t = rt;
        audio.music('survive'); audio.cue('release');
        G.seekers.forEach((s) => setEyes(s, true));
        pushFeed('👀', '<b>5 Seekers released!</b> Hold your nerve!', 'warn');
      } else if (G.mode === 'seek' && G.phase === 'ready') {
        if (seekerSkyDrop && seekerSkyDrop.isActive()) seekerSkyDrop.finishSkyDrop();
        gun.visible = true;
        G.phase = 'seek';
        G.t = rt;
        audio.cue('go');
        G.seekers.forEach((s) => setEyes(s, true));
        pushFeed('💦', '<b>Touchdown!</b> Sweep rooms & call out fakes!', 'soak');
      } else if (Math.abs((G.t || 0) - rt) > 0.75) {
        G.t = rt;
      }
    } else if (stage === 'prep' && Math.abs((G.t || 0) - rt) > 0.85) {
      G.t = rt;
    }
  },
  onRemoteRoundEnd: (pkt) => {
    if (G.over) return;
    const iWon = G.mode === 'hide' ? !!pkt.hidersWon : !pkt.hidersWon;
    endRound(iWon, iWon ? 'Victory!' : 'Round Over!', pkt.reason || '', iWon ? '🏆' : '💦', true);
  },
  onRemoteGadget: (pkt) => {
    if (!pkt) return;
    if (genreKing && genreKing.onRemoteGadget(pkt)) return;
    if (pkt.k === 'rematch_vote') {
      const who = String(pkt.who || 'Player').slice(0, 18);
      hint(`🔁 ${who} wants a Rematch! Tap Rematch Lobby to join them!`, 2800);
      return;
    }
    if (pkt.k === 'emote') {
      const sender = (pkt.t === 1 ? G.allSeekers?.[pkt.s] : G.allHiders?.[pkt.s]) || null;
      if (sender && sender !== G.player && pkt.e) {
        spawn3DEmoteBubble(sender, String(pkt.e).slice(0, 4));
        const nm = sender.userData?.actor?.name || 'Player';
        pushFeed(pkt.e === 'GG' ? '🤝' : String(pkt.e).slice(0, 4), `<b>${nm}</b> reacted ${String(pkt.e).slice(0, 4)}`, 'ally');
      }
      return;
    }
    if (!pkt || G.over) return;
    if (hueLayer && hueLayer.onRemoteGadget(pkt)) return;
    if (pkt.k === 'decoy_pop') {
      const shooter = (pkt.st === 1 ? G.allSeekers?.[pkt.ss] : G.allHiders?.[pkt.ss]) || null;
      if (hiderTricks) hiderTricks.popDecoyByNetKey(pkt.nk, shooter);
      return;
    }
    if (pkt.k === 'time_pen') {
      if (G.phase === 'seek' || G.phase === 'survive') {
        const slotKey = `_penAt_${pkt.s ?? 0}`;
        const nowP = performance.now();
        if (nowP - (G[slotKey] || 0) > 650) {
          G[slotKey] = nowP;
          const pen = clamp(Number(pkt.sec) || 2, 1, 5);
          G.t = Math.max(0, (G.t || 0) - pen);
        }
      }
      return;
    }
    if (pkt.k === 'map_mech' && ACTIVE_MAP) {
      const spotsList = ACTIVE_MAP.getInteractSpots ? (ACTIVE_MAP.getInteractSpots() || []) : [];
      const inter = spotsList.find((sp) =>
        sp.kind === pkt.kind &&
        ((pkt.id && String(sp.id) === String(pkt.id)) || Math.hypot((sp.x || 0) - (pkt.x || 0), (sp.z || 0) - (pkt.z || 0)) < 4.5)
      );
      if (inter) {
        const fn = inter.kind === 'lift' ? ACTIVE_MAP.triggerPulleyLift : ACTIVE_MAP.triggerMechanism;
        const actor = (pkt.t === 1 ? G.allSeekers?.[pkt.s] : G.allHiders?.[pkt.s]) || G.player;
        if (fn && actor) fn(actor, inter, G);
        audio.creak();
      }
      return;
    }
    if (pkt.k === 'elem_gun') {
      const sk = G.allSeekers?.[pkt.s] || null;
      if (sk && sk !== G.player && pkt.eg) {
        sk.userData.elemGun = pkt.eg;
        if (elementalGuns) elementalGuns.setSeekerElement(sk, pkt.eg);
      }
      return;
    }
    const ch = (pkt.t === 1 ? G.allSeekers?.[pkt.s] : G.allHiders?.[pkt.s]) || null;
    if (!ch || ch === G.player) return;
    if (pkt.k === 'taunt' && hiderTricks) {
      hiderTricks.useTaunt(ch, pkt.id || 'chirp', { fromNet: true });
    } else if (pkt.k === 'decoy' && hiderTricks) {
      hiderTricks.useDecoy(ch, {
        fromNet: true,
        netKey: pkt.nk,
        x: pkt.x,
        z: pkt.z,
        rotY: pkt.ry,
        propId: pkt.pid || '',
      });
    } else if (pkt.k === 'smoke' && hiderTricks) {
      hiderTricks.useSmokeDash(ch, { fromNet: true, poofTheme: pkt.pf || 'sakura' });
    } else if (pkt.k === 'pulse' && seekerGadgets) {
      seekerGadgets.useEchoPulse(ch, { fromNet: true });
    } else if (pkt.k === 'bomb' && seekerGadgets && Array.isArray(pkt.d)) {
      const dirV = new THREE.Vector3(pkt.d[0], pkt.d[1], pkt.d[2]);
      seekerGadgets.useSplashBomb(ch, dirV, {
        fromNet: true,
        origin: pkt.o,
        elemId: pkt.eg || ch.userData?.elemId || ch.userData?.elemGun || 'water',
      });
    }
  },
  onRemotePeerLeft: (leftActorId, nowMaster, newMasterId) => {
    if (matchFlow && matchFlow.markActorBotTakeover) {
      matchFlow.markActorBotTakeover(leftActorId, newMasterId);
    }
    const all = [...(G.allHiders || []), ...(G.allSeekers || [])];
    for (const c of all) {
      if (!c || c === G.player) continue;
      const act = c.userData?.actor;
      if (!act) continue;
      if (act.id === leftActorId) {
        // Seamless smart AI takeover so 5v5 matches never have AFK statues or stuck parachutes!
        act.isBot = true;
        act.isRemote = !nowMaster;
        if (c.userData._remotePara) {
          if (c.userData._remotePara.parent) c.userData._remotePara.parent.remove(c.userData._remotePara);
          c.userData._remotePara.visible = false;
          c.userData._remotePara = null;
        }
        c.userData.gliding = false;
        c.userData.jy = 0;
        c.userData.vy = 0;
        const gy = groundHeightAt(c.position.x, c.position.z, 0);
        c.userData.groundY = gy;
        c.position.y = gy;
        c.rotation.x = 0;
        c.rotation.z = 0;
      } else if (act.isBot) {
        act.isRemote = !nowMaster;
      }
    }
  },
});

function syncLocalElemGunToWorldAndNet(elemId) {
  if (G.player && G.mode === 'seek') {
    G.player.userData.elemGun = elemId;
    G.player.userData.elemId = elemId;
  }
  if (MP && MP.isLiveSession() && G.player?.userData?.actor?.team === 'seekers') {
    MP.broadcastGadget({
      k: 'elem_gun',
      t: 1,
      s: G.player.userData.actor.slotIdx ?? 0,
      eg: elemId,
    });
  }
}

// Instantiate & Mount All Fun-Factor + Elemental Arsenal + 99-Level Progression Systems
progression = createProgressionManager({
  THREE,
  scene,
  onStateSaved: () => { if (cloudSave) cloudSave.notifyLocalChange(); },
  audio,
  gunMats,
  getPlayerName: () => (MP ? MP.getPlayerName() : ''),
  getActiveMapId: () => activeMapId,
  onAdminSelectMap: (mapId) => {
    selectMap(mapId, { allowGuest: true });
    if (mobileLobby) mobileLobby.refresh();
  },
  onAdminTutorialsSkipped: () => {
    if (tutorial) tutorial.syncLobbyBadges();
  },
  onPreviewTaunt: (tauntId) => playTauntPreview(tauntId),
  onElemGunChanged: (elemId) => {
    if (elementalGuns && elementalGuns.getCurrentElement() !== elemId) {
      elementalGuns.selectElement(elemId, { silent: true, force: true });
    }
    syncLocalElemGunToWorldAndNet(elemId);
  },
  onElemGunUnlocked: (elemId) => {
    if (elementalGuns) elementalGuns.unlockElement(elemId);
  },
  onMapUnlocked: () => {
    updateWorldPickerUI();
    if (mobileLobby) mobileLobby.refresh();
  },
  onLevelChanged: () => {
    updateWorldPickerUI();
    if (mobileLobby) mobileLobby.refresh();
  },
});
progression.mountUI();
if (progression.getEquipped('blaster') !== 'classic') {
  progression.applyBlasterSkin(gunMats);
}

elementalGuns = createElementalGunsManager({
  externalStatusFx: true,
  THREE,
  scene,
  camera,
  renderer,
  gun,
  gunMats,
  dropI,
  realProps,
  blockers,
  puddles,
  G,
  audio,
  getHiderTricks: () => hiderTricks,
  getProgression: () => progression,
  getHiderPerk: getCharHiderPerk,
  getSeekerPerk: getCharSeekerPerk,
  onBurnTick: (victim, attacker, dmg) => {
    onCharHit(victim, attacker, { customDmg: dmg, elemId: 'fire', isBurnDot: true });
  },
  groundHeightAt: (x, z, refY) => groundHeightAt(x, z, refY, false),
  centerOf,
  moveChar: (ch, dx, dz) => moveChar(ch, dx, dz),
  getKit: () => KIT,
  getActiveMap: () => ACTIVE_MAP,
  getMapRadius: () => MAPR,
  getQualityTier: () => (mobilePerf && mobilePerf.getTier ? mobilePerf.getTier() : 'high'),
  onRestoreWaterBlasterColors: () => restoreWaterBlasterColors(activeMapId),
  onElementChanged: (elemId) => {
    if (progression && progression.getActiveElemGun() !== elemId) {
      progression.setEquippedElemGun(elemId);
    }
    syncLocalElemGunToWorldAndNet(elemId);
  },
  applyAirKnockback: (victim, dirVec, strength = 3.2) => {
    if (!victim || victim.userData?.actor?.eliminated) return;
    const k = clamp(strength || 3.2, 0.8, 5.5) * 0.24;
    moveChar(victim, (dirVec?.x || 0) * k, (dirVec?.z || 0) * k);
    if ((victim.userData.jy || 0) < 0.08) {
      victim.userData.vy = Math.max(victim.userData.vy || 0, 2.35);
      victim.userData.jy = Math.max(0.03, victim.userData.jy || 0);
    }
  },
  hint,
  now: simNow,
});
elementalGuns.mountUI();
elementalGuns.selectElement(progression.getActiveElemGun(), { silent: true, force: true });

function countNearbySeekers(pos, radius = 16) {
  if (!pos) return 0;
  const raw = (G.allSeekers && G.allSeekers.length)
    ? G.allSeekers
    : [G.mode === 'seek' ? G.player : null, ...(G.seekers || [])].filter(Boolean);
  let n = 0;
  for (const s of raw) {
    if (!s || s.userData?.actor?.eliminated || !s.position) continue;
    if (Math.hypot(pos.x - s.position.x, pos.z - s.position.z) <= radius) n++;
  }
  return n;
}

viralHighlights = createViralHighlightsManager({
  THREE,
  G,
  scene,
  camera,
  renderer,
  composer,
  renderScene,
  solids,
  shots,
  disguise,
  undisguise,
  groundHeightAt: (x, z, refY) => groundHeightAt(x, z, refY, false),
  splash,
  ripple,
  elementalGuns,
  audio,
  MP,
  now: simNow,
  getKit: () => KIT,
  getWorldTitle: () => (MAP_REGISTRY[activeMapId] || MEADOW_DEF).title,
  getPlayerName: () => (MP ? MP.getPlayerName() : 'Spirit'),
  getRoomCode: () => (MP && MP.partyCode ? MP.partyCode : ''),
  onSpectateTargetChange: (target) => {
    if (target) G.specTarget = target;
  },
});
viralHighlights.mountUI();

matchFlow = createMatchFlowManager({
  G,
  audio,
  now: simNow,
  isLiveSession: () => !!(MP && MP.isLiveSession()),
  getKit: () => KIT,
  getWorldTitle: () => (MAP_REGISTRY[activeMapId] || MEADOW_DEF).title,
  getBestHighlightSummary: () => (viralHighlights ? viralHighlights.getBestHighlightSummary() : null),
  shareHighlight: (opts) => (viralHighlights ? viralHighlights.shareHighlight(opts) : null),
  awardTokens: (reason, tok, txt, xp) => (progression && !G.isTutorial ? progression.awardTokens(reason, tok, txt, xp) : null),
  onSeriesFinished: (outcome) => {
    if (hueLayer && !G.isTutorial) hueLayer.recordSeriesResult(outcome);
    return progression && !G.isTutorial ? progression.recordSeriesOutcome(outcome) : null;
  },
  toMenu,
  launchSwappedRound2: (swappedRoster) => {
    swappedRoster._isSwappedRound2 = true;
    if (MP) MP.resetForNextRound(swappedRoster);
    playVsIntro(swappedRoster, 2.4);
  },
});
matchFlow.mountUI();

// Victory / defeat / draw cinematic between the end of the final round and the stats screen
const endCinematic = createEndCinematic({
  THREE, scene, renderer, camera, G, audio, haptics,
  isLite: () => !!(mobilePerf && mobilePerf.getLiteLevel && mobilePerf.getLiteLevel() >= 1),
  getHero: () => (G.player && !G.player.userData?.actor?.eliminated && G.player.visible !== false ? G.player : null),
  getMapCenter: () => { const cm = (ACTIVE_MAP && ACTIVE_MAP.camMenu) || MEADOW_DEF.camMenu || {}; return { x: cm.lookX ?? 0, z: cm.lookZ ?? 0 }; },
  groundHeightAt: (x, z) => groundHeightAt(x, z),
  // the local player's side in the final round: they hop around when it's a victory
  getSquad: (outcome) => (outcome === 'victory'
    ? ((G.mode === 'hide' ? G.allHiders : G.allSeekers) || []).filter((c) => c && c.visible !== false && !c.userData?.actor?.eliminated)
    : []),
  hop: (ch) => { if (ch && (ch.userData?.jy || 0) < 0.05) doCharJump(ch, 6.6); },
});
endCinematic.mountUI();

statusFx = createStatusFxManager({
  THREE,
  scene,
  G,
  ripple,
  haptics,
  getStatus: (ch) => (elementalGuns ? elementalGuns.getCharacterStatusSummary(ch) : null),
});
statusFx.mountUI();

hueLayer = createHueLayerManager({
  THREE,
  scene,
  camera,
  G,
  SLOTS,
  realProps,
  simNow,
  isTouch,
  audio,
  haptics,
  hint,
  pushFeed,
  ripple,
  centerOf,
  findSafeSpawn,
  getKit: () => KIT,
  getAI: () => AI,
  getMP: () => MP,
  getActiveMap: () => ACTIVE_MAP,
  getMapRadius: () => MAPR,
  getProgression: () => progression,
  getMatchFlow: () => matchFlow,
  getElementSpec: () => (elementalGuns ? elementalGuns.getCurrentSpec() : null),
  isOvertime: () => !!(worldEvents && worldEvents.isOvertime()),
});
hueLayer.mountUI();

// Cloud save: the device save stays the source of truth; a copy syncs in the background.
cloudSave = createCloudSave({ config: CLOUD_CONFIG, canReload: () => G.phase === 'menu' && !G.isTutorial });
cloudSave.mountUI();
cloudSave.start();

// Anonymous gameplay analytics (matches played, where players stop, session length, retention).
try {
  analytics = createAnalytics({
    config: CLOUD_CONFIG,
    version: GAME_VERSION,
    getToken: () => cloudSave.getAuthToken(),
  });
  analytics.start({
    level: progression ? (progression.getLevel?.() || 0) : 0,
    tutHideDone: !!(tutorial && tutorial.shouldRunFirstTime && !tutorial.shouldRunFirstTime('hide')),
  });
} catch (_) { analytics = null; }

const broadcastLocalGadgetIfAuth = (payload, srcChar) => {
  if (!MP || !MP.isLiveSession() || !payload) return;
  if (payload.k === 'decoy_pop') {
    MP.broadcastGadget(payload);
    return;
  }
  const isAuth = srcChar === G.player || (MP.isMaster() && !!srcChar?.userData?.actor?.isBot);
  if (isAuth) MP.broadcastGadget(payload);
};

hiderTricks = createHiderTricksManager({
  THREE,
  G,
  scene,
  audio,
  now: simNow,
  getKit: () => KIT,
  buildProp,
  groundHeightAt: (x, z, refY) => groundHeightAt(x, z, refY, false),
  centerOf,
  emitSoundCue: (pos, rad, kind, src) => AI.emitSoundCue(pos, rad, kind, src),
  splash,
  ripple,
  hint,
  pushFeed,
  onLocalGadget: broadcastLocalGadgetIfAuth,
  getHiderPerk: getCharHiderPerk,
  getSeekerPerk: getCharSeekerPerk,
  onSoapDecoyPopped: (pos) => {
    if (elementalGuns) elementalGuns.spawnSlipperyPuddleAt(pos, 1.05, true);
  },
  onDashCleanse: (ch, full) => {
    if (elementalGuns) elementalGuns.cleanseCharacterDebuffs(ch, !full);
  },
  awardTokens: (reason, tok, txt, xp) => (progression && !G.isTutorial ? progression.awardTokens(reason, tok, txt, xp) : null),
  recordStat: (ch, key, delta) => {
    if (ch === G.player && !G.isTutorial && progression) {
      if (key === 'decoyTricks' || key === 'closeTaunts') {
        progression.recordAchievementStat('tacticalPlays', delta || 1);
      } else if (key === 'smokeEscapes') {
        progression.recordAchievementStat('airPlays', delta || 1);
      }
    }
    if (!G.isTutorial && viralHighlights && typeof viralHighlights.recordJuke === 'function' && ch) {
      const jukeKind = key === 'decoyTricks'
        ? 'decoy_pop'
        : (key === 'smokeEscapes' ? 'smoke_dash' : (key === 'closeTaunts' ? 'daredevil_taunt' : null));
      if (jukeKind) {
        viralHighlights.recordJuke({
          actor: ch,
          kind: jukeKind,
          propId: ch.userData?.propId,
          nearSeekers: Math.max(1, countNearbySeekers(ch.position, 18)),
          pos: ch.position?.clone(),
        });
      }
    }
    return matchFlow ? matchFlow.recordStat(ch, key, delta) : null;
  },
  getEquippedTaunt: () => (progression ? progression.getEquipped('taunt') : 'chirp'),
  getEquippedPoof: () => (progression ? progression.getEquipped('poof') : 'sakura'),
});
hiderTricks.mountUI();

seekerGadgets = createSeekerGadgetsManager({
  THREE,
  G,
  scene,
  camera,
  audio,
  solids,
  now: simNow,
  centerOf,
  groundHeightAt: (x, z, refY) => groundHeightAt(x, z, refY, false),
  splash,
  ripple,
  puddle,
  hint,
  onLocalGadget: broadcastLocalGadgetIfAuth,
  getSeekerPerk: getCharSeekerPerk,
  damageHider: (h, seeker, dmg) => onCharHit(h, seeker, {
    customDmg: dmg,
    elemId: elementalGuns ? elementalGuns.getSeekerElement(seeker) : 'water',
  }),
  onBombCharacterHit: (h, seeker, elemId, hitPos) => {
    if (elementalGuns) {
      const resolvedElem = elemId || elementalGuns.getSeekerElement(seeker);
      elementalGuns.onCharacterImpact({
        elemId: resolvedElem,
        victim: h,
        shooter: seeker,
        point: hitPos,
        isBomb: true,
      });
    }
  },
  onSplashExplosion: (pos, rad, seeker) => {
    const popped = hiderTricks ? hiderTricks.triggerSplashArea(pos, rad, seeker) : 0;
    if (popped > 0 && seeker === G.player && !G.isTutorial && progression) {
      progression.recordAchievementStat('tacticalPlays', popped);
    }
    return popped;
  },
  onBombDetonated: (elemId, hitPos, seeker) => {
    if (elementalGuns) {
      const resolvedElem = elemId || elementalGuns.getSeekerElement(seeker);
      elementalGuns.onBombDetonated(resolvedElem, hitPos, seeker);
    }
    if (genreKing && hitPos) genreKing.triggerChainPropRattle(hitPos, 5.5);
  },
  onBotPulseResult: () => {},
  awardTokens: (reason, tok, txt, xp) => (progression && !G.isTutorial ? progression.awardTokens(reason, tok, txt, xp) : null),
  recordStat: (ch, key, delta) => {
    if (ch === G.player && !G.isTutorial && progression && key === 'bombHits') {
      progression.recordAchievementStat('tacticalPlays', delta || 1);
    }
    return matchFlow ? matchFlow.recordStat(ch, key, delta) : null;
  },
});
seekerGadgets.mountUI();

worldEvents = createWorldEventsManager({
  THREE,
  G,
  duskRealLights: () => !(mobilePerf && mobilePerf.getLiteLevel && mobilePerf.getLiteLevel() >= 1),
  scene,
  audio,
  sky,
  hemiLight,
  sun,
  realProps,
  blockers,
  now: simNow,
  getKit: () => KIT,
  getMapRadius: () => MAPR,
  disguise,
  hint,
  pushFeed,
  awardTokens: (reason, tok, txt, xp) => (progression ? progression.awardTokens(reason, tok, txt, xp) : null),
  recordStat: (ch, key, delta) => (matchFlow ? matchFlow.recordStat(ch, key, delta) : null),
});
worldEvents.mountUI();

mobileControls = createMobileControlsManager({
  G,
  camera,
  audio,
  haptics,
  mobilePerf,
  realProps,
  solids,
  jump,
  undisguise,
  spawnPoofVfx: (pos) => (progression ? progression.spawnPoofVfx(pos) : null),
  centerOf,
  lineOfSight,
  hint,
});
mobileControls.mountUI();

mobileLobby = createMobileLobbyManager({
  G,
  audio,
  getMP: () => MP,
  getProgression: () => progression,
  getElementalGuns: () => elementalGuns,
  enterMatchQueue,
  syncTutorialBadges: () => (tutorial ? tutorial.syncLobbyBadges() : null),
});
mobileLobby.mount();

function clearTutorialDummies() {
  for (let i = G.hiders.length - 1; i >= 0; i--) {
    const h = G.hiders[i];
    if (h && h.userData?.isTutorialDummy) {
      scene.remove(h);
      G.hiders.splice(i, 1);
    }
  }
  for (let i = G.allHiders.length - 1; i >= 0; i--) {
    const h = G.allHiders[i];
    if (h && h.userData?.isTutorialDummy) {
      G.allHiders.splice(i, 1);
    }
  }
  if (hiderTricks && G.mode === 'seek') {
    hiderTricks.clearAll();
  }
}

function clearTutorialSeekers() {
  for (let i = G.seekers.length - 1; i >= 0; i--) {
    const s = G.seekers[i];
    if (s && s.userData?.isTutorialSeeker) {
      scene.remove(s);
      G.seekers.splice(i, 1);
    }
  }
  for (let i = G.allSeekers.length - 1; i >= 0; i--) {
    const s = G.allSeekers[i];
    if (s && s.userData?.isTutorialSeeker) {
      G.allSeekers.splice(i, 1);
    }
  }
}

function spawnTutorialSeeker({ x = -2.2, z = 5.5, name = 'Patrol Hunter' } = {}) {
  clearTutorialSeekers();
  const s = makePainter(true, { kind: 'raincoat' });
  s.userData.isTutorialSeeker = true;
  attachActorMeta(s, {
    id: `tut_seeker_${Math.random().toString(36).slice(2, 7)}`,
    name,
    team: 'seekers',
    isBot: true,
    isLocal: false,
    isRemote: false,
    slotIdx: G.allSeekers.length,
    showTag: true,
  });
  const gy = groundHeightAt(x, z);
  s.position.set(x, gy, z);
  s.userData.groundY = gy;
  s.userData.sus = 0.6;
  setMark(s, '?');
  G.seekers.push(s);
  G.allSeekers.push(s);
  return s;
}

function spawnTutorialDummy({ x = 2.6, z = -0.4, propId = 'barrel', hp = 34, name = '🎯 Fake Barrel' } = {}) {
  const h = makePainter(false, { spiritMap: 'meadow', skin: 'classic' });
  h.userData.isTutorialDummy = true;
  attachActorMeta(h, {
    id: `tut_dummy_${Math.random().toString(36).slice(2, 7)}`,
    name,
    team: 'hiders',
    isBot: true,
    isLocal: false,
    isRemote: false,
    slotIdx: G.allHiders.length,
    showTag: true,
  });
  const gy = groundHeightAt(x, z);
  h.position.set(x, gy, z);
  h.userData.groundY = gy;
  h.userData.ai = { hp, maxHp: hp, state: 'hidden', anim: 0 };
  if (propId && KIT && KIT.props[propId]) {
    disguise(h, propId);
    h.userData.ai.hp = hp;
    h.userData.ai.maxHp = hp;
  }
  G.hiders.push(h);
  G.allHiders.push(h);
  return h;
}

function startTutorialRound(mode = 'hide') {
  if (!READY) return;
  clearTimeout(vsIntroTimer);
  clearInterval(vsTickInterval);
  if (MP) MP.leaveSession();
  if (activeMapId !== 'tutorial' && MAP_REGISTRY.tutorial) {
    selectMap('tutorial', { allowGuest: true });
  }
  flushPendingBVH();
  clearRound();
  AI.resetMatchIntel();
  AI.setDifficulty(hueLayer ? hueLayer.currentBotDifficulty() : 0.5);
  SEEK.mem = null;
  SEEK.visited.clear();
  G.maxHp = BASE_HIDER_HP;
  G.hp = BASE_HIDER_HP;
  G.lastHit = -1e9;

  const isSeek = mode === 'seek';
  Object.assign(G, {
    mode: isSeek ? 'seek' : 'hide',
    phase: isSeek ? 'seek' : 'hide',
    t: 999,
    found: 0,
    wrong: 0,
    shotsFired: 0,
    firing: false,
    fireCd: 0,
    over: false,
    yaw: 0,
    pitch: isSeek ? -0.06 : -0.22,
    transformCd: 0,
    locked: false,
    stillT: 0,
    stillWarned: false,
    boldSec: 0,
    specialLockT: 0,
    spectating: false,
    specTarget: null,
    isTutorial: true,
  });

  const pref = (ACTIVE_MAP && (isSeek ? ACTIVE_MAP.seekSpawn : ACTIVE_MAP.playerSpawn)) || [0, 7.2];
  const spPos = findSafeSpawn(pref[0], pref[1], 0.52);

  if (isSeek) {
    const s = makePainter(true, { kind: 'raincoat' });
    s.visible = false;
    attachActorMeta(s, {
      id: 'local_tut_seeker',
      name: MP ? MP.getPlayerName() : 'You',
      team: 'seekers',
      isBot: false,
      isLocal: true,
      isRemote: false,
      slotIdx: 0,
      showTag: false,
    });
    s.position.copy(spPos);
    s.userData.groundY = spPos.y;
    s.rotation.y = Math.PI;
    G.player = s;
    G.allSeekers = [s];
    G.seekers = [];
    G.hiders = [];
    G.allHiders = [];
    if (progression && progression.getEquipped('blaster') !== 'classic') {
      progression.applyBlasterSkin(gunMats);
    }
    if (elementalGuns) {
      const tutElem = progression ? progression.getActiveElemGun() : 'water';
      s.userData.elemGun = tutElem;
      elementalGuns.resetRound();
      elementalGuns.selectElement(tutElem, { silent: true, force: true });
      elementalGuns.setSeekerElement(s, tutElem);
    }
    gun.visible = true;
    showHud();
    audio.music('seek');
  } else {
    const spMap = selectedSpirit === 'auto' ? (tutorial ? tutorial.getSavedMapId() : 'meadow') : selectedSpirit;
    const h = makePainter(false, { spiritMap: spMap || 'meadow', skin: 'classic' });
    if (progression) {
      progression.attachHatToChar(h, progression.getEquipped('hat'));
    }
    attachActorMeta(h, {
      id: 'local_tut_hider',
      name: MP ? MP.getPlayerName() : 'You',
      team: 'hiders',
      isBot: false,
      isLocal: true,
      isRemote: false,
      slotIdx: 0,
      showTag: false,
    });
    h.position.copy(spPos);
    h.userData.groundY = spPos.y;
    h.rotation.y = Math.PI;
    if (h.userData.skinColor == null && h.userData.paint) h.userData.paint.color.set(0xfff3dc);
    G.player = h;
    G.allHiders = [h];
    G.hiders = [];
    G.seekers = [];
    G.allSeekers = [];
    gun.visible = false;
    showHud();
    audio.music('hide');
  }

  if (hiderTricks) hiderTricks.resetRound();
  if (seekerGadgets) seekerGadgets.resetRound();
  if (worldEvents) worldEvents.clearAll();

  // Snap camera directly to the starting pose so Frame 0 has zero swoop from the menu orbit
  if (isSeek) {
    camera.position.set(spPos.x, spPos.y + 1.55, spPos.z);
    camera.rotation.set(G.pitch, G.yaw, 0, 'YXZ');
  } else {
    const ht = 1.4;
    const dist = 4.2 + ht * 1.2;
    const cx = spPos.x + Math.sin(G.yaw) * Math.cos(G.pitch) * dist;
    const cz = spPos.z + Math.cos(G.yaw) * Math.cos(G.pitch) * dist;
    const cy = spPos.y + ht * 0.8 - Math.sin(G.pitch) * dist;
    camera.position.set(cx, Math.max(spPos.y + 0.55, cy), cz);
    camera.lookAt(spPos.x, spPos.y + ht * 0.7, spPos.z);
  }
  updateHud();
  renderScene();

  pushFeed('🎓', isSeek
    ? '<b>Seeker Dojo</b> · Solo practice — zero bots &amp; no timer!'
    : '<b>Spirit Dojo</b> · Solo sanctuary — practice at your own pace!', 'ally');
}

tutorial = createTutorialManager({
  track: (name, props) => { if (analytics) analytics.track(name, props); },
  THREE,
  G,
  scene,
  audio,
  isTouch,
  now: simNow,
  get hiderTricks() { return hiderTricks; },
  get seekerGadgets() { return seekerGadgets; },
  getActiveMapId: () => activeMapId,
  selectMap,
  startTutorialRound,
  spawnTutorialDummy,
  clearTutorialDummies,
  spawnTutorialSeeker,
  clearTutorialSeekers,
  enterMatchQueue,
  toMenu,
  hint,
  isPointerLocked: () => locked(),
  awardTokens: (reason, tok, txt, xp) => (progression ? progression.awardTokens(reason, tok, txt, xp) : null),
});
tutorial.mountUI();

genreKing = createGenreKingManager({
  THREE,
  scene,
  G,
  audio,
  get MP() { return MP; },
  get progression() { return progression; },
  getRealProps: () => realProps,
  buildProp,
  groundHeightAt,
  centerOf,
  splash,
  spawnDustPuff,
  addCamTrauma,
  pushFeed,
  hint,
  onBubbleExpired: (ch) => {
    if (!ch || G.over) return;
    const alive = aliveHidersList();
    G.found = (G.allHiders || []).filter((h) => h.userData?.actor?.eliminated).length;
    if (alive.length === 0) {
      if (G.mode === 'seek') {
        const myKills = G.player?.userData?.actor?.eliminations || 0;
        requestAuthoritativeRoundEnd(true, 'All 5 Spirits Soaked!', `${fmtTime(G.t)} left · You soaked ${myKills}/5 · ${G.wrong} wrong sprays`, '🏆');
      } else {
        requestAuthoritativeRoundEnd(false, 'Squad Soaked!', 'All 5 spirits on your team were tracked down.', '💦');
      }
      return;
    }
    if (ch === G.player && G.mode === 'hide') {
      G.spectating = false;
      G.specTarget = alive[0];
      G.locked = false;
      $('btnSample').classList.add('hidden');
      $('btnFreeze').classList.add('hidden');
      if ($('btnInteract')) $('btnInteract').classList.add('hidden');
      renderChips([]);
      aimRing.visible = false;
      if (hueLayer) hueLayer.becomeGhost(ch); else { G.spectating = true; ch.visible = false; }
      updateHelp();
      if ($('specBar')) {
        $('specBar').classList.remove('hidden');
        if ($('btnSpecEnd')) $('btnSpecEnd').textContent = (MP && MP.isLiveSession()) ? 'Leave Match' : 'Results';
      }
      hint(G.ghost
        ? `👻 Bubble popped! You're a ghost now — ${isTouch ? 'tap Haunt' : 'press F'} near props to distract Seekers!`
        : `💧 Bubble popped! Spectating ${G.specTarget?.userData?.actor?.name || 'ally'}`, 3200);
    }
  },
});

seekerSkyDrop = createSeekerSkyDropManager({
  THREE,
  scene,
  camera,
  G,
  input,
  gun,
  groundHeightAt: (x, z, refY) => groundHeightAt(x, z, refY, false),
  findSafeSpawn,
  clamp,
  lerp,
});

// Wire Title Screen Gamertag Input & Randomizer Dice
{
  const nameIn = $('playerNameInput');
  if (nameIn) {
    nameIn.value = MP.getPlayerName();
    if (progression && progression.syncIdentity) progression.syncIdentity(nameIn.value);
    nameIn.addEventListener('input', () => {
      MP.setPlayerName(nameIn.value);
      if (progression && progression.syncIdentity) progression.syncIdentity(MP.getPlayerName());
    });
    nameIn.addEventListener('blur', () => {
      nameIn.value = MP.getPlayerName();
      if (progression && progression.syncIdentity) progression.syncIdentity(nameIn.value);
    });
  }
  const rollBtn = $('btnRollName');
  if (rollBtn) {
    rollBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      sfx.unlock();
      audio.tap();
      const next = MP.rollPlayerName();
      if (nameIn) nameIn.value = next;
      if (progression && progression.syncIdentity) progression.syncIdentity(next);
    });
  }
}

function pickSectorHiderStart(idx, avoidPos, placed) {
  // Spread 5 Hiders across distinct sectors >11m away from Seeker spawn so they physically run into rooms/perches!
  const candidates = [];
  for (const v of LIVE) {
    if (Math.hypot(v.c.x - avoidPos.x, v.c.z - avoidPos.z) > 11.5) {
      candidates.push({ x: v.c.x + rand(-2.2, 2.2), z: v.c.z + rand(-2.2, 2.2) });
    }
  }
  for (const eb of ENTER) {
    if (eb.door && Math.hypot(eb.door.x - avoidPos.x, eb.door.z - avoidPos.z) > 11.5) {
      candidates.push({ x: eb.door.x, z: eb.door.z });
    }
  }
  const targetAng = (idx / TEAM_SIZE) * Math.PI * 2 + rand(-0.35, 0.35);
  candidates.push({
    x: Math.sin(targetAng) * Math.min(MAPR * 0.56, 17),
    z: Math.cos(targetAng) * Math.min(MAPR * 0.56, 17),
  });
  let best = candidates[0], bestScore = -1e9;
  for (const c of candidates) {
    const dSeek = Math.hypot(c.x - avoidPos.x, c.z - avoidPos.z);
    const minPeer = placed.reduce((m, p) => Math.min(m, Math.hypot(c.x - p.x, c.z - p.z)), 99);
    const angDiff = Math.abs(normAng(Math.atan2(c.x, c.z) - targetAng));
    const sc = Math.min(dSeek, 24) * 0.5 + Math.min(minPeer, 14) * 0.8 - angDiff * 3.2 + rand(0, 1.5);
    if (sc > bestScore) { bestScore = sc; best = c; }
  }
  return findSafeSpawn(best.x, best.z, 0.50, placed, 1.8);
}

function startHide(roster = null) {
  if (!READY) return;
  flushPendingBVH();
  if (!roster || !roster.hiders) {
    roster = MP.buildInstantLocalRoster('hide', activeMapId, selectedSpirit, progression ? progression.getActiveElemGun() : 'water');
  }
  if (!roster._seriesStarted && !roster._isSwappedRound2) {
    roster._seriesStarted = true;
    if (progression) progression.resetMatchSessionCounter();
    if (matchFlow) matchFlow.startSeries(roster);
    if (analytics) analytics.matchStart({ mode: 'hide', map: activeMapId, online: !!(MP && MP.isLiveSession && MP.isLiveSession()), humans: roster.humanCount || 1 });
  }
  if (analytics) analytics.roundStart({ round: matchFlow ? matchFlow.getRoundNumber() : 1, mode: 'hide' });
  clearRound();
  AI.resetMatchIntel();
  AI.setDifficulty(hueLayer ? hueLayer.currentBotDifficulty() : 0.5);
  SEEK.mem = null; SEEK.visited.clear(); G.maxHp = BASE_HIDER_HP; G.hp = BASE_HIDER_HP; G.lastHit = -1e9; G._achSurviveFrac = 0;
  const prepT = roster.prepSeconds || ROUND.hide;
  G.huntDuration = roster.huntSeconds || ROUND.survive;
  Object.assign(G, {
    mode: 'hide', phase: 'hide', t: prepT, found: 0, wrong: 0,
    over: false, yaw: Math.PI, pitch: -0.25, transformCd: 0, locked: false,
    stillT: 0, stillWarned: false, boldSec: 0, specialLockT: 0,
    spectating: false, specTarget: null,
  });

  const liveNet = MP.isLiveSession();
  const amMaster = MP.isMaster();
  const prefP = (ACTIVE_MAP && ACTIVE_MAP.playerSpawn) || [-3, 6];
  const placed = [];
  const allHidersOrdered = [];

  // 1. Spawn all 5 Hider Spirits (Local Player + 4 Allies — real players or stealth AI!)
  for (let i = 0; i < TEAM_SIZE; i++) {
    const slot = roster.hiders[i];
    const isMe = slot.actorId === roster.localActorId;
    const isRemote = !isMe && (liveNet ? (!slot.isBot || !amMaster) : false);
    const spMap = isMe
      ? (selectedSpirit === 'auto' ? activeMapId : selectedSpirit)
      : (slot.isBot
        ? SPIRIT_CHAMPION_ORDER[(i + MAP_ORDER.indexOf(activeMapId) + 6) % SPIRIT_CHAMPION_ORDER.length]
        : (slot.spiritMap || activeMapId));
    const h = makePainter(false, { spiritMap: spMap, skin: isMe ? 'classic' : (slot.skin || 'classic'), slotIdx: i });
    if (progression) {
      const hatId = isMe
        ? progression.getEquipped('hat')
        : (!slot.isBot && slot.hat ? slot.hat : (h.userData?.isBlenderChampion ? 'none' : progression.pickRandomCosmeticHatForPeer(i + (slot.name ? slot.name.charCodeAt(0) : 0))));
      if (hatId && hatId !== 'none') progression.attachHatToChar(h, hatId);
    }
    attachActorMeta(h, {
      id: slot.actorId,
      name: slot.name,
      team: 'hiders',
      isBot: !!slot.isBot,
      isLocal: isMe,
      isRemote,
      slotIdx: i,
      showTag: !isMe,
    });
    const ang = (i / TEAM_SIZE) * Math.PI * 2;
    const rad = i === 0 ? 0 : 2.35;
    const hPos = findSafeSpawn(prefP[0] + Math.cos(ang) * rad, prefP[1] + Math.sin(ang) * rad, isMe ? 0.52 : 0.50, placed, 1.45);
    placed.push(hPos);
    h.position.copy(hPos);
    h.userData.groundY = hPos.y;
    if (isMe) {
      if (h.userData.skinColor == null && h.userData.paint) h.userData.paint.color.set(0xfff3dc);
      G.player = h;
      G.maxHp = BASE_HIDER_HP + getHiderBonusMaxHp(h);
      G.hp = G.maxHp;
    } else {
      AI.initHiderBot(h, i);
      G.hiders.push(h);
    }
    allHidersOrdered.push(h);
  }
  G.allHiders = allHidersOrdered;

  // 2. Spawn all 5 Seekers (blindfolded during Hide phase!)
  const prefS = (ACTIVE_MAP && ACTIVE_MAP.seekerSpawns) || [[-2.0, -2.2], [2.0, -2.2]];
  const allSeekersOrdered = [];
  for (let i = 0; i < TEAM_SIZE; i++) {
    const slot = roster.seekers[i];
    const isRemote = liveNet ? (!slot.isBot || !amMaster) : false;
    const s = makePainter(true, { kind: slot.seekerKind || SEEKER_CHAMPION_ORDER[i % SEEKER_CHAMPION_ORDER.length], slotIdx: i });
    attachActorMeta(s, {
      id: slot.actorId,
      name: slot.name,
      team: 'seekers',
      isBot: !!slot.isBot,
      isLocal: false,
      isRemote,
      slotIdx: i,
      showTag: false,
    });
    const sp0 = prefS[i % prefS.length];
    const sPos = findSafeSpawn(sp0[0] + (i - 2) * 1.15, sp0[1] + (i % 2) * 0.9, 0.50, placed, 1.32);
    placed.push(sPos);
    s.position.copy(sPos);
    s.userData.groundY = sPos.y;
    s.rotation.y = Math.PI;
    const skElem = (!slot.isBot && slot.elemGun)
      ? slot.elemGun
      : (progression ? progression.pickDeterministicElemGunForBot(`${roster.roomId || 'r'}_h_${i}`) : 'water');
    s.userData.elemGun = skElem;
    if (elementalGuns) elementalGuns.setSeekerElement(s, skElem);
    setEyes(s, false);
    AI.initSeekerBot(s, i, setMark);
    G.seekers.push(s);
    allSeekersOrdered.push(s);
  }
  G.allSeekers = allSeekersOrdered;

  gun.visible = false;
  showHud(); audio.music('hide');
  if (hiderTricks) hiderTricks.resetRound();
  if (seekerGadgets) seekerGadgets.resetRound();
  if (hueLayer) hueLayer.resetRound();
  if (elementalGuns) elementalGuns.updateHUD();
  if (worldEvents) worldEvents.resetRound({ seed: `${roster.roomId || 'r'}_${matchFlow ? matchFlow.getRoundNumber() : 1}` });
  if (seekerSkyDrop && seekerSkyDrop.beginBotOnlySkyDrop) {
    seekerSkyDrop.beginBotOnlySkyDrop({ prepDuration: prepT, mapRadius: MAPR });
  }
  if (viralHighlights) {
    viralHighlights.onRoundStart({
      roundNumber: matchFlow ? matchFlow.getRoundNumber() : 1,
      mode: 'hide',
      mapId: activeMapId,
      mapTitle: (MAP_REGISTRY[activeMapId] || MEADOW_DEF).title,
    });
  }
  pushFeed('🎭', '<b>5v5 Hide</b> · Your spirit squad is scrambling to hide!', 'ally');
  hint(ACTIVE_MAP && ACTIVE_MAP.hideIntroHint ? ACTIVE_MAP.hideIntroHint : '5v5 Hide! Morph into a prop, jump onto furniture, or slip indoors 🎭', 3800);
}

function startSeek(roster = null) {
  if (!READY) return;
  flushPendingBVH();
  if (!roster || !roster.seekers) {
    roster = MP.buildInstantLocalRoster('seek', activeMapId, selectedSpirit, progression ? progression.getActiveElemGun() : 'water');
  }
  if (!roster._seriesStarted && !roster._isSwappedRound2) {
    roster._seriesStarted = true;
    if (progression) progression.resetMatchSessionCounter();
    if (matchFlow) matchFlow.startSeries(roster);
    if (analytics) analytics.matchStart({ mode: 'seek', map: activeMapId, online: !!(MP && MP.isLiveSession && MP.isLiveSession()), humans: roster.humanCount || 1 });
  }
  if (analytics) analytics.roundStart({ round: matchFlow ? matchFlow.getRoundNumber() : 1, mode: 'seek' });
  clearRound();
  AI.resetMatchIntel();
  AI.setDifficulty(hueLayer ? hueLayer.currentBotDifficulty() : 0.5);
  const prepT = roster.prepSeconds || ROUND.seekReady;
  G.huntDuration = roster.huntSeconds || ROUND.seek;
  Object.assign(G, {
    mode: 'seek', phase: 'ready', t: prepT,
    shotsFired: 0, firing: false, fireCd: 0, found: 0, wrong: 0,
    over: false, yaw: Math.PI, pitch: -0.08, stillT: 0, boldSec: 0,
    spectating: false, specTarget: null,
  });

  const liveNet = MP.isLiveSession();
  const amMaster = MP.isMaster();
  const prefS = (ACTIVE_MAP && ACTIVE_MAP.seekSpawn) || [-2, -5];
  const baseSkSpawn = findSafeSpawn(prefS[0], prefS[1], 0.52);
  const baseYaw = Math.hypot(baseSkSpawn.x, baseSkSpawn.z) > 0.5 ? Math.atan2(baseSkSpawn.x, baseSkSpawn.z) : Math.PI;
  const fx = -Math.sin(baseYaw), fz = -Math.cos(baseYaw), rx = Math.cos(baseYaw), rz = -Math.sin(baseYaw);
  const formationOffsets = [[0, 0], [-2.05, -0.55], [2.05, -0.55], [-3.55, -1.35], [3.55, -1.35]];
  const placed = [];
  const allSeekersOrdered = [];

  // 1. Spawn all 5 Seekers (Local Player + 4 Seeker Teammates!)
  for (let i = 0; i < TEAM_SIZE; i++) {
    const slot = roster.seekers[i];
    const isMe = slot.actorId === roster.localActorId;
    const isRemote = !isMe && (liveNet ? (!slot.isBot || !amMaster) : false);
    const seekerChoice = isMe
      ? (selectedSeeker || 'ranger')
      : (slot.seekerKind || SEEKER_CHAMPION_ORDER[i % SEEKER_CHAMPION_ORDER.length]);
    const s = makePainter(true, { kind: seekerChoice, slotIdx: i });
    if (isMe) s.visible = false; // first-person view
    attachActorMeta(s, {
      id: slot.actorId,
      name: slot.name,
      team: 'seekers',
      isBot: !!slot.isBot,
      isLocal: isMe,
      isRemote,
      slotIdx: i,
      showTag: !isMe,
    });
    const [ox, oz] = formationOffsets[i % formationOffsets.length];
    const sPos = findSafeSpawn(baseSkSpawn.x + rx * ox + fx * oz, baseSkSpawn.z + rz * ox + fz * oz, isMe ? 0.52 : 0.50, placed, 1.32);
    placed.push(sPos);
    s.position.copy(sPos);
    s.userData.groundY = sPos.y;
    s.rotation.y = Math.atan2(-sPos.x, -sPos.z);
    const skElem = isMe
      ? (progression ? progression.getActiveElemGun() : (slot.elemGun || 'water'))
      : ((!slot.isBot && slot.elemGun)
        ? slot.elemGun
        : (progression ? progression.pickDeterministicElemGunForBot(`${roster.roomId || 'r'}_s_${i}`) : 'water'));
    s.userData.elemGun = skElem;
    if (isMe) {
      G.player = s;
      G.yaw = Math.hypot(sPos.x, sPos.z) > 0.5 ? Math.atan2(sPos.x, sPos.z) : Math.PI;
      if (elementalGuns) elementalGuns.selectElement(skElem, { silent: true, force: true });
    } else {
      setEyes(s, false);
      AI.initSeekerBot(s, i, setMark);
      G.seekers.push(s);
    }
    if (elementalGuns) elementalGuns.setSeekerElement(s, skElem);
    allSeekersOrdered.push(s);
  }
  G.allSeekers = allSeekersOrdered;

  // 2. Spawn all 5 Hiders across sectors (or hider spawn if human hiders are in the same live room)
  const prefP = (ACTIVE_MAP && ACTIVE_MAP.playerSpawn) || [-3, 6];
  const allHidersOrdered = [];
  for (let i = 0; i < TEAM_SIZE; i++) {
    const slot = roster.hiders[i];
    const isRemote = liveNet ? (!slot.isBot || !amMaster) : false;
    const h = makePainter(false, {
      spiritMap: slot.isBot
        ? SPIRIT_CHAMPION_ORDER[(i + MAP_ORDER.indexOf(activeMapId) + 6) % SPIRIT_CHAMPION_ORDER.length]
        : (slot.spiritMap || activeMapId),
      skin: slot.skin || 'classic',
      slotIdx: i,
    });
    if (progression) {
      const hatId = !slot.isBot && slot.hat
        ? slot.hat
        : (h.userData?.isBlenderChampion ? 'none' : progression.pickRandomCosmeticHatForPeer(i + (slot.name ? slot.name.charCodeAt(0) : 0)));
      if (hatId && hatId !== 'none') progression.attachHatToChar(h, hatId);
    }
    attachActorMeta(h, {
      id: slot.actorId,
      name: slot.name,
      team: 'hiders',
      isBot: !!slot.isBot,
      isLocal: false,
      isRemote,
      slotIdx: i,
      showTag: false,
    });
    let hPos;
    if (roster.hasHumanHiders) {
      const ang = (i / TEAM_SIZE) * Math.PI * 2;
      const rad = i === 0 ? 0 : 2.35;
      hPos = findSafeSpawn(prefP[0] + Math.cos(ang) * rad, prefP[1] + Math.sin(ang) * rad, 0.50, placed, 1.45);
    } else {
      hPos = pickSectorHiderStart(i, baseSkSpawn, placed);
    }
    placed.push(hPos);
    h.position.copy(hPos);
    h.userData.groundY = hPos.y;
    AI.initHiderBot(h, i);
    G.hiders.push(h);
    allHidersOrdered.push(h);
  }
  G.allHiders = allHidersOrdered;

  if (progression && progression.getActiveElemGun() === 'water' && progression.getEquipped('blaster') !== 'classic') {
    progression.applyBlasterSkin(gunMats);
  }
  showHud(); audio.music('seek');
  if (hiderTricks) hiderTricks.resetRound();
  if (seekerGadgets) seekerGadgets.resetRound();
  if (hueLayer) hueLayer.resetRound();
  if (elementalGuns) elementalGuns.updateHUD();
  if (worldEvents) worldEvents.resetRound({ seed: `${roster.roomId || 'r'}_${matchFlow ? matchFlow.getRoundNumber() : 1}` });
  if (seekerSkyDrop) {
    seekerSkyDrop.beginSkyDrop({ prepDuration: prepT, mapRadius: MAPR });
  } else {
    gun.visible = true;
  }
  if (viralHighlights) {
    viralHighlights.onRoundStart({
      roundNumber: matchFlow ? matchFlow.getRoundNumber() : 1,
      mode: 'seek',
      mapId: activeMapId,
      mapTitle: (MAP_REGISTRY[activeMapId] || MEADOW_DEF).title,
    });
  }
  pushFeed('🪂', '<b>Sky Drop!</b> Glide over the village while 5 spirits scramble to hide!', 'soak');
  hint('🪂 Parachute Drop! Scout the map & steer your landing while 5 spirits hide!', 3600);
}

// ============================================================ HUD & Spectator Controls
function showHud() {
  $('title').classList.remove('on');
  $('result').classList.remove('on');
  if ($('halftimeScreen')) $('halftimeScreen').classList.remove('on');
  if ($('queueScreen')) $('queueScreen').classList.remove('on');
  if ($('vsScreen')) $('vsScreen').classList.remove('on');
  $('hud').classList.remove('hidden');
  const hide = G.mode === 'hide';
  $('btnSample').classList.toggle('hidden', !hide);
  $('btnFreeze').classList.toggle('hidden', !hide);
  $('btnFire').classList.toggle('hidden', hide);
  const bi = $('btnInteract'); if (bi) bi.classList.add('hidden');
  if ($('specBar')) $('specBar').classList.add('hidden');
  $('btnSample').innerHTML = '<span class="ic">🎭</span><span>Transform</span>';
  $('btnFreeze').innerHTML = '<span class="ic">🔄</span><span>Rotate</span>';
  const mb = $('matchBox');
  mb.classList.toggle('hidden', !hide);
  mb.innerHTML = '<div class="dis"><small>disguised as</small><b id="disName">nothing!</b></div><div class="hue"><small>paint</small><div class="huebar"><i id="hueFill"></i></div></div><div class="sus"><small>seekers</small><div class="susbar"><i id="susFill"></i></div></div>';
  $('cross').classList.remove('prop', 'hit');
  $('cross').classList.toggle('hidden', hide);
  aimRing.visible = false; chipKey = ''; renderChips([]);
  if (mobileControls) mobileControls.refreshModeUI();
  updateHelp();
}
let hintT = 0;
function hint(txt, ms) { const h = $('hint'); h.textContent = txt; h.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('on'), ms || 2200); }

function aliveHidersList() {
  return (G.allHiders || []).filter((h) => h && !h.userData?.actor?.eliminated);
}

function cycleSpectatorTarget(step = 1) {
  const alive = aliveHidersList();
  if (!alive.length) {
    G.specTarget = null;
    if (viralHighlights) viralHighlights.setSpectating(false, []);
    return;
  }
  const curIdx = alive.indexOf(G.specTarget);
  G.specTarget = alive[(curIdx + step + alive.length) % alive.length];
  if (viralHighlights && G.spectating) {
    viralHighlights.setSpectating(true, alive);
  }
}

const _hudDom = {};
const _hudState = {};
function hudEl(key, fn) {
  let el = _hudDom[key];
  if (!el || !el.isConnected) {
    el = fn();
    _hudDom[key] = el;
  }
  return el;
}
function hudSetText(key, el, val) {
  if (el && _hudState[key] !== val) {
    _hudState[key] = val;
    el.textContent = val;
  }
}
function hudSetHtml(key, el, val) {
  if (el && _hudState[key] !== val) {
    _hudState[key] = val;
    el.innerHTML = val;
  }
}
function hudToggle(key, el, cls, on) {
  if (el && _hudState[key] !== on) {
    _hudState[key] = on;
    el.classList.toggle(cls, on);
  }
}

function updateHud() {
  const timerEl = hudEl('timer', () => $('timer'));
  if (G.isTutorial) {
    hudSetText('timerTxt', timerEl, tutorial ? tutorial.getStepProgressBadge() : '1/8');
  } else {
    const t = Math.max(0, Math.ceil(G.t));
    hudSetText('timerTxt', timerEl, String(t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : t));
  }
  const vig = hudEl('vig', () => document.querySelector('.vignette'));
  if (vig) hudToggle('vigBlind', vig, 'blindfold', false);
  const skyDropping = !!(seekerSkyDrop && seekerSkyDrop.isActive());
  const crossEl = hudEl('cross', () => $('cross'));
  hudToggle('crossHid', crossEl, 'hidden', G.mode === 'hide' || skyDropping);
  const actBox = hudEl('actBox', () => document.querySelector('#hud .actions'));
  hudToggle('actHid', actBox, 'hidden', skyDropping);

  const ph = hudEl('phaseLbl', () => $('phaseLbl'));
  const phStr = G.isTutorial
    ? (G.mode === 'seek' ? '🎓 Seeker Dojo' : '🎓 Spirit Dojo')
    : (G.mode === 'hide' ? (G.spectating ? 'Spectating' : (G.ghost ? '👻 Ghost' : (G.phase === 'hide' ? 'Hide!' : 'Survive'))) : (G.phase === 'ready' ? '🪂 Sky Drop' : 'Seek'));
  hudSetText('phaseTxt', ph, phStr);

  const phaseBox = hudEl('phaseBox', () => document.querySelector('.phase'));
  hudToggle('phaseUrg', phaseBox, 'urgent', !G.isTutorial && G.t < 6 && G.phase !== 'ready');

  const hAlive = aliveHidersList().length;
  const sCount = (G.allSeekers || []).length || TEAM_SIZE;
  const statEl = hudEl('statBox', () => $('statBox'));
  let statHtml;
  if (G.isTutorial) {
    statHtml = `<div class="team-row"><span class="team-pill">${G.mode === 'seek' ? '💦 Solo' : '🎭 Solo'}</span></div><small>Training Sanctuary</small>`;
  } else if (G.mode === 'seek') {
    const myKills = G.player?.userData?.actor?.eliminations || 0;
    statHtml = `<div class="team-row"><span class="team-pill">💦 ${sCount}</span><span class="team-vs">vs</span><span class="team-pill">🎭 ${hAlive}</span></div><small>${hAlive} left · you ${myKills}</small>`;
  } else {
    statHtml = `<div class="team-row"><span class="team-pill">🎭 ${hAlive}</span><span class="team-vs">vs</span><span class="team-pill">💦 ${sCount}</span></div><small>${hAlive}/${TEAM_SIZE} spirits alive</small>`;
  }
  hudSetHtml('statHtml', statEl, statHtml);

  const hpBox = hudEl('hpBox', () => $('hpBox'));
  const hideHp = G.mode !== 'hide' || G.spectating || G.ghost;
  hudToggle('hpHid', hpBox, 'hidden', hideHp);
  if (!hideHp) {
    const maxHp = G.maxHp || BASE_HIDER_HP;
    const hp = Math.max(0, G.hp ?? maxHp);
    const wPct = `${Math.round(clamp((hp / maxHp) * 100, 0, 100))}%`;
    const hpFill = hudEl('hpFill', () => $('hpFill'));
    if (hpFill && _hudState.hpW !== wPct) { _hudState.hpW = wPct; hpFill.style.width = wPct; }
    hudSetText('hpNum', hudEl('hpTxt', () => $('hpTxt')), String(Math.ceil(hp)));
    hudToggle('hpLow', hpBox, 'low', hp / maxHp < 0.35);
  }

  if (G.mode === 'hide' && G.player) {
    const focus = (G.spectating && G.specTarget) ? G.specTarget : G.player;
    const u = focus.userData;
    const dn = hudEl('disName', () => $('disName'));
    if (dn) {
      let propTxt = u.specialLabel ? u.specialLabel : (u.propId && KIT.props[u.propId] ? KIT.props[u.propId].label : (G.spectating ? 'Spirit (running!)' : (G.ghost ? '👻 a ghost' : 'nothing!')));
      if (!u.specialLabel && u.propId && KIT.props[u.propId]?.canFly) {
        const wingPct = Math.round(clamp(u.birdStamina ?? 1, 0, 1) * 100);
        propTxt += ` · 🪽 ${wingPct}%`;
      }
      hudSetText('disTxt', dn, G.spectating ? `${u.actor?.name || 'Ally'} · ${propTxt}` : propTxt);
    }
    let sus = 0;
    for (let i = 0; i < G.seekers.length; i++) {
      const sv = G.seekers[i].userData?.sus || 0;
      if (sv > sus) sus = sv;
    }
    const sf = hudEl('susFill', () => $('susFill'));
    if (sf) {
      const sw = `${Math.round(Math.min(100, sus * 100))}%`;
      const sbg = sus > 0.7 ? '#d9534f' : sus > 0.35 ? '#e8a33d' : '#6bbf59';
      if (_hudState.susW !== sw) { _hudState.susW = sw; sf.style.width = sw; }
      if (_hudState.susBg !== sbg) { _hudState.susBg = sbg; sf.style.background = sbg; }
    }
  }

  if ((G.spectating || G.ghost) && $('specBar')) {
    hudToggle('specBarHid', hudEl('specBar', () => $('specBar')), 'hidden', false);
    hudSetText('specTxt', hudEl('specTxt', () => $('specTxt')), G.spectating
      ? `💧 Soaked! Watching ${G.specTarget?.userData?.actor?.name || 'ally'} (${hAlive} alive)`
      : `👻 Ghost · ${hAlive} spirit${hAlive === 1 ? '' : 's'} still hiding`);
    if (G.ghost) hudSetText('specNextTxt', hudEl('btnSpecNext', () => $('btnSpecNext')), G.spectating ? '👻 Back to ghost' : '👁 Watch allies');
  }

  const bi = hudEl('btnInteract', () => $('btnInteract'));
  if (bi) {
    const inter = !G.over && !G.spectating && !G.ghost && G.phase !== 'menu' && G.phase !== 'ready' && G.player && ACTIVE_MAP && ACTIVE_MAP.getNearbyInteraction
      ? ACTIVE_MAP.getNearbyInteraction(G.player, G)
      : null;
    G.nearInteract = inter;
    hudToggle('intHid', bi, 'hidden', !inter);
    if (inter) {
      hudSetText('intIcon', hudEl('intIcon', () => $('intIcon')), inter.icon || '✨');
      hudSetText('intLbl', hudEl('intLbl', () => $('intLbl')), inter.label || 'Interact');
    }
  }
}

function maybePromptPlayReview(didWin) {
  try {
    if (typeof window === 'undefined' || !window.HueSeekNativeReview?.requestReview) return;
    const KEY_DONE = 'hueseek_play_review_requested_v1';
    const KEY_COUNT = 'hueseek_play_review_matches_v1';
    if (localStorage.getItem(KEY_DONE) === '1') return;
    const matches = (parseInt(localStorage.getItem(KEY_COUNT) || '0', 10) || 0) + 1;
    localStorage.setItem(KEY_COUNT, String(matches));
    // Trigger on a happy moment: after 2+ matches with a win, or after 3 completed matches
    if ((matches >= 2 && didWin) || matches >= 3) {
      localStorage.setItem(KEY_DONE, '1');
      setTimeout(() => {
        try { window.HueSeekNativeReview.requestReview(); } catch (_) { /* ignore */ }
      }, 2400);
    }
  } catch (_) { /* ignore storage/bridge errors */ }
}

function endRound(win, title, sub, emoji, fromNet = false) {
  if (G.over) return;
  clearTimeout(nonMasterEndTO);
  nonMasterEndTO = 0;
  G.over = true; G.phase = 'end'; G.firing = false; G.jumpHeld = false;
  if (G.player?.userData?.inTurret) dismountTurret(G.player, true);
  audio.setProximityDanger(0);
  if ($('dangerVignette')) $('dangerVignette').style.opacity = '0';
  if ($('feverBanner')) $('feverBanner').classList.add('hidden');
  if (viralHighlights) viralHighlights.setSpectating(false, []);
  if (win) haptics.victory();
  audio.music('end');
  if (!fromNet && MP && MP.isLiveSession() && MP.isMaster()) {
    const hidersWon = G.mode === 'hide' ? !!win : !win;
    MP.broadcastRoundEnd(hidersWon, sub);
  }
  if ($('specBar')) $('specBar').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  clearTimeout(endRoundTO);
  let cinematicPlayed = false;
  const finishRoundFlow = () => {
    if (G.phase !== 'end') return;
    if (matchFlow) {
      const roundNo = matchFlow.getRoundNumber();
      const res = matchFlow.handleRoundEnd({ win, title, sub, emoji, fromNet, cinematicPlayed });
      if (analytics && !G.isTutorial) {
        analytics.roundEnd({ round: roundNo, win: !!win, mode: G.mode });
        if (res && res.seriesOver) {
          const st = matchFlow.getSeriesState ? matchFlow.getSeriesState() : {};
          analytics.matchEnd({
            win: (st.yourSquadScore || 0) > (st.rivalSquadScore || 0),
            draw: (st.yourSquadScore || 0) === (st.rivalSquadScore || 0),
            yourScore: st.yourSquadScore || 0,
            rivalScore: st.rivalSquadScore || 0,
          });
        }
      }
      if (res && res.seriesOver) {
        if (progression && !G.isTutorial) {
          progression.consumeTrialElemGun();
          progression.recordAchievementStat('matchesCompleted', 1);
          if (elementalGuns) elementalGuns.selectElement(progression.getActiveElemGun(), { silent: true, force: true });
        }
        if (progression && $('resultRewardsSlot')) {
          progression.renderResultSummary($('resultRewardsSlot'));
        }
        if (genreKing && !G.isTutorial) {
          if (progression && win && G.mode === 'hide' && !(G._damageTaken > 0)) {
            progression.recordPersonaStat?.('stealthWins', 1);
          }
          genreKing.renderMatchAwards({
            mode: G.mode,
            won: Boolean(win),
            wrongSprays: G.wrong || 0,
            eliminations: G.player?.userData?.actor?.eliminations || 0,
            heroRescues: G._heroRescues || 0,
            boopsLanded: G._boopsLanded || 0,
            damageTaken: G._damageTaken || 0,
            overdriveClutch: Boolean(G._overdriveClutch || (win && G.t > 0 && G.t <= 25)),
            propsMorphed: G._propsMorphedRound || 0,
          });
          genreKing.renderBreakingNews({
            mapTitle: (MAP_REGISTRY[activeMapId] || MEADOW_DEF).title,
            playerName: playerHandle || 'Spirit',
            mode: G.mode,
            won: Boolean(win),
            wrongSprays: G.wrong || 0,
            eliminations: G.player?.userData?.actor?.eliminations || 0,
            heroRescues: G._heroRescues || 0,
            boopsLanded: G._boopsLanded || 0,
            wantedStars: G._wantedStars || 0,
            propsMorphed: G._propsMorphedRound || 0,
          });
          const unlockedMaps = MAP_ORDER.filter((m) => !progression || progression.isMapUnlocked(m));
          genreKing.initMapVote(unlockedMaps, activeMapId, MAP_SHORT_TITLES);
        }
        if (!G.isTutorial) maybePromptPlayReview(Boolean(win));
        if (MP) MP.leaveSession();
      }
      return;
    }
    if (progression && !G.isTutorial) {
      progression.consumeTrialElemGun();
      progression.recordAchievementStat('matchesCompleted', 1);
      if (elementalGuns) elementalGuns.selectElement(progression.getActiveElemGun(), { silent: true, force: true });
    }
    win ? audio.win() : audio.lose();
    $('rTitle').textContent = title; $('rSub').textContent = sub; $('rEmoji').textContent = emoji;
    $('result').classList.add('on');
  };
  endRoundTO = setTimeout(() => {
    if (G.phase !== 'end') return;
    // Final round of a series: the victory / defeat cinematic plays now and hands over to the stats.
    // (The round's highlight clip is still made on demand from the stats screen's Watch/Share buttons.)
    const finale = (matchFlow && !G.isTutorial && matchFlow.peekSeriesOutcome) ? matchFlow.peekSeriesOutcome() : null;
    if (finale) {
      cinematicPlayed = true;
      endCinematic.play({
        outcome: finale.won ? 'victory' : (finale.draw ? 'draw' : 'defeat'),
        yourScore: finale.yourScore,
        rivalScore: finale.rivalScore,
        mapTitle: (MAP_REGISTRY[activeMapId] || MEADOW_DEF).title,
        onDone: finishRoundFlow,
      });
      return;
    }
    if (viralHighlights && !G.isTutorial) {
      viralHighlights.playRoundHighlight(finishRoundFlow);
      return;
    }
    finishRoundFlow();
  }, 350);
}

function requestAuthoritativeRoundEnd(win, title, sub, emoji) {
  if (G.over) return;
  if (MP && MP.isLiveSession() && !MP.isMaster()) {
    if (!nonMasterEndTO) {
      nonMasterEndTO = setTimeout(() => {
        nonMasterEndTO = 0;
        if (!G.over && G.phase !== 'menu' && G.phase !== 'vs') {
          endRound(win, title, sub, emoji);
        }
      }, 1150);
    }
    return;
  }
  endRound(win, title, sub, emoji);
}

// ============================================================ player actions
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
aimRing.rotation.x = -Math.PI / 2; aimRing.visible = false; aimRing.renderOrder = 2; scene.add(aimRing);
const _nearCache = { x: 1e9, y: 1e9, z: 1e9, maxD: -1, mapId: '', ts: 0, res: [] };
function nearbyProps(maxD, forceRefresh = false) {
  const p = G.player.position;
  const py = (G.player.userData?.groundY ?? p.y ?? 0) + (G.player.userData?.jy || 0);
  const now = performance.now();
  if (
    !forceRefresh &&
    _nearCache.mapId === activeMapId &&
    _nearCache.maxD === maxD &&
    now - _nearCache.ts < 120 &&
    Math.abs(p.x - _nearCache.x) + Math.abs(py - _nearCache.y) + Math.abs(p.z - _nearCache.z) < 0.16
  ) {
    return _nearCache.res;
  }
  const best = new Map();
  for (const r of realProps) {
    const isFlyProp = !!KIT.props[r.id]?.canFly;
    const maxVert = isFlyProp ? 3.2 : 2.1;
    if (Math.abs((r.pos.y || 0) - py) > maxVert) continue;
    const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
    const effMaxD = isFlyProp ? Math.max(maxD, 3.6 + (r.radius || 0.5)) : maxD;
    if (d > effMaxD) continue;
    if (!best.has(r.id) || best.get(r.id).d > d) best.set(r.id, { rec: r, d });
  }
  const res = [...best.values()].sort((a2, b2) => a2.d - b2.d).slice(0, 3);
  _nearCache.x = p.x; _nearCache.y = py; _nearCache.z = p.z;
  _nearCache.maxD = maxD; _nearCache.mapId = activeMapId; _nearCache.ts = now;
  _nearCache.res = res;
  return res;
}
const PROP_ICON = { barrel: '🛢️', crate: '📦', hay_round: '🌾', hay_bale: '🌾', milk_can: '🥛', bucket: '🪣', flower_pot: '🪴', watering_can: '🚿', lantern_post: '🏮', stool: '🪑', veg_basket: '🧺', flour_sack: '🎒', pumpkin: '🎃', log_pile: '🪵', cart_wheel: '☸️', mailbox: '📮',
  armchair: '🛋️', rocking_chair: '🪑', grandfather_clock: '🕰️', stove: '🔥', laundry_basket: '🧺', cushion_pile: '🛏️', potted_fern: '🌿', chest: '🧳', spinning_wheel: '🧶', butter_churn: '🧈', lamp_table: '🪔', book_stack: '📚',
  wheelbarrow: '🛒', saddle: '🐎', feed_trough: '🥣', grain_sack: '🌾', flour_sacks: '🥖', bread_basket: '🍞', peel_barrel: '🛢️', chicken_crate: '🐔', tool_rack: '🔱', lantern_stool: '🏮' };
function renderChips(list) {
  const key = G.mode === 'hide' && !G.over && !G.spectating ? list.map((x) => x.rec.id).join(',') : '';
  if (!key) {
    if (chipKey !== '' || ($('chips') && $('chips').innerHTML !== '')) {
      chipKey = ''; chipList = [];
      if ($('chips')) $('chips').innerHTML = '';
    }
    return;
  }
  if (key === chipKey) return;
  chipKey = key; chipList = list;
  const propIconOf = (id) => (ACTIVE_MAP && ACTIVE_MAP.propIcons && ACTIVE_MAP.propIcons[id]) || PROP_ICON[id] || '🎭';
  $('chips').innerHTML = list.map((x, i) => `<button class="chip" data-i="${i}"><span>${propIconOf(x.rec.id)}</span><b>${KIT.props[x.rec.id].label}</b>${isTouch ? '' : `<kbd>${i + 1}</kbd>`}</button>`).join('');
}
function transformTo(rec) {
  if (G.mode !== 'hide' || G.over || G.spectating || G.ghost || !rec) return;
  if (G.transformCd > 0) { hint('Catching your breath…', 900); return; }
  const prevPropId = G.player?.userData?.propId || null;
  if (!disguise(G.player, rec.id)) return;
  if (genreKing) genreKing.onCleanDisguiseSwap(G.player, rec.id, prevPropId);
  G._propsMorphedRound = (G._propsMorphedRound || 0) + 1;
  G.player.rotation.y = rec.g.rotation.y;
  const quickMorph = getCharHiderPerk(G.player) === 'quick_morph';
  G.transformCd = G.phase === 'hide' ? 0.25 : (quickMorph ? 1.5 : 2.5);
  chipKey = '';
  splash(centerOf(G.player), 30, 2.5); audio.poof();
  if (progression) {
    progression.spawnPoofVfx(centerOf(G.player));
    if (!G.isTutorial) progression.recordAchievementStat('propsMorphed', 1);
  }
  if (mobileControls) mobileControls.haptic('medium');
  G.poofAt = performance.now(); G.poofPos = G.player.position.clone();
  if (G.phase === 'survive') AI.emitSoundCue(G.player.position, quickMorph ? 7.2 : 10.0, 'poof', G.player);
  if (KIT.props[rec.id]?.canFly) {
    hint(`✨ You're a ${KIT.props[rec.id].label}! Hold Jump (Space / 🪽) to soar & move mouse or drag to look around!`, 3100);
  } else {
    hint(`You're a ${KIT.props[rec.id].label.toLowerCase()}! Slip into a gap next to the others 🤫`, 2000);
  }
}
function findAimedProp(maxDist = 8.5) {
  if (!G.player || G.mode !== 'hide' || G.over || G.spectating || G.ghost) return null;
  const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  const origin = camera.position;
  const p = G.player.position;
  let bestRec = null;
  let bestScore = Infinity;
  for (const r of realProps) {
    if (!r || !r.pos || !KIT?.props?.[r.id]) continue;
    const distFromPlayer = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
    if (distFromPlayer > maxDist) continue;
    const ry = (r.pos.y || 0) + (r.height || 0.8) * 0.5;
    const dx = r.pos.x - origin.x, dy = ry - origin.y, dz = r.pos.z - origin.z;
    const along = dx * look.x + dy * look.y + dz * look.z;
    if (along < 0.8 || along > maxDist + 6) continue;
    const perpSq = (dx * dx + dy * dy + dz * dz) - along * along;
    const tol = Math.max(0.68, (r.radius || 0.45) + 0.35);
    if (perpSq <= tol * tol) {
      const score = Math.sqrt(Math.max(0, perpSq)) + distFromPlayer * 0.08;
      if (score < bestScore) { bestScore = score; bestRec = r; }
    }
  }
  return bestRec;
}
function togglePosLock(forceState = null) {
  if (G.mode !== 'hide' || G.over || G.spectating || G.ghost) { G.posLocked = false; return; }
  const disguised = !!(G.player?.userData?.propId || G.player?.userData?.specialMode);
  if (!disguised) {
    G.posLocked = false;
    if (forceState === null) hint('Morph into a prop first to lock your spot 🔒', 1200);
    syncPosLockBtn();
    return;
  }
  G.posLocked = typeof forceState === 'boolean' ? forceState : !G.posLocked;
  syncPosLockBtn();
  if (forceState === null) {
    audio.tap();
    if (mobileControls) mobileControls.haptic('light');
    hint(G.posLocked ? '🔒 Spot locked! Look around freely without moving.' : '🔓 Unlocked — free to move!', 1300);
  }
}
function syncPosLockBtn() {
  const btn = $('btnPosLock');
  if (!btn) return;
  const show = G.mode === 'hide' && !G.over && !G.spectating && !G.ghost && !!(G.player?.userData?.propId || G.player?.userData?.specialMode);
  btn.classList.toggle('hidden', !show);
  btn.classList.toggle('is-locked', Boolean(show && G.posLocked));
  btn.innerHTML = G.posLocked ? '<span class="ic">🔒</span><span>Locked</span>' : '<span class="ic">🔓</span><span>Lock</span>';
}
function spawnDamagePopup(worldPos, text, kind = '') {
  if (typeof document === 'undefined' || !worldPos) return;
  try {
    const v = worldPos.clone().project(camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 26;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight - 14 + (Math.random() - 0.5) * 14;
    const el = document.createElement('div');
    el.className = `dmg-pop${kind ? ' ' + kind : ''}`;
    el.textContent = text;
    el.style.left = `${Math.round(clamp(x, 36, window.innerWidth - 36))}px`;
    el.style.top = `${Math.round(clamp(y, 44, window.innerHeight - 44))}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  } catch (_) { /* ignore */ }
}
function triggerEmote(emoji) {
  if (!emoji || typeof document === 'undefined') return;
  const now = performance.now();
  if (now - (G._lastEmoteAt || 0) < 1100) return;
  G._lastEmoteAt = now;
  audio.emotePop ? audio.emotePop() : audio.tap();
  if (mobileControls) mobileControls.haptic('light');
  const el = document.createElement('div');
  el.className = 'hs-emote-float';
  el.textContent = emoji;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
  if (G.player) spawn3DEmoteBubble(G.player, emoji);
  const act = G.player?.userData?.actor;
  if (MP && MP.isLiveSession() && act) {
    MP.broadcastGadget({ k: 'emote', e: String(emoji).slice(0, 4), t: act.team === 'seekers' ? 1 : 0, s: act.slotIdx ?? 0 });
  }
  const name = act?.name || 'You';
  pushFeed(emoji === 'GG' ? '🤝' : emoji, `<b>${name}</b> reacted ${emoji}`, 'ally');
  const bar = $('hsEmoteBar');
  if (bar && !G.over) bar.classList.add('hidden');
  const trig = $('btnEmoteToggle');
  if (trig) trig.classList.remove('is-open');
}
function transform() {
  if (G.ghost) { if (hueLayer) hueLayer.tryHaunt(); return; }
  if (G.spectating) return;
  const aimed = findAimedProp(8.5);
  if (aimed) { transformTo(aimed); return; }
  const n = nearbyProps(3.6, true)[0];
  if (n) transformTo(n.rec);
  else hint('Aim at or walk up to a prop to copy it 🎭', 1300);
}
function rotateProp(dir) {
  if (G.mode !== 'hide' || G.over || G.spectating || G.ghost || (!G.player.userData.propId && !G.player.userData.specialMode)) return;
  G.player.rotation.y += dir * Math.PI / 4; G.rotatedT = 0.6; audio.creak();
}
function triggerInteract() {
  const p = G.player;
  if (!p || G.over || G.spectating || G.ghost || G.phase === 'menu' || G.phase === 'ready') return;
  const u = p.userData;
  if (u.inTurret) {
    dismountTurret(p, false);
    return;
  }
  const inter = ACTIVE_MAP && ACTIVE_MAP.getNearbyInteraction ? ACTIVE_MAP.getNearbyInteraction(p, G) : null;
  if (!inter) {
    if (u.specialMode) {
      exitSpecialSpot(p, false);
      hint('Stepped out of your special hiding spot!', 1200);
    } else if (ACTIVE_MAP && ACTIVE_MAP.getNearbyInteraction) {
      const customHint = typeof ACTIVE_MAP.getInteractHint === 'function' ? ACTIVE_MAP.getInteractHint(G.mode) : ACTIVE_MAP.interactHint;
      hint(
        customHint || (
          activeMapId === 'meadow'
            ? (G.mode === 'seek'
              ? 'Stand near the Town Square Sky-Turret 🎯, dinner bell, flour cord, or cellar valves!'
              : 'Stand near a haystack, scarecrow post, well bucket, minecart, dinner bell or flour cord ✨')
            : (G.mode === 'seek'
              ? 'Look for interactive world secrets, contraptions, bells & passages ✨'
              : 'Look for interactive world secrets, passages & contraptions ✨')
        ),
        1500
      );
    }
    return;
  }
  if (inter.kind === 'turret') {
    if (G.mode === 'seek') {
      mountTurret(p);
    }
    return;
  }
  if (inter.kind === 'lift' || inter.kind === 'mechanism') {
    const fn = inter.kind === 'lift' ? ACTIVE_MAP.triggerPulleyLift : ACTIVE_MAP.triggerMechanism;
    const msg = fn ? fn(p, inter, G) : null;
    audio.creak();
    if (msg) hint(msg, 2100);
    if (MP && MP.isLiveSession()) {
      MP.broadcastGadget({
        k: 'map_mech',
        kind: inter.kind,
        id: inter.id || '',
        t: u.actor?.team === 'seekers' ? 1 : 0,
        s: u.actor?.slotIdx ?? 0,
        x: +(inter.x ?? p.position.x).toFixed(1),
        z: +(inter.z ?? p.position.z).toFixed(1),
      });
    }
    return;
  }
  if (inter.kind === 'ride_path') {
    if (u.specialMode) exitSpecialSpot(p, true);
    const startFootY = (u.groundY || 0) + (u.jy || 0);
    u.ridePath = {
      t: 0,
      dur: inter.dur || 1.55,
      x0: inter.fromX ?? p.position.x,
      y0: inter.fromY ?? startFootY,
      z0: inter.fromZ ?? p.position.z,
      x1: inter.toX,
      y1: inter.toY,
      z1: inter.toZ,
      arcY: inter.arcY ?? 0.65,
    };
    u.vy = 0; u.jy = 0; u.gliding = false;
    audio.creak();
    splash(centerOf(p), 18, 2.0);
    if (progression && !G.isTutorial) progression.recordAchievementStat('airPlays', 1);
    if (inter.enterHint) hint(inter.enterHint, 2200);
    return;
  }
  if (inter.kind === 'rail_chain' && Array.isArray(inter.points) && inter.points.length >= 2) {
    if (u.specialMode) exitSpecialSpot(p, true);
    const pts = inter.points;
    let bestIdx = 0, bestD2 = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dx = p.position.x - pts[i][0], dz = p.position.z - pts[i][2];
      const dy = ((u.groundY || 0) + (u.jy || 0)) - pts[i][1];
      const d2 = dx * dx + dz * dz + dy * dy * 0.5;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
    const dir = (typeof inter.dir === 'number') ? inter.dir : (bestIdx >= pts.length - 1 ? -1 : 1);
    const nextIdx = clamp(bestIdx + dir, 0, pts.length - 1);
    const segIdx = dir > 0 ? Math.min(bestIdx, pts.length - 2) : Math.max(0, nextIdx);
    const segT = dir > 0 ? 0 : 1;
    u.rideRail = {
      points: pts,
      segIdx,
      segT,
      dir,
      speed: inter.speed || 13.5,
      elapsed: 0,
      loop: !!inter.loop,
      canJumpOff: inter.canJumpOff !== false,
      exitBoostVy: inter.exitBoostVy || 6.6,
      dropOffsetY: inter.dropOffsetY ?? 0,
    };
    u.vy = 0; u.jy = 0; u.gliding = false;
    audio.creak();
    splash(centerOf(p), 16, 2.0);
    if (progression && !G.isTutorial) progression.recordAchievementStat('airPlays', 1);
    if (inter.enterHint) hint(inter.enterHint, 2300);
    return;
  }
  if (G.mode !== 'hide') return;
  if (u.specialMode && u.specialMode === inter.kind) {
    exitSpecialSpot(p, false);
    hint(inter.exitHint || 'Stepped out of your hiding spot!', 1300);
    return;
  }
  enterSpecialSpot(p, inter, false);
}
function playerFire() {
  if (G.mode !== 'seek' || G.phase !== 'seek' || G.over) return;
  G.shotsFired++;
  const activeTurret = getActiveTurret();
  const inTurret = !!(G.player?.userData?.inTurret && activeTurret);
  const shotCfg = elementalGuns ? elementalGuns.getShotParams(G.player) : { elemId: 'water', shotSpeed: 30, gravityMul: 1, spread: 0.012 };
  haptics.fireGun(inTurret ? 'turret' : (shotCfg.elemId || 'water'));
  const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  if (inTurret) {
    const tur = activeTurret;
    tur.setAim(G.yaw, G.pitch);
    const rayOrigin = camera.position.clone().addScaledVector(look, 2.15);
    ray.set(rayOrigin, look); ray.far = 92; ray.firstHitOnly = true;
    const hit = ray.intersectObjects(solids, false)[0];
    ray.firstHitOnly = false;
    const aim = hit ? hit.point.clone() : camera.position.clone().addScaledVector(look, 85);
    const from = tur.getMuzzleWorld();
    const tOpts = tur.getFireOpts ? tur.getFireOpts(shotCfg) : {};
    const SPD = tOpts.shotSpeed || 62;
    const gMul = tOpts.gravMulOverride ?? 0.10;
    const t = aim.distanceTo(from) / SPD;
    aim.y += 0.5 * GRAV * gMul * t * t;
    const dir = aim.sub(from).normalize();
    const sp = tOpts.spread ?? 0.0045;
    dir.x += rand(-sp, sp); dir.y += rand(-sp * 0.6, sp * 0.6); dir.z += rand(-sp, sp); dir.normalize();
    tur.playShotSound();
    fire(from, dir, G.player, SPD, false, tOpts.elemId || shotCfg.elemId || 'water', {
      isAntiAir: true,
      gravMulOverride: gMul,
      lifeOverride: tOpts.lifeOverride ?? 2.6,
      scaleOverride: tOpts.scaleOverride ?? 1.45,
    });
    return;
  }
  ray.set(camera.position, look); ray.far = 32; ray.firstHitOnly = true;
  const hit = ray.intersectObjects(solids, false)[0];
  ray.firstHitOnly = false;
  const aim = hit ? hit.point.clone() : camera.position.clone().addScaledVector(look, 30);
  gun.updateWorldMatrix(true, false);
  const from = gun.localToWorld(new THREE.Vector3(0, 0, -0.4));
  const evtMul = worldEvents ? (worldEvents.getShotSpeed() / 30) : 1;
  const SPD = (shotCfg.shotSpeed || 30) * evtMul * (hueLayer ? hueLayer.getShotSpeedMul() : 1);
  const t = aim.distanceTo(from) / SPD;
  const gMul = shotCfg.gravityMul ?? 1;
  aim.y += 0.5 * GRAV * gMul * t * t;
  const dir = aim.sub(from).normalize();
  const sp = shotCfg.spread ?? 0.012;
  dir.x += rand(-sp, sp); dir.y += rand(-sp * 0.7, sp); dir.z += rand(-sp, sp); dir.normalize();
  fire(from, dir, G.player, SPD, false, shotCfg.elemId);
  gun.position.z = -0.43;
  G._gunRecoil = Math.min(1, (G._gunRecoil || 0) + 0.45);
  addCamTrauma(0.055);
}

// ============================================================ movement, vaulting & physics
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, t); }
function moveChar(ch, dx, dz) {
  const u = ch.userData;
  const R = (u.radius || 0.45) * (u.colliderScale ?? 1);
  const curY = u.groundY ?? groundHeightAt(ch.position.x, ch.position.z);
  const curFootY = curY + (u.jy || 0);
  // Airborne leg-tuck clearance lets jumping players & AI smoothly vault over or onto chairs, crates, tables & barrels!
  const isVaulting = (u.jy || 0) > 0.16 && (u.vy || 0) > -2.5;
  const stepClimbLimit = isVaulting ? 1.24 : 0.88;

  const blockedTerrain = (tx, tz) => {
    const inRoom = ENTER.length ? whereIs(tx, tz, curFootY) : null;
    const nearDoor = !inRoom && ENTER.some((b) =>
      Math.abs(curFootY - b.g.position.y) < 1.65 &&
      ((b.door && Math.hypot(tx - b.door.x, tz - b.door.z) < 1.65) ||
       (b.doorIn && Math.hypot(tx - b.doorIn.x, tz - b.doorIn.z) < 1.65))
    );
    if (!inRoom && !nearDoor && ACTIVE_MAP && ACTIVE_MAP.isDeepWater && ACTIVE_MAP.isDeepWater(tx, tz)) return true;
    if (ch !== G.player && !inRoom && !nearDoor && ACTIVE_MAP && ACTIVE_MAP.isSkyGap && ACTIVE_MAP.isSkyGap(tx, tz) && !u.gliding) return true;
    const ny = groundHeightAt(tx, tz, curFootY, isVaulting);
    return ny - curFootY > stepClimbLimit;
  };
  let x = ch.position.x + dx, z = ch.position.z + dz;
  // Smooth tangential radial slide right along the physical boulder/stone-wall/hedgerow perimeter!
  const dInit = Math.hypot(x, z);
  if (dInit > MAPR) { x *= MAPR / dInit; z *= MAPR / dInit; }
  if (blockedTerrain(x, z)) {
    const tx = ch.position.x + dx, tz = ch.position.z + dz;
    if (!blockedTerrain(tx, ch.position.z)) { x = tx; z = ch.position.z; }
    else if (!blockedTerrain(ch.position.x, tz)) { x = ch.position.x; z = tz; }
    else { x = ch.position.x; z = ch.position.z; }
  }
  for (const b of blockers) {
    if (b.disabled) continue;
    if (typeof b.maxR === 'number' && R <= b.maxR) continue;
    const own = u.ownBox === b;
    if (own || !blockerOverlapsY(b, curFootY, isVaulting)) continue;
    if (b.obb) {
      if (x < b.x0 - R || x > b.x1 + R || z < b.z0 - R || z > b.z1 + R) continue;
      const o = b.obb; let [lx, lz] = obbLocal(o, x, z);
      const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz), ex = lx - qx, ez = lz - qz, d2 = ex * ex + ez * ez;
      if (d2 >= R * R) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); lx = qx + (ex / d) * R; lz = qz + (ez / d) * R; }
      else { const l = lx + o.hx, r = o.hx - lx, f = lz + o.hz, k = o.hz - lz, m = Math.min(l, r, f, k); if (m === l) lx = -o.hx - R; else if (m === r) lx = o.hx + R; else if (m === f) lz = -o.hz - R; else lz = o.hz + R; }
      [x, z] = obbWorld(o, lx, lz);
      continue;
    }
    const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1);
    const ex = x - cx, ez = z - cz, d2 = ex * ex + ez * ez;
    if (d2 < R * R) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); x = cx + (ex / d) * R; z = cz + (ez / d) * R; }
      else { const l = x - b.x0, r = b.x1 - x, f = z - b.z0, k = b.z1 - z, m = Math.min(l, r, f, k); if (m === l) x = b.x0 - R; else if (m === r) x = b.x1 + R; else if (m === f) z = b.z0 - R; else z = b.z1 + R; }
    }
  }
  const d = Math.hypot(x, z); if (d > MAPR) { x *= MAPR / d; z *= MAPR / d; }
  if (blockedTerrain(x, z)) { x = ch.position.x; z = ch.position.z; }
  ch.position.x = x; ch.position.z = z;
  const nextGroundY = groundHeightAt(x, z, curFootY, isVaulting);
  if ((u.jy || 0) > 0.02 || (u.vy || 0) > 0.05 || (curY - nextGroundY > 0.28)) {
    u.jy = Math.max(0, curFootY - nextGroundY);
  }
  u.groundY = nextGroundY;
}

const _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4(), _sc = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _vn = new THREE.Vector3(), _prev = new THREE.Vector3(), _seg = new THREE.Vector3();
let crossHitTO = 0;

function updateShots(dt) {
  const livingHiders = (G.allHiders || []).filter((h) => h && !h.userData?.actor?.eliminated);
  for (let i = shots.length - 1; i >= 0; i--) {
    const d = shots[i];
    let st = dt;
    if (d.delay > 0) { d.delay -= dt; if (d.delay > 0) continue; st = -d.delay; d.delay = 0; }
    d.life -= st;
    _prev.copy(d.p);
    if (!d._prevP) d._prevP = new THREE.Vector3();
    d._prevP.copy(_prev);
    d.v.y -= GRAV * (d.gravMul ?? 1) * st;
    d.p.addScaledVector(d.v, st);
    if (elementalGuns) elementalGuns.updateProjectiles([d], st);
    _seg.subVectors(d.p, _prev); const len = _seg.length(); d.trav += len;
    const dElem = d.elem || 'water';
    let dead = d.life <= 0 || d.p.y < -12.0;
    if (d.grp) { if (d.trav >= d.grp.hit) dead = true; }
    else if (d.col && len > 0) {
      let hitP = null, along = len;
      const segDir = _seg.clone().divideScalar(len || 1);
      for (const t of livingHiders) {
        const airborneTarget = (t.userData.jy || 0) > 0.55;
        const c = centerOf(t);
        const rr = Math.max(0.52, (t.userData.radius || 0.45) + 0.14) + (d.isAntiAir && airborneTarget ? 0.54 : (airborneTarget ? 0.20 : 0));
        const tt = clamp(c.clone().sub(_prev).dot(_seg) / (len * len), 0, 1);
        const q = _prev.clone().addScaledVector(_seg, tt);
        if (q.distanceTo(c) < rr) {
          hitP = q; along = tt * len;
          if (elementalGuns) {
            elementalGuns.onCharacterImpact({ elemId: dElem, victim: t, shooter: d.shooter, point: q, dir: segDir });
          }
          if (d.remoteVisual) {
            if (dElem === 'water') splash(q, 10, 2.5);
          } else {
            onCharHit(t, d.shooter, { elemId: dElem, isAntiAir: !!d.isAntiAir });
          }
          break;
        }
      }
      if (!hitP && hiderTricks && !d.remoteVisual) {
        const decHit = hiderTricks.testWaterSegmentHit(_prev, _seg, len, d.shooter);
        if (decHit) {
          hitP = decHit.hitPoint;
          along = decHit.along;
          if (d.shooter === G.player && !G.isTutorial && progression) {
            progression.recordAchievementStat('tacticalPlays', 1);
          }
          if (elementalGuns) {
            elementalGuns.onWorldImpact({ elemId: dElem, point: hitP, normal: _up, shooter: d.shooter, dir: segDir });
          }
        }
      }
      if (!hitP) {
        ray.set(_prev, segDir); ray.far = len; ray.firstHitOnly = true;
        const h = ray.intersectObjects(solids, false)[0];
        ray.firstHitOnly = false;
        if (h) {
          hitP = h.point; along = h.distance;
          const worldNorm = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize() : _up.clone();
          if (elementalGuns) {
            elementalGuns.onWorldImpact({ elemId: dElem, point: h.point, normal: worldNorm, face: h.face, hitObject: h.object, shooter: d.shooter, dir: segDir });
          }
          const mapHit = ACTIVE_MAP?.onShotWorldImpact?.({
            elemId: dElem,
            hitObject: h.object,
            point: h.point,
            normal: worldNorm,
            shooter: d.shooter,
            isRemote: !!d.remoteVisual,
            dir: segDir,
            G,
          });
          if (!mapHit?.consumed) {
            if (h.object.userData.propRoot && !h.object.userData.propRoot.isAnimal && genreKing) {
              genreKing.onRealPropHit(h.object.userData.propRoot, h.point, segDir);
            }
            if (h.object.userData.propRoot?.isAnimal) {
              const pr = h.object.userData.propRoot;
              if (pr.isWildFlyingBird && pr.onTurretHit) {
                pr.onTurretHit(getMeadowSimSec(simNow() / 1000), d.shooter?.position || camera.position);
              } else {
                pr.onStartled?.(
                  getMeadowSimSec(simNow() / 1000),
                  d.shooter?.position || camera.position
                );
              }
            }
            if (d.shooter === G.player && dElem !== 'air') {
              if (h.object.userData.propRoot?.isWildFlyingBird) {
                if (performance.now() - (G._lastWildBirdHintAt || 0) > 3200) {
                  G._lastWildBirdHintAt = performance.now();
                  hint(
                    ACTIVE_MAP?.wildFlyerHint ||
                      (activeMapId === 'meadow'
                        ? '🪶 Wild village bird! Watch for Hiders flapping or soaring as Storks & Herons!'
                        : '🪶 Wild creature soaring overhead! Watch for Hiders flying or gliding in disguise!'),
                    1800
                  );
                }
              } else {
                const skPerk = getCharSeekerPerk(G.player);
                const goggleMul = (skPerk === 'clear_goggles' || skPerk === 'grand_inquisitor') ? 0.5 : 1;
                const penSec = (worldEvents ? worldEvents.getWrongPropPenaltySec() : 2) * goggleMul;
                if (penSec > 0 && h.object.userData.propRoot && performance.now() - G.lastPenalty > 1100) {
                  G.lastPenalty = performance.now();
                  if (G.isTutorial) {
                    hint(`💡 Real ${KIT.props[h.object.userData.propRoot.id].label.toLowerCase()}! (Costs −2s in 5v5 — aim at the glowing 🎯 target!)`, 1600);
                    audio.wrong();
                  } else {
                    G.t = Math.max(0, G.t - penSec); G.wrong++;
                    if (MP && MP.isLiveSession()) {
                      MP.broadcastGadget({ k: 'time_pen', s: G.player.userData?.actor?.slotIdx ?? 0, sec: penSec });
                    }
                    const crW = $('cross');
                    if (crW) { crW.classList.add('wrong'); setTimeout(() => crW.classList.remove('wrong'), 180); }
                    const tmEl = $('timer');
                    if (tmEl) { tmEl.classList.remove('timer-pen-shake'); void tmEl.offsetWidth; tmEl.classList.add('timer-pen-shake'); }
                    spawnDamagePopup(h.point, `−${penSec}s`, 'pen');
                    hint(`Just a real ${KIT.props[h.object.userData.propRoot.id].label.toLowerCase()}! −${penSec}s`, 1100); audio.wrong();
                  }
                }
              }
            }
          }
          if (dElem === 'water') {
            if (h.object.userData.ground) { puddle(h.point); ripple(h.point, 0.42); splash(h.point, 3, 1.35); }
            else splash(h.point, 4, 1.55);
          }
        } else {
          const gy = groundHeightAt(d.p.x, d.p.z, _prev.y) + 0.02;
          if (d.p.y <= gy) {
            const k = (_prev.y - gy) / Math.max(1e-4, _prev.y - d.p.y);
            hitP = _prev.clone().addScaledVector(_seg, clamp(k, 0, 1)); hitP.y = gy; along = clamp(k, 0, 1) * len;
            if (elementalGuns) {
              elementalGuns.onWorldImpact({ elemId: dElem, point: hitP, normal: _up, shooter: d.shooter, dir: segDir });
            }
            ACTIVE_MAP?.onShotWorldImpact?.({
              elemId: dElem,
              hitObject: null,
              point: hitP,
              normal: _up,
              shooter: d.shooter,
              isRemote: !!d.remoteVisual,
              dir: segDir,
              G,
            });
            if (dElem === 'water') {
              puddle(hitP); ripple(hitP, 0.42); splash(hitP, 3, 1.35);
            }
          }
        }
      }
      if (hitP) {
        d.lead.hit = d.trav - len + along;
        dead = true;
        if (dElem === 'water') audio.splash(hitP.x, hitP.z);
      }
    } else if (!d.col && d.p.y < groundHeightAt(d.p.x, d.p.z, _prev.y) + 0.03) {
      dead = true;
      if (dElem === 'water' && Math.random() < 0.15) puff(d.p, 1, 0.3, 0.18, 0.3, 0.1);
    }
    if (dead) shots.splice(i, 1);
  }
  // draw elemental stream & projectile instances
  if (elementalGuns) {
    elementalGuns.renderElementalShots(shots, dt);
  } else {
    let n = 0;
    for (const d of shots) {
      if (d.delay > 0 || n >= DMAX) continue;
      const sp = d.v.length(); _vn.copy(d.v).divideScalar(sp || 1); _q.setFromUnitVectors(_up, _vn);
      const r = (d.grow ? Math.min(d.r, 0.03 + d.trav * 0.035) : d.r) * Math.min(1, d.life * 5);
      _sc.set(r, r * (1 + Math.min(sp * d.stretch, 4)), r);
      _m4.compose(d.p, _q, _sc); dropI.setMatrixAt(n++, _m4);
    }
    dropI.count = n; dropI.instanceMatrix.needsUpdate = true;
  }
  // mist
  mistMat.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const damp = Math.max(0, 1 - 2.2 * dt);
  for (let k = 0; k < MISTN; k++) {
    if (mLife[k] <= 0) { if (mAlpha[k] !== 0) { mAlpha[k] = 0; mPos[k * 3 + 1] = -50; } continue; }
    mLife[k] -= dt;
    mVel[k * 3] *= damp; mVel[k * 3 + 1] = mVel[k * 3 + 1] * damp - 0.6 * dt; mVel[k * 3 + 2] *= damp;
    mPos[k * 3] += mVel[k * 3] * dt; mPos[k * 3 + 1] += mVel[k * 3 + 1] * dt; mPos[k * 3 + 2] += mVel[k * 3 + 2] * dt;
    const t = 1 - Math.max(0, mLife[k]) / mMax[k];
    mAlpha[k] = 0.55 * (1 - t) * Math.min(1, t * 8); mSize[k] = mBase[k] * (0.6 + t * 1.6);
  }
  mistGeo.attributes.position.needsUpdate = true; mistGeo.attributes.size.needsUpdate = true; mistGeo.attributes.alpha.needsUpdate = true;
  for (const r of ripples) { if (r.t >= 1) continue; r.t += dt * 1.5; r.m.scale.setScalar(r.s * (0.15 + r.t)); r.m.material.opacity = 0.75 * (1 - r.t) * (1 - r.t); if (r.t >= 1) r.m.visible = false; }
  for (let i = puddles.length - 1; i >= 0; i--) {
    const q = puddles[i]; q.t += dt;
    q.s += (q.target - q.s) * Math.min(1, dt * 5); q.m.scale.setScalar(q.s);
    q.m.material.opacity = 0.5 * Math.min(1, q.t * 5) * (q.t > 2.4 ? Math.max(0, 1 - (q.t - 2.4) / 1.6) : 1);
    if (q.t >= 4.0) { scene.remove(q.m); q.m.material.dispose(); puddles.splice(i, 1); }
  }
}

function onCharHit(ch, shooterChar, netOpts = null) {
  if (G.over || !ch || ch.userData?.actor?.eliminated) return;
  const fromNet = !!(netOpts && netOpts.fromNet);
  const isBurnDot = !!(netOpts && netOpts.isBurnDot);
  const customDmg = netOpts && typeof netOpts.customDmg === 'number' ? netOpts.customDmg : null;
  const elemId = (netOpts && netOpts.elemId) || (elementalGuns ? elementalGuns.getSeekerElement(shooterChar) : (shooterChar?.userData?.elemGun || 'water'));
  const elemSpec = getElementSpec(elemId);
  const now = simNow();
  // Snappy per-target hit-tick gate (105ms normally, 70ms in Overtime Frenzy); Fire Burn DoT ticks independently!
  const hitGateMs = (worldEvents && worldEvents.isOvertimeFrenzy && worldEvents.isOvertimeFrenzy()) ? 70 : 105;
  if (!fromNet && !isBurnDot && customDmg == null && now - (ch.userData.lastHitTick || -1e9) < hitGateMs) return;
  if (!isBurnDot) ch.userData.lastHitTick = now;

  const u = ch.userData;
  u._hpAuthLockUntil = performance.now() + 850;
  const isPlayerShooter = shooterChar === G.player;
  const isPlayerVictim = ch === G.player;
  const isAntiAirHit = !!(netOpts && netOpts.isAntiAir) || !!shooterChar?.userData?.inTurret;
  const baseElemDmg = elementalGuns ? elementalGuns.getHitDamage(elemId) : 7;
  const wellBoostMul = (isPlayerShooter && hueLayer && !fromNet) ? hueLayer.getDamageMul() : 1;
  // Bot seekers soak a human hider more gently at low bot skill, so being found starts a chase you can win (0.5× .. 1×).
  const botVsHumanMul = (isPlayerVictim && !fromNet && shooterChar?.userData?.actor?.isBot && !G.isTutorial) ? lerp(0.5, 1, AI.getDifficulty()) : 1;
  const dmg = customDmg != null ? customDmg : (G.isTutorial ? 10 : Math.round(baseElemDmg * (isAntiAirHit && (u.jy || 0) > 0.55 ? 1.55 : 1) * wellBoostMul * botVsHumanMul));

  // Anti-Air Wing-Clip Shoot-Down when hitting an airborne flying-bird Hider!
  if (!isBurnDot && isFlyingBirdChar(ch) && (u.jy || 0) > 0.55) {
    u._airHitCount = (u._airHitCount || 0) + (isAntiAirHit ? 2 : 1);
    if (u._airHitCount >= 2 && now > (u.birdShotDownUntil || 0)) {
      u._airHitCount = 0;
      u._birdLandedClip = false;
      u.birdShotDownUntil = now + 4500;
      u.gliding = false;
      u.birdClimbing = false;
      u.vy = Math.min(u.vy || 0, -7.2);
      splash(centerOf(ch), 26, 3.3);
      if (viralHighlights) {
        const birdLbl = KIT?.props?.[u.propId]?.label || 'Legendary Bird';
        viralHighlights.recordTurretSnipe({
          seeker: shooterChar,
          target: ch,
          propLabel: birdLbl,
          altitude: (u.groundY || 0) + (u.jy || 0),
          pos: ch.position.clone(),
        });
      }
      if (isPlayerShooter) {
        hint('🎯 Direct Anti-Air Hit! Shot the flying bird down out of the sky!', 2100);
        pushFeed('🎯', '<b>Sky-Turret Hit!</b> Clipped a flying bird out of the sky!', 'soak');
      }
      if (isPlayerVictim) {
        hint('💥 Shot out of the sky! Wings clipped — dropping!', 2200);
      }
    }
  }

  if (shooterChar && getCharSeekerPerk(shooterChar) === 'grand_inquisitor' && !isBurnDot) {
    u.inquisitorRevealUntil = now + 1800;
    ripple(ch.position, 0.72);
  }

  if (isPlayerShooter) {
    const cr = $('cross');
    if (cr) {
      cr.classList.add('hit');
      clearTimeout(crossHitTO);
      crossHitTO = setTimeout(() => cr.classList.remove('hit'), 130);
    }
    const prevHitAt = G._hitStreakAt || 0;
    G._hitStreak = (now - prevHitAt < 650) ? Math.min(10, (G._hitStreak || 0) + 1) : 0;
    G._hitStreakAt = now;
    const curHpBefore = isPlayerVictim ? (G.hp ?? BASE_HIDER_HP) : (u.ai?.hp ?? BASE_HIDER_HP);
    const willElim = curHpBefore - dmg <= 0;
    if (!isBurnDot) audio.hitConfirm(G._hitStreak, willElim);
    if (!isBurnDot && genreKing && u.disguise) genreKing.onFakePlayerHit(ch, centerOf(ch));
    spawnDamagePopup(centerOf(ch), willElim ? '💦 SOAKED!' : `-${dmg}`, willElim ? 'elim' : (dmg >= 10 ? 'crit' : ''));
    if (progression && !G.isTutorial && customDmg == null) {
      progression.recordAchievementStat('blasterHits', 1);
    }
  }
  if (isPlayerVictim) G._damageTaken = (G._damageTaken || 0) + dmg;
  // Tactile prop jolt bounce whenever a disguised prop gets hit
  if (u.disguise && !isBurnDot) {
    u._hitJoltT = 0.16;
  }

  // Every hit washes some paint off the disguise (water most of all)
  if (hueLayer && !isBurnDot) hueLayer.onHiderHit(ch, elemId);

  // Alert AI brain (triggers real-player escape juke on AI hiders + team sighting broadcast for seekers!)
  AI.onHiderDamaged(ch, shooterChar);

  let remainingHp = 0;
  if (isPlayerVictim) {
    G.hp = fromNet && typeof netOpts.netHp === 'number'
      ? Math.max(0, netOpts.netHp)
      : Math.max(0, (G.hp ?? BASE_HIDER_HP) - dmg);
    G.lastHit = now;
    remainingHp = G.hp;
    const hb = $('hpBox'); hb.classList.remove('hit'); void hb.offsetWidth; hb.classList.add('hit');
    const hu = $('hurt'); hu.classList.add('on'); clearTimeout(G.hurtTO); G.hurtTO = setTimeout(() => hu.classList.remove('on'), 95);
    const isElimNow = remainingHp <= 0 || !!(fromNet && netOpts.netElim);
    if (!isBurnDot) haptics.takeHit(dmg >= 35 || isElimNow);
    if (matchFlow) matchFlow.onHiderHit(ch, shooterChar, isElimNow);
    if (!fromNet && MP) MP.broadcastHit(ch, shooterChar, dmg, remainingHp, remainingHp <= 0);
    if (!isElimNow) {
      if (now - (u.lastAdrenalineAt || -1e9) > 3400) {
        u.lastAdrenalineAt = now;
        u.adrenalineUntil = now + 2400;
        if (!G._startleHintAt || now - G._startleHintAt > 20000) {
          G._startleHintAt = now;
          hint(`💨 Spotted! You get a burst of speed — run and break line of sight${isTouch ? '' : ' (X dash · C decoy)'}!`, 2000);
        }
      }
      const hpRatio = remainingHp / (G.maxHp || BASE_HIDER_HP);
      if (hpRatio <= 0.52) {
        u._lowHpEscapeArmedAt = now;
        u._lowHpMinSeen = Math.min(u._lowHpMinSeen ?? remainingHp, remainingHp);
      }
      if (hpRatio <= 0.35 && getCharHiderPerk(ch) === 'phantom_mirage' && hiderTricks) {
        if (hiderTricks.triggerEmergencyMirage(ch)) {
          hint('🪞 Phantom Mirage! Emergency clone deployed!', 1600);
          if (!G.isTutorial && viralHighlights && viralHighlights.recordJuke) {
            viralHighlights.recordJuke({
              actor: ch,
              kind: 'mirage',
              propId: u.propId,
              nearSeekers: Math.max(1, countNearbySeekers(ch.position, 18)),
              pos: ch.position.clone(),
            });
          }
        }
      }
      if (hpRatio < 0.36 && !G.lowHint) {
        G.lowHint = true;
        hint('💧 Almost soaked! Sprint, jump over furniture & break line of sight!', 1900);
      }
      return;
    }
  } else {
    const ai = u.ai;
    if (!ai) return;
    ai.hp = fromNet && typeof netOpts.netHp === 'number'
      ? Math.max(0, netOpts.netHp)
      : Math.max(0, (ai.hp ?? BASE_HIDER_HP) - dmg);
    remainingHp = ai.hp;
    const isElimNow = remainingHp <= 0 || !!(fromNet && netOpts.netElim);
    if (matchFlow) matchFlow.onHiderHit(ch, shooterChar, isElimNow);
    if (!fromNet && MP) MP.broadcastHit(ch, shooterChar, dmg, remainingHp, remainingHp <= 0);
    if (!isElimNow) {
      if (now - (u.lastAdrenalineAt || -1e9) > 3400) {
        u.lastAdrenalineAt = now;
        u.adrenalineUntil = now + 1350;
      }
      const aiHpRatio = remainingHp / (ai.maxHp || BASE_HIDER_HP);
      if (aiHpRatio <= 0.50) {
        u._lowHpEscapeArmedAt = now;
        u._lowHpMinSeen = Math.min(u._lowHpMinSeen ?? remainingHp, remainingHp);
      }
      if (aiHpRatio <= 0.35 && getCharHiderPerk(ch) === 'phantom_mirage' && hiderTricks) {
        if (hiderTricks.triggerEmergencyMirage(ch) && !G.isTutorial && viralHighlights && viralHighlights.recordJuke) {
          viralHighlights.recordJuke({
            actor: ch,
            kind: 'mirage',
            propId: u.propId,
            nearSeekers: Math.max(1, countNearbySeekers(ch.position, 18)),
            pos: ch.position.clone(),
          });
        }
      }
      if (isPlayerShooter && !isBurnDot && now - (u.lastFleeHint || 0) > 3200) {
        u.lastFleeHint = now;
        hint(G.isTutorial ? `${elemSpec.icon} Direct hit! Keep spraying to soak the disguised Spirit!` : `${elemSpec.icon} Tag! That prop's making a run for it — stay on it!`, 1200);
      }
      return;
    }
  }

  // ---- Hider Eliminated (Soaked to 0 HP!) ----
  if (shooterChar) {
    const skPerk = getCharSeekerPerk(shooterChar);
    if (skPerk === 'relentless_hunter' || skPerk === 'grand_inquisitor') {
      if (seekerGadgets) seekerGadgets.refundCooldownsFraction(shooterChar, 0.5);
      if (shooterChar.userData) shooterChar.userData.hunterSprintUntil = now + 4500;
      if (isPlayerShooter) {
        pushFeed('⚡', '<b>Relentless Hunter!</b> +22% Sprint &amp; −50% Gadget Cooldowns!', 'soak');
      }
    }
  }
  const wasLabel = u.specialLabel || (u.propId && KIT.props[u.propId] ? KIT.props[u.propId].label : 'Spirit');
  if (viralHighlights && !G.isTutorial && G.t > 0 && G.t <= 25) {
    viralHighlights.recordClutchTag({
      seeker: shooterChar,
      target: ch,
      propLabel: wasLabel,
      timeLeft: G.t,
      pos: ch.position.clone(),
    });
  }
  u.actor.eliminated = true;
  if (u.ai) {
    u.ai.state = 'eliminated';
    u.ai.anim = 0;
    if (u.ai.slot) { u.ai.slot.taken = null; u.ai.slot = null; }
  }
  if (u.nameplate) u.nameplate.visible = false;
  const bustedPropId = u.propId || null;
  if (bustedPropId) spawnElimPropLaunch(ch, bustedPropId);
  undisguise(ch);
  if (isPlayerShooter || isPlayerVictim) {
    addCamTrauma(isPlayerShooter ? 0.52 : 0.65);
    G._hitstopT = 0.048;
  }
  if (isPlayerShooter) {
    const nowK = performance.now();
    G._killStreak = (nowK - (G._lastKillAt || 0) <= 14500) ? ((G._killStreak || 0) + 1) : 1;
    G._lastKillAt = nowK;
    if (genreKing && genreKing.isOverdriveActive()) G._overdriveClutch = true;
    if (genreKing) genreKing.claimWantedBounty(ch, shooterChar);
    if (G._killStreak >= 2) {
      showKillStreakBanner(G._killStreak);
      if (audio.streakFanfare) audio.streakFanfare(G._killStreak);
    }
  }
  if (u.paint) u.paint.color.set(isPlayerVictim ? 0xd8f1ff : (u.skinColor ?? 0xfff3dc));
  if (elemId === 'water') {
    splash(centerOf(ch), 42, 4.2);
  } else if (elementalGuns) {
    elementalGuns.onCharacterImpact({ elemId, victim: ch, shooter: shooterChar, point: centerOf(ch), isBomb: true });
    elementalGuns.onWorldImpact({ elemId, point: new THREE.Vector3(ch.position.x, u.groundY || ch.position.y || 0, ch.position.z), normal: _up, shooter: shooterChar, isBomb: false });
  }

  if (shooterChar?.userData?.actor) shooterChar.userData.actor.eliminations++;
  G.found = (G.allHiders || []).filter((h) => h.userData?.actor?.eliminated).length;
  const alive = aliveHidersList();

  const sName = shooterChar?.userData?.actor?.name || 'Seeker';
  const vName = u.actor?.name || 'Spirit';
  const verbCap = elemSpec.verb ? (elemSpec.verb.charAt(0).toUpperCase() + elemSpec.verb.slice(1)) : 'Soaked';
  if (isPlayerShooter && progression && !G.isTutorial) {
    progression.recordAchievementStat('spiritsSoaked', 1);
    progression.awardTokens('soak_spirit', 20, `${elemSpec.icon} ${verbCap} ${vName}! +20 🪙`);
  }
  if ((isPlayerShooter || isPlayerVictim) && mobileControls) {
    mobileControls.haptic('heavy');
  }
  const sameTeamAsShooter = shooterChar?.userData?.actor?.team === G.player?.userData?.actor?.team;
  pushFeed(elemSpec.icon, `<b>${sName}</b> ${elemSpec.verb || 'soaked'} <b>${vName}</b> (${wasLabel})`, sameTeamAsShooter ? 'soak' : 'warn');
  audio.found(isPlayerVictim);

  if (G.mode === 'seek') {
    if (isPlayerShooter) {
      hint(['Gotcha! 💦', 'Soaked! 🎉', `That was no ${wasLabel.toLowerCase()}! ✨`][G.found % 3], 1200);
    }
    if (G.isTutorial) {
      if (tutorial) tutorial.onDummySoaked(ch);
      return;
    }
    if (alive.length === 0) {
      const myKills = G.player?.userData?.actor?.eliminations || 0;
      requestAuthoritativeRoundEnd(true, 'All 5 Spirits Soaked!', `${fmtTime(G.t)} left · You soaked ${myKills}/5 · ${G.wrong} wrong sprays`, '🏆');
    } else if (genreKing && !u._bubbleUsed) {
      u._bubbleUsed = true;
      genreKing.trapInBubbleCage(ch);
      pushFeed('🫧', `<b>${vName}</b> trapped in a Water Bubble (12s) — guard it from rescuing allies!`, 'soak');
    }
    return;
  }

  // Hide · 5v5 Mode
  if (alive.length === 0) {
    requestAuthoritativeRoundEnd(false, 'Squad Soaked!', 'All 5 spirits on your team were tracked down.', '💦');
    return;
  }
  // Pillar 3: Water Bubble-Cage Teammate Rescue (12s window when at least 1 living teammate can save you!)
  if (!G.isTutorial && genreKing && !u._bubbleUsed && alive.length >= 1) {
    u._bubbleUsed = true;
    genreKing.trapInBubbleCage(ch);
    pushFeed('🫧', `<b>${vName}</b> is trapped in a Water Bubble! Touch them within 12s to RESCUE!`, 'warn');
    if (isPlayerVictim) {
      hint('🫧 Trapped in a Water Bubble for 12s! Call an ally to pop you free!', 3200);
    }
    return;
  }
  if (isPlayerVictim) {
    // Soaked — but not out: roam as a ghost and haunt props to pull seekers off your allies!
    G.spectating = false;
    G.specTarget = alive[0];
    G.locked = false;
    $('btnSample').classList.add('hidden');
    $('btnFreeze').classList.add('hidden');
    if ($('btnInteract')) $('btnInteract').classList.add('hidden');
    renderChips([]);
    aimRing.visible = false;
    if (hueLayer) hueLayer.becomeGhost(ch); else { G.spectating = true; ch.visible = false; }
    updateHelp();
    if ($('specBar')) {
      $('specBar').classList.remove('hidden');
      if ($('btnSpecEnd')) $('btnSpecEnd').textContent = (MP && MP.isLiveSession()) ? 'Leave Match' : 'Results';
    }
    if (viralHighlights && G.spectating) viralHighlights.setSpectating(true, alive);
    hint(G.ghost
      ? `👻 Soaked! You're a ghost now — ${isTouch ? 'tap Haunt' : 'press F'} near props to fool the seekers. ${alive.length} spirit${alive.length === 1 ? '' : 's'} still alive!`
      : `💧 Soaked! Spectating ${G.specTarget.userData.actor?.name || 'ally'} — ${alive.length} spirit${alive.length === 1 ? '' : 's'} still alive!`, 3400);
  } else if (G.spectating && G.specTarget === ch) {
    G.specTarget = alive[0];
    if (viralHighlights) viralHighlights.setSpectating(true, alive);
  }
}

// ============================================================ input (mouse-look lock on desktop · stick + look on touch)
let joy = null, look = null;
const cvs = renderer.domElement;
const locked = () => document.pointerLockElement === cvs;
cvs.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (G.phase === 'menu' || G.over) return;
  if (e.pointerType === 'mouse') {
    if (!locked()) {
      try {
        const pl = cvs.requestPointerLock?.();
        if (pl && typeof pl.catch === 'function') pl.catch(() => {});
      } catch (_err) { /* noop */ }
      if (G.isTutorial && e.button === 0 && G.mode === 'seek') G.firing = true;
      return;
    }
    if (G.spectating) { if (e.button === 0) cycleSpectatorTarget(1); return; }
    if (e.button === 0 && G.mode === 'seek') G.firing = true;
    if (e.button === 0 && G.mode === 'hide') transform();
    if (e.button === 2 && G.mode === 'hide') rotateProp(1);
    return;
  }
  const left = e.clientX < innerWidth * 0.45;
  if (left && !joy && !G.spectating) {
    joy = { id: e.pointerId, x: e.clientX, y: e.clientY };
    const b = $('joyBase'); b.classList.remove('hidden'); b.style.left = e.clientX + 'px'; b.style.top = e.clientY + 'px'; $('joyKnob').style.transform = '';
  } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { cvs.setPointerCapture(e.pointerId); } catch (er) { /* noop */ }
});
cvs.addEventListener('contextmenu', (e) => e.preventDefault());
let lastDragMouseX = null, lastDragMouseY = null;
document.addEventListener('mousedown', (e) => {
  lastDragMouseX = e.clientX;
  lastDragMouseY = e.clientY;
});
document.addEventListener('mouseup', () => {
  lastDragMouseX = null;
  lastDragMouseY = null;
});
document.addEventListener('mousemove', (e) => {
  const isLocked = locked();
  const canDragLook = !isLocked && ((e.buttons & 1) || (e.buttons & 2)) &&
    G.phase !== 'menu' && G.phase !== 'vs' && !G.over &&
    !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest?.('#title, #queueScreen, #result, #halftimeScreen')));
  if (!isLocked && !canDragLook) {
    lastDragMouseX = e.clientX;
    lastDragMouseY = e.clientY;
    return;
  }
  let dx = e.movementX || 0;
  let dy = e.movementY || 0;
  if (!isLocked && dx === 0 && dy === 0 && lastDragMouseX !== null && lastDragMouseY !== null) {
    dx = e.clientX - lastDragMouseX;
    dy = e.clientY - lastDragMouseY;
  }
  lastDragMouseX = e.clientX;
  lastDragMouseY = e.clientY;
  const maxPitch = G.player?.userData?.inTurret ? 1.48 : (G.mode === 'seek' ? 1.22 : 1.05);
  G.yaw -= dx * 0.0024;
  G.pitch = clamp(G.pitch - dy * 0.0022, -1.22, maxPitch);
});
cvs.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') return;
  if (joy && e.pointerId === joy.id) {
    let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const l = Math.hypot(dx, dy), m = 55;
    input.sprint = l > m * 1.2;
    $('joyBase').classList.toggle('sprint', input.sprint);
    if (l > m) { dx *= m / l; dy *= m / l; }
    $('joyKnob').style.transform = `translate(${dx}px,${dy}px)`;
    input.mx = dx / m; input.mz = dy / m;
  } else if (look && e.pointerId === look.id) {
    const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
    const maxPitch = G.player?.userData?.inTurret ? 1.48 : (G.mode === 'seek' ? 1.22 : 1.05);
    const magScale = (G.mode === 'seek' && mobileControls && mobileControls.getAimAssistTouchScale)
      ? mobileControls.getAimAssistTouchScale()
      : 1;
    const sensScale = (mobileControls && mobileControls.getTouchSensitivity) ? mobileControls.getTouchSensitivity() : 1;
    G.yaw -= dx * 0.0055 * magScale * sensScale; G.pitch = clamp(G.pitch - dy * 0.0042 * magScale * sensScale, -1.22, maxPitch);
  }
});
const endPtr = (e) => {
  if (e.pointerType === 'mouse') { if (e.button === 0) G.firing = false; return; }
  if (joy && e.pointerId === joy.id) { joy = null; input.mx = input.mz = 0; input.sprint = false; $('joyBase').classList.add('hidden'); }
  if (look && e.pointerId === look.id) look = null;
};
cvs.addEventListener('pointerup', endPtr); cvs.addEventListener('pointercancel', endPtr);
document.addEventListener('pointerlockchange', () => { if (!locked()) G.firing = false; updateHelp(); });
addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  input.keys[e.code] = true; sfx.unlock();
  if (e.repeat) return;
  if (G.spectating && (e.code === 'Space' || e.code === 'Tab' || e.code === 'KeyN')) { e.preventDefault(); cycleSpectatorTarget(1); return; }
  if (hueLayer && hueLayer.handleKeyDown(e)) return;
  if (G.ghost && e.code !== 'Space' && e.code !== 'KeyM') return;
  if (hiderTricks) hiderTricks.handleKeyDown(e);
  if (seekerGadgets) seekerGadgets.handleKeyDown(e);
  if (elementalGuns) elementalGuns.handleKeyDown(e);
  if (e.code === 'KeyF') transform();
  if (e.code === 'KeyG' && !e._elemGunHandled) triggerInteract();
  if (G.mode === 'hide' && !G.spectating && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { const c = chipList[+e.code.slice(5) - 1]; if (c) transformTo(c.rec); }
  if (e.code === 'KeyE') rotateProp(-1);
  if (e.code === 'KeyQ') rotateProp(1);
  if (e.code === 'KeyL') togglePosLock();
  if (e.code === 'KeyB' && genreKing) genreKing.triggerBoopOrBait(G.player);
  if (e.code === 'KeyZ') triggerLocalSquadPing();
  if (e.code === 'KeyY') {
    const eb = $('hsEmoteBar');
    if (eb && G.phase !== 'menu') eb.classList.toggle('hidden');
  }
  if (e.code === 'KeyR' && !G.spectating && G.player && (G.player.userData.propId || G.player.userData.specialMode) && G.mode === 'hide') {
    undisguise(G.player);
    if (progression) progression.spawnPoofVfx(centerOf(G.player));
    audio.poof(true);
    hint('Back to yourself', 900);
  }
  if (e.code === 'Space') { e.preventDefault(); G.jumpHeld = true; jump(); }
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => {
  input.keys[e.code] = false;
  if (e.code === 'Space') G.jumpHeld = false;
});
addEventListener('blur', () => { G.jumpHeld = false; });

function doCharJump(ch, vy = 7.8) {
  if (!ch) return;
  if (isFlyingBirdChar(ch) && simNow() < (ch.userData.birdShotDownUntil || 0)) return;
  const elemJumpMul = elementalGuns ? elementalGuns.getHiderJumpMultiplier(ch) : 1;
  if (elemJumpMul <= 0.05) return; // Crystal frozen — cannot jump until thaw!
  let perkJumpMul = 1;
  if (ch.userData?.actor?.team === 'seekers') {
    if (getCharSeekerPerk(ch) === 'swift_boots') perkJumpMul = 1.12;
  } else {
    const hp = getCharHiderPerk(ch);
    if (hp === 'feather_hop') perkJumpMul = 1.16;
    else if (hp === 'grove_sovereign') perkJumpMul = 1.12;
  }
  const surfJumpMul = ACTIVE_MAP?.getSurfaceModifier?.(ch, G)?.jumpMul ?? 1;
  ch.userData.vy = vy * elemJumpMul * perkJumpMul * surfJumpMul;
  ch.userData.jy = Math.max(0.04, ch.userData.jy || 0);
  ch.userData.groundedAt = -1e9;
  ch.userData._jumpStretchT = 0.22;
  spawnDustPuff(ch.position, 4);
  if (ch === G.player) {
    G.jumpBufT = 0;
    audio.jump();
  }
}
function jump() {
  const p = G.player;
  if (!p || G.over || G.spectating || G.phase === 'menu' || G.phase === 'ready') return;
  if (G.posLocked) togglePosLock(false);
  if (p.userData.inTurret) { dismountTurret(p, false); return; }
  if (p.userData.customPilot && ACTIVE_MAP?.triggerMechanism) {
    const inter = ACTIVE_MAP.getNearbyInteraction ? ACTIVE_MAP.getNearbyInteraction(p, G) : null;
    if (inter) { ACTIVE_MAP.triggerMechanism(p, inter, G); return; }
    p.userData.customPilot = null;
  }
  if (p.userData.specialMode) { exitSpecialSpot(p, false); }
  if (isFlyingBirdChar(p)) {
    const elemJumpMul = elementalGuns ? elementalGuns.getHiderJumpMultiplier(p) : 1;
    if (elemJumpMul <= 0.05) return;
    if (simNow() < (p.userData.birdShotDownUntil || 0)) {
      hint('💥 Wings clipped! Recovering on the ground…', 1100);
      return;
    }
    const curFootY = (p.userData.groundY || 0) + (p.userData.jy || 0);
    const flyDef = KIT?.props?.[p.userData.propId];
    const flyMaxY = flyDef?.flyMaxY || 13.5;
    if ((p.userData.birdStamina ?? 1) > 0.04 && curFootY < flyMaxY && !INSIDE) {
      p.userData.vy = Math.max(5.5, Math.min(7.2, (p.userData.vy || 0) + 4.6));
      p.userData.jy = Math.max(0.10, p.userData.jy || 0);
      p.userData.gliding = true;
      p.userData.birdClimbing = true;
      p.userData.birdStamina = Math.max(0, (p.userData.birdStamina ?? 1) - 0.055);
      p.userData._lastFlapSfxAt = simNow();
      playWingFlapSound(audio, 0.85, flyDef?.flapPitch ?? 1.0);
      haptics.wingFlap(p.userData.propId === 'mb_roc' ? 'huge' : (p.userData.propId === 'mb_heron' ? 'large' : 'larger'));
      if (progression && !G.isTutorial && simNow() - (G._lastAirLaunchAchAt || 0) > 4000) {
        G._lastAirLaunchAchAt = simNow();
        progression.recordAchievementStat('airPlays', 1);
      }
    }
    return;
  }
  const now = performance.now();
  const onGround = (p.userData.jy || 0) <= 0.06 || (now - (p.userData.groundedAt || -1e9) < 120);
  if (!onGround) {
    G.jumpBufT = 0.15;
    return;
  }
  doCharJump(p, 7.8);
}

function updateHelp() {
  const h = $('help');
  if (isTouch || G.phase === 'menu' || !G.mode) { h.innerHTML = ''; return; }
  const k = (x) => `<kbd>${x}</kbd>`;
  if (!locked()) { h.innerHTML = '🖱️ <b>Click the game</b> to look around with your mouse'; return; }
  if (G.spectating) { h.innerHTML = `👀 Spectating squad · ${k('Space')} / click next spirit · ${k('Esc')} free mouse`; return; }
  if (G.ghost) { h.innerHTML = `👻 ${k('W')}${k('A')}${k('S')}${k('D')} float · ${k('Shift')} faster · ${k('F')} haunt the nearest prop · ${k('Esc')} mouse`; return; }
  const gHint = ACTIVE_MAP && ACTIVE_MAP.getNearbyInteraction ? ` · ${k('G')} interact` : '';
  const seekGHint = G.nearInteract ? ` · ${k('G')} interact` : ` · ${k('G')} element`;
  h.innerHTML = `${k('W')}${k('A')}${k('S')}${k('D')} move · ${k('Shift')} run · ${k('Space')} jump · ` +
    (G.mode === 'seek'
      ? `<b>hold click</b> spray · ${k('Q')} echo pulse · ${k('E')} splash bomb${seekGHint}`
      : `${k('F')}/click morph (${k('1')}${k('2')}${k('3')}) · ${k('Q')}${k('E')} rotate · ${k('C')} decoy · ${k('X')} dash · ${k('T')} whistle · ${k('R')} undo${gHint}`) +
    ` · ${k('Esc')} mouse`;
}
const tap = (id, fn) => $(id) && $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); sfx.unlock(); audio.tap(); fn(); });
tap('btnSample', transform);
tap('btnInteract', triggerInteract);
tap('btnSpecNext', () => {
  if (G.ghost) {
    // ghosts flip between roaming/haunting and watching a living ally (Space / Tab cycles allies while watching)
    G.spectating = !G.spectating;
    if (G.spectating) cycleSpectatorTarget(1);
    if (viralHighlights) viralHighlights.setSpectating(G.spectating, G.spectating ? aliveHidersList() : []);
    return;
  }
  cycleSpectatorTarget(1);
});
tap('btnSpecEnd', () => {
  if (!G.over && (G.spectating || G.ghost)) {
    if (MP && MP.isLiveSession()) {
      toMenu();
      return;
    }
    const alive = aliveHidersList().length;
    endRound(false, 'You Were Soaked!', `${alive} ally spirit${alive === 1 ? '' : 's'} still hiding when you left.`, '💧');
  }
});
$('chips').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  e.stopPropagation();
  sfx.unlock();
  audio.tap();
  const c = chipList[+b.dataset.i];
  if (c) transformTo(c.rec);
  if (e.pointerType === 'mouse' && !locked() && !isTouch && G.phase !== 'menu' && !G.over) {
    try {
      const pl = cvs.requestPointerLock?.();
      if (pl && typeof pl.catch === 'function') pl.catch(() => {});
    } catch (_err) { /* noop */ }
  }
}); tap('btnFreeze', () => rotateProp(1));
if ($('btnPosLock')) tap('btnPosLock', () => togglePosLock());
function triggerLocalSquadPing() {
  if (!genreKing || !G.player || G.over || G.phase === 'menu' || G.phase === 'ready') return;
  let targetPos = G.player.position.clone();
  if (G.mode === 'seek') {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    ray.set(camera.position, dir);
    ray.far = 34;
    const hits = ray.intersectObjects(solids, false);
    if (hits && hits.length) {
      targetPos.copy(hits[0].point);
    } else {
      targetPos.copy(camera.position).addScaledVector(dir, 12);
      targetPos.y = groundHeightAt(targetPos.x, targetPos.z, targetPos.y);
    }
  }
  genreKing.dropSquadPing(G.player, targetPos);
}
if ($('btnBoop')) tap('btnBoop', () => { if (genreKing) genreKing.triggerBoopOrBait(G.player); });
if ($('btnSquadPing')) tap('btnSquadPing', triggerLocalSquadPing);
if ($('btnHudSettings')) {
  tap('btnHudSettings', () => {
    const isNowOpen = document.body.classList.toggle('hud-settings-open');
    $('btnHudSettings').classList.toggle('is-open', isNowOpen);
    audio.tap();
  });
}
if ($('btnEmoteToggle')) {
  tap('btnEmoteToggle', () => {
    const bar = $('hsEmoteBar');
    if (!bar) return;
    const isNowOpen = bar.classList.toggle('hidden') === false;
    $('btnEmoteToggle').classList.toggle('is-open', isNowOpen);
    audio.tap();
  });
}
if ($('hsEmoteBar')) {
  $('hsEmoteBar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-emote]');
    if (!b) return;
    e.stopPropagation();
    triggerEmote(b.dataset.emote);
  });
}
$('btnFire').addEventListener('pointerdown', (e) => { e.stopPropagation(); sfx.unlock(); G.firing = true; });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('btnFire').addEventListener(ev, () => { G.firing = false; });
tap('btnHide', () => enterMatchQueue('hide'));
tap('btnSeek', () => enterMatchQueue('seek'));
tap('btnAgain', () => { if (analytics) analytics.track('play_again', { mode: G.mode || 'hide', map: activeMapId }); enterMatchQueue(G.mode === 'seek' ? 'seek' : 'hide'); });
if ($('btnRematch')) tap('btnRematch', () => { if (analytics) analytics.track('rematch_click', { mode: G.mode || 'hide', map: activeMapId }); rematchLobby(); });
tap('btnSwitch', () => { if (analytics) analytics.track('switch_side', { nextMode: G.mode === 'hide' ? 'seek' : 'hide' }); enterMatchQueue(G.mode === 'hide' ? 'seek' : 'hide'); });
if ($('btnNextMap')) tap('btnNextMap', () => {
  const mode = G.mode || 'hide';
  const unlockedMaps = MAP_ORDER.filter((m) => !progression || progression.isMapUnlocked(m));
  const pool = unlockedMaps.length ? unlockedMaps : ['meadow'];
  const curIdx = Math.max(0, pool.indexOf(activeMapId));
  const nxt = pool[(curIdx + 1) % pool.length];
  if (analytics) analytics.track('next_map_click', { map: nxt });
  selectMap(nxt);
  enterMatchQueue(mode === 'seek' ? 'seek' : 'hide');
});
if ($('btnCancelQueue')) tap('btnCancelQueue', () => { if (analytics) analytics.track('queue_cancel', { map: activeMapId }); toMenu(); });
if ($('webPlayStoreCta')) $('webPlayStoreCta').addEventListener('click', () => { if (analytics) { analytics.track('store_cta_click', { target: 'google_play' }); analytics.flush({ keepalive: true }); } });
tap('btnMenu', toMenu); tap('btnQuit', toMenu);
function toggleMute() { $('btnMute').textContent = audio.toggleMute() ? '🔇' : '🔊'; }
tap('btnMute', toggleMute); $('btnMute').textContent = audio.isMuted() ? '🔇' : '🔊';

let gfxToastTO = 0;
function showGfxToast(msg) {
  const el = $('gfxToast');
  if (el) {
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(gfxToastTO);
    gfxToastTO = setTimeout(() => el.classList.remove('on'), 1800);
  } else if (G.phase !== 'menu') {
    hint(msg, 1600);
  }
}
function syncQualityButtons(meta) {
  const m = meta || (mobilePerf ? mobilePerf.getQualityMeta() : { id: 'ultra', shortLabel: '✨ Ultra' });
  for (const id of ['btnQuality', 'btnTitleQuality']) {
    const b = $(id);
    if (b) {
      b.textContent = m.shortLabel;
      b.dataset.tier = m.id;
    }
  }
  if (painterlyGfx && m) {
    painterlyGfx.setDetailLevel(m.id, mobilePerf?.getLiteLevel ? mobilePerf.getLiteLevel() : 0);
  }
  if (tier1Visuals && m) {
    tier1Visuals.setDetailLevel(m.id, mobilePerf?.getLiteLevel ? mobilePerf.getLiteLevel() : 0);
  }
}
function toggleQuality() {
  if (!mobilePerf || !mobilePerf.cycleQuality) return;
  const meta = mobilePerf.cycleQuality();
  syncQualityButtons(meta);
  showGfxToast(meta.toastLabel);
  if (mobileLobby) mobileLobby.refresh();
}
if ($('btnQuality')) tap('btnQuality', toggleQuality);
if ($('btnTitleQuality')) tap('btnTitleQuality', toggleQuality);
if ($('btnTitleTutorial')) tap('btnTitleTutorial', () => { if (tutorial) tutorial.openPickerModal(); });
if ($('btnDesktopParty')) tap('btnDesktopParty', () => { if (mobileLobby) mobileLobby.openPartyModal(); });
if (mobilePerf && mobilePerf.onQualityChange) mobilePerf.onQualityChange(syncQualityButtons);
syncQualityButtons();
function toMenu() {
  if (analytics) {
    if (G.isTutorial) analytics.track('tutorial_exit', { mode: G.mode || '', phase: G.phase || '' });
    else if (analytics.inMatch()) analytics.matchQuit({ phase: G.over ? 'end' : (G.phase || ''), round: matchFlow ? matchFlow.getRoundNumber() : 1 });
    analytics.screen('lobby');
  }
  try { endCinematic.stop(false); } catch (_) {}
  clearTimeout(vsIntroTimer);
  clearInterval(vsTickInterval);
  clearTimeout(endRoundTO);
  clearTimeout(nonMasterEndTO);
  nonMasterEndTO = 0;
  if (matchFlow) matchFlow.cancelHalftime();
  if (MP) MP.leaveSession();
  const restoreMapFromTut = activeMapId === 'tutorial' ? ((tutorial && tutorial.getSavedMapId && tutorial.getSavedMapId()) || 'meadow') : null;
  if (tutorial) tutorial.stop();
  aimRing.visible = false; chipKey = ''; $('chips').innerHTML = '';
  if (document.pointerLockElement) document.exitPointerLock();
  clearRound(); G.phase = 'menu'; G.mode = null; audio.music('menu'); gun.visible = false;
  if (restoreMapFromTut) selectMap(restoreMapFromTut);
  $('hud').classList.add('hidden');
  $('result').classList.remove('on');
  if ($('halftimeScreen')) $('halftimeScreen').classList.remove('on');
  if ($('queueScreen')) $('queueScreen').classList.remove('on');
  if ($('vsScreen')) $('vsScreen').classList.remove('on');
  $('title').classList.add('on');
  if (tutorial) tutorial.syncLobbyBadges();
  if (mobileControls) mobileControls.refreshModeUI();
  if (mobileLobby) mobileLobby.refresh();
}

addEventListener('resize', () => {
  if (mobilePerf && mobilePerf.handleResize) {
    mobilePerf.handleResize();
  } else {
    renderer.setSize(innerWidth, innerHeight);
    if (composer) {
      composer.setSize(innerWidth, innerHeight);
      if (outlinePass) {
        const pr = renderer.getPixelRatio();
        outlinePass.uniforms.res.value.set(innerWidth * pr, innerHeight * pr);
      }
    }
  }
  if (painterlyGfx && painterlyGfx.onResize) painterlyGfx.onResize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ============================================================ Unified Character Vertical Physics (Player + All 9 AI Bots!)
function stepCharVerticalPhysics(ch, dt, now) {
  if (!ch || (ch.userData?.actor?.eliminated && !ch.userData?.ghost)) return;
  const u = ch.userData;
  const isPlayer = ch === G.player;
  if (u.rideRail) {
    const rr = u.rideRail;
    rr.elapsed += dt;
    if (isPlayer && rr.canJumpOff && rr.elapsed > 0.28 && (input.keys.Space || G.jumpHeld)) {
      u.rideRail = null;
      u.vy = rr.exitBoostVy || 6.6;
      u.jy = Math.max(0.25, u.jy || 0);
      u.gliding = true;
      audio.jump();
      puff(centerOf(ch), 10, 1.2, 0.4, 0.45, 0.4);
      return;
    }
    const pts = rr.points;
    const pA = pts[rr.segIdx], pB = pts[rr.segIdx + 1];
    if (!pA || !pB) { u.rideRail = null; return; }
    const segLen = Math.max(0.4, Math.hypot(pB[0] - pA[0], pB[1] - pA[1], pB[2] - pA[2]));
    rr.segT += (rr.dir * rr.speed * dt) / segLen;
    while (rr.segT > 1 || rr.segT < 0) {
      if (rr.segT > 1) {
        if (rr.segIdx < pts.length - 2) {
          rr.segIdx++;
          rr.segT -= 1;
        } else if (rr.loop) {
          rr.segIdx = 0;
          rr.segT -= 1;
        } else {
          rr.segT = 1;
          break;
        }
      } else if (rr.segT < 0) {
        if (rr.segIdx > 0) {
          rr.segIdx--;
          rr.segT += 1;
        } else if (rr.loop) {
          rr.segIdx = pts.length - 2;
          rr.segT += 1;
        } else {
          rr.segT = 0;
          break;
        }
      }
    }
    const cA = pts[rr.segIdx], cB = pts[rr.segIdx + 1];
    const t = clamp(rr.segT, 0, 1);
    const rx = lerp(cA[0], cB[0], t);
    const ry = lerp(cA[1], cB[1], t) + (rr.dropOffsetY || 0);
    const rz = lerp(cA[2], cB[2], t);
    ch.position.x = rx;
    ch.position.z = rz;
    u.groundY = groundHeightAt(rx, rz, ry);
    u.jy = Math.max(0, ry - u.groundY);
    const dxR = (cB[0] - cA[0]) * rr.dir, dzR = (cB[2] - cA[2]) * rr.dir;
    if (Math.hypot(dxR, dzR) > 1e-3) ch.rotation.y = lerpAngle(ch.rotation.y, Math.atan2(dxR, dzR), Math.min(1, dt * 12));
    if (Math.random() < 0.35) puff(centerOf(ch), 1, 0.5, 0.25, 0.32, 0.15);
    const atEnd = !rr.loop && ((rr.dir > 0 && rr.segIdx >= pts.length - 2 && rr.segT >= 1) || (rr.dir < 0 && rr.segIdx <= 0 && rr.segT <= 0));
    if (atEnd) {
      u.rideRail = null;
      u.vy = 1.8;
      if (isPlayer) audio.land();
    }
    return;
  }
  if (u.ridePath) {
    u.ridePath.t += dt;
    const k = clamp(u.ridePath.t / u.ridePath.dur, 0, 1);
    const s = k * k * (3 - 2 * k);
    ch.position.x = lerp(u.ridePath.x0, u.ridePath.x1, s);
    ch.position.z = lerp(u.ridePath.z0, u.ridePath.z1, s);
    const arc = Math.sin(k * Math.PI) * (u.ridePath.arcY || 0);
    const footY = lerp(u.ridePath.y0, u.ridePath.y1, s) + arc;
    u.groundY = groundHeightAt(ch.position.x, ch.position.z, footY);
    u.jy = Math.max(0, footY - u.groundY);
    if (k >= 1) { u.ridePath = null; u.vy = 0; if (isPlayer) audio.land(); }
    return;
  }

  if (u.inTurret) {
    u.vy = 0; u.jy = 0; u.gliding = false;
    return;
  }

  if (u._kvx || u._kvz) {
    moveChar(ch, (u._kvx || 0) * dt, (u._kvz || 0) * dt);
    const kDamp = Math.max(0, 1 - dt * 4.2);
    u._kvx = (u._kvx || 0) * kDamp;
    u._kvz = (u._kvz || 0) * kDamp;
    if (Math.hypot(u._kvx, u._kvz) < 0.12) { u._kvx = 0; u._kvz = 0; }
  }

  if (ACTIVE_MAP && ACTIVE_MAP.sampleLauncherAt && !u.specialMode) {
    const launch = ACTIVE_MAP.sampleLauncherAt(ch, G, dt);
    if (launch && (launch.knockVx || launch.knockVz)) {
      u._kvx = launch.knockVx || 0;
      u._kvz = launch.knockVz || 0;
      if (launch.vy && launch.vy > (u.vy || 0)) {
        u.vy = launch.vy;
        u.jy = Math.max(0.14, u.jy || 0);
      }
      if (isPlayer) {
        audio.poof(true);
        if (launch.hintMsg && now - (G.lastLaunchHintAt || 0) > 2200) {
          G.lastLaunchHintAt = now;
          hint(launch.hintMsg, 2200);
        }
      }
    }
    if (launch && launch.rideSpot) {
      const rs = launch.rideSpot;
      const startFootY = (u.groundY || 0) + (u.jy || 0);
      u.ridePath = {
        t: 0,
        dur: rs.dur || 1.35,
        x0: rs.fromX ?? ch.position.x,
        y0: rs.fromY ?? startFootY,
        z0: rs.fromZ ?? ch.position.z,
        x1: rs.toX,
        y1: rs.toY,
        z1: rs.toZ,
        arcY: rs.arcY ?? 2.8,
      };
      u.vy = 0; u.jy = 0; u.gliding = false;
      splash(centerOf(ch), 24, 2.8);
      if (!G.isTutorial && viralHighlights?.recordJuke && u.actor?.team !== 'seekers' && (G.phase === 'survive' || G.phase === 'seek')) {
        const nearSk = countNearbySeekers(ch.position, 20);
        if ((nearSk >= 1 || isPlayer) && now - (u._lastVhLaunchAt || 0) > 2200) {
          u._lastVhLaunchAt = now;
          viralHighlights.recordJuke({
            actor: ch,
            kind: 'contraption_launch',
            propId: u.propId,
            nearSeekers: Math.max(1, nearSk),
            altitude: startFootY + (rs.arcY ?? 2.8),
            pos: ch.position.clone(),
          });
        }
      }
      if (isPlayer) {
        audio.poof(true);
        if (launch.hintMsg) hint(launch.hintMsg, 2600);
      }
      return;
    }
    if (launch && launch.vy > (u.vy || 0)) {
      u.vy = launch.vy;
      u.jy = Math.max(0.12, u.jy || 0);
      u.gliding = !!launch.glide;
      splash(centerOf(ch), 20, 2.3);
      if (!G.isTutorial && viralHighlights?.recordJuke && u.actor?.team !== 'seekers' && launch.vy > 6.2 && (G.phase === 'survive' || G.phase === 'seek')) {
        const nearSk = countNearbySeekers(ch.position, 20);
        if ((nearSk >= 1 || isPlayer) && now - (u._lastVhLaunchAt || 0) > 2200) {
          u._lastVhLaunchAt = now;
          viralHighlights.recordJuke({
            actor: ch,
            kind: 'contraption_launch',
            propId: u.propId,
            nearSeekers: Math.max(1, nearSk),
            altitude: (u.groundY || 0) + 3.2,
            pos: ch.position.clone(),
          });
        }
      }
      if (isPlayer) {
        audio.poof(true);
        if (progression && !G.isTutorial && now - (G._lastAirLaunchAchAt || 0) > 2500) {
          G._lastAirLaunchAchAt = now;
          progression.recordAchievementStat('airPlays', 1);
        }
        if (launch.hintMsg && now - (G.lastLaunchHintAt || 0) > 2400) {
          G.lastLaunchHintAt = now;
          hint(launch.hintMsg, 2600);
        }
      }
    }
  }

  // Large Flying Bird Disguise Physics (`mb_stork` & `mb_heron`): Powered Wing-Flap Climb, Soaring Glide, & Wing-Clip Drop!
  if (isFlyingBirdChar(ch)) {
    u.birdStamina = typeof u.birdStamina === 'number' ? u.birdStamina : 1.0;
    const shotDown = now < (u.birdShotDownUntil || 0);
    const elemJumpMul = elementalGuns ? elementalGuns.getHiderJumpMultiplier(ch) : 1;
    const flyDef = KIT?.props?.[u.propId];
    const flyMaxY = flyDef?.flyMaxY || 13.5;
    const curFootY = (u.groundY || 0) + (u.jy || 0);
    const inIndoorCeiling = isPlayer ? !!INSIDE : !!(ENTER.length && whereIs(ch.position.x, ch.position.z, curFootY));
    const wantClimb = !shotDown && elemJumpMul > 0.05 && !inIndoorCeiling &&
      ((isPlayer && (input.keys.Space || G.jumpHeld)) || (!isPlayer && u.aiBirdClimb)) &&
      u.birdStamina > 0.03 && curFootY < flyMaxY;

    if (shotDown) {
      u.birdClimbing = false;
      u.gliding = false;
      u.vy = Math.max(-16.5, Math.min(u.vy || 0, -6.8) - 14.0 * dt);
      u.jy = Math.max(0, (u.jy || 0) + u.vy * dt);
      if ((u.jy || 0) > 0.25 && Math.random() < 0.35) {
        puff(centerOf(ch), 1, 0.45, 0.22, 0.35, 0.15);
      }
      if (u.jy === 0) {
        u.vy = 0;
        u.groundedAt = now;
        if (!u._birdLandedClip) {
          u._birdLandedClip = true;
          u.birdShotDownUntil = Math.max(u.birdShotDownUntil || 0, now + 2800);
          if (isPlayer) audio.land();
        }
      }
    } else if (wantClimb) {
      u._birdLandedClip = false;
      u.birdClimbing = true;
      u.gliding = true;
      u.birdStamina = Math.max(0, u.birdStamina - dt * 0.12);
      const targetVy = curFootY > 12.2 ? 1.4 : 5.4;
      u.vy = lerp(u.vy || 0, targetVy, Math.min(1, dt * 8.2));
      u.jy = Math.max(0.08, (u.jy || 0) + u.vy * dt);
      if (!G.isTutorial && viralHighlights?.recordJuke && u.jy > 2.2 && (G.phase === 'survive' || G.phase === 'seek')) {
        const nearSk = countNearbySeekers(ch.position, 22);
        if ((nearSk >= 1 || isPlayer) && now - (u._lastVhSkyAt || 0) > 4500) {
          u._lastVhSkyAt = now;
          viralHighlights.recordJuke({
            actor: ch,
            kind: 'sky_takeoff',
            propId: u.propId,
            nearSeekers: Math.max(1, nearSk),
            altitude: curFootY,
            pos: ch.position.clone(),
          });
        }
      }
      const flapInterval = flyDef?.flapIntervalMs ?? (u.propId === 'mb_roc' ? 460 : (u.propId === 'mb_heron' ? 310 : 370));
      if (now - (u._lastFlapSfxAt || 0) > flapInterval) {
        u._lastFlapSfxAt = now;
        if (isPlayer || camera.position.distanceTo(ch.position) < 24) {
          const flapPitch = flyDef?.flapPitch ?? (u.propId === 'mb_roc' ? 0.68 : (u.propId === 'mb_heron' ? 1.24 : 1.0));
          playWingFlapSound(audio, isPlayer ? 0.76 : 0.38, flapPitch);
          if (isPlayer) {
            haptics.wingFlap(u.propId === 'mb_roc' ? 'huge' : (u.propId === 'mb_heron' ? 'large' : 'larger'));
          }
        }
        if ((u.jy || 0) > 0.35) {
          puff(centerOf(ch), 2, 0.55, 0.24, 0.42, 0.16);
        }
      }
    } else if ((u.jy || 0) > 0.06 || (u.vy || 0) > 0.05) {
      u.birdClimbing = false;
      u.gliding = u.birdStamina > 0.01;
      u.birdStamina = Math.max(0, u.birdStamina - dt * 0.022);
      const sinkCap = u.gliding ? -1.25 : -3.4;
      u.vy = Math.max(sinkCap, (u.vy || 0) - 4.2 * dt);
      u.jy = Math.max(0, (u.jy || 0) + u.vy * dt);
      if (u.jy === 0) {
        u.vy = 0;
        u.gliding = false;
        u.groundedAt = now;
        if (isPlayer) audio.land();
      }
    } else {
      u.birdClimbing = false;
      u.gliding = false;
      u.jy = 0;
      u.vy = 0;
      u.groundedAt = now;
      u.birdStamina = Math.min(1.0, u.birdStamina + dt * 0.42);
    }
    return;
  }

  if (u.vy || (u.jy || 0) > 0) {
    const surfGravMul = ACTIVE_MAP?.getSurfaceModifier?.(ch, G)?.gravMul ?? 1;
    const gAcc = ((u.gliding && (u.vy || 0) < 1.5) ? 4.4 : 18.5) * surfGravMul;
    const preVy = u.vy || 0;
    u.vy = Math.max(u.gliding ? -4.2 : -28, preVy - gAcc * dt);
    u.jy = Math.max(0, (u.jy || 0) + u.vy * dt);
    if (u.jy === 0) {
      const imp = clamp(Math.abs(preVy) / 11.5, 0.25, 1.35);
      u.vy = 0; u.gliding = false; u.groundedAt = now;
      u._landSquashT = 0.22;
      u._landImpact = imp;
      if (imp > 0.35) {
        spawnDustPuff(ch.position, Math.round(3 + imp * 3));
        if (genreKing && u.propId && !u.actor?.eliminated) {
          genreKing.spawnFootprint(ch.position.x, u.groundY || 0, ch.position.z, ch.rotation.y, true);
        }
      }
      if (isPlayer) {
        G._camLandDip = Math.min(0.24, imp * 0.14);
        if (imp > 0.65) addCamTrauma(imp * 0.14);
        if ((G.jumpBufT || 0) > 0) doCharJump(ch, 7.8);
        else (audio.landThud ? audio.landThud(imp) : audio.land());
      }
    }
  } else {
    u.groundedAt = now;
    if (isPlayer && (G.jumpBufT || 0) > 0) doCharJump(ch, 7.8);
  }

  if (isPlayer) G.jumpBufT = Math.max(0, (G.jumpBufT || 0) - dt);

  if (ACTIVE_MAP && ACTIVE_MAP.checkSkyVoidRescue && !u.specialMode) {
    const rescueMsg = ACTIVE_MAP.checkSkyVoidRescue(ch, G);
    if (rescueMsg) {
      splash(centerOf(ch), 26, 2.5);
      if (isPlayer) {
        audio.poof(true);
        hint(rescueMsg, 2600);
      }
    }
  }
}

// ============================================================ main loop & deterministic step helper
let last = performance.now();
const tmpV = new THREE.Vector3();

const _camTryDir = new THREE.Vector3();
const _camTryDir2 = new THREE.Vector3();
const _camRayO = new THREE.Vector3();
function renderScene() {
  if (!mobilePerf || mobilePerf.shouldUpdateShadow(G.phase === 'menu')) {
    sun.shadow.needsUpdate = true;
  }
  const usePost = composer && (!mobilePerf || mobilePerf.isPostProcessingEnabled());
  if (usePost) {
    if (painterlyGfx && painterlyGfx.renderSteamDepthPrepass) painterlyGfx.renderSteamDepthPrepass(camera);
    if (outlinePass) outlinePass.uniforms.tDepth.value = composer.readBuffer.depthTexture;
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  if (viralHighlights && viralHighlights.onAfterRenderFrame) {
    viralHighlights.onAfterRenderFrame();
  }
}

function stepFrame(dt, now) {
  // 48ms dramatic impact hitstop freeze-frame on eliminations
  if ((G._hitstopT || 0) > 0) {
    G._hitstopT = Math.max(0, G._hitstopT - dt);
    return;
  }
  for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 150) c.position.x = -150; }
  if (lobbyPreviewGroup && G.phase !== 'menu' && G.phase !== 'charselect') {
    lobbyPreviewGroup.visible = false;
  }
  if (G.phase === 'charselect') {
    const px = 1.15, pz = 5.35;
    const py = groundHeightAt(px, pz) + 0.14;
    const isSk = lobbyPreviewRole === 'seeker';
    const dist = isSk ? 3.55 : 2.95;
    const eyeY = py + (isSk ? 1.08 : 0.86);
    camera.position.set(px - 0.52, eyeY + 0.14, pz + dist);
    camera.lookAt(px - 0.56, eyeY - 0.06, pz);
    updateLobbyChampionPreview(dt, now);
  } else if (G.phase === 'menu' || G.phase === 'vs') {
    const cm = (ACTIVE_MAP && ACTIVE_MAP.camMenu) || MEADOW_DEF.camMenu || { r: 19.5, y: 14.8, lookY: 0.8 };
    const a = typeof cm.sway === 'number'
      ? (cm.baseAngle ?? 0) + Math.sin(now * 0.00018) * cm.sway
      : now * 0.00006;
    camera.position.set(Math.sin(a) * cm.r, cm.y, Math.cos(a) * cm.r);
    camera.lookAt(cm.lookX ?? 0, cm.lookY ?? 0.8, cm.lookZ ?? 0);
    if (G.phase === 'menu') updateLobbyChampionPreview(dt, now);
  } else if (G.player) {
    if (!G.over) {
      if (!G.isTutorial) G.t -= dt;
      G.transformCd = Math.max(0, G.transformCd - dt);
      G.rotatedT = Math.max(0, (G.rotatedT || 0) - dt);
      G.specialLockT = Math.max(0, (G.specialLockT || 0) - dt);
      const maxHp = G.maxHp || BASE_HIDER_HP;
      const hasSecondWind = getCharHiderPerk(G.player) === 'second_wind';
      const regenDelayMs = hasSecondWind ? 2800 : 4500;
      const regenRate = hasSecondWind ? 22 : 14;
      if (G.mode === 'hide' && !G.spectating && G.hp < maxHp && now - G.lastHit > regenDelayMs) {
        G.hp = Math.min(maxHp, G.hp + regenRate * dt);
        if (G.hp / maxHp > 0.5) G.lowHint = false;
      }
      if (G.mode === 'hide' && G.phase === 'survive' && !G.spectating && !G.isTutorial && progression && !G.player.userData?.actor?.eliminated) {
        G._achSurviveFrac = (G._achSurviveFrac || 0) + dt;
        if (G._achSurviveFrac >= 1) {
          const whole = Math.floor(G._achSurviveFrac);
          G._achSurviveFrac -= whole;
          progression.recordAchievementStat('surviveSec', whole);
        }
      }
      if (G.mode === 'hide') {
        if (G.phase === 'hide' && G.t <= 0) {
          if (seekerSkyDrop && seekerSkyDrop.isBotDropActive && seekerSkyDrop.isBotDropActive()) {
            seekerSkyDrop.finishBotOnlySkyDrop();
          }
          G.phase = 'survive'; G.t = G.huntDuration || ROUND.survive; audio.music('survive'); audio.cue('release');
          G.seekers.forEach((s) => setEyes(s, true));
          const hasDis = !!(G.player.userData.propId || G.player.userData.specialMode);
          pushFeed('👀', `<b>${G.seekers.length} Seekers landed!</b> Hold your nerve!`, 'warn');
          hint(hasDis ? 'Ready or not… 5 seekers have landed! 👀 Stay still!' : "5 seekers have landed — and you're not disguised! 😱", 2500);
        } else if (G.phase === 'survive' && G.t <= 0) {
          const alive = aliveHidersList();
          if (!G.player.userData?.actor?.eliminated) {
            const u = G.player.userData;
            const asTxt = u.specialLabel || (u.propId && KIT.props[u.propId] ? KIT.props[u.propId].label.toLowerCase() : 'spirit');
            const boldPts = Math.round((G.boldSec || 0) * 15);
            const alliesLeft = Math.max(0, alive.length - 1);
            requestAuthoritativeRoundEnd(true, alive.length >= TEAM_SIZE ? 'Flawless! All 5 Unseen!' : `Unseen! ${alive.length} of ${TEAM_SIZE} Spirits Survived`, `You${alliesLeft ? ` + ${alliesLeft} ally spirit${alliesLeft === 1 ? '' : 's'}` : ''} survived as a ${asTxt}${boldPts > 0 ? ` · +${boldPts} courage` : ''}`, '🎭');
          } else {
            const heroes = alive.map((h) => h.userData.actor?.name || 'Ally').join(', ');
            requestAuthoritativeRoundEnd(true, `Squad Clutch! ${alive.length} of ${TEAM_SIZE} Survived`, `${heroes} outsmarted the 5 seekers till 0:00!`, '✨');
          }
        }
      } else {
        if (G.phase === 'ready' && G.t <= 0) {
          const dropRes = seekerSkyDrop && seekerSkyDrop.isActive() ? seekerSkyDrop.finishSkyDrop() : null;
          G.phase = 'seek'; G.t = G.huntDuration || ROUND.seek; audio.cue('go');
          gun.visible = true;
          G.seekers.forEach((s) => setEyes(s, true));
          if (dropRes && dropRes.landedPos && progression) {
            progression.spawnPoofVfx(dropRes.landedPos);
            if (!G.isTutorial) progression.recordAchievementStat('airPlays', 1);
          }
          pushFeed('💦', '<b>Touchdown!</b> Sweep rooms & call out fakes!', 'soak');
          hint('Touchdown! Hunt with your 4 seeker allies! 💦', 1800);
        } else if (G.phase === 'seek' && G.t <= 0) {
          const myKills = G.player?.userData?.actor?.eliminations || 0;
          requestAuthoritativeRoundEnd(false, `Time Up! ${TEAM_SIZE - G.found} of ${TEAM_SIZE} Spirits Escaped`, `Squad soaked ${G.found} of ${TEAM_SIZE} · You got ${myKills} · ${G.wrong} wrong sprays`, '⏰');
        }
      }
    }

    const p = G.player;
    const allChars = [G.player, ...G.seekers, ...G.hiders].filter(Boolean);
    const skyDropping = !!(seekerSkyDrop && seekerSkyDrop.isActive());
    const botSkyDropping = !!(seekerSkyDrop && seekerSkyDrop.isBotDropActive && seekerSkyDrop.isBotDropActive());

    const fireCdBase = p.userData.inTurret
      ? 0.095
      : (worldEvents ? worldEvents.getSeekerFireCooldown() : 0.085) * (getCharSeekerPerk(p) === 'grand_inquisitor' ? 0.88 : 1) * (genreKing ? genreKing.getOverdriveSeekerFireMul() : 1);
    const localStunned = Boolean(genreKing && genreKing.isSeekerStunned(p, now));
    // Subtle fair touch aim-assist magnetism when firing at a visible moving Hider on mobile!
    if (isTouch && G.firing && G.mode === 'seek' && G.phase === 'seek' && !G.over && !localStunned && !p.userData.inTurret) {
      const lookDir = _camTryDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      let bestH = null, bestDot = Math.cos(0.085); // ~4.8 deg soft cone
      for (const h of (G.allHiders || [])) {
        if (!h || h.userData?.actor?.eliminated || h.userData?.inBubbleCage) continue;
        const hc = centerOf(h);
        const toH = hc.clone().sub(camera.position);
        const dist = toH.length();
        if (dist < 1.2 || dist > 16) continue;
        toH.divideScalar(dist);
        const dp = lookDir.dot(toH);
        if (dp > bestDot && lineOfSight(camera.position, hc)) {
          bestDot = dp;
          bestH = hc;
        }
      }
      if (bestH) {
        const wantYaw = Math.atan2(-(bestH.x - camera.position.x), -(bestH.z - camera.position.z));
        const dYaw = normAng(wantYaw - G.yaw);
        G.yaw += dYaw * Math.min(1, dt * 4.5);
      }
    }
    if (G.firing && G.mode === 'seek' && G.phase === 'seek' && !G.over && !localStunned) { G.fireCd -= dt; if (G.fireCd <= 0) { if (hueLayer) hueLayer.spendWater(); G.fireCd = fireCdBase * (hueLayer ? hueLayer.getFireIntervalMul() : 1); playerFire(); } }
    else G.fireCd = 0;

    // Run vertical jump/gravity/updraft physics on grounded/hiding characters (skip descending sky-drop & network-interpolated chars!)
    for (const c of allChars) {
      if (c.userData?._localSkyDrop || c.userData?.actor?.isRemote) continue;
      if ((skyDropping || botSkyDropping) && c.userData?.actor?.team === 'seekers') continue;
      stepCharVerticalPhysics(c, dt, now);
    }

    // Local Player Movement (disabled if spectating after getting soaked, seated in Sky-Turret, or Crystal Frozen!)
    const elemSpdMul = elementalGuns ? elementalGuns.getCharacterSpeedMultiplier(p) : 1;
    let mx = input.mx, mz = input.mz;
    if (input.keys.KeyW || input.keys.ArrowUp) mz = -1; if (input.keys.KeyS || input.keys.ArrowDown) mz = 1;
    if (input.keys.KeyA || input.keys.ArrowLeft) mx = -1; if (input.keys.KeyD || input.keys.ArrowRight) mx = 1;
    const turPlayer = getActiveTurret();
    if (p.userData.inTurret && turPlayer) {
      const sy = turPlayer.seatY ?? ((turPlayer.y ?? 0) + 0.18);
      p.position.set(turPlayer.x, sy, turPlayer.z);
      p.userData.groundY = sy;
      p.userData.jy = 0;
      p.rotation.y = G.yaw + Math.PI;
      gun.visible = false;
      turPlayer.setAim(G.yaw, G.pitch);
    }
    const canMove = !G.over && !G.spectating && G.phase !== 'ready' && !G.posLocked && !p.userData.inBubbleCage && !(genreKing && genreKing.isSeekerStunned(p, now)) && !p.userData.ridePath && !p.userData.rideRail && !p.userData.inTurret && elemSpdMul > 0.01;
    const wantMove = canMove && (Math.abs(mx) + Math.abs(mz) > 0.05);
    if (wantMove && p.userData.specialMode && !p.userData.specialSpot?.mobile && (G.specialLockT || 0) <= 0) {
      exitSpecialSpot(p, false);
    }
    const surfMod = (!G.over && !G.spectating && p) ? ACTIVE_MAP?.getSurfaceModifier?.(p, G) : null;
    G.moving = wantMove && (!p.userData.specialMode || !!p.userData.specialSpot?.mobile);

    if (p.userData.customPilot && ACTIVE_MAP?.handleCustomMotion) {
      ACTIVE_MAP.handleCustomMotion(p, mx, mz, G, dt);
      G.moving = Math.abs(mx) + Math.abs(mz) > 0.05;
    } else if (G.moving || ((surfMod?.slipDrift || 0) > 0.05 && Math.hypot(p.userData._slideVx || 0, p.userData._slideVz || 0) > 0.25 && canMove)) {
      const disguised = !!(p.userData.propId || p.userData.specialMode);
      const isAnimalDisguise = !!(p.userData.propId && KIT?.props?.[p.userData.propId]?.isAnimal);
      const mudMul = getMudSpeedMul(p);
      const airBoost = p.userData.gliding && (p.userData.jy || 0) > 0.1 ? 1.28 : ((p.userData.jy || 0) > 0.08 ? 1.08 : 1);
      const hiderTrickMul = (hiderTricks ? hiderTricks.getSpeedMultiplier(p) : 1) * (worldEvents ? worldEvents.getHiderSpeedMul(p) : 1) * elemSpdMul * mudMul * (now < (p.userData.adrenalineUntil || 0) ? 1.18 : 1) * (genreKing ? genreKing.getOverdriveHiderSpeedMul() : 1);
      const skPerk = getCharSeekerPerk(p);
      const seekerPerkMul = (skPerk === 'swift_boots' ? 1.08 : 1) * (now < (p.userData.hunterSprintUntil || 0) ? 1.22 : 1);
      const seekerEvtMul = (worldEvents ? worldEvents.getSeekerSpeedMul(p) : 1) * elemSpdMul * mudMul * seekerPerkMul;
      const spMul = (p.userData.speedMul || 1) * airBoost * hiderTrickMul;
      const surfSpdMul = surfMod?.speedMul ?? 1;
      const sp = (G.mode === 'seek' ? 5.35 * seekerEvtMul * (p.userData.gliding ? 1.2 : ((p.userData.jy || 0) > 0.08 ? 1.08 : 1)) : (disguised ? 4.2 : 4.8) * spMul) * (input.keys.ShiftLeft || input.keys.ShiftRight || input.sprint ? 1.4 : 1) * surfSpdMul;
      const airWobble = elementalGuns ? elementalGuns.getSteeringWobbleRad(p) : 0;
      const moveYaw = G.yaw + airWobble;
      const fx = -Math.sin(moveYaw), fz = -Math.cos(moveYaw), rx = Math.cos(moveYaw), rz = -Math.sin(moveYaw);
      const stepWorldX = G.moving ? (rx * mx - fx * mz) : 0, stepWorldZ = G.moving ? (rz * mx - fz * mz) : 0;
      const slip = clamp(surfMod?.slipDrift || 0, 0, 0.92);
      const desVx = stepWorldX * sp, desVz = stepWorldZ * sp;
      if (slip > 0.05) {
        const blend = clamp(1 - slip + dt * 2.2, 0.06, 1);
        p.userData._slideVx = lerp(p.userData._slideVx || desVx * 0.5, desVx, blend);
        p.userData._slideVz = lerp(p.userData._slideVz || desVz * 0.5, desVz, blend);
      } else {
        p.userData._slideVx = desVx;
        p.userData._slideVz = desVz;
      }
      moveChar(p, (p.userData._slideVx || 0) * dt, (p.userData._slideVz || 0) * dt);
      if (G.moving && (!disguised || (isAnimalDisguise && (G.rotatedT || 0) <= 0))) {
        p.rotation.y = lerpAngle(p.rotation.y, Math.atan2(stepWorldX, stepWorldZ), dt * (isAnimalDisguise ? 8.5 : 10));
      }
      p.userData.bob += dt * (disguised ? 16 : 12);
      const stepK = Math.floor(p.userData.bob / Math.PI);
      if (stepK !== p.userData.stepK) {
        p.userData.stepK = stepK;
        if (!p.userData.jy) {
          let surf = Math.hypot(p.position.x, p.position.z) < PLAZA_R ? 'cobble' : 'grass';
          if (ACTIVE_MAP && ACTIVE_MAP.surfaceAt) {
            const ms = ACTIVE_MAP.surfaceAt(p.position.x, p.position.z);
            surf = ms === 'stone' || ms === 'wood' ? 'cobble' : 'grass';
          }
          audio.step(disguised && !isAnimalDisguise ? 'hop' : surf);
        }
      }
    } else if (canMove && isFlyingBirdChar(p) && (p.userData.jy || 0) > 0.35 && (G.rotatedT || 0) <= 0) {
      p.rotation.y = lerpAngle(p.rotation.y, G.yaw + Math.PI, dt * 4.5);
    }

    if (!skyDropping && !p.userData.specialMode && !G.spectating) {
      const curFoot = (p.userData.groundY || 0) + (p.userData.jy || 0);
      const ng = groundHeightAt(p.position.x, p.position.z, curFoot);
      if ((p.userData.jy || 0) > 0.02 || (p.userData.vy || 0) > 0.05 || ((p.userData.groundY || 0) - ng > 0.28)) {
        p.userData.jy = Math.max(0, curFoot - ng);
      }
      p.userData.groundY = ng;
    }

    // Update all non-remote Smart AI Slots + Live Photon / Shared-Room Sync!
    if (!skyDropping && !botSkyDropping) {
      for (const s of G.seekers) {
        if (!s.userData?.isTutorialSeeker && !(genreKing && genreKing.isSeekerStunned(s, now))) AI.updateSeekerBot(s, dt, allChars);
      }
    }
    for (const h of G.hiders) {
      if (!h.userData?.isTutorialDummy && !h.userData?.inBubbleCage) AI.updateHiderBot(h, dt, allChars);
    }
    if (MP) MP.update(dt);
    if (seekerSkyDrop && seekerSkyDrop.syncRemoteParachutes) seekerSkyDrop.syncRemoteParachutes();
    if (hiderTricks) hiderTricks.update(dt * (genreKing ? genreKing.getOverdriveCdRate() : 1));
    if (seekerGadgets) seekerGadgets.update(dt);
    if (genreKing) genreKing.update(dt, now);
    if (worldEvents && !G.isTutorial) worldEvents.update(dt);
    if (hueLayer) hueLayer.update(dt);
    if (matchFlow) matchFlow.updateTelemetry(dt);
    if (viralHighlights && !G.isTutorial) viralHighlights.tick(dt);
    if (mobileControls) mobileControls.update(dt);
    if (tutorial && G.isTutorial) tutorial.update(dt, now);
    if (G.mode === 'hide' && botSkyDropping) {
      if (G.phase === 'survive' && seekerSkyDrop.finishBotOnlySkyDrop) {
        seekerSkyDrop.finishBotOnlySkyDrop();
      } else {
        seekerSkyDrop.update(dt, now);
      }
    }

    // Track miraculous low-HP escapes across ALL Hiders (local + teammates) for viral highlight replay!
    if (
      viralHighlights &&
      !G.isTutorial &&
      (G.phase === 'survive' || G.phase === 'seek') &&
      !G.over
    ) {
      const hPool = (G.allHiders && G.allHiders.length) ? G.allHiders : [G.mode === 'hide' ? p : null, ...(G.hiders || [])].filter(Boolean);
      for (const hc of hPool) {
        if (!hc || hc.userData?.actor?.eliminated || !hc.userData?._lowHpEscapeArmedAt) continue;
        const hu = hc.userData;
        const elapsedEsc = now - hu._lowHpEscapeArmedAt;
        const tookFlight = isFlyingBirdChar(hc) && (hu.jy || 0) > 1.35;
        const rodeContraption = Boolean(hu.ridePath) || (hu.jy || 0) > 2.1;
        if (elapsedEsc >= 3600 || ((tookFlight || rodeContraption) && elapsedEsc >= 850)) {
          const curHp = hc === p ? (G.hp || 12) : (hu.ai?.hp || 12);
          const curMaxHp = hc === p ? (G.maxHp || BASE_HIDER_HP) : (hu.ai?.maxHp || BASE_HIDER_HP);
          const minHp = Math.max(1, Math.round(hu._lowHpMinSeen ?? curHp));
          hu._lowHpEscapeArmedAt = 0;
          hu._lowHpMinSeen = undefined;
          const methodLabel = tookFlight
            ? 'soaring into the clouds'
            : (rodeContraption ? 'launching off a village contraption' : 'slipping away from the seekers');
          viralHighlights.recordEscape({
            actor: hc,
            hpLeft: minHp,
            maxHp: curMaxHp,
            methodLabel,
            propId: hu.propId,
            pos: hc.position.clone(),
          });
        }
      }
    }

    // Camera Rig (End-of-Round Highlight Replay · Sky-Drop · Sky-Turret · 1st-person Seek · 3rd-person Hide!)
    if (endCinematic.isControllingCamera() && endCinematic.update(dt, camera)) {
      gun.visible = false;
    } else if (viralHighlights && viralHighlights.isPlayingHighlight()) {
      viralHighlights.updateHighlightCamera(dt, camera, THREE);
    } else if (G.mode === 'seek') {
      if (skyDropping) {
        seekerSkyDrop.update(dt, now);
      } else if (p.userData.inTurret && getActiveTurret()) {
        const tur = getActiveTurret();
        tur.setAim(G.yaw, G.pitch);
        const camPos = tur.getFirstPersonCameraPos();
        camera.position.copy(camPos);
        camera.rotation.set(G.pitch, G.yaw, 0, 'YXZ');
        gun.visible = false;
      } else {
        const basePy = (p.userData.groundY || 0) + (p.userData.specialY || 0);
        // AAA First-Person Seeker Tactile Polish: figure-8 walk bob, strafe roll, landing dip & trauma shake
        G._camLandDip = lerp(G._camLandDip || 0, 0, Math.min(1, dt * 13));
        G._camTrauma = Math.max(0, (G._camTrauma || 0) - dt * 2.1);
        const shk = (G._camTrauma || 0) * (G._camTrauma || 0);
        const shkX = shk > 0.001 ? Math.sin(now * 0.067) * shk * 0.14 : 0;
        const shkY = shk > 0.001 ? Math.cos(now * 0.081) * shk * 0.12 : 0;
        const shkR = shk > 0.001 ? Math.sin(now * 0.055) * shk * 0.045 : 0;
        const fpMoving = G.moving && (p.userData.jy || 0) < 0.08;
        const bobPhase = p.userData.bob || 0;
        const bobY = fpMoving ? Math.abs(Math.sin(bobPhase)) * 0.042 : Math.sin(now * 0.0022) * 0.008;
        const bobX = fpMoving ? Math.cos(bobPhase) * 0.022 : 0;
        const wantRoll = clamp(-mx * 0.028, -0.032, 0.032);
        G._fpRoll = lerp(G._fpRoll || 0, wantRoll, Math.min(1, dt * 10));
        G._gunRecoil = lerp(G._gunRecoil || 0, 0, Math.min(1, dt * 15));
        const yawVel = clamp(normAng(G.yaw - (G._prevCamYaw ?? G.yaw)) / Math.max(dt, 0.01), -8, 8);
        G._prevCamYaw = G.yaw;
        G._gunSwayX = lerp(G._gunSwayX || 0, clamp(-yawVel * 0.0085, -0.055, 0.055), Math.min(1, dt * 11));

        camera.position.set(
          p.position.x + Math.cos(G.yaw) * bobX + shkX,
          basePy + 1.55 + (p.userData.jy || 0) + bobY - (G._camLandDip || 0) + shkY,
          p.position.z - Math.sin(G.yaw) * bobX
        );
        camera.rotation.set(G.pitch + (G._gunRecoil || 0) * 0.022, G.yaw, (G._fpRoll || 0) + shkR, 'YXZ');
        // Nose against a wall? Ease the eye back a little (when there is room behind) so the screen is not one flat texture.
        {
          const fwd = _camTryDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
          ray.set(camera.position, fwd); ray.far = 0.8; ray.firstHitOnly = true;
          const ahead = ray.intersectObjects(solids, false).find((h) => !h.object.userData.ground);
          let back = 0;
          if (ahead) {
            const wantBack = Math.min(0.42, 0.8 - ahead.distance);
            const rev = _camTryDir2.set(-fwd.x, 0, -fwd.z);
            if (rev.lengthSq() > 1e-6) {
              rev.normalize();
              ray.set(camera.position, rev); ray.far = wantBack + 0.3;
              const behind = ray.intersectObjects(solids, false).find((h) => !h.object.userData.ground);
              back = behind ? Math.max(0, Math.min(wantBack, behind.distance - 0.3)) : wantBack;
              G._fpBack = lerp(G._fpBack || 0, back, Math.min(1, dt * 12));
              camera.position.addScaledVector(rev, G._fpBack);
            }
          } else if ((G._fpBack || 0) > 0.005) {
            G._fpBack = lerp(G._fpBack, 0, Math.min(1, dt * 12));
            const rev = _camTryDir2.set(-fwd.x, 0, -fwd.z);
            if (rev.lengthSq() > 1e-6) camera.position.addScaledVector(rev.normalize(), G._fpBack);
          }
          ray.firstHitOnly = false;
        }
        gun.position.z = lerp(gun.position.z, -0.5, dt * 11);
        gun.position.x = lerp(gun.position.x, 0.27 + (G._gunSwayX || 0) + bobX * 0.55, dt * 12);
        gun.position.y = lerp(gun.position.y, -0.22 - (G._camLandDip || 0) * 0.35 - bobY * 0.45 + (G._gunRecoil || 0) * 0.018, dt * 12);
        gun.rotation.x = lerp(gun.rotation.x, (G._gunRecoil || 0) * 0.14, dt * 14);
      }
    } else {
      if (G.spectating && (!G.specTarget || G.specTarget.userData?.actor?.eliminated)) {
        cycleSpectatorTarget(1);
      }
      const camSubj = (G.spectating && G.specTarget) ? G.specTarget : p;
      const su = camSubj.userData;
      const basePy = (su.groundY || 0) + (su.specialY || 0);
      const footPy = basePy + (su.jy || 0);
      const isFlyBird = isFlyingBirdChar(camSubj);
      const ht = (su.propId || su.specialMode) ? (su.height || 1) : 1.4;
      const dist = isFlyBird
        ? (4.6 + ht * 1.55 + ((su.jy || 0) > 0.35 ? 1.65 : 0))
        : (4.2 + ht * 1.2);
      const pivotY = footPy + ht * (isFlyBird ? 0.64 : 0.8);
      const cx = camSubj.position.x + Math.sin(G.yaw) * Math.cos(G.pitch) * dist;
      const cz = camSubj.position.z + Math.cos(G.yaw) * Math.cos(G.pitch) * dist;
      const cy = pivotY - Math.sin(G.pitch) * dist;
      const head = new THREE.Vector3(camSubj.position.x, pivotY, camSubj.position.z);
      const want = tmpV.set(cx, Math.max(basePy + 0.45, cy), cz);
      const cdir = want.clone().sub(head); const clen = cdir.length();
      let ch = null;
      if (clen > 1e-4) {
        cdir.divideScalar(clen);
        // how far the camera can sit along `dir` before something solid (bush, wall, tree) gets between it and the hider
        // (a small bundle of parallel rays, so a beam or branch just beside the sight line counts too)
        const camClearAlong = (dir, far) => {
          const side = _camTryDir2.set(dir.z, 0, -dir.x);
          if (side.lengthSq() < 1e-6) side.set(1, 0, 0); else side.normalize();
          let best = null;
          ray.far = far; ray.firstHitOnly = true;
          for (let k = 0; k < 5; k++) {
            _camRayO.copy(head);
            if (k === 1) _camRayO.addScaledVector(side, 0.32);
            else if (k === 2) _camRayO.addScaledVector(side, -0.32);
            else if (k === 3) _camRayO.y += 0.3;
            else if (k === 4) _camRayO.y -= 0.22;
            ray.set(_camRayO, dir);
            const hit = ray.intersectObjects(solids, false).find((h) => !h.object.userData.ground && !h.object.userData.propRoot && !(INSIDE && h.object.userData.isRoof));
            // side rays start beside the hider, so ignore whatever they touch in the first half metre
            if (hit && (k === 0 || hit.distance > 0.55) && (!best || hit.distance < best.distance)) best = hit;
          }
          ray.firstHitOnly = false;
          return best;
        };
        ch = camClearAlong(cdir, clen);
        if (ch) {
          let bestDir = cdir, bestDist = ch.distance - 0.35;
          // Squeezed against a bush or wall? Don't park the camera inside it — swing it up and over instead.
          if (bestDist < Math.min(clen, 2.4)) {
            for (const lift of [0.45, 0.85, 1.25]) {
              const pt = Math.max(-1.45, G.pitch - lift), cp = Math.cos(pt);
              const tryDir = _camTryDir.set(Math.sin(G.yaw) * cp, -Math.sin(pt), Math.cos(G.yaw) * cp).normalize();
              const th = camClearAlong(tryDir, dist);
              const d = th ? th.distance - 0.35 : dist;
              if (d > bestDist + 0.3) { bestDir = tryDir.clone(); bestDist = d; if (d >= 2.4) break; }
            }
          }
          want.copy(head).addScaledVector(bestDir, Math.max(0.38, bestDist));
        }
      }
      camera.position.lerp(want, Math.min(1, dt * (ch ? 25 : 14)));
      G._camTrauma = Math.max(0, (G._camTrauma || 0) - dt * 2.1);
      const shk3 = (G._camTrauma || 0) * (G._camTrauma || 0);
      if (shk3 > 0.001) {
        camera.position.x += Math.sin(now * 0.069) * shk3 * 0.16;
        camera.position.y += Math.cos(now * 0.083) * shk3 * 0.14;
      }
      camera.lookAt(camSubj.position.x, footPy + ht * (isFlyBird ? 0.58 : 0.7), camSubj.position.z);
      // Smoothly fade player's own big disguise mesh when camera pulls tight inside corners
      if (!G.spectating && p?.userData?.disguise) {
        const camD = camera.position.distanceTo(head);
        const wantAlpha = camD < 1.05 ? clamp(0.28 + (camD - 0.35) * 0.9, 0.28, 1) : 1;
        if (Math.abs((p.userData._selfCamAlpha ?? 1) - wantAlpha) > 0.04) {
          p.userData._selfCamAlpha = wantAlpha;
          p.userData.disguise.traverse((obj) => {
            if (obj.isMesh && obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              for (const m of mats) {
                if (wantAlpha < 0.98) {
                  if (m._origTransp === undefined) { m._origTransp = !!m.transparent; m._origOp = m.opacity ?? 1; }
                  m.transparent = true;
                  m.opacity = m._origOp * wantAlpha;
                } else if (m._origTransp !== undefined) {
                  m.transparent = m._origTransp;
                  m.opacity = m._origOp;
                }
              }
            }
          });
        }
      }
      // Subtle squash/jolt bounce animation on hit props
      for (const hChar of (G.allHiders || [])) {
        const hu = hChar?.userData;
        if (hu && hu.disguise && (hu._hitJoltT || 0) > 0) {
          hu._hitJoltT = Math.max(0, hu._hitJoltT - dt);
          const k = Math.sin((hu._hitJoltT / 0.16) * Math.PI);
          hu.disguise.position.y = k * 0.14;
        } else if (hu && hu.disguise && hu.disguise.position.y !== 0 && !hu.specialMode) {
          hu.disguise.position.y = 0;
        }
      }
      syncPosLockBtn();

      const near = !G.over && !G.spectating && !p.userData.specialMode ? nearbyProps(G.ghost ? HUE_RULES.HAUNT_RANGE : 3.6) : [];
      renderChips(G.ghost ? [] : near);
      const aimedRec = (!G.over && !G.spectating && !G.ghost && !p.userData.specialMode) ? findAimedProp(8.5) : null;
      const ap = aimedRec || (near[0] && near[0].rec);
      aimRing.visible = !!ap;
      if (ap) {
        aimRing.position.set(ap.pos.x, (ap.pos.y || 0) + 0.04, ap.pos.z);
        aimRing.scale.setScalar((ap.radius || 0.5) + 0.25 + Math.sin(now * 0.008) * 0.05);
      }
      let maxSus = 0;
      for (let i = 0; i < G.seekers.length; i++) {
        const sv = G.seekers[i].userData?.sus || 0;
        if (sv > maxSus) maxSus = sv;
      }
      const phaseBox = hudEl('phaseBox', () => document.querySelector('.phase'));
      const boxShad = maxSus > 0.45 ? `0 0 0 ${(2 + maxSus * 4).toFixed(1)}px rgba(217,83,79,${(0.3 + maxSus * 0.4).toFixed(2)}), 0 4px 0 rgba(60,70,50,.2)` : '';
      if (phaseBox && _hudState.phaseShad !== boxShad) {
        _hudState.phaseShad = boxShad;
        phaseBox.style.boxShadow = boxShad;
      }
    }

    // Dynamic AAA FOV widening & radial speedlines on sprint, smoke-dash, launch-stars, and flight
    {
      const curSpd = p?.userData?.spd || 0;
      const isBoosting = Boolean(
        p?.userData?.ridePath ||
        p?.userData?.rideRail ||
        (isFlyingBirdChar(p) && (p?.userData?.jy || 0) > 0.35) ||
        (hiderTricks && (hiderTricks.getSpeedMultiplier(p) || 1) > 1.2) ||
        curSpd > 6.0
      );
      const targetFov = G.over || G.phase === 'menu' || G.phase === 'vs'
        ? 62
        : clamp(62 + (isBoosting ? 7.5 : 0) + clamp((curSpd - 4.8) * 1.35, 0, 4.5), 62, 72);
      if (Math.abs(camera.fov - targetFov) > 0.06) {
        camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 8.5));
        camera.updateProjectionMatrix();
      }
      const sl = $('speedLines');
      if (sl) {
        const wantOp = (!G.over && isBoosting && curSpd > 5.4) ? clamp((curSpd - 5.4) * 0.24, 0, 0.82) : 0;
        const opStr = wantOp.toFixed(2);
        if (sl.style.opacity !== opStr) sl.style.opacity = opStr;
      }
    }

    if (!(viralHighlights && viralHighlights.isPlayingHighlight())) {
      updateShots(dt);
    }
    updateHud();

    const earChar = (G.spectating && G.specTarget) ? G.specTarget : p;
    audio.setListener(earChar.position.x, earChar.position.z, G.yaw);
    let threat = 0;
    if (G.mode === 'hide' && G.phase === 'survive' && !G.over) {
      let d = 99, su = 0;
      for (const s of G.seekers) {
        const u = s.userData, k = Math.floor((u.bob || 0) / Math.PI);
        d = Math.min(d, s.position.distanceTo(earChar.position)); su = Math.max(su, u.sus || 0);
        if (k !== u.stepK) { if (u.stepK !== undefined && (u.jy || 0) < 0.08) audio.seekerStep(s.position.x, s.position.z, u.sus || 0); u.stepK = k; }
      }
      const prox = clamp(1 - (d - 2.5) / 13, 0, 1);
      threat = clamp(Math.max(prox * 0.8, su * 0.95) + prox * su * 0.35 + ((earChar.userData.propId || earChar.userData.specialMode) ? 0 : 0.12), 0, 1);
      if (G.seekers.some((s) => s.userData.ai?.state === 'chase' && s.userData.ai?.target === earChar)) threat = Math.max(threat, 0.85);
      else if (G.seekers.some((s) => s.userData.ai?.state !== 'patrol' && s.position.distanceTo(earChar.position) < 12)) threat = Math.max(threat, 0.5);

      // Proximity Heartbeat, Warm Danger Vignette & "Nerves of Steel" (+25 XP)
      const isLocalDisguisedAlive = !G.spectating && !p.userData?.actor?.eliminated && !!(p.userData.propId || p.userData.specialMode);
      let dLocal = 99;
      if (isLocalDisguisedAlive) {
        for (const s of G.seekers) {
          if (s && !s.userData?.actor?.eliminated) {
            dLocal = Math.min(dLocal, s.position.distanceTo(p.position));
          }
        }
      }
      const dv = $('dangerVignette');
      if (isLocalDisguisedAlive && dLocal <= 4.5) {
        const proxInt = clamp(1 - (dLocal - 1.15) / 3.35, 0.12, 1.0);
        G.proxDanger = proxInt;
        const beatFired = audio.setProximityDanger(proxInt);
        if (beatFired) {
          haptics.heartbeat(proxInt);
          G._proxBeatPulse = 0.24;
        }
        G._proxBeatPulse = Math.max(0, (G._proxBeatPulse || 0) - dt * 0.9);
        if (dv) {
          dv.style.opacity = clamp(0.22 + proxInt * 0.56 + (G._proxBeatPulse || 0), 0, 0.96).toFixed(3);
        }
        // Hold completely still within <= 4.0m of a Seeker -> "Nerves of Steel" +25 XP!
        if (dLocal <= 4.0 && !G.moving && (p.userData.spd || 0) < 0.42 && !G.isTutorial) {
          G.nervesStillSec = (G.nervesStillSec || 0) + dt;
          if (G.nervesStillSec >= 3.5 && (G.nervesAwardsCount || 0) < 6) {
            G.nervesStillSec -= 3.5;
            G.nervesAwardsCount = (G.nervesAwardsCount || 0) + 1;
            G.boldSec = (G.boldSec || 0) + 3.5;
            if (progression) {
              progression.awardTokens('nerves_of_steel', 4, '🔥 Nerves of Steel! +25 XP · +4 🪙', 25);
            }
            haptics.nervesBonus();
            const nt = $('nervesToast');
            if (nt) {
              nt.textContent = `🔥 +25 XP · +4 🪙 · Nerves of Steel! (${dLocal.toFixed(1)}m)`;
              nt.classList.remove('hidden');
              clearTimeout(nervesToastTO);
              nervesToastTO = setTimeout(() => nt.classList.add('hidden'), 1950);
            }
          }
        } else {
          G.nervesStillSec = Math.max(0, (G.nervesStillSec || 0) - dt * 1.4);
        }
      } else {
        G.proxDanger = 0;
        G.nervesStillSec = 0;
        audio.setProximityDanger(0);
        if (dv && dv.style.opacity !== '0') dv.style.opacity = '0';
      }
    } else if (G.mode === 'seek' && G.phase === 'seek' && !G.over) {
      audio.setProximityDanger(0);
      if ($('dangerVignette') && $('dangerVignette').style.opacity !== '0') $('dangerVignette').style.opacity = '0';
      for (const s of G.seekers) {
        const u = s.userData, k = Math.floor((u.bob || 0) / Math.PI);
        if (k !== u.stepK) { if (u.stepK !== undefined && (u.jy || 0) < 0.08 && s.position.distanceTo(p.position) < 16) audio.seekerStep(s.position.x, s.position.z, 0.15); u.stepK = k; }
      }
      threat = clamp((25 - G.t) / 25, 0, 1) * 0.7;
    } else {
      audio.setProximityDanger(0);
      if ($('dangerVignette') && $('dangerVignette').style.opacity !== '0') $('dangerVignette').style.opacity = '0';
    }

    // Dynamic "Fever Time" Final 25s Banner & Periodic Directional Whistle Rings!
    const inActiveHunt = (G.phase === 'survive' || G.phase === 'seek') && !G.over && !G.isTutorial;
    const isFever = inActiveHunt && G.t > 0 && G.t <= 25;
    const fb = $('feverBanner');
    if (fb) fb.classList.toggle('hidden', !isFever);
    if (isFever) {
      const FEVER_CUES = [24, 17, 10, 4];
      for (let mIdx = 0; mIdx < FEVER_CUES.length; mIdx++) {
        const bit = 1 << mIdx;
        if (G.t <= FEVER_CUES[mIdx] && !((G.feverMilestoneMask || 0) & bit)) {
          G.feverMilestoneMask = (G.feverMilestoneMask || 0) | bit;
          if (mIdx === 0) {
            pushFeed('🔥', '<b>FEVER TIME!</b> Final 25s — listen for spirit whistle rings!', 'warn');
          }
          const livingH = aliveHidersList();
          let closestWhistleH = null, closestWhistleD = 999;
          for (const h of livingH) {
            spawnFeverWhistleRing(h.position);
            AI.emitSoundCue(h.position, 10.5, 'whistle', h);
            const distToEar = h.position.distanceTo(earChar.position);
            if (distToEar < closestWhistleD) {
              closestWhistleD = distToEar;
              closestWhistleH = h;
            }
          }
          if (closestWhistleH) {
            audio.feverWhistleRing(closestWhistleD, closestWhistleH.position.x, closestWhistleH.position.z);
          }
        }
      }
    }
    for (let ri = feverWhistleRings.length - 1; ri >= 0; ri--) {
      const rw = feverWhistleRings[ri];
      rw.t += dt * 1.15;
      const sc = 1 + rw.t * 6.2;
      rw.mesh.scale.setScalar(sc);
      rw.mesh.material.opacity = Math.max(0, 0.85 * (1 - rw.t) * (1 - rw.t));
      if (rw.t >= 1) {
        scene.remove(rw.mesh);
        rw.mesh.geometry.dispose();
        rw.mesh.material.dispose();
        feverWhistleRings.splice(ri, 1);
      }
    }
    if (worldEvents) threat = Math.max(threat, worldEvents.getMinThreat());
    audio.setThreat(threat);
    audio.setTimeLeft(G.over || G.phase === 'ready' ? -1 : G.t);
    const activeElemNow = elementalGuns ? elementalGuns.getCurrentElement() : 'water';
    audio.spray(G.firing && G.mode === 'seek' && G.phase === 'seek' && !G.over && activeElemNow === 'water' && !p.userData.inTurret);
  }
  if (elementalGuns) elementalGuns.update(dt, now);
  if (statusFx) statusFx.update(dt);
  if (progression) progression.update(dt);
  if (mobilePerf) mobilePerf.update(dt, G.phase === 'menu');
  if (activeWorldUpdate) activeWorldUpdate(dt, now / 1000);
  const skyDroppingAny = !!(seekerSkyDrop && seekerSkyDrop.isActive());
  const botDroppingAny = !!(seekerSkyDrop && seekerSkyDrop.isBotDropActive && seekerSkyDrop.isBotDropActive());
  const isReplayActive = !!(viralHighlights && viralHighlights.isPlayingHighlight());
  for (const c of [G.player, ...G.seekers, ...G.hiders]) {
    if (!c) continue;
    const u = c.userData;
    const isElim = !!u.actor?.eliminated && !u.ghost;
    const charSkyDropping = !!u._localSkyDrop;
    if (!isElim && !charSkyDropping && !u.actor?.isRemote && !isReplayActive) {
      if (u.specialMode === 'custom_spot' && u.specialSpot && u.specialSpot.getWorldPos) {
        const wp = u.specialSpot.getWorldPos();
        if (wp) { c.position.x = wp.x; c.position.z = wp.z; u.groundY = wp.y; if (typeof wp.rot === 'number') c.rotation.y = wp.rot; }
      } else if (!u.ridePath && !u.rideRail) {
        if (ACTIVE_MAP && ACTIVE_MAP.applyPlatformMotion && (u.jy || 0) < 0.25 && !u.specialMode) {
          ACTIVE_MAP.applyPlatformMotion(c, dt);
        }
        if (!u.specialMode || u.specialSpot?.mobile) {
          const activeT = getActiveTurret();
          if (u.inTurret && activeT) {
            const sy = activeT.seatY ?? ((activeT.y ?? 0) + 0.18);
            c.position.x = activeT.x; c.position.z = activeT.z; u.groundY = sy; u.jy = 0;
          } else {
            const prevFootY = (u.groundY || 0) + (u.jy || 0);
            const isVault = (u.jy || 0) > 0.16 && (u.vy || 0) > -2.5;
            const ng = groundHeightAt(c.position.x, c.position.z, prevFootY, isVault);
            if ((u.jy || 0) > 0.02 || (u.vy || 0) > 0.05) u.jy = Math.max(0, prevFootY - ng);
            u.groundY = ng;
          }
        }
      }
    }
    const inSwim = !isElim && !charSkyDropping && !!(ACTIVE_MAP && ACTIVE_MAP.isSwimmableWater && ACTIVE_MAP.isSwimmableWater(c.position.x, c.position.z) && (u.jy || 0) < 0.15);
    u.swimming = inSwim;
    if (inSwim && (u.spd || 0) > 0.6) {
      u.swimRippleT = (u.swimRippleT || 0) + dt;
      if (u.swimRippleT > 0.42) { u.swimRippleT = 0; ripple(c.position, 0.82); }
    }
    u.squash = lerp(u.squash, (u.propId || u.specialMode || charSkyDropping) ? 0 : (u.squashTarget || 0), Math.min(1, dt * 10));
    const dxMove = u.lastX == null ? 0 : c.position.x - u.lastX;
    const dzMove = u.lastZ == null ? 0 : c.position.z - u.lastZ;
    const spd = u.lastX == null ? 0 : Math.hypot(dxMove, dzMove) / Math.max(dt, 1e-3);
    u.lastX = c.position.x; u.lastZ = c.position.z; u.spd = lerp(u.spd || 0, spd, Math.min(1, dt * 10));
    const moving = c === G.player ? G.moving : u.spd > 0.4;
    if (u.aimUntil && now > u.aimUntil) { u.aim = false; u.aimUntil = 0; }
    if (u.animate && !u.propId && !u.specialMode) u.animate(dt, moving, u.spd);
    const animAnimalFn = u.propId && !u.specialMode && u.disguise?.userData?.animateAnimal;
    if (animAnimalFn) {
      if (c !== G.player && !u.actor?.isRemote && spd > 0.45) {
        c.rotation.y = lerpAngle(c.rotation.y, Math.atan2(dxMove, dzMove), Math.min(1, dt * 8.5));
      }
      const isAirborneAnimal = (u.jy || 0) > 0.16;
      const yawDelta = u._prevAnimYaw == null ? 0 : normAng(c.rotation.y - u._prevAnimYaw);
      u._prevAnimYaw = c.rotation.y;
      u._animBankRoll = lerp(u._animBankRoll || 0, isAirborneAnimal ? clamp(-yawDelta / Math.max(dt, 0.01) * 0.14, -0.46, 0.46) : 0, Math.min(1, dt * 7.0));
      const animVy = u.birdClimbing ? Math.max(u.vy || 0, 2.5) : (u.vy || 0);
      const isFlyDisguise = !!u.disguise?.userData?.canFly;
      const isStartledAnim = isFlyDisguise
        ? (!isAirborneAnimal && (u.spd || 0) > 5.4)
        : ((u.spd || 0) > 5.0 || (u.jy || 0) > 0.14);
      animAnimalFn(
        dt,
        moving,
        u.spd || 0,
        now / 1000,
        isStartledAnim,
        isAirborneAnimal,
        animVy,
        u._animBankRoll || 0
      );
    }

    // Keep friendly teammate nameplate positioned neatly above current height & distance-scaled
    if (u.nameplate && !isElim) {
      const topH = charSkyDropping ? 3.55 : ((u.propId || u.specialMode) ? (u.height || 0.9) + 0.55 : 1.88);
      u.nameplate.position.y = topH;
      const camD = camera.position.distanceTo(c.position);
      const tagSc = clamp(camD * 0.135, 0.54, 1.48);
      u.nameplate.scale.set(1.55 * tagSc, 0.39 * tagSc, 1);
      u.nameplate.material.opacity = clamp(1.05 - camD / 36, 0.25, 0.9);
    }

    const swimBob = inSwim ? Math.sin(now * 0.0038 + c.position.x * 0.6) * 0.055 : 0;
    const b = u.specialMode === 'tub'
      ? Math.sin(now * 0.0028) * 0.025
      : (u.specialMode === 'hook' || u.specialMode === 'custom_spot')
        ? Math.sin(now * 0.0024) * 0.022
        : u.propId
          ? (animAnimalFn ? (inSwim ? swimBob : 0) : (inSwim ? swimBob : (moving ? Math.abs(Math.sin(u.bob)) * 0.08 : 0)))
          : u.animate ? 0 : Math.sin(u.bob) * 0.06 * (1 - u.squash);
    const jitterY = (u._propJitterUntil && now < u._propJitterUntil) ? Math.abs(Math.sin(now * 0.052)) * 0.14 : 0;
    const jitterRot = (u._propJitterUntil && now < u._propJitterUntil) ? Math.sin(now * 0.068) * 0.22 : 0;
    const k = u.shrink ?? 1;
    // AAA Elastic Morph Pop-In, Jump Stretch & Landing Squash!
    let sx = 1, sy = 1, sz = 1;
    if ((u._morphPopT || 0) > 0) {
      u._morphPopT = Math.max(0, u._morphPopT - dt);
      const p01 = 1 - u._morphPopT / 0.28;
      const env = Math.exp(-p01 * 5.2) * Math.sin(p01 * Math.PI * 2.5);
      const grow = Math.min(1, p01 * 3.4);
      sx = grow * (1 - env * 0.34);
      sy = grow * (1 + env * 0.38);
      sz = sx;
    } else if ((u._jumpStretchT || 0) > 0) {
      u._jumpStretchT = Math.max(0, u._jumpStretchT - dt);
      const jK = Math.sin((u._jumpStretchT / 0.22) * Math.PI);
      sx = 1 - jK * 0.14; sy = 1 + jK * 0.22; sz = sx;
    } else if ((u._landSquashT || 0) > 0) {
      u._landSquashT = Math.max(0, u._landSquashT - dt);
      const lK = Math.sin((u._landSquashT / 0.22) * Math.PI) * clamp(u._landImpact || 0.7, 0.3, 1.25);
      sx = 1 + lK * 0.22; sy = Math.max(0.68, 1 - lK * 0.24); sz = sx;
    }
    if (u.propId || u.specialMode || charSkyDropping) c.scale.set(k * sx, k * sy, k * sz);
    else c.scale.set((1 + u.squash * 0.18) * k * sx, (1 - u.squash * 0.42 + b) * k * sy, (1 + u.squash * 0.18) * k * sz);
    if (!isElim && !charSkyDropping && !isReplayActive) c.position.y = (u.groundY || 0) + (u.specialY || 0) + (u.jy || 0) + ((u.propId || u.specialMode) ? b : swimBob) + jitterY;
    // Running prop playful Pixar waddle-tilt synced to hop cycle!
    if (u.disguise && !u.disguise.userData?.animateAnimal) {
      const waddleRot = (moving && !u.specialMode && (u.jy || 0) < 0.08) ? Math.sin(u.bob) * 0.11 : 0;
      u.disguise.rotation.z = jitterRot !== 0 ? jitterRot : waddleRot;
    }
    // Dynamic Contact Shadow grounded at terrain level, shrinking & fading cleanly with jump height!
    if (u._contactShadow) {
      const shVis = !isElim && !charSkyDropping && !inSwim && !u.specialMode && !(c === G.player && G.mode === 'seek');
      u._contactShadow.visible = shVis;
      if (shVis) {
        const liftY = (u.jy || 0) + ((u.propId || u.specialMode) ? b : 0) + jitterY;
        const shRad = clamp((u.radius || 0.45) * 1.95, 0.62, 1.85) * clamp(1 - liftY * 0.14, 0.42, 1.0);
        u._contactShadow.position.y = -liftY + 0.035;
        u._contactShadow.scale.set(shRad / Math.max(0.25, sx * k), 1, shRad / Math.max(0.25, sz * k));
        if (u._contactShadow.material) {
          u._contactShadow.material.opacity = clamp(0.68 * (1 - liftY * 0.22), 0.12, 0.68);
        }
      }
    }
    if (u._windCloakUntil && now < u._windCloakUntil && !isElim) {
      if (!u._cloakPrev) {
        u._cloakPrev = true;
        c.traverse((m) => {
          if (!m.isMesh || !m.material || m === u._contactShadow) return;
          if (!m.userData._cloakOrigMat) {
            m.userData._cloakOrigMat = m.material;
            try {
              const makeCloakMat = (mat) => {
                if (!mat || typeof mat.clone !== 'function') return mat;
                const cm = mat.clone();
                cm.transparent = true;
                cm.opacity = 0.24;
                cm.depthWrite = false;
                return cm;
              };
              const cm = Array.isArray(m.material) ? m.material.map(makeCloakMat) : makeCloakMat(m.material);
              m.material = cm;
              m.userData._cloakMat = cm;
            } catch (_) {
              m.userData._cloakMat = m.material;
            }
          } else if (m.userData._cloakMat) {
            m.material = m.userData._cloakMat;
          }
        });
      }
    } else if (u._cloakPrev) {
      u._cloakPrev = false;
      c.traverse((m) => {
        if (m.isMesh && m.userData._cloakOrigMat) {
          m.material = m.userData._cloakOrigMat;
        }
      });
    }
  }
  if (!skyDroppingAny) updateInside();
  if (windmillSails) windmillSails.rotation.z += dt * 0.6;
  if (laundryCloth) laundryCloth.rotation.x = Math.sin(now * 0.0016) * 0.12 + Math.sin(now * 0.0041) * 0.04;
  grassTime.value = now / 1000;
  updateDynamicTimeOfDay(dt);
  if (painterlyGfx) painterlyGfx.update(dt, clamp((BASE_ATMOS.activePhaseT - 0.55) / 0.45, 0, 1));
  if (tier1Visuals) {
    tier1Visuals.update(dt);
    tier1Visuals.updateGrassBenders([...(G.allHiders || []), ...(G.allSeekers || [])], camera.position);
  }
  updateAmbientMotes(dt, now * 0.001);
  updateDustPuffs(dt);
  updateElimPropLaunches(dt);
  update3DEmoteBubbles(dt);
  updateWorldBeacons(now);
}

function stepSim(steps = 1, dt = 0.04) {
  for (let i = 0; i < steps; i++) {
    simClockOffset += dt * 1000;
    stepFrame(dt, simNow());
  }
  sun.shadow.needsUpdate = true;
  renderScene();
}

function loop(rawNow) {
  requestAnimationFrame(loop);
  if (WORLD_BUILDING) { last = rawNow; return; }   // half-built world: keep showing the last frame
  if (mobilePerf && !mobilePerf.shouldRenderFrame(rawNow, G.phase === 'menu')) {
    return;
  }
  const dt = Math.min(0.05, (rawNow - last) / 1000); last = rawNow;
  try {
    stepFrame(dt, simNow());
    renderScene();
  } catch (err) {
    console.error('[loop]', err);
  }
}
requestAnimationFrame(loop);
window.__hs = {
  get cloudSave() { return cloudSave; },
  get analytics() { return analytics; },
  G, AI, MP, TEAM_SIZE, spots, startHide, startSeek, startTutorialRound, spawnTutorialDummy, clearTutorialDummies,
  enterMatchQueue, playVsIntro, toMenu, selectMap, stepSim,
  MAP_ORDER, MAP_REGISTRY, ENTER, SLOTS, LIVE, blockers,
  blockedAt: (x, z, r = 0.45, refY) => blockedAt(x, z, r, refY),
  whereIs, disguise, undisguise, enterSpecialSpot, exitSpecialSpot, mountTurret, dismountTurret,
  playerFire, onCharHit, transform, triggerInteract, groundHeightAt, moveChar, routeVia, jump, doCharJump,
  get activeMapId() { return activeMapId; },
  get ACTIVE_MAP() { return ACTIVE_MAP; },
  get INSIDE() { return INSIDE; },
  get READY() { return READY; },
  get hiderTricks() { return hiderTricks; },
  get seekerGadgets() { return seekerGadgets; },
  get worldEvents() { return worldEvents; },
  get matchFlow() { return matchFlow; },
  get viralHighlights() { return viralHighlights; },
  get endCinematic() { return endCinematic; },
  get progression() { return progression; },
  get elementalGuns() { return elementalGuns; },
  get hueLayer() { return hueLayer; },
  get statusFx() { return statusFx; },
  HUE_RULES,
  audio,
  haptics,
  get mobileControls() { return mobileControls; },
  get mobileLobby() { return mobileLobby; },
  get mobilePerf() { return mobilePerf; },
  get seekerSkyDrop() { return seekerSkyDrop; },
  get tutorial() { return tutorial; },
  get genreKing() { return genreKing; },
  get painterlyGfx() { return painterlyGfx; },
  get tier1Visuals() { return tier1Visuals; },
  get nextGenBridge() { return nextGenBridge; },
  get nextGenAssets() { return nextGenAssets; },
  HERO_GLB_CACHE,
  makePainter,
  syncOfflineNoticeUI,
  refreshLobbyChampionPreview,
  openCharacterSelect,
  closeCharacterSelect,
  get meadowExpansion() { return meadowExpansion; },
  hint,
  scene, camera, realProps, puddles, composer, bloomPass, worldOptimizer, renderer, shots, dropI, SEEK, solids,
  get KIT() { return KIT; },
};
