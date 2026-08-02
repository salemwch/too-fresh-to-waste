/**
 * OrderCard pure helpers — isWithinPickupWindow, formatPickupDate.
 *
 * Date/time window logic with multiple boundary conditions. A bug means
 * the pulsing "Go now!" indicator shows at the wrong time, or pickup
 * dates display as "Today" when they're actually tomorrow.
 */

import { isWithinPickupWindow, formatPickupDate } from '../OrderCard';

import { Order } from '../../types/order.types';

const NOW = new Date('2026-08-01T14:30:00.000Z');

const makeOrder = (overrides: {
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
}): Order =>
  ({
    pickupDetails: {
      scheduledDate: overrides.scheduledDate,
      timeSlot: {
        startTime: overrides.startTime,
        endTime: overrides.endTime,
      },
    },
  }) as unknown as Order;

// ---------------------------------------------------------------------------
// isWithinPickupWindow
// ---------------------------------------------------------------------------

describe('isWithinPickupWindow', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns true when current time is within the window', () => {
    const order = makeOrder({
      scheduledDate: '2026-08-01T00:00:00.000Z',
      startTime: `${NOW.getHours()}:00`,
      endTime: `${NOW.getHours() + 1}:00`,
    });
    expect(isWithinPickupWindow(order)).toBe(true);
  });

  it('returns true at the exact start time', () => {
    const h = NOW.getHours();
    const m = NOW.getMinutes();
    const order = makeOrder({
      scheduledDate: '2026-08-01T00:00:00.000Z',
      startTime: `${h}:${String(m).padStart(2, '0')}`,
      endTime: `${h + 1}:00`,
    });
    expect(isWithinPickupWindow(order)).toBe(true);
  });

  it('returns true at the exact end time', () => {
    const h = NOW.getHours();
    const m = NOW.getMinutes();
    const order = makeOrder({
      scheduledDate: '2026-08-01T00:00:00.000Z',
      startTime: `${h - 1}:00`,
      endTime: `${h}:${String(m).padStart(2, '0')}`,
    });
    expect(isWithinPickupWindow(order)).toBe(true);
  });

  it('returns false when current time is before the window', () => {
    const order = makeOrder({
      scheduledDate: '2026-08-01T00:00:00.000Z',
      startTime: `${NOW.getHours() + 2}:00`,
      endTime: `${NOW.getHours() + 3}:00`,
    });
    expect(isWithinPickupWindow(order)).toBe(false);
  });

  it('returns false when current time is after the window', () => {
    const order = makeOrder({
      scheduledDate: '2026-08-01T00:00:00.000Z',
      startTime: '08:00',
      endTime: '10:00',
    });
    expect(isWithinPickupWindow(order)).toBe(false);
  });

  it('returns false when the scheduled date is a different day', () => {
    const order = makeOrder({
      scheduledDate: '2026-08-02T00:00:00.000Z',
      startTime: `${NOW.getHours()}:00`,
      endTime: `${NOW.getHours() + 1}:00`,
    });
    expect(isWithinPickupWindow(order)).toBe(false);
  });

  it('returns false when pickupDetails is missing', () => {
    expect(isWithinPickupWindow({} as Order)).toBe(false);
  });

  it('returns false when time slot is missing', () => {
    const order = { pickupDetails: { scheduledDate: '2026-08-01' } } as unknown as Order;
    expect(isWithinPickupWindow(order)).toBe(false);
  });

  it('returns false when startTime is missing', () => {
    const order = {
      pickupDetails: {
        scheduledDate: '2026-08-01T00:00:00.000Z',
        timeSlot: { endTime: '18:00' },
      },
    } as unknown as Order;
    expect(isWithinPickupWindow(order)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatPickupDate
// ---------------------------------------------------------------------------

describe('formatPickupDate', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "Today" for today\'s date', () => {
    expect(formatPickupDate('2026-08-01T00:00:00.000Z')).toBe('Today');
  });

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    expect(formatPickupDate('2026-08-02T00:00:00.000Z')).toBe('Tomorrow');
  });

  it('returns a formatted date for a later date in the same year', () => {
    const result = formatPickupDate('2026-08-15T00:00:00.000Z');
    expect(result).toMatch(/Aug\s+15/);
  });

  it('includes the year for a date in a different year', () => {
    const result = formatPickupDate('2027-01-10T00:00:00.000Z');
    expect(result).toMatch(/2027/);
  });

  it('returns empty string for undefined', () => {
    expect(formatPickupDate(undefined)).toBe('');
  });

  it('returns the raw string for a garbage date', () => {
    expect(formatPickupDate('garbage')).toBe('garbage');
  });
});
