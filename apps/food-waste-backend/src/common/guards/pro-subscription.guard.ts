import { UserRole } from '@foodwaste/shared';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Establishment } from '../../establishments/schemas/establishment.schema';

interface ProGuardUser {
  userId: string;
  role: string;
  assignedEstablishmentId?: string;
}

@Injectable()
export class ProSubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(ProSubscriptionGuard.name);

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<Establishment>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: ProGuardUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
      return true;
    }

    if (user.role === UserRole.CONSUMER) {
      return true;
    }

    let establishment: { subscriptionTier?: string } | null = null;

    if (user.role === UserRole.LOCATION_MANAGER && user.assignedEstablishmentId) {
      establishment = await this.establishmentModel
        .findById(new Types.ObjectId(user.assignedEstablishmentId))
        .select('subscriptionTier')
        .lean();
    } else {
      establishment = await this.establishmentModel
        .findOne({ ownerId: new Types.ObjectId(user.userId) })
        .select('subscriptionTier')
        .lean();
    }

    if (establishment?.subscriptionTier !== 'pro') {
      this.logger.warn(
        `Pro feature access denied for user ${user.userId} (tier: ${establishment?.subscriptionTier ?? 'none'})`,
      );
      throw new ForbiddenException(
        'This feature requires a Pro subscription. Please upgrade your plan.',
      );
    }

    return true;
  }
}
