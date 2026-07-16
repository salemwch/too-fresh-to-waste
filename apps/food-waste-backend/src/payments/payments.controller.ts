import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Logger,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthenticatedRequest } from 'src/common/decorators/get-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';

import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaymentService } from './payments.service';
import { KonnectOrderService } from './services/konnect-order.service';

import type { Response } from 'express';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly konnectOrderService: KonnectOrderService,
  ) {}

  @ApiOperation({
    summary: 'Get all payments (Admin only)',
    description: 'Retrieve paginated list of all payments using cursor-based pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (max: 10)',
  })
  @ApiQuery({ name: 'after', required: false, type: String, description: 'Cursor for pagination' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Get('all-payments-cursor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAllCursor(
    @Request() req: AuthenticatedRequest,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) filters: PaymentQueryDto,
  ) {
    const limit = Math.min(filters.limit ?? 10, 10);
    const after = filters.after;
    const result = await this.paymentService.findAllCursor(
      limit,
      after,
      filters ?? {},
      req.user.userId,
      req.user.role,
    );

    return {
      statusCode: 200,
      message: 'Payments retrieved successfully',
      data: result.payments,
      meta: {
        limit,
        nextCursor: result.nextCursor ?? null,
      },
    };
  }

  @ApiOperation({
    summary: 'Get merchant payments',
    description: 'Retrieve paginated list of payments for the authenticated merchant',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (max: 10)',
  })
  @ApiQuery({ name: 'after', required: false, type: String, description: 'Cursor for pagination' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Merchant access required' })
  @Get('my-merchant-payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  async getMyPayments(
    @Request() req: AuthenticatedRequest,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) filters: PaymentQueryDto,
  ) {
    this.logger.log({
      message: 'my-merchant-payments called',
      userId: req.user.userId,
      filters: {
        limit: filters.limit,
        after: filters.after,
        status: filters.status,
        minAmount: filters.minAmount,
        maxAmount: filters.maxAmount,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      },
    });

    const limit = Math.min(filters.limit ?? 10, 10);
    const after = filters.after;

    const result = await this.paymentService.findAllCursor(
      limit,
      after,
      filters ?? {},
      req.user.userId,
      UserRole.MERCHANT,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Your payments retrieved successfully',
      data: result.payments,
      meta: {
        limit,
        nextCursor: result.nextCursor ?? null,
      },
    };
  }
  @ApiOperation({
    summary: 'Get consumer payments',
    description: 'Retrieve paginated list of payments made by the authenticated consumer',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (max: 10)',
  })
  @ApiQuery({ name: 'after', required: false, type: String, description: 'Cursor for pagination' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Consumer access required' })
  @Get('my-consumer-payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CONSUMER)
  async getMyConsumerPayments(
    @Request() req: AuthenticatedRequest,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) filters: PaymentQueryDto,
  ) {
    const limit = Math.min(filters.limit ?? 10, 10);
    const after = filters.after;

    const result = await this.paymentService.findAllCursor(
      limit,
      after,
      filters ?? {},
      req.user.userId,
      UserRole.CONSUMER,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Your payments retrieved successfully',
      data: result.payments,
      meta: {
        limit,
        nextCursor: result.nextCursor ?? null,
      },
    };
  }

  @ApiOperation({
    summary: 'Get payment statistics',
    description: 'Retrieve payment statistics and analytics for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Payment statistics retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Unable to retrieve statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.MERCHANT, UserRole.ADMIN)
  async getPaymentStats(@Request() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      const stats = await this.paymentService.getPaymentStats(req.user.userId, req.user.role);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Payment statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      // Always log the error for debugging
      this.logger.error('Error fetching payment stats', error);

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to retrieve payment statistics',
      });
    }
  }

  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Retrieve detailed information about a specific payment',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the payment' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const payment = await this.paymentService.findById(id, req.user.userId, req.user.role);

    return {
      statusCode: HttpStatus.OK,
      message: 'Payment retrieved successfully',
      data: payment,
    };
  }

  // ==========================================================================
  // KONNECT ORDER PAYMENT WEBHOOKS
  // ==========================================================================

  @Get('webhook/konnect')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Konnect order payment callback (GET)' })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged' })
  async handleKonnectOrderWebhookGet(
    @Query('payment_ref') paymentRef: string,
  ): Promise<{ received: boolean }> {
    if (!paymentRef || typeof paymentRef !== 'string' || paymentRef.length > 100) {
      return { received: false };
    }
    try {
      await this.konnectOrderService.handleOrderWebhook(paymentRef);
    } catch (error) {
      this.logger.error(
        `Konnect webhook GET error for ref ${paymentRef}: ${(error as Error).message}`,
      );
    }
    return { received: true };
  }

  @Post('webhook/konnect')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Konnect order payment callback (POST, silentWebhook)' })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged' })
  async handleKonnectOrderWebhookPost(
    @Body() body: { payment_ref?: string },
  ): Promise<{ received: boolean }> {
    if (
      !body.payment_ref ||
      typeof body.payment_ref !== 'string' ||
      body.payment_ref.length > 100
    ) {
      return { received: false };
    }
    try {
      await this.konnectOrderService.handleOrderWebhook(body.payment_ref);
    } catch (error) {
      this.logger.error(
        `Konnect webhook POST error for ref ${body.payment_ref}: ${(error as Error).message}`,
      );
    }
    return { received: true };
  }
}
