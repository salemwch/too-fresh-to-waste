import { SetMetadata } from '@nestjs/common';

/**
 * Check Ownership Configuration
 */
export interface OwnershipCheckConfig {
  /**
   * Resource type (e.g., 'order', 'offer', 'establishment')
   */
  resourceType: string;

  /**
   * Parameter name containing the resource ID
   * Defaults to 'id'
   */
  resourceIdParam?: string;

  /**
   * Field in the resource document that contains the owner ID
   * Can be an array for multiple possible owner fields
   * Examples: 'ownerId', 'merchantId', 'customerId', ['merchantId', 'ownerId']
   */
  ownerIdField: string | string[];

  /**
   * Whether to allow access if user has admin role
   * Defaults to true
   */
  allowAdmin?: boolean;

  /**
   * Additional permissions that bypass ownership check
   * Example: ['orders:update:any'] allows users with this permission to update any order
   */
  bypassPermissions?: string[];
}

export const CHECK_OWNERSHIP_KEY = 'check_ownership';

/**
 * Check Ownership Decorator
 * Enforces resource ownership before allowing access
 *
 * Usage:
 * @CheckOwnership({ resourceType: 'order', ownerIdField: 'merchantId' })
 * @Patch('orders/:id')
 * async updateOrder(@Param('id') id: string) { ... }
 *
 * @CheckOwnership({
 *   resourceType: 'establishment',
 *   ownerIdField: 'ownerId',
 *   bypassPermissions: ['establishments:update:any']
 * })
 * @Patch('establishments/:id')
 * async updateEstablishment() { ... }
 */
export const CheckOwnership = (config: OwnershipCheckConfig) =>
  SetMetadata(CHECK_OWNERSHIP_KEY, config);
