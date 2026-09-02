#!/usr/bin/env node
/**
 * Generates the shipped Ionicons subset from the app's actual icon usage.
 *
 * WHY
 * ---
 * The full Ionicons.ttf carries 1,361 glyphs at 389,724 B (211 KiB compressed
 * in the AAB); the app references ~13% of them. Shipping the full font costs
 * every download ~170 KiB for glyphs no code path can name.
 *
 * HOW
 * ---
 * 1. scripts/lib/iconScan.js finds every glyph name used in src/ (see that
 *    file for method and the over-collection rationale).
 * 2. The upstream font in node_modules stays the source of truth; this script
 *    subsets it with `subset-font` (HarfBuzz compiled to WASM - the same
 *    subsetter behind fonttools) down to the used codepoints.
 * 3. Output replaces android/app/src/main/assets/fonts/Ionicons.ttf - the only
 *    copy Android resolves for fontFamily 'Ionicons' (the duplicate Metro
 *    would emit is suppressed in metro.config.js).
 *
 * THE GUARD
 * ---------
 * src/__tests__/iconFontSubset.test.ts re-runs the same scan and asserts every
 * found name has a cmap entry in the shipped file. Adding an icon without
 * re-running this script fails CI instead of shipping a blank box.
 *
 * Usage: pnpm --filter @foodwaste/mobile assets:subset-icons
 */
'use strict';

const fs = require('fs');
const path = require('path');
const subsetFont = require('subset-font');
const { scanUsedIconNames, loadGlyphMap } = require('./lib/iconScan');

const UPSTREAM = require.resolve('@react-native-vector-icons/ionicons/fonts/Ionicons.ttf');
const OUT = path.resolve(__dirname, '../android/app/src/main/assets/fonts/Ionicons.ttf');

async function main() {
  const glyphMap = loadGlyphMap();
  const used = scanUsedIconNames();
  if (used.length < 50) {
    // A scan that suddenly finds almost nothing is a broken scan, not a lean
    // app - same vacuous-pass defence as neutralRoleAdoption.test.ts.
    throw new Error(`Scan found only ${used.length} icons - refusing to subset on a broken scan.`);
  }

  const text = used.map(name => String.fromCodePoint(glyphMap[name])).join('');
  const source = fs.readFileSync(UPSTREAM);
  const subset = await subsetFont(source, text, { targetFormat: 'truetype' });

  fs.writeFileSync(OUT, subset);
  console.log(
    `Ionicons subset: ${used.length}/${Object.keys(glyphMap).length} glyphs, ` +
      `${source.length} B -> ${subset.length} B ` +
      `(${((1 - subset.length / source.length) * 100).toFixed(1)}% smaller)`,
  );
  console.log(`Written: ${OUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
