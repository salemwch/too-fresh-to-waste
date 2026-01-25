# Establishments Module - Event Analysis for MVP

**Date:** 2026-01-23
**Question:** Does establishments module need EventBusService for MVP?

---

## Current State

### Events Being Emitted (7 total)

**Publisher:** `establishments.service.ts`
**Method:** Using **EventEmitter2** (old pattern, not RabbitMQ)

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

constructor(
  private readonly eventEmitter: EventEmitter2, // ← Old pattern
) {}
```

**Events emitted:**
1. `establishment.created` (line 90) - New establishment registered
2. `establishment.updated` (line 250) - Establishment details changed
3. `establishment.stats.updated` (line 301) - Stats recalculated
4. `establishment.deleted` (line 351) - Establishment soft deleted
5. `establishment.document.uploaded` (line 517) - Legal document uploaded
6. `establishment.document.verified` (line 621) - Document verified by admin
7. `establishment.document.deleted` (line 695) - Document removed

---

## Who's Listening?

### Answer: ❌ **NOBODY**

**Search results:** No listeners found for `establishment.*` events

The only establishment-related listeners are for **ADMIN** events:
- ✅ `admin.establishment.suspended` → Offers listener deactivates offers
- ✅ `admin.establishment.reactivated` → Offers listener logs reactivation
- ✅ `admin.establishment.approved` → Offers listener logs approval

These admin events are **already migrated to RabbitMQ** and work correctly.

---

## Impact Analysis

### What Works Today (Admin Events - Already Migrated)

**Admin suspends establishment:**
```
Admin calls admin-service.suspendEstablishment()
  → Emits admin.establishment.suspended (via EventBusService → RabbitMQ)
  → Offers listener receives event
  → Deactivates all offers for that establishment
```

✅ **This critical flow already works with RabbitMQ**

### What Doesn't Work (Establishment Events - No Listeners)

**Merchant creates establishment:**
```
Merchant calls establishments-service.create()
  → Emits establishment.created (via EventEmitter2)
  → ❌ No listeners registered
  → Event does nothing
```

**Merchant uploads document:**
```
Merchant calls establishments-service.uploadDocument()
  → Emits establishment.document.uploaded (via EventEmitter2)
  → ❌ No listeners registered
  → Event does nothing
```

**Admin verifies document:**
```
Admin calls establishments-service.verifyDocument()
  → Emits establishment.document.verified (via EventEmitter2)
  → ❌ No listeners registered
  → Event does nothing
```

---

## Potential Use Cases (Future)

If we added listeners, these events could be useful for:

### 1. establishment.created
- **Analytics:** Track merchant signup rate
- **Notifications:** Send welcome email to merchant
- **Admin:** Add to verification queue

### 2. establishment.updated
- **Cache:** Invalidate establishment cache
- **Search:** Re-index establishment in search
- **Notifications:** Notify followers of changes

### 3. establishment.deleted
- **Offers:** Deactivate all offers (⚠️ already handled by admin.establishment.suspended)
- **Orders:** Cancel pending orders
- **Reviews:** Mark as deleted

### 4. establishment.document.uploaded
- **Admin:** Add to verification queue
- **Notifications:** Notify admin team
- **Compliance:** Track document submission

### 5. establishment.document.verified
- **Notifications:** Notify merchant of verification
- **Analytics:** Track verification time
- **Compliance:** Audit trail

---

## Recommendation for MVP

### ❌ **SKIP - Not Needed for MVP**

**Reasons:**
1. ✅ **Critical flows already work** - Admin establishment events (suspend/approve) are migrated and handle offers
2. ❌ **No listeners exist** - Events are emitted but nobody consumes them
3. ⏱️ **Time vs value** - Would take 1-2 days to migrate with no immediate benefit
4. 📊 **Analytics not critical for MVP** - Can track manually or add in v2
5. 🔔 **Notifications not critical for MVP** - Can send emails directly from service

**Impact of skipping:**
- ✅ No broken functionality (events aren't being used anyway)
- ✅ Admin flows (suspend/approve) still work via admin.establishment.* events
- 🟡 Missed opportunity for analytics (acceptable for MVP)
- 🟡 No automatic notifications (acceptable for MVP)

---

## Alternative: Add EventBusService (If Needed)

### If you want to add it (1-2 days work):

**Step 1:** Update establishments.service.ts constructor

```typescript
// BEFORE (Old)
import { EventEmitter2 } from '@nestjs/event-emitter';

constructor(
  private readonly eventEmitter: EventEmitter2,
) {}

// AFTER (New - RabbitMQ)
import { EventBusService } from '../common/services/event-bus/event-bus.service';

constructor(
  private readonly eventBusService: EventBusService,
) {}
```

**Step 2:** Replace all emit calls (7 locations)

```typescript
// BEFORE
this.eventEmitter.emit('establishment.created', event);

// AFTER
await this.eventBusService.emit('establishment.created', event);
```

**Step 3:** Create listeners (optional for MVP)

Only create if you need the functionality:
- Analytics listener → Track establishment creation
- Notifications listener → Send emails
- Admin queue listener → Add to verification queue

**Effort:** 1-2 days (half day for migration, 1-1.5 days for listeners)

---

## Comparison: Admin vs Regular Establishment Events

| Feature | Admin Events | Establishment Events |
|---------|--------------|---------------------|
| **Publisher** | `admin/services/establishment-management.service.ts` | `establishments/establishments.service.ts` |
| **Uses EventBusService?** | ✅ YES (RabbitMQ) | ❌ NO (EventEmitter2) |
| **Has Listeners?** | ✅ YES (offers listener) | ❌ NO |
| **Critical for MVP?** | ✅ YES (deactivate offers on suspend) | ❌ NO (analytics/notifications) |
| **Events Published** | 6 (suspended, approved, etc.) | 7 (created, updated, etc.) |

**Key insight:** Admin events are more critical because they enforce business rules (deactivate offers when suspended). Regular establishment events are more for observability/notifications.

---

## MVP Decision Matrix

| Action | Effort | Value | Priority | Recommendation |
|--------|--------|-------|----------|----------------|
| **Skip establishments events** | 0 days | 0 | - | ✅ **DO THIS for MVP** |
| **Migrate to EventBusService** | 0.5 days | Low | Nice-to-have | ⏭️ Skip for MVP |
| **Migrate + Add listeners** | 1-2 days | Medium | Future | 🔄 Add in v2 |

---

## Final Recommendation

**For MVP:** ✅ **SKIP** - Don't add EventBusService to establishments module

**Reasoning:**
- Admin establishment events (already migrated) handle critical business logic
- Regular establishment events have no listeners (not being used)
- Would add 1-2 days to timeline with no immediate benefit
- Can add in v2 when you build analytics dashboard

**For v2:** Consider adding if you need:
- Analytics dashboard (merchant signup tracking)
- Automated email notifications (document verification)
- Admin verification queue automation
- Search index auto-updates

---

**Prepared By:** Claude Sonnet 4.5
**Date:** 2026-01-23
**Decision:** SKIP for MVP ✅
