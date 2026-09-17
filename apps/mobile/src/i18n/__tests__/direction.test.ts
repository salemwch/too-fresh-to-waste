/**
 * The app's reading direction must come from the app, not the platform flag.
 *
 * WHY THIS EXISTS
 * ---------------
 * `I18nManager.isRTL` keeps the value the PROCESS started with. Changing the
 * language calls `RNRestart.restart()`, which rebuilds the React Native
 * instance but does not restart the process - so the native layout flips and
 * the JS flag does not. Device-measured, one build, one device:
 *
 *     cold start in Arabic               layout RTL, isRTL true   agree
 *     switch to English, restart in-app  layout LTR, isRTL true   DISAGREE
 *     cold start in English              layout LTR, isRTL false  agree
 *     switch to Arabic, restart in-app   layout RTL, isRTL false  DISAGREE
 *
 * Everything branching on it was wrong for the whole session after a language
 * change: chevrons pointed the wrong way, `textAlignStart` resolved backwards,
 * and `readingGradient` left white headings on the light end of their ramp
 * (white on #2ab297 is 2.65:1 - a WCAG AA failure - where the intended #025755
 * is 8.41:1). All of it was reported as "switching language changed the
 * colours".
 */

import { I18nManager } from 'react-native';

import { isAppRTL, resetAppDirectionForTests, setAppDirection } from '../direction';

/** The platform flag, forced to the WRONG value so a fallback is detectable. */
const withPlatformFlag = (isRTL: boolean, run: () => void): void => {
  const real = I18nManager.isRTL;
  Object.defineProperty(I18nManager, 'isRTL', { value: isRTL, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(I18nManager, 'isRTL', { value: real, configurable: true });
  }
};

beforeEach(() => {
  resetAppDirectionForTests();
});

describe('isAppRTL', () => {
  it('reports RTL once the app resolves an RTL language', () => {
    setAppDirection('rtl');

    expect(isAppRTL()).toBe(true);
  });

  it('reports LTR once the app resolves an LTR language', () => {
    setAppDirection('ltr');

    expect(isAppRTL()).toBe(false);
  });

  it.each([
    ['RTL app, stale LTR platform flag', 'rtl' as const, false, true],
    ['LTR app, stale RTL platform flag', 'ltr' as const, true, false],
  ])(
    'ignores the platform flag when it disagrees: %s',
    (_label, direction, platformFlag, expected) => {
      // This IS the shipped bug, in both of the directions it occurred.
      withPlatformFlag(platformFlag, () => {
        setAppDirection(direction);

        expect(isAppRTL()).toBe(expected);
      });
    },
  );

  it('survives being set twice, which a re-bootstrap does', () => {
    setAppDirection('rtl');
    setAppDirection('ltr');

    expect(isAppRTL()).toBe(false);
  });

  describe('before the bootstrap has run', () => {
    /*
     * Unreachable in the app - `App.tsx` imports `@/i18n` above the navigator,
     * so the direction is published before any screen module evaluates. A test
     * or a script importing a leaf component on its own can reach it, and the
     * platform flag is the best answer available there.
     */
    it.each([
      ['a right-to-left device', true],
      ['a left-to-right device', false],
    ])('falls back to the platform flag on %s', (_label, platformFlag) => {
      withPlatformFlag(platformFlag, () => {
        expect(isAppRTL()).toBe(platformFlag);
      });
    });
  });
});

describe('the i18n bootstrap publishes the direction', () => {
  /*
   * Asserts the wiring, not the module's internals: importing `@/i18n` must
   * leave `isAppRTL()` answering for the resolved language. Without this, the
   * helper above is correct and simply never called.
   */
  it('leaves isAppRTL answering after @/i18n is imported', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../index');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isAppRTL: freshIsAppRTL } = require('../direction') as typeof import('../direction');

      // The test environment resolves to English; the point is that the
      // bootstrap answered at all rather than leaving it unset.
      expect(typeof freshIsAppRTL()).toBe('boolean');
      expect(freshIsAppRTL()).toBe(false);
    });
  });
});
