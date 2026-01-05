import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from 'src/users/schemas/user.schema';
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

// Extend Express Request to include tenant context
declare global {
    namespace Express {
        interface Request {
            tenantContext?: TenantContext;
        }
    }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
    private readonly logger = new Logger(TenantContextMiddleware.name);

    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) {}

    async use(req: Request, res: Response, next: NextFunction) {
        try {
            // Skip if no authenticated user
            if (!req.user?.['userId']) {
                return next();
            }

            const userId = req.user['userId'];
            const userRole = req.user['role'] as UserRole;

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
                    req.tenantContext = tenantContext;

                    this.logger.debug(`Tenant context set for merchant ${userId}`);
                }
            }

            // For other roles, still set basic context
            else {
                req.tenantContext = {
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
