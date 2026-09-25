/**
 * A status container's foreground must be its paired `on*Container` token.
 *
 * THE DEFECT THIS ENCODES
 * -----------------------
 * Found on a device on 2026-08-29, not by any test. Google Sign-In failed on
 * the rig, which rendered an error banner nobody had looked at, and sampling
 * the screenshot gave `#D32F2F` text on a `#FFEBEE` ground - the bare `error`
 * token on `errorContainer`. That measures **4.36**, under the 4.5 AA floor.
 * The paired token, `onErrorContainer` `#C62828`, is **4.92**.
 *
 * Five sites had it: GoogleSignInButton, ReviewModal, VerifyEmailScreen,
 * EditProfileScreen and SecurityScreen. All five now use the paired token.
 *
 * WHY NO EXISTING TEST CAUGHT IT
 * ------------------------------
 * `themeContrast.test.ts` checks the *tokens* pair correctly, and they do.
 * These sites simply did not use the paired token, so a token-level test could
 * never see it. And none of the 422 snapshot baselines render an error banner -
 * fixing all five changed zero baselines. Token correctness and usage
 * correctness are different properties and need different tests.
 *
 * WHAT THIS CHECKS
 * ----------------
 * If a file paints a background with `colors.<status>Container`, it must not
 * also use the bare `colors.<status>` as a **text** colour. `borderColor` and
 * `backgroundColor` are deliberately excluded: a banner's accent border sits
 * between the container and the surface behind it, where `error` measures 4.77
 * and is correct.
 *
 * Icons are not distinguished from text here, which makes this stricter than
 * WCAG requires - an icon needs 3.0 and `error` on `errorContainer` clears that
 * at 4.36. That is deliberate. The icon and the text sit in the same row, and
 * two near-identical reds side by side is a worse outcome than one correct one.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..', '..');

const STATUSES = ['error', 'success', 'warning', 'info'] as const;

/** How far past a container background to look for its paired foreground. */
const PROXIMITY_LINES = 14;

const isExempt = (rel: string): boolean =>
  rel.includes('__tests__') || rel.includes('.test.') || rel.includes('test-utils');

function sourceFiles(dir: string, base = '', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = join(base, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, rel, out);
      continue;
    }
    if (/\.tsx?$/u.test(entry) && !isExempt(rel)) out.push(full);
  }
  return out;
}

const capitalise = (s: string): string => `${s[0]?.toUpperCase() ?? ''}${s.slice(1)}`;

interface Violation {
  file: string;
  line: number;
  status: string;
  text: string;
}

const scan = (): Violation[] => {
  const found: Violation[] = [];

  for (const file of sourceFiles(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const rel = file
      .slice(SRC.length + 1)
      .split('\\')
      .join('/');

    for (const status of STATUSES) {
      const containerBg = new RegExp(
        `(?:backgroundColor|Container)\\s*[:=]\\s*[^;\\n]*colors\\.${status}Container`,
        'u',
      );
      // `(?<![a-zA-Z])color` excludes borderColor / backgroundColor / tintColor.
      const bareAsText = new RegExp(
        `(?<![a-zA-Z])color\\s*[:=]\\s*\\{?\\s*theme\\.colors\\.${status}\\b(?!Container)`,
        'u',
      );

      lines.forEach((line, i) => {
        if (!containerBg.test(line)) return;
        // Only the JSX block the container opens. A banner is icon + text, so
        // the paired foreground is always within a handful of lines. Scoping it
        // this way is what stops a required-field asterisk elsewhere in the
        // same file from being reported as a container pairing bug.
        for (let j = i + 1; j < Math.min(i + PROXIMITY_LINES, lines.length); j++) {
          const candidate = lines[j] ?? '';
          if (bareAsText.test(candidate)) {
            found.push({ file: rel, line: j + 1, status, text: candidate.trim().slice(0, 90) });
          }
        }
      });
    }
  }
  return found;
};

/**
 * Sites inside a container block that use the bare status token and are
 * nonetheless correct, each with the measurement that says so.
 *
 * Only **icons** belong here. WCAG 1.4.11 asks 3.0 of a graphic that carries
 * meaning, not the 4.5 it asks of text, so a bare status colour can be right on
 * an icon and wrong on the label beside it. Where both sat in one row the icon
 * was moved too, for visual consistency rather than compliance - these are the
 * ones with no adjacent text to match.
 *
 * Keyed by file and COUNT, not line number. Line numbers broke this test three
 * times in one week on edits nowhere near the icons. A count still fails on
 * what matters: a new bare site in the file (count goes up) or a reviewed one
 * removed without updating the list (count goes down).
 */
const REVIEWED_ICON_EXEMPTIONS: ReadonlyArray<readonly [string, number, string]> = [
  [
    'features/auth/screens/ForgotPasswordScreen.tsx',
    1,
    'lone lock icon in a circle, no adjacent text: 4.56 on successContainer, clears the 3.0 floor',
  ],
  [
    'features/auth/screens/ResetPasswordScreen.tsx',
    1,
    'lone 64px checkmark in a circle, no adjacent text: 4.56, clears the 3.0 floor',
  ],
  [
    'features/auth/screens/VerifyPhoneScreen.tsx',
    1,
    'lone 32px check in a badge, no adjacent text: 4.56, clears the 3.0 floor',
  ],
];

const allowedCount = (file: string): number =>
  REVIEWED_ICON_EXEMPTIONS.find(([f]) => f === file)?.[1] ?? 0;

describe('status container foreground pairing', () => {
  it('scans a non-empty set of source files', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(200);
  });

  it('detects the pattern it is written to detect', () => {
    // A negative control. If the regex silently stopped matching - the
    // lookbehind is the fragile part - the assertion below would pass while
    // checking nothing, which is the failure mode this whole file exists for.
    const sample = `
      <View style={{ backgroundColor: theme.colors.errorContainer }}>
        <Text style={{ color: theme.colors.error }}>boom</Text>
      </View>`;
    const usesContainer =
      /(?:backgroundColor|Container)\s*[:=]\s*[^;\n]*colors\.errorContainer/u.test(sample);
    const bareAsText =
      /(?<![a-zA-Z])color\s*[:=]\s*\{?\s*theme\.colors\.error\b(?!Container)/u.test(sample);
    expect({ usesContainer, bareAsText }).toEqual({ usesContainer: true, bareAsText: true });
  });

  it('does not flag a border, which is a different pairing', () => {
    // `borderColor: colors.error` on a banner sits against the surface behind
    // it (4.77), not against the container, and is correct.
    const sample = `borderColor: theme.colors.error,`;
    expect(
      /(?<![a-zA-Z])color\s*[:=]\s*\{?\s*theme\.colors\.error\b(?!Container)/u.test(sample),
    ).toBe(false);
  });

  it('has no site painting a bare status colour on its own container', () => {
    const found = scan();
    const perFile = new Map<string, number>();
    for (const v of found) perFile.set(v.file, (perFile.get(v.file) ?? 0) + 1);
    const violations = found
      .filter(v => (perFile.get(v.file) ?? 0) > allowedCount(v.file))
      .map(
        v =>
          `${v.file}:${v.line} uses colors.${v.status} as text on ${v.status}Container ` +
          `(use colors.on${capitalise(v.status)}Container) :: ${v.text}`,
      );
    expect(violations).toEqual([]);
  });

  it('lists no exemption that has already been cleaned up', () => {
    // Keeps the allowlist honest: a stale entry would silently license a new
    // violation on that exact line.
    const found = scan();
    const stale = REVIEWED_ICON_EXEMPTIONS.filter(
      ([f, n]) => found.filter(v => v.file === f).length < n,
    ).map(([f, n, why]) => `${f}: allows ${n}, found fewer - ${why}`);
    expect(stale).toEqual([]);
  });
});
