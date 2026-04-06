import { UserRole } from '@foodwaste/shared';
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Request, Response, NextFunction } from 'express';
import { Model } from 'mongoose';

import { User, UserDocument } from 'src/users/schemas/user.schema';

import { TenantContext } from '../interfaces/authorization.interface';

/**
 * Tenant Context Middleware
 * Automatically injects tenant context into requests for merchant isolation
 *
 * Security Features:
 * 1. Automatically extracts merchant/establishment context from authenticated user
 * 2. Prevents cross-tenant data access
 * 3. Simplifies controller logic (no manual tenant checks needed)
 *
 * Applied to:
 * - All authenticated routes for MERCHANT role
 * - Routes that require tenant isolation
 */

type TenantContextRequest = Request & {
  user?: Record<string, unknown>;
  tenantContext?: TenantContext;
};

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const tenantRequest = req as TenantContextRequest;
      // Skip if no authenticated user
      const user = tenantRequest.user;
      const userIdValue = user?.['userId'];
      const userRoleValue = user?.['role'];
      if (typeof userIdValue !== 'string' || userIdValue.length === 0) {
        return next();
      }

      if (userRoleValue === null || userRoleValue === undefined) {
        return next();
      }

      const userId = userIdValue;
      const userRole = userRoleValue as UserRole;

      // Only apply tenant context for merchants
      if (userRole === UserRole.MERCHANT) {
        const user = await this.userModel.findById(userId).lean();

        if (user) {
          // For merchants, tenantId is their userId (they are the tenant)
          const tenantContext: TenantContext = {
            tenantId: userId,
            tenantType: 'merchant',
            userId,
            role: userRole,
            establishmentIds: [], // Will be populated from establishments
          };

          // Attach to request
          tenantRequest.tenantContext = tenantContext;

          this.logger.debug(`Tenant context set for merchant ${userId}`);
        }
      }

      // For other roles, still set basic context
      else {
        tenantRequest.tenantContext = {
          tenantId: userId,
          tenantType: userRole === UserRole.ADMIN ? 'organization' : 'merchant',
          userId,
          role: userRole,
        };
      }

      next();
    } catch (error) {
      this.logger.error('Error setting tenant context', error);
      // Don't block request, continue without tenant context
      next();
    }
  }
}
