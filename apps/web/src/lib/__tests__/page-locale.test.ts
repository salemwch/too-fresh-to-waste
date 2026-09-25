/**
 * @jest-environment jsdom
 *
 * The locale sent to the API as Accept-Language. It must be the site locale
 * the user chose (`<html lang>`), not the browser's: a French speaker on an
 * English browser browsing /fr/ gets French errors.
 */
import { apiClient } from '../api-client';
import { currentPageLocale } from '../page-locale';

describe('currentPageLocale', () => {
  afterEach(() => {
    document.documentElement.lang = '';
  });

  it.each(['en', 'fr', 'ar'])('reads %s from <html lang>', lang => {
    document.documentElement.lang = lang;
    expect(currentPageLocale()).toBe(lang);
  });

  it.each(['', 'de', 'fr-FR', 'AR'])('falls back to the default for %j', lang => {
    document.documentElement.lang = lang;
    expect(currentPageLocale()).toBe('en');
  });
});

describe('apiClient', () => {
  it('sends the page locale as Accept-Language on every request', async () => {
    document.documentElement.lang = 'ar';
    let sent: string | undefined;
    await apiClient
      .get('/probe', {
        adapter: async config => {
          sent = config.headers.get('Accept-Language') as string | undefined;
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
        },
      })
      .catch(() => undefined);

    expect(sent).toBe('ar');
  });
});
