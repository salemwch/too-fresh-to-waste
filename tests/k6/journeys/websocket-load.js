// tests/k6/journeys/websocket-load.js
//
// WebSocket gateway load testing via k6/ws with manual Engine.IO framing.
// Protocol logic lives in lib/socketio.js (Rule 9). This file contains only
// business-level assertions.

import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Counter, Rate, Trend } from 'k6/metrics';

import { WS_URL } from '../config/environments.js';
import {
  AUTH_TIMEOUT_MS,
  AUTH_TIMEOUT_TOLERANCE_MS,
  HEARTBEAT_INTERVAL_MS,
} from '../lib/contracts/websocket-load.js';
import {
  parsePacket, isEvent, eventPayload, encodeEvent,
  encodeConnect, encodePong, buildWsUrl, ENGINE, SIO,
} from '../lib/socketio.js';

// The gateway registers this handler under the shared WebSocketEvents.JOIN_ROOM
// constant (packages/shared/src/constants/websocket.constants.ts), whose value
// is the lowercase event name below — not the enum key.
const JOIN_ROOM_EVENT = 'join_room';
const ORDER_UPDATES_ROOM = 'order_updates';

// Three-stage connection metrics
export const wsTransportConnected = new Rate('ws_transport_connected');
export const wsNamespaceConnected = new Rate('ws_namespace_connected');
export const wsAuthenticated = new Rate('ws_authenticated');
export const wsConnectionTime = new Trend('ws_connection_time');

// Room operations
export const wsRoomJoinSuccess = new Rate('ws_room_join_success');
export const wsRoomJoinTime = new Trend('ws_room_join_time');

// Event delivery
export const wsEventReceived = new Rate('ws_event_received');
export const wsEventDeliveryLatency = new Trend('ws_event_delivery_latency');
export const wsUnexpectedEventCount = new Counter('ws_unexpected_event_count');

// Heartbeat
export const wsPongReceived = new Rate('ws_pong_received');
export const wsPongLatency = new Trend('ws_pong_latency');

// Recovery
export const wsReconnectSuccess = new Rate('ws_reconnect_success');
export const wsPostReconnectEventReceived = new Rate('ws_post_reconnect_event_received');

// Security
export const wsUnauthDisconnected = new Rate('ws_unauth_disconnected_within_timeout');
export const wsUnauthNoProtectedEvents = new Rate('ws_unauth_no_protected_events');

/**
 * Scenario 1 — connection storm.
 *
 * 100 simultaneous JWT-authenticated connections. Must receive
 * transport + namespace + authenticated within 5s.
 */
export function connectionStorm(session) {
  const url = buildWsUrl(WS_URL);
  const connectStart = Date.now();
  let transportOk = false;
  let namespaceOk = false;
  let authOk = false;

  ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      transportOk = true;
      wsTransportConnected.add(1);
      // Send Socket.IO CONNECT with auth token
      socket.send(encodeConnect({ token: session.accessToken }));
    });

    socket.on('message', function (msg) {
      const packet = parsePacket(msg);
      if (!packet) return;

      // Engine.IO ping → respond with pong
      if (packet.engineType === ENGINE.PING) {
        socket.send(encodePong());
        return;
      }

      // Socket.IO namespace connect acknowledgement
      if (packet.engineType === ENGINE.MESSAGE && packet.sioType === SIO.CONNECT) {
        namespaceOk = true;
        wsNamespaceConnected.add(1);
      }

      // Authenticated event — emitted by the gateway's connect middleware
      // (websocket.gateway.ts afterInit) once the JWT verifies.
      if (isEvent(packet, 'authenticated')) {
        authOk = true;
        wsAuthenticated.add(1);
        wsConnectionTime.add(Date.now() - connectStart);
        socket.close();
      }
    });

    socket.on('error', function () {
      socket.close();
    });

    // Timeout: close after 5s if not authenticated
    socket.setTimeout(function () {
      if (!authOk) {
        wsAuthenticated.add(0);
        wsConnectionTime.add(5000);
      }
      socket.close();
    }, 5000);
  });

  if (!transportOk) wsTransportConnected.add(0);
  if (!namespaceOk) wsNamespaceConnected.add(0);
}

/**
 * Scenario 2 — room join + event delivery.
 *
 * Connect, authenticate, join `order_updates` room, wait for events.
 * A separate HTTP VU (checkout journey) creates/confirms orders that trigger
 * `order:status_updated`. Because that event is sent to `user-{userId}` rooms
 * via `sendToUser()`, not broadcast to `order_updates`, a subscriber here only
 * receives it if the concurrent HTTP checkout VU happens to be driving *this
 * VU's own user*. In the standalone suite that never happens, so
 * `room_joined` is exercised end-to-end while wsEventReceived /
 * wsEventDeliveryLatency legitimately collect no samples — that combination
 * only appears when this scenario runs alongside checkout VUs. The control
 * group still proves no unexpected event arrives for a socket that never
 * joined a room.
 */
export function roomJoinAndEvent(session, isControlGroup) {
  const url = buildWsUrl(WS_URL);
  let roomJoined = false;
  let joinStart = 0;

  ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      socket.send(encodeConnect({ token: session.accessToken }));
    });

    socket.on('message', function (msg) {
      const packet = parsePacket(msg);
      if (!packet) return;

      if (packet.engineType === ENGINE.PING) {
        socket.send(encodePong());
        return;
      }

      if (packet.engineType === ENGINE.MESSAGE && packet.sioType === SIO.CONNECT) {
        if (!isControlGroup) {
          joinStart = Date.now();
          socket.send(encodeEvent(JOIN_ROOM_EVENT, { room: ORDER_UPDATES_ROOM }));
        }
      }

      if (isEvent(packet, 'room_joined')) {
        roomJoined = true;
        wsRoomJoinSuccess.add(1);
        wsRoomJoinTime.add(Date.now() - joinStart);
      }

      // Business event delivery
      if (isEvent(packet, 'order:status_updated')) {
        const payload = eventPayload(packet);
        if (isControlGroup) {
          wsUnexpectedEventCount.add(1);
        } else {
          wsEventReceived.add(1);
          if (payload && payload.timestamp) {
            wsEventDeliveryLatency.add(Date.now() - new Date(payload.timestamp).getTime());
          }
        }
      }
    });

    socket.on('error', function () {
      socket.close();
    });

    // Keep connection open for event observation
    socket.setTimeout(function () {
      socket.close();
    }, 60000);
  });

  if (!roomJoined && !isControlGroup) {
    wsRoomJoinSuccess.add(0);
  }
}

/**
 * Scenario 3 — heartbeat.
 *
 * Engine.IO v4 pings are server-initiated (server sends '2', client answers
 * '3'); a client-sent '2' never gets a reply, so this measures the
 * application-level `ping`/`pong` Socket.IO events instead
 * (websocket.gateway.ts handlePing, line 185). Sends an event ping every
 * HEARTBEAT_INTERVAL_MS once authenticated and tracks the single outstanding
 * ping in a closure variable read by the main message handler — no handler is
 * registered per tick, which would leak.
 */
export function heartbeat(session) {
  const url = buildWsUrl(WS_URL);
  let authenticated = false;
  let pingSentAt = 0;
  let awaitingPong = false;

  ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      socket.send(encodeConnect({ token: session.accessToken }));
    });

    socket.on('message', function (msg) {
      const packet = parsePacket(msg);
      if (!packet) return;

      // Server-initiated Engine.IO ping — must answer or the transport times
      // out (pingTimeout) and the socket is dropped from under the scenario.
      if (packet.engineType === ENGINE.PING) {
        socket.send(encodePong());
        return;
      }

      if (packet.engineType === ENGINE.MESSAGE && packet.sioType === SIO.CONNECT) {
        authenticated = true;
      }

      if (isEvent(packet, 'pong') && awaitingPong) {
        wsPongReceived.add(1);
        wsPongLatency.add(Date.now() - pingSentAt);
        awaitingPong = false;
      }
    });

    socket.on('error', function () {
      socket.close();
    });

    // Send an application-level ping at interval once authenticated. If the
    // previous ping never got a pong before this tick, record the miss —
    // otherwise ws_pong_received only ever sees successes and the threshold
    // (rate>=1.0) can never fail no matter how many pongs are dropped.
    socket.setInterval(function () {
      if (!authenticated) return;
      if (awaitingPong) {
        wsPongReceived.add(0);
      }
      pingSentAt = Date.now();
      awaitingPong = true;
      socket.send(encodeEvent('ping'));
    }, HEARTBEAT_INTERVAL_MS);

    socket.setTimeout(function () {
      socket.close();
    }, 180000); // 3 min
  });
}

/**
 * Scenario 4 — disconnect/reconnect.
 *
 * Connect A → auth → join room → disconnect A → wait → connect B → auth →
 * rejoin → verify B gets events and A does not.
 */
export function disconnectReconnect(session) {
  const url = buildWsUrl(WS_URL);
  let oldSocketEvents = 0;

  // Connect A
  ws.connect(url, {}, function (socketA) {
    socketA.on('open', function () {
      socketA.send(encodeConnect({ token: session.accessToken }));
    });

    let aAuthenticated = false;
    socketA.on('message', function (msg) {
      const packet = parsePacket(msg);
      if (!packet) return;
      if (packet.engineType === ENGINE.PING) { socketA.send(encodePong()); return; }
      if (packet.engineType === ENGINE.MESSAGE && packet.sioType === SIO.CONNECT) {
        aAuthenticated = true;
        socketA.send(encodeEvent(JOIN_ROOM_EVENT, { room: ORDER_UPDATES_ROOM }));
      }
      if (isEvent(packet, 'order:status_updated') && aAuthenticated) {
        oldSocketEvents++;
      }
    });

    socketA.on('error', function () {
      socketA.close();
    });

    // Disconnect A after 3s
    socketA.setTimeout(function () {
      socketA.close();
    }, 3000);
  });

  sleep(5);

  // Verify old socket is dead
  check(null, {
    'reconnect: old socket received no post-disconnect events': () => oldSocketEvents === 0,
  });

  // Connect B
  ws.connect(url, {}, function (socketB) {
    socketB.on('open', function () {
      socketB.send(encodeConnect({ token: session.accessToken }));
    });

    socketB.on('message', function (msg) {
      const packet = parsePacket(msg);
      if (!packet) return;
      if (packet.engineType === ENGINE.PING) { socketB.send(encodePong()); return; }
      if (packet.engineType === ENGINE.MESSAGE && packet.sioType === SIO.CONNECT) {
        socketB.send(encodeEvent(JOIN_ROOM_EVENT, { room: ORDER_UPDATES_ROOM }));
        wsReconnectSuccess.add(1);
      }
      if (isEvent(packet, 'order:status_updated')) {
        wsPostReconnectEventReceived.add(1);
      }
    });

    socketB.on('error', function () {
      socketB.close();
    });

    socketB.setTimeout(function () {
      socketB.close();
    }, 30000);
  });
}

/**
 * Scenario 5 — unauthenticated timeout.
 *
 * Connect without a token. The gateway should disconnect within
 * AUTH_TIMEOUT_MS + tolerance. No authenticated, room_joined, or business
 * events should be received before disconnect.
 */
export function unauthenticatedTimeout() {
  const url = buildWsUrl(WS_URL);
  const connectStart = Date.now();
  let receivedAuth = false;
  let receivedRoomJoined = false;
  let receivedBusinessEvent = false;
  let disconnected = false;
  let disconnectTime = 0;

  ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      // Deliberately do NOT send auth token
    });

    socket.on('message', function (msg) {
      const packet = parsePacket(msg);
      if (!packet) return;

      if (packet.engineType === ENGINE.PING) {
        socket.send(encodePong());
        return;
      }

      if (isEvent(packet, 'authenticated')) receivedAuth = true;
      if (isEvent(packet, 'room_joined')) receivedRoomJoined = true;
      if (isEvent(packet, 'order:status_updated')) receivedBusinessEvent = true;
    });

    socket.on('close', function () {
      disconnected = true;
      disconnectTime = Date.now() - connectStart;
    });

    // Safety timeout — close ourselves if server never disconnects
    socket.setTimeout(function () {
      if (!disconnected) {
        socket.close();
      }
    }, AUTH_TIMEOUT_MS + AUTH_TIMEOUT_TOLERANCE_MS + 5000);
  });

  const withinTimeout = disconnectTime > 0 &&
    disconnectTime <= AUTH_TIMEOUT_MS + AUTH_TIMEOUT_TOLERANCE_MS;

  wsUnauthDisconnected.add(withinTimeout ? 1 : 0);
  wsUnauthNoProtectedEvents.add(
    (!receivedAuth && !receivedRoomJoined && !receivedBusinessEvent) ? 1 : 0,
  );

  check(null, {
    'unauth: disconnected within timeout': () => withinTimeout,
    'unauth: no authenticated event received': () => !receivedAuth,
    'unauth: no room_joined event received': () => !receivedRoomJoined,
    'unauth: no business events received': () => !receivedBusinessEvent,
  });
}
