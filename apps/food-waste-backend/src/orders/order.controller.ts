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
  BadRequestException,
  UseFilters,
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
import { perfLog, perfStart } from '../common/utils/perf-log.util';
import { QueryOptimizer } from '../common/utils/query-optimization.util';
import { MerchantSalesQueryDto } from '../merchant-sales/dto/merchant-sales-query.dto';
import { orderEarningsFor } from '../merchant-sales/merchant-sales.expressions';
import { MerchantSalesService } from '../merchant-sales/merchant-sales.service';
import { SALES_PERIODS, resolveSalesPeriod } from '../merchant-sales/merchant-sales.period';
import { salesScopeForRequest } from '../merchant-sales/merchant-sales.scope';
import type {
  MerchantSalesChart,
  MerchantSalesSummary,
} from '../merchant-sales/merchant-sales.types';
import { KonnectOrderService } from '../payments/services/konnect-order.service';

import {
  CreateOrderDto,
  ConfirmPickupDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
  OrderQueryDto,
} from './DTO/create-order.dto';
import { OrderStatsQueryDto } from './DTO/order-stats-query.dto';
import { ConsumerOrderResponseDto, MerchantOrderResponseDto } from './DTO/order-response.dto';
import { OrderExceptionFilter } from './filters/order-exception.filter';
import { PickupThrottlerGuard } from './guards/pickup-throttler.guard';
import { OrdersService, OrderStatsResponse, CustomerLocationResponse } from './order.service';
import { toMerchantOrderView } from './utils/merchant-order-view';

import { strictValidation } from '../common/pipes/validation-pipes';

import { appError } from '../common/errors';

/** Converts a Mongoose document to a primitive-only plain object.
 *  plainToInstance (class-transformer) constructs new instances for any class-typed
 *  value it encounters — e.g. ObjectId instances silently become freshly generated IDs.
 *  JSON.stringify triggers ObjectId.toJSON() → hex string, Date.toJSON() → ISO string,
 *  and JSON.parse returns a pure primitive object.  This is exactly what both
 *  plainToInstance and the eventual HTTP serialisation expect. */
const toPlain = (doc: unknown): unknown => JSON.parse(JSON.stringify(doc));

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
    private readonly merchantSalesService: MerchantSalesService,
  ) {}

  /**
   * MERCHANT and LOCATION_MANAGER get the delivery-money-stripped view;
   * ADMIN keeps the full object. Several routes below return a raw
   * order/receipt object with no DTO in between (no `MerchantOrderResponseDto`
   * / `ConsumerOrderResponseDto` to fall back on for the exclusion), so the
   * strip has to happen at this layer.
   *
   * Defence in depth: `order.commission` is the merchant's private commission
   * ledger (global constraint - never reaches a CONSUMER or DRIVER). Every
   * role that is not MERCHANT, LOCATION_MANAGER or ADMIN has it removed here
   * even though today's callers only ever opt it into the projection for
   * those three roles (`OrdersService.findById`'s `includeCommission`) - so a
   * future opt-in mistake on the read side still cannot leak it on the way
   * out.
   */
  private forRole<T extends object>(role: UserRole, order: T): T {
    if (role === UserRole.MERCHANT || role === UserRole.LOCATION_MANAGER) {
      return toMerchantOrderView(order) as T;
    }
    if (role === UserRole.ADMIN) {
      return order;
    }
    const view = { ...(order as Record<string, unknown>) };
    delete view['commission'];
    return view as T;
  }

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
  @Throttle({ default: { limit: 1, ttl: 5000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto, @Request() req: AuthenticatedRequest) {
    const t0 = perfStart();

    const order = await this.ordersService.create(createOrderDto, req.user.userId);
    const tOrder = perfStart();
    perfLog(m => this.logger.log(m), 'ordersService.create', t0);

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
      perfLog(m => this.logger.log(m), 'initOrderPayment', tOrder);
    }

    const tSer = perfStart();
    const plain = toPlain(order) as Record<string, unknown>;
    if (payUrl) {
      plain['payUrl'] = payUrl;
    }
    const data = plainToInstance(ConsumerOrderResponseDto, plain, {
      excludeExtraneousValues: true,
    });
    perfLog(m => this.logger.log(m), 'serialization', tSer);
    perfLog(
      m => this.logger.log(m),
      'POST /orders total',
      t0,
      `payment=${createOrderDto.paymentMethod}`,
    );

    return {
      message: 'Order created successfully',
      data,
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
    @Query(strictValidation()) filters: OrderQueryDto,
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

    // This route has no @Roles guard - any authenticated caller reaches it,
    // including MERCHANT and LOCATION_MANAGER (scoped to their own orders by
    // buildQuery). It returns raw lean orders with no DTO in between, so the
    // delivery-money strip must happen here.
    const data =
      req.user.role === UserRole.MERCHANT || req.user.role === UserRole.LOCATION_MANAGER
        ? result.orders.map(o => toMerchantOrderView(o as unknown as Record<string, unknown>))
        : result.orders;

    return {
      statusCode: HttpStatus.OK,
      message:
        result.orders.length > 0
          ? 'Orders retrieved successfully'
          : 'No orders found matching the criteria',
      data,
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
    description: 'Page number (default: 1). Ignored when cursor is provided.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (default: 10, max: 50)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description:
      'ISO date cursor for cursor-based pagination. When provided, returns orders created before this timestamp.',
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
    @Query('cursor') cursor?: string,
  ) {
    if (limit > 50) {
      throw new BadRequestException(appError('LIMIT_TOO_HIGH'));
    }

    if (cursor) {
      const result = await this.ordersService.findByCustomerCursor(req.user.userId, limit, cursor);

      return {
        statusCode: HttpStatus.OK,
        message: 'Your orders retrieved successfully',
        data: result.orders.map(o =>
          plainToInstance(ConsumerOrderResponseDto, toPlain(o), { excludeExtraneousValues: true }),
        ),
        meta: { limit, hasMore: result.hasMore, nextCursor: result.nextCursor },
      };
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
      throw new BadRequestException(appError('LIMIT_TOO_HIGH'));
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
      // This route serves MERCHANT and LOCATION_MANAGER only (never ADMIN),
      // so the money view applies unconditionally.
      data: result.orders.map(o =>
        plainToInstance(
          MerchantOrderResponseDto,
          toMerchantOrderView(toPlain(o) as Record<string, unknown>),
          { excludeExtraneousValues: true },
        ),
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
  @ApiQuery({
    name: 'period',
    required: false,
    enum: SALES_PERIODS,
    description:
      'Resolved server-side in Africa/Tunis, same clock as the earnings summary/chart. ' +
      "Wins over `startDate` when both are sent. Default: `startDate`'s own behaviour (or all-time).",
  })
  @ApiResponse({ status: 200, description: 'Order statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin or Merchant access required' })
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  async getOrderStats(
    @Request() req: AuthenticatedRequest,
    @Query(strictValidation()) query: OrderStatsQueryDto,
  ): Promise<{
    statusCode: number;
    message: string;
    data: OrderStatsResponse;
  }> {
    // `period` wins over `startDate` when both are sent - resolved on the
    // server, in Africa/Tunis, exactly like the earnings summary/chart, so
    // the dashboard's KPI cards agree with its earnings figures for the same
    // period. `startDate`'s own behaviour (including its all-time default)
    // is unchanged when `period` is absent.
    const startDate = query.period
      ? (resolveSalesPeriod(query.period, new Date()).from ?? undefined)
      : query.startDate
        ? new Date(query.startDate)
        : undefined;
    const effectiveEstablishmentId =
      req.user.role === UserRole.LOCATION_MANAGER
        ? req.user.assignedEstablishmentId
        : query.establishmentId;

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

  @ApiOperation({ summary: 'Merchant earnings for a period, cash and online together' })
  @ApiQuery({ name: 'period', required: false, enum: SALES_PERIODS, description: 'Default: month' })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    type: String,
    description: 'Scope to one establishment (merchants only)',
  })
  @ApiResponse({ status: 200, description: 'Earnings summary' })
  @Get('merchant-sales-summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  async getMerchantSalesSummary(
    @Request() req: AuthenticatedRequest,
    @Query(strictValidation()) query: MerchantSalesQueryDto,
  ): Promise<{ statusCode: number; message: string; data: MerchantSalesSummary }> {
    const data = await this.merchantSalesService.summary(
      this.salesScope(req, query),
      query.period ?? 'month',
    );
    return { statusCode: HttpStatus.OK, message: 'Earnings summary retrieved successfully', data };
  }

  @ApiOperation({ summary: 'Merchant earnings per hour, day or month for a period' })
  @ApiQuery({ name: 'period', required: false, enum: SALES_PERIODS, description: 'Default: month' })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    type: String,
    description: 'Scope to one establishment (merchants only)',
  })
  @ApiResponse({ status: 200, description: 'Earnings chart' })
  @Get('merchant-sales-chart')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  async getMerchantSalesChart(
    @Request() req: AuthenticatedRequest,
    @Query(strictValidation()) query: MerchantSalesQueryDto,
  ): Promise<{ statusCode: number; message: string; data: MerchantSalesChart }> {
    const data = await this.merchantSalesService.chart(
      this.salesScope(req, query),
      query.period ?? 'month',
    );
    return { statusCode: HttpStatus.OK, message: 'Earnings chart retrieved successfully', data };
  }

  /** A location manager is pinned to their assignment, whatever they ask for. */
  private salesScope(req: AuthenticatedRequest, query: MerchantSalesQueryDto) {
    return salesScopeForRequest(req.user, query.establishmentId);
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
    const isMerchantSide =
      req.user.role === UserRole.MERCHANT ||
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.LOCATION_MANAGER;
    // `commission` is loaded only for MERCHANT / LOCATION_MANAGER / ADMIN -
    // never as part of the default projection every role's read shares.
    const order = await this.ordersService.findById(id, req.user.userId, req.user.role, {
      includeCommission: isMerchantSide,
    });

    // Shared route: MERCHANT/LOCATION_MANAGER get the money-stripped view;
    // ADMIN and the customer keep the full order.
    const plain = toPlain(order) as Record<string, unknown>;
    const view =
      req.user.role === UserRole.MERCHANT || req.user.role === UserRole.LOCATION_MANAGER
        ? toMerchantOrderView(plain)
        : plain;

    // "Your earnings" (A2) - same gate as `commission` (isMerchantSide), same
    // case logic as merchant-sales via `orderEarningsFor`, never a second
    // formula. Absent entirely when the order has no commission moment yet.
    const earnings = isMerchantSide
      ? orderEarningsFor(
          view as unknown as Parameters<typeof orderEarningsFor>[0],
          this.merchantSalesService.cutoff(),
        )
      : undefined;
    const viewWithEarnings = earnings ? { ...view, earnings } : view;

    // Three branches, not two: MERCHANT/LOCATION_MANAGER get the honestly
    // stripped MerchantOrderResponseDto (A7); ADMIN keeps the full order
    // (bypassing every DTO, like `forRole`'s ADMIN branch elsewhere in this
    // controller) rather than being routed through the merchant shape, which
    // would now also strip delivery money from ADMIN - a regression A7's own
    // fix would otherwise have introduced, caught by
    // `test/security/merchant-order-money.spec.ts`'s "still sends the
    // delivery fee to ADMIN" row; CONSUMER gets ConsumerOrderResponseDto.
    const data =
      req.user.role === UserRole.MERCHANT || req.user.role === UserRole.LOCATION_MANAGER
        ? plainToInstance(MerchantOrderResponseDto, viewWithEarnings, {
            excludeExtraneousValues: true,
          })
        : req.user.role === UserRole.ADMIN
          ? viewWithEarnings
          : plainToInstance(ConsumerOrderResponseDto, viewWithEarnings, {
              excludeExtraneousValues: true,
            });

    return {
      statusCode: HttpStatus.OK,
      message: 'Order retrieved successfully',
      data,
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
  @ApiResponse({ status: 403, description: 'Not a merchant or admin' })
  // Had no role guard: any signed-in user - a consumer on their own order -
  // could set a status. The service now also limits which statuses.
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
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
      data: this.forRole(req.user.role, updatedOrder),
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
      data: this.forRole(req.user.role, updatedOrder),
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
      data: this.forRole(req.user.role, cancelledOrder),
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
      data: this.forRole(req.user.role, receipt),
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
    const order = await this.ordersService.unlockPickup(orderId, req.user.userId, req.user.role);

    return {
      statusCode: HttpStatus.OK,
      message: 'Order pickup unlocked successfully',
      data: this.forRole(req.user.role, order),
    };
  }
}
