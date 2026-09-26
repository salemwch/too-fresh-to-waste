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
import { MerchantCommissionService } from './services/merchant-commission.service';
import { KonnectOrderService } from './services/konnect-order.service';

import type { Response } from 'express';
import { strictValidation } from '../common/pipes/validation-pipes';

/**
 * An unparseable date silently becomes "all time" rather than throwing at a
 * merchant who never typed it - the query string is not their input.
 */
function parseStatementDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly merchantCommissionService: MerchantCommissionService,
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
    @Query(strictValidation()) filters: PaymentQueryDto,
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
    @Query(strictValidation()) filters: PaymentQueryDto,
  ) {
    const result = await this.paymentService.findMerchantPaymentsFromOrders(
      req.user.userId,
      filters ?? {},
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Your payments retrieved successfully',
      data: {
        payments: result.payments,
        hasMore: result.hasMore,
        ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
      },
    };
  }

  @ApiOperation({
    summary: 'Your commission statement for the current month',
    description:
      'Sold, commission and received for the period, plus the outstanding balance. ' +
      'The merchant is credited the full price on most orders; the commission accrues ' +
      'and settles from occasional later orders. The monthly totals reconcile to the ' +
      'flat rate regardless.',
  })
  @ApiParam({ name: 'establishmentId', type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Commission statement retrieved' })
  @ApiResponse({ status: 403, description: 'Not your establishment' })
  @Get('my-commission/:establishmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  async getMyCommission(
    @Request() req: AuthenticatedRequest,
    @Param('establishmentId') establishmentId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.merchantCommissionService.getStatement(
      establishmentId,
      req.user.userId,
      parseStatementDate(from),
      parseStatementDate(to),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Commission statement retrieved successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Your commission statement for the current month, across all your establishments',
    description:
      'The "All locations" view of my-commission/:establishmentId. Sold, commission and ' +
      'received are summed; the outstanding balance is also broken down per establishment ' +
      'in dueByEstablishment, so the total never hides which location carries it.',
  })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Commission statement retrieved' })
  @Get('my-commission')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  async getMyCommissionAllLocations(
    @Request() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const data = await this.merchantCommissionService.getStatement(
      undefined,
      req.user.userId,
      parseStatementDate(from),
      parseStatementDate(to),
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Commission statement retrieved successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Get my wallet balance',
    description:
      'Available and pending payout balance for the authenticated merchant, summed across all establishments unless establishmentId is given.',
  })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    type: String,
    description: 'Scope to a single establishment',
  })
  @ApiResponse({ status: 200, description: 'Wallet balance retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Merchant access required' })
  @Get('my-wallet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT)
  async getMyWallet(
    @Request() req: AuthenticatedRequest,
    @Query('establishmentId') establishmentId?: string,
  ) {
    const wallet = await this.paymentService.getMyWallet(req.user.userId, establishmentId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Wallet balance retrieved successfully',
      data: wallet,
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
    @Query(strictValidation()) filters: PaymentQueryDto,
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
      const stats =
        req.user.role === UserRole.MERCHANT
          ? await this.paymentService.getMerchantPaymentStatsFromOrders(req.user.userId)
          : await this.paymentService.getPaymentStats(req.user.userId, req.user.role);

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
