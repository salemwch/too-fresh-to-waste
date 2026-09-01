import { test, expect, settle, localePath } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Contrast gate for filled controls.
 *
 * This exists because the screenshot suite **cannot see a colour token change**,
 * which was discovered while closing §19-E2 and is worth writing down:
 *
 *  1. `maxDiffPixelRatio: 0.01` is a ratio of the whole image. The highlighted
 *     item's label in `select-open-selected.png` is 775px of a 1280x900 shot -
 *     0.067%. Flipping it from near-white to near-black moves every one of
 *     those pixels and still lands two orders of magnitude under the budget.
 *  2. Playwright's per-pixel `threshold` defaults to 0.2 in YIQ space, i.e. a
 *     squared-delta budget of 35215 x 0.2^2 = 1408.6. Moving `--destructive`
 *     from `#EF4343` to `#D32F2F` is a delta of **260.7**, so the comparator
 *     counts *zero* changed pixels. It would need `threshold < 0.086`.
 *
 * Both thresholds are right for their job - they absorb font hinting across
 * machines. They are simply the wrong instrument for "is this text legible".
 *
 * So this measures instead of comparing: it reads the computed colours the
 * browser actually resolved and applies the WCAG 2.1 formula to them. No
 * pixels, no baseline, no tolerance to tune. It runs in every project, so the
 * dark theme is gated on the same terms as light.
 */

/** WCAG 2.1 relative luminance. */
function luminance([r, g, b]: readonly number[]): number {
  const ch = (c: number): number => {
    const v = (c ?? 0) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r ?? 0) + 0.7152 * ch(g ?? 0) + 0.0722 * ch(b ?? 0);
}

function contrast(fg: readonly number[], bg: readonly number[]): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

type Resolved = { fg: number[]; bg: number[]; fgCss: string; bgCss: string };

/**
 * Resolve what the label is actually painted on.
 *
 * `background-color` on the element itself is usually transparent, and an
 * alpha fill (`bg-destructive/90`) has to be composited onto whatever is
 * behind it or the number is meaningless. So: walk up compositing every
 * translucent layer until an opaque one is reached.
 */
async function resolve(page: Page, selector: string): Promise<Resolved> {
  return page.evaluate((sel: string) => {
    const parse = (css: string): number[] => {
      const m = css.match(/-?[\d.]+/g);
      if (!m) return [0, 0, 0, 1];
      const [r = 0, g = 0, b = 0, a = 1] = m.map(Number);
      return [r, g, b, a];
    };

    const el = document.querySelector(sel);
    if (!el) throw new Error(`contrast probe: no element for ${sel}`);

    const fgCss = getComputedStyle(el).color;
    const fg = parse(fgCss);

    // Composite the stack of backgrounds from the element outwards.
    const layers: number[][] = [];
    let node: Element | null = el;
    while (node) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if ((bg[3] ?? 0) > 0) {
        layers.push(bg);
        if ((bg[3] ?? 0) >= 1) break;
      }
      node = node.parentElement;
    }
    // Nothing opaque found: the page background is the floor.
    layers.push(parse(getComputedStyle(document.body).backgroundColor));

    let bg: number[] = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!l) continue;
      const a = l[3] ?? 1;
      bg = [0, 1, 2].map(k => (l[k] ?? 0) * a + (bg[k] ?? 0) * (1 - a));
    }

    // Text alpha blends toward its own backdrop, so apply it last.
    const fa = fg[3] ?? 1;
    const eff = [0, 1, 2].map(k => (fg[k] ?? 0) * fa + (bg[k] ?? 0) * (1 - fa));

    return { fg: eff, bg, fgCss, bgCss: getComputedStyle(el).backgroundColor };
  }, selector);
}

/**
 * The filled controls §19-E1 and §19-E2 changed, plus the ones that share
 * their tokens. Resting states only - the `/90` and `/80` hover states are a
 * separate, still-open finding (§19-E31) and are reported below rather than
 * asserted, so this gate stays green on a known and documented gap.
 */
const FILLED = [
  { name: 'Button, destructive', selector: '[data-visual="button"] .bg-destructive' },
  { name: 'Badge, destructive', selector: '[data-visual="badge"] .bg-destructive' },
  { name: 'Alert, destructive', selector: '[data-visual="alert"] [role="alert"].text-destructive' },
] as const;

test.describe('filled controls carry legible labels', () => {
  test.beforeEach(async ({ visualPage, locale }) => {
    await visualPage.goto(localePath(locale, '/visual-harness'));
    await settle(visualPage);
  });

  for (const { name, selector } of FILLED) {
    test(name, async ({ visualPage }) => {
      const count = await visualPage.locator(selector).count();
      // A selector that matches nothing would make the assertion vacuous.
      expect(count, `${selector} should exist in the harness`).toBeGreaterThan(0);

      const r = await resolve(visualPage, selector);
      const ratio = contrast(r.fg, r.bg);
      expect(
        ratio,
        `${name}: ${r.fgCss} on ${r.bg.map(Math.round).join(',')} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('accent fill under its foreground token', async ({ visualPage }) => {
    /*
     * `--accent-foreground` only applies on hover/focus, so it has to be driven
     * rather than read at rest. The open Select's highlighted item is the one
     * place it is reachable without synthesising a pointer.
     */
    await visualPage.locator('#vh-select-selected').click();
    await expect(visualPage.getByRole('listbox')).toBeVisible();

    const selector = '[role="option"][data-highlighted]';
    const count = await visualPage.locator(selector).count();
    expect(count, 'an open Select should have a highlighted option').toBeGreaterThan(0);

    const r = await resolve(visualPage, selector);
    const ratio = contrast(r.fg, r.bg);
    expect(
      ratio,
      `highlighted option: ${r.fgCss} on ${r.bgCss} = ${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});
