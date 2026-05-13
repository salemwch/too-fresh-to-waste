# Driver Role MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `DRIVER` role so drivers can see a filtered pool of confirmed
delivery orders on mobile, self-assign atomically, navigate to the customer's
pinned address, and mark orders as delivered.

**Architecture:** Shared enums gain `DRIVER` / `OUT_FOR_DELIVERY` / `DELIVERED`.
The Order schema gains 9 new optional fields (delivery mode, address pin, two
pre-computed Date boundaries, driver ref, financials, reliability counter). A
new `DriversModule` in the backend exposes 4 endpoints guarded by `DRIVER` role.
On mobile, a new `DriverStack` is shown when `user.role === UserRole.DRIVER`.
Customers pick Pickup vs Delivery at order creation and confirm a draggable map
pin; those coordinates are locked on the order and never mutated.

**Tech Stack:** NestJS 11, Mongoose, React Native 0.81,
`react-native-maps@1.27.1`, `react-native-geolocation-service@^5.3.1`, TanStack
Query v5, `@react-navigation/native-stack`

**Spec:** `docs/superpowers/specs/2026-05-13-driver-role-design.md`

---

## File Map

| Action | File                                                                    |
| ------ | ----------------------------------------------------------------------- |
| Modify | `packages/shared/src/enums/user.enum.ts`                                |
| Modify | `packages/shared/src/enums/order.enum.ts`                               |
| Modify | `packages/shared/src/schemas/order.schemas.ts`                          |
| Create | `apps/food-waste-backend/src/common/utils/geo.util.ts`                  |
| Create | `apps/food-waste-backend/src/common/utils/geo.util.spec.ts`             |
| Modify | `apps/food-waste-backend/src/orders/schemas/order.schema.ts`            |
| Modify | `apps/food-waste-backend/src/orders/DTO/create-order.dto.ts`            |
| Modify | `apps/food-waste-backend/src/orders/order.service.ts`                   |
| Create | `apps/food-waste-backend/src/drivers/dto/available-orders-query.dto.ts` |
| Create | `apps/food-waste-backend/src/drivers/dto/unassign-order.dto.ts`         |
| Create | `apps/food-waste-backend/src/drivers/drivers.service.ts`                |
| Create | `apps/food-waste-backend/src/drivers/drivers.service.spec.ts`           |
| Create | `apps/food-waste-backend/src/drivers/drivers.controller.ts`             |
| Create | `apps/food-waste-backend/src/drivers/drivers.module.ts`                 |
| Modify | `apps/food-waste-backend/src/app.module.ts`                             |
| Modify | `apps/mobile/src/navigation/types.ts`                                   |
| Create | `apps/mobile/src/navigation/DriverStack.tsx`                            |
| Modify | `apps/mobile/src/navigation/RootNavigator.tsx`                          |
| Create | `apps/mobile/src/features/driver/services/driver.service.ts`            |
| Create | `apps/mobile/src/features/driver/hooks/useDriverOrders.ts`              |
| Create | `apps/mobile/src/features/driver/screens/DriverOrdersListScreen.tsx`    |
| Create | `apps/mobile/src/features/driver/screens/DriverOrderDetailScreen.tsx`   |
| Create | `apps/mobile/src/features/driver/screens/DriverActiveOrderScreen.tsx`   |
| Modify | `apps/mobile/src/features/orders/screens/CheckoutScreen.tsx`            |

---

## Task 1: Add DRIVER to UserRole and new statuses to OrderStatus

**Files:**

- Modify: `packages/shared/src/enums/user.enum.ts`
- Modify: `packages/shared/src/enums/order.enum.ts`

- [ ] **Step 1: Add DRIVER to UserRole**

  Open `packages/shared/src/enums/user.enum.ts`. Replace the enum body:

  ```ts
  export enum UserRole {
    CONSUMER = 'consumer',
    MERCHANT = 'merchant',
    ADMIN = 'admin',
    MODERATOR = 'moderator',
    DRIVER = 'driver',
  }
  ```

- [ ] **Step 2: Add delivery statuses to OrderStatus**

  Open `packages/shared/src/enums/order.enum.ts`. Append two values at the end
  of the `OrderStatus` enum:

  ```ts
  export enum OrderStatus {
    PENDING = 'pending',
    RESERVED = 'reserved',
    CONFIRMED = 'confirmed',
    READY_FOR_PICKUP = 'ready_for_pickup',
    PICKED_UP = 'picked_up',
    CANCELLED = 'cancelled',
    EXPIRED = 'expired',
    REFUNDED = 'refunded',
    OUT_FOR_DELIVERY = 'out_for_delivery',
    DELIVERED = 'delivered',
  }
  ```

- [ ] **Step 3: Rebuild shared package**

  Run from monorepo root:

  ```bash
  pnpm --filter @foodwaste/shared build
  ```

  Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/shared/src/enums/user.enum.ts packages/shared/src/enums/order.enum.ts
  git commit -m "feat(shared): add DRIVER role and OUT_FOR_DELIVERY/DELIVERED order statuses"
  ```

---

## Task 2: Extend Shared Zod CreateOrderSchema

**Files:**

- Modify: `packages/shared/src/schemas/order.schemas.ts`

- [ ] **Step 1: Add DeliveryAddressSchema and update CreateOrderSchema**

  In `packages/shared/src/schemas/order.schemas.ts`, add after the
  `PickupTimeSlotSchema` block and before `CreateOrderSchema`:

  ```ts
  export const DeliveryAddressSchema = z.object({
    city: z.string().min(1, 'City is required'),
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  });

  export type DeliveryAddressInput = z.infer<typeof DeliveryAddressSchema>;
  ```

  Then update `CreateOrderSchema` — add these two fields inside the
  `z.object({...})` after `pickupInstructions`:

  ```ts
  deliveryMode:    z.enum(['pickup', 'delivery']).default('pickup'),
  deliveryAddress: DeliveryAddressSchema.optional(),
  ```

  Then add a `.refine()` after the closing `})` of `CreateOrderSchema`:

  ```ts
  export const CreateOrderSchema = z
    .object({
      items: z
        .array(OrderItemSchema)
        .min(1, 'Order must contain at least one item'),
      establishmentId: z.string().min(1, 'Establishment ID is required'),
      pickupTimeSlot: PickupTimeSlotSchema,
      pickupDate: z
        .string()
        .datetime({
          message: 'pickupDate must be a valid ISO 8601 date string',
        })
        .refine(val => new Date(val) > new Date(), {
          message: 'Pickup time must be in the future',
        })
        .refine(
          val => {
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 30);
            return new Date(val) <= maxDate;
          },
          { message: 'Cannot book pickup more than 30 days in advance' },
        ),
      customerNotes: z.string().max(500).optional(),
      paymentMethod: z.enum(PAYMENT_METHODS, {
        message:
          'Payment method must be one of: cash_on_pickup, pay_on_delivery, stripe, paypal, apple_pay, google_pay',
      }),
      pickupInstructions: z.string().max(1000).optional(),
      deliveryMode: z.enum(['pickup', 'delivery']).default('pickup'),
      deliveryAddress: DeliveryAddressSchema.optional(),
    })
    .refine(
      data =>
        data.deliveryMode !== 'delivery' || data.deliveryAddress !== undefined,
      {
        message: 'deliveryAddress is required when deliveryMode is delivery',
        path: ['deliveryAddress'],
      },
    );

  export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
  ```

  > **Note:** This replaces the existing `CreateOrderSchema` const — delete the
  > original and replace with the `.refine()` version above.

- [ ] **Step 2: Rebuild shared package**

  ```bash
  pnpm --filter @foodwaste/shared build
  ```

  Expected: exits 0.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/shared/src/schemas/order.schemas.ts
  git commit -m "feat(shared): add deliveryMode and deliveryAddress to CreateOrderSchema"
  ```

---

## Task 3: Haversine Geo Utility (Backend)

**Files:**

- Create: `apps/food-waste-backend/src/common/utils/geo.util.ts`
- Create: `apps/food-waste-backend/src/common/utils/geo.util.spec.ts`

- [ ] **Step 1: Write the failing test**

  Create `apps/food-waste-backend/src/common/utils/geo.util.spec.ts`:

  ```ts
  import { haversineDistanceKm } from './geo.util';

  describe('haversineDistanceKm', () => {
    it('returns 0 for identical coordinates', () => {
      expect(haversineDistanceKm(36.8065, 10.1815, 36.8065, 10.1815)).toBe(0);
    });

    it('calculates Tunis→Sousse distance within ±2 km of 138 km', () => {
      // Tunis (36.8065, 10.1815) to Sousse (35.8254, 10.6360) ≈ 138 km
      const dist = haversineDistanceKm(36.8065, 10.1815, 35.8254, 10.636);
      expect(dist).toBeGreaterThan(136);
      expect(dist).toBeLessThan(140);
    });

    it('is commutative (A→B === B→A)', () => {
      const ab = haversineDistanceKm(36.8065, 10.1815, 35.8254, 10.636);
      const ba = haversineDistanceKm(35.8254, 10.636, 36.8065, 10.1815);
      expect(Math.abs(ab - ba)).toBeLessThan(0.001);
    });
  });
  ```

- [ ] **Step 2: Run test — expect FAIL**

  ```bash
  pnpm --filter @foodwaste/backend test -- --testPathPattern=geo.util.spec --no-coverage
  ```

  Expected: FAIL with "Cannot find module './geo.util'".

- [ ] **Step 3: Implement the utility**

  Create `apps/food-waste-backend/src/common/utils/geo.util.ts`:

  ```ts
  const EARTH_RADIUS_KM = 6371;

  function toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  export function haversineDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  ```

- [ ] **Step 4: Run test — expect PASS**

  ```bash
  pnpm --filter @foodwaste/backend test -- --testPathPattern=geo.util.spec --no-coverage
  ```

  Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/food-waste-backend/src/common/utils/geo.util.ts \
          apps/food-waste-backend/src/common/utils/geo.util.spec.ts
  git commit -m "feat(backend): add haversine geo utility"
  ```

---

## Task 4: Extend Order Schema (9 new fields + 3 new indexes)

**Files:**

- Modify: `apps/food-waste-backend/src/orders/schemas/order.schema.ts`

- [ ] **Step 1: Add new @Prop fields to the Order class**

  In `apps/food-waste-backend/src/orders/schemas/order.schema.ts`, find the last
  `@Prop` before the closing `}` of the `Order` class (the `pickupLockedReason`
  prop). Add the following block **after** it, inside the class:

  ```ts
  // ─────────────────────────────────────────────────────────
  // DELIVERY FIELDS — only populated when deliveryMode === 'delivery'
  // ─────────────────────────────────────────────────────────

  @Prop({ type: String, enum: ['pickup', 'delivery'], default: 'pickup' })
  deliveryMode!: 'pickup' | 'delivery';

  // Written once at order creation. Never mutated after that.
  @Prop({
    type: {
      city:        String,
      coordinates: { lat: Number, lng: Number },
    },
  })
  deliveryAddress?: {
    city: string;
    coordinates: { lat: number; lng: number };
  };

  // Pre-computed from pickupTimeSlot at creation time for efficient index queries.
  // { type: Date } is required because TypeScript union with undefined would
  // cause Mongoose reflect-metadata to emit Object → runtime crash (backend rule #2).
  @Prop({ type: Date })
  collectionStartTime?: Date;

  @Prop({ type: Date })
  collectionEndTime?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  driverId?: Types.ObjectId | null;

  // All financial fields computed at creation and never recalculated.
  @Prop({ type: Number, min: 0 })
  estimatedDistanceKm?: number;

  @Prop({ type: Number, min: 0 })
  deliveryFee?: number;

  @Prop({ type: Number, min: 0 })
  driverEarnings?: number;

  @Prop({ type: Number, min: 0 })
  platformDeliveryCommission?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  driverCancellationCount!: number;
  ```

- [ ] **Step 2: Add the three new indexes**

  At the bottom of `order.schema.ts`, after the existing indexes and before
  `export const OrderSchema`, add:

  ```ts
  // Standalone 2dsphere for $near queries on establishment location.
  // Must be separate from the compound index — MongoDB requires $near to use
  // a dedicated 2dsphere index; a compound index starting with a non-geo field
  // cannot be used for $near.
  // NOTE: distinct from the existing line-435 index which targets the inner
  // .coordinates.coordinates array; this targets the GeoJSON document itself.
  OrderSchema.index(
    { 'establishmentAddress.coordinates': '2dsphere' },
    { sparse: true },
  );

  // Compound index for the driver pool query.
  // collectionEndTime leads — eliminates expired orders first (most selective field).
  OrderSchema.index({
    deliveryMode: 1,
    status: 1,
    driverId: 1,
    collectionEndTime: 1,
    collectionStartTime: 1,
  });

  // Supports driver's own order history and active-order lookups.
  OrderSchema.index({ driverId: 1, status: 1, createdAt: -1 });
  ```

- [ ] **Step 3: Type-check the backend**

  ```bash
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: exits 0. Fix any TypeScript errors before continuing.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/food-waste-backend/src/orders/schemas/order.schema.ts
  git commit -m "feat(backend): add delivery fields and driver pool indexes to Order schema"
  ```

---

## Task 5: Extend CreateOrderDto

**Files:**

- Modify: `apps/food-waste-backend/src/orders/DTO/create-order.dto.ts`

- [ ] **Step 1: Add new DTO classes and fields**

  At the top of `apps/food-waste-backend/src/orders/DTO/create-order.dto.ts`,
  add `IsIn` and `IsNumber` to the class-validator imports:

  ```ts
  import {
    IsNotEmpty,
    IsString,
    IsArray,
    ValidateNested,
    Min,
    Max,
    IsDateString,
    IsOptional,
    IsMongoId,
    Matches,
    ArrayMinSize,
    IsEnum,
    Length,
    IsInt,
    IsIn,
    IsNumber,
    ValidateIf,
  } from 'class-validator';
  ```

  Then add a `DeliveryCoordinatesDto` and `DeliveryAddressDto` class before
  `CreateOrderDto`:

  ```ts
  class DeliveryCoordinatesDto {
    @IsNumber()
    @Min(-90)
    @Max(90)
    lat!: number;

    @IsNumber()
    @Min(-180)
    @Max(180)
    lng!: number;
  }

  class DeliveryAddressDto {
    @IsString()
    @IsNotEmpty()
    city!: string;

    @ValidateNested()
    @Type(() => DeliveryCoordinatesDto)
    coordinates!: DeliveryCoordinatesDto;
  }
  ```

  Then add the following two properties to the `CreateOrderDto` class, after
  `pickupInstructions`:

  ```ts
  @IsOptional()
  @IsIn(['pickup', 'delivery'])
  deliveryMode?: 'pickup' | 'delivery';

  @ValidateIf(o => (o as CreateOrderDto).deliveryMode === 'delivery')
  @IsNotEmpty({ message: 'deliveryAddress is required when deliveryMode is delivery' })
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;
  ```

  Also update the `implements CreateOrderInput` — `CreateOrderInput` now
  includes these fields so the types should align automatically after rebuilding
  shared.

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: exits 0.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/food-waste-backend/src/orders/DTO/create-order.dto.ts
  git commit -m "feat(backend): add deliveryMode and deliveryAddress to CreateOrderDto"
  ```

---

## Task 6: Compute Delivery Fields in OrdersService.create()

**Files:**

- Modify: `apps/food-waste-backend/src/orders/order.service.ts`

- [ ] **Step 1: Import haversineDistanceKm**

  At the top of `apps/food-waste-backend/src/orders/order.service.ts`, add:

  ```ts
  import { haversineDistanceKm } from '../common/utils/geo.util';
  ```

  > Use a relative path — no path aliases in the backend.

- [ ] **Step 2: Add delivery field computation**

  Find the comment `// 5. Calculate pricing` inside `OrdersService.create()`.
  Directly **before** `// 7. Create and save order` (after the pricing block),
  add:

  ```ts
  // 5b. Compute delivery fields (delivery orders only — all values immutable after this point)
  let collectionStartTime: Date | undefined;
  let collectionEndTime: Date | undefined;
  let estimatedDistanceKm: number | undefined;
  let deliveryFee: number | undefined;
  let driverEarnings: number | undefined;
  let platformDeliveryCommission: number | undefined;

  if (
    createOrderDto.deliveryMode === 'delivery' &&
    createOrderDto.deliveryAddress
  ) {
    collectionStartTime = this.buildPickupDate(
      createOrderDto.pickupDate,
      createOrderDto.pickupTimeSlot.startTime,
    );
    collectionEndTime = this.buildPickupDate(
      createOrderDto.pickupDate,
      createOrderDto.pickupTimeSlot.endTime,
    );

    const estCoords = establishment.address?.coordinates?.coordinates;
    if (estCoords && estCoords.length === 2) {
      // GeoJSON stores [longitude, latitude]
      estimatedDistanceKm = haversineDistanceKm(
        estCoords[1]!,
        estCoords[0]!,
        createOrderDto.deliveryAddress.coordinates.lat,
        createOrderDto.deliveryAddress.coordinates.lng,
      );
    } else {
      estimatedDistanceKm = 0;
    }

    const BASE_DELIVERY_FEE = parseFloat(
      this.configService.get('BASE_DELIVERY_FEE', '2.000'),
    );
    const RATE_PER_KM = parseFloat(
      this.configService.get('RATE_PER_KM', '0.500'),
    );
    const DRIVER_CUT_RATIO = parseFloat(
      this.configService.get('DRIVER_CUT_RATIO', '0.80'),
    );

    deliveryFee = parseFloat(
      (BASE_DELIVERY_FEE + estimatedDistanceKm * RATE_PER_KM).toFixed(3),
    );
    driverEarnings = parseFloat((deliveryFee * DRIVER_CUT_RATIO).toFixed(3));
    platformDeliveryCommission = parseFloat(
      (deliveryFee - driverEarnings).toFixed(3),
    );
  }
  ```

- [ ] **Step 3: Pass the new fields to the Order constructor**

  Find `const order = new this.orderModel({` inside `create()`. Add these fields
  inside the object literal, after `donationAmount`:

  ```ts
  ...(createOrderDto.deliveryMode === 'delivery' && createOrderDto.deliveryAddress
    ? {
        deliveryMode:               'delivery',
        deliveryAddress:            createOrderDto.deliveryAddress,
        collectionStartTime,
        collectionEndTime,
        estimatedDistanceKm,
        deliveryFee,
        driverEarnings,
        platformDeliveryCommission,
      }
    : { deliveryMode: 'pickup' }),
  ```

  > The conditional spread `...(condition ? {...} : {...})` avoids assigning
  > `undefined` to optional properties directly, which is required by
  > `exactOptionalPropertyTypes` (mobile rule #7; same discipline applies here
  > for consistency).

- [ ] **Step 4: Type-check**

  ```bash
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: exits 0.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/food-waste-backend/src/orders/order.service.ts
  git commit -m "feat(backend): compute and persist delivery fields on order creation"
  ```

---

## Task 7: Driver DTOs

**Files:**

- Create:
  `apps/food-waste-backend/src/drivers/dto/available-orders-query.dto.ts`
- Create: `apps/food-waste-backend/src/drivers/dto/unassign-order.dto.ts`

- [ ] **Step 1: Create the available-orders query DTO**

  Create
  `apps/food-waste-backend/src/drivers/dto/available-orders-query.dto.ts`:

  ```ts
  import { Type } from 'class-transformer';
  import { IsNumber, IsOptional, Min, Max, IsInt } from 'class-validator';

  export class AvailableOrdersQueryDto {
    @Type(() => Number)
    @IsNumber()
    @Min(-90)
    @Max(90)
    lat!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(-180)
    @Max(180)
    lng!: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;
  }
  ```

- [ ] **Step 2: Create the unassign order DTO**

  Create `apps/food-waste-backend/src/drivers/dto/unassign-order.dto.ts`:

  ```ts
  import { IsOptional, IsString, Length } from 'class-validator';

  export class UnassignOrderDto {
    @IsOptional()
    @IsString()
    @Length(0, 500)
    reason?: string;
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/food-waste-backend/src/drivers/dto/
  git commit -m "feat(backend): add driver DTO classes"
  ```

---

## Task 8: DriversService

**Files:**

- Create: `apps/food-waste-backend/src/drivers/drivers.service.ts`
- Create: `apps/food-waste-backend/src/drivers/drivers.service.spec.ts`

- [ ] **Step 1: Write failing unit tests**

  Create `apps/food-waste-backend/src/drivers/drivers.service.spec.ts`:

  ```ts
  import { ConflictException, NotFoundException } from '@nestjs/common';
  import { getModelToken } from '@nestjs/mongoose';
  import { Test } from '@nestjs/testing';

  import { ConfigService } from '@nestjs/config';
  import { OrderStatus } from '../orders/schemas/order.schema';
  import { Order } from '../orders/schemas/order.schema';
  import { DriversService } from './drivers.service';

  const mockOrder = (overrides = {}) => ({
    _id: 'order-id-1',
    status: OrderStatus.CONFIRMED,
    deliveryMode: 'delivery',
    driverId: null,
    collectionStartTime: new Date(Date.now() - 5 * 60_000),
    collectionEndTime: new Date(Date.now() + 60 * 60_000),
    driverCancellationCount: 0,
    ...overrides,
  });

  describe('DriversService', () => {
    let service: DriversService;
    let findOneAndUpdate: jest.Mock;

    beforeEach(async () => {
      findOneAndUpdate = jest.fn();
      const module = await Test.createTestingModule({
        providers: [
          DriversService,
          {
            provide: getModelToken(Order.name),
            useValue: {
              findOneAndUpdate,
              find: jest.fn().mockReturnValue({ lean: () => [] }),
            },
          },
          {
            provide: ConfigService,
            useValue: { get: jest.fn((key: string, def: string) => def) },
          },
        ],
      }).compile();

      service = module.get(DriversService);
    });

    describe('acceptOrder', () => {
      it('throws ConflictException when order is already taken', async () => {
        findOneAndUpdate.mockResolvedValue(null); // atomic guard returns null = already taken
        await expect(
          service.acceptOrder('order-id-1', 'driver-id-1'),
        ).rejects.toThrow(ConflictException);
      });

      it('returns updated order on successful accept', async () => {
        const order = mockOrder({
          driverId: 'driver-id-1',
          status: OrderStatus.OUT_FOR_DELIVERY,
        });
        findOneAndUpdate.mockResolvedValue(order);
        const result = await service.acceptOrder('order-id-1', 'driver-id-1');
        expect(result.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
      });
    });

    describe('unassignOrder', () => {
      it("throws NotFoundException when order is not found or not this driver's", async () => {
        findOneAndUpdate.mockResolvedValue(null);
        await expect(
          service.unassignOrder('order-id-1', 'driver-id-1', undefined),
        ).rejects.toThrow(NotFoundException);
      });

      it('returns order with status CONFIRMED on successful unassign', async () => {
        const order = mockOrder({
          driverId: null,
          status: OrderStatus.CONFIRMED,
          driverCancellationCount: 1,
        });
        findOneAndUpdate.mockResolvedValue(order);
        const result = await service.unassignOrder(
          'order-id-1',
          'driver-id-1',
          'Bike broke down',
        );
        expect(result.status).toBe(OrderStatus.CONFIRMED);
      });
    });

    describe('markDelivered', () => {
      it('throws NotFoundException when order is not found', async () => {
        findOneAndUpdate.mockResolvedValue(null);
        await expect(
          service.markDelivered('order-id-1', 'driver-id-1'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  pnpm --filter @foodwaste/backend test -- --testPathPattern=drivers.service.spec --no-coverage
  ```

  Expected: FAIL with "Cannot find module './drivers.service'".

- [ ] **Step 3: Implement DriversService**

  Create `apps/food-waste-backend/src/drivers/drivers.service.ts`:

  ```ts
  import {
    Injectable,
    ConflictException,
    NotFoundException,
    Logger,
  } from '@nestjs/common';
  import { ConfigService } from '@nestjs/config';
  import { InjectModel } from '@nestjs/mongoose';
  import { Model, Types } from 'mongoose';

  import {
    Order,
    OrderDocument,
    OrderStatus,
  } from '../orders/schemas/order.schema';
  import { AvailableOrdersQueryDto } from './dto/available-orders-query.dto';

  @Injectable()
  export class DriversService {
    private readonly logger = new Logger(DriversService.name);

    constructor(
      @InjectModel(Order.name)
      private readonly orderModel: Model<OrderDocument>,
      private readonly configService: ConfigService,
    ) {}

    async getAvailableOrders(
      query: AvailableOrdersQueryDto,
    ): Promise<OrderDocument[]> {
      const bufferMs =
        parseInt(
          this.configService.get('DRIVER_PRE_DISPATCH_BUFFER_MINUTES', '20'),
          10,
        ) * 60_000;
      const maxRadius = parseInt(
        this.configService.get('DRIVER_MAX_RADIUS_METERS', '5000'),
        10,
      );
      const now = new Date();
      const dispatchCutoff = new Date(now.getTime() + bufferMs);
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const skip = (page - 1) * limit;

      return this.orderModel
        .find({
          deliveryMode: 'delivery',
          status: OrderStatus.CONFIRMED,
          driverId: null,
          collectionStartTime: { $lte: dispatchCutoff },
          collectionEndTime: { $gte: now },
          'establishmentAddress.coordinates': {
            $near: {
              $geometry: { type: 'Point', coordinates: [query.lng, query.lat] },
              $maxDistance: maxRadius,
            },
          },
        })
        .select(
          'orderNumber establishmentId establishmentAddress collectionStartTime collectionEndTime ' +
            'deliveryAddress estimatedDistanceKm deliveryFee pricing items',
        )
        .skip(skip)
        .limit(limit)
        .lean() as Promise<OrderDocument[]>;
    }

    async acceptOrder(
      orderId: string,
      driverId: string,
    ): Promise<OrderDocument> {
      const order = await this.orderModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: null,
          status: OrderStatus.CONFIRMED,
          deliveryMode: 'delivery',
        },
        {
          $set: {
            driverId: new Types.ObjectId(driverId),
            status: OrderStatus.OUT_FOR_DELIVERY,
          },
        },
        { new: true },
      );

      if (!order) {
        this.logger.warn(
          `Driver ${driverId} failed to accept order ${orderId} — already taken`,
        );
        throw new ConflictException('Order already accepted by another driver');
      }

      return order;
    }

    async markDelivered(
      orderId: string,
      driverId: string,
    ): Promise<OrderDocument> {
      const order = await this.orderModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
        { $set: { status: OrderStatus.DELIVERED } },
        { new: true },
      );

      if (!order) {
        throw new NotFoundException('Order not found or not assigned to you');
      }

      return order;
    }

    async unassignOrder(
      orderId: string,
      driverId: string,
      reason: string | undefined,
    ): Promise<OrderDocument> {
      const order = await this.orderModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(orderId),
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
        {
          $set: { status: OrderStatus.CONFIRMED, driverId: null },
          $inc: { driverCancellationCount: 1 },
        },
        { new: true },
      );

      if (!order) {
        throw new NotFoundException('Order not found or not assigned to you');
      }

      this.logger.log(
        `Driver ${driverId} unassigned from order ${orderId}. Reason: ${reason ?? 'none'}`,
      );

      return order;
    }
  }
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  pnpm --filter @foodwaste/backend test -- --testPathPattern=drivers.service.spec --no-coverage
  ```

  Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/food-waste-backend/src/drivers/drivers.service.ts \
          apps/food-waste-backend/src/drivers/drivers.service.spec.ts
  git commit -m "feat(backend): implement DriversService with atomic accept/unassign"
  ```

---

## Task 9: DriversController + DriversModule + AppModule Registration

**Files:**

- Create: `apps/food-waste-backend/src/drivers/drivers.controller.ts`
- Create: `apps/food-waste-backend/src/drivers/drivers.module.ts`
- Modify: `apps/food-waste-backend/src/app.module.ts`

- [ ] **Step 1: Create DriversController**

  Create `apps/food-waste-backend/src/drivers/drivers.controller.ts`:

  ```ts
  import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
  } from '@nestjs/common';
  import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

  import { UserRole } from '@foodwaste/shared';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../auth/guards/roles.guard';
  import {
    AuthenticatedRequest,
    GetUser,
  } from '../common/decorators/get-user.decorator';
  import { Roles } from '../common/decorators/roles.decorator';

  import { AvailableOrdersQueryDto } from './dto/available-orders-query.dto';
  import { UnassignOrderDto } from './dto/unassign-order.dto';
  import { DriversService } from './drivers.service';

  @ApiTags('Drivers')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @Controller('drivers')
  export class DriversController {
    constructor(private readonly driversService: DriversService) {}

    @ApiOperation({ summary: 'Get filtered pool of available delivery orders' })
    @Get('orders/available')
    getAvailableOrders(@Query() query: AvailableOrdersQueryDto) {
      return this.driversService.getAvailableOrders(query);
    }

    @ApiOperation({ summary: 'Atomically accept an order from the pool' })
    @Post('orders/:id/accept')
    @HttpCode(HttpStatus.OK)
    acceptOrder(@Param('id') orderId: string, @GetUser('id') driverId: string) {
      return this.driversService.acceptOrder(orderId, driverId);
    }

    @ApiOperation({ summary: 'Mark an order as delivered' })
    @Post('orders/:id/deliver')
    @HttpCode(HttpStatus.OK)
    markDelivered(
      @Param('id') orderId: string,
      @GetUser('id') driverId: string,
    ) {
      return this.driversService.markDelivered(orderId, driverId);
    }

    @ApiOperation({
      summary: 'Unassign from an order and return it to the pool',
    })
    @Post('orders/:id/unassign')
    @HttpCode(HttpStatus.OK)
    unassignOrder(
      @Param('id') orderId: string,
      @GetUser('id') driverId: string,
      @Body() body: UnassignOrderDto,
    ) {
      return this.driversService.unassignOrder(orderId, driverId, body.reason);
    }
  }
  ```

- [ ] **Step 2: Create DriversModule**

  Create `apps/food-waste-backend/src/drivers/drivers.module.ts`:

  ```ts
  import { Module } from '@nestjs/common';
  import { MongooseModule } from '@nestjs/mongoose';
  import { ConfigModule } from '@nestjs/config';

  import { Order, OrderSchema } from '../orders/schemas/order.schema';
  import { DriversController } from './drivers.controller';
  import { DriversService } from './drivers.service';

  @Module({
    imports: [
      ConfigModule,
      MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    ],
    controllers: [DriversController],
    providers: [DriversService],
  })
  export class DriversModule {}
  ```

- [ ] **Step 3: Register DriversModule in AppModule**

  In `apps/food-waste-backend/src/app.module.ts`:
  1. Add the import at the top with the other module imports:
     ```ts
     import { DriversModule } from './drivers/drivers.module';
     ```
  2. Add `DriversModule` to the `imports` array, alphabetically after
     `DonationsModule`:
     ```ts
     DriversModule,
     ```

- [ ] **Step 4: Full backend type-check**

  ```bash
  pnpm --filter @foodwaste/backend type-check
  ```

  Expected: exits 0.

- [ ] **Step 5: Run all backend tests**

  ```bash
  pnpm --filter @foodwaste/backend test -- --no-coverage
  ```

  Expected: all tests pass, 0 failures.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/food-waste-backend/src/drivers/ \
          apps/food-waste-backend/src/app.module.ts
  git commit -m "feat(backend): add DriversController, DriversModule, register in AppModule"
  ```

---

## Task 10: Backend Smoke Test — Verify Routes Exist

- [ ] **Step 1: Start the backend**

  ```bash
  pnpm --filter @foodwaste/backend dev
  ```

  Expected: "NestJS application is running" in stdout, no startup errors.

- [ ] **Step 2: Verify the 4 routes appear in Swagger**

  Open `http://localhost:3000/api/v1/api-docs` in a browser. Confirm the
  **Drivers** section appears with:
  - `GET /api/v1/drivers/orders/available`
  - `POST /api/v1/drivers/orders/{id}/accept`
  - `POST /api/v1/drivers/orders/{id}/deliver`
  - `POST /api/v1/drivers/orders/{id}/unassign`

  If the section is missing, check that `DriversModule` is in `app.module.ts`
  imports.

- [ ] **Step 3: Stop the backend** (`Ctrl+C`)

---

## Task 11: Rebuild Shared Package and Extend Navigation Types

**Files:**

- Modify: `apps/mobile/src/navigation/types.ts`

- [ ] **Step 1: Rebuild shared + reset Metro cache**

  ```bash
  pnpm --filter @foodwaste/shared build
  pnpm --filter @foodwaste/mobile metro:reset
  ```

  Metro will start with a clean cache. Stop it (`Ctrl+C`) after it prints "Metro
  ready".

- [ ] **Step 2: Add DriverStack to RootNavigatorParamList**

  In `apps/mobile/src/navigation/types.ts`, update `RootNavigatorParamList`:

  ```ts
  export interface RootNavigatorParamList extends Record<
    string,
    object | undefined
  > {
    AuthStack: NavigatorScreenParams<AuthStackParamList> | undefined;
    MainStack: undefined;
    DriverStack: undefined;
  }
  ```

- [ ] **Step 3: Add DriverStackParamList and navigation props**

  Add after `ProfileStackParamList`:

  ```ts
  export interface DriverStackParamList extends Record<
    string,
    object | undefined
  > {
    DriverOrdersList: undefined;
    DriverOrderDetail: { orderId: string };
    DriverActiveOrder: { orderId: string };
  }

  export type DriverOrdersListNavigationProp = NativeStackNavigationProp<
    DriverStackParamList,
    'DriverOrdersList'
  >;
  export type DriverOrderDetailNavigationProp = NativeStackNavigationProp<
    DriverStackParamList,
    'DriverOrderDetail'
  >;
  export type DriverActiveOrderNavigationProp = NativeStackNavigationProp<
    DriverStackParamList,
    'DriverActiveOrder'
  >;
  export type DriverOrderDetailRouteProp = RouteProp<
    DriverStackParamList,
    'DriverOrderDetail'
  >;
  export type DriverActiveOrderRouteProp = RouteProp<
    DriverStackParamList,
    'DriverActiveOrder'
  >;
  ```

- [ ] **Step 4: Type-check mobile**

  ```bash
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: exits 0.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/mobile/src/navigation/types.ts
  git commit -m "feat(mobile): add DriverStack to navigation types"
  ```

---

## Task 12: DriverStack Navigator + RootNavigator Update

**Files:**

- Create: `apps/mobile/src/navigation/DriverStack.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Create DriverStack navigator**

  Create `apps/mobile/src/navigation/DriverStack.tsx`:

  ```tsx
  import { createNativeStackNavigator } from '@react-navigation/native-stack';
  import React from 'react';

  import { DriverActiveOrderScreen } from '@/features/driver/screens/DriverActiveOrderScreen';
  import { DriverOrderDetailScreen } from '@/features/driver/screens/DriverOrderDetailScreen';
  import { DriverOrdersListScreen } from '@/features/driver/screens/DriverOrdersListScreen';

  import type { DriverStackParamList } from './types';

  const Stack = createNativeStackNavigator<DriverStackParamList>();

  export const DriverStack: React.FC = () => (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name='DriverOrdersList'
        component={DriverOrdersListScreen}
        options={{ title: 'Available Orders' }}
      />
      <Stack.Screen
        name='DriverOrderDetail'
        component={DriverOrderDetailScreen}
        options={{ title: 'Order Details' }}
      />
      <Stack.Screen
        name='DriverActiveOrder'
        component={DriverActiveOrderScreen}
        options={{ title: 'Active Delivery' }}
      />
    </Stack.Navigator>
  );
  ```

- [ ] **Step 2: Update renderNavigator() in RootNavigator**

  In `apps/mobile/src/navigation/RootNavigator.tsx`:
  1. Add the import at the top with the other stack imports:
     ```ts
     import { DriverStack } from './DriverStack';
     ```
  2. Also import `UserRole` from `@foodwaste/shared`:
     ```ts
     import { UserRole } from '@foodwaste/shared';
     ```
  3. Update the Redux selector to also get `user`:
     ```ts
     const { flowState, user } = useAppSelector(state => state.auth);
     ```
  4. Update the `AUTHENTICATED` case in `renderNavigator()`:
     ```ts
     case AuthFlowState.AUTHENTICATED:
       if (user?.role === UserRole.DRIVER) {
         return (
           <Stack.Screen name='DriverStack' component={DriverStack} options={{ headerShown: false }} />
         );
       }
       return (
         <Stack.Screen name='MainStack' component={MainStack} options={{ headerShown: false }} />
       );
     ```

- [ ] **Step 3: Type-check**

  ```bash
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: exits 0.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/mobile/src/navigation/DriverStack.tsx \
          apps/mobile/src/navigation/RootNavigator.tsx
  git commit -m "feat(mobile): add DriverStack navigator and role-based routing"
  ```

---

## Task 13: Driver API Service + useDriverOrders Hook

**Files:**

- Create: `apps/mobile/src/features/driver/services/driver.service.ts`
- Create: `apps/mobile/src/features/driver/hooks/useDriverOrders.ts`

- [ ] **Step 1: Create driver.service.ts**

  Create `apps/mobile/src/features/driver/services/driver.service.ts`:

  ```ts
  import { apiClient, unwrapBackendResponse } from '@/services/apiClient';

  export interface DriverAvailableOrder {
    _id: string;
    orderNumber: string;
    establishmentId: { _id: string; name: string; address?: unknown } | string;
    establishmentAddress?: {
      city?: string;
      coordinates?: { coordinates: [number, number] };
    };
    collectionStartTime: string;
    collectionEndTime: string;
    deliveryAddress: {
      city: string;
      coordinates: { lat: number; lng: number };
    };
    estimatedDistanceKm: number;
    deliveryFee: number;
    pricing: { total: number; currency: string };
    items: Array<{ offerTitle: string; quantity: number }>;
  }

  export interface DriverActiveOrder extends DriverAvailableOrder {
    status: string;
    driverId: string;
  }

  const BASE = '/drivers';

  export const driverService = {
    getAvailableOrders: async (
      lat: number,
      lng: number,
      page = 1,
    ): Promise<DriverAvailableOrder[]> => {
      const res = await apiClient.get<unknown>(`${BASE}/orders/available`, {
        params: { lat, lng, page, limit: 20 },
      });
      return unwrapBackendResponse<DriverAvailableOrder[]>(res.data);
    },

    acceptOrder: async (orderId: string): Promise<DriverActiveOrder> => {
      const res = await apiClient.post<unknown>(
        `${BASE}/orders/${orderId}/accept`,
      );
      return unwrapBackendResponse<DriverActiveOrder>(res.data);
    },

    markDelivered: async (orderId: string): Promise<DriverActiveOrder> => {
      const res = await apiClient.post<unknown>(
        `${BASE}/orders/${orderId}/deliver`,
      );
      return unwrapBackendResponse<DriverActiveOrder>(res.data);
    },

    unassignOrder: async (
      orderId: string,
      reason?: string,
    ): Promise<DriverActiveOrder> => {
      const res = await apiClient.post<unknown>(
        `${BASE}/orders/${orderId}/unassign`,
        { reason },
      );
      return unwrapBackendResponse<DriverActiveOrder>(res.data);
    },
  };
  ```

- [ ] **Step 2: Create useDriverOrders.ts**

  Create `apps/mobile/src/features/driver/hooks/useDriverOrders.ts`:

  ```ts
  import { useMutation, useQueryClient } from '@tanstack/react-query';
  import { useCallback, useEffect, useState } from 'react';
  import Geolocation from 'react-native-geolocation-service';

  import { useQueryWithFocus } from '@/lib/react-query/hooks';

  import {
    driverService,
    type DriverAvailableOrder,
  } from '../services/driver.service';

  const DRIVER_QUERY_KEY = ['driver', 'available-orders'] as const;

  interface GpsCoords {
    lat: number;
    lng: number;
  }

  export function useDriverOrders() {
    const [coords, setCoords] = useState<GpsCoords | null>(null);
    const queryClient = useQueryClient();

    // Acquire GPS once on mount via Fused Location (enableHighAccuracy = true)
    useEffect(() => {
      Geolocation.getCurrentPosition(
        pos =>
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          /* location permission denied — list stays empty */
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
      );
    }, []);

    const {
      data: orders = [],
      isLoading,
      isError,
      refetch,
    } = useQueryWithFocus<DriverAvailableOrder[]>(
      [...DRIVER_QUERY_KEY, coords],
      () => {
        if (!coords) return Promise.resolve([]);
        return driverService.getAvailableOrders(coords.lat, coords.lng);
      },
      { enabled: coords !== null, refetchInterval: 30_000 },
    );

    const invalidate = useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: DRIVER_QUERY_KEY });
    }, [queryClient]);

    const acceptMutation = useMutation({
      mutationFn: (orderId: string) => driverService.acceptOrder(orderId),
      onSuccess: invalidate,
    });

    const deliverMutation = useMutation({
      mutationFn: (orderId: string) => driverService.markDelivered(orderId),
      onSuccess: invalidate,
    });

    const unassignMutation = useMutation({
      mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
        driverService.unassignOrder(orderId, reason),
      onSuccess: invalidate,
    });

    return {
      orders,
      isLoading,
      isError,
      refetch,
      hasLocation: coords !== null,
      acceptOrder: acceptMutation.mutate,
      isAccepting: acceptMutation.isPending,
      acceptError: acceptMutation.error,
      markDelivered: deliverMutation.mutate,
      isDelivering: deliverMutation.isPending,
      unassignOrder: unassignMutation.mutate,
      isUnassigning: unassignMutation.isPending,
    };
  }
  ```

- [ ] **Step 3: Type-check**

  ```bash
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: exits 0.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/mobile/src/features/driver/services/driver.service.ts \
          apps/mobile/src/features/driver/hooks/useDriverOrders.ts
  git commit -m "feat(mobile): add driver API service and useDriverOrders hook"
  ```

---

## Task 14: DriverOrdersListScreen + DriverOrderDetailScreen

**Files:**

- Create: `apps/mobile/src/features/driver/screens/DriverOrdersListScreen.tsx`
- Create: `apps/mobile/src/features/driver/screens/DriverOrderDetailScreen.tsx`

- [ ] **Step 1: Create DriverOrdersListScreen**

  Create `apps/mobile/src/features/driver/screens/DriverOrdersListScreen.tsx`:

  ```tsx
  import React from 'react';
  import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
  } from 'react-native';
  import { useNavigation } from '@react-navigation/native';

  import type { DriverOrdersListNavigationProp } from '@/navigation/types';
  import { useDriverOrders } from '../hooks/useDriverOrders';
  import type { DriverAvailableOrder as Order } from '../services/driver.service';

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-TN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function OrderCard({
    order,
    onPress,
  }: {
    order: Order;
    onPress: () => void;
  }) {
    const estName =
      typeof order.establishmentId === 'object'
        ? (order.establishmentId as { name: string }).name
        : 'Establishment';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.cardTitle}>{estName}</Text>
        <Text style={styles.cardSub}>
          Pickup window: {formatTime(order.collectionStartTime)} –{' '}
          {formatTime(order.collectionEndTime)}
        </Text>
        <Text style={styles.cardSub}>
          {order.estimatedDistanceKm.toFixed(1)} km away ·{' '}
          {order.deliveryFee.toFixed(3)} TND fee
        </Text>
        <Text style={styles.cardSub}>→ {order.deliveryAddress.city}</Text>
      </TouchableOpacity>
    );
  }

  export function DriverOrdersListScreen() {
    const navigation = useNavigation<DriverOrdersListNavigationProp>();
    const { orders, isLoading, isError, refetch, hasLocation } =
      useDriverOrders();

    if (!hasLocation) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size='large' />
          <Text style={styles.hint}>Acquiring GPS…</Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size='large' />
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.center}>
          <Text style={styles.error}>
            Failed to load orders. Pull down to retry.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={orders}
        keyExtractor={o => o._id}
        contentContainerStyle={
          orders.length === 0 ? styles.center : styles.list
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>
              No orders available near you right now.
            </Text>
            <Text style={styles.hint}>
              New orders appear 20 min before pickup time.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() =>
              navigation.navigate('DriverOrderDetail', { orderId: item._id })
            }
          />
        )}
      />
    );
  }

  const styles = StyleSheet.create({
    list: { padding: 16, gap: 12 },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1E4448',
      marginBottom: 4,
    },
    cardSub: { fontSize: 13, color: '#666', marginTop: 2 },
    empty: {
      fontSize: 16,
      fontWeight: '500',
      color: '#333',
      textAlign: 'center',
    },
    hint: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8 },
    error: { fontSize: 14, color: '#D32F2F', textAlign: 'center' },
  });
  ```

- [ ] **Step 2: Create DriverOrderDetailScreen**

  Create `apps/mobile/src/features/driver/screens/DriverOrderDetailScreen.tsx`:

  ```tsx
  import React from 'react';
  import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
  } from 'react-native';
  import { useNavigation, useRoute } from '@react-navigation/native';

  import type {
    DriverOrderDetailNavigationProp,
    DriverOrderDetailRouteProp,
  } from '@/navigation/types';
  import { useDriverOrders } from '../hooks/useDriverOrders';

  export function DriverOrderDetailScreen() {
    const navigation = useNavigation<DriverOrderDetailNavigationProp>();
    const route = useRoute<DriverOrderDetailRouteProp>();
    const { orderId } = route.params;

    const { orders, acceptOrder, isAccepting, acceptError } = useDriverOrders();

    const order = orders.find(o => o._id === orderId);

    const handleAccept = () => {
      Alert.alert(
        'Accept order?',
        'You will be responsible for picking it up and delivering it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept',
            onPress: () =>
              acceptOrder(orderId, {
                onSuccess: () =>
                  navigation.navigate('DriverActiveOrder', { orderId }),
                onError: () =>
                  Alert.alert(
                    'Already taken',
                    'Another driver just accepted this order.',
                  ),
              }),
          },
        ],
      );
    };

    if (!order) {
      return (
        <View style={styles.center}>
          <Text style={styles.gone}>This order is no longer available.</Text>
        </View>
      );
    }

    const estName =
      typeof order.establishmentId === 'object'
        ? (order.establishmentId as { name: string }).name
        : 'Establishment';

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.section}>Pickup</Text>
        <Text style={styles.value}>{estName}</Text>
        <Text style={styles.sub}>
          {new Date(order.collectionStartTime).toLocaleTimeString('en-TN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' – '}
          {new Date(order.collectionEndTime).toLocaleTimeString('en-TN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        <Text style={styles.section}>Delivery</Text>
        <Text style={styles.value}>{order.deliveryAddress.city}</Text>
        <Text style={styles.sub}>
          {order.estimatedDistanceKm.toFixed(1)} km
        </Text>

        <Text style={styles.section}>Your earnings</Text>
        <Text style={styles.value}>{order.deliveryFee.toFixed(3)} TND</Text>

        <Text style={styles.section}>Items</Text>
        {order.items.map((item, i) => (
          <Text key={i} style={styles.sub}>
            {item.quantity}× {item.offerTitle}
          </Text>
        ))}

        {acceptError && (
          <Text style={styles.error}>Failed to accept. Try again.</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, isAccepting && styles.btnDisabled]}
          onPress={handleAccept}
          disabled={isAccepting}
        >
          {isAccepting ? (
            <ActivityIndicator color='#fff' />
          ) : (
            <Text style={styles.btnText}>Accept & Deliver</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const styles = StyleSheet.create({
    container: { padding: 20, gap: 4 },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    section: {
      fontSize: 11,
      fontWeight: '700',
      color: '#888',
      textTransform: 'uppercase',
      marginTop: 20,
      letterSpacing: 0.5,
    },
    value: { fontSize: 16, fontWeight: '600', color: '#1E4448', marginTop: 4 },
    sub: { fontSize: 13, color: '#666', marginTop: 2 },
    gone: { fontSize: 15, color: '#888', textAlign: 'center' },
    error: { color: '#D32F2F', fontSize: 13, marginTop: 12 },
    btn: {
      backgroundColor: '#1E4448',
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 32,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  });
  ```

- [ ] **Step 3: Type-check**

  ```bash
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: exits 0.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/mobile/src/features/driver/screens/DriverOrdersListScreen.tsx \
          apps/mobile/src/features/driver/screens/DriverOrderDetailScreen.tsx
  git commit -m "feat(mobile): add DriverOrdersListScreen and DriverOrderDetailScreen"
  ```

---

## Task 15: DriverActiveOrderScreen

**Files:**

- Create: `apps/mobile/src/features/driver/screens/DriverActiveOrderScreen.tsx`

- [ ] **Step 1: Create the screen**

  Create `apps/mobile/src/features/driver/screens/DriverActiveOrderScreen.tsx`:

  ```tsx
  import React from 'react';
  import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Linking,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Platform,
  } from 'react-native';
  import { useNavigation, useRoute } from '@react-navigation/native';

  import type {
    DriverActiveOrderNavigationProp,
    DriverActiveOrderRouteProp,
  } from '@/navigation/types';
  import { useDriverOrders } from '../hooks/useDriverOrders';

  async function openNavigation(lat: number, lng: number): Promise<void> {
    // Always navigate to the immutable locked pin — never the customer's live GPS.
    const wazeUrl = `waze://ul?ll=${lat},${lng}&navigate=yes`;
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const appleMapsUrl = `maps://app?daddr=${lat},${lng}&dirflg=d`;

    const canWaze = await Linking.canOpenURL(wazeUrl);
    if (canWaze) {
      await Linking.openURL(wazeUrl);
      return;
    }

    if (Platform.OS === 'ios') {
      const canApple = await Linking.canOpenURL(appleMapsUrl);
      if (canApple) {
        await Linking.openURL(appleMapsUrl);
        return;
      }
    }

    await Linking.openURL(gmapsUrl);
  }

  export function DriverActiveOrderScreen() {
    const navigation = useNavigation<DriverActiveOrderNavigationProp>();
    const route = useRoute<DriverActiveOrderRouteProp>();
    const { orderId } = route.params;

    const {
      orders,
      markDelivered,
      isDelivering,
      unassignOrder,
      isUnassigning,
    } = useDriverOrders();

    // The active order might not be in the "available" pool query (it's assigned).
    // For MVP we pass the order forward via navigation state; here we fall back to orders list.
    const order = orders.find(o => o._id === orderId);

    const handleDeliver = () => {
      Alert.alert(
        'Confirm delivery?',
        'Only confirm once the customer has received the bag.',
        [
          { text: 'Not yet', style: 'cancel' },
          {
            text: 'Delivered',
            onPress: () =>
              markDelivered(orderId, {
                onSuccess: () => {
                  Alert.alert('Done!', 'Order marked as delivered.');
                  navigation.navigate('DriverOrdersList');
                },
                onError: () =>
                  Alert.alert(
                    'Error',
                    'Could not mark as delivered. Try again.',
                  ),
              }),
          },
        ],
      );
    };

    const handleUnassign = () => {
      Alert.prompt(
        "Can't complete delivery?",
        'Briefly explain why (optional). The order will return to the pool.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unassign',
            style: 'destructive',
            onPress: (reason?: string) =>
              unassignOrder(
                { orderId, reason },
                {
                  onSuccess: () => {
                    Alert.alert('Unassigned', 'Order returned to the pool.');
                    navigation.navigate('DriverOrdersList');
                  },
                  onError: () =>
                    Alert.alert('Error', 'Could not unassign. Try again.'),
                },
              ),
          },
        ],
        'plain-text',
      );
    };

    if (!order) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size='large' />
          <Text style={styles.hint}>Loading order…</Text>
        </View>
      );
    }

    const { lat, lng } = order.deliveryAddress.coordinates;

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>ACTIVE DELIVERY</Text>

        <Text style={styles.section}>Deliver to</Text>
        <Text style={styles.value}>{order.deliveryAddress.city}</Text>
        <Text style={styles.coords}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </Text>

        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => void openNavigation(lat, lng)}
        >
          <Text style={styles.navBtnText}>Open Navigation (Maps / Waze)</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Pickup from</Text>
        <Text style={styles.value}>
          {new Date(order.collectionStartTime).toLocaleTimeString('en-TN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' – '}
          {new Date(order.collectionEndTime).toLocaleTimeString('en-TN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        <TouchableOpacity
          style={[styles.deliverBtn, isDelivering && styles.btnDisabled]}
          onPress={handleDeliver}
          disabled={isDelivering}
        >
          {isDelivering ? (
            <ActivityIndicator color='#fff' />
          ) : (
            <Text style={styles.deliverBtnText}>Mark as Delivered</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.unassignBtn, isUnassigning && styles.btnDisabled]}
          onPress={handleUnassign}
          disabled={isUnassigning}
        >
          <Text style={styles.unassignBtnText}>
            Can't deliver — return to pool
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const styles = StyleSheet.create({
    container: { padding: 20, gap: 4 },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    badge: {
      fontSize: 11,
      fontWeight: '800',
      color: '#F55449',
      letterSpacing: 1,
      marginBottom: 8,
    },
    section: {
      fontSize: 11,
      fontWeight: '700',
      color: '#888',
      textTransform: 'uppercase',
      marginTop: 24,
      letterSpacing: 0.5,
    },
    value: { fontSize: 18, fontWeight: '600', color: '#1E4448', marginTop: 4 },
    coords: {
      fontSize: 12,
      color: '#aaa',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      marginTop: 2,
    },
    hint: { fontSize: 13, color: '#888', marginTop: 12 },
    navBtn: {
      backgroundColor: '#1E4448',
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
    },
    navBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    deliverBtn: {
      backgroundColor: '#2E7D32',
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 32,
    },
    deliverBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    unassignBtn: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
      borderWidth: 1.5,
      borderColor: '#D32F2F',
    },
    unassignBtnText: { color: '#D32F2F', fontSize: 14, fontWeight: '600' },
    btnDisabled: { opacity: 0.5 },
  });
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: exits 0.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/mobile/src/features/driver/screens/DriverActiveOrderScreen.tsx
  git commit -m "feat(mobile): add DriverActiveOrderScreen with Maps/Waze deep link"
  ```

---

## Task 16: Customer-Side — Delivery Mode Toggle + Map Pin on CheckoutScreen

**Files:**

- Modify: `apps/mobile/src/features/orders/screens/CheckoutScreen.tsx`

The order form lives in `CheckoutScreen.tsx`. Order data is assembled in the
`handleConfirmOrder` callback as the `orderData: CreateOrderDto` object (around
line 164). The submit call is `await createOrder(orderData)`.

- [ ] **Step 1: Add delivery mode state to CheckoutScreen**

  In `apps/mobile/src/features/orders/screens/CheckoutScreen.tsx`:
  1. Add these imports at the top, alongside the existing imports:

     ```ts
     import MapView, { Marker, type Region } from 'react-native-maps';
     import Geolocation from 'react-native-geolocation-service';
     ```

  2. Add `TouchableOpacity` to the existing `react-native` import if not already
     present.

  3. Add state inside the `CheckoutScreen` component function body, below the
     existing `useState` declarations:

     ```ts
     const [deliveryMode, setDeliveryMode] = useState<'pickup' | 'delivery'>(
       'pickup',
     );
     const [deliveryPin, setDeliveryPin] = useState<{
       lat: number;
       lng: number;
     } | null>(null);
     const [mapRegion, setMapRegion] = useState<Region | null>(null);

     const requestGpsAndCenterMap = useCallback(() => {
       Geolocation.getCurrentPosition(
         pos => {
           const region = {
             latitude: pos.coords.latitude,
             longitude: pos.coords.longitude,
             latitudeDelta: 0.005,
             longitudeDelta: 0.005,
           };
           setMapRegion(region);
           setDeliveryPin({
             lat: pos.coords.latitude,
             lng: pos.coords.longitude,
           });
         },
         () => {
           setMapRegion({
             latitude: 36.8065,
             longitude: 10.1815,
             latitudeDelta: 0.05,
             longitudeDelta: 0.05,
           });
         },
         { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
       );
     }, []);
     ```

     > `useCallback` is already imported — add `requestGpsAndCenterMap` to its
     > dependency array of any parent callbacks that reference it, or keep it
     > top-level as shown.

- [ ] **Step 2: Extend the orderData payload in handleConfirmOrder**

  Locate the `orderData: CreateOrderDto` object (around line 164 in
  `handleConfirmOrder`). After the last existing field
  (`...(customerNotes ? { customerNotes } : {})`), add:

  ```ts
  ...(deliveryMode === 'delivery' && deliveryPin
    ? {
        deliveryMode:    'delivery' as const,
        deliveryAddress: {
          city:        'Tunis',
          coordinates: deliveryPin,
        },
      }
    : { deliveryMode: 'pickup' as const }),
  ```

  Also add `deliveryMode` and `deliveryPin` to the `useCallback` dependency
  array of `handleConfirmOrder`.

- [ ] **Step 3: Add the delivery toggle and map to the JSX**

  Find the `ScrollView` / main content area in the JSX return. Add the following
  block after the payment method selector (search for the last payment method
  `Pressable` block):

  ```tsx
  {
    /* Delivery Mode Toggle */
  }
  <View
    style={{
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
      paddingHorizontal: 16,
    }}
  >
    {(['pickup', 'delivery'] as const).map(mode => (
      <Pressable
        key={mode}
        style={{
          flex: 1,
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: 'center',
          backgroundColor: deliveryMode === mode ? '#1E4448' : '#f0f0f0',
        }}
        onPress={() => {
          setDeliveryMode(mode);
          if (mode === 'delivery' && mapRegion === null)
            requestGpsAndCenterMap();
        }}
      >
        <Text
          style={{
            color: deliveryMode === mode ? '#fff' : '#333',
            fontWeight: '600',
          }}
        >
          {mode === 'pickup' ? '🏪 Pickup' : '🛵 Delivery'}
        </Text>
      </Pressable>
    ))}
  </View>;

  {
    /* Delivery address map — only shown when delivery is selected */
  }
  {
    deliveryMode === 'delivery' && (
      <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
          Drag the pin to your exact door
        </Text>
        {mapRegion !== null ? (
          <MapView
            style={{ height: 220, borderRadius: 12 }}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
          >
            {deliveryPin !== null && (
              <Marker
                coordinate={{
                  latitude: deliveryPin.lat,
                  longitude: deliveryPin.lng,
                }}
                draggable
                onDragEnd={e =>
                  setDeliveryPin({
                    lat: e.nativeEvent.coordinate.latitude,
                    lng: e.nativeEvent.coordinate.longitude,
                  })
                }
              />
            )}
          </MapView>
        ) : (
          <View
            style={{
              height: 220,
              borderRadius: 12,
              backgroundColor: '#eee',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#aaa' }}>Acquiring GPS…</Text>
          </View>
        )}
        {deliveryPin !== null && (
          <Text
            style={{
              fontSize: 11,
              color: '#aaa',
              marginTop: 6,
              fontFamily: 'monospace',
            }}
          >
            {deliveryPin.lat.toFixed(5)}, {deliveryPin.lng.toFixed(5)}
          </Text>
        )}
      </View>
    );
  }
  ```

  > `Pressable` is already imported in `CheckoutScreen.tsx` — use it instead of
  > `TouchableOpacity` to match the existing component style.

- [ ] **Step 4: Type-check**

  ```bash
  pnpm --filter @foodwaste/mobile type-check
  ```

  Expected: exits 0. The most common error at this step is
  `deliveryMode`/`deliveryAddress` missing from the `CreateOrderDto` type — if
  it occurs, verify Task 2 (shared rebuild) completed successfully.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/mobile/src/features/orders/screens/CheckoutScreen.tsx
  git commit -m "feat(mobile): add delivery mode toggle and draggable map pin to CheckoutScreen"
  ```

---

## Task 17: Final Verification Gate

- [ ] **Step 1: Full monorepo type-check**

  ```bash
  pnpm type-check
  ```

  Expected: exits 0 across all apps and packages.

- [ ] **Step 2: Full test suite**

  ```bash
  pnpm test:ci
  ```

  Expected: 0 failures. New tests: `geo.util.spec` (3) and
  `drivers.service.spec` (5).

- [ ] **Step 3: Start backend and confirm indexes are registered**

  ```bash
  pnpm --filter @foodwaste/backend dev
  ```

  Look for Mongoose index-build logs. No "index build failed" errors should
  appear.

- [ ] **Step 4: Smoke test the driver pool endpoint**

  With a user account that has `role: 'driver'`, obtain a JWT and call:

  ```
  GET /api/v1/drivers/orders/available?lat=36.8065&lng=10.1815
  Authorization: Bearer <driver-jwt>
  ```

  Expected: 200 with `{ status: 'success', data: [...] }`. An empty array is
  correct if no delivery orders exist yet.

- [ ] **Step 5: Create a test delivery order and verify it enters the pool**

  POST a new order with `deliveryMode: 'delivery'`, `deliveryAddress`, and a
  `pickupTimeSlot` within the next 20 minutes. Then poll the driver pool — the
  order should appear.

  Confirm in MongoDB:

  ```js
  db.orders.findOne(
    { deliveryMode: 'delivery' },
    {
      deliveryMode: 1,
      collectionStartTime: 1,
      collectionEndTime: 1,
      deliveryFee: 1,
      driverEarnings: 1,
      estimatedDistanceKm: 1,
    },
  );
  ```

  All fields should be populated and non-null.

- [ ] **Step 6: Final commit**

  ```bash
  git add -A
  git commit -m "feat: driver role MVP — complete delivery flow backend + mobile"
  ```
