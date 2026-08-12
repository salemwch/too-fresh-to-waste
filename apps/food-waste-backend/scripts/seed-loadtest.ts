/**
 * Load-test fixture seeding.
 *
 *   pnpm --filter @foodwaste/backend seed:loadtest
 *   pnpm --filter @foodwaste/backend seed:loadtest -- --scarce-only
 *   pnpm --filter @foodwaste/backend seed:loadtest -- --teardown
 *
 * Fixtures are identified by their email domain (`@loadtest.local`) and by
 * ownership, never by an extra field on the documents. Mongoose strict mode
 * silently discards properties a schema does not declare, so a `loadTestRunId`
 * would have to be added to five production schemas to survive a write — test
 * scaffolding does not belong in the domain model, and a field that looks
 * persisted but is not is worse than no field at all.
 *
 * Everything here is idempotent: re-running upserts rather than accumulating,
 * so a nightly staging run does not add another 200 consumers each night.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { UserRole, UserStatus, OfferStatus } from '@foodwaste/shared';
import type { Model, Types } from 'mongoose';

import { AppModule } from '../src/app.module';
import { DonationPool, DonationPoolStatus } from '../src/donations/schemas/donation-pool.schema';
import { Establishment } from '../src/establishments/schemas/establishment.schema';
import { Offer } from '../src/offers/schemas/offer.schema';
import { OrdersService } from '../src/orders/order.service';
import { Order } from '../src/orders/schemas/order.schema';
import { KonnectOrderService } from '../src/payments/services/konnect-order.service';
import { User } from '../src/users/schemas/user.schema';
import { UsersService } from '../src/users/user.service';

const LOADTEST_DOMAIN = '@loadtest.local';
const PASSWORD = process.env['SEED_PASSWORD'] ?? 'K6LoadTest!2026';

const COUNTS = {
  consumers: Number.parseInt(process.env['SEED_CONSUMERS'] ?? '200', 10),
  merchants: Number.parseInt(process.env['SEED_MERCHANTS'] ?? '20', 10),
  drivers: Number.parseInt(process.env['SEED_DRIVERS'] ?? '10', 10),
  bulkOffers: Number.parseInt(process.env['SEED_BULK_OFFERS'] ?? '500', 10),
  scarceOffers: Number.parseInt(process.env['SEED_SCARCE_OFFERS'] ?? '50', 10),
};

const TUNIS = { latitude: 36.8065, longitude: 10.1815 };

/** Schema caps totalQuantity at 1000. High enough that browse and checkout
 * journeys never exhaust supply mid-run — an empty offer list would read as a
 * latency improvement while actually being a missing workload. */
const BULK_OFFER_QUANTITY = 1000;

/**
 * Hosts this script is allowed to write to. It creates hundreds of users and
 * `--teardown` bulk-deletes them, so "be careful" is not a control. Fails
 * closed: an unrecognised host is refused rather than assumed safe.
 */
const ALLOWED_HOST_PATTERNS = [/^localhost$/, /^127\.0\.0\.1$/, /^mongodb$/, /staging/i];

function assertSafeTarget(uri: string): void {
  if (process.env['ALLOW_LOADTEST_SEED'] !== 'true') {
    throw new Error(
      'Refusing to seed: set ALLOW_LOADTEST_SEED=true to confirm this is not production.',
    );
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('Refusing to seed: NODE_ENV=production.');
  }

  // Strip credentials before parsing so a password containing '@' cannot shift
  // which segment reads as the host.
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
  const hostPart = withoutScheme.slice(withoutScheme.lastIndexOf('@') + 1);
  const host = (hostPart.split(/[/,?]/)[0] ?? '').split(':')[0] ?? '';

  if (!ALLOWED_HOST_PATTERNS.some(pattern => pattern.test(host))) {
    throw new Error(
      `Refusing to seed: host "${host}" is not in the load-test allowlist. ` +
        'Add it to ALLOWED_HOST_PATTERNS only if it is genuinely disposable.',
    );
  }
}

const consumerEmail = (i: number): string => `k6-consumer-${i}${LOADTEST_DOMAIN}`;
const merchantEmail = (i: number): string => `k6-merchant-${i}${LOADTEST_DOMAIN}`;
const driverEmail = (i: number): string => `k6-driver-${i}${LOADTEST_DOMAIN}`;

/** Spread across roughly 10 km so /offers/nearby returns varied result sets. */
function jitteredLocation(index: number): { latitude: number; longitude: number } {
  const angle = (index * 137.508 * Math.PI) / 180; // golden angle, avoids clustering
  const radius = 0.005 + (index % 17) * 0.0035;
  return {
    latitude: TUNIS.latitude + Math.sin(angle) * radius,
    longitude: TUNIS.longitude + Math.cos(angle) * radius,
  };
}

/**
 * Distinct Tunisian mobile number per fixture. Order creation rejects a
 * customer without one, so every seeded consumer needs a unique, valid number
 * or checkout fails at the first item.
 */
function seededPhone(role: UserRole, index: number): string {
  const roleOffset = role === UserRole.CONSUMER ? 0 : role === UserRole.MERCHANT ? 1000 : 2000;
  return `+2169${String(1000000 + roleOffset + index).slice(-7)}`;
}

async function upsertUser(
  usersService: UsersService,
  userModel: Model<User>,
  email: string,
  role: UserRole,
  firstName: string,
  index: number,
): Promise<Types.ObjectId> {
  const existing = await usersService.findByEmail(email);
  if (existing) {
    // Re-assert the fields a fixture needs rather than trusting whatever a
    // previous run left behind. Idempotent means "converges on the right
    // state", not "skips if the row exists" — a user seeded before this script
    // required phones would otherwise fail every checkout, silently.
    await userModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          isPhoneVerified: true,
          phoneNumber: seededPhone(role, index),
        },
      },
    );
    return existing._id as Types.ObjectId;
  }

  const created = await usersService.create({
    email,
    password: PASSWORD,
    firstName,
    lastName: 'LoadTest',
    role,
  });
  // CreateUserDto carries no phone — registration collects it separately — so
  // it is written directly below alongside the verification flags.

  // Fixtures must be usable immediately: a PENDING, unverified account cannot
  // log in, so every seeded user would fail at the token-pool stage. The phone
  // is marked verified for the same reason — order creation checks for one.
  await userModel.updateOne(
    { _id: created._id },
    {
      $set: {
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        isPhoneVerified: true,
        phoneNumber: seededPhone(role, index),
      },
    },
  );

  return created._id as Types.ObjectId;
}

interface SeedContext {
  userModel: Model<User>;
  establishmentModel: Model<Establishment>;
  offerModel: Model<Offer>;
  orderModel: Model<Order>;
  poolModel: Model<DonationPool>;
  usersService: UsersService;
  orderService: OrdersService;
  konnectOrdersService: KonnectOrderService;
}

/** How many distinct paid orders the rotation scenario needs. */
const COMPLETION_ORDERS = Number.parseInt(process.env['SEED_COMPLETION_ORDERS'] ?? '10', 10);

async function seedActors(ctx: SeedContext): Promise<{
  consumers: Types.ObjectId[];
  merchants: Types.ObjectId[];
  drivers: Types.ObjectId[];
}> {
  const consumers: Types.ObjectId[] = [];
  const merchants: Types.ObjectId[] = [];
  const drivers: Types.ObjectId[] = [];

  for (let i = 0; i < COUNTS.consumers; i++) {
    consumers.push(
      await upsertUser(
        ctx.usersService,
        ctx.userModel,
        consumerEmail(i),
        UserRole.CONSUMER,
        'K6',
        i,
      ),
    );
  }
  for (let i = 0; i < COUNTS.merchants; i++) {
    merchants.push(
      await upsertUser(
        ctx.usersService,
        ctx.userModel,
        merchantEmail(i),
        UserRole.MERCHANT,
        'K6M',
        i,
      ),
    );
  }
  for (let i = 0; i < COUNTS.drivers; i++) {
    drivers.push(
      await upsertUser(ctx.usersService, ctx.userModel, driverEmail(i), UserRole.DRIVER, 'K6D', i),
    );
  }

  return { consumers, merchants, drivers };
}

async function seedEstablishments(
  ctx: SeedContext,
  merchants: Types.ObjectId[],
): Promise<Types.ObjectId[]> {
  const ids: Types.ObjectId[] = [];

  for (const [index, ownerId] of merchants.entries()) {
    const name = `K6 Load Test Kitchen ${index}`;
    const { latitude, longitude } = jitteredLocation(index);

    const doc = await ctx.establishmentModel.findOneAndUpdate(
      { ownerId, name },
      {
        $setOnInsert: {
          ownerId,
          name,
          description: 'Synthetic establishment created by the load-test seed.',
          type: 'restaurant',
          status: 'active',
          isActive: true,
          isVerified: true,
          address: {
            street: `${index} Avenue Habib Bourguiba`,
            city: 'Tunis',
            state: 'Tunis',
            postalCode: '1000',
            country: 'Tunisia',
            coordinates: { type: 'Point', coordinates: [longitude, latitude] },
          },
        },
      },
      // Same reasoning as the offer upsert: without runValidators a malformed
      // establishment writes silently and only shows up later as offers that
      // never appear in a geo query.
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    ids.push(doc._id as Types.ObjectId);
  }

  return ids;
}

/** Slots must match exactly: stock reservation $elemMatches startTime/endTime. */
const PICKUP_SLOTS = [
  { startTime: '17:00', endTime: '19:00', maxOrders: 100000, currentOrders: 0 },
  { startTime: '19:00', endTime: '21:00', maxOrders: 100000, currentOrders: 0 },
];

function offerPayload(
  establishmentId: Types.ObjectId,
  merchantId: Types.ObjectId,
  title: string,
  totalQuantity: number,
) {
  const now = new Date();
  return {
    title,
    description: 'Synthetic offer created by the load-test seed.',
    establishmentId,
    merchantId,
    type: 'surprise_bag',
    status: OfferStatus.ACTIVE,
    isActive: true,
    totalQuantity,
    reservedQuantity: 0,
    soldQuantity: 0,
    // The schema validates that discountPercentage is exactly the rounded
    // saving and lands between 40 and 90, so these three move together:
    // (20 - 7) / 20 = 65%.
    pricing: {
      originalPrice: 20,
      discountedPrice: 7,
      discountPercentage: 65,
      currency: 'TND',
    },
    categories: ['mixed'],
    availableFrom: now,
    // Long enough that a 2-hour soak never expires its own fixtures.
    availableUntil: new Date(now.getTime() + 12 * 60 * 60 * 1000),
    pickupTimeSlots: PICKUP_SLOTS,
  };
}

async function seedBulkOffers(
  ctx: SeedContext,
  establishments: Types.ObjectId[],
  merchants: Types.ObjectId[],
): Promise<void> {
  for (let i = 0; i < COUNTS.bulkOffers; i++) {
    const slot = i % establishments.length;
    const establishmentId = establishments[slot] as Types.ObjectId;
    const merchantId = merchants[slot] as Types.ObjectId;
    const title = `K6 Bulk Offer ${i}`;

    await ctx.offerModel.findOneAndUpdate(
      { merchantId, title },
      {
        // Browsing journeys must never exhaust supply and start returning empty
        // pages half way through a run — that would look like a latency
        // improvement while actually being a missing workload.
        $set: offerPayload(establishmentId, merchantId, title, BULK_OFFER_QUANTITY),
      },
      // runValidators is off by default on findOneAndUpdate, which means a
      // malformed fixture writes silently and only surfaces later as an
      // inexplicable empty offer list. A seed that lies is worse than one that
      // fails.
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }
}

/**
 * Single-unit offers for the last-bag concurrency scenario. Recreated on every
 * run because each run consumes one.
 */
async function seedScarceOffers(
  ctx: SeedContext,
  establishments: Types.ObjectId[],
  merchants: Types.ObjectId[],
): Promise<{ id: string; establishmentId: string; slotStart: string; slotEnd: string }> {
  const establishmentId = establishments[0] as Types.ObjectId;
  const merchantId = merchants[0] as Types.ObjectId;

  await ctx.offerModel.deleteMany({ merchantId, title: /^K6 Scarce Offer/ });

  const created = [];
  for (let i = 0; i < COUNTS.scarceOffers; i++) {
    created.push(
      await ctx.offerModel.create(
        offerPayload(establishmentId, merchantId, `K6 Scarce Offer ${i}`, 1),
      ),
    );
  }

  const first = created[0];
  const slot = PICKUP_SLOTS[0];
  if (!first || !slot) {
    throw new Error('No scarce offer was created.');
  }

  return {
    id: String(first._id),
    establishmentId: String(establishmentId),
    slotStart: slot.startTime,
    slotEnd: slot.endTime,
  };
}

interface OrderFixture {
  id: string;
  pickupCode: string;
}

/**
 * Creates one order through the real service, then initialises its payment the
 * same way the controller does. Going through OrdersService rather than writing
 * documents directly is deliberate: the reservation, the pricing split and the
 * pickup-code generation all live in that transaction, and a hand-built order
 * would test a shape production never produces.
 */
async function createSeededOrder(
  ctx: SeedContext,
  buyer: User & { _id: Types.ObjectId },
  offer: { _id: Types.ObjectId; establishmentId: Types.ObjectId },
): Promise<{
  order: { _id: Types.ObjectId; pickupDetails?: { pickupCode: string } };
  paymentRef: string;
}> {
  const slot = PICKUP_SLOTS[0];
  if (!slot) {
    throw new Error('PICKUP_SLOTS is empty.');
  }

  const order = await ctx.orderService.create(
    {
      items: [{ offerId: String(offer._id), quantity: 1 }],
      establishmentId: String(offer.establishmentId),
      pickupTimeSlot: { startTime: slot.startTime, endTime: slot.endTime },
      pickupDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      // 'online' is what routes the order through Konnect (the stub, here) and
      // therefore what produces a PaymentAttempt for the webhook to settle.
      paymentMethod: 'online',
    } as Parameters<OrdersService['create']>[0],
    String(buyer._id),
  );

  const { paymentRef } = await ctx.konnectOrdersService.initOrderPayment(order, {
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    email: buyer.email,
  });

  return {
    order: order as unknown as { _id: Types.ObjectId; pickupDetails?: { pickupCode: string } },
    paymentRef,
  };
}

/**
 * Settle a seeded order and confirm it actually settled.
 *
 * `handleOrderWebhook` is deliberately forgiving — an attempt it cannot find or
 * verify produces a log line and a silent return, because a payment provider
 * must never be told to retry a callback the system has already handled. That
 * is right for production and wrong for a fixture builder: a seed that reports
 * success while leaving an order unpaid sends the concurrency suite off to test
 * an order that can never be picked up, and the suite then "passes" having
 * exercised nothing.
 *
 * One observed run left exactly one of twelve orders unsettled this way, with
 * no error anywhere. So the result is read back rather than assumed, retried,
 * and made fatal if it still has not settled.
 *
 * Settlement is driven over **HTTP against the running backend**, not by calling
 * handleOrderWebhook in this process. Two reasons, one practical and one
 * principled:
 *
 *   - In-process calls did not work reliably. The service reported "no
 *     PaymentAttempt found" for a reference whose attempt was demonstrably in
 *     the database a moment later, and the seed's own `findById` returned null
 *     for an order it had just created. Whatever the cause, a fixture builder
 *     that cannot read its own writes is not something to build on.
 *   - Konnect calls an HTTP endpoint. Driving the same endpoint exercises the
 *     controller, the guards and the real request path, so the fixtures are
 *     produced the way production produces them.
 *
 * Verification then reads the ORDER rather than the attempt, because pickup
 * confirmation accepts only RESERVED / READY_FOR_PICKUP / CONFIRMED — that is
 * the precondition the suite actually depends on.
 */
async function settleOrFail(
  ctx: SeedContext,
  paymentRef: string,
  orderId: Types.ObjectId,
  label: string,
): Promise<void> {
  const backendUrl = process.env['BACKEND_URL'] ?? 'http://localhost:3000';

  // Back off between attempts. The PaymentAttempt is written by *this* process
  // and read by the *backend* process, and the backend reported "no
  // PaymentAttempt found" for a reference that was provably in the database
  // moments later. Without a delay all three retries fired inside the same
  // second and simply re-observed the same not-yet-visible state, which made a
  // transient lag look like a hard failure.
  const backoffMs = [0, 500, 2000];

  for (let attemptNo = 1; attemptNo <= 3; attemptNo++) {
    const wait = backoffMs[attemptNo - 1] ?? 0;
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }

    const response = await fetch(`${backendUrl}/api/v1/payments/webhook/konnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The app blocks user agents matching /bot|crawler|spider|python|curl|wget/i
        // and bans the IP for five minutes. A default fetch UA is fine, but be
        // explicit so nobody "tidies" this into something that trips it.
        'User-Agent': 'foodwaste-loadtest-seed/1.0',
      },
      body: JSON.stringify({ payment_ref: paymentRef }),
    });

    const order = await ctx.orderModel
      .findById(orderId)
      .select('status paymentStatus')
      .lean<{ status: string; paymentStatus: string } | null>();

    if (order?.paymentStatus === 'paid') {
      return;
    }

    process.stdout.write(
      `  ${label} (${paymentRef}) http=${response.status} ` +
        `payment="${order?.paymentStatus ?? 'missing'}" status="${order?.status ?? '?'}" ` +
        `after attempt ${attemptNo}\n`,
    );
  }

  throw new Error(
    `Could not settle ${label} (${paymentRef}). The concurrency suite needs a ` +
      'settled order here; continuing would produce fixtures that silently test nothing.',
  );
}

/**
 * Fixtures for the concurrency scenarios.
 *
 *   webhookOrder      - paid-pending; scenario 2 replays its callback
 *   pickupOrder       - settled and RESERVED; scenario 3 confirms it repeatedly
 *   completionOrders  - N settled orders, each confirmed once, concurrently
 *
 * The last set exists because duplicate-confirming a *single* order cannot test
 * donation rotation: once the idempotency guard works, only one confirmation
 * succeeds, so only one donation is written and nothing races. Rotation needs
 * concurrent contributions from distinct orders, which is what these provide.
 */
async function seedConcurrencyFixtures(ctx: SeedContext): Promise<{
  buyerEmail: string;
  paymentRef: string;
  pickupOrder: OrderFixture;
  completionOrders: OrderFixture[];
}> {
  const buyer = await ctx.userModel.findOne({ email: consumerEmail(0) }).lean();
  if (!buyer) {
    throw new Error('Consumer 0 is missing — run the full seed first.');
  }

  const offers = await ctx.offerModel
    .find({ title: /^K6 Bulk Offer/ })
    .select('_id establishmentId')
    .limit(COMPLETION_ORDERS + 2)
    .lean();

  if (offers.length < COMPLETION_ORDERS + 2) {
    throw new Error(`Need ${COMPLETION_ORDERS + 2} bulk offers, found ${offers.length}.`);
  }

  const typedBuyer = buyer as unknown as User & { _id: Types.ObjectId };
  const pick = (i: number) =>
    offers[i] as unknown as { _id: Types.ObjectId; establishmentId: Types.ObjectId };

  // Scenario 2: left deliberately unsettled so the duplicate deliveries race
  // for the pending -> processing claim.
  const webhook = await createSeededOrder(ctx, typedBuyer, pick(0));

  // Scenario 3: settled once here, so the concurrent confirmations in the suite
  // start from a genuinely pickup-ready order (RESERVED).
  const pickup = await createSeededOrder(ctx, typedBuyer, pick(1));
  await settleOrFail(ctx, pickup.paymentRef, pickup.order._id, 'pickup order');

  const completionOrders: OrderFixture[] = [];
  for (let i = 0; i < COMPLETION_ORDERS; i++) {
    const created = await createSeededOrder(ctx, typedBuyer, pick(i + 2));
    await settleOrFail(ctx, created.paymentRef, created.order._id, `completion order ${i}`);
    completionOrders.push({
      id: String(created.order._id),
      pickupCode: created.order.pickupDetails?.pickupCode ?? '',
    });
  }

  // Park the active pool just short of its target so a single completion tips
  // it over. Without this the rotation branch is never reached and scenario 5
  // silently tests nothing.
  const pool = await ctx.poolModel.findOne({
    status: DonationPoolStatus.ACTIVE,
    isArchived: false,
  });
  if (pool) {
    await ctx.poolModel.updateOne(
      { _id: pool._id },
      { $set: { currentAmount: Math.max(0, pool.targetAmount - 0.05) } },
    );
  }

  return {
    buyerEmail: consumerEmail(0),
    paymentRef: webhook.paymentRef,
    pickupOrder: {
      id: String(pickup.order._id),
      pickupCode: pickup.order.pickupDetails?.pickupCode ?? '',
    },
    completionOrders,
  };
}

async function teardown(ctx: SeedContext): Promise<void> {
  const users = await ctx.userModel
    .find({ email: new RegExp(`${LOADTEST_DOMAIN.replace('.', '\\.')}$`) })
    .select('_id')
    .lean();
  const userIds = users.map(u => u._id);

  const establishments = await ctx.establishmentModel
    .find({ ownerId: { $in: userIds } })
    .select('_id')
    .lean();

  const offers = await ctx.offerModel.deleteMany({
    establishmentId: { $in: establishments.map(e => e._id) },
  });
  const estabs = await ctx.establishmentModel.deleteMany({ ownerId: { $in: userIds } });
  const removedUsers = await ctx.userModel.deleteMany({ _id: { $in: userIds } });

  process.stdout.write(
    `Teardown removed ${removedUsers.deletedCount} users, ` +
      `${estabs.deletedCount} establishments, ${offers.deletedCount} offers.\n`,
  );
}

async function bootstrap(): Promise<void> {
  const uri = process.env['DATABASE_URL'] ?? process.env['MONGODB_URI'] ?? '';
  assertSafeTarget(uri);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const ctx: SeedContext = {
    userModel: app.get<Model<User>>(getModelToken(User.name)),
    establishmentModel: app.get<Model<Establishment>>(getModelToken(Establishment.name)),
    offerModel: app.get<Model<Offer>>(getModelToken(Offer.name)),
    orderModel: app.get<Model<Order>>(getModelToken(Order.name)),
    poolModel: app.get<Model<DonationPool>>(getModelToken(DonationPool.name)),
    usersService: app.get(UsersService),
    orderService: app.get(OrdersService),
    konnectOrdersService: app.get(KonnectOrderService),
  };

  if (process.env['PAYMENT_PROVIDER'] !== 'stub') {
    // The concurrency fixtures create real payment attempts and settle them
    // through the webhook. Against the real Konnect client that means live API
    // calls with no matching payment, so every settlement silently no-ops and
    // the fixtures come out unusable — with no error to explain why.
    throw new Error(
      'Set PAYMENT_PROVIDER=stub before seeding: fixture creation drives the payment webhook.',
    );
  }

  const args = process.argv.slice(2);

  try {
    if (args.includes('--teardown')) {
      await teardown(ctx);
      return;
    }

    if (args.includes('--scarce-only')) {
      const merchants = await ctx.userModel
        .find({ email: /^k6-merchant-/ })
        .select('_id')
        .lean();
      const establishments = await ctx.establishmentModel
        .find({ ownerId: { $in: merchants.map(m => m._id) } })
        .select('_id')
        .lean();

      if (merchants.length === 0 || establishments.length === 0) {
        throw new Error('Run the full seed before --scarce-only.');
      }

      const scarce = await seedScarceOffers(
        ctx,
        establishments.map(e => e._id as Types.ObjectId),
        merchants.map(m => m._id as Types.ObjectId),
      );
      const concurrency = await seedConcurrencyFixtures(ctx);
      writeFixtures({ scarceOffer: scarce, ...concurrency });
      return;
    }

    process.stdout.write('Seeding load-test actors...\n');
    const actors = await seedActors(ctx);

    process.stdout.write('Seeding establishments...\n');
    const establishments = await seedEstablishments(ctx, actors.merchants);

    process.stdout.write(`Seeding ${COUNTS.bulkOffers} bulk offers...\n`);
    await seedBulkOffers(ctx, establishments, actors.merchants);

    process.stdout.write(`Seeding ${COUNTS.scarceOffers} scarce offers...\n`);
    const scarce = await seedScarceOffers(ctx, establishments, actors.merchants);

    process.stdout.write('Seeding concurrency fixtures (orders, payments, pool)...\n');
    const concurrency = await seedConcurrencyFixtures(ctx);

    writeFixtures({ scarceOffer: scarce, ...concurrency });

    process.stdout.write(
      `Seed complete: ${actors.consumers.length} consumers, ${actors.merchants.length} merchants, ` +
        `${actors.drivers.length} drivers, ${establishments.length} establishments.\n`,
    );
  } finally {
    await app.close();
  }
}

/**
 * k6 reads this at init with open(), which cannot make HTTP calls, so ids that
 * only the seed knows have to be handed over on disk.
 */
function writeFixtures(fixtures: Record<string, unknown>): void {
  const target = resolve(__dirname, '../../../tests/k6/fixtures/concurrency.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    JSON.stringify({ generatedAt: new Date().toISOString(), ...fixtures }, null, 2),
  );
  process.stdout.write(`Fixtures written to ${target}\n`);
}

bootstrap()
  .then(() => {
    // Bull queues and the Redis client keep handles open that app.close() does
    // not drain, so the process would otherwise sit there after finishing its
    // work — indistinguishable from a hang, and fatal in CI.
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`Load-test seed failed: ${(error as Error).message}\n`);
    process.exit(1);
  });
