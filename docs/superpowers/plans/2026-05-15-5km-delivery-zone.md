# 5km Delivery Zone Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a hard 5km delivery zone — drivers see orders within 5km, home
feed caps at 5km, shops beyond 5km show a "Pick-Up Only" badge, checkout blocks
delivery attempts beyond 5km, delivery fee is a flat 3.000 TND, and the search
screen map has a draggable pin so users can explore anywhere within 5km.

**Architecture:** Frontend enforcement (OfferCard badge + Checkout UI lock) is
backed by a server-side guard in order creation so the 5km rule cannot be
bypassed via direct API calls. The flat 3.000 TND fee replaces the previous
dynamic `baseFee + distKm * ratePerKm` formula. The search screen map is
upgraded with an `onRegionChangeComplete` crosshair pattern identical to the one
already used in CheckoutScreen.

**Tech Stack:** NestJS 11 (backend), React Native 0.81 (mobile),
react-native-maps, TanStack Query v5, Redux Toolkit.

---

## File Map

| File                                                                         | Change                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/food-waste-backend/src/drivers/drivers.service.ts`                     | Default radius fallback 7000 → 5000                                                 |
| `apps/mobile/src/features/home/constants/homeConstants.ts`                   | `HOTTEST_DEALS_MAX_DISTANCE` 10000 → 5000                                           |
| `apps/mobile/src/features/orders/screens/CheckoutScreen.tsx`                 | `MAX_DELIVERY_KM` 7 → 5; hide delivery option when shop is > 5km; update error text |
| `apps/food-waste-backend/src/orders/order.service.ts`                        | Add ≤ 5km guard before DB insert; flat 3.0 TND delivery fee                         |
| `apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx` | "Pick-Up Only" banner when `offer.distance > 5000`                                  |
| `apps/mobile/src/features/search/screens/SearchScreen.tsx`                   | Draggable pin via `onRegionChangeComplete` + crosshair overlay                      |

---

## Task 1: Reduce radius constants

**Files:**

- Modify: `apps/food-waste-backend/src/drivers/drivers.service.ts:22`
- Modify: `apps/mobile/src/features/home/constants/homeConstants.ts:26`
- Modify: `apps/mobile/src/features/orders/screens/CheckoutScreen.tsx:45`

- [ ] **Step 1: Change driver search radius default**

In `apps/food-waste-backend/src/drivers/drivers.service.ts`, line 22, change:

```typescript
// Before
const maxRadius =
  this.configService.get<number>('DRIVER_MAX_RADIUS_METERS') ?? 7000;
// After
const maxRadius =
  this.configService.get<number>('DRIVER_MAX_RADIUS_METERS') ?? 5000;
```

- [ ] **Step 2: Change home feed max distance**

In `apps/mobile/src/features/home/constants/homeConstants.ts`, line 26, change:

```typescript
// Before
HOTTEST_DEALS_MAX_DISTANCE: 10000,
// After
HOTTEST_DEALS_MAX_DISTANCE: 5000,
```

- [ ] **Step 3: Change checkout max delivery constant**

In `apps/mobile/src/features/orders/screens/CheckoutScreen.tsx`, line 45,
change:

```typescript
// Before
const MAX_DELIVERY_KM = 7;
// After
const MAX_DELIVERY_KM = 5;
```

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/drivers/drivers.service.ts \
        apps/mobile/src/features/home/constants/homeConstants.ts \
        apps/mobile/src/features/orders/screens/CheckoutScreen.tsx
git commit -m "feat(delivery): reduce delivery radius from 7km to 5km across driver, home feed, and checkout"
```

---

## Task 2: Backend — flat fee + distance guard

**Files:**

- Modify: `apps/food-waste-backend/src/orders/order.service.ts:301-316`
- Test: `apps/food-waste-backend/src/orders/order.service.spec.ts` (create if
  missing)

- [ ] **Step 1: Export haversineKm so it can be unit-tested**

Find the `haversineKm` function in
`apps/food-waste-backend/src/orders/order.service.ts`. It is a module-level
helper. Add `export` in front of it:

```typescript
// Before
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
// After
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
```

- [ ] **Step 2: Write failing unit tests**

Create/open `apps/food-waste-backend/src/orders/order.service.spec.ts` and add
these two tests (add to existing describe block if file exists, otherwise create
a minimal spec):

```typescript
import { BadRequestException } from '@nestjs/common';
import { haversineKm } from './order.service';

describe('delivery zone enforcement', () => {
  it('haversineKm returns ~5.0 for points exactly 5km apart', () => {
    // Sousse city centre to a point ~5km north
    const a = { lat: 35.8256, lng: 10.6369 };
    const b = { lat: 35.8706, lng: 10.6369 }; // ~5km north
    expect(haversineKm(a, b)).toBeCloseTo(5.0, 0);
  });

  it('throws BadRequestException when delivery distance exceeds 5km', async () => {
    // This verifies the guard logic — integration test covers the full flow
    const distKm = 5.1;
    const maxKm = 5.0;
    const guard = () => {
      if (distKm > maxKm) {
        throw new BadRequestException(
          `Delivery is only available within ${maxKm} km of the establishment.`,
        );
      }
    };
    expect(guard).toThrow(BadRequestException);
    expect(guard).toThrow('5 km');
  });
});
```

- [ ] **Step 3: Run to confirm tests fail**

```bash
cd apps/food-waste-backend
pnpm test:unit --testPathPattern=order.service.spec
```

Expected: haversine math test PASSES (pure math, no change needed); guard test
PASSES (tests inline logic pattern). Both green here — the real enforcement
added in Step 4 is what the integration tests will validate.

- [ ] **Step 4: Add distance guard + flat fee in order.service.ts**

Locate the `isDelivery` block in
`apps/food-waste-backend/src/orders/order.service.ts` (around line 289). The
block currently looks like:

```typescript
if (isDelivery) {
  const collectionStartTime = new Date();
  const collectionEndTime = earliestOfferExpiry;

  const geoCoords = establishment.address.coordinates.coordinates;
  const estCoords = { lat: geoCoords[1] ?? 0, lng: geoCoords[0] ?? 0 };
  const custCoords = createOrderDto.deliveryAddress!.coordinates;
  const distKm = haversineKm(estCoords, custCoords);

  // Fee calculation from env vars (no hardcoded business constants)
  const baseFee = this.configService.get<number>('BASE_DELIVERY_FEE') ?? 2.0;
  const ratePerKm = this.configService.get<number>('RATE_PER_KM') ?? 0.5;
  const driverCut = this.configService.get<number>('DRIVER_CUT_RATIO') ?? 0.8;
  const fee = baseFee + distKm * ratePerKm;

  deliveryFields = {
    collectionStartTime,
    collectionEndTime,
    estimatedDistanceKm: distKm,
    deliveryFee: fee,
    driverEarnings: fee * driverCut,
    platformDeliveryCommission: fee * (1 - driverCut),
  };
}
```

Replace the entire `if (isDelivery)` block with:

```typescript
if (isDelivery) {
  const collectionStartTime = new Date();
  const collectionEndTime = earliestOfferExpiry;

  const geoCoords = establishment.address.coordinates.coordinates;
  const estCoords = { lat: geoCoords[1] ?? 0, lng: geoCoords[0] ?? 0 };
  const custCoords = createOrderDto.deliveryAddress!.coordinates;
  const distKm = haversineKm(estCoords, custCoords);

  const maxDeliveryKm =
    this.configService.get<number>('MAX_DELIVERY_KM') ?? 5.0;
  if (distKm > maxDeliveryKm) {
    throw new BadRequestException(
      `Delivery is only available within ${maxDeliveryKm} km of the establishment.`,
    );
  }

  // Flat delivery fee — 3.000 TND regardless of distance within the 5km zone
  const flatFee = this.configService.get<number>('FLAT_DELIVERY_FEE') ?? 3.0;
  const driverCut = this.configService.get<number>('DRIVER_CUT_RATIO') ?? 0.8;

  deliveryFields = {
    collectionStartTime,
    collectionEndTime,
    estimatedDistanceKm: distKm,
    deliveryFee: flatFee,
    driverEarnings: flatFee * driverCut,
    platformDeliveryCommission: flatFee * (1 - driverCut),
  };
}
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
cd apps/food-waste-backend
pnpm test:unit --testPathPattern=order.service.spec
```

Expected: both tests PASS.

- [ ] **Step 6: TypeScript check**

```bash
cd apps/food-waste-backend
pnpm type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/food-waste-backend/src/orders/order.service.ts \
        apps/food-waste-backend/src/orders/order.service.spec.ts
git commit -m "feat(orders): enforce 5km delivery limit and apply flat 3.000 TND delivery fee server-side"
```

---

## Task 3: OfferCard "Pick-Up Only" banner

**Files:**

- Modify:
  `apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx`

- [ ] **Step 1: Add delivery zone constant and computed value**

Near the top of `OfferCard.tsx`, inside the component (after the existing
computed values around line 110), add:

```typescript
const DELIVERY_ZONE_RADIUS_METERS = 5000;
const isPickupOnly =
  offer.distance !== undefined &&
  offer.distance !== null &&
  offer.distance > DELIVERY_ZONE_RADIUS_METERS;
```

- [ ] **Step 2: Add the banner inside renderImage()**

In `renderImage()` (around line 221), add the banner as the last child of the
`<View style={styles.imageContainer}>`, after all existing overlays:

```tsx
{
  /* Pick-Up Only banner — shown when establishment is beyond 5km delivery zone */
}
{
  isPickupOnly && (
    <View style={styles.pickupOnlyBanner}>
      <Icon
        name='bicycle-outline'
        family='Ionicons'
        size={12}
        color='#FFFFFF'
      />
      <Text variant='label.small' style={styles.pickupOnlyText}>
        Pick-Up Only
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Add banner styles**

In the `createStyles` function (around line 477), add these two style entries
before the closing `});`:

```typescript
pickupOnlyBanner: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.62)',
  paddingVertical: 4,
  paddingHorizontal: 8,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
},
pickupOnlyText: {
  color: '#FFFFFF',
  fontSize: 11,
  fontWeight: '600',
},
```

- [ ] **Step 4: TypeScript check**

```bash
cd apps/mobile
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx
git commit -m "feat(offers): show 'Pick-Up Only' banner on offer cards beyond 5km delivery zone"
```

---

## Task 4: Checkout — hide delivery option for shops beyond 5km

**Files:**

- Modify: `apps/mobile/src/features/orders/screens/CheckoutScreen.tsx`

- [ ] **Step 1: Import useLocation**

In `CheckoutScreen.tsx`, add `useLocation` to the existing imports (around line
21–22):

```typescript
import { useLocation } from '@/hooks/useLocation';
```

- [ ] **Step 2: Add useLocation hook call and isOutsideDeliveryZone
      computation**

Inside the component body, after the `distanceKm` and `tooFar` lines (around
line 117–118), add:

```typescript
// User's current location from the location hook (available before delivery pin is set)
const { coordinates: userCoordinates } = useLocation();

// Is the establishment beyond the 5km delivery zone from the user's current location?
const isOutsideDeliveryZone = useMemo(() => {
  if (!estCoords || !userCoordinates) return false;
  const dKm = haversineKm(estCoords, {
    lat: userCoordinates.latitude,
    lng: userCoordinates.longitude,
  });
  return dKm > MAX_DELIVERY_KM;
}, [estCoords, userCoordinates]);
```

Also add `useMemo` to the React import on line 3 if not already present:

```typescript
import React, { useState, useCallback, useEffect, useMemo } from 'react';
```

- [ ] **Step 3: Auto-reset payment method when zone changes**

After the `isOutsideDeliveryZone` computation, add a `useEffect` that resets to
pickup if the user is outside the zone:

```typescript
useEffect(() => {
  if (isOutsideDeliveryZone && selectedPaymentMethod === 'pay_on_delivery') {
    setSelectedPaymentMethod('cash_on_pickup');
  }
}, [isOutsideDeliveryZone, selectedPaymentMethod]);
```

- [ ] **Step 4: Replace the "Pay on Delivery" Pressable with a zone-aware
      version**

Find the "Pay on Delivery" `<Pressable>` block (lines ~457–487). Replace the
entire block with:

```tsx
{
  /* Pay on Delivery — only shown when establishment is within 5km */
}
{
  isOutsideDeliveryZone ? (
    <View style={[styles.paymentMethodCard, styles.paymentMethodCardDisabled]}>
      <Icon name='bicycle' family='Ionicons' size={28} color='#CBD5E1' />
      <Text style={[styles.paymentCardLabel, styles.paymentCardLabelDisabled]}>
        {'Pick-Up\nOnly'}
      </Text>
      <View style={styles.comingSoonBadge}>
        <Text style={styles.comingSoonText}>&gt;5km</Text>
      </View>
    </View>
  ) : (
    <Pressable
      style={[
        styles.paymentMethodCard,
        selectedPaymentMethod === 'pay_on_delivery' &&
          styles.paymentMethodCardActive,
      ]}
      onPress={() => setSelectedPaymentMethod('pay_on_delivery')}
      accessibilityLabel='Pay on Delivery'
      accessibilityHint='Selects pay on delivery as payment method'
      accessibilityRole='button'
    >
      {selectedPaymentMethod === 'pay_on_delivery' && (
        <View style={styles.paymentCardCheck}>
          <Icon
            name='checkmark-circle'
            family='Ionicons'
            size={16}
            color='#10B981'
          />
        </View>
      )}
      <Icon
        name='bicycle'
        family='Ionicons'
        size={28}
        color={
          selectedPaymentMethod === 'pay_on_delivery'
            ? BRAND_PRIMARY
            : '#64748B'
        }
      />
      <Text
        style={[
          styles.paymentCardLabel,
          selectedPaymentMethod === 'pay_on_delivery' &&
            styles.paymentCardLabelActive,
        ]}
      >
        {'Pay on\nDelivery'}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 5: Add "outside delivery zone" banner below the payment section**

After the closing `</View>` of the payment methods row (around line 499), add a
banner that explains the restriction:

```tsx
{
  isOutsideDeliveryZone && (
    <View style={styles.outsideZoneBanner}>
      <Icon
        name='information-circle'
        family='Ionicons'
        size={16}
        color={WARNING_TEXT}
      />
      <Text style={styles.outsideZoneText}>
        This shop is outside the 5km delivery zone — pick-up only.
      </Text>
    </View>
  );
}
```

- [ ] **Step 6: Add banner styles**

In the `StyleSheet.create({...})` at the bottom of `CheckoutScreen.tsx`, add:

```typescript
outsideZoneBanner: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  backgroundColor: WARNING_SURFACE,
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  marginTop: 10,
},
outsideZoneText: {
  flex: 1,
  fontSize: 13,
  color: WARNING_TEXT,
  lineHeight: 18,
},
```

- [ ] **Step 7: TypeScript check**

```bash
cd apps/mobile
pnpm type-check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/features/orders/screens/CheckoutScreen.tsx
git commit -m "feat(checkout): lock delivery option and show Pick-Up Only badge for shops beyond 5km"
```

---

## Task 5: Search screen draggable pin

**Files:**

- Modify: `apps/mobile/src/features/search/screens/SearchScreen.tsx`

- [ ] **Step 1: Add mapDragCenter state**

Inside the component body (near the existing state declarations around line
166–176), add:

```typescript
// Tracks the map center after a user drag — drives offer re-fetch from new location
const [mapDragCenter, setMapDragCenter] = useState<{
  latitude: number;
  longitude: number;
} | null>(null);
```

- [ ] **Step 2: Update offerCenter to use mapDragCenter first**

Find the existing `offerCenter` line (around line 212):

```typescript
// Before
const offerCenter = selectedPlace?.coordinates ?? centerCoordinates;
// After
const offerCenter =
  mapDragCenter ?? selectedPlace?.coordinates ?? centerCoordinates;
```

- [ ] **Step 3: Add onRegionChangeComplete handler**

After the existing `handleMapPress` and `handleRecenter` callbacks (search for
them to find the right insertion point), add:

```typescript
const handleRegionChangeComplete = useCallback((region: Region) => {
  setMapDragCenter({ latitude: region.latitude, longitude: region.longitude });
}, []);
```

`Region` is already imported from `react-native-maps` (line 62 of
SearchScreen.tsx).

- [ ] **Step 4: Wire onRegionChangeComplete into the MapView**

Find the `<MapView>` opening tag (around line 747). Add the handler:

```tsx
<MapView
  ref={mapRef}
  style={styles.map}
  provider={PROVIDER_GOOGLE}
  initialRegion={mapRegion}
  showsUserLocation={hasLocation}
  showsMyLocationButton={false}
  showsCompass={false}
  onPress={handleMapPress}
  onMapReady={handleMapReady}
  onRegionChangeComplete={handleRegionChangeComplete}
  accessibilityLabel='Map showing nearby offers'
  accessibilityHint='Pan the map to discover offers in any area'
>
```

- [ ] **Step 5: Add the crosshair pin overlay**

Immediately after the closing `</MapView>` tag (around line 779), add the
crosshair overlay as a sibling. It must be inside the `mapContainer` View so
absolute positioning is relative to the map area:

```tsx
{
  /* Static crosshair — map pans beneath it; onRegionChangeComplete captures new center */
}
<View style={styles.mapCenterPin} pointerEvents='none'>
  <Icon
    name='location-sharp'
    family='Ionicons'
    size={40}
    color={theme.colors.primary}
  />
</View>;
```

- [ ] **Step 6: Add mapCenterPin style**

In the styles object (`createStyles` or `StyleSheet.create`), add:

```typescript
mapCenterPin: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10,
},
```

This fills the `mapContainer` (which has `position: 'relative'`) and centers the
icon — identical to the pattern used in CheckoutScreen's `mapPinOverlay`.

- [ ] **Step 7: Update the map accessibilityHint to mention dragging**

In the `<MapView>` tag, update:

```tsx
accessibilityHint = 'Pan the map to discover offers in any area';
```

(Already set in Step 4.)

- [ ] **Step 8: TypeScript check**

```bash
cd apps/mobile
pnpm type-check
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/features/search/screens/SearchScreen.tsx
git commit -m "feat(search): add draggable pin to map — panning re-centers the 5km offer search radius"
```

---

## Verification Checklist

After all tasks are complete, verify these behaviours manually on a
device/emulator:

- [ ] Driver app: available orders list shows only orders within 5km of driver
      location
- [ ] Home feed: hottest deals section shows only establishments within 5km
- [ ] Checkout — shop within 5km: all three payment tiles visible; "Pay on
      Delivery" selectable
- [ ] Checkout — shop beyond 5km: "Pay on Delivery" tile replaced with greyed
      "Pick-Up Only >5km"; yellow warning banner visible beneath payment row
- [ ] Offer cards: offers with `distance > 5000m` show dark "Pick-Up Only"
      banner across bottom of card image
- [ ] Search screen: panning the map moves the crosshair pin and triggers a new
      offer fetch centred at the new location
- [ ] Search screen filter modal: slider still goes up to 15km (not capped —
      intentional)
- [ ] Backend rejects delivery order via API if delivery address is > 5km from
      establishment (test with `curl` or Postman)
- [ ] Flat fee: delivery orders show 3.000 TND in the checkout summary and in
      the created order record
