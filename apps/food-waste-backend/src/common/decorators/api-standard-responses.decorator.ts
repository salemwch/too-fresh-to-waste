/**
 * COMMON SWAGGER RESPONSE DECORATORS
 *
 * Provides standardized @ApiResponse decorators for consistent API documentation.
 * Reduces boilerplate and ensures all endpoints document common HTTP status codes.
 *
 * @see https://docs.nestjs.com/openapi/operations
 */

import { applyDecorators, Type } from '@nestjs/common';
import {
    ApiResponse,
    ApiResponseOptions,
    getSchemaPath,
} from '@nestjs/swagger';

/**
 * Standard error response schema
 */
export class ErrorResponse {
    statusCode: number;
    message: string | string[];
    error?: string;
    timestamp: string;
    path: string;
    method: string;
}

/**
 * Validation error response schema
 */
export class ValidationErrorResponse extends ErrorResponse {
    errors: Array<{
        field: string;
        constraints: Record<string, string>;
    }>;
}

/**
 * Standard paginated response wrapper
 */
export class PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

/**
 * Apply common success responses (200, 201)
 */
export function ApiSuccessResponse(
    status: 200 | 201,
    description: string,
    type?: Type<unknown> | [Type<unknown>],
) {
    const options: any = {
        status,
        description,
    };

    if (type) {
        if (Array.isArray(type)) {
            options.schema = {
                type: 'array',
                items: { $ref: getSchemaPath(type[0]) },
            };
        } else {
            options.type = type;
        }
    }

    return ApiResponse(options);
}

/**
 * Apply common error responses to endpoints
 */
export function ApiCommonErrorResponses() {
    return applyDecorators(
        ApiResponse({
            status: 400,
            description: 'Bad Request - Invalid input data or validation failed',
            type: ValidationErrorResponse,
            example: {
                statusCode: 400,
                message: ['email must be a valid email address'],
                error: 'Bad Request',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/auth/register',
                method: 'POST',
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized - Missing or invalid authentication token',
            type: ErrorResponse,
            example: {
                statusCode: 401,
                message: 'Unauthorized',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/users/profile',
                method: 'GET',
            },
        }),
        ApiResponse({
            status: 403,
            description: 'Forbidden - Insufficient permissions to access resource',
            type: ErrorResponse,
            example: {
                statusCode: 403,
                message: 'Forbidden resource',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/admin/users',
                method: 'GET',
            },
        }),
        ApiResponse({
            status: 404,
            description: 'Not Found - Resource does not exist',
            type: ErrorResponse,
            example: {
                statusCode: 404,
                message: 'User not found',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/users/123',
                method: 'GET',
            },
        }),
        ApiResponse({
            status: 429,
            description: 'Too Many Requests - Rate limit exceeded',
            type: ErrorResponse,
            example: {
                statusCode: 429,
                message: 'ThrottlerException: Too Many Requests',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/auth/login',
                method: 'POST',
            },
        }),
        ApiResponse({
            status: 500,
            description: 'Internal Server Error - Unexpected server error',
            type: ErrorResponse,
            example: {
                statusCode: 500,
                message: 'Internal server error',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/orders',
                method: 'POST',
            },
        }),
    );
}

/**
 * Apply all standard responses for authenticated endpoints
 */
export function ApiAuthenticatedResponse(
    description: string,
    type?: Type<unknown> | [Type<unknown>],
) {
    return applyDecorators(
        ApiSuccessResponse(200, description, type),
        ApiCommonErrorResponses(),
    );
}

/**
 * Apply all standard responses for creation endpoints
 */
export function ApiCreatedResponse(
    description: string,
    type?: Type<unknown>,
) {
    return applyDecorators(
        ApiSuccessResponse(201, description, type),
        ApiCommonErrorResponses(),
    );
}

/**
 * Apply all standard responses for public endpoints
 */
export function ApiPublicResponse(
    description: string,
    type?: Type<unknown> | [Type<unknown>],
) {
    return applyDecorators(
        ApiSuccessResponse(200, description, type),
        ApiResponse({
            status: 400,
            description: 'Bad Request',
            type: ValidationErrorResponse,
        }),
        ApiResponse({
            status: 429,
            description: 'Too Many Requests',
            type: ErrorResponse,
        }),
        ApiResponse({
            status: 500,
            description: 'Internal Server Error',
            type: ErrorResponse,
        }),
    );
}

/**
 * Decorator for paginated list endpoints
 */
export function ApiPaginatedResponse(type: Type<unknown>) {
    return applyDecorators(
        ApiResponse({
            status: 200,
            description: 'Successfully retrieved paginated results',
            schema: {
                allOf: [
                    {
                        properties: {
                            data: {
                                type: 'array',
                                items: { $ref: getSchemaPath(type) },
                            },
                            meta: {
                                type: 'object',
                                properties: {
                                    total: { type: 'number', example: 100 },
                                    page: { type: 'number', example: 1 },
                                    limit: { type: 'number', example: 10 },
                                    totalPages: { type: 'number', example: 10 },
                                },
                            },
                        },
                    },
                ],
            },
        }),
        ApiCommonErrorResponses(),
    );
}
