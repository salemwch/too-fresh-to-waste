// tests/k6/journeys/consumer-search.js
//
// Discovery pipeline journey — the hottest read path in the product.
//
// Two modes:
//   warm cache  — repeated coordinates per VU, exercises Redis path
//   low-cache-reuse — diverse coordinates, exercises database path (Rule 3)

import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { withAuth } from '../lib/auth.js';
import { checkOk, checkList, data, sample } from '../lib/envelope.js';
import { get } from '../lib/http.js';
import { TUNISIA_LOCATIONS, DEGRADATION_WARN_RATIO } from '../lib/contracts/geo-search.js';

const SEARCH_TERMS = ['pizza', 'pain', 'salade', 'couscous', 'patisserie', 'sandwich'];

const pageDurations = {};
for (let p = 1; p <= 4; p++) {
  pageDurations[p] = new Trend(`discovery_page_${p}_duration`);
}

/**
 * Warm-cache browse: each VU sticks to Tunis center coordinates.
 * Repeated coordinates → Redis cache hits → measures the cached path.
 */
export function warmCacheBrowse(session) {
  const loc = TUNISIA_LOCATIONS[0]; // Tunis center

  const list = withAuth(session, params =>
    get(`/offers?lat=${loc.latitude}&lng=${loc.longitude}&radius=5000&page=1&limit=20`, 'discovery', params),
  );
  checkList(list, 'warm browse offers');
  pageDurations[1].add(list.timings.duration);

  sleep(randomIntBetween(2, 4));

  const urgent = withAuth(session, params =>
    get(`/offers/urgent?lat=${loc.latitude}&lng=${loc.longitude}&limit=5`, 'urgent', params),
  );
  checkOk(urgent, 'warm browse urgent');

  sleep(randomIntBetween(1, 3));

  const offers = data(list);
  const chosen = sample(offers);
  if (chosen && chosen._id) {
    const detail = withAuth(session, params =>
      get(`/offers/${chosen._id}`, 'detail', params),
    );
    checkOk(detail, 'warm browse detail');
    sleep(randomIntBetween(2, 5));
  }

  const term = SEARCH_TERMS[randomIntBetween(0, SEARCH_TERMS.length - 1)];
  withAuth(session, params =>
    get(`/search/suggestions?query=${encodeURIComponent(term)}`, 'suggestions', params),
  );

  sleep(randomIntBetween(3, 6));
}

/**
 * Low-cache-reuse browse: each iteration uses diverse parameters to reduce
 * Redis cache hits. Not truly cold-cache (Rule 3) — we control diversity
 * through varied coordinates, radii, pages, and cities.
 */
export function lowCacheReuseBrowse(session) {
  const loc = TUNISIA_LOCATIONS[randomIntBetween(0, TUNISIA_LOCATIONS.length - 1)];
  const latJitter = (Math.random() - 0.5) * 0.02; // ±0.01°
  const lngJitter = (Math.random() - 0.5) * 0.02;
  const lat = loc.latitude + latJitter;
  const lng = loc.longitude + lngJitter;
  const radius = [3000, 5000, 8000, 10000][randomIntBetween(0, 3)];
  const page = randomIntBetween(1, 3);

  const list = withAuth(session, params =>
    get(`/offers?lat=${lat}&lng=${lng}&radius=${radius}&page=${page}&limit=20`, 'discovery', params),
  );
  checkList(list, 'low-reuse browse offers');
  if (pageDurations[page]) {
    pageDurations[page].add(list.timings.duration);
  }

  sleep(randomIntBetween(2, 4));

  const urgent = withAuth(session, params =>
    get(`/offers/urgent?lat=${lat}&lng=${lng}&limit=5`, 'urgent', params),
  );
  checkOk(urgent, 'low-reuse urgent');

  sleep(randomIntBetween(1, 2));

  const offers = data(list);
  const chosen = sample(offers);
  if (chosen && chosen._id) {
    withAuth(session, params => get(`/offers/${chosen._id}`, 'detail', params));
    sleep(randomIntBetween(2, 5));
  }

  const term = SEARCH_TERMS[randomIntBetween(0, SEARCH_TERMS.length - 1)];
  withAuth(session, params =>
    get(`/search/suggestions?query=${encodeURIComponent(term)}`, 'suggestions', params),
  );

  sleep(randomIntBetween(3, 6));
}

/**
 * Pagination depth probe: walks pages 1 through 4 and records per-page
 * latency. The degradation ratio (p95 page 4 / p95 page 1) is a diagnostic
 * metric, not a hard failure — if it exceeds DEGRADATION_WARN_RATIO (~2×)
 * the test flags it for investigation.
 */
export function paginationDepth(session) {
  const loc = TUNISIA_LOCATIONS[0];

  for (let page = 1; page <= 4; page++) {
    const res = withAuth(session, params =>
      get(`/offers?lat=${loc.latitude}&lng=${loc.longitude}&radius=5000&page=${page}&limit=20`, 'discovery', params),
    );
    if (pageDurations[page]) {
      pageDurations[page].add(res.timings.duration);
    }
    check(res, {
      [`page ${page}: returned data`]: r => r.status === 200,
    });
    sleep(randomIntBetween(1, 2));
  }
}

export function buildDegradationReport(data) {
  const p95 = page => {
    const m = data.metrics[`discovery_page_${page}_duration`];
    return m && m.values ? m.values['p(95)'] : null;
  };
  const page1 = p95(1);
  const page4 = p95(4);
  if (page1 && page4 && page1 > 0) {
    const ratio = page4 / page1;
    return {
      page1_p95: Math.round(page1),
      page4_p95: Math.round(page4),
      ratio: ratio.toFixed(2),
      warning: ratio > DEGRADATION_WARN_RATIO,
    };
  }
  return null;
}
