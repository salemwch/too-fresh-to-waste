import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';

import { UserRegisteredEvent } from '../../common/events';
import { EstablishmentsService } from '../establishments.service';

@Injectable()
export class UserRegistrationListener {
  private readonly logger = new Logger(UserRegistrationListener.name);

  constructor(private readonly establishmentsService: EstablishmentsService) {}

  @OnEvent('user.registered')
  async handleUserRegisteredLegacy(event: UserRegisteredEvent): Promise<void> {
    await this.processUserRegistration(event);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'user.registered',
    queue: 'foodwaste.establishments.user-registered',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleUserRegisteredRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(UserRegisteredEvent, msg);
      await this.processUserRegistration(event);
    } catch (error) {
      this.logger.error('RabbitMQ: Failed to process user.registered event', error);
      return new Nack(true);
    }
  }

  private async processUserRegistration(event: UserRegisteredEvent): Promise<void> {
    try {
      if (event.role !== 'merchant' || !event.businessInfo) {
        return;
      }

      await this.establishmentsService.createFromSignup(
        event.businessInfo,
        event.userId,
        event.email,
        event.phoneNumber,
      );

      this.logger.log(`Establishment created from signup event for merchant: ${event.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to create establishment from signup event for user ${event.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
