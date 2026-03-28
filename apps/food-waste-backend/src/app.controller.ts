import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Public } from './common/decorators/public.decorator';

@ApiTags('General')
@Controller()
export class AppController {
  @ApiOperation({
    summary: 'Get API information',
    description: 'Public endpoint returning basic API information and status',
  })
  @ApiResponse({ status: 200, description: 'API information retrieved successfully' })
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

  @ApiOperation({
    summary: 'Health check',
    description: 'Public health check endpoint returning API status and uptime',
  })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  @Get('health')
  @Public()
  getHealthCheck() {
    return {
      statusCode: HttpStatus.OK,
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'] || 'development',
    };
  }

  @ApiOperation({
    summary: 'Get available endpoints',
    description: 'Public endpoint listing all available API endpoints and documentation URL',
  })
  @ApiResponse({ status: 200, description: 'API endpoints information retrieved successfully' })
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
