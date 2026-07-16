import { UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  UseFilters,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import * as QRCode from 'qrcode';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppVersionGuard } from '../common/guards/app-version.guard';
import { QueryComplexityGuard, QueryComplexity } from '../common/guards/query-complexity.guard';
import { AppLoggerService } from '../common/services/logger.service';
import { QueryOptimizer } from '../common/utils/query-optimization.util';
import { KonnectOrderService } from '../payments/services/konnect-order.service';

import {
  CreateOrderDto,
  ConfirmPickupDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  OrderQueryDto,
} from './DTO/create-order.dto';
import { ConsumerOrderResponseDto, MerchantOrderResponseDto } from './DTO/order-response.dto';
import { PickupThrottlerGuard } from './guards/pickup-throttler.guard';
import {
  OrdersService,
  OrderStatsResponse,
  RevenueChartResponse,
  CustomerLocationResponse,
  type ChartGranularity,
} from './order.service';

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

/** Allowed granularity values — validated at the controller boundary. */
const VALID_GRANULARITIES = new Set<ChartGranularity>(['day', 'week', 'month']);

/** Maximum `value` allowed per granularity to prevent runaway aggregations. */
const CHART_LIMITS: Record<ChartGranularity, number> = { day: 90, week: 52, month: 24 };

/** Converts a Mongoose document to a primitive-only plain object.
 *  plainToInstance (class-transformer) constructs new instances for any class-typed
 *  value it encounters — e.g. ObjectId instances silently become freshly generated IDs.
 *  JSON.stringify triggers ObjectId.toJSON() → hex string, Date.toJSON() → ISO string,
 *  and JSON.parse returns a pure primitive object.  This is exactly what both
 *  plainToInstance and the eventual HTTP serialisation expect. */
const toPlain = (doc: unknown): unknown => JSON.parse(JSON.stringify(doc));

@Catch()
export class OrderExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Log full error details for debugging
    const errorMessage = exception instanceof Error ? exception.message : 'Unknown error';
    const errorStack = exception instanceof Error ? (exception.stack ?? '') : '';
    const errorResponse = exception instanceof BadRequestException ? exception.getResponse() : null;

    this.logger.error(
      `Order error: ${errorMessage}`,
      JSON.stringify({
        message: errorMessage,
        response: errorResponse,
        stack: errorStack,
      }),
      'OrderExceptionFilter',
    );

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ExpressResponse>();
    const request = ctx.getRequest<ExpressRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | Record<string, unknown> | string[] = 'Internal server error';
    let details: Record<string, unknown> | null = null;

    if (exception instanceof BadRequestException) {
      status = HttpStatus.BAD_REQUEST;
      const exceptionResponse = exception.getResponse() as Record<string, unknown> | string;
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse || 'Invalid order data';
      } else {
        message = (exceptionResponse['message'] as string | string[]) ?? 'Invalid order data';
        details =
          (exceptionResponse['code'] !== null && exceptionResponse['code'] !== undefined
            ? exceptionResponse
            : (exceptionResponse['details'] as Record<string, unknown> | null)) ?? null;
      }
    } else if (exception instanceof NotFoundException) {
      status = HttpStatus.NOT_FOUND;
      message = exception.message || 'Resource not found';
    } else if (exception instanceof ConflictException) {
      status = HttpStatus.CONFLICT;
      message = exception.message || 'Resource conflict';
    }

    response.status(status).json({
      statusCode: status,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
@ApiTags('Orders')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly logger: AppLoggerService,
    @Inject(forwardRef(() => KonnectOrderService))
    private readonly konnectOrderService: KonnectOrderService,
  ) {}

  @ApiOperation({
    summary: 'Create a new order',
    description: 'Consumer endpoint to create an order for a surplus food offer',
  })
  @ApiBody({
    type: CreateOrderDto,
    description: 'Order details including offer ID, quantity, and pickup preferences',
  })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data or offer unavailable' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Consumer access required' })
  @Post()
  @UseFilters(OrderExceptionFilter)
  @UseGuards(AppVersionGuard, JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CONSUMER)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto, @Request() req: AuthenticatedRequest) {
    const order = await this.ordersService.create(createOrderDto, req.user.userId);

    let payUrl: string | undefined;
    if (createOrderDto.paymentMethod === 'online') {
      const customer = order.customerId as {
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      const payment = await this.konnectOrderService.initOrderPayment(order, {
        firstName: customer.firstName ?? '',
        lastName: customer.lastName ?? '',
        email: customer.email ?? req.user.email,
      });
      payUrl = payment.payUrl;
    }

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Order created successfully',
      data: plainToInstance(ConsumerOrderResponseDto, toPlain(order), {
        excludeExtraneousValues: true,
      }),
      ...(payUrl ? { payUrl } : {}),
    };
  }

  @ApiOperation({
    summary: 'Get all orders with filters',
    description:
      'Retrieve paginated and filtered list of orders. Filters available based on user role.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (default: 10, max: 50)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by order status',
  })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  @UseGuards(QueryComplexityGuard)
  @QueryComplexity({ maxNestingDepth: 2, maxOrConditions: 5, maxRegexConditions: 2 })
  async findAll(
    @Query(new ValidationPipe({ transform: true })) filters: OrderQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    this.logger.log(`Controller - User: ${JSON.stringify(req.user)}`, 'OrderController');
    this.logger.log(`Controller - Filters: ${JSON.stringify(filters)}`, 'OrderController');

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;

    const result = await this.ordersService.findAll(
      page,
      limit,
      filters,
      req.user.userId,
      req.user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      message:
        result.orders.length > 0
          ? 'Orders retrieved successfully'
          : 'No orders found matching the criteria',
      data: result.orders,
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @ApiOperation({
    summary: 'Get my orders as consumer',
    description: 'Retrieve paginated list of orders placed by the authenticated consumer',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (default: 10, max: 50)',
  })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Consumer access required' })
  @Get('my-orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER)
  async getMyOrders(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    if (limit > 50) {
      throw new BadRequestException('Limit cannot exceed 50');
    }

    const result = await this.ordersService.findByCustomer(req.user.userId, page, limit);

    return {
      statusCode: HttpStatus.OK,
      message: 'Your orders retrieved successfully',
      data: result.orders.map(o =>
        plainToInstance(ConsumerOrderResponseDto, toPlain(o), { excludeExtraneousValues: true }),
      ),
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @ApiOperation({
    summary: 'Get my orders as merchant',
    description: "Retrieve paginated list of orders for the authenticated merchant's establishment",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (default: 10, max: 50)',
  })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    type: String,
    description:
      'Filter by establishment ID (enterprise owners only; ignored for location managers)',
  })
  @ApiResponse({ status: 200, description: 'Merchant orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Merchant access required' })
  @Get('merchant-orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  async getMerchantOrders(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('establishmentId') establishmentId?: string,
  ) {
    if (limit > 50) {
      throw new BadRequestException('Limit cannot exceed 50');
    }

    // Location managers can only see their assigned establishment
    const effectiveEstablishmentId =
      (req.user as { role?: string; assignedEstablishmentId?: string }).role === 'location_manager'
        ? (req.user as { assignedEstablishmentId?: string }).assignedEstablishmentId
        : establishmentId;

    const result = await this.ordersService.findByMerchant(
      req.user.userId,
      page,
      limit,
      effectiveEstablishmentId,
      req.user.role as UserRole,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Your merchant orders retrieved successfully',
      data: result.orders.map(o =>
        plainToInstance(MerchantOrderResponseDto, toPlain(o), { excludeExtraneousValues: true }),
      ),
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @ApiOperation({
    summary: 'Get order statistics',
    description: 'Retrieve order statistics and analytics for admin or merchant',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'ISO 8601 date — filter orders from this date (e.g. 2025-06-01T00:00:00.000Z)',
  })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    type: String,
    description: 'Filter stats to a specific establishment (merchants only)',
  })
  @ApiResponse({ status: 200, description: 'Order statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin or Merchant access required' })
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  async getOrderStats(
    @Request() req: AuthenticatedRequest,
    @Query('startDate') startDateStr?: string,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{
    statusCode: number;
    message: string;
    data: OrderStatsResponse;
  }> {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;

    const stats = await this.ordersService.getOrderStats(
      req.user.userId,
      req.user.role,
      startDate,
      effectiveEstablishmentId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Order statistics retrieved successfully',
      data: stats,
    };
  }

  @ApiOperation({
    summary: 'Get revenue chart data',
    description:
      'Returns revenue per slot (day / week / month) for the last N slots. ' +
      'Limits: day ≤ 90, week ≤ 52, month ≤ 24.',
  })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Aggregation granularity (default: month)',
  })
  @ApiQuery({
    name: 'value',
    required: false,
    type: Number,
    description: 'Number of slots to return (default: 9)',
  })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    type: String,
    description: 'Filter revenue chart to a specific establishment (merchants only)',
  })
  @ApiResponse({ status: 200, description: 'Revenue chart data retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid granularity or value out of range' })
  @ApiResponse({ status: 401, description: 'Unauthorized — merchant or admin access required' })
  @Get('merchant-revenue-chart')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.LOCATION_MANAGER)
  async getMerchantRevenueChart(
    @Request() req: AuthenticatedRequest,
    @Query('granularity') rawGranularity = 'month',
    @Query('value', new DefaultValuePipe(9), ParseIntPipe) value: number,
    @Query('establishmentId') establishmentId?: string,
  ): Promise<{
    statusCode: number;
    message: string;
    data: RevenueChartResponse[];
  }> {
    if (!VALID_GRANULARITIES.has(rawGranularity as ChartGranularity)) {
      throw new BadRequestException(
        `granularity must be one of: ${[...VALID_GRANULARITIES].join(', ')}`,
      );
    }
    const granularity = rawGranularity as ChartGranularity;

    const limit = CHART_LIMITS[granularity];
    if (value < 1 || value > limit) {
      throw new BadRequestException(
        `value for granularity "${granularity}" must be between 1 and ${limit}`,
      );
    }

    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : establishmentId;

    const data = await this.ordersService.getRevenueChart(
      req.user.userId,
      req.user.role,
      granularity,
      value,
      effectiveEstablishmentId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Revenue chart data retrieved successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Get customer locations from orders',
    description: 'Aggregates customer city distribution from merchant orders',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max locations (default: 5)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'ISO 8601 date — filter orders from this date',
  })
  @ApiResponse({ status: 200, description: 'Customer locations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Merchant access required' })
  @Get('merchant-customer-locations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.LOCATION_MANAGER)
  async getMerchantCustomerLocations(
    @Request() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('startDate') startDateStr?: string,
  ): Promise<{
    statusCode: number;
    message: string;
    data: CustomerLocationResponse[];
  }> {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const data = await this.ordersService.getCustomerLocations(
      req.user.userId,
      req.user.role,
      limit,
      startDate,
      req.user.assignedEstablishmentId,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Customer locations retrieved successfully',
      data,
    };
  }

  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPendingOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.ordersService.findAll(
      page,
      limit,
      { status: 'pending' },
      undefined,
      UserRole.ADMIN,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Pending orders retrieved successfully',
      data: result.orders,
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @ApiOperation({
    summary: 'Retry payment for a pending-payment order',
    description:
      'Creates a new Konnect payment session or returns the existing active URL. Rate-limited to 3 requests per 5 minutes.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the order' })
  @ApiResponse({ status: 200, description: 'Payment URL returned' })
  @ApiResponse({ status: 400, description: 'Order is not awaiting payment' })
  @ApiResponse({ status: 429, description: 'Too many retry attempts' })
  @Post(':id/retry-payment')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  async retryPayment(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const order = await this.ordersService.findById(id, req.user.userId, req.user.role);
    const customer = order.customerId as {
      firstName?: string;
      lastName?: string;
      email?: string;
    };

    const { payUrl } = await this.konnectOrderService.createRetrySession(order, {
      firstName: customer.firstName ?? '',
      lastName: customer.lastName ?? '',
      email: customer.email ?? req.user.email,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Payment session ready',
      data: { payUrl },
    };
  }

  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Retrieve detailed information about a specific order',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the order' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const order = await this.ordersService.findById(id, req.user.userId, req.user.role);

    const DtoClass =
      req.user.role === UserRole.MERCHANT ||
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.LOCATION_MANAGER
        ? MerchantOrderResponseDto
        : ConsumerOrderResponseDto;

    return {
      statusCode: HttpStatus.OK,
      message: 'Order retrieved successfully',
      data: plainToInstance(DtoClass, toPlain(order), { excludeExtraneousValues: true }),
    };
  }

  @ApiOperation({
    summary: 'Update order status',
    description: 'Update the status of an order (merchant or admin only)',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the order' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const updatedOrder = await this.ordersService.updateStatus(
      id,
      updateStatusDto,
      req.user.userId,
      req.user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Order status updated successfully',
      data: updatedOrder,
    };
  }

  /**
   * Confirm order pickup - RATE LIMITED
   *
   * Security: Strict rate limiting to prevent brute-force attacks on pickup codes.
   * - 5 attempts per minute per order per user
   * - Failed attempts are tracked for additional lockout protection
   *
   * @see PickupThrottlerGuard for rate limiting implementation
   */
  @ApiOperation({
    summary: 'Confirm order pickup',
    description:
      'Merchant confirms order pickup using QR code or pickup code. Rate limited to 5 attempts per minute.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the order' })
  @ApiBody({
    type: ConfirmPickupDto,
    description: 'Pickup confirmation details (QR code or pickup code)',
  })
  @ApiResponse({ status: 200, description: 'Order pickup confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid pickup code' })
  @ApiResponse({ status: 429, description: 'Too many attempts - rate limit exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch(':id/confirm-pickup')
  @UseGuards(PickupThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per 60 seconds
  async confirmPickup(
    @Param('id') id: string,
    @Body() confirmPickupDto: ConfirmPickupDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const updatedOrder = await this.ordersService.confirmPickup(
      id,
      confirmPickupDto,
      req.user.userId,
      req.user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Order pickup confirmed successfully',
      data: updatedOrder,
    };
  }

  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Cancel an order with reason (consumer, merchant, or admin)',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the order' })
  @ApiBody({ type: CancelOrderDto })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() cancelOrderDto: CancelOrderDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const cancelledOrder = await this.ordersService.cancel(
      id,
      cancelOrderDto,
      req.user.userId,
      req.user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Order cancelled successfully',
      data: cancelledOrder,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const deletedOrder = await this.ordersService.softDeleteOrder(id, req.user.userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Order soft deleted successfully',
      data: deletedOrder,
    };
  }

  @Post('update-expired')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateExpiredOrders() {
    const updatedCount = await this.ordersService.updateExpiredOrders();

    return {
      statusCode: HttpStatus.OK,
      message: 'Expired orders updated successfully',
      data: {
        updatedCount,
      },
    };
  }

  @ApiOperation({
    summary: 'Get order receipt',
    description: 'Retrieve detailed receipt information for an order',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the order' })
  @ApiResponse({ status: 200, description: 'Order receipt retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get(':id/receipt')
  async getOrderReceipt(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const order = await this.ordersService.findById(id, req.user.userId, req.user.role);

    // These fields are populated at runtime; define minimal shapes for type safety
    const establishment = order.establishmentId as { name?: string };
    const customer = order.customerId as { firstName?: string; lastName?: string };

    // Generate a simplified receipt data
    const receipt: Record<string, unknown> = {
      orderNumber: order.orderNumber,
      establishmentName: establishment.name,
      customerName: `${customer.firstName} ${customer.lastName}`,
      orderDate: order.createdAt,
      pickupDate: order.pickupDetails.scheduledDate,
      items: order.items.map(item => ({
        title: item.offerTitle,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        originalPrice: item.originalPrice,
        savings: item.discountAmount,
      })),
      pricing: order.pricing,
      status: order.status,
      paymentStatus: order.paymentStatus,
    };

    // Merchant/admin sees pickup code on receipt; consumer does not
    if (req.user.role === UserRole.MERCHANT || req.user.role === UserRole.ADMIN) {
      receipt['pickupCode'] = order.pickupDetails.pickupCode;
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Order receipt retrieved successfully',
      data: receipt,
    };
  }

  @ApiOperation({
    summary: 'Get order QR code',
    description: 'Retrieve QR code and pickup code for order verification',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the order' })
  @ApiResponse({ status: 200, description: 'QR code retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get(':id/qr-code')
  async getOrderQRCode(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const order = await this.ordersService.findById(id, req.user.userId, req.user.role);

    const qrImage = await QRCode.toDataURL(order.pickupDetails.qrCode);

    const responseData: Record<string, unknown> = {
      qrCode: order.pickupDetails.qrCode,
      orderId: order._id,
      orderNumber: order.orderNumber,
      qrCodeImage: qrImage,
    };

    // Only merchant/admin receives the 6-digit pickup code
    if (req.user.role === UserRole.MERCHANT || req.user.role === UserRole.ADMIN) {
      responseData['pickupCode'] = order.pickupDetails.pickupCode;
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Order QR code retrieved successfully',
      data: responseData,
    };
  }

  @Post(':id/extend-pickup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONSUMER, UserRole.ADMIN)
  async extendPickupTime(
    @Param('id') id: string,
    @Body('newPickupDate') newPickupDate: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.ordersService.requestPickupExtension(
      id,
      newPickupDate,
      req.user.userId,
      req.user.role,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Pickup time extension requested',
      data: {
        message: 'Extension request sent to merchant for approval',
      },
    };
  }

  @Patch('approve-expiration')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  async approveExpiration(
    @Body('orderIds') orderIds: string[],
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.ordersService.approveOrdersForExpiration(orderIds, req.user.userId);
    return {
      statusCode: 200,
      message: 'Orders approved for expiration successfully',
      data: result,
    };
  }
  @Patch(':id/approve-pickup-extension')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  async approvePickupExtension(
    @Param('id') orderId: string,
    @Body('approved') approved: boolean,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.ordersService.handlePickupExtensionApproval(
      orderId,
      approved,
      req.user.userId,
    );
    return result;
  }

  /**
   * Unlock a pickup-locked order
   *
   * When an order is locked due to too many failed pickup attempts,
   * the merchant or admin can unlock it to allow retry.
   */
  @Patch(':id/unlock-pickup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.LOCATION_MANAGER)
  async unlockPickup(@Param('id') orderId: string, @Request() req: AuthenticatedRequest) {
    const order = await this.ordersService.unlockPickup(orderId, req.user.userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Order pickup unlocked successfully',
      data: order,
    };
  }
}
