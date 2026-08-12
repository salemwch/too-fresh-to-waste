// tests/k6/journeys/websocket-load.js
//
// WebSocket gateway load testing via k6/ws with manual Engine.IO framing.
// Protocol logic lives in lib/socketio.js (Rule 9). This file contains only
// business-level assertions.

import ws from 'k6/ws';
import { Rate, Trend } from 'k6/metrics';

import { WS_URL } from '../config/environments.js';
import {
  parsePacket, isEvent, encodeConnect, encodePong, buildWsUrl, ENGINE, SIO,
} from '../lib/socketio.js';

// Three-stage connection metrics
export const wsTransportConnected = new Rate('ws_transport_connected');
export const wsNamespaceConnected = new Rate('ws_namespace_connected');
export const wsAuthenticated = new Rate('ws_authenticated');
export const wsConnectionTime = new Trend('ws_connection_time');

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
