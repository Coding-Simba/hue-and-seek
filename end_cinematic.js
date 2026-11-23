/* ==========================================================================
 * Hue & Seek — End-of-match cinematic (end_cinematic.js)
 *
 * Plays the moment a 5v5 series is decided, before the stats screen:
 *   VICTORY · "Hue Bloom"  — the camera swoops around your squad, light gathers in the plaza and bursts into
 *                            a rainbow paint explosion + shockwave + paint fireworks; your squad hops;
 *                            a gold VICTORY slams in letter by letter (rays, shine, score ribbon, fanfare).
 *   DEFEAT  · "Hue Drain"  — the world's colour drains to grey, grey paint drizzles down, slate DEFEAT letters
 *                            drop in heavy and crack; a low toll.
 *   DRAW                   — a two-colour burst, silver DRAW.
 * ~5.4 s, tap to skip after 1 s. Everything (3D, DOM, camera, sound cues) is driven from update(dt) on the
 * game clock — no CSS timers — so it pauses with the game and renders frame-exact in captures.
 * All meshes and materials are created and compiled up front, so the slam never hitches on a shader compile.
 * ========================================================================== */

const PALETTE = [0xff5d73, 0xffb13b, 0xffe14d, 0x5fd17a, 0x3fb8ff, 0xa879ff, 0xff7fd1];
const SLAM_T = 0.78;          // seconds from start to the title slam / burst
const HINT_T = 2.0;           // "tap to continue" appears
const AUTO_END_T = 5.4;       // hands over to the stats screen
const SKIP_AFTER_T = 1.0;     // taps before this are ignored (avoid skipping with the last gameplay tap)
const FADE_OUT_SEC = 0.35;
const FIREWORK_TIMES = [0.55, 1.15, 1.85];   // seconds after the slam (victory)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
// overshooting "slam": 0 -> 1 with a punchy settle
const slam = (t) => { t = clamp(t, 0, 1); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export function outcomeCopy(outcome, yourScore, rivalScore) {
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
  const score = `${fmt(yourScore)} – ${fmt(rivalScore)}`;
  if (outcome === 'victory') return { title: 'VICTORY', ribbon: `SERIES WON · ${score}` };
  if (outcome === 'draw') return { title: 'DRAW', ribbon: `SERIES TIED · ${score}` };
  return { title: 'DEFEAT', ribbon: `SERIES LOST · ${score}` };
}

export function createEndCinematic(env = {}) {
  const THREE = env.THREE;
  const scene = env.scene;
  const renderer = env.renderer;
  const hasDOM = typeof document !== 'undefined';
  let rng = Math.random;

  // ------------------------------------------------------------------ 3D rig (built once)
  const root = new THREE.Group();
  root.name = 'endCinematic';
  root.visible = false;
  scene.add(root);

  const glowTex = (() => {
    if (!hasDOM) return null;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.85)');
    gr.addColorStop(0.6, 'rgba(255,200,120,0.25)'); gr.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  const coreMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9a8, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false });
  const core = new THREE.Sprite(coreMat);
  core.renderOrder = 20;
  root.add(core);

  const ringGeo = new THREE.RingGeometry(0.86, 1.0, 96);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMats = [0xfff2b8, 0xff8fc6, 0x7fd8ff].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  const rings = ringMats.map((m) => { const r = new THREE.Mesh(ringGeo, m); r.renderOrder = 19; root.add(r); return r; });

  const beamGeo = new THREE.CylinderGeometry(0.55, 1.6, 26, 32, 1, true);
  beamGeo.translate(0, 13, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.renderOrder = 18;
  root.add(beam);

  // paint droplets (burst + fireworks), one instanced pool
  const MAX_DROPS = 520;
  const dropGeo = new THREE.IcosahedronGeometry(1, 1);
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const drops = new THREE.InstancedMesh(dropGeo, dropMat, MAX_DROPS);
  drops.frustumCulled = false;
  drops.count = 0;
  const _col = new THREE.Color();
  for (let i = 0; i < MAX_DROPS; i++) drops.setColorAt(i, _col.setHex(0xffffff));
  root.add(drops);
  const D = []; // { x,y,z, vx,vy,vz, s, born, life, landed, gy, drag, firework }

  // confetti ribbons (victory) / grey drizzle (defeat): thin quads
  const MAX_FLAKES = 320;
  const flakeGeo = new THREE.PlaneGeometry(1, 1);
  const flakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: false });
  const flakes = new THREE.InstancedMesh(flakeGeo, flakeMat, MAX_FLAKES);
  flakes.frustumCulled = false;
  flakes.count = 0;
  for (let i = 0; i < MAX_FLAKES; i++) flakes.setColorAt(i, _col.setHex(0xffffff));
  root.add(flakes);
  const F = []; // { x,y,z, vy, sway, spin, rx, ry, w, h, phase }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const _focus = new THREE.Vector3(), _camFrom = new THREE.Vector3(), _lookFrom = new THREE.Vector3(), _look = new THREE.Vector3(), _fwd = new THREE.Vector3();

  // Compile every material of the rig once, early, so nothing compiles at the slam.
  let compiled = false;
  function prewarm(camera) {
    if (compiled || !renderer || !camera) return;
    compiled = true;
    try {
      root.visible = true; drops.count = 1; flakes.count = 1;
      const p = typeof renderer.compileAsync === 'function' ? renderer.compileAsync(root, camera, scene) : (renderer.compile(root, camera, scene), Promise.resolve());
      Promise.resolve(p).catch(() => {}).finally(() => { if (!active) { root.visible = false; drops.count = 0; flakes.count = 0; } });
    } catch (_) { root.visible = false; }
  }

  // ------------------------------------------------------------------ DOM overlay
  let ui = null;
  function mountUI() {
    if (ui || !hasDOM) return ui;
    const app = document.getElementById('app') || document.body;
    const el = document.createElement('div');
    el.id = 'endCine';
    el.setAttribute('aria-live', 'assertive');
    el.innerHTML =
      '<div class="ec-shade"></div>' +
      '<div class="ec-rays"></div>' +
      '<div class="ec-flash"></div>' +
      '<div class="ec-stage">' +
        '<div class="ec-title" role="heading" aria-level="1"></div>' +
        '<svg class="ec-cracks" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">' +
          '<path d="M18 2 L22 11 L19 16 L24 24 L22 29" />' +
          '<path d="M47 0 L44 8 L49 14 L45 21 L48 30" />' +
          '<path d="M76 3 L80 10 L77 17 L82 25" />' +
        '</svg>' +
        '<div class="ec-ribbon"><span class="ec-ribbon-txt"></span></div>' +
        '<div class="ec-sub"></div>' +
      '</div>' +
      '<div class="ec-sparkles" aria-hidden="true"></div>' +
      '<div class="ec-hint">Tap to continue</div>';
    app.appendChild(el);
    const sparkleBox = el.querySelector('.ec-sparkles');
    const sparkles = [];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('i');
      s.textContent = '✦';
      sparkleBox.appendChild(s);
      sparkles.push({ el: s, x: 0, y: 0, d: 0, size: 1 });
    }
    el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); skip(); });
    ui = {
      el,
      shade: el.querySelector('.ec-shade'),
      rays: el.querySelector('.ec-rays'),
      flash: el.querySelector('.ec-flash'),
      stage: el.querySelector('.ec-stage'),
      title: el.querySelector('.ec-title'),
      cracks: [...el.querySelectorAll('.ec-cracks path')],
      ribbon: el.querySelector('.ec-ribbon'),
      ribbonTxt: el.querySelector('.ec-ribbon-txt'),
      sub: el.querySelector('.ec-sub'),
      hint: el.querySelector('.ec-hint'),
      sparkles,
      letters: [],
    };
    return ui;
  }

  // ------------------------------------------------------------------ state
  let active = false;
  let holding = false;       // after hand-over the camera keeps a slow orbit behind the stats screen
  let t = 0;
  let outcome = 'victory';
  let onDone = null;
  let finishing = -1;        // >=0 while fading out
  let slammed = false;
  let fireworksFired = 0;
  let nextHopT = 0;
  let shake = 0;
  let camAng0 = 0;
  let lite = false;
  let squad = [];
  let focusIsHero = false;
  let groundY = 0;

  function filterCanvas(css) {
    if (renderer && renderer.domElement) renderer.domElement.style.filter = css || '';
  }

  function resetPools() {
    D.length = 0; F.length = 0; drops.count = 0; flakes.count = 0;
    core.scale.setScalar(0.001); coreMat.opacity = 0;
    rings.forEach((r) => { r.scale.setScalar(0.001); r.material.opacity = 0; });
    beamMat.opacity = 0; beam.scale.set(1, 0.001, 1);
  }

  function spawnDrop(x, y, z, vx, vy, vz, size, color, life, opts = {}) {
    if (D.length >= MAX_DROPS) return;
    const i = D.length;
    D.push({ x, y, z, vx, vy, vz, s: size, born: t, life, landed: false, gy: opts.gy ?? groundY, drag: opts.drag ?? 0, grav: opts.grav ?? 14, firework: !!opts.firework });
    drops.setColorAt(i, _col.setHex(color));
    drops.count = D.length;
    drops.instanceColor.needsUpdate = true;
  }

  function paintBurst() {
    const n = lite ? 150 : 300;
    const cx = _focus.x, cz = _focus.z;
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const up = lerp(7, 16, Math.pow(rng(), 0.7));
      const out = lerp(1.5, 7.5, rng());
      const c = PALETTE[(rng() * PALETTE.length) | 0];
      spawnDrop(cx, groundY + 0.6, cz, Math.cos(a) * out, up, Math.sin(a) * out, lerp(0.06, 0.18, rng()), c, 4.6);
    }
  }

  function drawBurst() {
    const n = lite ? 90 : 180;
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const c = i % 2 ? 0x5fd17a : 0x3fb8ff;
      spawnDrop(_focus.x, groundY + 0.6, _focus.z, Math.cos(a) * lerp(1, 5, rng()), lerp(5, 11, rng()), Math.sin(a) * lerp(1, 5, rng()), lerp(0.08, 0.2, rng()), c, 4.2);
    }
  }

  function firework(k) {
    const n = lite ? 46 : 80;
    const ang = camAng0 + (k - 1) * 0.9;
    const ox = _focus.x + Math.sin(ang) * lerp(4, 9, rng());
    const oz = _focus.z + Math.cos(ang) * lerp(4, 9, rng());
    const oy = groundY + lerp(10, 14, rng());
    const c = PALETTE[(k * 2 + 1) % PALETTE.length];
    for (let i = 0; i < n; i++) {
      // even-ish sphere
      const u = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = lerp(4.5, 6.5, rng());
      spawnDrop(ox, oy, oz, r * Math.cos(th) * sp, u * sp, r * Math.sin(th) * sp, 0.075, i % 5 === 0 ? 0xffffff : c, 1.9, { grav: 2.4, drag: 1.4, firework: true, gy: -999 });
    }
  }

  function spawnConfetti() {
    const n = lite ? 110 : 220;
    for (let i = 0; i < n && F.length < MAX_FLAKES; i++) {
      const idx = F.length;
      F.push({ x: _focus.x + lerp(-9, 9, rng()), y: groundY + lerp(9, 16, rng()), z: _focus.z + lerp(-9, 9, rng()), vy: -lerp(1.6, 2.8, rng()), sway: lerp(0.6, 1.6, rng()), spin: lerp(3, 9, rng()), rx: rng() * 6, ry: rng() * 6, w: 0.11, h: 0.22, phase: rng() * 6, born: t });
      flakes.setColorAt(idx, _col.setHex(PALETTE[(rng() * PALETTE.length) | 0]));
    }
    flakes.count = F.length; flakes.instanceColor.needsUpdate = true;
    flakeMat.opacity = 1;
  }

  function spawnDrizzle(camera) {
    const n = lite ? 130 : 260;
    camera.getWorldDirection(_fwd);
    for (let i = 0; i < n && F.length < MAX_FLAKES; i++) {
      const idx = F.length;
      const d = lerp(2, 16, rng()), a = lerp(-1.1, 1.1, rng());
      const fx = _fwd.x * Math.cos(a) - _fwd.z * Math.sin(a), fz = _fwd.x * Math.sin(a) + _fwd.z * Math.cos(a);
      F.push({ x: camera.position.x + fx * d, y: groundY + lerp(0, 14, rng()), z: camera.position.z + fz * d, vy: -lerp(7, 11, rng()), sway: 0, spin: 0, rx: 0, ry: 0, w: 0.018, h: lerp(0.35, 0.6, rng()), phase: 0, born: t, rain: true });
      flakes.setColorAt(idx, _col.setHex(i % 3 ? 0xb9c4d0 : 0x8d99a8));
    }
    flakes.count = F.length; flakes.instanceColor.needsUpdate = true;
    flakeMat.opacity = 0;
  }

  // ------------------------------------------------------------------ title letters
  function buildTitle(text) {
    ui.title.textContent = '';
    ui.letters = [];
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', String(i));
      ui.title.appendChild(s);
      ui.letters.push({ el: s, rot: (rng() - 0.5) * (outcome === 'defeat' ? 6 : 14) });
    });
  }

  // ------------------------------------------------------------------ API
  function play(opts = {}) {
    stop(false);
    outcome = opts.outcome === 'victory' || opts.outcome === 'draw' ? opts.outcome : 'defeat';
    onDone = typeof opts.onDone === 'function' ? opts.onDone : null;
    lite = !!(env.isLite && env.isLite());
    squad = (typeof env.getSquad === 'function' ? env.getSquad(outcome) : []) || [];
    const camera = env.camera;
    // focus: the local player if they are still in the world, else the map's centre
    const hero = typeof env.getHero === 'function' ? env.getHero() : null;
    const centre = typeof env.getMapCenter === 'function' ? env.getMapCenter() : { x: 0, z: 0 };
    focusIsHero = !!(hero && hero.visible !== false && outcome !== 'draw');
    if (focusIsHero) _focus.set(hero.position.x, hero.position.y, hero.position.z);
    else _focus.set(centre.x || 0, 0, centre.z || 0);
    groundY = typeof env.groundHeightAt === 'function' ? env.groundHeightAt(_focus.x, _focus.z) : _focus.y;
    if (!focusIsHero) _focus.y = groundY;
    _camFrom.copy(camera.position);
    camera.getWorldDirection(_fwd);
    _lookFrom.copy(camera.position).addScaledVector(_fwd, 6);
    camAng0 = Math.atan2(camera.position.x - _focus.x, camera.position.z - _focus.z);

    t = 0; finishing = -1; slammed = false; fireworksFired = 0; nextHopT = SLAM_T + 0.15; shake = 0;
    resetPools();
    core.position.set(_focus.x, groundY + 1.2, _focus.z);
    rings.forEach((r) => r.position.set(_focus.x, groundY + 0.08, _focus.z));
    beam.position.set(_focus.x, groundY, _focus.z);
    root.visible = true;
    if (outcome === 'defeat') spawnDrizzle(camera);

    if (mountUI()) {
      const copy = outcomeCopy(outcome, opts.yourScore, opts.rivalScore);
      ui.el.className = `on is-${outcome}`;
      buildTitle(copy.title);
      ui.ribbonTxt.textContent = copy.ribbon;
      ui.sub.textContent = opts.mapTitle || '';
      ui.el.style.opacity = '1';
      const vw = window.innerWidth || 800, vh = window.innerHeight || 400;
      ui.sparkles.forEach((s, i) => {
        s.x = vw * (0.12 + 0.76 * rng()); s.y = vh * (0.14 + 0.5 * rng());
        s.d = SLAM_T + 0.1 + i * 0.12 + rng() * 0.3; s.size = lerp(0.7, 1.6, rng());
        s.el.style.left = `${s.x}px`; s.el.style.top = `${s.y}px`;
      });
    }
    if (hasDOM) document.body.classList.add('ec-active');
    env.audio?.endSting?.(outcome, SLAM_T);
    active = true;
    holding = false;
    return true;
  }

  function finishNow() {
    if (!active) return;
    active = false;
    holding = true;
    if (ui) { ui.el.className = ''; ui.el.style.opacity = '0'; }
    if (hasDOM) document.body.classList.remove('ec-active');
    if (outcome === 'defeat') filterCanvas('saturate(0.55) brightness(0.92)');
    else filterCanvas('');
    const cb = onDone; onDone = null;
    if (cb) { try { cb(); } catch (e) { console.error('[endCinematic] onDone', e); } }
  }

  function skip() {
    if (!active || t < SKIP_AFTER_T || finishing >= 0) return;
    finishing = 0;
  }

  function stop(callDone = false) {
    const cb = onDone;
    active = false; holding = false; onDone = null; finishing = -1;
    root.visible = false; resetPools();
    filterCanvas('');
    if (ui) { ui.el.className = ''; ui.el.style.opacity = '0'; }
    if (hasDOM) document.body.classList.remove('ec-active');
    if (callDone && cb) cb();
  }

  // ------------------------------------------------------------------ per frame
  function updateCamera(dt, camera) {
    // victory/draw: swoop from the gameplay view into an orbit that rises around the focus
    // defeat: a slow, low push-in that drifts downward
    const T = t;
    let r, h, ang, lookY;
    if (outcome === 'defeat') {
      r = lerp(9.5, 6.6, easeInOut(T / 5)); h = lerp(5.0, 3.6, easeInOut(T / 5));
      ang = camAng0 + 0.22 * easeInOut(T / 6) + (holding ? (T - AUTO_END_T) * 0.02 : 0);
      lookY = 0.9;
    } else {
      r = lerp(6.5, 13, easeInOut((T - 0.2) / 4.6)); h = lerp(2.0, 7.2, easeInOut((T - 0.3) / 4.4));
      ang = camAng0 + 1.25 * easeInOut(T / 5.6) + (holding ? (T - AUTO_END_T) * 0.035 : 0);
      lookY = lerp(1.1, 2.4, easeInOut((T - SLAM_T) / 2));
    }
    _p.set(_focus.x + Math.sin(ang) * r, groundY + h, _focus.z + Math.cos(ang) * r);
    _look.set(_focus.x, groundY + lookY, _focus.z);
    // blend in from the live gameplay camera over the first 0.9 s
    const b = active ? easeOut(T / 0.9) : 1;
    _p.lerpVectors(_camFrom, _p, b);
    _look.lerpVectors(_lookFrom, _look, b);
    if (shake > 0) {
      _p.x += (rng() - 0.5) * shake; _p.y += (rng() - 0.5) * shake * 0.6; _p.z += (rng() - 0.5) * shake;
    }
    camera.position.copy(_p);
    camera.lookAt(_look);
  }

  function update(dt, camera) {
    if (!active && !holding) return false;
    if (holding) {
      // keep the backdrop alive behind the stats screen until the match is left
      if (env.G && env.G.phase !== 'end') { stop(false); return false; }
      t += dt;
      updateCamera(dt, camera);
      stepParticles(dt, camera);
      return true;
    }
    if (env.G && env.G.phase !== 'end') { stop(false); return false; }   // left the match mid-cinematic
    t += dt;
    if (finishing >= 0) {
      finishing += dt;
      if (ui) ui.el.style.opacity = String(1 - clamp(finishing / FADE_OUT_SEC, 0, 1));
      if (finishing >= FADE_OUT_SEC) { finishNow(); return true; }
    } else if (t >= AUTO_END_T) {
      finishing = 0;
    }
    shake = Math.max(0, shake - dt * 1.6);

    // ---- build-up
    if (!slammed) {
      const k = clamp(t / SLAM_T, 0, 1);
      if (outcome !== 'defeat') {
        core.scale.setScalar(lerp(0.5, 3.4, k * k)); coreMat.opacity = 0.35 + 0.65 * k;
        beamMat.opacity = 0.55 * k; beam.scale.set(lerp(0.3, 1, k), k, lerp(0.3, 1, k));
      }
      if (t >= SLAM_T) {
        slammed = true;
        shake = outcome === 'defeat' ? 0.22 : 0.35;
        if (outcome === 'victory') { paintBurst(); spawnConfetti(); }
        else if (outcome === 'draw') drawBurst();
        env.haptics?.[outcome === 'victory' ? 'victory' : 'impact']?.(outcome === 'victory' ? undefined : 'heavy');
      }
    }
    // ---- after the slam
    if (slammed) {
      const s = t - SLAM_T;
      if (outcome !== 'defeat') {
        core.scale.setScalar(lerp(14, 2, easeOut(s / 0.7)) * (s < 0.7 ? 1 : 1 - clamp((s - 0.7) / 0.8, 0, 1)));
        coreMat.opacity = Math.max(0, 1 - s / 1.4);
        beamMat.opacity = Math.max(0, 0.55 * (1 - s / 0.9));
        rings.forEach((r, i) => {
          const rs = s - i * 0.12;
          if (rs < 0) { r.material.opacity = 0; return; }
          r.scale.setScalar(lerp(1, 26 - i * 4, easeOut(rs / 1.3)));
          r.material.opacity = Math.max(0, 0.9 * (1 - rs / 1.3));
        });
        if (outcome === 'victory') {
          while (fireworksFired < FIREWORK_TIMES.length && s >= FIREWORK_TIMES[fireworksFired]) { firework(fireworksFired); fireworksFired++; }
          if (t >= nextHopT && squad.length && env.hop) { const ch = squad[(rng() * squad.length) | 0]; env.hop(ch); nextHopT = t + lerp(0.18, 0.42, rng()); }
        }
      }
    }
    // ---- colour grade
    if (outcome === 'defeat') {
      const k = easeInOut(t / 1.4);
      filterCanvas(`saturate(${lerp(1, 0.18, k).toFixed(3)}) brightness(${lerp(1, 0.82, k).toFixed(3)}) contrast(${lerp(1, 1.06, k).toFixed(3)})`);
      flakeMat.opacity = 0.55 * k;
    } else if (outcome === 'victory') {
      const pulse = slammed ? Math.max(0, 1 - (t - SLAM_T) / 1.2) : 0;
      filterCanvas(`saturate(${(1.12 + 0.35 * pulse).toFixed(3)}) brightness(${(1 + 0.18 * pulse).toFixed(3)})`);
    }

    updateCamera(dt, camera);
    stepParticles(dt, camera);
    updateDOM();
    return true;
  }

  function stepParticles(dt, camera) {
    // droplets
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      const age = t - d.born;
      if (!d.landed) {
        if (d.drag) { const k = Math.exp(-d.drag * dt); d.vx *= k; d.vy *= k; d.vz *= k; }
        d.vy -= d.grav * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.y <= d.gy + 0.02 && d.vy < 0) { d.y = d.gy + 0.02; d.landed = true; d.landT = t; }
      }
      let sx = d.s, sy = d.s, sz = d.s;
      if (d.landed) { const k = clamp((t - d.landT) / 0.12, 0, 1); sx = sz = d.s * lerp(1, 2.2, k); sy = d.s * lerp(1, 0.18, k); }
      const fade = d.firework ? clamp(1 - age / d.life, 0, 1) : clamp((d.life - age) / 0.8, 0, 1);
      const sc = fade <= 0 ? 0 : 1;
      _m.compose(_p.set(d.x, d.y, d.z), _q.identity(), _s.set(sx * sc * (d.firework ? Math.max(0.2, fade) : 1), sy * sc, sz * sc * (d.firework ? Math.max(0.2, fade) : 1)));
      drops.setMatrixAt(i, _m);
    }
    if (D.length) drops.instanceMatrix.needsUpdate = true;
    // flakes
    for (let i = 0; i < F.length; i++) {
      const f = F[i];
      f.y += f.vy * dt;
      if (f.rain) {
        if (f.y < groundY) { f.y = groundY + 14; }
        _e.set(0, 0, 0);
      } else {
        f.x += Math.sin(t * f.sway + f.phase) * 0.6 * dt;
        f.rx += f.spin * dt; f.ry += f.spin * 0.7 * dt;
        if (f.y < groundY + 0.03) { f.y = groundY + 0.03; f.vy = 0; f.spin = 0; f.rx = Math.PI / 2; }
        _e.set(f.rx, f.ry, 0);
      }
      _q.setFromEuler(_e);
      _m.compose(_p.set(f.x, f.y, f.z), _q, _s.set(f.w, f.h, 1));
      flakes.setMatrixAt(i, _m);
    }
    if (F.length) flakes.instanceMatrix.needsUpdate = true;
  }

  function updateDOM() {
    if (!ui) return;
    const s = t - SLAM_T;
    // shade + rays
    ui.shade.style.opacity = String(clamp(t / 0.6, 0, 1));
    const raysK = outcome === 'defeat' ? 0 : clamp(s / 0.5, 0, 1);
    ui.rays.style.opacity = String(raysK * 0.95);
    ui.rays.style.transform = `translate(-50%, -50%) rotate(${(t * 9).toFixed(2)}deg) scale(${lerp(0.6, 1, easeOut(s / 0.8)).toFixed(3)})`;
    // flash at the slam
    ui.flash.style.opacity = String(s >= 0 ? Math.max(0, (outcome === 'defeat' ? 0.35 : 0.85) * (1 - s / 0.35)) : 0);
    // letters
    const n = ui.letters.length;
    ui.letters.forEach((L, i) => {
      const st = (s - i * 0.055) / 0.32;
      let op, tf;
      if (outcome === 'defeat') {
        const k = clamp((s - i * 0.07) / 0.42, 0, 1);
        const y = lerp(-1.4, 0, k * k) * 60;
        const bounce = k >= 1 ? Math.max(0, Math.sin(clamp((s - i * 0.07 - 0.42) / 0.25, 0, 1) * Math.PI)) * -6 : 0;
        const sag = i === n - 1 ? 9 * easeOut((s - 1.2) / 0.5) : 0;
        op = clamp(k * 3, 0, 1);
        tf = `translateY(${(y + bounce).toFixed(2)}px) rotate(${(L.rot * (1 - k) + sag).toFixed(2)}deg)`;
      } else {
        const k = slam(st);
        const sc = st <= 0 ? 2.6 : lerp(2.6, 1, k);
        op = clamp(st * 4, 0, 1);
        const float = Math.sin(t * 2.2 + i * 0.6) * 2.5 * clamp(s - 1, 0, 1);
        tf = `translateY(${float.toFixed(2)}px) scale(${sc.toFixed(3)}) rotate(${(L.rot * (1 - clamp(st, 0, 1))).toFixed(2)}deg)`;
      }
      L.el.style.opacity = op.toFixed(3);
      L.el.style.transform = tf;
    });
    // shine sweep across the title (victory/draw)
    if (outcome !== 'defeat') ui.title.style.setProperty('--shine', `${lerp(130, -30, clamp((s - 0.5) / 1.1, 0, 1)).toFixed(1)}%`);
    // stage shake
    if (shake > 0.01) ui.stage.style.transform = `translate(${((rng() - 0.5) * shake * 26).toFixed(1)}px, ${((rng() - 0.5) * shake * 18).toFixed(1)}px)`;
    else ui.stage.style.transform = '';
    // cracks (defeat)
    ui.cracks.forEach((p, i) => { p.style.strokeDashoffset = String(lerp(40, 0, easeOut((s - 0.55 - i * 0.12) / 0.45))); });
    // ribbon + subtitle
    const rk = easeOut((s - 0.55) / 0.45);
    ui.ribbon.style.opacity = String(clamp((s - 0.55) / 0.2, 0, 1));
    ui.ribbon.style.transform = `scaleX(${lerp(0.2, 1, rk).toFixed(3)})`;
    ui.sub.style.opacity = String(clamp((s - 0.9) / 0.3, 0, 1) * 0.9);
    // sparkles
    ui.sparkles.forEach((sp) => {
      const a = t - sp.d;
      const vis = outcome === 'defeat' ? 0 : (a < 0 ? 0 : Math.max(0, Math.sin(clamp(a / 0.9, 0, 1) * Math.PI)));
      sp.el.style.opacity = vis.toFixed(3);
      sp.el.style.transform = `translate(-50%, -50%) scale(${(sp.size * (0.4 + vis)).toFixed(3)}) rotate(${(a * 90).toFixed(1)}deg)`;
      if (a > 1.6) { sp.d = t + 0.2 + rng() * 0.8; }
    });
    // hint
    ui.hint.style.opacity = String(clamp((t - HINT_T) / 0.4, 0, 1) * (0.65 + 0.35 * Math.sin(t * 4)));
  }

  return {
    mountUI,
    prewarm,
    play,
    skip,
    stop,
    update,
    isActive: () => active,
    isControllingCamera: () => active || holding,
    _setRng: (f) => { rng = f; },
  };
}
