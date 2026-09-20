import {
  classifyDriverActivity,
  DRIVER_POSITION_STALE_MS,
  type DriverActivity,
} from '../services/driver-management.service';

/**
 * The admin dispatch map labels every driver with one of four activities, and
 * an admin decides who to call based on that label. Getting the precedence
 * wrong is not a cosmetic bug: "idle" on a driver whose app died means dispatch
 * keeps waiting for someone who is not coming.
 *
 * The input space is small and closed - two booleans and a timestamp bucket -
 * so this drives all of it rather than sampling.
 */
describe('classifyDriverActivity', () => {
  const NOW = new Date('2026-09-20T12:00:00.000Z').getTime();

  const fresh = new Date(NOW - 30 * 1000);
  const justInsideStale = new Date(NOW - (DRIVER_POSITION_STALE_MS - 1));
  const exactlyAtThreshold = new Date(NOW - DRIVER_POSITION_STALE_MS);
  const justOverStale = new Date(NOW - (DRIVER_POSITION_STALE_MS + 1));

  describe('offline wins over everything', () => {
    // An offline driver is not a fault to investigate, whatever their last fix
    // looked like or whether an order is still attached to them.
    it.each([
      ['a fresh fix and an order', fresh, true],
      ['a fresh fix and no order', fresh, false],
      ['a cold fix and an order', justOverStale, true],
      ['no fix at all', null, false],
    ])('offline with %s', (_label, positionAt, hasAssignment) => {
      expect(
        classifyDriverActivity({ isOnline: false, positionAt, hasAssignment, now: NOW }),
      ).toBe<DriverActivity>('offline');
    });
  });

  describe('online with a trustworthy fix', () => {
    it('is en_route while carrying an order', () => {
      expect(
        classifyDriverActivity({
          isOnline: true,
          positionAt: fresh,
          hasAssignment: true,
          now: NOW,
        }),
      ).toBe<DriverActivity>('en_route');
    });

    it('is idle with no order - available, stopped somewhere', () => {
      expect(
        classifyDriverActivity({
          isOnline: true,
          positionAt: fresh,
          hasAssignment: false,
          now: NOW,
        }),
      ).toBe<DriverActivity>('idle');
    });
  });

  describe('staleness boundary', () => {
    // The comparison is `now - at > THRESHOLD`, so the threshold itself is
    // still fresh. Asserting both sides and the exact value pins the operator:
    // flipping it to >= moves `exactlyAtThreshold` and fails here.
    it('counts a fix one millisecond inside the window as fresh', () => {
      expect(
        classifyDriverActivity({
          isOnline: true,
          positionAt: justInsideStale,
          hasAssignment: false,
          now: NOW,
        }),
      ).toBe<DriverActivity>('idle');
    });

    it('counts a fix exactly at the threshold as fresh', () => {
      expect(
        classifyDriverActivity({
          isOnline: true,
          positionAt: exactlyAtThreshold,
          hasAssignment: false,
          now: NOW,
        }),
      ).toBe<DriverActivity>('idle');
    });

    it('counts a fix one millisecond past the threshold as stale', () => {
      expect(
        classifyDriverActivity({
          isOnline: true,
          positionAt: justOverStale,
          hasAssignment: false,
          now: NOW,
        }),
      ).toBe<DriverActivity>('stale');
    });
  });

  describe('stale wins over the assignment', () => {
    it('is stale even while an order is attached', () => {
      // This is the case the map exists to surface: an order is out, the driver
      // is nominally online, and the heartbeat stopped. Calling that en_route
      // would draw a marker at a position nobody has confirmed for minutes.
      expect(
        classifyDriverActivity({
          isOnline: true,
          positionAt: justOverStale,
          hasAssignment: true,
          now: NOW,
        }),
      ).toBe<DriverActivity>('stale');
    });

    it('is stale when online but no position was ever reported', () => {
      expect(
        classifyDriverActivity({
          isOnline: true,
          positionAt: null,
          hasAssignment: true,
          now: NOW,
        }),
      ).toBe<DriverActivity>('stale');
    });
  });

  it('treats a fix timestamped in the future as fresh rather than stale', () => {
    // Device clock skew. `now - at` goes negative, which is not greater than
    // the threshold, so it reads fresh - the safe direction, since the fix did
    // just arrive.
    expect(
      classifyDriverActivity({
        isOnline: true,
        positionAt: new Date(NOW + 60 * 1000),
        hasAssignment: false,
        now: NOW,
      }),
    ).toBe<DriverActivity>('idle');
  });

  it('only ever returns one of the four known activities', () => {
    const results = new Set<string>();
    for (const isOnline of [true, false]) {
      for (const hasAssignment of [true, false]) {
        for (const positionAt of [null, fresh, exactlyAtThreshold, justOverStale]) {
          results.add(classifyDriverActivity({ isOnline, positionAt, hasAssignment, now: NOW }));
        }
      }
    }

    expect([...results].sort()).toEqual(['en_route', 'idle', 'offline', 'stale']);
  });
});
