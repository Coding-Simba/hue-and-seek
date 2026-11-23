/* Hue & Seek — Solo First-Time Player Sanctuary (`maps/tutorial/map.js`).
 * Handcrafted Storybook "Spirit Training Dojo" built strictly with `metalness: 0`
 * matte gouache materials from `maps/map_kit.js`:
 *   • Sunlit domed 3D squircle cobblestone plaza (`r = 8.6m`) + lush swaying 3D ribbon grass (`r = 8.8..18.2m`)
 *   • Mossy dry-stone sanctuary wall, glowing stone toro lanterns, 8 Sakura & Wisteria Storybook trees,
 *     and gently drifting 3D sakura petals
 *   • West Vault & Parkour Lane (`(-4.6, 1.8)`): Standable wooden garden bench + stepped crates for jump practice
 *   • East Prop Morphing Gallery (`(4.6, 1.8)`): Real village props (`barrel`, `crate`, `pumpkin`, `chair`, `stool`)
 *     with adjacent open hiding slots so `[1][2][3]` prop chips appear immediately
 *   • North Enterable Spirit Tea Pavilion (`(0, -6.2)`): Hollow timber-and-plaster Storybook dojo with roof cutaway,
 *     glowing shoji windows, and indoor props (for hiding & Seeker Echo Pulse dowsing!)
 *   • West-North Steaming Hinoki Cedar Hot Tub (`(-5.2, -3.2)`): Interactive `[G]` / `#btnInteract` special spot
 *     that disguises Hiders as a floating wooden bath duck (`🦆`)!
 */
import {
  makeRng,
  paintedCanvasTex,
  brushStrokes,
  gouacheGrainTex,
  kitTex,
  mergeStatic,
  RoundedBoxGeometry,
  createBuilderKit,
  buildInstancedCobblePaving,
  buildStorybookTree,
  createAnimatedWater,
  createSwayingBlades,
} from '../map_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const WORLD_STATE = {
  interactSpots: [],
};

// ============================================================================
// Handcrafted Floating Wooden Bath Duck Disguise (`kind: 'tub'`)
// ============================================================================
function buildDojoBathDuck(THREE) {
  const g = new THREE.Group();
  g.name = 'dojo_bath_duck';
  const grain = gouacheGrainTex(THREE, 2, 2);
  const yellowM = new THREE.MeshStandardMaterial({ color: 0xffcf48, map: grain, roughness: 0.88, metalness: 0 });
  const beakM = new THREE.MeshStandardMaterial({ color: 0xf27935, map: grain, roughness: 0.86, metalness: 0 });
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x241914 });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x62af48, map: grain, roughness: 0.90, metalness: 0 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), yellowM);
  body.scale.set(1.05, 0.78, 1.25);
  body.position.set(0, 0.06, 0);
  g.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.18, 8), yellowM);
  tail.position.set(0, 0.14, -0.22);
  tail.rotation.x = -0.65;
  g.add(tail);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 10), yellowM);
  head.position.set(0, 0.24, 0.15);
  g.add(head);

  const beak = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.055, 0.12, 2, 0.02), beakM);
  beak.position.set(0, 0.22, 0.29);
  g.add(beak);

  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeM);
    eye.position.set(sx * 0.095, 0.265, 0.245);
    g.add(eye);

    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), yellowM);
    wing.scale.set(0.38, 0.65, 1.15);
    wing.position.set(sx * 0.21, 0.09, -0.02);
    g.add(wing);
  }

  // Little Storybook onsen leaf perched on the duck's head!
  const leaf = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.02, 0.07, 1, 0.008), leafM);
  leaf.position.set(0.02, 0.385, 0.15);
  leaf.rotation.set(0.12, 0.35, -0.18);
  g.add(leaf);

  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return g;
}

// ============================================================================
// Enterable Storybook Spirit Tea Pavilion (`w = 7.2, d = 5.6`, South Door)
// ============================================================================
function buildTrainingPavilion(THREE, seed = 21) {
  const B = createBuilderKit(THREE, { seed, garden: false }, 'training_pavilion', 3);
  const { root, roofG, colliders, tex, M, G, glowMat, add, rbox } = B;

  const W = 7.2, D = 5.6, H = 3.15, TH = 0.24, DOOR_W = 2.1, DOOR_H = 2.38;
  const hw = W * 0.5, hd = D * 0.5;

  const plasterM = M(0xf8efe0, tex('plaster', 2.2, 1.6));
  const timberM = M(0x6d472c, tex('wood_planks_dark', 1.4, 2.0));
  const trimM = M(0x9b663f, tex('wood_light', 1.5, 1.5));
  const floorM = M(0xc89968, tex('wood_light', 2.6, 2.2));
  const plinthM = G(0xb9afa0, tex('stone', 2.4, 0.8), 0.48, 0.62);
  const roofUnderM = M(0x5c3c26, tex('wood_planks_dark', 2, 2));
  const goldM = M(0xe6b24a, gouacheGrainTex(THREE, 2, 2));
  const norenM = M(0x3a6b8c, gouacheGrainTex(THREE, 2, 2));

  // Stone foundation plinth + warm wooden tatami-plank interior floor (`ground: true`)
  const floorSlab = add(rbox(W + 0.36, 0.10, D + 0.36, 0.03, plinthM, 1), 0, 0.02, 0);
  floorSlab.userData.ground = true;
  floorSlab.userData.paint = new THREE.Color(0xb9afa0);

  const woodFloor = add(rbox(W - 0.16, 0.05, D - 0.16, 0.015, floorM, 1), 0, 0.055, 0);
  woodFloor.userData.ground = true;
  woodFloor.userData.paint = new THREE.Color(0xc89968);

  // Back (North `-Z`), West (`-X`), East (`+X`), and South (`+Z`) doorway wall
  B.wall(0, -hd, PI, W, H, TH, [], plasterM, plasterM);
  B.wall(-hw, 0, -PI / 2, D, H, TH, [], plasterM, plasterM);
  B.wall(hw, 0, PI / 2, D, H, TH, [], plasterM, plasterM);
  B.wall(0, hd, 0, W, H, TH, [{ door: true, u: 0, w: DOOR_W, h: DOOR_H }], plasterM, plasterM);
  const sideW = (W - DOOR_W) * 0.5;

  // Exposed Storybook timber corner posts, top ring beams & doorway posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(rbox(0.28, H + 0.12, 0.28, 0.03, timberM, 1), sx * (hw - 0.08), H * 0.5, sz * (hd - 0.08));
    }
    add(rbox(0.22, DOOR_H + 0.1, 0.30, 0.025, timberM, 1), sx * (DOOR_W * 0.5 + 0.06), DOOR_H * 0.5, hd - TH * 0.5 + 0.02);
  }
  add(rbox(DOOR_W + 0.55, 0.20, 0.34, 0.03, timberM, 1), 0, DOOR_H + 0.06, hd - TH * 0.5 + 0.03);
  add(rbox(W + 0.24, 0.18, 0.22, 0.025, timberM, 1), 0, H, hd - 0.06);
  add(rbox(W + 0.24, 0.18, 0.22, 0.025, timberM, 1), 0, H, -hd + 0.06);
  add(rbox(0.22, 0.18, D + 0.24, 0.025, timberM, 1), -hw + 0.06, H, 0);
  add(rbox(0.22, 0.18, D + 0.24, 0.025, timberM, 1), hw - 0.06, H, 0);

  // Indigo noren cloth flaps high above doorway (`y = 2.08..2.38`, clear of head height) + golden dojo crest plaque
  for (let i = -1; i <= 1; i++) {
    add(rbox(0.56, 0.34, 0.03, 0.01, norenM, 1), i * 0.62, DOOR_H - 0.16, hd + 0.06);
  }
  add(rbox(1.45, 0.42, 0.09, 0.025, trimM, 1), 0, H - 0.32, hd + 0.08);
  add(rbox(1.22, 0.24, 0.05, 0.015, goldM, 1), 0, H - 0.32, hd + 0.12);

  // Glowing divided-light shoji windows + flowerboxes on East, West, and South flanking walls
  B.storybookShutterWindow(-hw - 0.02, 1.62, 0, -PI / 2, 1.15, 1.05, { shutterHex: 0x4f7c6b });
  B.storybookShutterWindow(hw + 0.02, 1.62, 0, PI / 2, 1.15, 1.05, { shutterHex: 0x4f7c6b });
  B.storybookShutterWindow(-(DOOR_W * 0.5 + sideW * 0.5), 1.58, hd + 0.02, 0, 0.88, 0.92, { shutterHex: 0x4f7c6b });
  B.storybookShutterWindow(DOOR_W * 0.5 + sideW * 0.5, 1.58, hd + 0.02, 0, 0.88, 0.92, { shutterHex: 0x4f7c6b });

  // Warm interior hanging paper lantern
  const lanternGlow = glowMat(0xfff1c2, 0xffb347, 1.25);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.42, 12), lanternGlow), 0, H - 0.48, -0.2);

  // Cutaway Kawara Tiled Gable Roof (`roofG` is named `'roof'` by `createBuilderKit` so `registerEnterable` cuts it away!)
  const eaveW = W + 1.15, eaveD = D + 1.15, ridgeH = 1.65;
  const slopeLen = Math.hypot(eaveD * 0.5, ridgeH);
  const slopePitch = Math.atan2(ridgeH, eaveD * 0.5);
  for (const sz of [-1, 1]) {
    const deck = add(
      rbox(eaveW, 0.11, slopeLen, 0.02, roofUnderM, 1),
      0,
      H + ridgeH * 0.5 - 0.04,
      sz * (eaveD * 0.25),
      sz * slopePitch,
      0,
      0,
      roofG
    );
    deck.castShadow = true;
    B.tileRoofSlope({
      cx: 0,
      cy: H + ridgeH * 0.5 + 0.03,
      cz: sz * (eaveD * 0.25),
      width: eaveW,
      slopeLen,
      pitch: slopePitch,
      rotY: sz > 0 ? 0 : PI,
      style: 'barrel',
      palette: [0x43566c, 0x4e647d, 0x394a5e, 0x58708a],
      parent: roofG,
    });
  }
  // Gable triangle infill & ridge beam in `roofG`
  for (const sx of [-1, 1]) {
    const triShape = new THREE.Shape();
    triShape.moveTo(-eaveD * 0.46, 0);
    triShape.lineTo(eaveD * 0.46, 0);
    triShape.lineTo(0, ridgeH);
    triShape.closePath();
    const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.16, bevelEnabled: false });
    triGeo.rotateY(PI / 2);
    triGeo.translate(sx * (hw - 0.08) - 0.08, H, 0);
    add(new THREE.Mesh(triGeo, plasterM), 0, 0, 0, 0, 0, 0, roofG);
  }
  add(rbox(eaveW + 0.22, 0.22, 0.26, 0.04, goldM, 1), 0, H + ridgeH + 0.04, 0, 0, 0, 0, roofG);

  // Climbing wisteria vine framing the South entrance
  B.climbingVine(
    [
      [-hw + 0.15, 0.15, hd + 0.12],
      [-hw + 0.45, 1.45, hd + 0.16],
      [-1.45, 2.75, hd + 0.18],
      [0.25, 2.95, hd + 0.18],
    ],
    { bloomCols: [0xc59bf0, 0xdcbcfa, 0xf6e6ff], droop: true, cutY: H - 0.1 }
  );

  B.finalize();

  root.userData.rooms = [{ x: 0, z: 0, w: W - 0.5, d: D - 0.5 }];
  root.userData.door = { x: 0, z: hd + 0.85 };
  root.userData.doorIn = { x: 0, z: hd - 0.85 };
  root.userData.footprint = { w: W, d: D };
  root.userData.floorY = 0.08;
  root.userData.propSlots = [
    { id: 'barrel', x: -2.35, z: -1.65, rot: 0.3, y: 0.08 },
    { id: 'crate', x: 2.35, z: -1.65, rot: -0.2, y: 0.08 },
    { id: 'stool', x: -2.25, z: 1.15, rot: 0.5, y: 0.08 },
    { id: 'flower_pot', x: 2.25, z: 1.15, rot: 0.0, y: 0.08 },
  ];
  return root;
}

// ============================================================================
// Standable Wooden Vault Bench & Parkour Crate Steps (`(-4.6, 1.8)`)
// ============================================================================
function buildVaultBench(THREE) {
  const g = new THREE.Group();
  g.name = 'dojo_vault_bench';
  const woodLight = new THREE.MeshStandardMaterial({
    color: 0xc98b52,
    map: kitTex(THREE, 'wood_light', 2, 1),
    roughness: 0.90,
    metalness: 0,
  });
  const woodDark = new THREE.MeshStandardMaterial({
    color: 0x734a2b,
    map: kitTex(THREE, 'wood_planks_dark', 1, 1),
    roughness: 0.92,
    metalness: 0,
  });

  // Wide low hurdle seat (`top y = 0.50m` — effortless, satisfying jump-over or jump-onto!)
  const seat = new THREE.Mesh(new RoundedBoxGeometry(2.65, 0.11, 0.72, 2, 0.028), woodLight);
  seat.position.set(0, 0.445, 0);
  g.add(seat);

  const stretcher = new THREE.Mesh(new RoundedBoxGeometry(2.25, 0.08, 0.12, 1, 0.02), woodDark);
  stretcher.position.set(0, 0.22, 0);
  g.add(stretcher);

  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.42, 0.62, 2, 0.025), woodDark);
    leg.position.set(sx * 1.04, 0.21, 0);
    g.add(leg);
  }

  mergeStatic(THREE, g);
  g.userData.merged = true;
  g.userData.colliders = [{ x: 0, z: 0, w: 2.65, d: 0.72, h: 0.50 }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = new THREE.Color(0xc98b52);
    }
  });
  return g;
}

function buildParkourStepCrates(THREE) {
  const g = new THREE.Group();
  g.name = 'dojo_step_crates';
  const crateM = new THREE.MeshStandardMaterial({
    color: 0xd49a5c,
    map: kitTex(THREE, 'wood_light', 1.4, 1.4),
    roughness: 0.90,
    metalness: 0,
  });
  const bandM = new THREE.MeshStandardMaterial({
    color: 0x855634,
    map: kitTex(THREE, 'wood_planks_dark', 1.2, 1.2),
    roughness: 0.92,
    metalness: 0,
  });

  // Lower step crate (`h = 0.54m`) + upper perch crate (`h = 0.96m`)
  const low = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.54, 0.96, 2, 0.03), crateM);
  low.position.set(-0.55, 0.27, 0);
  g.add(low);

  const lowTrim = new THREE.Mesh(new RoundedBoxGeometry(1.00, 0.08, 1.00, 1, 0.015), bandM);
  lowTrim.position.set(-0.55, 0.50, 0);
  g.add(lowTrim);

  const high = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.96, 0.98, 2, 0.03), crateM);
  high.position.set(0.52, 0.48, 0);
  g.add(high);

  const highTrim = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.08, 1.02, 1, 0.015), bandM);
  highTrim.position.set(0.52, 0.92, 0);
  g.add(highTrim);

  mergeStatic(THREE, g);
  g.userData.merged = true;
  g.userData.colliders = [
    { x: -0.55, z: 0, w: 0.96, d: 0.96, h: 0.54 },
    { x: 0.52, z: 0, w: 0.98, d: 0.98, h: 0.96 },
  ];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = new THREE.Color(0xd49a5c);
    }
  });
  return g;
}

// ============================================================================
// Steaming Hinoki Cedar Hot-Spring Tub (`(-5.2, -3.2)`) + Stone Toro Lanterns
// ============================================================================
function buildHinokiHotTub(THREE) {
  const g = new THREE.Group();
  g.name = 'dojo_hinoki_tub';
  const cedarM = new THREE.MeshStandardMaterial({
    color: 0xc98d55,
    map: kitTex(THREE, 'wood_light', 2, 1),
    roughness: 0.89,
    metalness: 0,
  });
  const hoopM = new THREE.MeshStandardMaterial({
    color: 0x4b382a,
    map: gouacheGrainTex(THREE, 2, 2),
    roughness: 0.90,
    metalness: 0,
  });
  const stoneM = new THREE.MeshStandardMaterial({
    color: 0xbab0a0,
    map: kitTex(THREE, 'stone', 2, 2),
    roughness: 0.93,
    metalness: 0,
  });

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.56, 0.08, 24), stoneM);
  pad.position.y = 0.04;
  pad.userData.ground = true;
  pad.userData.paint = new THREE.Color(0xbab0a0);
  g.add(pad);

  // Hollow wooden stave rim
  const N = 18, R = 1.02, tubH = 0.66;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const stave = new THREE.Mesh(new RoundedBoxGeometry(0.39, tubH, 0.13, 1, 0.02), cedarM);
    stave.position.set(Math.sin(a) * R, 0.08 + tubH * 0.5, Math.cos(a) * R);
    stave.rotation.y = a;
    g.add(stave);
  }
  for (const hy of [0.24, 0.54]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(R + 0.065, 0.026, 6, 28), hoopM);
    hoop.rotation.x = PI / 2;
    hoop.position.y = hy;
    g.add(hoop);
  }

  mergeStatic(THREE, g);
  g.userData.merged = true;
  g.userData.colliders = [{ x: 0, z: 0, w: 2.08, d: 2.08, h: 0.72 }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      if (!m.userData.paint) m.userData.paint = new THREE.Color(0xc98d55);
    }
  });
  return g;
}

function buildStoneToroLantern(THREE) {
  const g = new THREE.Group();
  g.name = 'dojo_stone_lantern';
  const stoneM = new THREE.MeshStandardMaterial({
    color: 0xc8bfb0,
    map: kitTex(THREE, 'stone', 1.2, 1.2),
    roughness: 0.93,
    metalness: 0,
  });
  const glowM = new THREE.MeshStandardMaterial({
    color: 0xfff0be,
    emissive: 0xffb347,
    emissiveIntensity: 1.15,
    roughness: 0.55,
    metalness: 0,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 0.18, 8), stoneM);
  base.position.y = 0.09;
  g.add(base);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.92, 8), stoneM);
  post.position.y = 0.62;
  g.add(post);

  const tray = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.10, 0.52, 1, 0.02), stoneM);
  tray.position.y = 1.12;
  g.add(tray);

  const lightBox = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.34, 1, 0.02), glowM);
  lightBox.position.y = 1.34;
  g.add(lightBox);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.34, 4), stoneM);
  cap.position.y = 1.66;
  cap.rotation.y = PI / 4;
  g.add(cap);

  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), stoneM);
  jewel.position.y = 1.86;
  g.add(jewel);

  mergeStatic(THREE, g);
  g.userData.merged = true;
  g.userData.colliders = [{ x: 0, z: 0, w: 0.64, d: 0.64, h: 1.85 }];
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.paint = new THREE.Color(0xc8bfb0);
    }
  });
  return g;
}

// ============================================================================
// Exported `MAP_DEF` for `MAP_REGISTRY.tutorial`
// ============================================================================
export const MAP_DEF = {
  id: 'tutorial',
  title: 'Spirit Training Dojo',
  shortTitle: 'Training Dojo',
  subtitle: 'Sunlit Storybook sanctuary to learn every Hider & Seeker move at your own pace',
  badge: 'Solo Dojo',
  preview: 'assets/concepts/map_overview.webp',
  useMeadowSky: true,
  mapRadius: 18.0,
  sky: { top: 0x5aa6e6, mid: 0xc4e3f3, bot: 0xf7e6c4, sunDisc: 0xfff5dc },
  fog: { color: 0xd8e8e2, near: 36, far: 115 },
  lights: {
    hemiSky: 0xd4ebff,
    hemiGround: 0x8ca65f,
    hemiInt: 1.28,
    sunColor: 0xffd59e,
    sunInt: 2.75,
    sunPos: [24, 38, 18],
    exposure: 1.08,
  },
  camMenu: { r: 14.5, y: 11.2, lookY: 0.8 },
  playerSpawn: [0, 7.2],
  seekSpawn: [0, 7.2],
  seekerSpawns: [[-2.0, -2.0], [2.0, -2.0]],
  props: [],
  propIcons: {},

  buildProps() {
    return {};
  },

  groundHeightAt() {
    return 0;
  },

  surfaceAt(x, z) {
    return Math.hypot(x, z) < 8.7 ? 'stone' : 'grass';
  },

  getInteractSpots() {
    return WORLD_STATE.interactSpots;
  },

  getNearbyInteraction(player, G) {
    if (!player || (G && G.mode && G.mode !== 'hide')) return null;
    const u = player.userData || {};
    if (u.specialMode === 'tub') {
      return {
        kind: 'tub',
        icon: '🦆',
        label: 'Hop Out of Cedar Tub',
        exitHint: 'Hopped out of the warm cedar tub! ♨️',
      };
    }
    for (const sp of WORLD_STATE.interactSpots) {
      if (Math.hypot(player.position.x - sp.x, player.position.z - sp.z) < 2.45) {
        return sp;
      }
    }
    return null;
  },

  buildTubDisguise(THREE) {
    return buildDojoBathDuck(THREE);
  },

  buildWorld(ctx) {
    const { THREE, root } = ctx;
    const rng = makeRng(2026);
    WORLD_STATE.interactSpots = [];

    // 1. Hand-painted sunlit gouache meadow ground disc (`r = 24m`)
    const grassTex = paintedCanvasTex(THREE, 'tut_meadow_grass_v1', 512, (g, S, r) => {
      g.fillStyle = '#79b252';
      g.fillRect(0, 0, S, S);
      brushStrokes(g, S, r, 900, ['#6aa446', '#86bf5c', '#93ca66', '#5d953d', '#a2d472'], 4, 16, 0.46, 0.4, 2.8, 44);
      brushStrokes(g, S, r, 320, ['#b5df82', '#649c42'], 2, 6, 0.32, -0.6, 3.14, 22);
    }, 5, 5);
    const meadowGeo = new THREE.CircleGeometry(24.5, 72);
    meadowGeo.rotateX(-PI / 2);
    const meadowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: grassTex,
      roughness: 0.94,
      metalness: 0,
    });
    const meadowDisc = new THREE.Mesh(meadowGeo, meadowMat);
    meadowDisc.receiveShadow = true;
    meadowDisc.userData.ground = true;
    meadowDisc.userData.paint = new THREE.Color(0x79b252);
    root.add(meadowDisc);

    // 2. Central 3D Instanced Domed Squircle Cobblestone Sanctuary Plaza (`r = 8.6m`)
    const plaza = buildInstancedCobblePaving(THREE, {
      name: 'dojo_cobble_plaza',
      r: 8.6,
      y: 0.016,
      seed: 47,
      spokes: 8,
      palette: [0xd9ccb8, 0xcdbfa9, 0xe3d7c3, 0xc3b9c6, 0xd4c4b2],
      accentPalette: [0xe6c88c, 0xd8b87c, 0xead4a4],
      bedHex: 0xcabca8,
    });
    root.add(plaza);

    // Warm sunlit compass medallion at `(0, 2.2)` (Movement Target Circle!)
    const medMat = new THREE.MeshStandardMaterial({
      color: 0xeac982,
      map: kitTex(THREE, 'stone', 1.5, 1.5),
      roughness: 0.91,
      metalness: 0,
    });
    const medallion = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.22, 0.026, 24), medMat);
    medallion.position.set(0, 0.018, 2.2);
    medallion.receiveShadow = true;
    medallion.userData.ground = true;
    medallion.userData.paint = new THREE.Color(0xeac982);
    root.add(medallion);

    // 3. Low Mossy Dry-Stone Sanctuary Perimeter Wall (`r = 18.2m`)
    const wallGrp = new THREE.Group();
    const wallStoneM = new THREE.MeshStandardMaterial({
      color: 0xbdb5a6,
      map: kitTex(THREE, 'stone', 2, 1),
      roughness: 0.94,
      metalness: 0,
    });
    const wallCapM = new THREE.MeshStandardMaterial({
      color: 0x82ab5a,
      map: kitTex(THREE, 'leaves', 2, 2),
      roughness: 0.93,
      metalness: 0,
    });
    const WALL_SEGS = 36, WALL_R = 18.35;
    const segLen = (TAU * WALL_R) / WALL_SEGS * 1.03;
    for (let i = 0; i < WALL_SEGS; i++) {
      const a = (i / WALL_SEGS) * TAU;
      const sx = Math.sin(a) * WALL_R, sz = Math.cos(a) * WALL_R;
      const body = new THREE.Mesh(new RoundedBoxGeometry(segLen, 0.92, 0.62, 2, 0.06), wallStoneM);
      body.position.set(sx, 0.46, sz);
      body.rotation.y = a;
      wallGrp.add(body);

      const mossTop = new THREE.Mesh(new RoundedBoxGeometry(segLen * 0.96, 0.14, 0.68, 2, 0.04), wallCapM);
      mossTop.position.set(sx, 0.94, sz);
      mossTop.rotation.y = a;
      wallGrp.add(mossTop);
    }
    mergeStatic(THREE, wallGrp);
    wallGrp.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.paint = new THREE.Color(0xbdb5a6);
      }
    });
    root.add(wallGrp);

    // 4. Enterable North Spirit Tea Pavilion (`(0, -6.2)`, South doorway at `(0, -3.4)`)
    const pavilion = buildTrainingPavilion(THREE, 21);
    ctx.placeKit(pavilion, 0, -6.2, 0, 0.04, true, 0);

    // 5. West Parkour / Vaulting Hurdle Bench & Stepped Crates (`(-4.6, 1.8)` & `(-5.6, 3.8)`)
    const vaultBench = buildVaultBench(THREE);
    ctx.placeKit(vaultBench, -4.6, 1.8, 0.18, 0.03, true, 0);

    const stepCrates = buildParkourStepCrates(THREE);
    ctx.placeKit(stepCrates, -5.8, 3.9, 0.35, 0.03, true, 0);

    // 6. Steaming Hinoki Hot-Spring Tub Special Spot (`(-5.2, -3.2)`)
    const hotTubX = -5.2, hotTubZ = -3.2;
    const hotTub = buildHinokiHotTub(THREE);
    ctx.placeKit(hotTub, hotTubX, hotTubZ, 0, 0.03, true, 0);

    const tubWater = createAnimatedWater(THREE, {
      radius: 0.94,
      y: 0.64,
      deep: 0x2d8ca0,
      shallow: 0x6ce0e8,
      foam: 0xf4ffff,
      opacity: 0.88,
      walkable: false,
    });
    tubWater.mesh.position.set(hotTubX, 0.64, hotTubZ);
    root.add(tubWater.mesh);

    WORLD_STATE.interactSpots.push({
      kind: 'tub',
      id: 'tut_cedar_tub',
      icon: '♨️',
      label: 'Hide in Cedar Tub',
      disguiseLabel: 'Onsen Bath Duck 🦆',
      enterHint: 'Submerged in the steaming cedar tub as a bath duck! 🦆 (Move or press G to hop out)',
      exitHint: 'Hopped out of the cedar tub! ♨️',
      x: hotTubX,
      y: 0.24,
      z: hotTubZ,
      groundY: 0,
      exitX: hotTubX + 1.55,
      exitZ: hotTubZ + 0.65,
      offsetY: 0.42,
      occupiedBy: null,
    });

    // 7. Glowing Stone Toro Lanterns framing the Plaza & Pavilion
    const lanternCoords = [
      [-2.3, -2.9],
      [2.3, -2.9],
      [-3.4, 7.6],
      [3.4, 7.6],
    ];
    for (const [lx, lz] of lanternCoords) {
      ctx.placeKit(buildStoneToroLantern(THREE), lx, lz, 0, 0.03, true, 0);
    }

    // 8. East Prop Morphing Gallery (`(4.6, 1.8)`) + West Garden Vignette (`(5.4, -2.8)`)
    // Guarantee iconic real props (`barrel`, `crate`, `pumpkin`, `chair`, `stool`) right beside open slots!
    ctx.addVig('tut_prop_gallery_a', { x: 4.6, y: 0, z: 1.8, rot: 0 }, [
      ['barrel', -0.85, -0.55, 0.2],
      ['crate', 0.85, -0.55, -0.25],
      ['pumpkin', -0.85, 0.80, 0.4],
      ['chair', 0.85, 0.80, -2.4],
      ['stool', 0.0, -1.35, 0.1],
    ], 1);

    ctx.addVig('tut_prop_gallery_b', { x: 5.4, y: 0, z: -2.6, rot: 0 }, [
      ['barrel', -0.7, 0.0, 0.3],
      ['milk_can', 0.65, -0.4, -0.2],
      ['flower_pot', 0.55, 0.65, 0.1],
      ['bucket', -0.55, 0.75, 0.5],
    ], 1);

    // 9. Blooming Sakura & Wisteria Storybook Trees around the Outer Meadow Ring
    // (Keep South behind spawn `(0, 7.2..15)` open so the 3rd-person camera never clips branches!)
    const treeRing = [
      [-12.8, -10.5, 'sakura', 1.08],
      [12.8, -10.5, 'wisteria', 1.10],
      [14.8, 0.8, 'sakura', 1.05],
      [12.2, 11.2, 'green', 1.12],
      [7.4, 14.8, 'sakura', 1.08],
      [-7.4, 14.8, 'wisteria', 1.06],
      [-12.2, 11.2, 'sakura', 1.05],
      [-14.8, 0.6, 'green', 1.10],
      [6.8, -13.6, 'sakura', 1.04],
    ];
    treeRing.forEach(([tx, tz, style, sc], idx) => {
      const treeOpts = style === 'sakura'
        ? {
            seed: 300 + idx * 17,
            foliagePalette: [0xf6a6bd, 0xfbc2d2, 0xee8ba8, 0xfde0e8],
            hangingBlossoms: [0xffd2df, 0xfff0f5],
            hangingCount: 12,
            canopyScale: sc,
          }
        : style === 'wisteria'
          ? {
              seed: 400 + idx * 19,
              foliagePalette: [0x68af4c, 0x7ec25d, 0x56983e],
              hangingBlossoms: [0xc396f2, 0xd8b6fa, 0xf0e0ff],
              hangingCount: 16,
              canopyScale: sc,
            }
          : {
              seed: 500 + idx * 23,
              foliagePalette: [0x5ca442, 0x74be52, 0x8fd162, 0x488c36],
              canopyScale: sc,
            };
      const tr = buildStorybookTree(THREE, treeOpts);
      ctx.placeKit(tr, tx, tz, rng.jr(0, TAU), 0.04, true, 0);
    });

    // 10. Swaying 3D Storybook Meadow Ribbon Blades (`r = 8.8..17.6m`)
    const swayingGrass = createSwayingBlades(THREE, {
      count: 2400,
      height: 0.52,
      width: 0.055,
      color: 0x7cb654,
      spread: 18.0,
      seed: 91,
      filter: (x, z) => {
        const d = Math.hypot(x, z);
        if (d < 8.85 || d > 17.5) return false;
        // Keep clear around North Pavilion & West Hot Tub
        if (Math.abs(x) < 4.4 && z < -2.6 && z > -9.6) return false;
        if (Math.hypot(x - hotTubX, z - hotTubZ) < 2.1) return false;
        return true;
      },
    });
    root.add(swayingGrass.inst);

    // 11. Gently Rising Onsen Steam Puffs + Drifting Sakura Petals
    const STEAM_N = 8;
    const steamGeo = new THREE.IcosahedronGeometry(0.22, 1);
    const steamMat = new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      emissive: 0xe6dfd2,
      emissiveIntensity: 0.30,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
    });
    const steamInst = new THREE.InstancedMesh(steamGeo, steamMat, STEAM_N);
    steamInst.frustumCulled = false;
    root.add(steamInst);

    const PETAL_N = 72;
    const petalGeo = new THREE.CircleGeometry(0.085, 5);
    const petalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const petalInst = new THREE.InstancedMesh(petalGeo, petalMat, PETAL_N);
    petalInst.frustumCulled = false;
    const petalPalette = [0xffb7c5, 0xffd1dc, 0xffe6ee, 0xf69ab0];
    const petalStates = [];
    for (let i = 0; i < PETAL_N; i++) {
      petalInst.setColorAt(i, new THREE.Color(petalPalette[i % petalPalette.length]));
      petalStates.push({
        x: rng.jr(-15, 15),
        y: rng.jr(0.8, 8.5),
        z: rng.jr(-15, 15),
        vy: rng.jr(0.38, 0.72),
        ph: rng.jr(0, TAU),
        sp: rng.jr(0.8, 1.6),
      });
    }
    root.add(petalInst);

    const dummy = new THREE.Object3D();
    let elapsed = 0;

    return {
      update(dt = 0.016, now) {
        const safeDt = clamp(dt, 0, 0.08);
        elapsed = typeof now === 'number' ? now : elapsed + safeDt;

        tubWater.update(elapsed);
        swayingGrass.update(elapsed);

        for (let i = 0; i < STEAM_N; i++) {
          const cyc = (elapsed * 0.46 + i / STEAM_N) % 1;
          dummy.position.set(
            hotTubX + Math.sin(elapsed * 1.4 + i * 1.3) * (0.28 + cyc * 0.22),
            0.72 + cyc * 2.1,
            hotTubZ + Math.cos(elapsed * 1.2 + i * 1.7) * (0.28 + cyc * 0.22)
          );
          const sc = (0.45 + cyc * 1.15) * (1 - cyc * 0.65);
          dummy.scale.setScalar(Math.max(0.02, sc));
          dummy.rotation.set(elapsed * 0.4 + i, elapsed * 0.5, 0);
          dummy.updateMatrix();
          steamInst.setMatrixAt(i, dummy.matrix);
        }
        steamInst.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < PETAL_N; i++) {
          const pt = petalStates[i];
          let y = pt.y - ((elapsed * pt.vy) % 8.0);
          if (y < 0.25) y += 8.0;
          dummy.position.set(
            pt.x + Math.sin(elapsed * pt.sp + pt.ph) * 0.75,
            y,
            pt.z + Math.cos(elapsed * pt.sp * 0.85 + pt.ph) * 0.75
          );
          dummy.rotation.set(elapsed * 1.8 + pt.ph, elapsed * 1.3 + pt.ph * 0.5, Math.sin(elapsed * 2.1 + pt.ph) * 0.7);
          dummy.scale.set(1.15, 0.82, 1);
          dummy.updateMatrix();
          petalInst.setMatrixAt(i, dummy.matrix);
        }
        petalInst.instanceMatrix.needsUpdate = true;
      },
    };
  },
};
