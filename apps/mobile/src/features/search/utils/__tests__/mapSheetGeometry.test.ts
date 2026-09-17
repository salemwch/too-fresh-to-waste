import { getMapSheetGeometry, MAP_SHEET_RATIO } from '../mapSheetGeometry';

/**
 * The regression these guard: the sheet used to be a flat fraction of the
 * screen with the floating tab bar drawn over its lower third, so the readable
 * area was the ratio MINUS the bar. Every case below asserts that the readable
 * area is the ratio, whatever the inset turns out to be.
 */
describe('getMapSheetGeometry', () => {
  const readable = (screenHeight: number, tabBarInset: number): number =>
    getMapSheetGeometry({ screenHeight, tabBarInset }).sheetHeight - tabBarInset;

  it('gives the sheet the ratio ON TOP OF the height the tab bar covers', () => {
    const { sheetHeight } = getMapSheetGeometry({ screenHeight: 800, tabBarInset: 110 });

    expect(sheetHeight).toBe(Math.round(800 * MAP_SHEET_RATIO) + 110);
  });

  it('keeps the readable area constant as the safe-area inset grows', () => {
    // A gesture-nav phone, a button-nav phone and a notchless one differ only
    // in inset. The user must see the same amount of sheet on all three.
    expect(readable(800, 0)).toBe(readable(800, 96));
    expect(readable(800, 96)).toBe(readable(800, 134));
  });

  it('passes the inset back as the padding the offer list must add', () => {
    expect(getMapSheetGeometry({ screenHeight: 800, tabBarInset: 110 }).listPaddingBottom).toBe(
      110,
    );
  });

  it('treats a zero inset as legitimate rather than missing', () => {
    // A screen rendered outside the tab navigator has no bar at all.
    const { sheetHeight, listPaddingBottom } = getMapSheetGeometry({
      screenHeight: 800,
      tabBarInset: 0,
    });

    expect(sheetHeight).toBe(Math.round(800 * MAP_SHEET_RATIO));
    expect(listPaddingBottom).toBe(0);
  });

  it('caps the sheet so the map behind it never disappears entirely', () => {
    // Short screen, tall bar: ratio + inset would be 0.52 * 560 + 200 = 491,
    // i.e. 88% of the screen. Clamped to 80%.
    const { sheetHeight } = getMapSheetGeometry({ screenHeight: 560, tabBarInset: 200 });

    expect(sheetHeight).toBe(Math.round(560 * 0.8));
    expect(sheetHeight).toBeLessThan(Math.round(560 * MAP_SHEET_RATIO) + 200);
  });

  it('returns whole pixels, so the slide animation cannot leave a hairline', () => {
    const { sheetHeight } = getMapSheetGeometry({ screenHeight: 731, tabBarInset: 97 });

    expect(Number.isInteger(sheetHeight)).toBe(true);
  });

  describe.each([
    ['zero height', 0],
    ['negative height', -100],
    ['NaN height', Number.NaN],
    ['Infinity height', Number.POSITIVE_INFINITY],
  ])('%s falls back instead of collapsing the sheet', (_label, screenHeight) => {
    it('uses the 800dp fallback screen', () => {
      expect(getMapSheetGeometry({ screenHeight, tabBarInset: 0 }).sheetHeight).toBe(
        Math.round(800 * MAP_SHEET_RATIO),
      );
    });
  });

  describe.each([
    ['negative inset', -50],
    ['NaN inset', Number.NaN],
    ['Infinity inset', Number.POSITIVE_INFINITY],
  ])('%s is treated as no inset', (_label, tabBarInset) => {
    it('never shrinks the sheet below the ratio', () => {
      const { sheetHeight, listPaddingBottom } = getMapSheetGeometry({
        screenHeight: 800,
        tabBarInset,
      });

      expect(sheetHeight).toBe(Math.round(800 * MAP_SHEET_RATIO));
      expect(listPaddingBottom).toBe(0);
    });
  });
});
