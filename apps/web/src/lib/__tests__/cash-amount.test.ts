import { parseCashAmount } from '../cash-amount';

/**
 * What an admin types when counting a driver's cash becomes a ledger row, so
 * the parser accepts every normal way of writing an amount in Tunisia and
 * rejects anything it would otherwise have to guess.
 */
describe('parseCashAmount', () => {
  it.each([
    ['14', 14],
    ['14.5', 14.5],
    ['14,5', 14.5],
    ['0.001', 0.001],
    [' 50 ', 50],
    ['١٤', 14],
  ])('reads %p as %p', (text, value) => {
    expect(parseCashAmount(text)).toBe(value);
  });

  it.each(['', '0', '0.000', '-5', 'abc', '14.5.1', '14.5555', '1e3', '1 000'])(
    'rejects %p',
    text => {
      expect(parseCashAmount(text)).toBeNull();
    },
  );
});
