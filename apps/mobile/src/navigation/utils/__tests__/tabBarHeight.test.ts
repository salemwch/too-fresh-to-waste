import { getTabBarHeight, TAB_ICON_HEIGHT, LABEL_LINE_RATIO } from '../tabBarHeight';

// The rendered tabBarLabelStyle.fontSize (typography.fontSize.xs).
const LABEL = 10;

const android = (fontScale: number, bottomInset = 0) =>
  getTabBarHeight({ fontScale, bottomInset, labelFontSize: LABEL, platform: 'android' });

const ios = (fontScale: number) =>
  getTabBarHeight({ fontScale, bottomInset: 34, labelFontSize: LABEL, platform: 'ios' });

describe('getTabBarHeight', () => {
  describe('normal font scales stay pixel-identical to the previous fixed bar', () => {
    // The bar was a flat 56 + inset on Android and 88 on iOS before this
    // existed. Nothing below the point where text starts clipping may move,
    // or the fix becomes a visual regression on every ordinary device.
    it.each([0.85, 1.0])('android is 56 + inset at %sx', scale => {
      expect(android(scale)).toBe(56);
      expect(android(scale, 24)).toBe(80);
    });

    it.each([0.85, 1.0, 1.3, 1.5, 2.0])('ios is 88 at %sx', scale => {
      expect(ios(scale)).toBe(88);
    });
  });

  describe('large font scales grow the bar instead of clipping the label', () => {
    it('grows on android once the content exceeds the 56dp base', () => {
      // 28 icon + ceil(10 * scale * 1.2) + 12 padding
      expect(android(2.0)).toBe(64); // 28 + 24 + 12
      expect(android(1.5)).toBe(58); // 28 + 18 + 12
      expect(android(1.3)).toBe(56); // 28 + 16 + 12, still at the base
    });

    it('is monotonically non-decreasing across the full accessibility range', () => {
      const scales = [0.85, 1.0, 1.15, 1.3, 1.5, 1.8, 2.0, 3.0];
      const heights = scales.map(s => android(s));
      const sorted = [...heights].sort((a, b) => a - b);
      expect(heights).toEqual(sorted);
      // Non-vacuous: the range must actually span more than one value.
      expect(new Set(heights).size).toBeGreaterThan(1);
    });

    it('always leaves room for the icon, the scaled label and the padding', () => {
      for (const scale of [1.0, 1.3, 1.5, 2.0, 3.0]) {
        const required = TAB_ICON_HEIGHT + Math.ceil(LABEL * scale * LABEL_LINE_RATIO) + 12;
        expect(android(scale)).toBeGreaterThanOrEqual(required);
      }
    });
  });

  describe('each tab button clears the 44dp touch minimum (M13)', () => {
    // react-navigation sizes each tab button as the bar height minus the bar's
    // vertical padding. Measured on device at 8+8 padding it was 40dp, under
    // the 44dp minimum, which is why the padding is 6+6.
    const ANDROID_V_PADDING = 12;

    it.each([1.0, 1.3, 1.5, 2.0])('button is at least 44dp at %sx', scale => {
      const buttonHeight = android(scale) - ANDROID_V_PADDING;
      expect(buttonHeight).toBeGreaterThanOrEqual(44);
    });

    it('is exactly 44dp at 1.0x, so no vertical space is wasted', () => {
      expect(android(1.0) - ANDROID_V_PADDING).toBe(44);
    });
  });

  describe('the bottom inset is added on android and never on ios', () => {
    it('adds the android navigation bar inset on top of the content height', () => {
      expect(android(2.0, 48)).toBe(64 + 48);
    });

    it('ignores the inset on ios, whose base already covers the home indicator', () => {
      expect(
        getTabBarHeight({ fontScale: 1, bottomInset: 0, labelFontSize: LABEL, platform: 'ios' }),
      ).toBe(88);
      expect(ios(1)).toBe(88);
    });

    it('ignores a negative inset rather than shrinking the bar', () => {
      expect(android(1.0, -20)).toBe(56);
    });
  });

  describe('degenerate platform values fall back rather than collapsing the bar', () => {
    // PixelRatio.getFontScale() is a native bridge read; a NaN here would
    // otherwise propagate into height and collapse the tab bar to nothing.
    it.each([NaN, 0, -1, Infinity])('treats a %s font scale as 1.0x', scale => {
      expect(android(scale)).toBe(56);
    });

    it.each([NaN, Infinity])('treats a %s inset as 0', inset => {
      expect(android(1.0, inset)).toBe(56);
    });
  });

  describe('a larger label font is accounted for', () => {
    it('grows when the label font size grows, not only when the scale does', () => {
      const small = getTabBarHeight({
        fontScale: 1,
        bottomInset: 0,
        labelFontSize: 10,
        platform: 'android',
      });
      const large = getTabBarHeight({
        fontScale: 1,
        bottomInset: 0,
        labelFontSize: 20,
        platform: 'android',
      });
      expect(large).toBeGreaterThan(small);
    });
  });
});
