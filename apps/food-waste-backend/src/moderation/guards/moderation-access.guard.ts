import { UserRole } from '@foodwaste/shared';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface ModerationRequestUser {
  role?: UserRole;
  userId?: string;
}

interface ModerationRequest {
  user?: ModerationRequestUser;
  moderatorRole?: UserRole;
}

@Injectable()
export class ModerationAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    void this.reflector;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ModerationRequest>();
    const user = request.user;

    if (user === null || user === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    const allowedRoles = [UserRole.ADMIN, UserRole.MODERATOR];
    const userRole = user.role;

    if (userRole === null || userRole === undefined || !allowedRoles.includes(userRole)) {
      throw new ForbiddenException('Access denied. Admin or Moderator privileges required');
    }

    request.moderatorRole = userRole;

    return true;
  }
}

/**
 * Guard that ensures only admin users can access admin-only moderation features
 */
@Injectable()
export class AdminOnlyModerationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ModerationRequest>();
    const user = request.user;

    if (user === null || user === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin privileges required for this action');
    }

    return true;
  }
}

/**
 * Guard that ensures moderators can only modify their own assigned reports
 * Admins bypass this restriction
 */
@Injectable()
export class ReportOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ModerationRequest>();
    const user = request.user;

    if (user === null || user === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    // Admins have full access
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // For moderators, we'll check ownership in the service layer
    // This guard just ensures they have moderation access
    if (user.role !== UserRole.MODERATOR) {
      throw new ForbiddenException('Moderation privileges required');
    }

    return true;
  }
}
