import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';

import { INotificationAnalytics, NotificationMetrics } from '../interfaces/notification.interfaces';
import { Notification } from '../schemas/notification.schema';

@Injectable()
export class NotificationAnalyticsService implements INotificationAnalytics {
  private readonly logger = new Logger(NotificationAnalyticsService.name);

  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('notification.sent')
  async handleNotificationSent(payload: {
    notificationId: string;
    type: string;
    trigger: string;
    success: boolean;
    userId?: string;
  }) {
    await this.track('sent', payload.notificationId, {
      type: payload.type,
      trigger: payload.trigger,
      success: payload.success,
      userId: payload.userId,
    });
  }

  @OnEvent('notification.delivered')
  async handleNotificationDelivered(payload: {
    notificationId: string;
    deliveredAt: Date;
    metadata?: Record<string, unknown>;
  }) {
    await this.track('delivered', payload.notificationId, {
      deliveredAt: payload.deliveredAt,
      ...payload.metadata,
    });
  }

  @OnEvent('notification.opened')
  async handleNotificationOpened(payload: {
    notificationId: string;
    openedAt: Date;
    userId?: string;
  }) {
    await this.track('opened', payload.notificationId, {
      openedAt: payload.openedAt,
      userId: payload.userId,
    });
  }

  @OnEvent('notification.clicked')
  async handleNotificationClicked(payload: {
    notificationId: string;
    clickedAt: Date;
    clickAction?: string;
    userId?: string;
  }) {
    await this.track('clicked', payload.notificationId, {
      clickedAt: payload.clickedAt,
      clickAction: payload.clickAction,
      userId: payload.userId,
    });
  }

  async track(
    event: string,
    notificationId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      this.logger.log(`Tracking ${event} for notification ${notificationId}`, metadata);

      // Update notification record with tracking data
      const updateData: UpdateQuery<Notification> = {};

      switch (event) {
        case 'delivered':
          updateData.deliveredAt = metadata?.['deliveredAt'] || new Date();
          updateData.status = 'delivered';
          break;
        case 'opened':
        case 'read':
          updateData.readAt = metadata?.['openedAt'] || new Date();
          updateData.isRead = true;
          updateData.status = 'read';
          break;
        case 'clicked':
          if (!updateData.readAt) {
            updateData.readAt = metadata?.['clickedAt'] || new Date();
            updateData.isRead = true;
          }
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await this.notificationModel.updateOne(
          { _id: notificationId },
          {
            ...updateData,
            $push: {
              'metadata.trackingEvents': {
                event,
                timestamp: new Date(),
                ...metadata,
              },
            },
          },
        );
      }

      // Emit event for real-time analytics if needed
      this.eventEmitter.emit('analytics.tracked', {
        event,
        notificationId,
        metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to track ${event} for notification ${notificationId}:`, error);
    }
  }

  async getMetrics(timeRange: { from: Date; to: Date }): Promise<NotificationMetrics> {
    try {
      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: timeRange.from,
              $lte: timeRange.to,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSent: {
              $sum: {
                $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0],
              },
            },
            totalDelivered: {
              $sum: {
                $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0],
              },
            },
            totalFailed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
              },
            },
            totalOpened: {
              $sum: {
                $cond: [{ $eq: ['$isRead', true] }, 1, 0],
              },
            },
            byChannel: {
              $push: {
                channel: '$channel',
                type: '$type',
                status: '$status',
                isRead: '$isRead',
              },
            },
            byTrigger: {
              $push: {
                trigger: '$trigger',
                status: '$status',
                isRead: '$isRead',
              },
            },
          },
        },
      ];

      const result = await this.notificationModel.aggregate(pipeline);

      if (result.length === 0) {
        return this.getEmptyMetrics();
      }

      const data = result[0];

      // Process channel statistics
      const byChannel = this.processGroupedStats(data.byChannel, 'channel');
      const byTrigger = this.processGroupedStats(data.byTrigger, 'trigger');

      // Calculate rates
      const deliveryRate =
        data.totalSent > 0
          ? Math.round((data.totalDelivered / data.totalSent) * 100 * 100) / 100
          : 0;

      const openRate =
        data.totalDelivered > 0
          ? Math.round((data.totalOpened / data.totalDelivered) * 100 * 100) / 100
          : 0;

      return {
        totalSent: data.totalSent,
        totalDelivered: data.totalDelivered,
        totalFailed: data.totalFailed,
        totalOpened: data.totalOpened,
        totalClicked: 0, // Would need additional tracking for clicks
        deliveryRate,
        openRate,
        clickRate: 0, // Would need additional tracking for clicks
        byChannel,
        byTrigger,
      };
    } catch (error) {
      this.logger.error('Failed to get notification metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  async getChannelMetrics(
    channel: string,
    timeRange: { from: Date; to: Date },
  ): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    deliveryRate: number;
    openRate: number;
  }> {
    const pipeline = [
      {
        $match: {
          channel,
          createdAt: {
            $gte: timeRange.from,
            $lte: timeRange.to,
          },
        },
      },
      {
        $group: {
          _id: null,
          sent: {
            $sum: {
              $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0],
            },
          },
          delivered: {
            $sum: {
              $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
            },
          },
          opened: {
            $sum: {
              $cond: [{ $eq: ['$isRead', true] }, 1, 0],
            },
          },
        },
      },
    ];

    const result = await this.notificationModel.aggregate(pipeline);

    if (result.length === 0) {
      return { sent: 0, delivered: 0, failed: 0, opened: 0, deliveryRate: 0, openRate: 0 };
    }

    const data = result[0];
    const deliveryRate =
      data.sent > 0 ? Math.round((data.delivered / data.sent) * 100 * 100) / 100 : 0;
    const openRate =
      data.delivered > 0 ? Math.round((data.opened / data.delivered) * 100 * 100) / 100 : 0;

    return {
      ...data,
      deliveryRate,
      openRate,
    };
  }

  async getTriggerMetrics(
    trigger: string,
    timeRange: { from: Date; to: Date },
  ): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    deliveryRate: number;
    openRate: number;
  }> {
    const pipeline = [
      {
        $match: {
          trigger,
          createdAt: {
            $gte: timeRange.from,
            $lte: timeRange.to,
          },
        },
      },
      {
        $group: {
          _id: null,
          sent: {
            $sum: {
              $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0],
            },
          },
          delivered: {
            $sum: {
              $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
            },
          },
          opened: {
            $sum: {
              $cond: [{ $eq: ['$isRead', true] }, 1, 0],
            },
          },
        },
      },
    ];

    const result = await this.notificationModel.aggregate(pipeline);

    if (result.length === 0) {
      return { sent: 0, delivered: 0, failed: 0, opened: 0, deliveryRate: 0, openRate: 0 };
    }

    const data = result[0];
    const deliveryRate =
      data.sent > 0 ? Math.round((data.delivered / data.sent) * 100 * 100) / 100 : 0;
    const openRate =
      data.delivered > 0 ? Math.round((data.opened / data.delivered) * 100 * 100) / 100 : 0;

    return {
      ...data,
      deliveryRate,
      openRate,
    };
  }

  async getTimeSeriesMetrics(
    timeRange: { from: Date; to: Date },
    groupBy: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<
    Array<{
      period: string;
      sent: number;
      delivered: number;
      failed: number;
      opened: number;
    }>
  > {
    const groupStage = this.getTimeGroupStage(groupBy);

    // Define pipeline with proper MongoDB typing
    const matchStage = {
      $match: {
        createdAt: {
          $gte: timeRange.from,
          $lte: timeRange.to,
        },
      },
    };

    const groupStage_pipeline = {
      $group: {
        _id: groupStage,
        sent: {
          $sum: {
            $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0],
          },
        },
        delivered: {
          $sum: {
            $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0],
          },
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
          },
        },
        opened: {
          $sum: {
            $cond: [{ $eq: ['$isRead', true] }, 1, 0],
          },
        },
      },
    };

    const sortStage = {
      $sort: { _id: 1 as const },
    };

    const projectStage = {
      $project: {
        period: '$_id',
        sent: 1 as const,
        delivered: 1 as const,
        failed: 1 as const,
        opened: 1 as const,
        _id: 0 as const,
      },
    };

    const pipeline = [matchStage, groupStage_pipeline, sortStage, projectStage];

    const metrics = await this.notificationModel.aggregate(pipeline).exec();
    return metrics;
  }

  private processGroupedStats(
    data: Array<{ status: string; isRead?: boolean; [key: string]: unknown }>,
    groupField: string,
  ): Record<
    string,
    { sent: number; delivered: number; failed: number; opened: number; clicked: number }
  > {
    const stats: Record<
      string,
      { sent: number; delivered: number; failed: number; opened: number; clicked: number }
    > = {};

    data.forEach((item) => {
      const key = item[groupField] as string;
      if (!stats[key]) {
        stats[key] = { sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 };
      }

      if (['sent', 'delivered', 'read'].includes(item.status)) {
        stats[key].sent++;
      }
      if (['delivered', 'read'].includes(item.status)) {
        stats[key].delivered++;
      }
      if (item.status === 'failed') {
        stats[key].failed++;
      }
      if (item.isRead) {
        stats[key].opened++;
      }
    });

    return stats;
  }

  private getTimeGroupStage(
    groupBy: string,
  ): Record<
    string,
    { $year?: string; $month?: string; $dayOfMonth?: string; $hour?: string; $week?: string }
  > {
    switch (groupBy) {
      case 'hour':
        return {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' },
        };
      case 'day':
        return {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
      case 'week':
        return {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
      case 'month':
        return {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
      default:
        return {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
    }
  }

  private getEmptyMetrics(): NotificationMetrics {
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalOpened: 0,
      totalClicked: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      byChannel: {},
      byTrigger: {},
    };
  }
}
