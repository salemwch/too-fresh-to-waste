import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IEventBus } from '../event-bus.interface';

/**
 * EventEmitter2 Adapter (Legacy)
 *
 * In-memory event bus for:
 * - Development environments
 * - Fallback during RabbitMQ migration
 * - Events not yet migrated to RabbitMQ
 *
 * Limitations:
 * - Events lost on server crash
 * - No horizontal scaling support
 * - No message persistence
 *
 * @see IEventBus
 */
@Injectable()
export class EventEmitter2Adapter implements IEventBus {
  private readonly logger = new Logger(EventEmitter2Adapter.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publish event to in-memory EventEmitter2
   *
   * @param eventName - Event name (e.g., 'admin.user.suspended')
   * @param payload - Event data
   */
  async emit(eventName: string, payload: object): Promise<void> {
    this.eventEmitter.emit(eventName, payload);
    this.logger.debug(`Published event to EventEmitter2: ${eventName}`);
  }
}
