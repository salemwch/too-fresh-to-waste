import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Enterprise-grade pagination DTO with validation
 * Prevents loading excessive data and ensures consistent API responses
 *
 * Usage:
 * ```typescript
 * @Get()
 * async findAll(@Query() paginationDto: PaginationDto) {
 *   const { page, limit, sortBy, sortOrder } = paginationDto;
 *   return this.service.findAll(page, limit, sortBy, sortOrder);
 * }
 * ```
 */
export class PaginationDto {
    @ApiPropertyOptional({
        description: 'Page number (1-indexed)',
        minimum: 1,
        default: 1,
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Page must be an integer' })
    @Min(1, { message: 'Page must be at least 1' })
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        minimum: 1,
        maximum: 100,
        default: 20,
        example: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Limit must be an integer' })
    @Min(1, { message: 'Limit must be at least 1' })
    @Max(100, { message: 'Limit cannot exceed 100' }) // Prevent DOS attacks
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Field to sort by',
        example: 'createdAt',
    })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({
        description: 'Sort order (asc or desc)',
        enum: ['asc', 'desc'],
        default: 'desc',
        example: 'desc',
    })
    @IsOptional()
    @IsEnum(['asc', 'desc'], { message: 'Sort order must be "asc" or "desc"' })
    sortOrder?: 'asc' | 'desc' = 'desc';

    /**
     * Get skip value for MongoDB queries
     */
    getSkip(): number {
        return ((this.page || 1) - 1) * (this.limit || 20);
    }

    /**
     * Get MongoDB sort object
     */
    getSortObject(): Record<string, 1 | -1> {
        return {
            [this.sortBy || 'createdAt']: this.sortOrder === 'asc' ? 1 : -1,
        };
    }
}

/**
 * Standardized pagination response interface
 * Ensures all paginated endpoints return consistent metadata
 *
 * @template T - The type of items in the data array
 */
export interface PaginationResponse<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

/**
 * Create standardized pagination response
 * Factory function to ensure consistency across all services
 *
 * @param data - Array of items
 * @param total - Total count of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Standardized pagination response
 */
export function createPaginationResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
): PaginationResponse<T> {
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
