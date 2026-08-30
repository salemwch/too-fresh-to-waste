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

/**
 * A backend-shaped error envelope.
 *
 * `__status` is stripped by the writer and used as the HTTP status, because
 * this server otherwise answers 200 to everything - which makes failure states
 * unreachable, and failure states are exactly what a verification pass needs to
 * look at. Nothing sets this unless a MOCK_FAIL_* switch is on.
 */
const err = (status, message) => ({
  __status: status,
  status,
  message,
  data: null,
  timestamp: iso(),
});

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

/**
 * Which role this mock serves, and therefore which stack the app routes to.
 *
 *   MOCK_ROLE=driver node tools/dev-mock-api/server.mjs
 *
 * It must match `DEV_AUTH_ROLE` in .env.development, because the seeder writes
 * the stored user and `GET /auth/me` overwrites it a moment later - a mismatch
 * shows as the app flipping stacks on boot.
 *
 * The app's *real* guard does the routing either way: RootNavigator renders
 * DriverStack only when `user.role === UserRole.DRIVER`, and
 * MOBILE_ALLOWED_ROLES gates which roles may use the app at all. Nothing here
 * bypasses either.
 */
const ROLE = process.env.MOCK_ROLE === 'driver' ? 'driver' : 'consumer';

const USER = {
  userId: 'dev-user-000000000001',
  email: `dev.${ROLE}@example.invalid`,
  firstName: 'Dev',
  lastName: ROLE === 'driver' ? 'Driver' : 'Consumer',
  phoneNumber: '+21600000000',
  role: ROLE,
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

/**
 * One LeaderboardEntry (packages/shared/src/types/leaderboard.types.ts).
 * Rank 4 is the signed-in dev user, so the current-user row highlight and the
 * "your position" floating bar both have something real to resolve against.
 */
const CURRENT_USER_RANK = 4;
const leaderboardEntry = rank => ({
  rank,
  userId: rank === CURRENT_USER_RANK ? USER.userId : `other-${rank}`,
  firstName: rank === CURRENT_USER_RANK ? USER.firstName : 'Saver',
  lastName: rank === CURRENT_USER_RANK ? USER.lastName : `No${rank}`,
  profileImage: null,
  currentBadge: null,
  currentBadgeType: null,
  currentTier: rank <= 3 ? 'gold' : rank <= 6 ? 'silver' : 'bronze',
  totalPoints: 900 - (rank - 1) * 70,
  isCurrentUser: rank === CURRENT_USER_RANK,
});

/** The one LoyaltyAccount fixture. Both /loyalty/account and its aliases use it. */
const loyaltyAccount = () => ({
      _id: 'dev-loyalty-0001',
      userId: USER.userId,
      totalPoints: 340,
      availablePoints: 340,
      lifetimePointsEarned: 620,
      totalOrdersCount: 34,
      totalBagsSaved: 34,
      totalAmountSpent: 272,
      // TierName is capitalised. Lowercase 'bronze' matched no TIER_CONFIGS key
      // and threw "Cannot read property 'minPoints' of undefined".
      currentTier: 'Silver',
      badges: [],
      pointsHistory: [],
      referralCount: 2,
      joinedAt: iso(-90 * 864e5),
      lastActivity: iso(-864e5),
      isActive: true,
      loginStreak: { current: 4, longest: 9, lastLoginDate: iso(-864e5) },
      purchaseStreak: { current: 2, longest: 6, lastPurchaseDate: iso(-2 * 864e5) },
      reviewTracking: { totalReviews: 3, lastReviewAt: iso(-5 * 864e5) },
      referralCode: 'DEVCODE',
      leaderboardConsent: { hasConsented: true, isAnonymous: false, decidedAt: iso(-30 * 864e5) },
});

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

/**
 * Proximity search does not return bare offers. It returns
 * `ProximitySearchResult<NearbyOffer>` - `{ item, distance, geoData }` - and
 * `groupOffersByEstablishment` destructures `result.item` with no guard, so a
 * bare-offer fixture threw `iterator method is not callable` and took the whole
 * tab tree into the error boundary.
 *
 * `NearbyOffer` is also flatter than `Offer`: the establishment is three
 * denormalised fields (`establishmentId`, `establishmentName`,
 * `establishmentLogo`), not a populated object.
 *
 * Both shapes from packages/shared/src/types/geo.types.ts:67 and :102.
 */
const nearbyResult = (i) => ({
  item: {
    _id: `dev-offer-${String(i).padStart(4, '0')}`,
    title: ['Surprise Bag', 'Pastry Box', 'Sandwich Deal', 'Veggie Basket'][i % 4],
    description: 'A mixed selection of what is left at the end of the day.',
    establishmentId: ESTABLISHMENT._id,
    establishmentName: ESTABLISHMENT.name,
    establishmentLogo: null,
    pricing: { originalPrice: 24, discountedPrice: 8, discountPercentage: 67, currency: 'TND' },
    availableFrom: iso(-3600e3),
    availableUntil: iso(6 * 3600e3),
    availableQuantity: 3,
    categories: ['bakery'],
    images: [],
  },
  distance: { meters: 1200 + i * 400, kilometers: 1.2 + i * 0.4, formatted: `${(1.2 + i * 0.4).toFixed(1)} km` },
  geoData: { coordinates: { latitude: 36.8065 + i * 0.002, longitude: 10.1815 + i * 0.002 } },
});

const NEARBY_RESULTS = Array.from({ length: 6 }, (_, i) => nearbyResult(i));

const ORDERS = [
  order(0, 'confirmed'),
  order(1, 'ready_for_pickup'),
  order(2, 'out_for_delivery', 'delivery'),
  order(3, 'picked_up'),
  order(4, 'cancelled'),
];


/* ------------------------------------------------------------ driver fixtures */

/** Shapes from features/driver/services/driver.service.ts (27, 77, 86). */
const driverOrder = (i, status, over = {}) => ({
  _id: `dev-dorder-${String(i).padStart(4, '0')}`,
  orderNumber: `TFW-D${2000 + i}`,
  customerId: {
    _id: 'dev-customer-0001',
    firstName: 'Amel',
    lastName: 'Ben Salah',
    phoneNumber: '+21611111111',
  },
  establishmentId: ESTABLISHMENT,
  driverId: status === 'pending' ? null : DRIVER_PROFILE.userId,
  deliveryFee: 4,
  driverEarnings: 3,
  deliveryMode: 'delivery',
  status,
  items: [{ offerId: 'dev-offer-0000', offerTitle: 'Surprise Bag', quantity: 1, unitPrice: 8, totalPrice: 8 }],
  deliveryAddress: {
    street: '24 Avenue Habib Bourguiba',
    city: 'Tunis',
    postalCode: '1000',
    coordinates: { latitude: 36.8008, longitude: 10.1817 },
  },
  establishmentAddress: {
    street: '12 Rue du Lac',
    city: 'Tunis',
    coordinates: { latitude: 36.8333, longitude: 10.2333 },
  },
  collectionStartTime: iso(1800e3),
  collectionEndTime: iso(5400e3),
  expiresAt: iso(6 * 3600e3),
  totalAmount: 12,
  paymentDetails: { method: 'cash', amount: 12 },
  createdAt: iso(-1800e3),
  updatedAt: iso(),
  ...over,
});

const DRIVER_PROFILE = {
  _id: 'dev-driver-0001',
  userId: 'dev-user-000000000001',
  idCardNumber: '00000000',
  address: 'Tunis, Tunisia',
  isOnline: true,
  lastOnlineAt: iso(-600e3),
};

const AVAILABLE_ORDERS = [driverOrder(0, 'confirmed'), driverOrder(1, 'confirmed')];
const ACTIVE_ORDER = driverOrder(2, 'driver_assigned', {
  driverAssignedAt: iso(-900e3),
});
const DRIVER_HISTORY = [driverOrder(3, 'delivered', { deliveredAt: iso(-864e5) })];

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

  /* Search runs on proximity search, not /offers. These are POSTs, which the
   * catch-all used to answer with `{}` - an object, and SearchScreen spreads
   * the result, so it threw `iterator method is not callable` and took the
   * whole tab tree into the QueryErrorBoundary. */
  ['POST', /^\/proximity-search\/offers$/, () => page(NEARBY_RESULTS)],
  ['POST', /^\/proximity-search\/establishments$/, () => page([ESTABLISHMENT])],
  /* ProximitySearchResult<MapEstablishment> - wrapped, and MapEstablishment has
   * its own flat shape (geo.types.ts:128). A bare establishment here threw
   * "Cannot read property '_id' of undefined" from SearchScreen and put a
   * LogBox toast over the tab bar, which is what made navigation taps vanish. */
  ['POST', /^\/proximity-search\/map-establishments$/, () =>
    page([
      {
        item: {
          _id: ESTABLISHMENT._id,
          name: ESTABLISHMENT.name,
          type: 'bakery',
          profileImage: null,
          coordinates: { latitude: 36.8333, longitude: 10.2333 },
          address: {
            street: '12 Rue du Lac',
            city: 'Tunis',
            state: 'Tunis',
            postalCode: '1000',
            country: 'Tunisia',
            formattedAddress: '12 Rue du Lac, Tunis',
          },
          averageRating: 4.6,
          totalReviews: 128,
          isVerified: true,
          activeOfferCount: 3,
          offers: [
            {
              _id: 'dev-offer-0000',
              title: 'Surprise Bag',
              description: 'End of day selection.',
              pricing: { originalPrice: 24, discountedPrice: 8, discountPercentage: 67, currency: 'TND' },
              availableFrom: iso(-3600e3),
              availableUntil: iso(6 * 3600e3),
            },
          ],
        },
        distance: { meters: 1200, kilometers: 1.2, formatted: '1.2 km' },
        geoData: { coordinates: { latitude: 36.8333, longitude: 10.2333 } },
      },
    ])],
  ['GET', /^\/proximity-search\/quick-search/, () => page(NEARBY_RESULTS)],

  ['GET', /^\/establishments\/?$/, () => page([ESTABLISHMENT])],
  ['GET', /^\/establishments\/[^/]+$/, () => ok(ESTABLISHMENT)],

  /* MOCK_FAIL_ORDER=1 makes checkout fail with a realistic business error
   * (409, the offer sold out between opening it and confirming) so the failure
   * state can be verified. Default off, so the success path is unchanged. */
  ['POST', /^\/orders\/?$/, () =>
    process.env.MOCK_FAIL_ORDER === '1'
      ? err(409, 'This offer has just sold out.')
      : ok(ORDERS[0])],
  ['POST', /^\/orders\/[^/]+\/retry-payment$/, () => ok({ payUrl: 'https://example.invalid/pay' })],
  ['GET', /^\/notifications\/preferences$/, () =>
    ok({ pushEnabled: true, favoriteStoreOffers: true, orderUpdates: true, marketing: false })],
  ['PUT', /^\/notifications\/preferences$/, () => ok({ updated: true })],
  ['PATCH', /^\/notifications\/preferences$/, () => ok({ updated: true })],
  ['GET', /^\/orders\/?$/, () => page(ORDERS)],
  /* The real endpoint the Orders tab calls. Without it this fell through to
   * the `/orders/:id` rule below and returned a single object, which the list
   * read as no orders - so the tab showed its empty state and looked correct
   * while proving nothing about OrderCard. Found in the mock's request log. */
  ['GET', /^\/orders\/my-orders/, () => page(ORDERS)],
  ['GET', /^\/orders\/[^/]+$/, (m, url) => {
    const id = url.pathname.split('/').pop();
    return ok(ORDERS.find(o => o._id === id) ?? ORDERS[0]);
  }],

  /* `{ ids }`, not a bare array - `getFavoriteIds` unwraps to
   * `{ ids: string[] }`. Returning the array directly made the unwrap yield
   * undefined, which TanStack Query reports as "data is undefined" and LogBox
   * then renders over the tab bar, swallowing every navigation tap. */
  ['GET', /^\/favorites\/ids$/, () => ok({ ids: [OFFERS[0].id, OFFERS[3].id] })],
  ['GET', /^\/favorites\/stats$/, () => ok({ offers: 2, establishments: 1, total: 3 })],
  /* A populated favourites list.
   *
   * `FavoritesResponse` is an object with its own envelope, not the bare array
   * `page()` produces, and `favoritesService` unwraps it by shape-sniffing.
   * An earlier wrapped-offer draft fed `undefined` into `OfferCard`, which reads
   * `offer.pricing.discountedPrice` with no optional chaining, and took the
   * whole tree into the QueryErrorBoundary - hence the shape below is the real
   * one rather than a guess.
   *
   * `itemId` is the populated offer object (FavoriteOffer). FavoritesScreen
   * accepts it through `isOfferDocument`: id, title, pricing, images[]. The
   * offer() fixture already satisfies that - it is the same object Home renders
   * through OfferCard.
   *
   * The third entry keeps `itemId` as a bare string on purpose. That is what a
   * favourite whose offer has since been deleted looks like, and it is the only
   * way to exercise the DeletedOfferCard branch. The ids match /favorites/ids,
   * which previously claimed two favourites while this route returned none. */
  ['GET', /^\/favorites/, () => {
    const fav = (n, itemId) => ({
      _id: `dev-fav-000${n}`,
      userId: USER.userId,
      type: 'offer',
      itemId,
      preferences: { notifications: true, pushNotifications: true, emailAlerts: false },
      addedAt: iso(-n * 864e5),
      notificationCount: 0,
      interactionCount: n,
      isActive: true,
      createdAt: iso(-n * 864e5),
      updatedAt: iso(-n * 864e5),
    });
    const favorites = [fav(1, OFFERS[0]), fav(2, OFFERS[3]), fav(3, 'dev-offer-deleted')];
    return ok({
      favorites,
      total: favorites.length,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
  }],

  /* Shapes from packages/shared/src/types/loyalty.types.ts:61 and :88. Both
   * were surfacing in the UNMATCHED log and left Loyalty and Leaderboard
   * stuck on their skeletons. */
  ['GET', /^\/loyalty\/account$/, () => ok(loyaltyAccount())],

  /*
   * Shape is GamificationStats from packages/shared/src/types/loyalty.types.ts.
   * loginStreak, purchaseStreak and reviews were missing, so StreakCard threw
   * "Cannot read property 'pointsEarnedThisMonth' of undefined" and took the
   * Loyalty screen into the error boundary. All three are required by the
   * contract; the partial fixture was the bug.
   */
  ['GET', /^\/loyalty\/gamification$/, () =>
    ok({
      referralCode: 'DEVCODE',
      friendReferrals: { pending: 1, completed: 2, pointsReward: 50, pendingDetails: [] },
      businessReferrals: { pending: 0, completed: 0, pointsReward: 100, pendingDetails: [] },
      loginStreak: {
        currentStreak: 4,
        pointsEarnedThisMonth: 40,
        maxPointsPerMonth: 100,
        daysRequired: 7,
        longestStreak: 9,
      },
      purchaseStreak: {
        bagsThisPeriod: 2,
        bagsRequired: 3,
        daysRemaining: 5,
        completedThisMonth: false,
        totalStreaksCompleted: 3,
      },
      reviews: {
        totalReviews: 3,
        totalPointsFromReviews: 45,
        pointsPerReview: 15,
        minWordsRequired: 10,
      },
    })],

  /* Aliases for the same account. One object, so the two can never drift. */
  /* Aliases for the same account object, so the two can never drift apart. */
  ['GET', /^\/loyalty\/(me|summary|points)$/, () => ok(loyaltyAccount())],
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
  /*
   * Shape is LeaderboardResponse from packages/shared/src/types, NOT a bare
   * paginated array. The previous fixture returned page([...]), so
   * unwrapBackendResponse handed the screen an array, and the screen's
   * data.pages.flatMap(p => p.entries) then produced [undefined]. FlashList
   * threw "Cannot read property 'toString' of undefined" inside
   * ProgressiveListView, which is why Leaderboard never rendered past its
   * skeleton. Item fields are LeaderboardEntry too - firstName/lastName/
   * totalPoints/currentTier, not the invented displayName/points/bagsSaved.
   *
   * The two specific routes must stay above the catch-all: the generic pattern
   * is a prefix match and would otherwise swallow both.
   */
  ['GET', /^\/loyalty\/leaderboard\/neighborhood$/, () => {
    const anchor = CURRENT_USER_RANK;
    return ok({
      entries: Array.from({ length: 5 }, (_, i) => ({
        ...leaderboardEntry(anchor - 2 + i),
        isAnchor: anchor - 2 + i === anchor,
      })),
      anchorRank: anchor,
      total: 128,
    });
  }],

  ['GET', /^\/loyalty\/leaderboard\/champion$/, () => ok(leaderboardEntry(1))],

  ['GET', /^\/loyalty\/leaderboard/, () => {
    const entries = Array.from({ length: 8 }, (_, i) => leaderboardEntry(i + 1));
    return ok({
      entries,
      currentUserEntry: entries.find(e => e.isCurrentUser) ?? null,
      total: 128,
      hasMore: true,
      hasSetConsent: true,
    });
  }],

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

  ['GET', /^\/drivers\/me$/, () => ok(DRIVER_PROFILE)],
  ['GET', /^\/drivers\/orders\/available/, () => page(AVAILABLE_ORDERS)],
  /* `MOCK_DRIVER_IDLE=1` reports no active delivery.
   *
   * DriverOrdersListScreen hides the available-orders list while a delivery is
   * in progress, so DriverOrderDetailScreen - which is only reachable by
   * tapping an available order - cannot be opened otherwise. Both states are
   * worth seeing, and this switches between them without editing fixtures. */
  ['GET', /^\/drivers\/orders\/active/, () =>
    ok(process.env.MOCK_DRIVER_IDLE === '1' ? null : ACTIVE_ORDER)],
  ['GET', /^\/drivers\/orders\/history/, () =>
    ok({ orders: DRIVER_HISTORY, total: DRIVER_HISTORY.length, page: 1, limit: 20 })],
  /* DriverEarningsSummary - the field names are today/thisWeek/thisMonth/allTime,
   * not today/week/month. A wrong key renders a blank figure rather than an
   * error, which is the quiet failure this file keeps producing. */
  ['GET', /^\/drivers\/earnings/, () =>
    ok({
      today: 12,
      thisWeek: 84,
      thisMonth: 320,
      allTime: 1240,
      deliveriesToday: 4,
      deliveriesAllTime: 412,
      currency: 'TND',
    })],
  ['PATCH', /^\/drivers\/status/, () => ok({ ...DRIVER_PROFILE, isOnline: true })],
  ['POST', /^\/drivers\/status/, () => ok({ ...DRIVER_PROFILE, isOnline: true })],
  ['POST', /^\/drivers\/location/, () => ok({ updated: true })],
  ['PATCH', /^\/drivers\/orders\/[^/]+\/(accept|pickup|deliver|unassign)$/, () =>
    ok(ACTIVE_ORDER)],
  ['POST', /^\/drivers\/orders\/[^/]+\/(accept|pickup|deliver|unassign)$/, () =>
    ok(ACTIVE_ORDER)],

  ['GET', /^\/notifications/, () => page([])],
  /* The establishment review summary is an object, not a list.
   * `ReviewSummarySection` reads `summary.averageRating.toFixed(1)` with no
   * guard, so the empty page this used to fall through to red-screened Offer
   * Details. Same unguarded-read class as DL-10. */
  ['GET', /^\/reviews\/establishment\/[^/]+\/summary$/, () =>
    ok({
      averageRating: 4.6,
      totalReviews: 128,
      ratingBreakdown: { 5: 80, 4: 30, 3: 10, 2: 5, 1: 3 },
    })],
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
      /* An empty collection, not a 404: surfaces the screen's empty state,
       * which is a state worth looking at, rather than a network error.
       *
       * An empty *list* for every method, including POST. This used to return
       * `{}` for non-GET and that was actively harmful: screens spread the
       * result, and a bare object is not iterable, so an unmatched POST threw
       * `iterator method is not callable` and tripped the error boundary for
       * the entire tab tree - far noisier than the empty state this default
       * exists to produce. A list degrades quietly; an object does not. */
      payload = page([], 0);
    }

    const httpStatus = payload?.__status ?? 200;
    if (payload && '__status' in payload) delete payload.__status;

    const json = JSON.stringify(payload);
    res.writeHead(httpStatus, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(json),
    });
    res.end(json);
  });
});

/**
 * A real socket.io endpoint, not a stub.
 *
 * The app opens a socket for order notifications. Without a server the client
 * retries forever, and each attempt logs `[SocketService] Connection error` -
 * eleven of them during one boot in the last pass. Those are warnings rather
 * than errors, but LogBox renders over `[0,1208][720,1280]`, which is exactly
 * the tab bar, so anything it shows makes navigation taps land on
 * "Dismiss"/"Minimize" instead of a tab.
 *
 * Attaching the real server is the honest fix: the warnings disappear because
 * the connection succeeds, not because anything was silenced. socket.io is
 * already in the workspace (the backend depends on it), so this adds no
 * dependency.
 *
 * If it ever cannot be loaded, the mock still serves HTTP - the socket is a
 * convenience for the verification rig, not a requirement of it.
 */
try {
  const { Server } = await import('socket.io');
  const io = new Server(server, { cors: { origin: '*' }, path: '/socket.io/' });
  io.on('connection', socket => {
    console.log(`  socket connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`  socket disconnected: ${socket.id}`));
  });
  console.log('socket.io attached');
} catch (error) {
  console.log(`socket.io not attached (${error.message}) - HTTP mock still serving`);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev mock API on http://127.0.0.1:${PORT}  (strips /api/v1)`);
  console.log('unmatched routes are logged once each - that list is the to-do');
});
