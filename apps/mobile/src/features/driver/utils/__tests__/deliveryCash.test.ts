/**
 * What the driver types at the door becomes money in TFTW's ledger, so the
 * parser is strict: it accepts every way a driver in Tunisia will write an
 * amount (French comma, Arabic-Indic digits) and rejects anything ambiguous
 * rather than guessing a number.
 */

import {
  allowedRecoveries,
  collectionStatus,
  defaultRecovery,
  FAILURE_REASONS,
  parseCashAmount,
} from '../deliveryCash';

describe('parseCashAmount', () => {
  it.each([
    ['14', 14],
    ['14.5', 14.5],
    ['14,5', 14.5], // French keyboards
    ['14.250', 14.25],
    ['0', 0],
    [' 14 ', 14],
    ['١٤', 14], // Arabic-Indic digits
    ['١٤٫٥', 14.5], // Arabic decimal separator
    ['۱۴', 14], // Eastern Arabic-Indic (Persian) digits
  ])('reads %p as %p', (input, expected) => {
    expect(parseCashAmount(input)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['14.5.2'],
    ['14,5,2'],
    ['-3'],
    ['1e3'],
    ['14.5555'], // more precision than a millime
    ['Infinity'],
    ['NaN'],
    ['1 000'],
  ])('rejects %p instead of guessing', input => {
    expect(parseCashAmount(input)).toBeNull();
  });
});

describe('collectionStatus', () => {
  it.each([
    [14, 14, 'exact'],
    [14, 12, 'short'],
    [14, 15, 'over'],
    [0, 0, 'exact'],
  ] as const)('expected %p, collected %p -> %p', (expected, collected, status) => {
    expect(collectionStatus(expected, collected)).toBe(status);
  });

  it('compares to the millime, not by float equality', () => {
    expect(collectionStatus(0.3, 0.1 + 0.2)).toBe('exact');
  });
});

describe('failure recovery rules', () => {
  it('offers every reason the backend accepts', () => {
    expect([...FAILURE_REASONS].sort()).toEqual(
      [
        'CUSTOMER_REFUSED',
        'CUSTOMER_UNAVAILABLE',
        'CUSTOMER_UNREACHABLE',
        'DRIVER_FAULT',
        'MERCHANT_FAULT',
      ].sort(),
    );
  });

  it('only lets a merchant-fault failure end with the food back at the merchant', () => {
    expect(allowedRecoveries('MERCHANT_FAULT')).toEqual(['RETURNED_TO_MERCHANT']);
    expect(defaultRecovery('MERCHANT_FAULT')).toBe('RETURNED_TO_MERCHANT');
  });

  it.each([
    'CUSTOMER_REFUSED',
    'CUSTOMER_UNREACHABLE',
    'CUSTOMER_UNAVAILABLE',
    'DRIVER_FAULT',
  ] as const)('lets %s choose any outcome, defaulting to "not decided yet"', reason => {
    expect(allowedRecoveries(reason)).toEqual([
      'RECOVERABLE_PENDING',
      'RETURNED_TO_MERCHANT',
      'UNRECOVERABLE',
    ]);
    // The safe default: no loss booked until someone decides.
    expect(defaultRecovery(reason)).toBe('RECOVERABLE_PENDING');
  });
});
