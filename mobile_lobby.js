/* ==========================================================================
 * Hue & Seek — Supercell / Apple-Arcade Grade Storybook Mobile Lobby
 * & Widescreen Landscape Modal Manager (mobile_lobby.js)
 *
 * Responsibilities:
 *   1. Mounts `#mobLobbyShell` inside `#title` while keeping all native DOM
 *      controls (`#mapGrid`, `#playerNameInput`, `#btnRollName`, `#spiritBar`,
 *      `#btnHide`, `#btnSeek`, `#progStrip`) intact for `main.js` & `progression.js`.
 *   2. Mounts `#mobWorldModal` (3x2 Storybook World Gallery), `#mobProfileModal`
 *      (Gamertag & 7-Spirit Picker), `#mobMapTransition` (Sunlit Map Veil),
 *      and `#mobRotateGuard` inside `#app`.
 *   3. Zero-overhead event-driven 2-way sync (0.00ms/frame idle cost) via
 *      `rafPending`-coalesced `MutationObserver` & discrete user events.
 *   4. Two-frame `requestAnimationFrame` deferred map switching so modal close
 *      and `#mobMapTransition` paint cleanly at 60 FPS before 3D map rebuild.
 * ========================================================================== */

const FALLBACK_WORLDS = [
  {
    id: 'meadow',
    name: 'Meadowbrook',
    badge: 'Cosy Village',
    thumb: 'assets/concepts/map_overview.webp',
  },
  {
    id: 'bathhouse',
    name: 'Yu-Machi Bathhouse',
    badge: 'Spirit Bathhouse',
    thumb: 'assets/maps/bathhouse/overview.webp',
    reqLevel: 2,
  },
  {
    id: 'seaplane',
    name: 'Porto Sereno Cove',
    badge: 'Adriatic Cove',
    thumb: 'assets/maps/seaplane/overview.webp',
    reqLevel: 4,
  },
  {
    id: 'skyruins',
    name: 'Celestia Sky-Ruins',
    badge: 'Floating Island',
    thumb: 'assets/maps/skyruins/overview.webp',
    reqLevel: 7,
  },
  {
    id: 'clockwork',
    name: 'Pendulum Square',
    badge: 'Steam & Magic',
    thumb: 'assets/maps/clockwork/overview.webp',
    reqLevel: 10,
  },
  {
    id: 'tinyfolk',
    name: "Tinyfolk Hollow",
    badge: 'Tiny World',
    thumb: 'assets/maps/tinyfolk/overview.webp',
    reqLevel: 13,
  },
];

const FALLBACK_SPIRITS = [
  { id: 'auto', icon: '✨', label: '✨ World Spirit' },
  { id: 'meadow', icon: '🌱', label: '🌱 Sprout' },
  { id: 'bathhouse', icon: '🏮', label: '🏮 Suds-Star' },
  { id: 'skyruins', icon: '💎', label: '💎 Sky-Crystal' },
  { id: 'seaplane', icon: '⚓', label: '⚓ Seafoam' },
  { id: 'clockwork', icon: '🔥', label: '🔥 Ember-Star' },
  { id: 'tinyfolk', icon: '🍀', label: '🍀 Clover-Dew' },
];

function extractLeadingEmoji(label, fallback = '✨') {
  const trimmed = String(label || '').trim();
  if (!trimmed) return fallback;
  const firstToken = trimmed.split(/\s+/)[0];
  if (firstToken && !/^[A-Za-z0-9]+$/.test(firstToken)) {
    return firstToken;
  }
  return fallback;
}

function normalizeLevelLabel(rawText) {
  const txt = String(rawText || '').trim();
  if (!txt) return 'Lv. 1';
  const match = txt.match(/Lv\.?\s*\d+/i);
  if (match) {
    const num = match[0].replace(/[^0-9]/g, '');
    return `Lv. ${num || '1'}`;
  }
  if (/^\d+$/.test(txt)) {
    return `Lv. ${txt}`;
  }
  return txt;
}

export function createMobileLobbyManager(env = {}) {
  let mounted = false;
  let listenersBound = false;
  let sawTouchInput = false;
  let orientationLockedOnce = false;
  let tokenBumpTimer = null;

  let rafPending = false;
  let mapSwitchRaf1 = 0;
  let mapSwitchRaf2 = 0;
  let mapSwitchPostRaf = 0;
  let pendingMapTargetId = null;

  let shellEl = null;
  let worldModalEl = null;
  let profileModalEl = null;
  let partyModalEl = null;
  let mapTransitionEl = null;
  let rotateGuardEl = null;

  let renderedWorldSig = '';
  let renderedSpiritSig = '';
  let renderedPartySig = '';
  let lastTokenStr = null;

  let boundMpRef = null;
  let unbindPartyListener = null;
  let partyToastTimer = null;

  let domObserver = null;
  const observedNodes = typeof WeakSet === 'function' ? new WeakSet() : null;

  function escHtml(raw) {
    return String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resolveMP() {
    let mp = null;
    try {
      if (typeof env.getMP === 'function') mp = env.getMP();
      if (!mp && env.MP) mp = env.MP;
      if (!mp && typeof window !== 'undefined' && window.__hs?.MP) mp = window.__hs.MP;
    } catch (_) {
      mp = null;
    }
    if (mp && mp !== boundMpRef) {
      if (typeof unbindPartyListener === 'function') {
        try { unbindPartyListener(); } catch (_) { /* ignore */ }
        unbindPartyListener = null;
      }
      boundMpRef = mp;
      if (typeof mp.onPartyChange === 'function') {
        unbindPartyListener = mp.onPartyChange(() => {
          scheduleRefresh();
        });
      }
    }
    return mp;
  }

  function haptic(kind = 'light') {
    try {
      const capHaptics =
        typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Haptics : null;
      if (capHaptics?.impact) {
        const style = kind === 'medium' ? 'MEDIUM' : 'LIGHT';
        const p = capHaptics.impact({ style });
        if (p && typeof p.catch === 'function') p.catch(() => {});
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(kind === 'medium' ? 18 : 10);
      }
    } catch (_) {
      // Safe no-op when haptics are unavailable
    }
  }

  function ensureStylesheetLinked() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.querySelector?.('link[href*="mobile_lobby.css"]')) return;
    if (
      typeof document.createElement !== 'function' ||
      typeof document.head.appendChild !== 'function'
    ) {
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'mobile_lobby.css?v=5';
    document.head.appendChild(link);
  }

  function detectHardwareMobile() {
    try {
      if (typeof window !== 'undefined' && window.__FORCE_MOBILE_HUD === true) {
        return true;
      }
      if (typeof env.isMobileOverride === 'function' && env.isMobileOverride() === true) {
        return true;
      }
      if (typeof window !== 'undefined' && window.Capacitor) {
        return true;
      }
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches
      ) {
        return true;
      }
      if (typeof window !== 'undefined') {
        const minSide = Math.min(
          Number(window.innerWidth) || 9999,
          Number(window.innerHeight) || 9999
        );
        const touchPts =
          typeof navigator !== 'undefined' ? Number(navigator.maxTouchPoints) || 0 : 0;
        if ((touchPts > 0 || sawTouchInput) && minSide <= 920) {
          return true;
        }
      }
    } catch (_) {
      // Safe fallback for non-browser test runners
    }
    return false;
  }

  function isMobileTouchActive() {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    if (document.documentElement.classList.contains('is-mobile-touch')) {
      return true;
    }
    if (detectHardwareMobile()) {
      document.documentElement.classList.add('is-mobile-touch');
      return true;
    }
    return false;
  }

  function tryLockLandscape() {
    if (!isMobileTouchActive()) return;
    try {
      if (typeof screen !== 'undefined') {
        screen.orientation?.lock?.('landscape')?.catch?.(() => {});
      }
      orientationLockedOnce = true;
    } catch (_) {
      // Mobile browsers without Fullscreen/WebAPK orientation lock fall back to #mobRotateGuard
    }
  }

  /**
   * Delegates a tap to native game controls cleanly:
   * - `main.js` binds `pointerdown` (`onTap`) on `#btnHide`, `#btnSeek`, `#btnMute`,
   *   `#btnRollName`, `.map-card`, and `.sp-pill`.
   * - `progression.js` binds `click` on `#btnOpenWardrobe`.
   * Firing `pointerdown` + `pointerup` + `.click()` triggers each native handler once.
   */
  function triggerNativeTap(targetEl) {
    if (!targetEl) return false;
    try {
      if (typeof PointerEvent === 'function') {
        targetEl.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: 1,
          })
        );
        targetEl.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: 0,
          })
        );
      }
    } catch (_) {
      // Ignore synthetic PointerEvent constructor issues in minimal mocks
    }
    if (typeof targetEl.click === 'function') {
      targetEl.click();
    }
    return true;
  }

  function bindLogoFallback(imgEl, fallbackEl) {
    if (!imgEl || !fallbackEl) return;
    const showFallback = () => {
      imgEl.classList.add('hidden');
      fallbackEl.classList.remove('hidden');
    };
    const showImage = () => {
      if (imgEl.naturalWidth > 0) {
        imgEl.classList.remove('hidden');
        fallbackEl.classList.add('hidden');
      }
    };
    imgEl.addEventListener('error', showFallback);
    imgEl.addEventListener('load', showImage);
    if (imgEl.complete) {
      if (imgEl.naturalWidth === 0) {
        showFallback();
      } else {
        showImage();
      }
    }
  }

  function readWorldsFromDOM() {
    const mapGrid = document.getElementById('mapGrid');
    const cards = mapGrid ? Array.from(mapGrid.querySelectorAll('.map-card')) : [];
    if (!cards.length) {
      return FALLBACK_WORLDS.map((w, idx) => ({
        ...w,
        reqLevel: w.reqLevel || 1,
        locked: false,
        active: pendingMapTargetId ? w.id === pendingMapTargetId : idx === 0,
      }));
    }
    return cards.map((card, idx) => {
      const id = card.dataset?.map || FALLBACK_WORLDS[idx]?.id || `world_${idx}`;
      const fb = FALLBACK_WORLDS.find((item) => item.id === id) || FALLBACK_WORLDS[0];
      const name =
        card.querySelector('.map-name')?.textContent?.trim() || fb.name || id;
      const badge =
        card.querySelector('.map-badge')?.textContent?.trim() ||
        fb.badge ||
        'Storybook World';
      const img = card.querySelector('img');
      const thumb = img?.getAttribute('src') || fb.thumb;
      const locked = card.classList.contains('is-locked');
      const reqLevel = Number(card.dataset?.reqLevel) || fb.reqLevel || 1;
      const active = pendingMapTargetId
        ? id === pendingMapTargetId
        : card.classList.contains('active');
      return { id, name, badge, thumb, locked, reqLevel, active };
    });
  }

  function readSpiritsFromDOM() {
    const spiritBar = document.getElementById('spiritBar');
    const pills = spiritBar ? Array.from(spiritBar.querySelectorAll('.sp-pill')) : [];
    if (!pills.length) {
      return FALLBACK_SPIRITS.map((sp, idx) => ({
        ...sp,
        active: idx === 0,
      }));
    }
    return pills.map((pill, idx) => {
      const id = pill.dataset?.spirit || FALLBACK_SPIRITS[idx]?.id || `sp_${idx}`;
      const fb = FALLBACK_SPIRITS.find((item) => item.id === id);
      const label = (pill.textContent || '').trim() || fb?.label || id;
      const icon = extractLeadingEmoji(label, fb?.icon || '✨');
      const active = pill.classList.contains('active');
      return { id, icon, label, active };
    });
  }

  function syncRotateGuard() {
    if (!rotateGuardEl || typeof window === 'undefined') return;
    const disabled = Boolean(window.__DISABLE_ROTATE_GUARD);
    if (disabled) {
      rotateGuardEl.setAttribute('data-guard-disabled', '1');
      rotateGuardEl.classList.remove('on');
      rotateGuardEl.setAttribute('aria-hidden', 'true');
      return;
    }
    rotateGuardEl.removeAttribute('data-guard-disabled');

    const w = Number(window.innerWidth) || 0;
    const h = Number(window.innerHeight) || 0;
    const isPortrait = w > 0 && h > w * 1.05;
    const shouldShow = isMobileTouchActive() && isPortrait;

    rotateGuardEl.classList.toggle('on', shouldShow);
    rotateGuardEl.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  }

  function syncResultMvpLayoutClass() {
    if (typeof document === 'undefined') return;
    const resultCard = document.querySelector('#result .card');
    if (!resultCard) return;

    const mvpSec = document.getElementById('mvpSectionWrap');
    const mvpAlt = document.getElementById('mvpHighlightsWrap');

    const hasMvpSec = Boolean(
      mvpSec &&
        !mvpSec.classList.contains('hidden') &&
        mvpSec.children &&
        mvpSec.children.length > 0
    );
    const hasMvpAlt = Boolean(
      mvpAlt &&
        !mvpAlt.classList.contains('hidden') &&
        mvpAlt.children &&
        mvpAlt.children.length > 0
    );

    resultCard.classList.toggle('has-mvp-grid', hasMvpSec || hasMvpAlt);
  }

  function syncWorldGalleryDOM(worlds) {
    const grid = document.getElementById('mobWorldModalGrid');
    if (!grid) return;

    const sig = worlds.map((w) => `${w.id}:${w.name}:${w.badge}:${w.thumb}:${w.locked ? 1 : 0}:${w.reqLevel || 1}`).join('|');
    if (sig !== renderedWorldSig) {
      renderedWorldSig = sig;
      grid.innerHTML = '';
      for (const w of worlds) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `mob-wcard${w.active ? ' active' : ''}${w.locked ? ' is-locked' : ''}`;
        btn.dataset.map = w.id;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', w.active ? 'true' : 'false');

        const art = document.createElement('div');
        art.className = 'mob-wcard-art';

        const img = document.createElement('img');
        img.src = w.thumb;
        img.alt = w.name;
        img.loading = 'eager';
        img.decoding = 'async';

        const badge = document.createElement('span');
        badge.className = 'mob-wcard-badge';
        badge.textContent = w.badge;

        const check = document.createElement('span');
        check.className = `mob-wcard-check${w.active && !w.locked ? '' : ' hidden'}`;
        check.textContent = '✓ Selected';

        const lockPill = document.createElement('span');
        lockPill.className = `mob-wcard-lock${w.locked ? '' : ' hidden'}`;
        lockPill.textContent = `🔒 Lv. ${w.reqLevel || 1}`;

        art.appendChild(img);
        art.appendChild(badge);
        art.appendChild(check);
        art.appendChild(lockPill);

        const foot = document.createElement('div');
        foot.className = 'mob-wcard-foot';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'mob-wcard-name';
        nameSpan.textContent = w.name;
        foot.appendChild(nameSpan);

        btn.appendChild(art);
        btn.appendChild(foot);
        grid.appendChild(btn);
      }
      return;
    }

    const cards = grid.querySelectorAll('.mob-wcard');
    cards.forEach((btn) => {
      const match = worlds.find((w) => w.id === btn.dataset.map);
      const isAct = Boolean(match?.active);
      const isLocked = Boolean(match?.locked);
      btn.classList.toggle('active', isAct);
      btn.classList.toggle('is-locked', isLocked);
      btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
      const check = btn.querySelector('.mob-wcard-check');
      if (check) check.classList.toggle('hidden', !isAct || isLocked);
      const lockPill = btn.querySelector('.mob-wcard-lock');
      if (lockPill) {
        lockPill.textContent = `🔒 Lv. ${match?.reqLevel || 1}`;
        lockPill.classList.toggle('hidden', !isLocked);
      }
    });
  }

  function syncSpiritGridDOM(spirits) {
    const grid = document.getElementById('mobSpiritGrid');
    if (!grid) return;

    const sig = spirits.map((s) => `${s.id}:${s.label}`).join('|');
    if (sig !== renderedSpiritSig) {
      renderedSpiritSig = sig;
      grid.innerHTML = '';
      for (const sp of spirits) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `mob-sp-choice${sp.active ? ' active' : ''}`;
        btn.dataset.spirit = sp.id;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', sp.active ? 'true' : 'false');
        btn.textContent = sp.label;
        grid.appendChild(btn);
      }
      return;
    }

    const buttons = grid.querySelectorAll('.mob-sp-choice');
    buttons.forEach((btn) => {
      const match = spirits.find((s) => s.id === btn.dataset.spirit);
      const isAct = Boolean(match?.active);
      btn.classList.toggle('active', isAct);
      btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
  }

  function cancelPendingMapFrames() {
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      if (mapSwitchRaf1) window.cancelAnimationFrame(mapSwitchRaf1);
      if (mapSwitchRaf2) window.cancelAnimationFrame(mapSwitchRaf2);
      if (mapSwitchPostRaf) window.cancelAnimationFrame(mapSwitchPostRaf);
    }
    mapSwitchRaf1 = 0;
    mapSwitchRaf2 = 0;
    mapSwitchPostRaf = 0;
  }

  function showMapTransition(worldName) {
    if (!mapTransitionEl) return;
    const txtEl = document.getElementById('mobMapTransitionTxt');
    if (txtEl) {
      txtEl.textContent = `Loading ${worldName || 'Storybook World'}…`;
    }
    mapTransitionEl.classList.add('on');
    mapTransitionEl.setAttribute('aria-hidden', 'false');
  }

  function hideMapTransition() {
    if (!mapTransitionEl) return;
    mapTransitionEl.classList.remove('on');
    mapTransitionEl.setAttribute('aria-hidden', 'true');
  }

  function flushPendingMapSwitchSync() {
    if (!pendingMapTargetId) return;
    const targetId = pendingMapTargetId;
    pendingMapTargetId = null;
    cancelPendingMapFrames();
    const nativeCard = document.querySelector(
      `#mapGrid .map-card[data-map="${targetId}"]`
    );
    if (nativeCard && !nativeCard.classList.contains('active')) {
      triggerNativeTap(nativeCard);
    }
    hideMapTransition();
    refresh();
  }

  function openWardrobeDelegated() {
    haptic('light');
    const btnWardrobe = document.getElementById('btnOpenWardrobe');
    if (btnWardrobe) {
      triggerNativeTap(btnWardrobe);
      return;
    }
    const tokPill = document.getElementById('progTokenPill');
    if (tokPill) {
      triggerNativeTap(tokPill);
      return;
    }
    if (typeof env.openWardrobe === 'function') {
      env.openWardrobe();
    }
  }

  function showPartyToast(message, tone = 'ok') {
    const toastEl = document.getElementById('mobPartyToast');
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('is-warn', tone === 'warn');
    toastEl.classList.add('on');
    toastEl.setAttribute('aria-hidden', 'false');
    if (partyToastTimer) clearTimeout(partyToastTimer);
    partyToastTimer = setTimeout(() => {
      toastEl.classList.remove('on');
      toastEl.setAttribute('aria-hidden', 'true');
    }, 2900);
  }

  function openWorldModal() {
    if (!mounted) mount();
    if (!worldModalEl) return;
    closeProfileModal();
    closePartyModal();
    refresh();
    worldModalEl.classList.add('on');
    worldModalEl.setAttribute('aria-hidden', 'false');
    haptic('light');
  }

  function closeWorldModal() {
    if (!worldModalEl) return;
    worldModalEl.classList.remove('on');
    worldModalEl.setAttribute('aria-hidden', 'true');
  }

  function openProfileModal() {
    if (!mounted) mount();
    if (!profileModalEl) return;
    closeWorldModal();
    closePartyModal();
    refresh();
    const srcInput = document.getElementById('playerNameInput');
    const mirrorInput = document.getElementById('mobNameMirrorInput');
    if (mirrorInput && srcInput) {
      mirrorInput.value = srcInput.value || '';
    }
    profileModalEl.classList.add('on');
    profileModalEl.setAttribute('aria-hidden', 'false');
    haptic('light');
  }

  function closeProfileModal() {
    if (!profileModalEl) return;
    const mirrorInput = document.getElementById('mobNameMirrorInput');
    const srcInput = document.getElementById('playerNameInput');
    if (mirrorInput && srcInput && srcInput.value !== mirrorInput.value) {
      srcInput.value = mirrorInput.value;
      srcInput.dispatchEvent(new Event('input', { bubbles: true }));
      srcInput.dispatchEvent(new Event('change', { bubbles: true }));
      srcInput.dispatchEvent(new Event('blur'));
    }
    if (mirrorInput && typeof mirrorInput.blur === 'function') {
      mirrorInput.blur();
    }
    profileModalEl.classList.remove('on');
    profileModalEl.setAttribute('aria-hidden', 'true');
    refresh();
  }

  function openPartyModal() {
    if (!mounted) mount();
    if (!partyModalEl) return;
    closeWorldModal();
    closeProfileModal();
    resolveMP();
    refresh();
    partyModalEl.classList.add('on');
    partyModalEl.setAttribute('aria-hidden', 'false');
    haptic('light');
  }

  function closePartyModal() {
    if (!partyModalEl) return;
    const codeIn = document.getElementById('mobPartyCodeInput');
    if (codeIn && typeof codeIn.blur === 'function') {
      codeIn.blur();
    }
    partyModalEl.classList.remove('on');
    partyModalEl.setAttribute('aria-hidden', 'true');
  }

  function syncPartyDOM(worlds, activeWorld) {
    const mp = resolveMP();
    const st = mp && typeof mp.getPartyState === 'function' ? mp.getPartyState() : null;
    const isActive = Boolean(st?.active && st?.code);
    const members = Array.isArray(st?.members) ? st.members : [];
    const memberCount = isActive ? Math.max(1, members.length) : 0;

    // 1. Top Bar Party Button / Glowing Live Pill
    const partyBtn = document.getElementById('mobPartyBtn');
    const partyBtnTxt = document.getElementById('mobPartyBtnTxt');
    if (partyBtn) {
      partyBtn.classList.toggle('in-party', isActive);
      partyBtn.setAttribute(
        'aria-label',
        isActive
          ? `Party Room ${st.code} — ${memberCount} connected`
          : 'Open Friends Party Room'
      );
    }
    if (partyBtnTxt) {
      const nextLabel = isActive ? `🎉 ${st.code} · ${memberCount}` : '🎉 Party';
      if (partyBtnTxt.textContent !== nextLabel) {
        partyBtnTxt.textContent = nextLabel;
      }
    }

    // 2. Party Modal State
    if (!partyModalEl) return;

    const partyWorld =
      (isActive && st.mapId && worlds.find((w) => w.id === st.mapId)) ||
      (isActive && st.mapId && FALLBACK_WORLDS.find((w) => w.id === st.mapId)) ||
      activeWorld ||
      FALLBACK_WORLDS[0];
    const worldPillEl = document.getElementById('mobPartyWorldPill');
    const pillTxt = `${partyWorld?.name || 'Meadowbrook'} · 5v5`;
    if (worldPillEl && worldPillEl.textContent !== pillTxt) {
      worldPillEl.textContent = pillTxt;
    }

    const idleView = document.getElementById('mobPartyIdleView');
    const activeView = document.getElementById('mobPartyActiveView');
    if (idleView) idleView.classList.toggle('hidden', isActive);
    if (activeView) activeView.classList.toggle('hidden', !isActive);

    if (!isActive) {
      renderedPartySig = '';
      return;
    }

    const spacedCode = String(st.code).split('').join(' ');
    const codeDispEl = document.getElementById('mobPartyCodeDisplay');
    if (codeDispEl) {
      if (codeDispEl.textContent !== spacedCode) codeDispEl.textContent = spacedCode;
      codeDispEl.dataset.code = st.code;
    }

    const roleTagEl = document.getElementById('mobPartyRoleTag');
    if (roleTagEl) {
      const roleTxt = st.isHost
        ? '👑 Hosting Private Room'
        : (st.connected ? '✨ Connected to Friends Room' : '⏳ Connecting to Room…');
      if (roleTagEl.textContent !== roleTxt) roleTagEl.textContent = roleTxt;
    }

    const countBadgeEl = document.getElementById('mobPartyCountBadge');
    if (countBadgeEl) {
      const aiCount = Math.max(0, 10 - memberCount);
      const countTxt = `${memberCount} Friend${memberCount === 1 ? '' : 's'} + ${aiCount} AI`;
      if (countBadgeEl.textContent !== countTxt) countBadgeEl.textContent = countTxt;
    }

    const rosterEl = document.getElementById('mobPartyRosterList');
    if (!rosterEl) return;

    const sig =
      `${st.code}:${st.isHost ? 1 : 0}:${st.connected ? 1 : 0}:` +
      members
        .map(
          (m) =>
            `${m.actorId}:${m.name}:${m.isSelf ? 1 : 0}:${m.isHost ? 1 : 0}:${m.prefTeam}:${m.spiritMap}:${m.ping || 22}`
        )
        .join('|');

    if (sig === renderedPartySig) return;
    renderedPartySig = sig;

    const SPIRIT_ICONS = {
      auto: '✨',
      meadow: '🌿',
      onsen: '🏮',
      castle: '⚙️',
      forest: '🌲',
      bakery: '🥐',
      train: '🚂',
    };

    const memberRowsHtml = members
      .map((m) => {
        const isSeeker = m.prefTeam === 'seekers';
        const icon = isSeeker ? '💦' : (SPIRIT_ICONS[m.spiritMap] || '🌿');
        const roleTxt = isSeeker ? '💦 Hunter' : '🎭 Spirit';
        const selfCls = m.isSelf ? ' is-self' : '';
        return (
          `<div class="mob-party-member${selfCls}" role="listitem">` +
          `<div class="mob-pm-left">` +
          `<span class="mob-pm-avatar">${icon}</span>` +
          `<span class="mob-pm-name">${escHtml(m.name || 'Spirit')}</span>` +
          (m.isSelf ? '<span class="mob-pm-you">YOU</span>' : '') +
          (m.isHost ? '<span class="mob-pm-host">HOST</span>' : '') +
          `</div>` +
          `<div class="mob-pm-right">` +
          (m.isSelf
            ? `<button type="button" class="mob-pm-role is-toggle" data-toggle-role="1" title="Tap to switch preferred team">${roleTxt}</button>`
            : `<span class="mob-pm-role">${roleTxt}</span>`) +
          `<span class="mob-pm-ping"><i class="mob-pm-dot"></i>${m.ping || 22}ms</span>` +
          `</div>` +
          `</div>`
        );
      })
      .join('');

    rosterEl.innerHTML =
      memberRowsHtml +
      `<div class="mob-party-ai-row" role="listitem">` +
      `<span class="mob-party-ai-txt">🤖 AI Spirits &amp; Hunters fill open 5v5 slots</span>` +
      `</div>`;
  }

  function observeNodeOnce(node, options) {
    if (!domObserver || !node) return;
    if (observedNodes) {
      if (observedNodes.has(node)) return;
      observedNodes.add(node);
    }
    domObserver.observe(node, options);
  }

  function observeExternalSources() {
    if (!domObserver || typeof document === 'undefined') return;

    observeNodeOnce(document.getElementById('mapGrid'), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    observeNodeOnce(document.getElementById('spiritBar'), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    observeNodeOnce(document.getElementById('progStrip'), {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    observeNodeOnce(document.querySelector('#result .card'), {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    observeNodeOnce(document.getElementById('result'), {
      attributes: true,
      attributeFilter: ['class'],
    });

    observeNodeOnce(document.getElementById('title'), {
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    observeNodeOnce(document.getElementById('btnMute'), {
      childList: true,
      characterData: true,
      subtree: true,
    });

    observeNodeOnce(document.getElementById('btnQuality'), {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tier'],
    });

    observeNodeOnce(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  function refresh() {
    if (typeof document === 'undefined') return;
    isMobileTouchActive();
    observeExternalSources();
    syncRotateGuard();
    syncResultMvpLayoutClass();

    const titleEl = document.getElementById('title');
    if (titleEl && !titleEl.classList.contains('on')) {
      if (worldModalEl?.classList.contains('on')) closeWorldModal();
      if (profileModalEl?.classList.contains('on')) closeProfileModal();
      if (partyModalEl?.classList.contains('on')) closePartyModal();
      if (mapTransitionEl?.classList.contains('on') && !pendingMapTargetId) {
        hideMapTransition();
      }
    }

    if (!shellEl) return;

    // 1. Gamertag Sync
    const nameInput = document.getElementById('playerNameInput');
    const rawName = (nameInput?.value || '').trim();
    const displayTag = rawName || 'MeadowSpirit';
    const gtTxtEl = document.getElementById('mobGamertagTxt');
    if (gtTxtEl && gtTxtEl.textContent !== displayTag) {
      gtTxtEl.textContent = displayTag;
    }
    const mirrorInput = document.getElementById('mobNameMirrorInput');
    if (
      mirrorInput &&
      nameInput &&
      document.activeElement !== mirrorInput &&
      mirrorInput.value !== (nameInput.value || '')
    ) {
      mirrorInput.value = nameInput.value || '';
    }

    // 2. Spirit Avatar & 7-Spirit Picker Sync
    const spirits = readSpiritsFromDOM();
    const activeSpirit = spirits.find((s) => s.active) || spirits[0] || FALLBACK_SPIRITS[0];
    const spAvatarEl = document.getElementById('mobSpiritAvatar');
    if (spAvatarEl && spAvatarEl.textContent !== activeSpirit.icon) {
      spAvatarEl.textContent = activeSpirit.icon;
    }
    syncSpiritGridDOM(spirits);

    // 3. Level, Mini XP Bar, Tokens & Shop Notification Dot Sync
    const lvSrcEl =
      document.getElementById('progLevelBadge') || document.getElementById('progLvTxt');
    const lvBase = normalizeLevelLabel(lvSrcEl?.textContent);
    const progInst = env.progression || (typeof window !== 'undefined' ? window.__hs?.progression : null);
    const lgNow = progInst?.getRankLeague?.();
    const lvLabel = lgNow ? `${lvBase} · ${lgNow.icon}${lgNow.trophies}` : lvBase;
    const mobLvEl = document.getElementById('mobLvBadge');
    if (mobLvEl && mobLvEl.textContent !== lvLabel) {
      mobLvEl.textContent = lvLabel;
    }

    const xpFillSrc = document.getElementById('progXpFill');
    let xpWidth = xpFillSrc?.style?.width || '';
    if (!xpWidth) {
      const xpTxt = document.getElementById('progXpText')?.textContent || '';
      const frac = xpTxt.match(/(\d+)\s*\/\s*(\d+)/);
      if (frac) {
        const cur = Number(frac[1]) || 0;
        const max = Math.max(1, Number(frac[2]) || 100);
        xpWidth = `${Math.min(100, Math.max(0, Math.round((cur / max) * 100)))}%`;
      } else {
        xpWidth = '0%';
      }
    }
    const mobXpFillEl = document.getElementById('mobXpMiniFill');
    if (mobXpFillEl && mobXpFillEl.style.width !== xpWidth) {
      mobXpFillEl.style.width = xpWidth;
    }

    const tokSrcEl =
      document.getElementById('progTokenCount') ||
      document.getElementById('progTokensTxt');
    const tokStr = (tokSrcEl?.textContent || '').trim() || '80';
    const mobTokCountEl = document.getElementById('mobTokensCount');
    if (mobTokCountEl && mobTokCountEl.textContent !== tokStr) {
      mobTokCountEl.textContent = tokStr;
      if (lastTokenStr !== null && lastTokenStr !== tokStr) {
        const pillEl = document.getElementById('mobTokensPill');
        if (pillEl) {
          pillEl.classList.add('bump');
          if (tokenBumpTimer) clearTimeout(tokenBumpTimer);
          tokenBumpTimer = setTimeout(() => pillEl.classList.remove('bump'), 260);
        }
      }
      lastTokenStr = tokStr;
    } else if (lastTokenStr === null) {
      lastTokenStr = tokStr;
    }

    const shopDotSrc =
      document.getElementById('progShopDot') ||
      document.querySelector('#btnOpenWardrobe .prog-shop-dot');
    const showShopDot = Boolean(shopDotSrc && !shopDotSrc.classList.contains('hidden'));
    const mobShopDotEl = document.getElementById('mobShopDot');
    if (mobShopDotEl) {
      mobShopDotEl.classList.toggle('hidden', !showShopDot);
    }

    // 3b. Daily Welcome Gift, 3-Win Spirit Chest & Free Daily Blaster Trial Pills
    const prog = typeof env.getProgression === 'function' ? env.getProgression() : null;
    const giftBtn = document.getElementById('mobDailyGiftBtn');
    if (giftBtn && prog && typeof prog.getDailyLoginStatus === 'function') {
      const dl = prog.getDailyLoginStatus();
      giftBtn.classList.toggle('hidden', !dl.canClaim);
      if (dl.canClaim) {
        giftBtn.textContent = `${dl.reward?.icon || '🎁'} Day ${dl.dayNumber} Gift!`;
      }
    }
    const chestBtn = document.getElementById('mobChestBtn');
    if (chestBtn && prog && typeof prog.getSpiritChestStatus === 'function') {
      const ch = prog.getSpiritChestStatus();
      chestBtn.classList.remove('hidden');
      chestBtn.textContent = ch.ready ? '🎁 OPEN CHEST!' : `🎁 ${ch.points}/${ch.target}`;
      chestBtn.style.background = ch.ready
        ? 'linear-gradient(180deg,#8fdc6e,#4fae45)'
        : 'rgba(255,248,234,.92)';
      chestBtn.style.color = ch.ready ? '#173812' : '#3c2208';
    }
    const trialBtn = document.getElementById('mobTrialBtn');
    if (trialBtn && prog && typeof prog.getDailyBlasterTrialStatus === 'function') {
      const tr = prog.getDailyBlasterTrialStatus();
      trialBtn.classList.toggle('hidden', !tr.available);
      if (tr.available && tr.gunId) {
        const iconMap = { earth: '🪨', fire: '🔥', snow: '❄️', air: '🌪️' };
        trialBtn.textContent = `${iconMap[tr.gunId] || '⚡'} Free ${tr.gunId[0].toUpperCase() + tr.gunId.slice(1)} Trial`;
      }
    }

    const adminSrc = document.getElementById('btnAdminPanel');
    const showAdminBtn = Boolean(adminSrc && !adminSrc.classList.contains('hidden'));
    const mobAdminEl = document.getElementById('mobAdminBtn');
    if (mobAdminEl) {
      mobAdminEl.classList.toggle('hidden', !showAdminBtn);
    }

    // 4. Mute Icon & Graphics Quality Pill Sync
    const btnMuteSrc = document.getElementById('btnMute');
    const muteIcon = (btnMuteSrc?.textContent || '').trim() || '🔊';
    const mobMuteEl = document.getElementById('mobLobbyMuteBtn');
    if (mobMuteEl && mobMuteEl.textContent !== muteIcon) {
      mobMuteEl.textContent = muteIcon;
    }

    const btnQualSrc = document.getElementById('btnQuality');
    const qualLabel = (btnQualSrc?.textContent || '').trim() || '✨ Ultra';
    const qualTier = btnQualSrc?.dataset?.tier || 'ultra';
    const mobQualEl = document.getElementById('mobLobbyQualityBtn');
    if (mobQualEl) {
      if (mobQualEl.textContent !== qualLabel) mobQualEl.textContent = qualLabel;
      if (mobQualEl.dataset.tier !== qualTier) mobQualEl.dataset.tier = qualTier;
    }

    // 5. Active World Card & 3x2 World Gallery Sync
    const worlds = readWorldsFromDOM();
    const activeWorld = worlds.find((w) => w.active) || worlds[0] || FALLBACK_WORLDS[0];

    const worldThumbEl = document.getElementById('mobWorldThumb');
    if (worldThumbEl) {
      if (worldThumbEl.getAttribute('src') !== activeWorld.thumb) {
        worldThumbEl.setAttribute('src', activeWorld.thumb);
      }
      if (worldThumbEl.alt !== activeWorld.name) {
        worldThumbEl.alt = activeWorld.name;
      }
    }
    const worldBadgeEl = document.getElementById('mobWorldThemeBadge');
    if (worldBadgeEl && worldBadgeEl.textContent !== activeWorld.badge) {
      worldBadgeEl.textContent = activeWorld.badge;
    }
    const worldTitleEl = document.getElementById('mobWorldTitleTxt');
    if (worldTitleEl && worldTitleEl.textContent !== activeWorld.name) {
      worldTitleEl.textContent = activeWorld.name;
    }
    const worldModalSubEl = document.getElementById('mobWorldModalSub');
    const subLabel = `${activeWorld.name} · ${activeWorld.badge}`;
    if (worldModalSubEl && worldModalSubEl.textContent !== subLabel) {
      worldModalSubEl.textContent = subLabel;
    }
    syncWorldGalleryDOM(worlds);
    syncPartyDOM(worlds, activeWorld);
    if (typeof env.syncTutorialBadges === 'function') {
      env.syncTutorialBadges();
    }
  }

  function scheduleRefresh() {
    if (rafPending) return;
    rafPending = true;
    const flush = () => {
      rafPending = false;
      refresh();
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(flush);
    } else if (typeof queueMicrotask === 'function') {
      queueMicrotask(flush);
    } else {
      Promise.resolve().then(flush);
    }
  }

  function isInternalLobbyNode(node) {
    if (!node || typeof node !== 'object') return false;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || typeof el.closest !== 'function') return false;
    return Boolean(
      el.closest(
        '#mobLobbyShell, #mobWorldModal, #mobProfileModal, #mobPartyModal, #mobMapTransition, #mobRotateGuard'
      )
    );
  }

  function handleWorldCardSelect(cardBtn) {
    const mapId = cardBtn?.dataset?.map;
    if (!mapId) return;
    haptic('light');

    const worlds = readWorldsFromDOM();
    const tappedWorld =
      worlds.find((w) => w.id === mapId) ||
      FALLBACK_WORLDS.find((w) => w.id === mapId) || {
        id: mapId,
        name: mapId,
        badge: 'Storybook World',
        thumb: FALLBACK_WORLDS[0].thumb,
      };

    if (tappedWorld.locked) {
      haptic('medium');
      cardBtn.classList.remove('locked-shake');
      void cardBtn.offsetWidth;
      cardBtn.classList.add('locked-shake');
      const nativeLockedCard = document.querySelector(
        `#mapGrid .map-card[data-map="${mapId}"]`
      );
      if (nativeLockedCard) {
        triggerNativeTap(nativeLockedCard);
      }
      return;
    }

    const currentActiveCard = document.querySelector('#mapGrid .map-card.active');
    const alreadySelected =
      !pendingMapTargetId &&
      Boolean(currentActiveCard && currentActiveCard.dataset?.map === mapId);

    if (alreadySelected) {
      const mpNow = resolveMP();
      const pstNow = mpNow?.getPartyState?.();
      if (pstNow?.active && pstNow.isHost) {
        mpNow.setPartyMap?.(mapId);
      }
      closeWorldModal();
      refresh();
      return;
    }

    // 1. Immediately highlight tapped card (✓ Selected) and update dock preview
    if (worldModalEl) {
      const modalCards = worldModalEl.querySelectorAll('.mob-wcard');
      modalCards.forEach((btn) => {
        const isSel = btn.dataset.map === mapId;
        btn.classList.toggle('active', isSel);
        btn.setAttribute('aria-selected', isSel ? 'true' : 'false');
        const check = btn.querySelector('.mob-wcard-check');
        if (check) check.classList.toggle('hidden', !isSel);
      });
    }

    const worldThumbEl = document.getElementById('mobWorldThumb');
    if (worldThumbEl && tappedWorld.thumb) {
      worldThumbEl.setAttribute('src', tappedWorld.thumb);
      worldThumbEl.alt = tappedWorld.name;
    }
    const worldBadgeEl = document.getElementById('mobWorldThemeBadge');
    if (worldBadgeEl) worldBadgeEl.textContent = tappedWorld.badge;
    const worldTitleEl = document.getElementById('mobWorldTitleTxt');
    if (worldTitleEl) worldTitleEl.textContent = tappedWorld.name;
    const worldModalSubEl = document.getElementById('mobWorldModalSub');
    if (worldModalSubEl) {
      worldModalSubEl.textContent = `${tappedWorld.name} · ${tappedWorld.badge}`;
    }

    closeWorldModal();
    showMapTransition(tappedWorld.name);

    cancelPendingMapFrames();
    pendingMapTargetId = mapId;

    const commitNativeMapSwitch = () => {
      const targetId = pendingMapTargetId;
      pendingMapTargetId = null;
      if (!targetId) return;

      const nativeCard = document.querySelector(
        `#mapGrid .map-card[data-map="${targetId}"]`
      );
      if (nativeCard) {
        triggerNativeTap(nativeCard);
      }

      const mpInst = resolveMP();
      const pst = mpInst?.getPartyState?.();
      if (pst?.active && pst.isHost && targetId !== 'any') {
        mpInst.setPartyMap?.(targetId);
      }

      if (
        typeof window !== 'undefined' &&
        typeof window.requestAnimationFrame === 'function' &&
        !window.__INSTANT_MAP_SELECT
      ) {
        mapSwitchPostRaf = window.requestAnimationFrame(() => {
          mapSwitchPostRaf = 0;
          refresh();
          hideMapTransition();
        });
      } else {
        refresh();
        hideMapTransition();
      }
    };

    // 2. Defer 2 animation frames so modal close & sunlit transition pill paint at 60 FPS first
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function' &&
      !window.__INSTANT_MAP_SELECT
    ) {
      mapSwitchRaf1 = window.requestAnimationFrame(() => {
        mapSwitchRaf1 = 0;
        mapSwitchRaf2 = window.requestAnimationFrame(() => {
          mapSwitchRaf2 = 0;
          commitNativeMapSwitch();
        });
      });
    } else {
      commitNativeMapSwitch();
    }
  }

  function buildLobbyShellDOM(titleEl) {
    const existing = document.getElementById('mobLobbyShell');
    if (existing) {
      shellEl = existing;
      return existing;
    }

    const shell = document.createElement('div');
    shell.id = 'mobLobbyShell';
    shell.setAttribute('aria-label', 'Mobile Game Lobby');
    shell.innerHTML = `
      <div class="mob-scrim-top" aria-hidden="true"></div>
      <div class="mob-scrim-bottom" aria-hidden="true"></div>

      <header id="mobTopBar">
        <div class="mob-top-left">
          <button type="button" id="mobProfileBtn" aria-label="Edit Player Profile and Spirit Form">
            <span class="mob-prof-avatar-wrap">
              <span id="mobSpiritAvatar">✨</span>
              <i class="mob-prof-online" aria-hidden="true"></i>
            </span>
            <span class="mob-prof-info">
              <span class="mob-prof-top-row">
                <span id="mobGamertagTxt">MeadowSpirit</span>
                <span id="mobLvBadge">Lv. 1</span>
              </span>
              <span class="mob-xp-mini-track" aria-hidden="true">
                <i id="mobXpMiniFill" style="width: 0%"></i>
              </span>
            </span>
            <span class="mob-prof-edit-ic" aria-hidden="true">✏️</span>
          </button>

          <button type="button" id="mobPartyBtn" aria-label="Open Friends Party Room">
            <i class="mob-party-live-dot" aria-hidden="true"></i>
            <span id="mobPartyBtnTxt">🎉 Party</span>
          </button>
          <span id="mobOfflinePill" class="hidden" role="status" style="background:linear-gradient(180deg,#fff3d6,#ffdca0);color:#6b3305;border:1.5px solid #d9822b;border-radius:999px;padding:5px 10px;font-weight:900;font-size:11.5px;white-space:nowrap;box-shadow:0 2px 8px rgba(107,51,5,.18);">📡 Offline Mode · AI</span>
          <button type="button" id="mobDailyGiftBtn" class="hidden" aria-label="Claim Daily Welcome Gift" style="background:linear-gradient(180deg,#ffd866,#f29524);color:#3c2208;border:0;border-radius:999px;padding:6px 11px;font-weight:900;font-size:12px;cursor:pointer;box-shadow:0 3px 10px rgba(242,149,36,.45);white-space:nowrap;">🎁 Day 1 Gift</button>
          <button type="button" id="mobChestBtn" class="hidden" aria-label="Spirit Chest Progress" style="background:rgba(255,248,234,.92);color:#3c2208;border:1.5px solid rgba(255,184,66,.85);border-radius:999px;padding:5px 10px;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap;">🎁 0/3</button>
          <button type="button" id="mobTrialBtn" class="hidden" aria-label="Claim Free Daily Blaster Trial" style="background:linear-gradient(180deg,#ff9457,#d94e1f);color:#fff8ea;border:0;border-radius:999px;padding:6px 10px;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap;">🔥 Free Trial</button>
        </div>

        <div class="mob-top-cluster">
          <button type="button" id="mobTokensPill" aria-label="Spirit Tokens — Open Wardrobe">
            <span aria-hidden="true">🪙</span>
            <b id="mobTokensCount">60</b>
          </button>
          <button type="button" id="mobCharsBtn" aria-label="Open 3D Character Selection" style="background:linear-gradient(180deg,#fff3c4,#ffc957);color:#4a2a04;border:1.5px solid #e69d1e;border-radius:999px;padding:6px 12px;font-family:var(--fd,'Fredoka',sans-serif);font-weight:700;font-size:12.5px;cursor:pointer;box-shadow:0 3px 0 rgba(138,82,10,.26);white-space:nowrap;">🎭 Characters</button>
          <button type="button" id="mobWardrobeBtn" aria-label="Open Journey 1-99 and Spirit Wardrobe">
            <span>🎒 Journey</span>
            <i id="mobShopDot" class="hidden" aria-hidden="true"></i>
          </button>
          <button type="button" id="mobAdminBtn" class="hidden" aria-label="Open Admin and World Verifier"><span>👑 Admin</span></button>
          <button type="button" id="mobLobbyQualityBtn" data-tier="ultra" aria-label="Graphics Quality">✨ Ultra</button>
          <button type="button" id="mobLobbyTutorialBtn" aria-label="How to Play Tutorial Dojo">🎓</button>
          <button type="button" id="mobLobbyMuteBtn" aria-label="Toggle Sound">🔊</button>
        </div>
      </header>

      <div id="mobHeroLogo">
        <img id="mobHeroLogoImg" src="assets/logo_mobile.webp" alt="Hue &amp; Seek">
        <div id="mobHeroLogoFallback" class="mob-hero-fallback hidden" aria-hidden="true">
          <span class="mob-fb-kicker">✨ 5v5 Prop Hunt ✨</span>
          <span class="mob-fb-title">Hue <em>&amp;</em> Seek</span>
          <span class="mob-fb-sub">6 Storybook Worlds</span>
        </div>
      </div>

      <footer id="mobBottomDock">
        <button type="button" id="mobWorldCardBtn" aria-label="Choose a Storybook World">
          <span class="mob-wc-thumb">
            <img id="mobWorldThumb" src="assets/concepts/map_overview.webp" alt="Meadowbrook">
          </span>
          <span class="mob-wc-meta">
            <span id="mobWorldThemeBadge">Cosy Village</span>
            <span id="mobWorldTitleTxt">Meadowbrook</span>
          </span>
          <span class="mob-wc-ChangePill">🗺️ Maps</span>
        </button>

        <div id="mobPlayCluster">
          <button type="button" class="mob-play-btn" id="mobPlayHideBtn" aria-label="Play Hide 5v5 as Spirits">
            <span class="mob-play-main">🎭 PLAY HIDE</span>
            <span class="mob-play-sub">5v5 · Spirits</span>
          </button>
          <button type="button" class="mob-play-btn" id="mobPlaySeekBtn" aria-label="Play Seek 5v5 as Hunters">
            <span class="mob-play-main">💦 PLAY SEEK</span>
            <span class="mob-play-sub">5v5 · Hunters</span>
          </button>
        </div>
      </footer>
    `;

    titleEl.appendChild(shell);
    shellEl = shell;

    bindLogoFallback(
      shell.querySelector('#mobHeroLogoImg'),
      shell.querySelector('#mobHeroLogoFallback')
    );

    return shell;
  }

  function buildSubModalsDOM(appEl) {
    let wModal = document.getElementById('mobWorldModal');
    if (!wModal) {
      wModal = document.createElement('div');
      wModal.id = 'mobWorldModal';
      wModal.setAttribute('role', 'dialog');
      wModal.setAttribute('aria-modal', 'true');
      wModal.setAttribute('aria-hidden', 'true');
      wModal.setAttribute('aria-label', 'Choose a Storybook World');
      wModal.innerHTML = `
        <div class="mob-modal-card mob-world-dialog">
          <div class="mob-modal-hdr">
            <div class="mob-modal-title-group">
              <h2>🗺️ Choose a Storybook World</h2>
              <span class="mob-modal-pill" id="mobWorldModalSub">Meadowbrook · Cosy Village</span>
            </div>
            <button type="button" class="mob-modal-close" id="btnCloseWorldModal" aria-label="Close World Gallery">✕</button>
          </div>
          <div id="mobWorldModalGrid" role="listbox" aria-label="Storybook Worlds"></div>
        </div>
      `;
      appEl.appendChild(wModal);
    }
    worldModalEl = wModal;

    let pModal = document.getElementById('mobProfileModal');
    if (!pModal) {
      pModal = document.createElement('div');
      pModal.id = 'mobProfileModal';
      pModal.setAttribute('role', 'dialog');
      pModal.setAttribute('aria-modal', 'true');
      pModal.setAttribute('aria-hidden', 'true');
      pModal.setAttribute('aria-label', 'Player Profile and Spirit Form');
      pModal.innerHTML = `
        <div class="mob-modal-card mob-profile-dialog">
          <div class="mob-modal-hdr">
            <div class="mob-modal-title-group">
              <h2>✨ Profile &amp; Spirit Form</h2>
            </div>
            <button type="button" id="mobCloudSaveBtn" class="mob-hdr-cloud-btn" aria-label="Cloud save and recovery code">☁️ Cloud save</button>
            <button type="button" class="mob-done-btn" id="btnCloseProfileModal">Done ✓</button>
          </div>

          <div class="mob-prof-sec">
            <label class="mob-sec-lbl" for="mobNameMirrorInput">🟢 Online Gamertag</label>
            <div class="mob-gt-editor-row">
              <input
                id="mobNameMirrorInput"
                type="text"
                maxlength="16"
                spellcheck="false"
                autocomplete="off"
                placeholder="Enter gamertag…"
                aria-label="Your gamertag"
              >
              <button type="button" id="mobRollNameBtn" aria-label="Randomize gamertag">🎲 Randomize</button>
            </div>
          </div>

          <div class="mob-prof-sec">
            <div class="mob-sec-lbl">🎭 Choose Your Hider Spirit</div>
            <div id="mobSpiritGrid" role="listbox" aria-label="Hider Spirit Forms"></div>
          </div>
        </div>
      `;
      appEl.appendChild(pModal);
    }
    profileModalEl = pModal;

    let partyModal = document.getElementById('mobPartyModal');
    if (!partyModal) {
      partyModal = document.createElement('div');
      partyModal.id = 'mobPartyModal';
      partyModal.setAttribute('role', 'dialog');
      partyModal.setAttribute('aria-modal', 'true');
      partyModal.setAttribute('aria-hidden', 'true');
      partyModal.setAttribute('aria-label', 'Friends Party Room');
      partyModal.innerHTML = `
        <div class="mob-modal-card mob-party-dialog">
          <div class="mob-modal-hdr">
            <div class="mob-modal-title-group">
              <h2>🎉 Friends Party Room</h2>
              <span class="mob-modal-pill" id="mobPartyWorldPill">Meadowbrook · 5v5</span>
            </div>
            <button type="button" class="mob-modal-close" id="btnClosePartyModal" aria-label="Close Party Room">✕</button>
          </div>

          <div id="mobPartyToast" class="mob-party-toast" role="status" aria-live="polite" aria-hidden="true"></div>

          <div id="mobPartyIdleView" class="mob-party-idle-grid">
            <div class="mob-party-card is-create">
              <div class="mob-party-card-top">
                <h3>🎉 Create Friends Room</h3>
                <p>Open a private 5v5 Storybook village for friends — AI Spirits &amp; Hunters fill open slots!</p>
              </div>
              <button type="button" id="mobPartyCreateBtn" class="mob-party-primary-btn">
                ✨ Create 4-Digit Code
              </button>
            </div>

            <div class="mob-party-card is-join">
              <div class="mob-party-card-top">
                <h3>🔑 Join Friends Room</h3>
                <p>Enter your friend&rsquo;s 4-letter code to hop right into their village:</p>
              </div>
              <div class="mob-party-join-row">
                <input
                  id="mobPartyCodeInput"
                  type="text"
                  maxlength="4"
                  placeholder="G7K2"
                  autocapitalize="characters"
                  autocomplete="off"
                  spellcheck="false"
                  aria-label="4-digit party code"
                >
                <button type="button" id="mobPartyJoinBtn">Join</button>
              </div>
            </div>
          </div>

          <div id="mobPartyActiveView" class="mob-party-active-grid hidden">
            <div class="mob-party-col-code">
              <div class="mob-party-role-tag" id="mobPartyRoleTag">👑 Hosting Private Room</div>
              <button
                type="button"
                id="mobPartyCodeDisplay"
                class="mob-party-code-badge"
                title="Tap to copy 4-digit room code"
                aria-label="Copy 4-digit party room code"
              >G 7 K 2</button>

              <div class="mob-party-invite-row">
                <button type="button" id="mobPartyShareBtn">📲 Share Invite Link</button>
                <button type="button" id="mobPartyCopyBtn">📋 Copy Code</button>
              </div>

              <div class="mob-party-quickplay-row">
                <button type="button" id="mobPartyPlayHideBtn" class="mob-party-play-btn is-hide">🙈 Play Hide</button>
                <button type="button" id="mobPartyPlaySeekBtn" class="mob-party-play-btn is-seek">💦 Play Seek</button>
              </div>

              <button type="button" id="mobPartyLeaveBtn" class="mob-party-leave-btn">Leave Party</button>
            </div>

            <div class="mob-party-col-roster">
              <div class="mob-party-roster-hdr">
                <span class="mob-sec-lbl">🧑‍🤝‍🧑 Connected Friends</span>
                <span class="mob-party-count-pill" id="mobPartyCountBadge">1 Friend + 9 AI</span>
              </div>
              <div id="mobPartyRosterList" role="list" aria-label="Connected Party Friends"></div>
            </div>
          </div>
        </div>
      `;
      appEl.appendChild(partyModal);
    }
    partyModalEl = partyModal;

    let mTrans = document.getElementById('mobMapTransition');
    if (!mTrans) {
      mTrans = document.createElement('div');
      mTrans.id = 'mobMapTransition';
      mTrans.setAttribute('aria-hidden', 'true');
      mTrans.innerHTML = `
        <div id="mobMapTransitionCurtain" aria-hidden="true"></div>
        <div class="mob-map-transition-pill" role="status" aria-live="polite">
          <span class="mob-mt-spark" aria-hidden="true">✨</span>
          <span id="mobMapTransitionTxt">Loading Meadowbrook…</span>
        </div>
      `;
      appEl.appendChild(mTrans);
    }
    mapTransitionEl = mTrans;

    let rGuard = document.getElementById('mobRotateGuard');
    if (!rGuard) {
      rGuard = document.createElement('div');
      rGuard.id = 'mobRotateGuard';
      rGuard.setAttribute('aria-hidden', 'true');
      rGuard.innerHTML = `
        <div class="mob-rg-logo-wrap">
          <img id="mobRotateLogoImg" src="assets/logo_mobile.webp" alt="Hue &amp; Seek">
          <div id="mobRotateLogoFallback" class="mob-hero-fallback hidden" aria-hidden="true">
            <span class="mob-fb-kicker">✨ 5v5 Prop Hunt ✨</span>
            <span class="mob-fb-title">Hue <em>&amp;</em> Seek</span>
          </div>
        </div>
        <div class="mob-rg-phone-anim" aria-hidden="true">
          <svg class="mob-rg-phone-svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="13" y="6" width="22" height="36" rx="4.5" fill="#fffdf7"/>
            <line x1="21" y1="36.5" x2="27" y2="36.5"/>
            <circle cx="24" cy="11" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <h2 class="mob-rg-title">Rotate Your Phone to Landscape</h2>
        <p class="mob-rg-sub">Hue &amp; Seek plays in widescreen landscape so you can spot every disguised Spirit across the village!</p>
      `;
      appEl.appendChild(rGuard);
    }
    rotateGuardEl = rGuard;

    bindLogoFallback(
      rGuard.querySelector('#mobRotateLogoImg'),
      rGuard.querySelector('#mobRotateLogoFallback')
    );
  }

  function getActiveLobbyMapId() {
    if (pendingMapTargetId) return pendingMapTargetId;
    const activeCard = document.querySelector('#mapGrid .map-card.active[data-map]');
    if (activeCard?.dataset?.map && activeCard.dataset.map !== 'tutorial') {
      return activeCard.dataset.map;
    }
    const worlds = readWorldsFromDOM();
    const act = worlds.find((w) => w.active);
    return act?.id || 'meadow';
  }

  function syncPlayerNameBeforePartyAction(mp) {
    if (!mp) return;
    const srcInput = document.getElementById('playerNameInput');
    const val = (srcInput?.value || '').trim();
    if (val.length >= 2 && typeof mp.setPlayerName === 'function') {
      mp.setPlayerName(val);
    }
  }

  function launchPartyMatchFromModal(mode = 'hide') {
    const mp = resolveMP();
    if (!mp || typeof mp.startPartyMatch !== 'function') return;
    haptic('medium');
    flushPendingMapSwitchSync();
    syncPlayerNameBeforePartyAction(mp);

    const st = typeof mp.getPartyState === 'function' ? mp.getPartyState() : null;
    const isGuestMulti = Boolean(st?.active && !st?.isHost && (st?.members?.length || 0) >= 2);
    if (isGuestMulti) {
      mp.startPartyMatch(mode, { mapId: st.mapId || getActiveLobbyMapId() });
      refresh();
      showPartyToast('Ready! Launching 5v5 party match with host… 🎉');
      return;
    }

    closePartyModal();
    closeWorldModal();
    closeProfileModal();
    tryLockLandscape();
    mp.startPartyMatch(mode, { mapId: st?.mapId || getActiveLobbyMapId() });
  }

  function bindEventsAndObservers() {
    if (listenersBound || typeof document === 'undefined') return;
    listenersBound = true;

    // Lobby Top Bar & Bottom Dock Controls
    document.getElementById('mobProfileBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileModal();
    });

    document.getElementById('mobPartyBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openPartyModal();
    });

    document.getElementById('mobTokensPill')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openWardrobeDelegated();
    });

    document.getElementById('mobDailyGiftBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const prog = typeof env.getProgression === 'function' ? env.getProgression() : null;
      if (!prog || typeof prog.claimDailyLoginReward !== 'function') return;
      const res = prog.claimDailyLoginReward();
      if (res.ok) {
        haptic('medium');
        env.audio?.win?.();
        const eg = typeof env.getElementalGuns === 'function' ? env.getElementalGuns() : null;
        if (eg && prog.getActiveElemGun) eg.selectElement(prog.getActiveElemGun(), { silent: true, force: true });
        refresh();
      }
    });

    document.getElementById('mobChestBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const prog = typeof env.getProgression === 'function' ? env.getProgression() : null;
      if (!prog || typeof prog.getSpiritChestStatus !== 'function') return;
      const ch = prog.getSpiritChestStatus();
      if (ch.ready) {
        const res = prog.claimSpiritChest();
        if (res.ok) {
          haptic('heavy');
          env.audio?.win?.();
          const eg = typeof env.getElementalGuns === 'function' ? env.getElementalGuns() : null;
          if (eg && prog.getActiveElemGun) eg.selectElement(prog.getActiveElemGun(), { silent: true, force: true });
          refresh();
        }
      } else {
        haptic('light');
        openWardrobeDelegated();
      }
    });

    document.getElementById('mobTrialBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const prog = typeof env.getProgression === 'function' ? env.getProgression() : null;
      if (!prog || typeof prog.claimDailyBlasterTrial !== 'function') return;
      const res = prog.claimDailyBlasterTrial();
      if (res.ok) {
        haptic('medium');
        env.audio?.tap?.();
        const eg = typeof env.getElementalGuns === 'function' ? env.getElementalGuns() : null;
        if (eg && res.gunId) eg.selectElement(res.gunId, { silent: true, force: true });
        refresh();
      }
    });

    document.getElementById('mobCharsBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('medium');
      const btn = document.getElementById('btnDesktopChars');
      if (btn) btn.click();
    });

    document.getElementById('mobWardrobeBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openWardrobeDelegated();
    });

    document.getElementById('mobAdminBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      const btnAdmin = document.getElementById('btnAdminPanel');
      if (btnAdmin) btnAdmin.click();
    });

    document.getElementById('mobLobbyQualityBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      triggerNativeTap(document.getElementById('btnQuality'));
      refresh();
    });

    document.getElementById('mobLobbyTutorialBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      closeWorldModal();
      closeProfileModal();
      closePartyModal();
      triggerNativeTap(document.getElementById('btnTitleTutorial'));
    });

    document.getElementById('mobLobbyMuteBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      triggerNativeTap(document.getElementById('btnMute'));
      refresh();
    });

    document.getElementById('mobWorldCardBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openWorldModal();
    });

    document.getElementById('mobPlayHideBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('medium');
      flushPendingMapSwitchSync();
      closeWorldModal();
      closeProfileModal();
      closePartyModal();
      tryLockLandscape();
      const mp = resolveMP();
      if (mp?.getPartyState?.()?.active && typeof window !== 'undefined' && typeof window.__hs?.enterMatchQueue === 'function') {
        window.__hs.enterMatchQueue('hide', { skipTutorialCheck: true });
        return;
      }
      triggerNativeTap(document.getElementById('btnHide'));
    });

    document.getElementById('mobPlaySeekBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('medium');
      flushPendingMapSwitchSync();
      closeWorldModal();
      closeProfileModal();
      closePartyModal();
      tryLockLandscape();
      const mp = resolveMP();
      if (mp?.getPartyState?.()?.active && typeof window !== 'undefined' && typeof window.__hs?.enterMatchQueue === 'function') {
        window.__hs.enterMatchQueue('seek', { skipTutorialCheck: true });
        return;
      }
      triggerNativeTap(document.getElementById('btnSeek'));
    });

    // Party Modal Interactions
    document.getElementById('btnClosePartyModal')?.addEventListener('click', () => {
      haptic('light');
      closePartyModal();
    });

    partyModalEl?.addEventListener('click', (e) => {
      if (e.target === partyModalEl) {
        closePartyModal();
        return;
      }
      const toggleBtn = e.target?.closest?.('[data-toggle-role="1"]');
      if (toggleBtn) {
        const mp = resolveMP();
        const st = mp?.getPartyState?.();
        if (mp && st?.active && typeof mp.setPartyPreferredTeam === 'function') {
          haptic('light');
          const nextMode = st.prefTeam === 'seekers' ? 'hide' : 'seek';
          mp.setPartyPreferredTeam(nextMode);
          refresh();
        }
      }
    });

    document.getElementById('mobPartyCreateBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const mp = resolveMP();
      if (!mp || typeof mp.createPartyRoom !== 'function') {
        showPartyToast('Connecting multiplayer… try again in a moment!', 'warn');
        return;
      }
      haptic('medium');
      flushPendingMapSwitchSync();
      syncPlayerNameBeforePartyAction(mp);
      const st = mp.createPartyRoom(getActiveLobbyMapId());
      refresh();
      if (st?.code) {
        showPartyToast(`Room ${st.code} created! Share with friends 🎉`);
      }
    });

    const partyCodeInput = document.getElementById('mobPartyCodeInput');
    const submitPartyJoin = () => {
      const mp = resolveMP();
      if (!mp || typeof mp.joinPartyRoom !== 'function') {
        showPartyToast('Connecting multiplayer… try again in a moment!', 'warn');
        return;
      }
      const raw = (partyCodeInput?.value || '').trim();
      const clean = typeof mp.normalizePartyCode === 'function'
        ? mp.normalizePartyCode(raw)
        : raw.replace(/[\s\-]+/g, '').toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(clean)) {
        haptic('medium');
        if (partyCodeInput) {
          partyCodeInput.classList.remove('locked-shake');
          void partyCodeInput.offsetWidth;
          partyCodeInput.classList.add('locked-shake');
          partyCodeInput.focus?.();
        }
        showPartyToast('Enter a valid 4-character code (e.g. G7K2)', 'warn');
        return;
      }
      haptic('medium');
      syncPlayerNameBeforePartyAction(mp);
      const st = mp.joinPartyRoom(clean);
      if (st?.active) {
        if (partyCodeInput) partyCodeInput.blur?.();
        refresh();
        showPartyToast(`Joined Room ${st.code}! Waiting for friends 🎉`);
      } else {
        showPartyToast('Invalid 4-character party code', 'warn');
      }
    };

    if (partyCodeInput) {
      partyCodeInput.addEventListener('input', () => {
        const sanitized = partyCodeInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
        if (partyCodeInput.value !== sanitized) {
          partyCodeInput.value = sanitized;
        }
      });
      partyCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitPartyJoin();
        }
      });
    }

    document.getElementById('mobPartyJoinBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      submitPartyJoin();
    });

    const handleCopyCodeTap = async (e) => {
      e?.stopPropagation?.();
      const mp = resolveMP();
      const st = mp?.getPartyState?.();
      const code = st?.code || '';
      if (!code) return;
      haptic('light');
      if (typeof mp?.copyPartyCode === 'function') {
        await mp.copyPartyCode();
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(code); } catch (_) { /* ignore */ }
      }
      showPartyToast(`Copied Code ${code}! Share with friends 🎉`);
    };

    document.getElementById('mobPartyCopyBtn')?.addEventListener('click', handleCopyCodeTap);
    document.getElementById('mobPartyCodeDisplay')?.addEventListener('click', handleCopyCodeTap);

    document.getElementById('mobPartyShareBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mp = resolveMP();
      if (!mp || typeof mp.sharePartyInvite !== 'function') return;
      haptic('medium');
      const res = await mp.sharePartyInvite();
      if (res?.code) {
        if (res.method === 'share') {
          showPartyToast(`Shared Invite Link · Code ${res.code} 🎉`);
        } else {
          showPartyToast(`Copied Code ${res.code}! Share with friends 🎉`);
        }
      }
    });

    document.getElementById('mobPartyPlayHideBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      launchPartyMatchFromModal('hide');
    });

    document.getElementById('mobPartyPlaySeekBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      launchPartyMatchFromModal('seek');
    });

    document.getElementById('mobPartyLeaveBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const mp = resolveMP();
      if (!mp || typeof mp.leavePartyRoom !== 'function') return;
      haptic('light');
      mp.leavePartyRoom();
      if (partyCodeInput) partyCodeInput.value = '';
      refresh();
      showPartyToast('Left party room · Back to solo/public play');
    });

    // World Gallery Modal Interactions
    document.getElementById('btnCloseWorldModal')?.addEventListener('click', () => {
      haptic('light');
      closeWorldModal();
    });

    worldModalEl?.addEventListener('click', (e) => {
      if (e.target === worldModalEl) {
        closeWorldModal();
        return;
      }
      const cardBtn = e.target?.closest?.('.mob-wcard[data-map]');
      if (!cardBtn) return;
      handleWorldCardSelect(cardBtn);
    });

    // Profile & Spirit Modal Interactions
    document.getElementById('btnCloseProfileModal')?.addEventListener('click', () => {
      haptic('light');
      closeProfileModal();
    });

    profileModalEl?.addEventListener('click', (e) => {
      if (e.target === profileModalEl) {
        closeProfileModal();
        return;
      }
      const spBtn = e.target?.closest?.('.mob-sp-choice[data-spirit]');
      if (!spBtn) return;

      const spId = spBtn.dataset.spirit;
      haptic('light');
      const nativePill = document.querySelector(
        `#spiritBar .sp-pill[data-spirit="${spId}"]`
      );
      if (nativePill) {
        triggerNativeTap(nativePill);
      }
      refresh();
    });

    const mirrorInput = document.getElementById('mobNameMirrorInput');
    if (mirrorInput) {
      const pushNameToNative = (commit = false) => {
        const srcInput = document.getElementById('playerNameInput');
        if (srcInput) {
          srcInput.value = mirrorInput.value;
          srcInput.dispatchEvent(new Event('input', { bubbles: true }));
          if (commit) {
            srcInput.dispatchEvent(new Event('change', { bubbles: true }));
            srcInput.dispatchEvent(new Event('blur'));
          }
        }
        const gtTxtEl = document.getElementById('mobGamertagTxt');
        if (gtTxtEl) {
          gtTxtEl.textContent = (mirrorInput.value || '').trim() || 'MeadowSpirit';
        }
      };

      mirrorInput.addEventListener('input', () => pushNameToNative(false));
      mirrorInput.addEventListener('change', () => pushNameToNative(true));
      mirrorInput.addEventListener('blur', () => pushNameToNative(true));
      mirrorInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          pushNameToNative(true);
          closeProfileModal();
        }
      });
    }

    document.getElementById('mobCloudSaveBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      closeProfileModal();
      document.getElementById('btnCloudSave')?.click();
    });

    document.getElementById('mobRollNameBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      const rollBtn = document.getElementById('btnRollName');
      triggerNativeTap(rollBtn);
      const srcInput = document.getElementById('playerNameInput');
      const mirror = document.getElementById('mobNameMirrorInput');
      if (srcInput && mirror) {
        mirror.value = srcInput.value || '';
      }
      refresh();
    });

    // Native #playerNameInput -> Mirror Sync
    const nativeNameInput = document.getElementById('playerNameInput');
    if (nativeNameInput) {
      nativeNameInput.addEventListener('input', scheduleRefresh);
      nativeNameInput.addEventListener('change', scheduleRefresh);
    }

    // Event-driven sync on discrete external UI taps/changes (0.00ms/frame when idle)
    const onExternalUiEvent = (e) => {
      if (!isInternalLobbyNode(e.target)) {
        scheduleRefresh();
      }
    };
    document.addEventListener('click', onExternalUiEvent, { passive: true });
    document.addEventListener('pointerup', onExternalUiEvent, { passive: true });
    document.addEventListener('change', onExternalUiEvent, { passive: true });

    // Escape Key & Orientation Listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (worldModalEl?.classList.contains('on')) closeWorldModal();
          if (profileModalEl?.classList.contains('on')) closeProfileModal();
          if (partyModalEl?.classList.contains('on')) closePartyModal();
        }
      });

      const onFirstInteraction = () => {
        if (!orientationLockedOnce && isMobileTouchActive()) {
          tryLockLandscape();
        }
      };

      window.addEventListener(
        'touchstart',
        () => {
          const prevTouch = sawTouchInput;
          sawTouchInput = true;
          onFirstInteraction();
          if (!prevTouch) scheduleRefresh();
        },
        { passive: true }
      );
      window.addEventListener('click', onFirstInteraction, { passive: true });
      window.addEventListener(
        'resize',
        () => {
          syncRotateGuard();
          scheduleRefresh();
        },
        { passive: true }
      );
      window.addEventListener(
        'orientationchange',
        () => {
          orientationLockedOnce = false;
          syncRotateGuard();
          scheduleRefresh();
        },
        { passive: true }
      );
    }

    // Lightweight, rafPending-coalesced MutationObserver on external source nodes only
    if (typeof MutationObserver === 'function') {
      domObserver = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
          if (!isInternalLobbyNode(mutations[i].target)) {
            scheduleRefresh();
            return;
          }
        }
      });
      observeExternalSources();
    }
  }

  function mount() {
    if (typeof document === 'undefined') return;
    ensureStylesheetLinked();

    const appEl = document.getElementById('app') || document.body;
    const titleEl = document.getElementById('title');
    if (!appEl || !titleEl) return;

    if (!mounted) {
      buildLobbyShellDOM(titleEl);
      buildSubModalsDOM(appEl);
      mounted = true;
    }

    bindEventsAndObservers();
    resolveMP();
    refresh();
    // Schedule coalesced post-mount syncs so synchronous callers right after mount()
    // (such as main.js setting playerNameInput.value or assigning window.__hs.MP) are captured automatically.
    scheduleRefresh();
    if (typeof setTimeout === 'function') {
      setTimeout(() => {
        resolveMP();
        scheduleRefresh();
      }, 60);
    }
  }

  function setOfflineState(isOff) {
    const off = Boolean(isOff);
    const pill = document.getElementById('mobOfflinePill');
    if (pill) pill.classList.toggle('hidden', !off);
    const dot = document.querySelector('#mobProfileBtn .mob-prof-online');
    if (dot) dot.style.background = off ? '#e0822b' : '';
  }

  return {
    mount,
    mountUI: mount,
    refresh,
    setOfflineState,
    openWorldModal,
    closeWorldModal,
    openProfileModal,
    closeProfileModal,
    openPartyModal,
    closePartyModal,
    showPartyToast,
  };
}
