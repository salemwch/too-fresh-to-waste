import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { NotificationGateway } from './gateways/notification.gateway';
import { OrderGateway } from './gateways/order.gateway';
import { OfferGateway } from './gateways/offer.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is required');
        }
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '15m');
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as any,
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
  exports: [
    WebSocketService,
    NotificationGateway,
    OrderGateway,
    OfferGateway,
  ],
})
export class WebSocketModule {}