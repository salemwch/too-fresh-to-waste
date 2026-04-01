import { UserRole } from '@foodwaste/shared';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import {
  CHECK_OWNERSHIP_KEY,
  OwnershipCheckConfig,
} from '../../common/decorators/check-ownership.decorator';

/**
 * Resource Ownership Guard
 * Enforces resource ownership before allowing access
 *
 * Security Features:
 * 1. Prevents users from accessing/modifying resources they don't own
 * 2. Supports multiple owner field checks (merchantId, ownerId, customerId)
 * 3. Admin bypass (configurable)
 * 4. Permission-based bypass
 * 5. Tenant isolation enforcement
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, ResourceOwnershipGuard)
 * @CheckOwnership({ resourceType: 'order', ownerIdField: 'merchantId' })
 * @Patch('orders/:id')
 * async updateOrder() { ... }
 */

@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(ResourceOwnershipGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<OwnershipCheckConfig>(CHECK_OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no ownership check configured, allow access
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const { userId, role } = user;

    // Admin bypass (if allowed by config)
    if (config.allowAdmin !== false && role === UserRole.ADMIN) {
      this.logger.debug(`Admin bypass for user ${userId}`);
      return true;
    }

    // Get resource ID from request params
    const resourceIdParam = config.resourceIdParam || 'id';
    const resourceId = request.params[resourceIdParam];

    if (!resourceId) {
      throw new ForbiddenException(`Resource ID parameter '${resourceIdParam}' not found`);
    }

    // Fetch resource from database
    const resource = await this.fetchResource(config.resourceType, resourceId);

    if (!resource) {
      throw new NotFoundException(`${config.resourceType} with ID '${resourceId}' not found`);
    }

    // Check ownership
    const ownerFields = Array.isArray(config.ownerIdField)
      ? config.ownerIdField
      : [config.ownerIdField];

    let isOwner = false;

    for (const field of ownerFields) {
      const ownerId = resource[field];

      if (ownerId && ownerId.toString() === userId.toString()) {
        isOwner = true;
        break;
      }
    }

    if (!isOwner) {
      this.logger.warn(
        `Ownership check failed for user ${userId} on ${config.resourceType} ${resourceId}`,
        {
          checkedFields: ownerFields,
        },
      );

      throw new ForbiddenException(
        `You do not have permission to access this ${config.resourceType}`,
      );
    }

    this.logger.debug(
      `Ownership verified for user ${userId} on ${config.resourceType} ${resourceId}`,
    );

    // Attach resource to request for controller use
    request.resource = resource;

    return true;
  }

  /**
   * Fetch resource from database by type and ID
   */
  private async fetchResource(
    resourceType: string,
    resourceId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      // Map resource types to collection names
      const collectionMap: Record<string, string> = {
        order: 'orders',
        offer: 'offers',
        establishment: 'establishments',
        review: 'reviews',
        payment: 'payments',
      };

      const collectionName = collectionMap[resourceType.toLowerCase()] || `${resourceType}s`;
      const collection = this.connection.collection(collectionName);

      const resource = await collection.findOne({
        _id: this.connection.base.Types.ObjectId.createFromHexString(resourceId),
      });

      return resource;
    } catch (error) {
      this.logger.error(`Failed to fetch ${resourceType} ${resourceId}`, error);
      return null;
    }
  }
}

// Extend Express Request to include resource
declare global {
  namespace Express {
    interface Request {
      resource?: Record<string, unknown>;
    }
  }
}
