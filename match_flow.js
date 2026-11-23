/* ==========================================================================
 * Hue & Seek — 2-Round 5v5 Halftime Side-Swap & End-of-Match MVP Manager
 * Owns:
 *   • 2-Round 5v5 Series state, HUD badge (#roundSeriesBadge) & Squad Scoring
 *   • Animated Halftime Side-Swap overlay (#halftimeScreen) & swapRosterSides
 *   • Per-actor cumulative match telemetry across both rounds (10 players)
 *   • 3 Playful End-of-Match MVP Highlight Cards + #resultRewardsSlot mount
 *   • Celebratory WebAudio stingers (Halftime Whistle/Gong + MVP Deal Chimes)
 * ========================================================================== */

import { HUE_RULES, hueRoundPoints } from './hue_layer.js?v=4';

const HALFTIME_DURATION_SEC = 5.0;
function resolveHalftimeDurationSec() {
  try {
    if (typeof location !== 'undefined') {
      const q = Number(new URLSearchParams(location.search).get('halftimeSec'));
      if (!Number.isNaN(q) && q >= 0.4 && q <= 20) return q;
    }
  } catch (_) { /* ignore */ }
  return HALFTIME_DURATION_SEC;
}
const FALLBACK_HIDER_SKINS = ['classic', 'mushroom', 'straw', 'raincloud', 'flower', 'goggles', 'bow'];
const FALLBACK_SEEKER_KINDS = ['raincoat', 'farmer', 'firefighter', 'grandma'];

const BIG_PROP_IDS = new Set([
  'barrel', 'hay_round', 'hay_bale', 'log_pile', 'cart_wheel',
  'armchair', 'rocking_chair', 'grandfather_clock', 'stove', 'chest',
  'spinning_wheel', 'butter_churn', 'wheelbarrow', 'feed_trough',
  'flour_sacks', 'peel_barrel', 'chicken_crate', 'tool_rack',
  'bh_hinoki_tub', 'bh_sake_cask', 'sr_propeller_barrel',
  'sp_wine_cask', 'sp_anchor_bollard', 'cw_steam_samovar', 'bw_spool_table',
]);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function escHtml(raw) {
  return String(raw ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

/**
 * Pure side-swap builder for Round 2:
 * Moves the exact 5 Round-1 Hiders -> Round-2 Seekers and Round-1 Seekers -> Round-2 Hiders,
 * preserving actorId, name, isBot, ping, spiritMap, skin, seekerKind, localActorId,
 * isLiveRoom, masterActorId, and recalculating human flags + round durations.
 */
export function swapRosterSides(roster) {
  if (!roster) return null;
  const mapId = roster.mapId || 'meadow';
  const prevHiders = Array.isArray(roster.hiders) ? roster.hiders : [];
  const prevSeekers = Array.isArray(roster.seekers) ? roster.seekers : [];

  // Former Seekers become Round 2 Hiders (Spirits)
  const nextHiders = prevSeekers.map((slot, idx) => ({
    ...slot,
    actorId: slot.actorId,
    name: slot.name,
    team: 'hiders',
    slotIdx: idx,
    isBot: !!slot.isBot,
    ping: slot.ping || 26,
    hat: slot.hat || 'none',
    spiritMap: slot.spiritMap || prevHiders[idx]?.spiritMap || mapId,
    skin: slot.skin || prevHiders[idx]?.skin || FALLBACK_HIDER_SKINS[idx % FALLBACK_HIDER_SKINS.length],
    seekerKind: slot.seekerKind || FALLBACK_SEEKER_KINDS[idx % FALLBACK_SEEKER_KINDS.length],
  }));

  // Former Hiders become Round 2 Seekers
  const nextSeekers = prevHiders.map((slot, idx) => ({
    ...slot,
    actorId: slot.actorId,
    name: slot.name,
    team: 'seekers',
    slotIdx: idx,
    isBot: !!slot.isBot,
    ping: slot.ping || 25,
    hat: slot.hat || 'none',
    spiritMap: slot.spiritMap || mapId,
    skin: slot.skin || FALLBACK_HIDER_SKINS[idx % FALLBACK_HIDER_SKINS.length],
    seekerKind: slot.seekerKind || prevSeekers[idx]?.seekerKind || FALLBACK_SEEKER_KINDS[idx % FALLBACK_SEEKER_KINDS.length],
  }));

  const hasHumanHiders = nextHiders.some((p) => !p.isBot);
  const hasHumanSeekers = nextSeekers.some((p) => !p.isBot);
  const bothHumanSides = hasHumanHiders && hasHumanSeekers;
  const humanCount = [...nextHiders, ...nextSeekers].filter((p) => !p.isBot).length;

  return {
    roomId: roster.roomId || 'local',
    mapId,
    humanCount: roster.humanCount ?? humanCount,
    isLiveRoom: !!roster.isLiveRoom,
    masterActorId: roster.masterActorId || roster.localActorId || 'local',
    localActorId: roster.localActorId || 'local',
    hasHumanHiders,
    hasHumanSeekers,
    prepSeconds: hasHumanHiders ? 30 : 10,
    huntSeconds: 110,
    roundNumber: 2,
    hiders: nextHiders,
    seekers: nextSeekers,
  };
}

export function createMatchFlowManager(env = {}) {
  const hasDOM = typeof document !== 'undefined';
  const getNow = () => (typeof env.now === 'function' ? env.now() : Date.now());
  const $ = (id) => (hasDOM ? document.getElementById(id) : null);

  // --------------------------------------------------------------------------
  // Celebratory WebAudio Stingers (Halftime Whistle/Gong & MVP Deal-in Chimes)
  // --------------------------------------------------------------------------
  let stingerCtx = null;
  const chimeTimers = [];

  function clearChimeTimers() {
    while (chimeTimers.length) clearTimeout(chimeTimers.pop());
  }

  function ensureAudioCtx() {
    if (env.audio?.isMuted?.()) return null;
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!stingerCtx) {
      try {
        stingerCtx = new AudioCtx({ latencyHint: 'interactive' });
      } catch (_) {
        try { stingerCtx = new AudioCtx(); } catch (_2) { return null; }
      }
    }
    if (stingerCtx.state === 'suspended') {
      stingerCtx.resume?.().catch(() => {});
    }
    return stingerCtx;
  }

  function schedVoice(ctx, startAt, freq0, freq1, dur, { type = 'sine', vol = 0.14, attack = 0.008 } = {}) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq0, startAt);
      if (freq1 && freq1 !== freq0) {
        osc.frequency.exponentialRampToValueAtTime(freq1, startAt + dur * 0.85);
      }
      g.gain.setValueAtTime(0.0001, startAt);
      g.gain.linearRampToValueAtTime(vol, startAt + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(dur, attack + 0.02));
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + dur + 0.03);
    } catch (_) { /* ignore audio scheduling errors on locked tabs */ }
  }

  function playHalftimeStinger() {
    if (env.audio?.isMuted?.()) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    // Crisp festival double-whistle chirp
    schedVoice(ctx, t0, 1174.66, 1318.51, 0.13, { type: 'triangle', vol: 0.11, attack: 0.006 });
    schedVoice(ctx, t0 + 0.15, 1318.51, 1760.0, 0.24, { type: 'triangle', vol: 0.13, attack: 0.006 });
    // Warm resonant Storybook bronze temple gong + major-9th shimmer chord
    const gongPartials = [
      [174.61, 1.35, 0.16, 'sine'],     // F3 fundamental
      [261.63, 1.20, 0.11, 'sine'],     // C4 fifth
      [349.23, 1.05, 0.09, 'triangle'], // F4 octave
      [440.00, 0.95, 0.07, 'sine'],     // A4 major third
      [523.25, 0.85, 0.06, 'sine'],     // C5
      [659.25, 0.80, 0.05, 'sine'],     // E5 major-7th sparkle
    ];
    for (const [freq, dur, vol, type] of gongPartials) {
      schedVoice(ctx, t0 + 0.22, freq, freq * 0.996, dur, { type, vol, attack: 0.012 });
    }
  }

  function playSideSwapWhoosh() {
    if (env.audio?.isMuted?.()) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    // Bright ascending Storybook ocarina triad (G4 -> C5 -> E5 -> G5)
    const notes = [392.0, 523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      schedVoice(ctx, t0 + i * 0.055, f, f * 1.005, 0.22, { type: 'triangle', vol: 0.09, attack: 0.006 });
    });
  }

  function playMvpCardChime(cardIndex = 0) {
    if (env.audio?.isMuted?.()) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const chords = [
      [523.25, 783.99],           // Card 1: C5 + G5
      [587.33, 880.00],           // Card 2: D5 + A5
      [659.25, 987.77, 1318.51],  // Card 3: E5 + B5 + E6
    ];
    const notes = chords[cardIndex % chords.length];
    notes.forEach((f, idx) => {
      schedVoice(ctx, t0 + idx * 0.045, f, f, 0.36, { type: 'sine', vol: 0.095, attack: 0.005 });
    });
  }

  // --------------------------------------------------------------------------
  // Series & Per-Actor Telemetry State
  // --------------------------------------------------------------------------
  let seriesActive = false;
  let seriesOver = false;
  let roundNumber = 1;
  let yourSquadScore = 0;
  let rivalSquadScore = 0;
  let localActorId = 'local';
  let activeRoster = null;
  let pendingSwappedRoster = null;
  let yourSquadIds = new Set();
  let roundHistory = [];

  let halftimeActive = false;
  let halftimeTimer = null;
  let halftimeTick = null;
  let halftimeStartedMs = 0;
  let halftimeDurActiveSec = HALFTIME_DURATION_SEC;
  let halftimeWaitingForClip = false;
  let resultShareActive = false;

  let roundScored = false;
  let peekedRoundPts = null;   // points computed early for the end cinematic, reused by handleRoundEnd
  let roundHuntElapsed = 0;
  const roundSurvivalByActor = new Map();
  const roundEliminatedAt = new Map();

  // Cumulative stats across BOTH rounds for all 10 players
  const statsByActorId = new Map();

  function makeBlankStat(actorId, name, isYou = false) {
    return {
      actorId: String(actorId),
      name: String(name || (isYou ? 'You' : 'Player')),
      isYou: !!isYou,
      closeSeekSec: 0,
      chasesEscaped: 0,
      eliminations: 0,
      shotsFired: 0,
      shotsHit: 0,
      decoyTricks: 0,
      closeTaunts: 0,
      taunts: 0,
      smokeEscapes: 0,
      bigPropSec: 0,
      frenzySurvivedSec: 0,
      damageTaken: 0,
      paintPots: 0,
      haunts: 0,
      repaints: 0,
      activeChaseFromAt: 0,
      // Auxiliary internal tracking
      survivedSec: 0,
      disguisedSec: 0,
      inDangerElapsedSec: 0,
      sinceLastHitSec: 0,
      lastHitAtMs: 0,
      _roundShotsRecorded: 0,
      _roundElimsRecorded: 0,
      _rStartDecoys: 0,
      _rStartCloseTaunts: 0,
      _rStartTaunts: 0,
      _rStartEscapes: 0,
      _rStartSmoke: 0,
      _rStartPots: 0,
      _rStartHaunts: 0,
    };
  }

  function snapshotRoundBaseline() {
    roundHuntElapsed = 0;
    roundSurvivalByActor.clear();
    roundEliminatedAt.clear();
    for (const st of statsByActorId.values()) {
      st.activeChaseFromAt = 0;
      st.inDangerElapsedSec = 0;
      st.sinceLastHitSec = 0;
      st.lastHitAtMs = 0;
      st._roundShotsRecorded = 0;
      st._roundElimsRecorded = 0;
      st._rStartDecoys = st.decoyTricks;
      st._rStartCloseTaunts = st.closeTaunts;
      st._rStartTaunts = st.taunts;
      st._rStartEscapes = st.chasesEscaped;
      st._rStartSmoke = st.smokeEscapes;
      st._rStartPots = st.paintPots || 0;
      st._rStartHaunts = st.haunts || 0;
    }
  }

  function ensureActorStat(chOrActorId) {
    if (!chOrActorId) return null;
    const G = env.G || {};

    if (typeof chOrActorId === 'string') {
      const id = chOrActorId;
      if (statsByActorId.has(id)) return statsByActorId.get(id);
      const all = [G.player, ...(G.allHiders || []), ...(G.allSeekers || [])].filter(Boolean);
      const found = all.find((c) => c.userData?.actor?.id === id);
      const act = found?.userData?.actor;
      const isYou = Boolean(act?.isLocal || id === localActorId);
      const st = makeBlankStat(id, act?.name || (isYou ? 'You' : 'Spirit'), isYou);
      statsByActorId.set(id, st);
      return st;
    }

    const act = chOrActorId.userData?.actor || chOrActorId;
    const isPlayerRef = Boolean(G.player && chOrActorId === G.player);
    const id = String(act?.id || act?.actorId || (isPlayerRef ? (localActorId || 'local') : ''));
    if (!id) return null;

    const isYou = Boolean(act?.isLocal || isPlayerRef || id === localActorId);
    let st = statsByActorId.get(id);
    if (!st) {
      st = makeBlankStat(id, act?.name || (isYou ? 'You' : 'Spirit'), isYou);
      statsByActorId.set(id, st);
    } else {
      if (act?.name && (st.name === 'Player' || st.name === 'Spirit' || st.name === 'You')) {
        st.name = String(act.name);
      }
      if (isYou) st.isYou = true;
    }
    return st;
  }

  function synthesizeRosterFromG() {
    const G = env.G || {};
    const hChars = (G.allHiders && G.allHiders.length)
      ? G.allHiders
      : [G.mode === 'hide' ? G.player : null, ...(G.hiders || [])].filter(Boolean);
    const sChars = (G.allSeekers && G.allSeekers.length)
      ? G.allSeekers
      : [G.mode === 'seek' ? G.player : null, ...(G.seekers || [])].filter(Boolean);

    const playerActId = G.player?.userData?.actor?.id || localActorId || 'local';
    const mapId = 'meadow';

    const toSlot = (ch, idx, team) => {
      const a = ch?.userData?.actor || {};
      const id = a.id || `${team[0]}_${idx}`;
      const isMe = Boolean(a.isLocal || ch === G.player || id === playerActId);
      return {
        actorId: id,
        name: a.name || (isMe ? 'You' : `Squad_${idx + 1}`),
        team,
        slotIdx: idx,
        isBot: a.isBot !== undefined ? !!a.isBot : !isMe,
        ping: 24 + ((idx * 5) % 19),
        spiritMap: mapId,
        skin: FALLBACK_HIDER_SKINS[idx % FALLBACK_HIDER_SKINS.length],
        seekerKind: FALLBACK_SEEKER_KINDS[idx % FALLBACK_SEEKER_KINDS.length],
      };
    };

    const hiders = hChars.map((c, i) => toSlot(c, i, 'hiders'));
    const seekers = sChars.map((c, i) => toSlot(c, i, 'seekers'));
    while (hiders.length < 5) {
      const i = hiders.length;
      hiders.push({
        actorId: `syn_h_${i}`,
        name: ['Mochi_x', 'KitsuneGG', 'DustWalker', 'AcornFan', 'SkyTinker'][i % 5],
        team: 'hiders',
        slotIdx: i,
        isBot: i > 0 || G.mode === 'seek',
        ping: 26 + i * 3,
        spiritMap: mapId,
        skin: FALLBACK_HIDER_SKINS[i % FALLBACK_HIDER_SKINS.length],
        seekerKind: FALLBACK_SEEKER_KINDS[i % FALLBACK_SEEKER_KINDS.length],
      });
    }
    while (seekers.length < 5) {
      const i = seekers.length;
      seekers.push({
        actorId: `syn_s_${i}`,
        name: ['BroomCourier', 'RiverKoi', 'CrimsonAce', 'Ember99', 'Grove7'][i % 5],
        team: 'seekers',
        slotIdx: i,
        isBot: i > 0 || G.mode !== 'seek',
        ping: 28 + i * 3,
        spiritMap: mapId,
        skin: FALLBACK_HIDER_SKINS[i % FALLBACK_HIDER_SKINS.length],
        seekerKind: FALLBACK_SEEKER_KINDS[i % FALLBACK_SEEKER_KINDS.length],
      });
    }

    if (!hiders.some((p) => p.actorId === playerActId) && !seekers.some((p) => p.actorId === playerActId)) {
      if (G.mode === 'seek') {
        seekers[0].actorId = playerActId;
        seekers[0].isBot = false;
      } else {
        hiders[0].actorId = playerActId;
        hiders[0].isBot = false;
      }
    }

    const hasHumanHiders = hiders.some((p) => !p.isBot);
    const hasHumanSeekers = seekers.some((p) => !p.isBot);
    return {
      roomId: 'local',
      mapId,
      humanCount: 1,
      isLiveRoom: false,
      masterActorId: playerActId,
      localActorId: playerActId,
      hasHumanHiders,
      hasHumanSeekers,
      prepSeconds: hasHumanHiders ? 30 : 10,
      huntSeconds: 110,
      hiders,
      seekers,
    };
  }

  function syncLiveActorsIntoStats() {
    if (activeRoster) {
      for (const slot of [...(activeRoster.hiders || []), ...(activeRoster.seekers || [])]) {
        if (!slot || !slot.actorId) continue;
        const isYou = slot.actorId === localActorId;
        let st = statsByActorId.get(slot.actorId);
        if (!st) {
          st = makeBlankStat(slot.actorId, slot.name, isYou);
          statsByActorId.set(slot.actorId, st);
        } else {
          if (slot.name) st.name = slot.name;
          if (isYou) st.isYou = true;
        }
      }
    }

    const G = env.G || {};
    const chars = [G.player, ...(G.allHiders || []), ...(G.allSeekers || []), ...(G.hiders || []), ...(G.seekers || [])].filter(Boolean);
    for (const ch of chars) {
      const st = ensureActorStat(ch);
      if (!st) continue;
      const actElims = Number(ch.userData?.actor?.eliminations) || 0;
      if (actElims > st._roundElimsRecorded) {
        st.eliminations += (actElims - st._roundElimsRecorded);
        st._roundElimsRecorded = actElims;
      }
      if (ch === G.player && G.mode === 'seek') {
        const gShots = Number(G.shotsFired) || 0;
        if (gShots > st._roundShotsRecorded) {
          st.shotsFired += (gShots - st._roundShotsRecorded);
          st._roundShotsRecorded = gShots;
        }
      }
    }
  }

  function ensureSeriesInitialized() {
    if (!seriesActive || !activeRoster) {
      startSeries(synthesizeRosterFromG());
    }
  }

  // --------------------------------------------------------------------------
  // DOM Mounting & HUD Badge Updates
  // --------------------------------------------------------------------------
  function mountUI() {
    if (!hasDOM) return;

    // 1. Mount #roundSeriesBadge inside #hud .top
    const topBar = document.querySelector('#hud .top');
    if (topBar && !$('roundSeriesBadge')) {
      const badge = document.createElement('div');
      badge.id = 'roundSeriesBadge';
      badge.className = 'round-series-badge';
      badge.textContent = 'RD 1/2';
      topBar.appendChild(badge);
    }

    // 2. Mount #halftimeScreen inside #app
    const app = $('app');
    if (app && !$('halftimeScreen')) {
      const hf = document.createElement('div');
      hf.id = 'halftimeScreen';
      hf.className = 'screen halftime-screen';
      hf.setAttribute('aria-live', 'polite');
      hf.innerHTML =
        `<div class="hf-backdrop" aria-hidden="true"></div>` +
        `<div class="hf-card">` +
          `<div class="hf-kicker" id="halftimeKicker">⏱️ HALFTIME · SIDE SWAP!</div>` +
          `<h2 class="hf-banner-title" id="halftimeBannerTitle">🎭 Round 1 Complete</h2>` +
          `<p class="hf-banner-sub" id="halftimeBannerSub"></p>` +
          `<div class="hf-scoreboard" id="halftimeScoreboard">` +
            `<div class="hf-squad-box yours">` +
              `<span class="hf-squad-pill sage">YOUR SQUAD</span>` +
              `<b class="hf-score-num" id="hfYourScore">0</b>` +
              `<span class="hf-score-detail" id="hfYourDetail">Round 1 Points</span>` +
            `</div>` +
            `<div class="hf-score-sep">` +
              `<span class="hf-score-dash">—</span>` +
              `<span class="hf-score-rd">RD 1 / 2</span>` +
            `</div>` +
            `<div class="hf-squad-box rival">` +
              `<span class="hf-squad-pill sky">RIVAL SQUAD</span>` +
              `<b class="hf-score-num" id="hfRivalScore">0</b>` +
              `<span class="hf-score-detail" id="hfRivalDetail">Round 1 Points</span>` +
            `</div>` +
          `</div>` +
          `<div class="hf-standout" id="halftimeStandout">🌟 Standout play locked in!</div>` +
          `<div class="hf-highlight-cta" id="halftimeHighlightBox">` +
            `<div class="hf-hl-quote-row">` +
              `<span class="hf-hl-badge" id="halftimeHighlightBadge">🔥 PLAY OF THE ROUND</span>` +
              `<span class="hf-hl-quote" id="halftimeHighlightQuote">“Round recap”</span>` +
            `</div>` +
            `<div class="rh-btn-row" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">` +
              `<button type="button" class="hf-share-highlight-btn" id="btnHalftimePreviewClip" aria-label="Watch 9:16 clip" style="background:rgba(255,248,234,0.6);color:#3c4632;border:1.5px solid rgba(255,184,66,0.85);">▶️ Watch 9:16 Clip</button>` +
              `<button type="button" class="hf-share-highlight-btn" id="btnHalftimeShareHighlight" aria-label="Share clip to TikTok or Shorts">🎬 Share Clip (TikTok / Shorts)</button>` +
            `</div>` +
          `</div>` +
          `<div class="hf-swap-box" id="halftimeSwapBox">` +
            `<div class="hf-swap-visual" aria-hidden="true">` +
              `<span class="hf-role-chip spirits">🎭 Spirits</span>` +
              `<span class="hf-swap-arrows">⇄</span>` +
              `<span class="hf-role-chip seekers">💦 Seekers</span>` +
            `</div>` +
            `<h3 class="hf-swap-headline" id="halftimeSwapHeadline">Swapping Sides!</h3>` +
            `<div class="hf-rosters">` +
              `<div class="hf-roster-col">` +
                `<div class="hf-roster-hdr spirits"><span>🎭 Round 2 Spirits</span><span>5 Players</span></div>` +
                `<div class="hf-roster-tags" id="hfNextHiders"></div>` +
              `</div>` +
              `<div class="hf-roster-col">` +
                `<div class="hf-roster-hdr seekers"><span>💦 Round 2 Seekers</span><span>5 Players</span></div>` +
                `<div class="hf-roster-tags" id="hfNextSeekers"></div>` +
              `</div>` +
            `</div>` +
          `</div>` +
          `<div class="hf-progress-wrap">` +
            `<div class="hf-bar"><i id="halftimeBarFill"></i></div>` +
            `<span class="hf-countdown-txt" id="halftimeCountdownTxt">Round 2 begins in 5.0s…</span>` +
          `</div>` +
          `<div class="hf-actions">` +
            `<button type="button" class="hf-go-btn" id="btnHalftimeStart">Start Round 2 Now ▶</button>` +
            `<button type="button" class="hf-menu-link" id="btnHalftimeMenu">Leave to Menu</button>` +
          `</div>` +
        `</div>`;
      app.appendChild(hf);

      const startBtn = $('btnHalftimeStart');
      if (startBtn) {
        startBtn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          env.audio?.tap?.();
          skipHalftimeNow();
        });
        startBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          skipHalftimeNow();
        });
      }

      const extendHalftimeForClip = (extraSec = 8.0) => {
        const liveMp = Boolean((pendingSwappedRoster?.isLiveRoom && (pendingSwappedRoster?.humanCount || 1) >= 2) || env.isLiveSession?.());
        if (halftimeActive && !liveMp) {
          const elapsed = Math.max(0, (getNow() - halftimeStartedMs) / 1000);
          const rem = Math.max(0, halftimeDurActiveSec - elapsed);
          if (rem < extraSec) {
            halftimeDurActiveSec = elapsed + extraSec;
            if (halftimeTimer) clearTimeout(halftimeTimer);
            halftimeTimer = setTimeout(() => {
              skipHalftimeNow();
            }, Math.round(extraSec * 1000));
          }
          return true;
        }
        return false;
      };

      const hfPreviewBtn = $('btnHalftimePreviewClip');
      if (hfPreviewBtn) {
        hfPreviewBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          env.audio?.tap?.();
          extendHalftimeForClip(14.0);
          env.shareHighlight?.({ openPreview: true, preferVideo: true });
        });
      }

      const hfShareBtn = $('btnHalftimeShareHighlight');
      if (hfShareBtn) {
        hfShareBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          env.audio?.tap?.();
          // Solo: hold halftime until the clip has actually been handed to the share sheet (it may still be
          // rendering after an early skip), then give the player a moment before round 2. Capped so it can never hang.
          halftimeWaitingForClip = extendHalftimeForClip(45.0);
          Promise.resolve(env.shareHighlight?.({ preferVideo: true }))
            .catch(() => null)
            .then(() => {
              halftimeWaitingForClip = false;
              if (!halftimeActive) return;
              const elapsed = Math.max(0, (getNow() - halftimeStartedMs) / 1000);
              halftimeDurActiveSec = elapsed + 4.0;
              if (halftimeTimer) clearTimeout(halftimeTimer);
              halftimeTimer = setTimeout(() => { skipHalftimeNow(); }, 4000);
            });
        });
      }

      const menuBtn = $('btnHalftimeMenu');
      if (menuBtn) {
        const handleLeave = (e) => {
          e.stopPropagation();
          env.audio?.tap?.();
          cancelHalftime();
          resetSeries();
          if (typeof env.toMenu === 'function') {
            env.toMenu();
          } else {
            const existingMenuBtn = $('btnMenu') || $('btnQuit');
            if (existingMenuBtn) {
              existingMenuBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            }
          }
        };
        menuBtn.addEventListener('pointerdown', handleLeave);
      }
    }

    // 3. Mount Series Scoreboard, 3-MVP Cards container, and #resultRewardsSlot inside #result .card
    const resultCard = document.querySelector('#result .card');
    if (resultCard) {
      const anchor = resultCard.querySelector('.r-row');
      if (!$('seriesScoreboardBox')) {
        const sb = document.createElement('div');
        sb.id = 'seriesScoreboardBox';
        sb.className = 'series-scoreboard hidden';
        if (anchor) resultCard.insertBefore(sb, anchor);
        else resultCard.appendChild(sb);
      }
      if (!$('mvpSectionWrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'mvpSectionWrap';
        wrap.className = 'mvp-section-wrap hidden';
        wrap.innerHTML =
          `<div class="mvp-section-hdr"><span>✨ MATCH MVP HIGHLIGHTS ✨</span></div>` +
          `<div id="mvpAwardsRow" class="mvp-awards-row"></div>`;
        if (anchor) resultCard.insertBefore(wrap, anchor);
        else resultCard.appendChild(wrap);
      }
      if (!$('yourGameBox')) {
        const yg = document.createElement('div');
        yg.id = 'yourGameBox';
        yg.className = 'your-game hidden';
        const before = $('mvpSectionWrap') || anchor;
        if (before) resultCard.insertBefore(yg, before);
        else resultCard.appendChild(yg);
      }
      let slot = $('resultRewardsSlot');
      if (!slot) {
        slot = document.createElement('div');
        slot.id = 'resultRewardsSlot';
        slot.className = 'result-rewards-slot';
        if (anchor) resultCard.insertBefore(slot, anchor);
        else resultCard.appendChild(slot);
      }
      if (slot && typeof MutationObserver === 'function' && !slot._vhShareObserver) {
        const obs = new MutationObserver(() => {
          if (!resultShareActive) return;
          if (!slot.querySelector('#resultHighlightShareBox')) {
            mountResultHighlightShareBox(slot);
          }
        });
        obs.observe(slot, { childList: true });
        slot._vhShareObserver = obs;
      }
    }

    updateHudBadge();
  }

  function resolveRoundHighlightDisplay() {
    try {
      const raw = env.getBestHighlightSummary?.();
      if (typeof raw === 'string' && raw.trim()) {
        return {
          badge: '🎬 ROUND HIGHLIGHT',
          quote: raw.trim(),
        };
      }
      if (raw && typeof raw === 'object') {
        const q = String(raw.headline || raw.quote || raw.text || raw.title || '').trim();
        const b = String(raw.badge || '🎬 ROUND HIGHLIGHT').trim();
        // say whose moment it was, so a rival's great escape is never mistaken for the player's own
        const who = raw.isLocal ? 'You' : String(raw.actorName || '').trim();
        if (q) return { badge: b, quote: who && !q.includes(who) ? `${who}: ${q}` : q };
      }
    } catch (_) { /* ignore summary hook errors */ }

    const standout = buildStandoutLine()
      .replace(/^[^\w]*Round \d+ Standout:\s*/i, '')
      .trim();
    return {
      badge: '🎬 ROUND RECAP',
      quote: standout || 'Round complete',
    };
  }

  function mountResultHighlightShareBox(hostArg = null) {
    if (!hasDOM) return null;
    const slot = hostArg || $('resultRewardsSlot');
    if (!slot) return null;

    const hlInfo = resolveRoundHighlightDisplay();
    let box = slot.querySelector('#resultHighlightShareBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'resultHighlightShareBox';
      box.className = 'result-highlight-cta';
      box.innerHTML =
        `<div class="rh-top-row">` +
          `<span class="rh-badge" id="resultHighlightBadge"></span>` +
          `<span class="rh-quote" id="resultHighlightQuote"></span>` +
        `</div>` +
        `<div class="rh-btn-row">` +
          `<button type="button" class="rh-card-btn secondary" id="btnResultPreviewClip" aria-label="Watch 9:16 clip">▶️ Watch 9:16 Clip</button>` +
          `<button type="button" class="rh-share-btn primary" id="btnResultShareHighlight" aria-label="Share clip to TikTok or Shorts">🎬 Share Clip (TikTok / Shorts)</button>` +
          `<button type="button" class="rh-card-btn secondary" id="btnResultSaveCard" aria-label="Save 9:16 cover">🖼️ Save 9:16 Cover</button>` +
        `</div>`;

      const previewClipBtn = box.querySelector('#btnResultPreviewClip');
      if (previewClipBtn) {
        previewClipBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          env.audio?.tap?.();
          env.shareHighlight?.({ openPreview: true, preferVideo: true });
        });
      }

      const shareVideoBtn = box.querySelector('#btnResultShareHighlight');
      if (shareVideoBtn) {
        shareVideoBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          env.audio?.tap?.();
          env.shareHighlight?.({ preferVideo: true });
        });
      }

      const saveCardBtn = box.querySelector('#btnResultSaveCard');
      if (saveCardBtn) {
        saveCardBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          env.audio?.tap?.();
          env.shareHighlight?.({ preferVideo: false });
        });
      }

      if (slot.firstChild) {
        slot.insertBefore(box, slot.firstChild);
      } else {
        slot.appendChild(box);
      }
    }

    const badgeEl = box.querySelector('#resultHighlightBadge');
    if (badgeEl) badgeEl.textContent = hlInfo.badge;
    const quoteEl = box.querySelector('#resultHighlightQuote');
    if (quoteEl) quoteEl.textContent = `“${hlInfo.quote}”`;

    return box;
  }

  function clearResultHighlightShareBox() {
    resultShareActive = false;
    if (!hasDOM) return;
    const existing = $('resultHighlightShareBox');
    if (existing) existing.remove();
  }

  function updateHudBadge() {
    if (!hasDOM) return;
    const badge = $('roundSeriesBadge');
    if (!badge) return;
    if (roundNumber <= 1) {
      badge.textContent = 'RD 1/2';
      badge.className = 'round-series-badge round-1';
    } else {
      badge.textContent = `RD 2/2 · ${yourSquadScore}–${rivalSquadScore}`;
      const stateCls = yourSquadScore > rivalSquadScore
        ? ' leading'
        : (yourSquadScore < rivalSquadScore ? ' trailing' : '');
      badge.className = `round-series-badge round-2${stateCls}`;
    }
  }

  // --------------------------------------------------------------------------
  // Series Lifecycle (startSeries, cancelHalftime, resetSeries)
  // --------------------------------------------------------------------------
  function cancelHalftime() {
    if (halftimeTimer) {
      clearTimeout(halftimeTimer);
      halftimeTimer = null;
    }
    if (halftimeTick) {
      clearInterval(halftimeTick);
      halftimeTick = null;
    }
    halftimeActive = false;
    pendingSwappedRoster = null;
    if (hasDOM) {
      const hf = $('halftimeScreen');
      if (hf) hf.classList.remove('on');
    }
  }

  function resetSeries() {
    cancelHalftime();
    clearChimeTimers();
    clearResultHighlightShareBox();
    seriesActive = false;
    seriesOver = false;
    roundNumber = 1;
    yourSquadScore = 0;
    rivalSquadScore = 0;
    roundScored = false;
    peekedRoundPts = null;
    activeRoster = null;
    yourSquadIds = new Set();
    roundHistory = [];
    statsByActorId.clear();
    roundHuntElapsed = 0;
    roundSurvivalByActor.clear();
    roundEliminatedAt.clear();
    updateHudBadge();
  }

  function startSeries(initialRoster = null) {
    mountUI();
    cancelHalftime();
    clearChimeTimers();
    clearResultHighlightShareBox();

    const roster = (initialRoster && Array.isArray(initialRoster.hiders) && Array.isArray(initialRoster.seekers))
      ? initialRoster
      : synthesizeRosterFromG();

    localActorId = roster.localActorId || 'local';
    activeRoster = {
      ...roster,
      localActorId,
      hiders: (roster.hiders || []).map((s, i) => ({ ...s, slotIdx: i, team: 'hiders' })),
      seekers: (roster.seekers || []).map((s, i) => ({ ...s, slotIdx: i, team: 'seekers' })),
    };

    const localInSeekers = activeRoster.seekers.some((s) => s.actorId === localActorId);
    const myTeamList = localInSeekers ? activeRoster.seekers : activeRoster.hiders;
    yourSquadIds = new Set(myTeamList.map((p) => p.actorId));

    seriesActive = true;
    seriesOver = false;
    roundNumber = 1;
    yourSquadScore = 0;
    rivalSquadScore = 0;
    roundScored = false;
    peekedRoundPts = null;
    roundHistory = [];
    statsByActorId.clear();

    for (const p of [...activeRoster.hiders, ...activeRoster.seekers]) {
      const isYou = p.actorId === localActorId;
      statsByActorId.set(p.actorId, makeBlankStat(p.actorId, p.name, isYou));
    }
    snapshotRoundBaseline();
    updateHudBadge();
  }

  // --------------------------------------------------------------------------
  // Live Per-Actor Match Telemetry
  // --------------------------------------------------------------------------
  const STAT_KEY_ALIASES = {
    decoys: 'decoyTricks',
    decoy: 'decoyTricks',
    whistle: 'taunts',
    closeWhistle: 'closeTaunts',
    smoke: 'smokeEscapes',
    escape: 'chasesEscaped',
  };

  function recordStat(chOrActorId, key, delta = 1) {
    if (!key) return;
    const st = ensureActorStat(chOrActorId);
    if (!st) return;
    const canonKey = STAT_KEY_ALIASES[key] || key;
    const numDelta = Number(delta) || 0;
    st[canonKey] = (Number(st[canonKey]) || 0) + numDelta;
    if (canonKey !== key) {
      st[key] = (Number(st[key]) || 0) + numDelta;
    }
  }

  function onSeekerShot(shooterChar) {
    const st = ensureActorStat(shooterChar);
    if (!st) return;
    st.shotsFired += 1;
    st._roundShotsRecorded += 1;
  }

  function onHiderHit(hiderChar, shooterChar, eliminated = false) {
    const nowMs = getNow();
    const isElim = Boolean(eliminated || hiderChar?.userData?.actor?.eliminated);

    if (shooterChar) {
      const shooterSt = ensureActorStat(shooterChar);
      if (shooterSt) {
        shooterSt.shotsHit += 1;
        if (shooterSt.shotsFired < shooterSt.shotsHit) {
          shooterSt.shotsFired = shooterSt.shotsHit;
          shooterSt._roundShotsRecorded = Math.max(shooterSt._roundShotsRecorded, shooterSt.shotsHit);
        }
        if (isElim) {
          shooterSt.eliminations += 1;
          shooterSt._roundElimsRecorded += 1;
        }
      }
    }

    if (hiderChar) {
      const hiderSt = ensureActorStat(hiderChar);
      if (hiderSt) {
        hiderSt.damageTaken += 12;
        if (isElim) {
          hiderSt.activeChaseFromAt = 0;
          hiderSt.inDangerElapsedSec = 0;
          hiderSt.sinceLastHitSec = 0;
          if (!roundEliminatedAt.has(hiderSt.actorId)) {
            roundEliminatedAt.set(hiderSt.actorId, roundHuntElapsed);
          }
        } else {
          if (!hiderSt.activeChaseFromAt) {
            hiderSt.activeChaseFromAt = nowMs || 1;
            hiderSt.inDangerElapsedSec = 0;
          }
          hiderSt.lastHitAtMs = nowMs || 1;
          hiderSt.sinceLastHitSec = 0;
        }
      }
    }
  }

  function isOversizedProp(u, kit) {
    if (!u || !u.propId) return false;
    if (BIG_PROP_IDS.has(u.propId)) return true;
    const def = kit?.props?.[u.propId];
    if (def && ((def.radius || 0) >= 0.52 || (def.height || 0) >= 1.15 || (def.hp || 100) >= 115)) {
      return true;
    }
    return (u.radius || 0) >= 0.52 || (u.height || 0) >= 1.15;
  }

  function updateTelemetry(dt) {
    const G = env.G;
    if (!G || !(dt > 0)) return;

    // Auto-reset if a brand new match started after a finished 2-round series without explicit startSeries
    if (seriesOver && !G.over && (G.phase === 'hide' || G.phase === 'ready' || G.phase === 'survive' || G.phase === 'seek')) {
      startSeries(synthesizeRosterFromG());
    }
    if (!G.over && roundScored && (G.phase === 'hide' || G.phase === 'ready' || G.phase === 'survive' || G.phase === 'seek')) {
      roundScored = false;
      peekedRoundPts = null;
    peekedRoundPts = null;
    }

    if (G.over || (G.phase !== 'survive' && G.phase !== 'seek')) return;

    if (!seriesActive) ensureSeriesInitialized();
    syncLiveActorsIntoStats();

    const stepDt = Math.min(dt, 10);
    const nowMs = getNow();
    const kit = env.getKit?.() || null;
    const inFrenzy = Boolean(G.frenzy || (typeof G.t === 'number' && G.t > 0 && G.t <= 30));

    roundHuntElapsed += stepDt;

    const rawHiders = (G.allHiders && G.allHiders.length)
      ? G.allHiders
      : [G.mode === 'hide' ? G.player : null, ...(G.hiders || [])].filter(Boolean);
    const rawSeekers = (G.allSeekers && G.allSeekers.length)
      ? G.allSeekers
      : [G.mode === 'seek' ? G.player : null, ...(G.seekers || [])].filter(Boolean);

    const livingHiders = rawHiders.filter((h) => h && !h.userData?.actor?.eliminated);
    const livingSeekers = rawSeekers.filter((s) => s && !s.userData?.actor?.eliminated);

    for (const h of livingHiders) {
      const st = ensureActorStat(h);
      if (!st) continue;
      const u = h.userData || {};

      st.survivedSec += stepDt;
      roundSurvivalByActor.set(st.actorId, roundHuntElapsed);
      if (inFrenzy) st.frenzySurvivedSec += stepDt;

      const isDisguised = Boolean(u.propId || u.specialMode);
      if (isDisguised) st.disguisedSec += stepDt;
      if (isOversizedProp(u, kit)) st.bigPropSec += stepDt;

      // "Hidden in Plain Sight": disguised / in special spot within 3.8m of any living Seeker & not evading
      const isEvading = u.ai?.state === 'evade';
      if (isDisguised && !isEvading && h.position && livingSeekers.length) {
        let nearSeeker = false;
        const hx = h.position.x || 0;
        const hy = h.position.y || 0;
        const hz = h.position.z || 0;
        for (const s of livingSeekers) {
          if (!s.position) continue;
          const dx = hx - (s.position.x || 0);
          const dy = hy - (s.position.y || 0);
          const dz = hz - (s.position.z || 0);
          if (Math.hypot(dx, dy, dz) <= 3.8) {
            nearSeeker = true;
            break;
          }
        }
        if (nearSeeker) st.closeSeekSec += stepDt;
      }

      // "Ankle Breaker": survived 7.5s+ after taking soak damage with >= 4.0s clean break without hits
      if (st.activeChaseFromAt) {
        st.inDangerElapsedSec += stepDt;
        st.sinceLastHitSec += stepDt;
        const dangerDur = Math.max(
          st.inDangerElapsedSec,
          st.activeChaseFromAt > 1 ? (nowMs - st.activeChaseFromAt) / 1000 : 0
        );
        const quietDur = Math.max(
          st.sinceLastHitSec,
          st.lastHitAtMs > 1 ? (nowMs - st.lastHitAtMs) / 1000 : 0
        );
        if (dangerDur >= 7.5 && quietDur >= 4.0) {
          st.chasesEscaped += 1;
          st.activeChaseFromAt = 0;
          st.inDangerElapsedSec = 0;
          st.sinceLastHitSec = 0;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Round Scoring Calculation & Standout Summaries
  // --------------------------------------------------------------------------
  function computeCurrentRoundPoints() {
    const G = env.G || {};
    syncLiveActorsIntoStats();

    const allHiders = (G.allHiders && G.allHiders.length) ? G.allHiders : [];
    const teamSize = allHiders.length || 5;

    let aliveHidersCount = 0;
    let eliminationsCount = 0;
    if (allHiders.length > 0) {
      aliveHidersCount = allHiders.filter((h) => h && !h.userData?.actor?.eliminated).length;
      eliminationsCount = Math.max(0, allHiders.length - aliveHidersCount);
    } else {
      eliminationsCount = clamp(Number(G.found) || 0, 0, teamSize);
      aliveHidersCount = Math.max(0, teamSize - eliminationsCount);
    }

    const allEliminated = aliveHidersCount === 0 && eliminationsCount > 0;
    const huntDuration = Math.max(1, Number(G.huntDuration) || (G.mode === 'seek' ? 180 : 150));
    const timeRemaining = clamp(Number(G.t) || 0, 0, huntDuration);
    const inferredElapsed = clamp(huntDuration - timeRemaining, 0, huntDuration);
    const totalRoundElapsed = Math.max(roundHuntElapsed, inferredElapsed);

    // Compute average survival fraction across the 5 Round Hiders
    let sumSurvivalFrac = 0;
    const rosterHiders = activeRoster?.hiders || [];
    if (allHiders.length > 0) {
      for (const h of allHiders) {
        const eliminated = !!h?.userData?.actor?.eliminated;
        const id = h?.userData?.actor?.id;
        if (!eliminated) {
          const aliveSec = timeRemaining <= 0.05 ? huntDuration : totalRoundElapsed;
          sumSurvivalFrac += clamp(aliveSec / huntDuration, 0, 1);
        } else if (id && roundEliminatedAt.has(id)) {
          sumSurvivalFrac += clamp(roundEliminatedAt.get(id) / huntDuration, 0, 1);
        } else if (id && roundSurvivalByActor.has(id)) {
          sumSurvivalFrac += clamp(roundSurvivalByActor.get(id) / huntDuration, 0, 1);
        } else {
          sumSurvivalFrac += clamp((totalRoundElapsed * 0.45) / huntDuration, 0.05, 0.85);
        }
      }
      sumSurvivalFrac /= allHiders.length;
    } else {
      const aliveFrac = timeRemaining <= 0.05 ? 1 : clamp(totalRoundElapsed / huntDuration, 0, 1);
      const elimFrac = clamp((totalRoundElapsed * 0.45) / huntDuration, 0, 1);
      sumSurvivalFrac = ((aliveHidersCount * aliveFrac) + (eliminationsCount * elimFrac)) / teamSize;
    }
    const avgSurvivalFraction = clamp(sumSurvivalFrac, 0, 1);

    // Compute trickBonusPoints earned by this round's Hiders (decoys, close-taunts, escapes)
    const hiderIdSet = new Set(
      (rosterHiders.length ? rosterHiders.map((s) => s.actorId) : allHiders.map((h) => h?.userData?.actor?.id)).filter(Boolean)
    );
    let roundDecoys = 0;
    let roundCloseTaunts = 0;
    let roundTaunts = 0;
    let roundEscapes = 0;
    let roundPots = 0;
    let roundHaunts = 0;
    for (const st of statsByActorId.values()) {
      if (hiderIdSet.size && !hiderIdSet.has(st.actorId)) continue;
      roundDecoys += Math.max(0, st.decoyTricks - (st._rStartDecoys || 0));
      roundCloseTaunts += Math.max(0, st.closeTaunts - (st._rStartCloseTaunts || 0));
      roundTaunts += Math.max(0, st.taunts - (st._rStartTaunts || 0));
      roundEscapes += Math.max(0, (st.chasesEscaped - (st._rStartEscapes || 0)) + (st.smokeEscapes - (st._rStartSmoke || 0)));
      roundPots += Math.max(0, (st.paintPots || 0) - (st._rStartPots || 0));
      roundHaunts += Math.max(0, (st.haunts || 0) - (st._rStartHaunts || 0));
    }
    const extraTaunts = Math.max(0, roundTaunts - roundCloseTaunts);
    const trickBonusPoints = Math.min(
      180,
      (roundDecoys * 20) + (roundCloseTaunts * 20) + (extraTaunts * 8) + (roundEscapes * 25)
    );

    // Paint Pots grabbed and ghost haunts that seekers heard (both capped) — the hiders' active ways to score.
    const huePoints = hueRoundPoints({ paintPots: roundPots, haunts: roundHaunts });

    // Winning the round outright is worth a flat bonus, so "we held out" / "we soaked them all" always shows on the scoreboard:
    // hiders earn it when at least one spirit is still unseen at the final whistle, seekers when all five are soaked.
    const roundEnded = !!G.over;
    const hidersHeldOut = roundEnded && aliveHidersCount > 0;
    const hidersWinBonus = hidersHeldOut ? HUE_RULES.ROUND_WIN_BONUS : 0;
    const seekersWinBonus = allEliminated ? HUE_RULES.ROUND_WIN_BONUS : 0;

    const hidingSquadPoints =
      (aliveHidersCount * 110) +
      Math.round(avgSurvivalFraction * 180) +
      trickBonusPoints +
      huePoints +
      hidersWinBonus;

    const seekingSquadPoints =
      (eliminationsCount * 110) +
      (allEliminated ? Math.round((timeRemaining / huntDuration) * 200) : 0) +
      seekersWinBonus;

    // Determine whether Your Squad was Hiding or Seeking in this round
    const localInSeekers = activeRoster?.seekers?.some((s) => s.actorId === localActorId);
    const yourRole = typeof localInSeekers === 'boolean'
      ? (localInSeekers ? 'seekers' : 'hiders')
      : (G.mode === 'seek' ? 'seekers' : 'hiders');

    const yourPts = yourRole === 'hiders' ? hidingSquadPoints : seekingSquadPoints;
    const rivalPts = yourRole === 'hiders' ? seekingSquadPoints : hidingSquadPoints;

    const hidingDetail = `${aliveHidersCount}/${teamSize} unseen${hidersWinBonus ? ` · +${hidersWinBonus} held out` : ''}${trickBonusPoints > 0 ? ` · +${trickBonusPoints} tricks` : ''}${huePoints > 0 ? ` · +${huePoints} paint & haunts` : ''}`;
    const seekingDetail = `${eliminationsCount}/${teamSize} soaked${allEliminated ? ` · +${seekersWinBonus} clean sweep · speed bonus!` : ''}`;

    return {
      yourRole,
      yourPts,
      rivalPts,
      hidingSquadPoints,
      seekingSquadPoints,
      aliveHidersCount,
      eliminationsCount,
      allEliminated,
      avgSurvivalFraction,
      trickBonusPoints,
      huePoints,
      roundPots,
      roundHaunts,
      hidersWinBonus,
      seekersWinBonus,
      yourDetail: yourRole === 'hiders' ? `🎭 Spirits · ${hidingDetail}` : `💦 Seekers · ${seekingDetail}`,
      rivalDetail: yourRole === 'hiders' ? `💦 Seekers · ${seekingDetail}` : `🎭 Spirits · ${hidingDetail}`,
    };
  }

  function buildStandoutLine() {
    const entries = [...statsByActorId.values()];
    if (!entries.length) return '🌟 Round 1 complete — time to swap roles!';

    const bestClose = [...entries].sort((a, b) => b.closeSeekSec - a.closeSeekSec)[0];
    if (bestClose && bestClose.closeSeekSec >= 3) {
      const who = bestClose.isYou ? `${bestClose.name} (You)` : bestClose.name;
      return `🫣 Round 1 Standout: ${who} hid within 3.5m of Seekers for ${Math.round(bestClose.closeSeekSec)}s!`;
    }

    const bestElim = [...entries].sort((a, b) => b.eliminations - a.eliminations)[0];
    if (bestElim && bestElim.eliminations >= 2) {
      const who = bestElim.isYou ? `${bestElim.name} (You)` : bestElim.name;
      return `💦 Round 1 Standout: ${who} tracked down & soaked ${bestElim.eliminations} Spirits!`;
    }

    const bestEsc = [...entries].sort((a, b) => (b.chasesEscaped + b.smokeEscapes) - (a.chasesEscaped + a.smokeEscapes))[0];
    if (bestEsc && (bestEsc.chasesEscaped + bestEsc.smokeEscapes) >= 1) {
      const n = bestEsc.chasesEscaped + bestEsc.smokeEscapes;
      const who = bestEsc.isYou ? `${bestEsc.name} (You)` : bestEsc.name;
      return `🩰 Round 1 Standout: ${who} escaped ${n} hot ${n === 1 ? 'chase' : 'chases'}!`;
    }

    if (bestElim && bestElim.eliminations >= 1) {
      const who = bestElim.isYou ? `${bestElim.name} (You)` : bestElim.name;
      return `🎯 Round 1 Standout: ${who} scored a clean Spirit soak!`;
    }

    const bestSurv = [...entries].sort((a, b) => b.survivedSec - a.survivedSec)[0];
    if (bestSurv && bestSurv.survivedSec >= 5) {
      const who = bestSurv.isYou ? `${bestSurv.name} (You)` : bestSurv.name;
      return `🌿 Round 1 Standout: ${who} stayed hidden for ${Math.round(bestSurv.survivedSec)}s!`;
    }

    return '✨ Tight opening round — everything is on the line in Round 2!';
  }

  // --------------------------------------------------------------------------
  // Halftime Presentation & Round 2 Launch
  // --------------------------------------------------------------------------
  function renderHalftimeOverlay(roundSummary, roundPts, nextRoster) {
    if (!hasDOM) return;
    mountUI();

    const resEl = $('result');
    if (resEl) resEl.classList.remove('on');
    const specBar = $('specBar');
    if (specBar) specBar.classList.add('hidden');
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }

    const bannerEmoji = roundSummary.emoji || (roundSummary.win ? '🎭' : '💦');
    const cleanTitle = String(roundSummary.title || 'Round 1').replace(/!+$/, '');
    const titleEl = $('halftimeBannerTitle');
    if (titleEl) titleEl.textContent = `${bannerEmoji} ${cleanTitle}! · Round 1 Complete`;

    const subEl = $('halftimeBannerSub');
    if (subEl) subEl.textContent = roundSummary.sub || (env.getWorldTitle?.() || 'Meadowbrook Village');

    if ($('hfYourScore')) $('hfYourScore').textContent = String(yourSquadScore);
    if ($('hfRivalScore')) $('hfRivalScore').textContent = String(rivalSquadScore);
    if ($('hfYourDetail')) $('hfYourDetail').textContent = roundPts.yourDetail;
    if ($('hfRivalDetail')) $('hfRivalDetail').textContent = roundPts.rivalDetail;
    if ($('halftimeStandout')) $('halftimeStandout').textContent = buildStandoutLine();

    const hlInfo = resolveRoundHighlightDisplay();
    if ($('halftimeHighlightBadge')) $('halftimeHighlightBadge').textContent = hlInfo.badge;
    if ($('halftimeHighlightQuote')) $('halftimeHighlightQuote').textContent = `“${hlInfo.quote}”`;

    const nextSeeking = (nextRoster?.seekers || []).some((s) => s.actorId === localActorId);
    const swapHeadline = $('halftimeSwapHeadline');
    if (swapHeadline) {
      swapHeadline.innerHTML = nextSeeking
        ? `Swapping Sides! Your Squad is now <em class="seek-em">💦 SEEKING</em> in Round 2!`
        : `Swapping Sides! Your Squad is now <em class="hide-em">🎭 HIDING</em> in Round 2!`;
    }

    const renderTags = (list) => (list || []).map((slot) => {
      const isYou = slot.actorId === localActorId;
      return (
        `<span class="hf-p-tag${isYou ? ' is-you' : ''}">` +
          `<span>${escHtml(slot.name)}</span>` +
          (isYou ? `<b class="hf-p-you">YOU</b>` : '') +
        `</span>`
      );
    }).join('');

    if ($('hfNextHiders')) $('hfNextHiders').innerHTML = renderTags(nextRoster?.hiders || []);
    if ($('hfNextSeekers')) $('hfNextSeekers').innerHTML = renderTags(nextRoster?.seekers || []);

    const hfDur = resolveHalftimeDurationSec();
    const fill = $('halftimeBarFill');
    if (fill) {
      fill.classList.remove('run');
      fill.style.setProperty('--hf-dur', `${hfDur}s`);
      void fill.offsetWidth;
      fill.classList.add('run');
    }

    const startBtn = $('btnHalftimeStart');
    if (startBtn) {
      const liveMp = Boolean((nextRoster?.isLiveRoom && (nextRoster?.humanCount || 1) >= 2) || env.isLiveSession?.());
      startBtn.style.display = liveMp ? 'none' : '';
    }

    const hf = $('halftimeScreen');
    if (hf) hf.classList.add('on');
  }

  function skipHalftimeNow() {
    halftimeWaitingForClip = false;
    if (!halftimeActive) return;
    if (halftimeTimer) {
      clearTimeout(halftimeTimer);
      halftimeTimer = null;
    }
    if (halftimeTick) {
      clearInterval(halftimeTick);
      halftimeTick = null;
    }
    halftimeActive = false;

    if (hasDOM) {
      const hf = $('halftimeScreen');
      if (hf) hf.classList.remove('on');
    }

    const swapped = pendingSwappedRoster || swapRosterSides(activeRoster || synthesizeRosterFromG());
    pendingSwappedRoster = null;
    activeRoster = swapped;
    roundNumber = 2;
    roundScored = false;
    peekedRoundPts = null;
    snapshotRoundBaseline();
    syncLiveActorsIntoStats();
    updateHudBadge();
    playSideSwapWhoosh();

    if (typeof env.launchSwappedRound2 === 'function') {
      env.launchSwappedRound2(swapped);
    }
  }

  // --------------------------------------------------------------------------
  // 3 Playful End-of-Match MVP Highlight Cards
  // --------------------------------------------------------------------------
  function computeMvpCards() {
    syncLiveActorsIntoStats();
    let pool = [...statsByActorId.values()];
    if (pool.length < 3) {
      const fallbackRoster = activeRoster || synthesizeRosterFromG();
      for (const s of [...(fallbackRoster.hiders || []), ...(fallbackRoster.seekers || [])]) {
        if (!statsByActorId.has(s.actorId)) {
          statsByActorId.set(s.actorId, makeBlankStat(s.actorId, s.name, s.actorId === localActorId));
        }
      }
      pool = [...statsByActorId.values()];
    }

    const categorySpecs = [
      // 1. Hidden in Plain Sight (closeSeekSec)
      {
        key: 'plain_sight',
        domain: 'hide',
        icon: '🫣',
        title: 'Hidden in Plain Sight',
        evalActor(s) {
          if (s.closeSeekSec < 2.0) return null;
          const secs = Math.max(2, Math.round(s.closeSeekSec));
          return {
            norm: (s.closeSeekSec / 9.5) + (s.isYou ? 0.14 : 0),
            desc: `Stood within 3.5m of Seekers for ${secs} seconds`,
          };
        },
      },
      // 2. Ankle Breaker (chasesEscaped + smokeEscapes)
      {
        key: 'ankle_breaker',
        domain: 'hide',
        icon: '🩰',
        title: 'Ankle Breaker',
        evalActor(s) {
          const total = s.chasesEscaped + s.smokeEscapes;
          if (total < 1) return null;
          const escCount = Math.max(1, Math.round(total));
          return {
            norm: (escCount / 1.35) + (s.isYou ? 0.14 : 0),
            desc: `Escaped ${escCount} ${escCount === 1 ? 'chase' : 'chases'} & broke line-of-sight`,
          };
        },
      },
      // 3. Eagle Eye (shotsHit / shotsFired + eliminations)
      {
        key: 'eagle_eye',
        domain: 'seek',
        icon: '🎯',
        title: 'Eagle Eye',
        evalActor(s) {
          const effShots = Math.max(s.shotsFired, s.shotsHit);
          if (effShots < 3 || s.shotsHit < 2) return null;
          const pct = clamp(Math.round((s.shotsHit / effShots) * 100), 1, 100);
          const soaked = s.eliminations;
          const tail = soaked > 0
            ? `${soaked} ${soaked === 1 ? 'Spirit' : 'Spirits'} soaked`
            : `${s.shotsHit} splash hits landed`;
          return {
            norm: (pct / 58) + (soaked * 0.36) + (s.isYou ? 0.14 : 0),
            desc: `${pct}% splash accuracy · ${tail}`,
          };
        },
      },
      // 4. Master Trickster (decoyTricks)
      {
        key: 'trickster',
        domain: 'hide',
        icon: '🫧',
        title: 'Master Trickster',
        evalActor(s) {
          if (s.decoyTricks < 1) return null;
          const n = Math.max(1, Math.round(s.decoyTricks));
          return {
            norm: (n / 1.4) + (s.isYou ? 0.14 : 0),
            desc: `Bamboozled Seekers with ${n} Decoy ${n === 1 ? 'Clone' : 'Clones'}`,
          };
        },
      },
      // 5. Daredevil Spirit (closeTaunts / taunts)
      {
        key: 'daredevil',
        domain: 'hide',
        icon: '🔔',
        title: 'Daredevil Spirit',
        evalActor(s) {
          const raw = s.closeTaunts * 2 + s.taunts;
          if (raw < 1) return null;
          const closeN = Math.round(s.closeTaunts);
          const totalN = Math.max(closeN, Math.round(s.taunts), 1);
          const desc = closeN > 0
            ? `Whistled ${closeN} ${closeN === 1 ? 'time' : 'times'} right under Seekers' noses`
            : `Whistled ${totalN} ${totalN === 1 ? 'time' : 'times'} to taunt the Seekers`;
          return {
            norm: (raw / 2.2) + (s.isYou ? 0.14 : 0),
            desc,
          };
        },
      },
      // 6. Master Splasher (eliminations)
      {
        key: 'master_splasher',
        domain: 'seek',
        icon: '💦',
        title: 'Master Splasher',
        evalActor(s) {
          if (s.eliminations < 1) return null;
          const n = Math.max(1, Math.round(s.eliminations));
          return {
            norm: (n / 1.65) + (s.isYou ? 0.14 : 0),
            desc: `Tracked down & soaked ${n} ${n === 1 ? 'Spirit' : 'Spirits'}`,
          };
        },
      },
      // 7. Bold Big-Prop (bigPropSec)
      {
        key: 'big_prop',
        domain: 'hide',
        icon: '🛢️',
        title: 'Bold Big-Prop',
        evalActor(s) {
          if (s.bigPropSec < 3.0) return null;
          const secs = Math.max(3, Math.round(s.bigPropSec));
          return {
            norm: (secs / 20) + (s.isYou ? 0.14 : 0),
            desc: `Survived ${secs} seconds disguised as oversized props`,
          };
        },
      },
    ];

    const chosen = [];
    const usedKeys = new Set();
    const usedActors = new Set();
    const actorDomains = new Map();

    // Pass 1: Greedily pick up to 3 top achievements across distinct categories AND distinct players
    while (chosen.length < 3) {
      let bestPick = null;
      for (const spec of categorySpecs) {
        if (usedKeys.has(spec.key)) continue;
        for (const st of pool) {
          if (usedActors.has(st.actorId)) continue;
          const res = spec.evalActor(st);
          if (!res) continue;
          const tieBreak = res.norm + (st.isYou ? 0.001 : 0);
          if (!bestPick || tieBreak > bestPick.score) {
            bestPick = { spec, st, res, score: tieBreak };
          }
        }
      }
      if (!bestPick) break;
      usedKeys.add(bestPick.spec.key);
      usedActors.add(bestPick.st.actorId);
      actorDomains.set(bestPick.st.actorId, bestPick.spec.domain);
      chosen.push({
        icon: bestPick.spec.icon,
        title: bestPick.spec.title,
        playerName: bestPick.st.name,
        isYou: !!bestPick.st.isYou,
        desc: bestPick.res.desc,
      });
    }

    // Pass 2: If fewer than 3 distinct players met thresholds, allow repeat player on distinct category
    while (chosen.length < 3) {
      let bestPick = null;
      for (const spec of categorySpecs) {
        if (usedKeys.has(spec.key)) continue;
        for (const st of pool) {
          const res = spec.evalActor(st);
          if (!res) continue;
          const sameDomainPenalty = actorDomains.get(st.actorId) === spec.domain ? 0.45 : 0;
          const score = res.norm - sameDomainPenalty + (st.isYou ? 0.001 : 0);
          if (!bestPick || score > bestPick.score) {
            bestPick = { spec, st, res, score };
          }
        }
      }
      if (!bestPick) break;
      usedKeys.add(bestPick.spec.key);
      usedActors.add(bestPick.st.actorId);
      chosen.push({
        icon: bestPick.spec.icon,
        title: bestPick.spec.title,
        playerName: bestPick.st.name,
        isYou: !!bestPick.st.isYou,
        desc: bestPick.res.desc,
      });
    }

    // Pass 3: Guaranteed graceful fallbacks so 3 authentic cards ALWAYS render (even in short test rounds!)
    const pickFallbackActor = (scoreFn) => {
      const sorted = [...pool].sort((a, b) => {
        const diff = scoreFn(b) - scoreFn(a);
        if (Math.abs(diff) > 1e-6) return diff;
        if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return sorted.find((s) => !usedActors.has(s.actorId)) || sorted[0];
    };

    const worldName = env.getWorldTitle?.() || 'the village';

    if (chosen.length < 3 && !usedKeys.has('master_splasher')) {
      const p = pickFallbackActor((s) => s.eliminations * 100 + s.shotsHit * 10 + s.shotsFired);
      if (p) {
        usedKeys.add('master_splasher');
        usedActors.add(p.actorId);
        const desc = p.eliminations > 0
          ? `Tracked down & soaked ${p.eliminations} ${p.eliminations === 1 ? 'Spirit' : 'Spirits'}`
          : (p.shotsHit > 0
            ? `Pressured hiding Spirits with ${p.shotsHit} direct splash ${p.shotsHit === 1 ? 'hit' : 'hits'}`
            : `Spearheaded the Seeker patrol across ${worldName}`);
        chosen.push({
          icon: '💦',
          title: 'Master Splasher',
          playerName: p.name,
          isYou: !!p.isYou,
          desc,
        });
      }
    }

    if (chosen.length < 3 && !usedKeys.has('longest_survivor')) {
      const p = pickFallbackActor((s) => s.survivedSec * 10 + s.frenzySurvivedSec * 5 + s.disguisedSec);
      if (p) {
        usedKeys.add('longest_survivor');
        usedActors.add(p.actorId);
        const secs = Math.round(p.survivedSec);
        const desc = secs >= 2
          ? `Outlasted the Seeker squad for ${secs} seconds`
          : `Stayed cool & slippery among the props of ${worldName}`;
        chosen.push({
          icon: '🌿',
          title: 'Unseen Survivor',
          playerName: p.name,
          isYou: !!p.isYou,
          desc,
        });
      }
    }

    if (chosen.length < 3 && !usedKeys.has('plain_sight')) {
      const p = pickFallbackActor((s) => s.closeSeekSec * 20 + s.bigPropSec * 5 + s.disguisedSec + (s.isYou ? 1 : 0));
      if (p) {
        usedKeys.add('plain_sight');
        usedActors.add(p.actorId);
        const secs = Math.round(p.closeSeekSec);
        const desc = secs >= 1
          ? `Stood within 3.5m of Seekers for ${secs} ${secs === 1 ? 'second' : 'seconds'}`
          : `Blended seamlessly right in the heart of ${worldName}`;
        chosen.push({
          icon: '🫣',
          title: 'Hidden in Plain Sight',
          playerName: p.name,
          isYou: !!p.isYou,
          desc,
        });
      }
    }

    if (chosen.length < 3) {
      const p = pickFallbackActor((s) => s.bigPropSec + s.shotsFired + s.damageTaken);
      if (p) {
        usedActors.add(p.actorId);
        chosen.push({
          icon: '🛢️',
          title: 'Bold Big-Prop',
          playerName: p.name,
          isYou: !!p.isYou,
          desc: p.bigPropSec >= 1
            ? `Survived ${Math.round(p.bigPropSec)}s disguised as oversized props`
            : `Held fearless positioning under Seeker pressure`,
        });
      }
    }

    return chosen.slice(0, 3);
  }

  // How much one player contributed across both rounds (used only to rank the ten players for the "Your game" card).
  function personalScore(st) {
    if (!st) return 0;
    // surviving a whole 110s hunt (~300) is worth about as much as soaking two or three spirits
    return (st.eliminations || 0) * 120 +
      (st.survivedSec || 0) * 2.7 +
      (st.paintPots || 0) * HUE_RULES.POT_POINTS +
      (st.haunts || 0) * HUE_RULES.HAUNT_POINTS +
      (st.decoyTricks || 0) * 20 +
      (st.closeTaunts || 0) * 20 +
      (st.chasesEscaped || 0) * 25 +
      (st.smokeEscapes || 0) * 15;
  }

  /** Everything the results screen says about the local player — their own numbers, nobody else's. */
  function buildYourGameSummary() {
    syncLiveActorsIntoStats();
    const me = statsByActorId.get(localActorId) || [...statsByActorId.values()].find((s) => s.isYou) || null;
    if (!me) return null;
    const pool = [...statsByActorId.values()];
    const myScore = personalScore(me);
    const rank = 1 + pool.filter((s) => s !== me && personalScore(s) > myScore).length;
    const total = Math.max(pool.length, 10);
    const sec = Math.round(me.survivedSec || 0);
    const acc = (me.shotsFired || 0) > 0 ? Math.round(clamp((me.shotsHit || 0) / me.shotsFired, 0, 1) * 100) : null;
    const stats = [
      { label: 'Spirits soaked', value: String(me.eliminations || 0) },
      { label: 'Time unseen', value: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` },
      { label: 'Paint pots', value: String(me.paintPots || 0) },
      { label: 'Repaints', value: String(me.repaints || 0) },
      { label: 'Ghost haunts', value: String(me.haunts || 0) },
      { label: 'Seekers fooled', value: String((me.decoyTricks || 0) + (me.chasesEscaped || 0) + (me.smokeEscapes || 0)) },
    ];
    if (acc != null) stats.push({ label: 'Spray accuracy', value: `${acc}%` });

    const bits = [];
    if ((me.eliminations || 0) >= 3) bits.push(`You soaked ${me.eliminations} spirits — the squad's hunter.`);
    else if ((me.eliminations || 0) > 0) bits.push(`You soaked ${me.eliminations} spirit${me.eliminations === 1 ? '' : 's'}.`);
    if (sec >= 100) bits.push('You stayed unseen for the whole hunt.');
    else if (sec >= 45) bits.push(`You stayed unseen for ${sec} seconds.`);
    else if (sec > 0) bits.push(`You were found after ${sec} seconds — try repainting when no seeker is looking.`);
    if ((me.paintPots || 0) > 0) bits.push(`${me.paintPots} Paint Pot${me.paintPots === 1 ? '' : 's'} = +${Math.min(HUE_RULES.POT_POINTS_CAP, me.paintPots * HUE_RULES.POT_POINTS)} squad points.`);
    if ((me.haunts || 0) > 0) bits.push(`Your ghost pulled seekers away ${me.haunts} time${me.haunts === 1 ? '' : 's'}.`);
    if (!bits.length) bits.push('Quiet one. Grab Paint Pots and keep your paint fresh to climb the board.');
    return { rank, total, score: Math.round(myScore), stats, line: bits.slice(0, 3).join(' '), name: me.name };
  }

  function renderYourGameCard() {
    const box = $('yourGameBox');
    if (!box) return;
    const sum = buildYourGameSummary();
    if (!sum) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML =
      `<div class="yg-head"><b>Your game</b><span class="yg-rank">#${sum.rank} of ${sum.total} players</span></div>` +
      `<p class="yg-line">${escHtml(sum.line)}</p>` +
      `<div class="yg-grid">` +
        sum.stats.map((x) => `<div class="yg-stat"><b>${escHtml(x.value)}</b><span>${escHtml(x.label)}</span></div>`).join('') +
      `</div>`;
  }

  function renderFinalSeriesResult(mvpCards, seriesWon, seriesDraw) {
    if (!hasDOM) return;
    mountUI();

    const hf = $('halftimeScreen');
    if (hf) hf.classList.remove('on');
    const specBar = $('specBar');
    if (specBar) specBar.classList.add('hidden');
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }

    const rEmoji = $('rEmoji');
    const rTitle = $('rTitle');
    const rSub = $('rSub');

    if (seriesWon) {
      if (rEmoji) rEmoji.textContent = '🏆';
      if (rTitle) rTitle.textContent = '🏆 5v5 SERIES VICTORY!';
    } else if (seriesDraw) {
      if (rEmoji) rEmoji.textContent = '⚔️';
      if (rTitle) rTitle.textContent = '⚔️ CLUTCH DRAW!';
    } else {
      if (rEmoji) rEmoji.textContent = '💦';
      if (rTitle) rTitle.textContent = '💦 RIVAL SQUAD TAKES THE SERIES!';
    }

    const worldTitle = env.getWorldTitle?.() || 'Meadowbrook Village';
    const margin = Math.abs(yourSquadScore - rivalSquadScore);
    if (rSub) {
      rSub.textContent = seriesDraw
        ? `2-Round 5v5 Series tied at ${yourSquadScore}–${rivalSquadScore} in ${worldTitle}!`
        : `${seriesWon ? 'Your Squad won' : 'Rival Squad edged'} the 2-Round Series by ${margin} pts in ${worldTitle}!`;
    }

    const sbBox = $('seriesScoreboardBox');
    if (sbBox) {
      const r1 = roundHistory[0];
      const r2 = roundHistory[1];
      sbBox.classList.remove('hidden');
      sbBox.innerHTML =
        `<div class="series-sb-main">` +
          `<div class="series-sb-team yours${seriesWon ? ' winner' : ''}">` +
            `<span class="series-sb-pill sage">YOUR SQUAD</span>` +
            `<b class="series-sb-pts">${yourSquadScore}</b>` +
          `</div>` +
          `<span class="series-sb-vs">FINAL</span>` +
          `<div class="series-sb-team rival${!seriesWon && !seriesDraw ? ' winner' : ''}">` +
            `<span class="series-sb-pill sky">RIVAL SQUAD</span>` +
            `<b class="series-sb-pts">${rivalSquadScore}</b>` +
          `</div>` +
        `</div>` +
        `<div class="series-sb-rounds">` +
          (r1 ? `<span class="series-rd-pill">RD 1: <b>${r1.yourPts}–${r1.rivalPts}</b></span>` : '') +
          (r2 ? `<span class="series-rd-pill">RD 2: <b>${r2.yourPts}–${r2.rivalPts}</b></span>` : '') +
        `</div>`;
    }

    const mvpWrap = $('mvpSectionWrap');
    const mvpRow = $('mvpAwardsRow');
    if (mvpWrap && mvpRow) {
      mvpWrap.classList.remove('hidden');
      mvpRow.innerHTML = mvpCards.map((c) => (
        `<div class="mvp-card${c.isYou ? ' is-you' : ''}">` +
          `<span class="mvp-badge">★ MVP AWARD</span>` +
          `<div class="mvp-icon" aria-hidden="true">${c.icon}</div>` +
          `<div class="mvp-body">` +
            `<div class="mvp-title">${escHtml(c.title)}</div>` +
            `<div class="mvp-player">` +
              `<span>${escHtml(c.playerName)}</span>` +
              (c.isYou ? `<b class="mvp-you-tag">YOU</b>` : '') +
            `</div>` +
            `<p class="mvp-desc">${escHtml(c.desc)}</p>` +
          `</div>` +
        `</div>`
      )).join('');
    }

    renderYourGameCard();

    resultShareActive = true;
    mountResultHighlightShareBox();

    const resScreen = $('result');
    if (resScreen) resScreen.classList.add('on');
  }

  // --------------------------------------------------------------------------
  // Round End Orchestrator (Round 1 -> Halftime · Round 2 -> Series Finale)
  // --------------------------------------------------------------------------
  function handleRoundEnd(arg0 = {}, titleArg, subArg, emojiArg, fromNetArg) {
    const payload = typeof arg0 === 'boolean'
      ? { win: arg0, title: titleArg, sub: subArg, emoji: emojiArg, fromNet: fromNetArg }
      : (arg0 || {});

    ensureSeriesInitialized();

    if (roundScored) {
      return {
        isHalftime: halftimeActive,
        seriesOver: seriesOver,
      };
    }
    roundScored = true;

    const pts = peekedRoundPts || computeCurrentRoundPoints();
    peekedRoundPts = null;
    yourSquadScore += pts.yourPts;
    rivalSquadScore += pts.rivalPts;
    roundHistory.push({
      round: roundNumber,
      ...pts,
    });

    if (roundNumber === 1) {
      pendingSwappedRoster = swapRosterSides(activeRoster || synthesizeRosterFromG());
      halftimeActive = true;
      halftimeStartedMs = getNow();

      const rd1Won = pts.yourPts > pts.rivalPts;
      env.awardTokens?.(
        rd1Won ? 'round1_win' : 'round1_done',
        rd1Won ? 10 : 5,
        rd1Won ? '⚡ Round 1 Lead! +10 🪙' : '🔄 Halftime Side Swap! +5 🪙',
        rd1Won ? 35 : 15
      );

      renderHalftimeOverlay(payload, pts, pendingSwappedRoster);
      playHalftimeStinger();

      if (hasDOM) {
        const hfDur = resolveHalftimeDurationSec();
        halftimeDurActiveSec = hfDur;
        const updateCountdown = () => {
          if (!halftimeActive) return;
          const elapsed = Math.max(0, (getNow() - halftimeStartedMs) / 1000);
          const rem = Math.max(0, halftimeDurActiveSec - elapsed);
          const lbl = $('halftimeCountdownTxt');
          if (lbl) lbl.textContent = halftimeWaitingForClip ? 'Getting your clip ready — round 2 starts right after…' : `Round 2 begins in ${rem.toFixed(1)}s…`;
        };
        updateCountdown();
        halftimeTick = setInterval(updateCountdown, 100);
        halftimeTimer = setTimeout(() => {
          skipHalftimeNow();
        }, Math.round(hfDur * 1000));
      }

      return { isHalftime: true, seriesOver: false };
    }

    // Round 2 Complete -> Crown Overall 5v5 Series Winner + MVP Awards + Spirit Tokens!
    seriesOver = true;
    halftimeActive = false;
    updateHudBadge();

    const seriesWon = yourSquadScore > rivalSquadScore;
    const seriesDraw = yourSquadScore === rivalSquadScore;
    const mvpCards = computeMvpCards();

    renderFinalSeriesResult(mvpCards, seriesWon, seriesDraw);

    const myStat = statsByActorId.get(localActorId)
      || [...statsByActorId.values()].find((s) => s.isYou)
      || null;
    if (typeof env.onSeriesFinished === 'function') {
      env.onSeriesFinished({
        won: seriesWon,
        draw: seriesDraw,
        eliminations: myStat ? (myStat.eliminations || 0) : 0,
        survivedSec: myStat ? (myStat.survivedSec || 0) : 0,
      });
    } else {
      env.awardTokens?.(
        'series_finish',
        seriesWon ? 55 : 30,
        seriesWon ? '🏆 5v5 Series Victory! +55 🪙' : '👏 5v5 Match Complete! +30 🪙'
      );
    }

    if (!payload.cinematicPlayed) {
      if (seriesWon || seriesDraw) env.audio?.win?.();
      else env.audio?.lose?.();
    }

    clearChimeTimers();
    if (hasDOM) {
      mvpCards.forEach((_, idx) => {
        chimeTimers.push(setTimeout(() => playMvpCardChime(idx), 120 + idx * 150));
      });
    } else {
      playMvpCardChime(0);
    }

    return { isHalftime: false, seriesOver: true };
  }

  function markActorBotTakeover(leftActorId, newMasterId = null) {
    if (!leftActorId) return;
    const patchRoster = (r) => {
      if (!r) return;
      for (const s of [...(r.hiders || []), ...(r.seekers || [])]) {
        if (s && s.actorId === leftActorId) s.isBot = true;
      }
      const humans = [...(r.hiders || []), ...(r.seekers || [])].filter((p) => p && !p.isBot).length;
      r.humanCount = humans;
      r.isLiveRoom = humans >= 2;
      r.hasHumanHiders = (r.hiders || []).some((p) => p && !p.isBot);
      r.hasHumanSeekers = (r.seekers || []).some((p) => p && !p.isBot);
      if (newMasterId) r.masterActorId = newMasterId;
    };
    patchRoster(activeRoster);
    patchRoster(pendingSwappedRoster);
    const startBtn = hasDOM ? $('btnHalftimeStart') : null;
    if (startBtn && halftimeActive && pendingSwappedRoster && !pendingSwappedRoster.isLiveRoom) {
      startBtn.style.display = '';
    }
  }

  return {
    mountUI,
    startSeries,
    swapRosterSides,
    cancelHalftime,
    resetSeries,
    updateTelemetry,
    recordStat,
    onSeekerShot,
    onHiderHit,
    handleRoundEnd,
    onRoundFinished: handleRoundEnd,
    skipHalftimeNow,
    markActorBotTakeover,
    getRoundNumber: () => roundNumber,
    // Result of the series if the current (final) round ended now, without scoring it; the same points
    // are then used by handleRoundEnd, so the cinematic and the stats screen can never disagree.
    peekSeriesOutcome: () => {
      if (roundNumber !== 2 || roundScored) return null;
      ensureSeriesInitialized();
      if (!peekedRoundPts) peekedRoundPts = computeCurrentRoundPoints();
      const you = yourSquadScore + peekedRoundPts.yourPts, rival = rivalSquadScore + peekedRoundPts.rivalPts;
      return { won: you > rival, draw: you === rival, yourScore: you, rivalScore: rival };
    },
    getSeriesState: () => ({ roundNumber, yourSquadScore, rivalSquadScore }),
    computeMvpCards,
    computeCurrentRoundPoints,
    buildYourGameSummary,
    renderResultHighlightShare: mountResultHighlightShareBox,
  };
}
