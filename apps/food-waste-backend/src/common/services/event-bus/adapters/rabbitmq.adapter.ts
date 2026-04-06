import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IEventBus } from '../event-bus.interface';

/**
 * RabbitMQ Event Bus Adapter
 *
 * Publishes events to RabbitMQ message broker with:
 * - Persistent messages (survive broker restart)
 * - JSON serialization (dates → ISO strings)
 * - Topic exchange routing
 * - Automatic error handling and logging
 *
 * @see IEventBus
 */
@Injectable()
export class RabbitMQAdapter implements IEventBus {
  private readonly logger = new Logger(RabbitMQAdapter.name);
  private readonly exchange: string;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService,
  ) {
    this.exchange = this.configService.get<string>('RABBITMQ_EXCHANGE', 'foodwaste.events');
  }

  /**
   * Publish event to RabbitMQ
   *
   * @param eventName - Routing key (e.g., 'admin.user.suspended')
   * @param payload - Event data (will be JSON serialized)
   * @throws Error if publish fails
   */
  async emit(eventName: string, payload: object): Promise<void> {
    try {
      // Serialize: Convert Date objects to ISO strings for safe JSON transport
      const serialized = this.serializePayload(payload);

      await this.amqpConnection.publish(this.exchange, eventName, serialized, {
        persistent: true, // Survive broker restart
        contentType: 'application/json',
        timestamp: Date.now(),
      });

      this.logger.debug(`Published event to RabbitMQ: ${eventName}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish event ${eventName} to RabbitMQ`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private serializePayload(payload: object): unknown {
    const serialized: unknown = JSON.parse(JSON.stringify(payload));
    return serialized;
  }
}
