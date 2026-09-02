#!/usr/bin/env node
/**
 * Regenerates the shipped illustration variants from the source masters in
 * `assets-src/`.
 *
 * Why this exists: `box-card.png` (4000x4000) and `save-lives.png` (5824x3264)
 * shipped at full resolution into views 90dp wide. That was 11.4 MiB on every
 * download - about half the app - to paint roughly 130x130 physical pixels, plus
 * ~64 MB of decoded bitmap heap on a Home screen that low-end devices have to
 * render. Android tops out at xxxhdpi (4x), so 4x the render box is the most any
 * device can display; everything past it is decoded and discarded.
 *
 * Emitting @1x..@4x rather than one large file lets Play's density splits hand
 * each device only the variant it can use.
 *
 * Usage: pnpm --filter @foodwaste/mobile assets:optimize
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets-src');
const OUT_DIR = path.join(ROOT, 'src/assets/images');

/**
 * `box` is the component's StyleSheet size in dp and `fit` its resizeMode, so
 * the generated pixels match what is actually painted. Keep these in sync with
 * the components named below - they are the reason the sizes are what they are.
 */
const JOBS = [
  {
    src: 'box-card.png',
    out: 'box-card',
    box: { w: 90, h: 90 },
    fit: 'contain',
    usedBy: 'features/home/components/MonthlyBagGoalBanner.tsx (styles.illustration)',
  },
  {
    src: 'save-lives.png',
    out: 'save-lives',
    box: { w: 90, h: 80 },
    fit: 'cover',
    usedBy: 'features/donations/components/ImpactBanner.tsx (styles.illustration)',
  },
];

const SCALES = [
  { s: 1, suffix: '' },
  { s: 1.5, suffix: '@1.5x' },
  { s: 2, suffix: '@2x' },
  { s: 3, suffix: '@3x' },
  { s: 4, suffix: '@4x' },
];

const WEBP = { quality: 82, effort: 6, alphaQuality: 90 };

/** Scale to the edge the fit mode binds on, so cropping is unchanged. */
function baseSize(meta, box, fit) {
  const srcAspect = meta.width / meta.height;
  const boxAspect = box.w / box.h;
  const bindsOnWidth = fit === 'cover' ? srcAspect <= boxAspect : srcAspect > boxAspect;
  return bindsOnWidth
    ? { w: box.w, h: Math.round(box.w / srcAspect) }
    : { w: Math.round(box.h * srcAspect), h: box.h };
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`No masters at ${SRC_DIR}. See assets-src/README.md.`);
    process.exit(1);
  }
  let grand = 0;
  for (const job of JOBS) {
    const srcPath = path.join(SRC_DIR, job.src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`skip ${job.src} - master not present locally (it is gitignored)`);
      continue;
    }
    const meta = await sharp(srcPath).metadata();
    const base = baseSize(meta, job.box, job.fit);
    console.log(`\n${job.src}  ${meta.width}x${meta.height} -> ${job.box.w}x${job.box.h}dp ${job.fit}`);
    console.log(`  ${job.usedBy}`);
    for (const { s, suffix } of SCALES) {
      const dest = path.join(OUT_DIR, `${job.out}${suffix}.webp`);
      await sharp(srcPath)
        .resize(Math.round(base.w * s), Math.round(base.h * s), { fit: 'fill', kernel: 'lanczos3' })
        .webp(WEBP)
        .toFile(dest);
      const size = fs.statSync(dest).size;
      grand += size;
      console.log(`  ${(suffix || '@1x').padEnd(6)} ${String(size).padStart(7)} B  ${path.basename(dest)}`);
    }
  }
  console.log(`\nTotal emitted: ${(grand / 1024).toFixed(1)} KiB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
