# Users Module - Event-Driven Architecture Implementation Guide

## Overview

This document explains where events are used in the Users module and where they should NOT be used, following event-driven architecture best practices.

## Event-Driven Architecture Principles

### What Events Are For:
1. **Decoupling** - Breaking direct dependencies between modules
2. **Asynchronous Processing** - Non-blocking side effects
3. **Audit Trail** - Immutable log of what happened
4. **Scalability** - Parallel processing across workers
5. **Cross-Domain Reactions** - Cascading business logic
6. **Extensibility** - Adding features without modifying existing code

### What Events Are NOT For:
- Synchronous validation (e.g., checking user balance)
- Simple CRUD operations with no side effects
- Single responsibility workflows
- Real-time request-response patterns

---

## Where Events ARE Used (With Justification)

### 1. User Registration ✅ **USE EVENTS**

**Event**: `user.registered`

**Why**:
- **Cross-domain reactions**: Loyalty module needs to create loyalty account
- **Asynchronous processing**: Send welcome email without blocking registration
- **Extensibility**: Future features (analytics, recommendations) can listen without changing user module
- **Multiple responsibilities**: Registration triggers 4+ side effects

**Listeners**:
- Loyalty: Create loyalty account, award signup bonus
- Notifications: Send welcome email
- Analytics: Track registration metrics
- Gamification: Award "Welcome" achievement

**Service Method**: `create()`

```typescript
// After user is saved
this.eventEmitter.emit('user.registered', new UserRegisteredEvent(
  savedUser._id.toString(),
  savedUser.email,
  savedUser.firstName,
  savedUser.lastName,
  savedUser.role,
  savedUser.phoneNumber,
  savedUser.createdAt
));
```

---

### 2. Email Verification ✅ **USE EVENTS**

**Event**: `user.email.verified`

**Why**:
- **Profile completion tracking**: Gamification needs to track verification progress
- **Security trust score**: Update user trust/security score
- **Asynchronous notifications**: Send confirmation email
- **Analytics**: Track verification funnel

**Listeners**:
- Notifications: Send verification confirmation email
- Analytics: Track verification rate
- Gamification: Award "Verified Email" achievement
- Security: Update trust score

**Service Method**: `verifyEmail()`

---

### 3. Phone Verification ✅ **USE EVENTS**

**Event**: `user.phone.verified`

**Why**:
- **Enable SMS features**: Notifications module needs to know phone is verified
- **Trust score update**: Security module calculates trust based on verifications
- **Analytics**: Track verification completion
- **Feature gates**: Some features require phone verification

**Listeners**:
- Notifications: Enable SMS notifications, send confirmation
- Security: Update trust score
- Analytics: Track phone verification metrics
- Gamification: Award "Phone Verified" badge

**Service Method**: `verifyPhoneCode()`

---

### 4. Password Change ✅ **USE EVENTS**

**Event**: `user.password.changed`

**Why**:
- **Security critical**: Must invalidate all sessions except current
- **Fraud detection**: Monitor for suspicious password change patterns
- **User notification**: Send security alert email
- **Audit trail**: Compliance requirement for password changes

**Listeners**:
- Auth: Invalidate all refresh tokens/sessions except current
- Notifications: Send security alert email
- Security: Check for suspicious patterns (multiple changes, unusual IP)
- Analytics: Track password change frequency

**Service Method**: `updatePassword()`

---

### 5. Account Locked ✅ **USE EVENTS**

**Event**: `user.account.locked`

**Why**:
- **Security monitoring**: Detect brute-force attacks
- **Admin alerts**: Notify admins of potential attacks
- **User notification**: Send locked account email
- **IP blocking**: Track IPs to block repeat offenders

**Listeners**:
- Security: Monitor for distributed attacks, consider IP blocking
- Notifications: Send account locked email with unlock instructions
- Admin: Alert admins if multiple accounts locked from same IP
- Analytics: Track account lockout patterns

**Service Method**: `recordFailedLogin()`

---

### 6. Account Unlocked ✅ **USE EVENTS**

**Event**: `user.account.unlocked`

**Why**:
- **Audit trail**: Log admin actions for compliance
- **User notification**: Inform user account was unlocked
- **Security tracking**: Monitor admin unlock frequency

**Listeners**:
- Notifications: Send account unlocked email
- Admin: Log admin action in admin audit trail
- Analytics: Track unlock patterns

**Service Method**: `unlockAccount()`

---

### 7. User Status Changed ✅ **USE EVENTS**

**Event**: `user.status.changed`

**Why**:
- **Cascading effects**: Status change affects multiple systems
  - SUSPENDED → Cancel active orders, invalidate sessions
  - DELETED → Trigger data cleanup
  - ACTIVE → Re-enable access
- **Cross-module coordination**: Orders, Sessions, Notifications need to know

**Listeners**:
- Orders: Cancel active orders if suspended/deleted
- Auth: Invalidate sessions if suspended/deleted
- Notifications: Send status change notification
- Analytics: Track status change patterns

**Service Method**: `updateStatus()`

---

### 8. Data Deletion Requested ✅ **USE EVENTS**

**Event**: `user.data_deletion.requested`

**Why**:
- **GDPR/CCPA compliance**: Legal requirement to delete data across all systems
- **Cascading deletion**: Orders, Favorites, Reviews must be deleted
- **Grace period**: Initiate 30-day deletion countdown
- **Compliance tracking**: Audit trail for regulatory compliance

**Listeners**:
- Orders: Soft-delete user orders
- Favorites: Delete user favorites
- Reviews: Delete user reviews
- Notifications: Delete notification preferences
- Analytics: Anonymize analytics data
- Privacy: Schedule final deletion after grace period

**Service Method**: `PrivacyComplianceService.processDataDeletion()`

---

### 9. Data Deletion Completed ✅ **USE EVENTS**

**Event**: `user.data_deletion.completed`

**Why**:
- **Compliance audit**: Log completion for GDPR/CCPA compliance
- **Finalize cleanup**: Clear caches, invalidate sessions
- **Notification**: Send deletion confirmation (if email retained)

**Listeners**:
- Admin: Update compliance dashboard
- Analytics: Archive deletion logs
- Cache: Clear all user-related caches

**Service Method**: `PrivacyComplianceService.processDataDeletion()`

---

### 10. MFA Enabled ✅ **USE EVENTS**

**Event**: `user.mfa.enabled`

**Why**:
- **Security enhancement**: Track security posture improvements
- **User notification**: Send MFA confirmation email
- **Gamification**: Award security-conscious user badge

**Listeners**:
- Notifications: Send MFA enabled confirmation email
- Security: Update user security score
- Gamification: Award "Security Champion" badge
- Analytics: Track MFA adoption rate

**Service Method**: `MfaService.verifyTotpSetup()`, `UsersService.activateMfa()`

---

### 11. MFA Disabled ✅ **USE EVENTS**

**Event**: `user.mfa.disabled`

**Why**:
- **Security downgrade**: Alert for reduced security
- **Admin notification**: For high-value merchant accounts
- **User warning**: Send security warning email

**Listeners**:
- Notifications: Send security warning email
- Security: Update user security score, alert admins for merchants
- Analytics: Track MFA disable rate

**Service Method**: `MfaService.disableMfa()`, `UsersService.disableMfa()`

---

### 12. Privacy Consent Updated ✅ **USE EVENTS**

**Event**: `user.privacy_consent.updated`

**Why**:
- **Compliance tracking**: Monitor consent status for GDPR/Tunisia Law
- **Feature gates**: Enable/disable features based on consent
- **Analytics control**: Turn off analytics if user opts out

**Listeners**:
- Analytics: Enable/disable tracking based on consent
- Notifications: Enable/disable marketing emails
- Geolocation: Enable/disable location tracking
- Admin: Update compliance dashboard

**Service Method**: `PrivacyComplianceService.recordTunisianConsent()`, `PrivacyComplianceService.recordInternationalConsent()`

---

### 13. Profile Updated ✅ **USE EVENTS** (Selective)

**Event**: `user.profile.updated`

**Why** (Only for significant changes):
- **Search index update**: When name/email changes
- **Cache invalidation**: Clear stale user caches
- **Analytics**: Track profile completion percentage

**Important**: NOT all profile updates should emit events - only significant ones:
- ✅ Email change
- ✅ Name change
- ✅ Role change
- ❌ Profile image update (not significant)
- ❌ Location update (happens too frequently)
- ❌ Preferences update (not cross-domain)

**Listeners**:
- Search: Update user search index
- Cache: Invalidate user caches
- Analytics: Track profile completion

**Service Method**: `update()` (only for significant fields)

---

### 14. Account Restored ✅ **USE EVENTS**

**Event**: `user.account.restored`

**Why**:
- **Data restoration**: Restore soft-deleted orders/data
- **Access re-enable**: Restore user access
- **Audit trail**: Log admin restoration action

**Listeners**:
- Orders: Restore soft-deleted orders
- Notifications: Send account restoration email
- Analytics: Track restoration patterns
- Admin: Log admin action

**Service Method**: `restore()`

---

## Where Events are NOT Used (With Justification)

### ❌ Simple Read Operations

**Methods**: `findAll()`, `findOne()`, `findByEmail()`, `findById()`

**Why NOT**:
- **No side effects**: Read-only operations
- **Single responsibility**: Just fetch and return data
- **Synchronous**: Client expects immediate response
- **No cross-domain logic**: No other systems need to know

**Anti-pattern example**:
```typescript
// ❌ DON'T DO THIS
async findOne(id: string): Promise<User> {
  const user = await this.userModel.findById(id);
  this.eventEmitter.emit('user.viewed', { userId: id }); // WRONG!
  return user;
}
```

---

### ❌ Location Updates

**Method**: `updateUserLocation()`

**Why NOT**:
- **Too frequent**: Could generate hundreds of events per session
- **Performance impact**: Event overhead outweighs benefits
- **No immediate side effects**: Location is just stored
- **Not cross-domain**: Only used by offers module (direct dependency OK)

**Better approach**: Direct service injection where needed

---

### ❌ Preferences Updates

**Method**: `UserPreferencesService.updateUserPreferences()`

**Why NOT**:
- **User-scoped only**: Preferences don't affect other modules
- **No cascading logic**: Changing theme doesn't trigger anything
- **Frequent changes**: Could happen many times per session
- **Simple CRUD**: Just store and retrieve

**Exception**: Privacy consent preferences SHOULD emit events (compliance tracking)

---

### ❌ Refresh Token Management

**Methods**: `addRefreshToken()`, `removeRefreshToken()`, `clearAllRefreshTokens()`

**Why NOT**:
- **Synchronous requirement**: Token operations must complete before response
- **Single responsibility**: Auth module only
- **No side effects**: Just token storage
- **Performance critical**: Added latency unacceptable

---

### ❌ Internal Helper Methods

**Methods**: `maskPhoneNumber()`, `generateVerificationCode()`, `calculateLockoutDuration()`

**Why NOT**:
- **Internal utilities**: Not business events
- **No side effects**: Pure functions
- **No cross-domain impact**: Helpers for service logic

---

### ❌ Audit Log Queries

**Methods**: `getAuditLog()`, `addAuditLog()`

**Why NOT**:
- **Read-only**: getAuditLog is just a query
- **Internal tracking**: addAuditLog is for recording, not triggering
- **Would create infinite loop**: Events add audit logs, which would emit events, which would add audit logs...

---

### ❌ Search Operations

**Method**: `searchUsers()`

**Why NOT**:
- **Read-only**: No side effects
- **Admin-only**: Not cross-domain
- **Synchronous requirement**: Admin expects immediate results

---

### ❌ Compliance Checks

**Method**: `getComplianceSummary()`, `PrivacyComplianceService.validateTunisianCompliance()`

**Why NOT**:
- **Read-only analysis**: Just checking status
- **Synchronous requirement**: Client needs immediate answer
- **No side effects**: Not changing anything

---

### ❌ MFA Verification

**Method**: `MfaService.verifyTotp()`

**Why NOT**:
- **Synchronous requirement**: Login flow can't wait for event processing
- **Performance critical**: Must respond in milliseconds
- **Single responsibility**: Just verify the code

**Note**: MFA **setup completion** DOES emit event (one-time action with side effects)

---

## Event Naming Conventions

```
user.<subject>.<action>

Examples:
- user.registered
- user.email.verified
- user.phone.verified
- user.password.changed
- user.account.locked
- user.account.unlocked
- user.status.changed
- user.data_deletion.requested
- user.data_deletion.completed
- user.mfa.enabled
- user.mfa.disabled
- user.privacy_consent.updated
- user.profile.updated
- user.account.restored
```

---

## Implementation Checklist

### For UserService:

- [x] ✅ Import EventEmitter2
- [x] ✅ Inject in constructor
- [x] ✅ Emit user.registered in create()
- [x] ✅ Emit user.email.verified in verifyEmail()
- [x] ✅ Emit user.phone.verified in verifyPhoneCode()
- [x] ✅ Emit user.password.changed in updatePassword()
- [x] ✅ Emit user.account.locked in recordFailedLogin()
- [x] ✅ Emit user.account.unlocked in unlockAccount()
- [x] ✅ Emit user.status.changed in updateStatus()
- [x] ✅ Emit user.profile.updated in update() (for significant changes)
- [x] ✅ Emit user.account.restored in restore()

### For MfaService:

- [x] ✅ Import EventEmitter2
- [x] ✅ Emit user.mfa.enabled in verifyTotpSetup()/activateMfa()
- [x] ✅ Emit user.mfa.disabled in disableMfa()

### For PrivacyComplianceService:

- [x] ✅ Import EventEmitter2
- [x] ✅ Emit user.privacy_consent.updated in recordTunisianConsent()/recordInternationalConsent()
- [x] ✅ Emit user.data_deletion.requested in processDataDeletion()
- [x] ✅ Emit user.data_deletion.completed in processDataDeletion()

### For UsersModule:

- [x] ✅ Import EventEmitterModule
- [x] ✅ Register all listeners as providers
- [x] ✅ Ensure @OnEvent decorators match event names

---

## Testing Events

### Unit Tests

```typescript
describe('UserService Events', () => {
  it('should emit user.registered event on successful registration', async () => {
    const eventSpy = jest.spyOn(eventEmitter, 'emit');

    await userService.create(createUserDto);

    expect(eventSpy).toHaveBeenCalledWith(
      'user.registered',
      expect.objectContaining({
        userId: expect.any(String),
        email: createUserDto.email,
      })
    );
  });
});
```

### Integration Tests

```typescript
describe('User Registration Flow', () => {
  it('should create loyalty account when user registers', async () => {
    const user = await userService.create(createUserDto);

    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    const loyaltyAccount = await loyaltyService.findByUserId(user._id);
    expect(loyaltyAccount).toBeDefined();
  });
});
```

---

## Monitoring & Observability

### Metrics to Track:

1. Event emission rate per event type
2. Event processing latency
3. Failed event handler count
4. Event queue depth (if using Bull)

### Logging:

```typescript
this.logger.log(`Emitting user.registered for user: ${userId}`);
this.logger.debug(`Event payload: ${JSON.stringify(event)}`);
```

### Alerts:

- Event handler failures > 5% of emissions
- Event processing latency > 1 second
- Event queue depth > 1000

---

## Migration Strategy

1. ✅ **Phase 1**: Define events and listeners (CURRENT)
2. **Phase 2**: Update services to emit events
3. **Phase 3**: Implement listener logic (currently TODO)
4. **Phase 4**: Test event flow end-to-end
5. **Phase 5**: Monitor in staging
6. **Phase 6**: Deploy to production with feature flags

---

## Common Pitfalls to Avoid

### 1. Event Explosion ❌
```typescript
// DON'T emit events for every tiny update
await userService.updateLocation(); // event? NO!
await userService.updatePreference(); // event? NO!
await userService.updateProfileImage(); // event? NO!
```

### 2. Synchronous Dependencies ❌
```typescript
// DON'T wait for events in synchronous flows
await this.eventEmitter.emitAsync('user.registered', event);
// ❌ Login depends on event completion - breaks async principle
```

### 3. Infinite Loops ❌
```typescript
// DON'T emit events in event handlers without safeguards
@OnEvent('user.registered')
async handle(event) {
  await this.userService.update(); // emits user.updated
  // which triggers another handler... infinite loop!
}
```

### 4. Missing Error Handling ❌
```typescript
// DON'T let listener errors crash the app
@OnEvent('user.registered')
async handle(event) {
  await this.sendEmail(); // If this fails, should not break registration
  // Always wrap in try-catch!
}
```

---

## Conclusion

Event-driven architecture is a powerful pattern but must be used judiciously. Use events for:
- Cross-module coordination
- Asynchronous side effects
- Audit trails
- Extensibility

Avoid events for:
- Simple CRUD
- Synchronous requirements
- High-frequency operations
- Single-responsibility actions

When in doubt, ask:
1. Do multiple systems need to react to this?
2. Can the reaction happen asynchronously?
3. Is this a significant business event?

If yes to all three → Use events ✅
If no to any → Direct service calls ❌
