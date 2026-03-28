import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';

import { NotificationGateway } from './gateways/notification.gateway';
import { OfferGateway } from './gateways/offer.gateway';
import { OrderGateway } from './gateways/order.gateway';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is required');
        }
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '15m') as NonNullable<
          JwtSignOptions['expiresIn']
        >;
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    WebSocketGateway,
    WebSocketService,
    WebSocketAuthGuard,
    NotificationGateway,
    OrderGateway,
    OfferGateway,
  ],
  exports: [WebSocketService, NotificationGateway, OrderGateway, OfferGateway],
})
export class WebSocketModule {}
