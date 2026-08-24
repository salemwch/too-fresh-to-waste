import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression configuration.
 *
 * The matrix is viewport x theme x direction, expressed as projects so a single
 * `test()` in a spec produces one screenshot per combination and Playwright
 * names them for us.
 *
 * Determinism is enforced in three places and all three are load-bearing:
 *
 *  1. Here - `animations: 'disabled'` freezes CSS animations and transitions at
 *     their end state, and `caret: 'hide'` stops the text cursor blinking
 *     through a screenshot of a focused input.
 *  2. tests/visual/fixtures.ts - seeds localStorage before first paint so the
 *     cookie banner and the theme are settled before anything renders, and
 *     pins the clock so any date-dependent UI is fixed.
 *  3. The harness route itself - no dates, no randomness, no network.
 *
 * `NEXT_PUBLIC_VISUAL_HARNESS=1` is set only by the webServer command below, so
 * the harness route 404s in every other environment including production.
 */

const PORT = 3111;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** 360 is the documented floor (DESIGN.md 9.1); 768 tablet; 1280 desktop. */
const VIEWPORTS = {
  mobile: { width: 360, height: 900 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
} as const;

type ProjectMeta = {
  viewport: keyof typeof VIEWPORTS;
  theme: 'light' | 'dark';
  locale: 'en' | 'fr' | 'ar';
};

/**
 * The full cross product is 3 x 2 x 3 = 18 runs of every spec, which is more
 * than the signal justifies: theme and direction are independent of each other,
 * and French differs from English only in string length.
 *
 * So: every viewport in both themes for the default locale, plus Arabic (RTL)
 * and French at every viewport in light. That covers each axis without paying
 * for combinations that cannot fail independently.
 */
const MATRIX: ProjectMeta[] = [
  ...(['mobile', 'tablet', 'desktop'] as const).flatMap(
    viewport =>
      [
        { viewport, theme: 'light', locale: 'en' },
        { viewport, theme: 'dark', locale: 'en' },
        { viewport, theme: 'light', locale: 'ar' },
        { viewport, theme: 'light', locale: 'fr' },
      ] as ProjectMeta[],
  ),
];

export default defineConfig({
  testDir: './tests/visual',
  // audit.spec.ts is a manual capture rig, never part of a regression run.
  testIgnore: process.env.VISUAL_AUDIT === '1' ? [] : ['**/audit.spec.ts', '**/a11y-probe.spec.ts', '**/probe-detail.spec.ts'],
  outputDir: './tests/visual/.output',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',

  // A visual diff is never worth retrying: a flake here means the harness is
  // wrong, and retrying would hide it.
  retries: 0,
  // exactOptionalPropertyTypes forbids `workers: undefined`; omit the key
  // instead so Playwright applies its own default locally.
  ...(process.env.CI ? { workers: 2 } : {}),
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  expect: {
    toHaveScreenshot: {
      /*
       * Font hinting and sub-pixel antialiasing differ slightly between
       * machines even at identical DPR. A small ratio absorbs that without
       * absorbing a real 1px layout shift, which moves far more pixels.
       */
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'off',
    video: 'off',
    /*
     * Force a stable rendering environment. deviceScaleFactor 1 keeps the
     * baselines small and machine-independent; reducedMotion belt-and-braces
     * over `animations: 'disabled'` for JS-driven motion that CSS cannot pause.
     */
    deviceScaleFactor: 1,
    colorScheme: 'light',
    timezoneId: 'Africa/Tunis',
    contextOptions: { reducedMotion: 'reduce' },
  },

  projects: MATRIX.map(({ viewport, theme, locale }) => ({
    name: `${viewport}-${theme}-${locale}`,
    use: {
      ...devices['Desktop Chrome'],
      viewport: VIEWPORTS[viewport],
      colorScheme: theme,
      deviceScaleFactor: 1,
      timezoneId: 'Africa/Tunis',
      contextOptions: { reducedMotion: 'reduce' as const },
    },
    metadata: { viewport, theme, locale },
  })),

  webServer: {
    /*
     * A production build, not `next dev`. Dev mode injects the error overlay and
     * hot-reload client, recompiles on first request (making the first
     * screenshot of a route slower and occasionally mid-paint), and does not
     * run the CSS through the same pipeline as the build being shipped.
     */
    command: 'pnpm build && pnpm start -p ' + PORT,
    url: BASE_URL + '/en',
    /*
     * Never reuse a server by default.
     *
     * The failure mode is silent and expensive: an already-running server holds
     * the previous build, so after any source change it serves HTML that
     * references a CSS bundle whose hash no longer exists. The page renders
     * completely unstyled and every screenshot "fails" for a reason that has
     * nothing to do with the change under test - or worse, gets accepted as a
     * new baseline.
     *
     * Set VISUAL_REUSE_SERVER=1 to opt in while iterating on the specs
     * themselves, where the app build is not moving.
     */
    reuseExistingServer: process.env.VISUAL_REUSE_SERVER === '1',
    timeout: 10 * 60 * 1000,
    env: {
      NEXT_PUBLIC_VISUAL_HARNESS: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
