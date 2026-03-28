import { createParamDecorator } from '@nestjs/common';

import type { TenantContext } from '../interfaces/authorization.interface';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Tenant Context Decorator
 * Extracts tenant context from the request
 *
 * Usage:
 * @Get('my-orders')
 * async getMyOrders(@TenantCtx() tenant: TenantContext) {
 *   // tenant is automatically populated with merchant context
 * }
 */
export const TenantCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext || null;
  },
);

/**
 * Get Tenant ID Decorator
 * Extracts just the tenant ID from the request
 *
 * Usage:
 * @Get('stats')
 * async getStats(@TenantId() tenantId: string) {
 *   // Get stats for this tenant only
 * }
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext?.tenantId?.toString() || null;
  },
);
