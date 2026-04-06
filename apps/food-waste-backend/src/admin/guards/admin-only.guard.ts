import { UserRole } from '@foodwaste/shared';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthUser } from '../../common/decorators/get-user.decorator';

interface AdminRequest {
  user?: AuthUser;
}

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const user = request.user;

    if (user === null || user === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
