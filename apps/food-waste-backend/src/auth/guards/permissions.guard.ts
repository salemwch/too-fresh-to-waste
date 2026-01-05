import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
    PERMISSIONS_KEY,
    REQUIRE_ALL_PERMISSIONS_KEY,
    REQUIRE_ANY_PERMISSION_KEY,
} from '../decorators/permissions.decorator';
import { AuthorizationService } from '../services/authorization.service';
import { UserRole } from 'src/users/schemas/user.schema';

/**
 * Permissions Guard
 * Enforces fine-grained permission checks on routes
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequireAnyPermission('orders:read:own', 'orders:read:any')
 * @Get('orders')
 * async getOrders() { ... }
 *
 * Features:
 * - Supports AND/OR permission logic
 * - Automatic admin bypass (configurable)
 * - Performance optimized with caching
 * - Detailed error messages
 */

@Injectable()
export class PermissionsGuard implements CanActivate {
    private readonly logger = new Logger(PermissionsGuard.name);

    constructor(
        private readonly reflector: Reflector,
        private readonly authorizationService: AuthorizationService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check for permission requirements
        const permissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        const requireAllPermissions = this.reflector.getAllAndOverride<string[]>(
            REQUIRE_ALL_PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        const requireAnyPermission = this.reflector.getAllAndOverride<string[]>(
            REQUIRE_ANY_PERMISSION_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no permissions specified, allow access
        const requiredPermissions =
            permissions || requireAllPermissions || requireAnyPermission;

        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            this.logger.warn('PermissionsGuard: User not authenticated');
            throw new ForbiddenException('User not authenticated');
        }

        const { userId, role } = user;

        // Check permissions
        const result = await this.authorizationService.checkPermissions({
            userId,
            role: role as UserRole,
            requiredPermissions,
            requireAll: !!requireAllPermissions, // If requireAll decorator used, require all permissions
        });

        if (!result.allowed) {
            this.logger.warn(
                `Permission denied for user ${userId}: ${result.reason}`,
                {
                    requiredPermissions,
                    missingPermissions: result.missingPermissions,
                },
            );

            throw new ForbiddenException({
                message: 'Insufficient permissions',
                requiredPermissions,
                missingPermissions: result.missingPermissions,
            });
        }

        this.logger.debug(`Permission granted for user ${userId}`, {
            requiredPermissions,
        });

        return true;
    }
}
