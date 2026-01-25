# Refresh Token - Best Practices & Testing Guide

## 🎯 Quick Start Testing

### **Step 1: Add Test Screen to Navigator**

Edit `apps/mobile/src/navigation/MainStack.tsx`:

```typescript
import { RefreshTokenTestScreen } from '@/features/auth/screens/RefreshTokenTestScreen';

// Add to your stack:
<Stack.Screen
  name="RefreshTokenTest"
  component={RefreshTokenTestScreen}
  options={{ title: 'Test Refresh Token' }}
/>
```

### **Step 2: Login and Navigate to Test Screen**

1. Login to your app
2. Navigate to the test screen (add a button temporarily or use deep link)
3. You should see your current tokens and session expiration

### **Step 3: Run Tests**

**Option A: Quick Test (30 seconds)**
- Click "Quick Test (Interceptor Only)"
- This will:
  1. Corrupt your access token
  2. Make an API call
  3. Verify the interceptor catches 401 and refreshes
  4. Show ✅ or ❌ result

**Option B: Full Test Suite (1 minute)**
- Click "Full Test Suite (All 5 Tests)"
- This runs 5 comprehensive tests
- Results shown on screen + detailed logs in console

### **Step 4: Check Console Logs**

Open React Native debugger or Metro logs to see detailed output:

```
═══════════════════════════════════════════════════
🧪 REFRESH TOKEN TEST SUITE
═══════════════════════════════════════════════════

📦 Test 1: Token Storage
──────────────────────────────────────────────────
Checking Redux state...
✅ Redux: Both tokens present
Checking SecureStorage...
✅ SecureStorage: Both tokens present
✅ Tokens match between Redux and SecureStorage

⏱️ Test 2: Session Expiration
──────────────────────────────────────────────────
Session Expires At: 2026-01-25T12:30:00.000Z
Time until expiration: 14.50 minutes
✅ Session expiration is set correctly

🔄 Test 3: Refresh Token Endpoint
──────────────────────────────────────────────────
Calling refreshTokenAsync()...
✅ Got new access token
✅ Token expiration updated

🚨 Test 4: Interceptor Auto-Refresh (401 Simulation)
──────────────────────────────────────────────────
Corrupting access token to force 401...
Making API call with corrupted token...

🚨 401 UNAUTHORIZED DETECTED
──────────────────────────────────────────────────
📍 URL: /api/v1/offers
🔄 Is Refreshing?: false
🔁 Retry Flag: undefined
🔄 STARTING REFRESH TOKEN FLOW...
✅ REFRESH SUCCESSFUL
🔁 RETRYING ORIGINAL REQUEST: /api/v1/offers

API call succeeded in 1234 ms
✅ Interceptor caught 401
✅ Triggered refresh automatically
✅ Retried original request
✅ Request succeeded

💾 Test 5: Token Persistence After Refresh
──────────────────────────────────────────────────
Refreshing token...
✅ Redux state updated
✅ SecureStorage updated
✅ Redux and SecureStorage in sync

═══════════════════════════════════════════════════
📊 TEST SUMMARY
═══════════════════════════════════════════════════
Total Tests: 5
✅ Passed: 5
❌ Failed: 0
──────────────────────────────────────────────────
🎉 ALL TESTS PASSED - Refresh token is working correctly!
```

---

## ✅ Best Practices Implemented

### **1. Secure Token Storage**

```typescript
// ✅ CORRECT: Using SecureStorage (Keychain/Keystore)
await SecureStorage.setTokens(accessToken, refreshToken);
const tokens = await SecureStorage.getTokens();

// ❌ WRONG: Using AsyncStorage (NOT encrypted)
await AsyncStorage.setItem('accessToken', accessToken);
```

**Why**: Keychain (iOS) and Keystore (Android) provide hardware-backed encryption.

---

### **2. Axios Interceptor Pattern**

```typescript
// ✅ CORRECT: Single interceptor with queue for concurrent requests
let isRefreshing = false;
let failedQueue = [];

if (error.response?.status === 401) {
  if (isRefreshing) {
    // Queue this request
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    }).then(() => client(originalRequest));
  }

  isRefreshing = true;
  // Refresh token...
  processQueue(); // Process all queued requests
  isRefreshing = false;
}
```

**Why**: Prevents multiple simultaneous refresh attempts when several requests fail at once.

---

### **3. Request Retry with `_retry` Flag**

```typescript
// ✅ CORRECT: Prevents infinite loops
if (error.response?.status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  // Refresh and retry...
}
```

**Why**: Without this flag, a failed refresh could cause infinite 401 → refresh → 401 loop.

---

### **4. Redux State Synchronization**

```typescript
// ✅ CORRECT: Update both Redux and SecureStorage together
builder.addCase(refreshTokenAsync.fulfilled, (state, action) => {
  state.tokens = action.payload.tokens; // Redux
  await SecureStorage.setTokens(...); // SecureStorage
  state.sessionExpiresAt = newExpiresAt;
});
```

**Why**: Ensures state consistency across app lifecycle and restarts.

---

### **5. Graceful Logout on Refresh Failure**

```typescript
// ✅ CORRECT: Logout when refresh fails
catch (refreshError) {
  processQueue(refreshError); // Fail all queued requests
  await store.dispatch(logoutAsync()); // Clear state
  return Promise.reject(refreshError);
}
```

**Why**: If refresh token is expired/invalid, user must re-authenticate.

---

### **6. Proper Token Expiration Handling**

```typescript
// ✅ CORRECT: Store expiration time, not boolean flag
const expiresAt = new Date(Date.now() + expiresIn * 1000);
state.sessionExpiresAt = expiresAt.toISOString();

// Check expiration
const now = Date.now();
const expiresAtMs = new Date(sessionExpiresAt).getTime();
if (now >= expiresAtMs) {
  // Token expired
}
```

**Why**: Allows precise expiration checks and better UX (show countdown, etc.).

---

## 🐛 Common Issues & Solutions

### **Issue 1: "Session expired" warning but user stays logged in**

**Root Cause**: The RootNavigator check is based on ACCESS token expiration (15 min), not REFRESH token (7 days).

**Current Behavior**:
- Warning appears after 15 minutes
- User is NOT actually logged out
- Next API call will auto-refresh

**Solution Options**:

**Option A: Remove the confusing warning** (Recommended for now)
```typescript
// Comment out lines 127-155 in RootNavigator.tsx
// This check is redundant - the interceptor handles expiration
```

**Option B: Base warning on refresh token expiration**
```typescript
// Add refreshTokenExpiresAt to Redux state
// Check that instead of sessionExpiresAt (access token)
// User should only be warned when REFRESH token expires (7 days)
```

---

### **Issue 2: Multiple refresh attempts**

**Symptom**: Logs show multiple "STARTING REFRESH TOKEN FLOW" messages.

**Cause**: Multiple API calls failing simultaneously without queuing.

**Verification**: Check that `isRefreshing` flag is working:
```typescript
if (isRefreshing) {
  console.log('⏳ QUEUEING REQUEST'); // ← Should see this
  return new Promise(...);
}
```

**Fix**: Verify interceptor code matches the enhanced version with queue logic.

---

### **Issue 3: Refresh token expired**

**Symptom**: Getting logged out after 7 days of inactivity.

**Cause**: Refresh token has a 7-day expiration (from `JWT_REFRESH_EXPIRES_IN=7d`).

**This is EXPECTED BEHAVIOR**:
- Access token: 15 minutes (frequently refreshed)
- Refresh token: 7 days (requires re-login after expiry)

**Solution**: Not a bug. User must login again after 7 days of no activity.

---

### **Issue 4: "No refresh token available"**

**Symptom**: `refreshTokenAsync` fails immediately.

**Cause**: Refresh token not in Redux state.

**Debug**:
```typescript
const state = store.getState();
console.log('Refresh Token:', state.auth.tokens?.refreshToken);
```

**Fix**: Verify login saves BOTH tokens:
```typescript
builder.addCase(loginAsync.fulfilled, (state, action) => {
  state.tokens = {
    accessToken: action.payload.tokens.accessToken,
    refreshToken: action.payload.tokens.refreshToken, // ← Must be here
    expiresIn: action.payload.tokens.expiresIn,
  };
});
```

---

### **Issue 5: Infinite refresh loop**

**Symptom**: Refresh keeps triggering over and over.

**Cause**: `_retry` flag not working or refresh endpoint returns 401.

**Debug**:
```typescript
// Check if _retry is being set
console.log('Retry flag before:', originalRequest._retry);
originalRequest._retry = true;
console.log('Retry flag after:', originalRequest._retry);
```

**Fix**: Ensure retry flag is set BEFORE calling refresh:
```typescript
originalRequest._retry = true; // ← MUST be before await
isRefreshing = true;
const result = await store.dispatch(refreshTokenAsync());
```

---

## 📊 Production Readiness Checklist

Before deploying to production, verify:

- [ ] **All 5 tests pass** (run full test suite)
- [ ] **Access token expires in 15 minutes** (check backend `.env`)
- [ ] **Refresh token expires in 7 days** (check backend `.env`)
- [ ] **Tokens stored in SecureStorage** (not AsyncStorage)
- [ ] **401 interceptor works** (simulated via test)
- [ ] **Queuing works** (multiple concurrent requests)
- [ ] **Logout on refresh failure** (tested manually with expired token)
- [ ] **No infinite loops** (verified via `_retry` flag)
- [ ] **Session persists across app restarts** (close and reopen app)
- [ ] **Remove test screen** from production build

---

## 🔧 Backend Configuration

### **Environment Variables** (`apps/food-waste-backend/.env`)

```bash
# Access Token Expiration (SHORT)
JWT_EXPIRES_IN=15m  # 15 minutes

# Refresh Token Expiration (LONG)
JWT_REFRESH_EXPIRES_IN=7d  # 7 days

# JWT Secret (MUST be strong in production)
JWT_SECRET=your-super-secret-key-change-in-production

# For testing, you can shorten access token:
# JWT_EXPIRES_IN=2m  # 2 minutes for faster testing
```

### **Best Practice Values**

| Token Type | Development | Production |
|------------|-------------|------------|
| Access Token | 2-15 min | 15-30 min |
| Refresh Token | 1-7 days | 7-30 days |

**Why Short Access Tokens**:
- Limits exposure if token is stolen
- Forces frequent refresh (keeps session active)
- Allows quick revocation (user logout, security event)

**Why Long Refresh Tokens**:
- Better UX (user stays logged in)
- Reduces login frequency
- Stored securely (Keychain/Keystore)

---

## 🎓 Understanding the Flow

### **Normal API Call (Token Valid)**
```
User Action → API Request
            ↓
     Add Access Token Header
            ↓
     Send to Backend
            ↓
     Backend Validates Token
            ↓
     Return Data
            ↓
     Update UI
```

### **API Call with Expired Token**
```
User Action → API Request
            ↓
     Add Access Token Header (expired)
            ↓
     Send to Backend
            ↓
     Backend: "401 Unauthorized"
            ↓
     Interceptor Catches 401
            ↓
     Call /auth/refresh with refresh token
            ↓
     Backend: "200 OK" + new access token
            ↓
     Update Redux & SecureStorage
            ↓
     Retry Original Request (with new token)
            ↓
     Backend: "200 OK" + data
            ↓
     Update UI (user doesn't notice anything)
```

---

## 🚀 Next Steps

1. **Run the tests** using the RefreshTokenTestScreen
2. **Check all tests pass**
3. **Review console logs** for any warnings
4. **Test in real scenarios**:
   - Wait 15+ minutes and trigger an API call
   - Close app, wait 1 hour, reopen (token should refresh)
   - Logout/login cycle
5. **Remove test screen** before production deployment

---

## 📚 Additional Resources

### **Files Modified/Created**:
- ✅ `apps/mobile/src/services/apiClient.ts` - Enhanced logging
- ✅ `apps/mobile/src/utils/testRefreshToken.ts` - Test suite
- ✅ `apps/mobile/src/features/auth/screens/RefreshTokenTestScreen.tsx` - Test UI
- ✅ `apps/mobile/src/features/auth/store/authSlice.ts` - Token management

### **Key Dependencies**:
- `axios` - HTTP client with interceptors
- `@reduxjs/toolkit` - State management
- `react-native-keychain` - Secure token storage
- `@react-native-async-storage/async-storage` - Session metadata

### **Backend Endpoints Used**:
- `POST /api/v1/auth/login` - Initial login (gets both tokens)
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/offers` - Test endpoint (used in tests)

---

**Status**: ✅ **READY FOR TESTING**
**Date**: 2026-01-25
**Version**: 1.0.0

Run the tests and verify everything works before deploying to production! 🚀
