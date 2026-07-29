import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guards the edge-to-edge contract that Google Play checks on upload.
 *
 * Two Play Console warnings on release 69 traced back to app code:
 *   - `Window.setStatusBarColor` — RN's `StatusBarModule.setColor` has **no**
 *     edge-to-edge guard, so a `backgroundColor` prop calls the deprecated
 *     setter on every commit.
 *   - `Window.setNavigationBarColor` / `setStatusBarColor` via theme
 *     attributes in `styles.xml`.
 *
 * `setTranslucent` does check the flag, but only to log a warning and return —
 * so `translucent` is dead weight that spams logcat.
 *
 * These are static-source assertions rather than render tests on purpose: the
 * failure mode is "an attribute exists in a file the APK ships", which is
 * exactly what Play's analyser looks at. A render test would not catch a prop
 * added to a screen that this suite never mounts.
 */

const SRC = join(__dirname, '..');
const STYLES_XML = join(
  __dirname,
  '..',
  '..',
  'android',
  'app',
  'src',
  'main',
  'res',
  'values',
  'styles.xml',
);

/** Every .ts/.tsx file under src/, excluding this test itself. */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Matches a `<StatusBar ... />` element across line breaks. Non-greedy up to
 * the first `>` so two adjacent elements are not merged into one match.
 */
const STATUS_BAR_ELEMENT = /<StatusBar\b[^>]*>/gs;

describe('edge-to-edge compliance', () => {
  const sourceFiles = collectSourceFiles(SRC);

  it('finds source files to scan', () => {
    // A broken glob would make every assertion below vacuously pass.
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  describe('<StatusBar> props', () => {
    const statusBarUsages = sourceFiles.flatMap(file => {
      const matches = readFileSync(file, 'utf8').match(STATUS_BAR_ELEMENT) ?? [];
      return matches.map(element => ({ file, element }));
    });

    it('finds the StatusBar usages it is meant to police', () => {
      // If StatusBar is removed from the app entirely this should be updated,
      // not left silently passing over zero usages.
      expect(statusBarUsages.length).toBeGreaterThan(0);
    });

    it.each(['backgroundColor', 'translucent'])(
      'never passes `%s` — it calls a deprecated Window API',
      prop => {
        const offenders = statusBarUsages
          .filter(({ element }) => new RegExp(`\\b${prop}\\b`).test(element))
          .map(({ file }) => file.replace(SRC, 'src'));

        expect(offenders).toEqual([]);
      },
    );
  });

  describe('AppTheme', () => {
    const styles = readFileSync(STYLES_XML, 'utf8');

    it('declares the AppTheme this assertion targets', () => {
      expect(styles).toContain('name="AppTheme"');
    });

    // Only real <item> declarations count; the explanatory comment names these
    // attributes on purpose and must not trip the guard.
    const declarations = styles.replace(/<!--[\s\S]*?-->/g, '');

    it.each([
      'android:statusBarColor',
      'android:navigationBarColor',
      'android:navigationBarDividerColor',
    ])('does not set %s — it is the theme route to a flagged deprecated setter', attr => {
      expect(declarations).not.toContain(attr);
    });

    it('keeps windowDrawsSystemBarBackgrounds', () => {
      // Not one of the APIs Play flagged, and on API 21-34 it is the
      // precondition for a transparent bar colour to take effect at all.
      // Removing it as "also deprecated" would give opaque system bars on
      // every Android below 15.
      expect(declarations).toContain('android:windowDrawsSystemBarBackgrounds');
    });
  });
});
