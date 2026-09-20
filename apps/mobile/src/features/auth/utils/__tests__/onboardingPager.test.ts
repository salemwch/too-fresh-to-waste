/**
 * Pager geometry, in both reading directions.
 *
 * The round-trip block is the important one: four call sites convert between
 * offsets and page numbers, and a disagreement between any two of them is a
 * pager that reports the wrong page to the dots, or scrolls to the wrong place
 * when an arrow is tapped.
 */

import {
  clampPageIndex,
  offsetForPage,
  pageIndexFromOffset,
  ONBOARDING_PAGE_COUNT,
} from '../onboardingPager';

const WIDTH = 390;
const COUNT = ONBOARDING_PAGE_COUNT;

describe('pageIndexFromOffset', () => {
  describe('left-to-right', () => {
    it.each([
      ['the first page', 0, 0],
      ['the second page', WIDTH, 1],
      ['the third page', WIDTH * 2, 2],
    ])('reports %s', (_label, offset, expected) => {
      expect(pageIndexFromOffset(offset, WIDTH, COUNT, false)).toBe(expected);
    });

    it('rounds to the nearest page mid-drag', () => {
      // Just past halfway between pages 0 and 1.
      expect(pageIndexFromOffset(WIDTH * 0.51, WIDTH, COUNT, false)).toBe(1);
      // Just short of it.
      expect(pageIndexFromOffset(WIDTH * 0.49, WIDTH, COUNT, false)).toBe(0);
    });
  });

  describe('right-to-left mirrors it', () => {
    it.each([
      ['the last page', 0, 2],
      ['the middle page', WIDTH, 1],
      ['the first page', WIDTH * 2, 0],
    ])('offset at the start is %s', (_label, offset, expected) => {
      expect(pageIndexFromOffset(offset, WIDTH, COUNT, true)).toBe(expected);
    });
  });

  describe('offsets that no page produced', () => {
    it('clamps the overscroll bounce at both ends', () => {
      // Android reports negative offsets while the list rubber-bands.
      expect(pageIndexFromOffset(-120, WIDTH, COUNT, false)).toBe(0);
      expect(pageIndexFromOffset(WIDTH * 5, WIDTH, COUNT, false)).toBe(COUNT - 1);
      expect(pageIndexFromOffset(-120, WIDTH, COUNT, true)).toBe(COUNT - 1);
      expect(pageIndexFromOffset(WIDTH * 5, WIDTH, COUNT, true)).toBe(0);
    });

    it('returns the first page rather than NaN for a zero width', () => {
      // useWindowDimensions can report 0 on the first frame; 0 / 0 is NaN, and
      // NaN passes straight through Math.round into the dots.
      expect(pageIndexFromOffset(0, 0, COUNT, false)).toBe(0);
      expect(pageIndexFromOffset(200, 0, COUNT, false)).toBe(0);
      expect(pageIndexFromOffset(NaN, WIDTH, COUNT, false)).toBe(0);
      expect(pageIndexFromOffset(0, NaN, COUNT, false)).toBe(0);
    });
  });
});

describe('offsetForPage', () => {
  it.each([
    [0, 0],
    [1, WIDTH],
    [2, WIDTH * 2],
  ])('page %d scrolls to %d in LTR', (index, expected) => {
    expect(offsetForPage(index, WIDTH, COUNT, false)).toBe(expected);
  });

  it.each([
    [0, WIDTH * 2],
    [1, WIDTH],
    [2, 0],
  ])('page %d scrolls to %d in RTL', (index, expected) => {
    expect(offsetForPage(index, WIDTH, COUNT, true)).toBe(expected);
  });

  it('clamps a page number outside the flow instead of scrolling into nothing', () => {
    expect(offsetForPage(-1, WIDTH, COUNT, false)).toBe(0);
    expect(offsetForPage(99, WIDTH, COUNT, false)).toBe(WIDTH * 2);
  });

  it('returns 0 for a zero or unusable width', () => {
    expect(offsetForPage(2, 0, COUNT, false)).toBe(0);
    expect(offsetForPage(2, NaN, COUNT, false)).toBe(0);
  });
});

describe('the two are exact inverses', () => {
  // This is the property the pager actually depends on. If it ever fails, the
  // dots and the arrows are reading different page numbers.
  it.each([0, 1, 2])('round-trips page %d in LTR', index => {
    const offset = offsetForPage(index, WIDTH, COUNT, false);
    expect(pageIndexFromOffset(offset, WIDTH, COUNT, false)).toBe(index);
  });

  it.each([0, 1, 2])('round-trips page %d in RTL', index => {
    const offset = offsetForPage(index, WIDTH, COUNT, true);
    expect(pageIndexFromOffset(offset, WIDTH, COUNT, true)).toBe(index);
  });

  it('round-trips at widths other than the design width', () => {
    for (const width of [320, 411, 430, 768]) {
      for (let index = 0; index < COUNT; index++) {
        const offset = offsetForPage(index, width, COUNT, false);
        expect(pageIndexFromOffset(offset, width, COUNT, false)).toBe(index);
      }
    }
  });
});

describe('clampPageIndex', () => {
  it('keeps a valid page untouched', () => {
    expect(clampPageIndex(1, COUNT)).toBe(1);
  });

  it('pulls out-of-range pages back to the ends', () => {
    expect(clampPageIndex(-5, COUNT)).toBe(0);
    expect(clampPageIndex(5, COUNT)).toBe(COUNT - 1);
  });

  it('returns the first page for NaN or Infinity', () => {
    expect(clampPageIndex(NaN, COUNT)).toBe(0);
    expect(clampPageIndex(Infinity, COUNT)).toBe(0);
  });

  it('returns the first page when there are no pages', () => {
    // Unreachable while ONBOARDING_PAGE_COUNT is a constant, but the guard is
    // what stops a count of 0 producing -1 and an out-of-bounds page.
    expect(clampPageIndex(2, 0)).toBe(0);
  });
});
