import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { IUsersService } from './interfaces/users-service.interface';
interface IPaginationMeta {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

interface IFailedLoginUpdateData {
    failedLoginAttempts: number;
    $push: {
        auditLog: {
            action: string;
            timestamp: Date;
            ipAddress: string;
            userAgent: string;
            details: {
                attempt: number;
                maxAttempts: number;
            };
        };
    };
    accountLockedUntil?: Date;
    status?: string;
}

interface IAuditLogEntry {
    action: string;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
    details: IAuditLogDetails;
}

interface IPhoneVerificationResult {
    success: boolean;
    message: string;
    attemptsRemaining?: number;
}

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { User, UserDocument, UserStatus, IAuditLogDetails } from './schemas/user.schema';
import { CreateUserDto } from './DTO/create-user.dto';
import { UpdateUserDto } from './DTO/update-user.dto';
import { PasswordValidationService } from './services/password-validation.service';
import { PhoneNumberService } from '../common/services/phone-number.service';
import { SmsNotificationService } from '../notifications/services/sms-notification.service';
import { PasswordHistoryService } from '../auth/services/password-history.service';


/**
 * UsersService - Concrete implementation of IUsersService
 *
 * Implements enterprise-grade user management with:
 * - Interface-based dependency inversion
 * - Comprehensive audit logging
 * - GDPR-compliant soft delete
 * - Password history tracking
 * - Account lockout protection
 *
 * @implements {IUsersService}
 */
@Injectable()
export class UsersService implements IUsersService {
    private readonly logger = new Logger(UsersService.name);
    private readonly MAX_FAILED_ATTEMPTS = 10; // Increased from 5 to 10
    private readonly BASE_LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes (first lockout)
    private readonly PHONE_VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
    private readonly MAX_VERIFICATION_ATTEMPTS = 5;
    private readonly VERIFICATION_RATE_LIMIT = 5; // Max 5 requests per hour

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        private readonly passwordValidationService: PasswordValidationService,
        private readonly phoneNumberService: PhoneNumberService,
        private readonly smsNotificationService: SmsNotificationService,
        private readonly passwordHistoryService: PasswordHistoryService,
    ) { }

    async create(
        createUserDto: CreateUserDto & { emailVerificationToken?: string; profileImage?: string },
        auditData?: { ipAddress: string; userAgent: string }
    ): Promise<UserDocument> {
        // 1. Input validation for required fields
        if (!createUserDto?.email || createUserDto.email.trim() === '') {
            throw new BadRequestException('Email is required and cannot be empty');
        }
        if (!createUserDto?.password || createUserDto.password.trim() === '') {
            throw new BadRequestException('Password is required and cannot be empty');
        }
        if (!createUserDto?.firstName || createUserDto.firstName.trim() === '') {
            throw new BadRequestException('First name is required and cannot be empty');
        }
        if (!createUserDto?.lastName || createUserDto.lastName.trim() === '') {
            throw new BadRequestException('Last name is required and cannot be empty');
        }

        try {
            // 2. Normalize email to lowercase for consistency
            const normalizedEmail = createUserDto.email.trim().toLowerCase();

            // 3. Normalize phone number to E.164 format if provided
            let normalizedPhone: string | undefined;
            if (createUserDto.phoneNumber) {
                const phoneValidation = this.phoneNumberService.validatePhoneNumber(
                    createUserDto.phoneNumber,
                    'TN'  // Tunisia as default country
                );

                if (!phoneValidation.isValid) {
                    throw new BadRequestException(
                        phoneValidation.error || 'Invalid phone number format'
                    );
                }

                // Store in E.164 format for consistency
                normalizedPhone = phoneValidation.details?.formatted.e164;

                this.logger.log(`Phone number normalized: ${createUserDto.phoneNumber} -> ${normalizedPhone}`);
            }

            // 4. Validate password strength using dedicated service
            const userInfo = {
                email: normalizedEmail,
                firstName: createUserDto.firstName,
                lastName: createUserDto.lastName,
                phoneNumber: normalizedPhone || createUserDto.phoneNumber
            };

            const passwordValidation = await this.passwordValidationService.validatePassword(
                createUserDto.password,
                userInfo
            );

            if (!passwordValidation.isAcceptable) {
                throw new BadRequestException(`Password validation failed: ${passwordValidation.feedback.join(', ')}`);
            }

            // 5. Check for existing user with normalized email OR phone number
            const [existingEmailUser, existingPhoneUser] = await Promise.all([
                this.userModel.findOne({
                    email: normalizedEmail,
                    deletedAt: null
                }),
                normalizedPhone ? this.userModel.findOne({
                    phoneNumber: normalizedPhone,
                    deletedAt: null
                }) : null
            ]);

            if (existingEmailUser) {
                throw new ConflictException('User with this email already exists');
            }

            if (existingPhoneUser) {
                throw new ConflictException('User with this phone number already exists');
            }

            // 6. Hash password with argon2
            const hashedPassword = await argon2.hash(createUserDto.password, {
                type: argon2.argon2id,
                memoryCost: 2 ** 16,
                timeCost: 3,
                parallelism: 1,
            });

            // 7. Initialize privacy settings with default values
            const defaultPrivacySettings = {
                tunisianCompliance: {
                    dataProcessingConsent: false,
                    locationTrackingConsent: false,
                    communicationConsent: false
                },
                internationalCompliance: {
                    marketingOptIn: false,
                    analyticsOptIn: false,
                    thirdPartySharing: false,
                    profilingOptIn: false,
                    cookiesConsent: false,
                    gdprConsentGiven: false,
                    ccpaOptOutRequested: false
                },
                consentRecords: [],
                dataSubjectRights: {
                    dataPortabilityRequested: false,
                    deletionRequested: false,
                    restrictionRequested: false,
                    objectionRequested: false,
                    pendingRequests: []
                }
            };

            // 8. Initialize security settings
            const defaultSecuritySettings = {
                passwordStrength: {
                    score: passwordValidation.score,
                    feedback: passwordValidation.feedback,
                    lastChecked: new Date()
                },
                securityQuestions: [],
                passwordHistory: [hashedPassword], // Initialize with current password
                lastPasswordChange: new Date(),
                loginNotifications: true,
                suspiciousActivityNotifications: true
            };

            // 9. Create user with explicit status, normalized email and phone
            const user = new this.userModel({
                ...createUserDto,
                email: normalizedEmail, // Use normalized email
                phoneNumber: normalizedPhone, // Use normalized E.164 phone number
                password: hashedPassword,
                status: UserStatus.PENDING, // Explicit status for email verification
                isEmailVerified: false, // Explicit email verification status
                isPhoneVerified: false, // Phone not verified until verification flow completed
                privacySettings: defaultPrivacySettings,
                securitySettings: defaultSecuritySettings,
                failedLoginAttempts: 0,
                loginHistory: [],
                auditLog: auditData ? [{
                    action: 'USER_CREATED',
                    timestamp: new Date(),
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    details: {
                        registrationMethod: 'standard',
                        passwordStrength: passwordValidation.score,
                        emailNormalized: true,
                        phoneNormalized: !!normalizedPhone,
                        phoneFormat: normalizedPhone ? 'E.164' : undefined
                    }
                }] : []
            });

            // 10. Save user (database unique constraint handles race condition)
            const savedUser = await user.save();
            this.logger.log(`User created successfully: ${savedUser.email}${normalizedPhone ? ` with phone ${normalizedPhone}` : ''} (password strength: ${passwordValidation.score})`);

            return savedUser;
        } catch (error: any) {
            // Handle mongoose duplicate key error (race condition safety)
            if (error.code === 11000) {
                if (error.keyPattern?.email) {
                    throw new ConflictException('User with this email already exists');
                }
                if (error.keyPattern?.phoneNumber) {
                    throw new ConflictException('User with this phone number already exists');
                }
                throw new ConflictException('User with this information already exists');
            }

            // Ensure no sensitive data is leaked in error messages
            if (error instanceof ConflictException || error instanceof BadRequestException) {
                // Re-throw validation and conflict errors as-is (they're safe)
                throw error;
            }

            // For other errors, log the full error but throw a sanitized version
            this.logger.error(`User creation failed for email: ${createUserDto.email}`, error?.stack || 'No stack trace available');
            throw new BadRequestException('User creation failed due to system error');
        }
    }
    async findAll(
        page = 1,
        limit = 10,
        includeDeleted = false
    ): Promise<{ users: User[], total: number, pagination: IPaginationMeta }> {
        // ✅ OPTIMIZATION: Limit max page size to prevent DOS
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        // Build query to exclude soft deleted users by default
        const query = includeDeleted ? {} : { deletedAt: null };

        const [users, total] = await Promise.all([
            this.userModel
                .find(query)
                .select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken -privacySettings.consentRecords -auditLog')
                .skip(skip)
                .limit(safeLimit)
                .sort({ createdAt: -1 })
                .lean() // ✅ OPTIMIZATION: 50% memory reduction, 10-15% faster
                .exec(),
            this.userModel.countDocuments(query),
        ]);

        return {
            users: users as User[],
            total,
            pagination: {
                page,
                limit: safeLimit,
                totalPages: Math.ceil(total / safeLimit),
                hasNext: page < Math.ceil(total / safeLimit),
                hasPrev: page > 1
            }
        };
    }
    async findOne(id: string, includeDeleted = false): Promise<User> {
        const query = includeDeleted ? { _id: id } : { _id: id, deletedAt: null };

        const user = await this.userModel
            .findOne(query)
            .select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken -privacySettings.consentRecords -auditLog')
            .lean() // ✅ OPTIMIZATION: Read-only operation, use lean()
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user as User;
    }
    async findOneWithTokens(id: string): Promise<User> {
        const user = await this.userModel
            .findById(id)
            .select('-password -emailVerificationToken -phoneVerificationCode -passwordResetToken')
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }
    async findByEmail(email: string): Promise<UserDocument> {
        // Normalize email to lowercase for case-insensitive matching
        // This matches the normalization done in create() method
        const normalizedEmail = email.trim().toLowerCase();

        // Exclude soft-deleted users to prevent false positives
        return this.userModel.findOne({
            email: normalizedEmail,
            deletedAt: null
        }).exec();
    }

    async findByEmailVerificationToken(email: string, token: string): Promise<UserDocument> {
        // Normalize email to match stored format
        const normalizedEmail = email.trim().toLowerCase();

        return this.userModel.findOne({
            email: normalizedEmail,
            emailVerificationToken: token,
            isEmailVerified: false,
            deletedAt: null  // Exclude soft-deleted users
        }).exec();
    }

    async findByPasswordResetToken(email: string, token: string): Promise<UserDocument> {
        // Normalize email to match stored format
        const normalizedEmail = email.trim().toLowerCase();

        return this.userModel.findOne({
            email: normalizedEmail,
            passwordResetToken: token,
            deletedAt: null  // Exclude soft-deleted users
        }).exec();
    }

    async verifyEmail(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            isEmailVerified: true,
            status: UserStatus.ACTIVE,
            emailVerificationToken: undefined,
        });
    }

    async updateEmailVerificationToken(userId: string, token: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            emailVerificationToken: token,
        });
    }

    /**
     * Send phone verification code via SMS
     * Generates a 6-digit code, hashes it, stores in database, and sends via SMS
     * Includes rate limiting and audit logging
     */
    async sendPhoneVerificationCode(
        userId: string,
        phoneNumber: string,
        auditData?: { ipAddress: string; userAgent: string }
    ): Promise<IPhoneVerificationResult> {
        try {
            // 1. Find user
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // 2. Check if phone is already verified
            if (user.isPhoneVerified && user.phoneNumber === phoneNumber) {
                return {
                    success: false,
                    message: 'Phone number is already verified'
                };
            }

            // 3. Rate limiting: Check recent verification attempts
            const recentAttempts = user.auditLog?.filter(log =>
                log.action === 'PHONE_VERIFICATION_SENT' &&
                log.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
            ) || [];

            if (recentAttempts.length >= this.VERIFICATION_RATE_LIMIT) {
                this.logger.warn(`Phone verification rate limit exceeded for user ${userId}`);
                return {
                    success: false,
                    message: 'Too many verification attempts. Please try again later.',
                    attemptsRemaining: 0
                };
            }

            // 4. Normalize and validate phone number
            const phoneValidation = this.phoneNumberService.validatePhoneNumber(phoneNumber, 'TN');
            if (!phoneValidation.isValid) {
                throw new BadRequestException(phoneValidation.error || 'Invalid phone number format');
            }

            const normalizedPhone = phoneValidation.details?.formatted.e164;
            if (!normalizedPhone) {
                throw new BadRequestException('Failed to normalize phone number');
            }

            // 5. Check if phone number is already used by another user
            if (user.phoneNumber !== normalizedPhone) {
                const existingUser = await this.userModel.findOne({
                    phoneNumber: normalizedPhone,
                    deletedAt: null,
                    _id: { $ne: userId }
                });

                if (existingUser) {
                    throw new ConflictException('This phone number is already registered to another account');
                }
            }

            // 6. Generate secure 6-digit verification code
            const verificationCode = this.generateVerificationCode();

            // 7. Hash the verification code with argon2
            const hashedCode = await argon2.hash(verificationCode, {
                type: argon2.argon2id,
                memoryCost: 2 ** 16,
                timeCost: 3,
                parallelism: 1,
            });

            // 8. Calculate expiration time
            const codeExpiresAt = new Date(Date.now() + this.PHONE_VERIFICATION_CODE_EXPIRY);

            // 9. Store hashed code and expiration in database
            await this.userModel.findByIdAndUpdate(userId, {
                phoneNumber: normalizedPhone,
                phoneVerificationCode: hashedCode,
                phoneVerificationExpires: codeExpiresAt,
                phoneVerificationAttempts: 0, // Reset attempts on new code
                $push: auditData ? {
                    auditLog: {
                        action: 'PHONE_VERIFICATION_SENT',
                        timestamp: new Date(),
                        ipAddress: auditData.ipAddress,
                        userAgent: auditData.userAgent,
                        details: {
                            phoneNumberMasked: this.maskPhoneNumber(normalizedPhone),
                            expiresAt: codeExpiresAt,
                            attemptsRemaining: this.VERIFICATION_RATE_LIMIT - recentAttempts.length - 1
                        }
                    }
                } : undefined
            });

            // 10. Send verification code via SMS
            const smsResult = await this.smsNotificationService.sendVerificationCode(
                normalizedPhone,
                verificationCode
            );

            if (!smsResult.success) {
                this.logger.error(`Failed to send verification SMS to ${this.maskPhoneNumber(normalizedPhone)}`, {
                    error: smsResult.error
                });
                throw new BadRequestException('Failed to send verification code. Please try again.');
            }

            this.logger.log(`Phone verification code sent to ${this.maskPhoneNumber(normalizedPhone)} for user ${userId}`);

            return {
                success: true,
                message: 'Verification code sent successfully. Please check your phone.',
                attemptsRemaining: this.VERIFICATION_RATE_LIMIT - recentAttempts.length - 1
            };

        } catch (error) {
            if (error instanceof ConflictException || error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(`Failed to send phone verification code for user ${userId}`, {
                error: (error as Error).message,
                stack: (error as Error).stack
            });
            throw new BadRequestException('Failed to send verification code due to system error');
        }
    }

    /**
     * Verify phone number with provided code
     * Validates code against stored hash with timing-safe comparison
     * Includes attempt limiting and audit logging
     */
    async verifyPhoneCode(
        userId: string,
        phoneNumber: string,
        code: string,
        auditData?: { ipAddress: string; userAgent: string }
    ): Promise<IPhoneVerificationResult> {
        try {
            // 1. Find user
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // 2. Check if phone is already verified
            if (user.isPhoneVerified && user.phoneNumber === phoneNumber) {
                return {
                    success: false,
                    message: 'Phone number is already verified'
                };
            }

            // 3. Validate that phone number matches
            const phoneValidation = this.phoneNumberService.validatePhoneNumber(phoneNumber, 'TN');
            if (!phoneValidation.isValid) {
                throw new BadRequestException('Invalid phone number format');
            }

            const normalizedPhone = phoneValidation.details?.formatted.e164;
            if (user.phoneNumber !== normalizedPhone) {
                throw new BadRequestException('Phone number does not match verification request');
            }

            // 4. Check if verification code exists
            if (!user.phoneVerificationCode) {
                throw new BadRequestException('No verification code found. Please request a new code.');
            }

            // 5. Check if code has expired
            const phoneVerificationExpires = (user as any).phoneVerificationExpires;
            if (!phoneVerificationExpires || phoneVerificationExpires < new Date()) {
                await this.userModel.findByIdAndUpdate(userId, {
                    phoneVerificationCode: undefined,
                    phoneVerificationExpires: undefined,
                    phoneVerificationAttempts: 0
                });

                throw new BadRequestException('Verification code has expired. Please request a new code.');
            }

            // 6. Check verification attempts
            const attempts = (user as any).phoneVerificationAttempts || 0;
            if (attempts >= this.MAX_VERIFICATION_ATTEMPTS) {
                await this.userModel.findByIdAndUpdate(userId, {
                    phoneVerificationCode: undefined,
                    phoneVerificationExpires: undefined,
                    phoneVerificationAttempts: 0,
                    $push: auditData ? {
                        auditLog: {
                            action: 'PHONE_VERIFICATION_MAX_ATTEMPTS',
                            timestamp: new Date(),
                            ipAddress: auditData.ipAddress,
                            userAgent: auditData.userAgent,
                            details: {
                                phoneNumberMasked: this.maskPhoneNumber(normalizedPhone),
                                attempts
                            }
                        }
                    } : undefined
                });

                throw new BadRequestException('Maximum verification attempts exceeded. Please request a new code.');
            }

            // 7. Verify code using timing-safe comparison (argon2.verify)
            const isCodeValid = await argon2.verify(user.phoneVerificationCode, code);

            // 8. Increment attempt counter
            await this.userModel.findByIdAndUpdate(userId, {
                $inc: { phoneVerificationAttempts: 1 }
            });

            if (!isCodeValid) {
                const remainingAttempts = this.MAX_VERIFICATION_ATTEMPTS - attempts - 1;

                await this.addAuditLog(
                    userId,
                    'PHONE_VERIFICATION_FAILED',
                    auditData?.ipAddress || 'unknown',
                    auditData?.userAgent || 'unknown',
                    {
                        phoneNumberMasked: this.maskPhoneNumber(normalizedPhone),
                        attemptsRemaining: remainingAttempts
                    }
                );

                return {
                    success: false,
                    message: 'Invalid verification code',
                    attemptsRemaining: remainingAttempts
                };
            }

            // 9. Code is valid - mark phone as verified
            await this.userModel.findByIdAndUpdate(userId, {
                isPhoneVerified: true,
                phoneVerificationCode: undefined,
                phoneVerificationExpires: undefined,
                phoneVerificationAttempts: 0,
                $push: auditData ? {
                    auditLog: {
                        action: 'PHONE_VERIFIED',
                        timestamp: new Date(),
                        ipAddress: auditData.ipAddress,
                        userAgent: auditData.userAgent,
                        details: {
                            phoneNumberMasked: this.maskPhoneNumber(normalizedPhone),
                            method: 'sms_code'
                        }
                    }
                } : undefined
            });

            this.logger.log(`Phone number verified successfully for user ${userId}: ${this.maskPhoneNumber(normalizedPhone)}`);

            return {
                success: true,
                message: 'Phone number verified successfully'
            };

        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(`Failed to verify phone code for user ${userId}`, {
                error: (error as Error).message,
                stack: (error as Error).stack
            });
            throw new BadRequestException('Phone verification failed due to system error');
        }
    }

    /**
     * Resend phone verification code
     * Wrapper around sendPhoneVerificationCode with additional logging
     */
    async resendPhoneVerificationCode(
        userId: string,
        phoneNumber: string,
        auditData?: { ipAddress: string; userAgent: string }
    ): Promise<IPhoneVerificationResult> {
        this.logger.log(`Resending phone verification code for user ${userId}`);
        return this.sendPhoneVerificationCode(userId, phoneNumber, auditData);
    }

    /**
     * Generate a secure random 6-digit verification code
     * @private
     */
    private generateVerificationCode(): string {
        // Generate cryptographically secure random 6-digit code
        const code = crypto.randomInt(100000, 999999).toString();
        return code;
    }

    /**
     * Mask phone number for secure logging
     * Shows only last 4 digits
     * @private
     */
    private maskPhoneNumber(phoneNumber: string): string {
        if (!phoneNumber || phoneNumber.length < 4) {
            return '****';
        }
        const lastFour = phoneNumber.slice(-4);
        return '*'.repeat(phoneNumber.length - 4) + lastFour;
    }

    async setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            passwordResetToken: token,
            passwordResetExpires: expires,
        });
    }

    async updatePassword(
        userId: string,
        newPassword: string,
        auditData?: { ipAddress: string; userAgent: string }
    ): Promise<void> {
        // 1. Get current user to access password history
        const user = await this.userModel.findById(userId).select('+password +securitySettings');
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // 2. Check password history to prevent reuse
        const currentHistory = user.securitySettings?.passwordHistory || [];
        await this.passwordHistoryService.validatePasswordHistory(newPassword, currentHistory);

        // 3. Hash new password using Argon2id with OWASP recommended parameters
        const hashedPassword = await argon2.hash(newPassword, {
            type: argon2.argon2id,
            memoryCost: 2 ** 16, // 64 MiB
            timeCost: 3,
            parallelism: 1,
        });

        // 4. Add current password to history before updating
        const updatedHistory = this.passwordHistoryService.addToHistory(
            user.password,
            currentHistory
        );

        // 5. Build update object - only include $push if auditData is provided
        const updateObj: Record<string, any> = {
            password: hashedPassword,
            passwordResetToken: undefined,
            passwordResetExpires: undefined,
            failedLoginAttempts: 0, // Reset failed attempts on password change
            accountLockedUntil: undefined,
            'securitySettings.lastPasswordChange': new Date(),
            'securitySettings.passwordHistory': updatedHistory,
        };

        // Only add audit log if audit data is provided
        if (auditData) {
            updateObj.$push = {
                auditLog: {
                    action: 'PASSWORD_UPDATED',
                    timestamp: new Date(),
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    details: {
                        method: 'password_reset',
                        historyEnforced: this.passwordHistoryService.isHistoryEnforced(),
                        historyCount: this.passwordHistoryService.getPasswordHistoryCount()
                    }
                }
            };
        }

        await this.userModel.findByIdAndUpdate(userId, updateObj);

        this.logger.log(`Password updated for user ${userId}`, {
            historyTracked: updatedHistory.length,
            historyLimit: this.passwordHistoryService.getPasswordHistoryCount()
        });
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
        const user = await this.userModel
            .findByIdAndUpdate(id, updateUserDto, { new: true })
            .select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken')
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    /**
     * Update user's last known location
     * Stores location in locationPreferences.defaultLocation for:
     * - Location-based offer discovery
     * - Cross-device synchronization
     * - Distance calculations
     *
     * @param userId - User ID
     * @param locationData - Location coordinates and metadata
     * @returns Updated location data with timestamp
     */
    async updateUserLocation(
        userId: string,
        locationData: {
            latitude: number;
            longitude: number;
            locationName?: string;
            source?: 'gps' | 'network' | 'passive' | 'manual' | 'ip';
        },
    ): Promise<{
        latitude: number;
        longitude: number;
        locationName?: string;
        updatedAt: Date;
    }> {
        const timestamp = new Date();

        // Update locationPreferences.defaultLocation
        const updateData: any = {
            'locationPreferences.defaultLocation': {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
            },
            updatedAt: timestamp,
        };

        // Optionally add location to history for tracking
        const historyEntry = {
            coordinates: {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
            },
            timestamp,
            accuracy: null,
            source: locationData.source || 'manual',
        };

        const user = await this.userModel
            .findByIdAndUpdate(
                userId,
                {
                    $set: updateData,
                    $push: {
                        'locationPreferences.locationHistory': {
                            $each: [historyEntry],
                            $slice: -10, // Keep only last 10 locations for privacy
                        },
                    },
                },
                { new: true },
            )
            .select('locationPreferences updatedAt')
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        this.logger.log('User location updated', {
            userId,
            source: locationData.source || 'manual',
            hasLocationName: !!locationData.locationName,
        });

        return {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            locationName: locationData.locationName,
            updatedAt: timestamp,
        };
    }

    async updateStatus(id: string, status: UserStatus): Promise<User> {
        const user = await this.userModel
            .findByIdAndUpdate(id, { status }, { new: true })
            .select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken')
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async addRefreshToken(userId: string, refreshToken: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(
            userId,
            { $set: { refreshTokens: [refreshToken] } }
        );
    }

    async removeRefreshToken(userId: string, refreshToken: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(
            userId,
            { $pull: { refreshTokens: refreshToken } }
        );
    }

    async clearAllRefreshTokens(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, { refreshTokens: [] });
    }

    /**
     * Mark token invalidation timestamp
     * Used for token fixation attack prevention
     * Tokens issued before this timestamp will be rejected
     *
     * @param userId - User ID
     */
    async markTokenInvalidation(userId: string): Promise<void> {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                lastTokenInvalidation: new Date(),
            });

            this.logger.log('Token invalidation timestamp set', { userId });
        } catch (error) {
            this.logger.error('Error marking token invalidation', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Increment token revocation version
     * Forces logout from all devices by incrementing version
     *
     * @param userId - User ID
     */
    async incrementTokenRevocationVersion(userId: string): Promise<void> {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                $inc: { tokenRevocationVersion: 1 },
            });

            this.logger.log('Token revocation version incremented', { userId });
        } catch (error) {
            this.logger.error('Error incrementing token revocation version', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    async updateLastLogin(
        userId: string,
        ipAddress: string,
        userAgent: string,
        location?: string
    ): Promise<void> {
        const loginData = {
            ipAddress,
            userAgent,
            timestamp: new Date(),
            location
        };

        await this.userModel.findByIdAndUpdate(userId, {
            lastLoginAt: new Date(),
            $push: {
                loginHistory: {
                    $each: [loginData],
                    $slice: -50 // Keep only last 50 login records
                },
                auditLog: {
                    $each: [{
                        action: 'LOGIN_SUCCESS',
                        timestamp: new Date(),
                        ipAddress,
                        userAgent,
                        details: { location }
                    }],
                    $slice: -1000 // ✅ FIX: Keep only last 1000 audit entries (same as addAuditLog)
                }
            }
        });
    }

    async softDelete(
        id: string,
        reason: string,
        auditData: { ipAddress: string; userAgent: string }
    ): Promise<void> {
        const user = await this.userModel.findOne({ _id: id, deletedAt: null });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.userModel.findByIdAndUpdate(id, {
            status: UserStatus.DELETED,
            deletedAt: new Date(),
            deletionReason: reason,
            $push: {
                auditLog: {
                    action: '🇹🇳🌍 USER_SOFT_DELETED',
                    timestamp: new Date(),
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    details: { reason, method: 'soft_delete' }
                }
            }
        });

        this.logger.log(`User soft deleted: ${id}, reason: ${reason}`);
    }

    async restore(
        id: string,
        auditData: { ipAddress: string; userAgent: string }
    ): Promise<User> {
        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.deletedAt) {
            throw new BadRequestException('User is not deleted');
        }

        const restoredUser = await this.userModel.findByIdAndUpdate(id, {
            status: UserStatus.ACTIVE,
            deletedAt: null,
            deletionReason: undefined,
            $push: {
                auditLog: {
                    action: 'USER_RESTORED',
                    timestamp: new Date(),
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    details: { method: 'admin_restore' }
                }
            }
        }, { new: true }).select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken');

        this.logger.log(`User restored: ${id}`);
        return restoredUser!;
    }

    async hardDelete(id: string): Promise<void> {
        const result = await this.userModel.deleteOne({ _id: id });

        if (result.deletedCount === 0) {
            throw new NotFoundException('User not found');
        }

        this.logger.warn(`User PERMANENTLY DELETED: ${id}`);
    }

    /**
     * @deprecated Use AuthSecurityService.recordFailedLoginAttempt() instead.
     * This method is kept for backward compatibility but is no longer used for blocking decisions.
     * The single source of truth for login attempts is now Redis via AuthSecurityService.
     */
    async recordFailedLogin(
        userId: string,
        ipAddress: string,
        userAgent: string
    ): Promise<{ isLocked: boolean; attemptsRemaining: number }> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check if account is already locked
        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            return {
                isLocked: true,
                attemptsRemaining: 0
            };
        }

        const failedAttempts = (user.failedLoginAttempts || 0) + 1;
        const isLocked = failedAttempts >= this.MAX_FAILED_ATTEMPTS;

        const updateData: IFailedLoginUpdateData = {
            failedLoginAttempts: failedAttempts,
            $push: {
                auditLog: {
                    action: 'LOGIN_FAILED',
                    timestamp: new Date(),
                    ipAddress,
                    userAgent,
                    details: {
                        attempt: failedAttempts,
                        maxAttempts: this.MAX_FAILED_ATTEMPTS
                    }
                }
            }
        };

        if (isLocked) {
            const lockoutDuration = this.calculateLockoutDuration(failedAttempts);
            updateData.accountLockedUntil = new Date(Date.now() + lockoutDuration);
            updateData.status = UserStatus.SUSPENDED;

            this.logger.warn(`Account locked due to failed login attempts: ${userId}`, {
                attempts: failedAttempts,
                lockoutDuration: `${lockoutDuration / 60000} minutes`
            });
        }

        await this.userModel.findByIdAndUpdate(userId, updateData);

        return {
            isLocked,
            attemptsRemaining: Math.max(0, this.MAX_FAILED_ATTEMPTS - failedAttempts)
        };
    }

    async resetFailedLoginAttempts(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            failedLoginAttempts: 0,
            accountLockedUntil: undefined,
            status: UserStatus.ACTIVE
        });
    }

    /**
     * Calculate progressive lockout duration based on attempt count
     * - First lockout (10-19 attempts): 5 minutes
     * - Second lockout (20-29 attempts): 15 minutes
     * - Third+ lockout (30+ attempts): 30 minutes
     */
    private calculateLockoutDuration(attemptCount: number): number {
        if (attemptCount < 20) {
            // First lockout: 5 minutes
            return this.BASE_LOCKOUT_DURATION;
        } else if (attemptCount < 30) {
            // Second lockout: 15 minutes
            return this.BASE_LOCKOUT_DURATION * 3;
        } else {
            // Third+ lockout: 30 minutes
            return this.BASE_LOCKOUT_DURATION * 6;
        }
    }

    async isAccountLocked(userId: string): Promise<boolean> {
        const user = await this.userModel.findById(userId);
        if (!user) { return false };

        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            return true;
        }

        // Auto-unlock if lock period has expired
        if (user.accountLockedUntil && user.accountLockedUntil <= new Date()) {
            await this.resetFailedLoginAttempts(userId);
            return false;
        }

        return false;
    }

    async unlockAccount(
        userId: string,
        adminUserId: string,
        auditData: { ipAddress: string; userAgent: string }
    ): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            failedLoginAttempts: 0,
            accountLockedUntil: undefined,
            status: UserStatus.ACTIVE,
            $push: {
                auditLog: {
                    action: 'ACCOUNT_UNLOCKED',
                    timestamp: new Date(),
                    ipAddress: auditData.ipAddress,
                    userAgent: auditData.userAgent,
                    details: { unlockedBy: adminUserId, method: 'admin_action' }
                }
            }
        });

        this.logger.log(`Account unlocked by admin ${adminUserId}: ${userId}`);
    }

    async addAuditLog(
        userId: string,
        action: string,
        ipAddress: string,
        userAgent: string,
        details: IAuditLogDetails = {}
    ): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            $push: {
                auditLog: {
                    $each: [{
                        action,
                        timestamp: new Date(),
                        ipAddress,
                        userAgent,
                        details
                    }],
                    $slice: -1000 // Keep only last 1000 audit entries
                }
            }
        });
    }

    async getAuditLog(userId: string, limit = 100): Promise<IAuditLogEntry[]> {
        const user = await this.userModel
            .findById(userId)
            .select('auditLog')
            .exec();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return (user.auditLog || [])
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    async searchUsers(
        query: string,
        page = 1,
        limit = 10
    ): Promise<{ users: User[], total: number }> {
        // ✅ OPTIMIZATION: Limit max page size to prevent DOS
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        // Create search regex (case-insensitive)
        const searchRegex = new RegExp(query, 'i');

        const [users, total] = await Promise.all([
            this.userModel
                .find({
                    deletedAt: null,
                    $or: [
                        { firstName: searchRegex },
                        { lastName: searchRegex },
                        { email: searchRegex }
                    ]
                })
                .select('-password -refreshTokens -emailVerificationToken -phoneVerificationCode -passwordResetToken -privacySettings -auditLog')
                .skip(skip)
                .limit(safeLimit)
                .sort({ createdAt: -1 })
                .lean() // ✅ OPTIMIZATION: Read-only search, use lean()
                .exec(),
            this.userModel.countDocuments({
                deletedAt: null,
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex }
                ]
            })
        ]);

        return { users: users as User[], total };
    }

    async getComplianceSummary(userId: string): Promise<{
        tunisiaCompliant: boolean;
        gdprCompliant: boolean;
        ccpaCompliant: boolean;
        lastConsentUpdate: Date | null;
        pendingActions: string[];
    }> {
        const user = await this.userModel.findById(userId).select('privacySettings').exec();
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const privacy = user.privacySettings;
        const pendingActions: string[] = [];

        // Check Tunisia compliance
        const tunisiaCompliant = !!(
            privacy?.tunisianCompliance?.dataProcessingConsent &&
            privacy?.tunisianCompliance?.communicationConsent
        );

        // Check GDPR compliance
        const gdprCompliant = !!(
            privacy?.internationalCompliance?.gdprConsentGiven
        );

        // Check CCPA compliance
        const ccpaCompliant = !privacy?.internationalCompliance?.ccpaOptOutRequested;

        // Determine pending actions
        if (!tunisiaCompliant) { pendingActions.push('🇹🇳 Tunisia consent required') };
        if (!gdprCompliant) { pendingActions.push('🌍 GDPR consent required') };
        if (privacy?.dataSubjectRights?.deletionRequested) {
            pendingActions.push('Data deletion request pending');
        }

        return {
            tunisiaCompliant,
            gdprCompliant,
            ccpaCompliant,
            lastConsentUpdate: privacy?.lastConsentRefresh || null,
            pendingActions
        };
    }

    // Keep the old remove method for backward compatibility but log warning
    async remove(id: string): Promise<void> {
        this.logger.warn(`DEPRECATED: Hard delete called for user ${id}. Use softDelete() instead for GDPR compliance.`);
        await this.hardDelete(id);
    }

    async updateDeviceInfo(
        userId: string,
        deviceInfo: {
            deviceId: string;
            deviceFingerprint: string;
            deviceName: string;
            platform: string;
            browser: string;
            ipAddress: string;
            userAgent: string;
            lastActiveAt: Date;
        }
    ): Promise<void> {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Check if device already exists
            const existingDeviceIndex = user.trustedDevices?.findIndex(
                device => device.deviceId === deviceInfo.deviceId
            ) ?? -1;

            const deviceData = {
                deviceId: deviceInfo.deviceId,
                deviceFingerprint: deviceInfo.deviceFingerprint,
                deviceName: deviceInfo.deviceName,
                platform: deviceInfo.platform,
                browser: deviceInfo.browser,
                ipAddress: deviceInfo.ipAddress,
                userAgent: deviceInfo.userAgent,
                isTrusted: false, // New devices are not trusted by default
                lastUsedAt: deviceInfo.lastActiveAt,
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
            };

            if (existingDeviceIndex >= 0) {
                // Update existing device
                await this.userModel.findByIdAndUpdate(userId, {
                    $set: {
                        [`trustedDevices.${existingDeviceIndex}`]: {
                            ...user.trustedDevices![existingDeviceIndex],
                            ...deviceData,
                        }
                    }
                });
            } else {
                // Add new device
                await this.userModel.findByIdAndUpdate(userId, {
                    $push: {
                        trustedDevices: deviceData
                    }
                });
            }

            // Add audit log entry
            await this.addAuditLog(
                userId,
                'DEVICE_INFO_UPDATED',
                deviceInfo.ipAddress,
                deviceInfo.userAgent,
                {
                    deviceId: deviceInfo.deviceId,
                    platform: deviceInfo.platform,
                    browser: deviceInfo.browser,
                    action: existingDeviceIndex >= 0 ? 'updated' : 'added'
                }
            );

            this.logger.log(`Device info updated for user ${userId}: ${deviceInfo.deviceId}`);
        } catch (error) {
            this.logger.error(`Failed to update device info for user ${userId}:`, error);
            throw error;
        }
    }

    async getAuthenticationStats(fromDate: Date, toDate: Date): Promise<{
        totalUsers: number;
        activeUsers: number;
        successfulLogins: number;
        failedLogins: number;
        lockedAccounts: number;
        newRegistrations: number;
    }> {
        try {
            const [
                totalUsers,
                activeUsers,
                lockedAccounts,
                newRegistrations,
                loginHistoryData
            ] = await Promise.all([
                // Total users (excluding deleted)
                this.userModel.countDocuments({ deletedAt: null }),

                // Active users (logged in within the period)
                this.userModel.countDocuments({
                    deletedAt: null,
                    lastLoginAt: { $gte: fromDate, $lte: toDate }
                }),

                // Currently locked accounts
                this.userModel.countDocuments({
                    deletedAt: null,
                    accountLockedUntil: { $gt: new Date() }
                }),

                // New registrations in the period
                this.userModel.countDocuments({
                    deletedAt: null,
                    createdAt: { $gte: fromDate, $lte: toDate }
                }),

                // Login history aggregation for success/failed counts
                this.userModel.aggregate([
                    { $match: { deletedAt: null } },
                    { $unwind: { path: '$loginHistory', preserveNullAndEmptyArrays: true } },
                    {
                        $match: {
                            'loginHistory.timestamp': { $gte: fromDate, $lte: toDate }
                        }
                    },
                    {
                        $group: {
                            _id: '$loginHistory.success',
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

            // Process login history results
            let successfulLogins = 0;
            let failedLogins = 0;

            loginHistoryData.forEach((item: any) => {
                if (item._id === true) {
                    successfulLogins = item.count;
                } else if (item._id === false) {
                    failedLogins = item.count;
                }
            });

            return {
                totalUsers,
                activeUsers,
                successfulLogins,
                failedLogins,
                lockedAccounts,
                newRegistrations
            };
        } catch (error) {
            this.logger.error('Error getting authentication statistics:', error);
            return {
                totalUsers: 0,
                activeUsers: 0,
                successfulLogins: 0,
                failedLogins: 0,
                lockedAccounts: 0,
                newRegistrations: 0
            };
        }
    }

    // MFA-related methods for backward compatibility with MFA service
    async findById(id: string): Promise<UserDocument | null> {
        try {
            return await this.userModel.findById(id).exec();
        } catch (error) {
            this.logger.error(`Error finding user by ID ${id}:`, error);
            return null;
        }
    }

    async updateMfaSettings(userId: string, mfaUpdate: Record<string, unknown>): Promise<void> {
        try {
            const updateData: Record<string, unknown> = {};

            // Map the simplified MFA structure to the schema structure
            if (mfaUpdate.pendingTotpSecret !== undefined) {
                updateData['mfaSettings.pendingTotpSecret'] = mfaUpdate.pendingTotpSecret;
            }
            if (mfaUpdate.backupCodes !== undefined) {
                updateData['mfaSettings.backupCodes'] = mfaUpdate.backupCodes;
            }
            if (mfaUpdate.emergencyTokens !== undefined) {
                updateData['mfaSettings.emergencyTokens'] = mfaUpdate.emergencyTokens;
            }
            if (mfaUpdate.lastUsedAt !== undefined) {
                updateData['mfaSettings.lastAuthAt'] = mfaUpdate.lastUsedAt;
            }

            await this.userModel.findByIdAndUpdate(userId, updateData);
            this.logger.log(`MFA settings updated for user ${userId}`);
        } catch (error) {
            this.logger.error(`Error updating MFA settings for user ${userId}:`, error);
            throw error;
        }
    }

    async activateMfa(userId: string, mfaData: Record<string, unknown>): Promise<void> {
        try {
            const updateData: Record<string, unknown> = {
                'mfaSettings.isEnabled': mfaData.isEnabled || true,
            };

            if (mfaData.totpSecret) {
                // Add or update TOTP method
                updateData['mfaSettings.methods'] = [{
                    type: 'totp',
                    isActive: true,
                    secret: mfaData.totpSecret,
                    createdAt: mfaData.activatedAt || new Date(),
                    verified: true
                }];
            }

            // Clear pending secret
            updateData['mfaSettings.pendingTotpSecret'] = undefined;

            await this.userModel.findByIdAndUpdate(userId, updateData);
            this.logger.log(`MFA activated for user ${userId}`);
        } catch (error) {
            this.logger.error(`Error activating MFA for user ${userId}:`, error);
            throw error;
        }
    }

    async updateMfaLastUsed(userId: string): Promise<void> {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                'mfaSettings.lastAuthAt': new Date()
            });
        } catch (error) {
            this.logger.error(`Error updating MFA last used for user ${userId}:`, error);
            throw error;
        }
    }

    async disableMfa(userId: string): Promise<void> {
        try {
            await this.userModel.findByIdAndUpdate(userId, {
                'mfaSettings.isEnabled': false,
                'mfaSettings.methods': []
            });
            this.logger.log(`MFA disabled for user ${userId}`);
        } catch (error) {
            this.logger.error(`Error disabling MFA for user ${userId}:`, error);
            throw error;
        }
    }
}