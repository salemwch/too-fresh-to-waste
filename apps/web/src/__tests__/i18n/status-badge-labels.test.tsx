/**
 * `StatusBadge` renders a translated label in every locale.
 *
 * ## Why this test exists
 *
 * The component used to translate only when a call site passed a `label` prop.
 * Ten of its eleven usages did not, so French and Arabic admins read English
 * status words - and nothing failed, because the `formatLabel` fallback
 * title-cases the raw enum into something that looks like a deliberate label
 * ("In Review", "Merchant") rather than a bug.
 *
 * That is the shape of gap this guards: the regression is silent by
 * construction, so it needs a test that reads what is painted rather than one
 * that checks a key exists somewhere.
 *
 * The (variant, value) pairs are read out of the component's own colour maps,
 * not restated here. A variant that gains a status therefore fails this suite
 * until it is translated, instead of being quietly skipped - the same reason
 * `registration-chains.test.ts` derives its key set from `en` rather than
 * listing it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { StatusBadge } from '@/components/dashboard/admin/status-badge';

import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import ar from '@/messages/ar.json';

const MESSAGES = { en, fr, ar } as const;
type Locale = keyof typeof MESSAGES;
const LOCALES = Object.keys(MESSAGES) as Locale[];

const BADGE_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src/components/dashboard/admin/status-badge.tsx'),
  'utf8',
);

/** The colour maps are what decide which statuses the component can render. */
const VARIANT_MAPS: Record<string, string> = {
  user: 'USER_STATUS_MAP',
  establishment: 'ESTABLISHMENT_STATUS_MAP',
  report: 'REPORT_STATUS_MAP',
  priority: 'PRIORITY_MAP',
  role: 'ROLE_MAP',
};

function statusesFor(constName: string): string[] {
  const match = BADGE_SOURCE.match(
    new RegExp(`const ${constName}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`),
  );
  if (!match) throw new Error(`Could not read ${constName} from status-badge.tsx`);
  const body = match[1] ?? '';
  const keys = [...body.matchAll(/^\s*(\w+):/gm)].map(m => m[1] as string);
  if (keys.length === 0) throw new Error(`${constName} parsed as empty - regex is stale`);
  return keys;
}

const CASES = Object.entries(VARIANT_MAPS).flatMap(([variant, constName]) =>
  statusesFor(constName).map(status => ({ variant, status })),
);

function renderBadge(locale: Locale, variant: string, status: string) {
  render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <StatusBadge status={status} variant={variant as never} />
    </NextIntlClientProvider>,
  );
}

describe('StatusBadge translation', () => {
  it('derives a non-trivial set of cases from the component', () => {
    // Guards the regexes above: if they silently stopped matching, every other
    // test in this file would vacuously pass.
    expect(CASES.length).toBeGreaterThanOrEqual(24);
  });

  describe.each(LOCALES)('locale: %s', locale => {
    it.each(CASES)('renders a translated label for $variant/$status', ({ variant, status }) => {
      renderBadge(locale, variant, status);

      const key = `common.badges.${variant}.${status}`;
      const expected = key
        .split('.')
        .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], MESSAGES[locale]);

      expect(typeof expected).toBe('string');
      expect(screen.getByText(expected as string)).toBeInTheDocument();
    });
  });

  it('does not fall back to the title-cased enum in French', () => {
    // The specific regression: `in_review` used to paint "In Review" in every
    // locale. Asserting the French string is present is not enough on its own,
    // because a fallback that happened to match would still pass - so assert
    // the English title-cased form is absent too.
    renderBadge('fr', 'report', 'in_review');

    expect(screen.getByText('En cours d’examen')).toBeInTheDocument();
    expect(screen.queryByText('In Review')).not.toBeInTheDocument();
  });

  it('still renders something readable for a status with no translation', () => {
    // A status the backend adds before the translations catch up must not paint
    // a raw `common.badges.user.archived` key at the user.
    renderBadge('en', 'user', 'archived_by_cron');

    expect(screen.getByText('Archived By Cron')).toBeInTheDocument();
  });

  it('lets a call site override the shared label', () => {
    render(
      <NextIntlClientProvider locale='fr' messages={MESSAGES.fr}>
        <StatusBadge status='active' variant='user' label='Sur mesure' />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Sur mesure')).toBeInTheDocument();
  });
});
