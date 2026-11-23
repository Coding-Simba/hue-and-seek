/* Hue & Seek — Mobile PWA & Offline Service Worker */
const CACHE_NAME = 'hueseek-mobile-v33';

const CORE_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './style.css',
  './hider_tricks.css',
  './seeker_gadgets.css',
  './world_events.css',
  './match_flow.css',
  './viral_highlights.css',
  './progression.css',
  './elemental_guns.css',
  './mobile_ui.css',
  './mobile_lobby.css',
  './tutorial.css',
  './hue_layer.css',
  './status_fx.css',
  './cloud_save.css',
  './main.js',
  './hue_layer.js',
  './status_fx.js',
  './cloud_save.js',
  './cloud_config.js',
  './haptics.js',
  './viral_highlights.js',
  './world_optimizer.js',
  './tutorial.js',
  './mobile_perf.js',
  './mobile_controls.js',
  './mobile_lobby.js',
  './seeker_skydrop.js',
  './assets/logo_mobile.webp',
  './audio.js',
  './ai_brains.js',
  './hero_cottage.js',
  './hider_tricks.js',
  './kit.js',
  './kit2.js',
  './match_flow.js',
  './multiplayer.js',
  './photon_config.js',
  './progression.js',
  './elemental_guns.js',
  './seeker_gadgets.js',
  './world_events.js',
  './world/meadow_animals.js',
  './world/meadow_underground.js',
  './world/meadow_features.js',
  './maps/world_interactives.js',
  './vendor/photon-realtime.esm.js',
  './vendor/three/three.module.js',
  './vendor/three-mesh-bvh/index.module.js',
  './assets/app_icons/icon-192.png',
  './assets/app_icons/icon-512.png',
];

function canonicalKey(url) {
  return url.origin + url.pathname;
}

function isAssetOrVendorPath(pathname) {
  return pathname.includes('/assets/') || pathname.includes('/vendor/');
}

function isAppShellCode(pathname, request) {
  if (request.mode === 'navigate') return true;
  return (
    pathname.endsWith('/') ||
    pathname.endsWith('.html') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.mjs') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.webmanifest')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        CORE_SHELL.map(async (relPath) => {
          const reqUrl = new URL(relPath, self.registration.scope);
          const res = await fetch(reqUrl.href, { cache: 'no-cache' });
          if (res && res.ok) {
            await cache.put(canonicalKey(reqUrl), res);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key.startsWith('hueseek-'))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

async function cacheFirst(request, key) {
  const cache = await caches.open(CACHE_NAME);
  const cached =
    (await cache.match(key)) ||
    (await cache.match(request, { ignoreSearch: true }));
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    cache.put(key, response.clone());
  }
  return response;
}

async function networkFirst(request, key) {
  const cache = await caches.open(CACHE_NAME);

  // Instant offline fallback when browser reports offline
  if (typeof self.navigator !== 'undefined' && self.navigator.onLine === false) {
    const offlineHit =
      (await cache.match(key)) ||
      (await cache.match(request, { ignoreSearch: true }));
    if (offlineHit) return offlineHit;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(key, response.clone());
    }
    return response;
  } catch (err) {
    const cached =
      (await cache.match(key)) ||
      (await cache.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const indexUrl = new URL('./index.html', self.registration.scope);
      const fallbackDoc = await cache.match(canonicalKey(indexUrl));
      if (fallbackDoc) return fallbackDoc;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const key = canonicalKey(url);

  if (isAssetOrVendorPath(url.pathname)) {
    event.respondWith(cacheFirst(request, key));
    return;
  }

  if (isAppShellCode(url.pathname, request)) {
    event.respondWith(networkFirst(request, key));
  }
});
