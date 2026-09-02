/**
 * E25 regression gate: SUCCESS_TEXT must pass AA on every surface it sits on.
 *
 * OrderSuccessModal and CheckoutScreen both render success-tinted banners with
 * a text colour that was #059669 at 3.60 on #F0FDF4, failing WCAG 2.1 AA.
 * Fixed to success[600] (#1B5E20). This test locks that fix.
 */

import { colorTokens } from '../colors';

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a: string, b: string): number => {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
};

const AA_TEXT = 4.5;

const SUCCESS_TEXT = colorTokens.base.success[600];
const SUCCESS_SURFACE = '#F0FDF4';
const SUCCESS_TINT = '#D1FAE5';

describe('E25: success text on success surfaces', () => {
  it('passes AA on SUCCESS_SURFACE (#F0FDF4)', () => {
    const ratio = contrastRatio(SUCCESS_TEXT, SUCCESS_SURFACE);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('passes AA on SUCCESS_TINT (#D1FAE5)', () => {
    const ratio = contrastRatio(SUCCESS_TEXT, SUCCESS_TINT);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('would fail with the old value (#059669)', () => {
    const OLD_VALUE = '#059669';
    expect(contrastRatio(OLD_VALUE, SUCCESS_SURFACE)).toBeLessThan(AA_TEXT);
    expect(contrastRatio(OLD_VALUE, SUCCESS_TINT)).toBeLessThan(AA_TEXT);
  });
});
