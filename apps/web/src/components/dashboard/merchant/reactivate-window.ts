import type { MerchantOffer } from '@/types/dashboard';

/** Used when an offer carries no usable pickup slot. */
const DEFAULT_PICKUP_MINUTES = 120;

/** Minutes in a day — the wrap point for windows that cross midnight. */
const MINUTES_PER_DAY = 24 * 60;

/** The picker only offers half-hour marks, so derived values must land on one. */
const SLOT_MINUTES = 30;

/**
 * Shortest window worth proposing.
 *
 * Without a floor, an 18:00–21:00 offer reactivated at 20:59 would reuse 21:00
 * and open on a one-minute window — nobody can see, order and collect in that,
 * so the merchant has to fix it by hand, which is the friction this whole
 * default exists to remove. Kept equal to SLOT_MINUTES so the floor always lands
 * on a mark the picker can show.
 */
const MIN_WINDOW_MINUTES = 30;

/** `NaN` for anything that is not `HH:MM`, so callers can reject it. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return (h as number) * 60 + (m as number);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Round a minute-of-day up onto the next half-hour mark the picker offers, and
 * hand back the string it expects. Anything at or past midnight becomes '00:00',
 * the form's marker for "closes the next day" — see the `overflow` branch in
 * handleConfirm.
 */
function snapToPicker(minutes: number): string {
  const snapped = Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  return snapped >= MINUTES_PER_DAY ? '00:00' : minutesToTime(snapped);
}

/**
 * The closing time to open the reactivate form on, taken from the offer's own
 * pickup window.
 *
 * "Reuse the same config" and "start now" only agree for part of the day, so
 * there are three cases:
 *
 *  - The original closing time is still comfortably ahead → reuse it. An
 *    18:00–21:00 offer reactivated at 14:00 closes at 21:00, exactly as the
 *    merchant set it up.
 *  - It is ahead but nearly here → push it out to MIN_WINDOW_MINUTES. At 20:59
 *    that same offer would otherwise open on a one-minute window. The full
 *    duration is deliberately not restarted: a merchant closing at 21:00 wants
 *    to shift the end, not gain three more hours.
 *  - It has passed → keep the *duration* instead, re-based on now. A 12:00–14:00
 *    offer reactivated at 18:37 cannot close at 14:00; what carries over is that
 *    this merchant leaves bags collectable for two hours.
 *
 * Every path is snapped onto the picker's half-hour grid, so the returned value
 * is always selectable, and always far enough ahead that the modal's own
 * `untilInPast` guard will not reject it.
 *
 * `now` is injectable so the behaviour can be tested at a fixed clock.
 */
export function deriveUntilFromOffer(offer: MerchantOffer, now: Date = new Date()): string {
  const slot = offer.pickupTimeSlots?.[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const start = slot?.startTime ? timeToMinutes(slot.startTime) : NaN;
  const end = slot?.endTime ? timeToMinutes(slot.endTime) : NaN;
  const hasSlot = Number.isFinite(start) && Number.isFinite(end);

  // The original closing time is still ahead: the merchant is inside the window
  // they set up, so honour it. The floor only bites at the very tail of it —
  // reactivating an 18:00–21:00 offer at 20:59 must not propose a one-minute
  // window. It deliberately does NOT restart the full duration there: a merchant
  // closing at 21:00 wants to shift the end, not gain three more hours.
  //
  // '00:00' fails this test on its own, which is what we want — "after midnight"
  // is never "later today".
  if (hasSlot && end > nowMinutes) {
    return snapToPicker(Math.max(end, nowMinutes + MIN_WINDOW_MINUTES));
  }

  // The original close is behind us — a different part of the day entirely, so
  // the reusable signal is how long this merchant keeps bags collectable.
  let duration = DEFAULT_PICKUP_MINUTES;
  if (hasSlot) {
    // An end at or before the start means the window ran past midnight ('00:00'
    // is how that is stored), so roll it a day forward rather than reading a
    // negative span. A span of exactly a day means start === end — a zero-length
    // window, which is not an intent worth copying.
    const span = end > start ? end - start : end + MINUTES_PER_DAY - start;
    if (span > 0 && span < MINUTES_PER_DAY) duration = span;
  }

  return snapToPicker(nowMinutes + Math.max(duration, MIN_WINDOW_MINUTES));
}
