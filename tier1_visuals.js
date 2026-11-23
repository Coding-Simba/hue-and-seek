/* ==========================================================================
 * Hue & Seek — Tier 1 Stylized Visuals Suite (`tier1_visuals.js`)
 *
 * Mobile-60fps stylized rendering upgrades (pure ES module, zero external deps):
 *   1. Fluffy Stylized Tree Canopies — procedural 128x128 5-leaf botanical
 *      alpha-cutout atlas draped in 1 single InstancedMesh with Spherical
 *      Normal Transfer, Soft 2-Band Painterly Lighting, Backlit Rim
 *      Translucency, & GPU Vertex Wind Rustle.
 *   2. Baked Procedural Vertex Ambient Occlusion (`bakeProceduralVertexAO`) +
 *      Zero-Pass Ground-Contact Crevice AO & 2-Band Shadow Ramp GLSL block
 *      (`GROUND_AO_AND_RAMP_GLSL`) for `painterly_gfx.js`.
 *   3. Selective Stylized Ink-Edge Outlines — shared distance-adaptive
 *      warm-sepia/indigo inverted-hull shader for Spirits, Seekers & hero
 *      disguised props (`attachHeroOutlines` / `removeHeroOutlines` /
 *      `setOutlineScale`).
 *   4. Sparkling Stylized Water Shader (`enhanceWorldWater`) — gentle GPU
 *      vertex wave undulation, dual-layer Voronoi + interference caustics,
 *      organic shoreline/edge foam bands, Fresnel sky reflection & sun glints.
 *   5. Interactive Player-Bending Grass (`grassBenderUniforms`,
 *      `updateGrassBenders`, `GRASS_BEND_VERTEX_GLSL`) — 6 closest living
 *      characters part grass blades radially in real time!
 * ========================================================================== */

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function linearToSrgb(c) {
  const x = c < 0 ? 0 : c > 1 ? 1 : c;
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function rgbToHsl(r, g, b) {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  const l = (max + min) * 0.5;
  const d = max - min;
  if (d < 1e-5) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60) % 360, s, l };
}

/**
 * Per-world stylized foliage & water palettes for all 6 Hue & Seek worlds.
 */
export const WORLD_FOLIAGE_PALETTES = {
  meadow: {
    colors: [0x4c9643, 0x6ab44b, 0x8cc952, 0x3b7c3c, 0xa8d65d],
    sunTint: 0xffe88c,
    shadowTint: 0x365b73,
    mode: 'green',
    water: {
      skyTint: 0xaadfff,
      foamColor: 0xf4fdff,
      waveAmp: 0.032,
      strength: 1.0,
    },
  },
  bathhouse: {
    colors: [0xffb4cc, 0xff92b6, 0xffd4e4, 0x3a7a56, 0x529466],
    sunTint: 0xffd2a8,
    shadowTint: 0x3d3b75,
    mode: 'bathhouse',
    water: {
      skyTint: 0x9fd6ec,
      foamColor: 0xf6fbff,
      waveAmp: 0.036,
      strength: 1.0,
    },
  },
  seaplane: {
    colors: [0x459457, 0x61ae59, 0x87c660, 0x357650, 0x9dd16a],
    sunTint: 0xfff0a6,
    shadowTint: 0x245882,
    mode: 'green',
    water: {
      skyTint: 0x8fd6ff,
      foamColor: 0xf5feff,
      waveAmp: 0.044,
      strength: 1.05,
    },
  },
  skyruins: {
    colors: [0x54a87e, 0x73c28d, 0x95d99b, 0x3c816d, 0xb5e5a6],
    sunTint: 0xdff5ff,
    shadowTint: 0x354d8a,
    mode: 'green',
    water: {
      skyTint: 0xbce6ff,
      foamColor: 0xf4fcff,
      waveAmp: 0.034,
      strength: 1.0,
    },
  },
  clockwork: {
    colors: [0xffcb2e, 0xffe058, 0xf57828, 0xe64228, 0xffa630],
    sunTint: 0xffe492,
    shadowTint: 0x5c3e6b,
    mode: 'clockwork',
    water: {
      skyTint: 0x9ad4ee,
      foamColor: 0xf8fbff,
      waveAmp: 0.030,
      strength: 0.98,
    },
  },
  tinyfolk: {
    colors: [0x429b4b, 0x61b955, 0x8ad362, 0x2e7440, 0xaae070],
    sunTint: 0xeeff9c,
    shadowTint: 0x245654,
    mode: 'green',
    water: {
      skyTint: 0xb0e6f0,
      foamColor: 0xf4fffa,
      waveAmp: 0.028,
      strength: 0.95,
    },
  },
};

/**
 * Drop-in GLSL fragment block for `painterly_gfx.js` (0 extra render passes).
 * Folds Ground-Contact Crevice Darkening + Soft 2-Band Painterly Shadow Ramp
 * (warm subsurface terminator + cool shadow band) directly into the world pass.
 * Uses only `painterly_gfx.js` existing uniforms (`uHsSunDir`, `uHsShadowTint`,
 * `uHsRimColor`) and varyings (`vHsWorldPos`, `vHsWorldNorm`).
 */
export const GROUND_AO_AND_RAMP_GLSL = /* glsl */ `
{
  vec3 hsAoNorm = normalize( vHsWorldNorm );
  vec3 hsAoSun = normalize( uHsSunDir );
  float hsAoNdl = dot( hsAoNorm, hsAoSun );

  // 1. Ground-Contact Crevice AO (soft cool darkening where walls/trunks/props meet ground & overhangs)
  float hsWallMask = 1.0 - smoothstep( 0.52, 0.92, abs( hsAoNorm.y ) );
  float hsUnderMask = smoothstep( 0.08, -0.62, hsAoNorm.y );
  float hsGroundProx = 1.0 - smoothstep( 0.0, 0.85, max( vHsWorldPos.y, 0.0 ) );
  float hsCreviceAO = clamp( hsWallMask * hsGroundProx * 0.22 + hsUnderMask * 0.14, 0.0, 0.32 );
  vec3 hsCreviceTint = mix( vec3( 0.38, 0.42, 0.56 ), uHsShadowTint * 0.62, 0.65 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * hsCreviceTint, hsCreviceAO );

  // 2. Soft 2-Band Painterly Shadow Ramp (cool shadow band + warm subsurface terminator glow)
  float hsHalfWrap = clamp( hsAoNdl * 0.5 + 0.5, 0.0, 1.0 );
  float hsTwoBand = smoothstep( 0.36, 0.58, hsHalfWrap );
  float hsTerminator = smoothstep( 0.24, 0.46, hsHalfWrap ) * ( 1.0 - smoothstep( 0.46, 0.68, hsHalfWrap ) );
  vec3 hsCoolBand = mix( vec3( 0.72, 0.76, 0.88 ), uHsShadowTint * 0.46 + vec3( 0.54 ), 0.60 );
  vec3 hsLitBand = vec3( 1.03, 1.02, 0.99 );
  gl_FragColor.rgb *= mix( vec3( 1.0 ), mix( hsCoolBand, hsLitBand, hsTwoBand ), 0.24 );
  float hsTermGuard = 1.0 - smoothstep( 0.65, 0.95, max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) ) );
  gl_FragColor.rgb += uHsRimColor * ( hsTerminator * 0.065 * hsTermGuard );
}
`;

/**
 * Uniform header declaration paired with `GRASS_BEND_VERTEX_GLSL`.
 */
export const GRASS_BEND_UNIFORM_DECL = 'uniform vec4 uBenders[6];\n';

/**
 * Drop-in GLSL vertex snippet for `GRASS_INST` in `main.js` (paste inside
 * `#include <begin_vertex>` right after `vH` and `wp` are computed, with
 * `uniform vec4 uBenders[6];` in the vertex shader header and
 * `sh.uniforms.uBenders = tier1.grassBenderUniforms.uBenders;`).
 * WebGL1 & WebGL2 clean (zero `inverse()` calls; projects push into blade space).
 */
export const GRASS_BEND_VERTEX_GLSL = /* glsl */ `
{
  vec3 hsGrassPushW = vec3( 0.0 );
  float hsGrassFlatten = 0.0;
  float hsBladeTip = clamp( vH, 0.0, 1.0 );
  float hsBendPow = hsBladeTip * hsBladeTip;
  for ( int hsBi = 0; hsBi < 6; hsBi++ ) {
    vec4 hsB = uBenders[ hsBi ];
    float hsRad = hsB.w;
    if ( hsRad > 0.01 && abs( wp.y - hsB.y ) < 1.85 ) {
      vec2 hsDiff = wp.xz - hsB.xz;
      float hsDist = length( hsDiff );
      if ( hsDist < hsRad ) {
        float hsPush = 1.0 - smoothstep( 0.0, hsRad, hsDist );
        hsPush = hsPush * hsPush;
        vec2 hsDir = hsDist > 0.001 ? ( hsDiff / hsDist ) : vec2( 1.0, 0.0 );
        hsGrassPushW.xz += hsDir * ( hsPush * 0.46 );
        hsGrassFlatten = max( hsGrassFlatten, hsPush );
      }
    }
  }
  if ( hsGrassFlatten > 0.001 ) {
    vec3 hsAxX = instanceMatrix[0].xyz;
    vec3 hsAxZ = instanceMatrix[2].xyz;
    float hsLocX = dot( hsGrassPushW, hsAxX ) / max( dot( hsAxX, hsAxX ), 0.0001 );
    float hsLocZ = dot( hsGrassPushW, hsAxZ ) / max( dot( hsAxZ, hsAxZ ), 0.0001 );
    transformed.x += clamp( hsLocX, -0.65, 0.65 ) * hsBendPow;
    transformed.z += clamp( hsLocZ, -0.65, 0.65 ) * hsBendPow;
    transformed.y -= hsGrassFlatten * 0.22 * hsBladeTip;
  }
}
`;

/**
 * Pure utility: bakes soft vertical height-from-base + downward-facing normal
 * Ambient Occlusion into `geo.attributes.color` (creating vertex colors if absent).
 *
 * Accepts either `(THREE, geo, opts)` or `(geo, opts)`.
 */
export function bakeProceduralVertexAO(arg0, arg1, arg2) {
  let THREE = arg0;
  let geo = arg1;
  let opts = arg2 || {};

  // Support calling without THREE as first parameter: bakeProceduralVertexAO(geo, opts)
  if (arg0 && (arg0.isBufferGeometry || (arg0.attributes && arg0.attributes.position))) {
    THREE = null;
    geo = arg0;
    opts = arg1 || {};
  }

  if (!geo || !geo.attributes || !geo.attributes.position) return geo;

  const {
    floorY = 0,
    aoHeight = 0.85,
    minAO = 0.62,
    downWeight = 0.28,
    matrix = null,
  } = opts;

  const pos = geo.attributes.position;
  const count = pos.count;
  if (!count) return geo;

  if (!geo.attributes.normal && typeof geo.computeVertexNormals === 'function') {
    geo.computeVertexNormals();
  }
  const norm = geo.attributes.normal || null;

  let baseFloorY = floorY;
  if (baseFloorY === 'auto') {
    if (!geo.boundingBox && typeof geo.computeBoundingBox === 'function') {
      geo.computeBoundingBox();
    }
    baseFloorY = geo.boundingBox ? geo.boundingBox.min.y : 0;
  }

  let col = geo.attributes.color;
  if (!col) {
    const arr = new Float32Array(count * 3);
    arr.fill(1.0);
    if (THREE && THREE.BufferAttribute) {
      col = new THREE.BufferAttribute(arr, 3);
    } else if (pos.constructor) {
      col = new pos.constructor(arr, 3);
    } else {
      col = {
        array: arr,
        itemSize: 3,
        count,
        needsUpdate: true,
        getX: (i) => arr[i * 3],
        getY: (i) => arr[i * 3 + 1],
        getZ: (i) => arr[i * 3 + 2],
        setXYZ: (i, x, y, z) => {
          arr[i * 3] = x;
          arr[i * 3 + 1] = y;
          arr[i * 3 + 2] = z;
        },
      };
    }
    if (typeof geo.setAttribute === 'function') geo.setAttribute('color', col);
    else geo.attributes.color = col;
  }

  const invH = 1.0 / Math.max(aoHeight, 0.001);
  const aoSpan = 1.0 - minAO;
  const floorClamp = clamp(minAO * 0.85, 0.25, 1.0);
  const m = matrix && matrix.elements ? matrix.elements : null;

  for (let i = 0; i < count; i++) {
    let vy = pos.getY(i);
    if (m) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      vy = m[1] * vx + m[5] * vy + m[9] * vz + m[13];
    }

    const t = clamp((vy - baseFloorY) * invH, 0, 1);
    const smoothT = t * t * (3.0 - 2.0 * t);
    const heightAO = minAO + aoSpan * smoothT;

    let normalAO = 1.0;
    if (norm) {
      let ny = norm.getY(i);
      if (m) {
        const nx = norm.getX(i);
        const nz = norm.getZ(i);
        const wy = m[1] * nx + m[5] * ny + m[9] * nz;
        const wx = m[0] * nx + m[4] * ny + m[8] * nz;
        const wz = m[2] * nx + m[6] * ny + m[10] * nz;
        const nLen = Math.hypot(wx, wy, wz) || 1;
        ny = wy / nLen;
      }
      if (ny < 0.15) {
        const downMask = clamp((0.15 - ny) / 1.15, 0, 1);
        normalAO = 1.0 - downMask * aoSpan * downWeight;
      }
    }

    const ao = clamp(heightAO * normalAO, floorClamp, 1.0);
    col.setXYZ(i, col.getX(i) * ao, col.getY(i) * ao, col.getZ(i) * ao);
  }

  col.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------------------
// Internal helpers for Tree Canopy Detection, Botanical Leaf Texture & Water
// ---------------------------------------------------------------------------

const EXCLUDE_TREE_NAME_RE =
  /roof|house|cottage|building|wall|water|ocean|sea|sky|ground|plaza|floor|bridge|road|path|tram|boat|plane|prop|fence|gate|lantern|lamp|umbrella|awning|tent|sail|barrel|crate|cart|cliff|rock|boulder|stair|ramp|pillar|column|arch|tower|bench|table|chair|stall|sign/i;
const INCLUDE_TREE_NAME_RE =
  /tree|pine|leaf|leaves|foliage|canopy|crown|sakura|cherry|blossom|ginkgo|maple|cedar|oak|willow|cypress|palm|hedge/i;

const WATER_NAME_RE =
  /water|sea|ocean|pool|pond|stream|creek|brook|bath|onsen|canal|lagoon/i;
const WATER_EXCLUDE_NAME_RE =
  /waterwheel|watering_can|water_tank|waterfall|lantern|bridge|bed|bank|stone|wall|door|sign|boat|duck|roof|sky|batched_world|batched_roof|canopy|outline|shadow|grass|prop/i;

/**
 * Determines whether a perceptual sRGB color (0..1) is foliage-toned for `mapId`.
 */
function isFoliageSrgb(r, g, b, mapId) {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s < 0.16 || l < 0.14 || l > 0.92) return false;

  // Standard emerald / olive / jade / chartreuse foliage (all worlds)
  if (h >= 66 && h <= 168 && s >= 0.18 && l >= 0.15 && l <= 0.78) {
    return true;
  }

  // Autumn golden ginkgo / amber / crimson maple on Clockwork
  if (mapId === 'clockwork') {
    if ((h <= 56 || h >= 348) && s >= 0.48 && l >= 0.34 && l <= 0.78) {
      return true;
    }
  }

  // Cherry blossom sakura pink & deep cedar on Bathhouse
  if (mapId === 'bathhouse') {
    if ((h >= 312 || h <= 12) && s >= 0.24 && l >= 0.56 && l <= 0.91) {
      return true;
    }
    if (h >= 95 && h <= 176 && s >= 0.16 && l >= 0.14 && l <= 0.65) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a perceptual sRGB color (0..1) is blue/teal/cyan/aqua water.
 */
function isWaterSrgb(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  return h >= 168 && h <= 232 && s >= 0.22 && l >= 0.20 && l <= 0.86;
}

/**
 * Paints a crisp 128x128 5-leaf botanical cluster alpha-cutout CanvasTexture once.
 * Painted in bright ivory-white tones with sunlit tip highlights and delicate
 * soft veins so per-instance foliage color tinting stays clean and vivid across
 * emerald, autumn gold/crimson, and cherry-blossom pink canopies.
 */
let cachedLeafAtlasTex = null;
function getBotanicalLeafAtlas(THREE) {
  if (cachedLeafAtlasTex) return cachedLeafAtlasTex;
  if (!THREE || typeof document === 'undefined') return null;

  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const drawSingleLeaf = (cx, cy, angle, len, wid, tipBright, baseTone) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Organic teardrop-almond botanical silhouette
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid * 0.92, -len * 0.28, -wid * 0.85, -len * 0.76, 0, -len);
    ctx.bezierCurveTo(wid * 0.85, -len * 0.76, wid * 0.92, -len * 0.28, 0, 0);
    ctx.closePath();

    // Base painterly gradient: deeper stem base -> warm sunlit tip
    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    const bVal = Math.round(baseTone * 255);
    const mVal = Math.round(clamp(baseTone + 0.14, 0, 1) * 255);
    const tR = Math.round(clamp(tipBright, 0, 1) * 255);
    const tG = Math.round(clamp(tipBright * 0.99, 0, 1) * 255);
    const tB = Math.round(clamp(tipBright * 0.92, 0, 1) * 255);
    grad.addColorStop(0.0, `rgba(${bVal}, ${bVal}, ${Math.round(bVal * 0.96)}, 1.0)`);
    grad.addColorStop(0.55, `rgba(${mVal}, ${mVal}, ${Math.round(mVal * 0.95)}, 1.0)`);
    grad.addColorStop(1.0, `rgba(${tR}, ${tG}, ${tB}, 1.0)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle sunlit upper-edge brushstroke highlight
    ctx.save();
    ctx.clip();
    const hiGrad = ctx.createRadialGradient(-wid * 0.18, -len * 0.68, 2, 0, -len * 0.62, len * 0.55);
    hiGrad.addColorStop(0.0, 'rgba(255, 253, 238, 0.34)');
    hiGrad.addColorStop(1.0, 'rgba(255, 253, 238, 0.0)');
    ctx.fillStyle = hiGrad;
    ctx.fillRect(-wid, -len, wid * 2, len);

    // Delicate central midrib vein + 3 pairs of soft lateral veins
    ctx.strokeStyle = 'rgba(182, 188, 174, 0.42)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.06);
    ctx.lineTo(0, -len * 0.84);
    ctx.stroke();

    ctx.lineWidth = 0.95;
    ctx.strokeStyle = 'rgba(195, 200, 186, 0.32)';
    for (let v = 0; v < 3; v++) {
      const vy = -len * (0.26 + v * 0.21);
      const vw = wid * (0.48 - v * 0.09);
      const vyTip = vy - len * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, vy);
      ctx.lineTo(-vw, vyTip);
      ctx.moveTo(0, vy);
      ctx.lineTo(vw, vyTip);
      ctx.stroke();
    }
    ctx.restore();

    // Soft feathered painterly rim so alphaTest 0.45 gives crisp organic borders
    ctx.strokeStyle = 'rgba(235, 236, 224, 0.58)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore();
  };

  // Back 2 lower side leaves (slightly deeper tone for layered puff depth)
  drawSingleLeaf(62, 74, -2.05, 44, 19, 0.92, 0.72);
  drawSingleLeaf(66, 74, 2.02, 43, 18.5, 0.93, 0.73);

  // Mid 2 upper-flank leaves
  drawSingleLeaf(60, 68, -0.92, 50, 21.5, 0.97, 0.78);
  drawSingleLeaf(68, 68, 0.88, 51, 21.5, 0.98, 0.79);

  // Crown hero center leaf (brightest sunlit highlight)
  drawSingleLeaf(64, 66, 0.03, 55, 23, 1.0, 0.82);

  // Tiny center rosette anchor bud bridging the 5 stems seamlessly
  const budGrad = ctx.createRadialGradient(64, 67, 1, 64, 67, 11);
  budGrad.addColorStop(0.0, 'rgba(218, 220, 206, 0.96)');
  budGrad.addColorStop(0.75, 'rgba(194, 198, 184, 0.86)');
  budGrad.addColorStop(1.0, 'rgba(194, 198, 184, 0.0)');
  ctx.fillStyle = budGrad;
  ctx.beginPath();
  ctx.arc(64, 67, 11, 0, TAU);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cachedLeafAtlasTex = tex;
  return tex;
}

/**
 * Deterministic lightweight hash (0..1) so tree leaf placements never jitter across reloads.
 */
function detRand(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Syncs scene fog parameters into custom ShaderMaterial uniforms (supports Fog & FogExp2).
 */
function syncFogUniforms(scene, uniforms) {
  if (!uniforms || !uniforms.uFogMode) return;
  const fog = scene && scene.fog ? scene.fog : null;
  if (!fog) {
    uniforms.uFogMode.value = 0;
    return;
  }
  if (fog.color && uniforms.uFogColor && uniforms.uFogColor.value) {
    uniforms.uFogColor.value.copy(fog.color);
  }
  if (fog.isFogExp2) {
    uniforms.uFogMode.value = 2;
    uniforms.uFogDensity.value = fog.density ?? 0.012;
  } else {
    uniforms.uFogMode.value = 1;
    uniforms.uFogNear.value = fog.near ?? 40;
    uniforms.uFogFar.value = fog.far ?? 140;
  }
}

/**
 * Creates the Hue & Seek Tier 1 Stylized Visuals Controller.
 * @param {object} env `{ THREE, scene, sun, isTouch }`
 */
export function createTier1VisualsManager(env = {}) {
  const { THREE, scene = null, sun = null, isTouch = false } = env;

  const MAX_CANOPY_CARDS = isTouch ? 800 : 1400;
  let activeMapId = 'meadow';
  let activePalette = WORLD_FOLIAGE_PALETTES.meadow;
  let accTime = 0;
  let detailLevel = 1.0;

  // Scratch objects (zero hot-loop GC)
  const _vec3A = THREE ? new THREE.Vector3() : null;
  const _vec3B = THREE ? new THREE.Vector3() : null;
  const _vec3C = THREE ? new THREE.Vector3() : null;
  const _upAxis = THREE ? new THREE.Vector3(0, 1, 0) : null;
  const _fwdAxis = THREE ? new THREE.Vector3(0, 0, 1) : null;
  const _box3 = THREE ? new THREE.Box3() : null;
  const _mat4 = THREE ? new THREE.Matrix4() : null;
  const _quatA = THREE ? new THREE.Quaternion() : null;
  const _quatB = THREE ? new THREE.Quaternion() : null;
  const _scale3 = THREE ? new THREE.Vector3() : null;
  const _colA = THREE ? new THREE.Color() : null;
  const _colB = THREE ? new THREE.Color() : null;

  // =========================================================================
  // 1. FLUFFY STYLIZED TREE CANOPIES (Spherical Normal Transfer + Leaf Cards)
  // =========================================================================
  let canopyMesh = null;
  let canopyParent = null;
  let canopyFullCount = 0;
  let canopyMat = null;

  const canopyUniforms = {
    uLeafTex: { value: null },
    uTime: { value: 0 },
    uSunDir: { value: THREE ? new THREE.Vector3(0.5, 0.75, 0.35).normalize() : { x: 0.5, y: 0.75, z: 0.35 } },
    uSunColor: { value: THREE ? new THREE.Color(0xfff0c8) : null },
    uShadowTint: { value: THREE ? new THREE.Color(0x365b73) : null },
    uTranslucencyTint: { value: THREE ? new THREE.Color(0xffe88c) : null },
    uWindStrength: { value: 1.0 },
    uAlphaTest: { value: 0.45 },
    uFogMode: { value: 0 },
    uFogColor: { value: THREE ? new THREE.Color(0xdbeeff) : null },
    uFogNear: { value: 45 },
    uFogFar: { value: 150 },
    uFogDensity: { value: 0.012 },
  };

  function getCanopyMaterial() {
    if (canopyMat || !THREE) return canopyMat;
    canopyUniforms.uLeafTex.value = getBotanicalLeafAtlas(THREE);
    canopyMat = new THREE.ShaderMaterial({
      uniforms: canopyUniforms,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
      fog: false, // Handled explicitly via uFog* for WebGL1/WebGL2 safety
      vertexShader: /* glsl */ `
        attribute vec3 aCanopyCenter;
        attribute float aLeafPhase;
        attribute float aLeafAO;
        attribute vec3 aLeafColor;

        uniform float uTime;
        uniform float uWindStrength;

        varying vec2 vUv;
        varying vec3 vSphereNormal;
        varying vec3 vWorldPos;
        varying vec3 vLeafColor;
        varying float vLeafAO;

        void main() {
          vUv = uv;
          vLeafColor = aLeafColor;
          vLeafAO = aLeafAO;

          vec4 localPos = vec4( position, 1.0 );
          #ifdef USE_INSTANCING
            vec4 instWp = modelMatrix * instanceMatrix * localPos;
          #else
            vec4 instWp = modelMatrix * localPos;
          #endif

          // GPU Vertex Wind Rustle: layered breeze wave + tip flutter
          float gust = sin( uTime * 2.2 + aLeafPhase + instWp.x * 0.40 + instWp.z * 0.24 );
          float flutter = cos( uTime * 3.8 + aLeafPhase * 1.7 + instWp.y * 0.60 ) * 0.35;
          float tipW = 0.40 + 0.60 * clamp( uv.y, 0.0, 1.0 );
          instWp.x += ( gust + flutter ) * 0.075 * uWindStrength * tipW;
          instWp.y += sin( uTime * 1.85 + aLeafPhase ) * 0.024 * uWindStrength * tipW;
          instWp.z += ( gust * 0.62 - flutter * 0.48 ) * 0.062 * uWindStrength * tipW;

          // Spherical Normal Transfer: smooth outward normal from tree crown center
          vec3 toOut = instWp.xyz - aCanopyCenter;
          float outLen = length( toOut );
          vSphereNormal = outLen > 0.001 ? ( toOut / outLen ) : vec3( 0.0, 1.0, 0.0 );
          vWorldPos = instWp.xyz;

          gl_Position = projectionMatrix * viewMatrix * instWp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uLeafTex;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uShadowTint;
        uniform vec3 uTranslucencyTint;
        uniform float uAlphaTest;
        uniform int uFogMode;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform float uFogDensity;

        varying vec2 vUv;
        varying vec3 vSphereNormal;
        varying vec3 vWorldPos;
        varying vec3 vLeafColor;
        varying float vLeafAO;

        void main() {
          vec4 leafSample = texture2D( uLeafTex, vUv );
          if ( leafSample.a < uAlphaTest ) discard;

          // Decode painted botanical atlas brightness smoothly into linear light space
          vec3 texLin = pow( clamp( leafSample.rgb, 0.0, 1.0 ), vec3( 2.2 ) );
          vec3 baseCol = vLeafColor * texLin * vLeafAO;

          vec3 N = normalize( vSphereNormal );
          vec3 L = normalize( uSunDir );
          vec3 V = normalize( cameraPosition - vWorldPos );

          // Soft Painterly 2-Band Lighting using Spherical Normal Transfer
          float ndl = dot( N, L );
          float wrap = clamp( ndl * 0.55 + 0.45, 0.0, 1.0 );
          float band = smoothstep( 0.32, 0.58, wrap );
          float termBand = smoothstep( 0.22, 0.45, wrap ) * ( 1.0 - smoothstep( 0.45, 0.72, wrap ) );

          vec3 coolShad = baseCol * mix( vec3( 0.54, 0.60, 0.74 ), uShadowTint * 1.28, 0.52 );
          vec3 warmLit = baseCol * mix( vec3( 1.08, 1.05, 0.96 ), uSunColor * 1.14, 0.44 );
          vec3 col = mix( coolShad, warmLit, band );

          // Warm subsurface terminator + backlit rim translucency on outer leaves
          float backLit = pow( clamp( dot( V, -L ), 0.0, 1.0 ), 2.8 );
          float rim = pow( 1.0 - abs( dot( N, V ) ), 2.2 );
          float skyUp = clamp( N.y * 0.5 + 0.5, 0.0, 1.0 );
          col += baseCol * uTranslucencyTint * ( termBand * 0.24 + backLit * 0.36 + rim * 0.22 * skyUp );
          col += vec3( 0.035, 0.055, 0.075 ) * skyUp * vLeafAO;

          // Scene atmospheric fog parity (Linear or Exp2)
          if ( uFogMode > 0 ) {
            float fDist = length( cameraPosition - vWorldPos );
            float fogF = 0.0;
            if ( uFogMode == 1 ) {
              fogF = smoothstep( uFogNear, uFogFar, fDist );
            } else {
              fogF = 1.0 - exp( -uFogDensity * uFogDensity * fDist * fDist );
            }
            col = mix( col, uFogColor, clamp( fogF, 0.0, 1.0 ) );
          }

          gl_FragColor = vec4( col, 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    return canopyMat;
  }

  function disposeCanopyMesh() {
    if (!canopyMesh) return;
    if (canopyMesh.parent) canopyMesh.parent.remove(canopyMesh);
    if (canopyMesh.geometry) {
      canopyMesh.geometry.dispose();
    }
    canopyMesh = null;
    canopyParent = null;
    canopyFullCount = 0;
  }

  function hasExcludedAncestor(obj, stopRoot) {
    let explicitTree = false;
    for (let p = obj; p && p !== stopRoot; p = p.parent) {
      if (p.userData?.isRoof || p.userData?._skipTreeCanopy || p.userData?.propRoot) {
        return { excluded: true, explicitTree: false };
      }
      const nm = p.name || '';
      if (INCLUDE_TREE_NAME_RE.test(nm)) explicitTree = true;
      if (!explicitTree && nm && nm !== 'batched_world' && EXCLUDE_TREE_NAME_RE.test(nm)) {
        return { excluded: true, explicitTree: false };
      }
    }
    return { excluded: false, explicitTree };
  }

  /**
   * Clusters elevated foliage-colored vertices inside large merged `batched_world`
   * meshes into distinct tree crown ellipsoids (post-`optimizeWorldScene` support!).
   */
  function extractCrownsFromBatchedMesh(mesh, mapId, outCrowns) {
    const geo = mesh.geometry;
    const pos = geo && geo.attributes && geo.attributes.position;
    const col = geo && geo.attributes && geo.attributes.color;
    if (!pos || !col) return;

    const vCount = pos.count;
    const stride = vCount > 24000 ? 3 : vCount > 12000 ? 2 : 1;
    const cellXZ = 2.6;
    const cellY = 2.8;
    const cells = new Map();
    const mw = mesh.matrixWorld;

    for (let i = 0; i < vCount; i += stride) {
      _vec3A.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mw);
      if (_vec3A.y < 1.6) continue;

      const sr = linearToSrgb(col.getX(i));
      const sg = linearToSrgb(col.getY(i));
      const sb = linearToSrgb(col.getZ(i));
      if (!isFoliageSrgb(sr, sg, sb, mapId)) continue;

      const ix = Math.floor(_vec3A.x / cellXZ);
      const iy = Math.floor(_vec3A.y / cellY);
      const iz = Math.floor(_vec3A.z / cellXZ);
      const key = `${ix},${iy},${iz}`;
      let c = cells.get(key);
      if (!c) {
        c = {
          ix, iy, iz,
          minX: _vec3A.x, maxX: _vec3A.x,
          minY: _vec3A.y, maxY: _vec3A.y,
          minZ: _vec3A.z, maxZ: _vec3A.z,
          sumX: 0, sumY: 0, sumZ: 0,
          sumR: 0, sumG: 0, sumB: 0,
          count: 0,
          visited: false,
        };
        cells.set(key, c);
      }
      if (_vec3A.x < c.minX) c.minX = _vec3A.x;
      if (_vec3A.x > c.maxX) c.maxX = _vec3A.x;
      if (_vec3A.y < c.minY) c.minY = _vec3A.y;
      if (_vec3A.y > c.maxY) c.maxY = _vec3A.y;
      if (_vec3A.z < c.minZ) c.minZ = _vec3A.z;
      if (_vec3A.z > c.maxZ) c.maxZ = _vec3A.z;
      c.sumX += _vec3A.x;
      c.sumY += _vec3A.y;
      c.sumZ += _vec3A.z;
      c.sumR += col.getX(i);
      c.sumG += col.getY(i);
      c.sumB += col.getZ(i);
      c.count++;
    }

    const minVerts = stride === 1 ? 16 : stride === 2 ? 9 : 6;
    const maxSpan = 5.4;

    for (const startCell of cells.values()) {
      if (startCell.visited || startCell.count < 2) continue;
      startCell.visited = true;
      const queue = [startCell];
      let minX = startCell.minX, maxX = startCell.maxX;
      let minY = startCell.minY, maxY = startCell.maxY;
      let minZ = startCell.minZ, maxZ = startCell.maxZ;
      let sumX = startCell.sumX, sumY = startCell.sumY, sumZ = startCell.sumZ;
      let sumR = startCell.sumR, sumG = startCell.sumG, sumB = startCell.sumB;
      let total = startCell.count;

      while (queue.length > 0) {
        const cur = queue.shift();
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (dx === 0 && dy === 0 && dz === 0) continue;
              const nb = cells.get(`${cur.ix + dx},${cur.iy + dy},${cur.iz + dz}`);
              if (!nb || nb.visited || nb.count < 2) continue;
              const nMinX = Math.min(minX, nb.minX);
              const nMaxX = Math.max(maxX, nb.maxX);
              const nMinZ = Math.min(minZ, nb.minZ);
              const nMaxZ = Math.max(maxZ, nb.maxZ);
              // Cap cluster spread so adjacent trees stay separate crowns
              if (nMaxX - nMinX > maxSpan || nMaxZ - nMinZ > maxSpan) continue;
              nb.visited = true;
              minX = nMinX; maxX = nMaxX;
              minY = Math.min(minY, nb.minY);
              maxY = Math.max(maxY, nb.maxY);
              minZ = nMinZ; maxZ = nMaxZ;
              sumX += nb.sumX; sumY += nb.sumY; sumZ += nb.sumZ;
              sumR += nb.sumR; sumG += nb.sumG; sumB += nb.sumB;
              total += nb.count;
              queue.push(nb);
            }
          }
        }
      }

      if (total < minVerts) continue;
      const sx = maxX - minX;
      const sy = maxY - minY;
      const sz = maxZ - minZ;
      const maxDim = Math.max(sx, sy, sz);
      const cy = sumY / total;
      if (cy < 1.6 || maxDim < 1.1 || sy < 0.62) continue;

      outCrowns.push({
        cx: sumX / total,
        cy,
        cz: sumZ / total,
        rx: clamp(sx * 0.5, 0.55, 3.2),
        ry: clamp(sy * 0.5, 0.45, 2.8),
        rz: clamp(sz * 0.5, 0.55, 3.2),
        colorLin: new THREE.Color(sumR / total, sumG / total, sumB / total),
      });
    }
  }

  /**
   * Detects tree canopies across `mapRoot` (both unmerged meshes AND batched
   * post-optimization chunks, plus optional explicit `treeAnchors`) and drapes
   * fluffy hand-painted 5-leaf botanical cards in 1 single InstancedMesh.
   */
  function enhanceWorldTrees(mapRoot, mapId = 'meadow', treeAnchors = null, opts = {}) {
    disposeCanopyMesh();
    if (!THREE || !mapRoot) return null;

    activeMapId = mapId || 'meadow';
    activePalette = WORLD_FOLIAGE_PALETTES[activeMapId] || WORLD_FOLIAGE_PALETTES.meadow;
    const excludeBoxes = Array.isArray(opts?.excludeBoxes)
      ? opts.excludeBoxes
      : (treeAnchors && Array.isArray(treeAnchors.excludeBoxes) ? treeAnchors.excludeBoxes : []);
    const isInsideExcluded = (x, y, z, pad = 0) => {
      for (let i = 0; i < excludeBoxes.length; i++) {
        const b = excludeBoxes[i];
        if (!b) continue;
        if (x >= b.min.x - pad && x <= b.max.x + pad && z >= b.min.z - pad && z <= b.max.z + pad && y >= b.min.y - 1.0 && y <= b.max.y + 2.2) {
          return true;
        }
      }
      return false;
    };

    canopyUniforms.uShadowTint.value.setHex(activePalette.shadowTint);
    canopyUniforms.uTranslucencyTint.value.setHex(activePalette.sunTint);

    const anchors = Array.isArray(treeAnchors)
      ? treeAnchors
      : (treeAnchors && Array.isArray(treeAnchors.treeAnchors) ? treeAnchors.treeAnchors : []);

    mapRoot.updateMatrixWorld(true);

    const rawCrowns = [];

    // 1. Traverse mapRoot for foliage / tree canopy meshes
    mapRoot.traverse((obj) => {
      if (!obj || !obj.isMesh || !obj.visible || !obj.geometry || !obj.material) return;
      if (
        obj.userData?._isTier1Canopy ||
        obj.userData?._isOutline ||
        obj.userData?._isContactShadow ||
        obj.userData?.isRoof ||
        obj.userData?.ground ||
        obj.userData?.propRoot ||
        obj.userData?._skipTreeCanopy
      ) {
        return;
      }

      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (!mat) return;
      if (mat.isShaderMaterial || mat.isSpriteMaterial || mat.isPointsMaterial || mat.isMeshBasicMaterial) return;
      if (mat.transparent && (mat.opacity ?? 1) < 0.85) return;

      const geo = obj.geometry;
      if (!geo.attributes || !geo.attributes.position) return;

      const { excluded, explicitTree } = hasExcludedAncestor(obj, mapRoot);
      if (excluded) return;

      // Case A: Post-optimization batched static chunks (`batched_world`)
      if (obj.name === 'batched_world' && geo.attributes.color) {
        extractCrownsFromBatchedMesh(obj, activeMapId, rawCrowns);
        return;
      }

      // Case B: Instanced foliage meshes (excluding low meadow grass)
      if (obj.isInstancedMesh) {
        if (!geo.boundingBox) geo.computeBoundingBox();
        if (!geo.boundingBox) return;
        const baseSize = geo.boundingBox.getSize(_vec3B);
        if (Math.max(baseSize.x, baseSize.y, baseSize.z) < 0.65) return;

        const baseCol = mat.color || _colA.setHex(0xffffff);
        const instCount = Math.min(obj.count || 0, 512);
        for (let i = 0; i < instCount; i++) {
          obj.getMatrixAt(i, _mat4);
          _mat4.premultiply(obj.matrixWorld);
          _box3.copy(geo.boundingBox).applyMatrix4(_mat4);
          _box3.getCenter(_vec3A);
          _box3.getSize(_vec3C);
          const maxD = Math.max(_vec3C.x, _vec3C.y, _vec3C.z);
          if (_vec3A.y < 1.6 || maxD < 1.1 || maxD > 11.5 || _vec3C.y < 0.55) continue;

          if (obj.instanceColor) {
            obj.getColorAt(i, _colB);
            _colB.multiply(baseCol);
          } else {
            _colB.copy(baseCol);
          }
          const sr = linearToSrgb(_colB.r);
          const sg = linearToSrgb(_colB.g);
          const sb = linearToSrgb(_colB.b);
          if (!explicitTree && !isFoliageSrgb(sr, sg, sb, activeMapId)) continue;

          rawCrowns.push({
            cx: _vec3A.x,
            cy: _vec3A.y,
            cz: _vec3A.z,
            rx: clamp(_vec3C.x * 0.5, 0.55, 3.2),
            ry: clamp(_vec3C.y * 0.5, 0.45, 2.8),
            rz: clamp(_vec3C.z * 0.5, 0.55, 3.2),
            colorLin: _colB.clone(),
          });
        }
        return;
      }

      // Case C: Standard unmerged mesh (e.g. merged tree group or canopy clump)
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) return;
      _box3.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
      _box3.getCenter(_vec3A);
      _box3.getSize(_vec3C);
      const maxDim = Math.max(_vec3C.x, _vec3C.y, _vec3C.z);

      // Large merged meshes with vertex colors -> scan via spatial vertex clusterer
      if (maxDim > 11.5 && geo.attributes.color) {
        extractCrownsFromBatchedMesh(obj, activeMapId, rawCrowns);
        return;
      }

      if (_vec3A.y < 1.6 || maxDim < 1.1 || maxDim > 11.5 || _vec3C.y < 0.55) return;

      // Determine representative color (vertex colors above y=1.6 or material.color)
      let linR = mat.color ? mat.color.r : 1;
      let linG = mat.color ? mat.color.g : 1;
      let linB = mat.color ? mat.color.b : 1;

      if (mat.vertexColors && geo.attributes.color) {
        const pAttr = geo.attributes.position;
        const cAttr = geo.attributes.color;
        const step = Math.max(1, Math.floor(pAttr.count / 96));
        let srSum = 0, sgSum = 0, sbSum = 0, hits = 0;
        let folSumX = 0, folSumY = 0, folSumZ = 0;
        let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity, fMinZ = Infinity, fMaxZ = -Infinity;
        for (let i = 0; i < pAttr.count; i += step) {
          _vec3B.set(pAttr.getX(i), pAttr.getY(i), pAttr.getZ(i)).applyMatrix4(obj.matrixWorld);
          if (_vec3B.y < 1.6) continue;
          const vr = cAttr.getX(i) * linR;
          const vg = cAttr.getY(i) * linG;
          const vb = cAttr.getZ(i) * linB;
          if (isFoliageSrgb(linearToSrgb(vr), linearToSrgb(vg), linearToSrgb(vb), activeMapId)) {
            srSum += vr; sgSum += vg; sbSum += vb;
            folSumX += _vec3B.x; folSumY += _vec3B.y; folSumZ += _vec3B.z;
            if (_vec3B.x < fMinX) fMinX = _vec3B.x;
            if (_vec3B.x > fMaxX) fMaxX = _vec3B.x;
            if (_vec3B.y < fMinY) fMinY = _vec3B.y;
            if (_vec3B.y > fMaxY) fMaxY = _vec3B.y;
            if (_vec3B.z < fMinZ) fMinZ = _vec3B.z;
            if (_vec3B.z > fMaxZ) fMaxZ = _vec3B.z;
            hits++;
          }
        }
        if (hits < 3) return;
        const fsx = fMaxX - fMinX;
        const fsy = fMaxY - fMinY;
        const fsz = fMaxZ - fMinZ;
        if (Math.max(fsx, fsy, fsz) < 0.95) return;
        rawCrowns.push({
          cx: folSumX / hits,
          cy: folSumY / hits,
          cz: folSumZ / hits,
          rx: clamp(fsx * 0.5, 0.55, 3.2),
          ry: clamp(fsy * 0.5, 0.45, 2.8),
          rz: clamp(fsz * 0.5, 0.55, 3.2),
          colorLin: new THREE.Color(srSum / hits, sgSum / hits, sbSum / hits),
        });
        return;
      }

      const sr = linearToSrgb(linR);
      const sg = linearToSrgb(linG);
      const sb = linearToSrgb(linB);
      if (!explicitTree && !isFoliageSrgb(sr, sg, sb, activeMapId)) return;

      rawCrowns.push({
        cx: _vec3A.x,
        cy: _vec3A.y,
        cz: _vec3A.z,
        rx: clamp(_vec3C.x * 0.5, 0.55, 3.2),
        ry: clamp(_vec3C.y * 0.5, 0.45, 2.8),
        rz: clamp(_vec3C.z * 0.5, 0.55, 3.2),
        colorLin: new THREE.Color(linR, linG, linB),
      });
    });

    // 2. Append explicit tree anchors if caller provided any
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (!a) continue;
      const c = a.center || a.position || a;
      const cx = Array.isArray(c) ? c[0] : (c.x ?? 0);
      const cy = Array.isArray(c) ? c[1] : (c.y ?? 3.5);
      const cz = Array.isArray(c) ? c[2] : (c.z ?? 0);
      const rad = a.radius ?? 1.8;
      const palHex = activePalette.colors[i % activePalette.colors.length];
      const colLin = a.color != null
        ? (a.color.isColor ? a.color.clone() : new THREE.Color(a.color))
        : new THREE.Color(palHex);
      rawCrowns.push({
        cx,
        cy,
        cz,
        rx: clamp(a.rx ?? rad, 0.6, 3.4),
        ry: clamp(a.ry ?? rad * 0.82, 0.5, 3.0),
        rz: clamp(a.rz ?? rad, 0.6, 3.4),
        colorLin: colLin,
      });
    }

    if (rawCrowns.length === 0) return null;

    // Filter out ANY crown inside or touching a building/house footprint or too low (railings/furniture/shrubs!)
    const filteredCrowns = rawCrowns.filter((c) => {
      if (c.cy < 2.65) return false;
      if (isInsideExcluded(c.cx, c.cy, c.cz, 1.35)) return false;
      return true;
    });
    if (filteredCrowns.length === 0) return null;
    rawCrowns.length = 0;
    for (let i = 0; i < filteredCrowns.length; i++) rawCrowns.push(filteredCrowns[i]);

    // 3. Merge overlapping sub-clumps belonging to the same tree crown
    //    (e.g. unmerged kit.js broadleaf trees with 23 sphere clumps)
    const crowns = [];
    const used = new Uint8Array(rawCrowns.length);
    for (let i = 0; i < rawCrowns.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const seed = rawCrowns[i];
      let minX = seed.cx - seed.rx, maxX = seed.cx + seed.rx;
      let minY = seed.cy - seed.ry, maxY = seed.cy + seed.ry;
      let minZ = seed.cz - seed.rz, maxZ = seed.cz + seed.rz;
      let sumR = seed.colorLin.r, sumG = seed.colorLin.g, sumB = seed.colorLin.b;
      let mergedN = 1;

      for (let j = i + 1; j < rawCrowns.length; j++) {
        if (used[j]) continue;
        const other = rawCrowns[j];
        const curCx = (minX + maxX) * 0.5;
        const curCy = (minY + maxY) * 0.5;
        const curCz = (minZ + maxZ) * 0.5;
        const distXZ = Math.hypot(other.cx - curCx, other.cz - curCz);
        const distY = Math.abs(other.cy - curCy);
        if (distXZ < 2.25 && distY < 2.1) {
          const nMinX = Math.min(minX, other.cx - other.rx);
          const nMaxX = Math.max(maxX, other.cx + other.rx);
          const nMinZ = Math.min(minZ, other.cz - other.rz);
          const nMaxZ = Math.max(maxZ, other.cz + other.rz);
          if (nMaxX - nMinX <= 5.8 && nMaxZ - nMinZ <= 5.8) {
            used[j] = 1;
            minX = nMinX; maxX = nMaxX;
            minY = Math.min(minY, other.cy - other.ry);
            maxY = Math.max(maxY, other.cy + other.ry);
            minZ = nMinZ; maxZ = nMaxZ;
            sumR += other.colorLin.r;
            sumG += other.colorLin.g;
            sumB += other.colorLin.b;
            mergedN++;
          }
        }
      }

      crowns.push({
        cx: (minX + maxX) * 0.5,
        cy: (minY + maxY) * 0.5,
        cz: (minZ + maxZ) * 0.5,
        rx: clamp((maxX - minX) * 0.5, 0.72, 3.2),
        ry: clamp((maxY - minY) * 0.5, 0.60, 2.8),
        rz: clamp((maxZ - minZ) * 0.5, 0.72, 3.2),
        colorLin: new THREE.Color(sumR / mergedN, sumG / mergedN, sumB / mergedN),
      });
    }

    // 4. Allocate leaf card counts proportionally across all detected crowns
    const weights = crowns.map((c) => c.rx * c.ry + c.ry * c.rz + c.rx * c.rz);
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
    const perCrown = crowns.map((c, idx) => {
      const share = Math.round((weights[idx] / totalWeight) * MAX_CANOPY_CARDS);
      return clamp(share, 8, isTouch ? 26 : 42);
    });
    let totalCards = perCrown.reduce((a, b) => a + b, 0);
    if (totalCards > MAX_CANOPY_CARDS) {
      const scaleDown = MAX_CANOPY_CARDS / totalCards;
      totalCards = 0;
      for (let i = 0; i < perCrown.length; i++) {
        perCrown[i] = Math.max(4, Math.floor(perCrown[i] * scaleDown));
        totalCards += perCrown[i];
      }
      totalCards = Math.min(totalCards, MAX_CANOPY_CARDS);
    }
    if (totalCards <= 0) return null;

    // 5. Build 1 single InstancedMesh with per-instance Spherical Normal Transfer attributes
    const cardGeo = new THREE.PlaneGeometry(1.0, 1.0, 1, 1);
    const aCanopyCenter = new Float32Array(totalCards * 3);
    const aLeafPhase = new Float32Array(totalCards);
    const aLeafAO = new Float32Array(totalCards);
    const aLeafColor = new Float32Array(totalCards * 3);

    const mat = getCanopyMaterial();
    const inst = new THREE.InstancedMesh(cardGeo, mat, totalCards);
    inst.name = 'tier1_fluffy_canopies';
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = false;
    inst.userData._isTier1Canopy = true;
    inst.userData._skipPainterly = true;
    inst.userData.noSolid = true;

    const palHexList = activePalette.colors;
    let idx = 0;

    for (let ci = 0; ci < crowns.length && idx < totalCards; ci++) {
      const cr = crowns[ci];
      const nCards = Math.min(perCrown[ci], totalCards - idx);
      const meanR = (cr.rx + cr.ry + cr.rz) / 3;
      const baseCardScale = clamp(meanR * 0.54, 0.62, 1.32);
      // Shift spherical normal origin slightly lower inside crown so upper puffs catch broad sunlight
      const normCenterY = cr.cy - cr.ry * 0.16;

      for (let k = 0; k < nCards && idx < totalCards; k++) {
        const seed = ci * 97.13 + k * 13.71 + 1.0;
        const u = (k + 0.5) / nCards;
        // Fibonacci distribution biased toward visible upper & side canopy shell (-0.38 .. +1.0)
        const yNorm = 1.0 - u * 1.38;
        const rRing = Math.sqrt(Math.max(0.0, 1.0 - yNorm * yNorm));
        const theta = k * GOLDEN_ANGLE + detRand(seed) * 0.65;

        const dirX = Math.cos(theta) * rRing;
        const dirY = yNorm;
        const dirZ = Math.sin(theta) * rRing;

        // Drape leaf cards across outer canopy surface with gentle volumetric puff depth
        const shellLayer = 0.84 + detRand(seed + 2.3) * 0.26;
        const px = cr.cx + dirX * cr.rx * shellLayer;
        const py = cr.cy + dirY * cr.ry * shellLayer;
        const pz = cr.cz + dirZ * cr.rz * shellLayer;
        if (py < 2.2 || isInsideExcluded(px, py, pz, 0.9)) continue;

        // Orient leaf card roughly outward from crown + organic painterly tilt & spin
        _vec3A.set(dirX, dirY + 0.15, dirZ).normalize();
        if (_vec3A.lengthSq() < 1e-4) _vec3A.set(0, 1, 0);
        _quatA.setFromUnitVectors(_fwdAxis, _vec3A);
        _quatB.setFromAxisAngle(_fwdAxis, detRand(seed + 5.1) * TAU);
        _quatA.multiply(_quatB);
        _quatB.setFromAxisAngle(_upAxis, (detRand(seed + 8.7) - 0.5) * 0.72);
        _quatA.multiply(_quatB);

        const sJitter = 0.78 + detRand(seed + 11.2) * 0.48;
        const cardW = baseCardScale * sJitter;
        const cardH = cardW * (0.88 + detRand(seed + 14.9) * 0.24);
        _vec3B.set(px, py, pz);
        _scale3.set(cardW, cardH, 1.0);
        _mat4.compose(_vec3B, _quatA, _scale3);
        inst.setMatrixAt(idx, _mat4);

        // Per-instance attributes: crown center, wind phase, inner->outer sunlit AO, & blended foliage hue
        aCanopyCenter[idx * 3] = cr.cx;
        aCanopyCenter[idx * 3 + 1] = normCenterY;
        aCanopyCenter[idx * 3 + 2] = cr.cz;

        aLeafPhase[idx] = detRand(seed + 19.4) * TAU;

        // Inner/lower underside = 0.58 -> outer sunlit upper tips = 1.15
        const height01 = clamp((dirY + 0.45) / 1.45, 0.0, 1.0);
        const outer01 = clamp((shellLayer - 0.84) / 0.26, 0.0, 1.0);
        aLeafAO[idx] = 0.58 + (height01 * 0.68 + outer01 * 0.32) * (1.15 - 0.58);

        // Blend detected tree crown color with world palette harmony + subtle painterly value/hue shift
        _colA.copy(cr.colorLin);
        _colB.setHex(palHexList[(ci + k) % palHexList.length]);
        _colA.lerp(_colB, 0.32);
        const lumBump = 0.90 + height01 * 0.18 + (detRand(seed + 23.1) - 0.5) * 0.12;
        aLeafColor[idx * 3] = clamp(_colA.r * lumBump, 0.02, 1.35);
        aLeafColor[idx * 3 + 1] = clamp(_colA.g * lumBump, 0.02, 1.35);
        aLeafColor[idx * 3 + 2] = clamp(_colA.b * lumBump, 0.02, 1.35);

        idx++;
      }
    }

    cardGeo.setAttribute('aCanopyCenter', new THREE.InstancedBufferAttribute(aCanopyCenter, 3));
    cardGeo.setAttribute('aLeafPhase', new THREE.InstancedBufferAttribute(aLeafPhase, 1));
    cardGeo.setAttribute('aLeafAO', new THREE.InstancedBufferAttribute(aLeafAO, 1));
    cardGeo.setAttribute('aLeafColor', new THREE.InstancedBufferAttribute(aLeafColor, 3));
    inst.instanceMatrix.needsUpdate = true;

    canopyFullCount = idx;
    inst.count = Math.max(1, Math.round(canopyFullCount * clamp(detailLevel, 0.35, 1.0)));

    canopyParent = mapRoot;
    mapRoot.add(inst);
    canopyMesh = inst;
    syncFogUniforms(scene, canopyUniforms);

    return inst;
  }

  // =========================================================================
  // 3. SELECTIVE STYLIZED INK-EDGE OUTLINES (Inverted-Hull Distance-Scaled)
  // =========================================================================
  let outlineScale = 1.0;
  const activeOutlines = new Set();
  const outlineMatCache = new Map();

  const sharedOutlineUniforms = {
    uOutlineScale: { value: 1.0 },
    uFogMode: { value: 0 },
    uFogColor: { value: THREE ? new THREE.Color(0xdbeeff) : null },
    uFogNear: { value: 45 },
    uFogFar: { value: 150 },
    uFogDensity: { value: 0.012 },
  };

  function getOutlineMaterial(colorHex = 0x261d2b, thicknessMul = 1.0) {
    if (!THREE) return null;
    const key = `${colorHex.toString(16)}_${thicknessMul.toFixed(2)}`;
    if (outlineMatCache.has(key)) return outlineMatCache.get(key);

    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: true,
      transparent: false,
      fog: false,
      uniforms: {
        uOutlineColor: { value: new THREE.Color(colorHex) },
        uOutlineScale: sharedOutlineUniforms.uOutlineScale,
        uThicknessMul: { value: thicknessMul },
        uFogMode: sharedOutlineUniforms.uFogMode,
        uFogColor: sharedOutlineUniforms.uFogColor,
        uFogNear: sharedOutlineUniforms.uFogNear,
        uFogFar: sharedOutlineUniforms.uFogFar,
        uFogDensity: sharedOutlineUniforms.uFogDensity,
      },
      vertexShader: /* glsl */ `
        uniform float uOutlineScale;
        uniform float uThicknessMul;

        varying vec3 vWorldPos;

        void main() {
          vec4 wp = modelMatrix * vec4( position, 1.0 );
          float dist = length( cameraPosition - wp.xyz );
          float extrude = clamp( dist * 0.0042, 0.012, 0.055 ) * uOutlineScale * uThicknessMul;
          vec3 worldN = mat3( modelMatrix ) * normal;
          float nLen = length( worldN );
          if ( nLen > 0.0001 ) {
            wp.xyz += ( worldN / nLen ) * extrude;
          }
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uOutlineColor;
        uniform float uOutlineScale;
        uniform int uFogMode;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        uniform float uFogDensity;

        varying vec3 vWorldPos;

        void main() {
          if ( uOutlineScale <= 0.001 ) discard;
          vec3 col = uOutlineColor;
          if ( uFogMode > 0 ) {
            float fDist = length( cameraPosition - vWorldPos );
            float fogF = 0.0;
            if ( uFogMode == 1 ) {
              fogF = smoothstep( uFogNear, uFogFar, fDist );
            } else {
              fogF = 1.0 - exp( -uFogDensity * uFogDensity * fDist * fDist );
            }
            col = mix( col, uFogColor, clamp( fogF, 0.0, 1.0 ) );
          }
          gl_FragColor = vec4( col, 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    outlineMatCache.set(key, mat);
    return mat;
  }

  function attachHeroOutlines(root, opts = {}) {
    if (!THREE || !root || typeof root.traverse !== 'function') return 0;
    const colorHex = opts.color ?? 0x261d2b; // Dark warm-sepia/indigo (never harsh black)
    const thicknessMul = opts.thickness ?? 1.0;
    const minRadius = opts.minRadius ?? 0.08;
    const outlineMat = getOutlineMaterial(colorHex, thicknessMul);
    if (!outlineMat) return 0;

    // Collect candidates first so adding child outlines never mutates active traversal
    const targets = [];
    root.traverse((obj) => {
      if (!obj || !obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh) return;
      if (obj.isSprite || obj.isPoints) return;
      if (obj.userData?._isContactShadow || obj.userData?._isOutline || obj.userData?._skipOutline) return;
      if (obj.userData?._outlineMesh && obj.userData._outlineMesh.parent === obj) return;

      const geo = obj.geometry;
      if (!geo || !geo.attributes || !geo.attributes.position) return;

      const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (!mat) return;
      if (mat.isSpriteMaterial || mat.isPointsMaterial) return;
      if (mat.transparent && (mat.opacity ?? 1) < 0.85) return;
      if (mat.blending === THREE.AdditiveBlending) return;

      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const rawR = geo.boundingSphere ? geo.boundingSphere.radius : 0;
      const sx = Math.abs(obj.scale?.x ?? 1);
      const sy = Math.abs(obj.scale?.y ?? 1);
      const sz = Math.abs(obj.scale?.z ?? 1);
      const effR = rawR * Math.max(sx, sy, sz);
      if (effR < minRadius) return;

      targets.push(obj);
    });

    let attached = 0;
    const vis = outlineScale > 0.001;
    for (let i = 0; i < targets.length; i++) {
      const host = targets[i];
      const outline = new THREE.Mesh(host.geometry, outlineMat);
      outline.name = `${host.name || 'hero'}_ink_outline`;
      outline.castShadow = false;
      outline.receiveShadow = false;
      outline.raycast = () => {};
      outline.visible = vis;
      outline.userData._isOutline = true;
      outline.userData._skipPainterly = true;
      outline.userData.noSolid = true;
      host.add(outline);
      host.userData._outlineMesh = outline;
      activeOutlines.add(outline);
      attached++;
    }
    return attached;
  }

  function removeHeroOutlines(root) {
    if (!root || typeof root.traverse !== 'function') return 0;
    const toRemove = [];
    root.traverse((obj) => {
      if (obj && obj.userData?._isOutline) {
        toRemove.push(obj);
      }
    });
    for (let i = 0; i < toRemove.length; i++) {
      const m = toRemove[i];
      const p = m.parent;
      if (p) {
        if (p.userData && p.userData._outlineMesh === m) {
          delete p.userData._outlineMesh;
        }
        p.remove(m);
      }
      activeOutlines.delete(m);
    }
    return toRemove.length;
  }

  function setOutlineScale(scale) {
    outlineScale = Math.max(0, Number(scale) || 0);
    sharedOutlineUniforms.uOutlineScale.value = outlineScale;
    const vis = outlineScale > 0.001;
    for (const m of activeOutlines) {
      if (!m || !m.parent) {
        activeOutlines.delete(m);
      } else {
        m.visible = vis;
      }
    }
  }

  // =========================================================================
  // 4. SPARKLING STYLIZED WATER SHADER (`enhanceWorldWater`)
  // =========================================================================
  const upgradedWaterMats = new WeakSet();
  const waterSharedUniforms = {
    uHsWaterTime: { value: 0 },
    uHsWaterSunDir: { value: THREE ? new THREE.Vector3(0.5, 0.75, 0.35).normalize() : { x: 0.5, y: 0.75, z: 0.35 } },
    uHsWaterSunColor: { value: THREE ? new THREE.Color(0xfff4d6) : null },
    uHsWaterSkyColor: { value: THREE ? new THREE.Color(0xaadfff) : null },
    uHsWaterFoamColor: { value: THREE ? new THREE.Color(0xf4fdff) : null },
    uHsWaterStrength: { value: 1.0 },
    uHsWaterWaveAmp: { value: 0.034 },
  };

  function upgradeWaterMaterial(mat) {
    if (!THREE || !mat || upgradedWaterMats.has(mat)) return false;
    if (!(mat.isMeshLambertMaterial || mat.isMeshPhongMaterial || mat.isMeshStandardMaterial)) return false;
    upgradedWaterMats.add(mat);

    const cacheKey = `hs_tier1_water_v1_${mat.type}`;
    mat.customProgramCacheKey = () => cacheKey;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uHsWaterTime = waterSharedUniforms.uHsWaterTime;
      shader.uniforms.uHsWaterSunDir = waterSharedUniforms.uHsWaterSunDir;
      shader.uniforms.uHsWaterSunColor = waterSharedUniforms.uHsWaterSunColor;
      shader.uniforms.uHsWaterSkyColor = waterSharedUniforms.uHsWaterSkyColor;
      shader.uniforms.uHsWaterFoamColor = waterSharedUniforms.uHsWaterFoamColor;
      shader.uniforms.uHsWaterStrength = waterSharedUniforms.uHsWaterStrength;
      shader.uniforms.uHsWaterWaveAmp = waterSharedUniforms.uHsWaterWaveAmp;

      // Inject unique water varyings & GPU multi-wave vertex undulation (Lambert/Phong/Standard safe)
      shader.vertexShader =
        `uniform float uHsWaterTime;
        uniform float uHsWaterStrength;
        uniform float uHsWaterWaveAmp;
        varying vec3 vHsWaterWorldPos;
        varying vec3 vHsWaterWorldNorm;
        varying vec3 vHsWaterLocalPos;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vHsWaterLocalPos = position;
          vec4 hsWatWp = vec4( transformed, 1.0 );
          vec3 hsWatNorm = objectNormal;
          #ifdef USE_INSTANCING
            hsWatWp = instanceMatrix * hsWatWp;
            hsWatNorm = mat3( instanceMatrix ) * hsWatNorm;
          #endif
          hsWatWp = modelMatrix * hsWatWp;
          float hsWav1 = sin( hsWatWp.x * 1.45 + uHsWaterTime * 1.85 + cos( hsWatWp.z * 1.15 - uHsWaterTime * 1.10 ) * 0.85 );
          float hsWav2 = cos( hsWatWp.z * 2.05 - uHsWaterTime * 2.20 + hsWatWp.x * 0.72 ) * 0.52;
          float hsWavH = ( hsWav1 + hsWav2 ) * uHsWaterWaveAmp * uHsWaterStrength;
          transformed += objectNormal * hsWavH;
          hsWatWp.y += hsWavH;
          vHsWaterWorldPos = hsWatWp.xyz;
          vHsWaterWorldNorm = normalize( mat3( modelMatrix ) * hsWatNorm );`
        );

      // Inject dual-layer Voronoi + interference caustics, shoreline foam, Fresnel sky & sun sparkles
      shader.fragmentShader =
        `uniform float uHsWaterTime;
        uniform float uHsWaterStrength;
        uniform vec3 uHsWaterSunDir;
        uniform vec3 uHsWaterSunColor;
        uniform vec3 uHsWaterSkyColor;
        uniform vec3 uHsWaterFoamColor;
        varying vec3 vHsWaterWorldPos;
        varying vec3 vHsWaterWorldNorm;
        varying vec3 vHsWaterLocalPos;

        vec2 hsWaterHash22( vec2 p ) {
          vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
          p3 += dot( p3, p3.yzx + 33.33 );
          return fract( ( p3.xx + p3.yz ) * p3.zy );
        }

        float hsWaterVoronoiRidge( vec2 uv, float t ) {
          vec2 g = floor( uv );
          vec2 f = fract( uv );
          float d1 = 1.0;
          float d2 = 1.0;
          for ( int iy = -1; iy <= 1; iy++ ) {
            for ( int ix = -1; ix <= 1; ix++ ) {
              vec2 lat = vec2( float( ix ), float( iy ) );
              vec2 rnd = hsWaterHash22( g + lat );
              vec2 off = 0.5 + 0.42 * sin( t * 1.15 + 6.28318 * rnd );
              float d = length( lat + off - f );
              if ( d < d1 ) {
                d2 = d1;
                d1 = d;
              } else if ( d < d2 ) {
                d2 = d;
              }
            }
          }
          return 1.0 - smoothstep( 0.02, 0.24, d2 - d1 );
        }\n` +
        shader.fragmentShader.replace(
          '#include <fog_fragment>',
          `{
            vec3 hsWp = vHsWaterWorldPos;
            float hsWt = uHsWaterTime;
            float hsWStr = clamp( uHsWaterStrength, 0.0, 1.25 );

            // 1. Animated Dual-Layer Voronoi + Interference Sunlight Caustics
            vec2 hsC1Uv = hsWp.xz * 0.72 + vec2( hsWt * 0.17, -hsWt * 0.12 );
            float hsVor = hsWaterVoronoiRidge( hsC1Uv, hsWt );
            vec2 hsC2Uv = hsWp.xz * 1.25 + vec2( -hsWt * 0.28, hsWt * 0.21 );
            float hsInterf = abs( sin( hsC2Uv.x + sin( hsC2Uv.y * 1.3 + hsWt * 1.4 ) ) * cos( hsC2Uv.y - cos( hsC2Uv.x * 1.1 - hsWt * 1.2 ) ) );
            float hsInterfWeb = pow( clamp( 1.0 - hsInterf, 0.0, 1.0 ), 3.2 );
            float hsCaustic = clamp( hsVor * 0.68 + hsInterfWeb * 0.52, 0.0, 1.0 );
            gl_FragColor.rgb += mix( uHsWaterFoamColor, uHsWaterSunColor, 0.42 ) * ( hsCaustic * 0.24 * hsWStr );

            // 2. Stylized Animated Shoreline / Edge Foam Patterns
            float hsFlow = sin( hsWp.x * 1.55 + hsWp.z * 1.15 - hsWt * 1.85 + sin( hsWp.z * 2.25 + hsWt * 1.1 ) * 1.35 );
            float hsRippleBand = smoothstep( 0.68, 0.96, hsFlow * 0.5 + 0.5 );
            float hsEdgeRing = smoothstep( 0.52, 0.94, abs( sin( length( vHsWaterLocalPos.xz ) * 2.1 - hsWt * 1.35 + hsFlow * 0.6 ) ) );
            float hsFoamMask = clamp( ( hsRippleBand * ( 0.42 + 0.58 * hsVor ) + hsEdgeRing * 0.22 * hsInterfWeb ) * hsWStr, 0.0, 0.68 );
            gl_FragColor.rgb = mix( gl_FragColor.rgb, uHsWaterFoamColor, hsFoamMask * 0.52 );

            // 3. Perturbed Ripple Normal -> View-Angle Fresnel Sky Reflection
            vec3 hsWNorm = normalize( vHsWaterWorldNorm + vec3(
              cos( hsWp.x * 2.35 + hsWt * 2.15 ) * 0.085 + sin( hsWp.z * 3.10 - hsWt * 1.75 ) * 0.06,
              0.0,
              sin( hsWp.z * 2.55 - hsWt * 1.90 ) * 0.085 + cos( hsWp.x * 2.85 + hsWt * 2.25 ) * 0.06
            ) * hsWStr );
            vec3 hsViewW = normalize( cameraPosition - hsWp );
            float hsFres = pow( 1.0 - clamp( dot( hsWNorm, hsViewW ), 0.0, 1.0 ), 3.0 );
            gl_FragColor.rgb = mix( gl_FragColor.rgb, uHsWaterSkyColor, clamp( hsFres * 0.54 * hsWStr, 0.0, 0.62 ) );

            // 4. Sun Specular Glint Sparkles
            vec3 hsHalf = normalize( normalize( uHsWaterSunDir ) + hsViewW );
            float hsSpec = pow( max( dot( hsWNorm, hsHalf ), 0.0 ), 60.0 );
            float hsSparkN = sin( hsWp.x * 13.5 + hsWt * 4.4 ) * cos( hsWp.z * 12.8 - hsWt * 3.8 ) * sin( ( hsWp.x - hsWp.z ) * 9.2 + hsWt * 5.0 );
            float hsGlint = smoothstep( 0.42, 0.86, hsSparkN ) * pow( max( dot( hsWNorm, hsHalf ), 0.0 ), 16.0 );
            gl_FragColor.rgb += uHsWaterSunColor * ( hsSpec * 0.58 + hsGlint * 1.05 ) * hsWStr;
          }
          #include <fog_fragment>`
        );
    };
    mat.needsUpdate = true;
    return true;
  }

  function enhanceWorldWater(mapRoot, mapId = 'meadow') {
    if (!THREE || !mapRoot || typeof mapRoot.traverse !== 'function') return 0;

    const pal = WORLD_FOLIAGE_PALETTES[mapId] || WORLD_FOLIAGE_PALETTES.meadow;
    if (pal.water) {
      waterSharedUniforms.uHsWaterSkyColor.value.setHex(pal.water.skyTint);
      waterSharedUniforms.uHsWaterFoamColor.value.setHex(pal.water.foamColor);
      waterSharedUniforms.uHsWaterWaveAmp.value = pal.water.waveAmp;
      waterSharedUniforms.uHsWaterStrength.value = pal.water.strength * clamp(detailLevel, 0.35, 1.0);
    }

    mapRoot.updateMatrixWorld(true);
    let upgradedCount = 0;

    mapRoot.traverse((obj) => {
      if (!obj || !obj.isMesh || !obj.visible || !obj.geometry || !obj.material) return;
      if (
        obj.userData?._isTier1Canopy ||
        obj.userData?._isOutline ||
        obj.userData?._isContactShadow ||
        obj.userData?.isRoof ||
        obj.userData?.propRoot
      ) {
        return;
      }

      const objName = obj.name || '';
      const parentName = obj.parent?.name || '';
      if (WATER_EXCLUDE_NAME_RE.test(objName)) return;

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const geo = obj.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) return;

      _box3.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
      _box3.getSize(_vec3C);

      const horizMax = Math.max(_vec3C.x, _vec3C.z);
      const horizMin = Math.min(_vec3C.x, _vec3C.z);

      // Skip sky domes and vertical walls
      if (_vec3C.y > 4.5 || horizMax > 180) return;
      if (horizMax < 0.35) return;
      const isHorizontal = _vec3C.y <= Math.max(0.85, horizMin * 0.32);
      if (!isHorizontal) return;

      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i];
        if (!mat || upgradedWaterMats.has(mat)) continue;
        if (!(mat.isMeshLambertMaterial || mat.isMeshPhongMaterial || mat.isMeshStandardMaterial)) continue;
        if (mat.side === THREE.BackSide && horizMax > 40) continue; // Sky dome guard
        if (mat.vertexColors) continue; // Avoid mutating shared batched static world materials

        const matName = mat.name || '';
        const nameMatch =
          (WATER_NAME_RE.test(objName) || WATER_NAME_RE.test(matName) || WATER_NAME_RE.test(parentName)) &&
          !WATER_EXCLUDE_NAME_RE.test(matName);

        let colorMatch = false;
        if (mat.color) {
          const sr = linearToSrgb(mat.color.r);
          const sg = linearToSrgb(mat.color.g);
          const sb = linearToSrgb(mat.color.b);
          colorMatch = isWaterSrgb(sr, sg, sb);
        }

        if (nameMatch || colorMatch) {
          if (upgradeWaterMaterial(mat)) {
            upgradedCount++;
          }
        }
      }
    });

    return upgradedCount;
  }

  // =========================================================================
  // 5. INTERACTIVE PLAYER-BENDING GRASS UNIFORMS
  // =========================================================================
  const BENDER_SLOTS = 6;
  const grassBenderUniforms = {
    uBenders: {
      value: Array.from({ length: BENDER_SLOTS }, () =>
        THREE ? new THREE.Vector4(0, -999, 0, 0) : { x: 0, y: -999, z: 0, w: 0 }
      ),
    },
  };

  // Preallocated scratch buffer for zero-GC per-frame nearest-6 selection
  const _benderCandidates = [];
  for (let i = 0; i < 32; i++) {
    _benderCandidates.push({ x: 0, y: 0, z: 0, r: 0, distSq: 0 });
  }

  function updateGrassBenders(chars, cameraPos = null) {
    const slots = grassBenderUniforms.uBenders.value;
    const camX = cameraPos ? (cameraPos.x ?? 0) : 0;
    const camY = cameraPos ? (cameraPos.y ?? 0) : 0;
    const camZ = cameraPos ? (cameraPos.z ?? 0) : 0;

    let count = 0;
    if (chars) {
      const list = Array.isArray(chars) ? chars : (typeof chars[Symbol.iterator] === 'function' ? chars : null);
      if (list) {
        for (const ch of list) {
          if (!ch || !ch.position) continue;
          if (ch.visible === false) continue;
          if (ch.userData?.actor?.eliminated || ch.userData?.eliminated) continue;

          const x = ch.position.x;
          const y = typeof ch.userData?.footY === 'number' ? ch.userData.footY : ch.position.y;
          const z = ch.position.z;
          const baseR = typeof ch.userData?.radius === 'number' ? ch.userData.radius : 0.48;
          const bendR = clamp(baseR * 2.15, 0.85, 2.25);

          const dx = x - camX;
          const dy = y - camY;
          const dz = z - camZ;
          const distSq = dx * dx + dy * dy + dz * dz;

          let entry;
          if (count < _benderCandidates.length) {
            entry = _benderCandidates[count];
          } else {
            entry = { x: 0, y: 0, z: 0, r: 0, distSq: 0 };
            _benderCandidates.push(entry);
          }
          entry.x = x;
          entry.y = y;
          entry.z = z;
          entry.r = bendR;
          entry.distSq = distSq;
          count++;
        }
      }
    }

    // Partial selection sort for the 6 closest living characters (no array allocations)
    const take = Math.min(BENDER_SLOTS, count);
    for (let i = 0; i < take; i++) {
      let best = i;
      let bestD = _benderCandidates[i].distSq;
      for (let j = i + 1; j < count; j++) {
        if (_benderCandidates[j].distSq < bestD) {
          bestD = _benderCandidates[j].distSq;
          best = j;
        }
      }
      if (best !== i) {
        const tmp = _benderCandidates[i];
        _benderCandidates[i] = _benderCandidates[best];
        _benderCandidates[best] = tmp;
      }
      const c = _benderCandidates[i];
      if (typeof slots[i].set === 'function') {
        slots[i].set(c.x, c.y, c.z, c.r);
      } else {
        slots[i].x = c.x;
        slots[i].y = c.y;
        slots[i].z = c.z;
        slots[i].w = c.r;
      }
    }

    for (let i = take; i < BENDER_SLOTS; i++) {
      if (typeof slots[i].set === 'function') {
        slots[i].set(0, -999, 0, 0);
      } else {
        slots[i].x = 0;
        slots[i].y = -999;
        slots[i].z = 0;
        slots[i].w = 0;
      }
    }

    return take;
  }

  /**
   * Convenience helper to wire `GRASS_BEND_VERTEX_GLSL` onto an existing grass
   * material whose `onBeforeCompile` defines `vH` and `wp`.
   */
  function patchGrassMaterial(mat) {
    if (!mat || mat.userData?._tier1GrassPatched) return mat;
    const prevOBC = mat.onBeforeCompile;
    mat.userData = mat.userData || {};
    mat.userData._tier1GrassPatched = true;
    mat.onBeforeCompile = (sh, renderer) => {
      if (typeof prevOBC === 'function') prevOBC.call(mat, sh, renderer);
      sh.uniforms.uBenders = grassBenderUniforms.uBenders;
      if (!sh.vertexShader.includes('uBenders')) {
        sh.vertexShader = GRASS_BEND_UNIFORM_DECL + sh.vertexShader;
      }
      if (sh.vertexShader.includes('transformed.z += sway')) {
        sh.vertexShader = sh.vertexShader.replace(
          /(transformed\.z\s*\+=\s*sway[^\n;]*;)/,
          `$1\n${GRASS_BEND_VERTEX_GLSL}`
        );
      } else if (sh.vertexShader.includes('#include <begin_vertex>')) {
        sh.vertexShader = sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n${GRASS_BEND_VERTEX_GLSL}`
        );
      }
    };
    mat.customProgramCacheKey = () => 'hs_grass_tier1_bend_v1';
    mat.needsUpdate = true;
    return mat;
  }

  // =========================================================================
  // Lifecycle: Quality Tier Scaling, Frame Update & Cleanup
  // =========================================================================
  function setDetailLevel(tier = 'ultra', liteLevel = 0) {
    if (liteLevel >= 2) detailLevel = 0.0;
    else if (liteLevel === 1) detailLevel = 0.45;
    else if (tier === 'balanced') detailLevel = 0.78;
    else detailLevel = 1.0;

    // Lite Tier 2 disables hero ink outlines cleanly (0.0)
    if (liteLevel >= 2) setOutlineScale(0.0);
    else if (liteLevel === 1) setOutlineScale(0.75);
    else if (tier === 'balanced') setOutlineScale(0.90);
    else setOutlineScale(1.0);

    canopyUniforms.uWindStrength.value = detailLevel >= 0.4 ? (0.5 + 0.5 * detailLevel) : 0.0;
    if (canopyMesh && canopyFullCount > 0) {
      canopyMesh.visible = true;
      canopyMesh.count = Math.max(1, Math.round(canopyFullCount * clamp(detailLevel, 0.35, 1.0)));
    }

    const wBase = activePalette.water?.strength ?? 1.0;
    waterSharedUniforms.uHsWaterStrength.value = wBase * clamp(detailLevel, 0.35, 1.0);
  }

  function update(dt = 0) {
    const safeDt = clamp(Number(dt) || 0, 0, 0.1);
    accTime += safeDt;

    canopyUniforms.uTime.value = accTime;
    waterSharedUniforms.uHsWaterTime.value = accTime;

    if (sun && sun.position) {
      if (canopyUniforms.uSunDir.value && canopyUniforms.uSunDir.value.copy) {
        canopyUniforms.uSunDir.value.copy(sun.position).normalize();
        waterSharedUniforms.uHsWaterSunDir.value.copy(canopyUniforms.uSunDir.value);
      }
      if (sun.color) {
        if (canopyUniforms.uSunColor.value) canopyUniforms.uSunColor.value.copy(sun.color);
        if (waterSharedUniforms.uHsWaterSunColor.value) waterSharedUniforms.uHsWaterSunColor.value.copy(sun.color);
      }
    }

    syncFogUniforms(scene, canopyUniforms);
    syncFogUniforms(scene, sharedOutlineUniforms);
  }

  function pruneOutlines() {
    for (const o of Array.from(activeOutlines)) {
      if (!o || !o.parent) {
        activeOutlines.delete(o);
      } else {
        let p = o.parent;
        while (p && p.parent) p = p.parent;
        if (p !== scene) activeOutlines.delete(o);
      }
    }
    return activeOutlines.size;
  }

  function clearWorld() {
    disposeCanopyMesh();
    pruneOutlines();
  }

  function dispose() {
    disposeCanopyMesh();
    for (const m of activeOutlines) {
      if (m && m.parent) m.parent.remove(m);
    }
    activeOutlines.clear();
    if (canopyMat) {
      canopyMat.dispose();
      canopyMat = null;
    }
    for (const mat of outlineMatCache.values()) {
      mat.dispose();
    }
    outlineMatCache.clear();
  }

  return {
    // 1. Fluffy Stylized Tree Canopies
    enhanceWorldTrees,
    // 3. Selective Stylized Ink-Edge Outlines
    attachHeroOutlines,
    removeHeroOutlines,
    pruneOutlines,
    setOutlineScale,
    // 4. Sparkling Stylized Water Shader
    enhanceWorldWater,
    // 5. Interactive Player-Bending Grass
    grassBenderUniforms,
    updateGrassBenders,
    patchGrassMaterial,
    // Shared Lifecycle
    setDetailLevel,
    update,
    clearWorld,
    dispose,
    // Inspection helpers
    getCanopyMesh: () => canopyMesh,
    getOutlineScale: () => outlineScale,
    getStats: () => ({
      canopyCards: canopyMesh ? canopyMesh.count : 0,
      canopyFullCount,
      activeOutlines: activeOutlines.size,
      outlineScale,
      activeMapId,
    }),
  };
}
