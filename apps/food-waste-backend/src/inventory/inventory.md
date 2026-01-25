# Inventory Module

## Overview

Real-time inventory management system for surplus food items with stock tracking, reservations, automated alerts, and business analytics.

**Purpose**: Track available, reserved, and sold stock for merchant offers with automated expiry monitoring, low-stock alerts, and comprehensive audit trails.

**Status**: Production-ready | Full CRUD + stock management + analytics

---

## Architecture

### Module Structure

```
inventory/
├── dto/
│   └── inventory.dto.ts           # 8 DTOs with class-validator rules
├── schemas/
│   └── inventory-item.schema.ts   # Mongoose schema + indexes + pre-save hooks
├── inventory.controller.ts        # 15 REST endpoints
├── inventory.service.ts           # Business logic + cron jobs
└── inventory.module.ts            # NestJS module
```

### Dependencies

- **Database**: MongoDB with Mongoose (stock tracking, audit logs)
- **Scheduling**: `@nestjs/schedule` (expiry cron jobs)
- **Authentication**: JwtAuthGuard + RolesGuard
- **Validation**: class-validator + class-transformer

---

## API Endpoints

### Base Path: `/api/v1/inventory`

All endpoints require JWT authentication (`@UseGuards(JwtAuthGuard)`)

#### Inventory Management

| Method | Endpoint | Auth Roles | Description |
|--------|----------|------------|-------------|
| POST | `/` | MERCHANT, ADMIN | Create new inventory item |
| GET | `/` | ALL | List items with filters (pagination, status, category) |
| GET | `/:id` | ALL | Get single item by ID |
| PUT | `/:id` | MERCHANT, ADMIN | Update item (not implemented) |

#### Stock Operations

| Method | Endpoint | Auth Roles | Description |
|--------|----------|------------|-------------|
| PATCH | `/:id/stock` | MERCHANT, ADMIN | Update stock quantity |
| POST | `/:id/reserve` | CONSUMER, MERCHANT, ADMIN | Reserve stock for order |
| POST | `/:id/release` | MERCHANT, ADMIN | Release reserved stock |
| POST | `/:id/confirm-sale` | MERCHANT, ADMIN | Confirm sale and deduct stock |
| POST | `/bulk-update` | MERCHANT, ADMIN | Bulk update stock for multiple items |

#### Analytics & Reports

| Method | Endpoint | Auth Roles | Description |
|--------|----------|------------|-------------|
| GET | `/analytics/overview` | MERCHANT, ADMIN | Inventory analytics (totals, value, revenue) |
| GET | `/alerts/active` | MERCHANT, ADMIN | Get active unacknowledged alerts |
| POST | `/alerts/:alertId/acknowledge` | MERCHANT, ADMIN | Acknowledge alert (not implemented) |
| GET | `/reports/low-stock` | MERCHANT, ADMIN | Low stock report |
| GET | `/reports/expiring` | MERCHANT, ADMIN | Expiring items report (default: 3 days) |
| GET | `/:id/history` | MERCHANT, ADMIN | Stock movement history for item |

---

## Data Models

### InventoryItem Schema

```typescript
{
  offerId: ObjectId,              // Reference to Offer
  establishmentId: ObjectId,      // Reference to Establishment
  name: string,                   // Item name
  description?: string,
  currentStock: number,           // Total units available
  initialStock: number,           // Starting quantity
  reservedStock: number,          // Units reserved for orders
  availableStock: number,         // currentStock - reservedStock (auto-calculated)
  lowStockThreshold: number,      // Default: 5
  status: InventoryStatus,        // AVAILABLE | LOW_STOCK | OUT_OF_STOCK | EXPIRED | RESERVED
  expiryDate: Date,
  batchNumber?: string,
  originalPrice: number,
  discountedPrice: number,
  discountPercentage: number,     // Auto-calculated
  categories: string[],
  tags: string[],
  isActive: boolean,              // Default: true
  autoUpdateStatus: boolean,      // Default: true
  stockHistory: StockMovement[],  // Audit trail
  alerts: StockAlert[],           // System alerts
  lastStockCheck?: Date,
  lastUpdatedBy?: ObjectId,
  estimatedSoldBy?: Date,
  totalSold: number,
  totalRevenue: number,
  location?: string,
  storageConditions?: string,
  metadata?: Map<string, string>
}
```

### Sub-Documents

#### StockMovement (Audit Trail)

```typescript
{
  quantity: number,               // Change amount (+/-)
  previousQuantity: number,
  newQuantity: number,
  reason: StockUpdateReason,      // MANUAL_ADJUSTMENT | ORDER_PLACED | ORDER_CANCELLED | EXPIRED | DAMAGED | SOLD_OUT | RESTOCKED
  notes?: string,
  orderId?: ObjectId,
  updatedBy?: ObjectId,
  timestamp: Date
}
```

#### StockAlert

```typescript
{
  type: string,                   // LOW_STOCK | OUT_OF_STOCK | EXPIRING_SOON
  threshold: number,
  currentLevel: number,
  message: string,
  createdAt: Date,
  acknowledged: boolean,
  acknowledgedAt?: Date,
  acknowledgedBy?: ObjectId
}
```

### Enums

```typescript
enum InventoryStatus {
  AVAILABLE = 'available',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  EXPIRED = 'expired',
  RESERVED = 'reserved'
}

enum StockUpdateReason {
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  ORDER_PLACED = 'order_placed',
  ORDER_CANCELLED = 'order_cancelled',
  EXPIRED = 'expired',
  DAMAGED = 'damaged',
  SOLD_OUT = 'sold_out',
  RESTOCKED = 'restocked'
}
```

---

## Key Features

### 1. Stock Reservation System

Prevents overselling through atomic stock reservations:

```typescript
// Reserve stock when order is placed
POST /api/v1/inventory/:id/reserve
{
  "quantity": 2,
  "orderId": "676b1234...",
  "expiresAt": "2026-01-16T12:00:00Z"
}

// Release stock if order is cancelled
POST /api/v1/inventory/:id/release
{
  "quantity": 2,
  "reason": "order_cancelled",
  "notes": "Customer cancelled order"
}

// Confirm sale when order is completed
POST /api/v1/inventory/:id/confirm-sale
{
  "quantity": 2,
  "orderId": "676b1234..."
}
```

**Flow**:
1. Order placed → Reserve stock (`reservedStock += quantity`)
2. Order cancelled → Release stock (`reservedStock -= quantity`)
3. Order completed → Confirm sale (`currentStock -= quantity, reservedStock -= quantity`)

**Validation**:
- Reserve: `availableStock >= quantity`
- Release: `reservedStock >= quantity`
- Confirm: `reservedStock >= quantity`

### 2. Automated Alerts

System automatically generates alerts for:

- **Low Stock**: `currentStock <= lowStockThreshold && currentStock > 0`
- **Out of Stock**: `currentStock === 0`
- **Expiring Soon**: Item expires within configured threshold

Alerts stored in `alerts[]` array with acknowledgment tracking.

### 3. Auto-Status Updates

Pre-save hook automatically updates `status` when `autoUpdateStatus: true`:

```typescript
if (expiryDate < now) → EXPIRED
else if (currentStock === 0) → OUT_OF_STOCK
else if (currentStock <= lowStockThreshold) → LOW_STOCK
else if (availableStock > 0) → AVAILABLE
```

### 4. Audit Trail

Every stock change recorded in `stockHistory[]`:
- Quantity change
- Previous/new quantities
- Reason (enum)
- Order reference (if applicable)
- User who made change
- Timestamp

### 5. Cron Jobs

#### Expiry Checker (Hourly)

```typescript
@Cron(CronExpression.EVERY_HOUR)
async checkExpiringItems()
```

Checks items expiring within 24 hours and creates `EXPIRING_SOON` alerts.

#### Expiry Updater (Daily at Midnight)

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async updateExpiredItems()
```

Marks expired items as `EXPIRED` and logs to stock history.

### 6. Analytics

```typescript
GET /api/v1/inventory/analytics/overview?establishmentId=676b...
```

Returns aggregated metrics:
- Total items/stock/reserved/available
- Total inventory value
- Total revenue
- Average discount percentage
- Low stock item count
- Out of stock item count
- Expired item count

---

## DTOs

### CreateInventoryItemDto

Required fields: `offerId`, `establishmentId`, `name`, `initialStock`, `expiryDate`, `originalPrice`, `discountedPrice`

Optional fields: `description`, `lowStockThreshold` (default: 5), `batchNumber`, `categories`, `tags`, `location`, `storageConditions`, `autoUpdateStatus` (default: true)

### StockUpdateDto

```typescript
{
  quantity: number,        // Positive to add, negative to remove
  reason: StockUpdateReason,
  notes?: string,
  orderId?: string
}
```

### InventoryFiltersDto

Supports pagination and filtering:
- `establishmentId`: Filter by merchant
- `status`: Filter by InventoryStatus
- `category`: Filter by category
- `lowStock`: Boolean (items at/below threshold)
- `expiringSoon`: Boolean
- `expiringInDays`: Number (default: 3)
- `page`, `limit`: Pagination (default: 1, 20)
- `sortBy`: Sort field (default: '-createdAt')

---

## Database Indexes

Optimized for common queries:

```typescript
{ offerId: 1 }
{ establishmentId: 1 }
{ status: 1 }
{ expiryDate: 1 }
{ establishmentId: 1, status: 1 }              // Compound
{ currentStock: 1, lowStockThreshold: 1 }      // Compound
{ createdAt: -1 }
```

Run `pnpm verify:indexes` after schema changes.

---

## Integration Points

### Offers Module

- `offerId` references `Offer` collection
- Inventory item created when offer is published
- Stock synced with offer availability

### Orders Module

- Order placement triggers stock reservation
- Order completion triggers sale confirmation
- Order cancellation triggers stock release
- `orderId` tracked in stock history

### Establishments Module

- `establishmentId` references `Establishment` collection
- Merchants can only manage their own inventory
- Admin can view/manage all inventory

### Notifications Module (Future)

- Low stock alerts → Notify merchant
- Expiring soon alerts → Notify merchant
- Out of stock alerts → Notify merchant + disable offer

---

## Error Handling

### Common Errors

- `404 NotFoundException`: Inventory item not found
- `400 BadRequestException`: Insufficient stock for reservation
- `400 BadRequestException`: Cannot release more than reserved
- `400 BadRequestException`: Cannot confirm sale without sufficient reserved stock
- `403 ForbiddenException`: User lacks required role

### Validation

All DTOs use class-validator:
- `@IsMongoId()`: ObjectId format validation
- `@Min(0)`: Non-negative numbers
- `@IsEnum()`: Valid enum values
- `@IsDate()`: Valid date format

---

## Security

### Authentication

All endpoints require JWT Bearer token via `JwtAuthGuard`.

### Authorization

Role-based access control:
- **CONSUMER**: Can reserve stock (order placement)
- **MERCHANT**: Can manage inventory for own establishments
- **ADMIN**: Full access to all inventory operations

### Resource Ownership

Merchants can only update inventory for their own establishments (enforced in service layer).

---

## Testing

### Unit Tests

Test service methods:
- Stock calculations (available = current - reserved)
- Alert generation logic
- Status auto-update logic
- Stock history recording

### Integration Tests

Test controller endpoints:
- CRUD operations with authentication
- Stock reservation flow
- Bulk operations
- Filtering and pagination

### E2E Tests

Test complete workflows:
1. Create inventory item → Reserve stock → Confirm sale → Verify stock reduced
2. Create inventory item → Reserve stock → Cancel order → Verify stock released
3. Item expiration → Verify cron job marks as expired
4. Low stock → Verify alert generated

---

## Usage Examples

### Create Inventory Item

```bash
POST /api/v1/inventory
Authorization: Bearer <jwt>

{
  "offerId": "676b12345678901234567890",
  "establishmentId": "676b98765432109876543210",
  "name": "Fresh Baguettes",
  "description": "End-of-day baguettes",
  "initialStock": 20,
  "lowStockThreshold": 5,
  "expiryDate": "2026-01-16T23:59:59Z",
  "batchNumber": "BATCH-2026-01-15",
  "originalPrice": 2.50,
  "discountedPrice": 1.00,
  "categories": ["bakery", "bread"],
  "tags": ["gluten-free", "vegan"],
  "location": "Main bakery shelf",
  "storageConditions": "Room temperature"
}
```

### Get Low Stock Items

```bash
GET /api/v1/inventory/reports/low-stock?establishmentId=676b...
Authorization: Bearer <jwt>
```

### Reserve Stock for Order

```bash
POST /api/v1/inventory/676b.../reserve
Authorization: Bearer <jwt>

{
  "quantity": 3,
  "orderId": "676c12345678901234567890"
}
```

### View Stock History

```bash
GET /api/v1/inventory/676b.../history
Authorization: Bearer <jwt>
```

Returns sorted stock movements with timestamps and reasons.

---

## Known Issues

### Not Implemented

- `PUT /:id` - Update inventory item (controller returns error)
- `POST /alerts/:alertId/acknowledge` - Acknowledge alert (controller returns error)

### Limitations

- Stock reservation expiration not enforced (manual release required)
- No automatic cleanup of old stock history entries
- Alert deduplication not implemented (may create duplicate alerts)

---

## Performance Considerations

### Indexes

Compound indexes optimize common queries:
- Merchant inventory listing: `{ establishmentId: 1, status: 1 }`
- Low stock detection: `{ currentStock: 1, lowStockThreshold: 1 }`

### Cron Job Optimization

- Expiry checker runs hourly (not every minute) to reduce DB load
- Expiry updater runs at midnight off-peak hours
- Uses selective queries with status filters

### Aggregation Pipeline

Analytics endpoint uses MongoDB aggregation for efficient calculations without loading all documents into memory.

---

## Future Enhancements

### Planned Features

1. **Stock Reservation TTL**: Auto-release reservations after expiration
2. **Alert Acknowledgment**: Implement acknowledge endpoint with notes
3. **Multi-Location Inventory**: Track stock across multiple storage locations
4. **Predictive Analytics**: ML-based demand forecasting
5. **Batch Operations**: Bulk create/update with transaction support
6. **Stock Transfer**: Move inventory between establishments
7. **Waste Tracking**: Record and analyze expired/damaged items
8. **Integration with Offers**: Auto-disable offers when out of stock

### API v2 Considerations

- WebSocket support for real-time stock updates
- GraphQL endpoint for flexible queries
- Batch mutations with atomic transactions
- Event sourcing for complete audit trail
- CQRS pattern for read/write separation

---

## Monitoring & Logging

### Structured Logs

Service uses `Logger` from `@nestjs/common`:
- Info: Stock updates, reservations, bulk operations
- Error: DB failures, validation errors, cron job failures

### Metrics

Track via Prometheus (`/metrics`):
- Total inventory items by status
- Stock reservation rate
- Alert generation rate
- Cron job execution time

### Health Checks

Inventory module health included in `/health/readiness`:
- MongoDB connection status
- Scheduled job status
- Alert processing lag

---

## Development Notes

### Adding New Stock Update Reason

1. Add enum value to `StockUpdateReason` in schema
2. Update DTOs using the enum
3. Update service logic if special handling needed
4. Add tests for new reason
5. Update API documentation

### Adding New Alert Type

1. Update alert type in `checkAndCreateAlerts()` method
2. Define threshold logic
3. Update notification module integration (future)
4. Add tests for alert generation

### Modifying Schema

1. Update `inventory-item.schema.ts`
2. Update related DTOs
3. Add/modify indexes if needed
4. Run `pnpm verify:indexes`
5. Create migration script if needed
6. Update tests and documentation

---

## Related Documentation

- [Offers Module](../offers/offer.md) - Surplus food listings
- [Orders Module](../orders/order.md) - Order processing
- [Establishments Module](../establishments/establishment.md) - Merchant management
- [Auth Module](../auth/auth.md) - Authentication & authorization
- [Backend CLAUDE.md](../../CLAUDE.md) - Project architecture

---

## Swagger Documentation

Interactive API documentation available at:

```
http://localhost:3000/api/v1/api-docs
```

Filter by `Inventory` tag to view all inventory endpoints.

---

## Contact & Support

For questions or issues related to inventory management:
1. Check this documentation
2. Review Swagger API docs
3. Inspect service logs with correlation IDs
4. Check MongoDB indexes and query performance
5. Review stock history for audit trail

**Last Updated**: 2026-01-15
**Module Version**: 1.0.0
**Status**: Production-ready
