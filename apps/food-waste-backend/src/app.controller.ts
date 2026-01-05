import { Controller, Get, HttpStatus } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {

    @Get()
    @Public()
    getAppInfo() {
        return {
            statusCode: HttpStatus.OK,
            message: 'Food Waste Reduction API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
        };
    }

    @Get('health')
    @Public()
    getHealthCheck() {
        return {
            statusCode: HttpStatus.OK,
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
        };
    }

    @Get('api')
    @Public()
    getApiInfo() {
        return {
            statusCode: HttpStatus.OK,
            message: 'Food Waste Reduction API - Available Endpoints',
            version: '1.0.0',
            endpoints: {
                authentication: '/auth',
                users: '/users',
                establishments: '/establishments',
                offers: '/offers',
                orders: '/orders',
                payments: '/payments',
                reviews: '/reviews',
                analytics: '/analytics',
            },
            documentation: '/api/docs',
        };
    }
}