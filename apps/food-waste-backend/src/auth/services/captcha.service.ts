import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * CAPTCHA Response from Google reCAPTCHA API
 */
interface RecaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number; // reCAPTCHA v3 score (0.0 - 1.0)
  action?: string;
  'error-codes'?: string[];
}

/**
 * CAPTCHA Verification Result
 */
export interface CaptchaVerificationResult {
  isValid: boolean;
  score?: number | undefined;
  error?: string | undefined;
  hostname?: string | undefined;
}

/**
 * CAPTCHA Service
 * Enterprise-grade Google reCAPTCHA v3 integration
 *
 * @description Verifies CAPTCHA tokens to prevent bot attacks and brute force
 *
 * Features:
 * - Google reCAPTCHA v3 integration (score-based)
 * - Configurable score threshold (0.0 - 1.0)
 * - Fallback for missing secret keys (dev mode)
 * - Request caching to prevent duplicate verifications
 * - Detailed logging for security audits
 *
 * reCAPTCHA v3 Scores:
 * - 0.0 - 0.3: Bot (block)
 * - 0.3 - 0.7: Suspicious (require additional verification)
 * - 0.7 - 1.0: Human (allow)
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly secretKey: string;
  private readonly isEnabled: boolean;
  private readonly minScoreThreshold: number;
  private readonly verificationEndpoint = 'https://www.google.com/recaptcha/api/siteverify';

  // Cache verified tokens to prevent duplicate API calls (TTL: 5 minutes)
  private readonly verifiedTokensCache = new Map<string, { result: boolean; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY', '');
    this.isEnabled = this.configService.get<boolean>('CAPTCHA_ENABLED', false);
    this.minScoreThreshold = this.configService.get<number>('RECAPTCHA_MIN_SCORE', 0.5);

    if (this.isEnabled && !this.secretKey) {
      this.logger.warn(
        '⚠️ CAPTCHA is enabled but RECAPTCHA_SECRET_KEY is not configured. ' +
          'CAPTCHA verification will be skipped. Set RECAPTCHA_SECRET_KEY environment variable.',
      );
    }

    this.logger.log(
      `✅ CaptchaService initialized - ` +
        `Enabled: ${this.isEnabled}, ` +
        `Min Score: ${this.minScoreThreshold}`,
    );
  }

  /**
   * Verify CAPTCHA token from client
   *
   * @param token - reCAPTCHA token from client-side
   * @param expectedAction - Expected action name (optional, for v3)
   * @param remoteIp - User's IP address (optional)
   * @returns Verification result with score
   */
  async verifyCaptcha(
    token: string,
    expectedAction?: string,
    remoteIp?: string,
  ): Promise<CaptchaVerificationResult> {
    // CAPTCHA disabled - allow all requests
    if (!this.isEnabled) {
      return {
        isValid: true,
        score: 1.0,
      };
    }

    // Missing secret key - log warning and allow (fail-open for development)
    if (!this.secretKey) {
      this.logger.warn('CAPTCHA verification skipped - secret key not configured');
      return {
        isValid: true,
        score: 1.0,
      };
    }

    // Validate token format
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      this.logger.warn('Invalid CAPTCHA token format');
      return {
        isValid: false,
        error: 'Invalid CAPTCHA token',
      };
    }

    // Check cache for duplicate verification
    const cachedResult = this.getCachedVerification(token);
    if (cachedResult !== null) {
      this.logger.debug('CAPTCHA verification returned from cache');
      return {
        isValid: cachedResult,
        score: cachedResult ? 1.0 : 0.0,
      };
    }

    try {
      // Call Google reCAPTCHA API
      const response = await this.callRecaptchaApi(token, remoteIp);

      if (!response.success) {
        this.logger.warn('CAPTCHA verification failed', {
          errors: response['error-codes'],
          remoteIp,
        });

        return {
          isValid: false,
          error: this.getErrorMessage(response['error-codes']),
        };
      }

      // reCAPTCHA v3 score validation
      const score = response.score ?? 1.0;
      const isValid = score >= this.minScoreThreshold;

      // Validate action if provided (v3 feature)
      if (expectedAction && response.action !== expectedAction) {
        this.logger.warn('CAPTCHA action mismatch', {
          expected: expectedAction,
          received: response.action,
          remoteIp,
        });

        return {
          isValid: false,
          error: 'CAPTCHA action mismatch',
        };
      }

      // Cache result
      this.cacheVerification(token, isValid);

      // Log verification result
      this.logger.log(`CAPTCHA verification ${isValid ? 'passed' : 'failed'}`, {
        score,
        threshold: this.minScoreThreshold,
        action: response.action,
        hostname: response.hostname,
        remoteIp,
      });

      return {
        isValid,
        score,
        hostname: response.hostname,
      };
    } catch (error) {
      this.logger.error(
        'CAPTCHA verification error:',
        error instanceof Error ? error.stack : error,
      );

      // Fail-open: Allow request if CAPTCHA service is down
      // In production, consider failing closed (return false)
      return {
        isValid: true,
        score: 0.5,
        error: 'CAPTCHA service unavailable',
      };
    }
  }

  /**
   * Call Google reCAPTCHA API
   */
  private async callRecaptchaApi(token: string, remoteIp?: string): Promise<RecaptchaResponse> {
    const params = new URLSearchParams({
      secret: this.secretKey,
      response: token,
      ...(remoteIp && { remoteip: remoteIp }),
    });

    const response$ = this.httpService.post<RecaptchaResponse>(
      this.verificationEndpoint,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 5000, // 5 second timeout
      },
    );

    const response = await firstValueFrom(response$);
    return response.data;
  }

  /**
   * Get cached verification result
   */
  private getCachedVerification(token: string): boolean | null {
    const cached = this.verifiedTokensCache.get(token);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL_MS) {
      this.verifiedTokensCache.delete(token);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache verification result
   */
  private cacheVerification(token: string, result: boolean): void {
    this.verifiedTokensCache.set(token, {
      result,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of this.verifiedTokensCache.entries()) {
      if (value.timestamp < tenMinutesAgo) {
        this.verifiedTokensCache.delete(key);
      }
    }
  }

  /**
   * Get human-readable error message from reCAPTCHA error codes
   */
  private getErrorMessage(errorCodes?: string[]): string {
    if (!errorCodes?.length) {
      return 'CAPTCHA verification failed';
    }

    const errorMessages: Record<string, string> = {
      'missing-input-secret': 'Server configuration error',
      'invalid-input-secret': 'Server configuration error',
      'missing-input-response': 'CAPTCHA token is missing',
      'invalid-input-response': 'CAPTCHA token is invalid or expired',
      'bad-request': 'Invalid request',
      'timeout-or-duplicate': 'CAPTCHA token has expired or was already used',
    };

    const firstError = errorCodes[0] ?? '';
    return errorMessages[firstError] ?? 'CAPTCHA verification failed';
  }

  /**
   * Clear cache (for testing or manual intervention)
   */
  clearCache(): void {
    this.verifiedTokensCache.clear();
    this.logger.log('CAPTCHA verification cache cleared');
  }

  /**
   * Health check for monitoring
   */
  getStatus(): {
    enabled: boolean;
    hasSecretKey: boolean;
    minScore: number;
    cacheSize: number;
  } {
    return {
      enabled: this.isEnabled,
      hasSecretKey: !!this.secretKey,
      minScore: this.minScoreThreshold,
      cacheSize: this.verifiedTokensCache.size,
    };
  }
}
