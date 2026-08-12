import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Without handleSummary a run leaves nothing behind but scrollback, so there is
// no way to answer "did this PR make it slower". Every suite writes a JSON
// artifact keyed by endpoint, which is also what tools/baseline.js reads when
// re-deriving thresholds from measured runs.

function percentiles(metric) {
  if (!metric || !metric.values) {
    return null;
  }
  const v = metric.values;
  return {
    count: v.count ?? null,
    rate: v.rate ?? null,
    min: v.min ?? null,
    med: v.med ?? null,
    p90: v['p(90)'] ?? null,
    p95: v['p(95)'] ?? null,
    p99: v['p(99)'] ?? null,
    max: v.max ?? null,
    avg: v.avg ?? null,
  };
}

/**
 * Pulls out the per-endpoint sub-metrics k6 creates for tagged thresholds.
 * These are the numbers a baseline is built from — the aggregate is useless for
 * that, because it mixes a 2 ms health check with a 1.5 s checkout.
 */
function byEndpoint(metrics) {
  const result = {};
  for (const [key, metric] of Object.entries(metrics)) {
    const match = /^http_req_duration\{name:([^}]+)\}$/.exec(key);
    if (match) {
      result[match[1]] = percentiles(metric);
    }
  }
  return result;
}

export function buildSummary(data, suiteName) {
  const thresholdFailures = [];
  for (const [name, metric] of Object.entries(data.metrics)) {
    if (!metric.thresholds) {
      continue;
    }
    for (const [expression, result] of Object.entries(metric.thresholds)) {
      if (result.ok === false) {
        thresholdFailures.push({ metric: name, expression });
      }
    }
  }

  return {
    suite: suiteName,
    environment: __ENV.ENV || 'local',
    generatedAt: new Date().toISOString(),
    passed: thresholdFailures.length === 0,
    thresholdFailures,
    aggregate: {
      http_req_duration: percentiles(data.metrics.http_req_duration),
      http_req_failed: percentiles(data.metrics.http_req_failed),
      checks: percentiles(data.metrics.checks),
      iterations: percentiles(data.metrics.iterations),
      vus_max: data.metrics.vus_max ? data.metrics.vus_max.values.max : null,
    },
    endpoints: byEndpoint(data.metrics),
    custom: {
      order_create_success: percentiles(data.metrics.order_create_success),
      request_failures: percentiles(data.metrics.request_failures),
      unexpected_server_errors: percentiles(data.metrics.unexpected_server_errors),
      login_failures: percentiles(data.metrics.login_failures),
      token_refreshes: percentiles(data.metrics.token_refreshes),
    },
  };
}

/** Drop-in handleSummary for a suite. */
export function summaryHandler(suiteName) {
  return function handleSummary(data) {
    const summary = buildSummary(data, suiteName);
    return {
      stdout: textSummary(data, { indent: ' ', enableColors: true }),
      [`results/${suiteName}-summary.json`]: JSON.stringify(summary, null, 2),
      [`results/${suiteName}-raw.json`]: JSON.stringify(data, null, 2),
    };
  };
}
