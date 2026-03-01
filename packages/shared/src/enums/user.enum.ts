/**
 * User Role Enum — mirrors backend exactly
 * @see apps/food-waste-backend/src/common/enums/user.enum.ts
 */
export enum UserRole {
  CONSUMER = 'consumer',
  MERCHANT = 'merchant',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

/**
 * User Status Enum — mirrors backend exactly
 * @see apps/food-waste-backend/src/common/enums/user.enum.ts
 */
export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BLOCKED = 'blocked',
  DELETED = 'deleted',
  ANONYMIZED = 'anonymized',
}
