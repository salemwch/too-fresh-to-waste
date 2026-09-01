import { test, expect, settle, localePath } from './fixtures';

/**
 * A deliberately small set of real routes.
 *
 * The component harness (components.spec.ts) is where primitives are covered
 * exhaustively. These exist to catch the things a harness page cannot: the real
 * header, real navigation, real translated copy at real lengths, and the
 * composition of primitives into a page.
 *
 * Only public routes are covered. Everything behind AuthGuard needs a seeded
 * session and a backend, which would make these tests depend on data that is
 * not deterministic. That is tracked in the README as the next step, not
 * pretended away here.
 *
 * Screenshots are viewport-only rather than full-page on purpose: below the
 * fold these pages carry marquees, lazy images and intersection-observer
 * reveals, and a full-page baseline would be measuring those rather than the
 * layout. Full-page coverage is a follow-up once each is individually pinned.
 */

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'food-waste-facts', path: '/food-waste-facts' },
  /*
   * parcless-bag is the only marketing page built entirely from raw hex rather
   * than tokens (DESIGN_DECISIONS_PENDING.md D3), so it cannot drift *with* the
   * token set and nothing else would catch it drifting on its own.
   *
   * The dark-theme projects are the point of adding it. `bg-primary` is the one
   * token the page does use, and it inverts under `.dark` while every hardcoded
   * foreground sitting on top of it stays put.
   */
  { name: 'parcless-bag', path: '/parcless-bag' },
] as const;

test.describe('public routes', () => {
  for (const route of ROUTES) {
    test(route.name, async ({ visualPage, locale }) => {
      const response = await visualPage.goto(localePath(locale, route.path));

      // A 404 that still screenshots cleanly would silently become a baseline.
      expect(response?.status(), `${route.path} should serve 200`).toBe(200);

      await settle(visualPage);

      // Pin scroll position: the marketing header restyles once scrolled, so a
      // page restored mid-scroll would alternate between two valid renders.
      await visualPage.evaluate(() => window.scrollTo(0, 0));

      await expect(visualPage).toHaveScreenshot(`${route.name}.png`);
    });
  }
});
