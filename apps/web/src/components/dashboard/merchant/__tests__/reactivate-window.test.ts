import { deriveUntilFromOffer } from '../reactivate-window';

import type { MerchantOffer } from '@/types/dashboard';

/**
 * `deriveUntilFromOffer` picks the closing time the reactivate modal opens on.
 *
 * The behaviour it has to get right, in the merchant's terms:
 *   - reactivating mid-afternoon an offer that normally closes in the evening
 *     should propose that same evening time;
 *   - reactivating at night an offer that normally closes at lunchtime should
 *     propose the same *length* of window instead, because lunchtime is gone;
 *   - it must never propose a time the form will immediately reject, and never
 *     a time the picker cannot display.
 */

/** Only the fields the function reads; the rest of MerchantOffer is irrelevant here. */
function offerWithSlot(startTime?: string, endTime?: string): MerchantOffer {
  const slots =
    startTime === undefined && endTime === undefined
      ? undefined
      : [{ startTime: startTime ?? '', endTime: endTime ?? '' }];

  return {
    id: 'offer-1',
    title: 'Panier surprise',
    type: 'surprise_bag',
    pricing: { originalPrice: 20, discountedPrice: 6 },
    availableQuantity: 5,
    availableUntil: '2026-07-31T14:00:00.000Z',
    status: 'expired',
    isFeatured: false,
    establishment: { name: 'Boulangerie du Lac' },
    ctaState: 'available',
    ...(slots ? { pickupTimeSlots: slots } : {}),
  } as MerchantOffer;
}

/** A local wall-clock time, since the function reads getHours/getMinutes. */
function at(hours: number, minutes: number): Date {
  return new Date(2026, 6, 31, hours, minutes, 0, 0);
}

describe('deriveUntilFromOffer', () => {
  describe('the original closing time is still ahead today', () => {
    it('proposes that exact time, not a recomputed one', () => {
      // 18:00–21:00 reactivated at 14:00 — the evening slot is still reachable.
      expect(deriveUntilFromOffer(offerWithSlot('18:00', '21:00'), at(14, 0))).toBe('21:00');
    });

    it('proposes it when exactly the minimum window remains', () => {
      expect(deriveUntilFromOffer(offerWithSlot('18:00', '21:00'), at(20, 30))).toBe('21:00');
    });

    it('falls back to the duration once the clock has passed it', () => {
      // 21:00 is behind us, so the three-hour span is re-based on 21:00.
      expect(deriveUntilFromOffer(offerWithSlot('18:00', '21:00'), at(21, 0))).toBe('00:00');
    });
  });

  describe('too little of the original window is left to be usable', () => {
    // A one-minute pickup window is not something a customer can act on, and the
    // merchant would have to correct it by hand — the friction this default
    // exists to remove.

    it('pushes a one-minute remainder out to the minimum window', () => {
      expect(deriveUntilFromOffer(offerWithSlot('18:00', '21:00'), at(20, 59))).toBe('21:30');
    });

    it('pushes a quarter-hour remainder out to the minimum window', () => {
      expect(deriveUntilFromOffer(offerWithSlot('18:00', '21:00'), at(20, 45))).toBe('21:30');
    });

    it('extends by the minimum rather than restarting the full duration', () => {
      // The merchant meant to close around 21:00. Restarting the three-hour span
      // would propose midnight — far past what they ever ran.
      expect(deriveUntilFromOffer(offerWithSlot('18:00', '21:00'), at(20, 59))).not.toBe('00:00');
    });

    it('rolls to the next day when the floor itself crosses midnight', () => {
      // 23:50 + 30 minutes is tomorrow.
      expect(deriveUntilFromOffer(offerWithSlot('20:00', '23:55'), at(23, 50))).toBe('00:00');
    });
  });

  describe('the original closing time has passed', () => {
    it('keeps the window length and re-bases it on now', () => {
      // 12:00–14:00 is a two-hour window; at 18:37 that lands on 20:37 → 21:00.
      expect(deriveUntilFromOffer(offerWithSlot('12:00', '14:00'), at(18, 37))).toBe('21:00');
    });

    it('preserves a short window as a short window', () => {
      // 30 minutes stays 30 minutes: 19:10 + 0:30 = 19:40 → 20:00.
      expect(deriveUntilFromOffer(offerWithSlot('12:00', '12:30'), at(19, 10))).toBe('20:00');
    });

    it('preserves an all-day window as an all-day window', () => {
      // 08:00–22:00 is fourteen hours; from 23:00 that is well past midnight.
      expect(deriveUntilFromOffer(offerWithSlot('08:00', '22:00'), at(23, 0))).toBe('00:00');
    });
  });

  describe('windows that cross midnight', () => {
    it('reads a 00:00 close as next-day rather than a negative span', () => {
      // 22:00–00:00 is two hours, not minus twenty-two.
      expect(deriveUntilFromOffer(offerWithSlot('22:00', '00:00'), at(9, 0))).toBe('11:00');
    });

    it('handles an end earlier in the clock than the start', () => {
      // 22:00–02:00 is four hours.
      expect(deriveUntilFromOffer(offerWithSlot('22:00', '02:00'), at(9, 15))).toBe('13:30');
    });

    it('never proposes 00:00 as a "still ahead today" value', () => {
      // Even at 00:30, a 00:00 close means the following midnight, not this one.
      const result = deriveUntilFromOffer(offerWithSlot('22:00', '00:00'), at(0, 30));
      expect(result).toBe('02:30'); // 00:30 + the two-hour span
    });
  });

  describe('offers with no usable slot', () => {
    it('falls back to two hours when pickupTimeSlots is absent', () => {
      expect(deriveUntilFromOffer(offerWithSlot(), at(10, 0))).toBe('12:00');
    });

    it('falls back to two hours when the array is empty', () => {
      const offer = { ...offerWithSlot('12:00', '14:00'), pickupTimeSlots: [] } as MerchantOffer;
      expect(deriveUntilFromOffer(offer, at(10, 0))).toBe('12:00');
    });

    it('falls back to two hours when a boundary is an empty string', () => {
      expect(deriveUntilFromOffer(offerWithSlot('12:00', ''), at(10, 0))).toBe('12:00');
      expect(deriveUntilFromOffer(offerWithSlot('', '14:00'), at(10, 0))).toBe('12:00');
    });

    it('falls back to two hours when a boundary is unparseable', () => {
      // A malformed value must not become NaN:NaN in the picker.
      expect(deriveUntilFromOffer(offerWithSlot('midi', '14:00'), at(10, 0))).toBe('12:00');
      expect(deriveUntilFromOffer(offerWithSlot('12:00', 'deux heures'), at(10, 0))).toBe('12:00');
    });

    it('falls back to two hours when the window has no length', () => {
      // start === end wraps to a 24-hour span in the midnight arithmetic, which
      // is not an intent worth copying. Measured at 13:00 so the close is behind
      // us and the duration branch is the one under test — at 10:00 the reuse
      // branch would answer first and hide a regression here.
      expect(deriveUntilFromOffer(offerWithSlot('12:00', '12:00'), at(13, 0))).toBe('15:00');
    });
  });

  describe('the value is always one the picker can show', () => {
    it('rounds a derived time up to the next half hour', () => {
      // 10:07 + 2h = 12:07, which is not a mark the select offers.
      expect(deriveUntilFromOffer(offerWithSlot(), at(10, 7))).toBe('12:30');
      expect(deriveUntilFromOffer(offerWithSlot(), at(10, 31))).toBe('13:00');
    });

    it('leaves a time that already sits on a half hour alone', () => {
      expect(deriveUntilFromOffer(offerWithSlot(), at(10, 30))).toBe('12:30');
    });

    it('rounds an off-grid original close up onto the grid', () => {
      // 14:15 is ahead of 10:00 but the picker has no such option, so it becomes
      // the next mark rather than being discarded.
      expect(deriveUntilFromOffer(offerWithSlot('12:00', '14:15'), at(10, 0))).toBe('14:30');
    });

    it('returns a HH:MM string for every minute of the day', () => {
      const offer = offerWithSlot('12:00', '14:00');
      for (let minutes = 0; minutes < 24 * 60; minutes += 1) {
        const result = deriveUntilFromOffer(offer, at(Math.floor(minutes / 60), minutes % 60));
        expect(result).toMatch(/^([01]\d|2[0-3]):(00|30)$/);
      }
    });
  });

  describe('the midnight marker', () => {
    it('returns 00:00 when the window would close after midnight', () => {
      // 23:30 + two hours is tomorrow; the form reads 00:00 as its overflow flag.
      expect(deriveUntilFromOffer(offerWithSlot(), at(23, 30))).toBe('00:00');
    });

    it('returns 00:00 exactly at the boundary, not 24:00', () => {
      // 22:00 + two hours lands on midnight itself.
      expect(deriveUntilFromOffer(offerWithSlot(), at(22, 0))).toBe('00:00');
    });

    it('still returns a same-day time just before the boundary', () => {
      expect(deriveUntilFromOffer(offerWithSlot(), at(21, 29))).toBe('23:30');
    });
  });

  describe('the proposed time is never already in the past', () => {
    // The modal disables its confirm button when the closing time is at or
    // before now, so a default that trips that check would be unusable.
    const windows: Array<[string, string]> = [
      ['12:00', '14:00'],
      ['18:00', '21:00'],
      ['08:00', '22:00'],
      ['22:00', '00:00'],
    ];

    it.each(windows)('holds for a %s–%s window at every half hour', (start, end) => {
      for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
        const now = at(Math.floor(minutes / 60), minutes % 60);
        const result = deriveUntilFromOffer(offerWithSlot(start, end), now);
        if (result === '00:00') continue; // means tomorrow, so never in the past
        const [h, m] = result.split(':').map(Number);
        expect((h as number) * 60 + (m as number)).toBeGreaterThan(minutes);
      }
    });
  });

  describe('each offer is read independently', () => {
    it('gives two offers their own closing times at the same instant', () => {
      const now = at(15, 0);
      expect(deriveUntilFromOffer(offerWithSlot('18:00', '21:00'), now)).toBe('21:00');
      expect(deriveUntilFromOffer(offerWithSlot('08:00', '09:00'), now)).toBe('16:00');
    });

    it('is idempotent — reading the same offer twice does not compound', () => {
      const offer = offerWithSlot('12:00', '14:00');
      const now = at(18, 37);
      expect(deriveUntilFromOffer(offer, now)).toBe(deriveUntilFromOffer(offer, now));
    });
  });
});
