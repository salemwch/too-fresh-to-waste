import { test, expect, settle, localePath } from './fixtures';

/**
 * AUDIT CAPTURE - not a regression suite.
 *
 * This spec exists to produce full-page screenshots of every publicly reachable
 * route so they can be opened and reviewed by eye. It writes to
 * `tests/visual/.audit/` (gitignored), asserts nothing about appearance, and is
 * excluded from the default run via its own grep tag.
 *
 *   npx playwright test audit --project=desktop-light-en
 *
 * It is separate from routes.spec.ts on purpose: that one has committed
 * baselines and must stay small and stable. This one is a throwaway camera.
 */

const ROUTES = [
  // marketing
  { name: '01-home', path: '/' },
  { name: '02-consumer', path: '/consumer' },
  { name: '03-companies', path: '/companies' },
  { name: '04-esg', path: '/esg' },
  { name: '05-food-waste-facts', path: '/food-waste-facts' },
  { name: '06-locations', path: '/locations' },
  { name: '07-partners', path: '/partners' },
  { name: '08-careers', path: '/careers' },
  { name: '09-contact', path: '/contact' },
  { name: '10-blog', path: '/blog' },
  { name: '11-how-to-collect', path: '/how-to-collect' },
  { name: '12-mission-driven', path: '/mission-driven' },
  { name: '13-humanity-mission', path: '/humanity-mission' },
  { name: '14-surprise-bag', path: '/marketplace-surprise-bag' },
  { name: '15-parcless-bag', path: '/parcless-bag' },
  { name: '16-dream', path: '/dream' },
  { name: '17-coming-soon', path: '/coming-soon' },
  // auth
  { name: '20-login', path: '/login' },
  { name: '21-forgot-password', path: '/forgot-password' },
  // legal
  { name: '30-privacy-policy', path: '/privacy-policy' },
  { name: '31-terms-of-service', path: '/terms-of-service' },
  { name: '32-security', path: '/security' },
] as const;

test.describe('@audit capture', () => {
  for (const route of ROUTES) {
    test(route.name, async ({ visualPage }, testInfo) => {
      const { viewport, theme, locale } = testInfo.project.metadata as {
        viewport: string;
        theme: string;
        locale: string;
      };

      const response = await visualPage.goto(localePath(locale, route.path), {
        waitUntil: 'domcontentloaded',
      });
      const status = response?.status() ?? 0;

      await settle(visualPage);
      await visualPage.evaluate(() => window.scrollTo(0, 0));

      // Give lazy/intersection content one chance to settle after a full scroll.
      await visualPage.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 350));
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 250));
      });

      const dir = `${viewport}-${theme}-${locale}`;
      await visualPage.screenshot({
        path: `tests/visual/.audit/${dir}/${route.name}.png`,
        fullPage: true,
      });

      // The only assertion: the route actually served. A 404 that photographs
      // cleanly would otherwise be filed as "audited".
      expect(status, `${route.path} served ${status}`).toBe(200);
    });
  }
});
