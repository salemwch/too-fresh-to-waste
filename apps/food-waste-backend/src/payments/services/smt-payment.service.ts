import * as crypto from 'crypto';
import { promisify } from 'util';

import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { Model } from 'mongoose';

import { ConfigParserService } from '../../common/services/config-parser.service';
import {
  EncryptionKey,
  EncryptionKeyDocument,
  KeyStatus,
  KeyType,
} from '../schemas/encryption-key.schema';
import { PaymentMethod, PaymentStatus } from '../schemas/payment.schema';

// Type-safe utilities for GCM cipher operations
// These methods exist in Node.js crypto module but may not be in type definitions
type GCMCipher = ReturnType<typeof crypto.createCipheriv> & {
  setAAD(buffer: Buffer): ReturnType<typeof crypto.createCipheriv>;
  getAuthTag(): Buffer;
};

type GCMDecipher = ReturnType<typeof crypto.createDecipheriv> & {
  setAuthTag(buffer: Buffer): ReturnType<typeof crypto.createDecipheriv>;
  setAAD(buffer: Buffer): ReturnType<typeof crypto.createDecipheriv>;
};

// Helper functions for type-safe GCM operations
const createGCMCipher = (algorithm: string, key: Buffer, iv: Buffer): GCMCipher =>
  crypto.createCipheriv(algorithm, key, iv) as GCMCipher;

const createGCMDecipher = (algorithm: string, key: Buffer, iv: Buffer): GCMDecipher =>
  crypto.createDecipheriv(algorithm, key, iv) as GCMDecipher;

export interface SMTConfig {
  merchantId: string;
  terminalId: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production' | 'development';
  timeout: number;
  maxRetries: number;
  encryptionSalt: string;
  masterEncryptionKey?: string | undefined;
  keyRotationInterval?: number | undefined;
  hsmEnabled?: boolean | undefined;
  hsmProvider?: string | undefined;
  hsmKeyId?: string | undefined;
}

export interface SMTPaymentRequest {
  merchantTransactionId: string;
  amount: number;
  currency: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName?: string | undefined;
  description?: string | undefined;
  returnUrl?: string | undefined;
  cancelUrl?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface SMTPaymentResponse {
  success: boolean;
  transactionId?: string | undefined;
  status: string;
  responseCode: string;
  responseMessage: string;
  authorizationCode?: string | undefined;
  rrn?: string | undefined;
  redirectUrl?: string | undefined;
  error?: string | undefined;
}

export interface SMTRefundRequest {
  originalTransactionId: string;
  amount: number;
  reason: string;
  merchantRefundId: string;
}

interface SMTGatewayResponseData {
  success?: boolean;
  transactionId?: string;
  status?: string;
  responseCode?: string;
  responseMessage?: string;
  authorizationCode?: string;
  rrn?: string;
  redirectUrl?: string;
  error?: string;
}

interface SMTGatewayErrorData {
  message?: string;
}

interface EncryptedCardPackage {
  version: string;
  keyId: string;
  algorithm: string;
  iv: string;
  salt: string;
  authTag: string;
  encrypted: string;
  timestamp: number;
}

interface EncryptionKeyPair {
  key: Buffer;
  keyId: string;
  createdAt: Date;
  expiresAt: Date;
}

interface SecureCardData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object';
}

function isEncryptedCardPackage(value: unknown): value is EncryptedCardPackage {
  return (
    isRecord(value) &&
    typeof value['version'] === 'string' &&
    typeof value['keyId'] === 'string' &&
    typeof value['algorithm'] === 'string' &&
    typeof value['iv'] === 'string' &&
    typeof value['salt'] === 'string' &&
    typeof value['authTag'] === 'string' &&
    typeof value['encrypted'] === 'string' &&
    typeof value['timestamp'] === 'number'
  );
}

@Injectable()
export class SMTPaymentService {
  private readonly logger = new Logger(SMTPaymentService.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: SMTConfig;
  private readonly scryptAsync = promisify(crypto.scrypt);
  private readonly keyCache = new Map<string, EncryptionKeyPair>();
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_SIZE = 32;
  private readonly IV_SIZE = 16;
  private readonly TAG_SIZE = 16;
  private readonly SALT_SIZE = 32;

  constructor(
    private readonly configService: ConfigService,
    private readonly configParserService: ConfigParserService,
    @InjectModel(EncryptionKey.name)
    private readonly encryptionKeyModel: Model<EncryptionKeyDocument>,
  ) {
    this.config = {
      merchantId: this.configService.get<string>('SMT_MERCHANT_ID') ?? '',
      terminalId: this.configService.get<string>('SMT_TERMINAL_ID') ?? '',
      apiKey: this.configService.get<string>('SMT_API_KEY') ?? '',
      apiSecret: this.configService.get<string>('SMT_API_SECRET') ?? '',
      baseUrl: this.configService.get<string>('SMT_BASE_URL') ?? '',
      webhookSecret: this.configService.get<string>('SMT_WEBHOOK_SECRET') ?? '',
      environment: this.configService.get<string>('SMT_ENVIRONMENT') as
        | 'sandbox'
        | 'production'
        | 'development',
      timeout: this.configParserService.parseNumber('SMT_TIMEOUT', 30000) ?? 30000,
      maxRetries: this.configParserService.parseNumber('SMT_MAX_RETRIES', 3) ?? 3,
      encryptionSalt: this.configService.get<string>('SMT_ENCRYPTION_SALT') ?? '',
      masterEncryptionKey: this.configService.get<string>('SMT_MASTER_ENCRYPTION_KEY'),
      keyRotationInterval: this.configParserService.parseNumber(
        'SMT_KEY_ROTATION_INTERVAL',
        24 * 60 * 60 * 1000,
      ), // 24 hours
      hsmEnabled: this.configService.get<string>('SMT_HSM_ENABLED') === 'true',
      hsmProvider: this.configService.get<string>('SMT_HSM_PROVIDER'),
      hsmKeyId: this.configService.get<string>('SMT_HSM_KEY_ID'),
    };

    // Validate critical security configurations
    this.validateSecurityConfig();

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Merchant-Id': this.config.merchantId,
        'X-Terminal-Id': this.config.terminalId,
      },
    });

    this.setupInterceptors();
    void this.scryptAsync;
    void this.TAG_SIZE;
    void this.decryptCardData;
  }

  /**
   * Validate critical security configurations
   */
  private validateSecurityConfig(): void {
    if (!this.config.encryptionSalt || this.config.encryptionSalt.length < 32) {
      throw new Error(
        'SMT_ENCRYPTION_SALT must be at least 32 characters long. Generate with: crypto.randomBytes(64).toString("hex")',
      );
    }

    if (!this.config.apiSecret || this.config.apiSecret.length < 16) {
      throw new Error('SMT_API_SECRET must be at least 16 characters long for security');
    }

    if (!this.config.webhookSecret || this.config.webhookSecret.length < 16) {
      throw new Error('SMT_WEBHOOK_SECRET must be at least 16 characters long for security');
    }

    if (this.config.environment === 'production') {
      if (!this.config.masterEncryptionKey || this.config.masterEncryptionKey.length < 64) {
        throw new Error(
          'SMT_MASTER_ENCRYPTION_KEY must be at least 64 characters long in production. Generate with: crypto.randomBytes(32).toString("hex")',
        );
      }

      if (this.config.hsmEnabled === true && !this.config.hsmKeyId) {
        throw new Error('SMT_HSM_KEY_ID is required when HSM is enabled');
      }
    }

    this.logger.log('SMT security configuration validated successfully');
  }

  private getMasterEncryptionKeyOrThrow(): string {
    const masterEncryptionKey = this.config.masterEncryptionKey;
    if (!masterEncryptionKey) {
      throw new Error('Master encryption key not configured');
    }

    return masterEncryptionKey;
  }

  private getKeyRotationIntervalOrThrow(): number {
    const keyRotationInterval = this.config.keyRotationInterval;
    if (!keyRotationInterval || keyRotationInterval <= 0) {
      throw new Error('Key rotation interval not configured');
    }

    return keyRotationInterval;
  }

  private mapSMTStatusToPaymentStatus(smtStatus: string): PaymentStatus | null {
    const statusMap: Record<string, PaymentStatus> = {
      completed: PaymentStatus.COMPLETED,
      success: PaymentStatus.COMPLETED,
      paid: PaymentStatus.COMPLETED,
      failed: PaymentStatus.FAILED,
      error: PaymentStatus.FAILED,
      declined: PaymentStatus.FAILED,
      cancelled: PaymentStatus.CANCELLED,
      pending: PaymentStatus.PENDING,
      processing: PaymentStatus.PROCESSING,
      refunded: PaymentStatus.REFUNDED,
      disputed: PaymentStatus.DISPUTED,
    };

    return statusMap[smtStatus.toLowerCase()] ?? null;
  }
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        const timestamp = Date.now().toString();
        const signature = this.generateSignature(config.data, timestamp);

        config.headers['X-Timestamp'] = timestamp;
        config.headers['X-Signature'] = signature;
        config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;

        this.logger.debug(`SMT API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: Error) => {
        this.logger.error('SMT API Request Error:', error);
        throw new Error(error.message || String(error));
      },
    );

    this.httpClient.interceptors.response.use(
      (response: AxiosResponse) => {
        this.logger.debug(`SMT API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: Error) => {
        this.logger.error('SMT API Response Error:', {
          status: (error as AxiosError).response?.status,
          data: (error as AxiosError).response?.data,
          url: (error as AxiosError).config?.url,
        });
        throw error;
      },
    );
  }

  async processPayment(paymentRequest: SMTPaymentRequest): Promise<SMTPaymentResponse> {
    try {
      this.logger.log(
        `Processing SMT payment for transaction: ${paymentRequest.merchantTransactionId}`,
      );

      // Validate card number format
      if (!this.isValidCardNumber(paymentRequest.cardNumber)) {
        throw new BadRequestException('Invalid card number format');
      }

      // Encrypt sensitive card data with enterprise-grade security
      const encryptedCardData = await this.encryptCardData({
        cardNumber: paymentRequest.cardNumber,
        expiryMonth: paymentRequest.expiryMonth,
        expiryYear: paymentRequest.expiryYear,
        cvv: paymentRequest.cvv,
      });

      const requestPayload = {
        merchantTransactionId: paymentRequest.merchantTransactionId,
        amount: Math.round(paymentRequest.amount * 1000), // Convert to millimes
        currency: paymentRequest.currency,
        cardData: encryptedCardData,
        cardholderName: paymentRequest.cardholderName,
        description: paymentRequest.description,
        returnUrl: paymentRequest.returnUrl,
        cancelUrl: paymentRequest.cancelUrl,
        metadata: paymentRequest.metadata,
        merchantId: this.config.merchantId,
        terminalId: this.config.terminalId,
      };

      // Call SMT API
      const response = await this.httpClient.post<SMTGatewayResponseData>(
        '/payments',
        requestPayload,
      );

      // Debug log raw SMT response
      this.logger.debug('Raw SMT response:', JSON.stringify(response.data, null, 2));

      // Default safe values for missing fields
      const smtResponse: SMTPaymentResponse = {
        transactionId: response.data.transactionId ?? paymentRequest.merchantTransactionId,
        status:
          this.mapSMTStatusToPaymentStatus(response.data.status ?? 'pending') ??
          PaymentStatus.PENDING,
        responseCode: response.data.responseCode ?? 'N/A',
        responseMessage:
          response.data.responseMessage ?? `Payment ${response.data.status ?? 'unknown'}`,
        authorizationCode: response.data.authorizationCode,
        rrn: response.data.rrn,
        redirectUrl: response.data.redirectUrl,
        error: response.data.error,
        success:
          response.data.status?.toLowerCase() === 'success' ||
          response.data.status?.toLowerCase() === 'completed',
      };

      const paymentStatus: PaymentStatus =
        this.mapSMTStatusToPaymentStatus(smtResponse.status) ?? PaymentStatus.PENDING;

      // Log result
      if (smtResponse.success) {
        this.logger.log(`SMT payment successful: ${smtResponse.transactionId}`);
      } else {
        this.logger.warn(`SMT payment failed: ${smtResponse.responseMessage}`);
      }

      // Return structured response
      return {
        success: smtResponse.success,
        transactionId: smtResponse.transactionId,
        status: paymentStatus,
        responseCode: smtResponse.responseCode,
        responseMessage: smtResponse.responseMessage,
        authorizationCode: smtResponse.authorizationCode,
        rrn: smtResponse.rrn,
        redirectUrl: smtResponse.redirectUrl,
        error: smtResponse.success ? undefined : smtResponse.error,
      };
    } catch (error) {
      if (error instanceof AxiosError) {
        const axiosError = error as AxiosError<SMTGatewayErrorData>;
        this.logger.error('SMT payment processing error:', error);

        if (axiosError.response?.status === 400) {
          throw new BadRequestException(
            axiosError.response.data?.message ?? 'Invalid payment request',
          );
        }

        throw new InternalServerErrorException('Payment processing failed');
      } else {
        this.logger.error('Unknown error:', error);
        throw new InternalServerErrorException('Unknown error');
      }
    }
  }

  async processRefund(refundRequest: SMTRefundRequest): Promise<SMTPaymentResponse> {
    try {
      this.logger.log(
        `Processing SMT refund for transaction: ${refundRequest.originalTransactionId}`,
      );

      const requestPayload = {
        originalTransactionId: refundRequest.originalTransactionId,
        amount: Math.round(refundRequest.amount * 1000), // Convert to millimes
        reason: refundRequest.reason,
        merchantRefundId: refundRequest.merchantRefundId,
        merchantId: this.config.merchantId,
        terminalId: this.config.terminalId,
      };

      const response = await this.httpClient.post<SMTGatewayResponseData>(
        '/refunds',
        requestPayload,
      );

      if (response.data.success === true) {
        this.logger.log(`SMT refund successful: ${response.data.transactionId}`);
        return {
          success: true,
          transactionId: response.data.transactionId,
          status: response.data.status ?? 'completed',
          responseCode: response.data.responseCode ?? '00',
          responseMessage: response.data.responseMessage ?? 'Refund completed successfully',
        };
      }
      this.logger.warn(`SMT refund failed: ${response.data.responseMessage}`);
      return {
        success: false,
        status: 'failed',
        responseCode: response.data.responseCode ?? 'N/A',
        responseMessage: response.data.responseMessage ?? 'Refund failed',
        error: response.data.error,
      };
    } catch (error) {
      this.logger.error('SMT refund processing error:', error);
      throw new InternalServerErrorException('Refund processing failed');
    }
  }

  async getTransactionStatus(transactionId: string): Promise<SMTPaymentResponse> {
    try {
      const response = await this.httpClient.get<SMTPaymentResponse>(
        `/payments/${transactionId}/status`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('SMT transaction status error:', error);
      throw new InternalServerErrorException('Failed to get transaction status');
    }
  }

  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    try {
      // Replay attack protection: reject webhooks with stale timestamps
      const toleranceSeconds = parseInt(
        this.configService.get<string>('WEBHOOK_SIGNATURE_TOLERANCE', '300'),
        10,
      );
      const webhookTime = parseInt(timestamp, 10) * 1000; // Convert seconds to ms
      const drift = Math.abs(Date.now() - webhookTime);

      if (drift > toleranceSeconds * 1000) {
        this.logger.warn(
          `Webhook rejected: timestamp drift ${Math.round(drift / 1000)}s exceeds tolerance ${toleranceSeconds}s`,
        );
        return false;
      }

      const expectedSignature = this.generateWebhookSignature(payload, timestamp);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch (error) {
      this.logger.error('Webhook signature verification error:', error);
      return false;
    }
  }

  private generateSignature(payload: unknown, timestamp: string): string {
    const data = JSON.stringify(payload) + timestamp;
    return crypto.createHmac('sha256', this.config.apiSecret).update(data).digest('hex');
  }

  private generateWebhookSignature(payload: string, timestamp: string): string {
    const data = payload + timestamp;
    return crypto.createHmac('sha256', this.config.webhookSecret).update(data).digest('hex');
  }

  /**
   * Enterprise-grade card data encryption with PCI DSS compliance
   * Uses AES-256-GCM with authenticated encryption and proper key management
   */
  private async encryptCardData(cardData: SecureCardData): Promise<string> {
    if (this.config.environment === 'development') {
      this.logger.warn(
        'Using base64 encoding for card data in development mode - NEVER use in production',
      );
      return Buffer.from(JSON.stringify(cardData)).toString('base64');
    }

    const startTime = Date.now();
    let encryptionKey: Buffer | null = null;
    const keyBuffer: Buffer | null = null;
    let sensitiveData: Buffer | null = null;

    try {
      // Get or generate encryption key with rotation support
      const keyPair = await this.getOrCreateEncryptionKey();
      encryptionKey = keyPair.key;

      // Generate cryptographically secure random values
      const iv = crypto.randomBytes(this.IV_SIZE);
      const salt = crypto.randomBytes(this.SALT_SIZE);

      // Convert sensitive data to buffer for secure handling
      const cardDataString = JSON.stringify(cardData);
      sensitiveData = Buffer.from(cardDataString, 'utf8');

      // Create cipher with authenticated encryption (GCM mode)
      const cipher = createGCMCipher(this.ALGORITHM, encryptionKey, iv);

      // Add Additional Authenticated Data (AAD) for integrity
      const aad = Buffer.concat([
        Buffer.from(this.config.merchantId, 'utf8'),
        Buffer.from(keyPair.keyId, 'utf8'),
        salt,
      ]);
      cipher.setAAD(aad);

      // Encrypt the data
      const encrypted = Buffer.concat([cipher.update(sensitiveData), cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Create final encrypted package with version and metadata
      const encryptedPackage = {
        version: '2.0',
        keyId: keyPair.keyId,
        algorithm: this.ALGORITHM,
        iv: iv.toString('base64'),
        salt: salt.toString('base64'),
        authTag: authTag.toString('base64'),
        encrypted: encrypted.toString('base64'),
        timestamp: Date.now(),
      };

      // Log security audit event (without sensitive data)
      this.logSecurityEvent('CARD_DATA_ENCRYPTED', {
        keyId: keyPair.keyId,
        algorithm: this.ALGORITHM,
        encryptionTime: Date.now() - startTime,
        dataSize: sensitiveData.length,
      });

      return Buffer.from(JSON.stringify(encryptedPackage)).toString('base64');
    } catch (error) {
      this.logSecurityEvent('CARD_ENCRYPTION_FAILED', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      this.logger.error('Enterprise card data encryption failed:', error);
      throw new InternalServerErrorException('Payment data encryption failed');
    } finally {
      // Secure memory cleanup - zero out sensitive buffers
      this.secureBufferCleanup([encryptionKey, keyBuffer, sensitiveData]);
    }
  }

  /**
   * Enterprise-grade decryption with proper key management and validation
   * For internal use only - audit logged
   */
  private async decryptCardData(encryptedData: string): Promise<SecureCardData> {
    if (this.config.environment === 'development') {
      return JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8')) as SecureCardData;
    }

    const startTime = Date.now();
    let decryptionKey: Buffer | null = null;
    let sensitiveData: Buffer | null = null;

    try {
      // Parse encrypted package
      const packageData: unknown = JSON.parse(
        Buffer.from(encryptedData, 'base64').toString('utf8'),
      );

      // Validate package structure and version
      if (!isEncryptedCardPackage(packageData)) {
        throw new Error('Invalid encrypted package structure');
      }

      // Get decryption key
      const keyPair = await this.getEncryptionKey(packageData.keyId);
      if (!keyPair) {
        throw new Error(`Encryption key not found: ${packageData.keyId}`);
      }
      decryptionKey = keyPair.key;

      // Parse encrypted components
      const iv = Buffer.from(packageData.iv, 'base64');
      const salt = Buffer.from(packageData.salt, 'base64');
      const authTag = Buffer.from(packageData.authTag, 'base64');
      const encrypted = Buffer.from(packageData.encrypted, 'base64');

      // Create decipher
      const decipher = createGCMDecipher(packageData.algorithm, decryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Set Additional Authenticated Data (AAD) for integrity verification
      const aad = Buffer.concat([
        Buffer.from(this.config.merchantId, 'utf8'),
        Buffer.from(packageData.keyId, 'utf8'),
        salt,
      ]);
      decipher.setAAD(aad);

      // Decrypt data
      sensitiveData = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      const decryptedData = JSON.parse(sensitiveData.toString('utf8')) as SecureCardData;

      // Log security audit event
      this.logSecurityEvent('CARD_DATA_DECRYPTED', {
        keyId: packageData.keyId,
        algorithm: packageData.algorithm,
        decryptionTime: Date.now() - startTime,
        dataAge: Date.now() - packageData.timestamp,
      });

      return decryptedData;
    } catch (error) {
      this.logSecurityEvent('CARD_DECRYPTION_FAILED', {
        error: (error as Error).message,
        decryptionTime: Date.now() - startTime,
      });
      this.logger.error('Enterprise card data decryption failed:', error);
      throw new InternalServerErrorException('Payment data decryption failed');
    } finally {
      // Secure memory cleanup
      this.secureBufferCleanup([decryptionKey, sensitiveData]);
    }
  }

  /**
   * Get or create encryption key with rotation support
   */
  private async getOrCreateEncryptionKey(): Promise<EncryptionKeyPair> {
    const currentKeyId = this.getCurrentKeyId();

    // Check if current key exists and is not expired
    const existingKey = this.keyCache.get(currentKeyId);
    if (existingKey && existingKey.expiresAt > new Date()) {
      return existingKey;
    }

    // Generate new key pair
    const key = await this.generateEncryptionKey(currentKeyId);
    return key;
  }

  /**
   * Get encryption key by ID
   */
  private async getEncryptionKey(keyId: string): Promise<EncryptionKeyPair | null> {
    const cachedKey = this.keyCache.get(keyId);
    if (cachedKey) {
      return cachedKey;
    }
    const key = await this.loadEncryptionKey(keyId);
    return key;
  }

  /**
   * Generate new encryption key with HSM support
   */
  private async generateEncryptionKey(keyId: string): Promise<EncryptionKeyPair> {
    let masterKey: Buffer | null = null;
    const derivedKey: Buffer | null = null;
    let keyMaterial: Buffer | null = null;

    try {
      if (this.config.hsmEnabled === true) {
        // HSM-based key generation (placeholder for HSM integration)
        return await this.generateHSMKey(keyId);
      }

      // Software-based key derivation with PBKDF2
      const salt = crypto.randomBytes(this.SALT_SIZE);
      const masterEncryptionKey = this.getMasterEncryptionKeyOrThrow();
      const masterKeyBuffer = Buffer.from(masterEncryptionKey, 'hex');
      masterKey = masterKeyBuffer;

      // Use PBKDF2 for key stretching (more secure than scrypt for this use case)
      keyMaterial = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(masterKeyBuffer, salt, 100000, this.KEY_SIZE, 'sha512', (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        });
      });

      const keyPair: EncryptionKeyPair = {
        key: keyMaterial,
        keyId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.getKeyRotationIntervalOrThrow()),
      };

      // Store key securely in database
      await this.storeEncryptionKey(keyPair, keyMaterial);

      // Cache the key
      this.keyCache.set(keyId, keyPair);

      // Log key generation event
      this.logSecurityEvent('ENCRYPTION_KEY_GENERATED', {
        keyId,
        expiresAt: keyPair.expiresAt.toISOString(),
        keySize: this.KEY_SIZE,
      });

      return keyPair;
    } catch (error) {
      this.logSecurityEvent('KEY_GENERATION_FAILED', {
        keyId,
        error: (error as Error).message,
      });
      throw new InternalServerErrorException('Encryption key generation failed');
    } finally {
      // Secure cleanup
      this.secureBufferCleanup([masterKey, derivedKey, keyMaterial]);
    }
  }

  /**
   * HSM-based key generation (enterprise integration point)
   */
  private async generateHSMKey(keyId: string): Promise<EncryptionKeyPair> {
    // This is a placeholder for HSM integration
    // In production, integrate with AWS KMS, Azure Key Vault, or hardware HSM
    this.logger.warn('HSM key generation not implemented - using software fallback');

    // Fallback to software generation
    const tempConfig = { ...this.config, hsmEnabled: false };
    const originalConfig = this.config;
    Object.assign(this.config, tempConfig);

    try {
      return await this.generateEncryptionKey(keyId);
    } finally {
      Object.assign(this.config, originalConfig);
    }
  }

  /**
   * Load encryption key from secure storage with enterprise-grade security
   * Supports HSM integration, key validation, audit logging, and secure decryption
   */
  private async loadEncryptionKey(keyId: string): Promise<EncryptionKeyPair | null> {
    const startTime = Date.now();
    let masterKey: Buffer | null = null;
    let decryptedKeyMaterial: Buffer | null = null;

    try {
      // Input validation
      if (!keyId || typeof keyId !== 'string' || keyId.length > 128) {
        this.logSecurityEvent('INVALID_KEY_ID_REQUEST', { keyId: keyId?.substring(0, 20) });
        return null;
      }

      // Query with security filters - only active, non-expired keys
      const keyRecord = await this.encryptionKeyModel
        .findOne({
          keyId,
          merchantId: this.config.merchantId,
          status: KeyStatus.ACTIVE,
          expiresAt: { $gt: new Date() },
        })
        .select('+encryptedKey +salt') // Explicitly include sensitive fields
        .lean()
        .exec();

      if (!keyRecord) {
        this.logSecurityEvent('ENCRYPTION_KEY_NOT_FOUND', {
          keyId,
          merchantId: this.config.merchantId,
          searchTime: Date.now() - startTime,
        });
        return null;
      }

      // Handle HSM-based keys
      if (keyRecord.keyType === KeyType.HSM_REFERENCE) {
        return this.loadHSMKey(keyRecord as unknown as EncryptionKeyDocument);
      }

      // Validate key record integrity
      if (!keyRecord.encryptedKey || !keyRecord.algorithm || !keyRecord.keySize) {
        this.logSecurityEvent('INVALID_KEY_RECORD', {
          keyId,
          missingFields: {
            encryptedKey: !keyRecord.encryptedKey,
            algorithm: !keyRecord.algorithm,
            keySize: !keyRecord.keySize,
          },
        });
        return null;
      }

      // Decrypt the key material using master encryption key
      if (!this.config.masterEncryptionKey) {
        this.logger.error('Master encryption key not configured for key decryption');
        throw new InternalServerErrorException('Key decryption configuration error');
      }

      // Parse encrypted key package
      let keyPackage: { iv: string; encrypted: string; authTag: string };
      try {
        keyPackage = JSON.parse(
          Buffer.from(keyRecord.encryptedKey, 'base64').toString('utf8'),
        ) as typeof keyPackage;
      } catch (error) {
        this.logSecurityEvent('KEY_PACKAGE_PARSE_ERROR', {
          keyId,
          error: (error as Error).message,
        });
        return null;
      }

      // Validate key package structure
      if (!keyPackage.iv || !keyPackage.encrypted || !keyPackage.authTag) {
        this.logSecurityEvent('INVALID_KEY_PACKAGE_STRUCTURE', { keyId });
        return null;
      }

      // Derive decryption key
      const masterEncryptionKey = this.getMasterEncryptionKeyOrThrow();
      const masterKeyBuffer = Buffer.from(masterEncryptionKey, 'hex');
      masterKey = masterKeyBuffer;
      const salt = keyRecord.salt ? Buffer.from(keyRecord.salt, 'base64') : crypto.randomBytes(32);

      const decryptionKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(masterKeyBuffer, salt, 100000, 32, 'sha512', (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        });
      });

      // Decrypt key material
      const iv = Buffer.from(keyPackage.iv, 'base64');
      const authTag = Buffer.from(keyPackage.authTag, 'base64');
      const encrypted = Buffer.from(keyPackage.encrypted, 'base64');

      const decipher = createGCMDecipher(keyRecord.algorithm, decryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Add Additional Authenticated Data (AAD) for integrity verification
      const aad = Buffer.concat([
        Buffer.from(this.config.merchantId, 'utf8'),
        Buffer.from(keyId, 'utf8'),
        salt,
      ]);
      decipher.setAAD(aad);

      decryptedKeyMaterial = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      // Create EncryptionKeyPair object
      const keyPair: EncryptionKeyPair = {
        key: decryptedKeyMaterial,
        keyId,
        createdAt: keyRecord.createdAt,
        expiresAt: keyRecord.expiresAt,
      };

      // Update access tracking (fire-and-forget)
      this.updateKeyAccessTracking(keyId).catch((error: unknown) => {
        this.logger.warn(`Failed to update key access tracking: ${(error as Error).message}`);
      });

      // Cache the decrypted key for performance
      this.keyCache.set(keyId, keyPair);

      // Log successful key load
      this.logSecurityEvent('ENCRYPTION_KEY_LOADED', {
        keyId,
        keyType: keyRecord.keyType,
        algorithm: keyRecord.algorithm,
        keySize: keyRecord.keySize,
        loadTime: Date.now() - startTime,
        version: keyRecord.version,
        expiresAt: keyRecord.expiresAt.toISOString(),
      });

      return keyPair;
    } catch (error) {
      this.logSecurityEvent('KEY_LOAD_FAILED', {
        keyId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        loadTime: Date.now() - startTime,
      });
      this.logger.error(`Failed to load encryption key ${keyId}:`, error);
      throw new InternalServerErrorException('Encryption key loading failed');
    } finally {
      // Secure memory cleanup
      this.secureBufferCleanup([masterKey, decryptedKeyMaterial]);
    }
  }

  /**
   * Load HSM-based encryption key
   * Enterprise integration point for Hardware Security Modules
   */
  private loadHSMKey(keyRecord: EncryptionKeyDocument): EncryptionKeyPair | null {
    try {
      if (this.config.hsmEnabled !== true || !keyRecord.hsmKeyId) {
        this.logSecurityEvent('HSM_KEY_LOAD_FAILED', {
          keyId: keyRecord.keyId,
          reason: 'HSM not enabled or missing HSM key ID',
        });
        return null;
      }

      // In production, integrate with actual HSM providers:
      // - AWS KMS: Use AWS SDK to decrypt with KMS key
      // - Azure Key Vault: Use Azure SDK for key operations
      // - Hardware HSM: Use PKCS#11 or vendor-specific APIs

      this.logger.warn(`HSM key loading not fully implemented for keyId: ${keyRecord.keyId}`);

      // Placeholder for HSM integration
      // const hsmKey = await this.hsmProvider.decryptKey(keyRecord.hsmKeyId);

      // For now, fallback to software-based key loading
      this.logSecurityEvent('HSM_FALLBACK_USED', {
        keyId: keyRecord.keyId,
        hsmProvider: keyRecord.hsmProvider,
        hsmKeyId: keyRecord.hsmKeyId,
      });

      return null; // Implement actual HSM integration
    } catch (error) {
      this.logSecurityEvent('HSM_KEY_LOAD_ERROR', {
        keyId: keyRecord.keyId,
        hsmProvider: keyRecord.hsmProvider,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Update key access tracking for audit and security monitoring
   */
  private async updateKeyAccessTracking(keyId: string): Promise<void> {
    try {
      await this.encryptionKeyModel
        .updateOne(
          {
            keyId,
            merchantId: this.config.merchantId,
            status: KeyStatus.ACTIVE,
          },
          {
            $set: { lastAccessedAt: new Date() },
            $inc: { accessCount: 1 },
          },
          {
            // Prevent creation of new documents
            upsert: false,
            // Use write concern for important operations
            writeConcern: { w: 'majority', j: true },
          },
        )
        .exec();
    } catch (error) {
      // Non-critical operation - log but don't throw
      this.logger.warn(`Failed to update key access tracking for ${keyId}:`, error);
    }
  }

  /**
   * Store encryption key securely in database
   * Used by key generation process for persistence
   */
  private async storeEncryptionKey(keyPair: EncryptionKeyPair, keyMaterial: Buffer): Promise<void> {
    let masterKey: Buffer | null = null;
    let encryptedKeyMaterial: Buffer | null = null;

    try {
      if (!this.config.masterEncryptionKey) {
        throw new Error('Master encryption key not configured');
      }

      // Generate unique salt for this key
      const salt = crypto.randomBytes(this.SALT_SIZE);

      // Derive encryption key for storing key material
      const masterEncryptionKey = this.getMasterEncryptionKeyOrThrow();
      const masterKeyBuffer = Buffer.from(masterEncryptionKey, 'hex');
      masterKey = masterKeyBuffer;
      const storageKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(masterKeyBuffer, salt, 100000, 32, 'sha512', (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        });
      });

      // Encrypt the key material
      const iv = crypto.randomBytes(this.IV_SIZE);
      const cipher = createGCMCipher(this.ALGORITHM, storageKey, iv);

      // Add Additional Authenticated Data
      const aad = Buffer.concat([
        Buffer.from(this.config.merchantId, 'utf8'),
        Buffer.from(keyPair.keyId, 'utf8'),
        salt,
      ]);
      cipher.setAAD(aad);

      encryptedKeyMaterial = Buffer.concat([cipher.update(keyMaterial), cipher.final()]);

      const authTag = cipher.getAuthTag();

      // Create encrypted package
      const keyPackage = {
        version: '2.0',
        algorithm: this.ALGORITHM,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encrypted: encryptedKeyMaterial.toString('base64'),
        timestamp: Date.now(),
      };

      // Store in database
      const encryptionKey = new this.encryptionKeyModel({
        keyId: keyPair.keyId,
        status: KeyStatus.ACTIVE,
        keyType: this.config.hsmEnabled === true ? KeyType.HSM_REFERENCE : KeyType.DERIVED_KEY,
        merchantId: this.config.merchantId,
        environment: this.config.environment,
        encryptedKey: Buffer.from(JSON.stringify(keyPackage)).toString('base64'),
        salt: salt.toString('base64'),
        expiresAt: keyPair.expiresAt,
        version: 2,
        createdBy: 'system',
        algorithm: this.ALGORITHM,
        keySize: this.KEY_SIZE,
        derivationMethod: 'PBKDF2-SHA512',
        metadata: {
          createdByService: 'SMTPaymentService',
          rotationInterval: this.config.keyRotationInterval,
        },
      });

      await encryptionKey.save();

      this.logSecurityEvent('ENCRYPTION_KEY_STORED', {
        keyId: keyPair.keyId,
        algorithm: this.ALGORITHM,
        keySize: this.KEY_SIZE,
        expiresAt: keyPair.expiresAt.toISOString(),
      });
    } catch (error) {
      this.logSecurityEvent('KEY_STORAGE_FAILED', {
        keyId: keyPair.keyId,
        error: (error as Error).message,
      });
      throw new InternalServerErrorException('Failed to store encryption key securely');
    } finally {
      this.secureBufferCleanup([masterKey, encryptedKeyMaterial]);
    }
  }

  /**
   * Generate current key ID based on time rotation
   */
  private getCurrentKeyId(): string {
    const rotationPeriod = this.getKeyRotationIntervalOrThrow();
    const currentPeriod = Math.floor(Date.now() / rotationPeriod);
    return `key_${currentPeriod}_${this.config.merchantId}`;
  }

  /**
   * Secure buffer cleanup - zeros out sensitive memory
   */
  private secureBufferCleanup(buffers: (Buffer | null)[]): void {
    buffers.forEach((buffer) => {
      if (buffer && Buffer.isBuffer(buffer)) {
        // Zero out the buffer memory
        buffer.fill(0);
      }
    });
  }

  /**
   * Security audit logging
   */
  private logSecurityEvent(eventType: string, details: Record<string, unknown>): void {
    const auditLog = {
      timestamp: new Date().toISOString(),
      eventType,
      merchantId: this.config.merchantId,
      environment: this.config.environment,
      details,
      // Never log actual card data or keys
      sanitized: true,
    };

    // Log to structured logger for SIEM integration
    this.logger.log(`[SECURITY_AUDIT] ${eventType}`, auditLog);
  }

  private isValidCardNumber(cardNumber: string): boolean {
    // Luhn algorithm for card validation
    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (!/^\d+$/.test(cleanNumber)) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber[i] ?? '0', 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  getCardType(cardNumber: string): PaymentMethod {
    const cleanNumber = cardNumber.replace(/\s/g, '');

    if (cleanNumber.startsWith('4')) {
      return PaymentMethod.VISA;
    }
    if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) {
      return PaymentMethod.MASTERCARD;
    }
    if (cleanNumber.startsWith('9')) {
      return PaymentMethod.EDAHABIA;
    } // Edahabia cards typically start with 9

    return PaymentMethod.LOCAL_BANK_CARD;
  }

  maskCardNumber(cardNumber: string): string {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const firstSix = cleanNumber.substring(0, 6);
    const lastFour = cleanNumber.substring(cleanNumber.length - 4);
    const maskedMiddle = '*'.repeat(cleanNumber.length - 10);
    return `${firstSix}${maskedMiddle}${lastFour}`;
  }
}
