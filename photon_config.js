/* Hue & Seek — Global Cloud Multiplayer & Photon Configuration
 *
 * Out-of-the-Box Zero-Signup Global Multiplayer:
 *  • Works LIVE across separate phones (Android APK, iOS) and desktop browsers worldwide with ZERO account
 *    signup required via built-in Secure WebSocket MQTT v3.1.1 Cloud Relay (`wss://broker.emqx.io:8084/mqtt`
 *    with automatic failover to `wss://test.mosquitto.org:8081`, and offline `BroadcastChannel` fallback).
 *
 * Optional Dedicated Photon Cloud Tier (100 CCU / 0.3 TB Free Commercial Plan):
 *  • If you ever create a dedicated Photon Realtime App ID at https://dashboard.photonengine.com, paste the
 *    36-character UUID into `appId` below (or `?photonAppId=YOUR-UUID` / `localStorage.hs_photon_app_id`) and
 *    matchmaking automatically promotes to your dedicated Photon Cloud cluster (`ns.photonengine.io`).
 */

export const PHOTON_CONFIG = {
  // Dedicated Official Photon Realtime Cloud App ID (Tier-1 Global Matchmaking via ns.photonengine.io):
  appId: '0bbb7ba4-2f19-4003-ba82-fc78e5d2d17f',

  // Built-in Zero-Signup Global WSS Relay Brokers (automatic Tier-2 failover if Photon is unreachable)
  relayBrokers: [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081',
  ],

  // Automatic global matchmaking (no fixed region label shown to players)
  region: '',

  // Matchmaking version bucket (bump when changing network packet layout)
  appVersion: 'hueseek-5v5-v3',

  // Max matchmaking queue wait before backfilling remaining open slots (seconds)
  queueMaxSeconds: 8,

  // Duration of the animated 5v5 VS Clash intro screen before round start (seconds)
  vsIntroSeconds: 2.5,

  // Dedicated Photon Cloud tick rates (high-frequency silky interpolation on ns.photonengine.io)
  photonPlayerSyncHz: 15,
  photonBotSyncHz: 12,

  // Fallback Public Relay tick rates (coalesced into ~8 packets/sec per client — zero relay rate-limiting!)
  playerSyncHz: 8,
  botSyncHz: 8,
};

export function resolveAutoPhotonCluster() {
  if (PHOTON_CONFIG.region && typeof PHOTON_CONFIG.region === 'string' && PHOTON_CONFIG.region.trim()) {
    return PHOTON_CONFIG.region.trim().toLowerCase();
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/^(America|Canada|US|Pacific\/Honolulu)/i.test(tz)) return 'us';
    if (/^(Asia|Australia|Pacific\/Auckland)/i.test(tz)) return 'asia';
  } catch (_) { /* ignore */ }
  return 'eu';
}

export function resolvePhotonAppId() {
  try {
    const q = new URLSearchParams(location.search).get('photonAppId');
    if (q === 'off' || q === 'none' || q === '0') return '';
    if (q && /^[0-9a-fA-F-]{32,36}$/.test(q.trim())) {
      localStorage.setItem('hs_photon_app_id', q.trim());
      return q.trim();
    }
    if (typeof window !== 'undefined' && window.HS_PHOTON_APP_ID && /^[0-9a-fA-F-]{32,36}$/.test(window.HS_PHOTON_APP_ID.trim())) {
      return window.HS_PHOTON_APP_ID.trim();
    }
  } catch (_) { /* ignore URL/window errors */ }
  const cfg = (PHOTON_CONFIG.appId || '').trim();
  if (/^[0-9a-fA-F-]{32,36}$/.test(cfg)) return cfg;
  try {
    const saved = localStorage.getItem('hs_photon_app_id');
    if (saved && /^[0-9a-fA-F-]{32,36}$/.test(saved.trim())) {
      return saved.trim();
    }
  } catch (_) { /* ignore storage errors */ }
  return '';
}
