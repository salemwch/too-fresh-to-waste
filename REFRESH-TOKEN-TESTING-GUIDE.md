# Refresh Token Testing & Verification Guide

## 🔍 Root Cause Analysis

### **Current Issue:**
You're seeing `[STATE-DRIVEN NAV] Session expired, logging out...` even though you should stay logged in via refresh token.

### **Why This Happens:**

1. **Access Token Expiration**: 15 minutes (from `JWT_EXPIRES_IN=15m`)
2. **Refresh Token Expiration**: 7 days (from `JWT_REFRESH_EXPIRES_IN=7d`)
3. **Session Expiration Check**: Located in `RootNavigator.tsx:138-146`
   ```typescript
   const checkSessionExpiration = () => {
     const now = Date.now();
     const expiresAt = new Date(sessionExpiresAt).getTime();

     if (now >= expiresAt) {
       console.warn('[STATE-DRIVEN NAV] Session expired, logging out...');
       // ⚠️ NOTE: This only LOGS a warning, it doesn't actually logout
     }
   };
   ```

4. **The Problem**:
   - `sessionExpiresAt` is set to the **ACCESS token** expiration (15 min), not REFRESH token (7 days)
   - After 15 minutes, the warning appears
   - The user is NOT actually logged out (it's just a warning)
   - The refresh token interceptor (`apiClient.ts:108-151`) should automatically refresh when the next API call gets a 401

5. **The Real Issue**:
   - If no API calls happen after access token expires, the warning shows but user stays "logged in"
   - User might think they're logged out when they're not
   - Need to verify refresh token actually works when a 401 occurs

---

## ✅ Step-by-Step Testing Protocol

### **Test 1: Verify Tokens Are Stored**

**Purpose**: Ensure both access and refresh tokens are being saved correctly.

```typescript
// Add this to LoginScreen.tsx after successful login
import SecureStorage from '@/services/SecureStorage';

// After login success:
const storedTokens = await SecureStorage.getTokens();
console.log('🔐 Stored Access Token:', storedTokens.accessToken?.substring(0, 20) + '...');
console.log('🔐 Stored Refresh Token:', storedTokens.refreshToken?.substring(0, 20) + '...');
```

**Expected Result**: Both tokens should be present.

**✅ Pass**: Both tokens exist
**❌ Fail**: Tokens are null/undefined → Check SecureStorage implementation

---

### **Test 2: Verify Access Token Expiration Time**

**Purpose**: Confirm the access token actually expires in 15 minutes.

```typescript
// Add this to authSlice.ts in loginAsync.fulfilled
console.log('⏱️  Access Token Expires In:', action.payload.tokens.expiresIn, 'seconds');
console.log('⏱️  That is:', action.payload.tokens.expiresIn / 60, 'minutes');
console.log('⏱️  Session Expires At:', state.sessionExpiresAt);
```

**Expected Result**:
- `expiresIn: 900` (900 seconds = 15 minutes)
- `sessionExpiresAt`: Should be ~15 minutes from now

**✅ Pass**: Values match expectations
**❌ Fail**: expiresIn is wrong → Check backend `JWT_EXPIRES_IN` env var

---

### **Test 3: Force Access Token Expiration**

**Purpose**: Trigger a 401 and verify the refresh token interceptor works.

**Method 1: Shorten Access Token Expiry (Backend)**

1. Edit `apps/food-waste-backend/.env`:
   ```
   JWT_EXPIRES_IN=2m  # Change from 15m to 2m for testing
   ```

2. Restart backend:
   ```bash
   cd apps/food-waste-backend
   pnpm run start:dev
   ```

3. Login to mobile app

4. Wait 2 minutes 30 seconds (access token expires)

5. Trigger an API call (pull-to-refresh, navigate to different screen, etc.)

6. Check console logs:
   ```
   Access token expired, attempting refresh...  ← Should appear
   Token refresh successful, retrying original request ← Should appear
   ```

**Expected Behavior**:
1. API call fails with 401
2. Interceptor catches 401
3. Calls `refreshTokenAsync()`
4. Gets new access token
5. Retries original request
6. Request succeeds

**✅ Pass**: Request succeeds after refresh
**❌ Fail**: Request fails or logout happens → See Debugging section

---

**Method 2: Manually Corrupt Access Token (Mobile)**

```typescript
// Add this temporary code to any screen
import { store } from '@/store';

const testRefreshToken = async () => {
  const state = store.getState();
  console.log('🧪 Before corruption:', state.auth.tokens?.accessToken?.substring(0, 20));

  // Corrupt the access token (make it invalid)
  store.dispatch({
    type: 'auth/setTokens',
    payload: {
      ...state.auth.tokens,
      accessToken: 'corrupted.invalid.token'
    }
  });

  console.log('🧪 Corrupted token, now making API call...');

  // Make any API call (e.g., fetch offers)
  const response = await offersService.getAllOffers({ limit: 5 });

  console.log('🧪 After refresh, got response:', response);
};
```

**Expected Result**:
- First API call fails with 401
- Refresh token interceptor triggers
- New access token obtained
- Original request retried and succeeds

**✅ Pass**: API call succeeds
**❌ Fail**: API call fails → Refresh token might be expired or invalid

---

### **Test 4: Verify Refresh Token Endpoint**

**Purpose**: Ensure the backend refresh endpoint is working.

**Using cURL:**
```bash
# 1. Login first to get tokens
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Copy the refreshToken from response

# 2. Test refresh endpoint
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "PASTE_REFRESH_TOKEN_HERE"
  }'
```

**Expected Response:**
```json
{
  "statusCode": 200,
  "data": {
    "message": "Token refreshed successfully",
    "tokens": {
      "accessToken": "new.jwt.token",
      "refreshToken": "new.refresh.token",
      "expiresIn": 900
    }
  }
}
```

**✅ Pass**: New tokens returned
**❌ Fail**: 401 Unauthorized → Refresh token might be expired/invalid

---

### **Test 5: Monitor Interceptor Behavior (Live)**

**Purpose**: Watch the interceptor in action during normal use.

**Add Enhanced Logging** to `apps/mobile/src/services/apiClient.ts`:

```typescript
// Line 108 - Add more detailed logs
if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
  console.log('🚨 401 DETECTED');
  console.log('   URL:', originalRequest.url);
  console.log('   Is Refreshing?:', isRefreshing);
  console.log('   Retry Flag:', originalRequest._retry);

  if (isRefreshing) {
    console.log('⏳ QUEUEING REQUEST (refresh in progress)');
    // ... existing queue logic
  }

  originalRequest._retry = true;
  isRefreshing = true;

  try {
    console.log('🔄 STARTING REFRESH TOKEN FLOW...');
    const result = await store.dispatch(refreshTokenAsync());

    if (refreshTokenAsync.fulfilled.match(result)) {
      console.log('✅ REFRESH SUCCESSFUL');
      console.log('   New Access Token:', result.payload.tokens.accessToken.substring(0, 20) + '...');
      console.log('   Retrying original request...');
      processQueue();
      isRefreshing = false;

      const newAccessToken = result.payload.tokens.accessToken;
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return client(originalRequest);
    }
    throw new Error('Token refresh failed');
  } catch (refreshError) {
    console.error('❌ REFRESH FAILED:', refreshError);
    console.log('   Logging out user...');
    // ... existing error logic
  }
}
```

**Test Flow**:
1. Login
2. Wait for access token to expire (15 min or 2 min if you changed it)
3. Trigger any API call
4. Watch console logs

**Expected Logs Sequence**:
```
🚨 401 DETECTED
   URL: /api/v1/offers
   Is Refreshing?: false
   Retry Flag: undefined
🔄 STARTING REFRESH TOKEN FLOW...
✅ REFRESH SUCCESSFUL
   New Access Token: eyJhbGciOiJIUzI1NiIs...
   Retrying original request...
Token refresh successful, retrying original request
```

**✅ Pass**: Flow completes successfully
**❌ Fail**: Stops at any point → See Debugging section

---

### **Test 6: Verify Session Persistence (App Restart)**

**Purpose**: Ensure tokens persist across app restarts.

**Steps**:
1. Login to mobile app
2. Close app completely (kill it)
3. Reopen app
4. Check logs for:
   ```
   [STATE-DRIVEN NAV] Session restored, flowState = AUTHENTICATED
   ```

**Expected Behavior**:
- App loads
- `loadStoredAuthAsync` runs
- Tokens loaded from SecureStorage
- User stays logged in

**✅ Pass**: User stays logged in
**❌ Fail**: User logged out → Check SecureStorage persistence

---

## 🐛 Debugging Common Issues

### **Issue 1: "No refresh token available"**

**Log**:
```
Token refresh failed
Error: No refresh token available
```

**Cause**: Refresh token not in Redux state

**Fix**:
```typescript
// Check authSlice.ts line 241-245
const refreshToken = state.auth.tokens?.refreshToken;
if (refreshToken == null || refreshToken === '') {
  // This is the problem - refresh token is missing
}
```

**Solution**: Verify tokens are being saved in `loginAsync.fulfilled`:
```typescript
builder.addCase(loginAsync.fulfilled, (state, action) => {
  state.tokens = action.payload.tokens; // ← Should save BOTH tokens
  // ...
});
```

---

### **Issue 2: Refresh endpoint returns 401**

**Log**:
```
Token refresh failed
Response status: 401
```

**Cause**: Refresh token is expired or invalid

**Possible Reasons**:
1. **Refresh token expired** (7 days passed) → User must login again
2. **Refresh token was invalidated** (logout from another device, security event)
3. **Backend error** (database issue, token blacklist check failed)

**Fix**: Check backend logs:
```bash
cd apps/food-waste-backend
pnpm run start:dev

# Watch for logs like:
# "Refresh token expired"
# "Refresh token not found in database"
# "Token blacklisted"
```

---

### **Issue 3: Interceptor not triggering**

**Log**:
```
// No logs about refresh token attempt
```

**Cause**: 401 not being caught by interceptor

**Checklist**:
- [ ] Is the request using `apiClient` instance? (Not plain axios)
- [ ] Is the error actually a 401? (Check network tab)
- [ ] Is `originalRequest._retry` already true? (Prevents infinite loops)

**Fix**: Ensure all API services use the shared `apiClient`:
```typescript
// ✅ CORRECT
import { apiClient } from '@/services/apiClient';
const response = await apiClient.get('/offers');

// ❌ WRONG
import axios from 'axios';
const response = await axios.get('http://localhost:3000/api/v1/offers');
```

---

### **Issue 4: Multiple refresh attempts**

**Log**:
```
🔄 STARTING REFRESH TOKEN FLOW...
🔄 STARTING REFRESH TOKEN FLOW...
🔄 STARTING REFRESH TOKEN FLOW...
```

**Cause**: Race condition when multiple requests fail simultaneously

**Expected Behavior**:
- First request triggers refresh
- Subsequent requests are queued
- After refresh completes, queued requests retry

**Fix**: Verify `isRefreshing` flag logic:
```typescript
if (isRefreshing) {
  // ✅ This should queue the request
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  }).then(() => client(originalRequest));
}
```

---

### **Issue 5: Session warning but not logged out**

**Log**:
```
[STATE-DRIVEN NAV] Session expired, logging out...
// But user is still in the app
```

**Cause**: The RootNavigator check is based on ACCESS token expiration, not REFRESH token

**This is EXPECTED BEHAVIOR**:
- Warning appears after 15 minutes (access token expires)
- User is NOT actually logged out
- Refresh token is still valid for 7 days
- Next API call will auto-refresh

**Fix (Optional - Remove Confusing Warning)**:

Edit `apps/mobile/src/navigation/RootNavigator.tsx`:

```typescript
// OPTION 1: Remove the warning log (lines 138-146)
// Delete or comment out the useEffect that checks sessionExpiresAt

// OPTION 2: Base the check on REFRESH token expiration instead
// This requires adding refreshTokenExpiresAt to Redux state
```

---

## 📊 Monitoring & Verification Checklist

### **Production-Ready Checklist**

- [ ] **Access token expires in 15 minutes** (Verify: check logs after login)
- [ ] **Refresh token expires in 7 days** (Verify: backend env var)
- [ ] **401 triggers refresh flow** (Verify: Test 3)
- [ ] **Refresh endpoint works** (Verify: Test 4)
- [ ] **Tokens persist across restarts** (Verify: Test 6)
- [ ] **Failed queue processes correctly** (Verify: Multiple simultaneous requests)
- [ ] **Logout on refresh failure** (Verify: Use expired refresh token)
- [ ] **No infinite refresh loops** (Verify: `_retry` flag works)
- [ ] **Secure token storage** (Verify: Keychain/Keystore used, not AsyncStorage)

---

## 🎯 Recommended Solution

### **Problem**: Confusing "Session expired" warning when user is still logged in

### **Solution**: Update the session expiration check to be based on REFRESH token, not ACCESS token

#### **Step 1: Add Refresh Token Expiry to Redux State**

Edit `apps/mobile/src/features/auth/store/authSlice.ts`:

```typescript
export interface AuthState {
  // ... existing fields
  sessionExpiresAt: string | null; // Access token expiration
  refreshTokenExpiresAt: string | null; // ← ADD THIS
}

const initialState: AuthState = {
  // ... existing fields
  sessionExpiresAt: null,
  refreshTokenExpiresAt: null, // ← ADD THIS
};
```

#### **Step 2: Update Login Success Handler**

```typescript
builder.addCase(loginAsync.fulfilled, (state, action) => {
  // ... existing code

  // Access token expiration (15 min)
  const accessExpiresAt = new Date(Date.now() + action.payload.tokens.expiresIn * 1000);
  state.sessionExpiresAt = accessExpiresAt.toISOString();

  // ✅ ADD: Refresh token expiration (7 days)
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  state.refreshTokenExpiresAt = refreshExpiresAt.toISOString();
});
```

#### **Step 3: Update RootNavigator Check**

Edit `apps/mobile/src/navigation/RootNavigator.tsx`:

```typescript
useEffect(() => {
  // Use REFRESH token expiration instead of ACCESS token
  const {refreshTokenExpiresAt} = useSelector((state: RootState) => state.auth);

  if (
    flowState !== AuthFlowState.AUTHENTICATED ||
    refreshTokenExpiresAt === null ||
    refreshTokenExpiresAt === undefined ||
    refreshTokenExpiresAt === ''
  ) {
    return;
  }

  const checkSessionExpiration = () => {
    const now = Date.now();
    const expiresAt = new Date(refreshTokenExpiresAt).getTime(); // ← Changed

    if (now >= expiresAt) {
      console.warn('[STATE-DRIVEN NAV] Refresh token expired, logging out...');
      // Dispatch logout
      store.dispatch(logoutAsync());
    }
  };

  checkSessionExpiration();
  const intervalId = setInterval(checkSessionExpiration, 60000);
  return () => clearInterval(intervalId);
}, [flowState, refreshTokenExpiresAt]); // ← Changed dependency
```

---

## 📝 Quick Test Script

Create `apps/mobile/src/utils/testRefreshToken.ts`:

```typescript
import { store } from '@/store';
import { offersService } from '@/features/offers/services/offersService';

export const testRefreshTokenFlow = async () => {
  console.log('🧪 === REFRESH TOKEN TEST START ===');

  const state = store.getState();
  const { accessToken, refreshToken } = state.auth.tokens || {};

  console.log('1️⃣ Current Tokens:');
  console.log('   Access Token:', accessToken?.substring(0, 30) + '...');
  console.log('   Refresh Token:', refreshToken?.substring(0, 30) + '...');
  console.log('   Expires At:', state.auth.sessionExpiresAt);

  console.log('\n2️⃣ Corrupting access token...');
  // Temporarily corrupt the access token to force 401
  const originalToken = accessToken;
  store.dispatch({
    type: 'auth/setTokens',
    payload: {
      accessToken: 'invalid.corrupt.token',
      refreshToken: refreshToken
    }
  });

  console.log('\n3️⃣ Making API call with corrupted token...');
  try {
    const offers = await offersService.getAllOffers({ limit: 1 });
    console.log('✅ SUCCESS: Got offers after refresh:', offers.length);

    const newState = store.getState();
    console.log('\n4️⃣ New Token After Refresh:');
    console.log('   Access Token:', newState.auth.tokens?.accessToken?.substring(0, 30) + '...');
    console.log('   Is Different?:', newState.auth.tokens?.accessToken !== originalToken);

    console.log('\n🎉 REFRESH TOKEN TEST PASSED');
    return true;
  } catch (error) {
    console.error('❌ FAILED: Refresh token did not work');
    console.error('Error:', error);
    return false;
  }
};

// Usage: Call this from any screen
// import { testRefreshTokenFlow } from '@/utils/testRefreshToken';
// await testRefreshTokenFlow();
```

---

## 📚 Summary

### **TL;DR - Is Refresh Token Working?**

**Quick Check**:
1. Login to app
2. Wait 15+ minutes (or change `JWT_EXPIRES_IN=2m` for faster testing)
3. Trigger any API call (pull-to-refresh, navigate, etc.)
4. **✅ If request succeeds** → Refresh token is working!
5. **❌ If logged out** → Refresh token is NOT working, see debugging section

### **What You Should See** (Normal Operation):
```
// After 15 minutes:
[STATE-DRIVEN NAV] Session expired, logging out...  ← Just a warning, ignore this

// When next API call happens:
Access token expired, attempting refresh...
Token refresh successful, retrying original request
✅ Request completed successfully
```

### **What Indicates a Problem**:
```
// After 15 minutes:
[STATE-DRIVEN NAV] Session expired, logging out...

// When next API call happens:
Token refresh failed
❌ Logging out user
← You're redirected to login screen
```

---

**Status**: Ready for Testing
**Next Steps**: Run Tests 1-6 in order to verify 100% functionality
