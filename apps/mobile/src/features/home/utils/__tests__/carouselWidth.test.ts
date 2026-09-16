/**
 * The carousel card width.
 *
 * Two things can go wrong here and neither throws:
 *
 * 1. A card wider than the screen. The old hardcoded 320px did exactly that on
 *    a 320dp phone - the list simply had no peek and stopped reading as
 *    scrollable, silently, on the smallest devices.
 * 2. `snapInterval` disagreeing with the rendered width. The drift compounds
 *    down the list, so the first card looks fine and the fifth snaps visibly
 *    off-centre - which is why it is nearly always reported as "sometimes".
 */

import { DEAL_CARD_RATIO, HERO_CARD_RATIO, getCarouselWidth } from '../carouselWidth';

/** Real device widths, smallest first. 360 is the common Android case. */
const SCREENS = [320, 360, 390, 412, 430, 480];
const GAP = 12;

const at = (screenWidth: number, ratio = DEAL_CARD_RATIO) =>
  getCarouselWidth({ screenWidth, ratio, gap: GAP });

describe('the card always leaves a peek', () => {
  it.each(SCREENS)('%ipx: the card is narrower than the screen', screenWidth => {
    // The regression this replaced: a fixed 320px card on a 320dp phone.
    expect(at(screenWidth).cardWidth).toBeLessThan(screenWidth);
  });

  it.each(SCREENS)('%ipx: at least 10%% of the next card shows', screenWidth => {
    const { snapInterval } = at(screenWidth);
    const peek = (screenWidth - snapInterval) / screenWidth;
    expect(peek).toBeGreaterThanOrEqual(0.1);
  });

  it('gives the same proportion on every screen', () => {
    // The whole point: the look no longer depends on the device it was tuned on.
    const ratios = SCREENS.map(w => at(w).cardWidth / w);
    for (const r of ratios) {
      expect(r).toBeCloseTo(DEAL_CARD_RATIO, 2);
    }
  });
});

describe('snapInterval cannot drift from the card', () => {
  it.each(SCREENS)('%ipx: interval is exactly card + gap', screenWidth => {
    const { cardWidth, snapInterval } = at(screenWidth);
    expect(snapInterval).toBe(cardWidth + GAP);
  });

  it('stays aligned after ten cards', () => {
    // getItemLayout multiplies the interval by the index, so any mismatch
    // accumulates. Ten cards is past where a user would notice.
    const { cardWidth, snapInterval } = at(390);
    const tenthOffset = snapInterval * 10;
    expect(tenthOffset).toBe((cardWidth + GAP) * 10);
  });

  it('returns whole pixels', () => {
    // Fractional widths round inconsistently between the card and the interval
    // in React Native, which is one way the drift above gets reintroduced.
    for (const w of SCREENS) {
      expect(Number.isInteger(at(w).cardWidth)).toBe(true);
      expect(Number.isInteger(at(w).snapInterval)).toBe(true);
    }
  });
});

describe('the two ratios stay distinct', () => {
  it('gives hero banners more width than deal cards', () => {
    // Banners carry an amount, a progress bar and two lines; deals carry a
    // photo and a short title. Collapsing them to one ratio loses that.
    expect(HERO_CARD_RATIO).toBeGreaterThan(DEAL_CARD_RATIO);
  });

  it.each(SCREENS)('%ipx: a hero card is wider than a deal card', screenWidth => {
    expect(at(screenWidth, HERO_CARD_RATIO).cardWidth).toBeGreaterThan(
      at(screenWidth, DEAL_CARD_RATIO).cardWidth,
    );
  });

  it.each(SCREENS)('%ipx: a hero card still leaves a peek', screenWidth => {
    const { snapInterval } = at(screenWidth, HERO_CARD_RATIO);
    expect((screenWidth - snapInterval) / screenWidth).toBeGreaterThanOrEqual(0.1);
  });
});

describe('degenerate input cannot produce an unusable carousel', () => {
  it.each([
    ['zero', 0],
    ['negative', -390],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('%s screen width falls back rather than collapsing', (_label, screenWidth) => {
    const { cardWidth, snapInterval } = at(screenWidth as number);
    expect(cardWidth).toBeGreaterThan(0);
    expect(snapInterval).toBe(cardWidth + GAP);
  });

  // Two different behaviours, deliberately:
  //  - a ratio that is not a usable number at all falls back to the DEFAULT, not
  //    to the edge of the band. A caller passing 0 has a bug, and 0.72 is a far
  //    better recovery than the narrowest card the band allows.
  //  - a real number outside the band is clamped, because that is a value
  //    someone chose and got wrong by degree rather than by kind.
  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('%s ratio falls back to the default', (_label, ratio) => {
    const { cardWidth } = getCarouselWidth({ screenWidth: 390, ratio: ratio as number, gap: GAP });
    expect(cardWidth / 390).toBeCloseTo(DEAL_CARD_RATIO, 2);
  });

  it.each([
    ['far too wide', 5, 0.9],
    ['just over the band', 0.95, 0.9],
    ['just under the band', 0.4, 0.6],
  ])('%s ratio is clamped into the usable band', (_label, ratio, expected) => {
    // Below 0.6 the peek swallows the card; above 0.9 it stops reading as
    // one-at-a-time and the row looks like a static banner.
    const { cardWidth } = getCarouselWidth({ screenWidth: 390, ratio: ratio as number, gap: GAP });
    expect(cardWidth / 390).toBeCloseTo(expected as number, 2);
  });

  it.each([
    ['negative', -8],
    ['NaN', Number.NaN],
  ])('%s gap is treated as no gap', (_label, gap) => {
    const { cardWidth, snapInterval } = getCarouselWidth({
      screenWidth: 390,
      ratio: DEAL_CARD_RATIO,
      gap: gap as number,
    });
    expect(snapInterval).toBe(cardWidth);
  });
});
