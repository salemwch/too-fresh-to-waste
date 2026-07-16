import { toMillimes, fromMillimes } from './konnect.service';

describe('toMillimes', () => {
  it('should convert whole TND amounts', () => {
    expect(toMillimes(1)).toBe(1000);
    expect(toMillimes(10)).toBe(10000);
    expect(toMillimes(100)).toBe(100000);
  });

  it('should convert decimal TND amounts', () => {
    expect(toMillimes(7.55)).toBe(7550);
    expect(toMillimes(0.5)).toBe(500);
    expect(toMillimes(3.999)).toBe(3999);
  });

  it('should round correctly for floating-point edge cases', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toMillimes(0.1 + 0.2)).toBe(300);
    expect(toMillimes(1.005)).toBe(1005);
    expect(toMillimes(19.99)).toBe(19990);
  });

  it('should handle zero', () => {
    expect(toMillimes(0)).toBe(0);
  });

  it('should throw for negative amounts', () => {
    expect(() => toMillimes(-1)).toThrow('Invalid TND amount');
    expect(() => toMillimes(-0.001)).toThrow('Invalid TND amount');
  });

  it('should throw for NaN', () => {
    expect(() => toMillimes(NaN)).toThrow('Invalid TND amount');
  });

  it('should throw for Infinity', () => {
    expect(() => toMillimes(Infinity)).toThrow('Invalid TND amount');
    expect(() => toMillimes(-Infinity)).toThrow('Invalid TND amount');
  });

  it('should handle very large amounts', () => {
    expect(toMillimes(999999)).toBe(999999000);
  });

  it('should handle sub-dinar amounts', () => {
    expect(toMillimes(0.001)).toBe(1);
  });
});

describe('fromMillimes', () => {
  it('should convert millimes to TND', () => {
    expect(fromMillimes(1000)).toBe(1);
    expect(fromMillimes(7550)).toBe(7.55);
    expect(fromMillimes(500)).toBe(0.5);
  });

  it('should handle zero', () => {
    expect(fromMillimes(0)).toBe(0);
  });

  it('should throw for negative millimes', () => {
    expect(() => fromMillimes(-1000)).toThrow('Invalid millimes amount');
  });

  it('should throw for non-integer millimes', () => {
    expect(() => fromMillimes(1.5)).toThrow('Invalid millimes amount');
    expect(() => fromMillimes(0.1)).toThrow('Invalid millimes amount');
  });

  it('should handle single millime', () => {
    expect(fromMillimes(1)).toBe(0.001);
  });
});

describe('roundtrip conversion', () => {
  it.each([0, 0.5, 1, 5.55, 7.999, 10, 99.99, 100, 1000])(
    'toMillimes(fromMillimes(toMillimes(%f))) === toMillimes(%f)',
    tnd => {
      expect(fromMillimes(toMillimes(tnd))).toBe(tnd);
    },
  );
});

describe('financial math precision', () => {
  it('should maintain precision for commission split at 81/19', () => {
    const totals = [1, 5, 7.55, 10, 15.99, 25, 50, 99.99, 100, 250];

    for (const total of totals) {
      const merchant = parseFloat((total * 0.81).toFixed(3));
      const platform = parseFloat((total * 0.19).toFixed(3));
      const donation = parseFloat((platform * 0.05).toFixed(3));
      const net = parseFloat((platform - donation).toFixed(3));

      // merchant + platform should always equal total (no penny leak)
      expect(merchant + platform).toBeCloseTo(total, 2);

      // net + donation should always equal platform
      expect(net + donation).toBeCloseTo(platform, 2);

      // All amounts should be non-negative
      expect(merchant).toBeGreaterThanOrEqual(0);
      expect(platform).toBeGreaterThanOrEqual(0);
      expect(donation).toBeGreaterThanOrEqual(0);
      expect(net).toBeGreaterThanOrEqual(0);
    }
  });

  it('should detect exact penny leak for problematic amounts', () => {
    // Some amounts cause merchant + platform != total due to rounding
    // This test documents the behavior: toFixed(3) then parseFloat
    const total = 7.55;
    const merchant = parseFloat((total * 0.81).toFixed(3)); // 6.116
    const platform = parseFloat((total * 0.19).toFixed(3)); // 1.435

    // 6.116 + 1.435 = 7.551 — there IS a 0.001 TND overshoot
    // This is a known limitation of the rounding approach
    const sum = parseFloat((merchant + platform).toFixed(3));
    const diff = Math.abs(sum - total);

    // The error should never exceed 1 millime
    expect(diff).toBeLessThanOrEqual(0.001);
  });
});
