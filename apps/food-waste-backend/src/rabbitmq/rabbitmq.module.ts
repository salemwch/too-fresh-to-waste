import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * RabbitMQ Module
 *
 * Configures the message broker for event-driven architecture:
 * - Main exchange: foodwaste.events (topic exchange)
 * - Dead Letter Exchange: foodwaste.dlx (for failed messages)
 * - Persistent messages: Survive broker restarts
 * - Prefetch control: Backpressure management
 *
 * @see https://github.com/golevelup/nestjs/tree/master/packages/rabbitmq
 */
@Module({
  imports: [
    GolevelupRabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672'),
        connectionInitOptions: { wait: true },
        exchanges: [
          {
            name: configService.get<string>('RABBITMQ_EXCHANGE', 'foodwaste.events'),
            type: 'topic',
            options: {
              durable: true, // Survive broker restart
            },
          },
          {
            name: 'foodwaste.dlx', // Dead Letter Exchange
            type: 'topic',
            options: { durable: true },
          },
        ],
        prefetchCount: parseInt(configService.get<string>('RABBITMQ_PREFETCH_COUNT', '10'), 10),
        enableControllerDiscovery: true,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [GolevelupRabbitMQModule],
})
export class RabbitMQModule {}
