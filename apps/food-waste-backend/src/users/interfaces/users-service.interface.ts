import type { CreateUserDto } from '../DTO/create-user.dto';
import type { UpdateUserDto } from '../DTO/update-user.dto';
import type { UserDocument, UserStatus, User } from '../schemas/user.schema';

/**
 * Interface for Users Service
 *
 * Abstraction layer for user management operations.
 * Enables dependency inversion and facilitates testing with mocks.
 *
 * @enterprise-pattern Dependency Inversion Principle (SOLID)
 * @testing Enables easy mocking and substitution in unit tests
 */
export interface IUsersService {
  /**
   * Create a new user account
   * @param createUserDto User creation data
   * @param auditData Optional audit information (IP, user agent)
   * @returns Created user document
   */
  create(
    createUserDto: CreateUserDto & {
      emailVerificationToken?: string;
      emailVerificationExpires?: Date;
      profileImage?: string;
    },
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<UserDocument>;

  /**
   * Find all users with pagination
   */
  findAll(
    page?: number,
    limit?: number,
    includeDeleted?: boolean,
  ): Promise<{
    users: User[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;

  /**
   * Find user by ID
   */
  findOne(id: string, includeDeleted?: boolean): Promise<User>;

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<UserDocument | null>;

  /**
   * Find user by ID (alternative signature for MFA service)
   */
  findById(id: string): Promise<UserDocument | null>;

  /**
   * Find user with refresh tokens included
   */
  findOneWithTokens(id: string): Promise<User>;

  /**
   * Verify user email address
   */
  verifyEmail(userId: string): Promise<void>;

  /**
   * Update email verification token
   */
  updateEmailVerificationToken(userId: string, token: string, expires: Date): Promise<void>;

  /**
   * Update user password
   */
  updatePassword(
    userId: string,
    newPassword: string,
    auditData?: { ipAddress: string; userAgent: string },
  ): Promise<void>;

  /**
   * Update user profile
   */
  update(id: string, updateUserDto: UpdateUserDto): Promise<User>;

  /**
   * Update user status
   */
  updateStatus(id: string, status: UserStatus): Promise<User>;

  /**
   * Add refresh token to user
   */
  addRefreshToken(userId: string, refreshToken: string): Promise<void>;

  /**
   * Remove refresh token from user
   */
  removeRefreshToken(userId: string, refreshToken: string): Promise<void>;

  /**
   * Clear all refresh tokens for user
   */
  clearAllRefreshTokens(userId: string): Promise<void>;

  /**
   * Mark token invalidation timestamp (for token rotation)
   */
  markTokenInvalidation(userId: string): Promise<void>;

  /**
   * Increment token revocation version (force logout from all devices)
   */
  incrementTokenRevocationVersion(userId: string): Promise<void>;

  /**
   * Update last login information
   */
  updateLastLogin(
    userId: string,
    ipAddress: string,
    userAgent: string,
    location?: string,
  ): Promise<void>;

  /**
   * Atomic increment of the failed-login audit counter.
   * Lockout decisions are owned by AuthSecurityService (Redis).
   */
  incrementFailedLoginAttempts(userId: string, ipAddress: string, userAgent: string): Promise<void>;

  /**
   * Reset failed login attempts
   */
  resetFailedLoginAttempts(userId: string): Promise<void>;

  /**
   * Check if account is locked
   */
  isAccountLocked(userId: string): Promise<boolean>;

  /**
   * Soft delete user (GDPR compliant)
   */
  softDelete(
    id: string,
    reason: string,
    auditData: { ipAddress: string; userAgent: string },
  ): Promise<void>;

  /**
   * Restore soft-deleted user
   */
  restore(id: string, auditData: { ipAddress: string; userAgent: string }): Promise<User>;
}

/**
 * Injection token for IUsersService
 * Use this token in constructor injection instead of the concrete class
 *
 * @example
 * constructor(@Inject(USERS_SERVICE_TOKEN) private readonly usersService: IUsersService) {}
 */
export const USERS_SERVICE_TOKEN = Symbol('IUsersService');
