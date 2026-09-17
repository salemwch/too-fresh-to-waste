/**
 * `readingGradient` - the ramp has to follow the text, and follow it across a
 * direction change that happens without a fresh JS context.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every gradient in the app was written `start={{x:0,y:0}} end={{x:1,y:1}}`,
 * a fixed left-to-right ramp. Layout mirrors under RTL and the ramp did not,
 * so in Arabic the copy moved to the other end of it while the pixels stayed
 * put. Measured on the Profile screen, white heading over the loyalty card:
 *
 *     English  on #025755  ->  8.41:1   passes AA
 *     Arabic   on #2ab297  ->  2.65:1   fails AA outright
 *
 * Nothing in the code changed between those two, which is exactly why it was
 * reported as "switching language changed the colours".
 */

import { resetAppDirectionForTests, setAppDirection } from '@/i18n/direction';

import { readingGradient, textAlignEnd, textAlignStart } from '../rtl';

beforeEach(() => {
  resetAppDirectionForTests();
});

describe('readingGradient', () => {
  it('runs left to right in LTR', () => {
    setAppDirection('ltr');

    expect(readingGradient(0, 1)).toEqual({ start: { x: 0, y: 0 }, end: { x: 1, y: 1 } });
  });

  it('runs right to left in RTL, so the first colour stays under the text', () => {
    setAppDirection('rtl');

    expect(readingGradient(0, 1)).toEqual({ start: { x: 1, y: 0 }, end: { x: 0, y: 1 } });
  });

  it.each([
    ['flat horizontal', 0, 0],
    ['centre horizontal', 0.5, 0.5],
    ['diagonal', 0, 1],
  ])('keeps the vertical shape of a %s ramp while mirroring x', (_label, y0, y1) => {
    setAppDirection('rtl');
    const rtl = readingGradient(y0, y1);

    expect(rtl.start.y).toBe(y0);
    expect(rtl.end.y).toBe(y1);
    expect(rtl.start.x).toBe(1);
    expect(rtl.end.x).toBe(0);
  });

  it('returns one stable object per direction, so the native ramp is not re-uploaded', () => {
    // `.claude/rules/performance.md` #1: LinearGradient compares start/end by
    // identity, so a fresh literal every render re-uploads the gradient.
    setAppDirection('ltr');

    expect(readingGradient(0, 1)).toBe(readingGradient(0, 1));
  });

  it('gives different (y0, y1) pairs different objects', () => {
    setAppDirection('ltr');

    expect(readingGradient(0, 1)).not.toBe(readingGradient(0, 0));
  });

  it('is frozen, so a call site cannot mutate the shared object', () => {
    setAppDirection('ltr');
    const shared = readingGradient(0, 1);

    expect(Object.isFrozen(shared)).toBe(true);
    expect(Object.isFrozen(shared.start)).toBe(true);
  });

  it('follows a direction change inside one JS context', () => {
    /*
     * THE REGRESSION. The cache was keyed on `(y0, y1)` alone, on the reasoning
     * that direction cannot change without an app restart. It can: `RNRestart`
     * falls back to `Activity.recreate()` under the new architecture, which
     * rebuilds the native side - so the layout mirrors - while the JS context,
     * and this cache with it, survives. Every gradient then kept the ramp it
     * was first rendered with, for the rest of the session.
     */
    setAppDirection('ltr');
    const before = readingGradient(0, 1);

    setAppDirection('rtl');
    const after = readingGradient(0, 1);

    expect(before.start.x).toBe(0);
    expect(after.start.x).toBe(1);
    expect(after).not.toBe(before);
  });

  it('returns to the original object when the direction changes back', () => {
    setAppDirection('ltr');
    const ltr = readingGradient(0, 1);
    setAppDirection('rtl');
    readingGradient(0, 1);
    setAppDirection('ltr');

    expect(readingGradient(0, 1)).toBe(ltr);
  });
});

describe('textAlign helpers follow the same direction source', () => {
  /*
   * Grouped here rather than in their own file because they failed for exactly
   * the same reason: they read the platform flag, which goes stale after an
   * in-app language change.
   */
  it.each([
    ['ltr' as const, 'left', 'right'],
    ['rtl' as const, 'right', 'left'],
  ])('resolves start/end for %s', (direction, start, end) => {
    setAppDirection(direction);

    expect(textAlignStart()).toBe(start);
    expect(textAlignEnd()).toBe(end);
  });
});
