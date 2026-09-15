/**
 * How `establishmentTypes` is serialised onto the query string.
 *
 * WHY THIS IS ITS OWN TEST
 * ------------------------
 * Axios serialises an array as `establishmentTypes[]=a&establishmentTypes[]=b`
 * by default. NestJS `@Query('establishmentTypes')` binds the **literal** key,
 * so the bracketed form arrives as `undefined` and the filter is ignored — the
 * request looks completely correct in a network log, carries the values, and
 * filters nothing.
 *
 * That is the same silent-drop failure this whole change exists to remove, one
 * layer lower. It was caught on the emulator, not by a unit test: the three
 * fixed endpoints sent `establishmentTypes%5B%5D=bakery` while `/offers` — the
 * one carousel that already worked — sent `establishmentTypes=bakery`, because
 * only `getAllOffers` set `paramsSerializer`.
 *
 * So the contract is pinned here: every endpoint that takes the filter must
 * send it unbracketed, and must omit it entirely when there is none.
 */

const mockGet = jest.fn();

jest.mock('@/services/apiClient', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
  // Stubbed: this file asserts what goes OUT on the request, so the response
  // envelope is noise. Parsing it for real only adds a way for the test to
  // fail for an unrelated reason.
  unwrapBackendResponse: (r: { data: { data: unknown } }) => r.data.data,
}));

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { offersService } from '../offersService';

const BAKERY = ['bakery', 'pastry_shop'];

/** The shape `unwrapBackendResponse` expects from a list endpoint. */
const okList = {
  data: { status: 200, message: 'OK', data: [], timestamp: '' },
};

interface Captured {
  params: Record<string, unknown>;
  paramsSerializer?: { indexes?: unknown };
}

const lastConfig = (): Captured => mockGet.mock.calls.at(-1)?.[1] as Captured;

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue(okList);
});

/**
 * The three endpoints fixed in this change, plus `/offers` which already
 * worked — driven from one table so a future endpoint cannot be added with the
 * bracketed default by accident.
 */
const ENDPOINTS: ReadonlyArray<readonly [string, (types?: string[]) => Promise<unknown>]> = [
  ['getUrgentOffers', types => offersService.getUrgentOffers(1, 10, undefined, undefined, types)],
  [
    'getPickupTodayOffers',
    types => offersService.getPickupTodayOffers(20, undefined, undefined, 15000, types),
  ],
  [
    'getPickupTomorrowOffers',
    types => offersService.getPickupTomorrowOffers(20, undefined, undefined, 15000, types),
  ],
];

describe('establishmentTypes reaches the wire unbracketed', () => {
  it.each(ENDPOINTS)('%s disables axios bracket indexes', async (_name, call) => {
    await call(BAKERY);

    // `indexes: null` is what turns `a[]=1&a[]=2` into `a=1&a=2`.
    expect(lastConfig().paramsSerializer).toEqual(expect.objectContaining({ indexes: null }));
  });

  it.each(ENDPOINTS)('%s sends the values under the exact key', async (_name, call) => {
    await call(BAKERY);

    expect(lastConfig().params['establishmentTypes']).toEqual(BAKERY);
  });

  it.each(ENDPOINTS)('%s omits the key entirely when unfiltered', async (_name, call) => {
    // An empty array would still key a distinct cache entry server-side, so
    // "no filter" must mean the param is absent, not present and empty.
    await call(undefined);

    expect(lastConfig().params).not.toHaveProperty('establishmentTypes');
  });

  it.each(ENDPOINTS)('%s omits the key for an empty array', async (_name, call) => {
    await call([]);

    expect(lastConfig().params).not.toHaveProperty('establishmentTypes');
  });

  it('getAllOffers — the carousel that already worked — keeps the same contract', async () => {
    mockGet.mockResolvedValue({
      data: { status: 200, message: 'OK', data: [], meta: {}, timestamp: '' },
    });

    await offersService.getAllOffers({ establishmentTypes: BAKERY } as never, undefined);

    expect(lastConfig().paramsSerializer).toEqual(expect.objectContaining({ indexes: null }));
    expect(lastConfig().params['establishmentTypes']).toEqual(BAKERY);
  });
});
