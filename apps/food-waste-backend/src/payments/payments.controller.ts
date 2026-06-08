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
  BadRequestException,
  Headers,
  Logger,
  Res,
  RawBodyRequest,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthenticatedRequest } from 'src/common/decorators/get-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AppVersionGuard } from 'src/common/guards/app-version.guard';

import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { ProcessRefundDto } from './dto/proccess-refund.dto';
import { SMTWebhookPayloadDto } from './dto/webhook-payload.dto';
import { PaymentService } from './payments.service';

import type { Request as ExpressRequest, Response } from 'express';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  private readonly logger = new Logger(Controller.name);

  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({
    summary: 'Create a payment',
    description: 'Initiate a payment for an order using SMT Tunisia payment gateway',
  })
  @ApiBody({
    type: CreatePaymentDto,
    description: 'Payment details including order ID and payment method',
  })
  @ApiResponse({ status: 201, description: 'Payment initiated successfully with redirect URL' })
  @ApiResponse({ status: 400, description: 'Invalid payment data or order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Consumer access required' })
  @Post()
  @UseGuards(AppVersionGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CONSUMER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    try {
      const payment = await this.paymentService.createPayment(createPaymentDto, req.user.userId);

      return res.status(HttpStatus.CREATED).json({
        statusCode: HttpStatus.CREATED,
        message: 'Payment initiated successfully',
        data: {
          transactionId: payment.transactionId,
          merchantTransactionId: payment.merchantTransactionId,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          redirectUrl: payment.smtResponse?.redirectUrl,
        },
      });
    } catch (error) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Failed to initiate payment',
        error: (error as Error).message || 'Internal server error',
      });
    }
  }

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

  @ApiOperation({
    summary: 'Process payment refund',
    description: 'Admin endpoint to process a refund for a payment',
  })
  @ApiBody({
    type: ProcessRefundDto,
    description: 'Refund details including payment ID and amount',
  })
  @ApiResponse({ status: 200, description: 'Refund processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid refund request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Post('refund')
  @UseGuards(AppVersionGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async processRefund(
    @Body() processRefundDto: ProcessRefundDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const payment = await this.paymentService.processRefund(processRefundDto, req.user.userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Refund processed successfully',
      data: {
        transactionId: payment.transactionId,
        status: payment.status,
        refundedAmount: payment.refundedAmount,
        totalAmount: payment.amount,
      },
    };
  }

  @ApiOperation({
    summary: 'Payment webhook endpoint',
    description:
      'Public endpoint for SMT Tunisia payment gateway webhooks. Verifies signature and processes payment status updates.',
  })
  @ApiBody({ type: SMTWebhookPayloadDto, description: 'SMT webhook payload' })
  @ApiHeader({
    name: 'x-smt-signature',
    description: 'Webhook signature for verification',
    required: true,
  })
  @ApiHeader({ name: 'x-smt-timestamp', description: 'Webhook timestamp', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Missing required webhook headers or invalid signature',
  })
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() webhookPayload: SMTWebhookPayloadDto,
    @Headers('x-smt-signature') signature: string,
    @Headers('x-smt-timestamp') timestamp: string,
    @Request() req: RawBodyRequest<ExpressRequest>,
  ) {
    if (!signature || !timestamp) {
      throw new BadRequestException('Missing required webhook headers');
    }

    // Use raw body bytes for HMAC signature verification (not JSON.stringify)
    // JSON.stringify may reorder keys or change formatting, breaking the signature
    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('Raw body not available for webhook signature verification');
      throw new BadRequestException('Unable to verify webhook signature');
    }

    await this.paymentService.handleWebhook(
      webhookPayload,
      signature,
      timestamp,
      rawBody.toString('utf-8'),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Webhook processed successfully',
    };
  }
  @ApiOperation({
    summary: 'Retry failed webhooks',
    description: 'Admin endpoint to retry processing of failed payment webhooks',
  })
  @ApiResponse({ status: 200, description: 'Failed webhooks retry completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @Post('retry-webhooks')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async retryFailedWebhooks() {
    const retriedCount = await this.paymentService.retryFailedWebhooks();

    return {
      statusCode: HttpStatus.OK,
      message: 'Failed webhooks retry completed',
      data: {
        retriedCount,
      },
    };
  }
}
