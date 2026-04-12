import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DynamicModule, Module } from '@nestjs/common';

/**
 * RabbitMQ Module
 *
 * Conditionally registers the message broker based on RABBITMQ_ENABLED.
 * When disabled (default), returns an empty module so the app starts cleanly
 * without a running RabbitMQ instance. EventBusService falls back to
 * EventEmitter2 for all events.
 *
 * Environment variables:
 * - RABBITMQ_ENABLED=true  → registers golevelup connection
 * - RABBITMQ_ENABLED=false → no-op module (default)
 *
 * @see https://github.com/golevelup/nestjs/tree/master/packages/rabbitmq
 */
@Module({})
export class RabbitMQModule {
  static forRoot(): DynamicModule {
    const enabled = process.env['RABBITMQ_ENABLED'] === 'true';
    const uri = process.env['RABBITMQ_URL'] ?? '';

    if (!enabled || !uri) {
      // Return empty module — no connection attempted, no crash.
      return { module: RabbitMQModule };
    }

    return {
      module: RabbitMQModule,
      imports: [
        GolevelupRabbitMQModule.forRoot({
          uri,
          connectionInitOptions: { wait: false }, // Non-blocking — app starts even if broker is slow
          exchanges: [
            {
              name: process.env['RABBITMQ_EXCHANGE'] ?? 'foodwaste.events',
              type: 'topic',
              options: { durable: true },
            },
            {
              name: 'foodwaste.dlx', // Dead Letter Exchange
              type: 'topic',
              options: { durable: true },
            },
          ],
          prefetchCount: Number.parseInt(process.env['RABBITMQ_PREFETCH_COUNT'] ?? '10', 10),
          enableControllerDiscovery: true,
        }),
      ],
      exports: [GolevelupRabbitMQModule],
    };
  }
}
