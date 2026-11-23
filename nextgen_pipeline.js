/* ==========================================================================
 * Hue & Seek — Tier 2 Next-Gen Asset & Renderer Pipeline (`nextgen_pipeline.js`)
 *
 * Pure ES module (zero crashes when WebGPU, DOM, or optional Three.js addons
 * are absent; 100% unit-testable in Node):
 *   1. Hardware & GPU Capability Probing (`probeNextGenCapabilities`,
 *      `probeWebGPUAdapter`) — WebGPU readiness, WebGL2, ASTC / ETC2 / BC7.
 *   2. WebGPU + TSL Readiness Bridge (`createNextGenRendererBridge`,
 *      `buildStylizedNodeSpec`) — `?renderer=webgpu` opt-in with automatic
 *      WebGL2 fallback & TSL-compatible painterly/water/AO node descriptors.
 *   3. Zero-Dependency Binary glTF 2.0 (`.glb`) Parser & Packer
 *      (`parseGLBBuffer`, `packGLBBuffer`) supporting `POSITION`, `NORMAL`,
 *      `TEXCOORD_0`, `TEXCOORD_1` -> Three.js `uv1` + `uv2`, `COLOR_0`
 *      Vertex AO, PBR factors, and full node transforms.
 *   4. Baked Lightmap Binding (`applyBakedLightmap`) supporting both Three.js
 *      r151+ `uv1` and legacy `uv2` seamlessly.
 *   5. Hand-Sculpted Chamfered Hero Geometry Builder (`buildBeveledHeroGeometry`)
 *      with non-overlapping lightmap UVs (`uv1` + `uv2`) and baked Vertex AO.
 *   6. Cached Hero Asset Loader (`createNextGenAssetLoader`) with automatic
 *      delegation to optional `GLTFLoader` / `KTX2Loader` / `DRACOLoader`
 *      when present in `vendor/three/addons/loaders/`.
 * ========================================================================== */

const GLB_MAGIC = 0x46546c67; // 'glTF'
const GLB_VERSION = 2;
const GLB_CHUNK_JSON = 0x4e4f534a; // 'JSON'
const GLB_CHUNK_BIN = 0x004e4942; // 'BIN\0'

const COMPONENT_TYPE_INFO = {
  5120: { ArrayType: Int8Array, bytes: 1, max: 127 },
  5121: { ArrayType: Uint8Array, bytes: 1, max: 255 },
  5122: { ArrayType: Int16Array, bytes: 2, max: 32767 },
  5123: { ArrayType: Uint16Array, bytes: 2, max: 65535 },
  5125: { ArrayType: Uint32Array, bytes: 4, max: 4294967295 },
  5126: { ArrayType: Float32Array, bytes: 4, max: 1 },
};

const ACCESSOR_TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
};

function selectRecommendedTextureFormat({ astc, etc2, bc7 }) {
  if (astc) return 'astc';
  if (etc2) return 'etc2';
  if (bc7) return 'bc7';
  return 'webp';
}

function hasWebGLExtension(renderer, gl, name) {
  try {
    if (renderer?.extensions && typeof renderer.extensions.has === 'function') {
      if (renderer.extensions.has(name)) return true;
    }
  } catch (_) {
    // Ignore mock or detached renderer extension checks
  }
  try {
    if (gl && typeof gl.getExtension === 'function') {
      return Boolean(gl.getExtension(name));
    }
  } catch (_) {
    // Ignore WebGL context lookup errors
  }
  return false;
}

/**
 * Synchronous GPU & texture compression capability probe.
 * Never throws when `renderer`, `navigator`, or WebGL contexts are missing.
 */
export function probeNextGenCapabilities(renderer = null) {
  const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;
  const webgpuAvailable = Boolean(nav?.gpu && typeof nav.gpu.requestAdapter === 'function');

  let gl = null;
  try {
    if (renderer && typeof renderer.getContext === 'function') {
      gl = renderer.getContext();
    }
  } catch (_) {
    gl = null;
  }

  let webgl2 = false;
  if (typeof renderer?.capabilities?.isWebGL2 === 'boolean') {
    webgl2 = renderer.capabilities.isWebGL2;
  } else if (gl) {
    webgl2 =
      (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) ||
      typeof gl.texStorage2D === 'function';
  } else if (typeof WebGL2RenderingContext !== 'undefined') {
    webgl2 = true;
  }

  const astc = hasWebGLExtension(renderer, gl, 'WEBGL_compressed_texture_astc');
  const etc2 = hasWebGLExtension(renderer, gl, 'WEBGL_compressed_texture_etc');
  const bc7 = hasWebGLExtension(renderer, gl, 'EXT_texture_compression_bptc');
  const s3tc = hasWebGLExtension(renderer, gl, 'WEBGL_compressed_texture_s3tc');
  const pvrtc = hasWebGLExtension(renderer, gl, 'WEBGL_compressed_texture_pvrtc');

  let maxTextureSize = renderer?.capabilities?.maxTextureSize ?? null;
  if (maxTextureSize == null && gl && typeof gl.getParameter === 'function' && typeof gl.MAX_TEXTURE_SIZE === 'number') {
    try {
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    } catch (_) {
      maxTextureSize = null;
    }
  }

  let maxAnisotropy = null;
  try {
    if (typeof renderer?.capabilities?.getMaxAnisotropy === 'function') {
      maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    }
  } catch (_) {
    maxAnisotropy = null;
  }

  const recommendedTextureFormat = selectRecommendedTextureFormat({ astc, etc2, bc7 });

  return {
    backend: webgpuAvailable ? 'webgpu-ready' : 'webgl2',
    webgl2,
    webgpuAvailable,
    adapterInfo: null,
    astc,
    etc2,
    bc7,
    s3tc,
    pvrtc,
    maxTextureSize,
    maxAnisotropy,
    recommendedTextureFormat,
  };
}

/**
 * Asynchronous WebGPU adapter & GPU compression feature probe.
 * Safely resolves even in Node or WebGL-only browsers.
 */
export async function probeWebGPUAdapter(rendererOrOpts = null) {
  const isOpts =
    rendererOrOpts &&
    typeof rendererOrOpts === 'object' &&
    ('renderer' in rendererOrOpts || 'powerPreference' in rendererOrOpts || 'gpu' in rendererOrOpts);
  const renderer = isOpts ? rendererOrOpts.renderer ?? null : rendererOrOpts;
  const powerPreference = isOpts ? rendererOrOpts.powerPreference ?? 'high-performance' : 'high-performance';
  const gpu = isOpts && 'gpu' in rendererOrOpts ? rendererOrOpts.gpu : globalThis?.navigator?.gpu;

  const base = probeNextGenCapabilities(renderer);
  const hasGpuApi = Boolean(gpu && typeof gpu.requestAdapter === 'function');
  if (!hasGpuApi) {
    return {
      ...base,
      backend: 'webgl2',
      webgpuAvailable: false,
      adapterReady: false,
      adapterInfo: null,
    };
  }

  try {
    const adapter = await gpu.requestAdapter({ powerPreference });
    if (!adapter) {
      return {
        ...base,
        backend: 'webgl2',
        webgpuAvailable: true,
        adapterReady: false,
        adapterInfo: null,
      };
    }

    let rawInfo = adapter.info || null;
    if (!rawInfo && typeof adapter.requestAdapterInfo === 'function') {
      try {
        rawInfo = await adapter.requestAdapterInfo();
      } catch (_) {
        rawInfo = null;
      }
    }

    const features = adapter.features && typeof adapter.features.has === 'function' ? adapter.features : null;
    const astc = base.astc || Boolean(features?.has('texture-compression-astc'));
    const etc2 = base.etc2 || Boolean(features?.has('texture-compression-etc2'));
    const bc7 = base.bc7 || Boolean(features?.has('texture-compression-bc'));

    const adapterInfo = {
      vendor: rawInfo?.vendor || 'unknown',
      architecture: rawInfo?.architecture || 'unknown',
      device: rawInfo?.device || 'unknown',
      description: rawInfo?.description || '',
      isFallbackAdapter: Boolean(adapter.isFallbackAdapter),
      compressedFeatures: {
        astc: Boolean(features?.has('texture-compression-astc')),
        etc2: Boolean(features?.has('texture-compression-etc2')),
        bc: Boolean(features?.has('texture-compression-bc')),
      },
      maxTextureDimension2D: adapter.limits?.maxTextureDimension2D ?? null,
    };

    return {
      ...base,
      backend: 'webgpu-ready',
      webgpuAvailable: true,
      adapterReady: true,
      adapterInfo,
      astc,
      etc2,
      bc7,
      maxTextureSize: adapterInfo.maxTextureDimension2D ?? base.maxTextureSize,
      recommendedTextureFormat: selectRecommendedTextureFormat({ astc, etc2, bc7 }),
    };
  } catch (err) {
    return {
      ...base,
      backend: 'webgl2',
      webgpuAvailable: true,
      adapterReady: false,
      adapterInfo: { error: err?.message || String(err) },
    };
  }
}

/* ==========================================================================
 * 2. WebGPU + TSL Readiness Abstraction
 * ========================================================================== */

function normalizeHexColor(val, fallback) {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return '#' + (val & 0xffffff).toString(16).padStart(6, '0');
  }
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (val && typeof val.getHexString === 'function') return '#' + val.getHexString();
  return fallback;
}

/**
 * Builds a declarative, TSL-compatible material descriptor mapping Hue & Seek's
 * painterly rim, cel/soft ramp, vertex + lightmap AO, atmosphere, and water
 * parameters so migrating to `three/tsl` requires zero material rewrites.
 */
export function buildStylizedNodeSpec(params = {}) {
  const preset = params.preset || (params.water ? 'water' : 'painterly');
  const isWater = preset === 'water' || Boolean(params.water);

  const baseColor = normalizeHexColor(params.color ?? params.baseColor, isWater ? '#4db8d8' : '#e6d7be');
  const rimColor = normalizeHexColor(params.rimColor, '#ffe4a8');
  const shadowTint = normalizeHexColor(params.shadowTint, '#5c72b8');
  const mistColor = normalizeHexColor(params.mistColor, '#ffeacc');
  const emissive = normalizeHexColor(params.emissive, '#000000');

  const roughness = clamp(params.roughness ?? (isWater ? 0.14 : 0.78), 0.02, 1.0);
  const metalness = clamp(params.metalness ?? (isWater ? 0.08 : 0.04), 0.0, 1.0);
  const emissiveIntensity = Math.max(0, params.emissiveIntensity ?? 0);

  const ramp = {
    enabled: params.rampEnabled ?? !isWater,
    bands: Math.max(2, Math.round(params.rampBands ?? 3)),
    softness: clamp(params.rampSoftness ?? 0.32, 0.02, 1.0),
    shadowTint,
    shadowStrength: clamp(params.shadowStrength ?? 0.22, 0, 1),
    warmHighlight: normalizeHexColor(params.warmHighlight, '#fff3d6'),
  };

  const rim = {
    enabled: params.rimEnabled ?? true,
    color: rimColor,
    strength: clamp(params.rimStrength ?? 0.62, 0, 2),
    power: clamp(params.rimPower ?? 3.4, 0.5, 10),
    sunBias: clamp(params.rimSunBias ?? 0.72, 0, 1),
    highlightGuard: clamp(params.rimHighlightGuard ?? 0.85, 0, 1),
  };

  const ao = {
    vertexAO: params.vertexAO ?? true,
    vertexAOStrength: clamp(params.vertexAOStrength ?? 0.85, 0, 1.5),
    lightmapIntensity: clamp(params.lightmapIntensity ?? 0.85, 0, 2.5),
    uvChannel: params.lightmapUvChannel ?? 1,
    supportsUv2Alias: true,
  };

  const atmosphere = {
    cloudGoboStrength: clamp(params.cloudGoboStrength ?? 0.95, 0, 2),
    macroBrushStrength: clamp(params.macroBrushStrength ?? 0.05, 0, 0.5),
    mistColor,
    mistStrength: clamp(params.mistStrength ?? 0.22, 0, 1),
    mistStart: params.mistStart ?? 32,
    mistEnd: params.mistEnd ?? 128,
  };

  const water = isWater
    ? {
        enabled: true,
        shallowColor: normalizeHexColor(params.water?.shallowColor ?? params.shallowColor, '#6ee2e8'),
        deepColor: normalizeHexColor(params.water?.deepColor ?? params.deepColor, '#1f6e9c'),
        foamColor: normalizeHexColor(params.water?.foamColor ?? params.foamColor, '#fffdf5'),
        foamWidth: clamp(params.water?.foamWidth ?? 0.35, 0.02, 2.0),
        waveSpeed: params.water?.waveSpeed ?? 0.85,
        waveScale: params.water?.waveScale ?? 1.6,
        fresnelPower: params.water?.fresnelPower ?? 3.2,
        refractionStrength: clamp(params.water?.refractionStrength ?? 0.18, 0, 1),
      }
    : {
        enabled: false,
      };

  const tslGraph = {
    targetMaterial: 'MeshStandardNodeMaterial',
    nodes: {
      colorNode: isWater
        ? 'mix(uniform(water.deepColor), uniform(water.shallowColor), depthFade).add(foamMask.mul(uniform(water.foamColor)))'
        : 'albedoTex.mul(uniform(baseColor)).mul(vertexAO)',
      roughnessNode: 'uniform(roughness)',
      metalnessNode: 'uniform(metalness)',
      aoNode: 'lightmapSample(uv(1)).mul(uniform(ao.lightmapIntensity)).mul(vertexAO)',
      emissiveNode: 'uniform(emissive).mul(uniform(emissiveIntensity)).add(painterlyRimTerm)',
      positionNode: isWater
        ? 'positionLocal.add(vec3(0, sin(positionWorld.x * water.waveScale + time * water.waveSpeed) * 0.06, 0))'
        : 'positionLocal',
      outputNode: 'applyStorybookMist(applyCloudGobo(applyShadowTint(litColor)))',
    },
    uniforms: {
      uHsBaseColor: baseColor,
      uHsRimColor: rim.color,
      uHsRimStrength: rim.strength,
      uHsShadowTint: ramp.shadowTint,
      uHsMistColor: atmosphere.mistColor,
      uHsMistStrength: atmosphere.mistStrength,
      uHsLightmapIntensity: ao.lightmapIntensity,
    },
  };

  return {
    type: 'HueSeekStylizedNodeSpec',
    schemaVersion: 1,
    preset,
    baseColor,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    vertexColors: Boolean(params.vertexColors ?? ao.vertexAO),
    ramp,
    rim,
    ao,
    atmosphere,
    water,
    tslGraph,
  };
}

function parseRendererQueryFlag(searchStr) {
  if (typeof searchStr !== 'string' || !searchStr) return null;
  const query = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr;
  for (const part of query.split('&')) {
    if (!part) continue;
    const [rawK, rawV = ''] = part.split('=');
    const k = decodeURIComponent(rawK || '').toLowerCase();
    if (k === 'renderer') {
      return decodeURIComponent(rawV || '').toLowerCase();
    }
  }
  return null;
}

/**
 * WebGPU + TSL readiness bridge.
 * Detects `?renderer=webgpu` opt-in or injected/available `WebGPURenderer`,
 * cleanly configures the active renderer with automatic WebGL2 fallback,
 * exposes `buildStylizedNodeSpec(params)`, and logs telemetry cleanly.
 */
export function createNextGenRendererBridge(THREE, opts = {}) {
  const search = opts.search ?? (typeof globalThis !== 'undefined' ? globalThis.location?.search ?? '' : '');
  const queryRenderer = parseRendererQueryFlag(search);
  const wantWebGPU = queryRenderer === 'webgpu' || Boolean(opts.preferWebGPU);
  const requestedBackend = wantWebGPU ? 'webgpu' : 'webgl2';

  const navGpu = opts.gpu ?? globalThis?.navigator?.gpu ?? null;
  const webgpuApiPresent = Boolean(navGpu && typeof navGpu.requestAdapter === 'function');
  const WebGPURendererCtor = opts.WebGPURenderer || THREE?.WebGPURenderer || null;

  let renderer = opts.existingRenderer || null;
  let backend = 'headless';
  let fallbackReason = null;

  const rendererConfig = {
    canvas: opts.canvas,
    antialias: opts.antialias ?? true,
    alpha: opts.alpha ?? false,
    powerPreference: opts.powerPreference ?? 'high-performance',
    stencil: opts.stencil ?? false,
    preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
  };

  if (renderer) {
    backend = renderer.isWebGPURenderer ? 'webgpu' : 'webgl2';
  } else if (wantWebGPU && webgpuApiPresent && typeof WebGPURendererCtor === 'function') {
    try {
      renderer = new WebGPURendererCtor(rendererConfig);
      backend = 'webgpu';
    } catch (err) {
      fallbackReason = `WebGPURenderer init failed: ${err?.message || String(err)}`;
      renderer = null;
    }
  } else if (wantWebGPU) {
    if (!webgpuApiPresent) {
      fallbackReason = 'navigator.gpu unavailable; fell back to WebGL2';
    } else if (!WebGPURendererCtor) {
      fallbackReason = 'three/webgpu WebGPURenderer not bundled; fell back to WebGL2';
    }
  }

  if (!renderer && THREE && typeof THREE.WebGLRenderer === 'function') {
    const canCreateWebGL = Boolean(opts.canvas || typeof document !== 'undefined');
    if (canCreateWebGL) {
      try {
        renderer = new THREE.WebGLRenderer(rendererConfig);
        backend = 'webgl2';
      } catch (err) {
        fallbackReason = fallbackReason || `WebGLRenderer creation skipped: ${err?.message || String(err)}`;
        backend = 'headless';
      }
    } else {
      backend = 'headless';
    }
  }

  // Apply Hue & Seek color-management defaults when an active renderer exists
  if (renderer) {
    if (THREE?.SRGBColorSpace && 'outputColorSpace' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    if (THREE?.ACESFilmicToneMapping !== undefined && 'toneMapping' in renderer) {
      renderer.toneMapping = opts.toneMapping ?? THREE.ACESFilmicToneMapping;
    }
    if ('toneMappingExposure' in renderer) {
      renderer.toneMappingExposure = opts.toneMappingExposure ?? 1.04;
    }
    if (typeof renderer.setPixelRatio === 'function' && typeof globalThis?.devicePixelRatio === 'number') {
      const cap = opts.maxPixelRatio ?? 2;
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, cap));
    }
    if (opts.enableShadows && renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      if (THREE?.PCFSoftShadowMap !== undefined) {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
    }
  }

  let capabilities = probeNextGenCapabilities(renderer);
  const telemetry = {
    backend,
    requestedBackend,
    fallbackReason,
    tslReady: backend === 'webgpu' || Boolean(opts.tslModule),
    capabilities,
    initialized: false,
    timestamp: Date.now(),
  };

  async function init() {
    if (renderer && typeof renderer.init === 'function') {
      try {
        await renderer.init();
      } catch (err) {
        telemetry.fallbackReason = `renderer.init() warning: ${err?.message || String(err)}`;
      }
    }
    capabilities = await probeWebGPUAdapter({ renderer, gpu: navGpu });
    telemetry.capabilities = capabilities;
    telemetry.initialized = true;
    telemetry.timestamp = Date.now();
    return telemetry;
  }

  function logTelemetry(logger = console) {
    if (!logger || typeof logger.info !== 'function') return telemetry;
    const cap = telemetry.capabilities;
    const line =
      `[HueSeek NextGen] backend=${telemetry.backend}` +
      ` (requested=${telemetry.requestedBackend})` +
      ` webgpu=${cap.webgpuAvailable ? 'yes' : 'no'}` +
      ` tex=${cap.recommendedTextureFormat}` +
      ` astc=${cap.astc ? 1 : 0} etc2=${cap.etc2 ? 1 : 0} bc7=${cap.bc7 ? 1 : 0}` +
      (telemetry.fallbackReason ? ` note="${telemetry.fallbackReason}"` : '');
    logger.info(line);
    return telemetry;
  }

  function dispose() {
    if (renderer && typeof renderer.dispose === 'function') {
      renderer.dispose();
    }
  }

  return {
    renderer,
    backend,
    requestedBackend,
    fallbackReason,
    get capabilities() {
      return capabilities;
    },
    telemetry,
    init,
    buildStylizedNodeSpec,
    logTelemetry,
    dispose,
  };
}

/* ==========================================================================
 * 3. Zero-Dependency Binary glTF 2.0 (`.glb`) Parser & Packer
 * ========================================================================== */

function decodeBase64DataUri(uri) {
  const commaIdx = uri.indexOf(',');
  if (commaIdx === -1) return new Uint8Array(0);
  const b64 = uri.slice(commaIdx + 1);
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(0);
}

function readAccessorTypedArray(json, binBytes, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Invalid glTF accessor index: ${accessorIndex}`);

  const compInfo = COMPONENT_TYPE_INFO[accessor.componentType];
  if (!compInfo) throw new Error(`Unsupported glTF componentType: ${accessor.componentType}`);

  const itemSize = ACCESSOR_TYPE_COMPONENTS[accessor.type];
  if (!itemSize) throw new Error(`Unsupported glTF accessor type: ${accessor.type}`);

  const count = accessor.count || 0;
  const totalComponents = count * itemSize;

  if (accessor.bufferView === undefined) {
    return {
      array: new compInfo.ArrayType(totalComponents),
      itemSize,
      count,
      normalized: Boolean(accessor.normalized),
      componentType: accessor.componentType,
    };
  }

  const bv = json.bufferViews?.[accessor.bufferView];
  if (!bv) throw new Error(`Invalid glTF bufferView index: ${accessor.bufferView}`);

  const bufDef = json.buffers?.[bv.buffer || 0];
  let sourceBytes = binBytes;
  if ((!sourceBytes || sourceBytes.byteLength === 0) && typeof bufDef?.uri === 'string' && bufDef.uri.startsWith('data:')) {
    sourceBytes = decodeBase64DataUri(bufDef.uri);
  }
  if (!sourceBytes) throw new Error('Missing binary buffer data for glTF accessor');

  const byteOffset = (bv.byteOffset || 0) + (accessor.byteOffset || 0);
  const elementBytes = itemSize * compInfo.bytes;
  const byteStride = bv.byteStride || elementBytes;

  let out;
  if (byteStride === elementBytes && byteOffset % compInfo.bytes === 0) {
    // Tightly packed & aligned: copy into clean standalone typed array
    const slice = sourceBytes.buffer.slice(
      sourceBytes.byteOffset + byteOffset,
      sourceBytes.byteOffset + byteOffset + count * elementBytes
    );
    out = new compInfo.ArrayType(slice);
  } else {
    // Interleaved or unaligned bufferView: unpack via DataView
    const dv = new DataView(sourceBytes.buffer, sourceBytes.byteOffset, sourceBytes.byteLength);
    out = new compInfo.ArrayType(totalComponents);
    let dst = 0;
    for (let i = 0; i < count; i++) {
      let off = byteOffset + i * byteStride;
      for (let c = 0; c < itemSize; c++) {
        switch (accessor.componentType) {
          case 5120: out[dst++] = dv.getInt8(off); break;
          case 5121: out[dst++] = dv.getUint8(off); break;
          case 5122: out[dst++] = dv.getInt16(off, true); break;
          case 5123: out[dst++] = dv.getUint16(off, true); break;
          case 5125: out[dst++] = dv.getUint32(off, true); break;
          case 5126: out[dst++] = dv.getFloat32(off, true); break;
        }
        off += compInfo.bytes;
      }
    }
  }

  // Convert normalized integer vertex attributes (e.g. COLOR_0 Uint8/Uint16) to Float32 [0..1]
  if (accessor.normalized && accessor.componentType !== 5126) {
    const f32 = new Float32Array(out.length);
    const inv = 1 / compInfo.max;
    for (let i = 0; i < out.length; i++) {
      f32[i] = Math.max(-1, out[i] * inv);
    }
    return { array: f32, itemSize, count, normalized: false, componentType: 5126 };
  }

  return {
    array: out,
    itemSize,
    count,
    normalized: Boolean(accessor.normalized),
    componentType: accessor.componentType,
  };
}

/**
 * Inspects a binary `.glb` buffer without requiring Three.js (fast Node audit helper).
 */
export function inspectGLBBuffer(inputBuffer) {
  const bytes =
    inputBuffer instanceof Uint8Array
      ? inputBuffer
      : ArrayBuffer.isView(inputBuffer)
      ? new Uint8Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.byteLength)
      : new Uint8Array(inputBuffer);

  if (bytes.byteLength < 20) {
    throw new Error(`Invalid GLB buffer: too small (${bytes.byteLength} bytes)`);
  }

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = dv.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error(`Invalid GLB magic header: 0x${magic.toString(16)} (expected 0x46546c67)`);
  }
  const version = dv.getUint32(4, true);
  if (version !== GLB_VERSION) {
    throw new Error(`Unsupported glTF version: ${version} (expected 2)`);
  }
  const totalLength = dv.getUint32(8, true);
  if (totalLength > bytes.byteLength) {
    throw new Error(`Truncated GLB buffer: header declares ${totalLength} bytes, got ${bytes.byteLength}`);
  }

  let json = null;
  let binBytes = new Uint8Array(0);
  let offset = 12;

  while (offset + 8 <= totalLength) {
    const chunkLen = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLen;
    if (chunkEnd > bytes.byteLength) {
      throw new Error(`GLB chunk exceeds buffer bounds at offset ${offset}`);
    }

    if (chunkType === GLB_CHUNK_JSON && !json) {
      const text = new TextDecoder('utf-8').decode(bytes.subarray(chunkStart, chunkEnd)).replace(/\0+$/, '').trim();
      json = JSON.parse(text);
    } else if (chunkType === GLB_CHUNK_BIN && binBytes.byteLength === 0) {
      binBytes = bytes.subarray(chunkStart, chunkEnd);
    }
    offset = chunkEnd;
  }

  if (!json) {
    throw new Error('GLB file is missing required JSON chunk');
  }

  let primitiveCount = 0;
  let vertexCount = 0;
  let triangleCount = 0;
  let hasUV0 = false;
  let hasUV1 = false;
  let hasVertexColors = false;

  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      primitiveCount++;
      const attrs = prim.attributes || {};
      if (attrs.POSITION !== undefined) {
        const posAcc = json.accessors?.[attrs.POSITION];
        vertexCount += posAcc?.count || 0;
      }
      if (prim.indices !== undefined) {
        const idxAcc = json.accessors?.[prim.indices];
        triangleCount += Math.floor((idxAcc?.count || 0) / 3);
      } else if (attrs.POSITION !== undefined) {
        const posAcc = json.accessors?.[attrs.POSITION];
        triangleCount += Math.floor((posAcc?.count || 0) / 3);
      }
      if (attrs.TEXCOORD_0 !== undefined) hasUV0 = true;
      if (attrs.TEXCOORD_1 !== undefined) hasUV1 = true;
      if (attrs.COLOR_0 !== undefined) hasVertexColors = true;
    }
  }

  return {
    json,
    binBytes,
    meta: {
      generator: json.asset?.generator || 'unknown',
      version: json.asset?.version || '2.0',
      meshCount: (json.meshes || []).length,
      nodeCount: (json.nodes || []).length,
      materialCount: (json.materials || []).length,
      primitiveCount,
      vertexCount,
      triangleCount,
      hasUV0,
      hasUV1,
      hasUV2: hasUV1,
      hasVertexColors,
      byteLength: bytes.byteLength,
    },
  };
}

/**
 * Zero-dependency binary glTF 2.0 (`.glb`) parser & Three.js `Group` builder.
 * Handles JSON + BIN chunks, `POSITION`, `NORMAL`, `TEXCOORD_0`,
 * `TEXCOORD_1` -> Three.js `uv1` + `uv2`, `COLOR_0` -> Vertex AO (`color`),
 * `indices`, PBR `baseColorFactor`, roughness/metalness, emissive, and node transforms.
 */
export function parseGLBBuffer(THREE, arrayBuffer, opts = {}) {
  if (!THREE) throw new Error('parseGLBBuffer requires a THREE module reference');
  const { json, binBytes, meta } = inspectGLBBuffer(arrayBuffer);

  // Decode embedded glTF 2.0 PNG/JPEG textures from BIN bufferViews (browser runtime; safe no-op in headless Node)
  const decodedTextures = new Map();
  function getGlbTexture(texIndex, isSRGB = true) {
    if (texIndex === undefined || texIndex === null) return null;
    const cacheKey = `${texIndex}:${isSRGB ? 1 : 0}`;
    if (decodedTextures.has(cacheKey)) return decodedTextures.get(cacheKey);
    const texDef = json.textures?.[texIndex];
    const imgDef = texDef && json.images?.[texDef.source];
    if (!imgDef || imgDef.bufferView === undefined || !binBytes) return null;
    if (typeof Blob === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      return null;
    }
    const bv = json.bufferViews?.[imgDef.bufferView];
    if (!bv) return null;
    const offset = bv.byteOffset || 0;
    const slice = binBytes.slice(offset, offset + bv.byteLength);
    const mime = imgDef.mimeType || 'image/png';
    const blob = new Blob([slice], { type: mime });
    const objUrl = URL.createObjectURL(blob);
    const tex = new THREE.Texture();
    tex.flipY = false; // glTF 2.0 UV origin is top-left
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    if (isSRGB && 'colorSpace' in tex && THREE.SRGBColorSpace) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    const img = new Image();
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
      try { URL.revokeObjectURL(objUrl); } catch (_) {}
    };
    img.onerror = () => {
      try { URL.revokeObjectURL(objUrl); } catch (_) {}
    };
    img.src = objUrl;
    decodedTextures.set(cacheKey, tex);
    return tex;
  }

  const builtMaterials = (json.materials || []).map((matDef, idx) => {
    const pbr = matDef.pbrMetallicRoughness || {};
    const baseColor = pbr.baseColorFactor || [1, 1, 1, 1];
    const emissive = matDef.emissiveFactor || [0, 0, 0];
    const alphaMode = matDef.alphaMode || 'OPAQUE';
    const baseMap = pbr.baseColorTexture ? getGlbTexture(pbr.baseColorTexture.index, true) : null;
    const emissiveMap = matDef.emissiveTexture ? getGlbTexture(matDef.emissiveTexture.index, true) : null;

    const mat = new THREE.MeshStandardMaterial({
      name: matDef.name || `GLBMaterial_${idx}`,
      color: new THREE.Color().setRGB(baseColor[0], baseColor[1], baseColor[2]),
      map: baseMap || null,
      roughness: pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 0.78,
      metalness: pbr.metallicFactor !== undefined ? pbr.metallicFactor : 0.0,
      emissive: new THREE.Color().setRGB(emissive[0], emissive[1], emissive[2]),
      emissiveMap: emissiveMap || null,
      emissiveIntensity: matDef.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1.0,
      opacity: baseColor[3] !== undefined ? baseColor[3] : 1.0,
      transparent: alphaMode === 'BLEND' || (baseColor[3] !== undefined && baseColor[3] < 0.999),
      alphaTest: alphaMode === 'MASK' ? (matDef.alphaCutoff ?? 0.5) : 0,
      side: matDef.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (matDef.extras) mat.userData = { ...mat.userData, ...matDef.extras };
    return mat;
  });

  function buildMeshObject(meshIndex, nodeName) {
    const meshDef = json.meshes?.[meshIndex];
    if (!meshDef) return new THREE.Group();

    const primitives = meshDef.primitives || [];
    const builtMeshes = [];

    for (let p = 0; p < primitives.length; p++) {
      const prim = primitives[p];
      const attrs = prim.attributes || {};
      const geo = new THREE.BufferGeometry();

      if (attrs.POSITION !== undefined) {
        const pos = readAccessorTypedArray(json, binBytes, attrs.POSITION);
        geo.setAttribute('position', new THREE.BufferAttribute(pos.array, pos.itemSize));
      }
      if (attrs.NORMAL !== undefined) {
        const norm = readAccessorTypedArray(json, binBytes, attrs.NORMAL);
        geo.setAttribute('normal', new THREE.BufferAttribute(norm.array, norm.itemSize));
      }
      if (attrs.TEXCOORD_0 !== undefined) {
        const uv0 = readAccessorTypedArray(json, binBytes, attrs.TEXCOORD_0);
        geo.setAttribute('uv', new THREE.BufferAttribute(uv0.array, uv0.itemSize));
      }
      if (attrs.TEXCOORD_1 !== undefined) {
        const uv1 = readAccessorTypedArray(json, binBytes, attrs.TEXCOORD_1);
        const attr1 = new THREE.BufferAttribute(uv1.array, uv1.itemSize);
        // Set BOTH uv1 (Three.js r151+ lightMap standard) AND uv2 (legacy alias)
        geo.setAttribute('uv1', attr1);
        geo.setAttribute('uv2', attr1);
      }

      let hasColor = false;
      if (attrs.COLOR_0 !== undefined) {
        const col = readAccessorTypedArray(json, binBytes, attrs.COLOR_0);
        geo.setAttribute('color', new THREE.BufferAttribute(col.array, col.itemSize));
        hasColor = true;
      }

      if (prim.indices !== undefined) {
        const idx = readAccessorTypedArray(json, binBytes, prim.indices);
        geo.setIndex(new THREE.BufferAttribute(idx.array, 1));
      }

      if (!geo.attributes.normal && geo.attributes.position) {
        geo.computeVertexNormals();
      }
      geo.computeBoundingBox();
      geo.computeBoundingSphere();

      let mat;
      if (prim.material !== undefined && builtMaterials[prim.material]) {
        mat = builtMaterials[prim.material];
        if (hasColor && !mat.vertexColors) {
          mat = mat.clone();
          mat.vertexColors = true;
        }
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.8,
          metalness: 0.05,
          vertexColors: hasColor,
        });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = primitives.length === 1 ? (nodeName || meshDef.name || `Mesh_${meshIndex}`) : `${meshDef.name || `Mesh_${meshIndex}`}_prim${p}`;
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      builtMeshes.push(mesh);
    }

    if (builtMeshes.length === 1) return builtMeshes[0];
    const grp = new THREE.Group();
    grp.name = nodeName || meshDef.name || `MeshGroup_${meshIndex}`;
    for (const m of builtMeshes) grp.add(m);
    return grp;
  }

  function buildNode(nodeIndex) {
    const nodeDef = json.nodes?.[nodeIndex];
    if (!nodeDef) return new THREE.Group();

    const obj =
      nodeDef.mesh !== undefined
        ? buildMeshObject(nodeDef.mesh, nodeDef.name)
        : new THREE.Group();

    if (nodeDef.name && !obj.name) obj.name = nodeDef.name;
    if (nodeDef.extras) obj.userData = { ...obj.userData, ...nodeDef.extras };

    if (Array.isArray(nodeDef.matrix) && nodeDef.matrix.length === 16) {
      const m4 = new THREE.Matrix4().fromArray(nodeDef.matrix);
      m4.decompose(obj.position, obj.quaternion, obj.scale);
    } else {
      if (Array.isArray(nodeDef.translation)) {
        obj.position.set(nodeDef.translation[0], nodeDef.translation[1], nodeDef.translation[2]);
      }
      if (Array.isArray(nodeDef.rotation)) {
        obj.quaternion.set(nodeDef.rotation[0], nodeDef.rotation[1], nodeDef.rotation[2], nodeDef.rotation[3]);
      }
      if (Array.isArray(nodeDef.scale)) {
        obj.scale.set(nodeDef.scale[0], nodeDef.scale[1], nodeDef.scale[2]);
      }
    }

    if (Array.isArray(nodeDef.children)) {
      for (const childIdx of nodeDef.children) {
        obj.add(buildNode(childIdx));
      }
    }
    return obj;
  }

  const rootGroup = new THREE.Group();
  const activeSceneIdx = json.scene ?? 0;
  const activeScene = json.scenes?.[activeSceneIdx];
  rootGroup.name = activeScene?.name || 'GLBScene';

  const rootNodeIndices = activeScene?.nodes ?? (json.nodes ? json.nodes.map((_, i) => i) : []);
  for (const nodeIdx of rootNodeIndices) {
    rootGroup.add(buildNode(nodeIdx));
  }

  rootGroup.userData.glbMeta = meta;
  return {
    scene: rootGroup,
    scenes: [rootGroup],
    json,
    meta,
    parser: 'nextgen-lite-glb',
  };
}

/**
 * Packs an array of mesh part descriptors into a spec-compliant glTF 2.0 binary `.glb` Uint8Array.
 * Each part: `{ name, positions, normals, uv0, uv1, colors, indices, material, translation, rotation, scale }`.
 */
export function packGLBBuffer(parts, opts = {}) {
  const generator = opts.generator || 'Hue & Seek NextGen Pipeline v2';
  const sceneName = opts.sceneName || 'HueSeekHeroAsset';

  const binChunks = [];
  let binOffset = 0;

  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const meshes = [];
  const nodes = [];

  function pad4(n) {
    return (n + 3) & ~3;
  }

  function appendBufferView(typedArray, target) {
    const rawBytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const alignedOffset = pad4(binOffset);
    if (alignedOffset > binOffset) {
      binChunks.push(new Uint8Array(alignedOffset - binOffset));
      binOffset = alignedOffset;
    }
    const bvIndex = bufferViews.length;
    const bv = {
      buffer: 0,
      byteOffset: binOffset,
      byteLength: rawBytes.byteLength,
    };
    if (target) bv.target = target;
    bufferViews.push(bv);
    binChunks.push(rawBytes);
    binOffset += rawBytes.byteLength;
    return bvIndex;
  }

  function computeMinMaxVec3(arr) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const pos = part.positions instanceof Float32Array ? part.positions : new Float32Array(part.positions);
    const norm = part.normals instanceof Float32Array ? part.normals : new Float32Array(part.normals);
    const uv0 = part.uv0 instanceof Float32Array ? part.uv0 : new Float32Array(part.uv0);
    const uv1 = part.uv1 ? (part.uv1 instanceof Float32Array ? part.uv1 : new Float32Array(part.uv1)) : null;
    const col = part.colors ? (part.colors instanceof Float32Array ? part.colors : new Float32Array(part.colors)) : null;

    const vertCount = pos.length / 3;
    const attrs = {};

    // POSITION (required, with min/max per glTF 2.0 spec)
    const posBv = appendBufferView(pos, 34962);
    const { min, max } = computeMinMaxVec3(pos);
    attrs.POSITION = accessors.length;
    accessors.push({ bufferView: posBv, componentType: 5126, count: vertCount, type: 'VEC3', min, max });

    // NORMAL
    const normBv = appendBufferView(norm, 34962);
    attrs.NORMAL = accessors.length;
    accessors.push({ bufferView: normBv, componentType: 5126, count: vertCount, type: 'VEC3' });

    // TEXCOORD_0
    const uv0Bv = appendBufferView(uv0, 34962);
    attrs.TEXCOORD_0 = accessors.length;
    accessors.push({ bufferView: uv0Bv, componentType: 5126, count: vertCount, type: 'VEC2' });

    // TEXCOORD_1 (Baked Lightmap UV2)
    if (uv1) {
      const uv1Bv = appendBufferView(uv1, 34962);
      attrs.TEXCOORD_1 = accessors.length;
      accessors.push({ bufferView: uv1Bv, componentType: 5126, count: vertCount, type: 'VEC2' });
    }

    // COLOR_0 (Baked Vertex AO)
    if (col) {
      const colBv = appendBufferView(col, 34962);
      attrs.COLOR_0 = accessors.length;
      accessors.push({ bufferView: colBv, componentType: 5126, count: vertCount, type: 'VEC3' });
    }

    // Indices
    const prim = { attributes: attrs, material: materials.length };
    if (part.indices) {
      const useU32 = vertCount > 65535;
      const idxArr = useU32
        ? part.indices instanceof Uint32Array ? part.indices : new Uint32Array(part.indices)
        : part.indices instanceof Uint16Array ? part.indices : new Uint16Array(part.indices);
      const idxBv = appendBufferView(idxArr, 34963);
      prim.indices = accessors.length;
      accessors.push({
        bufferView: idxBv,
        componentType: useU32 ? 5125 : 5123,
        count: idxArr.length,
        type: 'SCALAR',
      });
    }

    // Material
    const m = part.material || {};
    const matJson = {
      name: m.name || `${part.name || `Part_${i}`}_Mat`,
      pbrMetallicRoughness: {
        baseColorFactor: m.baseColorFactor || [0.9, 0.85, 0.78, 1.0],
        metallicFactor: m.metallicFactor ?? 0.05,
        roughnessFactor: m.roughnessFactor ?? 0.78,
      },
    };
    if (m.emissiveFactor) matJson.emissiveFactor = m.emissiveFactor;
    if (m.doubleSided) matJson.doubleSided = true;
    materials.push(matJson);

    const meshIdx = meshes.length;
    meshes.push({ name: part.name || `Part_${i}`, primitives: [prim] });

    const nodeJson = { name: part.name || `Part_${i}`, mesh: meshIdx };
    if (part.translation) nodeJson.translation = part.translation;
    if (part.rotation) nodeJson.rotation = part.rotation;
    if (part.scale) nodeJson.scale = part.scale;
    if (part.extras) nodeJson.extras = part.extras;
    nodes.push(nodeJson);
  }

  // Pad BIN chunk to 4-byte boundary
  const paddedBinLen = pad4(binOffset);
  if (paddedBinLen > binOffset) {
    binChunks.push(new Uint8Array(paddedBinLen - binOffset));
    binOffset = paddedBinLen;
  }

  const gltfJson = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ name: sceneName, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: paddedBinLen }],
  };

  const jsonBytesRaw = new TextEncoder().encode(JSON.stringify(gltfJson));
  const paddedJsonLen = pad4(jsonBytesRaw.byteLength);
  const jsonChunkBytes = new Uint8Array(paddedJsonLen);
  jsonChunkBytes.set(jsonBytesRaw);
  for (let i = jsonBytesRaw.byteLength; i < paddedJsonLen; i++) jsonChunkBytes[i] = 0x20; // space padding per glTF spec

  const totalLength = 12 + 8 + paddedJsonLen + 8 + paddedBinLen;
  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);

  // Header
  dv.setUint32(0, GLB_MAGIC, true);
  dv.setUint32(4, GLB_VERSION, true);
  dv.setUint32(8, totalLength, true);

  // JSON chunk
  dv.setUint32(12, paddedJsonLen, true);
  dv.setUint32(16, GLB_CHUNK_JSON, true);
  out.set(jsonChunkBytes, 20);

  // BIN chunk
  const binHeaderOffset = 20 + paddedJsonLen;
  dv.setUint32(binHeaderOffset, paddedBinLen, true);
  dv.setUint32(binHeaderOffset + 4, GLB_CHUNK_BIN, true);
  let writePos = binHeaderOffset + 8;
  for (const chunk of binChunks) {
    out.set(chunk, writePos);
    writePos += chunk.byteLength;
  }

  return out;
}

/* ==========================================================================
 * 4. Baked Lightmap Binding (`uv1` + `uv2` dual compatibility)
 * ========================================================================== */

/**
 * Verifies/copies lightmap UV channels (`uv1` in Three.js r151+ AND `uv2` alias)
 * across a Mesh or Group and binds `lightMap` + `lightMapIntensity`.
 */
export function applyBakedLightmap(meshOrGroup, lightmapTex, intensity = 0.85, opts = {}) {
  if (!meshOrGroup || !lightmapTex) {
    return { updatedMeshes: 0, copiedUvCount: 0, intensity };
  }

  if (typeof lightmapTex === 'object') {
    // Three.js r151+ uses Texture.channel = 1 to sample `uv1`
    if ('channel' in lightmapTex || opts.forceChannel !== false) {
      lightmapTex.channel = opts.channel ?? 1;
    }
    if (opts.flipY === false) {
      lightmapTex.flipY = false;
    }
  }

  let updatedMeshes = 0;
  let copiedUvCount = 0;

  const visit = (obj) => {
    if (!obj) return;
    if (obj.isMesh && obj.geometry && obj.material) {
      const geo = obj.geometry;
      const attrs = geo.attributes || {};

      // Synchronize uv1 <-> uv2; if neither exists, promote uv -> uv1 & uv2
      if (attrs.uv1 && !attrs.uv2) {
        geo.setAttribute('uv2', attrs.uv1);
      } else if (attrs.uv2 && !attrs.uv1) {
        geo.setAttribute('uv1', attrs.uv2);
      } else if (!attrs.uv1 && !attrs.uv2 && attrs.uv) {
        geo.setAttribute('uv1', attrs.uv);
        geo.setAttribute('uv2', attrs.uv);
        copiedUvCount++;
      }

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat || !('lightMap' in mat)) continue;
        mat.lightMap = lightmapTex;
        mat.lightMapIntensity = intensity;
        if (opts.asAoMap && 'aoMap' in mat) {
          mat.aoMap = lightmapTex;
          mat.aoMapIntensity = opts.aoMapIntensity ?? intensity;
        }
        mat.needsUpdate = true;
      }
      updatedMeshes++;
    }
  };

  if (typeof meshOrGroup.traverse === 'function') {
    meshOrGroup.traverse(visit);
  } else {
    visit(meshOrGroup);
  }

  return { updatedMeshes, copiedUvCount, intensity };
}

/* ==========================================================================
 * 5. Hand-Sculpted Chamfered Hero Geometry Builder (with `uv1`/`uv2` + Vertex AO)
 * ========================================================================== */

const CUBE_FACES = [
  // { axisU, axisV, axisN }
  { u: [0, 0, -1], v: [0, 1, 0], n: [1, 0, 0] },   // +X
  { u: [0, 0, 1], v: [0, 1, 0], n: [-1, 0, 0] },   // -X
  { u: [1, 0, 0], v: [0, 0, -1], n: [0, 1, 0] },   // +Y
  { u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0] },   // -Y
  { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] },    // +Z
  { u: [-1, 0, 0], v: [0, 1, 0], n: [0, 0, -1] },  // -Z
];

/**
 * Generates raw typed arrays for a chamfered/beveled box with optional top taper,
 * packed non-overlapping `uv1`/`uv2` lightmap atlas coordinates, and baked Vertex AO.
 */
export function generateBeveledBoxData(spec = {}) {
  const width = Math.max(0.05, spec.width ?? 1.0);
  const height = Math.max(0.05, spec.height ?? 1.0);
  const depth = Math.max(0.05, spec.depth ?? 1.0);
  const segments = Math.max(1, Math.min(6, Math.round(spec.segments ?? 2)));
  const taperTop = clamp(spec.taperTop ?? 1.0, 0.2, 1.8);
  const yOffset = spec.yOffset ?? 0;
  const aoFloor = clamp(spec.aoFloor ?? 0.56, 0.1, 1.0);
  const aoTop = clamp(spec.aoTop ?? 1.0, 0.5, 1.0);
  const uv2Rect = spec.uv2Rect || [0, 0, 1, 1]; // [uMin, vMin, uSize, vSize]

  const hx = width * 0.5;
  const hy = height * 0.5;
  const hz = depth * 0.5;
  const bevel = clamp(spec.bevel ?? Math.min(width, height, depth) * 0.14, 0.005, Math.min(hx, hy, hz) * 0.46);
  const ix = hx - bevel;
  const iy = hy - bevel;
  const iz = hz - bevel;

  const vertsPerEdge = segments * 2 + 2; // 2 bevel zones + 1 flat center span
  const vertsPerFace = vertsPerEdge * vertsPerEdge;
  const totalVerts = vertsPerFace * 6;
  const quadsPerFace = (vertsPerEdge - 1) * (vertsPerEdge - 1);
  const totalIndices = quadsPerFace * 6 * 6;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uv0 = new Float32Array(totalVerts * 2);
  const uv1 = new Float32Array(totalVerts * 2);
  const colors = new Float32Array(totalVerts * 3);
  const indices = new Uint16Array(totalIndices);

  let vCursor = 0;
  let iCursor = 0;

  // Pack the 6 faces into a 3x2 atlas inside uv2Rect with 3% seam gutter
  const pad = 0.03;

  for (let f = 0; f < 6; f++) {
    const face = CUBE_FACES[f];
    const baseVertex = vCursor;
    const col = f % 3;
    const row = Math.floor(f / 3);

    for (let j = 0; j < vertsPerEdge; j++) {
      const signV = j <= segments ? -1 : 1;
      const fracV = j <= segments ? (segments - j) / segments : (j - (segments + 1)) / segments;
      const faceV = j / (vertsPerEdge - 1);

      for (let i = 0; i < vertsPerEdge; i++) {
        const signU = i <= segments ? -1 : 1;
        const fracU = i <= segments ? (segments - i) / segments : (i - (segments + 1)) / segments;
        const faceU = i / (vertsPerEdge - 1);

        // Direction on unit corner sphere (exact seamless normal match across adjacent faces!)
        let dx = face.u[0] * signU * fracU + face.v[0] * signV * fracV + face.n[0];
        let dy = face.u[1] * signU * fracU + face.v[1] * signV * fracV + face.n[1];
        let dz = face.u[2] * signU * fracU + face.v[2] * signV * fracV + face.n[2];
        const dLen = Math.hypot(dx, dy, dz) || 1;
        dx /= dLen;
        dy /= dLen;
        dz /= dLen;

        // Inner box corner for this quadrant
        const cx = (face.u[0] * signU + face.v[0] * signV + face.n[0]) * ix;
        const cy = (face.u[1] * signU + face.v[1] * signV + face.n[1]) * iy;
        const cz = (face.u[2] * signU + face.v[2] * signV + face.n[2]) * iz;

        let px = cx + dx * bevel;
        let py = cy + dy * bevel;
        let pz = cz + dz * bevel;

        // Optional storybook silhouette taper along height
        const yNorm = clamp((py + hy) / height, 0, 1);
        const taper = 1 + (taperTop - 1) * yNorm;
        px *= taper;
        pz *= taper;

        // Adjust normal slightly for taper slope
        let nx = dx;
        let ny = dy;
        let nz = dz;
        if (Math.abs(taperTop - 1) > 1e-4) {
          const slope = ((1 - taperTop) * Math.max(hx, hz)) / height;
          ny += slope * Math.hypot(dx, dz);
          const nLen = Math.hypot(nx, ny, nz) || 1;
          nx /= nLen;
          ny /= nLen;
          nz /= nLen;
        }

        const v3 = vCursor * 3;
        positions[v3] = px;
        positions[v3 + 1] = py + yOffset;
        positions[v3 + 2] = pz;

        normals[v3] = nx;
        normals[v3 + 1] = ny;
        normals[v3 + 2] = nz;

        // Standard UV0
        const v2 = vCursor * 2;
        uv0[v2] = faceU;
        uv0[v2 + 1] = faceV;

        // Non-overlapping Lightmap UV1 / UV2 inside 3x2 chart
        const localU2 = (col + pad + faceU * (1 - 2 * pad)) / 3;
        const localV2 = (row + pad + faceV * (1 - 2 * pad)) / 2;
        uv1[v2] = uv2Rect[0] + localU2 * uv2Rect[2];
        uv1[v2 + 1] = uv2Rect[1] + localV2 * uv2Rect[3];

        // Baked Vertex AO: recessed ground contact + sky hemisphere bounce + chamfer highlight lift
        const groundAO = aoFloor + (aoTop - aoFloor) * smoothstep(0.0, 0.42, yNorm);
        const skyAO = 0.86 + 0.14 * (ny * 0.5 + 0.5);
        const edgeBevelLift = (1 - Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz))) * 0.1;
        const ao = clamp(groundAO * skyAO + edgeBevelLift, 0.35, 1.0);
        // Subtle warm-sun / cool-crease coloration
        colors[v3] = clamp(ao * (0.98 + 0.03 * yNorm), 0, 1);
        colors[v3 + 1] = clamp(ao * (0.97 + 0.02 * yNorm), 0, 1);
        colors[v3 + 2] = clamp(ao * (1.01 - 0.03 * yNorm), 0, 1);

        vCursor++;
      }
    }

    // Two CCW triangles per quad
    for (let j = 0; j < vertsPerEdge - 1; j++) {
      for (let i = 0; i < vertsPerEdge - 1; i++) {
        const a = baseVertex + j * vertsPerEdge + i;
        const b = a + 1;
        const c = a + vertsPerEdge;
        const d = c + 1;
        indices[iCursor++] = a;
        indices[iCursor++] = b;
        indices[iCursor++] = d;
        indices[iCursor++] = a;
        indices[iCursor++] = d;
        indices[iCursor++] = c;
      }
    }
  }

  return { positions, normals, uv0, uv1, colors, indices };
}

/**
 * Generates multi-part storybook lantern geometry data (used by both
 * `buildBeveledHeroGeometry` and the CLI `--generate-sample` GLB exporter).
 */
export function buildStorybookLanternParts() {
  return [
    {
      name: 'LanternPlinth',
      ...generateBeveledBoxData({
        width: 0.72,
        height: 0.24,
        depth: 0.72,
        bevel: 0.06,
        segments: 2,
        taperTop: 0.84,
        yOffset: 0.12,
        aoFloor: 0.52,
        uv2Rect: [0.0, 0.0, 0.5, 0.5],
      }),
      material: {
        name: 'WarmLimestone',
        baseColorFactor: [0.76, 0.72, 0.65, 1.0],
        roughnessFactor: 0.88,
        metallicFactor: 0.02,
      },
    },
    {
      name: 'LanternFrameBase',
      ...generateBeveledBoxData({
        width: 0.52,
        height: 0.18,
        depth: 0.52,
        bevel: 0.045,
        segments: 2,
        taperTop: 0.92,
        yOffset: 0.31,
        aoFloor: 0.64,
        uv2Rect: [0.5, 0.0, 0.5, 0.5],
      }),
      material: {
        name: 'AgedTimberIron',
        baseColorFactor: [0.34, 0.25, 0.20, 1.0],
        roughnessFactor: 0.66,
        metallicFactor: 0.28,
      },
    },
    {
      name: 'LanternAmberCore',
      ...generateBeveledBoxData({
        width: 0.42,
        height: 0.56,
        depth: 0.42,
        bevel: 0.055,
        segments: 2,
        taperTop: 1.12,
        yOffset: 0.66,
        aoFloor: 0.88,
        uv2Rect: [0.0, 0.5, 0.5, 0.5],
      }),
      material: {
        name: 'AmberLanternGlass',
        baseColorFactor: [1.0, 0.84, 0.46, 1.0],
        emissiveFactor: [0.85, 0.52, 0.14],
        roughnessFactor: 0.28,
        metallicFactor: 0.05,
      },
    },
    {
      name: 'LanternRoofCap',
      ...generateBeveledBoxData({
        width: 0.78,
        height: 0.26,
        depth: 0.78,
        bevel: 0.06,
        segments: 2,
        taperTop: 0.36,
        yOffset: 1.04,
        aoFloor: 0.70,
        uv2Rect: [0.5, 0.5, 0.5, 0.5],
      }),
      material: {
        name: 'PatinaCopperRoof',
        baseColorFactor: [0.32, 0.58, 0.52, 1.0],
        roughnessFactor: 0.52,
        metallicFactor: 0.42,
      },
    },
  ];
}

function mergeRawParts(parts) {
  let totalVerts = 0;
  let totalIndices = 0;
  for (const p of parts) {
    totalVerts += p.positions.length / 3;
    totalIndices += p.indices.length;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uv0 = new Float32Array(totalVerts * 2);
  const uv1 = new Float32Array(totalVerts * 2);
  const colors = new Float32Array(totalVerts * 3);
  const indices = totalVerts > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vOff = 0;
  let iOff = 0;
  for (const p of parts) {
    positions.set(p.positions, vOff * 3);
    normals.set(p.normals, vOff * 3);
    uv0.set(p.uv0, vOff * 2);
    uv1.set(p.uv1, vOff * 2);
    colors.set(p.colors, vOff * 3);
    for (let k = 0; k < p.indices.length; k++) {
      indices[iOff + k] = p.indices[k] + vOff;
    }
    vOff += p.positions.length / 3;
    iOff += p.indices.length;
  }
  return { positions, normals, uv0, uv1, colors, indices };
}

/**
 * Generates chamfered/beveled architectural or prop `THREE.BufferGeometry`
 * with pre-baked `uv1` + `uv2` lightmap UVs and Vertex AO (`color`).
 */
export function buildBeveledHeroGeometry(THREE, spec = {}) {
  if (!THREE) throw new Error('buildBeveledHeroGeometry requires a THREE module reference');

  let raw;
  if (spec.shape === 'lantern') {
    raw = mergeRawParts(buildStorybookLanternParts());
  } else if (spec.shape === 'roofCap') {
    raw = generateBeveledBoxData({
      width: spec.width ?? 1.4,
      height: spec.height ?? 0.55,
      depth: spec.depth ?? 1.4,
      bevel: spec.bevel ?? 0.09,
      segments: spec.segments ?? 2,
      taperTop: spec.taperTop ?? 0.35,
      yOffset: spec.yOffset ?? 0,
      aoFloor: spec.aoFloor ?? 0.62,
    });
  } else {
    raw = generateBeveledBoxData(spec);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(raw.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(raw.normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(raw.uv0, 2));

  const uvLightmapAttr = new THREE.BufferAttribute(raw.uv1, 2);
  geo.setAttribute('uv1', uvLightmapAttr);
  geo.setAttribute('uv2', uvLightmapAttr);
  geo.setAttribute('color', new THREE.BufferAttribute(raw.colors, 3));
  geo.setIndex(new THREE.BufferAttribute(raw.indices, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  return geo;
}

/* ==========================================================================
 * 6. Stylized `.glb` + `KTX2/Basis` + `uv2` Baked Lightmap Asset Loader
 * ========================================================================== */

/**
 * Creates the Next-Gen Asset Loader with in-memory model caching, built-in
 * zero-dependency `.glb` parsing, optional delegation to `GLTFLoader` /
 * `KTX2Loader` / `DRACOLoader` when present, and baked lightmap support.
 */
export function createNextGenAssetLoader(config = {}) {
  const {
    THREE,
    renderer = null,
    ktx2TranscoderPath = './vendor/basis/',
    dracoDecoderPath = './vendor/draco/',
    addonsBasePath = './vendor/three/addons/loaders/',
    fetchImpl = typeof globalThis?.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
  } = config;

  const modelCache = new Map();
  const textureCache = new Map();
  let addonsProbed = false;
  let gltfLoaderInstance = config.gltfLoader || null;
  let ktx2LoaderInstance = config.ktx2Loader || null;
  let dracoLoaderInstance = config.dracoLoader || null;

  async function tryInitOptionalAddons() {
    if (addonsProbed) return;
    addonsProbed = true;

    const base = addonsBasePath.endsWith('/') ? addonsBasePath : `${addonsBasePath}/`;

    if (!ktx2LoaderInstance) {
      try {
        const mod = await import(`${base}KTX2Loader.js`);
        if (mod?.KTX2Loader) {
          ktx2LoaderInstance = new mod.KTX2Loader();
          ktx2LoaderInstance.setTranscoderPath(ktx2TranscoderPath);
          if (renderer && typeof ktx2LoaderInstance.detectSupport === 'function') {
            ktx2LoaderInstance.detectSupport(renderer);
          }
        }
      } catch (_) {
        ktx2LoaderInstance = null;
      }
    }

    if (!dracoLoaderInstance) {
      try {
        const mod = await import(`${base}DRACOLoader.js`);
        if (mod?.DRACOLoader) {
          dracoLoaderInstance = new mod.DRACOLoader();
          dracoLoaderInstance.setDecoderPath(dracoDecoderPath);
        }
      } catch (_) {
        dracoLoaderInstance = null;
      }
    }

    if (!gltfLoaderInstance) {
      try {
        const mod = await import(`${base}GLTFLoader.js`);
        if (mod?.GLTFLoader) {
          gltfLoaderInstance = new mod.GLTFLoader();
          if (ktx2LoaderInstance && typeof gltfLoaderInstance.setKTX2Loader === 'function') {
            gltfLoaderInstance.setKTX2Loader(ktx2LoaderInstance);
          }
          if (dracoLoaderInstance && typeof gltfLoaderInstance.setDRACOLoader === 'function') {
            gltfLoaderInstance.setDRACOLoader(dracoLoaderInstance);
          }
        }
      } catch (_) {
        gltfLoaderInstance = null;
      }
    }
  }

  async function fetchArrayBuffer(url) {
    if (fetchImpl) {
      const res = await fetchImpl(url);
      if (!res || !res.ok) {
        throw new Error(`HTTP ${res?.status ?? 'ERR'} loading ${url}`);
      }
      return await res.arrayBuffer();
    }
    throw new Error(`No fetch implementation available to load ${url}`);
  }

  function buildFallbackHeroGroup(url, opts = {}) {
    const group = new THREE.Group();
    group.name = `FallbackHero_${url.split('/').pop() || 'prop'}`;
    const geo = buildBeveledHeroGeometry(THREE, opts.fallbackSpec || { shape: 'lantern' });
    const mat = new THREE.MeshStandardMaterial({
      color: opts.fallbackColor ?? 0xd8c8a8,
      roughness: 0.78,
      metalness: 0.06,
      vertexColors: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    group.add(mesh);
    group.userData.isFallback = true;
    return group;
  }

  function postProcessLoadedGroup(root, opts = {}) {
    if (!root) return root;
    if (typeof opts.scale === 'number') {
      root.scale.setScalar(opts.scale);
    } else if (Array.isArray(opts.scale) && opts.scale.length === 3) {
      root.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    }
    if (opts.lightmap) {
      applyBakedLightmap(root, opts.lightmap, opts.lightmapIntensity ?? 0.85);
    }
    if (typeof opts.painterlyUpgrade === 'function') {
      opts.painterlyUpgrade(root);
    }
    return root;
  }

  async function loadHeroModel(url, opts = {}) {
    if (!THREE) throw new Error('createNextGenAssetLoader requires a THREE module reference');

    const useCache = opts.cache !== false;
    if (useCache && modelCache.has(url)) {
      const cached = modelCache.get(url);
      const clone = cached.scene.clone(true);
      clone.userData = { ...cached.scene.userData, fromCache: true };
      return {
        ...cached,
        scene: postProcessLoadedGroup(clone, opts),
        fromCache: true,
      };
    }

    await tryInitOptionalAddons();

    let result = null;
    try {
      if (gltfLoaderInstance && !opts.forceBuiltInParser) {
        result = await new Promise((resolve, reject) => {
          gltfLoaderInstance.load(
            url,
            (gltf) => {
              // Ensure uv2 <-> uv1 compatibility on addon-loaded GLBs too
              gltf.scene?.traverse?.((obj) => {
                if (obj?.isMesh && obj.geometry?.attributes) {
                  const a = obj.geometry.attributes;
                  if (a.uv1 && !a.uv2) obj.geometry.setAttribute('uv2', a.uv1);
                  else if (a.uv2 && !a.uv1) obj.geometry.setAttribute('uv1', a.uv2);
                }
              });
              resolve({ scene: gltf.scene, scenes: gltf.scenes, animations: gltf.animations || [], parser: 'three-gltf-loader' });
            },
            undefined,
            reject
          );
        });
      } else {
        const buffer = opts.arrayBuffer || (await fetchArrayBuffer(url));
        result = parseGLBBuffer(THREE, buffer, opts);
      }
    } catch (err) {
      if (opts.throwOnError) throw err;
      const fallbackGroup = buildFallbackHeroGroup(url, opts);
      result = {
        scene: fallbackGroup,
        scenes: [fallbackGroup],
        parser: 'fallback-beveled-hero',
        error: err?.message || String(err),
      };
    }

    if (useCache && result?.scene && !result.error) {
      modelCache.set(url, {
        scene: result.scene.clone(true),
        meta: result.meta || null,
        parser: result.parser,
      });
    }

    postProcessLoadedGroup(result.scene, opts);
    return { ...result, fromCache: false };
  }

  async function loadTexture(url, opts = {}) {
    if (!THREE) throw new Error('loadTexture requires a THREE module reference');
    await tryInitOptionalAddons();

    const targetUrl = ktx2LoaderInstance && opts.ktx2Url ? opts.ktx2Url : url;
    if (opts.cache !== false && textureCache.has(targetUrl)) {
      return textureCache.get(targetUrl);
    }

    let tex = null;
    if (ktx2LoaderInstance && targetUrl.toLowerCase().endsWith('.ktx2')) {
      try {
        tex = await ktx2LoaderInstance.loadAsync(targetUrl);
      } catch (_) {
        tex = null;
      }
    }

    if (!tex && THREE.TextureLoader) {
      const loader = new THREE.TextureLoader();
      tex = await loader.loadAsync(url);
    }

    if (tex) {
      if (opts.colorSpace && 'colorSpace' in tex) tex.colorSpace = opts.colorSpace;
      if (opts.flipY !== undefined) tex.flipY = opts.flipY;
      if (opts.cache !== false) textureCache.set(targetUrl, tex);
    }
    return tex;
  }

  return {
    parseGLBBuffer: (arrayBuffer, opts) => parseGLBBuffer(THREE, arrayBuffer, opts),
    applyBakedLightmap,
    buildBeveledHeroGeometry: (spec) => buildBeveledHeroGeometry(THREE, spec),
    loadHeroModel,
    loadTexture,
    getLoaderCapabilities: () => ({
      addonsProbed,
      hasGLTFLoader: Boolean(gltfLoaderInstance),
      hasKTX2Loader: Boolean(ktx2LoaderInstance),
      hasDRACOLoader: Boolean(dracoLoaderInstance),
      builtInGLBParser: true,
    }),
    getCacheStats: () => ({
      models: modelCache.size,
      textures: textureCache.size,
      modelKeys: [...modelCache.keys()],
    }),
    clearCache: () => {
      modelCache.clear();
      textureCache.clear();
    },
    dispose: () => {
      modelCache.clear();
      for (const tex of textureCache.values()) tex?.dispose?.();
      textureCache.clear();
      ktx2LoaderInstance?.dispose?.();
      dracoLoaderInstance?.dispose?.();
    },
  };
}
