// tests/k6/lib/contracts/websocket-load.js

export const WS_THRESHOLDS = {
  ws_authenticated:                         ['rate>=0.99'],
  ws_connection_time:                       ['p(95)<2000'],
  ws_room_join_success:                     ['rate>=0.99'],
  ws_room_join_time:                        ['p(95)<500'],
  ws_event_received:                        ['rate>=0.99'],
  ws_event_delivery_latency:                ['p(95)<1000'],
  ws_unexpected_event_count:                ['count==0'],
  ws_pong_received:                         ['rate>=1.0'],
  ws_pong_latency:                          ['p(95)<200'],
  ws_reconnect_success:                     ['rate>=0.99'],
  ws_post_reconnect_event_received:         ['rate>=0.99'],
  ws_unauth_disconnected_within_timeout:    ['rate>=1.0'],
  ws_unauth_no_protected_events:            ['rate>=1.0'],
  http_req_failed:                          ['rate<0.01'],
};

export const AUTH_TIMEOUT_MS = 30_000;
export const AUTH_TIMEOUT_TOLERANCE_MS = 5_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
