/**
 * Driver cash - the client side of the delivery money model
 * (`.claude/work/commission-settlement-model.md`, "Driver cash").
 *
 * The backend computes and freezes every figure (`order.driverInstruction`).
 * The app never computes money; it only reads what the driver types at the
 * door and sends it back, so the one thing it must get exactly right is
 * turning that text into a number.
 */

export const FAILURE_REASONS = [
  'CUSTOMER_REFUSED',
  'CUSTOMER_UNREACHABLE',
  'CUSTOMER_UNAVAILABLE',
  'MERCHANT_FAULT',
  'DRIVER_FAULT',
] as const;

export type DeliveryFailureReason = (typeof FAILURE_REASONS)[number];

export const RECOVERIES = ['RECOVERABLE_PENDING', 'RETURNED_TO_MERCHANT', 'UNRECOVERABLE'] as const;

export type DeliveryRecovery = (typeof RECOVERIES)[number];

/** Arabic-Indic (U+0660..) and Eastern Arabic-Indic (U+06F0..) digits to ASCII. */
const normaliseDigits = (text: string): string =>
  text.replace(/[٠-٩۰-۹]/gu, ch => {
    const code = ch.charCodeAt(0);
    const zero = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - zero);
  });

/** Plain decimal, up to 3 places (a millime). No sign, no exponent, no grouping. */
const AMOUNT = /^\d+(?:\.\d{1,3})?$/u;

/**
 * Reads an amount typed by the driver. Accepts `.` / `,` / the Arabic decimal
 * separator `٫`, and Arabic-Indic digits. Returns `null` for anything that is
 * not unambiguously one non-negative amount - the screen then asks again
 * rather than send a guessed figure to the ledger.
 */
export function parseCashAmount(text: string): number | null {
  const normalised = normaliseDigits(text.trim()).replace(/[,٫]/gu, '.');
  if (!AMOUNT.test(normalised)) {
    return null;
  }
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

/** Compared to the millime: `0.1 + 0.2` is exactly 0.3 TND here. */
export function collectionStatus(expected: number, collected: number): 'exact' | 'short' | 'over' {
  const diff = Math.round(collected * 1000) - Math.round(expected * 1000);
  if (diff === 0) return 'exact';
  return diff < 0 ? 'short' : 'over';
}

/**
 * The merchant cannot keep money for food they failed to supply, so a
 * merchant-fault failure has one possible outcome. Mirrors the backend rule
 * (`DriverCashService.onFailed`), which rejects anything else.
 */
export function allowedRecoveries(reason: DeliveryFailureReason): readonly DeliveryRecovery[] {
  return reason === 'MERCHANT_FAULT' ? ['RETURNED_TO_MERCHANT'] : RECOVERIES;
}

/** "Not decided yet" books no loss; an admin resolves it later. */
export function defaultRecovery(reason: DeliveryFailureReason): DeliveryRecovery {
  return reason === 'MERCHANT_FAULT' ? 'RETURNED_TO_MERCHANT' : 'RECOVERABLE_PENDING';
}
