#!/usr/bin/env node
/**
 * Derives threshold values from measured runs.
 *
 *   # three runs against staging, keeping each summary
 *   for i in 1 2 3; do
 *     k6 run tests/k6/suites/gate.js --env ENV=staging
 *     mv results/gate-summary.json results/baseline-$i.json
 *   done
 *
 *   node tests/k6/tools/baseline.js results/baseline-*.json
 *
 * Prints a table and a paste-ready ENDPOINT_GATES block. It does not edit
 * config/thresholds.js — a threshold change should be a deliberate, reviewable
 * diff, not something a script slips in.
 *
 * The multiplier is p95 x 1.3. Headroom for run-to-run variance on shared
 * infrastructure: tighter and the gate flaps on noise, looser and it stops
 * catching anything. Override with BASELINE_MULTIPLIER.
 */
const fs = require('node:fs');

const MULTIPLIER = Number.parseFloat(process.env.BASELINE_MULTIPLIER || '1.3');
const files = process.argv.slice(2);

if (files.length === 0) {
  process.stderr.write('Usage: node baseline.js <summary.json...>\n');
  process.exit(1);
}

if (files.length < 3) {
  // One run cannot distinguish a real p95 from a cold cache or a noisy
  // neighbour. Three is the minimum that shows whether the number is stable.
  process.stderr.write(
    `Warning: ${files.length} run(s) given. Three or more is strongly recommended —\n` +
      'a threshold derived from a single run bakes in whatever that run happened to hit.\n\n',
  );
}

const runs = files.map(file => {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed.endpoints) {
    throw new Error(`${file} has no "endpoints" block — is it a gate summary?`);
  }
  return { file, endpoints: parsed.endpoints, environment: parsed.environment };
});

const environments = [...new Set(runs.map(r => r.environment))];
if (environments.length > 1) {
  // Mixing docker and staging numbers produces a threshold that fits neither.
  process.stderr.write(
    `Refusing to combine runs from different environments: ${environments.join(', ')}\n`,
  );
  process.exit(1);
}

/** Collects each endpoint's p95 across runs. */
const byEndpoint = new Map();
for (const run of runs) {
  for (const [name, stats] of Object.entries(run.endpoints)) {
    if (!stats || typeof stats.p95 !== 'number') {
      continue;
    }
    if (!byEndpoint.has(name)) {
      byEndpoint.set(name, []);
    }
    byEndpoint.get(name).push(stats);
  }
}

if (byEndpoint.size === 0) {
  process.stderr.write('No endpoint timings found. Did the run reach any tagged request?\n');
  process.exit(1);
}

const rows = [...byEndpoint.entries()]
  .map(([name, samples]) => {
    const p95s = samples.map(s => s.p95);
    const worst = Math.max(...p95s);
    const best = Math.min(...p95s);
    // Spread across runs is the number that decides whether a threshold is
    // trustworthy. A p95 that moves 3x between runs cannot gate anything, and
    // the honest response is to fix the variance, not to pick a big number.
    const spread = best > 0 ? worst / best : Infinity;
    return {
      name,
      med: median(samples.map(s => s.med)),
      p95: median(p95s),
      p99: median(samples.map(s => s.p99)),
      worst,
      spread,
      gate: Math.ceil((median(p95s) * MULTIPLIER) / 10) * 10,
      runs: samples.length,
    };
  })
  .sort((a, b) => b.p95 - a.p95);

function median(values) {
  const sorted = [...values].filter(v => typeof v === 'number').sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n) => String(Math.round(v)).padStart(n);

process.stdout.write(
  `\nBaseline from ${runs.length} run(s) against ${environments[0]}\n` +
    `multiplier ${MULTIPLIER}, gates rounded up to the nearest 10 ms\n\n`,
);
process.stdout.write(
  `${pad('endpoint', 26)}${pad('med', 7)}${pad('p95', 7)}${pad('p99', 8)}${pad('spread', 9)}gate\n`,
);
process.stdout.write(`${'-'.repeat(64)}\n`);

const unstable = [];
for (const r of rows) {
  const spreadLabel = Number.isFinite(r.spread) ? `${r.spread.toFixed(2)}x` : 'n/a';
  const flag = r.spread > 2 ? '  <-- unstable' : '';
  if (r.spread > 2) {
    unstable.push(r);
  }
  process.stdout.write(
    `${pad(r.name, 26)}${num(r.med, 6)} ${num(r.p95, 6)} ${num(r.p99, 7)} ${pad(spreadLabel, 9)}${num(r.gate, 5)}${flag}\n`,
  );
}

if (unstable.length > 0) {
  process.stdout.write(
    `\n${unstable.length} endpoint(s) vary more than 2x between runs: ` +
      `${unstable.map(u => u.name).join(', ')}.\n` +
      'A gate on those will flap. Find the variance first — cold cache, a cron\n' +
      'landing mid-run, or a cold start — rather than widening the threshold.\n',
  );
}

process.stdout.write('\nPaste into config/thresholds.js:\n\n');
process.stdout.write('const ENDPOINT_GATES = {\n');
for (const r of rows) {
  process.stdout.write(`  ${r.name}: ${r.gate},\n`);
}
process.stdout.write('};\n');
process.stdout.write(
  `\n// Last baselined: ${new Date().toISOString().slice(0, 10)} ` +
    `(${runs.length} runs, ${environments[0]}, p95 x ${MULTIPLIER})\n`,
);
