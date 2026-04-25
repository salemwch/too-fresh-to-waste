# Loyalty Module

## Overview

The Loyalty module implements a comprehensive points-based reward system with
gamification features for the Too Fresh To Waste platform. Users earn points
through various activities (purchases, referrals, reviews, streaks) and can
donate points to community food relief.

**Key Features:**

- Tiered points system with multipliers
- Points donation to community food relief (100 points = 1 TND)
- Gamification: referral codes, login streaks, purchase streaks, review rewards
- Badge achievements for milestones
- Friend and business referral tracking with time-bound rewards

## Architecture

### Module Structure

```
loyalty/
├── loyalty.module.ts              # Module definition, exports LoyaltyService + GamificationService
├── loyalty.controller.ts          # REST API endpoints
├── loyalty.service.ts             # Core loyalty logic (points, badges, donations)
├── dto/
│   └── loyalty-account.dto.ts     # Request/response DTOs
├── schemas/
│   └── loyalty-account.schema.ts  # Mongoose schema with gamification tracking
└── services/
    └── gamification.service.ts    # Referrals, streaks, review points, cron jobs
```

### Dependencies

- **DonationsModule** - Points donation integration (forwardRef for circular
  dependency)
- **MongooseModule** - LoyaltyAccount schema registration
- **@nestjs/schedule** - Cron jobs for expiring stale referrals

## Database Schema

### LoyaltyAccount Collection

Located at: `loyalty-account.schema.ts:211`

**Core Fields:**

```typescript
userId: ObjectId (unique)           // Reference to User
totalPoints: number                 // Lifetime points accumulated
availablePoints: number             // Points available for donation
lifetimePointsEarned: number        // Total points ever earned (read-only metric)
totalOrdersCount: number            // Orders completed
totalAmountSpent: number            // Total TND spent
currentTier: string                 // Bronze/Silver/Gold/Platinum
badges: Badge[]                     // Achievement badges
pointsHistory: PointTransaction[]   // Audit trail of all point changes
referralCode: string                // Unique code like "JOHN1234"
```

**Gamification Fields:**

```typescript
friendReferrals: FriendReferral[]        // Friend referral tracking
businessReferrals: BusinessReferral[]    // Business referral tracking
loginStreak: LoginStreak                 // Daily login streak data
purchaseStreak: PurchaseStreak           // Purchase frequency tracking
reviewTracking: ReviewTracking           // Review history and points
```

**Indexes:**

- `{ totalPoints: -1 }` - Leaderboards
- `{ currentTier: 1 }` - Tier filtering
- `{ referralCode: 1 }` - Unique, sparse (only set when generated)
- `{ 'friendReferrals.friendUserId': 1 }` - Friend lookup
- `{ 'friendReferrals.status': 1, 'friendReferrals.expiresAt': 1 }` - Expiry
  queries
- `{ 'businessReferrals.businessUserId': 1 }` - Business lookup
- `{ 'businessReferrals.status': 1, 'businessReferrals.expiresAt': 1 }` - Expiry
  queries

### Sub-Schemas

**Badge** (`loyalty-account.schema.ts:19`)

```typescript
type: BadgeType (enum)       // newcomer, eco_warrior, frequent_saver, etc.
earnedAt: Date
name: string
description: string
iconUrl: string
```

**PointTransaction** (`loyalty-account.schema.ts:37`)

```typescript
amount: number               // Positive or negative
type: 'earned' | 'redeemed' | 'expired' | 'donated'
reason: string
orderId?: ObjectId           // Reference if order-related
offerId?: ObjectId           // Reference if offer-related
createdAt: Date
expiresAt?: Date             // Points expiration (default: 1 year)
```

**FriendReferral** (`loyalty-account.schema.ts:86`)

```typescript
friendUserId: ObjectId
referredAt: Date
expiresAt: Date              // 30 days from referredAt
friendBagCount: number       // Progress: 0-10
status: 'pending' | 'completed' | 'expired'
completedAt?: Date
pointsAwarded: number        // 15 points when completed
```

**BusinessReferral** (`loyalty-account.schema.ts:120`)

```typescript
businessUserId: ObjectId
establishmentId?: ObjectId
referredAt: Date
expiresAt: Date              // 30 days from referredAt
businessOrderCount: number   // Progress: 0-30
status: 'pending' | 'completed' | 'expired'
completedAt?: Date
pointsAwarded: number        // 30 points when completed
```

**LoginStreak** (`loyalty-account.schema.ts:151`)

```typescript
currentStreak: number        // Current consecutive days
lastLoginDate?: Date
pointsEarnedThisMonth: number  // Max 20 points/month
monthlyResetDate?: Date
longestStreak: number        // Historical best
```

**PurchaseStreak** (`loyalty-account.schema.ts:173`)

```typescript
bagsThisPeriod: number       // Bags in current 15-day period
periodStartDate?: Date
completedThisMonth: boolean  // Already earned 10 pts this month?
monthlyResetDate?: Date
totalStreaksCompleted: number
```

**ReviewTracking** (`loyalty-account.schema.ts:195`)

```typescript
reviewedOrderIds: ObjectId[] // Prevent duplicate review points
totalReviewsCount: number
totalReviewPoints: number
```

## Points System

### Tier Configuration

Defined in `loyalty.service.ts:22`

| Tier     | Min Points | Multiplier | Benefits                    |
| -------- | ---------- | ---------- | --------------------------- |
| Bronze   | 0          | 1.0×       | Standard earning rate       |
| Silver   | 400        | 1.2×       | 20% bonus on points earned  |
| Gold     | 1,200      | 1.5×       | 50% bonus on points earned  |
| Platinum | 2,700      | 2.0×       | 100% bonus on points earned |

**Note:** Tiers apply multipliers to point earnings but **do not provide
discounts**.

### Points to TND Conversion

`loyalty.service.ts:33`

- **Rate:** 100 points = 1 TND
- **Usage:** Points donation to community food relief only
- **Meal estimate:** Based on `DONATION_CONSTANTS.MEAL_COST_ESTIMATE_TND` from
  DonationsModule

### Earning Points

**Welcome Bonus** (`loyalty.service.ts:66`)

- 100 points on account creation

**Legacy Referral** (deprecated - use gamification referrals instead)

- 200 points when referred user signs up

**Order Completion** (called by OrderService)

- Points awarded via `addPoints()` based on order value
- Multiplied by current tier multiplier

**Gamification Rewards:**

- See "Gamification Features" section below

### Donating Points

`loyalty.service.ts:142` | Endpoint: `POST /loyalty/donate`

**Process:**

1. Validate user has sufficient `availablePoints`
2. Convert points to TND: `donationAmount = points × 0.01`
3. Calculate estimated meals:
   `Math.floor(donationAmount / MEAL_COST_ESTIMATE_TND)`
4. Deduct points from user account
5. Add to active donation pool via `DonationsService`
6. Create 'donated' type transaction in `pointsHistory`

**Response:**

```typescript
{
  success: true,
  pointsDonated: 500,
  donationAmount: 5.00,
  currency: "TND",
  estimatedMeals: 2,
  remainingPoints: 1500,
  message: "Thank you! Your 500 points have been converted to 5.00 TND..."
}
```

## Gamification Features

Constants defined in `gamification.service.ts:17`

### 1. Referral Code System

**Generation** (`gamification.service.ts:64`)

- Format: `NAME1234` (4 chars from name + 4 random alphanumeric)
- Unique constraint enforced by MongoDB index
- Fallback to timestamp-based code if collision after 10 attempts

**Usage:**

- Users share code with friends and businesses
- New users enter code during signup
- Endpoint: `GET /loyalty/referral-code` returns user's code

### 2. Friend Referral Program

**Rules:**

- Friend must buy **10 bags** within **30 days** of signup
- Referrer earns **15 points** when completed
- Status: PENDING → COMPLETED or EXPIRED

**Flow:**

1. Friend signs up with referral code → `registerFriendReferral()`
2. Each time friend picks up order → `updateFriendBagCount()` (called from
   OrderService)
3. When `friendBagCount >= 10` → Award points, mark COMPLETED
4. If 30 days pass without completion → Cron job marks EXPIRED

**Integration Point:** OrderService must call
`gamificationService.updateFriendBagCount(userId, bagsCount)` on pickup
confirmation

### 3. Business Referral Program

**Rules:**

- Business must complete **30 orders** within **30 days** of signup
- Referrer earns **30 points** when completed
- Status: PENDING → COMPLETED or EXPIRED

**Flow:**

1. Business signs up with referral code → `registerBusinessReferral()`
2. Each time business completes order → `updateBusinessOrderCount()` (called
   from OrderService)
3. When `businessOrderCount >= 30` → Award points, mark COMPLETED
4. If 30 days pass without completion → Cron job marks EXPIRED

**Integration Point:** OrderService must call
`gamificationService.updateBusinessOrderCount(merchantUserId)` on pickup
confirmation

### 4. Login Streak

**Rules:**

- **2 points/day** for first **10 consecutive login days**
- **Max 20 points/month** (resets monthly)
- Streak breaks if user doesn't log in for >1 day

**Implementation** (`gamification.service.ts:324`)

- Called when user logs in: `recordDailyLogin(userId)`
- Checks if already logged in today (no double points)
- Checks if yesterday's login exists (streak continues or resets)
- Awards points if within 10-day window and under monthly cap
- Tracks `longestStreak` for historical stats

**Integration Point:** AuthService should call
`gamificationService.recordDailyLogin(userId)` after successful login

### 5. Purchase Streak

**Rules:**

- Buy **15 bags within 15 days** → **10 points**
- Can only earn once per month
- Period resets if 15 days pass without completion

**Implementation** (`gamification.service.ts:410`)

- Called on order pickup: `updatePurchaseStreak(userId, bagsCount)`
- Tracks `bagsThisPeriod` and `periodStartDate`
- Awards points when threshold reached and not already completed this month
- Resets period if 15 days expire

**Integration Point:** OrderService must call
`gamificationService.updatePurchaseStreak(userId, bagsCount)` on pickup
confirmation

### 6. Review Rewards

**Rules:**

- **10 points** per review (one per order)
- Minimum **6 words** required
- Prevents duplicate reviews for same order

**Implementation** (`gamification.service.ts:482`)

- Called when review submitted: `awardReviewPoints(userId, orderId, reviewText)`
- Validates word count:
  `reviewText.trim().split(/\s+/).filter(w => w.length > 0).length >= 6`
- Checks `reviewTracking.reviewedOrderIds` to prevent duplicates
- Adds `orderId` to `reviewedOrderIds` after awarding points

**Integration Point:** ReviewService must call
`gamificationService.awardReviewPoints(userId, orderId, reviewText)` after
review creation

## Badge System

Badges are awarded automatically by `loyalty.service.ts:254`
(checkAndAwardBadges)

### Badge Types

Defined in `loyalty-account.schema.ts:4`

```typescript
enum BadgeType {
  NEWCOMER = 'newcomer', // Welcome badge (auto-awarded)
  ECO_WARRIOR = 'eco_warrior', // 1000 TND spent
  FREQUENT_SAVER = 'frequent_saver', // 10 orders completed
  EARLY_BIRD = 'early_bird', // (Not implemented yet)
  NIGHT_OWL = 'night_owl', // (Not implemented yet)
  LOYAL_CUSTOMER = 'loyal_customer', // (Not implemented yet)
  SUPER_SAVER = 'super_saver', // (Not implemented yet)
  COMMUNITY_CHAMPION = 'community_champion', // (Not implemented yet)
  STREAK_MASTER = 'streak_master', // (Not implemented yet)
  REFERRAL_CHAMPION = 'referral_champion', // (Not implemented yet)
  BUSINESS_RECRUITER = 'business_recruiter', // (Not implemented yet)
  REVIEWER = 'reviewer', // (Not implemented yet)
}
```

### Current Auto-Awarded Badges

**NEWCOMER** - Awarded on account creation

```typescript
{
  type: 'newcomer',
  name: 'Welcome to Too Fresh To Waste',
  description: 'Joined the fight against food waste',
  iconUrl: '/badges/newcomer.png'
}
```

**FREQUENT_SAVER** - Awarded after 10 orders

```typescript
{
  type: 'frequent_saver',
  name: 'Frequent Saver',
  description: 'Completed 10 orders',
  iconUrl: '/badges/frequent-saver.png'
}
```

**ECO_WARRIOR** - Awarded after 1000 TND spent

```typescript
{
  type: 'eco_warrior',
  name: 'Eco Warrior',
  description: 'Saved 1000 TND worth of food',
  iconUrl: '/badges/eco-warrior.png'
}
```

**Note:** Badge checks run after `addPoints()` calls. Other badge types defined
in schema but not yet implemented.

## API Endpoints

All endpoints under `/loyalty` require `@UseGuards(JwtAuthGuard)` - Bearer token
authentication required.

### Core Loyalty

**POST /loyalty/account**

- Summary: Create loyalty account
- Body: `CreateLoyaltyAccountDto` (userId, optional referredBy)
- Response: 201 - LoyaltyAccount created with 100 point welcome bonus
- Error: 400 - Account already exists

**GET /loyalty/account**

- Summary: Get user loyalty account
- Response: 200 - Full LoyaltyAccount document
- Error: 404 - Account not found

**GET /loyalty/stats**

- Summary: Get loyalty statistics summary
- Response: 200 - `LoyaltyStatsDto` (points, tier, badges, orders, spending)

**POST /loyalty/points/add** (Admin only)

- Guards: `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`
- Params: `userId` (path parameter)
- Body: `AddPointsDto` (amount, reason, optional orderId/offerId/expiresAt)
- Response: 200 - Updated LoyaltyAccount
- Error: 403 - Not admin

### Donations

**POST /loyalty/donate**

- Summary: Donate points to community food relief
- Body: `DonatePointsDto` (amount, optional isAnonymous, message)
- Response: 200 - `DonatePointsResponseDto` (conversion details, estimated
  meals)
- Error: 400 - Insufficient points | 404 - Account not found
- Conversion: 100 points = 1 TND

**GET /loyalty/donations/history**

- Summary: Get user donation history
- Response: 200 - Array of `PointTransaction` with type='donated'

### Gamification

**GET /loyalty/referral-code**

- Summary: Get or generate referral code
- Response: 200 - `{ referralCode: string }`
- Auto-generates code if user doesn't have one

**GET /loyalty/gamification**

- Summary: Get gamification progress
- Response: 200 - Full gamification stats (referrals, streaks, reviews)
- See `gamification.service.ts:536` for response structure

**POST /loyalty/login-streak**

- Summary: Record daily login for streak
- Response: 200 - `{ streakDays, pointsAwarded, message }`
- Awards 2 pts/day for 10-day streaks (max 20 pts/month)
- Idempotent: Returns 0 points if already logged in today

## Integration Points

Other modules must integrate with LoyaltyService/GamificationService at specific
lifecycle hooks:

### 1. AuthService Integration

**On successful login** → Call `gamificationService.recordDailyLogin(userId)`

```typescript
// In auth.service.ts login() method
async login(user: User) {
  // ... JWT generation ...

  // Record login streak
  try {
    await this.gamificationService.recordDailyLogin(user._id.toString());
  } catch (error) {
    this.logger.error('Failed to record login streak', error);
    // Non-blocking: login succeeds even if streak fails
  }

  return { accessToken, refreshToken };
}
```

### 2. OrderService Integration

**On order pickup confirmation** → Call multiple gamification hooks:

```typescript
// In order.service.ts confirmPickup() method
async confirmPickup(orderId: string) {
  // ... order status update ...

  const order = await this.orderModel.findById(orderId).populate('userId');
  const userId = order.userId._id.toString();

  // 1. Update friend referral progress (if referred user)
  await this.gamificationService.updateFriendBagCount(userId, order.bagsCount);

  // 2. Update business referral progress (if merchant)
  if (order.merchantUserId) {
    await this.gamificationService.updateBusinessOrderCount(order.merchantUserId.toString());
  }

  // 3. Update purchase streak
  await this.gamificationService.updatePurchaseStreak(userId, order.bagsCount);

  // 4. Award order points (if applicable)
  await this.loyaltyService.addPoints(userId, {
    amount: calculateOrderPoints(order.totalAmount),
    reason: 'Order completed',
    orderId: order._id.toString(),
  });
}
```

### 3. ReviewService Integration

**On review creation** → Call
`gamificationService.awardReviewPoints(userId, orderId, reviewText)`

```typescript
// In review.service.ts createReview() method
async createReview(createReviewDto: CreateReviewDto, userId: string) {
  // ... review creation ...

  // Award review points
  const result = await this.gamificationService.awardReviewPoints(
    userId,
    createReviewDto.orderId,
    createReviewDto.reviewText
  );

  if (result.awarded) {
    this.logger.log(`Awarded ${result.pointsAwarded} points for review`);
  } else {
    this.logger.warn(`Review points not awarded: ${result.reason}`);
  }

  return review;
}
```

### 4. UserService Integration

**On user registration** → Handle referral code:

```typescript
// In user.service.ts register() method
async register(registerDto: RegisterDto) {
  // ... user creation ...

  // Create loyalty account
  const loyaltyDto: CreateLoyaltyAccountDto = {
    userId: user._id.toString(),
  };

  // If user provided referral code, find referrer
  if (registerDto.referralCode) {
    const referrer = await this.gamificationService.findReferrerByCode(registerDto.referralCode);

    if (referrer) {
      // Register friend referral
      await this.gamificationService.registerFriendReferral(
        referrer.userId.toString(),
        user._id.toString()
      );

      // If user is registering as merchant, also register business referral
      if (registerDto.role === UserRole.MERCHANT) {
        await this.gamificationService.registerBusinessReferral(
          referrer.userId.toString(),
          user._id.toString()
        );
      }
    }
  }

  await this.loyaltyService.createLoyaltyAccount(loyaltyDto);

  return user;
}
```

## Cron Jobs

### Expire Stale Referrals

**Schedule:** `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` **Location:**
`gamification.service.ts:595`

**Purpose:** Mark expired referrals (friend/business) that didn't complete
within 30 days

**Process:**

1. Find all PENDING friend referrals where `expiresAt < now`
2. Update status to EXPIRED using arrayFilters
3. Find all PENDING business referrals where `expiresAt < now`
4. Update status to EXPIRED using arrayFilters
5. Log count of expired referrals

**MongoDB Query:**

```typescript
loyaltyModel.updateMany(
  {
    'friendReferrals.status': 'pending',
    'friendReferrals.expiresAt': { $lt: now },
  },
  {
    $set: { 'friendReferrals.$[elem].status': 'expired' },
  },
  {
    arrayFilters: [
      { 'elem.status': 'pending', 'elem.expiresAt': { $lt: now } },
    ],
  },
);
```

## Security & Validation

### Authentication

- All endpoints require JWT bearer token
- User ID extracted from JWT via `@GetUser('id')` decorator
- Admin-only endpoints use `@Roles(UserRole.ADMIN)` guard

### Input Validation

- DTOs use `class-validator` decorators
- Points amounts: `@Min(1)` - prevent negative or zero
- MongoDB ObjectIds: `@IsMongoId()` validation
- Strings: `@IsString()` with optional `@IsOptional()`

### Business Logic Validation

- Duplicate prevention: Check existing account before creation
- Point sufficiency: Verify `availablePoints >= donateDto.amount`
- Duplicate review prevention: Check `reviewedOrderIds` array
- Word count enforcement:
  `reviewText.trim().split(/\s+/).filter(w => w.length > 0).length >= 6`

### Error Handling

- `NotFoundException` - Account not found (404)
- `BadRequestException` - Insufficient points, account exists (400)
- Try-catch blocks with structured logging via Winston
- Non-blocking gamification: Login/order processing succeeds even if
  gamification fails

## Testing Recommendations

### Unit Tests

**LoyaltyService:**

- `createLoyaltyAccount()` - Welcome bonus, duplicate detection, referral
  handling
- `addPoints()` - Tier multiplier application, point history tracking
- `donatePoints()` - Conversion rate, pool integration, insufficient points
- `getCurrentTier()` - Tier thresholds
- `checkAndAwardBadges()` - Milestone detection, duplicate prevention

**GamificationService:**

- `generateReferralCode()` - Uniqueness, format, collision handling
- `recordDailyLogin()` - Streak continuation, monthly cap, idempotency
- `updatePurchaseStreak()` - Period reset, monthly limit
- `awardReviewPoints()` - Word count, duplicate prevention
- `updateFriendBagCount()` - Threshold detection, points award
- `expireStaleReferrals()` - Cron job logic

### Integration Tests

- Create account → Add points → Check tier progression
- Donate points → Verify pool update → Check transaction history
- Friend signup → Purchase 10 bags → Verify referrer points
- Login 10 days → Verify streak points and monthly cap
- Submit review → Verify word count → Check points awarded

### E2E Tests

- Full user journey: Register with referral → Complete orders → Earn badges →
  Donate points
- Concurrent referral completions
- Cron job execution

## Known Issues & Future Enhancements

### Current Limitations

1. **Badge System:** Only 3 of 12 badge types implemented (NEWCOMER,
   FREQUENT_SAVER, ECO_WARRIOR)
2. **Points Redemption:** No redemption system implemented yet (only donation)
3. **Leaderboards:** Schema indexed for leaderboards but no endpoints
4. **Point Expiration:** `expiresAt` field exists but no cron job to expire
   points
5. **Referral Code Sharing:** No built-in sharing mechanism (email, SMS)

### Potential Enhancements

- **Admin Dashboard:** Monitor total points in circulation, redemption rates
- **Point Expiration:** Implement cron to mark points as 'expired' after 1 year
- **Merchant Points:** Separate points pool for businesses
- **Tiered Benefits:** Add discount percentages or priority pickup for higher
  tiers
- **Social Sharing:** Generate referral links with deep links to mobile app
- **Badge Icons:** Implement CDN-backed badge image storage
- **Notification Integration:** Alert users on badge unlocks, referral
  completions
- **Analytics:** Track points velocity, popular earning methods, donation
  patterns

## Monitoring & Observability

### Logs

**Key Log Events:**

- Loyalty account creation: `Loyalty account created for user: ${userId}`
- Points added: `Added ${points} points to user: ${userId}`
- Referral completion:
  `Friend/Business referral completed! Awarded ${points} points...`
- Login streak:
  `Awarded ${points} login streak points to ${userId} (Day ${day})`
- Cron job:
  `Expired referrals: ${friendCount} friend, ${businessCount} business`

**Error Logs:**

- Account creation failures
- Points transaction failures
- Gamification integration errors (non-blocking)

### Metrics to Track

- **Total Points Issued:** Sum of all `lifetimePointsEarned`
- **Total Points Donated:** Sum of all 'donated' transactions
- **Referral Conversion Rate:** `completedReferrals / totalReferrals`
- **Streak Engagement:** % of users with active streaks
- **Badge Distribution:** Count per badge type

### Health Checks

No dedicated health checks. Consider adding:

- Verify LoyaltyAccount collection accessible
- Check for orphaned referrals (referrer/friend user deleted)
- Monitor points:TND conversion rate consistency

## Swagger Documentation

Swagger tags: `@ApiTags('Loyalty')` Auth: `@ApiBearerAuth()` Access:
`http://localhost:3000/api/v1/api-docs#/Loyalty`

All endpoints documented with:

- `@ApiOperation({ summary })` - Endpoint description
- `@ApiResponse()` - Status codes and descriptions
- DTOs automatically generate request/response schemas

## References

**Source Files:**

- `loyalty.controller.ts:27` - Controller with all endpoints
- `loyalty.service.ts:14` - Core loyalty logic
- `gamification.service.ts:47` - Gamification features
- `loyalty-account.schema.ts:211` - Database schema
- `loyalty-account.dto.ts:1` - Request/response DTOs

**Related Modules:**

- `src/donations/` - Points donation integration
- `src/auth/` - Login streak integration point
- `src/orders/` - Order completion, purchase streak integration
- `src/reviews/` - Review points integration

**External Dependencies:**

- Mongoose 8.18 - Schema definition, queries
- @nestjs/schedule - Cron jobs
- class-validator - DTO validation

---

**Last Updated:** 2026-01-15 **Module Version:** NestJS 11 **Maintainer:**
Backend Team
