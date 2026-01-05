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
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PaymentService } from './payments.service';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from 'src/users/schemas/user.schema';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { ProcessRefundDto } from './dto/proccess-refund.dto';
import { SMTWebhookPayloadDto } from './dto/webhook-payload.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { Response } from 'express';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
    private readonly logger = new Logger(Controller.name);

    constructor(private readonly paymentService: PaymentService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CONSUMER)
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() createPaymentDto: CreatePaymentDto,
        @Request() req,
        @Res() res: Response
    ) {
        try {
            const payment = await this.paymentService.createPayment(
                createPaymentDto,
                req.user.userId
            );

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

    @Get('all-payments-cursor')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    async findAllCursor(
        @Request() req,
        @Query(new ValidationPipe({ transform: true, whitelist: true })) filters: PaymentQueryDto,
    ) {
        const limit = Math.min(filters.limit || 10, 10);
        const after = filters.after;
        const result = await this.paymentService.findAllCursor(
            limit,
            after,
            filters || {},
            req.user.userId,
            req.user.role
        );

        return {
            statusCode: 200,
            message: 'Payments retrieved successfully',
            data: result.payments,
            meta: {
                limit,
                nextCursor: result.nextCursor || null,
            },
        };
    }

    @Get('my-merchant-payments')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MERCHANT)
    async getMyPayments(
        @Request() req,
        @Query(new ValidationPipe({ transform: true, whitelist: true })) filters: PaymentQueryDto,
    ) {

        const limit = Math.min(filters.limit || 10, 10);
        const after = filters.after;

        const result = await this.paymentService.findAllCursor(
            limit,
            after,
            filters || {},
            req.user.userId,
            UserRole.MERCHANT,
        );
        return {
            statusCode: HttpStatus.OK,
            message: 'Your payments retrieved successfully',
            data: result.payments,
            meta: {
                limit,
                nextCursor: result.nextCursor || null,
            },
        };
    }
    @Get('my-consumer-payments')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CONSUMER)
    async getMyConsumerPayments(
        @Request() req,
        @Query(new ValidationPipe({ transform: true, whitelist: true })) filters: PaymentQueryDto,
    ) {
        const limit = Math.min(filters.limit || 10, 10);
        const after = filters.after;

        const result = await this.paymentService.findAllCursor(
            limit,
            after,
            filters || {} ,
            req.user.userId,
            UserRole.CONSUMER,
        );

        return {
            statusCode: HttpStatus.OK,
            message: 'Your payments retrieved successfully',
            data: result.payments,
            meta: {
                limit,
                nextCursor: result.nextCursor || null,
            },
        };
    }


    @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.CONSUMER, UserRole.MERCHANT, UserRole.ADMIN)
    async getPaymentStats(@Request() req, @Res() res: Response) {
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


    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req) {
        const payment = await this.paymentService.findById(id, req.user.userId, req.user.role);

        return {
            statusCode: HttpStatus.OK,
            message: 'Payment retrieved successfully',
            data: payment,
        };
    }

    @Post('refund')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles( UserRole.ADMIN)
    @HttpCode(HttpStatus.OK)
    async processRefund(@Body() processRefundDto: ProcessRefundDto, @Request() req) {
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

    @Post('webhook')
    @Public()
    @HttpCode(HttpStatus.OK)
    async handleWebhook(
        @Body() webhookPayload: SMTWebhookPayloadDto,
        @Headers('x-smt-signature') signature: string,
        @Headers('x-smt-timestamp') timestamp: string,
    ) {
        if (!signature || !timestamp) {
            throw new BadRequestException('Missing required webhook headers');
        }

        await this.paymentService.handleWebhook(webhookPayload, signature, timestamp);

        return {
            statusCode: HttpStatus.OK,
            message: 'Webhook processed successfully',
        };
    }
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