import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UserRole } from '@foodwaste/shared';
import { Notification } from '../../notifications/schemas/notification.schema';
import { User } from '../../users/schemas/user.schema';
import { NotificationService } from '../../notifications/services/notification.service';
import { ISendNotificationRequest } from '../../notifications/interfaces/notification.interfaces';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AdminNotificationStats {
  totalSent: number;
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  deliveryRate: number;
  channelBreakdown: Array<{ channel: string; count: number }>;
}

export interface AdminBroadcastPayload {
  title: string;
  body: string;
  targetSegment: 'all' | 'consumers' | 'merchants';
  channel: 'push' | 'in_app' | 'both';
}

export interface AdminBroadcastResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationManagementService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly notificationService: NotificationService,
  ) {}

  async getNotificationStats(): Promise<AdminNotificationStats> {
    const [statusAgg, channelAgg] = await Promise.all([
      this.notificationModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.notificationModel.aggregate([{ $group: { _id: '$channel', count: { $sum: 1 } } }]),
    ]);

    const statusMap: Record<string, number> = {};
    for (const item of statusAgg) {
      statusMap[item._id] = item.count;
    }

    const totalSent =
      (statusMap['sent'] ?? 0) + (statusMap['delivered'] ?? 0) + (statusMap['read'] ?? 0);
    const deliveredCount = (statusMap['delivered'] ?? 0) + (statusMap['read'] ?? 0);
    const failedCount = statusMap['failed'] ?? 0;
    const pendingCount = statusMap['pending'] ?? 0;
    const deliveryRate = totalSent > 0 ? Math.round((deliveredCount / totalSent) * 100) : 0;

    return {
      totalSent,
      deliveredCount,
      failedCount,
      pendingCount,
      deliveryRate,
      channelBreakdown: channelAgg.map(c => ({ channel: c._id, count: c.count })),
    };
  }

  async sendBroadcast(payload: AdminBroadcastPayload): Promise<AdminBroadcastResult> {
    const roleFilter =
      payload.targetSegment === 'consumers'
        ? { role: UserRole.CONSUMER }
        : payload.targetSegment === 'merchants'
          ? { role: UserRole.MERCHANT }
          : {};

    const users = await this.userModel
      .find({ isActive: true, ...roleFilter })
      .select('_id')
      .lean();

    const types: Array<'push' | 'in_app'> =
      payload.channel === 'both' ? ['push', 'in_app'] : [payload.channel];

    const requests: ISendNotificationRequest[] = users.flatMap(user =>
      types.map(type => ({
        type,
        trigger: 'admin_broadcast',
        target: { userId: user._id.toString() },
        payload: { title: payload.title, body: payload.body },
        priority: 'medium' as const,
        metadata: { segment: payload.targetSegment, campaign: 'admin_broadcast' },
      })),
    );

    if (requests.length === 0) {
      return { totalProcessed: 0, successCount: 0, failureCount: 0 };
    }

    const results = await this.notificationService.sendBulkNotification(requests);
    return {
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
    };
  }
}
