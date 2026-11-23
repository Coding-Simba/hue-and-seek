// ============================================================================
// Building 3: Old Herbal Boiler & Waterwheel Mill (boiler_tower.js)
// Handcrafted Storybook 3D landmark & 2-room cutaway interior modeled from
// ext_03_boiler_tower.png & int_03_boiler_tower.png.
// ALL materials strictly use metalness: 0 for warm Storybook gouache shading!
// ============================================================================

import {
  createBuilderKit,
  paintedCanvasTex,
  brushStrokes,
  RoundedBoxGeometry,
} from '../../map_kit.js?v=2';
import {
  getBathMats,
  buildKawaraGableRoof,
  buildKawaraPentAwning,
  buildMossyStonePlinth,
  addNorenCurtain,
  VERDIGRIS_PAL,
  WISTERIA_PAL,
  FOLIAGE_PAL,
} from '../bath_kit.js?v=2';

const PI = Math.PI;
const TAU = PI * 2;

const _boilerGeoCache = new WeakMap();
function bGeo(THREE, key, make) {
  let m = _boilerGeoCache.get(THREE);
  if (!m) { m = {}; _boilerGeoCache.set(THREE, m); }
  return m[key] || (m[key] = make());
}

let _boilerTexCache = null;
function getBoilerTextures(THREE) {
  if (_boilerTexCache) return _boilerTexCache;

  // 1. Blue-and-white porcelain ginger jar motif (cobalt clouds, peonies & waves)
  const porcelainJar = paintedCanvasTex(THREE, 'bh_boiler_porcelain_v3', 256, (g, s, rng) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#f8f5ec');
    grd.addColorStop(0.5, '#fffdf7');
    grd.addColorStop(1, '#e6dfd0');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 60, ['#ffffff', '#ece6d8'], 2, 5, 0.25);

    g.fillStyle = '#265094';
    g.fillRect(0, 16, s, 16);
    g.fillRect(0, s - 28, s, 16);
    g.strokeStyle = '#3b6cb8';
    g.lineWidth = 4;
    for (let x = 0; x < s; x += 32) {
      g.beginPath();
      g.arc(x + 16, 40, 12, 0, PI, false);
      g.stroke();
    }
    for (const cx of [48, 128, 208]) {
      const cy = s * 0.54 + (cx === 128 ? -8 : 8);
      g.fillStyle = '#22498a';
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * TAU;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19, 14, 9, a, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#8cb6eb';
      g.beginPath();
      g.arc(cx, cy, 8, 0, TAU);
      g.fill();
    }
  });

  // 2. Crimson & gold brocade apothecary table runner
  const crimsonRunner = paintedCanvasTex(THREE, 'bh_boiler_runner_v3', 256, (g, s, rng) => {
    g.fillStyle = '#b8282a';
    g.fillRect(0, 0, s, s);
    brushStrokes(g, s, rng, 120, ['#cf3638', '#941c20', '#dc4a42'], 3, 6, 0.28);
    g.fillStyle = '#edb948';
    g.fillRect(10, 0, 10, s);
    g.fillRect(s - 20, 0, 10, s);
    g.fillRect(0, s - 22, s, 12);
    g.strokeStyle = '#f8d476';
    g.lineWidth = 3;
    g.strokeRect(26, 10, s - 52, s - 38);
    for (const cy of [54, 124, 194]) {
      g.strokeStyle = '#f6cd68';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(s * 0.5, cy, 22, 0, TAU);
      g.stroke();
      g.fillStyle = '#fae08a';
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + PI * 0.25;
        g.beginPath();
        g.ellipse(s * 0.5 + Math.cos(a) * 13, cy + Math.sin(a) * 13, 8, 4, a, 0, TAU);
        g.fill();
      }
    }
  });

  // 3. Vintage cream & brass steam pressure gauge dial
  const gaugeDial = paintedCanvasTex(THREE, 'bh_boiler_gauge_v3', 128, (g, s) => {
    const cx = s * 0.5, cy = s * 0.5, r = s * 0.44;
    g.fillStyle = '#fdf6e2';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#3b2e28';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.stroke();
    g.strokeStyle = '#d13428';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx, cy, r * 0.80, -0.25 * PI, 0.22 * PI);
    g.stroke();
    g.strokeStyle = '#2d2420';
    g.lineWidth = 2.5;
    for (let i = 0; i <= 12; i++) {
      const a = 0.75 * PI + (i / 12) * 1.5 * PI;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.68, cy + Math.sin(a) * r * 0.68);
      g.lineTo(cx + Math.cos(a) * r * 0.90, cy + Math.sin(a) * r * 0.90);
      g.stroke();
    }
    g.strokeStyle = '#1e1816';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - 6, cy + 6);
    g.lineTo(cx + r * 0.58, cy - r * 0.44);
    g.stroke();
    g.fillStyle = '#c88c28';
    g.beginPath();
    g.arc(cx, cy, 7, 0, TAU);
    g.fill();
  });

  _boilerTexCache = { porcelainJar, crimsonRunner, gaugeDial };
  return _boilerTexCache;
}

function ensureBathKitTextures(THREE) {
  paintedCanvasTex(THREE, 'bh2_shoji_paper', 256, (ctx, s, rng) => {
    const grd = ctx.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#ffe094');
    grd.addColorStop(0.55, '#ffd068');
    grd.addColorStop(1, '#ffb33e');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 180, ['#ffebb0', '#ffc454', '#fff3c8'], 2, 6, 0.25);
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_noren_cream', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#f8ecd2';
    ctx.fillRect(0, 0, s, s);
    brushStrokes(ctx, s, rng, 100, ['#fff6e4', '#ead8b8'], 3, 6, 0.25);
    ctx.strokeStyle = '#7a3e26';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(s * 0.5, s * 0.62, 46, 0.12 * PI, 0.88 * PI); ctx.stroke();
    for (const dx of [-24, 0, 24]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.5 + dx, s * 0.56);
      ctx.bezierCurveTo(s * 0.5 + dx - 12, s * 0.42, s * 0.5 + dx + 12, s * 0.32, s * 0.5 + dx, s * 0.20);
      ctx.stroke();
    }
  }, 1, 1);

  paintedCanvasTex(THREE, 'bh2_warm_brick', 256, (ctx, s, rng) => {
    ctx.fillStyle = '#6c4c42';
    ctx.fillRect(0, 0, s, s);
    const rows = 8, cols = 4, bh = s / rows, bw = s / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = rng.pick(['#b84a39', '#c85843', '#9f3d2e', '#d0664e', '#a84334']);
        ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    brushStrokes(ctx, s, rng, 120, ['#d87458', '#8a3326'], 2, 4, 0.2);
  }, 2, 2);

  for (const [k, sz, rx, ry, hex] of [
    ['bh2_tatami', 256, 2, 2, '#b9be78'],
    ['bh2_noren_onsen', 256, 1, 1, '#4c3175'],
    ['bh2_noren_ramen', 256, 1, 1, '#2d3b6e'],
    ['bh2_noren_bun', 256, 1, 1, '#2d3b6e'],
    ['bh2_fuji_mural', 512, 1, 1, '#f4d998'],
    ['bh2_gold_pine_byobu', 512, 1, 1, '#e7ba52'],
    ['bh2_kimono_pink', 256, 1, 1, '#e85d88'],
    ['bh2_kimono_purple', 256, 1, 1, '#6c48a8'],
    ['bh2_taiko_head', 256, 1, 1, '#f4e4c4'],
  ]) {
    paintedCanvasTex(THREE, k, sz, (ctx, s) => {
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, s, s);
    }, rx, ry);
  }
}

export function buildBoilerTower(THREE, opts = {}) {
  ensureBathKitTextures(THREE);
  const K = createBuilderKit(THREE, opts, 'boiler_tower', 31);
  const {
    root, roofG, add, addR, boxCol, wall, beam,
    pushInst, pushInstMatrix, jr, pick, stoneQuoins, stoneArchVoussoirs,
  } = K;

  // Efficient box helpers: rb() for soft beveled furniture/masonry, bx() for crisp thin timber bars/slats!
  const rb = (w, h, d, r = 0.04, mat) => K.rbox(w, h, d, r, mat, 1);
  const bx = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const bm = getBathMats(THREE, K);
  const bTex = getBoilerTextures(THREE);

  // Streamlined Storybook material set (ALL metalness: 0 -> keeps total meshes <= 50!)
  const porcelainMat = K.M(0xffffff, bTex.porcelainJar, { roughness: 0.48, metalness: 0 });
  const runnerMat = K.M(0xffffff, bTex.crimsonRunner, { roughness: 0.85, metalness: 0 });
  const gaugeFaceMat = K.M(0xffffff, bTex.gaugeDial, { roughness: 0.52, metalness: 0 });

  // Shared cached unit geometries for instanced batches
  const rivetGeo = () => bGeo(THREE, 'rivet', () => new THREE.SphereGeometry(0.036, 6, 5));
  const coalGeo = () => bGeo(THREE, 'coal', () => new THREE.DodecahedronGeometry(0.10, 0));
  const jarBodyGeo = () => bGeo(THREE, 'jar_body_lathe', () => new THREE.LatheGeometry([
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.105, 0.00),
    new THREE.Vector2(0.118, 0.04),
    new THREE.Vector2(0.118, 0.20),
    new THREE.Vector2(0.078, 0.25),
    new THREE.Vector2(0.088, 0.275),
    new THREE.Vector2(0.00, 0.275),
  ], 10));
  const jarCapGeo = () => bGeo(THREE, 'jar_cap', () => new THREE.CylinderGeometry(0.072, 0.080, 0.06, 8));
  const drawerGeo = () => bGeo(THREE, 'med_drawer', () => new THREE.BoxGeometry(0.325, 0.242, 0.075));
  const pullGeo = () => bGeo(THREE, 'med_pull', () => new THREE.TorusGeometry(0.032, 0.009, 4, 8));
  const herbFloretGeo = () => bGeo(THREE, 'herb_floret', () => {
    const g = new THREE.IcosahedronGeometry(0.074, 0);
    g.scale(0.92, 1.48, 0.92);
    return g;
  });
  const steamGeo = () => bGeo(THREE, 'steam_puff', () => new THREE.IcosahedronGeometry(0.55, 2));
  const kawaraPanGeo = () => bGeo(THREE, 'kw_pan', () => new RoundedBoxGeometry(0.30, 0.036, 0.44, 1, 0.01));
  const kawaraBrlGeo = () => bGeo(THREE, 'kw_brl', () => {
    const g = new THREE.CylinderGeometry(0.145, 0.16, 0.44, 7, 1, false, 0, PI);
    g.rotateX(PI * 0.5);
    return g;
  });
  const kawaraCapGeo = () => bGeo(THREE, 'kw_cap', () => {
    const g = new THREE.CylinderGeometry(0.14, 0.14, 0.10, 9);
    g.rotateX(PI * 0.5);
    return g;
  });

  // Crisp, ultra-clean Kumiko shoji window (saves ~3,200 triangles per window vs seg=2 rbox!)
  function addCrispWindow(cx, cy, cz, rotY, w, h, cols = 4, rows = 3, P = root) {
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = rotY;
    P.add(g);
    add(bx(w - 0.06, h - 0.06, 0.04, bm.shojiGlow), 0, 0, 0, 0, 0, 0, g);
    for (const sx of [-1, 1]) add(bx(0.08, h + 0.08, 0.11, bm.darkTimber), sx * (w * 0.5), 0, 0, 0, 0, 0, g);
    for (const sy of [-1, 1]) add(bx(w + 0.14, 0.08, 0.12, bm.darkTimber), 0, sy * (h * 0.5), 0, 0, 0, 0, g);
    for (let c = 1; c < cols; c++) {
      add(bx(0.028, h - 0.06, 0.072, bm.cedar), -w * 0.5 + (c / cols) * w, 0, 0, 0, 0, 0, g);
    }
    for (let r = 1; r < rows; r++) {
      add(bx(w - 0.06, 0.028, 0.072, bm.cedar), 0, -h * 0.5 + (r / rows) * h, 0, 0, 0, 0, g);
    }
  }

  // Lush Verdigris 3D Kawara sloped roof plane (pan + barrel + golden eave caps + dark-timber deck!)
  // Batches directly into 'kawara_pan', 'kawara_brl', 'kawara_cap' for zero extra draw calls!
  function addKawaraSlope({ cx, cy, cz, width, slopeLen, pitch, rotY, P = roofG }) {
    const grpM = new THREE.Matrix4().makeRotationY(rotY).setPosition(cx, cy, cz);
    grpM.multiply(new THREE.Matrix4().makeRotationX(pitch));

    const deck = bx(width, 0.09, slopeLen, bm.darkTimber);
    deck.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -0.045, 0).premultiply(grpM));
    deck.castShadow = true; deck.receiveShadow = true;
    P.add(deck);

    const fascia = bx(width + 0.08, 0.12, 0.08, bm.darkTimber);
    fascia.applyMatrix4(new THREE.Matrix4().makeTranslation(0, -0.02, slopeLen * 0.5).premultiply(grpM));
    fascia.castShadow = true; fascia.receiveShadow = true;
    P.add(fascia);

    const rows = Math.max(3, Math.floor(slopeLen / 0.34));
    const cols = Math.max(4, Math.floor((width - 0.10) / 0.31));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), eu = new THREE.Euler();

    for (let r = 0; r < rows; r++) {
      const f = (r + 0.5) / rows;
      const lz = -slopeLen * 0.5 + f * slopeLen;
      const ly = Math.pow(f, 2.0) * 0.05;
      for (let c = 0; c < cols; c++) {
        const lx = -width * 0.5 + 0.18 + c * 0.31;
        const col = pick(VERDIGRIS_PAL);
        p.set(lx, ly + 0.015, lz);
        eu.set(-0.05, 0, 0);
        q.setFromEuler(eu);
        s.set(1, 1, 1);
        m4.compose(p, q, s).premultiply(grpM);
        pushInstMatrix('kawara_pan', kawaraPanGeo, bm.tileInst, m4, col, P);

        p.set(lx + 0.155, ly + 0.082, lz);
        s.set(0.80, 0.96, 0.98);
        m4.compose(p, q, s).premultiply(grpM);
        pushInstMatrix('kawara_brl', kawaraBrlGeo, bm.tileInst, m4, col, P);

        if (r === rows - 1) {
          p.set(lx + 0.155, ly + 0.082, slopeLen * 0.5 + 0.075);
          eu.set(0, 0, 0);
          q.setFromEuler(eu);
          s.set(0.92, 0.92, 1.15);
          m4.compose(p, q, s).premultiply(grpM);
          pushInstMatrix('kawara_cap', kawaraCapGeo, bm.goldTrim, m4, 0xf6c854, P);
        }
      }
    }
  }

  // Pipe helper: curved copper/iron TubeGeometry with flanged collars
  function addSteamPipe(pts, radius, pipeMat, collarMat, P = roofG, nCollars = 2) {
    const vPts = pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
    const curve = new THREE.CatmullRomCurve3(vPts, false, 'catmullrom', 0.28);
    const segs = Math.max(10, vPts.length * 5);
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 8, false), pipeMat), 0, 0, 0, 0, 0, 0, P);
    for (let i = 0; i <= nCollars; i++) {
      const t = nCollars === 0 ? 0.5 : (0.12 + (i / nCollars) * 0.76);
      const pt = curve.getPoint(t);
      const tan = curve.getTangent(t).normalize();
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.24, radius * 1.24, 0.075, 10), collarMat);
      ring.position.copy(pt);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      ring.castShadow = true; ring.receiveShadow = true;
      P.add(ring);
    }
  }

  // Hanging brass-and-timber Storybook porch lantern
  function addBrassPorchLantern(x, y, z, scale = 1.0, P = root) {
    const lg = new THREE.Group();
    lg.position.set(x, y, z);
    lg.scale.setScalar(scale);
    P.add(lg);
    add(bx(0.04, 0.18, 0.04, bm.ironWarm), 0, 0.27, 0, 0, 0, 0, lg);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.16, 4), bm.copperWarm), 0, 0.15, 0, 0, PI * 0.25, 0, lg);
    add(bx(0.24, 0.30, 0.24, bm.lanternGlow), 0, -0.04, 0, 0, 0, 0, lg);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(bx(0.026, 0.32, 0.026, bm.ironWarm), sx * 0.12, -0.04, sz * 0.12, 0, 0, 0, lg);
    }
    add(bx(0.28, 0.05, 0.28, bm.brassWarm), 0, -0.21, 0, 0, 0, 0, lg);
  }

  // Painterly clustered dried botanical / herb / wisteria bundle (unified into 'herb_floret'!)
  function addHerbBundle(x, yTop, z, len, cols, P = root, isWisteria = false) {
    add(bx(0.025, 0.18, 0.025, bm.darkTimber), x, yTop - 0.08, z, 0, 0, 0, P);
    for (let s = 0; s < 4; s++) {
      const sa = (s / 4) * TAU;
      pushInst('herb_floret', herbFloretGeo, bm.whiteInst,
        x + Math.cos(sa) * 0.035, yTop - 0.16, z + Math.sin(sa) * 0.035,
        0, sa, 0, 0.72, 0.95, 0.72, 0x568c42, P);
    }
    const count = isWisteria ? 22 : 18;
    for (let i = 0; i < count; i++) {
      const f = i / (count - 1);
      const a = i * 2.399 + jr(-0.2, 0.2);
      const profile = isWisteria ? (1 - f * 0.68) : Math.sin(Math.min(1, f * 1.15) * PI * 0.85);
      const rad = (0.025 + profile * 0.105) * jr(0.85, 1.18);
      const wy = yTop - 0.20 - f * (len * 0.85);
      const sc = (1.14 - f * 0.42) * jr(0.88, 1.18);
      pushInst('herb_floret', herbFloretGeo, bm.whiteInst,
        x + Math.cos(a) * rad, wy, z + Math.sin(a) * rad,
        jr(-0.35, 0.35), a, jr(-0.35, 0.35),
        sc, sc * 1.15, sc, pick(cols), P);
    }
  }

  // Spoked red boiler valve handwheel
  function addRedValveWheel(x, y, z, rotY = 0, radius = 0.24, P = root) {
    const vg = new THREE.Group();
    vg.position.set(x, y, z);
    vg.rotation.y = rotY;
    P.add(vg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.16, 8), bm.brassWarm), 0, 0, -0.06, PI * 0.5, 0, 0, vg);
    add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.034, 7, 16), bm.vermilion), 0, 0, 0.02, 0, 0, 0, vg);
    for (let i = 0; i < 3; i++) {
      add(bx(radius * 1.92, 0.030, 0.030, bm.vermilion), 0, 0, 0.02, 0, 0, (i / 3) * PI, vg);
    }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), bm.brassWarm), 0, 0, 0.035, 0, 0, 0, vg);
  }

  // Brass steam pressure gauge
  function addPressureGauge(x, y, z, rotY = 0, radius = 0.19, P = root) {
    const gg = new THREE.Group();
    gg.position.set(x, y, z);
    gg.rotation.y = rotY;
    P.add(gg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.16, 8), bm.brassWarm), 0, -radius - 0.06, -0.02, 0, 0, 0, gg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.085, 14), bm.brassWarm), 0, 0, 0, PI * 0.5, 0, 0, gg);
    const face = new THREE.CylinderGeometry(radius * 0.83, radius * 0.83, 0.02, 14);
    face.rotateX(PI * 0.5);
    add(new THREE.Mesh(face, gaugeFaceMat), 0, 0, 0.042, 0, 0, 0, gg);
  }

  // Sculpted jewel-toned apothecary herb jar + cork/brass stopper
  function addGlassHerbJar(x, yBottom, z, sx, sy, colHex, P = root) {
    pushInst('jar_body', jarBodyGeo, bm.whiteInst, x, yBottom, z, 0, jr(0, TAU), 0, sx, sy, sx, colHex, P);
    pushInst('jar_cap', jarCapGeo, bm.brassWarm, x, yBottom + 0.285 * sy, z, 0, 0, 0, sx, 1, sx, 0xe2a83c, P);
  }

  // ==========================================================================
  // 1. MOSSY SHORELINE STONE PLINTH, QUOINS & MILLRACE PIER (y <= 3.26m)
  // ==========================================================================
  const W = 9.2, D = 7.6, H_WALL = 3.26, TH = 0.26;
  const Z_FRONT = 3.62, Z_BACK = -3.76; // Inner Z: [-3.50, +3.36]
  const X_LEFT = -4.60, X_RIGHT = 4.60; // Inner X: [-4.34, +4.34]
  const DOOR_X = 0.34, DOOR_W = 1.64;

  buildMossyStonePlinth(THREE, K, {
    w: 9.3,
    d: 8.3,
    h: 0.40,
    doorX: 0.25,
    doorW: 1.85,
    steps: 3,
    hydrangeas: true,
    parent: root,
  });

  // Single unified walkable interior floor slab
  const interiorFloor = rb(8.72, 0.08, 6.94, 0.02, bm.stoneFloor);
  interiorFloor.userData.ground = true;
  add(interiorFloor, 0.0, 0.34, -0.06, 0, 0, 0, root);
  add(bx(4.24, 0.022, 6.68, bm.cedar), 2.12, 0.382, -0.06, 0, 0, 0, root);

  // Warm brick & stone corner quoins (cutY = 3.26 keeps all quoin stones in 1 root batch!)
  const quoinPal = [0xc57d62, 0xb56c52, 0xd49276, 0x9e6352];
  stoneQuoins(X_LEFT + 0.05, Z_FRONT - 0.05, 3.06, quoinPal, 0.36, 3.26);
  stoneQuoins(X_RIGHT - 0.05, Z_FRONT - 0.05, 3.06, quoinPal, 0.36, 3.26);
  stoneQuoins(X_LEFT + 0.05, Z_BACK + 0.05, 3.06, quoinPal, 0.36, 3.26);
  stoneQuoins(X_RIGHT - 0.05, Z_BACK + 0.05, 3.06, quoinPal, 0.36, 3.26);

  // Right-side exterior stone millrace wall & front-right corner stone pier with cedar railing
  add(rb(0.36, 1.68, 5.10, 0.05, bm.mossStone), X_RIGHT + 0.14, 0.86, 0.35, 0, 0, 0, root);
  add(rb(0.96, 0.92, 0.96, 0.06, bm.mossStone), 4.18, 0.78, 3.78, 0, 0, 0, root);
  for (const [rx, rz] of [[3.78, 4.18], [4.56, 4.18], [4.56, 3.42]]) {
    add(bx(0.07, 0.44, 0.07, bm.cedar), rx, 1.44, rz, 0, 0, 0, root);
  }
  add(bx(0.86, 0.06, 0.07, bm.cedar), 4.17, 1.64, 4.18, 0, 0, 0, root);
  add(bx(0.86, 0.05, 0.06, bm.cedar), 4.17, 1.44, 4.18, 0, 0, 0, root);
  add(bx(0.07, 0.06, 0.82, bm.cedar), 4.56, 1.64, 3.80, 0, 0, 0, root);

  // ==========================================================================
  // 2. HOLLOW GROUND-FLOOR TIMBER & PLASTER WALLS + PARTITION (y <= 3.26m)
  // ==========================================================================
  wall(0, Z_FRONT, 0, W, H_WALL, TH, [
    { u: DOOR_X, w: DOOR_W, h: 2.52, door: true, arch: true },
    { u: -2.72, y0: 1.18, w: 2.32, h: 1.36 },
    { u: 2.42, y0: 1.16, w: 1.34, h: 1.36 },
  ], bm.cedar, bm.warmInnerWall, root, true);

  stoneArchVoussoirs(DOOR_X, 1.72, Z_FRONT + 0.04, 0, DOOR_W * 0.5 + 0.04, quoinPal, 9, root);
  for (const sx of [-1, 1]) {
    add(bx(0.14, 2.35, 0.34, bm.darkTimber), DOOR_X + sx * (DOOR_W * 0.5 + 0.05), 1.35, Z_FRONT - TH * 0.5, 0, 0, 0, root);
  }
  addCrispWindow(-2.72, 1.86, Z_FRONT - 0.10, 0, 2.35, 1.38, 5, 3, root);
  addCrispWindow(2.42, 1.84, Z_FRONT - 0.10, 0, 1.36, 1.38, 4, 3, root);

  // Back wall (-Z)
  wall(0, Z_BACK, PI, W, H_WALL, TH, [
    { u: 2.45, y0: 1.45, w: 1.25, h: 1.15 },
  ], bm.cedar, bm.warmInnerWall, root, true);
  addCrispWindow(-2.45, 2.02, Z_BACK + 0.12, PI, 1.28, 1.18, 3, 3, root);
  add(rb(1.42, 2.92, 0.34, 0.04, bm.warmBrick), 3.10, 1.80, Z_BACK - 0.14, 0, 0, 0, root);

  // Left wall (-X)
  wall(X_LEFT, -0.07, -PI * 0.5, 7.38, H_WALL, TH, [
    { u: 1.85, y0: 1.28, w: 1.38, h: 1.26 },
  ], bm.cedar, bm.warmInnerWall, root, true);
  addCrispWindow(X_LEFT + 0.12, 1.91, 1.78, -PI * 0.5, 1.40, 1.28, 4, 3, root);

  // Right wall (+X)
  wall(X_RIGHT, -0.07, PI * 0.5, 7.38, H_WALL, TH, [
    { u: 2.05, y0: 1.35, w: 1.22, h: 1.18 },
  ], bm.cedar, bm.warmInnerWall, root, true);
  addCrispWindow(X_RIGHT - 0.12, 1.94, -2.12, PI * 0.5, 1.24, 1.20, 3, 3, root);

  // Interior Partition Wall at x = -0.15 spanning z in [-3.50, +1.72] (leaves welcoming front foyer!)
  // Center cz = -0.89, L = 5.22 -> wz = -0.89 + u => u = 1.24 gives doorway at wz = +0.35!
  wall(-0.27, -0.89, -PI * 0.5, 5.22, H_WALL, 0.24, [
    { u: 1.24, w: 1.60, h: 2.50, door: true, arch: true },
  ], bm.warmInnerWall, bm.warmInnerWall, root, true);

  for (const pz of [-0.46, 1.16, 1.72]) {
    add(bx(0.28, 2.86, 0.14, bm.darkTimber), -0.15, 1.81, pz, 0, 0, 0, root);
  }
  add(bx(0.26, 0.20, 1.72, bm.darkTimber), -0.15, 3.10, 2.52, 0, 0, 0, root);
  add(bx(0.30, 0.14, 1.82, bm.darkTimber), -0.15, 2.66, 0.35, 0, 0, 0, root);
  addNorenCurtain(THREE, K, {
    cx: -0.15, yTop: 2.58, z: 0.35, rotY: PI * 0.5,
    width: 1.46, height: 0.46, panels: 3, texMap: bm.BT.norenCream, parent: root,
  });

  for (const xPost of [-4.45, -0.95, 1.28, 3.52, 4.45]) {
    add(bx(0.14, 2.86, 0.14, bm.darkTimber), xPost, 1.81, Z_FRONT + 0.02, 0, 0, 0, root);
  }
  add(bx(W + 0.08, 0.12, 0.10, bm.darkTimber), 0, 3.20, Z_FRONT + 0.03, 0, 0, 0, root);
  add(bx(W + 0.08, 0.12, 0.10, bm.darkTimber), 0, 3.20, Z_BACK - 0.03, 0, 0, 0, root);

  // ==========================================================================
  // 3. OPEN-FRONT OUTDOOR HERB APOTHECARY PORCH (ext_03_boiler_tower.png!)
  // ==========================================================================
  for (const px of [-4.42, -0.68, 1.30, 3.56]) {
    add(rb(0.24, 0.14, 0.24, 0.03, bm.mossStone), px, 0.45, 4.18, 0, 0, 0, root);
    add(bx(0.15, 2.74, 0.15, bm.darkTimber), px, 1.88, 4.18, 0, 0, 0, root);
  }
  add(bx(8.22, 0.14, 0.16, bm.darkTimber), -0.42, 3.19, 4.18, 0, 0, 0, root);

  // A. Left Front Bay (x ~ -2.60, z ~ 3.80): 3-Tier Display Shelves with 24 Jewel-Toned Herb Jars!
  const shelfX = -2.60, shelfZ = 3.80, shelfW = 3.32;
  for (const sx of [-1, 1]) {
    add(bx(0.10, 1.62, 0.34, bm.darkTimber), shelfX + sx * (shelfW * 0.5), 1.88, shelfZ, 0, 0, 0, root);
  }
  const herbJarColors = [0xf29c1f, 0x35b85e, 0x9b54f2, 0xe63b4e, 0x3b78f0, 0xf2cf38, 0xf56d2c, 0x3cc4ac];
  [1.18, 1.68, 2.18].forEach((sy, rIdx) => {
    add(bx(shelfW + 0.10, 0.065, 0.34, bm.cedar), shelfX, sy, shelfZ, 0, 0, 0, root);
    for (let c = 0; c < 8; c++) {
      const jx = shelfX - shelfW * 0.44 + (c / 7) * (shelfW * 0.88);
      const col = herbJarColors[(rIdx * 3 + c) % herbJarColors.length];
      addGlassHerbJar(jx, sy + 0.032, shelfZ + jr(-0.02, 0.02), 1.0, jr(0.92, 1.12), col, root);
    }
  });

  // Coopered wooden casks & herb tub below the outdoor shelves
  for (const [cx, cz, cr, ch] of [[-3.82, 3.94, 0.32, 0.62], [-3.02, 3.98, 0.24, 0.44], [-1.72, 3.94, 0.30, 0.60]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(cr * 0.88, cr * 0.86, ch, 12), bm.cedar), cx, 0.40 + ch * 0.5, cz, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(cr * 0.90, 0.022, 5, 14), bm.ironWarm), cx, 0.40 + ch * 0.28, cz, PI * 0.5, 0, 0, root);
    add(new THREE.Mesh(new THREE.TorusGeometry(cr * 0.90, 0.022, 5, 14), bm.ironWarm), cx, 0.40 + ch * 0.74, cz, PI * 0.5, 0, 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(cr * 0.82, cr * 0.82, 0.04, 12), bm.hinoki), cx, 0.40 + ch + 0.01, cz, 0, 0, 0, root);
  }
  boxCol(-2.62, 3.92, 3.25, 0.60);

  // B. Right/Center Front Porch: Hanging Dried Wisteria & Golden Herbs + Apothecary Counter + Lanterns!
  const counterX = 2.42, counterZ = 3.94;
  add(rb(1.90, 0.84, 0.54, 0.03, bm.cedar), counterX, 0.82, counterZ, 0, 0, 0, root);
  add(rb(2.02, 0.075, 0.64, 0.025, bm.hinoki), counterX, 1.26, counterZ, 0, 0, 0, root);
  for (const dx of [-0.60, 0, 0.60]) {
    add(bx(0.50, 0.62, 0.05, bm.darkTimber), counterX + dx, 0.82, counterZ + 0.26, 0, 0, 0, root);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), bm.brassWarm), counterX + dx, 0.82, counterZ + 0.30, 0, 0, 0, root);
  }
  for (let b = 0; b < 7; b++) {
    const bxPos = counterX - 0.74 + b * 0.245;
    const bzPos = counterZ + (b % 2 === 0 ? -0.06 : 0.08);
    addGlassHerbJar(bxPos, 1.295, bzPos, 0.70, 0.78 + (b % 3) * 0.14, herbJarColors[(b * 2 + 1) % herbJarColors.length], root);
  }
  add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), bm.warmInnerWall), 3.55, 0.66, 4.06, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.10, 10), bm.darkTimber), 3.55, 0.94, 4.06, 0, 0, 0, root);
  boxCol(2.54, 3.95, 2.22, 0.60);

  // Lush hanging bundles of dried purple wisteria, golden herbs & pink blossoms from front eave beam!
  addHerbBundle(1.50, 3.12, 4.14, 0.82, [0xff8fb8, 0xe85d8e, 0xffbdd6], root, false);
  addHerbBundle(1.98, 3.12, 4.14, 0.86, [0xf6d242, 0xe2ae24, 0xffe87a], root, false);
  addHerbBundle(2.50, 3.12, 4.14, 0.92, WISTERIA_PAL, root, true);
  addHerbBundle(3.04, 3.12, 4.14, 0.85, WISTERIA_PAL, root, true);
  addHerbBundle(-0.26, 3.14, 4.14, 0.42, FOLIAGE_PAL, root, false);
  addHerbBundle(0.92, 3.14, 4.14, 0.42, [0xf6d242, 0x72b65c], root, false);

  addBrassPorchLantern(-4.50, 2.38, 4.22, 1.05, root);
  addBrassPorchLantern(3.64, 2.34, 4.26, 1.08, root);
  addBrassPorchLantern(4.32, 2.42, 3.38, 0.88, root);

  // ==========================================================================
  // 4. GIANT ANIMATED WOODEN WATERWHEEL + CASCADING TURQUOISE WATER (wheelGroup!)
  // ==========================================================================
  const WHEEL_X = 4.85, WHEEL_Y = 1.98, WHEEL_Z = 0.68;
  const WHEEL_R = 2.05, WHEEL_W = 0.68;

  const wheelGroup = new THREE.Group();
  wheelGroup.name = 'waterwheel';
  wheelGroup.userData.keep = true;
  wheelGroup.position.set(WHEEL_X, WHEEL_Y, WHEEL_Z);
  root.add(wheelGroup);

  // 3-material timber & brass wheel construction -> merges into just 3 draw calls!
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, WHEEL_W + 0.32, 12), bm.darkTimber),
    0.04, 0, 0, 0, 0, PI * 0.5, wheelGroup);
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.13, 12), bm.brassWarm),
      sx * (WHEEL_W * 0.5 + 0.04), 0, 0, 0, 0, PI * 0.5, wheelGroup);
    const rimX = sx * (WHEEL_W * 0.5 - 0.04);
    // Chunky sculpted rectangular cedar rims (16 mortised segments) + inner concentric rim
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      add(bx(0.09, 0.20, 0.84, bm.cedar),
        rimX, Math.cos(a) * (WHEEL_R - 0.10), Math.sin(a) * (WHEEL_R - 0.10), -a, 0, 0, wheelGroup);
      add(bx(0.07, 0.13, 0.62, bm.darkTimber),
        rimX, Math.cos(a) * 1.45, Math.sin(a) * 1.45, -a, 0, 0, wheelGroup);
    }
    // 12 stout radial cedar spokes per cheek + brass rim clamp plates
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const cy = Math.cos(a), sz = Math.sin(a);
      add(bx(0.08, WHEEL_R - 0.14, 0.12, bm.cedar),
        rimX, cy * (WHEEL_R * 0.48), sz * (WHEEL_R * 0.48), -a, 0, 0, wheelGroup);
      add(bx(0.12, 0.16, 0.18, bm.brassWarm),
        rimX + sx * 0.02, cy * (WHEEL_R - 0.08), sz * (WHEEL_R - 0.08), -a, 0, 0, wheelGroup);
    }
  }

  // 16 angled wooden paddles & water-catching bucket lips
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const rMid = 1.72;
    add(bx(WHEEL_W - 0.06, 0.40, 0.065, bm.cedar),
      0, Math.cos(a) * rMid, Math.sin(a) * rMid, -a + 0.34, 0, 0, wheelGroup);
    add(bx(WHEEL_W - 0.08, 0.06, 0.18, bm.darkTimber),
      0, Math.cos(a) * (WHEEL_R - 0.08), Math.sin(a) * (WHEEL_R - 0.08), -a, 0, 0, wheelGroup);
  }

  // Stationary millrace flume, brass hub spout & slender multi-strand turquoise waterfalls + white foam!
  add(bx(0.46, 0.24, 1.30, bm.darkTimber), 4.86, 2.86, WHEEL_Z + 1.20, 0.14, 0, 0, root);
  add(bx(0.32, 0.09, 1.22, bm.waterGlow), 4.88, 2.94, WHEEL_Z + 1.22, 0.14, 0, 0, root);

  for (const [dx, rTube] of [[-0.14, 0.075], [0.10, 0.085]]) {
    const flumeStream = new THREE.CatmullRomCurve3([
      new THREE.Vector3(WHEEL_X + dx, 2.78, WHEEL_Z + 1.72),
      new THREE.Vector3(WHEEL_X + dx, 1.95, WHEEL_Z + 1.98),
      new THREE.Vector3(WHEEL_X + dx, 0.95, WHEEL_Z + 1.95),
      new THREE.Vector3(WHEEL_X + dx + 0.04, 0.08, WHEEL_Z + 1.82),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(flumeStream, 12, rTube, 6, false), bm.waterGlow), 0, 0, 0, 0, 0, 0, root);
  }

  // Outer brass hub spout pouring a graceful arched turquoise stream (matches ext_03!)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.34, 10), bm.brassWarm),
    WHEEL_X + 0.44, WHEEL_Y, WHEEL_Z, 0, 0, PI * 0.5, root);
  for (const [dz, rTube] of [[-0.04, 0.075], [0.05, 0.065]]) {
    const spoutStream = new THREE.CatmullRomCurve3([
      new THREE.Vector3(WHEEL_X + 0.56, WHEEL_Y - 0.03, WHEEL_Z + dz),
      new THREE.Vector3(WHEEL_X + 0.78, WHEEL_Y - 0.48, WHEEL_Z + dz * 1.4),
      new THREE.Vector3(WHEEL_X + 0.88, 0.82, WHEEL_Z + dz * 1.8),
      new THREE.Vector3(WHEEL_X + 0.92, 0.08, WHEEL_Z + dz * 2.0),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(spoutStream, 12, rTube, 6, false), bm.waterGlow), 0, 0, 0, 0, 0, 0, root);
  }

  // 24 white foam splash spheres at the wheel base (batched into 'coal' / 'herb_floret' whiteInst!)
  for (let f = 0; f < 24; f++) {
    const fz = WHEEL_Z - 1.55 + (f / 23) * 3.65 + jr(-0.10, 0.10);
    const fx = 4.82 + (f < 14 ? jr(0.35, 0.95) : jr(-0.05, 0.45));
    const sc = jr(1.35, 2.35);
    pushInst('herb_floret', herbFloretGeo, bm.whiteInst,
      fx, 0.09 + jr(0, 0.22), fz, jr(0, 3), jr(0, 3), 0, sc, sc * 0.55, sc, 0xf2fcff, root);
  }
  boxCol(WHEEL_X, WHEEL_Z, 0.96, 4.10);

  // ==========================================================================
  // 5. 3-TIER ASYMMETRIC ROOF SILHOUETTE, COPPER TANK & BRICK CHIMNEY (K.roofG!)
  // ==========================================================================
  addR(bx(W + 0.18, 0.22, D + 0.18, bm.darkTimber), 0, 3.37, -0.06);

  // A. Tier 1 Front Verdigris 3D Kawara Pent Awning (x in [-1.05, +4.55])
  buildKawaraPentAwning(THREE, K, {
    cx: 1.75,
    zWall: 3.30,
    yWall: 3.58,
    width: 5.62,
    depth: 1.24,
    drop: 0.44,
    palette: VERDIGRIS_PAL,
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // B. Tier 1 Left Cross-Gable Verdigris 3D Kawara Roof + Glowing Dormer Window (cx = -2.82)
  {
    const lgX = -2.82, lgZ = 0.25, lgY = 3.38, lgSpanX = 3.55, lgLenZ = 8.45, lgRise = 1.36;
    const halfX = lgSpanX * 0.5 + 0.42;
    const slopeL = Math.hypot(halfX, lgRise);
    const pitch = Math.atan2(lgRise, halfX);

    for (const sx of [-1, 1]) {
      addKawaraSlope({
        cx: lgX + sx * (halfX * 0.5),
        cy: lgY + lgRise * 0.5,
        cz: lgZ,
        width: lgLenZ,
        slopeLen: slopeL,
        pitch,
        rotY: sx > 0 ? PI * 0.5 : -PI * 0.5,
        P: roofG,
      });
      for (const sz of [-1, 1]) {
        addR(bx(slopeL + 0.14, 0.20, 0.12, bm.vermilion),
          lgX + sx * (halfX * 0.5), lgY + lgRise * 0.5, lgZ + sz * (lgLenZ * 0.5 + 0.02), 0, 0, -sx * pitch);
      }
    }
    addR(rb(0.28, 0.22, lgLenZ + 0.18, 0.05, bm.darkTimber), lgX, lgY + lgRise + 0.06, lgZ);
    addR(bx(0.14, 0.06, lgLenZ + 0.24, bm.goldTrim), lgX, lgY + lgRise + 0.18, lgZ);
    for (const sz of [-1, 1]) {
      const fz = lgZ + sz * (lgLenZ * 0.5 + 0.06);
      addR(rb(0.32, 0.40, 0.22, 0.05, bm.goldTrim), lgX, lgY + lgRise + 0.26, fz);
      addR(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bm.goldTrim), lgX, lgY + lgRise + 0.52, fz);
    }
    for (const [gz, isFront] of [[4.32, true], [-3.82, false]]) {
      const tri = new THREE.Shape();
      tri.moveTo(-halfX + 0.15, 0);
      tri.lineTo(halfX - 0.15, 0);
      tri.lineTo(0, lgRise - 0.04);
      tri.closePath();
      addR(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.14, bevelEnabled: false }), bm.cedar),
        lgX, lgY, gz - 0.07);
      if (isFront) {
        addCrispWindow(lgX, lgY + 0.52, gz + 0.10, 0, 1.36, 0.84, 4, 2, roofG);
        addR(bx(0.36, 0.30, 0.08, bm.goldTrim), lgX, lgY + lgRise - 0.22, gz + 0.12, 0, 0, PI * 0.25);
      }
    }
  }

  // Tier 1 Rear & Rear-Right Verdigris 3D Kawara Eave Skirts (kept clear of the spinning waterwheel!)
  addKawaraSlope({ cx: 4.68, cy: 3.46, cz: -2.65, width: 2.35, slopeLen: 0.95, pitch: 0.36, rotY: PI * 0.5, P: roofG });
  addKawaraSlope({ cx: 1.85, cy: 3.44, cz: -4.02, width: 5.55, slopeLen: 1.15, pitch: 0.38, rotY: PI, P: roofG });

  // C. Tier 2 Mid-Tier Timber Tower (x = -0.62, z = -0.52, y = 3.42..5.05) + Catwalk Balcony!
  const t2X = -0.62, t2Z = -0.52, t2W = 3.65, t2D = 3.24;
  addR(rb(t2W, 1.65, t2D, 0.04, bm.cedar), t2X, 4.22, t2Z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    addR(bx(0.16, 1.70, 0.16, bm.darkTimber), t2X + sx * (t2W * 0.48), 4.22, t2Z + sz * (t2D * 0.48));
  }
  addCrispWindow(t2X - 0.66, 4.32, t2Z + t2D * 0.5 + 0.04, 0, 1.06, 0.94, 3, 3, roofG);
  addCrispWindow(t2X + 0.66, 4.32, t2Z + t2D * 0.5 + 0.04, 0, 1.06, 0.94, 3, 3, roofG);
  addCrispWindow(t2X - t2W * 0.5 - 0.04, 4.32, t2Z, -PI * 0.5, 1.28, 0.92, 3, 2, roofG);

  // Wooden Railed Catwalk Balcony in front of Tier-2 windows
  const balX = -0.62, balY = 3.76, balZ = 1.52;
  addR(bx(1.94, 0.09, 0.86, bm.darkTimber), balX, balY, balZ);
  for (const bxOff of [-0.74, 0, 0.74]) {
    addR(bx(0.10, 0.16, 0.92, bm.darkTimber), balX + bxOff, balY - 0.11, balZ - 0.04);
  }
  for (let i = 0; i <= 6; i++) {
    addR(bx(0.052, 0.44, 0.052, bm.cedar), balX - 0.86 + (i / 6) * 1.72, balY + 0.24, balZ + 0.36);
  }
  addR(bx(1.90, 0.06, 0.07, bm.cedar), balX, balY + 0.46, balZ + 0.36);
  addR(bx(0.06, 0.06, 0.82, bm.cedar), balX - 0.86, balY + 0.46, balZ);
  addR(bx(0.06, 0.06, 0.82, bm.cedar), balX + 0.86, balY + 0.46, balZ);
  addR(rb(0.44, 0.32, 0.36, 0.025, bm.cedar), balX - 0.24, balY + 0.20, balZ + 0.02);
  addR(rb(0.34, 0.26, 0.30, 0.025, bm.cedar), balX + 0.24, balY + 0.17, balZ + 0.06);
  addR(rb(0.30, 0.22, 0.26, 0.02, bm.cedar), balX - 0.04, balY + 0.46, balZ - 0.02);

  buildKawaraGableRoof(THREE, K, {
    cx: t2X,
    cz: t2Z,
    yBase: 4.98,
    spanX: 3.88,
    spanZ: 3.34,
    rise: 0.88,
    overhangX: 0.66,
    overhangZ: 0.62,
    ridgeAlongX: true,
    palette: VERDIGRIS_PAL,
    timberMat: bm.cedar,
    finial: 'onigawara',
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // D. Tier 3 Top Glowing Lantern Cupola Tower (y = 5.60..7.65m)
  const t3X = -0.48, t3Z = -0.52, t3W = 2.16, t3D = 1.98;
  addR(rb(t3W, 1.06, t3D, 0.035, bm.cedar), t3X, 6.04, t3Z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    addR(bx(0.12, 1.10, 0.12, bm.darkTimber), t3X + sx * (t3W * 0.48), 6.04, t3Z + sz * (t3D * 0.48));
  }
  addCrispWindow(t3X, 6.08, t3Z + t3D * 0.5 + 0.03, 0, 1.50, 0.72, 4, 2, roofG);
  addCrispWindow(t3X, 6.08, t3Z - t3D * 0.5 - 0.03, PI, 1.50, 0.72, 4, 2, roofG);
  addCrispWindow(t3X + t3W * 0.5 + 0.03, 6.08, t3Z, PI * 0.5, 1.32, 0.72, 3, 2, roofG);
  addCrispWindow(t3X - t3W * 0.5 - 0.03, 6.08, t3Z, -PI * 0.5, 1.32, 0.72, 3, 2, roofG);

  // Glowing golden cupola lantern (reuses bm.shojiGlow + bm.darkTimber -> 0 extra draw calls!)
  const cupLantern = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), bm.shojiGlow);
  cupLantern.scale.set(1, 1.25, 1);
  addR(cupLantern, t3X, 6.06, t3Z + t3D * 0.5 + 0.20);
  addR(bx(0.16, 0.05, 0.16, bm.darkTimber), t3X, 6.30, t3Z + t3D * 0.5 + 0.20);
  addR(bx(0.16, 0.05, 0.16, bm.darkTimber), t3X, 5.82, t3Z + t3D * 0.5 + 0.20);

  buildKawaraGableRoof(THREE, K, {
    cx: t3X,
    cz: t3Z,
    yBase: 6.52,
    spanX: 2.26,
    spanZ: 2.08,
    rise: 0.74,
    overhangX: 0.52,
    overhangZ: 0.52,
    ridgeAlongX: true,
    palette: VERDIGRIS_PAL,
    timberMat: bm.cedar,
    finial: 'jewel',
    parent: roofG,
    batchPrefix: 'kawara',
  });

  // E. Exterior Riveted Copper Pressure Tank & Tangled Steam Pipes (x = 2.28, z = 0.16)
  const tkX = 2.28, tkZ = 0.16, tkR = 1.15;
  addR(new THREE.Mesh(new THREE.CylinderGeometry(tkR, tkR * 1.02, 0.88, 18), bm.copperWarm), tkX, 3.84, tkZ);
  addR(new THREE.Mesh(new THREE.SphereGeometry(tkR, 18, 11, 0, TAU, 0, PI * 0.52), bm.copperWarm), tkX, 4.26, tkZ);
  addR(new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.58, 0.42, 14), bm.copperWarm), tkX, 5.48, tkZ);
  addR(new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.045, 6, 16), bm.goldTrim), tkX, 5.30, tkZ, PI * 0.5, 0, 0);
  addR(new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.09, 14), bm.goldTrim), tkX, 5.68, tkZ);

  for (const by of [3.74, 4.26]) {
    addR(new THREE.Mesh(new THREE.TorusGeometry(tkR + 0.02, 0.04, 6, 20), bm.ironWarm), tkX, by, tkZ, PI * 0.5, 0, 0);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      pushInst('ext_rivet', rivetGeo, bm.goldTrim,
        tkX + Math.cos(a) * (tkR + 0.05), by, tkZ + Math.sin(a) * (tkR + 0.05),
        0, 0, 0, 1.1, 1.1, 1.1, 0xf4c44e, roofG);
    }
  }

  addSteamPipe([[tkX, 5.68, tkZ], [tkX, 6.08, tkZ], [1.30, 6.12, -0.20], [0.52, 6.06, -0.38]], 0.23, bm.copperWarm, bm.goldTrim, roofG, 3);
  addSteamPipe([[tkX - 0.45, 4.92, tkZ - 0.08], [1.20, 4.92, -0.15], [0.65, 4.90, -0.28]], 0.17, bm.copperWarm, bm.goldTrim, roofG, 2);
  addSteamPipe([[tkX - 0.85, 4.35, tkZ + 0.48], [1.02, 4.42, 0.82], [1.00, 3.42, 0.88]], 0.19, bm.copperWarm, bm.goldTrim, roofG, 2);
  addSteamPipe([[tkX + 0.55, 4.88, tkZ + 0.14], [3.42, 4.84, 0.28], [3.48, 3.44, 0.34]], 0.20, bm.copperWarm, bm.goldTrim, roofG, 3);
  addSteamPipe([[3.48, 4.72, -1.05], [4.12, 4.68, -0.85], [4.16, 3.44, -0.75]], 0.17, bm.copperWarm, bm.goldTrim, roofG, 2);
  addSteamPipe([[-1.45, 5.92, -0.52], [-1.88, 5.92, -0.52], [-1.90, 5.22, -0.52]], 0.12, bm.ironWarm, bm.goldTrim, roofG, 1);

  // F. Tall Tapered Banded Red-Brick Smokestack Chimney (x = 3.1, z = -1.8, rising to y = 8.18m!)
  const chX = 3.10, chZ = -1.80;
  for (let c = 0; c < 6; c++) {
    const f = c / 5;
    const cw = 1.44 - f * 0.38;
    const cy = 3.42 + c * 0.72 + 0.36;
    addR(rb(cw, 0.75, cw, 0.03, bm.warmBrick), chX, cy, chZ);
  }
  for (const [by, bw] of [[4.56, 1.38], [5.74, 1.26], [6.92, 1.14]]) {
    addR(bx(bw, 0.11, bw, bm.ironWarm), chX, by, chZ);
  }
  addR(rb(1.20, 0.15, 1.20, 0.025, bm.warmBrick), chX, 7.80, chZ);
  addR(rb(1.32, 0.17, 1.32, 0.025, bm.warmBrick), chX, 7.96, chZ);
  addR(rb(1.16, 0.14, 1.16, 0.02, bm.warmBrick), chX, 8.10, chZ);
  addR(bx(0.74, 0.08, 0.74, bm.ironWarm), chX, 8.15, chZ);

  const steamSpecs = [
    [0.00, 8.38, 0.00, 0.72],
    [0.18, 8.72, -0.06, 0.92],
    [0.42, 9.08, 0.08, 1.12],
    [0.72, 9.42, -0.05, 1.30],
    [1.08, 9.75, 0.10, 1.46],
    [1.48, 10.05, 0.04, 1.62],
  ];
  for (const [dx, sy, dz, sc] of steamSpecs) {
    pushInst('chim_steam', steamGeo, bm.steamWisps,
      chX + dx, sy, chZ + dz, 0, jr(0, TAU), 0, sc * 1.18, sc * 0.85, sc * 1.12, 0xf8fbff, roofG);
  }

  // ==========================================================================
  // 6. DOLLHOUSE CUTAWAY INTERIOR (int_03_boiler_tower.png — ALL y <= 3.24m!)
  // ==========================================================================
  // --- ROOM 1 (LEFT): THE RIVETED COPPER BOILER FURNACE (x in [-4.3, -0.3]) ---
  const bX = -2.42, bZ = -2.02, bR = 1.22;

  add(rb(2.58, 0.62, 2.38, 0.04, bm.mossStone), bX, 0.69, bZ + 0.12, 0, 0, 0, root);
  add(rb(1.68, 0.44, 0.56, 0.035, bm.stoneFloor), bX, 0.60, bZ + 1.26, 0, 0, 0, root);
  add(bx(0.84, 0.28, 0.22, bm.ironWarm), bX, 0.54, bZ + 1.46, 0, 0, 0, root);
  for (let i = 0; i < 9; i++) {
    pushInst('coal_all', coalGeo, bm.whiteInst,
      bX - 0.30 + i * 0.075, 0.48 + (i % 2) * 0.05, bZ + 1.48,
      jr(0, 3), jr(0, 3), 0, 0.72, 0.62, 0.72, 0xff6e24, root);
  }
  add(rb(0.84, 1.05, 0.88, 0.04, bm.mossStone), -3.86, 0.90, -1.42, 0, 0, 0, root);

  // Domed burnished Copper-Bronze Boiler Shell (bm.copperWarm, metalness: 0!)
  add(new THREE.Mesh(new THREE.CylinderGeometry(bR, bR * 1.04, 1.05, 20), bm.copperWarm),
    bX, 1.48, bZ, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.SphereGeometry(bR, 20, 12, 0, TAU, 0, PI * 0.52), bm.copperWarm),
    bX, 1.98, bZ, 0, 0, 0, root);

  add(new THREE.Mesh(new THREE.TorusGeometry(bR + 0.025, 0.042, 6, 20), bm.ironWarm),
    bX, 1.98, bZ, PI * 0.5, 0, 0, root);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.11, 7, 18, PI), bm.ironWarm),
    bX, 1.12, bZ + 1.08, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    add(rb(0.22, 0.42, 0.18, 0.025, bm.ironWarm), bX + sx * 0.92, 0.96, bZ + 1.08, 0, 0, 0, root);
  }
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * PI;
    pushInst('int_rivet', rivetGeo, bm.brassWarm,
      bX + Math.cos(a) * 0.92, 1.12 + Math.sin(a) * 0.92, bZ + 1.18,
      0, 0, 0, 1.05, 1.05, 1.05, 0xe2a83c, root);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    pushInst('int_rivet', rivetGeo, bm.brassWarm,
      bX + Math.cos(a) * (bR + 0.055), 1.98, bZ + Math.sin(a) * (bR + 0.055),
      0, 0, 0, 1.05, 1.05, 1.05, 0xe2a83c, root);
  }

  // Arched red-brick fire-mouth roaring with multi-layered glowing flames & coal embers!
  add(new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.085, 7, 16, PI), bm.warmBrick),
    bX, 1.10, bZ + 1.15, 0, 0, 0, root);
  add(bx(1.36, 0.88, 0.52, bm.ironWarm), bX, 1.24, bZ + 0.84, 0, 0, 0, root);

  for (const [dx, dy, dz, sx, sy, mat] of [
    // Deep crimson-orange outer flame tongues framing the top/back of the fire!
    [0.00, 1.52, 0.88, 0.46, 0.82, bm.vermilion],
    [-0.34, 1.36, 0.92, 0.26, 0.62, bm.vermilion],
    [0.34, 1.36, 0.92, 0.26, 0.62, bm.vermilion],
    // Glowing golden-orange mid-flames visibly layered in front of the crimson halo!
    [0.00, 1.34, 1.04, 0.42, 0.66, bm.fireGlow],
    [-0.24, 1.26, 1.06, 0.26, 0.52, bm.fireGlow],
    [0.24, 1.26, 1.06, 0.26, 0.52, bm.fireGlow],
    [-0.12, 1.30, 1.08, 0.22, 0.56, bm.fireGlow],
    [0.12, 1.30, 1.08, 0.22, 0.56, bm.fireGlow],
    // Bright yellow-gold inner flame tips right above the glowing coals!
    [0.00, 1.22, 1.14, 0.24, 0.44, bm.lanternGlow],
    [-0.15, 1.16, 1.16, 0.16, 0.34, bm.lanternGlow],
    [0.15, 1.16, 1.16, 0.16, 0.34, bm.lanternGlow],
  ]) {
    add(new THREE.Mesh(new THREE.ConeGeometry(sx, sy, 7), mat),
      bX + dx, dy, bZ + dz, jr(-0.08, 0.08), jr(0, TAU), jr(-0.14, 0.14), root);
  }
  const emberCols = [0xff4a12, 0xff7e1a, 0xd83214, 0x3e3746, 0x52485a];
  for (let c = 0; c < 34; c++) {
    const cx = bX + jr(-0.56, 0.56);
    const cz = bZ + 1.02 + jr(-0.06, 0.32);
    const cy = 0.90 + (1 - Math.abs(cx - bX) / 0.72) * 0.24 + jr(0, 0.10);
    pushInst('coal_all', coalGeo, bm.whiteInst,
      cx, cy, cz, jr(0, 3), jr(0, 3), 0, jr(0.85, 1.30), jr(0.75, 1.15), jr(0.85, 1.30),
      emberCols[c % emberCols.length], root);
  }

  // Round banded red-brick flue collar atop boiler dome (kept <= 3.24m in root, matches int_03!)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.50, 0.52, 14), bm.warmBrick), bX, 2.94, bZ - 0.04, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.52, 0.11, 14), bm.warmBrick), bX, 3.18, bZ - 0.04, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 12), bm.ironWarm), bX, 3.21, bZ - 0.04, 0, 0, 0, root);

  addSteamPipe([[bX - 0.78, 2.56, bZ], [-3.86, 2.58, -1.42], [-3.86, 1.40, -1.42]], 0.20, bm.copperWarm, bm.brassWarm, root, 3);
  addSteamPipe([[-1.38, 0.95, -2.88], [-1.38, 2.15, -2.88], [-1.38, 3.18, -2.88]], 0.24, bm.copperWarm, bm.brassWarm, root, 2);
  addSteamPipe([[-1.22, 3.08, -2.82], [-0.68, 2.98, -2.75], [-0.68, 1.85, -2.75], [-1.25, 1.82, -2.35]], 0.15, bm.copperWarm, bm.brassWarm, root, 3);
  addSteamPipe([[-1.28, 1.15, -1.55], [-0.72, 1.12, -1.55], [-0.72, 0.42, -1.55]], 0.14, bm.copperWarm, bm.brassWarm, root, 2);

  addRedValveWheel(-3.48, 1.86, -1.18, 0.35, 0.25, root);
  addRedValveWheel(-1.26, 2.34, -2.18, -0.25, 0.24, root);
  addPressureGauge(-0.98, 2.66, -2.42, -0.35, 0.19, root);
  addPressureGauge(-1.56, 2.22, -1.12, 0.22, 0.16, root);
  boxCol(-2.45, -2.04, 2.72, 2.56);

  // Slatted Wooden Coal Bin heaped with distinct charcoal-slate lumps + 2 Leaning Iron Shovels!
  const cbX = -3.65, cbZ = 0.45, cbW = 1.04, cbD = 0.88, cbH = 0.62;
  add(bx(cbW - 0.08, cbH - 0.08, cbD - 0.08, bm.ironWarm), cbX, 0.38 + cbH * 0.46, cbZ, 0, 0, 0, root);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(bx(0.075, cbH + 0.06, 0.075, bm.darkTimber), cbX + sx * (cbW * 0.48), 0.38 + cbH * 0.5, cbZ + sz * (cbD * 0.48), 0, 0, 0, root);
  }
  for (let s = 0; s < 4; s++) {
    const sy = 0.46 + s * 0.15;
    add(bx(cbW + 0.02, 0.09, 0.04, bm.cedar), cbX, sy, cbZ + cbD * 0.5, 0, 0, 0, root);
    add(bx(cbW + 0.02, 0.09, 0.04, bm.cedar), cbX, sy, cbZ - cbD * 0.5, 0, 0, 0, root);
    add(bx(0.04, 0.09, cbD + 0.02, bm.cedar), cbX + cbW * 0.5, sy, cbZ, 0, 0, 0, root);
  }
  const coalChunkCols = [0x4c4654, 0x5d5666, 0x3f3a47, 0x6a6274];
  for (let i = 0; i < 36; i++) {
    const lx = jr(-cbW * 0.40, cbW * 0.40);
    const lz = jr(-cbD * 0.38, cbD * 0.38);
    const mound = (1 - Math.hypot(lx, lz) / 0.65) * 0.28;
    pushInst('coal_all', coalGeo, bm.whiteInst,
      cbX + lx, 0.96 + Math.max(0, mound) + jr(0, 0.10), cbZ + lz,
      jr(0, 3), jr(0, 3), 0, jr(0.85, 1.32), jr(0.75, 1.15), jr(0.85, 1.32),
      pick(coalChunkCols), root);
  }
  for (const [szOff, tiltZ] of [[0.18, -0.22], [0.52, -0.19]]) {
    const shG = new THREE.Group();
    shG.position.set(-4.16, 0.38, szOff);
    shG.rotation.z = tiltZ;
    root.add(shG);
    add(rb(0.04, 0.32, 0.26, 0.015, bm.ironWarm), 0.04, 0.16, 0, 0, 0, 0.08, shG);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 1.18, 7), bm.hinoki), 0, 0.86, 0, 0, 0, 0, shG);
    add(bx(0.035, 0.035, 0.14, bm.darkTimber), 0, 1.46, 0, 0, 0, 0, shG);
  }
  boxCol(cbX, cbZ, cbW + 0.04, cbD + 0.04);
  addBrassPorchLantern(-4.15, 2.52, 0.65, 0.92, root);

  // --- ROOM 2 (RIGHT): 64-DRAWER HYAKUMI-DANSU & APOTHECARY TABLE (x in [0.0, 4.3]) ---
  const cabX = 2.16, cabZ = -3.22, cabW = 4.08, cabH = 2.80, cabD = 0.50;
  add(bx(cabW, cabH, 0.08, bm.darkTimber), cabX, 0.38 + cabH * 0.5, -3.43, 0, 0, 0, root);
  add(bx(cabW + 0.06, 0.08, cabD + 0.06, bm.darkTimber), cabX, 3.16, cabZ, 0, 0, 0, root);
  add(bx(2.98, 2.20, cabD - 0.04, bm.darkTimber), 1.65, 1.48, cabZ, 0, 0, 0, root);
  for (const divX of [0.16, 1.16, 2.16, 3.14, 4.16]) {
    add(bx(0.065, cabH, cabD, bm.darkTimber), divX, 0.38 + cabH * 0.5, cabZ, 0, 0, 0, root);
  }

  // 8 columns x 8 rows = 64 instanced cedar medicine drawers + 64 golden ring pulls!
  const drawerPal = [0xc8864b, 0xba783f, 0xd49458, 0xae6e38, 0xcf8e52];
  for (let r = 0; r < 8; r++) {
    const dy = 0.54 + r * 0.258;
    for (let c = 0; c < 8; c++) {
      const bayGap = Math.floor(c / 3) * 0.065;
      const dx = 0.36 + c * 0.342 + bayGap;
      pushInst('med_drawer', drawerGeo, bm.whiteInst,
        dx, dy, cabZ + cabD * 0.5 + 0.01,
        0, 0, 0, 1, 1, 1, pick(drawerPal), root);
      pushInst('med_pull', pullGeo, bm.goldTrim,
        dx, dy - 0.01, cabZ + cabD * 0.5 + 0.06,
        0.18, 0, 0, 1, 1, 1, 0xf4c44e, root);
    }
  }

  add(bx(2.98, 0.06, cabD, bm.cedar), 1.65, 2.60, cabZ, 0, 0, 0, root);
  for (const jx of [0.44, 0.84, 1.44, 1.86, 2.44, 2.86]) {
    const jrSc = jr(0.92, 1.12);
    const jarBody = new THREE.Mesh(new THREE.SphereGeometry(0.155 * jrSc, 12, 10), porcelainMat);
    jarBody.scale.set(1, 1.25, 1);
    add(jarBody, jx, 2.83, -3.14, 0, jr(0, TAU), 0, root);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08 * jrSc, 0.09 * jrSc, 0.06, 10), bm.goldTrim),
      jx, 3.04, -3.14, 0, 0, 0, root);
  }

  for (let s = 0; s < 4; s++) {
    const sy = 0.44 + s * 0.68;
    add(bx(0.96, 0.055, cabD, bm.cedar), 3.65, sy, cabZ, 0, 0, 0, root);
    for (let j = 0; j < 3; j++) {
      const jx = 3.34 + j * 0.31;
      if (s === 3) {
        const pj = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), porcelainMat);
        pj.scale.set(1, 1.28, 1);
        add(pj, jx, sy + 0.22, -3.14, 0, jr(0, TAU), 0, root);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.055, 10), bm.goldTrim),
          jx, sy + 0.42, -3.14, 0, 0, 0, root);
      } else {
        const jCol = herbJarColors[(s * 3 + j + 2) % herbJarColors.length];
        addGlassHerbJar(jx, sy + 0.03, -3.14, 1.05, 1.18, jCol, root);
      }
    }
  }
  boxCol(cabX, cabZ, cabW, 0.56);

  // 7 Lush Hanging Dried Purple Wisteria, Golden Chamomile & Green Herb Bundles overhead!
  add(bx(3.25, 0.05, 0.05, bm.darkTimber), 1.75, 3.20, -2.58, 0, 0, 0, root);
  addHerbBundle(0.42, 3.20, -2.58, 0.78, [0x9fd648, 0x7cb836, 0xb8e85c], root, false);
  addHerbBundle(0.88, 3.20, -2.58, 0.82, FOLIAGE_PAL, root, false);
  addHerbBundle(1.36, 3.20, -2.58, 0.90, WISTERIA_PAL, root, true);
  addHerbBundle(1.82, 3.20, -2.58, 0.74, [0x6ca844, 0x8cc458], root, false);
  addHerbBundle(2.26, 3.20, -2.58, 0.86, [0xf6d242, 0xe4b026, 0xffe875], root, false);
  addHerbBundle(2.70, 3.20, -2.58, 0.74, [0x92c44c, 0x6ea238], root, false);
  addHerbBundle(3.10, 3.20, -2.58, 0.78, [0xeab838, 0xd49c24], root, false);

  // 2. Apothecary Weighing Table (x = 2.75, z = 0.55 — leaving generous 1.8m aisle from center archway!)
  const tbX = 2.75, tbZ = 0.55, tbW = 1.92, tbD = 0.90, tbY = 1.18;
  add(rb(tbW + 0.08, 0.095, tbD + 0.08, 0.025, bm.cedar), tbX, tbY, tbZ, 0, 0, 0, root);
  add(bx(tbW - 0.12, 0.055, tbD - 0.14, bm.cedar), tbX, 0.50, tbZ, 0, 0, 0, root);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(bx(0.13, 0.78, 0.13, bm.darkTimber), tbX + sx * (tbW * 0.44), 0.77, tbZ + sz * (tbD * 0.40), 0, 0, 0, root);
  }

  add(bx(0.42, 0.018, tbD + 0.10, runnerMat), tbX - 0.52, tbY + 0.052, tbZ, 0, 0, 0, root);
  add(bx(0.42, 0.48, 0.022, runnerMat), tbX - 0.52, tbY - 0.20, tbZ + tbD * 0.5 + 0.045, 0, 0, 0, root);
  add(bx(0.42, 0.36, 0.022, runnerMat), tbX - 0.52, tbY - 0.14, tbZ - tbD * 0.5 - 0.045, 0, 0, 0, root);

  // Gleaming Golden Dual-Pan Balance Scale (bm.goldTrim, metalness: 0!)
  const scX = tbX - 0.08, scZ = tbZ - 0.02, scBaseY = tbY + 0.05;
  add(rb(0.46, 0.10, 0.30, 0.02, bm.darkTimber), scX, scBaseY + 0.05, scZ, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), bm.goldTrim), scX, scBaseY + 0.05, scZ + 0.16, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.08, 10), bm.goldTrim), scX, scBaseY + 0.14, scZ, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 0.58, 9), bm.goldTrim), scX, scBaseY + 0.46, scZ, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 8), bm.goldTrim), scX, scBaseY + 0.80, scZ, 0, 0, 0, root);
  add(bx(0.76, 0.032, 0.032, bm.goldTrim), scX, scBaseY + 0.68, scZ, 0, 0, 0, root);
  for (const sx of [-1, 1]) {
    const px = scX + sx * 0.35;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 5, 10), bm.goldTrim), px, scBaseY + 0.68, scZ, 0, 0, 0, root);
    for (const ca of [-0.9, 0.3, 1.5]) {
      beam([px, scBaseY + 0.66, scZ], [px + Math.cos(ca) * 0.13, scBaseY + 0.30, scZ + Math.sin(ca) * 0.13], 0.010, bm.goldTrim, root);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.09, 0.045, 12), bm.goldTrim), px, scBaseY + 0.28, scZ, 0, 0, 0, root);
  }

  // Ceramic Mortar & Pestle, Dish of Pink Blossoms, Glowing Table Lantern, Jar & Woven Baskets!
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.10, 0.16, 12), bm.hinoki),
    tbX + 0.46, scBaseY + 0.08, tbZ + 0.14, 0, 0, 0, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.26, 8), bm.warmInnerWall),
    tbX + 0.51, scBaseY + 0.18, tbZ + 0.14, 0, 0, -0.52, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.035, 10), bm.warmInnerWall),
    tbX + 0.20, scBaseY + 0.02, tbZ + 0.24, 0, 0, 0, root);
  pushInst('herb_floret', herbFloretGeo, bm.whiteInst, tbX + 0.20, scBaseY + 0.05, tbZ + 0.24, 0, 0, 0, 1.6, 0.55, 1.6, 0xf279b8, root);

  add(bx(0.17, 0.26, 0.17, bm.lanternGlow), tbX + 0.46, scBaseY + 0.14, tbZ - 0.22, 0, 0, 0, root);
  add(bx(0.20, 0.035, 0.20, bm.darkTimber), tbX + 0.46, scBaseY + 0.28, tbZ - 0.22, 0, 0, 0, root);
  addGlassHerbJar(tbX + 0.76, scBaseY, tbZ + 0.05, 1.08, 1.16, 0xe8a028, root);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.11, 10), bm.hinoki), tbX - 0.68, scBaseY + 0.06, tbZ - 0.08, 0, 0, 0, root);

  for (const [bxPos, herbCol] of [[tbX - 0.18, 0xd49a52], [tbX + 0.42, 0x86b848]]) {
    add(rb(0.48, 0.34, 0.50, 0.06, bm.hinoki), bxPos, 0.70, tbZ + 0.10, 0, 0, 0, root);
    for (let h = 0; h < 6; h++) {
      const ha = (h / 6) * TAU;
      pushInst('herb_floret', herbFloretGeo, bm.whiteInst,
        bxPos + Math.cos(ha) * 0.12, 0.90, tbZ + 0.10 + Math.sin(ha) * 0.12,
        jr(-0.4, 0.4), ha, 0, 1.35, 0.85, 1.35, herbCol, root);
    }
  }
  boxCol(tbX, tbZ, tbW, tbD);

  // ==========================================================================
  // 7. REQUIRED USERDATA: ROOMS, DOORS, 10 INDOOR PROP SLOTS & WATERWHEEL
  // ==========================================================================
  root.userData.footprint = { w: W, d: 8.3 };
  root.userData.rooms = [
    { name: 'boiler_furnace', x: -2.225, z: -0.05, w: 4.15, d: 6.90, walkX: -1.55, walkZ: 0.95 },
    { name: 'herb_apothecary', x: 2.075, z: -0.05, w: 4.45, d: 6.90, walkX: 1.00, walkZ: 0.55 },
  ];
  root.userData.door = { x: 0.25, z: 4.75 };
  root.userData.doorIn = { x: 0.25, z: 2.55 };
  root.userData.innerDoors = [{ x: -0.15, z: 0.35 }];

  root.userData.propSlots = [
    // Left Room: boiler_furnace (5 slots — tucked along front/side walls clear of furnace walk!)
    { id: 'bh_coal_scuttle', x: -2.55, y: 0.38, z: 2.58, rot: 0.25 },
    { id: 'bh_coal_scuttle', x: -3.52, y: 0.38, z: 0.88, rot: -0.40 },
    { id: 'bh_sake_cask', x: -3.52, y: 0.38, z: 1.82, rot: 0.35 },
    { id: 'bh_coal_scuttle', x: -3.48, y: 0.38, z: 2.66, rot: -0.55 },
    { id: 'bh_paper_lantern', x: -1.45, y: 0.38, z: 2.62, rot: 0.15 },
    // Right Room: herb_apothecary (5 slots)
    { id: 'bh_towel_basket', x: 0.85, y: 0.38, z: -2.12, rot: 0.30 },
    { id: 'bh_steamer_stack', x: 2.22, y: 0.38, z: -2.12, rot: -0.20 },
    { id: 'bh_bonsai_pot', x: 3.56, y: 0.38, z: -2.04, rot: 0.45 },
    { id: 'bh_towel_basket', x: 3.56, y: 0.38, z: 2.45, rot: -0.35 },
    { id: 'bh_sake_cask', x: 2.15, y: 0.38, z: 2.58, rot: 0.20 },
  ];

  root.userData.waterwheel = wheelGroup;
  root.userData.chimneyTop = { x: 3.1, y: 8.3, z: -1.8 };

  K.finalize([wheelGroup]);
  return root;
}
