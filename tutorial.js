/* ==========================================================================
 * Hue & Seek — Interactive First-Time Hider & Seeker Tutorial Manager
 * (`tutorial.js`)
 *
 * Ensures first-time Hiders and first-time Seekers NEVER get dropped straight
 * into the 5v5 online queue without knowing how to play:
 *   • Independent completion flags:
 *       - `hs_tutorial_hide_done_v1` (Solo Spirit Hider Dojo — 8 guided steps)
 *       - `hs_tutorial_seek_done_v1` (Solo Hunter Seeker Dojo — 5 guided steps)
 *   • Dedicated solo Storybook sanctuary (`maps/tutorial/map.js`) with
 *     zero enemy bots, zero round-loss timer, and zero chaos interruptions.
 *   • Self-explanatory looping CSS/SVG animations for every single control
 *     (camera turn, move stick / WASD, jump/vault, prop morphing, prop rotate
 *     & undo, decoy clone, sakura smoke dash, whistle & secret tub spot,
 *     water blaster spray, echo pulse radar, and 3.5m AoE splash bomb),
 *     adapting automatically between Mobile Touch and Desktop Mouse/Keyboard!
 * ========================================================================== */

const STORAGE_HIDE = 'hs_tutorial_hide_done_v1';
const STORAGE_SEEK = 'hs_tutorial_seek_done_v1';
const STORAGE_REWARD_HIDE = 'hs_tutorial_hide_reward_v1';
const STORAGE_REWARD_SEEK = 'hs_tutorial_seek_reward_v1';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function safeGetStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeSetStorage(key, val) {
  try {
    window.localStorage.setItem(key, val);
  } catch (_) {
    // Ignore private-browsing quota errors
  }
}

function normDeltaAngle(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ============================================================================
// Bespoke Looping Visual Control Animations (Touch & PC Variants)
// ============================================================================
function buildControlAnimationHTML(animId, isTouchMode) {
  switch (animId) {
    case 'look':
    case 'look_seek': {
      const seekCross = animId === 'look_seek' ? '<div class="ta-crosshair-mini"></div>' : '';
      if (isTouchMode) {
        return `
          <div class="ta-scene">
            <div class="ta-phone">
              <div class="ta-fov-cone"></div>
              ${seekCross}
              <div class="ta-phone-right"></div>
              <span class="ta-arrows-lr">↔</span>
              <span class="ta-finger-swipe">👆</span>
            </div>
            <span class="ta-caption">Swipe Right Side ↔</span>
          </div>`;
      }
      return `
        <div class="ta-scene">
          <div class="ta-mouse-pad">
            <div class="ta-fov-cone" style="left:12px;top:12px;"></div>
            <div class="ta-mouse-ico"></div>
          </div>
          <span class="ta-caption">Move Mouse ↔</span>
        </div>`;
    }

    case 'move':
    case 'move_jump': {
      const jumpHint = animId === 'move_jump';
      if (isTouchMode) {
        return `
          <div class="ta-scene">
            <div class="ta-joy-ring">
              <div class="ta-joy-knob"></div>
            </div>
            ${jumpHint ? '<span class="ta-jump-pill" style="position:static;margin-left:8px;margin-bottom:12px;">+ 🦘</span>' : ''}
            <span class="ta-caption">${jumpHint ? 'Left Stick + Jump' : 'Drag Left Stick'}</span>
          </div>`;
      }
      return `
        <div class="ta-scene">
          <div class="ta-wasd">
            <div class="ta-key-row"><span class="ta-key lit-1">W</span></div>
            <div class="ta-key-row">
              <span class="ta-key lit-2">A</span>
              <span class="ta-key lit-3">S</span>
              <span class="ta-key lit-4">D</span>
            </div>
          </div>
          <span class="ta-caption">${jumpHint ? 'WASD + SPACE' : 'Press W A S D'}</span>
        </div>`;
    }

    case 'jump':
      return `
        <div class="ta-scene">
          <div class="ta-jump-lane">
            <div class="ta-arc-dots"></div>
            <div class="ta-bench"></div>
            <span class="ta-jumper">🌱</span>
            <span class="ta-jump-pill">${isTouchMode ? '🦘 JUMP' : 'SPACE'}</span>
          </div>
          <span class="ta-caption">Vault Over Furniture</span>
        </div>`;

    case 'morph':
      return `
        <div class="ta-scene">
          <div class="ta-morph-wrap">
            <span class="ta-morph-spirit">🌱</span>
            <span class="ta-morph-poof">✨</span>
            <span class="ta-morph-prop">🛢️</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Tap Prop Chip / 🎭' : 'Press F or 1 · 2 · 3'}</span>
        </div>`;

    case 'rotate':
      return `
        <div class="ta-scene">
          <div class="ta-rot-wrap">
            <div class="ta-rot-box">🛢️</div>
            <span style="font-size:20px;">🔄</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Tap 🔄 Rotate (↩️ Undo)' : 'Q / E Rotate · R Undo'}</span>
        </div>`;

    case 'decoy':
      return `
        <div class="ta-scene">
          <div class="ta-decoy-wrap">
            <span class="ta-decoy-real">🛢️</span>
            <span class="ta-decoy-clone">🛢️</span>
            <span class="ta-decoy-bubbles">🫧</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Tap 🪞 Decoy Clone' : 'Press C · Decoy Clone'}</span>
        </div>`;

    case 'dash':
      return `
        <div class="ta-scene">
          <div class="ta-dash-wrap">
            <span class="ta-dash-cloud">🌸</span>
            <span class="ta-dash-runner">💨</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Tap 🌸 Smoke Dash' : 'Press X · Smoke Dash'}</span>
        </div>`;

    case 'whistle':
      return `
        <div class="ta-scene">
          <div class="ta-whistle-wrap">
            <span class="ta-notes">🎵✨</span>
            <span class="ta-tub-duck">♨️🦆</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Tap 🎵 Whistle or ♨️ Tub' : 'Press T Whistle or G Tub'}</span>
        </div>`;

    case 'spray':
      return `
        <div class="ta-scene">
          <div class="ta-spray-wrap">
            <span class="ta-spray-gun">🔫</span>
            <div class="ta-spray-stream"></div>
            <span class="ta-spray-target">🛢️</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Hold 💦 + Slide to Aim' : 'Hold Left-Click 💦'}</span>
        </div>`;

    case 'pulse':
      return `
        <div class="ta-scene">
          <div class="ta-pulse-wrap">
            <div class="ta-pulse-ring"></div>
            <div class="ta-pulse-ring r2"></div>
            <span style="font-size:20px;z-index:1;">📡</span>
            <span class="ta-pulse-ping">🔥 HOT!</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Tap 📡 Echo Pulse' : 'Press Q · Echo Pulse'}</span>
        </div>`;

    case 'bomb':
      return `
        <div class="ta-scene">
          <div class="ta-bomb-wrap">
            <div class="ta-bomb-zone"></div>
            <span class="ta-bomb-ball">💣</span>
            <span class="ta-bomb-burst">💦</span>
          </div>
          <span class="ta-caption">${isTouchMode ? 'Tap 💣 3.5m Splash' : 'Press E · 3.5m Splash'}</span>
        </div>`;

    default:
      return `<div class="ta-scene"><span style="font-size:28px;">✨</span></div>`;
  }
}

// ============================================================================
// Step Curricula: 60-Second "First Escape" (4 Hider Beats) & "First Bust" (3 Seeker Beats)
// ============================================================================
const HIDER_STEPS = [
  {
    id: 'morph',
    anim: 'morph',
    title: 'Hide Fast! Morph Into a Prop',
    touchDesc: 'Drag the <b>left stick</b> toward the barrels (or aim at one up to 8m away) and tap a <b>Prop Chip</b> or <b>🎭 Morph</b>!',
    pcDesc: 'Walk toward the barrels (<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>) or aim right at one, then press <kbd>F</kbd> or <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> to morph!',
    waypoint: { x: 4.2, z: 1.8, radius: 1.85 },
    spotLabel: '👆 Morph Into a Prop!',
  },
  {
    id: 'evade',
    anim: 'rotate',
    title: 'Seeker Incoming! Hold Still!',
    touchDesc: 'A Seeker is sweeping the yard! Stay disguised &amp; tap <b>🔒 Lock</b> (or hold still) while they walk right past you!',
    pcDesc: 'A Seeker is sweeping the yard! Stay disguised &amp; press <kbd>L</kbd> to Lock your spot while they walk right past you!',
    waypoint: null,
    anyTarget: '#btnPosLock',
    spotLabel: '🔒 Lock & Hold Still!',
  },
  {
    id: 'escape',
    anim: 'dash',
    title: 'Pull a Trick Escape!',
    touchDesc: 'Tap <b>🪞 Decoy</b> to leave a fake twin behind — OR tap <b>🌸 Dash</b> to burst away in sakura smoke!',
    pcDesc: 'Press <kbd>C</kbd> for a <b>🪞 Decoy Clone</b> — OR press <kbd>X</kbd> to burst away in <b>🌸 Sakura Smoke</b>!',
    waypoint: null,
    anyTarget: '#btnTrickSmoke',
    spotLabel: '👆 Pop a Trick!',
  },
  {
    id: 'whistle',
    anim: 'whistle',
    title: 'Taunt or Use a Secret Spot!',
    touchDesc: 'Tap <b>🎵 Whistle</b> (earns 3× tokens near Seekers!) — OR hop into the <b>♨️ Cedar Tub</b> ahead to graduate!',
    pcDesc: 'Press <kbd>T</kbd> to <b>🎵 Whistle</b> — OR walk to the <b>♨️ Cedar Tub</b> and press <kbd>G</kbd> to graduate!',
    waypoint: { x: -5.2, z: -3.2, radius: 1.65 },
    anyTarget: '#btnTrickTaunt',
    spotLabel: '👆 Try It!',
  },
];

const SEEKER_STEPS = [
  {
    id: 'spray',
    anim: 'spray',
    title: 'Aim & Soak the Fake Barrel!',
    touchDesc: 'Drag the left stick to move, swipe right to aim at the glowing barrel 🎯, and <b>HOLD 💦 SPLASH</b> to bust the Spirit!',
    pcDesc: 'Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, aim at the glowing barrel 🎯, and <b>HOLD Left-Click</b> to bust the Spirit!',
    waypoint: { x: 2.6, z: -0.4, radius: 1.25 },
    touchTarget: '#btnFire',
    spotLabel: '👆 Hold to Spray!',
  },
  {
    id: 'pulse',
    anim: 'pulse',
    title: 'Scan Walls with Echo Pulse!',
    touchDesc: 'A Spirit is hiding inside the Pavilion ahead! Tap <b>📡 Pulse</b> to send a 16m radar wave (Cold → Warm → 🔥 HOT!).',
    pcDesc: 'A Spirit is hiding inside the Pavilion ahead! Press <kbd>Q</kbd> (or click <b>📡 Pulse</b>) to scan through walls!',
    waypoint: { x: 0, z: -3.2, radius: 1.5 },
    anyTarget: '#btnGadgetPulse',
    spotLabel: '👆 Scan Nearby!',
  },
  {
    id: 'bomb',
    anim: 'bomb',
    title: 'Throw a 3.5m Splash Bomb!',
    touchDesc: 'Aim at the glowing target cluster 🎯 and tap <b>💣 Bomb</b>! Pops decoys &amp; soaks Spirits in a 3.5m splash with <b>zero miss penalty</b>!',
    pcDesc: 'Aim at the glowing target cluster 🎯 and press <kbd>E</kbd>! Lobs a 3.5m water-balloon burst that pops decoys &amp; soaks groups with <b>zero penalty</b>!',
    waypoint: { x: -2.2, z: -1.9, radius: 2.3 },
    anyTarget: '#btnGadgetBomb',
    spotLabel: '👆 Throw Bomb!',
  },
];

// ============================================================================
// Factory: `createTutorialManager(env)`
// ============================================================================
export function createTutorialManager(env = {}) {
  const { THREE } = env;

  let mounted = false;
  let active = false;
  let activeMode = 'hide'; // 'hide' | 'seek'
  let launchSource = 'play_gate'; // 'play_gate' | 'manual_replay'
  let savedMapId = 'meadow';

  let stepIdx = 0;
  let stepAdvancing = false;
  let stepAdvanceTimer = 0;
  let stepEnteredNow = 0;

  // Per-step live progress trackers
  let lastYaw = 0;
  let accumYaw = 0;
  let startPos = { x: 0, z: 0 };
  let maxWalkDist = 0;
  let jumpedInStep = false;
  let startPropRotY = null;
  let practiceDummy = null;
  let practiceSeeker = null;
  let evadeHoldSec = 0;
  let patrolPhase = 0;
  let bombThrowsInStep = 0;
  let sawBombInFlight = false;
  let dummySoakedFlag = false;

  // Input-style auto-detection ('touch' vs 'pc')
  let inputStyle = detectInitialInputStyle();
  let manualInputOverride = false;

  // DOM Elements
  let coachEl = null;
  let animStageEl = null;
  let stepPillEl = null;
  let inputPillEl = null;
  let skipBtnEl = null;
  let titleEl = null;
  let descEl = null;
  let lockNudgeEl = null;
  let progFillEl = null;
  let progLblEl = null;
  let spotlightEl = null;
  let spotTagEl = null;
  let gradModalEl = null;
  let pickerModalEl = null;

  // 3D Waypoint Group in `env.scene`
  let waypointGrp = null;
  let wpOuterRing = null;
  let wpInnerDisc = null;
  let wpBeacon = null;
  let wpPillar = null;

  function detectInitialInputStyle() {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('is-mobile-touch')) {
      return 'touch';
    }
    if (typeof window !== 'undefined') {
      if (window.__FORCE_MOBILE_HUD === true || window.Capacitor) return 'touch';
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return 'touch';
    }
    return env.isTouch ? 'touch' : 'pc';
  }

  function isRoleDone(mode) {
    const key = mode === 'seek' ? STORAGE_SEEK : STORAGE_HIDE;
    return safeGetStorage(key) === '1';
  }

  function markRoleDone(mode) {
    const key = mode === 'seek' ? STORAGE_SEEK : STORAGE_HIDE;
    safeSetStorage(key, '1');
    syncLobbyBadges();
  }

  function shouldRunFirstTime(mode) {
    return !isRoleDone(mode === 'seek' ? 'seek' : 'hide');
  }

  function getStepsForMode(mode = activeMode) {
    return mode === 'seek' ? SEEKER_STEPS : HIDER_STEPS;
  }

  function ensureWaypoint3D() {
    if (!THREE || !env.scene) return null;
    if (waypointGrp) return waypointGrp;

    waypointGrp = new THREE.Group();
    waypointGrp.name = 'tutorial_waypoint_3d';
    waypointGrp.visible = false;

    const ringGeo = new THREE.RingGeometry(0.84, 1.0, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcf40,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    wpOuterRing = new THREE.Mesh(ringGeo, ringMat);
    wpOuterRing.position.y = 0.045;
    waypointGrp.add(wpOuterRing);

    const discGeo = new THREE.CircleGeometry(0.84, 40);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xffe885,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    wpInnerDisc = new THREE.Mesh(discGeo, discMat);
    wpInnerDisc.position.y = 0.038;
    waypointGrp.add(wpInnerDisc);

    const pillarGeo = new THREE.CylinderGeometry(0.55, 0.82, 2.2, 24, 1, true);
    pillarGeo.translate(0, 1.1, 0);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffe270,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    wpPillar = new THREE.Mesh(pillarGeo, pillarMat);
    waypointGrp.add(wpPillar);

    // Floating golden diamond beacon above the ring (`metalness: 0`!)
    const beaconGeo = new THREE.OctahedronGeometry(0.28, 0);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffdf5d,
      emissive: 0xffa726,
      emissiveIntensity: 0.85,
      roughness: 0.45,
      metalness: 0,
    });
    wpBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    wpBeacon.position.y = 2.05;
    waypointGrp.add(wpBeacon);

    env.scene.add(waypointGrp);
    return waypointGrp;
  }

  function syncLobbyBadges() {
    if (typeof document === 'undefined') return;
    const hideFirst = !isRoleDone('hide');
    const seekFirst = !isRoleDone('seek');

    // Desktop Title Screen `#btnHide` / `#btnSeek` first-time pill
    const syncDesktopBtn = (btnId, isFirst) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      let pill = btn.querySelector('.tut-first-pill');
      if (isFirst) {
        if (!pill) {
          pill = document.createElement('span');
          pill.className = 'tut-first-pill';
          pill.textContent = '🎓 Solo Training First';
          btn.appendChild(pill);
        }
      } else if (pill) {
        pill.remove();
      }
    };
    syncDesktopBtn('btnHide', hideFirst);
    syncDesktopBtn('btnSeek', seekFirst);

    // Mobile Lobby `#mobPlayHideBtn` / `#mobPlaySeekBtn` sub-caption
    const mobHideSub = document.querySelector('#mobPlayHideBtn .mob-play-sub');
    if (mobHideSub) {
      mobHideSub.textContent = hideFirst ? '🎓 Solo Dojo First' : '5v5 · Spirits';
    }
    const mobSeekSub = document.querySelector('#mobPlaySeekBtn .mob-play-sub');
    if (mobSeekSub) {
      mobSeekSub.textContent = seekFirst ? '🎓 Solo Dojo First' : '5v5 · Hunters';
    }

    // Picker modal status badges if mounted
    const pHideSt = document.getElementById('tutPickHideStatus');
    if (pHideSt) {
      pHideSt.textContent = hideFirst ? '✨ First Play' : '✓ Mastered';
      pHideSt.classList.toggle('done', !hideFirst);
    }
    const pSeekSt = document.getElementById('tutPickSeekStatus');
    if (pSeekSt) {
      pSeekSt.textContent = seekFirst ? '✨ First Play' : '✓ Mastered';
      pSeekSt.classList.toggle('done', !seekFirst);
    }
  }

  function mountUI() {
    if (mounted || typeof document === 'undefined') return;
    const appEl = document.getElementById('app') || document.body;
    if (!appEl) return;
    mounted = true;

    // 1. Floating Top-Center Coach Card
    coachEl = document.createElement('section');
    coachEl.id = 'tutCoach';
    coachEl.className = 'hidden';
    coachEl.setAttribute('aria-live', 'polite');
    coachEl.innerHTML = `
      <div class="tut-anim-stage" id="tutAnimStage"></div>
      <div class="tut-body">
        <div class="tut-top-row">
          <span class="tut-step-pill" id="tutStepPill">STEP 1 / 8 · SPIRIT DOJO</span>
          <div class="tut-ctrl-actions">
            <button type="button" class="tut-input-pill" id="tutInputPill" title="Switch Touch / PC guide">📱 Touch</button>
            <button type="button" class="tut-skip-btn" id="tutSkipBtn">Skip ⏭</button>
          </div>
        </div>
        <h3 class="tut-title" id="tutTitle">Turn the Camera</h3>
        <p class="tut-desc" id="tutDesc"></p>
        <div class="tut-lock-nudge hidden" id="tutLockNudge">🖱️ Click anywhere on the 3D scene (or drag) to turn!</div>
        <div class="tut-prog-row">
          <div class="tut-prog-track"><i class="tut-prog-fill" id="tutProgFill"></i></div>
          <span class="tut-prog-lbl" id="tutProgLbl">0%</span>
        </div>
      </div>
    `;
    appEl.appendChild(coachEl);

    animStageEl = coachEl.querySelector('#tutAnimStage');
    stepPillEl = coachEl.querySelector('#tutStepPill');
    inputPillEl = coachEl.querySelector('#tutInputPill');
    skipBtnEl = coachEl.querySelector('#tutSkipBtn');
    titleEl = coachEl.querySelector('#tutTitle');
    descEl = coachEl.querySelector('#tutDesc');
    lockNudgeEl = coachEl.querySelector('#tutLockNudge');
    progFillEl = coachEl.querySelector('#tutProgFill');
    progLblEl = coachEl.querySelector('#tutProgLbl');

    // 2. Live On-Screen Button Spotlight Ring
    spotlightEl = document.createElement('div');
    spotlightEl.id = 'tutSpotlight';
    spotlightEl.className = 'hidden';
    spotlightEl.innerHTML = `<span class="tut-spot-tag" id="tutSpotTag">👆 Tap!</span>`;
    appEl.appendChild(spotlightEl);
    spotTagEl = spotlightEl.querySelector('#tutSpotTag');

    // 3. Celebratory Graduation Modal
    gradModalEl = document.createElement('div');
    gradModalEl.id = 'tutGradModal';
    gradModalEl.className = 'tut-modal-backdrop hidden';
    gradModalEl.setAttribute('role', 'dialog');
    gradModalEl.setAttribute('aria-modal', 'true');
    gradModalEl.innerHTML = `
      <div class="tut-modal-card">
        <span class="tut-grad-badge" id="tutGradKicker">✨ DOJO GRADUATE ✨</span>
        <div class="tut-grad-emoji" id="tutGradEmoji">🎓</div>
        <h2 id="tutGradTitle">Spirit Training Complete!</h2>
        <p class="tut-modal-sub" id="tutGradSub">You mastered every Spirit move — you're ready for real 5v5 matches!</p>
        <div class="tut-reward-pill" id="tutGradReward">🪙 +30 Spirit Tokens Earned!</div>
        <div class="tut-skills-chips" id="tutGradSkills"></div>
        <div class="tut-cta-col">
          <button type="button" class="tut-btn-primary" id="btnTutPlayQueue">🎭 Play 5v5 Hide Now! ▶</button>
          <button type="button" class="tut-btn-secondary" id="btnTutOtherRole">💦 Learn Seeker Controls Next</button>
          <button type="button" class="tut-btn-link" id="btnTutBackLobby">Back to Lobby</button>
        </div>
      </div>
    `;
    appEl.appendChild(gradModalEl);

    // 4. Replay / How-to-Play Picker Modal
    pickerModalEl = document.createElement('div');
    pickerModalEl.id = 'tutPickerModal';
    pickerModalEl.className = 'tut-modal-backdrop hidden';
    pickerModalEl.setAttribute('role', 'dialog');
    pickerModalEl.setAttribute('aria-modal', 'true');
    pickerModalEl.innerHTML = `
      <div class="tut-modal-card">
        <span class="tut-grad-badge">🎓 SPIRIT TRAINING SANCTUARY</span>
        <h2>How to Play · Solo Dojo</h2>
        <p class="tut-modal-sub">Practice alone at your own pace with animated visual guides before joining 5v5 online matches!</p>
        <div class="tut-picker-grid">
          <button type="button" class="tut-pick-card" id="btnPickHideTut">
            <div class="tut-pick-top">
              <span class="tut-pick-ic">🎭</span>
              <span class="tut-pick-status" id="tutPickHideStatus">✨ First Play</span>
            </div>
            <b>Spirit (Hider) Dojo</b>
            <small>Turn screen, vault furniture, morph into props, place decoys, smoke-dash &amp; hide in hot tubs!</small>
          </button>
          <button type="button" class="tut-pick-card" id="btnPickSeekTut">
            <div class="tut-pick-top">
              <span class="tut-pick-ic">💦</span>
              <span class="tut-pick-status" id="tutPickSeekStatus">✨ First Play</span>
            </div>
            <b>Hunter (Seeker) Dojo</b>
            <small>Aim &amp; spray disguised fakes, scan walls with Echo Pulse &amp; lob 3.5m AoE Splash Bombs!</small>
          </button>
        </div>
        <button type="button" class="tut-btn-secondary" id="btnCloseTutPicker">Close</button>
      </div>
    `;
    appEl.appendChild(pickerModalEl);

    // Bind Coach & Modal Controls
    inputPillEl?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      manualInputOverride = true;
      inputStyle = inputStyle === 'touch' ? 'pc' : 'touch';
      env.audio?.tap?.();
      renderCurrentStepCard(false);
    });

    skipBtnEl?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      env.audio?.tap?.();
      skipCurrentTutorial();
    });

    document.getElementById('btnTutPlayQueue')?.addEventListener('click', (e) => {
      e.stopPropagation();
      env.audio?.tap?.();
      const mode = activeMode;
      gradModalEl.classList.add('hidden');
      stopAndRestoreMap();
      env.enterMatchQueue?.(mode, { skipTutorialCheck: true });
    });

    document.getElementById('btnTutOtherRole')?.addEventListener('click', (e) => {
      e.stopPropagation();
      env.audio?.tap?.();
      const nextMode = activeMode === 'hide' ? 'seek' : 'hide';
      gradModalEl.classList.add('hidden');
      start(nextMode, { source: launchSource });
    });

    document.getElementById('btnTutBackLobby')?.addEventListener('click', (e) => {
      e.stopPropagation();
      env.audio?.tap?.();
      gradModalEl.classList.add('hidden');
      stopAndRestoreMap();
      env.toMenu?.();
    });

    document.getElementById('btnPickHideTut')?.addEventListener('click', (e) => {
      e.stopPropagation();
      env.audio?.tap?.();
      closePickerModal();
      start('hide', { source: 'manual_replay' });
    });

    document.getElementById('btnPickSeekTut')?.addEventListener('click', (e) => {
      e.stopPropagation();
      env.audio?.tap?.();
      closePickerModal();
      start('seek', { source: 'manual_replay' });
    });

    document.getElementById('btnCloseTutPicker')?.addEventListener('click', (e) => {
      e.stopPropagation();
      env.audio?.tap?.();
      closePickerModal();
    });

    pickerModalEl?.addEventListener('click', (e) => {
      if (e.target === pickerModalEl) closePickerModal();
    });

    // Live auto-switch between Touch & PC guide diagrams when player switches device input
    window.addEventListener('pointerdown', (e) => {
      if (!active || manualInputOverride) return;
      if (e.pointerType === 'touch' && inputStyle !== 'touch') {
        inputStyle = 'touch';
        renderCurrentStepCard(false);
      } else if (e.pointerType === 'mouse' && !document.documentElement.classList.contains('is-mobile-touch') && inputStyle !== 'pc') {
        inputStyle = 'pc';
        renderCurrentStepCard(false);
      }
    }, { passive: true });

    window.addEventListener('keydown', () => {
      if (!active || manualInputOverride) return;
      if (!document.documentElement.classList.contains('is-mobile-touch') && inputStyle !== 'pc') {
        inputStyle = 'pc';
        renderCurrentStepCard(false);
      }
    }, { passive: true });

    syncLobbyBadges();
  }

  function openPickerModal() {
    if (!mounted) mountUI();
    syncLobbyBadges();
    pickerModalEl?.classList.remove('hidden');
  }

  function closePickerModal() {
    pickerModalEl?.classList.add('hidden');
  }

  function stopAndRestoreMap() {
    onClearRound();
    const curMap = env.getActiveMapId?.();
    if (curMap === 'tutorial') {
      env.selectMap?.(savedMapId && savedMapId !== 'tutorial' ? savedMapId : 'meadow');
    }
  }

  function skipCurrentTutorial() {
    const mode = activeMode;
    const src = launchSource;
    markRoleDone(mode);
    if (document.pointerLockElement) document.exitPointerLock();
    stopAndRestoreMap();
    if (src === 'play_gate') {
      env.enterMatchQueue?.(mode, { skipTutorialCheck: true });
    } else {
      env.toMenu?.();
    }
  }

  function start(mode = 'hide', opts = {}) {
    if (!mounted) mountUI();
    clearTimeout(stepAdvanceTimer);
    stepAdvancing = false;

    activeMode = mode === 'seek' ? 'seek' : 'hide';
    launchSource = opts.source || 'play_gate';
    manualInputOverride = false;
    inputStyle = detectInitialInputStyle();

    const curMap = env.getActiveMapId?.() || 'meadow';
    if (curMap && curMap !== 'tutorial') {
      savedMapId = curMap;
    }

    gradModalEl?.classList.add('hidden');
    pickerModalEl?.classList.add('hidden');

    // Build solo tutorial sanctuary & spawn ONLY the local player
    env.startTutorialRound?.(activeMode);

    active = true;
    document.body.classList.add('is-tutorial-active');
    coachEl?.classList.remove('hidden');
    coachEl?.setAttribute('data-mode', activeMode);

    ensureWaypoint3D();
    enterStep(0);
  }

  function enterStep(idx) {
    const steps = getStepsForMode(activeMode);
    stepIdx = clamp(idx, 0, steps.length - 1);
    stepAdvancing = false;
    coachEl?.classList.remove('step-done');

    const G = env.G;
    const p = G?.player;
    stepEnteredNow = env.now ? env.now() : performance.now();
    lastYaw = G ? G.yaw : 0;
    accumYaw = 0;
    startPos = p ? { x: p.position.x, z: p.position.z } : { x: 0, z: 7.2 };
    maxWalkDist = 0;
    jumpedInStep = false;
    startPropRotY = p ? p.rotation.y : 0;
    practiceDummy = null;
    practiceSeeker = null;
    evadeHoldSec = 0;
    patrolPhase = 0;
    bombThrowsInStep = 0;
    sawBombInFlight = false;
    dummySoakedFlag = false;

    // Clean any leftover practice targets from prior step
    env.clearTutorialDummies?.();
    env.clearTutorialSeekers?.();

    const step = steps[stepIdx];

    // Refresh trick/gadget cooldowns at the start of every ability step so player never waits!
    if (activeMode === 'hide') {
      env.hiderTricks?.resetCharCooldowns?.(p);
      if (step.id === 'evade' || step.id === 'escape') {
        practiceSeeker = env.spawnTutorialSeeker?.({
          x: -2.2,
          z: 5.5,
          name: 'Patrol Hunter',
        }) || null;
      }
    } else {
      env.seekerGadgets?.resetCharCooldowns?.(p);
    }

    // Spawn bespoke Seeker Practice Spirit Dummies on Steps 3, 4, and 5!
    if (activeMode === 'seek') {
      if (step.id === 'spray') {
        practiceDummy = env.spawnTutorialDummy?.({
          x: 2.6,
          z: -0.4,
          propId: 'barrel',
          hp: 34,
          name: 'Practice Barrel',
        });
      } else if (step.id === 'pulse') {
        practiceDummy = env.spawnTutorialDummy?.({
          x: 0.0,
          z: -6.2,
          propId: 'crate',
          hp: 60,
          name: 'Hidden Pavilion Spirit',
        });
      } else if (step.id === 'bomb') {
        practiceDummy = env.spawnTutorialDummy?.({
          x: -2.6,
          z: -2.0,
          propId: 'crate',
          hp: 22,
          name: 'Bomb Target Spirit',
        });
        if (practiceDummy && env.hiderTricks?.useDecoy) {
          env.hiderTricks.useDecoy(practiceDummy, {
            fromNet: true,
            x: -1.75,
            z: -1.85,
            propId: 'barrel',
          });
        }
      }
    }

    // Configure 3D Golden Waypoint Ring
    ensureWaypoint3D();
    if (waypointGrp) {
      if (step.waypoint) {
        waypointGrp.visible = true;
        waypointGrp.position.set(step.waypoint.x, 0, step.waypoint.z);
        const r = step.waypoint.radius || 1.5;
        if (wpOuterRing) wpOuterRing.scale.setScalar(r);
        if (wpInnerDisc) wpInnerDisc.scale.setScalar(r);
        if (wpPillar) wpPillar.scale.set(r * 0.72, 1, r * 0.72);
      } else {
        waypointGrp.visible = false;
      }
    }

    renderCurrentStepCard(true);
    setProgress(0);
    updateSpotlight(step);
  }

  function renderCurrentStepCard(animatePop = false) {
    if (!coachEl) return;
    const steps = getStepsForMode(activeMode);
    const step = steps[stepIdx];
    if (!step) return;

    const isTouchUI = inputStyle === 'touch';
    const roleName = activeMode === 'seek' ? 'SEEKER DOJO' : 'SPIRIT DOJO';
    if (stepPillEl) {
      stepPillEl.textContent = `STEP ${stepIdx + 1} / ${steps.length} · ${roleName}`;
    }
    if (inputPillEl) {
      inputPillEl.textContent = isTouchUI ? '📱 Touch' : '💻 PC';
    }
    if (titleEl) {
      titleEl.textContent = step.title;
    }
    if (descEl) {
      descEl.innerHTML = isTouchUI ? step.touchDesc : step.pcDesc;
    }
    if (animStageEl) {
      animStageEl.innerHTML = buildControlAnimationHTML(step.anim, isTouchUI);
    }
    if (animatePop) {
      coachEl.classList.remove('step-pop');
      void coachEl.offsetWidth;
      coachEl.classList.add('step-pop');
    }
  }

  function setProgress(frac) {
    const pct = Math.round(clamp(frac, 0, 1) * 100);
    if (progFillEl) progFillEl.style.width = `${pct}%`;
    if (progLblEl) progLblEl.textContent = `${pct}%`;
  }

  function resolveSpotlightSelector(step) {
    if (!step) return null;
    const isTouchUI = inputStyle === 'touch';
    const G = env.G;
    const p = G?.player;

    if (step.id === 'morph') {
      if (isTouchUI) return '#btnSample';
      const chipBtn = document.querySelector('#chips .chip');
      return chipBtn ? '#chips .chip' : null;
    }
    if (step.id === 'rotate') {
      if (p && !p.userData?.propId) {
        const chipBtn = document.querySelector('#chips .chip');
        return chipBtn ? '#chips .chip' : '#btnSample';
      }
      return '#btnFreeze';
    }
    if (step.id === 'whistle') {
      const bi = document.getElementById('btnInteract');
      if (bi && !bi.classList.contains('hidden')) return '#btnInteract';
      return '#btnTrickTaunt';
    }
    if (step.id === 'move_jump') {
      if (!isTouchUI) return null;
      return maxWalkDist >= 1.6 ? '#btnJump' : '#mobileMovePad';
    }
    if (step.anyTarget) return step.anyTarget;
    if (isTouchUI && step.touchTarget) return step.touchTarget;
    return null;
  }

  function updateSpotlight(step) {
    if (!spotlightEl) return;
    if (!active || stepAdvancing) {
      spotlightEl.classList.add('hidden');
      return;
    }
    const sel = resolveSpotlightSelector(step);
    const el = sel ? document.querySelector(sel) : null;
    if (!el || el.classList.contains('hidden')) {
      spotlightEl.classList.add('hidden');
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) {
      spotlightEl.classList.add('hidden');
      return;
    }
    const pad = 6;
    spotlightEl.classList.remove('hidden');
    spotlightEl.style.left = `${Math.round(rect.left - pad)}px`;
    spotlightEl.style.top = `${Math.round(rect.top - pad)}px`;
    spotlightEl.style.width = `${Math.round(rect.width + pad * 2)}px`;
    spotlightEl.style.height = `${Math.round(rect.height + pad * 2)}px`;
    spotlightEl.style.borderRadius = rect.width > 120 ? '18px' : '22px';
    spotlightEl.classList.toggle('tag-below', rect.top < 74);
    if (spotTagEl) {
      spotTagEl.textContent = step.spotLabel || '👆 Here!';
    }
  }

  function completeCurrentStep() {
    if (stepAdvancing || !active) return;
    stepAdvancing = true;
    setProgress(1);
    coachEl?.classList.add('step-done');
    spotlightEl?.classList.add('hidden');
    env.audio?.tap?.();

    const steps = getStepsForMode(activeMode);
    const isFinal = stepIdx >= steps.length - 1;

    clearTimeout(stepAdvanceTimer);
    stepAdvanceTimer = setTimeout(() => {
      if (!active) return;
      if (isFinal) {
        finishTutorialWithGraduation();
      } else {
        enterStep(stepIdx + 1);
      }
    }, isFinal ? 520 : 480);
  }

  function finishTutorialWithGraduation() {
    const mode = activeMode;
    const rewardKey = mode === 'seek' ? STORAGE_REWARD_SEEK : STORAGE_REWARD_HIDE;
    const firstReward = safeGetStorage(rewardKey) !== '1';
    markRoleDone(mode);

    if (document.pointerLockElement) document.exitPointerLock();
    if (waypointGrp) waypointGrp.visible = false;
    coachEl?.classList.add('hidden');
    spotlightEl?.classList.add('hidden');

    if (firstReward && env.awardTokens) {
      safeSetStorage(rewardKey, '1');
      env.awardTokens(
        `tutorial_${mode}`,
        60,
        mode === 'seek' ? '🎓 First Bust Graduate! +60 🪙' : '🎓 First Escape Graduate! +60 🪙',
        75
      );
    }
    env.audio?.win?.();

    const gradEmoji = document.getElementById('tutGradEmoji');
    const gradTitle = document.getElementById('tutGradTitle');
    const gradSub = document.getElementById('tutGradSub');
    const gradReward = document.getElementById('tutGradReward');
    const gradSkills = document.getElementById('tutGradSkills');
    const btnPlay = document.getElementById('btnTutPlayQueue');
    const btnOther = document.getElementById('btnTutOtherRole');

    const isSeek = mode === 'seek';
    if (gradEmoji) gradEmoji.textContent = isSeek ? '💦🏆' : '🎭🏆';
    if (gradTitle) {
      gradTitle.textContent = isSeek ? 'First Bust Complete!' : 'First Escape Complete!';
    }
    if (gradSub) {
      gradSub.textContent = isSeek
        ? 'You know how to aim, soak disguised props, scan walls with Echo Pulse, and lob 3.5m Splash Bombs!'
        : 'You morphed in seconds, fooled a live Seeker, and pulled off a trick escape — ready for 5v5!';
    }
    if (gradReward) {
      gradReward.textContent = firstReward
        ? '🪙 +60 Spirit Tokens Graduation Bonus!'
        : '✨ Training Refresher Completed!';
    }
    if (gradSkills) {
      const chips = isSeek
        ? ['🎯 Crosshair Aim', '💦 Water Spray', '📡 Echo Pulse', '💣 3.5m Splash Bomb']
        : ['🛢️ Aim-to-Morph', '🔒 Position Lock & Stealth', '🪞 Decoy / 🌸 Smoke Escape', '🎵 Whistle & ♨️ Secret Tub'];
      gradSkills.innerHTML = chips.map((c) => `<span class="tut-skill-chip">✓ ${c}</span>`).join('');
    }
    if (btnPlay) {
      btnPlay.className = `tut-btn-primary${isSeek ? ' seek' : ''}`;
      btnPlay.textContent = isSeek ? '💦 Play 5v5 Seek Match Now! ▶' : '🎭 Play 5v5 Hide Match Now! ▶';
    }
    if (btnOther) {
      const otherMode = isSeek ? 'hide' : 'seek';
      const otherDone = isRoleDone(otherMode);
      btnOther.textContent = isSeek
        ? (otherDone ? '🎭 Replay Spirit (Hider) Dojo' : '🎭 Also Learn Spirit (Hider) Controls')
        : (otherDone ? '💦 Replay Hunter (Seeker) Dojo' : '💦 Also Learn Hunter (Seeker) Controls');
    }

    gradModalEl?.classList.remove('hidden');
  }

  function onDummySoaked(ch) {
    if (!active) return;
    if (ch && (ch === practiceDummy || ch.userData?.isTutorialDummy)) {
      dummySoakedFlag = true;
    }
  }

  function update(dt, now) {
    if (!active) return;
    const G = env.G;
    const p = G?.player;
    if (!G || !p) return;

    const steps = getStepsForMode(activeMode);
    const step = steps[stepIdx];
    if (!step) return;

    // 1. Animate 3D Golden Waypoint Ring & Floating Diamond Beacon
    if (waypointGrp && waypointGrp.visible) {
      const t = (now || performance.now()) * 0.001;
      if (wpOuterRing) wpOuterRing.rotation.z = t * 0.85;
      if (wpInnerDisc) wpInnerDisc.material.opacity = 0.16 + Math.sin(t * 3.4) * 0.08;
      if (wpBeacon) {
        wpBeacon.position.y = 2.0 + Math.sin(t * 3.2) * 0.22;
        wpBeacon.rotation.y = t * 1.9;
      }
    }

    // 2. Show friendly PC pointer-lock nudge during Step 1 if unlocked on PC
    if (lockNudgeEl) {
      const showNudge = inputStyle === 'pc' && step.id === 'look' && !env.isPointerLocked?.();
      lockNudgeEl.classList.toggle('hidden', !showNudge);
    }

    updateSpotlight(step);
    if (stepAdvancing) return;

    // 3. Track cumulative camera yaw, walk distance & jump state
    const dyaw = Math.abs(normDeltaAngle(G.yaw, lastYaw));
    lastYaw = G.yaw;
    if (dyaw > 0 && dyaw < 1.2) accumYaw += dyaw;

    const curWalkDist = Math.hypot(p.position.x - startPos.x, p.position.z - startPos.z);
    if (curWalkDist > maxWalkDist) maxWalkDist = curWalkDist;
    if ((p.userData?.jy || 0) > 0.25) jumpedInStep = true;

    // 4. Evaluate Step Completion & Smooth Progress Bar!
    if (step.id === 'look') {
      const frac = clamp(accumYaw / 1.15, 0, 1);
      setProgress(frac);
      if (frac >= 1) completeCurrentStep();
      return;
    }

    if (step.id === 'move') {
      const dRing = step.waypoint
        ? Math.hypot(p.position.x - step.waypoint.x, p.position.z - step.waypoint.z)
        : 99;
      const frac = dRing <= 2.05 ? 1 : clamp(maxWalkDist / 4.2, 0, 0.95);
      setProgress(frac);
      if (dRing <= 2.05 || maxWalkDist >= 4.5) completeCurrentStep();
      return;
    }

    if (step.id === 'jump') {
      const dBench = step.waypoint
        ? Math.hypot(p.position.x - step.waypoint.x, p.position.z - step.waypoint.z)
        : 0;
      const approachFrac = clamp(1 - (dBench - 2.2) / 5.5, 0, 0.55);
      setProgress(jumpedInStep ? 1 : approachFrac);
      if (jumpedInStep) completeCurrentStep();
      return;
    }

    if (step.id === 'move_jump') {
      const walkPart = clamp(maxWalkDist / 2.2, 0, 0.6);
      const jumpPart = jumpedInStep ? 0.4 : 0;
      setProgress(walkPart + jumpPart);
      if (maxWalkDist >= 2.0 && jumpedInStep) completeCurrentStep();
      return;
    }

    if (step.id === 'morph') {
      const dGallery = step.waypoint
        ? Math.hypot(p.position.x - step.waypoint.x, p.position.z - step.waypoint.z)
        : 0;
      const nearFrac = clamp(1 - (dGallery - 2.4) / 6.0, 0, 0.6);
      const morphed = Boolean(p.userData?.propId);
      setProgress(morphed ? 1 : nearFrac);
      if (morphed) completeCurrentStep();
      return;
    }

    // Animate live patrolling Practice Seeker during "evade" and "escape" beats
    if (practiceSeeker && practiceSeeker.position) {
      patrolPhase += dt * 0.68;
      const sx = Math.sin(patrolPhase) * 3.8 + 1.2;
      const sz = Math.cos(patrolPhase * 0.7) * 2.8 + 1.8;
      const dx = sx - practiceSeeker.position.x;
      const dz = sz - practiceSeeker.position.z;
      practiceSeeker.position.x += dx * Math.min(1, dt * 2.4);
      practiceSeeker.position.z += dz * Math.min(1, dt * 2.4);
      if (Math.hypot(dx, dz) > 0.05) {
        practiceSeeker.rotation.y = Math.atan2(dx, dz);
      }
      practiceSeeker.userData.bob = (practiceSeeker.userData.bob || 0) + dt * 10;
      practiceSeeker.userData.sus = 0.65;
    }

    if (step.id === 'evade') {
      const disguised = Boolean(p.userData?.propId || p.userData?.specialMode);
      const still = !G.moving || Boolean(G.posLocked);
      if (disguised && still) {
        evadeHoldSec += dt * (G.posLocked ? 1.45 : 1.0);
      } else if (!disguised) {
        evadeHoldSec = Math.max(0, evadeHoldSec - dt * 0.6);
      }
      const needSec = 2.8;
      const frac = clamp(evadeHoldSec / needSec, 0, 1);
      setProgress(frac);
      if (frac >= 1) {
        env.hint?.('🔥 NERVES OF STEEL! The Seeker walked right past you!', 2400);
        completeCurrentStep();
      }
      return;
    }

    if (step.id === 'escape') {
      const hasDecoy = (env.hiderTricks?.getActiveDecoys?.()?.length || 0) > 0;
      const hasSmoke = (env.hiderTricks?.getActiveSmokes?.()?.length || 0) > 0;
      const dashing = (env.hiderTricks?.getSpeedMultiplier?.(p) || 1) > 1.2;
      const done = hasDecoy || hasSmoke || dashing;
      setProgress(done ? 1 : 0.2);
      if (done) {
        env.hint?.('✨ Clean escape! You completely juked the Hunter!', 2000);
        completeCurrentStep();
      }
      return;
    }

    if (step.id === 'rotate') {
      if (!p.userData?.propId) {
        setProgress(0.2);
        startPropRotY = null;
        return;
      }
      if (startPropRotY == null) startPropRotY = p.rotation.y;
      const rotDelta = Math.abs(normDeltaAngle(p.rotation.y, startPropRotY));
      const rotated = (G.rotatedT || 0) > 0.05 || rotDelta > 0.35;
      setProgress(rotated ? 1 : 0.45);
      if (rotated) completeCurrentStep();
      return;
    }

    if (step.id === 'decoy') {
      const hasDecoy = (env.hiderTricks?.getActiveDecoys?.()?.length || 0) > 0;
      setProgress(hasDecoy ? 1 : 0.15);
      if (hasDecoy) completeCurrentStep();
      return;
    }

    if (step.id === 'dash') {
      const hasSmoke = (env.hiderTricks?.getActiveSmokes?.()?.length || 0) > 0;
      const dashing = (env.hiderTricks?.getSpeedMultiplier?.(p) || 1) > 1.2;
      setProgress(hasSmoke || dashing ? 1 : 0.15);
      if (hasSmoke || dashing) completeCurrentStep();
      return;
    }

    if (step.id === 'whistle') {
      const whistled = Boolean(env.hiderTricks?.hasUsedTauntSince?.(p, stepEnteredNow));
      const inTub = Boolean(p.userData?.specialMode);
      setProgress(whistled || inTub ? 1 : 0.25);
      if (whistled || inTub) completeCurrentStep();
      return;
    }

    if (step.id === 'spray') {
      const maxHp = practiceDummy?.userData?.ai?.maxHp || 34;
      const curHp = practiceDummy?.userData?.ai?.hp ?? maxHp;
      const soaked = dummySoakedFlag || Boolean(practiceDummy?.userData?.actor?.eliminated) || curHp <= 0;
      const dmgFrac = clamp(1 - curHp / maxHp, 0, 1);
      setProgress(soaked ? 1 : dmgFrac);
      if (soaked) completeCurrentStep();
      return;
    }

    if (step.id === 'pulse') {
      const waves = env.seekerGadgets?.getActiveWaves?.() || [];
      setProgress(waves.length > 0 ? 1 : 0.15);
      if (waves.length > 0) completeCurrentStep();
      return;
    }

    if (step.id === 'bomb') {
      const bombs = env.seekerGadgets?.getActiveBombs?.() || [];
      const bursts = env.seekerGadgets?.getActiveBursts?.() || [];
      const soaked = dummySoakedFlag || Boolean(practiceDummy?.userData?.actor?.eliminated);

      if (bombs.length > 0) {
        sawBombInFlight = true;
        setProgress(0.6);
      }
      if (soaked) {
        setProgress(1);
        completeCurrentStep();
        return;
      }
      // If a bomb finished bursting without soaking the dummy, immediately refresh Bomb CD!
      if (sawBombInFlight && bombs.length === 0 && bursts.length === 0) {
        sawBombInFlight = false;
        bombThrowsInStep++;
        env.seekerGadgets?.resetCharCooldowns?.(p);
        if (bombThrowsInStep >= 2) {
          completeCurrentStep();
        } else {
          env.hint?.('💡 Bomb recharged! Aim right at the glowing 🎯 circle and toss one more 💣!', 2200);
          setProgress(0.5);
        }
      }
    }
  }

  function onClearRound() {
    clearTimeout(stepAdvanceTimer);
    active = false;
    stepAdvancing = false;
    practiceDummy = null;
    practiceSeeker = null;
    env.clearTutorialSeekers?.();
    document.body?.classList?.remove('is-tutorial-active');
    coachEl?.classList.add('hidden');
    spotlightEl?.classList.add('hidden');
    if (waypointGrp) waypointGrp.visible = false;
  }

  function stop() {
    onClearRound();
    gradModalEl?.classList.add('hidden');
    pickerModalEl?.classList.add('hidden');
  }

  function getStepProgressBadge() {
    const steps = getStepsForMode(activeMode);
    return `${Math.min(steps.length, stepIdx + 1)}/${steps.length}`;
  }

  return {
    mountUI,
    isRoleDone,
    markRoleDone,
    shouldRunFirstTime,
    syncLobbyBadges,
    openPickerModal,
    closePickerModal,
    start,
    stop,
    onClearRound,
    onDummySoaked,
    update,
    getStepProgressBadge,
    getSavedMapId: () => savedMapId || 'meadow',
    isActive: () => active,
    getState: () => {
      const steps = getStepsForMode(activeMode);
      return {
        active,
        mode: activeMode,
        stepIndex: stepIdx,
        stepId: steps[stepIdx]?.id || null,
        totalSteps: steps.length,
        inputStyle,
        savedMapId,
      };
    },
  };
}
