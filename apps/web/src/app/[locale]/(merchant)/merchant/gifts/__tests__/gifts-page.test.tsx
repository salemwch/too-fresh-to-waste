import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import ar from '@/messages/ar.json';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

import MerchantGiftsPage from '../page';

/**
 * The Gifts page, in every locale. Rendered per locale so a missing key fails
 * here instead of showing its path in French or Arabic (registration-chains).
 */
const LOCALES = [
  ['en', en],
  ['fr', fr],
  ['ar', ar],
] as const;

const PERK_IDS = [
  'packaging',
  'supplies',
  'ingredients',
  'hygiene',
  'branding',
  'equipment',
] as const;

describe.each(LOCALES)('MerchantGiftsPage (%s)', (locale, messages) => {
  const g = messages.merchantGifts;

  const renderPage = () =>
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <MerchantGiftsPage />
      </NextIntlClientProvider>,
    );

  it('leads with the value, then how it works', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: g.title })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: g.howTitle })).toBeTruthy();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it.each(PERK_IDS)('shows the %s category with its examples', id => {
    renderPage();

    const card = screen.getByRole('article', { name: g.perks[id].title });
    for (const item of g.perks[id].items) {
      expect(within(card).getByText(item)).toBeTruthy();
    }
  });

  it('no longer offers internet', () => {
    renderPage();

    expect('internet' in g.perks).toBe(false);
    expect(screen.queryByText(/internet|wifi|Wi-Fi/i)).toBeNull();
  });

  it('promises no price, percentage or date - a number here reads as a promise', () => {
    const { container } = renderPage();

    expect(container.textContent).not.toMatch(/%|TND|DT\b|\d+[.,]\d/u);
  });
});
