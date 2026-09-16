/**
 * The tab bar paints its circles from `circleCentres` and positions its touch
 * targets from the same array. If the two ever disagree the user taps one tab
 * and activates its neighbour - which renders perfectly and is wrong anyway.
 *
 * These tests pin the two measured ratios that ARE the design, and the RTL
 * mapping, which is the only place the painted shape and the hit areas can
 * drift apart.
 */

import { I18nManager } from 'react-native';

import {
  BAND_RATIO,
  TAB_BAND_HEIGHT,
  TAB_BAR_LIFT,
  TAB_BAR_TOP_PAD,
  TAB_CANVAS_PAD,
  TAB_CIRCLE_SIZE,
  TAB_OVERLAP,
  getFloatingTabBarLayout,
  visualTabIndex,
} from '../floatingTabBarLayout';

const layout = (tabCount = 5, bottomInset = 0) =>
  getFloatingTabBarLayout({ tabCount, bottomInset });

describe('the measured ratios', () => {
  it('keeps the circle taller than the band', () => {
    // The whole design. The first attempt inverted this - a band taller than
    // the circles - and looked nothing like the reference.
    expect(TAB_CIRCLE_SIZE).toBeGreaterThan(TAB_BAND_HEIGHT);
  });

  it('holds circle / band at the measured 1.306', () => {
    expect(TAB_CIRCLE_SIZE / TAB_BAND_HEIGHT).toBeCloseTo(BAND_RATIO, 3);
  });

  it('spaces circles at the nearest whole pixel to the measured 0.894', () => {
    // The ratio wants 54 x 0.894 = 48.28, i.e. an overlap of 5.72. TAB_OVERLAP
    // is the integer 6, so the real ratio is 0.889 - deliberately rounded, not
    // drifted. Asserting 0.894 exactly would fail, and loosening the precision
    // until it passed would hide how much rounding is actually being absorbed.
    const { circleCentres } = layout();
    const spacing = (circleCentres[1] ?? 0) - (circleCentres[0] ?? 0);
    const ideal = TAB_CIRCLE_SIZE * 0.894;
    expect(Math.abs(spacing - ideal)).toBeLessThanOrEqual(0.5);
  });

  it('derives the band rather than hard-coding it', () => {
    // Guards the reason BAND_RATIO exists: change the circle and the band must
    // follow. A typed constant would silently drift on the next resize.
    expect(TAB_BAND_HEIGHT).toBeCloseTo(TAB_CIRCLE_SIZE / BAND_RATIO, 5);
  });

  it('overlaps adjacent circles rather than spacing them apart', () => {
    const { circleCentres } = layout();
    const spacing = (circleCentres[1] ?? 0) - (circleCentres[0] ?? 0);
    // Centres closer together than one diameter means the discs intersect,
    // which is what fuses them into one silhouette.
    expect(spacing).toBeLessThan(TAB_CIRCLE_SIZE);
    expect(TAB_CIRCLE_SIZE - spacing).toBe(TAB_OVERLAP);
  });
});

describe('shape geometry', () => {
  it('produces one centre per tab', () => {
    expect(layout(5).circleCentres).toHaveLength(5);
    expect(layout(3).circleCentres).toHaveLength(3);
  });

  it('spaces every pair identically', () => {
    const { circleCentres } = layout(5);
    const gaps = circleCentres.slice(1).map((c, i) => c - (circleCentres[i] ?? 0));
    expect(new Set(gaps).size).toBe(1);
  });

  it('starts and ends exactly one radius inside the shape', () => {
    const { circleCentres, shapeWidth } = layout(5);
    expect(circleCentres[0]).toBe(TAB_CIRCLE_SIZE / 2);
    expect(circleCentres[4]).toBe(shapeWidth - TAB_CIRCLE_SIZE / 2);
  });

  it('widens by one step per extra tab', () => {
    const step = TAB_CIRCLE_SIZE - TAB_OVERLAP;
    expect(layout(5).shapeWidth - layout(4).shapeWidth).toBe(step);
  });

  it('is exactly one circle wide with a single tab', () => {
    const one = layout(1);
    expect(one.shapeWidth).toBe(TAB_CIRCLE_SIZE);
    expect(one.circleCentres).toEqual([TAB_CIRCLE_SIZE / 2]);
  });

  it('bleeds the canvas past the shape on every side', () => {
    // The shadow is a Gaussian blur, and a blur spreads beyond its source. A
    // canvas sized exactly to the shape crops the soft edge square - which is
    // the hard rectangle the blur exists to avoid. Guards both axes: an earlier
    // version padded height only and clipped the blur at the left and right
    // ends of the bar.
    const { canvasWidth, canvasHeight, shapeWidth } = layout();
    expect(canvasWidth - shapeWidth).toBe(TAB_CANVAS_PAD * 2);
    expect(canvasHeight - TAB_CIRCLE_SIZE).toBe(TAB_CANVAS_PAD * 2);
  });

  it('bleeds by more than the shadow reaches', () => {
    // dy + stdDeviation is roughly how far the blur travels; the pad must
    // exceed it or the crop reappears at a different size.
    expect(TAB_CANVAS_PAD).toBeGreaterThan(5 + 5);
  });
});

describe('flow height', () => {
  it('reserves the circle plus its padding', () => {
    expect(layout(5, 0).containerHeight).toBe(TAB_BAR_TOP_PAD + TAB_CIRCLE_SIZE + TAB_BAR_LIFT);
  });

  it('grows by the safe-area inset', () => {
    expect(layout(5, 34).containerHeight - layout(5, 0).containerHeight).toBe(34);
  });

  it('does not change with the number of tabs', () => {
    expect(layout(3, 0).containerHeight).toBe(layout(5, 0).containerHeight);
  });
});

describe('degenerate input cannot produce an invisible bar', () => {
  // A negative width renders as nothing at all in react-native-svg - a tab bar
  // that is silently absent rather than visibly broken.
  it.each([
    ['zero', 0],
    ['negative', -3],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('clamps a %s tab count to a drawable shape', (_label, count) => {
    const { shapeWidth, circleCentres } = layout(count as number);
    expect(shapeWidth).toBeGreaterThan(0);
    expect(circleCentres.length).toBeGreaterThan(0);
  });

  it('floors a fractional tab count', () => {
    expect(layout(3.7).circleCentres).toHaveLength(3);
  });

  it.each([
    ['negative', -20],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('ignores a %s bottom inset rather than shrinking the bar', (_label, inset) => {
    expect(layout(5, inset as number).containerHeight).toBe(layout(5, 0).containerHeight);
  });
});

describe('RTL mapping', () => {
  const withRTL = (isRTL: boolean, run: () => void) => {
    const previous = I18nManager.isRTL;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (I18nManager as any).isRTL = isRTL;
    try {
      run();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (I18nManager as any).isRTL = previous;
    }
  };

  it('is identity in LTR', () => {
    withRTL(false, () => {
      expect([0, 1, 2, 3, 4].map(i => visualTabIndex(i, 5))).toEqual([0, 1, 2, 3, 4]);
    });
  });

  it('reverses in RTL', () => {
    withRTL(true, () => {
      expect([0, 1, 2, 3, 4].map(i => visualTabIndex(i, 5))).toEqual([4, 3, 2, 1, 0]);
    });
  });

  it('is its own inverse in RTL', () => {
    // Guards against a mapping that flips the painted circle but not the hit
    // area, which is how a tab activates its neighbour.
    withRTL(true, () => {
      for (let i = 0; i < 5; i++) {
        expect(visualTabIndex(visualTabIndex(i, 5), 5)).toBe(i);
      }
    });
  });

  it('never maps outside the circle array in either direction', () => {
    for (const rtl of [false, true]) {
      withRTL(rtl, () => {
        const { circleCentres } = layout(5);
        for (const i of [-4, 0, 2, 4, 99]) {
          const mapped = visualTabIndex(i, 5);
          expect(circleCentres[mapped]).toBeDefined();
        }
      });
    }
  });

  it('clamps an out-of-range index to an end tab', () => {
    withRTL(false, () => {
      expect(visualTabIndex(-1, 5)).toBe(0);
      expect(visualTabIndex(99, 5)).toBe(4);
    });
  });
});
