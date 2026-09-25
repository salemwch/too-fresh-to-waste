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
 * UPDATE 2026-09-24 - the backlog was worked down
 * -----------------------------------------------
 * The owner asked for the fix, so it was done as its own change: every file
 * on the backlog was translated into en / fr / ar, plus about twenty strings
 * the detector could not see (alerts, toasts, template-literal labels, yup
 * validation messages). The French and Arabic are still unreviewed by a native
 * reader - that caveat above has not gone away, it has moved to the release.
 *
 * One file is left: EstablishmentDetailsScreen is an unreachable placeholder
 * ("details will be displayed here", a button wired to nothing). Nothing
 * navigates to it and no deep link targets it, so it is waiting on a decision
 * to delete it rather than on translations.
 *
 * WHAT IT DOES
 * ------------
 * Pins the count per file. The backlog can shrink freely - fix a file, drop its
 * line, the test tells you the new number. It cannot grow: a new hardcoded
 * string fails here.
 *
 * ON THE DETECTOR
 * ---------------
 * A heuristic, biased towards under-reporting: a detector that cried wolf
 * would be switched off, and a ratchet nobody trusts ratchets nothing. It used
 * to see only a single-line text node between two JSX lines, which hid the
 * multi-line strings and every string sharing a line with its tag. It now
 * recognises five shapes, each pinned by the fixture below:
 *
 *   1. a text node, on one line or several          <Text>\n  Two words\n</Text>
 *   2. text on the same line as its tag              <Text>Two words</Text>
 *   3. a quoted string as a JSX child or branch      {'Two words'}   ? 'Two words'
 *   4. a literal title passed to an alert or toast   Alert.alert('Two words', ...)
 *   5. a template literal as a JSX child or prop     label={`Starts at ${time}`}
 *
 * Still invisible: copy in object literals (label: 'Words'), constants, and
 * service error messages. Those need review, not a regex.
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

const WORDS = /^[A-Za-z][A-Za-z',.!?()\- ]*$/u;

/** A line that can only be prose: no code punctuation, not an argument list. */
const isTextLine = (line: string): boolean =>
  line !== '' &&
  !/[{}<>=;`"']/u.test(line) &&
  WORDS.test(line) &&
  !/,$/u.test(line) && // import or argument lists
  !/\($/u.test(line) && // `cond ? (` - the start of a JSX branch, not text
  !/\?\??$/u.test(line); // a dangling ternary or `??`

const INLINE_TEXT = />([A-Za-z][A-Za-z',.!?()\- ]* [A-Za-z][A-Za-z',.!?()\- ]*)<\//gu;
const QUOTED_CHILD = /(?:^[?:]\s*|\{\s*)'([A-Z][a-z]+(?: [A-Za-z',.!?()-]+)+)'/gu;
const ALERT_TITLE = /(?:Alert\.alert|showAlert|show[A-Z][a-z]*Toast)\(\s*(['`])([A-Z][^'`]*)\1/gu;
const TEMPLATE_COPY = /\{`([A-Z][a-z]+ [^`]*)`\}/gu;

/** Number of hardcoded user-facing strings in one file's source. */
function countHardcoded(source: string): number {
  const lines = stripComments(source)
    .split('\n')
    .map(l => l.trim());
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // 1. A text node: opens after `>` or `}`, may run over several lines, and
    //    closes before a line starting with `<` or `{`. Counted once per run.
    if (isTextLine(line) && /(?:>|\})$/u.test(lines[i - 1] ?? '')) {
      let end = i;
      while (end + 1 < lines.length && isTextLine(lines[end + 1] ?? '')) end++;
      const run = lines.slice(i, end + 1).join(' ');
      if (/^(?:<|\{)/u.test(lines[end + 1] ?? '') && / /u.test(run)) {
        count++;
        i = end;
        continue;
      }
    }

    count += [...line.matchAll(INLINE_TEXT)].length;
    count += [...line.matchAll(QUOTED_CHILD)].length;
    count += [...line.matchAll(ALERT_TITLE)].length;
    count += [...line.matchAll(TEMPLATE_COPY)].length;
  }
  return count;
}

const scan = (): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const file of sourceFiles(SRC)) {
    const n = countHardcoded(readFileSync(file, 'utf8'));
    if (n === 0) continue;
    const rel = file
      .slice(SRC.length + 1)
      .split('\\')
      .join('/');
    counts.set(rel, n);
  }
  return counts;
};

/**
 * Lower a number when you translate a file's strings; delete the line at zero.
 * Re-measured on 2026-09-24 with the five-shape detector.
 */
const BACKLOG: Readonly<Record<string, number>> = {
  'features/establishments/screens/EstablishmentDetailsScreen.tsx': 4,
};

describe('the detector', () => {
  // Replaces the old "backlog is larger than 20" sanity check, which could
  // only pass while the defect it guards against was still widespread. This
  // proves each shape is seen, whatever the backlog happens to be.
  const SHOULD_COUNT: Array<[string, string]> = [
    ['text node', `<Text>\n  Save changes\n</Text>`],
    ['multi-line text node', `<Text>\n  Your data is stored\n  securely here.\n</Text>`],
    ['inline text', `<Text style={s}>No results found</Text>`],
    ['quoted child', `<Text>\n  {'Failed to load data'}\n</Text>`],
    ['quoted ternary branch', `{busy\n  ? 'Please wait'\n  : 'Try again'}`],
    ['alert title', `Alert.alert('Vote failed', message);`],
    ['toast title', `showSuccessToast('Profile updated');`],
    ['template child', `<Text>{\`Your vote carries \${n} pts\`}</Text>`],
    ['template prop', `<Badge label={\`Starts at \${time}\`} />`],
  ];

  it.each(SHOULD_COUNT)('sees a %s', (_shape, source) => {
    expect(countHardcoded(source)).toBeGreaterThan(0);
  });

  it('counts a multi-line string once, not once per line', () => {
    expect(countHardcoded(`<Text>\n  Your data is stored\n  securely here.\n</Text>`)).toBe(1);
  });

  const SHOULD_NOT_COUNT: Array<[string, string]> = [
    ['a translated child', `<Text>\n  {t('profile.saveChanges')}\n</Text>`],
    ['a JSX ternary branch', `() =>\n  isFetchingNextPage ? (\n    <View />\n  ) : null`],
    ['a nullish continuation', `const q =\n  offer.availableQuantity ??\n  0;`],
    ['a single word', `<Text>\n  OK\n</Text>`],
    ['a comment', `// Shows the Save changes button\n<View />`],
    ['a translated alert', `Alert.alert(t('voting.voteFailedTitle'), body);`],
    ['a translated template', `<Text>{t('offers.startsAt', { time })}</Text>`],
  ];

  it.each(SHOULD_NOT_COUNT)('ignores %s', (_shape, source) => {
    expect(countHardcoded(source)).toBe(0);
  });
});

describe('hardcoded user-facing strings', () => {
  const counts = scan();

  it('scans a non-empty set of screens, so the ratchet cannot pass vacuously', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(100);
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
    const driver = [...counts.entries()].filter(([f]) => f.startsWith('features/driver/'));
    expect(driver).toEqual([]);
  });
});
