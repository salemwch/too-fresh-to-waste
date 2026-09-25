/**
 * A positive TND amount typed by an admin (float, handover). Accepts `.` / `,`
 * / the Arabic decimal separator and Arabic-Indic digits; at most 3 decimals
 * (a millime). Returns `null` for zero, negatives and anything ambiguous - the
 * direction of a handover is chosen separately, never typed as a sign.
 *
 * Same rules as the driver app's `features/driver/utils/deliveryCash.ts`.
 */

const normaliseDigits = (text: string): string =>
  text.replace(/[٠-٩۰-۹]/gu, ch => {
    const code = ch.charCodeAt(0);
    const zero = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - zero);
  });

const AMOUNT = /^\d+(?:\.\d{1,3})?$/u;

export function parseCashAmount(text: string): number | null {
  const normalised = normaliseDigits(text.trim()).replace(/[,٫]/gu, '.');
  if (!AMOUNT.test(normalised)) {
    return null;
  }
  const value = Number(normalised);
  return Number.isFinite(value) && value > 0 ? value : null;
}
