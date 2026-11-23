/* Hue & Seek — Global Zero-Signup Cloud Relay + Photon 5v5 Shared-Authority Matchmaking (multiplayer.js)
 *
 * Out-of-the-Box Global Multiplayer (Zero Account Signup Required):
 *  • Connects globally across phones (Android APK, iOS) and desktop browsers worldwide over Secure
 *    WebSockets (`wss://`) using a built-in zero-dependency binary MQTT v3.1.1 Cloud Relay client
 *    (`wss://broker.emqx.io:8084/mqtt` -> failover `wss://test.mosquitto.org:8081`).
 *  • Automatically promotes to dedicated Photon Cloud (`ns.photonengine.io`) if a Photon App ID UUID
 *    is ever pasted into `photon_config.js`, and falls back to `BroadcastChannel` if completely offline.
 *  • Simultaneous Queue Auto-Merge (`ROOM_BEACON`): Players tapping Play on the same map within
 *    milliseconds of each other deterministically merge into the same open 5v5 room.
 *  • Real Players Always Displace Backfill Slots: Whenever a real human player joins, they immediately
 *    claim a slot on their chosen team (Hide or Seek), displacing a provisional backfill AI slot.
 *  • Zero-Traffic Solo Optimization: If the lobby locks with only 1 real human, disconnects from the
 *    cloud relay immediately at match lock so solo matches consume 0 cloud bandwidth.
 */

import { Photon } from './vendor/photon-realtime.esm.js';
import { PHOTON_CONFIG, resolvePhotonAppId, resolveAutoPhotonCluster } from './photon_config.js?v=6';
import { TEAM_SIZE, pickBotHandles, randomPlayerHandle } from './ai_brains.js?v=15';

const EVT_QUEUE_SNAPSHOT = 10;
const EVT_MATCH_LOCK     = 11;
const EVT_PARTY_STATE    = 12;
const EVT_PARTY_START    = 13;
const EVT_PLAYER_STATE   = 20;
const EVT_BOT_STATES     = 21;
const EVT_SHOT           = 22;
const EVT_HIT            = 23;
const EVT_ROUND_END      = 24;
const EVT_GADGET         = 25;

const GAMERTAG_STORAGE_KEY = 'hs_gamertag';
export const PARTY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePartyCode() {
  let code = '';
  const len = PARTY_CODE_ALPHABET.length;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 4; i++) {
      code += PARTY_CODE_ALPHABET[bytes[i] % len];
    }
    return code;
  }
  for (let i = 0; i < 4; i++) {
    code += PARTY_CODE_ALPHABET[(Math.random() * len) | 0];
  }
  return code;
}

export function normalizePartyCode(raw) {
  const clean = String(raw ?? '')
    .replace(/[\s\-]+/g, '')
    .toUpperCase();
  return /^[A-Z0-9]{4}$/.test(clean) ? clean : '';
}

export function getInitialPartyCodeFromUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return '';
  try {
    if (loc.search) {
      const qRoom = new URLSearchParams(loc.search).get('room');
      const normQ = normalizePartyCode(qRoom);
      if (normQ) return normQ;
    }
    if (loc.hash) {
      const hashRaw = String(loc.hash).replace(/^#\/?\??/, '');
      const hParams = new URLSearchParams(hashRaw);
      const normH = normalizePartyCode(hParams.get('room'));
      if (normH) return normH;
      const m = hashRaw.match(/(?:^|[?&#])room=([^&#]+)/i);
      if (m && m[1]) {
        const normM = normalizePartyCode(decodeURIComponent(m[1]));
        if (normM) return normM;
      }
    }
  } catch (_) { /* ignore URL parse issues */ }
  return '';
}

export function getInitialPartyMapFromUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return '';
  try {
    if (loc.search) {
      const qMap = new URLSearchParams(loc.search).get('map');
      if (qMap) {
        const cleanQ = String(qMap).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 24);
        if (cleanQ && cleanQ !== 'tutorial') return cleanQ;
      }
    }
    if (loc.hash) {
      const hashRaw = String(loc.hash).replace(/^#\/?\??/, '');
      const hParams = new URLSearchParams(hashRaw);
      const hMap = hParams.get('map');
      if (hMap) {
        const cleanH = String(hMap).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 24);
        if (cleanH && cleanH !== 'tutorial') return cleanH;
      }
    }
  } catch (_) { /* ignore URL parse issues */ }
  return '';
}

function sanitizeGamertag(raw) {
  return String(raw || '')
    .replace(/[^\w\- .]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 16);
}

function makeActorId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const rand = (a, b) => a + Math.random() * (b - a);

function lerpNum(a, b, t) {
  return a + (b - a) * Math.min(1, t);
}

function lerpAng(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// ============================================================================
// Transport 1: Official Photon Cloud WSS Shared-Authority Room Transport
// Supports BOTH Photon Fusion App IDs (FusionPlugin) AND Photon Realtime/PUN App IDs!
// ============================================================================
function createCloudPhotonTransport(appId, callbacks) {
  const LBC = Photon.LoadBalancing.LoadBalancingClient;
  const State = LBC.State;
  const Consts = Photon.LoadBalancing.Constants;
  const RG = Consts.ReceiverGroup;
  const Op = Consts.OperationCode;
  const Err = Consts.ErrorCode;

  let client = null;
  let connectTimer = null;
  let lobbySettleTimer = null;
  let joinWaitTimer = null;
  let rttTimer = null;
  let closed = false;
  let useFusionPlugin = true;
  let evPktSeq = 0;
  let outboxBatch = [];
  let flushScheduled = false;
  const lastSeqByActor = new Map();
  let lastPeersSig = '';

  let activePartyCode = '';

  function safePeers() {
    if (!client || !client.isJoinedToRoom()) return [];
    const arr = client.myRoomActorsArray ? client.myRoomActorsArray() : [];
    return arr
      .filter((a) => a && !a.isSuspended?.())
      .sort((a, b) => a.actorNr - b.actorNr)
      .map((a) => ({
        actorId: String(a.actorNr),
        joinSeq: a.actorNr,
        name: sanitizeGamertag(a.name) || `Player_${a.actorNr}`,
        prefTeam: a.getCustomProperty('prefTeam') || 'hiders',
        spiritMap: a.getCustomProperty('spiritMap') || 'auto',
        hat: a.getCustomProperty('hat') || 'none',
        elemGun: a.getCustomProperty('elemGun') || 'water',
        isPartyHost: Boolean(a.getCustomProperty('isPartyHost')),
        partyMapId: a.getCustomProperty('partyMapId') || '',
        ping: Number(a.getCustomProperty('ping')) || 26,
        joinedClientMs: Number(a.getCustomProperty('joinedMs')) || 0,
      }));
  }

  function peersSignature(peers) {
    return peers
      .map((p) => `${p.actorId}:${p.name}:${p.prefTeam}:${p.spiritMap}:${p.hat}:${p.elemGun || 'water'}:${p.isPartyHost ? 1 : 0}:${p.partyMapId || ''}:${p.ping}`)
      .join('|');
  }

  function flushFusionOutbox() {
    flushScheduled = false;
    if (closed || !outboxBatch.length || !client || !client.isJoinedToRoom()) {
      outboxBatch = [];
      return;
    }
    const batch = outboxBatch;
    outboxBatch = [];
    try {
      client.myActor().setCustomProperty('_ev', JSON.stringify({ s: ++evPktSeq, b: batch }));
    } catch (_) { /* ignore */ }
  }

  return {
    kind: 'photon-cloud',
    partyCode() {
      return activePartyCode;
    },
    connectAndJoin({ mapId, myMeta, partyCode = '', quickPlay = false, rematchRoom = '' }) {
      closed = false;
      evPktSeq = 0;
      outboxBatch = [];
      flushScheduled = false;
      lastSeqByActor.clear();
      lastPeersSig = '';

      const normParty = normalizePartyCode(partyCode);
      activePartyCode = normParty;
      const isParty = Boolean(normParty);
      const isRematch = Boolean(rematchRoom && !isParty);
      const isQuickPlay = Boolean(quickPlay && !isParty && !isRematch);
      const partyRoomName = isParty ? `hs_party_${normParty}` : '';
      const rematchRoomName = isRematch ? String(rematchRoom).slice(0, 48) : '';

      const shard = resolveLobbyShard();
      const blockedNames = new Set();
      let joinRequested = false;
      let triedRoomName = null;
      let directJoinRetries = 0;
      let retryCount = 0;
      let lastSentRtt = myMeta.ping || 24;

      try {
        client = new LBC(Photon.ConnectionProtocol.Wss, appId, PHOTON_CONFIG.appVersion);
        client.autoJoinLobby = true;
      } catch (err) {
        callbacks.onTransportFallback?.(err);
        return;
      }

      const me = client.myActor();
      me.setName(myMeta.name);
      me.setCustomProperties({
        prefTeam: myMeta.prefTeam,
        spiritMap: myMeta.spiritMap,
        hat: myMeta.hat || 'none',
        elemGun: myMeta.elemGun || 'water',
        isPartyHost: myMeta.isPartyHost ? 1 : 0,
        partyMapId: myMeta.partyMapId || mapId || 'meadow',
        ping: lastSentRtt,
        joinedMs: Date.now(),
      });

      connectTimer = setTimeout(() => {
        if (!closed && (!client || !client.isJoinedToRoom())) {
          this.leave();
          callbacks.onTransportFallback?.(new Error('Photon Cloud connect timeout'));
        }
      }, 7200);

      const buildCreateOpts = () => {
        const opts = {
          isVisible: !isParty,
          isOpen: true,
          maxPlayers: TEAM_SIZE * 2,
          customGameProperties: isParty
            ? { map: mapId, phase: 'party', shard: `party_${normParty}`, partyCode: normParty }
            : { map: mapId, phase: 'queue', shard },
          propsListedInLobby: ['map', 'phase', 'shard'],
        };
        if (useFusionPlugin) opts.plugins = ['FusionPlugin'];
        return opts;
      };

      const attemptMatchmake = () => {
        if (closed || !client || joinRequested || !client.isConnectedToMaster()) return;
        joinRequested = true;
        clearTimeout(lobbySettleTimer);

        if (isParty) {
          triedRoomName = partyRoomName;
          directJoinRetries = 0;
          client.joinRoom(partyRoomName, { createIfNotExists: true }, buildCreateOpts());
          return;
        }

        if (isRematch) {
          triedRoomName = rematchRoomName;
          directJoinRetries = 0;
          client.joinRoom(rematchRoomName, { createIfNotExists: true }, buildCreateOpts());
          return;
        }

        const rooms = (client.availableRooms ? client.availableRooms() : []) || [];
        const openQueueRooms = rooms
          .filter((r) =>
            r &&
            !r.removed &&
            r.isOpen !== false &&
            (r.playerCount || 0) < TEAM_SIZE * 2 &&
            (isQuickPlay || r.getCustomProperty('map') === mapId) &&
            r.getCustomProperty('phase') === 'queue' &&
            (r.getCustomProperty('shard') || 'global') === shard &&
            !blockedNames.has(r.name)
          )
          .sort((a, b) => ((b.playerCount || 0) - (a.playerCount || 0)) || String(a.name).localeCompare(String(b.name)));

        if (openQueueRooms.length > 0) {
          triedRoomName = openQueueRooms[0].name;
          directJoinRetries = 1;
          client.joinRoom(triedRoomName);
          return;
        }

        const busyNames = new Set(rooms.filter((r) => r && !r.removed).map((r) => r.name));
        for (const b of blockedNames) busyNames.add(b);

        let candidateName = null;
        for (let slot = 0; slot < 24; slot++) {
          const nm = isQuickPlay ? `hs_${shard}_qp_${slot}` : `hs_${shard}_${mapId}_${slot}`;
          if (!busyNames.has(nm)) {
            candidateName = nm;
            break;
          }
        }

        triedRoomName = candidateName;
        directJoinRetries = 0;
        const expectedProps = isQuickPlay
          ? { phase: 'queue', shard }
          : { map: mapId, phase: 'queue', shard };
        client.joinRandomOrCreateRoom(
          {
            expectedCustomRoomProperties: expectedProps,
            expectedMaxPlayers: TEAM_SIZE * 2,
          },
          candidateName,
          buildCreateOpts()
        );
      };

      client.onRoomList = () => {
        if (!closed && !joinRequested && client && client.isInLobby()) {
          attemptMatchmake();
        }
      };

      client.onOperationResponse = (errCode, errMsg, opCode) => {
        if (closed || !client || errCode === 0) return;
        if (opCode !== Op.JoinRandomGame && opCode !== Op.JoinGame && opCode !== Op.CreateGame) return;

        // Auto-adapt if a user ever supplies a non-Fusion Realtime/PUN App ID (32751) or vice versa (32752)!
        if (errCode === 32751 && useFusionPlugin) {
          useFusionPlugin = false;
        } else if (errCode === 32752 && !useFusionPlugin) {
          useFusionPlugin = true;
        } else if (
          (errCode === Err.GameIdAlreadyExists || errCode === Err.GameDoesNotExist) &&
          triedRoomName &&
          directJoinRetries < 3 &&
          client.isConnectedToMaster()
        ) {
          // Simultaneous creator is finishing its ~55ms GameServer TLS handshake — wait 240ms and join!
          directJoinRetries += 1;
          clearTimeout(joinWaitTimer);
          joinWaitTimer = setTimeout(() => {
            if (!closed && client && client.isConnectedToMaster() && !client.isJoinedToRoom()) {
              if (isParty) {
                client.joinRoom(partyRoomName, { createIfNotExists: true }, buildCreateOpts());
              } else if (isRematch) {
                client.joinRoom(rematchRoomName, { createIfNotExists: true }, buildCreateOpts());
              } else {
                client.joinRoom(triedRoomName);
              }
            }
          }, 240 * directJoinRetries);
          return;
        } else if (triedRoomName && !isParty) {
          blockedNames.add(triedRoomName);
        }

        if (retryCount >= 6) return;
        retryCount += 1;
        joinRequested = false;

        if (client.isConnectedToMaster()) {
          attemptMatchmake();
        } else {
          try {
            client.disconnect();
            setTimeout(() => {
              if (!closed && client) {
                client.connectToRegionMaster(resolveAutoPhotonCluster());
              }
            }, 50);
          } catch (_) { /* ignore */ }
        }
      };

      client.onStateChange = (st) => {
        if (closed) return;
        if (st === State.Error) {
          this.leave();
          callbacks.onTransportFallback?.(new Error('Photon state error'));
          return;
        }
        if (st === State.JoinedLobby && !joinRequested) {
          clearTimeout(lobbySettleTimer);
          lobbySettleTimer = setTimeout(attemptMatchmake, 45);
        } else if (st === State.Joined) {
          clearTimeout(connectTimer);
          clearTimeout(lobbySettleTimer);
          clearTimeout(joinWaitTimer);
          clearInterval(rttTimer);

          // Prime existing actors' `_ev` sequence numbers so pre-join cached properties aren't replayed as live events
          const existingActors = client.myRoomActorsArray ? client.myRoomActorsArray() : [];
          for (const a of existingActors) {
            const raw = a && a.getCustomProperty ? a.getCustomProperty('_ev') : null;
            if (typeof raw === 'string' && raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.s === 'number') lastSeqByActor.set(a.actorNr, parsed.s);
              } catch (_) { /* ignore */ }
            }
          }
          lastPeersSig = peersSignature(safePeers());

          const syncPing = () => {
            if (closed || !client || !client.isJoinedToRoom()) return;
            try {
              client.updateRtt?.();
              const rtt = Math.round(client.getRtt?.() || 0);
              if (rtt >= 4 && rtt < 999 && Math.abs(rtt - lastSentRtt) >= 4) {
                lastSentRtt = rtt;
                client.myActor()?.setCustomProperty('ping', rtt);
              }
            } catch (_) { /* ignore */ }
          };
          setTimeout(syncPing, 650);
          rttTimer = setInterval(syncPing, 3000);
          const joinedRoomMap = client.myRoom()?.getCustomProperty?.('map') || mapId;
          callbacks.onJoined?.({
            myActorId: String(client.myActor().actorNr),
            roomId: client.myRoom()?.name || 'photon_room',
            roomMap: joinedRoomMap,
          });
        }
      };

      client.onEvent = (code, content, actorNr) => {
        if (closed) return;
        callbacks.onEvent?.(code, content, String(actorNr));
      };

      client.onActorJoin = () => {
        if (closed) return;
        const peers = safePeers();
        lastPeersSig = peersSignature(peers);
        callbacks.onPeersChanged?.(peers);
      };

      client.onActorLeave = (actor) => {
        if (closed) return;
        if (actor?.actorNr) lastSeqByActor.delete(actor.actorNr);
        const peers = safePeers();
        lastPeersSig = peersSignature(peers);
        callbacks.onPeerLeft?.(String(actor?.actorNr || ''), peers);
      };

      client.onActorPropertiesChange = (actor) => {
        if (closed || !client) return;
        const actorNr = actor?.actorNr;
        const rawEv = actor?.getCustomProperty ? actor.getCustomProperty('_ev') : null;
        if (typeof rawEv === 'string' && rawEv && actorNr) {
          try {
            const pkt = JSON.parse(rawEv);
            const prevSeq = lastSeqByActor.get(actorNr) || 0;
            if (pkt && typeof pkt.s === 'number' && pkt.s > prevSeq && Array.isArray(pkt.b)) {
              lastSeqByActor.set(actorNr, pkt.s);
              const myNr = client.myActor()?.actorNr;
              for (const entry of pkt.b) {
                if (!Array.isArray(entry) || entry.length < 2) continue;
                const [evCode, evData, isToAll] = entry;
                if (actorNr === myNr && !isToAll) continue;
                callbacks.onEvent?.(evCode, evData, String(actorNr));
              }
            }
          } catch (_) { /* ignore malformed */ }
        }
        const peers = safePeers();
        const sig = peersSignature(peers);
        if (sig !== lastPeersSig) {
          lastPeersSig = sig;
          callbacks.onPeersChanged?.(peers);
        }
      };

      try {
        client.connectToRegionMaster(resolveAutoPhotonCluster());
      } catch (err) {
        this.leave();
        callbacks.onTransportFallback?.(err);
      }
    },

    isJoined() {
      return !closed && !!client && client.isJoinedToRoom();
    },

    myActorId() {
      return client && client.myActor() ? String(client.myActor().actorNr) : '';
    },

    roomId() {
      return (client && client.myRoom && client.myRoom().name) || 'photon_room';
    },

    isMaster() {
      if (!this.isJoined()) return true;
      const masterNr = client.myRoomMasterActorNr ? client.myRoomMasterActorNr() : client.myActor().actorNr;
      return client.myActor().actorNr === masterNr;
    },

    masterActorId() {
      if (!this.isJoined()) return this.myActorId();
      return String(client.myRoomMasterActorNr ? client.myRoomMasterActorNr() : client.myActor().actorNr);
    },

    getPeers() {
      return safePeers();
    },

    lockRoom() {
      if (!this.isJoined()) return;
      try {
        const rm = client.myRoom();
        rm.setIsOpen(false);
        rm.setCustomProperty('phase', 'playing');
      } catch (_) { /* ignore */ }
    },

    reopenRoom() {
      if (!this.isJoined()) return;
      try {
        const rm = client.myRoom();
        rm.setIsOpen(true);
        rm.setCustomProperty('phase', activePartyCode ? 'party' : 'queue');
      } catch (_) { /* ignore */ }
    },

    updateLocalMeta(patch = {}) {
      if (!client || closed) return;
      try {
        const me = client.myActor();
        if (!me) return;
        if (patch.name) me.setName(patch.name);
        const props = {};
        if (patch.prefTeam) props.prefTeam = patch.prefTeam;
        if (patch.spiritMap) props.spiritMap = patch.spiritMap;
        if (patch.hat) props.hat = patch.hat;
        if (patch.elemGun) props.elemGun = patch.elemGun;
        if (typeof patch.isPartyHost === 'boolean' || typeof patch.isPartyHost === 'number') {
          props.isPartyHost = patch.isPartyHost ? 1 : 0;
        }
        if (patch.partyMapId) props.partyMapId = patch.partyMapId;
        if (Object.keys(props).length > 0) {
          me.setCustomProperties(props);
        }
      } catch (_) { /* ignore */ }
    },

    sendEvent(code, data, toAll = false) {
      if (!this.isJoined()) return;
      if (useFusionPlugin) {
        outboxBatch.push([code, data, toAll ? 1 : 0]);
        if (!flushScheduled) {
          flushScheduled = true;
          queueMicrotask(flushFusionOutbox);
        }
        return;
      }
      try {
        client.raiseEvent(code, data, { receivers: toAll ? RG.All : RG.Others });
      } catch (_) { /* ignore */ }
    },

    leave() {
      closed = true;
      outboxBatch = [];
      flushScheduled = false;
      clearTimeout(connectTimer);
      clearTimeout(lobbySettleTimer);
      clearTimeout(joinWaitTimer);
      clearInterval(rttTimer);
      if (client) {
        try {
          client.onStateChange = () => {};
          client.onOperationResponse = () => {};
          client.onRoomList = () => {};
          client.onEvent = () => {};
          client.onActorJoin = () => {};
          client.onActorLeave = () => {};
          client.onActorPropertiesChange = () => {};
          client.disconnect();
        } catch (_) { /* ignore */ }
        client = null;
      }
    },
  };
}

// ============================================================================
// Transport 2: Zero-Signup Global Cloud Relay (MQTT v3.1.1 over Secure WSS)
// ============================================================================
const _utf8Enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const _utf8Dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

function mqttEncodeVarLen(len) {
  const out = [];
  let x = len >>> 0;
  do {
    let b = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) b |= 0x80;
    out.push(b);
  } while (x > 0);
  return out;
}

function mqttDecodeVarLen(buf, offset) {
  let mul = 1;
  let val = 0;
  let pos = offset;
  for (let i = 0; i < 4; i++) {
    if (pos >= buf.length) return null;
    const b = buf[pos++];
    val += (b & 0x7f) * mul;
    if ((b & 0x80) === 0) {
      return { value: val, bytesRead: pos - offset };
    }
    mul *= 128;
  }
  return { value: -1, bytesRead: 4 };
}

function resolveLobbyShard() {
  try {
    if (typeof location !== 'undefined') {
      const raw = new URLSearchParams(location.search).get('lobby');
      if (raw) {
        const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28);
        if (clean) return clean;
      }
    }
  } catch (_) { /* ignore */ }
  return 'global';
}

function createGlobalCloudRelayTransport(callbacks) {
  const myId = makeActorId();
  const shard = resolveLobbyShard();
  const brokers = (Array.isArray(PHOTON_CONFIG.relayBrokers) && PHOTON_CONFIG.relayBrokers.length)
    ? PHOTON_CONFIG.relayBrokers
    : ['wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081'];

  let ws = null;
  let activeBrokerUrl = '';
  let rxBuf = new Uint8Array(0);
  let connAcked = false;
  let joined = false;
  let closed = false;
  let room = null;
  let pktSeq = 1;

  let connectTimer = null;
  let discoverTimer = null;
  let hbInterval = null;
  let beaconInterval = null;
  let pingInterval = null;
  let joinRetryTimer = null;
  let partyAnnounceTimer = null;
  let lastPingAt = 0;
  let activePartyCode = '';
  let localPeerRef = null;

  const subCallbacks = new Map();

  const lobbyTopicOf = (mId) => `hueseek/v4/${shard}/lobby/${mId}`;
  const partyTopicOf = (code) => `hueseek/v1/party/${code}`;
  const roomTopicOf = (rId) => (activePartyCode ? partyTopicOf(activePartyCode) : `hueseek/v4/${shard}/room/${rId}`);

  function nextPacketId() {
    pktSeq = (pktSeq % 65000) + 1;
    return pktSeq;
  }

  function wsSendRaw(bytes) {
    if (!ws || closed || ws.readyState !== 1) return false;
    try {
      ws.send(bytes);
      return true;
    } catch (_) {
      return false;
    }
  }

  function mqttConnect(clientId) {
    const cid = _utf8Enc.encode(clientId);
    const bodyLen = 10 + 2 + cid.length;
    const vl = mqttEncodeVarLen(bodyLen);
    const pkt = new Uint8Array(1 + vl.length + bodyLen);
    let o = 0;
    pkt[o++] = 0x10;
    for (let i = 0; i < vl.length; i++) pkt[o++] = vl[i];
    pkt.set([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x1e], o);
    o += 10;
    pkt[o++] = (cid.length >> 8) & 0xff;
    pkt[o++] = cid.length & 0xff;
    pkt.set(cid, o);
    wsSendRaw(pkt);
  }

  function mqttSubscribe(topic, onReady) {
    if (!connAcked || closed) return;
    const pid = nextPacketId();
    const tb = _utf8Enc.encode(topic);
    const bodyLen = 2 + 2 + tb.length + 1;
    const vl = mqttEncodeVarLen(bodyLen);
    const pkt = new Uint8Array(1 + vl.length + bodyLen);
    let o = 0;
    pkt[o++] = 0x82;
    for (let i = 0; i < vl.length; i++) pkt[o++] = vl[i];
    pkt[o++] = (pid >> 8) & 0xff;
    pkt[o++] = pid & 0xff;
    pkt[o++] = (tb.length >> 8) & 0xff;
    pkt[o++] = tb.length & 0xff;
    pkt.set(tb, o);
    o += tb.length;
    pkt[o++] = 0x00;

    if (onReady) {
      let fired = false;
      const done = () => {
        if (fired || closed) return;
        fired = true;
        subCallbacks.delete(pid);
        onReady();
      };
      const safetyT = setTimeout(done, 150);
      subCallbacks.set(pid, () => {
        clearTimeout(safetyT);
        done();
      });
    }
    wsSendRaw(pkt);
  }

  function mqttUnsubscribe(topic) {
    if (!connAcked || closed) return;
    const pid = nextPacketId();
    const tb = _utf8Enc.encode(topic);
    const bodyLen = 2 + 2 + tb.length;
    const vl = mqttEncodeVarLen(bodyLen);
    const pkt = new Uint8Array(1 + vl.length + bodyLen);
    let o = 0;
    pkt[o++] = 0xa2;
    for (let i = 0; i < vl.length; i++) pkt[o++] = vl[i];
    pkt[o++] = (pid >> 8) & 0xff;
    pkt[o++] = pid & 0xff;
    pkt[o++] = (tb.length >> 8) & 0xff;
    pkt[o++] = tb.length & 0xff;
    pkt.set(tb, o);
    wsSendRaw(pkt);
  }

  function mqttPublish(topic, obj) {
    if (!connAcked || closed) return;
    try {
      const tb = _utf8Enc.encode(topic);
      const pb = _utf8Enc.encode(JSON.stringify(obj));
      const bodyLen = 2 + tb.length + pb.length;
      const vl = mqttEncodeVarLen(bodyLen);
      const pkt = new Uint8Array(1 + vl.length + bodyLen);
      let o = 0;
      pkt[o++] = 0x30;
      for (let i = 0; i < vl.length; i++) pkt[o++] = vl[i];
      pkt[o++] = (tb.length >> 8) & 0xff;
      pkt[o++] = tb.length & 0xff;
      pkt.set(tb, o);
      o += tb.length;
      pkt.set(pb, o);
      wsSendRaw(pkt);
    } catch (_) { /* ignore serialization errors */ }
  }

  function sortedPeers() {
    if (!room) return [];
    return [...room.peers.values()].sort(
      (a, b) =>
        ((b.isPartyHost ? 1 : 0) - (a.isPartyHost ? 1 : 0)) ||
        (a.joinSeq - b.joinSeq) ||
        a.actorId.localeCompare(b.actorId)
    );
  }

  function masterPeerId() {
    const list = sortedPeers();
    return list.length ? list[0].actorId : myId;
  }

  function emitRoomBeacon(myPeer) {
    if (activePartyCode) return;
    if (closed || !joined || !room || room.phase !== 'queue') return;
    if (masterPeerId() !== myId || room.peers.size >= TEAM_SIZE * 2) return;
    const me = room.peers.get(myId) || myPeer;
    mqttPublish(lobbyTopicOf(room.mapId), {
      type: 'ROOM_BEACON',
      roomId: room.id,
      mapId: room.mapId,
      masterId: myId,
      masterPeer: me,
      count: room.peers.size,
      createdAt: room.createdAt,
    });
  }

  function scheduleJoinRetry(myPeer) {
    clearTimeout(joinRetryTimer);
    joinRetryTimer = setTimeout(() => {
      if (closed || !room || room.phase !== 'queue') return;
      if (masterPeerId() !== myId) {
        const me = room.peers.get(myId) || myPeer;
        mqttPublish(roomTopicOf(room.id), { type: 'JOIN', roomId: room.id, peer: me });
      }
    }, 680);
  }

  function finalizeJoin(myPeer) {
    if (joined || closed) return;
    joined = true;

    clearInterval(hbInterval);
    hbInterval = setInterval(() => {
      if (closed || !room) return;
      const now = Date.now();
      const me = room.peers.get(myId);
      if (me) me.lastSeen = now;
      mqttPublish(roomTopicOf(room.id), { type: 'HB', roomId: room.id, actorId: myId, peer: me || myPeer });
      let changed = false;
      for (const [pid, p] of room.peers.entries()) {
        if (pid !== myId && now - (p.lastSeen || now) > 9000) {
          room.peers.delete(pid);
          changed = true;
          callbacks.onPeerLeft?.(pid, sortedPeers());
        }
      }
      if (changed) callbacks.onPeersChanged?.(sortedPeers());
    }, 2200);

    clearInterval(beaconInterval);
    beaconInterval = setInterval(() => emitRoomBeacon(myPeer), 1150);

    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (closed || !connAcked) return;
      lastPingAt = performance.now();
      wsSendRaw(new Uint8Array([0xc0, 0x00]));
    }, 10000);

    callbacks.onJoined?.({
      myActorId: myId,
      roomId: room.id,
    });
  }

  const onUnload = () => {
    if (room && connAcked && !closed) {
      mqttPublish(roomTopicOf(room.id), { type: 'LEAVE', roomId: room.id, actorId: myId });
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
  }

  let pendingOutItems = [];
  let flushScheduled = false;

  function flushOutEvents() {
    flushScheduled = false;
    if (!pendingOutItems.length || closed || !joined || !connAcked || !room) {
      pendingOutItems = [];
      return;
    }
    const batch = pendingOutItems;
    pendingOutItems = [];
    if (batch.length === 1) {
      mqttPublish(roomTopicOf(room.id), {
        type: 'EVENT',
        roomId: room.id,
        fromId: myId,
        code: batch[0][0],
        data: batch[0][1],
      });
    } else {
      mqttPublish(roomTopicOf(room.id), {
        type: 'EVENT_BATCH',
        roomId: room.id,
        fromId: myId,
        items: batch,
      });
    }
  }

  return {
    kind: 'global-cloud',
    partyCode() {
      return activePartyCode;
    },
    brokerUrl() {
      return activeBrokerUrl;
    },
    connectAndJoin({ mapId, myMeta, partyCode = '' }) {
      closed = false;
      joined = false;
      connAcked = false;
      rxBuf = new Uint8Array(0);
      activePartyCode = normalizePartyCode(partyCode);
      const isParty = Boolean(activePartyCode);

      if (typeof WebSocket === 'undefined' || !_utf8Enc || !_utf8Dec) {
        callbacks.onTransportFallback?.(new Error('WebSocket unavailable'));
        return;
      }

      const nowMs = Date.now();
      const myPeer = {
        actorId: myId,
        joinSeq: nowMs + Math.random(),
        name: myMeta.name,
        prefTeam: myMeta.prefTeam,
        spiritMap: myMeta.spiritMap,
        hat: myMeta.hat || 'none',
        elemGun: myMeta.elemGun || 'water',
        isPartyHost: Boolean(myMeta.isPartyHost),
        partyMapId: myMeta.partyMapId || mapId || 'meadow',
        ping: myMeta.ping || 28,
        lastSeen: nowMs,
      };
      localPeerRef = myPeer;

      const lobbyTopic = lobbyTopicOf(mapId);
      let bestOffer = null;

      function applyIncomingPeerPatch(target, incoming) {
        if (!target || !incoming) return false;
        let dirty = false;
        for (const k of ['name', 'prefTeam', 'spiritMap', 'hat', 'elemGun', 'partyMapId']) {
          if (typeof incoming[k] === 'string' && incoming[k] && target[k] !== incoming[k]) {
            target[k] = incoming[k];
            dirty = true;
          }
        }
        if (typeof incoming.isPartyHost === 'boolean' && target.isPartyHost !== incoming.isPartyHost) {
          target.isPartyHost = incoming.isPartyHost;
          dirty = true;
        }
        if (typeof incoming.ping === 'number') target.ping = incoming.ping;
        return dirty;
      }

      function handleJsonMessage(topic, m) {
        if (closed || !m || typeof m !== 'object') return;

        // ---- Lobby Discovery & Simultaneous Queue Auto-Merge (Public Matchmaking ONLY) ----
        if (!isParty && topic === lobbyTopic) {
          if (m.type === 'DISCOVER' && m.fromId && m.fromId !== myId && joined && room && room.phase === 'queue' && room.mapId === m.mapId) {
            if (masterPeerId() === myId && room.peers.size < TEAM_SIZE * 2) {
              mqttPublish(lobbyTopic, {
                type: 'OFFER',
                targetId: m.fromId,
                roomId: room.id,
                mapId: room.mapId,
                createdAt: room.createdAt,
                peers: sortedPeers(),
              });
            }
            return;
          }

          if (m.type === 'OFFER' && !joined && m.targetId === myId && m.mapId === mapId && Array.isArray(m.peers)) {
            if (
              !bestOffer ||
              m.peers.length > bestOffer.peers.length ||
              (m.peers.length === bestOffer.peers.length && (m.createdAt || 0) < (bestOffer.createdAt || 0))
            ) {
              bestOffer = m;
            }
            return;
          }

          // Auto-merge two simultaneous solo queues into the older / fuller open room!
          if (
            m.type === 'ROOM_BEACON' &&
            joined &&
            room &&
            room.phase === 'queue' &&
            room.mapId === mapId &&
            room.peers.size === 1 &&
            m.mapId === mapId &&
            m.roomId &&
            m.roomId !== room.id &&
            m.masterId &&
            m.masterId !== myId &&
            (m.count || 1) < TEAM_SIZE * 2
          ) {
            const otherBigger = (m.count || 1) > 1;
            const otherOlder =
              (m.createdAt || 0) < (room.createdAt || 0) ||
              ((m.createdAt || 0) === (room.createdAt || 0) && String(m.masterId) < String(myId));

            if (otherBigger || otherOlder) {
              const oldRoomId = room.id;
              mqttUnsubscribe(roomTopicOf(oldRoomId));
              const mergedPeers = new Map();
              if (m.masterPeer && m.masterPeer.actorId) {
                mergedPeers.set(m.masterPeer.actorId, Object.assign({}, m.masterPeer, { lastSeen: Date.now() }));
              }
              myPeer.joinSeq = Math.max(myPeer.joinSeq, (m.masterPeer?.joinSeq || Date.now()) + 5 + Math.random());
              mergedPeers.set(myId, myPeer);
              room.id = m.roomId;
              room.createdAt = m.createdAt || room.createdAt;
              room.peers = mergedPeers;

              mqttSubscribe(roomTopicOf(room.id), () => {
                if (closed || !room || room.id !== m.roomId) return;
                mqttPublish(roomTopicOf(room.id), { type: 'JOIN', roomId: room.id, peer: myPeer });
                scheduleJoinRetry(myPeer);
              });
              callbacks.onPeersChanged?.(sortedPeers());
            }
            return;
          }
          return;
        }

        // ---- Active Room Protocol ----
        if (!room || m.roomId !== room.id) return;

        if (m.type === 'JOIN' && m.peer && m.peer.actorId) {
          if (m.peer.actorId === myId) return;
          const p = Object.assign({}, m.peer, { lastSeen: Date.now() });
          room.peers.set(p.actorId, p);
          if (isParty || masterPeerId() === myId) {
            mqttPublish(roomTopicOf(room.id), { type: 'PEERS_SYNC', roomId: room.id, peers: sortedPeers() });
          }
          callbacks.onPeersChanged?.(sortedPeers());
          return;
        }

        if (m.type === 'PEER_META' && m.peer && m.peer.actorId && m.peer.actorId !== myId) {
          const prev = room.peers.get(m.peer.actorId);
          if (prev) {
            prev.lastSeen = Date.now();
            applyIncomingPeerPatch(prev, m.peer);
          } else {
            room.peers.set(m.peer.actorId, Object.assign({}, m.peer, { lastSeen: Date.now() }));
          }
          callbacks.onPeersChanged?.(sortedPeers());
          return;
        }

        if (m.type === 'PEERS_SYNC' && Array.isArray(m.peers)) {
          clearTimeout(joinRetryTimer);
          const nextMap = new Map();
          for (const p of m.peers) {
            if (p && p.actorId) {
              if (p.actorId === myId) {
                nextMap.set(myId, Object.assign({}, myPeer, { lastSeen: Date.now() }));
              } else {
                nextMap.set(p.actorId, Object.assign({}, p, { lastSeen: Date.now() }));
              }
            }
          }
          if (!nextMap.has(myId)) nextMap.set(myId, Object.assign({}, myPeer, { lastSeen: Date.now() }));
          room.peers = nextMap;
          callbacks.onPeersChanged?.(sortedPeers());
          return;
        }

        if (m.type === 'HB' && m.actorId && m.actorId !== myId) {
          const prev = room.peers.get(m.actorId);
          if (prev) {
            prev.lastSeen = Date.now();
            if (applyIncomingPeerPatch(prev, m.peer)) {
              callbacks.onPeersChanged?.(sortedPeers());
            }
          } else if (m.peer) {
            room.peers.set(m.actorId, Object.assign({}, m.peer, { lastSeen: Date.now() }));
            callbacks.onPeersChanged?.(sortedPeers());
          }
          return;
        }

        if (m.type === 'LEAVE' && m.actorId && m.actorId !== myId) {
          if (room.peers.delete(m.actorId)) {
            callbacks.onPeerLeft?.(m.actorId, sortedPeers());
            callbacks.onPeersChanged?.(sortedPeers());
          }
          return;
        }

        if (m.type === 'LOCK_ROOM') {
          room.phase = 'playing';
          if (!isParty) mqttUnsubscribe(lobbyTopic);
          return;
        }

        if (m.type === 'REOPEN_ROOM') {
          room.phase = isParty ? 'party' : 'queue';
          return;
        }

        if (m.type === 'EVENT') {
          if (m.fromId === myId) return;
          const peerEntry = room.peers.get(m.fromId);
          if (peerEntry) peerEntry.lastSeen = Date.now();
          callbacks.onEvent?.(m.code, m.data, m.fromId);
          return;
        }

        if (m.type === 'EVENT_BATCH' && Array.isArray(m.items)) {
          if (m.fromId === myId) return;
          const peerEntry = room.peers.get(m.fromId);
          if (peerEntry) peerEntry.lastSeen = Date.now();
          for (const item of m.items) {
            if (Array.isArray(item) && item.length >= 2) {
              callbacks.onEvent?.(item[0], item[1], m.fromId);
            }
          }
        }
      }

      function onRoomDiscoveryReady() {
        if (isParty) {
          const createdAt = Date.now();
          room = {
            id: `hs_party_${activePartyCode}`,
            mapId,
            phase: 'party',
            createdAt,
            peers: new Map([[myId, myPeer]]),
          };
          const pTopic = partyTopicOf(activePartyCode);
          mqttSubscribe(pTopic, () => {
            if (closed || !room) return;
            finalizeJoin(myPeer);
            mqttPublish(pTopic, { type: 'JOIN', roomId: room.id, peer: myPeer });
            clearTimeout(partyAnnounceTimer);
            partyAnnounceTimer = setTimeout(() => {
              if (!closed && room && connAcked) {
                const me = room.peers.get(myId) || myPeer;
                mqttPublish(pTopic, { type: 'JOIN', roomId: room.id, peer: me });
              }
            }, 520);
          });
          return;
        }

        mqttSubscribe(lobbyTopic, () => {
          if (closed) return;
          mqttPublish(lobbyTopic, { type: 'DISCOVER', fromId: myId, mapId });
          discoverTimer = setTimeout(() => {
            if (closed) return;
            if (bestOffer && bestOffer.roomId) {
              const mapPeers = new Map();
              for (const p of bestOffer.peers) {
                if (p && p.actorId) mapPeers.set(p.actorId, Object.assign({}, p, { lastSeen: Date.now() }));
              }
              const maxSeq = [...mapPeers.values()].reduce((mx, p) => Math.max(mx, p.joinSeq || 0), Date.now());
              myPeer.joinSeq = maxSeq + 5 + Math.random();
              mapPeers.set(myId, myPeer);
              room = {
                id: bestOffer.roomId,
                mapId,
                phase: 'queue',
                createdAt: bestOffer.createdAt || Date.now(),
                peers: mapPeers,
              };
              mqttSubscribe(roomTopicOf(room.id), () => {
                if (closed || !room) return;
                mqttPublish(roomTopicOf(room.id), { type: 'JOIN', roomId: room.id, peer: myPeer });
                scheduleJoinRetry(myPeer);
                finalizeJoin(myPeer);
                callbacks.onPeersChanged?.(sortedPeers());
              });
            } else {
              const createdAt = Date.now();
              room = {
                id: `hs_${mapId}_${createdAt.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                mapId,
                phase: 'queue',
                createdAt,
                peers: new Map([[myId, myPeer]]),
              };
              mqttSubscribe(roomTopicOf(room.id), () => {
                if (closed || !room) return;
                finalizeJoin(myPeer);
                emitRoomBeacon(myPeer);
              });
            }
          }, 480);
        });
      }

      function tryBroker(idx) {
        if (closed) return;
        if (idx >= brokers.length) {
          callbacks.onTransportFallback?.(new Error('All global cloud relay brokers unreachable'));
          return;
        }

        const url = brokers[idx];
        activeBrokerUrl = url;
        rxBuf = new Uint8Array(0);
        connAcked = false;
        let advanced = false;

        const failAndAdvance = () => {
          if (advanced || closed || connAcked) return;
          advanced = true;
          clearTimeout(connectTimer);
          if (ws) {
            try {
              ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
              ws.close();
            } catch (_) { /* ignore */ }
            ws = null;
          }
          tryBroker(idx + 1);
        };

        connectTimer = setTimeout(failAndAdvance, 2800);

        let sock;
        try {
          sock = new WebSocket(url, 'mqtt');
          sock.binaryType = 'arraybuffer';
        } catch (_) {
          failAndAdvance();
          return;
        }
        ws = sock;
        let openPerfMs = 0;

        sock.onopen = () => {
          if (closed || ws !== sock) return;
          openPerfMs = performance.now();
          mqttConnect(`hs_${myId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`);
        };

        sock.onerror = () => {
          if (!connAcked) failAndAdvance();
        };

        sock.onclose = () => {
          if (closed || ws !== sock) return;
          if (!connAcked) {
            failAndAdvance();
          }
        };

        sock.onmessage = (ev) => {
          if (closed || ws !== sock || !(ev.data instanceof ArrayBuffer)) return;
          const chunk = new Uint8Array(ev.data);
          if (!chunk.length) return;

          if (rxBuf.length === 0) {
            rxBuf = chunk;
          } else {
            const merged = new Uint8Array(rxBuf.length + chunk.length);
            merged.set(rxBuf, 0);
            merged.set(chunk, rxBuf.length);
            rxBuf = merged;
          }

          while (rxBuf.length >= 2) {
            const dec = mqttDecodeVarLen(rxBuf, 1);
            if (!dec) break; // need more header bytes
            if (dec.value < 0) {
              rxBuf = new Uint8Array(0);
              break;
            }
            const hdrLen = 1 + dec.bytesRead;
            const totalLen = hdrLen + dec.value;
            if (rxBuf.length < totalLen) break; // wait for rest of payload

            const frame = rxBuf.subarray(0, totalLen);
            rxBuf = rxBuf.subarray(totalLen);

            const pktType = frame[0] >> 4;
            if (pktType === 2) {
              // CONNACK
              if (frame.length >= 4 && frame[3] === 0x00 && !connAcked) {
                connAcked = true;
                clearTimeout(connectTimer);
                const rtt = Math.max(12, Math.min(220, Math.round((performance.now() - openPerfMs) * 0.65)));
                myPeer.ping = rtt;
                onRoomDiscoveryReady();
              } else if (!connAcked) {
                failAndAdvance();
                return;
              }
            } else if (pktType === 9) {
              // SUBACK
              if (frame.length >= hdrLen + 2) {
                const pid = (frame[hdrLen] << 8) | frame[hdrLen + 1];
                const cb = subCallbacks.get(pid);
                if (cb) cb();
              }
            } else if (pktType === 13) {
              // PINGRESP -> update live measured RTT ping!
              if (lastPingAt > 0 && room) {
                const rtt = Math.max(11, Math.min(260, Math.round(performance.now() - lastPingAt)));
                myPeer.ping = rtt;
                const me = room.peers.get(myId);
                if (me) me.ping = rtt;
              }
            } else if (pktType === 3) {
              // PUBLISH
              const qos = (frame[0] >> 1) & 0x03;
              let p = hdrLen;
              if (p + 2 > frame.length) continue;
              const tLen = (frame[p] << 8) | frame[p + 1];
              p += 2;
              if (p + tLen > frame.length) continue;
              const topic = _utf8Dec.decode(frame.subarray(p, p + tLen));
              p += tLen;
              if (qos > 0) p += 2;
              if (p > frame.length) continue;
              let payloadObj = null;
              try {
                payloadObj = JSON.parse(_utf8Dec.decode(frame.subarray(p)));
              } catch (_) {
                payloadObj = null;
              }
              if (payloadObj) {
                try {
                  handleJsonMessage(topic, payloadObj);
                } catch (err) {
                  console.error('[MP] handleJsonMessage error:', err);
                }
              }
            }
          }
        };
      }

      tryBroker(0);
    },

    isJoined() {
      return !closed && joined && connAcked && !!room;
    },

    myActorId() {
      return myId;
    },

    roomId() {
      return room ? room.id : 'cloud_room';
    },

    isMaster() {
      return !this.isJoined() || masterPeerId() === myId;
    },

    masterActorId() {
      return masterPeerId();
    },

    getPeers() {
      return sortedPeers();
    },

    lockRoom() {
      if (!room) return;
      room.phase = 'playing';
      if (!activePartyCode) mqttUnsubscribe(lobbyTopicOf(room.mapId));
      mqttPublish(roomTopicOf(room.id), { type: 'LOCK_ROOM', roomId: room.id });
    },

    reopenRoom() {
      if (!room) return;
      room.phase = activePartyCode ? 'party' : 'queue';
      if (connAcked && !closed) {
        mqttPublish(roomTopicOf(room.id), { type: 'REOPEN_ROOM', roomId: room.id });
      }
    },

    updateLocalMeta(patch) {
      if (!patch || typeof patch !== 'object') return;
      if (localPeerRef) Object.assign(localPeerRef, patch);
      if (room) {
        const me = room.peers.get(myId);
        if (me) {
          Object.assign(me, patch, { lastSeen: Date.now() });
          if (typeof patch.partyMapId === 'string' && patch.partyMapId) {
            room.mapId = patch.partyMapId;
          }
          if (connAcked && !closed) {
            mqttPublish(roomTopicOf(room.id), { type: 'PEER_META', roomId: room.id, peer: me });
          }
        }
      }
    },

    sendEvent(code, data, toAll = false) {
      if (!this.isJoined()) return;
      if (toAll) {
        callbacks.onEvent?.(code, data, myId);
      }
      pendingOutItems.push([code, data]);
      if (!flushScheduled) {
        flushScheduled = true;
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(flushOutEvents);
        } else {
          Promise.resolve().then(flushOutEvents);
        }
      }
    },

    leave() {
      if (closed) return;
      closed = true;
      joined = false;
      clearTimeout(connectTimer);
      clearTimeout(discoverTimer);
      clearTimeout(joinRetryTimer);
      clearTimeout(partyAnnounceTimer);
      clearInterval(hbInterval);
      clearInterval(beaconInterval);
      clearInterval(pingInterval);
      subCallbacks.clear();
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onUnload);
        window.removeEventListener('beforeunload', onUnload);
      }
      if (room && connAcked) {
        mqttPublish(roomTopicOf(room.id), { type: 'LEAVE', roomId: room.id, actorId: myId });
      }
      connAcked = false;
      room = null;
      if (ws) {
        try {
          ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
          ws.close();
        } catch (_) { /* ignore */ }
        ws = null;
      }
    },
  };
}

// ============================================================================
// Transport 3: Offline Fallback Shared-Authority Room over BroadcastChannel
// ============================================================================
function createLocalRoomTransport(callbacks) {
  const myId = makeActorId();
  let chan = null;
  let joined = false;
  let closed = false;
  let room = null;
  let discoverTimer = null;
  let partyAnnounceTimer = null;
  let hbInterval = null;
  let activePartyCode = '';
  let localPeerRef = null;

  function sortedPeers() {
    if (!room) return [];
    return [...room.peers.values()].sort(
      (a, b) =>
        ((b.isPartyHost ? 1 : 0) - (a.isPartyHost ? 1 : 0)) ||
        (a.joinSeq - b.joinSeq) ||
        a.actorId.localeCompare(b.actorId)
    );
  }

  function masterPeerId() {
    const list = sortedPeers();
    return list.length ? list[0].actorId : myId;
  }

  function post(msg) {
    if (!chan || closed) return;
    try { chan.postMessage(msg); } catch (_) { /* ignore */ }
  }

  function finalizeJoin(myPeer) {
    if (joined || closed) return;
    joined = true;
    hbInterval = setInterval(() => {
      if (closed || !room) return;
      const now = Date.now();
      const me = room.peers.get(myId);
      if (me) me.lastSeen = now;
      post({ type: 'HB', roomId: room.id, actorId: myId, peer: me || myPeer });
      let changed = false;
      for (const [pid, p] of room.peers.entries()) {
        if (pid !== myId && now - (p.lastSeen || now) > 3600) {
          room.peers.delete(pid);
          changed = true;
          callbacks.onPeerLeft?.(pid, sortedPeers());
        }
      }
      if (changed) callbacks.onPeersChanged?.(sortedPeers());
    }, 950);

    callbacks.onJoined?.({
      myActorId: myId,
      roomId: room.id,
    });
  }

  const onUnload = () => {
    if (room && chan && !closed) {
      try { chan.postMessage({ type: 'LEAVE', roomId: room.id, actorId: myId }); } catch (_) { /* noop */ }
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', onUnload);

  return {
    kind: 'shared-local',
    partyCode() {
      return activePartyCode;
    },
    connectAndJoin({ mapId, myMeta, partyCode = '' }) {
      closed = false;
      joined = false;
      activePartyCode = normalizePartyCode(partyCode);
      const isParty = Boolean(activePartyCode);
      const myPeer = {
        actorId: myId,
        joinSeq: Date.now() + Math.random(),
        name: myMeta.name,
        prefTeam: myMeta.prefTeam,
        spiritMap: myMeta.spiritMap,
        hat: myMeta.hat || 'none',
        elemGun: myMeta.elemGun || 'water',
        isPartyHost: Boolean(myMeta.isPartyHost),
        partyMapId: myMeta.partyMapId || mapId || 'meadow',
        ping: myMeta.ping,
        lastSeen: Date.now(),
      };
      localPeerRef = myPeer;

      if (typeof BroadcastChannel === 'undefined') {
        room = {
          id: isParty ? `hs_party_${activePartyCode}` : `solo_${Date.now().toString(36)}`,
          mapId,
          phase: isParty ? 'party' : 'queue',
          peers: new Map([[myId, myPeer]]),
        };
        setTimeout(() => finalizeJoin(myPeer), 15);
        return;
      }

      chan = new BroadcastChannel(isParty ? `hueseek_party_${activePartyCode}` : 'hueseek_photon_shared_v1');
      let bestOffer = null;

      function applyIncomingLocalPatch(target, incoming) {
        if (!target || !incoming) return false;
        let dirty = false;
        for (const k of ['name', 'prefTeam', 'spiritMap', 'hat', 'elemGun', 'partyMapId']) {
          if (typeof incoming[k] === 'string' && incoming[k] && target[k] !== incoming[k]) {
            target[k] = incoming[k];
            dirty = true;
          }
        }
        if (typeof incoming.isPartyHost === 'boolean' && target.isPartyHost !== incoming.isPartyHost) {
          target.isPartyHost = incoming.isPartyHost;
          dirty = true;
        }
        if (typeof incoming.ping === 'number') target.ping = incoming.ping;
        return dirty;
      }

      chan.onmessage = (ev) => {
        if (closed || !ev?.data) return;
        const m = ev.data;

        if (!isParty && m.type === 'DISCOVER' && joined && room && room.phase === 'queue' && room.mapId === m.mapId) {
          // Room stays open to real humans even while provisional backfill bots are visible!
          if (masterPeerId() === myId && room.peers.size < TEAM_SIZE * 2) {
            post({
              type: 'OFFER',
              targetId: m.fromId,
              roomId: room.id,
              mapId: room.mapId,
              peers: sortedPeers(),
            });
          }
          return;
        }

        if (!isParty && m.type === 'OFFER' && !joined && m.targetId === myId && m.mapId === mapId) {
          if (!bestOffer || m.peers.length > bestOffer.peers.length) {
            bestOffer = m;
          }
          return;
        }

        if (!room || m.roomId !== room.id) return;

        if (m.type === 'JOIN' && m.peer) {
          if (m.peer.actorId === myId) return;
          const p = Object.assign({}, m.peer, { lastSeen: Date.now() });
          room.peers.set(p.actorId, p);
          post({ type: 'PEERS_SYNC', roomId: room.id, peers: sortedPeers() });
          callbacks.onPeersChanged?.(sortedPeers());
          return;
        }

        if (m.type === 'PEER_META' && m.peer && m.peer.actorId && m.peer.actorId !== myId) {
          const prev = room.peers.get(m.peer.actorId);
          if (prev) {
            prev.lastSeen = Date.now();
            applyIncomingLocalPatch(prev, m.peer);
          } else {
            room.peers.set(m.peer.actorId, Object.assign({}, m.peer, { lastSeen: Date.now() }));
          }
          callbacks.onPeersChanged?.(sortedPeers());
          return;
        }

        if (m.type === 'PEERS_SYNC' && Array.isArray(m.peers)) {
          for (const p of m.peers) {
            if (!p || !p.actorId) continue;
            if (p.actorId === myId) {
              room.peers.set(myId, Object.assign({}, myPeer, { lastSeen: Date.now() }));
            } else {
              room.peers.set(p.actorId, Object.assign({}, p, { lastSeen: Date.now() }));
            }
          }
          callbacks.onPeersChanged?.(sortedPeers());
          return;
        }

        if (m.type === 'HB' && m.actorId) {
          if (m.actorId === myId) return;
          const prev = room.peers.get(m.actorId);
          if (prev) {
            prev.lastSeen = Date.now();
            if (applyIncomingLocalPatch(prev, m.peer)) {
              callbacks.onPeersChanged?.(sortedPeers());
            }
          } else if (m.peer) {
            room.peers.set(m.actorId, Object.assign({}, m.peer, { lastSeen: Date.now() }));
            callbacks.onPeersChanged?.(sortedPeers());
          }
          return;
        }

        if (m.type === 'LEAVE' && m.actorId) {
          if (room.peers.delete(m.actorId)) {
            callbacks.onPeerLeft?.(m.actorId, sortedPeers());
            callbacks.onPeersChanged?.(sortedPeers());
          }
          return;
        }

        if (m.type === 'LOCK_ROOM') {
          room.phase = 'playing';
          return;
        }

        if (m.type === 'REOPEN_ROOM') {
          room.phase = isParty ? 'party' : 'queue';
          return;
        }

        if (m.type === 'EVENT') {
          if (m.fromId === myId && !m.toAll) return;
          callbacks.onEvent?.(m.code, m.data, m.fromId);
        }
      };

      if (isParty) {
        room = {
          id: `hs_party_${activePartyCode}`,
          mapId,
          phase: 'party',
          peers: new Map([[myId, myPeer]]),
        };
        finalizeJoin(myPeer);
        post({ type: 'JOIN', roomId: room.id, peer: myPeer });
        clearTimeout(partyAnnounceTimer);
        partyAnnounceTimer = setTimeout(() => {
          if (!closed && room) {
            post({ type: 'JOIN', roomId: room.id, peer: room.peers.get(myId) || myPeer });
          }
        }, 180);
        return;
      }

      post({ type: 'DISCOVER', fromId: myId, mapId });

      discoverTimer = setTimeout(() => {
        if (closed) return;
        if (bestOffer) {
          const mapPeers = new Map();
          for (const p of bestOffer.peers) {
            mapPeers.set(p.actorId, Object.assign({}, p, { lastSeen: Date.now() }));
          }
          myPeer.joinSeq = Date.now() + Math.random() + 10;
          mapPeers.set(myId, myPeer);
          room = { id: bestOffer.roomId, mapId, phase: 'queue', peers: mapPeers };
          post({ type: 'JOIN', roomId: room.id, peer: myPeer });
          finalizeJoin(myPeer);
          callbacks.onPeersChanged?.(sortedPeers());
        } else {
          room = {
            id: `hs_${mapId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            mapId,
            phase: 'queue',
            peers: new Map([[myId, myPeer]]),
          };
          finalizeJoin(myPeer);
        }
      }, 260);
    },

    isJoined() {
      return !closed && joined && !!room;
    },

    myActorId() {
      return myId;
    },

    roomId() {
      return room ? room.id : 'local_room';
    },

    isMaster() {
      return !this.isJoined() || masterPeerId() === myId;
    },

    masterActorId() {
      return masterPeerId();
    },

    getPeers() {
      return sortedPeers();
    },

    lockRoom() {
      if (!room) return;
      room.phase = 'playing';
      post({ type: 'LOCK_ROOM', roomId: room.id });
    },

    reopenRoom() {
      if (!room) return;
      room.phase = activePartyCode ? 'party' : 'queue';
      post({ type: 'REOPEN_ROOM', roomId: room.id });
    },

    updateLocalMeta(patch) {
      if (!patch || typeof patch !== 'object') return;
      if (localPeerRef) Object.assign(localPeerRef, patch);
      if (room) {
        const me = room.peers.get(myId);
        if (me) {
          Object.assign(me, patch, { lastSeen: Date.now() });
          if (typeof patch.partyMapId === 'string' && patch.partyMapId) {
            room.mapId = patch.partyMapId;
          }
          post({ type: 'PEER_META', roomId: room.id, peer: me });
        }
      }
    },

    sendEvent(code, data, toAll = false) {
      if (!this.isJoined()) return;
      if (toAll) {
        callbacks.onEvent?.(code, data, myId);
      }
      post({ type: 'EVENT', roomId: room.id, fromId: myId, code, data, toAll: false });
    },

    leave() {
      closed = true;
      joined = false;
      clearTimeout(discoverTimer);
      clearTimeout(partyAnnounceTimer);
      clearInterval(hbInterval);
      if (typeof window !== 'undefined') window.removeEventListener('beforeunload', onUnload);
      if (room && chan) {
        try { chan.postMessage({ type: 'LEAVE', roomId: room.id, actorId: myId }); } catch (_) { /* ignore */ }
      }
      if (chan) {
        try { chan.close(); } catch (_) { /* ignore */ }
        chan = null;
      }
      room = null;
    },
  };
}

// ============================================================================
// Natural Organic Arrival Schedule Generator
// ============================================================================
function buildNaturalBackfillSchedule(maxSec, excludeNames, mapId, mapOrder) {
  const handles = pickBotHandles(16, excludeNames);
  const altSpirits = (mapOrder || ['meadow']).filter((m) => m !== mapId);

  // Generate 10 organic arrival timestamps spread naturally across ~8%..90% of maxSec
  // (e.g. on a 30s max queue: first player arrives around 2.0s–3.6s, then natural solo/duo
  // arrivals every 1.2s–4.2s, finishing around 23s–27.8s so all 10 never dump in at once!)
  const firstAt = Math.min(maxSec * 0.14, rand(1.8, 3.4) * Math.min(1, maxSec / 18));
  const lastAt = maxSec * rand(0.78, 0.91);
  const span = Math.max(0.6, lastAt - firstAt);

  // Irregular human-feeling gap weights (occasional quick duo pair + natural search pauses)
  const gapPatterns = [0.55, 1.35, 0.42, 1.75, 1.15, 0.48, 1.60, 1.20, 1.05];
  shuffleInPlace(gapPatterns);
  const weightSum = gapPatterns.reduce((s, w) => s + w, 0) || 1;

  const times = [firstAt];
  let acc = firstAt;
  for (let i = 0; i < 9; i++) {
    const jitter = rand(0.84, 1.16);
    acc += (gapPatterns[i] / weightSum) * span * jitter;
    times.push(Math.min(maxSec - 0.95, acc));
  }
  times.sort((a, b) => a - b);

  // Interleave Hider & Seeker arrivals in random order (never robotic H-S-H-S-H-S!)
  const teamTags = shuffleInPlace([
    'hiders', 'hiders', 'hiders', 'hiders', 'hiders',
    'seekers', 'seekers', 'seekers', 'seekers', 'seekers',
  ]);

  const hiderBots = [];
  const seekerBots = [];
  for (let i = 0; i < 10; i++) {
    const name = handles[i] || randomPlayerHandle();
    const basePing = 19 + (((i * 13 + name.charCodeAt(0)) % 41));
    const entry = {
      actorId: `fill_${teamTags[i][0]}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      name,
      team: teamTags[i],
      isBot: true,
      joinAt: times[i],
      basePing,
      spiritMap: mapId === 'meadow'
        ? 'meadow'
        : (i % 3 !== 2 || !altSpirits.length ? mapId : altSpirits[i % altSpirits.length]),
    };
    if (entry.team === 'hiders') hiderBots.push(entry);
    else seekerBots.push(entry);
  }

  return { hiderBots, seekerBots };
}

// ============================================================================
// Multiplayer Queue, Roster, Friends Party Rooms & Live 5v5 Sync Manager
// ============================================================================
export function createMultiplayerManager(hooks = {}) {
  let playerName = '';
  try {
    const saved = sanitizeGamertag(localStorage.getItem(GAMERTAG_STORAGE_KEY));
    if (saved) playerName = saved;
  } catch (_) { /* ignore */ }
  if (!playerName) {
    playerName = randomPlayerHandle();
    try { localStorage.setItem(GAMERTAG_STORAGE_KEY, playerName); } catch (_) { /* ignore */ }
  }

  let transport = null;
  let state = 'idle'; // 'idle' | 'queue' | 'vs' | 'live' | 'solo_match'
  let queueCfg = null;
  let queueStartMs = 0;
  let queueTickTimer = null;
  let schedule = null;       // { hiderBots: [5], seekerBots: [5] }
  let lobbyFullSinceMs = 0;  // Brief 0.85s hold at 10/10 so the 10th player's join animation is visible!
  let activeRoster = null;
  let myActorId = 'local';
  let currentRound = 1;
  let playerSyncAcc = 0;
  let botSyncAcc = 0;

  // Private 4-Digit Friends Party Room state
  let partyCode = '';
  let isPartyHost = false;
  let partyMapId = 'meadow';
  let partyPrefTeam = 'hiders';
  let lastSyncedMapId = '';
  let urlPartyChecked = false;
  const partyListeners = new Set();

  const remoteTargets = new Map();

  const FALLBACK_WORLD_NAMES = {
    meadow: 'Meadowbrook',
    onsen: 'Bathhouse Town',
    castle: 'Clockwork Citadel',
    forest: 'Whisper Forest',
    bakery: 'Seaside Bakery',
    train: 'Sea Railway',
  };

  function sanitizeMapId(raw) {
    const clean = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 24);
    return clean && clean !== 'tutorial' ? clean : '';
  }

  function resolveDefaultMapId() {
    const fromHook = sanitizeMapId(hooks?.getActiveMapId?.());
    if (fromHook) return fromHook;
    if (typeof document !== 'undefined') {
      const activeCard = document.querySelector('#mapGrid .map-card.active[data-map]');
      const domMap = sanitizeMapId(activeCard?.dataset?.map);
      if (domMap) return domMap;
    }
    return 'meadow';
  }

  function resolveWorldTitle(mapId) {
    const mId = sanitizeMapId(mapId) || 'meadow';
    const metaTitle = hooks?.getWorldMeta?.(mId)?.title;
    if (metaTitle) return metaTitle;
    if (typeof document !== 'undefined') {
      const nameEl = document.querySelector(`#mapGrid .map-card[data-map="${mId}"] .map-name`);
      const txt = nameEl?.textContent?.trim();
      if (txt) return txt;
    }
    return FALLBACK_WORLD_NAMES[mId] || (mId.charAt(0).toUpperCase() + mId.slice(1));
  }

  function resolveLocalLoadout(overrides = {}) {
    const gHs = typeof window !== 'undefined' ? window.__hs : null;
    let spiritMap = overrides.spiritMap || hooks?.getSelectedSpirit?.() || '';
    if (!spiritMap && typeof document !== 'undefined') {
      const chip = document.querySelector('#spiritBar .spirit-chip.active[data-spirit]');
      if (chip?.dataset?.spirit) spiritMap = chip.dataset.spirit;
    }
    if (!spiritMap) spiritMap = 'auto';

    const hat = overrides.hat
      || hooks?.getEquippedHat?.()
      || gHs?.progression?.getEquipped?.('hat')
      || 'none';
    const elemGun = overrides.elemGun
      || hooks?.getActiveElemGun?.()
      || gHs?.progression?.getActiveElemGun?.()
      || 'water';
    const mapId = sanitizeMapId(overrides.mapId) || partyMapId || resolveDefaultMapId();
    const worldTitle = overrides.worldTitle || resolveWorldTitle(mapId);

    return { spiritMap, hat, elemGun, mapId, worldTitle };
  }

  function isCapacitorNative() {
    if (typeof window === 'undefined') return false;
    const cap = window.Capacitor;
    if (cap) {
      if (typeof cap.isNativePlatform === 'function') {
        try {
          if (cap.isNativePlatform()) return true;
        } catch (_) { /* ignore */ }
      } else {
        return true;
      }
    }
    const loc = window.location;
    if (!loc) return false;
    if (loc.protocol === 'https:' && loc.hostname === 'localhost') return true;
    if (loc.protocol !== 'http:' && loc.protocol !== 'https:') return true;
    return false;
  }

  function buildPartyShareUrl(code = partyCode, mapId = partyMapId) {
    const norm = normalizePartyCode(code || partyCode);
    if (!norm) return '';
    const mId = sanitizeMapId(mapId || partyMapId) || resolveDefaultMapId() || 'meadow';
    const query = `?room=${encodeURIComponent(norm)}&map=${encodeURIComponent(mId)}`;
    if (
      !isCapacitorNative() &&
      typeof window !== 'undefined' &&
      window.location &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ) {
      return `${window.location.origin}${window.location.pathname}${query}`;
    }
    return `https://oxadow.com/hueseek/${query}`;
  }

  function buildPartyShareText(code = partyCode, mapId = partyMapId) {
    const norm = normalizePartyCode(code || partyCode);
    if (!norm) return '';
    const mId = sanitizeMapId(mapId || partyMapId) || resolveDefaultMapId() || 'meadow';
    const worldTitle = resolveWorldTitle(mId);
    return `Join my 5v5 Hue & Seek party in ${worldTitle}! Free & no ads — tap the link or enter Code: ${norm}`;
  }

  function getPartyState() {
    if (!partyCode) {
      return {
        active: false,
        connected: false,
        code: '',
        isHost: false,
        mapId: resolveDefaultMapId(),
        prefTeam: partyPrefTeam,
        members: [],
        memberCount: 0,
        aiFillCount: TEAM_SIZE * 2,
        shareUrl: '',
        shareText: '',
      };
    }

    const joined = Boolean(transport && transport.isJoined() && transport.partyCode?.() === partyCode);
    const rawPeers = joined ? transport.getPeers() : [];
    const loadout = resolveLocalLoadout({ mapId: partyMapId });
    let members = [];

    if (rawPeers.length > 0) {
      const hasExplicitHost = rawPeers.some((p) => p && p.isPartyHost);
      members = rawPeers.map((p, idx) => {
        const isSelf = p.actorId === myActorId;
        const pref = isSelf ? partyPrefTeam : (p.prefTeam === 'seekers' ? 'seekers' : 'hiders');
        return {
          actorId: p.actorId,
          name: isSelf ? getPlayerName() : (p.name || 'Spirit'),
          isSelf,
          isHost: hasExplicitHost ? Boolean(p.isPartyHost) : idx === 0,
          prefTeam: pref,
          mode: pref === 'seekers' ? 'seek' : 'hide',
          spiritMap: p.spiritMap || loadout.spiritMap || 'auto',
          hat: p.hat || 'none',
          elemGun: p.elemGun || 'water',
          ping: p.ping || 24,
        };
      });
    } else {
      members = [{
        actorId: myActorId || 'local',
        name: getPlayerName(),
        isSelf: true,
        isHost: isPartyHost,
        prefTeam: partyPrefTeam,
        mode: partyPrefTeam === 'seekers' ? 'seek' : 'hide',
        spiritMap: loadout.spiritMap || 'auto',
        hat: loadout.hat || 'none',
        elemGun: loadout.elemGun || 'water',
        ping: 22,
      }];
    }

    const shareUrl = buildPartyShareUrl(partyCode, partyMapId);
    const shareText = buildPartyShareText(partyCode, partyMapId);
    return {
      active: true,
      connected: joined,
      code: partyCode,
      isHost: Boolean(isPartyHost),
      mapId: partyMapId,
      worldTitle: resolveWorldTitle(partyMapId),
      prefTeam: partyPrefTeam,
      members,
      memberCount: members.length,
      aiFillCount: Math.max(0, TEAM_SIZE * 2 - members.length),
      shareUrl,
      shareText,
    };
  }

  function notifyPartyListeners() {
    const snap = getPartyState();
    for (const fn of partyListeners) {
      try { fn(snap); } catch (err) { console.error('[MP] party listener error:', err); }
    }
    try { hooks?.onPartyStateChanged?.(snap); } catch (_) { /* ignore */ }
  }

  function onPartyChange(fn) {
    if (typeof fn !== 'function') return () => {};
    partyListeners.add(fn);
    return () => {
      partyListeners.delete(fn);
    };
  }

  function broadcastPartyState(extra = {}) {
    if (!partyCode || !transport || !transport.isJoined()) return;
    transport.sendEvent(EVT_PARTY_STATE, Object.assign({
      code: partyCode,
      hostActorId: isPartyHost ? myActorId : null,
      mapId: partyMapId,
      prefTeam: partyPrefTeam,
      name: getPlayerName(),
      ts: Date.now(),
    }, extra), false);
  }

  function syncPartyStateFromPeers(peersArg = null) {
    if (!partyCode) return;
    const peers = Array.isArray(peersArg)
      ? peersArg
      : (transport && transport.isJoined() ? transport.getPeers() : []);

    if (peers.length > 0) {
      const explicitHosts = peers.filter((p) => p && p.isPartyHost);
      if (explicitHosts.length === 0 && peers[0].actorId === myActorId && !isPartyHost) {
        isPartyHost = true;
        transport?.updateLocalMeta?.({ isPartyHost: true, partyMapId });
      } else if (explicitHosts.length > 1) {
        const masterId = transport ? transport.masterActorId() : peers[0].actorId;
        const shouldBeHost = masterId === myActorId;
        if (isPartyHost !== shouldBeHost) {
          isPartyHost = shouldBeHost;
          transport?.updateLocalMeta?.({ isPartyHost, partyMapId });
        }
      }

      const hostPeer = peers.find((p) => p && p.isPartyHost) || peers[0];
      if (!isPartyHost && hostPeer && hostPeer.actorId !== myActorId) {
        const hostMap = sanitizeMapId(hostPeer.partyMapId);
        if (hostMap) {
          const activeNow = sanitizeMapId(hooks?.getActiveMapId?.());
          const changed = hostMap !== partyMapId || hostMap !== lastSyncedMapId || (activeNow && activeNow !== hostMap);
          partyMapId = hostMap;
          if (changed && lastSyncedMapId !== hostMap) {
            lastSyncedMapId = hostMap;
            hooks?.onPartyMapChanged?.(hostMap);
          }
        }
      }
    }

    notifyPartyListeners();
  }

  function connectPartyTransport(loadoutOverrides = {}) {
    if (!partyCode) return;
    if (transport) {
      transport.leave();
      transport = null;
    }
    const loadout = resolveLocalLoadout(Object.assign({ mapId: partyMapId }, loadoutOverrides));
    const myMeta = {
      name: getPlayerName(),
      prefTeam: partyPrefTeam,
      spiritMap: loadout.spiritMap || 'auto',
      hat: loadout.hat || 'none',
      elemGun: loadout.elemGun || 'water',
      isPartyHost,
      partyMapId,
      ping: 19 + ((Math.random() * 24) | 0),
    };
    const startOpts = { mapId: partyMapId, myMeta, partyCode };
    const appId = resolvePhotonAppId();
    if (appId) {
      transport = createCloudPhotonTransport(appId, attachTransportCallbacks(startOpts, 'photon-cloud'));
    } else {
      transport = createGlobalCloudRelayTransport(attachTransportCallbacks(startOpts, 'global-cloud'));
    }
    transport.connectAndJoin(startOpts);
  }

  function clearUrlRoomParam() {
    if (typeof window === 'undefined' || !window.history?.replaceState || !window.location) return;
    try {
      const url = new URL(window.location.href);
      let touched = false;
      if (url.searchParams.has('room')) {
        url.searchParams.delete('room');
        url.searchParams.delete('map');
        touched = true;
      }
      if (url.hash && /room=/i.test(url.hash)) {
        url.hash = '';
        touched = true;
      }
      if (touched) {
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch (_) { /* ignore */ }
  }

  function createPartyRoom(mapId) {
    clearInterval(queueTickTimer);
    queueTickTimer = null;
    lobbyFullSinceMs = 0;
    queueCfg = null;
    schedule = null;
    if (transport) {
      transport.leave();
      transport = null;
    }
    if (state === 'queue') state = 'idle';

    partyCode = generatePartyCode();
    isPartyHost = true;
    partyMapId = sanitizeMapId(mapId) || resolveDefaultMapId() || 'meadow';
    lastSyncedMapId = partyMapId;

    connectPartyTransport({ mapId: partyMapId });
    notifyPartyListeners();
    return getPartyState();
  }

  function joinPartyRoom(code, opts = {}) {
    const norm = normalizePartyCode(code);
    if (!norm) return null;
    if (partyCode === norm && transport && transport.isJoined() && transport.partyCode?.() === norm) {
      notifyPartyListeners();
      return getPartyState();
    }

    clearInterval(queueTickTimer);
    queueTickTimer = null;
    lobbyFullSinceMs = 0;
    queueCfg = null;
    schedule = null;
    if (transport) {
      transport.leave();
      transport = null;
    }
    if (state === 'queue') state = 'idle';

    partyCode = norm;
    isPartyHost = false;
    const hintedMap = sanitizeMapId(opts.mapId || (opts.fromUrl ? getInitialPartyMapFromUrl() : ''));
    const curActive = sanitizeMapId(hooks?.getActiveMapId?.());
    partyMapId = hintedMap || curActive || resolveDefaultMapId() || 'meadow';
    lastSyncedMapId = '';

    if (hintedMap && (!curActive || curActive !== hintedMap)) {
      lastSyncedMapId = hintedMap;
      hooks?.onPartyMapChanged?.(hintedMap);
    }

    connectPartyTransport({ mapId: partyMapId });
    notifyPartyListeners();
    return getPartyState();
  }

  function leavePartyRoom() {
    clearInterval(queueTickTimer);
    queueTickTimer = null;
    lobbyFullSinceMs = 0;
    queueCfg = null;
    schedule = null;
    partyCode = '';
    isPartyHost = false;
    lastSyncedMapId = '';
    if (transport) {
      transport.leave();
      transport = null;
    }
    if (state === 'queue' || state === 'vs' || state === 'live') {
      state = 'idle';
    }
    clearUrlRoomParam();
    notifyPartyListeners();
    return getPartyState();
  }

  function setPartyMap(mapId) {
    const clean = sanitizeMapId(mapId);
    if (!clean) return partyMapId;
    partyMapId = clean;
    lastSyncedMapId = clean;
    if (partyCode && transport) {
      transport.updateLocalMeta?.({ partyMapId: clean });
      if (transport.isJoined()) {
        broadcastPartyState({ type: 'map', mapId: clean });
      }
    }
    notifyPartyListeners();
    return partyMapId;
  }

  function setPartyPreferredTeam(modeOrTeam) {
    partyPrefTeam = (modeOrTeam === 'seek' || modeOrTeam === 'seekers') ? 'seekers' : 'hiders';
    if (partyCode && transport) {
      transport.updateLocalMeta?.({ prefTeam: partyPrefTeam });
      if (transport.isJoined()) {
        broadcastPartyState({ type: 'role', prefTeam: partyPrefTeam });
      }
    }
    notifyPartyListeners();
    return partyPrefTeam;
  }

  async function copyTextSafe(text) {
    if (!text) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fallback below */ }
    if (typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return Boolean(ok);
      } catch (_) { /* ignore */ }
    }
    return false;
  }

  async function copyPartyCode() {
    if (!partyCode) return { ok: false, code: '' };
    const copied = await copyTextSafe(partyCode);
    return { ok: copied, method: 'clipboard', code: partyCode };
  }

  async function sharePartyInvite() {
    if (!partyCode) {
      return { ok: false, method: 'none', code: '', shareUrl: '', shareText: '' };
    }
    const st = getPartyState();
    const { code, shareUrl, shareText } = st;
    const clipboardPayload = `${shareText} ${shareUrl}`.trim();

    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardPayload);
        copied = true;
      } else {
        copied = await copyTextSafe(clipboardPayload);
      }
    } catch (_) {
      copied = await copyTextSafe(clipboardPayload);
    }

    let shared = false;
    if (typeof window !== 'undefined' && typeof window.HueSeekNativeShare?.shareText === 'function') {
      try {
        shared = Boolean(window.HueSeekNativeShare.shareText('Hue & Seek Party', clipboardPayload));
      } catch (_) {
        shared = false;
      }
    }
    if (!shared && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Hue & Seek Party',
          text: shareText,
          url: shareUrl,
        });
        shared = true;
      } catch (_) {
        shared = false;
      }
    }

    return {
      ok: Boolean(shared || copied || code),
      method: shared ? 'share' : 'clipboard',
      code,
      shareUrl,
      shareText,
    };
  }

  function applyPartyDeepLink(rawCode, rawMap) {
    const normCode = normalizePartyCode(rawCode);
    if (!normCode) return null;
    if (partyCode === normCode) return getPartyState();
    const cleanMap = rawMap
      ? String(rawMap).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().slice(0, 24)
      : '';
    const safeMap = cleanMap && cleanMap !== 'tutorial' ? cleanMap : '';
    const joinedState = joinPartyRoom(normCode, { mapId: safeMap, fromUrl: true });
    if (joinedState) {
      try { hooks?.onUrlPartyInviteJoined?.(joinedState); } catch (_) { /* ignore */ }
    }
    return joinedState;
  }

  function checkUrlPartyInvite() {
    urlPartyChecked = true;
    if (typeof window !== 'undefined' && window.__hueSeekPendingDeepLink) {
      const pending = window.__hueSeekPendingDeepLink;
      window.__hueSeekPendingDeepLink = null;
      const fromNative = applyPartyDeepLink(pending.room, pending.map);
      if (fromNative) return fromNative;
    }
    const urlCode = getInitialPartyCodeFromUrl();
    if (!urlCode) return null;
    const urlMap = getInitialPartyMapFromUrl();
    return applyPartyDeepLink(urlCode, urlMap);
  }

  function getPlayerName() {
    return playerName;
  }

  function setPlayerName(next) {
    const clean = sanitizeGamertag(next);
    if (clean.length >= 2) {
      playerName = clean;
      try { localStorage.setItem(GAMERTAG_STORAGE_KEY, playerName); } catch (_) { /* ignore */ }
      if (typeof document !== 'undefined') {
        const el = document.getElementById('playerNameInput');
        if (el && el.value !== playerName) el.value = playerName;
      }
      if (partyCode) {
        transport?.updateLocalMeta?.({ name: playerName });
        if (transport?.isJoined()) broadcastPartyState({ type: 'name', name: playerName });
        notifyPartyListeners();
      }
    }
    return playerName;
  }

  function rollPlayerName() {
    playerName = pickBotHandles(1, [playerName])[0] || randomPlayerHandle();
    try { localStorage.setItem(GAMERTAG_STORAGE_KEY, playerName); } catch (_) { /* ignore */ }
    if (partyCode) {
      transport?.updateLocalMeta?.({ name: playerName });
      if (transport?.isJoined()) broadcastPartyState({ type: 'name', name: playerName });
      notifyPartyListeners();
    }
    return playerName;
  }

  // Core slot allocator: Real Human Players ALWAYS claim slots first, cancelling scheduled bots
  // or replacing already-arrived bots on their chosen team!
  function composeLobbySlots(realPeers, elapsed, forceAllArrived = false) {
    const realHiders = [];
    const realSeekers = [];
    const usedNames = new Set();

    for (const p of realPeers) {
      usedNames.add(p.name.toLowerCase());
      const wantHider = p.prefTeam !== 'seekers';
      const slotObj = {
        actorId: p.actorId,
        name: p.name,
        team: wantHider ? 'hiders' : 'seekers',
        isBot: false,
        spiritMap: p.spiritMap === 'auto' ? (queueCfg?.mapId || 'meadow') : (p.spiritMap || 'meadow'),
        hat: p.hat || 'none',
        elemGun: p.elemGun || 'water',
        basePing: p.ping || 24,
        joinAt: 0,
      };
      if (wantHider && realHiders.length < TEAM_SIZE) {
        slotObj.team = 'hiders';
        realHiders.push(slotObj);
      } else if (!wantHider && realSeekers.length < TEAM_SIZE) {
        slotObj.team = 'seekers';
        realSeekers.push(slotObj);
      } else if (realHiders.length < TEAM_SIZE) {
        slotObj.team = 'hiders';
        realHiders.push(slotObj);
      } else if (realSeekers.length < TEAM_SIZE) {
        slotObj.team = 'seekers';
        realSeekers.push(slotObj);
      }
    }

    const needHiders = Math.max(0, TEAM_SIZE - realHiders.length);
    const needSeekers = Math.max(0, TEAM_SIZE - realSeekers.length);

    const schedH = (schedule?.hiderBots || [])
      .filter((b) => !usedNames.has(b.name.toLowerCase()))
      .slice(0, needHiders);
    const schedS = (schedule?.seekerBots || [])
      .filter((b) => !usedNames.has(b.name.toLowerCase()))
      .slice(0, needSeekers);

    const arrivedH = forceAllArrived ? schedH : schedH.filter((b) => elapsed >= b.joinAt);
    const arrivedS = forceAllArrived ? schedS : schedS.filter((b) => elapsed >= b.joinAt);

    return {
      hiders: [...realHiders, ...arrivedH].slice(0, TEAM_SIZE),
      seekers: [...realSeekers, ...arrivedS].slice(0, TEAM_SIZE),
      hasHumanHiders: realHiders.length > 0,
      hasHumanSeekers: realSeekers.length > 0,
    };
  }

  function finalizeRosterFromComposed(composed, realPeers, mapId, meta, roomId, masterActorId) {
    const skins = (meta.hiderSkins && meta.hiderSkins.length) ? meta.hiderSkins : ['classic'];
    const sKinds = (meta.seekerKinds && meta.seekerKinds.length) ? meta.seekerKinds : ['raincoat'];

    // Safety pad if any name collision reduced a slice by 1
    const allUsed = new Set([...composed.hiders, ...composed.seekers].map((x) => x.name.toLowerCase()));
    const spare = pickBotHandles(4, [...allUsed]);
    let spIdx = 0;
    while (composed.hiders.length < TEAM_SIZE) {
      composed.hiders.push({
        actorId: `fill_hx_${composed.hiders.length}`,
        name: spare[spIdx++] || randomPlayerHandle(),
        team: 'hiders',
        isBot: true,
        spiritMap: mapId,
        basePing: 27,
      });
    }
    while (composed.seekers.length < TEAM_SIZE) {
      composed.seekers.push({
        actorId: `fill_sx_${composed.seekers.length}`,
        name: spare[spIdx++] || randomPlayerHandle(),
        team: 'seekers',
        isBot: true,
        basePing: 31,
      });
    }

    const hiders = composed.hiders.map((slot, i) => ({
      actorId: slot.actorId,
      name: slot.name,
      team: 'hiders',
      slotIdx: i,
      isBot: !!slot.isBot,
      spiritMap: slot.spiritMap || mapId,
      hat: slot.hat || 'none',
      elemGun: slot.elemGun || 'water',
      skin: skins[i % skins.length],
      ping: slot.basePing || 25,
    }));

    const seekers = composed.seekers.map((slot, i) => ({
      actorId: slot.actorId,
      name: slot.name,
      team: 'seekers',
      slotIdx: i,
      isBot: !!slot.isBot,
      hat: slot.hat || 'none',
      elemGun: slot.elemGun || 'water',
      seekerKind: sKinds[i % sKinds.length],
      ping: slot.basePing || 28,
    }));

    const bothHumanSides = composed.hasHumanHiders && composed.hasHumanSeekers;
    return {
      roomId: roomId || 'local',
      partyCode: partyCode || '',
      mapId,
      roundNumber: 1,
      humanCount: realPeers.length,
      isLiveRoom: realPeers.length >= 2,
      masterActorId: masterActorId || (realPeers[0] && realPeers[0].actorId) || myActorId,
      hasHumanHiders: composed.hasHumanHiders,
      hasHumanSeekers: composed.hasHumanSeekers,
      prepSeconds: composed.hasHumanHiders ? 30 : 10,
      huntSeconds: 110,
      hiders,
      seekers,
    };
  }

  function buildInstantLocalRoster(mode, mapId, spiritMap, elemGun = 'water') {
    myActorId = 'local';
    currentRound = 1;
    const meta = hooks.getWorldMeta ? hooks.getWorldMeta(mapId) : {};
    queueCfg = { mode, mapId, spiritMap: spiritMap || 'auto', elemGun: elemGun || 'water', worldTitle: '', maxSec: 30 };
    schedule = buildNaturalBackfillSchedule(30, [getPlayerName()], mapId, meta.mapOrder);
    const me = {
      actorId: 'local',
      name: getPlayerName(),
      prefTeam: mode === 'seek' ? 'seekers' : 'hiders',
      spiritMap: spiritMap || 'auto',
      hat: 'none',
      elemGun: elemGun || 'water',
      ping: 22,
    };
    const composed = composeLobbySlots([me], 30, true);
    const r = finalizeRosterFromComposed(composed, [me], mapId, meta, `instant_${Date.now().toString(36)}`, 'local');
    r.localActorId = 'local';
    activeRoster = r;
    state = 'solo_match';
    return r;
  }

  let offlineFallback = false;

  function isNetworkOffline() {
    try {
      return typeof navigator !== 'undefined' && navigator.onLine === false;
    } catch (_) {
      return false;
    }
  }

  function isOffline() {
    return isNetworkOffline() || offlineFallback || (transport ? transport.kind === 'shared-local' : false);
  }

  function computeQueueStatusText(elapsed, maxSec, filledCount, worldTitle, realCount = 1) {
    const isPhoton = transport && transport.kind === 'photon-cloud';
    const offlineNow = isOffline();
    if (offlineNow) {
      if (filledCount >= TEAM_SIZE * 2) return '📡 Offline Mode — Launching solo 5v5 with smart AI squad!';
      return `📡 Offline Mode — No internet connection detected. Filling AI squad (${filledCount}/10)…`;
    }
    if (partyCode) {
      if (filledCount >= TEAM_SIZE * 2) return `Party ${partyCode} full (10/10) — Launching 5v5 match!`;
      if (elapsed < 0.9 && !(transport && transport.isJoined())) {
        return `Connecting Party Room ${partyCode}…`;
      }
      return `Party Room ${partyCode} · ${realCount} friend${realCount === 1 ? '' : 's'} + AI backfill (${filledCount}/10) in ${worldTitle}…`;
    }
    if (filledCount >= TEAM_SIZE * 2) return 'Lobby full (10/10) — Launching 5v5 match!';
    if (elapsed < 0.9 && !(transport && transport.isJoined())) {
      return isPhoton ? 'Connecting to global matchmaking…' : 'Connecting to global cloud relay…';
    }
    if (realCount >= 2 && filledCount <= 4) return `Live lobby · ${filledCount}/10 players in ${worldTitle}…`;
    if (filledCount <= 2) return `Searching ${worldTitle} · Waiting for players (${filledCount}/10)…`;
    if (filledCount <= 6) return `Players joining ${worldTitle} (${filledCount}/10)…`;
    if (filledCount <= 8) return `Filling remaining 5v5 slots (${filledCount}/10)…`;
    return `Almost full · Waiting for final player (${filledCount}/10)…`;
  }

  function buildQueueSnapshot(realPeers, elapsed, maxSec, worldTitle) {
    const composed = composeLobbySlots(realPeers, elapsed, false);
    const jitterStep = Math.floor(elapsed * 0.7);
    const formatPreviewSlot = (s, idx) => {
      // Subtle ±2ms realistic live ping fluctuation + brief 0.55s "joining" handshake on newly arrived players!
      const wave = ((idx * 7 + jitterStep + s.name.charCodeAt(0)) % 5) - 2;
      const livePing = Math.max(12, (s.basePing || 26) + wave);
      const isJoining = s.joinAt > 0 && (elapsed - s.joinAt) < 0.55;
      return {
        actorId: s.actorId,
        name: s.name,
        spiritMap: s.spiritMap || queueCfg?.mapId || 'meadow',
        hat: s.hat || 'none',
        ping: livePing,
        joining: isJoining,
        isSelf: s.actorId === myActorId,
        isBot: !!s.isBot,
      };
    };

    const hPreview = composed.hiders.map(formatPreviewSlot);
    const sPreview = composed.seekers.map(formatPreviewSlot);
    const filledCount = hPreview.length + sPreview.length;
    const offlineNow = isOffline();

    return {
      elapsed: Math.min(maxSec, elapsed),
      maxSec,
      filledCount,
      humanCount: realPeers.length,
      lobbyFull: filledCount >= TEAM_SIZE * 2,
      partyCode: partyCode || '',
      hiders: hPreview,
      seekers: sPreview,
      offline: offlineNow,
      region: '',
      statusText: computeQueueStatusText(elapsed, maxSec, filledCount, worldTitle, realPeers.length),
    };
  }

  function handleLockedRoster(roster) {
    if (state !== 'queue' && !(partyCode && state === 'idle')) return;
    clearInterval(queueTickTimer);
    queueTickTimer = null;

    myActorId = transport ? transport.myActorId() : myActorId;
    currentRound = roster.roundNumber || 1;
    roster.localActorId = myActorId;
    activeRoster = roster;
    remoteTargets.clear();

    // Free cloud relay traffic when solo-backfilled (1 human + 9 smart AI)!
    if ((roster.humanCount || 1) <= 1) {
      if (transport) {
        transport.leave();
        transport = null;
      }
    }
    state = 'vs';
    hooks.onMatchLocked?.(roster);
  }

  let eventSeq = 0;
  const seenEventIds = new Set();
  const seenEventRing = [];
  const recentReliable = []; // { code, data, until } piggybacked on EVT_PLAYER_STATE (0 extra MQTT pkts!)

  function recordSeenEventId(eid) {
    if (!eid) return true;
    if (seenEventIds.has(eid)) return false;
    seenEventIds.add(eid);
    seenEventRing.push(eid);
    if (seenEventRing.length > 160) {
      const oldest = seenEventRing.shift();
      seenEventIds.delete(oldest);
    }
    return true;
  }

  function sendReliableEvent(code, payload, toAll = false) {
    if (!transport || !transport.isJoined()) return;
    const eid = `${myActorId}_${++eventSeq}`;
    const tagged = Object.assign({ _eid: eid }, payload);
    if (code === EVT_MATCH_LOCK || code === EVT_ROUND_END) {
      transport.sendEvent(code, tagged, toAll);
      const savedTransport = transport;
      for (const delayMs of [160, 420]) {
        setTimeout(() => {
          if (transport === savedTransport && savedTransport.isJoined()) {
            savedTransport.sendEvent(code, tagged, false);
          }
        }, delayMs);
      }
      return;
    }
    recentReliable.push({ code, data: tagged, until: performance.now() + 750 });
    while (recentReliable.length > 8) recentReliable.shift();
    playerSyncAcc = 0; // Pause redundant state packet right after discrete priority event!
    transport.sendEvent(code, tagged, toAll);
  }

  function lockQueueAsMaster(forceAll = true) {
    if (state !== 'queue' || !queueCfg) return;
    const peers = transport && transport.isJoined() && transport.getPeers().length
      ? transport.getPeers()
      : [{
          actorId: myActorId,
          name: getPlayerName(),
          prefTeam: queueCfg.mode === 'seek' ? 'seekers' : 'hiders',
          spiritMap: queueCfg.spiritMap || 'auto',
          hat: queueCfg.hat || 'none',
          elemGun: queueCfg.elemGun || 'water',
          ping: 22,
        }];
    const elapsed = (performance.now() - queueStartMs) / 1000;
    const meta = hooks.getWorldMeta ? hooks.getWorldMeta(queueCfg.mapId) : {};
    if (transport) transport.lockRoom();
    const composed = composeLobbySlots(peers, elapsed, forceAll);
    const roster = finalizeRosterFromComposed(
      composed,
      peers,
      queueCfg.mapId,
      meta,
      transport ? transport.roomId() : (partyCode ? `hs_party_${partyCode}` : 'solo_room'),
      transport ? transport.masterActorId() : myActorId
    );
    if (transport && transport.isJoined() && peers.length >= 2) {
      sendReliableEvent(EVT_MATCH_LOCK, roster, true);
    } else {
      handleLockedRoster(roster);
    }
  }

  function tickQueue() {
    if (state !== 'queue' || !queueCfg) return;
    const nowMs = performance.now();
    const maxSec = queueCfg.maxSec;
    const elapsed = (nowMs - queueStartMs) / 1000;
    const joined = transport && transport.isJoined();
    const isMaster = !joined || transport.isMaster();

    if (!isMaster) return;

    const peers = joined && transport.getPeers().length
      ? transport.getPeers()
      : [{
          actorId: myActorId,
          name: getPlayerName(),
          prefTeam: queueCfg.mode === 'seek' ? 'seekers' : 'hiders',
          spiritMap: queueCfg.spiritMap || 'auto',
          hat: queueCfg.hat || 'none',
          elemGun: queueCfg.elemGun || 'water',
          ping: 23,
        }];

    const snap = buildQueueSnapshot(peers, elapsed, maxSec, queueCfg.worldTitle);
    hooks.onQueueTick?.(snap);
    if (joined && peers.length >= 2) {
      transport.sendEvent(EVT_QUEUE_SNAPSHOT, snap, false);
    }

    if (snap.filledCount >= TEAM_SIZE * 2) {
      if (!lobbyFullSinceMs) lobbyFullSinceMs = nowMs;
      // Hold 0.80s once 10/10 fills so the 10th player's arrival animation settles cleanly
      if (nowMs - lobbyFullSinceMs >= 800 || elapsed >= maxSec - 0.05) {
        lockQueueAsMaster(true);
      }
      return;
    }

    lobbyFullSinceMs = 0;
    if (elapsed >= maxSec - 0.05) {
      lockQueueAsMaster(true);
    }
  }

  function executePartyMatchLaunch(mode = 'hide', opts = {}, peerTeamOverride = null) {
    const targetMapId = sanitizeMapId(opts.mapId) || partyMapId || resolveDefaultMapId() || 'meadow';
    if (isPartyHost && targetMapId !== partyMapId) {
      partyMapId = targetMapId;
    }
    const loadout = resolveLocalLoadout(Object.assign({ mapId: targetMapId }, opts));
    const joined = Boolean(transport && transport.isJoined() && transport.partyCode?.() === partyCode);
    if (joined) {
      myActorId = transport.myActorId();
      transport.updateLocalMeta?.({
        name: getPlayerName(),
        prefTeam: partyPrefTeam,
        spiritMap: loadout.spiritMap,
        hat: loadout.hat,
        elemGun: loadout.elemGun,
        isPartyHost,
        partyMapId: targetMapId,
      });
    } else if (!myActorId) {
      myActorId = 'local';
    }

    const rawPeers = joined && transport.getPeers().length ? transport.getPeers() : [];
    const effectivePeers = rawPeers.length
      ? rawPeers.map((p) => {
          if (p.actorId === myActorId) {
            return Object.assign({}, p, {
              name: getPlayerName(),
              prefTeam: partyPrefTeam,
              spiritMap: loadout.spiritMap,
              hat: loadout.hat,
              elemGun: loadout.elemGun,
            });
          }
          if (peerTeamOverride && p.actorId === peerTeamOverride.actorId && peerTeamOverride.prefTeam) {
            return Object.assign({}, p, { prefTeam: peerTeamOverride.prefTeam });
          }
          return p;
        })
      : [{
          actorId: myActorId || 'local',
          name: getPlayerName(),
          prefTeam: partyPrefTeam,
          spiritMap: loadout.spiritMap,
          hat: loadout.hat,
          elemGun: loadout.elemGun,
          ping: 22,
        }];

    clearInterval(queueTickTimer);
    queueTickTimer = null;
    currentRound = 1;
    queueStartMs = performance.now() - 30000;
    lobbyFullSinceMs = 0;

    const meta = hooks.getWorldMeta ? hooks.getWorldMeta(targetMapId) : {};
    queueCfg = {
      mode,
      mapId: targetMapId,
      spiritMap: loadout.spiritMap,
      hat: loadout.hat,
      elemGun: loadout.elemGun,
      worldTitle: loadout.worldTitle,
      maxSec: 30,
    };
    schedule = buildNaturalBackfillSchedule(
      30,
      effectivePeers.map((p) => p.name),
      targetMapId,
      meta.mapOrder
    );

    state = 'queue';
    if (transport) transport.lockRoom();
    const composed = composeLobbySlots(effectivePeers, 30, true);
    const roster = finalizeRosterFromComposed(
      composed,
      effectivePeers,
      targetMapId,
      meta,
      joined ? transport.roomId() : `hs_party_${partyCode || 'solo'}`,
      joined ? transport.masterActorId() : (myActorId || 'local')
    );

    if (joined && effectivePeers.length >= 2) {
      sendReliableEvent(EVT_MATCH_LOCK, roster, true);
    } else {
      handleLockedRoster(roster);
    }
    return { ok: true, roster, mode, mapId: targetMapId };
  }

  function startPartyMatch(mode = 'hide', opts = {}) {
    const cleanMode = mode === 'seek' ? 'seek' : 'hide';
    partyPrefTeam = cleanMode === 'seek' ? 'seekers' : 'hiders';

    if (!partyCode) {
      createPartyRoom(opts.mapId);
    } else if (transport) {
      transport.updateLocalMeta?.({ prefTeam: partyPrefTeam });
      notifyPartyListeners();
    }

    const joined = Boolean(transport && transport.isJoined() && transport.partyCode?.() === partyCode);
    const peers = joined ? transport.getPeers() : [];
    const delegatedGuest = joined && peers.length >= 2 && !isPartyHost && !transport.isMaster();

    if (delegatedGuest) {
      broadcastPartyState({ type: 'role', prefTeam: partyPrefTeam });
      sendReliableEvent(EVT_PARTY_START, {
        code: partyCode,
        mode: cleanMode,
        requestedBy: myActorId,
        prefTeam: partyPrefTeam,
      }, false);
      return { ok: true, delegatedToHost: true, mode: cleanMode, mapId: partyMapId };
    }

    return executePartyMatchLaunch(cleanMode, opts, null);
  }

  let lastMatchRoomId = '';
  let lastMatchMapId = 'meadow';
  let rematchGen = 0;

  function attachTransportCallbacks(startOpts, tier = 'global-cloud') {
    return {
      onJoined({ myActorId: aid, roomId, roomMap }) {
        myActorId = aid;
        if (roomId) lastMatchRoomId = String(roomId);
        if (queueCfg && roomMap && roomMap !== 'any' && roomMap !== 'tutorial' && roomMap !== queueCfg.mapId) {
          queueCfg.mapId = roomMap;
          queueCfg.worldTitle = resolveWorldTitle(roomMap);
          lastMatchMapId = roomMap;
          hooks.onQueueMapResolved?.(roomMap, queueCfg.worldTitle);
        } else if (queueCfg && queueCfg.mapId) {
          lastMatchMapId = queueCfg.mapId;
        }
        if (partyCode) {
          syncPartyStateFromPeers();
          broadcastPartyState({ type: isPartyHost ? 'host_sync' : 'hello' });
        }
        tickQueue();
      },
      onPeersChanged(peers) {
        if (partyCode) {
          syncPartyStateFromPeers(peers);
          if (isPartyHost) {
            broadcastPartyState({ type: 'host_sync' });
          }
        }
        if (state === 'queue' && (!transport || transport.isMaster())) tickQueue();
      },
      onPeerLeft(leftActorId, remainingPeers) {
        if (partyCode) {
          syncPartyStateFromPeers(remainingPeers);
        }
        if (state === 'queue') {
          if (!transport || transport.isMaster()) tickQueue();
          return;
        }
        if ((state === 'live' || state === 'vs') && activeRoster) {
          const remCount = (remainingPeers || []).length;
          const newMaster = remCount <= 1 || !transport || !transport.isJoined()
            ? myActorId
            : transport.masterActorId();
          activeRoster.masterActorId = newMaster;
          for (const slot of [...(activeRoster.hiders || []), ...(activeRoster.seekers || [])]) {
            if (slot && slot.actorId === leftActorId) slot.isBot = true;
          }
          const liveHumans = [...(activeRoster.hiders || []), ...(activeRoster.seekers || [])]
            .filter((p) => p && !p.isBot).length;
          activeRoster.humanCount = Math.max(1, liveHumans);
          activeRoster.isLiveRoom = activeRoster.humanCount >= 2;
          activeRoster.hasHumanHiders = (activeRoster.hiders || []).some((p) => p && !p.isBot);
          activeRoster.hasHumanSeekers = (activeRoster.seekers || []).some((p) => p && !p.isBot);

          for (const [ch] of remoteTargets) {
            if (ch?.userData?.actor?.id === leftActorId) remoteTargets.delete(ch);
          }
          const nowMaster = remCount <= 1 || !transport || !transport.isJoined() ? true : transport.isMaster();
          if (nowMaster) {
            for (const [ch] of remoteTargets) {
              if (ch?.userData?.actor?.isBot) remoteTargets.delete(ch);
            }
          }
          hooks.onRemotePeerLeft?.(leftActorId, nowMaster, newMaster);
          if (remCount <= 1) {
            if (transport && !partyCode) {
              transport.leave();
              transport = null;
            }
            if (state === 'live') state = 'solo_match';
          }
        }
      },
      onTransportFallback() {
        if (state !== 'queue' && !partyCode) return;
        if (tier === 'photon-cloud' && !isNetworkOffline()) {
          transport = createGlobalCloudRelayTransport(attachTransportCallbacks(startOpts, 'global-cloud'));
          transport.connectAndJoin(startOpts);
          return;
        }
        offlineFallback = true;
        transport = createLocalRoomTransport(attachTransportCallbacks(startOpts, 'shared-local'));
        transport.connectAndJoin(startOpts);
        if (state === 'queue') tickQueue();
      },
      onEvent(code, data) {
        if (data && data._eid && !recordSeenEventId(data._eid)) return;

        if (code === EVT_PARTY_STATE && partyCode && data) {
          if (data.code && normalizePartyCode(data.code) !== partyCode) return;
          if (!isPartyHost && data.mapId) {
            const nextMap = sanitizeMapId(data.mapId);
            if (nextMap) {
              const curActive = sanitizeMapId(hooks?.getActiveMapId?.());
              partyMapId = nextMap;
              if (lastSyncedMapId !== nextMap || (curActive && curActive !== nextMap)) {
                lastSyncedMapId = nextMap;
                hooks?.onPartyMapChanged?.(nextMap);
              }
            }
          }
          if (isPartyHost && data.type === 'hello') {
            broadcastPartyState({ type: 'host_sync' });
            if (state === 'queue') tickQueue();
          }
          syncPartyStateFromPeers();
          return;
        }

        if (code === EVT_PARTY_START && partyCode && data) {
          if (data.code && normalizePartyCode(data.code) !== partyCode) return;
          if ((isPartyHost || (transport && transport.isMaster())) && (state === 'idle' || state === 'queue')) {
            const hostMode = partyPrefTeam === 'seekers' ? 'seek' : 'hide';
            executePartyMatchLaunch(hostMode, { mapId: partyMapId }, {
              actorId: data.requestedBy,
              prefTeam: data.prefTeam,
            });
          }
          return;
        }

        if (code === EVT_QUEUE_SNAPSHOT && state === 'queue') {
          if (transport && !transport.isMaster() && data) {
            const myIdNow = transport.myActorId();
            const markSelf = (arr) => (arr || []).map((p) => Object.assign({}, p, {
              isSelf: p.actorId ? p.actorId === myIdNow : p.name === getPlayerName(),
            }));
            hooks.onQueueTick?.(Object.assign({}, data, {
              hiders: markSelf(data.hiders),
              seekers: markSelf(data.seekers),
            }));
          }
          return;
        }
        if (code === EVT_MATCH_LOCK && (state === 'queue' || (partyCode && state === 'idle')) && data) {
          handleLockedRoster(data);
          return;
        }
        if (state !== 'live' || !data) return;
        if (data.r && data.r !== currentRound) return; // Ignore stale packets from previous round
        if (code === EVT_PLAYER_STATE) {
          onNetPlayerState(data);
          if (Array.isArray(data.ev)) {
            for (const pair of data.ev) {
              if (!Array.isArray(pair) || pair.length < 2) continue;
              const [ec, ed] = pair;
              if (!ed || (ed.r && ed.r !== currentRound)) continue;
              if (ed._eid && !recordSeenEventId(ed._eid)) continue;
              if (ec === EVT_HIT) hooks.onRemoteHit?.(ed);
              else if (ec === EVT_ROUND_END) hooks.onRemoteRoundEnd?.(ed);
              else if (ec === EVT_GADGET) hooks.onRemoteGadget?.(ed);
            }
          }
        } else if (code === EVT_BOT_STATES) {
          onNetBotStates(data);
        } else if (code === EVT_SHOT) {
          hooks.onRemoteShot?.(data);
        } else if (code === EVT_HIT) {
          hooks.onRemoteHit?.(data);
        } else if (code === EVT_ROUND_END) {
          hooks.onRemoteRoundEnd?.(data);
        } else if (code === EVT_GADGET) {
          hooks.onRemoteGadget?.(data);
        }
      },
    };
  }

  function enterQueue({ mode = 'hide', mapId = 'meadow', spiritMap = 'auto', hat = 'none', elemGun = 'water', worldTitle = 'Storybook World', maxSecOverride = null, quickPlay = false, rematchRoom = '' } = {}) {
    partyPrefTeam = mode === 'seek' ? 'seekers' : 'hiders';

    if (partyCode) {
      leaveSession({ keepPartyTransport: true });
      const effectiveMapId = isPartyHost
        ? (sanitizeMapId(mapId) || partyMapId || 'meadow')
        : (partyMapId || sanitizeMapId(mapId) || 'meadow');
      if (isPartyHost && effectiveMapId !== partyMapId) {
        partyMapId = effectiveMapId;
        lastSyncedMapId = effectiveMapId;
      }
      const effectiveWorldTitle = worldTitle && effectiveMapId === mapId
        ? worldTitle
        : resolveWorldTitle(effectiveMapId);

      const qParam = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('queueSec')) : NaN;
      const maxSec = (typeof maxSecOverride === 'number' && maxSecOverride > 0)
        ? maxSecOverride
        : (!Number.isNaN(qParam) && qParam > 0 && qParam <= 30 ? qParam : (PHOTON_CONFIG.queueMaxSeconds || 30));

      const meta = hooks.getWorldMeta ? hooks.getWorldMeta(effectiveMapId) : {};
      state = 'queue';
      currentRound = 1;
      queueStartMs = performance.now();
      lobbyFullSinceMs = 0;
      queueCfg = {
        mode,
        mapId: effectiveMapId,
        spiritMap,
        hat,
        elemGun,
        worldTitle: effectiveWorldTitle,
        maxSec,
      };

      const existingPeers = transport && transport.isJoined() ? transport.getPeers() : [];
      const excludeNames = existingPeers.length ? existingPeers.map((p) => p.name) : [getPlayerName()];
      schedule = buildNaturalBackfillSchedule(maxSec, excludeNames, effectiveMapId, meta.mapOrder);

      if (transport && transport.isJoined() && transport.partyCode?.() === partyCode) {
        myActorId = transport.myActorId();
        transport.reopenRoom?.();
        transport.updateLocalMeta?.({
          name: getPlayerName(),
          prefTeam: partyPrefTeam,
          spiritMap: spiritMap || 'auto',
          hat: hat || 'none',
          elemGun: elemGun || 'water',
          isPartyHost,
          partyMapId: effectiveMapId,
        });
        if (isPartyHost) broadcastPartyState({ type: 'queue', mapId: effectiveMapId });
      } else {
        myActorId = 'local';
        connectPartyTransport({ mapId: effectiveMapId, spiritMap, hat, elemGun });
      }

      notifyPartyListeners();
      tickQueue();
      queueTickTimer = setInterval(tickQueue, 220);
      return;
    }

    leaveSession();
    const qParam = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('queueSec')) : NaN;
    const maxSec = (typeof maxSecOverride === 'number' && maxSecOverride > 0)
      ? maxSecOverride
      : (!Number.isNaN(qParam) && qParam > 0 && qParam <= 30 ? qParam : (PHOTON_CONFIG.queueMaxSeconds || 30));

    const meta = hooks.getWorldMeta ? hooks.getWorldMeta(mapId) : {};
    state = 'queue';
    myActorId = 'local';
    currentRound = 1;
    queueStartMs = performance.now();
    lobbyFullSinceMs = 0;
    queueCfg = { mode, mapId, spiritMap, hat, elemGun, worldTitle, maxSec };
    schedule = buildNaturalBackfillSchedule(maxSec, [getPlayerName()], mapId, meta.mapOrder);

    const myMeta = {
      name: getPlayerName(),
      prefTeam: mode === 'seek' ? 'seekers' : 'hiders',
      spiritMap: spiritMap || 'auto',
      hat: hat || 'none',
      elemGun: elemGun || 'water',
      ping: 19 + ((Math.random() * 24) | 0),
    };

    const startOpts = { mapId, myMeta, quickPlay: Boolean(quickPlay), rematchRoom: rematchRoom || '' };
    offlineFallback = isNetworkOffline();
    if (offlineFallback) {
      transport = createLocalRoomTransport(attachTransportCallbacks(startOpts, 'shared-local'));
    } else {
      const appId = resolvePhotonAppId();
      if (appId) {
        transport = createCloudPhotonTransport(appId, attachTransportCallbacks(startOpts, 'photon-cloud'));
      } else {
        transport = createGlobalCloudRelayTransport(attachTransportCallbacks(startOpts, 'global-cloud'));
      }
    }
    transport.connectAndJoin(startOpts);

    tickQueue();
    queueTickTimer = setInterval(tickQueue, 220);
  }

  function hasRematchLobby() {
    return Boolean(partyCode || lastMatchRoomId || activeRoster?.roomId);
  }

  function rematchSameLobby({ mode = 'hide', mapId = null, spiritMap = 'auto', hat = 'none', elemGun = 'water', worldTitle = null, maxSecOverride = null } = {}) {
    const cleanMode = mode === 'seek' ? 'seek' : 'hide';
    const targetMapId = sanitizeMapId(mapId) || lastMatchMapId || resolveDefaultMapId() || 'meadow';
    const resolvedTitle = worldTitle || resolveWorldTitle(targetMapId);
    if (partyCode) {
      return enterQueue({
        mode: cleanMode,
        mapId: targetMapId,
        spiritMap,
        hat,
        elemGun,
        worldTitle: resolvedTitle,
        maxSecOverride,
      });
    }
    const baseRaw = String(lastMatchRoomId || activeRoster?.roomId || `qp_${targetMapId}`).replace(/^hs_rm_/, '').replace(/_g\d+$/, '');
    rematchGen = (rematchGen || 0) + 1;
    const nextRematchRoom = `hs_rm_${baseRaw.slice(0, 28)}_g${rematchGen}`;
    try {
      if (isLiveSession()) {
        broadcastGadget({ k: 'rematch_vote', who: getPlayerName(), room: nextRematchRoom, mapId: targetMapId });
      }
    } catch (_) { /* ignore */ }
    return enterQueue({
      mode: cleanMode,
      mapId: targetMapId,
      spiritMap,
      hat,
      elemGun,
      worldTitle: resolvedTitle,
      maxSecOverride,
      quickPlay: false,
      rematchRoom: nextRematchRoom,
    });
  }

  function queueForMatch(mode = 'hide', mapId = null, opts = {}) {
    const cleanMode = mode === 'seek' ? 'seek' : 'hide';
    const targetMapId = partyCode
      ? (isPartyHost ? (sanitizeMapId(mapId) || partyMapId) : (partyMapId || sanitizeMapId(mapId) || 'meadow'))
      : (sanitizeMapId(mapId) || resolveDefaultMapId() || 'meadow');
    const loadout = resolveLocalLoadout(Object.assign({ mapId: targetMapId }, opts));
    return enterQueue({
      mode: cleanMode,
      mapId: targetMapId,
      spiritMap: loadout.spiritMap,
      hat: loadout.hat,
      elemGun: loadout.elemGun,
      worldTitle: loadout.worldTitle,
      maxSecOverride: opts.maxSecOverride ?? null,
    });
  }

  function cancelQueue() {
    leaveSession();
  }

  function forceLockQueueNow() {
    if (state === 'queue') lockQueueAsMaster(true);
  }

  function resetForNextRound(swappedRoster) {
    remoteTargets.clear();
    playerSyncAcc = 0;
    botSyncAcc = 0;
    if (swappedRoster) {
      currentRound = swappedRoster.roundNumber || (currentRound + 1);
      if (activeRoster) Object.assign(activeRoster, swappedRoster);
      else activeRoster = swappedRoster;
    } else {
      currentRound += 1;
    }
    if (transport && transport.isJoined() && activeRoster && activeRoster.humanCount >= 2) {
      state = 'vs';
    }
  }

  function markMatchStarted() {
    playerSyncAcc = 0;
    botSyncAcc = 0;
    if (transport && transport.isJoined() && activeRoster && activeRoster.humanCount >= 2) {
      state = 'live';
    } else {
      state = 'solo_match';
    }
  }

  function isLiveSession() {
    return state === 'live' && !!transport && transport.isJoined();
  }

  function isMaster() {
    if (!isLiveSession()) return true;
    return transport.isMaster();
  }

  function transportKind() {
    return transport ? (transport.kind || 'unknown') : 'none';
  }

  // --------------------------------------------------------------------------
  // Live 5v5 State Encoding, Decoding & Smooth Interpolation
  // --------------------------------------------------------------------------
  function encodeSpecialSpotKey(ch) {
    const u = ch?.userData;
    if (!u || !u.specialMode || !u.specialSpot) return '';
    if (u.specialSpot.id) return `id:${u.specialSpot.id}`;
    const sx = Math.round((u.specialSpot.x || ch.position.x) * 10);
    const sz = Math.round((u.specialSpot.z || ch.position.z) * 10);
    return `${u.specialMode}:${sx},${sz}`;
  }

  function applyRemoteAppearance(ch, propId, specialKey) {
    if (!ch || !hooks) return;
    const u = ch.userData;
    const curSpecial = encodeSpecialSpotKey(ch);
    if (specialKey) {
      if (curSpecial !== specialKey) {
        hooks.applyRemoteSpecialSpot?.(ch, specialKey);
      }
      return;
    }
    if (u.specialMode) {
      hooks.exitSpecialSpot?.(ch, true);
    }
    if (propId) {
      if (u.propId !== propId) {
        hooks.disguise?.(ch, propId);
      }
    } else if (u.propId) {
      hooks.undisguise?.(ch);
    }
  }

  function onNetPlayerState(pkt) {
    const ch = hooks.getCharBySlot?.(pkt.t === 1 ? 'seekers' : 'hiders', pkt.s);
    if (!ch || ch === hooks.getLocalPlayer?.() || !ch.userData?.actor?.isRemote) return;
    const [x, gy, z, rotY, jy, vy] = pkt.p;
    const prev = remoteTargets.get(ch);
    remoteTargets.set(ch, {
      x, groundY: gy, z, rotY, jy: jy || 0, vy: vy || 0,
      moving: !!pkt.m, aim: !!pkt.aim,
      propId: pkt.d || '', specialKey: pkt.sp || '',
      hp: pkt.hp, maxHp: pkt.mhp, eliminated: !!pkt.el,
      paint: typeof pkt.pt === 'number' ? Math.max(0, Math.min(1, pkt.pt / 100)) : null,
      snap: !prev,
    });
  }

  function onNetBotStates(pkt) {
    if (isMaster()) return;
    if (pkt.ph && typeof pkt.rt === 'number') {
      hooks.onRemotePhaseSync?.(pkt.ph, pkt.rt);
    }
    if (!Array.isArray(pkt.b)) return;
    for (const row of pkt.b) {
      const [tCode, slotIdx, x, gy, z, rotY, jy, vy, propId, specialKey, moving, aim, hp, elim, markChar] = row;
      const ch = hooks.getCharBySlot?.(tCode === 1 ? 'seekers' : 'hiders', slotIdx);
      if (!ch || ch === hooks.getLocalPlayer?.() || !ch.userData?.actor?.isRemote) continue;
      const prev = remoteTargets.get(ch);
      remoteTargets.set(ch, {
        x, groundY: gy, z, rotY, jy: jy || 0, vy: vy || 0,
        moving: !!moving, aim: !!aim,
        propId: propId || '', specialKey: specialKey || '',
        hp, eliminated: !!elim, markChar: markChar || '',
        snap: !prev,
      });
    }
  }

  function update(dt) {
    if (!isLiveSession()) return;
    const G = hooks.G;
    if (!G || !G.player || G.over || G.phase === 'menu' || G.phase === 'vs') return;

    const isPhoton = transport && transport.kind === 'photon-cloud';
    playerSyncAcc += dt;
    const pHz = isPhoton ? (PHOTON_CONFIG.photonPlayerSyncHz || 15) : (PHOTON_CONFIG.playerSyncHz || 8);
    const pInterval = 1 / pHz;
    if (playerSyncAcc >= pInterval) {
      playerSyncAcc = 0;
      const nowPerf = performance.now();
      while (recentReliable.length && recentReliable[0].until < nowPerf) {
        recentReliable.shift();
      }
      const p = G.player;
      const u = p.userData;
      const act = u.actor || {};
      const statePkt = {
        r: currentRound,
        a: myActorId,
        t: act.team === 'seekers' ? 1 : 0,
        s: act.slotIdx || 0,
        p: [
          +p.position.x.toFixed(2),
          +(u.groundY || 0).toFixed(2),
          +p.position.z.toFixed(2),
          +p.rotation.y.toFixed(3),
          +(u.jy || 0).toFixed(2),
          +(u.vy || 0).toFixed(2),
        ],
        d: u.propId || '',
        sp: encodeSpecialSpotKey(p),
        m: G.moving ? 1 : 0,
        aim: G.firing ? 1 : 0,
        hp: Math.round(G.hp ?? 100),
        mhp: Math.round(G.maxHp ?? 100),
        pt: Math.round(((u.hue ?? 1) < 0 ? 0 : (u.hue ?? 1)) * 100),
        el: act.eliminated ? 1 : 0,
      };
      if (recentReliable.length) {
        statePkt.ev = recentReliable.map((item) => [item.code, item.data]);
      }
      transport.sendEvent(EVT_PLAYER_STATE, statePkt, false);
    }

    if (isMaster()) {
      botSyncAcc += dt;
      const bHz = isPhoton ? (PHOTON_CONFIG.photonBotSyncHz || 12) : (PHOTON_CONFIG.botSyncHz || 8);
      const bInterval = 1 / bHz;
      if (botSyncAcc >= bInterval) {
        botSyncAcc = 0;
        const rows = [];
        const collect = (list, tCode) => {
          for (const c of (list || [])) {
            if (!c || c === G.player || !c.userData?.actor?.isBot) continue;
            const u = c.userData;
            const mark = u.ai?.mark?.visible ? (u.ai.mark.material === hooks.markBangMat ? '!' : '?') : '';
            rows.push([
              tCode,
              u.actor.slotIdx || 0,
              +c.position.x.toFixed(2),
              +(u.groundY || 0).toFixed(2),
              +c.position.z.toFixed(2),
              +c.rotation.y.toFixed(3),
              +(u.jy || 0).toFixed(2),
              +(u.vy || 0).toFixed(2),
              u.propId || '',
              encodeSpecialSpotKey(c),
              (u.spd || 0) > 0.35 ? 1 : 0,
              u.aim ? 1 : 0,
              Math.round(u.ai?.hp ?? 100),
              u.actor.eliminated ? 1 : 0,
              mark,
            ]);
          }
        };
        collect(G.allHiders, 0);
        collect(G.allSeekers, 1);
        const stage = (G.phase === 'hide' || G.phase === 'ready') ? 'prep' : (G.phase === 'end' ? 'end' : 'hunt');
        transport.sendEvent(EVT_BOT_STATES, {
          r: currentRound,
          ph: stage,
          rt: +Math.max(0, G.t || 0).toFixed(2),
          b: rows,
        }, false);
      }
    }

    const blend = Math.min(1, dt * 14);
    for (const [ch, tgt] of remoteTargets.entries()) {
      if (!ch || !ch.userData?.actor?.isRemote) continue;
      const u = ch.userData;
      // Avoid fighting local bot sky-drop animation; snap cleanly as soon as touchdown finishes!
      if (u._localSkyDrop) {
        tgt.snap = true;
        continue;
      }
      if (tgt.snap || Math.hypot(tgt.x - ch.position.x, tgt.z - ch.position.z) > 6.5) {
        ch.position.x = tgt.x;
        ch.position.z = tgt.z;
        u.groundY = tgt.groundY;
        u.jy = tgt.jy || 0;
        ch.rotation.y = tgt.rotY;
        tgt.snap = false;
      } else {
        ch.position.x = lerpNum(ch.position.x, tgt.x, blend);
        ch.position.z = lerpNum(ch.position.z, tgt.z, blend);
        u.groundY = lerpNum(u.groundY ?? tgt.groundY, tgt.groundY, blend);
        u.jy = lerpNum(u.jy || 0, tgt.jy || 0, Math.min(1, dt * 16));
        ch.rotation.y = lerpAng(ch.rotation.y, tgt.rotY, blend);
      }
      ch.position.y = (u.groundY || 0) + (u.jy || 0);
      u.vy = tgt.vy || 0;
      u.aim = !!tgt.aim;
      if (tgt.aim) u.aimUntil = performance.now() + 220;
      if (tgt.moving) u.bob = (u.bob || 0) + dt * (u.propId ? 15 : 12);
      if (u.ai && typeof tgt.hp === 'number') {
        if (tgt.eliminated || tgt.hp <= u.ai.hp || performance.now() > (u._hpAuthLockUntil || 0)) {
          u.ai.hp = tgt.hp;
        }
      }
      if (typeof tgt.markChar === 'string' && hooks.setMark) {
        hooks.setMark(ch, tgt.markChar || null);
      }
      if (!tgt.eliminated) {
        applyRemoteAppearance(ch, tgt.propId, tgt.specialKey);
        // remote players' paint level drives how washed-out their disguise looks here
        if (typeof tgt.paint === 'number') u.hue = tgt.paint;
      }
    }
  }

  function broadcastShot(shooterChar, from, dir, spd, elemId) {
    if (!isLiveSession() || !shooterChar) return;
    const act = shooterChar.userData?.actor;
    if (!act) return;
    const isAuth = shooterChar === hooks.getLocalPlayer?.() || (isMaster() && act.isBot);
    if (!isAuth) return;
    transport.sendEvent(EVT_SHOT, {
      r: currentRound,
      t: act.team === 'seekers' ? 1 : 0,
      s: act.slotIdx || 0,
      f: [+from.x.toFixed(2), +from.y.toFixed(2), +from.z.toFixed(2)],
      d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)],
      sp: spd || 28,
      eg: elemId || shooterChar.userData?.elemId || shooterChar.userData?.elemGun || 'water',
    }, false);
  }

  function broadcastHit(victimChar, shooterChar, dmg, remainingHp, eliminated) {
    if (!isLiveSession() || !victimChar) return;
    const vAct = victimChar.userData?.actor;
    const sAct = shooterChar?.userData?.actor;
    if (!vAct) return;
    sendReliableEvent(EVT_HIT, {
      r: currentRound,
      vs: vAct.slotIdx || 0,
      st: sAct?.team === 'seekers' ? 1 : 0,
      ss: sAct?.slotIdx ?? 0,
      dmg,
      hp: remainingHp,
      el: eliminated ? 1 : 0,
    }, false);
  }

  function broadcastGadget(payload) {
    if (!isLiveSession() || !payload) return;
    sendReliableEvent(EVT_GADGET, Object.assign({ r: currentRound }, payload), false);
  }

  function broadcastRoundEnd(hidersWon, reason) {
    if (!isLiveSession() || !isMaster()) return;
    sendReliableEvent(EVT_ROUND_END, { r: currentRound, hidersWon: !!hidersWon, reason: reason || '' }, false);
  }

  function leaveSession(opts = {}) {
    clearInterval(queueTickTimer);
    queueTickTimer = null;
    lobbyFullSinceMs = 0;
    currentRound = 1;
    remoteTargets.clear();
    state = 'idle';
    queueCfg = null;
    schedule = null;

    if (partyCode) {
      if (transport && transport.isJoined() && transport.partyCode?.() === partyCode) {
        transport.reopenRoom?.();
      } else if (!opts.keepPartyTransport) {
        if (transport) {
          transport.leave();
          transport = null;
        }
        connectPartyTransport({ mapId: partyMapId });
      }
      notifyPartyListeners();
      return;
    }

    if (transport) {
      transport.leave();
      transport = null;
    }
  }

  // Auto-check URL deep-link invite (?room=XXXX or #room=XXXX) on boot once host script finishes wiring
  if (typeof window !== 'undefined') {
    window.addEventListener('hueseek:deeplink', (ev) => {
      const d = ev?.detail;
      if (d && d.room && state === 'idle') {
        applyPartyDeepLink(d.room, d.map);
      }
    });
    setTimeout(() => {
      if (!urlPartyChecked && !partyCode && state === 'idle') {
        checkUrlPartyInvite();
      }
    }, 0);
  }

  return {
    get state() { return state; },
    get activeRoster() { return activeRoster; },
    get schedule() { return schedule; },
    get currentRound() { return currentRound; },
    get partyCode() { return partyCode; },
    get isPartyHost() { return Boolean(partyCode && isPartyHost); },
    transportKind,
    getPlayerName,
    setPlayerName,
    rollPlayerName,
    buildInstantLocalRoster,
    enterQueue,
    queueForMatch,
    hasRematchLobby,
    rematchSameLobby,
    cancelQueue,
    forceLockQueueNow,
    resetForNextRound,
    markMatchStarted,
    isLiveSession,
    isMaster,
    isOffline,
    isNetworkOffline,
    update,
    broadcastShot,
    broadcastHit,
    broadcastGadget,
    broadcastRoundEnd,
    leaveSession,
    // Friends Party Room API
    generatePartyCode,
    normalizePartyCode,
    getInitialPartyCodeFromUrl,
    createPartyRoom,
    joinPartyRoom,
    leavePartyRoom,
    setPartyMap,
    setPartyPreferredTeam,
    startPartyMatch,
    getPartyState,
    buildPartyShareUrl,
    buildPartyShareText,
    sharePartyInvite,
    copyPartyCode,
    onPartyChange,
    checkUrlPartyInvite,
  };
}
