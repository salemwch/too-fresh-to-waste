import { UserRole } from '@foodwaste/shared';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { appError } from '../../common/errors';
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
      throw new UnauthorizedException(appError('AUTH_REQUIRED'));
    }

    const allowedRoles = [UserRole.ADMIN, UserRole.MODERATOR];
    const userRole = user.role;

    if (userRole === null || userRole === undefined || !allowedRoles.includes(userRole)) {
      throw new ForbiddenException(appError('MODERATOR_REQUIRED'));
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
      throw new UnauthorizedException(appError('AUTH_REQUIRED'));
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(appError('ADMIN_REQUIRED'));
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
      throw new UnauthorizedException(appError('AUTH_REQUIRED'));
    }

    // Admins have full access
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // For moderators, we'll check ownership in the service layer
    // This guard just ensures they have moderation access
    if (user.role !== UserRole.MODERATOR) {
      throw new ForbiddenException(appError('MODERATOR_REQUIRED'));
    }

    return true;
  }
}
