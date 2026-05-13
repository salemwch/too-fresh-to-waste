# Driver Role — Technical Design Spec

**Date:** 2026-05-13 **Status:** Approved — ready for implementation **Scope:**
MVP — mobile app (React Native), NestJS backend, shared package

---

## 1. Overview

Add a `DRIVER` role to the Too Fresh To Waste platform. Drivers use the existing
React Native app (new role-specific screens) to:

1. See a real-time filtered pool of delivery orders near them
2. Self-assign to one order atomically
3. Navigate to the establishment via Google Maps or Waze
4. Deliver to the customer's confirmed pin and mark the order as delivered
5. Unassign if unable to complete (returns order to the pool)

Delivery runs **alongside** the existing pickup flow. Customers choose `pickup`
or `delivery` at order-creation time. Pickup orders are unaffected.

---

## 2. New Order Statuses

Two statuses are added to `OrderStatus` in
`packages/shared/src/enums/order.enum.ts`:

| Status             | Meaning                                       |
| ------------------ | --------------------------------------------- |
| `OUT_FOR_DELIVERY` | Driver has accepted the order and is en route |
| `DELIVERED`        | Driver confirmed delivery to customer         |

Full delivery lifecycle:

```
PENDING → CONFIRMED → [driver pool] → OUT_FOR_DELIVERY → DELIVERED
                            ↑                  │
                            └── unassign ───────┘  (reset to CONFIRMED)
```

Pickup lifecycle is unchanged:

```
PENDING → RESERVED → CONFIRMED → READY_FOR_PICKUP → PICKED_UP
```

---

## 3. Schema Changes

### 3.1 `packages/shared/src/enums/user.enum.ts`

```ts
export enum UserRole {
  CONSUMER = 'consumer',
  MERCHANT = 'merchant',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  DRIVER = 'driver', // ← new
}
```

### 3.2 `packages/shared/src/enums/order.enum.ts`

```ts
export enum OrderStatus {
  // existing values unchanged …
  OUT_FOR_DELIVERY = 'out_for_delivery', // ← new
  DELIVERED = 'delivered', // ← new
}
```

### 3.3 `apps/food-waste-backend/src/orders/schemas/order.schema.ts`

All new fields are optional so that existing pickup orders need no migration.

```ts
// Delivery mode — customer selects at order creation
@Prop({ type: String, enum: ['pickup', 'delivery'], default: 'pickup' })
deliveryMode!: 'pickup' | 'delivery';

// Customer delivery address — written once at order creation, never updated
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

// Pre-computed pickup window boundaries — indexed for driver pool query
// Must use { type: Date } because of TypeScript union with undefined (backend rule #2)
@Prop({ type: Date })
collectionStartTime?: Date;

@Prop({ type: Date })
collectionEndTime?: Date;

// Driver assignment
@Prop({ type: Types.ObjectId, ref: 'User', default: null })
driverId?: Types.ObjectId | null;

// Financials — all computed at order creation, immutable
@Prop({ type: Number, min: 0 })
estimatedDistanceKm?: number;

@Prop({ type: Number, min: 0 })
deliveryFee?: number;

@Prop({ type: Number, min: 0 })
driverEarnings?: number;

@Prop({ type: Number, min: 0 })
platformDeliveryCommission?: number;

// Driver reliability — incremented on each unassign
@Prop({ type: Number, default: 0, min: 0 })
driverCancellationCount!: number;
```

### 3.4 New Indexes on `order.schema.ts`

```ts
// 2dsphere for $near queries against establishment location.
// Must be standalone — cannot be part of a standard compound index
// (MongoDB limitation: $near requires a dedicated 2dsphere index).
// NOTE: The existing line-435 index targets `.coordinates.coordinates` (inner array).
// This new index targets `.coordinates` (the GeoJSON document) — correct path for $near.
OrderSchema.index(
  { 'establishmentAddress.coordinates': '2dsphere' },
  { sparse: true },
);

// Compound index covering all driver-pool filter fields.
// collectionEndTime leads — it eliminates expired orders first (most selective).
OrderSchema.index({
  deliveryMode: 1,
  status: 1,
  driverId: 1,
  collectionEndTime: 1,
  collectionStartTime: 1,
});

// Index supporting driver's own active/history order queries
OrderSchema.index({ driverId: 1, status: 1, createdAt: -1 });
```

---

## 4. Delivery Fee Calculation

Computed **once** in `OrdersService.create()` when
`deliveryMode === 'delivery'`. Never recalculated.

```
distanceKm = haversine(establishment.coords, customer.pin)
deliveryFee = BASE_DELIVERY_FEE + (distanceKm × RATE_PER_KM)
driverEarnings = deliveryFee × DRIVER_CUT_RATIO          (default 0.80)
platformDeliveryCommission = deliveryFee − driverEarnings
```

Environment variables (all in `.env`, never hardcoded):

| Variable                             | Default | Unit    |
| ------------------------------------ | ------- | ------- |
| `BASE_DELIVERY_FEE`                  | `2.000` | TND     |
| `RATE_PER_KM`                        | `0.500` | TND/km  |
| `DRIVER_CUT_RATIO`                   | `0.80`  | ratio   |
| `DRIVER_PRE_DISPATCH_BUFFER_MINUTES` | `20`    | minutes |
| `DRIVER_MAX_RADIUS_METERS`           | `5000`  | metres  |

Haversine implementation lives in a new shared utility:
`apps/food-waste-backend/src/common/utils/geo.util.ts`

---

## 5. Backend — Driver Module

### 5.1 Location: `apps/food-waste-backend/src/drivers/`

```
drivers/
├── drivers.module.ts
├── drivers.controller.ts
├── drivers.service.ts
├── dto/
│   ├── available-orders-query.dto.ts   # lat, lng, page, limit
│   └── unassign-order.dto.ts           # reason (optional)
```

### 5.2 Endpoints

All routes require `JwtAuthGuard` + `RolesGuard([UserRole.DRIVER])`.

| Method | Path                                  | Description              |
| ------ | ------------------------------------- | ------------------------ |
| `GET`  | `/api/v1/drivers/orders/available`    | Filtered, paginated pool |
| `POST` | `/api/v1/drivers/orders/:id/accept`   | Atomic self-assign       |
| `POST` | `/api/v1/drivers/orders/:id/deliver`  | Mark `DELIVERED`         |
| `POST` | `/api/v1/drivers/orders/:id/unassign` | Return to pool           |

### 5.3 `GET /drivers/orders/available` — Query Logic

```ts
const BUFFER_MS = DRIVER_PRE_DISPATCH_BUFFER_MINUTES * 60_000;
const now = new Date();

orders = await Order.find({
  deliveryMode: 'delivery',
  status: OrderStatus.CONFIRMED,
  driverId: null,
  collectionStartTime: { $lte: new Date(now.getTime() + BUFFER_MS) }, // opens soon or now
  collectionEndTime: { $gte: now }, // store not yet closed
  'establishmentAddress.coordinates': {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: DRIVER_MAX_RADIUS_METERS,
    },
  },
});
```

### 5.4 `POST /drivers/orders/:id/accept` — Atomic Assignment

```ts
const order = await Order.findOneAndUpdate(
  {
    _id: orderId,
    driverId: null, // atomic guard — fails if already taken
    status: OrderStatus.CONFIRMED,
    deliveryMode: 'delivery',
  },
  { $set: { driverId: currentDriverId, status: OrderStatus.OUT_FOR_DELIVERY } },
  { new: true },
);
if (!order)
  throw new ConflictException('Order already accepted by another driver');
```

### 5.5 `POST /drivers/orders/:id/unassign` — Return to Pool

```ts
const order = await Order.findOneAndUpdate(
  {
    _id: orderId,
    driverId: currentDriverId, // only the assigned driver may unassign
    status: OrderStatus.OUT_FOR_DELIVERY,
  },
  {
    $set: { status: OrderStatus.CONFIRMED, driverId: null },
    $inc: { driverCancellationCount: 1 },
  },
  { new: true },
);
if (!order)
  throw new NotFoundException('Order not found or not yours to unassign');
```

### 5.6 `POST /drivers/orders/:id/deliver`

```ts
const order = await Order.findOneAndUpdate(
  {
    _id: orderId,
    driverId: currentDriverId,
    status: OrderStatus.OUT_FOR_DELIVERY,
  },
  { $set: { status: OrderStatus.DELIVERED } },
  { new: true },
);
if (!order) throw new NotFoundException('Order not found or not yours');
```

---

## 6. `OrdersService.create()` Changes

When `deliveryMode === 'delivery'`:

1. Validate `deliveryAddress.coordinates` is present in the request DTO.
2. Compute `collectionStartTime` and `collectionEndTime` from
   `offer.pickupWindow`.
3. Run Haversine to get `estimatedDistanceKm`.
4. Compute `deliveryFee`, `driverEarnings`, `platformDeliveryCommission` from
   env vars.
5. Save all fields on the order — all immutable after this point.

When `deliveryMode === 'pickup'` (default), none of the new fields are written.
Existing flow is unchanged.

---

## 7. Mobile App — Driver Screens

### 7.1 Location: `apps/mobile/src/features/driver/`

```
driver/
├── screens/
│   ├── DriverOrdersListScreen.tsx   # available pool, auto-refreshes
│   ├── DriverOrderDetailScreen.tsx  # details + Accept button
│   └── DriverActiveOrderScreen.tsx  # active order + Navigate + Mark Delivered
├── hooks/
│   └── useDriverOrders.ts           # TanStack Query, passes driver GPS
└── services/
    └── driver.service.ts            # API calls for accept / deliver / unassign
```

### 7.2 Navigation

Driver users land in a `DriverStack` (parallel to `MainStack`), shown when
`user.role === UserRole.DRIVER`. The `RootNavigator` AuthFlowState check is
extended:

```
AUTHENTICATED + role === DRIVER → DriverStack
AUTHENTICATED + other roles    → MainStack (unchanged)
```

### 7.3 Delivery Location — Customer Side (Order Creation)

On `CreateOrderScreen` (consumer), when `deliveryMode === 'delivery'` is
selected:

1. Request location permission.
2. Call Fused Location Provider (via `react-native-geolocation-service` with
   `enableHighAccuracy: true`) to get current GPS.
3. Show `react-native-maps` `MapView` centred on that position with a draggable
   `Marker`.
4. Customer drags pin to exact doorstep → coordinates captured from final marker
   position.
5. On "Confirm location", coordinates are included in `CreateOrderDto`.

The saved pin is **displayed read-only** on the consumer's order detail screen
post-creation. It cannot be changed after the order is placed.

### 7.4 Navigation Deep Link (Driver Side)

```ts
// apps/mobile/src/features/driver/screens/DriverActiveOrderScreen.tsx

const openNavigation = async (lat: number, lng: number) => {
  const waze = `waze://ul?ll=${lat},${lng}&navigate=yes`;
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  const canWaze = await Linking.canOpenURL(waze);
  await Linking.openURL(canWaze ? waze : gmaps);
};
```

Driver always navigates to the **immutable saved pin** from
`order.deliveryAddress.coordinates`, never the customer's live GPS. This
eliminates coordinate conflicts between the customer's current location and the
locked delivery address.

---

## 8. Coordinate Architecture — Conflict Prevention

The locked-pin principle is enforced at three layers:

| Layer           | Enforcement                                                                        |
| --------------- | ---------------------------------------------------------------------------------- |
| Backend schema  | `deliveryAddress.coordinates` has no update endpoint                               |
| `OrdersService` | `deliveryAddress` is written in `create()`, never touched in `update()`            |
| Mobile          | Pin is shown read-only after order creation; consumer cannot re-submit coordinates |

Driver always reads coordinates from the order document, not from any live user
location API.

---

## 9. Shared Package — `CreateOrderDto` Update

`packages/shared/src/schemas/order.schemas.ts` (Zod) and the backend
`CreateOrderDto` (class-validator) both gain:

```ts
deliveryMode: z.enum(['pickup', 'delivery']).default('pickup');
deliveryAddress: z.object({
  city: z.string(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
}).optional();
```

Validation rule: if `deliveryMode === 'delivery'`, `deliveryAddress` is
required.

---

## 10. Files Changed (Summary)

| Action | File                                                                    | Reason                                              |
| ------ | ----------------------------------------------------------------------- | --------------------------------------------------- |
| Modify | `packages/shared/src/enums/user.enum.ts`                                | Add `DRIVER`                                        |
| Modify | `packages/shared/src/enums/order.enum.ts`                               | Add `OUT_FOR_DELIVERY`, `DELIVERED`                 |
| Modify | `packages/shared/src/schemas/order.schemas.ts`                          | Add `deliveryMode`, `deliveryAddress` to Zod schema |
| Modify | `apps/food-waste-backend/src/orders/schemas/order.schema.ts`            | Add 9 new fields + 3 new indexes                    |
| Modify | `apps/food-waste-backend/src/orders/DTO/create-order.dto.ts`            | Add `deliveryMode`, `deliveryAddress`               |
| Modify | `apps/food-waste-backend/src/orders/order.service.ts`                   | Compute delivery fields at creation                 |
| Create | `apps/food-waste-backend/src/common/utils/geo.util.ts`                  | Haversine distance utility                          |
| Create | `apps/food-waste-backend/src/drivers/drivers.module.ts`                 | Driver NestJS module                                |
| Create | `apps/food-waste-backend/src/drivers/drivers.controller.ts`             | 4 endpoints                                         |
| Create | `apps/food-waste-backend/src/drivers/drivers.service.ts`                | All business logic                                  |
| Create | `apps/food-waste-backend/src/drivers/dto/available-orders-query.dto.ts` | lat, lng, page, limit                               |
| Create | `apps/food-waste-backend/src/drivers/dto/unassign-order.dto.ts`         | reason (optional string)                            |
| Modify | `apps/food-waste-backend/src/app.module.ts`                             | Register DriversModule                              |
| Modify | `apps/mobile/src/navigation/RootNavigator.tsx`                          | Route DRIVER role to DriverStack                    |
| Create | `apps/mobile/src/features/driver/screens/DriverOrdersListScreen.tsx`    | Pool list                                           |
| Create | `apps/mobile/src/features/driver/screens/DriverOrderDetailScreen.tsx`   | Detail + Accept                                     |
| Create | `apps/mobile/src/features/driver/screens/DriverActiveOrderScreen.tsx`   | Navigate + Deliver                                  |
| Create | `apps/mobile/src/features/driver/hooks/useDriverOrders.ts`              | TanStack Query hook                                 |
| Create | `apps/mobile/src/features/driver/services/driver.service.ts`            | API calls                                           |
| Modify | `apps/mobile/src/features/orders/screens/CreateOrderScreen.tsx`         | Delivery mode toggle + map pin                      |

---

## 11. Security & Guard Chain

- All `/drivers/*` routes: `JwtAuthGuard → RolesGuard([UserRole.DRIVER])`
- `accept` and `unassign` use atomic DB operations — no application-level
  locking needed
- `driverCancellationCount` provides an audit trail for driver reliability
  monitoring
- Delivery coordinates are write-once — no endpoint allows updating
  `deliveryAddress` post-creation

---

## 12. Out of Scope (MVP)

- Real-time driver location tracking (WebSocket pub/sub)
- Driver earnings payout / weekly settlement UI
- Driver rating / review system
- Admin driver management dashboard (web)
- iOS Universal Links for navigation deep links (requires macOS runner)
- Driver ETA estimation
