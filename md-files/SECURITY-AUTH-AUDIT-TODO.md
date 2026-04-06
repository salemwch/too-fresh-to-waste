# 🔐 AUTH SECURITY AUDIT - TODO

**Priority**: 🔴 CRITICAL
**Created**: 2026-02-06
**Category**: Security / Information Disclosure

---

## 🎯 Objective

Audit and fix ALL auth endpoints that leak information about user existence or internal system state.

**Security Principle**: **NEVER reveal whether a user exists or not**

---

## ❌ Current Vulnerabilities

### **Problem: Account Enumeration Attack**

Attackers can determine if an account exists by observing different error messages:

```
❌ "User not found" → Account doesn't exist
❌ "Invalid token" → Account exists, token is wrong
❌ "Token expired" → Account exists, token is old
❌ "Email not verified" → Account exists, email not verified
❌ "Account locked" → Account exists, locked
```

**Result**: Attacker builds list of valid emails → targeted phishing, credential stuffing, etc.

---

## ✅ Security Best Practice (OWASP)

**All auth failures should return IDENTICAL generic messages:**

```typescript
// ✅ CORRECT - All failures look identical
throw new UnauthorizedException('Invalid credentials');
throw new UnauthorizedException('Session expired. Please log in again.');
throw new BadRequestException('Request failed. Please try again.');
```

**Never use**:

```typescript
// ❌ WRONG - Leaks information
throw new NotFoundException('User not found');
throw new BadRequestException('No account with this email');
throw new UnauthorizedException('Email not verified');
```

---

## 📋 AUTH ENDPOINTS TO AUDIT

### 1. **Token Refresh** (`/auth/refresh`) ✅ FIXED

**File**: `apps/food-waste-backend/src/auth/auth.service.ts:609`

- ✅ **FIXED**: Changed `'User not found'` → `'Session expired. Please log in again.'`
- Status: 401 (correct)

---

### 2. **Login** (`/auth/login`) ⚠️ NEEDS FIX

**File**: `apps/food-waste-backend/src/auth/auth.service.ts:357`

**Current** (❌ Information Leak):

```typescript
throw new UnauthorizedException({
  message: 'No account found with this email address',
  type: 'EMAIL_NOT_FOUND',
  field: 'email',
});
```

**Should Be** (✅ Generic):

```typescript
throw new UnauthorizedException({
  message: 'Invalid email or password',
  type: 'INVALID_CREDENTIALS',
  field: 'credentials',
});
```

**Fix Applied**: ✅ Already fixed in this session

---

### 3. **Forgot Password** (`/auth/forgot-password`) ⚠️ REVIEW NEEDED

**File**: `apps/food-waste-backend/src/auth/auth.service.ts:516`

**Current Behavior**: Returns generic success message (good!)

```typescript
return {
  message: 'If an account with this email exists, you will receive a password reset link.',
};
```

✅ **Status**: SECURE - Does not leak user existence

---

### 4. **Reset Password** (`/auth/reset-password`) ⚠️ NEEDS AUDIT

**File**: `apps/food-waste-backend/src/auth/auth.service.ts:544`

**Current**:

```typescript
if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
  throw new BadRequestException('Invalid or expired password reset token');
}
```

**Issue**: "Invalid or expired" might leak information about token validity

**Should Be**:

```typescript
throw new BadRequestException('Password reset link is invalid. Please request a new one.');
```

---

### 5. **Email Verification** (`/auth/verify-email`) ⚠️ NEEDS AUDIT

**File**: `apps/food-waste-backend/src/auth/auth.service.ts:186`

**Current**:

```typescript
if (!user) {
  throw new BadRequestException('Invalid or expired verification token');
}
```

✅ **Status**: SECURE - Generic message, doesn't leak user existence

---

### 6. **Registration** (`/auth/register`) ⚠️ REVIEW NEEDED

**File**: `apps/food-waste-backend/src/auth/auth.service.ts:94`

**Current**:

```typescript
if (existingUser) {
  throw new ConflictException('User with this email already exists');
}
```

**Issue**: Reveals if email is registered (account enumeration)

**Options**:

1. **Keep current** (trade-off: better UX for legitimate users)
2. **Generic error** (better security, worse UX)

**Recommended**: Keep current for registration UX, but consider rate limiting + CAPTCHA to prevent abuse

---

## 🛠️ IMPLEMENTATION CHECKLIST

### Backend Fixes

- [x] Fix `/auth/refresh` - use generic "Session expired"
- [x] Fix `/auth/login` - use generic "Invalid credentials"
- [ ] Audit `/auth/reset-password` - generic password reset error
- [ ] Review `/auth/register` - decide on trade-off
- [ ] Audit `/auth/forgot-password` - already secure ✅
- [ ] Audit `/auth/verify-email` - already secure ✅

### User Service Fixes

- [ ] Audit all `NotFoundException('User not found')` in `user.service.ts`
- [ ] Replace with `UnauthorizedException('Unauthorized')` or `ForbiddenException('Access denied')`
- [ ] Ensure authenticated endpoints don't leak user existence

### Security Enhancements

- [ ] Add rate limiting to all auth endpoints (already implemented ✅)
- [ ] Add CAPTCHA after N failed attempts (infrastructure ready, needs activation)
- [ ] Log all auth failures for security monitoring
- [ ] Implement IP-based throttling (already implemented ✅)

---

## 🎯 PRODUCTION SECURITY STANDARDS

### Auth Error Response Matrix

| Scenario           | HTTP Status | Message                      | Rationale                                  |
| ------------------ | ----------- | ---------------------------- | ------------------------------------------ |
| User not found     | 401         | "Invalid credentials"        | Don't reveal user existence                |
| Wrong password     | 401         | "Invalid credentials"        | Same as above (identical response)         |
| Email not verified | 401         | "Please verify your email"   | OK to reveal (user knows their email)      |
| Account locked     | 401         | "Account temporarily locked" | OK to reveal (legitimate security measure) |
| Token expired      | 401         | "Session expired"            | Generic, doesn't leak info                 |
| Token invalid      | 401         | "Session expired"            | Same as above (identical response)         |
| Account deleted    | 401         | "Session expired"            | Don't reveal deletion                      |
| Account suspended  | 403         | "Access denied"              | Generic, doesn't explain why               |

### Network Error Response Matrix

| Scenario                | HTTP Status | Frontend Action                   | Backend Change      |
| ----------------------- | ----------- | --------------------------------- | ------------------- |
| 500 Internal Error      | 500         | Show offline banner, keep session | N/A (backend issue) |
| 503 Service Unavailable | 503         | Show offline banner, retry        | N/A (maintenance)   |
| Network timeout         | -           | Show offline banner, retry        | N/A (network issue) |
| DNS failure             | -           | Show offline banner, retry        | N/A (connectivity)  |

---

## 📚 OWASP References

- **OWASP Top 10 2021**: A01:2021 - Broken Access Control
- **OWASP ASVS**: V2.2 - Authentication Verification Requirements
- **CWE-204**: Observable Response Discrepancy (Information Leak)
- **CWE-209**: Generation of Error Message Containing Sensitive Information

---

## 🚀 Testing Plan

### Manual Testing

1. Try to login with non-existent email → Should get "Invalid credentials"
2. Try to refresh token for deleted user → Should get "Session expired"
3. Try to reset password with invalid token → Should get generic error
4. Network timeout during refresh → Should show offline banner, NOT logout

### Automated Testing

```typescript
// Test: Auth errors don't leak information
describe('Auth Security - Information Disclosure', () => {
  it('should return identical error for non-existent user and wrong password', async () => {
    const response1 = await login('nonexistent@example.com', 'password');
    const response2 = await login('real@example.com', 'wrongpassword');

    expect(response1.message).toBe(response2.message); // Should be identical
    expect(response1.status).toBe(401);
    expect(response2.status).toBe(401);
  });

  it('should not logout on network errors', async () => {
    // Simulate 500 error
    // Verify: User still authenticated
    // Verify: Offline banner shown
  });
});
```

---

## ✅ COMPLETION CRITERIA

- [ ] All auth endpoints audited
- [ ] No NotFoundException in auth flows
- [ ] All errors return generic messages
- [ ] Network errors don't trigger logout
- [ ] Offline banner working
- [ ] Security tests passing
- [ ] Documentation updated

---

## 📈 AUDIT STATUS

### ✅ Phase 1: Critical Auth Endpoints (COMPLETED - 2026-02-06)

- ✅ Fixed `/auth/refresh` - Generic "Session expired"
- ✅ Fixed `/auth/login` - Generic "Invalid credentials"
- ✅ Implemented offline mode (network errors don't trigger logout)
- ✅ Created offline banner component
- ✅ **User Impact**: Deleted users no longer see confusing alerts

### 🟡 Phase 2: Full Codebase Audit (IN PROGRESS)

**Remaining Work**:

- [ ] Audit 36 instances of `NotFoundException('User not found')` in services
- [ ] Review all authenticated endpoints
- [ ] Implement consistent error handling patterns
- [ ] Add automated security tests

**Estimated Effort**: 4-6 hours
**Priority**: Medium (critical issues already fixed)
**Owner**: Backend Team
**Review Required**: Security Team
