#!/usr/bin/env node
/**
 * Find pages whose canonical points somewhere other than themselves.
 *
 * Next.js inherits `alternates` from the nearest ancestor that sets it. The
 * root layout sets it - to the homepage, because it is the homepage's layout -
 * so every page that does not define its own `alternates` ships:
 *
 *   /en/privacy-policy  ->  <link rel="canonical" href=".../en"/>
 *
 * A self-referencing canonical is how a page asks to be indexed. Pointing it at
 * another URL asks Google to drop this one and credit that one, so a page can
 * set `robots: { index: true }` and still be excluded - the canonical is the
 * stronger of the two instructions, and they were contradicting each other on
 * every page without its own metadata.
 *
 * This reads the built HTML rather than the source, because the source cannot
 * show you an inherited value. That is exactly why the bug survived: nothing in
 * `privacy-policy/page.tsx` is wrong.
 *
 *   pnpm --filter @foodwaste/web build
 *   pnpm --filter @foodwaste/web check:canonical
 *
 * A noindex page is exempt: its canonical cannot mislead anything.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const APP = join(ROOT, '.next/server/app');

/** The path part of a canonical, with the origin and locale prefix removed. */
export function canonicalPathOf(html) {
  const m = html.match(/<link rel="canonical" href="([^"]*)"/);
  if (!m) return null;
  return new URL(m[1]).pathname.replace(/\/$/, '') || '/';
}

export const isNoIndex = html => /name="robots" content="noindex/.test(html);

/**
 * A route that only calls `redirect()` prerenders a shell with no content. It
 * has no canonical of its own to get wrong, and the reader never sees it.
 */
const MIN_VISIBLE_CHARS = 200;
export const isRedirectShell = html =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length < MIN_VISIBLE_CHARS;

function* builtPages(dir, prefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* builtPages(full, `${prefix}/${entry.name}`);
    else if (entry.name.endsWith('.html')) {
      const name = entry.name.replace(/\.html$/, '');
      yield {
        route: name === 'index' ? prefix || '/' : `${prefix}/${name}`,
        html: readFileSync(full, 'utf8'),
      };
    }
  }
}

function main() {
  if (!existsSync(APP)) {
    console.error('No build output. Run `pnpm --filter @foodwaste/web build` first.');
    return 1;
  }

  const offences = [];
  let checked = 0;

  for (const { route, html } of builtPages(APP)) {
    // Only the locale-prefixed pages carry canonicals worth checking.
    if (!/^\/(en|fr|ar)(\/|$)/.test(route)) continue;
    if (isNoIndex(html) || isRedirectShell(html)) continue;

    checked++;
    const canonical = canonicalPathOf(html);
    if (canonical === null) {
      offences.push(`${route}  has no canonical at all`);
      continue;
    }
    if (canonical !== route.replace(/\/$/, '')) {
      offences.push(`${route}  ->  ${canonical}`);
    }
  }

  console.log(`${checked} indexable pages checked`);
  if (offences.length === 0) {
    console.log('Every indexable page is canonical to itself.');
    return 0;
  }
  console.log(`\n${offences.length} pointing elsewhere:`);
  for (const o of offences) console.log(`  ${o}`);
  console.log('\nEach needs its own generateMetadata via buildPageMetadata.');
  return 1;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  process.exit(main());
}
