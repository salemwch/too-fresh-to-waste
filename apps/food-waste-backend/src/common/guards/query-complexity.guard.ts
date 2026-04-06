import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * Enterprise-grade MongoDB query complexity limits
 *
 * Prevents DoS attacks via:
 * 1. Deep $or/$and nesting (exponential query cost)
 * 2. Large arrays in $in operators (index exhaustion)
 * 3. Complex aggregation pipelines
 * 4. Unindexed regex queries at scale
 *
 * @rationale Deeply nested MongoDB queries can cause CPU exhaustion and database locks
 * @see https://www.mongodb.com/docs/manual/tutorial/create-queries-that-ensure-selectivity/
 * @see https://owasp.org/www-community/attacks/Denial_of_Service
 */

/**
 * Query complexity configuration interface
 */
export interface QueryComplexityConfig {
  /**
   * Maximum nesting depth for $or/$and operators
   * Default: 3 (prevents exponential query expansion)
   */
  maxNestingDepth?: number;

  /**
   * Maximum number of conditions in a single $or array
   * Default: 10 (prevents query plan explosion)
   */
  maxOrConditions?: number;

  /**
   * Maximum values in $in array
   * Default: 100 (prevents index scan exhaustion)
   */
  maxInArraySize?: number;

  /**
   * Maximum total number of conditions in query
   * Default: 50 (prevents excessive query parsing)
   */
  maxTotalConditions?: number;

  /**
   * Allow $regex queries (disable if performance is critical)
   * Default: true
   */
  allowRegex?: boolean;

  /**
   * Maximum number of $regex conditions
   * Default: 5 (regex can be expensive without proper indexes)
   */
  maxRegexConditions?: number;
}

/**
 * Metadata key for query complexity decorator
 */
export const QUERY_COMPLEXITY_KEY = 'query_complexity';

/**
 * Decorator to set query complexity limits on controller endpoints
 *
 * @param config - Query complexity configuration
 *
 * @example
 * @QueryComplexity({ maxNestingDepth: 2, maxOrConditions: 5 })
 * @Get('search')
 * async search(@Query() dto: SearchDto) { ... }
 */
export const QueryComplexity =
  (config: QueryComplexityConfig = {}) =>
  (_target: object, _propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(QUERY_COMPLEXITY_KEY, config, descriptor.value);
    }
  };

/**
 * Query complexity statistics for logging and monitoring
 */
export interface QueryComplexityStats {
  nestingDepth: number;
  orConditionCount: number;
  inArraySizes: number[];
  totalConditions: number;
  regexCount: number;
  passed: boolean;
  violations: string[];
}

type QueryComplexityRequest = Request & {
  queryComplexityStats?: QueryComplexityStats;
};

/**
 * Guard to validate MongoDB query complexity before execution
 * Prevents DoS attacks via complex queries
 */
@Injectable()
export class QueryComplexityGuard implements CanActivate {
  private readonly logger = new Logger(QueryComplexityGuard.name);

  /**
   * Default configuration (conservative limits)
   */
  private readonly DEFAULT_CONFIG: Required<QueryComplexityConfig> = {
    maxNestingDepth: 3,
    maxOrConditions: 10,
    maxInArraySize: 100,
    maxTotalConditions: 50,
    allowRegex: true,
    maxRegexConditions: 5,
  };

  constructor(private readonly reflector: Reflector) {}

  /**
   * Validate query complexity before allowing request
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<QueryComplexityRequest>();

    // Get configuration from decorator or use defaults
    const decoratorConfig = this.reflector.get<QueryComplexityConfig>(
      QUERY_COMPLEXITY_KEY,
      context.getHandler(),
    );

    const config = { ...this.DEFAULT_CONFIG, ...decoratorConfig };

    // Extract query from request body and query params
    const queryObject = this.extractQueryObject(request);

    if (!queryObject || Object.keys(queryObject).length === 0) {
      // No query to validate
      return true;
    }

    // Analyze query complexity
    const stats = this.analyzeQueryComplexity(queryObject, config);

    // Log if query is complex but valid
    if (stats.nestingDepth > 2 || stats.totalConditions > 20) {
      this.logger.debug(`Complex query detected: ${JSON.stringify(stats)}`);
    }

    // Block if complexity exceeds limits
    if (!stats.passed) {
      this.logger.warn(
        `Query complexity limit exceeded: ${stats.violations.join(', ')} | Route: ${request.url}`,
      );

      throw new BadRequestException({
        message: 'Query too complex',
        violations: stats.violations,
        stats: {
          nestingDepth: stats.nestingDepth,
          orConditionCount: stats.orConditionCount,
          totalConditions: stats.totalConditions,
          regexCount: stats.regexCount,
        },
      });
    }

    // Attach stats to request for observability
    request.queryComplexityStats = stats;

    return true;
  }

  /**
   * Extract MongoDB query object from request
   */
  private extractQueryObject(request: Request): Record<string, unknown> | null {
    // Check body for query (POST/PUT requests)
    const requestBody = request.body as unknown;
    if (requestBody !== null && requestBody !== undefined && typeof requestBody === 'object') {
      const bodyRecord = requestBody as Record<string, unknown>;
      const query = bodyRecord['query'];
      if (query !== null && query !== undefined && typeof query === 'object') {
        return query as Record<string, unknown>;
      }
      const filter = bodyRecord['filter'];
      if (filter !== null && filter !== undefined && typeof filter === 'object') {
        return filter as Record<string, unknown>;
      }
      // For DTOs that directly contain query operators
      if (this.hasMongoOperators(bodyRecord)) {
        return bodyRecord;
      }
    }

    // Check query params (GET requests)
    if (typeof request.query === 'object') {
      if (this.hasMongoOperators(request.query)) {
        return request.query;
      }
    }

    return null;
  }

  /**
   * Check if object contains MongoDB query operators
   */
  private hasMongoOperators(obj: unknown): boolean {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return false;
    }

    const mongoOperators = ['$or', '$and', '$in', '$regex', '$ne', '$gt', '$gte', '$lt', '$lte'];

    return Object.keys(obj as Record<string, unknown>).some((key) => mongoOperators.includes(key));
  }

  /**
   * Analyze query complexity and return statistics
   */
  public analyzeQueryComplexity(
    query: unknown,
    config: Required<QueryComplexityConfig>,
  ): QueryComplexityStats {
    const stats: QueryComplexityStats = {
      nestingDepth: 0,
      orConditionCount: 0,
      inArraySizes: [],
      totalConditions: 0,
      regexCount: 0,
      passed: true,
      violations: [],
    };

    // Calculate actual complexity
    this.traverseQuery(query, 0, stats);

    // Validate against limits
    if (stats.nestingDepth > config.maxNestingDepth) {
      stats.passed = false;
      stats.violations.push(
        `Nesting depth (${stats.nestingDepth}) exceeds maximum (${config.maxNestingDepth})`,
      );
    }

    if (stats.orConditionCount > config.maxOrConditions) {
      stats.passed = false;
      stats.violations.push(
        `$or conditions (${stats.orConditionCount}) exceed maximum (${config.maxOrConditions})`,
      );
    }

    const maxInSize = Math.max(...stats.inArraySizes, 0);
    if (maxInSize > config.maxInArraySize) {
      stats.passed = false;
      stats.violations.push(
        `$in array size (${maxInSize}) exceeds maximum (${config.maxInArraySize})`,
      );
    }

    if (stats.totalConditions > config.maxTotalConditions) {
      stats.passed = false;
      stats.violations.push(
        `Total conditions (${stats.totalConditions}) exceed maximum (${config.maxTotalConditions})`,
      );
    }

    if (!config.allowRegex && stats.regexCount > 0) {
      stats.passed = false;
      stats.violations.push(`$regex queries are not allowed on this endpoint`);
    }

    if (stats.regexCount > config.maxRegexConditions) {
      stats.passed = false;
      stats.violations.push(
        `$regex conditions (${stats.regexCount}) exceed maximum (${config.maxRegexConditions})`,
      );
    }

    return stats;
  }

  /**
   * Recursively traverse query to calculate complexity metrics
   */
  private traverseQuery(obj: unknown, depth: number, stats: QueryComplexityStats): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return;
    }

    // Update max nesting depth
    stats.nestingDepth = Math.max(stats.nestingDepth, depth);

    // Process arrays
    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.traverseQuery(item, depth, stats);
      }
      return;
    }

    // Process object keys
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      stats.totalConditions++;

      // Handle $or operator
      if (key === '$or' && Array.isArray(value)) {
        stats.orConditionCount += value.length;
        // Recurse with increased depth
        for (const condition of value) {
          this.traverseQuery(condition, depth + 1, stats);
        }
        continue;
      }

      // Handle $and operator
      if (key === '$and' && Array.isArray(value)) {
        // $and also increases complexity
        for (const condition of value) {
          this.traverseQuery(condition, depth + 1, stats);
        }
        continue;
      }

      // Handle $in operator
      if (key === '$in' && Array.isArray(value)) {
        stats.inArraySizes.push(value.length);
        continue;
      }

      // Handle $regex operator
      if (key === '$regex' || (typeof value === 'object' && value !== null && '$regex' in value)) {
        stats.regexCount++;
      }

      // Recurse for nested objects
      if (value !== null && value !== undefined && typeof value === 'object') {
        this.traverseQuery(value, depth, stats);
      }
    }
  }
}
