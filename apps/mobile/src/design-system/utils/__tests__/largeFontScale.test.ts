import { shouldStackAtFontScale, LARGE_FONT_SCALE_THRESHOLD } from '../largeFontScale';

describe('shouldStackAtFontScale', () => {
  describe('normal scales keep the horizontal layout', () => {
    // These are the scales where the rows were measured to still fit. If any of
    // them starts stacking, ordinary users get a layout change they never asked
    // for, which is a regression in the opposite direction.
    it.each([0.85, 1.0, 1.15, 1.3, 1.45])('does not stack at %sx', scale => {
      expect(shouldStackAtFontScale(scale)).toBe(false);
    });
  });

  describe('large scales reflow', () => {
    // 1.5x is where the driver header stopped fitting on a 720x1280 / 240dpi
    // screen; 2.0x is where the status badge was clipped off the card.
    it.each([1.5, 1.6, 1.75, 2.0, 3.0])('stacks at %sx', scale => {
      expect(shouldStackAtFontScale(scale)).toBe(true);
    });
  });

  describe('the threshold boundary', () => {
    it('stacks exactly at the threshold', () => {
      expect(shouldStackAtFontScale(LARGE_FONT_SCALE_THRESHOLD)).toBe(true);
    });

    it('does not stack just below it', () => {
      expect(shouldStackAtFontScale(LARGE_FONT_SCALE_THRESHOLD - 0.01)).toBe(false);
    });

    it('is monotonic - once it stacks it never unstacks', () => {
      const scales = [0.85, 1.0, 1.3, 1.5, 2.0, 3.0];
      const results = scales.map(shouldStackAtFontScale);
      const firstTrue = results.indexOf(true);
      expect(firstTrue).toBeGreaterThan(0); // non-vacuous: some are false
      expect(results.slice(firstTrue).every(Boolean)).toBe(true);
    });
  });

  describe('degenerate platform values', () => {
    // PixelRatio.getFontScale() is a native bridge read. A NaN here must not
    // latch every header in the app into the stacked layout.
    it.each([NaN, 0, -1, -2.5, Infinity])('treats %s as a normal scale', scale => {
      expect(shouldStackAtFontScale(scale)).toBe(false);
    });
  });
});
