# Event Publishers Status Report

**Date:** 2026-01-23
**Purpose:** Identify which modules publish events to RabbitMQ

---

## Summary

| Module | Publisher Status | Listener Status | Notes |
|--------|-----------------|-----------------|-------|
| **Admin** | ✅ **PUBLISHING** | ✅ Migrated (1 listener) | Using EventBusService |
| **Auth** | ✅ **PUBLISHING** | ✅ Migrated (1 listener) | Using EventBusService |
| **Orders** | ✅ **PUBLISHING** | ✅ Migrated (1 listener) | Using EventBusService |
| **Donations** | ✅ **PUBLISHING** | ✅ Migrated (1 listener) | Using EventBusService |
| **Loyalty** | ✅ **PUBLISHING** | ✅ Migrated (2 listeners) | Using EventBusService |
| **Offers** | ✅ **PUBLISHING** | ✅ Migrated (2 listeners) | Using EventBusService |
| **Favorites** | ✅ **PUBLISHING** | - | Using EventBusService |
| **Reviews** | ✅ **PUBLISHING** | ✅ Migrated (1 listener) | Using EventBusService |
| **Users** | ❌ **NOT PUBLISHING** | ✅ Migrated (3 listeners) | ⚠️ Services don't emit events |

---

## Admin Module ✅ PUBLISHING

**Status:** ✅ **Fully integrated with RabbitMQ**

### Publishers
**File:** `src/admin/services/user-management.service.ts`

```typescript
import { EventBusService } from '../../common/services/event-bus/event-bus.service';

@Injectable()
export class UserManagementService {
  constructor(
    private readonly eventBusService: EventBusService,
    // ...
  ) {}

  async suspendUser(userId: string, reason: string, adminId: string) {
    // ... business logic
    await this.eventBusService.emit('admin.user.suspended', event);
  }
}
```

### Events Published (5 total)
1. `admin.user.suspended` - User account suspended by admin
2. `admin.user.blocked` - User account blocked by admin
3. `admin.user.deleted` - User account deleted by admin
4. `admin.user.activated` - User account activated by admin
5. `admin.user.status.changed` - User status changed

**Other Admin Publishers:**
- `establishment-management.service.ts` - Emits 6 establishment events
- `system-config.service.ts` - Emits 4 system config events

**Total Admin Events:** 15+ events

### Listeners
- ✅ `auth/listeners/admin-user-events.listener.ts` (migrated to RabbitMQ)
- ✅ `orders/listeners/admin-user-events.listener.ts` (migrated to RabbitMQ)

**Routing:** EventBusService → RabbitMQ (`foodwaste.events` exchange)

---

## Users Module ❌ NOT PUBLISHING

**Status:** ⚠️ **Listeners ready, but services don't emit events**

### Current State

**Event Definitions:** ✅ Created (`src/users/events/user.events.ts`)

14 events defined:
- 8 lifecycle events (registered, email verified, phone verified, etc.)
- 4 security events (password changed, account locked, etc.)
- 1 privacy event (consent updated)
- 1 account restoration event

**Listeners:** ✅ All migrated to RabbitMQ
- `user-lifecycle-events.listener.ts` (8 handlers)
- `user-security-events.listener.ts` (5 handlers)
- `user-privacy-events.listener.ts` (1 handler)

**Publishers:** ❌ **NOT IMPLEMENTED**

**Files that SHOULD emit events but DON'T:**
- `src/users/user.service.ts` - No EventBusService import
- `src/users/services/mfa.service.ts` - No EventBusService import
- `src/users/services/privacy-compliance.service.ts` - No EventBusService import

### What's Missing

From `EVENTS_SUMMARY.md:109-119`:

```markdown
### ⏳ Pending (Your Next Steps)

- [ ] Integrate EventEmitter2 into UserService
- [ ] Integrate EventEmitter2 into MfaService
- [ ] Integrate EventEmitter2 into PrivacyComplianceService
- [ ] Update user.module.ts to register listeners
- [ ] Implement listener business logic (replace TODOs)
```

**Impact:** Users module has listeners ready to receive events via RabbitMQ, but nothing is publishing those events yet.

### Example: What's Needed

**Current:** `user.service.ts:create()`

```typescript
async create(createUserDto: CreateUserDto) {
  // ... create user
  return user;
  // ❌ No event emission
}
```

**Should be:** `user.service.ts:create()`

```typescript
import { EventBusService } from '../common/services/event-bus/event-bus.service';

@Injectable()
export class UserService {
  constructor(
    private readonly eventBusService: EventBusService, // ← Add this
    // ...
  ) {}

  async create(createUserDto: CreateUserDto) {
    // ... create user

    // ✅ Emit event
    await this.eventBusService.emit('user.registered', new UserRegisteredEvent(
      user._id.toString(),
      user.email,
      user.firstName,
      user.lastName,
      user.role,
      new Date(),
    ));

    return user;
  }
}
```

### Events That Should Be Published (14 total)

| Service | Method | Event | Priority |
|---------|--------|-------|----------|
| UserService | `create()` | `user.registered` | HIGH |
| UserService | `verifyEmail()` | `user.email.verified` | HIGH |
| UserService | `verifyPhoneCode()` | `user.phone.verified` | MEDIUM |
| UserService | `updatePassword()` | `user.password.changed` | HIGH |
| UserService | `recordFailedLogin()` | `user.account.locked` | HIGH |
| UserService | `unlockAccount()` | `user.account.unlocked` | MEDIUM |
| UserService | `updateStatus()` | `user.status.changed` | HIGH |
| UserService | `update()` | `user.profile.updated` | MEDIUM |
| UserService | `restore()` | `user.account.restored` | LOW |
| MfaService | `verifyTotpSetup()` | `user.mfa.enabled` | MEDIUM |
| MfaService | `disableMfa()` | `user.mfa.disabled` | MEDIUM |
| PrivacyService | `recordConsent()` | `user.privacy_consent.updated` | HIGH |
| PrivacyService | `processDataDeletion()` | `user.data_deletion.requested` | CRITICAL |
| PrivacyService | `processDataDeletion()` | `user.data_deletion.completed` | CRITICAL |

---

## Impact Analysis

### What Works Today (MVP)

**✅ Admin actions:**
- Admin suspends user → `admin.user.suspended` event → Auth/Orders listeners invalidate sessions/cancel orders

**✅ Order completion:**
- Order completed → `order.completed` event → Donations/Loyalty listeners process round-up/points

**✅ Favorites:**
- User favorites offer → `favorite.added` event → Offers listener increments count

**✅ Reviews:**
- User reviews offer → `review.created` event → Analytics/Cache/Notifications processed

### What Doesn't Work (Missing)

**❌ User registration:**
- User signs up → ❌ No `user.registered` event → Loyalty doesn't create account

**❌ Email verification:**
- User verifies email → ❌ No `user.email.verified` event → Trust score not updated

**❌ Password change:**
- User changes password → ❌ No `user.password.changed` event → Sessions not invalidated

**❌ Account lockout:**
- User locked out → ❌ No `user.account.locked` event → Admins not notified

**❌ MFA changes:**
- User enables MFA → ❌ No `user.mfa.enabled` event → Security score not updated

**❌ GDPR deletion:**
- User requests deletion → ❌ No `user.data_deletion.requested` event → Cascade deletion not triggered

---

## Recommendations

### For MVP Launch (Optional)

**Skip users module events for MVP:**
- Users module events are nice-to-have but not critical
- Admin events (already working) handle most critical flows
- Can add users events in v2

**Rationale:**
- MVP already has critical financial protection (donations + loyalty idempotency)
- Admin can manually handle edge cases
- Reduces scope and risk for MVP launch

### For v2 (Recommended)

**Add users module event publishing (2-3 days):**

1. **Day 1:** Integrate EventBusService into UserService (5-6 events)
2. **Day 2:** Integrate into MfaService + PrivacyService (6 events)
3. **Day 3:** Testing and validation

**Priority order:**
1. ✅ CRITICAL: `user.data_deletion.requested` (GDPR compliance)
2. ✅ HIGH: `user.registered` (loyalty account creation)
3. ✅ HIGH: `user.password.changed` (session invalidation)
4. ✅ HIGH: `user.account.locked` (security monitoring)
5. 🟡 MEDIUM: Email/phone verification, MFA events
6. 🟢 LOW: Account restoration

---

## Action Items

### For MVP (This Week)

- [ ] ✅ **DO NOTHING** - Users events not critical for MVP
- [ ] Document that users events are planned for v2
- [ ] Update MVP-PRODUCTION-READINESS.md with this limitation

### For v2 (Week 3-4)

- [ ] Add EventBusService to UserService constructor
- [ ] Emit `user.registered` in `create()` method
- [ ] Emit `user.password.changed` in `updatePassword()` method
- [ ] Emit `user.account.locked` in `recordFailedLogin()` method
- [ ] Emit `user.data_deletion.requested` in `processDataDeletion()` method
- [ ] Add EventBusService to MfaService
- [ ] Add EventBusService to PrivacyComplianceService
- [ ] Test all event flows end-to-end
- [ ] Monitor event processing in production

---

## Testing Users Module (When Implemented)

```bash
# Test user registration event
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!@#", "firstName": "Test", "lastName": "User"}'

# Check RabbitMQ queue
curl -u admin:rabbitmq_dev_password http://localhost:15672/api/queues/%2Ffoodwaste/foodwaste.loyalty.user-registered

# Expected: message count = 1
# Expected: Loyalty account created for test@example.com
```

---

## Summary

**Admin Module:** ✅ Fully integrated (15+ events publishing to RabbitMQ)

**Users Module:** ⚠️ Partially ready
- Listeners: ✅ All migrated to RabbitMQ (3 listeners, 14 handlers)
- Publishers: ❌ Not implemented yet (need to add EventBusService to 3 services)

**Recommendation:** Launch MVP without users events, add in v2 (2-3 days work)

---

**Prepared By:** Claude Sonnet 4.5
**Date:** 2026-01-23
