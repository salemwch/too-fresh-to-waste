# Users Module - Event-Driven Architecture Summary

## Quick Reference

### Files Created

1. **events/user.events.ts** - Event class definitions
2. **listeners/user-lifecycle-events.listener.ts** - Registration, verification, deletion listeners
3. **listeners/user-security-events.listener.ts** - Security-related event listeners
4. **listeners/user-privacy-events.listener.ts** - Privacy/compliance event listeners
5. **EVENTS_IMPLEMENTATION_GUIDE.md** - Comprehensive guide on where/when to use events
6. **SERVICE_EVENT_INTEGRATION.md** - Step-by-step integration instructions

---

## Events Defined (14 Total)

### Lifecycle Events (8)
1. `user.registered` - User successfully created
2. `user.email.verified` - Email verification completed
3. `user.phone.verified` - Phone verification completed
4. `user.status.changed` - User status changed (active, suspended, deleted)
5. `user.data_deletion.requested` - GDPR deletion requested
6. `user.data_deletion.completed` - GDPR deletion completed
7. `user.profile.updated` - Significant profile changes (email, name, role)
8. `user.account.restored` - Soft-deleted account restored

### Security Events (4)
9. `user.password.changed` - Password updated
10. `user.account.locked` - Account locked due to failed logins
11. `user.account.unlocked` - Admin unlocked account
12. `user.mfa.enabled` - MFA enabled
13. `user.mfa.disabled` - MFA disabled

### Privacy Events (1)
14. `user.privacy_consent.updated` - Privacy consent updated (Tunisia/International)

---

## Event Listeners Implemented

### UserLifecycleEventsListener
- ✅ Handles user.registered
- ✅ Handles user.email.verified
- ✅ Handles user.phone.verified
- ✅ Handles user.status.changed
- ✅ Handles user.data_deletion.requested
- ✅ Handles user.data_deletion.completed
- ✅ Handles user.profile.updated
- ✅ Handles user.account.restored

### UserSecurityEventsListener
- ✅ Handles user.password.changed
- ✅ Handles user.account.locked
- ✅ Handles user.account.unlocked
- ✅ Handles user.mfa.enabled
- ✅ Handles user.mfa.disabled

### UserPrivacyEventsListener
- ✅ Handles user.privacy_consent.updated

---

## Where Events ARE Used ✅

| Service Method | Event Emitted | Reason |
|----------------|---------------|---------|
| `create()` | `user.registered` | Cross-module reactions (loyalty, notifications, analytics) |
| `verifyEmail()` | `user.email.verified` | Profile completion tracking, security trust score |
| `verifyPhoneCode()` | `user.phone.verified` | Enable SMS features, update trust score |
| `updatePassword()` | `user.password.changed` | Security: invalidate sessions, send alerts |
| `recordFailedLogin()` | `user.account.locked` | Security monitoring, admin alerts |
| `unlockAccount()` | `user.account.unlocked` | Audit trail, user notification |
| `updateStatus()` | `user.status.changed` | Cascading effects (cancel orders, invalidate sessions) |
| `update()` | `user.profile.updated` | Cache invalidation, search index update (significant changes only) |
| `restore()` | `user.account.restored` | Data restoration, access re-enable |
| `MfaService.verifyTotpSetup()` | `user.mfa.enabled` | Security enhancement tracking |
| `MfaService.disableMfa()` | `user.mfa.disabled` | Security downgrade alert |
| `PrivacyService.recordConsent()` | `user.privacy_consent.updated` | Compliance tracking |
| `PrivacyService.processDataDeletion()` | `user.data_deletion.requested` | GDPR cascading deletion |
| `PrivacyService.processDataDeletion()` | `user.data_deletion.completed` | GDPR compliance audit |

---

## Where Events are NOT Used ❌

| Service Method | Reason |
|----------------|---------|
| `findAll()`, `findOne()`, `findByEmail()` | Read-only, no side effects |
| `updateUserLocation()` | Too frequent, no cross-domain impact |
| `UserPreferencesService.updatePreferences()` | User-scoped only, no cascading logic |
| `addRefreshToken()`, `removeRefreshToken()` | Synchronous requirement, performance critical |
| `getAuditLog()`, `addAuditLog()` | Would create infinite loop |
| `searchUsers()` | Read-only, synchronous requirement |
| `getComplianceSummary()` | Read-only analysis |
| `MfaService.verifyTotp()` | Synchronous requirement, performance critical |

---

## Implementation Status

### ✅ Completed

- [x] Event class definitions
- [x] Listener implementations (with TODO placeholders for business logic)
- [x] Documentation (comprehensive guides)
- [x] Integration instructions

### ⏳ Pending (Your Next Steps)

- [ ] Integrate EventEmitter2 into UserService
- [ ] Integrate EventEmitter2 into MfaService
- [ ] Integrate EventEmitter2 into PrivacyComplianceService
- [ ] Update user.module.ts to register listeners
- [ ] Implement listener business logic (replace TODOs)
- [ ] Write unit tests for event emissions
- [ ] Write integration tests for event flows
- [ ] Deploy to staging and monitor
- [ ] Deploy to production

---

## Integration Quick Start

### 1. Install EventEmitter (if not already installed)

```bash
pnpm add @nestjs/event-emitter
```

### 2. Update app.module.ts (if not already done)

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    // ... other imports
  ],
})
export class AppModule {}
```

### 3. Follow SERVICE_EVENT_INTEGRATION.md

Step-by-step instructions for:
- Adding EventEmitter2 to services
- Emitting events at correct points
- Registering listeners in module

---

## Event Flow Example

### User Registration Flow

```
1. UserService.create()
   └─> Validates input
   └─> Creates user in database
   └─> ✨ EMITS: user.registered

2. UserLifecycleEventsListener.handleUserRegistered()
   └─> Logs registration
   └─> [TODO] Send welcome email
   └─> [TODO] Track analytics

3. LoyaltyModule.UserEventsListener.handleUserRegistered()
   └─> Creates loyalty account
   └─> Awards signup bonus

4. NotificationsModule.UserEventsListener.handleUserRegistered()
   └─> Sends welcome email
   └─> Creates notification preferences
```

**Result**: User created + Loyalty account created + Welcome email sent - All without tight coupling!

---

## Benefits Achieved

### Before Events ❌
```typescript
// User service directly calls loyalty service
async create(dto) {
  const user = await this.userModel.save(dto);

  // Tight coupling!
  await this.loyaltyService.createAccount(user);
  await this.notificationService.sendWelcome(user);
  await this.analyticsService.trackRegistration(user);

  return user;
}
```

**Problems**:
- UserService depends on 3 other services
- If email service is down, registration fails
- Can't add new features without modifying UserService
- Difficult to test in isolation

### After Events ✅
```typescript
// User service emits event
async create(dto) {
  const user = await this.userModel.save(dto);

  // Fire and forget!
  this.eventEmitter.emit('user.registered', new UserRegisteredEvent(...));

  return user;
}

// Other modules listen independently
@OnEvent('user.registered')
async handleUserRegistered(event) {
  await this.createLoyaltyAccount(event.userId);
}
```

**Benefits**:
- Zero coupling between modules
- Registration succeeds even if side effects fail
- Add new features by adding listeners (Open/Closed Principle)
- Easy to test - mock EventEmitter2
- Async processing - fast response times

---

## Testing Strategy

### Unit Tests
Test that events are emitted with correct data:

```typescript
it('should emit user.registered on successful creation', async () => {
  const emitSpy = jest.spyOn(eventEmitter, 'emit');

  await userService.create(dto);

  expect(emitSpy).toHaveBeenCalledWith(
    'user.registered',
    expect.objectContaining({ email: dto.email })
  );
});
```

### Integration Tests
Test that listeners react correctly:

```typescript
it('should create loyalty account when user registers', async () => {
  const user = await userService.create(dto);

  // Wait for async processing
  await new Promise(r => setTimeout(r, 100));

  const loyalty = await loyaltyService.findByUserId(user._id);
  expect(loyalty).toBeDefined();
});
```

---

## Monitoring & Observability

### Metrics to Track
1. Event emission rate per type
2. Event processing latency
3. Failed event handler count
4. Event queue depth

### Logging Best Practices
```typescript
// In service (emit)
this.logger.log(`Emitting user.registered for user: ${userId}`);

// In listener (handle)
this.logger.log(`Processing user.registered event for user: ${event.userId}`);
```

### Alerts to Configure
- Event handler failure rate > 5%
- Event processing latency > 1 second
- Event queue depth > 1000

---

## Common Pitfalls (Avoid These!)

### 1. Event Explosion ❌
```typescript
// DON'T emit for every tiny update
updateLocation() // event? NO - too frequent
updatePreference() // event? NO - user-scoped only
```

### 2. Synchronous Dependencies ❌
```typescript
// DON'T use emitAsync in critical path
await this.eventEmitter.emitAsync('user.registered', event);
// ❌ Blocks registration until all listeners complete
```

### 3. Infinite Loops ❌
```typescript
@OnEvent('user.updated')
async handle(event) {
  await this.userService.update(); // emits user.updated again!
  // ❌ Infinite loop
}
```

### 4. Missing Error Handling ❌
```typescript
@OnEvent('user.registered')
async handle(event) {
  await this.sendEmail(); // If fails, crashes listener
  // ❌ Always wrap in try-catch!
}
```

---

## Decision Tree: Should I Use Events?

```
                 Does this action affect
                 multiple modules/services?
                        /        \
                      YES         NO
                      /            \
            Can side effects     Direct
            be async?           service call
            /        \
          YES        NO
          /           \
   ✅ USE EVENTS   Synchronous
                   requirement?
                   /         \
                 YES         NO
                 /            \
            Direct call   ✅ USE EVENTS
            (performance)
```

**Examples**:
- User registers → Multiple modules + Async → ✅ Events
- Update location → Single module (offers) + Frequent → ❌ Direct call
- Password change → Multiple modules + Async → ✅ Events
- MFA verify → Single module + Sync required → ❌ No events

---

## Next Steps

1. **Read**: EVENTS_IMPLEMENTATION_GUIDE.md for comprehensive understanding
2. **Implement**: Follow SERVICE_EVENT_INTEGRATION.md step-by-step
3. **Test**: Write unit + integration tests
4. **Deploy**: Start with staging, monitor carefully
5. **Iterate**: Implement listener business logic (replace TODOs)

---

## Questions?

Refer to:
- **EVENTS_IMPLEMENTATION_GUIDE.md** - Comprehensive guide on when/why to use events
- **SERVICE_EVENT_INTEGRATION.md** - Step-by-step integration instructions
- **events.md** - General event-driven architecture principles

## Support

For issues or questions:
- Check existing patterns in other modules (auth, offers, loyalty)
- Review NestJS EventEmitter documentation
- Ask in team channel

---

**Remember**: Events are powerful but not a silver bullet. Use them for cross-domain coordination and async side effects, not for simple CRUD or synchronous requirements.
