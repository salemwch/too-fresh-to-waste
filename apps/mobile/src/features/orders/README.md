# Orders Feature - Just-in-Time Phone Verification

## Overview

This feature implements a sophisticated "Intercept & Retry" pattern for order creation with seamless phone verification integration. Users can browse and select offers freely, but when they attempt to create an order, the system intelligently handles phone verification if needed.

## Architecture

### Key Components

1. **useCreateOrder Hook** (`hooks/useCreateOrder.ts`)
   - Smart order creation with automatic retry logic
   - Catches `PHONE_VERIFICATION_REQUIRED` errors
   - Manages phone verification modal state
   - Stores pending order data for retry

2. **PhoneVerificationModal** (`components/PhoneVerificationModal.tsx`)
   - Bottom sheet modal for phone verification
   - Two states: Phone setup vs OTP verification
   - Automatic OTP detection (Android)
   - 60-second countdown for resend
   - Auto-retry order creation on success

3. **ordersService** (`services/ordersService.ts`)
   - API integration layer
   - Centralized error handling
   - Response unwrapping
   - Request cancellation support

4. **CheckoutScreen** (`screens/CheckoutScreen.tsx`)
   - Production-ready checkout flow
   - Real offer data integration
   - Loading and error states
   - Automatic phone verification fallback

## User Flow

```
User clicks "Reserve" on OfferDetailsScreen
  ↓
Navigate to CheckoutScreen
  ↓
User clicks "Confirm Order"
  ↓
Call useCreateOrder.createOrder(orderData)
  ↓
POST /orders API call
  ↓
┌─────────────────────────────────────────────┐
│ Backend Response                            │
├─────────────────────────────────────────────┤
│                                             │
│ IF: 200 Success                             │
│   → Order created                           │
│   → Navigate to OrderDetails                │
│                                             │
│ IF: 400 PHONE_VERIFICATION_REQUIRED         │
│   → Open PhoneVerificationModal             │
│   → Modal State A or B based on flags       │
│   → User completes verification             │
│   → Modal calls onVerificationComplete      │
│   → Auto-retry retryOrderCreation()         │
│   → Navigate to OrderDetails                │
│                                             │
│ ELSE: Other error                           │
│   → Show error alert                        │
│                                             │
└─────────────────────────────────────────────┘
```

## Modal States

### State A: Phone Setup (requiresPhoneSetup: true)

- User has NO phone number in database
- Show phone number input
- Format phone number (Tunisia +216)
- Send OTP via SMS
- Transition to State B

### State B: OTP Verification (requiresPhoneVerification: true)

- User has phone but not verified
- Show 6-digit OTP input
- Auto-verify when 6 digits entered
- Show attempts remaining
- 60-second resend countdown
- Automatic retry on success

## Best Practices Applied

### 1. DRY Principles

```typescript
// Shared error handling
const handleApiError = (error: unknown): Error => { ... }

// Shared API response types
interface PhoneVerificationResponse { ... }

// Reusable retry logic
const executeOrderCreation = useCallback(...)
```

### 2. Type Safety

- Full TypeScript coverage
- Type guards (`isPhoneVerificationRequired`)
- Explicit interface definitions
- Generic backend response types

### 3. Performance

- useCallback for event handlers
- useRef for non-reactive data (pendingOrderDataRef)
- Automatic request cancellation (AbortSignal)
- TanStack Query caching for offer data

### 4. User Experience

- No error toasts for phone verification (seamless modal)
- Automatic retry after verification
- Loading states
- Countdown timers
- Auto-focus inputs
- Keyboard dismissal
- Error messages with retry hints

### 5. Security

- Phone number validation
- Rate limiting (handled by backend)
- Secure OTP verification
- No sensitive data in logs

## Code Examples

### Using the Hook

```typescript
import { useCreateOrder } from '@/features/orders';

const {
  createOrder,
  isLoading,
  error,
  phoneVerificationModal,
  closePhoneVerificationModal,
  retryOrderCreation,
} = useCreateOrder();

const handleOrder = async () => {
  const orderData = { ... };
  const order = await createOrder(orderData);

  if (order) {
    // Success - phone was verified or not needed
    navigation.navigate('OrderDetails', { orderId: order.id });
  }
  // If null, modal will show automatically
};
```

### Rendering the Modal

```typescript
<PhoneVerificationModal
  visible={phoneVerificationModal.isVisible}
  requiresPhoneSetup={phoneVerificationModal.requiresPhoneSetup}
  requiresPhoneVerification={phoneVerificationModal.requiresPhoneVerification}
  onClose={closePhoneVerificationModal}
  onVerificationComplete={async () => {
    const order = await retryOrderCreation();
    if (order) {
      navigation.replace('OrderDetails', { orderId: order.id });
    }
  }}
/>
```

## Backend Integration

### POST /orders Endpoint

**Request:**

```json
{
  "items": [{ "offerId": "...", "quantity": 2 }],
  "establishmentId": "...",
  "pickupTimeSlot": { "startTime": "14:00", "endTime": "16:00" },
  "pickupDate": "2025-02-03T14:00:00.000Z",
  "paymentMethod": "stripe",
  "customerNotes": "..."
}
```

**Success Response (200):**

```json
{
  "statusCode": 201,
  "message": "Order created successfully",
  "data": { "id": "...", "orderNumber": "ORD-123456", ... }
}
```

**Phone Verification Required (400):**

```json
{
  "statusCode": 400,
  "message": "Phone verification required...",
  "code": "PHONE_VERIFICATION_REQUIRED",
  "requiresPhoneSetup": false,
  "requiresPhoneVerification": true
}
```

## Files Created

```
features/orders/
├── types/
│   └── order.types.ts              (Type definitions)
├── services/
│   └── ordersService.ts            (API integration)
├── hooks/
│   └── useCreateOrder.ts           (Smart retry logic)
├── components/
│   └── PhoneVerificationModal.tsx  (Modal component)
├── screens/
│   └── CheckoutScreen.tsx          (Updated implementation)
├── index.ts                        (Barrel exports)
└── README.md                       (This file)
```

## Future Enhancements

1. **Automatic OTP Detection (Android)**
   - Use `react-native-otp-verify`
   - Auto-fill OTP from SMS
   - Hash-based SMS verification

2. **Biometric Verification**
   - Use stored phone + biometrics
   - Skip OTP for verified devices

3. **Voice Call Fallback**
   - Alternative to SMS
   - Accessibility improvement

4. **Analytics Tracking**
   - Track verification funnel
   - Measure drop-off rates
   - A/B test flow variations

## Testing

### Unit Tests

```bash
# Test useCreateOrder hook
npm test useCreateOrder

# Test ordersService
npm test ordersService
```

### Integration Tests

```bash
# Test complete flow
npm test CheckoutScreen
```

### Manual Testing Checklist

- [ ] Order creation without phone (triggers modal)
- [ ] Order creation with unverified phone (triggers OTP)
- [ ] Order creation with verified phone (success)
- [ ] OTP verification success
- [ ] OTP verification failure (attempts tracking)
- [ ] OTP resend (countdown timer)
- [ ] Modal dismissal
- [ ] Network error handling
- [ ] Loading states
- [ ] Keyboard behavior

## Troubleshooting

### Modal doesn't show

- Check `phoneVerificationModal.isVisible` state
- Verify backend returns `PHONE_VERIFICATION_REQUIRED` error
- Check `isPhoneVerificationRequired` type guard

### Order not retrying after verification

- Ensure `onVerificationComplete` is called
- Check `retryOrderCreation` function
- Verify `pendingOrderDataRef` has data

### Phone number formatting issues

- Check Tunisia country code (+216)
- Verify `formatPhoneNumber` function
- Test with various input formats

## Support

For issues or questions, contact the development team or refer to the main project documentation.
