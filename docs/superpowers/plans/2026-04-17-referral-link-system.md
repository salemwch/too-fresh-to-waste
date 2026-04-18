# Referral Link System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow consumers to share a personal referral link that rewards them
with 50 loyalty points when a referred consumer buys 10 bags (first month) or a
referred business sells 20 bags (first month from first sale), with anti-fraud
protection preventing the same email/phone from triggering rewards more than
once.

**Architecture:** Three layers — (1) Backend anti-fraud collection + wiring
referralCode from registration through to gamification service, (2) Mobile
bottom-sheet sharing UI on the loyalty screen, (3) Hidden web landing page at
`/r/[code]` that routes users to app (consumer) or web signup (business). The
existing backend infrastructure is ~70% built (schema, gamification service
methods, RegisterDto field, cron expiry) — the main gaps are wiring registration
to gamification, anti-fraud, updated constants, and all client-side UI.

**Tech Stack:** NestJS 11 (backend), React Native 0.81 (mobile), Next.js 15
(web), MongoDB/Mongoose, TanStack Query v5

---

## File Map

### Backend — New Files

| File                                                                      | Responsibility                                                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/food-waste-backend/src/loyalty/schemas/referred-identity.schema.ts` | Anti-fraud collection: stores email+phone fingerprints of every referred user, preventing re-registration scams |

### Backend — Modified Files

| File                                                                    | Change                                                                                                                                 |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/food-waste-backend/src/loyalty/services/gamification.service.ts`  | Update constants (50pts, 20 bags for business), add anti-fraud check methods, update business referral expiry to start from first sale |
| `apps/food-waste-backend/src/loyalty/schemas/loyalty-account.schema.ts` | Update `BusinessReferral` schema: add `firstSaleAt` field, update comment on `expiresAt`                                               |
| `apps/food-waste-backend/src/loyalty/listeners/user-events.listener.ts` | Wire `referralCode` from `UserRegisteredEvent` → gamification service (register friend/business referral + record identity)            |
| `apps/food-waste-backend/src/loyalty/loyalty.module.ts`                 | Register `ReferredIdentity` schema in MongooseModule                                                                                   |
| `apps/food-waste-backend/src/common/events/user.events.ts`              | Add `referralCode` field to `UserRegisteredEvent`                                                                                      |
| `apps/food-waste-backend/src/auth/auth.service.ts`                      | Pass `registerDto.referralCode` into `UserRegisteredEvent`                                                                             |
| `apps/food-waste-backend/src/loyalty/loyalty.controller.ts`             | Add `GET /loyalty/referral-link` endpoint returning full URL                                                                           |

### Mobile — New Files

| File                                                                  | Responsibility                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/mobile/src/features/loyalty/components/ReferralBottomSheet.tsx` | Bottom sheet with referral link, copy button, share button, WhatsApp button |

### Mobile — Modified Files

| File                                                             | Change                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/mobile/src/features/loyalty/components/HowYouEarnGrid.tsx` | Make "Refer Friend" card active (+50 pts), tappable → opens bottom sheet |
| `apps/mobile/src/features/loyalty/services/loyaltyService.ts`    | Add `getReferralLink()` API call                                         |
| `apps/mobile/src/features/loyalty/types/loyalty.types.ts`        | Add `ReferralLinkResponse` type                                          |
| `apps/mobile/src/features/loyalty/screens/LoyaltyScreen.tsx`     | Pass bottom-sheet toggle to HowYouEarnGrid                               |

### Web — New Files

| File                                                     | Responsibility                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web/src/app/[locale]/(referral)/r/[code]/page.tsx` | Hidden referral landing page — shows consumer/business signup buttons |
| `apps/web/src/app/[locale]/(referral)/layout.tsx`        | Minimal layout for referral pages (no header/footer)                  |

### Shared — Modified Files

| File                                         | Change                               |
| -------------------------------------------- | ------------------------------------ |
| `packages/shared/src/types/loyalty.types.ts` | Add `ReferralLinkResponse` interface |

---

## Task 1: Anti-Fraud Schema — `ReferredIdentity` Collection

**Files:**

- Create:
  `apps/food-waste-backend/src/loyalty/schemas/referred-identity.schema.ts`

This collection records the email and phone of every user who registers via a
referral code. When someone tries to register with a referral code, we check
this collection first — if the email OR phone already exists, the referral is
silently ignored (user still registers, but referrer gets no credit).

- [ ] **Step 1: Create the ReferredIdentity schema**

```typescript
// apps/food-waste-backend/src/loyalty/schemas/referred-identity.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ReferredIdentity {
  @Prop({ required: true, type: String, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, trim: true })
  phone?: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  referredUserId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  referrerUserId!: Types.ObjectId;

  @Prop({ required: true, enum: ['consumer', 'merchant'] })
  referredAs!: string;
}

export type ReferredIdentityDocument = ReferredIdentity & Document;
export const ReferredIdentitySchema =
  SchemaFactory.createForClass(ReferredIdentity);

ReferredIdentitySchema.index({ email: 1 }, { unique: true });
ReferredIdentitySchema.index({ phone: 1 }, { unique: true, sparse: true });
```

- [ ] **Step 2: Register in LoyaltyModule**

In `apps/food-waste-backend/src/loyalty/loyalty.module.ts`, add to the
`MongooseModule.forFeature` array:

```typescript
import { ReferredIdentity, ReferredIdentitySchema } from './schemas/referred-identity.schema';

// Inside MongooseModule.forFeature array, add:
{ name: ReferredIdentity.name, schema: ReferredIdentitySchema },
```

- [ ] **Step 3: Verify the backend compiles**

Run: `cd C:\WFA && pnpm --filter @foodwaste/backend type-check` Expected: No
errors

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/loyalty/schemas/referred-identity.schema.ts apps/food-waste-backend/src/loyalty/loyalty.module.ts
git commit -m "feat(loyalty): add ReferredIdentity anti-fraud schema

Tracks email+phone of every referred user to prevent re-registration scams."
```

---

## Task 2: Update Gamification Constants & Business Referral Schema

**Files:**

- Modify: `apps/food-waste-backend/src/loyalty/services/gamification.service.ts`
  (lines 17-27)
- Modify:
  `apps/food-waste-backend/src/loyalty/schemas/loyalty-account.schema.ts` (lines
  114-145)

- [ ] **Step 1: Update constants in gamification.service.ts**

Replace the existing constants (lines 17-27) with:

```typescript
export const GAMIFICATION_CONSTANTS = {
  // Friend Referral: Friend buys 10 bags in first month → 50 points
  FRIEND_REFERRAL_BAGS_REQUIRED: 10,
  FRIEND_REFERRAL_POINTS: 50,
  FRIEND_REFERRAL_EXPIRY_DAYS: 30,

  // Business Referral: Business sells 20 bags in first month from first sale → 50 points
  BUSINESS_REFERRAL_ORDERS_REQUIRED: 20,
  BUSINESS_REFERRAL_POINTS: 50,
  BUSINESS_REFERRAL_EXPIRY_DAYS: 30,

  // Login Streak: 10 days consecutive login → 2 points/day (max 20/month)
  LOGIN_STREAK_DAYS_REQUIRED: 10,
  LOGIN_STREAK_POINTS_PER_DAY: 2,
  LOGIN_STREAK_MAX_POINTS_PER_MONTH: 20,

  // Purchase Streak: 15 bags in 15 days → 10 points (monthly)
  PURCHASE_STREAK_BAGS_REQUIRED: 15,
  PURCHASE_STREAK_DAYS: 15,
  PURCHASE_STREAK_POINTS: 10,

  // Review Points: 1 review per order (6+ words) → 10 points
  REVIEW_MIN_WORDS: 6,
  REVIEW_POINTS: 10,
} as const;
```

- [ ] **Step 2: Add `firstSaleAt` to BusinessReferral schema**

In `apps/food-waste-backend/src/loyalty/schemas/loyalty-account.schema.ts`, add
a new field to the `BusinessReferral` class after `businessOrderCount` (line
135):

```typescript
@Prop({ type: Date })
firstSaleAt?: Date; // Set on first sale — expiresAt recalculated from this date
```

Also update the `BusinessReferralStatus` comment (line 115) to:

```typescript
export enum BusinessReferralStatus {
  PENDING = 'pending', // Business signed up, hasn't sold 20 bags in first month from first sale
  COMPLETED = 'completed', // Business sold 20 bags from first sale, points awarded
  EXPIRED = 'expired', // 30 days from first sale passed without 20 bags
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd C:\WFA && pnpm --filter @foodwaste/backend type-check` Expected: No
errors

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/loyalty/services/gamification.service.ts apps/food-waste-backend/src/loyalty/schemas/loyalty-account.schema.ts
git commit -m "feat(loyalty): update referral constants to 50pts and add firstSaleAt tracking

Consumer: 10 bags → 50pts. Business: 20 bags from first sale → 50pts."
```

---

## Task 3: Anti-Fraud Check + Business First-Sale Logic in GamificationService

**Files:**

- Modify: `apps/food-waste-backend/src/loyalty/services/gamification.service.ts`

- [ ] **Step 1: Add ReferredIdentity model injection**

At the top of `gamification.service.ts`, add the import:

```typescript
import {
  ReferredIdentity,
  ReferredIdentityDocument,
} from '../schemas/referred-identity.schema';
```

Add to the constructor (after the existing `@InjectModel`):

```typescript
@InjectModel(ReferredIdentity.name) private readonly referredIdentityModel: Model<ReferredIdentityDocument>,
```

- [ ] **Step 2: Add `checkAndRecordReferredIdentity` method**

Add this new method after the `findReferrerByCode` method (after line 193):

```typescript
/**
 * Anti-fraud: Check if this email or phone was already used in a referral.
 * If not, record it. Returns true if the identity is NEW (referral allowed).
 * Returns false if the identity already exists (referral blocked).
 */
async checkAndRecordReferredIdentity(
  email: string,
  phone: string | undefined,
  referredUserId: string,
  referrerUserId: string,
  referredAs: 'consumer' | 'merchant',
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if this email or phone was already referred
  const existing = await this.referredIdentityModel.findOne({
    $or: [
      { email: normalizedEmail },
      ...(phone ? [{ phone }] : []),
    ],
  });

  if (existing) {
    this.logger.warn(
      `Anti-fraud: Blocked duplicate referral for email=${normalizedEmail} phone=${phone ?? 'none'} ` +
      `(previously referred as userId=${existing.referredUserId})`,
    );
    return false;
  }

  // Record this identity
  try {
    await this.referredIdentityModel.create({
      email: normalizedEmail,
      ...(phone ? { phone } : {}),
      referredUserId: new Types.ObjectId(referredUserId),
      referrerUserId: new Types.ObjectId(referrerUserId),
      referredAs,
    });
    return true;
  } catch (error) {
    // Duplicate key error = race condition, another request already recorded it
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: number }).code
        : undefined;
    if (errorCode === 11000) {
      this.logger.warn(`Anti-fraud: Race condition caught for email=${normalizedEmail}`);
      return false;
    }
    throw error;
  }
}
```

- [ ] **Step 3: Update `updateBusinessOrderCount` for first-sale timing**

Replace the existing `updateBusinessOrderCount` method (lines 358-414) with:

```typescript
/**
 * Update business's order count when they complete an order.
 * First sale triggers the 30-day countdown (expiresAt recalculated from firstSaleAt).
 * Called from OrderEventsListener when pickup is confirmed (for merchant).
 */
async updateBusinessOrderCount(businessUserId: string): Promise<void> {
  const referrers = await this.loyaltyModel.find({
    'businessReferrals.businessUserId': new Types.ObjectId(businessUserId),
    'businessReferrals.status': BusinessReferralStatus.PENDING,
  });

  for (const referrer of referrers) {
    const referralIndex = referrer.businessReferrals.findIndex(
      r =>
        r.businessUserId.toString() === businessUserId &&
        r.status === BusinessReferralStatus.PENDING,
    );

    if (referralIndex === -1) {
      continue;
    }

    const referral = referrer.businessReferrals[referralIndex];
    if (!referral) {
      continue;
    }

    const now = new Date();
    const newOrderCount = referral.businessOrderCount + 1;

    // First sale: set firstSaleAt and recalculate expiresAt from this moment
    const isFirstSale = !referral.firstSaleAt;
    const firstSaleAt = referral.firstSaleAt ?? now;
    const expiresAt = isFirstSale
      ? new Date(now.getTime() + GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      : referral.expiresAt;

    // Check if threshold reached
    if (newOrderCount >= GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_ORDERS_REQUIRED) {
      await this.loyaltyService.addPoints(referrer.userId.toString(), {
        amount: GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS,
        reason: `Business referral completed: Business sold ${newOrderCount} bags`,
        bypassMultiplier: true,
      });

      referral.businessOrderCount = newOrderCount;
      referral.status = BusinessReferralStatus.COMPLETED;
      referral.completedAt = now;
      referral.pointsAwarded = GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS;
      if (isFirstSale) {
        referral.firstSaleAt = firstSaleAt;
        referral.expiresAt = expiresAt;
      }
      referrer.businessReferralsCompleted = (referrer.businessReferralsCompleted || 0) + 1;

      await referrer.save();

      this.logger.log(
        `Business referral completed! Awarded ${GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS} points to ${referrer.userId}`,
      );
    } else {
      // Update order count + first sale tracking
      const updateFields: Record<string, unknown> = {
        'businessReferrals.$.businessOrderCount': newOrderCount,
      };
      if (isFirstSale) {
        updateFields['businessReferrals.$.firstSaleAt'] = firstSaleAt;
        updateFields['businessReferrals.$.expiresAt'] = expiresAt;
      }

      await this.loyaltyModel.updateOne(
        {
          _id: referrer._id,
          'businessReferrals.businessUserId': new Types.ObjectId(businessUserId),
        },
        { $set: updateFields },
      );
    }
  }
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd C:\WFA && pnpm --filter @foodwaste/backend type-check` Expected: No
errors

- [ ] **Step 5: Commit**

```bash
git add apps/food-waste-backend/src/loyalty/services/gamification.service.ts
git commit -m "feat(loyalty): add anti-fraud identity check and first-sale business referral timing

Business 30-day window now starts from first bag sold, not registration."
```

---

## Task 4: Wire Referral Code Through Registration Event

**Files:**

- Modify: `apps/food-waste-backend/src/common/events/user.events.ts`
- Modify: `apps/food-waste-backend/src/auth/auth.service.ts` (line ~169-177)

- [ ] **Step 1: Add `referralCode` to `UserRegisteredEvent`**

In `apps/food-waste-backend/src/common/events/user.events.ts`, add
`referralCode` parameter to the `UserRegisteredEvent` constructor:

```typescript
export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: string,
    public readonly registeredAt: Date,
    public readonly businessInfo?: BusinessInfo | undefined,
    public readonly phoneNumber?: string | undefined,
    public readonly referralCode?: string | undefined,
  ) {}
}
```

- [ ] **Step 2: Pass referralCode when emitting the event in auth.service.ts**

In `apps/food-waste-backend/src/auth/auth.service.ts`, find the
`UserRegisteredEvent` constructor call (around line 172) and add
`registerDto.referralCode` as the last argument:

```typescript
await this.eventBus.emit(
  'user.registered',
  new UserRegisteredEvent(
    user._id.toString(),
    user.email,
    role,
    new Date(),
    registerDto.businessInfo,
    normalizedPhone,
    registerDto.referralCode,
  ),
);
```

- [ ] **Step 3: Verify compilation**

Run: `cd C:\WFA && pnpm --filter @foodwaste/backend type-check` Expected: No
errors

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/common/events/user.events.ts apps/food-waste-backend/src/auth/auth.service.ts
git commit -m "feat(auth): pass referralCode through UserRegisteredEvent

Enables loyalty listener to process referral on registration."
```

---

## Task 5: Process Referral in User Events Listener

**Files:**

- Modify:
  `apps/food-waste-backend/src/loyalty/listeners/user-events.listener.ts`

This is the critical wiring — when a user registers with a referral code, the
listener finds the referrer, runs anti-fraud checks, and registers the referral.

- [ ] **Step 1: Update `processUserRegistration` to handle referral codes**

Replace the entire `processUserRegistration` method (lines 74-99) with:

```typescript
private async processUserRegistration(event: UserRegisteredEvent): Promise<void> {
  try {
    this.logger.log(
      `Processing user.registered event for user: ${event.userId} (role: ${event.role})`,
    );

    // Create loyalty account for consumers only
    if (event.role !== 'merchant' && event.role !== 'admin') {
      await this.gamificationService.createLoyaltyAccountForNewUser(event.userId);
      this.logger.log(`Successfully created loyalty account for user: ${event.userId}`);
    }

    // Process referral code (applies to BOTH consumers and merchants)
    if (event.referralCode) {
      await this.processReferralCode(event);
    }
  } catch (error) {
    this.logger.error(
      `Failed to process user registration for ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}

/**
 * Process referral code from registration:
 * 1. Find referrer by code
 * 2. Anti-fraud check (email + phone must be new)
 * 3. Register as friend or business referral
 */
private async processReferralCode(event: UserRegisteredEvent): Promise<void> {
  const { referralCode, userId, email, phoneNumber, role } = event;
  if (!referralCode) return;

  try {
    // 1. Find the referrer
    const referrerAccount = await this.gamificationService.findReferrerByCode(referralCode);
    if (!referrerAccount) {
      this.logger.warn(`Referral code "${referralCode}" not found — ignoring`);
      return;
    }

    // Prevent self-referral
    if (referrerAccount.userId.toString() === userId) {
      this.logger.warn(`Self-referral blocked for user ${userId}`);
      return;
    }

    // 2. Anti-fraud: check if this email/phone was already used in a referral
    const referredAs = role === 'merchant' ? 'merchant' : 'consumer';
    const isNewIdentity = await this.gamificationService.checkAndRecordReferredIdentity(
      email,
      phoneNumber,
      userId,
      referrerAccount.userId.toString(),
      referredAs,
    );

    if (!isNewIdentity) {
      this.logger.warn(
        `Anti-fraud blocked referral: email=${email} or phone=${phoneNumber} already referred`,
      );
      return;
    }

    // 3. Register the referral
    if (role === 'merchant') {
      await this.gamificationService.registerBusinessReferral(
        referrerAccount.userId.toString(),
        userId,
      );
      this.logger.log(`Business referral registered: ${userId} referred by ${referrerAccount.userId}`);
    } else {
      await this.gamificationService.registerFriendReferral(
        referrerAccount.userId.toString(),
        userId,
      );
      this.logger.log(`Friend referral registered: ${userId} referred by ${referrerAccount.userId}`);
    }
  } catch (error) {
    this.logger.error(
      `Failed to process referral code "${referralCode}" for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd C:\WFA && pnpm --filter @foodwaste/backend type-check` Expected: No
errors

- [ ] **Step 3: Commit**

```bash
git add apps/food-waste-backend/src/loyalty/listeners/user-events.listener.ts
git commit -m "feat(loyalty): wire referral code processing into user registration listener

Anti-fraud checks email+phone, registers friend or business referral."
```

---

## Task 6: Add Referral Link Endpoint

**Files:**

- Modify: `apps/food-waste-backend/src/loyalty/loyalty.controller.ts`

The mobile app needs a full referral URL (not just the code). Add an endpoint
that returns the complete link.

- [ ] **Step 1: Add `GET /loyalty/referral-link` endpoint**

Add this endpoint after the existing `getReferralCode` endpoint (after line 144)
in `loyalty.controller.ts`:

```typescript
@Get('referral-link')
@HttpCode(HttpStatus.OK)
@ApiOperation({
  summary: 'Get full referral link for sharing',
  description: "Returns the user's referral link URL for sharing with friends and businesses",
})
@ApiResponse({ status: 200, description: 'Referral link retrieved successfully' })
async getReferralLink(@GetUser('id') userId: string) {
  const code = await this.gamificationService.getReferralCode(userId);
  const baseUrl = 'https://toofreshtowaste.com';
  const referralLink = `${baseUrl}/r/${code}`;
  return {
    message: 'Referral link retrieved successfully',
    data: { referralCode: code, referralLink },
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd C:\WFA && pnpm --filter @foodwaste/backend type-check` Expected: No
errors

- [ ] **Step 3: Commit**

```bash
git add apps/food-waste-backend/src/loyalty/loyalty.controller.ts
git commit -m "feat(loyalty): add GET /loyalty/referral-link endpoint

Returns full referral URL for mobile sharing."
```

---

## Task 7: Shared Types — Add ReferralLinkResponse

**Files:**

- Modify: `packages/shared/src/types/loyalty.types.ts`

- [ ] **Step 1: Add `ReferralLinkResponse` interface**

Add at the end of `packages/shared/src/types/loyalty.types.ts` (before the tier
helpers section):

```typescript
// ---------------------------------------------------------------------------
// Referral link response (GET /loyalty/referral-link)
// ---------------------------------------------------------------------------

export interface ReferralLinkResponse {
  referralCode: string;
  referralLink: string;
}
```

- [ ] **Step 2: Build shared package**

Run: `cd C:\WFA && pnpm build:deps` Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/loyalty.types.ts
git commit -m "feat(shared): add ReferralLinkResponse type"
```

---

## Task 8: Mobile — Loyalty Service + Types Update

**Files:**

- Modify: `apps/mobile/src/features/loyalty/types/loyalty.types.ts`
- Modify: `apps/mobile/src/features/loyalty/services/loyaltyService.ts`

- [ ] **Step 1: Re-export new type in mobile types**

In `apps/mobile/src/features/loyalty/types/loyalty.types.ts`, add
`ReferralLinkResponse` to the re-export list:

```typescript
export type {
  PointTransactionType,
  TierName,
  Badge,
  PointTransaction,
  LoginStreak,
  PurchaseStreak,
  ReviewTracking,
  LeaderboardConsent,
  LoyaltyAccount,
  GamificationStats,
  LoginStreakResponse,
  ReferralLinkResponse,
} from '@foodwaste/shared';
```

- [ ] **Step 2: Add `getReferralLink` to loyaltyService**

In `apps/mobile/src/features/loyalty/services/loyaltyService.ts`, add the import
for the new type:

```typescript
import type {
  LoyaltyAccount,
  GamificationStats,
  LoginStreakResponse,
  ReferralLinkResponse,
} from '../types/loyalty.types';
```

Add this method to the `loyaltyService` object (after `recordLoginStreak`):

```typescript
/**
 * Get the user's referral link for sharing
 */
async getReferralLink(signal?: AbortSignal): Promise<ReferralLinkResponse> {
  try {
    const response = await apiClient.get<BackendApiResponse<ReferralLinkResponse>>(
      '/loyalty/referral-link',
      { ...(signal !== undefined && { signal }) },
    );
    return unwrapBackendResponse(response, 'referral link');
  } catch (error) {
    throw handleApiError(error);
  }
},
```

- [ ] **Step 3: Verify mobile types**

Run: `cd C:\WFA && pnpm --filter @foodwaste/mobile type-check` Expected: No
errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/loyalty/types/loyalty.types.ts apps/mobile/src/features/loyalty/services/loyaltyService.ts
git commit -m "feat(mobile): add getReferralLink service call and types"
```

---

## Task 9: Mobile — ReferralBottomSheet Component

**Files:**

- Create: `apps/mobile/src/features/loyalty/components/ReferralBottomSheet.tsx`

- [ ] **Step 1: Create the bottom sheet component**

```tsx
// apps/mobile/src/features/loyalty/components/ReferralBottomSheet.tsx

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { Card, Icon, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { spacing } from '@/design-system/tokens/spacing';

import { loyaltyService } from '../services/loyaltyService';

interface ReferralBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const ReferralBottomSheet: React.FC<ReferralBottomSheetProps> = ({
  visible,
  onClose,
}) => {
  const theme = useTheme();
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible && !referralLink) {
      setLoading(true);
      loyaltyService
        .getReferralLink()
        .then(data => setReferralLink(data.referralLink))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible, referralLink]);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copied]);

  const handleCopy = useCallback(() => {
    if (!referralLink) return;
    Clipboard.setString(referralLink);
    setCopied(true);
  }, [referralLink]);

  const handleShare = useCallback(async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        message: `Join Too Fresh To Waste and help reduce food waste! Sign up with my link: ${referralLink}`,
      });
    } catch {}
  }, [referralLink]);

  const handleWhatsApp = useCallback(async () => {
    if (!referralLink) return;
    const message = encodeURIComponent(
      `Join Too Fresh To Waste and help reduce food waste! Sign up with my link: ${referralLink}`,
    );
    const url = `whatsapp://send?text=${message}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  }, [referralLink]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.card }]}
          onPress={() => {}}
        >
          {/* Handle bar */}
          <View
            style={[styles.handle, { backgroundColor: theme.colors.border }]}
          />

          <Text variant='title' size='lg' weight='bold' style={styles.title}>
            Refer & Earn
          </Text>
          <Text
            variant='body'
            size='sm'
            color='secondary'
            style={styles.subtitle}
          >
            Share your link with friends or businesses. Earn 50 points when they
            get started!
          </Text>

          {loading ? (
            <ActivityIndicator
              size='large'
              color={theme.colors.primary}
              style={styles.loader}
            />
          ) : referralLink ? (
            <>
              {/* Link display */}
              <Card variant='outlined' style={styles.linkCard}>
                <Text
                  variant='body'
                  size='sm'
                  weight='medium'
                  numberOfLines={1}
                  style={styles.linkText}
                >
                  {referralLink}
                </Text>
              </Card>

              {/* Action buttons */}
              <View style={styles.actions}>
                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: copied ? '#D1FAE5' : '#F1F5F9' },
                  ]}
                  onPress={handleCopy}
                >
                  <Icon
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    family='Ionicons'
                    size={24}
                    color={copied ? '#10B981' : theme.colors.text}
                  />
                  <Text
                    variant='body'
                    size='xs'
                    weight='medium'
                    style={styles.actionLabel}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => void handleShare()}
                >
                  <Icon
                    name='share-social-outline'
                    family='Ionicons'
                    size={24}
                    color={theme.colors.text}
                  />
                  <Text
                    variant='body'
                    size='xs'
                    weight='medium'
                    style={styles.actionLabel}
                  >
                    Share
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, { backgroundColor: '#D4EDDA' }]}
                  onPress={() => void handleWhatsApp()}
                >
                  <Icon
                    name='logo-whatsapp'
                    family='Ionicons'
                    size={24}
                    color='#25D366'
                  />
                  <Text
                    variant='body'
                    size='xs'
                    weight='medium'
                    style={styles.actionLabel}
                  >
                    WhatsApp
                  </Text>
                </Pressable>
              </View>

              {/* Info */}
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Icon
                    name='person-outline'
                    family='Ionicons'
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant='body'
                    size='xs'
                    color='secondary'
                    style={styles.infoText}
                  >
                    Friend buys 10 bags in first month = +50 pts
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon
                    name='storefront-outline'
                    family='Ionicons'
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant='body'
                    size='xs'
                    color='secondary'
                    style={styles.infoText}
                  >
                    Business sells 20 bags in first month = +50 pts
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text
              variant='body'
              size='sm'
              color='error'
              style={styles.errorText}
            >
              Failed to load referral link. Pull to refresh and try again.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing[4],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[3],
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing[3],
    paddingHorizontal: spacing[2],
  },
  loader: {
    marginVertical: spacing[5],
  },
  linkCard: {
    padding: spacing[2],
    marginBottom: spacing[3],
  },
  linkText: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 16,
    minWidth: 80,
  },
  actionLabel: {
    marginTop: spacing[1],
  },
  infoSection: {
    gap: spacing[1],
    paddingHorizontal: spacing[1],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  infoText: {
    flex: 1,
  },
  errorText: {
    textAlign: 'center',
    marginVertical: spacing[4],
  },
});
```

- [ ] **Step 2: Verify mobile types**

Run: `cd C:\WFA && pnpm --filter @foodwaste/mobile type-check` Expected: No
errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/loyalty/components/ReferralBottomSheet.tsx
git commit -m "feat(mobile): add ReferralBottomSheet component

Copy link, Share, WhatsApp buttons with loading and error states."
```

---

## Task 10: Mobile — Wire HowYouEarnGrid + LoyaltyScreen

**Files:**

- Modify: `apps/mobile/src/features/loyalty/components/HowYouEarnGrid.tsx`
- Modify: `apps/mobile/src/features/loyalty/screens/LoyaltyScreen.tsx`

- [ ] **Step 1: Update HowYouEarnGrid to support onReferPress callback**

Replace the entire content of
`apps/mobile/src/features/loyalty/components/HowYouEarnGrid.tsx`:

```tsx
import React, { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { Card, Icon, Text } from '@/design-system/components/atoms';

interface EarnMethod {
  icon: string;
  label: string;
  points: string;
  color: string;
  bgColor: string;
  active: boolean;
  key: string;
}

const EARN_METHODS: EarnMethod[] = [
  {
    key: 'save-bag',
    icon: 'bag-handle-outline',
    label: 'Save a Bag',
    points: '+10 pts',
    color: '#10B981',
    bgColor: '#D1FAE5',
    active: true,
  },
  {
    key: 'review',
    icon: 'chatbubble-ellipses-outline',
    label: 'Write Review',
    points: '+10 pts',
    color: '#6366F1',
    bgColor: '#E0E7FF',
    active: false,
  },
  {
    key: 'login',
    icon: 'flame-outline',
    label: 'Daily Login',
    points: '+2 pts',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    active: true,
  },
  {
    key: 'refer',
    icon: 'people-outline',
    label: 'Refer Friend',
    points: '+50 pts',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    active: true,
  },
];

const INACTIVE_BACKGROUND = '#F1F5F9';
const INACTIVE_TEXT = '#94A3B8';

interface HowYouEarnGridProps {
  onReferPress?: () => void;
}

const EarnCard: React.FC<{ method: EarnMethod; onPress?: () => void }> = ({
  method,
  onPress,
}) => {
  const iconCircleStyle = {
    backgroundColor: method.active ? method.bgColor : INACTIVE_BACKGROUND,
  };
  const pointsStyle = {
    color: method.active ? method.color : INACTIVE_TEXT,
  };

  const content = (
    <Card
      variant='elevated'
      style={[styles.earnCard, !method.active && styles.earnCardInactive]}
    >
      <View style={[styles.iconCircle, iconCircleStyle]}>
        <Icon
          name={method.icon}
          family='Ionicons'
          size={24}
          color={method.active ? method.color : INACTIVE_TEXT}
        />
      </View>
      <Text
        variant='body'
        size='sm'
        weight='semibold'
        style={[styles.earnLabel, !method.active && styles.inactiveText]}
      >
        {method.label}
      </Text>
      <Text variant='body' size='xs' weight='bold' style={pointsStyle}>
        {method.active ? method.points : 'Coming Soon'}
      </Text>
    </Card>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
};

const HowYouEarnGridComponent: React.FC<HowYouEarnGridProps> = ({
  onReferPress,
}) => (
  <View style={styles.container}>
    <Text
      variant='title'
      size='md'
      weight='semibold'
      style={styles.sectionTitle}
    >
      How You Earn
    </Text>
    <View style={styles.grid}>
      {EARN_METHODS.map(method => (
        <EarnCard
          key={method.key}
          method={method}
          {...(method.key === 'refer' && onReferPress
            ? { onPress: onReferPress }
            : {})}
        />
      ))}
    </View>
  </View>
);

export const HowYouEarnGrid = memo(HowYouEarnGridComponent);
HowYouEarnGridComponent.displayName = 'HowYouEarnGrid';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  earnCard: {
    width: '47%',
    padding: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  earnCardInactive: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  earnLabel: {
    marginBottom: 4,
    textAlign: 'center',
  },
  inactiveText: {
    color: INACTIVE_TEXT,
  },
});
```

- [ ] **Step 2: Update LoyaltyScreen to show ReferralBottomSheet**

In `apps/mobile/src/features/loyalty/screens/LoyaltyScreen.tsx`, add imports:

```typescript
import { useState, useCallback } from 'react';
import { ReferralBottomSheet } from '../components/ReferralBottomSheet';
```

(Remove the existing `useCallback` import from `react` since we're now importing
`useState` too.)

Inside the component, add state (after the `useLoginStreak()` call):

```typescript
const [referralSheetVisible, setReferralSheetVisible] = useState(false);

const handleReferPress = useCallback(() => {
  setReferralSheetVisible(true);
}, []);
```

Replace `<HowYouEarnGrid />` with:

```tsx
<HowYouEarnGrid onReferPress={handleReferPress} />
```

Add the bottom sheet before the closing `</View>` of the container:

```tsx
<ReferralBottomSheet
  visible={referralSheetVisible}
  onClose={() => setReferralSheetVisible(false)}
/>
```

- [ ] **Step 3: Verify mobile types**

Run: `cd C:\WFA && pnpm --filter @foodwaste/mobile type-check` Expected: No
errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/loyalty/components/HowYouEarnGrid.tsx apps/mobile/src/features/loyalty/screens/LoyaltyScreen.tsx
git commit -m "feat(mobile): activate Refer Friend card and wire to bottom sheet

Tapping Refer Friend in loyalty screen opens sharing bottom sheet."
```

---

## Task 11: Web — Hidden Referral Landing Page

**Files:**

- Create: `apps/web/src/app/[locale]/(referral)/layout.tsx`
- Create: `apps/web/src/app/[locale]/(referral)/r/[code]/page.tsx`

This page is not linked from any navigation — it's only accessible via the
referral link. It shows a branded page with two signup paths.

- [ ] **Step 1: Create the referral route group layout**

```tsx
// apps/web/src/app/[locale]/(referral)/layout.tsx

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function ReferralLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className='min-h-screen bg-gradient-to-b from-primary/5 to-background'>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 2: Create the referral landing page**

```tsx
// apps/web/src/app/[locale]/(referral)/r/[code]/page.tsx

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Join Too Fresh To Waste',
  description: 'Help reduce food waste and earn rewards. Sign up today!',
  robots: { index: false, follow: false },
};

interface ReferralPageProps {
  params: Promise<{ code: string; locale: string }>;
}

export default async function ReferralPage({ params }: ReferralPageProps) {
  const { code, locale } = await params;

  const consumerAppLink = `toofreshtowaste://register?referralCode=${code}`;
  const businessSignupLink = `/${locale}/business-signup?ref=${code}`;

  return (
    <main className='flex min-h-screen flex-col items-center justify-center px-4 py-12'>
      <div className='w-full max-w-md space-y-8 text-center'>
        {/* Logo / Brand */}
        <div className='space-y-2'>
          <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary'>
            <span className='text-2xl font-bold text-white'>TF</span>
          </div>
          <h1 className='font-heading text-3xl font-bold tracking-tight text-foreground'>
            Too Fresh To Waste
          </h1>
          <p className='text-muted-foreground'>
            You&apos;ve been invited to join the food waste reduction movement!
          </p>
        </div>

        {/* Referral code badge */}
        <div className='rounded-xl border border-primary/20 bg-primary/5 px-4 py-3'>
          <p className='text-xs font-medium text-muted-foreground'>
            Your referral code
          </p>
          <p className='font-mono text-lg font-bold text-primary'>{code}</p>
        </div>

        {/* Two paths */}
        <div className='space-y-4'>
          <p className='text-sm font-medium text-muted-foreground'>
            How do you want to join?
          </p>

          {/* Consumer path — opens mobile app */}
          <a
            href={consumerAppLink}
            className='flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-white shadow-md transition-shadow hover:shadow-lg'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-6 w-6'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
              />
            </svg>
            <div className='text-start'>
              <p className='font-semibold'>Sign up as Consumer</p>
              <p className='text-xs text-white/80'>Open in the mobile app</p>
            </div>
          </a>

          {/* Business path — web signup */}
          <Link
            href={businessSignupLink}
            className='flex w-full items-center justify-center gap-3 rounded-xl border-2 border-primary bg-white px-6 py-4 text-primary shadow-sm transition-shadow hover:shadow-md'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-6 w-6'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
              />
            </svg>
            <div className='text-start'>
              <p className='font-semibold'>Sign up as Business</p>
              <p className='text-xs text-primary/70'>Continue on web</p>
            </div>
          </Link>
        </div>

        {/* Footer info */}
        <div className='space-y-1 pt-4 text-xs text-muted-foreground'>
          <p>Save food. Save money. Earn rewards.</p>
        </div>
      </div>
    </main>
  );
}
```

> **Note:** This page uses `robots: { index: false, follow: false }` to stay
> hidden from search engines. The `toofreshtowaste://register` deep link scheme
> must match your mobile app's registered URL scheme. The consumer app link
> format and actual business-signup route may need adjustment when the web pages
> are designed later — this is a functional scaffold.

- [ ] **Step 3: Verify web types**

Run: `cd C:\WFA && pnpm --filter @foodwaste/web type-check` Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(referral\)/layout.tsx apps/web/src/app/\[locale\]/\(referral\)/r/\[code\]/page.tsx
git commit -m "feat(web): add hidden referral landing page at /r/[code]

noindex page with consumer (app deep link) and business (web signup) paths."
```

---

## Task 12: Update Gamification Stats Response to Include Referral Points

**Files:**

- Modify: `apps/food-waste-backend/src/loyalty/services/gamification.service.ts`
  (inside `getGamificationStats`)

The mobile needs to know the updated points values (50 instead of old values)
from the stats response. The existing response already includes `bagsRequired`
and `ordersRequired` — we just need to also include the points amounts.

- [ ] **Step 1: Add points info to gamification stats**

In `gamification.service.ts`, update the `getGamificationStats` return (around
line 725-788). Add `pointsReward` to both referral sections:

In the `friendReferrals` object, add after `completed`:

```typescript
pointsReward: GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_POINTS,
```

In the `businessReferrals` object, add after `completed`:

```typescript
pointsReward: GAMIFICATION_CONSTANTS.BUSINESS_REFERRAL_POINTS,
```

- [ ] **Step 2: Update shared types to include pointsReward**

In `packages/shared/src/types/loyalty.types.ts`, update the `GamificationStats`
interface — add `pointsReward: number;` to both `friendReferrals` and
`businessReferrals`:

```typescript
export interface GamificationStats {
  referralCode?: string;
  friendReferrals: {
    pending: number;
    completed: number;
    pointsReward: number;
    pendingDetails: Array<{
      friendBagCount: number;
      bagsRequired: number;
      expiresAt: string;
    }>;
  };
  businessReferrals: {
    pending: number;
    completed: number;
    pointsReward: number;
    pendingDetails: Array<{
      businessOrderCount: number;
      ordersRequired: number;
      expiresAt: string;
    }>;
  };
  // ... rest unchanged
}
```

- [ ] **Step 3: Build shared + verify**

Run:
`cd C:\WFA && pnpm build:deps && pnpm --filter @foodwaste/backend type-check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/loyalty/services/gamification.service.ts packages/shared/src/types/loyalty.types.ts
git commit -m "feat(loyalty): include pointsReward in gamification stats response

Lets clients display the correct reward amounts dynamically."
```

---

## Task 13: Final Verification — Full Type Check & Lint

**Files:** None (verification only)

- [ ] **Step 1: Full monorepo type check**

Run: `cd C:\WFA && pnpm build:deps && pnpm type-check` Expected: No errors
across all workspaces

- [ ] **Step 2: Lint**

Run: `cd C:\WFA && pnpm lint` Expected: No new lint errors

- [ ] **Step 3: Backend tests**

Run: `cd C:\WFA && pnpm --filter @foodwaste/backend test:unit` Expected: All
existing tests pass (new code doesn't break existing functionality)

- [ ] **Step 4: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: lint fixes for referral link feature"
```

---

## Summary: What Each Layer Does

| Layer              | What happens                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Registration**   | User signs up with `referralCode` → auth.service passes it in `UserRegisteredEvent`                                                                                             |
| **Event Listener** | `user-events.listener` catches the event → checks anti-fraud (`ReferredIdentity` collection: email+phone) → registers friend or business referral on referrer's loyalty account |
| **Order Pickup**   | `order-events.listener` already calls `updateFriendBagCount()` (consumer) and `updateBusinessOrderCount()` (merchant) → thresholds trigger 50-point reward                      |
| **Business Timer** | `updateBusinessOrderCount` now sets `firstSaleAt` on first sale → recalculates `expiresAt` from that moment (not registration)                                                  |
| **Anti-Fraud**     | `ReferredIdentity` collection stores email+phone of every referred user → same email OR phone = referral silently blocked                                                       |
| **Mobile UI**      | "Refer Friend" card in loyalty screen → taps to ReferralBottomSheet → Copy/Share/WhatsApp                                                                                       |
| **Web Landing**    | `/r/[CODE]` hidden page → consumer button deep-links to app, business button goes to web signup                                                                                 |
