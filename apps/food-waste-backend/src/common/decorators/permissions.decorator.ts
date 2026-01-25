import { SetMetadata } from '@nestjs/common';

/**
 * Permissions Decorator
 * Specifies required permissions for a route
 *
 * Usage:
 * @Permissions('orders:read:own')
 * @Get('my-orders')
 * async getMyOrders() { ... }
 *
 * @Permissions('orders:read:any', 'orders:update:any')
 * @Get('all-orders')
 * async getAllOrders() { ... }
 */
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Require All Permissions Decorator
 * User must have ALL specified permissions (AND logic)
 *
 * Usage:
 * @RequireAllPermissions('orders:read:any', 'analytics:access:any')
 * @Get('admin-dashboard')
 * async getAdminDashboard() { ... }
 */
export const REQUIRE_ALL_PERMISSIONS_KEY = 'require_all_permissions';
export const RequireAllPermissions = (...permissions: string[]) =>
    SetMetadata(REQUIRE_ALL_PERMISSIONS_KEY, permissions);

/**
 * Require Any Permission Decorator
 * User must have AT LEAST ONE of the specified permissions (OR logic)
 *
 * Usage:
 * @RequireAnyPermission('orders:update:own', 'orders:update:any')
 * @Patch(':id')
 * async updateOrder() { ... }
 */
export const REQUIRE_ANY_PERMISSION_KEY = 'require_any_permission';
export const RequireAnyPermission = (...permissions: string[]) =>
    SetMetadata(REQUIRE_ANY_PERMISSION_KEY, permissions);
