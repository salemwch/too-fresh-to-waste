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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AppLoggerService } from '../common/services/logger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryComplexityGuard, QueryComplexity } from '../common/guards/query-complexity.guard';
import { PickupThrottlerGuard } from './guards/pickup-throttler.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import {
    CreateOrderDto,
    ConfirmPickupDto,
    UpdateOrderStatusDto,
    CancelOrderDto,
    OrderQueryDto,
} from './DTO/create-order.dto';
import { OrdersService, OrderStatsResponse } from './order.service';
import * as QRCode from 'qrcode' ;


@Catch()
export class OrderExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: AppLoggerService) {}

    catch(exception: any, host: ArgumentsHost) {
        // Log full error details for debugging
        const errorMessage = exception?.message || 'Unknown error';
        const errorStack = exception?.stack || '';
        const errorResponse = exception?.getResponse?.() || null;

        this.logger.error(
            `Order error: ${errorMessage}`,
            JSON.stringify({
                message: errorMessage,
                response: errorResponse,
                stack: errorStack
            }),
            'OrderExceptionFilter'
        );

        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: any = 'Internal server error';
        let details = null;

        if (exception instanceof BadRequestException) {
            status = HttpStatus.BAD_REQUEST;
            const exceptionResponse = exception.getResponse() as any;
            message = exceptionResponse.message || exceptionResponse || 'Invalid order data';
            details = exceptionResponse.code ? exceptionResponse : null;
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
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {

    constructor(
        private readonly ordersService: OrdersService,
        private readonly logger: AppLoggerService,
    ) { }

    @Post()
    @UseFilters(OrderExceptionFilter)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CONSUMER)
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
        const order = await this.ordersService.create(createOrderDto, req.user.userId);

        return {
            statusCode: HttpStatus.CREATED,
            message: 'Order created successfully',
            data: order,
        };
    }


    @Get()
    @UseGuards(QueryComplexityGuard)
    @QueryComplexity({ maxNestingDepth: 2, maxOrConditions: 5, maxRegexConditions: 2 })
    async findAll(
        @Query(new ValidationPipe({ transform: true })) filters: OrderQueryDto,
        @Request() req,
    ) {
        this.logger.log(`Controller - User: ${JSON.stringify(req.user)}`, 'OrderController');
        this.logger.log(`Controller - Filters: ${JSON.stringify(filters)}`, 'OrderController');

        const page = filters.page || 1;
        const limit = filters.limit || 10;

        const result = await this.ordersService.findAll(
            page,
            limit,
            filters,
            req.user.userId,
            req.user.role,
        );

        return {
            statusCode: HttpStatus.OK,
            message: result.orders.length > 0 ? 'Orders retrieved successfully' : 'No orders found matching the criteria',
            data: result.orders,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
                hasNextPage: page < Math.ceil(result.total / limit),
                hasPrevPage: page > 1,
            },
        };
    }


    @Get('my-orders')
    @UseGuards(RolesGuard)
    @Roles(UserRole.CONSUMER)
    async getMyOrders(
        @Request() req,
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
            data: result.orders,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
                hasNextPage: page < Math.ceil(result.total / limit),
                hasPrevPage: page > 1,
            },
        };
    }

    @Get('merchant-orders')
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT)
    async getMerchantOrders(
        @Request() req,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        if (limit > 50) {
            throw new BadRequestException('Limit cannot exceed 50');
        }

        const result = await this.ordersService.findByMerchant(req.user.userId, page, limit);

        return {
            statusCode: HttpStatus.OK,
            message: 'Your merchant orders retrieved successfully',
            data: result.orders,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
                hasNextPage: page < Math.ceil(result.total / limit),
                hasPrevPage: page > 1,
            },
        };
    }

    @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MERCHANT)
    async getOrderStats(@Request() req): Promise<{
        statusCode: number;
        message: string;
        data: OrderStatsResponse;
    }> {
        const stats = await this.ordersService.getOrderStats(req.user.userId, req.user.role);

        return {
            statusCode: HttpStatus.OK,
            message: 'Order statistics retrieved successfully',
            data: stats,
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
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req) {
        const order = await this.ordersService.findById(id, req.user.userId, req.user.role);

        return {
            statusCode: HttpStatus.OK,
            message: 'Order retrieved successfully',
            data: order,
        };
    }

    @Patch(':id/status')
    async updateStatus(
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateOrderStatusDto,
        @Request() req,
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
    @Patch(':id/confirm-pickup')
    @UseGuards(PickupThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per 60 seconds
    async confirmPickup(
        @Param('id') id: string,
        @Body() confirmPickupDto: ConfirmPickupDto,
        @Request() req,
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

    @Patch(':id/cancel')
    async cancel(
        @Param('id') id: string,
        @Body() cancelOrderDto: CancelOrderDto,
        @Request() req,
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
    async remove(@Param('id') id: string, @Request() req) {
        const deletedOrder = await this.ordersService.softDeleteOrder(
            id,
            req.user.userId,
        );

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

    @Get(':id/receipt')
    async getOrderReceipt(@Param('id') id: string, @Request() req) {
        const order = await this.ordersService.findById(id, req.user.userId, req.user.role);

        // Type assertion or proper population is needed
        const establishment = order.establishmentId as any;
        const customer = order.customerId as any;

        // Generate a simplified receipt data
        const receipt = {
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

        return {
            statusCode: HttpStatus.OK,
            message: 'Order receipt retrieved successfully',
            data: receipt,
        };
    }

    @Get(':id/qr-code')
    async getOrderQRCode(@Param('id') id: string, @Request() req) {
        const order = await this.ordersService.findById(id, req.user.userId, req.user.role);

        const qrImage = await QRCode.toDataURL(order.pickupDetails.qrCode);

        return {
            statusCode: HttpStatus.OK,
            message: 'Order QR code retrieved successfully',
            data: {
                qrCode: order.pickupDetails.qrCode,
                pickupCode: order.pickupDetails.pickupCode,
                orderId: order._id,
                orderNumber: order.orderNumber,
                qrCodeImage: qrImage,
            },
        };
    }

    @Post(':id/extend-pickup')
    @UseGuards(RolesGuard)
    @Roles(UserRole.CONSUMER, UserRole.ADMIN)
    async extendPickupTime(
        @Param('id') id: string,
        @Body('newPickupDate') newPickupDate: string,
        @Request() req,
    ) {
        await this.ordersService.requestPickupExtension(id, newPickupDate, req.user.userId, req.user.role);

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
    @Roles(UserRole.MERCHANT)
    async approveExpiration(@Body('orderIds') orderIds: string[], @Request() req) {
        const result = await this.ordersService.approveOrdersForExpiration(
            orderIds,
            req.user.userId,
        );
        return {
            statusCode: 200,
            message: 'Orders approved for expiration successfully',
            data: result,
        };
    }
    @Patch(':id/approve-pickup-extension')
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT)
    approvePickupExtension(
        @Param('id') orderId: string,
        @Body('approved') approved: boolean,
    ) {
        return this.ordersService.handlePickupExtensionApproval(orderId, approved);
    }

    /**
     * Unlock a pickup-locked order
     *
     * When an order is locked due to too many failed pickup attempts,
     * the merchant or admin can unlock it to allow retry.
     */
    @Patch(':id/unlock-pickup')
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT, UserRole.ADMIN)
    async unlockPickup(
        @Param('id') orderId: string,
        @Request() req,
    ) {
        const order = await this.ordersService.unlockPickup(orderId, req.user.userId);

        return {
            statusCode: HttpStatus.OK,
            message: 'Order pickup unlocked successfully',
            data: order,
        };
    }
}
