import { test, expect, settle, localePath } from './fixtures';

/**
 * AUDIT PROBE - reports facts about the rendered DOM, asserts almost nothing.
 *
 * Companion to audit.spec.ts. Screenshots show what a page looks like; this
 * shows what a screen reader and a keyboard get. Both are needed: a missing
 * accessible name is invisible in a screenshot, and a broken layout is
 * invisible in the DOM.
 *
 *   VISUAL_AUDIT=1 npx playwright test a11y-probe --project=desktop-light-en
 *
 * Excluded from regression runs. It prints; it does not gate.
 */

const ROUTES = [
  '/',
  '/consumer',
  '/companies',
  '/esg',
  '/food-waste-facts',
  '/locations',
  '/partners',
  '/careers',
  '/contact',
  '/blog',
  '/how-to-collect',
  '/mission-driven',
  '/humanity-mission',
  '/marketplace-surprise-bag',
  '/parcless-bag',
  '/dream',
  '/coming-soon',
  '/login',
  '/forgot-password',
  '/privacy-policy',
  '/terms-of-service',
  '/security',
];

test.describe('@audit a11y probe', () => {
  for (const path of ROUTES) {
    test(`probe ${path}`, async ({ visualPage, locale }) => {
      const res = await visualPage.goto(localePath(locale, path), {
        waitUntil: 'domcontentloaded',
      });
      await settle(visualPage);

      const facts = await visualPage.evaluate(() => {
        const txt = (el: Element) => (el.textContent ?? '').trim();

        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
          level: Number(h.tagName[1]),
          text: txt(h).slice(0, 40),
        }));

        let skips = 0;
        for (let i = 1; i < headings.length; i += 1) {
          if (headings[i]!.level - headings[i - 1]!.level > 1) skips += 1;
        }

        const imgs = Array.from(document.querySelectorAll('img'));
        const imgsNoAlt = imgs.filter(i => !i.hasAttribute('alt')).length;

        const named = (el: Element) =>
          txt(el).length > 0 ||
          !!el.getAttribute('aria-label') ||
          !!el.getAttribute('aria-labelledby') ||
          !!el.querySelector('img[alt]:not([alt=""])');

        const buttons = Array.from(document.querySelectorAll('button'));
        const links = Array.from(document.querySelectorAll('a[href]'));

        const inputs = Array.from(
          document.querySelectorAll('input:not([type=hidden]), select, textarea'),
        );
        const inputsUnlabelled = inputs.filter(el => {
          const id = el.getAttribute('id');
          const hasFor = id ? !!document.querySelector(`label[for="${CSS.escape(id)}"]`) : false;
          return (
            !hasFor &&
            !el.getAttribute('aria-label') &&
            !el.getAttribute('aria-labelledby') &&
            !el.closest('label')
          );
        }).length;

        // Elements whose focus outline is removed with nothing put back.
        const focusKilled = Array.from(document.querySelectorAll('a,button,input,select,textarea'))
          .filter(el => {
            const cs = getComputedStyle(el);
            return cs.outlineStyle === 'none' || cs.outlineWidth === '0px';
          })
          .filter(el => {
            const cls = el.className;
            const s = typeof cls === 'string' ? cls : '';
            return !/ring-|outline-\d/.test(s);
          }).length;

        // Smallest interactive hit box actually rendered.
        const hitBoxes = [...buttons, ...links]
          .map(el => el.getBoundingClientRect())
          .filter(r => r.width > 0 && r.height > 0);
        const under44 = hitBoxes.filter(r => r.height < 44 || r.width < 44).length;

        return {
          title: document.title.slice(0, 60),
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          h1: headings.filter(h => h.level === 1).length,
          headingSkips: skips,
          landmarks: {
            header: document.querySelectorAll('header').length,
            nav: document.querySelectorAll('nav').length,
            main: document.querySelectorAll('main').length,
            footer: document.querySelectorAll('footer').length,
          },
          images: imgs.length,
          imgsNoAlt,
          buttons: buttons.length,
          buttonsUnnamed: buttons.filter(b => !named(b)).length,
          links: links.length,
          linksUnnamed: links.filter(a => !named(a)).length,
          inputs: inputs.length,
          inputsUnlabelled,
          focusKilled,
          interactive: hitBoxes.length,
          under44,
          hasSkipLink: !!document.querySelector('a[href^="#"][class*="sr-only"], a[href="#main"]'),
        };
      });

      // eslint-disable-next-line no-console
      console.log(`PROBE ${path} ${JSON.stringify(facts)}`);
      expect(res?.status()).toBe(200);
    });
  }
});
