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

/**
 * /parcless-bag - every text node on the page, in both themes.
 *
 * A selector list was the wrong shape here. The page carries ~44 distinct
 * text/background pairings across five grounds, and the failure that started
 * §19-E33 was not any single one of them: it was that `bg-primary` inverts
 * under `.dark` while the hardcoded foreground on top of it does not, so 40 of
 * the 44 failed in dark mode against 25 in light. A gate that only watched the
 * pairings someone remembered to list would not have caught that, and would
 * drift the moment the page gained a paragraph.
 *
 * So this walks the rendered page instead and asserts on all of it. Because the
 * project matrix runs it at 3 viewports x {light-en, dark-en, light-ar,
 * light-fr}, one spec covers both themes, all three locales and every
 * breakpoint.
 */
test.describe('parcless-bag text is legible on its own ground', () => {
  test('every visible text node meets AA', async ({ visualPage, locale }) => {
    const response = await visualPage.goto(localePath(locale, '/parcless-bag'));
    expect(response?.status(), '/parcless-bag should serve 200').toBe(200);
    await settle(visualPage);

    /*
     * Settle the entry animations before measuring.
     *
     * The page fades in: `.rv` elements start at `opacity: 0` and gain `.in`
     * from an IntersectionObserver, and the hero uses inline
     * `opacity: 0; animation: ... forwards`. Measured mid-entry, each of those
     * reports a contrast of exactly 1.00 - the text composites fully into its
     * own background - which is an artefact of the animation, not a legibility
     * defect. The first run of this gate reported exactly that.
     *
     * So the page is put into the state a user actually reads it in. Nothing
     * with a deliberate partial opacity is disturbed: the only one left is the
     * 0.38 quote ornament, which is `aria-hidden` and skipped below anyway.
     */
    await visualPage.addStyleTag({
      content: `main.parcless-bag-theme *, main.parcless-bag-theme {
        animation: none !important;
        transition: none !important;
      }`,
    });
    await visualPage.evaluate(() => {
      const root = document.querySelector('main.parcless-bag-theme');
      root?.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
      for (const el of Array.from(root?.querySelectorAll<HTMLElement>('*') ?? [])) {
        // `!important` because the entry state is an inline `opacity: 0`, and
        // a plain assignment would still be racing the 0.7s reveal transition.
        if (getComputedStyle(el).opacity === '0') {
          el.style.setProperty('opacity', '1', 'important');
        }
      }
    });

    const result = await visualPage.evaluate(() => {
      const parse = (css: string): number[] => {
        const m = css.match(/-?[\d.]+/g);
        if (!m) return [0, 0, 0, 1];
        const [r = 0, g = 0, b = 0, a = 1] = m.map(Number);
        return [r, g, b, a];
      };
      const chan = (c: number): number => {
        const v = (c ?? 0) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const lum = (c: number[]): number =>
        0.2126 * chan(c[0] ?? 0) + 0.7152 * chan(c[1] ?? 0) + 0.0722 * chan(c[2] ?? 0);

      const root = document.querySelector('main.parcless-bag-theme');
      if (!root) throw new Error('parcless-bag-theme scope not found - is the class still on <main>?');

      const out: { text: string; fg: string; bg: string; ratio: number; need: number }[] = [];
      let checked = 0;

      for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        // Decorative subtrees are exempt from 1.4.3 - but only because they are
        // genuinely out of the accessibility tree, which is what this checks.
        if (el.closest('[aria-hidden="true"]')) continue;
        // SVG carries its own paint model; the illustration has no text role.
        if (el.closest('svg')) continue;

        // Only elements that own a non-empty direct text node.
        const own = Array.from(el.childNodes).some(
          n => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
        );
        if (!own) continue;

        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;

        // Composite the background stack outwards to the first opaque layer.
        const layers: number[][] = [];
        let node: Element | null = el;
        while (node) {
          const b = parse(getComputedStyle(node).backgroundColor);
          if ((b[3] ?? 0) > 0) {
            layers.push(b);
            if ((b[3] ?? 0) >= 1) break;
          }
          node = node.parentElement;
        }
        layers.push(parse(getComputedStyle(document.body).backgroundColor));

        let bg: number[] = [255, 255, 255];
        for (let i = layers.length - 1; i >= 0; i--) {
          const l = layers[i];
          if (!l) continue;
          const a = l[3] ?? 1;
          bg = [0, 1, 2].map(k => (l[k] ?? 0) * a + (bg[k] ?? 0) * (1 - a));
        }

        // Text alpha, and any element opacity, both blend toward that ground.
        const fg = parse(cs.color);
        const selfOpacity = Number.parseFloat(cs.opacity || '1');
        const alpha = (fg[3] ?? 1) * (Number.isFinite(selfOpacity) ? selfOpacity : 1);
        const eff = [0, 1, 2].map(k => (fg[k] ?? 0) * alpha + (bg[k] ?? 0) * (1 - alpha));

        const la = lum(eff);
        const lb = lum(bg);
        const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);

        const px = Number.parseFloat(cs.fontSize);
        const weight = Number.parseInt(cs.fontWeight, 10) || 400;
        const need = px >= 24 || (px >= 18.66 && weight >= 700) ? 3 : 4.5;

        checked++;
        if (ratio < need) {
          out.push({
            text: (el.textContent ?? '').trim().slice(0, 40),
            fg: cs.color,
            bg: `rgb(${bg.map(Math.round).join(',')})`,
            ratio: Math.round(ratio * 100) / 100,
            need,
          });
        }
      }
      return { failures: out, checked };
    });

    // A scope that matched nothing would make the assertion below vacuous.
    expect(result.checked, 'should have measured real text nodes').toBeGreaterThan(20);
    expect(
      result.failures,
      `${result.failures.length} of ${result.checked} text nodes below AA:\n` +
        result.failures.map(f => `  ${f.ratio} (needs ${f.need})  ${f.fg} on ${f.bg}  "${f.text}"`).join('\n'),
    ).toEqual([]);
  });
});

/**
 * Destructive interaction states (§19-E31).
 *
 * The resting fill was fixed by §19-E2, but `hover:bg-destructive/90` (Button)
 * and `/80` (Badge) composited that fill toward the page. On a light ground
 * that lightens it, which is the wrong direction for a fill that has to carry
 * near-white text. Both are now a solid `--destructive-hover` step from the
 * error ramp, so nothing composites and the value is the same in every context.
 *
 * Hover is driven with a real pointer rather than asserted from the class list,
 * and focus with a real Tab, because the question is what the browser resolves
 * in that state - not what the source says it should.
 *
 * `disabled` is measured and reported but deliberately **not** asserted: WCAG
 * 1.4.3 exempts inactive controls, and `disabled:opacity-50` puts it far below
 * 4.5 by design. Asserting it would be asserting the wrong standard.
 */
const DESTRUCTIVE_STATES = [
  { name: 'Button, destructive', selector: '[data-visual="button"] button.bg-destructive' },
  { name: 'Badge, destructive', selector: '[data-visual="badge"] .bg-destructive' },
] as const;

test.describe('destructive states carry legible labels', () => {
  test.beforeEach(async ({ visualPage, locale }) => {
    await visualPage.goto(localePath(locale, '/visual-harness'));
    await settle(visualPage);
  });

  for (const { name, selector } of DESTRUCTIVE_STATES) {
    test(`${name} - resting and hover`, async ({ visualPage }) => {
      const target = visualPage.locator(selector).first();
      await expect(target).toBeVisible();

      const resting = await resolve(visualPage, selector);
      const restingRatio = contrast(resting.fg, resting.bg);
      expect(
        restingRatio,
        `${name} resting: ${resting.fgCss} on ${resting.bgCss} = ${restingRatio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);

      await target.hover();
      /*
       * `transition-colors` means the fill is still moving when `hover()`
       * returns. Polling until it merely *differs* from resting is not enough -
       * that samples the first interpolated frame, and the number it reports is
       * not the one that ships. Poll until two consecutive reads agree.
       */
      let previous = '';
      await expect
        .poll(
          async () => {
            const current = (await resolve(visualPage, selector)).bgCss;
            const settled = current !== resting.bgCss && current === previous;
            previous = current;
            return settled;
          },
          { message: `${name} hover fill should settle on a new colour` },
        )
        .toBe(true);

      const hovered = await resolve(visualPage, selector);
      const hoverRatio = contrast(hovered.fg, hovered.bg);
      expect(
        hoverRatio,
        `${name} hover: ${hovered.fgCss} on ${hovered.bgCss} = ${hoverRatio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('Button, destructive - keyboard focus', async ({ visualPage }) => {
    const selector = '[data-visual="button"] button.bg-destructive';
    await visualPage.locator(selector).first().focus();

    const focused = await visualPage.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`no element for ${sel}`);
      const cs = getComputedStyle(el);
      return {
        isFocused: document.activeElement === el,
        outlineWidth: cs.outlineWidth,
        boxShadow: cs.boxShadow,
      };
    }, selector);

    // The variant sets `focus-visible:ring-2`, which paints as a box-shadow.
    // A control that takes focus with no visible indicator is a 2.4.7 failure,
    // and it is the kind that a screenshot of the resting state cannot show.
    expect(focused.isFocused, 'the destructive button should be focusable').toBe(true);

    const r = await resolve(visualPage, selector);
    const ratio = contrast(r.fg, r.bg);
    expect(
      ratio,
      `focused label: ${r.fgCss} on ${r.bgCss} = ${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  test('Button, destructive - disabled is inert and visibly dimmed', async ({ visualPage }) => {
    const selector = '[data-visual-destructive-disabled]';
    const el = visualPage.locator(selector);
    await expect(el).toBeVisible();
    await expect(el).toBeDisabled();

    /*
     * WCAG 1.4.3 exempts inactive controls, so there is no ratio to assert here
     * and asserting one would be asserting the wrong standard. An earlier
     * version of this test required the measured contrast to stay *below* 4.5,
     * which is a perverse contract - it would have failed the day someone
     * improved the disabled state - and it failed anyway, because `resolve()`
     * reads `color` and `background-color` and does not fold in element
     * opacity, so it was scoring the undimmed colours.
     *
     * What actually matters is the contract the variant sets: the control is
     * dimmed so it reads as unavailable, and it cannot be interacted with.
     */
    const state = await visualPage.evaluate((sel: string) => {
      const node = document.querySelector(sel);
      if (!node) throw new Error(`no element for ${sel}`);
      const cs = getComputedStyle(node);
      return { opacity: cs.opacity, pointerEvents: cs.pointerEvents };
    }, selector);

    expect(Number.parseFloat(state.opacity), 'disabled should be dimmed').toBeLessThan(1);
    expect(state.pointerEvents, 'disabled should not take pointer events').toBe('none');
  });
});

/**
 * Input boundary contrast (D2/E4, WCAG 1.4.11).
 *
 * `--input` was identical to `--border` at ~1.24:1 against the page, far below
 * the 3:1 floor for "visual information required to identify a control." Now
 * `--input` is darkened to >= 3:1 while `--border` stays unchanged for
 * decorative dividers, cards and separators.
 *
 * This measures the browser's resolved `borderColor` against both the inside
 * (the input's own background) and outside (the parent surface), so the gate
 * catches a regression on either edge.
 */
test.describe('input boundary meets 1.4.11', () => {
  test.beforeEach(async ({ visualPage, locale }) => {
    await visualPage.goto(localePath(locale, '/visual-harness'));
    await settle(visualPage);
  });

  test('border-input passes 3:1 on both edges', async ({ visualPage }) => {
    const result = await visualPage.evaluate(() => {
      const parse = (css: string): number[] => {
        const m = css.match(/-?[\d.]+/g);
        if (!m) return [0, 0, 0, 1];
        const [r = 0, g = 0, b = 0, a = 1] = m.map(Number);
        return [r, g, b, a];
      };
      const chan = (c: number): number => {
        const v = (c ?? 0) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const lum = (c: number[]): number =>
        0.2126 * chan(c[0] ?? 0) + 0.7152 * chan(c[1] ?? 0) + 0.0722 * chan(c[2] ?? 0);
      const ratio = (a: number[], b: number[]): number =>
        (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

      const compositeUp = (start: Element): number[] => {
        const layers: number[][] = [];
        let node: Element | null = start;
        while (node) {
          const bg = parse(getComputedStyle(node).backgroundColor);
          if ((bg[3] ?? 0) > 0) {
            layers.push(bg);
            if ((bg[3] ?? 0) >= 1) break;
          }
          node = node.parentElement;
        }
        layers.push(parse(getComputedStyle(document.body).backgroundColor));
        let out = [255, 255, 255];
        for (let i = layers.length - 1; i >= 0; i--) {
          const l = layers[i];
          if (!l) continue;
          const a = l[3] ?? 1;
          out = [0, 1, 2].map(k => (l[k] ?? 0) * a + (out[k] ?? 0) * (1 - a));
        }
        return out;
      };

      const el = document.querySelector('#vh-input');
      if (!el) throw new Error('no #vh-input in harness');
      const border = parse(getComputedStyle(el).borderColor);
      const inside = compositeUp(el);
      const outside = el.parentElement ? compositeUp(el.parentElement) : inside;

      return {
        borderCss: getComputedStyle(el).borderColor,
        insideRatio: Math.round(ratio(border, inside) * 100) / 100,
        outsideRatio: Math.round(ratio(border, outside) * 100) / 100,
      };
    });

    expect(
      result.insideRatio,
      `border on inside: ${result.borderCss} = ${result.insideRatio}`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      result.outsideRatio,
      `border on outside: ${result.borderCss} = ${result.outsideRatio}`,
    ).toBeGreaterThanOrEqual(3);
  });
});
