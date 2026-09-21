import * as crypto from 'crypto';

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { Model } from 'mongoose';
import { Twilio } from 'twilio';

import { RedisService } from '../../redis/redis.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { OptOutRequestDto, OptInRequestDto } from '../dto/opt-out.dto';
import { INotificationProvider, NotificationResult } from '../interfaces/notification.interfaces';
import {
  TwilioWebhookData,
  TwilioMessageResponse,
  OrderData,
  ReminderData,
} from '../interfaces/sms.interfaces';
import { OptOutReason, OptOutScope } from '../schemas/opt-out-record.schema';
import {
  NotificationTarget,
  NotificationPayload,
  NotificationStatus,
} from '../types/notification.types';

import { OptOutManagerService } from './opt-out-manager.service';
import { PhoneValidatorService } from './phone-validator.service';

type RedisClient = Awaited<ReturnType<RedisService['getClient']>>;

// Enterprise-grade interfaces for type safety
interface IBalanceData {
  balance: number;
  timestamp: number;
  accountSid: string;
}

interface IUsageEstimateData {
  estimatedSMSCount: number;
  estimatedHourlyRate: number;
  balanceDifference: number;
  hoursElapsed: number;
  averageSMSCost: number;
  timestamp: number;
  reliability: string;
}

interface NotificationPhoneLookup {
  _id: unknown;
  metadata?: {
    phone?: string;
    [key: string]: unknown;
  };
}

interface RetryableSmsNotification {
  _id: unknown;
  metadata?: {
    retryCount?: number;
    maxRetries?: number;
    messageId?: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class SmsNotificationService implements INotificationProvider {
  private readonly logger = new Logger(SmsNotificationService.name);
  private twilioClient: Twilio | null = null;
  private readonly fromNumber: string;
  private readonly requirePhoneVerification: boolean;
  private readonly smsEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly phoneValidator: PhoneValidatorService,
    private readonly optOutManager: OptOutManagerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') ?? '';
    this.requirePhoneVerification = this.configService.get<boolean>(
      'SMS_REQUIRE_PHONE_VERIFICATION',
      true,
    );

    this.smsEnabled = this.configService.get<boolean>('SMS_ENABLED', false);

    this.logger.log('✅ SmsNotificationService initialized with shared RedisService');

    if (!this.smsEnabled) {
      // Deliberate, not degraded. Skipping the whole init is the point: the
      // connectivity probe alone cost ~8.3s of every boot and logged four
      // ERROR lines per worker, which on a cold start is time the mobile
      // client spends waiting on its first request.
      this.logger.log('SMS delivery is disabled (SMS_ENABLED=false) - Twilio will not be created', {
        serviceStatus: 'disabled',
        reEnableWith: 'SMS_ENABLED=true plus TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER',
      });
      return;
    }

    // Initialize Twilio asynchronously (non-blocking)
    this.initializeTwilio().catch(error => {
      this.logger.error('Failed to initialize Twilio service', {
        error: (error as Error).message,
        impact: 'service_degraded',
      });
      this.twilioClient = null;
    });
  }

  /**
   * Whether SMS delivery is switched on for this environment.
   *
   * Callers that own a user-facing flow (the phone-OTP endpoints) read this
   * *before* doing any work, so a disabled service costs no DB write and no
   * rate-limit slot. Callers that merely want to notify can ignore it and take
   * the `success: false` result the send methods return.
   */
  isSmsEnabled(): boolean {
    return this.smsEnabled;
  }

  /**
   * The single result every send path returns while SMS is off.
   *
   * `success: false` is deliberate. The alternative - reporting a send that
   * never happened - is how the mock branch in `sendSms` used to behave, and a
   * notification record saying "sent" for a message nobody received is worse
   * than no record at all.
   */
  private smsDisabledResult(context: string): NotificationResult {
    this.logger.debug('SMS skipped - delivery disabled by configuration', { context });

    return {
      success: false,
      error: 'SMS delivery is disabled',
    };
  }

  /**
   * Get Redis client from shared service
   */
  private async getRedisClient(): Promise<RedisClient | null> {
    try {
      if (!this.redisService.isConnected()) {
        return null;
      }
      return await this.redisService.getClient();
    } catch {
      this.logger.warn('Failed to get Redis client for SMS service');
      return null;
    }
  }

  private getTwilioClientOrThrow(context: string): Twilio {
    if (this.twilioClient === null) {
      throw new Error(`Twilio client not initialized for ${context}`);
    }

    return this.twilioClient;
  }

  private async initializeTwilio(): Promise<void> {
    const initStartTime = Date.now();

    try {
      // Retrieve and validate credentials
      const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      const isDevelopmentMode = this.configService.get<string>('NODE_ENV') !== 'production';

      // Enhanced credential validation
      const credentialValidation = this.validateTwilioCredentials(accountSid, authToken);

      if (!credentialValidation.isValid) {
        if (isDevelopmentMode) {
          this.logger.warn('Twilio credentials not configured - running in development mode', {
            reason: credentialValidation.reason,
            developmentMode: true,
            serviceStatus: 'mock',
          });
          this.twilioClient = null;
          return;
        }
        // In production, credential issues are critical
        this.logger.error('Twilio credentials validation failed in production environment', {
          reason: credentialValidation.reason,
          environment: 'production',
          securityEvent: true,
        });
        throw new Error(`Twilio service initialization failed: ${credentialValidation.reason}`);
      }

      // Validate phone number configuration
      if (!this.fromNumber || !this.validatePhoneNumberFormat(this.fromNumber)) {
        const errorMsg = !this.fromNumber
          ? 'TWILIO_PHONE_NUMBER not configured'
          : 'TWILIO_PHONE_NUMBER format is invalid (must be E.164 format)';

        this.logger.error(errorMsg, {
          phoneNumberConfigured: !!this.fromNumber,
          phoneNumberMasked: this.fromNumber
            ? this.phoneValidator.maskPhoneNumber(this.fromNumber)
            : null,
          requiredFormat: 'E.164 (+1234567890)',
          environment: this.configService.get<string>('NODE_ENV', 'development'),
        });

        if (isDevelopmentMode) {
          this.logger.warn(
            `Phone number configuration error in development mode - continuing with degraded service: ${errorMsg}`,
            {
              serviceStatus: 'degraded',
              developmentMode: true,
            },
          );
          this.twilioClient = null;
          return;
        }

        throw new Error(`Phone number configuration error: ${errorMsg}`);
      }

      // Initialize Twilio client with retry mechanism
      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials missing after validation');
      }

      await this.initializeTwilioClientWithRetry(accountSid, authToken, 3);

      // Verify connectivity and service health
      await this.verifyTwilioConnectivity();

      this.logger.log('Twilio service initialized successfully', {
        initializationTime: Date.now() - initStartTime,
        phoneNumberMasked: this.phoneValidator.maskPhoneNumber(this.fromNumber),
        environment: process.env['NODE_ENV'],
        serviceStatus: 'operational',
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorStack = (error as Error).stack;
      const isDevelopmentMode = this.configService.get<string>('NODE_ENV') !== 'production';

      this.logger.error('Critical failure during Twilio service initialization', {
        error: errorMessage,
        errorStack,
        initializationTime: Date.now() - initStartTime,
        environment: process.env['NODE_ENV'],
        serviceStatus: 'failed',
      });

      // Emit failure event for monitoring systems
      this.eventEmitter.emit('sms.service.initialization.failed', {
        service: 'twilio',
        error: errorMessage,
        timestamp: new Date(),
        environment: process.env['NODE_ENV'],
      });

      // In development mode, allow the service to continue in degraded mode
      if (isDevelopmentMode) {
        this.logger.warn(
          'Twilio service failed to initialize in development mode - continuing with degraded service',
          {
            error: errorMessage,
            serviceStatus: 'degraded',
            developmentMode: true,
          },
        );
        this.twilioClient = null;
        return;
      }

      throw error;
    }
  }

  /**
   * Validates Twilio credentials format and security requirements
   */
  private validateTwilioCredentials(
    accountSid?: string,
    authToken?: string,
  ): { isValid: boolean; reason: string } {
    if (!accountSid || !authToken) {
      return {
        isValid: false,
        reason: 'Missing required credentials (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)',
      };
    }

    // Validate Account SID format (Twilio format: AC followed by 32 hex characters)
    if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid)) {
      this.logger.warn('Invalid Twilio Account SID format detected', {
        sidLength: accountSid.length,
        sidPrefix: accountSid.substring(0, 2),
        securityEvent: true,
      });
      return {
        isValid: false,
        reason: 'Account SID format is invalid (must be AC followed by 32 hex characters)',
      };
    }

    // Validate Auth Token format (32 character hex string)
    if (!/^[a-fA-F0-9]{32}$/.test(authToken)) {
      this.logger.warn('Invalid Twilio Auth Token format detected', {
        tokenLength: authToken.length,
        securityEvent: true,
      });
      return {
        isValid: false,
        reason: 'Auth Token format is invalid (must be 32 hex characters)',
      };
    }

    // Additional security validation - check for common security issues
    if (accountSid.includes('test') || authToken.includes('test')) {
      this.logger.warn('Test credentials detected in configuration', {
        environment: process.env['NODE_ENV'],
        securityEvent: true,
      });
      return {
        isValid: false,
        reason: 'Test credentials detected - production requires valid Twilio credentials',
      };
    }

    return { isValid: true, reason: 'Credentials are valid' };
  }

  /**
   * Validates phone number format for Twilio compatibility
   */
  private validatePhoneNumberFormat(phoneNumber: string): boolean {
    if (!phoneNumber) {
      return false;
    }

    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    const isValidFormat = e164Regex.test(phoneNumber);

    if (!isValidFormat) {
      this.logger.warn('Invalid phone number format for Twilio service', {
        phoneNumberMasked: this.phoneValidator.maskPhoneNumber(phoneNumber),
        requiredFormat: 'E.164',
        actualFormat: phoneNumber.startsWith('+') ? 'E.164-like' : 'Non-E.164',
      });
    }

    return isValidFormat;
  }

  /**
   * Initializes Twilio client with retry mechanism and error handling
   * Production-grade initialization with exponential backoff
   */
  private async initializeTwilioClientWithRetry(
    accountSid: string,
    authToken: string,
    maxRetries: number = 3,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Twilio client initialization attempt ${attempt}/${maxRetries}`, {
          attempt,
          maxRetries,
        });

        // Create Twilio client instance
        this.twilioClient = new Twilio(accountSid, authToken);

        // If we reach here without exception, initialization succeeded
        this.logger.debug('Twilio client instance created successfully', {
          attempt,
          clientInitialized: this.twilioClient !== null,
        });

        return;
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === maxRetries;

        this.logger.warn(`Twilio client initialization attempt ${attempt} failed`, {
          attempt,
          maxRetries,
          error: lastError.message,
          isLastAttempt,
          willRetry: !isLastAttempt,
        });

        if (isLastAttempt) {
          break;
        }

        // Exponential backoff delay: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // If we reach here, all attempts failed
    this.logger.error('Failed to initialize Twilio client after all retry attempts', {
      maxRetries,
      finalError: lastError?.message,
      finalErrorStack: lastError?.stack,
    });

    throw new Error(
      `Twilio client initialization failed after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Verifies Twilio connectivity and service health
   * Production-grade health check with comprehensive validation
   */
  private async verifyTwilioConnectivity(): Promise<void> {
    if (this.twilioClient === null) {
      throw new Error('Cannot verify connectivity - Twilio client not initialized');
    }

    const connectivityStartTime = Date.now();

    try {
      this.logger.debug('Starting Twilio connectivity verification', {
        serviceCheck: 'account_details',
      });

      // Test 1: Verify account access and details
      const account = await this.twilioClient.api.v2010
        .accounts(this.twilioClient.accountSid)
        .fetch();

      if (account?.status !== 'active') {
        throw new Error(`Twilio account is not active (status: ${account?.status || 'unknown'})`);
      }

      this.logger.debug('Twilio account verification successful', {
        accountStatus: account.status,
        accountType: account.type,
        connectivityCheck: 'passed',
      });

      // Test 2: Verify phone number ownership and capabilities
      await this.verifyPhoneNumberCapabilities();

      // Test 3: Check service limits and quotas
      await this.checkServiceLimits();

      const connectivityTime = Date.now() - connectivityStartTime;

      this.logger.log('Twilio connectivity verification completed successfully', {
        connectivityTime,
        accountStatus: account.status,
        phoneNumberVerified: true,
        serviceHealth: 'operational',
      });

      // Emit success event for monitoring
      this.eventEmitter.emit('sms.service.connectivity.verified', {
        service: 'twilio',
        connectivityTime,
        timestamp: new Date(),
        status: 'healthy',
      });
    } catch (error) {
      const connectivityTime = Date.now() - connectivityStartTime;
      const errorMessage = (error as Error).message;

      this.logger.error('Twilio connectivity verification failed', {
        error: errorMessage,
        connectivityTime,
        serviceHealth: 'degraded',
      });

      // Emit failure event for monitoring
      this.eventEmitter.emit('sms.service.connectivity.failed', {
        service: 'twilio',
        error: errorMessage,
        connectivityTime,
        timestamp: new Date(),
        status: 'unhealthy',
      });

      throw new Error(`Twilio connectivity verification failed: ${errorMessage}`);
    }
  }

  /**
   * Verifies phone number capabilities and ownership
   */
  private async verifyPhoneNumberCapabilities(): Promise<void> {
    try {
      const twilioClient = this.getTwilioClientOrThrow('phone number verification');
      const phoneNumber = await twilioClient.incomingPhoneNumbers.list({
        phoneNumber: this.fromNumber,
        limit: 1,
      });

      if (phoneNumber.length === 0) {
        throw new Error(
          `Phone number ${this.phoneValidator.maskPhoneNumber(this.fromNumber)} is not owned by this Twilio account`,
        );
      }

      const twilioPhoneNumber = phoneNumber[0];
      if (!twilioPhoneNumber) {
        throw new Error(
          `Phone number ${this.phoneValidator.maskPhoneNumber(this.fromNumber)} is not owned by this Twilio account`,
        );
      }

      const capabilities = twilioPhoneNumber.capabilities;
      if (!capabilities.sms) {
        throw new Error(
          `Phone number ${this.phoneValidator.maskPhoneNumber(this.fromNumber)} does not support SMS`,
        );
      }

      this.logger.debug('Phone number capabilities verified', {
        phoneNumberMasked: this.phoneValidator.maskPhoneNumber(this.fromNumber),
        smsCapable: capabilities.sms,
        voiceCapable: capabilities.voice,
        mmsCapable: capabilities.mms,
      });
    } catch (error) {
      this.logger.error('Phone number verification failed', {
        phoneNumberMasked: this.phoneValidator.maskPhoneNumber(this.fromNumber),
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Checks Twilio service limits and quotas with comprehensive monitoring
   * Enterprise-grade service monitoring with proper error handling
   */
  private async checkServiceLimits(): Promise<void> {
    const limitsCheckStartTime = Date.now();

    try {
      const twilioClient = this.getTwilioClientOrThrow('service limits check');

      // Fetch account details for service monitoring
      const account = await twilioClient.api.v2010.accounts(twilioClient.accountSid).fetch();

      // Check account balance if available
      await this.checkAccountBalance();

      // Check usage limits and quotas
      await this.checkUsageLimits();

      // Check API rate limits status
      await this.checkRateLimitStatus();

      const limitsCheckTime = Date.now() - limitsCheckStartTime;

      this.logger.debug('Service limits check completed successfully', {
        accountStatus: account.status,
        accountType: account.type,
        limitsCheckTime,
        serviceMonitoring: 'operational',
      });

      // Emit monitoring event for external systems
      this.eventEmitter.emit('sms.service.limits.checked', {
        service: 'twilio',
        accountStatus: account.status,
        limitsCheckTime,
        timestamp: new Date(),
        status: 'healthy',
      });
    } catch (error) {
      const limitsCheckTime = Date.now() - limitsCheckStartTime;
      const errorMessage = (error as Error).message;

      this.logger.warn('Service limits check encountered issues (non-critical)', {
        error: errorMessage,
        limitsCheckTime,
        impact: 'monitoring_degraded',
        serviceStatus: 'partially_available',
      });

      // Emit warning event but don't throw - this is monitoring only
      this.eventEmitter.emit('sms.service.limits.warning', {
        service: 'twilio',
        error: errorMessage,
        limitsCheckTime,
        timestamp: new Date(),
        status: 'degraded',
      });
    }
  }

  /**
   * Checks account balance with proper error handling
   * Production-grade balance monitoring with thresholds
   */
  private async checkAccountBalance(): Promise<void> {
    try {
      const twilioClient = this.getTwilioClientOrThrow('account balance check');

      // Fetch balance information using the correct Twilio API
      const balances = await twilioClient.api.v2010
        .accounts(twilioClient.accountSid)
        .balance.fetch();

      if (balances === null || balances === undefined) {
        this.logger.debug('Balance information not available', {
          reason: 'api_limitation',
          impact: 'monitoring_only',
        });
        return;
      }

      // Type-safe balance processing
      const balanceValue = balances.balance;
      let currentBalance = 0;

      if (balanceValue) {
        if (typeof balanceValue === 'string') {
          const parsed = parseFloat(balanceValue);
          currentBalance = isNaN(parsed) ? 0 : parsed;
        } else if (typeof balanceValue === 'number') {
          currentBalance = isNaN(balanceValue) ? 0 : balanceValue;
        }
      }

      // Type-safe currency handling
      const currency = (balances as { currency?: string }).currency ?? 'USD';

      this.logger.debug('Account balance retrieved successfully', {
        balance: currentBalance,
        currency,
        balanceStatus: currentBalance > 0 ? 'positive' : 'zero_or_negative',
      });

      // Enterprise-grade balance monitoring with configurable thresholds
      const lowBalanceThreshold = this.configService.get<number>(
        'TWILIO_LOW_BALANCE_THRESHOLD',
        10.0,
      );
      const criticalBalanceThreshold = this.configService.get<number>(
        'TWILIO_CRITICAL_BALANCE_THRESHOLD',
        2.0,
      );

      if (currentBalance <= criticalBalanceThreshold) {
        this.logger.error('Critical Twilio account balance detected', {
          balance: currentBalance,
          currency,
          threshold: criticalBalanceThreshold,
          severity: 'critical',
          action_required: 'immediate_attention',
        });

        // Emit critical alert for immediate attention
        this.eventEmitter.emit('sms.service.balance.critical', {
          service: 'twilio',
          balance: currentBalance,
          currency,
          threshold: criticalBalanceThreshold,
          timestamp: new Date(),
          severity: 'critical',
        });
      } else if (currentBalance <= lowBalanceThreshold) {
        this.logger.warn('Low Twilio account balance detected', {
          balance: currentBalance,
          currency,
          threshold: lowBalanceThreshold,
          severity: 'warning',
          action_required: 'monitoring',
        });

        // Emit warning for proactive monitoring
        this.eventEmitter.emit('sms.service.balance.low', {
          service: 'twilio',
          balance: currentBalance,
          currency,
          threshold: lowBalanceThreshold,
          timestamp: new Date(),
          severity: 'warning',
        });
      }
    } catch (error) {
      this.logger.debug('Balance check unavailable (non-critical)', {
        error: (error as Error).message,
        reason: 'api_limitation_or_permissions',
        impact: 'monitoring_only',
      });
      // Don't throw - balance information may not always be available
    }
  }

  /**
   * Checks usage limits and quotas
   * Enterprise-grade usage monitoring for capacity planning
   */
  private async checkUsageLimits(): Promise<void> {
    try {
      // Use the correct Twilio API structure for usage records
      // Note: Twilio usage API structure varies by SDK version
      await this.checkUsageRecordsWithFallback();
    } catch (error) {
      this.logger.debug('Usage limits check unavailable (non-critical)', {
        error: (error as Error).message,
        reason: 'api_limitation_or_permissions',
        impact: 'monitoring_only',
      });
      // Don't throw - usage information may not always be available
    }
  }

  /**
   * Checks usage records with multiple API approaches for compatibility
   * Production-grade fallback mechanism for different Twilio SDK versions
   */
  private async checkUsageRecordsWithFallback(): Promise<void> {
    try {
      // Primary approach: Use correct Twilio usage API with proper parameter structure
      await this.fetchUsageWithCorrectAPI();
    } catch (primaryError) {
      this.logger.debug('Primary usage API failed, trying alternative approaches', {
        error: (primaryError as Error).message,
        fallbackAttempt: 'alternative_monitoring',
      });

      // Fallback approach: Use message-based monitoring instead
      await this.checkAccountActivityAsUsageProxy();
    }
  }

  /**
   * Fetches usage data using the correct Twilio API structure
   * Enterprise-grade implementation with proper TypeScript compliance
   */
  private async fetchUsageWithCorrectAPI(): Promise<void> {
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    try {
      const twilioClient = this.getTwilioClientOrThrow('usage fetch');

      // Method 1: Try with minimal parameters (most compatible)
      const usage = await twilioClient.usage.records.list({
        limit: 20,
      });

      if (usage.length > 0) {
        // Filter for SMS records manually
        const smsRecords = this.filterSMSUsageRecords(usage, startOfMonth);
        if (smsRecords.length > 0) {
          this.processUsageRecords(smsRecords);
          return;
        }
      }

      this.logger.debug('No recent usage records found, trying alternative method', {
        totalRecords: usage?.length || 0,
        period: 'recent',
      });

      // Method 2: Try today's usage with different approach
      await this.fetchTodaysUsage();
    } catch (apiError) {
      this.logger.debug('Usage API call failed with error', {
        error: (apiError as Error).message,
        errorType: (apiError as Error).constructor.name,
      });

      // Method 3: Use account balance changes as usage indicator
      await this.estimateUsageFromAccountChanges();
    }
  }

  /**
   * Filters usage records for SMS-related categories within date range
   * Production-grade filtering with comprehensive SMS category detection
   */
  private filterSMSUsageRecords(records: unknown[], startDate: Date): unknown[] {
    const isValidRecord = (
      record: unknown,
    ): record is {
      category: string;
      startDate?: string | Date;
      endDate?: string | Date;
      count?: string;
      price?: string;
      priceUnit?: string;
    } =>
      typeof record === 'object' &&
      record !== null &&
      'category' in record &&
      typeof (record as { category: unknown }).category === 'string';

    const validRecords = records.filter(isValidRecord);

    // Filter for SMS-related categories
    const smsCategories = [
      'sms',
      'sms-outbound',
      'sms-inbound',
      'sms-messages',
      'sms-messages-outbound',
      'sms-messages-inbound',
    ];

    const smsRecords = validRecords.filter(record => {
      const isSMSCategory = smsCategories.some(category =>
        record.category.toLowerCase().includes(category.toLowerCase()),
      );

      if (!isSMSCategory) {
        return false;
      }

      // Check date range if available
      if (record.startDate !== undefined) {
        try {
          const recordDate = new Date(record.startDate);
          return recordDate >= startDate;
        } catch {
          // If date parsing fails, include the record
          return true;
        }
      }

      return true;
    });

    this.logger.debug('SMS usage records filtered', {
      totalRecords: validRecords.length,
      smsRecords: smsRecords.length,
      categories: smsRecords.map(r => r.category),
      dateFilter: startDate.toISOString(),
    });

    return smsRecords;
  }

  /**
   * Fetches today's usage as an alternative monitoring approach
   * Production-grade current usage monitoring
   */
  private async fetchTodaysUsage(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twilioClient = this.getTwilioClientOrThrow("today's usage fetch");

      // Get today's usage with minimal parameters
      const todayUsage = await twilioClient.usage.records.list({
        limit: 50,
      });

      if (todayUsage.length > 0) {
        // Look for recent SMS activity
        const recentSMSActivity = this.filterSMSUsageRecords(todayUsage, today);

        if (recentSMSActivity.length > 0) {
          this.logger.debug('Recent SMS activity detected', {
            recordsFound: recentSMSActivity.length,
            period: 'today',
          });

          this.processUsageRecords(recentSMSActivity);
          return;
        }
      }

      this.logger.debug("No recent SMS usage found in today's records", {
        totalRecords: todayUsage?.length || 0,
      });
    } catch (error) {
      this.logger.debug("Today's usage fetch failed (non-critical)", {
        error: (error as Error).message,
        fallback: 'activity_proxy',
      });
    }
  }

  /**
   * Estimates usage from account balance changes using Redis for historical data
   * Enterprise-grade usage estimation with persistent balance tracking
   */
  private async estimateUsageFromAccountChanges(): Promise<void> {
    try {
      const twilioClient = this.getTwilioClientOrThrow('usage estimation');

      // Fetch current account balance using correct API
      const account = await twilioClient.api.v2010.accounts(twilioClient.accountSid).fetch();

      if (account.balance === null) {
        this.logger.debug('Account balance not available for usage estimation', {
          accountExists: account !== null,
          balanceExists: account.balance !== null,
        });
        return;
      }

      // Type-safe balance parsing with validation
      const balanceValue = account.balance;
      if (typeof balanceValue !== 'string' && typeof balanceValue !== 'number') {
        this.logger.warn('Invalid balance type received from Twilio API', {
          balanceType: typeof balanceValue,
          balanceValue,
        });
        return;
      }

      const currentBalance =
        typeof balanceValue === 'string' ? parseFloat(balanceValue) : balanceValue;

      // Validate parsed balance
      if (isNaN(currentBalance)) {
        this.logger.warn('Invalid balance value received from Twilio API', {
          balanceValue,
          parsedValue: currentBalance,
        });
        return;
      }
      const currentTimestamp = Date.now();
      const balanceKey = `twilio:balance:${twilioClient.accountSid}`;
      const usageEstimateKey = `twilio:usage:estimate:${twilioClient.accountSid}`;

      // Get previous balance from Redis
      const previousBalanceData = await this.getBalanceFromRedis(balanceKey);

      if (previousBalanceData) {
        // Calculate estimated usage based on balance difference
        const balanceDifference = previousBalanceData.balance - currentBalance;
        const timeDifference = currentTimestamp - previousBalanceData.timestamp;
        const hoursElapsed = timeDifference / (1000 * 60 * 60);

        if (balanceDifference > 0 && hoursElapsed > 0) {
          // Estimate SMS count based on average SMS cost (configurable)
          const averageSMSCost = this.configService.get<number>('TWILIO_AVERAGE_SMS_COST', 0.0075);
          const estimatedSMSCount = Math.round(balanceDifference / averageSMSCost);
          const estimatedHourlyRate = estimatedSMSCount / hoursElapsed;

          this.logger.debug('Usage estimated from balance changes', {
            balanceDifference: balanceDifference.toFixed(4),
            hoursElapsed: hoursElapsed.toFixed(2),
            estimatedSMSCount,
            estimatedHourlyRate: estimatedHourlyRate.toFixed(2),
            averageSMSCost,
            estimationMethod: 'balance_tracking',
          });

          // Store usage estimate in Redis
          await this.storeUsageEstimate(usageEstimateKey, {
            estimatedSMSCount,
            estimatedHourlyRate,
            balanceDifference,
            hoursElapsed,
            averageSMSCost,
            timestamp: currentTimestamp,
            reliability: 'medium',
          });

          // Check if estimated usage exceeds thresholds
          this.checkEstimatedUsageThresholds(estimatedSMSCount, estimatedHourlyRate);

          // Emit monitoring event with estimation details
          this.eventEmitter.emit('sms.service.usage.estimated', {
            service: 'twilio',
            estimatedSMSCount,
            estimatedHourlyRate,
            balanceDifference,
            currentBalance,
            timestamp: new Date(),
            method: 'balance_tracking',
            reliability: 'medium',
          });
        }
      }

      // Store current balance for future comparison
      await this.storeBalanceInRedis(balanceKey, {
        balance: currentBalance,
        timestamp: currentTimestamp,
        accountSid: twilioClient.accountSid,
      });

      this.logger.debug('Account balance stored for future usage estimation', {
        balance: currentBalance,
        timestamp: new Date(currentTimestamp).toISOString(),
        estimationMethod: 'balance_tracking',
        redisAvailable: !!(await this.getRedisClient()),
      });
    } catch (error) {
      this.logger.debug('Balance-based usage estimation failed (non-critical)', {
        error: (error as Error).message,
        errorType: (error as Error).constructor.name,
        impact: 'monitoring_degraded',
      });
    }
  }

  /**
   * Retrieves previous balance data from Redis
   * Production-grade Redis data retrieval with error handling
   */
  private async getBalanceFromRedis(key: string): Promise<IBalanceData | null> {
    const redisClient = await this.getRedisClient();
    if (!redisClient) {
      return null;
    }

    try {
      const data = await redisClient.get(key);
      if (!data || typeof data !== 'string') {
        return null;
      }

      // Type-safe JSON parsing with validation
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch (parseError) {
        this.logger.warn('Failed to parse balance data from Redis', {
          key,
          error: (parseError as Error).message,
          dataLength: data.length,
        });
        return null;
      }

      // Type guard for balance data validation
      const isValidBalanceData = (obj: unknown): obj is IBalanceData => {
        if (typeof obj !== 'object' || obj === null) {
          return false;
        }

        const record = obj as Record<string, unknown>;
        return (
          typeof record['balance'] === 'number' &&
          typeof record['timestamp'] === 'number' &&
          typeof record['accountSid'] === 'string' &&
          !isNaN(record['balance']) &&
          !isNaN(record['timestamp']) &&
          record['accountSid'].length > 0
        );
      };

      if (isValidBalanceData(parsed)) {
        return parsed;
      }

      this.logger.warn('Invalid balance data structure in Redis', {
        key,
        dataType: typeof parsed,
        dataStructure:
          parsed !== null && parsed !== undefined && typeof parsed === 'object'
            ? Object.keys(parsed as Record<string, unknown>)
            : 'not_object',
      });
      return null;
    } catch (error) {
      this.logger.debug('Failed to retrieve balance from Redis', {
        key,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Stores balance data in Redis with expiration
   * Enterprise-grade Redis data storage with TTL
   */
  private async storeBalanceInRedis(key: string, data: IBalanceData): Promise<void> {
    const redisClient = await this.getRedisClient();
    if (!redisClient) {
      return;
    }

    try {
      const serializedData = JSON.stringify(data);
      const ttlHours = this.configService.get<number>('TWILIO_BALANCE_CACHE_TTL_HOURS', 168); // 7 days default

      await redisClient.setEx(key, ttlHours * 3600, serializedData);

      this.logger.debug('Balance data stored in Redis', {
        key,
        balance: data.balance,
        ttlHours,
      });
    } catch (error) {
      this.logger.debug('Failed to store balance in Redis', {
        key,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Stores usage estimation data in Redis
   * Production-grade usage metrics storage for analysis
   */
  private async storeUsageEstimate(key: string, data: IUsageEstimateData): Promise<void> {
    const redisClient = await this.getRedisClient();
    if (!redisClient) {
      return;
    }

    try {
      // Store as a time-series entry
      const timeSeriesKey = `${key}:timeseries`;
      const entryKey = `${data.timestamp}`;

      await redisClient.hSet(timeSeriesKey, entryKey, JSON.stringify(data));

      // Set expiration for the entire hash (30 days)
      await redisClient.expire(timeSeriesKey, 30 * 24 * 3600);

      // Also store latest estimate
      await redisClient.setEx(key, 24 * 3600, JSON.stringify(data));

      this.logger.debug('Usage estimate stored in Redis', {
        key,
        estimatedSMSCount: data.estimatedSMSCount,
        reliability: data.reliability,
      });
    } catch (error) {
      this.logger.debug('Failed to store usage estimate in Redis', {
        key,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Checks estimated usage against configured thresholds
   * Enterprise-grade threshold monitoring for estimated metrics
   */
  private checkEstimatedUsageThresholds(
    estimatedSMSCount: number,
    estimatedHourlyRate: number,
  ): void {
    const hourlyThreshold = this.configService.get<number>('TWILIO_ESTIMATED_HOURLY_THRESHOLD', 50);
    const dailyThreshold = this.configService.get<number>('TWILIO_ESTIMATED_DAILY_THRESHOLD', 500);

    // Calculate estimated daily usage based on hourly rate
    const estimatedDailyUsage = estimatedHourlyRate * 24;

    if (estimatedHourlyRate > hourlyThreshold) {
      this.logger.warn('High estimated hourly SMS rate detected', {
        estimatedHourlyRate: estimatedHourlyRate.toFixed(2),
        threshold: hourlyThreshold,
        estimationMethod: 'balance_tracking',
        severity: 'warning',
      });

      this.eventEmitter.emit('sms.service.usage.estimated.high', {
        service: 'twilio',
        estimatedHourlyRate,
        threshold: hourlyThreshold,
        estimatedSMSCount,
        timestamp: new Date(),
        severity: 'warning',
        type: 'hourly',
      });
    }

    if (estimatedDailyUsage > dailyThreshold) {
      this.logger.warn('High estimated daily SMS usage detected', {
        estimatedDailyUsage: estimatedDailyUsage.toFixed(0),
        threshold: dailyThreshold,
        estimationMethod: 'balance_tracking',
        severity: 'warning',
      });

      this.eventEmitter.emit('sms.service.usage.estimated.high', {
        service: 'twilio',
        estimatedDailyUsage,
        threshold: dailyThreshold,
        estimatedHourlyRate,
        timestamp: new Date(),
        severity: 'warning',
        type: 'daily',
      });
    }
  }

  /**
   * Processes usage records and emits monitoring events
   * Enterprise-grade usage analysis with threshold monitoring
   */
  private processUsageRecords(usage: unknown[]): void {
    // Type guard for usage record validation
    const isValidUsageRecord = (
      record: unknown,
    ): record is {
      category: string;
      count?: string;
      price?: string;
      priceUnit?: string;
    } =>
      typeof record === 'object' &&
      record !== null &&
      'category' in record &&
      typeof (record as { category: unknown }).category === 'string';

    const validRecords = usage.filter(isValidUsageRecord);

    const smsUsage = validRecords.find(
      record =>
        record.category === 'sms' ||
        record.category === 'sms-outbound' ||
        record.category === 'sms-inbound',
    );

    if (!smsUsage) {
      this.logger.debug('No SMS usage records found in the response', {
        totalRecords: usage.length,
        validRecords: validRecords.length,
        categories: validRecords.map(r => r.category).join(', '),
      });
      return;
    }

    const usageCount = Number.parseInt(smsUsage.count ?? '0', 10);
    const usageCost = Number.parseFloat(smsUsage.price ?? '0');
    const currency = smsUsage.priceUnit ?? 'USD';

    this.logger.debug('SMS usage statistics retrieved successfully', {
      monthlyUsage: usageCount,
      monthlyCost: usageCost,
      currency,
      period: 'current_month',
      category: smsUsage.category,
    });

    // Configurable usage thresholds for monitoring
    const highUsageThreshold = this.configService.get<number>('TWILIO_HIGH_USAGE_THRESHOLD', 1000);
    const criticalUsageThreshold = this.configService.get<number>(
      'TWILIO_CRITICAL_USAGE_THRESHOLD',
      5000,
    );

    if (usageCount > criticalUsageThreshold) {
      this.logger.error('Critical SMS usage detected for current month', {
        usage: usageCount,
        threshold: criticalUsageThreshold,
        cost: usageCost,
        currency,
        severity: 'critical',
        monitoring: 'immediate_attention_required',
      });

      this.eventEmitter.emit('sms.service.usage.critical', {
        service: 'twilio',
        usage: usageCount,
        cost: usageCost,
        currency,
        threshold: criticalUsageThreshold,
        timestamp: new Date(),
        period: 'monthly',
        severity: 'critical',
      });
    } else if (usageCount > highUsageThreshold) {
      this.logger.warn('High SMS usage detected for current month', {
        usage: usageCount,
        threshold: highUsageThreshold,
        cost: usageCost,
        currency,
        severity: 'warning',
        monitoring: 'capacity_planning',
      });

      this.eventEmitter.emit('sms.service.usage.high', {
        service: 'twilio',
        usage: usageCount,
        cost: usageCost,
        currency,
        threshold: highUsageThreshold,
        timestamp: new Date(),
        period: 'monthly',
        severity: 'warning',
      });
    }

    // Emit general usage metrics for monitoring dashboards
    this.eventEmitter.emit('sms.service.usage.metrics', {
      service: 'twilio',
      usage: usageCount,
      cost: usageCost,
      currency,
      timestamp: new Date(),
      period: 'monthly',
    });
  }

  /**
   * Alternative monitoring approach when usage API is unavailable
   * Uses account activity as a proxy for usage monitoring
   */
  private async checkAccountActivityAsUsageProxy(): Promise<void> {
    try {
      const twilioClient = this.getTwilioClientOrThrow('account activity check');

      // Get recent messages as a proxy for usage
      const recentMessages = await twilioClient.messages.list({
        limit: 100,
        dateSentAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      });

      const messageCount = recentMessages.length;

      this.logger.debug('Account activity check completed (usage proxy)', {
        recentMessageCount: messageCount,
        period: 'last_30_days',
        monitoringMethod: 'message_count_proxy',
      });

      // Basic threshold monitoring using message count
      const highActivityThreshold = this.configService.get<number>(
        'TWILIO_HIGH_ACTIVITY_THRESHOLD',
        500,
      );

      if (messageCount > highActivityThreshold) {
        this.logger.warn('High account activity detected (proxy monitoring)', {
          messageCount,
          threshold: highActivityThreshold,
          period: 'last_30_days',
          monitoring: 'activity_based',
        });

        this.eventEmitter.emit('sms.service.activity.high', {
          service: 'twilio',
          messageCount,
          threshold: highActivityThreshold,
          timestamp: new Date(),
          period: 'last_30_days',
          monitoringType: 'proxy',
        });
      }
    } catch (error) {
      this.logger.debug('Account activity check failed (non-critical)', {
        error: (error as Error).message,
        reason: 'api_limitation_or_permissions',
        impact: 'monitoring_only',
      });
    }
  }

  /**
   * Checks API rate limit status
   * Production-grade rate limit monitoring for service reliability
   */
  private async checkRateLimitStatus(): Promise<void> {
    try {
      const twilioClient = this.getTwilioClientOrThrow('rate limit status check');

      // Twilio doesn't provide direct rate limit status API,
      // but we can monitor response times and patterns
      const rateLimitCheckStart = Date.now();

      // Simple API call to check responsiveness
      await twilioClient.api.v2010.accounts(twilioClient.accountSid).fetch();

      const responseTime = Date.now() - rateLimitCheckStart;

      // Monitor for unusually slow responses which might indicate rate limiting
      const slowResponseThreshold = this.configService.get<number>(
        'TWILIO_SLOW_RESPONSE_THRESHOLD',
        2000,
      );

      if (responseTime > slowResponseThreshold) {
        this.logger.warn('Slow Twilio API response detected', {
          responseTime,
          threshold: slowResponseThreshold,
          possibleCause: 'rate_limiting_or_network_issues',
          monitoring: 'performance_degradation',
        });

        this.eventEmitter.emit('sms.service.response.slow', {
          service: 'twilio',
          responseTime,
          threshold: slowResponseThreshold,
          timestamp: new Date(),
          status: 'degraded',
        });
      } else {
        this.logger.debug('API rate limit status check passed', {
          responseTime,
          performance: 'normal',
        });
      }
    } catch (error) {
      this.logger.debug('Rate limit status check failed (non-critical)', {
        error: (error as Error).message,
        impact: 'monitoring_only',
      });
      // Don't throw - this is monitoring only
    }
  }

  /**
   * Health check method for service monitoring
   * Can be called by health check endpoints
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    details: Record<string, unknown>;
    timestamp: Date;
  }> {
    const healthCheckStartTime = Date.now();

    try {
      if (!this.twilioClient) {
        return {
          status: 'unhealthy',
          details: {
            error: 'Twilio client not initialized',
            serviceStatus: 'down',
            lastCheck: new Date(),
          },
          timestamp: new Date(),
        };
      }

      // Quick connectivity test
      const account = await this.twilioClient.api.v2010
        .accounts(this.twilioClient.accountSid)
        .fetch();

      const healthCheckTime = Date.now() - healthCheckStartTime;

      return {
        status: account.status === 'active' ? 'healthy' : 'degraded',
        details: {
          accountStatus: account.status,
          responseTime: healthCheckTime,
          phoneNumber: this.phoneValidator.maskPhoneNumber(this.fromNumber),
          serviceStatus: 'operational',
          lastCheck: new Date(),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      const healthCheckTime = Date.now() - healthCheckStartTime;

      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message,
          responseTime: healthCheckTime,
          serviceStatus: 'error',
          lastCheck: new Date(),
        },
        timestamp: new Date(),
      };
    }
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 SMS per minute per target
  async send(
    payload: NotificationPayload,
    target: NotificationTarget,
  ): Promise<NotificationResult> {
    if (!this.smsEnabled) {
      return this.smsDisabledResult('send');
    }

    try {
      if (!payload?.title || !payload?.body) {
        throw new BadRequestException('SMS payload requires title and body');
      }

      const phoneNumber = await this.getPhoneNumber(target);
      if (!phoneNumber) {
        return {
          success: false,
          error: 'No phone number found for target',
        };
      }

      // Check opt-out status before sending
      const optOutStatus = await this.optOutManager.checkOptOutStatus(phoneNumber);
      if (optOutStatus.isOptedOut) {
        return {
          success: false,
          error: 'User has opted out of SMS notifications',
        };
      }

      const message = this.buildSmsMessage(payload);
      const result = await this.sendSmsWithRetry(phoneNumber, message);

      return {
        success: true,
        messageId: result.sid,
        deliveryStatus: 'sent',
        metadata: {
          to: this.phoneValidator.maskPhoneNumber(result.to),
          from: result.from,
          status: result.status,
          price: result.price ?? undefined,
          priceUnit: result.priceUnit ?? undefined,
        },
      };
    } catch (error) {
      this.logger.error(`SMS notification failed: ${(error as Error).message}`, {
        target: target.userId ?? 'unknown',
        error: (error as Error).stack,
      });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendBulk(
    payload: NotificationPayload,
    targets: NotificationTarget[],
  ): Promise<NotificationResult[]> {
    if (!targets?.length) {
      return [];
    }

    // Before the 100-recipient guard on purpose: a disabled service should not
    // reject a caller for a limit it was never going to enforce.
    if (!this.smsEnabled) {
      return targets.map(() => this.smsDisabledResult('sendBulk'));
    }

    if (targets.length > 100) {
      throw new BadRequestException('Bulk SMS limited to 100 recipients per request');
    }

    // Process in batches to avoid overwhelming the service
    const batchSize = 10;
    const results: NotificationResult[] = [];

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      const batchPromises = batch.map(async target => {
        try {
          return await this.send(payload, target);
        } catch (error) {
          this.logger.error(`Bulk SMS failed for target: ${(error as Error).message}`);
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      const processedResults = batchResults.map(result =>
        result.status === 'fulfilled'
          ? result.value
          : {
              success: false,
              error: 'Promise rejected',
            },
      );

      results.push(...processedResults);

      // Add delay between batches to respect rate limits
      if (i + batchSize < targets.length) {
        await this.delay(1000); // 1 second delay between batches
      }
    }

    return results;
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<NotificationResult> {
    if (!this.smsEnabled) {
      return this.smsDisabledResult('sendVerificationCode');
    }

    // Build message with optional Android SMS Retriever hash for enhanced security
    // Format: <#> Your code is 123456. This code will expire in 10 minutes. ABC12defGHI
    // The hash ensures only YOUR app (signed with your keystore) can auto-read the SMS
    const smsRetrieverHash = this.configService.get<string>('SMS_RETRIEVER_HASH', '');

    let message = `Your Too Fresh To Waste verification code is: ${code}. This code will expire in 10 minutes.`;

    // In production, append the SMS Retriever hash for Android autofill security
    if (smsRetrieverHash?.trim().length === 11) {
      message = `<#> Your Too Fresh To Waste verification code is: ${code}. This code will expire in 10 minutes. ${smsRetrieverHash}`;

      this.logger.debug('SMS sent with Android SMS Retriever hash for enhanced security', {
        phoneNumberMasked: this.phoneValidator.maskPhoneNumber(phoneNumber),
        hashIncluded: true,
      });
    } else if (this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.warn('SMS_RETRIEVER_HASH not configured in production - using basic format', {
        environment: 'production',
        recommendation: 'Add SMS_RETRIEVER_HASH to .env for enhanced security',
      });
    }

    try {
      const result = await this.sendSms(phoneNumber, message);

      return {
        success: true,
        messageId: result.sid,
        deliveryStatus: 'sent',
        metadata: {
          type: 'verification',
          to: result.to,
          smsRetrieverHashUsed: !!smsRetrieverHash,
        },
      };
    } catch (error) {
      this.logger.error(
        `Verification SMS failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendPickupCode(phoneNumber: string, orderData: OrderData): Promise<NotificationResult> {
    if (!this.smsEnabled) {
      return this.smsDisabledResult('sendPickupCode');
    }

    const message = `Your pickup code for ${orderData.establishmentName}: ${orderData.pickupCode}. Order: ${orderData.orderId}`;

    try {
      const result = await this.sendSms(phoneNumber, message);

      return {
        success: true,
        messageId: result.sid,
        deliveryStatus: 'sent',
        metadata: {
          type: 'pickup_code',
          orderId: orderData.orderId,
        },
      };
    } catch (error) {
      this.logger.error(
        `Pickup code SMS failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendUrgentReminder(
    phoneNumber: string,
    reminderData: ReminderData,
  ): Promise<NotificationResult> {
    if (!this.smsEnabled) {
      return this.smsDisabledResult('sendUrgentReminder');
    }

    const message = `URGENT: Your food order expires in ${reminderData.timeLeft}! Pickup at ${reminderData.establishmentName}. Order: ${reminderData.orderId}`;

    try {
      const result = await this.sendSms(phoneNumber, message);

      return {
        success: true,
        messageId: result.sid,
        deliveryStatus: 'sent',
        metadata: {
          type: 'urgent_reminder',
          orderId: reminderData.orderId,
        },
      };
    } catch (error) {
      this.logger.error(
        `Urgent reminder SMS failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async getPhoneNumber(target: NotificationTarget): Promise<string | null> {
    const startTime = Date.now();

    try {
      // Input validation
      if (!target?.userId) {
        this.logger.warn('getPhoneNumber called with invalid target', { target });
        return null;
      }

      // Validate userId format (MongoDB ObjectId)
      if (!/^[0-9a-fA-F]{24}$/.test(target.userId)) {
        this.logger.warn('getPhoneNumber called with invalid userId format', {
          userId: target.userId,
          userIdLength: target.userId?.length,
        });
        return null;
      }

      // Query user with optimized projection - only select phoneNumber and verification status
      const user = await this.userModel
        .findOne({
          _id: target.userId,
          deletedAt: null, // Exclude soft-deleted users
          status: { $in: ['active', 'pending'] }, // Only include active/pending users
        })
        .select('phoneNumber isPhoneVerified')
        .lean()
        .exec();

      // User not found or deleted
      if (!user) {
        this.logger.log('User not found for phone number retrieval', {
          userId: target.userId,
          queryDuration: Date.now() - startTime,
        });
        return null;
      }

      // No phone number on file
      if (!user.phoneNumber || user.phoneNumber.trim() === '') {
        this.logger.debug('User has no phone number registered', {
          userId: target.userId,
          hasPhoneNumber: !!user.phoneNumber,
        });
        return null;
      }

      // Check if phone number is verified (configurable security check)
      if (this.requirePhoneVerification && !user.isPhoneVerified) {
        this.logger.warn('User phone number not verified for SMS notifications', {
          userId: target.userId,
          phoneNumberExists: !!user.phoneNumber,
          isVerified: user.isPhoneVerified,
          requireVerification: this.requirePhoneVerification,
        });
        return null;
      }

      // Validate and format phone number using the phone validator service
      const validation = this.phoneValidator.validateAndFormat(user.phoneNumber);

      if (!validation.isValid) {
        this.logger.error('Invalid phone number format in database', {
          userId: target.userId,
          phoneNumberMasked: this.phoneValidator.maskPhoneNumber(user.phoneNumber),
          validationError: validation.errorMessage,
          queryDuration: Date.now() - startTime,
        });
        return null;
      }

      const formattedPhoneNumber = validation.formatted;
      if (!formattedPhoneNumber) {
        this.logger.error('Phone validator returned no formatted value for a valid phone number', {
          userId: target.userId,
          queryDuration: Date.now() - startTime,
        });
        return null;
      }

      // Success - log for audit purposes but mask the actual number
      this.logger.debug('Phone number retrieved successfully', {
        userId: target.userId,
        phoneNumberMasked: this.phoneValidator.maskPhoneNumber(formattedPhoneNumber),
        isVerified: user.isPhoneVerified,
        queryDuration: Date.now() - startTime,
      });

      return formattedPhoneNumber;
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorStack = (error as Error).stack;
      const errorType = error instanceof Error ? error.constructor.name : typeof error;

      this.logger.error('Failed to retrieve phone number from database', {
        userId: target.userId,
        error: errorMessage,
        errorStack,
        queryDuration: Date.now() - startTime,
        errorType,
      });

      return null;
    }
  }

  private buildSmsMessage(payload: NotificationPayload): string {
    // SMS messages should be concise (160 characters for single SMS)
    let message = `${payload.title}: ${payload.body}`;

    // Truncate if too long, leaving space for potential link
    if (message.length > 140 && payload.clickAction) {
      message = `${message.substring(0, 137)}...`;
    } else if (message.length > 160) {
      message = `${message.substring(0, 157)}...`;
    }

    // Add link if provided
    if (payload.clickAction) {
      message += ` ${payload.clickAction}`;
    }

    return message;
  }

  private async sendSmsWithRetry(
    phoneNumber: string,
    message: string,
    retries: number = 3,
  ): Promise<TwilioMessageResponse> {
    const validation = this.phoneValidator.validateAndFormat(phoneNumber);
    if (!validation.isValid) {
      throw new BadRequestException(`Invalid phone number: ${validation.errorMessage}`);
    }

    const formattedPhoneNumber = validation.formatted;
    if (!formattedPhoneNumber) {
      throw new BadRequestException('Invalid phone number: missing formatted value');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.sendSms(formattedPhoneNumber, message);
      } catch (error) {
        const isLastAttempt = attempt === retries;
        this.logger.warn(
          `SMS send attempt ${attempt}/${retries} failed: ${(error as Error).message}`,
        );

        if (isLastAttempt) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw new Error('SMS send failed after all retries');
  }

  private async sendSms(phoneNumber: string, message: string): Promise<TwilioMessageResponse> {
    if (!this.fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    if (!this.twilioClient) {
      // Reachable in production only when SMS_ENABLED=true and Twilio failed to
      // initialise - credentials rejected, or a from-number the account does not
      // own. Returning the mock below there would hand back a fabricated SID and
      // status:'sent', and every caller records a delivery that never happened.
      // Fail loudly instead; the mock stays for local development.
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new Error('Twilio client unavailable - SMS was not sent');
      }

      // Mock implementation for development
      this.logger.log('Mock SMS sent', {
        to: this.phoneValidator.maskPhoneNumber(phoneNumber),
        messageLength: message.length,
      });

      return {
        sid: `SM${Date.now()}${Math.random().toString(36).substring(7)}`,
        to: phoneNumber,
        from: this.fromNumber,
        status: 'sent',
        body: message,
        dateCreated: new Date(),
        dateSent: new Date(),
        dateUpdated: new Date(),
        errorCode: null,
        errorMessage: null,
        numMedia: '0',
        numSegments: '1',
        price: '0.0075',
        priceUnit: 'USD',
        direction: 'outbound-api' as const,
        uri: '/mock/message',
        accountSid: 'dev-account',
        apiVersion: '2010-04-01',
        messagingServiceSid: null,
        subresourceUris: {},
      } as TwilioMessageResponse;
    }

    try {
      // Development mode fallback when Twilio isn't configured
      if (this.twilioClient === null) {
        this.logger.warn('Twilio client not available - using development mode');
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay

        return {
          sid: `DEV_SM${Date.now()}${Math.random().toString(36).substring(7)}`,
          to: phoneNumber,
          from: this.fromNumber,
          status: 'sent',
          body: message,
          dateCreated: new Date(),
          dateSent: new Date(),
          dateUpdated: new Date(),
          errorCode: null,
          errorMessage: null,
          numMedia: '0',
          numSegments: '1',
          price: '0.0075',
          priceUnit: 'USD',
          direction: 'outbound-api' as const,
          uri: '/mock/message',
          accountSid: 'dev-account',
          apiVersion: '2010-04-01',
          messagingServiceSid: null,
          subresourceUris: {},
        } as TwilioMessageResponse;
      }

      // Real Twilio implementation

      const webhookUrl = this.configService.get<string>('TWILIO_WEBHOOK_URL');
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
        ...(webhookUrl !== undefined ? { statusCallback: webhookUrl } : {}),
      });

      const mappedResult: TwilioMessageResponse = {
        sid: result.sid,
        to: result.to,
        from: result.from,
        status: result.status,
        body: result.body,
        dateCreated: result.dateCreated,
        dateSent: result.dateSent,
        dateUpdated: result.dateUpdated,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        numMedia: result.numMedia,
        numSegments: result.numSegments,
        price: result.price,
        priceUnit: result.priceUnit,
        direction: result.direction,
        uri: result.uri,
        accountSid: result.accountSid,
        apiVersion: result.apiVersion,
        messagingServiceSid: result.messagingServiceSid,
        subresourceUris: result.subresourceUris,
      };

      return mappedResult;
    } catch (error) {
      this.logger.error('Twilio SMS error', {
        error: (error as Error).message,
        to: this.phoneValidator.maskPhoneNumber(phoneNumber),
      });
      throw error;
    }
  }

  async handleDeliveryStatus(
    webhookData: TwilioWebhookData,
    webhookUrl: string,
    signature: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Input validation
      if (!webhookData?.MessageSid || !webhookData?.MessageStatus) {
        this.logger.warn('Invalid webhook data received', { webhookData });
        throw new BadRequestException(
          'Invalid webhook data: missing required fields (MessageSid, MessageStatus)',
        );
      }

      // Validate Twilio webhook signature for security
      const params = Object.entries(webhookData).reduce(
        (acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        },
        {} as Record<string, string>,
      );

      const isSignatureValid = this.validateTwilioSignature(webhookUrl, params, signature);
      if (!isSignatureValid) {
        throw new BadRequestException('Invalid webhook signature');
      }

      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, Price, PriceUnit } = webhookData;

      // Map Twilio status to our notification status enum
      const notificationStatus = this.mapTwilioStatusToNotificationStatus(MessageStatus);

      this.logger.log('Processing SMS delivery status update', {
        messageId: MessageSid,
        twilioStatus: MessageStatus,
        notificationStatus,
        errorCode: ErrorCode,
        price: Price,
        priceUnit: PriceUnit,
        processingStartTime: startTime,
      });

      // Update notification status in database
      const updateData: Record<string, unknown> = {
        status: notificationStatus,
        updatedAt: new Date(),
      };

      // Set delivery timestamp based on status
      if (MessageStatus === 'delivered') {
        updateData['deliveredAt'] = new Date();
      } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        updateData['failedAt'] = new Date();
        updateData['errorMessage'] =
          ErrorMessage ?? `SMS delivery failed with status: ${MessageStatus}`;
      }

      // Update metadata with delivery information
      if (Price || PriceUnit || ErrorCode) {
        const metadataUpdate: Record<string, unknown> = {};
        if (Price) {
          metadataUpdate['metadata.price'] = Price;
        }
        if (PriceUnit) {
          metadataUpdate['metadata.priceUnit'] = PriceUnit;
        }
        if (ErrorCode) {
          metadataUpdate['metadata.errorCode'] = ErrorCode;
        }
        if (ErrorMessage) {
          metadataUpdate['metadata.errorMessage'] = ErrorMessage;
        }

        Object.assign(updateData, metadataUpdate);
      }

      // Find and update the notification by messageId
      const updateResult = await this.userModel.db.collection('notifications').updateOne(
        {
          'metadata.messageId': MessageSid,
          type: 'sms',
        },
        { $set: updateData },
      );

      if (updateResult.matchedCount === 0) {
        this.logger.warn('No notification found for Twilio message ID', {
          messageId: MessageSid,
          twilioStatus: MessageStatus,
          searchedField: 'metadata.messageId',
        });
        return;
      }

      if (updateResult.modifiedCount === 0) {
        this.logger.debug('Notification already up to date', {
          messageId: MessageSid,
          twilioStatus: MessageStatus,
        });
        return;
      }

      // Handle failed messages with enhanced logging and potential retry logic
      if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
        this.logger.error('SMS delivery failed - investigating failure', {
          messageId: MessageSid,
          errorCode: ErrorCode,
          errorMessage: ErrorMessage,
          twilioStatus: MessageStatus,
          price: Price,
          priceUnit: PriceUnit,
        });

        // Handle failed messages with enterprise-grade retry and error management
        if (ErrorCode && this.shouldRetryMessage(ErrorCode)) {
          await this.scheduleRetry(MessageSid, ErrorCode, MessageStatus);
        }

        // Handle phone number issues and update opt-out status
        if (ErrorCode && this.isPhoneNumberIssue(ErrorCode)) {
          await this.handlePhoneNumberIssue(MessageSid, ErrorCode, ErrorMessage);
        }
      } else if (MessageStatus === 'delivered') {
        this.logger.debug('SMS successfully delivered', {
          messageId: MessageSid,
          price: Price,
          priceUnit: PriceUnit,
          processingTime: Date.now() - startTime,
        });
      }

      // Track delivery analytics for business intelligence
      this.trackDeliveryAnalytics(MessageSid, MessageStatus, {
        errorCode: ErrorCode,
        errorMessage: ErrorMessage,
        price: Price,
        priceUnit: PriceUnit,
        processingTime: Date.now() - startTime,
      });

      this.logger.log('SMS delivery status update completed', {
        messageId: MessageSid,
        twilioStatus: MessageStatus,
        notificationStatus,
        recordsUpdated: updateResult.modifiedCount,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorStack = (error as Error).stack;
      const errorType = error instanceof Error ? error.constructor.name : typeof error;

      this.logger.error('Failed to handle SMS delivery status update', {
        webhookData: {
          MessageSid: webhookData.MessageSid,
          MessageStatus: webhookData.MessageStatus,
          ErrorCode: webhookData.ErrorCode,
        },
        error: errorMessage,
        errorStack,
        processingTime: Date.now() - startTime,
        errorType,
      });

      // Re-throw the error to ensure webhook failure is properly signaled
      throw error;
    }
  }

  private mapTwilioStatusToNotificationStatus(
    twilioStatus: TwilioWebhookData['MessageStatus'],
  ): NotificationStatus {
    const statusMap: Record<TwilioWebhookData['MessageStatus'], NotificationStatus> = {
      queued: NotificationStatus.PENDING,
      sent: NotificationStatus.SENT,
      receiving: NotificationStatus.SENT,
      received: NotificationStatus.SENT,
      delivered: NotificationStatus.DELIVERED,
      failed: NotificationStatus.FAILED,
      undelivered: NotificationStatus.FAILED,
    };

    return statusMap[twilioStatus] ?? NotificationStatus.FAILED;
  }

  /**
   * Determines if a message should be retried based on error code
   * Enterprise-grade retry logic for transient failures
   */
  private shouldRetryMessage(errorCode?: string): boolean {
    if (!errorCode) {
      return false;
    }

    // Twilio error codes that indicate retryable conditions
    const retryableErrorCodes = new Set([
      '30001', // Queue overflow - message exceeded queue capacity
      '30002', // Account suspended - temporary suspension
      '30003', // Unreachable destination handset - temporary network issue
      '30004', // Message blocked by carrier - may be temporary
      '30005', // Unknown destination handset - temporary routing issue
      '30007', // Message delivery failed - generic delivery failure
      '30008', // Unknown error - unknown condition, worth retrying
      '11200', // HTTP 5XX error - server temporarily unavailable
      '11201', // Message service unavailable - temporary service issue
      '11750', // SMS delivery rate limit exceeded - temporary rate limiting
    ]);

    const shouldRetry = retryableErrorCodes.has(errorCode);

    this.logger.debug('Retry decision for SMS message', {
      errorCode,
      shouldRetry,
      retryableErrorCodes: Array.from(retryableErrorCodes),
    });

    return shouldRetry;
  }

  /**
   * Schedules retry for failed SMS messages
   * Implements exponential backoff and maximum retry limits
   */
  private async scheduleRetry(
    messageId: string,
    errorCode: string,
    _status: string,
  ): Promise<void> {
    try {
      // Get notification for retry tracking
      const notification = await this.userModel.db
        .collection<RetryableSmsNotification>('notifications')
        .findOne({
          'metadata.messageId': messageId,
          type: 'sms',
        });

      if (!notification) {
        this.logger.warn('Cannot schedule retry - notification not found', { messageId });
        return;
      }

      const currentRetries = notification['metadata']?.['retryCount'] ?? 0;
      const maxRetries = notification['metadata']?.['maxRetries'] ?? 3;

      // Check if max retries exceeded
      if (currentRetries >= maxRetries) {
        this.logger.warn('Max retries exceeded for SMS message', {
          messageId,
          currentRetries,
          maxRetries,
          errorCode,
        });

        // Mark as permanently failed
        await this.userModel.db.collection('notifications').updateOne(
          { 'metadata.messageId': messageId },
          {
            $set: {
              status: NotificationStatus.FAILED,
              'metadata.permanentlyFailed': true,
              'metadata.finalErrorCode': errorCode,
              'metadata.maxRetriesExceeded': true,
              failedAt: new Date(),
            },
          },
        );
        return;
      }

      // Calculate retry delay with exponential backoff
      const baseDelayMs = 60000; // 1 minute base delay
      const retryDelayMs = baseDelayMs * Math.pow(2, currentRetries); // Exponential backoff
      const retryAt = new Date(Date.now() + retryDelayMs);

      // Update notification with retry information
      await this.userModel.db.collection('notifications').updateOne(
        { 'metadata.messageId': messageId },
        {
          $set: {
            status: NotificationStatus.PENDING,
            'metadata.retryCount': currentRetries + 1,
            'metadata.lastRetryErrorCode': errorCode,
            'metadata.nextRetryAt': retryAt,
            'metadata.retryReason': `Automatic retry for error ${errorCode}`,
            updatedAt: new Date(),
          },
        },
      );

      this.logger.log('SMS retry scheduled', {
        messageId,
        errorCode,
        currentRetries: currentRetries + 1,
        maxRetries,
        retryAt: retryAt.toISOString(),
        retryDelayMs,
      });

      // Emit event for retry scheduler (if using job queues)
      this.eventEmitter.emit('sms.retry.scheduled', {
        messageId,
        retryAt,
        retryCount: currentRetries + 1,
        errorCode,
        notificationId: notification._id,
      });
    } catch (error) {
      this.logger.error('Failed to schedule SMS retry', {
        messageId,
        errorCode,
        error: (error as Error).message,
        errorStack: (error as Error).stack,
      });
    }
  }

  /**
   * Checks if error code indicates phone number issues
   * Used to update opt-out status or mark numbers as invalid
   */
  private isPhoneNumberIssue(errorCode?: string): boolean {
    if (!errorCode) {
      return false;
    }

    // Twilio error codes indicating phone number problems
    const phoneNumberErrorCodes = new Set([
      '21211', // Invalid 'To' phone number
      '21214', // 'To' phone number cannot be reached
      '21408', // Permission to send SMS not enabled for region
      '21610', // Message cannot be sent to landline number
      '21614', // 'To' number is not a valid mobile number
      '21617', // The concatenated message body exceeds operator limits
      '30006', // Landline or unreachable carrier
      '30009', // Missing segment
      '30010', // Message price exceeds max price
      '63002', // Phone number is not opted in
      '63003', // Phone number has been blacklisted
      '63004', // Phone number is invalid
      '63005', // Phone number is unsubscribed
    ]);

    return phoneNumberErrorCodes.has(errorCode);
  }

  /**
   * Handles phone number issues by updating opt-out status
   * Enterprise-grade phone number lifecycle management
   */
  private async handlePhoneNumberIssue(
    messageId: string,
    errorCode: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      // Get notification to find associated phone number
      const notification = await this.userModel.db
        .collection<NotificationPhoneLookup>('notifications')
        .findOne({
          'metadata.messageId': messageId,
          type: 'sms',
        });

      const phoneNumber = notification?.metadata?.phone;

      if (typeof phoneNumber !== 'string' || phoneNumber.length === 0) {
        this.logger.warn('Cannot handle phone number issue - phone number not found', {
          messageId,
          errorCode,
        });
        return;
      }

      // Handle different types of phone number issues
      switch (errorCode) {
        case '21211': // Invalid phone number format
        case '21614': // Not a valid mobile number
        case '63004': // Phone number is invalid
          await this.markPhoneNumberInvalid(phoneNumber, errorCode, errorMessage);
          break;

        case '21214': // Cannot be reached
        case '30006': // Landline or unreachable carrier
          await this.markPhoneNumberUnreachable(phoneNumber, errorCode, errorMessage);
          break;

        case '63002': // Not opted in
        case '63003': // Blacklisted
        case '63005': // Unsubscribed
          await this.handlePhoneNumberOptOut(phoneNumber, errorCode, errorMessage);
          break;

        default:
          this.logger.debug('Phone number issue handled generically', {
            phoneNumber: this.phoneValidator.maskPhoneNumber(phoneNumber),
            errorCode,
            messageId,
          });
      }

      // Update user record with phone number issue
      await this.updateUserPhoneNumberStatus(phoneNumber, errorCode, errorMessage);

      this.logger.log('Phone number issue handled', {
        phoneNumberMasked: this.phoneValidator.maskPhoneNumber(phoneNumber),
        errorCode,
        messageId,
        action: 'phone_number_issue_resolved',
      });
    } catch (error) {
      this.logger.error('Failed to handle phone number issue', {
        messageId,
        errorCode,
        error: (error as Error).message,
        errorStack: (error as Error).stack,
      });
    }
  }

  /**
   * Marks phone number as invalid in the system
   */
  private async markPhoneNumberInvalid(
    phoneNumber: string,
    errorCode: string,
    errorMessage?: string,
  ): Promise<void> {
    // Update user's phone verification status
    await this.userModel.updateMany(
      { phoneNumber },
      {
        $set: {
          isPhoneVerified: false,
          'phoneValidation.isValid': false,
          'phoneValidation.errorCode': errorCode,
          'phoneValidation.errorMessage': errorMessage,
          'phoneValidation.lastChecked': new Date(),
        },
      },
    );

    this.logger.warn('Phone number marked as invalid', {
      phoneNumberMasked: this.phoneValidator.maskPhoneNumber(phoneNumber),
      errorCode,
      errorMessage,
    });
  }

  /**
   * Marks phone number as unreachable
   */
  private async markPhoneNumberUnreachable(
    phoneNumber: string,
    errorCode: string,
    errorMessage?: string,
  ): Promise<void> {
    // Update phone reachability status
    await this.userModel.updateMany(
      { phoneNumber },
      {
        $set: {
          'phoneValidation.isReachable': false,
          'phoneValidation.lastUnreachableAt': new Date(),
          'phoneValidation.unreachableReason': `${errorCode}: ${errorMessage}`,
        },
      },
    );

    this.logger.warn('Phone number marked as unreachable', {
      phoneNumberMasked: this.phoneValidator.maskPhoneNumber(phoneNumber),
      errorCode,
    });
  }

  /**
   * Handles phone number opt-out due to carrier restrictions
   */
  private async handlePhoneNumberOptOut(
    phoneNumber: string,
    errorCode: string,
    errorMessage?: string,
  ): Promise<void> {
    const reason = `Automatic opt-out due to carrier restriction: ${errorCode} - ${errorMessage}`;

    // Create proper opt-out request DTO
    const optOutRequest: OptOutRequestDto = {
      phoneNumber,
      reason: OptOutReason.CARRIER_BLOCK,
      scope: OptOutScope.ALL_SMS,
      source: 'twilio_webhook_error',
      metadata: {
        errorCode,
        errorMessage: errorMessage ?? 'Carrier restriction',
        twilioWebhookProcessing: true,
        automatedOptOut: true,
      },
    };

    // Use the existing opt-out manager
    await this.optOutManager.handleOptOut(optOutRequest);

    this.logger.warn('Phone number automatically opted out', {
      phoneNumberMasked: this.phoneValidator.maskPhoneNumber(phoneNumber),
      errorCode,
      reason,
    });
  }

  /**
   * Updates user record with phone number status information
   */
  private async updateUserPhoneNumberStatus(
    phoneNumber: string,
    errorCode: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.userModel.updateMany(
      { phoneNumber },
      {
        $push: {
          'phoneValidation.issues': {
            errorCode,
            errorMessage,
            occurredAt: new Date(),
            source: 'twilio_webhook',
          },
        },
        $set: {
          'phoneValidation.lastIssueAt': new Date(),
        },
      },
    );
  }

  /**
   * Tracks SMS delivery analytics for business intelligence
   * Comprehensive metrics collection for monitoring and optimization
   */
  private trackDeliveryAnalytics(
    messageId: string,
    status: string,
    metadata: {
      errorCode?: string | undefined;
      errorMessage?: string | undefined;
      price?: string | undefined;
      priceUnit?: string | undefined;
      processingTime: number;
    },
  ): void {
    try {
      // Emit analytics event for the notification analytics service
      this.eventEmitter.emit('sms.delivery.status', {
        messageId,
        status,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          channel: 'sms',
          provider: 'twilio',
        },
      });

      // Track specific delivery events
      switch (status) {
        case 'delivered':
          this.eventEmitter.emit('notification.delivered', {
            notificationId: messageId,
            deliveredAt: new Date(),
            metadata: {
              channel: 'sms',
              provider: 'twilio',
              cost: metadata.price ? parseFloat(metadata.price) : 0,
              currency: metadata.priceUnit ?? 'USD',
              processingTime: metadata.processingTime,
            },
          });
          break;

        case 'failed':
        case 'undelivered':
          this.eventEmitter.emit('notification.failed', {
            notificationId: messageId,
            failedAt: new Date(),
            errorCode: metadata.errorCode,
            errorMessage: metadata.errorMessage,
            metadata: {
              channel: 'sms',
              provider: 'twilio',
              processingTime: metadata.processingTime,
            },
          });
          break;

        case 'sent':
          this.eventEmitter.emit('notification.sent', {
            notificationId: messageId,
            sentAt: new Date(),
            metadata: {
              channel: 'sms',
              provider: 'twilio',
            },
          });
          break;
      }

      // Track cost analytics if price information is available
      if (metadata.price && metadata.priceUnit) {
        this.eventEmitter.emit('sms.cost.tracked', {
          messageId,
          cost: parseFloat(metadata.price),
          currency: metadata.priceUnit,
          status,
          timestamp: new Date(),
        });
      }

      this.logger.debug('SMS delivery analytics tracked', {
        messageId,
        status,
        hasPrice: !!metadata.price,
        processingTime: metadata.processingTime,
      });
    } catch (error) {
      this.logger.error('Failed to track SMS delivery analytics', {
        messageId,
        status,
        error: (error as Error).message,
      });
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  // Deprecated: Use PhoneValidatorService instead
  validatePhoneNumber(phoneNumber: string): boolean {
    return this.phoneValidator.validatePhoneNumber(phoneNumber);
  }

  // Deprecated: Use PhoneValidatorService instead
  formatPhoneNumber(phoneNumber: string, countryCode: string = 'US'): string {
    return this.phoneValidator.formatPhoneNumber(phoneNumber, countryCode);
  }

  // Deprecated: Use OptOutManagerService instead
  async checkOptOutStatus(phoneNumber: string): Promise<boolean> {
    const status = await this.optOutManager.checkOptOutStatus(phoneNumber);
    return status.isOptedOut;
  }

  async handleOptOut(phoneNumber: string): Promise<void> {
    try {
      // Create proper opt-out request DTO
      const optOutRequest: OptOutRequestDto = {
        phoneNumber,
        reason: OptOutReason.USER_REQUESTED,
        scope: OptOutScope.ALL_SMS,
        source: 'sms_stop_keyword',
        metadata: {
          requestType: 'stop_keyword',
          automatedProcessing: true,
        },
      };

      await this.optOutManager.handleOptOut(optOutRequest);

      // Send confirmation message
      const confirmationMessage =
        "You've been unsubscribed from SMS notifications. Reply START to resubscribe.";
      await this.sendSms(phoneNumber, confirmationMessage);
    } catch (error) {
      this.logger.error(`Failed to handle opt-out: ${(error as Error).message}`);
      throw error;
    }
  }

  async handleOptIn(phoneNumber: string): Promise<void> {
    try {
      // Create proper opt-in request DTO
      const optInRequest: OptInRequestDto = {
        phoneNumber,
        source: 'sms_start_keyword',
        metadata: {
          requestType: 'start_keyword',
          automatedProcessing: true,
        },
      };

      await this.optOutManager.handleOptIn(optInRequest);

      // Send welcome message
      const welcomeMessage =
        "You're now subscribed to Too Fresh To Waste SMS notifications. Reply STOP to unsubscribe.";
      await this.sendSms(phoneNumber, welcomeMessage);
    } catch (error) {
      this.logger.error(`Failed to handle opt-in: ${(error as Error).message}`);
      throw error;
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates Twilio webhook signature for security compliance
   * Implements HMAC-SHA1 signature verification as per Twilio security standards
   *
   * @param url - The full URL of the webhook endpoint
   * @param params - The webhook payload parameters
   * @param signature - The X-Twilio-Signature header value
   * @returns boolean indicating if signature is valid
   *
   * @throws BadRequestException if validation fails
   * @see https://www.twilio.com/docs/usage/security
   */
  private validateTwilioSignature(
    url: string,
    params: Record<string, string>,
    signature: string,
  ): boolean {
    try {
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

      if (!authToken) {
        this.logger.error('Twilio auth token not configured for webhook validation');
        throw new BadRequestException('Webhook validation not configured');
      }

      if (!signature) {
        this.logger.warn('Missing X-Twilio-Signature header in webhook request');
        throw new BadRequestException('Missing webhook signature');
      }

      // Sort parameters alphabetically by key and create URL-encoded string
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

      // Create the string to sign: URL + sorted parameters
      const stringToSign = `${url}${sortedParams}`;

      // Generate HMAC-SHA1 signature
      const expectedSignature = crypto
        .createHmac('sha1', authToken)
        .update(stringToSign, 'utf8')
        .digest('base64');

      // Use timing-safe comparison to prevent timing attacks
      const isValid = this.constantTimeCompare(signature, expectedSignature);

      if (!isValid) {
        this.logger.warn(`Invalid webhook signature received from ${this.extractSourceIP(url)}`, {
          expectedLength: expectedSignature.length,
          receivedLength: signature.length,
          url: this.sanitizeUrlForLogging(url),
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Webhook signature validation failed', {
        error: (error as Error).message,
        url: this.sanitizeUrlForLogging(url),
      });
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   *
   * @param a - First string to compare
   * @param b - Second string to compare
   * @returns boolean indicating if strings are equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Extracts IP address from URL for security logging
   *
   * @param url - The webhook URL
   * @returns string representation of source IP or 'unknown'
   */
  private extractSourceIP(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Sanitizes URL for safe logging by removing sensitive query parameters
   *
   * @param url - The URL to sanitize
   * @returns sanitized URL string
   */
  private sanitizeUrlForLogging(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove query parameters that might contain sensitive data
      urlObj.search = '';
      return urlObj.toString();
    } catch {
      return 'invalid-url';
    }
  }
}
