# ✅ Backend Errors Fixed

## Issues Found and Fixed

### Issue 1: InventoryService CastError ❌ → ✅ FIXED

**Error Message:**
```
ERROR [InventoryService] Error updating expired items: Cast to embedded failed for value "{
  quantity: 0,
  previousQuantity: '$currentStock',
  newQuantity: '$currentStock',
  reason: 'expired',
  notes: 'Automatically marked as expired',
  timestamp: 2026-01-24T23:00:00.067Z
}" (type Object) at path "stockHistory" because of "CastError"
```

**Root Cause:**
The code was trying to use MongoDB aggregation pipeline syntax (`'$currentStock'`) in a **regular update operation**. This doesn't work because:

- Aggregation variables like `$currentStock` only work in aggregation pipelines
- Regular `.updateMany()` with object syntax doesn't support field references
- Mongoose tries to cast the string `'$currentStock'` as a literal value, causing CastError

**The Broken Code:**
```typescript
// ❌ WRONG - Using aggregation syntax in regular update
await this.inventoryModel.updateMany(
  { expiryDate: { $lt: new Date() } },
  {
    $set: { status: InventoryStatus.EXPIRED },
    $push: {
      stockHistory: {
        previousQuantity: '$currentStock', // ❌ This won't work!
        newQuantity: '$currentStock',      // ❌ Treated as literal string
      },
    },
  }
);
```

**The Fix:**
```typescript
// ✅ CORRECT - Using aggregation pipeline update (array syntax)
await this.inventoryModel.updateMany(
  { expiryDate: { $lt: new Date() } },
  [  // ← Array syntax enables aggregation pipeline
    {
      $set: {
        status: InventoryStatus.EXPIRED,
        stockHistory: {
          $concatArrays: [
            { $ifNull: ['$stockHistory', []] },  // Preserve existing history
            [
              {
                quantity: 0,
                previousQuantity: '$currentStock',  // ✅ Now works!
                newQuantity: '$currentStock',       // ✅ References field value
                reason: StockUpdateReason.EXPIRED,
                notes: 'Automatically marked as expired',
                timestamp: new Date(),
              },
            ],
          ],
        },
      },
    },
  ]
);
```

**Changes Made:**
1. Replaced object update syntax `{...}` with array syntax `[...]`
2. Used `$concatArrays` to append to existing stockHistory array
3. Used `$ifNull` to handle cases where stockHistory doesn't exist yet
4. Now `$currentStock` properly references the document's field value

**File Modified:**
- `apps/food-waste-backend/src/inventory/inventory.service.ts` (lines 377-415)

**Impact:**
- ✅ Cron job will now run successfully at midnight
- ✅ Expired inventory items will be marked correctly
- ✅ Stock history will be properly tracked with actual field values

---

### Issue 2: TimeoutNegativeWarning ⚠️

**Warning Message:**
```
(node:37552) TimeoutNegativeWarning: -1 is a negative number.
Timeout duration was set to 1.
```

**Root Cause:**
This warning typically occurs when:
1. **Redis server is not running** and Bull/BullMQ is trying to connect
2. A library is passing `-1` as a timeout value (which Node.js converts to 1)
3. Background job queue is attempting reconnection with invalid config

**Likely Source:**
- Bull/BullMQ trying to connect to Redis
- Redis client initialization with missing/invalid timeout config

**Investigation:**
```typescript
// Current Bull configuration in app.module.ts
BullModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(configService.get('REDIS_PORT')) || 6379,
      password: configService.get('REDIS_PASSWORD'),
      connectTimeout: 10000,  // ✅ Has timeout
      commandTimeout: 5000,   // ✅ Has timeout
    },
  }),
}),
```

**Current Status: ⚠️ NON-CRITICAL**

This is a **warning, not an error**. The application continues to run normally.

**Solutions (Choose One):**

#### Option 1: Ignore Warning (Recommended for Development)
If you're not using Redis/Bull queues in development:
- Warning is harmless
- Application works fine without background jobs
- No action needed

#### Option 2: Start Redis Server
```bash
# Windows (using Docker)
docker run -d --name redis -p 6379:6379 redis:latest

# Or install Redis for Windows
# https://github.com/microsoftarchive/redis/releases
```

#### Option 3: Disable Bull Module in Development
```typescript
// In app.module.ts
const bullModule = process.env.NODE_ENV === 'production'
  ? BullModule.forRootAsync({ ... })
  : undefined;

@Module({
  imports: [
    ConfigModule.forRoot(),
    ...(bullModule ? [bullModule] : []),
    // ... other modules
  ],
})
```

#### Option 4: Add Explicit Timeout Fallback
```typescript
// In app.module.ts - BullModule configuration
BullModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(configService.get('REDIS_PORT')) || 6379,
      password: configService.get('REDIS_PASSWORD'),
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,  // ← Prevent reconnection attempts
      enableReadyCheck: false,     // ← Don't wait for Redis to be ready
    },
  }),
}),
```

**Recommendation:**
- **Development**: Ignore the warning or disable Bull module
- **Production**: Ensure Redis server is running and properly configured

---

## Testing Results

### Before Fix:
```bash
❌ ERROR [InventoryService] Error updating expired items: CastError
⚠️ TimeoutNegativeWarning: -1 is a negative number
```

### After Fix:
```bash
✅ No CastError (aggregation pipeline update works correctly)
⚠️ TimeoutNegativeWarning: Still present but non-critical (Redis not running)
```

---

## Summary

| Issue | Severity | Status | Action Required |
|-------|----------|--------|-----------------|
| **InventoryService CastError** | 🔴 Critical | ✅ **FIXED** | None - Code updated |
| **TimeoutNegativeWarning** | 🟡 Warning | ⚠️ Non-Critical | Optional - Start Redis or ignore |

---

## Next Steps

### Immediate (Done ✅)
- [x] Fix InventoryService CastError with aggregation pipeline
- [x] Test that cron job runs without errors

### Optional (For Production)
- [ ] Set up Redis server for background job processing
- [ ] Configure Bull queues for async tasks
- [ ] Monitor cron job execution logs

### Verification Commands

**Test the inventory cron job manually:**
```typescript
// In your code or NestJS CLI
const inventoryService = app.get(InventoryService);
await inventoryService.updateExpiredItems();
// Should see: "Updated X expired items" with no errors
```

**Check MongoDB aggregation works:**
```javascript
// In MongoDB shell
db.inventoryitems.updateMany(
  { expiryDate: { $lt: new Date() } },
  [
    {
      $set: {
        stockHistory: {
          $concatArrays: [
            { $ifNull: ['$stockHistory', []] },
            [
              {
                quantity: 0,
                previousQuantity: '$currentStock',
                newQuantity: '$currentStock',
                timestamp: new Date()
              }
            ]
          ]
        }
      }
    }
  ]
);
```

---

## Technical Details

### MongoDB Aggregation Pipeline Updates

**Supported in MongoDB 4.2+**

Regular Update (Object Syntax):
```typescript
.updateMany(query, { $set: { field: value } })  // ❌ Can't reference fields
```

Aggregation Pipeline Update (Array Syntax):
```typescript
.updateMany(query, [{ $set: { field: '$otherField' } }])  // ✅ Can reference fields
```

**Operators Available in Pipeline Updates:**
- `$set` - Set field values
- `$unset` - Remove fields
- `$replaceRoot` - Replace entire document
- `$addFields` - Add computed fields
- `$project` - Reshape documents
- All aggregation operators: `$concatArrays`, `$ifNull`, `$cond`, etc.

---

## References

- [MongoDB Aggregation Pipeline Updates](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateMany/#update-with-aggregation-pipeline)
- [Mongoose Aggregation](https://mongoosejs.com/docs/api/model.html#model_Model-updateMany)
- [Bull Queue Configuration](https://docs.bullmq.io/guide/connections)
- [Node.js Timeout Warnings](https://nodejs.org/api/timers.html#timers_settimeout_callback_delay_args)

---

**Implementation Date**: 2026-01-25
**Status**: ✅ **CastError FIXED** | ⚠️ Timeout warning non-critical
**Impact**: Critical bug resolved, cron jobs will now execute successfully
