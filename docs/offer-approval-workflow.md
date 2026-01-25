# Offer Approval Workflow (Optional Enhancement)

## Current: Self-Service Model ✅
- Merchant creates → draft
- Merchant activates → active (live immediately)
- Admin can suspend if needed

---

## Alternative: Pre-Approval Model (Implementation Guide)

### Changes Required

#### 1. Add New Status
```typescript
// offer.schema.ts
export enum OfferStatus {
    DRAFT = 'draft',
    PENDING_APPROVAL = 'pending_approval',  // ← New
    ACTIVE = 'active',
    REJECTED = 'rejected',                   // ← New
    SOLD_OUT = 'sold_out',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
    SUSPENDED = 'suspended',
}
```

#### 2. Update Merchant Flow
```typescript
// offers.controller.ts - Merchant submits for approval
@Patch(':id/submit-for-approval')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
async submitForApproval(@Param('id') id: string, @Request() req) {
    const offer = await this.offersService.findById(id);

    // Validate offer completeness
    if (!offer.images || offer.images.length === 0) {
        throw new BadRequestException('Please add at least one image');
    }

    // Change status to pending
    await this.offersService.updateStatus(id, OfferStatus.PENDING_APPROVAL);

    // Notify admin (email, dashboard notification)
    await this.notificationsService.notifyAdminOfPendingOffer(offer);

    return { message: 'Offer submitted for approval' };
}
```

#### 3. Admin Approval Endpoints
```typescript
// offers.controller.ts - Admin approves/rejects
@Patch(':id/approve')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async approveOffer(
    @Param('id') id: string,
    @Body('feedbackNote') feedbackNote?: string
) {
    const offer = await this.offersService.updateStatus(id, OfferStatus.ACTIVE);

    // Notify merchant
    await this.notificationsService.notifyMerchantOfApproval(offer, feedbackNote);

    return { message: 'Offer approved and published' };
}

@Patch(':id/reject')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async rejectOffer(
    @Param('id') id: string,
    @Body('reason') reason: string
) {
    const offer = await this.offersService.updateStatus(id, OfferStatus.REJECTED);

    // Store rejection reason
    await this.offersService.addRejectionNote(id, reason);

    // Notify merchant with reason
    await this.notificationsService.notifyMerchantOfRejection(offer, reason);

    return { message: 'Offer rejected', reason };
}
```

#### 4. Update Queries
```typescript
// offers.service.ts - Only show approved offers publicly
async findAll(filters: SearchOffersDto): Promise<FindAllResult> {
    const query: MongoQuery = {};

    // Public users only see ACTIVE offers
    if (!filters.merchantId && !filters.status) {
        query.status = OfferStatus.ACTIVE;  // Already filtered correctly
        query.isActive = true;
    }

    // Admin can see pending offers
    if (filters.status === OfferStatus.PENDING_APPROVAL) {
        // Only accessible by admin
    }

    // ...rest of query
}
```

#### 5. Merchant Dashboard Views
```typescript
// New endpoint: Get merchant's pending offers
@Get('my-offers/pending')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
async getMyPendingOffers(@Request() req) {
    return this.offersService.findAll(1, 20, {
        merchantId: req.user.userId,
        status: OfferStatus.PENDING_APPROVAL
    });
}

// New endpoint: Get merchant's rejected offers
@Get('my-offers/rejected')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
async getMyRejectedOffers(@Request() req) {
    return this.offersService.findAll(1, 20, {
        merchantId: req.user.userId,
        status: OfferStatus.REJECTED
    });
}
```

#### 6. Admin Dashboard
```typescript
// New endpoint: Get all pending approvals
@Get('admin/pending-offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async getPendingOffers(@Query('page') page: number = 1) {
    return this.offersService.findAll(page, 20, {
        status: OfferStatus.PENDING_APPROVAL
    });
}
```

---

## Flow Comparison

### Current (Self-Service)
```
Merchant creates → draft
         ↓
Merchant clicks "Publish"
         ↓
Status: active ✅ (live immediately)
         ↓
Customers see offer
```

### With Pre-Approval
```
Merchant creates → draft
         ↓
Merchant clicks "Submit for Approval"
         ↓
Status: pending_approval ⏳
         ↓
Admin reviews (within 24h SLA)
         ↓
    ↙         ↘
Approve      Reject
   ↓            ↓
active ✅    rejected ❌
   ↓            ↓
Customers    Merchant fixes
see offer    and resubmits
```

---

## Hybrid Approach (Best of Both Worlds)

**Auto-approve trusted merchants:**

```typescript
// users/schemas/user.schema.ts
export class User {
    // ...existing fields

    @Prop({ default: false })
    isTrustedMerchant: boolean;  // ← New field

    @Prop({ default: 0 })
    offersApprovedCount: number;  // Track history
}

// offers.service.ts
async create(createOfferDto: CreateOfferDto, merchantId: string) {
    const merchant = await this.usersService.findById(merchantId);

    const offer = new this.offerModel({
        ...createOfferDto,
        // Auto-approve for trusted merchants
        status: merchant.isTrustedMerchant
            ? OfferStatus.ACTIVE
            : OfferStatus.PENDING_APPROVAL
    });

    return offer.save();
}
```

**Trust criteria:**
- ✅ 10+ approved offers
- ✅ No violations in last 90 days
- ✅ Average rating > 4.0
- ✅ Manually verified by admin

---

## Recommendation

**For your MVP:** Keep current self-service model ✅

**Phase 2 (after launch):**
1. Add reporting system (customers flag bad offers)
2. Track merchant reputation score
3. Implement hybrid auto-approve for trusted merchants
4. Add manual review only for new/flagged merchants

This balances speed (for merchants) with quality (for customers).
