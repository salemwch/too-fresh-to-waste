import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@foodwaste/shared';

import {
  InitiatePaymentResponseDto,
  InitiateSubscriptionDto,
  SubscriptionStatusResponseDto,
} from './dto/subscription.dto';
import { SubscriptionService } from './services/subscription.service';

interface AuthenticatedRequest {
  user: { userId: string; role: string };
}

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Get current subscription status for the merchant' })
  async getStatus(
    @Req() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<SubscriptionStatusResponseDto> {
    const result = await this.subscriptionService.getStatus(req.user.userId, establishmentId);
    return result;
  }

  @Post('initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Initiate a subscription payment via Konnect' })
  async initiatePayment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InitiateSubscriptionDto,
  ): Promise<InitiatePaymentResponseDto> {
    const result = await this.subscriptionService.initiatePayment(
      req.user.userId,
      dto.tier,
      dto.cycle,
      dto.establishmentId,
    );
    return result;
  }

  @Post('webhook/konnect')
  @ApiOperation({ summary: 'Konnect payment webhook (called by Konnect servers)' })
  async handleKonnectWebhook(
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: true }> {
    await this.subscriptionService.handleWebhook(payload);
    return { received: true };
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Verify a payment after Konnect redirect' })
  async verifyPayment(
    @Query('paymentRef') paymentRef: string,
  ): Promise<{ success: boolean; establishmentId?: string }> {
    const result = await this.subscriptionService.handlePaymentCallback(paymentRef);
    return result;
  }
}
