/**
 * Shared icon-usage scanner - the single source of truth for which Ionicons
 * glyphs the app can ever render.
 *
 * Used by BOTH:
 *   - scripts/subset-icon-font.js  (generates the shipped subset font)
 *   - src/__tests__/iconFontSubset.test.ts  (CI guard: every name found here
 *     must exist in the shipped font's cmap)
 *
 * Because generator and guard share this scan, they cannot drift: an icon the
 * scan finds but the font lacks fails CI, and an icon the scan misses is - by
 * construction - a name that appears nowhere in src/ as a literal.
 *
 * METHOD
 * ------
 * Every string literal in src/  that exactly matches a glyph name in the
 * package's own glyphmap is treated as used. This deliberately OVER-collects
 * (a literal like 'add' or 'card' might be an i18n key), because for font
 * subsetting over-collection only costs bytes while under-collection ships a
 * blank box. Dynamic icon names in this codebase all draw from constants files
 * whose values are literals, and rtlMirror.ts declares both directions of
 * every mirror pair as literals, so the scan covers RTL-produced names too.
 *
 * THE ONE RESIDUAL HOLE
 * ---------------------
 * A glyph name constructed by string concatenation whose final form appears
 * nowhere as a literal would be missed. None exists today. If you ever build
 * icon names dynamically, write the complete names in a constants file - the
 * scan (and therefore the font) picks them up from there.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../../src');
const GLYPHMAP_PATH = require.resolve(
  '@react-native-vector-icons/ionicons/glyphmaps/Ionicons.json',
);

/** name -> codepoint (number) for the full upstream font */
function loadGlyphMap() {
  return JSON.parse(fs.readFileSync(GLYPHMAP_PATH, 'utf8'));
}

const LITERAL_RE = /['"`]([a-z0-9][a-z0-9-]*)['"`]/g;

/**
 * Returns the sorted list of glyph names referenced anywhere in src/ as a
 * string literal. Test files are included on purpose: a test that renders an
 * icon should render a real one.
 */
function scanUsedIconNames() {
  const glyphNames = new Set(Object.keys(loadGlyphMap()));
  const used = new Set();

  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const content = fs.readFileSync(full, 'utf8');
      let match;
      LITERAL_RE.lastIndex = 0;
      while ((match = LITERAL_RE.exec(content))) {
        if (glyphNames.has(match[1])) used.add(match[1]);
      }
    }
  };
  walk(SRC_DIR);

  return [...used].sort();
}

module.exports = { scanUsedIconNames, loadGlyphMap, SRC_DIR };
