# UserService Event Integration - Implementation Guide

## Required Changes to user.service.ts

### 1. Add Imports

Add to imports at the top of the file (around line 1-60):

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
    UserRegisteredEvent,
    UserEmailVerifiedEvent,
    UserPhoneVerifiedEvent,
    UserPasswordChangedEvent,
    UserAccountLockedEvent,
    UserAccountUnlockedEvent,
    UserStatusChangedEvent,
    UserProfileUpdatedEvent,
    UserAccountRestoredEvent,
} from './events';
```

### 2. Inject EventEmitter2 in Constructor

Update constructor (around line 83-89):

```typescript
constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly passwordValidationService: PasswordValidationService,
    private readonly phoneNumberService: PhoneNumberService,
    private readonly smsNotificationService: SmsNotificationService,
    private readonly passwordHistoryService: PasswordHistoryService,
    private readonly eventEmitter: EventEmitter2, // ADD THIS LINE
) { }
```

### 3. Emit Events in Methods

#### Method: `create()` (line ~91-273)

Add AFTER line 248 (after user is saved successfully):

```typescript
const savedUser = await user.save();
this.logger.log(`User created successfully: ${savedUser.email}...`);

// ✅ ADD THIS: Emit user registration event
this.eventEmitter.emit(
    'user.registered',
    new UserRegisteredEvent(
        savedUser._id.toString(),
        savedUser.email,
        savedUser.firstName,
        savedUser.lastName,
        savedUser.role,
        normalizedPhone,
        savedUser.createdAt || new Date()
    )
);

return savedUser;
```

#### Method: `verifyEmail()` (line ~372-378)

Replace entire method with:

```typescript
async verifyEmail(userId: string): Promise<void> {
    const user = await this.userModel.findByIdAndUpdate(userId, {
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
        emailVerificationToken: undefined,
    });

    if (!user) {
        throw new NotFoundException('User not found');
    }

    // ✅ ADD THIS: Emit email verification event
    this.eventEmitter.emit(
        'user.email.verified',
        new UserEmailVerifiedEvent(
            userId,
            user.email,
            new Date()
        )
    );
}
```

#### Method: `verifyPhoneCode()` (line ~524-664)

Add AFTER line 646 (before the return statement in successful verification):

```typescript
this.logger.log(`Phone number verified successfully for user ${userId}: ${this.maskPhoneNumber(normalizedPhone)}`);

// ✅ ADD THIS: Emit phone verification event
this.eventEmitter.emit(
    'user.phone.verified',
    new UserPhoneVerifiedEvent(
        userId,
        normalizedPhone,
        new Date()
    )
);

return {
    success: true,
    message: 'Phone number verified successfully'
};
```

#### Method: `updatePassword()` (line ~709-772)

Add AFTER line 766 (after password update):

```typescript
await this.userModel.findByIdAndUpdate(userId, updateObj);

this.logger.log(`Password updated for user ${userId}`, { ... });

// ✅ ADD THIS: Emit password change event
this.eventEmitter.emit(
    'user.password.changed',
    new UserPasswordChangedEvent(
        userId,
        user.email,
        new Date(),
        auditData?.ipAddress,
        auditData?.userAgent
    )
);
```

#### Method: `updateStatus()` (line ~869-880)

Replace entire method with:

```typescript
async updateStatus(id: string, status: UserStatus): Promise<User> {
    const currentUser = await this.userModel.findById(id);
    if (!currentUser) {
        throw new NotFoundException('User not found');
    }

    const oldStatus = currentUser.status;

    const user = await this.userModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken')
        .exec();

    if (!user) {
        throw new NotFoundException('User not found');
    }

    // ✅ ADD THIS: Emit status change event
    this.eventEmitter.emit(
        'user.status.changed',
        new UserStatusChangedEvent(
            id,
            user.email,
            oldStatus,
            status,
            undefined, // reason
            new Date()
        )
    );

    return user;
}
```

#### Method: `recordFailedLogin()` (line ~1054-1108)

Add AFTER line 1102 (in the isLocked block, after updateData is set):

```typescript
if (isLocked) {
    const lockoutDuration = this.calculateLockoutDuration(failedAttempts);
    updateData.accountLockedUntil = new Date(Date.now() + lockoutDuration);
    updateData.status = UserStatus.SUSPENDED;

    this.logger.warn(`Account locked due to failed login attempts: ${userId}`, { ... });

    // ✅ ADD THIS: Emit account locked event
    this.eventEmitter.emit(
        'user.account.locked',
        new UserAccountLockedEvent(
            userId,
            user.email,
            updateData.accountLockedUntil,
            'Too many failed login attempts',
            failedAttempts,
            new Date(),
            ipAddress
        )
    );
}
```

#### Method: `unlockAccount()` (line ~1154-1175)

Add AFTER line 1172 (after update):

```typescript
await this.userModel.findByIdAndUpdate(userId, { ... });

this.logger.log(`Account unlocked by admin ${adminUserId}: ${userId}`);

// ✅ ADD THIS: Emit account unlocked event
const user = await this.userModel.findById(userId);
if (user) {
    this.eventEmitter.emit(
        'user.account.unlocked',
        new UserAccountUnlockedEvent(
            userId,
            user.email,
            adminUserId,
            new Date(),
            auditData.ipAddress
        )
    );
}
```

#### Method: `update()` (line ~774-785)

Replace entire method with:

```typescript
async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Track which significant fields are being updated
    const significantFields: string[] = [];
    if (updateUserDto.email) significantFields.push('email');
    if (updateUserDto.firstName || updateUserDto.lastName) significantFields.push('name');
    if (updateUserDto.role) significantFields.push('role');

    const user = await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true })
        .select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken')
        .exec();

    if (!user) {
        throw new NotFoundException('User not found');
    }

    // ✅ ADD THIS: Emit profile update event ONLY for significant changes
    if (significantFields.length > 0) {
        this.eventEmitter.emit(
            'user.profile.updated',
            new UserProfileUpdatedEvent(
                id,
                user.email,
                significantFields,
                new Date()
            )
        );
    }

    return user;
}
```

#### Method: `restore()` (line ~1007-1037)

Add AFTER line 1033 (before return):

```typescript
const restoredUser = await this.userModel.findByIdAndUpdate(id, { ... }, { new: true })...;

this.logger.log(`User restored: ${id}`);

// ✅ ADD THIS: Emit account restored event
if (restoredUser) {
    this.eventEmitter.emit(
        'user.account.restored',
        new UserAccountRestoredEvent(
            id,
            restoredUser.email,
            auditData.ipAddress, // Using ipAddress as proxy for admin user (consider adding adminUserId param)
            new Date()
        )
    );
}

return restoredUser!;
```

---

## Required Changes to services/mfa.service.ts

### 1. Add Imports

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserMfaEnabledEvent, UserMfaDisabledEvent } from '../events';
```

### 2. Inject EventEmitter2

Update constructor:

```typescript
constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly eventEmitter: EventEmitter2, // ADD THIS
) {}
```

### 3. Emit Events

#### Method: `verifyTotpSetup()` (line ~88-122)

Add AFTER line 115 (after activation):

```typescript
if (verified) {
    totpMethod.isActive = true;
    totpMethod.verified = true;
    user.mfaSettings.isEnabled = true;

    await user.save();

    this.logger.log(`TOTP setup completed for user: ${user.email}`);

    // ✅ ADD THIS: Emit MFA enabled event
    this.eventEmitter.emit(
        'user.mfa.enabled',
        new UserMfaEnabledEvent(
            user._id.toString(),
            user.email,
            'totp',
            new Date()
        )
    );

    return true;
}
```

#### Method: `disableMfa()` (line ~224-237)

Add BEFORE final log statement:

```typescript
if (user.mfaSettings) {
    user.mfaSettings.isEnabled = false;
    user.mfaSettings.methods = [];
    await user.save();

    // ✅ ADD THIS: Emit MFA disabled event
    this.eventEmitter.emit(
        'user.mfa.disabled',
        new UserMfaDisabledEvent(
            user._id.toString(),
            user.email,
            new Date()
        )
    );
}

this.logger.log(`MFA disabled for user: ${user.email}`);
```

---

## Required Changes to services/privacy-compliance.service.ts

### 1. Add Imports

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
    UserPrivacyConsentUpdatedEvent,
    UserDataDeletionRequestedEvent,
    UserDataDeletionCompletedEvent,
} from '../events';
```

### 2. Inject EventEmitter2

Update constructor:

```typescript
constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    private readonly eventEmitter: EventEmitter2, // ADD THIS
) { }
```

### 3. Emit Events

#### Method: `recordTunisianConsent()` (line ~182-228)

Add AFTER line 225 (after update):

```typescript
await this.userModel.findByIdAndUpdate(userId, { ... });

this.logger.log(`✅ Tunisian consent recorded successfully for user ${userId}`);

// ✅ ADD THIS: Emit privacy consent event
this.eventEmitter.emit(
    'user.privacy_consent.updated',
    new UserPrivacyConsentUpdatedEvent(
        userId,
        (await this.userModel.findById(userId))!.email,
        'tunisia',
        {
            dataProcessingConsent: consentData.dataProcessingConsent,
            locationTrackingConsent: consentData.locationTrackingConsent,
            communicationConsent: consentData.communicationConsent,
        },
        new Date(),
        ipAddress
    )
);
```

#### Method: `recordInternationalConsent()` (line ~273-324)

Add AFTER line 321 (after update):

```typescript
await this.userModel.findByIdAndUpdate(userId, { ... });

this.logger.log(`✅ International consent recorded successfully for user ${userId}`);

// ✅ ADD THIS: Emit privacy consent event
this.eventEmitter.emit(
    'user.privacy_consent.updated',
    new UserPrivacyConsentUpdatedEvent(
        userId,
        (await this.userModel.findById(userId))!.email,
        'international',
        {
            marketingOptIn: consentData.marketingOptIn,
            analyticsOptIn: consentData.analyticsOptIn,
        },
        new Date(),
        ipAddress
    )
);
```

#### Method: `processDataDeletion()` (line ~466-495)

Add at the BEGINNING of the method (after user is found):

```typescript
const user = await this.userModel.findById(userId);
if (!user) { throw new NotFoundException('User not found') };

// ✅ ADD THIS: Emit deletion requested event
this.eventEmitter.emit(
    'user.data_deletion.requested',
    new UserDataDeletionRequestedEvent(
        userId,
        user.email,
        deletionRequest.deletionType,
        deletionRequest.reason,
        new Date()
    )
);

let result: IAnonymizationResult;
```

And add at the END of the method (before return):

```typescript
this.logger.log(`✅ Data deletion completed for user ${userId}`);

// ✅ ADD THIS: Emit deletion completed event
this.eventEmitter.emit(
    'user.data_deletion.completed',
    new UserDataDeletionCompletedEvent(
        userId,
        result.deletionType,
        new Date(),
        result.dataRetained,
        result.dataAnonymized,
        result.dataDeleted
    )
);

return result;
```

But wait - the IAnonymizationResult doesn't have deletionType. We need to add it to the result. Modify the return statement in each deletion method:

In `softDeleteUser()`:
```typescript
return {
    userId,
    deletionType: 'soft_delete', // ADD THIS
    anonymizedAt: new Date(),
    ...
};
```

In `anonymizeUser()`:
```typescript
return {
    userId,
    deletionType: 'anonymization', // ADD THIS
    anonymizedAt: new Date(),
    ...
};
```

In `completeDeleteUser()`:
```typescript
return {
    userId,
    deletionType: 'complete_deletion', // ADD THIS
    anonymizedAt: new Date(),
    ...
};
```

---

## Update users/user.module.ts

Add event listeners to providers:

```typescript
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter'; // ADD THIS

import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './user.controller';
import { PrivacyController } from './controllers/privacy.controller';
import { UsersService } from './user.service';
import { USERS_SERVICE_TOKEN } from './interfaces';
import { PrivacyComplianceService } from './services/privacy-compliance.service';
import { MfaService } from './services/mfa.service';
import { PasswordValidationService } from './services/password-validation.service';
import { PasswordHistoryService } from '../auth/services/password-history.service';
import { UserPreferencesService } from './services/user-preferences.service';

// ✅ ADD THESE IMPORTS
import {
    UserLifecycleEventsListener,
    UserSecurityEventsListener,
    UserPrivacyEventsListener,
} from './listeners';

import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Favorite, FavoriteSchema } from '../favorites/schemas/favorite.schema';
import { Review, ReviewSchema } from '../reviwes/schemas/reviwe.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { ReviewsModule } from 'src/reviwes/reviwes.module';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Order.name, schema: OrderSchema },
            { name: Favorite.name, schema: FavoriteSchema },
            { name: Review.name, schema: ReviewSchema },
            { name: Notification.name, schema: NotificationSchema },
        ]),
        forwardRef(() => ReviewsModule),
        CommonModule,
        forwardRef(() => AuthModule),
        EventEmitterModule, // ✅ ADD THIS
    ],
    controllers: [
        UsersController,
        PrivacyController
    ],
    providers: [
        {
            provide: USERS_SERVICE_TOKEN,
            useClass: UsersService,
        },
        UsersService,
        PrivacyComplianceService,
        MfaService,
        PasswordValidationService,
        PasswordHistoryService,
        UserPreferencesService,
        // ✅ ADD THESE LISTENERS
        UserLifecycleEventsListener,
        UserSecurityEventsListener,
        UserPrivacyEventsListener,
    ],
    exports: [
        MongooseModule,
        USERS_SERVICE_TOKEN,
        UsersService,
        PrivacyComplianceService,
        MfaService,
        PasswordValidationService,
        UserPreferencesService
    ],
})
export class UsersModule { }
```

---

## Update common/events/index.ts

Add user events to barrel export:

```typescript
export * from './user.events';
export * from './order.events';
export * from './favorite.events';
export * from './admin-user.events';
export * from './admin-establishment.events';
export * from './admin-system.events';

// ✅ RE-EXPORT USER EVENTS FROM USERS MODULE
export * from '../../users/events';
```

---

## Testing After Implementation

### 1. Unit Test Example

Create `user.service.events.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UsersService } from './user.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';

describe('UsersService Events', () => {
    let service: UsersService;
    let eventEmitter: EventEmitter2;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: EventEmitter2,
                    useValue: {
                        emit: jest.fn(),
                    },
                },
                {
                    provide: getModelToken(User.name),
                    useValue: mockUserModel,
                },
                // ... other mocked dependencies
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    });

    describe('create', () => {
        it('should emit user.registered event on successful creation', async () => {
            const createUserDto = {
                email: 'test@example.com',
                password: 'password123',
                firstName: 'John',
                lastName: 'Doe',
            };

            await service.create(createUserDto);

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'user.registered',
                expect.objectContaining({
                    email: 'test@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                })
            );
        });
    });
});
```

### 2. Integration Test Example

```typescript
describe('User Registration Flow (Integration)', () => {
    it('should trigger loyalty account creation when user registers', async () => {
        // Create user
        const user = await userService.create({
            email: 'test@example.com',
            password: 'password123',
            firstName: 'John',
            lastName: 'Doe',
        });

        // Wait for event to be processed
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check loyalty account was created
        const loyaltyAccount = await loyaltyService.findByUserId(user._id);
        expect(loyaltyAccount).toBeDefined();
        expect(loyaltyAccount.userId).toBe(user._id.toString());
    });
});
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All events defined in events/user.events.ts
- [ ] All listeners implemented in listeners/
- [ ] EventEmitter2 injected in all services
- [ ] Events emitted at correct points in service methods
- [ ] Listeners registered in user.module.ts
- [ ] EventEmitterModule imported in user.module.ts
- [ ] Unit tests written for event emissions
- [ ] Integration tests written for event flows
- [ ] Logging added for event emissions
- [ ] Monitoring/alerts configured for event failures
- [ ] Documentation updated

---

## Performance Considerations

### Event Overhead

Each event emission adds ~1-5ms overhead. For high-frequency operations:

- ❌ Don't emit for location updates (could be 100s per session)
- ❌ Don't emit for preference updates (frequent)
- ✅ DO emit for registration (one-time)
- ✅ DO emit for verification (one-time)

### Async Processing

All events are processed asynchronously by default. If you need guaranteed ordering:

```typescript
// Use emitAsync instead of emit
await this.eventEmitter.emitAsync('user.registered', event);
```

**Warning**: Only use `emitAsync` if absolutely necessary - it defeats the async benefit.

---

## Troubleshooting

### Events not firing?

1. Check EventEmitterModule is imported in module
2. Check EventEmitter2 is injected in constructor
3. Check event name matches listener @OnEvent('event.name')
4. Check listener is registered in module providers
5. Add logging: `this.logger.log('Emitting event...')`

### Events firing but listeners not running?

1. Check listener class has @Injectable() decorator
2. Check listener method has @OnEvent() decorator
3. Check event name spelling matches exactly
4. Check listener is in module providers array
5. Add logging in listener: `this.logger.log('Received event...')`

### Events causing performance issues?

1. Profile event handlers - are they too slow?
2. Consider moving to Bull queue for heavy processing
3. Check for N+1 queries in event handlers
4. Ensure listeners don't wait for each other unnecessarily

---

## Next Steps

1. Implement the service changes outlined above
2. Write unit tests for event emissions
3. Implement listener business logic (currently TODO)
4. Write integration tests for event flows
5. Deploy to staging and monitor
6. Deploy to production with feature flags

For questions or issues, refer to EVENTS_IMPLEMENTATION_GUIDE.md
