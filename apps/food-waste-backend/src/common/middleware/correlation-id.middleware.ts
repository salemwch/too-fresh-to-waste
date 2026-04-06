import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * CORRELATION ID MIDDLEWARE
 *
 * Adds unique correlation IDs to every request for distributed tracing.
 * Correlation IDs enable tracking requests across microservices, logs, and external systems.
 *
 * Features:
 * - Generates UUID v4 if no correlation ID provided
 * - Accepts existing correlation ID from X-Correlation-ID header
 * - Attaches correlation ID to request object for use in controllers/services
 * - Returns correlation ID in response headers
 * - Thread-safe and performance-optimized
 *
 * @compliance Distributed tracing best practices, OpenTelemetry
 * @rationale Essential for debugging distributed systems and tracking user journeys
 * @see https://www.rapid7.com/blog/post/2016/12/23/the-value-of-correlation-ids/
 */

type CorrelatedRequest = Request & {
  correlationId?: string;
  requestId?: string;
  startTime?: number;
};

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  /**
   * Middleware execution
   * Runs on every incoming request before reaching controllers
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const correlatedRequest = req as CorrelatedRequest;
    // 1. Extract correlation ID from header or generate new one
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      uuidv4();

    // 2. Attach correlation ID to request object
    correlatedRequest.correlationId = correlationId;
    correlatedRequest.requestId = correlationId; // Alias for backward compatibility

    // 3. Record request start time for duration tracking
    correlatedRequest.startTime = Date.now();

    // 4. Set correlation ID in response headers
    // This allows clients to track their requests and reference in support tickets
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', correlationId); // Backward compatibility

    // 5. Continue to next middleware/controller
    next();
  }
}
