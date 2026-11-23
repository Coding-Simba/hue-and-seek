/* ==========================================================================
 * Hue & Seek — Breathtaking Storybook Graphics Engine (`painterly_gfx.js`)
 *
 * Mobile-first 60 FPS AAA visual pipeline (zero extra world draw calls):
 *   1. Procedural Storybook Sky Dome (Sun Disc, Mie Atmospheric Halo,
 *      Drifting Multi-Octave Painted Cumulus Clouds, & Twilight Starfield).
 *   2. Global Painterly Material Upgrade (`onBeforeCompile` shared uniforms):
 *      Cool Sky-Indigo Shadow Tint, Warm Sunlit Fresnel Rim Light, Rolling
 *      Cloud-Shadow Gobos, World-Space Brush Macro-Variation, & Height-Based
 *      Golden Valley Mist with Sun In-Scattering.
 *   3. Procedural Sky-to-Ground PMREM IBL Environment Reflection Map per World.
 *   4. Crisp 512px Paired Grayscale Relief/Bump Texture Generator.
 *   5. Volumetric God-Ray Sunbeam Shafts + Single-Draw-Call Animated 3D
 *      Butterfly / Blossom / Lantern-Moth Swarm (vertex-shader wing flap!).
 *   6. Fused Storybook Filmic Color-Grade + Smart Vibrance Post Pass.
 * ========================================================================== */

import { GROUND_AO_AND_RAMP_GLSL } from './tier1_visuals.js?v=2';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Per-world living ambiance palette for butterflies / fireflies / petals / sparks.
 */
export const WORLD_LIFE_PALETTES = {
  meadow: {
    kind: 'butterfly',
    colors: [0xffd84d, 0xff8fab, 0x72efdd, 0xfff3b0, 0xffb703],
    rimColor: 0xffe4a8,
    shadowTint: 0x5c72b8,
    mistColor: 0xffeacc,
    beamColor: 0xfff0c2,
    twilightBase: 0.0,
    cloudAmt: 1.0,
  },
  bathhouse: {
    kind: 'moth',
    colors: [0xffb74d, 0xff7b54, 0xffe082, 0xff5e7e, 0xffd166],
    rimColor: 0xffb36b,
    shadowTint: 0x3b3d82,
    mistColor: 0xffc49b,
    beamColor: 0xffc680,
    twilightBase: 0.42,
    cloudAmt: 0.72,
  },
  seaplane: {
    kind: 'butterfly',
    colors: [0xffffff, 0x7ce8ff, 0xffe169, 0xffa69e, 0x90f1ef],
    rimColor: 0xffdc9a,
    shadowTint: 0x245c9c,
    mistColor: 0x9ad8fc,
    beamColor: 0xffeec4,
    twilightBase: 0.0,
    cloudAmt: 0.85,
    mistScale: 0.40,
    envIntensity: 0.20,
    bloomThreshold: 0.98,
    bloomStrength: 0.20,
  },
  skyruins: {
    kind: 'sprite',
    colors: [0x9bf6ff, 0xcaffbf, 0xffd6a5, 0xbdb2ff, 0xfffffc],
    rimColor: 0xbce6ff,
    shadowTint: 0x3b4d96,
    mistColor: 0xbce0ff,
    beamColor: 0xdcf4ff,
    twilightBase: 0.25,
    cloudAmt: 1.0,
    mistScale: 0.42,
    envIntensity: 0.22,
    bloomThreshold: 0.96,
    bloomStrength: 0.22,
  },
  clockwork: {
    kind: 'petal',
    colors: [0xff9f43, 0xffc048, 0xe17055, 0xfdcb6e, 0xd63031],
    rimColor: 0xffcf88,
    shadowTint: 0x5d4d82,
    mistColor: 0xffe2be,
    beamColor: 0xffdca0,
    twilightBase: 0.14,
    cloudAmt: 0.78,
  },
  tinyfolk: {
    kind: 'butterfly',
    colors: [0xc7f9cc, 0xffe66d, 0xffb4a2, 0x80ed99, 0xfff3b0],
    rimColor: 0xd9f5a6,
    shadowTint: 0x2e5e56,
    mistColor: 0xe2f0be,
    beamColor: 0xf0f2b0,
    twilightBase: 0.08,
    cloudAmt: 0.65,
    mistScale: 0.32,
    envIntensity: 0.18,
    bloomThreshold: 0.98,
    bloomStrength: 0.18,
  },
};

/**
 * Generates a paired grayscale bump/relief CanvasTexture from an existing 2D canvas.
 */
export function buildReliefBumpTexture(THREE, srcCanvas, maxAniso = 4) {
  if (!THREE || !srcCanvas || typeof document === 'undefined') return null;
  const w = srcCanvas.width || 256;
  const h = srcCanvas.height || 256;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0, w, h);
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      // Enhance local micro-contrast for crisp grazing highlights
      const boosted = clamp(Math.round((lum - 128) * 1.45 + 128), 0, 255);
      d[i] = boosted;
      d[i + 1] = boosted;
      d[i + 2] = boosted;
    }
    ctx.putImageData(img, 0, 0);
  } catch (_) {
    // Fallback to unaltered canvas if getImageData fails
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a paired Sobel 3x3 Tangent-Space RGB Normal Map AND a Roughness Map
 * from an existing 2D albedo canvas — turns flat diffuse surfaces into true PBR!
 */
export function buildPBRMapsFromCanvas(THREE, srcCanvas, { maxAniso = 4, normalStrength = 2.4, baseRoughness = 0.72, roughVar = 0.18 } = {}) {
  if (!THREE || !srcCanvas || typeof document === 'undefined') return { normalMap: null, roughnessMap: null };
  const w = srcCanvas.width || 256;
  const h = srcCanvas.height || 256;
  const srcCv = document.createElement('canvas');
  srcCv.width = w; srcCv.height = h;
  const srcCtx = srcCv.getContext('2d');
  srcCtx.drawImage(srcCanvas, 0, 0, w, h);

  const normCv = document.createElement('canvas');
  normCv.width = w; normCv.height = h;
  const normCtx = normCv.getContext('2d');

  const roughCv = document.createElement('canvas');
  roughCv.width = w; roughCv.height = h;
  const roughCtx = roughCv.getContext('2d');

  try {
    const srcImg = srcCtx.getImageData(0, 0, w, h);
    const sd = srcImg.data;
    const lum = new Float32Array(w * h);
    for (let i = 0, p = 0; i < sd.length; i += 4, p++) {
      lum[p] = (sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114) / 255;
    }

    const normImg = normCtx.createImageData(w, h);
    const nd = normImg.data;
    const roughImg = roughCtx.createImageData(w, h);
    const rd = roughImg.data;

    const sample = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tl = sample(x - 1, y - 1), tc = sample(x, y - 1), tr = sample(x + 1, y - 1);
        const ml = sample(x - 1, y),     mc = sample(x, y),     mr = sample(x + 1, y);
        const bl = sample(x - 1, y + 1), bc = sample(x, y + 1), br = sample(x + 1, y + 1);

        const dx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        const dy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
        let nx = -dx * normalStrength;
        let ny = -dy * normalStrength;
        let nz = 1.0;
        const invLen = 1.0 / Math.hypot(nx, ny, nz);
        nx *= invLen; ny *= invLen; nz *= invLen;

        const idx = (y * w + x) * 4;
        nd[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        nd[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        nd[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        nd[idx + 3] = 255;

        // Higher/brighter stone or tile tops are smoother (lower roughness); mortar/crevices are rougher!
        const rv = clamp(baseRoughness + (0.55 - mc) * roughVar * 2.0, 0.22, 0.98);
        const rByte = Math.round(rv * 255);
        rd[idx] = rByte;
        rd[idx + 1] = rByte;
        rd[idx + 2] = rByte;
        rd[idx + 3] = 255;
      }
    }
    normCtx.putImageData(normImg, 0, 0);
    roughCtx.putImageData(roughImg, 0, 0);
  } catch (_) {
    return { normalMap: null, roughnessMap: null };
  }

  const normalMap = new THREE.CanvasTexture(normCv);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.anisotropy = maxAniso;
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCv);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAniso;
  roughnessMap.needsUpdate = true;

  return { normalMap, roughnessMap };
}

/**
 * Creates the Storybook Filmic Color-Grade + Smart Vibrance + Steam PC Real-Time SSAO ShaderPass definition.
 */
export function createStorybookColorGradeShader() {
  return {
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      uTime: { value: 0 },
      uStrength: { value: 1.0 },
      uAoStrength: { value: 0.0 },
      uCameraNear: { value: 0.08 },
      uCameraFar: { value: 400.0 },
      uTexelSize: { value: [1 / 1280, 1 / 720] },
      uTwilight: { value: 0.0 },
      uWarmTint: { value: [1.03, 1.005, 0.96] },
      uCoolShadow: { value: [0.95, 0.985, 1.06] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform float uStrength;
      uniform float uAoStrength;
      uniform float uCameraNear;
      uniform float uCameraFar;
      uniform vec2 uTexelSize;
      uniform float uTwilight;
      uniform vec3 uWarmTint;
      uniform vec3 uCoolShadow;
      varying vec2 vUv;

      float linearizeDepth(float d) {
        float z = d * 2.0 - 1.0;
        return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
      }

      void main() {
        vec4 src = texture2D(tDiffuse, vUv);
        vec3 col = src.rgb;
        if (uStrength <= 0.01) {
          gl_FragColor = src;
          return;
        }

        // 0. Steam PC Real-Time Depth-Based Contact SSAO (12-tap Vogel spiral, range-guarded, 0 sky halos!)
        if (uAoStrength > 0.01) {
          float rawC = texture2D(tDepth, vUv).r;
          if (rawC < 0.9992) {
            float centerZ = linearizeDepth(rawC);
            if (centerZ < 72.0) {
              float radiusPx = clamp(24.0 / max(centerZ * 0.28, 1.0), 3.0, 13.0);
              float occ = 0.0;
              float valid = 0.0;
              // 12-tap deterministic golden-angle spiral
              for (int i = 0; i < 12; i++) {
                float fi = float(i) + 0.5;
                float r = sqrt(fi / 12.0) * radiusPx;
                float ang = fi * 2.39996323;
                vec2 off = vec2(cos(ang), sin(ang)) * r * uTexelSize;
                float sRaw = texture2D(tDepth, clamp(vUv + off, vec2(0.002), vec2(0.998))).r;
                float sZ = linearizeDepth(sRaw);
                float dz = centerZ - sZ;
                float rangeCheck = smoothstep(1.8, 0.05, abs(dz));
                occ += smoothstep(0.035, 0.34, dz) * rangeCheck;
                valid += 1.0;
              }
              float aoFactor = clamp((occ / max(valid, 1.0)) * 1.45, 0.0, 0.58) * uAoStrength;
              float distFade = 1.0 - smoothstep(42.0, 72.0, centerZ);
              vec3 aoTint = mix(vec3(0.36, 0.42, 0.58), vec3(0.28, 0.30, 0.48), uTwilight);
              col = mix(col, col * aoTint, aoFactor * distFade);
            }
          }
        }

        // 1. Smart Vibrance: gently lifts muted storybook greens/teals/golds without clipping vivid colors
        float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float maxC = max(col.r, max(col.g, col.b));
        float minC = min(col.r, min(col.g, col.b));
        float sat = maxC - minC;
        float vib = (1.0 - clamp(sat * 1.45, 0.0, 1.0)) * 0.26 * uStrength;
        col = mix(vec3(luma), col, 1.0 + vib);

        // 2. Warm Highlight / Cool Shadow Split-Toning (storybook painterly balance)
        float hiMask = smoothstep(0.38, 0.90, luma);
        float loMask = 1.0 - smoothstep(0.04, 0.44, luma);
        vec3 warm = mix(uWarmTint, vec3(1.05, 0.95, 1.01), uTwilight * 0.55);
        vec3 cool = mix(uCoolShadow, vec3(0.90, 0.94, 1.12), uTwilight * 0.65);
        col *= mix(vec3(1.0), warm, hiMask * 0.46 * uStrength);
        col *= mix(vec3(1.0), cool, loMask * 0.52 * uStrength);

        // 3. Soft Filmic S-Curve micro-contrast + highlight shoulder roll-off (rich deep darks, never milky highlights!)
        vec3 curved = col * col * (3.0 - 2.0 * col);
        col = mix(col, curved, 0.22 * uStrength);
        vec3 overHi = max(col - vec3(0.84), vec3(0.0));
        col -= overHi * (0.28 * uStrength);

        // 4. Ultra-subtle atmospheric edge vignette framing
        vec2 centered = vUv - 0.5;
        float vig = 1.0 - dot(centered, centered) * (0.22 * uStrength);
        col *= clamp(vig, 0.84, 1.0);

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), src.a);
      }
    `,
  };
}

/**
 * Creates the full Breathtaking Storybook Graphics Controller.
 */
export function createPainterlyGfxManager(env = {}) {
  const { THREE, scene, renderer, sun, sky, bloomPass = null, isTouch = false } = env;

  const sharedUniforms = {
    uHsTime: { value: 0 },
    uHsSunDir: { value: THREE ? new THREE.Vector3(0.5, 0.75, 0.35).normalize() : { x: 0.5, y: 0.75, z: 0.35 } },
    uHsRimColor: { value: THREE ? new THREE.Color(0xffe4a8) : null },
    uHsShadowTint: { value: THREE ? new THREE.Color(0x5c72b8) : null },
    uHsMistColor: { value: THREE ? new THREE.Color(0xffeacc) : null },
    uHsRimStrength: { value: 0.62 },
    uHsCloudStrength: { value: 0.95 },
    uHsMistStrength: { value: 0.22 },
    uHsMacroStrength: { value: 0.05 },
  };

  let detailLevel = 1.0; // 1.0 = Ultra, 0.72 = Balanced, 0.32 = Lite 1, 0.0 = Lite 2
  let activeMapId = 'meadow';
  let activePalette = WORLD_LIFE_PALETTES.meadow;

  // --- 1. Upgrade Sky Dome to Animated Storybook Sky (Sun Disc + Mie Halo + Drifting Clouds + Twilight Stars)
  let skyUniforms = null;
  function upgradeSkyDome() {
    if (!THREE || !sky || !sky.material) return;
    const prevU = sky.material.uniforms || {};
    const topCol = prevU.top?.value ? prevU.top.value.clone() : new THREE.Color(0x5aa6e6);
    const midCol = prevU.mid?.value ? prevU.mid.value.clone() : new THREE.Color(0xc4e3f3);
    const lowCol = prevU.low?.value ? prevU.low.value.clone() : new THREE.Color(0xf7e6c4);

    skyUniforms = {
      top: { value: topCol },
      mid: { value: midCol },
      low: { value: lowCol },
      uTime: { value: 0 },
      uSunDir: { value: sharedUniforms.uHsSunDir.value.clone() },
      uSunColor: { value: new THREE.Color(0xfff1c9) },
      uTwilight: { value: 0.0 },
      uCloudAmt: { value: 1.0 },
    };

    const newSkyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 top, mid, low, uSunDir, uSunColor;
        uniform float uTime, uTwilight, uCloudAmt;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float cloudFbm(vec2 p) {
          float v = 0.0;
          v += 0.55 * vnoise(p);
          v += 0.30 * vnoise(p * 2.13 + vec2(4.2, 1.7));
          v += 0.15 * vnoise(p * 4.35 - vec2(1.8, 3.1));
          return v;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = dir.y;

          // Rich 3-stop storybook zenith -> mid -> warm horizon gradient
          vec3 c = h > 0.0
            ? mix(mid, top, smoothstep(0.01, 0.58, h))
            : mix(mid, low, smoothstep(0.0, -0.16, h));

          // Warm horizon atmospheric glow band
          float horizonBand = exp(-abs(h) * 8.5);
          c = mix(c, mix(low, uSunColor, 0.35), horizonBand * 0.42);

          // Radiant Sun Disc + Dual-Band Atmospheric Mie Scattering Halo
          vec3 sDir = normalize(uSunDir);
          float sunDot = max(dot(dir, sDir), 0.0);
          float mieWide = pow(sunDot, 5.0) * 0.28;
          float mieTight = pow(sunDot, 42.0) * 0.55;
          float sunDisc = smoothstep(0.9968, 0.9986, sunDot) * 1.15;
          c += uSunColor * (mieWide + mieTight + sunDisc) * (1.0 - uTwilight * 0.25);

          // Drifting Multi-Octave Painted Cumulus Clouds (upper hemisphere)
          if (h > 0.03 && uCloudAmt > 0.05) {
            vec2 cUv = dir.xz / (h + 0.22);
            vec2 drift = vec2(uTime * 0.018, uTime * 0.008);
            float n = cloudFbm(cUv * 0.72 + drift);
            float nLit = cloudFbm(cUv * 0.72 + drift + sDir.xz * 0.08);
            float mask = smoothstep(0.49, 0.76, n) * smoothstep(0.03, 0.22, h) * uCloudAmt;
            // Painted sunlit silver-gold tops + dreamy lavender-blue undersides
            vec3 cloudShadow = mix(mid * 0.84 + vec3(0.08, 0.07, 0.14), vec3(0.46, 0.36, 0.62), uTwilight);
            vec3 cloudLit = mix(vec3(1.0, 0.985, 0.95), uSunColor * 1.08, 0.42 + uTwilight * 0.38);
            float rimLit = clamp((n - nLit) * 3.8 + 0.55 + pow(sunDot, 4.0) * 0.55, 0.0, 1.0);
            vec3 cloudCol = mix(cloudShadow, cloudLit, rimLit);
            c = mix(c, cloudCol, mask * 0.74);
          }

          // Gentle Twinkling Twilight Starfield during Golden Dusk / Final-25s Overdrive
          if (uTwilight > 0.12 && h > 0.14) {
            vec2 sGrid = floor((dir.xz / (h + 0.35)) * 78.0);
            float r = hash21(sGrid);
            if (r > 0.991) {
              float tw = 0.55 + 0.45 * sin(uTime * 2.8 + r * 95.0);
              float starVis = smoothstep(0.14, 0.52, h) * smoothstep(0.12, 0.65, uTwilight);
              c += vec3(1.0, 0.97, 0.88) * tw * starVis * 0.85;
            }
          }

          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    sky.material.dispose();
    sky.material = newSkyMat;
  }

  // --- 2. Global Zero-Draw-Call Painterly Shader Injection (`upgradeMaterialToPainterly`)
  const upgradedMats = new WeakSet();
  function upgradeMaterialToPainterly(mat, opts = {}) {
    if (!THREE || !mat || upgradedMats.has(mat)) return mat;
    if (mat.isShaderMaterial || mat.isSpriteMaterial || mat.isMeshBasicMaterial || mat.isPointsMaterial) return mat;
    // Do not clobber materials that already define a custom onBeforeCompile (like grass sway)
    if (typeof mat.onBeforeCompile === 'function' && !opts.forceWrap && mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
      return mat;
    }
    upgradedMats.add(mat);

    const rimMul = opts.rimMul ?? 1.0;
    const cloudMul = opts.cloudMul ?? 1.0;
    const macroMul = opts.macroMul ?? 1.0;
    const mistMul = opts.mistMul ?? 1.0;
    const keyTag = `hs_painterly_v7_${rimMul.toFixed(1)}_${cloudMul.toFixed(1)}_${macroMul.toFixed(1)}`;

    mat.customProgramCacheKey = () => keyTag;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uHsTime = sharedUniforms.uHsTime;
      shader.uniforms.uHsSunDir = sharedUniforms.uHsSunDir;
      shader.uniforms.uHsRimColor = sharedUniforms.uHsRimColor;
      shader.uniforms.uHsShadowTint = sharedUniforms.uHsShadowTint;
      shader.uniforms.uHsMistColor = sharedUniforms.uHsMistColor;
      shader.uniforms.uHsRimStrength = sharedUniforms.uHsRimStrength;
      shader.uniforms.uHsCloudStrength = sharedUniforms.uHsCloudStrength;
      shader.uniforms.uHsMistStrength = sharedUniforms.uHsMistStrength;
      shader.uniforms.uHsMacroStrength = sharedUniforms.uHsMacroStrength;

      shader.vertexShader =
        'varying vec3 vHsWorldPos;\nvarying vec3 vHsWorldNorm;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 hsWp = vec4( transformed, 1.0 );
          vec3 hsWn = objectNormal;
          #ifdef USE_INSTANCING
            hsWp = instanceMatrix * hsWp;
            hsWn = mat3( instanceMatrix ) * hsWn;
          #endif
          hsWp = modelMatrix * hsWp;
          vHsWorldPos = hsWp.xyz;
          vHsWorldNorm = normalize( mat3( modelMatrix ) * hsWn );`
        );

      shader.fragmentShader =
        `uniform float uHsTime, uHsRimStrength, uHsCloudStrength, uHsMistStrength, uHsMacroStrength;
        uniform vec3 uHsSunDir, uHsRimColor, uHsShadowTint, uHsMistColor;
        varying vec3 vHsWorldPos;
        varying vec3 vHsWorldNorm;\n` +
        shader.fragmentShader.replace(
          '#include <fog_fragment>',
          `{
            vec3 nW = normalize( vHsWorldNorm );
            vec3 sDir = normalize( uHsSunDir );
            float nDotS = dot( nW, sDir );

            // A. Cool Sky-Indigo Painterly Shadow Tint + Ground-Contact Crevice AO & 2-Band Ramp
            float shFactor = smoothstep( 0.22, -0.45, nDotS ) * 0.16;
            gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * uHsShadowTint + uHsShadowTint * 0.024, shFactor );
            ${GROUND_AO_AND_RAMP_GLSL}

            // B. Rolling Sunlight & Cloud-Shadow Gobo Patches gliding over the world
            ${cloudMul > 0.01 ? `
            float upMask = clamp( nW.y * 1.35, 0.0, 1.0 );
            float cWave1 = sin( vHsWorldPos.x * 0.052 + uHsTime * 0.22 ) * cos( vHsWorldPos.z * 0.046 - uHsTime * 0.15 );
            float cWave2 = sin( (vHsWorldPos.x + vHsWorldPos.z) * 0.031 + uHsTime * 0.12 );
            float cloudSun = smoothstep( -0.35, 0.55, cWave1 * 0.65 + cWave2 * 0.35 );
            float cAmt = uHsCloudStrength * ${cloudMul.toFixed(2)} * upMask;
            gl_FragColor.rgb *= mix( 1.0 - 0.14 * cAmt, 1.0 + 0.05 * cAmt, cloudSun );
            ` : ''}

            // C. Subtle World-Space Hand-Painted Macro Variation (eliminates tiled look)
            ${macroMul > 0.01 ? `
            float brushMacro = sin( vHsWorldPos.x * 0.17 ) * cos( vHsWorldPos.z * 0.15 );
            gl_FragColor.rgb *= ( 1.0 + brushMacro * uHsMacroStrength * ${macroMul.toFixed(2)} );
            ` : ''}

            // D. Warm Sunlit Fresnel Rim Light (vertical/curved silhouettes only, highlight-protected!)
            ${rimMul > 0.01 ? `
            vec3 viewDirW = normalize( cameraPosition - vHsWorldPos );
            float fres = pow( 1.0 - clamp( dot( nW, viewDirW ), 0.0, 1.0 ), 3.4 );
            float sunSide = smoothstep( -0.20, 0.72, nDotS );
            float notFlatFloor = 1.0 - clamp( max( nW.y, 0.0 ) * 0.88, 0.0, 0.88 );
            float hiGuard = 1.0 - smoothstep( 0.62, 0.96, max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) ) );
            gl_FragColor.rgb += uHsRimColor * ( fres * (0.10 + 0.22 * sunSide) * notFlatFloor * hiGuard * uHsRimStrength * ${rimMul.toFixed(2)} );
            ` : ''}

            // E. Distant Height-Based Golden Valley Mist with Sun In-Scattering (keeps foreground crisp!)
            ${mistMul > 0.01 ? `
            vec3 toFrag = vHsWorldPos - cameraPosition;
            float distW = length( toFrag );
            float heightFade = exp( -max( vHsWorldPos.y + 1.5, 0.0 ) * 0.13 );
            float distFade = smoothstep( 32.0, 128.0, distW );
            float sunScatter = pow( max( dot( toFrag / max(distW, 0.001), sDir ), 0.0 ), 4.0 );
            vec3 mistCol = mix( uHsMistColor, uHsRimColor * 1.05, sunScatter * 0.50 );
            float mistA = clamp( distFade * (0.30 + 0.70 * heightFade) * uHsMistStrength * ${mistMul.toFixed(2)}, 0.0, 0.42 );
            gl_FragColor.rgb = mix( gl_FragColor.rgb, mistCol, mistA );
            ` : ''}
          }
          #include <fog_fragment>`
        );
    };
    mat.needsUpdate = true;
    return mat;
  }

  function upgradeSceneGroup(root, opts = {}) {
    if (!root || typeof root.traverse !== 'function') return 0;
    let count = 0;
    root.traverse((obj) => {
      if (!obj || !obj.isMesh || !obj.material) return;
      if (obj.userData?._isContactShadow || obj.userData?._skipPainterly) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m && !upgradedMats.has(m)) {
          upgradeMaterialToPainterly(m, opts);
          count++;
        }
      }
    });
    return count;
  }

  // --- 3. Procedural Sky-to-Ground PMREM IBL Environment Map (cached per map!)
  const envCache = new Map();
  let pmremGen = null;
  function applyProceduralEnvMap(mapId, def) {
    if (!THREE || !renderer || !scene || typeof document === 'undefined') return null;
    if (envCache.has(mapId)) {
      scene.environment = envCache.get(mapId);
      return scene.environment;
    }
    try {
      if (!pmremGen && THREE.PMREMGenerator) {
        pmremGen = new THREE.PMREMGenerator(renderer);
        pmremGen.compileEquirectangularShader?.();
      }
      if (!pmremGen) return null;
      const sk = def?.sky || { top: 0x5aa6e6, mid: 0xc4e3f3, bot: 0xf7e6c4 };
      const lt = def?.lights || { hemiGround: 0x7a9652, sunColor: 0xffe4aa };
      const cTop = '#' + new THREE.Color(sk.top).getHexString();
      const cMid = '#' + new THREE.Color(sk.mid).getHexString();
      const cLow = '#' + new THREE.Color(sk.bot ?? sk.low ?? 0xf7e6c4).getHexString();
      const cGnd = '#' + new THREE.Color(lt.hemiGround ?? 0x7a9652).getHexString();
      const cSun = '#' + new THREE.Color(lt.sunColor ?? 0xffe8b0).getHexString();

      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 32;
      const ctx = cv.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 32);
      grad.addColorStop(0.0, cTop);
      grad.addColorStop(0.38, cMid);
      grad.addColorStop(0.50, cLow);
      grad.addColorStop(0.58, cGnd);
      grad.addColorStop(1.0, cGnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 32);
      // Warm sun hotspot for specular highlights on water, brass, pottery & blasters!
      const sg = ctx.createRadialGradient(46, 9, 0.5, 46, 9, 10);
      sg.addColorStop(0.0, '#ffffff');
      sg.addColorStop(0.3, cSun);
      sg.addColorStop(1.0, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(30, 0, 32, 22);

      const eqTex = new THREE.CanvasTexture(cv);
      eqTex.mapping = THREE.EquirectangularReflectionMapping;
      eqTex.colorSpace = THREE.SRGBColorSpace;
      const rt = pmremGen.fromEquirectangular(eqTex);
      eqTex.dispose();
      envCache.set(mapId, rt.texture);
      scene.environment = rt.texture;
      if ('environmentIntensity' in scene) scene.environmentIntensity = activePalette.envIntensity ?? 0.42;
      return rt.texture;
    } catch (_) {
      return null;
    }
  }

  // --- 4. Soft Volumetric Sunbeam God-Rays (8 additive soft-faded shafts)
  let beamGroup = null;
  let beamMat = null;
  const beamSeeds = [];
  function initSunbeams() {
    if (!THREE || !scene || beamGroup) return;
    beamGroup = new THREE.Group();
    beamGroup.name = 'storybookSunbeams';
    const geo = new THREE.PlaneGeometry(5.2, 32, 1, 1);
    beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(0xfff0c2) },
        uOpacity: { value: 0.042 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWp;
        varying vec3 vWn;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWp = wp.xyz;
          vWn = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity, uTime;
        varying vec2 vUv;
        varying vec3 vWp;
        varying vec3 vWn;
        void main() {
          // Distance + view-angle fade so sunbeams stay ethereal in the background and NEVER wash across elevated cliffs/cameras!
          vec3 toCam = cameraPosition - vWp;
          float camD = length(toCam);
          float distFade = smoothstep(18.0, 32.0, camD);
          float angleFade = pow(abs(dot(normalize(vWn), toCam / max(camD, 0.001))), 1.6);
          float horiz = sin(vUv.x * 3.14159265);
          horiz = horiz * horiz * horiz;
          float vert = smoothstep(0.0, 0.38, vUv.y) * smoothstep(1.0, 0.22, vUv.y);
          float shimmer = 0.85 + 0.15 * sin(uTime * 0.7 + vUv.x * 6.0);
          float a = horiz * vert * distFade * angleFade * uOpacity * shimmer;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });

    const placements = [
      [-24, 18, -20], [22, 19, -22], [-22, 18, 22], [25, 18, 19],
      [-28, 17, 2], [6, 20, -28], [28, 17, -4], [-8, 19, 27],
    ];
    for (let i = 0; i < placements.length; i++) {
      const m = new THREE.Mesh(geo, beamMat);
      m.position.set(placements[i][0], placements[i][1], placements[i][2]);
      m.rotation.set(0.28, (i * 0.78) + 0.4, -0.34);
      m.renderOrder = 3;
      m.userData._skipPainterly = true;
      beamGroup.add(m);
      beamSeeds.push({ mesh: m, baseY: placements[i][1], phase: i * 1.1 });
    }
    scene.add(beamGroup);
  }

  // --- 5. Single-Draw-Call Living World Swarm (3D Flapping Butterflies / Moths / Petals!)
  let critterMesh = null;
  let critterUniforms = null;
  const CRITTER_MAX = isTouch ? 48 : 72;
  const critterData = [];
  function initCritterSwarm() {
    if (!THREE || !scene || critterMesh) return;
    // Double-wing origami butterfly quad (2 triangles left wing + 2 triangles right wing)
    const verts = new Float32Array([
      // Left wing (x < 0)
      0, 0, -0.11,   -0.22, 0.02, -0.15,   -0.19, 0.0, 0.13,
      0, 0, -0.11,   -0.19, 0.0, 0.13,     0, 0, 0.09,
      // Right wing (x > 0)
      0, 0, -0.11,   0.19, 0.0, 0.13,      0.22, 0.02, -0.15,
      0, 0, -0.11,   0, 0, 0.09,           0.19, 0.0, 0.13,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const phases = new Float32Array(CRITTER_MAX);
    for (let i = 0; i < CRITTER_MAX; i++) phases[i] = Math.random() * Math.PI * 2;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

    critterUniforms = { uTime: { value: 0 } };
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      fog: true,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = critterUniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\nattribute float aPhase;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float wingSide = abs(position.x);
          float flap = sin(uTime * 12.5 + aPhase) * 0.78;
          transformed.y += wingSide * flap;`
        );
    };

    critterMesh = new THREE.InstancedMesh(geo, mat, CRITTER_MAX);
    critterMesh.frustumCulled = false;
    critterMesh.userData._skipPainterly = true;

    for (let i = 0; i < CRITTER_MAX; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 3 + Math.random() * 25;
      critterData.push({
        cx: Math.cos(ang) * rad,
        cz: Math.sin(ang) * rad,
        baseY: 1.1 + Math.random() * 3.8,
        orbitR: 1.4 + Math.random() * 3.2,
        spd: (0.45 + Math.random() * 0.75) * (Math.random() < 0.5 ? 1 : -1),
        phase: phases[i],
        sc: 0.65 + Math.random() * 0.55,
      });
    }
    scene.add(critterMesh);
    recolorCritters(activePalette);
  }

  const _cMat4 = THREE ? new THREE.Matrix4() : null;
  const _cPos = THREE ? new THREE.Vector3() : null;
  const _cQuat = THREE ? new THREE.Quaternion() : null;
  const _cEuler = THREE ? new THREE.Euler() : null;
  const _cScale = THREE ? new THREE.Vector3() : null;
  const _cCol = THREE ? new THREE.Color() : null;

  function recolorCritters(pal) {
    if (!critterMesh || !pal || !_cCol) return;
    const cols = pal.colors || WORLD_LIFE_PALETTES.meadow.colors;
    for (let i = 0; i < CRITTER_MAX; i++) {
      _cCol.setHex(cols[i % cols.length]);
      critterMesh.setColorAt(i, _cCol);
    }
    if (critterMesh.instanceColor) critterMesh.instanceColor.needsUpdate = true;
  }

  // --- 6. Color Grade + Steam PC Half-Res Real-Time Depth SSAO
  let colorGradePass = null;
  let depthRT = null;
  let depthOverrideMat = null;
  const isSteamDesktop = !isTouch;

  function initSteamDepthTarget(w, h) {
    if (!THREE || !renderer || !isSteamDesktop) return null;
    try {
      const dw = Math.max(256, Math.round(w * 0.5));
      const dh = Math.max(144, Math.round(h * 0.5));
      if (depthRT) {
        depthRT.dispose();
        depthRT = null;
      }
      const dTex = new THREE.DepthTexture(dw, dh);
      dTex.type = THREE.UnsignedIntType;
      depthRT = new THREE.WebGLRenderTarget(dw, dh, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true,
        stencilBuffer: false,
        depthTexture: dTex,
      });
      if (!depthOverrideMat) {
        depthOverrideMat = new THREE.MeshDepthMaterial();
      }
      if (colorGradePass) {
        colorGradePass.uniforms.tDepth.value = depthRT.depthTexture;
        colorGradePass.uniforms.uTexelSize.value = [1 / dw, 1 / dh];
      }
      return depthRT;
    } catch (_) {
      depthRT = null;
      return null;
    }
  }

  function attachColorGradePass(composer, ShaderPass) {
    if (!composer || !ShaderPass) return null;
    colorGradePass = new ShaderPass(createStorybookColorGradeShader());
    if (isSteamDesktop && typeof window !== 'undefined') {
      initSteamDepthTarget(window.innerWidth || 1280, window.innerHeight || 720);
      colorGradePass.uniforms.uAoStrength.value = 0.72;
    }
    return colorGradePass;
  }

  function renderSteamDepthPrepass(camera) {
    if (!isSteamDesktop || !renderer || !scene || !camera || !depthRT || !colorGradePass || !colorGradePass.enabled) return false;
    if (detailLevel < 0.7) {
      colorGradePass.uniforms.uAoStrength.value = 0.0;
      return false;
    }
    const prevTarget = renderer.getRenderTarget();
    const prevOverride = scene.overrideMaterial;
    const prevSkyVis = sky ? sky.visible : true;
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    try {
      if (sky) sky.visible = false;
      renderer.shadowMap.autoUpdate = false;
      scene.overrideMaterial = depthOverrideMat;
      renderer.setRenderTarget(depthRT);
      renderer.clear();
      renderer.render(scene, camera);
      colorGradePass.uniforms.tDepth.value = depthRT.depthTexture;
      colorGradePass.uniforms.uCameraNear.value = camera.near || 0.08;
      colorGradePass.uniforms.uCameraFar.value = camera.far || 400.0;
      colorGradePass.uniforms.uAoStrength.value = detailLevel >= 0.9 ? 0.72 : 0.45;
    } finally {
      scene.overrideMaterial = prevOverride;
      if (sky) sky.visible = prevSkyVis;
      renderer.shadowMap.autoUpdate = prevShadowAuto;
      renderer.setRenderTarget(prevTarget);
    }
    return true;
  }

  function onResize(w, h) {
    if (isSteamDesktop && w > 0 && h > 0) {
      initSteamDepthTarget(w, h);
    }
  }

  function applyWorldPalette(mapId, def) {
    activeMapId = mapId || 'meadow';
    activePalette = WORLD_LIFE_PALETTES[activeMapId] || WORLD_LIFE_PALETTES.meadow;
    if (sharedUniforms.uHsRimColor) sharedUniforms.uHsRimColor.value.setHex(activePalette.rimColor);
    if (sharedUniforms.uHsShadowTint) sharedUniforms.uHsShadowTint.value.setHex(activePalette.shadowTint);
    if (sharedUniforms.uHsMistColor) sharedUniforms.uHsMistColor.value.setHex(activePalette.mistColor);
    sharedUniforms.uHsMistStrength.value = 0.22 * (activePalette.mistScale ?? 1.0) * Math.max(0.4, detailLevel);
    if (beamMat) beamMat.uniforms.uColor.value.setHex(activePalette.beamColor);
    if (skyUniforms) {
      skyUniforms.uCloudAmt.value = activePalette.cloudAmt;
      skyUniforms.uTwilight.value = activePalette.twilightBase;
    }
    recolorCritters(activePalette);
    applyProceduralEnvMap(activeMapId, def);
    if (scene && 'environmentIntensity' in scene) {
      scene.environmentIntensity = activePalette.envIntensity ?? 0.42;
    }
    if (bloomPass) {
      bloomPass.threshold = activePalette.bloomThreshold ?? 0.90;
      bloomPass.strength = activePalette.bloomStrength ?? 0.28;
    }
  }

  function setDetailLevel(tier = 'ultra', liteLevel = 0) {
    if (liteLevel >= 2) detailLevel = 0.0;
    else if (liteLevel === 1) detailLevel = 0.35;
    else if (tier === 'balanced') detailLevel = 0.72;
    else detailLevel = 1.0;

    sharedUniforms.uHsRimStrength.value = 0.35 + 0.30 * detailLevel;
    sharedUniforms.uHsCloudStrength.value = 0.95 * detailLevel;
    sharedUniforms.uHsMistStrength.value = 0.22 * (activePalette.mistScale ?? 1.0) * Math.max(0.4, detailLevel);
    if (beamGroup) beamGroup.visible = detailLevel >= 0.6;
    if (critterMesh) {
      critterMesh.visible = detailLevel >= 0.3;
      critterMesh.count = Math.max(12, Math.round(CRITTER_MAX * Math.max(0.3, detailLevel)));
    }
    if (colorGradePass) {
      colorGradePass.enabled = detailLevel >= 0.3;
      colorGradePass.uniforms.uStrength.value = detailLevel >= 0.7 ? 1.0 : 0.65;
    }
  }

  let accTime = 0;
  function update(dt, twilight01 = 0) {
    accTime += dt;
    sharedUniforms.uHsTime.value = accTime;

    if (sun && sharedUniforms.uHsSunDir?.value?.copy) {
      sharedUniforms.uHsSunDir.value.copy(sun.position).normalize();
    }

    const effTwilight = clamp(Math.max(activePalette.twilightBase, twilight01), 0, 1);

    if (skyUniforms) {
      skyUniforms.uTime.value = accTime;
      if (sharedUniforms.uHsSunDir?.value) skyUniforms.uSunDir.value.copy(sharedUniforms.uHsSunDir.value);
      if (sun?.color) skyUniforms.uSunColor.value.copy(sun.color);
      skyUniforms.uTwilight.value = effTwilight;
    }

    if (beamMat && beamGroup && beamGroup.visible) {
      beamMat.uniforms.uTime.value = accTime;
      beamMat.uniforms.uOpacity.value = (0.020 + 0.016 * detailLevel) * (1.0 - effTwilight * 0.45);
      if (sun?.color) beamMat.uniforms.uColor.value.copy(sun.color).lerp(_cCol.setHex(0xfff5dc), 0.35);
    }

    if (colorGradePass && colorGradePass.enabled) {
      colorGradePass.uniforms.uTime.value = accTime;
      colorGradePass.uniforms.uTwilight.value = effTwilight;
    }

    if (critterMesh && critterMesh.visible && _cMat4) {
      critterUniforms.uTime.value = accTime;
      const n = critterMesh.count;
      for (let i = 0; i < n; i++) {
        const d = critterData[i];
        const a = accTime * d.spd + d.phase;
        const x = d.cx + Math.cos(a) * d.orbitR;
        const z = d.cz + Math.sin(a * 1.15) * d.orbitR;
        const y = d.baseY + Math.sin(accTime * 1.9 + d.phase) * 0.55;
        const heading = Math.atan2(-Math.sin(a) * d.spd, Math.cos(a * 1.15) * d.spd * 1.15);
        _cPos.set(x, y, z);
        _cEuler.set(0.18 * Math.sin(accTime * 3 + d.phase), heading, 0);
        _cQuat.setFromEuler(_cEuler);
        _cScale.setScalar(d.sc);
        _cMat4.compose(_cPos, _cQuat, _cScale);
        critterMesh.setMatrixAt(i, _cMat4);
      }
      critterMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // Initialize clean, serene storybook sky dome (no distracting floating origami triangles or diagonal quads!)
  upgradeSkyDome();

  return {
    sharedUniforms,
    upgradeMaterialToPainterly,
    upgradeSceneGroup,
    applyWorldPalette,
    attachColorGradePass,
    renderSteamDepthPrepass,
    onResize,
    setDetailLevel,
    update,
    getDetailLevel: () => detailLevel,
    getSkyUniforms: () => skyUniforms,
    isSteamSSAOActive: () => Boolean(isSteamDesktop && depthRT && detailLevel >= 0.7),
  };
}
