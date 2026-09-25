/**
 * `COMMISSION_MODEL_EFFECTIVE_AT` - the instant the commission-settlement model
 * starts applying. See `.claude/work/commission-settlement-model.md`.
 *
 * The value decides which sales owe 19% under the new rules, so an ambiguous
 * instant is a money bug. Accepted: `YYYY-MM-DDTHH:mm[:ss[.sss]]` followed by
 * `Z` or `±HH:mm`. Rejected: no offset (server-local, a different instant per
 * host), date-only, and anything JavaScript would silently roll over -
 * `2026-02-30` becomes 2 March, `T24:00` becomes the next day.
 *
 * There is no default. The date is chosen by the product owner at release.
 */

const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/;

export function parseCommissionCutoff(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = ISO_WITH_OFFSET.exec(value);
  if (!match) {
    return null;
  }

  const [, y, mo, d, h, mi, s = '0', , zone, sign, oh = '0', om = '0'] = match;
  const offsetMinutes = zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (Number(oh) * 60 + Number(om));
  if (Math.abs(offsetMinutes) > 14 * 60) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Shift back into the written offset and require every field to survive, so
  // a rolled-over date or hour is rejected instead of quietly moving the cutoff.
  const local = new Date(parsed.getTime() + offsetMinutes * 60_000);
  const fieldsMatch =
    local.getUTCFullYear() === Number(y) &&
    local.getUTCMonth() + 1 === Number(mo) &&
    local.getUTCDate() === Number(d) &&
    local.getUTCHours() === Number(h) &&
    local.getUTCMinutes() === Number(mi) &&
    local.getUTCSeconds() === Number(s);

  return fieldsMatch ? parsed : null;
}
