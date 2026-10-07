/**
 * The location error codes and the copy that renders them are two halves of
 * one chain: the slice stores a LocationErrorCode, and the screen renders
 * t('location.errors.<code>'). i18next does not type-check keys here, so a code
 * added without its translation would ship as the raw key path, and only in
 * the locale nobody tested. This test is the check for that chain
 * (.claude/rules/registration-chains.md).
 */
import { LOCATION_ERROR_CODES } from '@/store/slices/locationErrors';

import ar from '../locales/ar.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

const LOCALES = { en, fr, ar } as const;

/** Reads a dotted key from a locale tree. */
const lookup = (tree: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree);

describe.each(Object.entries(LOCALES))('%s', (_locale, messages) => {
  it.each(LOCATION_ERROR_CODES)('translates the location error code %s', code => {
    const message = lookup(messages, `location.errors.${code}`);

    expect(typeof message).toBe('string');
    expect((message as string).trim()).not.toBe('');
  });

  it('has no location.errors entry that no code can produce', () => {
    expect(Object.keys(lookup(messages, 'location.errors') as object).sort()).toEqual(
      [...LOCATION_ERROR_CODES].sort(),
    );
  });

  it.each([
    // useLocation's header label for an unset location and for GPS before a name.
    'location.setLocation',
    'location.currentLocation',
    // The city search's no-results line.
    'location.noLocationsFor',
    // offlineManager's toasts.
    'common.noInternetConnection',
    'common.offlineFeaturesLimited',
    'common.backOnline',
    'common.connectionRestored',
  ])('translates %s, which is rendered without a fallback', key => {
    const message = lookup(messages, key);

    expect(typeof message).toBe('string');
    expect((message as string).trim()).not.toBe('');
  });

  it('keeps the {{query}} placeholder in the no-results line', () => {
    // Without it the line still renders, minus what the user searched for.
    expect(lookup(messages, 'location.noLocationsFor')).toEqual(
      expect.stringContaining('{{query}}'),
    );
  });
});
