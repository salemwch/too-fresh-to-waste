/**
 * Development-only mock backend.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every authenticated screen in the app - Home, Orders, Checkout, Profile, the
 * driver flow - had never been rendered on a device, in any theme. They were
 * unreachable: `.env.development` points at the *production* API, and there is
 * no local backend running. Verifying them meant either creating an account on
 * production or standing up the real stack (Docker, Mongo replica set, seeds).
 *
 * This is the third option: serve the same response envelope the real backend
 * serves, from localhost, with fixture data. Nothing it does touches
 * production, and nothing about the app's auth code changes - the app still
 * reads a token from the Keychain and still calls `GET /auth/me` to validate
 * it, exactly as it would against the real API.
 *
 * WHAT IT IS NOT
 * --------------
 * Not a substitute for integration testing. It answers what the screens ask
 * for; it does not enforce a single business rule. A screen that looks right
 * against this server has been verified *visually*, and that is the only claim
 * this tool supports.
 *
 * THE ENVELOPE
 * ------------
 * `{ status: number, message: string, data: T, meta?, timestamp }` - `status`
 * is a number (200), not 'success'. Mobile unwraps it with
 * `unwrapBackendResponse()`. Getting this shape wrong is the single most likely
 * reason a screen renders an error state against this server rather than
 * content.
 *
 * UNMATCHED ROUTES
 * ----------------
 * Logged loudly and answered with an empty collection rather than a 404. That
 * is deliberate: an unmatched route should surface a screen's *empty* state,
 * which is a state worth verifying, instead of a network error that tells us
 * nothing. The log is the to-do list - anything printed with `UNMATCHED` is a
 * route this file does not yet know about.
 *
 * RUN
 * ---
 *   node tools/dev-mock-api/server.mjs
 *   adb -s <device> reverse tcp:8787 tcp:8787
 */

import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8787);

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

const ok = (data, meta) => ({
  status: 200,
  message: 'OK',
  data,
  ...(meta ? { meta } : {}),
  timestamp: iso(),
});

const page = (items, total = items.length) =>
  ok(items, {
    page: 1,
    limit: 20,
    total,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

/* ------------------------------------------------------------------ fixtures */

const USER = {
  userId: 'dev-user-000000000001',
  email: 'dev.consumer@example.invalid',
  firstName: 'Dev',
  lastName: 'Consumer',
  phoneNumber: '+21600000000',
  role: 'consumer',
  status: 'active',
  isEmailVerified: true,
  isPhoneVerified: true,
  profileImage: null,
  leaderboardAnonymous: false,
  createdAt: iso(-90 * 864e5),
  updatedAt: iso(),
  lastLoginAt: iso(-3600e3),
  authProvider: 'local',
};

const ESTABLISHMENT = {
  _id: 'dev-est-0001',
  name: 'Boulangerie du Lac',
  description: 'Artisan bakery in Les Berges du Lac',
  image: null,
  logo: null,
  address: { street: '12 Rue du Lac', city: 'Tunis', country: 'Tunisia' },
  location: { type: 'Point', coordinates: [10.2333, 36.8333] },
  rating: 4.6,
  reviewCount: 128,
  category: 'bakery',
};

/**
 * Shaped from `packages/shared/src/types/offer.types.ts`, not improvised.
 *
 * Two things there are easy to get wrong and both red-screen the app:
 * prices live in a nested `pricing: PriceInfo`, not flat on the offer
 * (`OfferCard` reads `offer.pricing.discountedPrice` while building its
 * accessibility label, with no optional chaining), and the id field is `id`,
 * not `_id` - the comment in the type says the backend DTO uses `id` and only
 * some aggregation paths still return Mongo-style ids. Both are supplied.
 */
const offer = (i, over = {}) => ({
  id: `dev-offer-${String(i).padStart(4, '0')}`,
  _id: `dev-offer-${String(i).padStart(4, '0')}`,
  title: ['Surprise Bag', 'Pastry Box', 'Sandwich Deal', 'Veggie Basket'][i % 4],
  description: 'A mixed selection of what is left at the end of the day.',
  establishmentId: ESTABLISHMENT,
  merchantId: 'dev-merchant-0001',
  type: 'surprise_bag',
  status: 'active',
  pricing: {
    originalPrice: 24,
    discountedPrice: 8,
    discountPercentage: 67,
    currency: 'TND',
  },
  totalQuantity: 5,
  reservedQuantity: 2,
  soldQuantity: 0,
  availableQuantity: 3,
  images: [],
  categories: ['bakery'],
  tags: ['vegetarian'],
  availableFrom: iso(-3600e3),
  availableUntil: iso(6 * 3600e3),
  pickupTimeSlots: [{ startTime: '18:00', endTime: '20:00' }],
  viewCount: 42,
  favoriteCount: 7,
  isActive: true,
  isFeatured: i === 0,
  isRecurring: false,
  isExpired: false,
  isSoldOut: false,
  isDeleted: false,
  isFavorite: i % 3 === 0,
  distance: 1.2 + i * 0.4,
  createdAt: iso(-864e5),
  updatedAt: iso(),
  ...over,
});

const OFFERS = Array.from({ length: 6 }, (_, i) => offer(i));

/**
 * Shaped from `packages/shared/src/types/order.types.ts`.
 *
 * The parts that are easy to get wrong: the customer field is `customerId`,
 * not `userId`; `items[]` entries carry their own `offerTitle`/`unitPrice`
 * rather than a bare price; and `pickupDetails` / `paymentDetails` / `pricing`
 * are required nested objects. A flat first draft red-screened the Orders tab
 * into the global error boundary.
 *
 * `items[].offerId` is given as a populated offer, which the type allows
 * (`string | PopulatedOffer`) and which is the shape the list actually renders.
 */
const order = (i, status, deliveryMode = 'pickup') => {
  const deliveryFee = deliveryMode === 'delivery' ? 4 : 0;
  const subtotal = 8;
  return {
    _id: `dev-order-${String(i).padStart(4, '0')}`,
    orderNumber: `TFW-${1000 + i}`,
    customerId: USER.userId,
    establishmentId: ESTABLISHMENT,
    merchantId: 'dev-merchant-0001',
    items: [
      {
        offerId: OFFERS[i % OFFERS.length],
        offerTitle: OFFERS[i % OFFERS.length].title,
        quantity: 1,
        unitPrice: subtotal,
        totalPrice: subtotal,
        originalPrice: 24,
        discountAmount: 16,
      },
    ],
    status,
    paymentStatus: 'pending',
    pickupDetails: {
      timeSlot: { startTime: '18:00', endTime: '20:00' },
      scheduledDate: iso(3 * 3600e3),
      qrCode: 'dev-qr-code',
      pickupCode: '4821',
    },
    paymentDetails: {
      method: 'cash',
      amount: subtotal + deliveryFee,
      currency: 'TND',
    },
    pricing: {
      subtotal,
      discountAmount: 16,
      taxAmount: 0,
      deliveryFee,
      total: subtotal + deliveryFee,
      currency: 'TND',
    },
    paymentProvider: 'cash',
    deliveryMode,
    donationAmount: Number((subtotal * 0.19 * 0.05).toFixed(3)),
    expiresAt: iso(6 * 3600e3),
    isRated: false,
    createdAt: iso(-2 * 3600e3),
    updatedAt: iso(),
  };
};

const ORDERS = [
  order(0, 'confirmed'),
  order(1, 'ready_for_pickup'),
  order(2, 'out_for_delivery', 'delivery'),
  order(3, 'picked_up'),
  order(4, 'cancelled'),
];

/* -------------------------------------------------------------------- routes */

/** [method, RegExp, handler] - first match wins. */
const routes = [
  ['GET', /^\/auth\/me$/, () => ok(USER)],
  ['POST', /^\/auth\/refresh$/, () =>
    ok({ accessToken: 'dev-access-token', refreshToken: 'dev-refresh-token' })],
  ['GET', /^\/config\/features$/, () => ok({ onlinePayment: true })],
  // Discovered from the UNMATCHED log on the first authenticated boot.
  /* Field names matter here. `useAppVersionCheck` wraps the *fetch* in
   * try/catch but not the parse, so a response missing `minVersion` throws
   * `Cannot read property 'split' of undefined` during render and red-screens
   * the app. A first draft of this fixture used `minimumVersion` and did
   * exactly that. */
  ['GET', /^\/config\/app-version$/, () =>
    ok({ minVersion: '1.0.0', latestVersion: '1.0.0', updateUrl: 'https://example.invalid' })],
  ['POST', /^\/notifications\/device-token$/, () => ok({ registered: true })],

  ['GET', /^\/offers\/?$/, () => page(OFFERS)],
  ['GET', /^\/offers\/search/, () => page(OFFERS)],
  ['GET', /^\/offers\/nearby/, () => page(OFFERS)],
  /* The Home feed's named collections. These must precede the `/offers/:id`
   * rule below or they match it and return a single object where the screen
   * expects a list - which is silent, not a crash, and shows as an empty
   * carousel. Found by reading the mock's own request log. */
  ['GET', /^\/offers\/(urgent|featured|recommended|pickup-today|pickup-tomorrow)$/, () =>
    page(OFFERS)],
  ['GET', /^\/offers\/[^/]+$/, (m, url) => {
    const id = url.pathname.split('/').pop();
    return ok(OFFERS.find(o => o.id === id) ?? OFFERS[0]);
  }],

  ['GET', /^\/establishments\/?$/, () => page([ESTABLISHMENT])],
  ['GET', /^\/establishments\/[^/]+$/, () => ok(ESTABLISHMENT)],

  ['GET', /^\/orders\/?$/, () => page(ORDERS)],
  ['GET', /^\/orders\/[^/]+$/, (m, url) => {
    const id = url.pathname.split('/').pop();
    return ok(ORDERS.find(o => o._id === id) ?? ORDERS[0]);
  }],

  ['GET', /^\/favorites\/ids$/, () => ok([OFFERS[0]._id, OFFERS[3]._id])],
  ['GET', /^\/favorites\/stats$/, () => ok({ offers: 2, establishments: 1, total: 3 })],
  /* An empty favourites list, deliberately.
   *
   * `FavoritesResponse` is an object with its own envelope, not the bare array
   * `page()` produces, and `favoritesService` unwraps it by shape-sniffing. A
   * wrapped-offer first draft fed `undefined` into `OfferCard`, which reads
   * `offer.pricing.discountedPrice` with no optional chaining and took the
   * whole tree into the QueryErrorBoundary.
   *
   * Empty is honest rather than lazy: it exercises the Favorites empty state,
   * which is a state this verification pass has to check anyway. The populated
   * list is recorded as NOT exercised in the report rather than faked into a
   * shape that might not match the backend's. */
  ['GET', /^\/favorites/, () =>
    ok({ favorites: [], total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false })],

  ['GET', /^\/loyalty\/(me|summary|points)/, () =>
    ok({
      points: 340,
      totalBagsSaved: 34,
      totalOrdersCount: 34,
      tier: 'silver',
      currentStreak: 4,
      longestStreak: 9,
      nextTierPoints: 500,
    })],
  ['GET', /^\/loyalty\/activity/, () =>
    page([
      { _id: 'a1', type: 'earn', points: 10, description: 'Saved a bag', createdAt: iso(-864e5) },
      { _id: 'a2', type: 'earn', points: 10, description: 'Saved a bag', createdAt: iso(-2 * 864e5) },
    ])],
  ['GET', /^\/loyalty\/badges/, () =>
    page([
      { _id: 'b1', name: 'First Bag', unlocked: true, icon: 'trophy' },
      { _id: 'b2', name: 'Ten Bags', unlocked: true, icon: 'medal' },
      { _id: 'b3', name: 'Fifty Bags', unlocked: false, icon: 'star' },
    ])],
  ['GET', /^\/loyalty\/leaderboard/, () =>
    page(
      Array.from({ length: 8 }, (_, i) => ({
        _id: `lb-${i}`,
        rank: i + 1,
        userId: i === 3 ? USER.userId : `other-${i}`,
        displayName: i === 3 ? 'Dev Consumer' : `Saver ${i + 1}`,
        points: 900 - i * 70,
        bagsSaved: 90 - i * 7,
        isCurrentUser: i === 3,
      })),
    )],

  /* Shapes below are taken from packages/shared/src/types, not invented. The
   * catch-all's empty array crashed both of these components on first contact
   * (`Cannot read property 'toLocaleString' of undefined`), which is the cost
   * of the empty-collection default and the reason these are explicit. */
  ['GET', /^\/community-goal\/stats$/, () =>
    ok({
      currentCount: 1240,
      targetCount: 2000,
      progressPercentage: 62,
      remaining: 760,
      cycleNumber: 3,
      status: 'ACTIVE',
      lastUpdatedAt: iso(),
      seasonName: 'Autumn Challenge',
      participantCount: 318,
      causeType: 'TSHIRTS',
      causeTitle: 'School t-shirts',
      causeDescription: 'Every 2000 bags funds a set of school t-shirts.',
    })],

  ['GET', /^\/donations\/stats$/, () =>
    ok({
      totalDonations: 213.5,
      targetAmount: 500,
      mealCount: 427,
      contributorCount: 96,
      progressPercentage: 43,
      status: 'ACTIVE',
      cause: 'School t-shirts',
      activeGoalCategory: 'TSHIRTS',
      currency: 'TND',
      categoryProgress: [],
      season: 1,
      goalIndex: 0,
      completedGoals: [],
    })],

  /* No active cycle. VotingCard renders its "coming soon" branch for this,
   * which is a state worth seeing, and it avoids inventing a cycle shape. */
  ['GET', /^\/voting\/active$/, () => ok(null)],

  ['GET', /^\/donations\/(pool|impact|current)/, () =>
    ok({ goal: 'TSHIRTS', target: 500, raised: 213, status: 'ACTIVE', season: 1 })],

  ['GET', /^\/drivers\/me/, () => ok({ driverId: 'dev-driver-1', isOnline: false, status: 'offline' })],
  ['GET', /^\/drivers\/orders\/available/, () => page([])],
  ['GET', /^\/drivers\/orders\/active/, () => ok(null)],
  ['GET', /^\/drivers\/earnings/, () =>
    ok({ today: 12, week: 84, month: 320, totalDeliveries: 41, currency: 'TND' })],

  ['GET', /^\/notifications/, () => page([])],
  ['GET', /^\/reviews/, () => page([])],
  /* The manual city search geocodes rather than listing cities. Without this
   * the location modal can never be satisfied on an emulator with no GPS fix,
   * which blocks every authenticated tab behind it. */
  /* `GeocodeResult[]` from packages/shared/src/types/geo.types.ts:145 -
   * `{ coordinates, displayName, address }`. An invented flat shape returned
   * 200 and rendered nothing, which is the quiet failure mode of this whole
   * file: a wrong shape looks like an empty result, not an error. */
  ['POST', /^\/geolocation\/geocode$/, () =>
    ok([
      {
        coordinates: { latitude: 36.8065, longitude: 10.1815 },
        displayName: 'Tunis, Tunisia',
        address: {
          street: '',
          city: 'Tunis',
          state: 'Tunis',
          postalCode: '1000',
          country: 'Tunisia',
          formattedAddress: 'Tunis, Tunisia',
        },
      },
    ])],
  ['GET', /^\/geolocation\/(geozones|cities)/, () =>
    page([{ _id: 'gz-1', name: 'Tunis', deliveryFee: 4, minimumOrder: 5, defaultSearchRadius: 5 }])],
];

/* -------------------------------------------------------------------- server */

const unmatched = new Set();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  // The app is configured with a /api/v1 prefix; strip it for matching.
  const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
  const method = req.method ?? 'GET';

  let body = '';
  req.on('data', c => {
    body += c;
  });
  req.on('end', () => {
    const hit = routes.find(([m, re]) => m === method && re.test(path));
    let payload;

    if (hit) {
      payload = hit[2](path.match(hit[1]), new URL(url.href.replace('/api/v1', '')));
      console.log(`  ${method} ${path} -> ok`);
    } else {
      const key = `${method} ${path}`;
      if (!unmatched.has(key)) {
        unmatched.add(key);
        console.log(`UNMATCHED ${key}${body ? ` body=${body.slice(0, 160)}` : ''}`);
      }
      // An empty collection, not a 404: surfaces the screen's empty state,
      // which is a state worth looking at, rather than a network error.
      payload = method === 'GET' ? page([], 0) : ok({});
    }

    const json = JSON.stringify(payload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev mock API on http://127.0.0.1:${PORT}  (strips /api/v1)`);
  console.log('unmatched routes are logged once each - that list is the to-do');
});
