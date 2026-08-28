/**
 * A ratchet on user-facing English typed straight into JSX.
 *
 * WHY THIS EXISTS RATHER THAN A FIX
 * ---------------------------------
 * The driver flow's six strings were fixed on 2026-08-28. Scanning for the
 * same defect elsewhere found 92 more across 33 files - empty states, modal
 * headings, button labels, `Save Changes`, `Delete Account`, `No offers found`.
 * A French or Arabic user sees every one of them in English.
 *
 * They are not fixed here for a reason that is worth stating plainly, because
 * "we ran out of time" and "this needs a different kind of review" are
 * different things and only one of them is true. Adding 92 strings means
 * writing 184 new French and Arabic translations. Producing those is
 * mechanical; *shipping them unreviewed* is a content decision, and this app's
 * French is its primary commercial language. That belongs in its own change
 * with a native reader on it, not folded into a design-token pass.
 *
 * WHAT IT DOES INSTEAD
 * --------------------
 * Pins the count per file. The backlog can shrink freely - fix a file, drop its
 * line, the test tells you the new number. It cannot grow: a new hardcoded
 * string fails here, which is the only property that actually matters while the
 * backlog is being worked down.
 *
 * ON THE DETECTOR
 * ---------------
 * It is a heuristic and it under-reports. It only sees a text node that sits
 * alone on its line between two JSX lines, so a string spanning two lines, or
 * one sharing a line with a tag, is invisible to it. 92 is therefore a floor,
 * not a total. It is deliberately biased that way: a detector that cried wolf
 * would be switched off, and a ratchet nobody trusts ratchets nothing.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

const isExempt = (rel: string): boolean =>
  rel.includes('__tests__') ||
  rel.includes('.test.') ||
  rel.includes('test-utils') ||
  rel.includes('__mocks__');

function sourceFiles(dir: string, base = '', out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = join(base, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, rel, out);
      continue;
    }
    if (/\.tsx$/u.test(entry) && !isExempt(rel)) out.push(full);
  }
  return out;
}

/** Blanks out comments so their prose is not mistaken for rendered copy. */
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//gu, m => m.replace(/[^\n]/gu, ' '))
    .replace(/\/\/[^\n]*/gu, m => m.replace(/[^\n]/gu, ' '));

const scan = (): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const file of sourceFiles(SRC)) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((raw, i) => {
      const t = raw.trim();
      if (!t) return;
      if (/[{}<>=;`"']/u.test(t)) return; // any code punctuation - not a text node
      if (!/^[A-Za-z][A-Za-z',.!?()\- ]*$/u.test(t)) return;
      if (!/ /u.test(t)) return; // single words are usually identifiers
      if (/,$/u.test(t)) return; // import or argument lists
      const prev = (lines[i - 1] ?? '').trim();
      const next = (lines[i + 1] ?? '').trim();
      if (!/(?:>|\})$/u.test(prev) || !/^(?:<|\{)/u.test(next)) return;
      const rel = file
        .slice(SRC.length + 1)
        .split('\\')
        .join('/');
      counts.set(rel, (counts.get(rel) ?? 0) + 1);
    });
  }
  return counts;
};

/**
 * The backlog as measured on 2026-08-28, after the driver flow was fixed.
 * Lower a number when you translate a file's strings; delete the line at zero.
 */
const BACKLOG: Readonly<Record<string, number>> = {
  'features/voting/components/VotingCard.tsx': 14,
  'features/profile/screens/PrivacyScreen.tsx': 6,
  'design-system/components/organisms/LocationSelectionModal/LocationSelectionModal.tsx': 5,
  'design-system/components/molecules/AccountLockedModal/AccountLockedModal.tsx': 4,
  'design-system/components/organisms/ManualLocationModal/ManualLocationModal.tsx': 4,
  'features/establishments/screens/EstablishmentDetailsScreen.tsx': 4,
  'features/search/components/LocationFilterModal/LocationFilterModal.tsx': 4,
  'navigation/components/LocationPickerBottomSheet.tsx': 4,
  'design-system/components/molecules/ResendVerificationModal/ResendVerificationModal.tsx': 3,
  'features/loyalty/components/RecentActivityList.tsx': 3,
  'features/orders/components/ReviewModal.tsx': 3,
  'features/orders/screens/OrderHistoryScreen.tsx': 3,
  'features/profile/screens/ContactSupportScreen.tsx': 3,
  'features/profile/screens/EditProfileScreen.tsx': 3,
  'features/profile/screens/SecurityScreen.tsx': 3,
  'features/search/components/EstablishmentBottomSheet/EstablishmentBottomSheet.tsx': 3,
  'design-system/components/molecules/LocationPromptBanner/LocationPromptBanner.tsx': 2,
  'features/auth/screens/ResetPasswordScreen.tsx': 2,
  'features/donations/screens/DonationImpactScreen.tsx': 2,
  'features/search/components/PlaceOffersBottomSheet/PlaceOffersBottomSheet.tsx': 2,
  'features/search/screens/SearchScreen.tsx': 2,
  'navigation/ProtectedRoute.tsx': 2,
  'design-system/components/molecules/MorphingButton/MorphingButton.tsx': 1,
  'features/driver/screens/DriverOrderDetailScreen.tsx': 1,
  'features/favorites/screens/FavoritesScreen.tsx': 1,
  'features/leaderboard/components/DiscountClaimModal.tsx': 1,
  'features/loyalty/components/PremiumPointsCard.tsx': 1,
  'features/loyalty/components/StreakCard.tsx': 1,
  'features/loyalty/screens/LoyaltyScreen.tsx': 1,
  'features/offers/components/ReviewSummarySection.tsx': 1,
  'features/search/components/ActiveFilterChips.tsx': 1,
  'features/search/components/FilterBottomSheet.tsx': 1,
  'navigation/components/LocationHeader.tsx': 1,
};

describe('hardcoded user-facing strings', () => {
  const counts = scan();

  it('scans a non-empty set of screens, so the ratchet cannot pass vacuously', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(100);
  });

  it('detects the backlog it claims to, so the detector itself is not broken', () => {
    // If the heuristic silently stopped matching, every assertion below would
    // pass while measuring nothing. This fails first, and loudly.
    expect(counts.size).toBeGreaterThan(20);
  });

  it('has no file with more hardcoded strings than recorded', () => {
    const grown = [...counts.entries()]
      .filter(([file, n]) => n > (BACKLOG[file] ?? 0))
      .map(([file, n]) => `${file}: was ${BACKLOG[file] ?? 0}, now ${n}`);

    // A new string here means a French or Arabic user will read English. Route
    // it through t() and add the key to en, fr and ar together.
    expect(grown).toEqual([]);
  });

  it('lists no file that has already been cleaned up', () => {
    // Keeps the backlog honest downward: a stale entry would silently license
    // new strings in a file somebody had already finished.
    const stale = Object.entries(BACKLOG)
      .filter(([file, n]) => (counts.get(file) ?? 0) < n)
      .map(([file, n]) => `${file}: recorded ${n}, now ${counts.get(file) ?? 0} - lower it`);

    expect(stale).toEqual([]);
  });

  it('keeps the driver flow at zero, since that is the part that was fixed', () => {
    const driver = [...counts.entries()].filter(
      ([f]) => f.startsWith('features/driver/') && f.includes('DriverOrdersList'),
    );
    expect(driver).toEqual([]);
  });
});
