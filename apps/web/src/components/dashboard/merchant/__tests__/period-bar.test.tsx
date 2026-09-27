import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';
import { PeriodBar } from '../period-bar';
import { parseSalesPeriod } from '@/lib/sales-period';

describe('PeriodBar', () => {
  it('shows the five periods and marks the active one', () => {
    render(
      <NextIntlClientProvider locale='en' messages={en}>
        <PeriodBar value='month' onChange={() => undefined} />
      </NextIntlClientProvider>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual([
      'Today',
      '7 Days',
      '30 Days',
      'This Month',
      'All Time',
    ]);
    expect(screen.getByRole('button', { name: 'This Month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reports the chosen period', () => {
    const onChange = jest.fn();
    render(
      <NextIntlClientProvider locale='en' messages={en}>
        <PeriodBar value='month' onChange={onChange} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '7 Days' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });
});

describe('parseSalesPeriod', () => {
  it.each([
    [null, 'month'],
    ['7d', '7d'],
    ['90d', 'month'],
    ['', 'month'],
  ])('%p -> %s', (raw, expected) => {
    expect(parseSalesPeriod(raw)).toBe(expected);
  });
});
