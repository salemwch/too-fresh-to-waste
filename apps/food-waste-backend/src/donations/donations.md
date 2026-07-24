# Donations Module - Technical Documentation

> **Technical Reference** | **Status:** Production Ready | **Last Updated:**
> January 15, 2026

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Business Logic](#business-logic)
- [Design Patterns](#design-patterns)
- [Testing Strategy](#testing-strategy)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Overview

The `donations` module implements the social impact layer of the Too Fresh To
Waste platform, automatically collecting micro-donations from order platform
fees and redistributing them to food relief organizations. It provides
transparent impact tracking, gamification, and community engagement features.

### Technology Stack

- **Database:** MongoDB with Mongoose ODM
- **Scheduling:** @nestjs/schedule for cron jobs
- **Validation:** class-validator + class-transformer
- **Documentation:** Swagger/OpenAPI decorators
- **Indexing:** Optimized compound indexes for performance

### Key Features

✅ **Automatic Donation Collection** - 5% of platform fee (25% of order total)
goes to donations ✅ **Donation Pool Management** - Rotating pools with target
amounts and distribution tracking ✅ **Real-Time Statistics** - Public endpoint
for community impact metrics ✅ **User Contribution Tracking** - Personal
donation history with rankings ✅ **Gamification System** - 5-tier badge system
(First Step → Champion) ✅ **Meal Impact Calculation** - Transparent conversion
of donations to meals (5 TND/meal) ✅ **Distribution Transparency** - Full audit
trail of donations to beneficiary organizations ✅ **Automated Pool Rotation** -
Monthly archival via cron jobs

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────┐
│      Order Created (5 TND)              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   Calculate Donation Amount             │
│   Platform Fee: 5 * 0.25 = 1.25 TND    │
│   Donation: 1.25 * 0.05 = 0.0625 TND   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   DonationsService.createDonation()     │
│   ├─ Get/create active pool             │
│   ├─ Check idempotency (orderId)        │
│   ├─ Calculate meal count (0.05/5 = 0)  │
│   └─ Create UserDonation record         │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   Update Donation Pool (Atomic)         │
│   ├─ Increment currentAmount (+0.05)    │
│   ├─ Increment mealCount (+0)           │
│   └─ Update contributor count           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   Calculate & Assign User Badges        │
│   ├─ Get user total donations           │
│   ├─ Check badge thresholds             │
│   └─ Update badgesEarned array          │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   Check Pool Target Reached             │
│   ├─ If currentAmount >= targetAmount   │
│   └─ Transition status: ACTIVE → FUNDED │
└─────────────────────────────────────────┘
```

### Donation Pool Lifecycle

```
┌─────────────┐
│   ACTIVE    │ ← Default state when pool created
└──────┬──────┘
       │ currentAmount >= targetAmount
       ▼
┌─────────────┐
│   FUNDED    │ ← Target reached, ready for distribution
└──────┬──────┘
       │ Admin distributes to beneficiaries
       ▼
┌─────────────┐
│ DISTRIBUTED │ ← Distribution completed with receipts
└──────┬──────┘
       │ Monthly cron job (1st of month)
       ▼
┌─────────────┐
│  ARCHIVED   │ ← Historical record, new pool created
└─────────────┘
```

---

## Directory Structure

```
donations/
├── dto/                                # Data Transfer Objects
│   └── donation-stats.dto.ts          # Response DTOs for statistics
│
├── interfaces/                         # TypeScript interfaces
│   └── donation.interface.ts          # Business logic interfaces & constants
│
├── schemas/                            # MongoDB schemas
│   ├── donation-pool.schema.ts        # Global donation pool tracking
│   └── user-donation.schema.ts        # Individual user contributions
│
├── donations.controller.ts             # HTTP endpoints
├── donations.module.ts                 # NestJS module definition
├── donations.service.ts                # Core business logic
└── donations.md                        # ← This file (technical docs)
```

---

## Core Components

### 1. Controller

#### `DonationsController`

**Location:** `donations.controller.ts`

**Purpose:** HTTP endpoint handlers for donation statistics and health checks

**Key Endpoints:**

**Public Endpoints:**

- `GET /donations/stats` - Current donation pool statistics (public, no auth)
- `GET /donations/health` - Health check for monitoring

**Protected Endpoints:**

- `GET /donations/user/stats` - User-specific donation statistics (requires JWT)

**Example:**

```typescript
// GET /donations/stats (Public)
@Public()
@Get('stats')
@HttpCode(HttpStatus.OK)
@ApiOperation({
  summary: 'Get current donation pool statistics',
  description: 'Retrieve real-time statistics about the active donation pool...',
})
async getCurrentDonationStats(): Promise<DonationStatsResponseDto> {
  const stats = await this.donationsService.getCurrentStats();
  return stats;
}

// GET /donations/user/stats (Protected)
@UseGuards(JwtAuthGuard)
@Get('user/stats')
@ApiBearerAuth()
async getUserDonationStats(
  @CurrentUser('userId') userId: string,
): Promise<UserDonationStatsResponseDto> {
  const userObjectId = new Types.ObjectId(userId);
  const stats = await this.donationsService.getUserStats(userObjectId);
  return stats;
}
```

**Response Example:**

```json
{
  "totalDonations": 847.3,
  "targetAmount": 1000,
  "mealCount": 169,
  "contributorCount": 1843,
  "progressPercentage": 84.73,
  "status": "active",
  "cause": "Community Food Relief 2025",
  "currency": "TND",
  "targetDate": "2025-12-31T23:59:59.000Z"
}
```

---

### 2. Service

#### `DonationsService`

**Location:** `donations.service.ts`

**Responsibilities:**

- Donation pool initialization and lifecycle management
- Automatic donation calculation from order totals
- User contribution tracking with idempotency
- Badge calculation and assignment
- Pool statistics aggregation
- Automated archival via cron jobs

**Key Methods:**

**Donation Calculation:**

```typescript
/**
 * Calculate donation amount from order total
 * Formula: (orderTotal * platformFeePercentage) * donationPercentage
 * Example: (5 DT * 0.25) * 0.05 = 0.0625 DT
 */
calculateDonationAmount(orderTotal: number): number {
  if (orderTotal <= 0) {
    throw new BadRequestException('Order total must be greater than 0');
  }

  const platformFee = orderTotal * DONATION_CONSTANTS.PLATFORM_FEE_PERCENTAGE; // 0.25
  const donationAmount = platformFee * DONATION_CONSTANTS.DONATION_PERCENTAGE; // 0.05

  return parseFloat(donationAmount.toFixed(3)); // Precision to 3 decimals
}

/**
 * Calculate estimated meals from donation amount
 */
calculateMealCount(donationAmount: number): number {
  return Math.floor(donationAmount / DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND); // 5 TND
}
```

**Donation Creation (Called by Order Service):**

```typescript
/**
 * Create a donation record for a user's order
 * This is called automatically when an order is created
 */
async createDonation(input: CreateDonationInput): Promise<UserDonationDocument> {
  // 1. Get or create active pool
  const pool = await this.getActivePool();

  // 2. Check if donation already exists for this order (idempotency)
  const existingDonation = await this.userDonationModel.findOne({
    orderId: input.orderId,
    isDeleted: false,
  });
  if (existingDonation) {
    return existingDonation; // Prevent duplicate donations
  }

  // 3. Calculate meals
  const estimatedMeals = this.calculateMealCount(input.amount);

  // 4. Create donation record
  const donation = new this.userDonationModel({
    userId: input.userId,
    orderId: input.orderId,
    donationPoolId: pool._id,
    amount: input.amount,
    currency: input.currency || 'TND',
    contributedAt: new Date(),
    isAnonymous: input.isAnonymous || false,
    badgesEarned: [],
    metadata: input.metadata,
  });
  await donation.save();

  // 5. Update pool atomically (race condition safe)
  await this.donationPoolModel.findByIdAndUpdate(
    pool._id,
    {
      $inc: {
        currentAmount: input.amount,
        mealCount: estimatedMeals,
      },
    },
    { new: true },
  );

  // 6. Update contributor count (unique users)
  await this.updateContributorCount(pool._id as Types.ObjectId);

  // 7. Calculate and assign badges (non-blocking)
  await this.calculateAndAssignBadges(input.userId, donation._id as Types.ObjectId);

  // 8. Check if pool reached target
  await this.checkPoolTargetReached(pool._id as Types.ObjectId);

  return donation;
}
```

**Badge Calculation:**

```typescript
/**
 * Calculate and assign badges based on user's donation history
 */
private async calculateAndAssignBadges(
  userId: Types.ObjectId,
  donationId: Types.ObjectId,
): Promise<void> {
  const stats = await this.getUserStats(userId);
  const earnedBadges: DonationBadge[] = [];

  // Badge criteria (cumulative)
  if (stats.contributionCount >= 1) {
    earnedBadges.push(DonationBadge.FIRST_STEP); // 1+ contributions
  }
  if (stats.contributionCount >= 10) {
    earnedBadges.push(DonationBadge.COMMUNITY_HELPER); // 10+ contributions
  }
  if (stats.totalDonated >= 50) {
    earnedBadges.push(DonationBadge.IMPACT_MAKER); // 50+ TND donated
  }
  if (stats.totalDonated >= 100) {
    earnedBadges.push(DonationBadge.FOOD_HERO); // 100+ TND donated
  }
  if (stats.totalDonated >= 500) {
    earnedBadges.push(DonationBadge.CHAMPION); // 500+ TND donated
  }

  // Update the donation record with badges
  if (earnedBadges.length > 0) {
    await this.userDonationModel.findByIdAndUpdate(donationId, {
      badgesEarned: earnedBadges,
    });
  }
}
```

**User Statistics:**

```typescript
/**
 * Get user-specific donation statistics
 */
async getUserStats(userId: Types.ObjectId): Promise<UserDonationStatsResponseDto> {
  // Aggregate user donations
  const userDonations = await this.userDonationModel.find({
    userId,
    isDeleted: false,
  });

  const totalDonated = userDonations.reduce((sum, d) => sum + d.amount, 0);
  const contributionCount = userDonations.length;

  // Get badges from most recent donation
  const latestDonation = userDonations.sort(
    (a, b) => b.contributedAt.getTime() - a.contributedAt.getTime(),
  )[0];
  const badgesEarned = latestDonation?.badgesEarned || [];
  const mealsContributed = this.calculateMealCount(totalDonated);

  // Calculate rank (count users with more donations)
  const usersWithMore = await this.userDonationModel.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$userId', total: { $sum: '$amount' } } },
    { $match: { total: { $gt: totalDonated } } },
    { $count: 'count' },
  ]);

  const rank = (usersWithMore[0]?.count || 0) + 1;

  return {
    totalDonated: parseFloat(totalDonated.toFixed(2)),
    contributionCount,
    badgesEarned,
    mealsContributed,
    rank,
    currency: 'TND',
  };
}
```

**Automated Pool Archival:**

```typescript
/**
 * Archive old pools and create new one (admin/cron job)
 * Runs monthly to rotate donation pools
 */
@Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
async archiveCompletedPools(): Promise<void> {
  const fundedPools = await this.donationPoolModel.find({
    status: DonationPoolStatus.FUNDED,
    isArchived: false,
  });

  for (const pool of fundedPools) {
    pool.isArchived = true;
    pool.archivedAt = new Date();
    await pool.save();
    this.logger.log(`Archived donation pool ${pool._id}`);
  }
}
```

---

### 3. Schemas

#### `DonationPool` Schema

**Location:** `schemas/donation-pool.schema.ts`

**Purpose:** Tracks global donation pool with progress tracking and distribution
history

**Key Fields:**

```typescript
{
  currentAmount: number;           // Total donations collected (TND)
  targetAmount: number;            // Target amount for this pool (default 1000 TND)
  mealCount: number;               // Estimated meals funded
  contributorCount: number;        // Unique user contributors
  totalDistributed: number;        // Amount distributed to beneficiaries
  status: DonationPoolStatus;      // ACTIVE | FUNDED | DISTRIBUTED | ARCHIVED
  cause: string;                   // Campaign description (e.g., "Winter Relief 2025")
  startDate: Date;                 // Pool start date
  targetDate?: Date;               // Optional deadline
  distributionHistory: [{          // Audit trail of distributions
    amount: number;
    mealCount: number;
    beneficiaryOrganization: string;
    distributedAt: Date;
    receipts: string[];            // URLs to distribution receipts
    notes?: string;
    distributedBy: ObjectId;       // Admin who performed distribution
  }];
  metadata?: object;               // Extended data (campaigns, partners, etc.)
  isArchived: boolean;             // Pool archived and historical
  archivedAt?: Date;
}
```

**Indexes:**

```typescript
// Composite index for active pool queries
{ status: 1, isArchived: 1 }

// Sort by start date
{ startDate: -1 }

// Creation date index
{ createdAt: -1 }
```

**Virtual Fields:**

```typescript
// Calculated progress percentage
progressPercentage: (currentAmount / targetAmount) * 100;

// Boolean target reached check
isTargetReached: currentAmount >= targetAmount;
```

---

#### `UserDonation` Schema

**Location:** `schemas/user-donation.schema.ts`

**Purpose:** Tracks individual user contributions with gamification support

**Key Fields:**

```typescript
{
  userId: ObjectId;                // User who made the donation
  orderId: ObjectId;               // Order that triggered donation (unique)
  donationPoolId: ObjectId;        // Pool this donation belongs to
  amount: number;                  // Donation amount in currency
  currency: string;                // Currency code (default: TND)
  contributedAt: Date;             // Donation timestamp
  isAnonymous: boolean;            // Hide user in public leaderboards
  badgesEarned: DonationBadge[];   // Gamification badges
  metadata?: {                     // Optional tracking data
    deviceInfo?: string;
    platform?: 'mobile' | 'web';
    sessionId?: string;
    campaignId?: string;
  };
  isDeleted: boolean;              // Soft delete flag
  deletedAt?: Date;
}
```

**Indexes:**

```typescript
// User donation history
{ userId: 1, contributedAt: -1 }

// Pool-specific user contributions
{ donationPoolId: 1, userId: 1 }

// Idempotency: prevent duplicate donations per order
{ orderId: 1 }, { unique: true }

// Soft delete queries
{ isDeleted: 1, userId: 1 }

// Creation date
{ createdAt: -1 }
```

**Badge Enum:**

```typescript
enum DonationBadge {
  FIRST_STEP = 'first_step', // 1+ contributions
  COMMUNITY_HELPER = 'community_helper', // 10+ contributions
  IMPACT_MAKER = 'impact_maker', // 50+ TND donated
  FOOD_HERO = 'food_hero', // 100+ TND donated
  CHAMPION = 'champion', // 500+ TND donated
}
```

---

### 4. DTOs

#### `DonationStatsResponseDto`

**Location:** `dto/donation-stats.dto.ts`

**Purpose:** Response format for public donation pool statistics

**Fields:**

```typescript
{
  totalDonations: number;      // Current pool amount
  targetAmount: number;        // Pool target
  mealCount: number;           // Estimated meals funded
  contributorCount: number;    // Unique contributors
  progressPercentage: number;  // Progress towards target
  status: DonationPoolStatus;  // Pool status
  cause: string;               // Campaign description
  currency: string;            // Currency code
  targetDate?: string;         // ISO 8601 deadline
}
```

#### `UserDonationStatsResponseDto`

**Purpose:** Response format for user-specific donation statistics

**Fields:**

```typescript
{
  totalDonated: number;        // Total amount donated by user
  contributionCount: number;   // Number of donations made
  badgesEarned: string[];      // Badges earned
  mealsContributed: number;    // Estimated meals from user's donations
  rank: number;                // Leaderboard ranking
  currency: string;            // Currency code
}
```

---

### 5. Interfaces & Constants

#### `DONATION_CONSTANTS`

**Location:** `interfaces/donation.interface.ts`

**Business Logic Configuration:**

```typescript
export const DONATION_CONSTANTS = {
  PLATFORM_FEE_PERCENTAGE: 0.25, // 25% platform fee on orders
  DONATION_PERCENTAGE: 0.05, // 5% of platform fee → donations
  MEAL_COST_ESTIMATE_TND: 5.0, // Estimated cost per meal in Tunisia
  DEFAULT_TARGET_AMOUNT: 1000, // Default pool target (TND)
  DEFAULT_CURRENCY: 'TND', // Tunisian Dinar
} as const;
```

**Calculation Examples:**

```typescript
// Order: 5 TND
// Platform fee: 5 * 0.25 = 1.25 TND
// Donation: 1.25 * 0.05 = 0.0625 TND
// Meals: 0.0625 / 5 = 0 meals (need 80 orders = 5 TND = 1 meal)

// Order: 100 TND
// Platform fee: 100 * 0.25 = 25 TND
// Donation: 25 * 0.05 = 1.25 TND
// Meals: 1.25 / 5 = 0 meals (need 4 orders like this = 1 meal)

// Order: 400 TND
// Platform fee: 400 * 0.25 = 100 TND
// Donation: 100 * 0.05 = 5 TND
// Meals: 5 / 5 = 1 meal
```

#### `BADGE_THRESHOLDS`

**Badge Unlock Criteria:**

```typescript
export const BADGE_THRESHOLDS = {
  FIRST_STEP: { count: 1, amount: 0 }, // First donation
  COMMUNITY_HELPER: { count: 10, amount: 0 }, // 10 donations
  IMPACT_MAKER: { count: 0, amount: 50 }, // 50 TND total
  FOOD_HERO: { count: 0, amount: 100 }, // 100 TND total
  CHAMPION: { count: 0, amount: 500 }, // 500 TND total
} as const;
```

---

## Business Logic

### Donation Lifecycle

**1. Order Creation Triggers Donation:**

```typescript
// In OrderService.createOrder()
const order = await this.orderModel.create({ ... });

const donationAmount = this.donationsService.calculateDonationAmount(order.total);

await this.donationsService.createDonation({
  userId: order.userId,
  orderId: order._id,
  amount: donationAmount,
  currency: 'TND',
  metadata: {
    platform: 'mobile',
    sessionId: req.headers['x-session-id'],
  },
});
```

**2. Donation Creation Flow:**

- Idempotency check (prevent duplicate donations per order)
- Get active donation pool (create if none exists)
- Calculate meal impact
- Create UserDonation record
- Atomically update DonationPool counters
- Update unique contributor count
- Calculate and assign user badges
- Check if pool target reached (transition to FUNDED)

**3. Pool Status Transitions:**

```
ACTIVE → FUNDED:
  Triggered when currentAmount >= targetAmount
  Automatic via checkPoolTargetReached()

FUNDED → DISTRIBUTED:
  Manual admin action (not yet implemented)
  Should record distribution details in distributionHistory

DISTRIBUTED → ARCHIVED:
  Automatic monthly via @Cron job
  Sets isArchived = true, archivedAt = Date
```

---

### Edge Cases & Safeguards

**Idempotency:**

```typescript
// Prevent duplicate donations if order processing retries
const existingDonation = await this.userDonationModel.findOne({
  orderId: input.orderId,
  isDeleted: false,
});
if (existingDonation) {
  return existingDonation; // Return existing, don't create new
}
```

**Atomic Pool Updates:**

```typescript
// Race condition safe: multiple orders processed concurrently
await this.donationPoolModel.findByIdAndUpdate(
  pool._id,
  {
    $inc: { currentAmount: amount, mealCount: meals },
  },
  { new: true },
);
```

**Pool Initialization:**

```typescript
// Ensure active pool exists on service startup
private async initializeDefaultPool(): Promise<void> {
  const existingPool = await this.donationPoolModel.findOne({
    status: DonationPoolStatus.ACTIVE,
    isArchived: false,
  });

  if (!existingPool) {
    const defaultPool = new this.donationPoolModel({
      currentAmount: 0,
      targetAmount: 1000,
      status: DonationPoolStatus.ACTIVE,
      cause: 'Community Food Relief 2025',
      startDate: new Date(),
    });
    await defaultPool.save();
  }
}
```

**Error Handling:**

```typescript
// Non-critical badge assignment failures don't block donation
try {
  await this.calculateAndAssignBadges(userId, donationId);
} catch (error) {
  this.logger.error('Failed to calculate badges', error);
  // Don't throw - donation already created successfully
}
```

---

## Design Patterns

### 1. Service Layer Pattern

**Problem:** Separate business logic from HTTP layer

**Solution:** DonationsService encapsulates all business logic

**Benefits:**

- Reusable logic (called from OrderService)
- Testable without HTTP mocking
- Clear separation of concerns

---

### 2. Repository Pattern (Implicit)

**Implementation:**

```typescript
// Direct Mongoose model injection
constructor(
  @InjectModel(DonationPool.name)
  private readonly donationPoolModel: Model<DonationPoolDocument>,
  @InjectModel(UserDonation.name)
  private readonly userDonationModel: Model<UserDonationDocument>,
) {}
```

**Note:** For larger applications, consider extracting to dedicated repository
classes

---

### 3. Cron Job Pattern

**Implementation:**

```typescript
@Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
async archiveCompletedPools(): Promise<void> {
  // Automated pool rotation
}
```

**Configuration:**

```typescript
// app.module.ts
ScheduleModule.forRoot();
```

---

### 4. Soft Delete Pattern

**Implementation:**

```typescript
// UserDonation schema
isDeleted: boolean;     // Default: false
deletedAt?: Date;

// Queries always filter soft-deleted records
await this.userDonationModel.find({
  userId,
  isDeleted: false, // ← Explicit filter
});
```

**Benefits:**

- Preserve audit trail
- Support donation refunds
- Regulatory compliance

---

## Testing Strategy

### Unit Tests

**Example:**

```typescript
describe('DonationsService', () => {
  let service: DonationsService;
  let donationPoolModel: Model<DonationPoolDocument>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DonationsService,
        {
          provide: getModelToken(DonationPool.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
        {
          provide: getModelToken(UserDonation.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
    donationPoolModel = module.get(getModelToken(DonationPool.name));
  });

  describe('calculateDonationAmount', () => {
    it('should calculate donation correctly (5 TND order)', () => {
      const result = service.calculateDonationAmount(5);
      expect(result).toBe(0.0625); // (5 * 0.25) * 0.05
    });

    it('should calculate donation correctly (100 TND order)', () => {
      const result = service.calculateDonationAmount(100);
      expect(result).toBe(1.25); // (100 * 0.25) * 0.05
    });

    it('should throw error for invalid order total', () => {
      expect(() => service.calculateDonationAmount(0)).toThrow(
        BadRequestException,
      );
      expect(() => service.calculateDonationAmount(-10)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('calculateMealCount', () => {
    it('should calculate meals correctly', () => {
      expect(service.calculateMealCount(5)).toBe(1); // 5 TND = 1 meal
      expect(service.calculateMealCount(10)).toBe(2); // 10 TND = 2 meals
      expect(service.calculateMealCount(2.5)).toBe(0); // 2.5 TND = 0 meals (floor)
    });
  });
});
```

---

### Integration Tests

**Example:**

```typescript
describe('DonationsController (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongoMemoryUri), DonationsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('GET /donations/stats should return pool statistics', async () => {
    const response = await request(app.getHttpServer())
      .get('/donations/stats')
      .expect(200);

    expect(response.body).toHaveProperty('totalDonations');
    expect(response.body).toHaveProperty('targetAmount');
    expect(response.body).toHaveProperty('mealCount');
    expect(response.body).toHaveProperty('contributorCount');
    expect(response.body.status).toBe('active');
  });

  it('GET /donations/user/stats should require authentication', async () => {
    await request(app.getHttpServer()).get('/donations/user/stats').expect(401); // Unauthorized
  });
});
```

---

## Common Tasks

### Task 1: Integrate Donations with Order Creation

**Location:** `orders/orders.service.ts`

**Implementation:**

```typescript
import { DonationsService } from '../donations/donations.service';

@Injectable()
export class OrdersService {
  constructor(private readonly donationsService: DonationsService) {}

  async createOrder(dto: CreateOrderDto, userId: string): Promise<Order> {
    // 1. Create order
    const order = await this.orderModel.create({
      userId,
      total: dto.total,
      ...dto,
    });

    // 2. Calculate and create donation
    try {
      const donationAmount = this.donationsService.calculateDonationAmount(
        order.total,
      );

      await this.donationsService.createDonation({
        userId: new Types.ObjectId(userId),
        orderId: order._id,
        amount: donationAmount,
        currency: 'TND',
        metadata: {
          platform: 'mobile',
        },
      });
    } catch (error) {
      // Log error but don't fail order creation
      this.logger.error('Failed to create donation', error);
    }

    return order;
  }
}
```

---

### Task 2: Display Donation Stats in Mobile App

**Frontend Integration:**

```typescript
// features/donations/services/donationsService.ts
import { apiClient } from '@/services/apiClient';
import type { DonationStats } from '../types';

export const donationsService = {
  async getStats(): Promise<DonationStats> {
    const response = await apiClient.get<DonationStats>('/donations/stats');
    return response.data;
  },

  async getUserStats(): Promise<UserDonationStats> {
    const response = await apiClient.get<UserDonationStats>('/donations/user/stats');
    return response.data;
  },
};

// features/donations/screens/DonationsScreen.tsx
export const DonationsScreen = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['donations', 'stats'],
    queryFn: () => donationsService.getStats(),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <View>
      <Text>Total Raised: {stats.totalDonations} TND</Text>
      <ProgressBar
        value={stats.progressPercentage}
        max={100}
      />
      <Text>Meals Funded: {stats.mealCount}</Text>
      <Text>Contributors: {stats.contributorCount}</Text>
    </View>
  );
};
```

---

### Task 3: Add Admin Distribution Tracking

**New DTO:**

```typescript
// dto/create-distribution.dto.ts
export class CreateDistributionDto {
  @IsString()
  @IsNotEmpty()
  beneficiaryOrganization: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  @Min(0)
  mealCount: number;

  @IsArray()
  @IsString({ each: true })
  receipts: string[]; // URLs to distribution receipts

  @IsOptional()
  @IsString()
  notes?: string;
}
```

**Service Method:**

```typescript
async distributePool(
  poolId: Types.ObjectId,
  distribution: CreateDistributionDto,
  adminUserId: Types.ObjectId,
): Promise<void> {
  const pool = await this.donationPoolModel.findById(poolId);

  if (!pool || pool.status !== DonationPoolStatus.FUNDED) {
    throw new BadRequestException('Pool must be FUNDED to distribute');
  }

  if (distribution.amount > pool.currentAmount) {
    throw new BadRequestException('Distribution amount exceeds pool balance');
  }

  // Add distribution to history
  pool.distributionHistory.push({
    amount: distribution.amount,
    mealCount: distribution.mealCount,
    beneficiaryOrganization: distribution.beneficiaryOrganization,
    distributedAt: new Date(),
    receipts: distribution.receipts,
    notes: distribution.notes,
    distributedBy: adminUserId,
  });

  pool.totalDistributed += distribution.amount;
  pool.currentAmount -= distribution.amount;

  // If fully distributed, mark as DISTRIBUTED
  if (pool.currentAmount === 0) {
    pool.status = DonationPoolStatus.DISTRIBUTED;
  }

  await pool.save();
  this.logger.log(`Distributed ${distribution.amount} TND to ${distribution.beneficiaryOrganization}`);
}
```

---

### Task 4: Add Leaderboard Endpoint

**Controller:**

```typescript
@Get('leaderboard')
@Public()
@ApiOperation({ summary: 'Get top donors leaderboard' })
async getLeaderboard(
  @Query('limit') limit: number = 10,
): Promise<LeaderboardEntry[]> {
  return this.donationsService.getLeaderboard(limit);
}
```

**Service:**

```typescript
async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
  const topDonors = await this.userDonationModel.aggregate([
    { $match: { isDeleted: false, isAnonymous: false } },
    {
      $group: {
        _id: '$userId',
        totalDonated: { $sum: '$amount' },
        contributionCount: { $sum: 1 },
      },
    },
    { $sort: { totalDonated: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        totalDonated: 1,
        contributionCount: 1,
        displayName: '$user.displayName',
        avatar: '$user.profilePicture',
      },
    },
  ]);

  return topDonors.map((donor, index) => ({
    rank: index + 1,
    ...donor,
  }));
}
```

---

## Troubleshooting

### Issue: Duplicate donations for same order

**Cause:** Order processing retried without idempotency check

**Debug:**

```typescript
const duplicates = await this.userDonationModel.aggregate([
  { $group: { _id: '$orderId', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
]);
console.log('Duplicate donations:', duplicates);
```

**Solution:** Idempotency check already implemented:

```typescript
const existingDonation = await this.userDonationModel.findOne({
  orderId: input.orderId,
  isDeleted: false,
});
if (existingDonation) {
  return existingDonation; // ✓ Return existing
}
```

---

### Issue: Pool currentAmount doesn't match sum of user donations

**Cause:** Race condition in concurrent updates or failed transaction

**Debug:**

```typescript
const pool = await this.donationPoolModel.findById(poolId);
const donations = await this.userDonationModel.find({
  donationPoolId: poolId,
  isDeleted: false,
});
const actualTotal = donations.reduce((sum, d) => sum + d.amount, 0);

console.log('Pool currentAmount:', pool.currentAmount);
console.log('Sum of donations:', actualTotal);
console.log('Discrepancy:', pool.currentAmount - actualTotal);
```

**Solution:** Use atomic updates (already implemented):

```typescript
await this.donationPoolModel.findByIdAndUpdate(
  pool._id,
  { $inc: { currentAmount: amount } }, // ✓ Atomic increment
  { new: true },
);
```

---

### Issue: Badge not awarded despite meeting threshold

**Cause:** Badge calculation logic uses latest donation only

**Debug:**

```typescript
const userDonations = await this.userDonationModel.find({
  userId,
  isDeleted: false,
});
const totalDonated = userDonations.reduce((sum, d) => sum + d.amount, 0);
const contributionCount = userDonations.length;

console.log('Total donated:', totalDonated);
console.log('Contribution count:', contributionCount);
console.log('Expected badges:' /* calculate based on thresholds */);
console.log('Actual badges:', userDonations[0]?.badgesEarned);
```

**Solution:** Badge calculation correctly aggregates all donations:

```typescript
const stats = await this.getUserStats(userId); // ✓ Aggregates all donations
```

---

### Issue: Cron job not running

**Cause:** ScheduleModule not imported or timezone misconfiguration

**Debug:**

```bash
# Check if ScheduleModule imported in app.module.ts
grep -r "ScheduleModule" apps/food-waste-backend/src/app.module.ts

# Check server timezone
date
TZ=UTC date
```

**Solution:**

```typescript
// app.module.ts
@Module({
  imports: [
    ScheduleModule.forRoot(), // ✓ Enable cron jobs
    // ...
  ],
})

// Set timezone in .env
TZ=UTC
```

---

### Issue: Performance degradation with large datasets

**Cause:** Missing indexes or inefficient aggregations

**Debug:**

```typescript
// Explain query plan
const explained = await this.userDonationModel
  .find({ userId })
  .explain('executionStats');

console.log('Query execution stats:', explained);
```

**Solution:** Verify indexes exist:

```bash
pnpm verify:indexes

# Or manually:
db.userdonations.getIndexes()
```

Expected indexes:

- `{ userId: 1, contributedAt: -1 }`
- `{ donationPoolId: 1, userId: 1 }`
- `{ orderId: 1 }` (unique)

---

## References

- [MongoDB Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/)
- [NestJS Scheduling](https://docs.nestjs.com/techniques/task-scheduling)
- [Mongoose Atomic Operations](<https://mongoosejs.com/docs/api/model.html#Model.findByIdAndUpdate()>)
- [Idempotency Patterns](https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html)

---

**Document Version:** 1.0.0 **Last Updated:** January 15, 2026 **Maintained
By:** Backend Development Team **Review Cycle:** Quarterly
