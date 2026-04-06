import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { Public } from '../decorators/public.decorator';
import { CspReportDto } from '../dto/csp-report.dto';
import { AppLoggerService } from '../services/logger.service';

/**
 * CSP Violation Report Controller
 *
 * Receives and logs Content Security Policy violation reports from browsers
 *
 * @rationale CSP reporting enables real-time monitoring of:
 * - XSS attack attempts
 * - Malicious script injection
 * - Configuration errors in CSP policy
 * - Third-party integration issues
 *
 * @security Public endpoint (no auth required) - browsers send these reports automatically
 * Rate-limited to prevent DoS attacks
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#reporting_violations
 */
@ApiTags('Security')
@Controller('csp-report')
@UseGuards(ThrottlerGuard)
export class CspReportController {
  private readonly logger = new AppLoggerService();

  /**
   * Receive CSP violation report from browser
   *
   * @param report CSP violation report payload
   * @returns 204 No Content (per CSP spec)
   *
   * @example
   * POST /api/v1/csp-report
   * Content-Type: application/csp-report
   * {
   *   "csp-report": {
   *     "document-uri": "https://example.com/page",
   *     "violated-directive": "script-src 'self'",
   *     "blocked-uri": "https://evil.com/malicious.js",
   *     "source-file": "https://example.com/page",
   *     "line-number": "12",
   *     "column-number": "5"
   *   }
   * }
   */
  @ApiOperation({
    summary: 'Receive CSP violation report',
    description:
      'Public endpoint for browsers to report Content Security Policy violations. Rate limited to 100 reports per minute per IP.',
  })
  @ApiBody({ type: CspReportDto, description: 'CSP violation report from browser' })
  @ApiResponse({ status: 204, description: 'Report received and logged successfully' })
  @ApiResponse({ status: 429, description: 'Too many reports - rate limit exceeded' })
  @Post()
  @Public() // CSP reports come from browsers, not authenticated users
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 reports per minute per IP
  receiveReport(@Body() report: CspReportDto): void {
    const cspReport = report?.['csp-report'];

    // Guard against malformed or empty CSP reports
    if (cspReport === null || cspReport === undefined) {
      this.logger.security('CSP REPORT: Received malformed or empty report');
      return;
    }

    // Log CSP violation with full context
    this.logger.security(
      `CSP VIOLATION DETECTED: ${cspReport['violated-directive'] ?? 'unknown'} | ` +
        `Blocked URI: ${cspReport['blocked-uri'] ?? 'unknown'} | ` +
        `Document: ${cspReport['document-uri'] ?? 'unknown'} | ` +
        `Source: ${cspReport['source-file'] ?? 'unknown'}:${cspReport['line-number'] ?? '?'}:${cspReport['column-number'] ?? '?'}`,
    );

    // In production, you would:
    // 1. Store reports in database for analysis
    // 2. Send alerts for critical violations (e.g., Sentry, PagerDuty)
    // 3. Aggregate metrics for monitoring dashboards
    // 4. Trigger automated responses for severe attacks

    // TODO: Implement persistent storage
    // await this.cspReportService.storeViolation(cspReport);

    // TODO: Implement alerting for critical violations
    // if (this.isCriticalViolation(cspReport)) {
    //     await this.alertingService.sendSecurityAlert('CSP_VIOLATION', cspReport);
    // }
    void this._isCriticalViolation;
  }

  /**
   * Helper: Determine if violation is critical (requires immediate attention)
   *
   * @param report CSP violation report
   * @returns true if violation indicates active attack
   */
  private _isCriticalViolation(report: CspReportDto['csp-report']): boolean {
    const criticalDirectives = [
      'script-src', // Inline script injection
      'object-src', // Plugin-based attacks
      'base-uri', // Base tag injection
    ];

    const violatedDirective = report['violated-directive'] ?? '';
    return criticalDirectives.some((directive) => violatedDirective.includes(directive));
  }
}
