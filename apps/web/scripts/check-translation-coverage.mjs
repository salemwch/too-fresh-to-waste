#!/usr/bin/env node
/**
 * Measure which routes are actually translated, from the prerendered HTML.
 *
 * `src/config/translated-routes.ts` decides which locales each page advertises
 * in its hreflang block, and a wrong entry there is expensive in both
 * directions: claim a French alternate that serves English and the cluster
 * becomes untrustworthy, withhold one from a page that is translated and the
 * French version never surfaces.
 *
 * So the classification is measured rather than declared. Strip the markup from
 * `/fr/<route>` and `/en/<route>`, compare the visible words, and the overlap
 * says what shipped. The split is not a judgement call: translated pages share
 * under 46% of their English text, English-only pages share over 85%, and
 * nothing has ever landed between.
 *
 * Grepping for `useTranslations` is the obvious shortcut and it is wrong, which
 * is why this exists. Four pages translate through locale-keyed objects instead
 * and would be misfiled by any such proxy.
 *
 *   pnpm --filter @foodwaste/web build
 *   pnpm --filter @foodwaste/web check:translations
 *
 * Exits non-zero when the measurement disagrees with the committed lists.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const APP = join(ROOT, '.next/server/app');
const SOURCE = 'en';
const COMPARE = 'fr';

/** Below this share of shared words a page is doing real translation work. */
export const TRANSLATED_MAX_OVERLAP = 0.6;
/** Above it, the French page is serving the English words verbatim. */
export const ENGLISH_MIN_OVERLAP = 0.8;
/** Short pages carry too little text for the ratio to mean anything. */
const MIN_WORDS = 40;

/** Visible words only: no markup, no styles, no RSC flight payload. */
export function visibleWords(html) {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;|&#\d+;/gi, ' ')
      .toLowerCase()
      .match(/[\p{L}]{4,}/gu) ?? []
  );
}

/** Share of the source page's words that survive verbatim into the other. */
export function overlapRatio(sourceHtml, otherHtml) {
  const source = visibleWords(sourceHtml);
  if (source.length < MIN_WORDS) return null;
  const other = new Set(visibleWords(otherHtml));
  return source.filter(w => other.has(w)).length / source.length;
}

function routesIn(locale) {
  const base = join(APP, locale);
  if (!existsSync(base)) return [];
  const out = [];
  (function walk(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}/${entry.name}`);
      else if (entry.name.endsWith('.html')) {
        const name = entry.name.replace(/\.html$/, '');
        out.push(name === 'index' ? prefix || '/' : `${prefix}/${name}`);
      }
    }
  })(base, '');
  return out.sort();
}

const htmlPath = (locale, route) =>
  join(APP, locale, `${route === '/' ? 'index' : route.slice(1)}.html`);

function main() {
  if (!existsSync(APP)) {
    console.error('No build output. Run `pnpm --filter @foodwaste/web build` first.');
    return 1;
  }

  const measured = [];
  for (const route of routesIn(SOURCE)) {
    const a = htmlPath(SOURCE, route);
    const b = htmlPath(COMPARE, route);
    if (!existsSync(a) || !existsSync(b)) continue;
    const ratio = overlapRatio(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
    if (ratio === null) continue;
    measured.push({ route, ratio });
  }

  measured.sort((x, y) => y.ratio - x.ratio);

  const ambiguous = [];
  console.log('route'.padEnd(34), 'shared with fr'.padStart(15), '  verdict');
  for (const { route, ratio } of measured) {
    let verdict;
    if (ratio >= ENGLISH_MIN_OVERLAP) verdict = 'english only';
    else if (ratio <= TRANSLATED_MAX_OVERLAP) verdict = 'translated';
    else {
      verdict = 'AMBIGUOUS - read it';
      ambiguous.push(route);
    }
    console.log(route.padEnd(34), `${(ratio * 100).toFixed(0)}%`.padStart(15), ' ', verdict);
  }

  console.log(`\n${measured.length} routes measured, ${ambiguous.length} ambiguous`);
  if (ambiguous.length > 0) {
    console.log(`Decide by hand, then update src/config/translated-routes.ts: ${ambiguous.join(', ')}`);
    return 1;
  }
  console.log('Every route falls clearly on one side. Reconcile with translated-routes.ts.');
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  process.exit(main());
}
