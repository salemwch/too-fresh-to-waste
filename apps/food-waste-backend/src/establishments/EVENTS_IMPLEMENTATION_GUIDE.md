# Establishments Module - Event-Driven Architecture Implementation Guide

## Overview

This guide documents the event-driven architecture implementation for the Establishments module. Events enable loose coupling between modules and allow cross-module communication without direct dependencies.

## Event Emission Strategy

### ✅ WHERE EVENTS SHOULD BE USED

Events are emitted for **state changes** and **important business actions** that other modules need to react to:

1. **EstablishmentCreatedEvent** (`establishment.created`)
   - **Triggered by:** `create()` method
   - **Use case:** New establishment registration
   - **Listeners:** Analytics (track merchant signup), Notifications (confirmation email), Admin (review queue)

2. **EstablishmentUpdatedEvent** (`establishment.updated`)
   - **Triggered by:** `update()` method (significant changes only)
   - **Use case:** Address change, contact info update, business hours modification
   - **Listeners:** Search (re-indexing), Cache (invalidation), Notifications (if address changed)
   - **Note:** Only emitted for significant fields (address, contact, businessHours, type, name)

3. **EstablishmentDeletedEvent** (`establishment.deleted`)
   - **Triggered by:** `remove()` method (soft delete)
   - **Use case:** Establishment deactivation/deletion
   - **Listeners:** Offers (deactivate all), Orders (cancel pending), Reviews (mark deleted), Analytics

4. **EstablishmentDocumentUploadedEvent** (`establishment.document.uploaded`)
   - **Triggered by:** `uploadDocument()` method
   - **Use case:** Legal document uploaded (business license, food safety certificate, etc.)
   - **Listeners:** Admin (verification queue), Notifications, Compliance (tracking), Analytics

5. **EstablishmentDocumentVerifiedEvent** (`establishment.document.verified`)
   - **Triggered by:** `verifyDocument()` method (admin only)
   - **Use case:** Document verified by admin
   - **Listeners:** Notifications (merchant notification), Analytics, Compliance (audit trail)
   - **Special:** May trigger establishment approval if all required documents are verified

6. **EstablishmentDocumentDeletedEvent** (`establishment.document.deleted`)
   - **Triggered by:** `deleteDocument()` method
   - **Use case:** Document removed
   - **Listeners:** Admin (notify for re-verification), Analytics, Compliance (audit trail)

7. **EstablishmentStatsUpdatedEvent** (`establishment.stats.updated`)
   - **Triggered by:** `updateStats()` method
   - **Use case:** Stats recalculation (rating, reviews, orders, offers)
   - **Listeners:** Analytics (performance tracking), Cache (invalidation), Search (ranking update)

### ❌ WHERE EVENTS SHOULD NOT BE USED

Events are **NOT emitted** for:

1. **Read operations** - `findAll()`, `findById()`, `findByOwnerId()`, `getNearby()`, `getStats()`
   - Read operations don't change state
   - No need to notify other modules

2. **Internal calculations** - `updateStats()` is triggered BY other events, not emitting to itself

3. **Admin status changes** - Already handled by admin-specific events in `common/events/admin-establishment.events.ts`:
   - `admin.establishment.approved`
   - `admin.establishment.rejected`
   - `admin.establishment.suspended`
   - `admin.establishment.reactivated`
   - `admin.establishment.verified`

## Event Naming Convention

```
module.entity.action
```

Examples:
- `establishment.created`
- `establishment.updated`
- `establishment.deleted`
- `establishment.document.uploaded`
- `establishment.document.verified`
- `establishment.stats.updated`

## Creating Event Listeners

### Example: Listen for Establishment Deletion in Offers Module

Create `apps/food-waste-backend/src/offers/listeners/establishment-events.listener.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EstablishmentDeletedEvent } from '../../common/events';
import { OffersService } from '../offers.service';

@Injectable()
export class EstablishmentEventsListener {
  private readonly logger = new Logger(EstablishmentEventsListener.name);

  constructor(private readonly offersService: OffersService) {}

  /**
   * When an establishment is deleted, deactivate all its offers
   */
  @OnEvent('establishment.deleted')
  async handleEstablishmentDeleted(event: EstablishmentDeletedEvent): Promise<void> {
    try {
      this.logger.log(
        `Establishment ${event.establishmentId} (${event.establishmentName}) deleted. Deactivating all offers.`,
      );

      // Deactivate all offers for this establishment
      const deactivatedCount = await this.offersService.deactivateEstablishmentOffers(
        event.establishmentId,
        `Establishment deleted: ${event.deletionReason}`,
      );

      this.logger.log(
        `Successfully deactivated ${deactivatedCount} offers for deleted establishment ${event.establishmentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to deactivate offers for deleted establishment ${event.establishmentId}:`,
        error,
      );
      // Don't throw - event listeners should not break the flow
    }
  }
}
```

### Register the Listener in Module

Update `apps/food-waste-backend/src/offers/offers.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { EstablishmentEventsListener } from './listeners/establishment-events.listener';

@Module({
  // ... other config
  providers: [
    OffersService,
    EstablishmentEventsListener, // Add this
  ],
})
export class OffersModule {}
```

## Event Listener Best Practices

### 1. Always Use Try-Catch
```typescript
@OnEvent('establishment.created')
async handleEstablishmentCreated(event: EstablishmentCreatedEvent): Promise<void> {
  try {
    // Your logic here
  } catch (error) {
    this.logger.error('Failed to process event', error);
    // Don't throw - prevents breaking the event chain
  }
}
```

### 2. Log Event Processing
```typescript
this.logger.log(`Processing establishment.created event for ${event.establishmentId}`);
```

### 3. Don't Throw Errors
Event listeners should be resilient. Log errors but don't throw them to prevent breaking other listeners.

### 4. Keep Listeners Focused
One listener per concern. Don't handle multiple unrelated tasks in one listener.

### 5. Use Async/Await
Event handlers should be async to handle I/O operations properly.

## Suggested Listeners to Implement

### Offers Module
- **Listen to:** `establishment.deleted`, `establishment.updated` (address changes)
- **Action:** Deactivate offers, update offer locations

### Orders Module
- **Listen to:** `establishment.deleted`
- **Action:** Cancel pending orders, notify customers

### Reviews Module
- **Listen to:** `establishment.deleted`
- **Action:** Soft-delete or archive reviews

### Notifications Module
- **Listen to:** `establishment.created`, `establishment.document.verified`, `establishment.deleted`
- **Action:** Send confirmation emails, document verification notifications

### Analytics Module
- **Listen to:** All establishment events
- **Action:** Track merchant onboarding, document completion rates, deletion reasons

### Admin Module
- **Listen to:** `establishment.created`, `establishment.document.uploaded`
- **Action:** Add to review queue, flag incomplete documents

## Event Payload Structure

All events extend `BaseEstablishmentEvent` which provides:
- `establishmentId: string`
- `ownerId: string`
- `timestamp: Date`
- `correlationId?: string` (for request tracing)

Each event adds specific fields relevant to its action.

## Testing Events

### Unit Test Example

```typescript
describe('EstablishmentsService - Events', () => {
  let service: EstablishmentsService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EstablishmentsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        // ... other providers
      ],
    }).compile();

    service = module.get<EstablishmentsService>(EstablishmentsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should emit establishment.created event', async () => {
    const dto = { /* ... */ };
    const result = await service.create(dto, 'userId');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'establishment.created',
      expect.objectContaining({
        establishmentId: result._id.toString(),
        establishmentName: result.name,
      }),
    );
  });
});
```

## Performance Considerations

1. **Event Listeners Run Asynchronously** - The main operation completes before listeners finish
2. **No Transaction Guarantees** - If an event listener fails, the main operation has already committed
3. **Use Queues for Heavy Operations** - For long-running tasks, emit an event that triggers a Bull queue job
4. **Idempotency** - Listeners should handle duplicate events gracefully (use unique IDs)

## Migration Notes

- Existing admin events (`admin.establishment.*`) remain unchanged
- New establishment events complement admin events for non-admin flows
- Listeners should be added incrementally to avoid breaking changes
- Test thoroughly before deploying to production

## Related Files

- **Event Definitions:** `src/common/events/establishment.events.ts`
- **Admin Events:** `src/common/events/admin-establishment.events.ts`
- **Service Implementation:** `src/establishments/establishments.service.ts`
- **Example Listener:** `src/offers/listeners/admin-establishment-events.listener.ts`

## Next Steps

1. Create listeners in dependent modules (offers, orders, reviews)
2. Add notification listeners for merchant communication
3. Implement analytics tracking for all establishment events
4. Add queue-based processing for heavy operations (e.g., search re-indexing)
5. Write integration tests for event chains
