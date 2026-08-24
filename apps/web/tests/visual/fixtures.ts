import { test as base, expect, type Page } from '@playwright/test';

/**
 * Determinism fixtures.
 *
 * Everything here runs *before first paint*. That matters: seeding
 * localStorage after navigation means the cookie banner and the light theme
 * both render first and then disappear, and a screenshot taken during that
 * window is a different image every run.
 */

/** Frozen instant. Any relative time ("2 hours ago") resolves identically. */
export const FROZEN_NOW = new Date('2026-06-15T12:00:00.000Z');

type VisualFixtures = {
  /** A page with consent dismissed, theme pinned, clock frozen, motion off. */
  visualPage: Page;
  theme: 'light' | 'dark';
  locale: 'en' | 'fr' | 'ar';
};

export const test = base.extend<VisualFixtures>({
  theme: async ({}, use, testInfo) => {
    await use((testInfo.project.metadata?.theme as 'light' | 'dark') ?? 'light');
  },

  locale: async ({}, use, testInfo) => {
    await use((testInfo.project.metadata?.locale as 'en' | 'fr' | 'ar') ?? 'en');
  },

  visualPage: async ({ page, theme }, use) => {
    /*
     * The theme is a cookie, read by the pre-paint script in <head> before the
     * body renders (lib/theme-script.ts). It must therefore be set on the
     * context *before navigation* - an addInitScript would still land before
     * page scripts, but addCookies is the guarantee.
     *
     * Cookie consent is still localStorage, which CookieConsent reads in an
     * effect, so seeding it via addInitScript is early enough.
     */
    await page.context().addCookies([
      {
        name: 'foodwaste-theme',
        value: theme,
        url: 'http://127.0.0.1:3111',
        sameSite: 'Lax',
      },
    ]);

    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('cookie-consent', 'accepted');
      } catch {
        // Storage unavailable - the run is still valid, just less stable.
      }
    });

    // Freeze time so anything date-derived renders the same on every run.
    await page.clock.install({ time: FROZEN_NOW });

    /*
     * Belt and braces over Playwright's `animations: 'disabled'`: that handles
     * CSS animations and transitions, this also catches smooth scrolling and
     * anything reading the computed transition duration in JS.
     */
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          scroll-behavior: auto !important;
        }
        /* Media that has not loaded paints at a different size mid-run. */
        img, video { image-rendering: pixelated; }
      `,
    });

    await use(page);
  },
});

export { expect };

/**
 * Wait until the page is genuinely settled.
 *
 * `networkidle` alone is not enough here: next/font self-hosts, so fonts can
 * still be swapping after the network goes quiet, and a screenshot taken then
 * captures the fallback face with different metrics. `document.fonts.ready`
 * is the actual signal.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // One rAF so any layout triggered by the font swap has been committed.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
}

/** Locale-prefixed path, matching next-intl's routing. */
export function localePath(locale: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean === '/' ? '' : clean}`;
}
