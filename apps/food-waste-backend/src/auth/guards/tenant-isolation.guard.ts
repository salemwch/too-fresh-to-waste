import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { UserRole } from 'src/users/schemas/user.schema';
import { TenantContext } from '../interfaces/authorization.interface';

/**
 * Tenant Isolation Guard
 * Enforces strict tenant isolation for merchant data
 *
 * Security Features:
 * 1. Prevents merchants from accessing other merchants' data
 * 2. Ensures all queries are scoped to the merchant's tenant
 * 3. Admin bypass for cross-tenant operations
 * 4. Audit logging for tenant boundary violations
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TenantIsolationGuard)
 * @Get('orders')
 * async getOrders(@TenantCtx() tenant: TenantContext) {
 *   // tenant.tenantId is guaranteed to be the merchant's ID
 *   // Cannot access other merchants' orders
 * }
 */

@Injectable()
export class TenantIsolationGuard implements CanActivate {
    private readonly logger = new Logger(TenantIsolationGuard.name);

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        const { role, userId } = user;

        // Admin and moderators can access cross-tenant data
        if (role === UserRole.ADMIN || role === UserRole.MODERATOR) {
            this.logger.debug(`Admin/Moderator ${userId} - tenant isolation bypassed`);
            return true;
        }

        // For merchants, ensure tenant context is set
        if (role === UserRole.MERCHANT) {
            const tenantContext: TenantContext | undefined = request.tenantContext;

            if (!tenantContext) {
                this.logger.error(
                    `Tenant context missing for merchant ${userId}`,
                );
                throw new ForbiddenException(
                    'Tenant context not available. Please contact support.',
                );
            }

            // Verify tenant context matches user
            if (tenantContext.tenantId.toString() !== userId.toString()) {
                this.logger.error(
                    `Tenant ID mismatch for merchant ${userId}`,
                    {
                        expectedTenantId: userId,
                        actualTenantId: tenantContext.tenantId,
                    },
                );
                throw new ForbiddenException('Tenant isolation violation detected');
            }

            this.logger.debug(
                `Tenant isolation enforced for merchant ${userId}`,
            );
            return true;
        }

        // Consumers don't need tenant isolation (they access their own data)
        return true;
    }
}
