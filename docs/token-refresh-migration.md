# Token Refresh Migration Guide

## Problem Statement

Current mobile app has **NO automatic token refresh**. When access tokens expire:
- Requests fail with 401
- Users see errors
- Must manually logout/login

## Solution

Implement centralized API client with axios interceptors for automatic token refresh.

---

## Implementation Summary

### Created Files

1. **`apps/mobile/src/services/apiClient.ts`**
   - Centralized axios instance
   - Request interceptor: Auto-inject access token
   - Response interceptor: Detect 401, refresh token, retry request
   - Queue management for concurrent 401s

### Features

✅ **Automatic Token Injection** - No need to manually pass tokens
✅ **401 Detection** - Catches expired tokens
✅ **Token Refresh** - Calls `refreshTokenAsync` from Redux
✅ **Request Retry** - Automatically retries failed request with new token
✅ **Request Queueing** - Prevents multiple simultaneous refresh attempts
✅ **Logout on Refresh Failure** - Handles invalid refresh tokens

---

## Migration Steps

### Step 1: Update Offers Service

**Before** (manual token management):
```typescript
// apps/mobile/src/features/offers/services/offersService.ts
async createOffer(payload: CreateOfferPayload, accessToken: string): Promise<Offer> {
  return this.makeRequest<Offer>('POST', this.baseURL, payload, {
    Authorization: `Bearer ${accessToken}`,
  });
}
```

**After** (automatic via interceptor):
```typescript
import { apiClient, unwrapResponse } from '@/services/apiClient';

async createOffer(payload: CreateOfferPayload): Promise<Offer> {
  const response = await apiClient.post<ApiResponseWrapper<{ data: Offer }>>(
    '/offers',
    payload
  );
  return unwrapResponse(response.data);
}
```

### Step 2: Update Offers Hooks

**Before**:
```typescript
// apps/mobile/src/features/offers/hooks/useNearbyOffers.ts
const { tokens } = useAppSelector(state => state.auth);
const isEnabled = enabled && !!params && !!tokens?.accessToken;

return useQueryWithFocus(
  nearbyOffersKeys.offers(params),
  async () => {
    if (!params || !tokens?.accessToken) {
      throw new Error('Missing required parameters');
    }
    return nearbyOffersService.searchOffers(params, tokens.accessToken);
  },
  { enabled: isEnabled, ... }
);
```

**After**:
```typescript
// No need to check for tokens - interceptor handles it
const isEnabled = enabled && !!params;

return useQueryWithFocus(
  nearbyOffersKeys.offers(params),
  async () => {
    if (!params) {
      throw new Error('Missing required parameters');
    }
    return nearbyOffersService.searchOffers(params); // No token param needed
  },
  { enabled: isEnabled, ... }
);
```

### Step 3: Update All Service Methods

Apply the same pattern to all services:

**Offers Service** (`offersService.ts`):
- Remove `accessToken` parameters
- Replace `this.makeRequest()` with `apiClient.get/post/patch/delete()`
- Use `unwrapResponse()` helper

**Auth Service** (`authService.ts`):
- Keep as-is (auth endpoints don't need token injection)
- Login/register/refresh endpoints are handled differently

**Donations API** (`donationsApi.ts`):
- Replace `axios.create()` with shared `apiClient`
- Remove `setDonationsApiAuthToken()` function
- Tokens auto-injected by interceptor

---

## Example: Complete Service Migration

### Before
```typescript
class OffersService {
  private baseURL = `${environment.api.baseUrl}/offers`;

  private async makeRequest<T>(
    method: string,
    url: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const response = await axios({ method, url, data, headers });
    return response.data.data.data; // Manual unwrapping
  }

  async getOfferById(offerId: string): Promise<Offer> {
    return this.makeRequest('GET', `${this.baseURL}/${offerId}`);
  }

  async createOffer(payload: CreateOfferPayload, accessToken: string): Promise<Offer> {
    return this.makeRequest('POST', this.baseURL, payload, {
      Authorization: `Bearer ${accessToken}`, // Manual token
    });
  }
}
```

### After
```typescript
import { apiClient, unwrapResponse, ApiResponseWrapper } from '@/services/apiClient';

class OffersService {
  async getOfferById(offerId: string): Promise<Offer> {
    const response = await apiClient.get<ApiResponseWrapper<{ data: Offer }>>(
      `/offers/${offerId}`
    );
    return unwrapResponse(response.data);
  }

  async createOffer(payload: CreateOfferPayload): Promise<Offer> {
    const response = await apiClient.post<ApiResponseWrapper<{ data: Offer }>>(
      '/offers',
      payload
    );
    return unwrapResponse(response.data); // Automatic token injection via interceptor
  }
}
```

---

## Testing the Implementation

### 1. Test Automatic Token Injection

```typescript
// Before migration: Had to manually check for token
const { tokens } = useAppSelector(state => state.auth);
if (!tokens?.accessToken) return;

// After migration: Just call the service
const offer = await offersService.createOffer(payload); // Token auto-added
```

### 2. Test Token Refresh on 401

**Scenario**: Access token expired, but refresh token is valid

1. Make API request with expired access token
2. Backend returns 401
3. Interceptor detects 401
4. Calls `refreshTokenAsync()` automatically
5. Gets new access token
6. Retries original request with new token
7. User never sees error ✅

### 3. Test Logout on Refresh Failure

**Scenario**: Both access and refresh tokens expired

1. Make API request
2. Backend returns 401
3. Interceptor tries token refresh
4. Refresh fails (refresh token expired)
5. Automatically calls `logoutAsync()`
6. User sent to login screen ✅

---

## Migration Checklist

### Phase 1: Core Infrastructure ✅
- [x] Create `apiClient.ts` with interceptors
- [x] Add request interceptor (token injection)
- [x] Add response interceptor (401 handling)
- [x] Add request queueing logic
- [x] Create helper functions (`unwrapResponse`, `unwrapPaginatedResponse`)

### Phase 2: Service Migration
- [ ] Update `offersService.ts`
- [ ] Update `establishmentsService.ts` (if exists)
- [ ] Update `ordersService.ts` (if exists)
- [ ] Update `donationsApi.ts`
- [ ] Update any other services

### Phase 3: Hook Migration
- [ ] Remove token checks from `useOffers.ts`
- [ ] Remove token checks from `useNearbyOffers.ts`
- [ ] Remove token parameters from mutation hooks
- [ ] Update any custom hooks that pass tokens

### Phase 4: Testing
- [ ] Test login flow
- [ ] Test token refresh on 401
- [ ] Test concurrent requests during refresh
- [ ] Test refresh failure (force logout)
- [ ] Test all CRUD operations

### Phase 5: Cleanup
- [ ] Remove `setDonationsApiAuthToken` function
- [ ] Remove manual token checks in hooks
- [ ] Remove `accessToken` parameters from service methods
- [ ] Update TypeScript types

---

## Benefits After Migration

✅ **No more manual token management** - Interceptors handle everything
✅ **Seamless user experience** - Tokens refresh automatically in background
✅ **Less code** - Remove token checks from every hook/service
✅ **Type safety** - Centralized types for API responses
✅ **Consistent error handling** - One place to handle all API errors
✅ **Production-ready** - Follows industry best practices (Axios interceptors)

---

## References

- **Big platforms using this pattern**: Airbnb, Uber, Netflix mobile apps
- **Axios interceptors docs**: https://axios-http.com/docs/interceptors
- **JWT refresh best practices**: https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/
