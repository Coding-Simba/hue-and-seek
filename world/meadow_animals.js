/* Meadowbrook Living Countryside Animals, Open-Gated Habitats & Deterministic Herd System
 * Storybook pastoral animals (soft countryside palette) built for 60 FPS mobile play:
 *   - 7 playable & NPC animal prop builders (<= 5 merged meshes & <= 260 triangles per animal, +Z forward, y=0 ground)
 *   - 4 open-gated outer-meadow habitats (Sunny Pasture, Chicken Coop Yard, Muddy Pigpen & Wallow, Stream Duck Pond)
 *   - 18 deterministic PvP-synced NPC animals with organic grazing/pecking, 5.0s stampede scurry, and Web Audio calls
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { kitTex, mergeStatic } from '../hero_cottage.js';

export const ANIMAL_PROP_ICONS = {
  mb_cow: '🐄',
  mb_chicken: '🐔',
  mb_pig: '🐖',
  mb_sheep: '🐑',
  mb_duck: '🦆',
  mb_dog: '🐕',
  mb_cat: '🐈',
  mb_heron: '🦉',
  mb_stork: '🦚',
  mb_roc: '🦅',
};

export const ANIMAL_PROP_DEFS = [
  { id: 'mb_cow',     label: 'Spotted Cow',           radius: 0.66, height: 1.22, hp: 240, speed: 0.92, isAnimal: true },
  { id: 'mb_chicken', label: 'Speckled Hen',          radius: 0.28, height: 0.50, hp: 140, speed: 1.14, isAnimal: true },
  { id: 'mb_pig',     label: 'Muddy Pig',             radius: 0.46, height: 0.74, hp: 185, speed: 1.00, isAnimal: true },
  { id: 'mb_sheep',   label: 'Woolly Sheep',          radius: 0.52, height: 0.92, hp: 210, speed: 0.96, isAnimal: true },
  { id: 'mb_duck',    label: 'Stream Duck',           radius: 0.30, height: 0.48, hp: 145, speed: 1.10, isAnimal: true },
  { id: 'mb_dog',     label: 'Shepherd Dog',          radius: 0.40, height: 0.76, hp: 175, speed: 1.12, isAnimal: true },
  { id: 'mb_cat',     label: 'Ginger Cat',            radius: 0.28, height: 0.46, hp: 145, speed: 1.16, isAnimal: true },
  // 3 Distinct Magical Flying Bird Tiers: LARGE (1.42m) · LARGER (1.96m) · HUGE (2.72m)!
  { id: 'mb_heron',   label: 'Starlight Owl-Griffin', radius: 0.54, height: 1.42, hp: 175, speed: 1.18, isAnimal: true, canFly: true, sizeTier: 'large' },
  { id: 'mb_stork',   label: 'Sun-Plume Sky-Phoenix', radius: 0.66, height: 1.96, hp: 210, speed: 1.12, isAnimal: true, canFly: true, sizeTier: 'larger' },
  { id: 'mb_roc',     label: 'Colossal Cloud-Roc',    radius: 0.90, height: 2.72, hp: 265, speed: 1.02, isAnimal: true, canFly: true, sizeTier: 'huge' },
];

// Muddy Pigpen wallow oval (~3.2m x 2.4m) east/behind the Red Barn (22, -14)
export const MUD_WALLOW_SPEC = {
  x: 30.5,
  z: -13.5,
  rx: 1.62,
  rz: 1.22,
  rot: -0.18,
};

export function isInMudWallow(x, z) {
  const dx = x - MUD_WALLOW_SPEC.x;
  const dz = z - MUD_WALLOW_SPEC.z;
  const c = Math.cos(MUD_WALLOW_SPEC.rot);
  const s = Math.sin(MUD_WALLOW_SPEC.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return (lx * lx) / (MUD_WALLOW_SPEC.rx * MUD_WALLOW_SPEC.rx) +
         (lz * lz) / (MUD_WALLOW_SPEC.rz * MUD_WALLOW_SPEC.rz) <= 1.0;
}

// Habitat landmark coordinates (exported for inspection / minimap / events)
export const ANIMAL_HABITAT_CENTERS = {
  pasture:  { x: 29.5, z: 3.5 },
  coop:     { x: 17.5, z: -24.5 },
  pigpen:   { x: 30.5, z: -13.5 },
  duckPond: { x: 15.5, z: 24.5 },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

// ============================================================================
// Hand-Painted Storybook Animal Swatch Atlas (single shared material -> 1 mesh per merged limb group!)
// ============================================================================
const SWATCHES = {
  creamCoat:    [0xfbf4e4, 0xf2e6cc],
  cocoaSpot:    [0x5d3d2c, 0x4b2f21],
  rosyPink:     [0xf6b3ae, 0xe89995],
  hoofDark:     [0x362e2a, 0x28211e],
  collarRed:    [0xc9483b, 0xab362b],
  bellGold:     [0xf2c546, 0xdba82e],
  hornIvory:    [0xeee0c2, 0xdfd0ad],
  eyeDark:      [0x1e1715, 0x15100e],
  eyeWhite:     [0xffffff, 0xfafcff],
  henRusset:    [0xc96c38, 0xb05626],
  henSpeckle:   [0xf5e2c2, 0xe3ca9f],
  henTail:      [0x7d3a1e, 0x622b14],
  combRed:      [0xd93832, 0xba2622],
  beakGold:     [0xf4b636, 0xdf9c1e],
  pigPink:      [0xf7b5ba, 0xe89da4],
  pigSnout:     [0xeb8d98, 0xd97783],
  mudCoat:      [0x6b4730, 0x553622],
  woolCream:    [0xfcf6e8, 0xede2ca],
  woolPuff:     [0xf4ead4, 0xe4d7bc],
  sheepFace:    [0x3d3430, 0x2e2724],
  duckWhite:    [0xfaf6ec, 0xebe3d3],
  duckWing:     [0x8f9d9f, 0x78878a],
  mallardGreen: [0x2b7d64, 0x1f624e],
  duckBill:     [0xf29224, 0xd97914],
  dogTan:       [0xd18c45, 0xb87430],
  dogSaddle:    [0x634027, 0x4d301c],
  collarBlue:   [0x488ec4, 0x3574a6],
  catGinger:    [0xe88635, 0xcf6e20],
  catStripe:    [0xb34f1a, 0x943d11],
  collarBerry:  [0xc73c4f, 0xa62b3d],
  tonguePink:   [0xf2808b, 0xdc6874],
  storkWhite:    [0xfdfaf2, 0xede6d6],
  storkBlack:    [0x262930, 0x1a1c22],
  storkCoral:    [0xe85a34, 0xc94422],
  heronSlate:    [0x6f8ba6, 0x56708a],
  heronPlume:    [0xdbe7f2, 0xc4d4e3],
  phoenixIvory:  [0xfef8ec, 0xf0e3ca],
  phoenixCream:  [0xf9ebd0, 0xe7d1aa],
  phoenixAmber:  [0xf8b940, 0xdf8d20],
  phoenixGold:   [0xffda6a, 0xf0ae32],
  phoenixTeal:   [0x4dc5be, 0x2f9b98],
  phoenixAzure:  [0x399ec4, 0x25789b],
  phoenixIndigo: [0x3b4d98, 0x263370],
  phoenixCoral:  [0xec8d38, 0xcc6b20],
  phoenixBlush:  [0xf5b09b, 0xe29179],
  eyeAmber:      [0x6e3b18, 0x42210b],
  moonSilver:    [0xf3f7fd, 0xd8e4f3],
  moonViolet:    [0x5357aa, 0x373a7e],
  owlRusset:     [0xb85c38, 0x934323],
  owlPlum:       [0x4f355c, 0x362142],
  owlBuff:       [0xf7ebd2, 0xe3cfa9],
  eyeEmerald:    [0x2eb872, 0x19824c],
  rocCrimson:    [0xc8322b, 0x991f1a],
  rocFlame:      [0xf27429, 0xd15314],
  rocObsidian:   [0x272636, 0x171622],
  rocBronze:     [0xd99b38, 0xb3771e],
};
const SWATCH_KEYS = Object.keys(SWATCHES);
const SWATCH_INDEX = Object.fromEntries(SWATCH_KEYS.map((k, i) => [k, i]));

let sharedAnimalMaterial = null;
const animalMatByThree = new WeakMap();
const celestialGlowByThree = new WeakMap();

function getCelestialGlowMaterials(THREE) {
  if (celestialGlowByThree.has(THREE)) return celestialGlowByThree.get(THREE);
  const mats = {
    crystalMat: new THREE.MeshStandardMaterial({
      color: 0xbaf8ff,
      emissive: 0x35d6ff,
      emissiveIntensity: 0.85,
      roughness: 0.28,
      metalness: 0,
    }),
    starMat: new THREE.MeshStandardMaterial({
      color: 0xfff5b5,
      emissive: 0xffba38,
      emissiveIntensity: 0.84,
      roughness: 0.30,
      metalness: 0,
    }),
    moonCrystalMat: new THREE.MeshStandardMaterial({
      color: 0xd8fbff,
      emissive: 0x62e2ff,
      emissiveIntensity: 0.84,
      roughness: 0.28,
      metalness: 0,
    }),
    emeraldGlowMat: new THREE.MeshStandardMaterial({
      color: 0xc8ffe0,
      emissive: 0x3ce896,
      emissiveIntensity: 0.84,
      roughness: 0.28,
      metalness: 0,
    }),
    rubyMat: new THREE.MeshStandardMaterial({
      color: 0xffc29e,
      emissive: 0xff481c,
      emissiveIntensity: 0.88,
      roughness: 0.28,
      metalness: 0,
    }),
  };
  celestialGlowByThree.set(THREE, mats);
  return mats;
}

function getAnimalMaterial(THREE) {
  if (animalMatByThree.has(THREE)) return animalMatByThree.get(THREE);
  const grid = 8;
  const cell = 32;
  const size = grid * cell;
  let tex;

  if (typeof document !== 'undefined' && document.createElement) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#faf3e3';
    ctx.fillRect(0, 0, size, size);

    let s = 1337;
    const rr = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const hexCss = (h) => `#${h.toString(16).padStart(6, '0')}`;

    SWATCH_KEYS.forEach((key, idx) => {
      const gx = idx % grid;
      const gy = Math.floor(idx / grid);
      const x0 = gx * cell;
      const y0 = gy * cell;
      const [cMain, cShade] = SWATCHES[key];
      ctx.fillStyle = hexCss(cMain);
      ctx.fillRect(x0, y0, cell, cell);
      // Soft Storybook gouache brush dabs inside the inner region so mipmaps never bleed across cells
      if (key !== 'eyeWhite' && key !== 'eyeDark') {
        ctx.fillStyle = hexCss(cShade);
        ctx.globalAlpha = 0.24;
        for (let k = 0; k < 9; k++) {
          const bx = x0 + 6 + rr() * (cell - 12);
          const by = y0 + 6 + rr() * (cell - 12);
          ctx.beginPath();
          ctx.arc(bx, by, 2.2 + rr() * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    });
    tex = new THREE.CanvasTexture(cv);
  } else {
    // Headless Node verification fallback
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = 250; data[i * 4 + 1] = 243; data[i * 4 + 2] = 227; data[i * 4 + 3] = 255;
    }
    SWATCH_KEYS.forEach((key, idx) => {
      const gx = idx % grid;
      const gy = Math.floor(idx / grid);
      const cMain = SWATCHES[key][0];
      const r = (cMain >> 16) & 255, g = (cMain >> 8) & 255, b = cMain & 255;
      for (let py = 0; py < cell; py++) {
        for (let px = 0; px < cell; px++) {
          const p = ((gy * cell + py) * size + (gx * cell + px)) * 4;
          data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
        }
      }
    });
    tex = new THREE.DataTexture(data, size, size);
    tex.needsUpdate = true;
  }

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  sharedAnimalMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    roughness: 0.92,
    metalness: 0,
  });
  animalMatByThree.set(THREE, sharedAnimalMaterial);
  return sharedAnimalMaterial;
}

function paintGeoSwatch(geo, swatchName) {
  const idx = SWATCH_INDEX[swatchName] ?? 0;
  const grid = 8;
  const gx = idx % grid;
  const gy = Math.floor(idx / grid);
  // Canvas row 0 is at UV v = 1; stay inside inner 50% of cell for zero mipmap bleed
  const u0 = (gx + 0.25) / grid;
  const u1 = (gx + 0.75) / grid;
  const v0 = 1 - (gy + 0.75) / grid;
  const v1 = 1 - (gy + 0.25) / grid;

  let uv = geo.attributes.uv;
  const count = geo.attributes.position.count;
  if (!uv || uv.count !== count) {
    const arr = new Float32Array(count * 2);
    geo.setAttribute('uv', new geo.attributes.position.constructor(arr, 2));
    uv = geo.attributes.uv;
  }
  for (let i = 0; i < count; i++) {
    const ou = clamp(uv.getX(i), 0, 1);
    const ov = clamp(uv.getY(i), 0, 1);
    uv.setXY(i, u0 + ou * (u1 - u0), v0 + ov * (v1 - v0));
  }
  uv.needsUpdate = true;
  return geo;
}

// ============================================================================
// Shared Organic Animation Controller for All 7 Animals (NPCs & Morphed Hiders)
// ============================================================================
const ANIMAL_MOTION_PROFILES = {
  mb_cow:     { biped: false, stride: 4.4, legAmp: 0.28, bounce: 0.028, wag: 0.22, grazePeriod: 7.2, grazeDur: 2.9, grazeDip: 0.54, hop: 0.13 },
  mb_sheep:   { biped: false, stride: 5.0, legAmp: 0.32, bounce: 0.032, wag: 0.24, grazePeriod: 6.4, grazeDur: 2.6, grazeDip: 0.50, hop: 0.15 },
  mb_pig:     { biped: false, stride: 6.2, legAmp: 0.36, bounce: 0.034, wag: 0.34, grazePeriod: 5.8, grazeDur: 2.3, grazeDip: 0.44, hop: 0.14 },
  mb_dog:     { biped: false, stride: 6.6, legAmp: 0.40, bounce: 0.038, wag: 0.38, grazePeriod: 6.8, grazeDur: 1.8, grazeDip: 0.38, hop: 0.17 },
  mb_cat:     { biped: false, stride: 6.8, legAmp: 0.36, bounce: 0.026, wag: 0.26, grazePeriod: 7.6, grazeDur: 2.0, grazeDip: 0.34, hop: 0.16 },
  mb_chicken: { biped: true,  stride: 9.2, legAmp: 0.52, bounce: 0.028, wag: 0.20, grazePeriod: 4.6, grazeDur: 2.1, grazeDip: 0.64, hop: 0.18 },
  mb_duck:    { biped: true,  stride: 8.0, legAmp: 0.48, bounce: 0.026, wag: 0.24, grazePeriod: 5.4, grazeDur: 2.2, grazeDip: 0.46, hop: 0.15 },
  mb_heron:   { biped: true,  canFly: true, stride: 6.8, legAmp: 0.46, bounce: 0.032, wag: 0.18, grazePeriod: 5.8, grazeDur: 2.1, grazeDip: 0.30, hop: 0.18, flapClimb: 16.2, flapGlide: 4.6, flapAmp: 0.62 },
  mb_stork:   { biped: true,  canFly: true, stride: 5.6, legAmp: 0.44, bounce: 0.032, wag: 0.16, grazePeriod: 6.4, grazeDur: 2.3, grazeDip: 0.48, hop: 0.20, flapClimb: 13.0, flapGlide: 3.6, flapAmp: 0.68 },
  mb_roc:     { biped: true,  canFly: true, stride: 4.4, legAmp: 0.38, bounce: 0.040, wag: 0.12, grazePeriod: 7.4, grazeDur: 2.6, grazeDip: 0.36, hop: 0.24, flapClimb: 9.2,  flapGlide: 2.4, flapAmp: 0.72 },
};

let seedCounter = 1;
function nextSeedPhase() {
  seedCounter = (seedCounter * 16807) % 2147483647;
  return ((seedCounter - 1) / 2147483646) * Math.PI * 20;
}

export function attachAnimalAnimator(root, kind, seedPhase = nextSeedPhase()) {
  const prof = ANIMAL_MOTION_PROFILES[kind] || ANIMAL_MOTION_PROFILES.mb_cow;
  const bodyGrp = root.getObjectByName('bodyGrp');
  const headGrp = root.getObjectByName('headGrp');
  const legsA = root.getObjectByName('legsA');
  const legsB = root.getObjectByName('legsB');
  const tailGrp = root.getObjectByName('tailGrp');
  const wingL = root.getObjectByName('wingL');
  const wingR = root.getObjectByName('wingR');

  const base = {
    bodyY: bodyGrp ? bodyGrp.position.y : 0.5,
    headX: headGrp ? headGrp.rotation.x : 0,
    headY: headGrp ? headGrp.position.y : 0.6,
    headZ: headGrp ? headGrp.position.z : 0.3,
    tailX: tailGrp ? tailGrp.rotation.x : 0,
  };

  let walkPhase = (seedPhase * 1.3) % (Math.PI * 2);
  let flapPhase = (seedPhase * 0.9) % (Math.PI * 2);
  let fallbackClock = seedPhase;

  root.userData.isAnimal = true;
  root.userData.animalId = kind;
  root.userData.canFly = !!prof.canFly;
  root.userData.seedPhase = seedPhase;

  root.userData.animateAnimal = (dt, moving, speed, timeSec = 0, startled = false, airborne = false, vy = 0, bankRoll = 0) => {
    const cdt = clamp(Number.isFinite(dt) ? dt : 0.016, 0, 0.1);
    fallbackClock += cdt;
    const t = timeSec > 0 ? timeSec : fallbackClock;
    const spd = typeof speed === 'number' ? speed : (moving ? 1.8 : 0);
    const isMoving = Boolean(moving) && spd > 0.25;
    const blend = 1 - Math.exp(-cdt * 11);
    const wingBlend = 1 - Math.exp(-cdt * 14);

    let targetBodyY = base.bodyY;
    let targetBodyPitch = 0;
    let targetBodyRoll = 0;
    let targetBodyScaleX = 1;
    let targetBodyScaleY = 1;
    let targetHeadPitch = base.headX;
    let targetHeadYaw = 0;
    let targetHeadRoll = 0;
    let targetHeadZ = base.headZ;
    let targetLegA = 0;
    let targetLegB = 0;
    let targetTailYaw = 0;
    let targetTailPitch = base.tailX;
    let targetTailRoll = 0;
    // Default folded wing cape pose tucked along avian flanks & wrist-folded (scale.x = 0.50 perched -> 1.00 open!)
    let targetWingLX = -0.22, targetWingLY =  1.25, targetWingLZ = -0.52;
    let targetWingRX = -0.22, targetWingRY = -1.25, targetWingRZ =  0.52;
    let targetWingScale = 0.50;

    if (prof.canFly && airborne) {
      targetWingScale = 1.0;
      const climbing = vy > 0.22 || startled;
      flapPhase += cdt * (climbing ? (prof.flapClimb || 13.2) : (prof.flapGlide || 3.6));
      const flap = climbing
        ? 0.06 + Math.sin(flapPhase) * (prof.flapAmp || 0.68)
        : 0.13 + Math.sin(flapPhase) * 0.075;
      targetWingLX = 0.04;
      targetWingLY = 0.04;
      targetWingLZ = flap;
      targetWingRX = 0.04;
      targetWingRY = -0.04;
      targetWingRZ = -flap;

      targetBodyY = base.bodyY + (climbing ? -Math.sin(flapPhase) * 0.065 : Math.sin(t * 2.2 + seedPhase) * 0.03);
      targetBodyPitch = clamp(-vy * 0.042, -0.24, 0.24) + (kind === 'mb_heron' ? 0.18 : 0.10);
      targetBodyRoll = clamp(bankRoll || 0, -0.42, 0.42);
      targetHeadZ = base.headZ + (kind === 'mb_heron' ? 0.03 : 0.08);
      targetHeadPitch = base.headX + (kind === 'mb_heron' ? 0.08 : 0.20) + clamp(-vy * 0.03, -0.14, 0.14);
      targetLegA = kind === 'mb_heron' ? -0.95 : -1.24;
      targetLegB = kind === 'mb_heron' ? -0.95 : -1.24;
      targetTailPitch = base.tailX + (kind === 'mb_stork' ? 0.14 + Math.sin(t * 3.4 + seedPhase) * 0.075 : 0.08);
      targetTailYaw = clamp(-(bankRoll || 0) * 0.45, -0.22, 0.22) + Math.sin(t * 2.6 + seedPhase) * (kind === 'mb_stork' ? 0.10 : 0.04);
      targetTailRoll = kind === 'mb_stork' ? Math.cos(t * 2.6 + seedPhase) * 0.08 : 0;
    } else if (startled) {
      walkPhase += cdt * prof.stride * 3.1;
      const p = walkPhase;
      const hopWave = Math.abs(Math.sin(p * 0.95));
      targetBodyY = base.bodyY + hopWave * prof.hop;
      targetBodyPitch = Math.cos(p * 0.95) * 0.11;
      targetBodyRoll = Math.sin(p * 1.4) * (prof.biped ? 0.16 : 0.07);
      if (prof.canFly) {
        targetWingScale = 1.0;
        flapPhase += cdt * 16.5;
        const f = Math.sin(flapPhase) * 0.58;
        targetWingLX = 0.04; targetWingLY = 0.18; targetWingLZ = f;
        targetWingRX = 0.04; targetWingRY = -0.18; targetWingRZ = -f;
      } else if (prof.biped) {
        // Comic ruffled wing-flap expansion on chicken & duck!
        const flap = Math.abs(Math.sin(p * 2.6));
        targetBodyScaleX = 1 + flap * 0.28;
        targetBodyScaleY = 1 - flap * 0.08;
      } else {
        targetBodyScaleY = 1 + hopWave * 0.06;
      }
      targetHeadPitch = base.headX - 0.26 + Math.sin(p * 2.1) * 0.08;
      targetHeadYaw = Math.sin(p * 1.3) * 0.16;
      targetLegA = Math.sin(p * 1.5) * prof.legAmp * 1.35;
      targetLegB = -Math.sin(p * 1.5) * prof.legAmp * 1.35;
      targetTailPitch = base.tailX + (prof.biped ? 0.24 : 0.32);
      targetTailYaw = Math.sin(p * 2.8) * prof.wag * 1.6;
    } else if (isMoving) {
      const rate = prof.stride * clamp(spd, 0.55, 4.4) * 0.68;
      walkPhase += cdt * rate;
      const p = walkPhase;
      const s = Math.sin(p);
      const b = Math.abs(s);

      targetLegA = s * prof.legAmp;
      targetLegB = -s * prof.legAmp;
      targetBodyY = base.bodyY + b * prof.bounce;
      targetBodyRoll = s * (prof.biped ? 0.12 : 0.035);
      targetBodyPitch = Math.cos(p * 2) * 0.025;

      if (prof.biped) {
        // Classic chicken/duck waddle head-thrust & tail fan waggle
        targetHeadZ = base.headZ + Math.sin(p * 2) * 0.022;
        targetHeadPitch = base.headX + Math.max(0, Math.cos(p * 2)) * 0.13;
        targetTailYaw = Math.sin(p * 2) * prof.wag;
      } else {
        targetHeadPitch = base.headX + 0.05 + Math.sin(p * 2) * 0.065;
        targetTailYaw = Math.sin(p * 1.7) * prof.wag;
        targetTailPitch = base.tailX + Math.cos(p * 2) * 0.07;
      }
    } else {
      // Natural idle life: deterministic graze / peck / drink / look-around cycles
      const u = t + seedPhase;
      const cyc = ((u % prof.grazePeriod) + prof.grazePeriod) % prof.grazePeriod;
      let grazeW = 0;
      if (cyc < prof.grazeDur) {
        const gt = cyc / prof.grazeDur;
        // Smooth bell envelope: dip down, graze/peck, lift smoothly back up
        grazeW = smooth01(gt / 0.22) * (1 - smooth01((gt - 0.76) / 0.24));
      }

      if (kind === 'mb_chicken') {
        const peckPulse = 0.55 + 0.45 * Math.pow(Math.max(0, Math.sin(u * 10.5)), 2);
        targetHeadPitch = base.headX + grazeW * prof.grazeDip * peckPulse;
        targetHeadRoll = (1 - grazeW) * Math.sin(u * 1.8) * 0.13;
        targetHeadYaw = (1 - grazeW) * Math.sin(u * 1.15) * 0.28;
      } else if (kind === 'mb_duck') {
        const dabble = 0.72 + 0.28 * Math.sin(u * 8.4);
        targetHeadPitch = base.headX + grazeW * prof.grazeDip * dabble;
        targetHeadYaw = (1 - grazeW) * Math.sin(u * 0.95) * 0.26;
        const shimmyWin = Math.max(0, Math.sin(u * 0.85) - 0.82) / 0.18;
        targetTailRoll = Math.sin(u * 18) * 0.22 * shimmyWin;
      } else if (kind === 'mb_dog') {
        targetHeadPitch = base.headX + grazeW * prof.grazeDip;
        targetHeadRoll = (1 - grazeW) * Math.sin(u * 1.25) * 0.12;
        targetHeadYaw = (1 - grazeW) * Math.sin(u * 0.82) * 0.26;
        targetTailYaw = Math.sin(u * 5.0) * 0.26;
      } else if (kind === 'mb_cat') {
        targetHeadPitch = base.headX + grazeW * prof.grazeDip;
        targetHeadYaw = (1 - grazeW) * Math.sin(u * 0.68) * 0.28;
        targetTailRoll = Math.sin(u * 1.85) * 0.18;
        targetTailPitch = base.tailX + Math.cos(u * 1.3) * 0.08;
      } else if (kind === 'mb_heron') {
        // Curious Starlight Owl-Griffin head-tilt & wide-eyed swivel!
        targetHeadPitch = base.headX + grazeW * 0.18;
        targetHeadYaw = (1 - grazeW * 0.5) * Math.sin(u * 0.95) * 0.52;
        targetHeadRoll = Math.sin(u * 1.45) * 0.22;
        const rustle = Math.max(0, Math.sin(u * 1.05) - 0.78) / 0.22;
        targetWingLZ -= rustle * 0.18;
        targetWingRZ += rustle * 0.18;
        targetTailYaw = Math.sin(u * 2.1) * 0.08;
      } else if (kind === 'mb_stork' || kind === 'mb_roc') {
        const trill = kind === 'mb_stork' ? Math.sin(u * 6.5) * 0.028 : Math.sin(u * 3.8) * 0.022;
        targetHeadPitch = base.headX + grazeW * (prof.grazeDip * 0.42 + trill);
        targetHeadYaw = (1 - grazeW) * Math.sin(u * (kind === 'mb_roc' ? 0.58 : 0.82)) * 0.34;
        targetHeadRoll = (1 - grazeW) * Math.sin(u * 1.15) * 0.08;
        const rustle = Math.max(0, Math.sin(u * 0.84) - 0.76) / 0.24;
        targetWingLZ -= rustle * 0.22;
        targetWingRZ += rustle * 0.22;
        targetTailYaw = Math.sin(u * 1.65) * 0.10;
        targetTailRoll = kind === 'mb_stork' ? Math.cos(u * 1.4) * 0.06 : 0;
      } else {
        // Cow, Sheep, Pig: calm meadow grazing + nibble + ear/tail flick
        const nibble = kind === 'mb_pig' ? Math.sin(u * 11.0) * 0.055 : Math.sin(u * 6.4) * 0.045;
        targetHeadPitch = base.headX + grazeW * (prof.grazeDip + nibble);
        targetHeadYaw = (1 - grazeW * 0.65) * Math.sin(u * 0.76) * 0.20 + grazeW * Math.sin(u * 2.4) * 0.06;
        const flick = Math.max(0, Math.sin(u * 1.15) - 0.55) / 0.45;
        targetTailYaw = Math.sin(u * 4.2) * prof.wag * (0.25 + 0.75 * flick);
      }
      targetBodyY = base.bodyY + Math.sin(u * 1.9) * 0.006;
    }

    if (bodyGrp) {
      bodyGrp.position.y = lerp(bodyGrp.position.y, targetBodyY, blend);
      bodyGrp.rotation.x = lerp(bodyGrp.rotation.x, targetBodyPitch, blend);
      bodyGrp.rotation.z = lerp(bodyGrp.rotation.z, targetBodyRoll, blend);
      bodyGrp.scale.x = lerp(bodyGrp.scale.x, targetBodyScaleX, blend);
      bodyGrp.scale.y = lerp(bodyGrp.scale.y, targetBodyScaleY, blend);
    }
    if (headGrp) {
      headGrp.position.z = lerp(headGrp.position.z, targetHeadZ, blend);
      headGrp.rotation.x = lerp(headGrp.rotation.x, targetHeadPitch, blend);
      headGrp.rotation.y = lerp(headGrp.rotation.y, targetHeadYaw, blend);
      headGrp.rotation.z = lerp(headGrp.rotation.z, targetHeadRoll, blend);
    }
    if (legsA) legsA.rotation.x = lerp(legsA.rotation.x, targetLegA, blend);
    if (legsB) legsB.rotation.x = lerp(legsB.rotation.x, targetLegB, blend);
    if (tailGrp) {
      tailGrp.rotation.x = lerp(tailGrp.rotation.x, targetTailPitch, blend);
      tailGrp.rotation.y = lerp(tailGrp.rotation.y, targetTailYaw, blend);
      tailGrp.rotation.z = lerp(tailGrp.rotation.z, targetTailRoll, blend);
    }
    if (wingL) {
      wingL.rotation.x = lerp(wingL.rotation.x, targetWingLX, wingBlend);
      wingL.rotation.y = lerp(wingL.rotation.y, targetWingLY, wingBlend);
      wingL.rotation.z = lerp(wingL.rotation.z, targetWingLZ, wingBlend);
      const ws = lerp(wingL.scale.x, targetWingScale, wingBlend);
      wingL.scale.set(ws, lerp(wingL.scale.y, targetWingScale < 0.9 ? 0.86 : 1.0, wingBlend), lerp(wingL.scale.z, targetWingScale < 0.9 ? 0.72 : 1.0, wingBlend));
    }
    if (wingR) {
      wingR.rotation.x = lerp(wingR.rotation.x, targetWingRX, wingBlend);
      wingR.rotation.y = lerp(wingR.rotation.y, targetWingRY, wingBlend);
      wingR.rotation.z = lerp(wingR.rotation.z, targetWingRZ, wingBlend);
      const ws = lerp(wingR.scale.x, targetWingScale, wingBlend);
      wingR.scale.set(ws, lerp(wingR.scale.y, targetWingScale < 0.9 ? 0.86 : 1.0, wingBlend), lerp(wingR.scale.z, targetWingScale < 0.9 ? 0.72 : 1.0, wingBlend));
    }
  };

  // Preserve working animator & unique idle phase even if buildProp() calls template.clone()
  root.clone = function cloneAnimalGroup(recursive = true) {
    const copy = Object.getPrototypeOf(root).clone.call(root, recursive);
    attachAnimalAnimator(copy, kind, nextSeedPhase());
    return copy;
  };

  return root;
}

// ============================================================================
// Low-Poly Hand-Sculpted Storybook Animal Builders (<= 5 meshes, <= 260 tris, +Z forward)
// ============================================================================
export function buildAnimalPropBuilders(THREE) {
  const mat = getAnimalMaterial(THREE);

  const part = (parent, geo, swatch, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    paintGeoSwatch(geo, swatch);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz); // Always positive scale so mergeStatic determinant > 0
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const rbox = (w, h, d, r) =>
    new RoundedBoxGeometry(w, h, d, 1, Math.max(0.004, Math.min(r, w * 0.46, h * 0.46, d * 0.46)));
  const sph = (r, ws = 6, hs = 4) => new THREE.SphereGeometry(r, ws, hs);
  const cyl = (rt, rb, h, seg = 5, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const cone = (r, h, seg = 5, open = false) => new THREE.ConeGeometry(r, h, seg, 1, open);
  const lathe = (pts, seg = 7) =>
    new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

  // Expressive dark Storybook bead eyes + crisp tiny snow-white highlight on +Z head front
  const addBeadEyes = (headGrp, ex, ey, ez, rEye = 0.030, rHi = 0.013, sideCant = 0.18) => {
    for (const s of [-1, 1]) {
      part(headGrp, sph(rEye, 4, 2), 'eyeDark', s * ex, ey, ez, 0, s * sideCant, 0, 1, 1.08, 0.72);
      part(
        headGrp,
        cone(rHi * 1.15, rHi * 0.9, 3, true),
        'eyeWhite',
        s * ex + s * rEye * 0.22,
        ey + rEye * 0.34,
        ez + rEye * 0.62,
        Math.PI * 0.5,
        0,
        0
      );
    }
  };

  // Assemble the articulated child groups (+ optional wingL/wingR), merge each to 1 mesh, and lock keep=true
  const makeRig = (kind, bodyPivot, headPivot, hipPivot, tailPivot, buildFn, wingPivot = null) => {
    const root = new THREE.Group();
    root.name = kind;

    const bodyGrp = new THREE.Group();
    bodyGrp.name = 'bodyGrp';
    bodyGrp.position.set(bodyPivot[0], bodyPivot[1], bodyPivot[2]);

    const headGrp = new THREE.Group();
    headGrp.name = 'headGrp';
    headGrp.position.set(headPivot[0], headPivot[1], headPivot[2]);

    const legsA = new THREE.Group();
    legsA.name = 'legsA';
    legsA.position.set(hipPivot[0], hipPivot[1], hipPivot[2]);

    const legsB = new THREE.Group();
    legsB.name = 'legsB';
    legsB.position.set(hipPivot[0], hipPivot[1], hipPivot[2]);

    const tailGrp = new THREE.Group();
    tailGrp.name = 'tailGrp';
    tailGrp.position.set(tailPivot[0], tailPivot[1], tailPivot[2]);

    const parts = [bodyGrp, headGrp, legsA, legsB, tailGrp];
    let wingL = null;
    let wingR = null;
    if (wingPivot) {
      wingL = new THREE.Group();
      wingL.name = 'wingL';
      wingL.position.set(Math.abs(wingPivot[0]), wingPivot[1], wingPivot[2]);
      wingL.rotation.set(-0.22, 1.25, -0.52);

      wingR = new THREE.Group();
      wingR.name = 'wingR';
      wingR.position.set(-Math.abs(wingPivot[0]), wingPivot[1], wingPivot[2]);
      wingR.rotation.set(-0.22, -1.25, 0.52);

      parts.push(wingL, wingR);
    }

    root.add(...parts);
    buildFn({ bodyGrp, headGrp, legsA, legsB, tailGrp, wingL, wingR });

    for (const sub of parts) {
      mergeStatic(THREE, sub);
      sub.userData.keep = true;
    }
    if (wingL) wingL.scale.set(0.50, 0.86, 0.72);
    if (wingR) wingR.scale.set(0.50, 0.86, 0.72);

    return attachAnimalAnimator(root, kind, nextSeedPhase());
  };

  // Add a diagonal quadruped leg pair: legsA = (FL + BR), legsB = (FR + BL), feet at y = 0
  const addQuadLegs = (legsA, legsB, hipY, spanX, spanZ, rTop, rBot, footH, legSw, footSw, seg = 4) => {
    const shaftH = hipY - footH + 0.03;
    const pairs = [
      [legsA,  spanX,  spanZ],
      [legsA, -spanX, -spanZ],
      [legsB, -spanX,  spanZ],
      [legsB,  spanX, -spanZ],
    ];
    for (const [grp, lx, lz] of pairs) {
      part(grp, cyl(rTop, rBot, shaftH, seg, true), legSw, lx, -shaftH * 0.5 + 0.03, lz, 0, Math.PI * 0.25, 0);
      part(grp, cyl(rBot * 1.06, rBot * 1.14, footH, seg, true), footSw, lx, -hipY + footH * 0.5, lz, 0, Math.PI * 0.25, 0);
    }
  };

  // 1. Spotted Cow (radius 0.66, height 1.22)
  function buildCow() {
    return makeRig('mb_cow', [0, 0.68, -0.02], [0, 0.88, 0.44], [0, 0.45, -0.02], [0, 0.84, -0.52], ({ bodyGrp, headGrp, legsA, legsB, tailGrp }) => {
      // Plump rounded dairy barrel + asymmetrical cocoa spots + pink udder + red collar & golden bell
      part(bodyGrp, sph(0.50, 7, 4), 'creamCoat', 0, 0, 0, 0, 0, 0, 0.72, 0.60, 1.06);
      part(bodyGrp, sph(0.24, 4, 2), 'cocoaSpot', 0.14, 0.12, 0.08, 0.15, 0.2, -0.35, 1.05, 0.78, 1.25);
      part(bodyGrp, sph(0.21, 4, 2), 'cocoaSpot', -0.16, 0.05, -0.22, -0.2, -0.25, 0.4, 0.98, 0.82, 1.15);
      part(bodyGrp, sph(0.14, 4, 2), 'rosyPink', 0, -0.25, -0.14, 0, 0, 0, 1.05, 0.75, 1.10);
      part(bodyGrp, cyl(0.21, 0.24, 0.09, 5, true), 'collarRed', 0, 0.06, 0.43, 0.95, 0, 0);
      part(bodyGrp, cone(0.058, 0.085, 4, true), 'bellGold', 0, -0.12, 0.48, 0.15, 0, 0);

      // Soft cow head + wide rosy muzzle + drooping ears + curved ivory horns + bead eyes
      part(headGrp, sph(0.22, 5, 3), 'creamCoat', 0, 0.03, 0.12, 0, 0, 0, 0.96, 0.95, 1.08);
      part(headGrp, sph(0.15, 5, 2), 'rosyPink', 0, -0.06, 0.27, 0.12, 0, 0, 1.18, 0.78, 0.84);
      for (const s of [-1, 1]) {
        part(headGrp, cone(0.065, 0.18, 3, true), 'cocoaSpot', s * 0.23, 0.08, 0.07, 0.15, 0, s * 1.28, 0.75, 1, 1.1);
        part(headGrp, cone(0.038, 0.14, 3, true), 'hornIvory', s * 0.13, 0.24, 0.07, 0.22, 0, -s * 0.36);
      }
      addBeadEyes(headGrp, 0.145, 0.07, 0.245, 0.032, 0.014, 0.28);

      addQuadLegs(legsA, legsB, 0.45, 0.20, 0.30, 0.068, 0.054, 0.09, 'creamCoat', 'hoofDark', 4);

      part(tailGrp, cyl(0.026, 0.018, 0.36, 3, true), 'creamCoat', 0, -0.16, -0.06, -0.34, 0, 0);
      part(tailGrp, sph(0.055, 4, 2), 'cocoaSpot', 0, -0.33, -0.12, 0, 0, 0, 0.85, 1.25, 0.85);
    });
  }

  // 2. Speckled Hen (radius 0.28, height 0.50)
  function buildChicken() {
    return makeRig('mb_chicken', [0, 0.24, -0.01], [0, 0.35, 0.11], [0, 0.14, 0.01], [0, 0.29, -0.16], ({ bodyGrp, headGrp, legsA, legsB, tailGrp }) => {
      // Plump Lathe hen body + cream speckled folded wings
      const bodyGeo = lathe([[0, -0.15], [0.13, -0.11], [0.175, -0.01], [0.16, 0.10], [0.09, 0.16], [0, 0.18]], 7);
      part(bodyGrp, bodyGeo, 'henRusset', 0, 0, 0, 1.22, 0, 0, 0.96, 1.0, 0.94);
      for (const s of [-1, 1]) {
        part(bodyGrp, sph(0.11, 5, 2), 'henSpeckle', s * 0.135, 0.01, -0.01, 0.12, s * 0.12, 0, 0.42, 0.78, 1.18);
      }

      // Round head + scalloped red comb + red wattle + golden corn beak + bead eyes
      part(headGrp, sph(0.095, 6, 4), 'henRusset', 0, 0.03, 0.03, 0, 0, 0, 0.94, 1.04, 0.98);
      part(headGrp, sph(0.038, 4, 3), 'combRed', 0, 0.125, 0.04, -0.2, 0, 0, 0.42, 1.05, 1.45);
      part(headGrp, sph(0.026, 4, 2), 'combRed', 0, -0.035, 0.095, 0, 0, 0, 0.55, 1.1, 0.7);
      part(headGrp, cone(0.032, 0.075, 4, true), 'beakGold', 0, 0.02, 0.135, Math.PI * 0.52, 0, 0);
      addBeadEyes(headGrp, 0.068, 0.045, 0.088, 0.020, 0.009, 0.35);

      // Left & right yellow-orange legs + flat clawed foot pads at y = 0
      for (const [grp, sx] of [[legsA, 0.065], [legsB, -0.065]]) {
        part(grp, cyl(0.016, 0.014, 0.13, 4, true), 'beakGold', sx, -0.07, 0);
        part(grp, cone(0.048, 0.026, 4, false), 'beakGold', sx, -0.127, 0.022, 0, Math.PI * 0.25, 0, 0.85, 1, 1.35);
      }

      // Proud upturned chestnut tail fan at -Z
      part(tailGrp, cone(0.085, 0.17, 5, true), 'henTail', 0, 0.05, -0.05, -0.78, 0, 0, 0.62, 1.0, 1.15);
    });
  }

  // 3. Muddy Pig (radius 0.46, height 0.74)
  function buildPig() {
    return makeRig('mb_pig', [0, 0.41, -0.02], [0, 0.48, 0.28], [0, 0.22, -0.01], [0, 0.48, -0.37], ({ bodyGrp, headGrp, legsA, legsB, tailGrp }) => {
      // Chonky RoundedBox pink pig body + warm cocoa mud belly/rump splash
      part(bodyGrp, rbox(0.46, 0.40, 0.68, 0.17), 'pigPink', 0, 0, 0);
      part(bodyGrp, sph(0.22, 4, 2), 'mudCoat', 0.03, -0.11, -0.06, 0, 0, 0, 1.06, 0.56, 1.32);

      // Round chubby head + flat upturned disk snout + floppy ears + bead eyes
      part(headGrp, sph(0.185, 5, 3), 'pigPink', 0, 0.02, 0.08, 0, 0, 0, 1.02, 0.98, 0.98);
      part(headGrp, sph(0.088, 5, 2), 'pigSnout', 0, -0.02, 0.245, 0.12, 0, 0, 1.08, 0.86, 0.52);
      for (const s of [-1, 1]) {
        part(headGrp, cone(0.062, 0.14, 3, true), 'pigPink', s * 0.13, 0.16, 0.10, 0.58, s * 0.22, -s * 0.44, 0.85, 1, 0.55);
      }
      addBeadEyes(headGrp, 0.105, 0.065, 0.21, 0.025, 0.011, 0.24);

      addQuadLegs(legsA, legsB, 0.22, 0.135, 0.21, 0.052, 0.042, 0.075, 'pigPink', 'mudCoat', 3);

      // Curly pink corkscrew tail
      part(tailGrp, cyl(0.022, 0.016, 0.12, 3, true), 'pigPink', 0, 0.04, -0.04, -0.65, 0, 0.25);
      part(tailGrp, sph(0.034, 4, 2), 'pigSnout', 0.02, 0.08, -0.07, 0, 0, 0, 1.1, 1.1, 0.7);
    });
  }

  // 4. Woolly Sheep (radius 0.52, height 0.92)
  function buildSheep() {
    return makeRig('mb_sheep', [0, 0.54, -0.02], [0, 0.67, 0.33], [0, 0.34, -0.02], [0, 0.60, -0.40], ({ bodyGrp, headGrp, legsA, legsB, tailGrp }) => {
      // Fluffy RoundedBox fleece core + overlapping oatmeal cloud puffs
      part(bodyGrp, rbox(0.54, 0.46, 0.74, 0.20), 'woolCream', 0, 0, 0);
      part(bodyGrp, sph(0.24, 4, 2), 'woolPuff', 0, 0.14, 0.12, 0, 0, 0, 1.16, 0.78, 1.05);
      part(bodyGrp, sph(0.23, 4, 2), 'woolPuff', 0, 0.13, -0.16, 0, 0, 0, 1.14, 0.76, 1.02);

      // Sweet charcoal face + fluffy cream wool crown + drooping ears + rosy nose + bright eyes
      part(headGrp, sph(0.155, 5, 3), 'sheepFace', 0, 0.0, 0.11, 0.18, 0, 0, 0.88, 0.92, 1.16);
      part(headGrp, sph(0.135, 4, 2), 'woolCream', 0, 0.12, 0.06, 0, 0, 0, 1.08, 0.82, 1.02);
      part(headGrp, cone(0.036, 0.04, 3, true), 'rosyPink', 0, -0.045, 0.27, Math.PI * 0.5, 0, 0);
      for (const s of [-1, 1]) {
        part(headGrp, cone(0.048, 0.14, 3, true), 'sheepFace', s * 0.165, 0.03, 0.06, 0.12, 0, s * 1.32, 0.7, 1, 1);
      }
      addBeadEyes(headGrp, 0.098, 0.03, 0.215, 0.027, 0.013, 0.26);

      addQuadLegs(legsA, legsB, 0.34, 0.15, 0.23, 0.044, 0.036, 0.075, 'sheepFace', 'hoofDark', 3);

      part(tailGrp, sph(0.095, 4, 2), 'woolCream', 0, -0.02, -0.05, 0, 0, 0, 0.95, 1.05, 1.1);
    });
  }

  // 5. Stream Duck (radius 0.30, height 0.48)
  function buildDuck() {
    return makeRig('mb_duck', [0, 0.20, -0.02], [0, 0.31, 0.12], [0, 0.12, 0.0], [0, 0.24, -0.21], ({ bodyGrp, headGrp, legsA, legsB, tailGrp }) => {
      // Boat-like plump ivory body + slate-fawn folded wings + snowy neck ring
      const hullGeo = lathe([[0, -0.20], [0.13, -0.14], [0.165, 0.0], [0.145, 0.13], [0.075, 0.20], [0, 0.21]], 7);
      part(bodyGrp, hullGeo, 'duckWhite', 0, 0, 0, 1.44, 0, 0, 0.98, 1.0, 0.84);
      for (const s of [-1, 1]) {
        part(bodyGrp, sph(0.115, 5, 2), 'duckWing', s * 0.13, 0.02, -0.02, 0.08, s * 0.1, 0, 0.38, 0.68, 1.28);
      }

      // Mallard emerald head + snowy collar ring + broad flat tangerine bill + bead eyes
      part(headGrp, cyl(0.052, 0.062, 0.055, 6, true), 'eyeWhite', 0, -0.01, 0.01, 0.22, 0, 0);
      part(headGrp, sph(0.095, 6, 4), 'mallardGreen', 0, 0.065, 0.03, 0, 0, 0, 0.95, 1.02, 1.06);
      part(headGrp, cone(0.055, 0.11, 5, false), 'duckBill', 0, 0.042, 0.145, Math.PI * 0.53, 0, 0, 1.15, 1.0, 0.46);
      addBeadEyes(headGrp, 0.066, 0.078, 0.09, 0.021, 0.010, 0.32);

      // Orange webbed paddles at y = 0
      for (const [grp, sx] of [[legsA, 0.068], [legsB, -0.068]]) {
        part(grp, cyl(0.016, 0.015, 0.11, 4, true), 'duckBill', sx, -0.06, 0);
        part(grp, cone(0.056, 0.024, 4, false), 'duckBill', sx, -0.108, 0.028, 0, Math.PI * 0.25, 0, 0.95, 1, 1.38);
      }

      part(tailGrp, cone(0.072, 0.13, 5, true), 'duckWhite', 0, 0.03, -0.05, -1.05, 0, 0, 0.85, 1.0, 0.65);
    });
  }

  // 6. Shepherd Dog (radius 0.40, height 0.76)
  function buildDog() {
    return makeRig('mb_dog', [0, 0.43, -0.02], [0, 0.55, 0.26], [0, 0.28, -0.01], [0, 0.50, -0.32], ({ bodyGrp, headGrp, legsA, legsB, tailGrp }) => {
      // Agile honey-tan body + dark saddle + fluffy cream chest ruff + sky-blue collar
      part(bodyGrp, sph(0.32, 7, 4), 'dogTan', 0, 0, 0, 0, 0, 0, 0.62, 0.58, 1.08);
      part(bodyGrp, sph(0.20, 5, 2), 'dogSaddle', 0, 0.08, -0.04, 0, 0, 0, 0.92, 0.62, 1.12);
      part(bodyGrp, sph(0.16, 5, 2), 'creamCoat', 0, -0.03, 0.24, 0.25, 0, 0, 0.98, 0.95, 0.82);
      part(bodyGrp, cyl(0.125, 0.14, 0.06, 5, true), 'collarBlue', 0, 0.07, 0.27, 0.82, 0, 0);

      // Expressive dog head + cream muzzle + dark nose + happy pink tongue + semi-perky ears
      part(headGrp, sph(0.145, 6, 3), 'dogTan', 0, 0.04, 0.06, 0, 0, 0, 0.96, 0.96, 1.04);
      part(headGrp, cone(0.085, 0.16, 5, true), 'creamCoat', 0, 0.0, 0.19, Math.PI * 0.52, 0, 0, 0.95, 1.0, 0.82);
      part(headGrp, sph(0.030, 4, 2), 'eyeDark', 0, 0.02, 0.265);
      part(headGrp, sph(0.026, 4, 2), 'tonguePink', 0.015, -0.042, 0.22, 0.35, 0, 0, 0.85, 0.45, 1.25);
      for (const s of [-1, 1]) {
        part(headGrp, cone(0.055, 0.14, 4, true), 'dogSaddle', s * 0.11, 0.165, 0.04, 0.38, 0, -s * 0.32, 0.85, 1, 0.65);
      }
      addBeadEyes(headGrp, 0.082, 0.065, 0.168, 0.024, 0.011, 0.22);

      addQuadLegs(legsA, legsB, 0.28, 0.115, 0.20, 0.042, 0.034, 0.07, 'dogTan', 'creamCoat');

      // Fluffy plumed honey-and-cream tail held happily aloft
      part(tailGrp, cone(0.058, 0.28, 5, true), 'dogTan', 0, 0.10, -0.09, -0.78, 0, 0);
      part(tailGrp, sph(0.048, 4, 2), 'creamCoat', 0, 0.20, -0.18, 0, 0, 0, 0.85, 1.15, 0.95);
    });
  }

  // 7. Ginger Cat (radius 0.28, height 0.46)
  function buildCat() {
    return makeRig('mb_cat', [0, 0.23, -0.01], [0, 0.29, 0.16], [0, 0.16, 0.0], [0, 0.26, -0.20], ({ bodyGrp, headGrp, legsA, legsB, tailGrp }) => {
      // Sleek cozy marmalade torso + tabby saddle stripe + cream bib + berry ribbon & tiny bell
      part(bodyGrp, sph(0.21, 7, 4), 'catGinger', 0, 0, 0, 0, 0, 0, 0.62, 0.58, 1.08);
      part(bodyGrp, sph(0.13, 5, 2), 'catStripe', 0, 0.06, -0.02, 0, 0, 0, 0.88, 0.52, 1.15);
      part(bodyGrp, sph(0.10, 4, 2), 'creamCoat', 0, -0.02, 0.16, 0.2, 0, 0, 0.92, 0.92, 0.78);
      part(bodyGrp, cyl(0.085, 0.095, 0.042, 5, true), 'collarBerry', 0, 0.04, 0.175, 0.85, 0, 0);
      part(bodyGrp, sph(0.024, 4, 2), 'bellGold', 0, -0.015, 0.205);

      // Round Storybook feline head + pointed ears with rosy inner + cream whisker puffs + big bead eyes
      part(headGrp, sph(0.112, 6, 3), 'catGinger', 0, 0.032, 0.05, 0, 0, 0, 1.05, 0.96, 0.96);
      part(headGrp, sph(0.058, 5, 2), 'creamCoat', 0, -0.01, 0.145, 0, 0, 0, 1.28, 0.72, 0.68);
      part(headGrp, sph(0.018, 4, 2), 'rosyPink', 0, 0.008, 0.178);
      for (const s of [-1, 1]) {
        part(headGrp, cone(0.044, 0.095, 4, true), 'catGinger', s * 0.076, 0.13, 0.045, 0.12, 0, -s * 0.26, 0.85, 1, 0.62);
        part(headGrp, cone(0.025, 0.062, 3, true), 'rosyPink', s * 0.075, 0.124, 0.060, 0.14, 0, -s * 0.26, 0.8, 1, 0.5);
      }
      addBeadEyes(headGrp, 0.058, 0.042, 0.142, 0.025, 0.012, 0.18);

      addQuadLegs(legsA, legsB, 0.16, 0.075, 0.13, 0.028, 0.023, 0.048, 'catGinger', 'creamCoat');

      // Graceful upright S-curved ginger tail with snowy tip
      part(tailGrp, cyl(0.022, 0.018, 0.17, 4, true), 'catGinger', 0, 0.075, -0.04, -0.42, 0, 0);
      part(tailGrp, sph(0.025, 4, 2), 'creamCoat', 0, 0.16, -0.072, 0, 0, 0, 0.95, 1.25, 0.95);
    });
  }

  const glowMats = getCelestialGlowMaterials(THREE);
  const glowPart = (parent, geo, gMat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, gMat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = false;
    m.receiveShadow = false;
    parent.add(m);
    return m;
  };

  const _fUp = new THREE.Vector3(0, 1, 0);
  const _fX = new THREE.Vector3();
  const _fY = new THREE.Vector3();
  const _fZ = new THREE.Vector3();
  const _fM4 = new THREE.Matrix4();

  // Quaternion-aligned flat Storybook feather blade:
  //   - base at (bx, by, bz), feather shaft (+Y of geometry) points 100% along (dx, dy, dz)
  //   - thin axis (+Z of geometry) aligns with upVec (default +Y dorsal wing normal -> ZERO vertical spikes!)
  //   - broad vane width (+X of geometry) lies flat across the wing/tail plane!
  const featherBlade = (
    parent,
    swatch,
    bx,
    by,
    bz,
    dx,
    dy,
    dz,
    width,
    len,
    thick = 0.028,
    rounded = false,
    upX = 0,
    upY = 1,
    upZ = 0
  ) => {
    _fY.set(dx, dy, dz);
    if (_fY.lengthSq() < 1e-8) _fY.set(0, 0, -1);
    else _fY.normalize();

    _fZ.set(upX, upY, upZ);
    const d = _fZ.dot(_fY);
    _fZ.addScaledVector(_fY, -d);
    if (_fZ.lengthSq() < 1e-6) {
      _fZ.set(0, 0, 1).addScaledVector(_fY, -_fY.z);
      if (_fZ.lengthSq() < 1e-6) _fZ.set(1, 0, 0);
    }
    _fZ.normalize();
    _fX.crossVectors(_fY, _fZ).normalize();
    _fM4.makeBasis(_fX, _fY, _fZ);

    const geo = rounded ? sph(0.5, 6, 5) : cone(0.5, 1.0, 5, false);
    paintGeoSwatch(geo, swatch);
    const m = new THREE.Mesh(geo, mat);
    const centerFrac = rounded ? 0.48 : 0.46;
    m.position.set(bx + _fY.x * len * centerFrac, by + _fY.y * len * centerFrac, bz + _fY.z * len * centerFrac);
    m.quaternion.setFromRotationMatrix(_fM4);
    m.scale.set(width, len, thick);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Seamless end-to-end curved ribbon/plume cylinder from p0 -> p1 with exact quaternion alignment
  const tubeBetween = (parent, swatch, p0, p1, r0, r1, flatX = 1.0, flatZ = 1.0) => {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2];
    const segLen = Math.hypot(dx, dy, dz) || 0.01;
    _fY.set(dx / segLen, dy / segLen, dz / segLen);
    const geo = cyl(r1, r0, segLen * 1.08, 6, false);
    paintGeoSwatch(geo, swatch);
    const m = new THREE.Mesh(geo, mat);
    m.position.set((p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5, (p0[2] + p1[2]) * 0.5);
    m.quaternion.setFromUnitVectors(_fUp, _fY);
    m.scale.set(flatX, 1.0, flatZ);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Helper: Add a glowing 4-point Storybook starlight crystal at (x, y, z)
  const addStarlightTip = (parent, gMat, x, y, z, size = 0.075, tiltX = 0.25, tiltY = 0) => {
    glowPart(parent, new THREE.OctahedronGeometry(size, 0), gMat, x, y, z, tiltX, tiltY, 0, 0.42, 1.55, 0.36);
    glowPart(parent, new THREE.OctahedronGeometry(size, 0), gMat, x, y, z, tiltX, tiltY, Math.PI * 0.5, 0.40, 1.48, 0.36);
    glowPart(parent, new THREE.OctahedronGeometry(size * 0.58, 0), gMat, x, y, z, tiltX, tiltY, 0, 0.65, 0.65, 1.15);
  };

  // ==========================================================================
  // TIER 1 — LARGE MAGICAL BIRD (height 1.42m, wingspan ~2.90m):
  //   mb_heron -> "Starlight Owl-Griffin" (🦉)
  //   Plump round nocturnal spirit-owl with heart-shaped facial disc, giant emerald eyes,
  //   long star-tufted ear horns, glowing lantern charm, rounded silent-flight wings & snow-boots!
  // ==========================================================================
  function buildHeron() {
    return makeRig(
      'mb_heron',
      [0, 0.64, 0.0],
      [0, 0.96, 0.12],
      [0, 0.42, 0.0],
      [0, 0.50, -0.28],
      ({ bodyGrp, headGrp, legsA, legsB, tailGrp, wingL, wingR }) => {
        // Plump, chubby pear-shaped downy owl body (russet-plum mantle + big speckled cream belly!)
        const owlTorso = lathe(
          [[0, -0.34], [0.22, -0.26], [0.31, -0.06], [0.30, 0.14], [0.23, 0.28], [0, 0.33]],
          9
        );
        part(bodyGrp, owlTorso, 'owlRusset', 0, 0, 0, 0.28, 0, 0, 1.04, 1.0, 0.96);
        part(bodyGrp, sph(0.26, 8, 6), 'owlBuff', 0, -0.02, 0.11, 0.12, 0, 0, 0.94, 1.06, 0.86);
        part(bodyGrp, sph(0.23, 7, 5), 'owlPlum', 0, 0.06, -0.09, -0.22, 0, 0, 0.98, 1.02, 0.92);

        // Crescent russet-plum feather scallops across the plump cream owl belly
        for (const [bx, by, bz] of [[0, -0.02, 0.33], [-0.11, -0.06, 0.30], [0.11, -0.06, 0.30], [-0.07, -0.15, 0.28], [0.07, -0.15, 0.28]]) {
          part(bodyGrp, cone(0.042, 0.09, 4, false), 'owlPlum', bx, by, bz, 2.75, bx * 1.4, 0, 1.25, 1.0, 0.32);
        }

        // Cozy Fluffy Neck Ruff + Woven Gold Collar & Glowing Emerald Lantern-Charm Amulet!
        for (let i = -4; i <= 4; i++) {
          const ang = i * 0.34;
          featherBlade(
            bodyGrp,
            Math.abs(i) % 2 === 0 ? 'owlBuff' : 'owlRusset',
            Math.sin(ang) * 0.18,
            0.20,
            Math.cos(ang) * 0.18 + 0.04,
            Math.sin(ang) * 0.65,
            -0.55,
            Math.cos(ang) * 0.65,
            0.11,
            0.16,
            0.032,
            true
          );
        }
        part(bodyGrp, cyl(0.052, 0.052, 0.026, 7, false), 'phoenixGold', 0, 0.13, 0.31, Math.PI * 0.46, 0, 0);
        glowPart(bodyGrp, new THREE.OctahedronGeometry(0.056, 0), glowMats.emeraldGlowMat, 0, 0.12, 0.335, 0.12, 0, 0, 0.88, 1.15, 0.62);

        // Huge Round Barn-Owl Head + Twin Heart-Shaped Cream Facial Discs + Giant Emerald-Gold Owl Eyes!
        part(headGrp, sph(0.245, 8, 6), 'owlPlum', 0, 0.06, -0.01, 0, 0, 0, 1.08, 0.98, 0.96);
        part(headGrp, sph(0.225, 8, 6), 'owlRusset', 0, 0.07, 0.02, 0, 0, 0, 1.04, 0.94, 0.90);
        for (const s of [-1, 1]) {
          // Heart-shaped cream facial disc halves + warm blush
          part(headGrp, sph(0.135, 7, 5), 'owlBuff', s * 0.088, 0.055, 0.145, 0, s * 0.16, -s * 0.12, 0.95, 1.05, 0.42);
          part(headGrp, sph(0.038, 5, 3), 'phoenixBlush', s * 0.135, -0.005, 0.178, 0, s * 0.25, 0, 0.9, 0.65, 0.55);
          // Giant Luminous Storybook Owl Eyes!
          part(headGrp, sph(0.064, 6, 5), 'eyeDark', s * 0.092, 0.068, 0.188, 0, s * 0.18, 0, 1.0, 1.04, 0.52);
          part(headGrp, sph(0.052, 6, 5), 'phoenixGold', s * 0.094, 0.068, 0.200, 0, s * 0.18, 0, 0.98, 1.02, 0.48);
          part(headGrp, sph(0.040, 6, 4), 'eyeEmerald', s * 0.096, 0.068, 0.208, 0, s * 0.18, 0, 0.96, 1.0, 0.45);
          part(headGrp, sph(0.024, 5, 4), 'eyeDark', s * 0.098, 0.068, 0.216, 0, s * 0.18, 0, 0.95, 0.98, 0.42);
          part(headGrp, sph(0.013, 4, 3), 'eyeWhite', s * 0.112, 0.086, 0.224);
        }
        // Cute curved golden owl beak tucked right between the facial discs
        part(headGrp, cone(0.044, 0.13, 5, false), 'phoenixGold', 0, 0.018, 0.245, Math.PI * 0.64, 0, 0, 0.86, 1.0, 0.82);

        // Two Dramatic Swept-Back Star-Tufted Owl Ear Horns (reaching y ≈ 1.42m!)
        for (const s of [-1, 1]) {
          tubeBetween(headGrp, 'owlPlum', [s * 0.11, 0.18, 0.06], [s * 0.22, 0.34, -0.04], 0.042, 0.026, 1.2, 0.65);
          tubeBetween(headGrp, 'phoenixGold', [s * 0.22, 0.34, -0.04], [s * 0.29, 0.44, -0.14], 0.026, 0.012, 1.15, 0.60);
          addStarlightTip(headGrp, glowMats.moonCrystalMat, s * 0.30, 0.45, -0.15, 0.048, 0.25, s * 0.4);
        }

        // Short Fluffy Snow-Booted Owl Talons resting cleanly at y = 0
        for (const [grp, sx] of [[legsA, 0.12], [legsB, -0.12]]) {
          part(grp, sph(0.095, 6, 5), 'owlBuff', sx, -0.12, 0.0, 0, 0, 0, 0.92, 1.35, 0.95);
          part(grp, cone(0.082, 0.22, 6, false), 'owlBuff', sx, -0.26, 0.0, Math.PI, 0, 0, 0.95, 1.0, 0.95);
          for (const [ang, len] of [[-0.52, 0.12], [0, 0.14], [0.52, 0.12]]) {
            part(grp, cone(0.018, len, 4, false), 'phoenixCoral', sx + Math.sin(ang) * len * 0.48, -0.402, 0.02 + Math.cos(ang) * len * 0.48, Math.PI * 0.51, ang, 0, 1.0, 1.0, 0.75);
          }
          part(grp, cone(0.016, 0.09, 4, false), 'phoenixCoral', sx, -0.402, -0.04, -Math.PI * 0.49, 0, 0);
        }

        // Broad 7-Feather Rounded Owl Fan-Tail (NO long ribbons — unmistakable compact owl silhouette!)
        for (let i = -3; i <= 3; i++) {
          const ang = i * 0.22;
          const sw = Math.abs(i) % 2 === 0 ? 'owlPlum' : 'owlRusset';
          featherBlade(tailGrp, sw, Math.sin(ang) * 0.06, 0.01, -0.02, Math.sin(ang) * 0.58, -0.20, -Math.cos(ang), 0.13, 0.44, 0.028, true);
          featherBlade(tailGrp, 'owlBuff', Math.sin(ang) * 0.22, -0.06, -0.32, Math.sin(ang) * 0.58, -0.20, -Math.cos(ang), 0.11, 0.15, 0.024, true);
        }

        // Broad Rounded Silent-Flight Owl Wings (~2.90m wingspan, soft rounded scalloped primaries!)
        const span = 1.24;
        for (const [grp, s] of [[wingL, 1], [wingR, -1]]) {
          if (!grp) continue;
          tubeBetween(grp, 'owlRusset', [0, 0.01, 0.08], [s * span * 0.55, 0.02, 0.11], 0.044, 0.032, 1.0, 0.85);
          tubeBetween(grp, 'owlBuff', [s * span * 0.55, 0.02, 0.11], [s * span * 0.94, 0.03, 0.05], 0.032, 0.018, 1.0, 0.85);
          part(grp, rbox(span * 0.72, 0.030, 0.34, 0.015), 'owlRusset', s * span * 0.38, 0.0, -0.04, 0, 0, 0);

          // Rounded Russet Coverts -> Cream Buff Band -> Twilight-Plum Mid Band -> Rounded Scalloped Primaries!
          for (let i = 0; i < 6; i++) {
            const u = i / 5;
            featherBlade(grp, 'owlRusset', s * (0.06 + u * span * 0.48), 0.018, 0.08 - u * 0.03, s * (0.12 + u * 0.25), 0, -1, 0.15, 0.28, 0.030, true);
          }
          for (let i = 0; i < 7; i++) {
            const u = i / 6;
            featherBlade(grp, 'owlBuff', s * (0.10 + u * span * 0.66), 0.010, -0.02 - u * 0.02, s * (0.15 + u * 0.38), 0, -1, 0.15, 0.34, 0.026, true);
          }
          for (let i = 0; i < 8; i++) {
            const u = i / 7;
            const fanAng = 0.14 + u * 1.08;
            const dx = s * Math.sin(fanAng), dz = -Math.cos(fanAng);
            const bx = s * (0.18 + u * span * 0.74);
            const bz = -0.12 + Math.pow(u, 1.3) * 0.16;
            const bLen = 0.38 + Math.sin(u * Math.PI) * 0.10;
            featherBlade(grp, i % 2 === 0 ? 'owlPlum' : 'phoenixIndigo', bx, 0.0, bz, dx, 0.02, dz, 0.145, bLen, 0.024, true);
            featherBlade(grp, 'owlBuff', bx + dx * bLen * 0.72, 0.004, bz + dz * bLen * 0.72, dx, 0.02, dz, 0.11, bLen * 0.30, 0.022, true);
          }
        }
      },
      [0.21, 0.72, 0.04]
    );
  }

  // ==========================================================================
  // TIER 2 — LARGER MAGICAL BIRD (height 1.96m, wingspan ~4.25m):
  //   mb_stork -> "Sun-Plume Sky-Phoenix" (🦚)
  //   Matches Codex's assets/concepts/magical_sky_bird.png: tall graceful S-necked ivory crane-phoenix,
  //   golden tiara + 3 curling plumes, turquoise breast ruff + glowing cyan Celestia gem,
  //   smooth 4-tier gold/ivory/teal/indigo wings & 3 starlight-tipped S-curved tail ribbons!
  // ==========================================================================
  function buildStork() {
    const S = 1.06;
    return makeRig(
      'mb_stork',
      [0, 0.96 * S, 0.0],
      [0, 1.48 * S, 0.26 * S],
      [0, 0.78 * S, -0.02 * S],
      [0, 0.88 * S, -0.34 * S],
      ({ bodyGrp, headGrp, legsA, legsB, tailGrp, wingL, wingR }) => {
        // 1. Pearlescent Ivory Body + Smooth Flank Plumage
        const torsoGeo = lathe(
          [
            [0, -0.44 * S],
            [0.16 * S, -0.32 * S],
            [0.24 * S, -0.08 * S],
            [0.25 * S, 0.14 * S],
            [0.19 * S, 0.32 * S],
            [0.09 * S, 0.42 * S],
            [0, 0.45 * S],
          ],
          9
        );
        part(bodyGrp, torsoGeo, 'phoenixIvory', 0, 0, 0, 1.32, 0, 0, 0.94, 1.0, 0.92);
        part(bodyGrp, sph(0.20 * S, 7, 5), 'phoenixIvory', 0, 0.02 * S, 0.22 * S, 0.18, 0, 0, 0.96, 1.06, 0.96);
        for (const sx of [-1, 1]) {
          featherBlade(bodyGrp, 'phoenixCream', sx * 0.14 * S, -0.08 * S, 0.02 * S, sx * 0.12, -0.42, -0.90, 0.15 * S, 0.34 * S, 0.04 * S, true, sx, 0.2, 0);
        }

        // 2. Layered Celestial Turquoise-Teal Breast Ruff Collar + Golden Diamond Bezel & Glowing Celestia Sky-Crystal!
        for (let i = -5; i <= 5; i++) {
          const ang = i * 0.25;
          const bx = Math.sin(ang) * 0.16 * S;
          const by = (0.07 - Math.cos(ang) * 0.08 + Math.abs(i) * 0.015) * S;
          const bz = (0.31 + Math.cos(ang) * 0.04) * S;
          featherBlade(
            bodyGrp,
            Math.abs(i) % 2 === 0 ? 'phoenixTeal' : 'phoenixAzure',
            bx,
            by,
            bz,
            Math.sin(ang) * 0.62,
            -0.74 + Math.abs(i) * 0.06,
            0.32,
            0.105 * S,
            0.22 * S,
            0.028 * S,
            false,
            0,
            0.25,
            1
          );
        }
        part(bodyGrp, new THREE.OctahedronGeometry(0.096 * S, 0), 'phoenixGold', 0, 0.055 * S, 0.365 * S, 0.14, 0, 0, 0.78, 1.34, 0.36);
        for (const [bx, by] of [[0, 0.125], [0, -0.125], [0.076, 0], [-0.076, 0]]) {
          part(bodyGrp, sph(0.018 * S, 4, 3), 'phoenixGold', bx * S, (0.055 + by) * S, 0.382 * S);
        }
        glowPart(bodyGrp, new THREE.OctahedronGeometry(0.074 * S, 0), glowMats.crystalMat, 0, 0.055 * S, 0.384 * S, 0.14, 0, 0, 0.72, 1.28, 0.52);

        // 3. Graceful S-Curved Swan/Phoenix Neck
        tubeBetween(bodyGrp, 'phoenixIvory', [0, 0.08 * S, 0.27 * S], [0, 0.28 * S, 0.205 * S], 0.108 * S, 0.076 * S);
        part(bodyGrp, sph(0.076 * S, 6, 4), 'phoenixIvory', 0, 0.28 * S, 0.205 * S);
        tubeBetween(bodyGrp, 'phoenixIvory', [0, 0.28 * S, 0.205 * S], [0, 0.54 * S, 0.26 * S], 0.076 * S, 0.058 * S);

        // 4. Sculpted Head, Amber Eyes, Rosy Blush, Open Curved Beak, Golden Tiara & 3 Curling Royal Plumes!
        part(headGrp, sph(0.122 * S, 7, 5), 'phoenixIvory', 0, 0.035 * S, 0.03 * S, 0, 0, 0, 0.90, 0.95, 1.15);
        part(headGrp, sph(0.088 * S, 6, 4), 'phoenixIvory', 0, 0.062 * S, 0.08 * S, -0.15, 0, 0, 0.94, 0.72, 1.05);
        for (const s of [-1, 1]) {
          part(headGrp, sph(0.034 * S, 5, 3), 'phoenixBlush', s * 0.092 * S, 0.006 * S, 0.085 * S, 0, s * 0.35, 0, 0.85, 0.62, 1.10);
          part(headGrp, sph(0.036 * S, 5, 4), 'eyeDark', s * 0.086 * S, 0.048 * S, 0.096 * S, -0.08, s * 0.30, -s * 0.12, 0.86, 1.02, 0.85);
          part(headGrp, sph(0.029 * S, 5, 4), 'eyeAmber', s * 0.093 * S, 0.046 * S, 0.104 * S, 0, s * 0.30, 0, 0.82, 0.96, 0.78);
          part(headGrp, sph(0.019 * S, 4, 3), 'eyeDark', s * 0.099 * S, 0.047 * S, 0.111 * S, 0, s * 0.30, 0, 0.75, 0.92, 0.72);
          part(headGrp, sph(0.010 * S, 4, 3), 'eyeWhite', s * 0.103 * S, 0.058 * S, 0.118 * S);
        }
        part(headGrp, cone(0.050 * S, 0.24 * S, 5, false), 'phoenixCoral', 0, 0.028 * S, 0.21 * S, Math.PI * 0.48, 0, 0, 0.86, 1.0, 0.76);
        part(headGrp, cone(0.025 * S, 0.14 * S, 5, false), 'phoenixGold', 0, 0.010 * S, 0.33 * S, Math.PI * 0.59, 0, 0, 0.76, 1.0, 0.72);
        part(headGrp, cone(0.035 * S, 0.20 * S, 5, false), 'phoenixCoral', 0, -0.018 * S, 0.195 * S, Math.PI * 0.58, 0, 0, 0.74, 1.0, 0.62);
        part(headGrp, cone(0.022 * S, 0.11 * S, 4, false), 'rosyPink', 0, -0.008 * S, 0.175 * S, Math.PI * 0.55, 0, 0, 0.72, 1.0, 0.45);

        // 3 Sweeping Ivory Nape Plumes
        featherBlade(headGrp, 'phoenixCream', 0, 0.02 * S, -0.06 * S, 0, -0.34, -0.94, 0.065 * S, 0.27 * S, 0.022 * S);
        for (const s of [-1, 1]) {
          featherBlade(headGrp, 'phoenixIvory', s * 0.05 * S, 0.005 * S, -0.05 * S, s * 0.25, -0.42, -0.88, 0.058 * S, 0.24 * S, 0.020 * S);
        }

        // Golden Tiara Crown + 3 Curling Teal-to-Amber-Gold Royal Crest Plumes (reaching y ≈ 1.96m!)
        part(headGrp, cyl(0.068 * S, 0.078 * S, 0.034 * S, 7, false), 'phoenixGold', 0, 0.122 * S, 0.055 * S, 0.18, 0, 0, 0.92, 1.0, 1.04);
        part(headGrp, cone(0.026 * S, 0.082 * S, 4, false), 'phoenixGold', 0, 0.168 * S, 0.095 * S, 0.28, 0, 0);
        for (const s of [-1, 1]) {
          part(headGrp, cone(0.020 * S, 0.064 * S, 4, false), 'phoenixGold', s * 0.048 * S, 0.155 * S, 0.072 * S, 0.20, 0, -s * 0.34);
        }
        glowPart(headGrp, new THREE.OctahedronGeometry(0.020 * S, 0), glowMats.starMat, 0, 0.135 * S, 0.128 * S, 0.2, 0, 0, 0.8, 1.15, 0.65);

        tubeBetween(headGrp, 'phoenixTeal', [0, 0.13 * S, 0.05 * S], [0, 0.28 * S, 0.00 * S], 0.028 * S, 0.020 * S, 0.85, 1.15);
        tubeBetween(headGrp, 'phoenixAmber', [0, 0.28 * S, 0.00 * S], [0, 0.38 * S, 0.055 * S], 0.022 * S, 0.016 * S, 0.85, 1.15);
        part(headGrp, sph(0.046 * S, 6, 4), 'phoenixGold', 0, 0.385 * S, 0.065 * S, 0.35, 0, 0, 0.62, 0.88, 1.25);
        tubeBetween(headGrp, 'phoenixTeal', [0, 0.13 * S, 0.065 * S], [0, 0.23 * S, 0.155 * S], 0.022 * S, 0.015 * S, 0.85, 1.15);
        part(headGrp, sph(0.036 * S, 5, 4), 'phoenixGold', 0, 0.235 * S, 0.165 * S, -0.3, 0, 0, 0.65, 0.78, 1.22);
        for (const s of [-1, 1]) {
          tubeBetween(headGrp, 'phoenixTeal', [s * 0.02 * S, 0.13 * S, 0.03 * S], [s * 0.05 * S, 0.23 * S, -0.12 * S], 0.022 * S, 0.016 * S);
          tubeBetween(headGrp, 'phoenixAmber', [s * 0.05 * S, 0.23 * S, -0.12 * S], [s * 0.06 * S, 0.27 * S, -0.22 * S], 0.018 * S, 0.013 * S);
          part(headGrp, sph(0.038 * S, 5, 4), 'phoenixGold', s * 0.062 * S, 0.275 * S, -0.225 * S, 0.45, -s * 0.25, 0, 0.62, 0.92, 1.18);
        }

        // 5. Tall Slender Coral-Gold Legs & Talons resting at y = 0
        for (const [grp, sx] of [[legsA, 0.112 * S], [legsB, -0.112 * S]]) {
          part(grp, cone(0.076 * S, 0.19 * S, 6, false), 'phoenixIvory', sx, -0.07 * S, -0.01 * S, Math.PI, 0, 0, 0.92, 1.0, 1.05);
          tubeBetween(grp, 'phoenixCoral', [sx, -0.02 * S, 0], [sx, -0.38 * S, -0.03 * S], 0.026 * S, 0.021 * S);
          part(grp, sph(0.027 * S, 5, 4), 'phoenixCoral', sx, -0.38 * S, -0.03 * S);
          tubeBetween(grp, 'phoenixCoral', [sx, -0.38 * S, -0.03 * S], [sx, -0.758 * S, 0.01 * S], 0.021 * S, 0.017 * S);
          part(grp, sph(0.023 * S, 5, 3), 'phoenixCoral', sx, -0.758 * S, 0.01 * S);
          for (const [ang, len] of [[-0.50, 0.13], [0, 0.155], [0.50, 0.13]]) {
            const tx = sx + Math.sin(ang) * len * 0.5 * S;
            const tz = (0.015 + Math.cos(ang) * len * 0.5) * S;
            part(grp, cone(0.016 * S, len * S, 4, false), 'phoenixCoral', tx, -0.766 * S, tz, Math.PI * 0.51, ang, 0, 0.92, 1.0, 0.72);
          }
          part(grp, cone(0.014 * S, 0.095 * S, 4, false), 'phoenixCoral', sx, -0.766 * S, -0.038 * S, -Math.PI * 0.49, 0, 0, 0.88, 1.0, 0.72);
        }

        // 6. Upper Tail Fan + 3 Seamless S-Curved Starlight-Tipped Phoenix Ribbons!
        for (let i = -2; i <= 2; i++) {
          const ang = i * 0.22;
          const sw = Math.abs(i) === 2 ? 'phoenixCream' : (i === 0 ? 'phoenixTeal' : 'phoenixIvory');
          featherBlade(tailGrp, sw, Math.sin(ang) * 0.07 * S, 0.02 * S, -0.02 * S, Math.sin(ang) * 0.45, -0.22, -Math.cos(ang), 0.13 * S, 0.46 * S, 0.026 * S, true);
        }
        const ribbons = [
          [[0.0, 0.02, -0.04], [0.0, -0.18, -0.38], [0.02, -0.40, -0.78], [-0.02, -0.56, -1.20], [0.0, -0.64, -1.54], [0.0, -0.57, -1.74]],
          [[0.08, 0.00, -0.04], [0.18, -0.16, -0.34], [0.26, -0.35, -0.70], [0.22, -0.49, -1.08], [0.28, -0.55, -1.38], [0.31, -0.47, -1.56]],
          [[-0.08, 0.00, -0.04], [-0.18, -0.16, -0.34], [-0.26, -0.35, -0.70], [-0.22, -0.49, -1.08], [-0.28, -0.55, -1.38], [-0.31, -0.47, -1.56]],
        ];
        for (const pts of ribbons) {
          for (let k = 0; k < pts.length - 1; k++) {
            const p0 = [pts[k][0] * S, pts[k][1] * S, pts[k][2] * S];
            const p1 = [pts[k + 1][0] * S, pts[k + 1][1] * S, pts[k + 1][2] * S];
            const u = k / (pts.length - 2);
            const sw = k <= 1 ? 'phoenixTeal' : (k === 2 ? 'phoenixAzure' : (k === 3 ? 'phoenixAmber' : 'phoenixGold'));
            tubeBetween(tailGrp, sw, p0, p1, (0.046 - u * 0.016) * S, (0.038 - u * 0.016) * S, 1.45, 0.36);
          }
          const tip = pts[pts.length - 1];
          addStarlightTip(tailGrp, glowMats.starMat, tip[0] * S, tip[1] * S, (tip[2] - 0.03) * S, 0.072 * S, 0.35, tip[0] * 0.6);
        }

        // 7. Smooth Flat-Layered 4-Tier Magical Celestial Wings (~4.25m spread wingspan!)
        const span = 1.72 * S;
        for (const [grp, s] of [[wingL, 1], [wingR, -1]]) {
          if (!grp) continue;
          tubeBetween(grp, 'phoenixAmber', [0, 0.015 * S, 0.11 * S], [s * span * 0.54, 0.025 * S, 0.14 * S], 0.044 * S, 0.032 * S, 1.0, 0.85);
          tubeBetween(grp, 'phoenixIvory', [s * span * 0.54, 0.025 * S, 0.14 * S], [s * span * 0.94, 0.045 * S, 0.12 * S], 0.032 * S, 0.018 * S, 1.0, 0.85);
          part(grp, rbox(span * 0.74, 0.028 * S, 0.30 * S, 0.014 * S), 'phoenixIvory', s * span * 0.40, 0, -0.02 * S, 0, 0, 0);

          // Tier 1: Sunlit Amber-Gold Shoulder Mantle Coverts
          for (let i = 0; i < 6; i++) {
            const u = i / 5;
            featherBlade(grp, i < 2 ? 'phoenixGold' : 'phoenixAmber', s * (0.04 + u * span * 0.34), 0.020 * S, (0.10 - u * 0.03) * S, s * (0.12 + u * 0.28), 0, -1, 0.15 * S, 0.31 * S, 0.030 * S, true);
          }
          // Tier 2: Pearlescent Cream-Ivory Inner Secondaries
          for (let i = 0; i < 7; i++) {
            const u = i / 6;
            featherBlade(grp, i % 2 === 0 ? 'phoenixIvory' : 'phoenixCream', s * (0.10 + u * span * 0.54), 0.012 * S, (0.00 - u * 0.02) * S, s * (0.15 + u * 0.36), 0, -1, 0.155 * S, 0.42 * S, 0.026 * S, true);
          }
          // Tier 3: Vibrant Celestial Turquoise-Teal Mid Feathers
          for (let i = 0; i < 8; i++) {
            const u = i / 7;
            featherBlade(grp, i % 2 === 0 ? 'phoenixTeal' : 'phoenixAzure', s * (0.20 + u * span * 0.66), 0.005 * S, (-0.11 + u * 0.06) * S, s * (0.18 + u * 0.52), 0.01, -1, 0.145 * S, 0.46 * S, 0.024 * S, false);
          }
          // Tier 4: 9 Long Splayed Royal Indigo Primary Flight Blades + Sunlit Gold Feather Tips!
          for (let i = 0; i < 9; i++) {
            const u = i / 8;
            const fanAng = 0.20 + u * 1.14;
            const dx = s * Math.sin(fanAng), dy = Math.pow(u, 1.8) * 0.08, dz = -Math.cos(fanAng);
            const bx = s * (0.30 + u * span * 0.64);
            const by = Math.pow(u, 1.5) * 0.03 * S;
            const bz = (-0.18 + Math.pow(u, 1.25) * 0.26) * S;
            const bLen = (0.50 + Math.pow(u, 0.85) * 0.26) * S;
            featherBlade(grp, 'phoenixIndigo', bx, by, bz, dx, dy, dz, (0.135 - u * 0.022) * S, bLen, 0.024 * S, false);
            featherBlade(grp, 'phoenixGold', bx + dx * bLen * 0.72, by + dy * bLen * 0.72, bz + dz * bLen * 0.72, dx, dy, dz, (0.088 - u * 0.014) * S, bLen * 0.30, 0.022 * S, false);
          }
        }
      },
      [0.20 * S, 1.05 * S, 0.06 * S]
    );
  }

  // ==========================================================================
  // TIER 3 — HUGE MAGICAL BIRD (height 2.72m, wingspan ~5.90m!!):
  //   mb_roc -> "Colossal Cloud-Roc" (🦅)
  //   Towering mythic crimson-scarlet, sunset-flame & obsidian-gold Eagle-Thunderbird Titan!
  //   Broad muscular armored chest with blazing solar-ruby core, lion-like crimson neck mane,
  //   heavy hooked bronze-gold eagle beak, swept dragon-crest horns, 5.90m condor wings & 9-blade war-fan tail!
  // ==========================================================================
  function buildRoc() {
    return makeRig(
      'mb_roc',
      [0, 1.38, 0.04],
      [0, 2.18, 0.36],
      [0, 1.12, -0.02],
      [0, 1.26, -0.52],
      ({ bodyGrp, headGrp, legsA, legsB, tailGrp, wingL, wingR }) => {
        // 1. Massive Barrel-Chested Eagle-Griffin Torso (0.88m wide crimson & obsidian shoulders!)
        const rocTorso = lathe(
          [[0, -0.66], [0.26, -0.48], [0.42, -0.14], [0.45, 0.20], [0.34, 0.48], [0.16, 0.64], [0, 0.68]],
          10
        );
        part(bodyGrp, rocTorso, 'rocCrimson', 0, 0, 0, 1.18, 0, 0, 1.04, 1.0, 0.96);
        part(bodyGrp, sph(0.36, 8, 6), 'rocCrimson', 0, 0.08, 0.30, 0.2, 0, 0, 1.08, 1.05, 0.92);
        part(bodyGrp, sph(0.30, 7, 5), 'rocObsidian', 0, -0.08, -0.28, -0.25, 0, 0, 1.0, 0.92, 1.12);

        // Armored Burnished Bronze-Gold Breastplates + Giant Blazing Solar-Ruby Core Crystal!
        for (let row = 0; row < 2; row++) {
          for (let i = -3; i <= 3; i++) {
            const ang = i * 0.28;
            featherBlade(
              bodyGrp,
              Math.abs(i) % 2 === 0 ? 'rocBronze' : 'phoenixGold',
              Math.sin(ang) * (0.28 - row * 0.03),
              0.14 - row * 0.16,
              0.42 - Math.abs(i) * 0.02 - row * 0.03,
              Math.sin(ang) * 0.52,
              -0.82,
              0.24,
              0.15,
              0.28,
              0.038,
              false,
              0,
              0.2,
              1
            );
          }
        }
        part(bodyGrp, new THREE.OctahedronGeometry(0.155, 0), 'rocBronze', 0, 0.12, 0.52, 0.12, 0, 0, 0.92, 1.25, 0.42);
        glowPart(bodyGrp, new THREE.OctahedronGeometry(0.122, 0), glowMats.rubyMat, 0, 0.12, 0.545, 0.12, 0, 0, 0.84, 1.18, 0.58);

        // Thick Powerful Arched Eagle Neck + 2 Tiers of Lion-Like Crimson & Flame Hackle Mane!
        tubeBetween(bodyGrp, 'rocCrimson', [0, 0.22, 0.26], [0, 0.56, 0.30], 0.22, 0.17);
        tubeBetween(bodyGrp, 'rocFlame', [0, 0.54, 0.30], [0, 0.82, 0.32], 0.17, 0.14);
        for (let ring = 0; ring < 2; ring++) {
          const ry = 0.44 + ring * 0.24;
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2;
            const sw = (i + ring) % 2 === 0 ? 'rocCrimson' : 'rocFlame';
            featherBlade(
              bodyGrp,
              sw,
              Math.sin(ang) * 0.16,
              ry,
              0.30 + Math.cos(ang) * 0.16,
              Math.sin(ang) * 0.65,
              -0.65,
              Math.cos(ang) * 0.65 - 0.25,
              0.14,
              0.34,
              0.034,
              false
            );
          }
        }

        // 2. Fierce Great Eagle-Griffin Head, Heavy Hooked Raptor Beak & Swept Dragon-Crest Brow Horns (y ≈ 2.72m!)
        part(headGrp, sph(0.20, 8, 6), 'phoenixIvory', 0, 0.05, 0.04, 0, 0, 0, 1.02, 0.94, 1.18);
        part(headGrp, sph(0.16, 7, 5), 'rocCrimson', 0, 0.11, -0.04, -0.2, 0, 0, 1.06, 0.85, 1.15);
        // Fierce furrowed eagle brow ridges + blazing golden predator eyes!
        for (const s of [-1, 1]) {
          tubeBetween(headGrp, 'rocBronze', [s * 0.06, 0.13, 0.20], [s * 0.17, 0.10, 0.05], 0.032, 0.026);
          part(headGrp, sph(0.048, 5, 4), 'eyeDark', s * 0.135, 0.065, 0.125, 0, s * 0.28, 0, 0.85, 0.92, 0.85);
          part(headGrp, sph(0.038, 5, 4), 'phoenixGold', s * 0.144, 0.065, 0.132, 0, s * 0.28, 0, 0.82, 0.88, 0.80);
          part(headGrp, sph(0.020, 4, 3), 'eyeDark', s * 0.152, 0.065, 0.138);
          part(headGrp, sph(0.011, 4, 3), 'eyeWhite', s * 0.156, 0.078, 0.146);
        }
        // Massive Heavy Hooked Golden-Bronze Eagle Raptor Beak (0.46m!)
        part(headGrp, cone(0.095, 0.34, 6, false), 'rocBronze', 0, 0.035, 0.29, Math.PI * 0.49, 0, 0, 0.88, 1.0, 0.96);
        part(headGrp, cone(0.052, 0.22, 5, false), 'phoenixGold', 0, -0.045, 0.43, Math.PI * 0.78, 0, 0, 0.76, 1.0, 0.85);
        part(headGrp, cone(0.064, 0.26, 5, false), 'rocBronze', 0, -0.032, 0.26, Math.PI * 0.56, 0, 0, 0.76, 1.0, 0.72);

        // Swept-Back Crimson & Gold Dragon-Crest Brow Horns + Central Solar Blade (reaches y ≈ 2.72m!)
        featherBlade(headGrp, 'phoenixGold', 0, 0.16, 0.06, 0, 0.82, -0.57, 0.11, 0.46, 0.034, false, 1, 0, 0);
        glowPart(headGrp, new THREE.OctahedronGeometry(0.042, 0), glowMats.rubyMat, 0, 0.18, 0.18, 0.2, 0, 0, 0.85, 1.25, 0.65);
        for (const s of [-1, 1]) {
          tubeBetween(headGrp, 'rocCrimson', [s * 0.12, 0.13, 0.08], [s * 0.24, 0.34, -0.18], 0.048, 0.030, 0.85, 1.25);
          tubeBetween(headGrp, 'phoenixGold', [s * 0.24, 0.34, -0.18], [s * 0.30, 0.52, -0.42], 0.030, 0.012, 0.85, 1.20);
          addStarlightTip(headGrp, glowMats.rubyMat, s * 0.31, 0.53, -0.44, 0.062, 0.3, s * 0.35);
        }

        // 3. Thick Muscular Crimson-Feathered Raptor Thighs & Giant Curved Bronze-Obsidian Eagle Talons at y = 0!
        for (const [grp, sx] of [[legsA, 0.20], [legsB, -0.20]]) {
          part(grp, cone(0.155, 0.48, 7, false), 'rocCrimson', sx, -0.20, -0.02, Math.PI, 0, 0, 0.96, 1.0, 1.08);
          part(grp, cone(0.125, 0.30, 6, false), 'rocFlame', sx, -0.36, -0.02, Math.PI, 0, 0, 0.94, 1.0, 1.04);
          tubeBetween(grp, 'rocBronze', [sx, -0.44, -0.02], [sx, -1.07, 0.02], 0.044, 0.034);
          part(grp, sph(0.044, 5, 4), 'rocBronze', sx, -1.07, 0.02);
          for (const [ang, len] of [[-0.52, 0.24], [0, 0.28], [0.52, 0.24]]) {
            const tx = sx + Math.sin(ang) * len * 0.46;
            const tz = 0.03 + Math.cos(ang) * len * 0.46;
            part(grp, cone(0.028, len, 5, false), 'rocBronze', tx, -1.092, tz, Math.PI * 0.51, ang, 0, 1.0, 1.0, 0.78);
            part(grp, cone(0.018, 0.09, 4, false), 'rocObsidian', tx + Math.sin(ang) * len * 0.48, -1.098, tz + Math.cos(ang) * len * 0.48, Math.PI * 0.62, ang, 0);
          }
          part(grp, cone(0.026, 0.18, 5, false), 'rocBronze', sx, -1.092, -0.07, -Math.PI * 0.49, 0, 0);
        }

        // 4. Giant 9-Blade V-Notched Imperial Eagle War-Fan Tail (1.95m wide obsidian/crimson/gold fan!)
        for (let i = -4; i <= 4; i++) {
          const ang = i * 0.21;
          const vLen = 0.88 + Math.abs(i) * 0.09;
          const dx = Math.sin(ang) * 0.72, dy = -0.18, dz = -Math.cos(ang);
          featherBlade(tailGrp, Math.abs(i) % 2 === 0 ? 'rocObsidian' : 'rocCrimson', Math.sin(ang) * 0.10, 0.02, -0.04, dx, dy, dz, 0.20, vLen, 0.034, false);
          featherBlade(tailGrp, 'phoenixGold', Math.sin(ang) * 0.10 + dx * vLen * 0.66, 0.02 + dy * vLen * 0.66, -0.04 + dz * vLen * 0.66, dx, dy, dz, 0.14, vLen * 0.32, 0.030, false);
        }
        for (const i of [-3, 0, 3]) {
          const ang = i * 0.21;
          addStarlightTip(tailGrp, glowMats.rubyMat, Math.sin(ang) * 0.78, -0.18, -0.96 - Math.abs(i) * 0.04, 0.068, 0.25, -ang);
        }

        // 5. Colossal 4-Tier Condor / Thunderbird Wings (~5.90m tip-to-tip spread wingspan!!)
        const span = 2.62;
        for (const [grp, s] of [[wingL, 1], [wingR, -1]]) {
          if (!grp) continue;
          tubeBetween(grp, 'rocCrimson', [0, 0.02, 0.16], [s * span * 0.52, 0.04, 0.22], 0.072, 0.052, 1.0, 0.88);
          tubeBetween(grp, 'rocBronze', [s * span * 0.52, 0.04, 0.22], [s * span * 0.94, 0.08, 0.18], 0.052, 0.026, 1.0, 0.88);
          glowPart(grp, new THREE.OctahedronGeometry(0.058, 0), glowMats.rubyMat, s * span * 0.52, 0.065, 0.23, 0, 0, 0, 1.1, 0.75, 0.9);
          part(grp, rbox(span * 0.76, 0.042, 0.46, 0.020), 'rocCrimson', s * span * 0.40, 0, -0.02, 0, 0, 0);

          // Tier 1: Crimson-Scarlet Shoulder Armor Coverts
          for (let i = 0; i < 7; i++) {
            const u = i / 6;
            featherBlade(grp, i % 2 === 0 ? 'rocCrimson' : 'rocBronze', s * (0.06 + u * span * 0.42), 0.030, 0.14 - u * 0.03, s * (0.12 + u * 0.26), 0, -1, 0.22, 0.46, 0.040, false);
          }
          // Tier 2: Sunset Flame-Orange Inner Coverts
          for (let i = 0; i < 8; i++) {
            const u = i / 7;
            featherBlade(grp, 'rocFlame', s * (0.12 + u * span * 0.58), 0.018, 0.00 - u * 0.02, s * (0.15 + u * 0.36), 0, -1, 0.22, 0.62, 0.036, false);
          }
          // Tier 3: Burnished Solar-Gold Mid-Wing Feathers
          for (let i = 0; i < 9; i++) {
            const u = i / 8;
            featherBlade(grp, i % 2 === 0 ? 'phoenixGold' : 'rocBronze', s * (0.24 + u * span * 0.66), 0.008, -0.16 + u * 0.08, s * (0.18 + u * 0.50), 0.01, -1, 0.21, 0.68, 0.032, false);
          }
          // Tier 4: 11 Giant Splayed Deep-Obsidian Eagle Finger Primaries with Blazing Flame-Gold Tips!
          for (let i = 0; i < 11; i++) {
            const u = i / 10;
            const fanAng = 0.18 + u * 1.18;
            const dx = s * Math.sin(fanAng), dy = Math.pow(u, 1.7) * 0.09, dz = -Math.cos(fanAng);
            const bx = s * (0.36 + u * span * 0.62);
            const by = Math.pow(u, 1.5) * 0.05;
            const bz = -0.26 + Math.pow(u, 1.25) * 0.36;
            const bLen = 0.76 + Math.pow(u, 0.85) * 0.34;
            featherBlade(grp, 'rocObsidian', bx, by, bz, dx, dy, dz, 0.19 - u * 0.03, bLen, 0.032, false);
            featherBlade(grp, i % 2 === 0 ? 'rocFlame' : 'phoenixGold', bx + dx * bLen * 0.70, by + dy * bLen * 0.70, bz + dz * bLen * 0.70, dx, dy, dz, 0.125 - u * 0.02, bLen * 0.32, 0.028, false);
          }
        }
      },
      [0.32, 1.56, 0.10]
    );
  }

  return {
    mb_cow: buildCow,
    mb_chicken: buildChicken,
    mb_pig: buildPig,
    mb_sheep: buildSheep,
    mb_duck: buildDuck,
    mb_dog: buildDog,
    mb_cat: buildCat,
    mb_heron: buildHeron,
    mb_stork: buildStork,
    mb_roc: buildRoc,
  };
}

// ============================================================================
// Open-Gated Countryside Animal Habitats (Outer Meadow Skirt r = 24..36m)
// ============================================================================
export function buildAnimalHabitats(THREE, helpers = {}) {
  const groundY = (x, z) =>
    helpers && typeof helpers.getGroundY === 'function' ? helpers.getGroundY(x, z) : 0;

  const matCache = new Map();
  const M = (hex, texName = null, rx = 1, ry = 1, extra = {}) => {
    const key = `${hex}|${texName || ''}|${rx}|${ry}|${JSON.stringify(extra)}`;
    if (!matCache.has(key)) {
      let mapTex = null;
      if (texName) {
        try {
          mapTex = kitTex(THREE, texName, rx, ry);
        } catch (e) {
          mapTex = kitTex(THREE, texName, 1, 1);
        }
      }
      matCache.set(
        key,
        new THREE.MeshStandardMaterial(
          Object.assign(
            {
              color: hex,
              map: mapTex,
              roughness: 0.92,
              metalness: 0, // Strictly 0 across all Storybook props & habitats
            },
            extra
          )
        )
      );
    }
    return matCache.get(key);
  };

  const rbox = (w, h, d, r, mat, seg = 1) =>
    new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, seg, Math.max(0.004, Math.min(r, w * 0.46, h * 0.46, d * 0.46))),
      mat
    );

  const add = (parent, mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const group = new THREE.Group();
  group.name = 'meadow_animal_habitats';
  const colliders = [];

  const pushCol = (x, z, w, d, rot, y0, y1, standable = true) => {
    colliders.push({ x, z, w, d, rot: rot || 0, y0, y1, standable: !!standable, noJump: !standable });
  };

  // Materials
  const railWood   = M(0xb88754, 'wood_light', 0.8, 0.8);
  const postWood   = M(0x8e6038, 'bark', 0.7, 0.7);
  const darkPlank  = M(0x7c5232, 'wood_planks_dark', 0.7, 0.7);
  const barnRed    = M(0xc2493c, 'wood_light', 0.8, 0.8);
  const creamTrim  = M(0xf8ebd2, 'plaster', 0.6, 0.6);
  const roofTile   = M(0x9e5238, 'roof_tiles', 0.6, 0.6);
  const hayMat     = M(0xf0cd69, 'hay', 0.8, 0.8);
  const basketMat  = M(0xd6ae6e, 'burlap', 0.8, 0.8);
  const tinMat     = M(0xbccad3, 'painted_metal', 0.7, 0.7, { roughness: 0.68, metalness: 0 });
  const stoneMat   = M(0xd2cbc0, 'stone', 0.7, 0.7);
  const mossMat    = M(0x6ba64c, 'leaves', 0.7, 0.7);
  const reedGreen  = M(0x558e3e, 'leaves', 0.6, 0.6);
  const cattailBrn = M(0x5a3721, 'bark', 0.6, 0.6);
  const saltMat    = M(0xf6dde0, 'stone', 0.5, 0.5, { roughness: 0.78, metalness: 0 });
  const waterMat   = M(0x66bce0, null, 1, 1, { emissive: 0x1d5875, emissiveIntensity: 0.22, roughness: 0.25, metalness: 0 });
  const mudRimMat  = M(0x7c5639, 'stone', 0.8, 0.8, { roughness: 0.82, metalness: 0 });
  const mudGloss   = M(0x5a3a24, 'stone', 0.6, 0.6, { roughness: 0.30, metalness: 0 });
  const mudPuddle  = M(0x4b2f1c, null, 1, 1, { roughness: 0.24, metalness: 0 });
  const scratchMat = M(0xdfc292, 'stone', 0.7, 0.7, { roughness: 0.95, metalness: 0 });
  const grainMat   = M(0xf5c238, null, 1, 1, { roughness: 0.85, metalness: 0 });
  const eggCream   = M(0xfdf5e6, null, 1, 1, { roughness: 0.78, metalness: 0 });
  const eggBrown   = M(0xdca87c, null, 1, 1, { roughness: 0.80, metalness: 0 });
  const lotusPink  = M(0xf6a6bf, null, 1, 1, { roughness: 0.85, metalness: 0 });
  const lotusCream = M(0xfff4dc, null, 1, 1, { roughness: 0.85, metalness: 0 });
  const slopMash   = M(0xd9b372, 'hay', 0.6, 0.6, { roughness: 0.75, metalness: 0 });

  // Helper: rustic split-rail fence span from world (x0, z0) to (x1, z1)
  const addFenceSpan = (parent, x0, z0, x1, z1, baseY, addEndPost = true) => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const mx = (x0 + x1) * 0.5, mz = (z0 + z1) * 0.5;
    const rot = Math.atan2(dx, dz); // local Z aligns from (x0,z0) -> (x1,z1)
    add(parent, new THREE.CylinderGeometry ? new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.92, 6), postWood) : rbox(0.13, 0.92, 0.13, 0.03, postWood), x0, baseY + 0.46, z0);
    if (addEndPost) {
      add(parent, new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.92, 6), postWood), x1, baseY + 0.46, z1);
    }
    add(parent, rbox(0.07, 0.085, len, 0.025, railWood), mx, baseY + 0.72, mz, 0, rot, 0);
    add(parent, rbox(0.07, 0.085, len, 0.025, railWood), mx, baseY + 0.40, mz, 0, rot, 0);
    pushCol(mx, mz, 0.18, len, rot, baseY - 0.3, baseY + 0.92, true);
  };

  // --------------------------------------------------------------------------
  // 1. Cow & Sheep Sunny Pasture around (29.5, 3.5) — TWO 3.6m wide open gateways!
  // --------------------------------------------------------------------------
  const pastureGrp = new THREE.Group();
  pastureGrp.name = 'habitat_sunny_pasture';
  {
    const px = 29.5, pz = 3.5;
    const by = groundY(px, pz);
    const xW = 25.7, xE = 33.3, zS = -1.1, zN = 8.1;

    // West side (x = 25.7): 3.6m wide open gateway z in [1.7, 5.3] facing the village!
    addFenceSpan(pastureGrp, xW, zS, xW, 1.7, by, true);
    addFenceSpan(pastureGrp, xW, 5.3, xW, zN, by, true);
    // Tall chamfered gateway finials flanking West 3.6m gate
    for (const gz of [1.7, 5.3]) {
      add(pastureGrp, rbox(0.20, 0.10, 0.20, 0.03, creamTrim), xW, by + 0.96, gz);
    }

    // South side (z = -1.1): 3.6m wide open gateway x in [27.7, 31.3] toward Barn/Pasture path!
    addFenceSpan(pastureGrp, xW, zS, 27.7, zS, by, true);
    addFenceSpan(pastureGrp, 31.3, zS, xE, zS, by, true);
    for (const gx of [27.7, 31.3]) {
      add(pastureGrp, rbox(0.20, 0.10, 0.20, 0.03, creamTrim), gx, by + 0.96, zS);
    }

    // North side (z = 8.1) & East outer skirt side (x = 33.3)
    addFenceSpan(pastureGrp, xW, zN, (xW + xE) * 0.5, zN, by, false);
    addFenceSpan(pastureGrp, (xW + xE) * 0.5, zN, xE, zN, by, true);
    addFenceSpan(pastureGrp, xE, zS, xE, 2.0, by, false);
    addFenceSpan(pastureGrp, xE, 2.0, xE, 5.1, by, false);
    addFenceSpan(pastureGrp, xE, 5.1, xE, zN, by, true);

    // Wooden Water Trough with shimmering blue water at (31.9, 6.4)
    const wtG = new THREE.Group();
    wtG.position.set(31.9, by, 6.4);
    wtG.rotation.y = -0.25;
    add(wtG, rbox(1.64, 0.44, 0.68, 0.05, darkPlank), 0, 0.28, 0);
    add(wtG, rbox(0.16, 0.10, 0.74, 0.02, postWood), -0.58, 0.05, 0);
    add(wtG, rbox(0.16, 0.10, 0.74, 0.02, postWood),  0.58, 0.05, 0);
    const wat = add(wtG, rbox(1.46, 0.08, 0.52, 0.02, waterMat), 0, 0.48, 0);
    wat.castShadow = false;
    pastureGrp.add(wtG);
    pushCol(31.9, 6.4, 1.68, 0.72, -0.25, by - 0.3, by + 0.54, true);

    // Timber Hay-Rack Feeder at (32.0, 1.3)
    const hrG = new THREE.Group();
    hrG.position.set(32.0, by, 1.3);
    hrG.rotation.y = 0.20;
    add(hrG, rbox(1.66, 0.24, 0.86, 0.05, darkPlank), 0, 0.24, 0);
    for (const sx of [-0.74, 0.74]) {
      for (const sz of [-0.34, 0.34]) {
        add(hrG, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 1.08, 6), postWood), sx, 0.54, sz);
      }
    }
    for (let i = -2; i <= 2; i++) {
      add(hrG, rbox(0.05, 0.62, 0.05, 0.015, railWood), i * 0.31, 0.68,  0.30,  0.22, 0, 0);
      add(hrG, rbox(0.05, 0.62, 0.05, 0.015, railWood), i * 0.31, 0.68, -0.30, -0.22, 0, 0);
    }
    add(hrG, new THREE.Mesh(new THREE.SphereGeometry(0.46, 7, 5), hayMat), 0, 0.72, 0, 0, 0, 0).scale.set(1.55, 0.82, 0.78);
    pastureGrp.add(hrG);
    pushCol(32.0, 1.3, 1.70, 0.90, 0.20, by - 0.3, by + 1.14, true);

    // Salt-Lick Stump at (27.4, 6.5)
    add(pastureGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.38, 8), postWood), 27.4, by + 0.19, 6.5);
    add(pastureGrp, rbox(0.28, 0.24, 0.28, 0.06, saltMat), 27.4, by + 0.49, 6.5, 0.08, 0.4, -0.06);
    pushCol(27.4, 6.5, 0.66, 0.66, 0, by - 0.3, by + 0.62, true);

    mergeStatic(THREE, pastureGrp);
    group.add(pastureGrp);
  }

  // --------------------------------------------------------------------------
  // 2. Cozy Chicken Coop & Pecking Yard around (17.5, -24.5)
  // --------------------------------------------------------------------------
  const coopGrp = new THREE.Group();
  coopGrp.name = 'habitat_chicken_coop';
  {
    const cx = 17.5, cz = -24.5;
    const by = groundY(cx, cz);

    // Sandy pecking-yard patch (walkable ground)
    const scratchGeo = new THREE.CylinderGeometry(1.95, 2.05, 0.03, 14);
    const scratch = add(coopGrp, new THREE.Mesh(scratchGeo, scratchMat), 17.4, by + 0.015, -23.7);
    scratch.castShadow = false;
    scratch.userData.ground = true;
    scratch.userData.keep = true;

    // Raised Red-and-Cream Storybook Wooden Hen-House on stilts at (17.9, -25.8), facing +0.28
    const hh = new THREE.Group();
    hh.position.set(17.9, by, -25.8);
    hh.rotation.y = 0.28;
    for (const sx of [-0.84, 0.84]) {
      for (const sz of [-0.64, 0.64]) {
        add(hh, rbox(0.14, 0.46, 0.14, 0.03, postWood), sx, 0.23, sz);
      }
    }
    add(hh, rbox(2.02, 0.12, 1.62, 0.03, darkPlank), 0, 0.46, 0);
    add(hh, rbox(1.88, 1.04, 1.46, 0.06, barnRed), 0, 1.02, 0);
    // Cream corner trims & arched pop-hole frame
    for (const sx of [-0.91, 0.91]) {
      for (const sz of [-0.70, 0.70]) {
        add(hh, rbox(0.10, 1.06, 0.10, 0.02, creamTrim), sx, 1.02, sz);
      }
    }
    add(hh, rbox(0.46, 0.56, 0.08, 0.04, creamTrim), 0, 0.78, 0.73);
    add(hh, rbox(0.34, 0.46, 0.09, 0.03, M(0x2a1e18, null)), 0, 0.75, 0.745);
    // Side egg-collection nesting box bay
    add(hh, rbox(0.46, 0.48, 0.88, 0.04, barnRed), 1.08, 0.82, 0);
    add(hh, rbox(0.54, 0.08, 0.96, 0.02, roofTile), 1.10, 1.09, 0, 0, 0, -0.26);
    // Pitched Storybook cottage roof + cream ridge beam
    add(hh, rbox(1.36, 0.10, 1.76, 0.03, roofTile), -0.54, 1.74, 0, 0, 0,  0.56);
    add(hh, rbox(1.36, 0.10, 1.76, 0.03, roofTile),  0.54, 1.74, 0, 0, 0, -0.56);
    add(hh, rbox(0.16, 0.14, 1.82, 0.03, creamTrim), 0, 2.04, 0);
    // Cleated chicken ramp from pop-hole down to sandy yard (+Z)
    add(hh, rbox(0.40, 0.06, 1.24, 0.02, railWood), 0, 0.25, 1.28, 0.37, 0, 0);
    for (let k = -2; k <= 2; k++) {
      add(hh, rbox(0.38, 0.035, 0.045, 0.01, postWood), 0, 0.27 - k * 0.082, 1.28 + k * 0.22, 0.37, 0, 0);
    }
    coopGrp.add(hh);
    pushCol(17.9, -25.8, 2.12, 1.72, 0.28, by - 0.3, by + 2.04, false);

    // Woven Nesting Basket with Eggs at (15.9, -25.2)
    const bGeo = new THREE.LatheGeometry(
      [[0, 0], [0.28, 0.01], [0.36, 0.14], [0.38, 0.26], [0.32, 0.26], [0.25, 0.08], [0, 0.08]].map(
        ([r, y]) => new THREE.Vector2(r, y)
      ),
      10
    );
    add(coopGrp, new THREE.Mesh(bGeo, basketMat), 15.9, by, -25.2);
    add(coopGrp, new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 4), hayMat), 15.9, by + 0.13, -25.2).scale.set(1, 0.42, 1);
    const eggOffsets = [[-0.08, 0.21, -0.05, eggCream], [0.09, 0.21, -0.03, eggBrown], [0.01, 0.22, 0.08, eggCream], [-0.03, 0.23, 0.01, eggBrown]];
    for (const [ex, ey, ez, em] of eggOffsets) {
      const egg = add(coopGrp, new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), em), 15.9 + ex, by + ey, -25.2 + ez, 0.2, ex * 4, -0.15);
      egg.scale.set(0.86, 1.22, 0.86);
    }
    pushCol(15.9, -25.2, 0.74, 0.74, 0, by - 0.25, by + 0.34, true);

    // Tin Grain Feeder at (19.2, -23.7)
    add(coopGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.10, 10), tinMat), 19.2, by + 0.05, -23.7);
    add(coopGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 8), grainMat), 19.2, by + 0.09, -23.7);
    add(coopGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.34, 9), tinMat), 19.2, by + 0.25, -23.7);
    add(coopGrp, new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.14, 9), barnRed), 19.2, by + 0.48, -23.7);
    pushCol(19.2, -23.7, 0.66, 0.66, 0, by - 0.25, by + 0.55, true);

    // Scattered golden corn kernels across the pecking patch (non-colliding ground clutter)
    const kernels = [
      [17.1, -23.9], [17.4, -23.5], [17.7, -23.8], [16.9, -23.4], [18.1, -23.4],
      [17.3, -24.2], [18.5, -24.0], [16.6, -24.1], [17.8, -23.1], [18.7, -23.5],
    ];
    for (const [kx, kz] of kernels) {
      const km = add(coopGrp, new THREE.Mesh(new THREE.SphereGeometry(0.032, 4, 3), grainMat), kx, by + 0.035, kz);
      km.scale.set(1.2, 0.65, 0.9);
      km.castShadow = false;
      km.userData.noSolid = true;
    }

    // Short open rustic corner rails framing the back of the coop yard
    addFenceSpan(coopGrp, 14.9, -26.2, 16.5, -26.7, by, true);
    addFenceSpan(coopGrp, 19.4, -26.3, 20.8, -25.1, by, true);

    mergeStatic(THREE, coopGrp);
    group.add(coopGrp);
  }

  // --------------------------------------------------------------------------
  // 3. Muddy Pigpen & Wallow around (30.5, -13.5) (east/behind the Red Barn)
  // --------------------------------------------------------------------------
  const pigpenGrp = new THREE.Group();
  pigpenGrp.name = 'habitat_muddy_pigpen';
  {
    const mx = MUD_WALLOW_SPEC.x, mz = MUD_WALLOW_SPEC.z;
    const by = groundY(mx, mz);

    // Glossy warm brown mud-wallow oval (~3.2m x 2.4m, userData.ground = true, y = 0.02)
    const rimGeo = new THREE.CylinderGeometry(1.0, 1.06, 0.03, 18);
    const rim = add(pigpenGrp, new THREE.Mesh(rimGeo, mudRimMat), mx, by + 0.014, mz, 0, -MUD_WALLOW_SPEC.rot, 0);
    rim.scale.set(MUD_WALLOW_SPEC.rx * 1.08, 1, MUD_WALLOW_SPEC.rz * 1.08);
    rim.castShadow = false;
    rim.userData.ground = true;
    rim.userData.keep = true;

    const mudGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.025, 18);
    const mud = add(pigpenGrp, new THREE.Mesh(mudGeo, mudGloss), mx, by + 0.02, mz, 0, -MUD_WALLOW_SPEC.rot, 0);
    mud.scale.set(MUD_WALLOW_SPEC.rx, 1, MUD_WALLOW_SPEC.rz);
    mud.castShadow = false;
    mud.userData.ground = true;
    mud.userData.keep = true;

    // Satellite glossy mud puddles
    for (const [px, pz, rx, rz, pr] of [
      [28.8, -14.5, 0.55, 0.42, 0.4],
      [31.8, -14.7, 0.48, 0.36, -0.3],
      [29.5, -12.0, 0.44, 0.34, 0.7],
    ]) {
      const pd = add(pigpenGrp, new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.02, 12), mudPuddle), px, by + 0.02, pz, 0, pr, 0);
      pd.scale.set(rx, 1, rz);
      pd.castShadow = false;
      pd.userData.ground = true;
      pd.userData.keep = true;
    }

    // Wooden Slop Trough at (32.2, -11.9)
    const stG = new THREE.Group();
    stG.position.set(32.2, by, -11.9);
    stG.rotation.y = 0.42;
    add(stG, rbox(1.48, 0.36, 0.60, 0.05, darkPlank), 0, 0.22, 0);
    add(stG, rbox(0.14, 0.08, 0.66, 0.02, postWood), -0.52, 0.04, 0);
    add(stG, rbox(0.14, 0.08, 0.66, 0.02, postWood),  0.52, 0.04, 0);
    add(stG, rbox(1.32, 0.07, 0.46, 0.02, slopMash), 0, 0.36, 0);
    add(stG, new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), barnRed), -0.25, 0.40, 0.04);
    add(stG, new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), barnRed), 0.30, 0.40, -0.05);
    pigpenGrp.add(stG);
    pushCol(32.2, -11.9, 1.52, 0.64, 0.42, by - 0.25, by + 0.44, true);

    // Low split-rail outer corner fence with wide openings toward Barn (-X) and North (+Z)
    addFenceSpan(pigpenGrp, 33.4, -15.8, 33.4, -13.2, by, true);
    addFenceSpan(pigpenGrp, 30.0, -16.2, 32.8, -16.0, by, true);

    mergeStatic(THREE, pigpenGrp);
    group.add(pigpenGrp);
  }

  // --------------------------------------------------------------------------
  // 4. Stream Duck-Pond Dressing around (15.5, 24.5) (beside Stream at (13.3, 21.8))
  // --------------------------------------------------------------------------
  const duckPondGrp = new THREE.Group();
  duckPondGrp.name = 'habitat_stream_duck_pond';
  {
    const by = groundY(15.5, 24.5);

    // Shallow sunny backwater duck-pond pool beside the stream (clear of bridge landing at (14.7, 24.0))
    const poolBank = add(duckPondGrp, new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.03, 18), stoneMat), 16.2, by + 0.015, 24.5, 0, -0.35, 0);
    poolBank.scale.set(1.08, 1, 0.82);
    poolBank.castShadow = false;
    poolBank.userData.ground = true;
    poolBank.userData.keep = true;

    const poolWater = add(duckPondGrp, new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.62, 0.03, 18), waterMat), 16.2, by + 0.028, 24.5, 0, -0.35, 0);
    poolWater.scale.set(1.06, 1, 0.80);
    poolWater.castShadow = false;
    poolWater.userData.ground = true;
    poolWater.userData.keep = true;

    // 3 Flat Mossy Stepping Stones across the sunny duck-pond edge (walkable ground, zero snag)
    const stones = [
      [15.05, 24.30, 0.42, 0.2],
      [15.75, 24.85, 0.46, 1.1],
      [16.50, 24.25, 0.40, 2.3],
    ];
    for (const [sx, sz, sr, rot] of stones) {
      const st = add(duckPondGrp, new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.92, sr, 0.13, 8), stoneMat), sx, by + 0.055, sz, 0, rot, 0);
      st.scale.set(1.12, 1, 0.90);
      st.userData.ground = true;
      st.userData.keep = true;
      const ms = add(duckPondGrp, new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.48, sr * 0.55, 0.03, 6), mossMat), sx + 0.08, by + 0.122, sz - 0.05, 0, rot, 0);
      ms.userData.noSolid = true;
    }

    // Floating Green Lilypads with Pink & Cream Lotus Blossoms (pond + stream reaches)
    const lilySpots = [
      [16.45, by + 0.048, 24.95, 0.28, lotusPink],
      [17.05, by + 0.048, 24.35, 0.25, lotusCream],
      [15.65, by + 0.048, 23.95, 0.22, null],
      [16.15, 0.215,      20.15, 0.26, lotusPink],
      [11.05, 0.215,      23.25, 0.25, lotusCream],
    ];
    for (const [lx, ly, lz, lr, blossomMat] of lilySpots) {
      const pad = add(duckPondGrp, new THREE.Mesh(new THREE.CylinderGeometry(lr, lr, 0.018, 9, 1, false, 0.25, Math.PI * 1.85), mossMat), lx, ly, lz, 0, lx * 2.1, 0);
      pad.castShadow = false;
      pad.userData.noSolid = true;
      if (blossomMat) {
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          const pet = add(duckPondGrp, new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.095, 4), blossomMat), lx + Math.cos(a) * 0.04, ly + 0.035, lz + Math.sin(a) * 0.04, 0.62, -a + Math.PI * 0.5, 0);
          pet.userData.noSolid = true;
        }
        const ctr = add(duckPondGrp, new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 3), grainMat), lx, ly + 0.038, lz);
        ctr.userData.noSolid = true;
      }
    }

    // Tall Brown Cattail Reeds in natural shoreline clusters
    const reedClusters = [
      [17.55, 25.05], [15.25, 25.60], [17.15, 23.25], [11.20, 24.25], [17.10, 20.55],
    ];
    for (const [rx, rz] of reedClusters) {
      const rby = groundY(rx, rz);
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 0.14, oz = ((k * 7) % 3 - 1) * 0.11;
        const tiltX = (k - 1) * 0.08, tiltZ = (k % 2 ? 0.07 : -0.06);
        const h = 0.88 + k * 0.11;
        const stalk = add(duckPondGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, h, 5), reedGreen), rx + ox, rby + h * 0.5, rz + oz, tiltX, 0, tiltZ);
        stalk.userData.noSolid = true;
        const head = add(duckPondGrp, new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.19, 6), cattailBrn), rx + ox - tiltZ * h * 0.42, rby + h * 0.82, rz + oz + tiltX * h * 0.42, tiltX, 0, tiltZ);
        head.userData.noSolid = true;
      }
    }

    mergeStatic(THREE, duckPondGrp);
    group.add(duckPondGrp);
  }

  group.userData.colliders = colliders;
  return {
    group,
    colliders,
    mudWallow: MUD_WALLOW_SPEC,
    habitats: {
      pasture: pastureGrp,
      coop: coopGrp,
      pigpen: pigpenGrp,
      duckPond: duckPondGrp,
    },
  };
}

// ============================================================================
// Deterministic Closed-Spline Herd Pathing + Spatial Web Audio Animal Synth
// ============================================================================

// Pre-verified obstacle-free Meadowbrook closed Catmull-Rom waypoint loops (18 animals)
const HERD_SPAWN_SPECS = [
  // 3 Cows in/around East Sunny Pasture (26..33, -1..+9)
  { id: 'mb_cow', period: 34, walkFrac: 0.56, phase: 0.10, scurryR: 0.80, pts: [[27.2, 2.2], [29.4, 4.6], [30.6, 3.3], [29.0, 1.2]] },
  { id: 'mb_cow', period: 38, walkFrac: 0.52, phase: 0.42, scurryR: 0.78, pts: [[28.5, 4.8], [29.8, 6.9], [30.6, 4.9], [29.4, 3.6]] },
  { id: 'mb_cow', period: 36, walkFrac: 0.58, phase: 0.77, scurryR: 0.80, pts: [[28.6, 1.6], [30.2, 0.4], [29.8, -0.9], [28.7, -0.7]] },

  // 3 Sheep in/around East Sunny Pasture (26..33, -1..+9)
  { id: 'mb_sheep', period: 28, walkFrac: 0.60, phase: 0.18, scurryR: 0.80, pts: [[28.2, 5.2], [29.4, 7.2], [30.4, 5.8], [29.0, 4.3]] },
  { id: 'mb_sheep', period: 31, walkFrac: 0.58, phase: 0.53, scurryR: 0.78, pts: [[29.6, 2.4], [30.8, 3.5], [30.6, 5.0], [29.4, 3.8]] },
  { id: 'mb_sheep', period: 29, walkFrac: 0.62, phase: 0.86, scurryR: 0.78, pts: [[26.2, 2.7], [27.8, 3.4], [27.6, 4.4], [26.1, 3.9]] },

  // 4 Chickens around Chicken Coop & South Barn Yard (15..22, -26..-18)
  { id: 'mb_chicken', period: 17, walkFrac: 0.64, phase: 0.08, scurryR: 0.65, pts: [[16.8, -23.9], [18.0, -23.6], [17.9, -22.3], [16.6, -22.6]] },
  { id: 'mb_chicken', period: 19, walkFrac: 0.62, phase: 0.34, scurryR: 0.68, pts: [[20.0, -22.5], [21.3, -22.6], [21.4, -21.4], [20.1, -21.3]] },
  { id: 'mb_chicken', period: 21, walkFrac: 0.66, phase: 0.61, scurryR: 0.72, pts: [[19.5, -20.8], [21.5, -20.6], [21.3, -19.2], [19.6, -19.5]] },
  { id: 'mb_chicken', period: 18, walkFrac: 0.60, phase: 0.89, scurryR: 0.64, pts: [[15.3, -23.5], [16.5, -23.1], [16.6, -21.8], [15.3, -22.1]] },

  // 3 Pigs in/around Muddy Pigpen & Wallow (28..33, -16..-11)
  { id: 'mb_pig', period: 26, walkFrac: 0.56, phase: 0.14, scurryR: 0.75, pts: [[29.4, -14.0], [30.8, -14.3], [31.3, -13.2], [30.0, -12.8]] },
  { id: 'mb_pig', period: 29, walkFrac: 0.58, phase: 0.48, scurryR: 0.74, pts: [[29.6, -12.4], [30.9, -12.8], [30.7, -11.4], [29.4, -11.3]] },
  { id: 'mb_pig', period: 27, walkFrac: 0.60, phase: 0.79, scurryR: 0.75, pts: [[28.3, -15.0], [29.7, -15.1], [30.0, -14.0], [28.5, -13.8]] },

  // 3 Ducks waddling & gliding along Stream & Duck Pond (11..17, 20..25), clear of bridge at (13.3, 21.7)
  { id: 'mb_duck', period: 22, walkFrac: 0.72, phase: 0.12, scurryR: 0.68, pts: [[14.9, 20.8], [16.1, 20.1], [16.9, 20.5], [15.7, 21.3]] },
  { id: 'mb_duck', period: 20, walkFrac: 0.68, phase: 0.47, scurryR: 0.66, pts: [[15.3, 24.1], [16.5, 24.8], [16.9, 23.9], [15.8, 23.5]] },
  { id: 'mb_duck', period: 23, walkFrac: 0.70, phase: 0.81, scurryR: 0.66, pts: [[11.1, 23.2], [12.1, 22.6], [12.3, 23.7], [11.3, 24.3]] },

  // 1 Friendly Shepherd Dog trotting along the Plaza/Bakery/Cellar path (clear of STAIR_EAST z = -10.6..-7.0)
  { id: 'mb_dog', period: 24, walkFrac: 0.74, phase: 0.25, scurryR: 0.95, pts: [[8.6, -3.2], [12.6, -2.6], [14.4, -4.9], [10.4, -5.5]] },

  // 1 Cozy Ginger Cat patrolling/lounging near Bakery & Hero Cottage porches (10..17, +2..+12)
  { id: 'mb_cat', period: 27, walkFrac: 0.62, phase: 0.63, scurryR: 0.82, pts: [[10.6, 3.2], [13.6, 5.2], [13.2, 9.1], [10.8, 7.4]] },
];

// Maximum 3 Unique One-of-a-Kind Legendary Magical Birds (1 Large + 1 Larger + 1 Huge):
//  1. LARGE  (1.42m tall, ~2.90m wingspan): Starlight Owl-Griffin (`mb_heron`) — perched on West Meadow
//  2. LARGER (1.96m tall, ~4.25m wingspan): Sun-Plume Sky-Phoenix (`mb_stork`) — perched on South-East Green
//  3. HUGE   (2.72m tall, ~5.90m wingspan): Colossal Cloud-Roc    (`mb_roc`)   — opening sky glide, lands on North Lawn
const FLYING_BIRD_SPECS = [
  { id: 'mb_heron', perchDur: 24.0, flightDur: 9.6,  peakY: 10.0, startFlying: false, perches: [[-10.4, 0, 10.6], [15.0, 0, 22.6], [-19.2, 0, 8.8]] },
  { id: 'mb_stork', perchDur: 26.0, flightDur: 10.5, peakY: 11.6, startFlying: false, perches: [[6.4, 0, 9.2], [-15.8, 0, 12.6], [24.4, 0, 3.5]] },
  { id: 'mb_roc',   perchDur: 28.0, flightDur: 12.0, peakY: 13.8, startFlying: true,  perches: [[-17.2, 0, -5.2], [-4.2, 0, -12.4], [13.4, 0, 17.4]] },
];

export function playWingFlapSound(audioApi, intensity = 1.0, pitchScale = 1.0) {
  try {
    if (!audioApi || audioApi.isMuted?.()) return false;
    const ac = audioApi.getContext?.();
    const out = audioApi.getSfxBus?.() || ac?.destination;
    if (!ac || !out || ac.state !== 'running') return false;
    const t0 = ac.currentTime + 0.005;
    const pMul = clamp(pitchScale, 0.55, 1.6);
    const dur = clamp(0.20 / Math.sqrt(pMul), 0.16, 0.30);
    const len = Math.max(256, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(260 * pMul, t0);
    flt.frequency.exponentialRampToValueAtTime(580 * pMul, t0 + dur * 0.45);
    flt.frequency.exponentialRampToValueAtTime(190 * pMul, t0 + dur);
    flt.Q.value = 1.1;
    const g = ac.createGain();
    const pk = clamp(0.11 * intensity, 0.02, 0.24);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(pk, t0 + 0.045);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(out);
    src.start(t0);
    src.stop(t0 + dur + 0.02);

    // Subtle Storybook starlight / thunder chime shimmer scaled to bird size
    const chime = ac.createOscillator();
    const cg = ac.createGain();
    chime.type = pMul < 0.8 ? 'triangle' : 'sine';
    chime.frequency.setValueAtTime(1046.5 * pMul, t0 + 0.01);
    chime.frequency.exponentialRampToValueAtTime(1568.0 * pMul, t0 + 0.17);
    cg.gain.setValueAtTime(0.0001, t0 + 0.01);
    cg.gain.linearRampToValueAtTime(clamp(0.022 * intensity, 0.004, 0.04), t0 + 0.04);
    cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
    chime.connect(cg);
    cg.connect(out);
    chime.start(t0 + 0.01);
    chime.stop(t0 + 0.21);
    return true;
  } catch (e) {
    return false;
  }
}

function catmullRom1D(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function catmullRomDeriv1D(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return 0.5 * (
    (-p0 + p2) +
    2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
    3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  );
}

function evalClosedSpline(pts, sNorm) {
  const n = pts.length;
  const u = (((sNorm % 1) + 1) % 1) * n;
  const i1 = Math.floor(u) % n;
  const f = u - Math.floor(u);
  const i0 = (i1 + n - 1) % n;
  const i2 = (i1 + 1) % n;
  const i3 = (i1 + 2) % n;
  const x = catmullRom1D(pts[i0][0], pts[i1][0], pts[i2][0], pts[i3][0], f);
  const z = catmullRom1D(pts[i0][1], pts[i1][1], pts[i2][1], pts[i3][1], f);
  const tx = catmullRomDeriv1D(pts[i0][0], pts[i1][0], pts[i2][0], pts[i3][0], f);
  const tz = catmullRomDeriv1D(pts[i0][1], pts[i1][1], pts[i2][1], pts[i3][1], f);
  return { x, z, tx, tz };
}

// Pure deterministic spline parameter s(t) with smooth pause-to-graze plateaus
function evalDeterministicLoopParam(simTimeSec, spec) {
  const n = spec.pts.length;
  const total = ((simTimeSec / spec.period + spec.phase) % 1 + 1) % 1;
  const segU = total * n;
  const segIdx = Math.floor(segU);
  const local = segU - segIdx;
  if (local < spec.walkFrac) {
    const w = local / spec.walkFrac;
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * w);
    const dEasedDt = (0.5 * Math.PI * Math.sin(Math.PI * w)) / (spec.walkFrac * (spec.period / n));
    return { s: (segIdx + eased) / n, dsDt: dEasedDt / n };
  }
  return { s: (segIdx + 1) / n, dsDt: 0 };
}

// Check if a duck is floating in the Meadowbrook stream channel (13.33, 21.74, rot = 0.55)
function streamWaterSurfaceY(x, z) {
  const sx = Math.sin(0.55) * 25.5;
  const sz = Math.cos(0.55) * 25.5;
  const dx = x - sx, dz = z - sz;
  const c = Math.cos(0.55), s = Math.sin(0.55);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  if (Math.abs(lx) < 7.8 && Math.abs(lz) < 0.88) return 0.16;
  const pdx = x - 16.2, pdz = z - 24.5;
  if (pdx * pdx * 0.35 + pdz * pdz * 0.55 < 1.0) return 0.03;
  return -Infinity;
}

export function createMeadowAnimalsSystem(THREE, env = {}) {
  const builders = buildAnimalPropBuilders(THREE);
  const defById = Object.fromEntries(ANIMAL_PROP_DEFS.map((d) => [d.id, d]));
  const animals = [];

  let stampedeStartSec = -9999;
  const STAMPEDE_DURATION = 5.0;
  let lastSimSec = 0;
  let fallbackClock = 0;
  let nextAmbientCallSec = 2.4;
  let ambientRng = 24681357;
  let activeSoundVoices = 0;

  const nextRand = () => {
    ambientRng = (ambientRng * 16807) % 2147483647;
    return (ambientRng - 1) / 2147483646;
  };

  // --------------------------------------------------------------------------
  // Procedural Spatial Web Audio Animal Calls (warm, gentle, non-annoying)
  // --------------------------------------------------------------------------
  function playAnimalCall(kind, dist = 4, pan = 0, pitchMul = 1.0) {
    const maxDist = pitchMul > 1.05 ? 28 : 20;
    if (dist > maxDist || activeSoundVoices >= 10) return false;
    if (env.audio?.isMuted?.()) return false;
    const ac = env.audio?.getContext?.();
    const sfxBus = env.audio?.getSfxBus?.();
    if (!ac || !sfxBus || ac.state !== 'running') return false;

    const att = Math.pow(clamp(1 - dist / maxDist, 0, 1), 1.6);
    if (att < 0.025) return false;

    const id = kind.startsWith('mb_') ? kind.slice(3) : kind;
    const t0 = ac.currentTime + 0.005;

    let outBus = sfxBus;
    if (typeof ac.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
      const panner = ac.createStereoPanner();
      panner.pan.setValueAtTime(clamp(pan, -0.85, 0.85), t0);
      panner.connect(sfxBus);
      outBus = panner;
    }

    const voice = (startOff, dur, oscType, f0, f1, fEnd, filtType, cut0, cut1, q, peakGain, vibHz = 0, vibDepth = 0) => {
      activeSoundVoices++;
      const st = t0 + startOff;
      const osc = ac.createOscillator();
      const flt = ac.createBiquadFilter();
      const g = ac.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(f0 * pitchMul, st);
      osc.frequency.linearRampToValueAtTime(f1 * pitchMul, st + dur * 0.42);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, fEnd * pitchMul), st + dur);

      let lfo = null;
      if (vibHz > 0 && vibDepth > 0) {
        lfo = ac.createOscillator();
        const lg = ac.createGain();
        lfo.frequency.value = vibHz;
        lg.gain.value = vibDepth;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(st);
        lfo.stop(st + dur + 0.02);
      }

      flt.type = filtType;
      flt.frequency.setValueAtTime(cut0, st);
      flt.frequency.exponentialRampToValueAtTime(Math.max(80, cut1), st + dur);
      flt.Q.value = q;

      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(peakGain * att, st + Math.min(0.04, dur * 0.22));
      g.gain.setValueAtTime(peakGain * att * 0.85, st + dur * 0.62);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);

      osc.connect(flt);
      flt.connect(g);
      g.connect(outBus);
      osc.start(st);
      osc.stop(st + dur + 0.03);
      osc.onended = () => {
        activeSoundVoices = Math.max(0, activeSoundVoices - 1);
        try { g.disconnect(); } catch (e) { /* ignore */ }
      };
    };

    if (id === 'cow') {
      voice(0, 0.66, 'sawtooth', 124, 140, 112, 'lowpass', 540, 390, 2.2, 0.078, 5.2, 3.5);
      voice(0.02, 0.62, 'triangle', 248, 276, 224, 'bandpass', 680, 520, 1.8, 0.035);
    } else if (id === 'chicken') {
      voice(0, 0.058, 'triangle', 380, 310, 260, 'bandpass', 1050, 820, 3.0, 0.072);
      voice(0.095, 0.062, 'triangle', 410, 330, 275, 'bandpass', 1120, 860, 3.0, 0.068);
      if (pitchMul > 1.04 || nextRand() < 0.45) {
        voice(0.19, 0.16, 'sawtooth', 360, 590, 420, 'bandpass', 1350, 920, 2.6, 0.064, 16, 12);
      }
    } else if (id === 'pig') {
      voice(0, 0.115, 'sawtooth', 102, 156, 92, 'bandpass', 480, 360, 3.2, 0.080, 28, 14);
      voice(0.145, 0.125, 'sawtooth', 110, 168, 96, 'bandpass', 520, 380, 3.2, 0.076, 28, 14);
    } else if (id === 'sheep') {
      voice(0, 0.44, 'sawtooth', 246, 236, 212, 'bandpass', 920, 740, 2.0, 0.068, 14.5, 11);
    } else if (id === 'duck') {
      voice(0, 0.115, 'sawtooth', 290, 245, 205, 'bandpass', 1420, 780, 3.6, 0.070);
      voice(0.145, 0.13, 'sawtooth', 278, 235, 198, 'bandpass', 1360, 740, 3.6, 0.066);
    } else if (id === 'dog') {
      voice(0, 0.125, 'sawtooth', 215, 335, 175, 'lowpass', 1320, 580, 1.6, 0.082);
      if (pitchMul > 1.04 || nextRand() < 0.5) {
        voice(0.16, 0.135, 'sawtooth', 230, 355, 185, 'lowpass', 1380, 620, 1.6, 0.076);
      }
    } else if (id === 'cat') {
      voice(0, 0.36, 'triangle', 430, 650, 470, 'lowpass', 1750, 1150, 1.4, 0.072, 16, 6);
    } else if (id === 'heron') {
      // Mystical Starlight Owl-Griffin warm resonant "hoo-hoo~" + twinkling starlight bell!
      voice(0, 0.20, 'sine', 392.0, 440.0, 349.2, 'lowpass', 1100, 780, 1.6, 0.072, 5.2, 5);
      voice(0.24, 0.30, 'sine', 392.0, 349.2, 293.7, 'lowpass', 1050, 680, 1.6, 0.068, 5.0, 5);
      voice(0.12, 0.22, 'triangle', 1174.7, 1568.0, 1318.5, 'bandpass', 2200, 1750, 2.0, 0.028);
    } else if (id === 'stork') {
      // Melodic Storybook Sun-Plume Sky-Phoenix harmonic flute song + starlight chime
      voice(0, 0.26, 'triangle', 587.3, 880.0, 784.0, 'lowpass', 2400, 1650, 1.4, 0.068, 6.2, 8);
      voice(0.08, 0.30, 'sine', 1174.7, 1568.0, 1318.5, 'bandpass', 2200, 1800, 1.8, 0.042, 7.0, 10);
    } else if (id === 'roc') {
      // Majestic Colossal Cloud-Roc deep eagle-thunderbird cry + resonant harmonic brass!
      voice(0, 0.42, 'sawtooth', 293.7, 440.0, 246.9, 'bandpass', 1280, 680, 2.2, 0.076, 8.5, 9);
      voice(0.04, 0.44, 'triangle', 146.8, 220.0, 130.8, 'lowpass', 640, 380, 1.6, 0.062);
    }
    return true;
  }

  // Evaluate pure deterministic (x, z, rotY, moving, speed, startled) at simTimeSec
  function evalAnimalState(a, simTimeSec) {
    const spec = a.spec;
    const { s, dsDt } = evalDeterministicLoopParam(simTimeSec, spec);
    const base = evalClosedSpline(spec.pts, s);
    const baseTanLen = Math.hypot(base.tx, base.tz) || 1;
    let vx = base.tx * spec.pts.length * dsDt;
    let vz = base.tz * spec.pts.length * dsDt;
    let x = base.x;
    let z = base.z;

    const stampElapsed = simTimeSec - stampedeStartSec;
    const inStampede = stampElapsed >= 0 && stampElapsed < STAMPEDE_DURATION;

    if (inStampede) {
      const wIn = smooth01(stampElapsed / 0.35);
      const wOut = 1 - smooth01((stampElapsed - (STAMPEDE_DURATION - 0.85)) / 0.85);
      const envW = wIn * wOut;
      const calmRefSpeed = 0.85 * (defById[spec.id]?.speed || 1.0);
      const scurrySpd = calmRefSpeed * 2.8;
      const omega = (scurrySpd / spec.scurryR) * a.scurryDir;
      const ang = a.seedPhase * 2.7 + stampElapsed * omega;
      x += Math.cos(ang) * spec.scurryR * envW;
      z += Math.sin(ang) * spec.scurryR * envW;
      vx += -Math.sin(ang) * spec.scurryR * omega * envW;
      vz +=  Math.cos(ang) * spec.scurryR * omega * envW;
    }

    const speed = Math.hypot(vx, vz);
    const moving = speed > 0.25;
    // Pure deterministic C1-smooth heading: spline tangent while calm, blended smoothly with scurry velocity
    const baseDx = base.tx / baseTanLen;
    const baseDz = base.tz / baseTanLen;
    const velW = smooth01(speed / 0.30);
    const dirX = lerp(baseDx, speed > 1e-5 ? vx / speed : baseDx, velW);
    const dirZ = lerp(baseDz, speed > 1e-5 ? vz / speed : baseDz, velW);
    const rotY = Math.atan2(dirX, dirZ);
    const startled = inStampede || simTimeSec < a.localStartledUntil;

    return { x, z, rotY, moving, speed, startled };
  }

  // Spawn all 18 NPC animals and register into realProps, blockers, and solids
  HERD_SPAWN_SPECS.forEach((spec, idx) => {
    const def = defById[spec.id];
    const build = builders[spec.id];
    if (!def || !build) return;

    const g = build();
    const detSeed = ((idx + 1) * 2.399963) % (Math.PI * 2);
    attachAnimalAnimator(g, spec.id, detSeed);

    const a = {
      index: idx,
      id: spec.id,
      spec,
      g,
      def,
      seedPhase: detSeed,
      scurryDir: idx % 2 === 0 ? 1 : -1,
      localStartledUntil: -9999,
      lastCallSec: -9999,
      rec: null,
    };

    const init = evalAnimalState(a, 0);
    let gy = env.getGroundY ? env.getGroundY(init.x, init.z) : 0;
    if (spec.id === 'mb_duck') gy = Math.max(gy, streamWaterSurfaceY(init.x, init.z));

    g.position.set(init.x, gy, init.z);
    g.rotation.y = init.rotY;
    if (env.mapRoot) env.mapRoot.add(g);

    const r = def.radius;
    const ph = def.height;
    const half = r * 0.78;
    const ownBox = {
      x0: init.x - half,
      x1: init.x + half,
      z0: init.z - half,
      z1: init.z + half,
      y: gy,
      y0: gy - 0.25,
      y1: gy + ph,
      standable: ph <= 1.25,
      isProp: true,
    };
    if (env.blockers) env.blockers.push(ownBox);

    const rec = {
      g,
      id: spec.id,
      pos: g.position,
      radius: r,
      height: ph,
      ownBox,
      homeX: init.x,
      homeY: gy,
      homeZ: init.z,
      homeRotY: init.rotY,
      isAnimal: true,
      onStartled: (nowSec) => onAnimalStartled(rec, nowSec),
    };
    a.rec = rec;
    g.userData.animalRec = rec;

    g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.propRoot = rec;
        if (env.solids) env.solids.push(m);
      }
    });

    if (env.realProps) env.realProps.push(rec);
    animals.push(a);
  });

  // Spawn 6 Wild Flying Birds (4 Great Village Storks + 2 Crested Sky-Herons) that perch & fly away across the sky!
  const flyingBirds = [];
  const resolvePerchY = (p) => {
    if (p[1] > 0.5) return p[1];
    return env.getGroundY ? env.getGroundY(p[0], p[2], 0) : 0;
  };

  FLYING_BIRD_SPECS.forEach((spec, idx) => {
    const def = defById[spec.id];
    const build = builders[spec.id];
    if (!def || !build) return;

    const g = build();
    const detSeed = ((idx + 19) * 2.399963) % (Math.PI * 2);
    attachAnimalAnimator(g, spec.id, detSeed);

    const p0 = spec.perches[0];
    const p1 = spec.perches[1 % spec.perches.length];
    const initY = resolvePerchY(p0);
    const initRot = Math.atan2(p1[0] - p0[0], p1[2] - p0[2]);

    const b = {
      index: HERD_SPAWN_SPECS.length + idx,
      id: spec.id,
      spec,
      g,
      def,
      isFlyingBird: true,
      seedPhase: detSeed,
      curPerchIdx: 0,
      nextPerchIdx: 1 % spec.perches.length,
      flightActive: !!spec.startFlying,
      flightT: spec.startFlying ? (0.18 + idx * 0.11) % 0.72 : 0,
      flightDur: spec.flightDur,
      peakY: spec.peakY,
      startleBoost: false,
      shotDown: false,
      perchedSinceSec: 0,
      nextAutoTakeoffSec: spec.perchDur * (0.45 + (idx % 3) * 0.25),
      fromPos: { x: p0[0], y: initY, z: p0[2] },
      toPos: { x: p1[0], y: resolvePerchY(p1), z: p1[2] },
      ctrlPos: { x: (p0[0] + p1[0]) * 0.22, z: (p0[2] + p1[2]) * 0.22 },
      prevY: initY,
      prevRotY: initRot,
      localStartledUntil: -9999,
      lastCallSec: -9999,
      rec: null,
    };

    g.position.set(p0[0], initY, p0[2]);
    g.rotation.y = initRot;
    if (env.mapRoot) env.mapRoot.add(g);

    const r = def.radius;
    const ph = def.height;
    const half = r * 0.78;
    const ownBox = {
      x0: p0[0] - half,
      x1: p0[0] + half,
      z0: p0[2] - half,
      z1: p0[2] + half,
      y: initY,
      y0: initY - 0.20,
      y1: initY + ph,
      standable: true,
      isProp: true,
    };
    if (env.blockers) env.blockers.push(ownBox);

    const rec = {
      g,
      id: spec.id,
      pos: g.position,
      radius: r,
      height: ph,
      ownBox,
      homeX: p0[0],
      homeY: initY,
      homeZ: p0[2],
      homeRotY: initRot,
      isAnimal: true,
      isFlyingBird: true,
      isWildFlyingBird: true,
      onStartled: (nowSec, listenerPos) => startleBird(b, nowSec, listenerPos),
      onTurretHit: (nowSec, listenerPos) => {
        b.shotDown = true;
        b.localStartledUntil = Math.max(b.localStartledUntil, (Number.isFinite(nowSec) ? nowSec : lastSimSec) + 1.8);
        const dist = listenerPos && Number.isFinite(listenerPos.x)
          ? Math.hypot(b.g.position.x - listenerPos.x, b.g.position.z - listenerPos.z)
          : 8;
        playAnimalCall(b.id, dist, 0, 1.22);
      },
    };
    b.rec = rec;
    g.userData.animalRec = rec;

    g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.propRoot = rec;
        if (env.solids) env.solids.push(m);
      }
    });

    if (env.realProps) env.realProps.push(rec);
    animals.push(b);
    flyingBirds.push(b);
  });

  function launchBirdFlight(b, nowSec, startled = false, awayFrom = null) {
    if (b.flightActive) {
      if (startled) b.startleBoost = true;
      return true;
    }
    const perches = b.spec.perches;
    let bestIdx = (b.curPerchIdx + 1) % perches.length;
    if (awayFrom && Number.isFinite(awayFrom.x)) {
      let bestDist = -1;
      for (let k = 0; k < perches.length; k++) {
        if (k === b.curPerchIdx) continue;
        const d = Math.hypot(perches[k][0] - awayFrom.x, perches[k][2] - awayFrom.z);
        if (d > bestDist) {
          bestDist = d;
          bestIdx = k;
        }
      }
    }
    const dest = perches[bestIdx];
    const destY = resolvePerchY(dest);
    b.fromPos = { x: b.g.position.x, y: b.g.position.y, z: b.g.position.z };
    b.toPos = { x: dest[0], y: destY, z: dest[2] };
    // Curve scenic flight arc over the central Village Plaza so Sky-Turret gunners see birds overhead!
    b.ctrlPos = {
      x: (b.fromPos.x + b.toPos.x) * 0.20 + Math.sin(b.seedPhase) * 3.2,
      z: (b.fromPos.z + b.toPos.z) * 0.20 + Math.cos(b.seedPhase) * 3.2,
    };
    b.nextPerchIdx = bestIdx;
    b.flightActive = true;
    b.flightT = 0;
    b.shotDown = false;
    b.startleBoost = !!startled;
    b.flightDur = startled ? b.spec.flightDur * 0.82 : b.spec.flightDur;
    b.peakY = startled ? b.spec.peakY + 1.3 : b.spec.peakY;
    b.localStartledUntil = Math.max(b.localStartledUntil, nowSec + (startled ? 1.8 : 0.6));
    return true;
  }

  function startleBird(birdOrRec, nowSimSec = lastSimSec, listenerPos = null) {
    const b = flyingBirds.find((item) => item === birdOrRec || item.rec === birdOrRec || item.g === birdOrRec);
    if (!b) return false;
    const t = Number.isFinite(nowSimSec) ? nowSimSec : lastSimSec;
    const wasPerched = !b.flightActive;
    launchBirdFlight(b, t, true, listenerPos);
    const dist = listenerPos && Number.isFinite(listenerPos.x)
      ? Math.hypot(b.g.position.x - listenerPos.x, b.g.position.z - listenerPos.z)
      : 6;
    if (wasPerched || t - b.lastCallSec > 1.2) {
      playAnimalCall(b.id, dist, 0, 1.18);
      const flapPitch = b.id === 'mb_roc' ? 0.68 : (b.id === 'mb_heron' ? 1.24 : 1.0);
      if (dist < 18) playWingFlapSound(env.audio, clamp(1 - dist / 18, 0.25, 1.0), flapPitch);
      b.lastCallSec = t;
    }
    return true;
  }

  function onAnimalStartled(recOrAnimal, nowSimSec = lastSimSec, listenerPos = null) {
    const a = animals.find((item) => item === recOrAnimal || item.rec === recOrAnimal || item.g === recOrAnimal);
    if (!a) return false;
    if (a.isFlyingBird) {
      return startleBird(a, nowSimSec, listenerPos);
    }
    const t = Number.isFinite(nowSimSec) ? nowSimSec : lastSimSec;
    a.localStartledUntil = Math.max(a.localStartledUntil, t + 1.45);
    const dist = listenerPos && Number.isFinite(listenerPos.x)
      ? Math.hypot(a.g.position.x - listenerPos.x, a.g.position.z - listenerPos.z)
      : 5;
    playAnimalCall(a.id, dist, 0, 1.15);
    return true;
  }

  function triggerStampede(nowSimSec, listenerPos = null) {
    const startT = Number.isFinite(nowSimSec) ? nowSimSec : lastSimSec;
    stampedeStartSec = startT;
    // Startle perched large birds into taking flight across the sky!
    for (const b of flyingBirds) {
      if (!b.flightActive) startleBird(b, startT, listenerPos);
    }
    // Joyful staggered barnyard chorus across distinct species
    const seen = new Set();
    let delayIdx = 0;
    for (const a of animals) {
      if (seen.has(a.id) || delayIdx >= 6) continue;
      seen.add(a.id);
      const d = listenerPos && Number.isFinite(listenerPos.x)
        ? Math.hypot(a.g.position.x - listenerPos.x, a.g.position.z - listenerPos.z)
        : 7;
      const delayMs = delayIdx * 95;
      delayIdx++;
      if (typeof setTimeout === 'function') {
        setTimeout(() => playAnimalCall(a.id, Math.min(d, 18), 0, 1.16), delayMs);
      } else {
        playAnimalCall(a.id, Math.min(d, 18), 0, 1.16);
      }
    }
    return stampedeStartSec + STAMPEDE_DURATION;
  }

  function update(dt, simTimeSec, listenerPos) {
    const cdt = clamp(Number.isFinite(dt) ? dt : 0.016, 0, 0.1);
    fallbackClock += cdt;
    const t = Number.isFinite(simTimeSec) ? simTimeSec : fallbackClock;
    lastSimSec = t;

    const hasListener = Boolean(listenerPos && Number.isFinite(listenerPos.x) && Number.isFinite(listenerPos.z));
    const liveActors = typeof env.getActors === 'function' ? env.getActors() : null;

    for (let i = 0; i < animals.length; i++) {
      const a = animals[i];
      if (a.isFlyingBird) {
        const rec = a.rec;
        const box = rec.ownBox;

        // Check proximity startle while perched (sprinting/jumping within 4.2m or walking right into < 2.0m)
        if (!a.flightActive && t - a.perchedSinceSec > 1.4) {
          let spookSource = null;
          if (Array.isArray(liveActors)) {
            for (let k = 0; k < liveActors.length; k++) {
              const act = liveActors[k];
              if (!act || act.eliminated || !act.ch) continue;
              const ch = act.ch;
              const u = ch.userData || {};
              // Fellow disguised flying birds can perch peacefully beside wild birds!
              if (u.propId && defById[u.propId]?.canFly) continue;
              const ay = (u.groundY ?? ch.position.y ?? 0) + (u.jy || 0);
              if (Math.abs(ay - a.g.position.y) > 2.6) continue;
              const d = Math.hypot(ch.position.x - a.g.position.x, ch.position.z - a.g.position.z);
              const closeSpookR = act.team === 'seekers' ? 2.15 : 1.05;
              const jumpingOrFast = (u.jy || 0) > 0.12 || Math.abs(u.vy || 0) > 0.5 || (u.spd || 0) > 5.8;
              if (d < closeSpookR || (jumpingOrFast && d < 4.35)) {
                spookSource = ch.position;
                break;
              }
            }
          } else if (hasListener) {
            const d = Math.hypot(listenerPos.x - a.g.position.x, listenerPos.z - a.g.position.z);
            if (d < 2.1) spookSource = listenerPos;
          }

          if (spookSource) {
            startleBird(a, t, spookSource);
          } else if (t >= a.nextAutoTakeoffSec) {
            launchBirdFlight(a, t, false, null);
          }
        }

        let x = a.g.position.x;
        let y = a.g.position.y;
        let z = a.g.position.z;
        let rotY = a.g.rotation.y;
        let vy = 0;
        let bankRoll = 0;
        let airborne = false;
        let speed = 0;

        if (a.flightActive) {
          const rateMul = a.shotDown ? 2.4 : 1.0;
          a.flightT += (cdt / Math.max(3.5, a.flightDur)) * rateMul;
          if (a.flightT >= 1.0) {
            a.flightActive = false;
            a.flightT = 0;
            a.shotDown = false;
            a.startleBoost = false;
            a.curPerchIdx = a.nextPerchIdx;
            a.perchedSinceSec = t;
            a.nextAutoTakeoffSec = t + a.spec.perchDur * (0.85 + ((a.index % 4) * 0.12));
            x = a.toPos.x;
            y = a.toPos.y;
            z = a.toPos.z;
          } else {
            airborne = true;
            const u = clamp(a.flightT, 0, 1);
            const s = smooth01(u);
            const om = 1 - s;
            x = om * om * a.fromPos.x + 2 * om * s * a.ctrlPos.x + s * s * a.toPos.x;
            z = om * om * a.fromPos.z + 2 * om * s * a.ctrlPos.z + s * s * a.toPos.z;
            // Derivative for smooth flight tangent heading
            const dxDs = 2 * om * (a.ctrlPos.x - a.fromPos.x) + 2 * s * (a.toPos.x - a.ctrlPos.x);
            const dzDs = 2 * om * (a.ctrlPos.z - a.fromPos.z) + 2 * s * (a.toPos.z - a.ctrlPos.z);
            if (Math.hypot(dxDs, dzDs) > 1e-4) {
              rotY = Math.atan2(dxDs, dzDs);
            }
            const baseY = lerp(a.fromPos.y, a.toPos.y, s);
            const arc = Math.sin(Math.PI * Math.pow(u, 0.84)) * Math.max(2.5, a.peakY - Math.max(a.fromPos.y, a.toPos.y));
            y = baseY + (a.shotDown ? arc * (1 - u) * 0.45 : arc);
            vy = (y - a.prevY) / Math.max(0.004, cdt);
            speed = Math.hypot(dxDs, dzDs) / Math.max(3.5, a.flightDur);
            let dYaw = rotY - a.prevRotY;
            while (dYaw > Math.PI) dYaw -= Math.PI * 2;
            while (dYaw < -Math.PI) dYaw += Math.PI * 2;
            bankRoll = clamp((dYaw / Math.max(0.004, cdt)) * 0.32, -0.40, 0.40);
          }
        } else {
          const perch = a.spec.perches[a.curPerchIdx];
          x = perch[0];
          y = resolvePerchY(perch);
          z = perch[2];
        }

        a.prevY = y;
        a.prevRotY = rotY;
        a.g.position.set(x, y, z);
        a.g.rotation.y = rotY;

        const half = rec.radius * 0.78;
        env.blockers?.markMoved?.(box);
        box.x0 = x - half;
        box.x1 = x + half;
        box.z0 = z - half;
        box.z1 = z + half;
        box.y = y;
        box.y0 = y - 0.15;
        box.y1 = y + rec.height;

        rec.homeX = x;
        rec.homeY = y;
        rec.homeZ = z;
        rec.homeRotY = rotY;

        if (a.g.userData.animateAnimal) {
          const isStartled = t < a.localStartledUntil;
          a.g.userData.animateAnimal(cdt, airborne, speed, t, isStartled, airborne, vy, bankRoll);
        }
        continue;
      }

      const st = evalAnimalState(a, t);
      const rec = a.rec;
      const box = rec.ownBox;

      let gy = env.getGroundY ? env.getGroundY(st.x, st.z) : 0;
      if (a.id === 'mb_duck') {
        const wy = streamWaterSurfaceY(st.x, st.z);
        if (wy > gy) gy = wy + Math.sin(t * 2.5 + a.seedPhase) * 0.01;
      }

      a.g.position.set(st.x, gy, st.z);
      a.g.rotation.y = st.rotY;

      // Keep ownBox & home coordinates synchronized with the moving NPC animal every frame
      const half = rec.radius * 0.78;
      env.blockers?.markMoved?.(box);
      box.x0 = st.x - half;
      box.x1 = st.x + half;
      box.z0 = st.z - half;
      box.z1 = st.z + half;
      box.y = gy;
      box.y0 = gy - 0.25;
      box.y1 = gy + rec.height;

      rec.homeX = st.x;
      rec.homeY = gy;
      rec.homeZ = st.z;
      rec.homeRotY = st.rotY;

      if (a.g.userData.animateAnimal) {
        a.g.userData.animateAnimal(cdt, st.moving, st.speed, t, st.startled);
      }
    }

    // Gentle spatial countryside ambience when listener is within 20m
    if (hasListener && t >= nextAmbientCallSec) {
      nextAmbientCallSec = t + 3.8 + nextRand() * 3.8;
      const nearby = [];
      for (let i = 0; i < animals.length; i++) {
        const a = animals[i];
        if (t - a.lastCallSec < 7.5) continue;
        const d = Math.hypot(a.g.position.x - listenerPos.x, a.g.position.z - listenerPos.z);
        if (d <= 22) nearby.push({ a, d });
      }
      if (nearby.length) {
        const pickIdx = Math.floor(nextRand() * nearby.length);
        const chosen = nearby[pickIdx];
        const pan = clamp((chosen.a.g.position.x - listenerPos.x) / 14, -0.75, 0.75);
        if (playAnimalCall(chosen.a.id, chosen.d, pan, 0.96 + nextRand() * 0.08)) {
          chosen.a.lastCallSec = t;
        }
      }
    }
  }

  function dispose() {
    for (const a of animals) {
      if (a.g.parent) a.g.parent.remove(a.g);
      if (env.blockers) {
        const bi = env.blockers.indexOf(a.rec.ownBox);
        if (bi >= 0) env.blockers.splice(bi, 1);
      }
      if (env.realProps) {
        const ri = env.realProps.indexOf(a.rec);
        if (ri >= 0) env.realProps.splice(ri, 1);
      }
      if (env.solids) {
        a.g.traverse((m) => {
          if (!m.isMesh) return;
          const si = env.solids.indexOf(m);
          if (si >= 0) env.solids.splice(si, 1);
        });
      }
    }
    animals.length = 0;
    flyingBirds.length = 0;
  }

  return {
    animals,
    flyingBirds,
    update,
    triggerStampede,
    onAnimalStartled,
    startleBird,
    playAnimalCall,
    playWingFlapSound,
    isInMudWallow,
    isStampeding: (simSec = lastSimSec) => simSec >= stampedeStartSec && simSec < stampedeStartSec + STAMPEDE_DURATION,
    dispose,
  };
}
