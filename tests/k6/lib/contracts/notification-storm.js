// tests/k6/lib/contracts/notification-storm.js

export const NOTIFICATION_THRESHOLDS = {
  'http_req_duration{name:notifications_list}': ['p(95)<300'],
  'http_req_duration{name:mark_read}':          ['p(95)<200'],
  'http_req_duration{name:mark_all_read}':      ['p(95)<300'],
  http_req_failed:                               ['rate<0.01'],
  notification_delivery_rate:                    ['rate>=0.99'],
  notification_logical_duplicate_rate:           ['count==0'],
};

export const POLL_INTERVAL_MS = 500;
export const POLL_DEADLINE_MS = 30_000;
