// tests/k6/suites/websocket-load.js
//
// WebSocket gateway load testing — connection storm, room join + event
// delivery (subscriber and control groups), heartbeat, disconnect/reconnect,
// and unauthenticated timeout. Standalone: run this suite on its own to
// validate transport/auth/heartbeat/security behaviour under load. Business
// event delivery (`ws_event_received`, `ws_post_reconnect_event_received`)
// only collects real samples when run alongside a checkout-driving HTTP
// suite targeting the same users — see the room-join scenario's docstring in
// the journey.
//
//   k6 run tests/k6/suites/websocket-load.js --env ENV=docker

import { WS_THRESHOLDS } from '../lib/contracts/websocket-load.js';
import { mintTokenPool } from '../lib/auth.js';
import { summaryHandler } from '../lib/summary.js';
import {
  connectionStorm,
  roomJoinAndEvent,
  heartbeat,
  disconnectReconnect,
  unauthenticatedTimeout,
} from '../journeys/websocket-load.js';

export const options = {
  scenarios: {
    connection_storm: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      exec: 'connectionStormExec',
      startTime: '0s',
      maxDuration: '120s',
      tags: { scenario: 'connection_storm' },
    },
    room_join_subscribers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '4m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'roomJoinExec',
      startTime: '130s',
      tags: { scenario: 'room_join' },
    },
    room_join_control: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '4m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      exec: 'roomJoinControlExec',
      startTime: '130s',
      tags: { scenario: 'room_join_control' },
    },
    heartbeat: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'heartbeatExec',
      startTime: '450s',
      tags: { scenario: 'heartbeat' },
    },
    disconnect_reconnect: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 1,
      exec: 'disconnectReconnectExec',
      startTime: '640s',
      maxDuration: '120s',
      tags: { scenario: 'disconnect_reconnect' },
    },
    unauthenticated_timeout: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      exec: 'unauthenticatedTimeoutExec',
      startTime: '770s',
      maxDuration: '120s',
      tags: { scenario: 'unauthenticated_timeout' },
    },
  },
  thresholds: WS_THRESHOLDS,
  // N sequential logins against bcrypt comfortably exceed the 60s default.
  setupTimeout: '180s',
};

export function setup() {
  return {
    sessions: mintTokenPool(100),
    reconnectSessions: mintTokenPool(20),
  };
}

function pick(pool) {
  return pool[(__VU - 1) % pool.length];
}

export function connectionStormExec(state) {
  connectionStorm(pick(state.sessions));
}

export function roomJoinExec(state) {
  roomJoinAndEvent(pick(state.sessions), false);
}

export function roomJoinControlExec(state) {
  roomJoinAndEvent(pick(state.sessions), true);
}

export function heartbeatExec(state) {
  heartbeat(pick(state.sessions));
}

export function disconnectReconnectExec(state) {
  disconnectReconnect(pick(state.reconnectSessions));
}

export function unauthenticatedTimeoutExec() {
  unauthenticatedTimeout();
}

export const handleSummary = summaryHandler('websocket-load');
