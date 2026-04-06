import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { minimatch } from 'minimatch';

import { EventEmitter2Adapter } from './adapters/eventemitter2.adapter';
import { RabbitMQAdapter } from './adapters/rabbitmq.adapter';
import { IEventBus } from './event-bus.interface';

/**
 * Event Bus Service (Master Router)
 *
 * Routes events to RabbitMQ or EventEmitter2 based on feature flags.
 *
 * Configuration (environment variables):
 * - RABBITMQ_ENABLED: Global enable/disable switch
 * - RABBITMQ_ENABLED_EVENTS: Comma-separated glob patterns
 *
 * Migration Strategy:
 * 1. Start: RABBITMQ_ENABLED=false (all events → EventEmitter2)
 * 2. Test: RABBITMQ_ENABLED=true, RABBITMQ_ENABLED_EVENTS=admin.user.suspended
 * 3. Expand: RABBITMQ_ENABLED_EVENTS=admin.user.*,admin.establishment.*
 * 4. Full: RABBITMQ_ENABLED_EVENTS=*
 *
 * Rollback: Set RABBITMQ_ENABLED=false (instant, no code changes)
 *
 * @example
 * // In service
 * constructor(private readonly eventBus: EventBusService) {}
 *
 * async suspendUser(userId: string) {
 *   // ... business logic
 *   await this.eventBus.emit('admin.user.suspended', {
 *     userId,
 *     timestamp: new Date(),
 *   });
 * }
 */
@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);
  private readonly enabledEvents: string[];
  private readonly rabbitMQEnabled: boolean;

  constructor(
    private readonly rabbitMQAdapter: RabbitMQAdapter,
    private readonly eventEmitter2Adapter: EventEmitter2Adapter,
    private readonly configService: ConfigService,
  ) {
    this.rabbitMQEnabled = this.configService.get<string>('RABBITMQ_ENABLED', 'false') === 'true';
    const eventsConfig = this.configService.get<string>('RABBITMQ_ENABLED_EVENTS', '');
    this.enabledEvents = eventsConfig
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    this.logger.log(
      `EventBusService initialized: RabbitMQ=${this.rabbitMQEnabled}, Events=${this.enabledEvents.join(',') || 'none'}`,
    );
  }

  /**
   * Emit event to RabbitMQ or EventEmitter2 based on configuration
   *
   * Routing logic:
   * 1. If RABBITMQ_ENABLED=false → EventEmitter2 (all events)
   * 2. If RABBITMQ_ENABLED_EVENTS=* → RabbitMQ (all events)
   * 3. If event matches pattern → RabbitMQ
   * 4. Otherwise → EventEmitter2
   *
   * @param eventName - Event name (e.g., 'admin.user.suspended')
   * @param payload - Event payload (must be JSON serializable)
   */
  async emit(eventName: string, payload: object): Promise<void> {
    const useRabbitMQ = this.shouldUseRabbitMQ(eventName);

    if (useRabbitMQ) {
      await this.rabbitMQAdapter.emit(eventName, payload);
    } else {
      await this.eventEmitter2Adapter.emit(eventName, payload);
    }
  }

  /**
   * Determine if event should use RabbitMQ based on feature flags
   *
   * Pattern matching examples:
   * - 'admin.*' matches 'admin.user.suspended', 'admin.establishment.approved'
   * - 'admin.user.*' matches 'admin.user.suspended', 'admin.user.blocked'
   * - '*' matches all events
   * - 'admin.user.suspended' matches exact event only
   *
   * @param eventName - Event name to check
   * @returns true if event should use RabbitMQ
   */
  private shouldUseRabbitMQ(eventName: string): boolean {
    if (!this.rabbitMQEnabled) {
      return false; // RabbitMQ globally disabled
    }

    if (this.enabledEvents.includes('*')) {
      return true; // All events enabled
    }

    // Match event against patterns (e.g., 'admin.*', 'admin.user.suspended')
    return this.enabledEvents.some((pattern) => minimatch(eventName, pattern));
  }
}
