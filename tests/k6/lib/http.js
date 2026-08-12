import http from 'k6/http';
import { Counter } from 'k6/metrics';

import { BASE_URL } from '../config/environments.js';

// A request without a `name` tag collapses into the same metric bucket as every
// other request, which makes per-endpoint thresholds impossible. Wrapping the
// client is what makes the tag non-optional rather than a thing to remember.

/**
 * Failures are counted, never logged.
 *
 * The previous suite called console.error on every failed login. At 150 VUs
 * that floods stdout, and k6 writes to it from the same runtime that drives the
 * requests — the logging itself distorts the timings you are trying to measure.
 */
export const requestFailures = new Counter('request_failures');
export const unexpectedServerErrors = new Counter('unexpected_server_errors');

function buildParams(name, params = {}) {
  if (!name) {
    throw new Error('Every request needs a name tag — it is the threshold key.');
  }

  return {
    ...params,
    tags: { ...(params.tags || {}), name },
    headers: { 'Content-Type': 'application/json', ...(params.headers || {}) },
  };
}

function record(res, name) {
  if (res.status === 0 || res.status >= 500) {
    unexpectedServerErrors.add(1, { name });
    requestFailures.add(1, { name });
  } else if (res.status >= 400) {
    requestFailures.add(1, { name });
  }
  return res;
}

export function get(path, name, params) {
  return record(http.get(`${BASE_URL}${path}`, buildParams(name, params)), name);
}

export function post(path, body, name, params) {
  const payload = body === null || body === undefined ? null : JSON.stringify(body);
  return record(http.post(`${BASE_URL}${path}`, payload, buildParams(name, params)), name);
}

export function patch(path, body, name, params) {
  const payload = body === null || body === undefined ? null : JSON.stringify(body);
  return record(http.patch(`${BASE_URL}${path}`, payload, buildParams(name, params)), name);
}

export function absoluteGet(url, name, params) {
  return record(http.get(url, buildParams(name, params)), name);
}

/**
 * Parallel request group, for bursts a real client issues at once.
 * `http.batch` runs them concurrently from one VU — issuing them serially would
 * understate peak concurrency by the size of the batch.
 */
export function batch(requests) {
  const specs = requests.map(r => [
    r.method || 'GET',
    `${BASE_URL}${r.path}`,
    r.body === undefined ? null : JSON.stringify(r.body),
    buildParams(r.name, r.params),
  ]);

  const responses = http.batch(specs);
  responses.forEach((res, i) => record(res, requests[i].name));
  return responses;
}
