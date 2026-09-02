#!/usr/bin/env node
/**
 * Fails the build when a bundled image is far larger than any screen can show.
 *
 * This guard exists because two illustrations shipped at 4000x4000 and
 * 5824x3264 into 90dp views for months. Nothing caught it: type-check, lint and
 * the snapshot suite are all blind to how many bytes an `import` drags into the
 * APK, and 11.4 MiB of the download - about half of it - was invisible in every
 * gate we ran.
 *
 * Budgets are byte ceilings, not targets. They are set well above today's
 * largest asset so ordinary design work never trips them; they exist to catch
 * the multi-MB class of mistake.
 *
 * Usage: pnpm --filter @foodwaste/mobile check:assets
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '../src/assets/images');
const RASTER = /\.(png|jpe?g|webp)$/i;

// Largest asset today is bag-wall.webp at 69 KiB / 1170x2532 (a full-bleed
// onboarding background). Ceilings sit above that with room to work.
const PER_FILE_BYTES = 150 * 1024;
const TOTAL_BYTES = 768 * 1024;
// Android tops out at xxxhdpi (4x). A full-bleed background on the tallest
// common device is ~1170x2532, so nothing legitimately needs more than this.
const MAX_EDGE_PX = 2600;

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => RASTER.test(f)).sort();
  const failures = [];
  let total = 0;

  for (const file of files) {
    const full = path.join(DIR, file);
    const bytes = fs.statSync(full).size;
    const { width, height } = await sharp(full).metadata();
    total += bytes;

    if (bytes > PER_FILE_BYTES) {
      failures.push(
        `${file}: ${(bytes / 1024).toFixed(1)} KiB exceeds the ${PER_FILE_BYTES / 1024} KiB per-file budget`
      );
    }
    if (Math.max(width, height) > MAX_EDGE_PX) {
      failures.push(
        `${file}: ${width}x${height} exceeds ${MAX_EDGE_PX}px on the long edge - no Android density can display it, and the full bitmap is still decoded into heap`
      );
    }
  }

  console.log(`${files.length} bundled rasters, ${(total / 1024).toFixed(1)} KiB total`);

  if (total > TOTAL_BYTES) {
    failures.push(
      `total ${(total / 1024).toFixed(1)} KiB exceeds the ${TOTAL_BYTES / 1024} KiB budget for src/assets/images`
    );
  }

  if (failures.length > 0) {
    console.error('\nAsset budget exceeded:\n');
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      '\nSize the asset to its render box (4x the dp size in the StyleSheet is the ceiling),\n' +
        'emit @1x..@4x WebP variants, and keep the master in assets-src/.\n' +
        'See scripts/optimize-assets.js.\n'
    );
    process.exit(1);
  }

  console.log('All bundled images are within budget.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
