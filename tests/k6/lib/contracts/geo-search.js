// tests/k6/lib/contracts/geo-search.js

export const TUNISIA_LOCATIONS = [
  { name: 'tunis',   latitude: 36.8065, longitude: 10.1815 },
  { name: 'lamarsa', latitude: 36.8785, longitude: 10.3225 },
  { name: 'sousse',  latitude: 35.8256, longitude: 10.6369 },
  { name: 'sfax',    latitude: 34.7406, longitude: 10.7603 },
  { name: 'nabeul',  latitude: 36.4513, longitude: 10.7357 },
];

export const GEO_SEARCH_THRESHOLDS = {
  'http_req_duration{name:discovery}':    ['p(95)<500', 'p(99)<1000'],
  'http_req_duration{name:urgent}':       ['p(95)<500', 'p(99)<1000'],
  'http_req_duration{name:detail}':       ['p(95)<300'],
  'http_req_duration{name:suggestions}':  ['p(95)<200'],
  http_req_failed:                        ['rate<0.01'],
};

export const DEGRADATION_WARN_RATIO = 2.0;
