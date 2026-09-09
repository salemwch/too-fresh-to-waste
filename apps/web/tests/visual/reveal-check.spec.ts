import { test as base, expect } from '@playwright/test';

/**
 * Audit integrity check.
 *
 * The audit captures showed large empty regions on some marketing pages. Before
 * that can be reported as a page defect, it has to be separated from a harness
 * artefact: the audit fixtures disable animations and jump-scroll, which could
 * freeze an IntersectionObserver reveal at its initial opacity:0 state.
 *
 * This spec deliberately uses the RAW page - no animation suppression, no
 * fixtures - and scrolls slowly, then counts elements that are still invisible.
 */

const PAGES = ['/en/companies', '/en/esg', '/en/partners', '/en/food-waste-facts'];

base.describe('@audit reveal check', () => {
  for (const path of PAGES) {
    base(`reveal ${path}`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('cookie-consent', 'accepted');
        } catch {
          /* ignore */
        }
      });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      // Slow, stepwise scroll so every IntersectionObserver threshold fires.
      await page.evaluate(async () => {
        const step = Math.floor(window.innerHeight * 0.6);
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 220));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400));
      });

      const stats = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('section, div[class*="opacity"]'));
        let invisible = 0;
        const samples: string[] = [];
        for (const el of all) {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.height > 120 && parseFloat(cs.opacity) < 0.05) {
            invisible += 1;
            if (samples.length < 5) {
              samples.push(
                `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} h=${Math.round(r.height)} op=${cs.opacity}`,
              );
            }
          }
        }
        return { docHeight: document.body.scrollHeight, sections: all.length, invisible, samples };
      });

       
      console.log(`REVEAL ${path} ${JSON.stringify(stats)}`);
      expect(stats.docHeight).toBeGreaterThan(0);
    });
  }
});
